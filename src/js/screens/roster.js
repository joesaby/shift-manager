import { esc, fmt, fmtLong } from "../util.js";
import { S, toast, askConfirm, render } from "../state.js";
import {
  D, block, hasRoster, isStale, groupById,
  personById, isPresent, qual, roleOfPerson, rosterDays, vacatedEssential,
  unitName, activePeople
} from "../model.js";
import { buildSnapshot, saveRoster as persistRoster, isRosterUnsaved, printFitStyle, buildDayBrief, dayBriefHTML } from "../snapshot.js";
import { generate as generateRoster, swapPeople, assignRoleToPerson, assignParkedRole, unassignPerson, canTakeParkedRole, canDropPersonOnPerson } from "../generator.js";
import { ph, noPeople } from "../ui-kit.js";
import { logAudit } from "../audit.js";
import { LOGO_DATA_URI } from "../../assets/logo.js";

export function rosterWarn(d, rid, pid) {
  const p = personById(pid); if (!p) return "Person removed";
  if (!isPresent(p, d)) return "Not present";
  if (!qual(p, rid)) return "Not qualified";
  if (p.fixedRoleId && p.fixedRoleId !== rid) return "Only does another role";
  return "";
}

function headerHTML(snap) {
  const first = snap.days[0];
  const last = snap.days[snap.days.length - 1];
  const unit = (snap.unitName || unitName() || "").trim();
  const unitLine = unit ? `<div class="text-base font-semibold">${esc(unit)}</div>` : "";
  const by = (snap.savedBy || "").trim();
  const byLine = by ? `<div class="text-xs opacity-70">Prepared by ${esc(by)}</div>` : "";
  return `<div class="flex items-center gap-3 mb-4"><img src="${LOGO_DATA_URI}" alt="An Garda Síochána" class="w-12 h-12 object-contain shrink-0" width="48" height="48"><div><div class="text-xs font-semibold uppercase tracking-wide opacity-70">An Garda Síochána</div>${unitLine}<h2 class="text-xl font-semibold">Duty rota: ${esc(fmt(first.iso))} to ${esc(fmtLong(last.iso))}</h2>${byLine}</div></div>`;
}

