require('dotenv').config();

const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');
const { OAuth2Client } = require('google-auth-library');
const { WebSocketServer } = require('ws');
const busboy = require('busboy');
const fetch = global.fetch || require('node-fetch');

process.on('unhandledRejection', (reason, promise) => {
  console.warn('Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

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

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const MAX_BODY_BYTES = 20 * 1024 * 1024;
const MAX_ATTACHMENTS = 6;
const MAX_ATTACHMENT_DATA_URL_LENGTH = 7 * 1024 * 1024;
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

const app = express();

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

const oauthClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID || '');
const inMemoryConversations = new Map();
const inMemoryUsers = new Map();

let ragIndexCache = null;
let ragIndexCacheTime = 0;

function normalizeText(text) {
  return (text || '').replace(/\r/g, '').replace(/\s+/g, ' ').trim();
}

function isAuthenticated(req, res, next) {
  if (req.session?.user && req.session.user.googleId) {
    return next();
  }

  if (req.path.startsWith('/api/')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  next();
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
        // Ignore unreadable files
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
    return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  }
  return false;
}

function setCorsHeaders(req, res, next) {
  const origin = req.headers.origin;
  if (isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (typeof next === 'function') {
    next();
  }
}

function getUserId(req) {
  return req.session?.user?.googleId || null;
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
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms);
  }
  return undefined;
}

let pgPool = null;
let pgReady = false;
let pgInitPromise = null;

async function connectToDatabase() {
  if (pgReady && pgPool) return pgPool;
  if (pgInitPromise) return pgInitPromise;

  const databaseUrl = process.env.DATABASE_URL || process.env.MONGODB_URI;
  if (!databaseUrl) {
    console.warn('DATABASE_URL is not configured; PostgreSQL storage will be disabled.');
    return null;
  }

  pgInitPromise = (async () => {
    try {
      pgPool = new Pool({
        connectionString: databaseUrl,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        max: 5
      });

      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS users (
          google_id TEXT PRIMARY KEY,
          name TEXT,
          email TEXT,
          avatar TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS conversations (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          title TEXT,
          messages JSONB NOT NULL DEFAULT '[]'::jsonb,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `);

      pgReady = true;
      console.log('Connected to PostgreSQL');
      return pgPool;
    } catch (error) {
      console.warn('PostgreSQL connection failed, falling back to in-memory storage:', error.message);
      pgPool = null;
      pgReady = false;
      return null;
    } finally {
      pgInitPromise = null;
    }
  })();

  return pgInitPromise;
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

// *** FIX: include googleId in the returned object so session auth check works ***
function normalizeUser(doc) {
  return {
    id: doc.googleId,
    googleId: doc.googleId,
    name: doc.name,
    email: doc.email,
    avatar: doc.avatar
  };
}

async function getUserByGoogleId(googleId) {
  if (!googleId) return null;
  const pool = await connectToDatabase();
  if (!pool) {
    return inMemoryUsers.get(googleId) || null;
  }

  const { rows } = await pool.query(
    'SELECT google_id AS "googleId", name, email, avatar FROM users WHERE google_id = $1',
    [googleId]
  );
  return rows[0] ? normalizeUser(rows[0]) : null;
}

async function upsertUser(user) {
  if (!user || !user.googleId) return null;
  const doc = {
    googleId: user.googleId,
    name: user.name || '',
    email: user.email || '',
    avatar: user.avatar || '',
    updatedAt: new Date().toISOString()
  };

  const pool = await connectToDatabase();
  if (!pool) {
    if (!inMemoryUsers.has(user.googleId)) {
      doc.createdAt = new Date().toISOString();
    } else {
      doc.createdAt = inMemoryUsers.get(user.googleId).createdAt;
    }
    inMemoryUsers.set(user.googleId, doc);
    return normalizeUser(doc);
  }

  const { rows } = await pool.query(
    `INSERT INTO users (google_id, name, email, avatar, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (google_id) DO UPDATE SET
       name = EXCLUDED.name,
       email = EXCLUDED.email,
       avatar = EXCLUDED.avatar,
       updated_at = NOW()
     RETURNING google_id AS "googleId", name, email, avatar`,
    [user.googleId, doc.name, doc.email, doc.avatar]
  );

  return rows[0] ? normalizeUser(rows[0]) : null;
}

async function listConversations(userId) {
  const pool = await connectToDatabase();
  if (!pool) {
    return Array.from(inMemoryConversations.values())
      .filter(doc => doc.userId === userId)
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
      .map(normalizeConversation);
  }

  const { rows } = await pool.query(
    'SELECT id, title, messages, created_at, updated_at FROM conversations WHERE user_id = $1 ORDER BY updated_at DESC, created_at DESC',
    [userId]
  );

  return rows.map(row => normalizeConversation({
    _id: row.id,
    id: row.id,
    title: row.title,
    messages: row.messages || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
}

async function upsertConversation(conversation, userId) {
  const doc = {
    _id: conversation.id,
    id: conversation.id,
    userId,
    title: conversation.title || 'New chat',
    messages: Array.isArray(conversation.messages) ? conversation.messages : [],
    createdAt: conversation.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const pool = await connectToDatabase();
  if (!pool) {
    inMemoryConversations.set(conversation.id, doc);
    return normalizeConversation(doc);
  }

  const { rows } = await pool.query(
    `INSERT INTO conversations (id, user_id, title, messages, created_at, updated_at)
     VALUES ($1, $2, $3, $4::jsonb, $5, NOW())
     ON CONFLICT (id) DO UPDATE SET
       title = EXCLUDED.title,
       messages = EXCLUDED.messages,
       updated_at = NOW()
     RETURNING id, title, messages, created_at, updated_at`,
    [conversation.id, userId, doc.title, JSON.stringify(doc.messages), doc.createdAt]
  );

  const row = rows[0];
  return normalizeConversation({
    _id: row.id,
    id: row.id,
    title: row.title,
    messages: row.messages || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  });
}

async function deleteConversationById(id, userId) {
  const pool = await connectToDatabase();
  if (!pool) {
    return inMemoryConversations.delete(id);
  }

  const { rowCount } = await pool.query('DELETE FROM conversations WHERE id = $1 AND user_id = $2 RETURNING id', [id, userId]);
  return rowCount > 0;
}

async function getSearchFallback(userMessage) {
  const query = encodeURIComponent((userMessage || 'latest news').trim());
  try {
    const response = await fetch(`https://api.duckduckgo.com/?q=${query}&format=json&no_redirect=1&no_html=1&skip_disambig=1`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: withTimeout(UPSTREAM_TIMEOUT_MS)
    });

    if (!response.ok) throw new Error('Search request failed');

    const data = await response.json();
    const abstractText = data?.AbstractText?.trim();
    const abstractUrl = data?.AbstractURL?.trim();

    if (abstractText) {
      return `I couldn't reach the selected AI provider right now, so I searched the web for you.\n\n${abstractText}\n\nSource: ${abstractUrl || 'Web search'}\n\nOpen Google: https://www.google.com/search?q=${query}`;
    }

    const firstTopic = data?.RelatedTopics?.[0];
    const topicText = firstTopic?.Text?.trim();
    const topicUrl = firstTopic?.FirstURL?.trim();

    if (topicText) {
      return `I couldn't reach the selected AI provider right now, so I searched the web for you.\n\n${topicText}\n\nSource: ${topicUrl || 'Web search'}\n\nOpen Google: https://www.google.com/search?q=${query}`;
    }
  } catch (error) {
    // fall back to helpful message
  }

  return `I couldn't reach the selected AI provider right now. I can still help by searching the web for your question.\n\nOpen Google: https://www.google.com/search?q=${query}`;
}

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

async function callGemini(history, currentText, attachments, modelName, thinkingEnabled) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Missing GEMINI_API_KEY');

  const contents = history.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  const parts = [{ text: currentText }];
  attachments.filter(isImageAttachment).forEach(item => {
    const decoded = extractBase64(item.previewUrl);
    if (decoded) parts.push({ inlineData: { mimeType: decoded.mimeType, data: decoded.data } });
  });
  contents.push({ role: 'user', parts });

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: { temperature: thinkingEnabled ? 0.85 : 0.6 },
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] }
      }),
      signal: withTimeout(UPSTREAM_TIMEOUT_MS)
    }
  );

  const geminiData = await response.json();
  if (!response.ok) throw new Error(geminiData?.error?.message || 'Gemini request failed');
  return geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't generate a response.";
}

