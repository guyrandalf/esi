import {
  app,
  BrowserWindow,
  ipcMain,
  globalShortcut,
  screen,
  Tray,
  Menu,
  nativeImage,
  dialog
} from 'electron'
import { join } from 'path'
import {
  existsSync,
  mkdirSync,
  copyFileSync,
  createWriteStream,
  WriteStream
} from 'fs'
import { homedir } from 'os'
import { config as loadEnv } from 'dotenv'
import { electronApp, is } from '@electron-toolkit/utils'

// Packaged macOS apps inherit a sparse PATH (/usr/bin:/bin:/usr/sbin:/sbin).
// Tools we depend on (whisper-cli, ollama, ffmpeg) live in Homebrew prefixes.
// Prepend the common ones so spawn/execSync finds them.
const EXTRA_PATH = [
  '/opt/homebrew/bin',
  '/opt/homebrew/sbin',
  '/usr/local/bin',
  '/usr/local/sbin',
  `${homedir()}/.local/bin`
].join(':')
process.env.PATH = `${EXTRA_PATH}:${process.env.PATH ?? ''}`

// File logger — packaged GUI apps have no terminal, so console output is
// invisible. Mirror console.* to ~/Library/Logs/ESI/main.log and also keep
// printing to stdout for dev runs.
const LOG_DIR = join(homedir(), 'Library', 'Logs', 'Esi')
let logStream: WriteStream | null = null
try {
  mkdirSync(LOG_DIR, { recursive: true })
  logStream = createWriteStream(join(LOG_DIR, 'main.log'), { flags: 'a' })
  const ts = (): string => new Date().toISOString()
  const wrap =
    (orig: (...args: unknown[]) => void, tag: string) =>
    (...args: unknown[]): void => {
      const line = `[${ts()}] ${tag} ${args
        .map((a) => (typeof a === 'string' ? a : JSON.stringify(a)))
        .join(' ')}\n`
      try {
        logStream?.write(line)
      } catch {
        /* ignore */
      }
      orig.apply(console, args)
    }
  console.log = wrap(console.log, 'log ')
  console.warn = wrap(console.warn, 'warn')
  console.error = wrap(console.error, 'err ')
  console.log(`[esi] log file: ${join(LOG_DIR, 'main.log')}`)
  console.log(`[esi] PATH (first entries): ${(process.env.PATH ?? '').split(':').slice(0, 6).join(':')}`)
} catch (err) {
  // Non-fatal — logging just won't be captured.
}

// Load .env as early as possible so every downstream module can read
// process.env. Electron does NOT read .env by default.
//
// Search order: packaged-app user data path first (the only location
// a packaged build reliably controls), then dev-time project paths.
const USER_ENV_PATH = join(
  homedir(),
  'Library',
  'Application Support',
  'Esi',
  '.env'
)
for (const p of [
  USER_ENV_PATH,
  join(process.cwd(), '.env'),
  join(__dirname, '..', '..', '.env'),
  join(__dirname, '..', '..', '..', '.env')
]) {
  if (existsSync(p)) {
    loadEnv({ path: p })
    console.log(`[esi] loaded .env from ${p}`)
    break
  }
}
import * as voice from './modules/voice'
import * as system from './modules/system'
import * as calendar from './modules/calendar'
import * as ollama from './modules/ollama'
import * as project from './modules/project'
import * as router from './modules/router'
import * as actions from './modules/actions'
import * as parser from './modules/parser'
import * as proactive from './modules/proactive'
import * as meeting from './modules/meeting'
import * as memory from './modules/memory'
import * as metrics from './modules/metrics'
import * as semantic from './modules/semantic'
import * as voiceInput from './modules/voiceInput'
import * as wake from './modules/wake'
import * as wakeVad from './modules/wakeVad'
import * as whisper from './modules/whisper'
import * as gemini from './modules/gemini'
import * as db from './modules/db'
import * as autostart from './modules/autostart'
import { logCommand, getRecentLog } from './modules/log'
import { handleRemember, looksLikeRememberCommand } from './modules/remember'
import { buildSystemPromptAsync } from './modules/prompt'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false
let autoHideTimer: NodeJS.Timeout | null = null
// Auto-follow-up: set true when ESI's last response ended with "?" so
// we re-open the mic for ~8s after TTS finishes. Cleared on any hotkey
// press or after the follow-up capture kicks off.
let expectingFollowUp = false

