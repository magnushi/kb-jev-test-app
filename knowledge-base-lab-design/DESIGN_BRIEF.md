# Knowledge Base Lab: Design Brief

**For:** Claude Code, implementing the UI of Knowledge Base Lab
**Status:** Design approved in prototype form, September 25, 2026
**Owner:** Magnus Hillestad (Sanity)

Read this together with:

- `spec/knowledge-base-lab-spec.md`: the product and build spec (pipeline, integrations, security, cost controls). The spec governs the backend. This brief governs the UI and overrides the spec's design sections (16–18) where they differ.
- `prototype/knowledge-base-lab.html`: a working, single-file clickable prototype. Open it in a browser. It is the visual and interaction reference. Its data is recorded and simulated; the real app must replace all of it with live pipeline telemetry.
- `screenshots/`: every major state.
- `tokens/`: colors, type, radii and spacing as CSS variables and JSON.

---

## 1. What the page must do

One page where a visitor:

1. **Builds** a knowledge base by describing it in a chat (left).
2. **Watches** it get built on a live knowledge map (middle): sources are chunked, Jev keeps or drops each chunk, kept chunks become knowledge base sections, and a real Sanity Knowledge Base is created.
3. **Tests** it with an agent grounded only in that knowledge base (right).

A second page lists **all knowledge bases** people have built, and who built them.

The single "aha" the design exists to deliver: *watching most of the fetched web text get dropped by Jev before the expensive LLM step, and seeing exactly what survived.*

## 2. Design principles (learned from review, keep them)

The design went through several rounds of simplification. These are the rules that came out of it. Do not add back what was removed.

1. **One label per thing.** Every panel has exactly one header label. No eyebrow + title + subtitle stacks.
2. **One accent color.** Sanity blue (`--accent`) plus neutrals. No red, green or yellow badges. Status is plain text, not colored pills. `--sanity`, `--ok` and `--warn` exist in the tokens but are intentionally unused.
3. **No decorative chrome.** No pipeline "chain" tiles in the header, no stat tiles, no event logs, no inspector panels, no nested cards inside cards.
4. **The map explains itself.** Labeled lanes, a legend and plain-language status text. A first-time viewer must understand it without being told.
5. **Never fake numbers in production.** Every count, score, token figure and ID shown must come from real telemetry (spec §3.3, §18). The prototype's numbers are samples.
6. **Open on something real.** The Lab loads showing a finished example knowledge base, not an empty shell.

## 3. Page structure

### 3.1 Header (both pages)

- Left: **"Knowledge Base Lab"** wordmark with a small 3×3 dot mark. Clicking it returns to the Lab.
- Right: a single outlined button **"All knowledge bases"** with a count in mono (e.g. `3`). On the list page this button reads **"Back to Lab"**.
- Nothing else. No tabs, no profile button, no "prototype" badge.

### 3.2 Lab page: three columns

| Column | Header label | Width (desktop) | Role |
|---|---|---|---|
| Left | **Build** | 32fr | Builder chat, source confirmation, "Built by" |
| Middle | **Knowledge map** | 36fr | The active knowledge base: name, map, token strip |
| Right | **Test the knowledge base** | 32fr | Agent chat grounded in the knowledge base |

- Columns are panels: white surface, 1px `--line` border, 6px radius, on a `--bg` page. Panel headers are 48px tall, 16px side padding, 14px/600 title.
- Use `minmax(0, Nfr)` so long content never distorts the column widths.
- Gap 12px, page side gutter 16px.
- The middle column's header has one action button on the right: **"Skip to end"** while a build runs, **"New build"** when idle/ready.

**Responsive**

- ≤1180px: columns become 27/46/27 so the map keeps room.
- ≤900px: token strip wraps; still three columns.
- ≤720px: stack vertically on one scrolling page (Build, then Knowledge map, then Test). **No tabs.** The chat panes get `max-height: 70vh` with their own scroll.
- Known issue to fix: at phone width the per-source tally ("8 of 11 kept") can overlap the domain label. Truncate the domain or move the tally below it.

