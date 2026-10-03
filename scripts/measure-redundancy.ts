/**
 * Three sources on one topic say the same things. Does asking Jev "is this
 * already covered?" find volume that relevance and substance scoring miss?
 *
 * Two passes: relevance+substance, then redundancy against what pass one kept.
 */
import {fetchPage} from '../lib/ingestion/fetch.ts'
import {extractReadableText} from '../lib/ingestion/extract.ts'
import {chunkText, type Chunk} from '../lib/ingestion/chunk.ts'
import {config} from '../lib/config.ts'

const RELEVANT =
  'Given the Knowledge Base purpose, does `candidate_text` contain information that ' +
  'should be retained for the Knowledge Base?'

const SUBSTANTIVE =
  'Does `candidate_text` carry specific, citable information — facts, figures, ' +
  'definitions, procedures, caveats, named entities? Answer no if it is mainly ' +
  'introductory framing, a table of contents, a transition, a restatement of something ' +
  'obvious, navigation, promotional language, or a call to action.'

const REDUNDANT =
  'Is the substance of `candidate_text` already covered by `already_kept`? Answer yes ' +
  'only if a reader of `already_kept` would learn nothing new from `candidate_text`. ' +
  'Answer no if it adds any specific fact, figure, caveat, example or distinction that ' +
  'is not already there.'

type Answer = {noul: number}
async function jev(state: unknown, questions: Record<string, unknown>) {
  const res = await fetch(config.jev.baseUrl, {
    method: 'POST',
    headers: {Authorization: `Bearer ${config.jev.apiKey}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({model: config.jev.model, state, questions}),
  })
  if (!res.ok) throw new Error(`Jev ${res.status}: ${(await res.text()).slice(0, 300)}`)
  return (await res.json()) as {answers: Record<string, Answer>; usage: {input_tokens: number}}
}

const PURPOSE =
  'Answer questions about how quantum computers work, including qubits, superposition, entanglement, quantum gates and algorithms, hardware approaches, current capabilities, limitations, and applications.'
const URLS = [
  'https://www.nist.gov/quantum-information-science/quantum-computing-explained',
  'https://www.ibm.com/think/topics/qubit',
  'https://en.wikipedia.org/wiki/Qubit',
]

const chunks: Chunk[] = []
for (const [i, url] of URLS.entries()) {
  try {
    const page = await fetchPage(url)
    const ex = extractReadableText(page.html, page.url)
    const got = chunkText(ex.text, page.url, i)
    chunks.push(...got)
    console.log(`  ${new URL(url).hostname.replace(/^www\./, '').padEnd(22)} ${got.length} chunks`)
  } catch (e) {
    console.log(`  (skipped ${new URL(url).hostname}: ${(e as Error).message.slice(0, 50)})`)
  }
}
const total = chunks.reduce((s, c) => s + c.tokens, 0)
console.log(`\n${chunks.length} chunks, ${total} tokens\n`)

// ---- Pass 1: relevance + substance ----
const q1: Record<string, unknown> = {}
for (const c of chunks) {
  q1[`rel_${c.id}`] = {type: 'noul', instructions: {candidate_text: c.text, question: RELEVANT}}
  q1[`sub_${c.id}`] = {type: 'noul', instructions: {candidate_text: c.text, question: SUBSTANTIVE}}
}
const r1 = await jev(`Knowledge base purpose: ${PURPOSE}`, q1)
const pass1 = chunks.filter(
  (c) => r1.answers[`rel_${c.id}`]!.noul >= 0.6 && r1.answers[`sub_${c.id}`]!.noul >= 0.5,
)
const pass1Tokens = pass1.reduce((s, c) => s + c.tokens, 0)

// ---- Pass 2: redundancy, each chunk against everything kept before it ----
// Judged in source order, so the first explanation of a concept survives and
// later restatements of it do not.
const kept: Chunk[] = []
const dropped: Chunk[] = []
let redundancyInputTokens = 0

for (const c of pass1) {
  if (kept.length === 0) {
    kept.push(c)
    continue
  }
  const context = kept.map((k) => k.text).join('\n\n').slice(-12000)
  const res = await jev(
    {already_kept: context},
    {verdict: {type: 'noul', instructions: {candidate_text: c.text, question: REDUNDANT}}},
  )
  redundancyInputTokens += res.usage.input_tokens
  const score = res.answers.verdict!.noul
  const host = new URL(c.sourceUrl).hostname.replace(/^www\./, '')
  console.log(`  ${score.toFixed(2)} ${score >= 0.7 ? 'REDUNDANT' : '         '}  ${host.padEnd(18)} ${c.label.slice(0, 50)}`)
  if (score >= 0.7) dropped.push(c)
  else kept.push(c)
}

const keptTokens = kept.reduce((s, c) => s + c.tokens, 0)
const pct = (n: number) => `${Math.round((1 - n / total) * 100)}%`
const cost = (t: number) => `$${((t / 1_000_000) * 0.042).toFixed(5)}`

console.log(`\n── results ──`)
console.log(`  all chunks                 ${chunks.length} · ${total} tokens`)
console.log(`  after relevance+substance  ${pass1.length} · ${pass1Tokens} tokens · withheld ${pct(pass1Tokens)}`)
console.log(`  after redundancy           ${kept.length} · ${keptTokens} tokens · withheld ${pct(keptTokens)}`)
console.log(`  redundancy dropped         ${dropped.length} chunks`)
console.log(`\n  jev cost: pass1 ${cost(r1.usage.input_tokens)} + pass2 ${cost(redundancyInputTokens)} = ${cost(r1.usage.input_tokens + redundancyInputTokens)}`)
