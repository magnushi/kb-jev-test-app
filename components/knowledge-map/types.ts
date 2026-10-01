import type {BuildEvent} from '../../lib/db/types.ts'
import type {OutlineEntry} from '../../lib/agents/interfaces.ts'
import {BUILD_STAGES, type BuildStageId} from './StageLine.tsx'

export type ChunkNode = {
  id: string
  sourceUrl: string
  label: string
  tokens: number
  state: 'undecided' | 'evaluating' | 'keep' | 'borderline' | 'drop'
  score?: number
}

export type SourceLane = {
  url: string
  host: string
  title?: string
  chunkIds: string[]
  tokens: number
  failed?: string
}

export type Section = {title: string; sourceChunkIds: string[]; retrieved?: boolean}

export type MapState = {
  sources: SourceLane[]
  chunks: Record<string, ChunkNode>
  sections: Section[]
  /** Chunk currently under evaluation, for the enlarged focus state. */
  evaluating?: string
  phase:
    | 'idle'
    | 'fetching'
    | 'filtering'
    | 'synthesizing'
    | 'creating'
    | 'queued'
    | 'building'
    | 'ready'
    | 'failed'
  knowledgeBaseId?: string
  buildStage?: BuildStageId | 'queued'
  /** Stages seen as done, so the stage line can strike them through. */
  stagesDone: Set<string>
  /** Client clock from the first building poll. The only time we show. */
  buildStartedAt?: number
  synthesisMs?: number
  /** Sanity's own outline, fetched once at ready. */
  outline?: OutlineEntry[]
  outcome?: 'ready' | 'review'
  openIssueCount?: number
  /** How the build's conflicts were settled, so the UI never implies a person did it. */
  conflicts?: {found: number; resolved: number; by: ('sanity' | 'jev')[]; left: number}
  /** Entry paths the test agent actually read, verbatim from retrieval. */
  readPaths?: string[]
  readQuestion?: string
  candidateTokens: number
  retainedTokens: number
  synthesizedTokens: number
  jevLatencyMs?: number
  error?: string
}

export const emptyMapState: MapState = {
  sources: [],
  chunks: {},
  sections: [],
  phase: 'idle',
  stagesDone: new Set(),
  candidateTokens: 0,
  retainedTokens: 0,
  synthesizedTokens: 0,
}

