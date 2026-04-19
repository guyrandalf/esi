import { motion } from 'framer-motion'

export function ArcReactor({ thinking }: { thinking: boolean }): React.JSX.Element {
  const color = thinking ? '#fbbf24' : '#00d4ff'
  const glowColor = thinking ? 'rgba(251, 191, 36, 0.3)' : 'rgba(0, 212, 255, 0.25)'

  return (
    <div
      style={{
        position: 'relative',
        width: '420px',
        height: '420px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        filter: `drop-shadow(0 0 50px ${glowColor})`
      }}
    >
      {/* E.S.I. Center Label */}
      <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 10 }}>
        <motion.div
          animate={{ scale: thinking ? [1, 1.04, 1] : 1 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            fontSize: '40px',
            fontWeight: 900,
            letterSpacing: '0.3em',
            fontFamily: 'var(--font-orbitron)',
            color: color,
            textShadow: `0 0 25px ${glowColor}`,
            marginLeft: '12px'
          }}
        >
          E.S.I.
        </motion.div>
        <span style={{ fontSize: '11px', letterSpacing: '0.4em', fontWeight: 700, textTransform: 'uppercase', marginTop: '4px', marginLeft: '8px', opacity: 0.6, color: color }}>
          {thinking ? 'Processing' : 'Active'}
        </span>
      </div>

      <svg width="420" height="420" viewBox="0 0 420 420" style={{ position: 'absolute', top: 0, left: 0 }}>
        {/* Inner ring */}
        <motion.circle cx="210" cy="210" r="70" fill="none" stroke={color} strokeWidth="1.5" style={{ opacity: 0.3 }} />

        {/* Thick segmented ring */}
        <motion.circle
          cx="210" cy="210" r="85" fill="none" stroke={color} strokeWidth="8"
          strokeDasharray="18 4 35 4 8 4 50 4 5 4"
          animate={{ rotate: thinking ? 360 : 180 }}
          transition={{ duration: thinking ? 6 : 40, repeat: Infinity, ease: 'linear' }}
          style={{ originX: '50%', originY: '50%', opacity: 0.5 }}
        />

        {/* Outer bounding ring */}
        <motion.circle
          cx="210" cy="210" r="105" fill="none" stroke={color} strokeWidth="2"
          strokeDasharray="80 15 40 10"
          animate={{ rotate: -360 }}
          transition={{ duration: thinking ? 15 : 60, repeat: Infinity, ease: 'linear' }}
          style={{ originX: '50%', originY: '50%', opacity: 0.4 }}
        />

        {/* Radial equalizer bars */}
        <g>
          {Array.from({ length: 72 }).map((_, i) => {
            const angle = (i * 360 / 72) * (Math.PI / 180)
            const rStart = 115
            const baseLen = 10 + Math.sin(i * 0.4) * 7 + Math.cos(i * 1.5) * 10
            const absoluteBase = Math.abs(baseLen) + 4
            const dynamicLen = absoluteBase * (thinking ? 2 : 1)
            const spikeLen = rStart + dynamicLen

            const x1 = 210 + rStart * Math.cos(angle)
            const y1 = 210 + rStart * Math.sin(angle)
            const x2 = 210 + spikeLen * Math.cos(angle)
            const y2 = 210 + spikeLen * Math.sin(angle)

            return (
              <motion.line
                key={i}
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={color} strokeWidth="3" strokeLinecap="round"
                initial={{ opacity: 0.2 }}
                animate={thinking ? { opacity: [0.2, 0.7, 0.2] } : { opacity: 0.3 }}
                transition={{ duration: 0.3 + Math.random() * 0.4, repeat: Infinity, delay: Math.random() }}
              />
            )
          })}
        </g>
      </svg>
    </div>
  )
}
