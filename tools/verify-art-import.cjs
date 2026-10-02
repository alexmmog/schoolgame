const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8').replace(/^\uFEFF/,''));
const manifest=read('art-source/asset-manifest.json'),config=read('project/build/web-mobile/assets/resources/config.json');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]);}
const nativeImages=files(path.join(root,'project/build/web-mobile/assets/resources/native')).filter(p=>/\.png$/i.test(p));
const nativeHashes=new Map(nativeImages.map(p=>[hash(p),path.relative(root,p).split(path.sep).join('/')]));
const records=manifest.assets.map(asset=>{
 const png=path.join(root,asset.path),meta=read(asset.path+'.meta');
 const frame=Object.values(meta.subMetas).find(m=>m.importer==='sprite-frame'),texture=Object.values(meta.subMetas).find(m=>m.importer==='texture');
 if(hash(png)!==asset.sha256||!frame?.imported||!texture?.imported||meta.userData.type!=='sprite-frame')throw Error('Source/import mismatch: '+asset.name);
 const td=texture.userData,fd=frame.userData,expected='art/'+asset.name+'/spriteFrame',resource=config.paths[frame.uuid];
 if(td.minfilter!=='linear'||td.magfilter!=='linear'||td.mipfilter!=='none'||td.wrapModeS!=='clamp-to-edge'||td.wrapModeT!=='clamp-to-edge'||fd.packable!==false)throw Error('Import settings mismatch: '+asset.name);
 if(fd.rawWidth!==asset.width||fd.rawHeight!==asset.height||!resource||resource[0]!==expected||resource[1]!=='cc.SpriteFrame')throw Error('Compiled SpriteFrame path/dimensions mismatch: '+asset.name);
 const compiledPng=nativeHashes.get(asset.sha256);if(!compiledPng)throw Error('Exact PNG absent from compiled Web resources: '+asset.name);
 return {name:asset.name,sourcePNG:asset.path,sha256:asset.sha256,rawWidth:fd.rawWidth,rawHeight:fd.rawHeight,
  minFilter:td.minfilter,magFilter:td.magfilter,mipFilter:td.mipfilter,wrapS:td.wrapModeS,wrapT:td.wrapModeT,
  packable:fd.packable,resourcePath:resource[0],spriteFrameUUID:frame.uuid,compiledPNG:compiledPng,compiledBytesMatch:true};
});
if(records.length!==6)throw Error('Expected six generated source assets');
const evidence={checkedAt:new Date().toISOString(),passed:true,assetCount:records.length,
 scope:'Static imported SpriteFrame settings, official build resource paths and exact PNG bytes; no runtime rendering/input claim',
 runtimeFrameVerified:false,realInputVerified:false,assets:records};
fs.writeFileSync(path.join(root,'evidence/art-import-verification.json'),JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify({passed:true,assetCount:records.length,compiledPNGBytesMatched:records.length,scope:evidence.scope}));
