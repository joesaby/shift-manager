/* ------------------------------------------------------------------------
   Lets the user pick a folder once (File System Access API, Chromium only).
   Once picked, the app's data file and the audit-log tree live inside it and
   are read/written directly - no repeated Save As / Open dialogs. The folder
   handle is remembered in IndexedDB across restarts; the browser still
   requires a user click to re-grant permission each new session, which is a
   security property of the API itself, not something this app can bypass.
   Everywhere else falls back to the manual save/open flow in state.js. */

const DB_NAME = "shiftManagerFS";
const STORE = "handles";
const HANDLE_KEY = "workspaceDir";
const DATA_FILE = "shift-manager-data.json";
const BACKUP_DIR = "backups";
const BACKUP_PREV = "shift-manager-data.prev.json";
const MAX_DATED_BACKUPS = 10;

let dirHandle = null;

export const supportsWorkspace = () => typeof window.showDirectoryPicker === "function";
export const hasWorkspace = () => !!dirHandle;
export const workspaceName = () => (dirHandle ? dirHandle.name : null);

function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbGet(key) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const r = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
    r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
  });
}
async function idbSet(key, val) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(val, key);
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
  });
}

/* Tries to reuse a previously-picked folder without prompting. Returns "granted",
   "prompt" (found a saved folder but needs a user click to reconnect it), or null. */
export async function tryRestoreWorkspace() {
  if (!supportsWorkspace()) return null;
  try {
    const h = await idbGet(HANDLE_KEY);
    if (!h) return null;
    const perm = await h.queryPermission({ mode: "readwrite" });
    if (perm === "granted") { dirHandle = h; return "granted"; }
    return "prompt";
  } catch (e) { return null; }
}

/* Must be called from a user gesture (click handler) - re-grants permission on a
   folder remembered from a previous session. */
export async function reconnectWorkspace() {
  const h = await idbGet(HANDLE_KEY);
  if (!h) return false;
  const perm = await h.requestPermission({ mode: "readwrite" });
  if (perm !== "granted") return false;
  dirHandle = h; return true;
}

/* Must be called from a user gesture - opens the folder picker. */
export async function pickWorkspace() {
  const h = await window.showDirectoryPicker({ mode: "readwrite" });
  const perm = await h.requestPermission({ mode: "readwrite" });
  if (perm !== "granted") throw new Error("permission-denied");
  dirHandle = h;
  await idbSet(HANDLE_KEY, h);
  return h;
}

export function disconnectWorkspace() { dirHandle = null; }

export async function readWorkspaceData() {
  if (!dirHandle) return null;
  try {
    const fh = await dirHandle.getFileHandle(DATA_FILE, { create: false });
    return await (await fh.getFile()).text();
  } catch (e) { /* main missing — try backups below */ }
  try {
    const bak = await dirHandle.getDirectoryHandle(BACKUP_DIR, { create: false });
    try {
      const prev = await bak.getFileHandle(BACKUP_PREV, { create: false });
      return await (await prev.getFile()).text();
    } catch (e2) { /* no .prev */ }
    const names = [];
    for await (const [name, handle] of bak.entries()) {
      if (handle.kind === "file" && /^shift-manager-data-\d{8}-\d{6}\.json$/.test(name)) names.push(name);
    }
    names.sort();
    if (!names.length) return null;
    const fh = await bak.getFileHandle(names[names.length - 1], { create: false });
    return await (await fh.getFile()).text();
  } catch (e) { return null; }
}

async function writeTextFile(dir, name, text) {
  const fh = await dir.getFileHandle(name, { create: true });
  const w = await fh.createWritable();
  await w.write(text);
  await w.close();
}

async function rotateBackups(json) {
  const bak = await dirHandle.getDirectoryHandle(BACKUP_DIR, { create: true });
  /* Keep last good main as .prev before overwrite. */
  try {
    const main = await dirHandle.getFileHandle(DATA_FILE, { create: false });
    const old = await (await main.getFile()).text();
    if (old && old !== json) await writeTextFile(bak, BACKUP_PREV, old);
  } catch (e) { /* first save — nothing to copy */ }
  const stamp = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const stamped = "shift-manager-data-" +
    stamp.getFullYear() + pad(stamp.getMonth() + 1) + pad(stamp.getDate()) + "-" +
    pad(stamp.getHours()) + pad(stamp.getMinutes()) + pad(stamp.getSeconds()) + ".json";
  await writeTextFile(bak, stamped, json);
  const names = [];
  for await (const [name, handle] of bak.entries()) {
    if (handle.kind === "file" && /^shift-manager-data-\d{8}-\d{6}\.json$/.test(name)) names.push(name);
  }
  names.sort();
  while (names.length > MAX_DATED_BACKUPS) {
    const drop = names.shift();
    try { await bak.removeEntry(drop); } catch (e) { /* ignore */ }
  }
}

export async function writeWorkspaceData(json) {
  if (!dirHandle) return false;
  try {
    await rotateBackups(json);
    await writeTextFile(dirHandle, DATA_FILE, json);
    return true;
  } catch (e) { return false; }
}

async function auditDir() {
  const now = new Date();
  const parts = ["logs", String(now.getFullYear()), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")];
  let dir = dirHandle;
  for (const part of parts) dir = await dir.getDirectoryHandle(part, { create: true });
  return dir;
}

export async function appendAuditLine(line) {
  if (!dirHandle) return;
  try {
    const dir = await auditDir();
    const fh = await dir.getFileHandle("audit_log.txt", { create: true });
    const existing = await (await fh.getFile()).text();
    const w = await fh.createWritable();
    await w.write(existing + line + "\n");
    await w.close();
  } catch (e) { /* best-effort; never blocks the UI */ }
}
