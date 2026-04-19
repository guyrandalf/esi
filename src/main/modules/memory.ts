import { get as getDb } from './db'

export interface Person {
  id: number
  name: string
  context: string | null
  last_mentioned: string | null
}
export interface Project {
  id: number
  name: string
  path: string | null
  stack: string | null
  notes: string | null
  last_active: string | null
}
export interface Preference {
  key: string
  value: string
  updated_at: string
}
export interface Task {
  id: number
  description: string
  source: string | null
  meeting_id: number | null
  due_date: string | null
  completed: number
  created_at: string
}

// ---------- People ----------

export function upsertPerson(name: string, context: string): Person {
  const now = new Date().toISOString()
  getDb()
    .prepare(
      `INSERT INTO people (name, context, last_mentioned)
       VALUES (?, ?, ?)
       ON CONFLICT(name) DO UPDATE SET context=excluded.context, last_mentioned=excluded.last_mentioned`
    )
    .run(name, context, now)
  return getPerson(name)!
}
export function getPerson(name: string): Person | null {
  return (getDb()
    .prepare('SELECT * FROM people WHERE name = ?')
    .get(name) as Person | undefined) ?? null
}
export function listPeople(limit = 20): Person[] {
  return getDb()
    .prepare('SELECT * FROM people ORDER BY last_mentioned DESC LIMIT ?')
    .all(limit) as Person[]
}
export function deletePerson(name: string): void {
  getDb().prepare('DELETE FROM people WHERE name = ?').run(name)
}

// ---------- Projects ----------

export function upsertProject(
  name: string,
  fields: Partial<Omit<Project, 'id' | 'name'>>
): Project {
  const now = new Date().toISOString()
  const existing = getProject(name)
  if (existing) {
    getDb()
      .prepare(
        `UPDATE projects SET
           path = COALESCE(?, path),
           stack = COALESCE(?, stack),
           notes = COALESCE(?, notes),
           last_active = ?
         WHERE name = ?`
      )
      .run(
        fields.path ?? null,
        fields.stack ?? null,
        fields.notes ?? null,
        now,
        name
      )
  } else {
    getDb()
      .prepare(
        `INSERT INTO projects (name, path, stack, notes, last_active)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        name,
        fields.path ?? null,
        fields.stack ?? null,
        fields.notes ?? null,
        now
      )
  }
  return getProject(name)!
}
export function getProject(name: string): Project | null {
  return (getDb()
    .prepare('SELECT * FROM projects WHERE name = ?')
    .get(name) as Project | undefined) ?? null
}
export function listProjects(limit = 20): Project[] {
  return getDb()
    .prepare('SELECT * FROM projects ORDER BY last_active DESC LIMIT ?')
    .all(limit) as Project[]
}

// ---------- Preferences ----------

export function setPreference(key: string, value: string): void {
  getDb()
    .prepare(
      `INSERT INTO preferences (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
    .run(key, value, new Date().toISOString())
}
export function getPreference(key: string): string | null {
  const row = getDb()
    .prepare('SELECT value FROM preferences WHERE key = ?')
    .get(key) as { value: string } | undefined
  return row?.value ?? null
}
export function listPreferences(): Preference[] {
  return getDb()
    .prepare('SELECT * FROM preferences ORDER BY updated_at DESC')
    .all() as Preference[]
}

// ---------- Tasks ----------

export function addTask(description: string, options: Partial<Task> = {}): Task {
  const now = new Date().toISOString()
  const res = getDb()
    .prepare(
      `INSERT INTO tasks (description, source, meeting_id, due_date, completed, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      description,
      options.source ?? 'manual',
      options.meeting_id ?? null,
      options.due_date ?? null,
      options.completed ?? 0,
      now
    )
  return getDb()
    .prepare('SELECT * FROM tasks WHERE id = ?')
    .get(res.lastInsertRowid) as Task
}
export function listOpenTasks(limit = 20): Task[] {
  return getDb()
    .prepare(
      `SELECT * FROM tasks WHERE completed = 0 ORDER BY created_at DESC LIMIT ?`
    )
    .all(limit) as Task[]
}
export function listOverdueTasks(): Task[] {
  const today = new Date().toISOString().slice(0, 10)
  return getDb()
    .prepare(
      `SELECT * FROM tasks WHERE completed = 0 AND due_date IS NOT NULL AND due_date < ? ORDER BY due_date ASC`
    )
    .all(today) as Task[]
}
export function completeTask(id: number): void {
  getDb().prepare('UPDATE tasks SET completed = 1 WHERE id = ?').run(id)
}

// ---------- Summary for context assembly ----------

export interface MemorySnapshot {
  people: Person[]
  projects: Project[]
  preferences: Preference[]
  tasks: Task[]
}

export function snapshot(): MemorySnapshot {
  return {
    people: listPeople(8),
    projects: listProjects(4),
    preferences: listPreferences(),
    tasks: listOpenTasks(6)
  }
}
