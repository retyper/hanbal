export {}
/**
 * 집중 프로브 — **"다 차면 겨눈 자리에 꽂힌다"가 참인지 숫자로 본다.**
 *
 * 집중(sim/types.ts ArcherState.focus)은 발사각을 조준선에서 탄도해로 옮긴다. 그런데 그 해는
 * **공기 저항을 모른다** — 닫힌 해가 없기 때문이다. 그래서 그냥 두면 먼 거리에서 짧게 떨어지고,
 * 그 몫을 `P.focus.dragComp` 가 메운다. 이 프로브가 그 값을 정하는 자다.
 *
 * 여기서 재는 것:
 *   ① 집중 0 — 겨눈 자리에서 얼마나 빗나가는가 (지금까지의 게임)
 *   ② 집중 1 — 얼마나 붙는가. **이게 과녁 반경보다 작아야** "겨눈 자리에 꽂힌다"가 참이다
 *   ③ dragComp 를 훑어 어느 값이 가장 붙는지
 *
 * 실행: node --experimental-strip-types tools/probe-focus.ts
 *       node --experimental-strip-types tools/probe-focus.ts --sweep   (보정값 훑기)
 */
import { createWorld, step } from '../src/sim/world.ts'
import { P } from '../src/tune/params.ts'
import { angularSize, HAND_X, HAND_Y } from '../src/game/stagekit.ts'
import type { InputFrame, StageDef, Stats } from '../src/sim/types.ts'

const STATS: Stats = { str: 10, steady: 8, stamina: 8, focus: 6 }

function arena(): StageDef {
  // 과녁을 아주 멀리 둔다 — 화살이 그 앞에서 죽지 않게. 판정은 궤적으로 직접 한다.
  return {
    id: 'focus-probe', seed: 1, arrows: 99, targetScore: 100, wind: 0,
    targets: [{ kind: 'static', x: 400, y: 40, r: 0.2, score: 100 }],
  }
}

/**
 * (tx, ty)를 겨누고 집중 f 로 쏜 화살이 **x=tx 를 지날 때의 높이**를 돌려준다.
 * 겨눈 자리와의 차이가 곧 오차다.
 */
function shootAt(tx: number, ty: number, f: number, wind = 0): number {
  const stage = { ...arena(), wind }
  const w = createWorld(stage, STATS, 'basic')
  const a = w.archer
  const input: InputFrame = { aimX: tx, aimY: ty, drawing: true, steady: false }

  // 만작까지 당긴다. 그 뒤 집중을 원하는 만큼 채운다 — sim 을 그대로 돌려서.
  for (let i = 0; i < 2000 && a.phase !== 'full'; i++) step(w, input)
  for (let i = 0; i < 2000 && a.focus < f; i++) {
    step(w, input)
    // 스태미나가 바닥나 붕괴하면 이 측정은 성립하지 않는다 — 호흡정지로 버틴다.
    input.steady = true
  }
  // 떨림·산포를 0으로 만든다: 이 프로브는 **탄도 보정만** 재는 자다.
  a.tremorOffset = 0
  a.strain = 0
  a.stamina = a.staminaMax

  // 손을 떼면 sim 이 쏜다 — release() 를 직접 부르지 않는다.
  input.drawing = false
  step(w, input)

  const arrow = w.arrows.find((ar) => ar.alive)
  if (arrow === undefined) return Number.NaN
  let prevX = arrow.x
  let prevY = arrow.y
  for (let i = 0; i < 4000; i++) {
    step(w, input)
    w.events.length = 0
    if (arrow.x >= tx) {
      // 선분에서 x=tx 인 지점의 높이로 보간한다.
      const t = arrow.x !== prevX ? (tx - prevX) / (arrow.x - prevX) : 0
      return prevY + (arrow.y - prevY) * t
    }
    if (!arrow.alive) return Number.NaN
    prevX = arrow.x
    prevY = arrow.y
  }
  return Number.NaN
}

const DISTS = [10, 20, 35, 55, 80, 110]
const AIM_Y = 2.0

console.log('신궁 — 집중 프로브 (겨눈 자리에 꽂히는가)\n')
console.log(`  dragComp = ${P.focus.dragComp} · fillTime = ${P.focus.fillTime}s\n`)
console.log(
  '  ' + '거리'.padStart(6) + '과녁반경'.padStart(10) +
  '집중0 오차'.padStart(12) + '집중1 오차'.padStart(12) + '반경대비'.padStart(10) + '  판정',
)
console.log('  ' + '─'.repeat(56))

let fails = 0
for (const d of DISTS) {
  const y0 = shootAt(d, AIM_Y, 0)
  const y1 = shootAt(d, AIM_Y, 1)
  const e0 = Math.abs(y0 - AIM_Y)
  const e1 = Math.abs(y1 - AIM_Y)
  // 그 거리의 과녁 반경 — 40판쯤의 각크기로 잡는다 (가장 작은 축).
  const r = angularSize(40) * Math.hypot(d - HAND_X, AIM_Y - HAND_Y)
  // 집중이 다 찼으면 오차가 과녁 반경 안이어야 "겨눈 자리에 꽂힌다"가 참이다.
  const ok = e1 <= r
  if (!ok) fails++
  console.log(
    '  ' + `${d}m`.padStart(6) + `${r.toFixed(2)}m`.padStart(10) +
    `${e0.toFixed(2)}m`.padStart(12) + `${e1.toFixed(2)}m`.padStart(12) +
    `${(e1 / r).toFixed(2)}`.padStart(10) + `  ${ok ? 'ok' : '✗ 반경 밖'}`,
  )
}

// 집중이 실제로 이득인가 — 0보다 1이 반드시 더 붙어야 한다.
console.log('')
for (const d of DISTS) {
  const e0 = Math.abs(shootAt(d, AIM_Y, 0) - AIM_Y)
  const e1 = Math.abs(shootAt(d, AIM_Y, 1) - AIM_Y)
  if (e1 > e0) {
    fails++
    console.log(`  ✗  ${d}m — 집중을 채웠는데 더 빗나갔다 (${e0.toFixed(2)} → ${e1.toFixed(2)})`)
  }
}
if (fails === 0) console.log('  ok  모든 거리에서 집중이 이득이고, 다 차면 과녁 안이다')

// ── 보정값 훑기 ──
if (process.argv.includes('--sweep')) {
  console.log('\n  dragComp 훑기 (거리별 오차 m, 작을수록 좋다)')
  console.log('  ' + 'comp'.padStart(6) + DISTS.map((d) => `${d}m`.padStart(8)).join('') + '합계'.padStart(9))
  const knob = P.focus as unknown as Record<string, number>
  const orig = knob['dragComp'] as number
  let best = orig
  let bestSum = Infinity
  for (let c = 1; c <= 1.3; c += 0.02) {
    knob['dragComp'] = c
    const errs = DISTS.map((d) => Math.abs(shootAt(d, AIM_Y, 1) - AIM_Y))
    const sum = errs.reduce((s, e) => s + e, 0)
    if (sum < bestSum) { bestSum = sum; best = c }
    console.log('  ' + c.toFixed(2).padStart(6) + errs.map((e) => e.toFixed(2).padStart(8)).join('') + sum.toFixed(2).padStart(9))
  }
  knob['dragComp'] = orig
  console.log(`\n  가장 붙는 값: dragComp = ${best.toFixed(2)} (오차 합 ${bestSum.toFixed(2)}m)`)
}

console.log('')
if (fails > 0) {
  console.log(`실패 ${fails}건`)
  process.exit(1)
}
console.log('전부 통과')
