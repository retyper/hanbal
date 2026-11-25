// 열전 치명 마무리 「얼었다가 펑」 (11-25 형: 크리티컬 킬은 스매시브라더스 참고 · docs/realm/RAID-CRIT-KILL-20261125.md)
// 판의 셈은 그대로 · 멈추는 것은 걸음 재생(raid-main 이 feel.stopped 일 때 판을 안 돌린다)과 화면뿐
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HAEBI_IMPACT as F, HAEBI_SHOP } from '../src/tune/params.ts'
import { createHaebi, stepHaebi, KITS, type HaebiRun, type Mob, type Kit, type Effect } from '../src/raid/haebi.ts'
import { RaidFeel } from '../src/raid/impact.ts'
import { criticalFinishEvent, criticalFinishFrames, drawCriticalFinishFrames, tagCriticalFinish } from '../src/raid/critical-finish.ts'

const CF = F.criticalFinish, IDLE = { x: 0, y: 0 }, STEP = 1 / 120
function quiet(seed: number, kit: Kit = 'axe') {
  const s = createHaebi(seed, 'stage', kit, { stage: 'forest', simRules: '56B', bonus: { luck: HAEBI_SHOP.luck.max } })
  s.spawn = s.nextElite = s.nextBarrage = 1e5
  for (const k of Object.keys(s.cool) as (keyof HaebiRun['cool'])[]) s.cool[k] = 99
  return s
}
function victim(s: HaebiRun, dx: number, dy = 0, hp = 1, daze = 99): Mob {
  const e: Mob = { id: s.next++, x: s.x + dx, y: s.y + dy, hp, max: hp, kind: 'club', cd: 99, flash: 0, wind: 0, aimX: 0, aimY: 0, act: 0, vx: 0, vy: 0, buff: 0, poison: 0, pdps: 0, daze }
  s.enemies.push(e); return e
}
/** 치명 마무리가 나는 씨앗·판 (행운 최대 · 첫 한 방이 죽이는 치명타) */
function finishRun(kit: Kit = 'axe', extra?: (s: HaebiRun) => void) {
  for (let seed = 1; seed <= 200; seed++) {
    const s = quiet(seed, kit); victim(s, 45); extra?.(s); s.cool[KITS[kit].primary as keyof HaebiRun['cool']] = 0
    const feel = new RaidFeel(); feel.observe(s)
    for (let i = 0; i < 30; i++) { stepHaebi(s, IDLE, STEP); feel.observe(s); const f = s.fx.find(x => x.kind === 'death' && criticalFinishEvent(x)); if (f) return { s, feel, f, seed } }
  }
  assert.fail('치명 마무리가 200 씨앗 안에 안 났다')
}
/** raid-main 프레임 흉내: 걸음은 feel.stopped 가 아닐 때만 · 한 프레임 1/60 초(벽시계) */
function frame(s: HaebiRun, feel: RaidFeel, onStep?: () => void) {
  feel.observe(s); feel.advance(1 / 60, true)
  for (let i = 0; i < 2 && !feel.stopped; i++) { stepHaebi(s, IDLE, STEP); feel.observe(s); onStep?.() }
}

test('큰 마무리: 죽이는 치명타 순간 bigHold(.25초 = 15프레임) 동안 판이 선다 · 풀리면 제 속도로 · 소리·진동 신호는 풀리는 순간 한 번', () => {
  const { s, feel, f } = finishRun()
  assert.ok(feel.isBig(f), '큰 마무리로 뽑힘')
  assert.ok(feel.stopped); assert.ok(Math.abs(feel.stopRemaining - CF.bigHold) < 2 / 120 + 1e-9, `남은 ${feel.stopRemaining}`)
  const frozen = () => JSON.stringify([s.x, s.y, s.t, s.fx.map(x => [x.x, x.y, x.life]), s.shots.map(b => [b.x, b.y, b.life]), s.enemies.map(e => [e.x, e.y]), s.drops.map(d => [d.x, d.y, d.age])])
  const at = frozen(); let frames = 0, pops = 0
  while (feel.stopped && frames < 60) { frame(s, feel); frames++; if (feel.stopped) assert.equal(frozen(), at, '얼어 있는 동안 아무것도 안 움직인다') ; if (feel.consumePop()) pops++ }
  assert.ok(Math.abs(frames / 60 - CF.bigHold) <= 1 / 60 + 1e-9, `멈춤 ${frames} 프레임 = ${(frames / 60 * 1000).toFixed(0)}ms`)
  assert.ok(feel.shake === 0 || feel.shake <= F.shakeMax)
  while (!pops && frames < 90) { frame(s, feel); frames++; if (feel.consumePop()) pops++ }
  assert.equal(pops, 1, '펑 신호는 한 번'); assert.ok(!feel.consumePop())
  // 풀린 뒤 한 프레임에 건너뛰는 거리가 없다: 한 프레임 이동 = 일반 프레임 이동
  const e = victim(s, 300, 0, 1e6, 0); e.cd = 0
  const x0 = e.x; frame(s, feel); const first = Math.abs(e.x - x0)
  const x1 = e.x; frame(s, feel); const next = Math.abs(e.x - x1)
  assert.ok(first <= next * 1.01 + 1e-9 && first > 0, `풀린 프레임 이동 ${first} 일반 ${next}`)
})

