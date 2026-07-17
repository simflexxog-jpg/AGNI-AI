const chatBox = document.getElementById('chat-box');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const newChatBtn = document.getElementById('new-chat-btn');
const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const historyList = document.getElementById('history-list');
const providerSelect = document.getElementById('provider-select');
const modelSelect = document.getElementById('model-select');
const thinkingToggle = document.getElementById('thinking-toggle');
const statusPill = document.getElementById('status-pill');
const imageInput = document.getElementById('image-input');
const fileInput = document.getElementById('file-input');
const attachmentPreview = document.getElementById('attachment-preview');
const suggestionPromptBar = document.getElementById('suggestion-prompt-bar');
const sidebarUserInfo = document.getElementById('sidebar-user-info');
const sidebarUserAvatar = document.getElementById('sidebar-user-avatar');
const sidebarUserName = document.getElementById('sidebar-user-name');
const sidebarUserStatus = document.getElementById('sidebar-user-status');
const logoutBtn = document.getElementById('logout-btn');
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const actionMenuBtn = document.getElementById('action-menu-btn');
const actionMenuDropdown = document.getElementById('action-menu-dropdown');
const exportBtn = document.getElementById('export-btn');
const importBtn = document.getElementById('import-btn');
const clearChatBtn = document.getElementById('clear-chat-btn');
const importInput = document.getElementById('import-input');
const compactViewToggle = document.getElementById('compact-view-toggle');
const compactViewToggleBtn = document.getElementById('compact-view-toggle-btn');
const voiceInputBtn = document.getElementById('voice-input-btn');
const autoSubmitToggleBtn = document.getElementById('auto-submit-toggle-btn');

// Same-origin relative path: works regardless of host/port, since server.js
// serves both the static frontend and the /api/chat endpoint.
const API_ENDPOINT = '/api/chat';
const WS_ENDPOINT = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/`;

const STORAGE_KEY = 'agni-ai-conversations-v1';
const ACTIVE_KEY = 'agni-ai-active-id-v1';
const THEME_KEY = 'agni-ai-theme-v1';
const COMPACT_KEY = 'agni-ai-compact-mode-v1';
const UI_FONT_KEY = 'agni-ai-ui-font-v1';
const UI_DENSITY_KEY = 'agni-ai-ui-density-v1';
const DEFAULT_WELCOME_TEXT = 'Hello! I’m your AI assistant. Ask me anything and I’ll help.';
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024; // 8MB per file

let attachments = [];
let conversations = [];
let activeId = null;
let socket = null;
let socketReady = false;
let pendingRequest = null;
let speechRecognition = null;
let isVoiceListening = false;
let voiceTranscriptBuffer = '';
let currentUser = null;
let mediaRecorder = null;
let mediaRecorderStream = null;
let recordedChunks = [];
let voiceRecorderTimer = null;
let voiceRecorderSilenceTimer = null;
let voiceIsRecording = false;
let autoSubmitVoice = false;
let ttsEnabled = true;
let voiceFallbackReason = '';
let silenceMonitorId = null;
let silenceDurationMs = 0;
let audioContext = null;
let analyserNode = null;

// Settings panel elements (sidebar)
const openSettingsBtn = document.getElementById('open-settings-btn');
const sidebarSettings = document.getElementById('sidebar-settings');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const resetSettingsBtn = document.getElementById('reset-settings-btn');
const fontOpts = Array.from(document.getElementsByClassName('font-opt'));
const densityOpts = Array.from(document.getElementsByClassName('density-opt'));

function getWelcomeText() {
    if (!currentUser) return DEFAULT_WELCOME_TEXT;

    const fullName = currentUser.name || currentUser.email || '';
    const firstName = fullName
        .split(/\s+/)
        .find(Boolean)
        ?.replace(/[^\p{L}\p{N}]/gu, '') || '';

    const displayName = firstName || (currentUser.email ? currentUser.email.split('@')[0] : 'there');
    return `Hello! ${displayName} I’m your AI assistant. Ask me anything and I’ll help.`;
}

function applyFontSize(size) {
    document.documentElement.classList.remove('font-small', 'font-normal', 'font-large');
    document.documentElement.classList.add('font-' + size);
}

function applyDensity(density) {
    document.documentElement.classList.remove('density-comfortable', 'density-compact');
    document.documentElement.classList.add('density-' + density);
}

function updateDensitySelection(density, save = true) {
    if (!density) return;
    applyDensity(density);
    densityOpts.forEach(btn => btn.classList.toggle('active', btn.dataset.density === density));
    if (save) {
        localStorage.setItem(UI_DENSITY_KEY, density);
    }
}

function loadUISettings() {
    const font = localStorage.getItem(UI_FONT_KEY) || 'normal';
    const density = localStorage.getItem(UI_DENSITY_KEY) || 'comfortable';
    applyFontSize(font);
    updateDensitySelection(density, false);
    // mark active buttons
    fontOpts.forEach(btn => btn.classList.toggle('active', btn.dataset.font === font));
}

function saveUISettings(font, density) {
    if (font) localStorage.setItem(UI_FONT_KEY, font);
    if (density) localStorage.setItem(UI_DENSITY_KEY, density);
}

function resetUISettings() {
    localStorage.removeItem(UI_FONT_KEY);
    localStorage.removeItem(UI_DENSITY_KEY);
    loadUISettings();
}

function toggleSidebarSettings(show) {
    if (!sidebarSettings) return;
    sidebarSettings.hidden = !show;
}

// ---------------------------------------------------------------------------
// Theme management
// ---------------------------------------------------------------------------

function initTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
    if (savedTheme === 'light') {
        document.documentElement.classList.add('light-mode');
        updateThemeButton();
    }
}

function toggleTheme() {
    const html = document.documentElement;
    const isLightMode = html.classList.contains('light-mode');
    
    if (isLightMode) {
        html.classList.remove('light-mode');
        localStorage.setItem(THEME_KEY, 'dark');
    } else {
        html.classList.add('light-mode');
        localStorage.setItem(THEME_KEY, 'light');
    }
    updateThemeButton();
}

function closeActionMenu() {
    if (!actionMenuDropdown || !actionMenuBtn) return;
    actionMenuDropdown.hidden = true;
    actionMenuBtn.setAttribute('aria-expanded', 'false');
}

function toggleActionMenu() {
    if (!actionMenuDropdown || !actionMenuBtn) return;
    const isOpen = !actionMenuDropdown.hidden;
    actionMenuDropdown.hidden = isOpen;
    actionMenuBtn.setAttribute('aria-expanded', String(!isOpen));
}

function updateThemeButton() {
    const isLightMode = document.documentElement.classList.contains('light-mode');
    themeToggleBtn.classList.toggle('active', isLightMode);
    themeToggleBtn.setAttribute('aria-checked', String(isLightMode));
}

// ---------------------------------------------------------------------------
// Export / Import conversations
// ---------------------------------------------------------------------------

function exportConversations() {
    const dataStr = JSON.stringify(conversations, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `agni-ai-chats-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function importConversations(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const imported = JSON.parse(e.target.result);
            if (Array.isArray(imported) && imported.length > 0) {
                // Validate imported data structure
                const isValid = imported.every(conv => 
                    conv.id && conv.title !== undefined && Array.isArray(conv.messages)
                );
                if (isValid) {
                    conversations = imported;
                    activeId = conversations[0].id;
                    saveState();
                    renderActiveConversation();
                    renderHistoryList();
                    showComposerNotice('✓ Chats imported successfully!');
                } else {
                    showComposerNotice('Invalid chat file format.');
                }
            } else {
                showComposerNotice('No conversations found in file.');
            }
        } catch (error) {
            showComposerNotice('Failed to parse chat file.');
        }
    };
    reader.onerror = () => {
        showComposerNotice('Failed to read file.');
    };
    reader.readAsText(file);
}

