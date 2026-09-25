# Shift Manager – HTML App PRD

2026-09-25 · HTML / offline JSON edition (updated to match shipped UI)

This PRD describes the single-file HTML app (`shift-manager.html` / `shift-manager-offline.zip`). It replaces Excel / Power Apps front-end assumptions from the original PRD while keeping the same business rules. The JSON document (plus optional workspace folder) is the system of record.

### 2026-09-25 — Essential roles + unified Roster (planned → shipping)

Stakeholder session: essential vs spare (non-essential) roles; keep the roster after someone goes sick; one person × day working screen; same-day drag/click swap; **Save upsert + print only what is saved**.

1. **Essential flag on roles** (H19, H43): Roles screen gains an Essential checkbox. Ticked = must be filled; unticked = optional work for spare people (e.g. Files 1–5). Schema stays v2 additive: `essential` boolean on each role; migrate-on-open defaults missing values to `true` so existing data behaves identically. JSON impact: every role gains `essential` after open/save; no schemaVersion bump. Older builds that do not know the field ignore it.
2. **Generate two-pass** (H6, H44): Fill essential roles first (current skill/hard/fixed logic unchanged). Remaining Present people fill non-essential roles in `sortOrder`. Roles that cannot be filled stay blank (like ×): non-essential shortage never fails strict mode; unfilled essentials warn only. Expect more roles than Present so people are not left Unassigned after Generate. No auto-promotion from non-essential into a vacated essential role — the manager does that manually.
3. **Attendance change without regenerate** (H13, H45): Marking someone Sick / leave / Rest day / Duty away does **not** set `stale` and does not push regenerate. Vacated roles are **derived** (not stored). Vacated **essential** roles appear in the **parking lot** (pinned Unallocated row under the frozen day header; chips per day, e.g. `<role> — was: <person>`). Vacated **non-essential** roles are silently dropped for that day (no chip, no warning); the person’s cell still shows `<status> (was: <role>)`. Returning to Present restores the stored assignment. Role-catalogue and Day↔Night shift changes still set `stale`. Snapshot `unfilled` counts vacated essentials only.
4. **Unified Roster screen** (H12, H14, H36, H46): Retire the person × role edit grid. The post-generate working screen **is** the person × day layout (former Print). Nav label **Roster**; actions include **Save roster** and Print. Present people with no role show an empty **Unassigned** cell (H37) primed for chip drop / person swap. Persist `S.ui.screen` values `prt` and `ros` both open this screen. Old log snapshot layouts (`person-role`, legacy) still render read-only.
5. **Same-day moves** (H12, H47): Primary gesture is dragging a **parking-lot chip onto a person** (click chip then click person as fallback). Person↔person swaps use drag handles. Drop matrix (same day only): chip→unassigned takes it; chip→person on non-essential → they take the essential and the non-essential is **dropped for that day** (no parking chip; toast e.g. “Files 1 dropped for Thu”); chip→person on essential → they take the parked role and their old essential moves into the parking lot; essential↔essential and non-essential↔non-essential person drags **swap**; person→unassigned hands over; **person’s essential → person on non-essential = swap** (not replace — nobody loses a duty accidentally). Reject / dim non-Present, unqualified (skill), and fixed-role-invalid targets. Cross-day rejected. After every move, toast what happened.
6. **Attendance headcount** (H40): Per-day “x present, y roles” counts **essential** roles only for `y`.
7. **Save / Print model** (H15, H48–H52): Generate is first-time primary; once a roster exists it is secondary **Start over / Regenerate** with confirm (reshuffles everyone, discards manual edits) — no banner suggesting it for attendance. **Save roster** upserts `blocks.history[]` by block start date (`start` or `startDate`); writes a folder audit line each save; previous log version for that start is replaced (not versioned). Print only prints a saved roster; **unsaved** is derived by comparing live `buildSnapshot()` to the last saved entry for this block (ignore stamp fields; include attendance + employee/shoulder numbers when present on the snap). Unsaved → badge + **Save & print**; saved → Print uses `#printArea`. Changing block start after a save creates a **new** log entry (no special handling). Pre-existing duplicate history rows from old push behaviour are left alone (no cleanup migration).
8. **Employee / shoulder numbers** (H53): Optional string fields on each person (`employeeNo`, `shoulderNo`) so leading zeros survive. People detail edits them; search matches numbers as well as names. Roster/print show a grouped “Employee / Shoulder no.” header with two narrow cells after Name (blank when unset). Snapshots store the numbers as of save; old log snaps without them render as before. CSV export unchanged. Additive on schema v2 — no version bump.
9. **Roster layout + print fit + collapsible sidebar** (H14, H36, H38, H39, H54–H58): Full-width Roster (no `max-w-7xl` cap); one compact toolbar row; logo / “Duty rota …” / “Prepared by” print-only on screen; table fills remaining viewport height with frozen day header + parking lot + sticky name column; compact on-screen rows; parking-lot height capped. Print scales to fit one A4 landscape page (employee/shoulder columns included; parking/drag chrome still not printed). Sidebar collapsible with per-viewer `localStorage` memory (default collapsed on narrow viewports, expanded otherwise); hamburger always available. Layout-only — no schema change.
10. **Duty stats pivot** (H25, H59, H60): the team table becomes person × role counts (Excel pivot style) with every heading sortable — click a role to see who did it most — plus Hard / Skill / Total tallies at the end and a Total row at the bottom. Day / Night and duty-type columns removed.