test('큰 마무리는 판의 셈을 안 바꾼다 — 얼리든 안 얼리든 같은 걸음 수 뒤 판이 글자 하나까지 같다', () => {
  const run = (gate: boolean) => {
    const { s, feel } = finishRun('axe', x => { victim(x, 200, 60, 1e6, 0); victim(x, -150, 90, 1e6, 0) })
    for (let steps = 0; steps < 240;) { if (gate) { feel.observe(s); feel.advance(1 / 60, true); if (feel.stopped) continue } stepHaebi(s, IDLE, STEP); steps++ }
    return JSON.stringify(s)
  }
  assert.equal(run(true), run(false))
})

function mark(s: HaebiRun, n: number, x = 100) {
  const f: Effect = { kind: 'death', x, y: 100, x2: x, y2: 100, r: 25, angle: 0, life: .45, total: .45, color: '#fff', mob: 'club', face: 1, n, crit: true }
  tagCriticalFinish(f, 1); s.fx.push(f); return f
}
test('잦기: 큰 것은 bigGap 초에 한 번 · 사이의 마무리는 가볍게 · 한 번에 여럿이 죽으면 가장 센 한 놈만', () => {
  const s = quiet(3), feel = new RaidFeel(); feel.observe(s)
  const a = mark(s, 100), b = mark(s, 300), c = mark(s, 200)
  feel.observe(s)
  assert.ok(feel.isBig(b) && !feel.isBig(a) && !feel.isBig(c), '가장 센 한 놈만')
  assert.ok(feel.stopped)
  for (let i = 0; i < 20; i++) { feel.advance(.05, true) }   // 1초 뒤 (큰 멈춤은 풀렸다)
  const d = mark(s, 500); feel.observe(s)
  assert.ok(!feel.isBig(d), 'bigGap 안의 마무리는 가볍게'); assert.ok(!feel.stopped || feel.stopRemaining <= F.criticalStop + 1e-9)
  for (let i = 0; i < 20 * CF.bigGap; i++) feel.advance(.05, true)
  const e = mark(s, 50); feel.observe(s)
  assert.ok(feel.isBig(e), 'bigGap 이 지나면 다시 큰 마무리'); assert.ok(feel.stopRemaining > CF.bigHold * .9)
})

test('그림: 큰 마무리는 얼어 있는 동안 제 자리에서 부풀고 · 한 겹 어둡게 깐 뒤 맞은 놈을 그리고 · 풀리면 날아간다 · filter·그라디언트 없음', () => {
  const s = quiet(3), f = mark(s, 100)
  const view = { left: 0, top: 0, right: 960, bottom: 540 }
  const ops: string[] = []
  const ctx = new Proxy({} as Record<string, unknown>, { get: (t, k) => typeof k === 'string' && !(k in t) ? (...a: unknown[]) => { ops.push(k + (a.length && typeof a[0] === 'number' ? '' : '')); return undefined } : t[k as string], set: (t, k, v) => { if (typeof k === 'string') ops.push('=' + k); t[k as string] = v; return true } }) as unknown as CanvasRenderingContext2D
  const draw = (time: number) => { ops.length = 0; const frames = criticalFinishFrames(s, s.fx, time, true, false, CF, () => true); drawCriticalFinishFrames(ctx, frames, () => { ops.push('MOB') }, undefined, { view, p: CF }); return frames }
  let frames = draw(0); assert.ok(frames[0]!.big)
  assert.equal(ops.indexOf('fillRect') >= 0 && ops.indexOf('fillRect') < ops.indexOf('MOB'), true, '어둡게 깐 뒤 맞은 놈')
  assert.ok(ops.filter(o => o === 'MOB').length >= 2, '번쩍(겹침)')
  const xs = [0, CF.bigHold * .5, CF.bigHold * .99].map(t => criticalFinishFrames(s, s.fx, t, true, false, CF, () => true)[0]!.poses.at(-1)!)
  assert.ok(xs.every(p => p.x === xs[0]!.x && p.y === xs[0]!.y), '얼어 있는 동안 자리 고정')
  assert.ok(xs[1]!.scale > xs[0]!.scale && xs[1]!.scale <= CF.holdScaleBig + 1e-9, '살짝 커짐')
  frames = draw(CF.bigHold + .1); assert.ok(!ops.includes('fillRect'), '풀린 뒤엔 어둡게 안 함')
  assert.ok(ops.includes('arc') && ops.includes('stroke'), '펑 하는 테')
  const after = criticalFinishFrames(s, s.fx, CF.bigHold + .1, true, false, CF, () => true)[0]!.poses.at(-1)!
  assert.ok(after.x > xs[0]!.x, '풀리면 날아간다')
  assert.ok(!ops.some(o => /filter|Gradient|shadowBlur/.test(o)), '폰 그래픽 한도 — filter·그라디언트·번짐 없음')
  void f
})
