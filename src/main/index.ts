import { app, BrowserWindow, ipcMain, globalShortcut, screen } from 'electron'
import { join } from 'path'
import { electronApp, is } from '@electron-toolkit/utils'

let mainWindow: BrowserWindow | null = null
let hudMode: 'fullscreen' | 'sidebar' = 'fullscreen'

function createWindow(): void {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  mainWindow = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    fullscreenable: false,
    roundedCorners: false,
    backgroundColor: '#00000000',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.setAlwaysOnTop(true, 'screen-saver')
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  mainWindow.setIgnoreMouseEvents(true, { forward: true })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
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

function toggleMode(): 'fullscreen' | 'sidebar' {
  if (!mainWindow) return hudMode
  hudMode = hudMode === 'fullscreen' ? 'sidebar' : 'fullscreen'
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  if (hudMode === 'sidebar') {
    const w = 340
    mainWindow.setBounds({ x: width - w, y: 0, width: w, height })
    mainWindow.setIgnoreMouseEvents(false)
  } else {
    mainWindow.setBounds({ x: 0, y: 0, width, height })
    mainWindow.setIgnoreMouseEvents(true, { forward: true })
  }
  mainWindow.webContents.send('esi:mode', hudMode)
  return hudMode
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.esi')

  globalShortcut.register('CommandOrControl+Shift+E', () => {
    toggleMode()
  })
  globalShortcut.register('CommandOrControl+Shift+Q', () => app.quit())

  ipcMain.handle('esi:toggle-mode', () => toggleMode())

  ipcMain.handle('esi:set-interactive', (_e, interactive: boolean) => {
    if (!mainWindow || hudMode === 'sidebar') return
    if (interactive) mainWindow.setIgnoreMouseEvents(false)
    else mainWindow.setIgnoreMouseEvents(true, { forward: true })
  })

  ipcMain.handle('esi:command', async (_e, text: string) => {
    return { ok: true, response: `Echo (stub): ${text}` }
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
})
