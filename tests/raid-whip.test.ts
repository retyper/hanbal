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
