import{test}from'node:test'
import assert from'node:assert/strict'
import{readFileSync}from'node:fs'
import{planCountryFold}from'../src/ui/realm/map-landscape.ts'
test('narrow country row reserves the real +N width and keeps original visible order',()=>{
 const p=planCountryFold([42,30,30,30].map((width,i)=>({width,priority:i===0?2:0})),110,0,0,24,4)
 assert.deepEqual(p,{visible:[0,1],hidden:2,overflow:false})
})
test('player and selected nation get priority without mutating the source list',()=>{
 const items=[0,1,2,3].map(i=>({width:36,priority:i===0?2:i===3?1:0})),before=JSON.stringify(items)
 assert.deepEqual(planCountryFold(items,116,0,0,24,4),{visible:[0,3],hidden:2,overflow:false});assert.equal(JSON.stringify(items),before)
})
test('crowns and envoy slots consume space but never count as hidden countries',()=>{
 const p=planCountryFold([0,1,2].map(i=>({width:30,priority:i===0?2:0})),112,40,1,24,4)
 assert.deepEqual(p,{visible:[0],hidden:2,overflow:false})
})
test('wide row shows all, impossible budget reports overflow instead of shrinking text',()=>{
 const items=[{width:40,priority:2},{width:40,priority:0}]
 assert.deepEqual(planCountryFold(items,100,0,0,24,4),{visible:[0,1],hidden:0,overflow:false})
 assert.deepEqual(planCountryFold(items,10,0,0,24,4),{visible:[],hidden:2,overflow:true})
})
test('landscape map has one scoped 34px top and 44px rail, portrait defaults remain',()=>{
 const css=readFileSync(new URL('../src/ui/realm/appstyle.ts',import.meta.url),'utf8')
 assert.match(css,/export const LANDSCAPE_MAP_CSS/);assert.match(css,/@media \(orientation: landscape\)/)
 assert.match(css,/--toph: calc\(34px \+ env\(safe-area-inset-top\)\)/);assert.match(css,/--rail: 44px/)
 assert.match(css,/--tabh: calc\(62px \+ env\(safe-area-inset-bottom\)\)/)
 const added=css.slice(css.indexOf('export const LANDSCAPE_MAP_CSS'))
 assert.ok(added.indexOf('button.locked img.tic { display: none; }')<added.indexOf('@media (orientation: landscape)'),'new locked icons stay hidden by default, including portrait')
 assert.match(added,/data-expanded='true'\] \.lg \.mood \{ display: inline-block/)
})
