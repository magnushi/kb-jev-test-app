# Development log

What we did, what we measured, and what we got wrong. Newest section last.

Three other documents carry the durable versions of this:
`docs/integration-notes.md` for verified API contracts, `DECISIONS.md` for architectural
choices, `TODO.md` for what is left. This file is the narrative — the findings and the
reasoning that would otherwise be lost.

---

## September 25–26 — Phase 0: verify before building

The spec said to verify every external interface against current documentation before
writing app code. We went further and verified against the **live APIs**, which turned
out to matter: the documentation was wrong or incomplete in four places.

### Jev

TypeSafe's System One model, reached directly rather than through OpenRouter (OpenRouter
access was unavailable; the direct API is the same model).

The **Noul** primitive is exactly the relevance gate the spec describes: a yes/no
question returning a calibrated probability 0–1, with no separate confidence field
because a binary distribution is fully described by one number.

**The finding that shaped the pipeline:** Jev processes `state` once and evaluates every
question against it **in parallel**. So one request carries the knowledge base purpose as
state and one Noul per chunk. Measured: 6 chunks, one call, 632 input tokens, ~$0.00003,
sub-second.

That made chunk-by-chunk animation a presentation choice rather than a consequence of
the network, which the design brief explicitly permits.

### Anthropic

`claude-opus-5-5` existed and the model table we had cached did not list it — it had
shipped four days earlier. Checking the live Models API rather than answering from
memory was the only reason we caught it.

Also replaced the search provider. Tavily was the plan; Anthropic's own
`web_search_20260209` needs no extra account or key and bills to a key we already had.
It is used for **discovery only** — URLs and snippets — with our own fetcher doing the
fetching, so the rule against letting the model browse still holds.

### Sanity Context — the big one

The docs document a CLI and say nothing about an HTTP API. But `@sanity/cli` turned out
to be a thin wrapper over a **first-class typed namespace in `@sanity/client`**:

```ts
client.context.knowledgeBases.create / list / get / edit / delete
client.context.imports.create · build() · jobs.get()
```

That removed the need to bundle a CLI or run a separate worker. The whole pipeline
became "anywhere Node runs".

A guessed REST path 404'd during this. Lesson applied repeatedly afterwards: **use the
client, don't invent URLs.**

### What Phase 0 cost us, and saved us

One probe — create a knowledge base, import, build, delete — surfaced a 403:

```
Creating a knowledge base requires the 'sanity.knowledge-base.create' grant
```

No robot token could create a knowledge base. Had we not probed, that would have
appeared the first time a visitor tried to build one on a deployed demo, looking like a
pipeline bug rather than a one-word permissions fix. Magnus raised it with the Context
team; a **Developer** role shipped within days.

---

## September 27–29 — Phases 1 and 2

### The vertical slice

URL → fetch → extract → chunk → Jev → Opus → real Knowledge Base. First complete run:
`state=ready` in 184s for $0.13.

The nine build stages Sanity exposes — `tldr → map → triage → plan → organize → arrange
→ write → review → polish` — turned out to be real telemetry we could show, which later
became the centrepiece of the build-phase design.

### Extraction was quietly broken

A 254KB page yielded only ~2.3k tokens of prose, and one chunk was sidebar reference
content. Replaced the regex extractor with Mozilla Readability over linkedom.

**The subtle bug inside that fix:** using `article.textContent` concatenates block
elements with no separator, producing `"Build with AILast updated September 3"`. That
silently corrupts chunking — chunks begin mid-word and Jev judges nonsense. Flattening
`article.content` with block boundaries preserved fixed it.

### The UI

Three columns, canvas knowledge map, design tokens, both themes, responsive to 400px.

**The decision that matters most:** map state is folded from the **persisted event
stream**. Every number on screen comes from one source, so the picture and the figures
cannot disagree, and a mid-build reload replays rather than blanking. Tests pin that
property down.

### A defect that would only have appeared in production

