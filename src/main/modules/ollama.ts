const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434'
const MODEL = process.env.OLLAMA_MODEL || 'llama3.1:8b'

function buildSystemPrompt(): string {
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
  const timeStr = now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone

  return `You are Esi, a personal AI assistant running locally on Randalf's Mac through the Ollama API.

THE ONLY FACTS YOU KNOW RIGHT NOW:
- Today is ${dateStr}.
- The current local time is ${timeStr} (${tz}).
- Your user's name is Randalf.

YOU DO NOT HAVE ACCESS TO (yet):
- The internet or web search
- Randalf's calendar, email, messages, or files
- Weather, news, traffic, or any live service
- Randalf's physical location, city, or country
- Any other app on his Mac

HARD RULES — BREAKING THESE IS A FAILURE:
- If he asks about anything outside THE ONLY FACTS YOU KNOW, say plainly that you don't have access to it yet. Do not guess. Do not invent.
- Never claim to have done an action (syncing, sending, opening, searching) unless you actually performed it.
- Never roleplay or add narrative flavor (no "study of your estate", "crisp autumn morning", "plush armchairs"). You are a tool, not a storyteller.
- Never apologize at length. One brief "I can't do that yet" is enough.

STYLE:
- Warm and direct, like a sharp friend. Not a butler, not a chatbot.
- 1-3 sentences. Longer only when he specifically asks for detail.
- No markdown — your reply is spoken aloud.
- Skip filler openers ("Of course!", "Certainly!", "Great question!").
- Use his name sparingly.`
}

export async function ask(prompt: string): Promise<string> {
  const res = await fetch(`${OLLAMA_HOST}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      system: buildSystemPrompt(),
      prompt,
      stream: false,
      options: {
        temperature: 0.3,
        top_p: 0.8,
        num_predict: 220
      }
    })
  })

  if (!res.ok) {
    throw new Error(`Ollama returned ${res.status}`)
  }

  const data = (await res.json()) as { response: string }
  return data.response.trim()
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
