import { esc, fmtLong } from "../util.js";
import { S } from "../state.js";
import { history } from "../model.js";
import { rotaHTML, csvOf } from "../snapshot.js";
import { ph } from "../ui-kit.js";
import { touch, download, askConfirm } from "../state.js";

export function vLog() {
  const log = history();
  if (S.ui.viewLog) {
    const e = log.find((x) => x.id === S.ui.viewLog);
    if (e && e.snap) {
      const snap = e.snap.savedBy || !e.savedBy ? e.snap : { ...e.snap, savedBy: e.savedBy };
      const sub = e.savedBy ? `Saved by ${esc(e.savedBy)}` : "";
      return `${ph("Saved rota", sub, '<button class="btn btn-outline" data-act="backLog">Back to log</button><button class="btn btn-primary" data-act="print">Print in colour</button>')}<div class="overflow-x-auto">${rotaHTML(snap)}</div>`;
    }
  }
  const rows = log.slice().reverse().map((e) => {
    const by = e.savedBy || (e.snap && e.snap.savedBy) || "";
    return `<tr><td>${esc(fmtLong(e.startDate || e.start))}</td><td>${esc(new Date(e.savedAt).toLocaleString("en-IE"))}</td><td>${esc(by || "—")}</td><td class="whitespace-nowrap"><button class="btn btn-xs" data-act="viewLog" data-l="${e.id}">View</button> <button class="btn btn-xs" data-act="csvLog" data-l="${e.id}">CSV</button> <button class="btn btn-xs btn-outline btn-error" data-act="delLog" data-l="${e.id}">Delete</button></td></tr>`;
  }).join("");
  return `${ph("Log", 'Every rota you saved with "Save to log". Export to CSV to open in Excel.', `<button class="btn btn-outline" data-act="csvLog" data-l="" ${log.length ? "" : "disabled"}>Export all as CSV</button>`)}
   <div class="card bg-base-100 shadow-sm border border-base-300 overflow-x-auto"><table class="table"><thead><tr><th>Block starting</th><th>Saved</th><th>Manager</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="4" class="opacity-70">Nothing saved yet.</td></tr>'}</tbody></table></div>`;
}

export const actions = {
  viewLog: (a) => { S.ui.viewLog = a.l; },
  backLog: () => { S.ui.viewLog = null; },
  delLog: (a) => askConfirm("Delete this saved rota?", "It is removed from the log.", "Delete", () => {
    const log = history();
    const i = log.findIndex((e) => e.id === a.l);
    if (i >= 0) log.splice(i, 1);
    touch();
  }),
  csvLog: (a) => {
    const log = history();
    const es = a.l ? log.filter((e) => e.id === a.l) : log;
    download("shift-log.csv", csvOf(es), "text/csv");
  }
};
