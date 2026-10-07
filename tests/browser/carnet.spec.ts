import {test,expect,type Page,type BrowserContext} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {readFile,unlink} from "node:fs/promises";
import {unlock,open,unpack,unbase64} from "../../bridge/crypto";

const password="Compte_fictif_pour_tests_2026";
const phrase="Mon coffre de test a une phrase distincte";
const sentinel="SENTINEL_FICTIVE_CARNET_7482";
const catalogue=JSON.parse(await readFile("content/parcours.json","utf8"));
async function settled(page:Page){
  await page.locator('#titre-page[data-active="true"]').waitFor();
  await expect(page.locator('[data-moving="true"]')).toHaveCount(0);
}
async function nav(page:Page,name:string){
  await page.getByRole("button",{name:"Masquer / verrouiller",exact:true}).waitFor();
  if(name==="Mon accueil"){
    await page.getByRole("button",{name,exact:true}).click();
  }else if(["Mes réglages","À propos & sources"].includes(name)){
    await page.locator('#compte-commande').click();
    await page.locator('#compte-options').getByRole("button",{name,exact:true}).click();
  }else{
    if(await page.getByRole("tab").count()===0){
      await page.getByRole("button",{name:"Voir les 15 étapes",exact:true}).or(page.getByRole("button",{name:"Revenir au carnet",exact:true})).filter({visible:true}).first().click();
      await expect(page.getByRole("tab")).toHaveCount(3);
    }
    await page.getByRole("tab",{name,exact:true}).click();
  }
  await expect(page.locator('#titre-page')).toHaveAttribute("data-panel",name);
  await settled(page);
}
async function seance(page:Page,id:number,moment?:string){
  await nav(page,"Mon parcours");
  const capsule=page.locator('#capsule-'+id);
  const opener=capsule.locator('.capsule-ouvrir');
  if(await opener.getAttribute("aria-expanded")!=="true")await opener.click();
  await expect(capsule.locator('.capsule-titre')).toHaveText(catalogue.chapitres[id].titre);
  await expect(opener).toHaveAttribute("aria-expanded","true");
  await settled(page);
  if(moment){const tab=page.getByRole("button",{name:moment,exact:true});await tab.click();await expect(tab).toHaveAttribute("aria-pressed","true");await settled(page);}
}
async function synced(page:Page){
  await expect(page.locator(".save-status")).toContainText("Synchronisé",{timeout:15000});
}
async function kitDownload(page:Page){
  const wait=page.waitForEvent("download");
  await page.getByRole("button",{name:"Télécharger mon kit",exact:true}).click();
  const file=await wait,path=await file.path();const text=await readFile(path!,"utf8");await unlink(path!);
  const auth=text.match(/CODE DE COMPTE[^\n]*\n([^\n]+)/)![1];
  const vault=text.match(/SECRET DU COFFRE[^\n]*\n([^\n]+)/)![1];
  await page.getByRole("button",{name:"J’ai conservé mon kit",exact:true}).click();
  return{auth,vault};
}
async function register(page:Page){
  const pseudo="e2e_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,8);
  await page.goto("/");
  await page.getByRole("button",{name:"Créer mon compte",exact:true}).click();
  await page.getByRole("textbox",{name:"Identifiant pseudonyme",exact:true}).fill(pseudo);
  await page.getByLabel("Mot de passe de connexion",{exact:true}).filter({visible:true}).fill(password);
  await page.getByLabel("Phrase de coffre · 12 caractères minimum",{exact:true}).filter({visible:true}).fill(phrase);
  await page.getByLabel("Confirmer la phrase de coffre",{exact:true}).filter({visible:true}).fill(phrase);
  await page.getByRole("checkbox",{name:"Je n’utilise que des données fictives pour ce prototype.",exact:true}).check();
  await page.getByRole("button",{name:"Créer mon compte et mon coffre",exact:true}).click();
  await expect(page.getByRole("button",{name:"Reprendre mon carnet",exact:true})).toBeVisible();
  const kit=await kitDownload(page);await synced(page);
  return{pseudo,...kit};
}
async function login(page:Page,pseudo:string,secret=phrase,recovery=false){
  await page.goto("/");
  await page.getByRole("button",{name:"Me connecter",exact:true}).click();
  await page.getByLabel("Identifiant pseudonyme",{exact:true}).filter({visible:true}).fill(pseudo);
  await page.getByLabel("Mot de passe de connexion",{exact:true}).filter({visible:true}).fill(password);
  await page.getByRole("button",{name:"Me connecter",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Votre carnet est fermé",exact:true})).toBeVisible();
  if(recovery)await page.getByRole("checkbox",{name:"Utiliser le secret de récupération du coffre",exact:true}).check();
  await page.getByLabel(recovery?"Secret du coffre · partie 2 du kit":"Phrase de coffre",{exact:true}).filter({visible:true}).fill(secret);
  await page.getByRole("button",{name:"Ouvrir mon coffre",exact:true}).click();
  await expect(page.getByRole("button",{name:"Reprendre mon carnet",exact:true})).toBeVisible();
}
async function note(page:Page,text:string){
  await seance(page,1);
  const saved=page.waitForResponse(r=>r.url().endsWith("/api/state")&&r.request().method()==="PUT"&&r.ok());
  await page.getByLabel("Ma note personnelle · facultatif",{exact:true}).filter({visible:true}).fill(text);
  await saved;
  await synced(page);
}
async function backup(page:Page){
  await nav(page,"Mes réglages");await synced(page);
  const wait=page.waitForEvent("download");
  await page.getByRole("button",{name:"Exporter mon carnet chiffré",exact:true}).click();
  const file=await wait,path=await file.path();
  const data=JSON.parse(await readFile(path!,"utf8"));await unlink(path!);return data;
}
async function apiState(page:Page){return page.evaluate(async()=>{const r=await fetch("/api/state");return r.json();});}

test("démo : paysage au clavier, hésitation, trace, retour et isolation navigateur",async({page,browser})=>{
  await page.goto("/");await page.getByRole("button",{name:"Ouvrir la démonstration",exact:true}).click();
  await page.getByRole("button",{name:"Reprendre mon carnet",exact:true}).click();
  await page.getByRole("button",{name:"Pendant",exact:true}).click();
  const card=page.getByRole("button",{name:"＋ Le calme",exact:true});await card.focus();await page.keyboard.press("Enter");
  await page.getByLabel("Pour moi, cela signifie…",{exact:true}).filter({visible:true}).fill("Un lieu où je peux faire une pause.");
  await page.getByLabel("Placer dans…",{exact:true}).filter({visible:true}).selectOption("coeur");
  await page.getByLabel("J’hésite aussi avec… · facultatif",{exact:true}).filter({visible:true}).selectOption("autour");
  await page.getByRole("button",{name:"4 · Garder une trace",exact:true}).click();
  await page.getByRole("button",{name:"Conserver cette version du paysage",exact:true}).click();
  await expect(page.getByText("Cette version est conservée dans Mes repères. Vous pouvez continuer à modifier votre production.",{exact:true})).toBeVisible();
  await expect(page.locator(".save-status")).toContainText("Chiffré sur cet appareil");
  await page.reload();await page.getByRole("button",{name:"Ouvrir la démonstration",exact:true}).click();
  await seance(page,1,"Pendant");
  await expect(page.getByRole("button",{name:"Le calme",exact:true})).toBeVisible();
  await nav(page,"Mes repères");await expect(page.getByText("Mon paysage · version 1",{exact:false}).first()).toBeVisible();
  const other=await browser.newContext();const p=await other.newPage();await p.goto("/");await p.getByRole("button",{name:"Ouvrir la démonstration",exact:true}).click();await seance(p,1,"Pendant");
  await expect(p.getByRole("button",{name:"Le calme",exact:true})).toHaveCount(0);await other.close();
  await nav(page,"Mes réglages");await page.getByRole("button",{name:"Réinitialiser le carnet fictif",exact:true}).click();await page.getByRole("button",{name:"Effacer mes modifications de la démo",exact:true}).click();
  await expect(page.getByRole("button",{name:"Reprendre mon carnet",exact:true})).toBeVisible();
  await seance(page,1,"Pendant");await expect(page.getByRole("button",{name:"Le calme",exact:true})).toHaveCount(0);
});

test("quinze séances sans verrouillage, bilans adaptés et sept rubriques opérationnelles",async({page})=>{
  test.setTimeout(90000);
  await page.goto("/");await page.getByRole("button",{name:"Ouvrir la démonstration",exact:true}).click();
  for(let id=0;id<15;id++){
    await seance(page,id);
    await expect(page.getByRole("button",{name:"Terminer ma consultation",exact:true})).toBeVisible();
    if(![0,13,14].includes(id)){
      await expect(page.getByRole("heading",{name:"Je me prépare",exact:true})).toBeVisible();
      await page.getByRole("button",{name:"Pendant",exact:true}).click();await settled(page);
      await expect(page.getByRole("heading",{name:"J’expérimente",exact:true})).toBeVisible();
      await expect(page.getByRole("heading",{name:"Ce que j’en retiens",exact:true})).toBeVisible();
      await page.getByRole("button",{name:"Entre les séances",exact:true}).click();await settled(page);
      for(const name of["Je comprends mieux","Ma progression","Ma prochaine expérimentation","Je fais le point"])await expect(page.getByRole("heading",{name,exact:true})).toBeVisible();
    }else await expect(page.getByRole("button",{name:"Pendant",exact:true})).toHaveCount(0);
    await page.getByRole("button",{name:"Sources de cette séance",exact:true}).click();
    await expect(page.getByRole("heading",{name:"D’où viennent ces contenus ?",exact:true})).toBeVisible();
  }
});

test("objectifs reformulés, trois défis maximum et expérimentation reprise sans duplication",async({page})=>{
  await page.goto("/");await page.getByRole("button",{name:"Ouvrir la démonstration",exact:true}).click();
  await nav(page,"Mes objectifs");
  await page.getByLabel("Ce que j’aimerais voir évoluer",{exact:true}).filter({visible:true}).fill("Trouver une façon de dire ce qui me convient.");
  await page.getByRole("button",{name:"Conserver mon objectif",exact:true}).click();
  await page.getByRole("button",{name:"Reformuler cet objectif",exact:true}).last().click();
  await page.getByLabel("Ma nouvelle formulation",{exact:true}).filter({visible:true}).fill("Exprimer une limite à ma façon.");
  await page.getByRole("button",{name:"Conserver la reformulation",exact:true}).click();
  await expect(page.getByText("Trouver une façon de dire ce qui me convient.",{exact:true}).first()).toBeVisible();
  for(const name of["Préparer une phrase","Prévoir une pause"]){await page.getByLabel("Le défi que je souhaite explorer",{exact:true}).filter({visible:true}).fill(name);await page.getByRole("button",{name:"Ajouter ce défi",exact:true}).click();}
  await page.getByLabel("Le défi que je souhaite explorer",{exact:true}).filter({visible:true}).fill("Un quatrième défi");
  await page.getByRole("button",{name:"Ajouter ce défi",exact:true}).click();await expect(page.getByRole("alert")).toContainText("Trois défis");
  await page.getByRole("button",{name:"Mettre de côté",exact:true}).first().click();await page.getByRole("button",{name:"Ajouter ce défi",exact:true}).click();
  await seance(page,2,"Entre les séances");await page.getByRole("button",{name:"Préparer mon petit pas",exact:true}).click();
  await expect(page.getByLabel("Qu’est-ce que je vais essayer ?",{exact:true}).filter({visible:true})).toHaveCount(2);
  await page.getByLabel("Qu’est-ce que je vais essayer ?",{exact:true}).filter({visible:true}).last().fill("Rédiger une invitation imaginaire.");
  await page.getByLabel("Où j’en suis avec cet essai",{exact:true}).filter({visible:true}).last().selectOption("pas d’occasion");
  await expect(page.getByLabel("Qu’est-ce que je vais essayer ?",{exact:true}).filter({visible:true}).last()).toHaveValue("Rédiger une invitation imaginaire.");
  await seance(page,3,"Entre les séances");
  await expect(page.getByLabel("Qu’est-ce que je vais essayer ?",{exact:true}).filter({visible:true})).toHaveValue("Rédiger une invitation imaginaire.");
  await expect(page.getByLabel("Qu’est-ce que je vais essayer ?",{exact:true}).filter({visible:true})).toHaveCount(1);
  await expect(page.getByLabel("Où j’en suis avec cet essai",{exact:true}).filter({visible:true})).toHaveValue("pas d’occasion");
});

test("compte réel : rafraîchissement verrouillé, autre navigateur et isolation entre comptes",async({page,browser})=>{
  const account=await register(page);await note(page,sentinel);
  const state=await apiState(page);expect(JSON.stringify(state)).not.toContain(sentinel);
  const cookies=await page.context().cookies();expect(cookies.find(c=>c.name==="carnet-session")?.httpOnly).toBe(true);
  expect(cookies.find(c=>c.name==="carnet-session")?.sameSite).toBe("Strict");
  await page.reload();await expect(page.getByRole("heading",{name:"Votre carnet est fermé",exact:true})).toBeVisible();await expect(page.getByText(sentinel,{exact:true})).toHaveCount(0);
  await page.getByLabel("Phrase de coffre",{exact:true}).filter({visible:true}).fill(phrase);await page.getByRole("button",{name:"Ouvrir mon coffre",exact:true}).click();await seance(page,1);
  await expect(page.getByLabel("Ma note personnelle · facultatif",{exact:true}).filter({visible:true})).toHaveValue(sentinel);
  const second=await browser.newContext();const p=await second.newPage();await login(p,account.pseudo);await seance(p,1);await expect(p.getByLabel("Ma note personnelle · facultatif",{exact:true}).filter({visible:true})).toHaveValue(sentinel);
  const other=await browser.newContext();const p2=await other.newPage();await register(p2);await seance(p2,1);await expect(p2.getByLabel("Ma note personnelle · facultatif",{exact:true}).filter({visible:true})).toHaveValue("");
  await second.close();await other.close();
  await page.getByRole("button",{name:"Masquer / verrouiller",exact:true}).click();await expect(page.getByText(sentinel,{exact:true})).toHaveCount(0);
  await page.locator('#compte-commande').click();await page.locator('#compte-options').getByRole("button",{name:"Me déconnecter",exact:true}).click();await expect(page.getByRole("button",{name:"Me connecter",exact:true})).toBeVisible();
});

test("hors connexion puis reprise, conflit entre appareils et résolution explicite",async({page,browser})=>{
  const account=await register(page);
  const second=await browser.newContext();const p=await second.newPage();await login(p,account.pseudo);
  await seance(page,1);await page.context().setOffline(true);
  await page.getByLabel("Ma note personnelle · facultatif",{exact:true}).filter({visible:true}).fill("Brouillon fictif hors connexion");
  await expect(page.locator(".save-status")).toContainText("Chiffré sur cet appareil");
  await nav(page,"Mon accueil");await seance(page,1);await expect(page.getByLabel("Ma note personnelle · facultatif",{exact:true}).filter({visible:true})).toHaveValue("Brouillon fictif hors connexion");
  await note(p,"Autre version fictive");
  await page.context().setOffline(false);
  await expect(page.getByRole("heading",{name:"Deux versions de votre carnet",exact:true})).toBeVisible({timeout:20000});
  await expect(page.getByLabel("Ma note personnelle · facultatif",{exact:true}).filter({visible:true})).toHaveValue("Brouillon fictif hors connexion");
  await page.getByRole("button",{name:"Conserver ma version comme nouvelle version",exact:true}).click();
  await page.getByRole("button",{name:"Remplacer explicitement la version serveur",exact:true}).click();await synced(page);
  const third=await browser.newContext();const p3=await third.newPage();await login(p3,account.pseudo);await seance(p3,1);await expect(p3.getByLabel("Ma note personnelle · facultatif",{exact:true}).filter({visible:true})).toHaveValue("Brouillon fictif hors connexion");
  await second.close();await third.close();
});

test("export chiffré et réimport réel, sélection lisible volontaire et présentation locale",async({page})=>{
  await register(page);await note(page,"La version que je veux conserver.");
  const exported=await backup(page);expect(JSON.stringify(exported)).not.toContain("La version que je veux conserver.");
  const key=await unlock(exported.keyring,phrase);const doc=unpack(await open(key,exported.envelope,exported.keyring.vault,"journal")) as any;
  expect(doc.notes["1-note"]).toBe("La version que je veux conserver.");
  await note(page,"Une autre version à remplacer.");
  await nav(page,"Mes réglages");
  await page.getByLabel("Phrase de la sauvegarde à importer",{exact:true}).filter({visible:true}).fill(phrase);
  await page.getByRole("button",{name:"Réimporter une sauvegarde",exact:true}).click();
  const chooser=page.waitForEvent("filechooser");await page.getByRole("button",{name:"Choisir et vérifier mon fichier chiffré",exact:true}).click();
  await(await chooser).setFiles({name:"sauvegarde-fictive.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(exported))});
  await expect(page.getByRole("button",{name:"Reprendre mon carnet",exact:true})).toBeVisible();await seance(page,1);await expect(page.getByLabel("Ma note personnelle · facultatif",{exact:true}).filter({visible:true})).toHaveValue("La version que je veux conserver.");
  await nav(page,"Mes repères");await page.getByRole("checkbox").first().check();
  await page.getByRole("button",{name:"Présenter ma sélection sur cet écran",exact:true}).click();await expect(page.getByRole("heading",{name:"Ma sélection",exact:true})).toBeVisible();await expect(page.getByRole("heading",{name:"Ma sélection",exact:true})).toBeFocused();
  await expect(page.getByRole("main")).toHaveCount(1);
  await page.getByRole("button",{name:"Quitter la présentation",exact:true}).click();
  await page.getByRole("button",{name:"Exporter ma sélection lisible",exact:true}).click();await expect(page.getByText(/Le fichier téléchargé ne sera pas chiffré/)).toBeVisible();
  const wait=page.waitForEvent("download");await page.getByRole("button",{name:"Générer le fichier lisible choisi",exact:true}).click();const path=await(await wait).path();expect(await readFile(path!,"utf8")).toContain("La version que je veux conserver.");await unlink(path!);
});

test("récupération du coffre sur navigateur vierge et changement de phrase",async({page,browser})=>{
  const account=await register(page);await note(page,"Une note fictive récupérable.");
  const other=await browser.newContext();const p=await other.newPage();await login(p,account.pseudo,account.vault,true);
  await seance(p,1);await expect(p.getByLabel("Ma note personnelle · facultatif",{exact:true}).filter({visible:true})).toHaveValue("Une note fictive récupérable.");
  await nav(p,"Mes réglages");await p.getByLabel("Ancienne phrase · ou secret du coffre si choisi",{exact:true}).filter({visible:true}).fill(phrase);
  const next="Une nouvelle phrase fictive pour ce coffre";await p.getByLabel("Nouvelle phrase de coffre",{exact:true}).filter({visible:true}).fill(next);await p.getByRole("button",{name:"Conserver la nouvelle phrase",exact:true}).click();await expect(p.getByText(/Nouvelle phrase conservée/)).toBeVisible();await synced(p);
  await p.getByRole("button",{name:"Masquer / verrouiller",exact:true}).click();await p.getByLabel("Phrase de coffre",{exact:true}).filter({visible:true}).fill(phrase);await p.getByRole("button",{name:"Ouvrir mon coffre",exact:true}).click();await expect(p.getByRole("alert")).toContainText("secret incorrect");
  await p.getByLabel("Phrase de coffre",{exact:true}).filter({visible:true}).fill(next);await p.getByRole("button",{name:"Ouvrir mon coffre",exact:true}).click();await expect(p.getByRole("button",{name:"Reprendre mon carnet",exact:true})).toBeVisible();
  await other.close();
});

test("images préparées localement, métadonnées retirées, format refusé et suppression du compte",async({page})=>{
  await register(page);await seance(page,1,"Pendant");await page.getByRole("button",{name:"4 · Garder une trace",exact:true}).click();
  const raw=Buffer.from(await page.evaluate(()=>{const c=document.createElement("canvas");c.width=16;c.height=16;const ctx=c.getContext("2d")!;ctx.fillStyle="#623451";ctx.fillRect(0,0,16,16);return c.toDataURL("image/png").split(",")[1];}),"base64");
  const chooser=page.waitForEvent("filechooser");await page.getByRole("button",{name:"Ajouter une photo du support papier",exact:true}).click();await(await chooser).setFiles({name:"nom-prive-fictif.png",mimeType:"image/png",buffer:raw});
  await expect(page.getByRole("img",{name:"Photo de ma production personnelle",exact:true})).toBeVisible();await synced(page);
  const exported=await backup(page);expect(JSON.stringify(exported)).not.toContain("nom-prive-fictif.png");
  const key=await unlock(exported.keyring,phrase);const image=await open(key,exported.images[0],exported.keyring.vault,exported.images[0].object);
  expect(image[0]).toBe(255);expect(image[1]).toBe(216);expect(Buffer.from(image).includes(Buffer.from("Exif\0\0"))).toBe(false);
  await seance(page,1,"Pendant");await page.getByRole("button",{name:"4 · Garder une trace",exact:true}).click();
  const bad=page.waitForEvent("filechooser");await page.getByRole("button",{name:"Ajouter une photo du support papier",exact:true}).click();await(await bad).setFiles({name:"interdit.svg",mimeType:"image/svg+xml",buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')});
  await expect(page.getByRole("alert")).toContainText("JPEG");
  await page.getByRole("button",{name:"Supprimer cette photo",exact:true}).click();await synced(page);
  await nav(page,"Mes réglages");await page.getByLabel("Mot de passe de connexion pour supprimer le compte",{exact:true}).filter({visible:true}).fill(password);
  await page.getByRole("button",{name:"Demander la suppression du compte",exact:true}).click();await page.getByRole("button",{name:"Supprimer définitivement mon compte",exact:true}).click();
  await expect(page.getByRole("button",{name:"Créer mon compte",exact:true})).toBeVisible();
});

test("sentinelle absente du réseau et du stockage, texte XSS inerte et URL neutre",async({page})=>{
  const requests:string[]=[];const errors:string[]=[];
  page.on("request",r=>requests.push(r.url()+" "+(r.postData()||"")));
  page.on("console",m=>errors.push(m.text()));
  await register(page);
  requests.length=0;await note(page,sentinel);
  await page.getByLabel("Ma question pour la séance · facultatif",{exact:true}).filter({visible:true}).fill('<img src=x onerror="window.injectionCarnet=true">');await synced(page);
  await seance(page,10);await expect(page.getByRole("heading",{name:"Sexualité et intimité",exact:true})).toBeVisible();
  expect(requests.join(" ")).not.toContain(sentinel);expect(requests.join(" ")).not.toContain("sexualite");expect(requests.join(" ")).not.toContain("seance=10");
  expect(errors.join(" ")).not.toContain(sentinel);expect(new URL(page.url()).pathname).toBe("/");
  expect(await page.evaluate(()=>Boolean((window as any).injectionCarnet))).toBe(false);
  const stored=await page.evaluate(async()=>{
    const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open("mon-carnet-encrypted-v1");r.onsuccess=()=>resolve(r.result);});
    const values=await new Promise<any[]>(resolve=>{const r=db.transaction("sealed").objectStore("sealed").getAll();r.onsuccess=()=>resolve(r.result);});
    return JSON.stringify({values,local: {...localStorage},session: {...sessionStorage}});
  });
  expect(stored).not.toContain(sentinel);expect(stored).not.toContain(phrase);expect(stored).not.toContain(password);
});

test("accessibilité axe, clavier, réduction des mouvements, mode sobre et reflow",async({page})=>{
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.goto("/");await page.getByRole("button",{name:"Ouvrir la démonstration",exact:true}).click();
  for(const name of["Mon accueil","Mes objectifs","Mes repères","Mes réglages"]){
    await nav(page,name);
    const results=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa"]).analyze();
    expect(results.violations.map(v=>({id:v.id,nodes:v.nodes.length}))).toEqual([]);
  }
  await seance(page,1,"Pendant");
  expect((await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa"]).analyze()).violations).toEqual([]);
  await nav(page,"Mes réglages");
  await page.getByLabel("Présentation",{exact:true}).filter({visible:true}).selectOption("oui");
  await page.getByLabel("Animations",{exact:true}).filter({visible:true}).selectOption("non");
  await page.getByLabel("Taille du texte",{exact:true}).filter({visible:true}).selectOption("grand");
  await page.setViewportSize({width:360,height:800});
  await seance(page,4);await expect(page.locator("#titre-capsule-4")).toContainText("Faire évoluer une relation");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.keyboard.press("Tab");const focus=await page.evaluate(()=>document.activeElement?.tagName);expect(focus).not.toBe("BODY");
});

test("import altéré et JSON malformé refusés sans remplacer la note",async({page})=>{
  await register(page);await note(page,"Version fictive à garder malgré le refus.");
  const exported=await backup(page);
  for(const buffer of [Buffer.from('{"version":'),Buffer.from(JSON.stringify({...exported,envelope:{...exported.envelope,ct:exported.envelope.ct.replace(/^./,exported.envelope.ct[0]==="A"?"B":"A")}}))]){
    await page.getByLabel("Phrase de la sauvegarde à importer",{exact:true}).filter({visible:true}).fill(phrase);
    await page.getByRole("button",{name:"Réimporter une sauvegarde",exact:true}).click();
    const choice=page.waitForEvent("filechooser");await page.getByRole("button",{name:"Choisir et vérifier mon fichier chiffré",exact:true}).click();
    await(await choice).setFiles({name:"fichier-invalide.json",mimeType:"application/json",buffer});
    await expect(page.getByRole("alert")).toBeVisible();
    await seance(page,1);await expect(page.getByLabel("Ma note personnelle · facultatif",{exact:true}).filter({visible:true})).toHaveValue("Version fictive à garder malgré le refus.");
    await nav(page,"Mes réglages");
  }
});

test("retour navigateur fermé, récupération du compte et nouveau coffre préservant l’ancien",async({page})=>{
  const account=await register(page);await note(page,"Ancien coffre fictif préservé.");
  await page.goto("/favicon.svg");await page.goBack();
  await expect(page.getByRole("heading",{name:"Votre carnet est fermé",exact:true})).toBeVisible();
  await page.locator('#compte-commande').click();await page.locator('#compte-options').getByRole("button",{name:"Me déconnecter",exact:true}).click();
  await page.getByRole("button",{name:"Me connecter",exact:true}).click();
  await page.getByRole("button",{name:"J’ai oublié mon mot de passe de connexion",exact:true}).click();
  await page.getByLabel("Identifiant pseudonyme",{exact:true}).filter({visible:true}).fill(account.pseudo);
  await page.getByLabel("Nouveau mot de passe de connexion",{exact:true}).filter({visible:true}).fill("Un_nouveau_mot_de_passe_fictif_2026");
  await page.getByLabel("Code de récupération du compte · partie 1 du kit",{exact:true}).filter({visible:true}).fill(account.auth);
  await page.getByRole("button",{name:"Changer le mot de passe de connexion",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Votre carnet est fermé",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Je n’ai plus ma phrase ni mon kit",exact:true}).click();
  await page.getByLabel("Phrase du nouveau coffre",{exact:true}).filter({visible:true}).fill("La phrase fictive du tout nouveau coffre");
  await page.getByRole("button",{name:"Créer un nouveau coffre sans effacer l’ancien",exact:true}).click();
  await expect(page.getByRole("button",{name:"Reprendre mon carnet",exact:true})).toBeVisible();
  await seance(page,1);await expect(page.getByLabel("Ma note personnelle · facultatif",{exact:true}).filter({visible:true})).toHaveValue("");
  await nav(page,"Mes réglages");const wait=page.waitForEvent("download");await page.getByRole("button",{name:"Exporter les anciens coffres verrouillés",exact:true}).click();
  const path=await(await wait).path();const old=JSON.parse(await readFile(path!,"utf8"));await unlink(path!);
  const doc=unpack(await open(await unlock(old.keyring,phrase),old.envelope,old.keyring.vault,"journal")) as any;
  expect(doc.notes["1-note"]).toBe("Ancien coffre fictif préservé.");
});

test("verrouillage automatique averti, reprise et changement de largeur",async({page})=>{
  await page.clock.install();
  await page.goto("/");await page.getByRole("button",{name:"Ouvrir la démonstration",exact:true}).click();
  await nav(page,"Mes réglages");await page.getByLabel("Verrouillage après une période sans action",{exact:true}).filter({visible:true}).selectOption("5");
  await page.clock.runFor(1000);await expect(page.locator(".save-status")).toContainText("Chiffré sur cet appareil");
  await page.clock.runFor(275000);await expect(page.getByText(/Le carnet se verrouillera dans moins de 30 secondes/)).toBeVisible();
  await page.keyboard.press("Tab");await expect(page.getByText(/Le carnet se verrouillera dans moins de 30 secondes/)).toHaveCount(0);
  await page.clock.runFor(305000);await expect(page.getByRole("heading",{name:"Votre carnet est fermé",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Reprendre la démonstration",exact:true}).click();
  await expect(page.getByRole("button",{name:"Reprendre mon carnet",exact:true})).toBeVisible();
  for(const width of[430,768,390]){await page.setViewportSize({width,height:500});await nav(page,"Mon parcours");expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);}
});

test("classeur : feuilles distinctes, capsule à sa place et voisins repoussés",async({page})=>{
  await page.emulateMedia({reducedMotion:"no-preference"});
  await page.goto("/");await page.getByRole("button",{name:"Ouvrir la démonstration",exact:true}).click();await nav(page,"Mon parcours");
  await expect(page.getByRole("tab")).toHaveCount(3);await expect(page.getByRole("tabpanel")).toHaveCount(1);
  await expect(page.locator('.capsule[data-nature="chapitre"] .capsule-ouvrir')).toHaveCount(12);
  await expect(page.locator('.capsule[data-nature="bilan"] .capsule-ouvrir')).toHaveCount(3);
  await expect(page.getByRole("button",{name:"Ouvrir cette capsule",exact:true})).toHaveCount(0);
  for(const width of [360,390,1440]){
    await page.setViewportSize({width,height:900});await expect(page.locator(".classeur")).toHaveCSS("padding-left",width<600?"12px":"38px");await page.evaluate(()=>scrollTo(0,0));
    const joined=await page.evaluate(()=>{
      const tabs=[...document.querySelectorAll<HTMLElement>('[role=tab]')],selected=tabs.find(t=>t.getAttribute('aria-selected')==='true')!;
      const paper=document.querySelector<HTMLElement>('.classeur-papier')!;
      return {tops:tabs.map(t=>t.getBoundingClientRect().top),gap:paper.getBoundingClientRect().top-selected.getBoundingClientRect().bottom,border:getComputedStyle(selected).borderBottomColor,paper:getComputedStyle(paper).backgroundColor,width:document.documentElement.scrollWidth};
    });
    expect(new Set(joined.tops).size).toBe(1);expect(Math.abs(joined.gap)).toBeLessThan(2);
    expect(joined.border).toBe(joined.paper);expect(joined.width).toBeLessThanOrEqual(width+1);
  }
  await page.setViewportSize({width:1440,height:1000});
  // Observe the native expansion at a comfortable duration. No clock seeking,
  // no simulated application state, and no fixed short sampling interval.
  await page.addStyleTag({content:".capsule-corps, .capsule-titre, .capsule-zoom, .classeur-feuille { transition-duration: 2s !important; transition-timing-function: linear !important; }"});
  const motion=await page.evaluate(()=>new Promise<{middle:number,displacement:number,growth:number,sameTitle:boolean,sameField:boolean,scale:number}>(resolve=>{
    const one=document.querySelector<HTMLElement>('#capsule-1')!,two=document.querySelector<HTMLElement>('#capsule-2')!;
    const title=one.querySelector('.capsule-titre'),field=one.querySelector('textarea'),body=one.querySelector<HTMLElement>('.capsule-corps')!;
    const baseline={height:one.getBoundingClientRect().height,next:two.getBoundingClientRect().top+scrollY};
    (one.querySelector('.capsule-ouvrir') as HTMLElement).click();
    function sample(){
      const animation=body.getAnimations().find(a=>"transitionProperty" in a && a.transitionProperty==="grid-template-rows");
      const progress=animation?.effect?.getComputedTiming().progress;
      if(typeof progress==="number" && progress>.2 && progress<.8){
        resolve({middle:body.getBoundingClientRect().height,displacement:two.getBoundingClientRect().top+scrollY-baseline.next,growth:one.getBoundingClientRect().height-baseline.height,sameTitle:title===one.querySelector('.capsule-titre'),sameField:field!==null&&field===one.querySelector('textarea'),scale:Number(getComputedStyle(one.querySelector('.capsule-zoom')!).scale)});
      }else requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  }));
  expect(motion.middle).toBeGreaterThan(20);expect(motion.displacement).toBeGreaterThan(20);
  expect(Math.abs(motion.displacement-motion.growth)).toBeLessThan(2);expect(motion.sameTitle).toBe(true);expect(motion.sameField).toBe(true);expect(motion.scale).toBeGreaterThan(.88);expect(motion.scale).toBeLessThan(1);
  await expect(page.getByRole("tab",{name:"Mon parcours",exact:true})).toHaveAttribute("aria-selected","true");
  await expect(page.locator('#titre-page')).toHaveAttribute("data-panel","Mon parcours");await settled(page);
  const full=await page.locator('#corps-capsule-1').evaluate(e=>e.getBoundingClientRect().height);expect(full).toBeGreaterThan(motion.middle);
  await page.evaluate(()=>scrollTo(0,900));
  await expect.poll(()=>page.locator("#plan-carnet").evaluate(e=>e.getBoundingClientRect().top)).toBeLessThan(20);
  await page.locator('#capsule-1 .capsule-ouvrir').click();await expect(page.locator('#capsule-1 .capsule-ouvrir')).toHaveAttribute("aria-expanded","false");await settled(page);
  expect(await page.locator('#corps-capsule-1').evaluate(e=>e.getBoundingClientRect().height)).toBe(0);
  await expect(page.getByLabel("Ma note personnelle · facultatif",{exact:true}).filter({visible:true})).toHaveCount(0);
  // A quick change of mind before preparation finishes must leave no phantom
  // movement. Reopening during a real collapse also keeps the same capsule.
  await page.locator('#capsule-1 .capsule-ouvrir').click();
  await expect(page.locator('#capsule-1 .capsule-ouvrir')).toHaveAttribute("aria-expanded","true");await settled(page);
  await page.evaluate(()=>new Promise<void>(resolve=>{
    const button=document.querySelector<HTMLButtonElement>('#capsule-1 .capsule-ouvrir')!;
    const observer=new MutationObserver(()=>{if(button.getAttribute('aria-expanded')==='false'){observer.disconnect();button.click();resolve();}});
    observer.observe(button,{attributes:true,attributeFilter:['aria-expanded']});button.click();
  }));
  await expect(page.locator('#capsule-1 .capsule-ouvrir')).toHaveAttribute("aria-expanded","true");await settled(page);
  const closingHeight=await page.evaluate(()=>new Promise<number>(resolve=>{
    const body=document.querySelector<HTMLElement>('#corps-capsule-1')!;
    (document.querySelector('#capsule-1 .capsule-ouvrir') as HTMLElement).click();
    function sample(){
      const animation=body.getAnimations().find(a=>"transitionProperty" in a && a.transitionProperty==="grid-template-rows");
      const progress=animation?.effect?.getComputedTiming().progress;
      if(typeof progress==="number" && progress>.2 && progress<.8){const height=body.getBoundingClientRect().height;(document.querySelector('#capsule-1 .capsule-ouvrir') as HTMLElement).click();resolve(height);}
      else requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  }));
  await expect(page.locator('#capsule-1 .capsule-ouvrir')).toHaveAttribute("aria-expanded","true");await settled(page);
  expect(await page.locator('#corps-capsule-1').evaluate(e=>e.getBoundingClientRect().height)).toBeGreaterThan(closingHeight);
  await expect(page.getByLabel("Ma note personnelle · facultatif",{exact:true}).filter({visible:true})).toBeVisible();
  await page.locator('#compte-commande').click();
  await expect(page.getByRole("navigation",{name:"Compte et site",exact:true})).toBeVisible();
  await page.keyboard.press("Escape");await expect(page.locator('#compte-commande')).toBeFocused();
  await expect(page.locator('#compte-commande')).toHaveAttribute('aria-expanded','false');
  // The tab list is a real keyboard-operated binder, with one selected sheet.
  await page.getByRole("tab",{name:"Mon parcours",exact:true}).focus();await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab",{name:"Mes objectifs",exact:true})).toBeFocused();
  const fade=await page.locator('#titre-page').evaluate(el=>new Promise<{opacity:number,rotate:string,transform:string,properties:string}>(resolve=>{
    function sample(){
      const a=el.getAnimations().find(a=>"transitionProperty" in a&&a.transitionProperty==='opacity'),progress=a?.effect?.getComputedTiming().progress;
      if(typeof progress==='number'&&progress>.2&&progress<.8){const style=getComputedStyle(el);resolve({opacity:Number(style.opacity),rotate:style.rotate,transform:style.transform,properties:style.transitionProperty});}
      else requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  }));
  expect(fade.opacity).toBeGreaterThan(0);expect(fade.opacity).toBeLessThan(1);expect(fade.rotate).toBe('none');expect(fade.transform).toBe('none');expect(fade.properties).toBe('opacity');
  // A browser cancellation has no transitionend. It must still release the sheet.
  await page.locator('.classeur-feuilles').evaluate(el=>el.getAnimations({subtree:true}).forEach(animation=>animation.cancel()));
  await settled(page);
  await expect(page.getByRole("tabpanel")).toHaveCount(1);await expect(page.locator('#titre-page')).toHaveAttribute("data-panel","Mes objectifs");
  await page.keyboard.press("Home");await expect(page.getByRole("tab",{name:"Mon parcours",exact:true})).toBeFocused();await settled(page);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

test("continuité : retour au même moment, écrits et reformulation en cours conservés",async({page})=>{
  await page.goto("/");await page.getByRole("button",{name:"Ouvrir la démonstration",exact:true}).click();
  await seance(page,1);
  await page.getByLabel("Ma note personnelle · facultatif",{exact:true}).filter({visible:true}).fill("Une note fictive conservée pendant les déplacements.");
  await page.getByRole("button",{name:"Entre les séances",exact:true}).click();await settled(page);
  await page.getByRole("button",{name:"Retrouver mes objectifs et mes défis",exact:true}).click();await settled(page);
  await page.getByRole("button",{name:"Reformuler cet objectif",exact:true}).click();
  await page.getByLabel("Ma nouvelle formulation",{exact:true}).filter({visible:true}).fill("Ma reformulation fictive encore en cours.");
  await nav(page,"Mes réglages");await expect(page.getByRole("tab")).toHaveCount(0);await expect(page.getByRole("tabpanel")).toHaveCount(0);
  await page.getByRole("button",{name:"Revenir au carnet",exact:true}).click();await expect(page.locator('#titre-page')).toHaveAttribute('data-panel','Mes objectifs');await settled(page);
  await expect(page.getByLabel("Ma nouvelle formulation",{exact:true}).filter({visible:true})).toHaveValue("Ma reformulation fictive encore en cours.");
  await nav(page,"Mes repères");await nav(page,"Mon parcours");
  await expect(page.getByRole("button",{name:"Entre les séances",exact:true})).toHaveAttribute("aria-pressed","true");
  await expect.poll(()=>page.locator('#titre-capsule-1').evaluate(el=>el.getBoundingClientRect().top-document.querySelector('.classeur-navigation')!.getBoundingClientRect().bottom)).toBeGreaterThanOrEqual(0);
  await nav(page,"Mes objectifs");
  await expect(page.getByLabel("Ma nouvelle formulation",{exact:true}).filter({visible:true})).toHaveValue("Ma reformulation fictive encore en cours.");
  await page.getByRole("button",{name:"Revenir à la séance 1 · Entre les séances",exact:true}).click();await settled(page);
  await expect(page.getByRole("button",{name:"Entre les séances",exact:true})).toHaveAttribute("aria-pressed","true");
  await expect(page.getByRole("heading",{name:"Je comprends mieux",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Avant",exact:true}).click();await settled(page);
  await expect(page.getByLabel("Ma note personnelle · facultatif",{exact:true}).filter({visible:true})).toHaveValue("Une note fictive conservée pendant les déplacements.");
  await page.getByRole("button",{name:"Retrouver les onglets",exact:true}).click();
  await expect(page.locator('#plan-carnet')).toBeFocused();
});

test("continuité : réduction dynamique, préférence sauvegardée et verrouillage immédiat",async({page})=>{
  await page.emulateMedia({reducedMotion:"no-preference"});
  await page.goto("/");await page.getByRole("button",{name:"Ouvrir la démonstration",exact:true}).click();await settled(page);await nav(page,"Mon parcours");
  await page.getByRole("tab",{name:"Mes objectifs",exact:true}).evaluate((button:HTMLButtonElement)=>button.click());
  await expect(page.locator('[data-moving="true"]')).toHaveCount(1);
  await page.emulateMedia({reducedMotion:"reduce"});await settled(page);
  await expect.poll(()=>page.locator('#titre-page').evaluate(el=>{const r=el.getBoundingClientRect(),p=el.parentElement!.getBoundingClientRect();return[r.x-p.x,r.y-p.y];})).toEqual([0,0]);
  await page.emulateMedia({reducedMotion:"no-preference"});
  await nav(page,"Mes réglages");await page.getByLabel("Animations",{exact:true}).filter({visible:true}).selectOption("non");
  await nav(page,"Mon parcours");await expect.poll(()=>page.locator('#titre-page').evaluate(el=>{const r=el.getBoundingClientRect(),p=el.parentElement!.getBoundingClientRect();return[r.x-p.x,r.y-p.y];})).toEqual([0,0]);
  await expect(page.locator('[data-moving="true"]')).toHaveCount(0);
  await expect(page.locator(".save-status")).toContainText("Chiffré sur cet appareil");
  await page.reload();await page.getByRole("button",{name:"Ouvrir la démonstration",exact:true}).click();await settled(page);
  await nav(page,"Mes réglages");await expect(page.getByLabel("Animations",{exact:true}).filter({visible:true})).toHaveValue("non");
  await page.getByLabel("Animations",{exact:true}).filter({visible:true}).selectOption("oui");await nav(page,"Mon parcours");
  await page.getByRole("tab",{name:"Mes objectifs",exact:true}).evaluate((button:HTMLButtonElement)=>button.click());
  await expect(page.locator('[data-moving="true"]')).toHaveCount(1);
  await page.getByRole("button",{name:"Masquer / verrouiller",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Votre carnet est fermé",exact:true})).toBeVisible();
  await expect(page.locator('.classeur-feuilles')).toHaveCount(0);
  await expect(page.getByText("Construire des relations où je peux être moi-même.",{exact:true})).toHaveCount(0);
});

for(const size of[360,390,430,768,1440]){
  test("rendu de référence "+size+" pixels : accueil et titre long",async({page},testInfo)=>{
    await page.setViewportSize({width:size,height:900});await page.goto("/");await page.getByRole("button",{name:"Ouvrir la démonstration",exact:true}).click();
    await expect(page.locator(".save-status")).toContainText("Chiffré sur cet appareil");
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await page.screenshot({path:"docs/captures/"+testInfo.project.name+"-accueil-"+size+".png",fullPage:true});
    await seance(page,4);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await page.screenshot({path:"docs/captures/"+testInfo.project.name+"-chapitre-"+size+".png",fullPage:true});
    await page.evaluate(()=>scrollTo(0,0));
    await expect(page).toHaveScreenshot("chapitre-"+size+".png",{fullPage:true,maxDiffPixelRatio:0.01});
  });
}
