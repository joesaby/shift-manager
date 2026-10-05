import { esc, uid } from "../util.js";
import { D, roleById, roleColor, DEFAULT_ROLE_COLOR, removeRoleEverywhere, markStale, rolesInListOrder } from "../model.js";
import { ph } from "../ui-kit.js";
import { S, touch, toast, askConfirm } from "../state.js";
import { logAudit } from "../audit.js";

const FIELD_MAP = { name: "name", group: "groupId", day: "usedAtDay", night: "usedAtNight", hard: "hard", essential: "essential", once: "oncePerBlock", files: "files" };

const rolesOrdered = rolesInListOrder;

export function vRol() {
  const gopts = (sel) => D().groups.map((g) => `<option value="${g.id}"${g.id === sel ? " selected" : ""}>${esc(g.name)}</option>`).join("");
  const pgopts = (sel) => `<option value="">None</option>` + (D().probationerGroups || []).map((g) => `<option value="${g.id}"${g.id === sel ? " selected" : ""}>${esc(g.name)}</option>`).join("");
  const ordered = rolesOrdered();
  const rows = ordered.map((r, i) => {
    const sameBand = (j) => ordered[j] && ((ordered[j].essential !== false) === (r.essential !== false));
    const upOk = i > 0 && sameBand(i - 1);
    const downOk = i < ordered.length - 1 && sameBand(i + 1);
    return `<tr data-role-row="${r.id}"><td class="whitespace-nowrap"><div class="flex items-center gap-2"><input type="color" class="w-10 h-9 rounded border" value="${roleColor(r)}" data-ch="rcolor" data-r="${r.id}" title="Print colour" aria-label="Colour for ${esc(r.name)}"><input class="input input-bordered input-sm w-48" value="${esc(r.name)}" data-ch="rf" data-r="${r.id}" data-f="name"></div></td>
    <td><select class="select select-bordered select-sm" data-ch="rf" data-r="${r.id}" data-f="group">${gopts(r.groupId)}</select></td>
    <td><select class="select select-bordered select-sm" data-ch="rf" data-r="${r.id}" data-f="probgroup" title="Probationers are kept apart within a probationer group">${pgopts(r.probGroupId)}</select></td>
    <td class="text-center"><input type="checkbox" class="checkbox checkbox-sm" ${r.essential !== false ? "checked" : ""}${r.files ? " disabled" : ""} data-ch="rf" data-r="${r.id}" data-f="essential" title="${r.files ? "The Files role is never essential" : "Must be filled"}"></td>
    <td class="text-center"><input type="checkbox" class="checkbox checkbox-sm" ${r.usedAtDay !== false ? "checked" : ""} data-ch="rf" data-r="${r.id}" data-f="day"></td>
    <td class="text-center"><input type="checkbox" class="checkbox checkbox-sm" ${r.usedAtNight ? "checked" : ""} data-ch="rf" data-r="${r.id}" data-f="night"></td>
    <td class="text-center"><input type="checkbox" class="checkbox checkbox-sm" ${r.hard ? "checked" : ""} data-ch="rf" data-r="${r.id}" data-f="hard"></td>
    <td class="text-center"><input type="checkbox" class="checkbox checkbox-sm" ${r.oncePerBlock ? "checked" : ""} data-ch="rf" data-r="${r.id}" data-f="once" title="Same person never gets this role twice in a block"></td>
    <td class="text-center"><input type="checkbox" class="checkbox checkbox-sm" ${r.files ? "checked" : ""} data-ch="rf" data-r="${r.id}" data-f="files" title="Takes everyone still free after the other roles; any number per day"></td>
    <td class="whitespace-nowrap"><button class="btn btn-xs" data-act="moveRole" data-r="${r.id}" data-n="-1" ${upOk ? "" : "disabled"} aria-label="Move up">Up</button> <button class="btn btn-xs" data-act="moveRole" data-r="${r.id}" data-n="1" ${downOk ? "" : "disabled"} aria-label="Move down">Down</button> <button class="btn btn-xs btn-outline btn-error" data-act="askDelRole" data-r="${r.id}">Delete</button></td></tr>`;
  }).join("");
  const grps = D().groups.map((g) => `<div class="flex items-center gap-2"><input class="input input-bordered input-sm" value="${esc(g.name)}" data-ch="gname" data-g="${g.id}"><label class="flex items-center gap-1 text-sm"><input type="checkbox" class="checkbox checkbox-sm" ${g.oncePerBlock ? "checked" : ""} data-ch="gonce" data-g="${g.id}" title="Same person at most one day per block on any role in this group">Once per block</label><button class="btn btn-xs btn-outline btn-error" data-act="delGroup" data-g="${g.id}">Delete</button></div>`).join("");
  const pgrps = (D().probationerGroups || []).map((g) => `<div class="flex items-center gap-2"><input class="input input-bordered input-sm" value="${esc(g.name)}" data-ch="pgname" data-pg="${g.id}"><button class="btn btn-xs btn-outline btn-error" data-act="delProbGroup" data-pg="${g.id}">Delete</button></div>`).join("");
  return `${ph("Roles and groups", "Essential roles must be filled. Unticked roles are for spare people (filled after essentials, in this list order).", '<input id="newRole" class="input input-bordered w-44" placeholder="Role name"><button class="btn btn-primary" data-act="addRole">Add role</button><button class="btn btn-outline" data-act="bulk" data-k="roles">Paste many</button>')}
   <div class="card bg-base-100 shadow-sm border border-base-300 overflow-x-auto"><table class="table table-sm"><thead><tr><th>Role</th><th>Group</th><th>Probationer group</th><th class="text-center">Essential</th><th class="text-center">Used by day</th><th class="text-center">Used at night</th><th class="text-center">Hard role</th><th class="text-center">Once per block</th><th class="text-center">Files role</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="10" class="opacity-70">No roles yet.</td></tr>'}</tbody></table></div>
   <div class="text-sm text-base-content/70"><b>Essential</b>: must be filled (warnings if empty). Unticked roles are optional work, filled from whoever is left in this list order (Up / Down). <b>Hard role</b>: not given on back-to-back nights. <b>Once per block</b> (role): a person never gets that role twice in a block; tick it on a group (below) to cover every role in the group. Nobody gets a role from the same group two days running. Colours are set per role. Untick <b>Used by day</b> or <b>Used at night</b> to make a role only available on the other shift. <b>Files role</b> (one role only, never essential): once the other roles are filled, everyone still free gets it — any number a day — and who ends up spare is rotated. Tick Files for people on <b>People</b> (Select all). Who can do each role is ticked on People.</div>
   <div class="card bg-base-100 shadow-sm border border-base-300"><div class="card-body"><h2 class="card-title">Groups</h2><div class="space-y-2">${grps}</div>
    <div class="flex gap-2 mt-2"><input id="newGroup" class="input input-bordered input-sm" placeholder="New group name"><button class="btn btn-sm btn-primary" data-act="addGroup">Add group</button></div></div></div>
   <div class="card bg-base-100 shadow-sm border border-base-300"><div class="card-body"><h2 class="card-title">Probationer groups</h2><p class="text-sm text-base-content/70">Two people ticked <b>Probationer</b> are not put in the same probationer group on the same day. Choose each role's probationer group in the table above; roles in no probationer group are not restricted.</p><div class="space-y-2">${pgrps || '<div class="opacity-70 text-sm">No probationer groups yet.</div>'}</div>
    <div class="flex gap-2 mt-2"><input id="newProbGroup" class="input input-bordered input-sm" placeholder="New probationer group name"><button class="btn btn-sm btn-primary" data-act="addProbGroup">Add probationer group</button></div></div></div>`;
}

