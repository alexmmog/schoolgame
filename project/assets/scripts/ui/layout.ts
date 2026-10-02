export const DESIGN_WIDTH=390, DESIGN_HEIGHT=844;
export interface SafeRect {x:number;y:number;width:number;height:number}
export interface PhoneLayout {left:number;right:number;top:number;bottom:number;width:number;scale:number}
export function phoneLayout(safe:SafeRect):PhoneLayout {
 const finite=[safe.x,safe.y,safe.width,safe.height].every(Number.isFinite);
 const rect=finite&&safe.width>0&&safe.height>0?safe:{x:0,y:0,width:390,height:844};
 const left=Math.max(16,Math.min(45,rect.x+8));
 const right=Math.max(16,Math.min(45,390-rect.x-rect.width+8));
 const top=Math.max(52,Math.min(105,844-rect.y-rect.height+12));
 const bottom=Math.max(28,Math.min(55,rect.y+12));
 return {left,right,top,bottom,width:390-left-right,scale:(844-top-bottom)/764};
}
export function questionGeometry(layout:PhoneLayout,count:number):{sceneTop:number;sceneHeight:number;cardTop:number;cardHeight:number;optionTop:number;optionHeight:number;optionGap:number;actionTop:number;footerTop:number} {
 if(count!==2&&count!==4)throw new Error('Only 2/4 choices supported');
 return {sceneTop:layout.top+119*layout.scale,sceneHeight:84*layout.scale,
  cardTop:layout.top+212*layout.scale,cardHeight:116*layout.scale,
  optionTop:layout.top+335*layout.scale,optionHeight:56,optionGap:7*layout.scale,
  actionTop:layout.top+646*layout.scale,footerTop:layout.top+721*layout.scale};
}
export function reviewGeometry(layout:PhoneLayout):{explanationBottom:number;navTop:number;navCenter:number;buttonHeight:number;buttons:{x:number;width:number}[]} {
 const explanationBottom=layout.top+(566+159/2)*layout.scale;
 const buttonHeight=Math.max(50,54*layout.scale),navTop=explanationBottom+9;
 const width=(layout.width-16)/3;
 return {explanationBottom,navTop,navCenter:navTop+buttonHeight/2,buttonHeight,
  buttons:[0,1,2].map(i=>({x:layout.left+width/2+i*(width+8),width}))};
}
