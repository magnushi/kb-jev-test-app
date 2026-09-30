# Knowledge Base Lab: the build phase

**For:** Claude Design
**From:** Magnus Hillestad (Sanity), with Claude Code
**Date:** September 30, 2026
**Status:** Follow-up to `DESIGN_BRIEF.md`. The app is built and working; this brief
covers one phase that is under-designed.

Read `DESIGN_BRIEF.md` first — it still governs everything else, and its design
principles (§2) apply here unchanged. In particular rule 5: **never fake a number.**

---

## 1. The problem

The pipeline now works end to end. A visitor describes a knowledge base, three sources
are found and fetched, Jev filters chunk by chunk, Opus synthesizes, and a real Sanity
Knowledge Base is created and built.

The Jev step is excellent: 30+ chunks resolve in well under a second, most of them
visibly dropped, and the funnel reads exactly as intended.

**Then the screen goes quiet for two to five minutes.**

Sanity's own build runs after ours — reading the synthesized material, building a topic
tree, writing entries, and checking them. It is the longest single phase in the product
and currently shows one lowercase word in a footer line:

```
Sanity KB kb6bKVNJrPZx · organize
```

Users read that as broken. The first real tester's words: *"it asks me to do it again."*

There are actually **two** problems here, and they want different answers:

1. **Make the wait legible.** Two to five minutes with almost no signal.
2. **Make the reveal worth waiting for.** What the build produces is far richer than
   what we currently display, and we are discarding most of it.

The second is the bigger opportunity. We would rather you spent effort there.

---

## 2. What is actually true (design against this, not around it)

Everything below is verified against the live API. Nothing here is aspirational.

### 2.1 During the build

Sanity exposes nine real, ordered stages:

```
tldr → map → triage → plan → organize → arrange → write → review → polish
```

Each carries a status. A build we timed:

```
t+15s   stage —            (nothing started yet)
t+30s   stage map
t+45s   stage plan
t+60s   stage organize
t+75s   stage organize
t+90s   stage arrange
t+105s  stage write
t+120s  stage review
t+135s  stage polish
```

Note the shape: **stages are wildly uneven**, some repeat across polls, and one build ran
318 seconds while another finished in 135.

Also available: `isBuilding`, `activeJobId`, `openIssueCount`, `sourceUsage {used, limit}`.

**Two things to know:**

- **`state` is not a progress signal.** It stayed `created` for an entire 300-second
  build and only flipped at the very end. Observed values: `created`, `ready`, `review`
  (that last one on a knowledge base with an open issue). Treat `state` as the
  *outcome*, and `buildStageState` as the *journey*. They are two different UI slots.
- **"Queued" is real and detectable.** `isBuilding: true` with no stage begun is the
  pre-stage window, which can last a long time — one internal tester sat in it for 20
  minutes. It deserves its own honest label rather than a spinner pretending to progress.

### 2.2 After the build — the part we are wasting

When the build finishes, the knowledge base exposes a genuine outline. This is the real
artifact, and it looks like this:

```
## Acme product knowledge — Product specs, shipping, and support policies
4 entries.

products/latex/gloves [core]
  Glove grades, sizes, and what each is rated for
  topics: Grades, Sizing, Ratings

products/latex/industrial [peripheral]
  Industrial latex specs and tolerances

shipping/import-routes
  Customs paperwork and lead times by region
  related: support/returns

support/returns
  Return windows, exceptions, and who pays the freight
```

Four things in there we currently throw away:

| What | Why it matters |
|---|---|
| **Slash-delimited paths** | A real hierarchy. We currently show a flat list. |
| **`[core]` / `[peripheral]` tags** | Decided **by the purpose the user wrote.** |
| **A one-line summary per entry** | Written by Sanity from the sources, not guessed by us. |
| **`related:` cross-links** | Real edges between entries. An honest graph. |

The `[core]` tag is the most interesting thing in this brief. The purpose sentence typed
into the **left** column determines which entries come out core in the **right** column.
That is a genuine causal chain running the width of the page, and nothing in the current
design shows it.

What lane 3 shows today is headings scraped from our own synthesis output — our *guess*
at the structure. The outline is the actual structure.

---

## 3. Problem one: make the wait legible

Goal: a visitor who looks away and comes back can tell, in one glance, that work is
happening, roughly how far along it is, and why it takes this long.

Directions worth exploring — combine freely:

