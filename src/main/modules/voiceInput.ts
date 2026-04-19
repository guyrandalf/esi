import { PvRecorder } from '@picovoice/pvrecorder-node'
import { transcribe, isAvailable as whisperAvailable } from './whisper'

const FRAME_LENGTH = 512
const SAMPLE_RATE = 16000

let recorder: PvRecorder | null = null
let capturing = false
let capturedFrames: Int16Array[] = []
let captureStartedAt = 0

export function isAvailable(): boolean {
  return whisperAvailable()
}

export function isCapturing(): boolean {
  return capturing
}

/**
 * Start capturing microphone audio. Returns true if recording started.
 * Silently no-ops when whisper is unavailable or we're already recording.
 */
export async function start(): Promise<boolean> {
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
  while (capturing && recorder) {
    try {
      const frame = await recorder.read()
      capturedFrames.push(frame)
    } catch {
      break
    }
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
