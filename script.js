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
const languageSelect = document.getElementById('ui-language-select');
const autoSubmitToggleBtn = document.getElementById('auto-submit-toggle-btn');
const liveVoiceBtn = document.getElementById('live-voice-btn');
const liveVoiceModal = document.getElementById('live-voice-modal');
const liveOrb = document.getElementById('live-orb');
const liveStatusText = document.getElementById('live-status-text');
const liveTranscript = document.getElementById('live-transcript');
const liveEndCallBtn = document.getElementById('live-end-call-btn');
const liveRetryBtn = document.getElementById('live-retry-btn');
const liveVoiceSelect = document.getElementById('live-voice-select');

const API_ENDPOINT = '/api/chat';
const WS_ENDPOINT = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/api/live-voice`;

const STORAGE_KEY = 'agni-ai-conversations-v1';
const ACTIVE_KEY = 'agni-ai-active-id-v1';
const THEME_KEY = 'agni-ai-theme-v1';
const COMPACT_KEY = 'agni-ai-compact-mode-v1';
const UI_FONT_KEY = 'agni-ai-ui-font-v1';
const UI_DENSITY_KEY = 'agni-ai-ui-density-v1';
const UI_LANGUAGE_KEY = 'agni-ai-ui-language-v1';
const TTS_KEY = 'agni-ai-tts-enabled-v1';
const DEFAULT_WELCOME_TEXT = 'Hello! I\'m your AI assistant. Ask me anything and I\'ll help.';

let editingPromptState = null;

const UI_TRANSLATIONS = {
    en: {
        preferences: 'Preferences',
        newChat: 'New chat',
        provider: 'Provider',
        model: 'Model',
        deepThinking: 'Deep thinking',
        searchConversations: 'Search conversations…',
        recent: 'Recent',
        fontSize: 'Font size',
        small: 'Small',
        normal: 'Normal',
        large: 'Large',
        density: 'Density',
        comfortable: 'Comfortable',
        compact: 'Compact',
        language: 'Language',
        appearance: 'Appearance',
        tts: 'Text-to-speech',
        enableTts: 'Enable TTS',
        voice: 'Voice',
        speed: 'Speed',
        pitch: 'Pitch',
        resetDefaults: 'Reset defaults',
        closePreferences: 'Close preferences',
        toggleTheme: 'Toggle light/dark mode',
        toggleTts: 'Toggle text-to-speech',
        toggleSidebar: 'Toggle sidebar',
        aiAssistant: 'AI assistant',
        liveVoice: 'Live Voice',
        moreActions: 'More actions',
        exportChat: 'Export chat',
        importChat: 'Import chat',
        clearChat: 'Clear chat',
        compactView: 'Compact view',
        signOut: 'Sign out',
        aboutDeveloper: 'About developer',
        welcomeHeading: 'How can I help you today?',
        welcomeSub: 'Ask anything, upload files, or start a conversation.',
        copyMessage: 'Copy',
        readMessage: 'Read',
        summarizeBullets: 'Summarize in bullets',
        draftEmail: 'Draft a polished email',
        planProject: 'Plan a new project',
        explainConcept: 'Explain a concept',
        messageInput: 'Ask anything, add files, or share images…',
        attachImage: 'Attach image',
        attachFile: 'Attach file',
        voiceInput: 'Voice input',
        autoSend: 'Auto-send',
        sendMessage: 'Send message',
        send: 'Send',
        composerHint: 'AGNI AI can make mistakes. Check important info.',
        close: 'Close',
        aboutDeveloperTitle: 'About the Developer',
        aboutRole: 'Front-end Engineer · AGNI AI',
        aboutBio: "Hi, I'm Agni — a creative web developer building modern AI experiences with clean UI, fast interactions, and polished design.",
        role: 'Role',
        roleValue: 'Front-end Engineer',
        skills: 'Skills',
        skillsValue: 'JavaScript, HTML, CSS, UX, AI tools',
        experience: 'Experience',
        experienceValue: 'Dashboards, chat interfaces, responsive portals',
        passion: 'Passion',
        passionValue: 'Turning ideas into polished AI experiences',
        portfolio: 'Portfolio',
        contact: 'Contact',
        connecting: 'Connecting…',
        liveTranscript: 'Tap the orb to begin speaking.',
        selectGroqVoice: 'Select voice mode',
        retry: 'Retry',
        endCall: 'End call',
    },
    hi: {
        preferences: 'प्राथमिकताएँ',
        newChat: 'नया चैट',
        provider: 'प्रदाता',
        model: 'मॉडल',
        deepThinking: 'गहरा सोच',
        searchConversations: 'चैट खोजें…',
        recent: 'हालिया',
        fontSize: 'फ़ॉन्ट आकार',
        small: 'छोटा',
        normal: 'सामान्य',
        large: 'बड़ा',
        density: 'घनत्व',
        comfortable: 'आरामदायक',
        compact: 'कॉम्पैक्ट',
        language: 'भाषा',
        appearance: 'देखावट',
        tts: 'टेक्स्ट-टू-स्पीच',
        enableTts: 'TTS चालू करें',
        voice: 'आवाज़',
        speed: 'गति',
        pitch: 'पिच',
        resetDefaults: 'डिफ़ॉल्ट पुनर्स्थापित करें',
        closePreferences: 'प्राथमिकताएँ बंद करें',
        toggleTheme: 'लाइट/डार्क मोड टॉगल करें',
        toggleTts: 'टेक्स्ट-टू-स्पीच टॉगल करें',
        toggleSidebar: 'साइडबार टॉगल करें',
        aiAssistant: 'एआई सहायक',
        liveVoice: 'लाइव वॉइस',
        moreActions: 'अधिक क्रियाएँ',
        exportChat: 'चैट निर्यात करें',
        importChat: 'चैट आयात करें',
        clearChat: 'चैट साफ़ करें',
        compactView: 'कॉम्पैक्ट दृश्य',
        signOut: 'साइन आउट',
        aboutDeveloper: 'डेवलपर के बारे में',
        welcomeHeading: 'आज मैं आपकी कैसे मदद कर सकता हूँ?',
        welcomeSub: 'कुछ भी पूछें, फ़ाइल अपलोड करें, या चैट शुरू करें।',
        copyMessage: 'कॉपी',
        readMessage: 'पढ़ें',
        summarizeBullets: 'बुलेट में सारांश दें',
        draftEmail: 'एक शानदार ईमेल तैयार करें',
        planProject: 'नया प्रोजेक्ट बनाएं',
        explainConcept: 'किसी अवधारणा को समझाएँ',
        messageInput: 'कुछ भी पूछें, फ़ाइल या चित्र जोड़ें…',
        attachImage: 'चित्र जोड़ें',
        attachFile: 'फ़ाइल जोड़ें',
        voiceInput: 'वॉइस इनपुट',
        autoSend: 'ऑटो-सेंड',
        sendMessage: 'संदेश भेजें',
        send: 'भेजें',
        composerHint: 'AGNI AI गलतियाँ कर सकता है। महत्वपूर्ण जानकारी की जाँच करें।',
        close: 'बंद करें',
        aboutDeveloperTitle: 'डेवलपर के बारे में',
        aboutRole: 'फ्रंट-एंड इंजीनियर · AGNI AI',
        aboutBio: 'नमस्ते, मैं अग्नि हूँ — एक रचनात्मक वेब डेवलपर जो साफ़ UI, तेज़ इंटरैक्शन और शुद्ध डिज़ाइन के साथ आधुनिक AI अनुभव बनाता हूँ।',
        role: 'भूमिका',
        roleValue: 'फ्रंट-एंड इंजीनियर',
        skills: 'कौशल',
        skillsValue: 'JavaScript, HTML, CSS, UX, AI टूल्स',
        experience: 'अनुभव',
        experienceValue: 'डैशबोर्ड, चैट इंटरफ़ेस, रिस्पॉन्सिव पोर्टल',
        passion: 'रुचि',
        passionValue: 'आधुनिक AI अनुभवों में विचारों को परिष्कृत रूप देना',
        portfolio: 'पोर्टफोलियो',
        contact: 'संपर्क करें',
        connecting: 'कनेक्ट हो रहा है…',
        liveTranscript: 'बोलना शुरू करने के लिए ओर्ब पर टैप करें।',
        retry: 'पुनः प्रयास',
        endCall: 'कॉल समाप्त करें',
    },
    bn: {
        preferences: 'পছন্দসমূহ',
        newChat: 'নতুন চ্যাট',
        provider: 'প্রদানকারী',
        model: 'মডেল',
        deepThinking: 'গভীর চিন্তা',
        searchConversations: 'চ্যাট খুঁজুন…',
        recent: 'সাম্প্রতিক',
        fontSize: 'ফন্ট সাইজ',
        small: 'ছোট',
        normal: 'স্বাভাবিক',
        large: 'বড়',
        density: 'ঘনত্ব',
        comfortable: 'আরামদায়ক',
        compact: 'কমপ্যাক্ট',
        language: 'ভাষা',
        appearance: 'চেহারা',
        tts: 'টেক্সট-টু-স্পীচ',
        enableTts: 'TTS চালু করুন',
        voice: 'কণ্ঠস্বর',
        speed: 'গতি',
        pitch: 'পিচ',
        resetDefaults: 'ডিফল্ট রিসেট করুন',
        closePreferences: 'পছন্দসমূহ বন্ধ করুন',
        toggleTheme: 'হালকা/ডার্ক মোড টগল করুন',
        toggleTts: 'টেক্সট-টু-স্পীচ টগল করুন',
        toggleSidebar: 'সাইডবার টগল করুন',
        aiAssistant: 'এআই সহকারী',
        liveVoice: 'লাইভ ভয়েস',
        moreActions: 'আরও কার্যক্রম',
        exportChat: 'চ্যাট এক্সপোর্ট করুন',
        importChat: 'চ্যাট ইমপোর্ট করুন',
        clearChat: 'চ্যাট পরিষ্কার করুন',
        compactView: 'কমপ্যাক্ট ভিউ',
        signOut: 'সাইন আউট',
        aboutDeveloper: 'ডেভেলপার সম্পর্কে',
        welcomeHeading: 'আজ আমি কীভাবে সাহায্য করতে পারি?',
        welcomeSub: 'কিছুই জিজ্ঞেস করুন, ফাইল আপলোড করুন, বা চ্যাট শুরু করুন।',
        copyMessage: 'কপি',
        readMessage: 'পড়ুন',
        summarizeBullets: 'বুলেট আকারে সারাংশ দিন',
        draftEmail: 'একটি পরিপাটি ইমেল লিখুন',
        planProject: 'নতুন প্রকল্প পরিকল্পনা করুন',
        explainConcept: 'কোনো ধারণা ব্যাখ্যা করুন',
        messageInput: 'কিছুই জিজ্ঞেস করুন, ফাইল বা ছবি যোগ করুন…',
        attachImage: 'ছবি সংযুক্ত করুন',
        attachFile: 'ফাইল সংযুক্ত করুন',
        voiceInput: 'ভয়েস ইনপুট',
        autoSend: 'অটো-সেন্ড',
        sendMessage: 'বার্তা পাঠান',
        send: 'পাঠান',
        composerHint: 'AGNI AI ভুল করতে পারে। গুরুত্বপূর্ণ তথ্য যাচাই করুন।',
        close: 'বন্ধ',
        aboutDeveloperTitle: 'ডেভেলপার সম্পর্কে',
        aboutRole: 'ফ্রন্ট-এন্ড ইঞ্জিনিয়ার · AGNI AI',
        aboutBio: 'হাই, আমি অগ্নি — একটি সৃজনশীল ওয়েব ডেভেলপার, যারা পরিষ্কার UI, দ্রুত ইন্টারঅ্যাকশন এবং পরিপাটি ডিজাইনের সাথে আধুনিক AI অভিজ্ঞতা তৈরি করি।',
        role: 'ভূমিকা',
        roleValue: 'ফ্রন্ট-এন্ড ইঞ্জিনিয়ার',
        skills: 'দক্ষতা',
        skillsValue: 'JavaScript, HTML, CSS, UX, AI টুলস',
        experience: 'অভিজ্ঞতা',
        experienceValue: 'ড্যাশবোর্ড, চ্যাট ইন্টারফেস, রেসপনসিভ পোর্টাল',
        passion: 'আগ্রহ',
        passionValue: 'ধারণাকে শুদ্ধ AI অভিজ্ঞতায় রূপান্তর করা',
        portfolio: 'পোর্টফোলিও',
        contact: 'যোগাযোগ',
        connecting: 'সংযোগ হচ্ছে…',
        liveTranscript: 'কথা বলতে ওর্বে ট্যাপ করুন।',
        retry: 'পুনরায় চেষ্টা করুন',
        endCall: 'কথা বন্ধ করুন',
    },
    fr: {
        preferences: 'Préférences', newChat: 'Nouveau chat', provider: 'Fournisseur', model: 'Modèle',
        deepThinking: 'Réflexion approfondie', searchConversations: 'Rechercher des conversations…',
        recent: 'Récent', fontSize: 'Taille de police', small: 'Petit', normal: 'Normal', large: 'Grand',
        density: 'Densité', comfortable: 'Confortable', compact: 'Compact', language: 'Langue',
        appearance: 'Apparence', tts: 'Synthèse vocale', enableTts: 'Activer TTS', voice: 'Voix',
        speed: 'Vitesse', pitch: 'Hauteur', resetDefaults: 'Réinitialiser',
        closePreferences: 'Fermer les préférences', toggleTheme: 'Basculer le mode clair/sombre',
        toggleTts: 'Basculer la synthèse vocale',
    },
    ja: {
        preferences: '設定', newChat: '新しいチャット', provider: 'プロバイダー', model: 'モデル',
        deepThinking: '深い思考', searchConversations: '会話を検索…', recent: '最近',
        fontSize: 'フォントサイズ', small: '小', normal: '通常', large: '大', density: '密度',
        comfortable: '快適', compact: 'コンパクト', language: '言語', appearance: '外観',
        tts: 'テキスト読み上げ', enableTts: 'TTS を有効化', voice: '音声', speed: '速度', pitch: '音高',
        resetDefaults: 'デフォルトに戻す', closePreferences: '設定を閉じる',
        toggleTheme: 'ライト/ダークモード切替', toggleTts: 'テキスト読み上げ切替',
    },
    ko: {
        preferences: '환경설정', newChat: '새 채팅', provider: '제공자', model: '모델',
        deepThinking: '심층 사고', searchConversations: '대화 검색…', recent: '최근',
        fontSize: '글꼴 크기', small: '작게', normal: '보통', large: '크게', density: '밀도',
        comfortable: '편안함', compact: '컴팩트', language: '언어', appearance: '모양',
        tts: '텍스트 음성 변환', enableTts: 'TTS 사용', voice: '음성', speed: '속도', pitch: '피치',
        resetDefaults: '기본값 복원', closePreferences: '환경설정 닫기',
        toggleTheme: '라이트/다크 모드 전환', toggleTts: '텍스트 음성 변환 전환',
    },
    zh: {
        preferences: '首选项', newChat: '新聊天', provider: '提供商', model: '模型',
        deepThinking: '深度思考', searchConversations: '搜索对话…', recent: '最近',
        fontSize: '字号', small: '小', normal: '正常', large: '大', density: '密度',
        comfortable: '舒适', compact: '紧凑', language: '语言', appearance: '外观',
        tts: '文字转语音', enableTts: '启用 TTS', voice: '语音', speed: '速度', pitch: '音高',
        resetDefaults: '重置默认值', closePreferences: '关闭首选项',
        toggleTheme: '切换浅色/深色模式', toggleTts: '切换文字转语音',
    },
    de: {
        preferences: 'Einstellungen', newChat: 'Neuer Chat', provider: 'Anbieter', model: 'Modell',
        deepThinking: 'Tiefe Überlegung', searchConversations: 'Unterhaltungen suchen…',
        recent: 'Kürzlich', fontSize: 'Schriftgröße', small: 'Klein', normal: 'Normal', large: 'Groß',
        density: 'Dichte', comfortable: 'Komfortabel', compact: 'Kompakt', language: 'Sprache',
        appearance: 'Aussehen', tts: 'Text-to-Speech', enableTts: 'TTS aktivieren', voice: 'Stimme',
        speed: 'Geschwindigkeit', pitch: 'Tonhöhe', resetDefaults: 'Standardwerte zurücksetzen',
        closePreferences: 'Einstellungen schließen', toggleTheme: 'Hell/Dunkel-Modus umschalten',
        toggleTts: 'Text-to-Speech umschalten',
    },
    ru: {
        preferences: 'Настройки', newChat: 'Новый чат', provider: 'Поставщик', model: 'Модель',
        deepThinking: 'Глубокий анализ', searchConversations: 'Поиск бесед…', recent: 'Недавние',
        fontSize: 'Размер шрифта', small: 'Малый', normal: 'Обычный', large: 'Крупный',
        density: 'Плотность', comfortable: 'Комфортно', compact: 'Компакт', language: 'Язык',
        appearance: 'Внешний вид', tts: 'Текст в речь', enableTts: 'Включить TTS', voice: 'Голос',
        speed: 'Скорость', pitch: 'Высота', resetDefaults: 'Сбросить настройки',
        closePreferences: 'Закрыть настройки', toggleTheme: 'Переключить светлую/тёмную тему',
        toggleTts: 'Переключить текст в речь',
    },
};

const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

let attachments = [];
let conversations = [];
let activeId = null;
let csrfToken = '';
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
let ttsEnabled = false;
let voiceFallbackReason = '';
let silenceMonitorId = null;
let silenceDurationMs = 0;
let audioContext = null;
let analyserNode = null;

// ── Groq Voice Agent state ──────────────────────────────────────────────────
let groqVoiceSocket = null;
let groqVoiceActive = false;
let groqVoiceMicStream = null;
let groqVoiceMediaRecorder = null;
let groqVoiceAudioChunks = [];
let groqVoiceIsRecording = false;
let groqVoiceTtsUtterance = null;
// ────────────────────────────────────────────────────────────────────────────

const openSettingsBtn = document.getElementById('open-settings-btn');
const sidebarSettings = document.getElementById('sidebar-settings');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const resetSettingsBtn = document.getElementById('reset-settings-btn');
const ttsToggleBtn = document.getElementById('tts-toggle-btn');
const fontOpts = Array.from(document.getElementsByClassName('font-opt'));
const densityOpts = Array.from(document.getElementsByClassName('density-opt'));

function getWelcomeText() {
    if (!currentUser) return DEFAULT_WELCOME_TEXT;
    const fullName = currentUser.name || currentUser.email || '';
    const firstName = fullName.split(/\s+/).find(Boolean)?.replace(/[^\p{L}\p{N}]/gu, '') || '';
    const displayName = firstName || (currentUser.email ? currentUser.email.split('@')[0] : 'there');
    return `Hello! ${displayName} I'm your AI assistant. Ask me anything and I'll help.`;
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
    if (compactViewToggle) compactViewToggle.checked = density === 'compact';
    if (save) localStorage.setItem(UI_DENSITY_KEY, density);
}

function updateLanguageSelection(language, save = true) {
    if (!language) return;
    const resolved = ['en','hi','bn','fr','ja','ko','zh','de','ru'].includes(language) ? language : 'en';
    document.documentElement.lang = resolved;
    document.documentElement.dataset.lang = resolved;
    if (languageSelect) languageSelect.value = resolved;
    if (save) localStorage.setItem(UI_LANGUAGE_KEY, resolved);
    updateTranslations();
}

function updateTranslations() {
    const language = localStorage.getItem(UI_LANGUAGE_KEY) || 'en';
    const dictionary = UI_TRANSLATIONS[language] || UI_TRANSLATIONS.en;
    document.querySelectorAll('[data-i18n]').forEach((node) => {
        const key = node.dataset.i18n;
        if (!dictionary[key]) return;
        const tag = node.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
        node.textContent = dictionary[key];
    });
    document.querySelectorAll('[data-i18n-key]').forEach((node) => {
        const key = node.dataset.i18nKey;
        if (dictionary[key]) {
            node.setAttribute('aria-label', dictionary[key]);
            if (node.dataset.i18nAttr === 'title') node.setAttribute('title', dictionary[key]);
        }
    });
    document.querySelectorAll('[data-i18n-attr]').forEach((node) => {
        const key = node.dataset.i18nAttr;
        const translationKey = node.dataset.i18n ?? node.dataset.i18nKey;
        if (key === 'placeholder' && dictionary[translationKey]) node.setAttribute('placeholder', dictionary[translationKey]);
        if (key === 'aria-label' && dictionary[translationKey]) node.setAttribute('aria-label', dictionary[translationKey]);
        if (key === 'title' && dictionary[translationKey]) node.setAttribute('title', dictionary[translationKey]);
    });
}

function applyLanguage(language) {
    const resolved = ['en','hi','bn','fr','ja','ko','zh','de','ru'].includes(language) ? language : 'en';
    updateLanguageSelection(resolved, false);
}

function loadUISettings() {
    const font = localStorage.getItem(UI_FONT_KEY) || 'normal';
    const density = localStorage.getItem(UI_DENSITY_KEY) || 'comfortable';
    const language = localStorage.getItem(UI_LANGUAGE_KEY) || 'en';
    applyFontSize(font);
    updateDensitySelection(density, false);
    applyLanguage(language);
    fontOpts.forEach(btn => btn.classList.toggle('active', btn.dataset.font === font));
    densityOpts.forEach(btn => btn.classList.toggle('active', btn.dataset.density === density));
    if (languageSelect) languageSelect.value = language;
}

function saveUISettings(font, density, language) {
    if (font) localStorage.setItem(UI_FONT_KEY, font);
    if (density) localStorage.setItem(UI_DENSITY_KEY, density);
    if (language) localStorage.setItem(UI_LANGUAGE_KEY, language);
}

function resetUISettings() {
    localStorage.removeItem(UI_FONT_KEY);
    localStorage.removeItem(UI_DENSITY_KEY);
    localStorage.removeItem(UI_LANGUAGE_KEY);
    localStorage.removeItem(THEME_KEY);
    localStorage.removeItem(TTS_KEY);
    applyFontSize('normal');
    updateDensitySelection('comfortable', false);
    applyLanguage('en');
    applyTheme('dark');
    ttsEnabled = false;
    updateTTSButton();
    fontOpts.forEach(btn => btn.classList.toggle('active', btn.dataset.font === 'normal'));
    densityOpts.forEach(btn => btn.classList.toggle('active', btn.dataset.density === 'comfortable'));
    if (languageSelect) languageSelect.value = 'en';
    if (compactViewToggle) compactViewToggle.checked = false;
    updateCompactMode();
}

function toggleSidebarSettings(show) {
    if (!sidebarSettings) return;
    sidebarSettings.hidden = !show;
    if (openSettingsBtn) openSettingsBtn.setAttribute('aria-expanded', String(show));
}

function applyTheme(theme) {
    const html = document.documentElement;
    const resolved = theme === 'light' ? 'light' : 'dark';
    html.setAttribute('data-theme', resolved);
    html.classList.toggle('light-mode', resolved === 'light');
    localStorage.setItem(THEME_KEY, resolved);
    updateThemeButton();
}

function initTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
    applyTheme(savedTheme);
}

function toggleTheme() {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    applyTheme(isLight ? 'dark' : 'light');
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
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    if (themeToggleBtn) {
        themeToggleBtn.classList.toggle('active', isLight);
        themeToggleBtn.setAttribute('aria-checked', String(isLight));
    }
}

function initTTS() {
    ttsEnabled = (localStorage.getItem(TTS_KEY) || 'false') === 'true';
    updateTTSButton();
}

function toggleTTS() {
    ttsEnabled = !ttsEnabled;
    localStorage.setItem(TTS_KEY, String(ttsEnabled));
    updateTTSButton();
}

function updateTTSButton() {
    if (!ttsToggleBtn) return;
    ttsToggleBtn.classList.toggle('active', ttsEnabled);
    ttsToggleBtn.setAttribute('aria-checked', String(ttsEnabled));
}

function exportConversations() {
    const dataStr = JSON.stringify(conversations, null, 2);
    const url = URL.createObjectURL(new Blob([dataStr], { type: 'application/json' }));
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
                const isValid = imported.every(conv => conv.id && conv.title !== undefined && Array.isArray(conv.messages));
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
    reader.onerror = () => showComposerNotice('Failed to read file.');
    reader.readAsText(file);
}

function handleImportInput(event) {
    const file = event.target.files?.[0];
    if (file) { importConversations(file); event.target.value = ''; }
}

const modelOptions = {
    gemini: [
        { label: 'Gemini 2.0 Flash', value: 'gemini-2.0-flash' },
        { label: 'Gemini 2.0 Flash Lite', value: 'gemini-2.0-flash-lite' },
        { label: 'Gemini 1.5 Pro', value: 'gemini-1.5-pro' }
    ],
    groq: [
        { label: 'GPT OSS 20B', value: 'gpt-oss-20b' },
        { label: 'Llama 3.3 70B Versatile', value: 'llama-3.3-70b-versatile' },
        { label: 'Mixtral 8x7B', value: 'mixtral-8x7b-32768' }
    ],
    openai: [
        { label: 'GPT-4o Mini', value: 'gpt-4o-mini' },
        { label: 'GPT-4o', value: 'gpt-4o' }
    ]
};

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
        firstMessage.content === "Hello! I'm your AI assistant. Ask me anything and I'll help."
    );
    if (isGenericWelcome && firstMessage.content !== welcomeText) {
        firstMessage.content = welcomeText;
        saveState();
        persistConversation(conv);
    }
}

async function loadState() {
    try {
        await fetchCsrfToken();
        const response = await fetch('/api/conversations');
        if (response.ok) {
            const payload = await response.json();
            if (Array.isArray(payload) && payload.length > 0) {
                conversations = payload;
                activeId = localStorage.getItem(ACTIVE_KEY);
                if (!activeId || !conversations.some(c => c.id === activeId)) activeId = conversations[0].id;
                saveState();
                return;
            }
        }
    } catch (error) {}

    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        conversations = raw ? JSON.parse(raw) : [];
    } catch (error) { conversations = []; }

    if (!Array.isArray(conversations) || conversations.length === 0) {
        conversations = [createConversation(getWelcomeText())];
    }
    activeId = localStorage.getItem(ACTIVE_KEY);
    if (!activeId || !conversations.some(c => c.id === activeId)) activeId = conversations[0].id;
}

function saveState() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
        localStorage.setItem(ACTIVE_KEY, activeId);
    } catch (error) {}
}

async function fetchCsrfToken() {
    try {
        const response = await fetch('/api/csrf-token', { credentials: 'include' });
        if (!response.ok) return;
        const data = await response.json();
        csrfToken = data?.csrfToken || '';
    } catch (error) { csrfToken = ''; }
}

function buildJsonHeaders(extra = {}) {
    const headers = { 'Content-Type': 'application/json', ...(extra || {}) };
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
    return headers;
}

async function persistConversation(conv) {
    if (!conv) return;
    try {
        await fetch('/api/conversations', {
            method: 'POST',
            headers: buildJsonHeaders(),
            credentials: 'include',
            body: JSON.stringify(conv)
        });
    } catch (error) {}
}

async function deleteConversationFromServer(id) {
    if (!id) return;
    try {
        await fetch('/api/conversations', {
            method: 'DELETE',
            headers: buildJsonHeaders(),
            credentials: 'include',
            body: JSON.stringify({ id })
        });
    } catch (error) {}
}

async function fetchCurrentUser() {
    try {
        const response = await fetch('/api/user');
        if (!response.ok) throw new Error('Not authenticated');
        const data = await response.json();
        return data.user || null;
    } catch (error) { return null; }
}

function renderUserHeader() {
    if (!sidebarUserInfo || !currentUser) return;
    sidebarUserAvatar.src = currentUser.avatar || 'Sitelogo.svg';
    sidebarUserAvatar.alt = currentUser.name ? `${currentUser.name}'s avatar` : 'User avatar';
    sidebarUserName.textContent = currentUser.name || currentUser.email || 'Signed in user';
    sidebarUserInfo.hidden = false;
}

