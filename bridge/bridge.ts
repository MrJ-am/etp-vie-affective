import { recoveryCode, type Keyring, type Envelope } from "./crypto";
import { imageDimensions } from "./image";
import { installerContinuite } from "./continuite";
import { installerGlissement } from "./glissement";
type ElmApp = { ports: { commande: { subscribe: (fn: (v: Command) => void) => void }; evenement: { send: (v: unknown) => void } } };
type Command = { action: string; data: any };
type Payload = { keyring: Keyring; envelope: Envelope };
type Stored = { payload: Payload; revision: number; dirty: boolean; time: number };
type Account = { id: string; csrf: string; pseudonyme: string };
declare global { interface Window { Elm: { Main: { init: (options: unknown) => ElmApp } }; } }

const worker = new Worker("/worker.js");
let serial = 0;
const rpc = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
worker.addEventListener("message", event => {
  const promise = rpc.get(event.data.id);
  if (!promise) return;
  rpc.delete(event.data.id);
  if (event.data.error) promise.reject(new Error(event.data.error));
  else promise.resolve(event.data.result);
});
function cryptoCall(action: string, data: unknown): Promise<any> {
  const id = ++serial;
  return new Promise((resolve, reject) => { rpc.set(id, { resolve, reject }); worker.postMessage({ id, action, data }); });
}

