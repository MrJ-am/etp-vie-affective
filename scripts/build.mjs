import { readFile, writeFile, copyFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { build } from "esbuild";
const root = new URL("../", import.meta.url);
process.chdir(root.pathname);
await mkdir("dist", { recursive: true });
const lock = JSON.parse(await readFile("style.lock.json", "utf8"));
try {
  if (execFileSync("git", ["-C","vendor/style-mrjam","rev-parse","HEAD"], { encoding: "utf8" }).trim() !== lock.revision)
    throw new Error("Révision de style incorrecte.");
} catch (error) {
  if (error.message === "Révision de style incorrecte.") throw error;
  await mkdir("vendor", { recursive: true });
  execFileSync("git", ["clone", lock.repository, "vendor/style-mrjam"], { stdio: "inherit" });
  execFileSync("git", ["-C","vendor/style-mrjam","checkout","--detach",lock.revision], { stdio: "inherit" });
}
const catalogue = JSON.parse(await readFile("content/parcours.json", "utf8"));
if (catalogue.chapitres.length !== 15 || catalogue.chapitres.some((c,i) => c.id !== i || !c.source || !c.essentiel.length || (c.nature === "chapitre" && c.rubriques.length !== 7))) throw new Error("Catalogue incomplet.");
execFileSync("node_modules/.bin/elm", ["make","frontend/src/Main.elm","--optimize","--output=dist/elm.js"], { stdio: "inherit" });
await Promise.all(["bridge", "worker"].map(name => build({ entryPoints: ["bridge/" + name + ".ts"], outfile: "dist/" + name + ".js", bundle: true, format: "iife", target: "es2022", minify: true, sourcemap: false })));
await copyFile("shared/assets/carnet.css", "dist/carnet.css");
await copyFile("content/parcours.json", "dist/catalogue.json");
await copyFile("frontend/favicon.svg", "dist/favicon.svg");
let html = await readFile("frontend/index.html", "utf8");
html = html.replace('data-demo-only="false"', 'data-demo-only="' + (process.env.CARNET_DEMO_ONLY === "true" ? "true" : "false") + '"');
await writeFile("dist/index.html", html);
console.log("Elm, pont et Worker compilés ; 15 étapes et sources validées.");
