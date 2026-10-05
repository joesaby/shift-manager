import { iso, addDays, fmt, fmtLong, STAT } from "./util.js";
import { S } from "./state.js";
import { LOOKBACK_MONTHS } from "./rules.js";

export const DEFAULT_STATUSES = [
  { id: "present", label: "Present", allocates: true, printColor: "#EAF4EC" },
  { id: "annual_leave", label: "Annual leave", allocates: false, printColor: "#BBDEFB" },
  { id: "sick_leave", label: "Sick leave", allocates: false, printColor: "#BBDEFB" },
  { id: "paternity_leave", label: "Paternity leave", allocates: false, printColor: "#BBDEFB" },
  { id: "duty_away", label: "Duty away", allocates: false, printColor: "#BBDEFB" },
  { id: "rest_day", label: "Rest day", allocates: false, printColor: "#BBDEFB" }
];

const LABEL_TO_STATUS = {
  Present: "present",
  "Annual leave": "annual_leave",
  "Sick leave": "sick_leave",
  "Paternity leave": "paternity_leave",
  "Duty away": "duty_away",
  "Rest day": "rest_day"
};
const STATUS_TO_LABEL = {
  present: "Present",
  annual_leave: "Annual leave",
  sick_leave: "Sick leave",
  paternity_leave: "Paternity leave",
  duty_away: "Duty away",
  rest_day: "Rest day"
};

function defaultStatusesCopy() {
  return DEFAULT_STATUSES.map((s) => ({ ...s }));
}

export function emptyData() {
  const t = new Date(); t.setDate(t.getDate() + 1);
  const start = iso(t);
  return {
    schemaVersion: 2,
    meta: { title: "Shift Manager", unitName: "", updatedAt: new Date().toISOString(), app: "shift-manager-html" },
    settings: {
      statuses: defaultStatusesCopy(),
      defaultShifts: ["Day", "Day", "Night", "Night"],
      blockLengthDays: 4
    },
    groups: [
      { id: "g1", name: "Car", sortOrder: 1 },
      { id: "g2", name: "Beat", sortOrder: 2 },
      { id: "g3", name: "Inside", sortOrder: 3 }
    ],
    probationerGroups: [],
    roles: [],
    people: [],
    personRoles: [],
    blocks: {
      current: {
        id: "b_current",
        startDate: start,
        shifts: ["Day", "Day", "Night", "Night"],
        stale: false,
        generatedAt: null,
        attendance: [],
        assignments: [],
        spareNotes: []
      },
      history: []
    },
    audit: []
  };
}

/* ------------------------------------------------------------------ migration */

function migrateLogEntry(e) {
  const startDate = e.start || e.startDate || "";
  const shifts = (e.snap && e.snap.days) ? e.snap.days.map((d) => d.shift) : ["Day", "Day", "Night", "Night"];
  const attendance = [];
  const assignments = [];
  (e.records || []).forEach((r) => {
    const statusId = LABEL_TO_STATUS[r.status] || "present";
    const person = (S.data && S.data.people || []).find((p) => p.name === r.person);
    /* Prefer name match against live catalogue; fall back to embedding name-only facts via records/snap. */
    if (person) {
      attendance.push({ date: r.date, personId: person.id, statusId });
      if (r.status === "Present" && r.role && r.role !== "Spare") {
        const role = (S.data && S.data.roles || []).find((x) => x.name === r.role);
        if (role) assignments.push({ date: r.date, roleId: role.id, personId: person.id, source: "manual" });
      }
    }
  });
  return {
    id: e.id,
    savedAt: e.savedAt,
    startDate,
    shifts,
    attendance,
    assignments,
    label: e.label,
    snap: e.snap || null,
    records: e.records || null
  };
}

export function migrateToV2(raw) {
  if (!raw || typeof raw !== "object") throw new Error("bad");
  if (raw.schemaVersion === 2 && Array.isArray(raw.people) && raw.blocks && raw.blocks.current) {
    return normalizeV2(raw);
  }
  if (raw.v !== 1 || !Array.isArray(raw.roles) || !Array.isArray(raw.people)) throw new Error("bad");

  const groups = (raw.groups || []).map((g, i) => ({
    id: g.id, name: g.name, color: g.color, sortOrder: i + 1
  })); /* colour is moved onto the roles by normalizeV2 */
  const roles = (raw.roles || []).map((r, i) => ({
    id: r.id,
    name: r.name,
    groupId: r.group || r.groupId || "",
    usedAtDay: r.usedAtDay == null ? true : !!r.usedAtDay,
    usedAtNight: !!(r.night ?? r.usedAtNight),
    hard: !!r.hard,
    skillRestricted: !!(r.skill ?? r.skillRestricted),
    sortOrder: i + 1
  }));
  const people = (raw.people || []).map((p) => ({
    id: p.id,
    name: p.name,
    active: p.active !== false,
    fixedRoleId: p.only || p.fixedRoleId || null
  }));
  const personRoles = [];
  (raw.people || []).forEach((p) => {
    (p.roles || []).forEach((roleId) => personRoles.push({ personId: p.id, roleId }));
  });

  const start = raw.block.start;
  const shifts = raw.block.shifts || ["Day", "Day", "Night", "Night"];
  const attendance = [];
  Object.keys(raw.block.status || {}).forEach((pid) => {
    const arr = raw.block.status[pid] || [];
    for (let i = 0; i < shifts.length; i++) {
      const label = arr[i] || "Present";
      attendance.push({ date: addDays(start, i), personId: pid, statusId: LABEL_TO_STATUS[label] || "present" });
    }
  });

  const assignments = [];
  let generatedAt = null;
  if (raw.block.roster) {
    generatedAt = new Date().toISOString();
    raw.block.roster.forEach((day, i) => {
      const date = addDays(start, i);
      Object.keys(day.assign || {}).forEach((roleId) => {
        const personId = day.assign[roleId];
        if (personId) assignments.push({ date, roleId, personId, source: "generated" });
      });
    });
  }

  /* Temporarily attach roles/people so log migration can resolve names when possible. */
  const draft = { people, roles };
  const prev = S.data;
  S.data = draft;
  let history;
  try {
    history = (raw.log || []).map(migrateLogEntry);
  } finally {
    S.data = prev;
  }

  return normalizeV2({
    schemaVersion: 2,
    meta: {
      title: "Shift Manager",
      unitName: "",
      updatedAt: new Date().toISOString(),
      app: "shift-manager-html"
    },
    settings: {
      statuses: defaultStatusesCopy(),
      defaultShifts: ["Day", "Day", "Night", "Night"],
      blockLengthDays: 4
    },
    groups,
    roles,
    people,
    personRoles,
    blocks: {
      current: {
        id: "b_current",
        startDate: start,
        shifts,
        stale: !!raw.block.stale,
        generatedAt,
        attendance,
        assignments
      },
      history
    },
    audit: []
  });
}

