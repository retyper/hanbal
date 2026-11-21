export interface EndingVideoInput {
 host:HTMLElement;run:object|null;portraitKey:string;kind:'victory'|'defeat'|'retreat'|null;visible:boolean;lowGraphics?:boolean
}
type Entry={host:HTMLElement;run:object;kind:string;low:boolean;visible:boolean;poster:HTMLImageElement|null;video:HTMLVideoElement|null;posterReady:boolean;posterFailed:boolean;frame:boolean;played:boolean;held:boolean;pending:boolean;attempt:number;off:(()=>void)[]}
/** Only approved clips. Identity is the actual portrait key, not the campaign ID. */
const clips:Record<string,Partial<Record<'victory'|'defeat',string>>>={
 'w-102-garak-dana':{victory:'victory_w-102-garak-dana',defeat:'defeat_w-102-garak-dana'},
}
export function createEndingVideo(base:string,makeVideo=(host:HTMLElement)=>host.ownerDocument.createElement('video'),makeImage=(host:HTMLElement)=>host.ownerDocument.createElement('img')){
 let current:Entry|null=null
 const alive=(e:Entry)=>current===e
 const present=(e:Entry)=>{
  e.host.classList.toggle('ending-media-ready',e.posterReady||e.frame&&e.played)
  e.host.classList.toggle('ending-video-ready',e.visible&&e.frame&&e.played)
 }
 const removeVideo=(e:Entry)=>{e.attempt++;e.pending=false;const v=e.video;e.video=null;if(v){v.pause();v.removeAttribute('src');v.load();v.remove()}e.frame=e.played=false;present(e)}
 const detach=(e:Entry)=>{e.off.forEach(off=>off());e.off=[];removeVideo(e);e.poster?.removeAttribute('src');e.poster?.remove();e.poster=null;e.host.classList.remove('ending-video-host','ending-media-ready','ending-video-ready')}
 const clear=()=>{const old=current;current=null;if(old)detach(old)}
 const play=(e:Entry)=>{
  const v=e.video;if(!alive(e)||!v||!e.visible||e.held||e.pending||e.played&&!v.paused)return
  const ticket=++e.attempt;e.pending=true
  try{Promise.resolve(v.play()).then(()=>{if(!alive(e)||e.video!==v||ticket!==e.attempt||!e.visible)return;e.pending=false;e.played=true;e.held=v.ended;present(e)},()=>{if(alive(e)&&e.video===v&&ticket===e.attempt&&e.visible)removeVideo(e)})}catch{removeVideo(e)}
 }
 const sync=(input:EndingVideoInput)=>{
  const{host,run,portraitKey,kind,visible}=input,low=!!input.lowGraphics
  const clip=kind==='victory'||kind==='defeat'?clips[portraitKey]?.[kind]:undefined
  if(!run||!clip||!kind){clear();return}
  if(current&&(current.run!==run||current.kind!==kind||current.low!==low))clear()
  if(!current){
   if(!visible)return
   const poster=makeImage(host),video=low?null:makeVideo(host)
   const e:Entry={host,run,kind,low,visible,poster,video,posterReady:false,posterFailed:false,frame:false,played:false,held:false,pending:false,attempt:0,off:[]};current=e;host.classList.add('ending-video-host')
   const listen=(target:EventTarget,type:string,fn:()=>void)=>{target.addEventListener(type,fn);e.off.push(()=>target.removeEventListener(type,fn))}
   poster.className='ending-poster';poster.alt='';poster.setAttribute('aria-hidden','true')
   listen(poster,'load',()=>{if(alive(e)&&poster.naturalWidth>0){e.posterReady=true;present(e)}})
   listen(poster,'error',()=>{if(alive(e)){e.posterFailed=true;e.posterReady=false;poster.remove();present(e)}})
   const root=(base.endsWith('/')?base:base+'/')+'realm/raid/ending/'
   poster.src=root+clip+'.jpg';host.appendChild(poster)
   if(video){
    const frame=()=>{if(alive(e)&&e.video===video&&video.readyState>=2&&video.videoWidth>0&&video.videoHeight>0){e.frame=true;present(e)}}
    listen(video,'loadeddata',frame);listen(video,'error',()=>{if(alive(e)&&e.video===video)removeVideo(e)})
    listen(video,'ended',()=>{if(!alive(e)||e.video!==video)return;e.held=e.played=true;e.pending=false;e.attempt++;frame();video.pause();present(e)})
    video.className='ending-video';video.setAttribute('aria-hidden','true');video.tabIndex=-1
    video.muted=video.defaultMuted=true;video.volume=0;video.autoplay=true;video.playsInline=true;video.controls=false;video.loop=false;video.preload='auto'
    for(const name of ['muted','autoplay','playsinline'])video.setAttribute(name,'')
    video.src=root+clip+'.mp4';host.appendChild(video);play(e)
   }
   return
  }
  const e=current
  if(e.host!==host){e.host.classList.remove('ending-video-host','ending-media-ready','ending-video-ready');e.host=host;host.classList.add('ending-video-host');if(e.poster)host.appendChild(e.poster);if(e.video)host.appendChild(e.video)}
  if(e.visible&&!visible){e.attempt++;e.pending=false;e.video?.pause()}
  e.visible=visible;present(e);play(e)
 }
 return{sync,clear}
}
