/**
 * 갈림길 2택 (docs/MEGAHIT.md §3 · game/forks.ts).
 *
 * 2026-08-31 전면 재작. 형: **"바람골 밀집 고르는거 너무 별로야. 진짜 개노잼이야.
 * 심지어 밀집으로 하면 과녁끼리 어이없이 겹치거나 땅바닥에 쳐박혀서 맞힐수도 없는게 나오잖아."**
 *
 * 그래서 여기서 지키는 것도 바뀌었다.
 *  1. **매판 같은 카드가 아니다** — 여섯 장의 패에서 둘, 직전 판과 같은 짝은 안 나온다.
 *  2. **결정론** (A1) — 같은 판 번호면 언제 구워도 같은 두 장, 같은 판.
 *  3. **놓는 것은 절대 안 겹치고 땅에 안 박힌다** — 이게 밀집이 죽은 이유다.
 *  4. **보스판엔 안 나온다.**
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { applyFork, forkOptions, forkPairKey, forkTrainMul, hasFork, type ForkOption } from '../src/game/forks.ts'
import { getStage } from '../src/game/stages.ts'
import { BOSS_EVERY } from '../src/game/stages.ts'
import { P } from '../src/tune/params.ts'
import type { StageDef, TargetSpec } from '../src/sim/types.ts'

/** 패에서 id로 한 장 꺼낸다 — 어느 판에서든 그 카드가 뜰 수 있어야 찾힌다. */
function card(id: ForkOption['id']): ForkOption {
  for (let n = 1; n <= 200; n++) {
    if (!hasFork(n)) continue
    for (const o of forkOptions(n, getStage(n - 1))) if (o.id === id) return o
  }
  throw new Error(`${id} 카드가 200판 안에 한 번도 안 나온다`)
}

const rOf = (t: TargetSpec): number => t.r ?? 0.3

describe('갈림길 — 언제 나오는가', () => {
  it('보스판(10의 배수)에는 안 나온다', () => {
    for (let n = 1; n <= 40; n++) {
      assert.equal(hasFork(n), n % BOSS_EVERY !== 0, `${n}판`)
    }
  })
})

describe('갈림길 — 패가 돈다 (형: "개노잼")', () => {
  it('두 장은 언제나 서로 다른 카드다', () => {
    for (let n = 1; n <= 120; n++) {
      if (!hasFork(n)) continue
      const [a, b] = forkOptions(n, getStage(n - 1))
      assert.notEqual(a.id, b.id, `${n}판에 같은 카드가 두 장`)
    }
  })

  it('직전 판과 같은 짝이 이어지지 않는다 — 이게 "개노잼"의 정체였다', () => {
    // loop가 하는 그대로 — 직전에 **보여준** 짝을 다음 뽑기에 넘긴다 (game/loop.ts lastForkKey).
    let prev = ''
    for (let n = 1; n <= 120; n++) {
      if (!hasFork(n)) { prev = ''; continue }
      const key = forkPairKey(forkOptions(n, getStage(n - 1), prev))
      assert.notEqual(key, prev, `${n}판이 직전과 같은 짝(${key})`)
      prev = key
    }
  })

  it('여섯 장이 실제로 다 나온다 — 패가 넓다고만 하고 안 돌면 거짓말이다', () => {
    const seen = new Set<string>()
    for (let n = 1; n <= 120; n++) {
      if (!hasFork(n)) continue
      for (const o of forkOptions(n, getStage(n - 1))) seen.add(o.id)
    }
    assert.equal(seen.size, 6, `나온 카드: ${[...seen].join(',')}`)
  })

  it('같은 판 번호면 언제 물어도 같은 두 장이다 (A1)', () => {
    for (const n of [3, 7, 13, 24, 38]) {
      const a = forkOptions(n, getStage(n - 1)).map((o) => o.id).join(',')
      const b = forkOptions(n, getStage(n - 1)).map((o) => o.id).join(',')
      assert.equal(a, b)
    }
  })
})

