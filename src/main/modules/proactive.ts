import { BrowserWindow, clipboard } from 'electron'
import notifier from 'node-notifier'
import { getState as getCalendarState, CalendarEvent } from './calendar'
import { getCurrent as getSystemSnapshot } from './system'
import { listOverdueTasks } from './memory'
import { speak } from './voice'
import { get as getDb } from './db'

let interval: NodeJS.Timeout | null = null
let firstTickDone = false

// --- Long coding session state ---
const CODE_APPS = new Set(['Code', 'Cursor', 'Windsurf', 'VSCodium', 'Zed'])
let codingStartedAt: number | null = null

// --- Clipboard URL state ---
let lastClipboardUrl: string | null = null

function alreadyFired(
  kind: string,
  ref: string,
  withinMs = 60 * 60 * 1000
): boolean {
  const since = new Date(Date.now() - withinMs).toISOString()
  const row = getDb()
    .prepare(
      `SELECT 1 FROM alerts_log WHERE kind = ? AND ref = ? AND fired_at > ? LIMIT 1`
    )
    .get(kind, ref, since)
  return !!row
}

function markFired(kind: string, ref: string): void {
  getDb()
    .prepare(`INSERT INTO alerts_log (kind, ref, fired_at) VALUES (?, ?, ?)`)
    .run(kind, ref, new Date().toISOString())
}

function notify(title: string, body: string): void {
  notifier.notify({
    title,
    message: body,
    sound: false,
    timeout: 6
  } as Parameters<typeof notifier.notify>[0])
}

function broadcast(text: string): void {
  for (const w of BrowserWindow.getAllWindows()) {
    w.webContents.send('esi:proactive', text)
  }
}

function formatEvent(e: CalendarEvent): string {
  const t = new Date(e.startIso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
  return `${e.title} at ${t}`
}

// --- Alerts ---

async function checkUpcomingMeeting(): Promise<void> {
  const cal = getCalendarState()
  if (!cal.hasEverSucceeded) return
  const now = Date.now()
  for (const e of cal.events) {
    const start = new Date(e.startIso).getTime()
    const mins = Math.round((start - now) / 60_000)
    if (mins === 2 && !alreadyFired('meeting-2', String(start))) {
      const msg = `${e.title} starts in 2 minutes.`
      notify('Heads up', msg)
      speak(`Heads up — ${msg}`)
      broadcast(msg)
      markFired('meeting-2', String(start))
      break
    }
  }
}

async function maybeMorningBrief(): Promise<void> {
  const now = new Date()
  const hour = now.getHours()
  if (hour < 7 || hour > 11) return
  const today = now.toISOString().slice(0, 10)
  if (alreadyFired('morning', today, 24 * 60 * 60 * 1000)) return

  const cal = getCalendarState()
  if (!cal.hasEverSucceeded) return
  const todaysEvents = cal.events.filter((e) => {
    const d = new Date(e.startIso)
    return d.toISOString().slice(0, 10) === today
  })

  const parts: string[] = []
  parts.push(
    `Good morning. Today is ${now.toLocaleDateString('en-US', { weekday: 'long' })}.`
  )
  if (todaysEvents.length === 0) {
    parts.push('Your calendar is clear.')
  } else {
    const first = todaysEvents[0]
    parts.push(
      `You have ${todaysEvents.length} event${todaysEvents.length === 1 ? '' : 's'}, starting with ${formatEvent(first)}.`
    )
  }
  const overdue = listOverdueTasks()
  if (overdue.length > 0) {
    parts.push(
      `${overdue.length} task${overdue.length === 1 ? '' : 's'} overdue.`
    )
  }

  const msg = parts.join(' ')
  speak(msg)
  broadcast(msg)
  markFired('morning', today)
}

async function checkOverdueTasks(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10)
  if (alreadyFired('overdue', today, 12 * 60 * 60 * 1000)) return
  const overdue = listOverdueTasks()
  if (overdue.length === 0) return
  const msg = `You have ${overdue.length} overdue task${overdue.length === 1 ? '' : 's'}. Want a summary?`
  notify('Overdue tasks', msg)
  broadcast(msg)
  markFired('overdue', today)
}

// --- Long coding session ---

async function checkLongCoding(): Promise<void> {
  const sys = getSystemSnapshot()
  const isCoding =
    (sys.activeApp && CODE_APPS.has(sys.activeApp)) ||
    (sys.previousApp && CODE_APPS.has(sys.previousApp))

  if (!isCoding) {
    codingStartedAt = null
    return
  }
  if (codingStartedAt === null) codingStartedAt = Date.now()

  const mins = Math.round((Date.now() - codingStartedAt) / 60_000)
  if (mins >= 90) {
    const ref = `session-${codingStartedAt}`
    if (!alreadyFired('break', ref, 4 * 60 * 60 * 1000)) {
      const msg = `You've been coding for ${mins} minutes. Consider a short break.`
      notify('Stretch break', msg)
      speak(msg)
      broadcast(msg)
      markFired('break', ref)
    }
  }
}

// --- Clipboard URL ---

const URL_RX = /^(https?:\/\/[^\s]+)$/i

async function checkClipboardUrl(): Promise<void> {
  let text = ''
  try {
    text = clipboard.readText()
  } catch {
    return
  }
  if (!text) return
  const trimmed = text.trim()
  if (!URL_RX.test(trimmed)) return
  if (trimmed === lastClipboardUrl) return
  lastClipboardUrl = trimmed

  if (alreadyFired('clip-url', trimmed, 24 * 60 * 60 * 1000)) return
  markFired('clip-url', trimmed)

  // Don't speak — just surface a notification so it isn't intrusive
  notify('URL copied', `${trimmed.slice(0, 80)} — ask Esi to summarize it.`)
  broadcast(`You copied a URL. Ask me to summarize it if useful.`)
}

// --- Tick ---

async function tick(): Promise<void> {
  try {
    await Promise.all([
      checkUpcomingMeeting(),
      maybeMorningBrief(),
      checkOverdueTasks(),
      checkLongCoding(),
      checkClipboardUrl()
    ])
  } catch {
    /* swallow */
  }
}

export function start(intervalMs = 60_000): void {
  if (interval) return
  setTimeout(() => {
    if (!firstTickDone) {
      firstTickDone = true
      tick()
    }
  }, 10_000)
  interval = setInterval(tick, intervalMs)
}

export function stop(): void {
  if (interval) {
    clearInterval(interval)
    interval = null
  }
}