function handleImportInput(event) {
    const file = event.target.files?.[0];
    if (file) {
        importConversations(file);
        event.target.value = '';
    }
}

const modelOptions = {
    gemini: [
        { label: 'Gemini 2.0 Flash', value: 'gemini-2.0-flash' },
        { label: 'Gemini 2.0 Flash Lite', value: 'gemini-2.0-flash-lite' },
        { label: 'Gemini 1.5 Pro', value: 'gemini-1.5-pro' }
    ],
    groq: [
        { label: 'Llama 3.1 8B', value: 'llama-3.1-8b-instant' },
        { label: 'Llama 3.3 70B Versatile', value: 'llama-3.3-70b-versatile' },
        { label: 'Mixtral 8x7B', value: 'mixtral-8x7b-32768' }
    ],
    openai: [
        { label: 'GPT-4o Mini', value: 'gpt-4o-mini' },
        { label: 'GPT-4o', value: 'gpt-4o' }
    ]
};

// ---------------------------------------------------------------------------
// Conversation persistence
// ---------------------------------------------------------------------------

function createConversation(initialBotText) {
    return {
        id: 'c-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
        title: 'New chat',
        messages: initialBotText ? [{ role: 'bot', content: initialBotText }] : []
    };
}

function personalizeWelcomeMessage() {
    const conv = getActiveConversation();
    if (!conv?.messages?.length) return;

    const firstMessage = conv.messages[0];
    const welcomeText = getWelcomeText();
    const isGenericWelcome = firstMessage.role === 'bot' && (
        firstMessage.content === DEFAULT_WELCOME_TEXT ||
        firstMessage.content === 'Hello! I’m your AI assistant. Ask me anything and I’ll help.'
    );

    if (isGenericWelcome && firstMessage.content !== welcomeText) {
        firstMessage.content = welcomeText;
        saveState();
        persistConversation(conv);
    }
}

async function loadState() {
    try {
        const response = await fetch('/api/conversations');
        if (response.ok) {
            const payload = await response.json();
            if (Array.isArray(payload) && payload.length > 0) {
                conversations = payload;
                activeId = localStorage.getItem(ACTIVE_KEY);
                if (!activeId || !conversations.some(c => c.id === activeId)) {
                    activeId = conversations[0].id;
                }
                saveState();
                return;
            }
        }
    } catch (error) {
        // Fall back to local storage if the server is unavailable.
    }

    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        conversations = raw ? JSON.parse(raw) : [];
    } catch (error) {
        conversations = [];
    }
    if (!Array.isArray(conversations) || conversations.length === 0) {
        conversations = [createConversation(getWelcomeText())];
    }

    activeId = localStorage.getItem(ACTIVE_KEY);
    if (!activeId || !conversations.some(c => c.id === activeId)) {
        activeId = conversations[0].id;
    }
}

function saveState() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
        localStorage.setItem(ACTIVE_KEY, activeId);
    } catch (error) {
        // Storage unavailable or full — fail silently, app still works in-session.
    }
}

async function persistConversation(conv) {
    if (!conv) return;

    try {
        await fetch('/api/conversations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(conv)
        });
    } catch (error) {
        // Ignore persistence failures and keep using the current UI state.
    }
}