async function callGroq(history, currentText, modelName, thinkingEnabled) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('Missing GROQ_API_KEY');

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: currentText }
  ];

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: modelName, temperature: thinkingEnabled ? 0.8 : 0.6, messages }),
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
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY');

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
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: modelName, temperature: thinkingEnabled ? 0.8 : 0.6, messages }),
    signal: withTimeout(UPSTREAM_TIMEOUT_MS)
  });

  const openAiData = await response.json();
  if (!response.ok) throw new Error(openAiData?.error?.message || 'OpenAI request failed');
  return openAiData?.choices?.[0]?.message?.content || "Sorry, I couldn't generate a response.";
}

function writeSseEvent(res, event, data) {
  if (res.writableEnded) return false;
  const payload = typeof data === 'string' ? data : JSON.stringify(data);
  const lines = payload.split(/\r?\n/).map(line => `data: ${line}`).join('\n');
  try {
    res.write(`event: ${event}\n${lines}\n\n`);
    return true;
  } catch (error) {
    return false;
  }
}

function extractGeminiDelta(parsed) {
  if (!parsed || typeof parsed !== 'object') return '';
  if (typeof parsed.text === 'string') return parsed.text;

  const candidateText = parsed?.candidates?.[0]?.content?.parts?.map(part => part?.text || '').join('');
  if (candidateText) return candidateText;

  const deltaContent = parsed?.response?.delta?.content || parsed?.response?.content;
  if (deltaContent) {
    if (typeof deltaContent === 'string') return deltaContent;
    if (Array.isArray(deltaContent)) {
      return deltaContent.map(item => {
        if (!item || typeof item !== 'object') return '';
        return typeof item.text === 'string' ? item.text : typeof item.content === 'string' ? item.content : '';
      }).join('');
    }
  }
  return '';
}

