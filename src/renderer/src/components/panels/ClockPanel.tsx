import { useEffect, useState } from 'react'

export function ClockPanel(): React.JSX.Element {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')
  const date = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })
  return (
    <div className="panel" style={{ padding: '12px 16px' }}>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 42,
          letterSpacing: '0.08em',
          color: 'var(--color-esi-c-100)',
          textShadow: '0 0 12px rgba(126,231,255,0.5)',
          lineHeight: 1
        }}
      >
        {hh}:{mm}
        <span style={{ fontSize: 22, color: 'var(--color-esi-c-300)', marginLeft: 6 }}>
          :{ss}
        </span>
      </div>
      <div
        className="mono"
        style={{
          fontSize: 10,
          color: 'var(--color-esi-fg-dim)',
          marginTop: 6,
          letterSpacing: '0.2em',
          textTransform: 'uppercase'
        }}
      >
        {date}
      </div>
    </div>
  )
}
