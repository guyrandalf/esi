import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'

let db: Database.Database | null = null

export interface LogEntry {
  id: number
  timestamp: string
  command: string
  response: string | null
  duration_ms: number | null
  app_context: string | null
  ok: number
}

export function initLog(): void {
  const dbPath = join(app.getPath('userData'), 'esi.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS command_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      command TEXT NOT NULL,
      response TEXT,
      duration_ms INTEGER,
      app_context TEXT,
      ok INTEGER DEFAULT 1
    );
    CREATE INDEX IF NOT EXISTS idx_command_log_timestamp
      ON command_log(timestamp DESC);
  `)
}

export function logCommand(params: {
  command: string
  response: string
  duration_ms: number
  app_context?: string | null
  ok?: boolean
}): void {
  if (!db) return
  db.prepare(
    `INSERT INTO command_log (timestamp, command, response, duration_ms, app_context, ok)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    new Date().toISOString(),
    params.command,
    params.response,
    params.duration_ms,
    params.app_context ?? null,
    params.ok === false ? 0 : 1
  )
}

export function getRecentLog(limit = 10): LogEntry[] {
  if (!db) return []
  return db
    .prepare(
      `SELECT id, timestamp, command, response, duration_ms, app_context, ok
       FROM command_log
       ORDER BY id DESC
       LIMIT ?`
    )
    .all(limit) as LogEntry[]
}

export function closeLog(): void {
  db?.close()
  db = null
}
