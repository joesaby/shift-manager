import { esc, uid } from "../util.js";
import { D, roleById, removeRoleEverywhere, markStale } from "../model.js";
import { ph } from "../ui-kit.js";
import { touch, toast, askConfirm } from "../state.js";
import { logAudit } from "../audit.js";

const FIELD_MAP = { name: "name", group: "groupId", day: "usedAtDay", night: "usedAtNight", hard: "hard", essential: "essential", once: "oncePerBlock", files: "files" };

function rolesOrdered() {
  return D().roles.slice().sort((a, b) => {
    const ae = a.essential !== false ? 0 : 1;
    const be = b.essential !== false ? 0 : 1;
    if (ae !== be) return ae - be;
    return (a.sortOrder || 0) - (b.sortOrder || 0);
  });
}

export function vRol() {
  const gopts = (sel) => D().groups.map((g) => `<option value="${g.id}"${g.id === sel ? " selected" : ""}>${esc(g.name)}</option>`).join("");
  const ordered = rolesOrdered();
  const rows = ordered.map((r, i) => {
    const sameBand = (j) => ordered[j] && ((ordered[j].essential !== false) === (r.essential !== false));
    const upOk = i > 0 && sameBand(i - 1);
    const downOk = i < ordered.length - 1 && sameBand(i + 1);
    return `<tr><td><input class="input input-bordered input-sm w-48" value="${esc(r.name)}" data-ch="rf" data-r="${r.id}" data-f="name"></td>
    <td><select class="select select-bordered select-sm" data-ch="rf" data-r="${r.id}" data-f="group">${gopts(r.groupId)}</select></td>
    <td class="text-center"><input type="checkbox" class="checkbox checkbox-sm" ${r.essential !== false ? "checked" : ""}${r.files ? " disabled" : ""} data-ch="rf" data-r="${r.id}" data-f="essential" title="${r.files ? "The Files role is never essential" : "Must be filled"}"></td>
    <td class="text-center"><input type="checkbox" class="checkbox checkbox-sm" ${r.usedAtDay !== false ? "checked" : ""} data-ch="rf" data-r="${r.id}" data-f="day"></td>
    <td class="text-center"><input type="checkbox" class="checkbox checkbox-sm" ${r.usedAtNight ? "checked" : ""} data-ch="rf" data-r="${r.id}" data-f="night"></td>
    <td class="text-center"><input type="checkbox" class="checkbox checkbox-sm" ${r.hard ? "checked" : ""} data-ch="rf" data-r="${r.id}" data-f="hard"></td>
    <td class="text-center"><input type="checkbox" class="checkbox checkbox-sm" ${r.oncePerBlock ? "checked" : ""} data-ch="rf" data-r="${r.id}" data-f="once" title="Same person at most one day per block (per group)"></td>
    <td class="text-center"><input type="checkbox" class="checkbox checkbox-sm" ${r.files ? "checked" : ""} data-ch="rf" data-r="${r.id}" data-f="files" title="Takes everyone still free after the other roles; any number per day"></td>
    <td class="whitespace-nowrap"><button class="btn btn-xs" data-act="moveRole" data-r="${r.id}" data-n="-1" ${upOk ? "" : "disabled"} aria-label="Move up">Up</button> <button class="btn btn-xs" data-act="moveRole" data-r="${r.id}" data-n="1" ${downOk ? "" : "disabled"} aria-label="Move down">Down</button> <button class="btn btn-xs btn-outline btn-error" data-act="askDelRole" data-r="${r.id}">Delete</button></td></tr>`;
  }).join("");
  const grps = D().groups.map((g) => `<div class="flex items-center gap-2"><input type="color" class="w-10 h-9 rounded border" value="${g.color}" data-ch="gcolor" data-g="${g.id}"><input class="input input-bordered input-sm" value="${esc(g.name)}" data-ch="gname" data-g="${g.id}"><button class="btn btn-xs btn-outline btn-error" data-act="delGroup" data-g="${g.id}">Delete</button></div>`).join("");
  return `${ph("Roles and groups", "Essential roles must be filled. Unticked roles are for spare people (filled after essentials, in this list order).", '<input id="newRole" class="input input-bordered w-44" placeholder="Role name"><button class="btn btn-primary" data-act="addRole">Add role</button><button class="btn btn-outline" data-act="bulk" data-k="roles">Paste many</button>')}
   <div class="card bg-base-100 shadow-sm border border-base-300 overflow-x-auto"><table class="table table-sm"><thead><tr><th>Role</th><th>Group</th><th class="text-center">Essential</th><th class="text-center">Used by day</th><th class="text-center">Used at night</th><th class="text-center">Hard role</th><th class="text-center">Once per block</th><th class="text-center">Files role</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="9" class="opacity-70">No roles yet.</td></tr>'}</tbody></table></div>
   <div class="text-sm text-base-content/70"><b>Essential</b>: must be filled (warnings if empty). Unticked roles are optional work, filled from whoever is left in this list order (Up / Down). <b>Hard role</b>: not given on back-to-back nights. <b>Once per block</b>: a person gets at most one day on roles in that group per block. Nobody gets a role from the same group two days running. Untick <b>Used by day</b> or <b>Used at night</b> to make a role only available on the other shift. <b>Files role</b> (one role only, never essential): once the other roles are filled, everyone still free gets it — any number a day — and who ends up spare is rotated. Tick Files for people on <b>People</b> (Select all). Who can do each role is ticked on People.</div>
   <div class="card bg-base-100 shadow-sm border border-base-300"><div class="card-body"><h2 class="card-title">Groups and colours</h2><div class="space-y-2">${grps}</div>
    <div class="flex gap-2 mt-2"><input id="newGroup" class="input input-bordered input-sm" placeholder="New group name"><button class="btn btn-sm btn-primary" data-act="addGroup">Add group</button></div></div></div>`;
}

