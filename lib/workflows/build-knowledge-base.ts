import {fetchPage} from '../ingestion/fetch.ts'
import {extractReadableText} from '../ingestion/extract.ts'
import {chunkText, estimateTokens, type Chunk} from '../ingestion/chunk.ts'
import {jevRelevanceGate} from '../providers/jev/index.ts'
import {synthesize} from '../ingestion/synthesize.ts'
import {sanityKnowledgeBaseProvider as kbProvider} from '../providers/sanity/knowledge-base.ts'
import * as db from '../db/knowledge-bases.ts'
import type {BuildEvent, BuildMetrics, SourceRecord} from '../db/types.ts'
import {config} from '../config.ts'

/**
 * The ingestion workflow: a bounded sequence with hard limits, not an agent loop
 * (spec §5). Every number the UI shows is emitted from here, so the knowledge map
 * and the token strip can never disagree.
 */
export async function runBuild(buildId: string): Promise<void> {
  const started = Date.now()
  let seq = 0
  const emit = async (event: BuildEvent): Promise<void> => {
    await db.appendEvent(buildId, seq++, event)
  }

  const record = await db.getRecord(buildId)
  if (!record) throw new Error(`No such build: ${buildId}`)

  const metrics: BuildMetrics = {
    candidateTokens: 0,
    retainedTokens: 0,
    synthesisInputTokens: 0,
    synthesisOutputTokens: 0,
    jevCalls: 0,
    jevLatencyMs: 0,
    llmCalls: 0,
    elapsedMs: 0,
  }

  try {
    const urls = record.sources.slice(0, config.budgets.maxSources).map((s) => s.url)
    await emit({type: 'build.started', sourceUrls: urls})

    // Stage C — fetch, extract, chunk. A failed source does not fail the build.
    await db.patchRecord(buildId, {status: 'fetching'})
    const chunks: Chunk[] = []
    const sources: SourceRecord[] = []

    for (const [index, url] of urls.entries()) {
      await emit({type: 'source.fetch.started', url})
      try {
        const page = await fetchPage(url)
        const extraction = extractReadableText(page.html, page.url)
        const pageChunks = chunkText(extraction.text, page.url, index)
        const tokens = pageChunks.reduce((sum, c) => sum + c.tokens, 0)

        if (metrics.candidateTokens + tokens > config.budgets.maxCandidateTokens) {
          throw new Error('Candidate token budget exhausted')
        }
        metrics.candidateTokens += tokens
        chunks.push(...pageChunks)
        sources.push({
          url: page.url,
          title: page.title,
          fetchedBytes: page.bytes,
          candidateTokens: tokens,
          chunksTotal: pageChunks.length,
        })
        await emit({
          type: 'source.fetch.finished',
          url: page.url,
          title: page.title,
          bytes: page.bytes,
          tokens,
          chunks: pageChunks.length,
        })
        for (const chunk of pageChunks) {
          await emit({
            type: 'chunk.ready',
            chunkId: chunk.id,
            sourceUrl: chunk.sourceUrl,
            label: chunk.label,
            tokens: chunk.tokens,
          })
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        sources.push({url, error: message})
        await emit({type: 'source.fetch.failed', url, message})
      }
    }

    if (chunks.length === 0) throw new Error('No source could be read')
    await db.patchRecord(buildId, {sources})

    // Stage D — the Jev relevance gate.
    await db.patchRecord(buildId, {status: 'filtering'})
    const gate = await jevRelevanceGate.evaluate({
      purpose: record.purpose,
      topic: record.topic,
      chunks: chunks.map((c) => ({id: c.id, text: c.text})),
    })
    metrics.jevCalls = Math.ceil(chunks.length / config.budgets.maxChunksPerJevCall)
    metrics.jevLatencyMs = gate.latencyMs
    metrics.jevCostUsd = gate.usage.costUsd

    const retained: Chunk[] = []
    let droppedTokens = 0
    for (const [index, chunk] of chunks.entries()) {
      const decision = gate.decisions[chunk.id]
      if (!decision) throw new Error(`Jev returned no decision for ${chunk.id}`)
      await emit({
        type: 'jev.evaluation',
        chunkId: chunk.id,
        sourceUrl: chunk.sourceUrl,
        label: chunk.label,
        decision: decision.decision,
        score: decision.score,
      })
      if (decision.decision === 'drop') droppedTokens += chunk.tokens
      else retained.push(chunk)
      if (index % 5 === 4) await emit({type: 'jev.progress', processed: index + 1, total: chunks.length})
    }
    metrics.retainedTokens = retained.reduce((sum, c) => sum + c.tokens, 0)
    await emit({
      type: 'jev.complete',
      retainedTokens: metrics.retainedTokens,
      droppedTokens,
      latencyMs: gate.latencyMs,
      costUsd: gate.usage.costUsd,
    })

    if (retained.length === 0) throw new Error('Jev retained nothing from these sources')

    // Per-source tallies for the map's source lane (design brief §6.1).
    const withTallies = sources.map((source) => ({
      ...source,
      chunksKept: retained.filter((c) => c.sourceUrl === source.url).length,
      retainedTokens: retained
        .filter((c) => c.sourceUrl === source.url)
        .reduce((sum, c) => sum + c.tokens, 0),
    }))
    await db.patchRecord(buildId, {sources: withTallies, metrics})

    // Stage E — bounded synthesis. Only retained material reaches the model.
    await db.patchRecord(buildId, {status: 'synthesizing'})
    await emit({type: 'synthesis.started'})
    const synthesisStarted = Date.now()
    const {markdown, usage} = await synthesize({
      title: `${record.title} Knowledge Base`,
      purpose: record.purpose,
      retained,
      sources: withTallies.flatMap((s) => (s.error ? [] : [{url: s.url, title: s.title ?? s.url}])),
    })
    metrics.llmCalls = 1
    metrics.synthesisInputTokens = usage.inputTokens
    metrics.synthesisOutputTokens = usage.outputTokens
    metrics.llmCostUsd = usage.costUsd

    // No per-section provenance: synthesis is one call over all retained
    // material, so we cannot say which chunks produced which section. Emitting
    // every chunk id for every section would be a fabricated number.
    // Real provenance comes from the Sanity outline's citations, post-build.
    for (const heading of markdown.split('\n').filter((line) => line.startsWith('## '))) {
      await emit({
        type: 'synthesis.section',
        title: heading.slice(3).trim(),
        sourceChunkIds: [],
      })
    }
    await emit({
      type: 'synthesis.complete',
      outputTokens: estimateTokens(markdown),
      costUsd: usage.costUsd,
      durationMs: Date.now() - synthesisStarted,
    })

    // Stage F — a real Sanity Knowledge Base.
    await db.patchRecord(buildId, {status: 'creating_kb'})
    const {id: knowledgeBaseId} = await kbProvider.create({
      title: `${record.title} Knowledge Base`,
      purpose: record.purpose,
    })
    await db.patchRecord(buildId, {sanityKnowledgeBaseId: knowledgeBaseId})
    await emit({type: 'sanity.kb.created', knowledgeBaseId})

    await emit({type: 'sanity.kb.importing'})
    await kbProvider.importMarkdown({
      knowledgeBaseId,
      title: `${record.title} Knowledge Base`,
      markdown,
    })

    await db.patchRecord(buildId, {status: 'building_kb'})
    await kbProvider.build({knowledgeBaseId})
    // isBuilding with no stage begun is the queue, which can last a long time.
    // It gets its own state rather than a spinner pretending to progress.
    await emit({type: 'sanity.kb.queued'})

    let lastStage: string | undefined
    for (let i = 0; i < 60; i++) {
      await new Promise((resolve) => setTimeout(resolve, 10_000))
      const status = await kbProvider.status({knowledgeBaseId})
      const startedStages = (status.stages ?? []).some((s) => s.status !== 'pending')
      if (status.stage !== lastStage || status.stages) {
        lastStage = status.stage
        await emit({
          type: 'sanity.kb.building',
          stage: startedStages ? status.stage : undefined,
          stages: status.stages,
        })
      }
      if (!status.isBuilding && status.state !== 'building') break
    }

    metrics.elapsedMs = Date.now() - started
    metrics.estimatedCostUsd = (metrics.jevCostUsd ?? 0) + (metrics.llmCostUsd ?? 0)
    await db.patchRecord(buildId, {status: 'ready', metrics})
    await emit({type: 'sanity.kb.ready'})

    await enforceRetention()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    metrics.elapsedMs = Date.now() - started
    await db.patchRecord(buildId, {status: 'failed', error: message, metrics})
    await emit({type: 'build.failed', message})
    throw error
  }
}

/**
 * Keeps the gallery — and the organization — bounded. Deletes the oldest records
 * beyond the cap, and the Sanity Knowledge Bases behind them.
 */
export async function enforceRetention(): Promise<void> {
  for (const stale of await db.findBeyondRetention()) {
    if (stale.sanityKnowledgeBaseId) {
      await kbProvider
        .delete({knowledgeBaseId: stale.sanityKnowledgeBaseId})
        .catch((error: unknown) => console.warn('[retention] KB delete failed', error))
    }
    await db.deleteRecord(stale.id)
  }
}
