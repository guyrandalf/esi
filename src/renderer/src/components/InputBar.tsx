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

  return (
    <div
      className="hud-panel shrink-0 rounded-lg border backdrop-blur-md transition-all flex flex-col justify-center px-4 py-3 pb-2"
      style={{
        backgroundColor: 'var(--color-esi-panel)',
        borderColor: thinking ? 'var(--color-esi-gold)' : 'var(--color-esi-cyan)',
        boxShadow: `0 0 20px -5px ${thinking ? 'var(--color-esi-gold)' : 'var(--color-esi-cyan)'}44`
      }}
      onMouseEnter={() => {
        window.esi?.setIgnoreMouse(false)
      }}
      onMouseLeave={() => {
        window.esi?.setIgnoreMouse(true)
      }}
    >
      <form onSubmit={submit} className="flex flex-col gap-2">
        <div className="flex items-start gap-4">
          <span 
            className="text-[18px] font-bold mt-[2px] pulse-dot" 
            style={{ color: thinking ? 'var(--color-esi-gold)' : 'var(--color-esi-cyan)' }}
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
            placeholder={thinking ? 'PROCESSING DIRECTIVE...' : 'AWAITING VOCAL OR KEYBOARD INPUT. . .'}
            className="flex-1 bg-transparent outline-none text-[15px] font-mono tracking-widest resize-none leading-relaxed placeholder:text-[color:var(--color-esi-muted)] disabled:opacity-60 px-0 py-1"
            style={{ color: 'var(--color-esi-text)', maxHeight: '180px', textTransform: 'uppercase' }}
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="text-[10px] tracking-widest uppercase flex items-center gap-4" style={{ color: 'var(--color-esi-muted)' }}>
            <span><kbd className="text-white/60">ENTER</kbd> TO EXECUTE</span>
            <span><kbd className="text-white/60">⇧ ENTER</kbd> MULTI-LINE</span>
            <span><kbd className="text-white/60">⌘ ⇧ .</kbd> HALT SPEECH</span>
          </div>
          <button
            type="submit"
            disabled={!canSend}
            className="rounded px-4 py-1 text-[11px] font-bold tracking-widest uppercase transition-colors disabled:opacity-50"
            style={{
              background: canSend ? 'rgba(0, 212, 255, 0.15)' : 'transparent',
              color: canSend ? 'var(--color-esi-cyan)' : 'var(--color-esi-muted)',
              border: `1px solid ${canSend ? 'var(--color-esi-cyan)' : 'transparent'}`
            }}
          >
            Execute
          </button>
        </div>
      </form>
    </div>
  )
}
