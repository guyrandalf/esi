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

export interface CalendarEvent {
  title: string
  startIso: string
  endIso: string
  calendar: string
  allDay: boolean
}

export interface SystemSnapshot {
  activeApp: string | null
  windowTitle: string | null
  previousApp: string | null
  previousWindowTitle: string | null
  updatedAt: number
}

export interface ProjectContext {
  name: string
  path: string
  stack: string[]
  recentCommits: string[]
  hasEnv: boolean
  envKeys: string[]
}

export interface MemorySnapshot {
  people: Array<{ id: number; name: string; context: string | null; last_mentioned: string | null }>
  projects: Array<{ id: number; name: string; path: string | null; stack: string | null; notes: string | null; last_active: string | null }>
  preferences: Array<{ key: string; value: string; updated_at: string }>
  tasks: Array<{ id: number; description: string; source: string | null; meeting_id: number | null; due_date: string | null; completed: number; created_at: string }>
}

export interface ActiveMeeting {
  app: string
  startedAt: number
  transcript: string
}

export interface SubsystemStatus {
  ollama: boolean
  gemini: boolean
  whisper: boolean
  semantic: boolean
  wakeWord: boolean
  voiceInput: boolean
  voiceCapturing: boolean
}

const api = {
  sendCommand: (text: string): Promise<{ ok: boolean; response: string; actionType?: string }> =>
    ipcRenderer.invoke('esi:command', text),
  getRecentLog: (limit?: number): Promise<LogEntry[]> =>
    ipcRenderer.invoke('esi:get-log', limit),
  stopSpeaking: (): Promise<void> => ipcRenderer.invoke('esi:stop-speaking'),

  getCalendar: (): Promise<CalendarEvent[]> =>
    ipcRenderer.invoke('esi:get-calendar'),
  getSystem: (): Promise<SystemSnapshot> => ipcRenderer.invoke('esi:get-system'),
  getProject: (): Promise<ProjectContext | null> =>
    ipcRenderer.invoke('esi:get-project'),
  getMemory: (): Promise<MemorySnapshot> =>
    ipcRenderer.invoke('esi:get-memory'),
  getActiveMeeting: (): Promise<ActiveMeeting | null> =>
    ipcRenderer.invoke('esi:get-active-meeting'),
  getStatus: (): Promise<SubsystemStatus> =>
    ipcRenderer.invoke('esi:get-status'),

  startVoice: (): Promise<void> => ipcRenderer.invoke('esi:start-voice'),
  stopVoice: (): Promise<void> => ipcRenderer.invoke('esi:stop-voice'),

  setOffline: (offline: boolean): Promise<void> =>
    ipcRenderer.invoke('esi:set-offline', offline),
  deletePerson: (name: string): Promise<void> =>
    ipcRenderer.invoke('esi:delete-person', name),
  setPreference: (key: string, value: string): Promise<void> =>
    ipcRenderer.invoke('esi:set-preference', key, value),

  setIgnoreMouse: (ignore: boolean): void =>
    ipcRenderer.send('esi:set-ignore-mouse', ignore),

  onLogUpdated: (cb: () => void): (() => void) => {
    const h = (): void => cb()
    ipcRenderer.on('esi:log-updated', h)
    return () => ipcRenderer.off('esi:log-updated', h)
  },
  onProactive: (cb: (text: string) => void): (() => void) => {
    const h = (_e: unknown, text: string): void => cb(text)
    ipcRenderer.on('esi:proactive', h)
    return () => ipcRenderer.off('esi:proactive', h)
  },
  onMeetingStart: (cb: (info: { app: string; startedAt: number }) => void): (() => void) => {
    const h = (_e: unknown, info: { app: string; startedAt: number }): void => cb(info)
    ipcRenderer.on('esi:meeting-start', h)
    return () => ipcRenderer.off('esi:meeting-start', h)
  },
  onMeetingTranscript: (cb: (text: string) => void): (() => void) => {
    const h = (_e: unknown, text: string): void => cb(text)
    ipcRenderer.on('esi:meeting-transcript', h)
    return () => ipcRenderer.off('esi:meeting-transcript', h)
  },
  onMeetingEnd: (
    cb: (info: { app: string; durationMin: number; summary: string; transcript: string }) => void
  ): (() => void) => {
    const h = (_e: unknown, info: { app: string; durationMin: number; summary: string; transcript: string }): void => cb(info)
    ipcRenderer.on('esi:meeting-end', h)
    return () => ipcRenderer.off('esi:meeting-end', h)
  },
  onVoiceState: (cb: (state: 'idle' | 'recording' | 'transcribing') => void): (() => void) => {
    const h = (_e: unknown, s: 'idle' | 'recording' | 'transcribing'): void => cb(s)
    ipcRenderer.on('esi:voice-state', h)
    return () => ipcRenderer.off('esi:voice-state', h)
  },
  onVoiceHeard: (cb: (text: string) => void): (() => void) => {
    const h = (_e: unknown, text: string): void => cb(text)
    ipcRenderer.on('esi:voice-heard', h)
    return () => ipcRenderer.off('esi:voice-heard', h)
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
