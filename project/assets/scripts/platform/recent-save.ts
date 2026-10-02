import { hashText } from '../core/content';
import { RecentRun, recordRecentRun, validateRecentRuns } from '../core/recent';
import { RunSession } from '../core/run';
import { KeyValueStore } from './contracts';

export const RECENT_SAVE_PREFIX='life-comic.recent.v1';
interface Envelope {schema:1;sequence:number;payload:string;checksum:string}
export class RecentSaveRepository {
 private runs:RecentRun[]=[];
 private sequence=0;
 private blocked=false;
 private loaded=false;
 private dirty=false;
 get needsRetry():boolean {return this.dirty&&!this.blocked;}
 get history():RecentRun[] {return validateRecentRuns(this.runs);}
 load():{runs:RecentRun[];status:'new'|'restored'|'fallback'|'invalid'|'incompatible'|'read-error';note:string} {
  const valid:{envelope:Envelope;runs:RecentRun[]}[]=[];let found=0,bad=0;
  try{
   for(let slot=0;slot<2;slot++){
    const raw=this.storage.getItem(`${RECENT_SAVE_PREFIX}.${slot}`);if(raw===null)continue;found++;
    try{
     if(raw.length>150000)throw new Error('recent-size');
     const e=JSON.parse(raw) as Envelope;
     if(typeof e.schema==='number'&&e.schema>1){this.blocked=true;continue;}
     if(e.schema!==1||!Number.isSafeInteger(e.sequence)||e.sequence<1||e.sequence>=Number.MAX_SAFE_INTEGER
      ||typeof e.payload!=='string'||e.checksum!==hashText(`${e.sequence}:${e.payload}`))throw new Error('recent-envelope');
     valid.push({envelope:e,runs:validateRecentRuns(JSON.parse(e.payload))});
    }catch{bad++;}
   }
  }catch{this.blocked=true;this.loaded=true;return {runs:[],status:'read-error',note:'近期记录读取失败；本次无法保存近期记录。'};}
  this.loaded=true;
  if(this.blocked)return {runs:[],status:'incompatible',note:'近期记录版本不兼容，已保护原数据。'};
  valid.sort((a,b)=>b.envelope.sequence-a.envelope.sequence);
  if(valid.length){this.sequence=valid[0].envelope.sequence;this.runs=valid[0].runs;
   return {runs:this.history,status:bad?'fallback':'restored',note:bad?'近期记录最新槽损坏，已恢复上一份。':''};}
  this.runs=[];return {runs:[],status:found?'invalid':'new',note:found?'近期记录损坏，未恢复；本次抽题可能重复。':''};
 }
 constructor(private storage:KeyValueStore){}
 record(session:RunSession):{ok:boolean;note:string} {
  if(!this.loaded||this.blocked)return {ok:false,note:'近期记录未保存，下次可能遇到重复题。'};
  try{
   const next=recordRecentRun(this.runs,session.snapshot),payload=JSON.stringify(next);
   if(payload===JSON.stringify(this.runs)&&!this.dirty)return {ok:true,note:''};
   this.runs=next;this.dirty=true;
   const sequence=this.sequence+1;
   if(!Number.isSafeInteger(sequence)||sequence>=Number.MAX_SAFE_INTEGER)throw new Error('recent-sequence');
   const e:Envelope={schema:1,sequence,payload,checksum:hashText(`${sequence}:${payload}`)};
   const raw=JSON.stringify(e),key=`${RECENT_SAVE_PREFIX}.${sequence%2}`;
   this.storage.setItem(key,raw);if(this.storage.getItem(key)!==raw)throw new Error('recent-readback');
   this.sequence=sequence;this.dirty=false;return {ok:true,note:''};
  }catch{return {ok:false,note:'近期记录未保存，下次可能遇到重复题。'};}
 }
}
