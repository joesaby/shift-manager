#!/usr/bin/env node
/**
 * Shared architect + tdd-verify gate for Cursor + Claude Code hooks.
 *
 * Modes (argv[2]):
 *   prompt    — feature/bug prompt → require Mode A; inject skill path
 *   session   — Cursor sessionStart: baseline workflow reminder
 *   post-read — mark Mode A/B / tdd-verify satisfied when skill SKILL.md is read
 *   pre-write — block Write/Edit while Mode A is required but skill unread;
 *               block Shell `gh pr create` until tdd-verify skill was read (feature sessions)
 *   stop      — Mode B follow-up when behaviour files dirty without architect
 *
 * Session state lives under os.tmpdir()/shift-manager-architect/<session>.json
 * so leftover dirty trees in other chats are less likely to false-positive forever,
 * and Read of the skill is enforced before edits.
 */
import { execSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const mode = (process.argv[2] || process.env.HOOK_MODE || 'prompt').toLowerCase();
const ROOT =
  process.env.CLAUDE_PROJECT_DIR ||
  process.env.CURSOR_PROJECT_DIR ||
  join(dirname(fileURLToPath(import.meta.url)), '../..');

const ARCHITECT_REL = [
  '.agents/skills/architect/SKILL.md',
  '.cursor/skills/architect/SKILL.md',
  '.claude/skills/architect/SKILL.md',
];

const TDD_VERIFY_REL = [
  '.agents/skills/tdd-verify/SKILL.md',
  '.cursor/skills/tdd-verify/SKILL.md',
  '.claude/skills/tdd-verify/SKILL.md',
];

export const FEATURE_BUG_RE =
  /\b(features?|bugs?|bug\s*fix|bugfix|fix(?:es)?\s+(?:the\s+|a\s+|this\s+)?(?:bugs?|issue)|issues?|implement|improv(?:e|ing)|updat(?:e|ing)|mak(?:e|ing)|wire|add(?:ing)?|build(?:ing)?|creat(?:e|ing)|chang(?:e|ing)|refactor(?:ing)?|schema|migrat\w*|allocat\w*|generat(?:e|or|ion)|roster|parking|print\s+layout|persist\w*|workspace|security\s+(?:posture|change)|prd\s+h\d+|h\d{1,3}\b)\b/i;

export const TRIVIAL_RE =
  /\b(typo|spelling|wording|copy\s+tweak|rename\s+label|one[- ]line\s+css|comment[- ]only|docs?\s+only|readme\s+only|trivial\s*:\s*true|architect\s+not\s+needed|tdd-verify\s+not\s+needed)\b/i;

const ARCHITECT_DONE_RE =
  /\b(design brief|##\s*design brief|mode\s*[ab]\b|architecture-fit|architect\s+skill|skills\/architect|\/architect|architecture-fit review)\b/i;

export const ARCHITECT_PATH_RE = /skills\/architect\/SKILL\.md/;
export const TDD_VERIFY_PATH_RE = /skills\/tdd-verify\/SKILL\.md/;

const TDD_VERIFY_DONE_RE =
  /\b(##\s*tdd-verify report|tdd-verify report|ready for pr:\s*yes|skills\/tdd-verify)\b/i;

export const PR_INTENT_RE =
  /\b(pull request|create\s+(a\s+)?pr\b|open\s+(a\s+)?pr\b|gh\s+pr\s+create|make\s+(a\s+)?pr\b)\b/i;

const BEHAVIOUR_PATH_RE =
  /^(src\/js\/|src\/styles\/app\.css|docs\/Shift_Manager_PRD\.md|docs\/PRD_Deprecated\.md|SECURITY\.md|docs\/THIRD_PARTY\.md|README\.md|AGENTS\.md|CLAUDE\.md|build\.mjs)/;

const STATE_DIR = join(tmpdir(), 'shift-manager-architect');

export function isPrCreateCommand(cmd) {
  const c = String(cmd || '');
  // gh pr create … (allow flags / heredoc wrappers)
  if (/\bgh\s+pr\s+create\b/i.test(c)) return true;
  // common wrapper: gh pr create with multiline body via $(cat <<EOF
  if (/\bgh\b[\s\S]*\bpr\b[\s\S]*\bcreate\b/i.test(c) && /\bpr\s+create\b/i.test(c)) return true;
  return false;
}

export function looksLikeFeatureOrBug(text) {
  if (!text || TRIVIAL_RE.test(text)) return false;
  return FEATURE_BUG_RE.test(text);
}

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

function sessionKey(input) {
  return (
    input.session_id ||
    input.sessionId ||
    input.conversation_id ||
    input.conversationId ||
    process.env.CLAUDE_SESSION_ID ||
    process.env.CURSOR_CONVERSATION_ID ||
    'default'
  );
}

function statePath(key) {
  return join(STATE_DIR, `${String(key).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120)}.json`);
}

function defaultState() {
  return {
    needModeA: false,
    modeADone: false,
    modeBNudgeCount: 0,
    modeBSatisfied: false,
    tddVerifyDone: false,
    lastFeaturePrompt: '',
  };
}

function loadState(key) {
  const p = statePath(key);
  if (!existsSync(p)) return defaultState();
  try {
    return { ...defaultState(), ...JSON.parse(readFileSync(p, 'utf8')) };
  } catch {
    return defaultState();
  }
}

function saveState(key, state) {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(statePath(key), JSON.stringify(state, null, 2));
}

function architectPathsLine() {
  return ARCHITECT_REL.map((p) => `\`${p}\``).join(' | ');
}

function tddVerifyPathsLine() {
  return TDD_VERIFY_REL.map((p) => `\`${p}\``).join(' | ');
}

function modeAContext() {
  return [
    'Shift Manager workflow gate (Mode A): this looks like a feature or bug fix.',
    'Your FIRST tool call must be Read on the architect skill file before any Write/Edit.',
    `Use one of: ${architectPathsLine()}.`,
    'Produce a Mode A design brief (PRD H-ids, modules, approach, docs).',
    'Skip only for typos, copy tweaks, or one-line CSS with no product surface (say "trivial: true").',
    'Then: tdd → implement → tdd-verify → verify.',
    'Before any pull request: Read tdd-verify and produce a TDD-verify report (live + deprecated PRD, daisyUI, npm test/build).',
    `tdd-verify skill: ${tddVerifyPathsLine()}.`,
    'Mode B runs before you finish if behaviour files change.',
  ].join(' ');
}

function modeBContext() {
  return [
    'Shift Manager workflow gate (Mode B): behaviour-relevant files are dirty and no architect pass was detected.',
    `Read ${architectPathsLine()} and complete Mode B (architecture-fit checklist against the diff) now.`,
    'Then finish. If truly trivial, reply with "trivial: true" and stop.',
  ].join(' ');
}

function tddVerifyPrContext() {
  return [
    'Shift Manager workflow gate (pre-PR): run the tdd-verify skill before creating a pull request.',
    `Read one of: ${tddVerifyPathsLine()}.`,
    'Produce a "## TDD-verify report" covering live PRD, PRD_Deprecated, daisyUI/vendored CSS, and npm test + build.',
    'Only then run gh pr create. Skip with "tdd-verify not needed" or "trivial: true" for docs-only/typo work.',
  ].join(' ');
}

function sessionContext() {
  return [
    'Shift Manager: for features/bug fixes, follow architect → tdd → implement → tdd-verify → verify.',
    `Architect skill: ${architectPathsLine()}.`,
    `tdd-verify (mandatory before PR): ${tddVerifyPathsLine()}.`,
    'Hooks block edits until Mode A skill is read, block gh pr create until tdd-verify is read, and nudge Mode B on stop when behaviour files are dirty.',
  ].join(' ');
}

function emitJson(obj) {
  process.stdout.write(JSON.stringify(obj));
}

function toolPath(input) {
  const ti = input.tool_input || input.toolInput || input.input || input.arguments || {};
  return String(
    ti.path ||
      ti.file_path ||
      ti.filePath ||
      ti.target_file ||
      ti.targetFile ||
      '',
  );
}

function toolName(input) {
  return String(input.tool_name || input.toolName || input.tool || '');
}

function shellCommand(input) {
  const ti = input.tool_input || input.toolInput || input.input || input.arguments || {};
  return String(ti.command || ti.cmd || ti.script || '');
}

function isWriteLike(input) {
  const name = toolName(input);
  if (/^(Write|Edit|MultiEdit|StrReplace|NotebookEdit|TabWrite)$/i.test(name)) return true;
  if (/^(write|edit|streplace)$/i.test(String(input.tool_type || input.toolType || ''))) return true;
  return false;
}

function isShellLike(input) {
  const name = toolName(input);
  if (/^(Shell|Bash|Terminal)$/i.test(name)) return true;
  if (/^(shell|bash)$/i.test(String(input.tool_type || input.toolType || ''))) return true;
  // Cursor may invoke Shell matcher with empty tool name; treat non-empty command as shell.
  if (shellCommand(input) && !isWriteLike(input) && !isReadLike(input)) return true;
  return false;
}

function isReadLike(input) {
  const name = toolName(input);
  return /^(Read|TabRead)$/i.test(name);
}

function transcriptHasArchitect(input) {
  const path = input.transcript_path || input.transcriptPath;
  if (!path) return false;
  try {
    const text = readFileSync(path, 'utf8');
    return ARCHITECT_DONE_RE.test(text) || ARCHITECT_PATH_RE.test(text);
  } catch {
    return false;
  }
}

function transcriptHasTddVerify(input) {
  const path = input.transcript_path || input.transcriptPath;
  if (!path) return false;
  try {
    const text = readFileSync(path, 'utf8');
    return TDD_VERIFY_PATH_RE.test(text) || TDD_VERIFY_DONE_RE.test(text);
  } catch {
    return false;
  }
}

function featureSession(state) {
  return !!(state.needModeA || state.lastFeaturePrompt || state.modeADone);
}

function tddVerifySatisfied(state, input) {
  return !!(state.tddVerifyDone || transcriptHasTddVerify(input));
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
      .map((line) => {
        const raw = line.slice(3).trim();
        if (raw.includes(' -> ')) return raw.split(' -> ').pop().trim();
        return raw;
      })
      .some((file) => file && BEHAVIOUR_PATH_RE.test(file));
  } catch {
    return false;
  }
}

function deny(msg) {
  emitJson({
    permission: 'deny',
    user_message: msg,
    agent_message: msg,
    decision: 'block',
    reason: msg,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: msg,
    },
  });
}

function emitPromptGate(input) {
  const key = sessionKey(input);
  const state = loadState(key);
  const prompt = String(input.prompt || input.text || '');

  // PR intent on a feature session → remind tdd-verify even if not a new feature phrase.
  if (PR_INTENT_RE.test(prompt) && featureSession(state) && !TRIVIAL_RE.test(prompt) && !tddVerifySatisfied(state, input)) {
    const ctx = tddVerifyPrContext();
    emitJson({
      continue: true,
      additional_context: ctx,
      agent_message: ctx,
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        additionalContext: ctx,
      },
    });
    return;
  }

  if (!looksLikeFeatureOrBug(prompt)) {
    emitJson({ continue: true });
    return;
  }

  state.needModeA = true;
  state.modeADone = false;
  state.tddVerifyDone = false;
  state.lastFeaturePrompt = prompt.slice(0, 500);
  saveState(key, state);

  const ctx = modeAContext();
  emitJson({
    continue: true,
    additional_context: ctx,
    agent_message: ctx,
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: ctx,
    },
  });
}

