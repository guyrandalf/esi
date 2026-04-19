import { useState } from 'react'
import { Sidebar } from './Sidebar'
import { ConversationView } from './ConversationView'
import { InputBar } from './InputBar'
import { ActivityColumn } from './ActivityColumn'

export function AppShell(): React.JSX.Element {
  const [thinking, setThinking] = useState(false)

  async function handleSubmit(text: string): Promise<void> {
    setThinking(true)
    try {
      await window.esi?.sendCommand(text)
    } finally {
      setThinking(false)
    }
  }

  return (
    <div className="w-screen h-screen flex flex-col p-6 gap-6 overflow-hidden">
      {/* Top Header */}
      <header 
        className="drag-region shrink-0 flex items-center justify-between px-6 py-2 rounded-lg border backdrop-blur-md"
        style={{ 
          backgroundColor: 'var(--color-esi-panel)',
          borderColor: 'var(--color-esi-border-soft)'
        }}
        onMouseEnter={() => {
          window.esi?.setIgnoreMouse(false)
        }}
        onMouseLeave={() => {
          window.esi?.setIgnoreMouse(true)
        }}
      >
        <div className="flex items-center gap-4">
          <span className="text-[18px] font-bold tracking-widest" style={{ color: 'var(--color-esi-cyan)', fontFamily: 'var(--font-orbitron)' }}>
            E.S.I.
          </span>
          <span className="text-[11px] uppercase tracking-widest px-3 py-1 rounded border" style={{ color: 'var(--color-esi-violet)', borderColor: 'var(--color-esi-border-soft)', backgroundColor: 'rgba(124, 106, 255, 0.1)' }}>
            System Online
          </span>
        </div>

        <div className="no-drag flex items-center gap-3">
          <span
            className="inline-block w-2 h-2 rounded-full shadow-[0_0_8px_currentColor]"
            style={{
              color: thinking ? 'var(--color-esi-gold)' : 'var(--color-esi-cyan)',
              backgroundColor: 'currentColor'
            }}
          />
          <span
            className="text-[12px] tracking-wider uppercase font-semibold"
            style={{ color: 'var(--color-esi-text-dim)' }}
          >
            {thinking ? 'Processing...' : 'Awaiting Command'}
          </span>
        </div>
      </header>

      {/* Main Grid */}
      <main className="flex-1 min-h-0 flex gap-6">
        {/* Left Column */}
        <div className="w-[300px] shrink-0 flex flex-col gap-6">
          <Sidebar />
        </div>

        {/* Center Grid */}
        <div className="flex-1 min-w-0 flex flex-col gap-6">
          <ConversationView thinking={thinking} />
          <InputBar onSubmit={handleSubmit} thinking={thinking} />
        </div>

        {/* Right Column */}
        <div className="w-[340px] shrink-0 flex flex-col gap-6">
          <ActivityColumn />
        </div>
      </main>
    </div>
  )
}
