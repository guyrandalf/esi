/// <reference types="vite/client" />

interface Window {
  esi: {
    sendCommand: (text: string) => Promise<{ ok: boolean; response: string }>
    getRecentLog: (limit?: number) => Promise<any[]>
    stopSpeaking: () => Promise<void>
    setIgnoreMouse: (ignore: boolean) => void
    onLogUpdated: (cb: () => void) => () => void
  }
}
