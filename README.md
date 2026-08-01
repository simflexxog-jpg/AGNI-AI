AGNI AI — Final Year Project

Comprehensive Project Documentation

Table of Contents
1. Executive Summary
2. Project Overview
3. System Architecture
4. Technology Stack
5. Project Structure
6. Features
7. UI Design
8. Backend Details
9. Frontend Behavior
10. Database Design
11. AI Provider Integration
12. WebSocket Communication
13. Deployment Guide
14. Environment Variables
15. API Endpoints
16. Security Considerations
17. Testing and Validation
18. Limitations & Future Work
19. Conclusion & References

---

1. Executive Summary

AGNI AI is a full-stack conversational assistant web app that combines a polished chat interface with multi-provider AI routing, Google authentication, live voice interaction, chat persistence, and resilient fallback behavior.

At a glance:
- Frontend: HTML, CSS, JavaScript
- Backend: Node.js + Express
- Real-time chat: WebSocket with HTTP streaming fallback
- Voice: browser microphone capture, Groq Whisper transcription, and Gemini Live support
- Auth: Google login plus local email/password support
- Storage: PostgreSQL when configured, in-memory fallback when not

This project is designed to showcase a modern AI assistant workflow with practical UX details, deployment readiness, and graceful degradation when external services are unavailable.

---

2. Project Overview

Purpose
- AGNI AI provides a lightweight, extensible AI workspace for chat, file sharing, voice input, and multi-model assistance.
- It supports secure authentication, persistent per-user chat history, and a highly responsive user experience.

Goals
- Deliver a clean and polished chat UI with strong usability details.
- Demonstrate secure access, conversation persistence, and AI provider abstraction.
- Implement voice-first interaction from recording to transcription to assistant response.
- Provide robust fallback behavior when provider or browser features are unavailable.

Intended audience
- Project evaluators, developers, and maintainers who need to understand, test, extend, or deploy the application.

Deliverables
- Frontend: single-page app built with HTML/CSS/JavaScript
- Backend: Express server with REST and WebSocket routes
- Documentation and deployment support for Render-hosted deployment

---

3. System Architecture

Overview
- Client layer: browser app rendered from `index.html`, controlled by `script.js`, and responsible for chat UI, voice capture, transcript handling, and local settings.
- Server layer: `server.js` handles authentication, session management, chat orchestration, provider calls, transcription, and WebSocket live voice routing.
- Data layer: PostgreSQL is the recommended persistence layer, with in-memory fallback for development and local testing.
- External integrations: Google OAuth, Groq Whisper, Gemini Live, and the selected LLM APIs via OpenAI, Groq, or Gemini.

Primary flows
- Login flow: browser receives Google credentials -> server verifies the token -> session is created -> user lands on the main chat workspace.
- Chat flow: user message is sent to the server -> provider response is streamed back -> UI renders partial output in real time.
- Voice flow: browser microphone captures audio -> `/api/transcribe` submits it to Groq -> transcript is inserted into the composer or auto-submitted.
- Live voice flow: browser opens a live WebSocket -> server proxies the Gemini Live connection -> audio and response text are exchanged in real time.

---

4. Technology Stack

- Node.js 18+: runtime and server hosting
- Express: HTTP routing and middleware
- WebSocket server (`ws`): streaming chat and live voice relay
- PostgreSQL + `pg`: persistent user and conversation storage
- `busboy`: multipart audio parsing for transcription
- Google Identity Services: OAuth-driven sign-in
- Browser APIs: `MediaRecorder`, `SpeechRecognition`, and `speechSynthesis`
- Render: deployment platform

Why these choices
- Minimal dependency footprint keeps the app simple to understand and extend.
- Render makes deployment and environment configuration straightforward for student or portfolio projects.

---

5. Project Structure

Root layout (key files)
- `index.html` — main chat interface
- `login.html` — sign-in page
- `register.html` — account creation page
- `script.js` — client-side logic for chat, voice, settings, and persistent state
- `style.css` — layout and theme styling
- `server.js` — server routes, auth, provider integration, and live voice proxy
- `package.json` — runtime dependencies and start command
- `data/` — local development data and stored conversation fallback
- `README.md` — project documentation

