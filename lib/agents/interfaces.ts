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

export interface ConflictArbiter {
  /** Picks between two stated claims. Returns null when genuinely unsure. */
  choose(input: {
    purpose: string
    conflict: Conflict
  }): Promise<{side: number; score: number} | null>
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

export type ConflictSide = {claim: string; value?: string; fromEntry: boolean}

export type Conflict = {
  id: string
  claimKey?: string
  scopePath?: string
  severity?: string
  issue: string
  sides: ConflictSide[]
  /** Sanity's own recommended side index, when it has one. */
  suggested?: number
}

export interface KnowledgeBaseProvider {
  create(input: {title: string; purpose: string}): Promise<{id: string}>
  importMarkdown(input: {knowledgeBaseId: string; title: string; markdown: string}): Promise<{jobId: string}>
  build(input: {knowledgeBaseId: string}): Promise<{jobId: string}>
  status(input: {knowledgeBaseId: string}): Promise<KnowledgeBaseStatus>
  /** Sanity's outline, once a build has landed. Needs no MCP endpoint. */
  outline(input: {knowledgeBaseId: string}): Promise<OutlineEntry[]>
  delete(input: {knowledgeBaseId: string}): Promise<void>
  openConflicts(input: {knowledgeBaseId: string}): Promise<Conflict[]>
  /** `side` is an index into the conflict's `sides`. */
  resolveConflict(input: {knowledgeBaseId: string; conflictId: string; side: number}): Promise<void>
}

export type Centrality = 'core' | 'standard' | 'peripheral'

/** One row of Sanity's real outline. Never humanize `path` — `title` is authored. */
export type OutlineEntry = {
  path: string
  title: string
  centrality: Centrality
  /** tldr.scope — the one-line summary. */
  summary: string
  /** tldr.excludes — what this entry deliberately leaves to others. Prose. */
  excludes?: string
  /** tldr.neighbors — related paths. Often empty on small builds. */
  neighbors: string[]
}

export type KnowledgeBaseStatus = {
  id: string
  state: string
  isBuilding: boolean
  /** Real stage names from the build pipeline: tldr, map, triage, plan, … */
  stage?: string
  /** Every stage with its status, for the stage line. */
  stages?: {id: string; status: string}[]
  openIssueCount?: number
}
