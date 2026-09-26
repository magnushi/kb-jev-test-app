# Knowledge Base Lab

## Product & Build Specification for Claude Code + Claude Design

**Status:** Prototype / open-source demo\
**Date:** September 25, 2026\
**Primary goal:** Build a public web app that demonstrates a low-cost,
agent-native pipeline for turning a topic or a few public web pages into
a purpose-built **Sanity Knowledge Base**, then immediately testing that
Knowledge Base through an agent.

------------------------------------------------------------------------

## 1. The idea in one sentence

Build a one-page "Knowledge Base Lab" where a user chats with a builder
on the left, watches a new Sanity Knowledge Base appear in the middle,
and tests it with an agent on the right --- while visibly demonstrating
how **Jev reduces the amount of material that needs expensive LLM
processing**.

The product should feel like "make a skill, but with a substantially
informed and pre-built knowledge layer behind it."

------------------------------------------------------------------------

## 2. What we are trying to prove

This is not intended to be a generic enterprise knowledge-management
product in V1. It is a focused, public demonstration of a modern agent
stack.

It should prove four things:

1.  **A useful knowledge base can be created conversationally.** A user
    can say "make me a knowledge base about X" or provide one or more
    public URLs.
2.  **Ingestion does not require sending everything to an expensive
    LLM.** Jev is used as a fast/cheap decision layer to decide what
    material is worth retaining or escalating.
3.  **The result is a real Sanity Knowledge Base.** Each successful
    build creates a distinct Knowledge Base using Sanity Context /
    Knowledge Base technology, not a home-grown vector database
    pretending to be one.
4.  **The result is immediately agent-usable.** A separate test agent
    can query the selected Knowledge Base through Sanity Context MCP.

The UI should make this stack legible:

**Web sources → Jev relevance gate → LLM synthesis → Sanity Knowledge
Base → MCP → Test agent**

------------------------------------------------------------------------

## 3. Product experience

### 3.1 Single-screen layout

Use one desktop-first page with three persistent columns.

  Column   Role                              Approx. width
  -------- ------------------------------- ---------------
  Left     Builder / ingestion chat                    32%
  Middle   Knowledge Bases + build state               36%
  Right    Test agent chat                             32%

On smaller screens, collapse this into tabs: **Build / Knowledge Bases /
Test**.

### 3.2 Left: Builder chat

This is where a user creates a Knowledge Base conversationally.

Example starts:

> "Make me a knowledge base about California wildfire insurance."

> "Build a knowledge base from https://example.com/docs."

> "I want a knowledge base that helps an agent answer questions about
> MCP."

The builder should interpret the request into:

-   a working title;
-   a short Knowledge Base purpose;
-   topic/search intent;
-   user-provided URLs;
-   suggested additional sources;
-   a bounded ingestion budget.

If the user supplies only a topic, the builder proposes approximately
**three focused public sources**. Show these in the conversation as
editable source cards.

For V1, prefer a lightweight confirmation step:

**"I found these three sources. Build from these?"**

Allow: - remove source; - replace URL; - add URL; - build now.

Do not silently crawl a large part of the web.

### 3.3 Middle: Knowledge Bases

This is the visual center of the demo.

Each card represents a **real, unique Sanity Knowledge Base** and should
show:

-   title;
-   short purpose;
-   Sanity Knowledge Base ID;
-   state: discovering / filtering / synthesizing / importing / building
    / ready / failed;
-   source count;
-   source domains;
-   created time;
-   selected/not selected;
-   cost/efficiency summary.

A selected Knowledge Base powers the test chat on the right.

The most important visualization on a completed card is an ingestion
funnel, for example:

**184k source tokens → 42k relevant tokens → 13k synthesis tokens →
Sanity KB**

And beneath it:

**Jev avoided \~77% of candidate content being sent to the synthesis
model.**

Do not fake these numbers. Derive them from actual measured
characters/tokens/bytes and actual routing decisions.

### 3.4 Right: Test agent

A normal streaming chat interface grounded only in the currently
selected Knowledge Base.

Header:

**Testing: \[Knowledge Base name\]**

The agent should: - connect to the selected Sanity Knowledge Base
through Sanity Context MCP; - use the Knowledge Base retrieval tools
rather than stuffing the generated Markdown into its system prompt; -
answer from retrieved KB content; - indicate when the Knowledge Base
does not contain enough information; - optionally expose retrieved
entry/source references in a collapsible "Sources" section.

Include 3--4 suggested questions when a Knowledge Base first becomes
ready.

------------------------------------------------------------------------


