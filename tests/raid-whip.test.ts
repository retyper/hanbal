// 열전 채찍 묶음 (11-25 형: 「채찍 좋은데 · 무기 전용 스킬이랑 스킬트리」 · docs/realm/WEAPON-KITS-SPECIAL-20261125.md 5절)
// W2 말채찍(줄 끝이 세다) · W3 올가미는 아래에 이어 붙는다
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HAEBI_RUN as C, HAEBI_KITS as K } from '../src/tune/params.ts'
import { createHaebi, stepHaebi, spawnMob, spawnGiant, powerScale, KITS, kitPowers, POWERS, type HaebiRun, type Mob } from '../src/raid/haebi.ts'
import { replay } from '../src/raid/haebi-replay.ts'

const DT = 1 / 120
const IDLE = { x: 0, y: 0 }
/** 적이 저절로 나오지 않는 판 */
function field(x = 300, y = C.height / 2) {
  const s = createHaebi(7, 'stage', 'whip', { simRules: '56B' }); s.spawn = 1e9; s.nextElite = 1e9; s.nextBarrage = 1e9; s.x = x; s.y = y
  return s
}
function place(s: HaebiRun, dx: number, dy: number, kind: Mob['kind'] = 'club', hp = 1e6) {
  spawnMob(s, 'club'); const e = s.enemies[s.enemies.length - 1]!
  Object.assign(e, { kind, x: s.x + dx, y: s.y + dy, hp, max: hp, cd: 99 })
  return e
}
const hurt = (e: Mob) => e.max - e.hp
const dist = (s: HaebiRun, e: Mob) => Math.hypot(e.x - s.x, e.y - s.y)
/** 그 쿨만 남기고 나머지 공격은 쉬게 */
function only(s: HaebiRun, keep: (keyof HaebiRun['cool'])[]) { for (const k of Object.keys(s.cool) as (keyof HaebiRun['cool'])[]) if (!keep.includes(k)) s.cool[k] = 99 }
const step = (s: HaebiRun, keep: (keyof HaebiRun['cool'])[] = []) => { only(s, keep); stepHaebi(s, IDLE, DT) }

test('채찍 묶음: 말채찍으로 시작 · 첫 고름은 갈래마다 하나(올가미·말채찍·기세) · 칸 16개 · 같은 판 규칙(58-KITS)이 저절로 켜진다', () => {
  const s = createHaebi(7, 'trial', 'whip')
  assert.ok(s.kits, '채찍은 옛 셈이 없다 — 규칙 없이 만들어도 새 셈')
  assert.equal(s.ranks.lash, 1); assert.equal(s.ranks.axe, 0)
  assert.equal(s.cool.lash, 0)
  s.xp = 999; stepHaebi(s, IDLE, .01)
  assert.deepEqual(s.offers, ['lasso', 'lash', 'tempo'])
  const powers = kitPowers('whip')
  assert.equal(powers.length, 16)
  assert.ok(powers.includes('lash') && powers.includes('lasso') && !powers.includes('dagger'))
  assert.equal(KITS.whip.weapon, '채찍'); assert.equal(POWERS.lash.name, '말채찍'); assert.equal(POWERS.lasso.name, '올가미')
  // 다른 묶음 판은 채찍 칸을 아예 안 만든다 (옛 판 상태가 글자 하나까지 같게)
  const d = createHaebi(7, 'stage', 'dagger')
  assert.ok(!('lash' in d.ranks) && !('lasso' in d.ranks) && !('lash' in d.cool) && !('snare' in d.cool))
})