/** Interactive person × day roster (unified former Print + Roster). */
export function vRos() {
  if (!D().people.length) return noPeople();
  if (!hasRoster()) {
    return `${ph("2. Roster", "")}<div role="alert" class="alert"><span>No roster yet.</span><button class="btn btn-sm btn-primary" data-act="generate">Generate roster</button></div>`;
  }

  const snap = buildSnapshot();
  const ros = rosterDays();
  const sel = S.ui.sel;
  const dragPid = S.ui.dragPid || null;
  const dragRole = S.ui.dragRole || null;
  const dragDay = S.ui.dragDay;

  const vacatedCount = (snap.vacated || []).reduce((n, day) => n + day.length, 0);
  const unfBits = snap.days.map((d, i) => (snap.unfilled[i] && snap.unfilled[i].length) ? `${d.label}: ${snap.unfilled[i].join(", ")}` : "").filter(Boolean);
  const unsaved = isRosterUnsaved();

  const genBtn = `<button class="btn btn-ghost btn-sm" data-act="askRegenerate" title="Reshuffles everyone and discards manual edits">Start over / Regenerate</button>`;
  const unsavedBadge = unsaved ? `<span class="badge badge-warning no-print">Unsaved changes</span>` : `<span class="badge badge-ghost no-print">Saved</span>`;
  const printBtn = unsaved
    ? `<button class="btn btn-sm btn-primary" data-act="saveAndPrint">Save &amp; print</button>`
    : `<button class="btn btn-sm btn-primary" data-act="print">Print in colour</button>`;
  const actionsBar = `${unsavedBadge}${genBtn}<button class="btn btn-sm btn-outline btn-primary" data-act="saveRoster">Save roster</button>${printBtn}`;

  const unit = (unitName() || "").trim();
  const firstDay = snap.days[0]; const lastDay = snap.days[snap.days.length - 1];
  const toolbar = `<div class="roster-toolbar no-print"><h1 class="text-xl font-bold tracking-tight">Roster</h1>${unit
    ? `<span class="text-sm font-semibold">${esc(unit)}</span>`
    : '<span class="text-sm opacity-60">No unit name — set it on <a class="link link-primary" data-act="nav" data-s="start">Home</a></span>'}<span class="text-sm opacity-70">${esc(fmt(firstDay.iso))} – ${esc(fmtLong(lastDay.iso))}</span><span class="roster-toolbar-actions">${actionsBar}</span></div>`;

  const head = snap.days.map((d) =>
    `<th class="bg-neutral text-neutral-content text-center p-2 align-bottom"><div>${esc(d.label)}</div><div class="font-normal opacity-80 text-xs">${esc(d.shift)}</div></th>`
  ).join("");

  /* H59: outside the sticky/clipped day header so Print day is always visible. */
  const dayPrintBar = `<div class="no-print day-print-bar" role="group" aria-label="Print day briefing"><span class="day-print-bar-label">Briefing sheet</span>${snap.days.map((d, i) =>
    `<button type="button" class="btn btn-sm btn-outline btn-primary day-print-btn" data-act="printDay" data-d="${i}" title="Print ${esc(d.label)} sorted by role">Print ${esc(d.label)}</button>`
  ).join("")}</div>`;

  const parkingRow = `<tr class="unalloc-row parking-row no-print"><td class="p-2 text-xs font-semibold stickycol"><span class="opacity-70">Parking lot</span></td><td class="numcol p-1" colspan="2"></td>${snap.days.map((day, d) => {
    const items = vacatedEssential(d);
    if (!items.length) {
      return `<td class="p-1 unalloc-cell parking-empty" data-drop-day="${d}"><span class="parking-ok">All essential roles covered</span></td>`;
    }
    const chips = items.map((it) => {
      const role = D().roles.find((r) => r.id === it.roleId);
      const color = groupById(role ? role.groupId : "").color;
      const was = it.wasName ? ` — was: ${esc(it.wasName)}` : "";
      const selRole = sel && sel.kind === "role" && +sel.d === d && sel.r === it.roleId;
      return `<button type="button" class="unalloc-chip ${selRole ? "unalloc-chip-sel" : ""}" style="border-left:4px solid ${color}" draggable="true" data-drag-role="${it.roleId}" data-drag-day="${d}" data-act="pickRole" data-d="${d}" data-r="${it.roleId}" title="Drag onto a person to assign">${esc(it.name)}${was}</button>`;
    }).join(" ");
    return `<td class="p-1 unalloc-cell" data-drop-day="${d}"><div class="parking-chips">${chips}</div></td>`;
  }).join("")}</tr>`;

  const rows = snap.people.map((p, pi) => {
    const cells = snap.cells[pi].map((c, d) => {
      const myRole = ros ? roleOfPerson(ros[d], p.id) : null;
      const selected = sel && sel.kind === "person" && sel.p === p.id && +sel.d === d;
      const personHot = dragPid && +dragDay === d && dragPid !== p.id && canDropPersonOnPerson(d, dragPid, p.id);
      const chipHot = dragRole && +dragDay === d && canTakeParkedRole(d, dragRole, p.id);
      const selHot = sel && sel.kind === "person" && +sel.d === d && sel.p !== p.id && canDropPersonOnPerson(d, sel.p, p.id);
      const chipSelHot = sel && sel.kind === "role" && +sel.d === d && canTakeParkedRole(d, sel.r, p.id);
      const hot = personHot || chipHot || selHot || chipSelHot;
      const dimChip = dragRole && +dragDay === d && !canTakeParkedRole(d, dragRole, p.id);
      const dimPerson = dragPid && +dragDay === d && dragPid !== p.id && !canDropPersonOnPerson(d, dragPid, p.id);

      if (c.kind === "status") {
        return `<td class="p-2 text-center text-sm font-medium ${dimChip || dimPerson ? "drop-dim" : ""}" style="background:${c.color};color:#1f2937">${esc(c.text)}${c.wasRole ? `<div class="text-xs font-normal opacity-70 no-print">was: ${esc(c.wasRole)}</div>` : ""}</td>`;
      }

      if (c.kind === "spare") {
        return `<td class="p-1 text-center rostercell ${selected ? "cell-sel" : ""} ${hot ? "drop-hot" : ""} ${dimChip || dimPerson ? "drop-dim" : ""}" data-drop-person="${p.id}" data-drop-day="${d}" style="background:#ffffff">
          <div class="roster-cell-inner">
            <button type="button" class="drag-handle no-print" draggable="true" data-drag-person="${p.id}" data-drag-day="${d}" data-act="pickPerson" data-d="${d}" data-p="${p.id}" title="Drag or click to swap" aria-label="Select ${esc(p.name)}">⋮⋮</button>
            <span class="spare-empty">Unassigned</span>
          </div>
        </td>`;
      }

      const w = myRole ? rosterWarn(d, myRole, p.id) : "";
      return `<td class="p-1 text-center rostercell ${selected ? "cell-sel" : ""} ${hot ? "drop-hot" : ""} ${dimChip || dimPerson ? "drop-dim" : ""}" data-drop-person="${p.id}" data-drop-day="${d}" style="background:${c.color};color:#1f2937">
        <div class="roster-cell-inner">
          <button type="button" class="drag-handle role-drag no-print" draggable="true" data-drag-person="${p.id}" data-drag-day="${d}" data-act="pickPerson" data-d="${d}" data-p="${p.id}" title="Drag or click to swap" aria-label="Select ${esc(p.name)}">${esc(c.text)}${w ? " !" : ""}</button>
          <span class="role-print-only">${esc(c.text)}</span>
          <button type="button" class="unassign-btn no-print" data-act="unassign" data-d="${d}" data-p="${p.id}" title="Unassign" aria-label="Unassign ${esc(p.name)}">×</button>
        </div>
      </td>`;
    }).join("");
    return `<tr>
      <td class="p-2 font-semibold whitespace-nowrap stickycol">${esc(p.name)}</td>
      <td class="numcol numcol-e">${esc(p.employeeNo || "")}</td>
      <td class="numcol numcol-s">${esc(p.shoulderNo || "")}</td>
      ${cells}
    </tr>`;
  }).join("");

  const hint = sel && sel.kind === "role"
    ? `<div role="status" class="alert alert-info no-print roster-alert"><span>Parking lot — click a <b>Present</b> person on the same day to assign this role.</span><button class="btn btn-sm" data-act="clearSel">Cancel</button></div>`
    : sel && sel.kind === "person"
      ? `<div role="status" class="alert alert-info no-print roster-alert"><span>Selected — click another person on the <b>same day</b> to swap.</span><button class="btn btn-sm" data-act="clearSel">Cancel</button></div>`
      : `<div class="text-sm opacity-70 no-print mb-2">Drag a parking-lot chip onto a person to fill a vacated essential role (or click chip, then person). Drag people to swap. × unassigns.</div>`;

  return `${toolbar}
    ${isStale() ? `<div role="alert" class="alert alert-warning no-print roster-alert"><span>Roles or Day/Night setup changed since this roster was generated. Manual edits are kept until you Start over / Regenerate (that reshuffles everyone).</span></div>` : ""}
    ${vacatedCount ? `<div role="alert" class="alert alert-warning no-print roster-alert"><span>${vacatedCount} essential role${vacatedCount === 1 ? "" : "s"} in the parking lot — drag a chip onto someone to fill.</span></div>` : ""}
    ${unfBits.length ? `<div role="alert" class="alert alert-error no-print roster-alert"><span>Unfilled essential — ${esc(unfBits.join(" · "))}</span></div>` : ""}
    ${hint}
    ${dayPrintBar}
    <div class="overflow-x-auto">
      <div id="printArea" class="bg-white text-black border border-base-300 rounded-box p-2 shadow-sm min-w-[40rem]" style="${printFitStyle(snap.people.length)}">
        <div class="print-only">${headerHTML(snap)}</div>
        ${unfBits.length ? `<div class="print-only text-xs text-error mb-1">Unfilled — ${esc(unfBits.join(" · "))}</div>` : ""}
        <div class="printScroll roster-scroll"><table class="rota rota-freeze roster-compact">
          <thead>
            <tr>
              <th class="bg-neutral text-neutral-content text-left p-2 stickycol">Person</th>
              <th class="bg-neutral text-neutral-content numcol numcol-e">Employee no.</th>
              <th class="bg-neutral text-neutral-content numcol numcol-s">Shoulder no.</th>
              ${head}
            </tr>
            ${parkingRow}
          </thead>
          <tbody>${rows}</tbody>
        </table></div>
      </div>
    </div>`;
}