const database = new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open("mon-carnet-encrypted-v1", 1);
  request.onupgradeneeded = () => request.result.createObjectStore("sealed");
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(new Error("Le stockage de cet appareil n’est pas disponible."));
});
async function store(key: string, value?: unknown, remove = false): Promise<any> {
  const db = await database;
  return new Promise((resolve, reject) => {
    const tx = db.transaction("sealed", value !== undefined || remove ? "readwrite" : "readonly");
    const object = tx.objectStore("sealed");
    const request = remove ? object.delete(key) : value !== undefined ? object.put(value, key) : object.get(key);
    let result: any;
    request.onsuccess = () => { result = request.result; };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(new Error("La sauvegarde sur cet appareil a échoué."));
    tx.onabort = tx.onerror;
  });
}
async function entries(prefix: string): Promise<{ key: string; value: any }[]> {
  const db = await database;
  return new Promise((resolve, reject) => {
    const results: { key: string; value: any }[] = [];
    const tx = db.transaction("sealed", "readonly");
    const request = tx.objectStore("sealed").openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      if (String(cursor.key).startsWith(prefix)) results.push({ key: String(cursor.key), value: cursor.value });
      cursor.continue();
    };
    tx.oncomplete = () => resolve(results);
    tx.onerror = () => reject(new Error("Le stockage de cet appareil est indisponible."));
  });
}
async function erasePrefix(prefix: string): Promise<void> {
  for (const entry of await entries(prefix)) await store(entry.key, undefined, true);
}
const tabId = sessionStorage.getItem("carnet-tab") || crypto.randomUUID();
sessionStorage.setItem("carnet-tab", tabId); // Identifiant opaque ; ni secret, ni donnée métier.
let app: ElmApp;
let account: Account | null = null;
let mode: "none" | "demo" | "account" = "none";
let payload: Payload | null = null;
let revision = 0;
let unlocked = false;
let epoch = 0;
let currentDoc: any = null;
let waitingDoc: any = null;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let syncTimer: ReturnType<typeof setTimeout> | undefined;
let saveTail: Promise<unknown> = Promise.resolve();
let syncTail: Promise<unknown> = Promise.resolve();
let savingSerial = 0;
let conflict = false;
let kit: { account: string; auth: string; vault: string } | null = null;
const previews = new Map<string, string>();
let lastActivity = Date.now();
let automaticMinutes = 10;
let lastWarning = false;
let technicalAction = false;
const exclusiveActions = new Set(["demo", "resetDemo", "register", "login", "unlock", "logout", "newVault", "resetAuth", "changePhrase", "import", "deleteAccount"]);
const emit = (kind: string, data: unknown = {}) => app.ports.evenement.send({ kind, data });
const message = (error: unknown) => error instanceof Error ? error.message : "Cette opération n’a pas pu aboutir.";
const profile = () => mode === "demo" ? "demo" : account!.id;
const draftKey = () => "draft:" + profile() + ":" + tabId;
function clearPreviews(): void { for (const url of previews.values()) URL.revokeObjectURL(url); previews.clear(); }
async function request(path: string, method = "GET", body?: unknown, match?: number): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const headers: Record<string,string> = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (account) headers["X-Carnet-CSRF"] = account.csrf;
    if (match !== undefined) headers["If-Match"] = '"' + match + '"';
    const response = await fetch(path, { method, body: body === undefined ? undefined : JSON.stringify(body),
      headers, credentials: "same-origin", cache: "no-store", signal: controller.signal });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 409) throw Object.assign(new Error(result.error || "Une autre version existe."), { conflict: true });
      if (response.status === 401 && unlocked && !["/api/account", "/api/login", "/api/reset-auth"].includes(path)) emit("sessionExpired");
      throw new Error(result.error || "Le serveur a refusé cette opération.");
    }
    return result;
  } catch (error) {
    if (error instanceof TypeError || (error as Error).name === "AbortError")
      throw new Error("Connexion indisponible. La copie chiffrée sur cet appareil reste conservée.");
    throw error;
  } finally { clearTimeout(timeout); }
}
function emptyJournal(): any {
  return { version: 1, etape: 0, nextId: 100, notes: {}, objectifs: [], defis: [], experiences: [],
    cartes: [], traces: [], etapes: [], photos: [], consultations: [] };
}
function demoJournal(): any {
  const journal = emptyJournal();
  journal.etape = 1;
  journal.notes = { "1-question": "Comment faire une place à mon besoin de calme ?", "1-note": "Je me sens bien quand je peux prendre mon temps.",
    "1-retiens": "Je peux laisser une question ouverte.", "3-question": "Comment inviter une personne à parler d’un intérêt partagé ?", "5-note": "Un atelier imaginaire pourrait être une façon de rencontrer à mon rythme.", "8-retiens": "Je peux faire une pause quand je ne sais pas encore.", "reglage-animations": "oui" };
  journal.objectifs = [{ id: 1, texte: "Construire des relations où je peux être moi-même.", origine: 0,
    historique: ["Trouver ce qui me convient dans une relation."] }];
  journal.defis = [{ id: 2, texte: "Exprimer mon besoin de calme.", objectif: 1, statut: "actif", origine: 1, historique: [] }];
  journal.experiences = [{ id: 3, seance: 1, defi: 2, principale: true,
    quoi: "Repérer un moment où je me sens à l’aise.", quand: "Cette semaine, pendant une activité que j’aime.",
    comment: "Prendre quelques mots dans mon carnet.", obstacle: "Si je suis fatigué·e, je peux le faire plus tard.",
    observer: "Ce qui contribue à mon confort.", statut: "préparée", essaye: "", marque: "", appris: "", suite: "" }];
  journal.cartes = [
    { id: 4, mot: "La confiance", sens: "Pouvoir dire quand quelque chose ne me convient pas.", zone: "coeur", hesitation: "" },
    { id: 5, mot: "Du temps pour moi", sens: "Garder des moments pour me retrouver.", zone: "autour", hesitation: "coeur" },
    { id: 6, mot: "Des intérêts partagés", sens: "", zone: "horizon", hesitation: "" },
    { id: 7, mot: "La proximité", sens: "Je souhaite encore découvrir ce qui me convient.", zone: "explorer", hesitation: "" }];
  journal.etapes = [{ id: 8, seance: 1, quand: "", texte: "J’ai trouvé les mots pour un besoin important.", montre: "Je peux prendre le temps de comprendre ce qui compte pour moi." },{id:9,seance:8,quand:"",texte:"J’ai choisi de laisser une incertitude ouverte dans une situation inventée.",montre:"Je peux faire une pause avant de choisir la suite."}];
  return journal;
}
function settingsFromDoc(doc: any): void {
  automaticMinutes = Number(doc.notes["reglage-verrouillage"] ?? "10");
  document.documentElement.dataset.sober = doc.notes["reglage-sobre"] === "oui" ? "true" : "false";
  document.documentElement.dataset.motion = doc.notes["reglage-animations"] === "non" ? "off" : "on";
  document.documentElement.dataset.large = doc.notes["reglage-texte"] === "grand" ? "true" : "false";
}
function showJournal(doc: any): void {
  unlocked = true; currentDoc = doc; waitingDoc = null; lastActivity = Date.now();
  settingsFromDoc(doc);
  emit("opened", { journal: doc, demo: mode === "demo" });
}
async function saveNow(): Promise<void> {
  clearTimeout(saveTimer);
  if (!waitingDoc) { await saveTail; return; }
  const doc = waitingDoc; waitingDoc = null;
  const sessionEpoch = epoch;
  const destination = draftKey();
  const capturedMode = mode;
  saveTail = saveTail.catch(() => {}).then(async () => {
    try {
    const envelope: Envelope = await cryptoCall("seal", doc);
    if (epoch !== sessionEpoch || !payload) return;
    payload = { keyring: payload.keyring, envelope };
    await store(destination, { payload, revision, dirty: capturedMode === "account", time: Date.now() } satisfies Stored);
    savingSerial++;
    if (capturedMode === "demo") {
      const demo = await store("demo-vault");
      await store("demo-vault", { ...demo, envelope });
    }
    emit("status", { state: capturedMode === "demo" ? "device" : "pending" });
    } catch (error) {
      if (epoch === sessionEpoch && !waitingDoc) waitingDoc = doc;
      throw error;
    }
  });
  await saveTail;
}
function scheduleSave(doc: any): void {
  if (!unlocked) return;
  currentDoc = doc; waitingDoc = doc; settingsFromDoc(doc);
  emit("status", { state: "saving" });
  clearTimeout(saveTimer); clearTimeout(syncTimer);
  saveTimer = setTimeout(() => saveNow().catch(error => emit("status", { state: "error", message: message(error) })), 650);
  if (mode === "account") syncTimer = setTimeout(() => synchronize().catch(error => emit("status", { state: "error", message: message(error) })), 2200);
}
async function synchronize(): Promise<void> {
  await saveNow();
  if (mode !== "account" || !payload || !account || conflict) return;
  const sessionEpoch = epoch;
  syncTail = syncTail.catch(() => {}).then(async () => {
    if (epoch !== sessionEpoch || !account || !payload || conflict) return;
    const draft = await store(draftKey()) as Stored | undefined;
    if (!draft?.dirty) return;
    const sequence = savingSerial;
    try {
      const active: Account = await request("/api/me");
      if (active.id !== account.id) throw new Error("Reconnectez-vous au compte de ce coffre pour synchroniser.");
      account.csrf = active.csrf;
      // Toutes les images sont synchronisées en bloc indépendamment du chapitre affiché.
      for (const object of await entries("object:" + account.id + ":")) {
        if (object.value.pending) {
          await request("/api/objects/" + object.value.envelope.object, "PUT", object.value.envelope);
          await store(object.key, { ...object.value, pending: false });
        }
      }
      const result = await request("/api/state", "PUT", payload, revision);
      if (epoch !== sessionEpoch) return;
      revision = result.revision;
      const changed = sequence !== savingSerial || waitingDoc !== null;
      await store(draftKey(), { payload, revision, dirty: changed, time: Date.now() } satisfies Stored);
      await store("cache:" + account.id, { payload, revision, dirty: false, time: Date.now() } satisfies Stored);
      for (const deleted of await entries("delete:" + account.id + ":")) {
        await request("/api/objects/" + deleted.value, "DELETE");
        await store(deleted.key, undefined, true);
      }
      emit("status", { state: changed ? "pending" : "synced" });
      if (changed) syncTimer = setTimeout(() => synchronize().catch(error => emit("error", { message: message(error) })), 2200);
    } catch (error) {
      if ((error as any).conflict) { conflict = true; emit("status", { state: "conflict" }); }
      else emit("status", { state: "pending", message: message(error) });
    }
  });
  await syncTail;
}
async function loadLocalAccount(): Promise<void> {
  const id = await store("last-account");
  if (typeof id !== "string") throw new Error("Aucun coffre téléchargé sur cet appareil.");
  account = { id, csrf: "", pseudonyme: "" }; mode = "account";
  const drafts = (await entries("draft:" + id + ":")).filter(e => e.value.dirty).sort((a,b) => b.value.time - a.value.time);
  const saved: Stored | undefined = drafts[0]?.value ?? await store("cache:" + id);
  if (!saved) throw new Error("Aucun coffre téléchargé sur cet appareil.");
  payload = saved.payload; revision = saved.revision; conflict = false;
  await store(draftKey(), saved);
  emit("locked", { demo: false, conflict: false });
  emit("notice", { message: "Copie locale : ouvrez-la avec votre phrase de coffre. La synchronisation nécessitera une session du même compte." });
}
async function loadAccount(): Promise<void> {
  const remote = await request("/api/state");
  await store("last-account", account!.id);
  const drafts = (await entries("draft:" + account!.id + ":")).filter(e => e.value.dirty).sort((a,b) => b.value.time - a.value.time);
  const saved: Stored = drafts.length ? drafts[0].value : { payload: remote.payload, revision: remote.revision, dirty: false, time: Date.now() };
  payload = saved.payload; revision = saved.revision;
  conflict = saved.dirty && remote.revision !== saved.revision;
  await store(draftKey(), saved);
  await store("cache:" + account!.id, { payload: remote.payload, revision: remote.revision, dirty: false, time: Date.now() } satisfies Stored);
  for (const image of await request("/api/objects")) await store("object:" + account!.id + ":" + image.object, { envelope: image, pending: false });
  emit("locked", { demo: false, conflict });
}
async function beginDemo(): Promise<void> {
  await lock(false);
  mode = "demo"; account = null; conflict = false;
  let saved = await store("demo-vault");
  if (!saved) {
    const vault = crypto.randomUUID();
    const generated = await cryptoCall("demo", { vault });
    saved = { key: generated.key, vault, envelope: null };
    await store("demo-vault", saved);
  }
  const result = await cryptoCall("demo", saved);
  payload = { keyring: { v: 1, vault: saved.vault } as Keyring, envelope: saved.envelope };
  showJournal(result.journal || demoJournal());
  scheduleSave(currentDoc); await saveNow();
  await imagePreviews();
  emit("status", { state: "device" });
}
async function lock(show = true): Promise<void> {
  annulerAncrage();
  annulerGlissement();
  // Retrait immédiat des vues ; dernière sauvegarde locale terminée avant retrait des clés.
  if (unlocked || show) emit("locked", { demo: mode === "demo" });
  unlocked = false; clearPreviews();
  let failure = false;
  try { await saveNow(); } catch { failure = true; }
  await saveTail.catch(() => {});
  epoch++; currentDoc = null; waitingDoc = null; kit = null;
  clearTimeout(saveTimer); clearTimeout(syncTimer);
  await cryptoCall("lock", {});
  if (show) emit("locked", { demo: mode === "demo" });
  if (failure) emit("error", { message: "Échec de la dernière sauvegarde sur cet appareil. Le coffre est verrouillé. Gardez cette fenêtre ouverte et exportez la copie chiffrée disponible ; vérifiez vos dernières modifications après réouverture." });
}
function download(name: string, type: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function pick(accept: string, max: number): Promise<File> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = accept;
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) { reject(new Error("Aucun fichier choisi.")); return; }
      if (file.size > max) { reject(new Error("Ce fichier dépasse la taille autorisée.")); return; }
      resolve(file);
    };
    input.addEventListener("cancel", () => reject(new Error("Sélection annulée.")));
    input.click();
  });
}
async function imagePreviews(): Promise<void> {
  clearPreviews();
  const source = profile();
  const sessionEpoch = epoch;
  for (const photo of currentDoc?.photos || []) {
    const saved = await store("object:" + source + ":" + photo.id);
    if (!saved) continue;
    const plain: Uint8Array = await cryptoCall("imageOpen", saved.envelope);
    if (!unlocked || epoch !== sessionEpoch) return;
    const url = URL.createObjectURL(new Blob([plain as BlobPart], { type: "image/jpeg" }));
    previews.set(photo.id, url);
    emit("photoPreview", { id: photo.id, url });
  }
}
async function addPhoto(): Promise<void> {
  if (!unlocked) return;
  if (currentDoc.photos.length >= 20) throw new Error("Vingt photos maximum dans ce prototype.");
  const file = await pick("image/jpeg,image/png,image/webp", 10_000_000);
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Choisissez une image JPEG, PNG ou WebP.");
  const sessionEpoch = epoch;
  imageDimensions(new Uint8Array(await file.arrayBuffer()));
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { throw new Error("Cette image ne peut pas être décodée. Choisissez une image JPEG, PNG ou WebP valide."); }
  if (bitmap.width * bitmap.height > 20_000_000 || bitmap.width < 1 || bitmap.height < 1) { bitmap.close(); throw new Error("Image trop grande : 20 millions de pixels maximum."); }
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Le navigateur ne peut pas préparer cette photo.");
  context.fillStyle = "#ffffff"; context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("Conversion d’image impossible.")), "image/jpeg", 0.82));
  canvas.width = 1; canvas.height = 1;
  if (blob.size > 1_200_000) throw new Error("La photo réduite dépasse 1,2 Mo.");
  if (!unlocked || epoch !== sessionEpoch) return;
  const object = crypto.randomUUID();
  const envelope = await cryptoCall("imageSeal", { object, bytes: new Uint8Array(await blob.arrayBuffer()) });
  if (!unlocked || epoch !== sessionEpoch) return;
  await store("object:" + profile() + ":" + object, { envelope, pending: mode === "account" });
  const url = URL.createObjectURL(blob); previews.set(object, url);
  emit("photoAdded", { id: object, nom: file.name, url });
}
async function encryptedExport(): Promise<void> {
  await saveNow();
  if (mode === "demo") throw new Error("L’export chiffré réimportable utilise la phrase d’un compte. La démo permet l’export lisible d’une sélection fictive.");
  const images = (await entries("object:" + account!.id + ":")).filter(e => !currentDoc || currentDoc.photos.some((p: any) => p.id === e.value.envelope.object)).map(e => e.value.envelope);
  download("mon-carnet-chiffre.json", "application/json", JSON.stringify({ format: "mon-carnet-backup", version: 1, ...payload, images }));
  emit("notice", { message: "La sauvegarde chiffrée a été générée sur cet appareil." });
}

