import { useEffect, useState } from 'react'

const LINES: Array<{ t: number; line: string }> = [
  { t: 0, line: 'INITIATING E.S.I. KERNEL v1.0.0' },
  { t: 120, line: 'Loading neural matrix................ [ OK ]' },
  { t: 260, line: 'Mounting semantic memory store....... [ OK ]' },
  { t: 400, line: 'Wiring Claude bridge................. [ OK ]' },
  { t: 540, line: 'Calibrating holographic HUD.......... [ OK ]' },
  { t: 680, line: 'Booting Ollama + Gemini routers...... [ OK ]' },
  { t: 820, line: 'Voice capture · Whisper online....... [ OK ]' },
  { t: 960, line: 'Calendar relay engaged............... [ OK ]' },
  { t: 1100, line: '' },
  { t: 1180, line: 'GOOD TO SEE YOU AGAIN.' }
]

export function BootSequence({ onDone }: { onDone: () => void }): React.JSX.Element {
  const [shown, setShown] = useState(0)

  useEffect(() => {
    const timers = LINES.map((l, i) =>
      setTimeout(() => setShown(i + 1), l.t)
    )
    const finish = setTimeout(onDone, 2200)
    return () => {
      timers.forEach(clearTimeout)
      clearTimeout(finish)
    }
  }, [onDone])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--color-esi-bg-0)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        animation: 'esi-flicker 0.15s steps(2) 2'
      }}
    >
      <div
        style={{
          width: 680,
          maxWidth: '80vw',
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          color: 'var(--color-esi-c-200)'
        }}
      >
        {LINES.slice(0, shown).map((l, i) => {
          const isGreeting = l.line.startsWith('GOOD')
          return (
            <div
              key={i}
              style={{
                padding: '2px 0',
                opacity: l.line === '' ? 0 : 1,
                color: isGreeting ? 'var(--color-esi-c-100)' : 'var(--color-esi-c-200)',
                fontFamily: isGreeting ? 'var(--font-display)' : 'var(--font-mono)',
                letterSpacing: isGreeting ? '0.35em' : '0.04em',
                fontSize: isGreeting ? 18 : 13,
                textShadow: isGreeting ? '0 0 8px var(--color-esi-c-200)' : 'none',
                textAlign: isGreeting ? 'center' : 'left',
                marginTop: isGreeting ? 20 : 0
              }}
            >
              {l.line}
            </div>
          )
        })}
        {shown < LINES.length && (
          <span
            style={{
              display: 'inline-block',
              width: 10,
              height: 14,
              background: 'var(--color-esi-c-100)',
              marginLeft: 2,
              verticalAlign: 'text-bottom',
              animation: 'esi-blink 0.5s step-end infinite'
            }}
          />
        )}
      </div>
    </div>
  )
}
