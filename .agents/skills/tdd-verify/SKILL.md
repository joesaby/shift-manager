---
name: tdd-verify
description: >-
  Pre-PR acceptance gate for Shift Manager: validate the diff against the live
  PRD and PRD_Deprecated, daisyUI/vendored-CSS rules, and automated tests/build.
  Use after implement and before creating a pull request, or when the user asks
  for tdd-verify / pre-PR validation.
---

# TDD-verify — Shift Manager

Mandatory **pre-PR** gate after implement. Complements **tdd** (write failing tests first) and **verify** (security / README / release). Do not open a PR until this skill’s report says ready.

## When to run

- After behaviour or UI implementation on a feature/bugfix branch
- Before `gh pr create` / asking for a pull request
- When hooks inject a tdd-verify reminder

Skip only when the user marks the change `trivial: true` / docs-only with no behaviour or UI markup (say so in the report).

## Doc map

| Doc / skill | Validate |
| --- | --- |
| [`docs/Shift_Manager_PRD.md`](../../../docs/Shift_Manager_PRD.md) | **Live (new/current) PRD** — every touched H-id still Must/Should as intended |
| [`docs/PRD_Deprecated.md`](../../../docs/PRD_Deprecated.md) | **Old/retired PRD** — change must not re-implement deprecated behaviour as current; retired H-ids live here, not in the live PRD |
| [`daisyui` skill](../daisyui/SKILL.md) | Component choice for any UI markup in the diff |
| [`src/styles/tailwind.css`](../../../src/styles/tailwind.css) | Every new Daisy/Tailwind class actually exists (fixed vendored subset) |
| [`AGENTS.md`](../../../AGENTS.md) | Offline / single-file / no CDN hard constraints |
| Architect design brief | Scope and H-ids under test |

Also read **verify** after this for security / THIRD_PARTY / release notes when those surfaces changed.

## Steps (in order)

### 1. Diff scope

```bash
git status -sb
git diff main...HEAD --stat   # or the PR base branch
```

List touched H-ids and whether UI markup (`src/js/screens/`, `ui-kit.js`, `app.css`) changed.

### 2. Live PRD (current)

For each H-id in scope:

- [ ] Requirement still appears in `docs/Shift_Manager_PRD.md` as current (not only in chat)
- [ ] Behaviour / tests match the live wording
- [ ] If the change **adds** a requirement, the PRD row was updated in the same branch

### 3. Deprecated / old PRD

- [ ] No retired H-id or surface is documented as current Must/Should in the live PRD
- [ ] If this change **retires** behaviour, the H-id was **moved** to `docs/PRD_Deprecated.md` (pointer-only or removed from live)
- [ ] Implementation does not restore deprecated behaviour unless the live PRD explicitly revived it

### 4. DaisyUI / CSS

If the diff has no UI markup → mark **n/a**.

Otherwise:

- [ ] Read daisyUI skill (+ relevant component guides) for intended controls
- [ ] Chosen components fit the intent (discovery protocol)
- [ ] Every new utility/component class is present in vendored CSS:

```bash
grep -c '\.CLASSNAME' src/styles/tailwind.css   # 0 = missing → use app.css or drop the class
```

- [ ] No Daisy CDN, no Daisy 5-only APIs (`fieldset`, `status`, `filter`, `badge-soft`, …) unless packaging/regenerate was explicitly planned and `THIRD_PARTY.md` updated

### 5. Tests validation

```bash
npm test
npm run build
```

- [ ] `npm test` passes (required when `package.json` has a `test` script — it does)
- [ ] New/changed domain rules have tests with H-ids in the name/comment (or justified UI-only via smoke notes)
- [ ] `npm run build` succeeds (`dist/shift-manager.html` + zips)
- [ ] Failing-test-first was followed for behaviour (tdd), or skip justified in the report

### 6. Report (required before PR)

```markdown
## TDD-verify report
- Scope: …
- Live PRD: H… pass | fail — …
- Deprecated PRD: ok | fail — … (revivals / missing moves)
- DaisyUI / CSS: n/a | pass | fail — …
- Tests: pass | fail — `npm test` …
- Build: pass | fail — `npm run build` …
- Ready for PR: yes | no — blockers …
```

Do **not** claim Ready for PR: yes if tests/build failed, a live H-id is unmet, deprecated content was left as current, or a new CSS class is missing from the vendored file.

## Relationship to other skills

| Skill | Role |
| --- | --- |
| **architect** | Design before code; Mode B fit review |
| **tdd** | Red → green for domain rules |
| **tdd-verify** | Pre-PR: live + deprecated PRD, daisyUI, tests/build |
| **verify** | Broader security / README / release acceptance |
| **daisyui** | Component reference while designing/implementing UI |

Typical order: architect → tdd → implement → **tdd-verify** → verify → commit / `gh pr create`.
