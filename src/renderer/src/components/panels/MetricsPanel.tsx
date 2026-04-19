import { useEffect, useState } from 'react'

export function MetricsPanel(): React.JSX.Element {
  const [m, setM] = useState<EsiMetricsSnapshot | null>(null)

  async function refresh(): Promise<void> {
    try {
      const snap = await window.esi?.getMetrics()
      if (snap) setM(snap)
    } catch (err) {
      console.warn('[metrics] refresh failed', err)
    }
  }

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 3000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="panel" style={{ padding: 0 }}>
      <div className="panel-head">
        <span>
          <span className="dot" />
          SYSTEM · METRICS
        </span>
        <span className="mono" style={{ fontSize: 9, color: 'var(--color-esi-fg-dim)' }}>
          {m ? `${m.memUsedGb}/${m.memTotalGb}GB · ${m.uptimeMinutes}m` : '—'}
        </span>
      </div>
      <div style={{ padding: '14px 14px 16px' }}>
        {!m ? (
          <div
            className="mono"
            style={{
              fontSize: 10,
              color: 'var(--color-esi-fg-dim)',
              textTransform: 'uppercase',
              letterSpacing: '0.15em'
            }}
          >
            Gathering metrics…
          </div>
        ) : (
          <>
            <Gauge
              label="CPU"
              value={m.cpuPercent}
              unit="%"
              detail={`${m.loadAvg1} LOAD · 1m`}
            />
            <Gauge
              label="MEM"
              value={m.memPercentUsed}
              unit="%"
              detail={`${m.memUsedGb} / ${m.memTotalGb} GB`}
            />
            <Gauge
              label="LATENCY"
              value={Math.min(m.latencyAvg, 5000)}
              scale={5000}
              unit="ms"
              detail={`AVG · ${m.latencyMs.length} samples`}
            />
            <Gauge
              label="ERROR"
              value={m.errorRatePct}
              unit="%"
              detail="OF LAST 50"
              warning={m.errorRatePct > 10}
            />

            <div
              style={{
                marginTop: 14,
                paddingTop: 10,
                borderTop: '1px dashed rgba(126,231,255,0.2)',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 10,
                fontFamily: 'var(--font-mono)',
                fontSize: 10
              }}
            >
              <Stat label="CMDS TODAY" value={String(m.commandsToday)} sub={`${m.totalCommands} TOTAL`} />
              <Stat
                label="UPTIME"
                value={
                  m.uptimeMinutes < 60
                    ? `${m.uptimeMinutes}m`
                    : `${Math.round(m.uptimeMinutes / 60)}h`
                }
                sub="STABLE"
              />
              <Stat
                label="P95"
                value={`${percentile(m.latencyMs, 95)}ms`}
                sub={`P50 · ${percentile(m.latencyMs, 50)}ms`}
              />
              <Stat
                label="24H"
                value={String(m.commandsPerHour.reduce((a, b) => a + b, 0))}
                sub="COMMANDS"
              />
            </div>

            {/* 24h activity sparkline / mini bar chart */}
            <div style={{ marginTop: 14 }}>
              <div
                className="mono"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 9,
                  color: 'var(--color-esi-fg-dim)',
                  letterSpacing: '0.15em',
                  marginBottom: 4
                }}
              >
                <span>ACTIVITY · 24H</span>
                <span>{m.commandsPerHour.reduce((a, b) => a + b, 0)}</span>
              </div>
              <MiniBars values={m.commandsPerHour} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Gauge({
  label,
  value,
  unit,
  scale = 100,
  detail,
  warning
}: {
  label: string
  value: number
  unit: string
  scale?: number
  detail?: string
  warning?: boolean
}): React.JSX.Element {
  const pct = Math.max(0, Math.min(100, (value / scale) * 100))
  return (
    <div style={{ marginBottom: 10 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 3
        }}
      >
        <span
          className="mono"
          style={{
            fontSize: 10,
            color: 'var(--color-esi-c-200)',
            letterSpacing: '0.15em'
          }}
        >
          {label}
        </span>
        <span className="mono" style={{ fontSize: 11, color: 'var(--color-esi-fg)' }}>
          {Number.isFinite(value) ? value.toFixed(value >= 100 ? 0 : 1) : '—'}
          <span style={{ color: 'var(--color-esi-fg-dim)', marginLeft: 2 }}>{unit}</span>
        </span>
      </div>
      <div
        style={{
          height: 4,
          background: 'rgba(126,231,255,0.08)',
          border: '1px solid rgba(126,231,255,0.15)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: warning
              ? 'linear-gradient(90deg, var(--color-esi-amber), var(--color-esi-alert))'
              : 'linear-gradient(90deg, var(--color-esi-c-400), var(--color-esi-c-200))',
            boxShadow: warning
              ? '0 0 6px var(--color-esi-amber)'
              : '0 0 6px var(--color-esi-c-200)',
            transition: 'width 600ms ease-out'
          }}
        />
        {[25, 50, 75].map((t) => (
          <div
            key={t}
            style={{
              position: 'absolute',
              left: `${t}%`,
              top: 0,
              bottom: 0,
              width: 1,
              background: 'rgba(3,7,13,0.8)'
            }}
          />
        ))}
      </div>
      {detail && (
        <div
          className="mono"
          style={{
            fontSize: 9,
            color: 'var(--color-esi-fg-dimmer)',
            marginTop: 2,
            letterSpacing: '0.12em'
          }}
        >
          {detail}
        </div>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  sub
}: {
  label: string
  value: string
  sub: string
}): React.JSX.Element {
  return (
    <div>
      <div style={{ color: 'var(--color-esi-fg-dim)', fontSize: 9, letterSpacing: '0.15em' }}>
        {label}
      </div>
      <div style={{ color: 'var(--color-esi-c-100)', fontSize: 14, fontWeight: 600 }}>
        {value}
      </div>
      <div style={{ color: 'var(--color-esi-fg-dimmer)', fontSize: 9 }}>{sub}</div>
    </div>
  )
}

function MiniBars({ values }: { values: number[] }): React.JSX.Element {
  const max = Math.max(...values, 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 28 }}>
      {values.map((v, i) => {
        const h = Math.max(2, (v / max) * 100)
        return (
          <div
            key={i}
            style={{
              flex: 1,
              height: `${h}%`,
              background: v > 0 ? 'var(--color-esi-c-200)' : 'rgba(126,231,255,0.15)',
              boxShadow: v > 0 ? '0 0 4px var(--color-esi-c-200)' : 'none',
              borderRadius: 1
            }}
            title={`${v} · ${23 - i}h ago`}
          />
        )
      })}
    </div>
  )
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))]
}