## 3.5 Active build visualization: the Knowledge Map

The middle column should not primarily behave like a static list of cards while a Knowledge Base is being built. The **active build becomes a live knowledge map** that makes the ingestion and selection process visible.

This is inspired by the Jev visualization reference, but adapted specifically to Knowledge Base construction.

### Visual sequence

**1. Source discovery**

Each confirmed web source appears as a source node labeled with its domain/title.

**2. Reading and chunking**

As pages are processed, small nodes or clusters emerge around each source. These should represent real chunks or lightweight topic/group labels derived from actual pipeline state. Do not fabricate semantic structure merely for animation.

**3. Jev relevance evaluation**

As Jev evaluates material, the visualization shows the current candidate being considered. Nodes should visually encode the actual decision:

- retained/high relevance → becomes prominent;
- uncertain/borderline → remains visible but subdued;
- dropped/low relevance → fades substantially or disappears.

For an especially strong relevance result, temporarily expand/focus the concept, inspired by the Jev reference visualization. Example:

`MCP authentication — 97% relevant — KEEP`

This temporary focus gives the build rhythm and makes individual decisions legible.

Alongside the map, show a compact live inspector:

```text
EVALUATING

Server-side MCP authentication
and token permissions

Relevance: 94%
Decision: KEEP
Source: docs.example.com
```

Only show a numeric confidence/relevance percentage when the actual Jev integration provides a defensible numeric value. Otherwise show the real categorical/score output Jev provides.

**4. Knowledge formation**

Retained material should visually reorganize or concentrate into a smaller **knowledge core**. This represents the synthesis stage: many useful source fragments becoming a smaller set of coherent knowledge sections.

The visualization must not imply that Jev itself produces a semantic knowledge graph unless its real API does so. The graph/map is **our visualization of pipeline events and retained material**.

**5. Sanity Knowledge Base creation**

When synthesis is complete, the knowledge core transitions into a stable Sanity Knowledge Base object showing:

- Knowledge Base title;
- Sanity KB ID;
- source count;
- retained concepts/sections;
- build status;
- completion time.

Finished KBs then collapse into compact cards so the next active build can occupy the visual center.

### Quantitative layer

Keep the original ingestion funnel metrics, but make them secondary to the live map.

A compact strip below the visualization might show:

`128k candidate → 31k retained → 11k synthesized → Sanity KB`

Also show measured reduction, latency, and cost information where defensible.

The visualization and the numbers must be driven by the same real telemetry.

### Query-time continuity

The knowledge map remains useful after ingestion.

When the user asks a question in the right-hand Test agent, relevant areas of the completed knowledge map should light up based on the actual material retrieved through Sanity Context MCP.

This creates a continuous visual story:

**Build time:** “This is what entered the Knowledge Base.”

**Query time:** “This is what the agent is using from the Knowledge Base.”

Do not claim a precise mapping from retrieved Sanity entries back to original build nodes unless identifiers/provenance make that mapping real. If exact mapping is unavailable, highlight at the source/section level supported by actual retrieval metadata.


## 4. The core ingestion pipeline

The key architectural principle is:

> **Use expensive generative inference only after cheap relevance
> decisions have reduced the material.**

### Stage A --- Interpret intent

Use the primary LLM once to turn the builder conversation into a
structured `BuildIntent`:

``` ts
type BuildIntent = {
  title: string
  purpose: string
  topic: string
  userUrls: string[]
  suggestedUrls: string[]
  maxSources: number
  maxFetchedBytes: number
  maxCandidateTokens: number
  maxSynthesisTokens: number
}
```

Default `maxSources` to 3 for the public demo.

### Stage B --- Source discovery

If the user supplies a topic rather than URLs:

1.  search the public web using a server-side search provider;
2.  generate a small candidate set, e.g. 6--10 URLs;
3.  prefer primary/authoritative and information-dense sources;
4.  avoid duplicate domains where possible;
5.  choose approximately 3 sources;
6.  show them to the user before ingestion.

**Do not ask the LLM to browse arbitrary pages itself.** Discovery and
fetching should be explicit tools.

### Stage C --- Fetch and normalize

Fetch only public HTTP(S) pages.

For each source: - enforce allow/deny rules; - respect practical crawl
limits; - reject localhost/private-network destinations; - cap response
size; - use a short timeout; - extract the main readable text; - remove
nav/footer/boilerplate where practical; - preserve URL and page title; -
split into bounded semantic chunks.

Suggested initial chunk size: roughly 800--1,500 tokens with modest
overlap.

