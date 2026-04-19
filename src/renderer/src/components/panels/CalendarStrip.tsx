import { PanelShell } from '../shared/PanelShell'

const MOCK_EVENTS = [
  { time: '09:00', title: 'Standup', soon: false },
  { time: '11:00', title: '1:1 with John', soon: false },
  { time: '14:00', title: 'Demo — Atulo', soon: true }
]

export function CalendarStrip({ delay = 0 }: { delay?: number }): React.JSX.Element {
  return (
    <PanelShell title="Calendar" accent="cyan" delay={delay}>
      <ul className="space-y-2">
        {MOCK_EVENTS.map((e) => (
          <li key={e.time} className="flex items-baseline gap-3 text-sm">
            <span
              className="w-12 tabular-nums"
              style={{
                color: e.soon ? 'var(--color-esi-gold)' : 'var(--color-esi-cyan)',
                fontFamily: 'var(--font-display)'
              }}
            >
              {e.time}
            </span>
            <span style={{ color: 'var(--color-esi-text)' }}>{e.title}</span>
          </li>
        ))}
      </ul>
    </PanelShell>
  )
}