async function deleteConversationFromServer(id) {
    if (!id) return;

    try {
        await fetch('/api/conversations', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
    } catch (error) {
        // Ignore persistence failures and keep using the current UI state.
    }
}

async function fetchCurrentUser() {
    try {
        const response = await fetch('/api/user');
        if (!response.ok) {
            throw new Error('Not authenticated');
        }
        const data = await response.json();
        return data.user || null;
    } catch (error) {
        return null;
    }
}

function renderUserHeader() {
    if (!sidebarUserInfo || !currentUser) return;
    sidebarUserAvatar.src = currentUser.avatar || 'Sitelogo.svg';
    sidebarUserAvatar.alt = currentUser.name ? `${currentUser.name}'s avatar` : 'User avatar';
    sidebarUserName.textContent = currentUser.name || currentUser.email || 'Signed in user';
    sidebarUserStatus.textContent = currentUser.email ? `Signed in as ${currentUser.email}` : 'Account connected';
    sidebarUserInfo.hidden = false;
}

async function handleLogout() {
    try {
        await fetch('/auth/logout', { method: 'POST' });
    } catch (error) {
        // ignore logout errors
    }
    window.location.href = '/login';
}

function getActiveConversation() {
    return conversations.find(c => c.id === activeId) || conversations[0];
}

function switchConversation(id) {
    if (id === activeId) return;
    activeId = id;
    saveState();
    renderActiveConversation();
    renderHistoryList();
}

function deleteConversation(id) {
    conversations = conversations.filter(c => c.id !== id);
    if (conversations.length === 0) {
        conversations = [createConversation(getWelcomeText())];
    }
    if (activeId === id) {
        activeId = conversations[0].id;
    }
    saveState();
    deleteConversationFromServer(id);
    renderActiveConversation();
    renderHistoryList();
}

const historySearch = document.getElementById('history-search');
let historyFilterText = '';

function renderHistoryList() {
    const query = historyFilterText.trim().toLowerCase();
    historyList.innerHTML = '';

    conversations
        .filter(conv => !query || (conv.title || 'New chat').toLowerCase().includes(query))
        .forEach(conv => {
            const item = document.createElement('div');
            item.className = 'history-item' + (conv.id === activeId ? ' active' : '');

            const titleSpan = document.createElement('span');
            titleSpan.className = 'history-item-title';
            titleSpan.textContent = conv.title || 'New chat';
            item.appendChild(titleSpan);

        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'history-delete-btn';
        delBtn.textContent = '×';
        delBtn.setAttribute('aria-label', 'Delete chat');
        delBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            deleteConversation(conv.id);
        });
        item.appendChild(delBtn);

        item.addEventListener('click', () => switchConversation(conv.id));
        historyList.appendChild(item);
    });
}

function handleHistorySearch(event) {
    historyFilterText = event.target.value;
    renderHistoryList();
}

function initCompactMode() {
    const storedCompact = localStorage.getItem(COMPACT_KEY) === 'true';
    compactViewToggle.checked = storedCompact;
    updateCompactMode();
    if (storedCompact) {
        updateDensitySelection('compact', false);
    }
}

function handleKeyboardShortcuts(event) {
    // Ignore modifier-only presses
    if (!event || (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.key.length === 1 && event.key === event.key.toLowerCase())) {
        // continue to other handling
    }

    // Global shortcuts (Ctrl/Cmd + ...)
    if (event.ctrlKey || event.metaKey) {
        // Use Alt variants to avoid browser collisions (Ctrl/Cmd + Alt + ...)
        // Toggle sidebar: Ctrl/Cmd + Alt + B
        if (event.altKey && event.key.toLowerCase() === 'b') {
            event.preventDefault();
            toggleSidebarBtn.click();
            return;
        }

        // Toggle theme: Ctrl/Cmd + Alt + T
        if (event.altKey && event.key.toLowerCase() === 't') {
            event.preventDefault();
            toggleTheme();
            return;
        }

        // Export conversations: Ctrl/Cmd + Alt + E
        if (event.altKey && event.key.toLowerCase() === 'e') {
            event.preventDefault();
            exportConversations();
            return;
        }

        // Import conversations (open picker): Ctrl/Cmd + Alt + I
        if (event.altKey && event.key.toLowerCase() === 'i') {
            event.preventDefault();
            importInput.click();
            return;
        }

        // Focus message input: Ctrl/Cmd + Alt + J
        if (event.altKey && event.key.toLowerCase() === 'j') {
            event.preventDefault();
            userInput.focus();
            return;
        }
    }
    // Focus search: Ctrl/Cmd+K or Ctrl/Cmd+Alt+K (Alt variant added for browsers)
    if ((event.ctrlKey || event.metaKey) && (event.key.toLowerCase() === 'k') && (!event.altKey || event.altKey)) {
        // allow both Ctrl+K and Ctrl+Alt+K
        event.preventDefault();
        historySearch.focus();
        return;
    }

    // New chat: use Ctrl/Cmd+Alt+N to avoid browser Ctrl+N (new window)
    if ((event.ctrlKey || event.metaKey) && event.altKey && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        newChatBtn.click();
        return;
    }

    // Toggle settings with Ctrl/Cmd + , (comma)
    if ((event.ctrlKey || event.metaKey) && event.key === ',') {
        event.preventDefault();
        if (sidebarSettings) toggleSidebarSettings(sidebarSettings.hidden);
        return;
    }

    if (event.key === 'Escape') {
        // Close settings if open, otherwise blur search/input
        if (sidebarSettings && !sidebarSettings.hidden) {
            toggleSidebarSettings(false);
            return;
        }
        historySearch.blur();
        userInput.blur();
    }
}

const suggestedPrompts = [
    'Summarize this idea in a few bullets',
    'Help me write a polished email',
    'Give me a short plan for a new project',
    'Explain this concept simply'
];

function renderSuggestedPrompts() {
    const conv = getActiveConversation();
    // Show suggestions when the conversation contains no user messages
    const hasUserMessage = Array.isArray(conv?.messages) && conv.messages.some(m => m.role === 'user' && (m.content || '').toString().trim() !== '');
    const shouldShow = Array.isArray(conv?.messages) && !hasUserMessage;

    suggestionPromptBar.innerHTML = '';
    suggestionPromptBar.classList.toggle('visible', shouldShow);

    if (!shouldShow) return;

    suggestedPrompts.forEach(prompt => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'suggestion-prompt-chip';
        chip.textContent = prompt;
        chip.addEventListener('click', () => {
            userInput.value = prompt;
            userInput.focus();
            handleSend();
        });
        suggestionPromptBar.appendChild(chip);
    });
}

