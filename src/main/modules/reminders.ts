import { runAppleScript } from './applescript'

export interface Reminder {
  title: string
  list: string
  dueIso: string | null
  completed: boolean
}

/**
 * Pending reminders across all lists, up to `limit`.
 */
export async function listPending(limit = 20): Promise<Reminder[]> {
  const script = `
tell application "Reminders"
  set output to ""
  set listCount to 0
  repeat with lst in lists
    try
      set pending to (reminders of lst whose completed is false)
      repeat with r in pending
        if listCount >= ${limit} then exit repeat
        try
          set rName to name of r
          set rList to name of lst
          set rDue to ""
          try
            set rDue to ((due date of r) as «class isot» as string)
          end try
          set output to output & rName & tab & rList & tab & rDue & linefeed
          set listCount to listCount + 1
        end try
      end repeat
    end try
    if listCount >= ${limit} then exit repeat
  end repeat
  return output
end tell
`.trim()

  try {
    const stdout = await runAppleScript(script, 10_000)
    const items: Reminder[] = []
    for (const line of stdout.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed) continue
      const [title, list, due] = trimmed.split('\t')
      items.push({
        title: title?.trim() ?? '',
        list: list?.trim() ?? '',
        dueIso: due?.trim() || null,
        completed: false
      })
    }
    return items
  } catch (err) {
    console.warn('[esi] reminders.listPending failed:', err)
    return []
  }
}

/**
 * Add a reminder to the default list in macOS Reminders.app.
 * Triggers the first-run permission prompt on the user's Mac.
 */
export async function addReminder(
  title: string,
  dueDate?: Date | string | null
): Promise<void> {
  const escaped = title.replace(/"/g, '\\"')
  let script: string
  if (dueDate) {
    const d = dueDate instanceof Date ? dueDate : new Date(dueDate)
    if (!isNaN(d.getTime())) {
      // AppleScript `date` literal expects local format — safest via numeric setup
      const iso = d.toISOString()
      script = `
        tell application "Reminders"
          set newReminder to make new reminder with properties {name:"${escaped}"}
          set remind me date of newReminder to (current date) + ((time to GMT) + ((date "${iso}" as «class isot» as date) - (current date)))
        end tell
      `.trim()
      // The date math above is fragile; fall through to simpler variant:
      script = `
        set targetDate to current date
        set theYear to ${d.getFullYear()}
        set theMonth to ${d.getMonth() + 1}
        set theDay to ${d.getDate()}
        set theHour to ${d.getHours()}
        set theMinute to ${d.getMinutes()}
        set year of targetDate to theYear
        set month of targetDate to theMonth
        set day of targetDate to theDay
        set hours of targetDate to theHour
        set minutes of targetDate to theMinute
        set seconds of targetDate to 0
        tell application "Reminders"
          make new reminder with properties {name:"${escaped}", remind me date:targetDate}
        end tell
      `.trim()
    } else {
      script = `tell application "Reminders" to make new reminder with properties {name:"${escaped}"}`
    }
  } else {
    script = `tell application "Reminders" to make new reminder with properties {name:"${escaped}"}`
  }
  await runAppleScript(script, 8000)
}
