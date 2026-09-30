import {config} from '../../config.ts'
import type {
  Candidate,
  CandidateRanker,
  RelevanceDecision,
  RelevanceGate,
  Usage,
} from '../../agents/interfaces.ts'

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

const CANDIDATE_QUESTION =
  'Is `candidate` likely to be a substantial, authoritative source of material for this ' +
  'knowledge base? Judge from its domain and page title. Answer yes for primary ' +
  'documentation, specifications, reference material and thorough explanations. Answer no ' +
  'for marketing pages, listicles, link directories, forum threads and pages only ' +
  'tangentially related to the topic.'

/**
 * Picks which sources to ingest, before anything is fetched. One request, one
 * Noul per candidate, typically under half a second for a fraction of a cent.
 */
export const jevCandidateRanker: CandidateRanker = {
  async rank({purpose, topic, candidates}) {
    const started = Date.now()
    if (candidates.length === 0) {
      return {ranked: [], usage: {inputTokens: 0, outputTokens: 0, costUsd: 0}, latencyMs: 0}
    }

    const keyFor = (index: number) => `cand_${index}`
    const questions = Object.fromEntries(
      candidates.map((candidate, index) => [
        keyFor(index),
        {
          type: 'noul',
          instructions: {
            candidate: {
              url: candidate.url,
              domain: safeHost(candidate.url),
              title: candidate.title ?? null,
            },
            question: CANDIDATE_QUESTION,
          },
        },
      ]),
    )

    const res = await callJev({
      model: config.jev.model,
      state: `Knowledge base purpose: ${purpose}\nTopic: ${topic}`,
      questions,
    })

    const ranked = candidates
      .map((candidate, index) => ({
        ...candidate,
        score: res.answers[keyFor(index)]?.noul ?? 0,
      }))
      .sort((a, b) => b.score - a.score)

    return {
      ranked,
      usage: {
        inputTokens: res.usage.input_tokens,
        outputTokens: res.usage.output_tokens,
        costUsd: (res.usage.input_tokens / 1_000_000) * 0.042,
      },
      latencyMs: Date.now() - started,
    }
  },
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

export type {Candidate}