function clearActiveConversation() {
    const conv = getActiveConversation();
    if (!conv) return;

    conv.title = 'New chat';
    conv.messages = [{ role: 'bot', content: getWelcomeText() }];
    attachments = [];
    renderAttachments();
    saveState();
    persistConversation(conv);
    renderActiveConversation();
    renderHistoryList();
    showComposerNotice('Chat cleared.');
}

function renderActiveConversation() {
    chatBox.innerHTML = '';
    const conv = getActiveConversation();
    conv.messages.forEach(m => appendMessage(m.content, m.role, { persist: false }));
    renderSuggestedPrompts();
}

// ---------------------------------------------------------------------------
// Markdown rendering (lightweight, escapes HTML first)
// ---------------------------------------------------------------------------

function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function renderMarkdown(raw) {
    let html = escapeHtml(raw);

    html = html.replace(/```([a-zA-Z0-9]*)\n?([\s\S]*?)```/g, (match, lang, code) => {
        return `<pre class="code-block"><code>${code.trim()}</code></pre>`;
    });
    html = html.replace(/`([^`\n]+)`/g, '<code class="inline-code">$1</code>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
    html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    html = html.replace(/(^|\s)(https?:\/\/[^\s<]+)/g, '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>');
    html = html.replace(/\n/g, '<br>');

    return html;
}

function copyToClipboard(text, button) {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(text).then(() => {
        // Add a temporary state class so we do not overwrite inner content (icons)
        button.classList.add('copied');
        setTimeout(() => { button.classList.remove('copied'); }, 1500);
    }).catch(() => {});
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

function streamBotMessage(messageDiv, text) {
    const content = messageDiv.querySelector('.message-content');
    if (!content) return;

    content.textContent = '';
    const chars = Array.from(text);
    let index = 0;

    const tick = () => {
        if (index >= chars.length) {
            content.innerHTML = renderMarkdown(text);
            messageDiv.classList.remove('is-streaming');
            chatBox.scrollTop = chatBox.scrollHeight;
            return;
        }

        content.textContent += chars[index];
        index += 1;
        chatBox.scrollTop = chatBox.scrollHeight;
        setTimeout(tick, 12);
    };

    tick();
}

function createStreamingBotMessage() {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', 'bot-message', 'is-streaming');

    const content = document.createElement('div');
    content.className = 'message-content';
    content.textContent = '';
    messageDiv.appendChild(content);

    const cursor = document.createElement('span');
    cursor.className = 'stream-cursor';
    cursor.textContent = '|';
    messageDiv.appendChild(cursor);

    const actions = document.createElement('div');
    actions.className = 'message-actions';

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'msg-action-btn';
    copyBtn.textContent = 'Copy';
    copyBtn.addEventListener('click', () => copyToClipboard(content.textContent || '', copyBtn));
    actions.appendChild(copyBtn);

    messageDiv.appendChild(actions);
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;

    return { messageDiv, content, cursor };
}

function updateStreamingBotMessage(messageDiv, partialText) {
    const content = messageDiv.querySelector('.message-content');
    if (!content) return;
    content.textContent = partialText;
    chatBox.scrollTop = chatBox.scrollHeight;
}

function finalizeStreamingBotMessage(messageDiv, finalText, persist = true) {
    const content = messageDiv.querySelector('.message-content');
    if (!content) return;
    content.innerHTML = renderMarkdown(finalText);
    messageDiv.classList.remove('is-streaming');
    const cursor = messageDiv.querySelector('.stream-cursor');
    if (cursor) cursor.remove();
    chatBox.scrollTop = chatBox.scrollHeight;

    if (persist) {
        const conv = getActiveConversation();
        conv.messages.push({ role: 'bot', content: finalText });
        saveState();
        persistConversation(conv);
        renderHistoryList();
    }

    return messageDiv;
}

function finalizeStreamingBotMessageWithError(messageDiv, partialText, errorMessage) {
    const content = messageDiv.querySelector('.message-content');
    if (!content) return;
    content.textContent = partialText;
    messageDiv.classList.remove('is-streaming');
    const cursor = messageDiv.querySelector('.stream-cursor');
    if (cursor) cursor.remove();
    const notice = document.createElement('div');
    notice.className = 'stream-error';
    notice.textContent = `Error: ${errorMessage}`;
    messageDiv.appendChild(notice);
    chatBox.scrollTop = chatBox.scrollHeight;

    const conv = getActiveConversation();
    conv.messages.push({ role: 'bot', content: partialText });
    saveState();
    persistConversation(conv);
    renderHistoryList();

    return messageDiv;
}

function appendMessage(text, sender, options = {}) {
    const { persist = true, animate = false } = options;
    const conv = getActiveConversation();

    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', sender === 'user' ? 'user-message' : 'bot-message');

    if (sender === 'bot') {
        const content = document.createElement('div');
        content.className = 'message-content';
        messageDiv.appendChild(content);

        const actions = document.createElement('div');
        actions.className = 'message-actions';

        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'msg-action-btn';
        copyBtn.textContent = 'Copy';
        copyBtn.addEventListener('click', () => copyToClipboard(text, copyBtn));
        actions.appendChild(copyBtn);

        messageDiv.appendChild(actions);

        if (animate) {
            messageDiv.classList.add('is-streaming');
            streamBotMessage(messageDiv, text);
        } else {
            content.innerHTML = renderMarkdown(text);
        }
    } else {
        messageDiv.textContent = text;
    }

    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;

    if (persist) {
        conv.messages.push({ role: sender === 'user' ? 'user' : 'bot', content: text });
        if (conv.title === 'New chat' && sender === 'user' && text.trim()) {
            conv.title = text.length > 28 ? text.slice(0, 28) + '…' : text;
        }
        saveState();
        persistConversation(conv);
        renderHistoryList();
    }

    return messageDiv;
}

function addRegenerateButton(botEl, userText, attachmentsSnapshot, historyForRequest) {
    // Only the latest bot message should offer regeneration.
    document.querySelectorAll('.regenerate-btn').forEach(btn => btn.remove());

    const actions = botEl.querySelector('.message-actions');
    if (!actions) return;

    const regenBtn = document.createElement('button');
    regenBtn.type = 'button';
    regenBtn.className = 'msg-action-btn regenerate-btn';
    regenBtn.textContent = 'Regenerate';
    regenBtn.addEventListener('click', () => {
        botEl.remove();
        const conv = getActiveConversation();
        conv.messages.pop();
        saveState();
        fetchAIResponse(userText, attachmentsSnapshot, historyForRequest);
    });
    actions.appendChild(regenBtn);
}

function showFallbackMessage(message = 'The assistant is temporarily unavailable, but I can still help you search for the answer.') {
    appendMessage(message, 'bot');
}

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

function renderAttachments() {
    attachmentPreview.innerHTML = '';

    attachments.forEach((item, index) => {
        const chip = document.createElement('div');
        chip.className = 'attachment-chip';

        if (item.previewUrl && item.type.startsWith('image/')) {
            const img = document.createElement('img');
            img.src = item.previewUrl;
            img.alt = item.name;
            chip.appendChild(img);
        }

        const name = document.createElement('span');
        name.textContent = item.name.length > 24 ? `${item.name.slice(0, 21)}...` : item.name;
        chip.appendChild(name);

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.textContent = '×';
        removeBtn.addEventListener('click', () => {
            attachments.splice(index, 1);
            renderAttachments();
        });
        chip.appendChild(removeBtn);
        attachmentPreview.appendChild(chip);
    });
}

let noticeTimeout = null;
function showComposerNotice(message) {
    let notice = document.getElementById('composer-notice');
    if (!notice) {
        notice = document.createElement('div');
        notice.id = 'composer-notice';
        notice.className = 'composer-notice';
        attachmentPreview.insertAdjacentElement('beforebegin', notice);
    }
    notice.textContent = message;
    notice.classList.add('visible');
    clearTimeout(noticeTimeout);
    noticeTimeout = setTimeout(() => notice.classList.remove('visible'), 3500);
}

function addAttachment(file) {
    if (file.size > MAX_ATTACHMENT_BYTES) {
        showComposerNotice(`"${file.name}" is too large (max 8MB).`);
        return;
    }

    const reader = new FileReader();
    reader.onload = () => {
        attachments.push({
            name: file.name,
            type: file.type,
            size: file.size,
            previewUrl: reader.result
        });
        renderAttachments();
    };
    reader.onerror = () => {
        showComposerNotice(`Couldn't read "${file.name}".`);
    };
    reader.readAsDataURL(file);
}

