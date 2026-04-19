import { PanelShell } from '../shared/PanelShell'

const MOCK_LOG = [
  { t: '09:02', msg: 'Opened VSCode', accent: 'cyan' },
  { t: '09:15', msg: 'Created calendar event', accent: 'green' },
  { t: '09:31', msg: 'Drafted email to John', accent: 'green' },
  { t: '09:44', msg: 'Read ~/esi/.env', accent: 'cyan' },
  { t: '09:58', msg: 'Summarized standup', accent: 'violet' },
  { t: '10:11', msg: 'Flagged overdue task', accent: 'gold' }
]

export function ActionLog({ delay = 0 }: { delay?: number }): React.JSX.Element {
  return (
    <PanelShell title="Action Log" accent="green" delay={delay}>
      <ul className="space-y-1.5 text-[13px]">
        {MOCK_LOG.map((l, i) => (
          <li key={i} className="flex items-baseline gap-2">
            <span className="tabular-nums" style={{ color: 'var(--color-esi-muted)' }}>
              {l.t}
            </span>
            <span style={{ color: `var(--color-esi-${l.accent})` }}>›</span>
            <span style={{ color: 'var(--color-esi-text)' }}>{l.msg}</span>
          </li>
        ))}
      </ul>
    </PanelShell>
  )
}
