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
| Duty roles, print colours, day/night flags, hard roles, the **Files role** (Up / Down set the order) | Roles and groups |
| People, qualifications (tick every role each person can do — **Select all**, then untick the one or two they can't), optional fixed role (on a day they are taken off it, they can be given Files or another role on Roster), optional **Probationer** tick (two Probationers are not put in the same **probationer group** — set up on Roles and groups — on the same day where it can be avoided) | People |

Untick **Active** on People when someone leaves. For a long sickness, tick **Long-term sick** on that person (with a From date and an optional To date): every Attendance day in that period is Sick leave automatically, in every block. Change a single day on Attendance to override it.

## Each block

1. **Attendance** — block start date, Day/Night per day, status per person (Present = green; Annual leave / Sick leave / Paternity leave / Duty away / Rest day = blue / unavailable; for **Duty away** a box appears to type the exact reason, which is shown on the roster, print and briefing sheet while still counting as Duty away; tick **AL** beside a name for annual leave on all days), then **Generate roster** once. Generate gives each role to whoever has done it least, as a share of their own duties, over the last 12 months of rosters saved to the Log (only days they were Present count), so **Save roster** every block to keep Duty stats even. If one role is ticked **Files role**, everyone still free after the other roles gets Files (any number a day), and who ends up spare is rotated by how often each person has had Files.
2. **Roster** — person × day layout. Drag a **parking-lot** chip onto a person to fill a vacated essential role; drag people to swap. Non-essential roles vacated by sick silently drop for that day. **Save roster** (the badge beside it is bright red **Unsaved changes** until the roster is saved to the Log, then grey **Saved**; the top-left badge is separate and tracks the data file), then **Print** (or **Save & print** if unsaved). Above the grid, **Briefing sheet** has **Print Thu** / **Print Fri** / … — a one-page briefing sheet for that day only, in the same order as Roles and groups (name + employee / shoulder numbers), for parade use, headed **Briefing sheet** with the date, with anyone on annual leave, sick, rest day or duty away listed at the bottom; it does not change the saved roster order. In the toolbar, **Tally ▾** adds an attendance-count row under each day (Present, leave, sick, …) that prints with the roster, and **Black borders** prints black cell lines instead of light grey (both are remembered in this browser). Click a name to highlight a row and use ↑ / ↓ to move the highlight. Each Files cell shows when that person last had Files (screen only, not printed), to help pick who to move into an essential role at short notice. On **Attendance**, each day's header shows who is away by type.

**Short-staffed and borrowed someone from another unit?** On **Roster**, type their name under the table and press **Add to roster**: they get an extra row at the bottom, tagged *Borrowed*. Drag a parking-lot chip onto them (or pick from their **Add role** list) so the duty shows on the printed duty detail and briefing sheet. They are not on People, are not counted in Attendance or Duty stats, and are never touched by Generate. They can't take the Files role. Tick **Overtime** beside their name if they are in on overtime: the word *Overtime* then prints next to their name on the roster. Use × on their row to remove them; **Start over / Regenerate** also removes them. They are saved with the roster, so reopening it from the Log shows them.

Free-text spare notes are gone: anyone with no role shows **Unassigned**. Notes typed in an older version are cleared from the current block when the file is opened; rotas already saved to the Log keep theirs.

On **Roles and groups**, tick **Essential** for duties that must be filled; leave it unticked for spare work (e.g. Files 1–5). List order among non-essential roles is fill priority.

**Log** (sidebar) holds saved rotas, past and planned. **View** shows one, **Edit** reopens it on the Roster screen to correct it (you are asked to save your current roster first if it has unsaved changes), and Save roster then replaces that entry. A roster whose four days have passed can be corrected but not regenerated. Folder `logs/` is the file audit trail (not shown in the UI).

## Screens

| Screen | Purpose |
| --- | --- |
| Home | Unit, manager, folder, this-block path |
| 1. Attendance | Dates, shifts, who is working |
| 2. Roster | Generate once, edit, Save roster, print; Print day per column |
| People / Roles and groups | Team setup (Essential flag on roles) |
| Log | Saved rotas, View / Edit, CSV |
| Duty stats | Person × role counts over any period (default: everything up to today) — ▲ ▼ on a column sorts it (e.g. ▼ on a role, to see who did it most); tallies at the end. Click a name for a printable report on just that person, with role counts and attendance (sick, annual leave, …) |

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
| [`.cursor/hooks.json`](.cursor/hooks.json) / [`.claude/settings.json`](.claude/settings.json) | Architect gate: Mode A before edits; Mode B on stop after feature work |
| [`SECURITY.md`](SECURITY.md) | Offline posture, data stores, deployment |
| [`TERMS.md`](TERMS.md) | Plain-language use terms; MIT / no warranty |
| [`docs/THIRD_PARTY.md`](docs/THIRD_PARTY.md) | Tailwind, DaisyUI, esbuild |
| [`docs/Shift_Manager_PRD.md`](docs/Shift_Manager_PRD.md) | Product requirements (shift-manager stories) |
| [`docs/Shift_Manager_Spec.md`](docs/Shift_Manager_Spec.md) | Technical / design spec the PRD points to |
| [`docs/PRD_Deprecated.md`](docs/PRD_Deprecated.md) | Retired / superseded requirements |
| [`LICENSE`](LICENSE) | MIT |