async function handleLogout() {
    try {
        const res = await fetch('/auth/logout', { method: 'POST', headers: buildJsonHeaders(), credentials: 'include' });
        if (!res.ok) console.warn('Logout request failed with status', res.status);
    } catch (error) { console.warn('Logout network error:', error); }
    window.location.replace('/login');
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
    if (conversations.length === 0) conversations = [createConversation(getWelcomeText())];
    if (activeId === id) activeId = conversations[0].id;
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
            delBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteConversation(conv.id); });
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
    if (compactViewToggle) compactViewToggle.checked = storedCompact;
    updateCompactMode();
    if (storedCompact) updateDensitySelection('compact', false);
}

function handleKeyboardShortcuts(event) {
    if (event.ctrlKey || event.metaKey) {
        if (event.altKey && event.key.toLowerCase() === 'b') { event.preventDefault(); toggleSidebarBtn.click(); return; }
        if (event.altKey && event.key.toLowerCase() === 't') { event.preventDefault(); toggleTheme(); return; }
        if (event.altKey && event.key.toLowerCase() === 'e') { event.preventDefault(); exportConversations(); return; }
        if (event.altKey && event.key.toLowerCase() === 'i') { event.preventDefault(); importInput.click(); return; }
        if (event.altKey && event.key.toLowerCase() === 'j') { event.preventDefault(); userInput.focus(); return; }
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault(); historySearch.focus(); return;
    }
    if ((event.ctrlKey || event.metaKey) && event.altKey && event.key.toLowerCase() === 'n') {
        event.preventDefault(); newChatBtn.click(); return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key === ',') {
        event.preventDefault();
        if (sidebarSettings) toggleSidebarSettings(sidebarSettings.hidden);
        return;
    }
    if (event.key === 'Escape') {
        if (pendingRequest) { event.preventDefault(); cancelCurrentRequest(); return; }
        if (sidebarSettings && !sidebarSettings.hidden) { toggleSidebarSettings(false); return; }
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
    const hasUserMessage = Array.isArray(conv?.messages) && conv.messages.some(m => m.role === 'user' && (m.content || '').toString().trim() !== '');
    const shouldShow = Array.isArray(conv?.messages) && !hasUserMessage;
    suggestionPromptBar.innerHTML = '';
    suggestionPromptBar.classList.toggle('visible', shouldShow);
    if (!shouldShow) return;
    suggestedPrompts.forEach(prompt => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'suggestion-chip';
        chip.textContent = prompt;
        chip.addEventListener('click', () => { userInput.value = prompt; userInput.focus(); handleSend(); });
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
    conv.messages.forEach((m, index) => appendMessage(m.content, m.role, { persist: false }, index));
    renderSuggestedPrompts();
}

function escapeHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function renderMarkdown(raw) {
    let html = escapeHtml(raw);
    html = html.replace(/```([a-zA-Z0-9]*)\n?([\s\S]*?)```/g, (m, lang, code) => `<pre class="code-block"><code>${code.trim()}</code></pre>`);
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
        button.classList.add('copied');
        setTimeout(() => button.classList.remove('copied'), 1500);
    }).catch(() => {});
}

