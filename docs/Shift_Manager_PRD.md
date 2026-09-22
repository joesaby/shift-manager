# Shift Manager – HTML App PRD

2026-09-20 · HTML / offline JSON edition (updated to match shipped UI)

This PRD describes the single-file HTML app (`shift-manager.html` / `shift-manager-offline.zip`). It replaces Excel / Power Apps front-end assumptions from the original PRD while keeping the same business rules. The JSON document (plus optional workspace folder) is the system of record.

---

## 1. Product summary

### Problem

The shift manager builds a four-day duty detail by hand. That is slow and easy to get wrong (wrong person on a skilled role, hard roles on consecutive nights, unfair repeats).

### Solution

An offline web app that:

1. Holds people, roles, qualifications, unit identity, and the current block.
2. Lets the manager set attendance, press Generate, review/edit a **person × role** grid, then print in colour.
3. Saves into a **workspace folder** (recommended) or a single JSON file, with browser `localStorage` backup — no server.

### Primary user

Shift manager at a desk, last night of a block. Others only see the printed rota.

### Workspace model (units)

**Best practice: one folder per unit** (for example `mill-street/`, `pearse-street/`). Each folder holds that unit’s data file, backups, and file-based audit trail. Switching units = finish saving, then **Change folder** (or Open another file). Do not mix two units in one folder.

### Non-goals (for now)

- RDMS leave import
- Shift swaps, overtime, pay
- Multi-user concurrent editing of the same file
- Planning more than one block ahead
- Cloud sync API (OneDrive/SharePoint may hold the folder; the app does not call an API)
- In-app viewer for the folder audit text files (audit is written to disk for accountability)

---

## 2. Goals and success

| Goal | Measure |
| --- | --- |
| Faster roster build | Attendance → generate → print in a few minutes |
| Skill safety | No assignment to an unqualified person (generate or manual) |
| Fair rotation | Same role / hard-night pairing avoided where alternatives exist |
| Durable record | Every Save to log entry can be reopened, printed, or exported |
| Unit clarity | Unit name on screen and on every print |
| Offline first | Works with no network after the HTML file is on disk |
| Accountability | Manager name on new log saves; milestone actions in folder audit files |

---

## 3. Functional requirements

### Must

| ID | Requirement |
| --- | --- |
| H1 | Add, rename, deactivate and delete people |
| H2 | Per person: qualification ticks for every role (People + Skills matrix for skill roles) |
| H3 | Per person: optional fixed role (“only do this”), limited to qualified roles |
| H4 | Set block start date and Day/Night for each of four days |
| H5 | Set status per person per day: Present, Annual leave, Sick leave, Duty away |
| H6 | Generate fills roles for Present people for the block |
| H7 | Generate and manual edit only offer qualified people (hard block) |
| H8 | Fixed-role people get that role when Present |
| H9 | Skill-restricted roles filled before general roles; scarcest first |
| H10 | Prefer not repeating the previous working day’s role when alternatives exist |
| H11 | Hard roles not on back-to-back nights when alternatives exist |
| H12 | Manual cell edit: assign, swap, leave unfilled (person × role grid per day) |
| H13 | Warn on unfilled roles and on stale roster after attendance/setup changes |
| H14 | Colour print: **person × role** tables per day, colours by role group; leave/away/spare listed under |
| H15 | Save block to log; browse, re-print, delete, CSV export; show manager who saved when known |
| H16 | Open / save JSON; `localStorage` backup; **Choose folder** workspace with autosave |
| H17 | Set **unit name** (`meta.unitName`); show on Home, Attendance, Roster, Print, sidebar |
| H18 | Set **manager name** (browser-local); stamp on new Save to log / print snapshots; do not rewrite older entries |

### Should

| ID | Requirement |
| --- | --- |
| H19 | Manage role list: name, group, night use, hard, skill, display order |
| H20 | Manage role groups and print colours |
| H21 | Paste-many for people and roles |
| H22 | Sample dataset for training |
| H23 | Skills screen (matrix for roles marked Needs a skill) |
| H24 | Historic roster: browse saved periods by year / month / block |
| H25 | Duty stats: team load by month (day/night, hard, skill, groups) |
| H26 | Workspace `backups/` (prev + dated snapshots) when folder connected |
| H27 | Folder audit lines under `logs/YYYY/MM/DD/audit_log.txt` for milestones |

### Could (not required yet)

| ID | Requirement |
| --- | --- |
| H28 | Fairness weighted by **historical** assignments across older blocks (today: within current block only) |
| H29 | In-app screen to read folder audit text files |
| H30 | Multiple units inside one JSON (`unitId` on entities) — superseded in practice by one folder per unit |
| H31 | Qualification expiry / notes on person–role links |
| H32 | Cell-level audit of every manual swap (who/when/old/new) in JSON |

---

