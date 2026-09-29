#!/usr/bin/env node
/** Writes local demo data to data/shift-manager-data.json (and dist/data/ after build). */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const iso = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const addDays = (s, n) => { const d = new Date(s + "T12:00:00"); d.setDate(d.getDate() + n); return iso(d); };

const groups = [
  { id: "g_car", name: "Car", color: "#F8BBD0", sortOrder: 1 },
  { id: "g_beat", name: "Beat", color: "#C8E6C9", sortOrder: 2 },
  { id: "g_inside", name: "Inside", color: "#FFE0B2", sortOrder: 3 }
];

/* Compact local set: enough to Generate; Public Office is night-only. */
const defs = [
  /* name, group, usedAtDay, usedAtNight, hard, skill */
  ["Car 1", "g_car", 1, 1, 1, 1],
  ["Car 2", "g_car", 1, 1, 1, 1],
  ["Member in Charge", "g_inside", 1, 1, 0, 1],
  ["Jailer", "g_inside", 1, 1, 0, 1],
  ["Public Office", "g_inside", 0, 1, 0, 0],
  ["Comms Desk", "g_inside", 1, 1, 0, 0],
  ["Beat 1", "g_beat", 1, 1, 1, 0],
  ["Beat 2", "g_beat", 1, 1, 0, 0],
  ["Traffic Unit", "g_car", 1, 1, 1, 0],
  ["Station Duty", "g_inside", 1, 1, 0, 0],
  ["Beat 3", "g_beat", 1, 0, 0, 0],
  ["Beat 4", "g_beat", 1, 0, 0, 0],
  ["Patrol Support", "g_beat", 1, 0, 0, 0],
  ["Escort Car", "g_car", 1, 0, 0, 0],
  ["Scene Support", "g_beat", 1, 0, 0, 0],
  ["Admin Support", "g_inside", 1, 0, 0, 0],
  ["Public Office (Day)", "g_inside", 1, 0, 0, 0],
  ["Front Counter", "g_inside", 1, 1, 0, 0]
];

const roles = defs.map((x, i) => ({
  id: "r_" + String(i + 1).padStart(2, "0"),
  name: x[0],
  groupId: x[1],
  usedAtDay: !!x[2],
  usedAtNight: !!x[3],
  hard: !!x[4],
  skillRestricted: !!x[5],
  essential: true,
  sortOrder: i + 1
}));
const rn = (n) => roles.find((r) => r.name === n).id;

const names = [
  "Aoife Brennan", "Ciaran Doyle", "Declan Murphy", "Eimear Walsh",
  "Fionn Kelly", "Grainne Byrne", "Hugh Ryan", "Katie Burke",
  "Liam Duffy", "Maeve Quinn", "Owen Lyons", "Sean Egan",
  "Tadhg Nolan", "Una Farrell", "Vincent Hayes", "Aisling Corrigan",
  "Brendan Whelan", "Cara Mullen", "Dermot Kane", "Emer Boyle",
  "Finbar Regan", "Gemma Tierney", "Ivor Slattery", "Jenna Costello",
  "Kevin Delaney", "Lorna Fitzgerald", "Micheal Coughlan", "Niamh Purcell"
];
const drivers = ["Ciaran Doyle", "Declan Murphy", "Fionn Kelly", "Liam Duffy", "Sean Egan", "Tadhg Nolan", "Brendan Whelan", "Finbar Regan", "Kevin Delaney"];
const mic = ["Aoife Brennan", "Hugh Ryan", "Katie Burke", "Maeve Quinn", "Una Farrell", "Dermot Kane", "Gemma Tierney"];
const jailer = ["Ciaran Doyle", "Eimear Walsh", "Grainne Byrne", "Liam Duffy", "Vincent Hayes", "Cara Mullen", "Ivor Slattery", "Niamh Purcell"];

const personRoles = [];
const people = names.map((n, i) => {
  const id = "p_" + String(i + 1).padStart(2, "0");
  const rs = roles.filter((r) => {
    if (n === "Owen Lyons") return r.name === "Comms Desk" || r.name === "Station Duty";
    if (r.name === "Car 1" || r.name === "Car 2") return drivers.includes(n);
    if (r.name === "Member in Charge") return mic.includes(n);
    if (r.name === "Jailer") return jailer.includes(n);
    return true;
  });
  rs.forEach((r) => personRoles.push({ personId: id, roleId: r.id }));
  return { id, name: n, active: true, fixedRoleId: n === "Owen Lyons" ? rn("Comms Desk") : null, employeeNo: String(90000000 + i), shoulderNo: String(1000 + i).padStart(4, "0") };
});
const pid = (n) => people.find((p) => p.name === n).id;