function normalizeV2(d) {
  if (!d.meta) d.meta = { title: "Shift Manager", unitName: "", updatedAt: new Date().toISOString(), app: "shift-manager-html" };
  if (!d.settings) d.settings = { statuses: defaultStatusesCopy(), defaultShifts: ["Day", "Day", "Night", "Night"], blockLengthDays: 4 };
  /* Keep known status print colours on the current palette (Present green; others shared blue). */
  if (d.settings.statuses) {
    const byId = Object.fromEntries(DEFAULT_STATUSES.map((s) => [s.id, s]));
    d.settings.statuses.forEach((s) => {
      if (byId[s.id]) s.printColor = byId[s.id].printColor;
    });
    /* Statuses added in later versions (e.g. Paternity leave) appear in files saved before them. */
    DEFAULT_STATUSES.forEach((s) => { if (!d.settings.statuses.some((x) => x.id === s.id)) d.settings.statuses.push({ ...s }); });
  }
  if (!d.personRoles) d.personRoles = [];
  if (!d.blocks) d.blocks = { current: null, history: [] };
  if (!d.blocks.history) d.blocks.history = [];
  if (!d.audit) d.audit = [];
  const c = d.blocks.current;
  if (!c.attendance) c.attendance = [];
  if (!c.assignments) c.assignments = [];
  /* H37: spare notes / HVB deprecated — always clear on open. */
  c.spareNotes = [];
  if (c.generatedAt === undefined) c.generatedAt = c.assignments.length ? new Date().toISOString() : null;
  if (c.stale == null) c.stale = false;
  d.roles.forEach((r, i) => {
    if (r.groupId == null && r.group != null) r.groupId = r.group;
    if (r.usedAtDay == null) r.usedAtDay = true;
    if (r.usedAtNight == null && r.night != null) r.usedAtNight = !!r.night;
    if (r.skillRestricted == null && r.skill != null) r.skillRestricted = !!r.skill;
    if (r.essential == null) r.essential = true;
    if (r.sortOrder == null) r.sortOrder = i + 1;
  });
  d.people.forEach((p) => {
    if (p.fixedRoleId === undefined && p.only !== undefined) p.fixedRoleId = p.only || null;
    if (p.employeeNo == null) p.employeeNo = "";
    if (p.shoulderNo == null) p.shoulderNo = "";
  });
  d.groups.forEach((g, i) => { if (g.sortOrder == null) g.sortOrder = i + 1; });
  /* H20: print colour lives on the role. Files saved with colours on groups: copy onto roles, drop from groups. */
  d.roles.forEach((r) => { if (!r.color) r.color = (d.groups.find((g) => g.id === r.groupId) || {}).color || DEFAULT_ROLE_COLOR; });
  d.groups.forEach((g) => { delete g.color; });
  /* H70: Once per block on a group; a group whose roles were ticked keeps the old per-group behaviour. */
  d.groups.forEach((g) => { if (g.oncePerBlock == null) g.oncePerBlock = d.roles.some((r) => r.groupId === g.id && r.oncePerBlock); });
  /* H75: Probationers are kept apart only within probationer groups. Files saved before this applied the rule
     to every group, so with a Probationer on file make one probationer group per group that has roles. */
  if (!Array.isArray(d.probationerGroups)) {
    d.probationerGroups = [];
    if (d.people.some((p) => p.probationer)) {
      d.groups.forEach((g) => {
        const rs = d.roles.filter((r) => r.groupId === g.id);
        if (!rs.length) return;
        const pg = { id: "pg_" + g.id, name: g.name, sortOrder: d.probationerGroups.length + 1 };
        d.probationerGroups.push(pg);
        rs.forEach((r) => { r.probGroupId = pg.id; });
      });
    }
  }
  return d;
}

export function isValidDocument(d) {
  try { migrateToV2(d); return true; } catch (e) { return false; }
}

/* state.js imports emptyData() from here, and this module reads S back from state.js -
   a circular import, but a safe one: S is only ever dereferenced inside D(), which runs
   long after both modules finish loading, never during the initial module evaluation. */
export const D = () => S.data;
export const block = () => D().blocks.current;
export const history = () => D().blocks.history;
export const stationName = () => ((D().meta && D().meta.stationName) || "").trim();
export const unitName = () => ((D().meta && D().meta.unitName) || "").trim();

export const roleById = (id) => D().roles.find((r) => r.id === id);
export const personById = (id) => D().people.find((p) => p.id === id);
export const groupById = (id) => D().groups.find((g) => g.id === id) || { name: "" };
export const DEFAULT_ROLE_COLOR = "#BFDBFE";
/** H20: print / roster colour of a role (by id or object). */
export const roleColor = (r) => { const ro = typeof r === "string" ? roleById(r) : r; return (ro && ro.color) || "#E5E7EB"; };
export const activePeople = () => D().people.filter((p) => p.active !== false);

/** H73: the Files role, or null if not configured. */
export const filesRole = () => D().roles.find((r) => r.files) || null;
/** H73: check if a roleId is the Files role. */
export const isFilesRole = (rid) => { const r = roleById(rid); return !!(r && r.files); };

