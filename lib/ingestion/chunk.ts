/** ~4 characters per token. Good enough for budgeting; never shown as a measured figure. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

export type Chunk = {id: string; text: string; tokens: number; sourceUrl: string; label: string}

/**
 * Paragraph-aware chunking into bounded windows. Paragraph boundaries are kept so a
 * chunk reads as a coherent unit — Jev judges it in isolation.
 */
export function chunkText(
  text: string,
  sourceUrl: string,
  sourceIndex: number,
  {targetTokens = 400, maxTokens = 700} = {},
): Chunk[] {
  const paragraphs = text.split('\n').filter((p) => p.trim().length > 0)
  const chunks: Chunk[] = []
  let buffer: string[] = []
  let bufferTokens = 0

  const flush = () => {
    if (buffer.length === 0) return
    const body = buffer.join('\n')
    chunks.push({
      id: `s${sourceIndex}c${chunks.length}`,
      text: body,
      tokens: estimateTokens(body),
      sourceUrl,
      label: labelFor(body),
    })
    buffer = []
    bufferTokens = 0
  }

  for (const paragraph of paragraphs) {
    const tokens = estimateTokens(paragraph)
    if (tokens > maxTokens) {
      flush()
      for (let i = 0; i < paragraph.length; i += maxTokens * 4) {
        const slice = paragraph.slice(i, i + maxTokens * 4)
        chunks.push({
          id: `s${sourceIndex}c${chunks.length}`,
          text: slice,
          tokens: estimateTokens(slice),
          sourceUrl,
          label: labelFor(slice),
        })
      }
      continue
    }
    if (bufferTokens + tokens > targetTokens) flush()
    buffer.push(paragraph)
    bufferTokens += tokens
  }
  flush()
  return chunks
}

/** Short human label for the knowledge map tooltip (design brief §6.1). */
function labelFor(text: string): string {
  const firstLine = text.split('\n')[0] ?? text
  const words = firstLine.split(/\s+/).slice(0, 8).join(' ')
  return words.length > 72 ? `${words.slice(0, 69)}…` : words
}
