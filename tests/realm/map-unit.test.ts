import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mapSquad } from '../../src/ui/realm/map-unit.ts'
import { startRegion } from '../../src/realm/data/regions/index.ts'
import { mapHtml } from '../../src/ui/realm/mapview.ts'
test('unit tokens omit portrait and flag but retain army selection and count',()=>{
 const r=startRegion('byeonhan-mini',7,'us'),a=Object.values(r.armies)[0]!
 const html=mapHtml(r,r.player,'/realm/',[],'',null,[{army:a.id,node:a.at,men:321,sel:false,going:false,img:'portrait-to-remove.jpg',squad:mapSquad(['spear'],undefined,'/realm/')}])
 const token=html.match(/<button class="tok[\s\S]*?<\/button>/)![0]
 assert.ok(token.includes('data-army="'+a.id+'"'));assert.ok(token.includes('321'))
 assert.ok(!token.includes('portrait-to-remove'));assert.ok(!token.includes('class="flag"'))
})
test('map army uses one commander, awakening variant, or a single ordinary soldier',()=>{
 const base=Object.values(startRegion('byeonhan-mini',7,'us').heroes)[0]!
 assert.equal(mapSquad(['spear','bow'],undefined,'/realm/').length,1)
 assert.equal(mapSquad(['spear'],{...base,id:'tut-haebi'},'/realm/')[0]!.src,'/realm/anim-px/gen-haebi.png')
 assert.equal(mapSquad(['spear'],{...base,id:'tut-haebi',ascended:true},'/realm/')[0]!.src,'/realm/anim-px/gen-aw1-haebi.png')
 assert.ok(mapSquad([],undefined,'/realm/')[0]!.src.endsWith('/spear.png'))
 assert.ok(mapSquad(['boat'],undefined,'/realm/')[0]!.src.endsWith('/marine.png'))
})
