# Shift Manager – Deprecated product requirements

Requirements and product surfaces that are **no longer in force**.  
Active requirements live in [`Shift_Manager_PRD.md`](Shift_Manager_PRD.md).

**Rule:** when a requirement (H-id or named product surface) is deprecated, retired, or superseded, move its full text here. Leave only a one-line pointer in the live PRD (or omit the H-id from Must/Should/Could tables). Do **not** leave deprecated behaviour documented as current in `Shift_Manager_PRD.md`.

| Field | Meaning |
| --- | --- |
| **Deprecated** | Date the requirement left the active PRD |
| **Superseded by** | Active H-id(s) or policy that replaced it |
| **Notes** | Migration / compat still required in code, if any |

---

## Deprecated requirements

| ID / surface | Deprecated | Superseded by | Former requirement | Notes |
| --- | --- | --- | --- | --- |
| **H30** | 2026-09-27 | One workspace folder per unit (`AGENTS.md` / PRD §1 Workspace model) | Multiple units inside one JSON (`unitId` on entities) | Do not implement multi-unit JSON; keep one folder per unit |
| **Spare notes (free-text)** | 2026-09-22 | **H37** (Unassigned empty cell) | Free-text spare notes on Present people with no role; `blocks.current.spareNotes[]` on the working block and in snapshots (sometimes called “HVB” in older notes) | Migrate-on-open clears `spareNotes` to `[]`; new snapshots omit the field |
| **Print rota nav** | 2026-09-25 | **H14**, **H36**, **H46** (Print action on Roster) | Separate top-level **Print rota** nav screen | Persisted UI id `prt` still opens Roster for old deep-links |
| **Person × role Roster grid** | 2026-09-25 | **H12**, **H36**, **H46** (person × day Roster) | Post-generate edit grid was person × role (interactive screen separate from print) | Old log snaps with `layout: "person-role"` / legacy still render read-only |
| **Duty stats Day/Night + duty-type columns** | 2026-09-25 | **H25**, **H59**, **H60** (person × role pivot) | Duty stats showed Day / Night columns/tiles, a duty-type (group) column, and a Top roles column | Historic list cards show duties only; no Day/Night tiles |
| **H24 / Historic roster screen** | 2026-09-29 | **H68** (Edit a saved roster from the Log), Log "View" | Historic roster: browse saved periods by year / month / block using the same **person × day** layout as Roster (Name + Employee / Shoulder + day columns, role-group colours, Unassigned). Read-only; Print in colour from the saved snap. Older log layouts still render when a person-day snap cannot be rebuilt. Entries saved before the person × day snapshot are converted for display and do **not** show an “unfilled” warning (it would be guessed from today's role list); entries in the current format show the unfilled list as saved | Screen, nav entry and `screens/hist.js` removed; the Log lists every saved block and its View shows any layout (older ones included). `personDaySnapFromHistory` / `historicRosterModel` stay in the code for now (unused by any screen). A stored `ui.screen` of `hist` opens the Log |
| **Delete a saved rota (Log)** | 2026-09-29 | **H68** (edit instead), **H15** | Log had a **Delete** button (confirm dialog) that removed a saved roster from the log | Button and action removed; saved rosters are corrected with Edit rather than removed. Existing JSON is unaffected |
| **Excel / Power Apps front end** | 2026-09 (HTML edition) | Single-file offline HTML app | Original PRD assumed Excel / Power Apps UI | Business rules retained; delivery is `shift-manager.html` / offline zip |
| **Legacy PDF PRD** | 2026-09-27 | [`Shift_Manager_PRD.md`](Shift_Manager_PRD.md) | `docs/Shift Manager App – PRD.pdf` (historical Design Spec PDF) | File removed from the repo; do not redistribute |

---

## Resolved open questions (moved from live PRD §11)

| Topic | Resolved | Outcome |
| --- | --- | --- |
| Save to log duplicates | H15 / H49 | Save roster upserts by block start; no new duplicates. Pre-existing duplicate history rows left alone |
| Generate while `stale` | H13 / H48 | Attendance no longer sets `stale`; catalogue/shift `stale` stays warn-only; regenerate is confirmed Start over |
| Bulk entry for employee/shoulder numbers | H53 | Out of scope — edit on People detail; search by number |

---

## How to deprecate (agents)

1. Copy the full former requirement text into the table above (new row).
2. Remove it from Must / Should / Could in `Shift_Manager_PRD.md` (or replace the row with: `Moved to PRD_Deprecated.md`).
3. If behaviour still needs migrate-on-open or legacy render, keep that under schema / invariants in the **live** PRD — not as an active Must.
4. Update architect Mode A/B doc-sync notes; run verify if operator README mentions the old surface.
