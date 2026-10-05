import { S, touch, toast } from "./state.js";
import { RULES, hardRules, softRules } from "./rules.js";
import {
  D, activePeople, rolesForDay, isPresent, qual, canDo, personById, roleById, groupById, shiftOf,
  roleOfPerson, writeRoster, rosterDays, writeDayAssign, dayLabels, historicRoleCounts,
  filesRole, isFilesRole, setFiles, canDoOn
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
const EMPTY_STEP = 1e6; /* H13: each place down the Roles list makes leaving a role empty cheaper, so earlier roles win */
const SOFT = 1e4;    /* per "soft" rule broken (see rules.js) */

/** Facts the rule checks need for one person × role on day d. */
function ruleCtx(id, role, prev, d, used) {
  const pr = prev[id] ? roleById(prev[id]) : null;
  return {
    role, prevRole: pr || null, qualified: qual(personById(id), role.id),
    usedRole: !!used[id + "|r|" + role.id],
    usedGroup: !!used[id + "|g|" + role.groupId],
    groupOnce: !!(groupById(role.groupId) || {}).oncePerBlock,
    night: shiftOf(d) === "Night", prevNight: d > 0 && shiftOf(d - 1) === "Night"
  };
}

/** H70: has this person already used up the role's / its group's once-per-block allowance? */
const onceUsed = (id, role, used) => {
  const g = groupById(role.groupId) || {};
  return !!((role.oncePerBlock && used[id + "|r|" + role.id]) || (g.oncePerBlock && used[id + "|g|" + role.groupId]));
};
const markUsed = (id, role, used) => { used[id + "|r|" + role.id] = true; used[id + "|g|" + role.groupId] = true; };

/** For a pass: null if a hard rule is broken, else how many soft rules are. */
function judge(pass, ctx) {
  if (hardRules(pass).some((r) => r.breaks(ctx))) return null;
  return softRules(pass).filter((r) => r.breaks(ctx)).length;
}

/**
 * Essential pass: RULES objective (least done) with filters / soft penalties from RULES; all essential
 * roles solved together so each is filled whenever any valid arrangement exists; ties at random.
 * H73: bias function adds secondary cost for Files fair spares.
 */
function fillEssentialWithBias(roleIds, free, assign, count, bias, prev, d, used) {
  if (!roleIds.length) return;
  const n = roleIds.length; const m = free.length; const N = n + m;
  const cost = [];
  roleIds.forEach((r) => {
    const role = roleById(r);
    const soft = free.map((id) => judge("essential", ruleCtx(id, role, prev, d, used)));
    const base = Math.min(...free.filter((_, j) => soft[j] != null).map((id) => count(id, r)), 0);
    const row = free.map((id, j) => (soft[j] == null ? FORBID
      : count(id, r) - base + soft[j] * SOFT + bias(id) + Math.random() * 1e-7));
    for (let k = 0; k < n; k++) row.push(k === cost.length ? EMPTY + (n - k) * EMPTY_STEP : FORBID);
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

/** Non-essential pass (H44): roles in list (priority) order; RULES filters, then fewest soft breaks, then least done.
 * H73: bias function adds secondary cost for Files fair spares. */
function fillNonEssentialWithBias(roleIds, free, assign, count, bias, prev, d, used) {
  for (const r of roleIds) {
    const role = roleById(r);
    const c = free.map((id) => ({ id, soft: judge("nonEssential", ruleCtx(id, role, prev, d, used)), b: bias(id) }))
      .filter((x) => x.soft != null);
    if (!c.length) { assign[r] = null; continue; }
    c.sort((a, b) => (a.soft - b.soft) || (count(a.id, r) + a.b - count(b.id, r) - b.b) || (Math.random() - 0.5));
    assign[r] = c[0].id;
    free.splice(free.indexOf(c[0].id), 1);
  }
}

/**
 * H75: no two Probationers in the same role group on a day, when another arrangement exists. Runs after the
 * fill passes: a Probationer in a clashing group swaps with a non-Probationer in another group (neither
 * breaking a hard rule), else hands the role to a free non-Probationer and drops to the spares.
 * Fixed-role people and the Files role are left alone. If nothing works the clash stays (roles stay filled).
 */
function separateProbationers(assign, free, prev, d, used) {
  const prob = (id) => !!(personById(id) || {}).probationer;
  const grp = (r) => roleById(r).probGroupId || null; /* H75: only roles in a probationer group count */
  const pass = (r) => (roleById(r).essential !== false ? "essential" : "nonEssential");
  const ok = (id, r) => judge(pass(r), ruleCtx(id, roleById(r), prev, d, used)) != null;
  const probIn = (g) => Object.keys(assign).filter((r) => assign[r] && prob(assign[r]) && grp(r) === g);
  for (let guard = 0; guard < 50; guard++) {
    const groups = [...new Set(Object.keys(assign).filter((r) => assign[r] && prob(assign[r])).map(grp))].filter(Boolean);
    let moved = false;
    for (const g of groups) {
      const rs = probIn(g);
      if (rs.length < 2) continue;
      for (const r of rs) {
        const P = assign[r];
        if (personById(P).fixedRoleId) continue;
        const swap = Object.keys(assign).find((r2) => {
          const Q = assign[r2];
          return Q && grp(r2) !== g && !prob(Q) && !personById(Q).fixedRoleId && (grp(r2) == null || probIn(grp(r2)).length === 0)
            && canDo(personById(Q), r) && canDo(personById(P), r2) && ok(Q, r) && ok(P, r2);
        });
        if (swap) { const Q = assign[swap]; assign[swap] = P; assign[r] = Q; moved = true; break; }
        const F = free.find((id) => !prob(id) && canDo(personById(id), r) && ok(id, r));
        if (F) { assign[r] = F; free.splice(free.indexOf(F), 1, P); moved = true; break; }
      }
      if (moved) break;
    }
    if (!moved) return;
  }
}

export function generate() {
  const people = activePeople();
  const counts = historicRoleCounts();
  const totals = {};
  Object.keys(counts).forEach((k) => { const id = k.split("|")[0]; totals[id] = (totals[id] || 0) + counts[k]; });
  /* H28 objective from RULES (share of the person's own duties); name kept short for the fill passes. */
  const score = RULES.find((x) => x.kind === "objective").score;
  const count = (id, r) => score({ count: counts[id + "|" + r] || 0, total: totals[id] || 0 });
  const fr = filesRole();
  /* H73 fair spares: secondary cost (H28 share stays the main score) on giving a real role to someone due
     Files; nobody is held back for Files they cannot have today (not in today's roles / once per block used). */
  const FILES_W = 0.25;
  const filesShare = (id) => (totals[id] ? (counts[id + "|" + fr.id] || 0) / totals[id] : 0);
  const out = []; const used = {}; let prev = {};
  const n = D().blocks.current.shifts.length;
  for (let d = 0; d < n; d++) {
    const dayRoles = rolesForDay(d);
    const essentialIds = dayRoles.filter((r) => r.essential !== false && !isFilesRole(r.id))
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
      .map((r) => r.id);
    const nonEssentialIds = dayRoles
      .filter((r) => r.essential === false && !isFilesRole(r.id))
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
      .map((r) => r.id);
    const assign = {}; const free = [];
    const rl = essentialIds.concat(nonEssentialIds);
    const files = [];
    const filesToday = !!fr && dayRoles.some((r) => r.id === fr.id);
    const bias = (id) => (filesToday && canDo(personById(id), fr.id) && !onceUsed(id, fr, used) ? FILES_W * (1 - filesShare(id)) : 0);
    people.filter((p) => isPresent(p, d)).forEach((p) => {
      if (p.fixedRoleId && isFilesRole(p.fixedRoleId)) {
        // H73: fixed Files person goes into files list
        if (canDo(p, p.fixedRoleId)) files.push(p.id);
      } else if (p.fixedRoleId && rl.indexOf(p.fixedRoleId) >= 0 && assign[p.fixedRoleId] === undefined) {
        assign[p.fixedRoleId] = p.id;
      } else if (!p.fixedRoleId) {
        free.push(p.id);
      }
    });
    // H28+H73: fillEssential with bias for Files fair spares
    fillEssentialWithBias(essentialIds.filter((r) => assign[r] === undefined), free, assign, count, bias, prev, d, used);
    fillNonEssentialWithBias(nonEssentialIds.filter((r) => assign[r] === undefined), free, assign, count, bias, prev, d, used);

    separateProbationers(assign, free, prev, d, used);

    // H73: Files role — everyone still free who is qualified and (oncePerBlock rule allows)
    if (filesToday) {
      free.filter((id) => {
        return canDo(personById(id), fr.id) && !onceUsed(id, fr, used);
      }).forEach((id) => files.push(id));
    }

    prev = {};
    Object.keys(assign).forEach((r) => {
      const id = assign[r]; if (!id) return;
      prev[id] = r; counts[id + "|" + r] = (counts[id + "|" + r] || 0) + 1; totals[id] = (totals[id] || 0) + 1;
      const ro = roleById(r); if (ro) markUsed(id, ro, used);
    });
    // H73: bump counts/totals for Files people
    files.forEach((id) => {
      prev[id] = fr.id;
      counts[id + "|" + fr.id] = (counts[id + "|" + fr.id] || 0) + 1;
      totals[id] = (totals[id] || 0) + 1;
      markUsed(id, fr, used);
    });
    out.push({ assign, files });
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

/** H73: get the real role for a person, treating Files as no role (null). */
function realRole(day, pid) {
  const role = roleOfPerson(day, pid);
  return isFilesRole(role) ? null : role;
}

export function assignTo(d, rid, pid) {
  const days = rosterDays();
  if (!days) return false;
  const day = days[d];
  const holder = liveHolder(day, rid);
  const old = pid ? realRole(day, pid) : null;  // H73: Files is treated as no role
  if (pid && old && holder && !canDoOn(personById(holder), old, d)) {
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
 * H73: Files holder treated as spare — they take the role, Files dropped.
 */
export function assignParkedRole(d, rid, pid) {
  if (!pid) return false;
  const days = rosterDays();
  if (!days) return false;
  const day = days[d];
  const p = personById(pid);
  if (!p || !isPresent(p, d)) { toast("Only Present people can take a role."); return false; }
  if (!canDoOn(p, rid, d)) { toast("Cannot assign — not qualified for that role."); return false; }
  if (liveHolder(day, rid)) { toast("That role is already filled."); return false; }

  const old = realRole(day, pid);  // H73: Files is treated as no role
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
 * H73: Files holder treated as spare — real-role holder ↔ Files holder: Files person takes role,
 * former holder gets setFiles if canDo.
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
  const aRole = realRole(day, aPid);  // H73: Files is treated as no role
  const bRole = realRole(day, bPid);  // H73: Files is treated as no role
  if (!aRole && !bRole) return false;

  if (aRole && bRole) {
    if (!canDoOn(a, bRole, d) || !canDoOn(b, aRole, d)) {
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

  // H73: one has a real role; the other is spare or on Files (Files holder counts as spare)
  const hasRole = aRole ? aPid : bPid;
  const hasFiles = aRole ? bPid : aPid;
  const wasFiles = isFilesRole(roleOfPerson(day, hasFiles));
  const rid = aRole || bRole;
  if (!canDoOn(personById(hasFiles), rid, d)) {
    toast("Cannot assign — not qualified for that role.");
    return false;
  }
  const next = { ...day.assign };
  next[rid] = hasFiles;
  writeDayAssign(d, next, []);
  // H73: give Files to the person who had the role, if they can do Files
  const fr = filesRole();
  if (wasFiles && canDo(personById(hasRole), fr.id)) {
    setFiles(d, hasRole, true);
  }
  S.ui.sel = null; touch();
  toast(wasFiles ? "Swapped " + roleName(rid) + " ↔ Files" : roleName(rid) + " → " + (personById(hasFiles).name || hasFiles));
  return true;
}

/** Assign a (possibly vacated) role to a Present person; unassign with pid null.
 * H73: for Files role, use setFiles instead. */
export function assignRoleToPerson(d, rid, pid) {
  if (!pid) {
    if (isFilesRole(rid)) {
      toast("Files unassigned");
      return true;  // No-op: people can't be unassigned by this path for Files
    }
    assignTo(d, rid, null);
    toast(roleName(rid) + " left unfilled");
    return true;
  }
  // H73: Files role assignment
  if (isFilesRole(rid)) {
    const p = personById(pid);
    if (!p || !isPresent(p, d)) { toast("Only Present people can take a role."); return false; }
    if (!canDoOn(p, rid, d)) { toast("Cannot assign — not qualified for that role."); return false; }
    setFiles(d, pid, true);
    S.ui.sel = null; touch();
    toast("Files → " + (p.name || pid));
    return true;
  }
  const days = rosterDays();
  if (!days) return false;
  if (!liveHolder(days[d], rid) && isEssentialId(rid)) {
    return assignParkedRole(d, rid, pid);
  }
  const p = personById(pid);
  if (!p || !isPresent(p, d)) { toast("Only Present people can take a role."); return false; }
  if (!canDoOn(p, rid, d)) { toast("Cannot assign — not qualified for that role."); return false; }
  if (!assignTo(d, rid, pid)) return false;
  toast(roleName(rid) + " → " + (p.name || pid));
  return true;
}

export function unassignPerson(d, pid) {
  const days = rosterDays();
  if (!days) return false;
  const rid = roleOfPerson(days[d], pid);
  if (!rid) return false;
  // H73: Files unassignment
  if (isFilesRole(rid)) {
    setFiles(d, pid, false);
    S.ui.sel = null; touch();
    toast("Files unassigned");
    return true;
  }
  assignTo(d, rid, null);
  toast(roleName(rid) + " unassigned");
  return true;
}

export function canTakeParkedRole(d, rid, pid) {
  const p = personById(pid);
  if (!p || !isPresent(p, d)) return false;
  return canDoOn(p, rid, d);
}

export function canDropPersonOnPerson(d, fromPid, toPid) {
  if (!fromPid || !toPid || fromPid === toPid) return false;
  const days = rosterDays();
  if (!days) return false;
  const day = days[d];
  const a = personById(fromPid); const b = personById(toPid);
  if (!a || !b || !isPresent(a, d) || !isPresent(b, d)) return false;
  const aRole = realRole(day, fromPid);  // H73: Files is treated as no role
  const bRole = realRole(day, toPid);    // H73: Files is treated as no role
  if (!aRole && !bRole) return false;
  if (aRole && bRole) return canDoOn(a, bRole, d) && canDoOn(b, aRole, d);
  return canDoOn(aRole ? b : a, aRole || bRole, d);
}
