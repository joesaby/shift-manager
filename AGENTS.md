# Agent instructions — Shift Manager

Offline single-file duty-rota app for An Garda Síochána shift managers. No server, no telemetry, no runtime CDN.

## Commands

```bash
npm install
npm run build          # → dist/shift-manager.html + offline zips
npm run mock-data      # optional local mock JSON for http serving
```

Open `dist/shift-manager.html` (or the unzipped release HTML) in Chrome/Edge.

## Architecture

| Path | Role |
| --- | --- |
| `src/js/main.js` | App shell: screens map, `data-act` / `data-ch` wiring, re-render |
| `src/js/state.js` | In-memory `S`, localStorage backup, file open/save |
| `src/js/model.js` | Schema v2, attendance, generate helpers, migrations |
| `src/js/generator.js` | Roster allocation rules |
| `src/js/workspace.js` | Folder picker + autosave (File System Access API) |
| `src/js/audit.js` | Manager name + folder audit lines |
| `src/js/snapshot.js` | Print/log snapshots (`person-day` current; legacy layouts still render) |
| `src/js/screens/*.js` | One module per screen: `vX`, `actions`, optional `changes` |
| `src/js/ui-kit.js` | Nav shell, dialogs |
| `src/styles/tailwind.css` | Vendored Tailwind + DaisyUI CSS (do not fetch at runtime) |
| `src/styles/app.css` | Print / home layout extras |
| `build.mjs` | esbuild bundle → single HTML + zip |

UI pattern: screens return HTML strings; clicks use `data-act="…"`; inputs use `data-ch="…"`. Always HTML-escape user text with `esc()` from `util.js`.

## Hard constraints

1. **Stay offline.** No new network calls, analytics, CDNs, or cloud APIs in runtime code. The only `fetch` is optional same-origin mock JSON when served over http — keep it that way.
2. **Ship one HTML file.** Runtime must work from `file://` after `npm run build`. Do not require Node for managers.
3. **No auth in-app.** Access control is OS / folder / browser profile — document, don’t fake SSO.
4. **Preserve schema compatibility.** Prefer migrate-on-open in `model.js`; don’t break existing `shift-manager-data.json` without a migration path. Keep rendering old log snaps (`person-role` / legacy).
5. **Security docs stay true.** If you change data stores or third-party packaging, update `SECURITY.md` and `docs/THIRD_PARTY.md`.
6. **Surgical diffs.** Match existing style; don’t refactor unrelated code.

## Product source of truth

- Operator docs: `README.md`
- Requirements: `docs/Shift_Manager_PRD.md`
- Licence / terms: `LICENSE`, `TERMS.md`
- Security / third-party: `SECURITY.md`, `docs/THIRD_PARTY.md`

## Release

- Push to `main` → `.github/workflows/release.yml` builds the zip, tags a **patch** semver, publishes a GitHub Release.
- Keeps only the **latest 3** releases (n, n−1, n−2); older tags/releases are deleted.
- Commit message markers: `#minor`, `#major`, `[skip release]`.
- Prefer releasing from `main` via the workflow; don’t hand-craft release zips unless asked.

## Domain reminders

- Block = four days (typically Day, Day, Night, Night).
- Day fills roles with `usedAtDay`; night fills `usedAtNight`.
- Only **Present** people allocate; Rest day / leave / duty away do not.
- Print layout is **person × day** (`layout: "person-day"`); spares get editable notes before print.
- One workspace folder per unit.

## Skills (feature workflow)

Project skills (same content in all three trees):

- `.cursor/skills/`
- `.agents/skills/`
- `.claude/skills/`

Skills: **architect**, **tdd**, **verify**.

1. **architect** — map work to PRD H-ids + docs; design brief or fit review  
2. **tdd** — failing check first for domain rules (`model` / `generator` / migrations)  
3. **verify** — `npm run build` (+ `npm test` if present), PRD/security acceptance before commit  

Typical order for non-trivial behaviour: architect → tdd → implement → verify.

## Out of scope (for now)

RDMS leave import, shift swaps/overtime/pay, multi-user concurrent edit, cloud sync API, in-app audit file viewer.
