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

export interface SearchProvider {
  discover(input: {topic: string; maxResults: number}): Promise<{url: string; title?: string}[]>
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
