import { useEffect, useRef, useState } from 'react'
import { PanelShell } from './shared/PanelShell'

interface Message {
  id: number
  who: 'user' | 'esi'
  text: string
  ok: boolean
  time: string
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
}

function entriesToMessages(entries: EsiLogEntry[]): Message[] {
  const out: Message[] = []
  for (const e of [...entries].reverse()) {
    out.push({
      id: e.id * 2,
      who: 'user',
      text: e.command,
      ok: true,
      time: formatTime(e.timestamp)
    })
    if (e.response) {
      out.push({
        id: e.id * 2 + 1,
        who: 'esi',
        text: e.response,
        ok: e.ok === 1,
        time: formatTime(e.timestamp)
      })
    }
  }
  return out
}

export function ConversationView({
  thinking
}: {
  thinking: boolean
}): React.JSX.Element {
  const [messages, setMessages] = useState<Message[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)

  async function refresh(): Promise<void> {
    const rows = (await window.esi?.getRecentLog(30)) ?? []
    setMessages(entriesToMessages(rows))
  }

  useEffect(() => {
    refresh()
    const off = window.esi?.onLogUpdated(() => {
      refresh()
    })
    return () => off?.()
  }, [])

  useEffect(() => {
    // Quick hack to auto scroll on panel children change
    const panel = document.querySelector('.conversation-scroll-target')
    if (panel) panel.scrollTop = panel.scrollHeight
  }, [messages.length, thinking])

  const isEmpty = messages.length === 0 && !thinking

  return (
    <PanelShell 
      title="Live Transcript & Inference Console" 
      glowColor="violet" 
      className="flex-1 min-h-0 conversation-scroll-target" 
      delay={0.4}
    >
      {isEmpty ? <EmptyState /> : (
        <div className="space-y-6">
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
          {thinking && <ThinkingBubble />}
        </div>
      )}
    </PanelShell>
  )
}

function EmptyState(): React.JSX.Element {
  return (
    <div className="pt-4 pb-6 select-text" data-selectable>
      <h1 className="text-[26px] font-bold tracking-widest mb-2 uppercase" style={{ color: 'var(--color-esi-text)', fontFamily: 'var(--font-orbitron)' }}>
        SYSTEM INITIALIZED
      </h1>
      <p className="text-[14px] leading-relaxed mb-8 uppercase tracking-widest font-mono" style={{ color: 'var(--color-esi-text-dim)' }}>
        ALL MONITORING SYSTEMS ACTIVE. <br />
        WAITING FOR DIRECTIVE OR VOCAL COMMAND...
      </p>
      <div className="text-[11px] font-bold uppercase mb-3" style={{ color: 'var(--color-esi-cyan)', letterSpacing: '0.15em' }}>
        [ SUGGESTED PROTOCOLS ]
      </div>
      <ul className="grid grid-cols-2 gap-3 pb-8">
        {[
          "What is my trajectory today?",
          "Initialize daily standup summary",
          "Draft communication to Lead",
          "Open project repository"
        ].map((s) => (
          <li
            key={s}
            className="text-[12px] px-4 py-3 rounded uppercase tracking-widest font-bold"
            style={{
              background: 'rgba(0, 212, 255, 0.05)',
              border: '1px solid rgba(0, 212, 255, 0.2)',
              color: 'var(--color-esi-text-dim)'
            }}
          >
            {s}
          </li>
        ))}
      </ul>
    </div>
  )
}

function MessageBubble({ message }: { message: Message }): React.JSX.Element {
  const isUser = message.who === 'user'
  return (
    <div className={`flex flex-col gap-1.5 ${isUser ? '' : 'pl-6'}`} data-selectable>
      <div className="flex items-center gap-2">
        <span
          className="text-[11px] font-bold tracking-widest uppercase"
          style={{ color: isUser ? 'var(--color-esi-cyan)' : 'var(--color-esi-violet)' }}
        >
          {isUser ? 'USER IDENTIFIED' : 'E.S.I. CONSTRUCT'}
        </span>
        <span className="text-[10px] tabular-nums" style={{ color: 'var(--color-esi-muted)' }}>
          [{message.time}]
        </span>
      </div>
      <div
        className="text-[14px] leading-relaxed font-mono tracking-tight"
        style={{
          color: message.ok ? (isUser ? 'var(--color-esi-text)' : 'var(--color-esi-text-dim)') : 'var(--color-esi-critical)',
          textShadow: isUser ? '0 0 10px rgba(232, 234, 240, 0.2)' : 'none'
        }}
      >
        {isUser ? `« ${message.text} »` : `> ${message.text}`}
      </div>
    </div>
  )
}

function ThinkingBubble(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1.5 pl-6">
      <span className="text-[11px] font-bold tracking-widest uppercase" style={{ color: 'var(--color-esi-gold)' }}>
        E.S.I. INFERENCE LAYER
      </span>
      <div className="flex items-center gap-2 py-1.5">
        <span className="text-[14px] tracking-tight font-mono animate-pulse" style={{ color: 'var(--color-esi-gold)' }}>
          PROCESSING NODE...
        </span>
      </div>
    </div>
  )
}
