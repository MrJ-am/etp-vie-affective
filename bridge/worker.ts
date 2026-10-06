import { createVault, unlock, seal, open, pack, unpack, changePhrase, validateJournal, type Keyring, type Envelope } from "./crypto";
let key: CryptoKey | null = null;
let keyring: Keyring | null = null;
/** Traitements coûteux hors UI ; secrets uniquement en mémoire et erreurs sans paramètres. */
let operations: Promise<void> = Promise.resolve();
self.addEventListener("message", (event: MessageEvent) => {
  operations = operations.then(() => handle(event));
});
async function handle(event: MessageEvent): Promise<void> {
  const { id, action, data } = event.data;
  try {
    let result: unknown;
    if (action === "create") {
      const created = await createVault(data.phrase);
      key = created.key; keyring = created.keyring;
      result = { keyring, recovery: created.recovery };
    } else if (action === "unlock") {
      const opened = await unlock(data.keyring, data.secret, data.recovery);
      const journal = unpack(await open(opened, data.envelope, data.keyring.vault, "journal"));
      validateJournal(journal);
      key = opened; keyring = data.keyring;
      result = journal;
    } else if (action === "demo") {
      key = data.key || await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
      keyring = { v: 1, vault: data.vault } as Keyring;
      result = { key, journal: data.envelope ? unpack(await open(key!, data.envelope, data.vault, "journal")) : null };
    } else if (action === "seal") {
      if (!key || !keyring) throw new Error("Coffre verrouillé.");
      validateJournal(data);
      result = await seal(key, pack(data), keyring.vault, "journal");
    } else if (action === "imageSeal") {
      if (!key || !keyring) throw new Error("Coffre verrouillé.");
      result = await seal(key, data.bytes, keyring.vault, data.object);
    } else if (action === "imageOpen") {
      if (!key || !keyring) throw new Error("Coffre verrouillé.");
      result = await open(key, data as Envelope, keyring.vault, data.object);
    } else if (action === "change") {
      keyring = await changePhrase(keyring!, data.secret, data.phrase, data.recovery);
      result = keyring;
    } else if (action === "import") {
      const backup = data.backup;
      if (!backup || backup.format !== "mon-carnet-backup" || backup.version !== 1 ||
          !Array.isArray(backup.images) || backup.images.length > 20) throw new Error("Format de sauvegarde invalide.");
      const backupKey = await unlock(backup.keyring, data.secret, data.recovery);
      const journal = unpack(await open(backupKey, backup.envelope, backup.keyring.vault, "journal"));
      validateJournal(journal);
      const images = [];
      const imageIds = new Set(backup.images.map((image: Envelope) => image.object));
      if (imageIds.size !== backup.images.length || (journal.photos as any[]).some((photo: any) => !imageIds.has(photo.id)))
        throw new Error("Pièces jointes manquantes ou dupliquées.");
      for (const image of backup.images) {
        const raw = await open(backupKey, image, backup.keyring.vault, image.object);
        if (raw.length > 1_200_000) throw new Error("Pièce jointe trop grande.");
        images.push(await seal(key!, raw, keyring!.vault, image.object));
      }
      result = { journal, images };
    } else if (action === "lock") {
      key = null; keyring = null; result = true;
    } else throw new Error("Commande inconnue.");
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : "Opération impossible." });
  }
}