test('말채찍: 줄 끝의 적은 몸쪽 적의 3배 · 가운데는 1배 · 줄 밖은 안 맞는다', () => {
  const s = field(), root = place(s, 20, 0), mid = place(s, 110, 0), tip = place(s, 190, 0), out = place(s, 300, 0), side = place(s, 100, 120)
  step(s, ['lash'])
  assert.ok(s.cool.lash > 0, '휘둘렀다')
  const base = (C.whipDamage + C.whipRankDamage) * powerScale(s) * K.whip.base
  assert.ok(Math.abs(hurt(root) - base * K.whip.root) < 1e-6, `몸쪽 ${hurt(root)}`)
  assert.ok(Math.abs(hurt(mid) - base) < 1e-6, `가운데 ${hurt(mid)}`)
  assert.ok(Math.abs(hurt(tip) - base * K.whip.tip) < 1e-6, `끝 ${hurt(tip)}`)
  const ratio = hurt(tip) / hurt(root)
  assert.ok(Math.abs(ratio - 3) < .15, `끝 ÷ 몸쪽 = ${ratio}`)
  assert.equal(hurt(out), 0, '길이 밖'); assert.equal(hurt(side), 0, '줄 폭 밖')
  assert.ok(tip.daze >= K.whip.daze - DT, '끝에 맞으면 멈칫'); assert.equal(mid.daze, 0)
})

test('말채찍: 단계마다 길어지고(14px) 세진다 · 4단계부터 줄이 되돌아와 한 번 더(0.5배 · 끝 가산 없음)', () => {
  const s = field(); s.ranks.lash = 3
  const near = place(s, 150, 0), far = place(s, 225, 0)   // 3단계 길이 232 · 끝 구간은 232×0.65 부터
  step(s, ['lash'])
  assert.ok(hurt(near) > 0 && hurt(far) > 0, '3단계 길이 안')
  const t = createHaebi(7, 'stage', 'whip', { simRules: '56B' }); t.spawn = 1e9; t.nextElite = 1e9; t.nextBarrage = 1e9; t.x = 300; t.y = C.height / 2; t.ranks.lash = 4
  const e = place(t, 60, 0)
  step(t, ['lash'])
  const first = hurt(e), base = (C.whipDamage + C.whipRankDamage * 4) * powerScale(t) * K.whip.base
  assert.ok(Math.abs(first - base * K.whip.root) < 1e-6, `첫 줄 몸쪽 ${first}`)
  for (let i = 0; i < Math.ceil(K.whip.back2 / DT) + 3; i++) step(t)
  assert.ok(Math.abs(hurt(e) - first - base * K.whip.back2Share) < 1e-6, `되감기 ${hurt(e) - first}`)
  for (let i = 0; i < 60; i++) step(t)
  assert.ok(Math.abs(hurt(e) - first - base * K.whip.back2Share) < 1e-6, '되감기는 한 번만')
})

test('말채찍: 끝에 셋 맞히면 큰 한 방 — 벽력이 튀고, 부적은 맞은 적에 붙는다', () => {
  const s = field(); s.ranks.ember = 1; s.ranks.thunder = 1
  place(s, 150, -14); place(s, 170, 0); place(s, 190, 14); place(s, 20, 0)
  step(s, ['lash', 'ember', 'thunder'])
  assert.ok(s.cool.thunder > 0, '벽력이 돌았다')
  assert.ok(s.shots.some(b => b.kind === 'ember' && b.source !== undefined), '부적이 붙었다')
  const u = field(); u.ranks.thunder = 1
  place(u, 110, 0)
  step(u, ['lash', 'thunder'])
  assert.equal(u.cool.thunder, 0, '끝에 못 맞히면 큰 한 방이 아니다')
})

test('말채찍: 같은 씨앗이면 같은 판 (2회 재생이 같다)', () => {
  const a = replay(5, 90, 'storm', undefined, 'whip'), b = replay(5, 90, 'storm', undefined, 'whip')
  assert.equal(JSON.stringify(a), JSON.stringify(b))
  assert.ok(a.damage > 0, '실제로 싸웠다')
})

test('올가미: 가장 센 적에게 고리가 날아가 맞으면 장수 앞 70px 까지 끌려오고 어지러워 선다 · 느려진다', () => {
  const s = field(), weak = place(s, 150, 40), target = place(s, 230, -30, 'club', 5e6)   // 더 센(체력 많은) 쪽이 표적
  s.ranks.lasso = 1; s.ranks.lash = 0
  step(s, ['lasso'])
  const ring = s.shots.find(b => b.kind === 'lasso')
  assert.ok(ring, '고리를 던짐'); assert.equal(ring.source, target.id); assert.ok(s.cool.lasso > 0)
  let done = -1, pulling = false
  for (let i = 0; i < 300 && done < 0; i++) { step(s); if (target.pull) pulling = true; else if (pulling) done = dist(s, target) }
  assert.ok(pulling, '끌려옴')
  assert.ok(Math.abs(done - C.lassoPullTo) <= 8, `장수 앞 ${done}px`)
  assert.ok(target.daze > 0, '어지러워 서 있다'); assert.ok((target.lasso ?? 0) > 0, '느려짐')
  assert.ok(hurt(target) > 0 && Math.abs(hurt(weak)) < 1e6)
  assert.ok(hurt(target) >= (C.lassoDamage + C.lassoRankDamage) * powerScale(s) - 1e-6)
})

