/**
 * 나라의 판정 — 불변식 (docs/realm/BUILD.md §3-1)
 *
 * 형 (2026-10-17): "바로 뭔가 만들지 말고 완벽을 기한 설계부터 잡아." 그 설계의 숫자 약속을 여기서 잰다.
 *  - 이름 붙은 주사위: 같은 (시드, 계절, 이름) → 같은 값 · 이름이 다르면 독립 · 판정을 하나 더해도 다른 판정이 안 밀린다
 *  - 결과 다섯 칸의 합 = 1, 음수 칸 없음 (P 가 0 이든 1 이든)
 *  - 생포 + 전사 ≤ 1
 *  - 기습은 언제나 [5%, 85%]
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { roll } from '../../src/core/rng.ts'
import {
  ambushChance, bins, fate, headcount, OPEN_FIELD, pick, power, winChance,
  type Force, type Outcome,
} from '../../src/realm/battle.ts'
import { P } from '../../src/tune/params.ts'

const SPEARS = (n: number, mu = 5): Force => ({ mix: { spear: n }, equip: 'ironTip', mu, morale: 1 })
/** 쓰임(공수·지형) 덤이 없는 병종 — 바탕 셈(N × E × L × M)만 재는 시험에 (battle.roleMul 은 창·활·방패에만 붙는다) */
const PIKES = (n: number, mu = 5): Force => ({ mix: { pike: n }, equip: 'ironTip', mu, morale: 1 })

describe('이름 붙은 주사위 roll()', () => {
  it('같은 (시드, 계절, 이름) 은 같은 값', () => {
    assert.equal(roll(42, 7, 'battle:e3:h1'), roll(42, 7, 'battle:e3:h1'))
  })

  it('[0, 1) 안이고 고르게 퍼진다 — 10칸 각각 10% ± 1.5%p (2만 번)', () => {
    const cells = new Array<number>(10).fill(0)
    const n = 20000
    for (let i = 0; i < n; i++) {
      const r = roll(1234, i % 40, `k:${i}`)
      assert.ok(r >= 0 && r < 1)
      cells[Math.floor(r * 10)]! += 1
    }
    for (const c of cells) assert.ok(Math.abs(c / n - 0.1) < 0.015, `칸 비율 ${c / n}`)
  })

  it('이름·계절·시드 어느 하나만 달라도 값이 달라진다', () => {
    const base = roll(7, 3, 'scout:n5')
    assert.notEqual(base, roll(7, 3, 'scout:n6'))
    assert.notEqual(base, roll(7, 4, 'scout:n5'))
    assert.notEqual(base, roll(8, 3, 'scout:n5'))
  })

  it('판정을 하나 더 굴려도 다른 판정의 값은 그대로다 — 옛 리플레이가 안 깨진다', () => {
    const before = ['battle:a', 'battle:b'].map((k) => roll(99, 12, k))
    roll(99, 12, 'event:new-card') // 새 콘텐츠가 굴림을 하나 더한다
    const after = ['battle:a', 'battle:b'].map((k) => roll(99, 12, k))
    assert.deepEqual(after, before)
  })

  it('시드와 계절이 xor 로 서로 지워지지 않는다', () => {
    const seen = new Set<number>()
    for (let s = 0; s < 64; s++) for (let t = 0; t < 64; t++) seen.add(roll(s, t, 'x'))
    assert.equal(seen.size, 64 * 64)
  })
})

