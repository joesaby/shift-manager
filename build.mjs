import * as esbuild from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

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
writeFileSync("../shift-manager.html", html);
console.log("Built dist/shift-manager.html and ../shift-manager.html (" + (html.length / 1024).toFixed(0) + " KB)");
