import { GoogleGenerativeAI } from '@google/generative-ai'

const MODEL_ID = 'gemini-2.0-flash'

function getClient(): GoogleGenerativeAI | null {
  const key = process.env.GEMINI_API_KEY
  if (!key) return null
  return new GoogleGenerativeAI(key)
}

export function isConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY
}

export async function reason(
  prompt: string,
  systemPrompt: string
): Promise<string> {
  const client = getClient()
  if (!client) throw new Error('GEMINI_API_KEY not set')
  const model = client.getGenerativeModel({
    model: MODEL_ID,
    systemInstruction: systemPrompt
  })
  const result = await model.generateContent(prompt)
  return result.response.text().trim()
}

export async function visionQuery(
  screenshotBase64: string,
  question: string,
  systemPrompt?: string
): Promise<string> {
  const client = getClient()
  if (!client) throw new Error('GEMINI_API_KEY not set')
  const model = client.getGenerativeModel({
    model: MODEL_ID,
    ...(systemPrompt ? { systemInstruction: systemPrompt } : {})
  })
  const result = await model.generateContent([
    {
      inlineData: {
        mimeType: 'image/png',
        data: screenshotBase64
      }
    },
    question
  ])
  return result.response.text().trim()
}
