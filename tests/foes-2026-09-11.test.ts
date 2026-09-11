/**
 * 2026-09-11 형의 반려 — **sim 쪽 사실들**
 *
 * 그림은 tools/probe-enemy.ts 가 본다. 여기서는 눈으로 못 보는 것,
 * 즉 **규칙이 실제로 그렇게 도는가**를 못 박는다.
 *
 *   ① 보스가 자기 공격을 한다 (형: "보스가 자기들만의 공격이 있어야 하는데 그런것도 없고")
 *      · 예고(windup)가 먼저 나가고, 그 뒤에 날아온다 — 예고 없는 피해는 없다
 *      · 비틀거리는 동안은 **안 쏜다** — 약점을 때리는 것이 곧 방어다
 *      · 여덟이 저마다 다른 것을 던진다 (bossAttack)
 *   ② 총통수와 투석군은 **서로 반대 질문**이다
 *      · 총통수의 탄환은 곧게 온다 → 산 방패가 막는다
 *      · 투석군의 돌은 넘겨 던진다 → 방패 **위로** 넘어온다
 *
 * (화공이 화전 재고를 깎던 버그는 game/loop.ts 의 것이라 여기서 못 잡는다 — loop 는 ui 를
 *  들고 있어 헤드리스로 안 선다. 그쪽은 arrowBeforeFork 주석에 무엇이 틀렸었는지 적어 뒀다.)
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createWorld, step } from '../src/sim/world.ts'
import { bossAttack, bossWeakSpot, foeWeakSpot } from '../src/sim/target.ts'
import { P } from '../src/tune/params.ts'
import type { InputFrame, StageDef, Stats, TargetSpec, World } from '../src/sim/types.ts'

const STATS: Stats = { str: 8, steady: 6, stamina: 6, focus: 4 }
const IDLE: InputFrame = { aimX: 20, aimY: 3, drawing: false, steady: false, parry: false }

function stageOf(spec: TargetSpec, wind = 0): StageDef {
  return {
    id: 'test', chapter: 1, index: 1, name: '시험', hint: '',
    arrows: 9, wind, targetScore: 100, targets: [spec],
  } as unknown as StageDef
}

/** dt 초만큼 돌리며 일어난 사건을 모은다. */
function run(w: World, seconds: number): string[] {
  const out: string[] = []
  const steps = Math.round(seconds / w.dt)
  for (let i = 0; i < steps; i++) {
    step(w, IDLE)
    for (const ev of w.events) out.push(ev.t)
    w.events.length = 0
  }
  return out
}

describe('보스의 자기 공격', () => {
  it('여덟이 저마다 다른 것을 던진다 — 같은 것만 나오면 그건 개성이 아니다', () => {
    const shots = new Set<number>()
    for (let look = 0; look <= 7; look++) shots.add(bossAttack(look).shot)
    assert.ok(shots.size >= 3, `던지는 것이 ${shots.size}가지뿐이다`)
    // 도깨비는 **돌**을 친다 (방망이로 땅을 쳐 튄 것). 혼불이 아니다.
    assert.equal(bossAttack(4).shot, 1)
    // 장승은 제 몸에서 **말뚝**을 뽑아 뱉는다 — 화살과 같은 생김새.
    assert.equal(bossAttack(6).shot, 0)
  })

  it('예고가 먼저 나가고, 그 뒤에 날아온다 (예고 없는 피해는 없다)', () => {
    const w = createWorld(stageOf({ kind: 'boss', look: 0, x: 34, y: 3, r: 1.5, hp: 9999, speed: 0 } as TargetSpec), STATS)
    const evs = run(w, 12)
    const draw = evs.indexOf('enemy_draw')
    const shot = evs.indexOf('enemy_shot')
    assert.ok(draw >= 0, '보스가 예고를 안 한다')
    assert.ok(shot >= 0, '보스가 아예 안 쏜다')
    assert.ok(draw < shot, '예고보다 발사가 먼저다')
  })

  it('비틀거리는 동안은 안 쏜다 — 약점을 때리는 것이 곧 방어다', () => {
    const w = createWorld(stageOf({ kind: 'boss', look: 0, x: 34, y: 3, r: 1.5, hp: 9999, speed: 0 } as TargetSpec), STATS)
    const t = w.targets.find((q) => q.alive)
    assert.ok(t !== undefined)
    // 아주 긴 비틀거림을 억지로 걸고, 그 사이에 한 발도 안 나가는지 본다.
    t.stagger = 30
    const evs = run(w, 20)
    assert.equal(evs.filter((e) => e === 'enemy_shot').length, 0, '멈춘 보스가 쐈다')
    // 풀리면 다시 쏜다 — 영영 안 쏘는 것이 아니라 그동안만 못 쏘는 것이다.
    t.stagger = 0
    const after = run(w, 20)
    assert.ok(after.includes('enemy_shot'), '풀렸는데도 안 쏜다')
  })
})

