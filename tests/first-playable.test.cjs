const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {parseDraftBank,STATIONS,ROUTES,hashText,bankCapacityCertificates,stationCapacity}=require('../.test-dist/core/content.js');
const {RunSession,validateRunSnapshot}=require('../.test-dist/core/run.js');
const {RunSaveRepository,runSavePrefix}=require('../.test-dist/platform/run-save.js');
const {phoneLayout,questionGeometry,reviewGeometry}=require('../.test-dist/ui/layout.js');
const raw=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../project/assets/resources/draft-bank.json'),'utf8'));
const bank=parseDraftBank(raw);
const RUN_SAVE_PREFIX=runSavePrefix(bank);
function context(seed='test-seed',mode='timed',customBank=bank){return {s:new RunSession(customBank,seed,mode,0),now:0};}
function advance(x,ms){x.now+=ms;x.s.advance(x.now);}
function start(x,route){if(route)assert.equal(x.s.selectRoute(route),true);assert.equal(x.s.startStation(x.now),true);advance(x,350);}
function answer(x,correct=true){if(x.s.snapshot.phase==='preparing')advance(x,350);assert.equal(x.s.snapshot.phase,'question');const q=x.s.question;
 const id=correct?q.correctId:q.options.find(o=>o.id!==q.correctId).id;
 assert.equal(x.s.submit(id,x.now,x.s.token),correct?'correct':'wrong');
 assert.equal(x.s.snapshot.phase,'feedback');advance(x,350);assert.equal(x.s.continueFeedback(x.now,x.s.token),true);
 if(x.s.snapshot.phase==='preparing')advance(x,350);
}
function clear(x,route){start(x,route);const target=STATIONS[x.s.snapshot.stage].target;for(let i=0;i<target;i++)answer(x);assert.equal(x.s.snapshot.phase,'stage-result');}
function toStage(x,stage,routes=['travel','media']){for(let i=0;i<stage;i++){clear(x,i===1?routes[0]:i===2?routes[1]:undefined);assert.equal(x.s.nextStation(x.now),true);}}
function fail(x){for(let i=0;i<3;i++)answer(x,false);assert.equal(x.s.snapshot.phase,'failed');}
function memory(){const values=new Map();return {values,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};}
function copy(){return JSON.parse(JSON.stringify(raw));}

