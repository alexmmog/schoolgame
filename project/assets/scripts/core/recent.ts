import type { DraftQuestion } from './content';
import type { RunSnapshot } from './run';

/** Newest ended journey first; current-run preferences are frozen in its snapshot. */
export interface RecentRun {runId:string;clusters:string[]}
export function validateRecentRuns(value:unknown):RecentRun[] {
 if(!Array.isArray(value)||value.length>2)throw new Error('recent-history');
 const ids=new Set<string>();
 return value.map(entry=>{
  if(!entry||typeof entry!=='object')throw new Error('recent-run');
  const run=entry as RecentRun;
  if(typeof run.runId!=='string'||!run.runId||run.runId.length>160||ids.has(run.runId)
   ||!Array.isArray(run.clusters)||run.clusters.length>100
   ||run.clusters.some(cluster=>typeof cluster!=='string'||!cluster||cluster.length>160)
   ||new Set(run.clusters).size!==run.clusters.length)throw new Error('recent-run');
  ids.add(run.runId);return {runId:run.runId,clusters:[...run.clusters]};
 });
}
export function preferRecentQuestions(pool:readonly DraftQuestion[],runs:readonly RecentRun[]):DraftQuestion[] {
 const last=new Set(runs[0]?.clusters??[]),older=new Set(runs[1]?.clusters??[]);
 const unseen=pool.filter(q=>!last.has(q.factCluster)&&!older.has(q.factCluster));
 if(unseen.length)return unseen;
 const notLast=pool.filter(q=>!last.has(q.factCluster));
 return notLast.length?notLast:[...pool];
}
export function recordRecentRun(runs:readonly RecentRun[],snapshot:Readonly<RunSnapshot>):RecentRun[] {
 const history=validateRecentRuns(runs);
 if(snapshot.phase!=='result'||snapshot.terminalReason===null||history.some(r=>r.runId===snapshot.runId))return history;
 return validateRecentRuns([{runId:snapshot.runId,clusters:[...snapshot.seenClusters]},...history].slice(0,2));
}