function getLatestUserMessageIndex(conv = getActiveConversation()) {
    if (!conv?.messages) return -1;
    let latestIndex = -1;
    conv.messages.forEach((m, i) => { if (m.role === 'user') latestIndex = i; });
    return latestIndex;
}

function isLatestUserMessage(messageIndex, conv = getActiveConversation()) {
    return messageIndex === getLatestUserMessageIndex(conv);
}

function editPromptInComposer(text, messageIndex = null) {
    const targetIndex = messageIndex === null ? getLatestUserMessageIndex() : messageIndex;
    userInput.value = text;
    userInput.focus();
    userInput.select();
    editingPromptState = targetIndex < 0 ? null : { messageIndex: targetIndex };
    showComposerNotice('Editing the latest prompt. Send to replace it.');
}

function streamBotMessage(messageDiv, text) {
    const content = messageDiv.querySelector('.message-content');
    if (!content) return;
    content.textContent = '';
    const chars = Array.from(text);
    let index = 0;
    const tick = () => {
        if (index >= chars.length) { content.innerHTML = renderMarkdown(text); messageDiv.classList.remove('is-streaming'); chatBox.scrollTop = chatBox.scrollHeight; return; }
        content.textContent += chars[index]; index++;
        chatBox.scrollTop = chatBox.scrollHeight;
        setTimeout(tick, 12);
    };
    tick();
}

