import { exec } from 'child_process'
import { promisify } from 'util'
import { readFileSync, existsSync } from 'fs'
import { clipboard, nativeImage } from 'electron'
import screenshot from 'screenshot-desktop'
import * as gemini from './gemini'
import { runAppleScript } from './applescript'
import { addReminder, listPending as listPendingReminders } from './reminders'
import { getUnread } from './mail'
import * as imessage from './imessage'
import * as contacts from './contacts'

const execP = promisify(exec)

export interface ActionResult {
  ok: boolean
  output: string
  requiresFollowUp?: boolean
  followUpContext?: string
}

const DESTRUCTIVE_RX = /\b(rm|mv|dd|mkfs|sudo|shutdown|reboot|git\s+push\s+--force|git\s+reset\s+--hard)\b/i

// ----------------- OPEN_APP / SWITCH_APP -----------------

export async function openApp(name: string): Promise<ActionResult> {
  try {
    await execP(`open -a ${JSON.stringify(name)}`, { timeout: 5000 })
    return { ok: true, output: `Opened ${name}.` }
  } catch (err) {
    return { ok: false, output: `Couldn't open ${name}: ${(err as Error).message}` }
  }
}

export async function switchApp(name: string): Promise<ActionResult> {
  try {
    await runAppleScript(
      `tell application ${JSON.stringify(name)} to activate`,
      3000
    )
    return { ok: true, output: `Switched to ${name}.` }
  } catch (err) {
    return {
      ok: false,
      output: `Couldn't switch to ${name}: ${(err as Error).message}`
    }
  }
}

// ----------------- File actions -----------------

export function readFile(path: string): ActionResult {
  // Hard-block hallucinated calendar file paths. macOS Calendar is an app,
  // not a file on disk. If calendar context is unavailable, the LLM tends
  // to invent things like ~/Documents/Calendar/*.icalendar which don't
  // exist — better to tell the model explicitly than return "not found"
  // and let it keep guessing.
  if (/\.(icalendar|ics|calendar)$/i.test(path) || /\/Calendar\//i.test(path)) {
    return {
      ok: false,
      output:
        'Calendar is an app, not a file. Read today/tomorrow events from REAL CONTEXT\'s "Today\'s calendar" section instead of READ_FILE. If REAL CONTEXT says calendar is UNAVAILABLE, say so directly — do not guess a path.',
      requiresFollowUp: true,
      followUpContext:
        'READ_FILE was incorrectly emitted for a calendar path. Do not retry. Answer the user by saying calendar data is not in context right now.'
    }
  }
  try {
    if (!existsSync(path)) return { ok: false, output: `File not found: ${path}` }
    const content = readFileSync(path, 'utf-8')
    const preview = content.length > 2000 ? content.slice(0, 2000) + '\n…(truncated)' : content
    return {
      ok: true,
      output: `Read ${path} (${content.length} bytes).`,
      requiresFollowUp: true,
      followUpContext: `File "${path}" contents:\n---\n${preview}\n---`
    }
  } catch (err) {
    return { ok: false, output: `Error reading ${path}: ${(err as Error).message}` }
  }
}

export function checkEnv(params: string): ActionResult {
  const [rawPath, key] = params.split(',').map((s) => s.trim())
  if (!rawPath || !key) {
    return { ok: false, output: 'CHECK_ENV needs "file,KEY" format.' }
  }
  if (!existsSync(rawPath)) {
    return { ok: false, output: `No file at ${rawPath}.` }
  }
  try {
    const content = readFileSync(rawPath, 'utf-8')
    const found = content
      .split('\n')
      .some((line) => line.trim().startsWith(`${key}=`) && !line.trim().startsWith('#'))
    return {
      ok: true,
      output: found ? `✓ ${key} is present in ${rawPath}.` : `✗ ${key} is missing from ${rawPath}.`
    }
  } catch (err) {
    return { ok: false, output: `Error reading ${rawPath}: ${(err as Error).message}` }
  }
}

// ----------------- Shell -----------------

