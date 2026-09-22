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
| [`docs/Shift_Manager_PRD.md`](../../../docs/Shift_Manager_PRD.md) | Requirements (H1…), business rules, schema |
| [`AGENTS.md`](../../../AGENTS.md) | Module map, hard constraints, release |
| [`SECURITY.md`](../../../SECURITY.md) | Offline posture, data stores, deployment trust |
| [`TERMS.md`](../../../TERMS.md) | No-warranty / org responsibility framing |
| [`docs/THIRD_PARTY.md`](../../../docs/THIRD_PARTY.md) | Tailwind/DaisyUI/esbuild packaging |
| [`README.md`](../../../README.md) | Operator-facing behaviour |

Do **not** run this for typos, copy tweaks, or one-line CSS with no product surface.

---

## Mode A — Feature brainstorm (before code)

1. **Map to PRD.** Find matching Must/Should IDs (H…). If none, treat it as a new requirement — confirm with the user and plan a PRD update before coding.
2. **Locate code.** Using `AGENTS.md`, name the modules likely touched (`model.js`, `generator.js`, `snapshot.js`, `screens/…`, `workspace.js`, …). Prefer extending those over new frameworks.
3. **Constraints check** (fail the design if violated):
   - Offline / no CDN / no new runtime network
   - Single HTML via `build.mjs`; `file://` must work
   - Schema: migrate-on-open in `model.js`; keep old log layouts readable
   - Escape user text with `esc()`; no fake in-app auth
   - New Tailwind utility classes: `src/styles/tailwind.css` is a fixed vendored subset, not regenerated at build time — confirm the class is actually in that file before designing around it, or plan plain CSS in `app.css` instead
4. **Security / third-party.** If storage, network, or build packaging changes → plan updates to `SECURITY.md` / `THIRD_PARTY.md` as part of done.
5. **Alternatives.** If 2+ approaches matter, list them with one-line tradeoffs and a recommendation; ask before coding when the choice is non-obvious.
6. **Doc sync plan.** Which PRD rows (H-ids), README bits, or security docs change? Record that before implementation.

### Output template (Mode A)

```markdown
## Design brief
- PRD: H… (quote requirement in one line)
- Modules: …
- Approach: …
- Alternatives considered: …
- Schema / migration: none | …
- Docs to update: …
- Open questions: …
```

---

## Mode B — Architecture-fit review (before commit)

Run against the **diff**, not a re-debug of every line:

- [ ] Every behaviour change maps to a PRD H-id or an agreed doc update
- [ ] No new runtime network / CDN / telemetry
- [ ] `file://` + single-file build still valid
- [ ] JSON compatibility: migration or additive fields only; legacy snaps still render if print/log touched
- [ ] User-facing strings go through `esc()`
- [ ] `SECURITY.md` / `THIRD_PARTY.md` / `README.md` / PRD updated when posture or operator steps change
- [ ] No drive-by refactors outside the request
- [ ] Any new Tailwind utility class checked against `src/styles/tailwind.css` (vendored, fixed subset), not just assumed to work

Unchecked items without justification → fix before commit.

---

## After Mode A

Hand off to the **tdd** skill for behaviour changes (failing check first), then implement, then **verify**.
