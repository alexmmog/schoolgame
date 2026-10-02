const fs=require('node:fs'),path=require('node:path');
const {parseDraftBank}=require('../.test-dist/core/content.js');
const {RunSession}=require('../.test-dist/core/run.js');
const {RunSaveRepository}=require('../.test-dist/platform/run-save.js');
const bank=parseDraftBank(JSON.parse(fs.readFileSync(path.resolve(__dirname,'../project/assets/resources/draft-bank.json'),'utf8')));
const [action,relative]=process.argv.slice(2);
const root=path.resolve(__dirname,'..'),file=path.resolve(root,relative||'evidence/run-restart-store.json');
if(!file.startsWith(root+path.sep))throw Error('Probe destination must stay in this first-playable workspace');
if(action==='write'&&fs.existsSync(file))throw Error('Use a new probe file; never overwrite an existing session fixture');
let values=action==='read'?JSON.parse(fs.readFileSync(file,'utf8')):{};
const store={getItem:key=>values[key]??null,setItem:(key,value)=>{values[key]=value;fs.writeFileSync(file,JSON.stringify(values,null,2)+'\n');}};
const repo=new RunSaveRepository(store,bank),loaded=repo.load(0,'file-probe','timed');
if(action==='write'){
 const s=loaded.session;s.startStation(0);s.advance(350);s.submit(s.question.correctId,350,s.token);s.pause(350);
 if(!repo.save(s).ok)throw Error('File save probe failed');
 console.log(JSON.stringify({action,status:'written',phase:s.phase,score:s.score,questionId:s.question.id,paused:s.paused}));
}else if(action==='read'){
 const s=loaded.session;if(loaded.status!=='restored'||s.phase!=='feedback'||s.score!==100||!s.paused)throw Error('Process restart recovery mismatch');
 console.log(JSON.stringify({action,status:loaded.status,phase:s.phase,score:s.score,questionId:s.question.id,paused:s.paused,
  storedOptionOrder:s.snapshot.current.optionOrder,scope:'Node file storage; not Cocos/browser restart verification'}));
}else throw Error('Usage: node tools/run-restart-probe.cjs write|read <new relative fixture path>');
