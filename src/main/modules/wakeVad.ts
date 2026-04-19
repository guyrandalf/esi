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

const SPEECH_RMS_THRESHOLD = 520
const SPEECH_FRAMES_TO_TRIGGER = Math.ceil(FRAMES_PER_SEC * 0.35) // 350ms
const TRANSCRIBE_WINDOW_SEC = 2
const CHECK_COOLDOWN_MS = 2000 // min gap between whisper invocations

// Clap detection — tuned to reject speech.
//
// Why the previous tuning kept false-triggering: speech peaks routinely hit
// ~8000-12000 int16 and we get a new word every ~300ms, so three "loud
// frames" within 2.1s is trivially easy to hit while talking. We now require
// all of these to trigger a clap:
//
//   1. High absolute peak (a clap is genuinely louder than most speech)
//   2. High CREST FACTOR (peak / rms > 4) — claps are impulses, speech isn't
//   3. Preceded by quiet frames (attack detection) so sustained loudness
//      like laughter or a shout doesn't count.
//
// And then 3 such events, each separated by a REQUIRED pause (silence
// frames between them) — not just 3 events in a window.
const CLAP_PEAK_THRESHOLD = 10000 // int16 — claps peak high; speech rarely exceeds ~10k
// Claps are instantaneous impulses — in a 32ms frame the impulse is averaged
// with surrounding silence. Real-world clap frame crest factor is ~2-3;
// setting this too high (I had 4.0) rejected all real claps from the test logs.
const CLAP_CREST_MIN = 2.2
const CLAP_ATTACK_QUIET_FRAMES = 2 // two preceding frames must be quiet
const CLAP_MIN_SILENCE_AFTER_FRAMES = 2 // 2 frames (~64ms) of quiet between claps
const CLAP_MIN_GAP_MS = 180 // refractory
// Widened significantly — real-world clap-clap-clap rhythm is 800-1400ms
// between beats, not the 900 I had. A 3-clap burst fits in ~4.5s.
const CLAP_MAX_GAP_MS = 1500
const CLAP_QUIET_RMS = 400 // what we consider "quiet"
const CLAPS_REQUIRED = 3

// Accept common mishearings. Whisper-tiny in particular likes to spell "ESI"
// as "SE", "Essie", "easy", etc., so we cast a wide net for the wake syllable.
const WAKE_PATTERNS: RegExp[] = [
  /\b(?:hey|yo|hi|ok|okay)\s+(?:esi|essie|easy|s\.?e\.?i\.?|eesee|ee\s*see|esy|esmay)\b/i,
  /\b(?:esi|essie|easy|s\.?e\.?i\.?|ee\s*see|esy)\b\s*[,.!?]/i,
  /^\s*(?:esi|essie|easy|s\.?e\.?i\.?|eesee|ee\s*see|esy)\b/i
]

let recorder: PvRecorder | null = null
let running = false
let muted = false
let onWake: (() => void) | null = null
let onLevel: ((rms0to1: number) => void) | null = null
let lastCheckAt = 0
let speechFrameCount = 0
let transcribeBuffer: Int16Array[] = []
let isMeetingActive: () => boolean = () => false

// Clap state
let lastClapAt = 0
let clapStreak: number[] = [] // timestamps of recent claps
let framesSinceClap = 0
let recentQuietFrames = 0 // rolling count of consecutive quiet frames

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

    // If the user is manually recording a command, the hotkey capture owns
    // the mic semantics — don't trip on their own speech.
    if (voiceInputCapturing()) continue
    // Muted or inside a meeting: discard audio entirely.
    if (muted || isMeetingActive()) {
      speechFrameCount = 0
      transcribeBuffer = []
      clapStreak = []
      continue
    }

    // Clap trigger — checked before speech so a sharp loud transient
    // doesn't get swallowed by the whisper path.
    if (detectClap(peak, level)) {
      fireWake('three-clap')
      continue
    }

    const speaking = level > SPEECH_RMS_THRESHOLD

    if (speaking) {
      speechFrameCount++
      transcribeBuffer.push(frame)
      const maxFrames = Math.ceil(FRAMES_PER_SEC * TRANSCRIBE_WINDOW_SEC)
      while (transcribeBuffer.length > maxFrames) transcribeBuffer.shift()

      if (speechFrameCount >= SPEECH_FRAMES_TO_TRIGGER) {
        const now = Date.now()
        if (now - lastCheckAt < CHECK_COOLDOWN_MS) continue
        lastCheckAt = now
        // Snapshot and kick off whisper check — don't block the pump.
        const snapshot = transcribeBuffer.slice()
        checkWake(snapshot).catch((err) =>
          console.warn('[esi] wakeVad transcribe failed:', err)
        )
        speechFrameCount = 0
      }
    } else {
      speechFrameCount = Math.max(0, speechFrameCount - 1)
      if (speechFrameCount === 0) transcribeBuffer = []
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
  if (clean.length < 2) return
  for (const p of WAKE_PATTERNS) {
    if (p.test(clean)) {
      fireWake(`phrase "${clean}"`)
      return
    }
  }
}

