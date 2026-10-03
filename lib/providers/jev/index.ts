import {config} from '../../config.ts'
import type {
  Candidate,
  CandidateRanker,
  Conflict,
  ConflictArbiter,
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

/**
 * Two questions per chunk, not one. Asking only "is this relevant?" of a chunk from a
 * page about the topic gets a correct yes every time — measured at 0% withheld on two
 * real builds. Substance is what discriminates: an introductory paragraph is highly
 * relevant and carries nothing.
 *
 * Both ride in the same request, so the second question is free: Jev evaluates every
 * question against `state` in parallel.
 */
const RELEVANT =
  'Given the Knowledge Base purpose, does `candidate_text` contain information that ' +
  'should be retained for the Knowledge Base?'

const SUBSTANTIVE =
  'Does `candidate_text` carry specific, citable information — facts, figures, ' +
  'definitions, procedures, caveats, named entities? Answer no if it is mainly ' +
  'introductory framing, a table of contents, a transition, a restatement of something ' +
  'obvious, navigation, promotional language, or a call to action.'

/**
 * A chunk must clear both bars. The score shown in the UI is the relevance one,
 * which is what the map's tooltip means by P(yes).
 */
function classify(relevance: number, substance: number): RelevanceDecision['decision'] {
  if (relevance < config.relevance.relevantAbove) return 'drop'
  if (substance < config.relevance.substantiveAbove) return 'drop'
  if (relevance >= config.relevance.keepAbove && substance >= config.relevance.keepAbove) {
    return 'keep'
  }
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
      const questions: Record<string, unknown> = {}
      for (const c of batch) {
        questions[`rel_${c.id}`] = {
          type: 'noul',
          instructions: {candidate_text: c.text, question: RELEVANT},
        }
        questions[`sub_${c.id}`] = {
          type: 'noul',
          instructions: {candidate_text: c.text, question: SUBSTANTIVE},
        }
      }
      const res = await callJev({
        model: config.jev.model,
        state: `Knowledge base purpose: ${purpose}\nTopic: ${topic}`,
        questions,
      })
      for (const c of batch) {
        const relevance = res.answers[`rel_${c.id}`]
        const substance = res.answers[`sub_${c.id}`]
        if (!relevance || !substance) throw new Error(`Jev returned no answer for chunk ${c.id}`)
        decisions[c.id] = {
          score: relevance.noul,
          decision: classify(relevance.noul, substance.noul),
        }
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

/**
 * Picks between the two claims a build flagged as contradictory.
 *
 * This is a decision over two stated options, not prose interpretation: the
 * conflict carries each side's claim verbatim. Below the threshold it returns
 * null and the conflict stays open for a person, because resolving one writes a
 * standing instruction into every future build.
 */
export const jevConflictArbiter: ConflictArbiter = {
  async choose({purpose, conflict}) {
    if (conflict.sides.length < 2) return null

    const questions = Object.fromEntries(
      conflict.sides.map((side, index) => [
        `side_${index}`,
        {
          type: 'noul',
          instructions: {
            disagreement: conflict.issue,
            candidate_claim: side.claim,
            question:
              'Is `candidate_claim` the accurate one, judged on factual correctness and ' +
              'precision rather than on which source said it?',
          },
        },
      ]),
    )

    const res = await callJev({
      model: config.jev.model,
      state: `Knowledge base purpose: ${purpose}`,
      questions,
    })

    const scored = conflict.sides
      .map((_, index) => ({side: index, score: res.answers[`side_${index}`]?.noul ?? 0}))
      .sort((a, b) => b.score - a.score)

    const best = scored[0]
    const runnerUp = scored[1]
    if (!best || !runnerUp) return null

    // Needs to be confident *and* clearly ahead. Two plausible claims scoring
    // alike is exactly the case a person should see.
    if (best.score < config.relevance.conflictKeepAbove) return null
    if (best.score - runnerUp.score < config.relevance.conflictMargin) return null
    return best
  },
}
