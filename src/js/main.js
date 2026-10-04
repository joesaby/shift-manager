import { esc, revealDelta, edgeScrollSpeed } from "./util.js";
import { S, setRenderer, loadLocal, wireFileInput, applyLoaded, tryLoadMockData, touch, setOnDataChanged, toast } from "./state.js";
import { shell, vSelModal, vBulk, vConfirm, vNamePrompt, printBorders } from "./ui-kit.js";
import { tryRestoreWorkspace, hasWorkspace, readWorkspaceData, writeWorkspaceData } from "./workspace.js";
import { logAudit } from "./audit.js";
import { isRosterUnsaved, stampPrintTime } from "./snapshot.js";
import { swapPeople, assignParkedRole, canTakeParkedRole, canDropPersonOnPerson, adjacentPersonId } from "./generator.js";

import { vStart, actions as startActions, changes as startChanges } from "./screens/start.js";
import { vAtt, actions as attActions, changes as attChanges } from "./screens/attendance.js";
import { vRos, actions as rosActions, changes as rosChanges } from "./screens/roster.js";
import { actions as prtActions, changes as prtChanges } from "./screens/print.js";
import { vPpl, actions as pplActions, changes as pplChanges } from "./screens/people.js";
import { vRol, actions as rolActions, changes as rolChanges } from "./screens/roles.js";
import { vLog, actions as logActions } from "./screens/log.js";
import { vStats, actions as statsActions, changes as statsChanges } from "./screens/stats.js";
import { actions as appActions } from "./app-actions.js";
import { fitRosterColumns } from "./colfit.js";

const SCREENS = { start: vStart, att: vAtt, ros: vRos, prt: vRos, ppl: vPpl, rol: vRol, log: vLog, stats: vStats };
const ACT = { ...appActions, ...startActions, ...attActions, ...rosActions, ...prtActions, ...rolActions, ...logActions, ...statsActions, ...pplActions };
const CHANGES = { ...startChanges, ...attChanges, ...pplChanges, ...rolChanges, ...prtChanges, ...rosChanges, ...statsChanges };

/* Re-rendering replaces the whole screen, which resets scroll containers to the top. Keep the
   position of the tables (and the page) when the same screen is redrawn, e.g. after clicking a cell. */
let lastScreen = null;
const SCROLLERS = ".printScroll, .attScroll, .pivot-scroll";

function captureScroll() {
  const page = document.scrollingElement;
  return {
    y: page ? page.scrollTop : 0,
    els: Array.from(document.querySelectorAll(SCROLLERS)).map((el) => [el.scrollTop, el.scrollLeft])
  };
}

/* Roles rows that change place on redraw (Up / Down, Essential / Files role ticks) slide from where they
   were; the role just acted on (else the one that moved furthest) is briefly highlighted and brought into view. */
const MOVERS = "[data-role-row]";
function captureRows() {
  const m = {};
  document.querySelectorAll(MOVERS).forEach((el) => { m[el.dataset.roleRow] = el.getBoundingClientRect().top; });
  return m;
}
function animateRows(before) {
  const acted = S.ui.movedRole; S.ui.movedRole = null;
  if (!before || (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches)) return;
  let far = null; let farDy = 0; const moved = {};
  document.querySelectorAll(MOVERS).forEach((el) => {
    const was = before[el.dataset.roleRow]; if (was == null) return;
    const dy = was - el.getBoundingClientRect().top; if (Math.abs(dy) < 1) return;
    moved[el.dataset.roleRow] = el;
    if (el.animate) el.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], { duration: 350, easing: "ease-out" });
    if (Math.abs(dy) > Math.abs(farDy)) { far = el; farDy = dy; }
  });
  if (acted && moved[acted]) far = moved[acted];
  if (!far) return;
  far.classList.add("row-moved");
  const r = far.getBoundingClientRect();
  if (r.top < 0 || r.bottom > window.innerHeight) far.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function restoreScroll(pos) {
  document.querySelectorAll(SCROLLERS).forEach((el, i) => {
    if (pos.els[i]) { el.scrollTop = pos.els[i][0]; el.scrollLeft = pos.els[i][1]; }
  });
  if (document.scrollingElement) document.scrollingElement.scrollTop = pos.y;
}

/* Scroll the table's own container so `row` sits between the frozen header and the pinned tally
   footer (scrollIntoView ignores those, leaving the row hidden underneath). */
function revealRow(row) {
  const sc = row && row.closest(".printScroll");
  if (!sc) return;
  const head = sc.querySelector("thead"); const foot = sc.querySelector("tfoot");
  const c = sc.getBoundingClientRect(); const r = row.getBoundingClientRect();
  const hBar = sc.offsetHeight - sc.clientHeight; /* horizontal scrollbar, if any */
  sc.scrollTop += revealDelta(r.top, r.bottom, Math.max(c.top, 0) + (head ? head.offsetHeight : 0), Math.min(c.bottom, window.innerHeight) - hBar - (foot ? foot.offsetHeight : 0));
}

