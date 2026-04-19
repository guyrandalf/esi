import { useEffect, useState } from 'react'

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
}

function truncate(s: string, n = 120): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

/**
 * MissionLog — level-coded activity stream. Keeps the name ActivityColumn
 * so existing imports still work.
 */
export function ActivityColumn(): React.JSX.Element {
  const [entries, setEntries] = useState<EsiLogEntry[]>([])

  async function refresh(): Promise<void> {
    const rows = (await window.esi?.getRecentLog(30)) ?? []
    setEntries(rows)
  }

  useEffect(() => {
    refresh()
    const off = window.esi?.onLogUpdated(() => refresh())
    return () => off?.()
  }, [])

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div className="panel-head">
        <span>
          <span className="dot" />
          MISSION LOG
        </span>
        <span className="mono" style={{ fontSize: 9, color: 'var(--color-esi-good)' }}>
          ● LIVE
        </span>
      </div>
      <div
        style={{
          padding: '8px 14px 12px',
          flex: 1,
          minHeight: 0,
          overflow: 'auto'
        }}
      >
        {entries.length === 0 ? (
          <div
            className="mono"
            style={{
              fontSize: 10,
              color: 'var(--color-esi-fg-dim)',
              letterSpacing: '0.15em',
              textTransform: 'uppercase'
            }}
          >
            No activity recorded yet.
          </div>
        ) : (
          entries.map((e, i) => (
            <div
              key={e.id}
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto auto 1fr',
                gap: 10,
                padding: '4px 0',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                borderBottom:
                  i < entries.length - 1 ? '1px dashed rgba(126,231,255,0.1)' : 'none'
              }}
            >
              <span style={{ color: 'var(--color-esi-fg-dimmer)' }}>
                {formatTime(e.timestamp)}
              </span>
              <span
                style={{
                  color: e.ok
                    ? 'var(--color-esi-c-300)'
                    : 'var(--color-esi-alert)',
                  letterSpacing: '0.15em',
                  fontSize: 9,
                  alignSelf: 'center'
                }}
              >
                {e.ok ? 'INFO' : 'ERR'}
              </span>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    color: 'var(--color-esi-fg)',
                    fontFamily: 'var(--font-ui)',
                    fontSize: 12,
                    letterSpacing: '0.02em'
                  }}
                  data-selectable
                >
                  &gt; {truncate(e.command, 160)}
                </div>
                {e.response && (
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--color-esi-fg-dim)',
                      fontFamily: 'var(--font-ui)',
                      marginTop: 2,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}
                  >
                    {truncate(e.response, 180)}
                  </div>
                )}
                {e.duration_ms != null && (
                  <div
                    style={{
                      fontSize: 9,
                      color: 'var(--color-esi-fg-dimmer)',
                      letterSpacing: '0.12em',
                      marginTop: 2
                    }}
                  >
                    {e.duration_ms}MS
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
