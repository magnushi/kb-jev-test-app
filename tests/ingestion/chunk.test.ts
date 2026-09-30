import {test} from 'node:test'
import assert from 'node:assert/strict'
import {chunkText, estimateTokens} from '../../lib/ingestion/chunk.ts'
import {extractReadableText} from '../../lib/ingestion/extract.ts'

test('chunk ids are unique and namespaced by source index', () => {
  const a = chunkText('one\ntwo\nthree', 'https://a.example/x', 0)
  const b = chunkText('four\nfive\nsix', 'https://b.example/y', 1)
  const ids = [...a, ...b].map((c) => c.id)
  assert.equal(new Set(ids).size, ids.length, 'ids collide across sources')
  assert.ok(a.every((c) => c.id.startsWith('s0')))
  assert.ok(b.every((c) => c.id.startsWith('s1')))
})

test('respects the target size and never exceeds the hard max', () => {
  const paragraphs = Array.from({length: 60}, (_, i) => `Paragraph ${i}. ${'word '.repeat(60)}`)
  const chunks = chunkText(paragraphs.join('\n'), 'https://a.example/x', 0, {
    targetTokens: 400,
    maxTokens: 700,
  })
  assert.ok(chunks.length > 1, 'should split')
  for (const chunk of chunks) {
    assert.ok(chunk.tokens <= 700 * 1.2, `chunk ${chunk.id} is ${chunk.tokens} tokens`)
  }
})

test('splits a single paragraph that exceeds the max rather than emitting it whole', () => {
  const huge = 'x'.repeat(700 * 4 * 3)
  const chunks = chunkText(huge, 'https://a.example/x', 0, {targetTokens: 400, maxTokens: 700})
  assert.ok(chunks.length >= 3, `expected several chunks, got ${chunks.length}`)
})

test('no chunk is empty or whitespace only', () => {
  const chunks = chunkText('\n\n  \nreal content here\n\n   \n\nmore content\n', 'https://a.example/x', 0)
  assert.ok(chunks.length > 0)
  for (const chunk of chunks) assert.ok(chunk.text.trim().length > 0, 'empty chunk emitted')
})

test('empty input yields no chunks rather than one empty chunk', () => {
  assert.deepEqual(chunkText('', 'https://a.example/x', 0), [])
  assert.deepEqual(chunkText('   \n  \n ', 'https://a.example/x', 0), [])
})

test('labels are short and single-line, for the map tooltip', () => {
  const chunks = chunkText(`${'A very long opening line that runs on '.repeat(10)}\nsecond`, 'https://a.example/x', 0)
  for (const chunk of chunks) {
    assert.ok(chunk.label.length <= 73, `label too long: ${chunk.label.length}`)
    assert.ok(!chunk.label.includes('\n'), 'label contains a newline')
  }
})

test('token estimate is monotonic', () => {
  assert.ok(estimateTokens('a'.repeat(400)) > estimateTokens('a'.repeat(100)))
  assert.equal(estimateTokens(''), 0)
})

test('extraction preserves block boundaries instead of joining words', () => {
  const html = `<html><body><main>
    <h1>Build with AI</h1><p>Last updated September 3, 2026</p>
    <p>${'The reference for Context MCP covers endpoints and parameters. '.repeat(12)}</p>
  </main></body></html>`
  const {text} = extractReadableText(html, 'https://example.com/docs')
  assert.ok(!text.includes('AILast'), 'block elements were concatenated without a separator')
  assert.ok(text.includes('Build with AI'), 'heading lost')
})

test('extraction strips scripts and styles', () => {
  const html = `<html><body><main>
    <script>const secret = "SHOULD_NOT_APPEAR"</script>
    <style>.x{color:red}</style>
    <p>${'Real readable prose that should survive extraction. '.repeat(14)}</p>
  </main></body></html>`
  const {text} = extractReadableText(html, 'https://example.com/docs')
  assert.ok(!text.includes('SHOULD_NOT_APPEAR'), 'script content leaked into the text')
  assert.ok(!text.includes('color:red'), 'style content leaked into the text')
})
