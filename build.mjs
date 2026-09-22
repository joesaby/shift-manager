import * as esbuild from "esbuild";
import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { version: packageVersion } = require("./package.json");

const version = (process.env.VERSION || packageVersion).replace(/^v/, "");
const versionTag = `v${version}`;

const result = await esbuild.build({
  entryPoints: ["src/js/main.js"],
  bundle: true,
  format: "iife",
  target: "es2020",
  write: false,
  logLevel: "info"
});
const js = result.outputFiles[0].text;

const tailwind = readFileSync("src/styles/tailwind.css", "utf8");
const appCss = readFileSync("src/styles/app.css", "utf8");

const html = `<!doctype html>
<html lang="en" data-theme="shift">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Shift Manager</title>
<style>
${tailwind}
</style>
<style>
${appCss}
</style>
</head>
<body class="bg-base-200 min-h-screen">
<div id="app"></div>
<input type="file" id="fileIn" accept=".json,application/json" class="hidden">
<script>
${js}
</script>
</body>
</html>
`;

mkdirSync("dist", { recursive: true });
writeFileSync("dist/shift-manager.html", html);

if (!process.env.CI) {
  writeFileSync("../shift-manager.html", html);
}

const zipName = `shift-manager-offline-${versionTag}.zip`;
const zipPath = `dist/${zipName}`;
const latestZipPath = "dist/shift-manager-offline.zip";

for (const path of [zipPath, latestZipPath]) {
  if (existsSync(path)) unlinkSync(path);
}

execFileSync("zip", ["-j", zipPath, "dist/shift-manager.html"], { stdio: "inherit" });
execFileSync("zip", ["-j", latestZipPath, "dist/shift-manager.html"], { stdio: "inherit" });

const kb = (html.length / 1024).toFixed(0);
const targets = process.env.CI
  ? `dist/shift-manager.html, ${zipPath}, ${latestZipPath}`
  : `dist/shift-manager.html, ../shift-manager.html, ${zipPath}, ${latestZipPath}`;
console.log(`Built ${targets} (${kb} KB, ${versionTag})`);
