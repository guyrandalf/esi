import { runAppleScript } from './applescript'

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
