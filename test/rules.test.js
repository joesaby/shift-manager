/**
 * Generate rules registry (src/js/rules.js): one source for the generator, the Home guide and the PRD table.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stubLocalStorage, baseDoc } from "./helpers.js";

stubLocalStorage();
globalThis.window = globalThis.window || {};

const { RULES, rulesMarkdown, helpHtml, RULES_START, RULES_END } = await import("../src/js/rules.js");
const { S } = await import("../src/js/state.js");
const { migrateToV2 } = await import("../src/js/model.js");
const { vStart } = await import("../src/js/screens/start.js");

const PRD = readFileSync(new URL("../docs/Shift_Manager_PRD.md", import.meta.url), "utf8");
const KINDS = ["structural", "filter", "soft", "objective"];
const MODES = ["hard", "soft", "off"];

describe("RULES registry shape", () => {
  it("every rule has a unique key, an H-id, a known kind and help text", () => {
    const keys = new Set();
    RULES.forEach((r) => {
      assert.ok(r.key && !keys.has(r.key), "unique key " + r.key); keys.add(r.key);
      assert.match(r.id, /^H\d+$/, r.key);
      assert.ok(KINDS.includes(r.kind), r.key + " kind");
      assert.ok(r.help && r.help.length > 10, r.key + " help");
    });
  });

  it("filter / soft rules say how each pass treats them and can be checked", () => {
    RULES.filter((r) => r.kind === "filter" || r.kind === "soft").forEach((r) => {
      assert.equal(typeof r.breaks, "function", r.key);
      assert.ok(MODES.includes(r.essential) && MODES.includes(r.nonEssential), r.key + " modes");
    });
    assert.equal(RULES.filter((r) => r.kind === "objective").length, 1, "one objective");
  });

  it("each rule's H-id is a live (not retired) row in the PRD", () => {
    RULES.forEach((r) => {
      const row = PRD.split("\n").find((l) => l.startsWith("| " + r.id + " |"));
      assert.ok(row, r.id + " in PRD");
      assert.ok(!/Retired/.test(row), r.id + " is not retired");
    });
  });
});

describe("rule checks", () => {
  const rule = (k) => RULES.find((r) => r.key === k);
  const car = { id: "c1", groupId: "g_car", hard: true };
  const beat = { id: "b1", groupId: "g_beat", hard: false };

  it("same group two days running", () => {
    assert.equal(rule("sameGroup").breaks({ role: car, prevRole: { ...car, id: "c2" } }), true);
    assert.equal(rule("sameGroup").breaks({ role: car, prevRole: beat }), false);
    assert.equal(rule("sameGroup").breaks({ role: car, prevRole: null }), false);
  });

  it("hard role on back-to-back nights", () => {
    const hn = rule("hardNights");
    assert.equal(hn.breaks({ role: car, prevRole: car, night: true, prevNight: true }), true);
    assert.equal(hn.breaks({ role: car, prevRole: car, night: true, prevNight: false }), false);
    assert.equal(hn.breaks({ role: car, prevRole: beat, night: true, prevNight: true }), false);
  });

  it("qualification and once per block", () => {
    assert.equal(rule("qualified").breaks({ qualified: false }), true);
    assert.equal(rule("qualified").breaks({ qualified: true }), false);
    assert.equal(rule("oncePerBlock").breaks({ role: { oncePerBlock: true }, usedGroup: true }), true);
    assert.equal(rule("oncePerBlock").breaks({ role: { oncePerBlock: false }, usedGroup: true }), false);
  });
});

describe("docs generated from RULES", () => {
  it("the PRD rules table matches rulesMarkdown() (run npm run docs:rules)", () => {
    const a = PRD.indexOf(RULES_START); const b = PRD.indexOf(RULES_END);
    assert.ok(a >= 0 && b > a, "PRD has the rules markers");
    assert.equal(PRD.slice(a + RULES_START.length, b).trim(), rulesMarkdown().trim());
  });

  it("the Home guide lists every rule's help, in order", () => {
    S.data = migrateToV2(baseDoc());
    const html = vStart();
    let at = 0;
    RULES.forEach((r) => {
      const i = html.indexOf(helpHtml(r.help), at);
      assert.ok(i >= 0, "Home guide shows " + r.key);
      at = i;
    });
  });

  it("help text is escaped, with **bold** as <b>", () => {
    assert.equal(helpHtml("a <x> **b**"), "a &lt;x&gt; <b>b</b>");
  });
});
