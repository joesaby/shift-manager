# Shift Manager – HTML App PRD

2026-09-27 · HTML / offline JSON edition (updated to match shipped UI)

This PRD describes the single-file HTML app (`shift-manager.html` / `shift-manager-offline.zip`). It replaces Excel / Power Apps front-end assumptions from the original PRD while keeping the same business rules. The JSON document (plus optional workspace folder) is the system of record.

**Deprecated / retired requirements** are not kept here as current Must/Should/Could — move them to [`PRD_Deprecated.md`](PRD_Deprecated.md) and leave a one-line pointer if needed.

### Shipped highlights (2026-09)

Essential vs non-essential roles; attendance changes without regenerate + parking lot for vacated essentials; unified person × day **Roster**; Save roster upsert / print only what is saved; employee & shoulder numbers; print scale-to-fit + collapsible sidebar; Duty stats person × role pivot + person report; per-day briefing sheets. Detailed session notes live in git history — not restated below.

---

## 1. Product summary

### Problem

The shift manager builds a four-day duty detail by hand. That is slow and easy to get wrong (wrong person on a skilled role, hard roles on consecutive nights, unfair repeats).

### Solution

An offline web app that:

1. Holds people, roles, qualifications, unit identity, and the current block.
2. Lets the manager set attendance, press Generate once, then review/edit a **person × day Roster** (same layout as print), including same-day swaps and vacated-role callouts, then print in colour.
3. Saves into a **workspace folder** (recommended) or a single JSON file, with browser `localStorage` backup — no server.

### Primary user

Shift manager at a desk, last night of a block. Others only see the printed rota.

### Workspace model (units)

**Best practice: one folder per unit** (for example `cedar-quay/`, `harbour-bridge/` — fictional names in docs only). Each folder holds that unit’s data file, backups, and file-based audit trail. Switching units = finish saving, then **Change folder** (or Open another file). Do not mix two units in one folder.

---

## 2. Goals and success

| Goal | Measure |
| --- | --- |
| Faster roster build | Attendance → generate once → edit Roster → print in a few minutes |
| Skill safety | No assignment to an unqualified person (generate or manual) |
| Fair rotation | Same role / hard-night pairing avoided where alternatives exist |
| Durable record | Every **Save roster** upsert can be reopened, printed, or exported; folder audit lines record each save |
| Unit clarity | Unit name on screen and on every print |
| Offline first | Works with no network after the HTML file is on disk |
| Accountability | Manager name on new log saves; milestone actions in folder audit files |

---

## 3. Functional requirements

Written from the shift manager's side: **As a shift manager, I …**. Grouped by what I do, not by screen. Each row keeps its stable **H-id** (used in code, tests and the Generate rules table below) and a priority. **Spec** points to [`Shift_Manager_Spec.md`](Shift_Manager_Spec.md) for the technical and design detail (layout, CSS, stored fields, code paths). Retired rows → [`PRD_Deprecated.md`](PRD_Deprecated.md).

*Evolving this table:* a new H-id is for a new thing the manager can do. A tweak to how an existing thing looks or behaves is edited in its Spec entry, not given a new id.

### 3.1 My team (People)

| ID | Priority | Requirement | Spec |
| --- | --- | --- | --- |
| H1 | Must | As a shift manager, I can add, rename, deactivate and delete people, so the list matches my team. | S1 |
| H34 | Must | As a shift manager, I see people sorted by surname, so I find someone the way I think of them. | S1 |
| H2 | Must | As a shift manager, I tick every role each person is qualified for, in one place (People), with Select all / Clear all to save clicks, so Generate and manual edits only ever offer people who can do the job. | S2 |
| H3 | Must | As a shift manager, I can give someone a fixed role ("only do this"), chosen from roles they are qualified for. | S2 |
| H53 | Must | As a shift manager, I can record each person's employee number and shoulder number, search by them, and see them on the Roster and print. | S1 |
| H67 | Must | As a shift manager, I can mark someone long-term sick with a From date and an optional To date, so every block counts them as Sick leave without me clicking each day, and I can still override a single day by hand. | S3 |
| H21 | Should | As a shift manager, I can paste many people (or roles) at once instead of typing them one by one. | S1 |
| H22 | Should | As a shift manager, I can load a sample dataset, so I can train new managers without real data. | S1 |

### 3.2 My duties (Roles and groups)

