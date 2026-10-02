import { DraftBank, hashText } from '../core/content';
import { Mode, RunSession, validateRunSnapshot } from '../core/run';
import { KeyValueStore } from './contracts';
import { APP_VERSION, ENGINE_VERSION, RULESET } from '../core/versions';

export const LEGACY_RUN_SAVE_PREFIX='life-comic-first-playable-v0.1.session';
export const RUN_SAVE_PREFIX='life-comic.session';
const LAST_SAVE_KEY='life-comic.session.last-space';
export function runSavePrefix(bank:DraftBank):string {
 return `${RUN_SAVE_PREFIX}.${APP_VERSION}.${RULESET}.${encodeURIComponent(bank.version)}.${bank.hash}`;
}
interface Envelope {schema:1;sequence:number;payload:string;checksum:string}
export class RunSaveRepository {
 private sequence=0;
 private blocked=false;
 readonly prefix:string;
 constructor(private storage:KeyValueStore,private bank:DraftBank){this.prefix=runSavePrefix(bank);}
 load(now:number,fallbackSeed:string,mode:Mode):{session:RunSession;status:'new'|'updated'|'restored'|'fallback'|'invalid'|'incompatible'|'read-error';note:string} {
  const fresh=()=>new RunSession(this.bank,fallbackSeed,mode,now);
  const valid:Envelope[]=[];let bad=0,found=0,older=false;
  try {
   for(let i=0;i<2;i++){
    const raw=this.storage.getItem(`${this.prefix}.${i}`);if(raw===null)continue;found++;
    try{
     if(raw.length>250000)throw new Error('save-size');
     const envelope=JSON.parse(raw) as Envelope;
     if(typeof envelope.schema==='number'&&envelope.schema>1){this.blocked=true;continue;}
     if(envelope.schema!==1||!Number.isInteger(envelope.sequence)||envelope.sequence<1||typeof envelope.payload!=='string'
      ||envelope.checksum!==hashText(`${envelope.sequence}:${envelope.payload}`))throw new Error('save-envelope');
     const snapshot=JSON.parse(envelope.payload);
     if(snapshot.schema!==2||snapshot.appVersion!==APP_VERSION||snapshot.engineVersion!==ENGINE_VERSION
      ||snapshot.ruleset!==RULESET||snapshot.bankVersion!==this.bank.version||snapshot.bankHash!==this.bank.hash){this.blocked=true;continue;}
     validateRunSnapshot(snapshot,this.bank);valid.push(envelope);
    }catch{bad++;}
   }
   if(!found){
    const previous=this.storage.getItem(LAST_SAVE_KEY);
    const knownPrevious=previous&&previous.length<=600&&previous.startsWith(RUN_SAVE_PREFIX+'.')&&previous!==this.prefix;
    older=[0,1].some(i=>this.storage.getItem(`${LEGACY_RUN_SAVE_PREFIX}.${i}`)!==null);
    if(knownPrevious)older=older||[0,1].some(i=>this.storage.getItem(`${previous}.${i}`)!==null);
   }
  }catch{this.blocked=true;return {session:fresh(),status:'read-error',note:'本地存档读取失败；未覆盖旧数据，本局暂不保存。'};}
  if(this.blocked)return {session:fresh(),status:'incompatible',note:'已有存档版本不兼容，已保护原数据；本局暂不保存。'};
  valid.sort((a,b)=>b.sequence-a.sequence);
  if(valid.length){this.sequence=valid[0].sequence;return {session:new RunSession(this.bank,fallbackSeed,mode,now,valid[0].payload),
   status:bad?'fallback':'restored',note:bad?'最新槽无效，已恢复上一份校验通过的进度。':'已恢复本地进度；计时需主动继续。'};}
  return {session:fresh(),status:found?'invalid':older?'updated':'new',note:found?'两份存档均无效，当前局不能恢复；可新开一局。':older?'题包已更新，本版从新旅程开始；旧进度已保留。':'还没有本地进度。'};
 }
 save(session:RunSession):{ok:boolean;note:string} {
  if(this.blocked)return {ok:false,note:'尚未保存：旧版本数据已受保护。'};
  try{
   const payload=session.serialize();validateRunSnapshot(JSON.parse(payload),this.bank);
   const sequence=this.sequence+1;
   const envelope:Envelope={schema:1,sequence,payload,checksum:hashText(`${sequence}:${payload}`)};
   const raw=JSON.stringify(envelope),key=`${this.prefix}.${sequence%2}`;
   this.storage.setItem(key,raw);
   if(this.storage.getItem(key)!==raw)throw new Error('save-readback');
   this.sequence=sequence;
   try{this.storage.setItem(LAST_SAVE_KEY,this.prefix);}catch{return {ok:true,note:'本地进度已保存；题包更新记录暂未保存。'};}
   return {ok:true,note:'本地进度已保存，可稍后继续。'};
  }catch{return {ok:false,note:'尚未保存：进度保留在内存，可点击重试保存。'};}
 }
}
