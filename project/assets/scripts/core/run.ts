import { DraftBank, DraftQuestion, Domain, Route, ROUTES, STATIONS, hashText, stationCapacity } from './content';

export const RULESET = 'life-comic-slice-rules-v1';
export type Mode = 'timed' | 'relaxed';
export type Phase = 'map' | 'preparing' | 'question' | 'feedback' | 'stage-result' | 'failed' | 'result' | 'content-unavailable';
export type Outcome = 'correct' | 'wrong' | 'timeout' | 'skipped';
export interface QuestionState {
 id:string; instanceId:string; optionOrder:string[]; remainingMs:number; guardMs:number;
}
export interface HistoryEntry {
 questionId:string; instanceId:string; attemptId:string; stage:number; chosenId:string|null;
 outcome:Outcome; score:number; discarded:boolean;
}
export interface StationResult {
 stage:number; attemptId:string; route:Route|null; correct:number; wrong:number; timeouts:number;
 composure:number; answerScore:number; clearBonus:number;
}
export interface RunSnapshot {
 schema:2; appVersion:'0.1.0'; engineVersion:'3.8.8'; ruleset:string; bankVersion:string; bankHash:string;
 runId:string; seed:string; questionRng:number; optionRng:number; mode:Mode; phase:Phase;
 revision:number; stage:number; attemptNumber:number; instanceNumber:number; attemptId:string;
 routes:(Route|null)[]; completed:StationResult[]; correct:number; wrong:number; timeouts:number;
 composure:number; streak:number; attemptScore:number; skipped:number; freeRestarts:number;
 seenIds:string[]; seenClusters:string[]; history:HistoryEntry[]; current:QuestionState|null;
 feedbackNext:'question'|'stage-result'|'failed'|null; paused:boolean;
 terminalReason:'completed'|'failed'|'abandoned'|'content-unavailable'|null;
}
export interface CommandToken { runId:string; instanceId:string; revision:number }

function nextRandom(seed:number): {state:number;value:number} {
 const state=(Math.imul(seed,1664525)+1013904223)>>>0;
 return {state,value:state/0x100000000};
}
function fresh(bank:DraftBank,seed:string,mode:Mode):RunSnapshot {
 const runId=`comic-${seed}`;
 return {schema:2,appVersion:'0.1.0',engineVersion:'3.8.8',ruleset:RULESET,bankVersion:bank.version,bankHash:bank.hash,
  runId,seed,questionRng:parseInt(hashText(seed+'questions'),16),optionRng:parseInt(hashText(seed+'options'),16),mode,
  phase:'map',revision:0,stage:0,attemptNumber:1,instanceNumber:0,attemptId:`${runId}-a1`,
  routes:[null,null,null,null],completed:[],correct:0,wrong:0,timeouts:0,composure:3,streak:0,attemptScore:0,
  skipped:0,freeRestarts:0,seenIds:[],seenClusters:[],history:[],current:null,feedbackNext:null,paused:false,terminalReason:null};
}

