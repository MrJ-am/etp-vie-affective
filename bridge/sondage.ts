import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { createPoll, answer, receive, validatePoll, type Poll, type Reply } from './poll-crypto';
let host:Awaited<ReturnType<typeof createPoll>>|null=null;
let lastReply:Reply|null=null;
const seen=new Set<string>();let counts:number[]=[];let scanEpoch=0;let scanFrame=0;
const element=(id:string)=>document.getElementById(id)!;
const status=(s:string)=>{element('status').textContent=s;};
function button(id:string,fn:()=>Promise<void>|void){element(id).addEventListener('click',()=>Promise.resolve().then(fn).catch(e=>status(e instanceof Error?e.message:'Opération impossible.')));}
function stop(){scanEpoch++;cancelAnimationFrame(scanFrame);const v=element('camera') as HTMLVideoElement;(v.srcObject as MediaStream|null)?.getTracks().forEach(t=>t.stop());v.srcObject=null;v.hidden=true;element('stop').hidden=true;}
async function qr(target:HTMLElement,value:unknown){const canvas=document.createElement('canvas');await QRCode.toCanvas(canvas,JSON.stringify(value),{scale:8,margin:4,errorCorrectionLevel:'M'});canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Code QR à scanner sur cet écran');target.replaceChildren(canvas);}
function renderResults(){if(!host)return;element('results').replaceChildren(...host.poll.options.map((o,i)=>{const p=document.createElement('p');p.textContent=o+' : '+counts[i];return p;}));}
async function accept(text:string){
 if(text.length>5000)throw Error('Code trop grand.');const value=JSON.parse(text);
 if(value.kind==='etp-poll'){
  validatePoll(value);lastReply=null;const poll:Poll=value;const area=element('participant');area.replaceChildren();const title=document.createElement('h3');title.textContent=poll.question;area.append(title);
  poll.options.forEach((label,i)=>{const b=document.createElement('button');b.textContent='Partager : '+label;b.onclick=()=>{void (async()=>{lastReply=await answer(poll,i);await qr(area,lastReply);status('Montrez ce QR à l’animateur. Vous partagez uniquement le choix sélectionné.');})().catch(e=>status(e.message));};area.append(b);});
  status('Vérifiez que la question correspond au sondage présenté par l’animateur.');
 }else{
  if(!host)throw Error('Créez d’abord un sondage.');const reply=await receive(host.poll,host.privateKey,value);
  if(seen.has(reply.id)){status('Cette réponse a déjà été reçue.');return;}seen.add(reply.id);counts[reply.choice]++;renderResults();status('Réponse reçue et déchiffrée sur cet appareil.');
 }
}
async function scan(){
 stop();const run=scanEpoch;const video=element('camera') as HTMLVideoElement;
 video.hidden=false;element('stop').hidden=false;status('Caméra active : cadrez le QR.');
 try {
  const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
  if(run!==scanEpoch){stream.getTracks().forEach(t=>t.stop());return;}
  video.srcObject=stream;await video.play();
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});
  if(!ctx)throw Error('Lecture de la caméra indisponible.');
  let previous=0;
  const frame=(time:number)=>{
   if(run!==scanEpoch)return;
   if(time-previous>=180&&video.readyState>=2&&video.videoWidth>0){
    previous=time;const scale=Math.min(1,1280/Math.max(video.videoWidth,video.videoHeight));
    canvas.width=Math.round(video.videoWidth*scale);canvas.height=Math.round(video.videoHeight*scale);
    ctx.drawImage(video,0,0,canvas.width,canvas.height);
    const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
    const result=jsQR(pixels.data,pixels.width,pixels.height,{inversionAttempts:'attemptBoth'});
    if(result){stop();void accept(result.data).catch(e=>status(e.message));return;}
   }
   scanFrame=requestAnimationFrame(frame);
  };
  scanFrame=requestAnimationFrame(frame);
 }catch{stop();throw Error('Caméra indisponible : autorisez son accès ou utilisez l’échange par fichier.');}
}
function download(value:unknown,name:string){if(!value)throw Error('Aucun échange prêt.');const url=URL.createObjectURL(new Blob([JSON.stringify(value)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
button('create',async()=>{stop();host=await createPoll((element('question') as HTMLInputElement).value.trim(),(element('options') as HTMLTextAreaElement).value.split('\n').map(s=>s.trim()).filter(Boolean));counts=host.poll.options.map(()=>0);seen.clear();await qr(element('host'),host.poll);element('collect').hidden=false;renderResults();status('Présentez ce QR aux participants, puis scannez leurs réponses.');});
button('collect',scan);button('join',scan);button('stop',stop);
button('erase',()=>{stop();host=null;lastReply=null;counts=[];seen.clear();for(const id of ['host','results','participant'])element(id).replaceChildren();element('collect').hidden=true;status('Clé et résultats retirés de la mémoire de cette page.');});
button('export-poll',()=>download(host?.poll,'sondage-public.json'));button('export-reply',()=>download(lastReply,'reponse-chiffree.json'));
element('import').addEventListener('change',()=>{void(async()=>{const input=element('import') as HTMLInputElement;const file=input.files?.[0];if(!file)return;if(file.size>5000)throw Error('Fichier trop grand.');await accept(await file.text());input.value='';})().catch(e=>status(e.message));});
addEventListener('pagehide',()=>{stop();host=null;lastReply=null;seen.clear();counts=[];});
addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>status('Installation hors ligne indisponible.'));
