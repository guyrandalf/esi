# ESI — Personal AI Operating Layer

### "Jarvis for your Mac" · Built by Randalf

-----

## VISION

Esi is not a chatbot. She is a persistent AI operating layer that lives on your Mac — always aware, always ready, capable of acting on your behalf across every part of your digital life. She hears you, sees your screen, reads your files, joins your meetings, controls your apps, manages your calendar, remembers everything, and executes complex multi-step tasks from a single casual voice instruction.

The interface is a cinematic HUD — a transparent, always-on overlay inspired by Iron Man's Jarvis — with live animated panels showing exactly what Esi is doing at every moment. Fullscreen by default. Collapsible to a sidebar on toggle.

**The north star:** You should be able to wake up, say "Hey Esi, what's my day?" and get a full briefing — calendar, unread priority emails, pending tasks, weather, and anything she noticed while you were away — without touching your keyboard.

-----

## CORE PRINCIPLES

- **Always on.** Esi runs in the background at all times. She is never "closed".
- **Always aware.** She knows your active app, current project, upcoming meetings, clipboard contents, and system state at all times without being asked.
- **Acts, doesn't just answer.** Every response can optionally trigger an action — open an app, run a command, draft an email, create a calendar event.
- **Private by default.** All audio processing (Whisper), all simple inference (Ollama), all memory (SQLite) run locally. Gemini is only called for heavy reasoning tasks.
- **Transparent about her work.** Every step Esi takes is logged and shown live on the HUD. You always know what she's doing and why.
- **Learns over time.** Every interaction, preference, correction, and piece of context is stored in memory and used to make future responses more accurate and personal.

-----

## TECH STACK

|Layer                  |Technology                              |Cost       |
|-----------------------|----------------------------------------|-----------|
|App shell              |Electron (latest)                       |Free       |
|UI framework           |React 19 + Vite                         |Free       |
|Styling                |Tailwind CSS + Framer Motion            |Free       |
|Package manager        |Bun                                     |Free       |
|Wake word              |Porcupine (Picovoice — 1 free wake word)|Free       |
|Speech-to-text         |OpenAI Whisper (local, via whisper.cpp) |Free       |
|LLM — fast/simple      |Ollama + Llama 3.1 8B (local)           |Free       |
|LLM — heavy reasoning  |Gemini 2.0 Flash (API)                  |~$0–1/month|
|Vision / screen reading|Gemini 2.0 Flash Vision                 |Same bill  |
|Voice output           |macOS `say` command (Zoe voice)         |Free       |
|Meeting audio capture  |BlackHole 2ch (virtual audio driver)    |Free       |
|Live transcription     |Whisper.cpp (local streaming mode)      |Free       |
|Memory — structured    |SQLite via better-sqlite3               |Free       |
|Memory — semantic      |Vectra (local vector store)             |Free       |
|Calendar access        |AppleScript → Apple Calendar            |Free       |
|System control         |Node.js child_process + AppleScript     |Free       |
|File access            |Node.js fs + shell                      |Free       |
|Web search             |DuckDuckGo scraper (no API key needed)  |Free       |
|Notifications          |node-notifier                           |Free       |

**Total external cost: Gemini API only. At personal use scale, under $1/month.**

-----

## ARCHITECTURE OVERVIEW

```
INPUTS
  Microphone (continuous) ──► Wake Word (Porcupine)
  Text input (HUD) ──────────► Context Assembler
  Screen capture (periodic) ─► Gemini Vision
  Clipboard monitor ─────────► Context Assembler

CONTEXT ENGINE
  SQLite memory + Vectra vector store
  Apple Calendar reader
  Active app detector
  Meeting detector
  Project context reader (reads folder structure + .env + git log)
  └──► assembles full context snapshot per request

AI ROUTER
  Simple / fast commands ──► Ollama (local, instant)
  Complex reasoning ───────► Gemini 2.0 Flash
  Screen questions ────────► Gemini Vision
  Meeting summaries ───────► Gemini 2.0 Flash

ACTION LAYER (Node.js + AppleScript)
  File system read/write/search
  Terminal command execution
  App open/close/switch/focus
  Calendar create/read/update
  Email read/draft/send (Mail.app via AppleScript)
  Web search + summarize
  Spotify / Apple Music control
  System notifications read
  Screenshot capture

MEETING INTELLIGENCE
  BlackHole captures system audio when meeting app detected
  Whisper.cpp transcribes live
  Speaker turn detection
  Post-meeting: Gemini summarizes → extracts actions → drafts follow-up

OUTPUT
  macOS say ──► voice response
  HUD panels ─► live text, steps, logs
  Actions ────► executed silently, confirmed verbally

MEMORY
  Every command logged (SQLite)
  Every response logged
  Preferences, people, projects stored
  Meeting archive with summaries
  Semantic search across all memory (Vectra)
```

