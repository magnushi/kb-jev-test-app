/** Documents stored in the app's own Sanity dataset. Demo metadata only — the
 *  knowledge itself lives in Sanity Knowledge Bases (spec §6). */

export const KB_RECORD_TYPE = 'kbLab.knowledgeBase'
export const BUILD_EVENT_TYPE = 'kbLab.buildEvent'

export type BuildStatus =
  | 'draft'
  | 'discovering'
  | 'awaiting_sources'
  | 'fetching'
  | 'filtering'
  | 'synthesizing'
  | 'creating_kb'
  | 'building_kb'
  | 'ready'
  | 'failed'

export type SourceRecord = {
  url: string
  title?: string
  fetchedBytes?: number
  candidateTokens?: number
  retainedTokens?: number
  chunksTotal?: number
  chunksKept?: number
  /** Set when a source could not be processed; the build continues without it. */
  error?: string
}

export type BuildMetrics = {
  candidateTokens: number
  retainedTokens: number
  synthesisInputTokens: number
  synthesisOutputTokens: number
  jevCalls: number
  jevLatencyMs: number
  jevCostUsd?: number
  llmCalls: number
  llmCostUsd?: number
  elapsedMs: number
  estimatedCostUsd?: number
}

export type KnowledgeBaseRecord = {
  _id: string
  _type: typeof KB_RECORD_TYPE
  /** The [Name] part only. The UI appends " Knowledge Base" (design brief §4). */
  title: string
  /** Shown as the short description on the list page. */
  purpose: string
  topic: string
  status: BuildStatus
  sanityKnowledgeBaseId?: string
  sources: SourceRecord[]
  metrics?: BuildMetrics
  error?: string
  /** Optional, self-entered. Email is stored but never rendered publicly
   *  (design brief §5.2, resolved in DECISIONS.md). */
  makerName?: string
  makerEmail?: string
  /** Cookie-bound; only the creating session may edit maker fields. */
  sessionId: string
  createdAt: string
  updatedAt: string
}

/** Public shape for GET /api/knowledge-bases. Note: no email. */
export type PublicKnowledgeBase = {
  id: string
  title: string
  purpose: string
  makerName?: string
  status: BuildStatus
  sanityKnowledgeBaseId?: string
  createdAt: string
}

/** Progress events (spec §8). Persisted as documents so a mid-build refresh
 *  can replay the knowledge map rather than showing a blank panel. */
export type BuildEvent =
  | {type: 'build.started'; sourceUrls: string[]}
  | {type: 'source.fetch.started'; url: string}
  | {type: 'source.fetch.finished'; url: string; title: string; bytes: number; tokens: number; chunks: number}
  | {type: 'source.fetch.failed'; url: string; message: string}
  | {type: 'chunk.ready'; chunkId: string; sourceUrl: string; label: string; tokens: number}
  | {type: 'jev.progress'; processed: number; total: number}
  | {
      type: 'jev.evaluation'
      chunkId: string
      sourceUrl: string
      label: string
      decision: 'keep' | 'drop' | 'uncertain'
      score: number
    }
  | {type: 'jev.complete'; retainedTokens: number; droppedTokens: number; latencyMs: number; costUsd?: number}
  | {type: 'synthesis.started'}
  | {type: 'synthesis.section'; title: string; sourceChunkIds: string[]}
  | {type: 'synthesis.complete'; outputTokens: number; costUsd?: number}
  | {type: 'sanity.kb.created'; knowledgeBaseId: string}
  | {type: 'sanity.kb.importing'}
  | {type: 'sanity.kb.building'; stage?: string}
  | {type: 'sanity.kb.ready'}
  | {type: 'build.failed'; message: string}

export type StoredBuildEvent = {
  _id: string
  _type: typeof BUILD_EVENT_TYPE
  buildId: string
  /** Monotonic within a build, so the client can order and de-duplicate. */
  seq: number
  at: string
  event: BuildEvent
}
