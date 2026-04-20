import { useEffect, useState } from 'react'
import type { VoiceState } from './panels/ArcReactor'

export type TabId = 'overview' | 'memory' | 'meetings' | 'archive'
const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'OVERVIEW' },
  { id: 'memory', label: 'MEMORY' },
  { id: 'meetings', label: 'MEETINGS' },
  { id: 'archive', label: 'ARCHIVE' }
]

export function TopBar({
  voiceState,
  currentTab,
  onTab,
  onSettings
}: {
  voiceState: VoiceState
  currentTab: TabId
  onTab: (tab: TabId) => void
  onSettings: () => void
}): React.JSX.Element {
  const [now, setNow] = useState(new Date())
  const [wide, setWide] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 1180 : true
  )
  const [medium, setMedium] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 980 : true
  )

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    const onResize = (): void => {
      setWide(window.innerWidth >= 1180)
      setMedium(window.innerWidth >= 980)
    }
    window.addEventListener('resize', onResize)
    return () => {
      clearInterval(t)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  const time = `${String(now.getHours()).padStart(2, '0')}:${String(
    now.getMinutes()
  ).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`

  return (
    <div
      className="drag-region"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        borderBottom: '1px solid rgba(126,231,255,0.15)',
        background:
          'linear-gradient(180deg, rgba(10,19,31,0.85), rgba(3,7,13,0.4))',
        position: 'relative',
        zIndex: 10,
        flexWrap: 'nowrap',
        whiteSpace: 'nowrap',
        gap: 12,
        minWidth: 0,
        overflow: 'hidden'
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          minWidth: 0,
          flexShrink: 1,
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 13,
            letterSpacing: '0.28em',
            color: 'var(--color-esi-c-100)',
            textShadow: '0 0 8px rgba(126,231,255,0.5)',
            whiteSpace: 'nowrap',
            flexShrink: 0
          }}
        >
          E·S·I
          <span
            style={{
              color: 'var(--color-esi-fg-dimmer)',
              marginLeft: 8,
              fontSize: 9,
              letterSpacing: '0.18em'
            }}
          >
            v1.0.0
          </span>
        </div>

        {wide && (
          <div className="no-drag" style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            {TABS.map((tab) => {
              const active = currentTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => onTab(tab.id)}
                  style={{
                    padding: '5px 12px',
                    background: active ? 'rgba(126,231,255,0.08)' : 'transparent',
                    border: `1px solid ${
                      active ? 'var(--color-esi-c-300)' : 'rgba(126,231,255,0.15)'
                    }`,
                    color: active ? 'var(--color-esi-c-100)' : 'var(--color-esi-fg-dim)',
                    fontFamily: 'var(--font-display)',
                    fontSize: 9,
                    letterSpacing: '0.2em',
                    cursor: 'pointer',
                    borderRadius: 2,
                    transition: 'all 150ms'
                  }}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div
        className="no-drag"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--color-esi-fg-dim)',
          whiteSpace: 'nowrap',
          flexShrink: 0
        }}
      >
        {medium && <StatusLED color="var(--color-esi-good)" label="CORE" />}
        {medium && <StatusLED color="var(--color-esi-c-200)" label="CLAUDE-NET" />}
        <StatusLED
          color="var(--color-esi-good)"
          label={`AI·${voiceState.toUpperCase()}`}
        />
        <div
          style={{
            color: 'var(--color-esi-c-100)',
            letterSpacing: '0.2em',
            fontSize: 12
          }}
        >
          {time}
        </div>
        <button
          onClick={onSettings}
          title="Settings (⌘,)"
          style={{
            background: 'transparent',
            border: '1px solid rgba(126,231,255,0.25)',
            color: 'var(--color-esi-c-200)',
            fontFamily: 'var(--font-display)',
            fontSize: 9,
            letterSpacing: '0.2em',
            padding: '4px 10px',
            cursor: 'pointer',
            borderRadius: 2
          }}
        >
          CFG
        </button>
      </div>
    </div>
  )
}

function StatusLED({ color, label }: { color: string; label: string }): React.JSX.Element {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: color,
          boxShadow: `0 0 6px ${color}`,
          animation: 'esi-pulse-glow 2s ease-in-out infinite',
          flexShrink: 0
        }}
      />
      <span style={{ letterSpacing: '0.12em', whiteSpace: 'nowrap' }}>{label}</span>
    </div>
  )
}
