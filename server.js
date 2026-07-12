require('dotenv').config();

const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { MongoClient } = require('mongodb');
const { WebSocketServer } = require('ws');

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || '0.0.0.0';

const SYSTEM_PROMPT = 'You are a polished and helpful AI assistant. Respond clearly, concisely, and with structure when useful.';

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

// Models the frontend is allowed to request, per provider. Anything else
// gets silently replaced with the provider's default. This prevents a
// client from injecting an arbitrary string into the upstream API URL/body.
const ALLOWED_MODELS = {
  gemini: ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-pro'],
  groq: ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'mixtral-8x7b-32768'],
  openai: ['gpt-4o-mini', 'gpt-4o']
};

const DEFAULT_MODELS = {
  gemini: 'gemini-2.0-flash',
  groq: 'llama-3.1-8b-instant',
  openai: 'gpt-4o-mini'
};

// Comma-separated list of origins allowed to call the API, e.g.
// "https://myapp.com,https://www.myapp.com". If left unset, we fall back to
// allowing localhost/127.0.0.1 on any port, which is convenient for local
// development but should NOT be relied on in production.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const MAX_BODY_BYTES = 20 * 1024 * 1024; // 20MB cap on incoming request bodies
const MAX_ATTACHMENTS = 6;
const MAX_ATTACHMENT_DATA_URL_LENGTH = 7 * 1024 * 1024; // ~5MB of binary data
const MAX_HISTORY_MESSAGES = 20;
const MAX_HISTORY_MESSAGE_CHARS = 6000;
const UPSTREAM_TIMEOUT_MS = 30000;
const isDev = process.env.NODE_ENV !== 'production';
const RAG_ENABLED = process.env.RAG_ENABLED !== 'false';
const RAG_TOP_K = 3;
const RAG_CHUNK_SIZE = 700;
const RAG_CACHE_TTL_MS = 1000 * 60 * 5;
const RAG_SCAN_EXTENSIONS = new Set(['.md', '.txt', '.json']);
const RAG_EXCLUDED_FILES = new Set(['package-lock.json', 'conversations.json']);

let ragIndexCache = null;
let ragIndexCacheTime = 0;

function normalizeText(text) {
  return (text || '').replace(/\r/g, '').replace(/\s+/g, ' ').trim();
}

function tokenize(text) {
  return (text || '').toLowerCase().match(/[a-z0-9]+/g) || [];
}

function buildChunksFromText(text, sourcePath) {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  const sentenceLikeParts = normalized
    .split(/\n{2,}|(?<=[.!?])\s+/)
    .map(part => part.trim())
    .filter(Boolean);

  const chunks = [];
  let current = '';

  for (const part of sentenceLikeParts) {
    const candidate = current ? `${current} ${part}` : part;
    if (candidate.length <= RAG_CHUNK_SIZE) {
      current = candidate;
      continue;
    }

    if (current) {
      chunks.push(current);
    }

    const words = part.split(/\s+/);
    let segment = '';
    for (const word of words) {
      const next = segment ? `${segment} ${word}` : word;
      if (next.length <= RAG_CHUNK_SIZE) {
        segment = next;
      } else if (segment) {
        chunks.push(segment);
        segment = word;
      } else {
        segment = word;
      }
    }

    current = segment;
  }

  if (current) {
    chunks.push(current);
  }

  return chunks
    .map(chunk => ({ text: chunk.trim(), source: sourcePath }))
    .filter(chunk => chunk.text.length >= 40);
}

