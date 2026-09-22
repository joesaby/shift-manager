import { S, touch } from "./state.js";
import {
  D, activePeople, rolesForDay, isPresent, qual, personById, roleById, shiftOf,
  roleOfPerson, writeRoster, rosterDays, dateOf, block
} from "./model.js";

export function generate() {
  const people = activePeople();
  const attempt = (strict, last, prev, d) => {
    const rl = rolesForDay(d).map((r) => r.id);
    const present = people.filter((p) => isPresent(p, d));
    const assign = {}; const free = [];
    present.forEach((p) => {
      if (p.fixedRoleId && rl.indexOf(p.fixedRoleId) >= 0 && assign[p.fixedRoleId] === undefined) assign[p.fixedRoleId] = p.id;
      else if (!p.fixedRoleId) free.push(p.id);
    });
    const rest = rl.filter((r) => assign[r] === undefined);
    const cand = (r) => free.filter((id) => qual(personById(id), r));
    const skilled = rest.filter((r) => roleById(r).skillRestricted).sort((a, b) => cand(a).length - cand(b).length);
    const other = rest.filter((r) => !roleById(r).skillRestricted).sort(() => Math.random() - 0.5);
    const night = shiftOf(d) === "Night"; const prevNight = d > 0 && shiftOf(d - 1) === "Night";
    for (const r of skilled.concat(other)) {
      let c = cand(r);
      if (strict) {
        c = c.filter((id) => prev[id] !== r);
        if (night && prevNight && roleById(r).hard) c = c.filter((id) => !(prev[id] && roleById(prev[id]) && roleById(prev[id]).hard));
      }
      if (!c.length) { if (strict) return null; assign[r] = null; continue; }
      const lv = (id) => (last[id + "|" + r] === undefined ? -99 : last[id + "|" + r]);
      c.sort((a, b) => (lv(a) - lv(b)) || (Math.random() - 0.5));
      assign[r] = c[0]; free.splice(free.indexOf(c[0]), 1);
    }
    return { assign: assign };
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

export function assignTo(d, rid, pid) {
  const days = rosterDays();
  if (!days) return;
  const day = days[d];
  const holder = day.assign[rid];
  const old = pid ? roleOfPerson(day, pid) : null;
  day.assign[rid] = pid;
  if (pid && old) day.assign[old] = holder || null;
  const date = dateOf(d);
  const b = block();
  b.assignments = b.assignments.filter((a) => a.date !== date);
  Object.keys(day.assign).forEach((roleId) => {
    if (day.assign[roleId]) b.assignments.push({ date, roleId, personId: day.assign[roleId], source: "manual" });
  });
  S.ui.sel = null; touch();
}