async function waitForNativeMotion(): Promise<void> {
  for (let frame = 0; frame < 3; frame++) await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  const transitions = new Set<Animation>();
  for (const element of document.querySelectorAll<HTMLElement>('[data-moving="true"]')) {
    for (const animation of element.getAnimations({ subtree: true })) {
      if ("transitionProperty" in animation && ["opacity", "grid-template-rows", "font-size", "scale", "translate"].includes(String(animation.transitionProperty))) transitions.add(animation);
    }
  }
  await Promise.allSettled([...transitions].map(animation => animation.finished));
}

let focusVersion = 0;
const annulerAncrage = installerContinuite(waitForNativeMotion);
const annulerGlissement = installerGlissement((id,direction)=>emit("swipeMoment",{id,direction}));

async function command(command: Command): Promise<void> {
  const { action, data } = command;
  if (action === "demo") await beginDemo();
  else if (action === "register") {
    if (data.password === data.phrase) throw new Error("Choisissez une phrase de coffre différente du mot de passe de connexion.");
    await lock(false); mode = "account";
    emit("busy", { message: "Création du coffre sur cet appareil…" });
    const created = await cryptoCall("create", { phrase: data.phrase });
    const doc = emptyJournal();
    const envelope = await cryptoCall("seal", doc);
    const auth = recoveryCode();
    payload = { keyring: created.keyring, envelope };
    account = await request("/api/register", "POST", { pseudonyme: data.pseudonyme, password: data.password, authRecovery: auth, payload });
    revision = 1; conflict = false;
    await store(draftKey(), { payload, revision, dirty: false, time: Date.now() } satisfies Stored);
    await store("last-account", account!.id);
    await store("cache:" + account!.id, { payload, revision, dirty: false, time: Date.now() } satisfies Stored);
    kit = { account: account!.pseudonyme, auth, vault: created.recovery };
    showJournal(doc);
    emit("kit", kit);
    emit("status", { state: "synced" });
  } else if (action === "login") {
    await lock(false); mode = "account";
    account = await request("/api/login", "POST", data);
    await loadAccount();
  } else if (action === "unlock") {
    if (mode === "demo") { await beginDemo(); return; }
    emit("busy", { message: "Ouverture du coffre sur cet appareil…" });
    const sessionEpoch = epoch;
    const doc = await cryptoCall("unlock", { keyring: payload!.keyring, envelope: payload!.envelope, secret: data.secret, recovery: data.recovery });
    if (epoch !== sessionEpoch) return;
    showJournal(doc);
    await imagePreviews();
    emit("status", { state: conflict ? "conflict" : (await store(draftKey()))?.dirty ? "pending" : "synced" });
    if (!conflict) await synchronize();
  } else if (action === "save") scheduleSave(data);
  else if (action === "lock") await lock();
  else if (action === "logout") {
    if (mode === "account") { await saveNow(); await synchronize(); }
    await lock(false);
    if (account) {
      try { await request("/api/logout", "POST", {}); }
      catch { emit("notice", { message: "Coffre verrouillé localement. La révocation de session sur le serveur nécessite une connexion." }); }
      // Conservation des seules copies chiffrées ; session révoquée côté serveur.
    }
    account = null; payload = null; mode = "none"; emit("entry");
  } else if (action === "sync") await synchronize();
  else if (action === "kit") {
    if (!kit) throw new Error("Le kit n’est plus en mémoire. Utilisez le fichier conservé lors de la création.");
    download("mon-carnet-kit-recuperation.txt", "text/plain;charset=utf-8",
      "MON CARNET — KIT PRIVÉ\nConservez ce fichier hors du carnet, dans un endroit sûr.\n\nIdentifiant : " + kit.account +
      "\n\n1. CODE DE COMPTE (connexion uniquement) :\n" + kit.auth +
      "\n\n2. SECRET DU COFFRE (à saisir localement, jamais envoyé au serveur) :\n" + kit.vault +
      "\n\nSans phrase ni secret du coffre, vos textes ne peuvent pas être récupérés.\n");
  } else if (action === "dismissKit") { kit = null; emit("kitDismissed"); }
  else if (action === "changePhrase") {
    if (mode === "demo") throw new Error("La phrase de coffre concerne les comptes.");
    const sessionEpoch = epoch;
    const keyring: Keyring = await cryptoCall("change", data);
    if (!unlocked || epoch !== sessionEpoch) return;
    payload = { ...payload!, keyring };
    waitingDoc = currentDoc; await saveNow(); await synchronize();
    emit("notice", { message: "Nouvelle phrase conservée dans la copie chiffrée. Vérifiez l’état de synchronisation avant de changer d’appareil." });
  } else if (action === "resetAuth") {
    const newCode = recoveryCode();
    account = await request("/api/reset-auth", "POST", { ...data, newCode });
    mode = "account"; await loadAccount();
    emit("authReset", { code: newCode });
  } else if (action === "photo") await addPhoto();
  else if (action === "photoDelete") {
    const url = previews.get(data.id); if (url) URL.revokeObjectURL(url); previews.delete(data.id);
    await store("object:" + profile() + ":" + data.id, undefined, true);
    if (mode === "account") await store("delete:" + account!.id + ":" + data.id, data.id);
    emit("notice", { message: "Photo retirée. Sa suppression du serveur suit la synchronisation." });
  } else if (action === "encryptedExport") await encryptedExport();
  else if (action === "readableExport") {
    if (!Array.isArray(data) || !data.length) throw new Error("Choisissez au moins une trace à exporter.");
    download("mon-carnet-selection.txt", "text/plain;charset=utf-8",
      "MON CARNET — SÉLECTION LISIBLE\nCe fichier n’est pas chiffré.\n\n" +
      data.map((item: any) => item.titre + "\n" + item.texte + "\nOrigine : " + item.source).join("\n\n"));
    emit("notice", { message: "La sélection lisible a été générée sur cet appareil. Ce fichier n’est pas chiffré." });
  } else if (action === "import") {
    if (mode === "demo") throw new Error("L’import de sauvegarde concerne les comptes.");
    const sessionEpoch = epoch;
    const file = await pick("application/json,.json", 35_000_000);
    if (!unlocked || epoch !== sessionEpoch) return;
    let backup: unknown;
    try { backup = JSON.parse(await file.text()); } catch { throw new Error("Le fichier JSON est invalide."); }
    // Déchiffrement intégral et validation AVANT remplacement, jamais avec du HTML.
    const imported = await cryptoCall("import", { backup, secret: data.secret, recovery: data.recovery });
    if (!unlocked || epoch !== sessionEpoch) return;
    const previous = { payload, revision, dirty: true, time: Date.now() };
    await store("before-import:" + profile() + ":" + Date.now(), previous);
    for (const envelope of imported.images) await store("object:" + profile() + ":" + envelope.object, { envelope, pending: true });
    currentDoc = imported.journal; waitingDoc = imported.journal;
    await saveNow(); await synchronize();
    showJournal(imported.journal); await imagePreviews();
    emit("notice", { message: "Sauvegarde réellement réimportée. La copie chiffrée précédente est conservée sur cet appareil jusqu’à sa suppression volontaire." });
  } else if (action === "loadRemote") {
    await saveNow();
    await store("conflict-copy:" + profile() + ":" + Date.now(), { payload, revision, dirty: true, time: Date.now() });
    const remote = await request("/api/state");
    payload = remote.payload; revision = remote.revision; conflict = false;
    for (const draft of await entries("draft:" + account!.id + ":")) await store(draft.key, { ...draft.value, dirty: false });
    await store(draftKey(), { payload, revision, dirty: false, time: Date.now() });
    await lock();
    emit("notice", { message: "La version du serveur est prête à ouvrir. Votre copie en conflit reste chiffrée sur cet appareil." });
  } else if (action === "replaceRemote") {
    await saveNow();
    const remote = await request("/api/state");
    await store("conflict-remote:" + profile() + ":" + Date.now(), { payload: remote.payload, revision: remote.revision });
    revision = remote.revision; conflict = false;
    await store(draftKey(), { payload, revision, dirty: true, time: Date.now() });
    await synchronize();
  } else if (action === "exportConflict") {
    const copies = [...await entries("conflict-copy:" + profile() + ":"), ...await entries("conflict-remote:" + profile() + ":")];
    if (!copies.length) throw new Error("Aucune copie en conflit conservée.");
    const images = (await entries("object:" + profile() + ":")).map(e => e.value.envelope);
    for (const copy of copies) download("mon-carnet-conflit-" + copy.value.revision + ".json", "application/json", JSON.stringify({
      format: "mon-carnet-backup", version: 1, ...copy.value.payload, images
    }));
  } else if (action === "purgeLocal") {
    const id = profile();
    await saveNow();
    for (const prefix of ["before-import:", "conflict-copy:", "conflict-remote:"]) await erasePrefix(prefix + id + ":");
    emit("notice", { message: "Anciennes copies locales chiffrées supprimées." });
  } else if (action === "deleteAccount") {
    await request("/api/account", "DELETE", { password: data.password });
    const id = account!.id;
    await lock(false);
    for (const prefix of ["draft:", "object:", "delete:", "before-import:", "conflict-copy:", "conflict-remote:"]) await erasePrefix(prefix + id + ":");
    await store("cache:" + id, undefined, true);
    if (await store("last-account") === id) await store("last-account", undefined, true);
    account = null; mode = "none"; payload = null; emit("entry");
    emit("notice", { message: "Compte, sessions et objets chiffrés supprimés du serveur. Les exports que vous avez téléchargés restent sous votre contrôle." });
  } else if (action === "resetDemo") {
    await lock(false);
    await store("demo-vault", undefined, true);
    for (const prefix of ["draft:demo:", "object:demo:", "delete:demo:"]) await erasePrefix(prefix);
    await beginDemo();
  } else if (action === "settleMotion") {
    const sessionEpoch = epoch;
    // Attendre l'application des styles Elm, puis la fin réelle des transitions.
    // Une transition annulée ou non démarrée ne doit pas retenir une feuille.
    await waitForNativeMotion();
    if (sessionEpoch === epoch) emit("motionSettled", { version: data.version });
  } else if (action === "focus") {
    const version = ++focusVersion, sessionEpoch = epoch;
    requestAnimationFrame(async () => {
      const target = document.getElementById(data.id);
      if (document.activeElement?.classList.contains("moment-onglet") && target?.closest('.capsule') === document.activeElement.closest('.capsule')) {
        document.activeElement.closest('.moments-navigation')?.querySelector<HTMLElement>(".moment-onglet[aria-selected='true']")?.focus({ preventScroll: true });
        return;
      }
      const heading = target?.querySelector<HTMLElement>("h1");
      if (heading) heading.tabIndex = -1;
      (heading ?? target)?.focus({ preventScroll: true });
      if (data.reveal) await waitForNativeMotion();
      if (sessionEpoch !== epoch || version !== focusVersion || target !== document.getElementById(data.id)) return;
      const behavior = data.smooth ? "smooth" : "instant";
      if (data.scroll) window.scrollTo({ top: 0, behavior });
      else if (data.reveal && target) {
        const tabs = document.querySelector<HTMLElement>(".classeur-navigation");
        const inset = (tabs?.getBoundingClientRect().bottom ?? document.querySelector(".bandeau-carnet")?.getBoundingClientRect().bottom ?? 0) + 24;
        window.scrollTo({ top: Math.max(0, window.scrollY + target.getBoundingClientRect().top - inset), behavior });
      }
    });
  } else if (action === "newVault") {
    if (!account) throw new Error("Connectez-vous d’abord à votre compte.");
    const created = await cryptoCall("create", { phrase: data.phrase });
    const doc = emptyJournal();
    const envelope = await cryptoCall("seal", doc);
    const result = await request("/api/new-vault", "POST", { keyring: created.keyring, envelope }, revision);
    const id = account.id;
    for (const prefix of ["draft:", "object:", "delete:"]) await erasePrefix(prefix + id + ":");
    payload = { keyring: created.keyring, envelope }; revision = result.revision; conflict = false;
    await store(draftKey(), { payload, revision, dirty: false, time: Date.now() });
    showJournal(doc);
    emit("vaultRecovery", { secret: created.recovery });
    emit("status", { state: "synced" });
  } else if (action === "exportArchives") {
    const archives = await request("/api/archives");
    if (!archives.length) throw new Error("Aucun ancien coffre conservé.");
    for (const archive of archives) download("mon-carnet-ancien-coffre.json", "application/json", JSON.stringify({
      format: "mon-carnet-backup", version: 1, ...archive.payload, images: archive.images
    }));
  } else if (action === "purgeArchives") {
    await request("/api/archives", "DELETE", {});
    emit("notice", { message: "Anciens coffres chiffrés supprimés du serveur." });
  }
}