function createStreamingBotMessage() {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', 'bot-message', 'is-streaming');
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.innerHTML = '<span class="material-symbols-outlined">smart_toy</span>';
    messageDiv.appendChild(avatar);
    const messageBody = document.createElement('div');
    messageBody.className = 'message-body';
    const content = document.createElement('div');
    content.className = 'message-content';
    messageBody.appendChild(content);
    const cursor = document.createElement('span');
    cursor.className = 'stream-cursor';
    cursor.textContent = '|';
    messageBody.appendChild(cursor);
    const actions = document.createElement('div');
    actions.className = 'message-actions';
    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'msg-action-btn';
    copyBtn.innerHTML = '<span class="material-symbols-outlined">content_copy</span>Copy';
    copyBtn.addEventListener('click', () => copyToClipboard(content.textContent || '', copyBtn));
    actions.appendChild(copyBtn);
    messageBody.appendChild(actions);
    messageDiv.appendChild(messageBody);
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
    return { messageDiv, content, cursor };
}

function updateStreamingBotMessage(messageDiv, partialText, { ragContextUsed = false } = {}) {
    const content = messageDiv.querySelector('.message-content');
    if (!content) return;
    content.textContent = partialText;
    if (ragContextUsed) messageDiv.dataset.ragContextUsed = 'true';
    chatBox.scrollTop = chatBox.scrollHeight;
}