async function streamOpenAICompatible(provider, apiUrl, apiKey, messages, modelName, thinkingEnabled, abortSignal, onDelta) {
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: modelName, temperature: thinkingEnabled ? 0.8 : 0.6, messages, stream: true }),
    signal: abortSignal
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unable to read provider error');
    const parsedError = (() => {
      try { return JSON.parse(errorText)?.error?.message || errorText; }
      catch { return errorText; }
    })();
    throw new Error(parsedError || `${provider} request failed`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const chunk = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf('\n\n');

      const lines = chunk.split(/\r?\n/);
      for (const line of lines) {
        const text = line.trim();
        if (!text) continue;
        if (text === 'data: [DONE]' || text === 'data:[DONE]') return;
        if (!text.startsWith('data:')) continue;
        const payloadText = text.slice(5).trim();
        if (!payloadText) continue;

        let parsed;
        try { parsed = JSON.parse(payloadText); }
        catch { continue; }

        const delta = parsed?.choices?.[0]?.delta?.content;
        if (typeof delta === 'string' && delta) {
          onDelta(delta);
        } else if (Array.isArray(delta)) {
          onDelta(delta.map(item => item?.content || '').join(''));
        }
      }
    }
  }
}

async function streamGemini(history, currentText, attachments, modelName, thinkingEnabled, abortSignal, onDelta) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Missing GEMINI_API_KEY');

  const contents = history.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  const parts = [{ text: currentText }];
  attachments.filter(isImageAttachment).forEach(item => {
    const decoded = extractBase64(item.previewUrl);
    if (decoded) parts.push({ inlineData: { mimeType: decoded.mimeType, data: decoded.data } });
  });
  contents.push({ role: 'user', parts });

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:streamGenerateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: { temperature: thinkingEnabled ? 0.85 : 0.6 },
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] }
      }),
      signal: abortSignal
    }
  );

  if (!response.ok) {
    const geminiData = await response.text().catch(() => 'Gemini streaming request failed');
    throw new Error(geminiData || 'Gemini streaming request failed');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIndex = buffer.indexOf('\n');
    while (newlineIndex !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      newlineIndex = buffer.indexOf('\n');

      if (!line || line === '[DONE]') continue;

      let parsed;
      try { parsed = JSON.parse(line); }
      catch { continue; }

      const delta = extractGeminiDelta(parsed);
      if (delta) onDelta(delta);
    }
  }
}

