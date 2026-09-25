import { esc, fmtLong } from "../util.js";
import { S } from "../state.js";
import {
  currentMonthKey, monthLabel, loadMonths, teamLoadForMonth, dutyPivot, sortPivotRows, nextPivotSort,
  statsRange, personReport, personById, unitName
} from "../model.js";
import { ph } from "../ui-kit.js";
import { LOGO_DATA_URI } from "../../assets/logo.js";
import { getSessionUser } from "../audit.js";

/* Exact first / last day of "YYYY-MM" (the model's month range uses -31 only for comparisons). */
function monthBounds(month) {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: month + "-01", to: month + "-" + String(last).padStart(2, "0") };
}
function yearBounds(year) { return { from: year + "-01-01", to: year + "-12-31" }; }

function activePreset() {
  const f = S.ui.statsFrom; const t = S.ui.statsTo;
  if (!f && !t) return "all";
  const cur = currentMonthKey();
  const mb = monthBounds(cur); const yb = yearBounds(cur.slice(0, 4));
  if (f === mb.from && t === mb.to) return "month";
  if (f === yb.from && t === yb.to) return "year";
  return "custom";
}

/** Period bar: presets plus a between-dates selector. Default is everything up to today. */
function rangeBar(range) {
  const on = activePreset();
  const pre = (p, label) => `<button type="button" class="btn btn-sm ${on === p ? "btn-primary" : "btn-ghost"}" data-act="statsPreset" data-p="${p}">${label}</button>`;
  return `<div class="flex flex-wrap items-end gap-2 no-print">
    ${pre("all", "All time")}${pre("year", "This year")}${pre("month", "This month")}
    <label class="form-control"><span class="label-text text-xs mb-1">From</span><input type="date" class="input input-bordered input-sm" value="${esc(range.from)}" data-ch="statsFrom" aria-label="Stats from date"></label>
    <label class="form-control"><span class="label-text text-xs mb-1">To</span><input type="date" class="input input-bordered input-sm" value="${esc(range.to)}" data-ch="statsTo" aria-label="Stats to date"></label>
    ${on === "custom" ? '<span class="badge badge-ghost">Custom dates</span>' : ""}
  </div>`;
}

const periodText = (r) => fmtLong(r.from) + " to " + fmtLong(r.to);

/** One person: every role with their count, plus attendance, printable on its own. */
function vPersonReport(pid, range) {
  const rep = personReport(pid, range);
  if (!rep.person) return null;
  const p = rep.person;
  const unit = (unitName() || "").trim();
  const by = (getSessionUser() || "").trim();
  const nums = [p.employeeNo ? "Employee no. " + esc(p.employeeNo) : "", p.shoulderNo ? "Shoulder no. " + esc(p.shoulderNo) : ""].filter(Boolean).join(" · ");
  const dutyRows = rep.roles.map((r) => `<tr><td>${esc(r.name)}${r.hard ? ' <span class="pivot-tag" title="Hard role">H</span>' : ""}${r.retired ? ' <span class="text-xs opacity-60">(no longer in role list)</span>' : ""}</td>${r.n ? `<td class="pivot-n font-semibold">${r.n}</td>` : '<td class="pivot-n pivot-zero">·</td>'}</tr>`).join("");
  const attRows = rep.attendance.map((a) => `<tr><td>${esc(a.label)}</td>${a.n ? `<td class="pivot-n font-semibold">${a.n}</td>` : '<td class="pivot-n pivot-zero">·</td>'}</tr>`).join("");
  return `<div class="flex flex-wrap items-center gap-2 no-print">
      <button type="button" class="btn btn-sm btn-ghost" data-act="statsBack">← All people</button>
      <h1 class="text-xl font-bold tracking-tight">${esc(p.name)}</h1>
      <span class="roster-toolbar-actions">
        <button type="button" class="btn btn-sm btn-ghost" data-act="goPerson" data-p="${p.id}">Open in People</button>
        <button type="button" class="btn btn-sm btn-primary" data-act="print">Print this report</button>
      </span>
    </div>
    ${rangeBar(range)}
    <div class="text-xs opacity-70 no-print">Attendance counts the current block and rotas saved to the Log; a block that was never saved is not counted.</div>
    <div id="printArea" class="bg-white text-black border border-base-300 rounded-box p-4 shadow-sm" style="--pfs:12px;--ppad:3px">
      <div class="flex items-center gap-3 mb-4"><img src="${LOGO_DATA_URI}" alt="An Garda Síochána" class="w-12 h-12 object-contain shrink-0" width="48" height="48"><div>
        <div class="text-xs font-semibold uppercase tracking-wide opacity-70">An Garda Síochána</div>
        ${unit ? `<div class="text-base font-semibold">${esc(unit)}</div>` : ""}
        <h2 class="text-xl font-semibold">Duty record: ${esc(p.name)}</h2>
        <div class="text-sm">${esc(periodText(range))}${nums ? " · " + nums : ""}</div>
        ${by ? `<div class="text-xs opacity-70">Prepared by ${esc(by)}</div>` : ""}
      </div></div>
      <div class="person-report">
        <table class="rota"><thead><tr><th class="bg-neutral text-neutral-content text-left p-2">Duty</th><th class="bg-neutral text-neutral-content pivot-n p-2">Times</th></tr></thead>
          <tbody>${dutyRows}
            <tr class="pivot-total-row"><td class="font-bold">Total duties</td><td class="pivot-n font-bold">${rep.duties}</td></tr>
            <tr><td>of which hard roles</td><td class="pivot-n">${rep.hard}</td></tr>
            <tr><td>of which skill roles</td><td class="pivot-n">${rep.skill}</td></tr></tbody></table>
        <table class="rota"><thead><tr><th class="bg-neutral text-neutral-content text-left p-2">Attendance</th><th class="bg-neutral text-neutral-content pivot-n p-2">Days</th></tr></thead>
          <tbody>${attRows}
            <tr class="pivot-total-row"><td class="font-bold">Total days</td><td class="pivot-n font-bold">${rep.attendanceDays}</td></tr></tbody></table>
      </div>
    </div>`;
}

