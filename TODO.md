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
- [x] Next.js app, three columns, design tokens
- [x] Knowledge map driven by real BuildEvent stream
- [x] Build progress (polled; live listeners would remove the poll)
- [x] All knowledge bases list page
- [x] Pipeline moved into a Sanity Function — it would have died on Vercel
- [x] Scheduled reconciler for builds that outlive the function budget
- [ ] Build-phase redesign — waiting on Claude Design (BUILD_PHASE_BRIEF.md)

## Phase 3 — metrics
- [ ] Calibrate Jev thresholds against real pages
- [x] Per-source tallies, funnel strip from real telemetry

## Phase 4 — hardening
- [x] Rate limits (global burst gate, one build per session)
- [x] 50-knowledge-base cap with deletion
- [ ] Daily spend kill switch (DAILY_DEMO_BUDGET_USD)
- [ ] Tests: SSRF first, then chunking and the map reducer
- [ ] README
- [ ] Failed-build UI states
- [ ] Rotate Jev and Anthropic keys before public launch

## Blocked
- [ ] `sanity.knowledge-base.create` grant for robot tokens — with the Context team.
      Until then `KnowledgeBaseProvider` falls back to a user token (verified working).