function endsWithQuestion(s: string): boolean {
  return /[?]\s*$/.test(String(s).trim())
}

/** Menubar mode hides the HUD until summoned (wake word, tray, hotkey). */
function isMenubarMode(): boolean {
  const mode = (process.env.ESI_START_MODE || '').toLowerCase()
  if (mode === 'menubar') return true
  if (mode === 'window') return false
  // Default: menubar when packaged, window while developing.
  return app.isPackaged
}

function createWindow(options: { showOnReady: boolean }): void {
  const { width, height } = screen.getPrimaryDisplay().bounds
  mainWindow = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    show: false,
    frame: false,
    transparent: false,
    hasShadow: false,
    resizable: false,
    skipTaskbar: false,
    backgroundColor: '#03070d',
    simpleFullscreen: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.setSimpleFullScreen(true)

  mainWindow.on('ready-to-show', () => {
    if (options.showOnReady) {
      mainWindow?.show()
      mainWindow?.focus()
    }
  })

  // Close → hide (keeps the app running in the tray). Quit is explicit
  // via the tray menu or Cmd+Q with isQuitting flagged.
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

/**
 * Make the HUD visible, creating it on demand. Fades in over 250ms so
 * a wake-word summon doesn't feel jarring.
 */
function summonWindow(): void {
  if (!mainWindow) {
    createWindow({ showOnReady: true })
    // Window will show itself via ready-to-show; fade-in still happens.
  } else if (!mainWindow.isVisible()) {
    mainWindow.setOpacity(0)
    mainWindow.show()
    // Re-assert simpleFullScreen — hide() drops the state on macOS, so we
    // have to put it back every time we summon, otherwise the window
    // shows as a small windowed BrowserWindow instead of full HUD.
    if (!mainWindow.isSimpleFullScreen()) {
      mainWindow.setSimpleFullScreen(true)
    }
    mainWindow.focus()
  } else {
    mainWindow.focus()
  }
  // Ramp opacity 0 → 1
  const target = mainWindow ?? null
  if (!target) return
  const frames = 10
  const duration = 250
  let i = 0
  const interval = setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      clearInterval(interval)
      return
    }
    i++
    mainWindow.setOpacity(Math.min(1, i / frames))
    if (i >= frames) clearInterval(interval)
  }, duration / frames)
  cancelAutoHide()
}

function hideWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  // Quick fade-out so closing also feels intentional
  const frames = 6
  const duration = 120
  let i = 0
  const interval = setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      clearInterval(interval)
      return
    }
    i++
    mainWindow.setOpacity(Math.max(0, 1 - i / frames))
    if (i >= frames) {
      clearInterval(interval)
      mainWindow?.hide()
      mainWindow?.setOpacity(1)
    }
  }, duration / frames)
}

function scheduleAutoHide(): void {
  cancelAutoHide()
  if (!isMenubarMode()) return
  autoHideTimer = setTimeout(() => {
    if (mainWindow?.isVisible()) hideWindow()
  }, 30_000)
}

function cancelAutoHide(): void {
  if (autoHideTimer) {
    clearTimeout(autoHideTimer)
    autoHideTimer = null
  }
}

// ────────────────────────────────────────────────────────
// Tray
// ────────────────────────────────────────────────────────
function createTray(): void {
  if (tray) return
  // Load a template icon if present; otherwise fall back to resources/icon.png
  // scaled small. `isTemplate` lets macOS auto-tint for dark/light menu bars.
  const templatePath = join(__dirname, '..', '..', 'resources', 'trayTemplate.png')
  const fallbackPath = join(__dirname, '..', '..', 'resources', 'icon.png')
  const iconPath = existsSync(templatePath) ? templatePath : fallbackPath
  const image = nativeImage.createFromPath(iconPath).resize({ width: 18, height: 18 })
  image.setTemplateImage(existsSync(templatePath))
  tray = new Tray(image)
  tray.setToolTip('Esi')
  rebuildTrayMenu()
}

