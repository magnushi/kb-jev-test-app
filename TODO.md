# TODO

## Phase 1 — vertical slice
- [x] SSRF-guarded fetcher
- [x] Readable-text extraction
- [x] Paragraph-aware chunking
- [x] Jev relevance gate (batched)
- [x] Bounded synthesis (Opus 5.5)
- [x] Create / import / build a real Sanity Knowledge Base
- [ ] **Extraction quality** — 254KB page yielded only ~2.3k tokens of prose, and one
      chunk was sidebar reference content ("defined() Field existence check"). The
      regex extractor is too blunt. Move to a real readability algorithm.
- [ ] **Synthesis grew the input** (2,286 in -> 3,019 out). Symptom of too little
      retained material; re-measure once extraction is fixed. Enforce an output budget
      proportional to retained input.
- [ ] Query the built knowledge base through Context MCP (Stage G) — the last
      unverified integration.

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