-----

## HUD DESIGN

### Layout — Fullscreen Mode (default)

Full-screen transparent overlay. Background: `rgba(5, 5, 15, 0.55)` — dark enough to give panels depth, transparent enough to use apps behind it freely. Uses macOS `setIgnoreMouseEvents` with dynamic toggle so clicks pass through to apps underneath except when interacting with HUD panels directly.

Font pairing: **Orbitron** (display/headers) + **IBM Plex Mono** (data/logs) — technical, precise, futuristic without being cartoonish.

Color palette:

- Background: `#05050f` at 55% opacity
- Panel surface: `rgba(255,255,255,0.04)`
- Panel border: `rgba(255,255,255,0.08)`
- Accent primary: `#00d4ff` (cyan — active/listening)
- Accent secondary: `#7c6aff` (violet — thinking)
- Accent confirm: `#4ade80` (green — done/confirmed)
- Accent warning: `#f4c96a` (gold — meeting/alert)
- Accent critical: `#f87171` (red — error)
- Text primary: `#e8eaf0`
- Text muted: `#4a5060`

### Panels (Fullscreen Layout)

```
┌─────────────────────────────────────────────────────────────────┐
│  [ESI ●]   ACTIVE TASK: Summarizing standup meeting...    [≡] [↔]│
├──────────────┬──────────────────────────────┬───────────────────┤
│              │                              │                   │
│  CALENDAR    │     LIVE TRANSCRIPT          │   ACTION LOG      │
│  ─────────   │     ───────────────          │   ──────────      │
│  9:00 Stand  │  "...so the deploy is        │   09:02 Opened    │
│  11:00 1:1   │   blocked on the env         │        VSCode     │
│  14:00 Demo  │   variable issue..."         │   09:15 Created   │
│              │                              │        calendar   │
│  MEMORY      │                              │        event      │
│  ─────────   │   VOICE WAVEFORM             │   09:31 Sent      │
│  John→deploy │   ▁▃▅▇▅▃▁▂▄▆▄▂              │        email      │
│  Ewoma→bday  │                              │        draft      │
│  Atulo→PR    │                              │                   │
├──────────────┴──────────────────────────────┴───────────────────┤
│  SYSTEM: VSCode · esi/src/main.ts · M3 Pro 34% · 14:22         │
│  > Hey Esi, check if the .env has the Gemini key ______________ │
└─────────────────────────────────────────────────────────────────┘
```

### Sidebar Mode (toggled)

300px panel pinned to right edge. Shows: waveform, status, next calendar event, last 3 action log entries, text input. Everything else hidden. Same aesthetic, just compressed.

### Toggle

- Voice: "Esi, go sidebar" / "Esi, go fullscreen"
- Hotkey: `Cmd + Shift + E`
- HUD toggle button top-right corner `[↔]`

### Click-through behavior

- Fullscreen mode: mouse clicks pass through the overlay to apps behind it
- When user moves mouse to HUD panel zones (defined regions), click-through disables so panels are interactive
- Sidebar mode: always interactive, never click-through

-----

## CAPABILITY MODULES

### 1. Voice Pipeline

- Porcupine listens for "Hey Esi" on a dedicated thread
- On wake: play a soft chime, start Whisper recording
- Whisper transcribes when silence detected (>1.2s gap)
- Transcript passed to Context Assembler
- Response spoken via `say -v Zoe` and displayed on HUD simultaneously

### 2. Context Assembler

Every request is enriched with:

- Current time and date
- Active app and window title
- Current project folder (if code editor active) — reads package.json name, recent git log
- Next 3 calendar events
- Last 5 memory entries relevant to the request (semantic search via Vectra)
- Clipboard contents (if text)
- Any pending tasks flagged as urgent

### 3. AI Router

```
IF task is one of: open app, play music, set timer, quick question, simple file check
  → Ollama (Llama 3.1 8B) — responds in <1 second locally

IF task involves: summarization, reasoning, multi-step planning, email drafting, 
   meeting summary, complex file analysis, screen reading
  → Gemini 2.0 Flash

IF task involves: "what do you see on my screen", visual questions
  → Screenshot → Gemini Vision
```

### 4. Action Executor

After AI response, Esi parses for action intents and executes them:

