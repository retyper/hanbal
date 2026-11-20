import { spawn, execFileSync } from 'node:child_process'
import { existsSync,mkdtempSync,rmSync,writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const out=process.argv[2], port=9773, profile=mkdtempSync(join(tmpdir(),'pir-vis-')); const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const exe=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync);
const child=spawn(exe,['--headless=new',`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,'--no-first-run','--mute-audio','about:blank'],{stdio:'ignore'});
try{let tabs;for(let n=0;n<50&&!tabs;n++){try{tabs=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json()}catch{await sleep(100)}}
const ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);let id=0;const pending=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)?.(m.result??m.error);pending.delete(m.id)}};
const call=(method,params={})=>new Promise(r=>{const k=++id;pending.set(k,r);ws.send(JSON.stringify({id:k,method,params}))});const ev=async expression=>(await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true})).result?.value;
await call('Emulation.setDeviceMetricsOverride',{width:1000,height:720,deviceScaleFactor:1,mobile:false});await call('Page.enable');await call('Runtime.enable');const errors=[];ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text)});
await call('Page.navigate',{url:process.env.PIRATE_FIXTURE_URL??'http://localhost:5174/tools/pirate-visibility-fixture.html'});let result;for(let n=0;n<100&&!result;n++){result=await ev('window.fixtureResult');await sleep(100)}
if(result){
const oldSource=execFileSync('git',['show','692b174d:src/night/draw.ts'],{encoding:'utf8'});const a=oldSource.indexOf('export function drawPull('),b=oldSource.indexOf('\n/**',a);const baseline=oldSource.slice(a,b).replace('export function drawPull(ctx: CanvasRenderingContext2D, p: Pull): void','function drawOld(ctx,p)');
const comparison=await ev(`(async()=>{const tr=(await import('/src/i18n/index.ts')).t;${baseline};const {drawPull,BOOST}=window.fixtureAPI;const was=BOOST.on;BOOST.on=false;const a=document.createElement('canvas'),b=document.createElement('canvas');a.width=b.width=400;a.height=b.height=400;const ac=a.getContext('2d'),bc=b.getContext('2d');const cases=[{active:false,frac:0,inDead:true},{active:true,frac:0,inDead:true},{active:true,frac:.72,inDead:false},{active:true,frac:1,inDead:false}];const checks=[];for(const c of cases){ac.clearRect(0,0,400,400);bc.clearRect(0,0,400,400);const p={dead:18,ax:175,ay:200,x:98,y:230,max:112,...c};drawOld(ac,p);drawPull(bc,p);const aa=ac.getImageData(0,0,400,400).data,bb=bc.getImageData(0,0,400,400).data;let mismatch=0;for(let i=0;i<aa.length;i++)if(aa[i]!==bb[i])mismatch++;checks.push({state:c,mismatch})}BOOST.on=was;return {ok:checks.every(x=>x.mismatch===0),value:checks}})()`);
result.checks.push({name:'BOOST off 당김 4상태 이전 픽셀 동일',...comparison});result.ok=result.checks.every(x=>x.ok);
}
const shot=await call('Page.captureScreenshot',{format:'png'});if(out)writeFileSync(out,Buffer.from(shot.data,'base64'));console.log(JSON.stringify({errors,result},null,2));ws.close();if(errors.length||!result?.ok)process.exitCode=1;
}finally{child.kill();await sleep(300);try{rmSync(profile,{recursive:true,force:true})}catch{}}
