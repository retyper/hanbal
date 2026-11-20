import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HAEBI_RUN as C } from '../src/tune/params.ts'
import { createHaebi, bossTime, spawnMob, stepHaebi, choose, barrageArcher, respite, type StageId } from '../src/raid/haebi.ts'
import { createHash } from 'node:crypto'
import { chargeLane, chargeRecoil } from '../src/raid/haebi-view.ts'
import { fieldView, newCam, followCam } from '../src/raid/camera.ts'
import { startRecord, recInput, recPick, finishRecord, replayRaid, STEP } from '../src/raid/runlog.ts'
import { botInput, botChoice } from '../src/raid/haebi-replay.ts'

const stages: Exclude<StageId, 'trial'>[] = ['forest', 'ford', 'palisade', 'snow', 'fortress']
const ranged = new Set(['archer', 'slinger', 'firearcher', 'hunter', 'torch', 'shaman'])
function quiet(stage: Exclude<StageId, 'trial'> = 'forest') {
  const s = createHaebi(50, 'stage', 'axe', { stage })
  s.spawn = s.nextElite = s.nextBarrage = 1e9; s.level = C.maxLevel
  for (const k of Object.keys(s.cool) as (keyof typeof s.cool)[]) s.cool[k] = 1e9
  return s
}

// 빨강 조건: 어느 스테이지든 첫 절반에 자연 스폰 원거리 적이 섞이면 실패.
test('50-1 모든 스테이지 전반 자연 스폰은 근접만', () => {
  const found: string[] = []
  for (const stage of stages) for (const fraction of [0, .22, .44, .499]) {
    const s = quiet(stage); s.t = bossTime(s) * fraction
    for (let i = 0; i < 100; i++) spawnMob(s)
    for (const e of s.enemies) if (ranged.has(e.kind)) found.push(`${stage}@${fraction}:${e.kind}`)
  }
  assert.deepEqual([...new Set(found)], [])
})

test('50-1 trial/vanguard 전체 상태는 변경 전 65초 결정론 기준과 같다', () => {
  // af0faba의 haebi.ts를 별도 파일로 꺼내 같은 실제 입력으로 구운 기준. stage만 변경 허용.
  const hashes = { trial: 'ade44bf9b47e24d19ed499dd73219e6111fceebf34a29ea189910ddbaa50abf5', vanguard: '6df23f81199feb052d83c37e41b8d15a2c504ae7397a71a1ba8b57816efdca98' }
  for (const mode of ['trial', 'vanguard'] as const) {
    const s = createHaebi(501, mode, 'sword')
    for (let i = 0; i < 65 * 60; i++) {
      if (s.offers.length) choose(s, s.offers[0]!)
      stepHaebi(s, { x: Math.sin(i / 120), y: Math.cos(i / 120) }, 1 / 60)
    }
    assert.equal(respite(s), false)
    assert.equal(createHash('sha256').update(JSON.stringify(s)).digest('hex'), hashes[mode], mode)
  }
})

test('50-1 실제 확대 시야 밖 궁수는 발사자가 아니며 숨기면 예약 화살비도 취소', () => {
  const s = quiet(); s.t = 650; s.nextBarrage = s.t
  spawnMob(s, 'archer'); const e = s.enemies[0]!
  Object.assign(e, { x: C.width - 15, y: s.y, hp: 1e6, max: 1e6, cd: 100 })
  const cam = newCam(2); followCam(cam, s.x, s.y, 0, true)
  assert.equal(barrageArcher(s, fieldView(cam)), undefined)
  stepHaebi(s, { x: 0, y: 0, barrageSource: 0 }, 1 / 60)
  assert.equal(s.shots.filter(b => b.kind === 'barrage').length, 0)
  e.x = s.x + 60
  assert.equal(barrageArcher(s, fieldView(cam))?.id, e.id)
  stepHaebi(s, { x: 0, y: 0, barrageSource: e.id }, 1 / 60)
  assert.ok(s.shots.some(b => b.kind === 'barrage' && b.source === e.id))
  const hp = s.hp
  stepHaebi(s, { x: 0, y: 0, barrageSource: 0 }, 1 / 60)
  assert.equal(s.shots.filter(b => b.kind === 'barrage').length, 0)
  assert.equal(s.hp, hp)
})

