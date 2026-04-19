import { existsSync, readFileSync, statSync } from 'fs'
import { dirname, join, basename } from 'path'
import { spawn } from 'child_process'
import { homedir } from 'os'
import { getCurrent as getSystem } from './system'

const EDITOR_APPS = new Set(['Code', 'Cursor', 'Windsurf', 'VSCodium', 'Zed'])

export interface ProjectContext {
  name: string
  path: string
  stack: string[]
  recentCommits: string[]
  hasEnv: boolean
  envKeys: string[]
}

let cache: ProjectContext | null = null
let cachedPath: string | null = null
let lastRefresh = 0
const CACHE_TTL_MS = 15_000

function findPackageJsonDir(startDir: string): string | null {
  let dir = startDir
  const root = '/'
  while (dir && dir !== root) {
    try {
      if (existsSync(join(dir, 'package.json'))) return dir
    } catch {
      /* noop */
    }
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return null
}

/** Extract a plausible file path from window titles like "App.tsx — esi" or "esi/src/main.ts" */
function guessPathFromTitle(title: string | null): string | null {
  if (!title) return null
  // VSCode default format: "filename — workspace" or "filename.ext - workspace"
  const parts = title.split(/\s+[-—]\s+/)
  if (parts.length < 2) return null
  const workspace = parts[parts.length - 1].trim()
  if (!workspace) return null

  // Common workspace locations
  const candidates = [
    join(homedir(), workspace),
    join(homedir(), 'Software', 'Snowflakes', workspace),
    join(homedir(), 'projects', workspace),
    join(homedir(), 'code', workspace),
    join(homedir(), 'work', workspace),
    join(homedir(), 'dev', workspace)
  ]
  for (const p of candidates) {
    try {
      if (existsSync(p) && statSync(p).isDirectory()) return p
    } catch {
      /* noop */
    }
  }
  return null
}

function readGitLog(cwd: string): Promise<string[]> {
  return new Promise((resolve) => {
    const proc = spawn('git', ['log', '--oneline', '-5'], { cwd, timeout: 2000 })
    let out = ''
    proc.stdout?.on('data', (d) => {
      out += d.toString()
    })
    proc.on('close', () => {
      resolve(out.split('\n').map((l) => l.trim()).filter(Boolean))
    })
    proc.on('error', () => resolve([]))
  })
}

function detectStack(projectDir: string): string[] {
  const stack: string[] = []
  try {
    const pkg = JSON.parse(
      readFileSync(join(projectDir, 'package.json'), 'utf-8')
    ) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }
    const all = { ...pkg.dependencies, ...pkg.devDependencies }
    const keys = Object.keys(all)
    if (keys.includes('react')) stack.push('React')
    if (keys.includes('next')) stack.push('Next.js')
    if (keys.includes('electron')) stack.push('Electron')
    if (keys.includes('expo')) stack.push('Expo')
    if (keys.includes('typescript')) stack.push('TypeScript')
    if (keys.includes('tailwindcss')) stack.push('Tailwind')
    if (keys.includes('vite')) stack.push('Vite')
  } catch {
    /* noop */
  }
  if (existsSync(join(projectDir, 'Cargo.toml'))) stack.push('Rust')
  if (existsSync(join(projectDir, 'go.mod'))) stack.push('Go')
  if (existsSync(join(projectDir, 'pyproject.toml'))) stack.push('Python')
  return stack
}

function readEnvKeys(projectDir: string): string[] {
  const envPath = join(projectDir, '.env')
  if (!existsSync(envPath)) return []
  try {
    const content = readFileSync(envPath, 'utf-8')
    return content
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'))
      .map((l) => l.split('=')[0]?.trim())
      .filter((k): k is string => !!k)
  } catch {
    return []
  }
}

async function computeContext(projectDir: string): Promise<ProjectContext> {
  const name = basename(projectDir)
  const stack = detectStack(projectDir)
  const recentCommits = await readGitLog(projectDir)
  const envKeys = readEnvKeys(projectDir)
  return {
    name,
    path: projectDir,
    stack,
    recentCommits,
    hasEnv: envKeys.length > 0,
    envKeys
  }
}

/**
 * Returns null if the active app isn't an editor or no project can be detected.
 * Uses a short cache so we don't re-spawn git on every prompt.
 */
export async function getProjectContext(): Promise<ProjectContext | null> {
  const sys = getSystem()
  if (!sys.activeApp || !EDITOR_APPS.has(sys.activeApp)) {
    cache = null
    cachedPath = null
    return null
  }

  const guess = guessPathFromTitle(sys.windowTitle)
  const projectDir = guess ? findPackageJsonDir(guess) ?? guess : null

  if (!projectDir) return cache

  const now = Date.now()
  if (cachedPath === projectDir && now - lastRefresh < CACHE_TTL_MS) {
    return cache
  }

  try {
    cache = await computeContext(projectDir)
    cachedPath = projectDir
    lastRefresh = now
  } catch {
    /* keep previous */
  }
  return cache
}

/** Sync peek — returns whatever's in cache. */
export function getCached(): ProjectContext | null {
  return cache
}