test('올가미: 정예·두목·철갑은 끌려오지 않고 느려지기만 한다 (자리는 제 걸음대로)', () => {
  for (const kind of ['boss', 'elite', 'iron'] as const) {
    const run = (cast: boolean) => {
      const s = field(); s.ranks.lash = 0; s.ranks.lasso = cast ? 1 : 0
      const e = place(s, 200, 0, kind, 5e6)
      for (let i = 0; i < 120; i++) step(s, ['lasso'])
      return { s, e }
    }
    const lassoed = run(true), control = run(false)
    assert.equal(lassoed.e.pull, undefined, `${kind} 끌리지 않음`)
    assert.ok(hurt(lassoed.e) > 0, `${kind} 고리에 맞음`)
    assert.ok(dist(lassoed.s, lassoed.e) >= dist(control.s, control.e) - 1e-6, `${kind} 느려졌지 가까워지지 않음 (${dist(lassoed.s, lassoed.e)} ≥ ${dist(control.s, control.e)})`)
    assert.equal(lassoed.e.daze, 0, `${kind} 어지러워 서지 않음`)
  }
})

test('올가미: 이미 장수 앞(70px 안)의 적은 더 멀리 밀지 않고 부적이 붙는다', () => {
  const s = field(); s.ranks.lash = 0; s.ranks.lasso = 1; s.ranks.ember = 1
  const e = place(s, 50, 0)
  step(s, ['lasso', 'ember'])
  let hit = false
  for (let i = 0; i < 120 && !hit; i++) { step(s, ['ember']); hit = hurt(e) > 0 }
  assert.ok(hit); assert.equal(e.pull, undefined)
  assert.ok(dist(s, e) < C.lassoPullTo, '더 멀어지지 않음')
  assert.ok(s.shots.some(b => b.kind === 'ember' && b.source === e.id), '올가미가 맞힌 적에도 부적이 붙는다')
})

test('올가미: 정예(챔피언)도 끌려오지 않고 걸음이 느려진다 · 철갑 고리에 맞은 적도 느려진다', () => {
  const run = (cast: boolean) => {
    const s = field(); s.ranks.lash = 0; s.ranks.lasso = cast ? 1 : 0
    spawnMob(s, 'elite'); const e = s.enemies[s.enemies.length - 1]!
    Object.assign(e, { x: s.x + 260, y: s.y, hp: 5e6, max: 5e6 })
    assert.ok(e.champion, '정예는 챔피언 걸음')
    if (e.champion) { e.champion.mode = 'chase'; e.champion.t = 99 }
    for (let i = 0; i < 360; i++) step(s, ['lasso'])
    return { s, e }
  }
  const a = run(true), b = run(false)
  assert.equal(a.e.pull, undefined)
  assert.ok(hurt(a.e) > 0, '고리에 맞음')
  assert.ok(dist(a.s, a.e) > dist(b.s, b.e), `느려져 더 멀다 (${dist(a.s, a.e).toFixed(1)} > ${dist(b.s, b.e).toFixed(1)})`)
})

test('올가미: 단계 4마다 고리 하나 더 (서로 다른 적에게) · 닿기 전에 표적이 쓰러지면 고리가 사라진다', () => {
  const s = field(); s.ranks.lash = 0; s.ranks.lasso = 4
  const a = place(s, 200, 0), b = place(s, 210, 60), c = place(s, 220, -60)
  step(s, ['lasso'])
  const rings = s.shots.filter(x => x.kind === 'lasso')
  assert.equal(rings.length, 2, '4단계는 고리 둘')
  assert.equal(new Set(rings.map(x => x.source)).size, 2)
  a.hp = 0; b.hp = 0; c.hp = 0
  step(s); assert.equal(s.shots.filter(x => x.kind === 'lasso').length, 0)
})