function runGenerate() {
  if (!activePeople().length || !D().roles.length) { toast("Add roles and people first."); return; }
  generateRoster(); S.ui.screen = "ros"; S.ui.sel = null;
  logAudit("ROSTER_GENERATED", "block_start=" + block().startDate);
}

export const actions = {
  generate: () => runGenerate(),
  askRegenerate: () => {
    askConfirm(
      "Start over / Regenerate?",
      "This reshuffles everyone and discards manual edits for this block.",
      "Regenerate",
      () => runGenerate()
    );
  },
  print: () => window.print(),
  printDay: (a) => {
    const d = +a.d;
    const brief = buildDayBrief(d);
    if (!brief.rows.length) {
      toast("Nobody assigned for that day.");
      return;
    }
    /* main.js re-renders after the action; swap #printArea once the grid is back. */
    setTimeout(() => {
      const el = document.getElementById("printArea");
      if (!el) return;
      el.outerHTML = dayBriefHTML(brief);
      document.body.classList.add("print-day-brief");
      /* @page cannot be scoped by a body class — inject a temporary rule for portrait. */
      let pageStyle = document.getElementById("dayBriefPageStyle");
      if (!pageStyle) {
        pageStyle = document.createElement("style");
        pageStyle.id = "dayBriefPageStyle";
        document.head.appendChild(pageStyle);
      }
      pageStyle.textContent = "@page{size:A4 portrait;margin:10mm}";
      let done = false;
      const restore = () => {
        if (done) return;
        done = true;
        document.body.classList.remove("print-day-brief");
        if (pageStyle.parentNode) pageStyle.parentNode.removeChild(pageStyle);
        window.removeEventListener("afterprint", restore);
        clearTimeout(fallback);
        render();
      };
      window.addEventListener("afterprint", restore);
      const fallback = setTimeout(restore, 2000);
      window.print();
    }, 0);
  },
  saveRoster: () => {
    persistRoster();
    toast("Roster saved");
  },
  saveAndPrint: () => {
    persistRoster();
    toast("Roster saved");
    /* Remount so #printArea reflects the saved state, then print. */
    setTimeout(() => window.print(), 50);
  },
  /* Alias kept for any leftover data-act="saveLog" */
  saveLog: () => {
    persistRoster();
    toast("Roster saved");
  },
  pickPerson: (a) => {
    const d = +a.d; const p = a.p;
    const sel = S.ui.sel;
    if (sel && sel.kind === "person" && +sel.d === d && sel.p !== p) {
      swapPeople(d, sel.p, p);
      S.ui.sel = null;
      return;
    }
    if (sel && sel.kind === "role" && +sel.d === d) {
      assignParkedRole(d, sel.r, p);
      S.ui.sel = null;
      return;
    }
    S.ui.sel = { kind: "person", d, p };
  },
  pickRole: (a) => {
    const d = +a.d; const r = a.r;
    const sel = S.ui.sel;
    if (sel && sel.kind === "person" && +sel.d === d) {
      assignRoleToPerson(d, r, sel.p);
      S.ui.sel = null;
      return;
    }
    S.ui.sel = { kind: "role", d, r };
  },
  unassign: (a) => { unassignPerson(+a.d, a.p); S.ui.sel = null; },
  clearSel: () => { S.ui.sel = null; },
  closeSel: () => { S.ui.sel = null; },
  assign: (a) => { assignRoleToPerson(+a.d, a.r, a.p || null); S.ui.sel = null; }
};

export const changes = {};
