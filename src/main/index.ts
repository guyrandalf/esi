import { app, BrowserWindow, ipcMain, globalShortcut } from 'electron'
import { join } from 'path'
import { electronApp, is } from '@electron-toolkit/utils'
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
import * as semantic from './modules/semantic'
import * as voiceInput from './modules/voiceInput'
import * as wake from './modules/wake'
import * as whisper from './modules/whisper'
import * as gemini from './modules/gemini'
import * as db from './modules/db'
import { logCommand, getRecentLog } from './modules/log'
import { handleRemember, looksLikeRememberCommand } from './modules/remember'
import { buildSystemPromptAsync } from './modules/prompt'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    fullscreen: true,
    frame: false,
    hasShadow: false,
    alwaysOnTop: false,
    show: false,
    backgroundColor: '#f3f5fa',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
    mainWindow?.focus()
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
  // Stop wake listener so it doesn't fight for the mic
  const wasListening = wake.isRunning()
  if (wasListening) wake.stop()

  try {
    if (trigger === 'wake') {
      voice.speak('Yes?')
      // Small gap before recording so the TTS doesn't get captured
      await new Promise((r) => setTimeout(r, 700))
    }

    const started = await voiceInput.start()
    if (!started) {
      if (trigger === 'wake') voice.speak("Voice input isn't ready.")
      return
    }
    mainWindow?.webContents.send('esi:voice-state', 'recording')

    if (trigger === 'wake') {
      // Auto-stop after ~6s for wake-triggered capture
      await new Promise((r) => setTimeout(r, 6000))
      const text = await voiceInput.stop()
      mainWindow?.webContents.send('esi:voice-state', 'idle')
      if (text) {
        mainWindow?.webContents.send('esi:voice-heard', text)
        await handleCommand(text)
      }
    }
    // For hotkey trigger, stop is handled by a second hotkey press
  } finally {
    if (wasListening) {
      wake.start(() => captureAndSubmit('wake')).valueOf()
    }
  }
}

async function stopHotkeyRecording(): Promise<void> {
  const text = await voiceInput.stop()
  mainWindow?.webContents.send('esi:voice-state', 'idle')
  if (text) {
    mainWindow?.webContents.send('esi:voice-heard', text)
    await handleCommand(text)
  }
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.esi')
  db.init()

  // Semantic memory (optional — skips if `ollama pull nomic-embed-text` not done)
  semantic.init().catch(() => {
    /* noop */
  })

  // Start pollers
  system.startPolling(3000)
  calendar.primeCache()
  proactive.start(60_000)
  meeting.start(5_000)

  // Wake word — only fires if PICOVOICE_ACCESS_KEY is set
  if (wake.isConfigured()) {
    wake.start(() => {
      captureAndSubmit('wake').catch(() => {
        /* noop */
      })
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
      wakeWord: wake.isConfigured(),
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

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
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
  system.stopPolling()
  db.close()
})
