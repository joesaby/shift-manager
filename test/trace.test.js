/** docs:trace — derived requirement graph (PRD ↔ Spec ↔ code ↔ tests ↔ deprecated). */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { buildIndex, trace, formatTrace } from "../scripts/trace.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const idx = buildIndex(root);

describe("trace", () => {
  it("resolves a live id to its story, spec entry, code and tests", () => {
    const t = trace(idx, "H47");
    assert.equal(t.priority, "Must");
    assert.match(t.story, /^As a shift manager/);
    assert.equal(t.spec, "S9");
    assert.ok(trace(idx, "H14").mentions.includes("H53"), "H14 text mentions H53");
    assert.ok(Array.isArray(t.code) && Array.isArray(t.tests));
  });

  it("finds neighbours in both directions", () => {
    assert.ok(trace(idx, "H53").mentionedBy.includes("H14"));
  });

  it("reports retired ids with what replaced them", () => {
    const t = trace(idx, "H9");
    assert.equal(t.retired, true);
    assert.ok(t.replacedBy.includes("H28"));
  });

  it("returns null for an unknown id and formats a readable report", () => {
    assert.equal(trace(idx, "H9999"), null);
    assert.match(formatTrace(trace(idx, "H47")), /H47[\s\S]*Spec: S9/);
  });

  it("every H-id cited in src/ or test/ exists in the PRD or PRD_Deprecated", () => {
    assert.deepEqual(idx.dangling, []);
  });
});
