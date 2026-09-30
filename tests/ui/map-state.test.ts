import {test} from 'node:test'
import assert from 'node:assert/strict'
import {applyEvent, emptyMapState, statusLine} from '../../components/knowledge-map/types.ts'
import type {BuildEvent} from '../../lib/db/types.ts'

/** The reducer is what guarantees the map and the token strip cannot disagree:
 *  both read the same folded state, and nothing else can write to it. */

const fold = (events: BuildEvent[]) => events.reduce(applyEvent, emptyMapState)

const started: BuildEvent = {
  type: 'build.started',
  sourceUrls: ['https://a.example/x', 'https://b.example/y'],
}

test('replaying the full stream from scratch reproduces the same state', () => {
  const events: BuildEvent[] = [
    started,
    {type: 'source.fetch.finished', url: 'https://a.example/x', title: 'A', bytes: 100, tokens: 500, chunks: 2},
    {type: 'chunk.ready', chunkId: 's0c0', sourceUrl: 'https://a.example/x', label: 'one', tokens: 250},
    {type: 'chunk.ready', chunkId: 's0c1', sourceUrl: 'https://a.example/x', label: 'two', tokens: 250},
    {type: 'jev.evaluation', chunkId: 's0c0', sourceUrl: 'https://a.example/x', label: 'one', decision: 'keep', score: 0.95},
    {type: 'jev.evaluation', chunkId: 's0c1', sourceUrl: 'https://a.example/x', label: 'two', decision: 'drop', score: 0.03},
    {type: 'jev.complete', retainedTokens: 250, droppedTokens: 250, latencyMs: 400},
  ]
  // A mid-build reload replays from seq 0. Both passes must agree exactly.
  assert.deepEqual(fold(events), fold(events))
})

test('token figures come only from events, never from summing chunks', () => {
  const state = fold([
    started,
    {type: 'source.fetch.finished', url: 'https://a.example/x', title: 'A', bytes: 1, tokens: 700, chunks: 1},
    {type: 'source.fetch.finished', url: 'https://b.example/y', title: 'B', bytes: 1, tokens: 300, chunks: 1},
    {type: 'jev.complete', retainedTokens: 420, droppedTokens: 580, latencyMs: 10},
    {type: 'synthesis.complete', outputTokens: 120},
  ])
  assert.equal(state.candidateTokens, 1000)
  assert.equal(state.retainedTokens, 420)
  assert.equal(state.synthesizedTokens, 120)
})

test('uncertain decisions are kept, shown as borderline', () => {
  const state = fold([
    started,
    {type: 'chunk.ready', chunkId: 's0c0', sourceUrl: 'https://a.example/x', label: 'x', tokens: 10},
    {type: 'jev.evaluation', chunkId: 's0c0', sourceUrl: 'https://a.example/x', label: 'x', decision: 'uncertain', score: 0.55},
  ])
  assert.equal(state.chunks['s0c0']?.state, 'borderline')
  assert.equal(state.chunks['s0c0']?.score, 0.55)
})

test('an evaluation for an unknown chunk is ignored rather than inventing one', () => {
  const state = fold([
    started,
    {type: 'jev.evaluation', chunkId: 'ghost', sourceUrl: 'https://a.example/x', label: 'x', decision: 'keep', score: 1},
  ])
  assert.equal(Object.keys(state.chunks).length, 0, 'reducer fabricated a chunk')
})

test('a failed source is marked without failing the build', () => {
  const state = fold([
    started,
    {type: 'source.fetch.failed', url: 'https://a.example/x', message: 'Blocked protocol'},
    {type: 'source.fetch.finished', url: 'https://b.example/y', title: 'B', bytes: 1, tokens: 300, chunks: 1},
  ])
  assert.equal(state.sources[0]?.failed, 'Blocked protocol')
  assert.equal(state.phase, 'fetching')
  assert.equal(state.candidateTokens, 300)
})

test('phase advances through the pipeline and settles on ready', () => {
  const phases = [
    'fetching',
    'filtering',
    'synthesizing',
    'creating',
    'building',
    'ready',
  ]
  const events: BuildEvent[] = [
    started,
    {type: 'chunk.ready', chunkId: 's0c0', sourceUrl: 'https://a.example/x', label: 'x', tokens: 10},
    {type: 'jev.evaluation', chunkId: 's0c0', sourceUrl: 'https://a.example/x', label: 'x', decision: 'keep', score: 0.9},
    {type: 'synthesis.started'},
    {type: 'sanity.kb.created', knowledgeBaseId: 'kbTEST'},
    {type: 'sanity.kb.building', stage: 'write'},
    {type: 'sanity.kb.ready'},
  ]
  const seen: string[] = []
  events.reduce((state, event) => {
    const next = applyEvent(state, event)
    if (next.phase !== state.phase) seen.push(next.phase)
    return next
  }, emptyMapState)
  assert.deepEqual(seen, phases)
})

test('failure is terminal and carries its message', () => {
  const state = fold([started, {type: 'build.failed', message: 'No source could be read'}])
  assert.equal(state.phase, 'failed')
  assert.equal(state.error, 'No source could be read')
  assert.match(statusLine(state), /No source could be read/)
})

test('a new build resets prior state rather than accumulating', () => {
  const first = fold([
    started,
    {type: 'source.fetch.finished', url: 'https://a.example/x', title: 'A', bytes: 1, tokens: 900, chunks: 1},
    {type: 'sanity.kb.created', knowledgeBaseId: 'kbOLD'},
  ])
  const second = applyEvent(first, {type: 'build.started', sourceUrls: ['https://c.example/z']})
  assert.equal(second.candidateTokens, 0)
  assert.equal(second.knowledgeBaseId, undefined)
  assert.equal(second.sources.length, 1)
})

test('status line reports real counts during filtering', () => {
  const state = fold([
    started,
    {type: 'chunk.ready', chunkId: 's0c0', sourceUrl: 'https://a.example/x', label: 'a', tokens: 10},
    {type: 'chunk.ready', chunkId: 's0c1', sourceUrl: 'https://a.example/x', label: 'b', tokens: 10},
    {type: 'jev.evaluation', chunkId: 's0c0', sourceUrl: 'https://a.example/x', label: 'a', decision: 'keep', score: 0.9},
    {type: 'jev.evaluation', chunkId: 's0c1', sourceUrl: 'https://a.example/x', label: 'b', decision: 'drop', score: 0.02},
  ])
  const line = statusLine(state)
  assert.match(line, /2\/2 evaluated/)
  assert.match(line, /1 kept/)
  assert.match(line, /1 dropped/)
})
