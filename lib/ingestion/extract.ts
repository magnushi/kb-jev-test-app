import {decodeEntities} from './fetch.ts'

const STRIP_BLOCKS = /<(script|style|noscript|svg|nav|header|footer|aside|form)\b[^>]*>[\s\S]*?<\/\1>/gi
const BLOCK_BOUNDARY = /<\/(p|div|section|article|li|h[1-6]|tr|blockquote|pre)\s*>/gi

/**
 * Main-content extraction without a native dependency: strip chrome, prefer <main>
 * or <article> when present, then flatten to text with block boundaries preserved.
 */
export function extractReadableText(html: string): string {
  let working = html.replace(STRIP_BLOCKS, ' ')

  const main =
    /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(working)?.[1] ??
    /<article\b[^>]*>([\s\S]*?)<\/article>/i.exec(working)?.[1]
  if (main && main.length > 500) working = main

  return decodeEntities(
    working
      .replace(BLOCK_BOUNDARY, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t ]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n')
    .trim()
}