export const blockLen = () => (D().settings && D().settings.blockLengthDays) || block().shifts.length || 4;
export const dateOf = (d) => addDays(block().startDate, d);
export const shiftOf = (d) => block().shifts[d];
export const rolesForDay = (d) => D().roles.filter((r) => (shiftOf(d) === "Day" ? r.usedAtDay !== false : r.usedAtNight));
/** Roles in the order shown on Roles and groups: essential first, then the rest, each by sortOrder. */
export function rolesInListOrder() {
  return D().roles.slice().sort((a, b) => {
    const ae = a.essential !== false ? 0 : 1;
    const be = b.essential !== false ? 0 : 1;
    if (ae !== be) return ae - be;
    return (a.sortOrder || 0) - (b.sortOrder || 0);
  });
}
export const essentialRolesForDay = (d) => rolesForDay(d).filter((r) => r.essential !== false);
export const isEssentialRole = (r) => !r || r.essential !== false;
export const dayLabels = () => block().shifts.map((s, d) => ({ label: fmt(dateOf(d)), shift: s, iso: dateOf(d) }));

export function statusLabel(statusId) {
  const s = (D().settings.statuses || defaultStatusesCopy()).find((x) => x.id === statusId);
  return (s && s.label) || STATUS_TO_LABEL[statusId] || "Present";
}
export function statusIdForLabel(label) {
  return LABEL_TO_STATUS[label] || "present";
}

/** H67: is this person's long-term sick period (people[].longTermSick {from, to?}) covering `date`? */
function longTermSickOn(p, date) {
  const l = p && p.longTermSick;
  return !!(l && l.from && date >= l.from && (!l.to || date <= l.to));
}

/** H67: set a long-term sick period (inclusive dates, `to` empty = open-ended). False if the dates are invalid. */
export function setLongTermSick(pid, from, to) {
  const p = personById(pid);
  if (!p || !from || (to && to < from)) return false;
  p.longTermSick = { from, to: to || "" };
  return true;
}

export function clearLongTermSick(pid) {
  const p = personById(pid);
  if (p) delete p.longTermSick;
}

export function getStatus(pid, d) {
  const date = dateOf(d);
  const row = block().attendance.find((a) => a.personId === pid && a.date === date);
  if (row) return statusLabel(row.statusId);
  return longTermSickOn(personById(pid), date) ? statusLabel("sick_leave") : "Present";
}

export function setStatus(pid, d, label) {
  const date = dateOf(d);
  const statusId = statusIdForLabel(label);
  const rows = block().attendance;
  const i = rows.findIndex((a) => a.personId === pid && a.date === date);
  /* H67: on a day a long-term sick period covers, Present must be stored to override it. */
  if (statusId === "present" && !longTermSickOn(personById(pid), date)) {
    if (i >= 0) rows.splice(i, 1);
  } else if (i >= 0) { rows[i].statusId = statusId; if (statusId !== "duty_away") delete rows[i].note; }
  else rows.push({ date, personId: pid, statusId });
}

/** Typed description for a Duty away day (attendance row `note`); "" for any other status. Still counts as Duty away. */
export function dutyAwayNote(pid, d) {
  const date = dateOf(d);
  const row = block().attendance.find((a) => a.personId === pid && a.date === date);
  return row && row.statusId === "duty_away" ? String(row.note || "") : "";
}
export function setDutyAwayNote(pid, d, text) {
  const date = dateOf(d);
  const row = block().attendance.find((a) => a.personId === pid && a.date === date);
  if (!row || row.statusId !== "duty_away") return;
  const t = String(text || "").trim().slice(0, 60);
  if (t) row.note = t; else delete row.note;
}

/** H66: active people on day d per attendance status, in Attendance order (zero counts kept). */
export function statusCountsForDay(d) {
  const ppl = activePeople();
  return STAT.map((label) => ({ label, n: ppl.filter((p) => getStatus(p.id, d) === label).length }));
}

export const isPresent = (p, d) => p.active !== false && getStatus(p.id, d) === "Present";

export function personRoleIds(pid) {
  return D().personRoles.filter((pr) => pr.personId === pid).map((pr) => pr.roleId);
}

export const qual = (p, rid) => D().personRoles.some((pr) => pr.personId === p.id && pr.roleId === rid);
export const canDo = (p, rid) => qual(p, rid) && (!p.fixedRoleId || p.fixedRoleId === rid);
/** Manual edits on day d: a fixed-role person who is no longer on their fixed role that day is free to take any role they are ticked for. */
export const canDoOn = (p, rid, d) => {
  if (canDo(p, rid)) return true;
  if (!qual(p, rid)) return false;
  const days = rosterDays();
  return !!days && !!days[d] && roleOfPerson(days[d], p.id) !== p.fixedRoleId;
};
export const qualCount = (p) => personRoleIds(p.id).length;

export function setQual(pid, rid, on) {
  const i = D().personRoles.findIndex((pr) => pr.personId === pid && pr.roleId === rid);
  if (on && i < 0) D().personRoles.push({ personId: pid, roleId: rid });
  if (!on && i >= 0) {
    D().personRoles.splice(i, 1);
    const p = personById(pid);
    if (p && p.fixedRoleId === rid) p.fixedRoleId = null;
  }
}

export function removeRoleEverywhere(rid) {
  D().personRoles = D().personRoles.filter((pr) => pr.roleId !== rid);
  D().people.forEach((p) => { if (p.fixedRoleId === rid) p.fixedRoleId = null; });
  const b = block();
  b.assignments = b.assignments.filter((a) => a.roleId !== rid);
}

export function removePersonEverywhere(pid) {
  D().personRoles = D().personRoles.filter((pr) => pr.personId !== pid);
  const b = block();
  b.attendance = b.attendance.filter((a) => a.personId !== pid);
  b.assignments = b.assignments.filter((a) => a.personId !== pid);
}

export const hasRoster = () => block().generatedAt != null;
export const isStale = () => !!block().stale;

export function markStale() {
  if (hasRoster()) block().stale = true;
}

/** Day-indexed assign map used by generator and roster UI.
 * Live holders only: a stored assignment whose person is not Present is vacated
 * (`assign[roleId] = null`, `former[roleId] = personId`). Returning to Present restores.
 * H73: Files role rows are stored separately in `files` (Present holders) and `formerFiles` (vacated). */