function finalizeStreamingBotMessage(messageDiv, finalText, persist = true) {
    const content = messageDiv.querySelector('.message-content');
    if (!content) return;
    const noticeMarkup = messageDiv.dataset.ragContextUsed === 'true' ? '<div class="rag-context-indicator">Answering from your documents…</div>' : '';
    content.innerHTML = `${noticeMarkup}${renderMarkdown(finalText)}`;
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

function buildAttachmentPillsHtml(msgAttachments) {
    if (!Array.isArray(msgAttachments) || !msgAttachments.length) return '';
    const pills = msgAttachments.map(item => {
        if (item.type?.startsWith('image/') && item.previewUrl) {
            return `<div class="msg-attachment-pill msg-attachment-image"><img src="${escapeHtml(item.previewUrl)}" alt="${escapeHtml(item.name)}" class="msg-attachment-img-preview"><span class="msg-attachment-filename">${escapeHtml(item.name)}</span></div>`;
        }
        const iconMap = { pdf: 'picture_as_pdf', json: 'data_object', csv: 'table_chart', md: 'article' };
        const ext = (item.name || '').split('.').pop()?.toLowerCase() || '';
        const icon = iconMap[ext] || 'attach_file';
        const sizeLabel = item.size ? ` · ${formatFileSize(item.size)}` : '';
        return `<div class="msg-attachment-pill msg-attachment-file"><span class="material-symbols-outlined msg-attachment-icon">${escapeHtml(icon)}</span><div class="msg-attachment-info"><span class="msg-attachment-filename">${escapeHtml(item.name)}</span><span class="msg-attachment-filemeta">${escapeHtml(ext.toUpperCase())}${escapeHtml(sizeLabel)}</span></div></div>`;
    });
    return `<div class="msg-attachments-row">${pills.join('')}</div>`;
}

function appendMessage(text, sender, options = {}, messageIndex = null) {
    const { persist = true, animate = false, attachments: msgAttachments = [] } = options;
    const conv = getActiveConversation();
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', sender === 'user' ? 'user-message' : 'bot-message');
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.innerHTML = sender === 'user' ? '<span class="material-symbols-outlined">person</span>' : '<span class="material-symbols-outlined">smart_toy</span>';
    messageDiv.appendChild(avatar);
    const messageBody = document.createElement('div');
    messageBody.className = 'message-body';
    messageDiv.appendChild(messageBody);
    if (sender === 'user' && msgAttachments.length > 0) {
        const pillsHtml = buildAttachmentPillsHtml(msgAttachments);
        if (pillsHtml) { const pw = document.createElement('div'); pw.innerHTML = pillsHtml; messageBody.appendChild(pw.firstElementChild); }
    }
    const content = document.createElement('div');
    content.className = 'message-content';
    messageBody.appendChild(content);
    const actions = document.createElement('div');
    actions.className = 'message-actions';
    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'msg-action-btn';
    copyBtn.innerHTML = '<span class="material-symbols-outlined">content_copy</span>Copy';
    copyBtn.addEventListener('click', () => copyToClipboard(text, copyBtn));
    actions.appendChild(copyBtn);
    const renderIndex = messageIndex !== null && messageIndex !== undefined ? messageIndex : (sender === 'user' ? conv.messages.length : null);
    if (sender === 'user' && isLatestUserMessage(renderIndex, conv)) {
        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'msg-action-btn';
        editBtn.innerHTML = '<span class="material-symbols-outlined">edit</span>Edit';
        editBtn.addEventListener('click', () => editPromptInComposer(text, renderIndex));
        actions.appendChild(editBtn);
    }
    if (sender === 'bot') {
        if (animate) { messageDiv.classList.add('is-streaming'); streamBotMessage(messageDiv, text); }
        else {
            const noticeMarkup = messageDiv.dataset.ragContextUsed === 'true' ? '<div class="rag-context-indicator">Answering from your documents…</div>' : '';
            content.innerHTML = `${noticeMarkup}${renderMarkdown(text)}`;
        }
    } else { content.textContent = text; }
    messageBody.appendChild(actions);
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
    if (persist) {
        conv.messages.push({ role: sender === 'user' ? 'user' : 'bot', content: text });
        if (conv.title === 'New chat' && sender === 'user' && text.trim()) conv.title = text.length > 28 ? text.slice(0, 28) + '…' : text;
        saveState();
        persistConversation(conv);
        renderHistoryList();
    }
    return messageDiv;
}

function addRegenerateButton(botEl, userText, attachmentsSnapshot, historyForRequest) {
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

const SUPPORTED_TEXT_EXTENSIONS = new Set(['.txt','.md','.markdown','.json','.csv','.tsv','.yaml','.yml','.xml','.html','.htm','.css','.js','.ts','.jsx','.tsx','.py','.rb','.go','.rs','.java','.c','.cpp','.h','.sh','.env','.toml','.ini','.log']);
const SUPPORTED_BINARY_EXTENSIONS = new Set(['.pdf']);

function getFileIcon(file) {
    const ext = (file.name || '').split('.').pop()?.toLowerCase() || '';
    const type = file.type || '';
    if (type.startsWith('image/')) return 'image';
    if (ext === 'pdf') return 'picture_as_pdf';
    if (['json','yaml','yml','xml','toml','ini'].includes(ext)) return 'data_object';
    if (['csv','tsv'].includes(ext)) return 'table_chart';
    if (['js','ts','jsx','tsx','py','rb','go','rs','java','c','cpp','h','sh'].includes(ext)) return 'code';
    if (['html','htm','css'].includes(ext)) return 'web';
    if (['md','markdown'].includes(ext)) return 'article';
    if (['log','txt'].includes(ext)) return 'text_snippet';
    return 'attach_file';
}

function isFileSupported(file) {
    if (file.type?.startsWith('image/')) return true;
    const ext = '.' + (file.name || '').split('.').pop()?.toLowerCase();
    return SUPPORTED_TEXT_EXTENSIONS.has(ext) || SUPPORTED_BINARY_EXTENSIONS.has(ext);
}

function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function renderAttachments() {
    attachmentPreview.innerHTML = '';
    attachments.forEach((item, index) => {
        const chip = document.createElement('div');
        chip.className = 'attachment-chip';
        chip.setAttribute('role', 'listitem');
        chip.setAttribute('aria-label', `Attached: ${item.name}`);
        if (item.previewUrl && item.type?.startsWith('image/')) {
            const img = document.createElement('img');
            img.src = item.previewUrl; img.alt = item.name; img.className = 'attachment-thumb';
            chip.appendChild(img);
        } else {
            const iconEl = document.createElement('span');
            iconEl.className = 'material-symbols-outlined attachment-file-icon';
            iconEl.setAttribute('aria-hidden', 'true');
            iconEl.textContent = getFileIcon(item);
            chip.appendChild(iconEl);
        }
        const meta = document.createElement('div');
        meta.className = 'attachment-meta';
        const name = document.createElement('span');
        name.className = 'attachment-name';
        const displayName = item.name.length > 22 ? `${item.name.slice(0, 19)}…` : item.name;
        name.textContent = displayName; name.title = item.name;
        meta.appendChild(name);
        if (item.size) {
            const size = document.createElement('span');
            size.className = 'attachment-size';
            size.textContent = formatFileSize(item.size);
            meta.appendChild(size);
        }
        chip.appendChild(meta);
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'attachment-remove-btn';
        removeBtn.setAttribute('aria-label', `Remove ${item.name}`);
        removeBtn.innerHTML = '<span class="material-symbols-outlined">close</span>';
        removeBtn.addEventListener('click', () => { attachments.splice(index, 1); renderAttachments(); });
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
    if (file.size > MAX_ATTACHMENT_BYTES) { showComposerNotice(`"${file.name}" exceeds the 8 MB limit.`); return; }
    if (attachments.length >= 6) { showComposerNotice('Maximum 6 attachments per message.'); return; }
    if (attachments.some(a => a.name === file.name && a.size === file.size)) { showComposerNotice(`"${file.name}" is already attached.`); return; }
    if (!isFileSupported(file)) { const ext = '.' + (file.name||'').split('.').pop()?.toLowerCase(); showComposerNotice(`"${file.name}" (${ext}) is not supported.`); return; }
    const reader = new FileReader();
    reader.onload = () => { attachments.push({ name: file.name, type: file.type || 'application/octet-stream', size: file.size, previewUrl: reader.result }); renderAttachments(); };
    reader.onerror = () => showComposerNotice(`Couldn't read "${file.name}".`);
    reader.readAsDataURL(file);
}

function handleAttachmentSelection(event) {
    Array.from(event.target.files || []).forEach(addAttachment);
    event.target.value = '';
}

function populateModels() {
    const provider = providerSelect.value;
    modelSelect.innerHTML = '';
    modelOptions[provider].forEach(option => {
        const opt = document.createElement('option');
        opt.value = option.value; opt.textContent = option.label;
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
    thinkingToggle.setAttribute('aria-checked', String(thinkingToggle.classList.contains('active')));
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

// ══════════════════════════════════════════════════════════════════════════════
// GROQ VOICE AGENT  –  replaces Gemini Live
// Flow: orb tap → open mic → record → send to server via WS (groq-voice) →
//       server does Whisper STT + LLM → client gets reply text → browser TTS
// ══════════════════════════════════════════════════════════════════════════════

function setLiveOrbState(state) {
    if (!liveOrb) return;
    liveOrb.classList.remove('listening', 'speaking', 'error', 'thinking');
    if (state) liveOrb.classList.add(state);
}

function setLiveStatus(text, state = '') {
    if (liveStatusText) liveStatusText.textContent = text || 'Connecting…';
    if (state) setLiveOrbState(state);
}

function setLiveTranscript(text) {
    if (!liveTranscript) return;
    liveTranscript.textContent = text || 'Tap the orb - And mic is all yours.';
}

/** Stop browser TTS if it is playing */
function stopGroqTTS() {
    if (typeof window.speechSynthesis !== 'undefined') {
        window.speechSynthesis.cancel();
    }
    groqVoiceTtsUtterance = null;
}

/** Speak text via browser TTS, then signal server that speaking is done */
function groqTTSSpeak(text) {
    if (!text || typeof window.speechSynthesis === 'undefined') {
        notifyGroqDoneSpeaking();
        return;
    }
    stopGroqTTS();
    setLiveOrbState('speaking');
    setLiveStatus('Speaking…', 'speaking');
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.onend = () => notifyGroqDoneSpeaking();
    utterance.onerror = () => notifyGroqDoneSpeaking();
    groqVoiceTtsUtterance = utterance;
    window.speechSynthesis.speak(utterance);
}

function notifyGroqDoneSpeaking() {
    groqVoiceTtsUtterance = null;
    if (!groqVoiceActive || !groqVoiceSocket || groqVoiceSocket.readyState !== WebSocket.OPEN) return;
    groqVoiceSocket.send(JSON.stringify({ type: 'groq-voice', action: 'done-speaking' }));
    setLiveOrbState('listening');
    setLiveStatus('Listening… tap orb to speak.', 'listening');
}

/** Stop mic recording and release stream */
function stopGroqMic() {
    if (groqVoiceMediaRecorder && groqVoiceIsRecording) {
        try { groqVoiceMediaRecorder.stop(); } catch (e) {}
    }
    groqVoiceIsRecording = false;
    groqVoiceMediaRecorder = null;
    if (groqVoiceMicStream) {
        groqVoiceMicStream.getTracks().forEach(t => t.stop());
        groqVoiceMicStream = null;
    }
    groqVoiceAudioChunks = [];
}

/**
 * Record one utterance: open mic → record → on stop, send audio chunks to
 * server then fire end-utterance so server does STT + LLM.
 */
async function groqStartRecording() {
    if (groqVoiceIsRecording) return; // already recording

    if (!navigator.mediaDevices?.getUserMedia) {
        setLiveStatus('Mic not supported in this browser.', 'error');
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }
        });
        groqVoiceMicStream = stream;
        groqVoiceAudioChunks = [];

        const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
        const recorder = new MediaRecorder(stream, { mimeType });
        groqVoiceMediaRecorder = recorder;

        recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) groqVoiceAudioChunks.push(e.data);
        };

        recorder.onstop = async () => {
            stream.getTracks().forEach(t => t.stop());
            groqVoiceMicStream = null;
            groqVoiceIsRecording = false;
            groqVoiceMediaRecorder = null;

            if (!groqVoiceActive || !groqVoiceSocket || groqVoiceSocket.readyState !== WebSocket.OPEN) return;
            if (!groqVoiceAudioChunks.length) {
                setLiveStatus('No audio captured. Tap orb to try again.', 'listening');
                setLiveTranscript('No audio captured. Tap orb to speak.');
                return;
            }

            // Convert to base64 and send in a single message
            const blob = new Blob(groqVoiceAudioChunks, { type: mimeType });
            groqVoiceAudioChunks = [];
            const arrayBuffer = await blob.arrayBuffer();
            const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

            // Send audio data
            groqVoiceSocket.send(JSON.stringify({ type: 'groq-voice', action: 'audio', data: base64 }));
            // Signal end of utterance so server can transcribe + respond
            groqVoiceSocket.send(JSON.stringify({ type: 'groq-voice', action: 'end-utterance' }));

            setLiveOrbState('thinking');
            setLiveStatus('Processing…', 'thinking');
        };

        recorder.start();
        groqVoiceIsRecording = true;
        setLiveOrbState('listening');
        setLiveStatus('Recording… tap orb to stop.', 'listening');
        setLiveTranscript('Listening…');

    } catch (err) {
        setLiveStatus(`Mic error: ${err.message}`, 'error');
        setLiveTranscript(`Microphone error: ${err.message}`);
        groqVoiceIsRecording = false;
    }
}

/** Toggle record on/off when the user taps the orb */
function handleOrbTap() {
    if (!groqVoiceActive) return;
    if (groqVoiceIsRecording) {
        stopGroqMic(); // onstop fires → sends audio + end-utterance
    } else {
        stopGroqTTS(); // stop any ongoing speech first
        groqStartRecording();
    }
}

/** Handle all incoming server messages for the groq-voice channel */
function handleGroqVoiceMessage(data) {
    if (data.type === 'groq-voice-status') {
        const { status, message } = data;
        if (status === 'ready') {
            setLiveStatus('Ready — tap orb to speak.', 'listening');
            setLiveTranscript('Tap the orb to begin speaking.');
        } else if (status === 'transcribing') {
            setLiveOrbState('thinking');
            setLiveStatus('Transcribing…', 'thinking');
        } else if (status === 'thinking') {
            setLiveOrbState('thinking');
            setLiveStatus('Thinking…', 'thinking');
        } else if (status === 'speaking') {
            // TTS is handled client-side; server just echoes status
        } else if (status === 'error') {
            setLiveOrbState('error');
            setLiveStatus(`Error: ${message}`, 'error');
            setLiveTranscript(message || 'An error occurred.');
        }
    } else if (data.type === 'groq-voice-transcript') {
        // Display the transcript (user or assistant) in the transcript area
        const prefix = data.role === 'user' ? 'You: ' : 'AI: ';
        setLiveTranscript(prefix + (data.text || ''));
    } else if (data.type === 'groq-voice-reply') {
        // Speak the AI reply using browser TTS
        groqTTSSpeak(data.text || '');
    }
}

/** Open the modal and connect to the Groq voice WS channel */
function openLiveVoiceModal() {
    if (liveVoiceModal) liveVoiceModal.hidden = false;
    setLiveStatus('Connecting…', '');
    setLiveTranscript('Connecting to Groq voice agent…');
    setLiveOrbState('');
    startGroqVoiceSession();
}

/** Disconnect and hide the modal */
function closeLiveVoiceModal() {
    stopGroqVoiceSession({ hideModal: true });
}

/** Retry the connection */
function retryLiveVoiceSession() {
    stopGroqVoiceSession({ hideModal: false });
    setLiveStatus('Retrying…', '');
    setLiveTranscript('Reconnecting to Groq voice agent…');
    setTimeout(() => startGroqVoiceSession(), 400);
}

function stopGroqVoiceSession({ hideModal = true } = {}) {
    groqVoiceActive = false;
    stopGroqTTS();
    stopGroqMic();

    if (groqVoiceSocket) {
        const s = groqVoiceSocket;
        groqVoiceSocket = null;
        try {
            s.send(JSON.stringify({ type: 'groq-voice', action: 'end' }));
            s.close();
        } catch (e) {}
    }

    setLiveOrbState('');
    setLiveStatus('Disconnected', '');
    setLiveTranscript('Session ended.');

    if (hideModal && liveVoiceModal) liveVoiceModal.hidden = true;
}

async function startGroqVoiceSession() {
    if (groqVoiceActive) return;
    groqVoiceActive = true;

    groqVoiceSocket = new WebSocket(WS_ENDPOINT);

    groqVoiceSocket.addEventListener('open', () => {
        // Send setup message to initialise Groq voice session on server
        groqVoiceSocket.send(JSON.stringify({ type: 'groq-voice', action: 'setup' }));
    });

    groqVoiceSocket.addEventListener('message', (event) => {
        let payload;
        try { payload = JSON.parse(event.data); } catch { return; }

        // Ignore generic WS handshake messages
        if (payload.type === 'connected') return;

        handleGroqVoiceMessage(payload);
    });

    groqVoiceSocket.addEventListener('error', () => {
        setLiveOrbState('error');
        setLiveStatus('Connection error.', 'error');
        setLiveTranscript('Could not connect to the voice agent. Check server and retry.');
        stopGroqVoiceSession({ hideModal: false });
    });

    groqVoiceSocket.addEventListener('close', () => {
        if (groqVoiceActive) {
            setLiveStatus('Connection closed.', '');
            setLiveTranscript('Voice session ended.');
        }
        groqVoiceActive = false;
    });
}

// Wire orb tap to toggle recording
if (liveOrb) {
    liveOrb.addEventListener('click', handleOrbTap);
}

// ══════════════════════════════════════════════════════════════════════════════
// END GROQ VOICE AGENT
// ══════════════════════════════════════════════════════════════════════════════

function setComposerBusy(isBusy) {
    const icon = sendBtn.querySelector('.material-symbols-outlined');
    const sendLabel = sendBtn.querySelector('.send-text');
    sendBtn.disabled = false;
    sendBtn.classList.toggle('busy', isBusy);
    sendBtn.classList.toggle('cancel-mode', isBusy);
    sendBtn.setAttribute('aria-label', isBusy ? 'Cancel current chat' : 'Send message');
    if (icon) icon.textContent = isBusy ? 'close' : 'send';
    if (sendLabel) sendLabel.textContent = isBusy ? 'Cancel' : 'Send';
    userInput.disabled = isBusy;
}

function setVoiceListening(isListening) {
    isVoiceListening = isListening;
    voiceInputBtn.classList.toggle('listening', isListening);
    const icon = voiceInputBtn.querySelector('.material-symbols-outlined');
    if (icon) icon.textContent = isListening ? 'stop' : 'mic';
    voiceInputBtn.setAttribute('aria-pressed', String(isListening));
}

function clearVoiceRecorderState() {
    if (voiceRecorderTimer) { window.clearTimeout(voiceRecorderTimer); voiceRecorderTimer = null; }
    if (voiceRecorderSilenceTimer) { window.clearTimeout(voiceRecorderSilenceTimer); voiceRecorderSilenceTimer = null; }
    if (silenceMonitorId) { window.clearInterval(silenceMonitorId); silenceMonitorId = null; }
    if (audioContext) { audioContext.close().catch(() => {}); audioContext = null; }
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
        if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
        if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
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
            for (let i = 0; i < buffer.length; i++) { const v = (buffer[i] - 128) / 128; sum += Math.abs(v); }
            const avg = sum / buffer.length;
            if (avg < 0.01) { silenceDurationMs += 200; if (silenceDurationMs >= 3000 && mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop(); }
            else silenceDurationMs = 0;
        }, 200);
    } catch (e) {}
}