async function buildKnowledgeIndex() {
  if (!RAG_ENABLED) return [];
  if (ragIndexCache && Date.now() - ragIndexCacheTime < RAG_CACHE_TTL_MS) {
    return ragIndexCache;
  }

  const collectedChunks = [];
  const rootDir = __dirname;

  async function walk(dirPath) {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '.env') {
        continue;
      }

      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }

      const ext = path.extname(entry.name).toLowerCase();
      if (!RAG_SCAN_EXTENSIONS.has(ext)) continue;
      if (RAG_EXCLUDED_FILES.has(entry.name)) continue;

      try {
        const content = await fs.promises.readFile(fullPath, 'utf8');
        if (!content || content.length > 200000) continue;
        collectedChunks.push(...buildChunksFromText(content, path.relative(rootDir, fullPath).replace(/\\/g, '/')));
      } catch (error) {
        // Ignore unreadable files and continue.
      }
    }
  }

  await walk(rootDir);
  ragIndexCache = collectedChunks;
  ragIndexCacheTime = Date.now();
  return ragIndexCache;
}

function scoreChunk(query, chunk) {
  const queryTerms = new Set(tokenize(query));
  if (!queryTerms.size) return 0;

  const haystack = `${chunk.source} ${chunk.text}`.toLowerCase();
  let score = 0;
  queryTerms.forEach(term => {
    if (haystack.includes(term)) score += 2;
  });

  const queryText = tokenize(query).join(' ');
  if (queryText && haystack.includes(queryText)) {
    score += 5;
  }

  return score;
}

async function retrieveRelevantContext(userMessage, limit = RAG_TOP_K) {
  if (!RAG_ENABLED) return [];
  const query = String(userMessage || '').trim();
  if (!query) return [];

  const index = await buildKnowledgeIndex();
  if (!index.length) return [];

  return index
    .map(chunk => ({ ...chunk, score: scoreChunk(query, chunk) }))
    .filter(chunk => chunk.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ text, source }) => ({ text, source }));
}

function buildPromptWithContext(currentText, contextChunks) {
  if (!Array.isArray(contextChunks) || !contextChunks.length) {
    return currentText;
  }

  const contextBlock = contextChunks
    .map((chunk, index) => `[${index + 1}] ${chunk.source}\n${chunk.text}`)
    .join('\n\n');

  return `${currentText}\n\nRelevant project context:\n${contextBlock}\n\nUse the context above when it helps answer. If it is not relevant, answer normally.`;
}

function isOriginAllowed(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (ALLOWED_ORIGINS.length === 0) {
    // Dev fallback: allow localhost / 127.0.0.1 on any port.
    return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  }
  return false;
}

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  if (isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJson(req, res, statusCode, payload) {
  setCorsHeaders(req, res);
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function readBody(req, maxBytes = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    let chunks = [];
    let bytes = 0;
    let rejected = false;

    req.on('data', chunk => {
      if (rejected) return;
      bytes += chunk.length;
      if (bytes > maxBytes) {
        rejected = true;
        const err = new Error('Payload too large');
        err.code = 'PAYLOAD_TOO_LARGE';
        reject(err);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!rejected) resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', reject);
  });
}

async function serveStaticFile(req, res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  const acceptEncoding = req.headers['accept-encoding'] || '';
  const canGzip = acceptEncoding.includes('gzip') && ['.html', '.js', '.css', '.json'].includes(ext);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      sendJson(req, res, 404, { error: 'File not found' });
      return;
    }

    setCorsHeaders(req, res);
    if (isDev) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else {
      res.setHeader('Cache-Control', ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable');
    }

    if (canGzip) {
      const compressed = zlib.gzipSync(data);
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Vary', 'Accept-Encoding');
      res.writeHead(200, { 'Content-Type': contentType, 'Content-Length': compressed.length });
      res.end(compressed);
      return;
    }

    res.writeHead(200, { 'Content-Type': contentType, 'Content-Length': data.length });
    res.end(data);
  });
}

function withTimeout(ms) {
  // AbortSignal.timeout is available in Node 18+. Fall back gracefully if not.
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms);
  }
  return undefined;
}

let mongoClient = null;
let conversationsCollection = null;

