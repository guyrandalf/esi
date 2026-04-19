import { useRef, useState } from 'react'
import { CalendarStrip } from '../panels/CalendarStrip'
import { MemoryPanel } from '../panels/MemoryPanel'
import { LiveTranscript } from '../panels/LiveTranscript'
import { VoiceWaveform } from '../panels/VoiceWaveform'
import { ActionLog } from '../panels/ActionLog'
import { ActiveTask } from '../panels/ActiveTask'
import { SystemPulse } from '../panels/SystemPulse'

export function HUDFullscreen({
  onToggleMode
}: {
  onToggleMode: () => void
}): React.JSX.Element {
  const [input, setInput] = useState('')
  const [response, setResponse] = useState<string | null>(null)
  const interactiveRef = useRef(false)

  function setInteractive(on: boolean): void {
    if (interactiveRef.current === on) return
    interactiveRef.current = on
    window.esi?.setInteractive(on)
  }

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!input.trim()) return
    const text = input
    setInput('')
    const result = await window.esi?.sendCommand(text)
    setResponse(result?.response ?? '(no response)')
  }

  return (
    <div className="w-screen h-screen p-6">
      <div
        className="relative w-full h-full flex flex-col overflow-hidden rounded-2xl"
        onMouseEnter={() => setInteractive(true)}
        onMouseLeave={() => setInteractive(false)}
        style={{
          background: 'var(--color-esi-bg)',
          border: '1px solid var(--color-esi-border-strong)',
          boxShadow:
            '0 20px 60px -20px rgba(0, 0, 0, 0.6), 0 0 40px -10px rgba(34, 211, 238, 0.25), inset 0 1px 0 0 rgba(255, 255, 255, 0.04)',
          backdropFilter: 'blur(24px) saturate(140%)',
          WebkitBackdropFilter: 'blur(24px) saturate(140%)'
        }}
      >
        <div className="scanline" />

        <header
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: 'var(--color-esi-border)' }}
        >
          <div className="flex items-center gap-4">
            <span
              className="pulse-dot inline-block w-2.5 h-2.5 rounded-full"
              style={{
                background: 'var(--color-esi-cyan)',
                boxShadow: '0 0 12px var(--color-esi-cyan)'
              }}
            />
            <span
              className="text-xl tracking-[0.45em]"
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                color: 'var(--color-esi-text)'
              }}
            >
              ESI
            </span>
            <span
              className="text-[12px] tracking-widest uppercase ml-4"
              style={{ color: 'var(--color-esi-muted)' }}
            >
              Active Task ·{' '}
              <span style={{ color: 'var(--color-esi-violet)' }}>
                Summarizing standup meeting
              </span>
            </span>
          </div>
          <button
            onClick={onToggleMode}
            className="text-[12px] tracking-widest uppercase px-3.5 py-1.5 rounded-md border cursor-pointer transition-colors"
            style={{
              color: 'var(--color-esi-cyan)',
              borderColor: 'var(--color-esi-border-strong)',
              background: 'rgba(34, 211, 238, 0.08)'
            }}
          >
            Sidebar ⇄
          </button>
        </header>

        <main className="flex-1 grid grid-cols-[300px_1fr_340px] gap-5 px-6 py-5 overflow-hidden">
          <div className="flex flex-col gap-4 overflow-hidden">
            <CalendarStrip delay={0.0} />
            <MemoryPanel delay={0.1} />
            <ActiveTask delay={0.2} />
          </div>

          <div className="flex flex-col gap-4 overflow-hidden">
            <LiveTranscript delay={0.05} />
            <VoiceWaveform delay={0.15} />
          </div>

          <div className="flex flex-col gap-4 overflow-hidden">
            <ActionLog delay={0.1} />
          </div>
        </main>

        <footer
          className="flex items-center gap-6 px-6 py-4 border-t"
          style={{ borderColor: 'var(--color-esi-border)' }}
        >
          <SystemPulse />
          <form onSubmit={submit} className="flex-1 flex items-center gap-2">
            <span
              className="text-base"
              style={{ color: 'var(--color-esi-cyan)' }}
            >
              ›
            </span>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Hey Esi, check if the .env has the Gemini key…"
              className="flex-1 bg-transparent outline-none text-[14px]"
              style={{ color: 'var(--color-esi-text)' }}
            />
            {response && (
              <span className="text-[13px]" style={{ color: 'var(--color-esi-violet)' }}>
                {response}
              </span>
            )}
          </form>
        </footer>
      </div>
    </div>
  )
}
