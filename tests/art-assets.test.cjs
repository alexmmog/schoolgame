const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),manifest=JSON.parse(fs.readFileSync(path.join(root,'art-source/asset-manifest.json'),'utf8'));
const {phoneLayout,questionGeometry}=require('../.test-dist/ui/layout.js');
const {fittedSize,mapArtGeometry,MAP_LABEL_ANCHORS}=require('../.test-dist/ui/art-layout.js');
const safeRects=[{x:0,y:0,width:390,height:844},{x:0,y:34,width:390,height:763},{x:24,y:40,width:342,height:723}];
test('six actual regenerated PNG files match dimensions, SHA-256 and independent asset manifest',()=>{
 assert.equal(manifest.assets.length,6);assert.equal(manifest.artBasis.includes('New regenerated'),true);
 assert.deepEqual(manifest.assets.map(a=>a.name),['hero-neutral','map-neighborhood','scene-campus','scene-store','scene-cafe','scene-stage']);
 for(const a of manifest.assets){const file=path.resolve(root,a.path);assert.ok(file.startsWith(root+path.sep));const data=fs.readFileSync(file);
  assert.equal(data.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(data.length,a.bytes);
  assert.equal(data.readUInt32BE(16),a.width);assert.equal(data.readUInt32BE(20),a.height);
  assert.equal(crypto.createHash('sha256').update(data).digest('hex'),a.sha256);
 }
 assert.equal(manifest.contactSheetIsGameplayScreenshot,false);assert.equal(manifest.runtimeFrameVerified,false);
});
test('hero has measured true alpha and complete padded body while all scene backgrounds are opaque',()=>{
 const hero=manifest.assets[0],data=fs.readFileSync(path.join(root,hero.path));assert.equal(data[25],6);
 assert.deepEqual(hero.alphaExtrema,[0,255]);assert.ok(hero.transparentPixels>hero.width*hero.height/2);
 const [left,top,right,bottom]=hero.visibleBoundsAlpha16;
 assert.ok(left>0&&right<hero.width);assert.ok(top>=hero.height*0.08);assert.ok(bottom<=hero.height*0.92);
 for(const scene of manifest.assets.slice(1))assert.deepEqual(scene.alphaExtrema,[255,255]);
 assert.equal(manifest.expressionVariants.attempts,1);assert.equal(manifest.expressionVariants.workaroundUsed,false);
});
test('generated art stays within package and explicit decoded RGBA8 budgets',()=>{
 const bytes=manifest.assets.reduce((n,a)=>n+a.bytes,0),rgba=manifest.assets.reduce((n,a)=>n+a.width*a.height*4,0);
 assert.equal(bytes,manifest.pngBytes);assert.equal(rgba,manifest.allRGBA8Bytes);
 assert.ok(bytes<=12*1024*1024);assert.ok(rgba<=48*1024*1024);
 for(const a of manifest.assets){assert.ok(Math.max(a.width,a.height)<=2048);assert.equal(a.mipFilter,'none');assert.equal(a.packable,false);}
 const hero=manifest.assets[0];for(const a of manifest.assets.slice(1))assert.ok(hero.rgba8Bytes+a.rgba8Bytes<=24*1024*1024);
});
test('aspect-fit sprites preserve all source pixels and reject invalid dimensions',()=>{
 for(const a of manifest.assets){const f=fittedSize(a.width,a.height,240,100);
  assert.ok(f.width<=240+1e-9&&f.height<=100+1e-9);assert.ok(Math.abs(f.width/f.height-a.width/a.height)<1e-9);
 }
 assert.throws(()=>fittedSize(0,100,200,100));assert.throws(()=>fittedSize(NaN,100,200,100));
});
test('illustrated question scene, full prompt card, four choices and hint do not overlap in supported safe rectangles',()=>{
 for(const safe of safeRects){const l=phoneLayout(safe),g=questionGeometry(l,4);
  assert.ok(g.sceneTop>=l.top+109*l.scale+6);assert.ok(g.sceneTop+g.sceneHeight<g.cardTop);
  assert.ok(g.cardTop+g.cardHeight<g.optionTop);
  const optionBottom=g.optionTop+4*g.optionHeight+3*g.optionGap,hintCenter=l.top+625*l.scale;
  assert.ok(optionBottom+6<=hintCenter-9);assert.ok(hintCenter+9+6<=g.actionTop);assert.ok(g.optionHeight>=48);
 }
});
test('winding map uses inspected quiet anchors; four live stations stay separate and above controls',()=>{
 const map=manifest.assets.find(a=>a.name==='map-neighborhood');assert.deepEqual(map.labelAnchors,MAP_LABEL_ANCHORS);
 for(const safe of safeRects){const l=phoneLayout(safe),g=mapArtGeometry(l,map.width,map.height);
  assert.equal(g.stations.length,4);assert.ok(Math.abs(g.image.width/g.image.height-map.width/map.height)<1e-9);
  for(const rect of g.stations){assert.ok(rect.x-rect.width/2>=l.left-1e-9);assert.ok(rect.x+rect.width/2<=390-l.right+1e-9);
   assert.ok(rect.height>=48);assert.ok(rect.y-rect.height/2>l.top+75*l.scale);assert.ok(rect.y+rect.height/2<l.top+575*l.scale);}
  for(let i=1;i<4;i++)assert.ok(g.stations[i].y-g.stations[i].height/2>g.stations[i-1].y+g.stations[i-1].height/2+3);
 }
});
