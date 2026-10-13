/**
 * H34 — People are listed by surname (last word of the name, then given name) everywhere a team list is
 * shown: People, Attendance, Roster and the printed Duty detail. Borrowed people (H76) still follow the team.
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { stubLocalStorage, baseDoc } from "./helpers.js";

stubLocalStorage();

const { S } = await import("../src/js/state.js");
const M = await import("../src/js/model.js");
const { buildSnapshot } = await import("../src/js/snapshot.js");

function load(doc) { S.data = M.migrateToV2(doc); S.dirty = false; }
const person = (id, name, extra = {}) => ({ id, name, active: true, fixedRoleId: null, ...extra });

/** Added in the order Zoe, Bob, Carl, Ann, Dee: not alphabetical by surname. */
function doc() {
  return baseDoc({
    people: [
      person("z", "Zoe Adams"), person("b", "Bob Zane"), person("c", "Carl Murphy"),
      person("a", "Ann Murphy"), person("d", "Dee Off", { active: false })
    ]
  });
}

beforeEach(() => { localStorage.clear(); });

describe("H34 surname order", () => {
  it("activePeopleBySurname sorts by surname, then given name, and leaves out inactive people", () => {
    load(doc());
    assert.deepEqual(M.activePeopleBySurname().map((p) => p.name), ["Zoe Adams", "Ann Murphy", "Carl Murphy", "Bob Zane"]);
  });

  it("does not reorder the stored team (Generate still sees the same order)", () => {
    load(doc());
    M.activePeopleBySurname();
    assert.deepEqual(M.activePeople().map((p) => p.id), ["z", "b", "c", "a"]);
  });

  it("Roster / print snapshot lists the team by surname, then borrowed people", () => {
    load(doc());
    M.addBorrowed("Aaron Aardvark");
    assert.deepEqual(buildSnapshot().people.map((p) => p.name),
      ["Zoe Adams", "Ann Murphy", "Carl Murphy", "Bob Zane", "Aaron Aardvark"]);
  });
});