```javascript
// Example action intents Esi can detect and execute:
OPEN_APP        → "esi open vscode" → exec `open -a "Visual Studio Code"`
READ_FILE       → "check the .env file" → fs.readFile, search for key
RUN_COMMAND     → "run the dev server" → spawn terminal process
CREATE_EVENT    → "add meeting tomorrow 3pm" → AppleScript → Calendar
SEND_EMAIL      → "email John the summary" → AppleScript → Mail.app
WEB_SEARCH      → "find the latest Expo SDK docs" → DuckDuckGo → summarize
PLAY_MUSIC      → "play something focused" → AppleScript → Spotify
READ_CALENDAR   → "what's next" → AppleScript → Calendar → format response
TAKE_SCREENSHOT → "what's on my screen" → screenshot → Gemini Vision
READ_CLIPBOARD  → "what did I just copy" → clipboard API
SWITCH_APP      → "switch to chrome" → AppleScript activate
```

### 5. Meeting Intelligence

Trigger: Esi detects Zoom, Google Meet, Microsoft Teams, Slack, FaceTime, or any meeting app becomes active.

Flow:

1. Esi says: "Meeting detected. I'm listening."
1. BlackHole captures system audio (microphone + speakers mixed)
1. Whisper.cpp transcribes in rolling 30-second chunks
1. Live transcript displayed in HUD meeting panel
1. Speaker turns detected by silence gaps + voice characteristics
1. On meeting end (app closes or user says "Esi, meeting's over"):
- Full transcript assembled
- Gemini produces: Summary, Key Decisions, Action Items (with owner names), Open Questions
- Follow-up email draft created
- Action items added to Reminders
- Meeting saved to archive in SQLite
1. Esi speaks: "Meeting ended. Here's your summary…" and reads key points aloud

### 6. Memory System

Two layers:

**Structured memory (SQLite tables):**

- `command_log` — every command, response, timestamp, app context
- `people` — names, roles, relationship context ("John is my tech lead at Atulo Care")
- `projects` — project names, paths, tech stack, key notes
- `preferences` — behavioral prefs ("I prefer concise responses", "my standup is 9am daily")
- `meetings` — full archive of all meeting summaries and transcripts
- `tasks` — pending action items extracted from meetings and conversations

**Semantic memory (Vectra vector store):**

- Every significant interaction embedded and stored
- On each new request, top-5 semantically relevant memories retrieved and injected into context
- Enables: "Esi, what did we decide about the auth system last week?" → she finds it

### 7. Proactive Intelligence

Esi doesn't wait to be asked. She monitors and speaks up:

- **Pre-meeting brief:** 2 minutes before any calendar event, she says "Heads up — your [meeting name] starts in 2 minutes. Last time you discussed X. You committed to Y."
- **Morning briefing:** On first wake word of the day (or at a set time), she delivers a full day brief unprompted
- **Overdue task alert:** If a task from a meeting has no update after 24h, she flags it
- **Long coding session:** After 90 mins of continuous coding, she suggests a break
- **Clipboard awareness:** If you copy a URL, she can optionally say "Want me to summarize that?"
- **New email detection:** For flagged senders, she alerts you immediately
- **Git awareness:** If she detects a failed CI run (reading terminal output), she flags it

### 8. Developer Co-pilot Mode

Activated when VSCode, Cursor, or any code editor is the active app:

- "Esi, open Claude Code for the esi project" → opens terminal in project folder, runs `claude`
- "Esi, check if the .env has the GEMINI_API_KEY" → reads `.env`, confirms presence/absence without printing the value
- "Esi, what changed in the last commit?" → runs `git log -1 --stat` + `git diff HEAD~1`, summarizes
- "Esi, are there any TypeScript errors?" → runs `bun tsc --noEmit`, reads output, reports
- "Esi, start the dev server" → opens new terminal tab, runs `bun dev`
- "Esi, what does this function do?" (with code selected/on screen) → screenshot → Gemini explains
- "Esi, scaffold a new Next.js app called dreamteller" → runs create command, opens in VSCode

-----

## BUILD PHASES

### Phase 1 — The Core (Week 1–2)

Get the voice loop working end to end. This is the foundation everything else sits on.

- Electron app shell with transparent fullscreen window
- Basic HUD layout (static panels, no live data yet)
- Porcupine wake word integration
- Whisper.cpp local transcription
- Ollama integration (Llama 3.1 8B)
- macOS `say` voice output
- Text input fallback in HUD
- Basic command log to SQLite
- Mode toggle (fullscreen ↔ sidebar) with Cmd+Shift+E

**End of Phase 1:** You can say "Hey Esi" → ask a question → get a voice + text response. Basic app control (open/close apps) works.

### Phase 2 — Context & Memory (Week 3)

Make Esi aware of your world.

- Calendar reader (AppleScript → Apple Calendar)
- Active app detector
- Project context reader (reads package.json, git log when editor is active)
- SQLite memory tables (people, projects, preferences, command_log)
- Vectra semantic memory setup
- Memory injection into every prompt
- "Remember that…" command handler
- Proactive calendar briefing (pre-meeting alerts, morning brief)

