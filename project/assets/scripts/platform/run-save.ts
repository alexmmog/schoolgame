import { DraftBank, hashText } from '../core/content';
import { Mode, RunSession, validateRunSnapshot } from '../core/run';
import { KeyValueStore } from './contracts';

export const RUN_SAVE_PREFIX='life-comic-first-playable-v0.1.session';
interface Envelope {schema:1;sequence:number;payload:string;checksum:string}
export class RunSaveRepository {
 private sequence=0;
 private blocked=false;
 constructor(private storage:KeyValueStore,private bank:DraftBank){}
 load(now:number,fallbackSeed:string,mode:Mode):{session:RunSession;status:'new'|'restored'|'fallback'|'invalid'|'incompatible'|'read-error';note:string} {
  const fresh=()=>new RunSession(this.bank,fallbackSeed,mode,now);
  const valid:Envelope[]=[];let bad=0,found=0;
  try {
   for(let i=0;i<2;i++){
    const raw=this.storage.getItem(`${RUN_SAVE_PREFIX}.${i}`);if(raw===null)continue;found++;
    try{
     if(raw.length>250000)throw new Error('save-size');
     const envelope=JSON.parse(raw) as Envelope;
     if(typeof envelope.schema==='number'&&envelope.schema>1){this.blocked=true;continue;}
     if(envelope.schema!==1||!Number.isInteger(envelope.sequence)||envelope.sequence<1||typeof envelope.payload!=='string'
      ||envelope.checksum!==hashText(`${envelope.sequence}:${envelope.payload}`))throw new Error('save-envelope');
     const snapshot=JSON.parse(envelope.payload);
     if(snapshot.schema!==2||snapshot.appVersion!=='0.1.0'||snapshot.engineVersion!=='3.8.8'
      ||snapshot.ruleset!=='life-comic-slice-rules-v1'||snapshot.bankVersion!==this.bank.version||snapshot.bankHash!==this.bank.hash){this.blocked=true;continue;}
     validateRunSnapshot(snapshot,this.bank);valid.push(envelope);
    }catch{bad++;}
   }
  }catch{this.blocked=true;return {session:fresh(),status:'read-error',note:'本地存档读取失败；未覆盖旧数据，本局暂不保存。'};}
  if(this.blocked)return {session:fresh(),status:'incompatible',note:'已有存档版本不兼容，已保护原数据；本局暂不保存。'};
  valid.sort((a,b)=>b.sequence-a.sequence);
  if(valid.length){this.sequence=valid[0].sequence;return {session:new RunSession(this.bank,fallbackSeed,mode,now,valid[0].payload),
   status:bad?'fallback':'restored',note:bad?'最新槽无效，已恢复上一份校验通过的进度。':'已恢复本地进度；计时需主动继续。'};}
  return {session:fresh(),status:found?'invalid':'new',note:found?'两份存档均无效，当前局不能恢复；可新开一局。':'还没有本地进度。'};
 }
 save(session:RunSession):{ok:boolean;note:string} {
  if(this.blocked)return {ok:false,note:'尚未保存：旧版本数据已受保护。'};
  try{
   const payload=session.serialize();validateRunSnapshot(JSON.parse(payload),this.bank);
   const sequence=this.sequence+1;
   const envelope:Envelope={schema:1,sequence,payload,checksum:hashText(`${sequence}:${payload}`)};
   const raw=JSON.stringify(envelope),key=`${RUN_SAVE_PREFIX}.${sequence%2}`;
   this.storage.setItem(key,raw);
   if(this.storage.getItem(key)!==raw)throw new Error('save-readback');
   this.sequence=sequence;return {ok:true,note:'本地进度已保存，可稍后继续。'};
  }catch{return {ok:false,note:'尚未保存：进度保留在内存，可点击重试保存。'};}
 }
}