function handleAttachmentSelection(event) {
    const files = Array.from(event.target.files || []);
    files.forEach(addAttachment);
    event.target.value = '';
}

// ---------------------------------------------------------------------------
// Provider / model controls
// ---------------------------------------------------------------------------

function populateModels() {
    const provider = providerSelect.value;
    modelSelect.innerHTML = '';

    modelOptions[provider].forEach(option => {
        const opt = document.createElement('option');
        opt.value = option.value;
        opt.textContent = option.label;
        modelSelect.appendChild(opt);
    });

    updateStatusPill();
}

function updateStatusPill() {
    const providerName = providerSelect.value === 'groq' ? 'Groq' : providerSelect.value === 'openai' ? 'OpenAI' : 'Gemini';
    const modelName = modelSelect.options[modelSelect.selectedIndex]?.textContent || modelSelect.value;
    const connectionLabel = socketReady ? ' · Live' : ' · Offline';
    statusPill.textContent = `● ${providerName} · ${modelName}${connectionLabel}`;
}

function toggleThinking() {
    thinkingToggle.classList.toggle('active');
    const enabled = thinkingToggle.classList.contains('active');
    thinkingToggle.setAttribute('aria-checked', String(enabled));
}

function toggleAutoSubmit() {
    autoSubmitVoice = !autoSubmitVoice;
    autoSubmitToggleBtn.classList.toggle('active', autoSubmitVoice);
    autoSubmitToggleBtn.setAttribute('aria-pressed', String(autoSubmitVoice));
}

function speakResponse(text) {
    if (!ttsEnabled || !text) return;
    if (typeof window.speechSynthesis === 'undefined') return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
}

// ---------------------------------------------------------------------------
// Sending messages
// ---------------------------------------------------------------------------

function setComposerBusy(isBusy) {
    sendBtn.disabled = isBusy;
    const sendLabel = sendBtn.querySelector('.send-text');
    if (sendLabel) sendLabel.textContent = isBusy ? 'Sending…' : 'Send';
    sendBtn.classList.toggle('busy', isBusy);
    userInput.disabled = isBusy;
}

function setVoiceListening(isListening) {
    isVoiceListening = isListening;
    voiceInputBtn.classList.toggle('listening', isListening);
    const icon = voiceInputBtn.querySelector('.material-symbols-outlined');
    if (icon) {
        icon.textContent = isListening ? 'stop' : 'mic';
    }
    voiceInputBtn.setAttribute('aria-pressed', String(isListening));
}

function clearVoiceRecorderState() {
    if (voiceRecorderTimer) {
        window.clearTimeout(voiceRecorderTimer);
        voiceRecorderTimer = null;
    }
    if (voiceRecorderSilenceTimer) {
        window.clearTimeout(voiceRecorderSilenceTimer);
        voiceRecorderSilenceTimer = null;
    }
    if (silenceMonitorId) {
        window.clearInterval(silenceMonitorId);
        silenceMonitorId = null;
    }
    if (audioContext) {
        audioContext.close().catch(() => {});
        audioContext = null;
    }
    analyserNode = null;
    silenceDurationMs = 0;
    recordedChunks = [];
    voiceIsRecording = false;
    mediaRecorder = null;
    mediaRecorderStream = null;
}

