/** Relais HTTP local de test : Web Crypto bénéficie du contexte localhost natif.
 * Aucun endpoint n’est simulé : toutes les requêtes API atteignent Rust/PostgreSQL.
 */
import http from "node:http";
import { spawn } from "node:child_process";
const upstream = process.env.CARNET_BROWSER_UPSTREAM || "http://backend:3000";
let healthy = false;
for (let attempt = 0; attempt < 50; attempt++) {
  try { if ((await fetch(upstream + "/api/health")).ok) { healthy = true; break; } } catch {}
  await new Promise(resolve => setTimeout(resolve, 500));
}
if (!healthy) throw new Error("Backend réel non disponible.");
const server = http.createServer((request,response) => {
  // Test-only upstream outage. WebKit automation aborts offline navigations before SW dispatch.
  if (request.headers["x-etp-test-offline"] === "1") {
    response.writeHead(503, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    response.end(JSON.stringify({ error: "Panne réseau simulée par le relais de test." }));
    return;
  }
  const remote = http.request(new URL(request.url || "/",upstream), { method: request.method, headers: request.headers }, incoming => {
    response.writeHead(incoming.statusCode || 502, incoming.headers);
    incoming.pipe(response);
  });
  remote.on("error", () => { response.writeHead(502); response.end(); });
  request.pipe(remote);
});
await new Promise(resolve => server.listen(3000,"127.0.0.1",resolve));
const child = spawn("node_modules/.bin/playwright", ["test", ...process.argv.slice(2)], { stdio: "inherit", env: { ...process.env, CARNET_TEST_URL: "http://localhost:3000" } });
const code = await new Promise(resolve => child.once("exit", resolve));
server.close();
process.exit(typeof code === "number" ? code : 1);
