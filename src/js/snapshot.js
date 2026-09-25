import { esc, fmt, fmtLong, SBG } from "./util.js";
import {
  block, dayLabels, activePeople, roleById, groupById, getStatus, isPresent, roleOfPerson,
  roleOfPersonOnDay, rosterDays, rolesForDay, unitName, vacatedEssential,
  findHistoryIndexForStart, history, upsertHistoryEntry, snapshotBlockForHistory,
  historicRosterModel, personById
} from "./model.js";
import { LOGO_DATA_URI } from "../assets/logo.js";
import { getSessionUser, logAudit } from "./audit.js";
import { touch } from "./state.js";

/** Person × day snapshot: one cell per person per day, the duty type / status as text. */
export function buildSnapshot() {
  const days = dayLabels();
  const ros = rosterDays();
  const people = activePeople();

  const cells = people.map((p) => days.map((day, d) => {
    if (!isPresent(p, d)) {
      const st = getStatus(p.id, d);
      const wasRid = roleOfPersonOnDay(d, p.id);
      const wasName = wasRid ? ((roleById(wasRid) || {}).name || "") : "";
      /* "was:" is screen-only (roster view); the printed / saved text stays the status. */
      return { kind: "status", text: st, color: SBG[st] || "#EEEEEE", wasRole: wasName || null };
    }
    const rid = ros ? roleOfPerson(ros[d], p.id) : null;
    if (rid) {
      const role = roleById(rid) || { name: "", groupId: "" };
      return { kind: "role", text: role.name, color: groupById(role.groupId).color, roleId: rid };
    }
    return { kind: "spare", text: "", color: "#FFFFFF" };
  }));

  const unfilled = days.map((day, d) => rolesForDay(d)
    .filter((r) => r.essential !== false)
    .filter((r) => !(ros && ros[d].assign[r.id]))
    .map((r) => r.name));

  const vacated = days.map((day, d) => vacatedEssential(d));

  const records = [];
  days.forEach((day, d) => people.forEach((p) => {
    const st = getStatus(p.id, d); const rid = ros ? roleOfPerson(ros[d], p.id) : null;
    records.push({ date: day.iso, shift: day.shift, person: p.name, status: st, role: st === "Present" ? (rid ? (roleById(rid) || { name: "" }).name : "Spare") : "" });
  }));

  return {
    layout: "person-day",
    unitName: unitName(),
    savedBy: getSessionUser() || "",
    start: block().startDate,
    days,
    people: people.map((p) => ({
      id: p.id,
      name: p.name,
      employeeNo: p.employeeNo || "",
      shoulderNo: p.shoulderNo || ""
    })),
    cells,
    unfilled,
    vacated,
    records
  };
}

/**
 * H59: one-day briefing rows — Present + assigned only, sorted by role sortOrder.
 * @param {number} d day index
 * @returns {{ day: {label:string,shift:string,iso:string}, unitName: string, rows: Array<{roleId:string,roleName:string,sortOrder:number,personName:string,employeeNo:string,shoulderNo:string,color:string}> }}
 */
export function buildDayBrief(d) {
  const days = dayLabels();
  const day = days[d];
  const ros = rosterDays();
  const rows = [];
  if (day && ros) {
    activePeople().forEach((p) => {
      if (!isPresent(p, d)) return;
      const rid = roleOfPerson(ros[d], p.id);
      if (!rid) return;
      const role = roleById(rid) || { name: "", groupId: "", sortOrder: 9999 };
      rows.push({
        roleId: rid,
        roleName: role.name || "",
        sortOrder: role.sortOrder == null ? 9999 : role.sortOrder,
        personName: p.name,
        employeeNo: p.employeeNo || "",
        shoulderNo: p.shoulderNo || "",
        color: groupById(role.groupId).color
      });
    });
    rows.sort((a, b) => (a.sortOrder - b.sortOrder) || a.roleName.localeCompare(b.roleName) || a.personName.localeCompare(b.personName));
  }
  return {
    day: day || { label: "", shift: "", iso: "" },
    unitName: unitName(),
    rows
  };
}

