// Independent exhaustive state search. It does NOT use the production capacity formulas.
// All eligible category choices are explored, even ones domain balancing would not choose.
const assert=require('node:assert/strict');
const {STATIONS,ROUTES,stationCapacity}=require('../.test-dist/core/content.js');
function proveCapacity(bank){
 let removalCases=0,suffixStates=0,transitions=0;
 const cases=[];
 for(let stage=0;stage<4;stage++){
  const routes=[1,2].includes(stage)?Object.keys(ROUTES).filter(r=>ROUTES[r].stage===stage):[null];
  for(const route of routes){
   const target=STATIONS[stage].target,pool=bank.questions.filter(q=>q.stage===stage);
   // Categories: prefix non-internet / other non-internet / prefix internet / other internet.
   const groups=[[],[],[],[]];
   for(const q of pool){const prefix=stage===0||route&&ROUTES[route].domains.includes(q.domain);
    groups[(q.cognition==='internet'?2:0)+(prefix?0:1)].push(q);}
   const original=groups.map(g=>g.length),memo=new Map();
   function suffix(counts,correct,mistakes,skipLeft,previousInternet){
    if(correct===target||mistakes===3)return true;
    const key=[...counts,correct,mistakes,skipLeft,previousInternet?1:0].join(',');
    if(memo.has(key))return memo.get(key);
    suffixStates++;const inPrefix=correct+mistakes<2;let choices=0;
    for(let kind=0;kind<4;kind++){
     const internet=kind>=2,prefix=kind%2===0;
     if(!counts[kind]||internet&&previousInternet||stage===0&&inPrefix&&internet||route&&inPrefix&&!prefix)continue;
     choices++;const next=[...counts];next[kind]--;transitions++;
     if(!suffix(next,correct+1,mistakes,skipLeft,internet)
      ||!suffix(next,correct,mistakes+1,skipLeft,internet)
      ||skipLeft&&!suffix(next,correct,mistakes,0,internet)){memo.set(key,false);return false;}
    }
    const result=choices>0;memo.set(key,result);return result;
   }
   // Normal attempt from every possible previous-station final cognition.
   assert.equal(suffix(original,0,0,1,false),true);
   assert.equal(suffix(original,0,0,1,true),true);
   let localCases=0;
   // A failed first attempt has 3 mistakes and 0..target-1 correct. Enumerate
   // every category-removal allocation of that size, including conservative
   // allocations not reachable under route/balancing rules. The one skip may
   // have been used in the failed attempt or can remain for the restart.
   for(const skipUsed of [0,1])for(let correct=0;correct<target;correct++){
    const shown=correct+3+skipUsed;
    for(let a=0;a<=Math.min(original[0],shown);a++)for(let b=0;b<=Math.min(original[1],shown-a);b++)
     for(let c=0;c<=Math.min(original[2],shown-a-b);c++){
      const d=shown-a-b-c;if(d<0||d>original[3])continue;
      const removed=[a,b,c,d],remaining=original.map((n,i)=>n-removed[i]);
      const items=groups.flatMap((g,i)=>g.slice(removed[i]));
      assert.equal(stationCapacity(items,stage,route,skipUsed===0).sufficient,true,
       `preflight: stage ${stage+1} route ${route} removed ${removed} skip ${skipUsed}`);
      for(const previousInternet of [false,true])assert.equal(suffix(remaining,0,0,skipUsed===0?1:0,previousInternet),true,
       `suffix exhausted: stage ${stage+1} route ${route} removed ${removed} skip ${skipUsed}`);
      removalCases++;localCases++;
     }
   }
   cases.push({stage:stage+1,route,initialCategoryCounts:original,failedRemovalCases:localCases,memoizedSuffixStates:memo.size});
  }
 }
 return {passed:true,scope:'Every eligible category/outcome/skip suffix after every bounded failed-attempt removal allocation; both previous-cognition states; includes choices outside actual balancing, so stronger than sampled seeds',
  timeoutEquivalentToMistake:true,removalCases,suffixStates,transitions,cases};
}
module.exports={proveCapacity};
