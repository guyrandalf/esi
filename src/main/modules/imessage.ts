/**
 * iMessage + SMS reader and sender.
 *
 * Read path: the macOS Messages database at ~/Library/Messages/chat.db.
 * Full Disk Access required to open the file.
 *
 * Send path: AppleScript to Messages.app. macOS will prompt for Automation
 * permission the first time. Works for iMessage or SMS relay (iPhone must
 * be nearby + Messages Forwarding enabled for SMS).
 */

import Database from 'better-sqlite3'
import { existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { runAppleScript } from './applescript'

export interface IMessage {
  text: string
  fromMe: boolean
  handle: string // phone / email of the other party
  chatName: string | null // group name, or null for 1:1
  date: string // ISO
  isRead: boolean
}

const MESSAGES_DB = join(homedir(), 'Library', 'Messages', 'chat.db')

// Apple Core Data time: seconds since 2001-01-01 UTC, but Messages stores
// in *nanoseconds* since the same epoch for modern macOS.
const APPLE_EPOCH_OFFSET = 978307200

function appleTimeToDate(t: number): Date {
  // If it's big enough to be nanoseconds, scale down
  const seconds = t > 1e14 ? t / 1e9 : t
  return new Date((seconds + APPLE_EPOCH_OFFSET) * 1000)
}

export function isAvailable(): boolean {
  return existsSync(MESSAGES_DB)
}

/**
 * Recent messages across all chats. Ordered newest-first.
 * Returns `null` if we can't read the DB (permission / missing).
 */
export function recent(limit = 20): IMessage[] | null {
  if (!existsSync(MESSAGES_DB)) return null
  let db: Database.Database
  try {
    db = new Database(MESSAGES_DB, { readonly: true, fileMustExist: true })
  } catch {
    return null
  }
  try {
    const rows = db
      .prepare(
        `SELECT
           m.text               AS text,
           m.attributedBody     AS attrbody,
           m.is_from_me         AS from_me,
           m.date               AS date_raw,
           m.is_read            AS is_read,
           h.id                 AS handle_id,
           c.display_name       AS chat_name
         FROM message m
         LEFT JOIN handle h ON h.ROWID = m.handle_id
         LEFT JOIN chat_message_join cmj ON cmj.message_id = m.ROWID
         LEFT JOIN chat c ON c.ROWID = cmj.chat_id
         WHERE (m.text IS NOT NULL OR m.attributedBody IS NOT NULL)
         ORDER BY m.date DESC
         LIMIT ?`
      )
      .all(limit) as Array<{
      text: string | null
      attrbody: Buffer | null
      from_me: number | null
      date_raw: number | null
      is_read: number | null
      handle_id: string | null
      chat_name: string | null
    }>

    const out: IMessage[] = []
    for (const r of rows) {
      const text = r.text ?? decodeAttributedBody(r.attrbody)
      if (!text) continue
      out.push({
        text: text.trim(),
        fromMe: r.from_me === 1,
        handle: r.handle_id ?? '',
        chatName: r.chat_name,
        date:
          r.date_raw != null ? appleTimeToDate(r.date_raw).toISOString() : '',
        isRead: r.is_read === 1
      })
    }
    return out
  } catch {
    return null
  } finally {
    db.close()
  }
}

/**
 * Count of unread incoming messages. Cheap enough to call every few seconds.
 */
export function unreadCount(): number | null {
  if (!existsSync(MESSAGES_DB)) return null
  let db: Database.Database
  try {
    db = new Database(MESSAGES_DB, { readonly: true, fileMustExist: true })
  } catch {
    return null
  }
  try {
    const row = db
      .prepare(
        `SELECT COUNT(*) AS n
         FROM message
         WHERE is_read = 0 AND is_from_me = 0 AND (text IS NOT NULL OR attributedBody IS NOT NULL)`
      )
      .get() as { n: number } | undefined
    return row?.n ?? 0
  } catch {
    return null
  } finally {
    db.close()
  }
}

/**
 * Send an iMessage (or SMS if the recipient isn't on iMessage and your
 * iPhone is connected with Text Message Forwarding). Returns ok on the
 * AppleScript exit code — doesn't verify actual delivery.
 *
 * recipient: phone number, email, or contact name as listed in Messages.app
 */
export async function send(recipient: string, text: string): Promise<{ ok: boolean; error?: string }> {
  const safeText = text.replace(/"/g, '\\"')
  const safeRecipient = recipient.replace(/"/g, '\\"')
  const script = `
tell application "Messages"
  set targetService to id of 1st account whose service type = iMessage
  try
    set targetBuddy to buddy "${safeRecipient}" of service id targetService
    send "${safeText}" to targetBuddy
    return "ok"
  on error errMsg
    -- Fallback: let Messages resolve the recipient itself
    try
      send "${safeText}" to participant "${safeRecipient}"
      return "ok"
    on error e2
      return "err: " & e2
    end try
  end try
end tell
`.trim()
  try {
    const out = (await runAppleScript(script, 10_000)).trim()
    if (out.startsWith('ok')) return { ok: true }
    return { ok: false, error: out }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Messages before ~macOS Sonoma stored plaintext in `text`. Newer versions
 * sometimes store it *only* in `attributedBody` as an NSKeyedArchiver blob.
 * This is a best-effort extractor that pulls the user-visible string out
 * without fully parsing the NSArchiver format.
 */
function decodeAttributedBody(buf: Buffer | null): string | null {
  if (!buf) return null
  const s = buf.toString('utf8')
  // NSKeyedArchiver stores the text right after a "NSString" marker and a
  // length byte. We look for "NSString" and scan forward for printable bytes.
  const marker = 'NSString'
  const idx = s.indexOf(marker)
  if (idx === -1) return null
  const after = s.slice(idx + marker.length + 3)
  // Grab the longest run of printable chars
  const match = after.match(/[\x20-\x7E\u00A0-\uFFFF][\x20-\x7E\u00A0-\uFFFF\n\r\t]+/)
  return match ? match[0].trim() : null
}