export async function runCmd(command: string): Promise<ActionResult> {
  if (DESTRUCTIVE_RX.test(command)) {
    return {
      ok: false,
      output: `Refused — "${command}" looks destructive. Run it manually.`
    }
  }
  try {
    const { stdout, stderr } = await execP(command, {
      timeout: 15_000,
      maxBuffer: 512 * 1024
    })
    const out = (stdout || stderr || '').trim()
    return {
      ok: true,
      output: `Ran \`${command}\`.`,
      requiresFollowUp: true,
      followUpContext: out.slice(0, 3000) || '(no output)'
    }
  } catch (err) {
    return {
      ok: false,
      output: `Command failed: ${(err as Error).message}`
    }
  }
}

// ----------------- Clipboard -----------------

export function readClipboard(): ActionResult {
  const text = clipboard.readText()
  if (!text) return { ok: true, output: 'The clipboard is empty.' }
  const preview = text.length > 400 ? text.slice(0, 400) + '…' : text
  return {
    ok: true,
    output: `Clipboard has ${text.length} chars.`,
    requiresFollowUp: true,
    followUpContext: `Clipboard contents:\n---\n${preview}\n---`
  }
}

// ----------------- Web search -----------------

export async function webSearch(query: string): Promise<ActionResult> {
  try {
    const res = await fetch(
      `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0 Esi/0.1' },
        signal: AbortSignal.timeout(8000)
      }
    )
    if (!res.ok) throw new Error(`DuckDuckGo ${res.status}`)
    const html = await res.text()
    // Quick regex extraction of top results
    const results: string[] = []
    const resultRx = /<a[^>]+class="result__a"[^>]*>([^<]+)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([^<]+)<\/a>/g
    let m: RegExpExecArray | null
    while ((m = resultRx.exec(html)) !== null && results.length < 5) {
      const title = m[1].replace(/<[^>]+>/g, '').trim()
      const snippet = m[2].replace(/<[^>]+>/g, '').trim()
      results.push(`• ${title} — ${snippet}`)
    }
    const out = results.length ? results.join('\n') : '(no results)'
    return {
      ok: true,
      output: `Found ${results.length} results.`,
      requiresFollowUp: true,
      followUpContext: `Web search "${query}":\n${out}`
    }
  } catch (err) {
    return { ok: false, output: `Search failed: ${(err as Error).message}` }
  }
}

// ----------------- Screenshot + Vision -----------------

export async function screenshotAndDescribe(
  question: string,
  systemPrompt: string
): Promise<ActionResult> {
  try {
    if (!gemini.isConfigured()) {
      return { ok: false, output: 'Vision needs a Gemini API key.' }
    }
    const buf = await screenshot({ format: 'png' })
    const img = nativeImage.createFromBuffer(buf)
    // Downscale huge screens to keep Gemini happy
    const resized = img.resize({ width: 1280 })
    const base64 = resized.toPNG().toString('base64')
    const desc = await gemini.visionQuery(base64, question || 'Describe what is on the screen concisely.', systemPrompt)
    return {
      ok: true,
      output: desc,
      requiresFollowUp: false
    }
  } catch (err) {
    return { ok: false, output: `Screenshot failed: ${(err as Error).message}` }
  }
}

// ----------------- Media -----------------

export async function playMusic(query: string): Promise<ActionResult> {
  const script = query
    ? `tell application "Spotify" to play track "${query.replace(/"/g, '\\"')}"`
    : `tell application "Spotify" to play`
  try {
    await runAppleScript(script, 3000)
    return { ok: true, output: `Playing ${query || 'on Spotify'}.` }
  } catch (err) {
    return { ok: false, output: `Couldn't play: ${(err as Error).message}` }
  }
}

// ----------------- Calendar create -----------------

