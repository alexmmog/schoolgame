const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseDraftBank, hashText, STATIONS, ROUTES } = require('../.test-dist/core/content.js');
const { RunSession, validateRunSnapshot } = require('../.test-dist/core/run.js');
const { RunSaveRepository } = require('../.test-dist/platform/run-save.js');
const raw = JSON.parse(fs.readFileSync(path.join(__dirname,'../project/assets/resources/draft-bank.json'),'utf8'));
const bank = parseDraftBank(raw);
function memory() { const values=new Map(); return {values,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)}; }
function envelope(data,sequence=1) {const payload=JSON.stringify(data);return JSON.stringify({schema:1,sequence,payload,checksum:hashText(`${sequence}:${payload}`)});}

test('v0.2 starts a saveable new journey while v0.1 bytes stay untouched',()=>{
 const store=memory(),old=new RunSession(bank,'old','timed',0).snapshot;
 old.appVersion='0.1.0';old.bankVersion='life-comic-draft67-v2';
 const oldKey='life-comic-first-playable-v0.1.session.1',oldBytes=envelope(old);
 store.values.set(oldKey,oldBytes);
 const repo=new RunSaveRepository(store,bank),loaded=repo.load(0,'new','relaxed');
 assert.equal(loaded.status,'updated');assert.match(loaded.note,/旧进度.*保留/);
 assert.equal(loaded.session.snapshot.appVersion,'0.2.0');
 assert.equal(repo.save(loaded.session).ok,true);
 assert.equal(store.values.get(oldKey),oldBytes);
 const restored=new RunSaveRepository(store,bank).load(100,'unused','timed');
 assert.equal(restored.status,'restored');assert.equal(restored.session.snapshot.runId,'comic-new');
});
test('content upgrades choose separate save slots and preserve the previous journey',()=>{
 const store=memory(),first=new RunSaveRepository(store,bank);
 const original=first.load(0,'bank-one','timed').session;assert.equal(first.save(original).ok,true);
 const before=new Map(store.values),nextRaw=JSON.parse(JSON.stringify(raw));
 nextRaw.version='new-content';nextRaw.questions[0].revision++;
 const nextBank=parseDraftBank(nextRaw),second=new RunSaveRepository(store,nextBank);
 assert.equal(typeof first.prefix,'string');assert.notEqual(first.prefix,second.prefix);
 const loaded=second.load(0,'bank-two','timed');assert.equal(loaded.status,'updated');
 assert.equal(second.save(loaded.session).ok,true);
 for(const [key,value] of before)if(key.startsWith(first.prefix))assert.equal(store.values.get(key),value);
 assert.equal(new RunSaveRepository(store,bank).load(0,'other','timed').session.snapshot.runId,'comic-bank-one');
});
test('current namespace still protects unknown future data',()=>{
 const store=memory(),repo=new RunSaveRepository(store,bank);
 const future=new RunSession(bank,'future','timed',0).snapshot;future.appVersion='0.3.0';
 assert.equal(typeof repo.prefix,'string');store.values.set(`${repo.prefix}.1`,envelope(future));
 const before=new Map(store.values),loaded=repo.load(0,'fallback','timed');
 assert.equal(loaded.status,'incompatible');assert.equal(repo.save(loaded.session).ok,false);
 assert.deepEqual(store.values,before);
});
test('bank importer refuses invalid difficulty and station gradients',()=>{
 function graded(){const value=JSON.parse(JSON.stringify(raw));for(const q of value.questions)q.difficulty=q.stage===0?1:q.stage===1?2:3;return value;}
 for(const level of [undefined,0,4,1.5,'2']){const value=graded();value.questions[0].difficulty=level;assert.throws(()=>parseDraftBank(value));}
 for(const [stage,level] of [[0,2],[1,1],[2,1],[3,2]]){const value=graded();value.questions.find(q=>q.stage===stage).difficulty=level;assert.throws(()=>parseDraftBank(value));}
 const value=graded();for(const q of value.questions.filter(q=>q.stage===2))q.difficulty=2;assert.throws(()=>parseDraftBank(value));
});
function api(name) {const file=path.join(__dirname,`../.test-dist/${name}.js`);assert.equal(fs.existsSync(file),true,`${name} must exist`);return require(file);}
function begin(session,now,route) {if(route)session.selectRoute(route);assert.equal(session.startStation(now),true);session.advance(now+350);return now+350;}
function settle(session,now,correct=true) {
 const choice=correct?session.question.correctId:session.question.options.find(o=>o.id!==session.question.correctId).id;
 session.submit(choice,now,session.token);now+=350;assert.equal(session.continueFeedback(now,session.token),true);
 if(session.phase==='preparing'){now+=350;session.advance(now);}return now;
}
test('recent preference relaxes older history before previous-run history',()=>{
 const {preferRecentQuestions}=api('core/recent');
 const pool=bank.questions.slice(0,3),runs=[{runId:'last',clusters:[pool[0].factCluster]},{runId:'older',clusters:[pool[1].factCluster]}];
 assert.deepEqual(preferRecentQuestions(pool,runs),[pool[2]]);
 assert.deepEqual(preferRecentQuestions(pool.slice(0,2),runs),[pool[1]]);
 assert.deepEqual(preferRecentQuestions(pool.slice(0,1),runs),[pool[0]]);
 assert.deepEqual(preferRecentQuestions([],runs),[]);
});
test('RunSession freezes preferences and avoids previous first question when unseen items exist',()=>{
 const old=new RunSession(bank,'same-seed','relaxed',0);begin(old,0);
 const runs=[{runId:'old-run',clusters:[old.question.factCluster]}];
 const next=new RunSession(bank,'same-seed','relaxed',0,undefined,runs);begin(next,0);
 assert.notEqual(next.question.factCluster,old.question.factCluster);
 assert.deepEqual(next.snapshot.recentRuns,runs);
 runs[0].clusters.length=0;
 assert.equal(next.snapshot.recentRuns[0].clusters.length,1);
});
test('restore freezes question, option order and preferences despite changed outer history',()=>{
 const runs=[{runId:'last',clusters:[bank.questions[0].factCluster]}];
 const original=new RunSession(bank,'restore-recent','timed',0,undefined,runs);let now=begin(original,0);
 const restored=new RunSession(bank,'unused','timed',999999,original.serialize(),[]);
 assert.deepEqual(restored.snapshot.current,original.snapshot.current);
 assert.deepEqual(restored.snapshot.recentRuns,runs);assert.equal(restored.paused,true);
 restored.resume(999999);now=settle(original,now);settle(restored,999999);
 assert.equal(restored.question.id,original.question.id);assert.deepEqual(restored.snapshot.current.optionOrder,original.snapshot.current.optionOrder);
});
test('invalid recent histories are refused rather than changing restored candidate pools',()=>{
 const {validateRecentRuns}=api('core/recent');
 for(const value of [null,{},[{}],Array(3).fill({runId:'x',clusters:[]}),[{runId:'x',clusters:['a','a']}],[{runId:'x',clusters:Array(101).fill('a')}],[{runId:'x',clusters:['x'.repeat(161)]}],[{runId:'x',clusters:[]},{runId:'x',clusters:[]}]])assert.throws(()=>validateRecentRuns(value));
 const state=new RunSession(bank,'tamper','timed',0).snapshot;state.recentRuns=[{runId:'x',clusters:['a','a']}];assert.throws(()=>validateRunSnapshot(state,bank));
});
test('recent ledger retains exactly two ended runs and records skipped and discarded seen facts once',()=>{
 const {recordRecentRun}=api('core/recent');
 const s=new RunSession(bank,'seen-history','relaxed',0);let now=begin(s,0);
 const skipped=s.question.factCluster;s.skip(now,s.token);s.advance(now+=350);
 for(let i=0;i<3;i++)now=settle(s,now,false);
 s.restartFailedStation(now);s.advance(now+=350);const after=s.question.factCluster;s.finish('abandoned',now);
 const first=recordRecentRun([],s.snapshot);assert.ok(first[0].clusters.includes(skipped));assert.ok(first[0].clusters.includes(after));
 assert.deepEqual(first[0].clusters,s.snapshot.seenClusters);assert.deepEqual(recordRecentRun(first,s.snapshot),first);
 let history=first;for(const seed of ['second','third']){const next=new RunSession(bank,seed,'relaxed',0);next.finish('abandoned',0);history=recordRecentRun(history,next.snapshot);}
 assert.deepEqual(history.map(r=>r.runId),['comic-third','comic-second']);
 assert.deepEqual(recordRecentRun(history,new RunSession(bank,'active','relaxed',0).snapshot),history);
});
test('recent dual slots survive reload, skip duplicate writes and fall back after newest corruption',()=>{
 const {RecentSaveRepository,RECENT_SAVE_PREFIX}=api('platform/recent-save');
 const store=memory(),repo=new RecentSaveRepository(store);assert.equal(repo.load().status,'new');
 const first=new RunSession(bank,'recent-first','relaxed',0);first.finish('abandoned',0);
 assert.equal(repo.record(first).ok,true);const one=new Map(store.values);assert.equal(repo.record(first).ok,true);assert.deepEqual(store.values,one);
 const second=new RunSession(bank,'recent-second','relaxed',0);second.finish('abandoned',0);assert.equal(repo.record(second).ok,true);
 const restored=new RecentSaveRepository(store).load();assert.deepEqual(restored.runs.map(r=>r.runId),['comic-recent-second','comic-recent-first']);
 store.values.set(`${RECENT_SAVE_PREFIX}.0`,'broken');const fallback=new RecentSaveRepository(store).load();assert.equal(fallback.status,'fallback');assert.deepEqual(fallback.runs.map(r=>r.runId),['comic-recent-first']);
});
test('recent history failure remains retryable without overwriting future data',()=>{
 const {RecentSaveRepository,RECENT_SAVE_PREFIX}=api('platform/recent-save');
 const store=memory(),repo=new RecentSaveRepository(store);repo.load();const s=new RunSession(bank,'retry','relaxed',0);s.finish('abandoned',0);
 const set=store.setItem;store.setItem=()=>{throw Error('quota');};assert.equal(repo.record(s).ok,false);store.setItem=set;assert.equal(repo.record(s).ok,true);
 const reader=new RecentSaveRepository(store);assert.equal(reader.load().runs.length,1);
 store.values.set(`${RECENT_SAVE_PREFIX}.0`,JSON.stringify({schema:2}));const before=new Map(store.values),future=new RecentSaveRepository(store);
 assert.equal(future.load().status,'incompatible');assert.equal(future.record(s).ok,false);assert.deepEqual(store.values,before);
});
test('pending ended-run history can be retried after a new active journey starts',()=>{
 const {RecentSaveRepository}=api('platform/recent-save');
 const store=memory(),repo=new RecentSaveRepository(store);repo.load();const ended=new RunSession(bank,'pending-ended','relaxed',0);begin(ended,0);ended.finish('abandoned',350);
 const set=store.setItem;store.setItem=()=>{throw Error('full');};assert.equal(repo.record(ended).ok,false);
 assert.equal(repo.needsRetry,true);store.setItem=set;
 const active=new RunSession(bank,'active-next','relaxed',0,undefined,repo.history);begin(active,0);
 assert.equal(repo.record(active).ok,true);assert.equal(repo.needsRetry,false);
 assert.deepEqual(new RecentSaveRepository(store).load().runs.map(r=>r.runId),['comic-pending-ended']);
});
test('actual QuizApp records replay history and retries its failed save during the next active run',()=>{
 const {RecentSaveRepository}=api('platform/recent-save');
 const creator=process.env.COCOS_CREATOR_ROOT||'C:/ProgramData/cocos/editors/Creator/3.8.8';
 const ts=require(path.join(creator,'resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js'));
 const source=fs.readFileSync(path.join(__dirname,'../project/assets/scripts/QuizApp.ts'),'utf8');
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,experimentalDecorators:true,useDefineForClassFields:false}}).outputText;
 const output={exports:{}};
 // Only Cocos surfaces are stubbed; the component methods, sessions and both stores are real.
 require('node:vm').runInNewContext(js,{exports:output.exports,module:output,performance:{now:()=>1000},
  require(name){
   if(name==='cc')return {_decorator:{ccclass:()=>Class=>Class},Component:class{}};
   if(name==='./platform/cocos-platform'||name==='./ui/ComicUI'||name==='./ui/ComicArt')return {};
   return require(path.join(__dirname,'../.test-dist',name));
  }});
 const currentStore=memory(),recentStore=memory(),app=new output.exports.QuizApp();
 app.bank=bank;app.save=new RunSaveRepository(currentStore,bank);app.save.load(0,'base','relaxed');
 app.recent=new RecentSaveRepository(recentStore);app.recent.load();
 app.session=new RunSession(bank,'component-ended','relaxed',0);begin(app.session,0);app.session.finish('abandoned',350);
 const set=recentStore.setItem;recentStore.setItem=()=>{throw Error('full');};
 app.persist();assert.equal(app.saved,true);assert.match(app.statusNote,/进度已保存[\s\S]*近期记录未保存/);
 app.begin();assert.equal(app.session.phase,'map');assert.equal(app.session.snapshot.recentRuns[0].runId,'comic-component-ended');
 recentStore.setItem=set;app.persist();assert.equal(app.recent.needsRetry,false);assert.equal(app.recentNote,'');
 assert.deepEqual(new RecentSaveRepository(recentStore).load().runs.map(r=>r.runId),['comic-component-ended']);
 assert.equal(new RunSaveRepository(currentStore,bank).load(0,'unused','timed').session.snapshot.runId,app.session.snapshot.runId);
});
test('damaged recent slots and read errors are visible while the run remains usable',()=>{
 const {RecentSaveRepository,RECENT_SAVE_PREFIX}=api('platform/recent-save');
 const store=memory();store.values.set(`${RECENT_SAVE_PREFIX}.0`,'broken');store.values.set(`${RECENT_SAVE_PREFIX}.1`,'broken');
 const loaded=new RecentSaveRepository(store).load();assert.equal(loaded.status,'invalid');assert.deepEqual(loaded.runs,[]);assert.match(loaded.note,/近期/);
 const denied=new RecentSaveRepository({getItem(){throw Error('denied');},setItem(){throw Error('no');}});assert.equal(denied.load().status,'read-error');
 const s=new RunSession(bank,'still-playable','relaxed',0);begin(s,0);s.finish('abandoned',350);assert.equal(denied.record(s).ok,false);
});
test('saturated recent histories preserve routes, skips, internet separation and every failed-station restart',()=>{
 const all=bank.questions.map(q=>q.factCluster),runs=[{runId:'last',clusters:all},{runId:'older',clusters:all}];let paths=0;
 for(const route2 of ['travel','nature'])for(const route3 of ['media','interests'])for(let seed=0;seed<8;seed++)for(let failedStage=0;failedStage<4;failedStage++)for(const skipFirst of [true,false]){
  const s=new RunSession(bank,`saturated-${seed}-${failedStage}-${skipFirst}-${route2}-${route3}`,'relaxed',0,undefined,runs);let now=0;
  for(let stage=0;stage<4;stage++){
   const route=stage===1?route2:stage===2?route3:undefined;now=begin(s,now,route);
   if(stage===failedStage){
    if(skipFirst){s.skip(now,s.token);s.advance(now+=350);}
    for(let i=0;i<STATIONS[stage].target-1;i++)now=settle(s,now);
    for(let i=0;i<3;i++)now=settle(s,now,false);
    assert.equal(s.restartFailedStation(now),true);s.advance(now+=350);
    if(!skipFirst){s.skip(now,s.token);s.advance(now+=350);}
   }
   for(let i=0;i<2;i++){if(route)assert.ok(ROUTES[route].domains.includes(s.question.domain));now=settle(s,now,false);}
   for(let i=0;i<STATIONS[stage].target;i++)now=settle(s,now);
   assert.equal(s.phase,'stage-result');assert.equal(s.nextStation(now),true);
  }
  const seen=s.snapshot.seenIds.map(id=>bank.questions.find(q=>q.id===id));assert.equal(new Set(seen.map(q=>q.factCluster)).size,seen.length);
  assert.equal(seen.some((q,i)=>q.cognition==='internet'&&seen[i-1]?.cognition==='internet'),false);validateRunSnapshot(s.snapshot,bank);paths++;
 }
 assert.equal(paths,256);
});