describe('전투 판정', () => {
  it('결과 다섯 칸은 언제나 합이 1 이고 음수가 없다', () => {
    for (let i = 0; i <= 100; i++) {
      const b = bins(i / 100)
      const sum = b.rout + b.win + b.draw + b.lose + b.routed
      assert.ok(Math.abs(sum - 1) < 1e-12, `P=${i / 100} 합 ${sum}`)
      for (const v of Object.values(b)) assert.ok(v >= 0, `P=${i / 100} 음수 칸`)
    }
  })

  it('교착은 접전일수록 크다 — P=0.5 에서 0.10, P=0.9 에서 0.036', () => {
    assert.ok(Math.abs(bins(0.5).draw - 0.1) < 1e-12)
    assert.ok(Math.abs(bins(0.9).draw - 0.036) < 1e-12)
  })

  it('같은 군대끼리는 반반 · 병력 두 배면 k=2 에서 80% (쓰임 덤 없는 병종으로)', () => {
    const a = PIKES(100)
    assert.ok(Math.abs(winChance(power(a, a, OPEN_FIELD, 'atk'), power(a, a, OPEN_FIELD, 'def')) - 0.5) < 1e-12)
    const big = PIKES(200)
    const p = winChance(power(big, a, OPEN_FIELD, 'atk'), power(a, big, OPEN_FIELD, 'def'))
    assert.ok(Math.abs(p - 0.8) < 1e-12, `P=${p}`)
  })

  it('굴림은 칸 크기대로 떨어진다 (5만 번, 칸마다 ±1%p)', () => {
    const b = bins(0.62)
    const count: Record<Outcome, number> = { rout: 0, win: 0, draw: 0, lose: 0, routed: 0 }
    const n = 50000
    for (let i = 0; i < n; i++) count[pick(b, roll(5, 0, `t:${i}`))] += 1
    for (const k of Object.keys(count) as Outcome[]) {
      assert.ok(Math.abs(count[k] / n - b[k]) < 0.01, `${k}: ${count[k] / n} vs ${b[k]}`)
    }
  })

  it('상성 — 창병은 기병에 유리하다', () => {
    const spear = SPEARS(100)
    const horse: Force = { mix: { horse: 100 }, equip: 'ironTip', mu: 5, morale: 1 }
    assert.ok(power(spear, horse, OPEN_FIELD, 'atk') > power(horse, spear, OPEN_FIELD, 'def'))
  })

  it('기습 성공은 공격측 전투력 ×1.5 · 산성은 방어측 ×1.6', () => {
    const a = SPEARS(100)
    const base = power(a, a, OPEN_FIELD, 'atk')
    assert.ok(Math.abs(power(a, a, { ...OPEN_FIELD, ambush: 'success' }, 'atk') / base - P.realm.ambushSuccess) < 1e-12)
    const def = power(a, a, OPEN_FIELD, 'def')
    assert.ok(Math.abs(power(a, a, { ...OPEN_FIELD, fort: P.realm.fortSanseong }, 'def') / def - 1.6) < 1e-12)
  })

  it('지휘는 무 1 → 0.85, 무 10 → 1.30 (쓰임 덤 없는 병종으로)', () => {
    const lo = power(PIKES(100, 1), PIKES(100), OPEN_FIELD, 'atk') / headcount(PIKES(100))
    const hi = power(PIKES(100, 10), PIKES(100), OPEN_FIELD, 'atk') / headcount(PIKES(100))
    assert.ok(Math.abs(lo - 0.85) < 1e-12 && Math.abs(hi - 1.3) < 1e-12, `${lo} ${hi}`)
  })

  it('생포 + 전사 ≤ 1 — 가산이 커도 (검산: 0.90 + 0.15 = 1.05 가 나왔던 자리)', () => {
    for (const o of ['rout', 'win', 'draw', 'lose', 'routed'] as Outcome[]) {
      for (let bonus = -0.5; bonus <= 1.0001; bonus += 0.05) {
        const f = fate(o, bonus)
        assert.ok(f.capture >= 0 && f.death >= 0 && f.capture + f.death <= 1 + 1e-12, `${o} ${bonus}`)
        assert.ok(f.capture <= P.realm.captureMax + 1e-12)
      }
    }
    assert.deepEqual(fate('draw', 0.5), { capture: 0, death: 0 })
  })
})

describe('기습', () => {
  it('언제나 [5%, 85%] — 확실한 기습도 불가능한 기습도 없다', () => {
    for (let c = 0; c <= 1; c += 0.1) {
      for (let d = -9; d <= 9; d += 3) {
        for (const alert of [0, 0.3, 0.6, 1]) {
          const p = ambushChance(c, 5 + d / 2, 5 - d / 2, 0, 0.3, alert)
          assert.ok(p >= P.realm.ambushMin - 1e-12 && p <= P.realm.ambushMax + 1e-12)
        }
      }
    }
  })

  it('경계는 상한 0.6 에서 자른다 — 경계 1.0 이나 0.6 이나 같다', () => {
    assert.equal(ambushChance(0.7, 8, 2, 0, 0, 1.0), ambushChance(0.7, 8, 2, 0, 0, 0.6))
  })
})