**End of Phase 2:** Esi knows your schedule, remembers things you tell her, and gives context-aware responses.

### Phase 3 — Action Layer (Week 4)

Esi starts doing things, not just saying things.

- File system read/write/search actions
- Terminal command execution (with confirmation for destructive commands)
- App switching and control
- Web search + summarize (DuckDuckGo)
- Calendar event creation
- Clipboard reading
- Screenshot capture + Gemini Vision
- Developer co-pilot commands

**End of Phase 3:** "Esi, check the .env", "Esi, open Claude Code", "Esi, what's on my screen" — all working.

### Phase 4 — Meeting Intelligence (Week 5)

The most powerful feature.

- BlackHole audio capture setup + instructions
- Meeting app detection (Zoom, Meet, Teams, Slack, FaceTime)
- Live Whisper transcription during meetings
- HUD meeting panel (live feed)
- Post-meeting summary pipeline (Gemini)
- Action item extraction → Reminders
- Follow-up email draft → Mail.app
- Meeting archive in SQLite

**End of Phase 4:** Every meeting you have is automatically captured, summarized, and turned into action items.

### Phase 5 — Proactive Intelligence + Polish (Week 6)

Esi becomes truly autonomous.

- Proactive monitoring (overdue tasks, CI failures, long coding sessions)
- Email integration (Mail.app via AppleScript — read, draft, send)
- Spotify/Apple Music control
- Full HUD polish (animations, Framer Motion panel transitions, waveform visualizer)
- Settings panel (voice speed, Gemini vs Ollama preference, notification prefs)
- Gemini 2.0 Flash full integration (replacing Ollama for complex tasks)
- "Esi, go offline" mode (100% local)

**End of Phase 5:** Esi is fully operational. Jarvis-level.

-----

## AGENTIC BUILD INSTRUCTIONS FOR CLAUDE CODE

> Everything below this line is step-by-step instructions for Claude Code to execute. Work through each phase sequentially. Do not skip ahead. After each step, confirm the feature works before moving to the next.

-----

### SETUP

**Step 1 — Initialize the project**

```bash
mkdir esi && cd esi
bun init -y
bun add electron react react-dom
bun add -d vite @vitejs/plugin-react electron-builder concurrently wait-on
bun add tailwindcss framer-motion
bun add better-sqlite3 node-record-lpcm16 node-notifier screenshot-desktop
bun add @google/generative-ai
```

**Step 2 — Project structure to create**

```
esi/
├── electron/
│   ├── main.ts              # Electron main process
│   ├── preload.ts           # Context bridge (IPC)
│   └── modules/
│       ├── wake.ts          # Porcupine wake word
│       ├── whisper.ts       # Whisper.cpp transcription
│       ├── ollama.ts        # Ollama local LLM
│       ├── gemini.ts        # Gemini API
│       ├── router.ts        # AI task router
│       ├── context.ts       # Context assembler
│       ├── actions.ts       # Action executor
│       ├── calendar.ts      # AppleScript calendar
│       ├── meeting.ts       # Meeting intelligence
│       ├── memory.ts        # SQLite + Vectra memory
│       ├── voice.ts         # macOS say output
│       ├── system.ts        # Active app, system info
│       └── proactive.ts     # Proactive monitoring
├── src/
│   ├── App.tsx              # Root HUD component
│   ├── main.tsx             # React entry
│   ├── index.css            # Global styles
│   └── components/
│       ├── HUD/
│       │   ├── HUDFullscreen.tsx
│       │   ├── HUDSidebar.tsx
│       │   └── HUDToggle.tsx
│       ├── panels/
│       │   ├── VoiceWaveform.tsx
│       │   ├── LiveTranscript.tsx
│       │   ├── ActiveTask.tsx
│       │   ├── CalendarStrip.tsx
│       │   ├── MemoryPanel.tsx
│       │   ├── SystemPulse.tsx
│       │   ├── ActionLog.tsx
│       │   └── MeetingFeed.tsx
│       └── shared/
│           ├── PanelShell.tsx
│           └── GlowText.tsx
├── db/
│   └── schema.sql
├── package.json
├── vite.config.ts
├── tailwind.config.ts
└── electron-builder.yml
```

-----

### PHASE 1 — CORE VOICE LOOP

**Step 3 — electron/main.ts**

Create the Electron main process with:

- `BrowserWindow` configured as fullscreen transparent overlay:
  
  ```typescript
  const win = new BrowserWindow({
    fullscreen: true,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  win.setIgnoreMouseEvents(true, { forward: true })
  ```
