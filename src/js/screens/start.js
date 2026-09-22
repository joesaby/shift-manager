import { esc, icon } from "../util.js";
import { S } from "../state.js";
import { D, hasRoster, qual, activePeople, unitName } from "../model.js";
import { ph } from "../ui-kit.js";
import { hasWorkspace, workspaceName, supportsWorkspace } from "../workspace.js";
import { getSessionUser } from "../audit.js";

function setupStep(done, label, screen, hint) {
  const go = screen ? `type="button" data-act="nav" data-s="${screen}"` : "";
  const tag = screen ? "button" : "div";
  return `<${tag} ${go} class="home-step ${done ? "is-done" : ""}">
    <span class="home-step-mark">${done ? "✓" : "·"}</span>
    <span class="min-w-0">
      <span class="block font-semibold text-sm leading-tight">${label}</span>
      <span class="block text-xs opacity-60 mt-0.5">${hint}</span>
    </span>
  </${tag}>`;
}

function blockCard(n, key, title, caption, screen) {
  return `<button type="button" data-act="nav" data-s="${screen}" class="home-block">
    <div class="home-block-top">
      <span class="home-block-num">${n}</span>
      <span class="opacity-70">${icon(key)}</span>
    </div>
    <div>
      <div class="font-semibold text-lg leading-tight">${title}</div>
      <p class="text-sm opacity-70 mt-1 mb-0">${caption}</p>
    </div>
    <div class="text-sm text-primary font-medium">Open →</div>
  </button>`;
}