Conventions
- Conversations stored per-user with `id`, `title`, `messages` array (each message: `{role, content}`)
- `role` values: `bot` (server messages), `user` (client messages), optional `system`

---

6. Features

Core assistant features
- Google OAuth sign-in with session-based authentication and local account registration support
- Per-user conversation persistence with PostgreSQL when configured, and in-memory fallback for local development
- Multi-provider chat routing across Gemini, Groq, and OpenAI models
- Streaming chat responses over WebSocket with HTTP SSE fallback for reliability
- Rich composer with attachments, image support, conversation history, and quick suggestion chips
- Voice input using browser microphone capture, with server-side Groq Whisper transcription
- Live Gemini voice mode using a dedicated WebSocket proxy and selectable voice profiles
- Client-side TTS via the browser speech engine, controlled through preferences and persisted locally
- Export/import of chat history as JSON
- Search fallback using DuckDuckGo when the upstream AI provider is unavailable
- Optional project-aware context retrieval (RAG) that scans workspace text files and injects relevant context into prompts
- Local email/password authentication flow, including registration, login, password hashing, and session persistence
- Password-strength validation and account creation checks on the registration page
- Login rate-limit indicator and friendly status feedback for failed or cancelled sign-in attempts
- Request cancellation support so the Send button turns into a Cancel button during an active chat request
- Automatic WebSocket reconnection and connection-state updates in the UI status pill

Small but important product features
- Auto-send toggle for voice transcripts
- Silence detection to stop long recordings automatically
- Browser speech recognition fallback when MediaRecorder is unavailable
- Deep thinking toggle to alter temperature and response style per request
- Compact and comfortable layout modes for UI density personalization
- Font size, theme, and TTS controls stored in browser local storage
- Searchable conversation sidebar with delete actions and smart title generation
- Copy, regenerate, and read-aloud controls on chat messages
- Keyboard shortcuts for sidebar, theme, export/import, search, new chat, and settings
- About developer modal and responsive action menu for polished UX
- Show/hide password toggle on the login page
- Composer feedback notices for actions such as voice capture, import, clear chat, and error states
- Debug endpoints for session inspection and cookie troubleshooting during deployment and testing

---

6. UI Design

Principles
- Clean, distraction-free chat UI
- Responsive layout with sticky composer on mobile
- Accessible controls: large touch targets, keyboard shortcuts, ARIA roles where applicable

Key screens
- Login: GSI button, origin hint if OAuth misconfig
- Chat: message list, suggestion chips, composer, attachments
- Sidebar: user info, conversation history, settings

Responsive behavior
- Sidebar collapses on small screens; composer fixed to bottom with stacked controls and larger buttons.

Accessibility and UX details
- Keyboard shortcuts are provided for new chat, search, theme, exports/imports, sidebar toggle, and settings
- ARIA labels, role attributes, dialog semantics, and live regions are used across the interface
- The composer and sidebar are optimized for mobile layouts with a sliding sidebar and sticky bottom composer
- Lightweight feedback notices make actions like voice capture, import, export, and clearing chats feel responsive

Keyboard shortcuts implemented
- `Ctrl/Cmd + Alt + B` — Toggle sidebar
- `Ctrl/Cmd + Alt + T` — Toggle theme
- `Ctrl/Cmd + Alt + E` — Export conversations
- `Ctrl/Cmd + Alt + I` — Import conversations
- `Ctrl/Cmd + Alt + J` — Focus message input
- `Ctrl/Cmd + K` — Focus chat history search
- `Ctrl/Cmd + Alt + N` — Start a new chat
- `Ctrl/Cmd + ,` — Toggle settings
- `Escape` — Cancel request or close settings

---

7. `server.js` — Backend Details