### Stage D --- Jev relevance gate

This is a first-class part of the product, not an implementation detail.

For each candidate chunk, ask Jev a constrained decision such as:

> Given the Knowledge Base purpose and topic, estimate whether this
> chunk contains information that should be retained for the Knowledge
> Base.

The result should be a small structured decision, not prose.

Conceptually:

``` ts
type RelevanceDecision = {
  keep: boolean
  confidence: number
}
```

Use a threshold and optionally a small "uncertain" band:

-   high relevance → keep;
-   low relevance → drop;
-   uncertain → either sample/escalate or keep if budget permits.

Record: - candidate input size; - chunks evaluated; - chunks retained; -
chunks dropped; - Jev latency; - Jev estimated/actual cost if exposed by
the provider; - tokens/bytes prevented from reaching the synthesis
model.

**Important:** confirm Jev's current official SDK/API and response
schema before implementation. Keep the Jev integration behind a tiny
adapter so an API change does not affect the rest of the app.

``` ts
interface RelevanceGate {
  evaluate(input: {
    purpose: string
    topic: string
    chunk: string
  }): Promise<{
    keep: boolean
    confidence?: number
    usage?: Usage
  }>
}
```

The app should be able to run a developer-only comparison mode with the
gate disabled so the demo can compare:

**without Jev** vs **with Jev**.

### Stage E --- Bounded LLM synthesis

Only retained chunks go to the synthesis model.

The synthesis goal is **not** to create a tiny summary. It should create
a compact but information-rich knowledge artifact that preserves useful
facts, distinctions, caveats, terminology, and source attribution.

Output Markdown with a predictable shape:

``` md
# [Knowledge Base title]

## Purpose
...

## Key concepts
...

## [Topic section]
...

## [Topic section]
...

## Important distinctions and caveats
...

## Sources
- [Title](URL)
```

The synthesis prompt should explicitly say: - preserve facts useful for
future question answering; - remove repetition and low-value prose; - do
not invent missing facts; - preserve disagreements instead of
arbitrarily resolving them; - retain source URLs; - stay within the
configured output budget.

For large retained inputs, use map/reduce: 1. synthesize bounded notes
per source or batch; 2. merge those notes into the final Markdown.

Never allow an unbounded recursive summarization loop.

### Stage F --- Create a real Sanity Knowledge Base

The current Sanity CLI documents programmatic commands for this
workflow, including:

``` bash
sanity context create --organization <org> --title "..." --description "..."
sanity context imports create <kb-id> --text "..." --title "..."
sanity context build <kb-id> --watch
```

For the prototype, implement a **server-side Sanity adapter** that
invokes the supported Sanity mechanism available in the deployment
environment. Prefer an official programmatic API/SDK if one is
documented and supported for the target environment; otherwise use the
documented CLI in a controlled server/worker process.

The generated Markdown should be imported as a **Markdown/text source**
into the newly created Sanity Knowledge Base, then the Knowledge Base
should be built.

Sanity currently documents Knowledge Bases as an opt-in beta, so isolate
this behind:

``` ts
interface KnowledgeBaseProvider {
  create(input: {
    title: string
    purpose: string
  }): Promise<{ id: string }>

  importMarkdown(input: {
    knowledgeBaseId: string
    title: string
    markdown: string
  }): Promise<{ importId: string }>

  build(input: {
    knowledgeBaseId: string
  }): Promise<{ status: string }>

  get(input: {
    knowledgeBaseId: string
  }): Promise<KnowledgeBaseStatus>
}
```

Do not invent undocumented REST endpoints.

### Stage G --- Query through Sanity Context MCP

Sanity Context MCP is the retrieval layer for the right-hand agent.

Current Sanity documentation supports Knowledge Base mode and selecting
a KB by public ID using the Context MCP configuration/query mechanism.

The test agent should connect server-side with a Sanity **organization
API token with Context Viewer permission**. Never expose that token to
the browser.

Conceptually:

``` text
User question
    ↓
Agent harness
    ↓
Sanity Context MCP
    ↓
Selected Sanity Knowledge Base
    ↓
Retrieved KB entries
    ↓
LLM answer
```

Sanity Context MCP is read-only and does not run the agent loop. That is
exactly why the separate harness exists.

------------------------------------------------------------------------

## 5. Recommended agent framework

### Recommendation for V1: Mastra

Use **Mastra** for the first implementation.

Reasons: - TypeScript-native, which fits a Next.js/React application; -
clear agent and workflow primitives; - native MCP/tool concepts; -
workflows are a good match for the deterministic ingestion pipeline; -
the right-side test experience can use an agent; - easy to keep the LLM
provider configurable.