Also from earlier the same day: Attendance polish (H41–H42) below.

### 2026-09-25 — Attendance polish

1. **Unavailable = blue:** Present keeps its green cell colour; Annual leave, Sick leave, Duty away, and Rest day all use the same blue on the Attendance screen and on the Roster (print) view, so blue means “not available” at a glance (H41). Role-group colours on Roster/print are unchanged.
2. **Attendance freeze panes:** the day / shift header row stays pinned while scrolling the person list, same idea as the Roster screen (H42).

### 2026-09-22 — PM feedback round

1. **Rest day** added as an attendance status alongside Present / Annual leave / Sick leave / Duty away (H33).
2. **People** screen list now sorts by surname instead of first name (H34).
3. Roles gain a **Used by day** flag to pair with **Used at night**, so a role can be restricted to one shift type only (for example, Public Office is night-only) (H35).
4. Print/Roster layout changed from person × role grid to **person × day**: one column per day, the cell holds the duty type (or status) as coloured text, matching whichever role group or status it belongs to (H36).
5. People present with no role (**Unassigned** — blank white cell, italic light-grey label) after × / a role moves to the parking lot, or in rare edge cases, are drop/swap targets (skill rules still apply). Free-text spare notes / HVB are removed (H37). **Operating assumption:** the role catalogue has **more roles than Present people** for each day/shift, so Generate should not leave surplus people empty. Roles that cannot be filled stay blank (same as after manual unassign): vacated essentials in the parking lot; never-filled essentials warn as unfilled; non-essentials silently empty.
6. The Roster day header row is frozen (stays visible) while scrolling through the person list, before printing (H38).
7. Printing uses **A4 landscape** (H39).
8. Attendance screen's per-day cards now show the **date large** and the **present headcount small**, reversing the previous sizing so the headcount is not mistaken for the date (H40).

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

**Best practice: one folder per unit** (for example `mill-street/`, `pearse-street/`). Each folder holds that unit’s data file, backups, and file-based audit trail. Switching units = finish saving, then **Change folder** (or Open another file). Do not mix two units in one folder.

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

### Must