export const actions = {
  addRole: () => {
    const el = document.getElementById("newRole"); const n = el && el.value.trim(); if (!n) return;
    const maxSort = D().roles.length ? Math.max(...D().roles.map((r) => r.sortOrder || 0)) : 0;
    D().roles.push({
      id: uid(), name: n, groupId: D().groups[0] ? D().groups[0].id : "",
      usedAtDay: true, usedAtNight: true, hard: false, skillRestricted: false, essential: true, sortOrder: maxSort + 1
    });
    markStale(); touch();
    logAudit("ROLE_ADDED", n);
  },
  moveRole: (a) => {
    const ordered = rolesOrdered();
    const i = ordered.findIndex((r) => r.id === a.r); const j = i + (+a.n);
    if (j < 0 || j >= ordered.length) return;
    const aEss = ordered[i].essential !== false; const bEss = ordered[j].essential !== false;
    if (aEss !== bEss) return;
    /* First, renumber sortOrder 1..n following current display order */
    let n = 1;
    rolesOrdered().forEach((r) => { r.sortOrder = n++; });
    /* Then swap sortOrder values of the two roles */
    const t = ordered[i].sortOrder;
    ordered[i].sortOrder = ordered[j].sortOrder;
    ordered[j].sortOrder = t;
    touch();
  },
  askDelRole: (a) => {
    const r = roleById(a.r);
    askConfirm("Delete " + r.name + "?", "The role is removed for everyone and from the next roster.", "Delete", () => {
      removeRoleEverywhere(a.r);
      D().roles = D().roles.filter((x) => x.id !== a.r);
      /* Renumber remaining roles by their current display order */
      let n = 1;
      rolesOrdered().forEach((x) => { x.sortOrder = n++; });
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
    /* H73: one Files role, always non-essential. */
    if (key === "files" && v) { D().roles.forEach((x) => { if (x !== r) x.files = false; }); r.essential = false; }
    markStale();
  },
  gname: (v, ds) => { const g = D().groups.find((x) => x.id === ds.g); if (v.trim()) g.name = v.trim(); },
  gcolor: (v, ds) => { D().groups.find((x) => x.id === ds.g).color = v; }
};
