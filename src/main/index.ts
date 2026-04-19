import { app, BrowserWindow, ipcMain, globalShortcut } from 'electron'
import { join } from 'path'
import { electronApp, is } from '@electron-toolkit/utils'
import * as ollama from './modules/ollama'
import * as voice from './modules/voice'
import { initLog, logCommand, getRecentLog, closeLog } from './modules/log'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    fullscreen: true,
    transparent: true,
    frame: false,
    hasShadow: false,
    alwaysOnTop: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  // Set default state to ignore mouse events (allow click-through to apps underneath)
  mainWindow.setIgnoreMouseEvents(true, { forward: true })

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
): Promise<{ ok: boolean; response: string }> {
  const start = Date.now()
  const trimmed = text.trim()
  if (!trimmed) return { ok: false, response: '' }

  try {
    const response = await ollama.ask(trimmed)
    const duration = Date.now() - start
    logCommand({ command: trimmed, response, duration_ms: duration, ok: true })
    voice.speak(response)
    mainWindow?.webContents.send('esi:log-updated')
    return { ok: true, response }
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

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.esi')
  initLog()

  ollama.isAvailable().then((ok) => {
    if (!ok) {
      console.warn(
        '[esi] Ollama not reachable. Start it with `ollama serve` and `ollama pull llama3.1:8b`.'
      )
    }
  })

  globalShortcut.register('CommandOrControl+Shift+.', () => voice.cancelSpeech())

  ipcMain.handle('esi:command', (_e, text: string) => handleCommand(text))
  ipcMain.handle('esi:get-log', (_e, limit?: number) => getRecentLog(limit ?? 10))
  ipcMain.handle('esi:stop-speaking', () => voice.cancelSpeech())
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
  closeLog()
})