async function connectToMongo() {
  if (conversationsCollection) return conversationsCollection;
  if (!process.env.MONGODB_URI) return null;

  try {
    mongoClient = new MongoClient(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000
    });
    await mongoClient.connect();
    const dbName = process.env.MONGODB_DB || 'chatbox';
    const db = mongoClient.db(dbName);
    conversationsCollection = db.collection('conversations');
    console.log(`Connected to MongoDB Atlas database "${dbName}"`);
    return conversationsCollection;
  } catch (error) {
    console.warn('MongoDB Atlas connection failed, falling back to in-memory storage:', error.message);
    return null;
  }
}

function normalizeConversation(doc) {
  return {
    id: doc._id || doc.id,
    title: doc.title || 'New chat',
    messages: Array.isArray(doc.messages) ? doc.messages : [],
    createdAt: doc.createdAt || new Date().toISOString(),
    updatedAt: doc.updatedAt || new Date().toISOString()
  };
}

async function listConversations() {
  const collection = await connectToMongo();
  if (!collection) return [];

  const docs = await collection.find({}).sort({ updatedAt: -1, createdAt: -1 }).toArray();
  return docs.map(normalizeConversation);
}

async function upsertConversation(conversation) {
  const collection = await connectToMongo();
  if (!collection) return null;

  const doc = {
    _id: conversation.id,
    id: conversation.id,
    title: conversation.title || 'New chat',
    messages: Array.isArray(conversation.messages) ? conversation.messages : [],
    createdAt: conversation.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await collection.updateOne({ _id: conversation.id }, { $set: doc }, { upsert: true });
  return normalizeConversation(doc);
}

async function deleteConversationById(id) {
  const collection = await connectToMongo();
  if (!collection) return false;

  const result = await collection.deleteOne({ _id: id });
  return result.deletedCount > 0;
}

async function getSearchFallback(userMessage) {
  const query = encodeURIComponent((userMessage || 'latest news').trim());
  try {
    const response = await fetch(`https://api.duckduckgo.com/?q=${query}&format=json&no_redirect=1&no_html=1&skip_disambig=1`, {
      headers: {
        'User-Agent': 'Mozilla/5.0'
      },
      signal: withTimeout(UPSTREAM_TIMEOUT_MS)
    });

    if (!response.ok) {
      throw new Error('Search request failed');
    }

    const data = await response.json();
    const abstractText = data?.AbstractText?.trim();
    const abstractUrl = data?.AbstractURL?.trim();

    if (abstractText) {
      return `I couldn’t reach the selected AI provider right now, so I searched the web for you.\n\n${abstractText}\n\nSource: ${abstractUrl || 'Web search'}\n\nOpen Google: https://www.google.com/search?q=${query}`;
    }

    const firstTopic = data?.RelatedTopics?.[0];
    const topicText = firstTopic?.Text?.trim();
    const topicUrl = firstTopic?.FirstURL?.trim();

    if (topicText) {
      return `I couldn’t reach the selected AI provider right now, so I searched the web for you.\n\n${topicText}\n\nSource: ${topicUrl || 'Web search'}\n\nOpen Google: https://www.google.com/search?q=${query}`;
    }
  } catch (error) {
    // fall back to a helpful message if the search service is unavailable
  }

  return `I couldn’t reach the selected AI provider right now. I can still help by searching the web for your question.\n\nOpen Google: https://www.google.com/search?q=${query}`;
}

// ---- Conversation / attachment sanitization -------------------------------

function sanitizeHistory(rawHistory) {
  if (!Array.isArray(rawHistory)) return [];
  return rawHistory
    .slice(-MAX_HISTORY_MESSAGES)
    .filter(item => item && typeof item.content === 'string' && item.content.trim())
    .map(item => ({
      role: (item.role === 'assistant' || item.role === 'bot') ? 'assistant' : 'user',
      content: item.content.trim().slice(0, MAX_HISTORY_MESSAGE_CHARS)
    }));
}

function sanitizeAttachments(rawAttachments) {
  if (!Array.isArray(rawAttachments)) return [];
  return rawAttachments
    .filter(item => item && typeof item.name === 'string')
    .slice(0, MAX_ATTACHMENTS)
    .map(item => ({
      name: item.name.slice(0, 200),
      type: typeof item.type === 'string' ? item.type : '',
      previewUrl: (typeof item.previewUrl === 'string' && item.previewUrl.length <= MAX_ATTACHMENT_DATA_URL_LENGTH)
        ? item.previewUrl
        : null
    }));
}

function extractBase64(dataUrl) {
  if (typeof dataUrl !== 'string') return null;
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/s);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}

