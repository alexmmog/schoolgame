import {assessPoolCapacity,CapacityCertificate} from './capacity';
export type Domain = 'life' | 'language' | 'travel' | 'digital' | 'entertainment' | 'sports';
export type Cognition = 'common' | 'context' | 'internet';
export type Route = 'travel' | 'nature' | 'media' | 'interests';
export interface DraftQuestion {
 readonly id: string; readonly revision: number; readonly factCluster: string;
 readonly stage: number; readonly domain: Domain; readonly cognition: Cognition;
 readonly prompt: string; readonly options: readonly { readonly id: string; readonly text: string }[];
 readonly correctId: string; readonly explanation: string;
 readonly distractorNotes: Readonly<Record<string,string>>;
 readonly kind: 'short' | 'scenario'; readonly seconds: number; readonly lifecycle: 'draft';
}
export interface DraftBank {
 readonly schema: 1; readonly version: string; readonly hash: string;
 readonly scope: 'prototype-draft'; readonly questions: readonly DraftQuestion[];
}
export const DOMAIN_NAMES: Record<Domain,string> = {
 life:'生活与自然', language:'语言与文化', travel:'空间与出行', digital:'数字与媒介',
 entertainment:'文娱与游戏',sports:'运动与兴趣',
};
export const STATIONS = [
 {name:'校门之外',target:3,identity:'敢接招的人',line:'课本合上，生活开场。',scene:'校门'},
 {name:'生活现场',target:4,identity:'靠谱搭子',line:'今天的小事，也值得想一想。',scene:'街角'},
 {name:'跨圈会客',target:4,identity:'跨圈接话人',line:'听懂一点，也能接上一句。',scene:'会客'},
 {name:'主场时刻',target:5,identity:'今日主咖',line:'这一次，轮到你站在中间。',scene:'主场'},
] as const;
export const ROUTES: Record<Route,{name:string;promise:string;domains:readonly Domain[];stage:number}> = {
 travel:{name:'日常出行',promise:'先来 2 题 · 空间与出行',domains:['travel'],stage:1},
 nature:{name:'生活观察',promise:'先来 2 题 · 生活与自然',domains:['life'],stage:1},
 media:{name:'热梗现场',promise:'先来 2 题 · 数字与媒介',domains:['digital'],stage:2},
 interests:{name:'兴趣串门',promise:'先来 2 题 · 文娱 / 运动',domains:['entertainment','sports'],stage:2},
};
export function hashText(text:string): string {
 let hash=0x811c9dc5;
 for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,0x01000193);}
 return (hash>>>0).toString(16).padStart(8,'0');
}
export function parseDraftBank(value:unknown): DraftBank {
 if(!value || typeof value!=='object') throw new Error('题包不是对象');
 const raw=value as Record<string,unknown>;
 if(raw.schema!==1 || raw.scope!=='prototype-draft' || typeof raw.version!=='string'
  || !Array.isArray(raw.questions) || raw.questions.length<24 || raw.questions.length>2000) throw new Error('草稿题包版本或范围错误');
 const ids=new Set<string>(), clusters=new Set<string>();
 const questions=raw.questions.map((entry:unknown):DraftQuestion=>{
  if(!entry || typeof entry!=='object')throw new Error('题目对象错误');
  const q=entry as DraftQuestion;
  if(typeof q.id!=='string'||!q.id||ids.has(q.id)||typeof q.factCluster!=='string'||!q.factCluster||clusters.has(q.factCluster)
   ||!Number.isInteger(q.revision)||q.revision<1||q.revision>1000||!Number.isInteger(q.stage)||q.stage<0||q.stage>3||!Object.hasOwnProperty.call(DOMAIN_NAMES,q.domain)
   ||!['common','context','internet'].includes(q.cognition)||q.lifecycle!=='draft'
   ||!['short','scenario'].includes(q.kind)||![25,40].includes(q.seconds)
   ||typeof q.prompt!=='string'||!q.prompt.trim()||q.prompt.length>(q.kind==='short'?55:110)
   ||typeof q.explanation!=='string'||!q.explanation.trim()||q.explanation.length>65
   ||!Array.isArray(q.options)||![2,4].includes(q.options.length))throw new Error(`题目字段或长度错误: ${q.id}`);
  const optionIds=new Set<string>(), texts=new Set<string>();
  for(const option of q.options){
   if(!option||typeof option.id!=='string'||!option.id||optionIds.has(option.id)||typeof option.text!=='string'
    ||!option.text.trim()||option.text.length>24||texts.has(option.text))throw new Error(`选项错误: ${q.id}`);
   optionIds.add(option.id);texts.add(option.text);
  }
  if(!optionIds.has(q.correctId)||!q.distractorNotes||q.options.some(o=>o.id!==q.correctId && !q.distractorNotes[o.id]))throw new Error(`答案或错误解析缺失: ${q.id}`);
  ids.add(q.id);clusters.add(q.factCluster);
  return {...q,options:q.options.map(o=>({...o})),distractorNotes:{...q.distractorNotes}};
 }).sort((a,b)=>a.id.localeCompare(b.id));
 const bank:DraftBank={schema:1,version:raw.version,scope:'prototype-draft',hash:hashText(JSON.stringify(questions)),questions};
 if(bankCapacityCertificates(bank).some(c=>!c.certificate.sufficient))throw new Error('一次免费重整的路线或最坏路径题池不足');
 return bank;
}
export function stationCapacity(pool:readonly DraftQuestion[],stage:number,route:Route|null,skipAvailable:boolean,includeFreeRestart=false):CapacityCertificate {
 return assessPoolCapacity(pool,{target:STATIONS[stage].target,skipAvailable,includeFreeRestart,
  prefix:stage===0?'non-internet':[1,2].includes(stage)?'route':'none',routeDomains:route?ROUTES[route].domains:undefined});
}
export function bankCapacityCertificates(bank:DraftBank):{stage:number;route:Route|null;certificate:CapacityCertificate}[] {
 const result:{stage:number;route:Route|null;certificate:CapacityCertificate}[]=[];
 for(let stage=0;stage<4;stage++){
  const routes:(Route|null)[]=[1,2].includes(stage)?(Object.keys(ROUTES) as Route[]).filter(r=>ROUTES[r].stage===stage):[null];
  for(const route of routes)result.push({stage,route,certificate:stationCapacity(bank.questions.filter(q=>q.stage===stage),stage,route,true,true)});
 }
 return result;
}
