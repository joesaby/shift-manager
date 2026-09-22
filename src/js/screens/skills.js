import { esc } from "../util.js";
import { D, activePeople, qual, setQual, markStale } from "../model.js";
import { ph, noPeople } from "../ui-kit.js";

export function vSkills() {
  if (!D().people.length) return noPeople();
  const skills = D().roles.filter((r) => r.skillRestricted);
  if (!skills.length) {
    return `${ph("Skills", "Who is trained for the special roles (drivers, MIC, jailer, and any other role marked Needs a skill).")}
      <div role="alert" class="alert alert-info"><span>No skill roles yet. On <a class="link link-primary" data-act="nav" data-s="rol">Roles and groups</a>, tick <b>Needs a skill</b> on roles that only trained people may do (typically Car 1 / 103, Member in Charge, and Jailer).</span>
      <button class="btn btn-sm" data-act="nav" data-s="rol">Roles and groups</button></div>`;
  }
  const ppl = activePeople();
  const head = skills.map((r) => `<th class="text-center min-w-28 align-bottom"><div class="font-semibold text-sm leading-tight">${esc(r.name)}</div><div class="text-xs font-normal opacity-60 mt-1">Skill</div></th>`).join("");
  const rows = ppl.map((p) => `<tr class="hover"><td class="stickycol font-medium whitespace-nowrap">${esc(p.name)}</td>` +
    skills.map((r) => {
      const on = qual(p, r.id);
      return `<td class="text-center"><input type="checkbox" class="checkbox checkbox-sm" ${on ? "checked" : ""} data-ch="qual" data-p="${p.id}" data-r="${r.id}" aria-label="${esc(p.name)} qualified for ${esc(r.name)}"></td>`;
    }).join("") + "</tr>").join("");
  const general = D().roles.filter((r) => !r.skillRestricted).length;
  return `${ph("Skills", "Skill matrix for roles that need training. Tick who is qualified. Everyone else still gets general roles on the People screen.", '<button class="btn btn-outline" data-act="nav" data-s="ppl">All role ticks</button><button class="btn btn-outline" data-act="nav" data-s="rol">Mark skill roles</button>')}
    <div role="alert" class="alert"><span>These columns are the roles with <b>Needs a skill</b> set. The PO’s usual set is four: two drivers (Car), Member in Charge, and Jailer. There ${general === 1 ? "is" : "are"} ${general} general role${general === 1 ? "" : "s"} that anyone can be ticked for under People.</span></div>
    <div class="card bg-base-100 shadow-sm border border-base-300"><div class="overflow-x-auto"><table class="table table-sm">
      <thead><tr><th class="stickycol">Person</th>${head}</tr></thead>
      <tbody>${rows || '<tr><td colspan="' + (skills.length + 1) + '" class="opacity-70">No active people.</td></tr>'}</tbody>
    </table></div></div>`;
}

export const actions = {};

export const changes = {
  qual: (v, ds) => { setQual(ds.p, ds.r, v); markStale(); }
};