async function streamProviderResponse({ provider, history, enrichedText, attachments, modelName, thinkingEnabled, abortSignal }, onDelta) {
  if (provider === 'groq') {
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: enrichedText }
    ];
    await streamOpenAICompatible('Groq', 'https://api.groq.com/openai/v1/chat/completions', process.env.GROQ_API_KEY, messages, modelName, thinkingEnabled, abortSignal, onDelta);
  } else if (provider === 'openai') {
    const imageAttachments = attachments.filter(isImageAttachment);
    const lastUserContent = imageAttachments.length
      ? [
          { type: 'text', text: enrichedText },
          ...imageAttachments.map(item => ({ type: 'image_url', image_url: { url: item.previewUrl } }))
        ]
      : enrichedText;

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: lastUserContent }
    ];
    await streamOpenAICompatible('OpenAI', 'https://api.openai.com/v1/chat/completions', process.env.OPENAI_API_KEY, messages, modelName, thinkingEnabled, abortSignal, onDelta);
  } else {
    await streamGemini(history, enrichedText, attachments, modelName, thinkingEnabled, abortSignal, onDelta);
  }
}

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
  if (!ALLOWED_MODELS[provider].includes(modelName)) modelName = DEFAULT_MODELS[provider];

  const thinkingEnabled = Boolean(payload.thinking);

  setCorsHeaders(req, res);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.writeHead(200);
  res.flushHeaders?.();

  const abortController = new AbortController();
  req.on('close', () => abortController.abort());

  let sentChunks = false;

  try {
    await streamProviderResponse(
      { provider, history, enrichedText, attachments, modelName, thinkingEnabled, abortSignal: abortController.signal },
      (delta) => {
        if (!delta) return;
        sentChunks = true;
        writeSseEvent(res, 'message', { delta });
      }
    );
    writeSseEvent(res, 'done', { complete: true });
  } catch (error) {
    console.error('Chat provider failed, performing search fallback:', error.message);
    const fallbackText = await getSearchFallback(userMessage);
    if (!sentChunks) writeSseEvent(res, 'message', { delta: fallbackText, fallback: true });
    writeSseEvent(res, 'error', { message: error.message || 'Provider request failed.' });
    writeSseEvent(res, 'done', { complete: true, fallback: !sentChunks });
  } finally {
    res.end();
  }
}

