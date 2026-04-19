import { useEffect, useState } from 'react'

export function MemoryView(): React.JSX.Element {
  const [mem, setMem] = useState<EsiMemorySnapshot | null>(null)

  useEffect(() => {
    const refresh = async (): Promise<void> => {
      try {
        const m = await window.esi?.getMemory()
        if (m) setMem(m)
      } catch {
        /* noop */
      }
    }
    refresh()
    const id = setInterval(refresh, 15_000)
    return () => clearInterval(id)
  }, [])

  if (!mem) {
    return (
      <div
        className="panel"
        style={{
          padding: 24,
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          color: 'var(--color-esi-fg-dim)'
        }}
      >
        Loading memory…
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gridTemplateRows: 'minmax(0, 1fr) minmax(0, 1fr)',
        gap: 16,
        minHeight: 0,
        overflow: 'hidden'
      }}
    >
      <Section title="PEOPLE" count={mem.people.length}>
        {mem.people.length === 0 ? (
          <Empty>No people yet — say "Remember that Sarah is my PM"</Empty>
        ) : (
          mem.people.map((p) => (
            <Row
              key={p.id}
              k={p.name}
              v={p.context ?? '—'}
              sub={p.last_mentioned ? `last · ${fmt(p.last_mentioned)}` : undefined}
            />
          ))
        )}
      </Section>

      <Section title="PROJECTS" count={mem.projects.length}>
        {mem.projects.length === 0 ? (
          <Empty>No projects tracked yet</Empty>
        ) : (
          mem.projects.map((p) => (
            <Row
              key={p.id}
              k={p.name}
              v={p.stack ?? p.notes ?? p.path ?? '—'}
              sub={p.last_active ? `active · ${fmt(p.last_active)}` : undefined}
            />
          ))
        )}
      </Section>

      <Section title="TASKS" count={mem.tasks.length}>
        {mem.tasks.length === 0 ? (
          <Empty>No active tasks</Empty>
        ) : (
          mem.tasks.map((t) => (
            <Row
              key={t.id}
              k={t.description}
              v={t.source ?? '—'}
              sub={
                t.completed
                  ? 'DONE'
                  : t.due_date
                    ? `due · ${t.due_date}`
                    : `created · ${fmt(t.created_at)}`
              }
              strike={!!t.completed}
            />
          ))
        )}
      </Section>

      <Section title="PREFERENCES" count={mem.preferences.length}>
        {mem.preferences.length === 0 ? (
          <Empty>No preferences saved</Empty>
        ) : (
          mem.preferences.map((p) => (
            <Row
              key={p.key}
              k={p.key.toUpperCase()}
              v={p.value}
              sub={`updated · ${fmt(p.updated_at)}`}
            />
          ))
        )}
      </Section>
    </div>
  )
}

function Section({
  title,
  count,
  children
}: {
  title: string
  count: number
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div
      className="panel"
      style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}
    >
      <div className="panel-head">
        <span>
          <span className="dot" />
          {title}
        </span>
        <span className="mono" style={{ fontSize: 9, color: 'var(--color-esi-fg-dim)' }}>
          {count} {count === 1 ? 'ENTRY' : 'ENTRIES'}
        </span>
      </div>
      <div
        style={{
          padding: '10px 14px 14px',
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 10
        }}
      >
        {children}
      </div>
    </div>
  )
}

function Row({
  k,
  v,
  sub,
  strike
}: {
  k: string
  v: string
  sub?: string
  strike?: boolean
}): React.JSX.Element {
  return (
    <div
      style={{
        padding: '8px 0',
        borderBottom: '1px dashed rgba(126,231,255,0.1)'
      }}
    >
      <div
        style={{
          color: 'var(--color-esi-c-100)',
          fontSize: 13,
          fontFamily: 'var(--font-ui)',
          textDecoration: strike ? 'line-through' : 'none',
          opacity: strike ? 0.55 : 1
        }}
        data-selectable
      >
        {k}
      </div>
      <div
        style={{
          color: 'var(--color-esi-fg-dim)',
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
          marginTop: 2,
          letterSpacing: '0.03em'
        }}
        data-selectable
      >
        {v}
      </div>
      {sub && (
        <div
          style={{
            color: 'var(--color-esi-fg-dimmer)',
            fontSize: 9,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            marginTop: 3
          }}
        >
          {sub}
        </div>
      )}
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        color: 'var(--color-esi-fg-dim)',
        letterSpacing: '0.12em',
        textTransform: 'uppercase'
      }}
    >
      {children}
    </div>
  )
}

function fmt(iso: string): string {
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return iso
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
  } catch {
    return iso
  }
}