function host(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/**
 * Folds the real event stream into map state. This is the only place the map's
 * appearance is decided, so nothing can be drawn that the pipeline did not measure.
 */
export function applyEvent(state: MapState, event: BuildEvent): MapState {
  switch (event.type) {
    case 'build.started':
      return {
        ...emptyMapState,
        phase: 'fetching',
        sources: event.sourceUrls.map((url) => ({url, host: host(url), chunkIds: [], tokens: 0})),
      }

    case 'source.fetch.finished':
      return {
        ...state,
        sources: state.sources.map((s) =>
          s.url === event.url ? {...s, title: event.title, tokens: event.tokens} : s,
        ),
        candidateTokens: state.candidateTokens + event.tokens,
      }

    case 'source.fetch.failed':
      return {
        ...state,
        sources: state.sources.map((s) => (s.url === event.url ? {...s, failed: event.message} : s)),
      }

    case 'chunk.ready':
      return {
        ...state,
        chunks: {
          ...state.chunks,
          [event.chunkId]: {
            id: event.chunkId,
            sourceUrl: event.sourceUrl,
            label: event.label,
            tokens: event.tokens,
            state: 'undecided',
          },
        },
        sources: state.sources.map((s) =>
          s.url === event.sourceUrl ? {...s, chunkIds: [...s.chunkIds, event.chunkId]} : s,
        ),
      }

    case 'jev.evaluation': {
      const existing = state.chunks[event.chunkId]
      if (!existing) return state
      const nextState =
        event.decision === 'keep' ? 'keep' : event.decision === 'drop' ? 'drop' : 'borderline'
      return {
        ...state,
        phase: 'filtering',
        evaluating: event.chunkId,
        chunks: {...state.chunks, [event.chunkId]: {...existing, state: nextState, score: event.score}},
      }
    }

    case 'jev.complete':
      return {
        ...state,
        evaluating: undefined,
        retainedTokens: event.retainedTokens,
        jevLatencyMs: event.latencyMs,
      }

    case 'synthesis.started':
      return {...state, phase: 'synthesizing'}

    case 'sanity.kb.queued':
      return {...state, phase: 'queued', buildStage: 'queued', buildStartedAt: state.buildStartedAt ?? Date.now()}

    case 'synthesis.section':
      return {...state, sections: [...state.sections, {title: event.title, sourceChunkIds: event.sourceChunkIds}]}

    case 'synthesis.complete':
      return {...state, synthesizedTokens: event.outputTokens, synthesisMs: event.durationMs}

    case 'sanity.kb.created':
      return {...state, phase: 'creating', knowledgeBaseId: event.knowledgeBaseId}

    case 'sanity.kb.importing':
      return {...state, phase: 'creating'}

    case 'sanity.kb.building': {
      const stage = (event.stage ?? undefined) as BuildStageId | undefined
      const done = new Set(state.stagesDone)
      // Everything before the current stage has been passed. A repeated stage
      // adds nothing, which is the point: nothing new is claimed.
      if (stage) {
        done.add('queued')
        for (const id of BUILD_STAGES) {
          if (id === stage) break
          done.add(id)
        }
      }
      for (const s of event.stages ?? []) if (s.status === 'done') done.add(s.id)
      return {
        ...state,
        phase: stage ? 'building' : 'queued',
        buildStage: stage ?? 'queued',
        stagesDone: done,
        buildStartedAt: state.buildStartedAt ?? Date.now(),
      }
    }

    case 'sanity.kb.conflicts':
      return {
        ...state,
        conflicts: {found: event.found, resolved: event.resolved, by: event.by, left: event.left},
      }

    case 'sanity.kb.ready':
      return {
        ...state,
        phase: 'ready',
        buildStage: undefined,
        stagesDone: new Set(['queued', ...BUILD_STAGES]),
      }

    case 'build.failed':
      return {...state, phase: 'failed', error: event.message}

    default:
      return state
  }
}

/** Plain-language progress for the status line (design brief §6.2). */
export function statusLine(state: MapState): string {
  const chunks = Object.values(state.chunks)
  switch (state.phase) {
    case 'idle':
      return 'Describe a knowledge base on the left to start a build'
    case 'queued':
      return 'Queued at Sanity · waiting for a build slot'
    case 'fetching': {
      const pending = state.sources.filter((s) => !s.title && !s.failed)
      return pending.length > 0
        ? `Fetching ${pending[0]!.host} · extracting and chunking`
        : `${chunks.length} chunks ready · waiting for Jev`
    }
    case 'filtering': {
      const decided = chunks.filter((c) => c.state !== 'undecided' && c.state !== 'evaluating')
      const kept = chunks.filter((c) => c.state === 'keep' || c.state === 'borderline').length
      const dropped = chunks.filter((c) => c.state === 'drop').length
      return `Jev · ${decided.length}/${chunks.length} evaluated · ${kept} kept · ${dropped} dropped`
    }
    case 'synthesizing': {
      const kept = chunks.filter((c) => c.state === 'keep' || c.state === 'borderline').length
      return state.sections.length > 0
        ? `Writing · ${state.sections.length} section${state.sections.length === 1 ? '' : 's'} so far`
        : `Writing from ${kept} retained chunk${kept === 1 ? '' : 's'}`
    }
    case 'creating':
      return 'Creating the knowledge base in Sanity and importing'
    case 'building':
      return state.buildStage
        ? `Sanity is building · ${state.buildStage}`
        : 'Sanity is building the knowledge base'
    case 'ready': {
      // Low reduction is a real outcome, not a failure: it means every source
      // was on topic. Say which happened rather than showing a flat funnel.
      const dropped = chunks.filter((c) => c.state === 'drop').length
      const withheld =
        state.candidateTokens > 0
          ? Math.round((1 - state.retainedTokens / state.candidateTokens) * 100)
          : 0
      if (dropped === 0) {
        return `${state.sections.length} sections · Jev kept all ${chunks.length} chunks: every source was on topic`
      }
      return `${state.sections.length} sections · Jev withheld ${withheld}% of source material from the synthesis model`
    }
    case 'failed':
      return state.error ?? 'Build failed'
  }
}
