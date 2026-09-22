import { esc, STAT, SBG } from "../util.js";
import { D, block, dayLabels, activePeople, rolesForDay, isPresent, getStatus, setStatus, roleById, personById, markStale } from "../model.js";
import { ph, noPeople, unitBanner } from "../ui-kit.js";
import { logAudit } from "../audit.js";

export function vAtt() {
  if (!D().people.length) return noPeople();
  const days = dayLabels(); const ppl = activePeople();
  const info = days.map((d, i) => ({ d: d, need: rolesForDay(i).length, pc: ppl.filter((p) => isPresent(p, i)).length }));
  const stats = info.map((x) => `<div class="stat"><div class="stat-value text-2xl leading-snug">${esc(x.d.label)} <span class="badge badge-sm ${x.d.shift === "Day" ? "badge-warning" : "badge-info"}">${x.d.shift}</span></div><div class="stat-desc mt-1 font-semibold ${x.pc < x.need ? "text-error" : "text-success"}">${x.pc} present, ${x.need} roles to fill</div></div>`).join("");
  const heads = days.map((d, i) => `<th class="align-bottom min-w-40"><div class="font-semibold">${esc(d.label)}</div><select class="select select-bordered select-xs mt-1" data-ch="shift" data-d="${i}" aria-label="Shift for ${esc(d.label)}"><option${d.shift === "Day" ? " selected" : ""}>Day</option><option${d.shift === "Night" ? " selected" : ""}>Night</option></select></th>`).join("");
  const rows = ppl.map((p) => `<tr class="hover"><td class="stickycol font-medium whitespace-nowrap">${esc(p.name)}${p.fixedRoleId ? `<div class="text-xs text-base-content/60 font-normal">Only ${esc((roleById(p.fixedRoleId) || { name: "" }).name)}</div>` : ""}</td>` + days.map((d, i) => {
    const v = getStatus(p.id, i);
    return `<td class="min-w-40"><select class="select select-bordered select-sm w-full" style="background:${SBG[v]}" data-ch="status" data-p="${p.id}" data-d="${i}" aria-label="${esc(p.name)}, ${esc(d.label)}">${STAT.map((x) => `<option${x === v ? " selected" : ""}>${x}</option>`).join("")}</select></td>`;
  }).join("") + "</tr>").join("");
  const short = info.filter((x) => x.pc < x.need);
  return `${ph("1. Attendance", "Set who is working each day. Only people marked Present get a role.", `<label class="form-control"><span class="label-text text-xs mb-1">Block starts</span><input type="date" class="input input-bordered input-sm" value="${block().startDate}" data-ch="start"></label><button class="btn btn-primary" data-act="generate">Generate roster</button>`)}
   ${unitBanner()}
   <div class="stats stats-vertical lg:stats-horizontal shadow-sm border border-base-300 bg-base-100 w-full">${stats}</div>
   ${short.length ? `<div role="alert" class="alert alert-error"><span>Not enough people present: ${short.map((x) => esc(x.d.label) + " has " + x.pc + " for " + x.need + " roles").join("; ")}.</span></div>` : ""}
   <div class="card bg-base-100 shadow-sm border border-base-300"><div class="overflow-x-auto"><table class="table"><thead><tr><th class="stickycol">Person</th>${heads}</tr></thead><tbody>${rows}</tbody></table></div></div>`;
}

export const actions = {};

export const changes = {
  status: (v, ds) => {
    setStatus(ds.p, +ds.d, v); markStale();
    const p = personById(ds.p);
    logAudit("ATTENDANCE_STATUS_CHANGED", (p ? p.name : ds.p) + " day=" + ds.d + " status=" + v);
  },
  shift: (v, ds) => { block().shifts[+ds.d] = v; markStale(); },
  start: (v) => { if (v) block().startDate = v; }
};
