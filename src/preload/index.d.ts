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

  interface EsiCalendarEvent {
    title: string
    startIso: string
    endIso: string
    calendar: string
    allDay: boolean
  }

  interface EsiSystemSnapshot {
    activeApp: string | null
    windowTitle: string | null
    previousApp: string | null
    previousWindowTitle: string | null
    updatedAt: number
  }

  interface EsiProjectContext {
    name: string
    path: string
    stack: string[]
    recentCommits: string[]
    hasEnv: boolean
    envKeys: string[]
  }

  interface EsiMemorySnapshot {
    people: Array<{ id: number; name: string; context: string | null; last_mentioned: string | null }>
    projects: Array<{ id: number; name: string; path: string | null; stack: string | null; notes: string | null; last_active: string | null }>
    preferences: Array<{ key: string; value: string; updated_at: string }>
    tasks: Array<{ id: number; description: string; source: string | null; meeting_id: number | null; due_date: string | null; completed: number; created_at: string }>
  }

  interface EsiActiveMeeting {
    app: string
    startedAt: number
    transcript: string
  }

  interface EsiMetricsSnapshot {
    cpuPercent: number
    memPercentUsed: number
    memUsedGb: number
    memTotalGb: number
    uptimeMinutes: number
    loadAvg1: number
    latencyMs: number[]
    latencyAvg: number
    commandsPerHour: number[]
    commandsToday: number
    errorRatePct: number
    totalCommands: number
  }

  interface EsiSubsystemStatus {
    ollama: boolean
    gemini: boolean
    whisper: boolean
    semantic: boolean
    wakeWord: boolean
    voiceInput: boolean
    voiceCapturing: boolean
  }

  interface Window {
    esi: {
      sendCommand: (text: string) => Promise<{ ok: boolean; response: string; actionType?: string }>
      getRecentLog: (limit?: number) => Promise<EsiLogEntry[]>
      stopSpeaking: () => Promise<void>
      getCalendar: () => Promise<EsiCalendarEvent[]>
      getSystem: () => Promise<EsiSystemSnapshot>
      getProject: () => Promise<EsiProjectContext | null>
      getMemory: () => Promise<EsiMemorySnapshot>
      getMetrics: () => Promise<EsiMetricsSnapshot>
      getActiveMeeting: () => Promise<EsiActiveMeeting | null>
      getStatus: () => Promise<EsiSubsystemStatus>
      startVoice: () => Promise<void>
      stopVoice: () => Promise<void>
      setOffline: (offline: boolean) => Promise<void>
      getAutostartStatus: () => Promise<{
        installed: boolean
        currentBinary: boolean
        supported: boolean
      }>
      setAutostart: (enable: boolean) => Promise<{ ok: boolean; reason?: string }>
      deletePerson: (name: string) => Promise<void>
      setPreference: (key: string, value: string) => Promise<void>
      setIgnoreMouse: (ignore: boolean) => void
      onLogUpdated: (cb: () => void) => () => void
      onProactive: (cb: (text: string) => void) => () => void
      onMeetingStart: (cb: (info: { app: string; startedAt: number }) => void) => () => void
      onMeetingTranscript: (cb: (text: string) => void) => () => void
      onMeetingEnd: (cb: (info: { app: string; durationMin: number; summary: string; transcript: string }) => void) => () => void
      onVoiceState: (cb: (state: 'idle' | 'recording' | 'transcribing' | 'speaking') => void) => () => void
      onVoiceHeard: (cb: (text: string) => void) => () => void
      onMicLevel: (cb: (level: number) => void) => () => void
    }
  }
}

export {}
