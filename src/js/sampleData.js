import { uid, iso, addDays } from "./util.js";
import { S, toast } from "./state.js";
import { generate } from "./generator.js";

export function loadSample() {
  const groups = [
    { id: "g1", name: "Car", color: "#F8BBD0", sortOrder: 1 },
    { id: "g2", name: "Beat", color: "#C8E6C9", sortOrder: 2 },
    { id: "g3", name: "Inside", color: "#FFE0B2", sortOrder: 3 }
  ];
  const defs = [["Car 1", "g1", 1, 1, 1], ["Car 2", "g1", 1, 1, 1], ["Member in Charge", "g3", 1, 0, 1], ["Jailer", "g3", 1, 0, 1], ["Public Office", "g3", 1, 0, 0, 0], ["Admin Support", "g3", 0, 0, 0], ["Comms Desk", "g3", 1, 0, 0], ["Station Duty", "g3", 1, 0, 0], ["Beat 1", "g2", 1, 1, 0], ["Beat 2", "g2", 1, 0, 0], ["Beat 3", "g2", 1, 0, 0], ["Beat 4", "g2", 1, 0, 0], ["Traffic Unit", "g1", 1, 1, 0], ["Patrol Support", "g2", 1, 0, 0], ["Escort Car", "g1", 1, 0, 0], ["Scene Support", "g2", 1, 0, 0]];
  const roles = defs.map((x, i) => ({
    id: uid(), name: x[0], groupId: x[1], usedAtDay: x[5] == null ? true : !!x[5], usedAtNight: !!x[2], hard: !!x[3], skillRestricted: !!x[4], essential: true, sortOrder: i + 1
  }));
  const rn = (n) => roles.find((r) => r.name === n).id;
  const names = ["Aoife Brennan", "Ciaran Doyle", "Declan Murphy", "Eimear Walsh", "Fionn Kelly", "Grainne Byrne", "Hugh Ryan", "Ita Nolan", "Jack Moran", "Katie Burke", "Liam Duffy", "Maeve Quinn", "Niall Regan", "Owen Lyons", "Padraig Costello", "Roisin Farrell", "Sean Egan", "Tadhg Hayes", "Una Carey", "Vincent Daly", "Willie Fahey", "Yvonne Gill", "Zach Naughton"];
  const drivers = ["Ciaran Doyle", "Declan Murphy", "Fionn Kelly", "Jack Moran", "Liam Duffy", "Niall Regan", "Sean Egan", "Tadhg Hayes", "Vincent Daly"];
  const mic = ["Aoife Brennan", "Hugh Ryan", "Katie Burke", "Maeve Quinn", "Padraig Costello", "Roisin Farrell", "Una Carey"];
  const jailer = ["Ciaran Doyle", "Eimear Walsh", "Grainne Byrne", "Ita Nolan", "Liam Duffy", "Willie Fahey", "Yvonne Gill", "Zach Naughton"];
  const notq = ["Hugh Ryan|Beat 1", "Zach Naughton|Traffic Unit", "Ita Nolan|Escort Car"];
  const personRoles = [];
  const people = names.map((n, i) => {
    const id = uid();
    const rs = roles.filter((r) => {
      if (n === "Owen Lyons") return r.name === "Comms Desk" || r.name === "Station Duty";
      if (r.name === "Car 1" || r.name === "Car 2") return drivers.indexOf(n) >= 0;
      if (r.name === "Member in Charge") return mic.indexOf(n) >= 0;
      if (r.name === "Jailer") return jailer.indexOf(n) >= 0;
      return notq.indexOf(n + "|" + r.name) < 0;
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
  ["Ciaran Doyle", "Grainne Byrne", "Padraig Costello", "Yvonne Gill"].forEach((n) => { setS(n, 0, "Annual leave"); setS(n, 1, "Annual leave"); });
  setS("Sean Egan", 1, "Sick leave");
  setS("Zach Naughton", 0, "Rest day");
  [2, 3].forEach((d) => {
    ["Padraig Costello", "Yvonne Gill", "Vincent Daly", "Una Carey"].forEach((n) => setS(n, d, "Annual leave"));
    setS("Sean Egan", d, "Sick leave");
    setS("Katie Burke", d, "Duty away");
  });

  S.data = {
    schemaVersion: 2,
    meta: { title: "Shift Manager", unitName: "Sample Unit", updatedAt: new Date().toISOString(), app: "shift-manager-html" },
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
  generate();
  S.ui.screen = "att";
  S.ui.selPerson = people[0].id;
  toast("Sample data loaded. All names and most roles are made up.");
}
