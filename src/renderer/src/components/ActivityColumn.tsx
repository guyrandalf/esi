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

function truncate(s: string, n = 68): string {
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
    const off = window.esi?.onLogUpdated(() => {
      refresh()
    })
    return () => off?.()
  }, [])

  return (
    <PanelShell title="System Activity & Logs" glowColor="cyan" className="flex-1 min-h-0" delay={0.2}>
      {entries.length === 0 ? (
        <p className="text-[13px] px-1 leading-relaxed" style={{ color: 'var(--color-esi-muted)' }}>
          [NO HISTORICAL DATA FOUND]
        </p>
      ) : (
        <ul className="space-y-4">
          {entries.map((e) => (
            <li key={e.id} className="group cursor-default flex flex-col gap-1.5 border-b pb-3" style={{ borderColor: 'var(--color-esi-border-soft)' }}>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 border rounded-sm" style={{ 
                  color: e.ok ? 'var(--color-esi-green)' : 'var(--color-esi-red)',
                  borderColor: e.ok ? 'rgba(74, 222, 128, 0.2)' : 'rgba(248, 113, 113, 0.2)',
                  backgroundColor: e.ok ? 'rgba(74, 222, 128, 0.05)' : 'rgba(248, 113, 113, 0.05)'
                }}>
                  {e.ok ? 'OK' : 'ERR'}
                </span>
                <span className="tabular-nums text-[11px]" style={{ color: 'var(--color-esi-cyan)' }}>
                  [{formatTime(e.timestamp)}]
                </span>
                {e.duration_ms && (
                  <span className="tabular-nums text-[11px]" style={{ color: 'var(--color-esi-muted)' }}>
                    {e.duration_ms}ms
                  </span>
                )}
              </div>
              <div className="text-[13px] leading-snug pl-1 font-mono tracking-tight" style={{ color: 'var(--color-esi-text-dim)' }} data-selectable>
                &gt; {truncate(e.command)}
              </div>
              {e.response && (
                <div className="text-[12px] leading-snug pl-1 line-clamp-2" style={{ color: 'var(--color-esi-muted)' }}>
                  {truncate(e.response, 100)}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  )
}
