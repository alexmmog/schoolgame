const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),web=path.join(root,'project/build/web-mobile');
if(!fs.existsSync(path.join(web,'index.html')))throw Error('Build Web Mobile first.');
const port=Number(process.argv[2]||7348),server=require('./serve.cjs');
const timeout=setTimeout(()=>{console.error('Bounded HTTP smoke timed out.');server.close();process.exit(1);},15000);
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]);}
function get(relative){return new Promise((resolve,reject)=>{
 const request=http.get({host:'127.0.0.1',port,path:relative},response=>{
  const chunks=[];response.on('data',chunk=>chunks.push(chunk));response.on('end',()=>resolve({status:response.statusCode,body:Buffer.concat(chunks)}));
 });request.on('error',reject);
});}
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
server.once('listening',async()=>{
 try{
  const results=[];
  for(const file of files(web)){
   const relative=path.relative(web,file).split(path.sep).map(encodeURIComponent).join('/');
   const expected=fs.readFileSync(file),actual=await get('/'+relative);
   if(actual.status!==200||hash(actual.body)!==hash(expected))throw Error('HTTP file mismatch: '+relative);
   results.push({path:relative,status:actual.status,bytes:actual.body.length,sha256:hash(actual.body)});
  }
  const traversal=await get('/..%2f..%2fpackage.json');if(traversal.status!==403)throw Error('Path boundary smoke failed.');
  const evidence={scope:'Loopback HTTP delivery only; no rendered frame, UI click or browser-storage claim',
   checkedAt:new Date().toISOString(),url:`http://127.0.0.1:${port}/`,files:results,
   fileCount:results.length,bytes:results.reduce((n,r)=>n+r.bytes,0),pathTraversalStatus:traversal.status,passed:true};
  fs.writeFileSync(path.join(root,'evidence/http-smoke.json'),JSON.stringify(evidence,null,2)+'\n');
  console.log(JSON.stringify({passed:true,fileCount:evidence.fileCount,bytes:evidence.bytes,pathTraversalStatus:traversal.status,scope:evidence.scope}));
 }catch(error){console.error(String(error));process.exitCode=1;}
 finally{clearTimeout(timeout);server.close();}
});
