/**
 * Does scoring substance discriminate where scoring relevance does not?
 * Re-fetches the real sources from both builds and runs both gates over them.
 */
import {fetchPage} from '../lib/ingestion/fetch.ts'
import {extractReadableText} from '../lib/ingestion/extract.ts'
import {chunkText} from '../lib/ingestion/chunk.ts'
import {config} from '../lib/config.ts'

const RELEVANT =
  'Given the Knowledge Base purpose, does this chunk contain information that should be ' +
  'retained for the Knowledge Base?'

const SUBSTANTIVE =
  'Does `candidate_text` carry specific, citable information — facts, figures, ' +
  'definitions, procedures, caveats, named entities? Answer no if it is mainly ' +
  'introductory framing, a table of contents, a transition, a restatement of something ' +
  'obvious, navigation, promotional language, or a call to action.'

type Answer = {noul: number}
async function jev(state: string, questions: Record<string, unknown>) {
  const res = await fetch(config.jev.baseUrl, {
    method: 'POST',
    headers: {Authorization: `Bearer ${config.jev.apiKey}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({model: config.jev.model, state, questions}),
  })
  if (!res.ok) throw new Error(`Jev ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return (await res.json()) as {answers: Record<string, Answer>; usage: {input_tokens: number}}
}

const BUILDS = [
  {
    name: 'Quantum Computers',
    purpose:
      'Answer questions about how quantum computers work, including qubits, superposition, entanglement, quantum gates and algorithms, hardware approaches, current capabilities, limitations, and applications.',
    urls: [
      'https://www.nist.gov/quantum-information-science/quantum-computing-explained',
      'https://www.ibm.com/think/topics/qubit',
      'https://azure.microsoft.com/en-us/resources/cloud-computing-dictionary/what-is-a-qubit',
    ],
  },
]

for (const build of BUILDS) {
  console.log(`\n=== ${build.name} ===`)
  const chunks = []
  for (const [i, url] of build.urls.entries()) {
    try {
      const page = await fetchPage(url)
      const ex = extractReadableText(page.html, page.url)
      chunks.push(...chunkText(ex.text, page.url, i))
    } catch (e) {
      console.log(`  (skipped ${new URL(url).hostname}: ${(e as Error).message.slice(0, 60)})`)
    }
  }
  if (chunks.length === 0) continue

  const state = `Knowledge base purpose: ${build.purpose}`
  const questions: Record<string, unknown> = {}
  for (const c of chunks) {
    questions[`rel_${c.id}`] = {
      type: 'noul',
      instructions: {candidate_text: c.text, question: RELEVANT},
    }
    questions[`sub_${c.id}`] = {
      type: 'noul',
      instructions: {candidate_text: c.text, question: SUBSTANTIVE},
    }
  }
  const res = await jev(state, questions)

  let oldKept = 0
  let newKept = 0
  let oldTok = 0
  let newTok = 0
  let total = 0
  console.log(`  ${'rel'.padEnd(5)} ${'sub'.padEnd(5)} old  new   chunk`)
  for (const c of chunks) {
    const rel = res.answers[`rel_${c.id}`]!.noul
    const sub = res.answers[`sub_${c.id}`]!.noul
    // Old gate: keep unless clearly irrelevant.
    const old = rel >= 0.2
    // New gate: must be relevant AND substantive.
    const neu = rel >= 0.6 && sub >= 0.5
    total += c.tokens
    if (old) {
      oldKept += 1
      oldTok += c.tokens
    }
    if (neu) {
      newKept += 1
      newTok += c.tokens
    }
    console.log(
      `  ${rel.toFixed(2)}  ${sub.toFixed(2)}  ${old ? 'keep' : 'DROP'} ${neu ? 'keep' : 'DROP'}  ${c.label.slice(0, 54)}`,
    )
  }
  const pct = (n: number) => `${Math.round((1 - n / total) * 100)}%`
  console.log(`\n  chunks: ${chunks.length} · old kept ${oldKept} · new kept ${newKept}`)
  console.log(`  tokens: ${total} · old withheld ${pct(oldTok)} · new withheld ${pct(newTok)}`)
  console.log(`  jev input tokens: ${res.usage.input_tokens}`)
}
