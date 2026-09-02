/**
 * 재정비 — 죽음 뒤에 곧바로 강화 (2026-09-02, 형의 여자친구가 11판에서 접었다).
 *
 * 여기서 지키는 것은 넷이다.
 *  1. **추천은 근력부터.** 화살 피해가 속도의 제곱이라 진짜 만작 전까지는 근력만이
 *     적을 눕히는 발수를 줄인다. 만작이 열리면 가장 낮은 곳으로 넘어간다.
 *  2. **11판 사수는 오르막이다.** 체력이 11판에서 낮게 시작해 21판에 기본값에 닿고, 31판+ ×1.5.
 *  3. **사수 판의 힌트는 사수의 말이다.** "공중 과녁은 맞으면 떨어진다"가 드론 앞에 뜨지 않는다.
 *  4. **세이브 v12 — 첫 성장 안내 플래그.** 옛 세이브는 false로 올라온다.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

const store = new Map<string, string>()
;(globalThis as Record<string, unknown>)['localStorage'] = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size },
}

const { defaultSave, loadSave, SCHEMA_VERSION } = await import('../src/game/save.ts')
const { recommendStat, recommendReason } = await import('../src/game/progression.ts')
const { BOSS_EVERY, CAMPAIGN, STAGES, foeHp, getStage } = await import('../src/game/stages.ts')
const { P } = await import('../src/tune/params.ts')

const KEY = 'hanbal.save.v1'

describe('재정비 — 추천 스탯', () => {
  it('처음(전부 0)에는 근력이다 — 피해가 속도의 제곱이라 발수를 줄이는 유일한 스탯', () => {
    assert.equal(recommendStat({ str: 0, steady: 0, stamina: 0, focus: 0 }), 'str')
    assert.equal(recommendStat({ str: 8, steady: 5, stamina: 5, focus: 5 }), 'str')
    assert.match(recommendReason('str'), /제곱/)
  })

  it('진짜 만작이 열리면 가장 낮은 곳으로 넘어간다', () => {
    // maxDrawBase 0.72 + 0.02 × 14 = 1.0 — GDD 2장의 "STR 14쯤에 진짜 만작".
    assert.equal(recommendStat({ str: 14, steady: 3, stamina: 1, focus: 2 }), 'stamina')
    assert.equal(recommendStat({ str: 20, steady: 0, stamina: 0, focus: 0 }), 'steady')
  })
})

describe('11판 사수 — 도입 경사', () => {
  it('11판은 낮게 시작해 경사 끝에 기본값에 닿고, 31판부터 ×1.5', () => {
    const first = BOSS_EVERY + 1
    const base = P.enemy.convertHp
    assert.ok(foeHp(first) < base, `11판 ${foeHp(first)} < ${base}`)
    assert.ok(Math.abs(foeHp(first) - base * P.enemy.convertHpEase) < 1e-9)
    const top = first + Math.floor(P.enemy.convertHpEaseStages)
    assert.ok(Math.abs(foeHp(top) - base) < 1e-9, `${top}판 = ${base}`)
    assert.ok(Math.abs(foeHp(31) - base * 1.5) < 1e-9)
    // 오르막이다 — 내려가는 판이 없다.
    for (let n = first; n < top; n++) assert.ok(foeHp(n) <= foeHp(n + 1), `${n}판 → ${n + 1}판`)
  })

  it('11판의 사수 체력이 실제로 경사값이고, 화살은 사수 하나에 한 발씩 얹힌다', () => {
    const idx = BOSS_EVERY // 0-based → 11판
    const s = getStage(idx)
    const base = STAGES[idx]
    assert.ok(base !== undefined)
    const archers = s.targets.filter((t) => t.kind === 'archer')
    assert.ok(archers.length >= 1)
    for (const a of archers) assert.equal(a.hp, Math.floor(foeHp(idx + 1)))
    assert.equal(s.arrows, Math.min(10, base.arrows + archers.length))
  })
})

describe('사수 판의 힌트', () => {
  it('11판은 규칙을 가르친다 — 적이 활을 든다', () => {
    assert.match(getStage(BOSS_EVERY).hint ?? '', /적이 활을 든다/)
  })

  it('전환된 판 어디에도 과녁의 말이 남지 않는다', () => {
    for (let i = BOSS_EVERY; i < CAMPAIGN; i++) {
      if ((i + 1) % BOSS_EVERY === 0) continue // 보스판은 자기 힌트가 있다
      const h = getStage(i).hint ?? ''
      assert.ok(h.length > 0, `${i + 1}판 힌트가 비었다`)
      assert.ok(!h.includes('과녁'), `${i + 1}판 힌트에 '과녁': ${h}`)
    }
  })
})

describe('세이브 v12 — 첫 성장 안내', () => {
  it('새 세이브는 안내를 아직 안 봤다', () => {
    assert.ok(SCHEMA_VERSION >= 12)
    assert.equal(defaultSave(0).seenGrowHint, false)
  })

  it('옛 세이브(v11)는 false로 올라오고, 본 사람은 본 채로 남는다', () => {
    store.set(KEY, JSON.stringify({ v: 11, training: 40 }))
    const a = loadSave()
    assert.equal(a.v, SCHEMA_VERSION)
    assert.equal(a.seenGrowHint, false)
    assert.equal(a.training, 40)
    store.set(KEY, JSON.stringify({ v: SCHEMA_VERSION, seenGrowHint: true }))
    assert.equal(loadSave().seenGrowHint, true)
  })
})