## 4. Knowledge base naming

Every knowledge base is named **"[Name] Knowledge Base"**, e.g. "Jev Knowledge Base", "California Wildfire Insurance Knowledge Base".

- The name is the largest text on the page: 18px/600 at the top of the middle column, followed by the status in 12px muted text (e.g. `ready`, `filtering`).
- **The `[Name]` part is derived automatically** from what the user asks for in the builder chat. The prototype's heuristic (`deriveName` in the prototype):
  - take the phrase after "about / on / covering / around" if present;
  - strip lead-ins ("make me a", "I want a", "build a") and anything from "knowledge base" onward;
  - cut at the first punctuation, drop leading articles, keep up to 5 words, trim trailing small words;
  - Title Case, but keep acronyms (MCP, GROQ) and small words (for, and, of) lowercase mid-name;
  - URL-only request → registrable domain label ("docs.example.com" → "Example").
  - In production, prefer having the intent LLM return `title` (spec Stage A, `BuildIntent.title`) and fall back to this heuristic. The UI contract is the same.
- **The name is editable** before the build starts: it's an inline text input styled as the heading, with a dashed underline on hover, the fixed suffix " Knowledge Base" after it, and auto-width to its content. It becomes read-only once the build starts.
- The same full name appears in the builder's intent card (`name` row), the Test agent's intro line, and the list page.

## 5. Left column: Build

A chat thread with these message types (see screenshots 01, 03, 06):

1. **User message**: gray bubble with a 1px border, "YOU" label above.
2. **Intent card** (builder): mono definition list with `name`, `purpose`, `budget` (`3 sources · 40k candidate · 12k synthesis tokens`). `purpose` becomes the knowledge base's short description.
3. **Source proposal** (builder): "I found these three sources. Build from these?" followed by:
   - up to **3 source cards** (domain in mono, page title below, × to remove);
   - an add-URL input + "Add" button;
   - the primary button **"Build from N sources"**;
   - the **"Built by"** line (see 5.1).
4. **Status messages** from the builder (building, ready, errors).

Composer at the bottom: "Describe a knowledge base, or paste URLs" + "Send".

- Before a build: sending a message renames the knowledge base (§4) and the builder confirms.
- After a build is ready: sending a message starts a **new build** with the new name (a fresh proposal block appears; the previous one stays locked in the thread).
- During a build: the builder asks the user to wait.

### 5.1 Source limit: fixed at 3

- Max **3 sources** per build. Fewer is allowed, more is not.
- At 3, the add-URL input and button are disabled with the placeholder **"3 of 3 sources. Remove one to add another."** Below 3: "https://… add a URL (2 of 3)".
- At least 1 source must remain ("Keep at least one source").
- Enforce the same limit server-side (spec §9). Never trust the client.

### 5.2 "Built by" (optional name and email)

- Sits directly under the Build button in each proposal: **"Built by [Your name (optional)] · Add email"**. Clicking "Add email" reveals an email field.
- Once a name is saved it shows as **"Built by Magnus Hillestad · magnus@… Edit"** and is reused for every later build.
- Stored per browser (localStorage in the prototype). Optional. No accounts (spec: no login, no email gate).
- If someone builds without a name, the builder asks once when the build is ready: **"Add your name to [Name] Knowledge Base? It shows in the list of knowledge bases."** with inline Name, Email (optional) and an "Add" button. Submitting updates that knowledge base's record.
- Emails are shown publicly in the list when given. The field copy must make that clear. Consider showing only the name in the public deployment and keeping email private for contact; decide before launch.

## 6. Middle column: Knowledge map

This is the hero. It shows **the knowledge base currently being built, or the most recent one**. It is not a list.

Layout, top to bottom:

