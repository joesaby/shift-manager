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
  /* Clearly fictional demo names — not real officers. */
  const names = ["Alex River", "Blair Stone", "Casey Vale", "Dana Frost", "Eden Brooks", "Fran Wells", "Gray Moss", "Harper Lane", "Indy Cole", "Jules Pike", "Kai North", "Logan Reed", "Morgan Dale", "Noel Ash", "Quinn Blake", "Remy Cross", "Sage Flint", "Taylor Wren", "Uri West", "Val Shore", "Wren Hale", "Yasmin Cove", "Zion Park", "Avery Holt", "Bryn Cassidy", "Cleo Marsh", "Drew Alder", "Ezra Quill", "Fiona Baird", "Hollis Grant", "Ines Rowan"];
  const drivers = ["Blair Stone", "Casey Vale", "Eden Brooks", "Indy Cole", "Kai North", "Morgan Dale", "Sage Flint", "Taylor Wren", "Val Shore", "Avery Holt", "Drew Alder"];
  const mic = ["Alex River", "Gray Moss", "Jules Pike", "Logan Reed", "Quinn Blake", "Remy Cross", "Uri West", "Cleo Marsh"];
  const jailer = ["Blair Stone", "Dana Frost", "Fran Wells", "Harper Lane", "Kai North", "Wren Hale", "Yasmin Cove", "Zion Park", "Bryn Cassidy", "Hollis Grant"];
  const notq = ["Gray Moss|Beat 1", "Zion Park|Traffic Unit", "Harper Lane|Escort Car"];
  const fixedPerson = "Noel Ash";
  const personRoles = [];
  const people = names.map((n, i) => {
    const id = uid();
    const rs = roles.filter((r) => {
      if (n === fixedPerson) return r.name === "Comms Desk" || r.name === "Station Duty";
      if (r.name === "Car 1" || r.name === "Car 2") return drivers.indexOf(n) >= 0;
      if (r.name === "Member in Charge") return mic.indexOf(n) >= 0;
      if (r.name === "Jailer") return jailer.indexOf(n) >= 0;
      return notq.indexOf(n + "|" + r.name) < 0;
    });
    rs.forEach((r) => personRoles.push({ personId: id, roleId: r.id }));
    return { id, name: n, active: true, fixedRoleId: n === fixedPerson ? rn("Comms Desk") : null, employeeNo: String(90000000 + i), shoulderNo: String(1000 + i).padStart(4, "0") };
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
  ["Blair Stone", "Fran Wells", "Quinn Blake", "Yasmin Cove"].forEach((n) => { setS(n, 0, "Annual leave"); setS(n, 1, "Annual leave"); });
  setS("Sage Flint", 1, "Sick leave");
  setS("Zion Park", 0, "Rest day");
  setS("Ezra Quill", 1, "Sick leave");
  setS("Fiona Baird", 0, "Duty away");
  setS("Ines Rowan", 1, "Annual leave");
  [2, 3].forEach((d) => {
    ["Quinn Blake", "Yasmin Cove", "Val Shore", "Uri West"].forEach((n) => setS(n, d, "Annual leave"));
    setS("Sage Flint", d, "Sick leave");
    setS("Jules Pike", d, "Duty away");
  });

  S.data = {
    schemaVersion: 2,
    meta: { title: "Shift Manager", unitName: "Demo Unit", updatedAt: new Date().toISOString(), app: "shift-manager-html" },
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
  toast("Sample data loaded. All names are fictional demo data.");
}