function fireWake(reason: string): void {
  console.log(`[esi] wakeVad triggered: ${reason}`)
  clapStreak = [] // reset after successful trigger
  const cb = onWake
  if (cb) {
    try {
      cb()
    } catch (err) {
      console.warn('[esi] wake callback threw:', err)
    }
  }
}

/**
 * Frame-level clap detector tuned to reject speech.
 *
 * A clap must:
 *  - Peak above {@link CLAP_PEAK_THRESHOLD}
 *  - Have a high crest factor (peak/rms) — an impulse, not sustained sound
 *  - Follow at least {@link CLAP_ATTACK_QUIET_FRAMES} quiet frames
 *    (sharp attack)
 *  - Be separated from the next clap by another quiet gap
 *
 * Three such events within {@link CLAP_MAX_GAP_MS} of each other → fire.
 */
function detectClap(peak: number, rmsLevel: number): boolean {
  // Track quiet frames for attack detection
  const isQuiet = rmsLevel < CLAP_QUIET_RMS
  if (isQuiet) {
    recentQuietFrames = Math.min(10, recentQuietFrames + 1)
    framesSinceClap++
    return false
  }

  // Peak must be large and the frame must be impulsive (high crest)
  const crest = rmsLevel > 0 ? peak / rmsLevel : 0
  if (peak < CLAP_PEAK_THRESHOLD || crest < CLAP_CREST_MIN) {
    if (peak > 6000) {
      // Loud enough to be interesting — log why we rejected it
      console.log(
        `[esi] wakeVad clap rejected (filter): peak=${peak} rms=${rmsLevel.toFixed(0)} crest=${crest.toFixed(2)} (need peak>=${CLAP_PEAK_THRESHOLD}, crest>=${CLAP_CREST_MIN})`
      )
    }
    recentQuietFrames = 0
    framesSinceClap++
    return false
  }

  // Attack: preceding frames must have been quiet (not mid-sentence)
  if (recentQuietFrames < CLAP_ATTACK_QUIET_FRAMES) {
    console.log(
      `[esi] wakeVad clap rejected (no attack): peak=${peak}, quietFramesBefore=${recentQuietFrames}/${CLAP_ATTACK_QUIET_FRAMES}`
    )
    recentQuietFrames = 0
    return false
  }

  // Inter-clap: require silence between claps (not continuous loud noise)
  if (
    clapStreak.length > 0 &&
    framesSinceClap < CLAP_MIN_SILENCE_AFTER_FRAMES
  ) {
    console.log(
      `[esi] wakeVad clap rejected (too-close): peak=${peak}, framesSince=${framesSinceClap}/${CLAP_MIN_SILENCE_AFTER_FRAMES}`
    )
    recentQuietFrames = 0
    return false
  }

  const now = Date.now()
  if (now - lastClapAt < CLAP_MIN_GAP_MS) {
    recentQuietFrames = 0
    return false
  }
  lastClapAt = now
  framesSinceClap = 0
  recentQuietFrames = 0

  // Drop claps outside the rhythm window (current clap + previous ones
  // each within CLAP_MAX_GAP_MS of the one after it).
  const cutoff = now - CLAP_MAX_GAP_MS
  clapStreak = clapStreak.filter((t) => t >= cutoff)
  clapStreak.push(now)

  console.log(
    `[esi] wakeVad clap accepted #${clapStreak.length}/${CLAPS_REQUIRED}: peak=${peak} rms=${rmsLevel.toFixed(0)} crest=${crest.toFixed(2)} (need ${CLAPS_REQUIRED} within ${CLAP_MAX_GAP_MS}ms each)`
  )

  if (clapStreak.length >= CLAPS_REQUIRED) {
    return true
  }
  return false
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
