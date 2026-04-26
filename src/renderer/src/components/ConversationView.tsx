import { useEffect, useRef, useState } from 'react'

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

/** Strip `[ACTION:...]` tags so they never leak into the visible chat bubble. */
function stripActionTags(text: string): string {
  return text
    .replace(/\[ACTION:[^\]]*\]/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
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
      const clean = stripActionTags(e.response)
      if (clean) {
        out.push({
          id: e.id * 2 + 1,
          who: 'esi',
          text: clean,
          ok: e.ok === 1,
          time: formatTime(e.timestamp)
        })
      }
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
    const off = window.esi?.onLogUpdated(() => refresh())
    return () => off?.()
  }, [])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages.length, thinking])

  const isEmpty = messages.length === 0 && !thinking

  return (
    <div
      className="panel"
      style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}
    >
      <div className="panel-head">
        <span>
          <span className="dot" />
          CONVERSATION · QUEEN ESI
        </span>
        <span className="mono" style={{ fontSize: 9, color: 'var(--color-esi-good)' }}>
          CLAUDE · READY
        </span>
      </div>
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          minHeight: 0
        }}
      >
        {isEmpty ? (
          <EmptyState />
        ) : (
          <>
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
            {thinking && <ThinkingBubble />}
          </>
        )}
      </div>
    </div>
  )
}

function EmptyState(): React.JSX.Element {
  return (
    <div data-selectable>
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 18,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: 'var(--color-esi-c-100)',
          textShadow: '0 0 10px rgba(126,231,255,0.4)',
          marginBottom: 6
        }}
      >
        System Online
      </h1>
      <p
        style={{
          fontSize: 12,
          lineHeight: 1.6,
          color: 'var(--color-esi-fg-dim)',
          marginBottom: 16
        }}
      >
        All systems active. Awaiting input…
      </p>
      <div
        className="mono"
        style={{
          fontSize: 9,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.2em',
          color: 'var(--color-esi-c-200)',
          marginBottom: 8
        }}
      >
        Suggested
      </div>
      <ul style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[
          "What's on my agenda today?",
          'Summarize my recent commands',
          'Remember that…',
          'Open my latest project'
        ].map((s) => (
          <li
            key={s}
            style={{
              fontSize: 12,
              padding: '8px 12px',
              fontFamily: 'var(--font-mono)',
              background: 'rgba(126,231,255,0.04)',
              border: '1px solid rgba(126,231,255,0.2)',
              color: 'var(--color-esi-c-200)',
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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
        gap: 3
      }}
      data-selectable
    >
      <div
        className="mono"
        style={{
          fontSize: 9,
          color: 'var(--color-esi-fg-dimmer)',
          letterSpacing: '0.15em',
          display: 'flex',
          gap: 8
        }}
      >
        <span>{isUser ? 'SIR' : 'QUEEN ESI'}</span>
        <span>·</span>
        <span>{message.time}</span>
      </div>
      <div
        style={{
          maxWidth: '85%',
          padding: '8px 12px',
          background: isUser ? 'rgba(126,231,255,0.08)' : 'transparent',
          border: `1px solid ${
            isUser ? 'rgba(126,231,255,0.3)' : 'rgba(126,231,255,0.15)'
          }`,
          borderLeftWidth: isUser ? 1 : 2,
          borderLeftColor: isUser ? 'rgba(126,231,255,0.3)' : 'var(--color-esi-c-200)',
          color: message.ok
            ? isUser
              ? 'var(--color-esi-fg)'
              : 'var(--color-esi-c-50)'
            : 'var(--color-esi-alert)',
          fontSize: 13,
          lineHeight: 1.55,
          fontFamily: 'var(--font-ui)'
        }}
      >
        {message.text}
      </div>
    </div>
  )
}

function ThinkingBubble(): React.JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div
        className="mono"
        style={{
          fontSize: 9,
          color: 'var(--color-esi-fg-dimmer)',
          letterSpacing: '0.15em'
        }}
      >
        QUEEN ESI · PROCESSING
      </div>
      <div
        style={{
          padding: '8px 12px',
          border: '1px solid rgba(126,231,255,0.15)',
          borderLeft: '2px solid var(--color-esi-c-200)',
          color: 'var(--color-esi-c-100)',
          fontSize: 13,
          fontFamily: 'var(--font-ui)',
          maxWidth: '85%'
        }}
      >
        Processing…
        <span
          style={{
            display: 'inline-block',
            width: 8,
            height: 12,
            background: 'var(--color-esi-c-100)',
            marginLeft: 4,
            verticalAlign: 'middle',
            animation: 'esi-blink 0.8s step-end infinite'
          }}
        />
      </div>
    </div>
  )
}
