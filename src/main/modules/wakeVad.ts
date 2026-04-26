import { PvRecorder } from '@picovoice/pvrecorder-node'
import { transcribe, isAvailable as whisperAvailable } from './whisper'
import { isCapturing as voiceInputCapturing } from './voiceInput'

/**
 * Vosk-equivalent wake-word detector built on Whisper.
 *
 * Design:
 *  - Continuously reads mic frames (cheap).
 *  - Runs a lightweight amplitude VAD on each frame.
 *  - When sustained speech is detected, snapshots a rolling audio buffer
 *    and runs whisper-cpp on it asynchronously.
 *  - If the transcript matches one of the wake patterns, fires the `onWake`
 *    callback (which should kick off the full voice-capture flow).
 *
 * CPU profile: idle mostly — amplitude VAD is O(n) per frame (n=512). A
 * whisper run only happens after sustained speech *and* at most once per
 * `CHECK_COOLDOWN_MS`. With whisper-tiny on Apple Silicon, each check
 * takes ~150ms and runs well under 1% sustained CPU in a quiet room.
 */

const SAMPLE_RATE = 16000
const FRAME_LENGTH = 512
const FRAMES_PER_SEC = SAMPLE_RATE / FRAME_LENGTH

// Built-in MacBook mics baseline ~20 RMS in a quiet room and peak 8-15k on
// loud bursts, but sustained *speech* rarely crosses ~500 at conversational
// volume without leaning into the mic. 300 catches normal speaking voice
// from across a desk; 250ms of it is enough to be a word, not a cough.
const SPEECH_RMS_THRESHOLD = 300
// Start an utterance after 250ms of sustained speech…
const SPEECH_FRAMES_TO_TRIGGER = Math.ceil(FRAMES_PER_SEC * 0.25)
// …and end it after 400ms of trailing silence. This lets whisper see the
// *full* phrase ("hey esi", "queen esi") instead of just the first 250ms —
// which is why transcripts previously came back as "hey!" or "queenie".
const END_OF_UTTERANCE_FRAMES = Math.ceil(FRAMES_PER_SEC * 0.4)
// Rolling buffer length. Pre-roll context helps whisper catch the opening
// consonant; 3s is plenty for a wake phrase.
const UTTERANCE_BUFFER_SEC = 3
const CHECK_COOLDOWN_MS = 2000 // min gap between whisper invocations

// Accept common mishearings. Whisper-tiny in particular likes to spell "Esi"
// as "SE", "Essie", "easy", "queenie" (when preceded by "queen"), etc., so
// we cast a wide net. Also accepts the full product name "Queen Esi", the
// shorthand "queen", and contractions whisper produces for the two
// together ("queenie" / "queeny" / "kweeni").
const ESI_VARIANTS = '(?:esi|essie|easy|s\\.?e\\.?i\\.?|eesee|ee\\s*see|esy|esmay|ahsie|ehsie)'
const QUEEN_ESI_CONTRACTIONS = '(?:queenie|queeny|kweeni|kweenie|kweeny)'
const WAKE_PATTERNS: RegExp[] = [
  // "queenie" / "queeny" — whisper's typical contraction of "queen esi"
  new RegExp(`\\b${QUEEN_ESI_CONTRACTIONS}\\b`, 'i'),
  // "hey Esi", "yo Esi", "hey queen Esi", "hey queen"
  new RegExp(`\\b(?:hey|yo|hi|ok|okay)\\s+(?:queen\\s+)?${ESI_VARIANTS}\\b`, 'i'),
  new RegExp(`\\b(?:hey|yo|hi|ok|okay)\\s+(?:queen|${QUEEN_ESI_CONTRACTIONS})\\b`, 'i'),
  // "queen Esi, …"
  new RegExp(`\\bqueen\\s+${ESI_VARIANTS}\\b`, 'i'),
  // Bare "Esi," / "Esi!" — address form
  new RegExp(`\\b${ESI_VARIANTS}\\b\\s*[,.!?]`, 'i'),
  // Sentence-initial "Esi …"
  new RegExp(`^\\s*${ESI_VARIANTS}\\b`, 'i')
]

