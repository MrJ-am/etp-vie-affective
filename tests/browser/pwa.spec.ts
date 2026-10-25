import {test,expect,type Page,type BrowserContext} from '@playwright/test';
import {build} from 'esbuild';
import {readFile} from 'node:fs/promises';
const qrDecoder = (await build({stdin:{contents:"import jsQR from 'jsqr'; globalThis.decodeETPQr = selector => { const c=document.querySelector(selector), p=c.getContext('2d').getImageData(0,0,c.width,c.height); const result=jsQR(p.data,p.width,p.height,{inversionAttempts:'attemptBoth'}); if(!result) throw Error('QR illisible'); return result.data; };",resolveDir:process.cwd()},bundle:true,write:false,format:'iife'})).outputFiles[0].text;
async function decodeQR(page:Page,selector:string){
 await page.route('**/qr-verification.js',route=>route.fulfill({contentType:'text/javascript',body:qrDecoder}));
 await page.addScriptTag({url:'/qr-verification.js'});
 return page.evaluate((target:string)=>(window as any).decodeETPQr(target) as string,selector);
}
async function outage(context:BrowserContext,browserName:string,enabled:boolean){
 if(browserName==='webkit')await context.setExtraHTTPHeaders(enabled?{'X-ETP-Test-Offline':'1'}:{});
 else await context.setOffline(enabled);
}
const phrase='Une phrase privée du coffre pour la fixture';
async function demo(page:Page){await page.goto('/');await page.getByRole('button',{name:'Ouvrir la démonstration',exact:true}).click();await expect(page.getByRole('tab',{name:'Mon parcours',exact:true})).toBeVisible();}
async function open(page:Page,id:number){await page.locator(`#capsule-${id} .capsule-ouvrir`).click();await expect(page.locator(`#capsule-${id} .capsule-ouvrir`)).toHaveAttribute('aria-expanded','true');await expect(page.locator('[data-moving="true"]')).toHaveCount(0);}
test('Parcours : séances grisées, prochaine limitée à la préparation, deux temps et supports',async({page})=>{
 await demo(page);
 await expect(page.locator('.capsule')).toHaveCount(15);
 await expect(page.locator('#capsule-3')).toHaveClass(/capsule-indisponible/);
 await expect(page.locator('#capsule-3 .capsule-ouvrir')).toHaveCount(0);
 await open(page,2);
 const next=page.locator('#capsule-2');
 await expect(next.getByRole('tab')).toHaveCount(0);
 await expect(next.getByText('Le contenu Pendant la séance sera disponible lorsque vous commencerez cette séance.')).toBeVisible();
 await expect(next.getByRole('link',{name:'Lire le support de préparation en HTML'})).toHaveAttribute('href','/cours/2.html');
 await expect(next.getByRole('link',{name:'Télécharger le support en PDF'})).toHaveAttribute('href','/cours/2.pdf');
 await next.getByRole('button',{name:'Commencer cette séance',exact:true}).click();
 await expect(next.getByRole('tab')).toHaveText(['Se préparer','Pendant la séance']);
 await next.getByRole('tab',{name:'Se préparer',exact:true}).focus();await page.keyboard.press('End');
 await expect(next.getByRole('tab',{name:'Pendant la séance',exact:true})).toHaveAttribute('aria-selected','true');
 await page.keyboard.press('ArrowRight');await expect(next.getByRole('tab',{name:'Se préparer',exact:true})).toHaveAttribute('aria-selected','true');
 await expect(page.locator('#capsule-3')).not.toHaveClass(/capsule-indisponible/);
 await expect(page.getByRole('tab',{name:'Après',exact:true})).toHaveCount(0);
 await next.getByRole('tab',{name:'Pendant la séance',exact:true}).click();
 await expect(next.getByRole('link',{name:'Participer à un sondage local ou en animer un'})).toBeVisible();
});
test('PWA : rechargement en mode avion, supports et sondages disponibles, API jamais en cache',async({page,context,browserName})=>{
 await demo(page);await expect(page.getByText('Application et supports disponibles hors ligne sur cet appareil.')).toBeVisible({timeout:30000});
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
 await page.reload();await expect(page.getByRole('button',{name:'Ouvrir la démonstration',exact:true})).toBeVisible();
 await outage(context,browserName,true);await page.reload();await page.getByRole('button',{name:'Ouvrir la démonstration',exact:true}).click();await open(page,1);
 await page.goto('/cours/1.html');await expect(page.getByRole('link',{name:'Télécharger en PDF'})).toBeVisible();
 const stored=await page.evaluate(async()=>{const names=await caches.keys();const urls:string[]=[];for(const n of names)for(const r of await (await caches.open(n)).keys())urls.push(new URL(r.url).pathname);return urls;});
 expect(stored.some(s=>s.startsWith('/api/'))).toBe(false);expect(stored).toContain('/cours/14.pdf');
 await page.goto('/sondage.html');await page.getByRole('button',{name:'Créer le sondage et afficher son QR'}).click();await expect(page.locator('#host canvas')).toBeVisible();
});
test('Compte : coffre rouvert après rechargement hors ligne et brouillon conservé chiffré',async({page,context,browserName})=>{
 test.setTimeout(90000);
 await page.goto('/');await page.getByRole('button',{name:'Créer mon compte',exact:true}).click();
 await page.getByRole('textbox',{name:'Identifiant pseudonyme',exact:true}).fill('pwa_'+crypto.randomUUID().slice(0,8));
 await page.getByLabel('Mot de passe de connexion',{exact:true}).filter({visible:true}).fill('Mot_de_passe_fictif_2026');
 await page.getByLabel('Phrase de coffre · 12 caractères minimum',{exact:true}).filter({visible:true}).fill(phrase);
 await page.getByLabel('Confirmer la phrase de coffre',{exact:true}).filter({visible:true}).fill(phrase);
 await page.getByRole('checkbox',{name:'Je n’utilise que des données fictives pour ce prototype.',exact:true}).check();
 await page.getByRole('button',{name:'Créer mon compte et mon coffre',exact:true}).click();
 await expect(page.getByRole('tab',{name:'Mon parcours',exact:true})).toBeVisible({timeout:45000});
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Télécharger mon kit',exact:true}).click();await download;
 await page.getByRole('button',{name:'J’ai conservé mon kit',exact:true}).click();await open(page,1);
 await expect(page.getByText('Application et supports disponibles hors ligne sur cet appareil.')).toBeVisible();
 await outage(context,browserName,true);
 await page.getByLabel('Ma note personnelle · facultatif',{exact:true}).filter({visible:true}).fill('SENTINEL_OFFLINE_FICTIVE_2026');
 await expect(page.locator('.save-status')).toContainText('attente',{timeout:10000});
 await page.reload();await expect(page.getByRole('heading',{name:'Votre carnet est fermé',exact:true})).toBeVisible();
 await page.getByLabel('Phrase de coffre',{exact:true}).filter({visible:true}).fill(phrase);await page.getByRole('button',{name:'Ouvrir mon coffre',exact:true}).click();
 await expect(page.getByRole('tab',{name:'Mon parcours',exact:true})).toBeVisible();await open(page,1);
 await expect(page.getByLabel('Ma note personnelle · facultatif',{exact:true}).filter({visible:true})).toHaveValue('SENTINEL_OFFLINE_FICTIVE_2026');
 const stored=await page.evaluate(()=>new Promise<string>((resolve,reject)=>{const r=indexedDB.open('mon-carnet-encrypted-v1',1);r.onsuccess=()=>{const tx=r.result.transaction('sealed');const all=tx.objectStore('sealed').getAll();all.onsuccess=()=>resolve(JSON.stringify(all.result));all.onerror=reject;};r.onerror=reject;}));
 expect(stored).not.toContain('SENTINEL_OFFLINE_FICTIVE_2026');
 await outage(context,browserName,false);await expect(page.locator('.save-status')).toContainText('Synchronisé',{timeout:30000});
});
test('Sondage QR : QR décodables et échange complet par fichiers chiffrés, rejeu refusé, aucun appel API',async({browser})=>{
 const hostContext=await browser.newContext({serviceWorkers:"block"});const participantContext=await browser.newContext({serviceWorkers:"block"});
 const host=await hostContext.newPage(),participant=await participantContext.newPage();
 let apiRequests=0;for(const page of [host,participant])page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))apiRequests++;});
 await host.goto('/sondage.html');await participant.goto('/sondage.html');
 await host.getByRole('button',{name:'Créer le sondage et afficher son QR'}).click();
 const pollDownload=host.waitForEvent('download');await host.getByText('Échange par fichier si la caméra ne fonctionne pas').click();await host.getByRole('button',{name:'Télécharger le sondage public'}).click();const file=await pollDownload;expect(JSON.parse(await decodeQR(host,'#host canvas'))).toEqual(JSON.parse(await readFile((await file.path())!,'utf8')));
 await participant.locator('#import').setInputFiles((await file.path())!);
 await participant.getByRole('button',{name:'Partager : À l’aise',exact:true}).click();await expect(participant.locator('#participant canvas')).toBeVisible();
 const replyDownload=participant.waitForEvent('download');await participant.getByText('Échange par fichier si la caméra ne fonctionne pas').click();await participant.getByRole('button',{name:'Télécharger ma réponse chiffrée'}).click();const reply=await replyDownload;expect(JSON.parse(await decodeQR(participant,'#participant canvas'))).toEqual(JSON.parse(await readFile((await reply.path())!,'utf8')));
 await host.locator('#import').setInputFiles((await reply.path())!);await expect(host.locator('#results')).toContainText('À l’aise : 1');
 await host.locator('#import').setInputFiles((await reply.path())!);await expect(host.locator('#status')).toContainText('déjà été reçue');
 expect(apiRequests).toBe(0);
 await host.getByRole('button',{name:'Terminer et effacer les résultats'}).click();await expect(host.locator('#results')).toBeEmpty();
 await hostContext.close();await participantContext.close();
});
