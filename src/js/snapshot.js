import { esc, fmt, fmtLong, SBG } from "./util.js";
import { block, dayLabels, activePeople, roleById, groupById, getStatus, isPresent, roleOfPerson, rosterDays, rolesForDay, getSpareNote, unitName } from "./model.js";
import { LOGO_DATA_URI } from "../assets/logo.js";
import { getSessionUser } from "./audit.js";

/** Person × day snapshot: one cell per person per day, the duty type / status as text. */
export function buildSnapshot() {
  const days = dayLabels();
  const ros = rosterDays();
  const people = activePeople();

  const cells = people.map((p) => days.map((day, d) => {
    if (!isPresent(p, d)) {
      const st = getStatus(p.id, d);
      return { kind: "status", text: st, color: SBG[st] || "#EEEEEE" };
    }
    const rid = ros ? roleOfPerson(ros[d], p.id) : null;
    if (rid) {
      const role = roleById(rid) || { name: "", groupId: "" };
      return { kind: "role", text: role.name, color: groupById(role.groupId).color };
    }
    return { kind: "spare", text: getSpareNote(p.id, d), color: "#FFFFFF" };
  }));

  const unfilled = days.map((day, d) => rolesForDay(d)
    .filter((r) => !(ros && ros[d].assign[r.id]))
    .map((r) => r.name));

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
    people: people.map((p) => ({ id: p.id, name: p.name })),
    cells,
    unfilled,
    records
  };
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

/** Current layout: one table, person leftmost, one column per day — duty type / status as coloured text. */
function rotaHTMLPersonDay(snap, editable) {
  const head = snap.days.map((d) =>
    `<th class="bg-neutral text-neutral-content text-center p-2 align-bottom"><div>${esc(d.label)}</div><div class="font-normal opacity-80 text-xs">${esc(d.shift)}</div></th>`
  ).join("");
  const rows = snap.people.map((p, pi) => {
    const cells = snap.cells[pi].map((c, d) => {
      if (c.kind === "spare" && editable) {
        return `<td class="p-1 text-center" style="background:#ffffff"><input type="text" class="input input-bordered spareinput w-full text-center" placeholder="HVB" value="${esc(c.text)}" data-ch="spareNote" data-p="${p.id}" data-d="${d}" aria-label="${esc(p.name)} spare note, ${esc(snap.days[d].label)}"></td>`;
      }
      const style = `background:${c.color};color:#1f2937`;
      return `<td class="p-2 text-center text-sm font-medium" style="${style}">${esc(c.text)}</td>`;
    }).join("");
    return `<tr><td class="p-2 font-semibold whitespace-nowrap">${esc(p.name)}</td>${cells}</tr>`;
  }).join("");
  const unfBits = snap.days.map((d, i) => (snap.unfilled && snap.unfilled[i] && snap.unfilled[i].length) ? `${d.label}: ${snap.unfilled[i].join(", ")}` : "").filter(Boolean);
  const unf = unfBits.length ? `<div class="text-xs text-error mb-2 print:mb-1">Unfilled — ${esc(unfBits.join(" · "))}</div>` : "";
  return `<div id="printArea" class="bg-white text-black border border-base-300 rounded-box p-6 shadow-sm min-w-[40rem]">
    ${headerBlock(snap)}
    ${unf}
    <div class="printScroll"><table class="rota rota-freeze"><thead><tr><th class="bg-neutral text-neutral-content text-left p-2">Person</th>${head}</tr></thead><tbody>${rows}</tbody></table></div>
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
