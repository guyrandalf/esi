import { useEffect, useRef, useState } from 'react'

export function InputBar({
  onSubmit,
  thinking
}: {
  onSubmit: (text: string) => Promise<void>
  thinking: boolean
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
  const borderColor = thinking ? 'var(--color-esi-gold)' : 'var(--color-esi-cyan)'

  return (
    <div
      className="hud-panel rounded-2xl"
      style={{
        background: 'var(--color-esi-panel)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: `1.5px solid ${borderColor}`,
        boxShadow: `0 8px 28px rgba(15, 18, 32, 0.08), 0 0 0 4px ${thinking ? 'rgba(180, 83, 9, 0.08)' : 'rgba(2, 132, 199, 0.08)'}`,
        padding: '16px 20px'
      }}
      onMouseEnter={() => window.esi?.setIgnoreMouse(false)}
      onMouseLeave={() => window.esi?.setIgnoreMouse(true)}
    >
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <span
            style={{
              fontSize: '16px',
              fontWeight: 700,
              marginTop: '2px',
              color: borderColor
            }}
          >
            &gt;
          </span>
          <textarea
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKey}
            rows={1}
            disabled={thinking}
            placeholder={thinking ? 'Processing directive...' : 'Awaiting input...'}
            style={{
              flex: 1,
              background: 'transparent',
              outline: 'none',
              fontSize: '14px',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.05em',
              resize: 'none',
              lineHeight: 1.6,
              color: 'var(--color-esi-text)',
              maxHeight: '180px',
              border: 'none',
              padding: 0
            }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-esi-muted)' }}>
            <span>Enter to execute</span>
            <span style={{ marginLeft: '12px' }}>⇧ Enter multi-line</span>
          </div>
          <button
            type="submit"
            disabled={!canSend}
            style={{
              borderRadius: '8px',
              padding: '5px 14px',
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              cursor: canSend ? 'pointer' : 'default',
              opacity: canSend ? 1 : 0.4,
              background: canSend ? 'var(--color-esi-cyan)' : 'transparent',
              color: canSend ? '#ffffff' : 'var(--color-esi-muted)',
              border: canSend ? 'none' : '1px solid var(--color-esi-panel-border)'
            }}
          >
            Execute
          </button>
        </div>
      </form>
    </div>
  )
}
