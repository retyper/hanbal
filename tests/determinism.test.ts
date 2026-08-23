/**
 * 결정론 테스트 (ARCHITECTURE A1)
 *
 * 이 프로젝트의 개발 속도 전체가 여기 걸려 있다.
 * 결정론이 깨지면 밸런스 시뮬도, 리플레이 버그 재현도, 튜닝 판정도 전부 근거를 잃는다.
 * 그래서 얕은 비교로 넘기지 않고 화살 궤적 버퍼·rng 상태까지 전부 비교한다.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createWorld, resetWorld, step } from '../src/sim/world.ts'
import { makeRng } from '../src/core/rng.ts'
import type { InputFrame, Stats, StageDef, World } from '../src/sim/types.ts'

// ───────────────────────── 픽스처 ─────────────────────────

const STATS: Stats = { str: 6, steady: 5, stamina: 6, focus: 4 }

/** 매번 새 객체를 만든다. 두 판이 같은 stage 객체를 공유하면 오염을 못 잡는다. */
function makeStage(): StageDef {
  return {
    id: 'det-01',
    seed: 0xc0ffee,
    arrows: 8,
    targetScore: 400,
    // 바람이 켜져 있어야 windPhase·돌풍 경로까지 결정론 검사에 들어간다.
    wind: 4,
    targets: [
      { kind: 'static', x: 14, y: 1.6, r: 0.4, score: 100 },
      { kind: 'moving', x: 19, y: 2.4, r: 0.35, score: 140, ampX: 1.4, freq: 0.35 },
      { kind: 'aerial', x: 16, y: 5.2, r: 0.3, score: 160 },
    ],
  }
}

/**
 * 입력 시퀀스는 시드에서 완전히 재현 가능해야 한다.
 * 실행 중에 만들면 두 판이 같은 입력을 받았는지조차 보장할 수 없다.
 */
function buildInputs(seed: number, count: number): InputFrame[] {
  const rng = makeRng(seed)
  const out: InputFrame[] = new Array(count)
  for (let i = 0; i < count; i++) {
    const cycle = i % 320
    const ph = i * 0.011
    out[i] = {
      aimX: 15 + Math.sin(ph) * 0.8 + rng.range(-0.3, 0.3),
      aimY: 2.4 + Math.cos(ph * 0.7) * 0.5 + rng.range(-0.25, 0.25),
      // 당김 → 만작 유지 → 릴리즈 → 회복. 한 사이클 320스텝(약 2.7s).
      drawing: cycle < 250,
      // 호흡정지는 릴리즈 직전 구간에만 (steadyBlend 램프까지 경로에 태운다)
      steady: cycle >= 170 && cycle < 250,
    }
  }
  return out
}

function must<T>(v: T | undefined, what: string): T {
  if (v === undefined) throw new Error(`${what} 가 undefined`)
  return v
}

function run(
  w: World,
  inputs: readonly InputFrame[],
  from: number,
  to: number,
  consumeEvents: boolean,
): void {
  for (let i = from; i < to; i++) {
    step(w, must(inputs[i], `입력[${i}]`))
    // 소비자 계약: 읽고 length=0 으로 비운다 (types.ts SimEvent 주석)
    if (consumeEvents) w.events.length = 0
  }
}

// ───────────────────────── 깊은 스냅샷 ─────────────────────────

interface Snap {
  numKeys: string[]
  nums: number[]
  strKeys: string[]
  strs: string[]
  events: string
}

/**
 * World의 모든 관측 가능한 상태를 평평하게 편다. 얕은 비교로는 궤적 버퍼 불일치를 놓친다.
 *
 * deepTrail=false 면 링버퍼 내용물은 뺀다. trailLen 밖의 구간은 렌더가 절대 읽지 않는
 * 죽은 메모리라, 판을 갈아끼울 때 남아 있어도 관측 가능한 상태가 아니다.
 */
