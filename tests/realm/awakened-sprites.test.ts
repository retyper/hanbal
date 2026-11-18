import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { GEN_OWN, genArtOf, generalSprite } from '../../src/realm/data/art.ts'
import { AWAKENED_BY_BASE, AWAKENED_ANIM } from '../../src/realm/data/awakenedSpritesGenerated.ts'
import { DUEL_ATLASES, fighterMotion } from '../../src/duel/fighter-motion.ts'

const hero=(id:string,ascended?:boolean)=>({id,...(ascended===undefined?{}:{ascended}),look:'w' as const,traits:[],mu:5,tong:5,ryak:5,chi:5,deok:5})

test('awakening switches only installed variants and preserves every base/alias fallback',()=>{
  for(const [id,base] of Object.entries(GEN_OWN)){
    assert.equal(generalSprite(hero(id)),base)
    assert.equal(generalSprite(hero(id,false)),base)
    assert.equal(generalSprite(hero(id,true)),AWAKENED_BY_BASE[base]??base)
  }
  assert.equal(generalSprite(hero('unknown',true)),'w-spear')
})

test('awakened variants use complete private battle and duel sheets with interruptible hit/guard/stagger',()=>{
  // 11-18: 열 명에서 늘어난다 (tools/sprite-kit/aw1-intake.py 가 한 명씩 넣는다)
  assert.ok(Object.keys(AWAKENED_BY_BASE).length>=10)
  for(const key of Object.values(AWAKENED_BY_BASE)){
    const art=genArtOf(key), atlas=DUEL_ATLASES[key]!
    assert.equal(art.kind,key);assert.ok(existsSync('public/realm/'+art.file))
    const png=readFileSync(`public/realm/duel/sprites/gen-${key}.png`)
    assert.equal(png.readUInt32BE(16),Math.round(art.ar*160)*20)
    assert.equal(png.readUInt32BE(20),160)
    // 서기 그림: 옛 열 명은 셋(0·1·2·1) · 띠 차례로 받은 판(aw1-intake)은 넷
    assert.equal(atlas.cells,20);assert.ok(new Set(atlas.idle).size>=3)
    for(const frame of [...atlas.idle,...atlas.attack,...atlas.windup,...atlas.guard,...atlas.stagger,atlas.hit,atlas.dead])assert.ok(Number.isInteger(frame)&&frame>=0&&frame<20,`${key}/${frame}`)
    for(const kind of ['idle','windup','attack','guard','stagger','hit'] as const){
      for(const t of [0,120,650,1300,1950]){
        const motion=fighterMotion(atlas,{kind,t0:0},t,false)
        assert.ok(motion.frame>=0&&motion.frame<20,`${key}/${kind}/${t}`)
      }
    }
    assert.equal(fighterMotion(atlas,{kind:'hit',t0:0},10,false).frame,atlas.hit)
    assert.equal(fighterMotion(atlas,{kind:'guard',t0:0},10,false).frame,atlas.guard[0])
  }
})

test('archer awakening keeps ranged animation; a hero without an installed awakened strip stays on the base strip',()=>{
  for(const base of ['mir','dangung','jumong'])assert.equal(AWAKENED_ANIM[AWAKENED_BY_BASE[base]!]!.bow,true)
  for(const base of ['haebi','soseono','ara'])assert.ok(!AWAKENED_ANIM[AWAKENED_BY_BASE[base]!]!.bow)
  // 각성 띠는 비각성 띠와 같은 무기 갈래다 (활이면 활 · 아니면 아님)
  for(const [base,key] of Object.entries(AWAKENED_BY_BASE))assert.equal(!!AWAKENED_ANIM[key]!.bow,!!genArtOf(base).bow,`${base} → ${key}`)
  // 알영: 11-14 판은 보류였다 · 새 판이 통과해 들어오기 전에는 비각성 띠 그대로
  if(AWAKENED_BY_BASE.aryeong===undefined)assert.equal(generalSprite(hero('sr-aryeong',true)),'aryeong')
})