async function main(): Promise<void> {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").then(async registration => {
      await navigator.serviceWorker.ready;
      const cacheNames = await caches.keys();
      if (cacheNames.some(name => name.startsWith("etp-shell-"))) {
        const status = document.createElement("p"); status.className = "pwa-disponible";
        status.textContent = "Application et supports disponibles hors ligne sur cet appareil.";
        document.body.append(status);
      }
      registration.addEventListener("updatefound", () => registration.installing?.addEventListener("statechange", () => {
        if (registration.waiting && app) emit("notice", { message: "Mise à jour prête : verrouillez le coffre et fermez toutes les fenêtres du carnet pour l’appliquer." });
      }));
    }).catch(() => {});
  }
  const response = await fetch("/catalogue.json", { cache: "no-cache" });
  const catalogue = await response.json();
  const demoOnly = document.documentElement.dataset.demoOnly === "true";
  app = window.Elm.Main.init({ node: document.getElementById("app"), flags: {
    largeur: innerWidth, chapitres: catalogue.chapitres, demoOnly, reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches
  } });
  app.ports.commande.subscribe(commandValue => {
    const exclusive = exclusiveActions.has(commandValue.action);
    if (exclusive && technicalAction) return;
    if (exclusive) technicalAction = true;
    command(commandValue).catch(error => { emit("error", { message: message(error) }); emit("idle"); })
      .finally(() => { if (exclusive) technicalAction = false; });
  });
  matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", event => emit("motionPreference", { reduce: event.matches }));
  addEventListener("online", () => { if (unlocked) synchronize().catch(error => emit("status", { state: "pending", message: message(error) })); });
  addEventListener("offline", () => { if (unlocked && mode === "account") emit("status", { state: "pending", message: "Hors connexion : sauvegarde chiffrée sur cet appareil." }); });
  for (const event of ["pointerdown", "keydown"]) addEventListener(event, () => { lastActivity = Date.now(); if (lastWarning) { lastWarning = false; emit("lockWarning", { show: false }); } });
  addEventListener("pagehide", () => { if (unlocked) lock(false).catch(() => {}); });
  addEventListener("pageshow", event => { if (event.persisted) lock(); });
  // Certains navigateurs ne signalent pas online immédiatement : reprise bornée,
  // aucune requête si la copie scellée n’est pas sale, aucun polling de chapitre.
  setInterval(() => {
    if (unlocked && mode === "account" && !conflict) synchronize().catch(error => emit("status", { state: "error", message: message(error) }));
  }, 10000);
  setInterval(() => {
    if (!unlocked || automaticMinutes === 0) return;
    const remaining = automaticMinutes * 60000 - (Date.now() - lastActivity);
    if (remaining <= 0) lock();
    else if (remaining < 30000 && !lastWarning) { lastWarning = true; emit("lockWarning", { show: true }); }
  }, 5000);
  if (!demoOnly) {
    try { account = await request("/api/me"); mode = "account"; await loadAccount(); }
    catch {
      try { await loadLocalAccount(); }
      catch { account = null; mode = "none"; }
    }
  }
}
main().catch(() => {
  const appNode = document.getElementById("app");
  if (appNode) appNode.textContent = "Le carnet n’a pas pu s’ouvrir. Rechargez la page ; vérifiez que ce navigateur autorise JavaScript et le stockage local.";
});