export function rosterDays() {
  if (!hasRoster()) return null;
  const n = blockLen();
  const out = [];
  const fr = filesRole();
  for (let d = 0; d < n; d++) {
    const date = dateOf(d);
    const assign = {};
    const former = {};
    const files = [];
    const formerFiles = [];
    rolesForDay(d).forEach((r) => { if (!isFilesRole(r.id)) assign[r.id] = null; });
    block().assignments.filter((a) => a.date === date).forEach((a) => {
      const p = personById(a.personId);
      const isFiles = isFilesRole(a.roleId);
      if (isFiles) {
        if (p && isPresent(p, d)) files.push(a.personId);
        else formerFiles.push(a.personId);
      } else {
        if (p && isPresent(p, d)) assign[a.roleId] = a.personId;
        else {
          assign[a.roleId] = null;
          former[a.roleId] = a.personId;
        }
      }
    });
    out.push({ assign, former, files, formerFiles });
  }
  return out;
}

/** All unfilled roles for a day, essential and non-essential (H37 extension — Roster "Add role" selector).
 * H73: Files role is always "open" (unlimited holders). */
export function openRolesForDay(d) {
  const days = rosterDays();
  if (!days) return [];
  const assign = days[d].assign;
  const roles = rolesForDay(d).filter((r) => !assign[r.id]);
  const fr = filesRole();
  if (fr && rolesForDay(d).some((r) => r.id === fr.id) && !roles.includes(fr)) roles.push(fr);
  return roles;
}

/**
 * H37 extension: why an Unassigned cell offers no "Add role" option for this person.
 * Returns null when at least one open role is offered, otherwise "none-open" (nothing
 * unfilled for anyone that day) or "not-eligible" (not Present) / "not-qualified".
 */
export function unassignedReason(d, pid) {
  const open = openRolesForDay(d);
  if (!open.length) return "none-open";
  const p = personById(pid);
  if (!p || !isPresent(p, d)) return "not-eligible";
  return open.some((r) => canDoOn(p, r.id, d)) ? null : "not-qualified";
}

/** Vacated essential roles for a day (for Unallocated strip / warnings). */
export function vacatedEssential(d) {
  const days = rosterDays();
  if (!days) return [];
  const day = days[d];
  return essentialRolesForDay(d)
    .filter((r) => !day.assign[r.id])
    .map((r) => ({
      roleId: r.id,
      name: r.name,
      wasPersonId: day.former[r.id] || null,
      wasName: day.former[r.id] ? ((personById(day.former[r.id]) || {}).name || "") : ""
    }));
}

/**
 * Rewrite one day's assignment rows from a live assign map, preserving vacated
 * (non-Present) rows for roles that remain null and were not cleared.
 * H73: Files rows are kept unless their person now holds a role in assign or was cleared.
 * @param {number} d day index
 * @param {Record<string, string|null>} assign live map (never contains Files role)
 * @param {Set<string>|string[]} [clearedRoleIds] roles explicitly unassigned (drop vacated row)
 */
export function writeDayAssign(d, assign, clearedRoleIds) {
  const date = dateOf(d);
  const cleared = clearedRoleIds instanceof Set ? clearedRoleIds : new Set(clearedRoleIds || []);
  const fr = filesRole();
  const keptVacated = block().assignments.filter((a) => {
    if (a.date !== date) return false;
    if (isFilesRole(a.roleId)) return false; // H73: Files rows handled separately
    if (assign[a.roleId]) return false;
    if (cleared.has(a.roleId)) return false;
    const p = personById(a.personId);
    return !(p && isPresent(p, d));
  });

  // H73: keep Files rows unless person now holds a role in assign or was explicitly cleared
  const keptFiles = [];
  if (fr) {
    block().assignments.filter((a) => a.date === date && isFilesRole(a.roleId)).forEach((a) => {
      if (!Object.values(assign).includes(a.personId)) keptFiles.push(a);
    });
  }

  block().assignments = block().assignments.filter((a) => a.date !== date);

  Object.keys(assign).forEach((roleId) => {
    if (assign[roleId]) {
      block().assignments.push({ date, roleId, personId: assign[roleId], source: "manual" });
    }
  });

  keptVacated.forEach((a) => {
    if (!block().assignments.some((x) => x.date === date && x.roleId === a.roleId)) {
      block().assignments.push(a);
    }
  });

  // H73: restore Files rows for people not now holding a role
  keptFiles.forEach((a) => {
    if (!block().assignments.some((x) => x.date === date && x.personId === a.personId && isFilesRole(x.roleId))) {
      block().assignments.push(a);
    }
  });
}

export function roleOfPerson(dayAssign, pid) {
  const k = Object.keys(dayAssign.assign).filter((r) => dayAssign.assign[r] === pid);
  if (k.length) return k[0];
  // H73: check if person is in Files
  const fr = filesRole();
  if (fr && (dayAssign.files || []).includes(pid)) return fr.id;
  return null;
}

export function roleOfPersonOnDay(d, pid) {
  const date = dateOf(d);
  const a = block().assignments.find((x) => x.date === date && x.personId === pid);
  return a ? a.roleId : null;
}

/** H73: add or remove Files for a person on a given day.
 * @param {number} d day index
 * @param {string} pid person id
 * @param {boolean} on true = add Files, false = remove Files
 */
export function setFiles(d, pid, on) {
  const fr = filesRole();
  if (!fr) return;
  const date = dateOf(d);
  const existing = block().assignments.find((a) => a.date === date && a.personId === pid && a.roleId === fr.id);
  if (on && !existing) {
    // Remove any other role for this person on this day
    block().assignments = block().assignments.filter((a) => !(a.date === date && a.personId === pid));
    block().assignments.push({ date, roleId: fr.id, personId: pid, source: "manual" });
  } else if (!on && existing) {
    block().assignments = block().assignments.filter((a) => !(a.date === date && a.personId === pid && a.roleId === fr.id));
  }
}

export function writeRoster(days, source) {
  const src = source || "generated";
  const assignments = [];
  const fr = filesRole();
  days.forEach((day, d) => {
    const date = dateOf(d);
    Object.keys(day.assign || {}).forEach((roleId) => {
      const personId = day.assign[roleId];
      if (personId) assignments.push({ date, roleId, personId, source: src });
    });
    // H73: add Files role rows
    if (fr && day.files) {
      day.files.forEach((personId) => {
        assignments.push({ date, roleId: fr.id, personId, source: src });
      });
    }
  });
  const b = block();
  b.assignments = assignments;
  b.generatedAt = new Date().toISOString();
  b.stale = false;
  touchMeta();
}

