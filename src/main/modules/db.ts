import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'

let db: Database.Database | null = null

const SCHEMA = `
CREATE TABLE IF NOT EXISTS command_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  command TEXT NOT NULL,
  response TEXT,
  duration_ms INTEGER,
  app_context TEXT,
  ok INTEGER DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_command_log_timestamp ON command_log(timestamp DESC);

CREATE TABLE IF NOT EXISTS people (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  context TEXT,
  last_mentioned TEXT
);

CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  path TEXT,
  stack TEXT,
  notes TEXT,
  last_active TEXT
);

CREATE TABLE IF NOT EXISTS preferences (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  description TEXT NOT NULL,
  source TEXT,
  meeting_id INTEGER,
  due_date TEXT,
  completed INTEGER DEFAULT 0,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS meetings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  app TEXT,
  duration_minutes INTEGER,
  transcript TEXT,
  summary TEXT,
  action_items TEXT,
  follow_up_draft TEXT
);

CREATE TABLE IF NOT EXISTS alerts_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  ref TEXT,
  fired_at TEXT NOT NULL
);
`

export function init(): Database.Database {
  if (db) return db
  const dbPath = join(app.getPath('userData'), 'esi.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.exec(SCHEMA)
  return db
}

export function get(): Database.Database {
  if (!db) throw new Error('Database not initialized. Call db.init() first.')
  return db
}

export function close(): void {
  db?.close()
  db = null
}
