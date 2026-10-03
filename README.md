# Knowledge Base Lab

Turn a topic or a few public URLs into a real **Sanity Knowledge Base**, watch **Jev**
throw away most of the source material before the expensive model ever sees it, then
test the result with an agent.

An open-source demo of an agent-native content pipeline. Built with Claude Code.

---

## What happens when you use it

```
1. You describe the knowledge you want.
2. The app finds and fetches a few focused public sources.
3. Jev cheaply decides which source material is worth expensive processing.
4. An LLM distils what survived into a knowledge artifact, which becomes a
   Sanity Knowledge Base.
5. An agent queries that Knowledge Base through Sanity Context MCP.
```

A real three-source build, measured:

```
19,718 candidate tokens  →  4,885 kept by Jev  →  4,294 synthesized  →  a built Knowledge Base
                      75% never reached the synthesis model
```

Jev's share of that build's cost was **$0.00113 out of $0.20** — about 0.6%. That is the
entire argument: a cheap decision layer in front of an expensive one.

## The stack, and what each part does

| Part | Job |
|---|---|
| **Jev** (TypeSafe System One) | Judges each chunk: worth keeping, or not. Returns a calibrated probability in milliseconds, at $0.042 per million input tokens with output free. It never writes prose. |
| **Claude Opus 5.5** | Distils the retained chunks into a knowledge artifact, and answers questions in the test column. Also does source discovery via its web search tool. |
| **Sanity Knowledge Bases** | The real index. A build reads the material, forms a topic tree, writes entries with citations, and raises issues where sources contradict each other. This is not a vector database we built — it is Sanity Context. |
| **Sanity Context MCP** | Read-only retrieval for the test agent. It serves the outline and entry reads; it does not run the agent loop, which is why a harness exists. |
| **Sanity Functions** | Hosts the pipeline. Up to 900 seconds per build, triggered by a document write. |
| **Sanity dataset** | The app's own records and its build event log. The knowledge itself lives in Knowledge Bases, not here. |

Everything is behind a small adapter — `RelevanceGate`, `SearchProvider`,
`KnowledgeBaseProvider`, `TestAgent` — so any one of them can be swapped without
touching the UI or the pipeline.

## Architecture

```
Topic / URLs
     │
     ▼
┌──────────────┐   Anthropic web search: URLs only, we do the fetching
│ Web discovery│
└──────┬───────┘
       ▼
┌──────────────┐   SSRF-guarded fetch, Readability extraction,
│ Fetch + chunk│   paragraph-aware chunking
└──────┬───────┘
       ▼
┌──────────────┐   One request carries the purpose plus every chunk as a
│     Jev      │   separate yes/no question, evaluated in parallel
│  relevance   │
└──────┬───────┘
       │ retained only
       ▼
┌──────────────┐   Bounded. Only what survived is sent.
│ Opus 5.5     │
│  synthesis   │
└──────┬───────┘
       │ Markdown
       ▼
┌──────────────────────┐
│ Sanity Knowledge Base│  create → import → build → poll
└──────────┬───────────┘
           │ Context MCP
           ▼
┌──────────────┐
│  Test agent  │
└──────────────┘
```

## Why the numbers can be trusted

Every figure on screen comes from one event stream. The pipeline emits a `BuildEvent`
for each real thing that happens — a page fetched, a chunk created, a decision made, a
section written — and the UI folds that stream into the map, the per-source tallies and
the token strip alike. There is no second source of truth, so the picture and the
numbers cannot disagree.

The events are stored as documents rather than streamed, which means reloading
mid-build replays the whole build rather than showing an empty panel.

## Running it

Requires Node 22+ and access to the Sanity Knowledge Bases beta.

```bash
npm install
cp .env.example .env.local   # then fill it in
npm run dev
```

### Credentials

| Variable | Where it comes from |
|---|---|
| `TYPESAFE_API_KEY` | console.typesafe.ai — Jev. Also available via OpenRouter. |
| `ANTHROPIC_API_KEY` | console.anthropic.com — synthesis, the test agent, and search. |
| `SANITY_ORGANIZATION_TOKEN` | Manage → org → API → Tokens, **Context: Developer**. Viewer and Editor cannot create a Knowledge Base. |
| `SANITY_PROJECT_TOKEN` | Manage → project → API → Tokens, **Editor**. For the app's own records. |
| `SANITY_MCP_ENDPOINT` | The name of an MCP endpoint created in the Context app. Dashboard only. |

Context must be enabled for the organization on its Labs page, and the organization's
plan caps how many Knowledge Bases it can hold.

### Deploying

The UI runs on Vercel. The pipeline does **not** — it runs in Sanity Functions:

```bash
npx sanity blueprints deploy
npx sanity functions env add build-knowledge-base TYPESAFE_API_KEY <value>
# …and the rest
```

Leave `RUN_BUILDS_INLINE` unset in production. It runs the pipeline in-process for local
development; a Vercel function is torn down as soon as it responds, so a build started
there would die with it.

## Cost controls

The demo has no login, so these are not optional:

- three sources per build, enforced server-side
- hard token, byte and time budgets
- SSRF defences: protocol allowlist, DNS resolution checks, private and link-local ranges blocked
- a global burst gate and one build per session
- a daily spend cap; when reached, new builds pause and existing Knowledge Bases stay testable
- at most 50 Knowledge Bases, oldest deleted

```bash
npm test         # 28 tests: SSRF, chunking, extraction, map state
npm run typecheck
```

## Repository

```
app/                 Next.js routes and pages
components/          Three columns, plus the canvas knowledge map
lib/
  ingestion/         fetch · extract · chunk · synthesize · intent
  providers/         jev · llm · sanity · search  (all behind adapters)
  workflows/         the bounded build, and the reconciler
  db/                app records and the event log
  limits/            rate limiting, budgets, sessions
functions/           Sanity Functions: the pipeline and the reconciler
docs/                verified integration contracts
tests/               security · ingestion · ui
knowledge-base-lab-design/   the design package this was built from
```

`docs/integration-notes.md` records every external contract as verified against the live
API, including where the documentation and the behaviour differ. `DECISIONS.md` records
the architectural choices and where they depart from the original spec.
`DEVELOPMENT_LOG.md` is the narrative: what we measured, what surprised us, and what we
got wrong.

## Status

A prototype. Knowledge Bases are in beta and their API is marked `@beta`; expect
movement. Known gaps are in `TODO.md`.
