import { buildSystemPrompt } from './prompt'

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434'
const MODEL = process.env.OLLAMA_MODEL || 'llama3.1:8b'

export async function askWithSystem(
  prompt: string,
  system: string
): Promise<string> {
  const res = await fetch(`${OLLAMA_HOST}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      system,
      prompt,
      stream: false,
      options: { temperature: 0.3, top_p: 0.8, num_predict: 260 }
    })
  })
  if (!res.ok) throw new Error(`Ollama returned ${res.status}`)
  const data = (await res.json()) as { response: string }
  return data.response.trim()
}

export async function ask(prompt: string): Promise<string> {
  return askWithSystem(prompt, buildSystemPrompt())
}

export async function isAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/tags`, {
      signal: AbortSignal.timeout(2000)
    })
    return res.ok
  } catch {
    return false
  }
}

export async function hasModel(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/tags`, {
      signal: AbortSignal.timeout(2000)
    })
    if (!res.ok) return false
    const data = (await res.json()) as { models?: Array<{ name: string }> }
    return (data.models ?? []).some((m) =>
      m.name.startsWith(MODEL.split(':')[0])
    )
  } catch {
    return false
  }
}
