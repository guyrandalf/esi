import { spawn } from 'child_process'
import { existsSync, writeFileSync, unlinkSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { execSync } from 'child_process'

const MODEL_NAME = process.env.WHISPER_MODEL || 'base.en'

let binaryPath: string | null | undefined = undefined

function detectBinary(): string | null {
  if (binaryPath !== undefined) return binaryPath
  for (const candidate of ['whisper-cli', 'whisper-cpp', 'whisper', 'main']) {
    try {
      const found = execSync(`which ${candidate}`, { encoding: 'utf-8' }).trim()
      if (found) {
        binaryPath = found
        return found
      }
    } catch {
      /* next */
    }
  }
  binaryPath = null
  return null
}

export function isAvailable(): boolean {
  return detectBinary() !== null && !!guessModelPath()
}

function guessModelPath(): string | null {
  const candidates = [
    `/opt/homebrew/share/whisper-cpp/ggml-${MODEL_NAME}.bin`,
    `/usr/local/share/whisper-cpp/ggml-${MODEL_NAME}.bin`,
    join(process.env.HOME || '', 'whisper.cpp', 'models', `ggml-${MODEL_NAME}.bin`)
  ]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  return null
}

/**
 * Wrap 16-bit PCM buffer in a WAV container so whisper-cpp accepts it.
 */
export function pcmToWav(
  pcm: Buffer,
  sampleRate = 16000,
  channels = 1,
  bitsPerSample = 16
): Buffer {
  const byteRate = (sampleRate * channels * bitsPerSample) / 8
  const blockAlign = (channels * bitsPerSample) / 8
  const dataSize = pcm.length
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + dataSize, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20) // PCM
  header.writeUInt16LE(channels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(bitsPerSample, 34)
  header.write('data', 36)
  header.writeUInt32LE(dataSize, 40)
  return Buffer.concat([header, pcm])
}

/**
 * Transcribe audio. Accepts either a prepared WAV buffer (default) or raw PCM
 * (when `raw: true`). When raw, the caller specifies the sample rate.
 */
export async function transcribe(
  audio: Buffer,
  options: { raw?: boolean; sampleRate?: number; channels?: number } = {}
): Promise<string> {
  const bin = detectBinary()
  if (!bin) {
    throw new Error('whisper-cli not installed. Try: brew install whisper-cpp')
  }
  const model = guessModelPath()
  if (!model) {
    throw new Error(
      `Whisper model "${MODEL_NAME}" not found. Download ggml-${MODEL_NAME}.bin into /opt/homebrew/share/whisper-cpp/`
    )
  }

  const wav = options.raw
    ? pcmToWav(audio, options.sampleRate ?? 16000, options.channels ?? 1, 16)
    : audio
  const tmpWav = join(tmpdir(), `esi-${Date.now()}.wav`)
  writeFileSync(tmpWav, wav)

  try {
    const text = await new Promise<string>((resolve, reject) => {
      // whisper-cli flags: -m model, -f file, -nt (no timestamps), -otxt disables
      // but we only want the stdout text.
      const proc = spawn(bin, ['-m', model, '-f', tmpWav, '-nt', '-np'], {
        stdio: ['ignore', 'pipe', 'pipe']
      })
      let out = ''
      let err = ''
      proc.stdout.on('data', (d) => {
        out += d.toString()
      })
      proc.stderr.on('data', (d) => {
        err += d.toString()
      })
      proc.on('error', reject)
      proc.on('close', (code) => {
        if (code === 0) resolve(out.trim())
        else reject(new Error(`whisper exited ${code}: ${err.slice(0, 400)}`))
      })
    })
    return text
  } finally {
    try {
      unlinkSync(tmpWav)
    } catch {
      /* noop */
    }
  }
}
