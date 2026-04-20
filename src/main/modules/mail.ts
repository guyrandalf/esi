import { runAppleScript } from './applescript'

export interface UnreadMessage {
  subject: string
  sender: string
  dateIso: string
  mailbox: string
}

const READ_SCRIPT = `
tell application "Mail"
  set output to ""
  set theAccounts to every account
  set countLeft to 20
  repeat with acct in theAccounts
    try
      set theBoxes to every mailbox of acct
      repeat with mbox in theBoxes
        try
          set unreadMsgs to (messages of mbox whose read status is false)
          repeat with m in unreadMsgs
            if countLeft ≤ 0 then exit repeat
            try
              set mSubject to subject of m
              set mSender to sender of m
              set mDate to (date received of m) as «class isot» as string
              set output to output & mSubject & tab & mSender & tab & mDate & tab & (name of mbox) & linefeed
              set countLeft to countLeft - 1
            end try
          end repeat
        end try
        if countLeft ≤ 0 then exit repeat
      end repeat
    end try
    if countLeft ≤ 0 then exit repeat
  end repeat
  return output
end tell
`.trim()

export async function getUnread(limit = 10): Promise<UnreadMessage[]> {
  try {
    const stdout = await runAppleScript(READ_SCRIPT, 15_000)
    const out: UnreadMessage[] = []
    for (const raw of stdout.split('\n')) {
      const line = raw.trim()
      if (!line) continue
      const [subject, sender, dateStr, mailbox] = line.split('\t')
      if (!subject) continue
      const d = new Date(dateStr)
      out.push({
        subject: subject.trim(),
        sender: (sender || '').trim(),
        dateIso: isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString(),
        mailbox: (mailbox || '').trim()
      })
      if (out.length >= limit) break
    }
    return out
  } catch (err) {
    console.warn('[esi] mail read failed:', err)
    return []
  }
}
