const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname,'..');
const bankPath = path.join(root,'project/assets/resources/draft-bank.json');
const bank = JSON.parse(fs.readFileSync(bankPath,'utf8'));
const baseline = [["comic-s1-01",1,"comic-s1-01-fact","6f6a2958a0534f7d9392d83a5eaeec2d35a188232ae651565c1d68c69f00cd21"],["comic-s1-02",1,"comic-s1-02-fact","8fae6b73b548e1cb69557a904e9f3f62a0ba29fa85f44cb4cbbb35767570a5eb"],["comic-s1-03",2,"comic-s1-03-fact","f87d864f738ae752e947d8e9866091dca75f0b774c4e65f3d022bf1470329a1c"],["comic-s1-04",1,"comic-s1-04-fact","6d9ea3186745e05c1b74453ff1d59b7c6f18b264c98dd0c8bf9d0e8d56010369"],["comic-s1-05",1,"comic-s1-05-fact","6198ed9cc6dfc33f1132d6d734b3d6fc65946bed99fc9208c09fc7dffc85a303"],["comic-s1-06",2,"comic-s1-06-fact","0e7b90b806e3b185c138b1750b659ce4fdcbb7ee98f174db8258fa8604d4f4da"],["comic-s1-07",1,"comic-s1-07-fact","f7003acedb451013d48208d83db760b4792feaf2823acc32b946a8a032d5985f"],["comic-s1-08",1,"comic-s1-08-fact","b1e9ba3656a93a37af8edeedf947e6b7d4914fac2baa46f66a17d4bae8d67114"],["comic-s1-09",2,"comic-s1-09-fact","f8f4ddb4e9c44d11ab1dedfc43209335ee317290bf69e9bf91fc136179b7c8ab"],["comic-s1-10",1,"comic-s1-10-fact","46de179cc8c149cfe70af3ec70cf6cadbb2b78111b272cd34e3b1fccad8e00eb"],["comic-s1-11",1,"comic-s1-11-fact","e41908aff190b325eb22740d051ddb16347f6244d1bd9f895c8dbfca06098257"],["comic-s2-01",1,"comic-s2-01-fact","e9517d623f61beef1957047aeafae6509b399c3e9514a513475dab2e34276dda"],["comic-s2-02",1,"comic-s2-02-fact","c7001a16ec5becbab7fa40b8e7ee6baed4e0c591e6a23ce5fc704a505be298f8"],["comic-s2-03",1,"comic-s2-03-fact","98babdb3abbf20dad021523996d0923ff92cc62335230d5f3de4a260830e9528"],["comic-s2-04",1,"comic-s2-04-fact","fdd14c9e7f856471441fcbfd0b9570d5da7f3e7896f24c55db7a059b22c1db71"],["comic-s2-05",1,"comic-s2-05-fact","ec5584c9226d1d225088403446fa7fb11332e39406b2b4a5e07b6e7777b65fda"],["comic-s2-06",1,"comic-s2-06-fact","5abfcc1a5d0e7b6409586bd649eb98f9db7ccaca91fbc44faa5f13a703b2cc73"],["comic-s2-07",1,"comic-s2-07-fact","87b8a900a94ba2a61a3ed6ad6165edc711eb64f2b6fbb67268bdcd6980101fb2"],["comic-s2-08",1,"comic-s2-08-fact","3e48b8adb8d398d4972834639b63ac7380428dfecd2d786214c4a4ad37241233"],["comic-s2-09",1,"comic-s2-09-fact","b6dd77eaf9ebbcfbe1ba15ffc111256a3608c7ccb6cd7312526e312e18f707d3"],["comic-s2-10",1,"comic-s2-10-fact","7be51d64e6c274152258f202604dbdfa9607028fabbe3fefe5e5fc952ea91d0d"],["comic-s2-11",1,"comic-s2-11-fact","e28099643a224221d8a536d285aedd3297a8dc0bb0c326a2cb4eb03d604f3b7b"],["comic-s2-12",1,"comic-s2-12-fact","86c2eb86fa8c59f954331db28cc96f886eec273c3ded22e3dcbb1ad4a97cfc76"],["comic-s2-13",1,"comic-s2-13-fact","f9c0d96bc8858005bc1d0b2d7d9e22e4d9dbb3abc08533f3f3ecf5b465dd7e0b"],["comic-s2-14",1,"comic-s2-14-fact","48aff0f0e97af2d3829bb81026454d67dbbaec2109652ecaf76366782eb6ef3b"],["comic-s2-15",1,"comic-s2-15-fact","0a721a1debdca68255f790ce453c06453032a1ab0fd96e157debf088c67fcf7c"],["comic-s2-16",1,"comic-s2-16-fact","a169378d8b0a573cbebcc8943e6d42010018e46773eb654daf38660d68354f8f"],["comic-s2-17",1,"comic-s2-17-fact","c91698cff7086225ad90f897712ec92694ab1e5cb8c348fa02a7920c9fe94671"],["comic-s2-18",1,"comic-s2-18-fact","05687edea9f4c7ca33eb38d209743d336ef4651389289484b551bcc190911940"],["comic-s2-19",1,"comic-s2-19-fact","470ea041e5fc93419ee772ec5c413b2c4e22cccb5c4de8694f219e9f5434e2d0"],["comic-s2-20",1,"comic-s2-20-fact","095ba6b327b0d05027f12dc850dab649b378ee4d09dac241a04b60a46d7660f1"],["comic-s3-01",1,"comic-s3-01-fact","1e127301c610382818b044da48255d781622203314134fcdb34761c55e3ae473"],["comic-s3-02",1,"comic-s3-02-fact","b1cddc7a8ef0fbbf53196a36ef064edee429d82ba697f209ca35f81d1be1e539"],["comic-s3-03",1,"comic-s3-03-fact","ff4bb80bc56788ee94d5260de1412187e398099568c362814ae7a9caf9a80a57"],["comic-s3-04",1,"comic-s3-04-fact","dfa0705fbda828d8897ebf0f42598ed96b8b868cee28e04ba7e5f08bd66df51b"],["comic-s3-05",1,"comic-s3-05-fact","f07d52026e780be654504cede2d968ff08ab7db3f7728abe07e74d183d251b09"],["comic-s3-06",1,"comic-s3-06-fact","3a5bedc90e8b91b73d6d21dda69b82e5bd7200394e6f88a9d64319a9f8653fcf"],["comic-s3-07",1,"comic-s3-07-fact","a0e19ece3fa765b553635be2a18d2718574034f3a3b8f5fe925f1bf315af06e1"],["comic-s3-08",1,"comic-s3-08-fact","efacdd0b260ed514483f9e5490e0ad0cf55257ed9125980b010e069630d35a3e"],["comic-s3-09",1,"comic-s3-09-fact","9449724f838f96030c2ba19fca9be610852d9d7a86b9ed3137e4c562fd71c14a"],["comic-s3-10",1,"comic-s3-10-fact","f2896b47b82c100ddc394f46bc0dcea50bf3e63d0bcf1fd23db2521dec1f4f30"],["comic-s3-11",1,"comic-s3-11-fact","dbb6986d79ca13b156d8079ba95c1e11e75b0c47f7836c765392989bd76fd7ff"],["comic-s3-12",1,"comic-s3-12-fact","05b9f15c8623eeb9cdc0d69a5b1d589066a7c5ebf645dab1e394877e0021d79e"],["comic-s3-13",1,"comic-s3-13-fact","82733bdc60114af7b0fe7b096bdcdf5f34f2f77e610f1dd773ee56ea3ea31d3b"],["comic-s3-14",1,"comic-s3-14-fact","933765732080fa46101bbf39a5c36e24c2ceb1168f807456b1b3ba6dcdd16e05"],["comic-s3-15",1,"comic-s3-15-fact","54ffbe7e5e74719ad00497a223ab1e1e3adfa6fcfc8c3e5020e77ae7e7d8d268"],["comic-s3-16",1,"comic-s3-16-fact","f07c05ad3d12aff311acf3761d0c47a2354081d489304b4623573d17555ce95c"],["comic-s3-17",1,"comic-s3-17-fact","9373c2f3ef5e83d9779ac90ce0fc1196a9835b33066e992ac1bf0939d8f13349"],["comic-s3-18",1,"comic-s3-18-fact","d25a26af1ddd5661c2c49fdfc5e6147e3dde4f8785ed0b30db85cc7414298d22"],["comic-s3-19",1,"comic-s3-19-fact","480b23bca96202018cb25cbb9b162b8a1d9e8b69b3c53668d289082dd513cb8b"],["comic-s3-20",1,"comic-s3-20-fact","892c53a8a8178f1a39dd540e764deedef7aaac3108262a94abbbe2b71c38a8ef"],["comic-s3-21",1,"comic-s3-21-fact","d4d0cc2e3e396d5c34504b3bf46570d19203c9a5f246c73ed77787ea5bbce30b"],["comic-s4-01",1,"comic-s4-01-fact","12e94da6a347148a4a1a20a214257bfd195ae5a73a53706f9497306273d5f1b4"],["comic-s4-02",1,"comic-s4-02-fact","c7a1ab972e373b5595805a4ea0729aeb77f430bda71758fa84d3bf0ea988b168"],["comic-s4-03",1,"comic-s4-03-fact","ae714254b91b6cde9719104c0c864e742c74eaaa777c89b32914105def33a93d"],["comic-s4-04",1,"comic-s4-04-fact","cc995fac5df510317229f5a0af45d2841ff1eb7ba053fb73c4ffaf22842865cf"],["comic-s4-05",1,"comic-s4-05-fact","848742778d22494cf4d80933a08582646b9eba64aee2cba76ce2369a3db9a8c6"],["comic-s4-06",1,"comic-s4-06-fact","70213675eb9b0e43d6368f51123258c1e14aef655ef51e1ad85aafc1b3e77850"],["comic-s4-07",1,"comic-s4-07-fact","0c82f4c64cc3d3cb21d313bab28e6000827b306cbc94e7f857c8b0d11282c181"],["comic-s4-08",1,"comic-s4-08-fact","8ae9d208a82c2757e618186826ec1d77621e7762b6b4db2d5a027f3d373f8d3d"],["comic-s4-09",1,"comic-s4-09-fact","11fbd03a4dd2f5ee474ed1ce431c631f9ba9ad9888c600fe593c4b93514c72c8"],["comic-s4-10",1,"comic-s4-10-fact","d6940dde7b4ab430dcfbf5cbc52af747aaefd2162e69752830a4b19192406f6f"],["comic-s4-11",1,"comic-s4-11-fact","b44df18cf73a25ad7e9f2b546c04ec354f914e073c92a0b85588f2625c0446a6"],["comic-s4-12",1,"comic-s4-12-fact","7142dc2e09c1d6fa4e4839565f23ba53f4a91c42dd097e839b73ed33e10f01b4"],["comic-s4-13",1,"comic-s4-13-fact","7d29f77106219181beec5fcba4d8019092cc69530ebdb795a4ec7ca86701347f"],["comic-s4-14",1,"comic-s4-14-fact","9704ef066aa463c0ec22d6d6dd9d78f60a7116e28b25572c207cea6f4e41b864"],["comic-s4-15",1,"comic-s4-15-fact","83527f9f474e1466882e56b85c273347a52d8c177bafb4715bb48465af2c9ed8"]];
const optionCounts = [[2,4,4,2,4,2,4,2,4,4,2],[4,2,4,2,2,4,4,2,4,4,2,4,2,2,4,2,2,2,2,4],[4,4,2,4,4,4,2,4,4,4,2,4,2,2,2,4,2,2,2,2,2],[4,4,4,2,4,4,4,4,4,2,2,2,2,2,2]];
const quotas = {0:{count:11,domain:{life:4,travel:2,digital:2,language:3},cognition:{common:4,context:6,internet:1}},1:{count:20,domain:{travel:9,life:9,language:1,digital:1},cognition:{context:18,common:2}},2:{count:21,domain:{digital:12,entertainment:5,sports:4},cognition:{internet:3,context:16,common:2}},3:{count:15,domain:{language:3,life:3,travel:3,digital:2,entertainment:2,sports:2},cognition:{context:11,common:3,internet:1}}};
test('v3 remains draft and uses a genuine station difficulty gradient',()=>{
 assert.equal(bank.version,'life-comic-draft67-v3'); assert.equal(bank.independentDoubleReviewCompleted,false);
 for(const q of bank.questions){assert.equal(q.lifecycle,'draft');assert.ok([1,2,3].includes(q.difficulty));assert.ok(q.difficultyRationale.length>5);assert.equal(q.difficulty,q.stage===0?1:q.stage===1?2:q.stage===3?3:q.difficulty);if(q.stage===2)assert.ok(q.difficulty>=2);}
 assert.ok(bank.questions.filter(q=>q.stage===2&&q.difficulty===3).length>=8);
});
test('all original station domain cognition quotas, option IDs and limits stay fixed',()=>{
 const actual={};for(const q of bank.questions){actual[q.stage]??={count:0,domain:{},cognition:{}}; actual[q.stage].count++;for(const k of ['domain','cognition'])actual[q.stage][k][q[k]]=(actual[q.stage][k][q[k]]||0)+1;
 assert.ok([2,4].includes(q.options.length));assert.equal(q.options.length,optionCounts[q.stage][Number(q.id.slice(-2))-1]); q.options.forEach((o,i)=>{assert.equal(o.id,q.id+'-choice-'+(i+1));assert.ok([...o.text].length<=24);});assert.ok([...q.prompt].length<=(q.kind==='short'?55:110));assert.ok([...q.explanation].length<=65);assert.equal(q.seconds,q.kind==='short'?25:40);assert.ok(q.options.some(o=>o.id===q.correctId));}
 assert.deepEqual(actual,quotas);assert.deepEqual(bank.questions.map(q=>q.id),baseline.map(q=>q[0]));assert.equal(new Set(bank.questions.map(q=>q.factCluster)).size,67);
});
test('wording edits increment revisions and all questions receive individual editorial review',()=>{
 for(const [id,revision,cluster,hash] of baseline){const q=bank.questions.find(q=>q.id===id);const now=crypto.createHash('sha256').update(JSON.stringify([q.prompt,q.options.map(o=>o.text),q.explanation])).digest('hex');assert.equal(q.revision,revision+(now===hash?0:1));assert.equal(q.factCluster,id==='comic-s3-11'?'digital.vote.registration-unused':cluster);assert.ok(q.editReason?.length>5);assert.ok(q.evidenceNote.length>5);for(const o of q.options.filter(o=>o.id!==q.correctId))assert.ok(q.distractorNotes[o.id]?.length>5);}
 const doc=fs.readFileSync(path.join(root,'docs/V02-QUESTION-REVIEW.md'),'utf8');for(const q of bank.questions)assert.ok(doc.includes('### '+q.id));assert.ok(doc.includes('不构成独立双审'));
});
test('author source deterministically emits the bank and per-question editorial document in an isolated directory',()=>{
 const source=fs.readFileSync(path.join(root,'tools/author-bank.cjs'),'utf8');assert.ok(source.includes('--output-dir'),'generation needs an isolated output directory');const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'schoolgame-content-'));try{for(let i=0;i<2;i++){const r=spawnSync(process.execPath,[path.join(root,'tools/author-bank.cjs'),'--output-dir',tmp],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);assert.equal(fs.readFileSync(path.join(tmp,'project/assets/resources/draft-bank.json'),'utf8'),fs.readFileSync(bankPath,'utf8'));assert.equal(fs.readFileSync(path.join(tmp,'docs/V02-QUESTION-REVIEW.md'),'utf8'),fs.readFileSync(path.join(root,'docs/V02-QUESTION-REVIEW.md'),'utf8'));}}finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
