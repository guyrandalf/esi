import { spawn, ChildProcess } from 'child_process'

let current: ChildProcess | null = null
let onStateChange: ((state: 'idle' | 'speaking') => void) | null = null

export function setStateListener(fn: (state: 'idle' | 'speaking') => void): void {
  onStateChange = fn
}

export function stripForSpeech(text: string): string {
  return (
    text
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\[ACTION:[^\]]*\]/g, ' ')
      .replace(/^#+\s*/gm, '')
      .replace(/^>\s*/gm, '')
      // Pronunciation fix: "ESI" / "E.S.I" / "E.S.I." are the brand, but
      // `say` reads them as letters ("ee ess eye"). We want the Ghanaian
      // pronunciation /ɛsi/ — "Ehsie" (explicit H) lands closer than
      // "Essie" on macOS neural voices.
      .replace(/\bE\.?\s*S\.?\s*I\.?\b/g, 'Ehsie')
      .replace(/\n+/g, '. ')
      .replace(/\s+/g, ' ')
      .trim()
  )
}

export function speak(
  text: string,
  voice = process.env.ESI_VOICE || 'Sandy (English (US))'
): void {
  cancelSpeech()
  const clean = stripForSpeech(text)
  if (!clean) return
  try {
    current = spawn('say', ['-v', voice, clean], { stdio: 'ignore' })
    onStateChange?.('speaking')
    current.on('exit', () => {
      current = null
      onStateChange?.('idle')
    })
    current.on('error', () => {
      current = null
      onStateChange?.('idle')
    })
  } catch {
    current = null
    onStateChange?.('idle')
  }
}

export function cancelSpeech(): void {
  if (current) {
    try {
      current.kill()
    } catch {
      /* ignore */
    }
    current = null
    onStateChange?.('idle')
  }
}

export function isSpeaking(): boolean {
  return current !== null
}