describe('총통수와 투석군 — 서로 반대의 질문', () => {
  /** 이 적이 쏜 첫 발이 궁수 앞 방패 평면(x = shieldX)을 **어느 높이로** 지나는가. */
  function crossHeight(look: number): number {
    const w = createWorld(stageOf({
      kind: 'archer', look, x: 24, y: look === 6 ? 0.7 : 0.72, r: 0.7, hp: 30, fireDelay: 1.5,
    } as TargetSpec), STATS)
    const planeX = w.archer.x + P.defense.shieldX
    for (let i = 0; i < 60 * 30; i++) {
      step(w, IDLE)
      w.events.length = 0
      for (const sh of w.shots) {
        if (!sh.alive) continue
        // 이번 스텝에 평면을 오른쪽에서 왼쪽으로 지났는가.
        if (sh.px > planeX && sh.x <= planeX) {
          const span = sh.px - sh.x
          const u = span > 1e-9 ? (sh.px - planeX) / span : 0
          return sh.py + (sh.y - sh.py) * u
        }
      }
    }
    return Number.NaN
  }

  it('총통수의 탄환은 방패 높이 안으로 들어온다 — 방패가 답이다', () => {
    const h = crossHeight(5)
    assert.ok(Number.isFinite(h), '총통수가 안 쐈다')
    assert.ok(h >= 0 && h <= P.defense.shieldTop, `방패(0~${P.defense.shieldTop}m)를 벗어났다: ${h.toFixed(2)}m`)
  })

  it('투석군의 돌은 방패 위로 넘어온다 — 그래서 답이 환도다', () => {
    const h = crossHeight(6)
    assert.ok(Number.isFinite(h), '투석군이 안 던졌다')
    assert.ok(h > P.defense.shieldTop, `방패를 못 넘었다: ${h.toFixed(2)}m (방패 ${P.defense.shieldTop}m)`)
  })

  it('같은 시드면 같은 결과다 (A1) — 높은 호도 난수가 아니다', () => {
    assert.equal(crossHeight(6).toFixed(6), crossHeight(6).toFixed(6))
  })
})

describe('급소의 자리는 한 곳에서만 정해진다', () => {
  it('매의 급소는 몸 **앞**에 있다 — 새는 앞으로 길다', () => {
    assert.ok(foeWeakSpot(3).fwd < 0, '매의 눈이 몸 위에 있다')
  })
  it('화차의 급소는 사람 머리 높이가 아니다 — 수레 위의 화약궤다', () => {
    assert.ok(foeWeakSpot(4).up < P.enemy.archerHeadUp * 0.5)
  })
  it('사람 잡몹은 전부 머리다 (총통수·투석군 포함)', () => {
    for (const look of [0, 1, 2, 5, 6]) {
      assert.equal(foeWeakSpot(look).up, P.enemy.archerHeadUp, `look ${look}`)
    }
  })
  it('도깨비의 급소는 이마가 아니라 얼굴이다 (형: "왕눈이 뇌속에")', () => {
    assert.ok(bossWeakSpot(4).up < P.target.bossHeadUp, '도깨비의 급소가 아직 이마 위다')
  })
  it('유령 넷의 급소는 그대로다 — 바꾼 적 없는 것은 안 바뀐다', () => {
    for (const look of [0, 1, 2, 3, 7]) {
      assert.equal(bossWeakSpot(look).up, P.target.bossHeadUp, `look ${look}`)
    }
  })
})