export function setAssignment(d, rid, pid, source) {
  const date = dateOf(d);
  const rows = block().assignments;
  const i = rows.findIndex((a) => a.date === date && a.roleId === rid);
  if (!pid) {
    if (i >= 0) rows.splice(i, 1);
  } else if (i >= 0) {
    rows[i].personId = pid;
    rows[i].source = source || "manual";
  } else {
    rows.push({ date, roleId: rid, personId: pid, source: source || "manual" });
  }
}

export function swapOrAssign(d, rid, pid) {
  const days = rosterDays();
  if (!days) return;
  const day = days[d];
  const holder = day.assign[rid] || null;
  let old = pid ? roleOfPerson(day, pid) : null;
  // H73: Files holder is treated as having no role
  if (old && isFilesRole(old)) old = null;
  const next = { ...day.assign };
  next[rid] = pid || null;
  if (pid && old) next[old] = holder || null;
  const cleared = new Set([rid]);
  if (old) cleared.add(old);
  writeDayAssign(d, next, cleared);
}

export function touchMeta() {
  if (D().meta) D().meta.updatedAt = new Date().toISOString();
}

export function snapshotBlockForHistory(snap) {
  const b = block();
  const savedBy = (snap && snap.savedBy) || "";
  return {
    id: "b_" + Math.random().toString(36).slice(2, 9),
    savedAt: new Date().toISOString(),
    savedBy,
    startDate: b.startDate,
    shifts: b.shifts.slice(),
    attendance: b.attendance.map((a) => ({ ...a })),
    assignments: b.assignments.map((a) => ({ ...a })),
    spareNotes: [],
    snap,
    records: snap.records
  };
}

/** Block start on a history row (`startDate` preferred; legacy `start` also matched). */
export function historyStart(h) {
  if (!h) return "";
  return h.startDate || h.start || "";
}

export function findHistoryIndexForStart(start) {
  if (!start) return -1;
  return history().findIndex((h) => historyStart(h) === start);
}

/** Replace existing history row for this start, or push. Keeps entry.id when replacing. */
/** H69: has this block's last day passed? (`today` is injectable for tests.) */
export function isPastBlock(today = iso(new Date())) {
  return dateOf(blockLen() - 1) < today;
}

/** H69: a block that already has a roster is never regenerated once it has passed; a first Generate is always allowed. */
export const canRegenerate = (today) => !(hasRoster() && isPastBlock(today));

/** H68: does a log entry carry its own dates, shifts, attendance and assignments (i.e. can it be reopened)? */
export const canEditHistory = (h) => !!(h && historyStart(h) && Array.isArray(h.shifts) && Array.isArray(h.attendance) && Array.isArray(h.assignments));

/** H68: copy a saved log entry into the working block (deep copy — the log entry is never touched). */
export function loadHistoryForEdit(id) {
  const h = history().find((x) => x.id === id);
  if (!canEditHistory(h)) return false;
  const c = block();
  c.startDate = historyStart(h);
  c.shifts = h.shifts.slice();
  c.attendance = h.attendance.map((a) => ({ ...a }));
  c.assignments = h.assignments.map((a) => ({ ...a }));
  c.generatedAt = h.savedAt || new Date().toISOString();
  c.stale = false;
  c.spareNotes = [];
  return true;
}

export function upsertHistoryEntry(entry) {
  const start = historyStart(entry) || block().startDate;
  const i = findHistoryIndexForStart(start);
  const rows = history();
  if (i >= 0) {
    const prevId = rows[i].id;
    rows[i] = { ...entry, id: prevId || entry.id, startDate: start };
    delete rows[i].start;
  } else {
    rows.push({ ...entry, startDate: start });
  }
}

