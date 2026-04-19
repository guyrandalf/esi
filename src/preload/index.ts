import { contextBridge, ipcRenderer } from 'electron'

const api = {
  sendCommand: (text: string): Promise<{ ok: boolean; response: string }> =>
    ipcRenderer.invoke('esi:command', text),
  toggleMode: (): Promise<'fullscreen' | 'sidebar'> =>
    ipcRenderer.invoke('esi:toggle-mode'),
  setInteractive: (interactive: boolean): Promise<void> =>
    ipcRenderer.invoke('esi:set-interactive', interactive),
  onMode: (cb: (mode: 'fullscreen' | 'sidebar') => void): (() => void) => {
    const handler = (_e: unknown, mode: 'fullscreen' | 'sidebar'): void => cb(mode)
    ipcRenderer.on('esi:mode', handler)
    return () => {
      ipcRenderer.off('esi:mode', handler)
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
