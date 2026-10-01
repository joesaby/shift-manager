import { esc } from "./util.js";

/**
 * Generate rules — the one list of what Generate does. The generator reads the checks, the Home guide
 * ("How generate works") shows the help lines in this order, and `npm run docs:rules` writes the PRD
 * table from it. To change a rule: edit it here, update its test, run `npm run docs:rules`.
 *
 * kind:
 *   structural — the order Generate works in (implemented in generator.js; listed here for the docs)
 *   filter     — a person who breaks it is never given the role in a pass where the mode is "hard"
 *   soft       — breaking it costs a penalty, so it only gives way when there is no other arrangement
 *   objective  — the score Generate minimises among allowed people (exactly one)
 * essential / nonEssential: how each pass applies a filter / soft rule — "hard" | "soft" | "off".
 * breaks(ctx): ctx = { role, prevRole, qualified, usedGroup, night, prevNight } for one person × role × day.
 * help: one plain-English line; **bold** becomes <b> on Home and stays bold in the PRD.
 */

/** H28: how far back Generate looks in the Log (months before the block starts). */
export const LOOKBACK_MONTHS = 12;

export const RULES = [
  { key: "present", id: "H6", kind: "structural",
    help: "Only people marked **Present** that day get a role." },
  { key: "qualified", id: "H7", kind: "filter", essential: "hard", nonEssential: "hard",
    help: "People only get roles they are ticked for on **People**.",
    breaks: (c) => !c.qualified },
  { key: "fixedRole", id: "H8", kind: "structural",
    help: "**Only do this role** people get that role first." },
  { key: "essentialFirst", id: "H44", kind: "structural",
    help: "**Essential** roles are filled before the others. Non-essential roles are filled from whoever is left, in the order listed on Roles and groups." },
  { key: "filesTakesSpares", id: "H73", kind: "structural",
    help: "The **Files** role (ticked on Roles and groups) goes to everyone still free once the other roles are filled — any number of people a day. With **Once per block** ticked, someone who already had Files this block is left Unassigned." },
  { key: "filesFairSpares", id: "H73", kind: "structural",
    help: "Who is left free for Files rotates: people who have had Files **least, as a share of their duties**, are kept back from the other roles first. Fair spread of the other roles still comes first." },
  { key: "leastDone", id: "H28", kind: "objective",
    help: "Each role goes to whoever has done it **least, as a share of their own duties**, over the last " + LOOKBACK_MONTHS + " months of rosters saved to the Log plus the earlier days of this block. Only days they were Present count. Ties are picked at random.",
    /* Share, not raw count, so a new starter or someone back from long leave is not picked for the same role for months. */
    score: (c) => (c.total > 0 ? c.count / c.total : 0) },
  { key: "sameGroup", id: "H71", kind: "soft", essential: "soft", nonEssential: "hard",
    help: "Nobody gets a role from the same group (e.g. Car) two days running when someone else can cover.",
    breaks: (c) => !!(c.prevRole && c.prevRole.groupId === c.role.groupId) },
  { key: "hardNights", id: "H11", kind: "soft", essential: "soft", nonEssential: "soft",
    help: "On the second night, nobody gets a hard role if they had a hard role the night before, when someone else can cover.",
    breaks: (c) => !!(c.night && c.prevNight && c.role.hard && c.prevRole && c.prevRole.hard) },
  { key: "oncePerBlock", id: "H70", kind: "filter", essential: "hard", nonEssential: "hard",
    help: "**Once per block** roles go to a person on one day of the block at most.",
    breaks: (c) => !!(c.role.oncePerBlock && c.usedGroup) },
  { key: "emptyOnlyIfImpossible", id: "H13", kind: "structural",
    help: "An essential role is only left empty when nobody Present can take it. You'll see a warning, and you can fill it by hand." }
];

/** Rules the given pass ("essential" | "nonEssential") enforces as never-break / as penalties. */
export const hardRules = (pass) => RULES.filter((r) => r.breaks && r[pass] === "hard");
export const softRules = (pass) => RULES.filter((r) => r.breaks && r[pass] === "soft");

/** Help line as HTML: escaped, **bold** → <b>. */
export const helpHtml = (text) => esc(text).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");

export const RULES_START = "<!-- rules:start (generated from src/js/rules.js by npm run docs:rules — do not edit by hand) -->";
export const RULES_END = "<!-- rules:end -->";

const MODE = { hard: "never broken", soft: "gives way if no other way", off: "not applied" };

/** Markdown table for the PRD. */
export function rulesMarkdown() {
  const cell = (r, pass) => (r.breaks ? MODE[r[pass]] : r.kind === "objective" ? "score" : "order of work");
  const rows = RULES.map((r, i) => `| ${i + 1} | ${r.id} | \`${r.key}\` | ${r.kind} | ${cell(r, "essential")} | ${cell(r, "nonEssential")} | ${r.help} |`);
  return ["| # | H-id | Key | Kind | Essential pass | Non-essential pass | Rule (shown on Home) |",
    "| --- | --- | --- | --- | --- | --- | --- |"].concat(rows).join("\n");
}
