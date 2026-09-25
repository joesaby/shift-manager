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
  ["Station Duty", "g_inside", 1, 1, 0, 0]
];

const roles = defs.map((x, i) => ({
  id: "r_" + String(i + 1).padStart(2, "0"),
  name: x[0],
  groupId: x[1],
  usedAtDay: !!x[2],
  usedAtNight: !!x[3],
  hard: !!x[4],
  skillRestricted: !!x[5],
  sortOrder: i + 1
}));
const rn = (n) => roles.find((r) => r.name === n).id;

const names = [
  "Aoife Brennan", "Ciaran Doyle", "Declan Murphy", "Eimear Walsh",
  "Fionn Kelly", "Grainne Byrne", "Hugh Ryan", "Katie Burke",
  "Liam Duffy", "Maeve Quinn", "Owen Lyons", "Sean Egan"
];
const drivers = ["Ciaran Doyle", "Declan Murphy", "Fionn Kelly", "Liam Duffy", "Sean Egan"];
const mic = ["Aoife Brennan", "Hugh Ryan", "Katie Burke", "Maeve Quinn"];
const jailer = ["Ciaran Doyle", "Eimear Walsh", "Grainne Byrne", "Liam Duffy"];

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
  return { id, name: n, active: true, fixedRoleId: n === "Owen Lyons" ? rn("Comms Desk") : null };
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

const json = JSON.stringify(data, null, 2) + "\n";
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
console.log("Load via Open file, or serve HTML over http next to data/.");
