/**
 * Direct SQLite reader for macOS Calendar.app.
 *
 * The scripting bridge (AppleScript / JXA) is notoriously slow on accounts
 * with a lot of calendar history — often >30s just to enumerate today's
 * events. Reading the SQLite store directly takes <50ms.
 *
 * Requirements:
 *  - Electron must have Full Disk Access (System Settings → Privacy &
 *    Security → Full Disk Access → +). In dev, the app hosting Electron
 *    (Terminal, iTerm, VS Code) needs it.
 *  - If access isn't granted, this throws; callers should fall back to
 *    the scripting-bridge implementation.
 */

import Database from 'better-sqlite3'
import { existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

export interface SqliteCalendarEvent {
  title: string
  startIso: string
  endIso: string
  calendar: string
  allDay: boolean
}

const CALENDAR_DB = join(homedir(), 'Library', 'Calendars', 'Calendar.sqlitedb')

// Apple stores timestamps as seconds since 2001-01-01 00:00:00 UTC.
const APPLE_EPOCH_OFFSET = 978307200

function appleTimeToDate(t: number): Date {
  return new Date((t + APPLE_EPOCH_OFFSET) * 1000)
}

export function isAvailable(): boolean {
  return existsSync(CALENDAR_DB)
}

export function readTodaysEvents(): SqliteCalendarEvent[] {
  if (!existsSync(CALENDAR_DB)) {
    throw new Error(`Calendar DB not found at ${CALENDAR_DB}`)
  }

  // Open read-only; Calendar.app keeps the file open, but SQLite is fine
  // with concurrent readers when WAL mode is used (and it is).
  const db = new Database(CALENDAR_DB, { readonly: true, fileMustExist: true })
  try {
    const now = new Date()
    const startJs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
    const endJs = new Date(startJs.getTime() + 24 * 60 * 60 * 1000)
    const startApple = startJs.getTime() / 1000 - APPLE_EPOCH_OFFSET
    const endApple = endJs.getTime() / 1000 - APPLE_EPOCH_OFFSET

    // The schema varies slightly across macOS versions. CalendarItem has:
    //   ROWID, summary, start_date, end_date, all_day, calendar_id
    // Calendar has:
    //   ROWID, title
    const rows = db
      .prepare(
        `SELECT
           ci.summary      AS title,
           ci.start_date   AS start_date,
           ci.end_date     AS end_date,
           ci.all_day      AS all_day,
           c.title         AS cal_name
         FROM CalendarItem ci
         LEFT JOIN Calendar c ON c.ROWID = ci.calendar_id
         WHERE ci.start_date IS NOT NULL
           AND ci.start_date >= ?
           AND ci.start_date < ?
         ORDER BY ci.start_date ASC
         LIMIT 40`
      )
      .all(startApple, endApple) as Array<{
      title: string | null
      start_date: number | null
      end_date: number | null
      all_day: number | null
      cal_name: string | null
    }>

    const out: SqliteCalendarEvent[] = []
    for (const r of rows) {
      if (r.start_date == null || r.end_date == null) continue
      out.push({
        title: (r.title ?? '').trim(),
        startIso: appleTimeToDate(r.start_date).toISOString(),
        endIso: appleTimeToDate(r.end_date).toISOString(),
        calendar: (r.cal_name ?? '').trim(),
        allDay: r.all_day === 1
      })
    }
    return out
  } finally {
    db.close()
  }
}
