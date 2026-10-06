import {test} from "node:test";
import assert from "node:assert/strict";
import {createDecipheriv, pbkdf2Sync} from "node:crypto";
import {createVault,unlock,changePhrase,seal,open,pack,unpack,unbase64,base64,bytes,derive,ROUNDS,validateJournal} from "../bridge/crypto.ts";
import {journal,phrase} from "./fixtures.ts";

test("AES-256-GCM : vecteur NIST indépendant, message vide",async()=>{
  const key=await crypto.subtle.importKey("raw",new Uint8Array(32),"AES-GCM",false,["decrypt"]);
  const tag=Uint8Array.from(Buffer.from("530f8afbc74536b9a963b4f1c4cb738b","hex"));
  assert.equal((await crypto.subtle.decrypt({name:"AES-GCM",iv:new Uint8Array(12),tagLength:128},key,tag)).byteLength,0);
});
test("AAD et ciphertext compatibles avec OpenSSL/Node, indépendamment du déchiffreur applicatif",async()=>{
  const raw=bytes(32),vault=crypto.randomUUID();
  const key=await crypto.subtle.importKey("raw",raw,"AES-GCM",false,["encrypt","decrypt"]);
  const envelope=await seal(key,new TextEncoder().encode("fixture publique"),vault,"journal");
  const ct=Buffer.from(unbase64(envelope.ct));
  const decipher=createDecipheriv("aes-256-gcm",raw,unbase64(envelope.iv));
  decipher.setAAD(Buffer.from("mon-carnet|1|"+vault+"|journal"));
  decipher.setAuthTag(ct.subarray(-16));
  assert.equal(Buffer.concat([decipher.update(ct.subarray(0,-16)),decipher.final()]).toString(),"fixture publique");
});
test("PBKDF2 Web Crypto compatible avec la dérivation indépendante de Node",async()=>{
  const salt=bytes(16),key=await derive(phrase,salt,ROUNDS),vault=crypto.randomUUID();
  const data=bytes(32),wrapped=await seal(key,data,vault,"phrase"),ct=Buffer.from(unbase64(wrapped.ct));
  const independent=pbkdf2Sync(phrase,salt,ROUNDS,32,"sha256");
  const decipher=createDecipheriv("aes-256-gcm",independent,unbase64(wrapped.iv));
  decipher.setAAD(Buffer.from("mon-carnet|1|"+vault+"|phrase"));decipher.setAuthTag(ct.subarray(-16));
  assert.deepEqual(Buffer.concat([decipher.update(ct.subarray(0,-16)),decipher.final()]),Buffer.from(data));
});
test("Phrase et récupération ouvrent le même coffre ; mauvaise phrase refusée",async()=>{
  const created=await createVault(phrase);
  const envelope=await seal(created.key,pack(journal()),created.keyring.vault,"journal");
  for(const key of [await unlock(created.keyring,phrase),await unlock(created.keyring,created.recovery,true)])
    assert.deepEqual(unpack(await open(key,envelope,created.keyring.vault,"journal")),journal());
  await assert.rejects(unlock(created.keyring,"Une mauvaise phrase fictive"));
});
test("Altération, substitution de coffre et d’objet refusées",async()=>{
  const created=await createVault(phrase),vault=created.keyring.vault;
  const envelope=await seal(created.key,pack(journal()),vault,"journal");
  const ct=unbase64(envelope.ct);ct[0]^=1;
  await assert.rejects(open(created.key,{...envelope,ct:base64(ct)},vault,"journal"));
  await assert.rejects(open(created.key,envelope,crypto.randomUUID(),"journal"));
  await assert.rejects(open(created.key,envelope,vault,crypto.randomUUID()));
});
test("Nonce de 96 bits renouvelé à chaque opération ; clé non exportable",async()=>{
  const created=await createVault(phrase),nonces=new Set();
  for(let i=0;i<100;i++){const value=await seal(created.key,bytes(32),created.keyring.vault,"journal");assert.equal(unbase64(value.iv).length,12);nonces.add(value.iv);}
  assert.equal(nonces.size,100);assert.equal(created.key.extractable,false);
});
test("Changement de phrase par ancien secret ou kit, ancienne sauvegarde préservée",async()=>{
  const created=await createVault(phrase),next="Une nouvelle phrase de coffre fictive";
  const changed=await changePhrase(created.keyring,phrase,next);
  await unlock(changed,next);await assert.rejects(unlock(changed,phrase));
  await unlock(created.keyring,phrase);
  const recovered=await changePhrase(changed,created.recovery,phrase,true);await unlock(recovered,phrase);
});
test("Versions, KDF, base64 et tailles invalides refusés avant calcul coûteux",async()=>{
  const created=await createVault(phrase);
  await assert.rejects(unlock({...created.keyring,v:2 as any},phrase));
  await assert.rejects(unlock({...created.keyring,phrase:{...created.keyring.phrase,rounds:2_000_000_000}},phrase));
  assert.throws(()=>unbase64("pas du base64"));
  assert.throws(()=>pack({texte:"x".repeat(2_000_001)}));
  assert.throws(()=>unpack(new Uint8Array([255,255,255,255])));
});
test("Padding borné, longueur UTF-8 et validation profonde des imports",()=>{
  const doc=journal();doc.notes["1-note"]="été 🌱";
  const packed=pack(doc);assert.equal(packed.length%4096,0);assert.deepEqual(unpack(packed),doc);validateJournal(doc);
  assert.throws(()=>validateJournal({...doc,version:2}));
  assert.throws(()=>validateJournal({...doc,objectifs:[{id:1,texte:7,origine:1,historique:[]}]}));
  assert.throws(()=>validateJournal({...doc,defis:[1,2,3,4].map(id=>({id,texte:"défi",objectif:0,statut:"actif",origine:1,historique:[]}))}));
  assert.throws(()=>validateJournal(JSON.parse('{"version":1,"etape":1,"nextId":100,"notes":{"__proto__":"interdit"},"objectifs":[],"defis":[],"experiences":[],"cartes":[],"traces":[],"etapes":[],"photos":[],"consultations":[]}')));
});
