import { esc } from "../util.js";
import { S } from "../state.js";
import {
  roleById, groupById, roleOfPerson,
  historicYears, historicMonthsInYear, historicPeriodsInMonth, historicPeriods,
  historicRosterModel, monthLabel
} from "../model.js";
import { ph } from "../ui-kit.js";
import { rotaHTML } from "../snapshot.js";

function ensureHistSelection() {
  const periods = historicPeriods();
  if (!periods.length) {
    S.ui.histYear = null; S.ui.histMonth = null; S.ui.histId = null;
    return null;
  }
  const years = historicYears();
  if (!S.ui.histYear || years.indexOf(+S.ui.histYear) < 0) S.ui.histYear = years[0];
  const months = historicMonthsInYear(S.ui.histYear);
  if (!S.ui.histMonth || months.indexOf(S.ui.histMonth) < 0) S.ui.histMonth = months[0];
  const inMonth = historicPeriodsInMonth(S.ui.histMonth);
  if (!S.ui.histId || !inMonth.find((p) => p.id === S.ui.histId)) {
    S.ui.histId = inMonth[0] ? inMonth[0].id : null;
  }
  return periods.find((p) => p.id === S.ui.histId) || inMonth[0] || null;
}

export function vHist() {
  const periods = historicPeriods();
  if (!periods.length) {
    return `${ph("Historic roster", "Browse past four-day blocks the same way as the live roster.")}
      <div role="alert" class="alert"><span>No saved periods yet. On <a class="link link-primary" data-act="nav" data-s="prt">Print rota</a>, use <b>Save to log</b> after each block.</span>
      <button class="btn btn-sm" data-act="nav" data-s="prt">Print rota</button></div>`;
  }

  const selected = ensureHistSelection();
  const years = historicYears();
  const months = historicMonthsInYear(S.ui.histYear);
  const inMonth = historicPeriodsInMonth(S.ui.histMonth);

  const yearOpts = years.map((y) => `<option value="${y}"${+S.ui.histYear === y ? " selected" : ""}>${y}</option>`).join("");
  const monthOpts = months.map((m) => `<option value="${m}"${S.ui.histMonth === m ? " selected" : ""}>${esc(monthLabel(m))}</option>`).join("");
  const periodOpts = inMonth.map((p) => {
    const label = p.rangeLabel + (p.savedLabel ? " · saved " + p.savedLabel : "");
    return `<option value="${p.id}"${selected && selected.id === p.id ? " selected" : ""}>${esc(label)}</option>`;
  }).join("");

  const selectors = `<div class="flex flex-wrap items-end gap-3 print:hidden">
    <label class="form-control"><span class="label-text text-xs mb-1">Year</span>
      <select class="select select-bordered select-sm" data-ch="histYear">${yearOpts}</select></label>
    <label class="form-control"><span class="label-text text-xs mb-1">Month</span>
      <select class="select select-bordered select-sm" data-ch="histMonth">${monthOpts}</select></label>
    <label class="form-control min-w-[16rem] flex-1"><span class="label-text text-xs mb-1">Four-day period</span>
      <select class="select select-bordered select-sm w-full" data-ch="histPeriod">${periodOpts}</select></label>
  </div>`;

  if (!selected) {
    return `${ph("Historic roster", "Browse past four-day blocks the same way as the live roster.")}${selectors}
      <div class="opacity-70">No period in this month.</div>`;
  }

  const model = historicRosterModel(selected.entry);
  if (!model) {
    return `${ph("Historic roster", "")}${selectors}
      <div role="alert" class="alert alert-warning"><span>This log entry cannot be shown as a roster grid. Try View on the Log screen for the print layout.</span>
      <button class="btn btn-sm" data-act="nav" data-s="log">Open Log</button></div>`;
  }

  const days = model.days;
  if (S.ui.histDay == null || S.ui.histDay < 0 || S.ui.histDay >= days.length) S.ui.histDay = 0;
  const di = S.ui.histDay;
  const day = days[di];
  const roles = model.rolesFor(di);
  const dayAssign = model.roster[di];
  const ppl = model.people;

  const dayTabs = days.map((d, i) =>
    `<button class="btn btn-sm ${i === di ? "btn-primary" : "btn-ghost"}" data-act="histDay" data-d="${i}">${esc(d.label)} <span class="badge badge-sm ${d.shift === "Day" ? "badge-warning" : "badge-info"}">${d.shift}</span></button>`
  ).join("");

  const head = roles.map((r) => {
    const filled = !!dayAssign.assign[r.id];
    return `<th class="text-center rolecol align-bottom px-1">
      <div class="flex flex-col items-center gap-1">
        <span class="grpdot" style="background:${groupById(r.groupId).color};border:1px solid #9ca3af"></span>
        <span class="rolename font-semibold text-xs leading-tight">${esc(r.name)}</span>
        ${!filled ? '<span class="badge badge-error badge-xs">Unfilled</span>' : ""}
      </div>
    </th>`;
  }).join("");

  const unf = roles.filter((r) => !dayAssign.assign[r.id]).map((r) => r.name);

  const rows = ppl.map((p) => {
    const st = model.statusFor(p.id, day.iso);
    const present = st === "Present";
    const myRole = roleOfPerson(dayAssign, p.id);
    const statusBit = present ? "" : `<div class="text-xs font-normal opacity-70">${esc(st)}</div>`;
    const cells = roles.map((r) => {
      if (!present) {
        return `<td class="p-1"><div class="cellbtn text-center opacity-40" style="background:#EEEEEE;color:#6B7378">—</div></td>`;
      }
      const holderId = dayAssign.assign[r.id];
      if (holderId === p.id) {
        return `<td class="p-1"><div class="cellbtn font-semibold text-center" style="background:${groupById(r.groupId).color}">✓</div></td>`;
      }
      return `<td class="p-1"><div class="cellbtn text-center opacity-20" style="background:#f3f4f6">·</div></td>`;
    }).join("");
    return `<tr class="hover ${present ? "" : "opacity-70"}"><td class="stickycol font-medium whitespace-nowrap">${esc(p.name)}${statusBit}${myRole && present ? `<div class="text-xs font-normal opacity-60">${esc((roleById(myRole) || {}).name || "")}</div>` : ""}</td>${cells}</tr>`;
  }).join("");

  const printBtn = selected.entry.snap
    ? `<button class="btn btn-outline" data-act="histPrint">Print layout</button>`
    : "";

  if (S.ui.histPrint && selected.entry.snap) {
    return `${ph("Historic roster", selected.rangeLabel, '<button class="btn btn-outline" data-act="histPrintOff">Back to grid</button><button class="btn btn-primary" data-act="print">Print in colour</button>')}
      <div class="overflow-x-auto">${rotaHTML(selected.entry.snap)}</div>`;
  }

  return `${ph("Historic roster", "Same person × role view as the live roster. Choose year, month, then the four-day period.", printBtn)}
   ${selectors}
   <div class="text-sm opacity-70">Block ${esc(selected.rangeLabel)}${selected.savedLabel ? " · saved " + esc(selected.savedLabel) : ""} · read-only</div>
   <div class="flex flex-wrap gap-2 print:hidden">${dayTabs}</div>
   <div class="text-sm opacity-70">${esc(day.label)} · ${esc(day.shift)} shift</div>
   ${unf.length ? `<div role="alert" class="alert alert-error"><span>Unfilled on this day: ${esc(unf.join("; "))}.</span></div>` : ""}
   <div class="card bg-base-100 shadow-sm border border-base-300"><div class="overflow-x-auto"><table class="table table-sm rostergrid">
     <thead><tr><th class="stickycol personcol">Person</th>${head}</tr></thead>
     <tbody>${rows}</tbody>
   </table></div></div>`;
}

export const actions = {
  histDay: (a) => { S.ui.histDay = +a.d; },
  histPrint: () => { S.ui.histPrint = true; },
  histPrintOff: () => { S.ui.histPrint = false; }
};

export const changes = {
  histYear: (v) => {
    S.ui.histYear = +v;
    const months = historicMonthsInYear(S.ui.histYear);
    S.ui.histMonth = months[0] || null;
    const ps = S.ui.histMonth ? historicPeriodsInMonth(S.ui.histMonth) : [];
    S.ui.histId = ps[0] ? ps[0].id : null;
    S.ui.histDay = 0;
    S.ui.histPrint = false;
  },
  histMonth: (v) => {
    S.ui.histMonth = v;
    const ps = historicPeriodsInMonth(S.ui.histMonth);
    S.ui.histId = ps[0] ? ps[0].id : null;
    S.ui.histDay = 0;
    S.ui.histPrint = false;
  },
  histPeriod: (v) => {
    S.ui.histId = v;
    S.ui.histDay = 0;
    S.ui.histPrint = false;
  }
};