export function vStart() {
  const nR = D().roles.length, nP = D().people.length;
  const skillRoles = D().roles.filter((r) => r.skillRestricted);
  const nQ = skillRoles.length
    ? activePeople().filter((p) => skillRoles.some((r) => qual(p, r.id))).length
    : 0;
  const unit = (D().meta && D().meta.unitName) || "";
  const hasUnit = !!unit.trim();
  const rosterOk = hasRoster();
  const ws = hasWorkspace();
  const wsLabel = ws ? workspaceName() : null;
  const manager = getSessionUser() || "";

  let folderBit;
  if (ws) {
    folderBit = `<div class="flex flex-wrap items-center gap-2">
      <span class="badge badge-ghost gap-1">Folder connected</span>
      <span class="font-semibold">${esc(wsLabel)}</span>
      <button type="button" class="btn btn-xs btn-ghost" data-act="changeFolder">Change folder</button>
    </div>`;
  } else if (S.ui.wsStatus === "reconnect") {
    folderBit = `<div class="flex flex-wrap items-center gap-2">
      <span class="badge badge-warning gap-1">Folder needs reconnect</span>
      <button type="button" class="btn btn-xs btn-warning" data-act="reconnectFolder">Reconnect</button>
    </div>`;
  } else if (supportsWorkspace()) {
    folderBit = `<div class="flex flex-wrap items-center gap-2">
      <span class="badge badge-ghost gap-1">No folder yet</span>
      <button type="button" class="btn btn-xs btn-primary" data-act="chooseFolder">Choose folder</button>
      <button type="button" class="btn btn-xs btn-ghost" data-act="open">Open file</button>
    </div>`;
  } else {
    folderBit = `<div class="flex flex-wrap items-center gap-2">
      <span class="badge badge-ghost gap-1">Use Open / Save file</span>
      <button type="button" class="btn btn-xs btn-ghost" data-act="open">Open file</button>
      <button type="button" class="btn btn-xs btn-primary" data-act="save">Save file</button>
    </div>`;
  }

  const badges = [
    `<span class="badge badge-ghost badge-sm">${hasUnit ? "Unit set" : "No unit"}</span>`,
    `<span class="badge badge-ghost badge-sm">${nR} role${nR === 1 ? "" : "s"}</span>`,
    `<span class="badge badge-ghost badge-sm">${nP} people</span>`,
    `<span class="badge badge-ghost badge-sm">${nQ} skilled</span>`,
    `<span class="badge badge-ghost badge-sm">${rosterOk ? "Roster ready" : "No roster"}</span>`
  ].join(" ");

  const statusStrip = `<div class="card bg-base-100 shadow-sm border border-base-300">
    <div class="card-body gap-3 py-3">
      <div class="home-status">
        <div class="home-status-main">
          <div class="text-xs font-semibold uppercase tracking-wide opacity-50">This workspace</div>
          ${folderBit}
          <div class="flex flex-wrap gap-1.5">${badges}</div>
          ${hasUnit
            ? `<div id="unitShowingAs" class="text-sm opacity-70">Showing as <b>${esc(unitName())}</b> on roster and print.</div>`
            : `<div id="unitShowingAs" class="text-sm opacity-70">Set a unit name so printed rotas show which station this is.</div>`}
        </div>
        <div class="home-status-fields">
          <label class="form-control home-status-unit">
            <span class="label-text font-semibold">Unit name</span>
            <input id="unitName" class="input input-bordered w-full" placeholder="e.g. Pearse Street" value="${esc(unit)}" data-ch="unitName" autocomplete="organization">
          </label>
          <div class="form-control home-status-unit">
            <span class="label-text font-semibold">Manager name</span>
            <div class="flex gap-2">
              <input id="managerNameDisplay" class="input input-bordered w-full" value="${esc(manager)}" placeholder="Not set" readonly>
              <button type="button" class="btn btn-outline shrink-0" data-act="editManagerName">${manager ? "Change" : "Set"}</button>
            </div>
            <span class="label-text-alt opacity-60 mt-1">Audit log + new Save to log. Past rotas keep the name they were saved with.</span>
          </div>
        </div>
      </div>
    </div>
  </div>`;

  const thisBlock = `<div>
    <h2 class="text-lg font-semibold tracking-tight mb-1">This block</h2>
    <p class="text-sm opacity-70 mb-3">Every four days — work left to right.</p>
    <div class="home-blocks">
      ${blockCard(1, "att", "Attendance", "Dates, Day/Night, who is Present.", "att")}
      ${blockCard(2, "ros", "Roster", "Generate, then edit the person × role grid.", "ros")}
      ${blockCard(3, "prt", "Print rota", "Colour print and Save to log.", "prt")}
    </div>
  </div>`;

  const setup = `<div>
    <h2 class="text-lg font-semibold tracking-tight mb-1">Set up this unit</h2>
    <p class="text-sm opacity-70 mb-3">Once per unit folder. Tick marks update as you go.</p>
    <div class="home-steps">
      ${setupStep(hasUnit, "Unit name", null, hasUnit ? esc(unitName()) : "Type it on the right")}
      ${setupStep(ws || !supportsWorkspace(), "Folder", null, ws ? esc(wsLabel) : "Choose folder (top bar)")}
      ${setupStep(nR > 0, "Roles", "rol", nR ? nR + " defined" : "Add duty roles")}
      ${setupStep(nP > 0, "People", "ppl", nP ? nP + " on the team" : "Add the team")}
      ${setupStep(nQ > 0 || !skillRoles.length, "Skills", "skl", skillRoles.length ? (nQ ? nQ + " trained" : "Tick who is trained") : "No skill roles yet")}
      ${setupStep(rosterOk, "First roster", "att", rosterOk ? "Generated" : "Generate from Attendance")}
    </div>
  </div>`;

  const folders = `<div class="card bg-base-100 shadow-sm border border-base-300">
    <div class="card-body gap-3">
      <h2 class="card-title text-base">Folders = units</h2>
      <div class="home-folders">
        <div class="home-folders-tree">
          <div class="opacity-60">rotas/</div>
          <div class="pl-4 mt-1">├── <span class="font-semibold text-primary">unit-a</span> <span class="opacity-50">← this unit’s data</span></div>
          <div class="pl-4">└── <span class="font-semibold text-primary">unit-b</span> <span class="opacity-50">← other unit</span></div>
        </div>
        <div class="home-folders-copy space-y-2">
          <p class="mb-0"><b>One folder per unit.</b> People, roles, unit name, and rotas all live in that folder.</p>
          <p class="mb-0">To switch units: finish saving, then <b>Change folder</b> (or Open the other file). Do not mix two units in one folder.</p>
        </div>
      </div>
    </div>
  </div>`;

  const collapses = `<div>
    <details class="home-details">
      <summary>How generate works</summary>
      <div class="home-details-body">
        <ol class="list-decimal ml-5 space-y-2">
          <li>Only <b>Present</b> people that day are considered.</li>
          <li><b>Only do this role</b> people are locked in first.</li>
          <li><b>Needs a skill</b> roles fill next (scarce pools first — drivers, MIC, jailer).</li>
          <li>Other roles are shuffled so the sheet does not always fill top-to-bottom the same way.</li>
          <li>Prefers people who have not had that role recently in this block; ties broken at random.</li>
          <li>Avoids the same role two days in a row when someone else can cover.</li>
          <li>On the second night, avoids a hard role if they already had a hard role the night before.</li>
          <li>If a day cannot fill strictly, cells may stay <b>unfilled</b> — edit by hand.</li>
        </ol>
        <p class="text-xs opacity-60 mt-2 mb-0">Fairness is within the current four-day block. Log history is for reprint / CSV, not yet used to weight older blocks.</p>
      </div>
    </details>
    <details class="home-details">
      <summary>Tips</summary>
      <div class="home-details-body">
        <ul class="list-disc ml-5 space-y-2 mb-0">
          <li><b>Sample data</b> explores the app with fake names; it replaces what is loaded (you will confirm).</li>
          <li><b>Clear everything</b> wipes in-app data and the browser backup — not a JSON file already saved elsewhere.</li>
          <li>Older data files open fine; the app upgrades them on open.</li>
          <li>Chrome or Edge is best for Choose folder. Open / Save file works in other modern browsers.</li>
          <li>Opening the HTML by double-click (<code>file://</code>) is fine; use Choose folder or Open file for data.</li>
          <li>Workspace saves also write under <code>backups/</code>. Keep the folder on a shared drive that is already backed up.</li>
        </ul>
      </div>
    </details>
  </div>`;

  const footer = `<div class="flex flex-wrap items-center gap-2 pt-2" style="border-top:1px solid oklch(var(--bc)/.12)">
    <button type="button" class="btn btn-outline btn-sm" data-act="sample">Load sample data</button>
    <button type="button" class="btn btn-outline btn-error btn-sm" data-act="askClear">Clear everything</button>
    <span class="text-xs opacity-50 ml-auto">Nothing is sent over the internet.</span>
  </div>`;

  return `${ph("Home", "Set up a unit folder once. Run Attendance → Roster → Print every block.")}
    <div class="home-stack">
      ${statusStrip}
      ${thisBlock}
      ${setup}
      ${folders}
      ${collapses}
      ${footer}
    </div>`;
}

export const actions = {};

export const changes = {
  unitName: (v) => {
    if (!D().meta) D().meta = {};
    D().meta.unitName = String(v || "");
  }
};
