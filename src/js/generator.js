import { S, touch, toast } from "./state.js";
import { hardRules, softRules } from "./rules.js";
import {
  D, activePeople, rolesForDay, isPresent, qual, canDo, personById, roleById, shiftOf,
  roleOfPerson, writeRoster, rosterDays, writeDayAssign, dayLabels, historicRoleCounts
} from "./model.js";

/** H64: id of the visible row above (-1) / below (+1) this person, or null. Selection only — never reorders. */
export function adjacentPersonId(pid, dir) {
  const people = D().people;
  const i = people.findIndex((p) => p.id === pid);
  if (i < 0) return null;
  for (let j = i + dir; j >= 0 && j < people.length; j += dir) if (people[j].active !== false) return people[j].id;
  return null;
}

/** Hungarian min-cost assignment on a square matrix; returns col index per row. */
function hungarian(a) {
  const n = a.length; const u = new Array(n + 1).fill(0); const v = new Array(n + 1).fill(0);
  const p = new Array(n + 1).fill(0); const way = new Array(n + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i; let j0 = 0;
    const minv = new Array(n + 1).fill(Infinity); const done = new Array(n + 1).fill(false);
    do {
      done[j0] = true; const i0 = p[j0]; let delta = Infinity; let j1 = 0;
      for (let j = 1; j <= n; j++) {
        if (done[j]) continue;
        const cur = a[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
        if (minv[j] < delta) { delta = minv[j]; j1 = j; }
      }
      for (let j = 0; j <= n; j++) {
        if (done[j]) { u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta;
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
  }
  const rowCol = new Array(n).fill(-1);
  for (let j = 1; j <= n; j++) if (p[j]) rowCol[p[j] - 1] = j - 1;
  return rowCol;
}

const FORBID = 1e12; /* breaks a "hard" rule for this pass (see rules.js) */
const EMPTY = 1e8;   /* leaving an essential role unfilled */
const SOFT = 1e4;    /* per "soft" rule broken (see rules.js) */

/** Facts the rule checks need for one person × role on day d. */
function ruleCtx(id, role, prev, d, used) {
  const pr = prev[id] ? roleById(prev[id]) : null;
  return {
    role, prevRole: pr || null, qualified: qual(personById(id), role.id),
    usedGroup: !!used[id + "|" + role.groupId],
    night: shiftOf(d) === "Night", prevNight: d > 0 && shiftOf(d - 1) === "Night"
  };
}

/** For a pass: null if a hard rule is broken, else how many soft rules are. */
function judge(pass, ctx) {
  if (hardRules(pass).some((r) => r.breaks(ctx))) return null;
  return softRules(pass).filter((r) => r.breaks(ctx)).length;
}

/**
 * Essential pass: RULES objective (least done) with filters / soft penalties from RULES; all essential
 * roles solved together so each is filled whenever any valid arrangement exists; ties at random.
 */
function fillEssential(roleIds, free, assign, count, prev, d, used) {
  if (!roleIds.length) return;
  const n = roleIds.length; const m = free.length; const N = n + m;
  const cost = [];
  roleIds.forEach((r) => {
    const role = roleById(r);
    const soft = free.map((id) => judge("essential", ruleCtx(id, role, prev, d, used)));
    const base = Math.min(...free.filter((_, j) => soft[j] != null).map((id) => count(id, r)), 0);
    const row = free.map((id, j) => (soft[j] == null ? FORBID
      : count(id, r) - base + soft[j] * SOFT + Math.random() * 1e-3));
    for (let k = 0; k < n; k++) row.push(k === cost.length ? EMPTY : FORBID);
    cost.push(row);
  });
  for (let k = 0; k < m; k++) cost.push(new Array(N).fill(0));
  const rowCol = hungarian(cost);
  const taken = [];
  roleIds.forEach((r, i) => {
    const j = rowCol[i];
    if (j >= 0 && j < m && cost[i][j] < FORBID) { assign[r] = free[j]; taken.push(free[j]); } else assign[r] = null;
  });
  taken.forEach((id) => free.splice(free.indexOf(id), 1));
}

/** Non-essential pass (H44): roles in list (priority) order; RULES filters, then fewest soft breaks, then least done. */
function fillNonEssential(roleIds, free, assign, count, prev, d, used) {
  for (const r of roleIds) {
    const role = roleById(r);
    const c = free.map((id) => ({ id, soft: judge("nonEssential", ruleCtx(id, role, prev, d, used)) }))
      .filter((x) => x.soft != null);
    if (!c.length) { assign[r] = null; continue; }
    c.sort((a, b) => (a.soft - b.soft) || (count(a.id, r) - count(b.id, r)) || (Math.random() - 0.5));
    assign[r] = c[0].id;
    free.splice(free.indexOf(c[0].id), 1);
  }
}

export function generate() {
  const people = activePeople();
  const counts = historicRoleCounts();
  const count = (id, r) => counts[id + "|" + r] || 0;
  const out = []; const used = {}; let prev = {};
  const n = D().blocks.current.shifts.length;
  for (let d = 0; d < n; d++) {
    const dayRoles = rolesForDay(d);
    const essentialIds = dayRoles.filter((r) => r.essential !== false).map((r) => r.id);
    const nonEssentialIds = dayRoles
      .filter((r) => r.essential === false)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
      .map((r) => r.id);
    const assign = {}; const free = [];
    const rl = essentialIds.concat(nonEssentialIds);
    people.filter((p) => isPresent(p, d)).forEach((p) => {
      if (p.fixedRoleId && rl.indexOf(p.fixedRoleId) >= 0 && assign[p.fixedRoleId] === undefined) assign[p.fixedRoleId] = p.id;
      else if (!p.fixedRoleId) free.push(p.id);
    });
    fillEssential(essentialIds.filter((r) => assign[r] === undefined), free, assign, count, prev, d, used);
    fillNonEssential(nonEssentialIds.filter((r) => assign[r] === undefined), free, assign, count, prev, d, used);
    prev = {};
    Object.keys(assign).forEach((r) => {
      const id = assign[r]; if (!id) return;
      prev[id] = r; counts[id + "|" + r] = count(id, r) + 1;
      const ro = roleById(r); if (ro && ro.oncePerBlock) used[id + "|" + ro.groupId] = true;
    });
    out.push({ assign });
  }
  writeRoster(out, "generated");
  touch();
}

/** Live holder only — treat vacated (non-Present) as empty. */
function liveHolder(day, rid) {
  return day.assign[rid] || null;
}

function dayLabel(d) {
  const dl = dayLabels()[d];
  return (dl && dl.label) || ("day " + (d + 1));
}

function roleName(rid) {
  return ((roleById(rid) || {}).name) || rid;
}

function isEssentialId(rid) {
  const r = roleById(rid);
  return !r || r.essential !== false;
}

export function assignTo(d, rid, pid) {
  const days = rosterDays();
  if (!days) return false;
  const day = days[d];
  const holder = liveHolder(day, rid);
  const old = pid ? roleOfPerson(day, pid) : null;
  if (pid && old && holder && !canDo(personById(holder), old)) {
    toast("Cannot swap — " + ((personById(holder) || {}).name || "that person") + " is not qualified for " + roleName(old) + ".");
    return false;
  }
  const next = { ...day.assign };
  next[rid] = pid || null;
  if (pid && old) next[old] = holder || null;
  const cleared = new Set([rid]);
  if (old) cleared.add(old);
  writeDayAssign(d, next, cleared);
  S.ui.sel = null; touch();
  return true;
}

/**
 * Assign a parking-lot (vacated essential) role to a Present person.
 * chip→spare: take it.
 * chip→non-essential holder: take essential; drop non-essential for the day.
 * chip→essential holder: take parked; old essential becomes vacant (parking lot).
 */
export function assignParkedRole(d, rid, pid) {
  if (!pid) return false;
  const days = rosterDays();
  if (!days) return false;
  const day = days[d];
  const p = personById(pid);
  if (!p || !isPresent(p, d)) { toast("Only Present people can take a role."); return false; }
  if (!canDo(p, rid)) { toast("Cannot assign — not qualified for that role."); return false; }
  if (liveHolder(day, rid)) { toast("That role is already filled."); return false; }

  const old = roleOfPerson(day, pid);
  const next = { ...day.assign };
  const cleared = new Set([rid]);
  next[rid] = pid;

  if (old) {
    next[old] = null;
    cleared.add(old);
    if (!isEssentialId(old)) {
      toast(roleName(old) + " dropped for " + dayLabel(d));
    } else {
      toast(roleName(rid) + " → " + (p.name || pid) + "; " + roleName(old) + " now in parking lot");
    }
  } else {
    toast(roleName(rid) + " → " + (p.name || pid));
  }

  writeDayAssign(d, next, cleared);
  S.ui.sel = null; touch();
  return true;
}

/**
 * Same-day person swap. Essential↔non-essential is also a swap (not replace).
 * holder↔holder swaps roles; holder→spare hands over.
 */
export function swapPeople(d, aPid, bPid) {
  if (!aPid || !bPid || aPid === bPid) return false;
  const days = rosterDays();
  if (!days) return false;
  const day = days[d];
  const a = personById(aPid); const b = personById(bPid);
  if (!a || !b) return false;
  if (!isPresent(a, d) || !isPresent(b, d)) {
    toast("Only Present people can swap.");
    return false;
  }
  const aRole = roleOfPerson(day, aPid);
  const bRole = roleOfPerson(day, bPid);
  if (!aRole && !bRole) return false;

  if (aRole && bRole) {
    if (!canDo(a, bRole) || !canDo(b, aRole)) {
      toast("Cannot swap — not qualified for that role.");
      return false;
    }
    const next = { ...day.assign };
    next[aRole] = bPid;
    next[bRole] = aPid;
    writeDayAssign(d, next, []);
    S.ui.sel = null; touch();
    toast("Swapped " + roleName(aRole) + " ↔ " + roleName(bRole));
    return true;
  }

  const sparePid = aRole ? bPid : aPid;
  const rid = aRole || bRole;
  const spare = personById(sparePid);
  if (!canDo(spare, rid)) {
    toast("Cannot assign — not qualified for that role.");
    return false;
  }
  const next = { ...day.assign };
  next[rid] = sparePid;
  writeDayAssign(d, next, []);
  S.ui.sel = null; touch();
  toast(roleName(rid) + " → " + (spare.name || sparePid));
  return true;
}

/** Assign a (possibly vacated) role to a Present person; unassign with pid null. */
export function assignRoleToPerson(d, rid, pid) {
  if (!pid) {
    assignTo(d, rid, null);
    toast(roleName(rid) + " left unfilled");
    return true;
  }
  const days = rosterDays();
  if (!days) return false;
  if (!liveHolder(days[d], rid) && isEssentialId(rid)) {
    return assignParkedRole(d, rid, pid);
  }
  const p = personById(pid);
  if (!p || !isPresent(p, d)) { toast("Only Present people can take a role."); return false; }
  if (!canDo(p, rid)) { toast("Cannot assign — not qualified for that role."); return false; }
  if (!assignTo(d, rid, pid)) return false;
  toast(roleName(rid) + " → " + (p.name || pid));
  return true;
}

export function unassignPerson(d, pid) {
  const days = rosterDays();
  if (!days) return false;
  const rid = roleOfPerson(days[d], pid);
  if (!rid) return false;
  assignTo(d, rid, null);
  toast(roleName(rid) + " unassigned");
  return true;
}

export function canTakeParkedRole(d, rid, pid) {
  const p = personById(pid);
  if (!p || !isPresent(p, d)) return false;
  return canDo(p, rid);
}

export function canDropPersonOnPerson(d, fromPid, toPid) {
  if (!fromPid || !toPid || fromPid === toPid) return false;
  const days = rosterDays();
  if (!days) return false;
  const day = days[d];
  const a = personById(fromPid); const b = personById(toPid);
  if (!a || !b || !isPresent(a, d) || !isPresent(b, d)) return false;
  const aRole = roleOfPerson(day, fromPid);
  const bRole = roleOfPerson(day, toPid);
  if (!aRole && !bRole) return false;
  if (aRole && bRole) return canDo(a, bRole) && canDo(b, aRole);
  return canDo(aRole ? b : a, aRole || bRole);
}
