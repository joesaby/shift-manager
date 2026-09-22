import { esc } from "../util.js";
import { S } from "../state.js";
import { D, block, dayLabels, activePeople, personById, roleById, groupById, isPresent, qual, canDo, getStatus, isStale, rosterDays, rolesForDay, roleOfPerson } from "../model.js";
import { generate as generateRoster, assignTo } from "../generator.js";
import { ph, noPeople, unitBanner } from "../ui-kit.js";
import { toast } from "../state.js";
import { logAudit } from "../audit.js";

export function rosterWarn(d, rid, pid) {
  const p = personById(pid); if (!p) return "Person removed";
  if (!isPresent(p, d)) return "Not present";
  if (!qual(p, rid)) return "Not qualified";
  if (p.fixedRoleId && p.fixedRoleId !== rid) return "Only does another role";
  return "";
}

export function vRos() {
  if (!D().people.length) return noPeople();
  const ros = rosterDays();
  if (!ros) return `${ph("2. Roster", "")}<div role="alert" class="alert"><span>No roster yet.</span><button class="btn btn-sm btn-primary" data-act="generate">Generate roster</button></div>`;

  const days = dayLabels();
  if (S.ui.rosterDay == null || S.ui.rosterDay < 0 || S.ui.rosterDay >= days.length) S.ui.rosterDay = 0;
  const di = S.ui.rosterDay;
  const day = days[di];
  const roles = rolesForDay(di);
  const dayAssign = ros[di];
  const ppl = activePeople();
  const bad = []; const unf = [];

  roles.forEach((r) => {
    const pid = dayAssign.assign[r.id];
    const p = pid ? personById(pid) : null;
    if (!p) unf.push(r.name);
    else {
      const w = rosterWarn(di, r.id, pid);
      if (w) bad.push(esc(p.name) + " as " + esc(r.name) + " (" + w.toLowerCase() + ")");
    }
  });

  const dayTabs = days.map((d, i) =>
    `<button class="btn btn-sm ${i === di ? "btn-primary" : "btn-ghost"}" data-act="rosterDay" data-d="${i}">${esc(d.label)} <span class="badge badge-sm ${d.shift === "Day" ? "badge-warning" : "badge-info"}">${d.shift}</span></button>`
  ).join("");

  const head = roles.map((r) => {
    const filled = !!dayAssign.assign[r.id];
    return `<th class="text-center min-w-28 align-bottom px-1">
      <div class="flex flex-col items-center gap-1">
        <span class="grpdot" style="background:${groupById(r.groupId).color};border:1px solid #9ca3af"></span>
        <span class="font-semibold text-xs leading-tight">${esc(r.name)}</span>
        ${!filled ? '<span class="badge badge-error badge-xs">Unfilled</span>' : ""}
      </div>
    </th>`;
  }).join("");

  const rows = ppl.map((p) => {
    const present = isPresent(p, di);
    const st = getStatus(p.id, di);
    const myRole = roleOfPerson(dayAssign, p.id);
    const statusBit = present
      ? ""
      : `<div class="text-xs font-normal opacity-70">${esc(st)}</div>`;
    const cells = roles.map((r) => {
      if (!present) {
        return `<td class="p-1"><div class="cellbtn text-center opacity-40" style="background:#EEEEEE;color:#6B7378">—</div></td>`;
      }
      const holderId = dayAssign.assign[r.id];
      const isMine = holderId === p.id;
      const w = isMine ? rosterWarn(di, r.id, p.id) : "";
      if (isMine) {
        const style = w
          ? "background:#FDE68A;outline:2px solid #B91C1C"
          : "background:" + groupById(r.groupId).color;
        return `<td class="p-1"><button class="cellbtn font-semibold" style="${style}" data-act="cell" data-d="${di}" data-r="${r.id}" title="${esc(w || r.name)}">✓${w ? " !" : ""}</button></td>`;
      }
      const can = canDo(p, r.id);
      if (!can) {
        return `<td class="p-1"><div class="cellbtn text-center opacity-30" style="background:#f3f4f6;color:#9ca3af" title="Not qualified">·</div></td>`;
      }
      /* Qualified + present + free (or on another role — click will swap). */
      const title = myRole ? "Click to move here (swap)" : "Click to assign";
      return `<td class="p-1"><button class="cellbtn" style="background:#fff;border:1px dashed #9ca3af" data-act="assignDirect" data-d="${di}" data-r="${r.id}" data-p="${p.id}" title="${esc(title)}"> </button></td>`;
    }).join("");
    return `<tr class="hover ${present ? "" : "opacity-70"}"><td class="stickycol font-medium whitespace-nowrap">${esc(p.name)}${statusBit}${myRole && present ? `<div class="text-xs font-normal opacity-60">${esc((roleById(myRole) || {}).name || "")}</div>` : ""}</td>${cells}</tr>`;
  }).join("");

  return `${ph("2. Roster", "People down the side, roles across. Pick a day, then click a cell to assign or change.", '<button class="btn btn-outline btn-primary" data-act="generate">Generate again</button><button class="btn btn-primary" data-act="nav" data-s="prt">Continue to print</button>')}
   ${unitBanner()}
   <div class="flex flex-wrap gap-2 print:hidden">${dayTabs}</div>
   <div class="text-sm opacity-70">${esc(day.label)} · ${esc(day.shift)} shift — click an empty qualified cell to assign; click ✓ to change who is on that role.</div>
   ${isStale() ? `<div role="alert" class="alert alert-warning"><span>Attendance or setup changed since this roster was generated. Generate again, or check the flagged cells.</span></div>` : ""}
   ${unf.length ? `<div role="alert" class="alert alert-error"><span>Unfilled on this day: ${esc(unf.join("; "))}.</span></div>` : ""}
   ${bad.length ? `<div role="alert" class="alert alert-warning"><span>Check: ${bad.join("; ")}.</span></div>` : ""}
   <div class="card bg-base-100 shadow-sm border border-base-300"><div class="overflow-x-auto"><table class="table table-sm">
     <thead><tr><th class="stickycol">Person</th>${head}</tr></thead>
     <tbody>${rows}</tbody>
   </table></div></div>`;
}

export const actions = {
  generate: () => {
    if (!activePeople().length || !D().roles.length) { toast("Add roles and people first."); return; }
    generateRoster(); S.ui.screen = "ros";
    logAudit("ROSTER_GENERATED", "block_start=" + block().startDate);
  },
  rosterDay: (a) => { S.ui.rosterDay = +a.d; S.ui.sel = null; },
  cell: (a) => { S.ui.sel = { d: +a.d, r: a.r }; },
  assignDirect: (a) => assignTo(+a.d, a.r, a.p || null),
  assign: (a) => assignTo(+a.d, a.r, a.p || null),
  closeSel: () => { S.ui.sel = null; }
};
