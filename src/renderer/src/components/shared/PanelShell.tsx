import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

type AccentColor = 'cyan' | 'violet' | 'green' | 'gold' | 'red'

const accentMap: Record<AccentColor, string> = {
  cyan: 'var(--color-esi-cyan)',
  violet: 'var(--color-esi-violet)',
  green: 'var(--color-esi-green)',
  gold: 'var(--color-esi-gold)',
  red: 'var(--color-esi-red)'
}

interface Props {
  title: string
  accent?: AccentColor
  live?: boolean
  children: ReactNode
  className?: string
  delay?: number
}

export function PanelShell({
  title,
  accent = 'cyan',
  live = false,
  children,
  className = '',
  delay = 0
}: Props): React.JSX.Element {
  const color = accentMap[accent]

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
      className={`relative flex flex-col rounded-md backdrop-blur-md ${className}`}
      style={{
        background: 'var(--color-esi-panel)',
        border: `1px solid var(--color-esi-border)`,
        boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.02), 0 0 24px -8px ${color}33`
      }}
    >
      <div
        className="flex items-center justify-between px-4 py-2 border-b"
        style={{ borderColor: 'var(--color-esi-border)' }}
      >
        <div className="flex items-center gap-2.5">
          <span
            className={`inline-block w-2 h-2 rounded-full ${live ? 'pulse-dot' : ''}`}
            style={{ background: color, boxShadow: `0 0 8px ${color}` }}
          />
          <span
            className="text-[11px] tracking-[0.28em] uppercase"
            style={{ color, fontFamily: 'var(--font-display)', fontWeight: 600 }}
          >
            {title}
          </span>
        </div>
      </div>
      <div className="flex-1 px-4 py-3 overflow-hidden">{children}</div>
    </motion.div>
  )
}
