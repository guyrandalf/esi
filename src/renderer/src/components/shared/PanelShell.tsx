import { ReactNode } from 'react'

interface PanelShellProps {
  title: string
  children: ReactNode
  className?: string
  style?: React.CSSProperties
  right?: ReactNode
  /** Backwards-compat — no longer used (color comes from CSS) */
  glowColor?: 'cyan' | 'violet' | 'green' | 'gold' | 'red'
  /** Backwards-compat — kept so older call sites still compile */
  delay?: number
}

/**
 * JARVIS-style panel: cyan corner brackets, panel-head with dot, backdrop blur.
 * Drives all panels in the ESI shell.
 */
export function PanelShell({
  title,
  children,
  className = '',
  style,
  right
}: PanelShellProps): React.JSX.Element {
  return (
    <div
      className={`panel hud-panel flex flex-col ${className}`}
      style={{ minHeight: 0, ...style }}
    >
      <div className="panel-head">
        <span>
          <span className="dot" />
          {title.toUpperCase()}
        </span>
        {right}
      </div>
      <div
        className="flex-1 min-h-0 overflow-auto"
        style={{ padding: '10px 14px 12px' }}
      >
        {children}
      </div>
    </div>
  )
}
