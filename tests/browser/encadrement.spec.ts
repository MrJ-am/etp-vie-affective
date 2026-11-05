import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createVault, seal, pack, recoveryCode } from "../../bridge/crypto";
import { journal, phrase, password } from "../fixtures";

const base = "http://localhost:38139";
test.skip(process.env.CARNET_TEST_URL !== base, "Atelier fictif local dédié obligatoire");
test.setTimeout(180000);
async function creerEncadrant(request: APIRequestContext) {
  expect(process.env.CARNET_DB_NAME).toBe("vise_fictif_test");
  expect(process.env.CARNET_DB_HOST).toBe("127.0.0.1");
  const pseudo = "navigateur_" + crypto.randomUUID().slice(0, 12);
  const coffre = await createVault(phrase);
  const payload = { keyring: coffre.keyring, envelope: await seal(coffre.key, pack(journal()), coffre.keyring.vault, "journal") };
  const response = await request.post(base + "/api/register", { headers: { Origin: base }, data: { pseudonyme: pseudo, password, payload, authRecovery: recoveryCode() } });
  expect(response.status()).toBe(200);
  execFileSync(process.env.CARNET_TEST_BIN || "backend/target/release/etp-carnet-server", ["--encadrant", pseudo], { stdio: "pipe" });
  return pseudo;
}
async function connecter(page: Page, identifiant: string) {
  await page.goto(base + "/espace.html");
  await page.getByRole("textbox", { name: "Adresse mail ou identifiant", exact: true }).fill(identifiant);
  await page.getByLabel("Mot de passe", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Me connecter", exact: true }).click();
}
test("Encadrement et invitation : inscription, PDF, aperçu isolé, accès et confidentialité", async ({ page, browser, request }) => {
  const pseudo = await creerEncadrant(request);
  // Le contexte API de fixture possède sa session propre ; le navigateur commence anonyme.
  await connecter(page, pseudo);
  await expect(page.getByRole("heading", { name: "Espace d’encadrement", exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "Nom du nouveau groupe", exact: true }).fill("Groupe navigateur fictif");
  await page.getByRole("button", { name: "Créer le groupe et son lien", exact: true }).click();
  await page.getByRole("button", { name: "Groupe navigateur fictif · 0 participant·es", exact: true }).click();
  const invitation = await page.getByRole("textbox", { name: "Lien d’invitation du groupe · à copier-coller", exact: true }).inputValue();
  const participant = await browser.newContext({ baseURL: base, viewport: { width: 390, height: 844 } });
  const membre = await participant.newPage();
  await membre.goto(invitation);
  await expect(membre.getByRole("heading", { name: "Rejoindre « Groupe navigateur fictif »" })).toBeVisible();
  await membre.getByRole("textbox", { name: "Nom", exact: true }).fill("Fiction");
  await membre.getByRole("textbox", { name: "Prénom", exact: true }).fill("Léa");
  const email = "navigateur." + crypto.randomUUID() + "@example.test";
  await membre.getByRole("textbox", { name: "Adresse mail", exact: true }).fill(email);
  await membre.getByLabel("Mot de passe · 12 caractères minimum", { exact: true }).fill(password);
  await membre.getByLabel("Phrase du coffre · distincte, 12 caractères minimum", { exact: true }).fill(phrase);
  await membre.getByLabel("Confirmer la phrase du coffre", { exact: true }).fill(phrase);
  await membre.getByRole("checkbox").check();
  await membre.getByRole("button", { name: "Créer mon compte et rejoindre le groupe", exact: true }).click();
  await expect(membre.getByRole("heading", { name: "Votre carnet est créé", exact: true })).toBeVisible();
  const downloaded = membre.waitForEvent("download");
  await membre.getByRole("button", { name: "Télécharger mon kit privé", exact: true }).click();
  expect((await downloaded).suggestedFilename()).toBe("mon-carnet-kit-recuperation.txt");
  await membre.getByRole("button", { name: "Continuer vers mon groupe", exact: true }).click();
  await expect(membre.getByRole("heading", { name: "Mon groupe · Groupe navigateur fictif", exact: true })).toBeVisible();
  await expect(membre.getByRole("heading", { name: "Espace d’encadrement", exact: true })).toHaveCount(0);
  await expect.poll(() => membre.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await page.reload();
  await page.getByRole("button", { name: "Groupe navigateur fictif · 1 participant·es", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Léa Fiction", exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const seance = page.locator(".carnet-panneau").filter({ has: page.getByRole("heading", { name: /^2 · / }) });
  await seance.getByRole("button", { name: "Modifier le contenu commun", exact: true }).click();
  await page.getByRole("textbox", { name: "Titre", exact: true }).fill("Titre fictif édité dans le navigateur");
  await page.getByRole("button", { name: "Enregistrer le contenu commun", exact: true }).click();
  const editee = page.locator(".carnet-panneau").filter({ has: page.getByRole("heading", { name: "2 · Titre fictif édité dans le navigateur", exact: true }) });
  await expect(editee).toBeVisible();
  const choice = page.waitForEvent("filechooser");
  await editee.getByRole("button", { name: "Déposer un PDF", exact: true }).click();
  await (await choice).setFiles({ name: "support-fictif.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n") });
  await expect(editee.getByRole("link", { name: "support-fictif.pdf", exact: true })).toBeVisible();
  await editee.getByRole("button", { name: "Masquer pour ce groupe", exact: true }).click();
  await expect(editee.getByRole("button", { name: "Rendre visible pour ce groupe", exact: true })).toBeVisible();

  const previewUrl = await page.getByRole("link", { name: "Voir en mode participant·e", exact: true }).getAttribute("href");
  const preview = await page.context().newPage();
  const privateCalls: string[] = [];
  preview.on("request", r => { if (/\/api\/(state|objects|archives|new-vault)/.test(r.url())) privateCalls.push(r.url()); });
  await preview.goto(base + previewUrl);
  await expect(preview.getByText(/Aperçu participant·e du groupe/)).toBeVisible();
  await expect(preview.locator("#capsule-2")).toHaveCount(0);
  await expect(preview.locator("#capsule-1")).toHaveCount(1);
  expect(privateCalls).toEqual([]);
  await preview.close();

  await membre.reload();
  await expect(membre.getByRole("heading", { name: "Titre fictif édité dans le navigateur", exact: true })).toHaveCount(0);
  await membre.getByRole("link", { name: "Ouvrir mon carnet personnel", exact: true }).click();
  await membre.getByLabel("Phrase de coffre", { exact: true }).fill(phrase);
  await membre.getByRole("button", { name: "Ouvrir mon coffre", exact: true }).click();
  await expect(membre.locator("#capsule-2")).toHaveCount(0);
  await expect(membre.locator("#capsule-1")).toHaveCount(1);

  await page.getByRole("button", { name: "Désactiver l’accès", exact: true }).click();
  await expect(page.getByRole("button", { name: "Réactiver l’accès", exact: true })).toBeVisible();
  expect((await participant.request.get(base + "/api/state")).status()).toBe(401);
  await page.getByRole("button", { name: "Réactiver l’accès", exact: true }).click();
  await expect(page.getByRole("button", { name: "Désactiver l’accès", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Supprimer le compte…", exact: true }).click();
  await page.getByRole("textbox", { name: "Écrivez SUPPRIMER pour confirmer", exact: true }).fill("SUPPRIMER");
  await page.getByRole("button", { name: "Confirmer la suppression définitive", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Léa Fiction", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Archiver le groupe", exact: true }).click();
  await expect(page.getByRole("button", { name: "Réactiver le groupe", exact: true })).toBeVisible();
  await participant.close();
});

test("Questionnaire : composition, participation et fermeture sans résultat individuel", async ({ page, request, browser }) => {
  const pseudo = await creerEncadrant(request);
  await connecter(page, pseudo);
  await page.getByRole("textbox", { name: "Nom du nouveau groupe", exact: true }).fill("Questionnaire navigateur");
  await page.getByRole("button", { name: "Créer le groupe et son lien", exact: true }).click();
  await page.getByRole("button", { name: "Questionnaire navigateur · 0 participant·es", exact: true }).click();
  const invitation = await page.getByRole("textbox", { name: "Lien d’invitation du groupe · à copier-coller", exact: true }).inputValue();
  await page.getByRole("textbox", { name: "Titre du questionnaire", exact: true }).fill("Ressenti avant la séance");
  await page.getByRole("textbox", { name: "Question à ajouter", exact: true }).fill("Comment vous sentez-vous ?");
  await page.getByRole("textbox", { name: "Choix proposés · 2 à 8, un par ligne", exact: true }).fill("À l’aise\nBesoin de temps");
  await page.getByRole("button", { name: "Ajouter cette question", exact: true }).click();
  await page.getByRole("button", { name: "Lancer le questionnaire", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Ressenti avant la séance", exact: true })).toBeVisible();
  const contexte = await browser.newContext({ baseURL: base });
  const coffre = await createVault(phrase);
  const inscription = await contexte.request.post(base + "/api/inscription-groupe", { headers: { Origin: base }, data: {
    invitation: invitation.split("#invitation=")[1], nom: "Fiction", prenom: "Samir", email: `sondage.${crypto.randomUUID()}@example.test`, password,
    authRecovery: recoveryCode(), payload: { keyring: coffre.keyring, envelope: await seal(coffre.key, pack(journal()), coffre.keyring.vault, "journal") }
  } });
  expect(inscription.status()).toBe(200);
  const participant = await contexte.newPage();
  await participant.goto(base + "/espace.html");
  await participant.getByRole("combobox", { name: "Comment vous sentez-vous ?", exact: true }).selectOption("0");
  await participant.getByRole("button", { name: "Envoyer mes réponses anonymes", exact: true }).click();
  await expect(participant.getByText("Votre participation a été enregistrée. Les choix sont comptés sans réponse nominative.", { exact: true })).toBeVisible();
  await expect(participant.getByRole("button", { name: "Envoyer mes réponses anonymes", exact: true })).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: "Questionnaire navigateur · 1 participant·es", exact: true }).click();
  await expect(page.getByText("1 participation(s)", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Fermer et afficher les résultats", exact: true }).click();
  await expect(page.getByText("Questionnaire fermé. Résultats masqués : moins de trois participations.", { exact: true })).toBeVisible();
  await contexte.close();
});
