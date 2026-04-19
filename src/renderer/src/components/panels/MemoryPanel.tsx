import { PanelShell } from '../shared/PanelShell'

const MOCK_MEMORY = [
  { k: 'John', v: 'tech lead · Atulo' },
  { k: 'Ewoma', v: 'birthday this week' },
  { k: 'Atulo', v: 'PR #142 pending' },
  { k: 'Standup', v: '9:00 daily' }
]

export function MemoryPanel({ delay = 0 }: { delay?: number }): React.JSX.Element {
  return (
    <PanelShell title="Memory" accent="violet" delay={delay}>
      <ul className="space-y-2 text-[13px]">
        {MOCK_MEMORY.map((m) => (
          <li key={m.k} className="flex items-baseline gap-2">
            <span style={{ color: 'var(--color-esi-violet)' }} className="min-w-[60px]">
              {m.k}
            </span>
            <span style={{ color: 'var(--color-esi-muted)' }}>→</span>
            <span style={{ color: 'var(--color-esi-text)' }}>{m.v}</span>
          </li>
        ))}
      </ul>
    </PanelShell>
  )
}
