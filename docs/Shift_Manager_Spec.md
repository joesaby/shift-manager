# Shift Manager – Technical Spec

How the requirements in [`Shift_Manager_PRD.md`](Shift_Manager_PRD.md) are built: layout and CSS, stored fields, code paths, storage and print mechanics. The PRD says **what the shift manager gets**, in their words; this file says **how it is built**.

- Each entry is **S<n>** and the PRD row for an H-id points here with `Spec: S<n>`.
- Under each entry the full technical text of each H-id is kept, unchanged from when the requirements were a single table.
- The Generate rules table stays in the PRD (§5, generated from [`src/js/rules.js`](../src/js/rules.js)); S7 holds the surrounding detail.
- Persistence, JSON schema, module boundaries and NFRs are still in PRD §6–§9.
- UI work: new Tailwind / daisyUI classes must exist in the vendored `src/styles/tailwind.css`, otherwise plain CSS in `app.css` (AGENTS hard constraint #7).

---

### S1 · People list and details

**H1** — Add, rename, deactivate and delete people

**H34** — People screen list is sorted by **surname** (last word of the person's name), not first name

**H53** — Per person: optional **Employee number** and **Shoulder number** (`employeeNo`, `shoulderNo` — strings, default `""`). People detail: two inputs beside Name. Search matches numbers as well as names. Roster/print (`rotaHTMLPersonDay` and the interactive Roster table): a single header row with two narrow non-sticky columns “Employee no.” and “Shoulder no.” after the sticky Name column (min-widths sized for an 8-digit number); blank when unset; number cells are not drag targets. `buildSnapshot()` stores both per person; render number columns only when the snap carries them (legacy snaps unchanged). Unsaved comparison (H51) includes them. CSV export unchanged. Number columns are included in print scale-to-fit (H57)

**H21** — Paste-many for people and roles

**H22** — Sample dataset for training


---

### S2 · Qualifications and fixed role

**H2** — Per person: qualification ticks for every role (People screen — the only place "who can do what" is set). **Select all** / **Clear all** buttons above the ticks set every role at once (then untick the one or two they can't do)

**H3** — Per person: optional fixed role (“only do this”), limited to qualified roles


---

### S3 · Long-term sick

**H67** — **Long-term sick:** People detail has a **Long-term sick** toggle with **From** and optional **To** dates (inclusive; no To = until ended). Ticking it starts the period on the current block's start date. Stored as `people[].longTermSick: { from: "YYYY-MM-DD", to: "YYYY-MM-DD" | "" }` (absent = none; additive, old files open unchanged — no migration needed). `getStatus` (`model.js`) returns **Sick leave** for a covered day that has no attendance entry, so every new block, Attendance, the summary and tally (H66), Roster, Generate, saved snapshots and Duty stats use it with no per-day clicking. An attendance day set by hand wins for that day only (Present on a covered day is stored explicitly). Changing the period does not mark the roster stale (like any attendance change, H13). To before From is rejected with a toast. Sick leave only; **Active** (H-none) is unchanged and is for people who have left


---

### S4 · Role catalogue and groups

**H19** — Manage role list: name, group, day/night use, hard, **essential**, once per block, **Files role** (H73), display order (**Up / Down** move a role within its essential / non-essential band; a new role goes to the end; deleting a role keeps the others in order). Roles screen groups **essential roles first**, then non-essential; `sortOrder` among non-essential is fill/drop priority When a redraw changes a role's place (Up / Down, ticking Essential or Files role), rows slide from their old position (`animateRows` in `main.js`, Web Animations, ~350ms) and the role acted on is briefly highlighted (`tr.row-moved`) and scrolled into view if off screen; skipped under `prefers-reduced-motion`. Screen only, nothing stored. The roles table sits in a scroll area (`.rolesScroll`, max 70vh) whose heading row stays put while scrolling (`.roles-freeze`, same pattern as Attendance).

**H20** — Manage role groups, and a print colour **per role** (`roles[].color`; colour picker beside the role name; new roles default to light blue). Groups no longer carry a colour. Migrate-on-open: a role without `color` copies its old group's colour (roles in one group start identical), then `groups[].color` is dropped

**H35** — Roles have both **Used by day** and **Used at night** flags; a role can be restricted to only one shift type (day fills roles marked used-by-day, night fills roles marked used-at-night)

**H43** — Roles have an **Essential** flag (`essential: boolean`). Roles screen: Essential checkbox column; list groups essential roles first, then non-essential. Default `true` on migrate when the field is missing


---

### S5 · Once per block and the Files role

**H70** — **Once per block:** roles have an optional **Once per block** flag (`oncePerBlock: boolean`, absent = false; additive, no migration). Generate never gives a person more than one day in a block on flagged roles of the same group (e.g. Files 1–5 in a Files group). Always enforced; the role stays blank rather than repeat a person (non-essential)

**H73** — **Files role (takes all spares):** one role may be ticked **Files role** on Roles and groups (`roles[].files: true`, absent = false; additive, no migration; ticking it on one role unticks it on any other; a Files role is always non-essential). After the essential and other non-essential roles are filled, **every Present person still free who is ticked for Files on People gets Files** — no limit per day, so several people share it (exception to invariant 4: many assignment rows may share the Files `roleId` on one date). Its **Once per block** tick is honoured (H70): someone spare again after already having Files this block is left **Unassigned**. **Fair spares:** the essential and non-essential passes add a secondary cost so the people who have had Files **least, as a share of their duties** (H28 window), are the ones left free; H28 role fairness stays the main score. On Roster a Files holder is treated as spare for moves: a parking-lot chip or role dropped on them gives them that role and drops Files for the day; essential/non-essential holder ↔ Files holder swaps (the old holder gets Files if ticked for it); × removes Files; the Add-role selector offers Files. Briefing sheet and print list each Files person. Older builds that do not know the flag read only one Files holder per day


---

### S6 · Attendance screen

**H4** — Set block start date and Day/Night for each of four days

**H5** — Set status per person per day: Present, Annual leave, Sick leave, **Paternity leave** (`paternity_leave`; additive — files saved before it open unchanged and gain the status in `settings.statuses` on open), Duty away, Rest day. **Duty away description:** when a day is Duty away, a text box under the dropdown (max 60 chars) takes the exact reason, stored as optional `note` on that attendance row (additive, no migration; changing the status away from Duty away drops it). The status stays Duty away, so attendance counts, the Tally and Duty stats are unchanged; the roster / print cell and the briefing-sheet away row show the typed text instead of “Duty away” (blank = “Duty away”). The text is part of the saved snapshot, so changing it makes the roster unsaved (H51). An **AL** checkbox to the right of each name on Attendance puts that person on Annual leave for every day of the block (ticked when all days are Annual leave; unticking sets every day back to Present)

**H33** — **Rest day** is an attendance status choice (does not allocate; shown as status text on Roster/print)

**H40** — Attendance screen's per-day card shows the date prominently (large) and the present / roles headcount smaller; the roles count (`y` in “x present, y roles”) counts **essential** roles only for that shift

**H41** — Attendance and Roster use the same status colours: **Present** is green; **Annual leave**, **Sick leave**, **Duty away**, and **Rest day** share one blue (unavailable). Role colours on Roster/print stay as configured under Roles and groups

**H42** — Attendance screen's day / shift header row stays frozen (visible) while scrolling the person list

**H66** — **Attendance tally:** (a) **Attendance** day summary sits **inside each day's column header** (above the status dropdowns, so it lines up with its column; the separate stats strip is removed) and keeps “N present, M roles to fill” (green / red as before) and adds a second line with one chip per non-Present status that has people that day (e.g. Annual leave 2 · Sick leave 1), in the Attendance status colours (H41); “Everyone present” when none. (b) **Roster** toolbar has a **Tally ▾** menu of checkboxes, one per attendance status (none ticked by default). Ticked statuses appear as a **Tally** footer row under each day column (label + count, zero shown), pinned to the bottom of the scroll area on screen and **printed** with the roster (one extra row in the one-page fit, H39 / H57). No ticks = no row. The ticked set is remembered per viewer in `localStorage` (try/catch), never saved to the data file or snapshots; counts come from the live attendance of active people (`statusCountsForDay`, `model.js`). Log prints are unchanged


---

### S7 · Generate

**H6** — Generate fills roles for Present people for the block: **essential roles first**, then non-essential from remaining Present people (see H44)

**H7** — Generate and manual edit only offer qualified people (hard block)

**H8** — Fixed-role people get that role when Present (including when the fixed role is non-essential — fixed wins even if essential roles are short). **Manual edits (Roster):** once a fixed-role person is no longer on their fixed role that day (e.g. someone else was given it), they may take Files or any other role they are ticked for that day (`canDoOn` in `model.js`); while they hold the fixed role the usual fixed-role rule still applies

**H10** — Prefer not repeating the previous working day’s role when alternatives exist (**essential pass**; non-essential pass may skip or apply loosely — see §11)

**H11** — Hard roles not on back-to-back nights when alternatives exist (essential pass; non-essential hard roles follow the same soft rule if marked hard)

**H13** — Warn on **unfilled essential** roles (never block Generate or Print). Unfilled non-essential roles do not warn. Set `stale` after **role-catalogue or Day↔Night shift** changes — **not** after attendance-only changes. Do **not** suggest regenerate for attendance changes (see H48) **Not enough people for every essential role** (e.g. Once per block roles used up late in the block, so too few eligible people on the last day): the most roles possible are still filled, and the roles **lower in the Roles and groups list** are the ones left empty — the generator's cost for leaving an essential role empty rises with its place in the list (`EMPTY_STEP` in `generator.js`; essentials are taken in `sortOrder`), so drivers listed first are filled before later essentials. Previously the choice was random, so a different role could be left empty on each regenerate

**H28** — **Fair rotation across all blocks:** Generate gives each role to the Present, qualified person who has done that role **least, as a share of their own duties** (role count ÷ their total duties) — over the **12 months before the block starts** (`LOOKBACK_MONTHS` in `rules.js`) of rosters saved to the Log, plus the earlier days of the block being generated; ties at random. Older blocks, later-dated saved blocks and the saved copy of the block being generated are not counted, and a saved duty on a day the person was **not Present** (attendance row or long-term sick) is not counted. Share rather than raw count so a new starter or someone back from long leave is not picked for the same role for months. Each day's essential roles are solved together (min-cost assignment; with a Files role, see H73, a secondary cost leaves the people who have had Files least as the spares), so every essential role is filled whenever any valid arrangement exists; a role stays blank only when nobody Present can do it (warns per H13). H71 / H11 stay soft in the essential pass, H70 / H71 always enforced in the non-essential pass, which keeps list-order priority (H44). Goal: role counts on Duty stats even out over time (leave / sickness mean not always exactly). Replaces the within-block "not recently" preference, the skill-first order (H9) and the random shuffle of general roles

**H44** — Generate **two-pass**: (1) essential roles with current allocation logic; (2) non-essential roles in `sortOrder` from remaining free Present people; (3) the **Files** role (H73), if any, takes everyone still free. Roles that cannot be filled stay **blank** (same as after ×): never fail strict mode for non-essential shortage; unfilled essentials warn (H13) but do not block. List order among non-essential = fill/drop priority. **No** auto-promotion of a non-essential holder into a vacated essential role. Catalogue is expected to have enough roles that every Present person can be assigned

**H48** — **Generate once per block:** before a roster exists, Generate is the primary action. After a roster exists, it is a secondary **Start over / Regenerate** with confirmation (“reshuffles everyone and discards manual edits”). No banner suggests regenerate for attendance changes

**H69** — **No regenerating a passed roster:** a block is *past* once its last day is before today. A past block that already has a roster cannot be regenerated: Roster shows a **Past roster · corrections only** badge instead of Start over / Regenerate, the Attendance **Generate roster** button is disabled, and the action itself refuses with a message. Cells can still be edited and saved (H68). Current (in-progress) and future blocks can be regenerated as before (H13, H48); the first Generate for a block with no roster is always allowed. Guard is a convenience against accidents, not tamper-proofing — anyone can edit the JSON

**H75** — **Probationer:** optional per-person tick on People (`people[].probationer: boolean`, absent = false; additive, no migration; shown as “Probationer” in the person's summary line). After the essential and non-essential fills and before Files, Generate checks each probationer group: if two or more Probationers hold roles in it, one swaps with a non-Probationer in another group (both must be qualified, neither a fixed-role person, no hard rule broken, the other group free of Probationers), else hands the role to a free non-Probationer and drops to the spares. **Probationer groups:** the rule only applies within **probationer groups** (`probationerGroups[]: {id, name, sortOrder}`; a role belongs to at most one via `roles[].probGroupId`), created under a **Probationer groups** subheading on Roles and groups and chosen per role in the roles table; roles in none are unrestricted. Migrate-on-open: files without `probationerGroups` that contain a Probationer get one probationer group per existing group with roles (same behaviour as before); otherwise none. A soft rule: if no arrangement exists the clash stays and every role is still filled. The Files role is exempt (many people share it). Manual edits are not restricted

**H71** — **No same-group role two days running:** Generate does not give a person a role from the same **group** they held the previous day (supersedes the role-only rule in H10). Essential pass: soft, as H10 (falls back if unavoidable); non-essential pass: always enforced (role left blank rather than repeat). Fixed-role people are unaffected. Manual edits are not restricted


---

### S8 · Roster screen layout and selection

**H36** — **Roster** (interactive, post-generate) renders **person × day**: person name leftmost, each day a column, duty-type/status text coloured per role / status. Print is an action on this screen, not a separate nav screen. Persisted UI screen ids `prt` and `ros` both open Roster. Layout: full-width main (H54), compact toolbar (H55), viewport-sized scroll body (H56)

**H46** — Single post-generate working screen: person × day **Roster** (**Save roster** + Print actions). Former person × role grid / Print rota nav → [`PRD_Deprecated.md`](PRD_Deprecated.md). Keep roster warnings and swap behaviour on the new screen. Historic/log snaps with older layouts still render

**H54** — **Full-width Roster (and Attendance when trivial):** on these screens the main content is not capped at `max-w-7xl`; horizontal padding is reduced so Name + Emp + Shldr + four day columns fit without horizontal scrolling on typical laptop widths (incl. ~1366×768 with sidebar collapsed)

**H55** — **Compact Roster chrome (screen):** one toolbar row — “Roster · unit · block dates · Unsaved badge · Save · Print / Save & print · Start over”. No page subtitle. Vacated-role and unfilled alerts stay but are compact/inline. The crest / “Duty rota …” / “Prepared by” block is **print-only** (`no-print` inverse / screen-hidden). Screen card padding is tight

**H56** — **Viewport-sized Roster table (screen):** the scroll region uses remaining viewport height (not a fixed `70vh`). Only the table **body** scrolls; day header + parking lot stay in the frozen thead (H38). Compact row padding (~`py-1`) so ~30 people fit a 1080p screen without vertical scrolling when chrome is collapsed/minimal. Parking-lot row height is capped (wrap ≤2 lines, then scroll inside the parking cells) so many chips do not push the grid down

**H38** — On Roster, while scrolling the person list: the **day header row**, the **parking-lot row**, and the **Person (name) column** stay frozen/visible. Employee / Shoulder number columns scroll with the body (not sticky). Do not break this when sizing the scroll region to the viewport (H56). **Scroll is kept on redraw:** clicking or dragging a cell redraws the screen without resetting the table's (or page's) scroll position, so a long roster stays where the manager was working, and a dropdown or input you just changed keeps keyboard focus (without scrolling), so Tab carries on from where you were instead of restarting at the top of the page. **Auto-scroll while dragging:** dragging a person or parking-lot chip near the top or bottom of the table (including over the frozen header or pinned Tally row) scrolls the table in that direction, faster nearer the edge, so a long roster can be reached without dropping first

**H63** — **Roster column fit:** on Roster and print, the Name, Employee no. and Shoulder no. columns are sized to their longest content in **pixels** (never stretched; a name never wraps, so every row is one line — even on the narrower printed page), and the day columns share the remaining width equally. Widths are derived at render (`src/js/colfit.js` measures the table, then writes a `<colgroup>` with px widths for those columns and unsized day columns, with fixed table layout), never stored, so there is no schema change and old snapshots get the same treatment. Long role text in a day cell may still wrap on a narrow window. Complements H39 / H57 (one-page print). Drag-to-resize is not part of this requirement

**H64** — **Highlight a Roster row:** on Roster, clicking a person's name highlights that row (outlined, name cell tinted); click the name again or press Esc to clear. With a row highlighted, **↑ / ↓** move the highlight to the row above / below (inactive people are skipped; stops at the first / last row; the row is scrolled into view; ignored while typing in an input or select). Selection only: rows are **never reordered**, nothing is saved or changed in the data, and the highlight is not printed. Independent of the swap selection (H36 drag / click cells)


---

### S9 · Unassigned cells, parking lot and moves

**H12** — Manual edit on the **person × day Roster**: assign, same-day moves (see H47), unassign / leave unfilled

**H37** — On Roster (and print), a Present person with no role shows a blank white day cell with italic light-grey **Unassigned** — primed for parking-chip drop or person swap (skill / Present / fixed-role rules still apply). Typical causes: × unassign or role moved to parking lot. **Assumption:** managers keep **more roles than Present** for each day/shift so Generate does not leave surplus people empty. Former free-text spare notes → [`PRD_Deprecated.md`](PRD_Deprecated.md); `blocks.current.spareNotes` cleared on migrate-on-open; new snapshots omit the field. **Add role selector (screen-only):** when at least one role for that day (essential or non-essential) is unfilled and this person is Present and qualified for it, the Unassigned cell shows an inline `<select>` listing those roles (essential first, non-essential marked "(optional)") instead of the plain label, so a last-minute non-essential fill does not require the parking lot. Choosing one calls the same `assignRoleToPerson` path as other assign gestures. When no such role exists, the plain "Unassigned" label keeps a tooltip explaining why: nothing unfilled for anyone that day, this person isn't Present, or they aren't qualified for what's left. Not printed

**H45** — Vacated roles are **derived**, not stored. **Parking lot:** pinned row under the frozen day header listing vacated **essential** roles only (chips: `<role> — was: <person>` when known; slim “all essential roles covered” when empty so layout does not jump; not printed). Vacated **non-essential** roles create **no** chip and **no** warning — silently empty for that day; the sick person's cell shows the status with a small **screen-only** second line `was: <role>` (never printed and not stored in the saved snapshot text). Returning to Present restores the assignment. Snapshot `unfilled` counts vacated essentials only

**H47** — Same-day moves on Roster. **Primary:** drag parking-lot chip onto a person (click chip → click person fallback). **Person drag** via cell handle. Matrix: chip→unassigned takes role; chip→non-essential holder → they take essential, non-essential **dropped for that day** (no parking, toast); chip→essential holder → they take parked role, old essential enters parking lot; essential↔essential and non-essential↔non-essential **swap**; person→unassigned hands over; **essential holder → non-essential holder = swap** (not replace). Reject/dim non-Present, skill-unqualified, fixed-role-invalid; cross-day rejected. Toast after every move. Unassign available (role to parking lot; person cell becomes Unassigned)

**H74** — **Last on Files (screen only):** on Roster, each Files cell shows a small second line with the date that person last had Files before that day (saved rosters plus earlier days of this block; Present days only), or “first time”. Derived, never stored in the data file or snapshots, and **not printed** (Roster print, briefing sheet) — helps pick who to move into an essential role at short notice


**H76** — **Borrowed people (other units).** Under the Roster table (screen only): "Short-staffed? Add someone borrowed from another unit", a name box (max 40 characters, Enter or **Add to roster**) — blank names and names already on the roster are refused with a toast. Each one becomes an extra row **after the team**, tagged **Borrowed** with a screen-only **Overtime** tick (stored as `overtime: true`; when on, the word *Overtime* in italics follows the name on screen-print, the saved rota view and Historic roster, and `overtime` is carried on the snap person) and a screen-only × to remove (these controls sit in the otherwise empty Employee / Shoulder number cells of the borrowed row, positioned so they never widen the Person column or the printed table). The printed *Overtime* word is bold red, the same size as the name (confirmation when they hold a duty; their roles go back to unfilled). Stored on `blocks.current.borrowed[]` (not `people[]`), so Generate, People, Attendance counts, Tally, Duty stats and rotation history never see them; **Start over / Regenerate clears them**. They count as Present every day, are qualified for every role **except Files**, and take roles through the same paths as H37 (Add role select, parking-lot chip, swap). Their cell is blank (not "Unassigned") on days with no duty, in print and in the saved snap (`blank: true`); their row, the duty detail and the Day briefing sheet carry the name and role. Saved to the Log with the roster (`borrowed[]` on the entry) so **Edit** and Historic roster show the name. Audit lines `BORROWED_ADDED` / `BORROWED_REMOVED`

---

### S10 · Print the roster

**H14** — Colour print from the Roster: **person × day** grid — person leftmost column, then optional Employee / Shoulder no. columns (H53), then one column per day; each day cell shows that person's duty type or status as text, coloured by role group when Present, or by the shared unavailable-status colour when not Present (see H41). Non-Present cells that still have a stored assignment show `<status> (was: <role>)`. Print only what has been **saved** (see H51–H52). On screen the print header (crest / “Duty rota …” / “Prepared by”) is hidden; it appears in print (H55). Output aims to fit **one A4 landscape page** via scale-to-fit (H39, H57). Optional extras: a **Tally** footer row of attendance counts per day (H66) and black cell borders (H65); column widths follow H63

**H14 layout note** — The print header carries a bold **Duty Detail** heading at the top right (where browsers put the page title). `@page` margin is 0 so the browser's own date / title header and footer are not printed; `#printArea` supplies the 10mm padding instead. The print date and time sit in the bottom-right corner of every page (`.print-stamp`, filled on `beforeprint`). Applies to the Roster, Log, and briefing-sheet prints. The header lists **Station**, **Unit**, **Period** (block dates) and **Prepared by** (saving manager) as labelled lines; Station comes from a new optional `meta.stationName` (Home → Station name; additive, absent in older files and read as blank). Day / Night column headings show the duty hours — `Day (7am-7pm)`, `Night (7pm-7am)`. "Duty Detail" is 20px bold. Saved snapshots gain an optional `stationName` (older ones fall back to the current setting)

**H39** — Print output uses **A4 landscape** with ~10mm margins. Prefer **one page**: scale font/padding so Name + number columns + four day columns fit; readable floor ≈ 8–9px. Beyond what scale can keep readable, a second page is allowed. Safety: `tr { break-inside: avoid }`; `thead` repeats on a second page. Parking lot, drag handles, × unassign and the row highlight (H64) are not printed; the optional Tally row (H66) is printed and counts toward the one-page fit

**H57** — **Print scale-to-fit:** at render (or via a CSS variable / `zoom` on `#printArea`) shrink font size and row padding so the saved roster fits one A4 landscape page down to a readable minimum (~8–9px). Includes H53 number columns. Parking / drag / unassign chrome remain non-printed. Verify with sample data at 20, 28, 35, and 45 people

**H65** — **Black print borders (optional):** Roster toolbar has a **Black borders** checkbox. Off (default): printed grid keeps the light-grey lines. On: every cell of the printed roster (Roster and Log prints) has a 1px black border. Screen appearance is unchanged. The dark date / column heading keeps **white** dividers (black ones would vanish on it). In print the sticky Person column is set to normal flow, because a sticky cell loses its borders in a collapsed-border table (the names column showed incomplete lines). The choice is remembered per viewer in `localStorage` (try/catch; works without storage) and is not saved in the data file or snapshots, so there is no schema change

**H52** — When unsaved, Print becomes **Save & print** (save first, then print). When saved, Print uses the existing `#printArea` (no separate render path)


---

### S11 · Day briefing sheet

**H72** — **Day briefing print:** on Roster, a **Briefing sheet** bar above the grid has one **Print day-label** button per day (e.g. Print Thu). Prints a disposable one-page A4 **portrait** sheet for that day only: rows are Present people with an assigned role, **in the order of the Roles and groups list** (essential roles first, then the rest, each by `sortOrder` — `rolesInListOrder()` in `model.js`, the same order the Roles screen shows), then person name; the Role cell keeps its role colour. Annual leave, Sick leave, Paternity leave, Rest day and Duty away rows follow (a Duty away row shows its typed description, H5); columns Role · Name · Employee no. · Shoulder no.; Role cell uses the role colour. Heading reads **Briefing sheet: <date> · <Day/Night>**. Present people with a role come first; **Annual leave, Sick leave, Paternity leave, Rest day and Duty away** people are listed at the bottom (status in the Role column, in that order, then by name). Unassigned Present are still omitted. Uses the **live** roster (no Save required; does not change person row order on the interactive grid or write to Log). Full-block **Print / Save & print** (H14, H52) stays unchanged (landscape person × day of the saved roster). Empty day (nobody Present+assigned) toasts and does not open the print dialog. The page is put back on `afterprint` (or before the next print) — there is no timer, so a print preview left open is never redrawn under the manager


---

### S12 · Save roster, unsaved state and audit

**H15** — **Save roster** upserts the log entry for the current block start date (match `start` or `startDate` on history rows); replace that entry with the latest snapshot rather than pushing a duplicate. Browse, re-print, **Edit** (H68), CSV export on Log (no delete — see [`PRD_Deprecated.md`](PRD_Deprecated.md)); show manager who saved when known. Changing block start after a save creates a **new** history entry. Pre-existing duplicate rows from older push behaviour are left alone (no cleanup)

**H49** — **Save roster** upserts by block start (`start` / `startDate`); Log and Duty stats must not double-count the same block after repeated saves

**H50** — Every Save roster writes a folder **audit** line via `logAudit` (text files under `logs/`, not JSON). Earlier log versions for that start are not kept — only the audit trail records that a save happened

**H51** — **Unsaved** is derived (not stored): compare live `buildSnapshot()` to the last saved history entry for this block start, ignoring stamp fields (`savedBy`, `savedAt`, and equivalents). Include attendance status and employee/shoulder numbers so a post-save sick mark or number edit makes the roster unsaved. Show an “Unsaved changes” badge when unsaved — bright red (`.badge-unsaved` in `app.css`), with a grey “Saved” badge otherwise. The sidebar/top-left badge is separate: it tracks the **data file** (“Data file not saved” in red / “Data file saved”), not the roster Log. Closing or reloading the tab triggers the browser’s leave-page warning when either the data file or the roster is unsaved (browsers do not allow a custom Save button there)

**H18** — Set **manager name** (browser-local); stamp on new Save roster / print snapshots; do not rewrite older entries


---

### S13 · Edit a saved roster

**H68** — **Edit a saved roster:** each Log entry (list and viewer) has an **Edit** button that copies the saved block (dates, Day/Night shifts, attendance, assignments) into the working block and opens Roster, with all the usual tools (swap, parking lot, tally, print). Save roster then replaces that block's log entry (H15 upsert), so past rosters can be corrected and planned ones changed. The log entry itself is never modified until you save. If the working roster has **unsaved changes**, a prompt offers **Save & open** (saves it first) or Cancel; if it is only attendance with no roster yet, a warning offers **Open anyway** or Cancel. Older-format entries without dates / shifts / attendance / assignments are view-only (Edit disabled). Opening writes a `ROSTER_EDIT_OPENED` audit line. Old JSON needs no migration


---

### S14 · Duty stats

**H25** — Duty stats: team load over a chosen period (H61) as a person × role pivot (H59) with hard / total tallies, and a per-person report (H62); no Day / Night or duty-type (group) columns

**H59** — **Duty stats pivot:** for the selected period (H61), one row per person and one column per role, each cell the number of times that person did that role (blank-dot when none). Columns follow the Roles screen (essential first, then list order); a duty that appears in the log but is no longer in the role list keeps a column at the end. Day / Night columns and tiles, the duty-type (group) column and the Top roles column are removed. The former Historic month list is retired → [`PRD_Deprecated.md`](PRD_Deprecated.md); use the period selector (H61)

**H60** — **Sortable and tallied:** every heading (Person, each role, Hard, Total) has its own **▲ (low to high / A–Z) and ▼ (high to low / Z–A)** buttons at the top of the column, so a direction can be chosen directly (▼ on a role = who did it most); clicking the heading name toggles (first click high-to-low, Person A–Z). Ties fall back to name. The active direction is highlighted; other headings show both arrows faintly. **Tallies at the end:** Hard, Skill and Total columns after the roles (Total pinned at the right), and a Total row at the bottom (pinned) with each role's tally and the grand total. Hard roles are tagged “H” on their heading. Sort state is per session (not saved). Sorting keeps the table's horizontal and vertical scroll position (a column scrolled into view stays in view). No highlighting or ranking logic — the table is read as-is

**H61** — **Period selector:** Duty stats covers a date range, not a single month. **Default: everything from the earliest recorded date (current planned block + saved log) up to today.** Presets **All time** (default), **This year**, **This month**, plus a **From / To** date selector (either box may be cleared to return to its default; dates entered the wrong way round are swapped). Duties and attendance are counted by date, the saved copy of the live block is not counted twice (H49). The period is screen state only (not saved to the data file)

**H62** — **Person report:** clicking a name on Duty stats opens a report for just that person over the same period: every role down the page with how many times they did it (zeros shown; hard roles tagged; total and hard totals), and **attendance** — days Present, Annual leave, Sick leave, Duty away, Rest day (and total). Attendance comes from the current planned block and rotas saved to the Log (a block that was never saved is not counted; saved rotas use their per-day records). **← All people** returns to the pivot; **Open in People** goes to that person's People page; **Print this report** prints only this report (`#printArea`: crest, unit, name, employee / shoulder numbers when set, period, prepared by) on one A4 landscape page


---

### S15 · Workspace, backups and unit name

**H16** — Open / save JSON; `localStorage` backup; **Choose folder** workspace with autosave

**H17** — Set **unit name** (`meta.unitName`); show on Home, Attendance, Roster, sidebar

**H26** — Workspace `backups/` (prev + dated snapshots) when folder connected

**H27** — Folder audit lines under `logs/YYYY/MM/DD/audit_log.txt` for milestones


---

### S16 · Collapsible sidebar

**H58** — **Collapsible sidebar:** drop permanent `lg:drawer-open` when the user collapses; show the hamburger at every width. Default: collapsed on Attendance, Roster and Duty stats (wide tables), pinned open elsewhere; an explicit Hide / Pin choice overrides the default on every screen. Remember the choice per viewer in `localStorage` (try/catch; render correctly if storage is unavailable). Keep mobile overlay drawer behaviour. **Roles and groups** keeps the sidebar pinned but uses a wider capped main (`.main-roles`, `max-width:96rem`) so the whole table fits without sideways scrolling on laptop screens. Do **not** move nav into the top bar (possible later — see §11)


---

### S17 · Could-have (not required yet)

**H29** — In-app screen to read folder audit text files

**H31** — Qualification expiry / notes on person–role links

**H32** — Cell-level audit of every manual swap (who/when/old/new) in JSON
