import { PvRecorder } from '@picovoice/pvrecorder-node'
import { transcribe, isAvailable as whisperAvailable } from './whisper'

const FRAME_LENGTH = 512
const SAMPLE_RATE = 16000
const FRAMES_PER_SECOND = SAMPLE_RATE / FRAME_LENGTH // ~31.25

// VAD tuning
const SPEECH_RMS_THRESHOLD = 500 // int16 RMS — anything louder counts as speech
const SILENCE_SECONDS_TO_STOP = 1.2 // stop after this much silence *after* speech started
const MAX_SILENCE_BEFORE_SPEECH_SEC = 8 // if we never hear speech, bail after this long
const HARD_TIMEOUT_SEC = 30 // absolute cap

let recorder: PvRecorder | null = null
let capturing = false
let capturedFrames: Int16Array[] = []
let captureStartedAt = 0
let onAutoStop: (() => void) | null = null

function rms(frame: Int16Array): number {
  let sum = 0
  for (let i = 0; i < frame.length; i++) {
    const v = frame[i]
    sum += v * v
  }
  return Math.sqrt(sum / frame.length)
}

export function isAvailable(): boolean {
  return whisperAvailable()
}

export function isCapturing(): boolean {
  return capturing
}

/**
 * Start capturing microphone audio with VAD auto-stop.
 * Returns true if recording started. Silently no-ops when whisper is
 * unavailable or we're already recording.
 *
 * @param autoStop optional callback fired when VAD decides to stop the
 *   stream (silence after speech, or hard timeout). The caller is
 *   responsible for then calling `stop()` and doing something with the
 *   transcript.
 */
export async function start(autoStop?: () => void): Promise<boolean> {
  if (capturing) return false
  if (!whisperAvailable()) {
    console.warn('[esi] voice input skipped — whisper not available')
    return false
  }
  try {
    recorder = new PvRecorder(FRAME_LENGTH, -1)
    recorder.start()
    capturedFrames = []
    captureStartedAt = Date.now()
    capturing = true
    onAutoStop = autoStop ?? null
    // Fire-and-forget read loop
    pump().catch((err) => {
      console.warn('[esi] voice input loop failed:', err)
      forceStop()
    })
    return true
  } catch (err) {
    console.warn('[esi] voice input start failed:', err)
    forceStop()
    return false
  }
}

async function pump(): Promise<void> {
  let heardSpeech = false
  let silentFramesAfterSpeech = 0
  let silentFramesBeforeSpeech = 0
  const silenceFramesToStop = Math.ceil(FRAMES_PER_SECOND * SILENCE_SECONDS_TO_STOP)
  const silenceCapBeforeSpeech = Math.ceil(
    FRAMES_PER_SECOND * MAX_SILENCE_BEFORE_SPEECH_SEC
  )

  while (capturing && recorder) {
    let frame: Int16Array
    try {
      frame = await recorder.read()
    } catch {
      break
    }
    capturedFrames.push(frame)

    const level = rms(frame)
    const speaking = level > SPEECH_RMS_THRESHOLD

    if (speaking) {
      heardSpeech = true
      silentFramesAfterSpeech = 0
      silentFramesBeforeSpeech = 0
    } else if (heardSpeech) {
      silentFramesAfterSpeech++
      if (silentFramesAfterSpeech >= silenceFramesToStop) {
        triggerAutoStop('silence-after-speech')
        return
      }
    } else {
      silentFramesBeforeSpeech++
      if (silentFramesBeforeSpeech >= silenceCapBeforeSpeech) {
        triggerAutoStop('no-speech-detected')
        return
      }
    }

    // Hard cap regardless of what VAD says
    if (Date.now() - captureStartedAt > HARD_TIMEOUT_SEC * 1000) {
      triggerAutoStop('hard-timeout')
      return
    }
  }
}

function triggerAutoStop(reason: string): void {
  if (!capturing) return
  const cb = onAutoStop
  onAutoStop = null
  // Don't force-stop the recorder here — just let the caller's `stop()`
  // flush + transcribe. We flag capturing=false so no more frames queue up.
  capturing = false
  console.log(`[esi] voice auto-stop: ${reason}`)
  if (cb) {
    // Defer so the caller can await stop() cleanly on the next tick
    setImmediate(() => {
      try {
        cb()
      } catch (err) {
        console.warn('[esi] auto-stop callback threw:', err)
      }
    })
  }
}

/**
 * Stop and transcribe. Returns null if nothing useful was captured.
 */
export async function stop(): Promise<string | null> {
  if (!capturing || !recorder) return null
  const duration = Date.now() - captureStartedAt
  capturing = false
  try {
    recorder.stop()
  } catch {
    /* noop */
  }
  const frames = capturedFrames
  capturedFrames = []
  const rec = recorder
  recorder = null
  try {
    rec.release()
  } catch {
    /* noop */
  }

  if (duration < 500 || frames.length === 0) return null

  // Concatenate Int16Arrays into a single Buffer
  const totalSamples = frames.reduce((a, f) => a + f.length, 0)
  const merged = new Int16Array(totalSamples)
  let offset = 0
  for (const f of frames) {
    merged.set(f, offset)
    offset += f.length
  }
  const pcmBuffer = Buffer.from(merged.buffer)

  try {
    const text = await transcribe(pcmBuffer, { raw: true, sampleRate: SAMPLE_RATE })
    return text?.trim() || null
  } catch (err) {
    console.warn('[esi] transcription failed:', err)
    return null
  }
}

function forceStop(): void {
  capturing = false
  try {
    recorder?.stop()
  } catch {
    /* noop */
  }
  try {
    recorder?.release()
  } catch {
    /* noop */
  }
  recorder = null
  capturedFrames = []
}