export async function createEvent(params: string): Promise<ActionResult> {
  const [title, isoStart, durationStr] = params.split('|').map((s) => s.trim())
  if (!title || !isoStart) {
    return { ok: false, output: 'CREATE_EVENT needs "title|ISO start|duration-min".' }
  }
  const start = new Date(isoStart)
  if (isNaN(start.getTime())) {
    return { ok: false, output: `Couldn't parse start date "${isoStart}".` }
  }
  const duration = Math.max(5, parseInt(durationStr, 10) || 30)
  const end = new Date(start.getTime() + duration * 60_000)
  const script = `
    tell application "Calendar"
      tell calendar 1
        make new event with properties {summary:"${title.replace(/"/g, '\\"')}", start date:date "${start.toLocaleString('en-US')}", end date:date "${end.toLocaleString('en-US')}"}
      end tell
    end tell
  `
  try {
    await runAppleScript(script, 10_000)
    return { ok: true, output: `Added "${title}" at ${start.toLocaleString()} for ${duration} min.` }
  } catch (err) {
    return { ok: false, output: `Couldn't add event: ${(err as Error).message}` }
  }
}

// ----------------- Email draft -----------------

export async function draftEmail(params: string): Promise<ActionResult> {
  const [to, subject, body] = params.split('|').map((s) => s.trim())
  if (!to || !subject) {
    return { ok: false, output: 'DRAFT_EMAIL needs "to|subject|body".' }
  }
  const script = `
    tell application "Mail"
      set theMsg to make new outgoing message with properties {subject:"${subject.replace(/"/g, '\\"')}", content:"${(body || '').replace(/"/g, '\\"')}", visible:true}
      tell theMsg
        make new to recipient at end of to recipients with properties {address:"${to}"}
      end tell
    end tell
  `
  try {
    await runAppleScript(script, 10_000)
    return { ok: true, output: `Drafted email to ${to}.` }
  } catch (err) {
    return { ok: false, output: `Couldn't draft email: ${(err as Error).message}` }
  }
}

// ----------------- Reminders / Unread mail -----------------

export async function createReminder(params: string): Promise<ActionResult> {
  const [title, dueStr] = params.split('|').map((s) => s.trim())
  if (!title) return { ok: false, output: 'CREATE_REMINDER needs a title.' }
  try {
    await addReminder(title, dueStr || null)
    return { ok: true, output: `Added a reminder: "${title}".` }
  } catch (err) {
    return { ok: false, output: `Couldn't add reminder: ${(err as Error).message}` }
  }
}

export async function readMail(): Promise<ActionResult> {
  try {
    const unread = await getUnread(8)
    if (unread.length === 0) {
      return { ok: true, output: 'Your inbox is clear. No unread mail.' }
    }
    const lines = unread
      .slice(0, 6)
      .map((m) => `• ${m.sender.split('<')[0].trim()} — ${m.subject}`)
    return {
      ok: true,
      output: `You have ${unread.length} unread message${unread.length === 1 ? '' : 's'}.`,
      requiresFollowUp: true,
      followUpContext: `Unread mail:\n${lines.join('\n')}`
    }
  } catch (err) {
    return { ok: false, output: `Couldn't read mail: ${(err as Error).message}` }
  }
}

// ----------------- SEND_IMESSAGE -----------------

async function sendIMessage(params: string): Promise<ActionResult> {
  // Format: recipient|message text  (recipient can be a name, number, or email)
  const sep = params.indexOf('|')
  if (sep < 0) {
    return {
      ok: false,
      output: 'SEND_IMESSAGE needs "recipient|message" format.'
    }
  }
  const rawRecipient = params.slice(0, sep).trim()
  const text = params.slice(sep + 1).trim()
  if (!rawRecipient || !text) {
    return { ok: false, output: 'SEND_IMESSAGE needs both a recipient and a message.' }
  }

  // If the recipient doesn't already look like a phone/email, resolve via Contacts.
  let recipient = rawRecipient
  const looksLikeHandle = /@|^[+\d]/.test(rawRecipient)
  if (!looksLikeHandle) {
    const c = await contacts.lookup(rawRecipient)
    if (c && (c.phones.length || c.emails.length)) {
      recipient = c.phones[0] ?? c.emails[0]
    }
  }

  const { ok, error } = await imessage.send(recipient, text)
  if (!ok) return { ok: false, output: `Couldn't send: ${error ?? 'unknown error'}` }
  return { ok: true, output: `Sent to ${rawRecipient}.` }
}

