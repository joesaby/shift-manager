#!/usr/bin/env node
/**
 * Shared architect gate for Cursor + Claude Code hooks.
 *
 * Modes (argv[2] or HOOK_MODE env):
 *   prompt — UserPromptSubmit / beforeSubmitPrompt: inject Mode A when
 *            the prompt looks like a feature or bug fix.
 *   stop   — Stop / stop: block/follow-up for Mode B only when the working
 *            tree has behaviour-relevant changes and no architect evidence.
 *
 * Emits dual-compatible JSON so one script works for both hosts.
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const mode = (process.argv[2] || process.env.HOOK_MODE || 'prompt').toLowerCase();
const ROOT =
  process.env.CLAUDE_PROJECT_DIR ||
  process.env.CURSOR_PROJECT_DIR ||
  join(dirname(fileURLToPath(import.meta.url)), '../..');

const ARCHITECT_PATHS = [
  '.agents/skills/architect/SKILL.md',
  '.cursor/skills/architect/SKILL.md',
  '.claude/skills/architect/SKILL.md',
];

const FEATURE_BUG_RE =
  /\b(features?|bugs?|bug\s*fix|bugfix|fix(?:es)?\s+(?:the\s+|a\s+|this\s+)?bugs?|implement|add(?:ing)?\s+(?:a\s+)?(?:new\s+)?|build(?:ing)?\s+(?:a\s+)?|create\s+(?:a\s+)?|change\s+(?:how|the)|refactor(?:ing)?\s+(?:the\s+)?(?:roster|generator|model|snapshot|attendance|schema)|schema|migrat\w*|allocat\w*|generat(?:e|or|ion)|roster\s+(?:rule|logic)|print\s+layout|persist\w*|workspace|security\s+(?:posture|change)|prd\s+h\d+)\b/i;

const TRIVIAL_RE =
  /\b(typo|spelling|wording|copy\s+tweak|rename\s+label|one[- ]line\s+css|comment[- ]only|docs?\s+only|readme\s+only)\b/i;

const ARCHITECT_DONE_RE =
  /\b(design brief|mode\s*[ab]\b|architecture-fit|architect\s+skill|skills\/architect|\/architect)\b/i;

const BEHAVIOUR_PATH_RE =
  /^(src\/js\/|src\/styles\/app\.css|docs\/Shift_Manager_PRD\.md|SECURITY\.md|docs\/THIRD_PARTY\.md|README\.md|AGENTS\.md|CLAUDE\.md|build\.mjs)/;

function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function parseInput(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  try {
    return JSON.parse(trimmed);
  } catch {
    return {};
  }
}

function looksLikeFeatureOrBug(text) {
  if (!text || TRIVIAL_RE.test(text)) return false;
  return FEATURE_BUG_RE.test(text);
}

function architectReminder(kind) {
  const paths = ARCHITECT_PATHS.map((p) => `\`${p}\``).join(' | ');
  if (kind === 'mode-a') {
    return [
      'Shift Manager workflow gate: this looks like a feature or bug fix.',
      'Before coding, read and follow the **architect** skill (Mode A — design brief).',
      `Skill file (same content): ${paths}.`,
      'Skip only for typos, copy tweaks, or one-line CSS with no product surface.',
      'Then: tdd → implement → verify.',
    ].join(' ');
  }
  return [
    'Shift Manager workflow gate: behaviour-relevant files changed, but no architect pass was detected.',
    'Read and follow **architect** Mode B (architecture-fit review against the diff) now,',
    `then finish. Skill file (same content): ${paths}.`,
    'If the change was trivial (typo / copy / one-line CSS) or Mode B is already done, say so and stop.',
  ].join(' ');
}

function emitPromptGate(input) {
  const prompt = String(input.prompt || input.text || '');
  if (!looksLikeFeatureOrBug(prompt)) {
    process.stdout.write(JSON.stringify({ continue: true }));
    return;
  }

  const ctx = architectReminder('mode-a');
  process.stdout.write(
    JSON.stringify({
      continue: true,
      additional_context: ctx,
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        additionalContext: ctx,
      },
    }),
  );
}

function transcriptMentionsArchitect(input) {
  const path = input.transcript_path || input.transcriptPath;
  if (!path) return false;
  try {
    return ARCHITECT_DONE_RE.test(readFileSync(path, 'utf8'));
  } catch {
    return false;
  }
}

function behaviourFilesDirty() {
  try {
    const out = execSync('git status --porcelain', {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out
      .split('\n')
      .map((line) => line.slice(3).trim())
      .some((file) => file && BEHAVIOUR_PATH_RE.test(file));
  } catch {
    return false;
  }
}

function emitStopGate(input) {
  if (input.stop_hook_active === true) {
    process.stdout.write(JSON.stringify({}));
    return;
  }
  const loopCount = Number(input.loop_count ?? input.loopCount ?? 0);
  if (loopCount >= 1) {
    process.stdout.write(JSON.stringify({}));
    return;
  }

  if (!behaviourFilesDirty() || transcriptMentionsArchitect(input)) {
    process.stdout.write(JSON.stringify({}));
    return;
  }

  const reason = architectReminder('mode-b');
  process.stdout.write(
    JSON.stringify({
      followup_message: reason,
      decision: 'block',
      reason,
    }),
  );
}

const input = parseInput(readStdin());

if (mode === 'stop') {
  emitStopGate(input);
} else {
  emitPromptGate(input);
}

process.exit(0);