const t = new Date(); t.setDate(t.getDate() + 1);
const start = iso(t);
const shifts = ["Day", "Day", "Night", "Night"];
const attendance = [];
const setS = (n, d, label) => {
  const statusId = ({ "Annual leave": "annual_leave", "Sick leave": "sick_leave", "Duty away": "duty_away", "Rest day": "rest_day" })[label];
  if (!statusId) return;
  attendance.push({ date: addDays(start, d), personId: pid(n), statusId });
};
setS("Ciaran Doyle", 0, "Annual leave");
setS("Ciaran Doyle", 1, "Annual leave");
setS("Sean Egan", 1, "Sick leave");
setS("Grainne Byrne", 0, "Rest day");
setS("Katie Burke", 2, "Duty away");
setS("Katie Burke", 3, "Duty away");
setS("Owen Lyons", 2, "Annual leave");
setS("Tadhg Nolan", 1, "Sick leave");
setS("Una Farrell", 0, "Annual leave");
setS("Una Farrell", 1, "Annual leave");
setS("Emer Boyle", 2, "Rest day");
setS("Finbar Regan", 3, "Duty away");
setS("Jenna Costello", 1, "Annual leave");
setS("Micheal Coughlan", 2, "Sick leave");
setS("Micheal Coughlan", 3, "Sick leave");

const data = {
  schemaVersion: 2,
  meta: {
    title: "Shift Manager",
    unitName: "Local Demo Unit",
    updatedAt: new Date().toISOString(),
    app: "shift-manager-html",
    note: "Local demo only — fictional names and roles for training / UI checks."
  },
  settings: {
    statuses: [
      { id: "present", label: "Present", allocates: true, printColor: "#EAF4EC" },
      { id: "annual_leave", label: "Annual leave", allocates: false, printColor: "#BBDEFB" },
      { id: "sick_leave", label: "Sick leave", allocates: false, printColor: "#BBDEFB" },
      { id: "duty_away", label: "Duty away", allocates: false, printColor: "#BBDEFB" },
      { id: "rest_day", label: "Rest day", allocates: false, printColor: "#BBDEFB" }
    ],
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
      stale: false,
      generatedAt: null,
      attendance,
      assignments: [],
      spareNotes: []
    },
    history: []
  },
  audit: []
};

/* Fill the Log with saved rosters (a few past, a few planned) by running the app's own Generate and
   Save code, so the entries are exactly what the app would have written. The working block is left
   for you to Generate. */
const store = Object.create(null);
globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
globalThis.window = globalThis.window || {};
const { S } = await import("../src/js/state.js");
const model = await import("../src/js/model.js");
const { generate } = await import("../src/js/generator.js");
const { saveRoster } = await import("../src/js/snapshot.js");

S.data = model.migrateToV2(JSON.parse(JSON.stringify(data)));
/* [start offset in days from today, people on leave / sick per day pattern] */
const SAVED = [-12, -8, -4, 5, 9];
const AWAY = ["Annual leave", "Sick leave", "Duty away", "Rest day"];
SAVED.forEach((offset, k) => {
  const b = S.data.blocks.current;
  b.startDate = addDays(iso(new Date()), offset);
  b.shifts = shifts.slice();
  b.attendance = []; b.assignments = []; b.generatedAt = null; b.stale = false;
  for (let j = 0; j < 4; j++) {
    const p = S.data.people[(k * 5 + j * 3) % S.data.people.length];
    model.setStatus(p.id, (k + j) % 4, AWAY[(k + j) % AWAY.length]);
  }
  generate();
  saveRoster();
});
/* Working block: tomorrow, attendance only (like the plain demo) — generate it in the app. */
const cur = S.data.blocks.current;
cur.startDate = start; cur.shifts = shifts.slice(); cur.attendance = attendance.map((a) => ({ ...a })); cur.assignments = []; cur.generatedAt = null; cur.stale = false;
S.data.audit = [];
S.data.meta.updatedAt = new Date().toISOString();
const out = S.data;

const json = JSON.stringify(out, null, 2) + "\n";
const targets = [
  join(root, "data"),
  join(root, "dist", "data")
];
for (const dir of targets) {
  mkdirSync(dir, { recursive: true });
  const out = join(dir, "shift-manager-data.json");
  writeFileSync(out, json);
  console.log("Wrote", out);
}
console.log("People:", people.length, "| Roles:", roles.length, "| night:", roles.filter((r) => r.usedAtNight).length, "| skill:", roles.filter((r) => r.skillRestricted).length);
console.log("Attendance rows:", attendance.length);
console.log("Saved rosters in Log:", out.blocks.history.map((h) => h.startDate).join(", "));
console.log("Load via Open file, or serve HTML over http next to data/.");
