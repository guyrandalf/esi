import { contextBridge, ipcRenderer } from 'electron'

export interface LogEntry {
  id: number
  timestamp: string
  command: string
  response: string | null
  duration_ms: number | null
  app_context: string | null
  ok: number
}

const api = {
  sendCommand: (text: string): Promise<{ ok: boolean; response: string }> =>
    ipcRenderer.invoke('esi:command', text),
  getRecentLog: (limit?: number): Promise<LogEntry[]> =>
    ipcRenderer.invoke('esi:get-log', limit),
  stopSpeaking: (): Promise<void> => ipcRenderer.invoke('esi:stop-speaking'),
  setIgnoreMouse: (ignore: boolean): void => ipcRenderer.send('esi:set-ignore-mouse', ignore),
  onLogUpdated: (cb: () => void): (() => void) => {
    const handler = (): void => cb()
    ipcRenderer.on('esi:log-updated', handler)
    return () => {
      ipcRenderer.off('esi:log-updated', handler)
    }
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('esi', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.esi = api
}
