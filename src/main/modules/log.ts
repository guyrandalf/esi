import { get as getDb } from './db'

export interface LogEntry {
  id: number
  timestamp: string
  command: string
  response: string | null
  duration_ms: number | null
  app_context: string | null
  ok: number
}

export function logCommand(params: {
  command: string
  response: string
  duration_ms: number
  app_context?: string | null
  ok?: boolean
}): void {
  getDb()
    .prepare(
      `INSERT INTO command_log (timestamp, command, response, duration_ms, app_context, ok)
     VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      new Date().toISOString(),
      params.command,
      params.response,
      params.duration_ms,
      params.app_context ?? null,
      params.ok === false ? 0 : 1
    )
}

export function getRecentLog(limit = 10): LogEntry[] {
  return getDb()
    .prepare(
      `SELECT id, timestamp, command, response, duration_ms, app_context, ok
       FROM command_log
       ORDER BY id DESC
       LIMIT ?`
    )
    .all(limit) as LogEntry[]
}

/** Back-compat export; real init now lives in db.ts */
export function initLog(): void {
  // no-op — db.ts creates the table
}

export function closeLog(): void {
  // no-op — db.ts closes the connection
}
