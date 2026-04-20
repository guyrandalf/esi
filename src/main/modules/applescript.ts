import { spawn } from 'child_process'

/**
 * Run an AppleScript via osascript on stdin so we don't have to escape for the shell.
 * Rejects on non-zero exit or timeout. Timeout default is 15s because Apple's
 * Calendar scripting bridge can be slow on cold start.
 */
export function runAppleScript(
  script: string,
  timeoutMs = 15000,
  language: 'AppleScript' | 'JavaScript' = 'AppleScript'
): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = language === 'JavaScript' ? ['-l', 'JavaScript', '-'] : ['-']
    const proc = spawn('osascript', args, { stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    let finished = false

    const timer = setTimeout(() => {
      if (finished) return
      finished = true
      try {
        proc.kill()
      } catch {
        /* noop */
      }
      // Include any partial stderr so the caller can diagnose permission prompts etc.
      const partial = stderr.trim()
      reject(
        new Error(
          partial
            ? `AppleScript timed out after ${timeoutMs}ms. stderr: ${partial}`
            : `AppleScript timed out after ${timeoutMs}ms`
        )
      )
    }, timeoutMs)

    proc.stdout.on('data', (d) => {
      stdout += d.toString()
    })
    proc.stderr.on('data', (d) => {
      stderr += d.toString()
    })
    proc.on('error', (err) => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      reject(err)
    })
    proc.on('close', (code) => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      if (code === 0) resolve(stdout)
      else reject(new Error(`osascript exited ${code}: ${stderr.trim()}`))
    })

    proc.stdin.write(script)
    proc.stdin.end()
  })
}
