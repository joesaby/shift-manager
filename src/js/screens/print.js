import { D, block, hasRoster, isStale, history, snapshotBlockForHistory, setSpareNote } from "../model.js";
import { buildSnapshot, rotaHTML } from "../snapshot.js";
import { ph, noPeople, unitBanner } from "../ui-kit.js";
import { touch, toast } from "../state.js";
import { logAudit } from "../audit.js";

export function vPrt() {
  if (!D().people.length) return noPeople();
  if (!hasRoster()) return `${ph("3. Print rota", "")}<div role="alert" class="alert"><span>No roster yet.</span><button class="btn btn-sm btn-primary" data-act="generate">Generate roster</button></div>`;
  return `${ph("3. Print rota", "Person down the side, one column per day. Duty type or status is shown as coloured text opposite each person — type a note for anyone spare before printing.", '<button class="btn btn-outline" data-act="nav" data-s="ros">Back to roster</button><button class="btn btn-outline btn-primary" data-act="saveLog">Save to log</button><button class="btn btn-primary" data-act="print">Print in colour</button>')}
    ${unitBanner()}
    ${isStale() ? `<div role="alert" class="alert alert-warning print:hidden"><span>Attendance or setup changed since this roster was generated.</span></div>` : ""}
    <div class="overflow-x-auto">${rotaHTML(buildSnapshot(), { editable: true })}</div>`;
}

export const actions = {
  print: () => window.print(),
  saveLog: () => {
    const snap = buildSnapshot();
    history().push(snapshotBlockForHistory(snap));
    touch(); toast("Saved to log");
    logAudit("SAVED_TO_LOG", "block_start=" + block().startDate);
  }
};

export const changes = {
  spareNote: (v, ds) => { setSpareNote(ds.p, +ds.d, v); touch(); }
};