/** Saved four-day periods from the log, newest first. */
export function historicPeriods() {
  return history().map((e) => {
    const start = e.startDate || e.start || (e.snap && e.snap.days && e.snap.days[0] && e.snap.days[0].iso) || "";
    const shifts = e.shifts || (e.snap && e.snap.days ? e.snap.days.map((d) => d.shift) : ["Day", "Day", "Night", "Night"]);
    const end = start ? addDays(start, Math.max(shifts.length - 1, 0)) : "";
    const y = start ? +start.slice(0, 4) : 0;
    const m = start ? start.slice(0, 7) : "";
    const rangeLabel = start && end
      ? fmt(start) + " – " + fmtLong(end)
      : "Unknown period";
    const savedLabel = e.savedAt ? new Date(e.savedAt).toLocaleString("en-IE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
    return {
      id: e.id,
      startDate: start,
      endDate: end,
      year: y,
      monthKey: m,
      shifts,
      rangeLabel,
      savedLabel,
      savedAt: e.savedAt,
      entry: e
    };
  }).filter((p) => p.startDate).sort((a, b) => (b.startDate + b.savedAt).localeCompare(a.startDate + a.savedAt));
}

export function historicYears() {
  const ys = [...new Set(historicPeriods().map((p) => p.year).filter(Boolean))];
  return ys.sort((a, b) => b - a);
}

export function historicMonthsInYear(year) {
  const keys = [...new Set(historicPeriods().filter((p) => p.year === +year).map((p) => p.monthKey))];
  return keys.sort().reverse();
}

export function historicPeriodsInMonth(monthKey) {
  return historicPeriods().filter((p) => p.monthKey === monthKey);
}

/**
 * Rebuild a read-only roster view model from a history entry
 * (same shape the Historic roster screen needs).
 */
export function historicRosterModel(entry) {
  if (!entry) return null;
  const start = entry.startDate || entry.start;
  const shifts = entry.shifts || (entry.snap && entry.snap.days ? entry.snap.days.map((d) => d.shift) : ["Day", "Day", "Night", "Night"]);
  if (!start) return null;

  const days = shifts.map((s, d) => ({ label: fmt(addDays(start, d)), shift: s, iso: addDays(start, d) }));

  /* Prefer live catalogue; fall back to names from records/snap. */
  const peopleMap = {};
  D().people.forEach((p) => { peopleMap[p.id] = { id: p.id, name: p.name, active: p.active !== false }; });
  (entry.assignments || []).forEach((a) => {
    if (a.personId && !peopleMap[a.personId]) {
      const live = personById(a.personId);
      peopleMap[a.personId] = live ? { id: live.id, name: live.name, active: true } : { id: a.personId, name: a.personId, active: true };
    }
  });
  (entry.records || []).forEach((r) => {
    if (!r.person) return;
    const live = D().people.find((p) => p.name === r.person);
    const id = live ? live.id : "name:" + r.person;
    if (!peopleMap[id]) peopleMap[id] = { id, name: r.person, active: true };
  });
  if (entry.snap && entry.snap.byDay) {
    entry.snap.byDay.forEach((bd) => {
      (bd.people || []).forEach((p) => {
        if (p.id && !peopleMap[p.id]) peopleMap[p.id] = { id: p.id, name: p.name, active: true };
      });
    });
  }
  if (entry.snap && entry.snap.people) {
    entry.snap.people.forEach((p) => {
      if (p.id && !peopleMap[p.id]) peopleMap[p.id] = { id: p.id, name: p.name, active: true };
    });
  }
  const people = Object.values(peopleMap).sort((a, b) => a.name.localeCompare(b.name));

  const statusFor = (pid, date) => {
    const row = (entry.attendance || []).find((a) => a.personId === pid && a.date === date);
    if (row) return statusLabel(row.statusId);
    const person = peopleMap[pid];
    const rec = (entry.records || []).find((r) => r.date === date && person && r.person === person.name);
    return (rec && rec.status) || "Present";
  };

  const roster = days.map((day) => {
    const assign = {}; const files = [];
    (entry.assignments || []).filter((a) => a.date === day.iso).forEach((a) => {
      if (isFilesRole(a.roleId)) files.push(a.personId); else assign[a.roleId] = a.personId;
    });
    /* Fallback from records when no structured assignments. */
    if (!Object.keys(assign).length && entry.records) {
      entry.records.filter((r) => r.date === day.iso && r.status === "Present" && r.role && r.role !== "Spare").forEach((r) => {
        const role = D().roles.find((x) => x.name === r.role);
        const person = D().people.find((p) => p.name === r.person) || people.find((p) => p.name === r.person);
        if (role && person) assign[role.id] = person.id;
      });
    }
    return { assign, files };
  });

  const rolesFor = (d) => D().roles.filter((r) => (days[d].shift === "Day" ? r.usedAtDay !== false : r.usedAtNight));

  return { start, days, people, roster, statusFor, rolesFor };
}

/**
 * Month-by-month duty load for one person from the current block + saved log.
 * Returns [{ month, label, duties, day, night, hard, groups: [{ name, n }], roles: [{ name, n }] }]
 */
export function personLoadByMonth(personId, opts) {
  const person = personById(personId);
  if (!person) return [];
  const onlyMonth = opts && opts.month;
  const buckets = {};

  const shiftLookup = buildShiftLookup();

  const bump = (date, roleId, roleName, shiftHint) => {
    if (!date) return;
    const month = String(date).slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) return;
    if (onlyMonth && month !== onlyMonth) return;
    if (opts && opts.from && String(date) < opts.from) return;
    if (opts && opts.to && String(date) > opts.to) return;
    if (!buckets[month]) {
      buckets[month] = { duties: 0, day: 0, night: 0, hard: 0, groups: {}, roles: {} };
    }
    const b = buckets[month];
    b.duties += 1;
    const shift = shiftHint || shiftLookup[date] || "Day";
    if (shift === "Night") b.night += 1; else b.day += 1;
    const role = roleId ? roleById(roleId) : (roleName ? D().roles.find((x) => x.name === roleName) : null);
    const name = (role && role.name) || roleName || "Role";
    if (role && role.hard) b.hard += 1;
    const gName = role ? (groupById(role.groupId).name || "Other") : "Other";
    b.groups[gName] = (b.groups[gName] || 0) + 1;
    b.roles[name] = (b.roles[name] || 0) + 1;
  };

  block().assignments.forEach((a) => {
    if (a.personId === personId) bump(a.date, a.roleId, null, shiftLookup[a.date]);
  });

  const currentStart = block().startDate;
  history().forEach((h) => {
    /* Skip saved copy of the live block so Save roster upsert does not double-count. */
    if (historyStart(h) === currentStart) return;
    const hShifts = shiftMapForEntry(h);
    (h.assignments || []).forEach((a) => {
      if (a.personId === personId) bump(a.date, a.roleId, null, hShifts[a.date] || shiftLookup[a.date]);
    });
    (h.records || []).forEach((r) => {
      if (r.person !== person.name) return;
      if (!r.role || r.role === "Spare" || r.status !== "Present") return;
      if (h.assignments && h.assignments.length) return;
      const role = D().roles.find((x) => x.name === r.role);
      bump(r.date, role ? role.id : null, r.role, r.shift || hShifts[r.date]);
    });
  });

  return Object.keys(buckets).sort().reverse().map((month) => {
    const b = buckets[month];
    const [y, m] = month.split("-");
    const label = new Date(+y, +m - 1, 1).toLocaleDateString("en-IE", { month: "long", year: "numeric" });
    const roles = Object.keys(b.roles).sort((a, c) => b.roles[c] - b.roles[a] || a.localeCompare(c))
      .map((name) => ({ name, n: b.roles[name] }));
    const groups = Object.keys(b.groups).sort((a, c) => b.groups[c] - b.groups[a] || a.localeCompare(c))
      .map((name) => ({ name, n: b.groups[name] }));
    return {
      month, label,
      duties: b.duties, day: b.day, night: b.night,
      hard: b.hard, groups, roles
    };
  });
}

/** Helper for historicRoleCounts and lastFilesDate: check if person was Present on date in a history entry. */
function presentOnInHistory(h, pid, date) {
  const row = (h.attendance || []).find((a) => a.personId === pid && a.date === date);
  if (row) return row.statusId === "present";
  return !longTermSickOn(personById(pid), date);
}

/**
 * H28: how many times each person did each role in saved rotas, keyed "personId|roleId".
 * Window: the LOOKBACK_MONTHS before the block being generated starts (older and later-dated
 * saved blocks are ignored, as is the saved copy of this block). Only days the person was
 * Present count — a saved assignment on a leave / sick day is not a duty done.
 */