function emitSessionStart(input) {
  const key = sessionKey(input);
  saveState(key, defaultState());
  const ctx = sessionContext();
  emitJson({
    additional_context: ctx,
    env: {},
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: ctx,
    },
  });
}

function emitPostRead(input) {
  if (!isReadLike(input) && toolName(input)) {
    // Some hosts call this only for Read; if unknown, still inspect path.
  }
  const path = toolPath(input).replace(/\\/g, '/');
  const key = sessionKey(input);
  const state = loadState(key);
  let note = '';

  if (ARCHITECT_PATH_RE.test(path)) {
    state.modeADone = true;
    state.needModeA = false;
    state.modeBSatisfied = true;
    note =
      'Architect skill loaded. Complete Mode A design brief (or Mode B checklist if finishing), then continue.';
  }

  if (TDD_VERIFY_PATH_RE.test(path)) {
    state.tddVerifyDone = true;
    note = note
      ? `${note} tdd-verify skill loaded — produce the TDD-verify report before gh pr create.`
      : 'tdd-verify skill loaded. Produce a "## TDD-verify report" (live + deprecated PRD, daisyUI, npm test/build) before creating a PR.';
  }

  if (!note) {
    emitJson({});
    return;
  }

  saveState(key, state);
  emitJson({ additional_context: note });
}

