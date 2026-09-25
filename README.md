# Shift Manager

Offline duty-rota app for a four-day block. Open one HTML file in a browser — nothing is sent over the internet.

Built for An Garda Síochána shift managers. See [`SECURITY.md`](SECURITY.md), [`TERMS.md`](TERMS.md), and [`docs/THIRD_PARTY.md`](docs/THIRD_PARTY.md).

## Run

1. Download the latest **`shift-manager-offline-vX.Y.Z.zip`** from [Releases](https://github.com/joesaby/shift-manager/releases).
2. Unzip and open `shift-manager.html` in **Chrome** or **Edge** (Firefox works for most features; **Choose folder** needs Chromium).
3. On **Home**, set **Unit name** and **Manager name**, then **Choose folder** — one folder per unit.

Data stays in that folder (`shift-manager-data.json`, `backups/`, `logs/`). You can also use **Save file** / **Open file**; the browser keeps a local backup.

## Setup (once per unit)

| Step | Where |
| --- | --- |
| Unit + manager names, workspace folder | Home |
| Duty roles, print colours, day/night flags, hard / skill roles | Roles and groups |
| People, qualifications, optional fixed role | People |
| Skill matrix (roles marked Needs a skill) | Skills |

Untick **Active** on People when someone leaves long term.

## Each block

1. **Attendance** — block start date, Day/Night per day, status per person (Present = green; Annual leave / Sick leave / Duty away / Rest day = blue / unavailable), then **Generate roster** once.
2. **Roster** — person × day layout. Drag a **parking-lot** chip onto a person to fill a vacated essential role; drag people to swap. Non-essential roles vacated by sick silently drop for that day. **Save roster**, then **Print** (or **Save & print** if unsaved). Above the grid, **Briefing sheet** has **Print Thu** / **Print Fri** / … — a one-page briefing sheet for that day only, sorted by role (name + employee / shoulder numbers), for parade use; it does not change the saved roster order.

Free-text spare notes ("HVB") are gone: anyone with no role shows **Unassigned**. Notes typed in an older version are cleared from the current block when the file is opened; rotas already saved to the Log keep theirs.

On **Roles and groups**, tick **Essential** for duties that must be filled; leave it unticked for spare work (e.g. Files 1–5). List order among non-essential roles is fill priority.

**Log** (sidebar) holds saved rotas. Folder `logs/` is the file audit trail (not shown in the UI).

## Screens

| Screen | Purpose |
| --- | --- |
| Home | Unit, manager, folder, this-block path |
| 1. Attendance | Dates, shifts, who is working |
| 2. Roster | Generate once, edit, Save roster, print; Print day per column |
| People / Skills / Roles and groups | Team setup (Essential flag on roles) |
| Log | Saved rotas, CSV |
| Historic roster | Past blocks: same person × day layout as Roster (read-only) |
| Duty stats | Person × role counts for a month — use ▲ ▼ at the top of any column to sort (e.g. ▼ on a role, to see who did it most); tallies at the end |

## Develop

```bash
npm install
npm run build
npm run mock-data   # writes data/shift-manager-data.json (fictional demo unit)
```

Produces `dist/shift-manager.html`, `dist/shift-manager-offline.zip`, and `dist/shift-manager-offline-vX.Y.Z.zip`. Locally it also writes `../shift-manager.html`.

**Load the local demo:** open `dist/shift-manager.html`, then **Open file** and choose `data/shift-manager-data.json` (12 people, 10 roles — all fictional). Or serve the repo over `http` so the app can auto-load `data/shift-manager-data.json` when the browser has no saved unit yet.

Every push to `main` publishes a patch release and keeps only the **latest 3** GitHub Releases (current, n−1, n−2). Older releases and tags are deleted. Use `#minor` / `#major` in the commit message to bump those; `[skip release]` to skip.

## Docs

| Doc | Contents |
| --- | --- |
| [`AGENTS.md`](AGENTS.md) / [`CLAUDE.md`](CLAUDE.md) | Guidance for coding agents |
| [`.cursor/skills/`](.cursor/skills/), [`.agents/skills/`](.agents/skills/), [`.claude/skills/`](.claude/skills/) | architect / tdd / verify (same content) |
| [`SECURITY.md`](SECURITY.md) | Offline posture, data stores, deployment |
| [`TERMS.md`](TERMS.md) | Plain-language use terms; MIT / no warranty |
| [`docs/THIRD_PARTY.md`](docs/THIRD_PARTY.md) | Tailwind, DaisyUI, esbuild |
| [`docs/Shift_Manager_PRD.md`](docs/Shift_Manager_PRD.md) | Product requirements |
| [`LICENSE`](LICENSE) | MIT |
