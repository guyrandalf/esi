import { spawn, ChildProcess } from 'child_process'

let current: ChildProcess | null = null

export function stripForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#+\s*/gm, '')
    .replace(/^>\s*/gm, '')
    .replace(/\n+/g, '. ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function speak(text: string, voice = process.env.ESI_VOICE || 'Zoe'): void {
  cancelSpeech()
  const clean = stripForSpeech(text)
  if (!clean) return
  try {
    current = spawn('say', ['-v', voice, clean], { stdio: 'ignore' })
    current.on('exit', () => {
      current = null
    })
    current.on('error', () => {
      current = null
    })
  } catch {
    current = null
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
  }
}

export function isSpeaking(): boolean {
  return current !== null
}
