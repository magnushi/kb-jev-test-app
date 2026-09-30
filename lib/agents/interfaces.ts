/** Provider-agnostic contracts. Nothing outside lib/providers may import a vendor SDK. */

export type Usage = {inputTokens: number; outputTokens: number; costUsd?: number}

export type RelevanceDecision = {
  /** Calibrated probability the chunk is worth retaining, 0–1. */
  score: number
  decision: 'keep' | 'drop' | 'uncertain'
}

export interface RelevanceGate {
  /** Evaluates many chunks against one purpose. Batching is the adapter's concern. */
  evaluate(input: {
    purpose: string
    topic: string
    chunks: {id: string; text: string}[]
  }): Promise<{decisions: Record<string, RelevanceDecision>; usage: Usage; latencyMs: number}>
}

export type Candidate = {url: string; title?: string; pageAge?: string}

export interface SearchProvider {
  discover(input: {topic: string; maxResults: number}): Promise<Candidate[]>
}

export interface CandidateRanker {
  /**
   * Spec §4 Stage B step 5: choose ~3 from a wider candidate set. Judged on URL
   * and title only — web search returns no snippet — which is exactly the kind of
   * fast, cheap triage Jev exists for.
   */
  rank(input: {
    purpose: string
    topic: string
    candidates: Candidate[]
  }): Promise<{ranked: (Candidate & {score: number})[]; usage: Usage; latencyMs: number}>
}

export interface KnowledgeBaseProvider {
  create(input: {title: string; purpose: string}): Promise<{id: string}>
  importMarkdown(input: {knowledgeBaseId: string; title: string; markdown: string}): Promise<{jobId: string}>
  build(input: {knowledgeBaseId: string}): Promise<{jobId: string}>
  status(input: {knowledgeBaseId: string}): Promise<KnowledgeBaseStatus>
  delete(input: {knowledgeBaseId: string}): Promise<void>
}

export type KnowledgeBaseStatus = {
  id: string
  state: string
  isBuilding: boolean
  /** Real stage names from the build pipeline: tldr, map, triage, plan, … */
  stage?: string
  openIssueCount?: number
}
