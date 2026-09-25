---
name: tdd
description: >-
  Test-driven workflow for Shift Manager behaviour changes mapped to PRD H-ids.
  Use when implementing features or bugfixes in model/generator/snapshot logic,
  when the user asks for TDD, or after the architect skill produces a design brief.
---

# TDD — Shift Manager

Red → green → refactor for behaviour that the PRD can name. UI chrome without rules can skip automated tests but still needs a **verify** pass.

## Doc map

| Doc | Use for |
| --- | --- |
| [`docs/Shift_Manager_PRD.md`](../../../docs/Shift_Manager_PRD.md) | H-ids and business rules → test cases |
| [`AGENTS.md`](../../../AGENTS.md) | Where pure logic lives |
| Design brief from **architect** | Scope under test |

## What to test automatically

**Prefer Node tests** for pure domain logic:

- Attendance / status / `rolesForDay` / qualifications (`model.js`)
- Generate / assign rules (`generator.js`) — seed or stub randomness when asserting
- Snapshot shape for `person-day` (`snapshot.js` / `buildSnapshot`) when extractable
- Migrations (`migrateToV2` / `normalizeV2`)

**Harder / later:** DOM screens (`screens/*.js`), File System Access, print CSS. Cover those via **verify** acceptance steps, not brittle DOM tests, unless the user asks for a harness.

## Harness

If `package.json` has no `test` script yet, add a minimal one when the first automated test lands:

```json
"scripts": {
  "test": "node --test test/**/*.test.js"
}
```

- Put tests in `test/` (e.g. `test/model.test.js`).
- Prefer importing pure helpers. If a module needs `window` / `document`, extract the pure function under test rather than mocking the whole app.
- Do **not** add Jest/Vitest/Puppeteer unless the user requests it — keep the offline, low-deps ethos.

## Workflow

1. **Name the PRD IDs** under test (e.g. H5, H35, H37).
2. **Write a failing test** that encodes the rule in plain assertions (arrange JSON fixture → act → assert).
3. Run `npm test` (or `node --test …`) — confirm **red**.
4. **Implement the smallest change** in `src/js/…`.
5. Run tests — **green**.
6. Refactor only while green; no behaviour drift.
7. Run **verify** before commit (build + PRD/security checklist).

### Test naming

```text
H35 day shift skips usedAtDay:false roles
H33 rest day does not allocate
H37 Unassigned empty cell (no spareNotes)
```

Include the H-id in the test name or top comment.

### Fixture tips

- Build minimal `emptyData()`-like objects; set only fields the rule needs.
- For generate fairness (H10/H11), assert invariants (no unqualified assign, hard-night pairing avoided when alternatives exist) rather than exact random picks.
- Migration tests: old v1/v2 shapes in → required fields present out.

## Done when

- [ ] Failing test existed before the fix/feature (or justified why only verify applies)
- [ ] `npm test` passes (if harness present)
- [ ] PRD IDs listed in the commit/PR summary