| ID | Priority | Requirement | Spec |
| --- | --- | --- | --- |
| H19 | Should | As a shift manager, I manage the role list — name, group, day/night use, hard, essential, once per block, Files role — and put roles in order with Up / Down. | S4 |
| H20 | Should | As a shift manager, I manage role groups, and give each role its own print colour (roles in a group can share one), so the roster is easy to read at a glance. | S4 |
| H35 | Must | As a shift manager, I say whether a role is used by day, at night or both, so each shift only gets the roles it needs. | S4 |
| H43 | Must | As a shift manager, I mark roles as essential, and essential roles are listed first, so the ones that must be covered are clear. | S4 |
| H70 | Must | As a shift manager, I can mark roles "once per block", so nobody gets that kind of duty (e.g. Files 1–5) twice in a block. | S5 |
| H73 | Must | As a shift manager, I can mark one role as the Files role, so everyone still free after the real roles are filled (and ticked for Files) lands on Files instead of being left with nothing. | S5 |

### 3.3 Planning the block and attendance

| ID | Priority | Requirement | Spec |
| --- | --- | --- | --- |
| H4 | Must | As a shift manager, I set the block start date and Day or Night for each of the four days. | S6 |
| H5 | Must | As a shift manager, I set each person's status for each day — Present, Annual leave, Sick leave, Paternity leave, Duty away, Rest day — and tick AL beside a name to put them on Annual leave for the whole block. For Duty away I can type the exact reason, which shows on the roster, print and briefing sheet while still counting as Duty away. | S6 |
| H33 | Must | As a shift manager, I can mark a Rest day, which isn't allocated and shows as a status on the Roster and print. | S6 |
| H41 | Must | As a shift manager, I see the same status colours on Attendance and Roster (Present green; all the unavailable statuses one shared blue). | S6 |
| H40 | Must | As a shift manager, I see each day's date prominently with how many are present and how many essential roles there are to fill. | S6 |
| H42 | Must | As a shift manager, I keep the day / shift header in view while scrolling a long list of people. | S6 |
| H66 | Must | As a shift manager, I see at a glance who is away each day (a count per status in each day's header on Attendance), and can tick a Tally on the Roster that prints a count row under each day. | S6 |

### 3.4 Generating the roster

| ID | Priority | Requirement | Spec |
| --- | --- | --- | --- |
| H6 | Must | As a shift manager, I press Generate and it fills roles for the people who are Present, essential roles first, then the rest from whoever remains. | S7 |
| H44 | Must | As a shift manager, I get essential roles covered first, then non-essential roles in my list order, then Files taking everyone left; a role nobody can fill stays blank rather than failing. | S7 |
| H7 | Must | As a shift manager, I am only ever offered qualified people, by Generate and by manual edit alike. | S7 |
| H8 | Must | As a shift manager, I get fixed-role people in their fixed role whenever they are Present. | S7 |
| H28 | Must | As a shift manager, I get duties shared fairly: each role goes to the qualified, Present person who has done it least as a share of their own duties over the last 12 months, so counts even out over time and a new starter isn't stuck with the same role. | S7 |
| H10 | Must | As a shift manager, I prefer people not to repeat the previous day's role when someone else can cover. | S7 |
| H71 | Must | As a shift manager, I avoid giving anyone a role from the same group (e.g. Car) two days running when someone else can cover. | S7 |
| H75 | Must | As a shift manager, I can tick **Probationer** on a person, so two Probationers are not put in the same **probationer group** (small groups of roles I set up under Roles and groups) on the same day when anyone else can be swapped in. | S7 |
| H11 | Must | As a shift manager, I avoid hard roles on back-to-back nights when someone else can cover. | S7 |
| H13 | Must | As a shift manager, I am warned about unfilled essential roles — never blocked from Generate or Print — and not nagged about non-essential ones or about attendance-only changes. | S7 |
| H48 | Must | As a shift manager, I generate once per block; after that it is a deliberate "Start over / Regenerate" with a warning that it discards my manual edits. | S7 |
| H69 | Must | As a shift manager, I can't accidentally regenerate a roster for a block that has already passed; I can still correct and save it. | S7 |
| H9 | — | *Retired 2026-09-30.* Skill-first / scarcest-first fill order → [`PRD_Deprecated.md`](PRD_Deprecated.md); replaced by H28 | — |

### 3.5 Adjusting the roster

| ID | Priority | Requirement | Spec |
| --- | --- | --- | --- |
| H46 | Must | As a shift manager, I do all post-generate work on one screen — the person × day Roster — with Save roster and Print there. | S8 |
| H36 | Must | As a shift manager, I see each person down the side and each day across, with the duty or status coloured by role group. | S8 |
| H12 | Must | As a shift manager, I can assign, move and unassign people by hand on the Roster. | S9 |
| H37 | Must | As a shift manager, I see a Present person with no role as "Unassigned" and can give them a role straight from a dropdown of what's still unfilled, without going via the parking lot. | S9 |
| H45 | Must | As a shift manager, when someone goes sick the roles they vacate appear in a parking lot (essential roles only), and return to them if they come back. | S9 |
| H47 | Must | As a shift manager, I can drag a parked role onto a person, or drag people between cells, to make same-day swaps — impossible moves are refused and every move is confirmed. | S9 |
| H74 | Must | As a shift manager, I see on each Files cell when that person last did Files (or "first time"), to help me choose who to pull into an essential role at short notice; it is not printed. | S9 |
| H54 | Must | As a shift manager, I see the whole roster at once on a laptop, without sideways scrolling. | S8 |
| H55 | Must | As a shift manager, I get a compact one-row toolbar on the Roster, so the table gets the room. | S8 |
| H56 | Must | As a shift manager, I see the table fill the screen height, so about 30 people fit with only the rows scrolling. | S8 |
| H38 | Must | As a shift manager, I keep the day headers, the parking lot and the names in view when scrolling, and my place isn't lost when I change a cell or drag near the edge. | S8 |
| H63 | Must | As a shift manager, I see name and number columns sized to their content, so every person fits on one line. | S8 |
| H64 | Must | As a shift manager, I can click a name to highlight that person's row and step through with ↑ / ↓, without changing or saving anything. | S8 |

### 3.6 Printing

| ID | Priority | Requirement | Spec |
| --- | --- | --- | --- |
| H14 | Must | As a shift manager, I can print the saved roster in colour as a person × day grid that fits one A4 landscape page, showing status text where someone isn't Present. | S10 |
| H39 | Must | As a shift manager, I get a clean one-page A4 landscape print, without the parking lot, drag handles or highlights. | S10 |
| H57 | Must | As a shift manager, I get the print scaled to fit one page for typical team sizes (20–45 people) while staying readable. | S10 |
| H52 | Must | As a shift manager, I print only what's saved: if there are unsaved changes the button says "Save & print" and saves first. | S10 |
| H65 | Must | As a shift manager, I can switch on black borders for the printed grid when I want it crisper. | S10 |
| H72 | Must | As a shift manager, I can print a one-page briefing sheet for a single day, in the same order as the Roles and groups list, with those away listed at the bottom — without having to save first. | S11 |

### 3.7 Saving, reopening and the Log

| ID | Priority | Requirement | Spec |
| --- | --- | --- | --- |
| H15 | Must | As a shift manager, I save the roster to the Log, one entry per block, replacing the earlier save rather than duplicating it; I can browse, reprint and export the Log. | S12 |
| H49 | Must | As a shift manager, I am never double-counted in the Log or Duty stats because I saved the same block twice. | S12 |
| H51 | Must | As a shift manager, I see an "Unsaved changes" badge whenever the roster differs from what I last saved (including attendance and number edits). | S12 |
| H50 | Must | As a shift manager, I have a trail of every save, kept as text in the folder, even though earlier versions aren't kept. | S12 |
| H18 | Must | As a shift manager, I set my name once and it is stamped on new saves and prints, without rewriting older ones. | S12 |
| H68 | Must | As a shift manager, I can open any saved roster with Edit to correct a past one or change a planned one, and nothing is changed until I save. | S13 |
| H24 | — | *Retired 2026-09-29.* Historic roster screen merged into the Log → [`PRD_Deprecated.md`](PRD_Deprecated.md); reopen a saved roster with H68 | — |

### 3.8 Duty stats

| ID | Priority | Requirement | Spec |
| --- | --- | --- | --- |
| H25 | Should | As a shift manager, I see team load over a period I choose, to check duties are shared fairly. | S14 |
| H59 | Must | As a shift manager, I see a person × role table of how many times each person did each role. | S14 |
| H60 | Must | As a shift manager, I can sort by any column in either direction and see totals at the end. | S14 |
| H61 | Must | As a shift manager, I choose the period — All time (default), This year, This month or my own From / To dates. | S14 |
| H62 | Must | As a shift manager, I can click a person for their own report (every role, plus days Present, on leave, sick, away or resting), and print it. | S14 |
| H23 | — | *Retired 2026-09-30.* Skills screen and the **Needs a skill** role flag column → [`PRD_Deprecated.md`](PRD_Deprecated.md); qualifications are ticked on People (H2) | — |

### 3.9 My data, my unit and getting around

| ID | Priority | Requirement | Spec |
| --- | --- | --- | --- |
| H16 | Must | As a shift manager, I can open and save my data as a file, keep a browser backup, or choose a folder that saves automatically. | S15 |
| H17 | Must | As a shift manager, I set my unit's name and see it on Home, Attendance, Roster and the sidebar. | S15 |
| H26 | Should | As a shift manager, I get automatic backups in my folder, so a bad edit isn't the end of the data. | S15 |
| H27 | Should | As a shift manager, I get milestone entries recorded in the folder's audit files. | S15 |
| H58 | Must | As a shift manager, I can collapse the sidebar to give wide tables room, and it remembers my choice. | S16 |
| H29 | Could | As a shift manager, I could read the folder audit files inside the app. | S17 |
| H31 | Could | As a shift manager, I could record qualification expiry or notes against a person's roles. | S17 |
| H32 | Could | As a shift manager, I could see a cell-level record of every manual swap (who, when, old, new). | S17 |

~~H30~~ (multi-unit JSON) → [`PRD_Deprecated.md`](PRD_Deprecated.md).

---

## 4. User flow and screens

```text
Home (guide)                Each block
─────────────────           ───────────────────────
Unit name + manager    →    1. Attendance
Choose folder (unit)   →    2. Generate once → Roster
Roles → People →               (person × day: edit, swap,
                               parking lot, Unassigned cells;
                               Save roster + Print / Save & print)
                            Save stays in folder / file
```

### Screens (nav)

| Screen | Purpose |
| --- | --- |
| **Home** | Workspace status, unit name, manager name, This-block cards, setup checklist, folders=units diagram, generate tips |
| **1. Attendance** | Block start, Day/Night, Present / leave / sick / duty away / rest day; each day's column header shows present vs roles to fill plus a breakdown of who is away by status (H66) |
| **2. Roster** | Full-width person × day: compact toolbar; viewport-height table; **parking lot**; same-day chip/person moves; **Unassigned** empty cells; **Save roster**; Print / Save & print (print-only header; scale-to-fit one A4 landscape page); content-sized name / number columns and equal day columns (H63); click a name to highlight a row, ↑ ↓ to move it (H64); optional Tally row (H66) and black print borders (H65) |
| **People** | Searchable person picker (name + employee/shoulder numbers); qualifications; fixed role; employee/shoulder numbers; this month’s load |
| **Roles and groups** | Role catalogue, flags (incl. Essential), colours, order; essential roles listed first |
| **Log** | Saved rotas (not the folder audit files); one entry per block start after upsert; manager column when stamped; **View**, **Edit** (H68) and CSV per entry |
| **Duty stats** | Person × role pivot over a chosen period (default: everything up to today): counts per role, sortable headings, tallies at the end; click a name for a printable per-person report with attendance |

Retired surfaces (**Print rota** nav, person × role Roster grid) → [`PRD_Deprecated.md`](PRD_Deprecated.md). Print is an action on Roster.

### Two meanings of “log”

| Kind | Where | What |
| --- | --- | --- |
| **Log** (UI) | `blocks.history[]` via **Save roster** (upsert by start) | Saved duty rotas for reprint / CSV — at most one live entry per block start going forward |
| **Audit** (folder) | `logs/YYYY/MM/DD/audit_log.txt` | Milestone actions including each Save roster. Not shown in UI today |

---

## 5. Business rules (domain)

1. Working pattern: four days on (typically Day, Day, Night, Night), then four off.
2. Day fills roles marked used-by-day; night fills roles marked used-at-night. Most roles are both; a role can be restricted to only one shift (for example, Public Office is used-at-night only, not used-by-day).
3. Only **Present** people are allocated. A stored assignment whose person is not Present is **vacated** (derived): essential roles enter the **parking lot**; non-essential roles are silently empty for that day (no parking chip). Returning to Present restores the assignment.
4. Qualification (People ticks) is a hard block (generate and manual / swap).
5. Fixed role always wins when Present (including a fixed **non-essential** role while essential roles remain short).
6. One block planned at a time per data file / folder.
7. Soft constraints (no same-role repeat, no hard-on-hard nights) may yield if no feasible roster exists; UI must still warn on empty **essential** cells. Non-essential roles do not contribute to that warning.
8. Changing manager name affects **new** audit lines and **new** Save roster / print stamps only.
9. **Essential vs non-essential:** Essential roles must be filled preferentially. Non-essential roles absorb remaining Present people. Expect **more roles than Present** for each day/shift. Roles that cannot be filled stay blank (unassigned), same as after manual × — vacated essentials use the parking lot; never-filled essentials warn only. `sortOrder` among non-essential roles is **Generate fill priority only** (no auto-promote into vacated essentials). Dropping a non-essential for a day means no assignment row that day — catalogue unchanged.
10. **Stale flag:** Role-catalogue changes and Day↔Night (or block setup) changes that invalidate the generated shape set `stale`. Attendance-only status changes do **not** set `stale`; the Roster shows vacated essentials instead.
11. Generate and Print are **never blocked** by unfilled essential roles — warn only.
12. **Save vs print:** Only a saved roster is printed. Unsaved is derived from live snapshot vs last log entry for this block start. Regenerate requires explicit confirm once a roster exists.


### Generate rules

Generated from [`src/js/rules.js`](../src/js/rules.js) — the same list drives Generate and the Home guide ("How generate works"). Edit the rule there, then run `npm run docs:rules`; a test fails if this table is out of date.

<!-- rules:start (generated from src/js/rules.js by npm run docs:rules — do not edit by hand) -->

| # | H-id | Key | Kind | Essential pass | Non-essential pass | Rule (shown on Home) |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | H6 | `present` | structural | order of work | order of work | Only people marked **Present** that day get a role. |
| 2 | H7 | `qualified` | filter | never broken | never broken | People only get roles they are ticked for on **People**. |
| 3 | H8 | `fixedRole` | structural | order of work | order of work | **Only do this role** people get that role first. |
| 4 | H44 | `essentialFirst` | structural | order of work | order of work | **Essential** roles are filled before the others. Non-essential roles are filled from whoever is left, in the order listed on Roles and groups. |
| 5 | H73 | `filesTakesSpares` | structural | order of work | order of work | The **Files** role (ticked on Roles and groups) goes to everyone still free once the other roles are filled — any number of people a day. With **Once per block** ticked, someone who already had Files this block is left Unassigned. |
| 6 | H28 | `leastDone` | objective | score | score | Each role goes to whoever has done it **least, as a share of their own duties**, over the last 12 months of rosters saved to the Log plus the earlier days of this block. Only days they were Present count. Ties are picked at random. |
| 7 | H73 | `filesFairSpares` | structural | order of work | order of work | Who is left free for Files rotates: people who have had Files **least, as a share of their duties**, are kept back from the other roles first. Fair spread of the other roles still comes first. |
| 8 | H71 | `sameGroup` | soft | gives way if no other way | never broken | Nobody gets a role from the same group (e.g. Car) two days running when someone else can cover. |
| 9 | H75 | `probationers` | structural | order of work | order of work | Two people ticked **Probationer** are not put in the same **probationer group** (set up on Roles and groups) on the same day when anyone else can be swapped in. Files is not counted. |
| 10 | H11 | `hardNights` | soft | gives way if no other way | gives way if no other way | On the second night, nobody gets a hard role if they had a hard role the night before, when someone else can cover. |
| 11 | H70 | `oncePerBlock` | filter | never broken | never broken | **Once per block** roles go to a person on one day of the block at most. |
| 12 | H13 | `emptyOnlyIfImpossible` | structural | order of work | order of work | An essential role is only left empty when nobody Present can take it. If there are not enough people for every essential role, the ones lower in the Roles and groups list are left empty first. You'll see a warning, and you can fill it by hand. |

<!-- rules:end -->

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
    "unitName": "Cedar Quay",
    "updatedAt": "2026-09-20T14:00:00.000Z",
    "app": "shift-manager-html"
  },
  "settings": {
    "statuses": [
      { "id": "present", "label": "Present", "allocates": true, "printColor": "#EAF4EC" },
      { "id": "annual_leave", "label": "Annual leave", "allocates": false, "printColor": "#BBDEFB" },
      { "id": "sick_leave", "label": "Sick leave", "allocates": false, "printColor": "#BBDEFB" },
      { "id": "duty_away", "label": "Duty away", "allocates": false, "printColor": "#BBDEFB" },
      { "id": "rest_day", "label": "Rest day", "allocates": false, "printColor": "#BBDEFB" }
    ],
    "defaultShifts": ["Day", "Day", "Night", "Night"],
    "blockLengthDays": 4
  },
  "groups": [
    { "id": "g_car", "name": "Car", "color": "#F8BBD0", "sortOrder": 1 }
  ],
  "roles": [
    {
      "id": "r_car1",
      "name": "Car 1",
      "groupId": "g_car",
      "usedAtDay": true,
      "usedAtNight": true,
      "hard": true,
      "skillRestricted": true,
      "essential": true,
      "sortOrder": 1
    }
  ],
  "people": [
    {
      "id": "p_demo1",
      "name": "Alex River",
      "active": true,
      "fixedRoleId": null,
      "employeeNo": "00012345",
      "shoulderNo": "0001"
    }
  ],
  "personRoles": [
    { "personId": "p_demo1", "roleId": "r_car1" }
  ],
  "blocks": {
    "current": {
      "id": "b_current",
      "startDate": "2026-09-21",
      "shifts": ["Day", "Day", "Night", "Night"],
      "stale": false,
      "generatedAt": null,
      "attendance": [
        { "date": "2026-09-21", "personId": "p_demo1", "statusId": "present" },
        { "date": "2026-09-22", "personId": "p_demo2", "statusId": "duty_away", "note": "Court – Dublin" }
      ],
      "assignments": [
        {
          "date": "2026-09-21",
          "roleId": "r_car1",
          "personId": "p_demo1",
          "source": "generated"
        }
      ],
      "spareNotes": []
    },
    "history": [
      {
        "id": "b_log1",
        "savedAt": "2026-09-17T22:10:00.000Z",
        "savedBy": "A. Manager",
        "startDate": "2026-09-13",
        "shifts": ["Day", "Day", "Night", "Night"],
        "attendance": [],
        "assignments": [],
        "snap": { "layout": "person-role", "unitName": "Cedar Quay", "savedBy": "A. Manager" },
        "records": []
      }
    ]
  },
  "audit": []
}
```

Notes:

- `meta.unitName` is the unit shown in UI and print.
- `blocks.history[].savedBy` / `snap.savedBy` stamp the manager at Save roster time.
- `audit[]` in JSON is reserved; the live audit trail for milestones is the folder `audit_log.txt` files.
- `blocks.current.spareNotes[]` — deprecated; see [`PRD_Deprecated.md`](PRD_Deprecated.md). On migrate-on-open always cleared to `[]`. New snapshots omit `spareNotes`. Present people with no role use an Unassigned cell (H37).
- `roles[].essential` — `true` = must be filled preferentially; `false` = non-essential (spare work). **Additive on schema v2:** if the field is missing on open, `normalizeV2` sets `essential: true` (existing catalogues unchanged in behaviour). After save, the field is written. No `schemaVersion` bump. **Older builds that do not know the field ignore it** when reading JSON written by newer builds.
- `people[].employeeNo` / `people[].shoulderNo` — optional strings (not numbers) so leading zeros survive. **Additive on schema v2:** if missing on open, `normalizeV2` sets each to `""`. No `schemaVersion` bump. Sample/mock data may use obviously fake values only.
- Vacated roles are **not** a stored collection: they are derived from `assignments` + `attendance` (non-Present holder ⇒ role unfilled for warnings / Unallocated strip; Present again ⇒ same assignment row is live again).
- **Unsaved** roster state is **not** stored: it is derived by comparing live `buildSnapshot()` to the history entry for the current block start (see H51), including employee/shoulder numbers when present on the snap.
- Roster/print snapshots use `layout: "person-day"` (person × day grid, current). Older `layout: "person-role"` (person × role per day) and legacy role×day snaps still render when present, read-only. Person-day snaps that include `employeeNo` / `shoulderNo` on each person render two number columns after Name; snaps without those fields omit the columns (legacy log entries look as before).

### Entity dictionary

| Collection | Purpose |
| --- | --- |
| `meta` | File identity; **`unitName` required for clear prints** |
| `settings` | Statuses, default shifts, block length |
| `groups` | Role groups (`name`); colours are on `roles[].color` |
| `probationerGroups` | H75 probationer groups (`name`); a role joins one via `roles[].probGroupId` |
| `roles` | Catalogue + day / night / hard / **essential** / once per block / order (legacy `skillRestricted` kept, unused) |
| `people` | Team; `fixedRoleId`; `active`; optional `employeeNo` / `shoulderNo` (strings) |
| `personRoles` | Qualifications |
| `blocks.current` | Working four-day set |
| `blocks.history[]` | Committed rotas + snap for reprint |

### Invariants

1. `fixedRoleId`, if set, must be a role the person is qualified for.
2. Live allocations only for Present people; non-Present holders are treated as vacated for fill/warn/UI (assignment row may remain until overwritten).
3. Assignment person must be qualified for that role (generate and manual / swap).
4. At most one person per `(date, roleId)` — except the Files role (H73), which may have many; at most one role per `(date, personId)` among Present holders.
5. Role `sortOrder` defines display/generate order; among non-essential roles it is also drop/fill priority.
6. `schemaVersion` known or migrated; missing `essential` defaults to `true` on open; missing `employeeNo` / `shoulderNo` default to `""` on open.

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
| Print | Colour; A4 landscape ~10mm margins; crest + unit + optional “Prepared by” (print-only on Roster screen); scale-to-fit one page when possible (H57); day header + parking lot frozen on screen (H38); collapsible sidebar (H58); per-day briefing print A4 portrait in Roles-list order (H72) |
| Resilience | Folder backups; `localStorage`; dirty badge; confirm before destructive clear |
| Security | Local only; no telemetry |

---

## 10. Acceptance criteria (current product)

1. Home shows unit field, manager Set/Change, This-block cards, folders=units guidance.
2. Choose folder → edits autosave to `shift-manager-data.json`; audits appear under `logs/`.
3. Unit name appears on Roster header and survives reload when not clobbered by mock.
4. There is no Skills screen and no Needs a skill column on Roles; People ticks alone decide who can do a role. Over several saved blocks, Generate evens out each role's count per person on Duty stats (H28).
5. Generate → person × day **Roster** shows group colours and leave/status cells; Print produces the colour A4 landscape output from that screen. The person × role grid is gone.
6. Save roster → upserts Log entry for that block start (no duplicate rows for repeated saves) with manager when set → View/Print keeps that name after manager rename. Folder audit gains a line each save.
7. Log and Duty stats read from history + current block without double-counting the same block after repeated Save roster.
8. Open a v1 file → migrated to v2 without data loss; open a v2 file missing `essential` → each role defaults to `essential: true` with no behaviour change until the manager unticks some.
9. Attendance status dropdown offers Rest day; People screen lists the team sorted by surname.
10. A role with Used by day off and Used at night on (for example Public Office) is offered by Generate and manual assign only on night shifts.
11. Roster shows one column per day with duty type / status text coloured per person; an unassigned Present person's cell is blank white with italic light-grey “Unassigned”; vacated **essential** roles appear in the parking lot (`<role> — was: <person>`); vacated non-essentials do not; a non-Present person with a former role shows `<status> (was: <role>)`; the day header (incl. parking lot) and name column stay visible while scrolling; parking lot is not printed; Print uses A4 landscape of the **saved** roster (or Save & print when unsaved), scaled to prefer one page.
12. On Attendance and Roster, Present cells are green; Annual leave, Sick leave, Duty away, and Rest day cells are the same blue; assigned roles still use their role-group colours on Roster/print.
13. On Attendance, scrolling the person list keeps the day / shift header row visible (and the Person column still sticks when scrolling sideways).
14. Roles screen shows an Essential checkbox; essential roles list above non-essential; Generate fills essentials before non-essentials; Attendance “x present, y roles” uses essential-only `y`.
15. Changing attendance to Sick does **not** set `stale` or suggest regenerate; vacated **essential** appears in the parking lot; vacated non-essential does not; returning to Present restores the assignment.
16. Parking-lot chip→person and person↔person moves follow H47 (incl. chip→non-essential drops that role for the day; essential→non-essential person drag = swap); cross-day rejected; invalid targets dimmed; toast after each move.
17. Snapshot / warn `unfilled` counts vacated essential roles only. Generate and Print are never blocked by unfilled essentials.
18. After first Generate, regenerate is secondary **Start over / Regenerate** with confirm. Save roster twice for the same start leaves one history entry. Unsaved badge appears after edits/attendance/employee-or-shoulder-number changes; Print becomes Save & print until saved.
19. People without `employeeNo` / `shoulderNo` open with blank strings; People detail can edit both; search finds by number; Roster/print show Employee / Shoulder no. columns after Name (blank when unset); a saved snap carries the numbers; an old snap without them renders with no number columns; CSV export columns unchanged.
20. Roster is full-width with a single compact toolbar; on-screen print header is hidden; table body scrolls within the remaining viewport; ~30 compact rows fit 1080p without scrolling when chrome is minimal; parking-lot chips wrap/scroll inside a height cap.
21. Print preview at 20 / 28 / 35 / 45 people: one page down to the readable minimum scale; second page only beyond that; `thead` repeats; rows do not split mid-row.
22. Sidebar collapses/expands via hamburger at all widths; choice persists per viewer in `localStorage` when available; default collapsed on narrow, expanded on wide.
23. Roster **Briefing sheet** bar offers one Print button per day (e.g. Print Thu): portrait sheet lists that day’s Present+assigned people in the order of the Roles and groups list, with Role / Name / Employee / Shoulder and group colours; leave / sick / rest / duty away listed at the bottom, Unassigned omitted; live roster (no Save); full-block Print unchanged. (H72)
24. Duty stats shows a person × role table with counts; the ▲ / ▼ at the top of a role column sorts by that role (▼ = most first), clicking the heading name toggles; Person sorts A–Z / Z–A; Hard / Total columns and a Total row tally at the end; there are no Day / Night columns.
25. Duty stats opens on **All time** (earliest data to today); choosing This year / This month or entering From / To dates changes the table and tiles; clicking a name opens a report with every role's count and the person's attendance counts (Present / Annual leave / Sick leave / Duty away / Rest day) for the same period, and Print this report prints only that person.
26. *(Retired 2026-09-29 with the Historic roster screen — see [`PRD_Deprecated.md`](PRD_Deprecated.md).)*

---

## 11. Open questions

1. Soft-fallback vs fail loudly when hard-night rules cannot be met? (**Today: soft — the rule gives way; essentials stay blank only when nobody Present can do them.**)
2. *(Resolved 2026-09-30 — H28 is a Must; see [`PRD_Deprecated.md`](PRD_Deprecated.md) resolved questions.)*
3. Whether to add an in-app Audit viewer for `logs/**/audit_log.txt` (H29).
4. Shared network folder: is last-write-wins enough, or warn on `meta.updatedAt` conflicts?
5. **Non-essential vs H10:** Should the non-essential generate pass skip the no-repeat rule, or apply it loosely? (**Assumption to confirm: skip or loose — prefer skip so Files 1–5 absorb whoever is left.**)
6. **Block start date after Save:** Changing `blocks.current.startDate` after a Save roster creates a **new** log entry on the next save (different start). No special merge or rename of the old entry — managers treat it as a new block.
7. **Top-bar nav:** A possible future option is moving primary nav into the top bar (and retiring the sidebar). **Not in scope for H58** — keep the collapsible DaisyUI drawer/sidebar.
8. **Typical unit headcount:** Used to tune compact-row height and print scale thresholds (H56–H57). Mock/sample data ships **12** people. Real unit size to confirm with operators before locking thresholds.

### Assumptions challenged (Phase 1)

| Assumption | Challenge | PRD stance |
| --- | --- | --- |
| Attendance changes no longer set `stale` | Managers may still want a “something changed” cue | Keep: parking lot + banner **is** the cue; `stale` reserved for shape-breaking setup changes |
| Unqualified drops blocked (toast) | Some units might want a soft warn | Keep hard block — matches H7 |
| Non-essential skips H10 (no-repeat) | Fairness across Files roles may matter | Open Q5 — default implement as **skip** unless review says otherwise |
| Fixed-role person on non-essential while essentials short | Leaves an essential empty | Keep rule 5 (fixed wins); warn on the empty essential |
| Essential person → non-essential person | Transcript ambiguous: swap vs replace | **Swap** — avoids accidentally stripping a duty |

### Docs outside this PRD

- **SECURITY.md** / **docs/THIRD_PARTY.md** — keep aligned when storage or packaging changes (employee/shoulder numbers already noted in SECURITY for H53).
- **README.md** — operator flow is Attendance → Generate → Roster (shipped).

---

## 12. Relationship to Excel / Power Apps docs

| Topic | Excel / Design Spec | This HTML PRD |
| --- | --- | --- |
| Rules & roles | Same domain | Same |
| Storage | Excel tables | v2 JSON + optional workspace folder |
| Front end | Sheets / Power Apps | Offline HTML (Home-first UX) |
| Shared future | — | v2 JSON remains the contract |

The HTML app is the shipping path. Older Design Spec markdown under `docs/` is historical. Do not redistribute legacy PDF PRDs.
