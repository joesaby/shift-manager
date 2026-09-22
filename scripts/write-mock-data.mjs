#!/usr/bin/env node
/** Writes PO-aligned mock data to ~/Downloads/data/shift-manager-data.json */
import { writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const iso = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const addDays = (s, n) => { const d = new Date(s + "T12:00:00"); d.setDate(d.getDate() + n); return iso(d); };

const groups = [
  { id: "g_car", name: "Car", color: "#F8BBD0", sortOrder: 1 },
  { id: "g_beat", name: "Beat", color: "#C8E6C9", sortOrder: 2 },
  { id: "g_inside", name: "Inside", color: "#FFE0B2", sortOrder: 3 }
];

/* 16 day roles; Public Office + Admin Support not used at night → 14 night roles.
   First four are skill-restricted (drivers / MIC / jailer). Hard = car / beat1 / traffic. */
const defs = [
  ["Car 1", "g_car", 1, 1, 1],
  ["Car 2", "g_car", 1, 1, 1],
  ["Member in Charge", "g_inside", 1, 0, 1],
  ["Jailer", "g_inside", 1, 0, 1],
  ["Public Office", "g_inside", 0, 0, 0],
  ["Admin Support", "g_inside", 0, 0, 0],
  ["Comms Desk", "g_inside", 1, 0, 0],
  ["Station Duty", "g_inside", 1, 0, 0],
  ["Beat 1", "g_beat", 1, 1, 0],
  ["Beat 2", "g_beat", 1, 0, 0],
  ["Beat 3", "g_beat", 1, 0, 0],
  ["Beat 4", "g_beat", 1, 0, 0],
  ["Traffic Unit", "g_car", 1, 1, 0],
  ["Patrol Support", "g_beat", 1, 0, 0],
  ["Escort Car", "g_car", 1, 0, 0],
  ["Scene Support", "g_beat", 1, 0, 0]
];

const roles = defs.map((x, i) => ({
  id: "r_" + String(i + 1).padStart(2, "0"),
  name: x[0],
  groupId: x[1],
  usedAtNight: !!x[2],
  hard: !!x[3],
  skillRestricted: !!x[4],
  sortOrder: i + 1
}));
const rn = (n) => roles.find((r) => r.name === n).id;

const names = [
  "Aoife Brennan", "Ciaran Doyle", "Declan Murphy", "Eimear Walsh", "Fionn Kelly",
  "Grainne Byrne", "Hugh Ryan", "Ita Nolan", "Jack Moran", "Katie Burke",
  "Liam Duffy", "Maeve Quinn", "Niall Regan", "Owen Lyons", "Padraig Costello",
  "Roisin Farrell", "Sean Egan", "Tadhg Hayes", "Una Carey", "Vincent Daly",
  "Willie Fahey", "Yvonne Gill", "Zach Naughton"
];
const drivers = ["Ciaran Doyle", "Declan Murphy", "Fionn Kelly", "Jack Moran", "Liam Duffy", "Niall Regan", "Sean Egan", "Tadhg Hayes", "Vincent Daly"];
const mic = ["Aoife Brennan", "Hugh Ryan", "Katie Burke", "Maeve Quinn", "Padraig Costello", "Roisin Farrell", "Una Carey"];
const jailer = ["Ciaran Doyle", "Eimear Walsh", "Grainne Byrne", "Ita Nolan", "Liam Duffy", "Willie Fahey", "Yvonne Gill", "Zach Naughton"];
const notq = ["Hugh Ryan|Beat 1", "Zach Naughton|Traffic Unit", "Ita Nolan|Escort Car"];

const personRoles = [];
const people = names.map((n, i) => {
  const id = "p_" + String(i + 1).padStart(2, "0");
  const rs = roles.filter((r) => {
    if (n === "Owen Lyons") return r.name === "Comms Desk" || r.name === "Station Duty";
    if (r.name === "Car 1" || r.name === "Car 2") return drivers.includes(n);
    if (r.name === "Member in Charge") return mic.includes(n);
    if (r.name === "Jailer") return jailer.includes(n);
    return !notq.includes(n + "|" + r.name);
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
  const statusId = { "Annual leave": "annual_leave", "Sick leave": "sick_leave", "Duty away": "duty_away" }[label];
  if (!statusId) return;
  attendance.push({ date: addDays(start, d), personId: pid(n), statusId });
};
["Ciaran Doyle", "Grainne Byrne", "Padraig Costello", "Yvonne Gill"].forEach((n) => {
  setS(n, 0, "Annual leave"); setS(n, 1, "Annual leave");
});
setS("Sean Egan", 1, "Sick leave");
[2, 3].forEach((d) => {
  ["Padraig Costello", "Yvonne Gill", "Vincent Daly", "Una Carey"].forEach((n) => setS(n, d, "Annual leave"));
  setS("Sean Egan", d, "Sick leave");
  setS("Katie Burke", d, "Duty away");
});

const data = {
  schemaVersion: 2,
  meta: {
    title: "Shift Manager",
    unitName: "Galway (mock)",
    updatedAt: new Date().toISOString(),
    app: "shift-manager-html",
    note: "Mock data for local demo — names and most roles are made up."
  },
  settings: {
    statuses: [
      { id: "present", label: "Present", allocates: true, printColor: "#EAF4EC" },
      { id: "annual_leave", label: "Annual leave", allocates: false, printColor: "#BBDEFB" },
      { id: "sick_leave", label: "Sick leave", allocates: false, printColor: "#FFCDD2" },
      { id: "duty_away", label: "Duty away", allocates: false, printColor: "#E1BEE7" }
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
      assignments: []
    },
    history: []
  },
  audit: []
};

const dir = join(homedir(), "Downloads", "data");
mkdirSync(dir, { recursive: true });
const out = join(dir, "shift-manager-data.json");
writeFileSync(out, JSON.stringify(data, null, 2));
console.log("Wrote", out);
console.log("Roles:", roles.length, "| night:", roles.filter((r) => r.usedAtNight).length, "| skill:", roles.filter((r) => r.skillRestricted).length);
console.log("People:", people.length, "| attendance rows:", attendance.length);
