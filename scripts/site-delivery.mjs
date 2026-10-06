/** Relais local explicite lorsque les helpers Sites du plugin sont absents.
 * Credential uniquement stdin/mémoire/env du sous-processus, jamais disque/argv.
 * Le connecteur natif conserve la décision de publication et son contrôle d’accès.
 */
import {execFileSync} from "node:child_process";
import {readFile,mkdir} from "node:fs/promises";
import {resolve} from "node:path";
process.stdin.setEncoding("utf8");
let input = await new Promise(resolve => {
  let buffer="";
  process.stdin.on("data", chunk => {
    buffer+=chunk;
    if(buffer.includes("\n")){process.stdin.pause();resolve(buffer.slice(0,buffer.indexOf("\n")));buffer="";}
  });
});
const {credential,archivePath}=JSON.parse(input);input="";
if(!credential?.token||!credential?.remote_url||credential.branch!=="main"||credential.auth_mode!=="http_extra_header")throw new Error("Credential de source non pris en charge.");
const manifest=JSON.parse(await readFile(".openai/hosting.json","utf8"));
const dirty=execFileSync("git",["status","--porcelain"],{encoding:"utf8"});
if(dirty.trim())throw new Error("Source non committée : terminer avant livraison.");
const commit=execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim();
const env={...process.env,GIT_CONFIG_COUNT:"1",GIT_CONFIG_KEY_0:"http."+credential.remote_url+".extraHeader",GIT_CONFIG_VALUE_0:"Authorization: Bearer "+credential.token,GIT_TERMINAL_PROMPT:"0",GIT_TRACE:"0",GIT_TRACE_CURL:"0"};
try{
  execFileSync("git",["push",credential.remote_url,"HEAD:refs/heads/"+credential.branch],{env,stdio:["ignore","pipe","pipe"]});
  const remote=execFileSync("git",["ls-remote",credential.remote_url,"refs/heads/"+credential.branch],{env,encoding:"utf8",stdio:["ignore","pipe","pipe"]});
  if(!remote.startsWith(commit+"\t"))throw new Error("Le commit distant ne correspond pas.");
}catch(error){throw new Error("Push de la source refusé : "+String(error.stderr||error.message).replaceAll(credential.token,"[secret masqué]"));}
delete env.GIT_CONFIG_VALUE_0;credential.token="";
execFileSync("npm",["run","build"],{env:{...process.env,CARNET_DEMO_ONLY:"true"},stdio:["ignore","pipe","pipe"]});
if(!(await readFile("dist/index.html","utf8")).includes('data-demo-only="true"'))throw new Error("La publication doit être en mode démonstration.");
execFileSync("git",["archive","--format=zip","HEAD","--output","dist/mon-carnet-poc.zip"],{stdio:["ignore","pipe","pipe"]});
const archive=resolve(archivePath);await mkdir(resolve(archive,".."),{recursive:true});
execFileSync("tar",["-czf",archive,".openai/hosting.json","dist"],{stdio:["ignore","pipe","pipe"]});
const files=execFileSync("tar",["-tzf",archive],{encoding:"utf8"});
if(files.split("\n").filter(Boolean).some(file=>file!==".openai/hosting.json"&&!file.startsWith("dist/")))throw new Error("Archive contient des fichiers inattendus.");
console.log(JSON.stringify({project_id:manifest.project_id,commit_sha:commit,archive}));
