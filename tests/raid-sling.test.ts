// 열전 돌팔매 묶음 (11-16 형: 「돌팔매는 슬링샷 사운드 같은 거 찾으면 만들 수 있지 않을까?」 · 초팔 팔매)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HAEBI_RUN as C, HAEBI_ULT as U } from '../src/tune/params.ts'
import { createHaebi, choose, stepHaebi, spawnMob, powerScale, areaScale, KITS, kitPowers, type HaebiRun, type Mob } from '../src/raid/haebi.ts'
import { replay } from '../src/raid/haebi-replay.ts'
import { KIT_BY_SPRITE } from '../src/raid/kit-table.ts'
import { kitOfSprite } from '../src/raid/hero-kit.ts'

const DT = 1 / 120
/** 적이 저절로 나오지 않는 판 */
function field(x = C.width / 2, y = C.height / 2) {
  const s = createHaebi(7, 'stage', 'sling'); s.spawn = 1e9; s.nextElite = 1e9; s.nextBarrage = 1e9; s.x = x; s.y = y
  return s
}
function place(s: HaebiRun, dx: number, dy: number, kind: Mob['kind'] = 'iron', hp = 1e6) {
  spawnMob(s, 'club'); const e = s.enemies[s.enemies.length - 1]!
  Object.assign(e, { kind, x: s.x + dx, y: s.y + dy, hp, max: hp, cd: 99 })
  return e
}
const hurt = (e: Mob) => e.max - e.hp
/** 그 쿨만 남기고 나머지 공격은 쉬게 */
function only(s: HaebiRun, keep: (keyof HaebiRun['cool'])[]) { for (const k of Object.keys(s.cool) as (keyof HaebiRun['cool'])[]) if (!keep.includes(k)) s.cool[k] = 99 }

test('돌팔매 묶음: 돌팔매로 시작 · 첫 고름은 갈래마다 하나(물수제비·돌팔매·기세) · 같은 씨앗이면 같은 판', () => {
  const s = createHaebi(7, 'trial', 'sling')
  assert.equal(s.ranks.sling, 1); assert.equal(s.ranks.axe, 0)
  s.xp = 999; stepHaebi(s, { x: 0, y: 0 }, .01)
  assert.deepEqual(s.offers, ['skip', 'sling', 'tempo'])
  assert.ok(!kitPowers('sling').includes('bow') && !kitPowers('sling').includes('gale'))
  assert.equal(KITS.sling.weapon, '돌팔매')
  assert.deepEqual(replay(5, 90, 'storm', undefined, 'sling'), replay(5, 90, 'storm', undefined, 'sling'))
})

test('돌팔매: 돌이 포물선으로 날아가 떨어진 둘레를 치고 밀어낸다 · 위에서 떨어지니 방패로 못 막는다 · 둘레 밖은 안 맞는다', () => {
  const s = field(300), target = place(s, 200, 0, 'shield'), out = place(s, 200, 120, 'club')
  only(s, ['sling']); stepHaebi(s, { x: 0, y: 0 }, DT)
  const stone = s.shots.find(b => b.kind === 'pebble')!
  assert.ok(stone, '돌을 던짐'); assert.equal(hurt(target), 0, '날아가는 동안은 안 맞음')
  let before = target.x
  for (let i = 0; i < 120 * C.slingFlight + 2 && !hurt(target); i++) { before = target.x; only(s, []); stepHaebi(s, { x: 0, y: 0 }, DT) }
  assert.ok(Math.abs(hurt(target) - (C.slingDamage + C.slingRankDamage) * powerScale(s)) < 1e-6, `방패잡이도 온전히 (${hurt(target)})`)
  assert.ok(target.x - before > C.slingKnock, `밀려남 ${target.x - before}`)
  assert.equal(hurt(out), 0)
  assert.ok(!s.shots.some(b => b.kind === 'pebble'))
})

test('돌팔매 단계: 3단계마다 돌이 하나 더 (서로 다른 적에게)', () => {
  const s = field(300); s.ranks.sling = 6
  const a = place(s, 150, 0), b = place(s, 160, 150), c = place(s, 160, -150)
  only(s, ['sling']); stepHaebi(s, { x: 0, y: 0 }, DT)
  assert.equal(s.shots.filter(x => x.kind === 'pebble').length, 3)
  for (let i = 0; i < 60; i++) { only(s, []); stepHaebi(s, { x: 0, y: 0 }, DT) }
  for (const e of [a, b, c]) assert.ok(hurt(e) > 0)
})

test('물수제비: 맞힌 적에게서 곁의 적으로 튄다 (튀는 수만큼만)', () => {
  const s = field(200); s.ranks.skip = 3
  const row = Array.from({ length: 7 }, (_, i) => place(s, 120 + i * 110, (i % 2) * 30))
  only(s, ['skip']); stepHaebi(s, { x: 0, y: 0 }, DT)
  for (let i = 0; i < 400; i++) { only(s, []); stepHaebi(s, { x: 0, y: 0 }, DT) }
  const bounces = C.skipBounces + Math.ceil(3 / 2)
  assert.equal(row.filter(e => hurt(e) > 0).length, bounces)
  assert.ok(row.slice(0, bounces).every(e => hurt(e) > 0), '가까운 차례로')
})

