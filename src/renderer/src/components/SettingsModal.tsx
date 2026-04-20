import { useEffect, useState } from 'react'

export function SettingsModal({
  open,
  onClose
}: {
  open: boolean
  onClose: () => void
}): React.JSX.Element | null {
  const [mem, setMem] = useState<EsiMemorySnapshot | null>(null)
  const [status, setStatus] = useState<EsiSubsystemStatus | null>(null)
  const [offline, setOffline] = useState(false)
  const [autostart, setAutostartState] = useState<{
    installed: boolean
    supported: boolean
  } | null>(null)

  async function refresh(): Promise<void> {
    const [m, s, a] = await Promise.all([
      window.esi?.getMemory(),
      window.esi?.getStatus(),
      window.esi?.getAutostartStatus?.()
    ])
    if (m) setMem(m)
    if (s) setStatus(s)
    if (a)
      setAutostartState({
        installed: a.installed,
        supported: a.supported
      })
  }

  async function handleAutostartToggle(next: boolean): Promise<void> {
    const res = await window.esi?.setAutostart?.(next)
    if (res?.ok) setAutostartState((s) => (s ? { ...s, installed: next } : s))
  }

  useEffect(() => {
    if (!open) return
    refresh()
  }, [open])

  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])

  async function handleOfflineToggle(next: boolean): Promise<void> {
    setOffline(next)
    await window.esi?.setOffline(next)
    refresh()
  }

  async function handleDeletePerson(name: string): Promise<void> {
    await window.esi?.deletePerson(name)
    refresh()
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(15, 18, 32, 0.22)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-[640px] max-h-[80vh] overflow-y-auto rounded-lg"
        style={{
          background: 'var(--color-esi-bg-solid)',
          border: '1px solid var(--color-esi-panel-border)',
          boxShadow: '0 30px 80px -20px rgba(15, 18, 32, 0.25)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="px-6 py-4 border-b flex items-center justify-between"
          style={{ borderColor: 'var(--color-esi-border-soft)' }}
        >
          <h2
            className="text-[14px] tracking-widest uppercase font-bold"
            style={{
              fontFamily: 'var(--font-orbitron)',
              color: 'var(--color-esi-cyan)'
            }}
          >
            Settings
          </h2>
          <button
            className="text-[11px] uppercase tracking-widest px-2 py-1 rounded"
            style={{
              color: 'var(--color-esi-muted)',
              border: '1px solid var(--color-esi-border-soft)'
            }}
            onClick={onClose}
          >
            ESC
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Subsystems */}
          <section>
            <SectionTitle>Subsystems</SectionTitle>
            {status ? (
              <ul className="grid grid-cols-2 gap-2 text-[12px]">
                {Object.entries(status).map(([k, v]) => (
                  <li
                    key={k}
                    className="flex items-center gap-2 px-2 py-1 rounded"
                    style={{
                      background: 'var(--color-esi-panel-inset)',
                      border: '1px solid var(--color-esi-panel-border)'
                    }}
                  >
                    <span
                      className="inline-block w-1.5 h-1.5 rounded-full"
                      style={{
                        background: v
                          ? 'var(--color-esi-green)'
                          : 'var(--color-esi-muted)'
                      }}
                    />
                    <span style={{ color: 'var(--color-esi-text-dim)' }}>{k}</span>
                    <span
                      className="ml-auto"
                      style={{
                        color: v ? 'var(--color-esi-green)' : 'var(--color-esi-muted)'
                      }}
                    >
                      {v ? 'OK' : 'OFF'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <Dim>Loading…</Dim>
            )}
          </section>

          {/* Privacy / Startup */}
          <section>
            <SectionTitle>Startup &amp; Privacy</SectionTitle>
            <label className="flex items-center gap-3 cursor-pointer text-[13px] mb-2">
              <input
                type="checkbox"
                checked={offline}
                onChange={(e) => handleOfflineToggle(e.target.checked)}
              />
              <span style={{ color: 'var(--color-esi-text)' }}>Offline mode</span>
              <span
                className="text-[11px]"
                style={{ color: 'var(--color-esi-muted)' }}
              >
                (force Ollama; disable Gemini for this session)
              </span>
            </label>
            <label
              className="flex items-center gap-3 text-[13px]"
              style={{
                cursor: autostart?.supported ? 'pointer' : 'not-allowed',
                opacity: autostart?.supported ? 1 : 0.5
              }}
            >
              <input
                type="checkbox"
                disabled={!autostart?.supported}
                checked={!!autostart?.installed}
                onChange={(e) => handleAutostartToggle(e.target.checked)}
              />
              <span style={{ color: 'var(--color-esi-text)' }}>
                Start ESI at login
              </span>
              <span
                className="text-[11px]"
                style={{ color: 'var(--color-esi-muted)' }}
              >
                {autostart?.supported
                  ? '(menu-bar only; summon with "hey ESI" or 3 claps)'
                  : '(available in the packaged build)'}
              </span>
            </label>
          </section>

          {/* Memory browser */}
          <section>
            <SectionTitle>Memory</SectionTitle>
            {mem && mem.people.length > 0 ? (
              <ul className="space-y-1.5 text-[12.5px]">
                {mem.people.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 px-2 py-1.5 rounded"
                    style={{
                      background: 'var(--color-esi-panel-inset)',
                      border: '1px solid var(--color-esi-panel-border)'
                    }}
                  >
                    <span
                      className="font-bold min-w-[80px]"
                      style={{ color: 'var(--color-esi-violet)' }}
                    >
                      {p.name}
                    </span>
                    <span
                      className="flex-1"
                      style={{ color: 'var(--color-esi-text-dim)' }}
                    >
                      {p.context}
                    </span>
                    <button
                      className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded"
                      style={{
                        color: 'var(--color-esi-red)',
                        border: '1px solid rgba(248, 113, 113, 0.3)'
                      }}
                      onClick={() => handleDeletePerson(p.name)}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <Dim>No people remembered yet. Try: "Remember that …"</Dim>
            )}

            {mem && mem.preferences.length > 0 && (
              <div className="mt-3">
                <div
                  className="text-[10px] uppercase tracking-widest mb-1"
                  style={{ color: 'var(--color-esi-muted)' }}
                >
                  Preferences
                </div>
                <ul className="space-y-1 text-[12px]">
                  {mem.preferences.map((p) => (
                    <li key={p.key} className="flex items-baseline gap-2">
                      <span
                        className="font-bold"
                        style={{ color: 'var(--color-esi-cyan)' }}
                      >
                        {p.key}:
                      </span>
                      <span style={{ color: 'var(--color-esi-text-dim)' }}>
                        {p.value}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* Shortcuts */}
          <section>
            <SectionTitle>Shortcuts</SectionTitle>
            <ul className="space-y-1.5 text-[12px]">
              <Shortcut keys="⌘ ⇧ Space" desc="Push-to-talk voice input" />
              <Shortcut keys="⌘ ⇧ ." desc="Interrupt Esi speech" />
              <Shortcut keys="⌘ ," desc="Open this settings panel" />
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <h3
      className="text-[11px] uppercase tracking-widest mb-2 font-bold"
      style={{ color: 'var(--color-esi-cyan)' }}
    >
      {children}
    </h3>
  )
}

function Dim({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <p
      className="text-[12px]"
      style={{ color: 'var(--color-esi-muted)' }}
    >
      {children}
    </p>
  )
}

function Shortcut({ keys, desc }: { keys: string; desc: string }): React.JSX.Element {
  return (
    <li className="flex items-center gap-3">
      <kbd
        className="px-2 py-0.5 rounded text-[11px] font-mono"
        style={{
          background: 'var(--color-esi-panel-inset)',
          border: '1px solid var(--color-esi-panel-border)',
          color: 'var(--color-esi-text)'
        }}
      >
        {keys}
      </kbd>
      <span style={{ color: 'var(--color-esi-text-dim)' }}>{desc}</span>
    </li>
  )
}
