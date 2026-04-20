import { useEffect, useState } from 'react'

interface Row {
  k: string
  v: string
}

export function MemoryPanel(): React.JSX.Element {
  const [rows, setRows] = useState<Row[] | null>(null)

  async function refresh(): Promise<void> {
    try {
      const snap = await window.esi?.getMemory()
      if (!snap) {
        setRows([])
        return
      }
      const merged: Row[] = []
      for (const p of snap.people.slice(0, 3)) {
        merged.push({ k: p.name, v: p.context ?? '' })
      }
      for (const pr of snap.projects.slice(0, 2)) {
        merged.push({ k: pr.name, v: pr.path ?? pr.stack ?? '' })
      }
      for (const pref of snap.preferences.slice(0, 2)) {
        merged.push({
          k: pref.key.replace(/_/g, ' '),
          v: pref.value.slice(0, 40)
        })
      }
      setRows(merged)
    } catch {
      setRows([])
    }
  }

  useEffect(() => {
    refresh()
    const off = window.esi?.onLogUpdated(() => {
      refresh()
    })
    const id = setInterval(refresh, 30_000)
    return () => {
      off?.()
      clearInterval(id)
    }
  }, [])

  if (rows === null) {
    return (
      <p
        className="text-[11px] uppercase tracking-widest"
        style={{ color: 'var(--color-esi-muted)' }}
      >
        [LOADING MEMORY…]
      </p>
    )
  }
  if (rows.length === 0) {
    return (
      <p
        className="text-[11px] uppercase tracking-widest leading-relaxed"
        style={{ color: 'var(--color-esi-muted)' }}
      >
        [NO MEMORIES YET — SAY "REMEMBER THAT…"]
      </p>
    )
  }

  return (
    <ul className="space-y-2 text-[12px] uppercase font-mono tracking-tight">
      {rows.map((m, i) => (
        <li key={i} className="flex items-baseline gap-2.5">
          <span
            className="font-bold min-w-[70px] shrink-0 tracking-widest truncate"
            style={{ color: 'var(--color-esi-violet)' }}
          >
            {m.k}
          </span>
          <span
            className="leading-snug truncate"
            style={{ color: 'var(--color-esi-text-dim)' }}
          >
            {m.v}
          </span>
        </li>
      ))}
    </ul>
  )
}
