import { useEffect, useState } from 'react'
import { PanelShell } from './shared/PanelShell'

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
}

function truncate(s: string, n = 80): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

export function ActivityColumn(): React.JSX.Element {
  const [entries, setEntries] = useState<EsiLogEntry[]>([])

  async function refresh(): Promise<void> {
    const rows = (await window.esi?.getRecentLog(15)) ?? []
    setEntries(rows)
  }

  useEffect(() => {
    refresh()
    const off = window.esi?.onLogUpdated(() => refresh())
    return () => off?.()
  }, [])

  return (
    <PanelShell title="System Activity & Logs" glowColor="cyan" className="flex-1 min-h-0" delay={0.2}>
      {entries.length === 0 ? (
        <p style={{ fontSize: '12px', opacity: 0.4, fontFamily: 'var(--font-mono)' }}>
          No activity recorded yet.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {entries.map((e) => (
            <div
              key={e.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                borderBottom: '1px solid var(--color-esi-panel-border)',
                paddingBottom: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    fontSize: '9px',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    color: e.ok ? 'var(--color-esi-green)' : 'var(--color-esi-red)',
                    background: e.ok ? 'rgba(74, 222, 128, 0.1)' : 'rgba(248, 113, 113, 0.1)'
                  }}
                >
                  {e.ok ? 'OK' : 'ERR'}
                </span>
                <span style={{ fontSize: '10px', opacity: 0.4, fontVariantNumeric: 'tabular-nums' }}>
                  {formatTime(e.timestamp)}
                </span>
                {e.duration_ms && (
                  <span style={{ fontSize: '10px', opacity: 0.25, fontVariantNumeric: 'tabular-nums' }}>
                    {e.duration_ms}ms
                  </span>
                )}
              </div>
              <div
                style={{ fontSize: '12px', lineHeight: 1.5, fontFamily: 'var(--font-mono)', color: 'var(--color-esi-text-dim)' }}
                data-selectable
              >
                &gt; {truncate(e.command)}
              </div>
              {e.response && (
                <div style={{ fontSize: '11px', lineHeight: 1.4, opacity: 0.45, fontFamily: 'var(--font-mono)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {truncate(e.response, 120)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </PanelShell>
  )
}