/** All time is supplied by a monotonic caller. No nodes, files, SDK, or real clock. */
export class RunSession {
 private state:RunSnapshot;
 private lastNow:number;
 readonly restoreStatus:'new'|'restored';
 constructor(readonly bank:DraftBank,seed:string,mode:Mode,now:number,saved?:string) {
  if(!seed||seed.length>100||!['timed','relaxed'].includes(mode)||!Number.isFinite(now))throw new Error('invalid-run-input');
  this.state=saved ? validateRunSnapshot(JSON.parse(saved),bank) : fresh(bank,seed,mode);
  this.restoreStatus=saved?'restored':'new';
  // A reload cannot resume a reading clock without the player's explicit action.
  if(saved && ['question','preparing','feedback'].includes(this.state.phase))this.state.paused=true;
  this.lastNow=now;
 }
 get snapshot():Readonly<RunSnapshot> { return JSON.parse(this.serialize()) as RunSnapshot; }
 get phase():Phase {return this.state.phase;}
 get revision():number {return this.state.revision;}
 get paused():boolean {return this.state.paused;}
 get remainingMs():number {return this.state.current?.remainingMs??0;}
 get guardMs():number {return this.state.current?.guardMs??0;}
 get mode():Mode {return this.state.mode;}
 get question():DraftQuestion|undefined {return this.state.current ? this.bank.questions.find(q=>q.id===this.state.current!.id):undefined;}
 get token():CommandToken|null {
  return this.state.current ? {runId:this.state.runId,instanceId:this.state.current.instanceId,revision:this.state.revision}:null;
 }
 get score():number {
  return this.state.history.filter(h=>!h.discarded).reduce((n,h)=>n+h.score,0)
   +this.state.completed.reduce((n,s)=>n+s.clearBonus,0);
 }
 get stats():{correct:number;wrong:number;timeouts:number;settled:number;accuracy:number|null} {
  const history=this.state.history.filter(h=>!h.discarded && h.outcome!=='skipped');
  const correct=history.filter(h=>h.outcome==='correct').length;
  return {correct,wrong:history.filter(h=>h.outcome==='wrong').length,timeouts:history.filter(h=>h.outcome==='timeout').length,
   settled:history.length,accuracy:history.length?correct/history.length:null};
 }
 private touch():void {this.state.revision++;}
 private validToken(token:CommandToken):boolean {
  const current=this.state.current;
  return !!current && token.runId===this.state.runId && token.instanceId===current.instanceId && token.revision===this.state.revision;
 }
 selectRoute(route:Route):boolean {
  if(this.state.phase!=='map'||this.state.paused||!ROUTES[route]||ROUTES[route].stage!==this.state.stage)return false;
  this.state.routes[this.state.stage]=route;this.touch();return true;
 }
 startStation(now:number):boolean {
  this.advance(now);
  if(this.state.phase!=='map'||this.state.paused||([1,2].includes(this.state.stage)&&!this.state.routes[this.state.stage]))return false;
  this.deal();return true;
 }
 private eligible():DraftQuestion[] {
  const route=this.state.routes[this.state.stage];
  const settled=this.state.correct+this.state.wrong+this.state.timeouts;
  const previous=this.bank.questions.find(q=>q.id===this.state.seenIds[this.state.seenIds.length-1]);
  return this.bank.questions.filter(q=>q.stage===this.state.stage && !this.state.seenIds.includes(q.id)
   &&!this.state.seenClusters.includes(q.factCluster)
   &&!(q.cognition==='internet'&&previous?.cognition==='internet')
   &&!(this.state.stage===0&&settled<2&&q.cognition==='internet')
   &&!(route&&settled<2&&!ROUTES[route].domains.includes(q.domain)));
 }
 private candidate():{q:DraftQuestion;rng:number}|null {
  const candidates=this.eligible();if(!candidates.length)return null;
  const counts:Partial<Record<Domain,number>>={};
  for(const h of this.state.history.filter(h=>!h.discarded&&h.outcome!=='skipped')){
   const domain=this.bank.questions.find(q=>q.id===h.questionId)!.domain;counts[domain]=(counts[domain]??0)+1;
  }
  const least=Math.min(...candidates.map(q=>counts[q.domain]??0));
  const balanced=candidates.filter(q=>(counts[q.domain]??0)===least).sort((a,b)=>a.id.localeCompare(b.id));
  const random=nextRandom(this.state.questionRng);
  return {q:balanced[Math.floor(random.value*balanced.length)],rng:random.state};
 }
 private deal(preselected?:{q:DraftQuestion;rng:number}):void {
  const selected=preselected??this.candidate();
  this.state.feedbackNext=null;
  if(!selected){this.state.current=null;this.state.phase='content-unavailable';this.touch();return;}
  const q=selected.q,order=q.options.map(o=>o.id);
  this.state.questionRng=selected.rng;
  for(let i=order.length-1;i>0;i--){const r=nextRandom(this.state.optionRng);this.state.optionRng=r.state;
   const j=Math.floor(r.value*(i+1));[order[i],order[j]]=[order[j],order[i]];}
  this.state.instanceNumber++;
  this.state.current={id:q.id,instanceId:`${this.state.runId}-q${this.state.instanceNumber}`,optionOrder:order,
   remainingMs:q.seconds*1000,guardMs:350};
  this.state.seenIds.push(q.id);this.state.seenClusters.push(q.factCluster);
  this.state.phase='preparing';this.touch();
 }
 advance(now:number):boolean {
  if(!Number.isFinite(now)||now<this.lastNow)return false;
  let delta=now-this.lastNow;this.lastNow=now;
  const current=this.state.current;
  if(this.state.paused||!current)return false;
  let changed=false;
  if(this.state.phase==='preparing'){
   const used=Math.min(delta,current.guardMs);current.guardMs-=used;delta-=used;
   if(current.guardMs<=0){this.state.phase='question';this.touch();changed=true;}
  }
  if(this.state.phase==='question'&&this.state.mode==='timed'){
   current.remainingMs=Math.max(0,current.remainingMs-delta);
   if(current.remainingMs===0){this.settle('timeout',null);return true;}
  }else if(this.state.phase==='feedback')current.guardMs=Math.max(0,current.guardMs-delta);
  return changed;
 }
 submit(choiceId:string,now:number,token:CommandToken):Outcome|'ignored' {
  this.advance(now);
  const q=this.question;
  if(this.state.paused||this.state.phase!=='question'||!this.validToken(token)||!q?.options.some(o=>o.id===choiceId))return 'ignored';
  const outcome=choiceId===q.correctId?'correct':'wrong';this.settle(outcome,choiceId);return outcome;
 }
 private settle(outcome:'correct'|'wrong'|'timeout',choiceId:string|null):void {
  if(this.state.phase!=='question'||!this.state.current)return;
  let points=0;
  if(outcome==='correct'){
   this.state.correct++;this.state.streak++;
   points=100+(this.state.streak===1?0:this.state.streak===2?10:20);this.state.attemptScore+=points;
  }else{
   this.state.composure--;this.state.streak=0;
   if(outcome==='wrong')this.state.wrong++;else this.state.timeouts++;
  }
  this.state.history.push({questionId:this.state.current.id,instanceId:this.state.current.instanceId,
   attemptId:this.state.attemptId,stage:this.state.stage,chosenId:choiceId,outcome,score:points,discarded:false});
  this.state.phase='feedback';this.state.current.guardMs=350;
  if(this.state.correct===STATIONS[this.state.stage].target){
   this.state.completed.push({stage:this.state.stage,attemptId:this.state.attemptId,route:this.state.routes[this.state.stage],
    correct:this.state.correct,wrong:this.state.wrong,timeouts:this.state.timeouts,composure:this.state.composure,
    answerScore:this.state.attemptScore,clearBonus:200+50*this.state.composure});
   this.state.feedbackNext='stage-result';this.state.streak=0;
  }else this.state.feedbackNext=this.state.composure===0?'failed':'question';
  this.touch();
 }
 continueFeedback(now:number,token:CommandToken):boolean {
  this.advance(now);
  if(this.state.paused||this.state.phase!=='feedback'||!this.validToken(token)||this.state.current!.guardMs>0)return false;
  const destination=this.state.feedbackNext;
  if(destination==='question')this.deal();
  else if(destination){this.state.phase=destination;this.state.feedbackNext=null;this.touch();}
  return !!destination;
 }
 skip(now:number,token:CommandToken):'swapped'|'unavailable'|'ignored' {
  this.advance(now);
  if(this.state.paused||this.state.phase!=='question'||!this.validToken(token)||this.state.skipped!==0)return 'ignored';
  const selected=this.candidate();if(!selected)return 'unavailable';
  const current=this.state.current!;
  this.state.history.push({questionId:current.id,instanceId:current.instanceId,attemptId:this.state.attemptId,stage:this.state.stage,
   chosenId:null,outcome:'skipped',score:0,discarded:false});
  this.state.skipped=1;this.deal(selected);return 'swapped';
 }
 pause(now:number):boolean {
  this.advance(now);
  if(this.state.paused||this.state.phase==='result')return false;
  this.state.paused=true;this.touch();return true;
 }
 resume(now:number):boolean {
  this.advance(now);
  if(!this.state.paused)return false;
  this.state.paused=false;this.touch();return true;
 }
 nextStation(now:number):boolean {
  this.advance(now);
  if(this.state.phase!=='stage-result'||this.state.paused)return false;
  if(this.state.stage===3)return this.finish('completed',now);
  this.state.stage++;this.resetAttempt();this.state.phase='map';this.state.current=null;this.touch();return true;
 }
 private resetAttempt():void {
  this.state.attemptNumber++;this.state.attemptId=`${this.state.runId}-a${this.state.attemptNumber}`;
  this.state.correct=0;this.state.wrong=0;this.state.timeouts=0;this.state.composure=3;
  this.state.attemptScore=0;this.state.streak=0;this.state.feedbackNext=null;
 }
 get restartAvailability():{available:boolean;reason:string} {
  if(this.state.phase!=='failed')return {available:false,reason:'当前没有失败幕'};
  if(this.state.freeRestarts!==0)return {available:false,reason:'本局免费重整已使用'};
  const pool=this.bank.questions.filter(q=>q.stage===this.state.stage&&!this.state.seenIds.includes(q.id)&&!this.state.seenClusters.includes(q.factCluster));
  const route=this.state.routes[this.state.stage];
  const capacity=stationCapacity(pool,this.state.stage,route,this.state.skipped===0);
  if(!capacity.sufficient)return {available:false,reason:'本幕未见草稿题不足以支持完整重整，资源未消耗'};
  return {available:true,reason:'免费重整本幕，保留之前的站点和已见题'};
 }
 restartFailedStation(now:number):boolean {
  this.advance(now);
  if(this.state.paused||!this.restartAvailability.available)return false;
  for(const h of this.state.history)if(h.attemptId===this.state.attemptId)h.discarded=true;
  this.state.freeRestarts=1;this.resetAttempt();this.deal();return true;
 }
 finish(reason:NonNullable<RunSnapshot['terminalReason']>,now:number):boolean {
  this.advance(now);
  if(this.state.phase==='result'||(reason==='completed'&&this.state.completed.length!==4))return false;
  this.state.terminalReason=reason;this.state.phase='result';this.state.paused=false;this.state.streak=0;this.touch();return true;
 }
 serialize():string{return JSON.stringify(this.state);}
}

