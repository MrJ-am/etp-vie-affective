import { test as scenario } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createVault, seal, pack, recoveryCode, unlock, open, unpack } from "../bridge/crypto.ts";
import { journal, phrase, password } from "./fixtures.ts";

// Cette suite crée et supprime exclusivement des comptes dans l'atelier local dédié.
const base = "http://localhost:38139";
const enabled = process.env.CARNET_API_TEST_URL === base;
const test = (nom: string, fn: () => Promise<void>) => scenario(nom, { skip: !enabled }, fn);
if (enabled) {
  assert.equal(process.env.CARNET_DB_NAME, "vise_fictif_test");
  assert.equal(process.env.CARNET_DB_HOST, "127.0.0.1");
}
const batch = crypto.randomUUID().replaceAll("-", "").slice(0, 10);
type Session = { id: string; csrf: string; cookie: string; pseudo: string; payload: any; email?: string };
async function call(path: string, method = "GET", body?: unknown, session?: Session, extra: Record<string, string> = {}) {
  const headers: Record<string, string> = { ...extra };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (method !== "GET") headers.Origin = base;
  if (session) { headers.Cookie = session.cookie; headers["X-Carnet-CSRF"] = session.csrf; }
  const response = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  let data: any; try { data = JSON.parse(text); } catch { data = text; }
  return { response, data, text };
}
async function corps() {
  const created = await createVault(phrase);
  return { password, authRecovery: recoveryCode(), payload: { keyring: created.keyring, envelope: await seal(created.key, pack(journal()), created.keyring.vault, "journal") } };
}
function session(result: Awaited<ReturnType<typeof call>>, payload: any): Session {
  assert.equal(result.response.status, 200, result.text);
  return { id: result.data.id, csrf: result.data.csrf, cookie: result.response.headers.get("set-cookie")!.split(";")[0], pseudo: result.data.pseudonyme, payload };
}
async function staff(n: number) {
  const body = await corps(); const pseudo = `equipe_${batch}_${n}`;
  const created = await call("/api/register", "POST", { ...body, pseudonyme: pseudo, role: "encadrant" });
  assert.equal(created.response.status, 200, created.text);
  assert.equal(created.data.role, "participant", "Le client ne peut pas s'attribuer un rôle");
  execFileSync(process.env.CARNET_TEST_BIN || "backend/target/release/etp-carnet-server", ["--encadrant", pseudo], { stdio: "pipe" });
  return session(await call("/api/login", "POST", { pseudonyme: pseudo, password }), body.payload);
}
async function inscrire(token: string, n: number) {
  const body = await corps(); const email = `fiction.${batch}.${n}@example.test`;
  const created = await call("/api/inscription-groupe", "POST", { ...body, invitation: token, nom: "Fiction", prenom: `Profil ${n}`, email: email.toUpperCase(), role: "encadrant" });
  const s = session(created, body.payload); s.email = email;
  assert.equal(created.data.role, "participant");
  return s;
}
let a: Session, b: Session, p1: Session, p2: Session, p3: Session, autre: Session;
let g1: string, g2: string, token1: string, token2: string, pdfid: string, qid: string;

