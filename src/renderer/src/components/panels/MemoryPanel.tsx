import { PanelShell } from '../shared/PanelShell'

const MOCK_MEMORY = [
  { k: 'John', v: 'tech lead at Atulo' },
  { k: 'Ewoma', v: 'birthday this week' },
  { k: 'Atulo', v: 'PR #142 pending review' },
  { k: 'Standup', v: 'every day at 9:00' }
]

export function MemoryPanel(): React.JSX.Element {
  return (
    <ul className="space-y-2 text-[12px] uppercase font-mono tracking-tight">
      {MOCK_MEMORY.map((m) => (
        <li key={m.k} className="flex items-baseline gap-2.5">
          <span
            className="font-bold min-w-[70px] shrink-0 tracking-widest"
            style={{ color: 'var(--color-esi-violet)' }}
          >
            {m.k}
          </span>
          <span className="leading-snug" style={{ color: 'var(--color-esi-text-dim)' }}>{m.v}</span>
        </li>
      ))}
    </ul>
  )
}
