import { ReactNode } from 'react'
import { motion } from 'framer-motion'

interface PanelShellProps {
  title: string
  children: ReactNode
  className?: string
  glowColor?: 'cyan' | 'violet' | 'green' | 'gold' | 'red'
  delay?: number
}

export function PanelShell({
  title,
  children,
  className = '',
  glowColor = 'cyan',
  delay = 0
}: PanelShellProps): React.JSX.Element {
  const colorMap: Record<string, string> = {
    cyan: 'var(--color-esi-cyan)',
    violet: 'var(--color-esi-violet)',
    green: 'var(--color-esi-green)',
    gold: 'var(--color-esi-gold)',
    red: 'var(--color-esi-red)'
  }
  const accent = colorMap[glowColor] ?? colorMap.cyan

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: 'circOut' }}
      className={`hud-panel relative flex flex-col pointer-events-auto rounded-2xl ${className}`}
      style={{
        background: 'var(--color-esi-panel)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid var(--color-esi-panel-border)',
        boxShadow: '0 4px 20px rgba(15, 18, 32, 0.06)'
      }}
      onMouseEnter={() => window.esi?.setIgnoreMouse(false)}
      onMouseLeave={() => window.esi?.setIgnoreMouse(true)}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-4 pb-2 shrink-0">
        <div className="w-1 h-4 rounded-full" style={{ backgroundColor: accent }} />
        <span
          className="uppercase tracking-[0.2em] text-[11px] font-bold"
          style={{ fontFamily: 'var(--font-orbitron)', color: accent }}
        >
          {title}
        </span>
        <div
          className="flex-1 h-px opacity-30"
          style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-auto px-5 pb-5 custom-scrollbar">
        {children}
      </div>
    </motion.div>
  )
}