test('50-1 창돌격꾼은 길 없이 마지막 순간 몸만 경고하고 view는 판을 바꾸지 않음', () => {
  const s = quiet(); spawnMob(s, 'runner'); const e = s.enemies[0]!
  e.act = .025
  const before = JSON.stringify(s)
  assert.equal(chargeLane(e), false); assert.ok(chargeRecoil(e) > .5)
  e.kind = 'tiger'; assert.equal(chargeLane(e), true); assert.equal(chargeRecoil(e), 0)
  e.kind = 'hunter'; assert.equal(chargeLane(e), true)
  e.kind = 'runner'; assert.equal(JSON.stringify(s), before)
})

test('50-1 실제 자연 스폰 후반 궁수·확대 시야 입력을 적으면 전체 판이 동일 재생됨', () => {
  const s = createHaebi(501, 'stage', 'sword', { bonus: { vigor: 10, might: 10, armor: 5 } })
  const r = startRecord(s, { id: '50-pacing', started: 'test', mode: s.mode, stage: s.stage, hero: 'haebi', kit: s.kit, sprite: 'haebi', seed: 501, opts: { bonus: s.bonus }, from: null })
  const cam = newCam(2); let seen = 0
  while (s.t < 720 && s.state === 'playing') {
    if (s.offers.length) { const p = botChoice(s, 'storm'); choose(s, p); recPick(r, p); continue }
    followCam(cam, s.x, s.y, STEP)
    const source = barrageArcher(s, fieldView(cam))?.id ?? 0
    if (source) seen++
    stepHaebi(s, recInput(r, { ...botInput(s, .5), barrageSource: source }), STEP)
  }
  assert.ok(seen > 0, `실제 후반 궁수 입력 걸음 ${seen}`)
  const g = finishRecord(r, 0, 'test')
  assert.deepEqual(replayRaid(g), s)
  // 옛 네 필드 입력도 파싱 가능. 옛 엔진 결과의 완전 동일 재생을 뜻하지 않는다.
  const old = { ...g, input: '0,0,0,0 1' }
  assert.equal(replayRaid(old).t, STEP)
})

// 빨강 조건: 화면 안에 발사자가 없어도 전역 타이머가 화살비를 만들면 실패.
test('50-1 화살비 발사자 없이는 고리도 피해도 생기지 않음', () => {
  const s = quiet(); s.t = 650; s.nextBarrage = s.t
  stepHaebi(s, { x: 0, y: 0 }, 1 / 60)
  assert.equal(s.shots.filter(b => b.kind === 'barrage').length, 0)
})

// 빨강 조건: 발사자를 처치했는데 예약된 고리나 화살비가 남으면 실패.
test('50-1 눈앞 궁수가 발사하고 처치 즉시 진행 중 화살비도 멈춤', () => {
  const s = quiet(); s.t = 650; s.nextBarrage = s.t
  spawnMob(s, 'archer'); const e = s.enemies[0]!
  Object.assign(e, { x: s.x + 200, y: s.y, hp: 1e6, max: 1e6, cd: 100 })
  stepHaebi(s, { x: 0, y: 0 }, 1 / 60)
  assert.ok(s.shots.some(b => b.kind === 'barrage'), '살아 있는 눈앞 궁수의 실제 발사')
  e.hp = 0
  stepHaebi(s, { x: 0, y: 0 }, 1 / 60)
  assert.equal(s.shots.filter(b => b.kind === 'barrage').length, 0)
})

// 빨강 조건: 40초 뒤의 실제 자연 스폰 수가 초반과 비슷하면 실패.
test('50-1 40초 몰아침 뒤 18초는 잔병만 나와 기세를 주울 틈이 있음', () => {
  const counts: number[] = []
  for (const start of [5, 45]) {
    const s = quiet(); s.t = start; s.spawn = 0
    for (let i = 0; i < 8 * 60; i++) {
      stepHaebi(s, { x: 0, y: 0 }, 1 / 60)
      s.enemies.length = 0
    }
    counts.push(s.next - 1)
  }
  assert.ok(counts[1]! < counts[0]! * .4, `몰아침 ${counts[0]} / 숨 고름 ${counts[1]}`)
})
