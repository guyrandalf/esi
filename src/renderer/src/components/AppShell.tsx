import { useState, useEffect } from 'react'
import { Sidebar } from './Sidebar'
import { ConversationView } from './ConversationView'
import { InputBar } from './InputBar'
import { ActivityColumn } from './ActivityColumn'
import { ArcReactor } from './panels/ArcReactor'
import { MeetingOverlay } from './MeetingOverlay'
import { SettingsModal } from './SettingsModal'

export function AppShell(): React.JSX.Element {
  const [thinking, setThinking] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  async function handleSubmit(text: string): Promise<void> {
    setThinking(true)
    try {
      await window.esi?.sendCommand(text)
    } finally {
      setThinking(false)
    }
  }

  useEffect(() => {
    const h = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault()
        setSettingsOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  return (
    /*
      IMPORTANT: This is the outermost container.
      Using a simple flex column with a hardcoded margin on the inner wrapper
      to guarantee nothing ever touches screen edges.
    */
    <div
      style={{
        width: '100vw',
        height: '100vh',
        position: 'relative',
        overflow: 'hidden',
        pointerEvents: 'none'
      }}
    >
      {/* Arc Reactor — fixed center, behind panels */}
      <div
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 0,
          pointerEvents: 'none'
        }}
      >
        <ArcReactor thinking={thinking} />
      </div>

      {/* The actual padded content frame — ALL panels live inside this box */}
      <div
        style={{
          position: 'absolute',
          top: '32px',
          left: '32px',
          right: '32px',
          bottom: '32px',
          display: 'flex',
          gap: '24px',
          zIndex: 10,
          pointerEvents: 'none'
        }}
      >
        {/* LEFT COLUMN */}
        <div
          style={{
            width: '360px',
            minWidth: '360px',
            maxWidth: '360px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            pointerEvents: 'auto',
            paddingBottom: '80px' /* leave room for input bar */
          }}
        >
          <Sidebar />
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <ConversationView thinking={thinking} />
          </div>
        </div>

        {/* CENTER — empty for Arc Reactor to show through */}
        <div style={{ flex: 1, minWidth: 0 }} />

        {/* RIGHT COLUMN */}
        <div
          style={{
            width: '360px',
            minWidth: '360px',
            maxWidth: '360px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            pointerEvents: 'auto',
            paddingBottom: '80px'
          }}
        >
          {/* Diagnostics mini-panel */}
          <div
            className="hud-panel rounded-2xl"
            style={{
              background: 'var(--color-esi-panel)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              border: '1px solid var(--color-esi-panel-border)',
              boxShadow: '0 4px 20px rgba(15, 18, 32, 0.06)',
              padding: '20px',
              pointerEvents: 'auto',
              flexShrink: 0
            }}
            onMouseEnter={() => window.esi?.setIgnoreMouse(false)}
            onMouseLeave={() => window.esi?.setIgnoreMouse(true)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: '4px', height: '16px', borderRadius: '2px', background: 'var(--color-esi-gold)' }} />
              <span
                style={{
                  fontFamily: 'var(--font-orbitron)',
                  color: 'var(--color-esi-gold)',
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.2em'
                }}
              >
                Diagnostics
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontFamily: 'var(--font-mono)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ opacity: 0.4 }}>Threat Level</span><span>Nominal</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ opacity: 0.4 }}>Energy Matrix</span><span>98.4%</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ opacity: 0.4 }}>Neural Threads</span><span>Multiplexing</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ opacity: 0.4 }}>Mem Pool</span><span>Stable</span></div>
            </div>
          </div>

          {/* System Logs */}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <ActivityColumn />
          </div>
        </div>
      </div>

      {/* Input Bar — pinned bottom center, inside the same 32px margin */}
      <div
        style={{
          position: 'absolute',
          bottom: '32px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '560px',
          zIndex: 20,
          pointerEvents: 'auto'
        }}
      >
        <InputBar onSubmit={handleSubmit} thinking={thinking} />
      </div>

      <MeetingOverlay />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