- IPC handlers for: `esi:command`, `esi:toggle-mode`, `esi:state-update`
- On app ready: initialize all modules, start wake word listener
- `setIgnoreMouseEvents` toggle — disable when mouse enters HUD panel zones, re-enable when it leaves

**Step 4 — electron/preload.ts**

Expose via contextBridge:

```typescript
window.esi = {
  onStateUpdate: (cb) => ipcRenderer.on('state-update', cb),
  sendCommand: (text) => ipcRenderer.invoke('esi:command', text),
  toggleMode: () => ipcRenderer.invoke('esi:toggle-mode'),
  onActionLog: (cb) => ipcRenderer.on('action-log', cb),
  onTranscript: (cb) => ipcRenderer.on('transcript', cb),
}
```

**Step 5 — electron/modules/voice.ts**

```typescript
// Wraps macOS say command
export async function speak(text: string, voice = 'Zoe'): Promise<void> {
  // Strip markdown before speaking
  const clean = text.replace(/[#*`_]/g, '')
  await exec(`say -v ${voice} "${clean.replace(/"/g, '\\"')}"`)
}
```

**Step 6 — electron/modules/whisper.ts**

- Install whisper.cpp via homebrew or download binary
- Function `transcribe(audioBuffer): Promise<string>` — writes buffer to temp file, runs whisper binary, returns transcript
- Function `startListening(): Promise<string>` — records from mic until 1.2s silence, then transcribes

**Step 7 — electron/modules/ollama.ts**

```typescript
export async function ask(prompt: string, context: string): Promise<string> {
  const response = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    body: JSON.stringify({
      model: 'llama3.1:8b',
      prompt: `${context}\n\nUser: ${prompt}\nEsi:`,
      stream: false
    })
  })
  const data = await response.json()
  return data.response
}
```

**Step 8 — electron/modules/gemini.ts**

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai'
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

export async function reason(prompt: string, context: string): Promise<string> {
  const result = await model.generateContent(`${context}\n\n${prompt}`)
  return result.response.text()
}

export async function visionQuery(screenshotBase64: string, question: string): Promise<string> {
  const result = await model.generateContent([
    { inlineData: { mimeType: 'image/png', data: screenshotBase64 } },
    question
  ])
  return result.response.text()
}
```

**Step 9 — electron/modules/router.ts**

```typescript
const SIMPLE_PATTERNS = [
  /^open \w+/, /^play /, /^switch to/, /^what time/, /^set timer/,
  /^what's next/, /^close \w+/, /^go (sidebar|fullscreen)/
]

export function route(command: string): 'ollama' | 'gemini' | 'vision' {
  if (command.includes('screen') || command.includes('see')) return 'vision'
  if (SIMPLE_PATTERNS.some(p => p.test(command.toLowerCase()))) return 'ollama'
  return 'gemini'
}
```

**Step 10 — electron/modules/actions.ts**

Implement each action handler:

```typescript
export const actions = {
  openApp: (name: string) => exec(`open -a "${name}"`),
  switchApp: (name: string) => exec(`osascript -e 'tell app "${name}" to activate'`),
  runTerminal: (cmd: string) => exec(cmd),
  readFile: (path: string) => fs.readFile(path, 'utf-8'),
  checkEnv: (filePath: string, key: string) => {
    const content = fs.readFileSync(filePath, 'utf-8')
    return content.includes(key) ? `✓ ${key} is present` : `✗ ${key} not found`
  },
  takeScreenshot: () => screenshot.captureToBuffer(),
  readClipboard: () => clipboard.readText(), // Electron clipboard API
  webSearch: async (query: string) => { /* DuckDuckGo scrape + summarize */ },
  playSpotify: (query: string) => exec(`osascript -e 'tell app "Spotify" to play track "${query}"'`),
}
```

**Step 11 — db/schema.sql**

```sql
CREATE TABLE IF NOT EXISTS command_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  command TEXT NOT NULL,
  response TEXT,
  action_taken TEXT,
  app_context TEXT,
  duration_ms INTEGER
);

CREATE TABLE IF NOT EXISTS people (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  context TEXT,
  last_mentioned TEXT
);

CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  path TEXT,
  stack TEXT,
  notes TEXT,
  last_active TEXT
);

CREATE TABLE IF NOT EXISTS preferences (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS meetings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  app TEXT,
  duration_minutes INTEGER,
  transcript TEXT,
  summary TEXT,
  action_items TEXT,
  follow_up_draft TEXT
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  description TEXT NOT NULL,
  source TEXT,
  meeting_id INTEGER,
  due_date TEXT,
  completed INTEGER DEFAULT 0,
  created_at TEXT
);
```

