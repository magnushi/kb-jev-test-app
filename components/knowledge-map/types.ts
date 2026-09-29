import type {BuildEvent} from '../../lib/db/types.ts'

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
  phase: 'idle' | 'fetching' | 'filtering' | 'synthesizing' | 'creating' | 'building' | 'ready' | 'failed'
  knowledgeBaseId?: string
  buildStage?: string
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

    case 'synthesis.section':
      return {...state, sections: [...state.sections, {title: event.title, sourceChunkIds: event.sourceChunkIds}]}

    case 'synthesis.complete':
      return {...state, synthesizedTokens: event.outputTokens}

    case 'sanity.kb.created':
      return {...state, phase: 'creating', knowledgeBaseId: event.knowledgeBaseId}

    case 'sanity.kb.importing':
      return {...state, phase: 'creating'}

    case 'sanity.kb.building':
      return {...state, phase: 'building', buildStage: event.stage}

    case 'sanity.kb.ready':
      return {...state, phase: 'ready', buildStage: undefined}

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
    case 'synthesizing':
      return `Synthesizing ${state.sections.length} section${state.sections.length === 1 ? '' : 's'} from retained material`
    case 'creating':
      return 'Creating the knowledge base in Sanity and importing'
    case 'building':
      return state.buildStage
        ? `Sanity is building · ${state.buildStage}`
        : 'Sanity is building the knowledge base'
    case 'ready':
      return `${state.sections.length} sections · hover the map to inspect decisions`
    case 'failed':
      return state.error ?? 'Build failed'
  }
}