function isImageAttachment(item) {
  return Boolean(item.type && item.type.startsWith('image/') && item.previewUrl);
}

// ---- Provider calls ---------------------------------------------------------

async function callGemini(history, currentText, attachments, modelName, thinkingEnabled) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY');
  }

  const contents = history.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  const parts = [{ text: currentText }];
  attachments.filter(isImageAttachment).forEach(item => {
    const decoded = extractBase64(item.previewUrl);
    if (decoded) {
      parts.push({ inlineData: { mimeType: decoded.mimeType, data: decoded.data } });
    }
  });
  contents.push({ role: 'user', parts });

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: thinkingEnabled ? 0.85 : 0.6
        },
        systemInstruction: {
          parts: [{ text: SYSTEM_PROMPT }]
        }
      }),
      signal: withTimeout(UPSTREAM_TIMEOUT_MS)
    }
  );

  const geminiData = await response.json();
  if (!response.ok) {
    throw new Error(geminiData?.error?.message || 'Gemini request failed');
  }

  return geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't generate a response.";
}

async function callGroq(history, currentText, modelName, thinkingEnabled) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GROQ_API_KEY');
  }

  // Groq's hosted text models here don't accept image input, so attachments
  // are represented only as filenames already folded into currentText.
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: currentText }
  ];

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: modelName,
      temperature: thinkingEnabled ? 0.8 : 0.6,
      messages
    }),
    signal: withTimeout(UPSTREAM_TIMEOUT_MS)
  });

  const groqData = await response.json();
  if (!response.ok) {
    console.error('Groq request failed', response.status, groqData);
    throw new Error(groqData?.error?.message || 'Groq request failed');
  }

  return groqData?.choices?.[0]?.message?.content || "Sorry, I couldn't generate a response.";
}

async function callOpenAI(history, currentText, attachments, modelName, thinkingEnabled) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY');
  }

  const imageAttachments = attachments.filter(isImageAttachment);
  const lastUserContent = imageAttachments.length
    ? [
        { type: 'text', text: currentText },
        ...imageAttachments.map(item => ({ type: 'image_url', image_url: { url: item.previewUrl } }))
      ]
    : currentText;

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: lastUserContent }
  ];

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: modelName,
      temperature: thinkingEnabled ? 0.8 : 0.6,
      messages
    }),
    signal: withTimeout(UPSTREAM_TIMEOUT_MS)
  });

  const openAiData = await response.json();
  if (!response.ok) {
    throw new Error(openAiData?.error?.message || 'OpenAI request failed');
  }

  return openAiData?.choices?.[0]?.message?.content || "Sorry, I couldn't generate a response.";
}

// ---- Request handling -------------------------------------------------------

