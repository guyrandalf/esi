import { runAppleScript } from './applescript'

export interface Contact {
  name: string
  phones: string[]
  emails: string[]
}

/**
 * Look up a contact by name. Returns the top match — macOS Contacts
 * is fuzzy-friendly, so a substring like "sarah" matches "Sarah Kim".
 */
export async function lookup(name: string): Promise<Contact | null> {
  const safe = name.replace(/"/g, '\\"').trim()
  if (!safe) return null
  const script = `
tell application "Contacts"
  set hits to (people whose name contains "${safe}")
  if (count of hits) is 0 then return ""
  set p to first item of hits
  set pName to name of p
  set phoneList to ""
  try
    repeat with ph in phones of p
      set phoneList to phoneList & (value of ph) & ","
    end repeat
  end try
  set emailList to ""
  try
    repeat with em in emails of p
      set emailList to emailList & (value of em) & ","
    end repeat
  end try
  return pName & tab & phoneList & tab & emailList
end tell
`.trim()

  try {
    const stdout = (await runAppleScript(script, 8_000)).trim()
    if (!stdout) return null
    const [name, phonesCsv, emailsCsv] = stdout.split('\t')
    return {
      name: (name ?? '').trim(),
      phones: (phonesCsv ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      emails: (emailsCsv ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    }
  } catch (err) {
    console.warn('[esi] contacts.lookup failed:', err)
    return null
  }
}