function buildChatPayload(payload) {
  const userMessage = typeof payload.message === 'string' ? payload.message : '';
  if (!userMessage.trim()) return null;

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
  if (!ALLOWED_MODELS[provider].includes(modelName)) modelName = DEFAULT_MODELS[provider];

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

async function handleConversationPersistence(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const userId = getUserId(req);

  if (!userId) {
    if (req.path.startsWith('/api/')) {
      sendJson(req, res, 401, { error: 'Authentication required' });
      return true;
    }
    return false;
  }

  if (req.method === 'GET' && url.pathname === '/api/conversations') {
    const conversations = await listConversations(userId);
    sendJson(req, res, 200, conversations);
    return true;
  }

  if ((req.method === 'POST' || req.method === 'PUT') && url.pathname === '/api/conversations') {
    let body = '';
    try { body = await readBody(req); }
    catch (error) { sendJson(req, res, 400, { error: 'Failed to read request body.' }); return true; }

    let payload = {};
    try { payload = body ? JSON.parse(body) : {}; }
    catch (error) { sendJson(req, res, 400, { error: 'Invalid JSON body' }); return true; }

    if (!payload.id) { sendJson(req, res, 400, { error: 'Conversation id is required.' }); return true; }

    const persisted = await upsertConversation(payload, userId);
    sendJson(req, res, 200, persisted || payload);
    return true;
  }

  if (req.method === 'DELETE' && url.pathname === '/api/conversations') {
    let body = '';
    try { body = await readBody(req); }
    catch (error) { sendJson(req, res, 400, { error: 'Failed to read request body.' }); return true; }

    let payload = {};
    try { payload = body ? JSON.parse(body) : {}; }
    catch (error) { sendJson(req, res, 400, { error: 'Invalid JSON body' }); return true; }

    const deleted = await deleteConversationById(payload.id, userId);
    sendJson(req, res, 200, { deleted });
    return true;
  }

  return false;
}

// ---- Session setup ----------------------------------------------------------

const sessionOptions = {
  secret: process.env.SESSION_SECRET || 'supersecretlocal',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
};

if (process.env.DATABASE_URL && process.env.NODE_ENV === 'production') {
  sessionOptions.store = new pgSession({
    conString: process.env.DATABASE_URL,
    tableName: 'session',
    ssl: { rejectUnauthorized: false },
    createTableIfMissing: true
  });
  console.log('Using PostgreSQL session store');
} else {
  console.warn('SESSION WARNING: Using in-memory session store. Sessions will be lost on restart.');
}

app.use(session(sessionOptions));
app.use(setCorsHeaders);
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: false, limit: '20mb' }));

// ---- Routes -----------------------------------------------------------------

app.get('/login', (req, res) => {
  if (req.session?.user?.googleId) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/auth/google', (req, res) => {
  res.redirect('/login');
});

app.get('/api/google-client-id', (req, res) => {
  res.json({ clientId: process.env.GOOGLE_CLIENT_ID || '' });
});

app.post('/auth/google/callback', async (req, res) => {
  let payload = {};
  if (req.body && Object.keys(req.body).length > 0) {
    payload = req.body;
  } else {
    let body = '';
    try {
      body = await readBody(req);
    } catch (error) {
      return res.status(400).json({ error: 'Failed to read request body.' });
    }

    try {
      payload = body ? JSON.parse(body) : {};
    } catch (error) {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
  }

  const idToken = typeof payload.id_token === 'string'
    ? payload.id_token
    : typeof payload.credential === 'string'
      ? payload.credential
      : '';

  if (!idToken) {
    return res.status(400).json({ error: 'Missing id_token or credential' });
  }

  let ticket;
  try {
    ticket = await oauthClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID
    });
  } catch (error) {
    console.error('Google token validation failed:', error?.message);
    return res.status(401).json({ error: 'Invalid Google token' });
  }

  const tokenPayload = ticket.getPayload();
  if (!tokenPayload) {
    return res.status(401).json({ error: 'Invalid Google token payload' });
  }

  const user = {
    googleId: tokenPayload.sub,
    name: tokenPayload.name || '',
    email: tokenPayload.email || '',
    avatar: tokenPayload.picture || ''
  };

  const savedUser = await upsertUser(user);
  req.session.user = savedUser;

  req.session.save(err => {
    if (err) {
      console.warn('Session save failed:', err?.message);
      return res.status(500).json({ error: 'Session save failed' });
    }
    res.json({ user: savedUser, ok: true, redirect: '/' });
  });
});

