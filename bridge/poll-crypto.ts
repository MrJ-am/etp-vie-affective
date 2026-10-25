/** Ephemeral optical E2EE. Public request is authenticated by scanning the facilitator's screen. */
import { base64, unbase64, bytes } from './crypto';
export type Poll = { v:1; kind:'etp-poll'; id:string; question:string; options:string[]; publicKey:JsonWebKey };
export type Reply = { v:1; kind:'etp-reply'; poll:string; publicKey:JsonWebKey; iv:string; ct:string };
const utf8=new TextEncoder();
const UUID=/^[0-9a-f-]{36}$/;
function keyValid(key:JsonWebKey):void {
 if(!key || key.kty!=='EC'||key.crv!=='P-256'||key.d!==undefined||typeof key.x!=='string'||typeof key.y!=='string'||key.x.length!==43||key.y.length!==43) throw Error('Clé de sondage invalide.');
}
export function validatePoll(p:Poll):void {
 if(!p||p.v!==1||p.kind!=='etp-poll'||!UUID.test(p.id)||typeof p.question!=='string'||p.question.length<1||p.question.length>180||!Array.isArray(p.options)||p.options.length<2||p.options.length>5||!p.options.every(o=>typeof o==='string'&&o.length>0&&o.length<=60))throw Error('Sondage invalide.');
 keyValid(p.publicKey);
}
async function pair():Promise<CryptoKeyPair>{return crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},false,['deriveBits']);}
async function publicPart(key:CryptoKey):Promise<JsonWebKey>{const k=await crypto.subtle.exportKey('jwk',key);return {kty:k.kty,crv:k.crv,x:k.x,y:k.y};}
async function shared(privateKey:CryptoKey,publicKey:JsonWebKey,id:string):Promise<CryptoKey>{
 keyValid(publicKey);
 const remote=await crypto.subtle.importKey('jwk',publicKey,{name:'ECDH',namedCurve:'P-256'},false,[]);
 const secret=new Uint8Array(await crypto.subtle.deriveBits({name:'ECDH',public:remote},privateKey,256));
 const source=await crypto.subtle.importKey('raw',secret,'HKDF',false,['deriveKey']);secret.fill(0);
 return crypto.subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt:utf8.encode(id),info:utf8.encode('etp-poll|1|answer')},source,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
const aad=(id:string)=>utf8.encode('etp-poll|1|'+id);
export async function createPoll(question:string,options:string[]):Promise<{poll:Poll;privateKey:CryptoKey}>{
 const keys=await pair();const poll:Poll={v:1,kind:'etp-poll',id:crypto.randomUUID(),question,options,publicKey:await publicPart(keys.publicKey)};validatePoll(poll);return {poll,privateKey:keys.privateKey};
}
export async function answer(poll:Poll,choice:number):Promise<Reply>{
 validatePoll(poll);if(!Number.isInteger(choice)||choice<0||choice>=poll.options.length)throw Error('Réponse invalide.');
 const keys=await pair(),key=await shared(keys.privateKey,poll.publicKey,poll.id),iv=bytes(12),padded=bytes(128);
 const encoded=utf8.encode(JSON.stringify({id:crypto.randomUUID(),choice}));padded[0]=encoded.length;padded.set(encoded,1);
 const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv:iv as BufferSource,additionalData:aad(poll.id)},key,padded as BufferSource);
 return {v:1,kind:'etp-reply',poll:poll.id,publicKey:await publicPart(keys.publicKey),iv:base64(iv),ct:base64(new Uint8Array(ct))};
}
export async function receive(poll:Poll,privateKey:CryptoKey,reply:Reply):Promise<{id:string;choice:number}>{
 if(!reply||reply.v!==1||reply.kind!=='etp-reply'||reply.poll!==poll.id||unbase64(reply.iv,32).length!==12||unbase64(reply.ct,512).length!==144)throw Error('Réponse invalide ou destinée à un autre sondage.');
 const key=await shared(privateKey,reply.publicKey,poll.id);
 const plain=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:unbase64(reply.iv) as BufferSource,additionalData:aad(poll.id)},key,unbase64(reply.ct) as BufferSource));
 const result=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(plain.subarray(1,plain[0]+1)));
 if(!UUID.test(result.id)||!Number.isInteger(result.choice)||result.choice<0||result.choice>=poll.options.length)throw Error('Réponse invalide.');return result;
}
