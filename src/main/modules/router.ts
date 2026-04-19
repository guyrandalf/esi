import * as ollama from './ollama'
import * as gemini from './gemini'

export type Route = 'ollama' | 'gemini' | 'vision'

const SIMPLE_PATTERNS: RegExp[] = [
  /^open \w+/i,
  /^play /i,
  /^switch to/i,
  /^what('s|s| is) the time/i,
  /^what('s|s| is) today/i,
  /^what day is it/i,
  /^set (a )?timer/i,
  /^close \w+/i,
  /^what('s|s| is)? on my (plate|calendar)/i,
  /^what('s|s| is) next/i,
  /^what am i (doing|working on)/i,
  /^do i have/i
]

const COMPLEX_CUES = [
  'summarize',
  'summary',
  'draft',
  'write a',
  'compose',
  'explain',
  'analyze',
  'compare',
  'plan',
  'outline',
  'review',
  'rewrite'
]

const VISION_CUES = [
  'on my screen',
  'on the screen',
  'see this',
  'what do you see',
  "what's on my",
  'look at my screen',
  'read my screen'
]

export function chooseRoute(command: string): Route {
  const lower = command.toLowerCase()
  if (VISION_CUES.some((c) => lower.includes(c))) return 'vision'
  if (!gemini.isConfigured()) return 'ollama'
  if (COMPLEX_CUES.some((c) => lower.includes(c))) return 'gemini'
  if (SIMPLE_PATTERNS.some((p) => p.test(lower))) return 'ollama'
  // Longer / more nuanced → Gemini if available
  if (command.length > 160) return 'gemini'
  return 'ollama'
}

export async function route(
  command: string,
  systemPrompt: string
): Promise<{ route: Route; response: string }> {
  const chosen = chooseRoute(command)
  if (chosen === 'gemini' && gemini.isConfigured()) {
    try {
      const response = await gemini.reason(command, systemPrompt)
      return { route: 'gemini', response }
    } catch (err) {
      // If Gemini fails (quota, offline, etc) fall back to Ollama
      console.warn('[esi] gemini failed, falling back to ollama:', err)
    }
  }
  const response = await ollama.askWithSystem(command, systemPrompt)
  return { route: 'ollama', response }
}
