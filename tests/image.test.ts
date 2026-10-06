import {test} from "node:test";
import assert from "node:assert/strict";
import {imageDimensions} from "../bridge/image.ts";
test("images : dimensions avant décodage, refus d’une bombe PNG et d’un format masqué",()=>{
  const png=new Uint8Array(24);png.set([137,80,78,71]);png.set([73,72,68,82],12);
  const v=new DataView(png.buffer);v.setUint32(16,1600);v.setUint32(20,1200);
  assert.deepEqual(imageDimensions(png),[1600,1200]);
  v.setUint32(16,100000);assert.throws(()=>imageDimensions(png),/trop grande/);
  assert.throws(()=>imageDimensions(new TextEncoder().encode("<svg>image</svg>")),/valide/);
  const jpeg=new Uint8Array([255,216,255,192,0,8,8,0,16,0,32,1]);
  assert.deepEqual(imageDimensions(jpeg),[32,16]);
});
