import { S, touch, toast } from "./state.js";
import {
  D, activePeople, rolesForDay, isPresent, qual, canDo, personById, roleById, shiftOf,
  roleOfPerson, writeRoster, rosterDays, writeDayAssign, dayLabels
} from "./model.js";

function fillPass(roleIds, free, assign, strict, last, prev, d, softConstraints) {
  const cand = (r) => free.filter((id) => qual(personById(id), r));
  const skilled = roleIds.filter((r) => roleById(r).skillRestricted).sort((a, b) => cand(a).length - cand(b).length);
  /* Preserve caller order for non-essential priority; shuffle only in essential soft pass. */
  const otherIds = roleIds.filter((r) => !roleById(r).skillRestricted);
  const other = softConstraints ? otherIds.slice().sort(() => Math.random() - 0.5) : otherIds;
  const night = shiftOf(d) === "Night"; const prevNight = d > 0 && shiftOf(d - 1) === "Night";
  /* Non-essential pass keeps caller (priority) order; skill roles must not jump the queue. */
  const ordered = softConstraints ? skilled.concat(other) : roleIds;
  for (const r of ordered) {
    let c = cand(r);
    if (strict && softConstraints) {
      c = c.filter((id) => prev[id] !== r);
      if (night && prevNight && roleById(r).hard) c = c.filter((id) => !(prev[id] && roleById(prev[id]) && roleById(prev[id]).hard));
    }
    if (!c.length) {
      if (strict && softConstraints) return null;
      assign[r] = null;
      continue;
    }
    const lv = (id) => (last[id + "|" + r] === undefined ? -99 : last[id + "|" + r]);
    c.sort((a, b) => (lv(a) - lv(b)) || (Math.random() - 0.5));
    assign[r] = c[0];
    free.splice(free.indexOf(c[0]), 1);
  }
  return true;
}

export function generate() {
  const people = activePeople();
  const attempt = (strict, last, prev, d) => {
    const dayRoles = rolesForDay(d);
    const essentialIds = dayRoles.filter((r) => r.essential !== false).map((r) => r.id);
    const nonEssentialIds = dayRoles
      .filter((r) => r.essential === false)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
      .map((r) => r.id);
    const present = people.filter((p) => isPresent(p, d));
    const assign = {}; const free = [];
    const rl = essentialIds.concat(nonEssentialIds);
    present.forEach((p) => {
      if (p.fixedRoleId && rl.indexOf(p.fixedRoleId) >= 0 && assign[p.fixedRoleId] === undefined) assign[p.fixedRoleId] = p.id;
      else if (!p.fixedRoleId) free.push(p.id);
    });
    const essRest = essentialIds.filter((r) => assign[r] === undefined);
    if (fillPass(essRest, free, assign, strict, last, prev, d, true) == null) return null;
    const nonRest = nonEssentialIds.filter((r) => assign[r] === undefined);
    /* Non-essential: never fail strict mode; skip H10/H11 soft filters so spares absorb. */
    fillPass(nonRest, free, assign, false, last, prev, d, false);
    return { assign };
  };
  const out = []; const last = {}; let prev = {};
  const n = D().blocks.current.shifts.length;
  for (let d = 0; d < n; d++) {
    let res = null;
    for (let t = 0; t < 1500 && !res; t++) res = attempt(true, last, prev, d);
    if (!res) res = attempt(false, last, prev, d);
    prev = {};
    Object.keys(res.assign).forEach((r) => { const id = res.assign[r]; if (id) { prev[id] = r; last[id + "|" + r] = d; } });
    out.push(res);
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