test('어지럼 돌: 물수제비에 맞은 잡졸은 멈춰 서고, 두목은 버틴다', () => {
  const s = field(200); s.ranks.skip = 3; s.combos.push('daze')
  const club = place(s, 140, 0, 'club'), boss = place(s, 250, 0, 'boss')
  only(s, ['skip']); stepHaebi(s, { x: 0, y: 0 }, DT)
  for (let i = 0; i < 60 && !club.daze; i++) { only(s, []); stepHaebi(s, { x: 0, y: 0 }, DT) }
  assert.ok(club.daze > 0, '멈춤'); const x = club.x
  only(s, []); stepHaebi(s, { x: 0, y: 0 }, DT)
  assert.equal(club.x, x, '멈춘 동안 안 걷는다')
  for (let i = 0; i < 60; i++) { only(s, []); stepHaebi(s, { x: 0, y: 0 }, DT) }
  assert.equal(boss.daze, 0)
})

test('굴러가는 바위: 한 줄의 적을 모두 꿰뚫고 앞으로 밀어낸다', () => {
  const s = field(150); s.combos.push('boulder')
  const row = [120, 260, 400].map(d => place(s, d, 0, 'club')), side = place(s, 200, 200, 'club')
  only(s, ['boulder']); stepHaebi(s, { x: 0, y: 0 }, DT)
  assert.ok(s.shots.some(b => b.kind === 'boulder'))
  for (let i = 0; i < 120 * C.boulderLife; i++) { only(s, []); stepHaebi(s, { x: 0, y: 0 }, DT) }
  for (const e of row) assert.ok(hurt(e) >= C.boulderDamage * powerScale(s) - 1e-6)
  assert.equal(hurt(side), 0)
})

test('돌벼락: 무리가 가장 많은 자리에 물결 지어 돌이 쏟아진다 — 가운데는 여러 번, 둘레 밖은 안 맞는다', () => {
  const s = field(200); s.level = U.unlockLevel   // 비기는 첫 레벨업에서 열린다 (11-19)
  const area = areaScale(s), one = U.sling.damage * powerScale(s)
  const lone = place(s, -120, 0), pack = [[300, 0], [330, 30], [300, -40], [270, 20], [340, -10]].map(([x, y]) => place(s, x!, y!))
  const far = place(s, 300, (U.sling.radius + U.sling.splash) * area + 40)
  for (const k of Object.keys(s.cool) as (keyof HaebiRun['cool'])[]) s.cool[k] = 99
  const stones: object[] = []
  stepHaebi(s, { x: 0, y: 0, skill: true }, DT)
  for (let i = 0; i < 600 && s.cast; i++) { only(s, []); stepHaebi(s, { x: 0, y: 0 }, DT) }
  assert.ok(s.ult, '물결이 이어진다')
  for (let i = 0; i < 120 && s.ult; i++) { for (const f of s.fx) if (f.kind === 'ult' && !stones.includes(f)) stones.push(f); only(s, []); stepHaebi(s, { x: 0, y: 0 }, DT) }
  for (const f of s.fx) if (f.kind === 'ult' && !stones.includes(f)) stones.push(f)
  assert.equal(s.ult, null)
  assert.equal(stones.length, U.sling.waves * U.sling.stones, '돌 수')
  assert.equal(hurt(lone), 0, '혼자 선 가까운 적이 아니라 무리 쪽')
  assert.equal(hurt(far), 0, '둘레 밖')
  assert.ok(pack.every(e => hurt(e) >= one - 1e-6))
  assert.ok(Math.max(...pack.map(hurt)) >= one * 2 - 1e-6, '가운데는 여러 번')
  assert.ok(Math.abs(s.skillCd - (U.sling.cooldown - U.cast - U.sling.gap * (U.sling.waves - 1))) < .05)
})

test('돌팔매 묶음 봇: 상점을 조금 산 봇이 숲 산길 20분 두목을 잡고 제 조합을 완성한다', () => {
  const s = replay(7, C.duration, 'storm', r => assert.ok(r.shots.length <= C.maxShots), 'sling', { bonus: { vigor: 3, might: 2, armor: 1 } })
  assert.equal(s.state, 'won')
  assert.ok(s.combos.includes('boulder') || s.combos.includes('daze'), String(s.combos))
})

test('돌팔매 묶음도 가만히 서서 고르기만 하면 못 깬다', () => {
  const s = createHaebi(7, 'trial', 'sling')
  while (s.state === 'playing') { if (s.offers.length) choose(s, s.offers[0]!); else stepHaebi(s, { x: 0, y: 0 }, DT) }
  assert.equal(s.state, 'lost'); assert.ok(s.t < C.bossAt / 2, `${Math.round(s.t)}초`)
})

test('초팔 팔매는 원화대로 돌팔매 묶음', () => {
  assert.equal(KIT_BY_SPRITE['base-g-38-chopal-palmae'], 'sling')
  assert.equal(kitOfSprite('base-g-38-chopal-palmae'), 'sling')
})