Main responsibilities
- Serve static files
- Provide auth endpoints and session handling
- Offer API endpoints: `/api/user`, `/api/conversations`, `/api/transcribe`, `/api/chat`
- WebSocket endpoint for streaming chat

Key modules and functions
- Session configuration: uses `express-session` with `connect-pg-simple` when `DATABASE_URL` present
- `readBody(req)`: robust body reader used when `express.json()` is not available
- `handleConversationPersistence(req, res)`: route middleware that serves and persists conversations
- `upsertConversation` / `listConversations`: Postgres-backed persistence (JSONB for `messages`)
- `POST /auth/google/callback`: verifies Google ID token via `google-auth-library` and stores session
- `POST /api/transcribe`: uses `busboy` to parse uploaded audio and forwards to Groq transcription endpoint

Important notes and fixes
- Use `req.body` (from `express.json()`) when available to avoid re-consuming the request stream;
  fallback to manual `readBody()` for legacy form-encoded or streamed requests.
- Session cookie configuration: when `NODE_ENV=production` set `sameSite='none'` and `secure=true` to support cross-site contexts on Render.

Logging and debugging
- Endpoints include helpful console logs for `POST /auth/google/callback` and `GET /debug/check-session` to inspect cookies and session state during debugging.

---

8. `script.js` — Frontend Behavior

High-level responsibilities
- Initialize UI, fetch `currentUser` from `/api/user`
- Load and persist conversations to `/api/conversations` and localStorage
- Manage voice recording, transcription flow, and sending chat requests
- Connect to WebSocket for streaming responses; fallback to HTTP streaming
- Provide UI interactions: suggestion chips, settings, TTS playback

Key functions
- `initializeApp()` — load user, state, and connect sockets
- `fetchCurrentUser()` — GET `/api/user`
- `loadState()` / `saveState()` — sync with server and localStorage
- `renderSuggestedPrompts()` — shows suggestion chips when no user messages exist
- `startVoiceInput()` / `transcribeAudioBlob()` — capture audio and call `/api/transcribe`
- `fetchAIResponse()` — sends request over WS or HTTP fallback and streams partial messages into the chat

Edge cases handled
- MediaRecorder missing -> fallback to SpeechRecognition
- Groq key missing -> server returns fallback and client uses SpeechRecognition interim results
- Persistent sessions with `connect.sid` cookie; client relies on server session for authenticated API calls

---

9. `index.html` — Markup and Accessibility

Structure highlights
- Top-level header with site brand and action menu (log out moved into menu)
- Chat container with message list and suggestion bar
- Composer area at the bottom with input, voice button, attachments

Accessibility
- `role="dialog"` for modals, `aria-label` for suggestion prompt bar
- Buttons use `type="button"` to avoid accidental form submission
- Keyboard handling (Enter submits, Escape closes modals)

Tips
- Keep DOM IDs consistent with `script.js` selectors. Avoid renaming elements without updating the script references.

---

10. `style.css` — Styling and Responsive Rules

Organization
- Theme tokens at top (light/dark)
- Layout sections: sidebar, chat, composer, modals
- Responsive media queries at 900px and 640px

Mobile improvements (recent updates)
- Composer fixed to bottom for easy reachability
- Larger touch targets for `.icon-btn` and `.toggle-chip`
- Sidebar transforms to a sliding off-canvas panel

Performance
- Use small animations and prefers-reduced-motion support
- Keep large background images minimal to improve mobile load times

---

11. Database Design

Recommended schema (Postgres)

Users table
```sql
CREATE TABLE users (
  google_id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT,
  avatar TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

Conversations table
```sql
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users (google_id),
  title TEXT,
  messages JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

Notes
- `messages` stores an array of `{ role, content }` objects. Use JSONB to query if needed.
- Index `user_id` and `updated_at` for efficient listing of recent conversations.

In-memory fallback
- For quick local testing (no `DATABASE_URL`), the server uses JS Maps. This is volatile and sessions/conversations are lost on restart.

---

12. AI Provider Integration (Groq, OpenAI, Gemini)

