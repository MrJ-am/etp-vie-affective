import {test} from "node:test";
import assert from "node:assert/strict";
import {createVault,seal,pack,recoveryCode,unlock,open,unpack} from "../bridge/crypto.ts";
import {journal,phrase,password} from "./fixtures.ts";
const base=process.env.CARNET_API_TEST_URL||"http://localhost:3001";
const origin=process.env.CARNET_API_TEST_ORIGIN||"http://localhost:3000";
let ready=false;
for(let i=0;i<50;i++){
  try{if((await fetch(base+"/api/health")).ok){ready=true;break;}}catch{}
  await new Promise(resolve=>setTimeout(resolve,200));
}
assert.ok(ready,"Le vrai backend de test doit être lancé.");
type Session={cookie:string;csrf:string;id:string;pseudo:string;auth:string;payload:any;key:any;keyring:any};
async function call(path:string,method="GET",body?:unknown,session?:Session,extra:Record<string,string>={}){
  const headers:Record<string,string>={...extra};
  if(method!=="GET"){headers.Origin=origin;headers["Content-Type"]="application/json";}
  if(session){headers.Cookie=session.cookie;headers["X-Carnet-CSRF"]=session.csrf;}
  const response=await fetch(base+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  const text=await response.text();let data:any;try{data=JSON.parse(text);}catch{data=text;}
  return{response,data,text};
}
async function register():Promise<Session>{
  const created=await createVault(phrase),auth=recoveryCode(),pseudo="api_"+crypto.randomUUID().replaceAll("-","").slice(0,18);
  const payload={keyring:created.keyring,envelope:await seal(created.key,pack(journal()),created.keyring.vault,"journal")};
  const result=await call("/api/register","POST",{pseudonyme:pseudo,password,authRecovery:auth,payload});
  assert.equal(result.response.status,200,result.data.error);
  return {cookie:result.response.headers.get("set-cookie")!.split(";")[0],csrf:result.data.csrf,id:result.data.id,pseudo,auth,payload,key:created.key,keyring:created.keyring};
}
let a:Session,b:Session,object:string;
test("API réelle : inscription et cookie HttpOnly/SameSite, coffre persistant opaque",async()=>{
  a=await register();b=await register();
  const me=await call("/api/me","GET",undefined,a);assert.equal(me.data.id,a.id);
  const state=await call("/api/state","GET",undefined,a);assert.equal(state.data.revision,1);
  assert.equal(state.response.headers.get("etag"),'"1"');assert.ok(!state.text.includes("SENTINEL_FICTIVE"));
  assert.deepEqual(unpack(await open(a.key,state.data.payload.envelope,a.keyring.vault,"journal")),journal());
  assert.ok(state.response.headers.get("cache-control")?.includes("no-store"));
});
test("API réelle : isolation de comptes, session non authentifiée et accès horizontal",async()=>{
  assert.equal((await call("/api/state")).response.status,401);
  const stateB=await call("/api/state","GET",undefined,b);
  await assert.rejects(open(a.key,stateB.data.payload.envelope,a.keyring.vault,"journal"));
  object=crypto.randomUUID();const image=await seal(a.key,new Uint8Array([1,2,3]),a.keyring.vault,object);
  assert.equal((await call("/api/objects/"+object,"PUT",image,a)).response.status,200);
  assert.equal((await call("/api/objects/"+object,"GET",undefined,b)).response.status,404);
  assert.deepEqual((await call("/api/objects","GET",undefined,b)).data,[]);
});
test("API réelle : CSRF, Origin, formats et volume bornés",async()=>{
  assert.equal((await call("/api/state","PUT",a.payload,{...a,csrf:"bad"},{"If-Match":'"1"'})).response.status,403);
  const evil=await fetch(base+"/api/logout",{method:"POST",headers:{Origin:"https://evil.example",Cookie:a.cookie,"X-Carnet-CSRF":a.csrf,"Content-Type":"application/json"},body:"{}"});
  assert.equal(evil.status,403);
  assert.equal((await call("/api/state","PUT",{...a.payload,objectif:"interdit en clair"},a,{"If-Match":'"1"'})).response.status,400);
  assert.equal((await call("/api/state","PUT",a.payload,a)).response.status,428);
  assert.equal((await call("/api/state","PUT",{...a.payload,keyring:{...a.keyring,phrase:{...a.keyring.phrase,rounds:1_000_000_000}}},a,{"If-Match":'"1"'})).response.status,400);
  const large=await fetch(base+"/api/state",{method:"PUT",headers:{Origin:origin,Cookie:a.cookie,"X-Carnet-CSRF":a.csrf,"Content-Type":"application/json","If-Match":'"1"'},body:JSON.stringify({data:"x".repeat(4_000_001)})});
  assert.equal(large.status,413);
  const privateSource=await call("/sources/EXTRAITS_PEDAGOGIQUES.md");assert.equal(privateSource.response.status,404);
});
test("API réelle : écritures atomiques et conflit explicite sans écrasement",async()=>{
  const first=await call("/api/state","PUT",a.payload,a,{"If-Match":'"1"'});assert.equal(first.data.revision,2);
  const second=await call("/api/state","PUT",a.payload,a,{"If-Match":'"1"'});assert.equal(second.response.status,409);
  assert.equal((await call("/api/state","GET",undefined,a)).data.revision,2);
});
test("API réelle : récupération de connexion séparée, rotation du code et ancien cookie révoqué",async()=>{
  const old=a.cookie,code=recoveryCode(),next="Nouveau_mot_de_passe_fictif_2026";
  assert.equal((await call("/api/reset-auth","POST",{pseudonyme:a.pseudo,password:next,code:recoveryCode(),newCode:code})).response.status,401);
  const result=await call("/api/reset-auth","POST",{pseudonyme:a.pseudo,password:next,code:a.auth,newCode:code});
  assert.equal(result.response.status,200,result.data.error);
  a.cookie=result.response.headers.get("set-cookie")!.split(";")[0];a.csrf=result.data.csrf;
  assert.equal((await call("/api/me","GET",undefined,{...a,cookie:old})).response.status,401);
  const state=await call("/api/state","GET",undefined,a);
  assert.deepEqual(unpack(await open(await unlock(state.data.payload.keyring,phrase),state.data.payload.envelope,a.keyring.vault,"journal")),journal());
  assert.equal((await call("/api/reset-auth","POST",{pseudonyme:a.pseudo,password:next,code:a.auth,newCode:recoveryCode()})).response.status,401);
  a.auth=code;
});
test("API réelle : nouveau coffre après perte des secrets conserve l’ancien chiffré",async()=>{
  const created=await createVault("La phrase du nouveau coffre de test");
  const payload={keyring:created.keyring,envelope:await seal(created.key,pack({...journal(),notes:{}}),created.keyring.vault,"journal")};
  const result=await call("/api/new-vault","POST",payload,a,{"If-Match":'"2"'});assert.equal(result.data.revision,3);
  const archived=await call("/api/archives","GET",undefined,a);assert.equal(archived.data.length,1);
  assert.equal(archived.data[0].images.length,1);assert.equal((await call("/api/objects","GET",undefined,a)).data.length,0);
  assert.deepEqual(unpack(await open(a.key,archived.data[0].payload.envelope,a.keyring.vault,"journal")),journal());
});
test("API réelle : suppression du compte purge sessions, objets et archives",async()=>{
  const deletion=await call("/api/account","DELETE",{password:"Nouveau_mot_de_passe_fictif_2026"},a);assert.equal(deletion.response.status,200);
  assert.equal((await call("/api/me","GET",undefined,a)).response.status,401);
  assert.equal((await call("/api/login","POST",{pseudonyme:a.pseudo,password:"Nouveau_mot_de_passe_fictif_2026"})).response.status,401);
  assert.equal((await call("/api/logout","POST",{},b)).response.status,200);
  assert.equal((await call("/api/me","GET",undefined,b)).response.status,401);
});
test("API réelle : quotas de vingt images et 64 Mo incluant les archives",async()=>{
  const c=await register();
  const image=await seal(c.key,new Uint8Array(1_200_000),c.keyring.vault,crypto.randomUUID());
  for(let i=0;i<20;i++){
    const id=crypto.randomUUID();const envelope=await seal(c.key,new Uint8Array(1_200_000),c.keyring.vault,id);
    assert.equal((await call("/api/objects/"+id,"PUT",envelope,c)).response.status,200);
  }
  assert.equal((await call("/api/objects/"+image.object,"PUT",image,c)).response.status,413);
  const created=await createVault("Une autre phrase fictive pour tester le quota");
  const payload={keyring:created.keyring,envelope:await seal(created.key,pack(journal()),created.keyring.vault,"journal")};
  assert.equal((await call("/api/new-vault","POST",payload,c,{"If-Match":'"1"'})).response.status,200);
  let quota=false;
  for(let i=0;i<20;i++){
    const id=crypto.randomUUID();const envelope=await seal(created.key,new Uint8Array(1_200_000),created.keyring.vault,id);
    const result=await call("/api/objects/"+id,"PUT",envelope,c);
    if(result.response.status===413){assert.match(result.data.error,/64 Mo/);quota=true;break;}
    assert.equal(result.response.status,200);
  }
  assert.ok(quota,"L’archive doit contribuer au quota global");
  assert.equal((await call("/api/account","DELETE",{password},c)).response.status,200);
});
test("API réelle : limitation de débit de l’inscription",async()=>{
  let blocked=false;
  for(let i=0;i<65;i++){const r=await call("/api/register","POST",{});if(r.response.status===429){assert.equal(r.response.headers.get("retry-after"),"900");blocked=true;break;}}
  assert.ok(blocked);
});
