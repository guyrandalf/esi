import * as memory from './memory'
import * as gemini from './gemini'

export function looksLikeRememberCommand(text: string): boolean {
  return /^\s*(esi,?\s+)?remember\s+(that\s+)?/i.test(text)
}

interface Parsed {
  kind: 'person' | 'project' | 'preference' | 'fact'
  key: string
  value: string
}

/**
 * Quick heuristic parser. Returns null if too ambiguous —
 * the caller can optionally fall back to Gemini classification.
 */
export function heuristicParse(text: string): Parsed | null {
  const body = text
    .replace(/^\s*(esi,?\s+)?remember\s+(that\s+)?/i, '')
    .trim()
    .replace(/^my\s+/i, '')
    .replace(/\.$/, '')

  // Pattern: "<Name> is <context>" / "<Name> — <context>"
  const personMatch = body.match(
    /^([A-Z][\w'-]+(?:\s+[A-Z][\w'-]+)?)\s+(is|was|works|manages|leads|handles|—|-)\s+(.+)$/
  )
  if (personMatch) {
    const [, name, verb, rest] = personMatch
    // Skip if "name" is something mundane like "my standup is 9am"
    if (!/^(my|the|a|an)\b/i.test(name)) {
      return {
        kind: 'person',
        key: name.trim(),
        value: `${verb === '—' || verb === '-' ? '' : verb + ' '}${rest}`.trim()
      }
    }
  }

  // Pattern: "X project is at <path>"
  const projectMatch = body.match(
    /(?:the\s+)?(\w[\w-]+)\s+project(?:\s+is|\s+lives)?\s+(?:at|in)\s+(.+)$/i
  )
  if (projectMatch) {
    return {
      kind: 'project',
      key: projectMatch[1],
      value: projectMatch[2].trim()
    }
  }

  // Preference patterns
  const prefMatch = body.match(
    /^(standup|morning routine|bedtime|working hours|preferred (?:voice|model|editor))\s+(.+)$/i
  )
  if (prefMatch) {
    return {
      kind: 'preference',
      key: prefMatch[1].toLowerCase().replace(/\s+/g, '_'),
      value: prefMatch[2].trim()
    }
  }

  if (body.length > 0 && body.length < 400) {
    return { kind: 'fact', key: 'note', value: body }
  }
  return null
}

async function classifyWithGemini(text: string): Promise<Parsed | null> {
  if (!gemini.isConfigured()) return null
  try {
    const raw = await gemini.reason(
      `Classify this memory request and return JSON only: {"kind":"person|project|preference|fact","key":"short slug","value":"what to remember"}.
Never include any commentary. Input: ${text}`,
      'You are a JSON-only classifier. Output exactly one JSON object and nothing else.'
    )
    const jsonMatch = raw.match(/\{[^{}]+\}/)
    if (!jsonMatch) return null
    const parsed = JSON.parse(jsonMatch[0]) as Parsed
    if (!parsed.kind || !parsed.value) return null
    return parsed
  } catch {
    return null
  }
}

export async function handleRemember(command: string): Promise<string> {
  const heuristic = heuristicParse(command)
  const parsed = heuristic ?? (await classifyWithGemini(command))
  if (!parsed) {
    return "I couldn't figure out what to store. Try: \"Remember that John is my tech lead at Atulo\"."
  }

  switch (parsed.kind) {
    case 'person': {
      memory.upsertPerson(parsed.key, parsed.value)
      return `Got it — I'll remember ${parsed.key}: ${parsed.value}.`
    }
    case 'project': {
      memory.upsertProject(parsed.key, { path: parsed.value })
      return `Stored the ${parsed.key} project at ${parsed.value}.`
    }
    case 'preference': {
      memory.setPreference(parsed.key, parsed.value)
      return `Noted your preference for ${parsed.key.replace(/_/g, ' ')}.`
    }
    case 'fact': {
      const existing = memory.getPreference('notes')
      const next = existing ? `${existing}\n- ${parsed.value}` : `- ${parsed.value}`
      memory.setPreference('notes', next)
      return `Saved that note.`
    }
  }
}
