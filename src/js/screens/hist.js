import { esc, fmt, fmtLong } from "../util.js";
import { S } from "../state.js";
import {
  historicYears, historicMonthsInYear, historicPeriodsInMonth, historicPeriods,
  monthLabel, unitName
} from "../model.js";
import { ph } from "../ui-kit.js";
import { rotaHTML, printFitStyle, personDaySnapFromHistory } from "../snapshot.js";
import { LOGO_DATA_URI } from "../../assets/logo.js";

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

function headerHTML(snap) {
  const first = snap.days[0];
  const last = snap.days[snap.days.length - 1];
  const unit = (snap.unitName || unitName() || "").trim();
  const unitLine = unit ? `<div class="text-base font-semibold">${esc(unit)}</div>` : "";
  const by = (snap.savedBy || "").trim();
  const byLine = by ? `<div class="text-xs opacity-70">Prepared by ${esc(by)}</div>` : "";
  return `<div class="flex items-center gap-3 mb-4"><img src="${LOGO_DATA_URI}" alt="An Garda Síochána" class="w-12 h-12 object-contain shrink-0" width="48" height="48"><div><div class="text-xs font-semibold uppercase tracking-wide opacity-70">An Garda Síochána</div>${unitLine}<h2 class="text-xl font-semibold">Duty rota: ${esc(fmt(first.iso))} to ${esc(fmtLong(last.iso))}</h2>${byLine}</div></div>`;
}

/** Read-only person × day grid matching the unified Roster look (no parking / drag). */
function personDayScreenHTML(snap, showUnfilled) {
  const withNums = (snap.people || []).some((p) =>
    Object.prototype.hasOwnProperty.call(p, "employeeNo")
    || Object.prototype.hasOwnProperty.call(p, "shoulderNo"));
  const head = snap.days.map((d) =>
    `<th class="bg-neutral text-neutral-content text-center p-2 align-bottom"><div>${esc(d.label)}</div><div class="font-normal opacity-80 text-xs">${esc(d.shift)}</div></th>`
  ).join("");
  const unfBits = !showUnfilled ? [] : (snap.days || []).map((d, i) =>
    (snap.unfilled && snap.unfilled[i] && snap.unfilled[i].length)
      ? `${d.label}: ${snap.unfilled[i].join(", ")}` : "").filter(Boolean);
  const rows = snap.people.map((p, pi) => {
    const cells = (snap.cells[pi] || []).map((c) => {
      if (c.kind === "spare") {
        return `<td class="p-1 text-center" style="background:#ffffff">${c.text
          ? `<span class="text-sm font-medium">${esc(c.text)}</span>`
          : '<span class="spare-empty">Unassigned</span>'}</td>`;
      }
      return `<td class="p-2 text-center text-sm font-medium" style="background:${c.color};color:#1f2937">${esc(c.text)}</td>`;
    }).join("");
    const nums = withNums
      ? `<td class="numcol numcol-e">${esc(p.employeeNo || "")}</td><td class="numcol numcol-s">${esc(p.shoulderNo || "")}</td>`
      : "";
    return `<tr>
      <td class="p-2 font-semibold whitespace-nowrap stickycol">${esc(p.name)}</td>
      ${nums}${cells}
    </tr>`;
  }).join("");

  return `<div id="printArea" class="bg-white text-black border border-base-300 rounded-box p-2 shadow-sm min-w-[40rem]" style="${printFitStyle(snap.people.length)}">
    <div class="print-only">${headerHTML(snap)}</div>
    ${unfBits.length ? `<div class="print-only text-xs text-error mb-1">Unfilled — ${esc(unfBits.join(" · "))}</div>` : ""}
    ${unfBits.length ? `<div role="alert" class="alert alert-error no-print roster-alert"><span>Unfilled essential — ${esc(unfBits.join(" · "))}</span></div>` : ""}
    <div class="printScroll roster-scroll"><table class="rota rota-freeze roster-compact">
      <thead><tr>
        <th class="bg-neutral text-neutral-content text-left p-2 stickycol">Person</th>
        ${withNums ? '<th class="bg-neutral text-neutral-content numcol numcol-e">Employee no.</th><th class="bg-neutral text-neutral-content numcol numcol-s">Shoulder no.</th>' : ""}
        ${head}
      </tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
  </div>`;
}

