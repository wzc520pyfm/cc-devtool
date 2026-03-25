import { readFile } from 'fs/promises'

export async function readJsonlFile(filePath: string): Promise<unknown[]> {
  try {
    const content = await readFile(filePath, 'utf-8')
    const lines = content.trim().split('\n').filter(Boolean)
    const results: unknown[] = []
    for (const line of lines) {
      try {
        results.push(JSON.parse(line))
      } catch {
        // skip malformed lines
      }
    }
    return results
  } catch {
    return []
  }
}

export function extractUserQuery(text: string): string {
  const match = text.match(/<user_query>\s*([\s\S]*?)\s*<\/user_query>/)
  if (match) return match[1].trim()
  return text.slice(0, 200).trim()
}

let idCounter = 0
export function genId(): string {
  return `id_${Date.now()}_${++idCounter}`
}

export function safeTimestamp(val: unknown): string {
  if (typeof val === 'string') return val
  if (typeof val === 'number') return new Date(val).toISOString()
  return new Date().toISOString()
}
