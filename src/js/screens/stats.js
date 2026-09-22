import { esc } from "../util.js";
import { S } from "../state.js";
import {
  currentMonthKey, monthLabel, loadMonths, teamLoadForMonth
} from "../model.js";
import { ph } from "../ui-kit.js";

function fmtGroups(groups) {
  if (!groups || !groups.length) return "—";
  return groups.map((g) => esc(g.name) + " ×" + g.n).join(", ");
}

export function vStats() {
  if (S.ui.statsMonth == null) S.ui.statsMonth = currentMonthKey();
  const months = loadMonths();
  const cur = currentMonthKey();
  const viewMonth = S.ui.statsMonth;
  const team = teamLoadForMonth(viewMonth);
  const totals = team.reduce((a, r) => ({
    duties: a.duties + r.duties,
    day: a.day + r.day,
    night: a.night + r.night,
    hard: a.hard + r.hard,
    skill: a.skill + r.skill
  }), { duties: 0, day: 0, night: 0, hard: 0, skill: 0 });

  const isCurrent = viewMonth === cur;
  const teamRows = team.map((r) => {
    const top = r.roles.slice(0, 3).map((x) => esc(x.name) + " ×" + x.n).join(", ");
    return `<tr class="hover">
      <td><button type="button" class="link link-primary font-medium" data-act="goPerson" data-p="${r.person.id}">${esc(r.person.name)}</button></td>
      <td class="text-center">${r.duties}</td>
      <td class="text-center">${r.day}</td>
      <td class="text-center">${r.night}</td>
      <td class="text-center">${r.hard}</td>
      <td class="text-center">${r.skill}</td>
      <td class="text-sm">${fmtGroups(r.groups)}</td>
      <td class="text-sm opacity-80">${top || "—"}</td>
    </tr>`;
  }).join("");

  const historicMonths = months.filter((m) => m !== cur);
  const histCards = historicMonths.length
    ? historicMonths.map((m) => {
      const rows = teamLoadForMonth(m);
      const t = rows.reduce((a, r) => a + r.duties, 0);
      const day = rows.reduce((a, r) => a + r.day, 0);
      const night = rows.reduce((a, r) => a + r.night, 0);
      const active = S.ui.statsMonth === m;
      return `<button class="btn btn-sm justify-between ${active ? "btn-primary" : "btn-outline"}" data-act="statsMonth" data-m="${m}">
        <span>${esc(monthLabel(m))}</span>
        <span class="opacity-80 font-normal">${t} · ${day} day / ${night} night</span>
      </button>`;
    }).join("")
    : `<div class="text-sm opacity-70">No older months yet. After you Save to log across months, they appear here.</div>`;

  const monthTabs = `<div class="flex flex-wrap gap-2">
    <button class="btn btn-sm ${isCurrent ? "btn-primary" : "btn-ghost"}" data-act="statsMonth" data-m="${cur}">This month · ${esc(monthLabel(cur))}</button>
    ${months.filter((m) => m !== cur).slice(0, 5).map((m) =>
      `<button class="btn btn-sm ${viewMonth === m ? "btn-primary" : "btn-ghost"}" data-act="statsMonth" data-m="${m}">${esc(monthLabel(m))}</button>`
    ).join("")}
  </div>`;

  return `${ph("Duty stats", "Team workload for the selected month: day vs night, hard/skill, and duty type (role group). Open a person for their current-month detail.")}
    ${monthTabs}
    <div class="stats stats-vertical lg:stats-horizontal shadow-sm border border-base-300 bg-base-100 w-full">
      <div class="stat"><div class="stat-title">Month</div><div class="stat-value text-xl">${esc(monthLabel(viewMonth))}</div><div class="stat-desc">${isCurrent ? "Includes current roster + log" : "From saved log + roster dates"}</div></div>
      <div class="stat"><div class="stat-title">Duties</div><div class="stat-value text-3xl">${totals.duties}</div></div>
      <div class="stat"><div class="stat-title">Day shifts</div><div class="stat-value text-3xl">${totals.day}</div></div>
      <div class="stat"><div class="stat-title">Night shifts</div><div class="stat-value text-3xl">${totals.night}</div></div>
      <div class="stat"><div class="stat-title">Hard</div><div class="stat-value text-3xl">${totals.hard}</div></div>
      <div class="stat"><div class="stat-title">Skill</div><div class="stat-value text-3xl">${totals.skill}</div></div>
    </div>
    <div class="card bg-base-100 shadow-sm border border-base-300 overflow-x-auto">
      <div class="card-body p-0">
        <table class="table table-sm">
          <thead><tr>
            <th>Person</th>
            <th class="text-center">Duties</th>
            <th class="text-center">Day</th>
            <th class="text-center">Night</th>
            <th class="text-center">Hard</th>
            <th class="text-center">Skill</th>
            <th>Duty type (group)</th>
            <th>Top roles</th>
          </tr></thead>
          <tbody>${teamRows || '<tr><td colspan="8" class="opacity-70 p-4">No duties in this month yet.</td></tr>'}</tbody>
        </table>
      </div>
    </div>
    <div class="card bg-base-100 shadow-sm border border-base-300">
      <div class="card-body">
        <h2 class="card-title text-lg">Historic</h2>
        <p class="text-sm opacity-70 -mt-2">Past months with recorded duties. Select one to show the team table above.</p>
        <div class="flex flex-col gap-2 max-w-lg">${histCards}</div>
      </div>
    </div>`;
}

export const actions = {
  statsMonth: (a) => { S.ui.statsMonth = a.m; },
  goPerson: (a) => { S.ui.selPerson = a.p; S.ui.screen = "ppl"; }
};