Builds were started from an API route with a floating promise. That works under a
long-lived `next start` and fails completely on Vercel, where the function is torn down
as soon as it responds. Moved the pipeline into a **Sanity Function** (900s budget,
triggered by the build record's creation), with a scheduled reconciler for builds that
outlive it or die mid-pipeline.

Durable Functions would fit better — `step.waitForCondition` polls without holding a
function open — but `defineDurableFunction` is marked "not available publicly yet".

---

## September 30 — Testing found what review did not

Magnus ran the app and hit something no amount of code review would have caught:
**"I describe the problem and press send, but then suddenly it asks me to do it again."**

Two causes, both invisible from the code:

1. `/api/build` runs intent extraction *and* a web search — up to a minute — with no
   visible change once the composer cleared.
2. New messages appended below the fold, leaving the opening prompt on screen.

The state existed in the code and was invisible on screen, which is indistinguishable
from broken. Fixed with a thinking indicator, auto-scroll, and a composer that disables
itself and says which state it is in.

### Fabricated numbers

Every synthesized section displayed `26` source chunks. Synthesis is one call over all
retained material, so there is no per-section attribution — we were attaching the whole
set to every heading and rendering it as telemetry. Removed the count and its column.

Real provenance will come from the Sanity outline's citations, which do exist.

---

## September 30 — The design loop

Wrote `BUILD_PHASE_BRIEF.md` for Claude Design covering the 2–5 minute Sanity build,
which showed one lowercase word in a footer. They returned 18 states.

Reviewed it **against live data** rather than against the brief, which produced six
corrections:

| Finding | Consequence |
|---|---|
| The outline reads from `entries.list()` | States 12–15 need no MCP endpoint — buildable immediately |
| Entries carry a real `title` | No humanizing; the "Openrouter" casing bug disappears |
| `centrality` has **three** values | The design's core/peripheral binary missed `standard`, the common case |
| `tldr.neighbors` empty on every entry | The related arcs would never draw |
| `tldr.excludes` populated and unused | A better source of connections than the empty one |
| Paths were flat in our sample | Suggested grouping by tier instead of path |

Design took all six and shipped revision 2.

### Two things I got wrong, both corrected in writing

**`openIssueCount` does not disagree with `issues.list()`.** I read it moments after the
build finished, before it populated. Both report 4. That mistake put Design's conflict
copy on hold for no reason.

**Paths are not usually flat.** I generalized from one build. Magnus's Amazon build
produced `refunds/methods_and_timing`, `third_party_sellers/returns` and so on. The
tier-grouping fix still works — the renderer handles both — but the rationale was wrong.

Both corrections went back to Design rather than being left to stand.

### Blockers that weren't

Magnus pushed back on "the MCP endpoint has to be made in the UI". The client exposes
`mcpEndpoints` read-only and the CLI has no command for it — but a Sanity CI failure
months earlier had leaked `POST /mcp` with `mcpEndpointManageAccessDenied`. That route
exists:

```
POST /v2026-08-25/context/organizations/:orgId/mcp  →  201
```

Stage G was verified minutes later. **Two separate "you must use the Dashboard"
blockers turned out to be undocumented endpoints**, both found in error messages rather
than documentation.

`tools/list` also returns a third tool the docs do not list: `knowledge_base_search`.

---

## September 30 — Conflicts

A build flags contradictions between sources. Ours had four, all `critical`, and the
knowledge base sat in `review`.

Walked through each one. The result argued against automation more clearly than any
principle would have:

- **One** was a real error (the entry claimed encryption relies on *factoring* large
  primes; it relies on factoring their *product*)
- **Two** were vendor framing versus accurate statement
- **One** was a false positive — the `misconceptions` entry documenting a source's
  imprecision, read as disagreement

Three wanted the existing claim and one wanted the new one. **A blanket rule would have
been right three times and wrong on the only genuine error.**

### What we built instead

Sanity's own `suggested` side first, Jev second, leave it open third. Jev must be
confident (≥0.7) **and** clearly ahead (≥0.2 margin), because each resolution writes a
standing instruction into every future build.

Validated against the four human decisions: **agreed on three (0.77–0.95), declined the
fourth** — which was the one where both claims were defensible and the real answer was
"these sources use different words for the same physics", something `resolve` cannot
express. The threshold working, not failing.

### An API bug worth reporting

`resolution` is an **index into `content.sides`**. `@sanity/client` types it as
`'keep_existing' | 'accept_new'` and the server rejects both with *"expected number,
received string"*. An out-of-range index returns a self-contradictory error: *"Issue … is
a 'conflict' — only conflict issues can be resolved"*, about a conflict.

---

## October 1 — The funnel, measured

Two real builds, independently:

```
Amazon:   2,898 candidate →  2,898 kept  (0% withheld) → 4,684 synthesized
Quantum:  8,800 candidate →  8,800 kept  (0% withheld) → 8,266 synthesized
```

Two problems. Synthesis **expands** rather than compresses, so the third bar renders
longer than the first — an inverted funnel. And Jev withheld nothing.

### The diagnosis was wrong twice before it was right

First guess: bad sources. Wrong — scores ran 0.67–0.98, so nothing came near the drop
threshold.

Second guess: our thresholds. Partly right — we keep anything above 0.2, so "uncertain"
always survives. But raising the bar would not help, because the scores are honestly
high.

**The real answer: the question was too easy.** Asking "is this relevant to a knowledge
base about quantum computing?" of a chunk from a NIST page about quantum computing gets
a correct yes every time.

### So we measured a better question

Two Nouls per chunk — relevant **and** substantive, where substantive means specific
citable facts rather than framing, navigation or promotion. Both ride in the same
request, so it costs nothing extra.

```
rel   sub
0.58  0.40  DROP  "Credit:"                                  ← image credit
0.48  0.73  DROP  "When studying quantum computers, it is…"  ← framing
0.93  0.96  keep  "These capabilities give quantum computers…"
…
old withheld 0%  ·  new withheld 10%
```

It drops genuine filler. It finds 10%.

### The honest conclusion

**The token funnel cannot be made dramatic on well-chosen, well-extracted sources,
because there is genuinely little to throw away.** More tuning will not change that, and
anything producing a big number would mean leaving rubbish in deliberately.

The true, striking, measured number is cost asymmetry:

```
Jev:   23 chunk decisions + source selection   $0.0007
Opus:  synthesis of what survived              $0.26
```

**Jev decides everything Opus is allowed to see for 0.3% of what a build costs.** That is
the spec's own argument — use expensive inference only after cheap decisions. The
reduction was only ever the proxy we chose to display it with.

Jev does perform one large visible reduction: **8 candidate sources → 3 chosen**, which
is a real decision it makes before a page is fetched.

---

## Things this project kept teaching

**Verify against the live API, not the docs.** Four separate things were documented
wrongly or not at all: the Context client surface, the MCP endpoint route, the issue
resolution parameter, and a third MCP tool. Every one was found by making a real call.

**Error messages are documentation.** Both undocumented routes were found in 403 text —
one of them in a CI failure from a different team months earlier.

**A probe is cheaper than a deployment.** The permissions gap, the Vercel defect and the
extraction bug would all have surfaced in production and looked like different problems
than they were.

**Numbers on screen must come from one source.** Two separate fabrications — the `26`
chunk counts and the inverted funnel — came from displaying something the pipeline had
not measured. The event-stream fold exists to make that structurally impossible.

**Correct yourself in writing.** Two findings sent to Design were wrong. Both were
corrected in the same document rather than quietly, because they had already changed
what Design was building.
