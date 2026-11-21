import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createContext, runInContext } from 'node:vm'
import * as ts from 'typescript'

function beginFixture(){
 const source=readFileSync(new URL('../src/raid-main.ts',import.meta.url),'utf8'), file=ts.createSourceFile('raid-main.ts',source,ts.ScriptTarget.Latest,true)
 const fn=file.statements.filter(s=>ts.isFunctionDeclaration(s)&&['begin','cancelBegin'].includes(s.name?.text??''))
 const js=ts.transpileModule(fn.map(n=>n.getText(file)).join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText
 let finish!:(ready:boolean)=>void, entered=false
 const ready=new Promise<boolean>(resolve=>{finish=resolve}),button={disabled:false,textContent:'ford 출전'},shop={hidden:true},stop=new Error('entered-start-commit')
 const sandbox=createContext({stage:'ford',startRevision:0,beginning:false,baseArtReady:true,mode:'stage',images:new Map(),base:'/realm/',trialEntryClosed:()=>false,sound:{unlock(){}},raidRulesForStage:(s:string)=>s==='ford'?'55-IMUGI':'56B',prewarmImugiArt:()=>ready,$:(id:string)=>id==='shop'?shop:button,startLabel:()=>sandbox.stage+' 출전',renderStageMenu:()=>{button.textContent=sandbox.stage+' 출전'},refreshWakeKind:()=>{entered=true;throw stop}})
 runInContext(js,sandbox)
 const pending=(runInContext('begin()',sandbox) as Promise<void>).catch(e=>{if(e!==stop)throw e})
 return {sandbox,button,shop,finish,pending,entered:()=>entered,cancel:()=>runInContext("if(typeof cancelBegin==='function')cancelBegin()",sandbox)}
}
test('55 a failed old ford art request cannot disable the stage selected while loading', async () => {
 const f=beginFixture();assert.equal(f.button.disabled,true);f.sandbox.stage='forest';f.cancel();f.finish(false);await f.pending
 assert.equal(f.button.disabled,false);assert.equal(f.button.textContent,'forest 출전');assert.equal(f.sandbox.beginning,false);assert.equal(f.entered(),false)
})
test('55 opening the shop or hero picker during art loading cancels the old start decision', async () => {
 const f=beginFixture();f.shop.hidden=false;f.cancel();f.finish(true);await f.pending
 assert.equal(f.entered(),false);assert.equal(f.button.disabled,false);assert.equal(f.button.textContent,'ford 출전');assert.equal(f.shop.hidden,false)
})

test('55 switching ford away and back never revives the original loading decision', async () => {
 const f=beginFixture();f.sandbox.stage='forest';f.cancel();f.sandbox.stage='ford';f.cancel();f.finish(true);await f.pending
 assert.equal(f.entered(),false);assert.equal(f.button.disabled,false);assert.equal(f.button.textContent,'ford 출전')
})