| ID | Requirement |
| --- | --- |
| H1 | Add, rename, deactivate and delete people |
| H2 | Per person: qualification ticks for every role (People + Skills matrix for skill roles) |
| H3 | Per person: optional fixed role (“only do this”), limited to qualified roles |
| H4 | Set block start date and Day/Night for each of four days |
| H5 | Set status per person per day: Present, Annual leave, Sick leave, Duty away, Rest day |
| H6 | Generate fills roles for Present people for the block: **essential roles first**, then non-essential from remaining Present people (see H44) |
| H7 | Generate and manual edit only offer qualified people (hard block) |
| H8 | Fixed-role people get that role when Present (including when the fixed role is non-essential — fixed wins even if essential roles are short) |
| H9 | Skill-restricted roles filled before general roles; scarcest first (**within** the essential pass; then again within the non-essential pass) |
| H10 | Prefer not repeating the previous working day’s role when alternatives exist (**essential pass**; non-essential pass may skip or apply loosely — see §11) |
| H11 | Hard roles not on back-to-back nights when alternatives exist (essential pass; non-essential hard roles follow the same soft rule if marked hard) |
| H12 | Manual edit on the **person × day Roster**: assign, same-day moves (see H47), unassign / leave unfilled |
| H13 | Warn on **unfilled essential** roles (never block Generate or Print). Unfilled non-essential roles do not warn. Set `stale` after **role-catalogue or Day↔Night shift** changes — **not** after attendance-only changes. Do **not** suggest regenerate for attendance changes (see H48) |
| H14 | Colour print from the Roster: **person × day** grid — person leftmost column, then optional Employee / Shoulder no. columns (H53), then one column per day; each day cell shows that person's duty type or status as text, coloured by role group when Present, or by the shared unavailable-status colour when not Present (see H41). Non-Present cells that still have a stored assignment show `<status> (was: <role>)`. Print only what has been **saved** (see H51–H52). On screen the print header (crest / “Duty rota …” / “Prepared by”) is hidden; it appears in print (H55). Output aims to fit **one A4 landscape page** via scale-to-fit (H39, H57) |
| H15 | **Save roster** upserts the log entry for the current block start date (match `start` or `startDate` on history rows); replace that entry with the latest snapshot rather than pushing a duplicate. Browse, re-print, delete, CSV export on Log; show manager who saved when known. Changing block start after a save creates a **new** history entry. Pre-existing duplicate rows from older push behaviour are left alone (no cleanup) |
| H16 | Open / save JSON; `localStorage` backup; **Choose folder** workspace with autosave |
| H17 | Set **unit name** (`meta.unitName`); show on Home, Attendance, Roster, sidebar |
| H18 | Set **manager name** (browser-local); stamp on new Save roster / print snapshots; do not rewrite older entries |
| H33 | **Rest day** is an attendance status choice (does not allocate; shown as status text on Roster/print) |
| H34 | People screen list is sorted by **surname** (last word of the person's name), not first name |
| H35 | Roles have both **Used by day** and **Used at night** flags; a role can be restricted to only one shift type (day fills roles marked used-by-day, night fills roles marked used-at-night) |
| H36 | **Roster** (interactive, post-generate) renders **person × day**: person name leftmost, each day a column, duty-type/status text coloured per role group / status. Print is an action on this screen, not a separate nav screen. Persisted UI screen ids `prt` and `ros` both open Roster. Layout: full-width main (H54), compact toolbar (H55), viewport-sized scroll body (H56) |
| H37 | On Roster (and print), a Present person with no role shows a blank white day cell with italic light-grey **Unassigned** — primed for parking-chip drop or person swap (skill / Present / fixed-role rules still apply). Typical causes: × unassign or role moved to parking lot. **Assumption:** managers keep **more roles than Present** for each day/shift so Generate does not leave surplus people empty. No free-text spare notes (HVB deprecated). `blocks.current.spareNotes` cleared on migrate-on-open; new snapshots omit the field |
| H38 | On Roster, while scrolling the person list: the **day header row**, the **parking-lot row**, and the **Person (name) column** stay frozen/visible. Employee / Shoulder number columns scroll with the body (not sticky). Do not break this when sizing the scroll region to the viewport (H56) |
| H39 | Print output uses **A4 landscape** with ~10mm margins. Prefer **one page**: scale font/padding so Name + number columns + four day columns fit; readable floor ≈ 8–9px. Beyond what scale can keep readable, a second page is allowed. Safety: `tr { break-inside: avoid }`; `thead` repeats on a second page. Parking lot, drag handles, and × unassign are not printed |
| H40 | Attendance screen's per-day card shows the date prominently (large) and the present / roles headcount smaller; the roles count (`y` in “x present, y roles”) counts **essential** roles only for that shift |
| H41 | Attendance and Roster use the same status colours: **Present** is green; **Annual leave**, **Sick leave**, **Duty away**, and **Rest day** share one blue (unavailable). Role-group colours on Roster/print stay as configured under Roles and groups |
| H42 | Attendance screen's day / shift header row stays frozen (visible) while scrolling the person list |
| H43 | Roles have an **Essential** flag (`essential: boolean`). Roles screen: Essential checkbox column; list groups essential roles first, then non-essential. Default `true` on migrate when the field is missing |
| H44 | Generate **two-pass**: (1) essential roles with current allocation logic; (2) non-essential roles in `sortOrder` from remaining free Present people. Roles that cannot be filled stay **blank** (same as after ×): never fail strict mode for non-essential shortage; unfilled essentials warn (H13) but do not block. List order among non-essential = fill/drop priority. **No** auto-promotion of a non-essential holder into a vacated essential role. Catalogue is expected to have enough roles that every Present person can be assigned |
| H45 | Vacated roles are **derived**, not stored. **Parking lot:** pinned row under the frozen day header listing vacated **essential** roles only (chips: `<role> — was: <person>` when known; slim “all essential roles covered” when empty so layout does not jump; not printed). Vacated **non-essential** roles create **no** chip and **no** warning — silently empty for that day; the sick person's cell shows the status with a small **screen-only** second line `was: <role>` (never printed and not stored in the saved snapshot text). Returning to Present restores the assignment. Snapshot `unfilled` counts vacated essentials only |
| H46 | Single post-generate working screen: person × day **Roster** (**Save roster** + Print actions). The former person × role grid screen is removed. Keep roster warnings and swap behaviour on the new screen. Historic/log snaps with older layouts still render |
| H47 | Same-day moves on Roster. **Primary:** drag parking-lot chip onto a person (click chip → click person fallback). **Person drag** via cell handle. Matrix: chip→unassigned takes role; chip→non-essential holder → they take essential, non-essential **dropped for that day** (no parking, toast); chip→essential holder → they take parked role, old essential enters parking lot; essential↔essential and non-essential↔non-essential **swap**; person→unassigned hands over; **essential holder → non-essential holder = swap** (not replace). Reject/dim non-Present, skill-unqualified, fixed-role-invalid; cross-day rejected. Toast after every move. Unassign available (role to parking lot; person cell becomes Unassigned) |
| H48 | **Generate once per block:** before a roster exists, Generate is the primary action. After a roster exists, it is a secondary **Start over / Regenerate** with confirmation (“reshuffles everyone and discards manual edits”). No banner suggests regenerate for attendance changes |
| H49 | **Save roster** upserts by block start (`start` / `startDate`); Log, Historic roster, and Duty stats must not double-count the same block after repeated saves |
| H50 | Every Save roster writes a folder **audit** line via `logAudit` (text files under `logs/`, not JSON). Earlier log versions for that start are not kept — only the audit trail records that a save happened |
| H51 | **Unsaved** is derived (not stored): compare live `buildSnapshot()` to the last saved history entry for this block start, ignoring stamp fields (`savedBy`, `savedAt`, and equivalents). Include attendance status and employee/shoulder numbers so a post-save sick mark or number edit makes the roster unsaved. Show an “Unsaved changes” badge when unsaved |
| H52 | When unsaved, Print becomes **Save & print** (save first, then print). When saved, Print uses the existing `#printArea` (no separate render path) |
| H53 | Per person: optional **Employee number** and **Shoulder number** (`employeeNo`, `shoulderNo` — strings, default `""`). People detail: two inputs beside Name. Search matches numbers as well as names. Roster/print (`rotaHTMLPersonDay` and the interactive Roster table): a single header row with two narrow non-sticky columns “Employee no.” and “Shoulder no.” after the sticky Name column (min-widths sized for an 8-digit number); blank when unset; number cells are not drag targets. `buildSnapshot()` stores both per person; render number columns only when the snap carries them (legacy snaps unchanged). Unsaved comparison (H51) includes them. CSV export unchanged. Number columns are included in print scale-to-fit (H57) |
| H54 | **Full-width Roster (and Attendance when trivial):** on these screens the main content is not capped at `max-w-7xl`; horizontal padding is reduced so Name + Emp + Shldr + four day columns fit without horizontal scrolling on typical laptop widths (incl. ~1366×768 with sidebar collapsed) |
| H55 | **Compact Roster chrome (screen):** one toolbar row — “Roster · unit · block dates · Unsaved badge · Save · Print / Save & print · Start over”. No page subtitle. Vacated-role and unfilled alerts stay but are compact/inline. The crest / “Duty rota …” / “Prepared by” block is **print-only** (`no-print` inverse / screen-hidden). Screen card padding is tight |
| H56 | **Viewport-sized Roster table (screen):** the scroll region uses remaining viewport height (not a fixed `70vh`). Only the table **body** scrolls; day header + parking lot stay in the frozen thead (H38). Compact row padding (~`py-1`) so ~30 people fit a 1080p screen without vertical scrolling when chrome is collapsed/minimal. Parking-lot row height is capped (wrap ≤2 lines, then scroll inside the parking cells) so many chips do not push the grid down |
| H57 | **Print scale-to-fit:** at render (or via a CSS variable / `zoom` on `#printArea`) shrink font size and row padding so the saved roster fits one A4 landscape page down to a readable minimum (~8–9px). Includes H53 number columns. Parking / drag / unassign chrome remain non-printed. Verify with sample data at 20, 28, 35, and 45 people |
| H58 | **Collapsible sidebar:** drop permanent `lg:drawer-open` when the user collapses; show the hamburger at every width. Default: collapsed on Attendance, Roster and Duty stats (wide tables), pinned open elsewhere; an explicit Hide / Pin choice overrides the default on every screen. Remember the choice per viewer in `localStorage` (try/catch; render correctly if storage is unavailable). Keep mobile overlay drawer behaviour. Do **not** move nav into the top bar (possible later — see §11) |
| H59 | **Duty stats pivot:** for the selected month, one row per person and one column per role, each cell the number of times that person did that role (blank-dot when none). Columns follow the Roles screen (essential first, then list order); a duty that appears in the log but is no longer in the role list keeps a column at the end. Day / Night columns and tiles, the duty-type (group) column and the Top roles column are removed. Month selection and Historic list stay; Historic cards show duties only |
| H60 | **Sortable and tallied:** every heading (Person, each role, Hard, Skill, Total) has its own **▲ (low to high / A–Z) and ▼ (high to low / Z–A)** buttons at the top of the column, so a direction can be chosen directly (▼ on a role = who did it most); clicking the heading name toggles (first click high-to-low, Person A–Z). Ties fall back to name. The active direction is highlighted; other headings show both arrows faintly. **Tallies at the end:** Hard, Skill and Total columns after the roles (Total pinned at the right), and a Total row at the bottom (pinned) with each role's tally and the grand total. Hard roles are tagged “H” on their heading. Sort state is per session (not saved). No highlighting or ranking logic — the table is read as-is |
| H61 | **Day briefing print:** on Roster, a **Briefing sheet** bar above the grid has one **Print day-label** button per day (e.g. Print Thu). Prints a disposable one-page A4 **portrait** sheet for that day only: rows are Present people with an assigned role, sorted by role catalogue `sortOrder` (then role name); columns Role · Name · Employee no. · Shoulder no.; Role cell uses the role-group colour. Skips leave / sick / rest / duty away and Unassigned Present. Uses the **live** roster (no Save required; does not change person row order on the interactive grid or write to Log). Full-block **Print / Save & print** (H14, H52) stays unchanged (landscape person × day of the saved roster). Empty day (nobody Present+assigned) toasts and does not open the print dialog |

### Should

| ID | Requirement |
| --- | --- |
| H19 | Manage role list: name, group, day/night use, hard, skill, **essential**, display order. Roles screen groups **essential roles first**, then non-essential; `sortOrder` among non-essential is fill/drop priority |
| H20 | Manage role groups and print colours |
| H21 | Paste-many for people and roles |
| H22 | Sample dataset for training |
| H23 | Skills screen (matrix for roles marked Needs a skill) |
| H24 | Historic roster: browse saved periods by year / month / block using the same **person × day** layout as Roster (Name + Employee / Shoulder + day columns, role-group colours, Unassigned). Read-only; Print in colour from the saved snap. Older log layouts still render when a person-day snap cannot be rebuilt |
| H25 | Duty stats: team load by month as a person × role pivot (H59) with hard / skill / total tallies; no Day / Night or duty-type (group) columns |
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
Choose folder (unit)   →    2. Generate once → Roster
Roles → People → Skills →      (person × day: edit, swap,
                               parking lot, Unassigned cells;
                               Save roster + Print / Save & print)
                            Save stays in folder / file
```

### Screens (nav)

| Screen | Purpose |
| --- | --- |
| **Home** | Workspace status, unit name, manager name, This-block cards, setup checklist, folders=units diagram, generate tips |
| **1. Attendance** | Block start, Day/Night, Present / leave / sick / duty away / rest day; headcount uses essential role count |
| **2. Roster** | Full-width person × day: compact toolbar; viewport-height table; **parking lot**; same-day chip/person moves; **Unassigned** empty cells; **Save roster**; Print / Save & print (print-only header; scale-to-fit one A4 landscape page) |
| **People** | Searchable person picker (name + employee/shoulder numbers); qualifications; fixed role; employee/shoulder numbers; this month’s load |
| **Skills** | Skill matrix for Needs-a-skill roles |
| **Roles and groups** | Role catalogue, flags (incl. Essential), colours, order; essential roles listed first |
| **Log** | Saved rotas (not the folder audit files); one entry per block start after upsert; manager column when stamped |
| **Historic roster** | View of a saved period (person × day when snap is current layout; older layouts still render) |
| **Duty stats** | Person × role pivot by month: counts per role, sortable headings, tallies at the end |

The former separate **Print rota** nav item and the person × role **Roster** grid are retired; Print is an action on Roster.

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
4. Skill-restricted roles are a hard block on qualification (generate and manual / swap).
5. Fixed role always wins when Present (including a fixed **non-essential** role while essential roles remain short).
6. One block planned at a time per data file / folder.
7. Soft constraints (no same-role repeat, no hard-on-hard nights) may yield if no feasible roster exists; UI must still warn on empty **essential** cells. Non-essential roles do not contribute to that warning.
8. Changing manager name affects **new** audit lines and **new** Save roster / print stamps only.
9. **Essential vs non-essential:** Essential roles must be filled preferentially. Non-essential roles absorb remaining Present people. Expect **more roles than Present** for each day/shift. Roles that cannot be filled stay blank (unassigned), same as after manual × — vacated essentials use the parking lot; never-filled essentials warn only. `sortOrder` among non-essential roles is **Generate fill priority only** (no auto-promote into vacated essentials). Dropping a non-essential for a day means no assignment row that day — catalogue unchanged.
10. **Stale flag:** Role-catalogue changes and Day↔Night (or block setup) changes that invalidate the generated shape set `stale`. Attendance-only status changes do **not** set `stale`; the Roster shows vacated essentials instead.
11. Generate and Print are **never blocked** by unfilled essential roles — warn only.
12. **Save vs print:** Only a saved roster is printed. Unsaved is derived from live snapshot vs last log entry for this block start. Regenerate requires explicit confirm once a roster exists.

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
      "id": "r_gs101",
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
      "id": "p_owen",
      "name": "Owen Lyons",
      "active": true,
      "fixedRoleId": null,
      "employeeNo": "00012345",
      "shoulderNo": "0001"
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
      ],
      "spareNotes": []
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
- `blocks.history[].savedBy` / `snap.savedBy` stamp the manager at Save roster time.
- `audit[]` in JSON is reserved; the live audit trail for milestones is the folder `audit_log.txt` files.
- `blocks.current.spareNotes[]` is **deprecated** (former free-text / HVB notes). On migrate-on-open it is always cleared to `[]`. New snapshots omit `spareNotes`. Present people with no role use an Unassigned cell (H37), not notes.
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
| `groups` | Print colour bands |
| `roles` | Catalogue + day / night / hard / skill / **essential** / order |
| `people` | Team; `fixedRoleId`; `active`; optional `employeeNo` / `shoulderNo` (strings) |
| `personRoles` | Qualifications |
| `blocks.current` | Working four-day set |
| `blocks.history[]` | Committed rotas + snap for reprint |

### Invariants

1. `fixedRoleId`, if set, must be a role the person is qualified for.
2. Live allocations only for Present people; non-Present holders are treated as vacated for fill/warn/UI (assignment row may remain until overwritten).
3. Assignment person must be qualified for that role (generate and manual / swap).
4. At most one person per `(date, roleId)`; at most one role per `(date, personId)` among Present holders.
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
| Print | Colour; A4 landscape ~10mm margins; crest + unit + optional “Prepared by” (print-only on Roster screen); scale-to-fit one page when possible (H57); day header + parking lot frozen on screen (H38); collapsible sidebar (H58); per-day briefing print A4 portrait sorted by role (H61) |
| Resilience | Folder backups; `localStorage`; dirty badge; confirm before destructive clear |
| Security | Local only; no telemetry |

---

## 10. Acceptance criteria (current product)

1. Home shows unit field, manager Set/Change, This-block cards, folders=units guidance.
2. Choose folder → edits autosave to `shift-manager-data.json`; audits appear under `logs/`.
3. Unit name appears on Roster header and survives reload when not clobbered by mock.
4. Skills matrix and People qualifications agree for skill-restricted roles.
5. Generate → person × day **Roster** shows group colours and leave/status cells; Print produces the colour A4 landscape output from that screen. The person × role grid is gone.
6. Save roster → upserts Log entry for that block start (no duplicate rows for repeated saves) with manager when set → View/Print keeps that name after manager rename. Folder audit gains a line each save.
7. Historic roster and Duty stats read from history + current block without double-counting the same block after repeated Save roster.
8. Open a v1 file → migrated to v2 without data loss; open a v2 file missing `essential` → each role defaults to `essential: true` with no behaviour change until the manager unticks some.
9. Attendance status dropdown offers Rest day; People screen lists the team sorted by surname.
10. A role with Used by day off and Used at night on (for example Public Office) is offered by Generate and manual assign only on night shifts.
11. Roster shows one column per day with duty type / status text coloured per person; an unassigned Present person's cell is blank white with italic light-grey “Unassigned”; vacated **essential** roles appear in the parking lot (`<role> — was: <person>`); vacated non-essentials do not; a non-Present person with a former role shows `<status> (was: <role>)`; the day header (incl. parking lot) and name column stay visible while scrolling; parking lot is not printed; Print uses A4 landscape of the **saved** roster (or Save & print when unsaved), scaled to prefer one page.
20. Roster is full-width with a single compact toolbar; on-screen print header is hidden; table body scrolls within the remaining viewport; ~30 compact rows fit 1080p without scrolling when chrome is minimal; parking-lot chips wrap/scroll inside a height cap.
21. Print preview at 20 / 28 / 35 / 45 people: one page down to the readable minimum scale; second page only beyond that; `thead` repeats; rows do not split mid-row.
22. Sidebar collapses/expands via hamburger at all widths; choice persists per viewer in `localStorage` when available; default collapsed on narrow, expanded on wide.
12. On Attendance and Roster, Present cells are green; Annual leave, Sick leave, Duty away, and Rest day cells are the same blue; assigned roles still use their role-group colours on Roster/print.
13. On Attendance, scrolling the person list keeps the day / shift header row visible (and the Person column still sticks when scrolling sideways).
14. Roles screen shows an Essential checkbox; essential roles list above non-essential; Generate fills essentials before non-essentials; Attendance “x present, y roles” uses essential-only `y`.
15. Changing attendance to Sick does **not** set `stale` or suggest regenerate; vacated **essential** appears in the parking lot; vacated non-essential does not; returning to Present restores the assignment.
16. Parking-lot chip→person and person↔person moves follow H47 (incl. chip→non-essential drops that role for the day; essential→non-essential person drag = swap); cross-day rejected; invalid targets dimmed; toast after each move.
17. Snapshot / warn `unfilled` counts vacated essential roles only. Generate and Print are never blocked by unfilled essentials.
18. After first Generate, regenerate is secondary **Start over / Regenerate** with confirm. Save roster twice for the same start leaves one history entry. Unsaved badge appears after edits/attendance/employee-or-shoulder-number changes; Print becomes Save & print until saved.
19. People without `employeeNo` / `shoulderNo` open with blank strings; People detail can edit both; search finds by number; Roster/print show Employee / Shoulder no. columns after Name (blank when unset); a saved snap carries the numbers; an old snap without them renders with no number columns; CSV export columns unchanged.
23. Roster **Briefing sheet** bar offers one Print button per day (e.g. Print Thu): portrait sheet lists that day’s Present+assigned people sorted by role `sortOrder`, with Role / Name / Employee / Shoulder and group colours; leave and Unassigned omitted; live roster (no Save); full-block Print unchanged. (H61)
24. Duty stats shows a person × role table with counts; the ▲ / ▼ at the top of a role column sorts by that role (▼ = most first), clicking the heading name toggles; Person sorts A–Z / Z–A; Hard / Skill / Total columns and a Total row tally at the end; there are no Day / Night columns.
25. Historic roster shows the same person × day grid as Roster for saved person-day snaps (and rebuilds one when possible); read-only with Print in colour; year / month / period selectors retained. (H24)

---

## 11. Open questions

1. Soft-fallback vs fail loudly when hard-night rules cannot be met? (**Today: soft + unfilled essential cells.**)
2. When to weight Generate from Log history (H28)?
3. Whether to add an in-app Audit viewer for `logs/**/audit_log.txt` (H29).
4. Shared network folder: is last-write-wins enough, or warn on `meta.updatedAt` conflicts?
5. **Non-essential vs H10:** Should the non-essential generate pass skip the no-repeat rule, or apply it loosely? (**Assumption to confirm: skip or loose — prefer skip so Files 1–5 absorb whoever is left.**)
6. ~~**Save to log duplicates:**~~ **Resolved (H15 / H49):** Save roster upserts by block start; no new duplicates. Pre-existing duplicate history rows are left alone (no migration).
7. ~~Should Generate refuse to run while `stale === true`?~~ **Resolved for attendance:** attendance no longer sets `stale`. For catalogue/shift `stale`: keep warn-only. Regenerate is confirmed Start over (H48), not suggested for attendance.
8. **Block start date after Save:** Changing `blocks.current.startDate` after a Save roster creates a **new** log entry on the next save (different start). No special merge or rename of the old entry — managers treat it as a new block.
9. ~~**Bulk entry for employee/shoulder numbers:**~~ **Out of scope for H53** — managers edit numbers on the People detail panel (and search by number). No Paste-many comma format and no “Edit numbers” table for now.
10. **Top-bar nav:** A possible future option is moving primary nav into the top bar (and retiring the sidebar). **Not in scope for H58** — keep the collapsible DaisyUI drawer/sidebar.
11. **Typical unit headcount:** Used to tune compact-row height and print scale thresholds (H56–H57). Mock/sample data ships **12** people. Real unit size to confirm with operators before locking thresholds.

### Assumptions challenged (Phase 1)

| Assumption | Challenge | PRD stance |
| --- | --- | --- |
| Attendance changes no longer set `stale` | Managers may still want a “something changed” cue | Keep: parking lot + banner **is** the cue; `stale` reserved for shape-breaking setup changes |
| Unqualified drops blocked (toast) | Some units might want a soft warn | Keep hard block — matches H7 |
| Non-essential skips H10 (no-repeat) | Fairness across Files roles may matter | Open Q5 — default implement as **skip** unless review says otherwise |
| Fixed-role person on non-essential while essentials short | Leaves an essential empty | Keep rule 5 (fixed wins); warn on the empty essential |
| Essential person → non-essential person | Transcript ambiguous: swap vs replace | **Swap** — avoids accidentally stripping a duty |

### Docs outside this PRD

- **SECURITY.md**: note that employee/shoulder numbers sit in the unit JSON, workspace folder (incl. backups), and saved rotas (H53 posture change). **docs/THIRD_PARTY.md**: no change expected (still offline, local JSON, no new deps or network).
- **README.md**: update operator flow (Attendance → Generate → Roster) in Phase 2 when behaviour ships.


---

## 12. Relationship to Excel / Power Apps docs

| Topic | Excel / Design Spec | This HTML PRD |
| --- | --- | --- |
| Rules & roles | Same domain | Same |
| Storage | Excel tables | v2 JSON + optional workspace folder |
| Front end | Sheets / Power Apps | Offline HTML (Home-first UX) |
| Shared future | — | v2 JSON remains the contract |

The HTML app is the shipping path. Older Design Spec / PDF PRDs are historical.
