import { esc, uid } from "../util.js";
import { S } from "../state.js";
import {
  D, personById, roleById, groupById, qual, qualCount, setQual,
  removePersonEverywhere, markStale, personLoadByMonth, currentMonthKey, monthLabel, personRoleIds
} from "../model.js";
import { ph } from "../ui-kit.js";
import { touch, askConfirm } from "../state.js";
import { logAudit } from "../audit.js";

function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function surname(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "";
}

function skillCount(p) {
  return personRoleIds(p.id).filter((rid) => {
    const r = roleById(rid);
    return r && r.skillRestricted;
  }).length;
}

function filteredPeople() {
  const q = (S.ui.peopleQ || "").trim().toLowerCase();
  const f = S.ui.peopleFilter || "all";
  return D().people
    .slice()
    .sort((a, b) => surname(a.name).localeCompare(surname(b.name), "en-IE") || a.name.localeCompare(b.name, "en-IE"))
    .filter((p) => {
      if (q) {
        const hay = [
          p.name,
          p.employeeNo || "",
          p.shoulderNo || ""
        ].join(" ").toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      if (f === "active") return p.active !== false;
      if (f === "inactive") return p.active === false;
      if (f === "fixed") return !!p.fixedRoleId;
      if (f === "skills") return skillCount(p) > 0;
      return true;
    });
}

function personMeta(p) {
  const bits = [];
  if (p.active === false) bits.push("Inactive");
  if (p.fixedRoleId) {
    const r = roleById(p.fixedRoleId);
    bits.push("Only " + ((r && r.name) || "?"));
  }
  const skills = skillCount(p);
  if (skills) bits.push(skills + " skill" + (skills === 1 ? "" : "s"));
  else bits.push(qualCount(p) + " role" + (qualCount(p) === 1 ? "" : "s"));
  return bits.join(" · ");
}

export function vPpl() {
  const all = D().people;
  const nActive = all.filter((p) => p.active !== false).length;
  const nInactive = all.length - nActive;
  const nFixed = all.filter((p) => p.fixedRoleId).length;
  const nSkills = all.filter((p) => skillCount(p) > 0).length;
  const list = filteredPeople();
  let sel = personById(S.ui.selPerson);
  if (!sel) sel = all[0] || null;
  if (sel) S.ui.selPerson = sel.id;

  const filter = S.ui.peopleFilter || "all";
  const chip = (id, label, count) =>
    `<button type="button" class="btn btn-xs ${filter === id ? "btn-primary" : "btn-ghost"}" data-act="peopleFilter" data-f="${id}">${label}${count != null ? ` · ${count}` : ""}</button>`;

  const open = !!S.ui.peoplePickerOpen;
  const q = S.ui.peopleQ || "";
  const rows = list.map((p) => {
    const isSel = sel && p.id === sel.id;
    return `<li>
      <button type="button" data-act="selPerson" data-p="${p.id}" class="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-base-200 ${isSel ? "bg-base-200" : ""}">
        <span class="flex items-center justify-center bg-neutral text-neutral-content rounded-full w-8 h-8 text-[10px] font-semibold shrink-0">${esc(initials(p.name))}</span>
        <span class="min-w-0 flex-1">
          <span class="block font-medium truncate">${esc(p.name)}</span>
          <span class="block text-xs opacity-60 truncate">${esc(personMeta(p))}</span>
        </span>
        ${isSel ? '<span class="text-primary text-sm shrink-0">✓</span>' : ""}
      </button>
    </li>`;
  }).join("");

  const picker = `<div class="card bg-base-100 shadow-sm border border-base-300">
    <div class="card-body gap-3 py-4">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div class="form-control flex-1 min-w-[16rem] max-w-lg relative">
          <span class="label-text font-semibold mb-1">Person</span>
          <div class="join w-full">
            <input id="peopleSearch" type="search" class="input input-bordered join-item w-full"
              placeholder="${sel ? "Search names or numbers…" : "Search or pick a person…"}"
              value="${esc(q)}" data-ch="peopleQ" autocomplete="off"
              aria-expanded="${open ? "true" : "false"}" aria-controls="peoplePickerList">
            <button type="button" class="btn btn-outline join-item" data-act="togglePeoplePicker" title="Show people" aria-label="Show people">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
            </button>
          </div>
          ${open ? `<ul id="peoplePickerList" class="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-box border border-base-300 bg-base-100 shadow-lg list-none m-0 p-0">
            ${rows || '<li class="px-3 py-3 text-sm opacity-70">No people match.</li>'}
          </ul>` : ""}
        </div>
        <div class="text-sm opacity-60 pb-3">${all.length} total · ${nActive} active${sel ? ` · viewing <b class="opacity-90">${esc(sel.name)}</b>` : ""}</div>
      </div>
      <div class="flex flex-wrap gap-1">
        ${chip("all", "All", all.length)}
        ${chip("active", "Active", nActive)}
        ${chip("inactive", "Inactive", nInactive)}
        ${chip("fixed", "Fixed", nFixed)}
        ${chip("skills", "Skills", nSkills)}
      </div>
    </div>
  </div>`;

  let detail = `<div class="card bg-base-100 shadow-sm border border-base-300"><div class="card-body"><div class="opacity-70">Add a person to begin.</div></div></div>`;
  if (sel) {
    const tog = D().roles.map((r) => {
      const on = qual(sel, r.id);
      return `<label class="flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer" style="background:${on ? groupById(r.groupId).color : "#fff"}"><input type="checkbox" class="checkbox checkbox-sm" ${on ? "checked" : ""} data-ch="qual" data-p="${sel.id}" data-r="${r.id}"><span class="flex-1 text-sm">${esc(r.name)}</span>${r.skillRestricted ? '<span class="badge badge-sm badge-warning">Skill</span>' : ""}</label>`;
    }).join("");
    const onlyOpts = `<option value="">None (any role they are ticked for)</option>` + D().roles.filter((r) => qual(sel, r.id)).map((r) => `<option value="${r.id}"${sel.fixedRoleId === r.id ? " selected" : ""}>${esc(r.name)}</option>`).join("");
    const curKey = currentMonthKey();
    let load = null;
    try { load = personLoadByMonth(sel.id, { month: curKey })[0]; } catch (e) { /* ignore */ }
    const loadBlock = `<div class="border-t border-base-300 pt-5">
      <div class="font-semibold">This month’s load</div>
      <div class="text-sm opacity-70 mb-2">${esc(monthLabel(curKey))} — duties from the current roster and log. Full team history is on <a class="link link-primary" data-act="nav" data-s="stats">Duty stats</a>.</div>
      ${load && load.duties
        ? `<div class="overflow-x-auto"><table class="table table-sm"><thead><tr><th>Duties</th><th class="text-center">Day</th><th class="text-center">Night</th><th class="text-center">Hard</th><th class="text-center">Skill</th><th>Duty type</th><th>Top roles</th></tr></thead>
            <tbody><tr>
              <td class="font-medium">${load.duties}</td>
              <td class="text-center">${load.day || 0}</td>
              <td class="text-center">${load.night || 0}</td>
              <td class="text-center">${load.hard}</td>
              <td class="text-center">${load.skill}</td>
              <td class="text-sm">${(load.groups || []).map((g) => esc(g.name) + " ×" + g.n).join(", ") || "—"}</td>
              <td class="text-sm opacity-80">${load.roles.slice(0, 5).map((r) => esc(r.name) + " ×" + r.n).join(", ") || "—"}</td>
            </tr></tbody></table></div>`
        : `<div class="text-sm opacity-70">No duties this month yet for this person.</div>`}
    </div>`;
    detail = `<div class="card bg-base-100 shadow-sm border border-base-300"><div class="card-body space-y-5">
      <div class="flex items-center gap-3">
        <span class="avatar placeholder"><span class="bg-neutral text-neutral-content rounded-full w-12 text-sm font-semibold">${esc(initials(sel.name))}</span></span>
        <div>
          <div class="font-semibold text-lg leading-tight">${esc(sel.name)}</div>
          <div class="text-xs opacity-60">${sel.active !== false ? "Active" : "Inactive"} · ${qualCount(sel)} roles · ${skillCount(sel)} skills</div>
        </div>
      </div>
      <div class="flex flex-wrap gap-3 items-end">
        <label class="form-control flex-1 max-w-sm"><span class="label-text font-semibold">Name</span><input class="input input-bordered" value="${esc(sel.name)}" data-ch="pname" data-p="${sel.id}"></label>
        <label class="form-control ppl-emp"><span class="label-text font-semibold">Employee no.</span><input class="input input-bordered" value="${esc(sel.employeeNo || "")}" data-ch="pemp" data-p="${sel.id}" inputmode="numeric" autocomplete="off"></label>
        <label class="form-control ppl-shldr"><span class="label-text font-semibold">Shoulder no.</span><input class="input input-bordered" value="${esc(sel.shoulderNo || "")}" data-ch="pshldr" data-p="${sel.id}" inputmode="numeric" autocomplete="off"></label>
      </div>
      <label class="flex items-center gap-3"><input type="checkbox" class="toggle toggle-primary" ${sel.active !== false ? "checked" : ""} data-ch="pactive" data-p="${sel.id}"><span>Active (untick when someone leaves or is away long term)</span></label>
      <div><div class="font-semibold">Roles this person is qualified for</div><div class="text-sm opacity-70 mb-2">Only ticked roles are ever offered to them. Skill roles also appear on the Skills screen.</div>
        ${D().roles.length ? `<div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">${tog}</div>` : `<div class="alert">Add roles first on the Roles and groups screen.</div>`}</div>
      <label class="form-control max-w-sm"><span class="label-text font-semibold">Only do this role</span><span class="label-text-alt opacity-70 mb-1">If set, they always get this role when present.</span><select class="select select-bordered" data-ch="ponly" data-p="${sel.id}">${onlyOpts}</select></label>
      ${loadBlock}
      <button class="btn btn-sm btn-outline btn-error" data-act="askDelPerson" data-p="${sel.id}">Delete this person</button>
    </div></div>`;
  }

  return `${ph("People", "Who is on the team, what each person can do, and whether they only do one role.", '<input id="newPerson" class="input input-bordered w-44" placeholder="Name"><button class="btn btn-primary" data-act="addPerson">Add person</button><button class="btn btn-outline" data-act="bulk" data-k="people">Paste many</button>')}
    <div class="space-y-4">${picker}${detail}</div>`;
}

export const actions = {
  togglePeoplePicker: () => { S.ui.peoplePickerOpen = !S.ui.peoplePickerOpen; if (!S.ui.peoplePickerOpen) S.ui.peopleQ = ""; },
  peopleFilter: (a) => { S.ui.peopleFilter = a.f || "all"; S.ui.peoplePickerOpen = true; },
  selPerson: (a) => {
    S.ui.selPerson = a.p;
    S.ui.peopleQ = "";
    S.ui.peoplePickerOpen = false;
  },
  addPerson: () => {
    const el = document.getElementById("newPerson"); const n = el && el.value.trim(); if (!n) return;
    const p = { id: uid(), name: n, active: true, fixedRoleId: null, employeeNo: "", shoulderNo: "" };
    D().people.push(p); S.ui.selPerson = p.id; markStale(); touch();
    logAudit("PERSON_ADDED", n);
  },
  askDelPerson: (a) => {
    const p = personById(a.p);
    askConfirm("Delete " + p.name + "?", "They are removed from the team. Saved rotas in the log keep their name.", "Delete", () => {
      removePersonEverywhere(a.p);
      D().people = D().people.filter((x) => x.id !== a.p); S.ui.selPerson = null; markStale(); touch();
      logAudit("PERSON_DELETED", p.name);
    });
  }
};

export const changes = {
  peopleQ: (v) => { S.ui.peopleQ = v; S.ui.peoplePickerOpen = true; },
  qual: (v, ds) => { setQual(ds.p, ds.r, v); markStale(); },
  ponly: (v, ds) => { personById(ds.p).fixedRoleId = v || null; markStale(); },
  pname: (v, ds) => { if (v.trim()) personById(ds.p).name = v.trim(); },
  pemp: (v, ds) => { personById(ds.p).employeeNo = String(v || ""); },
  pshldr: (v, ds) => { personById(ds.p).shoulderNo = String(v || ""); },
  pactive: (v, ds) => { personById(ds.p).active = v; markStale(); }
};
