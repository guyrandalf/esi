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
  const colorMap = {
    cyan: 'var(--color-esi-cyan)',
    violet: 'var(--color-esi-violet)',
    green: 'var(--color-esi-green)',
    gold: 'var(--color-esi-gold)',
    red: 'var(--color-esi-red)'
  }

  const borderGlow = colorMap[glowColor]

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
      className={`hud-panel relative flex flex-col backdrop-blur-md rounded-lg overflow-hidden border ${className}`}
      style={{
        backgroundColor: 'var(--color-esi-panel)',
        borderColor: 'var(--color-esi-border-soft)',
        boxShadow: `0 0 15px -5px ${borderGlow}33`
      }}
      onMouseEnter={() => {
        window.esi?.setIgnoreMouse(false)
      }}
      onMouseLeave={() => {
        window.esi?.setIgnoreMouse(true)
      }}
    >
      {/* HUD Panel Header */}
      <div 
        className="h-8 flex items-center px-4 shrink-0 border-b"
        style={{ 
          borderColor: 'var(--color-esi-border-soft)',
          background: `linear-gradient(90deg, ${borderGlow}22 0%, transparent 100%)`
        }}
      >
        <div className="flex items-center gap-2">
          {/* Decorative scanner line */}
          <div 
            className="w-1 h-3 rounded-full"
            style={{ backgroundColor: borderGlow, boxShadow: `0 0 8px ${borderGlow}` }}
          />
          <span 
            className="uppercase tracking-[0.15em] text-[11px] font-bold opacity-90"
            style={{ fontFamily: 'var(--font-orbitron)', color: borderGlow }}
          >
            {title}
          </span>
        </div>
      </div>
      
      {/* Panel Inner Content */}
      <div className="flex-1 overflow-auto p-4 custom-scrollbar">
        {children}
      </div>
      
      {/* Decorative corners */}
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l" style={{ borderColor: borderGlow }} />
      <div className="absolute top-0 right-0 w-2 h-2 border-t border-r" style={{ borderColor: borderGlow }} />
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l" style={{ borderColor: borderGlow }} />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r" style={{ borderColor: borderGlow }} />
    </motion.div>
  )
}