let recorder: PvRecorder | null = null
let running = false
let muted = false
let onWake: (() => void) | null = null
let onLevel: ((rms0to1: number) => void) | null = null
let lastCheckAt = 0
let speechFrameCount = 0
let transcribeBuffer: Int16Array[] = []
let pendingUtterance = false
let trailingSilenceFrames = 0
let isMeetingActive: () => boolean = () => false

export function isRunning(): boolean {
  return running
}
export function isMuted(): boolean {
  return muted
}
export function setMuted(m: boolean): void {
  muted = m
}
export function setMeetingChecker(fn: () => boolean): void {
  isMeetingActive = fn
}
/**
 * Subscribe to a normalized mic level stream (0..1) for UI feedback.
 * Fires every frame (~32ms) while the recorder is active.
 */
export function setLevelListener(fn: ((rms0to1: number) => void) | null): void {
  onLevel = fn
}
export function isConfigured(): boolean {
  return whisperAvailable()
}

export async function start(cb: () => void): Promise<boolean> {
  if (running) return true
  if (!whisperAvailable()) {
    console.warn('[esi] wakeVad: whisper not available — skipping')
    return false
  }
  try {
    recorder = new PvRecorder(FRAME_LENGTH, -1)
    recorder.start()
    running = true
    onWake = cb
    console.log(
      `[esi] wakeVad: mic opened, device="${recorder.getSelectedDevice?.() ?? '(default)'}", sampleRate=${SAMPLE_RATE}, frame=${FRAME_LENGTH}`
    )
    pump().catch((err) => console.warn('[esi] wakeVad pump failed:', err))
    // Heartbeat so we can tell the listener is alive and see audio levels.
    // Logs every 10s.
    startDiagnosticHeartbeat()
    return true
  } catch (err) {
    console.warn(
      `[esi] wakeVad start failed (likely microphone permission denied for Esi.app): ${err instanceof Error ? err.message : err}`
    )
    running = false
    recorder = null
    return false
  }
}

// ── Diagnostic heartbeat ──
let diagnosticTimer: NodeJS.Timeout | null = null
let diagPeakMax = 0
let diagRmsSum = 0
let diagRmsN = 0

function startDiagnosticHeartbeat(): void {
  if (diagnosticTimer) return
  diagnosticTimer = setInterval(() => {
    const rmsAvg = diagRmsN > 0 ? Math.round(diagRmsSum / diagRmsN) : 0
    console.log(
      `[esi] wakeVad heartbeat — last 10s: peakMax=${diagPeakMax}, rmsAvg=${rmsAvg}, frames=${diagRmsN}, muted=${muted}, meetingActive=${isMeetingActive()}`
    )
    diagPeakMax = 0
    diagRmsSum = 0
    diagRmsN = 0
  }, 10_000)
}

function noteDiagnostic(peak: number, rms: number): void {
  if (peak > diagPeakMax) diagPeakMax = peak
  diagRmsSum += rms
  diagRmsN++
}

export function stop(): void {
  if (!running || !recorder) return
  running = false
  try {
    recorder.stop()
  } catch {
    /* noop */
  }
  try {
    recorder.release()
  } catch {
    /* noop */
  }
  recorder = null
  speechFrameCount = 0
  transcribeBuffer = []
  pendingUtterance = false
  trailingSilenceFrames = 0
  if (diagnosticTimer) {
    clearInterval(diagnosticTimer)
    diagnosticTimer = null
  }
}

