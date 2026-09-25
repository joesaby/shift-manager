# Security

Shift Manager is an **offline, single-file browser application** intended for An Garda Síochána shift managers. It has **no server component** and does **not** send duty data to the internet.

This document is for ICT / information-security reviewers and local managers deploying the app.

---

## Security summary

| Topic | Position |
| --- | --- |
| Network | No cloud API. No telemetry. No CDN at runtime. Opening the HTML from disk works without a network. |
| Data location | Unit data stays on the workstation or in a folder the manager chooses (e.g. unit share). |
| Authentication | None in-app. Access control is OS / folder / browser profile permissions. |
| Delivery | Prefer a **known release zip** from the official GitHub Releases page; verify the version tag. |
| Third-party code | UI CSS is vendored into the file at build time. Runtime ships **no** live third-party scripts. See [THIRD_PARTY.md](docs/THIRD_PARTY.md). |

---

## What the application is

1. One HTML file (`shift-manager.html`, also packaged as `shift-manager-offline.zip`).
2. All application JavaScript and styles are **embedded in that file** at build time.
3. Open it in Chrome or Edge (recommended). No install, no background service, no auto-update channel.

After the file is on disk, the app is designed to work **with the network disconnected**.

---

## Data handled

Typical content (unit-local operational data):

- Unit and manager names  
- People names, optional **employee numbers** and **shoulder numbers**, roles, skills / qualifications  
- Attendance for a four-day block  
- Generated / edited duty roster  
- Saved rota log entries and CSV exports  
- Optional plain-text audit lines under the workspace `logs/` folder  

Employee and shoulder numbers are stored as strings in the unit JSON (`shift-manager-data.json`), the workspace folder (including `backups/`), browser `localStorage` backup, and saved rota snapshots in the Log. They appear on Roster/print when set. Treat them under the same records and access controls as other unit-local operational data.

Treat the workspace folder and any JSON / CSV / printouts as **official records** under local Garda ICT and records policy (classification, retention, sharing).

**Not collected:** passwords, PPS numbers, device identifiers for tracking, analytics, or crash reports to a vendor.

---

## Where data is stored

| Store | What | Notes |
| --- | --- | --- |
| **Workspace folder** (recommended) | `shift-manager-data.json`, `backups/`, `logs/` | Chosen via **Choose folder** (File System Access API). Browser re-asks permission each session. |
| **Manual JSON file** | Same document via Save / Open | Fallback when folder API is unavailable. |
| **Browser `localStorage`** | Backup copy of the document; manager display name | Bound to that browser profile on that machine. Clearable by the user or IT. |
| **Browser IndexedDB** | Remembered folder *handle* only (not the rota data) | Lets the app reconnect to the same folder after a restart; permission still required. |
| **Print / CSV** | User-initiated export | Leaves the app; control via printer and file save location. |

**Implications**

- Shared PCs: use a dedicated browser profile or clear site data when finished; prefer a unit folder on an approved share rather than relying on `localStorage`.  
- Shared network folders: last writer wins; coordinate who edits.  
- Device loss / malware: same risk as any local Office file — encrypt disks, lock screens, follow ICT endpoint policy.

---

## Network behaviour

| Behaviour | Detail |
| --- | --- |
| Production offline use (`file://`) | No outbound calls for normal operation. |
| Optional local mock load | If served over `http(s)` next to `data/shift-manager-data.json`, the app may `fetch` that **same-origin** file once for demos. This is skipped on `file://` and skipped when the browser already has saved unit data. |
| External URLs | No analytics, fonts, maps, or script CDNs are loaded at runtime. |
| Auto-update | None. New versions are installed by replacing the HTML/zip from an approved release. |

Opening the HTML while online does not by itself upload rota data. Standard browser features (spell-check, password managers, enterprise agents) remain under ICT control.

---

## Trust boundary and access control

The app does **not** implement Garda single sign-on, roles, or encryption of its JSON.

Security depends on:

1. **Who can open the HTML** on the workstation.  
2. **Who can read/write the unit folder** (NTFS / share ACLs).  
3. **Who uses that browser profile** (`localStorage` / IndexedDB).  
4. **Chain of custody for the release file** (see below).

Manager name is for audit/display (“Prepared by”), not a login.

---

## Application hardening (built-in)

- User-supplied text (names, roles, unit, etc.) is **HTML-escaped** before insertion into the UI (`esc()`), reducing XSS risk from pasted content.  
- Data is plain JSON the organisation can inspect, backup, and diff.  
- Destructive actions (e.g. clear data) ask for confirmation.  
- Folder access uses the browser’s permission prompts; the app cannot silently access arbitrary disks.  
- Build embeds assets; the shipped file does not download frameworks when opened.

Residual risks (honest scope):

- A maliciously modified HTML file could do anything a local page can do in the browser — **only run release builds from a trusted source**.  
- XSS defense is best-effort escaping, not a full Content Security Policy sandbox (CSP is limited for single-file `file://` apps).  
- No at-rest encryption inside the JSON; use disk/share encryption per ICT standards.

---

## Recommended deployment (security-conscious)

1. Download **`shift-manager-offline-vX.Y.Z.zip`** from the official [GitHub Releases](https://github.com/joesaby/shift-manager/releases) for a pinned version.  
2. Optionally verify the tag / release notes and keep a local hash of the approved HTML for comparison.  
3. Place the HTML on an **approved** location (local disk or controlled share). Prefer `file://` open for true air-gap style use.  
4. Per unit: one workspace folder; restrict NTFS/share permissions to staff who need to edit that unit’s rota.  
5. Do not mix units in one folder.  
6. Keep backups via the app’s `backups/` folder and/or organisational backup of the share.  
7. Upgrade by deliberate replace of the HTML from a newer approved release — not by browsing untrusted copies.

---

## Build and supply chain

| Stage | What runs |
| --- | --- |
| **Runtime (managers)** | Browser + one HTML file. No Node, no npm, no installer. |
| **Build (developers / CI)** | Node.js, `esbuild`, and OS `zip` produce the release artifact on GitHub Actions. |

Third-party components and licences: [docs/THIRD_PARTY.md](docs/THIRD_PARTY.md).

Source and release automation: https://github.com/joesaby/shift-manager

---

## Reporting a security concern

If you believe you have found a vulnerability in Shift Manager, **do not** open a public issue with exploit detail.

Contact the maintainer via the GitHub repository security advisory flow or the repository owner account (**joesaby**), and allow time for a fixed release before public disclosure.

For operational ICT incidents involving unit data on a workstation or share, follow An Garda Síochána internal incident procedures first.

---

## Terms

Use of Shift Manager is under the [MIT License](LICENSE). Plain-language summary (no warranty, no liability, no SLA unless separately agreed): [`TERMS.md`](TERMS.md).
