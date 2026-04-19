import { useEffect, useState } from 'react'
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

  async function refresh(): Promise<void> {
    const rows = (await window.esi?.getRecentLog(30)) ?? []
    setMessages(entriesToMessages(rows))
  }

  useEffect(() => {
    refresh()
    const off = window.esi?.onLogUpdated(() => refresh())
    return () => off?.()
  }, [])

  useEffect(() => {
    const panel = document.querySelector('.conversation-scroll-target')
    if (panel) panel.scrollTop = panel.scrollHeight
  }, [messages.length, thinking])

  const isEmpty = messages.length === 0 && !thinking

  return (
    <PanelShell
      title="Live Transcript"
      glowColor="violet"
      className="flex-1 min-h-0 conversation-scroll-target"
      delay={0.4}
    >
      {isEmpty ? <EmptyState /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
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
    <div data-selectable>
      <h1
        style={{
          fontSize: '18px',
          fontWeight: 700,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          marginBottom: '4px',
          fontFamily: 'var(--font-orbitron)',
          color: 'var(--color-esi-text)'
        }}
      >
        System Online
      </h1>
      <p style={{ fontSize: '12px', lineHeight: 1.6, color: 'var(--color-esi-text-dim)', marginBottom: '16px' }}>
        All systems active. Awaiting input...
      </p>
      <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-esi-cyan)', marginBottom: '8px' }}>
        Suggested
      </div>
      <ul style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {[
          "What is my trajectory today?",
          "Initialize daily standup summary",
          "Draft communication to Lead",
          "Open project repository"
        ].map((s) => (
          <li
            key={s}
            style={{
              fontSize: '11px',
              padding: '8px 12px',
              borderRadius: '8px',
              fontFamily: 'var(--font-mono)',
              background: 'var(--color-esi-panel-inset)',
              border: '1px solid var(--color-esi-panel-border)',
              color: 'var(--color-esi-text-dim)',
              listStyle: 'none'
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
    <div style={{ paddingLeft: isUser ? 0 : '12px' }} data-selectable>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
        <span
          style={{
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: isUser ? 'var(--color-esi-cyan)' : 'var(--color-esi-violet)'
          }}
        >
          {isUser ? 'You' : 'E.S.I.'}
        </span>
        <span style={{ fontSize: '9px', opacity: 0.35, fontVariantNumeric: 'tabular-nums' }}>
          {message.time}
        </span>
      </div>
      <div
        style={{
          fontSize: '13px',
          lineHeight: 1.6,
          fontFamily: 'var(--font-mono)',
          color: message.ok ? 'var(--color-esi-text)' : 'var(--color-esi-red)'
        }}
      >
        {message.text}
      </div>
    </div>
  )
}

function ThinkingBubble(): React.JSX.Element {
  return (
    <div style={{ paddingLeft: '12px' }}>
      <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--color-esi-gold)' }}>
        E.S.I.
      </span>
      <div className="animate-pulse" style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: 'var(--color-esi-gold)', marginTop: '3px' }}>
        Processing...
      </div>
    </div>
  )
}
