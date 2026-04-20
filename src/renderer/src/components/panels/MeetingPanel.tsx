import { useEffect, useRef, useState } from 'react'

interface MeetingState {
  active: boolean
  app: string | null
  startedAt: number | null
  transcript: string
  summary: string | null
}

function formatDuration(startedAt: number): string {
  const mins = Math.floor((Date.now() - startedAt) / 60_000)
  const secs = Math.floor(((Date.now() - startedAt) % 60_000) / 1000)
  if (mins === 0) return `${secs}s`
  return `${mins}m ${secs}s`
}

export function MeetingPanel(): React.JSX.Element {
  const [state, setState] = useState<MeetingState>({
    active: false,
    app: null,
    startedAt: null,
    transcript: '',
    summary: null
  })
  const scrollRef = useRef<HTMLDivElement>(null)
  const [, forceTick] = useState(0)

  async function hydrate(): Promise<void> {
    const active = await window.esi?.getActiveMeeting()
    if (active) {
      setState({
        active: true,
        app: active.app,
        startedAt: active.startedAt,
        transcript: active.transcript,
        summary: null
      })
    }
  }

  useEffect(() => {
    hydrate()
    const offStart = window.esi?.onMeetingStart?.((info) => {
      setState({
        active: true,
        app: info.app,
        startedAt: info.startedAt,
        transcript: '',
        summary: null
      })
    })
    const offTx = window.esi?.onMeetingTranscript?.((text) => {
      setState((s) => ({ ...s, transcript: text }))
    })
    const offEnd = window.esi?.onMeetingEnd?.((info) => {
      setState((s) => ({
        ...s,
        active: false,
        summary: info.summary || null,
        transcript: info.transcript || s.transcript
      }))
    })

    // Duration ticker
    const id = setInterval(() => forceTick((n) => n + 1), 1000)

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

  if (!state.active && !state.summary) {
    return (
      <p
        className="text-[11px] uppercase tracking-widest leading-relaxed"
        style={{ color: 'var(--color-esi-muted)' }}
      >
        [NO ACTIVE MEETING]
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-widest">
        <span
          className="font-bold"
          style={{
            color: state.active
              ? 'var(--color-esi-red)'
              : 'var(--color-esi-muted)'
          }}
        >
          {state.active ? '● LIVE' : '◯ ENDED'} · {state.app ?? '?'}
        </span>
        {state.startedAt && (
          <span
            className="tabular-nums"
            style={{ color: 'var(--color-esi-muted)' }}
          >
            {formatDuration(state.startedAt)}
          </span>
        )}
      </div>
      {state.transcript && (
        <div
          ref={scrollRef}
          className="max-h-[160px] overflow-y-auto text-[12px] leading-relaxed px-2 py-1.5 rounded font-mono tracking-tight"
          style={{
            background: 'var(--color-esi-panel-inset)',
            border: '1px solid var(--color-esi-panel-border)',
            color: 'var(--color-esi-text-dim)'
          }}
          data-selectable
        >
          {state.transcript}
        </div>
      )}
      {state.summary && (
        <div
          className="text-[12px] leading-relaxed px-2 py-1.5 rounded"
          style={{
            background: 'rgba(124, 106, 255, 0.08)',
            border: '1px solid rgba(124, 106, 255, 0.3)',
            color: 'var(--color-esi-text)'
          }}
          data-selectable
        >
          <div
            className="text-[10px] uppercase tracking-widest mb-1 font-bold"
            style={{ color: 'var(--color-esi-violet)' }}
          >
            Summary
          </div>
          {state.summary}
        </div>
      )}
    </div>
  )
}
