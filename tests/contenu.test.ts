import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const content=JSON.parse(readFileSync(new URL("../content/parcours.json",import.meta.url),"utf8"));
test("Quinze étapes accessibles, bilans distincts et aucune date de session inventée",()=>{
  assert.equal(content.chapitres.length,15);
  assert.deepEqual(content.chapitres.map(c=>c.id),Array.from({length:15},(_,i)=>i));
  assert.equal(content.chapitres[0].titre,content.chapitres[14].titre);
  assert.notEqual(content.chapitres[0].sousTitre,content.chapitres[14].sousTitre);
  assert.ok(content.chapitres.every(c=>c.dateSession===null));
});
test("Les sept rubriques et la provenance sont conservées pour chaque chapitre régulier",()=>{
  const expected=["Je me prépare","J’expérimente","Ce que j’en retiens","Je comprends mieux","Ma progression","Ma prochaine expérimentation","Je fais le point"];
  for(const c of content.chapitres){
    if(c.nature==="chapitre")assert.deepEqual(c.rubriques,expected);
    assert.ok(c.source.includes("G"));assert.ok(c.objectif.length>10);
    assert.equal(c.statutLecture,"Proposition du prototype à valider");
    assert.ok(c.essentiel.length>=2);assert.ok(c.question);assert.ok(c.petitPas);
  }
  assert.equal(new Set(content.chapitres.map(c=>c.essentiel.join(" "))).size,15);
});
test("Les originaux et l’extraction privée sont absents des ressources servies",()=>{
  const index=readFileSync(new URL("../dist/index.html",import.meta.url),"utf8");
  assert.ok(!index.includes("sources/"));assert.ok(!index.includes("google-analytics"));
  assert.ok(!index.includes("fonts.googleapis"));assert.ok(index.includes('lang="fr"'));
});
