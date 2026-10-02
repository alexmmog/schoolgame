import {resources,SpriteFrame,Texture2D} from 'cc';
export const ART_NAMES=['hero-neutral','map-neighborhood','scene-campus','scene-store','scene-cafe','scene-stage'] as const;
export type ArtName=typeof ART_NAMES[number];
export class ComicArt {
 private released=false;
 private constructor(private frames:Map<ArtName,SpriteFrame>){}
 static load(done:(error:Error|null,art?:ComicArt)=>void):void {
  const frames=new Map<ArtName,SpriteFrame>();let left=ART_NAMES.length,failed=false;
  for(const name of ART_NAMES)resources.load(`art/${name}/spriteFrame`,SpriteFrame,(error,frame)=>{
   if(failed)return;
   if(error||!frame){failed=true;for(const f of frames.values())f.decRef();frames.clear();done(error??new Error(`Missing art ${name}`));return;}
   frame.packable=false;frame.texture.setFilters(Texture2D.Filter.LINEAR,Texture2D.Filter.LINEAR);frame.texture.setMipFilter(Texture2D.Filter.NONE);
   frame.texture.setWrapMode(Texture2D.WrapMode.CLAMP_TO_EDGE,Texture2D.WrapMode.CLAMP_TO_EDGE);
   frame.addRef();frames.set(name,frame);if(--left===0)done(null,new ComicArt(frames));
  });
 }
 get(name:ArtName):SpriteFrame {const frame=this.frames.get(name);if(this.released||!frame)throw new Error(`Art unavailable: ${name}`);return frame;}
 scene(stage:number):SpriteFrame {return this.get(ART_NAMES[stage+2]);}
 release():void {if(this.released)return;this.released=true;for(const frame of this.frames.values())frame.decRef();this.frames.clear();}
}
