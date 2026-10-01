---
name: architect
description: >-
  Brainstorm feature designs and check architectural fit against the Shift
  Manager PRD, SECURITY, TERMS, THIRD_PARTY, and AGENTS docs. Use before
  implementing non-trivial features, when the user asks how to build something,
  where a change belongs, or for an architecture-fit review before commit.
---

# Architect — Shift Manager

Ground designs in the product docs so work reuses what exists, stays offline, and does not drift from the PRD.

## Doc map (read what you need)

| Doc | Use for |
| --- | --- |
| [`docs/Shift_Manager_PRD.md`](../../../docs/Shift_Manager_PRD.md) | **What** — active requirements as “As a shift manager, I …” stories grouped by feature (H-ids, priority, `Spec: S<n>`), business rules, schema |
| [`docs/Shift_Manager_Spec.md`](../../../docs/Shift_Manager_Spec.md) | **How** — technical / design detail per `S<n>` entry (layout, CSS, stored fields, code paths); find an H-id with `grep '\*\*H47\*\*'` |
| [`docs/PRD_Deprecated.md`](../../../docs/PRD_Deprecated.md) | Retired / superseded requirements (do not implement as current) |
| [`AGENTS.md`](../../../AGENTS.md) | Module map, hard constraints, release |
| [`SECURITY.md`](../../../SECURITY.md) | Offline posture, data stores, deployment trust |
| [`TERMS.md`](../../../TERMS.md) | No-warranty / org responsibility framing |
| [`docs/THIRD_PARTY.md`](../../../docs/THIRD_PARTY.md) | Tailwind/DaisyUI/esbuild packaging |
| [`README.md`](../../../README.md) | Operator-facing behaviour |
| [`src/js/rules.js`](../../../src/js/rules.js) | **Generate rules registry** — every roster-generation rule (H-id, kind, per-pass mode, check, Home help line). Source for the generator, the Home guide and the PRD §5 “Generate rules” table |
| [`daisyui` skill](../daisyui/SKILL.md) | Component class names / markup when the change touches UI HTML |

Do **not** run this for typos, copy tweaks, or one-line CSS with no product surface.

