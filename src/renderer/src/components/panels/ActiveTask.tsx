import { PanelShell } from '../shared/PanelShell'

const STEPS = [
  { label: 'Transcribed the audio', status: 'done' },
  { label: 'Pulled out action items', status: 'done' },
  { label: 'Drafting follow-up email', status: 'active' },
  { label: 'Saving to archive', status: 'pending' }
]

export function ActiveTask(): React.JSX.Element {
  return (
    <ul className="space-y-2 text-[13.5px] uppercase tracking-widest font-mono">
      {STEPS.map((s, i) => (
        <li key={i} className="flex items-center gap-2.5">
          <span
            className={`inline-block w-2 h-2 rounded-full shrink-0 ${s.status === 'active' ? 'animate-pulse' : ''}`}
            style={{
              background:
                s.status === 'done'
                  ? 'var(--color-esi-green)'
                  : s.status === 'active'
                    ? 'var(--color-esi-cyan)'
                    : 'transparent',
              border:
                s.status === 'pending'
                  ? '1px solid var(--color-esi-border-strong)'
                  : 'none',
              boxShadow: s.status !== 'pending' ? `0 0 8px ${s.status === 'done' ? 'var(--color-esi-green)' : 'var(--color-esi-cyan)'}` : 'none'
            }}
          />
          <span
            style={{
              color:
                s.status === 'pending'
                  ? 'var(--color-esi-muted)'
                  : 'var(--color-esi-text)'
            }}
          >
            {s.label}
          </span>
        </li>
      ))}
    </ul>
  )
}