function snapshot(w: World, includeEvents: boolean, deepTrail = true): Snap {
  const numKeys: string[] = []
  const nums: number[] = []
  const strKeys: string[] = []
  const strs: string[] = []
  const n = (key: string, v: number): void => {
    numKeys.push(key)
    nums.push(v)
  }
  const s = (key: string, v: string): void => {
    strKeys.push(key)
    strs.push(v)
  }

  n('tick', w.tick)
  n('dt', w.dt)
  n('rng.state', w.rng.state())
  s('status', w.status)
  n('wind', w.wind)
  n('windPhase', w.windPhase)
  n('arrowsLeft', w.arrowsLeft)
  n('score', w.score)
  n('combo', w.combo)
  n('elapsed', w.elapsed)
  s('stage.id', w.stage.id)
  n('stage.seed', w.stage.seed)

  const a = w.archer
  s('archer.phase', a.phase)
  n('archer.x', a.x)
  n('archer.y', a.y)
  n('archer.aimAngle', a.aimAngle)
  n('archer.tremorOffset', a.tremorOffset)
  n('archer.tremorAmp', a.tremorAmp)
  n('archer.tremorPhase', a.tremorPhase)
  n('archer.draw', a.draw)
  n('archer.drawTime', a.drawTime)
  n('archer.holdTime', a.holdTime)
  n('archer.stamina', a.stamina)
  n('archer.staminaMax', a.staminaMax)
  n('archer.regenLock', a.regenLock)
  n('archer.steadyTime', a.steadyTime)
  n('archer.steadyBlend', a.steadyBlend)
  n('archer.warn', a.warn)

  n('arrows.len', w.arrows.length)
  let i = 0
  for (const ar of w.arrows) {
    const p = `arrow[${i}]`
    n(`${p}.alive`, ar.alive ? 1 : 0)
    n(`${p}.x`, ar.x)
    n(`${p}.y`, ar.y)
    n(`${p}.px`, ar.px)
    n(`${p}.py`, ar.py)
    n(`${p}.vx`, ar.vx)
    n(`${p}.vy`, ar.vy)
    n(`${p}.angle`, ar.angle)
    n(`${p}.age`, ar.age)
    n(`${p}.pierced`, ar.pierced)
    n(`${p}.power`, ar.power)
    n(`${p}.trailLen`, ar.trailLen)
    n(`${p}.trailHead`, ar.trailHead)
    s(`${p}.outcome`, ar.outcome)
    // 궤적 링버퍼까지 비교한다. 렌더 전용이라도 sim이 쓰는 이상 결정론 대상이다.
    if (deepTrail) {
      for (let j = 0; j < ar.trail.length; j++) {
        n(`${p}.trail[${j}]`, must(ar.trail[j], `${p}.trail[${j}]`))
      }
    }
    i++
  }

  n('targets.len', w.targets.length)
  let ti = 0
  for (const t of w.targets) {
    const p = `target[${ti}]`
    n(`${p}.id`, t.id)
    n(`${p}.alive`, t.alive ? 1 : 0)
    s(`${p}.kind`, t.kind)
    n(`${p}.x`, t.x)
    n(`${p}.y`, t.y)
    n(`${p}.px`, t.px)
    n(`${p}.py`, t.py)
    n(`${p}.vx`, t.vx)
    n(`${p}.vy`, t.vy)
    n(`${p}.r`, t.r)
    n(`${p}.baseX`, t.baseX)
    n(`${p}.baseY`, t.baseY)
    n(`${p}.ampX`, t.ampX)
    n(`${p}.ampY`, t.ampY)
    n(`${p}.freq`, t.freq)
    n(`${p}.falling`, t.falling ? 1 : 0)
    n(`${p}.chainDepth`, t.chainDepth)
    n(`${p}.score`, t.score)
    ti++
  }

  return { numKeys, nums, strKeys, strs, events: includeEvents ? JSON.stringify(w.events) : '' }
}

