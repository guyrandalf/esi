import { Porcupine, BuiltinKeyword } from '@picovoice/porcupine-node'
import { PvRecorder } from '@picovoice/pvrecorder-node'
import { existsSync } from 'fs'

let porcupine: Porcupine | null = null
let recorder: PvRecorder | null = null
let running = false
let listener: (() => void) | null = null

const BUILTIN_MAP: Record<string, BuiltinKeyword> = {
  americano: BuiltinKeyword.AMERICANO,
  blueberry: BuiltinKeyword.BLUEBERRY,
  bumblebee: BuiltinKeyword.BUMBLEBEE,
  computer: BuiltinKeyword.COMPUTER,
  grapefruit: BuiltinKeyword.GRAPEFRUIT,
  grasshopper: BuiltinKeyword.GRASSHOPPER,
  hey_google: BuiltinKeyword.HEY_GOOGLE,
  hey_siri: BuiltinKeyword.HEY_SIRI,
  jarvis: BuiltinKeyword.JARVIS,
  ok_google: BuiltinKeyword.OK_GOOGLE,
  picovoice: BuiltinKeyword.PICOVOICE,
  porcupine: BuiltinKeyword.PORCUPINE,
  terminator: BuiltinKeyword.TERMINATOR
}

export function isConfigured(): boolean {
  return !!process.env.PICOVOICE_ACCESS_KEY
}

/**
 * Start Porcupine listener. Defaults to JARVIS built-in keyword — closest
 * spirit to "Hey Esi". To use a custom wake word:
 *   1. Train one at console.picovoice.ai
 *   2. Drop the .ppn file somewhere
 *   3. Set PORCUPINE_KEYWORD_PATH in .env
 */
export function start(onWake: () => void): boolean {
  if (running) return true
  if (!isConfigured()) return false

  const accessKey = process.env.PICOVOICE_ACCESS_KEY!
  const customPath = process.env.PORCUPINE_KEYWORD_PATH

  try {
    if (customPath && existsSync(customPath)) {
      porcupine = new Porcupine(accessKey, [customPath], [0.5])
    } else {
      const keywordName = (process.env.PORCUPINE_KEYWORD || 'jarvis').toLowerCase()
      const builtin = BUILTIN_MAP[keywordName] ?? BuiltinKeyword.JARVIS
      porcupine = new Porcupine(accessKey, [builtin], [0.5])
    }
    recorder = new PvRecorder(porcupine.frameLength, -1)
    recorder.start()
    listener = onWake
    running = true
    runLoop().catch((err) => {
      console.warn('[esi] porcupine loop crashed:', err)
      stop()
    })
    return true
  } catch (err) {
    console.warn('[esi] porcupine start failed:', err)
    stop()
    return false
  }
}

async function runLoop(): Promise<void> {
  while (running && recorder && porcupine && listener) {
    try {
      const frame = await recorder.read()
      const detected = porcupine.process(frame)
      if (detected !== -1) {
        try {
          listener()
        } catch {
          /* noop */
        }
      }
    } catch {
      break
    }
  }
}

export function stop(): void {
  running = false
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
  try {
    porcupine?.release()
  } catch {
    /* noop */
  }
  recorder = null
  porcupine = null
  listener = null
}

export function isRunning(): boolean {
  return running
}
