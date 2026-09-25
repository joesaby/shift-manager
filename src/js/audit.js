import { hasWorkspace, appendAuditLine } from "./workspace.js";

const SESSION_USER_KEY = "shiftManager.sessionUser";
const sessionId = Math.random().toString(36).slice(2, 9).toUpperCase();
let sessionUser = null;

try {
  const saved = localStorage.getItem(SESSION_USER_KEY);
  if (saved) sessionUser = saved;
} catch (e) { /* ignore */ }

export const getSessionUser = () => sessionUser;
export function setSessionUser(name) {
  sessionUser = (name || "").trim() || null;
  try {
    if (sessionUser) localStorage.setItem(SESSION_USER_KEY, sessionUser);
    else localStorage.removeItem(SESSION_USER_KEY);
  } catch (e) { /* ignore */ }
}

let auditTestSink = null;
export function setAuditTestSink(fn) { auditTestSink = fn || null; }

/* Key milestone events only (not every keystroke) - see logAudit call sites in
   generator.js/actions. Silently does nothing when no workspace is connected
   (except optional auditTestSink for unit tests). */
export function logAudit(action, detail) {
  if (typeof auditTestSink === "function") auditTestSink(action, detail);
  if (!hasWorkspace()) return;
  const line = [new Date().toISOString(), "session=" + sessionId, "user=" + (sessionUser || "unknown"), action, detail || ""].join("\t");
  appendAuditLine(line);
}
