import { esc, NAV, icon } from "./util.js";
import { S } from "./state.js";
import { activePeople, canDo, isPresent, roleOfPerson, roleById, personById, dayLabels, hasRoster, rosterDays, unitName } from "./model.js";
import { supportsWorkspace, hasWorkspace, workspaceName } from "./workspace.js";
import { LOGO_DATA_URI } from "../assets/logo.js";
import { getSessionUser } from "./audit.js";

export const ph = (title, sub, actions) => `<div class="flex flex-wrap items-end justify-between gap-3 print:hidden"><div><h1 class="text-2xl font-bold tracking-tight">${title}</h1>${sub ? `<p class="text-base-content/70 mt-1">${sub}</p>` : ""}</div>${actions ? `<div class="flex flex-wrap items-end gap-2">${actions}</div>` : ""}</div>`;

export const noPeople = () => `<div role="alert" class="alert alert-info"><span>Add your people and roles first.</span><button class="btn btn-sm" data-act="nav" data-s="start">Home</button></div>`;

/** Unit line for roster / attendance page headers (screen only). */
export function unitBanner() {
  const u = unitName();
  if (u) return `<div class="text-sm font-semibold tracking-tight">${esc(u)}</div>`;
  return `<div class="text-sm opacity-60">No unit name set — add it on <a class="link link-primary" data-act="nav" data-s="start">Home</a>.</div>`;
}

function fileControls() {
  if (hasWorkspace()) {
    return `<span class="badge badge-ghost gap-1" title="Data and audit logs are saved here">${esc(workspaceName())}</span><button class="btn btn-sm btn-ghost" data-act="changeFolder">Change folder</button>`;
  }
  if (S.ui.wsStatus === "reconnect") {
    return `<button class="btn btn-sm btn-warning" data-act="reconnectFolder">Reconnect folder</button><button class="btn btn-sm btn-ghost" data-act="open">Open file</button>`;
  }
  const chooseBtn = supportsWorkspace() ? `<button class="btn btn-sm btn-outline" data-act="chooseFolder">Choose folder</button>` : "";
  return `${chooseBtn}<button class="btn btn-sm btn-ghost" data-act="open">Open file</button><button class="btn btn-sm btn-primary" data-act="save">Save file</button>`;
}

export function shell(inner) {
  const unit = unitName();
  const menu = NAV.map((n) => (n[2] ? `<li class="menu-title mt-4">${n[2]}</li>` : "") + `<li><a data-act="nav" data-s="${n[0]}" class="gap-3 ${S.ui.screen === n[0] ? "active" : ""}">${icon(n[0])}${n[1]}</a></li>`).join("");
  return `<div class="drawer lg:drawer-open">
   <input id="navToggle" type="checkbox" class="drawer-toggle">
   <div class="drawer-content flex flex-col min-w-0">
    <div class="navbar bg-base-100 border-b border-base-300 px-4 sticky top-0 z-30 print:hidden">
     <div class="flex-none lg:hidden"><label for="navToggle" class="btn btn-square btn-ghost" aria-label="Open menu"><svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg></label></div>
     <div class="flex-1 gap-2">${S.dirty ? '<span id="saveStatus" class="badge badge-warning gap-1">Unsaved changes</span>' : '<span id="saveStatus" class="badge badge-ghost">All changes saved</span>'}${unit ? `<span id="navUnitBadge" class="badge badge-ghost hidden sm:inline-flex">${esc(unit)}</span>` : '<span id="navUnitBadge" class="badge badge-ghost hidden sm:inline-flex" style="display:none"></span>'}</div>
     <div class="flex-none flex gap-2">${fileControls()}</div>
    </div>
    <main class="p-4 md:p-8 space-y-6 max-w-7xl w-full mx-auto">${inner}</main>
   </div>
   <div class="drawer-side z-40 print:hidden">
    <label for="navToggle" class="drawer-overlay" aria-label="Close menu"></label>
    <aside class="bg-base-100 border-r border-base-300 w-64 min-h-full flex flex-col">
     <div class="flex items-center gap-3 px-5 py-5"><img src="${LOGO_DATA_URI}" alt="An Garda Síochána" class="w-10 h-10 object-contain" width="40" height="40"><div><div class="font-bold leading-tight">Shift Manager</div><div id="navUnitLabel" class="text-xs text-base-content/60">${unit ? esc(unit) : "Duty rota"}</div></div></div>
     <ul class="menu px-3 pb-6 w-full gap-1">${menu}</ul></aside></div></div>`;
}