const DEFAULT_SORT = { key: "duties", dir: "desc" };

export function vStats() {
  if (!S.ui.statsSort) S.ui.statsSort = { ...DEFAULT_SORT };
  const range = statsRange(S.ui.statsFrom, S.ui.statsTo);
  if (S.ui.statsPerson) {
    const html = vPersonReport(S.ui.statsPerson, range);
    if (html) return html;
    S.ui.statsPerson = null; /* person no longer exists */
  }
  const months = loadMonths();
  const cur = currentMonthKey();
  const sort = S.ui.statsSort;
  const pivot = dutyPivot(range);
  const rows = sortPivotRows(pivot.rows, sort.key, sort.dir);
  const totals = pivot.totals;

  /* Every heading: click the name to toggle, or press ▲ (low to high) / ▼ (high to low) directly.
     The active direction is highlighted; the other headings show both arrows faintly. */
  const sortBtn = (key, label) => {
    const ka = esc(key); const kl = esc(label);
    const asc = key === "person" ? "A to Z" : "fewest first";
    const desc = key === "person" ? "Z to A" : "most first";
    const dirBtn = (d, glyph, tip) => `<button type="button" class="pivot-dir${sort.key === key && sort.dir === d ? " on" : ""}" data-act="statsSort" data-k="${ka}" data-d="${d}" title="Sort ${kl}: ${tip}" aria-label="Sort ${kl} ${tip}">${glyph}</button>`;
    return `<span class="pivot-head"><button type="button" class="pivot-sort" data-act="statsSort" data-k="${ka}" title="Sort by ${kl}">${kl}</button><span class="pivot-arrows">${dirBtn("asc", "▲", asc)}${dirBtn("desc", "▼", desc)}</span></span>`;
  };
  const ariaSort = (key) => (sort.key === key ? ` aria-sort="${sort.dir === "desc" ? "descending" : "ascending"}"` : "");
  const cell = (n) => (n ? `<td class="pivot-n font-semibold">${n}</td>` : '<td class="pivot-n pivot-zero">·</td>');

  const roleHeads = pivot.roles.map((r) => {
    const key = "role:" + r.name;
    const tag = r.hard ? ' <span class="pivot-tag" title="Hard role">H</span>' : "";
    const note = r.retired ? " (no longer in role list)" : r.hard ? " (hard role)" : "";
    return `<th class="pivot-role"${ariaSort(key)} title="${esc(r.name + note)}">${sortBtn(key, r.name)}${tag}</th>`;
  }).join("");

  const body = rows.map((r) => `<tr class="hover">
      <td class="stickycol font-medium whitespace-nowrap"><button type="button" class="link link-primary font-medium" data-act="statsPerson" data-p="${r.person.id}">${esc(r.person.name)}</button></td>
      ${pivot.roles.map((c) => cell(r.counts[c.name] || 0)).join("")}
      ${cell(r.hard)}${cell(r.skill)}
      <td class="pivot-n pivot-total font-bold">${r.duties}</td>
    </tr>`).join("");

  /* Tally at the end: one total per role, then Hard / Skill / grand total. */
  const totalRow = `<tr class="pivot-total-row">
      <td class="stickycol whitespace-nowrap">Total</td>
      ${pivot.roles.map((c) => `<td class="pivot-n">${totals.counts[c.name] || 0}</td>`).join("")}
      <td class="pivot-n">${totals.hard}</td><td class="pivot-n">${totals.skill}</td>
      <td class="pivot-n pivot-total">${totals.duties}</td>
    </tr>`;

  const historicMonths = months.filter((m) => m !== cur);
  const histCards = historicMonths.length
    ? historicMonths.map((m) => {
      const t = teamLoadForMonth(m).reduce((a, r) => a + r.duties, 0);
      const mb = monthBounds(m);
      const active = S.ui.statsFrom === mb.from && S.ui.statsTo === mb.to;
      return `<button class="btn btn-sm justify-between ${active ? "btn-primary" : "btn-outline"}" data-act="statsMonth" data-m="${m}">
        <span>${esc(monthLabel(m))}</span>
        <span class="opacity-80 font-normal">${t} duties</span>
      </button>`;
    }).join("")
    : `<div class="text-sm opacity-70">No older months yet. After you Save roster across months, they appear here.</div>`;

  const preset = activePreset();
  const periodNote = preset === "all" ? "All time, up to today" : preset === "month" ? "This month" : preset === "year" ? "This year" : "Custom dates";

  return `${ph("Duty stats", "How many times each person did each role over the period you choose (default: everything up to today). Use the ▲ ▼ at the top of any column to sort it — for example a role, to see who did it most. Click a name for a printable report on just that person.")}
    ${rangeBar(range)}
    <div class="stats stats-vertical lg:stats-horizontal shadow-sm border border-base-300 bg-base-100 w-full">
      <div class="stat"><div class="stat-title">Period</div><div class="stat-value text-lg">${esc(fmtLong(range.from))} – ${esc(fmtLong(range.to))}</div><div class="stat-desc">${periodNote} · current roster + saved log</div></div>
      <div class="stat"><div class="stat-title">Duties</div><div class="stat-value text-3xl">${totals.duties}</div></div>
      <div class="stat"><div class="stat-title">Hard</div><div class="stat-value text-3xl">${totals.hard}</div></div>
      <div class="stat"><div class="stat-title">Skill</div><div class="stat-value text-3xl">${totals.skill}</div></div>
    </div>
    <div class="card bg-base-100 shadow-sm border border-base-300">
      <div class="pivot-scroll">
        <table class="table table-sm stats-pivot">
          <thead><tr>
            <th class="stickycol"${ariaSort("person")}>${sortBtn("person", "Person")}</th>
            ${roleHeads}
            <th class="pivot-role"${ariaSort("hard")} title="Duties on hard roles">${sortBtn("hard", "Hard")}</th>
            <th class="pivot-role"${ariaSort("skill")} title="Duties on roles that need a skill">${sortBtn("skill", "Skill")}</th>
            <th class="pivot-role pivot-total"${ariaSort("duties")} title="All duties in this period">${sortBtn("duties", "Total")}</th>
          </tr></thead>
          <tbody>${body ? body + totalRow : '<tr><td colspan="' + (pivot.roles.length + 4) + '" class="opacity-70 p-4">No duties in this period.</td></tr>'}</tbody>
        </table>
      </div>
    </div>
    <div class="card bg-base-100 shadow-sm border border-base-300">
      <div class="card-body">
        <h2 class="card-title text-lg">Historic</h2>
        <p class="text-sm opacity-70 -mt-2">Past months with recorded duties. Click one to show just that month above.</p>
        <div class="flex flex-col gap-2 max-w-lg">${histCards}</div>
      </div>
    </div>`;
}

export const actions = {
  statsMonth: (a) => { const b = monthBounds(a.m); S.ui.statsFrom = b.from; S.ui.statsTo = b.to; S.ui.statsPerson = null; },
  statsPreset: (a) => {
    const cur = currentMonthKey();
    const b = a.p === "month" ? monthBounds(cur) : a.p === "year" ? yearBounds(cur.slice(0, 4)) : { from: null, to: null };
    S.ui.statsFrom = b.from; S.ui.statsTo = b.to;
  },
  statsSort: (a) => { S.ui.statsSort = nextPivotSort(S.ui.statsSort, a.k, a.d); },
  statsPerson: (a) => { if (personById(a.p)) S.ui.statsPerson = a.p; },
  statsBack: () => { S.ui.statsPerson = null; },
  goPerson: (a) => { S.ui.selPerson = a.p; S.ui.screen = "ppl"; }
};

/* Date edits are screen state only (see main.js: not a data change). An empty box means "default". */
export const changes = {
  statsFrom: (v) => { S.ui.statsFrom = v || null; },
  statsTo: (v) => { S.ui.statsTo = v || null; }
};
