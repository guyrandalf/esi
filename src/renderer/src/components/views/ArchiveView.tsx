import { useEffect, useMemo, useState } from 'react'

export function ArchiveView(): React.JSX.Element {
  const [entries, setEntries] = useState<EsiLogEntry[]>([])
  const [query, setQuery] = useState('')

  useEffect(() => {
    const refresh = async (): Promise<void> => {
      const rows = (await window.esi?.getRecentLog(500)) ?? []
      setEntries(rows)
    }
    refresh()
    const off = window.esi?.onLogUpdated(() => refresh())
    return () => off?.()
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return entries
    return entries.filter(
      (e) =>
        e.command.toLowerCase().includes(q) ||
        (e.response?.toLowerCase().includes(q) ?? false)
    )
  }, [entries, query])

  return (
    <div
      className="panel"
      style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}
    >
      <div className="panel-head">
        <span>
          <span className="dot" />
          ARCHIVE · COMMAND LOG
        </span>
        <span className="mono" style={{ fontSize: 9, color: 'var(--color-esi-fg-dim)' }}>
          {filtered.length} / {entries.length} ENTRIES
        </span>
      </div>
      <div
        style={{
          padding: '10px 14px',
          borderBottom: '1px dashed rgba(126,231,255,0.15)'
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter archive…"
          style={{
            width: '100%',
            background: 'transparent',
            outline: 'none',
            border: 'none',
            borderBottom: '1px solid rgba(126,231,255,0.25)',
            color: 'var(--color-esi-fg)',
            fontFamily: 'var(--font-ui)',
            fontSize: 13,
            padding: '4px 2px'
          }}
        />
      </div>
      <div
        style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '10px 14px' }}
      >
        {filtered.length === 0 ? (
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: 'var(--color-esi-fg-dim)',
              letterSpacing: '0.15em',
              textTransform: 'uppercase'
            }}
          >
            {query ? 'No matches' : 'No commands yet'}
          </div>
        ) : (
          filtered.map((e, i) => (
            <div
              key={e.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '100px 60px 1fr 72px',
                gap: 12,
                padding: '8px 0',
                borderBottom:
                  i < filtered.length - 1
                    ? '1px dashed rgba(126,231,255,0.08)'
                    : 'none',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                alignItems: 'start'
              }}
            >
              <span style={{ color: 'var(--color-esi-fg-dimmer)' }}>
                {fmt(e.timestamp)}
              </span>
              <span
                style={{
                  color: e.ok
                    ? 'var(--color-esi-c-300)'
                    : 'var(--color-esi-alert)',
                  letterSpacing: '0.15em',
                  fontSize: 9,
                  marginTop: 2
                }}
              >
                {e.ok ? 'INFO' : 'ERR'}
              </span>
              <div style={{ minWidth: 0 }} data-selectable>
                <div style={{ color: 'var(--color-esi-fg)', fontFamily: 'var(--font-ui)', fontSize: 12 }}>
                  &gt; {e.command}
                </div>
                {e.response && (
                  <div
                    style={{
                      color: 'var(--color-esi-fg-dim)',
                      fontFamily: 'var(--font-ui)',
                      fontSize: 11,
                      marginTop: 3,
                      whiteSpace: 'pre-wrap'
                    }}
                  >
                    {e.response}
                  </div>
                )}
                {e.app_context && (
                  <div
                    style={{
                      color: 'var(--color-esi-fg-dimmer)',
                      fontSize: 9,
                      letterSpacing: '0.15em',
                      marginTop: 3
                    }}
                  >
                    {e.app_context.toUpperCase()}
                  </div>
                )}
              </div>
              <span
                style={{
                  color: 'var(--color-esi-fg-dim)',
                  fontSize: 10,
                  textAlign: 'right'
                }}
              >
                {e.duration_ms != null ? `${e.duration_ms}ms` : ''}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function fmt(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
}