const answer=id=>{const q=bank.questions.find(q=>q.id===id);return q.options.find(o=>o.id===q.correctId).text;};
test('later arithmetic questions require independently checked multi-step answers',()=>{
 assert.equal(answer('comic-s3-04'),(90-30)/1.5+' 秒');
 assert.equal(answer('comic-s3-10'),Math.floor((11-2)/3)+' 组');
 assert.equal(answer('comic-s4-02'),(3*200-150)+' 毫升');
 assert.equal(answer('comic-s4-06'),(3*5-2*3)+' 次');
 assert.equal(answer('comic-s4-09'),(9*60+50-(9*60+5)-8)+' 分钟');
});
test('combined eligibility and evidence cases cannot be answered from a single copied clause',()=>{
 assert.equal(answer('comic-s3-11'),'小禾');assert.equal(answer('comic-s3-15'),'不能确定已确认');assert.equal(answer('comic-s4-03'),'白石站');assert.equal(answer('comic-s4-05'),'蓝色');assert.equal(answer('comic-s4-15'),'尚未完成');
 for(const id of ['comic-s3-11','comic-s3-15','comic-s4-03','comic-s4-05','comic-s4-15'])assert.ok(bank.questions.find(q=>q.id===id).difficulty>=2);
});
test('shadow setup and storage composition describe the actual required conditions',()=>{
 const shadow=bank.questions.find(q=>q.id==='comic-s2-07');
 assert.equal(answer(shadow.id),'开灯、本子放入光路');
 for(const o of shadow.options)assert.match(o.text,/光路/);
 const storage=bank.questions.find(q=>q.id==='comic-s2-19');
 assert.match(storage.prompt,/盒内物品全是纸张/);
 assert.doesNotMatch(storage.prompt,/装满/);
});
test('quoted speech traces distinct speakers instead of repeating registration completeness',()=>{
 const q=bank.questions.find(q=>q.id==='comic-s3-16');
 assert.match(q.prompt,/小禾引用小舟/);assert.match(q.prompt,/小满转发/);
 assert.equal(answer(q.id),'“周六可进”被标为小舟的话');
 assert.doesNotMatch(q.prompt,/登记/);
 assert.equal(q.factCluster,'comic-s3-16-fact');assert.equal(q.difficulty,2);
});
test('transfer choice and match result require independently aggregating records',()=>{
 const route=bank.questions.find(q=>q.id==='comic-s4-03');
 assert.match(route.prompt,/到青桥8分钟、白石13分钟/);assert.match(route.prompt,/青桥转乙到终点12分钟、白石转乙4分钟/);assert.match(route.prompt,/两站都候车3分钟/);assert.match(route.prompt,/预算21分钟/);
 const totals={青桥:8+3+12,白石:13+3+4};
 assert.deepEqual(Object.entries(totals).filter(([,time])=>time<=21).map(([stop])=>stop),['白石']);
 assert.equal(answer('comic-s4-03'),'白石站');
 const match=bank.questions.find(q=>q.id==='comic-s4-14');
 assert.doesNotMatch(match.prompt,/待复核|非最终/);assert.match(match.prompt,/从0:0起，甲先得2分、乙再得1分、甲最后得1分/);
 const formalScore=[2+1,1].join(':');
 assert.notEqual(formalScore,'2:1');
 assert.equal(answer(match.id),'正式赛果'+formalScore+'，与排练不同');
});
test('the writing-context introductory question uses plausible contextual distractors',()=>{
 const q=bank.questions.find(q=>q.id==='comic-s1-10');
 assert.doesNotMatch(q.options.map(o=>o.text).join(' '),/投票/);
 assert.ok(q.options.some(o=>o.text==='庆祝修改顺利'));
});
