import { BrowserWindow } from 'electron'
import { getCurrent as getSystem } from './system'
import { get as getDb } from './db'
import * as gemini from './gemini'
import * as whisper from './whisper'
import { speak } from './voice'
import { addTask } from './memory'
import { draftEmail } from './actions'
import { addReminder } from './reminders'
import { execSync } from 'child_process'
import record from 'node-record-lpcm16'
import type { Writable } from 'stream'

const MEETING_APPS = new Set([
  'zoom.us',
  'zoom',
  'Google Meet',
  'Microsoft Teams',
  'Slack',
  'FaceTime',
  'Discord',
  'Webex'
])

interface ActiveMeeting {
  app: string
  startedAt: number
  transcriptChunks: string[]
  recorder: ReturnType<typeof record.record> | null
  buffer: Buffer[]
  chunkTimer: NodeJS.Timeout | null
}

let active: ActiveMeeting | null = null
let lastSeenApp: string | null = null
let detectorInterval: NodeJS.Timeout | null = null

function broadcast(channel: string, payload: unknown): void {
  for (const w of BrowserWindow.getAllWindows()) {
    w.webContents.send(channel, payload)
  }
}

function hasBlackhole(): boolean {
  try {
    const out = execSync(
      'system_profiler SPAudioDataType 2>/dev/null | grep -i blackhole || true',
      { encoding: 'utf-8' }
    )
    return out.trim().length > 0
  } catch {
    return false
  }
}

function startRecording(): ReturnType<typeof record.record> | null {
  try {
    const rec = record.record({
      sampleRate: 16000,
      channels: 1,
      compress: false,
      threshold: 0,
      recorder: 'sox'
    })
    return rec
  } catch (err) {
    console.warn('[esi] audio record failed:', err)
    return null
  }
}

async function transcribeChunk(): Promise<void> {
  if (!active || active.buffer.length === 0) return
  const audioBuf = Buffer.concat(active.buffer)
  active.buffer = []
  if (!whisper.isAvailable()) return
  try {
    const text = await whisper.transcribe(audioBuf)
    if (text.trim()) {
      active.transcriptChunks.push(text.trim())
      broadcast('esi:meeting-transcript', active.transcriptChunks.join(' '))
    }
  } catch (err) {
    console.warn('[esi] whisper chunk failed:', err)
  }
}

function beginMeeting(app: string): void {
  if (active) return
  active = {
    app,
    startedAt: Date.now(),
    transcriptChunks: [],
    recorder: null,
    buffer: [],
    chunkTimer: null
  }
  broadcast('esi:meeting-start', { app, startedAt: active.startedAt })
  speak(`Meeting detected. I'm listening.`)

  if (!whisper.isAvailable() || !hasBlackhole()) {
    console.warn(
      '[esi] meeting capture skipped — whisper-cpp or BlackHole not found. Install both to enable.'
    )
    return
  }

  try {
    const rec = startRecording()
    if (!rec) return
    active.recorder = rec
    const stream = rec.stream() as unknown as Writable
    stream.on('data', (d: Buffer) => {
      active?.buffer.push(d)
    })
    active.chunkTimer = setInterval(() => {
      transcribeChunk()
    }, 30_000)
  } catch (err) {
    console.warn('[esi] could not start recorder:', err)
  }
}

async function endMeeting(): Promise<void> {
  if (!active) return
  const meeting = active
  active = null
  try {
    meeting.recorder?.stop()
  } catch {
    /* noop */
  }
  if (meeting.chunkTimer) clearInterval(meeting.chunkTimer)
  await transcribeChunkFor(meeting)

  const transcript = meeting.transcriptChunks.join('\n')
  const durationMin = Math.round((Date.now() - meeting.startedAt) / 60_000)

  let summary = ''
  let actionItems = ''
  let followUp = ''

  if (transcript && gemini.isConfigured()) {
    try {
      const prompt = `Summarize this meeting transcript. Return JSON:
{
  "summary": "3-4 sentence overview",
  "action_items": [{"owner":"name or null", "task":"...", "due":"YYYY-MM-DD or null"}],
  "open_questions": ["..."],
  "follow_up_email": "short professional follow-up email body"
}
Transcript:
${transcript.slice(0, 12000)}`
      const raw = await gemini.reason(prompt, 'You return only JSON. No markdown, no commentary.')
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as {
          summary?: string
          action_items?: Array<{ owner: string | null; task: string; due: string | null }>
          follow_up_email?: string
        }
        summary = parsed.summary ?? ''
        actionItems = JSON.stringify(parsed.action_items ?? [])
        followUp = parsed.follow_up_email ?? ''
        for (const item of parsed.action_items ?? []) {
          addTask(item.task, {
            source: `meeting:${meeting.app}`,
            due_date: item.due ?? null
          })
          // Also surface in macOS Reminders so it shows on iPhone, etc.
          addReminder(item.task, item.due ?? null).catch(() => {
            /* ignore — e.g. permission denied */
          })
        }
      }
    } catch (err) {
      console.warn('[esi] meeting summary failed:', err)
    }
  }

  getDb()
    .prepare(
      `INSERT INTO meetings (timestamp, app, duration_minutes, transcript, summary, action_items, follow_up_draft)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      new Date(meeting.startedAt).toISOString(),
      meeting.app,
      durationMin,
      transcript || null,
      summary || null,
      actionItems || null,
      followUp || null
    )

  if (followUp) {
    try {
      await draftEmail(`|Follow up on our ${meeting.app} meeting|${followUp}`)
    } catch {
      /* noop — user can paste from summary */
    }
  }

  broadcast('esi:meeting-end', {
    app: meeting.app,
    durationMin,
    summary,
    transcript
  })

  const spokenSummary = summary
    ? `Meeting ended. ${summary}`
    : `Meeting ended after ${durationMin} minutes.`
  speak(spokenSummary)
}

async function transcribeChunkFor(meeting: ActiveMeeting): Promise<void> {
  if (meeting.buffer.length === 0) return
  const audioBuf = Buffer.concat(meeting.buffer)
  meeting.buffer = []
  if (!whisper.isAvailable()) return
  try {
    const text = await whisper.transcribe(audioBuf)
    if (text.trim()) meeting.transcriptChunks.push(text.trim())
  } catch {
    /* noop */
  }
}

function tick(): void {
  const sys = getSystem()
  const current = sys.activeApp
  const wasMeeting = lastSeenApp && MEETING_APPS.has(lastSeenApp)
  const isMeeting = current && MEETING_APPS.has(current)

  if (isMeeting && !wasMeeting && !active) {
    beginMeeting(current)
  } else if (!isMeeting && active) {
    endMeeting().catch(() => {/* noop */})
  }

  lastSeenApp = current
}

export function start(intervalMs = 5000): void {
  if (detectorInterval) return
  detectorInterval = setInterval(tick, intervalMs)
}

export function stop(): void {
  if (detectorInterval) clearInterval(detectorInterval)
  detectorInterval = null
  if (active) endMeeting().catch(() => {/* noop */})
}

export function getActive(): { app: string; startedAt: number; transcript: string } | null {
  if (!active) return null
  return {
    app: active.app,
    startedAt: active.startedAt,
    transcript: active.transcriptChunks.join(' ')
  }
}