test('draft bank contains 67 original items, certified station pools, unique fact clusters and 2/4 choices',()=>{
 assert.equal(bank.questions.length,67);assert.deepEqual(STATIONS.map((_,i)=>bank.questions.filter(q=>q.stage===i).length),[11,20,21,15]);
 assert.equal(new Set(bank.questions.map(q=>q.factCluster)).size,67);assert.deepEqual(new Set(bank.questions.map(q=>q.options.length)),new Set([2,4]));
 assert.equal(raw.independentDoubleReviewCompleted,false);assert.equal(raw.scope,'prototype-draft');
});
test('bank schema refuses duplicate question IDs and fact clusters',()=>{
 let value=copy();value.questions[1].id=value.questions[0].id;assert.throws(()=>parseDraftBank(value));
 value=copy();value.questions[1].factCluster=value.questions[0].factCluster;assert.throws(()=>parseDraftBank(value));
});
test('bank refuses missing correct choice, duplicate option text and absent wrong-answer notes',()=>{
 let value=copy();value.questions[0].correctId='missing';assert.throws(()=>parseDraftBank(value));
 value=copy();value.questions[0].options[1].text=value.questions[0].options[0].text;assert.throws(()=>parseDraftBank(value));
 value=copy();value.questions[0].distractorNotes={};assert.throws(()=>parseDraftBank(value));
});
test('bank refuses overlong prompts and incomplete normal-run pools',()=>{
 let value=copy();value.questions[0].prompt='字'.repeat(56);assert.throws(()=>parseDraftBank(value));
 value=copy();value.questions=value.questions.filter(q=>q.stage!==3||q.id.endsWith('01'));assert.throws(()=>parseDraftBank(value));
});
test('initial map has exactly one current station and no illustrative completed state',()=>{
 const {s}=context();assert.equal(s.snapshot.stage,0);assert.deepEqual(s.snapshot.completed,[]);assert.equal(s.snapshot.phase,'map');
 assert.equal(s.snapshot.composure,3);assert.deepEqual(STATIONS.map(s=>s.target),[3,4,4,5]);
});
test('full four-station loop is playable as state flow and all-correct score is exactly 3200',()=>{
 const x=context();for(let stage=0;stage<4;stage++){
  clear(x,stage===1?'travel':stage===2?'media':undefined);
  assert.equal(x.s.snapshot.composure,3);assert.equal(x.s.snapshot.completed.length,stage+1);
  assert.equal(x.s.nextStation(x.now),true);
 }
 assert.equal(x.s.snapshot.phase,'result');assert.equal(x.s.snapshot.terminalReason,'completed');
 assert.equal(x.s.score,3200);assert.deepEqual(x.s.stats,{correct:16,wrong:0,timeouts:0,settled:16,accuracy:1});
 assert.equal(x.s.finish('completed',x.now),false);assert.equal(x.s.score,3200);
});
test('each station starts at 3 composure; correct answers do not heal',()=>{
 const x=context();start(x);answer(x,false);assert.equal(x.s.snapshot.composure,2);answer(x);assert.equal(x.s.snapshot.composure,2);
 answer(x);answer(x);assert.equal(x.s.snapshot.phase,'stage-result');x.s.nextStation(x.now);assert.equal(x.s.snapshot.composure,3);
});
test('score vector correct/correct/wrong/correct/correct is 720 for target four',()=>{
 const x=context();toStage(x,1);start(x,'travel');const before=x.s.score;
 for(const result of [true,true,false,true,true])answer(x,result);
 const result=x.s.snapshot.completed[1];assert.equal(result.answerScore,420);assert.equal(result.clearBonus,300);assert.equal(x.s.score-before,720);
});
test('targets clear immediately on submission; explanatory feedback still requires a new action',()=>{
 const x=context();start(x);answer(x);answer(x);const q=x.s.question;
 assert.equal(x.s.submit(q.correctId,x.now,x.s.token),'correct');assert.equal(x.s.snapshot.completed.length,1);
 assert.equal(x.s.snapshot.phase,'feedback');assert.equal(x.s.snapshot.feedbackNext,'stage-result');assert.equal(x.s.nextStation(x.now),false);
});
test('double submissions and stale feedback tokens cannot add points or answer a new question',()=>{
 const x=context();start(x);const token=x.s.token,q=x.s.question;
 assert.equal(x.s.submit(q.correctId,x.now,token),'correct');assert.equal(x.s.submit(q.correctId,x.now,token),'ignored');assert.equal(x.s.score,100);
 assert.equal(x.s.continueFeedback(x.now,x.s.token),false);advance(x,350);const feedbackToken=x.s.token;
 assert.equal(x.s.continueFeedback(x.now,feedbackToken),true);advance(x,350);
 assert.equal(x.s.submit(x.s.question.correctId,x.now,token),'ignored');assert.equal(x.s.continueFeedback(x.now,feedbackToken),false);assert.equal(x.s.score,100);
});
test('preparing gate rejects early input for 350 milliseconds',()=>{
 const x=context();x.s.startStation(x.now);assert.equal(x.s.submit(x.s.question.correctId,x.now,x.s.token),'ignored');
 advance(x,349);assert.equal(x.s.snapshot.phase,'preparing');advance(x,1);assert.equal(x.s.snapshot.phase,'question');
});
test('deadline equality commits one timeout even when an answer races it',()=>{
 const x=context();start(x);const token=x.s.token,id=x.s.question.correctId;
 x.now+=x.s.snapshot.current.remainingMs;assert.equal(x.s.submit(id,x.now,token),'ignored');
 assert.equal(x.s.snapshot.history.length,1);assert.equal(x.s.snapshot.history[0].outcome,'timeout');assert.equal(x.s.snapshot.composure,2);
 x.s.advance(x.now);assert.equal(x.s.submit(id,x.now,token),'ignored');assert.equal(x.s.snapshot.history.length,1);
});
test('answer strictly before deadline wins and cannot be replaced by a late timeout',()=>{
 const x=context();start(x);x.now+=x.s.snapshot.current.remainingMs-0.1;
 assert.equal(x.s.submit(x.s.question.correctId,x.now,x.s.token),'correct');advance(x,5000);
 assert.equal(x.s.snapshot.history.length,1);assert.equal(x.s.snapshot.history[0].outcome,'correct');
});
test('slow mode never times out and has a separate mode marker',()=>{
 const x=context('slow','relaxed');start(x);advance(x,999999);assert.equal(x.s.snapshot.phase,'question');assert.equal(x.s.snapshot.history.length,0);
 answer(x);assert.equal(x.s.snapshot.mode,'relaxed');
});
test('pause and background-style suspension freeze remaining time until explicit resume',()=>{
 const x=context();start(x);advance(x,500);x.s.pause(x.now);const time=x.s.snapshot.current.remainingMs;
 advance(x,50000);assert.equal(x.s.snapshot.current.remainingMs,time);assert.equal(x.s.submit(x.s.question.correctId,x.now,x.s.token),'ignored');
 x.s.resume(x.now);advance(x,500);assert.equal(x.s.snapshot.current.remainingMs,time-500);
});
test('pause at expired deadline settles timeout before hiding; resume cannot restore positive time',()=>{
 const x=context();start(x);x.now+=x.s.snapshot.current.remainingMs;x.s.pause(x.now);
 assert.equal(x.s.snapshot.phase,'feedback');assert.equal(x.s.snapshot.current.remainingMs,0);assert.equal(x.s.snapshot.history[0].outcome,'timeout');
 x.s.resume(x.now);assert.equal(x.s.snapshot.current.remainingMs,0);
});
test('skip is atomic, remains in seen history, keeps streak and does not count as an answer',()=>{
 const x=context();start(x);answer(x);const oldId=x.s.question.id,streak=x.s.snapshot.streak;
 assert.equal(x.s.skip(x.now,x.s.token),'swapped');assert.equal(x.s.snapshot.streak,streak);assert.equal(x.s.stats.settled,1);
 assert.notEqual(x.s.question.id,oldId);assert.equal(x.s.snapshot.seenIds.includes(oldId),true);assert.equal(x.s.snapshot.skipped,1);
 advance(x,350);assert.equal(x.s.skip(x.now,x.s.token),'ignored');
});
test('skip at deadline cannot rescue an expired question or consume the coupon',()=>{
 const x=context();start(x);const token=x.s.token;x.now+=x.s.snapshot.current.remainingMs;
 assert.equal(x.s.skip(x.now,token),'ignored');assert.equal(x.s.snapshot.skipped,0);assert.equal(x.s.stats.timeouts,1);
});
test('no replacement leaves skip coupon and current question unchanged',()=>{
 const tiny={...bank,questions:bank.questions.filter(q=>q.stage!==0||q.id==='comic-s1-01')};
 const x=context('tiny','timed',tiny);start(x);const id=x.s.question.id;
 assert.equal(x.s.skip(x.now,x.s.token),'unavailable');assert.equal(x.s.snapshot.skipped,0);assert.equal(x.s.question.id,id);
});
test('route preview is changeable before entry, required in middle stations and locked after entry',()=>{
 const x=context();toStage(x,1);assert.equal(x.s.startStation(x.now),false);assert.equal(x.s.selectRoute('media'),false);
 assert.equal(x.s.selectRoute('travel'),true);assert.equal(x.s.selectRoute('nature'),true);start(x);
 assert.equal(x.s.selectRoute('travel'),false);assert.equal(x.s.snapshot.routes[1],'nature');
});
test('route first-two promise survives wrong answers and skip without advancing its slot',()=>{
 const x=context('routes');toStage(x,1);start(x,'travel');assert.equal(x.s.question.domain,'travel');
 assert.equal(x.s.skip(x.now,x.s.token),'swapped');advance(x,350);assert.equal(x.s.question.domain,'travel');
 answer(x,false);assert.equal(x.s.question.domain,'travel');
});
test('free failed-station restart removes only its attempt score and preserves previous stations, route and seen',()=>{
 const x=context('restart');toStage(x,1);const retained=x.s.score;start(x,'travel');answer(x);fail(x);
 const seen=[...x.s.snapshot.seenIds];assert.equal(x.s.score,retained+100);assert.equal(x.s.restartFailedStation(x.now),true);
 assert.equal(x.s.score,retained);assert.equal(x.s.snapshot.completed.length,1);assert.equal(x.s.snapshot.routes[1],'travel');
 assert.equal(x.s.snapshot.correct,0);assert.equal(x.s.snapshot.composure,3);assert.equal(x.s.snapshot.streak,0);assert.equal(x.s.snapshot.freeRestarts,1);
 assert.equal(seen.every(id=>x.s.snapshot.seenIds.includes(id)),true);assert.equal(seen.includes(x.s.question.id),false);
 validateRunSnapshot(x.s.snapshot,bank);
});
test('free restart never replenishes skip and is allowed only once per run',()=>{
 const x=context('once');start(x);x.s.skip(x.now,x.s.token);advance(x,350);fail(x);
 assert.equal(x.s.restartFailedStation(x.now),true);assert.equal(x.s.snapshot.skipped,1);advance(x,350);fail(x);
 assert.equal(x.s.restartFailedStation(x.now),false);assert.equal(x.s.snapshot.freeRestarts,1);
 assert.equal(x.s.finish('failed',x.now),true);assert.equal(x.s.snapshot.phase,'result');
});
test('draft capacity failure disables impossible restart without consuming it or repeating a seen fact',()=>{
 const oldTenItemPool={...bank,questions:bank.questions.filter(q=>q.stage!==3||Number(q.id.slice(-2))<=10)};
 const x=context('capacity','timed',oldTenItemPool);toStage(x,3);start(x);for(let i=0;i<4;i++)answer(x);fail(x);
 assert.equal(x.s.restartAvailability.available,false);assert.match(x.s.restartAvailability.reason,/草稿题不足/);
 const seen=x.s.snapshot.seenIds.length;assert.equal(x.s.restartFailedStation(x.now),false);assert.equal(x.s.snapshot.freeRestarts,0);assert.equal(x.s.snapshot.seenIds.length,seen);
});
test('runtime content exhaustion preserves composure and exposes a non-player-failure state',()=>{
 const tiny={...bank,questions:bank.questions.filter(q=>q.stage!==0||q.id==='comic-s1-01')};const x=context('empty','timed',tiny);
 start(x);answer(x);assert.equal(x.s.snapshot.phase,'content-unavailable');assert.equal(x.s.snapshot.composure,3);assert.equal(x.s.stats.wrong,0);
 assert.equal(x.s.finish('content-unavailable',x.now),true);
});
test('seed plus route and commands replay exact question and option sequences',()=>{
 const a=context('repro'),b=context('repro');for(let stage=0;stage<4;stage++){
  const route=stage===1?'nature':stage===2?'interests':undefined;start(a,route);start(b,route);
  for(let i=0;i<STATIONS[stage].target;i++){assert.deepEqual(a.s.snapshot.current,b.s.snapshot.current);answer(a);answer(b);}
  a.s.nextStation(a.now);b.s.nextStation(b.now);
 }assert.equal(a.s.serialize(),b.s.serialize());
});
test('all four route combinations across 64 seeds finish normally with two mistakes per station plus one skip and no repeats',()=>{
 for(const route2 of ['travel','nature'])for(const route3 of ['media','interests'])for(let seed=0;seed<64;seed++){
  const x=context(`normal-${seed}-${route2}-${route3}`);
  for(let stage=0;stage<4;stage++){
   start(x,stage===1?route2:stage===2?route3:undefined);
   if(stage===0){assert.equal(x.s.skip(x.now,x.s.token),'swapped');advance(x,350);}
   answer(x,false);answer(x,false);for(let i=0;i<STATIONS[stage].target;i++)answer(x);
   assert.equal(x.s.snapshot.phase,'stage-result');x.s.nextStation(x.now);
  }
  assert.equal(x.s.snapshot.phase,'result');assert.equal(x.s.stats.settled,24);assert.equal(x.s.snapshot.seenIds.length,25);
  assert.equal(new Set(x.s.snapshot.seenClusters).size,25);
  const cognitions=x.s.snapshot.seenIds.map(id=>bank.questions.find(q=>q.id===id).cognition);
  assert.equal(cognitions.some((c,i)=>c==='internet'&&cognitions[i-1]==='internet'),false);
  validateRunSnapshot(x.s.snapshot,bank);
 }
});
test('valid save restores identical question, option order, resources and time, paused without clock catch-up',()=>{
 const x=context();start(x);advance(x,1250);const before=x.s.snapshot;
 const restored=new RunSession(bank,'unused','relaxed',900000,x.s.serialize());
 assert.deepEqual(restored.snapshot.current,before.current);assert.equal(restored.snapshot.paused,true);assert.equal(restored.snapshot.mode,'timed');
 restored.advance(999999);assert.equal(restored.snapshot.current.remainingMs,before.current.remainingMs);
});
test('submitted feedback survives restart and cannot award or submit twice',()=>{
 const x=context();start(x);x.s.submit(x.s.question.correctId,x.now,x.s.token);
 const restored=new RunSession(bank,'fallback','timed',100,x.s.serialize());assert.equal(restored.snapshot.phase,'feedback');assert.equal(restored.score,100);
 restored.resume(100);assert.equal(restored.submit(restored.question.correctId,100,restored.token),'ignored');assert.equal(restored.score,100);
});
test('all normal flow snapshots including failed, restarted and final states validate',()=>{
 const x=context('allstates');validateRunSnapshot(x.s.snapshot,bank);start(x);validateRunSnapshot(x.s.snapshot,bank);fail(x);
 validateRunSnapshot(x.s.snapshot,bank);x.s.restartFailedStation(x.now);validateRunSnapshot(x.s.snapshot,bank);advance(x,350);fail(x);
 x.s.finish('failed',x.now);validateRunSnapshot(x.s.snapshot,bank);
});
test('forged scores, repeated history, changed option order, bank version and streak are refused',()=>{
 const x=context();start(x);answer(x);const mutate=f=>{const s=x.s.snapshot;f(s);assert.throws(()=>validateRunSnapshot(s,bank));};
 mutate(s=>s.attemptScore+=100);mutate(s=>s.history.push({...s.history[0]}));mutate(s=>s.current.optionOrder[0]='bad');
 mutate(s=>s.bankVersion='future-bank');mutate(s=>s.streak=5);mutate(s=>s.seenClusters[0]='fake');
});
test('dual-slot save verifies readback and falls back to previous valid snapshot after corruption',()=>{
 const store=memory(),repo=new RunSaveRepository(store,bank),x=context('slots');repo.load(0,'fallback','timed');
 start(x);assert.equal(repo.save(x.s).ok,true);const firstId=x.s.question.id;answer(x);assert.equal(repo.save(x.s).ok,true);
 store.values.set(`${RUN_SAVE_PREFIX}.0`,'{broken');const restored=new RunSaveRepository(store,bank).load(10000,'new','timed');
 assert.equal(restored.status,'fallback');assert.equal(restored.session.question.id,firstId);assert.equal(restored.session.snapshot.paused,true);
});
test('both damaged slots are reported instead of pretending to restore',()=>{
 const store=memory();store.values.set(`${RUN_SAVE_PREFIX}.0`,'broken');store.values.set(`${RUN_SAVE_PREFIX}.1`,'broken');
 const loaded=new RunSaveRepository(store,bank).load(0,'new','timed');assert.equal(loaded.status,'invalid');assert.equal(loaded.session.snapshot.phase,'map');
});
test('future and incompatible saves are protected against overwrite',()=>{
 for(const type of ['envelope','payload']){
  const store=memory(),x=context('future');let envelope;
  if(type==='envelope')envelope={schema:2,sequence:1,payload:'future',checksum:'unused'};
  else{const data=x.s.snapshot;data.schema=3;const payload=JSON.stringify(data);envelope={schema:1,sequence:1,payload,checksum:hashText(`1:${payload}`)};}
  const original=JSON.stringify(envelope);store.values.set(`${RUN_SAVE_PREFIX}.1`,original);
  const repo=new RunSaveRepository(store,bank),loaded=repo.load(0,'new','timed');assert.equal(loaded.status,'incompatible');
  assert.equal(repo.save(loaded.session).ok,false);assert.equal(store.values.get(`${RUN_SAVE_PREFIX}.1`),original);
 }
});
test('storage errors remain visible; failed write preserves in-memory play and can retry',()=>{
 const store=memory(),repo=new RunSaveRepository(store,bank),x=context('save-error');repo.load(0,'new','timed');start(x);answer(x);
 const original=store.setItem;store.setItem=()=>{throw Error('full');};assert.equal(repo.save(x.s).ok,false);assert.equal(x.s.score,100);
 store.setItem=original;assert.equal(repo.save(x.s).ok,true);assert.equal(new RunSaveRepository(store,bank).load(0,'new','timed').session.score,100);
});
test('read exceptions protect previous data and disable uncertain writes',()=>{
 const store={getItem(){throw Error('read denied');},setItem(){throw Error('must not write');}};
 const repo=new RunSaveRepository(store,bank),loaded=repo.load(0,'new','timed');assert.equal(loaded.status,'read-error');assert.equal(repo.save(loaded.session).ok,false);
});
test('abandoning an unanswered run records no invented answer; replay is a new run with fresh resources',()=>{
 const x=context('old');start(x);assert.equal(x.s.finish('abandoned',x.now),true);assert.equal(x.s.stats.settled,0);assert.equal(x.s.stats.accuracy,null);
 const replay=context('new');assert.notEqual(replay.s.snapshot.runId,x.s.snapshot.runId);assert.deepEqual(replay.s.snapshot.seenIds,[]);assert.equal(replay.s.snapshot.freeRestarts,0);
});
test('phone geometry keeps all four answer targets and action inside safe bounds, with no target below 48 logical pixels',()=>{
 for(const safe of [{x:0,y:0,width:390,height:844},{x:0,y:34,width:390,height:763},{x:24,y:40,width:342,height:723}]){
  const layout=phoneLayout(safe),g=questionGeometry(layout,4);assert.ok(layout.width>=300);assert.ok(g.optionHeight>=48);
  assert.ok(g.cardTop+g.cardHeight<g.optionTop);
  const optionBottom=g.optionTop+4*g.optionHeight+3*g.optionGap;assert.ok(optionBottom<g.actionTop);
  assert.ok(g.actionTop+54<844-layout.bottom);assert.ok(g.footerTop+30<844-layout.bottom);
 }
});
test('invalid safe-area input falls back safely, and unsupported choice count is rejected',()=>{
 const layout=phoneLayout({x:NaN,y:0,width:0,height:0});assert.equal(layout.width,358);assert.equal(layout.top,52);assert.throws(()=>questionGeometry(layout,3));
});


