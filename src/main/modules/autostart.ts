/**
 * Auto-start-on-login via a macOS LaunchAgent.
 *
 * Writes ~/Library/LaunchAgents/com.guyrandalf.esi.plist and loads it
 * with `launchctl`. The plist points at the installed ESI.app binary
 * and carries ESI_START_MODE=menubar so the app boots headless.
 *
 * This is intentionally a no-op when `app.isPackaged` is false — we
 * don't want the dev build hijacking login. Callers should guard:
 *
 *     if (app.isPackaged) autostart.install()
 */

import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { spawn } from 'child_process'

const LABEL = 'com.guyrandalf.esi'
const PLIST_NAME = `${LABEL}.plist`
const LAUNCH_AGENTS_DIR = join(homedir(), 'Library', 'LaunchAgents')
const PLIST_PATH = join(LAUNCH_AGENTS_DIR, PLIST_NAME)

function plistBody(execPath: string): string {
  // Kept inline so we don't depend on the bundled template at runtime.
  // The template at build/com.guyrandalf.esi.plist is the authoring copy.
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${execPath}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <false/>
  <key>LimitLoadToSessionType</key>
  <string>Aqua</string>
  <key>ProcessType</key>
  <string>Interactive</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>ESI_START_MODE</key>
    <string>menubar</string>
  </dict>
  <key>StandardOutPath</key>
  <string>/tmp/esi.out.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/esi.err.log</string>
</dict>
</plist>
`
}

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: 'ignore' })
    p.on('exit', (code) => {
      // launchctl bootout exits non-zero when not loaded — treat that as OK.
      if (code === 0 || code === 5 || code === 113) resolve()
      else reject(new Error(`${cmd} ${args.join(' ')} exited ${code}`))
    })
    p.on('error', reject)
  })
}

export function isInstalled(): boolean {
  return existsSync(PLIST_PATH)
}

/** Does the plist we wrote still point at the current binary? */
export function isInstalledForCurrentBinary(): boolean {
  if (!isInstalled()) return false
  try {
    const body = readFileSync(PLIST_PATH, 'utf8')
    return body.includes(app.getPath('exe'))
  } catch {
    return false
  }
}

export async function install(): Promise<void> {
  if (!app.isPackaged) {
    console.warn('[esi] autostart.install skipped — app is not packaged')
    return
  }
  try {
    mkdirSync(LAUNCH_AGENTS_DIR, { recursive: true })
  } catch {
    /* already exists */
  }
  const execPath = app.getPath('exe')
  writeFileSync(PLIST_PATH, plistBody(execPath))
  // Reload if it was already loaded; otherwise just load.
  try {
    await run('launchctl', ['unload', PLIST_PATH])
  } catch {
    /* wasn't loaded */
  }
  await run('launchctl', ['load', PLIST_PATH])
  console.log(`[esi] autostart installed at ${PLIST_PATH}`)
}

export async function uninstall(): Promise<void> {
  try {
    await run('launchctl', ['unload', PLIST_PATH])
  } catch {
    /* wasn't loaded */
  }
  try {
    if (existsSync(PLIST_PATH)) unlinkSync(PLIST_PATH)
  } catch (err) {
    console.warn('[esi] autostart.uninstall: plist unlink failed', err)
  }
  console.log('[esi] autostart uninstalled')
}

export function plistPath(): string {
  return PLIST_PATH
}

/**
 * If an installed plist's body has drifted from what {@link plistBody} now
 * produces (e.g. we shipped a fix to KeepAlive / SessionType, or the exec
 * path moved), silently reinstall it so existing users pick up the change
 * without having to toggle the setting off/on.
 */
export async function ensureUpToDate(): Promise<void> {
  if (!app.isPackaged) return
  if (!isInstalled()) return
  try {
    const current = readFileSync(PLIST_PATH, 'utf8')
    const expected = plistBody(app.getPath('exe'))
    if (current === expected) return
    console.log('[esi] autostart plist out of date — reinstalling')
    await install()
  } catch (err) {
    console.warn('[esi] autostart.ensureUpToDate failed:', err)
  }
}

// Marker file so we never prompt the user twice if they opted out.
function dismissMarkerPath(): string {
  return join(app.getPath('userData'), '.autostart-dismissed')
}

export function markPromptDismissed(): void {
  try {
    writeFileSync(dismissMarkerPath(), String(Date.now()))
  } catch (err) {
    console.warn('[esi] could not write autostart dismiss marker:', err)
  }
}

export function wasPromptDismissed(): boolean {
  return existsSync(dismissMarkerPath())
}
