import { esc, fmt, fmtLong, SBG } from "./util.js";
import { D, block, dayLabels, activePeople, personById, roleById, groupById, getStatus, isPresent, roleOfPerson, rosterDays, rolesForDay, unitName } from "./model.js";
import { LOGO_DATA_URI } from "../assets/logo.js";
import { getSessionUser } from "./audit.js";

export function buildSnapshot() {
  const days = dayLabels();
  const ros = rosterDays();
  const people = activePeople();
  const roleMeta = D().roles.map((r) => ({
    id: r.id, name: r.name, color: groupById(r.groupId).color, night: r.usedAtNight
  }));

  /* Per-day person × role grids (matches on-screen roster). */
  const byDay = days.map((day, d) => {
    const roles = rolesForDay(d).map((r) => roleMeta.find((x) => x.id === r.id) || {
      id: r.id, name: r.name, color: groupById(r.groupId).color, night: r.usedAtNight
    });
    const cells = people.map((p) => roles.map((r) => {
      if (!isPresent(p, d)) {
        return { text: getStatus(p.id, d), color: SBG[getStatus(p.id, d)] || "#EEEEEE", kind: "away" };
      }
      const holder = ros ? ros[d].assign[r.id] : null;
      if (holder === p.id) return { text: "✓", color: r.color, kind: "mine" };
      if (!holder) return { text: "", color: "#F8D7D3", kind: "unfilled" };
      return { text: "", color: "#FFFFFF", kind: "other" };
    }));
    const unfilled = roles.filter((r) => !(ros && ros[d].assign[r.id])).map((r) => r.name);
    return { day, roles, people: people.map((p) => ({ id: p.id, name: p.name })), cells, unfilled };
  });

  const leave = [["Annual leave", "#BBDEFB"], ["Sick leave", "#FFCDD2"], ["Duty away", "#E1BEE7"]].map((x) => ({
    label: x[0], color: x[1], cells: days.map((day, d) => people.filter((p) => getStatus(p.id, d) === x[0]).map((p) => p.name).join(", "))
  }));
  const spare = days.map((day, d) => people.filter((p) => isPresent(p, d) && !(ros && roleOfPerson(ros[d], p.id))).map((p) => p.name).join(", "));
  leave.push({ label: "Spare (no role)", color: "#FFFFFF", cells: spare });

  const records = [];
  days.forEach((day, d) => people.forEach((p) => {
    const st = getStatus(p.id, d); const rid = ros ? roleOfPerson(ros[d], p.id) : null;
    records.push({ date: day.iso, shift: day.shift, person: p.name, status: st, role: st === "Present" ? (rid ? (roleById(rid) || { name: "" }).name : "Spare") : "" });
  }));

  return {
    layout: "person-role",
    unitName: unitName(),
    savedBy: getSessionUser() || "",
    start: block().startDate,
    days,
    roles: roleMeta,
    byDay,
    leave,
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

/** New layout: one person × role table per day. */
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

export function rotaHTML(snap) {
  if (!snap) return "";
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
