import { esc } from "../util.js";
import { S } from "../state.js";
import {
  currentMonthKey, monthLabel, loadMonths, teamLoadForMonth, dutyPivot, sortPivotRows, nextPivotSort
} from "../model.js";
import { ph } from "../ui-kit.js";

const DEFAULT_SORT = { key: "duties", dir: "desc" };

export function vStats() {
  if (S.ui.statsMonth == null) S.ui.statsMonth = currentMonthKey();
  if (!S.ui.statsSort) S.ui.statsSort = { ...DEFAULT_SORT };
  const months = loadMonths();
  const cur = currentMonthKey();
  const viewMonth = S.ui.statsMonth;
  const isCurrent = viewMonth === cur;
  const sort = S.ui.statsSort;
  const pivot = dutyPivot(viewMonth);
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
      <td class="stickycol font-medium whitespace-nowrap"><button type="button" class="link link-primary font-medium" data-act="goPerson" data-p="${r.person.id}">${esc(r.person.name)}</button></td>
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
      const active = S.ui.statsMonth === m;
      return `<button class="btn btn-sm justify-between ${active ? "btn-primary" : "btn-outline"}" data-act="statsMonth" data-m="${m}">
        <span>${esc(monthLabel(m))}</span>
        <span class="opacity-80 font-normal">${t} duties</span>
      </button>`;
    }).join("")
    : `<div class="text-sm opacity-70">No older months yet. After you Save roster across months, they appear here.</div>`;

  const monthTabs = `<div class="flex flex-wrap gap-2">
    <button class="btn btn-sm ${isCurrent ? "btn-primary" : "btn-ghost"}" data-act="statsMonth" data-m="${cur}">This month · ${esc(monthLabel(cur))}</button>
    ${months.filter((m) => m !== cur).slice(0, 5).map((m) =>
      `<button class="btn btn-sm ${viewMonth === m ? "btn-primary" : "btn-ghost"}" data-act="statsMonth" data-m="${m}">${esc(monthLabel(m))}</button>`
    ).join("")}
  </div>`;

  return `${ph("Duty stats", "How many times each person did each role in the selected month. Use the ▲ ▼ at the top of any column to sort it — for example a role, to see who did it most. Click a name for their detail.")}
    ${monthTabs}
    <div class="stats stats-vertical lg:stats-horizontal shadow-sm border border-base-300 bg-base-100 w-full">
      <div class="stat"><div class="stat-title">Month</div><div class="stat-value text-xl">${esc(monthLabel(viewMonth))}</div><div class="stat-desc">${isCurrent ? "Includes current roster + log" : "From saved log + roster dates"}</div></div>
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
            <th class="pivot-role pivot-total"${ariaSort("duties")} title="All duties this month">${sortBtn("duties", "Total")}</th>
          </tr></thead>
          <tbody>${body ? body + totalRow : '<tr><td colspan="' + (pivot.roles.length + 4) + '" class="opacity-70 p-4">No duties in this month yet.</td></tr>'}</tbody>
        </table>
      </div>
    </div>
    <div class="card bg-base-100 shadow-sm border border-base-300">
      <div class="card-body">
        <h2 class="card-title text-lg">Historic</h2>
        <p class="text-sm opacity-70 -mt-2">Past months with recorded duties. Select one to show the table above.</p>
        <div class="flex flex-col gap-2 max-w-lg">${histCards}</div>
      </div>
    </div>`;
}

export const actions = {
  statsMonth: (a) => { S.ui.statsMonth = a.m; },
  statsSort: (a) => { S.ui.statsSort = nextPivotSort(S.ui.statsSort, a.k, a.d); },
  goPerson: (a) => { S.ui.selPerson = a.p; S.ui.screen = "ppl"; }
};