function stopVoiceInput() {
    if (speechRecognition && isVoiceListening) speechRecognition.stop();
    if (mediaRecorder && voiceIsRecording) mediaRecorder.stop();
    clearVoiceRecorderState();
    setVoiceListening(false);
}

async function transcribeAudioBlob(blob) {
    const formData = new FormData();
    formData.append('audio', blob, 'voice.webm');
    const response = await fetch('/api/transcribe', { method: 'POST', body: formData });
    if (!response.ok) throw new Error((await response.text()) || 'Transcription failed.');
    const data = await response.json();
    return { transcript: data.transcript || '', fallback: Boolean(data.fallback) };
}

function applyVoiceTranscript(transcript) {
    const cleaned = transcript.trim();
    if (!cleaned) { showComposerNotice('No speech was detected.'); return; }
    userInput.value = cleaned;
    showComposerNotice('Voice captured.');
    if (autoSubmitVoice) handleSend();
}

function handleVoiceRecordingStop() {
    const blob = new Blob(recordedChunks, { type: mediaRecorder?.mimeType || 'audio/webm' });
    if (!blob.size) { showComposerNotice('No audio captured.'); clearVoiceRecorderState(); setVoiceListening(false); return; }
    if (voiceFallbackReason) showComposerNotice(`Using fallback speech recognition: ${voiceFallbackReason}`);
    if (typeof window.speechSynthesis !== 'undefined') window.speechSynthesis.cancel();
    transcribeAudioBlob(blob).then(({ transcript, fallback }) => {
        applyVoiceTranscript((fallback && voiceTranscriptBuffer.trim()) || transcript.trim());
    }).catch((e) => { showComposerNotice(e.message || 'Transcription failed.'); })
      .finally(() => { clearVoiceRecorderState(); setVoiceListening(false); });
}

