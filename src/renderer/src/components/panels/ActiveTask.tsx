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
    <ul className="space-y-2 text-[13.5px] uppercase tracking-widest font-mono">
      {steps.map((s, i) => (
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
                  ? '1px solid rgba(0, 0, 0, 0.2)'
                  : 'none',
              boxShadow:
                s.status !== 'pending'
                  ? `0 0 6px ${s.status === 'done' ? 'var(--color-esi-green)' : 'var(--color-esi-cyan)'}`
                  : 'none'
            }}
          />
          <span
            className="truncate"
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