Provider selection
- UI exposes a provider dropdown. The server uses provider-specific functions: `callGroq`, `callOpenAI`, and `callGemini`.

Groq
- Used for both chat completions (if chosen) and Whisper-style transcription via `POST /api/transcribe`.
- Requires `GROQ_API_KEY` in env variables for transcription and `callGroq` API usage.

OpenAI
- Requires `OPENAI_API_KEY`. Server uses Chat Completions endpoint for responses.

Google Gemini
- Optional provider; configure `GEMINI_API_KEY` and ensure server code uses the proper REST endpoint and keys.

Provider selection best practices
- Use environment variables and do not commit keys.
- Add rate limit handling and graceful fallback when provider is unavailable.

---

13. WebSocket Communication

Purpose
- Provide streaming responses (token-by-token or chunk streaming) for a responsive UX.

Flow
- Client opens WS to root path. Server responds with `connected` and listens for `chat` events.
- Server sends `status`, `message` (partial deltas), and `done` events as JSON frames.

Client handling
- `fetchAIResponse()` manages both WS and HTTP fallback. On WS, sending is JSON `{type:'chat', message, history, provider, model}`.
- Partial content is appended to a streaming message container and finalized on `done`.

Considerations
- Add reconnect/backoff logic with exponential backoff and jitter.
- Handle duplicate events and idempotency on reconnect.

---

14. Render Deployment (step-by-step)

Prerequisites
- Render account and repository connected (GitHub/GitLab).
- Create Render Web Service and optional Postgres add-on (for `DATABASE_URL`).

Service configuration
- Environment: `Node 18`
- Start command: `npm start` (server runs `node server.js`)
- Build command: none (unless you add bundling)

Environment variables (set in Render dashboard)
- `SESSION_SECRET` — strong random string
- `DATABASE_URL` — Render Postgres connection string (if using)
- `GOOGLE_CLIENT_ID` — Google OAuth client ID; ensure OAuth console includes your Render origin in "Authorized JavaScript origins"
- `GROQ_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY` — provider keys
- `NODE_ENV` — `production`

Networking & cookies
- On Render, sessions require `sameSite: none` and `secure: true` for cross-site cookies. `server.js` already sets these when `NODE_ENV==='production'`.

Steps
1. Push code to Git repository.
2. In Render, create a new Web Service, connect repo branch, and use `npm start`.
3. Add environment variables in the Render dashboard.
4. (Optional) Create a Postgres database in Render, then set `DATABASE_URL`.
5. Deploy and monitor logs in Render dashboard.

Post-deploy checks
- `/health` returns `{"status":"ok"}`.
- `/api/google-client-id` returns your client id.
- Login flow works and `/api/user` returns user after sign-in.

Troubleshooting
- If sessions are not persisted across restarts, confirm `DATABASE_URL` and `connect-pg-simple` are configured and used.
- If Google sign-in shows origin error, add the Render origin to the OAuth client's Authorized JavaScript origins.

---

15. Environment Variables (Render dashboard details)

List and notes
- `PORT` — usually set by Render automatically. Server uses `process.env.PORT || 3001`.
- `SESSION_SECRET` — keep secret. Use a 32+ char random string.
- `DATABASE_URL` — set by Render when adding Postgres. DO NOT expose publicly.
- `GOOGLE_CLIENT_ID` — required for login. On Google Cloud Console, set Authorized JavaScript origins to `https://<your-render-service>.onrender.com` and Authorized redirect URIs if you use redirect flow.
- `GROQ_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY` — API keys for providers.

How to add in Render
1. Go to your service in Render > Environment > Environment Variables.
2. Add keys as key/value pairs; mark them as private.
3. Re-deploy the service for changes to take effect.

Testing after env changes
- Use Render logs and test endpoints (`/health`, `/api/google-client-id`) to validate.

---

16. API Endpoints (reference + samples)

Health
- `GET /health` — 200 `{ "status": "ok" }`

