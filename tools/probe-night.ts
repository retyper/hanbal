/**
 * 밤의 암살판 손맛 프로브 — 헤드리스로 쏴 본다 (src/night/sim.ts)
 *
 *   node --experimental-strip-types tools/probe-night.ts [seed]
 *
 * 판마다 보초 하나하나를 향해 각을 훑어 **머리에 맞는 각**을 찾고, 같은 시드·같은 각이면 같은 결과인지 본다.
 * 빨간 바 위(지치기 전)에서 만작으로 놓으므로 오차 0 — 각만 맞으면 맞아야 한다 (빨간 바 계약).
 */
import { createNight, stepNight, type Night } from '../src/night/sim.ts'
import { P } from '../src/tune/params.ts'
import type { InputFrame } from '../src/sim/types.ts'

const seed = Number(process.argv[2] ?? 7)

/** 한 발 — 만작까지 당겼다 놓고 살이 끝날 때까지 돌린다. 이 발에서 난 사건들을 돌려준다 */
export function shoot(n: Night, angle: number): string[] {
  const a = n.w.archer
  const input: InputFrame = { aimX: a.x + Math.cos(angle) * 10, aimY: a.y + Math.sin(angle) * 10, drawing: false, steady: false, parry: false }
  const from = n.events.length
  // 쉬어서 스태미나를 채운다 (빨간 바 위)
  for (let i = 0; i < P.sim.hz * 2 && a.stamina < a.staminaMax * 0.95; i++) stepNight(n, input)
  input.drawing = true
  for (let i = 0; i < P.sim.hz * 2 && a.phase !== 'full'; i++) stepNight(n, input)
  stepNight(n, input)
  input.drawing = false
  for (let i = 0; i < P.sim.hz * 4; i++) {
    stepNight(n, input)
    if (!n.w.arrows.some((x) => x.alive && x.outcome === 'flying')) break
  }
  return n.events.slice(from).map((e) => e.t)
}

/** 처음 상태에서 이 각으로 쏘면 보초 id 가 머리에 맞나 */
function headAngle(stage: number, id: number): number | null {
  for (let ang = -0.8; ang <= 0.35; ang += 0.0015) {
    const n = createNight({ seed, practice: { stage, alarm: false, infinite: true } })
    shoot(n, ang)
    const f = n.scene.figures[id]
    if (f !== undefined && !f.alive && f.hitZone === 'head') return ang
  }
  return null
}

for (const stage of [0, 1, 2, 3]) {
  const n0 = createNight({ seed, practice: { stage, alarm: false, infinite: true } })
  const line: string[] = []
  for (const f of n0.scene.figures) {
    if (f.role !== 'guard' || f.patrol !== null) continue
    const ang = headAngle(stage, f.id)
    if (ang === null) {
      line.push(`#${f.id}(${f.x.toFixed(1)}m) 머리각 없음`)
      continue
    }
    // 같은 각을 두 번 — 결정론
    const a = createNight({ seed, practice: { stage, alarm: false, infinite: true } })
    const b = createNight({ seed, practice: { stage, alarm: false, infinite: true } })
    const ea = shoot(a, ang).join(',')
    const eb = shoot(b, ang).join(',')
    line.push(`#${f.id}(${f.x.toFixed(1)}m) ${(ang * 180 / Math.PI).toFixed(2)}° ${ea === eb ? '같음' : '다름!'} [${ea}]`)
  }
  console.log(`판 ${stage + 1} ${n0.scene.title}: ${line.join(' · ')}`)
}

// 경보 — 담에 일부러 여러 발 쏘면 게이지가 차서 북이 울리나
{
  const n = createNight({ seed, arrows: 20 })
  let shots = 0
  while (n.result === null && shots < 20) {
    shoot(n, -0.05) // 멀리 흙으로
    shots++
  }
  for (let i = 0; i < P.sim.hz * 3 && n.result === null; i++) stepNight(n, { aimX: 10, aimY: 0, drawing: false, steady: false, parry: false })
  console.log(`헛살 ${shots}발 → 게이지 ${n.alarm.toFixed(2)} · 결과 ${JSON.stringify(n.result)}`)
}
