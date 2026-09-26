# Prompt for Claude Code

Paste everything below the line into Claude Code at the root of the repo. The folder with this package is assumed to be at `design/`; adjust the paths if you put it elsewhere.

---

We're building **Knowledge Base Lab**, an open-source demo that turns a topic or a few public URLs into a real Sanity Knowledge Base, shows Jev filtering the source material on a live knowledge map, and lets you test the result with an agent through Sanity Context MCP.

Read these first, fully, before writing code:

1. `design/spec/knowledge-base-lab-spec.md`: product and build spec. It governs the backend, integrations, security and cost controls.
2. `design/DESIGN_BRIEF.md`: UI brief. It governs everything visual and interactive and overrides the spec's design sections (16–18).
3. `design/prototype/knowledge-base-lab.html`: open it in a browser and click through it. It's the reference for layout, states and interaction. Its data is simulated; do not copy its fake data, scripted answers or random IDs into the product.
4. `design/screenshots/` and `design/tokens/`.

How to work:

- Follow the spec's phases. **Phase 0 first:** verify current official docs for Jev (TypeSafe, via OpenRouter), Sanity Context Knowledge Bases, Sanity Context MCP and Mastra, and write `docs/integration-notes.md`. Do not invent endpoints or response fields.
- **Phase 1:** the end-to-end vertical slice with no polished UI.
- **Phase 2:** build the UI exactly as the design brief describes. Next.js + TypeScript + Tailwind. Use the tokens in `design/tokens/tokens.css` as CSS variables (or map them into the Tailwind theme). Using `@sanity/ui` components is fine if it fits.
- Drive the knowledge map, tallies and token strip from the real `BuildEvent` stream (spec §8). Never show a number the pipeline didn't measure.
- Keep the design rules in brief §2: one label per panel, one accent color, no header tiles, no stat tiles, no event logs. If you're tempted to add UI, check the brief first.
- Implement the brief's additions to the spec: the "[Name] Knowledge Base" naming (auto-derived, editable before build), max 3 sources enforced client and server side, optional "Built by" name/email next to the Build button (plus a one-time ask after an unnamed build), and the minimal "All knowledge bases" list page (name, short description, maker). Extend the data model and API as in brief §9.
- Both light and dark themes; responsive to 400px with no horizontal scroll; visible focus; respect reduced motion.
- After each milestone run type checks and tests, and keep `TODO.md` and `DECISIONS.md` up to date (spec §14).
- Use brief §15 as the UI acceptance checklist and spec §13 for the overall one.

Start with Phase 0 and tell me what you find before moving on.
