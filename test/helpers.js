/** Minimal localStorage stub so model/state touch() works under Node. */
export function stubLocalStorage() {
  if (globalThis.localStorage && globalThis.localStorage.__stub) return;
  const store = Object.create(null);
  globalThis.localStorage = {
    __stub: true,
    getItem(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem(k, v) { store[k] = String(v); },
    removeItem(k) { delete store[k]; },
    clear() { Object.keys(store).forEach((k) => delete store[k]); }
  };
}

export function baseDoc(overrides = {}) {
  return {
    schemaVersion: 2,
    meta: { title: "Shift Manager", unitName: "Test", updatedAt: new Date().toISOString(), app: "shift-manager-html" },
    settings: {
      statuses: [
        { id: "present", label: "Present", allocates: true, printColor: "#EAF4EC" },
        { id: "annual_leave", label: "Annual leave", allocates: false, printColor: "#BBDEFB" },
        { id: "sick_leave", label: "Sick leave", allocates: false, printColor: "#BBDEFB" },
        { id: "duty_away", label: "Duty away", allocates: false, printColor: "#BBDEFB" },
        { id: "rest_day", label: "Rest day", allocates: false, printColor: "#BBDEFB" }
      ],
      defaultShifts: ["Day", "Day", "Night", "Night"],
      blockLengthDays: 4
    },
    groups: [{ id: "g1", name: "Car", color: "#F8BBD0", sortOrder: 1 }],
    roles: [],
    people: [],
    personRoles: [],
    blocks: {
      current: {
        id: "b_current",
        startDate: "2026-09-21",
        shifts: ["Day", "Day", "Night", "Night"],
        stale: false,
        generatedAt: null,
        attendance: [],
        assignments: [],
        spareNotes: []
      },
      history: []
    },
    audit: [],
    ...overrides
  };
}
