import { getUserFacingApp } from './system'
import { getState as getCalendarState, CalendarEvent } from './calendar'
import { getCached as getProject } from './project'
import { snapshot as getMemory } from './memory'
import { homedir, userInfo } from 'os'
import * as imessage from './imessage'

function formatTimeRange(e: CalendarEvent): string {
  if (e.allDay) return 'All day'
  const start = new Date(e.startIso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
  const end = new Date(e.endIso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
  return `${start}–${end}`
}

function splitEventsByDay(events: CalendarEvent[]): {
  today: CalendarEvent[]
  tomorrow: CalendarEvent[]
} {
  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const tomorrowStart = new Date(todayStart)
  tomorrowStart.setDate(tomorrowStart.getDate() + 1)
  const dayAfter = new Date(tomorrowStart)
  dayAfter.setDate(dayAfter.getDate() + 1)

  const today: CalendarEvent[] = []
  const tomorrow: CalendarEvent[] = []
  for (const e of events) {
    const start = new Date(e.startIso)
    if (start >= todayStart && start < tomorrowStart) today.push(e)
    else if (start >= tomorrowStart && start < dayAfter) tomorrow.push(e)
  }
  return { today, tomorrow }
}

export function buildContext(): string {
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
  const timeStr = now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone

  const userApp = getUserFacingApp()
  const cal = getCalendarState()
  const proj = getProject()
  const mem = getMemory()

  const lines: string[] = []
  lines.push(`Current date: ${dateStr}`)
  lines.push(`Current local time: ${timeStr} (${tz})`)
  lines.push(`macOS user: ${userInfo().username} (home: ${homedir()})`)
  lines.push(
    'When you emit READ_FILE actions, ALWAYS use the real home path above — never "/Users/x/" or "/Users/user/" placeholders.'
  )

  if (userApp.app) {
    const title = userApp.title ? ` — "${userApp.title}"` : ''
    lines.push(`Randalf's current app: ${userApp.app}${title}`)
  } else {
    lines.push(`Randalf's current app: unknown`)
  }

  // Cheap signal for proactive awareness. Doesn't quote message text
  // (that would bloat the prompt); just a heads-up count.
  try {
    const unread = imessage.unreadCount()
    if (unread != null && unread > 0) {
      lines.push(`Unread iMessages/SMS: ${unread}`)
    }
  } catch {
    /* noop */
  }

  if (proj) {
    lines.push('')
    lines.push(`Current project: ${proj.name} at ${proj.path}`)
    if (proj.stack.length) lines.push(`  Stack: ${proj.stack.join(', ')}`)
    if (proj.envKeys.length)
      lines.push(`  .env keys present: ${proj.envKeys.join(', ')}`)
    if (proj.recentCommits.length) {
      lines.push('  Recent commits:')
      for (const c of proj.recentCommits.slice(0, 3)) {
        lines.push(`    - ${c}`)
      }
    }
  }

  lines.push('')
  if (!cal.hasEverSucceeded) {
    lines.push(
      "Calendar: UNAVAILABLE — can't reach Apple Calendar right now. Do NOT claim there are no events; say the calendar can't be read."
    )
  } else {
    const { today, tomorrow } = splitEventsByDay(cal.events)
    if (today.length > 0) {
      lines.push("Today's calendar:")
      for (const e of today.slice(0, 8)) {
        lines.push(`  • ${formatTimeRange(e)}: ${e.title}`)
      }
    } else {
      lines.push("Today's calendar: no events scheduled.")
    }
    if (tomorrow.length > 0) {
      lines.push('')
      lines.push("Tomorrow's calendar:")
      for (const e of tomorrow.slice(0, 5)) {
        lines.push(`  • ${formatTimeRange(e)}: ${e.title}`)
      }
    }
  }

  if (mem.people.length || mem.projects.length || mem.preferences.length) {
    lines.push('')
    lines.push('Things you have remembered about Randalf:')
    for (const p of mem.people.slice(0, 5)) {
      lines.push(`  • ${p.name}: ${p.context ?? ''}`)
    }
    for (const pr of mem.projects.slice(0, 3)) {
      const bits = [pr.path, pr.stack].filter(Boolean).join(' — ')
      lines.push(`  • Project ${pr.name}${bits ? ` (${bits})` : ''}`)
    }
    for (const pref of mem.preferences.slice(0, 5)) {
      lines.push(`  • ${pref.key}: ${pref.value}`)
    }
  }

  if (mem.tasks.length) {
    lines.push('')
    lines.push('Open tasks:')
    for (const t of mem.tasks.slice(0, 5)) {
      lines.push(`  • ${t.description}${t.due_date ? ` (due ${t.due_date})` : ''}`)
    }
  }

  return lines.join('\n')
}