/**
 * H24: person × day snap for Historic roster — prefer saved snap; else rebuild from the log entry.
 * Returns null when neither a person-day snap nor a rebuildable model is available.
 */
export function personDaySnapFromHistory(entry) {
  if (!entry) return null;
  const snap = entry.snap;
  if (snap && snap.layout === "person-day" && snap.cells && snap.people) return snap;

  const model = historicRosterModel(entry);
  if (!model) return null;

  const people = model.people.map((p) => {
    const fromSnap = snap && snap.people && snap.people.find((x) => x.id === p.id || x.name === p.name);
    const live = personById(p.id);
    return {
      id: p.id,
      name: p.name,
      employeeNo: (fromSnap && fromSnap.employeeNo) || (live && live.employeeNo) || "",
      shoulderNo: (fromSnap && fromSnap.shoulderNo) || (live && live.shoulderNo) || ""
    };
  });

  const cells = people.map((p) => model.days.map((day, d) => {
    const st = model.statusFor(p.id, day.iso);
    if (st !== "Present") {
      return { kind: "status", text: st, color: SBG[st] || "#EEEEEE", wasRole: null };
    }
    const rid = roleOfPerson(model.roster[d], p.id);
    if (rid) {
      const role = roleById(rid) || { name: "", groupId: "" };
      return { kind: "role", text: role.name, color: groupById(role.groupId).color, roleId: rid };
    }
    return { kind: "spare", text: "", color: "#FFFFFF" };
  }));

  const unfilled = model.days.map((day, d) => model.rolesFor(d)
    .filter((r) => r.essential !== false)
    .filter((r) => !model.roster[d].assign[r.id])
    .map((r) => r.name));

  return {
    layout: "person-day",
    unitName: (snap && snap.unitName) || unitName(),
    savedBy: entry.savedBy || (snap && snap.savedBy) || "",
    start: model.start,
    days: model.days,
    people,
    cells,
    unfilled,
    vacated: model.days.map(() => []),
    records: entry.records || (snap && snap.records) || []
  };
}

/** H59: portrait briefing sheet HTML (id=printArea). */
export function dayBriefHTML(brief) {
  if (!brief) return "";
  const unit = (brief.unitName || unitName() || "").trim();
  const unitLine = unit ? `<div class="text-base font-semibold">${esc(unit)}</div>` : "";
  const day = brief.day || {};
  const title = day.iso
    ? `Duty brief: ${fmt(day.iso)} · ${day.shift || ""}`
    : "Duty brief";
  const header = `<div class="flex items-center gap-3 mb-4"><img src="${LOGO_DATA_URI}" alt="An Garda Síochána" class="w-12 h-12 object-contain shrink-0" width="48" height="48"><div><div class="text-xs font-semibold uppercase tracking-wide opacity-70">An Garda Síochána</div>${unitLine}<h2 class="text-xl font-semibold">${esc(title)}</h2></div></div>`;
  const head = `<tr><th class="bg-neutral text-neutral-content text-left p-2">Role</th><th class="bg-neutral text-neutral-content text-left p-2">Name</th><th class="bg-neutral text-neutral-content numcol numcol-e">Employee no.</th><th class="bg-neutral text-neutral-content numcol numcol-s">Shoulder no.</th></tr>`;
  const rows = (brief.rows || []).map((r) =>
    `<tr><td class="p-2 font-semibold whitespace-nowrap" style="background:${r.color};color:#1f2937">${esc(r.roleName)}</td><td class="p-2 whitespace-nowrap">${esc(r.personName)}</td><td class="numcol numcol-e">${esc(r.employeeNo || "")}</td><td class="numcol numcol-s">${esc(r.shoulderNo || "")}</td></tr>`
  ).join("");
  return `<div id="printArea" class="bg-white text-black border border-base-300 rounded-box p-6 shadow-sm day-brief">
    ${header}
    <div class="printScroll"><table class="rota day-brief-table"><thead>${head}</thead><tbody>${rows}</tbody></table></div>
  </div>`;
}

