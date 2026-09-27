# Integration notes

Phase 0 deliverable (spec §12). Every contract below was verified against the live
API on 2026-09-25, not inferred from documentation. Where something is unverified or
uncertain it says so explicitly.

Verification scripts live in the session scratchpad; the findings are reproduced here.

---

## 1. Jev — relevance gate

**Provider:** TypeSafe, direct. OpenRouter was unavailable, and the direct API is the
same model. Kept behind `RelevanceGate` so transport can change in one file.

```
POST https://api.typesafe.ai/v1/systemone
Authorization: Bearer $TYPESAFE_API_KEY
Content-Type: application/json
```

**Request**

```jsonc
{
  "model": "jev-latest",              // resolves to jev-1.13.0
  "state":  "...",                    // string | object | array
  "questions": {
    "<your_id>": {
      "type": "noul",
      "instructions": "..." ,         // string | object | array
      "criteria": {"true": "...", "false": "..."}   // optional
    }
  }
}
```

**Response** (verified)

```json
{
  "model": "jev-1.13.0",
  "answers": {"<your_id>": {"type": "noul", "noul": 0.89}},
  "usage": {"input_tokens": 310, "output_tokens": 23}
}
```

`noul` is a calibrated probability 0–1. There is **no separate confidence field** for
Nouls — a binary distribution is fully described by one number. This is the
"defensible numeric value" the design brief (§6.1) requires before showing a score.

**Limits:** 64k tokens total per request; 32k for `state` plus the longest question.
250k tokens/sec, 1,200 req/min. $0.042 per million input tokens, output free.

**Errors:** 401 bad key · 422 validation · 429 rate limit · 529 overloaded.
Retry 429/529 with exponential backoff.

### Batching — how we call it

Jev processes `state` **once** and evaluates every question against it **in parallel**.
So we send the knowledge base purpose as `state` and one Noul per chunk:

```jsonc
{
  "model": "jev-latest",
  "state": "Knowledge base purpose: ... Topic: ...",
  "questions": {
    "keep_c1": {"type":"noul","instructions":{
      "candidate_text":"<chunk>",
      "question":"Does `candidate_text` contain information worth retaining for this knowledge base?"}}
  }
}
```

Measured: 6 chunks in one call, 632 input tokens, ~$0.00003, sub-second.

Observed behaviour on a realistic mix — boilerplate is crushed, substance survives:

```
0.83  MCP servers authenticate with an organization-level token…
0.02  Cookie banners on this site use a third-party consent manager…
0.29  The Context MCP endpoint switches to knowledge base mode…
0.02  Sign up for our newsletter…
0.74  Tokens are created under Manage > API > Tokens…
0.03  Copyright 2026. All rights reserved…
```

**Open:** thresholds are not yet calibrated. Two chunks above landed mid-band with a
naive 0.8/0.2 split. Real tuning belongs in Phase 3 against real pages, and the
"borderline, kept" state in the design brief (§6.1) exists precisely for this band.

**Chunk budget:** with a 32k ceiling on state + longest question, and chunks of
800–1,500 tokens, a single request holds roughly 20–30 chunks. Larger builds must
split across several requests. Enforce this in the adapter, not at the call site.

---

## 2. Anthropic — synthesis, test agent, and search

**Model:** `claude-opus-5-5` (released 2026-09-21). Verified live.

- 1,000,000 input tokens, 128,000 max output
- **Adaptive thinking only.** `{"type":"enabled","budget_tokens":N}` is unsupported on
  this family and returns 400. Use `{"type":"adaptive"}` and control spend with
  `output_config.effort` (`low`…`max`).
- Supports batch, citations, code execution, context management, structured outputs.
- Prefill is removed on this family — use structured outputs to constrain format.

### Search

Uses the **same key**, so search is not a separate credential or invoice.

```jsonc
{"type": "web_search_20260209", "name": "web_search", "max_uses": 3}
```

Verified: 3 searches returned 27 results and surfaced the canonical Sanity docs and
GitHub repo unprompted. ~$10 per 1,000 searches.

