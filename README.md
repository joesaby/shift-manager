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

1. **Attendance** — block start date, Day/Night per day, status per person (Present, Annual leave, Sick leave, Duty away, Rest day), then **Generate roster**.
2. **Roster** — review and edit the person × role grid (qualified + present only).
3. **Print rota** — person × day colour layout (A4 landscape); type spare notes if needed; **Print in colour**; **Save to log**.

**Log** (sidebar) holds saved rotas. Folder `logs/` is the file audit trail (not shown in the UI).

## Screens

| Screen | Purpose |
| --- | --- |
| Home | Unit, manager, folder, this-block path |
| 1. Attendance | Dates, shifts, who is working |
| 2. Roster | Generate and edit assignments |
| 3. Print rota | Colour print and save to log |
| People / Skills / Roles and groups | Team setup |
| Log | Saved rotas, CSV |
| Historic roster / Duty stats | Past blocks and monthly load |

## Develop

```bash
npm install
npm run build
```

Produces `dist/shift-manager.html`, `dist/shift-manager-offline.zip`, and `dist/shift-manager-offline-vX.Y.Z.zip`. Locally it also writes `../shift-manager.html`.

Every push to `main` publishes a patch release and keeps only the **latest 3** GitHub Releases (current, n−1, n−2). Older releases and tags are deleted. Use `#minor` / `#major` in the commit message to bump those; `[skip release]` to skip.

## Docs

| Doc | Contents |
| --- | --- |
| [`SECURITY.md`](SECURITY.md) | Offline posture, data stores, deployment |
| [`TERMS.md`](TERMS.md) | Plain-language use terms; MIT / no warranty |
| [`docs/THIRD_PARTY.md`](docs/THIRD_PARTY.md) | Tailwind, DaisyUI, esbuild |
| [`docs/Shift_Manager_PRD.md`](docs/Shift_Manager_PRD.md) | Product requirements |
| [`LICENSE`](LICENSE) | MIT |
