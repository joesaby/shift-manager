import { esc } from "./util.js";
import { S, setRenderer, loadLocal, wireFileInput, applyLoaded, tryLoadMockData, touch, setOnDataChanged } from "./state.js";
import { shell, vSelModal, vBulk, vConfirm, vNamePrompt } from "./ui-kit.js";
import { tryRestoreWorkspace, hasWorkspace, readWorkspaceData, writeWorkspaceData } from "./workspace.js";
import { logAudit } from "./audit.js";

import { vStart, actions as startActions, changes as startChanges } from "./screens/start.js";
import { vAtt, actions as attActions, changes as attChanges } from "./screens/attendance.js";
import { vRos, actions as rosActions } from "./screens/roster.js";
import { vPrt, actions as prtActions, changes as prtChanges } from "./screens/print.js";
import { vPpl, actions as pplActions, changes as pplChanges } from "./screens/people.js";
import { vSkills, actions as sklActions, changes as sklChanges } from "./screens/skills.js";
import { vRol, actions as rolActions, changes as rolChanges } from "./screens/roles.js";
import { vLog, actions as logActions } from "./screens/log.js";
import { vHist, actions as histActions, changes as histChanges } from "./screens/hist.js";
import { vStats, actions as statsActions } from "./screens/stats.js";
import { actions as appActions } from "./app-actions.js";

const SCREENS = { start: vStart, att: vAtt, ros: vRos, prt: vPrt, ppl: vPpl, skl: vSkills, rol: vRol, log: vLog, hist: vHist, stats: vStats };
const ACT = { ...appActions, ...startActions, ...attActions, ...rosActions, ...prtActions, ...sklActions, ...rolActions, ...logActions, ...histActions, ...statsActions, ...pplActions };
const CHANGES = { ...startChanges, ...attChanges, ...pplChanges, ...sklChanges, ...rolChanges, ...histChanges, ...prtChanges };

function render() {
  if (S.ui.screen === "help" || !SCREENS[S.ui.screen]) S.ui.screen = "start";
  const active = document.activeElement;
  const keep = active && active.id;
  const keepStart = keep && typeof active.selectionStart === "number" ? active.selectionStart : null;
  const keepEnd = keep && typeof active.selectionEnd === "number" ? active.selectionEnd : null;
  document.getElementById("app").innerHTML = shell(SCREENS[S.ui.screen]()) + vSelModal() + vBulk() + vConfirm() + vNamePrompt() +
    (S.ui.toast ? `<div class="toast toast-end print:hidden"><div class="alert alert-success"><span>${esc(S.ui.toast)}</span></div></div>` : "");
  if (keep) {
    const el = document.getElementById(keep);
    if (el) {
      el.focus();
      if (keepStart != null && typeof el.setSelectionRange === "function") {
        try { el.setSelectionRange(keepStart, keepEnd != null ? keepEnd : keepStart); } catch (e) { /* ignore */ }
      }
    }
  }
}
setRenderer(render);

function syncSaveStatus() {
  const el = document.getElementById("saveStatus");
  if (!el) return;
  el.className = S.dirty ? "badge badge-warning gap-1" : "badge badge-ghost";
  el.textContent = S.dirty ? "Unsaved changes" : "All changes saved";
}

function syncUnitLabels(raw) {
  const n = String(raw || "").trim();
  const nav = document.getElementById("navUnitLabel");
  if (nav) nav.textContent = n || "Duty rota";
  const badge = document.getElementById("navUnitBadge");
  if (badge) {
    if (n) {
      badge.textContent = n;
      badge.style.display = "";
      badge.classList.remove("hidden");
      badge.classList.add("sm:inline-flex");
    } else {
      badge.textContent = "";
      badge.style.display = "none";
    }
  }
  const showing = document.getElementById("unitShowingAs");
  if (showing) {
    showing.innerHTML = n
      ? `Showing as <b>${esc(n)}</b> on roster and print.`
      : `Set a unit name so printed rotas show which station this is.`;
  }
}

function isLiveTypingTarget(el) {
  if (!el || !el.getAttribute) return false;
  const id = el.id;
  if (id === "unitName" || id === "peopleSearch" || id === "newPerson" || id === "newRole") return true;
  const ch = el.dataset && el.dataset.ch;
  return ch === "unitName" || ch === "pname" || ch === "peopleQ";
}

