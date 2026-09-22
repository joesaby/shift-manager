---
name: verify
description: >-
  Verify Shift Manager changes against the PRD, SECURITY/TERMS/THIRD_PARTY docs,
  offline build, and operator README. Use before commit or push, after
  implementing a feature, or when the user asks to verify, check, or acceptance-test.
---

# Verify — Shift Manager

Prove the change matches the docs and still ships as a single offline HTML file.

## Doc map

| Doc | Verify against |
| --- | --- |
| [`docs/Shift_Manager_PRD.md`](../../../docs/Shift_Manager_PRD.md) | H-ids, business rules, acceptance tone |
| [`README.md`](../../../README.md) | Operator steps still accurate |
| [`SECURITY.md`](../../../SECURITY.md) | No new network/telemetry; storage claims true |
| [`TERMS.md`](../../../TERMS.md) | No false warranty/support promises in UI copy |
| [`docs/THIRD_PARTY.md`](../../../docs/THIRD_PARTY.md) | Build/runtime third-party story unchanged or updated |
| [`AGENTS.md`](../../../AGENTS.md) | Hard constraints |

## Automated checks (always)

```bash
npm test          # if package.json defines it; skip with note if not yet
npm run build     # must succeed; produces dist/ HTML + zips
```

Confirm build output paths still match README / release workflow expectations.

## PRD acceptance (behaviour)

For each H-id in the change set, mark pass/fail/skip:

| Check | How |
| --- | --- |
| Requirement met | Manual path in `dist/shift-manager.html` or unit test evidence |
| Schema safe | Old JSON still opens; new fields optional or migrated |
| Print/log | If touched: `person-day` works; legacy snaps still open from Log |

### Smoke paths (pick those touched)

1. Home — unit + manager name  
2. Roles — Used by day / Used at night  
3. People — surname sort, quals, fixed role  
4. Attendance — statuses including Rest day → Generate  
5. Roster — edit qualified-only  
6. Print — person × day, spare note, sticky header on screen, A4 landscape intent in CSS  
7. Save to log → Log reprint/CSV  

## Security / supply-chain spot check

- [ ] No new `fetch`/WebSocket/CDN in runtime JS (except existing same-origin mock)  
- [ ] No secrets committed  
- [ ] User content escaped (`esc`) on touched screens  
- [ ] If deps or vendored CSS changed → `THIRD_PARTY.md` updated  
- [ ] If data stores or network story changed → `SECURITY.md` updated  

## Release awareness

- Push to `main` cuts a release and prunes to latest 3 — say so if about to push.  
- Use `[skip release]` only when the user wants no release.  
- `#minor` / `#major` only when the user asked for that bump.

## Output template

```markdown
## Verify report
- Build: pass | fail — …
- Tests: pass | fail | n/a — …
- PRD: H… pass | fail — …
- Security/third-party docs: ok | needs update — …
- README: ok | needs update — …
- Ready to commit/push: yes | no — blockers …
```

Do not claim ready if build failed or a touched H-id is unmet.
