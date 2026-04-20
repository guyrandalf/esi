import { LocalIndex } from 'vectra'
import { app } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434'
const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text'

let index: LocalIndex | null = null
let ready = false
let embeddingAvailable: boolean | null = null

async function checkEmbeddingAvailability(): Promise<boolean> {
  if (embeddingAvailable !== null) return embeddingAvailable
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/tags`, {
      signal: AbortSignal.timeout(2000)
    })
    if (!res.ok) {
      embeddingAvailable = false
      return false
    }
    const data = (await res.json()) as { models?: Array<{ name: string }> }
    embeddingAvailable = (data.models ?? []).some((m) =>
      m.name.startsWith(EMBED_MODEL)
    )
    return embeddingAvailable
  } catch {
    embeddingAvailable = false
    return false
  }
}

async function embed(text: string): Promise<number[] | null> {
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: EMBED_MODEL, prompt: text }),
      signal: AbortSignal.timeout(5000)
    })
    if (!res.ok) return null
    const data = (await res.json()) as { embedding?: number[] }
    return data.embedding ?? null
  } catch {
    return null
  }
}

export async function init(): Promise<void> {
  if (ready) return
  const ok = await checkEmbeddingAvailability()
  if (!ok) {
    console.warn(
      `[esi] semantic memory disabled — run: ollama pull ${EMBED_MODEL}`
    )
    return
  }

  const indexPath = join(app.getPath('userData'), 'esi-vectra')
  index = new LocalIndex(indexPath)
  if (!existsSync(indexPath)) {
    await index.createIndex()
  } else {
    try {
      await index.listItems()
    } catch {
      await index.createIndex()
    }
  }
  ready = true
}

export function isReady(): boolean {
  return ready
}

export async function remember(
  text: string,
  metadata: Record<string, string> = {}
): Promise<void> {
  if (!ready || !index) return
  const vec = await embed(text)
  if (!vec) return
  try {
    await index.insertItem({
      vector: vec,
      metadata: { text, ...metadata, createdAt: new Date().toISOString() }
    })
  } catch (err) {
    console.warn('[esi] semantic insert failed:', err)
  }
}

export async function recall(
  query: string,
  topK = 5
): Promise<Array<{ text: string; score: number }>> {
  if (!ready || !index) return []
  const vec = await embed(query)
  if (!vec) return []
  try {
    const results = await index.queryItems(vec, query, topK)
    return results.map((r) => ({
      text: String(r.item.metadata?.text ?? ''),
      score: r.score
    }))
  } catch {
    return []
  }
}