function emitPreWrite(input) {
  const key = sessionKey(input);
  const state = loadState(key);

  // Pre-PR: block gh pr create until tdd-verify for feature sessions.
  if (isShellLike(input) || isPrCreateCommand(shellCommand(input))) {
    const cmd = shellCommand(input);
    if (isPrCreateCommand(cmd)) {
      if (TRIVIAL_RE.test(state.lastFeaturePrompt || '')) {
        // fall through allow
      } else if (featureSession(state) && !tddVerifySatisfied(state, input)) {
        deny(
          'Blocked: read the tdd-verify skill and produce a TDD-verify report before creating a PR. ' +
            `Read one of: ${tddVerifyPathsLine()}. ` +
            'Or say "tdd-verify not needed" / "trivial: true" for docs-only work.',
        );
        return;
      }
    }
    // Non-PR shell: allow (do not apply Mode A write gate to shell).
    if (isShellLike(input) && !isWriteLike(input)) {
      emitJson({
        permission: 'allow',
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'allow',
        },
      });
      return;
    }
  }

  if (!isWriteLike(input) && toolName(input) && !/Write|Edit|StrReplace|MultiEdit/i.test(toolName(input))) {
    emitJson({ permission: 'allow' });
    return;
  }

  if (state.needModeA && !state.modeADone && !transcriptHasArchitect(input)) {
    deny(
      'Blocked: read the architect skill (Mode A) before editing. ' +
        `Read one of: ${architectPathsLine()}.`,
    );
    return;
  }

  emitJson({
    permission: 'allow',
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'allow',
    },
  });
}

