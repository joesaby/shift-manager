/**
 * PRD ↔ Spec lint: the PRD is written as shift-manager stories, one row per H-id;
 * technical detail lives in docs/Shift_Manager_Spec.md and the PRD row points to it.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const PRD = readFileSync(new URL("../docs/Shift_Manager_PRD.md", import.meta.url), "utf8");
const SPEC = readFileSync(new URL("../docs/Shift_Manager_Spec.md", import.meta.url), "utf8");

const rows = PRD.split("\n").filter((l) => /^\| H\d+ \|/.test(l));
const idOf = (l) => l.match(/^\| (H\d+) \|/)[1];
const live = rows.filter((l) => !/\*Retired/.test(l));
const specIds = new Set([...SPEC.matchAll(/^### (S\d+) /gm)].map((m) => m[1]));

describe("PRD requirement rows", () => {
  it("every H-id is unique", () => {
    const ids = rows.map(idOf);
    assert.deepEqual(ids.filter((id, i) => ids.indexOf(id) !== i), []);
  });

  it("live rows are 'As a shift manager' stories with a priority and a Spec reference", () => {
    live.forEach((l) => {
      const cells = l.split("|").map((c) => c.trim());
      assert.match(cells[2], /^(Must|Should|Could)$/, idOf(l) + " priority");
      assert.match(cells[3], /^As a shift manager/, idOf(l) + " story");
      assert.match(cells[4], /^S\d+$/, idOf(l) + " spec ref");
    });
  });

  it("every Spec reference resolves to a Spec entry that lists the H-id", () => {
    live.forEach((l) => {
      const s = l.split("|")[4].trim();
      assert.ok(specIds.has(s), idOf(l) + " -> " + s);
      const head = SPEC.split("\n").find((x) => x.startsWith("### " + s + " "));
      assert.ok(head, s);
      assert.ok(SPEC.includes("**" + idOf(l) + "**"), idOf(l) + " carried into the Spec");
    });
  });
});
