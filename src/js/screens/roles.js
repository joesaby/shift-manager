import { esc, uid } from "../util.js";
import { D, roleById, removeRoleEverywhere, markStale } from "../model.js";
import { ph } from "../ui-kit.js";
import { touch, toast, askConfirm } from "../state.js";
import { logAudit } from "../audit.js";

const FIELD_MAP = { name: "name", group: "groupId", day: "usedAtDay", night: "usedAtNight", hard: "hard", skill: "skillRestricted" };

export function vRol() {
  const gopts = (sel) => D().groups.map((g) => `<option value="${g.id}"${g.id === sel ? " selected" : ""}>${esc(g.name)}</option>`).join("");
  const rows = D().roles.map((r, i) => `<tr><td><input class="input input-bordered input-sm w-48" value="${esc(r.name)}" data-ch="rf" data-r="${r.id}" data-f="name"></td>
    <td><select class="select select-bordered select-sm" data-ch="rf" data-r="${r.id}" data-f="group">${gopts(r.groupId)}</select></td>
    <td class="text-center"><input type="checkbox" class="checkbox checkbox-sm" ${r.usedAtDay !== false ? "checked" : ""} data-ch="rf" data-r="${r.id}" data-f="day"></td>
    <td class="text-center"><input type="checkbox" class="checkbox checkbox-sm" ${r.usedAtNight ? "checked" : ""} data-ch="rf" data-r="${r.id}" data-f="night"></td>
    <td class="text-center"><input type="checkbox" class="checkbox checkbox-sm" ${r.hard ? "checked" : ""} data-ch="rf" data-r="${r.id}" data-f="hard"></td>
    <td class="text-center"><input type="checkbox" class="checkbox checkbox-sm" ${r.skillRestricted ? "checked" : ""} data-ch="rf" data-r="${r.id}" data-f="skill"></td>
    <td class="whitespace-nowrap"><button class="btn btn-xs" data-act="moveRole" data-r="${r.id}" data-n="-1" ${i === 0 ? "disabled" : ""} aria-label="Move up">Up</button> <button class="btn btn-xs" data-act="moveRole" data-r="${r.id}" data-n="1" ${i === D().roles.length - 1 ? "disabled" : ""} aria-label="Move down">Down</button> <button class="btn btn-xs btn-outline btn-error" data-act="askDelRole" data-r="${r.id}">Delete</button></td></tr>`).join("");
  const grps = D().groups.map((g) => `<div class="flex items-center gap-2"><input type="color" class="w-10 h-9 rounded border" value="${g.color}" data-ch="gcolor" data-g="${g.id}"><input class="input input-bordered input-sm" value="${esc(g.name)}" data-ch="gname" data-g="${g.id}"><button class="btn btn-xs btn-outline btn-error" data-act="delGroup" data-g="${g.id}">Delete</button></div>`).join("");
  return `${ph("Roles and groups", "Roles run down the rota in this order. Groups decide the print colour.", '<input id="newRole" class="input input-bordered w-44" placeholder="Role name"><button class="btn btn-primary" data-act="addRole">Add role</button><button class="btn btn-outline" data-act="bulk" data-k="roles">Paste many</button>')}
   <div class="card bg-base-100 shadow-sm border border-base-300 overflow-x-auto"><table class="table table-sm"><thead><tr><th>Role</th><th>Group</th><th class="text-center">Used by day</th><th class="text-center">Used at night</th><th class="text-center">Hard role</th><th class="text-center">Needs a skill</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="7" class="opacity-70">No roles yet.</td></tr>'}</tbody></table></div>
   <div class="text-sm text-base-content/70">Hard role: not given on back-to-back nights. Needs a skill: filled first, and only ever by people ticked as qualified. Ticking who is qualified is done on the People screen. Untick Used by day or Used at night to make a role only available on the other shift — for example a night-only Public Office duty.</div>
   <div class="card bg-base-100 shadow-sm border border-base-300"><div class="card-body"><h2 class="card-title">Groups and colours</h2><div class="space-y-2">${grps}</div>
    <div class="flex gap-2 mt-2"><input id="newGroup" class="input input-bordered input-sm" placeholder="New group name"><button class="btn btn-sm btn-primary" data-act="addGroup">Add group</button></div></div></div>`;
}

export const actions = {
  addRole: () => {
    const el = document.getElementById("newRole"); const n = el && el.value.trim(); if (!n) return;
    D().roles.push({
      id: uid(), name: n, groupId: D().groups[0] ? D().groups[0].id : "",
      usedAtDay: true, usedAtNight: true, hard: false, skillRestricted: false, sortOrder: D().roles.length + 1
    });
    markStale(); touch();
    logAudit("ROLE_ADDED", n);
  },
  moveRole: (a) => {
    const i = D().roles.findIndex((r) => r.id === a.r); const j = i + (+a.n);
    if (j < 0 || j >= D().roles.length) return;
    const t = D().roles[i]; D().roles[i] = D().roles[j]; D().roles[j] = t;
    D().roles.forEach((r, idx) => { r.sortOrder = idx + 1; });
    touch();
  },
  askDelRole: (a) => {
    const r = roleById(a.r);
    askConfirm("Delete " + r.name + "?", "The role is removed for everyone and from the next roster.", "Delete", () => {
      removeRoleEverywhere(a.r);
      D().roles = D().roles.filter((x) => x.id !== a.r);
      D().roles.forEach((x, idx) => { x.sortOrder = idx + 1; });
      markStale(); touch();
      logAudit("ROLE_DELETED", r.name);
    });
  },
  addGroup: () => {
    const el = document.getElementById("newGroup"); const n = el && el.value.trim(); if (!n) return;
    D().groups.push({ id: uid(), name: n, color: "#BFDBFE", sortOrder: D().groups.length + 1 });
    touch();
  },
  delGroup: (a) => {
    if (D().roles.some((r) => r.groupId === a.g)) { toast("Move its roles to another group first."); return; }
    D().groups = D().groups.filter((g) => g.id !== a.g); touch();
  }
};

export const changes = {
  rf: (v, ds) => {
    const r = roleById(ds.r);
    const key = FIELD_MAP[ds.f] || ds.f;
    if (key === "name") { if (v.trim()) r.name = v.trim(); }
    else r[key] = v;
    markStale();
  },
  gname: (v, ds) => { const g = D().groups.find((x) => x.id === ds.g); if (v.trim()) g.name = v.trim(); },
  gcolor: (v, ds) => { D().groups.find((x) => x.id === ds.g).color = v; }
};