## 4. User flow and screens

```text
Home (guide)                Each block
─────────────────           ───────────────────────
Unit name + manager    →    1. Attendance
Choose folder (unit)   →    2. Roster (generate / edit)
Roles → People → Skills →   3. Print (+ Save to log)
                            Save stays in folder / file
```

### Screens (nav)

| Screen | Purpose |
| --- | --- |
| **Home** | Workspace status, unit name, manager name, This-block cards, setup checklist, folders=units diagram, generate tips |
| **1. Attendance** | Block start, Day/Night, Present / leave / sick / duty away |
| **2. Roster** | Person × role grid per day; generate; cell assign/swap |
| **3. Print rota** | Colour print layout; Save to log |
| **People** | Searchable person picker; qualifications; fixed role; this month’s load |
| **Skills** | Skill matrix for Needs-a-skill roles |
| **Roles and groups** | Role catalogue, flags, colours, order |
| **Log** | Saved rotas (not the folder audit files); manager column when stamped |
| **Historic roster** | Person × role view of a saved period |
| **Duty stats** | Team workload by month |

### Two meanings of “log”

| Kind | Where | What |
| --- | --- | --- |
| **Log** (UI) | `blocks.history[]` via Save to log | Saved duty rotas for reprint / CSV |
| **Audit** (folder) | `logs/YYYY/MM/DD/audit_log.txt` | Milestone actions (open, save, generate, …). Not shown in UI today |

---

## 5. Business rules (domain)

1. Working pattern: four days on (typically Day, Day, Night, Night), then four off.
2. Day fills all roles; night fills only roles marked used-at-night.
3. Only **Present** people are allocated.
4. Skill-restricted roles are a hard block on qualification.
5. Fixed role always wins when Present.
6. One block planned at a time per data file / folder.
7. Soft constraints (no same-role repeat, no hard-on-hard nights) may yield if no feasible roster exists; UI must still warn on empty cells.
8. Changing manager name affects **new** audit lines and **new** Save to log / print stamps only.

---

## 6. Persistence

### Workspace folder (recommended, Chromium)

When connected via **Choose folder**:

| Path | Content |
| --- | --- |
| `shift-manager-data.json` | Full document (autosaved while editing) |
| `backups/shift-manager-data.prev.json` | Previous copy |
| `backups/shift-manager-data-YYYYMMDD-HHMMSS.json` | Timed snapshots (capped) |
| `logs/YYYY/MM/DD/audit_log.txt` | Append-only audit lines |

### Fallbacks

- **Save file / Open file** — single JSON (File System Access or download).
- **`localStorage`** — browser backup; must not be overwritten by demo mock if the manager already has saved data.
- **Manager name** — stored in browser (`localStorage`), not in the unit JSON.

### Demo mock

When serving over `http` next to `data/shift-manager-data.json`, mock may auto-load **only** if this browser has no existing saved people/roles/unit data.

---

## 7. JSON data model

### Design principles

1. **One document, versioned** — portable offline file.
2. **Entities as arrays** — same grain as Excel tables.
3. **Junction table** — `personRoles` for qualifications.
4. **Facts as rows** — attendance and assignments by date.
5. **Working set vs history** — `blocks.current` vs `blocks.history`.
6. **Stable string IDs** — never reuse after delete.
7. **Live schema is `schemaVersion: 2`** — v1 files migrate on open.

### Schema (`schemaVersion: 2`) — as shipped

```json
{
  "schemaVersion": 2,
  "meta": {
    "title": "Shift Manager",
    "unitName": "Mill Street",
    "updatedAt": "2026-09-20T14:00:00.000Z",
    "app": "shift-manager-html"
  },
  "settings": {
    "statuses": [
      { "id": "present", "label": "Present", "allocates": true, "printColor": "#EAF4EC" },
      { "id": "annual_leave", "label": "Annual leave", "allocates": false, "printColor": "#BBDEFB" },
      { "id": "sick_leave", "label": "Sick leave", "allocates": false, "printColor": "#FFCDD2" },
      { "id": "duty_away", "label": "Duty away", "allocates": false, "printColor": "#E1BEE7" }
    ],
    "defaultShifts": ["Day", "Day", "Night", "Night"],
    "blockLengthDays": 4
  },
  "groups": [
    { "id": "g_car", "name": "Car", "color": "#F8BBD0", "sortOrder": 1 }
  ],
  "roles": [
    {
      "id": "r_gs101",
      "name": "Car 1",
      "groupId": "g_car",
      "usedAtNight": true,
      "hard": true,
      "skillRestricted": true,
      "sortOrder": 1
    }
  ],
  "people": [
    {
      "id": "p_owen",
      "name": "Owen Lyons",
      "active": true,
      "fixedRoleId": null
    }
  ],
  "personRoles": [
    { "personId": "p_owen", "roleId": "r_gs101" }
  ],
  "blocks": {
    "current": {
      "id": "b_current",
      "startDate": "2026-09-21",
      "shifts": ["Day", "Day", "Night", "Night"],
      "stale": false,
      "generatedAt": null,
      "attendance": [
        { "date": "2026-09-21", "personId": "p_owen", "statusId": "present" }
      ],
      "assignments": [
        {
          "date": "2026-09-21",
          "roleId": "r_gs101",
          "personId": "p_owen",
          "source": "generated"
        }
      ]
    },
    "history": [
      {
        "id": "b_log1",
        "savedAt": "2026-09-17T22:10:00.000Z",
        "savedBy": "Jose Sebastian",
        "startDate": "2026-09-13",
        "shifts": ["Day", "Day", "Night", "Night"],
        "attendance": [],
        "assignments": [],
        "snap": { "layout": "person-role", "unitName": "Mill Street", "savedBy": "Jose Sebastian" },
        "records": []
      }
    ]
  },
  "audit": []
}
```