test('password scenario states the required password before grounding the correct message',()=>{
 const q=bank.questions.find(q=>q.id==='comic-s1-03');
 assert.match(q.prompt,/口令.*“向日葵”/);assert.match(q.prompt,/口令＋.*昵称/);assert.match(q.prompt,/昵称.*“小满”/);
 assert.equal(q.options.find(o=>o.id===q.correctId).text,'向日葵＋小满');assert.ok(q.revision>=2);
});
test('quantity and redemption drafts ask exactly the conditions established in their scenarios',()=>{
 const quantity=bank.questions.find(q=>q.id==='comic-s1-09'),redemption=bank.questions.find(q=>q.id==='comic-s1-06');
 assert.match(quantity.prompt,/每人任选一件/);assert.match(quantity.prompt,/一个人/);
 assert.equal(quantity.options.some(o=>o.text==='各拿一件'),false);assert.equal(quantity.options[0].text,'每种道具都拿一件');
 assert.match(redemption.prompt,/再次核销/);assert.equal(redemption.prompt.includes('再入场'),false);
 assert.deepEqual(redemption.options.map(o=>o.text),['可以再次核销','不能再次核销']);
 assert.equal(quantity.revision,2);assert.equal(redemption.revision,2);
});
test('every station and route has a conservative initial free-restart certificate; old normal-only bank is rejected',()=>{
 const certificates=bankCapacityCertificates(bank);assert.equal(certificates.length,6);
 assert.equal(certificates.every(c=>c.certificate.sufficient),true);
 const media=certificates.find(c=>c.route==='media');assert.equal(media.certificate.available.prefixNonInternet,9);
 assert.equal(media.certificate.required.prefixNonInternet,9);
 const value=copy();value.questions=value.questions.filter(q=>Number(q.id.slice(-2))<=10);
 assert.throws(()=>parseDraftBank(value),/免费重整/);
});
test('restart preflight includes two errors plus remaining skip, prefix debt and internet separation',()=>{
 const stage4=bank.questions.filter(q=>q.stage===3);
 assert.equal(stationCapacity(stage4.slice(0,6),3,null,false).sufficient,false); // five correct + two possible mistakes need seven
 const routePool=bank.questions.filter(q=>q.stage===2&&q.domain==='digital');
 const mostlyInternet=routePool.filter(q=>q.cognition==='internet').concat(routePool.filter(q=>q.cognition!=='internet').slice(0,2));
 assert.equal(stationCapacity(mostlyInternet,2,'media',true).sufficient,false);
 const noPrefix=bank.questions.filter(q=>q.stage===2&&q.domain!=='digital');
 assert.equal(stationCapacity(noPrefix,2,'media',false).sufficient,false);
});
test('media-route free restart is reachable after consuming its first two promised slots',()=>{
 const x=context('media-restart-regression');toStage(x,2);start(x,'media');fail(x);
 assert.equal(x.s.restartAvailability.available,true);const seen=[...x.s.snapshot.seenIds];
 assert.equal(x.s.restartFailedStation(x.now),true);advance(x,350);
 for(let i=0;i<2;i++){assert.equal(x.s.question.domain,'digital');answer(x);}
 for(let i=2;i<4;i++)answer(x);
 assert.equal(x.s.phase,'stage-result');assert.equal(seen.every(id=>x.s.snapshot.seenIds.includes(id)),true);
 assert.equal(new Set(x.s.snapshot.seenIds).size,x.s.snapshot.seenIds.length);validateRunSnapshot(x.s.snapshot,bank);
});
test('stage-four one-correct failure followed by two errors still finishes five-correct restart',()=>{
 const x=context('stage4-review-regression');toStage(x,3);start(x);answer(x);fail(x);
 assert.equal(x.s.restartAvailability.available,true);assert.equal(x.s.restartFailedStation(x.now),true);advance(x,350);
 answer(x,false);answer(x,false);for(let i=0;i<5;i++)answer(x);
 assert.equal(x.s.phase,'stage-result');assert.equal(x.s.snapshot.composure,1);
 assert.equal(x.s.snapshot.completed[3].correct,5);validateRunSnapshot(x.s.snapshot,bank);
});
test('512 worst-length runtime restart paths finish without repetition or content exhaustion',()=>{
 let paths=0;
 for(const route2 of ['travel','nature'])for(const route3 of ['media','interests'])for(let seed=0;seed<16;seed++)
  for(let stage=0;stage<4;stage++)for(const skipPhase of ['before-failure','after-restart']){
   const routes=[route2,route3],x=context(`worst-${seed}-${stage}-${skipPhase}-${routes}`);
   toStage(x,stage,routes);start(x,stage===1?route2:stage===2?route3:undefined);
   if(skipPhase==='before-failure'){assert.equal(x.s.skip(x.now,x.s.token),'swapped');advance(x,350);}
   for(let i=0;i<STATIONS[stage].target-1;i++)answer(x);fail(x);
   assert.equal(x.s.restartAvailability.available,true);assert.equal(x.s.restartFailedStation(x.now),true);advance(x,350);
   if(skipPhase==='after-restart'){assert.equal(x.s.skip(x.now,x.s.token),'swapped');advance(x,350);}
   answer(x,false);answer(x,false);for(let i=0;i<STATIONS[stage].target;i++)answer(x);
   assert.equal(x.s.phase,'stage-result');assert.equal(x.s.snapshot.composure,1);
   const shown=x.s.snapshot.seenIds.map(id=>bank.questions.find(q=>q.id===id));
   assert.equal(new Set(shown.map(q=>q.id)).size,shown.length);assert.equal(new Set(shown.map(q=>q.factCluster)).size,shown.length);
   assert.equal(shown.some((q,i)=>q.cognition==='internet'&&shown[i-1]?.cognition==='internet'),false);
   validateRunSnapshot(x.s.snapshot,bank);paths++;
  }
 assert.equal(paths,512);
});
test('exhaustive independent category proof covers every legal restarted outcome and skip suffix',()=>{
 const {proveCapacity}=require('./capacity-proof.cjs');const proof=proveCapacity(bank);
 assert.ok(proof.removalCases>0);assert.ok(proof.suffixStates>0);
 fs.writeFileSync(require('node:path').join(__dirname,'../evidence/capacity-proof.json'),JSON.stringify({
  bankVersion:bank.version,bankHash:bank.hash,
  sourceBankSHA256:require('node:crypto').createHash('sha256').update(fs.readFileSync(require('node:path').join(__dirname,'../project/assets/resources/draft-bank.json'))).digest('hex'),
  certificates:bankCapacityCertificates(bank),runtimeWorstPaths:512,...proof},null,2)+'\n');
});
test('future or incompatible app and engine versions protect both slots even alongside a valid older slot',()=>{
 for(const [field,value] of [['appVersion','0.3.0'],['engineVersion','3.9.0'],['appVersion','0.0.9'],['engineVersion','3.8.7']]){
  const store=memory(),x=context(`future-${field}-${value}`),writer=new RunSaveRepository(store,bank);
  writer.load(0,'new','timed');assert.equal(writer.save(x.s).ok,true);
  const data=x.s.snapshot;data[field]=value;const payload=JSON.stringify(data);
  const envelope={schema:1,sequence:2,payload,checksum:hashText(`2:${payload}`)};
  store.values.set(`${RUN_SAVE_PREFIX}.0`,JSON.stringify(envelope));const before=new Map(store.values);
  const reader=new RunSaveRepository(store,bank),loaded=reader.load(0,'fallback','timed');
  assert.equal(loaded.status,'incompatible');assert.equal(reader.save(loaded.session).ok,false);
  assert.deepEqual(store.values,before);
 }
});
test('review navigation never overlaps explanation and all three targets stay inside safe bounds',()=>{
 for(const safe of [{x:0,y:0,width:390,height:844},{x:0,y:34,width:390,height:763},{x:24,y:40,width:342,height:723}]){
  const layout=phoneLayout(safe),g=reviewGeometry(layout);
  assert.ok(g.navTop>=g.explanationBottom+8);assert.ok(g.navTop+g.buttonHeight<844-layout.bottom);
  assert.equal(g.buttons.length,3);
  for(const b of g.buttons){assert.ok(b.width>=48);assert.ok(g.buttonHeight>=48);
   assert.ok(b.x-b.width/2>=layout.left-1e-9);assert.ok(b.x+b.width/2<=390-layout.right+1e-9);}
  for(let i=1;i<3;i++)assert.ok(g.buttons[i].x-g.buttons[i].width/2>g.buttons[i-1].x+g.buttons[i-1].width/2);
 }
});
