import { PanelShell } from '../shared/PanelShell'

const STEPS = [
  { label: 'Transcribe meeting audio', status: 'done' },
  { label: 'Extract action items', status: 'done' },
  { label: 'Draft follow-up email', status: 'active' },
  { label: 'Save to meeting archive', status: 'pending' }
]

export function ActiveTask({ delay = 0 }: { delay?: number }): React.JSX.Element {
  return (
    <PanelShell title="Active Task" accent="violet" live delay={delay}>
      <div className="space-y-2 text-[13px]">
        <div
          className="text-[11px] tracking-wider uppercase mb-2"
          style={{ color: 'var(--color-esi-muted)' }}
        >
          Summarizing standup meeting
        </div>
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <span
              className={`inline-block w-3 h-3 rounded-full ${s.status === 'active' ? 'pulse-dot' : ''}`}
              style={{
                background:
                  s.status === 'done'
                    ? 'var(--color-esi-green)'
                    : s.status === 'active'
                      ? 'var(--color-esi-violet)'
                      : 'transparent',
                border:
                  s.status === 'pending'
                    ? '1px solid var(--color-esi-border)'
                    : 'none',
                boxShadow:
                  s.status !== 'pending'
                    ? `0 0 8px ${s.status === 'done' ? 'var(--color-esi-green)' : 'var(--color-esi-violet)'}`
                    : 'none'
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
          </div>
        ))}
      </div>
    </PanelShell>
  )
}