// ----------------- READ_IMESSAGES -----------------

async function readIMessages(): Promise<ActionResult> {
  const msgs = imessage.recent(15)
  if (msgs === null) {
    return {
      ok: false,
      output:
        "Can't read Messages — Full Disk Access isn't granted to ESI. Grant it in System Settings → Privacy & Security → Full Disk Access."
    }
  }
  if (msgs.length === 0) return { ok: true, output: 'No recent messages.' }

  const lines = msgs
    .slice(0, 10)
    .map((m) => {
      const who = m.fromMe ? 'You' : m.chatName || m.handle || 'unknown'
      const when = m.date
        ? new Date(m.date).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          })
        : ''
      return `${when} · ${who}: ${m.text.slice(0, 140)}`
    })
  return {
    ok: true,
    output: `${msgs.length} recent messages`,
    requiresFollowUp: true,
    followUpContext: `Recent messages:\n${lines.join('\n')}`
  }
}

// ----------------- LIST_REMINDERS -----------------

async function listRemindersAction(): Promise<ActionResult> {
  const items = await listPendingReminders(20)
  if (items.length === 0) return { ok: true, output: 'No pending reminders.' }
  const lines = items.slice(0, 10).map((r) => {
    const due = r.dueIso
      ? ` (due ${new Date(r.dueIso).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        })})`
      : ''
    return `• ${r.title}${due} [${r.list}]`
  })
  return {
    ok: true,
    output: `${items.length} pending reminders.`,
    requiresFollowUp: true,
    followUpContext: `Pending reminders:\n${lines.join('\n')}`
  }
}

// ----------------- LOOKUP_CONTACT -----------------

async function lookupContactAction(name: string): Promise<ActionResult> {
  if (!name) return { ok: false, output: 'LOOKUP_CONTACT needs a name.' }
  const c = await contacts.lookup(name)
  if (!c) return { ok: false, output: `No contact matching "${name}".` }
  const bits = [c.phones[0], c.emails[0]].filter(Boolean).join(' · ')
  return {
    ok: true,
    output: `${c.name}${bits ? ' — ' + bits : ''}`,
    requiresFollowUp: true,
    followUpContext: `Contact ${c.name}:\nphones: ${c.phones.join(', ') || '—'}\nemails: ${c.emails.join(', ') || '—'}`
  }
}

// ----------------- Dispatcher -----------------

export async function execute(
  type: string,
  params: string,
  systemPrompt: string
): Promise<ActionResult> {
  switch (type) {
    case 'OPEN_APP':
      return openApp(params)
    case 'SWITCH_APP':
      return switchApp(params)
    case 'READ_FILE':
      return readFile(params)
    case 'CHECK_ENV':
      return checkEnv(params)
    case 'RUN_CMD':
      return runCmd(params)
    case 'READ_CLIPBOARD':
      return readClipboard()
    case 'WEB_SEARCH':
      return webSearch(params)
    case 'SCREENSHOT':
      return screenshotAndDescribe(params || '', systemPrompt)
    case 'PLAY_MUSIC':
      return playMusic(params)
    case 'CREATE_EVENT':
      return createEvent(params)
    case 'DRAFT_EMAIL':
      return draftEmail(params)
    case 'CREATE_REMINDER':
      return createReminder(params)
    case 'READ_MAIL':
      return readMail()
    case 'SEND_IMESSAGE':
      return sendIMessage(params)
    case 'READ_IMESSAGES':
      return readIMessages()
    case 'LIST_REMINDERS':
      return listRemindersAction()
    case 'LOOKUP_CONTACT':
      return lookupContactAction(params)
    default:
      return { ok: false, output: `Unknown action type: ${type}` }
  }
}
