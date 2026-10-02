import {_decorator,Component,Node,Canvas,Camera,UITransform,Layers,view,ResolutionPolicy,Vec3,
 game,sys,resources,JsonAsset,Label} from 'cc';
import {DraftBank,parseDraftBank,DOMAIN_NAMES,STATIONS,Route,ROUTES} from './core/content';
import {RunSession,Mode,HistoryEntry} from './core/run';
import {RunSaveRepository} from './platform/run-save';
import {cocosStorage,subscribeLifecycle} from './platform/cocos-platform';
import {ComicUI,INK,IVORY,PAPER,CORAL,CYAN,GRAY,MUTED,GOLD} from './ui/ComicUI';
import {ComicArt} from './ui/ComicArt';
import {mapArtGeometry} from './ui/art-layout';
import {DESIGN_WIDTH as W,DESIGN_HEIGHT as H,PhoneLayout,phoneLayout,questionGeometry,reviewGeometry} from './ui/layout';

const {ccclass}=_decorator;
@ccclass('QuizApp')
export class QuizApp extends Component {
 private ui!:ComicUI;private layout!:PhoneLayout;private bank!:DraftBank;private session!:RunSession;private save!:RunSaveRepository;
 private art?:ComicArt;
 private screen:'home'|'play'|'confirm-new'|'review'='home';private selectedMode:Mode='timed';
 private storageNote='正在加载草稿题包…';private saved=false;private hasResume=false;private epoch=0;private disposed=false;
 private inspectedStation=0;private reviewIndex=0;private timerLabel?:Label;private saveLabel?:Label;private interactionNote='';private lastCheckpoint=0;private unsubscribe?:()=>void;
 private now():number {return typeof performance!=='undefined'?performance.now():game.totalTime;}
 private seed():string {return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;}
 onLoad():void {
  view.setDesignResolutionSize(W,H,ResolutionPolicy.SHOW_ALL);this.makeCanvas();this.readLayout();this.ui.clear();
  this.ui.text('Loading','生活漫画正在开场…',195,360,330,90,25,INK,'center');
  resources.load('draft-bank',JsonAsset,(error,asset)=>{
   if(this.disposed)return;
   if(error||!asset){this.loadingError('题包加载失败。请重新打开本地预览。');return;}
   try{
    this.bank=parseDraftBank(asset.json);
    this.ui.text('ArtLoading','正在载入新的生活漫画插画…',195,460,330,65,18,INK,'center');
    ComicArt.load((artError,art)=>{
     if(this.disposed){art?.release();return;}
     if(artError||!art){this.loadingError('插画资源加载失败。请确认完整 Web 包已通过 HTTP 打开。');return;}
     this.art=art;this.ui.attachArt(art);
     try{this.initializeRun();}catch(error){this.loadingError(`试玩初始化失败：${String(error)}`);}
    });
   }catch(error){this.loadingError(`草稿题包校验失败：${String(error)}`);}
  });
 }
 private initializeRun():void {
  this.save=new RunSaveRepository(cocosStorage,this.bank);
  const loaded=this.save.load(this.now(),this.seed(),'timed');this.session=loaded.session;this.storageNote=loaded.note;
  this.hasResume=['restored','fallback'].includes(loaded.status);this.selectedMode=this.session.mode;this.inspectedStation=this.session.snapshot.stage;
  this.unsubscribe=subscribeLifecycle(()=>{this.session.pause(this.now());this.persist();this.render();},
   ()=>{this.session.advance(this.now());this.readLayout();this.render();});
  this.lastCheckpoint=this.now();this.render();
 }
 onDestroy():void {this.disposed=true;this.unsubscribe?.();this.art?.release();}
 update():void {
  if(!this.session||this.screen!=='play')return;
  const before=this.session.revision,guard=this.session.guardMs,now=this.now();this.session.advance(now);
  if(before!==this.session.revision||guard>0&&this.session.guardMs===0){this.persist();this.render();}
  if(this.timerLabel){const text=this.session.mode==='relaxed'?'不计时':`${Math.ceil(this.session.remainingMs/1000)} 秒`;
   if(this.timerLabel.string!==text)this.timerLabel.string=text;}
  if(now-this.lastCheckpoint>=1000&&!this.session.paused&&['question','preparing'].includes(this.session.phase)){this.persist();this.lastCheckpoint=now;}
 }
 private makeCanvas():void {
  const canvasNode=new Node('LifeComicCanvas');canvasNode.layer=Layers.Enum.UI_2D;this.node.addChild(canvasNode);
  canvasNode.addComponent(UITransform).setContentSize(W,H);const canvas=canvasNode.addComponent(Canvas);
  const cameraNode=new Node('PortraitUICamera');this.node.addChild(cameraNode);cameraNode.setPosition(new Vec3(0,0,1000));
  const camera=cameraNode.addComponent(Camera);camera.projection=Camera.ProjectionType.ORTHO;camera.orthoHeight=H/2;
  camera.near=0.1;camera.far=2000;camera.visibility=Layers.Enum.UI_2D;camera.clearColor=IVORY;canvas.cameraComponent=camera;
  const surface=new Node('LiveComicPages');surface.layer=Layers.Enum.UI_2D;canvasNode.addChild(surface);surface.addComponent(UITransform).setContentSize(W,H);this.ui=new ComicUI(surface);
 }
 private readLayout():void {this.layout=phoneLayout(sys.getSafeAreaRect(false));}
 private y(offset:number):number{return this.layout.top+offset*this.layout.scale;}
 private h(height:number):number{return height*this.layout.scale;}
 private loadingError(message:string):void {this.ui.clear();this.ui.text('LoadError',message,195,380,330,200,20,INK,'center');}
 private persist():void {const result=this.save.save(this.session);this.saved=result.ok;this.storageNote=result.note;this.hasResume=true;
  if(this.saveLabel){this.saveLabel.string=this.storageNote;this.saveLabel.color=this.saved?MUTED:INK;}}
 private action(fn:()=>void,persist=true):()=>void {
  const epoch=this.epoch;return ()=>{if(this.disposed||this.epoch!==epoch)return;this.interactionNote='';fn();if(persist)this.persist();this.render();};
 }
 private button(name:string,text:string,y:number,fn:()=>void,enabled=true,fill=CORAL,x=195,w=this.layout.width):void {
  this.ui.button(name,text,x,this.y(y),w,Math.max(50,this.h(54)),this.action(fn),enabled,fill);
 }
 private heading(title:string,subtitle:string):void {
  this.ui.text('PageTitle',title,195,this.y(19),this.layout.width,40,29,INK,'center');
  this.ui.text('PageSubtitle',subtitle,195,this.y(57),this.layout.width,36,15,MUTED,'center');
 }
 private footer():void {
  this.saveLabel=this.ui.text('SaveStatus',this.storageNote,this.layout.left+(this.layout.width-98)/2,this.y(729),this.layout.width-98,43,13,this.saved?MUTED:INK,'left');
  this.ui.button('RetrySave','保存',W-this.layout.right-32.5,this.y(729),65,48,this.action(()=>{}),true,PAPER,16);
 }
 private render():void {
  if(this.disposed||!this.session)return;
  this.epoch++;this.timerLabel=undefined;this.saveLabel=undefined;this.ui.clear();this.readLayout();
  if(this.screen==='home')this.home();else if(this.screen==='confirm-new')this.confirmNew();else if(this.screen==='review')this.review();
  else if(this.session.paused)this.paused();else switch(this.session.phase){
   case 'map':this.map();break;case 'preparing':case 'question':this.question();break;case 'feedback':this.feedback();break;
   case 'stage-result':this.stageResult();break;case 'failed':this.failed();break;case 'result':this.result();break;case 'content-unavailable':this.unavailable();break;
  }
 }
 private begin():void {this.session=new RunSession(this.bank,this.seed(),this.selectedMode,this.now());this.screen='play';this.inspectedStation=0;}
 private home():void {
  this.heading('这题我来','生活漫画 · 新插画试玩版');this.ui.panel('TitleSpeech',142,this.y(144),220,this.h(72),PAPER);
  this.ui.text('HeroLine','课本合上，\n生活开场！',142,this.y(144),190,this.h(60),23,INK,'center');this.ui.character(248,this.y(277),0.93*this.layout.scale);
  this.ui.text('DraftBankLabel',`${this.bank.questions.length} 道原创草稿 · 尚未独立双审`,195,this.y(410),this.layout.width,28,16,INK,'center');
  const left=this.layout.left+this.layout.width/4,right=390-this.layout.right-this.layout.width/4,width=this.layout.width/2-7;
  this.ui.button('TimedMode',`${this.selectedMode==='timed'?'● ':''}普通挑战`,left,this.y(470),width,this.h(57),this.action(()=>{this.selectedMode='timed';},false),true,this.selectedMode==='timed'?CYAN:PAPER,18);
  this.ui.button('SlowMode',`${this.selectedMode==='relaxed'?'● ':''}慢慢聊`,right,this.y(470),width,this.h(57),this.action(()=>{this.selectedMode='relaxed';},false),true,this.selectedMode==='relaxed'?CYAN:PAPER,18);
  this.ui.text('BriefRules','每站 3 格从容 · 答对不回血\n一局 1 次换题、1 次免费重整',195,this.y(535),this.layout.width,70,18,INK,'center');
  this.button('NewRun','开始接招',608,()=>{if(this.hasResume&&this.session.phase!=='result')this.screen='confirm-new';else this.begin();});
  if(this.hasResume)this.button('ResumeRun',this.session.phase==='result'?'查看上次结果':`继续第 ${this.session.snapshot.stage+1} 站`,674,()=>{this.screen='play';this.inspectedStation=this.session.snapshot.stage;},true,CYAN);
  this.ui.text('PrototypeScope',`仅本地开发试玩 · 微信与真实广告暂缓\n${this.storageNote}`,195,this.y(730),this.layout.width,56,13,MUTED,'center');
 }
 private confirmNew():void {
  this.heading('先和这一局告个别','不会覆盖其他项目的存档');this.ui.character(195,this.y(237),0.72);
  this.ui.text('RestartConfirm',`新开一局会结束当前旅程。\n当前成绩可先收下，\n新局可以再次遇见这 ${this.bank.questions.length} 道草稿。`,195,this.y(431),this.layout.width,140,20,INK,'center');
  this.button('ConfirmNew','确认结束，开新局',572,()=>{this.session.finish('abandoned',this.now());this.persist();this.begin();});
  this.button('KeepRun','继续原来的旅程',642,()=>{this.screen='play';},true,CYAN);this.footer();
 }
 private map():void {
  const s=this.session.snapshot;if(this.inspectedStation>s.stage)this.inspectedStation=s.stage;
  const frame=this.art!.get('map-neighborhood'),geometry=mapArtGeometry(this.layout,frame.originalSize.width,frame.originalSize.height);
  this.ui.sprite('GeneratedWindingNeighborhood',frame,geometry.image.x,geometry.image.y,geometry.image.width,geometry.image.height);
  this.heading('生活地图',`当前身份：${s.completed.length?STATIONS[s.completed.length-1].identity:'新来的'} · ${s.mode==='timed'?'普通挑战':'慢慢聊'}`);
  for(let i=0;i<4;i++){
   const done=i<s.completed.length,current=i===s.stage&&!done,locked=i>s.stage,selected=i===this.inspectedStation;
   const rect=geometry.stations[i],fill=locked?GRAY:selected?GOLD:done?CYAN:PAPER;
   this.ui.button(`Station-${i}`,'',rect.x,rect.y,rect.width,rect.height,this.action(()=>{this.inspectedStation=i;},false),!locked,fill);
   this.ui.text(`StationTitle-${i}`,`${i+1}. ${STATIONS[i].name}`,rect.x-7,rect.y-14,rect.width-39,26,17,INK,'center');
   const label=done?`已完成 · ${s.completed[i].answerScore+s.completed[i].clearBonus} 分`:current?`当前 · 答对 ${STATIONS[i].target} 题`:'未解锁';
   this.ui.text(`StationState-${i}`,label,rect.x-5,rect.y+16,rect.width-30,26,12,INK,'center');
   this.ui.icon(locked?'lock':done?'check':'arrow',rect.x+rect.width/2-14,rect.y-14,18);
  }
  const stage=this.inspectedStation;
  if(stage!==s.stage){const result=s.completed[stage];
   this.ui.text('CompletedStationDetail',`${STATIONS[stage].identity}\n本幕 ${result.correct} 题正确 · 从容 ${result.composure}/3`,195,this.y(613),this.layout.width,67,18,INK,'center');
   this.button('BackCurrent','回到当前站',684,()=>{this.inspectedStation=s.stage;},true,CYAN);
  }else if([1,2].includes(stage)){
   const options=(Object.keys(ROUTES) as Route[]).filter(r=>ROUTES[r].stage===stage),width=this.layout.width/2-7;
   for(let i=0;i<2;i++){const route=options[i],x=this.layout.left+width/2+i*(width+14),selected=s.routes[stage]===route;
    this.ui.button(`Route-${route}`,`${selected?'● ':''}${ROUTES[route].name}`,x,this.y(603),width,this.h(58),this.action(()=>{this.session.selectRoute(route);}),true,selected?CYAN:PAPER,18);
    this.ui.text(`Promise-${route}`,ROUTES[route].promise,x,this.y(650),width,40,12,INK,'center');}
   this.button('EnterStation','上场 · 锁定这条路线',694,()=>{this.session.startStation(this.now());},!!s.routes[stage]);
  }else{this.ui.text('StationLine',STATIONS[stage].line,195,this.y(615),this.layout.width,58,20,INK,'center');this.button('EnterStation','上场接招',688,()=>{this.session.startStation(this.now());});}
  this.saveLabel=this.ui.text('MapSave',this.storageNote,195,this.y(742),this.layout.width,29,12,MUTED,'center');
 }
 private hud():void {
  const s=this.session.snapshot;this.ui.text('StationHeading',`${s.stage+1}. ${STATIONS[s.stage].name}`,148,this.y(16),this.layout.width-92,37,23);
  this.ui.button('PauseButton','暂停',W-this.layout.right-33,this.y(16),66,48,this.action(()=>{this.session.pause(this.now());}),true,PAPER,17);
  this.ui.panel('ResourceHud',195,this.y(75),this.layout.width,this.h(68),PAPER);this.ui.composure(s.composure,this.layout.left+24,this.y(67));
  this.ui.text('ComposureText',`从容 ${s.composure}/3`,this.layout.left+56,this.y(93),100,24,13);
  this.ui.text('CorrectTarget',`答对 ${s.correct}/${STATIONS[s.stage].target}`,208,this.y(62),105,30,18);
  this.timerLabel=this.ui.text('LiveClock',s.mode==='relaxed'?'不计时':`${Math.ceil(this.session.remainingMs/1000)} 秒`,300,this.y(87),93,30,16,INK,'center');
 }
 private question():void {
  const s=this.session.snapshot,q=this.session.question!;this.hud();const geometry=questionGeometry(this.layout,q.options.length);
  this.ui.comicScene(s.stage,195,geometry.sceneTop+geometry.sceneHeight/2,this.layout.width,geometry.sceneHeight);
  const card=this.ui.panel('LiveQuestionCard',195,geometry.cardTop+geometry.cardHeight/2,this.layout.width,geometry.cardHeight,PAPER);
  this.ui.label(card,q.prompt,this.layout.width-28,geometry.cardHeight-12,16,INK,'left');const token=this.session.token!;
  s.current!.optionOrder.forEach((id,i)=>{const option=q.options.find(o=>o.id===id)!;
   this.ui.button(`Answer-${id}`,`${String.fromCharCode(65+i)}   ${option.text}`,195,geometry.optionTop+geometry.optionHeight/2+i*(geometry.optionHeight+geometry.optionGap),this.layout.width,geometry.optionHeight,
    this.action(()=>{this.session.submit(id,this.now(),token);}),s.phase==='question',PAPER,18);});
  this.ui.text('InputHint',this.interactionNote||(s.phase==='preparing'?'题面准备中…':'选中即提交 · 每题只提交一次'),195,this.y(625),this.layout.width,18,12,MUTED,'center');
  this.ui.button('Skip',s.skipped?'换题已使用':'换题 · 本局 1 次',195,geometry.actionTop+27,this.layout.width,54,
   this.action(()=>{const result=this.session.skip(this.now(),token);if(result==='unavailable')this.interactionNote='暂无合格新题，未扣换题券。';}),s.phase==='question'&&!s.skipped,CYAN,19);this.footer();
 }
 private feedback():void {
  const s=this.session.snapshot,record=s.history[s.history.length-1];this.hud();if(this.timerLabel)this.timerLabel.string='解析中';this.timerLabel=undefined;this.drawFeedback(record);
  const label=s.feedbackNext==='stage-result'?'查看本幕结果':s.feedbackNext==='failed'?'看看这次结果':'下一题',token=this.session.token!;
  this.button('ContinueFeedback',this.session.guardMs>0?'解析就绪中…':label,680,()=>{this.session.continueFeedback(this.now(),token);},this.session.guardMs===0);this.footer();
 }
 private drawFeedback(record:HistoryEntry):void {
  const q=this.bank.questions.find(q=>q.id===record.questionId)!,symbol=record.outcome==='correct'?'check':record.outcome==='timeout'?'clock':'wrong';
  const title=record.outcome==='correct'?'答对了！':record.outcome==='timeout'?'时间到了':'这次没接住';
  this.ui.panel('FeedbackBanner',195,this.y(160),this.layout.width,this.h(76),record.outcome==='correct'?CYAN:CORAL);
  this.ui.icon(symbol,this.layout.left+36,this.y(160),30);this.ui.text('OutcomeText',title,216,this.y(160),this.layout.width-90,54,26);
  this.ui.text('QuestionReview',q.prompt,195,this.y(271),this.layout.width-12,this.h(143),18);
  const chosen=record.chosenId?q.options.find(o=>o.id===record.chosenId)!.text:'未作答';
  this.ui.panel('SelectedAnswer',195,this.y(361),this.layout.width,this.h(67),PAPER);this.ui.text('ChosenLabel',`你的选择：${chosen}`,195,this.y(361),this.layout.width-24,this.h(58),18);
  this.ui.panel('CorrectAnswer',195,this.y(443),this.layout.width,this.h(67),GOLD);this.ui.text('CorrectLabel',`正确答案：${q.options.find(o=>o.id===q.correctId)!.text}`,195,this.y(443),this.layout.width-24,this.h(58),18);
  const explanation=this.ui.panel('Explanation',195,this.y(566),this.layout.width,this.h(159),PAPER);this.ui.label(explanation,`为什么：\n${q.explanation}`,this.layout.width-26,this.h(145),18,INK,'left');
 }
 private paused():void {
  this.heading('先喘口气','Ⅱ 已暂停 · 题面已收起，计时已冻结');this.ui.character(195,this.y(271),0.88*this.layout.scale);
  this.ui.text('PausedBody','回到前台也不会自动计时。\n准备好后，再按“继续接招”。',195,this.y(443),this.layout.width,92,20,INK,'center');
  this.button('Resume','继续接招',561,()=>{this.session.resume(this.now());});this.button('SaveHome','保存并回首页',630,()=>{this.screen='home';},true,CYAN);this.footer();
 }
 private stageResult():void {
  const s=this.session.snapshot,r=s.completed[s.stage];this.heading('这一站，接住了！',STATIONS[s.stage].name);this.ui.character(195,this.y(244),0.8*this.layout.scale);this.ui.icon('check',304,this.y(174),37);
  this.ui.text('IdentityChange',STATIONS[s.stage].identity,195,this.y(404),this.layout.width,48,28,INK,'center');
  this.ui.text('StationScore',`本幕答对 ${r.correct} 题 · 从容 ${r.composure}/3\n答题 ${r.answerScore} ＋ 过幕 ${r.clearBonus}\n本幕 ${r.answerScore+r.clearBonus} 分`,195,this.y(496),this.layout.width,132,20,INK,'center');
  this.button('NextStation',s.stage===3?'查看最终结果':'去下一站',618,()=>{this.session.nextStation(this.now());this.inspectedStation=this.session.snapshot.stage;});
  this.button('StageSaveHome','保存，稍后再来',682,()=>{this.session.pause(this.now());this.screen='home';},true,CYAN);this.footer();
 }
 private failed():void {
  const availability=this.session.restartAvailability;this.heading('这一幕先歇一歇','之前通过的站点仍保留');this.ui.character(195,this.y(248),0.76*this.layout.scale);
  this.ui.text('FailureBody',`本幕答对 ${this.session.snapshot.correct} 题\n从容用完了，解析随时可以回看。`,195,this.y(406),this.layout.width,98,20,INK,'center');
  this.ui.text('RestartAvailability',availability.reason,195,this.y(494),this.layout.width,73,17,INK,'center');
  this.button('FreeRestart','免费重整本幕',584,()=>{this.session.restartFailedStation(this.now());},availability.available,CYAN);
  this.button('AcceptFailure','收下这次结果',654,()=>{this.session.finish('failed',this.now());});
  this.ui.text('AdsDeferred','真实广告尚未接入，本版没有广告续关。',195,this.y(700),this.layout.width,34,13,MUTED,'center');this.footer();
 }
 private unavailable():void {
  this.heading('题目暂不可用','这是草稿容量限制，不判你答错');this.ui.character(195,this.y(239),0.72*this.layout.scale);
  this.ui.text('PoolLimit','本槽没有满足路线和去重条件的新题。\n进度和从容保留，绝不重复旧题。\n可收下这次结果，再免费新开一局。',195,this.y(424),this.layout.width,166,20,INK,'center');
  this.button('AcceptPartial','收下当前结果',601,()=>{this.session.finish('content-unavailable',this.now());});this.button('KeepUnavailable','保存并回首页',670,()=>{this.session.pause(this.now());this.screen='home';},true,CYAN);this.footer();
 }
 private result():void {
  const s=this.session.snapshot,stats=this.session.stats;this.heading(s.terminalReason==='completed'?'今天的主场，拿下！':'这次的生活旅程','成绩仅代表本局试玩，不评价现实能力');
  this.ui.character(294,this.y(196),0.52);this.ui.text('ResultIdentity',s.completed.length?STATIONS[s.completed.length-1].identity:'新来的',145,this.y(143),228,48,25);
  this.ui.text('ResultProgress',`通过 ${s.completed.length}/4 站\n${s.mode==='timed'?'普通挑战':'慢慢聊'}`,139,this.y(211),220,78,19);this.ui.panel('FinalStats',195,this.y(359),this.layout.width,this.h(177),PAPER);
  this.ui.text('FinalNumbers',`答对 ${stats.correct} / ${stats.settled} 题\n错误 ${stats.wrong} · 超时 ${stats.timeouts}\n本局得分 ${this.session.score}\n换题 ${s.skipped} 次 · 免费重整 ${s.freeRestarts} 次`,195,this.y(359),this.layout.width-27,this.h(158),21,INK,'center');
  const names=s.routes.filter((r):r is Route=>r!==null).map(r=>ROUTES[r].name).join(' / ');this.ui.text('ResultRoutes',names?`走过：${names}`:'走过：校门之外',195,this.y(474),this.layout.width,58,16,INK,'center');
  this.button('Review','回看本局解析',552,()=>{this.screen='review';this.reviewIndex=0;},s.history.some(h=>h.outcome!=='skipped'),CYAN);
  this.button('Replay','再来一局',620,()=>{this.begin();});this.button('ResultHome','回首页，换个节奏',686,()=>{this.screen='home';},true,PAPER);this.footer();
 }
 private review():void {
  const records=this.session.snapshot.history.filter(h=>h.outcome!=='skipped');if(!records.length){this.screen='play';this.result();return;}
  this.reviewIndex=Math.max(0,Math.min(records.length-1,this.reviewIndex));const record=records[this.reviewIndex];
  this.heading(`本局回顾 ${this.reviewIndex+1}/${records.length}`,record.discarded?'重整前记录 · 不计入有效成绩':'有效成绩记录');this.drawFeedback(record);
  const geometry=reviewGeometry(this.layout),buttons=geometry.buttons;
  this.ui.button('PreviousReview','上一题',buttons[0].x,geometry.navCenter,buttons[0].width,geometry.buttonHeight,
   this.action(()=>{this.reviewIndex--;}),this.reviewIndex>0,CYAN,17);
  this.ui.button('CloseReview','返回结果',buttons[1].x,geometry.navCenter,buttons[1].width,geometry.buttonHeight,
   this.action(()=>{this.screen='play';}),true,PAPER,17);
  this.ui.button('NextReview','下一题',buttons[2].x,geometry.navCenter,buttons[2].width,geometry.buttonHeight,
   this.action(()=>{this.reviewIndex++;}),this.reviewIndex<records.length-1,CYAN,17);
 }
}