function rebuildTrayMenu(): void {
  if (!tray) return
  const wakeMuted = wakeVad.isMuted()
  const autostartOn = autostart.isInstalled()
  const menu = Menu.buildFromTemplate([
    {
      label: mainWindow?.isVisible() ? 'Hide Esi' : 'Open Esi',
      click: () => {
        if (mainWindow?.isVisible()) hideWindow()
        else summonWindow()
      }
    },
    { type: 'separator' },
    {
      label: wakeMuted ? 'Unmute wake word' : 'Mute wake word',
      click: () => {
        wakeVad.setMuted(!wakeMuted)
        rebuildTrayMenu()
      }
    },
    {
      label: 'Start Esi at login',
      type: 'checkbox',
      checked: autostartOn,
      enabled: app.isPackaged,
      click: async (item) => {
        try {
          if (item.checked) await autostart.install()
          else await autostart.uninstall()
        } catch (err) {
          console.warn('[esi] autostart toggle failed:', err)
        }
        rebuildTrayMenu()
      }
    },
    { type: 'separator' },
    {
      label: 'Quit Esi',
      click: () => {
        isQuitting = true
        app.quit()
      }
    }
  ])
  tray.setContextMenu(menu)
}

async function maybePromptFirstLaunchAutostart(): Promise<void> {
  if (!app.isPackaged) return
  if (autostart.isInstalled()) return
  if (autostart.wasPromptDismissed()) return
  const { response, checkboxChecked } = await dialog.showMessageBox({
    type: 'question',
    buttons: ['Yes, start at login', 'Not now'],
    defaultId: 0,
    cancelId: 1,
    title: 'Start Esi automatically?',
    message: 'Would you like Esi to start automatically when you log in?',
    detail:
      'Esi will run quietly in your menu bar and listen for "hey Esi" or 3 claps to summon the HUD. You can change this any time from the tray menu or Settings.',
    checkboxLabel: "Don't ask again"
  })
  if (response === 0) {
    try {
      await autostart.install()
      rebuildTrayMenu()
    } catch (err) {
      console.warn('[esi] first-launch autostart install failed:', err)
    }
  } else if (checkboxChecked) {
    // Stamp a marker so we don't pester them again even if they never install it
    autostart.markPromptDismissed?.()
  }
}

async function handleCommand(
  text: string
): Promise<{ ok: boolean; response: string; actionType?: string }> {
  const start = Date.now()
  const trimmed = text.trim()
  if (!trimmed) return { ok: false, response: '' }

  // Fast-path: "Remember that..." is handled locally (no LLM round-trip needed).
  if (looksLikeRememberCommand(trimmed)) {
    const response = await handleRemember(trimmed)
    logCommand({ command: trimmed, response, duration_ms: Date.now() - start, ok: true })
    expectingFollowUp = endsWithQuestion(response)
    voice.speak(response)
    mainWindow?.webContents.send('esi:log-updated')
    return { ok: true, response }
  }

  try {
    // Proactively refresh project context before building prompt
    await project.getProjectContext()

    const system = await buildSystemPromptAsync(trimmed)
    const { response: rawResponse } = await router.route(trimmed, system)

    const action = parser.parseAction(rawResponse)
    const displayText = parser.stripAction(rawResponse).trim()

    let finalResponse = displayText || rawResponse
    let actionType: string | undefined

    if (action) {
      actionType = action.type
      const result = await actions.execute(action.type, action.params, system)

      if (result.requiresFollowUp && result.followUpContext) {
        // Feed the action result back to the LLM for a natural follow-up reply
        const followPrompt = `${trimmed}

You emitted ${action.rawLine}. Here's the result:
${result.followUpContext}

Now answer Randalf's original question based on this result. Do NOT emit another action.`
        try {
          const { response: follow } = await router.route(followPrompt, system)
          finalResponse =
            parser.stripAction(follow).trim() || result.output
        } catch {
          finalResponse = result.output
        }
      } else if (result.ok) {
        // Action succeeded. Prefer LLM text if present; else use action output.
        finalResponse = displayText || result.output
      } else {
        // Action failed — always surface the error.
        finalResponse = displayText
          ? `${displayText} ${result.output}`
          : result.output
      }
    }

    logCommand({
      command: trimmed,
      response: finalResponse,
      duration_ms: Date.now() - start,
      ok: true
    })

    // Fire-and-forget: embed this exchange for future semantic recall
    semantic
      .remember(`${trimmed}\n→ ${finalResponse}`, { kind: 'exchange' })
      .catch(() => {
        /* noop */
      })

    expectingFollowUp = endsWithQuestion(finalResponse)
    voice.speak(finalResponse)
    mainWindow?.webContents.send('esi:log-updated')
    return { ok: true, response: finalResponse, actionType }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    const friendly =
      errMsg.includes('fetch failed') || errMsg.includes('ECONNREFUSED')
        ? "I can't reach Ollama. Is it running? Try `ollama serve` in a terminal."
        : `Something went wrong: ${errMsg}`
    logCommand({
      command: trimmed,
      response: friendly,
      duration_ms: Date.now() - start,
      ok: false
    })
    mainWindow?.webContents.send('esi:log-updated')
    return { ok: false, response: friendly }
  }
}