**Step 12 — electron/modules/memory.ts**

- Initialize SQLite with schema on startup
- `logCommand(command, response, context)` — writes to command_log
- `remember(key, value)` — stores in preferences or people/projects depending on content
- `getRecentMemory(query)` — semantic search via Vectra, returns top 5 relevant memories
- `storeMeeting(meetingData)` — saves full meeting record

**Step 13 — HUD React Components**

**src/index.css** — Global styles:

```css
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;900&family=IBM+Plex+Mono:wght@300;400;500&display=swap');

* { box-sizing: border-box; margin: 0; padding: 0; }
body { 
  background: transparent !important; 
  overflow: hidden;
  font-family: 'IBM Plex Mono', monospace;
  color: #e8eaf0;
}
:root {
  --cyan: #00d4ff;
  --violet: #7c6aff;
  --green: #4ade80;
  --gold: #f4c96a;
  --red: #f87171;
  --bg: rgba(5, 5, 15, 0.55);
  --panel: rgba(255,255,255,0.04);
  --border: rgba(255,255,255,0.08);
  --muted: #4a5060;
}
```

**src/components/shared/PanelShell.tsx:**

```tsx
// Reusable panel wrapper with glowing border, label, live indicator dot
// Props: title, color (accent color for glow), children, className
// Framer Motion: fade in on mount, subtle breathing animation when active
```

**src/components/panels/VoiceWaveform.tsx:**

```tsx
// Animated waveform using Web Audio API AnalyserNode
// Shows flat line when idle, animates when Esi is speaking or listening
// Color: cyan when listening, violet when speaking
```

**src/components/panels/LiveTranscript.tsx:**

```tsx
// Scrolling feed of transcribed words
// Words appear one by one with a fade-in as they're transcribed
// Shows both user speech (right-aligned, cyan) and Esi responses (left, violet)
```

**src/components/panels/ActiveTask.tsx:**

```tsx
// Shows current multi-step task in progress
// Each step has: icon, description, status (pending/active/done)
// Framer Motion animates step completion with a checkmark sweep
```

**src/components/panels/CalendarStrip.tsx:**

```tsx
// Next 3 calendar events
// Countdown timer to next event (live updating)
// Color shifts to gold when event is <5 minutes away
```

**src/components/panels/ActionLog.tsx:**

```tsx
// Timestamped log of every action Esi has taken
// Newest at top, fades older entries
// Monospace, compact — like a terminal log
```

**src/components/panels/SystemPulse.tsx:**

```tsx
// Active app name + window title
// Current project name (if detected)
// CPU/memory usage
// Current time
// Esi mode: ONLINE / OFFLINE / MEETING
```

**src/components/HUD/HUDFullscreen.tsx:**

```tsx
// Full screen layout — see wireframe in HUD DESIGN section above
// Grid layout: left column (Calendar + Memory), center (Transcript + Waveform), right (ActionLog)
// Bottom bar: SystemPulse + text input
// Top bar: Esi logo, active task description, mode toggle buttons
```

**src/components/HUD/HUDSidebar.tsx:**

```tsx
// 300px right-edge panel
// Vertical stack: Waveform, Status, Next event, Last 3 action items, Text input
// Slide-in animation from right when toggling
```

**src/App.tsx:**

```tsx
// Reads mode state (fullscreen | sidebar)
// Keyboard shortcut: Cmd+Shift+E toggles mode
// Voice command "Esi go sidebar" / "Esi go fullscreen" also toggles
// AnimatePresence for smooth transition between modes
```

-----

### PHASE 2 — CONTEXT & MEMORY

**Step 14 — electron/modules/calendar.ts**

```typescript
// AppleScript to read Apple Calendar
export async function getUpcomingEvents(count = 5): Promise<CalendarEvent[]> {
  const script = `
    tell application "Calendar"
      set theEvents to every event of every calendar whose start date > (current date)
      -- sort and return next ${count}
    end tell
  `
  const result = await exec(`osascript -e '${script}'`)
  return parseCalendarOutput(result)
}

export async function createEvent(title: string, date: Date, duration = 60): Promise<void> {
  // AppleScript to create event
}
```

**Step 15 — electron/modules/system.ts**

```typescript
// Active app detection
export async function getActiveApp(): Promise<string> {
  const script = `tell application "System Events" to get name of first application process whose frontmost is true`
  return exec(`osascript -e '${script}'`)
}

// Project context — when VSCode/Cursor is active
export async function getProjectContext(): Promise<ProjectContext | null> {
  const activeApp = await getActiveApp()
  if (!['Code', 'Cursor'].includes(activeApp)) return null
  
  // Get active window title (contains file path)
  // Navigate up to find package.json
  // Read name, description, recent git log
  // Return structured context
}
```

