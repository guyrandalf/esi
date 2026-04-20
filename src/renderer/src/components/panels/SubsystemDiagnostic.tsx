import { useEffect, useState } from 'react'

interface Node {
  id: keyof EsiSubsystemStatus
  x: number
  y: number
  r: number
  label: string
  desc: string
}

const NODES: Node[] = [
  { id: 'ollama', x: 50, y: 14, r: 5, label: 'OLLAMA', desc: 'LOCAL LLM' },
  { id: 'gemini', x: 82, y: 30, r: 4, label: 'GEMINI', desc: 'CLOUD · VISION' },
  { id: 'semantic', x: 82, y: 62, r: 4, label: 'SEMANTIC', desc: 'NOMIC-EMBED' },
  { id: 'voiceInput', x: 50, y: 78, r: 4, label: 'VOICE IN', desc: 'WHISPER-CPP' },
  { id: 'wakeWord', x: 18, y: 62, r: 4, label: 'WAKE', desc: 'VAD + WHISPER' },
  { id: 'whisper', x: 18, y: 30, r: 4, label: 'WHISPER', desc: 'TRANSCRIBE' }
]

export function SubsystemDiagnostic(): React.JSX.Element {
  const [status, setStatus] = useState<EsiSubsystemStatus | null>(null)
  const [hover, setHover] = useState<keyof EsiSubsystemStatus | null>(null)

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
    return () => clearInterval(id)
  }, [])

  const okCount = status
    ? NODES.reduce((n, x) => n + (status[x.id] ? 1 : 0), 0)
    : 0
  const allOk = status ? okCount === NODES.length : false

  const sel = hover
    ? NODES.find((n) => n.id === hover)
    : NODES.find((n) => n.id === 'ollama')
  const selOk = status && sel ? status[sel.id] : false

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div className="panel-head">
        <span>
          <span className="dot" />
          CORE · DIAGNOSTICS
        </span>
        <span
          className="mono"
          style={{
            fontSize: 9,
            color: allOk ? 'var(--color-esi-good)' : 'var(--color-esi-amber)'
          }}
        >
          {status ? `${okCount}/${NODES.length} ${allOk ? 'NOMINAL' : 'DEGRADED'}` : 'CHECK…'}
        </span>
      </div>
      <div
        style={{
          padding: 10,
          display: 'grid',
          gridTemplateColumns: '1fr 150px',
          gap: 10,
          flex: 1,
          minHeight: 0,
          overflow: 'hidden'
        }}
      >
        <svg viewBox="0 0 100 100" style={{ width: '100%', maxHeight: 260, minHeight: 180 }}>
          {/* Concentric rings */}
          <g fill="none" stroke="rgba(126,231,255,0.18)" strokeWidth="0.4">
            <circle cx="50" cy="50" r="42" />
            <circle cx="50" cy="50" r="30" strokeDasharray="2 3" />
            <circle cx="50" cy="50" r="18" strokeDasharray="1 2" />
          </g>

          {/* Connection lines from core to each node */}
          {NODES.map((n) => (
            <line
              key={`l-${n.id}`}
              x1="50"
              y1="50"
              x2={n.x}
              y2={n.y}
              stroke={status && status[n.id] ? 'rgba(126,231,255,0.3)' : 'rgba(126,231,255,0.08)'}
              strokeWidth="0.3"
              strokeDasharray="1 1.5"
            />
          ))}

          {/* Core */}
          <circle cx="50" cy="50" r="7" fill="rgba(126,231,255,0.08)" stroke="var(--color-esi-c-200)" strokeWidth="0.6" />
          <circle cx="50" cy="50" r="3" fill="var(--color-esi-c-100)">
            <animate attributeName="opacity" from="0.6" to="1" dur="2s" repeatCount="indefinite" />
          </circle>

          {/* Nodes */}
          {NODES.map((n) => {
            const ok = status ? status[n.id] : false
            const isHover = hover === n.id
            const color = ok ? 'var(--color-esi-c-100)' : 'var(--color-esi-fg-dimmer)'
            return (
              <g
                key={n.id}
                onMouseEnter={() => setHover(n.id)}
                onMouseLeave={() => setHover(null)}
                style={{ cursor: 'pointer' }}
              >
                <circle cx={n.x} cy={n.y} r={n.r * 1.8} fill="transparent" />
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={n.r}
                  fill={isHover ? color : 'transparent'}
                  stroke={color}
                  strokeWidth="0.6"
                  style={
                    isHover || ok
                      ? { filter: 'drop-shadow(0 0 3px var(--color-esi-c-200))' }
                      : undefined
                  }
                >
                  <animate attributeName="opacity" from="0.5" to="1" dur="2s" repeatCount="indefinite" />
                </circle>
                <text
                  x={n.x}
                  y={n.y + n.r + 4}
                  fill="var(--color-esi-fg-dim)"
                  fontSize="2.6"
                  fontFamily="var(--font-mono)"
                  textAnchor="middle"
                  letterSpacing="0.15em"
                >
                  {n.label}
                </text>
              </g>
            )
          })}
        </svg>

        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>
          {sel && (
            <>
              <div style={{ color: 'var(--color-esi-c-200)', letterSpacing: '0.15em', fontSize: 9 }}>
                SELECTED
              </div>
              <div
                style={{
                  color: 'var(--color-esi-fg)',
                  fontSize: 12,
                  margin: '4px 0 6px',
                  fontFamily: 'var(--font-ui)'
                }}
              >
                {sel.label}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <div>
                  <div style={{ color: 'var(--color-esi-fg-dimmer)', fontSize: 8 }}>STATUS</div>
                  <div style={{ color: selOk ? 'var(--color-esi-good)' : 'var(--color-esi-fg-dim)' }}>
                    {selOk ? 'ONLINE' : 'OFFLINE'}
                  </div>
                </div>
                <div>
                  <div style={{ color: 'var(--color-esi-fg-dimmer)', fontSize: 8 }}>KIND</div>
                  <div style={{ color: 'var(--color-esi-c-100)' }}>{sel.desc}</div>
                </div>
              </div>
            </>
          )}
          <div
            style={{
              marginTop: 14,
              color: 'var(--color-esi-fg-dimmer)',
              fontSize: 9,
              letterSpacing: '0.1em'
            }}
          >
            HOVER COMPONENTS
            <br />
            FOR DIAGNOSTICS
          </div>
        </div>
      </div>
    </div>
  )
}
