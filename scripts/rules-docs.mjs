#!/usr/bin/env node
/** Writes the Generate rules table (from src/js/rules.js) into docs/Shift_Manager_PRD.md between the rules markers. */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { rulesMarkdown, RULES_START, RULES_END } from "../src/js/rules.js";

const prd = join(dirname(fileURLToPath(import.meta.url)), "..", "docs", "Shift_Manager_PRD.md");
const s = readFileSync(prd, "utf8");
const a = s.indexOf(RULES_START); const b = s.indexOf(RULES_END);
if (a < 0 || b < a) { console.error("Rules markers not found in " + prd); process.exit(1); }
const out = s.slice(0, a + RULES_START.length) + "\n\n" + rulesMarkdown() + "\n\n" + s.slice(b);
if (out === s) console.log("PRD rules table already up to date.");
else { writeFileSync(prd, out); console.log("Updated PRD rules table."); }