test('올가미: 거구(거대 보스)는 맞아도 끌려오지 않는다 · 말채찍 줄은 거구에도 닿는다', () => {
  const s = createHaebi(257, 'stage', 'whip', { stage: 'ford', simRules: '55-IMUGI' })
  s.spawn = s.nextElite = s.nextBarrage = 1e9
  const e = spawnGiant(s)!
  s.x = e.x + 150; s.y = e.y; s.ranks.lasso = 1; s.ranks.lash = 1
  const before = e.hp, ox = e.x, oy = e.y
  for (let i = 0; i < 240; i++) { only(s, ['lasso', 'lash']); stepHaebi(s, IDLE, DT) }
  assert.ok(e.hp < before, '맞았다')
  assert.equal(e.pull, undefined)
  assert.ok(Math.hypot(e.x - ox, e.y - oy) < 60, `거구가 끌려오지 않음 (${Math.hypot(e.x - ox, e.y - oy).toFixed(1)}px)`)
})

// ── W6 · 옛 기록과 말투 (설계 5-6 · 5-8) ──
import { createHash } from 'node:crypto'
import { goldenRun } from './raid-golden-kit.ts'
import { normalizedRaidOpts } from '../src/raid/haebi.ts'
import { KIT_BY_SPRITE } from '../src/raid/kit-table.ts'
import { whipStyleOf, WHIP_SPRITES } from '../src/raid/whip-style.ts'
const sha = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex')

test('말갈기의 옛 기록(kit:dagger)은 채찍 묶음이 들어온 뒤에도 글자 하나 안 바뀐다 (채찍 이전 HEAD 에서 구운 해시)', () => {
  assert.equal(sha(goldenRun('forest', 'dagger', 7, 90)), '884597cc718187b3b86e4bd1c627e485711dbf7f407df96280f34c99863d596e')
  assert.equal(sha(goldenRun('palisade', 'dagger', 11, 90)), '249006bf43ac9f1f9c550f4c227e5fba8fc5e971f26a8e5149d44d3e39dbd960')
})

test('표를 켜기 전: 채찍 그림의 여섯 장수는 아직 단검 묶음이다 (형의 판은 계속 단검) · 말투 표는 여섯 모두 안다', () => {
  assert.equal(WHIP_SPRITES.length, 6)
  for (const key of WHIP_SPRITES) assert.equal(KIT_BY_SPRITE[key], 'dagger', key)
  assert.deepEqual(WHIP_SPRITES.map(whipStyleOf), ['crack', 'crack', 'crack', 'noose', 'noose', 'noose'])
  assert.equal(whipStyleOf('haebi'), 'crack')
})

test('말투: 판 기록 opts 에 남고(normalizedRaidOpts) 그 기록으로 다시 만든 판이 같다 · crack 은 끝이 더 세고 noose 는 올가미가 빠르다', () => {
  const make = (style?: 'crack' | 'noose') => { const s = createHaebi(7, 'stage', 'whip', { simRules: '56B', ...(style ? { whipStyle: style } : {}) }); s.spawn = 1e9; s.nextElite = 1e9; s.nextBarrage = 1e9; s.x = 300; s.y = C.height / 2; return s }
  const a = make('noose'), rec = normalizedRaidOpts(a, { simRules: '56B', whipStyle: 'noose' })
  assert.equal(rec.whipStyle, 'noose')
  assert.equal(normalizedRaidOpts(make(), {}).whipStyle, undefined, '말투를 안 준 판은 기록도 없다')
  const again = createHaebi(7, 'stage', 'whip', rec); assert.equal(again.whipStyle, 'noose')
  const tipHurt = (style?: 'crack' | 'noose') => { const s = make(style), e = place(s, 190, 0), r = place(s, 20, 0); step(s, ['lash']); return hurt(e) / hurt(r) }
  assert.ok(Math.abs(tipHurt('crack') - K.whip.styles.crack.tip / K.whip.root) < .01, `crack ${tipHurt('crack')}`)
  assert.ok(Math.abs(tipHurt('noose') - K.whip.styles.noose.tip / K.whip.root) < .01)
  assert.ok(tipHurt('crack') > tipHurt() && tipHurt() > tipHurt('noose'))
  const cool = (style: 'crack' | 'noose') => { const s = make(style); s.ranks.lasso = 1; place(s, 200, 0); step(s, ['lasso']); return s.cool.lasso }
  assert.ok(cool('noose') < cool('crack') * .85, `noose ${cool('noose')} crack ${cool('crack')}`)
  const pulled = (style: 'crack' | 'noose') => { const s = make(style); s.ranks.lasso = 1; s.ranks.lash = 0; const e = place(s, 200, 0); for (let i = 0; i < 400 && !e.pull; i++) step(s, i ? [] : ['lasso']); return e.pull?.t ?? 0 }
  assert.ok(pulled('noose') < pulled('crack'), '올가미 말투가 더 빨리 끌어당긴다')
})

