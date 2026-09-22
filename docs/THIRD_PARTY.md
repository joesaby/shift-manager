# Third-party software

Shift Manager is mostly first-party JavaScript. A small set of **third-party** components is used for UI styling and for **building** the release zip. This notice is for licence compliance and security review (e.g. An Garda Síochána ICT).

---

## Runtime (what managers actually run)

The distributed file is a **single HTML document**. Styles and scripts are **inlined at build time**. When opened offline, the page does **not** load Tailwind, DaisyUI, fonts, or scripts from the public internet.

| Component | Role in product | How it appears | Licence | Upstream |
| --- | --- | --- | --- | --- |
| **Tailwind CSS** v3.4.19 | Utility CSS used by the UI | Pre-generated CSS embedded in `shift-manager.html` (also kept as `src/styles/tailwind.css` in source) | MIT | https://tailwindcss.com / https://github.com/tailwindlabs/tailwindcss |
| **DaisyUI** | Component / theme classes (`btn`, `modal`, `drawer`, `data-theme`, etc.) on top of Tailwind | Same vendored CSS bundle (no separate runtime package) | MIT | https://daisyui.com / https://github.com/saadeghi/daisyui |
| **An Garda Síochána crest** | Branding on screen and print | Embedded as a `data:` PNG in first-party code (`src/assets/logo.js`) | Organisation mark — not a third-party OSS library | — |

**Not present at runtime**

- No npm packages loaded in the browser  
- No CDN `<script>` / `<link>` to third parties  
- No Google Fonts, analytics, maps, or similar  
- Node.js and esbuild are **not** required to use the app  

---

## Build and CI only (not shipped to managers)

These tools run on a developer machine or GitHub Actions when producing the release zip. They are **not** embedded as executable Node modules inside `shift-manager.html`.

| Component | Role | Licence | Upstream |
| --- | --- | --- | --- |
| **esbuild** (^0.24, lockfile resolves current patch) | Bundles first-party JS into the HTML build | MIT | https://esbuild.github.io / https://github.com/evanw/esbuild |
| **Node.js** | Host for the build script | Various (Node licence) | https://nodejs.org |
| **zip** (OS utility) | Packages `shift-manager-offline*.zip` | OS / distribution licence | Platform `zip` |

Exact build dependency versions: see `package-lock.json` in the repository.

---

## Source layout vs shipped artifact

| In repository | In release HTML |
| --- | --- |
| `src/js/**` first-party application code | Bundled inline `<script>` |
| `src/styles/tailwind.css` (Tailwind + DaisyUI-derived CSS) | Inlined `<style>` |
| `src/styles/app.css` first-party print / layout tweaks | Inlined `<style>` |
| `src/assets/logo.js` | Inlined image data |
| `devDependency`: esbuild | Used only during `npm run build` |

Managers should distribute the **release zip / HTML**, not a development `node_modules` tree.

---

## Licence obligations (MIT components)

Tailwind CSS, DaisyUI, and esbuild are MIT-licensed. The Shift Manager project is also MIT (`LICENSE`).

For MIT, retain copyright and permission notices for those components when redistributing. This file, together with upstream licence texts at the URLs above, is intended to satisfy that notice requirement for reviewers.

---

## Security relevance of third-party use

1. **No dynamic third-party execution** — CSS is static text; there is no “call home” from Tailwind or DaisyUI in this packaging.  
2. **Supply chain for new releases** — changing Tailwind/DaisyUI means rebuilding and publishing a new semver release; managers upgrade by replacing the HTML from an approved release.  
3. **Browser is the runtime** — review Chrome/Edge under Garda ICT browser policy separately from this app.  
4. **Inspection** — the HTML can be opened in a text editor; network traces while using `file://` should show no app-initiated third-party requests for normal duty-rota use.

For data handling, offline posture, and deployment recommendations, see [SECURITY.md](../SECURITY.md).
