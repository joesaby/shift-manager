import { uid, LKEY } from "./util.js";
import { S, touch, toast, askConfirm, openFile, saveFile, applyLoaded } from "./state.js";
import { D, emptyData } from "./model.js";
import { loadSample } from "./sampleData.js";
import { pickWorkspace, reconnectWorkspace, hasWorkspace, readWorkspaceData } from "./workspace.js";
import { setSessionUser, getSessionUser, logAudit } from "./audit.js";

export const actions = {
  nav: (a) => { S.ui.screen = a.s === "help" ? "start" : a.s; S.ui.sel = null; S.ui.viewLog = null; },
  open: () => { openFile(); },
  save: () => { saveFile(); },
  sample: () => { if (D().people.length || D().roles.length) askConfirm("Replace your data?", "Loading the sample data replaces everything currently in the app.", "Replace", loadSample); else loadSample(); },
  askClear: () => askConfirm("Clear everything?", "This removes all people, roles and saved rotas from the app. A data file you saved earlier is not affected.", "Clear everything", () => {
    S.data = emptyData(); S.handle = null; S.dirty = false;
    try { localStorage.removeItem(LKEY); } catch (e) { /* ignore */ }
    S.ui.screen = "start";
  }),

  bulk: (a) => { S.ui.bulk = { k: a.k }; },
  closeBulk: () => { S.ui.bulk = null; },
  doBulk: () => {
    const lines = (document.getElementById("bulkText").value || "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
    if (S.ui.bulk.k === "people") lines.forEach((n) => D().people.push({ id: uid(), name: n, active: true, fixedRoleId: null }));
    else lines.forEach((n) => D().roles.push({
      id: uid(), name: n, groupId: D().groups[0] ? D().groups[0].id : "",
      usedAtNight: true, hard: false, skillRestricted: false, sortOrder: D().roles.length + 1
    }));
    S.ui.bulk = null; touch(); toast(lines.length + " added");
  },

  closeConfirm: () => { S.ui.confirm = null; },
  doConfirm: () => { const c = S.ui.confirm; S.ui.confirm = null; c.fn(); },

  /* First-run or explicit folder pick. If we don't know who's using the app yet,
     stash what to do next and show the name prompt first - submitSessionUser()
     below picks this back up once a name is entered. */
  chooseFolder: async () => {
    try {
      await pickWorkspace();
      if (!getSessionUser()) { S.ui.namePrompt = { pending: "connect" }; return; }
      await afterWorkspaceConnected();
    } catch (e) { if (e && e.name !== "AbortError") toast("Could not open that folder."); }
  },
  changeFolder: async () => {
    try {
      await pickWorkspace();
      await afterWorkspaceConnected();
    } catch (e) { if (e && e.name !== "AbortError") toast("Could not open that folder."); }
  },
  reconnectFolder: async () => {
    const ok = await reconnectWorkspace();
    if (!ok) { toast("Could not reconnect. Choose the folder again."); return; }
    if (!getSessionUser()) { S.ui.namePrompt = { pending: "connect" }; return; }
    await afterWorkspaceConnected();
  },
  submitSessionUser: async () => {
    const el = document.getElementById("sessionUserInput"); const n = el && el.value.trim();
    if (!n) return;
    setSessionUser(n);
    const pending = S.ui.namePrompt && S.ui.namePrompt.pending;
    S.ui.namePrompt = null;
    if (pending === "edit") { toast("Manager name updated"); return; }
    if (pending === "connect" && hasWorkspace()) await afterWorkspaceConnected();
  },
  editManagerName: () => { S.ui.namePrompt = { pending: "edit" }; },
  closeNamePrompt: () => { S.ui.namePrompt = null; }
};

async function afterWorkspaceConnected() {
  S.ui.wsStatus = "connected";
  const text = await readWorkspaceData();
  if (text) {
    applyLoaded(text, null, "workspace data file");
  } else {
    touch();
    logAudit("DATA_OPENED", "workspace connected (new, empty folder)");
  }
  toast("Workspace folder connected");
}