export function historicRoleCounts() {
  const counts = {};
  const bump = (pid, rid) => { const k = pid + "|" + rid; counts[k] = (counts[k] || 0) + 1; };
  const currentStart = block().startDate;
  const from = new Date(currentStart + "T12:00:00");
  from.setMonth(from.getMonth() - LOOKBACK_MONTHS);
  const inWindow = (date) => !!date && date >= iso(from) && date < currentStart;
  history().forEach((h) => {
    if (historyStart(h) === currentStart) return;
    if (h.assignments && h.assignments.length) {
      h.assignments.forEach((a) => {
        if (a.personId && a.roleId && inWindow(a.date) && presentOnInHistory(h, a.personId, a.date)) bump(a.personId, a.roleId);
      });
      return;
    }
    (h.records || []).forEach((r) => {
      if (!r.role || r.role === "Spare" || r.status !== "Present" || !inWindow(r.date)) return;
      const role = D().roles.find((x) => x.name === r.role);
      const p = D().people.find((x) => x.name === r.person);
      if (role && p) bump(p.id, role.id);
    });
  });
  return counts;
}

/** H74: latest date strictly before dateOf(d) on which pid had the Files role and was Present.
 * Checks history entries + current block earlier days. Returns ISO date string or null. */
export function lastFilesDate(pid, d) {
  const fr = filesRole();
  if (!fr) return null;
  const beforeDate = dateOf(d);
  const currentStart = block().startDate;
  let lastDate = null;

  // Check earlier days of current block
  for (let i = 0; i < d; i++) {
    const date = dateOf(i);
    if (isPresent(personById(pid), i)) {
      const hasFiles = block().assignments.some((a) => a.date === date && a.personId === pid && a.roleId === fr.id);
      if (hasFiles && (!lastDate || date > lastDate)) lastDate = date;
    }
  }

  // Check history entries (skip saved copy of current block)
  history().forEach((h) => {
    if (historyStart(h) === currentStart) return;
    (h.assignments || []).forEach((a) => {
      if (a.personId === pid && a.roleId === fr.id && a.date < beforeDate && presentOnInHistory(h, pid, a.date)) {
        if (!lastDate || a.date > lastDate) lastDate = a.date;
      }
    });
  });

  return lastDate;
}

function shiftMapForEntry(h) {
  const map = {};
  const start = h.startDate || h.start;
  const shifts = h.shifts || (h.snap && h.snap.days ? h.snap.days.map((d) => d.shift) : null);
  if (start && shifts) {
    shifts.forEach((s, i) => { map[addDays(start, i)] = s; });
  }
  if (h.snap && h.snap.days) {
    h.snap.days.forEach((d) => { if (d.iso) map[d.iso] = d.shift || map[d.iso]; });
  }
  (h.records || []).forEach((r) => { if (r.date && r.shift) map[r.date] = r.shift; });
  return map;
}

function buildShiftLookup() {
  const map = {};
  const b = block();
  (b.shifts || []).forEach((s, i) => { map[addDays(b.startDate, i)] = s; });
  history().forEach((h) => {
    Object.assign(map, shiftMapForEntry(h));
  });
  return map;
}

export function currentMonthKey() {
  const n = new Date();
  return n.getFullYear() + "-" + String(n.getMonth() + 1).padStart(2, "0");
}

export function monthLabel(month) {
  const [y, m] = month.split("-");
  return new Date(+y, +m - 1, 1).toLocaleDateString("en-IE", { month: "long", year: "numeric" });
}

/** All month keys that have any assignment history (current + log). */
export function loadMonths() {
  const set = {};
  const mark = (date) => {
    if (!date) return;
    const month = String(date).slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(month)) set[month] = true;
  };
  block().assignments.forEach((a) => mark(a.date));
  history().forEach((h) => {
    (h.assignments || []).forEach((a) => mark(a.date));
    (h.records || []).forEach((r) => { if (r.date && r.role && r.role !== "Spare") mark(r.date); });
  });
  return Object.keys(set).sort().reverse();
}

/** First and last day of a "YYYY-MM" month, as ISO dates (the "-31" end still compares correctly). */
export const monthRange = (month) => ({ from: month + "-01", to: month + "-31" });

/** Earliest date with any recorded duty / attendance (current planned block + log), or null. */
export function earliestStatsDate() {
  let min = null;
  const see = (d) => { if (d && /^\d{4}-\d{2}-\d{2}$/.test(d) && (!min || d < min)) min = d; };
  const b = block();
  (b.assignments || []).forEach((a) => see(a.date));
  if (b.generatedAt) see(b.startDate);
  history().forEach((h) => {
    see(historyStart(h));
    (h.assignments || []).forEach((a) => see(a.date));
    (h.records || []).forEach((r) => see(r.date));
  });
  return min;
}

/** Resolve the Duty stats period: default is everything from the start of the data up to today. */
export function statsRange(from, to, today) {
  const t = today || iso(new Date());
  let f = from || earliestStatsDate() || t;
  let e = to || t;
  if (f > e) { const x = f; f = e; e = x; }
  return { from: f, to: e };
}

/** One person's duties across a date range (months summed): { duties, day, night, hard, groups, roles }. */
export function personLoadForRange(pid, range) {
  const rows = personLoadByMonth(pid, { from: range.from, to: range.to });
  const tot = { duties: 0, day: 0, night: 0, hard: 0 };
  const groups = {}; const roles = {};
  rows.forEach((r) => {
    Object.keys(tot).forEach((k) => { tot[k] += r[k] || 0; });
    (r.groups || []).forEach((g) => { groups[g.name] = (groups[g.name] || 0) + g.n; });
    (r.roles || []).forEach((x) => { roles[x.name] = (roles[x.name] || 0) + x.n; });
  });
  const list = (o) => Object.keys(o).map((name) => ({ name, n: o[name] }))
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name, "en-IE"));
  return { ...tot, groups: list(groups), roles: list(roles) };
}

/** Team rows for a date range */
export function teamLoadForRange(range) {
  return D().people.map((p) => {
    const m = personLoadForRange(p.id, range);
    return { person: p, duties: m.duties, day: m.day, night: m.night, hard: m.hard, groups: m.groups, roles: m.roles };
  }).filter((r) => r.duties > 0 || r.person.active !== false)
    .sort((a, b) => b.duties - a.duties || a.person.name.localeCompare(b.person.name));
}

