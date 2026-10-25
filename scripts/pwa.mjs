import { createHash } from 'node:crypto';
import { readFile,writeFile,copyFile } from 'node:fs/promises';
export async function pwa(catalogue) {
 await copyFile('frontend/manifest.webmanifest','dist/manifest.webmanifest');
 for(const size of [192,512]) await copyFile(`frontend/icon-${size}.png`,`dist/icon-${size}.png`);
 const assets=['/','/index.html','/elm.js','/bridge.js','/worker.js','/carnet.css','/catalogue.json','/favicon.svg','/manifest.webmanifest','/icon-192.png','/icon-512.png','/sondage.html','/sondage.js',...catalogue.chapitres.flatMap(c=>[`/cours/${c.id}.html`,`/cours/${c.id}.pdf`])];
 const hash=createHash('sha256');for(const asset of assets) hash.update(await readFile('dist/'+(asset==='/'?'index.html':asset.slice(1))));
 const version='etp-shell-'+hash.digest('hex').slice(0,20);
 await writeFile('dist/sw.js', `/* Cache only the explicit public application shell. Never API, secrets or QR replies. */
const CACHE=${JSON.stringify(version)},ASSETS=${JSON.stringify(assets)};
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(CACHE);await cache.addAll(ASSETS);})()));
// No skipWaiting: an open vault keeps its application version until every tab closes.
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith('etp-shell-')&&name!==CACHE)await caches.delete(name);await self.clients.claim();})()));
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin||url.search||!ASSETS.includes(url.pathname))return;event.respondWith((async()=>{const cached=await caches.match(event.request,{cacheName:CACHE});return cached||fetch(event.request);})());});
`);
}
