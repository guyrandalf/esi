import { useEffect, useState } from 'react'

interface UiEvent {
  time: string
  title: string
  soon: boolean
  past: boolean
  allDay: boolean
}

function toUi(events: EsiCalendarEvent[]): UiEvent[] {
  const now = Date.now()
  const soonMs = 15 * 60 * 1000
  return events.map((e) => {
    const startMs = new Date(e.startIso).getTime()
    const endMs = new Date(e.endIso).getTime()
    return {
      time: e.allDay
        ? 'ALL DAY'
        : new Date(e.startIso).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          }),
      title: e.title,
      allDay: e.allDay,
      soon: startMs - now > 0 && startMs - now < soonMs,
      past: endMs < now
    }
  })
}

export function CalendarStrip(): React.JSX.Element {
  const [events, setEvents] = useState<UiEvent[] | null>(null)

  async function refresh(): Promise<void> {
    try {
      const raw = (await window.esi?.getCalendar()) ?? []
      const now = Date.now()
      const todayOnly = raw.filter((e) => {
        const start = new Date(e.startIso).getTime()
        const end = new Date(e.endIso).getTime()
        const endOfToday = new Date()
        endOfToday.setHours(23, 59, 59, 999)
        return end >= now - 30 * 60 * 1000 && start <= endOfToday.getTime()
      })
      setEvents(toUi(todayOnly).slice(0, 5))
    } catch {
      setEvents([])
    }
  }

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 60_000)
    return () => clearInterval(id)
  }, [])

  if (events === null) {
    return (
      <p
        className="text-[11px] uppercase tracking-widest"
        style={{ color: 'var(--color-esi-muted)' }}
      >
        [SYNCING CALENDAR…]
      </p>
    )
  }
  if (events.length === 0) {
    return (
      <p
        className="text-[11px] uppercase tracking-widest"
        style={{ color: 'var(--color-esi-muted)' }}
      >
        [NO EVENTS TODAY]
      </p>
    )
  }

  return (
    <ul className="space-y-3 font-mono tracking-tight">
      {events.map((e, i) => (
        <li
          key={i}
          className="flex items-baseline gap-3 text-[12.5px] uppercase"
          style={{ opacity: e.past ? 0.45 : 1 }}
        >
          <span
            className="w-[72px] shrink-0 font-bold tracking-widest"
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