Used for **discovery only** — it returns URLs and snippets. Our own fetcher still does
fetching, extraction, chunking and SSRF checks, so spec §4 Stage B ("do not ask the LLM
to browse arbitrary pages itself") holds.

Server-tool errors do **not** raise. They return HTTP 200 with a
`web_search_tool_result` block whose `content` is an error object rather than a list.
Branch on that before indexing.

---

## 3. Sanity Context — Knowledge Bases

**There is no documented REST API, and none is needed.** `@sanity/cli` is a thin wrapper
over a first-class typed namespace in `@sanity/client` (v8.7.0). Use that.

Do not hand-roll URLs. A guessed path
(`/v2026-08-25/context/organizations/{org}/knowledge-bases`) returned 404 during
verification; the client resolves the real routes itself.

### Client construction

Two shapes. Collection-level calls are addressed per call; everything scoped to one
knowledge base uses a `resource`-configured client.

```ts
// Organization level — note useProjectHostname:false, or the client demands a projectId
const org = createClient({
  apiVersion: '2026-08-25',
  token: process.env.SANITY_ORGANIZATION_TOKEN,
  useCdn: false,
  useProjectHostname: false,
})

// Knowledge-base scoped
const kb = createClient({
  apiVersion: '2026-08-25',
  token, useCdn: false, useProjectHostname: false,
  resource: {type: 'knowledge-base', id: publicId},
})
```

### Lifecycle (verified end to end)

```ts
const created = await org.context.knowledgeBases.create({
  organizationId: 'oVGkeJzXR', title: '...', description: '...',
})                                            // -> { publicId: 'kbxrvRD30GvP', ... }

await kb.context.imports.create({type: 'text', title: '...', content: markdown})
const {jobId} = await kb.context.build()
const job     = await kb.context.jobs.get({jobId})
await org.context.knowledgeBases.delete(created.publicId)
```

`imports.create` is discriminated on `type`: `text` | `crawl` | `dataset` | `file`.
We use `text` with our synthesized Markdown.

Available: `knowledgeBases.{create,list,get,edit,delete}`, `imports.{create,list,get,
download,delete}`, `build()`, `cancelBuild()`, `refresh()`, `jobs.get()`.

Also present and useful later: `context.fetch()` / `context.listen()` (GROQ over Context
documents) and `context.conversations.{save,classify,get}` for recording test-agent
conversations into Context Insights.

### Real status fields (from a live knowledge base)

Richer than the design brief assumed. A build exposes nine named stages:

```
tldr → map → triage → plan → organize → arrange → write → review → polish
```

plus `state`, `isBuilding`, `activeJobId`, `buildStageState`, `openIssueCount`,
`sourceUsage {used, limit}`, `refreshEnabled`, `refreshFrequency`, `createdBy`.

The brief (§6.1) asks the map footer to read `importing… / building… / ready`. We can
show the **actual stage name** instead — real telemetry, and more interesting.

Public IDs look like `kbxrvRD30GvP` — no underscore. The prototype's `kb_7f3c2a91` is
stylized; render the real value.

### ⚠ Permissions gap — blocks unattended deployment

| Identity | read | create |
|---|---|---|
| User token (administrator) | ✅ | ✅ |
| `knowledge-base-editor-robot` | ✅ | ❌ 403 |
| `knowledge-base-viewer-robot` | ✅ | ❌ 403 |

```
403 Creating a knowledge base requires the 'sanity.knowledge-base.create'
grant in organization 'oVGkeJzXR'.
```

This is **not** a CLI-versus-API distinction. Creation over plain HTTP with a user token
succeeds. `@sanity/cli` simply always authenticates as a human — its own source sets
`requireUser: true` on every Context call — so "creating a knowledge base from the CLI"
is always a human acting, never a robot.

**Consequence:** no deployed application can create a knowledge base without
impersonating a user. Reported to the Sanity Context team.

**Interim:** `KnowledgeBaseProvider` uses the robot token for every operation and falls
back to a user token on 403. The fallback is isolated to that one file and deletes
cleanly once the grant reaches the editor robot role.

---

## 4. Sanity project dataset — the application database

Project `vjematwb`, dataset `production`, org `oVGkeJzXR`. Project token with the
**Editor** role. Verified: create, query and delete all succeed.

Holds `KnowledgeBaseRecord`, source records and build events. The knowledge itself lives
in Sanity Knowledge Bases — this dataset is demo metadata only (spec §6).

Build events are stored as documents rather than streamed, so the browser subscribes with
`client.listen()` and a mid-build page refresh replays the knowledge map instead of
showing a blank panel.

---

## 5. Sanity Context MCP — retrieval (Stage G)

```
https://api.sanity.io/v1/context/organizations/:organizationId/mcp/:mcpEndpointName
  ?mode=knowledge_base&knowledgeBases=kbXXXX
```

`GET .../initial-context` returns the outline as `text/plain`. Requires an
organization token with Context Viewer permission — a project token returns 403.
Read-only; it does not run the agent loop, which is why the Mastra harness exists.

### Endpoint setup (one-time, manual)

MCP endpoints are created in the **Context app in the Dashboard only** — there is no
management surface for them in `@sanity/client`. Fields: `title`, `name` (immutable,
lowercase/numbers/hyphens), `sources` (1–100), optional `instructions` and `groqFilter`.

**We need exactly one endpoint.** Mode and knowledge bases can both be overridden per
request, so a single endpoint serves every knowledge base the app builds:

```
https://api.sanity.io/v1/context/organizations/oVGkeJzXR/mcp/<name>
  ?mode=knowledge_base&knowledgeBases=<kbId>
```

Caveats that matter for us:
- An endpoint whose sources are all knowledge bases serves KB mode automatically. If it
  has **any** dataset source, the dataset wins and KB sources are ignored.
- A KB-mode endpoint with no readable knowledge bases is refused with JSON-RPC `-32005`.
  Keep one permanent seed knowledge base configured as its source so the 50-item
  retention policy can never empty it.
- Auth: organization token with Context Viewer (`sanity.knowledge-base.read`). Editor
  also works — our existing token qualifies. A project token is rejected with
  `403 contextGrantRequired`.

**Not yet verified live** — blocked on creating the endpoint.

---

## 6. Sanity Functions — the pipeline host

- Node.js v24. Max execution **900s** (default 10s), memory to 10GB, both set per
  function in `sanity.blueprint.ts`.
- Max bundle 200MB. Keep dependencies lean.
- `invoke(name, {context, event})` calls another function; async by default (fire and
  forget), `{sync: true}` waits. Use async for per-source fan-out.
- Rate limits: 200 invocations/30s per document, 4,000/30s per project. Recursion depth
  capped at 16 chained invocations.
- Function types: `document`, `pubsub`, `cron`, `media-library.asset`,
  `sync-tag-invalidate`.

There is no separate "durable functions" product — this is it, and 900s is ample for a
3-source build.

**Shape:** a Vercel route creates a build document → a document Function picks it up →
fans out per source via `invoke` → converges for the Jev call and synthesis → writes
events back as documents.

---

## Open items

1. `sanity.knowledge-base.create` grant for robot tokens — with the Context team.
2. Context MCP retrieval — verify against a real built knowledge base (Phase 1).
3. Jev thresholds — partially validated. A three-source build (MCP docs + Wikipedia MCP
   + Wikipedia Norwegian language as a deliberate off-topic control) gave:
   `19,718 candidate -> 4,885 kept -> 4,294 synthesized`, **75% withheld from synthesis**.
   Off-topic chunks scored 0.02–0.05; on-topic 0.80–0.97; Wikipedia citation lists
   landed at 0.30, correctly in the uncertain band. Jev cost $0.00113 of a $0.20 build
   — 0.6%. Still to calibrate: the 0.8/0.2 thresholds themselves.
4. Whether the robot token can do `imports.create` / `build()` / `delete`, or only reads.
   The adapter falls back on 403 per operation, so this is an optimisation, not a blocker.
5. Rotate the Jev and Anthropic keys before public launch; both were pasted into a
   development transcript.