/* The redraw replaces every element, so a dropdown you just changed loses focus (Tab then restarts from
   the top of the page). Remember a form control by its data-* attributes and focus its twin afterwards. */
const FOCUS_ATTRS = ["ch", "act", "p", "d", "r", "l", "k"];
function focusSelector(el) {
  if (!el || !el.dataset || !/^(SELECT|INPUT|TEXTAREA)$/.test(el.tagName)) return null;
  if (el.dataset.ch === undefined && el.dataset.act === undefined) return null;
  return el.tagName.toLowerCase() + FOCUS_ATTRS.filter((k) => el.dataset[k] !== undefined)
    .map((k) => `[data-${k}="${CSS.escape(el.dataset[k])}"]`).join("");
}

function render() {
  if (S.ui.screen === "prt" || S.ui.screen === "ros") S.ui.screen = "ros";
  if (S.ui.screen === "hist") S.ui.screen = "log"; /* Historic roster was merged into Log (H24 → deprecated) */
  if (S.ui.screen === "skl") S.ui.screen = "ppl"; /* Skills screen retired (H23 → deprecated); ticks live on People */
  if (S.ui.screen === "help" || !SCREENS[S.ui.screen]) S.ui.screen = "start";
  const scroll = lastScreen === S.ui.screen ? captureScroll() : null;
  const rows = lastScreen === S.ui.screen ? captureRows() : null;
  const active = document.activeElement;
  const keep = active && active.id;
  const keepSel = keep ? null : focusSelector(active);
  const keepStart = keep && typeof active.selectionStart === "number" ? active.selectionStart : null;
  const keepEnd = keep && typeof active.selectionEnd === "number" ? active.selectionEnd : null;
  document.getElementById("app").innerHTML = shell(SCREENS[S.ui.screen]()) + vSelModal() + vBulk() + vConfirm() + vNamePrompt() +
    (S.ui.toast ? `<div class="toast toast-end print:hidden"><div class="alert alert-success"><span>${esc(S.ui.toast)}</span></div></div>` : "");
  fitRosterColumns(document.getElementById("app"));
  if (scroll) restoreScroll(scroll);
  animateRows(rows);
  if (keepSel) { const twin = document.querySelector(keepSel); if (twin) twin.focus({ preventScroll: true }); }
  lastScreen = S.ui.screen;
  document.body.classList.toggle("print-black-borders", printBorders());
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
  el.className = S.dirty ? "badge badge-unsaved gap-1" : "badge badge-ghost";
  el.textContent = S.dirty ? "Data file not saved" : "Data file saved";
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
  return ch === "unitName" || ch === "pname" || ch === "pemp" || ch === "pshldr" || ch === "peopleQ" || ch === "awayNote";
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
  if (S.ui.tallyOpen && !e.target.closest("#tallyMenu, [data-act='toggleTallyMenu']")) { S.ui.tallyOpen = false; render(); }
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

document.addEventListener("dragstart", (e) => {
  const roleChip = e.target.closest("[data-drag-role]");
  if (roleChip) {
    S.ui.dragRole = roleChip.dataset.dragRole;
    S.ui.dragDay = +roleChip.dataset.dragDay;
    S.ui.dragPid = null;
    e.dataTransfer.setData("text/plain", "role:" + S.ui.dragRole);
    e.dataTransfer.effectAllowed = "move";
    roleChip.classList.add("drag-source");
    /* Dim invalid person targets without remounting. */
    document.querySelectorAll("[data-drop-person]").forEach((el) => {
      const day = +el.dataset.dropDay;
      if (day !== S.ui.dragDay || !canTakeParkedRole(day, S.ui.dragRole, el.dataset.dropPerson)) {
        el.classList.add("drop-dim");
      }
    });
    return;
  }
  const handle = e.target.closest("[data-drag-person]");
  if (!handle) return;
  S.ui.dragPid = handle.dataset.dragPerson;
  S.ui.dragDay = +handle.dataset.dragDay;
  S.ui.dragRole = null;
  e.dataTransfer.setData("text/plain", S.ui.dragPid);
  e.dataTransfer.effectAllowed = "move";
  handle.classList.add("drag-source");
  /* Dim other days and anyone the swap would be refused for, without remounting. */
  document.querySelectorAll("[data-drop-person]").forEach((el) => {
    const day = +el.dataset.dropDay;
    if (el.dataset.dropPerson === S.ui.dragPid) return;
    if (day !== S.ui.dragDay || !canDropPersonOnPerson(day, S.ui.dragPid, el.dataset.dropPerson)) {
      el.classList.add("drop-dim");
    }
  });
});

/* Auto-scroll the roster while dragging. The browser's own edge-scroll never reaches the top
   because the frozen header covers it, so scroll the table ourselves while the pointer is near
   (or over) either end of its visible band. */
let dragY = null, dragX = null, dragTimer = null;
function edgeScrollTick() {
  const sc = document.querySelector(".printScroll");
  if (!sc || dragY == null) return;
  const c = sc.getBoundingClientRect();
  if (dragX < c.left || dragX > c.right) return;
  const head = sc.querySelector("thead"); const foot = sc.querySelector("tfoot");
  /* The table can extend below the window; only its on-screen part counts as its edge. */
  const speed = edgeScrollSpeed(dragY, Math.max(c.top, 0) + (head ? head.offsetHeight : 0), Math.min(c.bottom, window.innerHeight) - (foot ? foot.offsetHeight : 0), 48, 22);
  if (speed) sc.scrollTop += speed;
}
function stopEdgeScroll() {
  if (dragTimer) clearInterval(dragTimer);
  dragTimer = null; dragY = null; dragX = null;
}

document.addEventListener("dragend", (e) => {
  stopEdgeScroll();
  /* drop clears dragPid/dragRole first, so leftovers + dropEffect "none" means the target was refused. */
  const refused = (S.ui.dragPid != null || S.ui.dragRole != null) && e.dataTransfer && e.dataTransfer.dropEffect === "none";
  if (refused) toast(S.ui.dragRole
    ? "Can't assign there — pick a highlighted person on the same day who has the skill."
    : "Can't swap there — pick a highlighted person on the same day.");
  S.ui.dragPid = null;
  S.ui.dragRole = null;
  S.ui.dragDay = null;
  document.querySelectorAll(".drag-source,.drop-hot,.drop-dim").forEach((el) => {
    el.classList.remove("drag-source", "drop-hot", "drop-dim");
  });
});

document.addEventListener("dragover", (e) => {
  if (S.ui.dragPid == null && S.ui.dragRole == null) return;
  dragX = e.clientX; dragY = e.clientY;
  if (!dragTimer) dragTimer = setInterval(edgeScrollTick, 16);
  const drop = e.target.closest("[data-drop-person]");
  if (!drop) return;
  const day = drop.dataset.dropDay != null ? +drop.dataset.dropDay : null;
  if (day != null && day !== +S.ui.dragDay) return;
  if (S.ui.dragRole && !canTakeParkedRole(day, S.ui.dragRole, drop.dataset.dropPerson)) return;
  if (S.ui.dragPid && !canDropPersonOnPerson(day, S.ui.dragPid, drop.dataset.dropPerson)) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
  document.querySelectorAll(".drop-hot").forEach((el) => { if (el !== drop) el.classList.remove("drop-hot"); });
  drop.classList.add("drop-hot");
});

document.addEventListener("drop", (e) => {
  stopEdgeScroll();
  if (S.ui.dragPid == null && S.ui.dragRole == null) return;
  const drop = e.target.closest("[data-drop-person]");
  if (!drop) return;
  e.preventDefault();
  const fromDay = +S.ui.dragDay;
  const day = drop.dataset.dropDay != null ? +drop.dataset.dropDay : fromDay;
  const dragRole = S.ui.dragRole;
  const fromPid = S.ui.dragPid;
  S.ui.dragPid = null;
  S.ui.dragRole = null;
  S.ui.dragDay = null;
  if (day !== fromDay) {
    toast("Only within the same day.");
    render();
    return;
  }
  if (dragRole) assignParkedRole(day, dragRole, drop.dataset.dropPerson);
  else if (fromPid) swapPeople(day, fromPid, drop.dataset.dropPerson);
  render();
});

document.addEventListener("change", (e) => {
  const el = e.target; const k = el.dataset && el.dataset.ch; if (!k) return;
  const v = el.type === "checkbox" ? el.checked : el.value; const ds = el.dataset;
  const fn = CHANGES[k]; if (fn) fn(v, ds);
  const uiOnly = k === "peopleQ" || k === "peopleFilter" || k === "selPerson" || k === "statsFrom" || k === "statsTo";
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
  if (k === "pemp" || k === "pshldr" || k === "awayNote") {
    CHANGES[k](el.value, el.dataset);
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
  /* H64: with a Roster row highlighted, ↑/↓ move the highlight to the row above / below. */
  if ((e.key === "ArrowUp" || e.key === "ArrowDown") && S.ui.rowSel && S.ui.screen === "ros" &&
      !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.target.closest("input, select, textarea")) {
    const dir = e.key === "ArrowUp" ? -1 : 1;
    e.preventDefault();
    S.ui.rowSel = adjacentPersonId(S.ui.rowSel, dir) || S.ui.rowSel;
    render();
    revealRow(document.querySelector("tr.row-sel"));
    return;
  }
  if (e.key === "Escape" && S.ui.peoplePickerOpen) {
    S.ui.peoplePickerOpen = false; S.ui.peopleQ = ""; render(); return;
  }
  if (e.key === "Escape" && (S.ui.sel || S.ui.rowSel || S.ui.tallyOpen || S.ui.confirm || S.ui.bulk)) { S.ui.sel = null; S.ui.rowSel = null; S.ui.tallyOpen = false; S.ui.confirm = null; S.ui.bulk = null; render(); }
});

window.addEventListener("beforeunload", (e) => { if (S.dirty || isRosterUnsaved()) { e.preventDefault(); e.returnValue = ""; } });

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

window.addEventListener("beforeprint", stampPrintTime);