1. **Name + status** (§4).
2. **The map**: a canvas on a `--bg` rounded area, 360px tall.
3. **Status line + legend** row.
4. **Token strip**.
5. Small footnote (prototype only: "Prototype replaying a recorded run…". Remove it in production or replace it with real provenance).

### 6.1 The map: three labeled lanes

Header row inside the map (12px/600 muted, active lane in accent): **"1 Sources" · "2 Jev" · "3 Knowledge Base"**, with a hairline below. The numbering is meaningful because it's the real order of the pipeline.

**Lane 1, Sources (left ~44%)**

- Always **3 rows**, one per source slot.
- Each row: the domain (12px/500) on the left, a tally on the right ("11 chunks" after fetch, then "8 of 11 kept" once Jev has decided), and below it a row of **12px squares, one per chunk** (wrapping if needed).
- Chunk square states:
  - not fetched: not drawn;
  - fetched, undecided: white with a `--line-2` outline;
  - **being evaluated**: enlarged to 16px, ink outline, with a tooltip "[chunk label] / P(yes) 0.98 · evaluating";
  - **kept**: solid `--accent`;
  - **borderline, kept**: `--accent-soft` fill with an `--accent` outline;
  - **dropped**: `--surface-2` fill, `--line` outline, a diagonal slash.
- Empty slots (fewer than 3 sources) show a dashed box: "Open source slot". A user-added URL the demo can't process shows "[domain] · skipped in demo" (prototype only; the real app processes it).

**Lane 2, Jev (the divider)**

- A dashed vertical line at 50% width. It turns accent while filtering.
- It's the gate between raw source material and the knowledge base. No other decoration.

**Lane 3, Knowledge Base (right ~44%)**

- Before synthesis: two muted lines of guidance ("Sections appear here after Jev and synthesis run." / "Kept chunks are synthesized into sections next.").
- During synthesis: sections appear one by one as rows: an 8px accent square, the section title (12px/500, ellipsized), and the number of source chunks behind it right-aligned (column labeled "chunks"). As each appears, lines briefly flash from its source chunks to it (~1.1s fade).
- Below the rows, a hairline and one line: **"Sanity KB kb_… · importing… / building… / ready"**.

**Interaction**

- Hover a chunk: tooltip with its label, P(yes) and decision (KEEP / BORDERLINE · KEPT / DROP).
- Hover a section: draw lines from all its source chunks to the row, and ring those chunks.
- **Query-time continuity:** when the Test agent answers, the sections actually retrieved through Context MCP get an accent-soft row background and persistent lines back to their chunks (screenshot 02). Only draw these links when provenance makes them real (spec §3.5). If you only have section-level or source-level retrieval metadata, highlight at that level.

**Rules**

- The map must stay bounded for the largest permitted build (spec §18). If chunk counts exceed what fits, aggregate (e.g. one square = N chunks) and say so in the tally.
- Respect `prefers-reduced-motion`: no easing or flashes, just final states.
- Canvas colors must come from the CSS tokens and re-read on theme change.
- Only show a numeric score if Jev provides a defensible one. Jev's Noul primitive returns P(yes), which the prototype uses.

### 6.2 Status line and legend

- Left: plain-language progress, e.g. "Fetching openrouter.ai · extracting and chunking", "Jev · 7/31 evaluated · 7 kept · 0 dropped", "6 sections · hover the map to inspect decisions".
- Right: legend with three swatches: **kept**, **borderline, kept**, **dropped**.

### 6.3 Token strip

One line: **`33k` source → `20.1k` kept by Jev → `6k` synthesized** · "tokens" right-aligned. Numbers in mono (15px/500), labels muted. Below it a single 6px track: kept (accent-soft with an accent outline) overlaid by synthesized (solid accent), both as a share of source tokens. These numbers must be the same telemetry that drives the map.

## 7. Right column: Test the knowledge base

