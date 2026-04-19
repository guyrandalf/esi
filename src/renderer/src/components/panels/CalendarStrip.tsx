import { PanelShell } from '../shared/PanelShell'

const MOCK_EVENTS = [
  { time: '9:00 AM', title: 'Standup', soon: false },
  { time: '11:00 AM', title: '1:1 with John', soon: false },
  { time: '2:00 PM', title: 'Demo — Atulo', soon: true }
]

export function CalendarStrip(): React.JSX.Element {
  return (
    <ul className="space-y-3 font-mono tracking-tight">
      {MOCK_EVENTS.map((e) => (
        <li key={e.time} className="flex items-baseline gap-3 text-[12.5px] uppercase">
          <span
            className="w-[72px] shrink-0 font-bold tracking-widest text-[#f4c96a]"
            style={{
              color: e.soon
                ? 'var(--color-esi-gold)'
                : 'var(--color-esi-muted)',
              fontSize: '11px'
            }}
          >
            [{e.time}]
          </span>
          <span style={{ color: 'var(--color-esi-text)' }}>{e.title}</span>
        </li>
      ))}
    </ul>
  )
}