describe('갈림길 — 바람골', () => {
  const WIND = card('wind')

  it('무풍 판에 최저 바람을 끌어올린다', () => {
    const out = applyFork({ ...getStage(0), wind: 0 }, WIND, 1)
    assert.ok(out.wind > 0, '바람골인데 무풍이면 안 된다')
  })

  it('원래 더 강한 바람이면 깎지 않는다', () => {
    const out = applyFork({ ...getStage(20), wind: 999 }, WIND, 21)
    assert.equal(out.wind, 999)
  })

  it('과녁·화살 수는 안 건드린다 — 바람골의 값은 순수하게 조준 난이도다', () => {
    const stage = getStage(2)
    const out = applyFork(stage, WIND, 3)
    assert.equal(out.targets.length, stage.targets.length)
    assert.equal(out.arrows, stage.arrows)
  })
})

describe('갈림길 — 화약고', () => {
  const BOMB = card('bomb')

  it('과녁을 옮기거나 늘리지 않는다 — 표시만 한다', () => {
    for (let n = 1; n <= 40; n++) {
      const stage = getStage(n - 1)
      const out = applyFork(stage, BOMB, n)
      assert.equal(out.targets.length, stage.targets.length, `${n}판 과녁 수가 변했다`)
      for (let i = 0; i < stage.targets.length; i++) {
        const a = stage.targets[i] as TargetSpec
        const b = out.targets[i] as TargetSpec
        assert.equal(b.x, a.x, `${n}판 ${i}번 과녁이 옮겨졌다`)
        assert.equal(b.y, a.y)
        assert.equal(b.kind, a.kind)
      }
    }
  })

  it('전부 폭탄이 되지는 않는다 — 한 발에 판이 지워지면 조준이 사라진다', () => {
    for (let n = 1; n <= 40; n++) {
      const stage = getStage(n - 1)
      const out = applyFork(stage, BOMB, n)
      const bombs = out.targets.filter((t) => t.bomb === true).length
      const pool = stage.targets.filter((t) => t.kind !== 'boss' && t.kind !== 'bonus').length
      if (pool < 2) continue
      assert.ok(bombs >= 1, `${n}판에 폭탄이 하나도 없다`)
      assert.ok(bombs < pool, `${n}판이 전부 폭탄이다 (${bombs}/${pool})`)
    }
  })

  it('보스·보급에는 화약을 안 싣는다', () => {
    for (let n = 1; n <= 40; n++) {
      for (const t of applyFork(getStage(n - 1), BOMB, n).targets) {
        if (t.bomb === true) {
          assert.notEqual(t.kind, 'boss')
          assert.notEqual(t.kind, 'bonus')
        }
      }
    }
  })
})

describe('갈림길 — 새로 놓는 것은 겹치지도 박히지도 않는다', () => {
  /** 판 하나에 카드를 얹고, 늘어난 과녁이 (a) 아무와도 안 겹치고 (b) 땅 위에 있는지 본다. */
  function checkPlacement(stage: StageDef, out: StageDef, label: string): void {
    const added = out.targets.slice(stage.targets.length)
    for (const t of added) {
      const r = rOf(t)
      assert.ok(t.y - r >= 0, `${label}: 새 과녁이 땅에 박혔다 (y=${t.y}, r=${r})`)
      for (const other of stage.targets) {
        const d = Math.hypot(t.x - other.x, t.y - other.y)
        assert.ok(
          d >= r + rOf(other),
          `${label}: 새 과녁이 기존 과녁과 겹쳤다 (거리 ${d.toFixed(2)} < ${(r + rOf(other)).toFixed(2)})`,
        )
      }
    }
  }

  it('노다지 — 60판 전부에서 안 겹치고 안 박힌다', () => {
    const SUPPLY = card('supply')
    for (let n = 1; n <= 60; n++) {
      const stage = getStage(n - 1)
      checkPlacement(stage, applyFork(stage, SUPPLY, n), `${n}판 노다지`)
    }
  })

  it('척후 — 60판 전부에서 안 겹치고 안 박힌다', () => {
    const SCOUT = card('scout')
    for (let n = 1; n <= 60; n++) {
      const stage = getStage(n - 1)
      checkPlacement(stage, applyFork(stage, SCOUT, n), `${n}판 척후`)
    }
  })

  it('노다지는 보급 과녁 하나를 더한다 (화살을 돌려주는 것)', () => {
    const stage = getStage(2)
    const out = applyFork(stage, card('supply'), 3)
    const added = out.targets.slice(stage.targets.length)
    assert.equal(added.length, 1)
    assert.equal(added[0]?.kind, 'bonus')
    assert.ok((added[0]?.give ?? 0) >= 1, '아무것도 안 돌려주는 보급은 보급이 아니다')
  })

  it('척후는 돌진 과녁 하나를 더하고, 판의 바깥에서 온다', () => {
    const stage = getStage(2)
    const out = applyFork(stage, card('scout'), 3)
    const added = out.targets.slice(stage.targets.length)
    assert.equal(added.length, 1)
    assert.equal(added[0]?.kind, 'charger')
    const maxX = Math.max(...stage.targets.map((t) => t.x + rOf(t)))
    assert.ok((added[0]?.x ?? 0) > maxX, '척후가 판 안쪽에서 튀어나오면 안 된다')
  })
})

