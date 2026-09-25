import { iso, addDays, fmt, fmtLong } from "./util.js";
import { S } from "./state.js";

export const DEFAULT_STATUSES = [
  { id: "present", label: "Present", allocates: true, printColor: "#EAF4EC" },
  { id: "annual_leave", label: "Annual leave", allocates: false, printColor: "#BBDEFB" },
  { id: "sick_leave", label: "Sick leave", allocates: false, printColor: "#BBDEFB" },
  { id: "duty_away", label: "Duty away", allocates: false, printColor: "#BBDEFB" },
  { id: "rest_day", label: "Rest day", allocates: false, printColor: "#BBDEFB" }
];

const LABEL_TO_STATUS = {
  Present: "present",
  "Annual leave": "annual_leave",
  "Sick leave": "sick_leave",
  "Duty away": "duty_away",
  "Rest day": "rest_day"
};
const STATUS_TO_LABEL = {
  present: "Present",
  annual_leave: "Annual leave",
  sick_leave: "Sick leave",
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
      { id: "g1", name: "Car", color: "#F8BBD0", sortOrder: 1 },
      { id: "g2", name: "Beat", color: "#C8E6C9", sortOrder: 2 },
      { id: "g3", name: "Inside", color: "#FFE0B2", sortOrder: 3 }
    ],
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
  }));
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
  }
  if (!d.personRoles) d.personRoles = [];
  if (!d.blocks) d.blocks = { current: null, history: [] };
  if (!d.blocks.history) d.blocks.history = [];
  if (!d.audit) d.audit = [];
  const c = d.blocks.current;
  if (!c.attendance) c.attendance = [];
  if (!c.assignments) c.assignments = [];
  if (!c.spareNotes) c.spareNotes = [];
  if (c.generatedAt === undefined) c.generatedAt = c.assignments.length ? new Date().toISOString() : null;
  if (c.stale == null) c.stale = false;
  d.roles.forEach((r, i) => {
    if (r.groupId == null && r.group != null) r.groupId = r.group;
    if (r.usedAtDay == null) r.usedAtDay = true;
    if (r.usedAtNight == null && r.night != null) r.usedAtNight = !!r.night;
    if (r.skillRestricted == null && r.skill != null) r.skillRestricted = !!r.skill;
    if (r.sortOrder == null) r.sortOrder = i + 1;
  });
  d.people.forEach((p) => {
    if (p.fixedRoleId === undefined && p.only !== undefined) p.fixedRoleId = p.only || null;
  });
  d.groups.forEach((g, i) => { if (g.sortOrder == null) g.sortOrder = i + 1; });
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
export const unitName = () => ((D().meta && D().meta.unitName) || "").trim();

export const roleById = (id) => D().roles.find((r) => r.id === id);
export const personById = (id) => D().people.find((p) => p.id === id);
export const groupById = (id) => D().groups.find((g) => g.id === id) || { name: "", color: "#E5E7EB" };
export const activePeople = () => D().people.filter((p) => p.active !== false);

export const blockLen = () => (D().settings && D().settings.blockLengthDays) || block().shifts.length || 4;
export const dateOf = (d) => addDays(block().startDate, d);
export const shiftOf = (d) => block().shifts[d];
export const rolesForDay = (d) => D().roles.filter((r) => (shiftOf(d) === "Day" ? r.usedAtDay !== false : r.usedAtNight));
export const dayLabels = () => block().shifts.map((s, d) => ({ label: fmt(dateOf(d)), shift: s, iso: dateOf(d) }));

export function statusLabel(statusId) {
  const s = (D().settings.statuses || defaultStatusesCopy()).find((x) => x.id === statusId);
  return (s && s.label) || STATUS_TO_LABEL[statusId] || "Present";
}
export function statusIdForLabel(label) {
  return LABEL_TO_STATUS[label] || "present";
}

export function getStatus(pid, d) {
  const date = dateOf(d);
  const row = block().attendance.find((a) => a.personId === pid && a.date === date);
  return row ? statusLabel(row.statusId) : "Present";
}

export function setStatus(pid, d, label) {
  const date = dateOf(d);
  const statusId = statusIdForLabel(label);
  const rows = block().attendance;
  const i = rows.findIndex((a) => a.personId === pid && a.date === date);
  if (statusId === "present" && i >= 0) rows.splice(i, 1);
  else if (statusId === "present") { /* default — omit row */ }
  else if (i >= 0) rows[i].statusId = statusId;
  else rows.push({ date, personId: pid, statusId });
}

export const isPresent = (p, d) => p.active !== false && getStatus(p.id, d) === "Present";

export function personRoleIds(pid) {
  return D().personRoles.filter((pr) => pr.personId === pid).map((pr) => pr.roleId);
}

export const qual = (p, rid) => D().personRoles.some((pr) => pr.personId === p.id && pr.roleId === rid);
export const canDo = (p, rid) => qual(p, rid) && (!p.fixedRoleId || p.fixedRoleId === rid);
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