/** Comparable view of a person-day snap (ignores stamp fields). */
export function snapCompareKey(snap) {
  if (!snap) return "";
  const cells = (snap.cells || []).map((row) => (row || []).map((c) => ({
    kind: c.kind,
    text: c.text || "",
    roleId: c.roleId || null
  })));
  const records = (snap.records || []).map((r) => ({
    date: r.date, shift: r.shift, person: r.person, status: r.status, role: r.role || ""
  }));
  return JSON.stringify({
    start: snap.start,
    days: snap.days,
    people: snap.people,
    cells,
    records
  });
}

export function savedSnapForCurrentBlock() {
  const i = findHistoryIndexForStart(block().startDate);
  if (i < 0) return null;
  return history()[i].snap || null;
}

/** True when there is no saved entry for this start, or live snap differs (excl. stamps). */
export function isRosterUnsaved() {
  if (!block().generatedAt) return false;
  const saved = savedSnapForCurrentBlock();
  if (!saved) return true;
  return snapCompareKey(buildSnapshot()) !== snapCompareKey(saved);
}

/** Upsert log for current block, audit line, touch. */
export function saveRoster() {
  const snap = buildSnapshot();
  const entry = snapshotBlockForHistory(snap);
  upsertHistoryEntry(entry);
  logAudit("ROSTER_SAVED", "block_start=" + block().startDate);
  touch();
  return entry;
}

function headerBlock(snap) {
  const first = snap.days[0];
  const last = snap.days[snap.days.length - 1];
  const unit = (snap.unitName || unitName() || "").trim();
  const unitLine = unit ? `<div class="text-base font-semibold">${esc(unit)}</div>` : "";
  const by = (snap.savedBy || "").trim();
  const byLine = by ? `<div class="text-xs opacity-70">Prepared by ${esc(by)}</div>` : "";
  return `<div class="flex items-center gap-3 mb-4"><img src="${LOGO_DATA_URI}" alt="An Garda Síochána" class="w-12 h-12 object-contain shrink-0" width="48" height="48"><div><div class="text-xs font-semibold uppercase tracking-wide opacity-70">An Garda Síochána</div>${unitLine}<h2 class="text-xl font-semibold">Duty rota: ${esc(fmt(first.iso))} to ${esc(fmtLong(last.iso))}</h2>${byLine}</div></div>`;
}

function leaveTables(snap) {
  const head = snap.days.map((d) => `<th class="bg-neutral text-neutral-content text-center p-2">${esc(d.label)} <span class="font-normal opacity-80">${esc(d.shift)}</span></th>`).join("");
  const leave = snap.leave.map((l) => `<tr style="background:${l.color}"><td class="p-2 font-semibold whitespace-nowrap">${esc(l.label)}</td>` + l.cells.map((c) => `<td class="p-2 text-center text-sm">${esc(c)}</td>`).join("") + "</tr>").join("");
  return `<h3 class="font-semibold mt-5 mb-2">Not on the roster</h3>
    <table class="rota"><thead><tr><th class="bg-neutral text-neutral-content text-left p-2"></th>${head}</tr></thead><tbody>${leave}</tbody></table>`;
}

/** True when person-day snap people carry employee/shoulder fields (new snaps always do). */
function snapHasPersonNumbers(snap) {
  const people = snap && snap.people;
  if (!people || !people.length) return false;
  return people.some((p) => Object.prototype.hasOwnProperty.call(p, "employeeNo")
    || Object.prototype.hasOwnProperty.call(p, "shoulderNo"));
}

/**
 * H57: font size / row padding (px) that keeps the roster on one A4 landscape page.
 * Measured in Chrome print-to-PDF: ~590px of the ~718px printable height is left for rows once
 * the crest block and column header are placed, and a row is 1.3 x font (print line-height)
 * + 2 x padding + 1px border. Clamped to a readable 8-11px, so an unusually large team spills
 * to a second page (the header row repeats). Padding only tightens as the team grows, so the
 * font size never increases with headcount.
 */
export function printFit(nPeople) {
  const n = Math.max(1, nPeople | 0);
  const pad = n <= 26 ? 2 : 1;
  const fs = Math.max(8, Math.min(11, Math.floor((590 / n - (pad * 2 + 1)) / 1.3)));
  return { fs, pad };
}