test("Encadrement : migrations idempotentes, groupes et rôles sans élévation par le client", async () => {
  a = await staff(1); b = await staff(2);
  assert.equal((await call("/api/me", "GET", undefined, a)).data.role, "encadrant");
  const ga = await call("/api/groupes", "POST", { nom: "Groupe fictif A" }, a);
  const gb = await call("/api/groupes", "POST", { nom: "Groupe fictif B" }, b);
  assert.equal(ga.response.status, 200, ga.text); assert.equal(gb.response.status, 200, gb.text);
  g1 = ga.data.id; g2 = gb.data.id;
  token1 = ga.data.invitation.split("#invitation=")[1]; token2 = gb.data.invitation.split("#invitation=")[1];
  assert.equal(token1.length, 64); assert.notEqual(token1, token2);
  assert.equal((await call(`/api/groupes/${g2}/membres`, "GET", undefined, a)).response.status, 404);
  assert.equal((await call(`/api/groupes/${g2}`, "PATCH", { nom: "Vol", archive: true }, a)).response.status, 404);
  const groupes = await call("/api/groupes", "GET", undefined, a);
  assert.deepEqual(groupes.data.map((g: any) => g.id), [g1]);
  assert.equal((await call("/api/groupes")).response.status, 401);
});
test("Invitation : inscription nominative, adresse normalisée, coffre inchangé et accès au seul groupe", async () => {
  const info = await call("/api/invitation", "POST", { invitation: token1 });
  assert.deepEqual(info.data, { nom: "Groupe fictif A" });
  p1 = await inscrire(token1, 1); p2 = await inscrire(token1, 2); p3 = await inscrire(token1, 3); autre = await inscrire(token2, 4);
  const login = await call("/api/login", "POST", { pseudonyme: p1.email!.toUpperCase(), password });
  assert.equal(login.data.id, p1.id); assert.equal(login.data.pseudonyme, p1.pseudo);
  const duplicate = await call("/api/inscription-groupe", "POST", { ...await corps(), invitation: token1, nom: "Fiction", prenom: "Doublon", email: p1.email });
  assert.equal(duplicate.response.status, 409);
  const roster = await call(`/api/groupes/${g1}/membres`, "GET", undefined, a);
  assert.equal(roster.data.length, 3); assert.equal(roster.data[0].email, p1.email);
  assert.ok(!roster.text.includes("SENTINEL_FICTIVE")); assert.ok(!roster.text.includes("keyring"));
  assert.equal((await call(`/api/groupes/${g1}/membres`, "GET", undefined, p1)).response.status, 403);
  const own = await call("/api/state", "GET", undefined, p1);
  assert.deepEqual(unpack(await open(await unlock(own.data.payload.keyring, phrase), own.data.payload.envelope, own.data.payload.keyring.vault, "journal")), journal());
  const staffState = await call("/api/state?compte=" + p1.id, "GET", undefined, a);
  assert.notEqual(staffState.data.payload.keyring.vault, p1.payload.keyring.vault);
  assert.equal((await call("/api/coffres/" + p1.id, "GET", undefined, a)).response.status, 404);
});
test("Contenus et PDF : édition concurrente, contrôle des mutations et visibilité réelle des supports", async () => {
  const seances = await call(`/api/groupes/${g1}/seances`, "GET", undefined, a);
  assert.equal(seances.data.length, 15);
  const s = seances.data.find((x: any) => x.id === 2);
  const contenu = { ...s.contenu, titre: "Séance fictive modifiée" };
  assert.equal((await call("/api/seances/2", "PUT", contenu, p1, { "If-Match": `"${s.revision}"` })).response.status, 403);
  assert.equal((await call("/api/seances/2", "PUT", contenu, { ...a, csrf: "incorrect" }, { "If-Match": `"${s.revision}"` })).response.status, 403);
  assert.equal((await call("/api/seances/2", "PUT", contenu, a)).response.status, 428);
  assert.equal((await call("/api/seances/2", "PUT", contenu, a, { "If-Match": `"${s.revision}"` })).response.status, 200);
  assert.equal((await call("/api/seances/2", "PUT", { ...contenu, titre: "Écrasement" }, b, { "If-Match": `"${s.revision}"` })).response.status, 409);
  const pdf = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n").toString("base64");
  assert.equal((await call("/api/supports", "POST", { seance: 2, nom: "faux.pdf", pdf: Buffer.from("Pas un PDF").toString("base64") }, a)).response.status, 400);
  const uploaded = await call("/api/supports", "POST", { seance: 2, nom: "Support fictif.pdf", pdf }, a);
  assert.equal(uploaded.response.status, 200, uploaded.text); pdfid = uploaded.data.id;
  const resource = await call("/api/supports/" + pdfid, "GET", undefined, p1);
  assert.equal(resource.response.status, 200); assert.equal(resource.response.headers.get("content-type"), "application/pdf");
  assert.match(resource.response.headers.get("content-disposition")!, /^attachment;/);
  assert.match(resource.response.headers.get("content-security-policy")!, /sandbox/);
  assert.equal((await call(`/api/groupes/${g1}/seances/2`, "PUT", { visible: false }, a)).response.status, 200);
  const parcours = await call("/api/parcours", "GET", undefined, p1);
  assert.ok(!parcours.data.seances.some((x: any) => x.id === 2));
  assert.ok((await call("/api/parcours", "GET", undefined, autre)).data.seances.some((x: any) => x.id === 2));
  assert.equal((await call("/api/supports/" + pdfid, "GET", undefined, p1)).response.status, 404);
  assert.equal((await call("/api/supports/" + pdfid)).response.status, 401);
  const apercu = await call(`/api/groupes/${g1}/apercu`, "GET", undefined, a);
  assert.deepEqual(apercu.data, parcours.data);
  assert.equal((await call(`/api/groupes/${g1}/apercu`, "GET", undefined, b)).response.status, 404);
  const editor = await call(`/api/groupes/${g1}/seances`, "GET", undefined, a);
  assert.ok(editor.data[2].pdfs.some((p: any) => p.id === pdfid), "Un PDF d'une séance masquée reste gérable par l'équipe");
  await call(`/api/groupes/${g1}/seances/2`, "PUT", { visible: true }, a);
});
test("Questionnaires : accès au groupe, vote unique atomique, abstention et agrégats sans réponse nominative", async () => {
  const launched = await call(`/api/groupes/${g1}/questionnaires`, "POST", { titre: "Ressenti fictif", questions: [{ texte: "Comment commence la séance ?", options: ["À l’aise", "Besoin de temps"] }, { texte: "Le support est-il clair ?", options: ["Oui", "À préciser"] }] }, a);
  assert.equal(launched.response.status, 200, launched.text); qid = launched.data.id;
  assert.equal((await call(`/api/questionnaires/${qid}/reponses`, "POST", { choix: [0, 0] }, autre)).response.status, 404);
  assert.equal((await call(`/api/questionnaires/${qid}/reponses`, "POST", { choix: [99, 0] }, p1)).response.status, 400);
  const concurrent = await Promise.all([call(`/api/questionnaires/${qid}/reponses`, "POST", { choix: [0, null] }, p1), call(`/api/questionnaires/${qid}/reponses`, "POST", { choix: [1, 0] }, p1)]);
  assert.deepEqual(concurrent.map(r => r.response.status).sort(), [200, 409]);
  const winner = concurrent[0].response.status === 200 ? [0, null] : [1, 0];
  assert.equal((await call(`/api/questionnaires/${qid}/reponses`, "POST", { choix: [1, 0] }, p2)).response.status, 200);
  assert.equal((await call(`/api/questionnaires/${qid}/reponses`, "POST", { choix: [0, 1] }, p3)).response.status, 200);
  const visible = await call(`/api/groupes/${g1}/questionnaires`, "GET", undefined, a);
  assert.equal(visible.data[0].reponses, 3); assert.equal(visible.data[0].compteurs, null, "Pas de résultats successifs avant fermeture");
  assert.equal((await call("/api/questionnaires", "GET", undefined, p1)).data[0].participe, true);
  assert.equal((await call(`/api/questionnaires/${qid}/fermer`, "POST", {}, b)).response.status, 404);
  assert.equal((await call(`/api/questionnaires/${qid}/fermer`, "POST", {}, a)).response.status, 200);
  const results = await call(`/api/groupes/${g1}/questionnaires`, "GET", undefined, a);
  const expected = [[1, 1, 0], [1, 1, 0]];
  expected[0][winner[0]!]++; expected[1][winner[1] === null ? 2 : winner[1]!]++;
  assert.deepEqual(results.data[0].compteurs, expected);
  for (const p of [p1, p2, p3]) assert.ok(!results.text.includes(p.id));
  assert.equal((await call(`/api/questionnaires/${qid}/reponses`, "POST", { choix: [0, 0] }, p1)).response.status, 409);
  assert.equal((await call(`/api/questionnaires/${qid}/rouvrir`, "POST", {}, a)).response.status, 404);
  const small = await call(`/api/groupes/${g1}/questionnaires`, "POST", { titre: "Petit effectif", questions: [{ texte: "Question fictive", options: ["A", "B"] }] }, a);
  await call(`/api/questionnaires/${small.data.id}/reponses`, "POST", { choix: [0] }, p1);
  await call(`/api/questionnaires/${small.data.id}/fermer`, "POST", {}, a);
  assert.equal((await call(`/api/groupes/${g1}/questionnaires`, "GET", undefined, a)).data.find((q: any) => q.id === small.data.id).compteurs, null);
});
test("Gestion des accès : désactivation immédiate, sessions révoquées et suppression durable limitée au groupe", async () => {
  assert.equal((await call("/api/utilisatrices/" + autre.id, "PATCH", { actif: false }, a)).response.status, 404);
  assert.equal((await call("/api/utilisatrices/" + b.id, "PATCH", { actif: false }, a)).response.status, 404);
  assert.equal((await call("/api/utilisatrices/" + p2.id, "PATCH", { actif: false }, a)).response.status, 200);
  assert.equal((await call("/api/state", "GET", undefined, p2)).response.status, 401);
  assert.equal((await call("/api/login", "POST", { pseudonyme: p2.email, password })).response.status, 401);
  assert.equal((await call("/api/utilisatrices/" + p2.id, "PATCH", { actif: true }, a)).response.status, 200);
  assert.equal((await call("/api/state", "GET", undefined, p2)).response.status, 401, "La réactivation ne rétablit pas les anciens cookies");
  assert.equal((await call("/api/login", "POST", { pseudonyme: p2.email, password })).response.status, 200);
  assert.equal((await call("/api/utilisatrices/" + p1.id, "DELETE", {}, a)).response.status, 400);
  assert.equal((await call("/api/utilisatrices/" + p1.id, "DELETE", { confirmation: "SUPPRIMER" }, a)).response.status, 200);
  assert.equal((await call("/api/me", "GET", undefined, p1)).response.status, 401);
  assert.equal((await call("/api/login", "POST", { pseudonyme: p1.email, password })).response.status, 401);
  assert.ok(!(await call(`/api/groupes/${g1}/membres`, "GET", undefined, a)).data.some((m: any) => m.id === p1.id));
});
test("Groupes archivés et liens : suspension des inscriptions, rotation et retour sans perte des membres", async () => {
  assert.equal((await call("/api/account", "DELETE", { password }, a)).response.status, 409, "La suppression d'un compte encadrant ne doit pas détruire ses groupes");
  const ouvert = await call(`/api/groupes/${g1}/questionnaires`, "POST", { titre: "Suspendu par archivage", questions: [{ texte: "Question fictive", options: ["A", "B"] }] }, a);
  assert.equal(ouvert.response.status, 200);
  await call(`/api/groupes/${g1}`, "PATCH", { nom: "Groupe fictif A", archive: true }, a);
  assert.equal((await call(`/api/questionnaires/${ouvert.data.id}/reponses`, "POST", { choix: [0] }, p3)).response.status, 409);
  assert.deepEqual((await call("/api/questionnaires", "GET", undefined, p3)).data, []);
  assert.equal((await call("/api/invitation", "POST", { invitation: token1 })).response.status, 410);
  assert.equal((await call("/api/inscription-groupe", "POST", { ...await corps(), nom: "Fiction", prenom: "Refus", email: `refus.${batch}@example.test`, invitation: token1 })).response.status, 410);
  assert.equal((await call(`/api/groupes/${g1}/membres`, "GET", undefined, a)).data.length, 2);
  assert.equal((await call("/api/groupes", "GET", undefined, a)).data[0].archive, true);
  await call(`/api/groupes/${g1}`, "PATCH", { nom: "Groupe fictif A", archive: false }, a);
  const rotated = await call(`/api/groupes/${g1}/invitation`, "POST", {}, a);
  const token = rotated.data.invitation.split("#invitation=")[1]; assert.notEqual(token, token1);
  assert.equal((await call("/api/invitation", "POST", { invitation: token1 })).response.status, 410);
  assert.equal((await call("/api/invitation", "POST", { invitation: token })).response.status, 200);
  assert.equal((await call("/api/supports/" + pdfid, "DELETE", {}, a)).response.status, 200);
  assert.equal((await call("/api/supports/" + pdfid, "GET", undefined, autre)).response.status, 404);
});
