// 72-BOSSHIT 보스의 예고된 큰 공격은 맞으면 아프다 (형 11-24 「보스 공격은 구태여 피할 필요도 없게 느껴짐」) — 새 규칙 판만 · 끈 판은 예전과 같다
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HAEBI_BOSS_HIT as BH } from '../src/tune/params.ts'
import { createHaebi, stepHaebi, bossTime, KIT_RULES, BOSSHIT_RULES, BOSSDUEL_RULES, type HaebiOpts } from '../src/raid/haebi.ts'

const opts = (on: boolean): HaebiOpts => ({ stage: 'forest', simRules: '55-GUMIHO', kitRules: KIT_RULES, bossDuelRules: BOSSDUEL_RULES, ...(on ? { bossHitRules: BOSSHIT_RULES } : {}) })
/** 보스가 나온 직후 가만히 서서 맞는다 (장수 자리는 그대로) (잡졸·정예·일제 사격은 멈춰 둔다) — 한 번 맞은 몫(hp 가 깎인 걸음)을 모은다 */
function standStill(on: boolean, seconds: number) {
  const s = createHaebi(5, 'stage', 'axe', opts(on))
  s.nextElite = 1e9; s.nextBarrage = 1e9; s.spawn = 1e9; s.t = bossTime(s) - .001
  const idle = { x: 0, y: 0, dash: false, skill: false, wake: false }
  s.hp = s.maxHp = 1000; const hits: number[] = []
  let prev = s.hp
  for (let i = 0; i < seconds * 60 && s.state === 'playing'; i++) {
    stepHaebi(s, idle, 1 / 60)
    if (s.hp < prev) hits.push(prev - s.hp); prev = s.hp
  }
  return { s, hits }
}
test('72 off: 규칙이 없으면 보스 판이 옛 셈 그대로다 (bossHit 없음)', () => { assert.equal(createHaebi(5, 'stage', 'axe', opts(false)).bossHit, undefined) })
test('72 on: 규칙이 켜진 스테이지 판에만 bossHit', () => {
  assert.equal(createHaebi(5, 'stage', 'axe', opts(true)).bossHit, true)
  assert.equal(createHaebi(5, 'trial', 'axe', { simRules: '53B', bossHitRules: BOSSHIT_RULES }).bossHit, undefined)
})
test('72 on: 보스의 큰 공격 한 방은 최대 체력 몫을 넘고 · 끈 판의 같은 공격보다 아프다', () => {
  const on = standStill(true, 40), off = standStill(false, 40)
  assert.ok(on.hits.length > 0 && off.hits.length > 0, '둘 다 맞았다')
  const big = Math.max(...on.hits) / on.s.maxHp, oldBig = Math.max(...off.hits) / off.s.maxHp
  assert.ok(big >= BH.share * 20 / BH.ref * .99, `큰 공격 몫 ${big}`)
  assert.ok(big > oldBig * 5, `옛 몫 ${oldBig} → ${big}`)
})
