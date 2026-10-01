/**
 * H73, H74 — Files role (takes all spares) and last on Files display.
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { stubLocalStorage, baseDoc } from "./helpers.js";

stubLocalStorage();

const { S } = await import("../src/js/state.js");
const {
  migrateToV2, rosterDays, block, isPresent, personById, roleById,
  filesRole, isFilesRole, setFiles, lastFilesDate, setStatus, dateOf, D, openRolesForDay
} = await import("../src/js/model.js");
const { generate, assignParkedRole, swapPeople, assignRoleToPerson } = await import("../src/js/generator.js");
const { buildDayBrief } = await import("../src/js/snapshot.js");

function load(doc) { S.data = migrateToV2(doc); S.dirty = false; }

function role(id, name, groupId, opts = {}) {
  return {
    id, name, groupId, usedAtDay: true, usedAtNight: true,
    hard: false, skillRestricted: false, essential: true, sortOrder: 1, ...opts
  };
}

const GROUPS = [
  { id: "g1", name: "Car", color: "#F8BBD0", sortOrder: 1 },
  { id: "g2", name: "Beat", color: "#C8E6C9", sortOrder: 2 },
  { id: "g3", name: "Inside", color: "#FFE0B2", sortOrder: 3 }
];

function addDays(iso, n) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function saveToLog() {
  const b = block();
  S.data.blocks.history.push({
    id: "h_" + b.startDate, startDate: b.startDate, shifts: b.shifts.slice(),
    attendance: [], assignments: b.assignments.map((a) => ({ ...a })), records: []
  });
}

beforeEach(() => localStorage.clear());

describe("H73 Files role basic", () => {
  it("Files role object and test helpers", () => {
    load(baseDoc({
      groups: GROUPS,
      roles: [role("car", "Car", "g1"), role("files", "Files", "g2", { files: true, essential: false, sortOrder: 100 })],
      people: [{ id: "a", name: "Ann", active: true }]
    }));
    const fr = filesRole();
    assert(fr, "filesRole() returns the Files role");
    assert.equal(fr.id, "files");
    assert(isFilesRole("files"), "isFilesRole recognizes the Files id");
    assert(!isFilesRole("car"), "isFilesRole returns false for other roles");
  });

  it("Generate with 3 essential roles, 1 other non-essential, Files role, 7 Present people all qualified: essentials filled, non-essential filled, remaining 3 in files", () => {
    load(baseDoc({
      groups: GROUPS,
      roles: [
        role("r1", "R1", "g1", { essential: true, sortOrder: 1 }),
        role("r2", "R2", "g2", { essential: true, sortOrder: 2 }),
        role("r3", "R3", "g3", { essential: true, sortOrder: 3 }),
        role("r4", "R4", "g1", { essential: false, sortOrder: 10 }),
        role("files", "Files", "g2", { files: true, essential: false, sortOrder: 100 })
      ],
      people: ["a", "b", "c", "d", "e", "f", "g"].map((id) => ({ id, name: id.toUpperCase(), active: true })),
      personRoles: ["a", "b", "c", "d", "e", "f", "g"].flatMap((p) => [
        { personId: p, roleId: "r1" },
        { personId: p, roleId: "r2" },
        { personId: p, roleId: "r3" },
        { personId: p, roleId: "r4" },
        { personId: p, roleId: "files" }
      ])
    }));

    generate();
    const ros = rosterDays();
    assert(ros, "roster exists after generate");
    assert(ros[0].files, "day has files array");

    // 3 essentials + 1 non-essential = 4, so 3 remain for Files
    assert.equal(ros[0].files.length, 3, "exactly 3 people in files on day 0");

    // Check that each of the 3 essentials and 1 non-essential is filled
    assert(ros[0].assign.r1, "R1 essential is filled");
    assert(ros[0].assign.r2, "R2 essential is filled");
    assert(ros[0].assign.r3, "R3 essential is filled");
    assert(ros[0].assign.r4, "R4 non-essential is filled");

    // Check that assignments and files rows are in the block assignments
    const fr = filesRole();
    const filesRows = block().assignments.filter((a) => a.roleId === fr.id && a.date === dateOf(0));
    assert.equal(filesRows.length, 3, "exactly 3 files assignment rows in block");
  });

  it("Files role person not ticked for Files and spare → Unassigned (no Files row)", () => {
    load(baseDoc({
      groups: GROUPS,
      roles: [
        role("r1", "R1", "g1", { essential: true }),
        role("files", "Files", "g2", { files: true, essential: false })
      ],
      people: [
        { id: "a", name: "Ann", active: true },
        { id: "b", name: "Bob", active: true },
        { id: "c", name: "Carol", active: true }
      ],
      personRoles: [
        { personId: "a", roleId: "r1" }, { personId: "a", roleId: "files" },
        { personId: "b", roleId: "r1" }, { personId: "b", roleId: "files" },
        { personId: "c", roleId: "r1" }  // Carol NOT ticked for Files
      ]
    }));

    generate();
    const ros = rosterDays();
    const fr = filesRole();
    const filesRows = block().assignments.filter((a) => a.roleId === fr.id && a.date === dateOf(0));

    // Fair spares never holds back someone who cannot do Files: Carol takes R1, Ann and Bob both get Files.
    assert.equal(ros[0].assign.r1, "c");
    assert.deepEqual(filesRows.map((r) => r.personId).sort(), ["a", "b"]);
  });

  it("Files role with oncePerBlock: over a 4-day block with surplus, nobody has Files on two days", () => {
    load(baseDoc({
      groups: GROUPS,
      roles: [
        role("r1", "R1", "g1", { essential: true }),
        role("files", "Files", "g2", { files: true, essential: false, oncePerBlock: true })
      ],
      people: [
        { id: "a", name: "Ann", active: true },
        { id: "b", name: "Bob", active: true },
        { id: "c", name: "Carol", active: true },
        { id: "d", name: "Dave", active: true }
      ],
      personRoles: [
        { personId: "a", roleId: "r1" }, { personId: "a", roleId: "files" },
        { personId: "b", roleId: "r1" }, { personId: "b", roleId: "files" },
        { personId: "c", roleId: "r1" }, { personId: "c", roleId: "files" },
        { personId: "d", roleId: "r1" }, { personId: "d", roleId: "files" }
      ]
    }));

    generate();
    const ros = rosterDays();
    const fr = filesRole();

    // Count how many times each person appears in files across all days
    const filesPerPerson = {};
    for (let d = 0; d < 4; d++) {
      const date = dateOf(d);
      const filesRows = block().assignments.filter((a) => a.roleId === fr.id && a.date === date);
      filesRows.forEach((r) => {
        filesPerPerson[r.personId] = (filesPerPerson[r.personId] || 0) + 1;
      });
    }

    Object.values(filesPerPerson).forEach((count) => {
      assert(count <= 1, `no person has Files more than once with oncePerBlock: ${JSON.stringify(filesPerPerson)}`);
    });
  });
});

describe("H73 Files role moves and mutations", () => {
  it("unassignPerson on Files holder removes the row", () => {
    load(baseDoc({
      groups: GROUPS,
      roles: [
        role("r1", "R1", "g1"),
        role("files", "Files", "g2", { files: true, essential: false })
      ],
      people: [{ id: "a", name: "Ann", active: true }],
      personRoles: [
        { personId: "a", roleId: "r1" },
        { personId: "a", roleId: "files" }
      ],
      blocks: {
        current: {
          id: "b", startDate: "2026-09-21", shifts: ["Day", "Day", "Night", "Night"],
          attendance: [], assignments: [
            { date: "2026-09-21", roleId: "files", personId: "a", source: "manual" }
          ]
        },
        history: []
      }
    }));

    const fr = filesRole();
    const d = 0;

    // Verify Files row exists
    let filesRows = block().assignments.filter((a) => a.roleId === fr.id && a.date === dateOf(d));
    assert.equal(filesRows.length, 1, "Files row exists before unassign");

    // Call setFiles to remove
    setFiles(d, "a", false);

    // Verify Files row is gone
    filesRows = block().assignments.filter((a) => a.roleId === fr.id && a.date === dateOf(d));
    assert.equal(filesRows.length, 0, "Files row removed after setFiles(false)");
  });

  it("setFiles adds Files row for a person", () => {
    load(baseDoc({
      groups: GROUPS,
      roles: [
        role("r1", "R1", "g1"),
        role("files", "Files", "g2", { files: true, essential: false })
      ],
      people: [{ id: "a", name: "Ann", active: true }],
      personRoles: [
        { personId: "a", roleId: "r1" },
        { personId: "a", roleId: "files" }
      ],
      blocks: {
        current: {
          id: "b", startDate: "2026-09-21", shifts: ["Day", "Day", "Night", "Night"],
          attendance: [], assignments: []
        },
        history: []
      }
    }));

    const fr = filesRole();
    const d = 0;

    setFiles(d, "a", true);

    const filesRows = block().assignments.filter((a) => a.roleId === fr.id && a.date === dateOf(d) && a.personId === "a");
    assert.equal(filesRows.length, 1, "Files row added");
  });
});

describe("H74 lastFilesDate", () => {
  it("lastFilesDate returns null when person never had Files", () => {
    load(baseDoc({
      groups: GROUPS,
      roles: [
        role("r1", "R1", "g1"),
        role("files", "Files", "g2", { files: true, essential: false })
      ],
      people: [{ id: "a", name: "Ann", active: true }],
      blocks: {
        current: {
          id: "b", startDate: "2026-09-21", shifts: ["Day", "Day", "Night", "Night"],
          attendance: [], assignments: []
        },
        history: []
      }
    }));

    const d = 1; // day index 1
    const date = lastFilesDate("a", d);
    assert.equal(date, null, "lastFilesDate is null when person never had Files");
  });

  it("lastFilesDate from earlier days of current block", () => {
    load(baseDoc({
      groups: GROUPS,
      roles: [
        role("r1", "R1", "g1"),
        role("files", "Files", "g2", { files: true, essential: false })
      ],
      people: [{ id: "a", name: "Ann", active: true }],
      personRoles: [{ personId: "a", roleId: "files" }],
      blocks: {
        current: {
          id: "b", startDate: "2026-09-21", shifts: ["Day", "Day", "Night", "Night"],
          attendance: [], assignments: [
            { date: "2026-09-21", roleId: "files", personId: "a", source: "manual" }
          ]
        },
        history: []
      }
    }));

    const fr = filesRole();
    const d = 2; // asking about day 2 (2026-09-23)
    const date = lastFilesDate("a", d);

    assert.equal(date, "2026-09-21", "lastFilesDate returns the day Ann had Files");
  });

  it("lastFilesDate from saved history entry", () => {
    load(baseDoc({
      groups: GROUPS,
      roles: [
        role("r1", "R1", "g1"),
        role("files", "Files", "g2", { files: true, essential: false })
      ],
      people: [{ id: "a", name: "Ann", active: true }],
      personRoles: [{ personId: "a", roleId: "files" }],
      blocks: {
        current: {
          id: "b", startDate: "2026-09-21", shifts: ["Day", "Day", "Night", "Night"],
          attendance: [], assignments: []
        },
        history: [
          {
            id: "h1", startDate: "2026-09-17", shifts: ["Day", "Day", "Night", "Night"],
            attendance: [],
            assignments: [
              { date: "2026-09-19", roleId: "files", personId: "a", source: "manual" }
            ]
          }
        ]
      }
    }));

    const d = 0; // asking about day 0 (2026-09-21)
    const date = lastFilesDate("a", d);

    assert.equal(date, "2026-09-19", "lastFilesDate finds Files in history before current block");
  });

  it("lastFilesDate ignores days person was not Present", () => {
    load(baseDoc({
      groups: GROUPS,
      roles: [
        role("r1", "R1", "g1"),
        role("files", "Files", "g2", { files: true, essential: false })
      ],
      people: [{ id: "a", name: "Ann", active: true }],
      personRoles: [{ personId: "a", roleId: "files" }],
      blocks: {
        current: {
          id: "b", startDate: "2026-09-21", shifts: ["Day", "Day", "Night", "Night"],
          attendance: [
            { date: "2026-09-21", personId: "a", statusId: "annual_leave" }
          ],
          assignments: [
            { date: "2026-09-21", roleId: "files", personId: "a", source: "manual" }
          ]
        },
        history: []
      }
    }));

    const d = 1; // asking about day 1
    const date = lastFilesDate("a", d);

    assert.equal(date, null, "lastFilesDate ignores non-Present days with Files rows");
  });
});

describe("H28 + H73 fair spares", () => {
  it("fair spares: the person who has had Files least is the one left free for Files", () => {
    /* Same R1 share for both (H28 tie), but Ann has had Files half her duties and Bob never. */
    const hist = [];
    for (let i = 1; i <= 4; i++) {
      const day = addDays("2026-09-01", i);
      hist.push({ date: day, roleId: "r1", personId: "a" }, { date: day, roleId: "r1", personId: "b" });
      hist.push({ date: addDays("2026-08-01", i), roleId: "files", personId: "a" }, { date: addDays("2026-08-01", i), roleId: "x", personId: "b" });
    }
    for (let run = 0; run < 10; run++) {
      load(baseDoc({
        groups: GROUPS,
        roles: [
          role("r1", "R1", "g1", { essential: true, usedAtNight: false }),
          role("x", "X", "g3", { essential: false, usedAtDay: false, usedAtNight: false }),
          role("files", "Files", "g2", { files: true, essential: false })
        ],
        people: [{ id: "a", name: "Ann", active: true }, { id: "b", name: "Bob", active: true }],
        personRoles: [
          { personId: "a", roleId: "r1" }, { personId: "a", roleId: "files" },
          { personId: "b", roleId: "r1" }, { personId: "b", roleId: "files" }
        ]
      }));
      S.data.blocks.history.push({ id: "h1", startDate: "2026-08-01", shifts: ["Day", "Day", "Night", "Night"], attendance: [], assignments: hist, records: [] });
      generate();
      const ros = rosterDays();
      assert.equal(ros[0].assign.r1, "a", "Ann (more Files) takes the real role");
      assert.deepEqual(ros[0].files, ["b"], "Bob (never had Files) is the spare on Files");
    }
  });
});