/** Team rows for one month */
export function teamLoadForMonth(month) {
  return teamLoadForRange(monthRange(month));
}

/** Role columns in Roles-screen order (essential first); `extraNames` are duties found in the log but no longer in the list. */
function roleColumns(extraNames) {
  const seen = new Set();
  const roles = [];
  D().roles.slice()
    .sort((a, b) => ((a.essential !== false ? 0 : 1) - (b.essential !== false ? 0 : 1)) || ((a.sortOrder || 0) - (b.sortOrder || 0)))
    .forEach((r) => {
      if (seen.has(r.name)) return;
      seen.add(r.name);
      roles.push({ name: r.name, hard: !!r.hard, essential: r.essential !== false });
    });
  const extra = [];
  extraNames.forEach((name) => { if (!seen.has(name)) { seen.add(name); extra.push(name); } });
  extra.sort((a, b) => a.localeCompare(b, "en-IE"))
    .forEach((name) => roles.push({ name, hard: false, essential: true, retired: true }));
  return roles;
}

/**
 * Days per attendance status for one person over a date range: { rows: [{ label, n }], days }.
 * Sources: the current block (only once its roster is generated; unlisted days are Present) and
 * saved log entries (their per-day records), skipping the saved copy of the live block.
 */
export function attendanceForRange(pid, range) {
  const p = personById(pid);
  const labels = (D().settings.statuses || defaultStatusesCopy()).map((x) => x.label);
  const counts = {};
  labels.forEach((l) => { counts[l] = 0; });
  const add = (label) => { const l = label || "Present"; counts[l] = (counts[l] || 0) + 1; };
  const inRange = (date) => !!date && date >= range.from && date <= range.to;
  if (p) {
    const b = block();
    if (b.generatedAt) {
      for (let d = 0; d < blockLen(); d++) if (inRange(dateOf(d))) add(getStatus(pid, d));
    }
    history().forEach((h) => {
      if (b.generatedAt && historyStart(h) === b.startDate) return;
      const recs = (h.records || []).filter((r) => r.person === p.name && inRange(r.date));
      if (recs.length) { recs.forEach((r) => add(r.status)); return; }
      (h.attendance || []).filter((a) => a.personId === pid && inRange(a.date)).forEach((a) => add(statusLabel(a.statusId)));
    });
  }
  const rows = Object.keys(counts).map((label) => ({ label, n: counts[label] }));
  return { rows, days: rows.reduce((n, r) => n + r.n, 0) };
}

/** One person's report over a date range: every role with their count, hard total, attendance. */
export function personReport(pid, range) {
  const person = personById(pid);
  const load = personLoadForRange(pid, range);
  const counts = {};
  load.roles.forEach((x) => { counts[x.name] = x.n; });
  const att = attendanceForRange(pid, range);
  return {
    person, range,
    roles: roleColumns(load.roles.map((x) => x.name)).map((c) => ({ ...c, n: counts[c.name] || 0 })),
    duties: load.duties, hard: load.hard,
    attendance: att.rows, attendanceDays: att.days
  };
}

/**
 * Duty stats pivot (H59): one row per person, one column per role, cell = times done in the date range (a "YYYY-MM" month string also works).
 * Columns follow the Roles screen (essential first, then list order); a duty that appears in the
 * log but is no longer in the role list still gets a column at the end so its counts are not lost.
 * `totals` tallies every column plus the grand total.
 */
export function dutyPivot(arg) {
  const range = typeof arg === "string" ? monthRange(arg) : arg;
  const team = teamLoadForRange(range);
  const extraNames = [];
  team.forEach((t) => t.roles.forEach((x) => extraNames.push(x.name)));
  const roles = roleColumns(extraNames);

  const rows = team.map((t) => {
    const counts = {};
    t.roles.forEach((x) => { counts[x.name] = (counts[x.name] || 0) + x.n; });
    /* Annual leave / Sick leave days in the same period (from the current block and saved rosters). */
    const att = {};
    attendanceForRange(t.person.id, range).rows.forEach((a) => { att[a.label] = a.n; });
    return { person: t.person, duties: t.duties, hard: t.hard, counts, att };
  });
  const totals = { duties: 0, hard: 0, counts: {}, att: {} };
  rows.forEach((r) => {
    totals.duties += r.duties; totals.hard += r.hard;
    Object.keys(r.counts).forEach((k) => { totals.counts[k] = (totals.counts[k] || 0) + r.counts[k]; });
    Object.keys(r.att).forEach((k) => { totals.att[k] = (totals.att[k] || 0) + r.att[k]; });
  });
  return { roles, rows, totals };
}

/** Last word of a name, for surname ordering. */
export const surnameOf = (name) => {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "";
};

/**
 * Sort pivot rows by "person" (surname, then given name) | "duties" | "hard" | "role:<name>" |
 * "att:<status label>"; ties fall back to surname order.
 */
export function sortPivotRows(rows, key, dir) {
  const val = (r) => (key === "duties" ? r.duties : key === "hard" ? r.hard
    : key.indexOf("role:") === 0 ? (r.counts[key.slice(5)] || 0)
    : key.indexOf("att:") === 0 ? ((r.att && r.att[key.slice(4)]) || 0) : 0);
  const byName = (a, b) => surnameOf(a.person.name).localeCompare(surnameOf(b.person.name), "en-IE") || a.person.name.localeCompare(b.person.name, "en-IE");
  const sign = dir === "asc" ? 1 : -1;
  return rows.slice().sort((a, b) => (key === "person" ? sign * byName(a, b) : (sign * (val(a) - val(b)) || byName(a, b))));
}

/** Header click: same column flips direction; a new column starts high-to-low (names A-Z). An explicit ▲/▼ press (`dir`) is used as given. */
export function nextPivotSort(cur, key, dir) {
  if (dir === "asc" || dir === "desc") return { key, dir };
  if (cur && cur.key === key) return { key, dir: cur.dir === "desc" ? "asc" : "desc" };
  return { key, dir: key === "person" ? "asc" : "desc" };
}
