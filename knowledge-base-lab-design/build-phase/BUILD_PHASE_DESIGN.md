# Knowledge Base Lab: build phase design

**For:** Claude Code (the agent building the app)
**Answers:** `../BUILD_PHASE_BRIEF.md`
**Date:** September 30, 2026
**Status:** Proposed design, reviewed by Magnus in mockup form. Ready for implementation review.

`../DESIGN_BRIEF.md` still governs everything else, including its rules: one label per panel, one accent colour, plain-text status, never fake a number. This document only covers the middle column from the end of synthesis to the finished outline.

Files in this folder:

- `build-phase-mockups.html`: clickable mockup of the middle column in 18 states, with notes per state. Open it in a browser. It has a Play button and toggles for width (desktop / 900px / phone), outline size (10 / 40 entries) and motion (full / reduced). **All content is sample data.**
- `screenshots/`: every state at desktop width, key states at phone width (`phone-*`) and in dark mode (`dark-*`).

---

## 1. Summary

| Problem in the brief | Answer |
|---|---|
| The 2–5 minute wait reads as broken | A **stage line** under the map showing `queued` plus all nine Sanity stages at once (done = struck through, current = underlined with a pulsing dot). An **elapsed clock** in the status. A **framing line** with Jev's and Opus's measured times. |
| Kept chunks just sit there | The **knowledge core**: at synthesis the kept chunks cross the Jev divider into lane 3 and pack together. Each Sanity stage gets its own motion on the core, with a caption saying the motion only illustrates the stage. |
| Conflicts are invisible | During `review`, "1 conflict between sources found" in plain text, and one row is ringed. |
| The reveal throws away the real structure | When the build lands, lane 3 is **replaced by Sanity's outline**: a path tree, core entries first and heavy, peripheral lighter with summaries on hover, `related:` drawn as arcs. |
| `[core]` shows no cause | A line above the tree quotes the **purpose from the left column**: "Core means central to your purpose: …". |
| Query-time continuity | Rows the agent read (exact paths from the retrieval tool) get the accent tint and a "read" label; the question sits above the tree. |

## 2. States

Numbers match the screenshots.

### Handoff

**01 Synthesizing.** Kept and borderline squares leave lane 1, cross the Jev divider and pack into a compact block in lane 3. Dropped squares stay in lane 1 with the per-source tally, which now reads "8 kept →". Lane 3's header changes from "3 Knowledge Base" to **"3 Knowledge core"** until the outline arrives. Status: `synthesizing`. Below the map: "Opus is writing 20 kept chunks into Markdown" and "Jev decided in 0.5s. Next, Sanity builds the index."

### Sanity build

The area below the map holds three lines during the whole build:

1. **Stage line**: `queued tldr map triage plan organize arrange write review polish`. Done stages are muted and struck through, the current one is ink, 600 weight, with a 2px accent underline and a pulsing 6px accent dot. Pending stages use `--line-2`. It wraps to two or three lines on narrow widths.
2. **Status**: "Sanity · organize · organizing topics · 1:31 elapsed". Queued reads "Queued at Sanity · waiting for a build slot · 0:42 elapsed".
3. **Framing**: "Jev decided in **0.5s**. Opus wrote in **38s**. Sanity is building the index now; this is the slow part." Both numbers must be measured (`jevLatencyMs`, and synthesis start to complete).

The name row status reads `queued · 0:42` or `building · 1:31` in accent.

In lane 3, under the core, a caption: the stage's meaning in 12px ink ("Organizing topics"), then in muted text: "Motion shows the stage. Entries appear when Sanity finishes."

| # | Stage | Core visual | Caption |
|---|---|---|---|
| 02 | queued | Core still, at ~45% opacity. **Nothing moves.** After 2 minutes, add a line: "Queues can take several minutes. The knowledge base will appear in the list when it's done." | Waiting for a build slot at Sanity |
| 03 | tldr | A single summary line draws beneath the core (once, ~1.5s) | Summarizing the material |
| 04 | map | A scan line sweeps across the core; squares it passes get an ink ring (loops, 2.2s) | Reading through the material |
| 05 | triage | Squares regroup into clusters, one per synthesized section | Grouping related material |
| 06 | plan | A root dot appears above the clusters; lines draw from it to each (once, ~1.2s) | Planning the topic tree |
| 07 | organize | Clusters swap places under the root (one change every 1.5s, loops) | Organizing topics |
| 08 | arrange | Clusters slide into rows under the root, like a tree skeleton, with no labels | Arranging entries in the tree |
| 09 | write | Each row grows a text-line bar, staggered (once, ~2s) | Writing entries |
| 10 | review | A check sweep runs down the rows (loops, 1.6s); rows it passes keep a check. If `openIssueCount > 0`: "1 conflict between sources found" above the caption and a ringed "!" on one row | Checking entries against the sources |
| 11 | polish | Everything checked and still | Final pass |