describe("H28 essential roles regression", () => {
  it("2 essential Car (P1, P2 only) + 1 essential Desk (all qualified) + 1 essential Van (P2 only), 5 Present → all 3 essentials filled consistently", () => {
    for (let run = 0; run < 20; run++) {
      load(baseDoc({
        groups: GROUPS,
        roles: [
          role("car", "Car", "g1", { essential: true, sortOrder: 1 }),
          role("desk", "Desk", "g2", { essential: true, sortOrder: 2 }),
          role("van", "Van", "g3", { essential: true, sortOrder: 3 }),
          role("files", "Files", "g1", { files: true, essential: false })
        ],
        people: [
          { id: "p1", name: "P1", active: true },
          { id: "p2", name: "P2", active: true },
          { id: "p3", name: "P3", active: true },
          { id: "p4", name: "P4", active: true },
          { id: "p5", name: "P5", active: true }
        ],
        personRoles: [
          { personId: "p1", roleId: "car" },
          { personId: "p1", roleId: "desk" },
          { personId: "p2", roleId: "car" },
          { personId: "p2", roleId: "desk" },
          { personId: "p2", roleId: "van" },
          { personId: "p3", roleId: "desk" },
          { personId: "p4", roleId: "desk" },
          { personId: "p5", roleId: "desk" },
          // Everyone qualified for Files
          { personId: "p1", roleId: "files" },
          { personId: "p2", roleId: "files" },
          { personId: "p3", roleId: "files" },
          { personId: "p4", roleId: "files" },
          { personId: "p5", roleId: "files" }
        ]
      }));

      generate();
      const ros = rosterDays();

      assert(ros[0].assign.car, `Run ${run}: Car should be filled`);
      assert(ros[0].assign.desk, `Run ${run}: Desk should be filled`);
      assert(ros[0].assign.van, `Run ${run}: Van should be filled`);
    }
  });
});