function emitStopGate(input) {
  if (input.stop_hook_active === true) {
    emitJson({});
    return;
  }

  const key = sessionKey(input);
  const state = loadState(key);
  const loopCount = Number(input.loop_count ?? input.loopCount ?? 0);
  const dirty = behaviourFilesDirty();
  const evidence =
    state.modeBSatisfied ||
    state.modeADone ||
    transcriptHasArchitect(input);

  if (loopCount >= 2 || state.modeBNudgeCount >= 2) {
    emitJson({});
    return;
  }

  if (!dirty || evidence) {
    emitJson({});
    return;
  }

  if (!state.needModeA && !state.lastFeaturePrompt && !state.modeADone) {
    emitJson({});
    return;
  }

  state.modeBNudgeCount = (state.modeBNudgeCount || 0) + 1;
  saveState(key, state);

  const reason = modeBContext();
  emitJson({
    followup_message: reason,
    decision: 'block',
    reason,
  });
}

function main() {
  const input = parseInput(readStdin());

  switch (mode) {
    case 'session':
    case 'sessionstart':
      emitSessionStart(input);
      break;
    case 'post-read':
    case 'postread':
      emitPostRead(input);
      break;
    case 'pre-write':
    case 'prewrite':
    case 'pre-pr':
    case 'prepr':
      emitPreWrite(input);
      break;
    case 'stop':
      emitStopGate(input);
      break;
    case 'prompt':
    default:
      emitPromptGate(input);
      break;
  }
}

const isDirectRun =
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isDirectRun) {
  main();
  process.exit(0);
}
