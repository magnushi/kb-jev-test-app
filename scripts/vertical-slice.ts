/**
 * Phase 1 vertical slice (spec §12).
 *
 *   URL -> fetch -> extract -> chunk -> Jev filter -> synthesis
 *       -> create Sanity Knowledge Base -> import Markdown -> build
 *
 * Usage:  npm run slice -- <url> ["purpose"] [--keep]
 * Without --keep the knowledge base is deleted at the end.
 */
import {fetchPage} from '../lib/ingestion/fetch.ts'
import {extractReadableText} from '../lib/ingestion/extract.ts'
import {chunkText, estimateTokens, type Chunk} from '../lib/ingestion/chunk.ts'
import {jevRelevanceGate} from '../lib/providers/jev/index.ts'
import {synthesize} from '../lib/ingestion/synthesize.ts'
import {sanityKnowledgeBaseProvider as kbProvider} from '../lib/providers/sanity/knowledge-base.ts'

const args = process.argv.slice(2)
const keep = args.includes('--keep')
const positional = args.filter((a) => !a.startsWith('--'))
const purposeFlag = args.find((a) => a.startsWith('--purpose='))?.slice('--purpose='.length)
const urls = positional.length > 0 ? positional : ['https://www.sanity.io/docs/ai/sanity-context-mcp']
const purpose =
  purposeFlag ??
  'Help an agent answer questions about Sanity Context MCP: how to connect to it, what tools it exposes, and how authentication works.'

const step = (n: number, label: string) => console.log(`\n[${n}] ${label}`)
const usd = (n: number | undefined) => (n === undefined ? 'n/a' : `$${n.toFixed(5)}`)

async function main() {
  const started = Date.now()
  console.log(`Knowledge Base Lab — vertical slice`)
  console.log(`Purpose: ${purpose}`)

  step(1, `Fetch ${urls.length} source${urls.length === 1 ? '' : 's'}`)
  const sources: {url: string; title: string}[] = []
  const chunks: Chunk[] = []
  for (const [index, raw] of urls.entries()) {
    const page = await fetchPage(raw)
    const extraction = extractReadableText(page.html, page.url)
    const pageChunks = chunkText(extraction.text, page.url, index)
    chunks.push(...pageChunks)
    sources.push({url: page.url, title: page.title})
    console.log(
      `    ${new URL(page.url).hostname.padEnd(24)} ${extraction.method.padEnd(11)} ` +
        `${pageChunks.length} chunks · ~${pageChunks.reduce((s, c) => s + c.tokens, 0).toLocaleString()} tokens`,
    )
  }
  const candidateTokens = chunks.reduce((sum, c) => sum + c.tokens, 0)
  const page = {title: sources[0]?.title ?? 'Knowledge base', url: sources[0]?.url ?? urls[0]!}
  console.log(`    total: ${chunks.length} chunks, ~${candidateTokens.toLocaleString()} candidate tokens`)

  step(2, 'Skipped (merged into fetch)')

  step(3, 'Jev relevance gate')
  const gate = await jevRelevanceGate.evaluate({
    purpose,
    topic: page.title,
    chunks: chunks.map((c) => ({id: c.id, text: c.text})),
  })
  const kept = chunks.filter((c) => {
    const d = gate.decisions[c.id]
    return d?.decision === 'keep' || d?.decision === 'uncertain'
  })
  const retainedTokens = kept.reduce((sum, c) => sum + c.tokens, 0)
  const dropped = chunks.length - kept.length
  console.log(
    `    ${gate.latencyMs}ms · kept ${kept.length} · dropped ${dropped} · ` +
      `${usd(gate.usage.costUsd)} · ${gate.usage.inputTokens} input tokens`,
  )
  for (const c of chunks) {
    const d = gate.decisions[c.id]!
    const host = new URL(c.sourceUrl).hostname.replace(/^www\./, '')
    console.log(`      ${d.score.toFixed(2)} ${d.decision.toUpperCase().padEnd(9)} ${host.padEnd(22)} ${c.label}`)
  }

  const reduction = candidateTokens > 0 ? 1 - retainedTokens / candidateTokens : 0
  console.log(`    Jev kept ${retainedTokens.toLocaleString()} of ${candidateTokens.toLocaleString()} tokens (${(reduction * 100).toFixed(0)}% not sent to synthesis)`)

  if (kept.length === 0) throw new Error('Jev dropped every chunk; nothing to synthesize')

  step(4, 'Synthesis (Opus 5.5)')
  const {markdown, usage} = await synthesize({
    title: page.title,
    purpose,
    retained: kept,
    sources,
  })
  console.log(`    ${estimateTokens(markdown).toLocaleString()} tokens of Markdown · ${usd(usage.costUsd)}`)
  console.log(`    ${markdown.split('\n').filter((l) => l.startsWith('## ')).length} sections`)

  step(5, 'Create Sanity Knowledge Base')
  const {id} = await kbProvider.create({title: page.title, purpose})
  console.log(`    ${id}`)

  try {
    step(6, 'Import Markdown')
    const imported = await kbProvider.importMarkdown({
      knowledgeBaseId: id,
      title: page.title,
      markdown,
    })
    console.log(`    job ${imported.jobId}`)

    step(7, 'Build')
    const build = await kbProvider.build({knowledgeBaseId: id})
    console.log(`    job ${build.jobId}`)

    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 15_000))
      const status = await kbProvider.status({knowledgeBaseId: id})
      console.log(`    t+${(i + 1) * 15}s  state=${status.state} building=${status.isBuilding} stage=${status.stage ?? '-'}`)
      if (!status.isBuilding && status.state !== 'building') break
    }

    const final = await kbProvider.status({knowledgeBaseId: id})
    console.log(`\n=== FUNNEL ===`)
    console.log(`${candidateTokens.toLocaleString()} candidate -> ${retainedTokens.toLocaleString()} kept by Jev -> ${estimateTokens(markdown).toLocaleString()} synthesized -> ${id}`)
    console.log(`Jev ${usd(gate.usage.costUsd)} + synthesis ${usd(usage.costUsd)} = ${usd((gate.usage.costUsd ?? 0) + (usage.costUsd ?? 0))}`)
    console.log(`state=${final.state} issues=${final.openIssueCount ?? 0} elapsed=${((Date.now() - started) / 1000).toFixed(0)}s`)
    if (keep) console.log(`\nKept. Query it with knowledgeBases=${id}`)
  } finally {
    if (!keep) {
      await kbProvider.delete({knowledgeBaseId: id})
      console.log(`\nCleaned up ${id}`)
    }
  }
}

main().catch((error) => {
  console.error('\nFAILED:', error instanceof Error ? error.message : error)
  process.exit(1)
})
