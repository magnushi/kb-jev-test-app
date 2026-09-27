# TODO

## Phase 1 — vertical slice
- [x] SSRF-guarded fetcher
- [x] Readable-text extraction
- [x] Paragraph-aware chunking
- [x] Jev relevance gate (batched)
- [x] Bounded synthesis (Opus 5.5)
- [x] Create / import / build a real Sanity Knowledge Base
- [x] **Extraction quality** — replaced the regex extractor with Mozilla Readability
      over linkedom (2.7MB, fine for the 200MB Functions cap). Flattens `article.content`
      rather than `textContent`, which concatenates blocks with no separator and
      destroys paragraph boundaries.
- [x] **Multi-source builds** — the slice now takes N URLs, which is what makes the
      funnel visible: one source has nothing to drop.
- [x] **Synthesis no longer inflates** — 4,885 retained in, 4,294 out.
- [ ] Query the built knowledge base through Context MCP (Stage G) — **blocked** on
      creating an MCP endpoint in the Context app (manual, Dashboard-only).
- [ ] Output budget proportional to retained input, rather than a flat cap.

## Phase 2 — UI
- [ ] Next.js app, three columns, design tokens
- [ ] Knowledge map driven by real BuildEvent stream
- [ ] Build progress over Sanity live listeners
- [ ] All knowledge bases list page

## Phase 3 — metrics
- [ ] Calibrate Jev thresholds against real pages
- [ ] Per-source tallies, funnel strip from real telemetry

## Phase 4 — hardening
- [ ] Rate limits, 50-knowledge-base cap, daily spend kill switch
- [ ] Failed-build UI states
- [ ] Rotate Jev and Anthropic keys before public launch

## Blocked
- [ ] `sanity.knowledge-base.create` grant for robot tokens — with the Context team.
      Until then `KnowledgeBaseProvider` falls back to a user token (verified working).