**UI / DaisyUI:** if Mode A designs new or changed screen markup (buttons, forms, alerts, nav, tables chrome, badges, dialogs, etc.), **Read the [`daisyui` skill](../daisyui/SKILL.md)** and the applicable component guides before choosing classes. Prefer daisyUI components that already exist in the **vendored** `src/styles/tailwind.css` subset. The official skill documents daisyUI 5; this app ships an older fixed subset — do not assume Daisy 5-only classes (`fieldset`, `status`, `filter`, `badge-soft`, …) work unless `grep` confirms them, otherwise use present Daisy classes or plain CSS in `app.css` (AGENTS hard constraint #7). Do **not** add a Daisy CDN or regenerate CSS as part of ordinary feature work.

**Generate rules:** any change to how Generate allocates (add / remove / reword a rule, make a rule hard or soft, change which pass applies it) starts in `src/js/rules.js`, not inline in `generator.js`. Structural rules (order of work) are implemented in `generator.js` but still get a `RULES` entry so they are documented. After editing, run `npm run docs:rules` (rewrites the PRD table between the `rules:start` / `rules:end` markers — never edit that block by hand) and keep each rule’s H-id a live PRD row; `test/rules.test.js` fails on drift. A retired rule is removed from `RULES` **and** its H-id moved to `PRD_Deprecated.md`.

**PRD / Spec split:** the PRD is written in the shift manager’s words and stays stable; the Spec holds the how. A change to what the manager can do → new or edited story row (new H-id only for a genuinely new capability) **and** its Spec entry. A tweak to how an existing thing looks or behaves (layout, CSS, column widths, storage detail) → edit the Spec entry only, no new H-id. Every live PRD row needs a priority, an “As a shift manager…” story and a `Spec: S<n>` that resolves (`test/prd-spec.test.js`).

**PRD deprecation rule:** any requirement (H-id or named product surface) that is deprecated, retired, or superseded **must** be moved into [`docs/PRD_Deprecated.md`](../../../docs/PRD_Deprecated.md). Leave only a one-line pointer in the live PRD (or remove the row). Never leave deprecated behaviour documented as current Must/Should/Could.

---

## Mode A — Feature brainstorm (before code)

1. **Map to PRD.** Find the matching story (H…) in the feature group, then run `npm run docs:trace H…` — it prints the story, Spec entry, neighbouring H-ids (mentions / mentioned by), the `src/` and `test/` files that cite it, and any Deprecated history, so the blast radius is known before design. Trace each id the change might touch. If none, treat it as a new requirement — confirm with the user and plan a PRD story + Spec entry before coding. If it only changes how an existing story is built or looks, it is a Spec edit (see **PRD / Spec split**).
2. **Locate code.** Using `AGENTS.md`, name the modules likely touched (`model.js`, `rules.js`, `generator.js`, `snapshot.js`, `screens/…`, `workspace.js`, …). Prefer extending those over new frameworks. Generate behaviour → `rules.js` first (see **Generate rules** above).
3. **Constraints check** (fail the design if violated):
   - Offline / no CDN / no new runtime network
   - Single HTML via `build.mjs`; `file://` must work
   - Schema: migrate-on-open in `model.js`; keep old log layouts readable
   - Escape user text with `esc()`; no fake in-app auth
   - New Tailwind utility classes: `src/styles/tailwind.css` is a fixed vendored subset, not regenerated at build time — confirm the class is actually in that file before designing around it, or plan plain CSS in `app.css` instead
   - UI markup: follow the **daisyui** skill discovery protocol (candidate components → read guides → pick best), then verify each chosen class against the vendored CSS
4. **Security / third-party.** If storage, network, or build packaging changes → plan updates to `SECURITY.md` / `THIRD_PARTY.md` as part of done.
5. **Alternatives.** If 2+ approaches matter, list them with one-line tradeoffs and a recommendation; ask before coding when the choice is non-obvious.
6. **Doc sync plan.** Which PRD rows (H-ids), README bits, or security docs change? Record that before implementation. If an old requirement is retired, **move it to `docs/PRD_Deprecated.md`** (do not leave it as current in the live PRD).

### Output template (Mode A)

```markdown
## Design brief
- PRD: H… (quote the story in one line) · Spec: S…
- Modules: …
- Approach: …
- DaisyUI / UI: n/a | skill read + components … (classes confirmed in vendored CSS | app.css fallback)
- Alternatives considered: …
- Schema / migration: none | …
- Docs to update: … (PRD story and/or Spec entry; PRD_Deprecated.md if retiring an H-id)
- Open questions: …
```

---

## Mode B — Architecture-fit review (before commit)

Run against the **diff**, not a re-debug of every line. Run `npm run docs:trace` on each H-id the diff touches: neighbours listed there that the diff ignores are the likely misses.

- [ ] Every behaviour change maps to a PRD H-id or an agreed doc update
- [ ] Deprecated / superseded requirements were moved to `docs/PRD_Deprecated.md` (not left as current Must/Should/Could)
- [ ] No new runtime network / CDN / telemetry
- [ ] `file://` + single-file build still valid
- [ ] JSON compatibility: migration or additive fields only; legacy snaps still render if print/log touched
- [ ] User-facing strings go through `esc()`
- [ ] `SECURITY.md` / `THIRD_PARTY.md` / `README.md` / PRD updated when posture or operator steps change
- [ ] Generate rule changes live in `src/js/rules.js`; `npm run docs:rules` was run (PRD table matches) and the Home guide reads from `RULES`
- [ ] No drive-by refactors outside the request
- [ ] Any new Tailwind utility class checked against `src/styles/tailwind.css` (vendored, fixed subset), not just assumed to work
- [ ] If UI markup changed: daisyUI skill was consulted; component choices fit the intent; every new Daisy/Tailwind class exists in the vendored CSS (or plain CSS was added to `app.css` instead); no Daisy CDN / Daisy 5-only APIs introduced without a packaging plan

Unchecked items without justification → fix before commit.

---

## After Mode A

Hand off to the **tdd** skill for behaviour changes (failing check first), then implement, then **tdd-verify** (live + deprecated PRD, daisyUI, tests/build — mandatory before PR), then **verify** (security / README / release). For screen/HTML work, keep the **daisyui** skill in play while coding (same vendored-CSS constraint as Mode A).
