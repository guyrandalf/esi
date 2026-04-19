import { useEffect, useState } from 'react'

interface Step {
  label: string
  status: 'done' | 'active' | 'pending'
}

const FALLBACK: Step[] = [
  { label: 'Listening for your voice commands', status: 'active' },
  { label: 'Watching your calendar for meetings', status: 'active' },
  { label: 'Ready for "Remember that…"', status: 'pending' }
]

export function ActiveTask(): React.JSX.Element {
  const [steps, setSteps] = useState<Step[]>(FALLBACK)

  async function refresh(): Promise<void> {
    try {
      const meeting = await window.esi?.getActiveMeeting()
      if (meeting) {
        const minutes = Math.round((Date.now() - meeting.startedAt) / 60_000)
        setSteps([
          { label: `Capturing ${meeting.app} audio`, status: 'active' },
          {
            label: `Transcribing live (${minutes}m so far)`,
            status: 'active'
          },
          { label: 'Summary queued for post-meeting', status: 'pending' }
        ])
        return
      }

      const mem = await window.esi?.getMemory()
      const tasks = mem?.tasks ?? []
      if (tasks.length > 0) {
        setSteps(
          tasks.slice(0, 4).map((t) => ({
            label: t.description,
            status: t.completed ? 'done' : 'active'
          }))
        )
        return
      }
      setSteps(FALLBACK)
    } catch {
      setSteps(FALLBACK)
    }
  }

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 20_000)
    const off = window.esi?.onLogUpdated(() => refresh())
    const off2 = window.esi?.onMeetingStart?.(() => refresh())
    const off3 = window.esi?.onMeetingEnd?.(() => refresh())
    return () => {
      clearInterval(id)
      off?.()
      off2?.()
      off3?.()
    }
  }, [])

  return (
    <ul
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        lineHeight: 1.45,
        letterSpacing: '0.1em',
        textTransform: 'uppercase'
      }}
    >
      {steps.map((s, i) => {
        const color =
          s.status === 'done'
            ? 'var(--color-esi-good)'
            : s.status === 'active'
              ? 'var(--color-esi-c-200)'
              : 'transparent'
        return (
          <li
            key={i}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: 8,
                height: 8,
                marginTop: 4,
                borderRadius: '50%',
                flexShrink: 0,
                background: color,
                border:
                  s.status === 'pending'
                    ? '1px solid rgba(126,231,255,0.3)'
                    : 'none',
                boxShadow:
                  s.status !== 'pending' ? `0 0 6px ${color}` : 'none',
                animation: s.status === 'active' ? 'esi-pulse-glow 2s ease-in-out infinite' : undefined
              }}
            />
            <span
              style={{
                color:
                  s.status === 'pending'
                    ? 'var(--color-esi-fg-dim)'
                    : 'var(--color-esi-fg)',
                wordBreak: 'break-word'
              }}
            >
              {s.label}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
