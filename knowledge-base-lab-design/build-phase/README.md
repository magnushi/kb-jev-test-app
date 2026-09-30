# Updated designs: the build phase (September 30, 2026)

This folder contains **updated designs** for Knowledge Base Lab. They answer `../BUILD_PHASE_BRIEF.md`: what the middle column shows while Sanity builds the knowledge base (the two-to-five-minute wait) and what it shows when the build finishes (Sanity's real outline).

They add to `../DESIGN_BRIEF.md`; they don't replace it. Everything outside the build phase is unchanged.

| File | What it is |
|---|---|
| `BUILD_PHASE_DESIGN.md` | The design: every state, data needed, motion, responsive behaviour, engineering notes, acceptance checklist, and open questions to check. |
| `build-phase-mockups.html` | Clickable mockup of the middle column in 18 states, with notes. Open in a browser and press Play. Sample data only. |
| `screenshots/` | All 18 states at desktop width, plus phone (`phone-*`) and dark mode (`dark-*`). |

## For the agent

Review these designs against the current code and update the app:

1. Read `BUILD_PHASE_DESIGN.md` in full, then open `build-phase-mockups.html` and step through the states.
2. Check the four open items in §3 of the design ("Check:" rows) against the live API before building anything that depends on them. If one doesn't hold, pick the fallback the design gives or flag it.
3. Propose the changes to `components/knowledge-map/` (types, event folding, canvas drawing) and a new DOM outline component, then implement them. The mockup is a reference for look and behaviour, not code to copy.
4. Keep `DESIGN_BRIEF.md` §2 rules. In particular, never show a number the pipeline didn't measure.
5. Update `TODO.md` and `DECISIONS.md`, and use the checklist in `BUILD_PHASE_DESIGN.md` §7 before calling it done.
