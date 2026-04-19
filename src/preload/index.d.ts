declare global {
  interface EsiLogEntry {
    id: number
    timestamp: string
    command: string
    response: string | null
    duration_ms: number | null
    app_context: string | null
    ok: number
  }

  interface Window {
    esi: {
      sendCommand: (text: string) => Promise<{ ok: boolean; response: string }>
      getRecentLog: (limit?: number) => Promise<EsiLogEntry[]>
      stopSpeaking: () => Promise<void>
      onLogUpdated: (cb: () => void) => () => void
    }
  }
}

export {}