function integer(n:unknown,min:number,max:number):n is number {return typeof n==='number'&&Number.isInteger(n)&&n>=min&&n<=max;}
function shortString(s:unknown):s is string{return typeof s==='string'&&s.length>0&&s.length<=160;}
export function validateRunSnapshot(value:unknown,bank:DraftBank):RunSnapshot {
 if(!value||typeof value!=='object')throw new Error('save-object');
 const s=value as RunSnapshot;
 if(s.schema!==2||s.appVersion!=='0.1.0'||s.engineVersion!=='3.8.8'||s.ruleset!==RULESET||s.bankVersion!==bank.version||s.bankHash!==bank.hash)
  throw new Error('save-version');
 if(!shortString(s.runId)||!shortString(s.seed)||!shortString(s.attemptId)||!['timed','relaxed'].includes(s.mode)
  ||!['map','preparing','question','feedback','stage-result','failed','result','content-unavailable'].includes(s.phase)
  ||!integer(s.revision,0,100000)||!integer(s.stage,0,3)||!integer(s.attemptNumber,1,8)||!integer(s.instanceNumber,0,100)
  ||!integer(s.questionRng,0,0xffffffff)||!integer(s.optionRng,0,0xffffffff)||typeof s.paused!=='boolean'
  ||!integer(s.correct,0,STATIONS[s.stage].target)||!integer(s.wrong,0,3)||!integer(s.timeouts,0,3)
  ||!integer(s.composure,0,3)||s.composure!==3-s.wrong-s.timeouts||!integer(s.streak,0,5)
  ||!integer(s.attemptScore,0,10000)||!integer(s.skipped,0,1)||!integer(s.freeRestarts,0,1)
  ||!['question','stage-result','failed',null].includes(s.feedbackNext)
  ||!['completed','failed','abandoned','content-unavailable',null].includes(s.terminalReason))throw new Error('save-fields');
 if(!Array.isArray(s.routes)||s.routes.length!==4||s.routes[0]!==null||s.routes[3]!==null
  ||s.routes.some((r,i)=>r!==null&&(!ROUTES[r]||ROUTES[r].stage!==i)))throw new Error('save-routes');
 if(!Array.isArray(s.seenIds)||!Array.isArray(s.seenClusters)||s.seenIds.length>100||s.seenIds.length!==s.seenClusters.length
  ||new Set(s.seenIds).size!==s.seenIds.length||new Set(s.seenClusters).size!==s.seenClusters.length
  ||s.seenIds.length!==s.instanceNumber||s.seenIds.some((id,i)=>bank.questions.find(q=>q.id===id)?.factCluster!==s.seenClusters[i]))throw new Error('save-seen');
 if(!Array.isArray(s.history)||s.history.length>100||new Set(s.history.map(h=>h?.instanceId)).size!==s.history.length
  ||new Set(s.history.map(h=>h?.questionId)).size!==s.history.length)throw new Error('save-history');
 const attempts=new Map<string,{correct:number;wrong:number;timeouts:number;score:number;streak:number}>();
 let skips=0;
 for(const h of s.history){
  const q=bank.questions.find(q=>q.id===h?.questionId);
  if(!q||!s.seenIds.includes(q.id)||q.stage!==h.stage||!shortString(h.instanceId)||!shortString(h.attemptId)
   ||h.instanceId!==`${s.runId}-q${s.seenIds.indexOf(q.id)+1}`
   ||typeof h.discarded!=='boolean'||!['correct','wrong','timeout','skipped'].includes(h.outcome)||!integer(h.score,0,120)
   ||(['timeout','skipped'].includes(h.outcome)?h.chosenId!==null:!q.options.some(o=>o.id===h.chosenId)))throw new Error('save-history-item');
  if(h.outcome==='correct'&&h.chosenId!==q.correctId||h.outcome==='wrong'&&h.chosenId===q.correctId)throw new Error('save-answer');
  const a=attempts.get(h.attemptId)??{correct:0,wrong:0,timeouts:0,score:0,streak:0};
  let expected=0;
  if(h.outcome==='correct'){a.correct++;a.streak++;expected=100+(a.streak===1?0:a.streak===2?10:20);a.score+=expected;}
  else if(h.outcome==='skipped')skips++;
  else {a.streak=0;if(h.outcome==='wrong')a.wrong++;else a.timeouts++;}
  if(h.score!==expected)throw new Error('save-score');
  attempts.set(h.attemptId,a);
 }
 const active=attempts.get(s.attemptId)??{correct:0,wrong:0,timeouts:0,score:0,streak:0};
 const resetStreak=s.phase==='result'||s.phase==='stage-result'||s.feedbackNext==='stage-result';
 if(active.correct!==s.correct||active.wrong!==s.wrong||active.timeouts!==s.timeouts||active.score!==s.attemptScore
  ||skips!==s.skipped||s.history.some(h=>h.attemptId===s.attemptId&&h.discarded)
  ||s.streak!==(resetStreak?0:active.streak)||s.attemptNumber!==s.stage+1+s.freeRestarts
  ||s.attemptId!==`${s.runId}-a${s.attemptNumber}`
  ||new Set(s.history.filter(h=>h.discarded).map(h=>h.attemptId)).size!==s.freeRestarts)throw new Error('save-attempt');
 if(!Array.isArray(s.completed)||s.completed.length>4)throw new Error('save-completed');
 for(let i=0;i<s.completed.length;i++){
  const result=s.completed[i],a=attempts.get(result?.attemptId);
  if(!result||result.stage!==i||!a||result.route!==s.routes[i]||result.correct!==STATIONS[i].target
   ||result.correct!==a.correct||result.wrong!==a.wrong||result.timeouts!==a.timeouts||result.answerScore!==a.score
   ||result.composure!==3-result.wrong-result.timeouts||result.composure<1||result.clearBonus!==200+50*result.composure
   ||s.history.some(h=>h.attemptId===result.attemptId&&h.discarded))throw new Error('save-stage-result');
 }
 if(s.completed.length<s.stage||s.completed.length>s.stage+1||(s.phase==='result')!==(s.terminalReason!==null)
  ||s.terminalReason==='completed'&&s.completed.length!==4
  ||s.phase==='failed'&&s.composure!==0||s.phase==='stage-result'&&s.completed.length!==s.stage+1
  ||s.phase==='map'&&(s.current!==null||s.completed.length!==s.stage)
  ||s.phase==='feedback'&&s.feedbackNext===null)throw new Error('save-flow');
 if(s.current){
  const q=bank.questions.find(q=>q.id===s.current!.id);
  if(!q||q.stage!==s.stage||s.seenIds[s.seenIds.length-1]!==q.id||!shortString(s.current.instanceId)
   ||s.current.instanceId!==`${s.runId}-q${s.instanceNumber}`
   ||!Array.isArray(s.current.optionOrder)||s.current.optionOrder.length!==q.options.length
   ||new Set(s.current.optionOrder).size!==q.options.length||s.current.optionOrder.some(id=>!q.options.some(o=>o.id===id))
   ||typeof s.current.remainingMs!=='number'||!Number.isFinite(s.current.remainingMs)||s.current.remainingMs<0||s.current.remainingMs>q.seconds*1000
   ||typeof s.current.guardMs!=='number'||!Number.isFinite(s.current.guardMs)||s.current.guardMs<0||s.current.guardMs>350)
   throw new Error('save-current');
  const settled=s.history.some(h=>h.instanceId===s.current!.instanceId);
  if(['question','preparing'].includes(s.phase)&&settled||['feedback','failed','stage-result'].includes(s.phase)&&!settled)throw new Error('save-current-flow');
 }else if(['question','preparing','feedback','failed','stage-result'].includes(s.phase))throw new Error('save-missing-question');
 return JSON.parse(JSON.stringify(s)) as RunSnapshot;
}
