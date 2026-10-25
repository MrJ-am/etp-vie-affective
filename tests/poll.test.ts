import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPoll, answer, receive } from '../bridge/poll-crypto.ts';
import { base64, unbase64 } from '../bridge/crypto.ts';
test('Sondage : seul le destinataire ouvre la réponse, altération et autre session refusées',async()=>{
 const host=await createPoll('Question fictive',['Oui','Non','Ne pas répondre']);
 const other=await createPoll('Autre séance',['A','B']);
 const reply=await answer(host.poll,2);
 assert.ok(!JSON.stringify(reply).includes('Ne pas répondre'));
 assert.equal(host.privateKey.extractable,false);
 assert.equal((await receive(host.poll,host.privateKey,reply)).choice,2);
 await assert.rejects(receive(host.poll,other.privateKey,reply));
 await assert.rejects(receive(other.poll,other.privateKey,reply));
 const ct=unbase64(reply.ct);ct[2]^=1;
 await assert.rejects(receive(host.poll,host.privateKey,{...reply,ct:base64(ct)}));
 await assert.rejects(answer(host.poll,3));
 await assert.rejects(answer({...host.poll,publicKey:{...host.poll.publicKey,d:'private'}},0));
});

test('QR chiffrés : douze réponses aléatoires se décodent sans réseau',async()=>{
 const {default:QRCode}=await import('qrcode');const {default:jsQR}=await import('jsqr');
 const {poll}=await createPoll('Une question fictive',['A','B']);
 for(let i=0;i<12;i++){
  const text=JSON.stringify(await answer(poll,i%2));const matrix=QRCode.create(text,{errorCorrectionLevel:'M'}).modules;
  const scale=4,margin=4,size=(matrix.size+2*margin)*scale,pixels=new Uint8ClampedArray(size*size*4);pixels.fill(255);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   const row=Math.floor(y/scale)-margin,col=Math.floor(x/scale)-margin;
   if(row>=0&&col>=0&&row<matrix.size&&col<matrix.size&&matrix.get(row,col)){
    const offset=(y*size+x)*4;pixels[offset]=pixels[offset+1]=pixels[offset+2]=0;
   }
  }
  assert.equal(jsQR(pixels,size,size,{inversionAttempts:'attemptBoth'})?.data,text);
 }
});