Use the distinction deliberately:

**Ingestion = workflow.**\
The steps are known and should have hard limits.

**Testing = agent.**\
The question and retrieval path are open-ended.

### Eve

Eve is an attractive alternative and should be documented as an adapter
target. Its filesystem-first model --- instructions in Markdown, tools
in TypeScript, durable execution, sandboxed compute, subagents and evals
--- is particularly interesting for the open-source story.

Do not build two frameworks in V1.

### LangChain / LangGraph

Also viable, especially if broad ecosystem familiarity is important. It
is not necessary for the first demo.

### Keep the harness swappable

Do not spread Mastra-specific objects across UI/business logic.

Create:

``` ts
interface TestAgent {
  stream(input: {
    knowledgeBaseId: string
    messages: ChatMessage[]
  }): AsyncIterable<AgentEvent>
}
```

and:

``` ts
interface IngestionRunner {
  run(buildId: string): Promise<void>
}
```

Mastra implements these interfaces in V1. A later Eve or LangGraph
implementation should not require redesigning the application.

------------------------------------------------------------------------

## 6. Suggested technical stack

### Application

-   Next.js + TypeScript
-   React
-   server components/routes where useful
-   Tailwind CSS
-   a restrained component library if useful, but avoid generic
    dashboard aesthetics

### Agent/orchestration

-   Mastra for V1
-   LLM provider adapter supporting Anthropic or OpenAI
-   Sanity Context MCP for KB retrieval

### Ingestion

-   server-side fetcher
-   readability/main-content extraction
-   tokenizer or reliable token estimator
-   Jev adapter
-   bounded synthesis workflow

### Persistence

Use a small application database for **demo metadata only**. This
database is not the Knowledge Base.

Store: - build IDs; - Sanity KB IDs; - titles/purposes; - status; -
source URLs; - metrics; - timestamps; - error information; - optional
public session identifier.

SQLite is fine locally. For a public deployment, use a small hosted
Postgres-compatible store or equivalent.

The actual knowledge lives in **Sanity Knowledge Bases**.

------------------------------------------------------------------------

## 7. Data model

``` ts
type KnowledgeBaseRecord = {
  id: string
  sanityKnowledgeBaseId?: string
  title: string
  purpose: string
  topic: string
  status:
    | 'draft'
    | 'discovering'
    | 'awaiting_sources'
    | 'fetching'
    | 'filtering'
    | 'synthesizing'
    | 'creating_kb'
    | 'building_kb'
    | 'ready'
    | 'failed'
  createdAt: string
  updatedAt: string
  sources: SourceRecord[]
  metrics?: BuildMetrics
  error?: string
}

type SourceRecord = {
  url: string
  title?: string
  fetchedBytes?: number
  candidateTokens?: number
  retainedTokens?: number
  chunksTotal?: number
  chunksKept?: number
}

type BuildMetrics = {
  candidateTokens: number
  retainedTokens: number
  synthesisInputTokens: number
  synthesisOutputTokens: number
  jevCalls: number
  jevLatencyMs: number
  llmCalls: number
  elapsedMs: number
  estimatedCostUsd?: number
}
```

------------------------------------------------------------------------

## 8. API boundaries

Suggested application routes:

``` text
POST /api/build/intent
POST /api/build/:id/sources
POST /api/build/:id/start
GET  /api/build/:id
GET  /api/knowledge-bases
POST /api/chat
```

For build progress, use Server-Sent Events or a simple polling endpoint
first. Do not introduce WebSockets unless needed.

Example progress events:

``` ts
type BuildEvent =
  | { type: 'source.fetch.started'; url: string }
  | { type: 'source.fetch.finished'; url: string; tokens: number }
  | { type: 'jev.progress'; processed: number; total: number }
  | { type: 'jev.evaluation'; nodeId: string; label?: string; sourceUrl: string; decision: 'keep' | 'drop' | 'uncertain'; score?: number }
  | { type: 'knowledge.cluster.updated'; clusterId: string; nodeIds: string[]; label?: string }
  | { type: 'jev.complete'; retainedTokens: number; droppedTokens: number }
  | { type: 'synthesis.started' }
  | { type: 'synthesis.complete'; outputTokens: number }
  | { type: 'sanity.kb.created'; knowledgeBaseId: string }
  | { type: 'sanity.kb.building' }
  | { type: 'sanity.kb.ready' }
  | { type: 'build.failed'; message: string }
```