async function startVoiceInput() {
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (isVoiceListening) { stopVoiceInput(); return; }
    if (!navigator.mediaDevices?.getUserMedia) {
        if (SpeechRecognitionCtor) voiceFallbackReason = 'browser speech recognition';
        else { showComposerNotice('Voice input is not supported in this browser.'); return; }
    }
    if (!window.MediaRecorder && !SpeechRecognitionCtor) { showComposerNotice('Voice input is not supported in this browser.'); return; }
    setVoiceListening(true);
    voiceTranscriptBuffer = '';
    recordedChunks = [];
    if (SpeechRecognitionCtor && !window.MediaRecorder) {
        voiceFallbackReason = 'MediaRecorder unavailable';
        speechRecognition = speechRecognition || new SpeechRecognitionCtor();
        speechRecognition.continuous = false;
        speechRecognition.interimResults = true;
        speechRecognition.lang = 'en-US';
        speechRecognition.onstart = () => { voiceTranscriptBuffer = ''; setVoiceListening(true); };
        speechRecognition.onresult = (e) => {
            let interim = '', final = '';
            for (let i = e.resultIndex; i < e.results.length; i++) {
                const t = e.results[i][0].transcript.trim();
                if (e.results[i].isFinal) final += `${t} `; else interim += `${t} `;
            }
            voiceTranscriptBuffer = `${voiceTranscriptBuffer}${final}${interim}`.trim();
            userInput.value = voiceTranscriptBuffer;
        };
        speechRecognition.onerror = () => { setVoiceListening(false); showComposerNotice('Voice input stopped.'); };
        speechRecognition.onend = () => setVoiceListening(false);
        try { speechRecognition.start(); } catch (e) { setVoiceListening(false); showComposerNotice('Could not start voice input.'); }
        return;
    }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorderStream = stream;
        const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
        mediaRecorder = new MediaRecorder(stream, { mimeType });
        mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunks.push(e.data); };
        mediaRecorder.onstop = () => { stream.getTracks().forEach(t => t.stop()); mediaRecorderStream = null; handleVoiceRecordingStop(); };
        if (SpeechRecognitionCtor) {
            speechRecognition = speechRecognition || new SpeechRecognitionCtor();
            speechRecognition.continuous = false;
            speechRecognition.interimResults = true;
            speechRecognition.lang = 'en-US';
            speechRecognition.onresult = (e) => {
                let interim = '', final = '';
                for (let i = e.resultIndex; i < e.results.length; i++) {
                    const t = e.results[i][0].transcript.trim();
                    if (e.results[i].isFinal) final += `${t} `; else interim += `${t} `;
                }
                voiceTranscriptBuffer = `${voiceTranscriptBuffer}${final}${interim}`.trim();
                userInput.value = voiceTranscriptBuffer;
            };
            speechRecognition.onerror = () => showComposerNotice('Voice input stopped.');
            speechRecognition.onend = () => { if (voiceIsRecording) speechRecognition.start(); };
            speechRecognition.start();
        }
        mediaRecorder.start();
        voiceIsRecording = true;
        voiceRecorderTimer = window.setTimeout(() => { if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop(); }, 8000);
        startSilenceMonitoring(stream);
    } catch (e) { setVoiceListening(false); showComposerNotice('Microphone access was denied or is unavailable.'); }
}

function removeThinkingIndicator() {
    if (pendingRequest?.thinkingId) document.getElementById(pendingRequest.thinkingId)?.remove();
}

function connectWebSocket() {
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;
    socket = new WebSocket(WS_ENDPOINT);
    socket.addEventListener('open', () => { socketReady = true; updateStatusPill(); });
    socket.addEventListener('message', (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.type === 'connected') { socketReady = true; updateStatusPill(); return; }
            if (data.type === 'status') return;
            if (data.type === 'done') {
                removeThinkingIndicator();
                const request = pendingRequest; pendingRequest = null;
                if (!request) return;
                const botEl = appendMessage(data.content, 'bot', { animate: true });
                if (data.ragUsed) botEl.dataset.ragContextUsed = 'true';
                addRegenerateButton(botEl, request.userText, request.attachmentsSnapshot, request.historyForRequest);
                speakResponse(data.content);
                setComposerBusy(false); return;
            }
            if (data.type === 'error') { removeThinkingIndicator(); pendingRequest = null; setComposerBusy(false); showFallbackMessage(); }
        } catch (e) { removeThinkingIndicator(); pendingRequest = null; setComposerBusy(false); showFallbackMessage(); }
    });
    socket.addEventListener('close', () => { socketReady = false; updateStatusPill(); window.setTimeout(connectWebSocket, 1500); });
    socket.addEventListener('error', () => { socketReady = false; updateStatusPill(); });
}