describe("H73/H74 roster mutations and screen integration", () => {
  it("assignParkedRole onto Files holder → holder gets role, Files dropped", () => {

    load(baseDoc({
      groups: GROUPS,
      roles: [
        role("r1", "R1", "g1", { essential: true }),
        role("r2", "R2", "g2", { essential: true }),
        role("files", "Files", "g3", { files: true, essential: false })
      ],
      people: [
        { id: "a", name: "Ann", active: true },
        { id: "b", name: "Bob", active: true }
      ],
      personRoles: [
        { personId: "a", roleId: "r1" }, { personId: "a", roleId: "files" },
        { personId: "b", roleId: "r1" }, { personId: "b", roleId: "r2" }, { personId: "b", roleId: "files" }
      ],
      blocks: {
        current: {
          id: "b", startDate: "2026-09-21", shifts: ["Day", "Day", "Night", "Night"],
          attendance: [], assignments: [
            { date: "2026-09-21", roleId: "r1", personId: "a" },
            { date: "2026-09-21", roleId: "files", personId: "b" }
          ]
        },
        history: []
      }
    }));

    const fr = filesRole();
    const d = 0;

    // Bob has Files, Ann has r1. r2 is vacant essential.
    assignParkedRole(d, "r2", "b");

    // Bob should now have r2, Files should be gone for Bob
    const ros = rosterDays();
    assert.equal(ros[d].assign.r2, "b", "Bob now has r2");
    assert(!ros[d].files.includes("b"), "Bob is no longer in files");
  });

  it("swapPeople essential↔Files: Files holder takes role, former holder gets Files back", () => {

    load(baseDoc({
      groups: GROUPS,
      roles: [
        role("r1", "R1", "g1", { essential: true }),
        role("files", "Files", "g2", { files: true, essential: false })
      ],
      people: [
        { id: "a", name: "Ann", active: true },
        { id: "b", name: "Bob", active: true }
      ],
      personRoles: [
        { personId: "a", roleId: "r1" }, { personId: "a", roleId: "files" },
        { personId: "b", roleId: "r1" }, { personId: "b", roleId: "files" }
      ],
      blocks: {
        current: {
          id: "b", startDate: "2026-09-21", shifts: ["Day", "Day", "Night", "Night"],
          attendance: [], assignments: [
            { date: "2026-09-21", roleId: "r1", personId: "a" },
            { date: "2026-09-21", roleId: "files", personId: "b" }
          ]
        },
        history: []
      }
    }));

    const d = 0;
    swapPeople(d, "a", "b");

    const ros = rosterDays();
    assert.equal(ros[d].assign.r1, "b", "Bob now has r1");
    assert(ros[d].files.includes("a"), "Ann now in files");
  });

  it("swapPeople role holder → plain Unassigned person hands over the role; holder does not get Files", () => {
    load(baseDoc({
      groups: GROUPS,
      roles: [role("r1", "R1", "g1", { essential: true }), role("files", "Files", "g2", { files: true, essential: false })],
      people: [{ id: "a", name: "Ann", active: true }, { id: "b", name: "Bob", active: true }],
      personRoles: [
        { personId: "a", roleId: "r1" }, { personId: "a", roleId: "files" },
        { personId: "b", roleId: "r1" }, { personId: "b", roleId: "files" }
      ],
      blocks: {
        current: {
          id: "b", startDate: "2026-09-21", shifts: ["Day", "Day", "Night", "Night"],
          attendance: [], assignments: [{ date: "2026-09-21", roleId: "r1", personId: "a" }]
        },
        history: []
      }
    }));
    swapPeople(0, "a", "b");
    const ros = rosterDays();
    assert.equal(ros[0].assign.r1, "b");
    assert.deepEqual(ros[0].files, []);
  });

  it("assignRoleToPerson(filesId, pid) validates Present+canDo then setFiles", () => {

    load(baseDoc({
      groups: GROUPS,
      roles: [
        role("r1", "R1", "g1", { essential: true }),
        role("files", "Files", "g2", { files: true, essential: false })
      ],
      people: [
        { id: "a", name: "Ann", active: true },
        { id: "b", name: "Bob", active: true }
      ],
      personRoles: [
        { personId: "a", roleId: "r1" }, { personId: "a", roleId: "files" },
        { personId: "b", roleId: "r1" }, { personId: "b", roleId: "files" }
      ],
      blocks: {
        current: {
          id: "b", startDate: "2026-09-21", shifts: ["Day", "Day", "Night", "Night"],
          attendance: [], assignments: [
            { date: "2026-09-21", roleId: "r1", personId: "a" }
          ]
        },
        history: []
      }
    }));

    const fr = filesRole();
    const d = 0;

    // Bob is unassigned, should be able to get Files
    assignRoleToPerson(d, fr.id, "b");

    const ros = rosterDays();
    assert(ros[d].files.includes("b"), "Bob now in files");

    // openRolesForDay should include Files
    const open = openRolesForDay(d);
    assert(open.some((r) => r.id === fr.id), "Files is in openRolesForDay");
  });

  it("buildDayBrief lists each Files person", () => {

    load(baseDoc({
      groups: GROUPS,
      roles: [
        role("r1", "R1", "g1", { essential: true }),
        role("files", "Files", "g2", { files: true, essential: false })
      ],
      people: [
        { id: "a", name: "Ann", active: true },
        { id: "b", name: "Bob", active: true },
        { id: "c", name: "Carol", active: true }
      ],
      personRoles: [
        { personId: "a", roleId: "r1" }, { personId: "a", roleId: "files" },
        { personId: "b", roleId: "r1" }, { personId: "b", roleId: "files" },
        { personId: "c", roleId: "r1" }, { personId: "c", roleId: "files" }
      ],
      blocks: {
        current: {
          id: "b", startDate: "2026-09-21", shifts: ["Day", "Day", "Night", "Night"],
          attendance: [], assignments: [
            { date: "2026-09-21", roleId: "r1", personId: "a" },
            { date: "2026-09-21", roleId: "files", personId: "b" },
            { date: "2026-09-21", roleId: "files", personId: "c" }
          ]
        },
        history: []
      }
    }));

    const brief = buildDayBrief(0);
    const filesPeople = brief.rows.filter((r) => r.roleId === filesRole().id);
    assert.equal(filesPeople.length, 2, "Brief lists both Files people");
    const pids = filesPeople.map((r) => r.personName);
    assert(pids.includes("Bob"), "Bob in brief");
    assert(pids.includes("Carol"), "Carol in brief");
  });

  it("ticking Files on role B unticks role A and sets B.essential=false", async () => {
    const { changes } = await import("../src/js/screens/roles.js");
    load(baseDoc({
      groups: GROUPS,
      roles: [
        role("r1", "R1", "g1", { files: true, essential: false }),
        role("r2", "R2", "g2", { files: false, essential: true })
      ]
    }));
    changes.rf(true, { r: "r2", f: "files" });
    assert.equal(roleById("r1").files, false);
    assert.equal(roleById("r2").files, true);
    assert.equal(roleById("r2").essential, false);
  });
});

describe("H73 Home setup step for the Files role", () => {
  const doc = (filesOn, ticked) => baseDoc({
    roles: [{ id: "f", name: "Files", groupId: "g1", usedAtDay: true, usedAtNight: true, essential: false, files: filesOn, sortOrder: 1 }],
    people: [{ id: "a", name: "Ann", active: true }],
    personRoles: ticked ? [{ personId: "a", roleId: "f" }] : []
  });
  it("says optional when no role is ticked Files role", async () => {
    const { filesStep } = await import("../src/js/screens/start.js");
    load(doc(false, false));
    assert.match(filesStep(), /Files role[\s\S]*Optional — tick Files role on Roles/);
  });
  it("asks for people to be ticked for Files when nobody can do it", async () => {
    const { filesStep } = await import("../src/js/screens/start.js");
    load(doc(true, false));
    assert.match(filesStep(), /Tick Files for people on People \(Select all\)/);
  });
  it("shows how many people can do Files once set up", async () => {
    const { filesStep } = await import("../src/js/screens/start.js");
    load(doc(true, true));
    assert.match(filesStep(), /1 person can do Files/);
  });
});
