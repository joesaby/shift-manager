import { LKEY, LKEY_LEGACY } from "./util.js";
import { emptyData, migrateToV2 } from "./model.js";
import { logAudit } from "./audit.js";

/* ------------------------------------------------------------------ global state */
export let S = { data: emptyData(), ui: { screen: "start", selPerson: null, sel: null, confirm: null, toast: "", viewLog: null, bulk: null, namePrompt: null, rosterDay: 0, statsMonth: null, histYear: null, histMonth: null, histId: null, histDay: 0, histPrint: false, peopleQ: "", peopleFilter: "all", peoplePickerOpen: false }, dirty: false, handle: null };

/* main.js registers its render() here once, so this module never has to import main.js
   (which imports the screens, which import this module — that cycle is what this avoids). */
let _render = () => {};
export function setRenderer(fn) { _render = fn; }
export function render() { _render(); }

/* ------------------------------------------------------------------ persistence (local backup) */
export function touch() {
  S.dirty = true;
  if (S.data && S.data.meta) S.data.meta.updatedAt = new Date().toISOString();
  try { localStorage.setItem(LKEY, JSON.stringify(S.data)); } catch (e) { /* ignore */ }
  onDataChanged();
}

/* Set by workspace.js so every change also queues an autosave to the chosen folder,
   without state.js needing to import workspace.js (same cycle-avoidance as above). */
let onDataChanged = () => {};
export function setOnDataChanged(fn) { onDataChanged = fn; }

export function toast(t) {
  S.ui.toast = t; render();
  setTimeout(() => { if (S.ui.toast === t) { S.ui.toast = ""; render(); } }, 2600);
}

export function askConfirm(title, text, ok, fn) {
  S.ui.confirm = { title: title, text: text, ok: ok, fn: fn }; render();
}

export function loadLocal() {
  try {
    let raw = localStorage.getItem(LKEY);
    if (!raw) raw = localStorage.getItem(LKEY_LEGACY);
    if (raw) {
      const d = migrateToV2(JSON.parse(raw));
      S.data = d;
      S.ui.screen = d.people.length ? "att" : "start";
      try { localStorage.setItem(LKEY, JSON.stringify(d)); } catch (e) { /* ignore */ }
      return true;
    }
  } catch (e) { /* ignore */ }
  return false;
}

export function download(name, text, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: type || "application/json" }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
}

/* ------------------------------------------------------------------ manual file save/open
   (fallback path used only when no workspace folder is connected - see workspace.js) */
export async function saveFile() {
  const json = JSON.stringify(S.data, null, 2);
  if (window.showSaveFilePicker) {
    try {
      if (!S.handle) S.handle = await window.showSaveFilePicker({ suggestedName: "shift-manager-data.json", types: [{ description: "Shift Manager data", accept: { "application/json": [".json"] } }] });
      const w = await S.handle.createWritable(); await w.write(json); await w.close();
      S.dirty = false; toast("Saved to " + S.handle.name); logAudit("DATA_SAVED", S.handle.name); return;
    } catch (e) { if (e && e.name === "AbortError") return; S.handle = null; }
  }
  download("shift-manager-data.json", json); S.dirty = false; toast("Downloaded shift-manager-data.json. Keep it somewhere safe.");
  logAudit("DATA_SAVED", "shift-manager-data.json (download)");
}

export function applyLoaded(text, handle, sourceLabel) {
  try {
    const d = migrateToV2(JSON.parse(text));
    S.data = d; S.handle = handle || null; S.dirty = false; S.ui.sel = null; S.ui.viewLog = null;
    S.ui.screen = d.people.length ? "att" : "start"; S.ui.selPerson = d.people[0] ? d.people[0].id : null;
    try { localStorage.setItem(LKEY, JSON.stringify(d)); } catch (e) { /* ignore */ }
    toast(sourceLabel && String(sourceLabel).indexOf("mock") >= 0 ? "Loaded mock data from data/" : "Data file opened");
    logAudit("DATA_OPENED", sourceLabel || (handle ? handle.name : "uploaded file"));
    return true;
  } catch (e) { toast("That file is not a Shift Manager data file."); return false; }
}

/** Relative to the HTML page: data/shift-manager-data.json when serving over http(s).
 *  Skipped on file:// — browsers block fetch there.
 *  Skipped when this browser already has saved Shift Manager data (so unit name and
 *  edits are not wiped by the demo mock on every refresh). */
export async function tryLoadMockData() {
  if (typeof location !== "undefined" && location.protocol === "file:") return false;
  try {
    const raw = localStorage.getItem(LKEY) || localStorage.getItem(LKEY_LEGACY);
    if (raw) {
      const d = JSON.parse(raw);
      if (d && (d.meta && String(d.meta.unitName || "").trim()
        || (d.people && d.people.length)
        || (d.roles && d.roles.length))) {
        return false;
      }
    }
  } catch (e) { /* ignore corrupt local backup */ }
  const urls = ["data/shift-manager-data.json", "./data/shift-manager-data.json"];
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const text = await res.text();
      if (applyLoaded(text, null, "mock data file (" + url + ")")) return true;
    } catch (e) { /* missing file — ignore */ }
  }
  return false;
}

export async function openFile() {
  if (window.showOpenFilePicker) {
    try {
      const [h] = await window.showOpenFilePicker({ types: [{ description: "Shift Manager data", accept: { "application/json": [".json"] } }] });
      const f = await h.getFile(); applyLoaded(await f.text(), h); return;
    } catch (e) { if (e && e.name === "AbortError") return; }
  }
  document.getElementById("fileIn").click();
}

export function wireFileInput() {
  document.getElementById("fileIn").addEventListener("change", async (e) => {
    const f = e.target.files[0]; if (f) applyLoaded(await f.text(), null); e.target.value = "";
  });
}