------------------------------------------------------------------------

## 9. Cost controls are product requirements

Because the public site may not require login, cost controls cannot be
an afterthought.

### Hard server-side limits

Start conservatively:

``` text
Max sources per build:             3
Max candidate URLs considered:    10
Max redirects per fetch:           3
Max page response:                 configurable, e.g. 2–5 MB
Max total extracted text/build:    configurable hard cap
Max candidate tokens/build:        configurable hard cap
Max synthesis input tokens:        configurable hard cap
Max synthesis output tokens:       configurable hard cap
Max concurrent builds/IP:          1
Max builds/IP/time window:         low
Fetch timeout:                     short
Overall build timeout:             bounded
```

Do not trust limits supplied by the browser.

### Public-demo abuse protection

Implement: - IP-based rate limiting; - anonymous session cookie; -
CAPTCHA/Turnstile only if abuse appears or before public launch; - SSRF
protection; - URL protocol allowlist (`http`, `https`); - DNS/IP checks
to block private and link-local networks; - content-type restrictions; -
maximum redirects; - model timeout/retry ceilings; - global daily spend
kill switch.

Add an environment variable such as:

``` text
DAILY_DEMO_BUDGET_USD=
```

When reached, disable new builds gracefully while keeping existing KBs
testable.

### No email for V1

Do not add an email gate initially. It distracts from testing the core
product. Add it later if needed for abuse prevention or lead capture.

------------------------------------------------------------------------

## 10. Environment variables

Names can change to match official SDKs, but centralize them.

``` bash
# LLM
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
SYNTHESIS_MODEL=

# Jev
JEV_API_KEY=
JEV_MODEL=

# Sanity Context / Knowledge Bases
SANITY_ORGANIZATION_ID=
SANITY_ORGANIZATION_TOKEN=
SANITY_CONTEXT_MCP_URL=

# Search
SEARCH_PROVIDER=
SEARCH_API_KEY=

# App
DATABASE_URL=
APP_BASE_URL=
DAILY_DEMO_BUDGET_USD=
MAX_BUILD_CANDIDATE_TOKENS=
MAX_BUILD_SYNTHESIS_TOKENS=
```

All provider secrets are server-only.

------------------------------------------------------------------------

## 11. Repo structure

``` text
knowledge-base-lab/
├── README.md
├── .env.example
├── package.json
├── app/
│   ├── page.tsx
│   └── api/
│       ├── build/
│       ├── knowledge-bases/
│       └── chat/
├── components/
│   ├── builder/
│   ├── knowledge-bases/
│   ├── test-chat/
│   └── shared/
├── lib/
│   ├── ingestion/
│   │   ├── discover.ts
│   │   ├── fetch.ts
│   │   ├── extract.ts
│   │   ├── chunk.ts
│   │   ├── relevance.ts
│   │   └── synthesize.ts
│   ├── providers/
│   │   ├── jev/
│   │   ├── llm/
│   │   ├── sanity/
│   │   └── search/
│   ├── agents/
│   │   ├── test-agent.ts
│   │   └── interfaces.ts
│   ├── workflows/
│   │   └── build-knowledge-base.ts
│   ├── db/
│   ├── limits/
│   └── telemetry/
├── prompts/
│   ├── interpret-intent.md
│   ├── synthesize-source.md
│   └── synthesize-final.md
└── tests/
    ├── ingestion/
    ├── security/
    └── e2e/
```

------------------------------------------------------------------------

## 12. Implementation phases

### Phase 0 --- Verify the external interfaces

Before writing app code, Claude Code must verify from current official
documentation:

1.  exact Jev API/SDK invocation and response shape;
2.  current Sanity Context CLI/API support for:
    -   creating a Knowledge Base;
    -   importing Markdown/text;
    -   starting/watching a build;
    -   reading status;
3.  current Sanity Context MCP connection pattern for a selected
    Knowledge Base;
4.  current Mastra MCP client/tool support.

Record findings in `docs/integration-notes.md`.

**Do not invent APIs to get past this phase.**

### Phase 1 --- Vertical slice

Make one hard-coded URL work end-to-end:

``` text
URL
→ fetch
→ extract
→ Jev filter
→ synthesize Markdown
→ create Sanity KB
→ import Markdown
→ build
→ ask one question through Context MCP
```

No polished UI yet.

This is the most important milestone.

### Phase 2 --- Three-column application

Build the one-page UI and connect it to the vertical slice.

Support: - topic; - direct URL; - suggested sources; - source
confirmation; - build progress; - KB selection; - test chat.