function cancelCurrentRequest() {
    const activeRequest = pendingRequest;
    if (!activeRequest) return;
    activeRequest.cancelled = true;
    if (activeRequest.abortController && !activeRequest.abortController.signal.aborted) activeRequest.abortController.abort();
    if (activeRequest.source === 'ws' && socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'cancel' }));
    removeThinkingIndicator();
    setComposerBusy(false);
    showComposerNotice('Chat canceled.');
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
    const abortController = new AbortController();
    pendingRequest = { thinkingId, userText, attachmentsSnapshot, historyForRequest, abortController, cancelled: false, source: 'http' };
    if (socketReady && socket && socket.readyState === WebSocket.OPEN) {
        pendingRequest.source = 'ws';
        socket.send(JSON.stringify({ type: 'chat', message: userText, history: historyForRequest, provider: providerSelect.value, model: modelSelect.value, thinking: thinkingToggle.classList.contains('active'), attachments: attachmentsSnapshot }));
        return;
    }
    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: abortController.signal,
            body: JSON.stringify({ message: userText, history: historyForRequest, provider: providerSelect.value, model: modelSelect.value, thinking: thinkingToggle.classList.contains('active'), attachments: attachmentsSnapshot })
        });
        if (!response.ok) throw new Error((await response.text()) || 'Request failed');
        const streamMessage = createStreamingBotMessage();
        let partialText = '', hadError = false, errorText = '';
        const reader = response.body?.getReader();
        if (!reader) throw new Error('Streaming response unsupported');
        const decoder = new TextDecoder();
        let buffer = '';
        const processEvent = (rawEvent) => {
            const lines = rawEvent.split(/\r?\n/);
            let eventType = 'message', dataLines = [];
            for (const line of lines) {
                if (line.startsWith('event:')) eventType = line.slice(6).trim();
                else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
            }
            const rawData = dataLines.join('\n');
            if (!rawData) return;
            let parsed; try { parsed = JSON.parse(rawData); } catch { return; }
            if (eventType === 'message') {
                const delta = parsed?.delta;
                if (typeof delta === 'string') { partialText += delta; updateStreamingBotMessage(streamMessage.messageDiv, partialText, { ragContextUsed: Boolean(parsed?.ragUsed) }); }
                else if (parsed?.error) { hadError = true; errorText = parsed.error; }
            } else if (eventType === 'error') { hadError = true; errorText = parsed?.message || parsed?.error || 'An error occurred.'; }
            else if (eventType === 'done') { if (parsed?.ragUsed) streamMessage.messageDiv.dataset.ragContextUsed = 'true'; }
        };
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let mark;
            while ((mark = buffer.indexOf('\n\n')) !== -1) { processEvent(buffer.slice(0, mark)); buffer = buffer.slice(mark + 2); }
        }
        if (buffer.trim()) processEvent(buffer.trim());
        if (hadError) finalizeStreamingBotMessageWithError(streamMessage.messageDiv, partialText, errorText || 'Stream ended with error');
        else { finalizeStreamingBotMessage(streamMessage.messageDiv, partialText); addRegenerateButton(streamMessage.messageDiv, userText, attachmentsSnapshot, historyForRequest); speakResponse(partialText); }
    } catch (error) {
        if (error?.name === 'AbortError' || abortController.signal.aborted) { removeThinkingIndicator(); pendingRequest = null; setComposerBusy(false); return; }
        removeThinkingIndicator(); pendingRequest = null;
        const streamMessage = createStreamingBotMessage();
        finalizeStreamingBotMessageWithError(streamMessage.messageDiv, '', error.message || 'The assistant is temporarily unavailable.');
    } finally { removeThinkingIndicator(); pendingRequest = null; setComposerBusy(false); }
}

function handleSend() {
    if (sendBtn.classList.contains('cancel-mode') || pendingRequest) return;
    const text = userInput.value.trim();
    if (text === '' && attachments.length === 0) return;
    const conv = getActiveConversation();
    const normalizedText = text || 'Shared attachments';
    const attachmentsSnapshot = attachments.slice();
    if (editingPromptState && editingPromptState.messageIndex !== null) {
        const targetIndex = editingPromptState.messageIndex;
        if (targetIndex >= 0 && targetIndex < conv.messages.length) {
            conv.messages[targetIndex].content = normalizedText;
            conv.messages.splice(targetIndex + 1);
            saveState(); persistConversation(conv); renderActiveConversation(); renderHistoryList();
        }
        editingPromptState = null;
    } else { appendMessage(normalizedText, 'user', { attachments: attachmentsSnapshot }); }
    const historyForRequest = conv.messages.map(m => ({ role: m.role, content: m.content }));
    userInput.value = '';
    attachments = [];
    renderAttachments();
    renderSuggestedPrompts();
    fetchAIResponse(normalizedText, attachmentsSnapshot, historyForRequest);
}

// ── Event wiring ─────────────────────────────────────────────────────────────

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
    const wasOpen = isMobile ? sidebar.classList.contains('mobile-open') : !sidebar.classList.contains('collapsed');
    if (isOpen && !wasOpen) { sidebar.classList.add('sidebar-opening'); setTimeout(() => sidebar.classList.remove('sidebar-opening'), 600); }
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
    if (window.innerWidth <= 900) setSidebarOpen(!sidebar.classList.contains('mobile-open'));
    else setSidebarOpen(sidebar.classList.contains('collapsed'));
});

sidebarOverlay.addEventListener('click', () => setSidebarOpen(false));
window.addEventListener('resize', () => { if (window.innerWidth > 900) setSidebarOpen(true); else setSidebarOpen(false); });

themeToggleBtn.addEventListener('click', toggleTheme);
ttsToggleBtn.addEventListener('click', toggleTTS);
actionMenuBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleActionMenu(); });
exportBtn.addEventListener('click', () => { closeActionMenu(); exportConversations(); });
importBtn.addEventListener('click', () => { closeActionMenu(); importInput.click(); });
clearChatBtn.addEventListener('click', () => { closeActionMenu(); clearActiveConversation(); });
importInput.addEventListener('change', handleImportInput);

const aboutDevBtn = document.getElementById('about-dev-btn');
const aboutOverlay = document.getElementById('about-overlay');
const aboutCloseBtn = document.getElementById('about-close-btn');
function openAboutModal() { if (!aboutOverlay) return; aboutOverlay.hidden = false; closeActionMenu(); }
function closeAboutModal() { if (!aboutOverlay) return; aboutOverlay.hidden = true; }
if (aboutDevBtn) aboutDevBtn.addEventListener('click', openAboutModal);
if (aboutCloseBtn) aboutCloseBtn.addEventListener('click', closeAboutModal);
if (aboutOverlay) aboutOverlay.addEventListener('click', (e) => { if (e.target === aboutOverlay) closeAboutModal(); });

document.addEventListener('click', (e) => { if (!actionMenuBtn.contains(e.target) && !actionMenuDropdown.contains(e.target)) closeActionMenu(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeActionMenu(); });

providerSelect.addEventListener('change', populateModels);
modelSelect.addEventListener('change', updateStatusPill);
thinkingToggle.addEventListener('click', toggleThinking);
imageInput.addEventListener('change', handleAttachmentSelection);
fileInput.addEventListener('change', handleAttachmentSelection);
sendBtn.addEventListener('click', () => { if (sendBtn.classList.contains('cancel-mode')) { cancelCurrentRequest(); return; } handleSend(); });
voiceInputBtn.addEventListener('click', startVoiceInput);
autoSubmitToggleBtn.addEventListener('click', toggleAutoSubmit);

// Live voice modal buttons
if (liveVoiceBtn) liveVoiceBtn.addEventListener('click', openLiveVoiceModal);
if (liveEndCallBtn) liveEndCallBtn.addEventListener('click', closeLiveVoiceModal);
if (liveRetryBtn) liveRetryBtn.addEventListener('click', retryLiveVoiceSession);

// liveVoiceSelect is no longer needed for Groq (no server-side voice selection)
// but keep it harmless if the HTML still has it
if (liveVoiceSelect) liveVoiceSelect.style.display = 'none';

userInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSend(); });
userInput.addEventListener('focus', () => { stopVoiceInput(); });
document.addEventListener('keydown', handleKeyboardShortcuts);

compactViewToggle.addEventListener('change', handleCompactToggle);
compactViewToggleBtn.addEventListener('click', () => {
    compactViewToggle.checked = !compactViewToggle.checked;
    handleCompactToggle();
    updateDensitySelection(compactViewToggle.checked ? 'compact' : 'comfortable');
    closeActionMenu();
});
historySearch.addEventListener('input', handleHistorySearch);

if (openSettingsBtn) openSettingsBtn.addEventListener('click', () => { if (sidebarSettings) toggleSidebarSettings(sidebarSettings.hidden); });
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
    updateDensitySelection(d, true);
    saveUISettings(null, d);
}));
if (languageSelect) {
    languageSelect.addEventListener('change', (e) => {
        const lang = e.currentTarget.value;
        updateLanguageSelection(lang, true);
        saveUISettings(null, null, lang);
    });
}

// ── Initialization ───────────────────────────────────────────────────────────

async function initializeApp() {
    initTheme();
    initTTS();
    initCompactMode();
    loadUISettings();
    currentUser = await fetchCurrentUser();
    if (!currentUser) { window.location.href = '/login'; return; }
    renderUserHeader();
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
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