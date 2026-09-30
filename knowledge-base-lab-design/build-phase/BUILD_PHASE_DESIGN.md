# Knowledge Base Lab: build phase design

**For:** Claude Code (the agent building the app)
**Answers:** `../BUILD_PHASE_BRIEF.md`
**Date:** September 30, 2026
**Status:** Revision 2, after Claude Code's API review (`DESIGN_FEEDBACK_30_SEPTEMBER.md`). See `RESPONSE_TO_FEEDBACK_30_SEPTEMBER.md` for what changed and why.

`../DESIGN_BRIEF.md` still governs everything else, including its rules: one label per panel, one accent colour, plain-text status, never fake a number. This document only covers the middle column from the end of synthesis to the finished outline.

Files in this folder:

- `build-phase-mockups.html`: clickable mockup of the middle column in 18 states, with notes per state. Open it in a browser. It has a Play button and toggles for width (desktop / 900px / phone), outline size (10 / 40 entries) and motion (full / reduced). **All content is sample data.**
- `screenshots/`: every state at desktop width, key states at phone width (`phone-*`) and in dark mode (`dark-*`).

---

## 1. Summary

| Problem in the brief | Answer |
|---|---|
| The 2–5 minute wait reads as broken | A **stage line** under the map showing `queued` plus all nine Sanity stages at once (done = struck through, current = underlined with a pulsing dot). An **elapsed clock** in the status. A **framing line** with Jev's and Opus's measured times. |
| Kept chunks just sit there | The **knowledge core**: at synthesis the kept chunks cross the Jev divider into lane 3 and pack together. Each Sanity stage gets its own step on the core (Calm by default), with a caption saying the motion only illustrates the stage. |
| Conflicts are invisible | "1 conflict between sources found" in plain text, and one row is ringed, once we know which count is the reviewable one (open, §3). |
| The reveal throws away the real structure | When the build lands, lane 3 is **replaced by Sanity's outline**, grouped by **tier** (Core to your purpose / Supporting / Background), using real titles and summaries. Slash paths nest inside a tier when present. Hover shows `tldr.excludes`. Arcs only when `neighbors` has data. |
| `[core]` shows no cause | Core is its own group at the top, and a line above it quotes the **purpose from the left column**: "Core means central to your purpose: …". |
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
| 04 | map | Calm: still. Full: a scan line sweeps across the core; squares it passes get an ink ring (loops, 2.2s) | Reading through the material |
| 05 | triage | Squares regroup into clusters, one per synthesized section | Grouping related material |
| 06 | plan | A root dot appears above the clusters; lines draw from it to each (once, ~1.2s) | Planning the topic tree |
| 07 | organize | Calm: clusters move once into a new order and stay. Full: they keep swapping, one change every 1.5s | Organizing topics |
| 08 | arrange | Clusters slide into rows under the root, like a tree skeleton, with no labels | Arranging entries in the tree |
| 09 | write | Each row grows a text-line bar, staggered (once, ~2s) | Writing entries |
| 10 | review | Rows get checks (Full motion: a sweep runs down them every 1.6s). If the **reviewable issue count** is above zero and is known to move during review: "1 conflict between sources found" above the caption and a ringed "!" on one row. Copy on hold, see §3 | Checking entries against the sources |
| 11 | polish | Everything checked and still | Final pass |

The clusters use **our own synthesis sections**, which are real but ours. Nothing in lane 3 claims to be one of Sanity's entries until the outline arrives.

**Stage repeats.** If a poll returns the same stage (organize often does), keep showing it; the loop continues and nothing new is claimed.

**Stage meanings.** The captions are our reading of Sanity's stage names. Confirm them with the Sanity Context team before shipping.

### Arrival

**12 Reveal.** Triggered when `state` flips to `ready` (or `review`). Fetch the outline once with `kb.context.entries.list()` (path, title, tldr; drains pagination). No MCP endpoint is needed. Then:

- the canvas fades out (450ms);
- the outline fades in, rows arriving top to bottom: purpose line, tier headings, entries (each 420ms, 40ms apart, sliding 10px from the left);
- if any entry has `neighbors`, those arcs draw once, stay ~1.6s, then clear to hover-only. On typical three-source builds `neighbors` is empty and nothing draws;
- status: "ready · built by Sanity in 2:18" (elapsed time of Sanity's build, measured);
- the column button changes from "Skip to end" to "New build".

**13 Outline at rest.** Lane 3 is now the whole map area (360px, scrolls inside):

- Header row: "Outline · **8** entries" on the left, a small segmented control **Outline | How it was built** on the right. "How it was built" shows the canvas again with its legend.
- Purpose line: "Core means central to your purpose: “[purpose from the intent card]”".
- **Grouped by tier, from `tldr.centrality`.** Tier headings are 11px/600 uppercase muted with a mono count. Empty tiers are left out.

| Tier (`centrality`) | Heading | Marker | Name | Summary |
|---|---|---|---|---|
| `core` | Core to your purpose | 8px filled accent | 13px/600 ink | Always shown, 12px `--ink-2` |
| `standard` | Supporting | 8px `--accent-soft` fill with accent outline | 13px/500 ink | Always shown |
| `peripheral` | Background | 8px hollow `--line-2` | 12.5px/500 `--ink-2` | On hover or focus |

  The three markers deliberately reuse the kept / borderline / dropped look from the chunk map, so the page has one visual scale for "how central is this".
- Names use the entry's **`title`** field. Never humanize the path.
- **Paths are usually flat** at three sources. When an entry's path contains slashes, group those entries by the first path segment inside their tier, under a mono subheading (`api/`). Entries with flat paths come first. Never group flat paths by guessing at themes.
- Right edge: "↔ 1" (mono, muted) **only** when the entry has `neighbors`.
- The legend below the map changes to: core to your purpose · supporting · background, plus "↔ related entries" only when some entry has neighbors.

**14 Hover or focus an entry.** The row gets a `--surface` background and shows **"Left to other entries: …"** from `tldr.excludes`. Where an entry path appears verbatim in that text (e.g. `calling_jev`), show that entry's title in bold instead. This is an exact match against known paths, not parsing, and it doesn't draw arcs. Peripheral entries also reveal their summary. If the entry has `neighbors`, ring those entries' markers and draw arcs in the left gutter. Keyboard focus does the same; every row is a button.

**15 40 entries.** The exception, not the norm: a large build where paths nest and some neighbors exist. Same 360px. Still grouped by tier first, with path subheadings inside each tier. When the Background tier has more than three entries, they fold into "+ N background entries". The list scrolls inside the map area.

**16 Answer highlights entries.** The one outline state that still needs the MCP endpoint, because only retrieval knows which paths were read. When the test agent answers, the question appears above the tree in an accent-soft bar ("Read by the test agent for “…”"). Rows whose paths the retrieval tool used get an accent-soft background and a "read" label, and the first one scrolls into view. Arcs draw between read entries only if they are neighbors. It clears when the next question starts.

**17 Ready with an open issue.** `state: review`. Status reads "ready · 1 issue to review". A plain line above the tree: "Sanity flagged **1 conflict between sources**. It stays testable." Testing is not blocked. **Copy on hold** until the reviewable count is confirmed (§3).

### Failure

**18 Failed at write.** All motion stops where it was. The stage line shows the failed stage in ink followed by "· stopped". Below: "Sanity's build stopped at write after 1:52." with a primary **Try again** button. Lane 3 caption: "Stopped while writing entries / The core is kept. Try again restarts only Sanity's build."

## 3. Data needed

Updated with Claude Code's findings from a real build (`kbt432byCXWQ`, 8 entries, 3 sources).

| UI | Source | Status |
|---|---|---|
| Stage line, current stage | `buildStageState.stages[]` (`id`, `status`) | Verified. Current = first stage not `done`. Failed = a failed stage, or the job ending without `ready`. |
| Queued | `isBuilding: true` and no stage started | Verified. |
| Elapsed clock | Client clock from the first building poll | Fine. The only time shown. |
| Framing numbers | `jevLatencyMs`; synthesis duration from `at` timestamps on `synthesis.started` → `synthesis.complete` | Available; the events API needs to return the timestamp. |
| Outcome | `state` (`created` → `ready` / `review`) | Outcome only, never progress. |
| Outline | `kb.context.entries.list()`: `path`, `title`, `tldr` (centrality, summary, excludes, neighbors) | Verified. `entries.get({path})` adds topicHeadings, body, citations if needed later. |
| Tier | `tldr.centrality`: `core` / `standard` / `peripheral` | Verified; always populated. The sample build was 6 core, 2 standard, 0 peripheral. |
| Hover detail | `tldr.excludes` | Verified; populated. |
| Arcs, "↔ N" | `tldr.neighbors` | Empty on every entry in the sample. Progressive enhancement only. **Ask the Sanity Context team** whether it fills in on larger knowledge bases. |
| Read entries | Retrieval tool's entry paths via Context MCP | Needs the MCP endpoint. |
| Conflict / issue count (states 10, 17) | The **reviewable** count: conflicts and add/remove/split proposals | **Open.** `openIssueCount` was 0 while `issues.list()` returned 4; coverage gaps are recorded but not surfaced. Also open: whether it moves during `review`. |
| Try again | `kb.context.build()` only; imported Markdown persists | Plausible, not yet tested. |

Suggested additions to `components/knowledge-map/types.ts`:

```ts
type BuildStageId = 'tldr'|'map'|'triage'|'plan'|'organize'|'arrange'|'write'|'review'|'polish'
type Centrality = 'core' | 'standard' | 'peripheral'

type OutlineEntry = {
  path: string            // usually flat: "calling_jev"; sometimes "api/auth"
  title: string
  centrality: Centrality
  summary: string         // from tldr
  excludes?: string       // tldr.excludes, prose
  neighbors: string[]     // tldr.neighbors, often empty
}

type MapState = {
  // …existing
  phase: 'idle'|'fetching'|'filtering'|'synthesizing'|'creating'|'queued'|'building'|'ready'|'failed'
  buildStages?: {id: BuildStageId; status: string}[]
  buildStartedAt?: number
  synthesisMs?: number
  reviewableIssueCount?: number
  outcome?: 'ready' | 'review'
  outline?: OutlineEntry[]
  readPaths?: string[]    // set per test answer
}
```

## 4. Motion

**Default: Calm.** Motion happens when something real changes; between changes the picture is still, with a pulsing dot and a running clock. Both reviews leaned this way for a 2–5 minute wait.

- **On state change (once):** chunk migration into the core (~0.5–0.7s, eased), regrouping at triage/plan/organize/arrange, tldr line (1.5s), plan lines (1.2s), write bars (~2s staggered), reveal (canvas fade 450ms, rows 420ms each, 40ms apart), arcs on arrival only when neighbors exist (~1.6s then clear).
- **Continuous:** only the pulsing dot on the current stage (1.4s).
- **Full (optional):** adds three gentle loops: the map scan (2.2s), organize swaps (every 1.5s) and the review sweep (1.6s). The mockup's Motion control switches between Calm, Full and Reduced.
- **Reduced motion:** every state renders its final picture instantly, the dot doesn't pulse, and the reveal is a straight swap.

## 5. Responsive

- **900px** (middle column ~400px): same layout; the stage line wraps to two lines; the token strip wraps.
- **Phone** (~368px): lanes stay side by side with 9px squares. The source tally moves under the domain name (fixes the overlap noted in `DESIGN_BRIEF.md`). The stage line wraps to three lines. Captions wrap to three lines. The outline is full width and scrolls inside the map area.

## 6. Engineering notes

- **Keep the canvas for lanes 1–3 during the build.** The chunk migration, clusters and stage motion are all drawn from one state, re-reading colours from the CSS tokens on theme change, as today.
- **Render the finished outline in the DOM, not on the canvas.** It's text-heavy, needs scrolling, hover, keyboard focus and screen-reader access. Overlay it on the canvas area and cross-fade. When `neighbors` has data, draw the arcs as an absolutely positioned SVG in the outline's left gutter, computed from row offsets.
- **"How it was built"** toggles back to the canvas and swaps the legend.
- **Bounded:** outline scrolls inside 360px; Background entries fold above three; clusters are capped by the number of synthesis sections.
- **Outline without MCP:** states 12–15 can be built and tested now against `entries.list()`. Only state 16 waits on the MCP endpoint.
- **Tokens:** no new colours. Accent for current, kept, core and read; `--ink` for the conflict mark; neutrals for everything else.

## 7. Acceptance checklist

- [ ] Queued is its own state with nothing pretending to move.
- [ ] Stage line shows all nine stages plus queued; current underlined, done struck through; no percentages or estimates anywhere.
- [ ] Elapsed clock and framing line use measured numbers only.
- [ ] Kept chunks migrate into the knowledge core at synthesis; lane 3 is labelled "Knowledge core" until ready.
- [ ] Each stage has its described step, and the caption says the motion is illustrative. Calm is the default.
- [ ] Issue count shows only once the reviewable count is confirmed, and only when above zero.
- [ ] At ready, the outline replaces lane 3 with the described reveal, grouped by tier from `tldr.centrality`, using `title`; the purpose line quotes the user's purpose.
- [ ] Slash paths nest inside tiers; flat paths are never grouped by guesswork.
- [ ] Hover shows `tldr.excludes`, with exact path matches shown as titles.
- [ ] Arcs and "↔ N" appear only when `neighbors` has data.
- [ ] Read entries light up from exact retrieval paths.
- [ ] `state: review` shows the issue line and stays testable.
- [ ] Failure freezes, names the stage, and offers Try again.
- [ ] Works at 900px and phone width, in light and dark, and with reduced motion.
- [ ] Nothing implies Jev built the index.