### Phase 3 --- Metrics / Jev story

Instrument the ingestion funnel.

Expose: - candidate tokens; - kept/dropped chunks; - retained tokens; -
LLM input/output; - elapsed time; - provider cost when available.

Make the value of Jev visible without making unsupported claims.

### Phase 4 --- Public-demo hardening

Add: - SSRF protection; - rate limits; - spend cap; - robust error
states; - deployment; - GitHub README; - sample Knowledge Bases.

### Phase 5 --- Optional framework comparison

Only after the app works: - add Eve as an alternative test-agent
adapter, or - publish a small branch/example showing the same Sanity
Context MCP-backed agent in Eve.

------------------------------------------------------------------------

## 13. Acceptance criteria

The prototype is complete when all of these are true:

-   A visitor can open the site without logging in.
-   A visitor can request a Knowledge Base by topic or public URL.
-   A topic request proposes approximately three sources.
-   The user can edit/confirm sources.
-   The server enforces a hard ingestion budget.
-   Jev is genuinely used to make chunk-level relevance decisions before
    expensive synthesis.
-   The UI reports actual pre/post-filter volume.
-   An LLM produces a bounded Markdown knowledge artifact.
-   Every completed item in the middle column corresponds to a unique
    **Sanity Knowledge Base ID**.
-   The Markdown artifact is imported into that Sanity Knowledge Base
    and built successfully.
-   Selecting a Knowledge Base changes the grounding used by the
    right-hand test agent.
-   The test agent retrieves from Sanity Context MCP in Knowledge Base
    mode.
-   No Sanity, Jev, search, or LLM secret reaches client-side
    JavaScript.
-   Private-network URL fetching is blocked.
-   Rate and spend limits exist.
-   Failed builds produce useful, recoverable UI states.
-   The repo can be cloned and run from a documented `.env.example`.
-   The README clearly explains what Jev, the synthesis LLM, Sanity
    Knowledge Bases, MCP, and Mastra each do.

------------------------------------------------------------------------

# Claude Code Handoff

## 14. Master instruction for Claude Code

Copy the following into Claude Code at the root of a new repository:

> Build the application described in this specification as an
> open-source prototype called **Knowledge Base Lab**.
>
> Start by reading this entire specification. Do not begin by generating
> a large amount of UI code.
>
> **First task:** verify the current official documentation for Jev,
> Sanity Context Knowledge Bases, Sanity Context MCP, and Mastra. Write
> `docs/integration-notes.md` with the exact supported integration
> mechanisms you intend to use. Do not invent endpoints, SDK methods, or
> response fields.
>
> Then implement the smallest end-to-end vertical slice: one public URL
> → extraction → Jev relevance filtering → bounded LLM synthesis →
> Markdown → unique Sanity Knowledge Base → Sanity build → one test
> question through Sanity Context MCP.
>
> Once the vertical slice works, build the three-column UI and
> generalize it to topics and approximately three sources.
>
> Architectural requirements:
>
> -   Next.js + TypeScript.
> -   Mastra for the V1 orchestration/agent harness unless current
>     documentation exposes a blocking issue.
> -   Ingestion must be a bounded workflow, not an unconstrained
>     autonomous agent loop.
> -   The test experience is an agent grounded through Sanity Context
>     MCP.
> -   Every displayed completed KB must correspond to a real Sanity
>     Knowledge Base.
> -   Jev must be used before the synthesis LLM as a relevance/decision
>     gate.
> -   Provider integrations must live behind small adapters.
> -   Never expose provider secrets to the client.
> -   Add SSRF defenses before allowing arbitrary public URLs.
> -   Add hard token/byte/source/time budgets.
> -   Instrument actual ingestion metrics so the UI can show the Jev
>     funnel.
> -   Do not create a separate vector database for knowledge retrieval.
> -   Do not substitute a home-grown RAG index for Sanity Knowledge
>     Bases.
> -   Keep the agent framework replaceable enough that an Eve
>     implementation can be added later.
>
> Work in small, testable milestones. After each milestone, run type
> checking and relevant tests. Maintain `TODO.md` with remaining work
> and `DECISIONS.md` with architectural choices.
>
> If an external beta API cannot support a required operation from the
> deployed app, stop and document the exact limitation and the narrowest
> viable workaround rather than faking the integration.

------------------------------------------------------------------------

## 15. First Claude Code milestone prompt

After Claude has initialized the repo, use:

> Implement Phase 0 and Phase 1 only. I want proof that the core
> architecture works before we spend time on visual design. Verify
> integrations, then make one hard-coded public URL flow all the way
> through Jev, synthesis, creation of a unique Sanity Knowledge Base,
> Markdown import/build, and a single question answered through Sanity
> Context MCP. Add enough logging to inspect token/volume reduction at
> the Jev step. Do not build the full UI yet.

Then:

> Now implement Phase 2. Build the three-column single-page experience
> from the spec. Preserve the working backend interfaces. The left side
> is builder chat/source selection, the middle is the Knowledge Base
> gallery/build visualization, and the right side is the test agent
> connected to whichever KB is selected.

Then:

> Implement Phase 3 and Phase 4. Make the Jev efficiency story visible
> using real measured metrics, then harden the anonymous public demo
> with SSRF protection, rate limits, hard budgets, graceful failure
> states, and a daily spend kill switch.

------------------------------------------------------------------------

# Claude Design Handoff

## 16. Design objective

Design this as a **live laboratory for constructing intelligence**, not
as another SaaS admin dashboard.

The interface has one core visual story:

**raw web → filtered signal → distilled knowledge → grounded agent**

The user should understand that transformation simply by watching a
build happen.

### Personality

Aim for: - technical; - crisp; - slightly experimental; - premium
developer-tool quality; - playful enough to make building a KB feel
immediate.

Avoid: - generic enterprise dashboard cards everywhere; - giant
gradients; - excessive glassmorphism; - "AI sparkle" clichés; - robot
imagery; - chat bubbles that dominate all three columns; - visually
pretending the Sanity KB is just another local database.

------------------------------------------------------------------------

## 17. Claude Design prompt

Give Claude Design this specification plus the following instruction:

> Design the UI for **Knowledge Base Lab**, a public developer demo that
> turns a topic or public websites into a real Sanity Knowledge Base and
> lets the user immediately test it with an agent.
>
> The desktop interface must be a single page with three columns:
>
> **LEFT --- BUILD**\
> Conversational builder. The user says what knowledge base they want.
> The system proposes sources as compact URL/domain cards. The user can
> remove/add sources and start the build.
>
> **CENTER --- KNOWLEDGE BASES**\
> This is the visual hero. It contains the KBs that have been created
> and shows the active build progressing through:
>
> `Fetch → Jev filter → Synthesize → Sanity KB`
>
> Make the data reduction tangible. For example, visually show a broad
> stream entering Jev and a narrower stream exiting it, accompanied by
> actual measured numbers such as candidate tokens and retained tokens.
> When ready, the card clearly displays that this is a real Sanity
> Knowledge Base and shows its KB ID.
>
> **RIGHT --- TEST**\
> A clean agent chat grounded in the selected KB. It should feel clearly
> downstream from the center column. Show which KB is active and make
> retrieved knowledge/source evidence inspectable without cluttering the
> main answer.
>
> The center should have slightly greater visual gravity than either
> chat panel.
>
> Design build states for discovering, fetching, filtering,
> synthesizing, creating in Sanity, building, ready, and failed.
>
> Create responsive behavior: on narrow screens the three areas become
> Build / Knowledge Bases / Test tabs.
>
> Use a restrained neutral palette with typography and motion doing most
> of the work. Sanity and Jev can have small labeled integration
> markers, but do not turn the page into a logo wall.
>
> The key "aha" moment is watching irrelevant source material disappear
> at the Jev step before the expensive LLM step.
>
> Produce: 1. page-level design; 2. component inventory; 3. all major
> states; 4. responsive behavior; 5. interaction/motion guidance; 6.
> tokens for spacing/type/radii; 7. implementation notes suitable for a
> React/Tailwind engineer.
>
> Prioritize legibility and a distinctive developer-tool aesthetic over
> decoration.

------------------------------------------------------------------------

## 18. Important visual component: the live Knowledge Map

The primary center visualization is a clustered, animated knowledge map.

Conceptually:

```text
       docs.foo.com
     ○ ○ ○ ○ ○ ○
      ○ ○ ○ ○
            \
             \       [ Authentication ]
              \        97% · KEEP
               ●──────────────┐
                              │
       blog.bar.com           ▼
       ○ ○ ○ ○          ┌───────────┐
        ○ ○ ○      →    │ KNOWLEDGE │
                        │   CORE    │
       api.baz.com       └───────────┘
      ○ ○ ○ ○ ○               │
                               ▼
                     SANITY KNOWLEDGE BASE
```

The real implementation should be organic and legible rather than diagram-like.