Notes:

- `meta.unitName` is the unit shown in UI and print.
- `blocks.history[].savedBy` / `snap.savedBy` stamp the manager at Save to log time.
- `audit[]` in JSON is reserved; the live audit trail for milestones is the folder `audit_log.txt` files.
- Print/view snapshots use `layout: "person-role"` (legacy role×day snaps still render when present).

### Entity dictionary

| Collection | Purpose |
| --- | --- |
| `meta` | File identity; **`unitName` required for clear prints** |
| `settings` | Statuses, default shifts, block length |
| `groups` | Print colour bands |
| `roles` | Catalogue + night / hard / skill / order |
| `people` | Team; `fixedRoleId`; `active` |
| `personRoles` | Qualifications |
| `blocks.current` | Working four-day set |
| `blocks.history[]` | Committed rotas + snap for reprint |

### Invariants

1. `fixedRoleId`, if set, must be a role the person is qualified for.
2. Assignments only for Present people (or warn).
3. Assignment person must be qualified for that role.
4. At most one person per `(date, roleId)`; at most one role per `(date, personId)`.
5. Role `sortOrder` defines display/generate order.
6. `schemaVersion` known or migrated.

### v1 → v2

Older `v: 1` nested-map files migrate on open; the app writes v2 thereafter.

---

## 8. Module boundaries

Source is modular under `src/js/` and bundled to one HTML via `npm run build`:

```text
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│ UI screens  │ ←→  │ Domain       │ ←→  │ Document + FS   │
│ Home, att…  │     │ generate,    │     │ load/save/      │
│             │     │ model, rules │     │ migrate, folder │
└─────────────┘     └──────────────┘     └─────────────────┘
```

---

## 9. Non-functional requirements

| Area | Requirement |
| --- | --- |
| Runtime | Chrome/Edge preferred (folder picker); other browsers for Open/Save file |
| Network | None required at runtime |
| Delivery | Single offline HTML (~350 KB) or zip of that file |
| Performance | Generate four days for ~25 people / 16 roles in well under 2s |
| Print | Colour; crest; unit name; optional “Prepared by” |
| Resilience | Folder backups; `localStorage`; dirty badge; confirm before destructive clear |
| Security | Local only; no telemetry |

---

## 10. Acceptance criteria (current product)

1. Home shows unit field, manager Set/Change, This-block cards, folders=units guidance.
2. Choose folder → edits autosave to `shift-manager-data.json`; audits appear under `logs/`.
3. Unit name appears on Roster/Print header and survives reload when not clobbered by mock.
4. Skills matrix and People qualifications agree for skill-restricted roles.
5. Generate → person × role roster → print shows group colours and leave tables.
6. Save to log → Log lists entry with manager when set → View/Print keeps that name after manager rename.
7. Historic roster and Duty stats read from history + current block.
8. Open a v1 file → migrated to v2 without data loss.

---

## 11. Open questions

1. Should Generate refuse to run while `stale === true`, or only warn? (**Today: warn.**)
2. Soft-fallback vs fail loudly when hard-night rules cannot be met? (**Today: soft + unfilled cells.**)
3. When to weight Generate from Log history (H28)?
4. Whether to add an in-app Audit viewer for `logs/**/audit_log.txt` (H29).
5. Shared network folder: is last-write-wins enough, or warn on `meta.updatedAt` conflicts?

---

## 12. Relationship to Excel / Power Apps docs

| Topic | Excel / Design Spec | This HTML PRD |
| --- | --- | --- |
| Rules & roles | Same domain | Same |
| Storage | Excel tables | v2 JSON + optional workspace folder |
| Front end | Sheets / Power Apps | Offline HTML (Home-first UX) |
| Shared future | — | v2 JSON remains the contract |

The HTML app is the shipping path. Older Design Spec / PDF PRDs are historical.
