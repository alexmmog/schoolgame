import {PhoneLayout} from './layout';
export function fittedSize(width:number,height:number,boxWidth:number,boxHeight:number):{width:number;height:number} {
 if(![width,height,boxWidth,boxHeight].every(n=>Number.isFinite(n)&&n>0))throw new Error('Invalid sprite geometry');
 const scale=Math.min(boxWidth/width,boxHeight/height);return {width:width*scale,height:height*scale};
}
export const MAP_LABEL_ANCHORS=[[0.30,0.27],[0.70,0.42],[0.30,0.60],[0.70,0.78]] as const;
export function mapArtGeometry(layout:PhoneLayout,width:number,height:number):{
 image:{x:number;y:number;width:number;height:number};stations:{x:number;y:number;width:number;height:number}[]
} {
 const fit=fittedSize(width,height,layout.width,520*layout.scale),top=layout.top+78*layout.scale,left=195-fit.width/2;
 return {image:{x:195,y:top+fit.height/2,...fit},stations:MAP_LABEL_ANCHORS.map(([x,y])=>({
  x:left+x*fit.width,y:top+y*fit.height,width:Math.min(196,layout.width*0.53),height:Math.max(64,68*layout.scale)}))};
}