// ── W4 · 트리 · 조합 · 비기 휘몰이 ──
import { treeTotal, comboOf, kitCombos } from '../src/raid/haebi.ts'
import { HAEBI_ULT as U, HAEBI_TREE as T } from '../src/tune/params.ts'
const stepSkill = (s: HaebiRun, skill: boolean) => { for (const k of Object.keys(s.cool) as (keyof HaebiRun['cool'])[]) s.cool[k] = 99; stepHaebi(s, { ...IDLE, skill }, DT) }
/** 비기를 누르고 시전이 끝나 터진 직후까지 */
function release(s: HaebiRun) { stepSkill(s, true); for (let i = 0; i < 900 && s.cast; i++) stepSkill(s, false) }

test('트리: 16칸 · 점수대는 다른 묶음과 같다 · 조합 둘(당겨 치기·조임 고리)과 공용 뇌화 연옥', () => {
  assert.equal(kitPowers('whip').length, 16)
  for (const kit of ['axe', 'bow', 'spear', 'sword', 'dagger', 'magic', 'sling'] as const) assert.equal(treeTotal('whip'), treeTotal(kit), kit)
  assert.deepEqual(kitCombos('whip').map(c => c.id).sort(), ['drive', 'inferno', 'noose'])
  assert.equal(comboOf('drive').name, '당겨 치기')
})

test('이어치기(갈래 끝 a): 끝에 맞은 적이 쓰러지면 줄이 곁의 적에게 한 번 더 · 몸쪽에서 쓰러지면 안 이어진다', () => {
  const run = (capA: number, dx: number) => {
    const s = field(); s.ranks.capA = capA
    const dying = place(s, dx, 0, 'club', 1), next = place(s, dx + 40, 90, 'club'), far = place(s, dx + 400, 400)
    place(s, 20, 0, 'club')
    step(s, ['lash']); return { dying, next, far, s }
  }
  const base = (C.whipDamage + C.whipRankDamage) * powerScale(field()) * K.whip.base
  const a = run(1, 190)
  assert.ok(a.dying.hp <= 0, '끝에서 쓰러짐')
  assert.ok(Math.abs(hurt(a.next) - base * (T.cap.whip.a.share)) < 1e-6, `곁의 적 ${hurt(a.next)}`)
  assert.equal(hurt(a.far), 0, '너무 먼 적은 안 이어진다')
  assert.equal(hurt(run(0, 190).next), 0, '갈래 끝이 없으면 안 이어진다')
  assert.equal(hurt(run(1, 20).next), 0, '몸쪽에서 쓰러지면 안 이어진다')
  assert.ok(hurt(run(3, 190).next) > hurt(a.next), '단계가 오르면 더 세다')
})

