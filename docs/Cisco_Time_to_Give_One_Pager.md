# Shift Manager — Cisco Time to Give one-pager

**Cisco employee volunteer project** · Partner initiative: Mill Street Garda Station, Galway  
Offline single-file duty-rota app · ~1 week from PRD brainstorm to working release · Est. **~4 hours saved per shift manager every 4-day block**

Print-ready files: [`Cisco_Time_to_Give_One_Pager.pdf`](Cisco_Time_to_Give_One_Pager.pdf) · [`Cisco_Time_to_Give_One_Pager.html`](Cisco_Time_to_Give_One_Pager.html)

## The problem

Every four days, a Garda shift manager builds a duty rota by hand: who is Present, who is on leave, which skilled roles can be filled safely, and how to keep the sheet fair. In spreadsheets that work is slow, easy to get wrong, and awkward to reprint for parade. Mistakes on skill-restricted or hard roles have real operational cost — and they burn hours the manager could spend supervising the unit.

**Impact:** about **4 hours** saved per shift manager **every four-day block** (attendance → generate → edit → print vs building the rota by hand) — roughly a half-day back to policing and supervision each block, all year.

## The partnership

This Time to Give project grew from a partnership with a Garda colleague at **Mill Street Garda Station, Galway**, and his initiative to modernise how shift managers prepare the duty detail. He brought the operational rules — block patterns, skills, what happens when someone goes sick mid-block, what must land on the printed sheet. As a Cisco employee I brought product and engineering practice: keep it simple, offline-first, and designed for the desk workflow — not a heavy enterprise platform.

We treated volunteering as real product work: listen first, write the rules down, then ship a thin tool the manager owns — one HTML file, data in a unit folder, nothing sent over the internet.

## How we worked — the PRD model

1. **Requirements first.** A living Product Requirements Document (PRD) with Must/Should IDs for attendance, generate, skills, print, and save/print discipline. Retired ideas moved to a deprecated list so the live PRD stayed clean.
2. **Hard constraints.** Offline only, no server, single-file delivery for ICT review, one folder per unit, print that matches the on-screen roster.
3. **Short build loops.** Architect → test-driven behaviour → verify against the PRD. Features shipped only when they mapped to a requirement (essential vs spare roles, parking lot, person × day print, briefing sheets).
4. **Time to value.** From shared PRD brainstorm to a usable offline release: about **one focused week** of paired volunteering and engineering (late September 2026), then ongoing polish under the same discipline.

## What we built

- **Shift Manager** — open one HTML file in Chrome/Edge; no network needed after download.
- **Attendance → Generate once → Roster** — person × day grid for edit and colour print.
- **Skill-safe allocation** — only qualified people on skill roles; fixed “only do this” roles respected.
- **Mid-block changes** — vacated essential roles park for reassignment without regenerating everyone.
- **Save & print** — saved Log, day briefing sheets for parade, historic reprint/CSV; unit-owned JSON with backups.

## How it helps Gardaí

- **Time** — ~4 hours back every block for the shift manager who owns the rota.
- **Safety** — fewer wrong assignments on skilled or hard roles; rules encoded once.
- **Clarity** — one printable person × day sheet plus per-day briefing pages for parade.
- **Continuity** — history and stats without retyping; the unit folder stays with the station.
- **Local ownership** — the Garda’s initiative stays in the lead; Cisco volunteering amplified it with a simple productivity app.

---

*Cisco Time to Give · Employee volunteering · Partnership with Mill Street Garda Station, Galway. Impact hours are operational estimates from the partner shift-manager workflow. Offline tool for duty rotas — not an official An Garda Síochána or Cisco product endorsement.*
