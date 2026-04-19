import { useEffect, useRef, useState } from 'react'
import type { VoiceState } from './panels/ArcReactor'

export function InputBar({
  onSubmit,
  thinking,
  voiceState
}: {
  onSubmit: (text: string) => Promise<void>
  thinking: boolean
  voiceState: VoiceState
}): React.JSX.Element {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 180) + 'px'
  }, [value])

  async function submit(e?: React.FormEvent): Promise<void> {
    e?.preventDefault()
    const text = value.trim()
    if (!text || thinking) return
    setValue('')
    await onSubmit(text)
    inputRef.current?.focus()
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const canSend = value.trim().length > 0 && !thinking
  const accent = thinking ? 'var(--color-esi-amber)' : 'var(--color-esi-c-200)'

  const listening = voiceState === 'listening'

  async function onMic(): Promise<void> {
    if (thinking) return
    try {
      if (listening) {
        await window.esi?.stopVoice()
      } else {
        await window.esi?.startVoice()
      }
    } catch {
      /* noop */
    }
  }

  return (
    <div
      className="panel"
      style={{
        padding: '10px 14px',
        background: 'linear-gradient(180deg, rgba(10,19,31,0.85), rgba(6,12,21,0.95))',
        borderColor: 'rgba(126,231,255,0.3)'
      }}
    >
      <form
        onSubmit={submit}
        style={{ display: 'flex', alignItems: 'center', gap: 10 }}
      >
        <button
          type="button"
          onClick={onMic}
          title={listening ? 'Click or ⌘⇧Space to stop' : 'Click or ⌘⇧Space to talk'}
          style={{
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: listening ? 'rgba(255,77,77,0.2)' : 'rgba(126,231,255,0.04)',
            border: `1px solid ${listening ? 'var(--color-esi-alert)' : 'rgba(126,231,255,0.3)'}`,
            color: listening ? 'var(--color-esi-alert)' : 'var(--color-esi-c-200)',
            cursor: 'pointer',
            borderRadius: 2,
            boxShadow: listening ? '0 0 12px rgba(255,77,77,0.5)' : 'none',
            animation: listening ? 'esi-pulse-glow 1.2s ease-in-out infinite' : undefined,
            transition: 'all 150ms'
          }}
        >
          {listening ? (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <rect x="2" y="2" width="8" height="8" rx="1" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="5" y="1.5" width="4" height="7" rx="2" />
              <path d="M3 6.5a4 4 0 008 0M7 10.5V13" />
            </svg>
          )}
        </button>

        <span
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: accent,
            fontFamily: 'var(--font-display)'
          }}
        >
          ▸
        </span>

        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKey}
          rows={1}
          disabled={thinking}
          placeholder={
            listening
              ? 'Listening… speak, I auto-stop when you pause'
              : voiceState === 'thinking' && !thinking
                ? 'Transcribing…'
                : thinking
                  ? 'Processing directive…'
                  : 'Address E.S.I…'
          }
          style={{
            flex: 1,
            background: 'transparent',
            outline: 'none',
            fontSize: 14,
            fontFamily: 'var(--font-ui)',
            letterSpacing: '0.02em',
            resize: 'none',
            lineHeight: 1.6,
            color: 'var(--color-esi-fg)',
            maxHeight: 180,
            border: 'none',
            borderBottom: '1px solid rgba(126,231,255,0.25)',
            padding: '6px 2px'
          }}
        />

        <div
          className="mono"
          style={{
            fontSize: 9,
            letterSpacing: '0.15em',
            color: 'var(--color-esi-fg-dimmer)',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap'
          }}
        >
          ⏎ SEND · ⇧⏎ NEWLINE
        </div>

        <button
          type="submit"
          disabled={!canSend}
          style={{
            padding: '6px 14px',
            background: 'transparent',
            border: `1px solid ${canSend ? 'var(--color-esi-c-300)' : 'rgba(126,231,255,0.2)'}`,
            color: canSend ? 'var(--color-esi-c-100)' : 'var(--color-esi-fg-dim)',
            fontFamily: 'var(--font-display)',
            fontSize: 10,
            letterSpacing: '0.25em',
            cursor: canSend ? 'pointer' : 'not-allowed',
            opacity: canSend ? 1 : 0.4,
            borderRadius: 2,
            transition: 'all 200ms'
          }}
        >
          SEND ▸
        </button>
      </form>
    </div>
  )
}
