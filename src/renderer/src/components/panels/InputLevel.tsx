import { useEffect, useState } from 'react'
import type { VoiceState } from './ArcReactor'

export function InputLevel({
  state,
  bars = 80
}: {
  state: VoiceState
  bars?: number
}): React.JSX.Element {
  return (
    <div className="panel" style={{ padding: '10px 14px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 6,
          gap: 8
        }}
      >
        <span
          className="mono"
          style={{
            fontSize: 10,
            color: 'var(--color-esi-c-200)',
            letterSpacing: '0.2em',
            whiteSpace: 'nowrap'
          }}
        >
          INPUT LEVEL
        </span>
        <span
          className="mono"
          style={{
            fontSize: 9,
            color: 'var(--color-esi-fg-dim)',
            whiteSpace: 'nowrap'
          }}
        >
          48kHz · -12dB
        </span>
      </div>
      <Waveform state={state} bars={bars} />
    </div>
  )
}

function Waveform({ state, bars }: { state: VoiceState; bars: number }): React.JSX.Element {
  const [phase, setPhase] = useState(0)
  useEffect(() => {
    let raf = 0
    const tick = (): void => {
      setPhase(
        (p) => p + (state === 'speaking' ? 0.22 : state === 'listening' ? 0.12 : 0.04)
      )
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [state])

  const amp =
    state === 'speaking' ? 1 : state === 'listening' ? 0.7 : state === 'thinking' ? 0.35 : 0.18

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        height: 36,
        width: '100%'
      }}
    >
      {Array.from({ length: bars }).map((_, i) => {
        const h =
          (Math.sin(phase + i * 0.4) * 0.5 + 0.5) * amp * 0.7 +
          (Math.sin(phase * 2.1 + i * 0.9) * 0.5 + 0.5) * amp * 0.3 +
          0.05
        return (
          <div
            key={i}
            style={{
              flex: 1,
              height: `${h * 100}%`,
              background: 'linear-gradient(to top, var(--color-esi-c-500), var(--color-esi-c-100))',
              boxShadow: '0 0 4px rgba(126,231,255,0.6)',
              borderRadius: 1,
              transition: 'height 60ms'
            }}
          />
        )
      })}
    </div>
  )
}