// -------- Voice-input coordination --------
// Wake word and press-to-talk share the microphone; swap who's holding it.

async function captureAndSubmit(trigger: 'wake' | 'hotkey'): Promise<void> {
  // Barge-in: if ESI is still talking, cut her off so we can hear the user.
  voice.cancelSpeech()
  // A fresh user capture supersedes any pending auto-follow-up trigger.
  expectingFollowUp = false
  // Stop any wake listener so it doesn't fight for the mic
  const porcupineWasOn = wake.isRunning()
  const vadWakeWasOn = wakeVad.isRunning()
  if (porcupineWasOn) wake.stop()
  if (vadWakeWasOn) wakeVad.stop()

  try {
    if (trigger === 'wake') {
      // No verbal "Yes?" — a false wake is silent now. The ArcReactor
      // flipping to LISTENING is the only cue, which is reversible.
      // Small gap before recording so the room settles.
      await new Promise((r) => setTimeout(r, 200))
    }

    // VAD-driven auto-stop: when the user goes silent after speaking,
    // flush the recording and run the same path as a manual stop.
    const started = await voiceInput.start(() => {
      stopHotkeyRecording().catch(() => {
        /* noop — already logged inside */
      })
    })
    if (!started) {
      // Important: tell the UI we failed so the mic button doesn't stay stuck.
      mainWindow?.webContents.send('esi:voice-state', 'idle')
      if (trigger === 'wake') voice.speak("Voice input isn't ready.")
      return
    }
    mainWindow?.webContents.send('esi:voice-state', 'recording')

    if (trigger === 'wake') {
      // For wake-word, VAD handles auto-stop; fall through and return.
      // The callback above will trigger stopHotkeyRecording when the user
      // goes silent, which handles transcription + handoff to handleCommand.
    }
    // For hotkey trigger, stop fires on either VAD auto-stop, a second
    // hotkey press, or the UI mic button — all of which route to
    // stopHotkeyRecording().
  } finally {
    if (porcupineWasOn) {
      wake.start(() => captureAndSubmit('wake')).valueOf()
    }
    if (vadWakeWasOn) {
      wakeVad.start(() => captureAndSubmit('wake')).catch(() => {
        /* noop */
      })
    }
  }
}

let stopInFlight: Promise<void> | null = null

