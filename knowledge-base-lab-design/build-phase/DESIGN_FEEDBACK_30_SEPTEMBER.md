# Design feedback: the build phase

**For:** Claude Design
**From:** Claude Code, with Magnus Hillestad
**Date:** September 30, 2026
**About:** `BUILD_PHASE_DESIGN.md` and `build-phase-mockups.html`

The design answers the brief closely and most of it can be built as drawn. This is a
review against the **live API**, not against the brief — I read a real built knowledge
base (`kbt432byCXWQ`, 8 entries, from 3 sources) and checked every "Check:" row in §3.

Four things in the design don't survive contact with the real data. One finding makes
most of the design buildable sooner than either of us expected.

---

## 1. Good news: the outline needs no MCP endpoint

`BUILD_PHASE_DESIGN.md` §3 assumes the outline arrives through Context MCP. It doesn't
have to. `@sanity/client` exposes it directly:

```ts
kb.context.entries.list()   // → path, title, tldr, status  (drains pagination)
kb.context.entries.get({path})  // → adds topicHeadings, body, citations
```

Verified live. So **states 12–15 — the reveal, the outline at rest, hover, 40 entries —
can all be built and tested now.** Only state 16, highlighting what the agent read, still
needs the MCP endpoint, because only retrieval knows which paths were read.

This also settles the `Check:` on entry titles: **there is a real `title` field.** No
humanizing is needed, so the "Openrouter" casing problem in §3 goes away. Use `title`.

---

## 2. Paths are flat. The tree has nothing to group.

The design's tree — `jev/` group headings, indented `primitives/` subheadings — assumes
slash-delimited paths. Our build returned:

```
algorithms
applications
capabilities_and_limitations
fundamentals
gates_and_circuits
hardware
history_and_milestones
misconceptions
```

No slashes. Not one. Sanity's path depth comes from how much material it has to
organise, and **three sources is a hard cap in `DESIGN_BRIEF.md` §5.1**. So a shallow,
flat outline is the *normal* case for this product; the nested tree is the exception.

### Suggested fix: group by tier, not by path

`tldr.centrality` is on every entry and is always populated. Group on that, and treat
path nesting as a bonus when it appears:

```
CORE TO YOUR PURPOSE
  ■ Quantum Algorithms              Shor's, Grover's, VQE, QAOA…
  ■ Applications of Quantum…        cryptography, drug discovery…
  ■ Qubits, Superposition…          what qubits are, how superposition…

ALSO COVERED                        ← needs a proper name, see §3
  □ History and Key Milestones      Feynman's proposal, Deutsch-Jozsa…
  □ Common Misconceptions           conflicting definitions across sources…
```

When paths *do* contain slashes, add the group headings you drew, nested inside each
tier. One renderer, two shapes, and no invented structure.

Two things this buys beyond correctness:

- **The `[core]` idea gets stronger, not weaker.** Your best insight is that the purpose
  typed in the left column decides what comes out central. As a visible group with a
  heading, that reads far more clearly than a marker colour on rows scattered through a
  tree.
- **It rules out the tempting mistake.** We could group `gates_and_circuits` and
  `history_and_milestones` by guessing at themes. That is fabricated structure, and rule
  5 forbids it.

---

## 3. There are three tiers, not two

The design treats centrality as binary: core versus peripheral. The API returns:

```ts
centrality: 'core' | 'standard' | 'peripheral'
```

And **`standard` is common** — our build was 6 core, 2 standard, **0 peripheral**. So the
design's two visual states cover the two tiers that happen to be rarest together, and
leave the middle one undefined.

`ALSO COVERED` above is a placeholder. Please name the middle tier and give it a visual
weight between the filled and hollow markers. Worth deciding whether `peripheral` needs
a third treatment or can share with `standard`.

---

## 4. The `related:` arcs have no data

Arcs are load-bearing in states 12, 13, 14 and 16. Our build:

```
algorithms: 0   applications: 0   capabilities_and_limitations: 0
fundamentals: 0 gates_and_circuits: 0  hardware: 0
history_and_milestones: 0   misconceptions: 0
```

`tldr.neighbors` was empty on **every** entry. The arcs would never draw, the `↔ 2`
counts would always be absent, and state 14's hover would show nothing.

It may populate on larger knowledge bases — unconfirmed, and worth asking the Sanity
Context team. But the design needs to hold up when it's empty, which appears to be the
common case at three sources.

### There is a better source of connections

`tldr.excludes` is populated, and the design doesn't use it:

> "Gate-level mechanics covered in **gates_and_circuits**; real-world application
> domains covered in **applications**"

That is a real, authored relationship between entries — and a more interesting one than
"related", because it says *where the boundary is*. It's how the knowledge base avoids
saying the same thing twice.

It's prose, so parsing entry names out of it is fragile and I wouldn't build arcs from
it. But as **hover content** it's excellent, and it answers a question the summary
doesn't: what this entry deliberately leaves to another.

Suggestion: make `excludes` part of state 14, and treat arcs as progressive enhancement
that appears only when `neighbors` is non-empty.

---

## 5. `openIssueCount` and `issues.list()` disagree

§3 lists `openIssueCount` as the conflict count. On our build:

- `openIssueCount` on the knowledge base record: **0**
- `kb.context.issues.list()`: **4 issues**

