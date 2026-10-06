/** Frontière crypto : aucune clé ou phrase ne quitte le Worker. Format v1 strict. */
export type Envelope = { v: 1; vault: string; object: string; iv: string; ct: string };
export type WrappedKey = Envelope & { salt: string; rounds: number };
export type Keyring = { v: 1; vault: string; phrase: WrappedKey; recovery: Envelope };
export const ROUNDS = 600_000;
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const bytes = (size: number): Uint8Array => crypto.getRandomValues(new Uint8Array(size));
export function base64(value: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < value.length; i += 8192) binary += String.fromCharCode(...value.subarray(i, i + 8192));
  return btoa(binary);
}
export function unbase64(value: unknown, limit = 8_000_000): Uint8Array {
  if (typeof value !== "string" || value.length > limit || !/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.length % 4)
    throw new Error("Format chiffré invalide.");
  const decoded = atob(value);
  return Uint8Array.from(decoded, c => c.charCodeAt(0));
}
export function recoveryCode(): string { return base64(bytes(32)); }
function context(vault: string, object: string): Uint8Array {
  if (!UUID.test(vault) || !/^(journal|phrase|recovery|[0-9a-f-]{36})$/.test(object))
    throw new Error("Identifiant de coffre ou d’objet invalide.");
  return encoder.encode("mon-carnet|1|" + vault + "|" + object);
}
function check(value: Envelope, vault: string, object: string): void {
  if (!value || value.v !== 1 || value.vault !== vault || value.object !== object ||
      unbase64(value.iv, 32).length !== 12 || unbase64(value.ct).length < 16) throw new Error("Enveloppe invalide ou substituée.");
  context(vault, object);
}
async function aes(raw: Uint8Array, extractable = false): Promise<CryptoKey> {
  if (raw.length !== 32) throw new Error("Clé invalide.");
  return crypto.subtle.importKey("raw", raw as BufferSource, "AES-GCM", extractable, ["encrypt", "decrypt"]);
}
export async function derive(phrase: string, salt: Uint8Array, rounds: number): Promise<CryptoKey> {
  if (salt.length !== 16 || rounds !== ROUNDS || phrase.length > 1024 || phrase.length < 12)
    throw new Error("Phrase ou paramètres de dérivation invalides.");
  const key = await crypto.subtle.importKey("raw", encoder.encode(phrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt: salt as BufferSource, iterations: rounds, hash: "SHA-256" },
    key, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
export async function seal(key: CryptoKey, value: Uint8Array, vault: string, object: string): Promise<Envelope> {
  const iv = bytes(12);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource, additionalData: context(vault, object) as BufferSource, tagLength: 128 }, key, value as BufferSource);
  return { v: 1, vault, object, iv: base64(iv), ct: base64(new Uint8Array(ct)) };
}
export async function open(key: CryptoKey, value: Envelope, vault: string, object: string): Promise<Uint8Array> {
  check(value, vault, object);
  try {
    return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unbase64(value.iv) as BufferSource,
      additionalData: context(vault, object) as BufferSource, tagLength: 128 }, key, unbase64(value.ct) as BufferSource));
  } catch { throw new Error("Le coffre ne peut pas être ouvert : secret incorrect ou données altérées."); }
}
/** Les quatre premiers octets donnent la longueur ; le reste est du padding aléatoire. */
export function pack(value: unknown): Uint8Array {
  const text = encoder.encode(JSON.stringify(value));
  if (text.length > 2_000_000) throw new Error("Le carnet dépasse la limite de 2 Mo.");
  const step = text.length < 65536 ? 4096 : 16384;
  const buffer = bytes(Math.ceil((text.length + 4) / step) * step);
  new DataView(buffer.buffer).setUint32(0, text.length);
  buffer.set(text, 4);
  return buffer;
}
export function unpack(value: Uint8Array): unknown {
  if (value.length < 4) throw new Error("Contenu incomplet.");
  const size = new DataView(value.buffer, value.byteOffset, value.byteLength).getUint32(0);
  if (size > 2_000_000 || size > value.length - 4) throw new Error("Taille du contenu invalide.");
  return JSON.parse(decoder.decode(value.subarray(4, size + 4)));
}
export async function createVault(phrase: string): Promise<{ key: CryptoKey; keyring: Keyring; recovery: string }> {
  const vault = crypto.randomUUID();
  const raw = bytes(32), salt = bytes(16), recovery = recoveryCode();
  const phraseKey = await derive(phrase, salt, ROUNDS);
  const keyring: Keyring = { v: 1, vault,
    phrase: { ...await seal(phraseKey, raw, vault, "phrase"), salt: base64(salt), rounds: ROUNDS },
    recovery: await seal(await aes(unbase64(recovery)), raw, vault, "recovery") };
  const key = await aes(raw);
  raw.fill(0);
  return { key, keyring, recovery };
}
export async function unlock(keyring: Keyring, secret: string, recovery = false): Promise<CryptoKey> {
  if (!keyring || keyring.v !== 1 || !UUID.test(keyring.vault)) throw new Error("Version du coffre non prise en charge.");
  const wrapper = recovery ? keyring.recovery : keyring.phrase;
  const key = recovery ? await aes(unbase64(secret, 64)) : await derive(secret, unbase64(keyring.phrase.salt, 32), keyring.phrase.rounds);
  const raw = await open(key, wrapper, keyring.vault, recovery ? "recovery" : "phrase");
  const dataKey = await aes(raw);
  raw.fill(0);
  return dataKey;
}
export async function changePhrase(keyring: Keyring, secret: string, newPhrase: string, recovery = false): Promise<Keyring> {
  const wrappingKey = recovery ? await aes(unbase64(secret, 64)) : await derive(secret, unbase64(keyring.phrase.salt, 32), keyring.phrase.rounds);
  const raw = await open(wrappingKey, recovery ? keyring.recovery : keyring.phrase, keyring.vault, recovery ? "recovery" : "phrase");
  const salt = bytes(16);
  const phrase = { ...await seal(await derive(newPhrase, salt, ROUNDS), raw, keyring.vault, "phrase"), salt: base64(salt), rounds: ROUNDS };
  raw.fill(0);
  return { ...keyring, phrase };
}
/** Validation après déchiffrement. Pas de merge implicite ni d’exécution de contenu importé. */
export function validateJournal(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Carnet invalide.");
  const doc = value as Record<string, unknown>;
  if (doc.version !== 1 || !Number.isInteger(doc.etape) || Number(doc.etape) < 0 || Number(doc.etape) > 14 ||
      !Number.isInteger(doc.nextId) || !doc.notes || typeof doc.notes !== "object" || Array.isArray(doc.notes))
    throw new Error("Version ou structure du carnet invalide.");
  for (const key of ["objectifs", "defis", "experiences", "cartes", "traces", "etapes", "photos", "consultations"])
    if (!Array.isArray(doc[key]) || (doc[key] as unknown[]).length > 500) throw new Error("Collection du carnet invalide.");
  if ((doc.defis as { statut: string }[]).filter(d => d.statut === "actif").length > 3)
    throw new Error("Trois défis actifs maximum.");
  const visit = (v: unknown, depth = 0): void => {
    if (depth > 12) throw new Error("Import trop imbriqué.");
    if (typeof v === "string" && v.length > 30000) throw new Error("Texte trop long.");
    if (Array.isArray(v)) v.forEach(x => visit(x, depth + 1));
    else if (v && typeof v === "object") for (const [k,x] of Object.entries(v)) {
      if (["__proto__", "constructor", "prototype"].includes(k)) throw new Error("Champ interdit.");
      visit(x, depth + 1);
    }
  };
  visit(doc);
  const integer = (v: unknown, min = 0, max = 1_000_000_000): boolean => Number.isInteger(v) && Number(v) >= min && Number(v) <= max;
  const text = (v: unknown): boolean => typeof v === "string" && v.length <= 30000;
  const schema = (v: unknown, names: string[]): Record<string, unknown> => {
    if (!v || typeof v !== "object" || Array.isArray(v) || names.some(n => !(n in v)))
      throw new Error("Entrée de carnet invalide.");
    return v as Record<string, unknown>;
  };
  const unique = (rows: any[]): void => { if (new Set(rows.map(v => v.id)).size !== rows.length) throw new Error("Identifiants dupliqués."); };
  const strings = (v: unknown): boolean => Array.isArray(v) && v.length <= 500 && v.every(text);
  const stage = (v: unknown): boolean => integer(v, 0, 14);
  for (const [k,v] of Object.entries(doc.notes as object)) if (k.length > 100 || !text(v)) throw new Error("Note invalide.");
  for (const raw of doc.objectifs as any[]) {
    const v = schema(raw, ["id","texte","origine","historique"]);
    if (!integer(v.id,1) || !text(v.texte) || !stage(v.origine) || !strings(v.historique)) throw new Error("Objectif invalide.");
  }
  for (const raw of doc.defis as any[]) {
    const v = schema(raw, ["id","texte","objectif","statut","origine","historique"]);
    if (!integer(v.id,1) || !text(v.texte) || !integer(v.objectif) || !stage(v.origine) || !strings(v.historique) ||
        !["actif","pause","autonomie"].includes(String(v.statut)) ||
        (v.objectif !== 0 && !(doc.objectifs as any[]).some(o => o.id === v.objectif))) throw new Error("Défi invalide.");
  }
  for (const raw of doc.experiences as any[]) {
    const v = schema(raw, ["id","seance","defi","principale","quoi","quand","comment","obstacle","observer","statut","essaye","marque","appris","suite"]);
    if (!integer(v.id,1) || !stage(v.seance) || !integer(v.defi) || typeof v.principale !== "boolean" ||
        !["quoi","quand","comment","obstacle","observer","essaye","marque","appris","suite"].every(k => text(v[k])) ||
        !["préparée","réalisée","pas réalisé","pas d’occasion","je ne souhaite plus le faire","je préfère ne pas répondre"].includes(String(v.statut)) ||
        (v.defi !== 0 && !(doc.defis as any[]).some(d => d.id === v.defi))) throw new Error("Expérimentation invalide.");
  }
  for (let s = 0; s <= 14; s++) {
    const local = (doc.experiences as any[]).filter(x => x.seance === s);
    if (local.length > 2 || new Set(local.map(x => x.principale)).size !== local.length) throw new Error("Trop d’expérimentations entre deux séances.");
  }
  const card = (raw: unknown): void => {
    const v = schema(raw, ["id","mot","sens","zone","hesitation"]);
    const zones = ["coeur","autour","horizon","explorer","limites"];
    if (!integer(v.id,1) || !text(v.mot) || !text(v.sens) || !zones.includes(String(v.zone)) ||
        (v.hesitation !== "" && (!zones.includes(String(v.hesitation)) || v.hesitation === v.zone))) throw new Error("Carte invalide.");
  };
  (doc.cartes as any[]).forEach(card);
  for (const raw of doc.traces as any[]) {
    const v = schema(raw, ["id","seance","titre","texte","cartes"]);
    if (!integer(v.id,1) || !stage(v.seance) || !text(v.titre) || !text(v.texte) || !Array.isArray(v.cartes) || v.cartes.length > 500) throw new Error("Trace invalide.");
    v.cartes.forEach(card); unique(v.cartes);
  }
  for (const raw of doc.etapes as any[]) {
    const v = schema(raw, ["id","seance","quand","texte","montre"]);
    if (!integer(v.id,1) || !stage(v.seance) || !text(v.quand) || !text(v.texte) || !text(v.montre)) throw new Error("Étape importante invalide.");
  }
  if ((doc.photos as any[]).length > 20) throw new Error("Vingt photos maximum.");
  for (const raw of doc.photos as any[]) {
    const v = schema(raw, ["id","nom","seance"]);
    if (typeof v.id !== "string" || !UUID.test(v.id) || !text(v.nom) || !stage(v.seance)) throw new Error("Photo invalide.");
  }
  if (!(doc.consultations as any[]).every(stage)) throw new Error("Repères de consultation invalides.");
  const privateIds = ["objectifs","defis","experiences","cartes","traces","etapes"].flatMap(k => doc[k] as any[]);
  unique(privateIds); unique(doc.photos as any[]);
  if (privateIds.some(v => v.id >= Number(doc.nextId)) || !integer(doc.nextId,1)) throw new Error("Compteur d’identifiants invalide.");
  pack(doc);
}