async function stopHotkeyRecording(): Promise<void> {
  // Guard against double-stop (e.g. VAD fires and user clicks mic at the same time)
  if (stopInFlight) return stopInFlight
  stopInFlight = (async (): Promise<void> => {
    mainWindow?.webContents.send('esi:voice-state', 'transcribing')
    try {
      const text = await voiceInput.stop()
      if (text) {
        mainWindow?.webContents.send('esi:voice-heard', text)
        await handleCommand(text)
      }
    } finally {
      mainWindow?.webContents.send('esi:voice-state', 'idle')
      stopInFlight = null
    }
  })()
  return stopInFlight
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.guyrandalf.esi')
  db.init()

  // Ensure the user's config directory exists; DO NOT overwrite an
  // existing .env with the empty template (that silently wiped the user's
  // GEMINI_API_KEY in a prior version). If the file is missing, we leave
  // it for the user to create — the app falls back to defaults and shows
  // the missing subsystem in diagnostics.
  if (app.isPackaged) {
    try {
      mkdirSync(join(homedir(), 'Library', 'Application Support', 'Esi'), {
        recursive: true
      })
      if (!existsSync(USER_ENV_PATH)) {
        const bundledTemplate = [
          join(
            process.resourcesPath,
            'app.asar.unpacked',
            'resources',
            'env.template'
          ),
          join(process.resourcesPath, 'env.template')
        ].find((p) => existsSync(p))
        if (bundledTemplate) {
          copyFileSync(bundledTemplate, USER_ENV_PATH)
          console.log(
            `[esi] seeded empty user .env at ${USER_ENV_PATH} — user must fill in keys to enable Gemini / Picovoice`
          )
          loadEnv({ path: USER_ENV_PATH })
        }
      } else {
        console.log(
          `[esi] user .env already present at ${USER_ENV_PATH} — not overwriting`
        )
      }
    } catch (err) {
      console.warn('[esi] could not prepare user .env dir:', err)
    }
  }

  // Broadcast speaking state so the ArcReactor can light up while ESI talks.
  // Also handles two side effects on the 'idle' transition:
  //   1. Auto-hide (menubar mode) after 30s
  //   2. Smart follow-up: re-open the mic if ESI's last reply ended with "?"
  voice.setStateListener((state) => {
    mainWindow?.webContents.send('esi:voice-state', state)
    if (state !== 'idle') {
      cancelAutoHide()
      return
    }
    if (expectingFollowUp) {
      expectingFollowUp = false
      // Small gap so TTS audio has fully ended before we listen, otherwise
      // the tail of "?" could get captured as part of the user's reply.
      setTimeout(() => {
        captureAndSubmit('hotkey').catch(() => {
          /* noop */
        })
      }, 350)
      return
    }
    scheduleAutoHide()
  })

  // Semantic memory (optional — skips if `ollama pull nomic-embed-text` not done)
  semantic.init().catch(() => {
    /* noop */
  })

  // Start pollers
  system.startPolling(3000)
  calendar.primeCache()
  proactive.start(60_000)
  meeting.start(5_000)

  // Wake word — prefer Porcupine when a PICOVOICE key is configured
  // (lowest CPU); otherwise fall back to our Whisper+VAD implementation
  // which needs no API key. Can be forced via ESI_WAKE=porcupine|vad|off.
  const wakeMode = (process.env.ESI_WAKE || '').toLowerCase()
  const pickPorcupine = wakeMode === 'porcupine' || (!wakeMode && wake.isConfigured())
  const pickVad = wakeMode === 'vad' || (!wakeMode && !wake.isConfigured() && wakeVad.isConfigured())

  // Summon-on-wake: in menubar mode the HUD is hidden until the user
  // calls ESI. Both wake backends route through this so the UX is identical.
  const onWakeFired = (): void => {
    if (isMenubarMode()) summonWindow()
    captureAndSubmit('wake').catch(() => {
      /* noop */
    })
  }

  // Diagnostics — log everything that matters so the user can see why
  // wake word may not be firing.
  try {
    console.log(
      `[esi] startup diagnostics: whisper.isAvailable=${whisper.isAvailable()}, wake.isConfigured=${wake.isConfigured()}, wakeVad.isConfigured=${wakeVad.isConfigured()}, voice=${process.env.ESI_VOICE ?? '(default)'}, whisperModel=${process.env.WHISPER_MODEL ?? '(default base.en)'}, startMode=${isMenubarMode() ? 'menubar' : 'window'}`
    )
  } catch {
    /* noop */
  }

  if (pickPorcupine && wake.isConfigured()) {
    console.log('[esi] wake backend: porcupine')
    wake.start(onWakeFired)
  } else if (pickVad) {
    console.log('[esi] wake backend: vad+whisper')
    // Auto-mute wake detection during meetings so ESI doesn't trip on
    // meeting audio or mishearings from other speakers.
    wakeVad.setMeetingChecker(() => meeting.getActive() !== null)
    // Stream normalized mic level to the renderer so the ArcReactor can
    // react to real audio in real time. Throttled: every other frame.
    let tick = 0
    wakeVad.setLevelListener((level) => {
      if (++tick % 2 !== 0) return
      mainWindow?.webContents.send('esi:mic-level', level)
    })
    wakeVad.start(onWakeFired).catch(() => {
      /* noop — logged inside */
    })
  }

  // Refresh project context on a loose schedule
  setInterval(() => {
    project.getProjectContext().catch(() => {
      /* noop */
    })
  }, 8_000)

  ollama.isAvailable().then((ok) => {
    if (!ok) {
      console.warn(
        '[esi] Ollama not reachable. Start it with `ollama serve` and `ollama pull llama3.1:8b`.'
      )
    }
  })

  globalShortcut.register('CommandOrControl+Shift+.', () => voice.cancelSpeech())

  // Press-to-talk: toggle recording. First press starts; second press transcribes + submits.
  globalShortcut.register('CommandOrControl+Shift+Space', () => {
    if (voiceInput.isCapturing()) {
      stopHotkeyRecording().catch(() => {
        /* noop */
      })
    } else {
      captureAndSubmit('hotkey').catch(() => {
        /* noop */
      })
    }
  })

  // --- Core IPC ---
  ipcMain.handle('esi:command', (_e, text: string) => handleCommand(text))
  ipcMain.handle('esi:get-log', (_e, limit?: number) => getRecentLog(limit ?? 10))
  ipcMain.handle('esi:stop-speaking', () => voice.cancelSpeech())

  // --- Context IPC ---
  ipcMain.handle('esi:get-calendar', () => calendar.getUpcomingEvents())
  ipcMain.handle('esi:get-system', () => system.getCurrent())
  ipcMain.handle('esi:get-project', () => project.getCached())
  ipcMain.handle('esi:get-memory', () => memory.snapshot())
  ipcMain.handle('esi:get-metrics', () => metrics.snapshot())

  // --- Meeting IPC ---
  ipcMain.handle('esi:get-active-meeting', () => meeting.getActive())

  // --- Status / readiness ---
  ipcMain.handle('esi:get-status', async () => {
    const [ollamaOk, semReady] = await Promise.all([
      ollama.isAvailable(),
      Promise.resolve(semantic.isReady())
    ])
    return {
      ollama: ollamaOk,
      gemini: gemini.isConfigured(),
      whisper: whisper.isAvailable(),
      semantic: semReady,
      // Wake word is "on" if either backend is actually running
      wakeWord: wake.isRunning() || wakeVad.isRunning(),
      voiceInput: voiceInput.isAvailable(),
      voiceCapturing: voiceInput.isCapturing()
    }
  })

  // --- Voice control ---
  ipcMain.handle('esi:start-voice', () => captureAndSubmit('hotkey'))
  ipcMain.handle('esi:stop-voice', () => stopHotkeyRecording())

  // --- Memory management ---
  ipcMain.handle('esi:delete-person', (_e, name: string) => memory.deletePerson(name))
  ipcMain.handle('esi:set-preference', (_e, key: string, value: string) =>
    memory.setPreference(key, value)
  )

  // --- Settings ---
  ipcMain.handle('esi:set-offline', (_e, offline: boolean) => {
    // Crude offline toggle: clear the API key from process env to force Ollama route
    if (offline) {
      delete process.env.GEMINI_API_KEY
    } else if (!process.env.GEMINI_API_KEY) {
      // nothing to restore — user needs to relaunch with .env set
    }
  })

  ipcMain.on('esi:set-ignore-mouse', (_e, ignore: boolean) => {
    mainWindow?.setIgnoreMouseEvents(ignore, { forward: true })
  })

  // Autostart IPC (for Settings toggle)
  ipcMain.handle('esi:autostart-status', () => ({
    installed: autostart.isInstalled(),
    currentBinary: autostart.isInstalledForCurrentBinary(),
    supported: app.isPackaged
  }))
  ipcMain.handle('esi:autostart-set', async (_e, enable: boolean) => {
    if (!app.isPackaged) return { ok: false, reason: 'unpackaged' }
    try {
      if (enable) await autostart.install()
      else await autostart.uninstall()
      rebuildTrayMenu()
      return { ok: true }
    } catch (err) {
      return {
        ok: false,
        reason: err instanceof Error ? err.message : String(err)
      }
    }
  })

  // Wire tray visibility updates so "Open ESI" / "Hide ESI" label flips
  const onVisibilityChange = (): void => rebuildTrayMenu()

  // Boot mode: headless (menu-bar-only) vs windowed
  if (isMenubarMode()) {
    createTray()
    // Create the window hidden so it's pre-warmed and summon is instant.
    createWindow({ showOnReady: false })
    mainWindow?.on('show', onVisibilityChange)
    mainWindow?.on('hide', onVisibilityChange)
    // Ask about autostart on first launch (packaged only)
    setTimeout(() => {
      maybePromptFirstLaunchAutostart().catch(() => {
        /* noop */
      })
    }, 2500)
  } else {
    createWindow({ showOnReady: true })
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow({ showOnReady: true })
    } else {
      summonWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  voice.cancelSpeech()
  proactive.stop()
  meeting.stop()
  wake.stop()
  wakeVad.stop()
  system.stopPolling()
  db.close()
})
