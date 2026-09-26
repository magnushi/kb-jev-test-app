# Knowledge Base Lab: design package

Everything Claude Code needs to build the Knowledge Base Lab UI.

| Path | What it is |
|---|---|
| `CLAUDE_CODE_PROMPT.md` | The prompt to paste into Claude Code. Start here. |
| `DESIGN_BRIEF.md` | Detailed UI brief: layout, components, states, the knowledge map, naming, list page, tokens, copy, acceptance checklist. |
| `spec/knowledge-base-lab-spec.md` | Original product and build spec (pipeline, Jev, Sanity Context, MCP, security, cost controls). |
| `prototype/knowledge-base-lab.html` | Single-file clickable prototype. Open in a browser. Visual and interaction reference only; its data is simulated. |
| `screenshots/` | All major states (light, dark, 900px, 400px). |
| `tokens/tokens.css`, `tokens/tokens.json` | Design tokens from Sanity UI. |

How to use it:

1. Unzip into the root of a new or existing repo (for example as `design/`).
2. Open Claude Code in that repo.
3. Paste the contents of `CLAUDE_CODE_PROMPT.md`.

Precedence when documents disagree: `DESIGN_BRIEF.md` for anything visual or interactive, `spec/knowledge-base-lab-spec.md` for backend, integrations, security and cost.