async function handleChat(req, res) {
  let body;
  try {
    body = await readBody(req);
  } catch (error) {
    if (error.code === 'PAYLOAD_TOO_LARGE') {
      sendJson(req, res, 413, { error: 'Request body too large.' });
    } else {
      sendJson(req, res, 400, { error: 'Failed to read request body.' });
    }
    return;
  }

  let payload = {};
  try {
    payload = body ? JSON.parse(body) : {};
  } catch (error) {
    sendJson(req, res, 400, { error: 'Invalid JSON body' });
    return;
  }

  const userMessage = typeof payload.message === 'string' ? payload.message : '';
  if (!userMessage.trim()) {
    sendJson(req, res, 400, { error: 'Message is required.' });
    return;
  }

  const history = sanitizeHistory(payload.history);
  const attachments = sanitizeAttachments(payload.attachments);
  const nonImageNames = attachments.filter(item => !isImageAttachment(item)).map(item => item.name);
  const currentText = nonImageNames.length
    ? `${userMessage}\n\nAttachments: ${nonImageNames.join(', ')}`
    : userMessage;
  const relevantContext = await retrieveRelevantContext(userMessage);
  const enrichedText = buildPromptWithContext(currentText, relevantContext);

  const provider = ['gemini', 'groq', 'openai'].includes(String(payload.provider || '').toLowerCase())
    ? String(payload.provider).toLowerCase()
    : 'gemini';

  let modelName = String(
    payload.model || process.env[`${provider.toUpperCase()}_MODEL`] || DEFAULT_MODELS[provider]
  ).trim();
  if (!ALLOWED_MODELS[provider].includes(modelName)) {
    modelName = DEFAULT_MODELS[provider];
  }

  const thinkingEnabled = Boolean(payload.thinking);

  try {
    let botText = '';

    if (provider === 'groq') {
      botText = await callGroq(history, enrichedText, modelName, thinkingEnabled);
    } else if (provider === 'openai') {
      botText = await callOpenAI(history, enrichedText, attachments, modelName, thinkingEnabled);
    } else {
      botText = await callGemini(history, enrichedText, attachments, modelName, thinkingEnabled);
    }

    if (!botText || !botText.trim() || botText === "Sorry, I couldn't generate a response.") {
      throw new Error('Provider produced no usable text');
    }

    sendJson(req, res, 200, {
      choices: [
        {
          message: {
            content: botText
          }
        }
      ]
    });
  } catch (error) {
    console.error('Chat provider failed, performing search fallback:', error.message);
    const fallbackText = await getSearchFallback(userMessage);
    sendJson(req, res, 200, {
      choices: [
        {
          message: {
            content: fallbackText
          }
        }
      ],
      fallback: true
    });
  }
}

function buildChatPayload(payload) {
  const userMessage = typeof payload.message === 'string' ? payload.message : '';
  if (!userMessage.trim()) {
    return null;
  }

  const history = sanitizeHistory(payload.history);
  const attachments = sanitizeAttachments(payload.attachments);
  const nonImageNames = attachments.filter(item => !isImageAttachment(item)).map(item => item.name);
  const currentText = nonImageNames.length
    ? `${userMessage}\n\nAttachments: ${nonImageNames.join(', ')}`
    : userMessage;

  const provider = ['gemini', 'groq', 'openai'].includes(String(payload.provider || '').toLowerCase())
    ? String(payload.provider).toLowerCase()
    : 'gemini';

  let modelName = String(
    payload.model || process.env[`${provider.toUpperCase()}_MODEL`] || DEFAULT_MODELS[provider]
  ).trim();
  if (!ALLOWED_MODELS[provider].includes(modelName)) {
    modelName = DEFAULT_MODELS[provider];
  }

  const thinkingEnabled = Boolean(payload.thinking);

  return { userMessage, history, attachments, currentText, provider, modelName, thinkingEnabled };
}

async function handleWebSocketChat(ws, payload) {
  const chatPayload = buildChatPayload(payload);
  if (!chatPayload) {
    ws.send(JSON.stringify({ type: 'error', error: 'Message is required.' }));
    return;
  }

  const { userMessage, history, attachments, currentText, provider, modelName, thinkingEnabled } = chatPayload;
  const relevantContext = await retrieveRelevantContext(userMessage);
  const enrichedText = buildPromptWithContext(currentText, relevantContext);
  ws.send(JSON.stringify({ type: 'status', message: 'Thinking…' }));

  try {
    let botText = '';

    if (provider === 'groq') {
      botText = await callGroq(history, enrichedText, modelName, thinkingEnabled);
    } else if (provider === 'openai') {
      botText = await callOpenAI(history, enrichedText, attachments, modelName, thinkingEnabled);
    } else {
      botText = await callGemini(history, enrichedText, attachments, modelName, thinkingEnabled);
    }

    if (!botText || !botText.trim() || botText === "Sorry, I couldn't generate a response.") {
      throw new Error('Provider produced no usable text');
    }

    ws.send(JSON.stringify({ type: 'done', content: botText }));
  } catch (error) {
    console.error('WebSocket chat provider failed, performing search fallback:', error.message);
    const fallbackText = await getSearchFallback(userMessage);
    ws.send(JSON.stringify({ type: 'done', content: fallbackText, fallback: true }));
  }
}