describe('갈림길 — 단발', () => {
  const SINGLE = card('single')

  it('화살이 줄지만 바닥은 있다', () => {
    for (let n = 1; n <= 40; n++) {
      const stage = getStage(n - 1)
      const out = applyFork(stage, SINGLE, n)
      assert.ok(out.arrows <= stage.arrows, `${n}판 화살이 늘었다`)
      assert.ok(out.arrows >= Math.min(stage.arrows, P.fork.singleFloor), `${n}판 화살이 바닥 밑이다`)
    }
  })

  it('과녁 수보다 화살이 적어지지 않는다 — 클리어가 불가능한 판은 만들지 않는다', () => {
    for (let n = 1; n <= 40; n++) {
      const stage = getStage(n - 1)
      if (stage.arrows < stage.targets.length) continue // 원래부터 그런 판은 이 검사의 몫이 아니다
      const out = applyFork(stage, SINGLE, n)
      const killable = out.targets.filter((t) => t.kind !== 'bonus').length
      assert.ok(out.arrows >= killable, `${n}판: 화살 ${out.arrows} < 과녁 ${killable}`)
    }
  })
})

describe('갈림길 — 훈련치 배수', () => {
  it('위험한 카드일수록 크다 (단발 > 척후 > 바람골)', () => {
    const single = forkTrainMul(card('single'))
    const scout = forkTrainMul(card('scout'))
    const wind = forkTrainMul(card('wind'))
    assert.ok(single > scout, `단발 ${single} > 척후 ${scout}`)
    assert.ok(scout > wind, `척후 ${scout} > 바람골 ${wind}`)
    assert.ok(wind > 1, '바람골에도 값은 있어야 한다')
  })

  it('배수 없는 카드는 1이다 — 보상이 배치로 오는 카드다', () => {
    assert.equal(forkTrainMul(card('fire')), 1)
    assert.equal(forkTrainMul(card('supply')), 1)
    assert.equal(forkTrainMul(null), 1)
  })
})

describe('갈림길 — 화공', () => {
  it('판은 안 건드리고 살만 바꾼다', () => {
    const FIRE = card('fire')
    assert.equal(FIRE.arrow, 'burst')
    const stage = getStage(4)
    assert.deepEqual(applyFork(stage, FIRE, 5), stage)
  })
})

describe('갈림길 — 결정론 (A1)', () => {
  it('같은 판 번호·같은 선택은 언제 구워도 같다', () => {
    for (const id of ['bomb', 'supply', 'scout', 'single', 'wind'] as const) {
      const a = JSON.stringify(applyFork(getStage(5), card(id), 6))
      const b = JSON.stringify(applyFork(getStage(5), card(id), 6))
      assert.equal(a, b, id)
    }
  })

  it('화약고는 판 번호가 다르면 실리는 자리도 달라진다', () => {
    const BOMB = card('bomb')
    const seen = new Set<string>()
    for (const n of [3, 13, 23, 33]) {
      seen.add(applyFork(getStage(2), BOMB, n).targets.map((t) => (t.bomb === true ? '1' : '0')).join(''))
    }
    assert.ok(seen.size > 1, '판 번호를 시드에 안 섞으면 모든 화약고 판이 같은 모양이 된다')
  })
})