- Header: **"Test the knowledge base"** only.
- First agent message states grounding: "Grounded only in **[Name] Knowledge Base** (`kb_…`). I retrieve from it through Sanity Context MCP and say so when it doesn't cover something."
- 3–4 suggested questions as outlined chips (3px radius), generated when a knowledge base becomes ready (spec §3.4).
- Each agent answer shows a small line first: accent dot + "Sanity Context MCP · 2 entries retrieved" (or "no matching entries"), then the streamed answer, then a collapsible **"Sources · N KB entries"** listing section titles and source domains.
- When the knowledge base doesn't cover the question, say so plainly and list what it does cover.
- Composer: "Ask the knowledge base" + primary "Ask".
- The Test column always targets the most recent build. To test another knowledge base, open it from the list page.

## 8. All knowledge bases page

Deliberately minimal (screenshot 07).

- A single centered panel (max 840px) headed **"All knowledge bases"** with a count on the right ("3 knowledge bases").
- A plain list, one row per knowledge base, newest first. Each row has three things:
  1. **Name**: "[Name] Knowledge Base", 14px/600;
  2. **Short description**: one line, 13px `--ink-2` (the intent `purpose`);
  3. **Who made it**, right-aligned: the maker's name, with their email below in 12px muted if they gave one. Fallbacks: account name if known, otherwise "Anonymous". Seed examples show "Sample".
- The whole row is a button: clicking it opens that knowledge base in the Lab's Test column.
- No dates, IDs, sources, avatars or badges in the list.
- At ≤560px the maker moves under the description.
- Empty state: "No knowledge bases yet. Build one in the Lab."

## 9. Data additions to the spec

Extend the spec's `KnowledgeBaseRecord` (§7):

```ts
type KnowledgeBaseRecord = {
  // …existing fields
  title: string          // the [Name] part only; UI appends " Knowledge Base"
  purpose: string        // shown as the short description in the list
  makerName?: string     // optional, self-entered
  makerEmail?: string    // optional, self-entered
}
```

- The list page reads from the app database (spec §6), not from Sanity. The actual knowledge still lives in Sanity Knowledge Bases.
- Updating maker fields after the build must be allowed for the same anonymous session only (cookie-bound), to prevent people renaming others' builds.
- Add `GET /api/knowledge-bases` (already in spec §8) returning `{ id, title, purpose, makerName, makerEmail, createdAt }[]`, and `PATCH /api/knowledge-bases/:id/maker` scoped to the creating session.

## 10. Visual system

Tokens are in `tokens/tokens.css` and `tokens/tokens.json`. They come from Sanity UI (`@sanity/color` 3.0.8 palette, `@sanity/ui` 4.2.6 theme). In a React/Tailwind build, map these to Tailwind theme values or CSS variables. You may use `@sanity/ui` components directly if it fits the stack.

| Role | Light | Dark |
|---|---|---|
| Page background `--bg` | `#f6f6f8` | `#13141b` |
| Panel `--surface` | `#ffffff` | `#1b1d27` |
| Subtle fill `--surface-2` | `#eeeef1` | `#252837` |
| Text `--ink` / `--ink-2` / `--muted` | `#252837` / `#515870` / `#727892` | `#e4e5e9` / `#bbbdc9` / `#9499ad` |
| Lines `--line` / `--line-2` | `#e3e4e8` / `#bbbdc9` | `#2a2d3f` / `#383d51` |
| Accent `--accent` / `--accent-soft` | `#556bfc` / `#e5edff` | `#7595ff` / `#192457` |

- **Type:** Inter (400/500/600/700) for UI; system monospace for IDs, domains, token counts and the intent card. Base 13px/1.46. Scale: 11, 12, 13, 14, 18.
- **Radius:** 3px for controls, chips and badges; 6px for panels and the map area.
- **Spacing:** 4px grid (4, 8, 12, 16, 20, 32).
- **Shadows:** almost none. Popovers only.
- **Both themes are required.** Follow `prefers-color-scheme` and support an explicit `data-theme` override.
- **Focus:** 2px accent outline, 2px offset, on everything interactive.