function startSilenceMonitoring(stream) {
    if (!stream || typeof window.AudioContext === 'undefined') return;

    try {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioContext.state === 'suspended') {
            audioContext.resume().catch(() => {});
        }

        const source = audioContext.createMediaStreamSource(stream);
        analyserNode = audioContext.createAnalyser();
        analyserNode.fftSize = 256;
        source.connect(analyserNode);

        const buffer = new Uint8Array(analyserNode.fftSize);
        silenceDurationMs = 0;
        silenceMonitorId = window.setInterval(() => {
            if (!voiceIsRecording || !analyserNode) return;
            analyserNode.getByteTimeDomainData(buffer);
            let sum = 0;
            for (let i = 0; i < buffer.length; i += 1) {
                const value = (buffer[i] - 128) / 128;
                sum += Math.abs(value);
            }
            const average = sum / buffer.length;
            if (average < 0.01) {
                silenceDurationMs += 200;
                if (silenceDurationMs >= 3000 && mediaRecorder && mediaRecorder.state !== 'inactive') {
                    mediaRecorder.stop();
                }
            } else {
                silenceDurationMs = 0;
            }
        }, 200);
    } catch (error) {
        // Ignore microphone analyser setup failures and fall back to manual stop.
    }
}

function stopVoiceInput() {
    if (speechRecognition && isVoiceListening) {
        speechRecognition.stop();
    }
    if (mediaRecorder && voiceIsRecording) {
        mediaRecorder.stop();
    }
    clearVoiceRecorderState();
    setVoiceListening(false);
}

async function transcribeAudioBlob(blob) {
    const formData = new FormData();
    formData.append('audio', blob, 'voice.webm');

    const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || 'Transcription failed.');
    }

    const data = await response.json();
    return {
        transcript: data.transcript || '',
        fallback: Boolean(data.fallback)
    };
}

function applyVoiceTranscript(transcript) {
    const cleaned = transcript.trim();
    if (!cleaned) {
        showComposerNotice('No speech was detected.');
        return;
    }

    userInput.value = cleaned;
    showComposerNotice('Voice captured.');

    if (autoSubmitVoice) {
        handleSend();
    }
}

function handleVoiceRecordingStop() {
    const blob = new Blob(recordedChunks, { type: mediaRecorder?.mimeType || 'audio/webm' });
    if (!blob.size) {
        showComposerNotice('No audio captured.');
        clearVoiceRecorderState();
        setVoiceListening(false);
        return;
    }

    if (voiceFallbackReason) {
        showComposerNotice(`Using fallback speech recognition: ${voiceFallbackReason}`);
    }

    const playback = () => {
        if (typeof window.speechSynthesis !== 'undefined') {
            window.speechSynthesis.cancel();
        }
    };

    playback();

    transcribeAudioBlob(blob).then(({ transcript, fallback }) => {
        const fallbackText = (fallback && voiceTranscriptBuffer.trim()) || transcript.trim();
        applyVoiceTranscript(fallbackText);
    }).catch((error) => {
        showComposerNotice(error.message || 'Transcription failed.');
    }).finally(() => {
        clearVoiceRecorderState();
        setVoiceListening(false);
    });
}

async function startVoiceInput() {
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (isVoiceListening) {
        stopVoiceInput();
        return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
        if (SpeechRecognitionCtor) {
            voiceFallbackReason = 'browser speech recognition';
        } else {
            showComposerNotice('Voice input is not supported in this browser.');
            return;
        }
    }

    if (!window.MediaRecorder && !SpeechRecognitionCtor) {
        showComposerNotice('Voice input is not supported in this browser.');
        return;
    }

    setVoiceListening(true);
    voiceTranscriptBuffer = '';
    recordedChunks = [];

    if (SpeechRecognitionCtor && !window.MediaRecorder) {
        voiceFallbackReason = 'MediaRecorder unavailable';
        speechRecognition = speechRecognition || new SpeechRecognitionCtor();
        speechRecognition.continuous = false;
        speechRecognition.interimResults = true;
        speechRecognition.lang = 'en-US';
        speechRecognition.onstart = () => {
            voiceTranscriptBuffer = '';
            setVoiceListening(true);
        };
        speechRecognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; i += 1) {
                const result = event.results[i];
                const transcript = result[0].transcript.trim();
                if (result.isFinal) {
                    finalTranscript += `${transcript} `;
                } else {
                    interimTranscript += `${transcript} `;
                }
            }
            voiceTranscriptBuffer = `${voiceTranscriptBuffer}${finalTranscript}${interimTranscript}`.trim();
            userInput.value = voiceTranscriptBuffer;
        };
        speechRecognition.onerror = () => {
            setVoiceListening(false);
            showComposerNotice('Voice input stopped.');
        };
        speechRecognition.onend = () => {
            setVoiceListening(false);
        };
        try {
            speechRecognition.start();
        } catch (error) {
            setVoiceListening(false);
            showComposerNotice('Could not start voice input.');
        }
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorderStream = stream;
        const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
        mediaRecorder = new MediaRecorder(stream, { mimeType });
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };
        mediaRecorder.onstop = () => {
            stream.getTracks().forEach(track => track.stop());
            mediaRecorderStream = null;
            handleVoiceRecordingStop();
        };
        if (SpeechRecognitionCtor) {
            speechRecognition = speechRecognition || new SpeechRecognitionCtor();
            speechRecognition.continuous = false;
            speechRecognition.interimResults = true;
            speechRecognition.lang = 'en-US';
            speechRecognition.onresult = (event) => {
                let interimTranscript = '';
                let finalTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; i += 1) {
                    const result = event.results[i];
                    const transcript = result[0].transcript.trim();
                    if (result.isFinal) {
                        finalTranscript += `${transcript} `;
                    } else {
                        interimTranscript += `${transcript} `;
                    }
                }
                voiceTranscriptBuffer = `${voiceTranscriptBuffer}${finalTranscript}${interimTranscript}`.trim();
                userInput.value = voiceTranscriptBuffer;
            };
            speechRecognition.onerror = () => {
                showComposerNotice('Voice input stopped.');
            };
            speechRecognition.onend = () => {
                if (voiceIsRecording) {
                    speechRecognition.start();
                }
            };
            speechRecognition.start();
        }

        mediaRecorder.start();
        voiceIsRecording = true;
        voiceRecorderTimer = window.setTimeout(() => {
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
            }
        }, 8000);
        startSilenceMonitoring(stream);
    } catch (error) {
        setVoiceListening(false);
        showComposerNotice('Microphone access was denied or is unavailable.');
    }
}