/** Day-indexed assign map used by generator and roster UI. */
export function rosterDays() {
  if (!hasRoster()) return null;
  const n = blockLen();
  const out = [];
  for (let d = 0; d < n; d++) {
    const date = dateOf(d);
    const assign = {};
    rolesForDay(d).forEach((r) => { assign[r.id] = null; });
    block().assignments.filter((a) => a.date === date).forEach((a) => { assign[a.roleId] = a.personId; });
    out.push({ assign });
  }
  return out;
}

export function roleOfPerson(dayAssign, pid) {
  const k = Object.keys(dayAssign.assign).filter((r) => dayAssign.assign[r] === pid);
  return k.length ? k[0] : null;
}

export function roleOfPersonOnDay(d, pid) {
  const date = dateOf(d);
  const a = block().assignments.find((x) => x.date === date && x.personId === pid);
  return a ? a.roleId : null;
}

export function writeRoster(days, source) {
  const src = source || "generated";
  const assignments = [];
  days.forEach((day, d) => {
    const date = dateOf(d);
    Object.keys(day.assign || {}).forEach((roleId) => {
      const personId = day.assign[roleId];
      if (personId) assignments.push({ date, roleId, personId, source: src });
    });
  });
  const b = block();
  b.assignments = assignments;
  b.generatedAt = new Date().toISOString();
  b.stale = false;
  touchMeta();
}

export function getSpareNote(pid, d) {
  const date = dateOf(d);
  const row = (block().spareNotes || []).find((n) => n.personId === pid && n.date === date);
  return row ? row.text : "";
}

export function setSpareNote(pid, d, text) {
  const date = dateOf(d);
  if (!block().spareNotes) block().spareNotes = [];
  const rows = block().spareNotes;
  const i = rows.findIndex((n) => n.personId === pid && n.date === date);
  const t = String(text || "").trim();
  if (!t) { if (i >= 0) rows.splice(i, 1); return; }
  if (i >= 0) rows[i].text = t;
  else rows.push({ date, personId: pid, text: t });
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
  const holder = day.assign[rid];
  const old = pid ? roleOfPerson(day, pid) : null;
  day.assign[rid] = pid;
  if (pid && old) day.assign[old] = holder || null;
  /* Rewrite that day's assignments from the map. */
  const date = dateOf(d);
  block().assignments = block().assignments.filter((a) => a.date !== date);
  Object.keys(day.assign).forEach((roleId) => {
    if (day.assign[roleId]) {
      block().assignments.push({
        date,
        roleId,
        personId: day.assign[roleId],
        source: "manual"
      });
    }
  });
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
    snap,
    records: snap.records
  };
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
    const assign = {};
    (entry.assignments || []).filter((a) => a.date === day.iso).forEach((a) => {
      assign[a.roleId] = a.personId;
    });
    /* Fallback from records when no structured assignments. */
    if (!Object.keys(assign).length && entry.records) {
      entry.records.filter((r) => r.date === day.iso && r.status === "Present" && r.role && r.role !== "Spare").forEach((r) => {
        const role = D().roles.find((x) => x.name === r.role);
        const person = D().people.find((p) => p.name === r.person) || people.find((p) => p.name === r.person);
        if (role && person) assign[role.id] = person.id;
      });
    }
    return { assign };
  });

  const rolesFor = (d) => D().roles.filter((r) => (days[d].shift === "Day" ? r.usedAtDay !== false : r.usedAtNight));

  return { start, days, people, roster, statusFor, rolesFor };
}

/**
 * Month-by-month duty load for one person from the current block + saved log.
 * Returns [{ month, label, duties, day, night, hard, skill, groups: [{ name, n }], roles: [{ name, n }] }]
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
    if (!buckets[month]) {
      buckets[month] = { duties: 0, day: 0, night: 0, hard: 0, skill: 0, groups: {}, roles: {} };
    }
    const b = buckets[month];
    b.duties += 1;
    const shift = shiftHint || shiftLookup[date] || "Day";
    if (shift === "Night") b.night += 1; else b.day += 1;
    const role = roleId ? roleById(roleId) : (roleName ? D().roles.find((x) => x.name === roleName) : null);
    const name = (role && role.name) || roleName || "Role";
    if (role && role.hard) b.hard += 1;
    if (role && role.skillRestricted) b.skill += 1;
    const gName = role ? (groupById(role.groupId).name || "Other") : "Other";
    b.groups[gName] = (b.groups[gName] || 0) + 1;
    b.roles[name] = (b.roles[name] || 0) + 1;
  };

  block().assignments.forEach((a) => {
    if (a.personId === personId) bump(a.date, a.roleId, null, shiftLookup[a.date]);
  });

  history().forEach((h) => {
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
      hard: b.hard, skill: b.skill, groups, roles
    };
  });
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

/** Team rows for one month */
export function teamLoadForMonth(month) {
  return D().people.map((p) => {
    const rows = personLoadByMonth(p.id, { month });
    const m = rows[0] || { duties: 0, day: 0, night: 0, hard: 0, skill: 0, groups: [], roles: [] };
    return {
      person: p,
      duties: m.duties, day: m.day || 0, night: m.night || 0,
      hard: m.hard, skill: m.skill,
      groups: m.groups || [], roles: m.roles
    };
  }).filter((r) => r.duties > 0 || r.person.active !== false)
    .sort((a, b) => b.duties - a.duties || a.person.name.localeCompare(b.person.name));
}