export const printFitStyle = (nPeople) => {
  const f = printFit(nPeople);
  return `--pfs:${f.fs}px;--ppad:${f.pad}px`;
};

/** Current layout: one table, person leftmost, one column per day — duty type / status as coloured text. */
function rotaHTMLPersonDay(snap, editable) {
  const withNums = snapHasPersonNumbers(snap);
  const head = snap.days.map((d) =>
    `<th class="bg-neutral text-neutral-content text-center p-2 align-bottom"><div>${esc(d.label)}</div><div class="font-normal opacity-80 text-xs">${esc(d.shift)}</div></th>`
  ).join("");
  const numHead = `<tr><th class="bg-neutral text-neutral-content text-left p-2 stickycol">Person</th>${withNums
    ? '<th class="bg-neutral text-neutral-content numcol numcol-e">Employee no.</th><th class="bg-neutral text-neutral-content numcol numcol-s">Shoulder no.</th>'
    : ""}${head}</tr>`;
  const rows = snap.people.map((p, pi) => {
    const cells = snap.cells[pi].map((c, d) => {
      if (c.kind === "spare") {
        /* Older saved rotas may carry a typed note (e.g. "HVB"); keep printing it. */
        return `<td class="p-1 text-center" style="background:#ffffff">${c.text ? `<span class="text-sm font-medium">${esc(c.text)}</span>` : '<span class="spare-empty">Unassigned</span>'}</td>`;
      }
      const style = `background:${c.color};color:#1f2937`;
      return `<td class="p-2 text-center text-sm font-medium" style="${style}">${esc(c.text)}</td>`;
    }).join("");
    const nums = withNums
      ? `<td class="numcol numcol-e">${esc(p.employeeNo || "")}</td><td class="numcol numcol-s">${esc(p.shoulderNo || "")}</td>`
      : "";
    return `<tr><td class="p-2 font-semibold whitespace-nowrap stickycol">${esc(p.name)}</td>${nums}${cells}</tr>`;
  }).join("");
  const unfBits = snap.days.map((d, i) => (snap.unfilled && snap.unfilled[i] && snap.unfilled[i].length) ? `${d.label}: ${snap.unfilled[i].join(", ")}` : "").filter(Boolean);
  const unf = unfBits.length ? `<div class="text-xs text-error mb-2 print:mb-1">Unfilled — ${esc(unfBits.join(" · "))}</div>` : "";
  return `<div id="printArea" class="bg-white text-black border border-base-300 rounded-box p-6 shadow-sm min-w-[40rem]" style="${printFitStyle(snap.people.length)}">
    ${headerBlock(snap)}
    ${unf}
    <div class="printScroll"><table class="rota rota-freeze"><thead>${numHead}</thead><tbody>${rows}</tbody></table></div>
  </div>`;
}

/** Older layout: one person × role table per day. */
function rotaHTMLPersonRole(snap) {
  const sections = snap.byDay.map((block) => {
    const head = block.roles.map((r) =>
      `<th class="bg-neutral text-neutral-content text-center p-1 text-xs min-w-[4.5rem] align-bottom"><span class="inline-block w-2 h-2 rounded-full mr-0.5" style="background:${r.color}"></span>${esc(r.name)}</th>`
    ).join("");
    const rows = block.people.map((p, pi) => {
      const cells = block.cells[pi].map((c) => {
        const style = `background:${c.color};color:${c.kind === "away" ? "#374151" : "#1f2937"}`;
        const body = c.kind === "mine" ? "✓" : c.kind === "away" ? esc(c.text) : c.kind === "unfilled" ? "" : "";
        return `<td class="p-1 text-center text-xs font-semibold" style="${style}">${body}</td>`;
      }).join("");
      return `<tr><td class="p-2 font-semibold whitespace-nowrap text-sm">${esc(p.name)}</td>${cells}</tr>`;
    }).join("");
    const unf = block.unfilled.length
      ? `<div class="text-xs text-error mb-1">Unfilled: ${esc(block.unfilled.join("; "))}</div>`
      : "";
    return `<div class="mb-6 break-inside-avoid">
      <h3 class="font-semibold mb-1">${esc(block.day.label)} · ${esc(block.day.shift)} shift</h3>
      ${unf}
      <table class="rota"><thead><tr><th class="bg-neutral text-neutral-content text-left p-2">Person</th>${head}</tr></thead><tbody>${rows}</tbody></table>
    </div>`;
  }).join("");

  return `<div id="printArea" class="bg-white text-black border border-base-300 rounded-box p-6 shadow-sm min-w-[52rem]">
    ${headerBlock(snap)}
    ${sections}
    ${leaveTables(snap)}</div>`;
}