app.post('/auth/google/redirect', express.urlencoded({ extended: false }), async (req, res) => {
  const idToken = typeof req.body.credential === 'string'
    ? req.body.credential
    : typeof req.body.id_token === 'string'
      ? req.body.id_token
      : '';

  if (!idToken) {
    return res.status(400).send('Missing credential. Please retry login.');
  }

  let ticket;
  try {
    ticket = await oauthClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID
    });
  } catch (error) {
    console.error('Google redirect token validation failed:', error?.message);
    return res.status(401).send('Invalid Google token. Please retry login.');
  }

  const tokenPayload = ticket.getPayload();
  if (!tokenPayload) {
    return res.status(401).send('Invalid Google token payload. Please retry login.');
  }

  const user = {
    googleId: tokenPayload.sub,
    name: tokenPayload.name || '',
    email: tokenPayload.email || '',
    avatar: tokenPayload.picture || ''
  };

  const savedUser = await upsertUser(user);
  req.session.user = savedUser;

  req.session.save(err => {
    if (err) {
      console.warn('Session save failed:', err?.message);
      return res.status(500).send('Session save failed. Please retry login.');
    }
    res.redirect('/');
  });
});

app.post('/auth/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) console.warn('Session destroy failed:', err.message);
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

app.get('/debug/set-cookie', (req, res) => {
  setCorsHeaders(req, res);
  res.cookie('agni_debug', '1', {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'none',
    maxAge: 60 * 1000
  });
  res.json({ ok: true, note: 'Debug cookie set (agni_debug)' });
});

app.get('/debug/check-session', (req, res) => {
  setCorsHeaders(req, res);
  const cookieHeader = req.headers?.cookie || null;
  console.log('/debug/check-session request cookies:', cookieHeader);
  res.json({
    sessionId: req.sessionID || null,
    hasUser: Boolean(req.session?.user),
    user: req.session?.user || null,
    requestCookies: cookieHeader,
    usingPgStore: Boolean(process.env.DATABASE_URL && process.env.NODE_ENV === 'production')
  });
});

app.get('/api/user', (req, res) => {
  const user = req.session?.user || null;
  res.json({ user });
});

app.post('/api/transcribe', async (req, res) => {
  try {
    if (!req.headers['content-type']?.includes('multipart/form-data')) {
      return res.status(400).json({ error: 'Expected multipart/form-data audio upload.' });
    }

    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      return res.status(200).json({ transcript: '', fallback: true });
    }

    const bb = busboy({ headers: req.headers });
    const chunks = [];

    bb.on('file', (fieldname, fileStream) => {
      fileStream.on('data', chunk => chunks.push(Buffer.from(chunk)));
    });

    bb.on('error', (error) => {
      res.status(400).json({ error: error.message || 'Audio upload failed.' });
    });

    bb.on('finish', async () => {
      const audioBuffer = Buffer.concat(chunks);
      if (!audioBuffer.length) {
        return res.status(400).json({ error: 'No audio provided.' });
      }

      const formData = new FormData();
      formData.append('file', new Blob([audioBuffer]), 'voice.webm');
      formData.append('model', 'whisper-large-v3');
      formData.append('language', 'en');

      const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${groqKey}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Groq transcription failed.');
      }

      const data = await response.json();
      const transcript = typeof data?.text === 'string' ? data.text : '';
      res.json({ transcript });
    });

    req.pipe(bb);
  } catch (error) {
    console.error('Groq transcription failed:', error.message);
    res.status(500).json({ error: error.message || 'Transcription failed.' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api', isAuthenticated);

app.post('/api/chat', async (req, res) => {
  await handleChat(req, res);
});

app.use(async (req, res, next) => {
  const handled = await handleConversationPersistence(req, res);
  if (!handled) next();
});

app.get('/', (req, res) => {
  if (!req.session?.user?.googleId) {
    return res.redirect('/login');
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.use(express.static(path.join(__dirname)));

// ---- Server & WebSocket -----------------------------------------------------

const server = http.createServer(app);
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
  connectToDatabase().catch(err => {
    console.warn('Initial DB connection attempt failed:', err.message);
  });

  server.listen(port, host, () => {
    const displayHost = host === '0.0.0.0' ? 'localhost' : host;
    console.log(`Chat backend is running at http://${displayHost}:${port}`);
    if (ALLOWED_ORIGINS.length === 0) {
      console.log('ALLOWED_ORIGINS not set — defaulting to localhost-only CORS.');
    }
  });
}

module.exports = {
  buildKnowledgeIndex,
  retrieveRelevantContext,
  buildPromptWithContext
};