The clusters use **our own synthesis sections**, which are real but ours. Nothing in lane 3 claims to be one of Sanity's entries until the outline arrives.

**Stage repeats.** If a poll returns the same stage (organize often does), keep showing it; the loop continues and nothing new is claimed.

**Stage meanings.** The captions are our reading of Sanity's stage names. Confirm them with the Sanity Context team before shipping.

### Arrival

**12 Reveal.** Triggered when `state` flips to `ready` (or `review`). Fetch the outline once, then:

- the canvas fades out (450ms);
- the outline fades in, rows arriving top to bottom: purpose line, group headings, core entries, peripheral entries (each 420ms, 40ms apart, sliding 10px from the left);
- all `related:` arcs draw once, stay ~1.6s, then clear to hover-only;
- status: "ready · built by Sanity in 2:18" (elapsed time of Sanity's build, measured);
- the column button changes from "Skip to end" to "New build".

**13 Outline at rest.** Lane 3 is now the whole map area (360px, scrolls inside):

- Header row: "Outline · **10** entries · 7 core" on the left, a small segmented control **Outline | How it was built** on the right. "How it was built" shows the canvas again with its legend.
- Purpose line: "Core means central to your purpose: “[purpose from the intent card]”".
- Tree grouped by path: the first segment is a group heading in mono (`jev/`); further segments are indented subheadings (`primitives/`); the last segment is the entry.
- **Core entries**: 8px filled accent marker, name at 13px/600 ink, one-line summary below at 12px `--ink-2`, always visible. Core entries come first within each group.
- **Peripheral entries**: 8px hollow marker (`--line-2`), name at 12.5px/500 `--ink-2`, summary only on hover or focus.
- Right edge: "↔ 2" (mono, muted) when an entry has related entries.
- The legend below the map changes to: core to your purpose · peripheral · ↔ related entries.

**14 Hover or focus an entry.** The row gets a `--surface` background, topics and related paths appear under the summary, related entries get a ringed marker, and arcs draw in the left gutter between them. Keyboard focus does the same; every row is a button.

**15 40 entries.** Same 360px. Core entries always show. When a group has more than three peripheral entries, they fold into a "+ N peripheral" row that expands on click. The list scrolls inside the map area.

**16 Answer highlights entries.** When the test agent answers, the question appears above the tree in an accent-soft bar ("Read by the test agent for “…”"). Rows whose paths the retrieval tool used get an accent-soft background and a "read" label before the related count, and the first one scrolls into view. Arcs draw between read entries that are related. It clears when the next question starts.

**17 Ready with an open issue.** `state: review`. Status reads "ready · 1 issue to review". A plain line above the tree: "Sanity flagged **1 conflict between sources**. It stays testable." Testing is not blocked.

### Failure

**18 Failed at write.** All motion stops where it was. The stage line shows the failed stage in ink followed by "· stopped". Below: "Sanity's build stopped at write after 1:52." with a primary **Try again** button. Lane 3 caption: "Stopped while writing entries / The core is kept. Try again restarts only Sanity's build."

## 3. Data needed

Everything here is from the brief's verified list except where marked.

| UI | Source | Notes |
|---|---|---|
| Stage line, current stage | `buildStageState.stages[]` (`id`, `status`) | Current = first stage not `done`. Failed = a stage with failed status, or the job ending without `ready`. |
| Queued | `isBuilding: true` and no stage started | Its own state, not a spinner. |
| Elapsed clock | Client clock from `sanity.kb.building` (first poll) | The only time shown. No estimates. |
| Framing numbers | `jevLatencyMs`; synthesis duration | **Check:** synthesis duration may need timestamps added to `synthesis.started` / `synthesis.complete`. |
| Conflict count | `openIssueCount` | **Check:** whether it increments during review or only at the end. If only at the end, show it in the ready state (17) only. |
| Outcome | `state` (`created` → `ready` / `review`) | Outcome only, never progress. |
| Outline | path, `[core]`/`[peripheral]`, summary, `topics`, `related` | Fetch once at ready. |
| Entry names | Last path segment, humanized (`import-routes` → "Import routes") | **Check:** if the API exposes a title, use it. Humanizing loses casing ("Openrouter"). |
| Read entries | Retrieval tool's entry paths | Exact, verbatim from the outline. |
| Try again | Re-run `sanity context build <id>` only | **Check:** confirm this works without re-running Jev and synthesis. |

Suggested additions to `components/knowledge-map/types.ts`:

```ts
type BuildStageId = 'tldr'|'map'|'triage'|'plan'|'organize'|'arrange'|'write'|'review'|'polish'

type OutlineEntry = {
  path: string            // "api/openrouter"
  tier: 'core' | 'peripheral'
  summary: string
  topics: string[]
  related: string[]       // paths
  title?: string          // if the API provides one
}

type MapState = {
  // …existing
  phase: 'idle'|'fetching'|'filtering'|'synthesizing'|'creating'|'queued'|'building'|'ready'|'failed'
  buildStages?: {id: BuildStageId; status: string}[]
  buildStartedAt?: number
  synthesisMs?: number
  openIssueCount?: number
  outcome?: 'ready' | 'review'
  outline?: OutlineEntry[]
  readPaths?: string[]    // set per test answer
}
```

## 4. Motion

**Character: mostly still.** Motion plays when something real changes; most of a long build is a still picture with a pulsing dot and a running clock.

- **On state change (once):** chunk migration into the core (~0.5–0.7s, eased), regrouping at triage/plan/arrange, tldr line (1.5s), plan lines (1.2s), write bars (~2s staggered), reveal (canvas fade 450ms, rows 420ms each, 40ms apart), arcs on arrival (~1.6s then clear).
- **Continuous:** the pulsing dot on the current stage (1.4s), and gentle loops in three stages: the map scan (2.2s), organize swaps (every 1.5s), and the review sweep (1.6s).
- **Calmer option (Magnus may prefer it):** drop the three loops so the only continuous motion is the pulsing dot. Long stages then show a still picture; the dot and clock still show it's working.
- **Reduced motion:** every state renders its final picture instantly (all checks shown, all bars full, no scan or sweep), the dot doesn't pulse, and the reveal is a straight swap.
- **Mockup differences:** the notes mention "one soft shimmer" at polish, but the mockup doesn't implement it and it's optional. Hover arcs appear instantly in the mockup; 200ms is fine in production.

## 5. Responsive

- **900px** (middle column ~400px): same layout; the stage line wraps to two lines; the token strip wraps.
- **Phone** (~368px): lanes stay side by side with 9px squares. The source tally moves under the domain name (fixes the overlap noted in `DESIGN_BRIEF.md`). The stage line wraps to three lines. Captions wrap to three lines. The outline is full width and scrolls inside the map area.

## 6. Engineering notes

- **Keep the canvas for lanes 1–3 during the build.** The chunk migration, clusters and stage motion are all drawn from one state, re-reading colours from the CSS tokens on theme change, as today.
- **Render the finished outline in the DOM, not on the canvas.** It's text-heavy, needs scrolling, hover, keyboard focus and screen-reader access. Overlay it on the canvas area and cross-fade. Draw the `related:` arcs as an absolutely positioned SVG in the outline's left gutter, computed from row offsets.
- **"How it was built"** toggles back to the canvas and swaps the legend.
- **Bounded:** outline scrolls inside 360px; peripheral entries fold per group above three; clusters are capped by the number of synthesis sections.
- **Tokens:** no new colours. Accent for current, kept, core and read; `--ink` for the conflict mark; neutrals for everything else.

## 7. Acceptance checklist

- [ ] Queued is its own state with nothing pretending to move.
- [ ] Stage line shows all nine stages plus queued; current underlined, done struck through; no percentages or estimates anywhere.
- [ ] Elapsed clock and framing line use measured numbers only.
- [ ] Kept chunks migrate into the knowledge core at synthesis; lane 3 is labelled "Knowledge core" until ready.
- [ ] Each stage has its described motion, and a caption says the motion is illustrative.
- [ ] Conflict count shows only when `openIssueCount > 0`.
- [ ] At ready, the outline replaces lane 3 with the described reveal; core vs peripheral follows the outline tags; the purpose line quotes the user's purpose.
- [ ] Related arcs show once on arrival, then on hover/focus and between read entries only.
- [ ] Read entries light up from exact retrieval paths.
- [ ] `state: review` shows the issue line and stays testable.
- [ ] Failure freezes, names the stage, and offers Try again.
- [ ] Works at 900px and phone width, in light and dark, and with reduced motion.
- [ ] Nothing implies Jev built the index.
