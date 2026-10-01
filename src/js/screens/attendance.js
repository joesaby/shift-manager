import { esc, STAT, SBG } from "../util.js";
import { D, block, dayLabels, activePeople, essentialRolesForDay, isPresent, getStatus, statusCountsForDay, canRegenerate, setStatus, roleById, personById, markStale } from "../model.js";
import { ph, noPeople, unitBanner } from "../ui-kit.js";
import { logAudit } from "../audit.js";

export function vAtt() {
  if (!D().people.length) return noPeople();
  const days = dayLabels(); const ppl = activePeople();
  const info = days.map((d, i) => ({ d: d, need: essentialRolesForDay(i).length, pc: ppl.filter((p) => isPresent(p, i)).length, away: statusCountsForDay(i).filter((c) => c.label !== "Present" && c.n > 0) }));
  /* Summary lives in each day's column header so it lines up with the status column below. */
  const summary = (x) => `<div class="att-sum font-normal"><div class="text-xs font-semibold ${x.pc < x.need ? "text-error" : "text-success"}">${x.pc} present, ${x.need} roles to fill</div><div class="att-away">${x.away.length ? x.away.map((c) => `<span class="att-away-chip" style="background:${SBG[c.label]}">${esc(c.label)} <b>${c.n}</b></span>`).join("") : '<span class="opacity-60 text-xs">Everyone present</span>'}</div></div>`;
  const heads = days.map((d, i) => `<th class="align-bottom min-w-40"><div class="font-semibold">${esc(d.label)}</div><select class="select select-bordered select-xs mt-1" data-ch="shift" data-d="${i}" aria-label="Shift for ${esc(d.label)}"><option${d.shift === "Day" ? " selected" : ""}>Day</option><option${d.shift === "Night" ? " selected" : ""}>Night</option></select>${summary(info[i])}</th>`).join("");
  const rows = ppl.map((p) => {
    const allAL = days.every((d, i) => getStatus(p.id, i) === "Annual leave");
    return `<tr class="hover"><td class="stickycol font-medium whitespace-nowrap"><div class="att-name"><span>${esc(p.name)}${p.fixedRoleId ? `<div class="text-xs text-base-content/60 font-normal">Only ${esc((roleById(p.fixedRoleId) || { name: "" }).name)}</div>` : ""}</span><label class="att-al" title="Annual leave for all days of this block. Unticking sets every day back to Present."><input type="checkbox" class="checkbox checkbox-sm" data-ch="allAL" data-p="${p.id}" ${allAL ? "checked" : ""}> AL</label></div></td>` + days.map((d, i) => {
      const v = getStatus(p.id, i);
      return `<td class="min-w-40"><select class="select select-bordered select-sm w-full" style="background:${SBG[v]}" data-ch="status" data-p="${p.id}" data-d="${i}" aria-label="${esc(p.name)}, ${esc(d.label)}">${STAT.map((x) => `<option${x === v ? " selected" : ""}>${x}</option>`).join("")}</select></td>`;
    }).join("") + "</tr>";
  }).join("");
  const short = info.filter((x) => x.pc < x.need);
  return `${ph("1. Attendance", "Set who is working each day. Only people marked Present get a role. Tick <b>AL</b> beside a name for annual leave on every day of the block (untick to set them back to Present); any essential roles they held go to the parking lot.", `<label class="form-control"><span class="label-text text-xs mb-1">Block starts</span><input type="date" class="input input-bordered input-sm" value="${block().startDate}" data-ch="start"></label><button class="btn btn-primary" data-act="generate"${canRegenerate() ? "" : ' disabled title="This block has passed and already has a roster — edit it on the Roster screen"'}>Generate roster</button>`)}
   ${unitBanner()}
   ${short.length ? `<div role="alert" class="alert alert-error"><span>Not enough people present: ${short.map((x) => esc(x.d.label) + " has " + x.pc + " for " + x.need + " essential roles").join("; ")}.</span></div>` : ""}
   <div class="card bg-base-100 shadow-sm border border-base-300"><div class="attScroll"><table class="table att-freeze"><thead><tr><th class="stickycol">Person</th>${heads}</tr></thead><tbody>${rows}</tbody></table></div></div>`;
}

export const actions = {};

export const changes = {
  status: (v, ds) => {
    setStatus(ds.p, +ds.d, v);
    const p = personById(ds.p);
    logAudit("ATTENDANCE_STATUS_CHANGED", (p ? p.name : ds.p) + " day=" + ds.d + " status=" + v);
  },
  shift: (v, ds) => { block().shifts[+ds.d] = v; markStale(); },
  start: (v) => { if (v) block().startDate = v; },
  allAL: (v, ds) => {
    const days = dayLabels();
    const status = v ? "Annual leave" : "Present";
    days.forEach((d, i) => setStatus(ds.p, i, status));
    const p = personById(ds.p);
    logAudit("ATTENDANCE_STATUS_CHANGED", (p ? p.name : ds.p) + " all days status=" + status);
  }
};
