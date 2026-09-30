# Response to design feedback (September 30, 2026)

**For:** Claude Code
**From:** Claude Design, with Magnus Hillestad
**About:** `DESIGN_FEEDBACK_30_SEPTEMBER.md`

Thanks for checking the design against a real build. All six changes you listed are taken. `BUILD_PHASE_DESIGN.md`, `build-phase-mockups.html` and `screenshots/` are updated (revision 2).

## What changed

| # | Your point | Change |
|---|---|---|
| 1 | Outline comes from `kb.context.entries.list()`; `title` exists | The reveal fetches the outline from `entries.list()`. Names use `title`; humanizing is gone. States 12–15 no longer depend on MCP; only 16 does. |
| 2 | Paths are flat; nothing to group | The outline is **grouped by tier** from `tldr.centrality`. Slash paths, when they appear, get subheadings inside their tier. Flat paths are never grouped by theme. |
| 3 | Three tiers, and `standard` is common | Three named tiers: **Core to your purpose** (`core`), **Supporting** (`standard`), **Background** (`peripheral`). Markers are filled, half and hollow, reusing the kept / borderline / dropped look from the chunk map. Supporting shows its summary; Background shows it on hover. Empty tiers are left out. |
| 4 | `neighbors` is empty; `excludes` is populated | Arcs and "↔ N" appear only when `neighbors` has data. Hover (state 14) now shows **"Left to other entries: …"** from `tldr.excludes`. Where an entry path appears verbatim in that text, its title is shown in bold. That's an exact match against known paths, not parsing, and it draws nothing. |
| 5 | `openIssueCount` vs `issues.list()` | States 10 and 17 are marked **on hold** in the mockup and the doc. The copy should be written against the reviewable count (conflicts and proposals) once you've found the field or filter, and shown during the build only if it moves during `review`. |
| 6 | Other `Check:` rows | Folded into the data table in §3: synthesis time from event timestamps, Try again via `kb.context.build()` (still to test). |

Also changed, following your note in §7: **Calm is now the default motion.** Between stage changes the picture is still, with the pulsing dot and the clock. The three loops (map scan, organize swaps, review sweep) are kept as an optional "Full" setting. The mockup's Motion control switches between Calm, Full and Reduced.

## Sample data in the mockup

The 10-entry outline is now 8 flat entries (5 core, 2 standard, 1 peripheral) with real-looking titles and `excludes` text, matching the shape of your sample build. The 40-entry state now represents the exception: a large build with some slash paths and a few neighbors.

## Still open

- Which field gives the **reviewable issue count**, and whether it moves during `review` (you're checking on the next build).
- Whether **`neighbors`** fills in on larger knowledge bases (worth asking the Sanity Context team).
- **Try again** re-running only `kb.context.build()` (you'll confirm before building the button).
- The **stage captions** ("Planning the topic tree" and so on) are our reading of the stage names; confirm with the Sanity Context team.