The docs explain the gap: only conflicts and add/remove/split proposals are surfaced for
review, and "coverage gaps are recorded but not surfaced". So the two numbers count
different things.

State 10 says "1 conflict between sources found" and state 17 says "1 issue to review".
Those want the **filtered, reviewable** count, not either raw number. I'll work out which
field or filter gives it and report back — flagging it so the copy isn't written against
a number that turns out to mean something else.

Still open: whether the count moves during `review` or only lands at the end. Needs a
build to watch, which I'll do on the next run.

---

## 6. The other `Check:` rows

| Row | Answer |
|---|---|
| Synthesis duration | **Available.** Build events already carry `at` timestamps; `synthesis.started` → `synthesis.complete` gives it. The events API just needs to return the timestamp. Small change on my side. |
| Entry titles | **Real `title` field exists.** Don't humanize. |
| Conflict count timing | Open — see §5. |
| Try again re-runs Sanity's build only | Plausible: `kb.context.build()` is independent of our pipeline, and the imported Markdown persists. Not yet tested. I'll confirm before building the button. |

---

## 7. Things I'd keep exactly as drawn

Worth saying explicitly, because the list above is all objections:

- **`queued` as a real state with nothing moving.** Exactly right, and it matches the
  data: `isBuilding: true` with no stage begun. One internal tester sat in that state for
  20 minutes; a spinner would have lied for 20 minutes.
- **The stage line showing all nine stages at once.** The horizon is the point. Struck
  through for done, underlined for current, no percentages.
- **The framing line** with Jev's and Opus's measured times. It lands the argument at the
  one moment the user has nothing to do but read.
- **"Motion shows the stage. Entries appear when Sanity finishes."** That caption is what
  makes the stage animations honest rather than decorative. Keep it verbatim.
- **The calmer motion option in §4.** Magnus's call, but a 2–5 minute wait with three
  looping animations may wear. The pulsing dot and the clock alone carry it.
- **Lane 3 relabelled "Knowledge core" until the outline lands.** Small, and it stops the
  column claiming to show Sanity's entries before it has any.
- **The purpose line above the tree.** The single best idea in the document.

---

## 8. What I'd change, in one list

1. Group the outline by **tier**, with path nesting as a bonus when present (§2).
2. Add a **third tier** — `standard` — and name it (§3).
3. Make **arcs conditional** on `neighbors` being non-empty, and don't rely on them (§4).
4. Use **`tldr.excludes`** in hover; it's populated and says something useful (§4).
5. Use **`title`**, not a humanized path (§1).
6. Hold the **conflict copy** in states 10 and 17 until we know which count is right (§5).

Nothing here changes the shape of the design. It's the same two ideas — make the wait
legible, make the reveal worth waiting for — fitted to what the API actually returns.

---

# Correction, later the same day

## §5 was wrong: `openIssueCount` is the right field

I reported that `openIssueCount` (0) disagreed with `issues.list()` (4). It doesn't. I
read the count moments after the build completed, before it had populated. Re-read now:

```
all=4  open=4
  open  conflict  critical  algorithms
  open  conflict  critical  *
  open  conflict  critical  *
  open  conflict  critical  *

reviewable (open, non-gap): 4
openIssueCount on record:   4
state: review   isBuilding: false
```

They agree. **Use `openIssueCount`.** Apologies — that sent you to put the copy in states
10 and 17 on hold for no reason. Take it off hold.

One caveat worth keeping. The issue kinds are:

```ts
kind: 'conflict' | 'gap' | 'update_required'
    | 'add_entry' | 'remove_entry' | 'split_entry' | 'merge_entry'
severity: 'critical' | 'suggestion'
```

Docs say coverage gaps are recorded but not surfaced for review, and `openIssueCount`
matched the non-gap count exactly here, so it appears to already be the surfaced count.
Our build produced only conflicts, so a build containing gaps hasn't been observed. If
the two ever diverge, filter to the reviewable kinds — but write the copy against
`openIssueCount`.

**A consequence for the copy:** all four issues came back `severity: 'critical'`, and the
docs say critical issues "affect a fact an agent is likely to state". Severity is
available, and "1 critical conflict" says more than "1 conflict".

## State 17 is live right now

`kbt432byCXWQ` is sitting in `state: review` with 4 open critical conflicts. So state 17
is not hypothetical — it is the state our only built knowledge base is actually in, and
it can be built and checked against real data immediately.

Worth noting for the design: **`review`, not `ready`, may be the common outcome.** Three
sources on one topic disagree often. The knowledge base is fully testable in that state,
so nothing is blocked, but "ready" may be the rarer of the two labels.

## Still open, unchanged

- Whether `openIssueCount` moves *during* the `review` stage, or only lands at the end.
  Needs a build to watch. Until then, state 10's in-build conflict line stays speculative
  and state 17's is safe.
- Whether `neighbors` fills in on larger knowledge bases. For the Sanity Context team.
- **Try again** re-running only `kb.context.build()`. Deliberately not tested yet:
  re-running it on `kbt432byCXWQ` would rebuild the entries I'm using as the fixture for
  states 12–15. I'll test it on a throwaway knowledge base instead.
- The stage captions. For the Sanity Context team.
