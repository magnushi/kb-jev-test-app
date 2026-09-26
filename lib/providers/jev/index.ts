import {config} from '../../config.ts'
import type {RelevanceGate, RelevanceDecision, Usage} from '../../agents/interfaces.ts'

type NoulAnswer = {type: 'noul'; noul: number}
type JevResponse = {
  model: string
  answers: Record<string, NoulAnswer>
  usage: {input_tokens: number; output_tokens: number}
}

const QUESTION =
  'Does `candidate_text` contain information worth retaining for this knowledge base? ' +
  'Answer yes for substantive facts, definitions, procedures, caveats and terminology. ' +
  'Answer no for navigation, boilerplate, cookie notices, newsletter prompts, ' +
  'legal footers and marketing filler.'

function classify(score: number): RelevanceDecision['decision'] {
  if (score >= config.relevance.keepAbove) return 'keep'
  if (score < config.relevance.dropBelow) return 'drop'
  return 'uncertain'
}

async function callJev(body: unknown, attempt = 0): Promise<JevResponse> {
  const res = await fetch(config.jev.baseUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.jev.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (res.status === 429 || res.status === 529) {
    if (attempt >= 4) throw new Error(`Jev overloaded after ${attempt} retries (${res.status})`)
    await new Promise((r) => setTimeout(r, 2 ** attempt * 500))
    return callJev(body, attempt + 1)
  }
  if (!res.ok) throw new Error(`Jev ${res.status}: ${(await res.text()).slice(0, 300)}`)
  return (await res.json()) as JevResponse
}

/**
 * Jev processes `state` once and evaluates every question against it in parallel,
 * so one request carries the purpose plus many chunks. See docs/integration-notes.md §1.
 */
export const jevRelevanceGate: RelevanceGate = {
  async evaluate({purpose, topic, chunks}) {
    const started = Date.now()
    const decisions: Record<string, RelevanceDecision> = {}
    const usage: Usage = {inputTokens: 0, outputTokens: 0}

    const size = config.budgets.maxChunksPerJevCall
    for (let i = 0; i < chunks.length; i += size) {
      const batch = chunks.slice(i, i + size)
      const questions = Object.fromEntries(
        batch.map((c) => [
          `keep_${c.id}`,
          {type: 'noul', instructions: {candidate_text: c.text, question: QUESTION}},
        ]),
      )
      const res = await callJev({
        model: config.jev.model,
        state: `Knowledge base purpose: ${purpose}\nTopic: ${topic}`,
        questions,
      })
      for (const c of batch) {
        const answer = res.answers[`keep_${c.id}`]
        if (!answer) throw new Error(`Jev returned no answer for chunk ${c.id}`)
        decisions[c.id] = {score: answer.noul, decision: classify(answer.noul)}
      }
      usage.inputTokens += res.usage.input_tokens
      usage.outputTokens += res.usage.output_tokens
    }

    // Input-only pricing: $0.042 per million tokens, output free.
    usage.costUsd = (usage.inputTokens / 1_000_000) * 0.042
    return {decisions, usage, latencyMs: Date.now() - started}
  },
}
