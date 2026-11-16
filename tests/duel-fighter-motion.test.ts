import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DUEL_ATLASES, LEGACY_ATLAS, fighterMotion } from '../src/duel/fighter-motion.ts'
import { P } from '../src/tune/params.ts'
import { DRAWN_IDLE } from '../src/realm/data/drawnIdle.ts'
const atlas = DUEL_ATLASES.aryeong!

test('채택한 작화 대기는 모두 범위 안이고 피격/공격을 가리지 않는다',()=>{
  assert.ok(['aryeong','soseono','heo','gamsil','eomni'].every(key=>DRAWN_IDLE[key]!==undefined))
  for(const [key,layout] of Object.entries(DRAWN_IDLE)){
    const sheet=DUEL_ATLASES[key]!
    assert.equal(sheet.cells,layout.cells)
    assert.equal(new Set(sheet.idle).size,key==='eomni'?2:3)
    for(const t of [0,650,1300,1950]){
      const f=fighterMotion(sheet,{kind:'idle',t0:0},t,false)
      assert.ok(f.frame>=0&&f.frame<sheet.cells);assert.equal(f.dx,0)
    }
    assert.equal(fighterMotion(sheet,{kind:'hit',t0:0},10,false).frame,sheet.hit)
    assert.equal(fighterMotion(sheet,{kind:'attack',t0:0},0,false).frame,sheet.attack[0])
  }
})

test('추가 네 장수는 작화 대기 프레임을 순환하고 피격은 기존 컷을 유지한다',()=>{
  for(const key of ['soseono','heo','gamsil','eomni']){
    const sheet=DUEL_ATLASES[key]!
    const frames=[0,650,1300,1950].map(t=>fighterMotion(sheet,{kind:'idle',t0:0},t,false).frame)
    assert.deepEqual(frames,key==='eomni'?[16,17,16,17]:[16,17,18,17])
    assert.equal(sheet.cells,key==='eomni'?18:19)
    assert.equal(fighterMotion(sheet,{kind:'hit',t0:0},10,false).frame,14)
  }
})

test('알영은 추가 작화 세 컷을 대기 중 순환하고 공격 때 기존 자세로 전환한다',()=>{
  const idle={kind:'idle',t0:0} as const
  assert.deepEqual([0,650,1300,1950,2600].map(t=>fighterMotion(atlas,idle,t,false).frame),[16,17,18,17,16])
  assert.equal(fighterMotion(atlas,{kind:'attack',t0:1000},1000,false).frame,5)
})

test('빈틈 노출 중에도 피격·방어가 비틀거림보다 먼저 나온다', () => {
  const hit = fighterMotion(atlas, {kind:'hit',t0:100}, 130, true)
  const guard = fighterMotion(atlas, {kind:'guard',t0:100}, 130, true)
  assert.equal(hit.frame, 14); assert.ok(hit.dx < 0)
  assert.equal(guard.frame, 11); assert.ok(Math.abs(guard.dx) < Math.abs(hit.dx))
  for (const kind of ['hit','guard'] as const) {
    const after = fighterMotion(atlas,{kind,t0:100},100+P.duel.fighterHitMs+P.duel.fighterGuardMs,true)
    assert.ok(atlas.stagger.includes(after.frame)); assert.equal(after.dx, 0)
  }
})
test('비틀거림은 두 자세로 바뀌어도 의미 없는 위치 진동이 없다', () => {
  const poses = new Set<number>()
  for(let now=0;now<2000;now+=16){
    const f=fighterMotion(atlas,{kind:'stagger',t0:0},now,true)
    poses.add(f.frame);assert.equal(f.dx,0)
  }
  assert.deepEqual([...poses].sort(),[12,13])
})
test('구형 20칸과 새 16칸의 모든 상태가 범위 안이며 불완전한 창 자세는 선택하지 않는다', () => {
  for(const sheet of [atlas,LEGACY_ATLAS]) for(const kind of ['idle','windup','attack','guard','hit','stagger'] as const)
    for(const rush of [false,true]) for(let now=0;now<1000;now+=16){
      const f=fighterMotion(sheet,{kind,t0:0},now,rush)
      assert.ok(f.frame>=0 && f.frame<sheet.cells)
      if(sheet===atlas) assert.notEqual(f.frame,6)
    }
})
test('결판은 피격·방어와 빈틈보다 우선한다',()=>{
  assert.deepEqual(fighterMotion(atlas,{kind:'guard',t0:0},20,true,'dead'),{frame:15,dx:0})
})