export function vSelModal() {
  const sel = S.ui.sel; const ros = rosterDays(); if (!sel || !hasRoster() || !ros) return "";
  const day = ros[sel.d]; const role = roleById(sel.r); if (!role) return "";
  const holderId = day.assign[sel.r]; const holder = holderId ? personById(holderId) : null;
  const present = activePeople().filter((p) => isPresent(p, sel.d));
  const elig = present.filter((p) => canDo(p, sel.r) && p.id !== holderId);
  const items = elig.map((p) => {
    const r2 = roleOfPerson(day, p.id); const r2n = r2 ? (roleById(r2) || { name: "" }).name : "";
    let blocked = false, sub = r2 ? "Currently " + r2n : "Currently spare";
    if (r2 && holder) {
      if (!canDo(holder, r2)) { blocked = true; sub = holder.name + " could not cover " + r2n; } else sub = "Swap: " + holder.name + " takes " + r2n;
    }
    return `<li><button class="${blocked ? "opacity-50" : ""}" ${blocked ? "disabled" : ""} data-act="assign" data-d="${sel.d}" data-r="${sel.r}" data-p="${p.id}"><span class="font-medium">${esc(p.name)}</span><span class="text-xs ${blocked ? "text-error" : "opacity-70"}">${esc(sub)}</span></button></li>`;
  }).join("");
  const hidden = present.length - elig.length - (holder ? 1 : 0);
  return `<dialog class="modal modal-open"><div class="modal-box">
    <div class="text-sm opacity-70">${esc(fmtDay(sel.d))}</div>
    <h3 class="text-lg font-semibold">${esc(role.name)}</h3><div class="text-sm mb-3">Now: <b>${holder ? esc(holder.name) : "Unfilled"}</b></div>
    <div class="text-xs font-semibold uppercase opacity-60 mb-1">Qualified and present</div>
    ${items ? `<ul class="menu bg-base-200 rounded-box [&_button]:flex [&_button]:flex-col [&_button]:items-start [&_button]:gap-0">${items}</ul>` : `<div class="text-error text-sm">Nobody else present is qualified for this role.</div>`}
    <p class="text-xs opacity-70 mt-3">${hidden} present ${hidden === 1 ? "person is" : "people are"} hidden because they are not qualified for this role.</p>
    <div class="modal-action"><button class="btn btn-outline" data-act="assign" data-d="${sel.d}" data-r="${sel.r}" data-p="">Leave unfilled</button><button class="btn" data-act="closeSel">Close</button></div></div>
    <div class="modal-backdrop" data-act="closeSel"></div></dialog>`;
}
function fmtDay(d) { const dl = dayLabels()[d]; return `${dl.label}, ${dl.shift.toLowerCase()} shift`; }

export function vBulk() {
  const b = S.ui.bulk; if (!b) return "";
  const what = b.k === "people" ? "names, one per line" : "role names, one per line";
  return `<dialog class="modal modal-open"><div class="modal-box"><h3 class="text-lg font-semibold">Paste many</h3><p class="text-sm opacity-70 mb-2">Paste ${what}. Blank lines are ignored.</p>
   <textarea id="bulkText" class="textarea textarea-bordered w-full h-56" placeholder="One per line"></textarea>
   <div class="modal-action"><button class="btn" data-act="closeBulk">Cancel</button><button class="btn btn-primary" data-act="doBulk">Add</button></div></div><div class="modal-backdrop" data-act="closeBulk"></div></dialog>`;
}

export function vConfirm() {
  const c = S.ui.confirm; if (!c) return "";
  return `<dialog class="modal modal-open"><div class="modal-box"><h3 class="text-lg font-semibold">${esc(c.title)}</h3><p class="py-3">${esc(c.text)}</p>
   <div class="modal-action"><button class="btn" data-act="closeConfirm">Cancel</button><button class="btn btn-error" data-act="doConfirm">${esc(c.ok)}</button></div></div><div class="modal-backdrop" data-act="closeConfirm"></div></dialog>`;
}

export function vNamePrompt() {
  if (!S.ui.namePrompt) return "";
  const current = getSessionUser() || "";
  const editing = S.ui.namePrompt.pending === "edit";
  return `<dialog class="modal modal-open"><div class="modal-box"><h3 class="text-lg font-semibold">${editing ? "Update manager name" : "Who's using Shift Manager?"}</h3><p class="text-sm opacity-70 mb-2">Used in the audit log and on newly saved rotas. Changing it does not rewrite older log entries.</p>
   <input id="sessionUserInput" class="input input-bordered w-full" placeholder="Your name" value="${esc(current)}" autofocus>
   <div class="modal-action">${editing ? '<button class="btn" data-act="closeNamePrompt">Cancel</button>' : ""}<button class="btn btn-primary" data-act="submitSessionUser">${editing ? "Save name" : "Continue"}</button></div></div>${editing ? '<div class="modal-backdrop" data-act="closeNamePrompt"></div>' : ""}</dialog>`;
}
