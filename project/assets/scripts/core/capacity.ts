export interface CapacityItem {readonly cognition:string;readonly domain:string}
export interface CapacityRules {
 readonly target:number;readonly skipAvailable:boolean;
 readonly prefix:'none'|'non-internet'|'route';readonly routeDomains?:readonly string[];
 readonly includeFreeRestart:boolean;
}
export interface CapacityCertificate {
 readonly sufficient:boolean;
 readonly available:{total:number;nonInternet:number;prefixNonInternet:number};
 readonly required:{total:number;nonInternet:number;prefixNonInternet:number};
}
/** A conservative guarantee for every eligible draw/outcome/skip order, not a lucky seed.
 * Each attempt terminates by target+2 settled questions (target correct or three mistakes).
 * Across two attempts there is only one skip. Keeping M-1 non-internet items prevents
 * an all-internet remainder before the Mth draw; prefix reserves cover both route slots.
 */
export function assessPoolCapacity(pool:readonly CapacityItem[],rules:CapacityRules):CapacityCertificate {
 if(!Number.isInteger(rules.target)||rules.target<3||rules.target>5
  ||rules.prefix==='route'&&!rules.routeDomains?.length)throw new Error('invalid-capacity-rules');
 const skip=rules.skipAvailable?1:0,attempt=rules.target+2;
 const required=rules.includeFreeRestart
  ? {total:2*attempt+skip,nonInternet:2*attempt+skip-1,prefixNonInternet:rules.prefix==='none'?0:attempt+2+skip}
  : {total:attempt+skip,nonInternet:attempt+skip-1,prefixNonInternet:rules.prefix==='none'?0:2+skip};
 const nonInternet=pool.filter(q=>q.cognition!=='internet');
 const available={total:pool.length,nonInternet:nonInternet.length,
  prefixNonInternet:rules.prefix==='none'?0:nonInternet.filter(q=>rules.prefix==='non-internet'||rules.routeDomains!.includes(q.domain)).length};
 return {required,available,sufficient:available.total>=required.total&&available.nonInternet>=required.nonInternet
  &&available.prefixNonInternet>=required.prefixNonInternet};
}
