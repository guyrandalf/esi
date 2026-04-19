import { runAppleScript } from './applescript'

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

// Simpler script: launch Calendar if needed, narrow date window,
// tolerate failures per-calendar. Apple's bridge is still slow — we
// give it 30s and back off hard after repeated failures.
const SCRIPT = `
tell application "Calendar"
  if it is not running then
    launch
    delay 1
  end if
  set startDate to current date
  set hours of startDate to 0
  set minutes of startDate to 0
  set seconds of startDate to 0
  set endDate to startDate + (2 * days)
  set output to ""
  repeat with cal in calendars
    try
      set calName to title of cal
      set theEvents to (every event of cal whose start date is greater than or equal to startDate and start date is less than endDate)
      repeat with e in theEvents
        try
          set output to output & (summary of e) & tab & ((start date of e) as «class isot» as string) & tab & ((end date of e) as «class isot» as string) & tab & calName & tab & ((allday event of e) as string) & linefeed
        end try
      end repeat
    end try
  end repeat
  return output
end tell
`.trim()

const CACHE_TTL_MS = 3 * 60 * 1000 // 3 min — fresh-enough window
const APPLESCRIPT_TIMEOUT_MS = 30_000
const COOLDOWN_BASE_MS = 5 * 60 * 1000 // 5 min base
const COOLDOWN_MAX_MS = 30 * 60 * 1000 // 30 min max

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
  try {
    const stdout = await runAppleScript(SCRIPT, APPLESCRIPT_TIMEOUT_MS)
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