export const actions = {
  addRole: () => {
    const el = document.getElementById("newRole"); const n = el && el.value.trim(); if (!n) return;
    const maxSort = D().roles.length ? Math.max(...D().roles.map((r) => r.sortOrder || 0)) : 0;
    D().roles.push({
      id: uid(), name: n, groupId: D().groups[0] ? D().groups[0].id : "", color: DEFAULT_ROLE_COLOR,
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
    S.ui.movedRole = a.r;
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
    D().groups.push({ id: uid(), name: n, oncePerBlock: false, sortOrder: D().groups.length + 1 });
    touch();
  },
  delGroup: (a) => {
    if (D().roles.some((r) => r.groupId === a.g)) { toast("Move its roles to another group first."); return; }
    D().groups = D().groups.filter((g) => g.id !== a.g); touch();
  },
  addProbGroup: () => {
    const el = document.getElementById("newProbGroup"); const n = el && el.value.trim(); if (!n) return;
    const pgs = D().probationerGroups || (D().probationerGroups = []);
    pgs.push({ id: uid(), name: n, sortOrder: pgs.length + 1 });
    markStale(); touch();
  },
  delProbGroup: (a) => {
    D().roles.forEach((r) => { if (r.probGroupId === a.pg) r.probGroupId = ""; });
    D().probationerGroups = (D().probationerGroups || []).filter((g) => g.id !== a.pg);
    markStale(); touch();
  }
};

export const changes = {
  rf: (v, ds) => {
    const r = roleById(ds.r);
    const key = FIELD_MAP[ds.f] || ds.f;
    if (key === "name") { if (v.trim()) r.name = v.trim(); }
    else if (ds.f === "probgroup") r.probGroupId = v;
    else r[key] = v;
    /* H73: one Files role, always non-essential. */
    if (key === "files" && v) { D().roles.forEach((x) => { if (x !== r) x.files = false; }); r.essential = false; }
    if (key === "essential" || key === "files") S.ui.movedRole = r.id;
    markStale();
  },
  gname: (v, ds) => { const g = D().groups.find((x) => x.id === ds.g); if (v.trim()) g.name = v.trim(); },
  gonce: (v, ds) => { D().groups.find((x) => x.id === ds.g).oncePerBlock = !!v; markStale(); },
  pgname: (v, ds) => { const g = D().probationerGroups.find((x) => x.id === ds.pg); if (v.trim()) g.name = v.trim(); },
  rcolor: (v, ds) => { roleById(ds.r).color = v; }
};
