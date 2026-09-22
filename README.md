# Shift Manager

Offline duty-rota app for a four-day block. Open the HTML file in a browser — nothing is sent over the internet.

**Security & third-party software:** see [`SECURITY.md`](SECURITY.md) and [`docs/THIRD_PARTY.md`](docs/THIRD_PARTY.md) (written for ICT / information-security review).

**To run:** open `shift-manager.html` (or `dist/shift-manager.html`) in Chrome or Edge. Firefox works for most features; **Choose folder** needs a Chromium browser.

**In the app:** open **Home** for setup, unit/manager names, and the Attendance → Roster → Print path.

---

## Quick start

1. Open the app.
2. On **Home**, set **Unit name** and **Manager name** (Change / Set).
3. Prefer **Choose folder** (Chrome/Edge) — **one folder per unit** — so data, backups, and audit lines save there. Otherwise use **Save file** / **Open file**.
4. Optionally **Load sample data**, or set up roles, people, and skills.

---

## Setting up (once per unit folder)

### Unit and folder

1. On **Home**, enter the **Unit name** (shown on roster and print).
2. **Choose folder** for that unit (for example `mill-street/`). Another unit = another folder; use **Change folder** after saving.
3. Set **Manager name** for the audit log and for “Prepared by” on newly saved rotas. Changing it does not rewrite older Log entries.

### Roles and groups

1. Open **Roles and groups**.
2. Add each duty role (or **Paste many**).
3. For each role set: **Group** (print colour), **Used at night**, **Hard role**, **Needs a skill**.
4. Order roles with **Up** / **Down**.

### People and skills

1. Open **People** — pick a person from the searchable list, tick qualifications, set **Only do this role** if needed.
2. Open **Skills** for the skill matrix (roles marked Needs a skill).
3. Untick **Active** when someone leaves long term.

### Save

- **Choose folder** — recommended; autosave + `backups/` + `logs/YYYY/MM/DD/audit_log.txt`.
- Or **Save file** / **Open file**.
- Browser also keeps a local backup.

---

## Every four days

### 1. Attendance

1. Set **Block starts** and Day/Night per day.
2. Mark Present / Annual leave / Sick leave / Duty away.
3. Press **Generate roster**.

### 2. Roster

1. Person × role grid per day tab.
2. Click cells to assign or change (qualified + present only).
3. Continue to **Print rota**.

### 3. Print rota

1. **Print in colour**.
2. **Save to log** to keep a dated copy (stamped with manager name when set).

### Log vs folder audit

- **Log** (sidebar) = saved **rotas** from Save to log.
- Folder **`logs/`** = **audit trail** (open/save/generate). Not shown in the UI; open the text file in the folder if needed.

### Historic roster / Duty stats

- Browse past blocks and monthly team load from saved history + the current roster.

---

## Screens at a glance

| Screen | Purpose |
| --- | --- |
| Home | Unit, manager, folder guidance, This-block cards, setup checklist |
| 1. Attendance | Dates, shifts, who is working |
| 2. Roster | Person × role generate and edit |
| 3. Print rota | Colour print and save to log |
| People | Team, qualifications, fixed role |
| Skills | Skill matrix |
| Roles and groups | Role catalogue and colours |
| Log | Saved rotas, CSV, manager column |
| Historic roster | Past person × role grids |
| Duty stats | Monthly team load |

---

## Tips

- Sample data replaces what is loaded (confirm first).
- Opening over `http` next to `data/` may load mock data only if this browser has no prior saved data.
- Old v1 JSON files upgrade to schema v2 on open.

---

## For developers

```bash
cd shift-manager
npm install
npm run build
```

Writes `dist/shift-manager.html`, `../shift-manager.html` (local only), `dist/shift-manager-offline.zip`, and a versioned zip (`dist/shift-manager-offline-vX.Y.Z.zip` from `package.json` or `VERSION`).

### Release

Every push to `main` cuts a patch release (`v1.0.0` → `v1.0.1`) and publishes the offline zip.

- Put `#minor` or `#major` in the commit message to bump those instead.
- Put `[skip release]` in the commit message to skip publishing.

---

## Documentation

| Doc | What it covers |
| --- | --- |
| [`SECURITY.md`](SECURITY.md) | Offline posture, data stores, deployment, reporting |
| [`docs/THIRD_PARTY.md`](docs/THIRD_PARTY.md) | Tailwind, DaisyUI, esbuild, and other third-party use |
| [`docs/Shift_Manager_PRD.md`](docs/Shift_Manager_PRD.md) | Current PRD — scope, screens, persistence, schema v2, acceptance |
| [`docs/Shift Manager App – Design Spec.md`](<docs/Shift Manager App – Design Spec.md>) | Original Excel/Power Apps design notes (historical) |
| [`docs/Shift Manager App – PRD.pdf`](<docs/Shift Manager App – PRD.pdf>) | Original Excel/Power Apps PRD (historical) |
