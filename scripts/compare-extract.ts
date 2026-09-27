import {fetchPage} from '../lib/ingestion/fetch.ts'
import {extractReadableText} from '../lib/ingestion/extract.ts'
import {chunkText, estimateTokens} from '../lib/ingestion/chunk.ts'

for (const url of process.argv.slice(2)) {
  const page = await fetchPage(url)
  const ex = extractReadableText(page.html, page.url)
  const chunks = chunkText(ex.text, page.url, 0)
  console.log(
    `${new URL(url).hostname.padEnd(22)} ${String(page.bytes).padStart(7)}B html -> ` +
      `${String(ex.text.length).padStart(6)} chars (${ex.method}) -> ` +
      `${String(chunks.length).padStart(3)} chunks / ${estimateTokens(ex.text)} tokens`,
  )
  console.log(`   first: ${chunks[0]?.label ?? '(none)'}`)
  console.log(`   last : ${chunks.at(-1)?.label ?? '(none)'}`)
}
