import { useEffect, useRef, useState } from 'react'

interface State {
  active: boolean
  app: string | null
  startedAt: number | null
  transcript: string
}

function formatDuration(startedAt: number): string {
  const total = Math.floor((Date.now() - startedAt) / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export function MeetingOverlay(): React.JSX.Element | null {
  const [state, setState] = useState<State>({
    active: false,
    app: null,
    startedAt: null,
    transcript: ''
  })
  const scrollRef = useRef<HTMLDivElement>(null)
  const [, tick] = useState(0)

  async function hydrate(): Promise<void> {
    const m = await window.esi?.getActiveMeeting()
    if (m) {
      setState({ active: true, app: m.app, startedAt: m.startedAt, transcript: m.transcript })
    }
  }

  useEffect(() => {
    hydrate()
    const offStart = window.esi?.onMeetingStart?.((info) =>
      setState({ active: true, app: info.app, startedAt: info.startedAt, transcript: '' })
    )
    const offTx = window.esi?.onMeetingTranscript?.((text) =>
      setState((s) => ({ ...s, transcript: text }))
    )
    const offEnd = window.esi?.onMeetingEnd?.(() =>
      setState((s) => ({ ...s, active: false }))
    )
    const id = setInterval(() => tick((n) => n + 1), 1000)
    return () => {
      offStart?.()
      offTx?.()
      offEnd?.()
      clearInterval(id)
    }
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [state.transcript])

  if (!state.active || !state.startedAt) return null

  return (
    <div
      className="fixed top-24 left-1/2 -translate-x-1/2 w-[460px] rounded-xl pointer-events-auto z-40"
      style={{
        background: 'var(--color-esi-panel)',
        border: '1.5px solid var(--color-esi-red)',
        boxShadow: '0 12px 32px -8px rgba(220, 38, 38, 0.25)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)'
      }}
    >
      <div
        className="flex items-center justify-between px-4 py-2 border-b"
        style={{ borderColor: 'rgba(220, 38, 38, 0.2)' }}
      >
        <span
          className="text-[12px] uppercase tracking-widest font-bold flex items-center gap-2"
          style={{
            color: 'var(--color-esi-red)',
            fontFamily: 'var(--font-orbitron)'
          }}
        >
          <span
            className="inline-block w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ background: 'var(--color-esi-red)' }}
          />
          LIVE · {state.app}
        </span>
        <span
          className="text-[12px] tabular-nums"
          style={{
            color: 'var(--color-esi-muted)',
            fontFamily: 'var(--font-mono)'
          }}
        >
          {formatDuration(state.startedAt)}
        </span>
      </div>
      <div
        ref={scrollRef}
        className="max-h-[160px] overflow-y-auto px-4 py-3 text-[12px] leading-relaxed font-mono tracking-tight"
        style={{ color: 'var(--color-esi-text-dim)' }}
        data-selectable
      >
        {state.transcript
          ? state.transcript
          : 'Capturing audio… (transcript will appear here in 30s chunks if whisper + BlackHole are installed)'}
      </div>
    </div>
  )
}
