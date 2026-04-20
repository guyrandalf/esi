import { useEffect, useState } from 'react'

interface Row {
  label: string
  key: keyof EsiSubsystemStatus
  hint?: string
}

const ROWS: Row[] = [
  { label: 'Ollama', key: 'ollama', hint: 'local LLM' },
  { label: 'Gemini', key: 'gemini', hint: 'cloud reasoning + vision' },
  { label: 'Semantic memory', key: 'semantic', hint: 'nomic-embed-text' },
  { label: 'Voice input', key: 'voiceInput', hint: 'whisper-cpp' },
  { label: 'Wake word', key: 'wakeWord', hint: 'Porcupine / PICOVOICE_ACCESS_KEY' }
]

export function StatusPanel(): React.JSX.Element {
  const [status, setStatus] = useState<EsiSubsystemStatus | null>(null)
  const [voiceState, setVoiceState] = useState<'idle' | 'recording' | 'transcribing' | 'speaking'>('idle')

  async function refresh(): Promise<void> {
    try {
      const s = await window.esi?.getStatus()
      if (s) setStatus(s)
    } catch {
      /* noop */
    }
  }

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 20_000)
    const off = window.esi?.onVoiceState?.((s) => setVoiceState(s))
    return () => {
      clearInterval(id)
      off?.()
    }
  }, [])

  if (!status) {
    return (
      <p className="text-[11px] uppercase tracking-widest" style={{ color: 'var(--color-esi-muted)' }}>
        [CHECKING SUBSYSTEMS…]
      </p>
    )
  }

  return (
    <div className="space-y-2 font-mono">
      {voiceState !== 'idle' && (
        <div
          className="text-[11px] uppercase tracking-widest px-2 py-1.5 rounded mb-2"
          style={{
            color: 'var(--color-esi-cyan)',
            background: 'rgba(34, 211, 238, 0.1)',
            border: '1px solid rgba(34, 211, 238, 0.35)'
          }}
        >
          {voiceState === 'recording' ? '● RECORDING — ⌘⇧SPACE TO SUBMIT' : '◐ TRANSCRIBING…'}
        </div>
      )}
      <ul className="space-y-1.5 text-[11px] uppercase tracking-wider">
        {ROWS.map((r) => {
          const ok = status[r.key]
          return (
            <li key={r.key} className="flex items-center gap-2">
              <span
                className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                style={{
                  background: ok ? 'var(--color-esi-green)' : 'var(--color-esi-muted)',
                  boxShadow: ok ? '0 0 6px var(--color-esi-green)' : 'none'
                }}
              />
              <span
                className="flex-1 truncate"
                style={{ color: ok ? 'var(--color-esi-text)' : 'var(--color-esi-muted)' }}
              >
                {r.label}
              </span>
              <span className="text-[10px]" style={{ color: 'var(--color-esi-muted)' }}>
                {ok ? 'OK' : 'OFF'}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
