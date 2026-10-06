import {execFileSync} from "node:child_process";
import assert from "node:assert/strict";
import {createVault,seal,pack,recoveryCode,open,unpack} from "../bridge/crypto.ts";
import {journal,phrase,password} from "../tests/fixtures.ts";
// Exclusivement la base isolée de compose.test.yaml et des identités inventées.
const compose=["compose","-p","mon-carnet-tests","-f","compose.test.yaml"];
function docker(args:string[],input?:string){return execFileSync("docker",[...compose,...args],{input,encoding:"utf8",stdio:["pipe","pipe","pipe"]});}
function sql(input:string){return docker(["exec","-T","database","psql","-v","ON_ERROR_STOP=1","-U","carnet_test","-d","carnet_test","-At"],input).trim();}
const base="http://localhost:3001",origin="http://localhost:3000";
async function healthy(){
  let ready=false;for(let i=0;i<50;i++){try{if((await fetch(base+"/api/health")).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}assert.ok(ready,"Backend de test disponible");
}
await healthy();
async function make(){
  const created=await createVault(phrase),pseudo="restore_"+crypto.randomUUID().slice(0,8);
  const payload={keyring:created.keyring,envelope:await seal(created.key,pack(journal()),created.keyring.vault,"journal")};
  const r=await fetch(base+"/api/register",{method:"POST",headers:{Origin:origin,"Content-Type":"application/json"},body:JSON.stringify({pseudonyme:pseudo,password,authRecovery:recoveryCode(),payload})});
  assert.equal(r.status,200);const account=await r.json() as any;
  return{...account,key:created.key,keyring:created.keyring,cookie:r.headers.get("set-cookie")!.split(";")[0]};
}
const deleted=await make(),survivor=await make();
const r=await fetch(base+"/api/account",{method:"DELETE",headers:{Origin:origin,"Content-Type":"application/json",Cookie:deleted.cookie,"X-Carnet-CSRF":deleted.csrf},body:JSON.stringify({password})});assert.equal(r.status,200);
// Simuler un état ancien de base sans son tombstone SQL ; garder le journal récent.
assert.match(deleted.id,/^[a-f0-9-]{36}$/);
sql("DELETE FROM suppressions WHERE compte='"+deleted.id+"'::uuid; INSERT INTO comptes(id,pseudonyme,password_hash,auth_recovery_hash) VALUES('"+deleted.id+"'::uuid,'restored_fixture_"+crypto.randomUUID().slice(0,8)+"','fixture','fixture');");
assert.equal(sql("SELECT count(*) FROM comptes WHERE id='"+deleted.id+"'::uuid;"),"1");
docker(["restart","backend"]);
await healthy();
assert.equal(sql("SELECT count(*) FROM comptes WHERE id='"+deleted.id+"'::uuid;"),"0");
const state=await(await fetch(base+"/api/state",{headers:{Cookie:survivor.cookie}})).json() as any;
assert.deepEqual(unpack(await open(survivor.key,state.payload.envelope,survivor.keyring.vault,"journal")),journal());
console.log("Redémarrage réel SBCL : coffre et session de la fixture conservés.");
console.log("Restauration simulée d’un compte supprimé : journal indépendant rejoué, compte retiré avant ouverture du service.");
await fetch(base+"/api/account",{method:"DELETE",headers:{Origin:origin,"Content-Type":"application/json",Cookie:survivor.cookie,"X-Carnet-CSRF":survivor.csrf},body:JSON.stringify({password})});