## 11. Motion

- Map transitions ease at ~0.18 per frame toward target state; the Jev evaluation cadence is roughly 400ms per chunk, 760ms for strong keeps (P ≥ 0.9) so they read. In production the cadence follows real events. Don't add artificial delay beyond what makes each decision legible, and offer "Skip to end".
- Section rows fade in over 300ms; chunk-to-section flash lines fade over 1.1s.
- Agent answers stream token by token with a blinking caret.
- `prefers-reduced-motion`: no animation, final states only.

## 12. Copy

- Plain, direct and short. Controls say what happens ("Build from 3 sources", "New build", "Skip to end", "Ask").
- Always "[Name] Knowledge Base" with a capital K and B when naming one; "knowledge base" in running text.
- Status words are lowercase: `awaiting sources`, `fetching`, `filtering`, `synthesizing`, `creating in Sanity`, `building`, `ready`, `failed`.
- Errors say what went wrong and how to fix it. No apologies.

## 13. States to implement

Match these screenshots:

| # | State | Screenshot |
|---|---|---|
| 1 | Lab on load: finished example knowledge base | `01-lab-finished-example.png` |
| 2 | Test answer highlighting retrieved sections on the map | `02-test-query-highlights-map.png` |
| 3 | New request renamed the knowledge base; sources proposed | `03-new-build-named-from-request.png` |
| 4 | Fetching | `04-build-fetching.png` |
| 5 | Jev filtering with a chunk under evaluation | `05-build-jev-filtering.png` |
| 6 | Ready; builder asks for the maker's name | `06-build-ready-ask-for-name.png` |
| 7 | All knowledge bases list | `07-all-knowledge-bases-list.png` |
| 8 | Dark mode | `08-dark-mode.png` |
| 9 | Narrow desktop (900px) | `09-narrow-900px.png` |
| 10 | Phone (400px), stacked | `10-phone-400px.png` |

Also design (not in the prototype): **failed** build (the map keeps what happened, and the status line says which step failed and offers "Try again"), **rate-limited / daily budget reached** (builds disabled with a clear message; existing knowledge bases stay testable, spec §9), and **Sanity build still pending** (knowledge base shown as building, Test disabled until ready).

## 14. What the prototype fakes (replace in production)

- Sources, chunk labels, P(yes) scores, token counts and section contents: recorded sample data about Jev. Replace with the real pipeline's events (spec §8 `BuildEvent`).
- Every build replays the same three Jev sources regardless of the name or URLs. The real app discovers and fetches per request.
- KB IDs are random strings. Real ones come from `sanity context create`.
- Test answers are scripted or keyword-matched. The real agent uses Mastra + Sanity Context MCP (spec §4 Stage G, §5).
- The shared list uses the claude.ai artifact database. The real app uses its own database (spec §6).

## 15. Acceptance checklist (UI)

- [ ] Header has only the wordmark and "All knowledge bases" / "Back to Lab".
- [ ] Each panel has exactly one header label; the right panel reads "Test the knowledge base".
- [ ] Knowledge base name auto-derives from the request, is editable before build, and follows "[Name] Knowledge Base" everywhere.
- [ ] Max 3 sources, enforced in UI and server; the map always shows 3 source slots.
- [ ] Map shows labeled lanes, legend, per-source tallies, and chunk states driven by real Jev decisions.
- [ ] Token strip and map use the same telemetry; no fabricated numbers.
- [ ] Retrieved sections light up during test answers only where provenance supports it.
- [ ] "Built by" name/email is optional, sits next to Build, is remembered, and is asked for once after an unnamed build.
- [ ] List page shows only name, short description and maker; row click opens it in Test.
- [ ] One accent color; works in light and dark; responsive down to 400px with no horizontal scroll.
- [ ] Keyboard focus visible; reduced motion respected.