/* Every data mutation goes through touch() in state.js; when a workspace folder is
   connected, debounce writes to it so rapid edits (typing a name, ticking boxes)
   become one file write and one audit line, not one per keystroke. */
let saveTimer = null;
setOnDataChanged(() => {
  if (!hasWorkspace()) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const ok = await writeWorkspaceData(JSON.stringify(S.data, null, 2));
    if (!ok) return;
    S.dirty = false;
    logAudit("DATA_SAVED", "workspace autosave");
    /* Do not remount while the manager is typing — that steals the caret. */
    if (isLiveTypingTarget(document.activeElement)) syncSaveStatus();
    else render();
  }, 800);
});

document.addEventListener("click", (e) => {
  if (S.ui.peoplePickerOpen) {
    const inside = e.target.closest("#peopleSearch, #peoplePickerList, [data-act='togglePeoplePicker']");
    if (!inside) {
      S.ui.peoplePickerOpen = false;
      S.ui.peopleQ = "";
      const elOutside = e.target.closest("[data-act]");
      if (!elOutside || elOutside.disabled) { render(); return; }
    }
  }
  const el = e.target.closest("[data-act]"); if (!el || el.disabled) return;
  const f = ACT[el.dataset.act]; if (!f) return;
  e.preventDefault();
  const result = f(el.dataset);
  render();
  if (result && typeof result.then === "function") result.then(() => render());
});

document.addEventListener("change", (e) => {
  const el = e.target; const k = el.dataset && el.dataset.ch; if (!k) return;
  const v = el.type === "checkbox" ? el.checked : el.value; const ds = el.dataset;
  const fn = CHANGES[k]; if (fn) fn(v, ds);
  const uiOnly = k === "peopleQ" || k === "peopleFilter" || k === "selPerson";
  if (!uiOnly) touch();
  render();
});

document.addEventListener("input", (e) => {
  const el = e.target; const k = el.dataset && el.dataset.ch;
  if (k === "peopleQ") {
    CHANGES.peopleQ(el.value, el.dataset);
    render();
    return;
  }
  if (k === "unitName") {
    /* Keep focus: update data + persist, refresh labels without remounting. */
    CHANGES.unitName(el.value, el.dataset);
    touch();
    syncSaveStatus();
    syncUnitLabels(el.value);
  }
  if (k === "pname") {
    CHANGES.pname(el.value, el.dataset);
    touch();
    syncSaveStatus();
  }
});

document.addEventListener("focusin", (e) => {
  if (e.target && e.target.id === "peopleSearch" && !S.ui.peoplePickerOpen) {
    S.ui.peoplePickerOpen = true;
    render();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.id === "newPerson") { ACT.addPerson(); render(); }
  if (e.key === "Enter" && e.target.id === "newRole") { ACT.addRole(); render(); }
  if (e.key === "Enter" && e.target.id === "sessionUserInput") { ACT.submitSessionUser(); }
  if (e.key === "Escape" && S.ui.peoplePickerOpen) {
    S.ui.peoplePickerOpen = false; S.ui.peopleQ = ""; render(); return;
  }
  if (e.key === "Escape" && (S.ui.sel || S.ui.confirm || S.ui.bulk)) { S.ui.sel = null; S.ui.confirm = null; S.ui.bulk = null; render(); }
});

window.addEventListener("beforeunload", (e) => { if (S.dirty) { e.preventDefault(); e.returnValue = ""; } });

async function boot() {
  wireFileInput();

  const ws = await tryRestoreWorkspace();
  if (ws === "granted") {
    S.ui.wsStatus = "connected";
    const text = await readWorkspaceData();
    if (text) {
      applyLoaded(text, null, "workspace data file");
      render();
      return;
    }
  } else if (ws === "prompt") {
    S.ui.wsStatus = "reconnect";
  } else {
    S.ui.wsStatus = "none";
  }

  /* Demo mock only if this browser has no saved data yet. */
  if (await tryLoadMockData()) {
    S.dirty = false;
    render();
    return;
  }

  if (loadLocal()) S.dirty = false;
  render();
}
boot();