test('휘감아 끌기(갈래 끝 b): 올가미에 걸린 적 둘레의 일반 적도 몫으로 맞고 함께 끌려온다 (정예는 제 자리)', () => {
  const run = (capB: number) => {
    const s = field(); s.ranks.lash = 0; s.ranks.lasso = 1; s.ranks.capB = capB
    const main = place(s, 230, 0, 'club', 5e6), side = place(s, 250, 60), elite = place(s, 240, -60, 'elite'), far = place(s, 230, 300)
    step(s, ['lasso'])
    for (let i = 0; i < 160; i++) step(s)
    return { s, main, side, elite, far }
  }
  const a = run(1), b = run(0)
  assert.ok(dist(a.s, a.side) < 100 && hurt(a.side) > 0, `곁의 적 ${dist(a.s, a.side).toFixed(0)}px`)
  assert.ok(dist(b.s, b.side) > 150 && hurt(b.side) === 0, '갈래 끝 없으면 그대로')
  assert.equal(a.elite.pull, undefined); assert.equal(hurt(a.far), 0)
})

test('당겨 치기(조합): 올가미에 끌려온 적은 다음 한 번의 말채찍이 끝 구간으로 · 한 번뿐', () => {
  const run = (combo: boolean) => {
    const s = field(); s.ranks.lasso = 1; s.ranks.lash = 1; if (combo) s.combos.push('drive')
    const e = place(s, 230, 0, 'club', 5e6)
    step(s, ['lasso'])
    for (let i = 0; i < 220 && !(e.pull); i++) step(s)
    for (let i = 0; i < 80; i++) step(s)   // 끌려와 장수 앞(70px)에 선 뒤
    const h0 = hurt(e); s.cool.lash = 0; step(s, ['lash']); const first = hurt(e) - h0
    for (let i = 0; i < 130; i++) step(s)
    const h1 = hurt(e); s.cool.lash = 0; step(s, ['lash']); return { first, second: hurt(e) - h1, driven: e.driven }
  }
  const on = run(true), off = run(false)
  assert.ok(on.first > off.first * 1.7, `끌려온 적 ${on.first} vs ${off.first}`)
  assert.equal(on.driven, undefined, '한 번 맞으면 표식이 걷힌다')
  assert.ok(Math.abs(on.second - off.second) < on.second * .5, '두 번째는 보통 몫')
})

test('조임 고리(조합): 올가미가 닿은 자리에 줄 고리가 남아 밟는 적이 느려지고 깎인다 · 3초 뒤 사라진다', () => {
  const s = field(); s.ranks.lash = 0; s.ranks.lasso = 1; s.combos.push('noose'); s.ranks.reach = 2
  place(s, 230, 0, 'club', 5e6)
  step(s, ['lasso'])
  for (let i = 0; i < 240 && !s.kits!.zones.length; i++) step(s)
  const z = s.kits!.zones.find(x => x.kind === 'snare')!; assert.ok(z, '고리가 남음')
  const bait = place(s, z.x - s.x + 20, z.y - s.y, 'club', 5e6)
  const before = hurt(bait)
  for (let i = 0; i < 90; i++) step(s)
  assert.ok(hurt(bait) > before, '밟으면 깎인다'); assert.ok((bait.lasso ?? 0) > 0, '느려진다')
  for (let i = 0; i < 120 * K.whip.snare.life; i++) step(s)
  assert.ok(!s.kits!.zones.some(x => x.kind === 'snare'), '3초 뒤 사라짐')
})