function removeThinkingIndicator() {
    if (pendingRequest?.thinkingId) {
        document.getElementById(pendingRequest.thinkingId)?.remove();
    }
}

function connectWebSocket() {
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        return;
    }

    socket = new WebSocket(WS_ENDPOINT);
    socket.addEventListener('open', () => {
        socketReady = true;
        updateStatusPill();
    });

    socket.addEventListener('message', (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.type === 'connected') {
                socketReady = true;
                updateStatusPill();
                return;
            }

            if (data.type === 'status') {
                return;
            }

            if (data.type === 'done') {
                removeThinkingIndicator();
                const request = pendingRequest;
                pendingRequest = null;
                if (!request) return;

                const botEl = appendMessage(data.content, 'bot', { animate: true });
                addRegenerateButton(botEl, request.userText, request.attachmentsSnapshot, request.historyForRequest);
                speakResponse(data.content);
                setComposerBusy(false);
                return;
            }

            if (data.type === 'error') {
                removeThinkingIndicator();
                pendingRequest = null;
                setComposerBusy(false);
                showFallbackMessage();
            }
        } catch (error) {
            removeThinkingIndicator();
            pendingRequest = null;
            setComposerBusy(false);
            showFallbackMessage();
        }
    });

    socket.addEventListener('close', () => {
        socketReady = false;
        updateStatusPill();
        window.setTimeout(connectWebSocket, 1500);
    });

    socket.addEventListener('error', () => {
        socketReady = false;
        updateStatusPill();
    });
}

async function fetchAIResponse(userText, attachmentsSnapshot, historyForRequest) {
    setComposerBusy(true);

    const thinkingId = 'thinking-' + Date.now();
    const thinkingDiv = document.createElement('div');
    thinkingDiv.classList.add('message', 'bot-message', 'thinking-indicator');
    thinkingDiv.id = thinkingId;
    thinkingDiv.innerHTML = '<span class="thinking-label">Thinking<span class="thinking-dots"><span></span><span></span><span></span></span></span>';
    chatBox.appendChild(thinkingDiv);
    chatBox.scrollTop = chatBox.scrollHeight;

    pendingRequest = { thinkingId, userText, attachmentsSnapshot, historyForRequest };

    if (socketReady && socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
            type: 'chat',
            message: userText,
            history: historyForRequest,
            provider: providerSelect.value,
            model: modelSelect.value,
            thinking: thinkingToggle.classList.contains('active'),
            attachments: attachmentsSnapshot
        }));
        return;
    }

    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: userText,
                history: historyForRequest,
                provider: providerSelect.value,
                model: modelSelect.value,
                thinking: thinkingToggle.classList.contains('active'),
                attachments: attachmentsSnapshot
            })
        });

        if (!response.ok) {
            const errorData = await response.text();
            throw new Error(errorData || 'Request failed');
        }

        const streamMessage = createStreamingBotMessage();
        let partialText = '';
        let hadError = false;
        let errorText = '';

        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error('Streaming response unsupported');
        }

        const decoder = new TextDecoder();
        let buffer = '';

        const processEvent = (rawEvent) => {
            const lines = rawEvent.split(/\r?\n/);
            let eventType = 'message';
            let dataLines = [];

            for (const line of lines) {
                if (line.startsWith('event:')) {
                    eventType = line.slice(6).trim();
                } else if (line.startsWith('data:')) {
                    dataLines.push(line.slice(5).trim());
                }
            }

            const rawData = dataLines.join('\n');
            if (!rawData) return;

            let parsed;
            try {
                parsed = JSON.parse(rawData);
            } catch {
                return;
            }

            if (eventType === 'message') {
                const delta = parsed?.delta;
                if (typeof delta === 'string') {
                    partialText += delta;
                    updateStreamingBotMessage(streamMessage.messageDiv, partialText);
                } else if (parsed?.error && typeof parsed.error === 'string') {
                    hadError = true;
                    errorText = parsed.error;
                }
            } else if (eventType === 'error') {
                hadError = true;
                errorText = parsed?.message || parsed?.error || 'An error occurred while streaming.';
            } else if (eventType === 'done') {
                // no-op; finalization happens after loop
            }
        };

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let mark;

            while ((mark = buffer.indexOf('\n\n')) !== -1) {
                const rawEvent = buffer.slice(0, mark);
                buffer = buffer.slice(mark + 2);
                processEvent(rawEvent);
            }
        }

        if (buffer.trim()) {
            processEvent(buffer.trim());
        }

        if (hadError) {
            finalizeStreamingBotMessageWithError(streamMessage.messageDiv, partialText, errorText || 'Stream ended with error');
        } else {
            finalizeStreamingBotMessage(streamMessage.messageDiv, partialText);
            addRegenerateButton(streamMessage.messageDiv, userText, attachmentsSnapshot, historyForRequest);
            speakResponse(partialText);
        }
    } catch (error) {
        removeThinkingIndicator();
        pendingRequest = null;
        const streamMessage = createStreamingBotMessage();
        finalizeStreamingBotMessageWithError(streamMessage.messageDiv, '', error.message || 'The assistant is temporarily unavailable.');
    } finally {
        removeThinkingIndicator();
        pendingRequest = null;
        setComposerBusy(false);
    }
}

function handleSend() {
    if (sendBtn.disabled) return;

    const text = userInput.value.trim();
    if (text === '' && attachments.length === 0) return;

    const conv = getActiveConversation();
    // Snapshot the conversation as it stands *before* this new message —
    // this is what gets sent to the API as prior context.
    const historyForRequest = conv.messages.map(m => ({ role: m.role, content: m.content }));
    const attachmentsSnapshot = attachments.slice();

    appendMessage(text || 'Shared attachments', 'user');
    userInput.value = '';
    attachments = [];
    renderAttachments();

    fetchAIResponse(text || 'Please review the attached files.', attachmentsSnapshot, historyForRequest);
}