**Step 16 — electron/modules/context.ts**

```typescript
export async function assembleContext(command: string): Promise<string> {
  const [calendar, app, project, memories, clipboard] = await Promise.all([
    getUpcomingEvents(3),
    getActiveApp(),
    getProjectContext(),
    getRecentMemory(command), // semantic search
    electron.clipboard.readText()
  ])

  return `
You are Esi, an AI personal assistant running on Randalf's Mac.
Current time: ${new Date().toLocaleString()}
Active app: ${app}
${project ? `Current project: ${project.name} (${project.stack}) at ${project.path}` : ''}
Upcoming events: ${formatEvents(calendar)}
${memories.length ? `Relevant memory:\n${memories.join('\n')}` : ''}
${clipboard ? `Clipboard: ${clipboard.slice(0, 200)}` : ''}

Respond concisely. If an action should be taken, start your response with [ACTION:type:params].
Keep spoken responses under 3 sentences unless asked for detail.
  `.trim()
}
```

**Step 17 — "Remember that…" handler**

Parse commands starting with "remember" or "Esi, remember":

- "Remember that John is my tech lead at Atulo Care" → insert into `people` table
- "Remember that my standup is 9am every day" → insert into `preferences`
- "Remember that the esi project is at ~/projects/esi" → insert into `projects`

Use Gemini to classify what type of memory it is and extract structured data.

-----

### PHASE 3 — ACTION LAYER

**Step 18 — Action Intent Parser**

After getting AI response, scan for `[ACTION:type:params]` prefixes:

```typescript
export function parseAction(response: string): Action | null {
  const match = response.match(/\[ACTION:(\w+):(.+?)\]/)
  if (!match) return null
  return { type: match[1], params: match[2] }
}

export async function executeAction(action: Action): Promise<string> {
  switch (action.type) {
    case 'OPEN_APP': return actions.openApp(action.params)
    case 'READ_FILE': return actions.readFile(action.params)
    case 'CHECK_ENV': {
      const [filePath, key] = action.params.split(',')
      return actions.checkEnv(filePath.trim(), key.trim())
    }
    case 'RUN_CMD': return actions.runTerminal(action.params)
    case 'WEB_SEARCH': return actions.webSearch(action.params)
    // etc.
  }
}
```

**Step 19 — Developer Commands**

Special handling for developer-specific commands:

```typescript
// "Esi, open Claude Code for [project]"
if (command.match(/open claude code/i)) {
  const projectPath = extractProjectPath(command, projectMemory)
  exec(`open -a Terminal`)
  exec(`osascript -e 'tell app "Terminal" to do script "cd ${projectPath} && claude"'`)
}

// "Esi, check if the .env has [KEY]"
if (command.match(/check.*\.env.*has/i)) {
  const key = extractEnvKey(command)
  const envPath = `${currentProjectPath}/.env`
  const result = actions.checkEnv(envPath, key)
  speak(result)
}

// "Esi, what changed in the last commit?"
if (command.match(/last commit/i)) {
  const diff = await exec('git log -1 --stat && git diff HEAD~1 --name-only')
  const summary = await gemini.reason(`Summarize these git changes briefly:\n${diff}`, '')
  speak(summary)
}
```

-----

### PHASE 4 — MEETING INTELLIGENCE

**Step 20 — Meeting Detector**

```typescript
const MEETING_APPS = ['zoom.us', 'Google Meet', 'Microsoft Teams', 'Slack', 'FaceTime', 'Discord']

// Poll active app every 5 seconds
// When meeting app detected and wasn't before → trigger meeting start
// When meeting app closes → trigger meeting end
```

**Step 21 — Audio Capture with BlackHole**

Provide setup instructions in README:

1. Install BlackHole: `brew install blackhole-2ch`
1. In macOS Audio MIDI Setup: create Multi-Output Device (speakers + BlackHole)
1. Set as system output

```typescript
// Record from BlackHole input (captures system audio = meeting audio)
export function startMeetingCapture(): void {
  // node-record-lpcm16 with BlackHole as input device
  // Write chunks to rolling buffer
  // Every 30s, send to Whisper for transcription
  // Append to meeting transcript
}
```

**Step 22 — Post-Meeting Pipeline**

```typescript
export async function processMeeting(transcript: string, duration: number): Promise<MeetingResult> {
  const prompt = `
You are analyzing a meeting transcript. Extract:
1. SUMMARY: 3-4 sentence overview of what was discussed
2. DECISIONS: Bullet list of decisions made
3. ACTION_ITEMS: Each item with owner name and due date if mentioned
4. OPEN_QUESTIONS: Things left unresolved
5. FOLLOW_UP_EMAIL: A professional follow-up email draft

