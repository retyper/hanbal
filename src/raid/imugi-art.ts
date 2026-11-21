/** Stage-lazy originals. Importing this module performs no image request. */
export const IMUGI_ART={
 'head-upper':'raid/giants/imugi/head-upper.png',
 'jaw-lower':'raid/giants/imugi/jaw-lower.png',
 'neck-segment':'raid/giants/imugi/neck-segment.png',
 'tail-tip':'raid/giants/imugi/tail-tip.png',
} as const
const dimensions:Readonly<Record<string,readonly [number,number]>>={
 'head-upper':[1536,1024],'jaw-lower':[1774,887],'neck-segment':[1145,1374],'tail-tip':[1536,1024],
}
const pending=new WeakMap<Map<string,HTMLImageElement>,Promise<boolean>>()
export const imugiArtReady=(images:ReadonlyMap<string,HTMLImageElement>)=>Object.entries(IMUGI_ART).every(([key,path])=>{const i=images.get(path),d=dimensions[key]!;return !!i&&i.complete&&(i.naturalWidth||i.width)===d[0]&&(i.naturalHeight||i.height)===d[1]})
/** Explicit prewarm before ford entry. Failures are false, with no partial map installation. */
export function prewarmImugiArt(stage:string,images:Map<string,HTMLImageElement>,base:string,make:()=>HTMLImageElement=()=>new Image()):Promise<boolean>{
 if(stage!=='ford'||imugiArtReady(images))return Promise.resolve(true)
 const prior=pending.get(images);if(prior)return prior
 const job=Promise.all(Object.entries(IMUGI_ART).map(([key,path])=>new Promise<readonly [string,HTMLImageElement]>((resolve,reject)=>{
  const img=make();img.onload=()=>{void(async()=>{try{await img.decode?.();const d=dimensions[key]!;if((img.naturalWidth||img.width)!==d[0]||(img.naturalHeight||img.height)!==d[1])throw Error('imugi-native-size');resolve([path,img])}catch(e){reject(e)}})()};img.onerror=()=>reject(Error('imugi-art-load'));img.src=base+path
 }))).then(items=>{for(const[path,img]of items)images.set(path,img);return true},()=>false).finally(()=>pending.delete(images))
 pending.set(images,job);return job
}