function isPathInsideRoot(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

async function handleConversationPersistence(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/api/conversations') {
    const conversations = await listConversations();
    sendJson(req, res, 200, conversations);
    return true;
  }

  if ((req.method === 'POST' || req.method === 'PUT') && url.pathname === '/api/conversations') {
    let body = '';
    try {
      body = await readBody(req);
    } catch (error) {
      sendJson(req, res, 400, { error: 'Failed to read request body.' });
      return true;
    }

    let payload = {};
    try {
      payload = body ? JSON.parse(body) : {};
    } catch (error) {
      sendJson(req, res, 400, { error: 'Invalid JSON body' });
      return true;
    }

    if (!payload.id) {
      sendJson(req, res, 400, { error: 'Conversation id is required.' });
      return true;
    }

    const persisted = await upsertConversation(payload);
    if (!persisted) {
      sendJson(req, res, 200, payload);
      return true;
    }

    sendJson(req, res, 200, persisted);
    return true;
  }

  if (req.method === 'DELETE' && url.pathname === '/api/conversations') {
    let body = '';
    try {
      body = await readBody(req);
    } catch (error) {
      sendJson(req, res, 400, { error: 'Failed to read request body.' });
      return true;
    }

    let payload = {};
    try {
      payload = body ? JSON.parse(body) : {};
    } catch (error) {
      sendJson(req, res, 400, { error: 'Invalid JSON body' });
      return true;
    }

    const deleted = await deleteConversationById(payload.id);
    sendJson(req, res, 200, { deleted });
    return true;
  }

  return false;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'OPTIONS') {
    setCorsHeaders(req, res);
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    sendJson(req, res, 200, { status: 'ok' });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/chat') {
    await handleChat(req, res);
    return;
  }

  if (await handleConversationPersistence(req, res)) {
    return;
  }

  let filePath = path.resolve(__dirname, '.' + (url.pathname === '/' ? '/index.html' : url.pathname));

  if (!isPathInsideRoot(__dirname, filePath)) {
    sendJson(req, res, 403, { error: 'Access denied' });
    return;
  }

  try {
    await fs.promises.access(filePath, fs.constants.R_OK);
  } catch {
    filePath = path.join(__dirname, 'index.html');
  }

  await serveStaticFile(req, res, filePath);
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'connected' }));

  ws.on('message', async (raw) => {
    let payload = {};
    try {
      payload = JSON.parse(raw.toString());
    } catch (error) {
      ws.send(JSON.stringify({ type: 'error', error: 'Invalid JSON payload.' }));
      return;
    }

    if (payload.type !== 'chat') {
      ws.send(JSON.stringify({ type: 'error', error: 'Unsupported message type.' }));
      return;
    }

    await handleWebSocketChat(ws, payload);
  });
});

if (require.main === module) {
  server.listen(port, host, () => {
    const displayHost = host === '0.0.0.0' ? 'localhost' : host;
    console.log(`Chat backend is running at http://${displayHost}:${port}`);
    if (ALLOWED_ORIGINS.length === 0) {
      console.log('ALLOWED_ORIGINS not set — defaulting to localhost-only CORS. Set ALLOWED_ORIGINS for production.');
    }
  });
}

module.exports = {
  buildKnowledgeIndex,
  retrieveRelevantContext,
  buildPromptWithContext
};