// ---------------------------------------------------------------------------
// Event wiring
// ---------------------------------------------------------------------------

newChatBtn.addEventListener('click', async () => {
    const conv = createConversation(getWelcomeText());
    conversations.unshift(conv);
    activeId = conv.id;
    attachments = [];
    renderAttachments();
    saveState();
    await persistConversation(conv);
    renderActiveConversation();
    renderHistoryList();
});

function setSidebarOpen(isOpen) {
    const isMobile = window.innerWidth <= 900;

    if (isMobile) {
        sidebar.classList.toggle('mobile-open', isOpen);
        sidebar.classList.remove('collapsed');
        sidebarOverlay.classList.toggle('active', isOpen);
        sidebarOverlay.hidden = !isOpen;
    } else {
        sidebar.classList.remove('mobile-open');
        sidebarOverlay.classList.remove('active');
        sidebarOverlay.hidden = true;
        sidebar.classList.toggle('collapsed', !isOpen);
    }
}

toggleSidebarBtn.addEventListener('click', () => {
    if (window.innerWidth <= 900) {
        setSidebarOpen(!sidebar.classList.contains('mobile-open'));
    } else {
        setSidebarOpen(sidebar.classList.contains('collapsed'));
    }
});

sidebarOverlay.addEventListener('click', () => setSidebarOpen(false));

window.addEventListener('resize', () => {
    if (window.innerWidth > 900) {
        setSidebarOpen(true);
    } else {
        setSidebarOpen(false);
    }
});

themeToggleBtn.addEventListener('click', toggleTheme);
actionMenuBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleActionMenu();
});
exportBtn.addEventListener('click', () => {
    closeActionMenu();
    exportConversations();
});
importBtn.addEventListener('click', () => {
    closeActionMenu();
    importInput.click();
});
clearChatBtn.addEventListener('click', () => {
    closeActionMenu();
    clearActiveConversation();
});
importInput.addEventListener('change', handleImportInput);

const aboutDevBtn = document.getElementById('about-dev-btn');
const aboutOverlay = document.getElementById('about-overlay');
const aboutCloseBtn = document.getElementById('about-close-btn');

function openAboutModal() {
    if (!aboutOverlay) return;
    aboutOverlay.hidden = false;
    closeActionMenu();
}

function closeAboutModal() {
    if (!aboutOverlay) return;
    aboutOverlay.hidden = true;
}

if (aboutDevBtn) {
    aboutDevBtn.addEventListener('click', () => {
        openAboutModal();
    });
}

if (aboutCloseBtn) {
    aboutCloseBtn.addEventListener('click', closeAboutModal);
}

if (aboutOverlay) {
    aboutOverlay.addEventListener('click', (event) => {
        if (event.target === aboutOverlay) closeAboutModal();
    });
}

document.addEventListener('click', (event) => {
    if (!actionMenuBtn.contains(event.target) && !actionMenuDropdown.contains(event.target)) {
        closeActionMenu();
    }
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeActionMenu();
});

providerSelect.addEventListener('change', populateModels);
modelSelect.addEventListener('change', updateStatusPill);
thinkingToggle.addEventListener('click', toggleThinking);
imageInput.addEventListener('change', handleAttachmentSelection);
fileInput.addEventListener('change', handleAttachmentSelection);
sendBtn.addEventListener('click', handleSend);
voiceInputBtn.addEventListener('click', startVoiceInput);
autoSubmitToggleBtn.addEventListener('click', toggleAutoSubmit);
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSend();
});
userInput.addEventListener('focus', () => {
    stopVoiceInput();
});

document.addEventListener('keydown', handleKeyboardShortcuts);

compactViewToggle.addEventListener('change', handleCompactToggle);
compactViewToggleBtn.addEventListener('click', () => {
    compactViewToggle.checked = !compactViewToggle.checked;
    handleCompactToggle();
    const density = compactViewToggle.checked ? 'compact' : 'comfortable';
    updateDensitySelection(density);
    closeActionMenu();
});
historySearch.addEventListener('input', handleHistorySearch);

// Settings panel events: clicking the footer Settings button toggles the panel
if (openSettingsBtn) openSettingsBtn.addEventListener('click', () => {
    if (sidebarSettings) toggleSidebarSettings(sidebarSettings.hidden);
});
if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', () => toggleSidebarSettings(false));
if (resetSettingsBtn) resetSettingsBtn.addEventListener('click', () => resetUISettings());

fontOpts.forEach(btn => btn.addEventListener('click', (e) => {
    const size = e.currentTarget.dataset.font;
    applyFontSize(size);
    saveUISettings(size, null);
    fontOpts.forEach(b => b.classList.toggle('active', b === e.currentTarget));
}));

densityOpts.forEach(btn => btn.addEventListener('click', (e) => {
    const d = e.currentTarget.dataset.density;
    applyDensity(d);
    saveUISettings(null, d);
    densityOpts.forEach(b => b.classList.toggle('active', b === e.currentTarget));
}));

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

async function initializeApp() {
    initTheme();
    initCompactMode();
    loadUISettings();
    currentUser = await fetchCurrentUser();
    if (!currentUser) {
        window.location.href = '/login';
        return;
    }
    renderUserHeader();
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    await loadState();
    personalizeWelcomeMessage();
    renderAttachments();
    populateModels();
    renderActiveConversation();
    renderHistoryList();
    connectWebSocket();
}

function updateCompactMode() {
    document.documentElement.classList.toggle('compact-mode', compactViewToggle.checked);
}

function handleCompactToggle() {
    localStorage.setItem(COMPACT_KEY, compactViewToggle.checked ? 'true' : 'false');
    updateCompactMode();
}

initializeApp();