test('휘몰이: 열여섯만 한 점으로 모은 뒤 그 점을 크게 두 번 후려친다 · 몸 둘레 원이 아니다 · 정예는 제 자리 · 쿨 13초', () => {
  const s = field(400); s.level = Math.max(s.level, 3)
  const crowd: Mob[] = []
  for (let i = 0; i < 20; i++) crowd.push(place(s, 120 + (i % 5) * 40, -120 + Math.floor(i / 5) * 80, 'club', 5e6 - i * 1000))
  const elite = place(s, 300, 160, 'iron'), behind = place(s, -250, 0, 'club', 1e6)
  stepSkill(s, true)
  assert.ok(Math.abs(s.skillCd - U.whip.cooldown) < .1, `쿨 ${s.skillCd}`)
  for (let i = 0; i < 900 && s.cast; i++) stepSkill(s, false)
  const gathered = s.enemies.filter(e => e.pull?.x !== undefined)
  assert.equal(gathered.length, U.whip.pull, '모은 수는 열여섯')
  assert.ok(gathered.every(e => crowd.includes(e)), '센 일반 적만')
  assert.equal(elite.pull, undefined, '철갑은 제 자리')
  assert.ok(s.ult, '후려치기가 이어진다'); const sx = s.ult!.x, sy = s.ult!.y, ox = elite.x, oy = elite.y
  const dmg = (e: Mob) => hurt(e)
  while (s.ult) stepSkill(s, false)
  for (const e of gathered) assert.ok(Math.hypot(e.x - sx, e.y - sy) <= U.whip.spread * Math.sqrt(U.whip.pull) + 40, `모인 자리 ${Math.hypot(e.x - sx, e.y - sy).toFixed(0)}`)
  const total = gathered.reduce((n, e) => n + dmg(e), 0)
  assert.ok(total >= gathered.length * U.whip.damage * U.whip.hits * powerScale(s) * .9, `모두 두 번 맞음 ${total}`)
  assert.equal(hurt(behind), 0, '등 뒤(점에서 먼 곳)는 안 맞는다 — 몸 둘레 원이 아님')
  assert.ok(Math.hypot(elite.x - ox, elite.y - oy) < 40, '철갑은 끌려가지 않음')
  assert.ok(crowd.filter(e => !gathered.includes(e)).every(e => hurt(e) < U.whip.damage * powerScale(s) * 2 * U.whip.tip + 1), '남은 넷은 점 둘레만 맞음')
})

test('휘몰이: 같은 씨앗 두 번이면 같은 판 · 환영난무처럼 장수가 옮겨 가지 않는다', () => {
  const make = () => { const s = field(400); s.level = 3; for (let i = 0; i < 12; i++) place(s, 100 + i * 20, (i % 4) * 50 - 75, 'club'); return s }
  const a = make(), b = make(), x0 = a.x, y0 = a.y
  release(a); release(b)
  for (let i = 0; i < 120; i++) { stepSkill(a, false); stepSkill(b, false) }
  assert.equal(JSON.stringify(a), JSON.stringify(b))
  assert.equal(a.x, x0); assert.equal(a.y, y0)
})

// ── W5 · 그리기 ──
import { drawField, imagePaths, ropePoint } from '../src/raid/haebi-view.ts'
import { HAEBI_ROPE as RP } from '../src/tune/params.ts'
function recorder() {
  const log = { lineTo: 0, banned: [] as string[], arcs: 0, gradients: 0 }
  const state: Record<string, unknown> = { globalAlpha: 1, globalCompositeOperation: 'source-over', fillStyle: '#000', strokeStyle: '#000', lineWidth: 1 }
  const stack: Record<string, unknown>[] = []
  const api: Record<string, unknown> = { canvas: { width: C.width, height: C.height }, save() { stack.push({ ...state }) }, restore() { Object.assign(state, stack.pop() ?? {}) }, lineTo() { log.lineTo++ }, arc() { log.arcs++ }, createRadialGradient() { log.gradients++; return { addColorStop() {} } }, createLinearGradient() { log.gradients++; return { addColorStop() {} } } }
  const ctx = new Proxy(api, { get: (t, k) => k in t ? t[k as string] : k in state ? state[k as string] : () => {}, set: (_t, k, v) => { if (k === 'filter' || k === 'shadowBlur') log.banned.push(String(k)); state[k as string] = v; return true } }) as unknown as CanvasRenderingContext2D
  return { ctx, log }
}
const images = new Map(imagePaths.map(p => [p, { width: 5120, height: 256 } as unknown as HTMLImageElement]))

