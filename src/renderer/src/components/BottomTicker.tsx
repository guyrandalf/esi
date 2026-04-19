import { useEffect, useState } from 'react'

export function BottomTicker(): React.JSX.Element {
  const [sys, setSys] = useState<EsiSystemSnapshot | null>(null)
  const [meeting, setMeeting] = useState<EsiActiveMeeting | null>(null)
  const [metrics, setMetrics] = useState<EsiMetricsSnapshot | null>(null)

  useEffect(() => {
    const refresh = async (): Promise<void> => {
      try {
        const [s, m, mt] = await Promise.all([
          window.esi?.getSystem(),
          window.esi?.getActiveMeeting(),
          window.esi?.getMetrics()
        ])
        if (s) setSys(s)
        setMeeting(m ?? null)
        if (mt) setMetrics(mt)
      } catch {
        /* noop */
      }
    }
    refresh()
    const id = setInterval(refresh, 5_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div
      style={{
        borderTop: '1px solid rgba(126,231,255,0.15)',
        padding: '6px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        background: 'rgba(3,7,13,0.6)',
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        color: 'var(--color-esi-fg-dim)',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        flexShrink: 0
      }}
    >
      <span style={{ color: 'var(--color-esi-c-100)', letterSpacing: '0.25em' }}>FEED ▸</span>
      <span>
        ACTIVE · <span style={{ color: 'var(--color-esi-c-200)' }}>{sys?.activeApp ?? '—'}</span>
        {sys?.windowTitle ? ` · ${truncate(sys.windowTitle, 50)}` : ''}
      </span>
      <Div />
      <span>
        MEETING ·{' '}
        <span style={{ color: meeting ? 'var(--color-esi-good)' : 'var(--color-esi-fg-dim)' }}>
          {meeting ? `LIVE · ${meeting.app.toUpperCase()}` : 'IDLE'}
        </span>
      </span>
      <Div />
      <span>
        CLAUDE ·{' '}
        <span style={{ color: 'var(--color-esi-c-100)' }}>
          {metrics ? `${metrics.latencyAvg}ms avg` : '—'}
        </span>
      </span>
      <Div />
      <span>
        CMDS · <span style={{ color: 'var(--color-esi-c-200)' }}>{metrics?.commandsToday ?? 0}</span>{' '}
        today
      </span>
      <Div />
      <span>
        ERR ·{' '}
        <span
          style={{
            color: (metrics?.errorRatePct ?? 0) > 10 ? 'var(--color-esi-alert)' : 'var(--color-esi-good)'
          }}
        >
          {metrics ? `${metrics.errorRatePct}%` : '0%'}
        </span>
      </span>
    </div>
  )
}

function Div(): React.JSX.Element {
  return <span style={{ color: 'var(--color-esi-c-300)' }}>|</span>
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}