/** 첫 번째 불일치 지점을 사람이 읽을 수 있게. "다르다"만 알면 디버깅에 아무 도움이 안 된다. */
function firstDiff(a: Snap, b: Snap): string | null {
  if (a.nums.length !== b.nums.length) {
    return `숫자 필드 개수 불일치: ${a.nums.length} vs ${b.nums.length}`
  }
  for (let i = 0; i < a.nums.length; i++) {
    const x = must(a.nums[i], 'a.nums')
    const y = must(b.nums[i], 'b.nums')
    // Object.is 로 비교해야 -0/+0 과 NaN 도 잡힌다.
    if (!Object.is(x, y)) return `${must(a.numKeys[i], 'key')}: ${x} vs ${y} (차 ${x - y})`
  }
  if (a.strs.length !== b.strs.length) {
    return `문자 필드 개수 불일치: ${a.strs.length} vs ${b.strs.length}`
  }
  for (let i = 0; i < a.strs.length; i++) {
    if (a.strs[i] !== b.strs[i]) {
      return `${must(a.strKeys[i], 'key')}: ${a.strs[i]} vs ${b.strs[i]}`
    }
  }
  if (a.events !== b.events) return `events: ${a.events.slice(0, 200)} vs ${b.events.slice(0, 200)}`
  return null
}

function assertSame(a: Snap, b: Snap, what: string): void {
  const d = firstDiff(a, b)
  assert.equal(d, null, `${what} — 결정론 위반: ${d}`)
}

// ───────────────────────── 테스트 ─────────────────────────

const STEPS = 600

describe('결정론 (A1)', () => {
  it('같은 시드 + 같은 입력 시퀀스 = 완전히 같은 최종 상태', () => {
    const inputs = buildInputs(0x5eed, STEPS)

    const a = createWorld(makeStage(), STATS)
    const b = createWorld(makeStage(), STATS)
    run(a, inputs, 0, STEPS, false)
    run(b, inputs, 0, STEPS, false)

    assertSame(snapshot(a, true), snapshot(b, true), '600스텝 2회 실행')
  })

  it('스텝을 쪼개도 같다: 600 == 200 + 400', () => {
    const inputs = buildInputs(0x5eed, STEPS)

    const whole = createWorld(makeStage(), STATS)
    run(whole, inputs, 0, STEPS, false)

    const split = createWorld(makeStage(), STATS)
    run(split, inputs, 0, 200, false)
    run(split, inputs, 200, STEPS, false)

    assertSame(snapshot(whole, true), snapshot(split, true), '600 vs 200+400')
  })

  it('이벤트를 소비해도 시뮬 상태는 같다 (이벤트는 출력 전용)', () => {
    const inputs = buildInputs(0x5eed, STEPS)

    const kept = createWorld(makeStage(), STATS)
    const drained = createWorld(makeStage(), STATS)
    run(kept, inputs, 0, STEPS, false)
    run(drained, inputs, 0, STEPS, true)

    // events 자체는 다를 수밖에 없으니 제외하고 비교한다.
    assertSame(snapshot(kept, false), snapshot(drained, false), '이벤트 소비 유무')
  })

  it('resetWorld는 새로 만든 World와 같은 상태로 되돌린다', () => {
    const inputs = buildInputs(0x5eed, STEPS)

    const reused = createWorld(makeStage(), STATS)
    run(reused, inputs, 0, STEPS, false)
    resetWorld(reused, makeStage(), STATS)
    reused.events.length = 0

    const fresh = createWorld(makeStage(), STATS)
    fresh.events.length = 0

    // 링버퍼 내용물까지 비교한다. resetWorld가 trail을 지우므로 잔여물이 남으면 안 된다 —
    // 남으면 나중에 월드 전체를 해시해 리플레이를 검증할 때 같은 판이 다르게 읽힌다.
    assertSame(snapshot(fresh, false), snapshot(reused, false), 'resetWorld 후 상태')
  })

  it('재실행 후에도 다시 같다 (판을 이어 돌려도 상태가 새지 않는다)', () => {
    const inputs = buildInputs(0xa11ce, STEPS)

    const a = createWorld(makeStage(), STATS)
    resetWorld(a, makeStage(), STATS)
    run(a, inputs, 0, STEPS, false)

    const b = createWorld(makeStage(), STATS)
    run(b, inputs, 0, STEPS, false)

    assertSame(snapshot(b, false), snapshot(a, false), 'reset 후 재실행')
  })

  it('테스트가 헛돌지 않는다: 실제로 상태가 변하고 화살이 나간다', () => {
    const inputs = buildInputs(0x5eed, STEPS)
    const w = createWorld(makeStage(), STATS)
    const before = snapshot(w, false)
    run(w, inputs, 0, STEPS, false)
    const after = snapshot(w, false)

    assert.notEqual(firstDiff(before, after), null, '600스텝을 돌렸는데 상태가 그대로다')
    assert.ok(
      w.arrowsLeft < w.stage.arrows,
      `입력 시퀀스가 화살을 한 발도 못 쐈다 (arrowsLeft=${w.arrowsLeft})`,
    )
    assert.ok(w.tick > 0, 'tick이 진행되지 않았다')
  })

  it('모든 상태값이 유한하다 (NaN 오염이 결정론 비교를 통과하는 걸 막는다)', () => {
    const inputs = buildInputs(0x5eed, STEPS)
    const w = createWorld(makeStage(), STATS)
    run(w, inputs, 0, STEPS, false)
    const snap = snapshot(w, false)
    for (let i = 0; i < snap.nums.length; i++) {
      const v = must(snap.nums[i], 'nums')
      assert.ok(Number.isFinite(v), `${must(snap.numKeys[i], 'key')} = ${v}`)
    }
  })
})