test('줄 그리기: 끝점이 피해 도형의 끝과 6px 안 · 점 수는 늘 같다 · 판은 읽기만 · filter·그라디언트 없음', () => {
  const s = field(); s.ranks.lash = 3
  place(s, 150, 0)
  step(s, ['lash'])
  const f = s.fx.find(x => x.kind === 'thrust' && x.lash === 1)!
  assert.ok(f, '말채찍 줄 이펙트가 생김')
  const length = f.r, hand = { x: f.x, y: f.y - C.heroShotHeight }
  const tip = ropePoint(hand.x, hand.y, hand.x + Math.cos(f.angle) * length, hand.y + Math.sin(f.angle) * length, 1, 0, RP.points - 1)
  assert.ok(Math.abs(tip.x - (s.x + Math.cos(f.angle) * length)) <= 6 && Math.abs((tip.y + C.heroShotHeight) - (s.y + Math.sin(f.angle) * length)) <= 6, `줄 끝 ${tip.x},${tip.y}`)
  // 피해 도형의 끝: 줄 끝 바로 안쪽 적은 맞고 바로 밖은 안 맞는다
  const inside = field(), onTip = place(inside, length - 3, 0), beyond = place(inside, length + 8, 0, 'club'); inside.ranks.lash = 3; place(inside, 20, 0)
  step(inside, ['lash']); assert.ok(hurt(onTip) > 0 && hurt(beyond) === 0)
  // 점 수 고정: 뻗는 중과 다 뻗은 뒤의 줄이 같은 점 수 · 판은 안 바뀐다 · 금지 호출 없음
  const counts: number[] = []
  const withFx = s.fx; s.fx = withFx.filter(x => !x.lash); const base = recorder(); drawField(base.ctx, images, s, null); s.fx = withFx   // 같은 판에서 줄 이펙트만 뺀 그림과 견준다
  for (const age of [.05, .2, .6]) {
    f.life = f.total * (1 - age)
    const before = JSON.stringify(s), { ctx, log } = recorder(); drawField(ctx, images, s, null)
    assert.equal(JSON.stringify(s), before, '그리기가 판을 안 바꾼다')
    counts.push(log.lineTo); assert.deepEqual(log.banned, []); assert.equal(log.gradients, base.log.gradients, '줄 때문에 늘어난 그라디언트 없음')
  }
  assert.ok(counts[0]! > base.log.lineTo, '줄을 그렸다'); assert.equal(counts[0], counts[1], '뻗는 중에도 점 수가 같다'); assert.equal(counts[1], counts[2])
})

test('올가미·조임 고리·휘몰이 그리기도 판을 안 바꾸고 금지 호출이 없다 (그림이 없어도 판이 안 멈춘다)', () => {
  const s = field(400); s.level = 3; s.ranks.lasso = 1; s.combos.push('noose')
  for (let i = 0; i < 8; i++) place(s, 120 + i * 25, (i % 4) * 50 - 75)
  const rec = recorder()
  let sawLasso = false, sawSnare = false, sawUlt = false
  stepSkill(s, true)
  for (let i = 0; i < 900 && (i < 20 || s.cast || s.ult || s.shots.length || s.kits!.zones.length) && i < 900; i++) {
    stepSkill(s, false)
    if (i % 10 === 0) {
      s.cool.lasso = i < 60 ? 0 : 99
      const snapshot = JSON.stringify(s); drawField(rec.ctx, images, s, null); assert.equal(JSON.stringify(s), snapshot)
      sawLasso ||= s.shots.some(b => b.kind === 'lasso'); sawSnare ||= s.kits!.zones.some(z => z.kind === 'snare'); sawUlt ||= s.fx.some(f => f.ult === 'whip')
    }
  }
  assert.deepEqual(rec.log.banned, [])
  assert.ok(sawUlt, '휘몰이 이펙트가 그려졌다')
  void sawLasso; void sawSnare
})

// ── W7 · 봇이 줄 끝 구간을 지킨다 ──
import { botInput } from '../src/raid/haebi-replay.ts'
test('봇: 채찍은 가장 가까운 적이 줄 길이의 0.7배 안이면 물러난다(끝 구간에 두려고) · 멀면 예전 원 걷기', () => {
  const near = field(); const e = place(near, 60, 0)
  const away = botInput(near)
  assert.ok(away.x * (e.x - near.x) + away.y * (e.y - near.y) < 0, `물러남 ${away.x},${away.y}`)
  const far = field(); place(far, 190, 0)
  const walk = botInput(far)
  const orbit = botInput(Object.assign(createHaebi(7, 'stage', 'dagger', { simRules: '56B', kitRules: '58-KITS' }), { x: far.x, y: far.y }))
  assert.ok(Number.isFinite(walk.x) && Number.isFinite(orbit.x))
})
