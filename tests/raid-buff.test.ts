// 74-BUFF 우물 = 지속 회복 버프(물기운) · 상태 효과 틀 — 새 규칙 판만 · 옛 판은 한 번에 채운다
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HAEBI_BUILD2 as B2 } from '../src/tune/params.ts'
import { createHaebi, stepHaebi, choose, KIT_RULES, BUILD_RULES, BUILD2_RULES, BUFF_RULES, type HaebiRun } from '../src/raid/haebi.ts'
import { wellShare, wellCool, type BuildKind } from '../src/raid/build.ts'
import { addStatus, mobStatuses, tickStatuses } from '../src/raid/status.ts'
import { heroStatusRow } from '../src/raid/fx-status.ts'

function quiet(buff: boolean) {
  const s = createHaebi(5, 'stage', 'axe', { stage: 'forest', simRules: '56B', kitRules: KIT_RULES, buildRules: BUILD_RULES, build2Rules: BUILD2_RULES, ...(buff ? { buffRules: BUFF_RULES } : {}) })
  s.spawn = 1e9; s.nextElite = 1e9; s.nextBarrage = 1e9
  s.offers = ['well' as BuildKind]; s.xp = 0; choose(s, 'well'); return s
}
const step = (s: HaebiRun, sec: number) => { for (let i = 0; i < sec * 120; i++) stepHaebi(s, { x: 0, y: 0 }, 1 / 120) }
const well = (s: HaebiRun) => s.build!.items.find(it => it.kind === 'well')!

test('74 물기운: 닿으면 버프가 붙고 · 시간에 걸쳐 고르게 · 총량은 예전 한 번 몫', () => {
  const s = quiet(true); s.hp = s.maxHp * .2; const h0 = s.hp
  step(s, .05)
  assert.equal(s.buffs!.length, 1); assert.equal(s.buffs![0]!.kind, 'water')
  assert.ok(s.hp - h0 < s.maxHp * .02, '한 번에 채우지 않는다')
  // 기본 회복(초당 조금)은 따로 뺀다 — 끝난 뒤 1초 동안 늘어난 만큼을 비율로 쓴다
  step(s, B2.well.time / 2); const mid = s.hp - h0
  step(s, B2.well.time / 2 + .2); assert.equal(s.buffs!.length, 0)
  const r0 = s.hp; step(s, 1); const regen = s.hp - r0
  const body = (x: number, secs: number) => x - regen * secs
  assert.ok(Math.abs(body(mid, B2.well.time / 2) - s.maxHp * wellShare(1) * B2.well.buffMul / 2) < s.maxHp * .03, `절반쯤 ${mid}`)
  assert.ok(Math.abs(body(r0 - h0, B2.well.time + .25) - s.maxHp * wellShare(1) * B2.well.buffMul) < 2, `총량 ${r0 - h0}`)
  assert.ok(s.waterPulse && s.waterPulse.n > 0)
})
test('74 물기운: 겹치지 않고 · 쿨타임 동안 안 붙고 · 가득이면 안 붙는다', () => {
  const s = quiet(true); step(s, 1); assert.equal(s.buffs!.length, 0); assert.equal(well(s).cd, 0)
  s.hp = s.maxHp * .1; step(s, .05); assert.equal(s.buffs!.length, 1)
  const cd = well(s).cd; assert.ok(cd > wellCool(1) - .2)
  step(s, 1); assert.equal(s.buffs!.length, 1, '겹치지 않는다')
  step(s, B2.well.time + 1); s.hp = s.maxHp * .1; step(s, 1); assert.equal(s.buffs!.length, 0, '쿨타임 동안 안 붙는다')
  s.hp = s.maxHp; step(s, wellCool(1)); s.hp = s.maxHp * .1; step(s, .05); assert.equal(s.buffs!.length, 1, '쿨타임 뒤 다시')
})
test('74 옛 규칙 판은 예전 그대로 한 번에 채운다', () => {
  const s = quiet(false); assert.equal(s.buffs, undefined); s.hp = s.maxHp * .2; step(s, .05)
  assert.ok(Math.abs(s.hp - s.maxHp * (.2 + wellShare(1))) < 1)
})
test('74 결정론: 같은 시드 같은 결과', () => {
  const run = () => { const s = quiet(true); s.hp = s.maxHp * .3; step(s, 8); return [s.hp, s.t, s.waterPulse?.n] }
  assert.deepEqual(run(), run())
})
test('74 틀: 겹침은 시간만 새로 · 적 독·느려짐·어지러움을 목록으로 읽는다 · 줄 DOM', () => {
  const l: any[] = []; assert.equal(addStatus(l, 'water', 5, 10), true); assert.equal(addStatus(l, 'water', 7, 10), false); assert.equal(l.length, 1); assert.equal(l[0].t, 7)
  let got = 0; tickStatuses(l, 3.5, a => (got += a), () => {}); assert.ok(Math.abs(got - 10 * 3.5 / 7) < 1e-9)
  const m = mobStatuses({ hp: 5, poison: 2, pdps: 3, daze: 0, slow: .3, stack: 2 })
  assert.deepEqual(m.map(x => x.kind), ['poison', 'slow']); assert.equal(m[0]!.stacks, 2)
  assert.equal(heroStatusRow([]).html, ''); assert.match(heroStatusRow(l).html, /buff-ic/)
})