// ───────────────────────── 정적 검사 ─────────────────────────

const FORBIDDEN: ReadonlyArray<{ re: RegExp; why: string }> = [
  { re: /\bMath\s*\.\s*random\b/, why: 'core/rng.ts 의 시드 RNG만 쓴다' },
  { re: /\bDate\s*\.\s*now\b/, why: 'sim 내부 tick 시계만 쓴다' },
  { re: /\bnew\s+Date\b/, why: 'sim 내부 tick 시계만 쓴다' },
  { re: /\bperformance\s*\.\s*now\b/, why: 'sim 내부 tick 시계만 쓴다' },
  { re: /\bdocument\b/, why: 'sim/core 는 DOM을 모른다' },
  { re: /\bwindow\b/, why: 'sim/core 는 DOM을 모른다' },
  { re: /\blocalStorage\b/, why: '저장은 game/ 레이어의 일이다' },
  { re: /\brequestAnimationFrame\b/, why: '고정 스텝만 쓴다' },
]

/** 주석은 검사에서 뺀다. math.ts 주석의 "Math.random 없이" 같은 설명문까지 걸리면 안 된다. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

function collectTs(dir: string, out: string[]): void {
  if (!existsSync(dir)) return
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, ent.name)
    if (ent.isDirectory()) collectTs(full, out)
    else if (ent.name.endsWith('.ts')) out.push(full)
  }
}

describe('정적 검사 — sim/core 에 비결정 소스가 없다', () => {
  const root = fileURLToPath(new URL('../src/', import.meta.url))
  const files: string[] = []
  collectTs(join(root, 'sim'), files)
  collectTs(join(root, 'core'), files)

  it('스캔 대상 파일이 존재한다', () => {
    assert.ok(files.length > 0, 'src/sim, src/core 에서 .ts 파일을 하나도 못 찾았다')
  })

  for (const file of files) {
    const rel = file.split('\\').join('/').split('/src/')[1] ?? file
    // rng.ts 는 시드 RNG의 뿌리라 예외. 여기만 유일하게 비결정 이름을 언급할 수 있다.
    if (rel.endsWith('core/rng.ts')) continue
    it(`${rel} 에 비결정 소스가 없다`, () => {
      const src = stripComments(readFileSync(file, 'utf8'))
      const lines = src.split('\n')
      for (const rule of FORBIDDEN) {
        for (let i = 0; i < lines.length; i++) {
          const line = must(lines[i], 'line')
          assert.ok(
            !rule.re.test(line),
            `${rel}:${i + 1} — ${rule.re.source} 발견. ${rule.why}\n  ${line.trim()}`,
          )
        }
      }
    })
  }
})
