export interface ParsedAction {
  type: string
  params: string
  rawLine: string
}

const ACTION_RX = /\[ACTION:([A-Z_]+):([^\]]*)\]/

export function parseAction(text: string): ParsedAction | null {
  const m = text.match(ACTION_RX)
  if (!m) return null
  return { type: m[1], params: m[2].trim(), rawLine: m[0] }
}

/** Strip the action tag so the text is clean for speaking + display. */
export function stripAction(text: string): string {
  return text.replace(ACTION_RX, '').replace(/\s+\n/g, '\n').trim()
}
