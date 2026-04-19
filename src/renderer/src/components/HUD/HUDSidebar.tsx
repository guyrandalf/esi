import { motion } from 'framer-motion'
import { useState } from 'react'
import { VoiceWaveform } from '../panels/VoiceWaveform'
import { CalendarStrip } from '../panels/CalendarStrip'
import { ActionLog } from '../panels/ActionLog'

export function HUDSidebar({
  onToggleMode
}: {
  onToggleMode: () => void
}): React.JSX.Element {
  const [input, setInput] = useState('')

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!input.trim()) return
    await window.esi?.sendCommand(input)
    setInput('')
  }

  return (
    <motion.div
      initial={{ x: 340, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 340, opacity: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="h-screen w-full p-4"
    >
      <div
        className="h-full w-full flex flex-col p-4 gap-4 rounded-2xl overflow-hidden"
        style={{
          background: 'var(--color-esi-bg)',
          border: '1px solid var(--color-esi-border-strong)',
          boxShadow:
            '0 20px 60px -20px rgba(0,0,0,0.6), 0 0 40px -10px rgba(34, 211, 238, 0.25)',
          backdropFilter: 'blur(24px) saturate(140%)',
          WebkitBackdropFilter: 'blur(24px) saturate(140%)'
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="pulse-dot inline-block w-2 h-2 rounded-full"
              style={{
                background: 'var(--color-esi-cyan)',
                boxShadow: '0 0 10px var(--color-esi-cyan)'
              }}
            />
            <span
              className="tracking-[0.4em] text-base"
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                color: 'var(--color-esi-text)'
              }}
            >
              ESI
            </span>
          </div>
          <button
            onClick={onToggleMode}
            className="text-[11px] tracking-widest uppercase px-2.5 py-1 rounded-md border cursor-pointer"
            style={{
              color: 'var(--color-esi-cyan)',
              borderColor: 'var(--color-esi-border-strong)',
              background: 'rgba(34, 211, 238, 0.08)'
            }}
          >
            Full ⇄
          </button>
        </div>

        <VoiceWaveform />
        <CalendarStrip />
        <ActionLog />

        <form
          onSubmit={submit}
          className="mt-auto flex items-center gap-2 px-2 py-2 rounded-md"
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--color-esi-border)'
          }}
        >
          <span style={{ color: 'var(--color-esi-cyan)' }}>›</span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Esi…"
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: 'var(--color-esi-text)' }}
          />
        </form>
      </div>
    </motion.div>
  )
}
