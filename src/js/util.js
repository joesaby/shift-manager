/* ------------------------------------------------------------------ formatting + id helpers */
export const STAT = ["Present", "Annual leave", "Sick leave", "Duty away", "Rest day"];
export const SBG = { "Present": "#EAF4EC", "Annual leave": "#BBDEFB", "Sick leave": "#FFCDD2", "Duty away": "#E1BEE7", "Rest day": "#E0E0E0" };
export const LKEY = "shiftManager.v2";
export const LKEY_LEGACY = "shiftManager.v1";

export const uid = () => Math.random().toString(36).slice(2, 9);
export const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const iso = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
export const addDays = (s, n) => { const d = new Date(s + "T12:00:00"); d.setDate(d.getDate() + n); return iso(d); };
export const fmt = (s) => new Date(s + "T12:00:00").toLocaleDateString("en-IE", { weekday: "short", day: "numeric", month: "short" });
export const fmtLong = (s) => new Date(s + "T12:00:00").toLocaleDateString("en-IE", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

/* ------------------------------------------------------------------ nav + icons */
export const NAV = [["start", "Home", "Guide"], ["att", "1. Attendance", "Each block"], ["ros", "2. Roster", ""], ["prt", "3. Print rota", ""], ["ppl", "People", "Set up"], ["skl", "Skills", ""], ["rol", "Roles and groups", ""], ["log", "Log", "Records"], ["hist", "Historic roster", ""], ["stats", "Duty stats", ""]];

export const ICON = {
  start: '<path d="M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 115 0c0 1.5-2.5 2-2.5 4"/><path d="M12 17h.01"/>',
  att: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  ros: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>',
  prt: '<rect x="6" y="3" width="12" height="6"/><rect x="3" y="9" width="18" height="8" rx="2"/><rect x="7" y="14" width="10" height="7"/>',
  ppl: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14c3 0 5 2 5 5"/>',
  skl: '<path d="M12 3l2.5 5.5L20 10l-4.5 3.5L17 20l-5-3-5 3 1.5-6.5L4 10l5.5-1.5z"/>',
  rol: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  log: '<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10a1 1 0 001 1h12a1 1 0 001-1V9M10 13h4"/>',
  hist: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M8 14h3M13 14h3M8 17h8"/>',
  stats: '<path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/>'
};
export const icon = (k) => `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>`;
