# Decisions

Architectural and product choices, with reasoning. Newest section last.
Design questions the brief deferred are answered here.

## 2026-09-25 — Integrations

**Jev via TypeSafe direct, not OpenRouter.** `POST https://api.typesafe.ai/v1/systemone`,
model `jev-latest` (resolves to `jev-1.13.0`). OpenRouter access was unavailable; the
direct API is the same model and the same Noul primitive. Behind `RelevanceGate` so the
transport can change without touching the pipeline. Verified live.

**Relevance gate uses the Noul primitive.** Returns a single calibrated `noul` value
0–1; no separate confidence field, because a binary distribution is fully described by
one number. This is the defensible numeric score the design brief (§6.1) requires.

**Jev calls are batched, one per build rather than one per chunk.** Jev processes
`state` once and evaluates all questions against it in parallel. So `state` carries the
knowledge base purpose and each chunk becomes one Noul question. Measured: 6 chunks in
one call, 632 input tokens, ~$0.00003. Consequence: the knowledge map replays *real*
decisions at a legible pace instead of waiting on the network — permitted by brief §11
("don't add artificial delay beyond what makes each decision legible"). Approved.

**Synthesis model `claude-opus-5-5`.** 1M input / 128k output. Adaptive thinking only —
`budget_tokens` is rejected on this family. Cost controlled with `output_config.effort`.
Verified live.

**Search is Anthropic's `web_search_20260209`, not Tavily.** No extra account or key, one
invoice, ~$0.01/build. Used for *discovery only* — it returns URLs and snippets; our own
fetcher still does fetching, extraction, chunking and SSRF checks, so spec §4 Stage B
("do not ask the LLM to browse arbitrary pages itself") holds. Behind `SearchProvider`;
Exa is the swap-in if source quality disappoints.

**Knowledge Bases are created through `client.context.*` in `@sanity/client`, not the CLI.**
There is no documented REST API, but `@sanity/cli` is itself a thin wrapper over a
first-class typed client namespace: `knowledgeBases.create/list/get/edit/delete`,
`imports.create`, `build()`, `jobs.get()`. Marked `@beta`; `apiVersion` pinned to
`2026-08-25` and isolated behind `KnowledgeBaseProvider`. This removes the need to bundle
a CLI or run a separate worker — the pipeline runs anywhere Node runs.

## 2026-09-25 — Architecture

**Long-running work runs in Sanity Functions; Vercel hosts the UI.** Functions allow up to
900s at up to 10GB. Creating the build record triggers the `build-knowledge-base`
document Function. Nothing is started from the API route: a serverless function is torn
down as soon as it responds, so work launched there dies with it. `RUN_BUILDS_INLINE=true`
runs the pipeline in-process for local development only.

A `reconcile-builds` scheduled Function runs every five minutes to finish builds whose
Sanity build outlived the 900s budget, fail ones abandoned mid-pipeline, and enforce
retention. Without it a record can wait forever on a build nobody is driving.

**Durable Functions would fit better, when they ship.** `durableEventHandler` and
`defineDurableFunction` exist in the packages — `step.run` with retries and
`step.waitForCondition` for polling without holding a function open is exactly this
problem's shape — but the definer is marked "not available publicly yet". Revisit then.

**The app database is a Sanity dataset** (`vjematwb` / `production`), not Postgres.
Knowledge bases live at the org level (`oVGkeJzXR`); the app's own records live in the
project dataset. The knowledge itself stays in Sanity Knowledge Bases.

**Build progress is polled, not streamed.** Every `BuildEvent` is a document, so the
client polls `/api/build/:id/events?after=N` and a mid-build refresh replays the whole
knowledge map instead of showing a blank panel — which SSE could not do without extra
machinery. Spec §8 permits polling first. Sanity live listeners would remove the poll and
are the natural next step, but persistence, not transport, is what makes replay work.

**Mastra was not used, contrary to spec §5.** Ingestion is a bounded workflow in plain
TypeScript, and the test agent reaches Context MCP through the Anthropic SDK's MCP
connector. Mastra's value here would have been the agent loop and an MCP client, and the
SDK supplies both, so it would have added a dependency without removing code. The spec's
actual goal — a replaceable harness — is met by the `RelevanceGate`, `SearchProvider`,
`KnowledgeBaseProvider` and `TestAgent` interfaces. **Open for review:** if the
open-source story needs a named framework, Mastra can be introduced behind `TestAgent`
without touching the UI or the pipeline.

## 2026-09-25 — Product

**Repository:** `kb-jev-test-app` under the personal GitHub account `magnushi`, public.

**Retention: the list is capped at 50 knowledge bases.** ASSUMPTION pending confirmation:
when a new build would exceed 50, the oldest is deleted from both the app dataset and
Sanity Context, so the organization stays bounded. If the intent was display-only (show
50, keep everything), this changes.

**"Built by" is name-only in public.** The list page shows the maker's name; email is
collected optionally, stored, and never rendered publicly. Resolves the question the
design brief (§5.2) left open. The email field copy must say the email is not shown.
