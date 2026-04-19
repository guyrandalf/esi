import { PanelShell } from '../shared/PanelShell'

const MOCK_LINES = [
  { who: 'user', text: "Hey Esi, what's my next meeting?" },
  { who: 'esi', text: 'Your 1:1 with John is in 42 minutes.' },
  { who: 'user', text: 'Pull up the deploy notes from Friday.' },
  { who: 'esi', text: 'Opening deploy-notes.md in VSCode.' }
]

export function LiveTranscript({ delay = 0 }: { delay?: number }): React.JSX.Element {
  return (
    <PanelShell title="Live Transcript" accent="cyan" live delay={delay}>
      <div className="space-y-2 text-sm">
        {MOCK_LINES.map((l, i) => (
          <div
            key={i}
            className={`flex ${l.who === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className="max-w-[80%] rounded px-2.5 py-1 leading-snug"
              style={{
                color:
                  l.who === 'user'
                    ? 'var(--color-esi-cyan)'
                    : 'var(--color-esi-violet)',
                background:
                  l.who === 'user'
                    ? 'rgba(0, 212, 255, 0.06)'
                    : 'rgba(124, 106, 255, 0.06)'
              }}
            >
              {l.text}
            </div>
          </div>
        ))}
      </div>
    </PanelShell>
  )
}
