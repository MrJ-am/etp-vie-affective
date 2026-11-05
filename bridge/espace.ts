import { recoveryCode, base64 } from "./crypto";

type Compte = { id: string; pseudonyme: string; role: string; csrf: string };
type Commande = { action: string; data: any };
type Application = { ports: { commandeEspace: { subscribe(fn: (c: Commande) => void): void }; evenementEspace: { send(v: unknown): void } } };
const ElmEspace = (window as unknown as { Elm: { Espace: { init(o: unknown): Application } } }).Elm;
const invitation = new URLSearchParams(location.hash.slice(1)).get("invitation") || "";
const app = ElmEspace.Espace.init({ node: document.getElementById("espace"), flags: { invitation } });
let compte: Compte | null = null;
let kit: { account: string; auth: string; vault: string } | null = null;
let mutation = false;
let generation = 0;
let groupeSelectionne = "";
const emit = (kind: string, data: unknown = {}) => app.ports.evenementEspace.send({ kind, data });

async function api(path: string, method = "GET", body?: unknown, revision?: number): Promise<any> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (compte) headers["X-Carnet-CSRF"] = compte.csrf;
  if (revision !== undefined) headers["If-Match"] = `"${revision}"`;
  const response = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(15000) });
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401 && method === "GET") { compte = null; generation++; emit("anonyme"); }
    throw new Error(result.error || "Le serveur a refusé cette opération.");
  }
  return result;
}
async function chargerCompte(): Promise<void> {
  try { compte = await api("/api/me"); emit("compte", compte); }
  catch (error) { if (compte) throw error; emit("anonyme"); }
}
function telechargerKit(): void {
  if (!kit) throw new Error("Le kit n’est plus disponible dans cette fenêtre.");
  const blob = new Blob([`MON CARNET — KIT PRIVÉ\n\nIdentifiant : ${kit.account}\n\n1. CODE DE COMPTE (connexion uniquement) :\n${kit.auth}\n\n2. SECRET DU COFFRE (à saisir localement, jamais envoyé au serveur) :\n${kit.vault}\n\nConservez ce fichier hors du carnet. Sans phrase ni secret du coffre, vos textes ne peuvent pas être récupérés.\n`], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "mon-carnet-kit-recuperation.txt"; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function inscrire(data: any): Promise<void> {
  if (typeof data.phrase !== "string" || data.phrase.length < 12 || data.phrase === data.password) throw new Error("Choisissez une phrase de coffre d’au moins 12 caractères, différente du mot de passe.");
  const worker = new Worker("/worker.js");
  let serial = 0;
  const calls = new Map<number, { resolve(v: any): void; reject(e: Error): void }>();
  worker.onmessage = e => {
    const pending = calls.get(e.data.id); if (!pending) return; calls.delete(e.data.id);
    if (e.data.error) pending.reject(new Error(e.data.error)); else pending.resolve(e.data.result);
  };
  worker.onerror = () => { for (const p of calls.values()) p.reject(new Error("Création du coffre indisponible.")); calls.clear(); };
  const rpc = (action: string, value: unknown): Promise<any> => new Promise((resolve, reject) => { const id = ++serial; calls.set(id, { resolve, reject }); worker.postMessage({ id, action, data: value }); });
  try {
    const created = await rpc("create", { phrase: data.phrase });
    const envelope = await rpc("seal", { version: 1, etape: 0, nextId: 100, notes: {}, objectifs: [], defis: [], experiences: [], cartes: [], traces: [], etapes: [], photos: [], consultations: [] });
    const auth = recoveryCode();
    // La phrase ne fait jamais partie du corps envoyé au serveur.
    compte = await api("/api/inscription-groupe", "POST", { nom: data.nom, prenom: data.prenom, email: data.email, password: data.password, invitation: data.invitation, authRecovery: auth, payload: { keyring: created.keyring, envelope } });
    kit = { account: compte!.pseudonyme, auth, vault: created.recovery };
    history.replaceState(null, "", "/espace.html");
    emit("kit");
  } finally { worker.terminate(); }
}
async function pdf(seance: number): Promise<void> {
  const file = await new Promise<File>((resolve, reject) => {
    const input = document.createElement("input"); input.type = "file"; input.accept = "application/pdf,.pdf";
    input.addEventListener("change", () => input.files?.[0] ? resolve(input.files[0]) : reject(new Error("Aucun fichier sélectionné.")), { once: true });
    input.addEventListener("cancel", () => reject(new Error("Dépôt annulé.")), { once: true }); input.click();
  });
  if (file.size > 2_000_000) throw new Error("Le PDF doit faire au maximum 2 Mo.");
  await api("/api/supports", "POST", { seance, nom: file.name, pdf: base64(new Uint8Array(await file.arrayBuffer())) });
  emit("modifie");
}
async function executer(c: Commande): Promise<void> {
  if (c.action === "api") {
    const epoch = generation;
    const groupeRequete = /^\/api\/groupes\/([0-9a-f-]{36})\//.exec(c.data.path)?.[1];
    if (groupeRequete && c.data.method === "GET") groupeSelectionne = groupeRequete;
    const data = await api(c.data.path, c.data.method, c.data.method === "GET" ? undefined : c.data.body, c.data.revision ?? undefined);
    if (generation === epoch && (!groupeRequete || c.data.method !== "GET" || groupeRequete === groupeSelectionne)) emit(c.data.tag, data);
  } else if (c.action === "login") {
    compte = await api("/api/login", "POST", c.data); generation++; emit("compte", compte);
  } else if (c.action === "logout") {
    const revoke = api("/api/logout", "POST", {});
    compte = null; kit = null; generation++; emit("anonyme");
    try { await revoke; }
    catch { emit("notice", { message: "L’espace est fermé sur cet appareil. La révocation de la session serveur nécessite une connexion." }); }
  } else if (c.action === "register") await inscrire(c.data);
  else if (c.action === "kit") telechargerKit();
  else if (c.action === "continuer") { kit = null; emit("compte", compte); }
  else if (c.action === "copier") {
    try { await navigator.clipboard.writeText(c.data); emit("notice", { message: "Lien copié. Collez-le dans le canal de votre choix." }); }
    catch { emit("notice", { message: "La copie automatique est indisponible. Sélectionnez le lien et copiez-le manuellement." }); }
  } else if (c.action === "pdf") await pdf(c.data);
}
app.ports.commandeEspace.subscribe(c => {
  const writes = c.action !== "api" || c.data.method !== "GET";
  if (writes && mutation) return;
  if (writes) mutation = true;
  executer(c).catch(e => emit("error", { message: e instanceof TypeError || e?.name === "TimeoutError" ? "Connexion indisponible. Réessayez quand le réseau est rétabli." : e instanceof Error ? e.message : "Opération impossible." })).finally(() => { if (writes) mutation = false; });
});
addEventListener("pagehide", () => { kit = null; compte = null; generation++; });
addEventListener("pageshow", e => { if (e.persisted) location.reload(); });
if (invitation) {
  api("/api/invitation", "POST", { invitation }).then(data => emit("invitation", data)).catch(e => { emit("invitation", { nom: "" }); emit("error", { message: e instanceof Error ? e.message : "Invitation indisponible." }); });
} else chargerCompte().catch(() => emit("error", { message: "Votre espace est indisponible. Réessayez." }));
