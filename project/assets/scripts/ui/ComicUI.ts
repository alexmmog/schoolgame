import {Node,UITransform,Layers,Color,Graphics,Label,Button,Sprite,SpriteFrame} from 'cc';
import {DESIGN_WIDTH as W,DESIGN_HEIGHT as H} from './layout';
import {ComicArt} from './ComicArt';
import {fittedSize} from './art-layout';
export const INK=new Color(41,37,34), IVORY=new Color(255,246,230), PAPER=new Color(255,253,247);
export const CORAL=new Color(248,132,85), CYAN=new Color(137,191,184), GRAY=new Color(222,215,204);
export const GOLD=new Color(248,219,134), MUTED=new Color(109,100,89);

/** Native Cocos labels/buttons layered with generated comic Sprite assets. */
export class ComicUI {
 private art?:ComicArt;
 constructor(private root:Node){}
 attachArt(art:ComicArt):void {this.art=art;}
 sprite(name:string,frame:SpriteFrame,x:number,y:number,boxWidth:number,boxHeight:number):Node {
  const size=fittedSize(frame.originalSize.width,frame.originalSize.height,boxWidth,boxHeight);
  const node=this.node(name,x,y,size.width,size.height),sprite=node.addComponent(Sprite);
  sprite.spriteFrame=frame;sprite.sizeMode=Sprite.SizeMode.CUSTOM;sprite.trim=false;
  node.getComponent(UITransform)!.setContentSize(size.width,size.height);return node;
 }
 comicScene(stage:number,x:number,y:number,width:number,height:number):void {
  if(!this.art)throw new Error('Generated art not loaded');
  this.panel('ChapterComic',x,y,width,height,PAPER);
  const heroWidth=Math.min(102,width*0.30),sceneWidth=width-heroWidth-15;
  this.sprite('GeneratedChapterEnvironment',this.art.scene(stage),x-heroWidth/2-3,y,sceneWidth,height-8);
  this.sprite('SameGeneratedHeroInEveryChapter',this.art.get('hero-neutral'),x+width/2-heroWidth/2-5,y,heroWidth,height-4);
 }
 clear():void {for(const c of [...this.root.children]){c.active=false;c.destroy();}this.panel('IvoryBackground',W/2,H/2,W+10,H+10,IVORY,false);}
 private node(name:string,x:number,y:number,w:number,h:number):Node {
  const n=new Node(name);n.layer=Layers.Enum.UI_2D;this.root.addChild(n);n.setPosition(x-W/2,H/2-y);
  n.addComponent(UITransform).setContentSize(w,h);return n;
 }
 panel(name:string,x:number,y:number,w:number,h:number,fill=PAPER,shadow=true):Node {
  const n=this.node(name,x,y,w,h),g=n.addComponent(Graphics);g.lineWidth=3;g.strokeColor=INK;
  if(shadow){g.fillColor=INK;g.roundRect(-w/2+3,-h/2-4,w,h,12);g.fill();}
  g.fillColor=fill;g.roundRect(-w/2,-h/2,w,h,12);g.fill();g.stroke();return n;
 }
 text(name:string,text:string,x:number,y:number,w:number,h:number,size=20,color=INK,align:'left'|'center'='left'):Label {
  return this.label(this.node(name,x,y,w,h),text,w,h,size,color,align);
 }
 label(parent:Node,text:string,w:number,h:number,size=20,color=INK,align:'left'|'center'='center'):Label {
  const n=new Node('LiveText');n.layer=Layers.Enum.UI_2D;parent.addChild(n);n.addComponent(UITransform).setContentSize(w,h);
  const label=n.addComponent(Label);label.useSystemFont=true;label.fontFamily='Microsoft YaHei';label.fontSize=size;
  label.lineHeight=Math.round(size*1.35);label.enableWrapText=true;label.overflow=Label.Overflow.CLAMP;
  label.horizontalAlign=align==='left'?Label.HorizontalAlign.LEFT:Label.HorizontalAlign.CENTER;
  label.verticalAlign=Label.VerticalAlign.CENTER;label.color=color;label.string=text;return label;
 }
 button(name:string,text:string,x:number,y:number,w:number,h:number,click:()=>void,enabled=true,fill=CORAL,size=20):Node {
  const n=this.panel(name,x,y,w,h,enabled?fill:GRAY);this.label(n,text,w-22,h-8,size);
  const b=n.addComponent(Button);b.interactable=enabled;b.transition=Button.Transition.SCALE;b.zoomScale=0.97;b.duration=0.08;
  n.on(Button.EventType.CLICK,click);return n;
 }
 icon(symbol:'check'|'wrong'|'clock'|'lock'|'arrow'|'star',x:number,y:number,size=26):void {
  const g=this.node(`Vector-${symbol}`,x,y,size,size).addComponent(Graphics),s=size/26;g.lineWidth=3;g.strokeColor=INK;g.fillColor=INK;
  if(symbol==='check'){g.moveTo(-10*s,0);g.lineTo(-3*s,-7*s);g.lineTo(10*s,9*s);}
  else if(symbol==='wrong'){g.moveTo(-8*s,-8*s);g.lineTo(8*s,8*s);g.moveTo(-8*s,8*s);g.lineTo(8*s,-8*s);}
  else if(symbol==='clock'){g.circle(0,0,10*s);g.stroke();g.moveTo(0,6*s);g.lineTo(0,0);g.lineTo(5*s,-3*s);}
  else if(symbol==='lock'){g.roundRect(-9*s,-10*s,18*s,14*s,3*s);g.stroke();g.moveTo(-6*s,4*s);g.lineTo(-6*s,8*s);g.bezierCurveTo(-6*s,15*s,6*s,15*s,6*s,8*s);g.lineTo(6*s,4*s);}
  else if(symbol==='arrow'){g.moveTo(-10*s,0);g.lineTo(10*s,0);g.moveTo(3*s,7*s);g.lineTo(10*s,0);g.lineTo(3*s,-7*s);}
  else {for(let i=0;i<10;i++){const a=Math.PI/2+i*Math.PI/5,r=(i%2?5:12)*s,x=Math.cos(a)*r,y=Math.sin(a)*r;i?g.lineTo(x,y):g.moveTo(x,y);}g.close();}
  g.stroke();
 }
 composure(value:number,x:number,y:number):void {
  for(let i=0;i<3;i++){const g=this.node(`Composure-${i}`,x+i*29,y,22,22).addComponent(Graphics);
   g.fillColor=i<value?CORAL:PAPER;g.strokeColor=INK;g.lineWidth=2.5;g.circle(0,0,10);g.fill();g.stroke();
   if(i>=value){g.moveTo(-5,0);g.lineTo(5,0);g.stroke();}}
 }
 stationIcon(stage:number,x:number,y:number):void {
  const g=this.node(`StationArt-${stage}`,x,y,42,42).addComponent(Graphics);g.strokeColor=INK;g.lineWidth=3;
  if(stage===0){g.rect(-16,-13,32,28);g.moveTo(-5,-13);g.lineTo(-5,15);g.moveTo(-14,7);g.lineTo(-8,7);g.moveTo(0,7);g.lineTo(12,7);}
  else if(stage===1){g.roundRect(-11,-12,20,23,3);g.moveTo(9,8);g.bezierCurveTo(24,10,24,-8,9,-6);g.moveTo(-7,15);g.lineTo(-7,20);g.moveTo(3,15);g.lineTo(3,20);}
  else if(stage===2){g.roundRect(-17,-7,32,24,8);g.moveTo(-6,-7);g.lineTo(-13,-16);g.lineTo(-13,-5);g.circle(-7,5,1);g.circle(0,5,1);g.circle(7,5,1);}
  else {g.moveTo(-16,-16);g.lineTo(17,-16);g.moveTo(0,-16);g.lineTo(0,1);g.roundRect(-7,1,14,18,6);}g.stroke();
 }
 character(x:number,y:number,scale=1):void {
  if(!this.art)throw new Error('Generated heroine not loaded');
  this.sprite('GeneratedOrangeHoodieHero',this.art.get('hero-neutral'),x,y,240*scale,240*scale);
 }
}
