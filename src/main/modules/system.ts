import { runAppleScript } from './applescript'

export interface SystemSnapshot {
  activeApp: string | null
  windowTitle: string | null
  /** The most recent non-Esi app — useful when Esi itself is focused. */
  previousApp: string | null
  previousWindowTitle: string | null
  updatedAt: number
}

let cache: SystemSnapshot = {
  activeApp: null,
  windowTitle: null,
  previousApp: null,
  previousWindowTitle: null,
  updatedAt: 0
}
let interval: NodeJS.Timeout | null = null

// Esi is an Electron app; its process shows up as "Electron" in dev
// and "Esi" once packaged. Filter both so we don't confuse the LLM.
const SELF_APPS = new Set(['Electron', 'Esi', 'esi'])
const SELF_TITLE_RX = /E\.?S\.?I\.?\b|localhost:5173/i

function isSelf(app: string | null, title: string | null): boolean {
  if (!app) return false
  if (SELF_APPS.has(app)) return true
  if (title && SELF_TITLE_RX.test(title)) return true
  return false
}

const SCRIPT = `
tell application "System Events"
  try
    set theApp to name of first application process whose frontmost is true
    set theTitle to ""
    try
      tell (first application process whose frontmost is true)
        set theTitle to name of front window
      end tell
    end try
    return theApp & "||" & theTitle
  on error
    return "||"
  end try
end tell
`.trim()

export async function refresh(): Promise<SystemSnapshot> {
  try {
    const stdout = await runAppleScript(SCRIPT, 2500)
    const [app, title] = stdout.trim().split('||')
    const activeApp = app?.trim() || null
    const windowTitle = title?.trim() || null

    // If the current focused app is NOT Esi, update "previousApp" so we
    // can reference it when Esi steals focus.
    let previousApp = cache.previousApp
    let previousWindowTitle = cache.previousWindowTitle
    if (activeApp && !isSelf(activeApp, windowTitle)) {
      previousApp = activeApp
      previousWindowTitle = windowTitle
    }

    cache = {
      activeApp,
      windowTitle,
      previousApp,
      previousWindowTitle,
      updatedAt: Date.now()
    }
  } catch {
    // permission/timeout — keep previous snapshot
  }
  return cache
}

export function getCurrent(): SystemSnapshot {
  return cache
}

/** What the LLM should see: the user's actual work app, even if Esi has focus. */
export function getUserFacingApp(): { app: string | null; title: string | null } {
  if (cache.activeApp && !isSelf(cache.activeApp, cache.windowTitle)) {
    return { app: cache.activeApp, title: cache.windowTitle }
  }
  return { app: cache.previousApp, title: cache.previousWindowTitle }
}

export function startPolling(intervalMs = 3000): void {
  if (interval) return
  refresh()
  interval = setInterval(() => {
    refresh()
  }, intervalMs)
}

export function stopPolling(): void {
  if (interval) {
    clearInterval(interval)
    interval = null
  }
}