export function vHist() {
  const periods = historicPeriods();
  if (!periods.length) {
    return `${ph("Historic roster", "Browse past four-day blocks the same way as the live roster.")}
      <div role="alert" class="alert"><span>No saved periods yet. On <a class="link link-primary" data-act="nav" data-s="ros">Roster</a>, use <b>Save roster</b> after each block.</span>
      <button class="btn btn-sm" data-act="nav" data-s="ros">Roster</button></div>`;
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

  const selectors = `<span class="hist-selectors no-print">
    <label class="form-control"><span class="label-text text-xs mb-1">Year</span>
      <select class="select select-bordered select-sm" data-ch="histYear">${yearOpts}</select></label>
    <label class="form-control"><span class="label-text text-xs mb-1">Month</span>
      <select class="select select-bordered select-sm" data-ch="histMonth">${monthOpts}</select></label>
    <label class="form-control hist-period"><span class="label-text text-xs mb-1">Four-day period</span>
      <select class="select select-bordered select-sm w-full" data-ch="histPeriod">${periodOpts}</select></label>
  </span>`;

  if (!selected) {
    return `<div class="roster-toolbar no-print"><h1 class="text-xl font-bold tracking-tight">Historic roster</h1>${selectors}</div>
      <div class="opacity-70">No period in this month.</div>`;
  }

  const personDay = personDaySnapFromHistory(selected.entry);
  const legacySnap = selected.entry.snap
    && !(selected.entry.snap.layout === "person-day" && selected.entry.snap.cells && selected.entry.snap.people)
    ? selected.entry.snap
    : null;

  if (!personDay && !legacySnap) {
    return `<div class="roster-toolbar no-print"><h1 class="text-xl font-bold tracking-tight">Historic roster</h1>${selectors}</div>
      <div role="alert" class="alert alert-warning"><span>This log entry cannot be shown as a roster grid. Try View on the Log screen.</span>
      <button class="btn btn-sm" data-act="nav" data-s="log">Open Log</button></div>`;
  }

  const printBtn = `<button class="btn btn-sm btn-primary" data-act="print">Print in colour</button>`;
  const meta = `<span class="text-sm opacity-70">${esc(selected.rangeLabel)}${selected.savedLabel ? " · saved " + esc(selected.savedLabel) : ""} · read-only</span>`;
  const toolbar = `<div class="roster-toolbar no-print"><h1 class="text-xl font-bold tracking-tight">Historic roster</h1>${selectors}${meta}<span class="roster-toolbar-actions">${printBtn}</span></div>`;

  if (personDay) {
    /* Entries saved in the current format carry the unfilled list as it was at the time. Older ones
       are converted here, and guessing from today's role list could show warnings that were never true. */
    const native = !!(selected.entry.snap && selected.entry.snap.layout === "person-day" && selected.entry.snap.cells && selected.entry.snap.people);
    return `${toolbar}
      <div class="text-sm opacity-70 no-print mb-2">${native
        ? "Same person × day layout as Roster. Choose a saved block above, then print if needed."
        : "Shown in the Roster layout from an older saved layout — unfilled duties are not shown for these. Choose a saved block above, then print if needed."}</div>
      <div class="overflow-x-auto">${personDayScreenHTML(personDay, native)}</div>`;
  }

  return `${toolbar}
    <div class="text-sm opacity-70 no-print mb-2">Older saved layout (read-only).</div>
    <div class="overflow-x-auto">${rotaHTML(legacySnap)}</div>`;
}

export const actions = {
  print: () => window.print()
};

export const changes = {
  histYear: (v) => {
    S.ui.histYear = +v;
    const months = historicMonthsInYear(S.ui.histYear);
    S.ui.histMonth = months[0] || null;
    const ps = S.ui.histMonth ? historicPeriodsInMonth(S.ui.histMonth) : [];
    S.ui.histId = ps[0] ? ps[0].id : null;
  },
  histMonth: (v) => {
    S.ui.histMonth = v;
    const ps = historicPeriodsInMonth(S.ui.histMonth);
    S.ui.histId = ps[0] ? ps[0].id : null;
  },
  histPeriod: (v) => {
    S.ui.histId = v;
  }
};
