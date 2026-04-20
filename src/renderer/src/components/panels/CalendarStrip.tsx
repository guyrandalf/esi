import { useEffect, useState } from 'react'

interface UiEvent {
  time: string
  title: string
  active: boolean
  done: boolean
  allDay: boolean
}

function toUi(events: EsiCalendarEvent[]): UiEvent[] {
  const now = Date.now()
  return events.map((e) => {
    const startMs = new Date(e.startIso).getTime()
    const endMs = new Date(e.endIso).getTime()
    return {
      time: e.allDay
        ? 'ALL'
        : new Date(e.startIso).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          }),
      title: e.title,
      allDay: e.allDay,
      active: now >= startMs && now < endMs,
      done: endMs < now
    }
  })
}

/**
 * AgendaPanel — JARVIS agenda style. Kept the old name `CalendarStrip`
 * so existing imports keep working; content is now the full-panel AgendaPanel.
 */
export function CalendarStrip(): React.JSX.Element {
  const [events, setEvents] = useState<UiEvent[] | null>(null)

  async function refresh(): Promise<void> {
    try {
      const raw = (await window.esi?.getCalendar()) ?? []
      const now = Date.now()
      const endOfToday = new Date()
      endOfToday.setHours(23, 59, 59, 999)
      const todayOnly = raw.filter((e) => {
        const start = new Date(e.startIso).getTime()
        const end = new Date(e.endIso).getTime()
        return end >= now - 30 * 60 * 1000 && start <= endOfToday.getTime()
      })
      setEvents(toUi(todayOnly).slice(0, 8))
    } catch {
      setEvents([])
    }
  }

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 60_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="panel">
      <div className="panel-head">
        <span>
          <span className="dot" />
          AGENDA · TODAY
        </span>
        <span className="mono" style={{ fontSize: 9, color: 'var(--color-esi-fg-dim)' }}>
          {events === null ? 'SYNC…' : `${events.length} EVENTS`}
        </span>
      </div>
      <div style={{ padding: '8px 0' }}>
        {events === null && (
          <div
            className="mono"
            style={{
              padding: '8px 14px',
              fontSize: 10,
              color: 'var(--color-esi-fg-dim)',
              letterSpacing: '0.15em',
              textTransform: 'uppercase'
            }}
          >
            Syncing calendar…
          </div>
        )}
        {events !== null && events.length === 0 && (
          <div
            className="mono"
            style={{
              padding: '8px 14px',
              fontSize: 10,
              color: 'var(--color-esi-fg-dim)',
              letterSpacing: '0.15em',
              textTransform: 'uppercase'
            }}
          >
            No events today
          </div>
        )}
        {events?.map((e, i) => (
          <div
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: '56px 1fr auto',
              alignItems: 'center',
              gap: 10,
              padding: '7px 14px',
              borderLeft: `2px solid ${
                e.active ? 'var(--color-esi-c-200)' : e.done ? 'var(--color-esi-c-700)' : 'transparent'
              }`,
              background: e.active ? 'rgba(126,231,255,0.05)' : 'transparent',
              opacity: e.done ? 0.5 : 1
            }}
          >
            <span
              className="mono"
              style={{
                fontSize: 11,
                color: e.active ? 'var(--color-esi-c-100)' : 'var(--color-esi-fg-dim)',
                letterSpacing: '0.1em'
              }}
            >
              {e.time}
            </span>
            <span
              style={{
                fontSize: 13,
                color: 'var(--color-esi-fg)',
                textDecoration: e.done ? 'line-through' : 'none',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {e.title}
            </span>
            <span
              className="mono"
              style={{
                fontSize: 8,
                letterSpacing: '0.2em',
                color: e.active ? 'var(--color-esi-c-100)' : 'var(--color-esi-fg-dim)',
                border: `1px solid ${
                  e.active ? 'var(--color-esi-c-200)' : 'rgba(126,231,255,0.2)'
                }`,
                padding: '2px 5px'
              }}
            >
              {e.allDay ? 'ALL' : e.active ? 'NOW' : e.done ? 'DONE' : 'TODAY'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
