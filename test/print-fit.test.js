/**
 * H57 print scale-to-fit + legacy snapshot rendering (old log entries must keep their spare notes).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { stubLocalStorage } from "./helpers.js";

stubLocalStorage();
globalThis.window = globalThis.window || {};

await import("../src/js/state.js"); /* load order: state before snapshot (circular imports) */
const { printFit, rotaHTML } = await import("../src/js/snapshot.js");

describe("H57 printFit", () => {
  it("keeps the normal 11px size for a typical team and never drops below 8px", () => {
    assert.equal(printFit(20).fs, 11);
    assert.ok(printFit(28).fs >= 10, "28 people stay at 10px or more");
    assert.equal(printFit(45).fs, 8);
    assert.equal(printFit(200).fs, 8);
  });

  it("shrinks monotonically as headcount grows", () => {
    let prev = Infinity;
    for (let n = 10; n <= 60; n += 1) {
      const { fs, pad } = printFit(n);
      assert.ok(fs <= prev, "font size never grows with more people");
      assert.ok(fs >= 8 && fs <= 11 && pad >= 1 && pad <= 2);
      prev = fs;
    }
  });
});

describe("legacy person-day snapshots", () => {
  const legacy = {
    layout: "person-day", unitName: "T", savedBy: "", start: "2026-09-21",
    days: [{ label: "Mon", shift: "Day", iso: "2026-09-21" }],
    people: [{ id: "p1", name: "Ann One" }],
    cells: [[{ kind: "spare", text: "HVB", color: "#FFFFFF" }]],
    unfilled: [[]], records: []
  };

  it("still prints a spare note that was typed before notes were removed", () => {
    assert.ok(rotaHTML(legacy).includes("HVB"));
  });

  it("shows Unassigned for a spare cell with no note", () => {
    const snap = { ...legacy, cells: [[{ kind: "spare", text: "", color: "#FFFFFF" }]] };
    assert.ok(rotaHTML(snap).includes("Unassigned"));
  });

  it("carries the fit variables on the print area", () => {
    assert.match(rotaHTML(legacy), /--pfs:\d+(\.\d+)?px/);
  });
});
