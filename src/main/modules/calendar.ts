import { runAppleScript } from './applescript'
import * as sqliteCal from './calendarSqlite'

export interface CalendarEvent {
  title: string
  startIso: string
  endIso: string
  calendar: string
  allDay: boolean
}

export interface CalendarState {
  events: CalendarEvent[]
  fetchedAt: number
  hasEverSucceeded: boolean
  inCooldown: boolean
  lastError: string | null
}

// JXA is meaningfully faster than AppleScript for Calendar.app — the `whose`
// clause filter in AS forces a full scan per calendar, whereas JXA can page
// the same events via Calendar's JS bridge.
// Fallback JXA script — only runs when the SQLite direct-read path fails
// (typically because Full Disk Access isn't granted). Narrow to today-only
// and early-exit at MAX_EVENTS to keep runtime bounded on busy calendars.
const SCRIPT = `
  const Calendar = Application('Calendar')
  if (!Calendar.running()) {
    Calendar.launch()
    delay(0.5)
  }
  const now = new Date()
  const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
  const endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000)
  const out = []
  const calendars = Calendar.calendars()
  const MAX_EVENTS = 40
  outer: for (let i = 0; i < calendars.length; i++) {
    const cal = calendars[i]
    let name
    try { name = cal.title() } catch (_) { continue }
    let events
    try {
      events = cal.events.whose({
        _and: [
          { startDate: { _greaterThanEquals: startDate } },
          { startDate: { _lessThan: endDate } }
        ]
      })()
    } catch (_) { continue }
    for (let j = 0; j < events.length; j++) {
      if (out.length >= MAX_EVENTS) break outer
      const e = events[j]
      try {
        const start = e.startDate()
        const end = e.endDate()
        const summary = e.summary() || ''
        const allDay = !!e.alldayEvent()
        out.push([summary, start.toISOString(), end.toISOString(), name, allDay ? 'true' : 'false'].join('\\t'))
      } catch (_) { /* skip broken event */ }
    }
  }
  out.join('\\n')
`.trim()

const CACHE_TTL_MS = 3 * 60 * 1000 // 3 min — fresh-enough window
const APPLESCRIPT_TIMEOUT_MS = 25_000 // bumped — JXA cold-start is ~2-5s on busy accounts
const COOLDOWN_BASE_MS = 60 * 1000 // 60s — retry reasonably soon after a failure
const COOLDOWN_MAX_MS = 15 * 60 * 1000 // 15 min cap

let cache: CalendarEvent[] = []
let fetchedAt = 0
let hasEverSucceeded = false
let lastError: string | null = null
let consecutiveFailures = 0
let nextAllowedFetch = 0
let inFlight: Promise<void> | null = null

function parseOutput(stdout: string): CalendarEvent[] {
  const events: CalendarEvent[] = []
  for (const raw of stdout.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const parts = line.split('\t')
    if (parts.length < 4) continue
    const [title, startStr, endStr, calName, allDayStr] = parts
    const start = new Date(startStr)
    const end = new Date(endStr)
    if (isNaN(start.getTime()) || isNaN(end.getTime())) continue
    events.push({
      title: title.trim(),
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      calendar: (calName || '').trim(),
      allDay: (allDayStr || '').trim().toLowerCase() === 'true'
    })
  }
  return events.sort((a, b) => a.startIso.localeCompare(b.startIso))
}

async function runRefresh(): Promise<void> {
  // Fast path: read Calendar.app's SQLite store directly. This only works
  // if Electron / the hosting dev terminal has Full Disk Access granted.
  // When it works it's ~50ms instead of 20+s.
  if (sqliteCal.isAvailable()) {
    try {
      const events = sqliteCal.readTodaysEvents()
      cache = events
      fetchedAt = Date.now()
      hasEverSucceeded = true
      lastError = null
      consecutiveFailures = 0
      nextAllowedFetch = 0
      inFlight = null
      console.log(`[esi] calendar read via SQLite: ${events.length} events today`)
      return
    } catch (err) {
      // Typically EPERM — Full Disk Access not granted. Fall through to
      // AppleScript path, but record the reason so the UI can be helpful.
      console.warn(
        `[esi] calendar SQLite read failed — falling back to AppleScript: ${err instanceof Error ? err.message : err}`
      )
    }
  }

  try {
    const stdout = await runAppleScript(SCRIPT, APPLESCRIPT_TIMEOUT_MS, 'JavaScript')
    cache = parseOutput(stdout)
    fetchedAt = Date.now()
    hasEverSucceeded = true
    lastError = null
    consecutiveFailures = 0
    nextAllowedFetch = 0
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    lastError = msg
    consecutiveFailures++
    const cooldown = Math.min(
      COOLDOWN_BASE_MS * Math.pow(2, consecutiveFailures - 1),
      COOLDOWN_MAX_MS
    )
    nextAllowedFetch = Date.now() + cooldown
    console.warn(
      `[esi] calendar read failed (${consecutiveFailures}x): ${msg}. Backing off ${Math.round(cooldown / 60000)}min.`
    )
  } finally {
    inFlight = null
  }
}

/**
 * Fire-and-forget. Triggers a background refresh if cache is stale
 * and we're not in cooldown. Never blocks the caller.
 */
export function triggerRefresh(): void {
  if (inFlight) return
  const now = Date.now()
  if (now < nextAllowedFetch) return
  if (hasEverSucceeded && now - fetchedAt < CACHE_TTL_MS) return
  inFlight = runRefresh()
}

/**
 * Synchronous snapshot of the current state. Returns whatever is in cache
 * plus metadata so callers can tell "no events" apart from "couldn't read".
 */
export function getState(): CalendarState {
  return {
    events: cache,
    fetchedAt,
    hasEverSucceeded,
    inCooldown: Date.now() < nextAllowedFetch,
    lastError
  }
}

/** For IPC handlers — returns events, kicks off background refresh if stale. */
export function getUpcomingEvents(): CalendarEvent[] {
  triggerRefresh()
  return cache
}

export function primeCache(): void {
  triggerRefresh()
}