**Show all nine stages at once.** The value is not animation, it is horizon. One word
tells you nothing; nine words with six struck through tells you everything. Include
`queued` as a real first state.

**Build the knowledge core the original spec asked for.** `DESIGN_BRIEF.md` §3.5 called
for retained chunks to "visually reorganize or concentrate into a smaller knowledge core"
and it was never built. Kept chunks currently sit in lane 1 looking exactly as they did
during filtering. This phase is when they should migrate across the Jev divider and
coalesce. The motion is *our visualization of pipeline events*, which the spec explicitly
permits — it is not a claim about Sanity's internals.

**Surface conflicts as they are found.** The build detects contradictions between sources
and raises issues. Nobody else's pipeline tells you your sources disagree. A count
appearing during `review` is true and genuinely interesting.

**Give each stage its own behaviour.** One generic shimmer across nine stages wastes the
material, because the stage names mean different things: `map` is reading, `triage` is
grouping, `organize`/`arrange` is restructuring, `write` is producing, `review` is
checking. Ambitious, but each beat maps to something real.

**Frame the wait rather than hiding it.** Something like: *"Jev decided in 0.5s. Opus
wrote in 40s. Sanity is now indexing — this is the slow part, and it costs nothing."*
Honest framing makes a long wait feel deliberate instead of broken, and it lands the Jev
story a second time at the exact moment the user has nothing else to do but read.

---

## 4. Problem two: make the reveal worth waiting for

This is where we would most like your thinking.

When the build lands, lane 3 should stop being a list of our headings and become **the
real outline**: the tree, with core entries carrying visual weight, peripheral ones
recessed, each entry's one-line summary available, and `related:` drawn as actual edges.

Questions we do not have good answers to:

- How should a tree of 4 entries and a tree of 40 both read well in a 360px-tall panel?
- How should `[core]` versus `[peripheral]` be expressed? Weight, size, position,
  proximity to a centre? It should feel like *centrality*, not like a badge.
- Should `related:` edges be always on, on hover, or only during retrieval?
- Should the transition from "chunks and sections" to "the finished outline" be a
  reveal, a morph, or a replacement? It is the emotional peak of the product.
- Is the outline still a *map*, or does it become something else once it is real?

### Query-time continuity

The retrieval tool takes entry paths **verbatim from the outline**. So when the test agent
answers, we know exactly which entries it read — not inferred, exact. That satisfies the
provenance rule in `DESIGN_BRIEF.md` §6.1 with no hedging, and it means the completed
outline can light up precisely during an answer. Worth designing for deliberately.

---

## 5. Constraints

Rule 5 of the original brief bites hardest in this phase.

- **No invented percentages.** Stage index is real; stage duration is not, and they are
  very uneven. A bar stalling at 80% is worse than no bar.
- **No entry names before they exist.** Entries appear to be unreadable mid-build, so
  assume we have nothing real to show in lane 3 until it completes. Design the finished
  state as a genuine arrival.
- **Do not imply Jev built the index.** It filtered the input. Sanity built the index.
  Conflating them oversells Jev and undersells Sanity.
- **Reduced motion must still be legible** as a final state.
- **Bounded.** Must hold for the largest permitted build without overflowing.

---

## 6. Not asking for

- Changes to the header, the left column, or the list page.
- A second accent colour, status pills, or stat tiles. One accent, plain text.
- Anything that needs data we do not have. If an idea needs something new, flag it and
  we will check whether it exists.

---

## 7. Open questions we are still resolving

1. Whether `openIssueCount` increments during the build or only lands at the end. We poll
   every 10 seconds and will know after the next real build.
2. Whether the outline is readable mid-build. Assume not; treat any mid-build access as a
   bonus.
3. Per-stage timings, which would allow honest estimates. Not available today, and we are
   **not** asking for time estimates in this round — stage state only.

---

## 8. What to produce

1. The build phase, all states: queued, each of the nine stages, failed, and the
   transition into ready.
2. The finished outline in lane 3: hierarchy, core/peripheral, summaries, related edges.
3. The transition between them.
4. Query-time highlighting of retrieved entries.
5. Motion guidance, and the reduced-motion equivalent.
6. How all of it behaves at 900px and 400px.
7. Notes for a React/Tailwind engineer. Lane 3 is currently drawn on a canvas that reads
   its colours from the CSS tokens; say if you want that to change.

Same tokens, same restraint, same one-label-per-panel discipline as the original brief.
The centre column already has the most visual gravity — keep it there.