During Jev filtering:
- candidates can briefly become the visual focus;
- kept nodes remain/strengthen;
- dropped nodes fade;
- retained clusters progressively form the knowledge core.

Underneath, preserve a compact quantitative funnel:

```text
SOURCE MATERIAL       184k
        ↓
       JEV
        ↓
RETAINED               42k
        ↓
       LLM
        ↓
SYNTHESIZED             13k
        ↓
SANITY KNOWLEDGE BASE
```

Animate changes subtly and respect reduced-motion preferences. The visualization should summarize when there are too many chunks to draw individually; it must remain bounded even for the largest permitted build.

After completion, query-time retrieval can reactivate the map: areas supported by actual Sanity Context MCP retrieval metadata illuminate while the agent answers.

Do not use fake token counts, fake relevance scores, invented semantic relationships, or fabricated retrieval paths.

---

## 19. Open-source README story

The README should explain the stack in five lines before going deep:

``` text
1. You describe the knowledge you want.
2. The app finds/fetches a few focused public sources.
3. Jev cheaply decides what source material is worth expensive processing.
4. An LLM distills the retained material into a knowledge artifact that becomes a Sanity Knowledge Base.
5. A Mastra agent queries that KB through Sanity Context MCP.
```

Then show the architecture:

``` text
                  ┌──────────────┐
Topic / URLs ────▶│ Web discovery│
                  └──────┬───────┘
                         │
                         ▼
                  ┌──────────────┐
                  │ Fetch + chunk│
                  └──────┬───────┘
                         │
                         ▼
                  ┌──────────────┐
                  │     Jev      │
                  │ relevance    │
                  └──────┬───────┘
                         │ retained only
                         ▼
                  ┌──────────────┐
                  │     LLM      │
                  │  synthesis   │
                  └──────┬───────┘
                         │ Markdown
                         ▼
              ┌─────────────────────┐
              │ Sanity Knowledge Base│
              └──────────┬──────────┘
                         │ Context MCP
                         ▼
                  ┌──────────────┐
                  │ Mastra agent │
                  └──────────────┘
```

------------------------------------------------------------------------

## 20. Current integration facts to preserve

These points were checked against current public documentation while
preparing this spec:

-   Sanity Knowledge Bases are currently documented as an **opt-in
    beta**.
-   A Sanity Knowledge Base can use website, dataset, and file/text
    material as sources.
-   Sanity's current CLI documents `sanity context create`,
    `sanity context imports create`, and `sanity context build`.
-   The CLI's import command currently documents inline text, local
    files, website URLs, and Sanity dataset sources.
-   Sanity Context MCP can serve Knowledge Bases in Knowledge Base mode
    and select KBs by public Knowledge Base ID.
-   Sanity Context MCP is **read-only** and does **not** run the agent
    loop.
-   The Context MCP connection requires an organization-level token with
    the appropriate Context Viewer permission; keep it server-side.
-   Mastra currently provides TypeScript agent, workflow, tool and MCP
    primitives.
-   Eve is currently an open-source, filesystem-first agent framework
    with Markdown instructions/skills and TypeScript tools, and is a
    strong candidate for a later adapter.
-   Jev is intended here as the low-cost decision/relevance layer. Its
    exact official API contract must be verified at implementation time
    before coding the adapter.

------------------------------------------------------------------------

## 21. Decisions intentionally deferred

Do not block V1 on these:

-   user accounts;
-   email collection;
-   private sources;
-   PDFs/uploads;
-   GitHub ingestion;
-   editing generated Sanity KB entries;
-   collaborative KB management;
-   billing;
-   persistent chat history across browsers;
-   supporting all three agent frameworks;
-   production-grade multi-tenant isolation.

The first goal is a compelling, working demonstration of the pipeline.

------------------------------------------------------------------------

## 22. Source references used for this specification

Current Sanity documentation: -
https://www.sanity.io/docs/ai/sanity-context -
https://www.sanity.io/docs/ai/sanity-context-knowledge-bases -
https://www.sanity.io/docs/ai/sanity-context-create-knowledge-base -
https://www.sanity.io/docs/ai/sanity-context-source-types -
https://www.sanity.io/docs/ai/sanity-context-mcp -
https://www.sanity.io/docs/cli-reference/cli-context

Mastra: - https://mastra.ai/ai-agent-framework -
https://github.com/mastra-ai/mastra

Eve: - https://vercel.com/eve - https://github.com/vercel/eve

**Implementation rule:** external AI and Sanity interfaces are moving
quickly. Claude Code should treat the links above as starting points and
re-check official documentation before locking in an adapter.
