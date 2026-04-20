import { useEffect, useRef, useState } from 'react'

export type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking'

interface ArcReactorProps {
  state?: VoiceState
  /** Legacy prop: true coerces state to 'thinking' */
  thinking?: boolean
  size?: number
}

export function ArcReactor({ state, thinking, size: sizeProp }: ArcReactorProps): React.JSX.Element {
  const effective: VoiceState = state ?? (thinking ? 'thinking' : 'idle')
  const wrapRef = useRef<HTMLDivElement>(null)
  const [measured, setMeasured] = useState<number>(sizeProp ?? 360)
  const [liveLevel, setLiveLevel] = useState(0)

  // Subscribe to the live mic level stream; applies a gentle decay so the
  // reactor doesn't strobe on instantaneous spikes.
  useEffect(() => {
    const off = window.esi?.onMicLevel?.((level) => {
      setLiveLevel((prev) => Math.max(level, prev * 0.75))
    })
    // Idle decay tick — drains the level back down even without new frames
    const tick = setInterval(() => {
      setLiveLevel((prev) => prev * 0.85)
    }, 80)
    return () => {
      off?.()
      clearInterval(tick)
    }
  }, [])

  useEffect(() => {
    if (sizeProp) {
      setMeasured(sizeProp)
      return
    }
    const el = wrapRef.current
    if (!el) return
    const parent = el.parentElement
    if (!parent) return
    const measure = (): void => {
      const w = parent.clientWidth
      const h = parent.clientHeight
      const s = Math.max(180, Math.min(w, h) * 0.92)
      setMeasured(s)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(parent)
    return () => ro.disconnect()
  }, [sizeProp])

  const baseIntensity =
    {
      idle: { pulse: 0.55, spin: 1, wave: 0.15, color: 'var(--color-esi-c-200)' },
      listening: { pulse: 0.85, spin: 1.4, wave: 0.55, color: 'var(--color-esi-c-200)' },
      thinking: { pulse: 0.7, spin: 2.2, wave: 0.35, color: 'var(--color-esi-c-100)' },
      speaking: { pulse: 1.0, spin: 1.6, wave: 0.85, color: 'var(--color-esi-c-100)' }
    }[effective] ?? {
      pulse: 0.6,
      spin: 1,
      wave: 0.2,
      color: 'var(--color-esi-c-200)'
    }

  // Live mic level blends into intensity when listening or idle. When
  // listening, the waveform should spike with every word; when idle it
  // still gives the core a subtle "ambient life" reaction to room sound.
  const liveBoost =
    effective === 'listening' ? liveLevel * 1.6 : effective === 'idle' ? liveLevel * 0.8 : 0
  const intensity = {
    ...baseIntensity,
    pulse: Math.min(1.3, baseIntensity.pulse + liveBoost * 0.4),
    wave: Math.min(1.2, baseIntensity.wave + liveBoost)
  }

  const s = measured
  const cx = s / 2
  const cy = s / 2

  return (
    <div
      ref={wrapRef}
      style={{
        position: 'relative',
        width: s,
        height: s,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      {/* Outer glow halo */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(circle, rgba(126,231,255,${0.18 * intensity.pulse}) 0%, transparent 55%)`,
          filter: 'blur(20px)',
          animation: `esi-pulse-glow ${3 / intensity.pulse}s ease-in-out infinite`
        }}
      />

      <svg
        width={s}
        height={s}
        viewBox={`0 0 ${s} ${s}`}
        style={{ position: 'relative', overflow: 'visible' }}
      >
        <defs>
          <radialGradient id="esi-core-grad">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="30%" stopColor="#b8f1ff" stopOpacity="0.9" />
            <stop offset="70%" stopColor="#4dd8f7" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#0a4d6b" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="esi-arc-grad" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#7ee7ff" stopOpacity="0" />
            <stop offset="50%" stopColor="#b8f1ff" stopOpacity="1" />
            <stop offset="100%" stopColor="#7ee7ff" stopOpacity="0" />
          </linearGradient>
          <filter id="esi-soft-glow">
            <feGaussianBlur stdDeviation="2" />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Ring 1 — outermost, tick marks, CW */}
        <g
          style={{
            transformOrigin: `${cx}px ${cy}px`,
            animation: `esi-rotate-cw ${80 / intensity.spin}s linear infinite`
          }}
        >
          <circle
            cx={cx}
            cy={cy}
            r={s * 0.48}
            fill="none"
            stroke="rgba(126,231,255,0.15)"
            strokeWidth="1"
          />
          {Array.from({ length: 72 }).map((_, i) => {
            const a = (i / 72) * Math.PI * 2
            const r1 = s * 0.47
            const r2 = s * 0.49
            const big = i % 6 === 0
            return (
              <line
                key={i}
                x1={cx + Math.cos(a) * r1}
                y1={cy + Math.sin(a) * r1}
                x2={cx + Math.cos(a) * (big ? r2 + 4 : r2)}
                y2={cy + Math.sin(a) * (big ? r2 + 4 : r2)}
                stroke="rgba(126,231,255,0.5)"
                strokeWidth={big ? 1.5 : 0.7}
              />
            )
          })}
          {['000', '090', '180', '270'].map((label, i) => {
            const a = (i / 4) * Math.PI * 2 - Math.PI / 2
            const r = s * 0.44
            return (
              <text
                key={label}
                x={cx + Math.cos(a) * r}
                y={cy + Math.sin(a) * r}
                fill="rgba(126,231,255,0.7)"
                fontFamily="var(--font-mono)"
                fontSize={s * 0.018}
                textAnchor="middle"
                dominantBaseline="middle"
                letterSpacing="2"
              >
                {label}
              </text>
            )
          })}
        </g>

        {/* Ring 2 — dashed, CCW */}
        <g
          style={{
            transformOrigin: `${cx}px ${cy}px`,
            animation: `esi-rotate-ccw ${40 / intensity.spin}s linear infinite`
          }}
        >
          <circle
            cx={cx}
            cy={cy}
            r={s * 0.4}
            fill="none"
            stroke="rgba(126,231,255,0.4)"
            strokeWidth="1"
            strokeDasharray="4 6"
          />
          <circle
            cx={cx}
            cy={cy}
            r={s * 0.4}
            fill="none"
            stroke="rgba(126,231,255,0.2)"
            strokeWidth="1"
            strokeDasharray="2 14"
            strokeDashoffset="3"
          />
        </g>

        {/* Ring 3 — broken arcs, CW */}
        <g
          style={{
            transformOrigin: `${cx}px ${cy}px`,
            animation: `esi-rotate-cw ${15 / intensity.spin}s linear infinite`
          }}
        >
          <path
            d={`M ${cx + s * 0.33} ${cy} A ${s * 0.33} ${s * 0.33} 0 0 1 ${cx - s * 0.33} ${cy}`}
            fill="none"
            stroke="url(#esi-arc-grad)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d={`M ${cx - s * 0.33} ${cy} A ${s * 0.33} ${s * 0.33} 0 0 1 ${cx + s * 0.28} ${cy - s * 0.17}`}
            fill="none"
            stroke="rgba(126,231,255,0.6)"
            strokeWidth="1.5"
          />
          <circle
            cx={cx + s * 0.33}
            cy={cy}
            r="3"
            fill="#b8f1ff"
            filter="url(#esi-soft-glow)"
          />
        </g>

        {/* Ring 4 — thin CCW fast */}
        <g
          style={{
            transformOrigin: `${cx}px ${cy}px`,
            animation: `esi-rotate-ccw ${8 / intensity.spin}s linear infinite`
          }}
        >
          <circle
            cx={cx}
            cy={cy}
            r={s * 0.27}
            fill="none"
            stroke="rgba(184,241,255,0.5)"
            strokeWidth="1"
            strokeDasharray="20 80"
          />
          <circle
            cx={cx}
            cy={cy}
            r={s * 0.25}
            fill="none"
            stroke="rgba(184,241,255,0.2)"
            strokeWidth="0.6"
          />
        </g>

        {/* Core orb */}
        <circle
          cx={cx}
          cy={cy}
          r={s * 0.22}
          fill="url(#esi-core-grad)"
          style={{
            animation: `esi-pulse-glow ${2.5 / intensity.pulse}s ease-in-out infinite`
          }}
        />
        <circle
          cx={cx}
          cy={cy}
          r={s * 0.14}
          fill="none"
          stroke="rgba(255,255,255,0.8)"
          strokeWidth="0.8"
        />
        <circle cx={cx} cy={cy} r={s * 0.08} fill="rgba(255,255,255,0.95)" />

        {/* Radial waveform */}
        <VoiceRadial
          cx={cx}
          cy={cy}
          r={s * 0.32}
          bars={48}
          intensity={intensity.wave}
          state={effective}
        />

        {/* Crosshair reticle */}
        <g stroke="rgba(126,231,255,0.4)" strokeWidth="0.8">
          <line x1={cx - s * 0.49} y1={cy} x2={cx - s * 0.42} y2={cy} />
          <line x1={cx + s * 0.42} y1={cy} x2={cx + s * 0.49} y2={cy} />
          <line x1={cx} y1={cy - s * 0.49} x2={cx} y2={cy - s * 0.42} />
          <line x1={cx} y1={cy + s * 0.42} x2={cx} y2={cy + s * 0.49} />
        </g>
      </svg>

      {/* State label */}
      <div
        style={{
          position: 'absolute',
          bottom: -8,
          left: '50%',
          transform: 'translateX(-50%)',
          fontFamily: 'var(--font-display)',
          fontSize: 10,
          letterSpacing: '0.4em',
          color: intensity.color,
          textShadow: `0 0 8px ${intensity.color}`,
          padding: '4px 12px',
          background: 'rgba(3,7,13,0.8)',
          border: '1px solid rgba(126,231,255,0.3)',
          whiteSpace: 'nowrap'
        }}
      >
        {effective.toUpperCase()}
      </div>
    </div>
  )
}

function VoiceRadial({
  cx,
  cy,
  r,
  bars,
  intensity,
  state
}: {
  cx: number
  cy: number
  r: number
  bars: number
  intensity: number
  state: VoiceState
}): React.JSX.Element {
  const [phase, setPhase] = useState(0)
  useEffect(() => {
    let raf = 0
    const tick = (): void => {
      setPhase(
        (p) => p + (state === 'speaking' ? 0.18 : state === 'listening' ? 0.1 : 0.04)
      )
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [state])

  return (
    <g>
      {Array.from({ length: bars }).map((_, i) => {
        const a = (i / bars) * Math.PI * 2
        const h =
          (Math.sin(phase + i * 0.6) * 0.5 + 0.5) * intensity * r * 0.35 +
          (Math.sin(phase * 1.7 + i) * 0.5 + 0.5) * intensity * r * 0.2 +
          2
        const r2 = r + h
        return (
          <line
            key={i}
            x1={cx + Math.cos(a) * r}
            y1={cy + Math.sin(a) * r}
            x2={cx + Math.cos(a) * r2}
            y2={cy + Math.sin(a) * r2}
            stroke="rgba(184,241,255,0.8)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        )
      })}
    </g>
  )
}