/** Legacy Role × Day layout (older log entries). */
function rotaHTMLLegacy(snap) {
  const head = snap.days.map((d) => `<th class="bg-neutral text-neutral-content text-center p-2">${esc(d.label)} <span class="font-normal opacity-80">${esc(d.shift)}</span></th>`).join("");
  const rows = (snap.roles || []).map((r, i) => `<tr><td class="p-2 font-semibold whitespace-nowrap">${esc(r.name)}</td>` + snap.days.map((d, k) => {
    const v = snap.cells[i][k];
    const style = v === "-" ? "background:#EEEEEE;color:#6B7378" : v === "UNFILLED" ? "background:#F8D7D3;color:#8C1D18;font-weight:600" : "background:" + r.color;
    return `<td class="p-2 text-center" style="${style}">${esc(v)}</td>`;
  }).join("") + "</tr>").join("");
  return `<div id="printArea" class="bg-white text-black border border-base-300 rounded-box p-6 shadow-sm min-w-[52rem]">
    ${headerBlock(snap)}
    <table class="rota"><thead><tr><th class="bg-neutral text-neutral-content text-left p-2">Role</th>${head}</tr></thead><tbody>${rows}</tbody></table>
    ${leaveTables(snap)}</div>`;
}

export function rotaHTML(snap, opts) {
  if (!snap) return "";
  if (snap.layout === "person-day" && snap.cells && snap.people) return rotaHTMLPersonDay(snap, !!(opts && opts.editable));
  if (snap.layout === "person-role" && snap.byDay) return rotaHTMLPersonRole(snap);
  if (snap.cells && snap.roles) return rotaHTMLLegacy(snap);
  /* Rebuild-friendly: if log entry only has records, show a simple person×day role table */
  if (snap.records && snap.days) {
    const people = [...new Set(snap.records.map((r) => r.person))];
    const head = snap.days.map((d) => `<th class="bg-neutral text-neutral-content text-center p-2">${esc(d.label)}</th>`).join("");
    const rows = people.map((name) => {
      const cells = snap.days.map((d) => {
        const rec = snap.records.find((r) => r.person === name && r.date === d.iso);
        if (!rec) return `<td class="p-2 text-center">—</td>`;
        if (rec.status !== "Present") return `<td class="p-2 text-center text-sm" style="background:${SBG[rec.status] || "#eee"}">${esc(rec.status)}</td>`;
        return `<td class="p-2 text-center text-sm">${esc(rec.role || "Spare")}</td>`;
      }).join("");
      return `<tr><td class="p-2 font-semibold">${esc(name)}</td>${cells}</tr>`;
    }).join("");
    return `<div id="printArea" class="bg-white text-black border border-base-300 rounded-box p-6 shadow-sm min-w-[52rem]">
      ${headerBlock(snap)}
      <table class="rota"><thead><tr><th class="bg-neutral text-neutral-content text-left p-2">Person</th>${head}</tr></thead><tbody>${rows}</tbody></table>
      ${snap.leave ? leaveTables(snap) : ""}</div>`;
  }
  return "<div class=\"opacity-70\">Cannot display this saved rota.</div>";
}

export function csvOf(entries) {
  const q = (v) => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
  const lines = [["Block start", "Date", "Shift", "Person", "Status", "Role"].map(q).join(",")];
  entries.forEach((e) => {
    const start = e.start || e.startDate;
    const records = e.records || [];
    records.forEach((r) => lines.push([start, r.date, r.shift, r.person, r.status, r.role].map(q).join(",")));
  });
  return lines.join("\r\n");
}