async function pump(): Promise<void> {
  while (running && recorder) {
    let frame: Int16Array
    try {
      frame = await recorder.read()
    } catch {
      break
    }

    const level = rms(frame)
    const peak = absMax(frame)
    noteDiagnostic(peak, level)

    // Broadcast live level for UI reactivity. Always — even while muted /
    // in a meeting / during manual capture — so the reactor still feels alive.
    if (onLevel) {
      const normalized = Math.min(1, level / 4000) // 4000 int16 RMS ≈ loud voice
      try {
        onLevel(normalized)
      } catch {
        /* noop */
      }
    }

    // Always push to the rolling buffer so we retain pre-speech context
    // (the opening consonant of "hey" / "queen" often lands in the frame
    // right before the VAD trips).
    const maxFrames = Math.ceil(FRAMES_PER_SEC * UTTERANCE_BUFFER_SEC)
    transcribeBuffer.push(frame)
    if (transcribeBuffer.length > maxFrames) transcribeBuffer.shift()

    // If the user is manually recording a command, the hotkey capture owns
    // the mic semantics — don't trip on their own speech.
    if (voiceInputCapturing()) continue
    // Muted or inside a meeting: discard state entirely.
    if (muted || isMeetingActive()) {
      speechFrameCount = 0
      pendingUtterance = false
      trailingSilenceFrames = 0
      continue
    }

    const speaking = level > SPEECH_RMS_THRESHOLD

    if (speaking) {
      speechFrameCount++
      trailingSilenceFrames = 0
      if (speechFrameCount >= SPEECH_FRAMES_TO_TRIGGER) {
        pendingUtterance = true
      }
    } else {
      speechFrameCount = Math.max(0, speechFrameCount - 1)
      if (pendingUtterance) {
        trailingSilenceFrames++
        if (trailingSilenceFrames >= END_OF_UTTERANCE_FRAMES) {
          // Utterance ended. Hand the full rolling buffer to whisper.
          const now = Date.now()
          if (now - lastCheckAt >= CHECK_COOLDOWN_MS) {
            lastCheckAt = now
            const snapshot = transcribeBuffer.slice()
            const secs = (snapshot.length * FRAME_LENGTH) / SAMPLE_RATE
            console.log(
              `[esi] wakeVad: utterance ended, running whisper on ${secs.toFixed(1)}s…`
            )
            checkWake(snapshot).catch((err) =>
              console.warn('[esi] wakeVad transcribe failed:', err)
            )
          }
          pendingUtterance = false
          trailingSilenceFrames = 0
          speechFrameCount = 0
        }
      }
    }
  }
}

async function checkWake(frames: Int16Array[]): Promise<void> {
  if (!onWake) return
  if (frames.length === 0) return
  const totalSamples = frames.reduce((a, f) => a + f.length, 0)
  const merged = new Int16Array(totalSamples)
  let offset = 0
  for (const f of frames) {
    merged.set(f, offset)
    offset += f.length
  }
  const buf = Buffer.from(merged.buffer)
  let text: string | null = null
  try {
    text = await transcribe(buf, { raw: true, sampleRate: SAMPLE_RATE })
  } catch {
    return
  }
  if (!text) return
  const clean = text.trim().toLowerCase()
  console.log(`[esi] wakeVad: whisper heard "${clean.slice(0, 80)}"`)
  if (clean.length < 2) return
  for (const p of WAKE_PATTERNS) {
    if (p.test(clean)) {
      fireWake(`phrase "${clean}"`)
      return
    }
  }
  console.log(`[esi] wakeVad: no wake pattern matched in "${clean.slice(0, 80)}"`)
}

function fireWake(reason: string): void {
  console.log(`[esi] wakeVad triggered: ${reason}`)
  const cb = onWake
  if (cb) {
    try {
      cb()
    } catch (err) {
      console.warn('[esi] wake callback threw:', err)
    }
  }
}

function rms(frame: Int16Array): number {
  let sum = 0
  for (let i = 0; i < frame.length; i++) {
    const v = frame[i]
    sum += v * v
  }
  return Math.sqrt(sum / frame.length)
}

function absMax(frame: Int16Array): number {
  let m = 0
  for (let i = 0; i < frame.length; i++) {
    const a = Math.abs(frame[i])
    if (a > m) m = a
  }
  return m
}