Transcript:
${transcript}
  `
  const result = await gemini.reason(prompt, '')
  // Parse structured output
  // Save to SQLite meetings table
  // Add action items to tasks table
  // Create follow-up email draft via Mail.app AppleScript
  return parseMeetingResult(result)
}
```

-----

### PHASE 5 — PROACTIVE INTELLIGENCE & POLISH

**Step 23 — Proactive Monitor (electron/modules/proactive.ts)**

```typescript
// Run on interval — checks various conditions and speaks up when needed
export function startProactiveMonitor(): void {
  setInterval(async () => {
    const now = new Date()
    
    // Pre-meeting brief (2 mins before)
    const nextEvent = await getNextEvent()
    if (nextEvent && minutesUntil(nextEvent.start) === 2) {
      const brief = await buildPreMeetingBrief(nextEvent)
      speak(brief)
    }
    
    // Morning briefing (first command of day or 8am)
    if (isFirstInteractionOfDay()) {
      deliverMorningBrief()
    }
    
    // Overdue task check
    const overdueTasks = await getOverdueTasks()
    if (overdueTasks.length > 0 && !alreadyAlertedToday('overdue')) {
      speak(`You have ${overdueTasks.length} overdue tasks. Want a summary?`)
    }
    
    // Long coding session
    if (await getContinuousCodingMinutes() > 90 && !alreadyAlertedThisSession('break')) {
      speak("You've been coding for 90 minutes. Consider a short break.")
    }
    
  }, 60 * 1000) // check every minute
}
```

**Step 24 — HUD Final Polish**

- Framer Motion: staggered panel entrance on app load (panels slide in one by one)
- Voice waveform: real Web Audio API analyser, not fake bars
- Active Task panel: step-by-step animation when Esi is executing multi-step tasks
- Scan line effect on HUD (subtle CSS animation — thin horizontal line drifting down at very low opacity)
- Panel glow intensifies when that panel's data is actively updating
- Smooth transition animation between fullscreen and sidebar modes
- Cursor changes to crosshair over click-through zones

**Step 25 — Settings & Configuration**

Create a settings panel accessible via "Esi, open settings" or gear icon:

- Voice selection (list available macOS voices)
- Ollama vs Gemini threshold (adjust what goes to which)
- Wake sensitivity
- Proactive alerts toggle (each type individually)
- Meeting intelligence toggle
- "Go offline" toggle (forces 100% local)
- Gemini API key input
- Memory browser (view/delete stored memories)

**Step 26 — .env setup**

```env
GEMINI_API_KEY=your_key_here
PICOVOICE_ACCESS_KEY=your_key_here
OLLAMA_HOST=http://localhost:11434
WHISPER_MODEL=base.en
ESI_VOICE=Zoe
ESI_DEFAULT_MODE=fullscreen
```

-----

## FIRST RUN CHECKLIST

Before running Esi for the first time:

- [ ] Install Ollama: `brew install ollama` then `ollama pull llama3.1:8b`
- [ ] Install whisper.cpp: `brew install whisper-cpp`
- [ ] Install BlackHole: `brew install blackhole-2ch`
- [ ] Configure BlackHole Multi-Output Device in Audio MIDI Setup
- [ ] Get Picovoice API key (free at picovoice.ai) — needed for custom wake word
- [ ] Train custom "Hey Esi" wake word at console.picovoice.ai
- [ ] Get Gemini API key at aistudio.google.com (free tier available)
- [ ] Copy `.env.example` to `.env` and fill in keys
- [ ] Run `bun install`
- [ ] Run `bun dev` to start in development mode
- [ ] Say "Hey Esi" and confirm wake word fires
- [ ] Say "Esi, what time is it?" — should respond with voice + text

-----

## KNOWN CONSTRAINTS & NOTES

- **macOS permissions required:** Microphone, Accessibility (for AppleScript app control), Screen Recording (for screenshot), Contacts (optional, for email). Electron will trigger system permission dialogs on first use of each.
- **Apple Silicon performance:** Llama 3.1 8B via Ollama runs at ~30-50 tokens/sec on M2/M3. Fast enough for real-time conversation.
- **Whisper model size:** `base.en` is fast and accurate enough for clear speech. Use `small.en` for better accuracy at slightly slower speed.
- **BlackHole setup is manual** — user must configure the multi-output device once. Add clear setup instructions to onboarding screen.
- **Meeting transcription accuracy** depends on audio quality. Works best with a good microphone or headset.
- **Gemini API key** — store in `.env`, never commit to git. Add `.env` to `.gitignore` immediately.

-----

*Esi — Built by Randalf · Snowflakes Technologies*