Auth
- `GET /api/google-client-id` — `{ clientId: '...' }`
- `POST /auth/google/callback` — body JSON `{ id_token }` -> validates token, sets session
- `POST /auth/logout` — invalidates session

User
- `GET /api/user` — returns `{ user }` or `{ user: null }`

Conversations
- `GET /api/conversations` — requires session; returns `[ { id, title, messages, createdAt, updatedAt }, ... ]`
- `POST /api/conversations` — body: conversation object; returns persisted object
- `DELETE /api/conversations` — body `{ id }`

Transcription
- `POST /api/transcribe` — multipart/form-data upload `file` -> server forwards to Groq and returns `{ transcript, fallback }`

Chat
- `POST /api/chat` — HTTP fallback for chat; body includes `message`, `history`, `provider`, `model`

WebSocket
- Root path `/` for socket. Client must send JSON `{ type: 'chat', message, history, provider, model }`.

Examples
```bash
# get user
curl -i --cookie "connect.sid=<cookie>" http://localhost:3001/api/user

# fetch conversations
curl -i --cookie "connect.sid=<cookie>" http://localhost:3001/api/conversations

# create/update conversation
curl -i --cookie "connect.sid=<cookie>" -X POST -H "Content-Type: application/json" \
  -d '{"id":"c-123","title":"Test","messages":[{"role":"bot","content":"Hi"}]}' \
  http://localhost:3001/api/conversations
```

---

17. Security Considerations

Authentication & sessions
- Google ID tokens are verified on the server using `google-auth-library`.
- Sessions stored server-side; either in Postgres (`connect-pg-simple`) or in-memory (dev only).
- For production, always use Postgres session store and `SESSION_SECRET` set to a strong secret.

Transport security
- Use HTTPS in production (Render provides HTTPS). Ensure all provider callbacks and OAuth origins use `https://`.

Secrets management
- Never commit `.env` or secret keys. Use Render's env vars feature.

Input validation
- Sanitize and limit uploaded audio sizes (`MAX_ATTACHMENT_BYTES`) and incoming JSON size (server uses body size limits).

Rate limits & abuse
- Add rate limiting on endpoints (e.g., /api/chat) if exposed to public to avoid provider abuse/cost spikes.

---

18. Testing and Validation

Manual tests
- Login flow: sign-in, verify `/api/user` returns user.
- Conversations: create, refresh, ensure conversations persist and are returned by `/api/conversations`.
- Voice flow: record on client -> POST to `/api/transcribe` -> transcript returns, and chat is submitted when `autoSubmitVoice` is enabled.
- WebSocket streaming: start a chat and verify partial updates and final message.

Automated tests (recommended)
- Add unit tests for server route handlers (use Jest/Mocha + Supertest).
- Add integration tests that spin a test server and mock provider responses.

Logging
- Use server logs for errors in token verification, provider calls, and DB errors.

---

19. Limitations & Future Work

Limitations
- In-memory session store is not persistent; use Postgres for production.
- No formal rate-limiting — may be vulnerable to abuse or unexpected billing.
- Transcription relies on Groq; add fallback to other providers if needed.

Future improvements
- CI with tests and deployment checks.
- Implement user preferences (voice language, voice pitch/rate).
- Add server-side caching of provider results where appropriate.
- Add analytics & monitoring (Sentry, Prometheus).

---

20. Conclusion & References

Summary
- AGNI AI is an extensible educational project demonstrating full-stack web development with modern AI service integration and a mobile-friendly UI. The project prioritizes clarity, maintainability, and practical deployment guidelines for Render.

References
- Google Identity Services (GSI): https://developers.google.com/identity
- Groq (transcription + chat): https://groq.com/docs
- OpenAI API docs: https://platform.openai.com/docs
- Render docs: https://render.com/docs

Appendix A: Quick-run commands (local)
```bash
npm install
npm start
# open http://localhost:3001
```

Appendix B: Contact & Support
- For help modifying the project, provide the specific file and the change you want. I can implement and test it locally or guide deployment changes on Render.


