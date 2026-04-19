import { useEffect, useState } from 'react'

export function SystemPulse(): React.JSX.Element {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const time = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })

  return (
    <div
      className="flex items-center gap-4 text-[12px] tracking-wider uppercase"
      style={{ color: 'var(--color-esi-muted)' }}
    >
      <span>
        <span style={{ color: 'var(--color-esi-cyan)' }}>SYS</span>
        <span className="mx-1.5">·</span>
        VSCode
      </span>
      <span style={{ color: 'var(--color-esi-border)' }}>│</span>
      <span>esi/src/App.tsx</span>
      <span style={{ color: 'var(--color-esi-border)' }}>│</span>
      <span>M3 Pro · 34%</span>
      <span style={{ color: 'var(--color-esi-border)' }}>│</span>
      <span
        className="tabular-nums"
        style={{ color: 'var(--color-esi-text)', fontFamily: 'var(--font-display)' }}
      >
        {time}
      </span>
    </div>
  )
}
