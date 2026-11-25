import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { P } from '../../src/tune/params.ts'
import { audible, eventsFromDiff, newSoundState, stepSound } from '../../src/field/mainSoundModel.ts'
import type { SoundCam, SoundEngineEvent, SoundEvent, SoundFrame, SoundSquad } from '../../src/field/mainSoundModel.ts'

const U = P.field.unit
const cell = (c: number): number => c * U
/** 판 px 로 본 한 칸 */
const px = (c: number): number => c * P.field.cellPx

function sq(id: number, side: 0 | 1, grp: SoundSquad['grp'], uCells: number, vCells: number, o: Partial<SoundSquad> = {}): SoundSquad {
  return { id, side, grp, men: 400, u: cell(uCells), v: cell(vCells), stance: 0, lock: -1, target: -1, ran: 0, flee: 0, aim: -1, order: 0, ...o }
}
const frame = (tick: number, squads: SoundSquad[], o: Partial<SoundFrame> = {}): SoundFrame =>
  ({ tick, squads, pieces: [], edge: [1000, 1000], end: null, winner: -1, ...o })
/** 엔진 사건 한 칸 (tick = 사건이 난 틱) */
const ee = (tick: number, kind: string, o: Partial<SoundEngineEvent> = {}): SoundEngineEvent => ({ tick, kind, side: 0, id: 0, u: cell(41), v: cell(10), n: 0, to: -1, how: 0, ...o })
/** 화면 가운데가 u 칸 · v 칸인 카메라 (폭 844 × 390 · 맞춤 배율) */
const camAt = (uCells: number, vCells: number, zoomRel = 1): SoundCam => ({ x: px(uCells), y: px(vCells), zoom: 1 * zoomRel, vpW: 844, vpH: 390, zoomRel })

/** 한 프레임 돌리기 — events 를 안 주면 차이에서 뽑는다 */
function run(st = newSoundState(), steps: { f: SoundFrame; cam: SoundCam; ev?: SoundEvent[]; now: number; hidden?: boolean }[]) {
  let s = st
  const outs = []
  for (const x of steps) {
    const ev = x.ev ?? eventsFromDiff(s.last, x.f)
    const o = stepSound(s, x.f, x.cam, ev, x.now, x.hidden ?? false)
    s = o.state
    outs.push(o)
  }
  return outs
}

test('돌격이 처음 맞물린 틱에 같은 프레임으로 부딪힘 쾅 요청이 나온다', () => {
  const sqs = [sq(0, 0, 'front', 40, 10), sq(1, 1, 'front', 43, 10)]
  const a0 = frame(0, sqs)
  const a1 = frame(1, [sq(0, 0, 'front', 40, 10, { aim: 1, lock: 1 }), sq(1, 1, 'front', 43, 10, { aim: 0, lock: 0 })], { events: [ee(0, 'impact', { id: 0, n: 800 })] })
  const cam = camAt(41, 10)
  const [o0, o1] = run(newSoundState(), [{ f: a0, cam, now: 0 }, { f: a1, cam, now: 100 }])
  assert.equal(o0!.plays.filter(p => p.slot === 'impact').length, 0)
  const hit = o1!.plays.filter(p => p.slot === 'impact')
  assert.equal(hit.length, 1)
  assert.ok(hit[0]!.vol > 0)
})

test('쾅의 세기는 사건의 사람 수에 비례한다', () => {
  const mk = (n: number) => {
    const a0 = frame(0, [sq(0, 0, 'front', 40, 10)]), a1 = frame(1, [sq(0, 0, 'front', 40, 10)], { events: [ee(0, 'impact', { n })] })
    return run(newSoundState(), [{ f: a0, cam: camAt(41, 10), now: 0 }, { f: a1, cam: camAt(41, 10), now: 100 }])[1]!.plays.find(p => p.slot === 'impact')!.vol
  }
  assert.ok(mk(50) < mk(300))
  assert.ok(mk(300) <= mk(1500))
})

test('쾅의 세 가지: 보통은 쾅만 · 상성이 맞으면 세게 + 북 한 번 · 막히면 같은 소리를 낮고 작게', () => {
  const one = (how: number) => {
    const a0 = frame(0, [sq(0, 0, 'front', 40, 10)]), a1 = frame(1, [sq(0, 0, 'front', 40, 10)], { events: [ee(0, 'impact', { n: 600, how })] })
    return run(newSoundState(), [{ f: a0, cam: camAt(41, 10), now: 0 }, { f: a1, cam: camAt(41, 10), now: 100 }])[1]!.plays
  }
  const normal = one(0), good = one(1), blocked = one(2)
  assert.equal(normal.filter(p => p.slot === 'war_drums').length, 0)
  assert.equal(good.filter(p => p.slot === 'war_drums').length, 1)
  assert.equal(blocked.filter(p => p.slot === 'war_drums').length, 0)
  const nv = normal.find(p => p.slot === 'impact')!, bv = blocked.find(p => p.slot === 'impact')!
  assert.ok(bv.vol < nv.vol)
  assert.ok(bv.rate < nv.rate)
  assert.equal(nv.rate, 1)
})

test('같은 무리의 쾅은 impactRepeatMs 뒤에야 다시 나고 다른 무리는 곧바로', () => {
  const sqs = [sq(0, 0, 'front', 40, 10), sq(1, 1, 'front', 43, 10)]
  const tick = (t: number, id: number) => frame(t, sqs, { events: [ee(t - 1, 'impact', { id, n: 400 })] })
  const rep = Math.round(P.field.impactRepeatMs * P.field.hz / 1000)
  const cam = camAt(41, 10)
  const outs = run(newSoundState(), [
    { f: frame(0, sqs), cam, ev: [], now: 0 },
    { f: tick(1, 0), cam, now: 1000 },
    { f: tick(2, 0), cam, now: 5000 },          // 같은 무리 · 틱으로 보면 1 틱 뒤 · 소리 쪽 간격은 지났다
    { f: tick(2 + rep, 0), cam, now: 9000 },    // 같은 무리 · 충분히 뒤
    { f: tick(3 + rep, 1), cam, now: 13000 },   // 다른 무리
  ])
  const n = (i: number) => outs[i]!.plays.filter(p => p.slot === 'impact').length
  assert.equal(n(1), 1)
  assert.equal(n(2), 0)
  assert.equal(n(3), 1)
  assert.equal(n(4), 1)
})

test('동시 소리 수는 상한을 넘지 않는다', () => {
  const sqs: SoundSquad[] = []
  for (let i = 0; i < 12; i++) sqs.push(sq(i, i % 2 as 0 | 1, i % 3 === 0 ? 'horse' : 'front', 40 + i, 10))
  const f0 = frame(0, sqs)
  const moved = sqs.map(q => ({ ...q, u: q.u + 100 }))
  const f1 = frame(1, moved)
  const ev: SoundEvent[] = []
  for (const k of ['charge', 'hold', 'open', 'horse', 'move'] as const) ev.push({ kind: 'flag', flag: k })
  for (let i = 0; i < 10; i++) ev.push({ kind: 'impact', u: cell(40 + i), v: cell(10), power: 500 }, { kind: 'volley', u: cell(40 + i), v: cell(10) })
  const o = run(newSoundState(), [{ f: f0, cam: camAt(45, 10), ev: [], now: 0 }, { f: f1, cam: camAt(45, 10), ev, now: 1000 }])[1]!
  assert.ok(o.plays.length <= P.field.soundVoicesMax)
  assert.ok(o.plays.length > 0)
})

test('같은 소리는 최소 간격 안에 되풀이되지 않는다', () => {
  const f = frame(1, [sq(0, 0, 'front', 40, 10)])
  const ev: SoundEvent[] = [{ kind: 'impact', u: cell(40), v: cell(10), power: 800 }]
  const cam = camAt(40, 10)
  const outs = run(newSoundState(), [
    { f, cam, ev, now: 1000 },
    { f, cam, ev, now: 1000 + P.field.soundGapImpactMs - 50 },
    { f, cam, ev, now: 1000 + P.field.soundGapImpactMs + 50 },
  ])
  assert.equal(outs[0]!.plays.filter(p => p.slot === 'impact').length, 1)
  assert.equal(outs[1]!.plays.filter(p => p.slot === 'impact').length, 0)
  assert.equal(outs[2]!.plays.filter(p => p.slot === 'impact').length, 1)
})

/** 기병 한 대가 한 틱에 cellsPerSec 로 가는 두 프레임 */
function horseLoop(cellsPerSec: number, ran = 1) {
  const step = cellsPerSec * U / P.field.hz
  const f0 = frame(0, [sq(0, 0, 'horse', 10, 10), sq(1, 1, 'front', 100, 10)])
  const f1 = frame(1, [sq(0, 0, 'horse', 10, 10, { u: cell(10) + step, ran }), sq(1, 1, 'front', 100, 10)])
  const cam = camAt(10, 10)
  return run(newSoundState(), [{ f: f0, cam, ev: [], now: 0 }, { f: f1, cam, ev: [], now: 100 }])[1]!
}

test('기병 걸음 빠르기가 2배면 말발굽 박자 배율도 2배', () => {
  const slow = horseLoop(4), fast = horseLoop(8)
  const ls = slow.loops.find(l => l.slot === 'hoof_gallop')!, lf = fast.loops.find(l => l.slot === 'hoof_gallop')!
  assert.ok(ls !== undefined && lf !== undefined)
  assert.ok(Math.abs(lf.beatMul / ls.beatMul - 2) < 1e-6)
  assert.ok(Math.abs(ls.beatMs / lf.beatMs - 2) < 1e-6)
})

test('기병은 걸을 때 걷는 발굽, 돌격으로 달리면(ran) 질주 발굽, 달아나도 질주', () => {
  assert.ok(horseLoop(2, 0).loops.some(l => l.slot === 'hoof_walk'))
  assert.ok(horseLoop(2, 1).loops.some(l => l.slot === 'hoof_gallop'))
  assert.ok(horseLoop(8, 0).loops.some(l => l.slot === 'hoof_walk'))
})

test('질주가 시작되는 순간 말 울음(horse_start)이 한 번', () => {
  const step = 8 * U / P.field.hz
  const mk = (t: number, ran: number) => frame(t, [sq(0, 0, 'horse', 10, 10, { u: cell(10) + t * step, ran }), sq(1, 1, 'front', 100, 10)])
  const cam = camAt(10, 10)
  const outs = run(newSoundState(), [
    { f: mk(0, 0), cam, ev: [], now: 0 }, { f: mk(1, 1), cam, ev: [], now: 100 }, { f: mk(2, 1), cam, ev: [], now: 200 },
  ])
  assert.equal(outs[1]!.plays.filter(p => p.slot === 'horse_start').length, 1)
  assert.equal(outs[2]!.plays.filter(p => p.slot === 'horse_start').length, 0)
})

test('걷는 보병과 달리는(ran) 보병 · 달아나는(flee) 보병은 다른 이어지는 소리', () => {
  const step = 3 * U / P.field.hz
  const mk = (t: number, o: Partial<SoundSquad>) => frame(t, [sq(0, 0, 'front', 10, 10, { u: cell(10) + t * step, ...o }), sq(1, 1, 'front', 100, 10)])
  const cam = camAt(10, 10)
  const at = (o: Partial<SoundSquad>) => run(newSoundState(), [{ f: mk(0, o), cam, ev: [], now: 0 }, { f: mk(1, o), cam, ev: [], now: 100 }])[1]!
  const walk = at({}), ran = at({ ran: 1 }), flee = at({ flee: 1 })
  assert.ok(walk.loops.some(l => l.base === 'step_walk') && !walk.loops.some(l => l.base === 'step_run'))
  assert.ok(ran.loops.some(l => l.base === 'step_run') && !ran.loops.some(l => l.base === 'step_walk'))
  assert.ok(flee.loops.some(l => l.base === 'step_run'))
})

test('걷는 사람이 많을수록 이어지는 소리가 커진다 (상한 안에서)', () => {
  const step = 3 * U / P.field.hz
  const mk = (men: number) => {
    const f = (t: number) => frame(t, [sq(0, 0, 'front', 10, 10, { u: cell(10) + t * step, stance: 1, men }), sq(1, 1, 'front', 100, 10)])
    return run(newSoundState(), [{ f: f(0), cam: camAt(10, 10), ev: [], now: 0 }, { f: f(1), cam: camAt(10, 10), ev: [], now: 100 }])[1]!.loops.find(l => l.base === 'step_walk')!.vol
  }
  assert.ok(mk(20) < mk(200))
  assert.ok(mk(200) < mk(400))
  assert.equal(mk(800), mk(2000))
})

test('화면 왼쪽 소리는 pan 음수 · 오른쪽은 양수 · 가운데는 0 근처', () => {
  const cam = camAt(100, 10)
  const f = frame(1, [])
  const at = (uc: number) => run(newSoundState(), [{ f, cam, ev: [{ kind: 'clash', u: cell(uc), v: cell(10) }], now: 1000 }])[0]!.plays.find(p => p.slot === 'clash')!.pan
  assert.ok(at(90) < 0)
  assert.ok(at(110) > 0)
  assert.ok(Math.abs(at(100)) < 1e-9)
  assert.ok(Math.abs(at(60)) <= P.field.soundPanMaxPct / 100)
})

test('화면 밖 먼 소리는 작고 가까이 보면 커진다', () => {
  const cam = camAt(100, 10)
  const near = audible(cam, cell(100), cell(10)).gain
  const off = audible(cam, cell(100) + cell(60), cell(10)).gain
  const farOff = audible(cam, cell(100) + cell(400), cell(10)).gain
  assert.ok(off < near)
  assert.ok(farOff <= off)
  assert.ok(farOff >= P.field.soundOffMinPct / 100 * P.field.soundZoomFarPct / 100 - 1e-9)
  const zoomed = audible(camAt(100, 10, P.field.zoomNear / 100), cell(100), cell(10)).gain
  assert.ok(zoomed > near)
})

test('숨은 탭이면 요청 0 · 돌아와도 밀린 소리를 몰아 틀지 않는다', () => {
  const a = frame(0, [sq(0, 0, 'front', 40, 10), sq(1, 1, 'front', 43, 10)])
  const b = frame(5, [sq(0, 0, 'front', 40, 10, { lock: 1 }), sq(1, 1, 'front', 43, 10, { lock: 0 })])
  const c = frame(6, [sq(0, 0, 'front', 40, 10, { lock: 1 }), sq(1, 1, 'front', 43, 10, { lock: 0 })])
  const cam = camAt(41, 10)
  const ev: SoundEvent[] = [{ kind: 'impact', u: cell(41), v: cell(10), power: 900 }, { kind: 'flag', flag: 'charge' }]
  const outs = run(newSoundState(), [
    { f: a, cam, ev: [], now: 0 },
    { f: b, cam, ev, now: 500, hidden: true },
    { f: c, cam, now: 600 },
  ])
  assert.equal(outs[1]!.plays.length, 0)
  assert.equal(outs[1]!.loops.length, 0)
  assert.equal(outs[2]!.plays.filter(p => p.slot === 'impact' || p.slot === 'flag_charge').length, 0)
})

test('같은 입력 두 번 → 같은 목록 (결정론)', () => {
  const mk = () => {
    const a0 = frame(0, [sq(0, 0, 'front', 40, 10), sq(1, 1, 'front', 43, 10), sq(2, 0, 'horse', 20, 12)])
    const a1 = frame(1, [sq(0, 0, 'front', 40, 10, { lock: 1 }), sq(1, 1, 'front', 43, 10, { lock: 0 }), sq(2, 0, 'horse', 20, 12, { u: cell(20) + 200 })])
    return run(newSoundState(), [{ f: a0, cam: camAt(41, 10), now: 0 }, { f: a1, cam: camAt(41, 10), now: 100 }, { f: a1, cam: camAt(41, 10), now: 700 }])
  }
  assert.deepEqual(JSON.stringify(mk()), JSON.stringify(mk()))
})

test('쾅이 나면 이어지는 소리가 잠깐 낮아진다', () => {
  const step = 3 * U / P.field.hz
  const mk = (t: number, events: SoundEngineEvent[]) => frame(t, [sq(0, 0, 'front', 10, 10, { u: cell(10) + t * step, stance: 1 }), sq(90, 1, 'front', 100, 10)], { events })
  const cam = camAt(25, 10)
  const quiet = run(newSoundState(), [{ f: mk(0, []), cam, ev: [], now: 0 }, { f: mk(1, []), cam, ev: [], now: 100 }])[1]!.loops.find(l => l.base === 'step_walk')!.vol
  const ducked = run(newSoundState(), [{ f: mk(0, []), cam, ev: [], now: 0 }, { f: mk(1, [ee(0, 'impact', { n: 500, u: cell(40), v: cell(10) })]), cam, now: 100 }])[1]!
  assert.ok(ducked.loops.find(l => l.base === 'step_walk')!.vol < quiet)
  assert.ok(ducked.plays.some(p => p.slot === 'impact'))
})

test('엔진 사건이 소리 사건이 된다: 문 부서짐 · 무너짐 · 화살 · 장수 · 끝 (예고 omen 은 소리 없음)', () => {
  const s0 = [sq(0, 0, 'front', 40, 10), sq(1, 1, 'front', 60, 10)]
  const a = frame(0, s0)
  const b = frame(1, s0, { events: [ee(0, 'gateBreak'), ee(0, 'rout'), ee(0, 'volley'), ee(0, 'heroDash'), ee(0, 'heroSkill'), ee(0, 'artHit'), ee(0, 'omen'), ee(0, 'heroDown'), ee(0, 'loss', { to: 1, how: 0 })] })
  assert.deepEqual(eventsFromDiff(a, b).map(e => e.kind).sort(), ['artHit', 'gateBreak', 'heroDash', 'heroSkill', 'rout', 'volley'])
  const c = frame(2, s0, { end: 'morale', winner: 0 })
  assert.deepEqual(eventsFromDiff(b, c), [{ kind: 'end', win: true }])
  // 앞뒤 틱 밖의 사건은 읽지 않는다 (이미 소리 낸 것을 되풀이하지 않는다)
  const d = frame(5, s0, { events: [ee(0, 'rout'), ee(3, 'volley'), ee(5, 'rout')] })
  assert.deepEqual(eventsFromDiff(b, d).map(e => e.kind), ['volley'])
})

test('사건은 형이 고른 소리 자리로 간다 (같은 프레임 · 한 프레임 소리 상한 때문에 둘로 나눠 본다)', () => {
  const s0 = [sq(0, 0, 'front', 40, 10), sq(1, 1, 'front', 41, 10)]
  const cam = camAt(41, 10)
  const slots = (evs: SoundEngineEvent[]) => run(newSoundState(), [{ f: frame(0, s0), cam, ev: [], now: 0 }, { f: frame(1, s0, { events: evs }), cam, now: 100 }])[1]!.plays.map(p => p.slot)
  const A = slots([ee(0, 'gateBreak'), ee(0, 'rout'), ee(0, 'volley'), ee(0, 'heroDash')])
  for (const w of ['gate', 'rout', 'arrow_volley', 'hero_dash']) assert.ok(A.includes(w as never), w)
  const B = slots([ee(0, 'heroSkill'), ee(0, 'loss', { to: 1, how: 1 }), ee(0, 'flankHit')])
  for (const w of ['hero_art', 'arrow_hit', 'war_drums']) assert.ok(B.includes(w as never), w)
})

test('틱이 안 바뀐 프레임에는 사건이 없다 (같은 틱을 두 번 읽어도 쾅은 한 번)', () => {
  const a = frame(3, [sq(0, 0, 'front', 40, 10, { lock: 1 }), sq(1, 1, 'front', 43, 10, { lock: 0 })])
  assert.deepEqual(eventsFromDiff(a, a), [])
})

test('화살이 맞은 대(loss 화살)에서 꽂히는 소리 · 칼 몫은 소리가 없다', () => {
  const s0 = [sq(0, 0, 'bows', 40, 10, { target: 1 }), sq(1, 1, 'front', 60, 10)]
  const hit = (how: number) => {
    const [, o] = run(newSoundState(), [{ f: frame(0, s0), cam: camAt(50, 10), ev: [], now: 0 }, { f: frame(1, s0, { events: [ee(0, 'loss', { id: 0, to: 1, how, n: 5 })] }), cam: camAt(50, 10), now: 100 }])
    return o!.plays.filter(p => p.slot === 'arrow_hit')
  }
  assert.equal(hit(1).length, 1)
  assert.equal(hit(0).length, 0)
  assert.ok(hit(1)[0]!.pan > 0)  // 맞은 대(60칸)는 화면 가운데(50칸)보다 오른쪽
})

test('모델 파일에 난수·시계·DOM 이 없다', () => {
  const text = fs.readFileSync(path.resolve(import.meta.dirname, '../../src/field/mainSoundModel.ts'), 'utf8')
  const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  assert.deepEqual(code.match(/Math\.random|Date\.now|performance\.now|\bdocument\b|\bwindow\b|localStorage|setTimeout|setInterval|requestAnimationFrame/g) ?? [], [])
})

test('이어지는 소리 파일의 재생 빠르기는 박자 배율을 따른다 (하한·상한 안에서)', async () => {
  const { loopTargets } = await import('../../src/field/mainSoundModel.ts')
  const a = loopTargets(horseLoop(5).loops).find(t => t.slot === 'hoof_gallop')!
  const b = loopTargets(horseLoop(7.5).loops).find(t => t.slot === 'hoof_gallop')!
  assert.ok(Math.abs(b.rate / a.rate - 1.5) < 1e-6)
  const slow = loopTargets(horseLoop(1, 0).loops)[0]!, fast = loopTargets(horseLoop(30).loops)[0]!
  assert.ok(Math.abs(slow.rate - P.field.soundLoopRateMinPct / 100 * P.field.soundHoofWalkRatePct / 100) < 1e-9)
  assert.equal(fast.rate, P.field.soundLoopRateMaxPct / 100)
  assert.ok(a.gain > 0 && a.gain <= 1)
})

test('형이 고른 일곱 자리가 모두 파일로 이어진다 (본편 표 · 새 파일)', async () => {
  const { fileOf, FIELD_FILE, PICKED } = await import('../../src/field/mainSound.ts')
  const root = path.resolve(import.meta.dirname, '../../public')
  const all = Object.keys(PICKED) as (keyof typeof PICKED)[]
  for (const s of all) {
    const url = fileOf(s, '/')
    assert.ok(url !== null, String(s))
    const file = path.join(root, url!.slice(1))
    assert.ok(fs.statSync(file).size > 1000, String(s) + ' ' + file)
  }
  assert.ok(String(fileOf('impact', '/')).endsWith('battle_crit_g3.mp3'))
  assert.ok(String(fileOf('rout', '/')).endsWith('war_cry_h1.mp3'))
  assert.equal(FIELD_FILE.hoof_walk, FIELD_FILE.hoof_gallop)
  assert.equal(FIELD_FILE.arrow_hit, 'sfx/field_arrow_hit_b.ogg')
})

test('고르기 판이 가리키는 소리 파일이 모두 있고 0바이트가 아니다', () => {
  const root = path.resolve(import.meta.dirname, '../../public/realm')
  const html = fs.readFileSync(path.join(root, 'field-sounds.html'), 'utf8')
  const names = new Set<string>()
  for (const m of html.matchAll(/(?:N|E)\('[^']*', '([^']+)'/g)) names.add(m[1]!)
  assert.ok(names.size >= 25)
  for (const n of names) assert.ok(fs.statSync(path.join(root, 'sfx', n)).size > 1000, n)
})

/** 한 줄로 걷는 보병 한 대 (men 명) 가 두 틱 걸은 프레임 쌍 */
function walkers(men: number, stance = 1, n = 1) {
  const step = 3 * U / P.field.hz
  const mk = (t: number) => frame(t, [...Array.from({ length: n }, (_, i) => sq(i, 0, 'front', 10 + i, 10, { u: cell(10 + i) + t * step, stance, men, ran: stance === 0 ? 1 : 0 })), sq(90, 1, 'front', 100, 10)])
  return { a: mk(0), b: mk(1), c: mk(2), d: mk(3) }
}
const tierOfWalk = (men: number, n = 1): number | undefined => {
  const w = walkers(men, 1, n), cam = camAt(10, 10)
  const o = run(newSoundState(), [{ f: w.a, cam, ev: [], now: 0 }, { f: w.b, cam, ev: [], now: 100 }])[1]!
  return o.loops.find(l => l.base === 'step_walk')?.tier
}

test('걷는 사람 수에 따라 발소리 단계가 갈린다 (적음 · 보통 · 많음)', () => {
  assert.equal(tierOfWalk(100), 0)
  assert.equal(tierOfWalk(P.field.soundTierMidMen - 1), 0)
  assert.equal(tierOfWalk(P.field.soundTierMidMen), 1)
  assert.equal(tierOfWalk(P.field.soundTierManyMen - 1), 1)
  assert.equal(tierOfWalk(P.field.soundTierManyMen), 2)
})

test('문턱 근처에서는 내려갈 때 조금 더 내려가야 단계가 바뀐다 (되풀이 방지)', async () => {
  const { tierOf } = await import('../../src/field/mainSoundModel.ts')
  const mid = P.field.soundTierMidMen
  assert.equal(tierOf(undefined, mid - 1), 0)
  assert.equal(tierOf(1, mid - 1), 1)
  assert.equal(tierOf(1, Math.floor(mid * (1 - P.field.soundTierHystPct / 100)) - 1), 0)
})

test('단계가 바뀌는 동안 두 고리가 겹쳐 나가고 그 뒤에는 하나', () => {
  const cam = camAt(10, 10), step = 3 * U / P.field.hz
  const mk = (t: number, men: number) => frame(t, [sq(0, 0, 'front', 10, 10, { u: cell(10) + t * step, stance: 1, men }), sq(90, 1, 'front', 100, 10)])
  const x = P.field.soundTierXfadeMs
  const outs = run(newSoundState(), [
    { f: mk(0, 300), cam, ev: [], now: 0 }, { f: mk(1, 300), cam, ev: [], now: 100 },
    { f: mk(2, 600), cam, ev: [], now: 1000 },          // 보통으로 올라선 첫 프레임
    { f: mk(3, 600), cam, ev: [], now: 1000 + x / 2 },  // 겹치는 중
    { f: mk(4, 600), cam, ev: [], now: 1000 + x + 50 }, // 끝난 뒤
  ])
  const walk = (i: number) => outs[i]!.loops.filter(l => l.base === 'step_walk')
  assert.equal(walk(1).length, 1)
  assert.equal(walk(2).length, 2)
  assert.deepEqual(walk(3).map(l => l.tier).sort(), [0, 1])
  assert.ok(walk(3).every(l => l.vol > 0))
  assert.equal(walk(4).length, 1)
  assert.equal(walk(4)[0]!.tier, 1)
  const t0 = walk(2).find(l => l.tier === 0)!.vol, t1 = walk(2).find(l => l.tier === 1)!.vol
  assert.ok(t0 > t1)
})

test('발소리 단계 파일 이름은 자리 이름이다 (달리는 보병 100명 = 적음)', () => {
  const w = walkers(100, 0)
  const o = run(newSoundState(), [{ f: w.a, cam: camAt(10, 10), ev: [], now: 0 }, { f: w.b, cam: camAt(10, 10), ev: [], now: 100 }])[1]!
  assert.equal(o.loops[0]!.slot, 'step_run_few')
})

test('말발굽 걷기는 질주보다 느리고 작게 같은 파일에서 나온다', async () => {
  const { loopTargets } = await import('../../src/field/mainSoundModel.ts')
  const walk = loopTargets(horseLoop(2, 0).loops).find(t => t.slot === 'hoof_walk')!
  const gal = loopTargets(horseLoop(8, 1).loops).find(t => t.slot === 'hoof_gallop')!
  assert.ok(walk.rate < gal.rate)
  assert.ok(walk.gain < gal.gain)
})

test('다그닥다그닥 … 쾅: 질주가 접촉 직전에 가장 크고 쾅 프레임에서 질주 고리가 빠지며 꼬리가 150ms 이하', () => {
  const cam = camAt(20, 10), step = 8 * U / P.field.hz
  // 기병이 적에게 다가간다 (한 틱에 8칸/초) · 마지막에 맞물려 쾅
  const mk = (t: number, contact: boolean, events: SoundEngineEvent[] = []) => frame(t, [
    sq(0, 0, 'horse', 10, 10, { u: cell(10) + t * step, ran: contact ? 0 : 1, aim: contact ? 1 : -1, lock: contact ? 1 : -1 }),
    sq(1, 1, 'front', 40, 10),
  ], { events })
  const steps = [{ f: mk(0, false), cam, ev: [] as SoundEvent[], now: 0 }]
  for (let t = 1; t <= 18; t++) steps.push({ f: mk(t, false), cam, ev: [], now: t * 100 })
  steps.push({ f: mk(19, true, [ee(18, 'impact', { n: 800, how: 0, id: 0 })]), cam, ev: undefined as never, now: 1900 })
  const outs = run(newSoundState(), steps.map(x => (x.ev === undefined ? { f: x.f, cam: x.cam, now: x.now } : x)))
  const vols = outs.slice(1, 19).map(o => o.loops.find(l => l.slot === 'hoof_gallop')?.vol ?? 0)
  for (let i = 1; i < vols.length; i++) assert.ok(vols[i]! >= vols[i - 1]! - 1e-9, vols.join())
  assert.ok(vols[vols.length - 1]! > vols[0]!)
  const last = outs[19]!
  assert.ok(last.plays.some(p => p.slot === 'impact'))
  assert.equal(last.loops.find(l => l.slot === 'hoof_gallop'), undefined)
  assert.ok(P.field.soundLoopTailMs <= 150)
})

test('맞붙은 대 수에 비례해 쇳소리가 커진다 (상한 있음) · 난투 함성은 드문드문', () => {
  const melee = (n: number) => Array.from({ length: n }, (_, i) => sq(i, (i % 2) as 0 | 1, 'front', 40 + (i % 2), 10 + i, { aim: i ^ 1, lock: i ^ 1 }))
  const clashVol = (n: number) => {
    let st = newSoundState(), best = 0
    const cam = camAt(40, 10)
    st = stepSound(st, frame(0, melee(n)), cam, [], 0, false).state
    for (let t = 1; t <= P.field.soundClashEveryTicks; t++) {
      const f = frame(t, melee(n))
      const o = stepSound(st, f, cam, eventsFromDiff(st.last, f), 1000 + t * 100, false)
      st = o.state
      for (const p of o.plays) if (p.slot === 'clash') best = Math.max(best, p.vol)
    }
    return best
  }
  assert.ok(clashVol(2) > 0)
  assert.ok(clashVol(2) < clashVol(6))
  assert.ok(clashVol(6) <= clashVol(12) + 1e-9)
  assert.equal(clashVol(P.field.soundMeleeCountCap), clashVol(P.field.soundMeleeCountCap * 2))
  // 난투 함성: 맞붙은 대가 문턱 이상이면 한 번 · 간격 전에는 다시 안 난다 · 문턱 아래면 안 난다
  const cry = (n: number, at: number[]) => {
    let st = newSoundState(), c = 0
    for (const now of at) {
      const o = stepSound(st, frame(1, melee(n)), camAt(40, 10), [], now, false)
      st = o.state
      c += o.plays.filter(p => p.slot === 'war_cry').length
    }
    return c
  }
  assert.equal(cry(P.field.soundMeleeCryMinEngaged, [0, 100, 200]), 1)
  assert.equal(cry(P.field.soundMeleeCryMinEngaged, [0, P.field.soundMeleeCryEveryMs + 100]), 2)
  assert.equal(cry(P.field.soundMeleeCryMinEngaged - 1, [0, 100]), 0)
})

test('무너짐 함성은 도미노로 여럿이 무너져도 soundGapRoutMs 간격으로만', () => {
  const s0 = [sq(0, 0, 'front', 40, 10)]
  const cam = camAt(40, 10)
  const rout = (tick: number) => frame(tick, s0, { events: [ee(tick - 1, 'rout', { id: 0 }), ee(tick - 1, 'rout', { id: 1 })] })
  const gap = P.field.soundGapRoutMs
  const outs = run(newSoundState(), [
    { f: frame(0, s0), cam, ev: [], now: 0 }, { f: rout(1), cam, now: 1000 }, { f: rout(2), cam, now: 1000 + gap - 100 }, { f: rout(3), cam, now: 1000 + gap + 50 },
  ])
  const n = (i: number) => outs[i]!.plays.filter(p => p.slot === 'rout').length
  assert.deepEqual([n(1), n(2), n(3)], [1, 0, 1])
})

test('엔진 한 판(seed 3)을 소리 모델에 흘려도 같은 판은 같은 소리 기록 · 달리기·쾅·무너짐이 난다', async () => {
  const { soundLog } = await import('../../tools/field-sound-log.ts')
  const a = soundLog(3, 1200), b = soundLog(3, 1200)
  assert.equal(a.text, b.text)
  assert.ok((a.counts.impact ?? 0) > 0)
  assert.ok((a.counts.step_run ?? 0) > 0 || (a.counts.hoof_gallop ?? 0) > 0)
  assert.ok(a.maxPlays <= P.field.soundVoicesMax)
})

test('고리는 잠깐 빠졌다 돌아와도 다시 시작하지 않는다 · 세기만 바뀌고 · 오래 빠졌을 때만 멈춘다', async () => {
  const { planLoops } = await import('../../src/field/mainSoundModel.ts')
  const t = (gain: number, rate = 1) => [{ slot: 'hoof_walk' as const, gain, pan: 0, rate }]
  const hold = P.field.soundLoopHoldMs
  let r = planLoops({}, t(0.4), 0)
  assert.deepEqual(r.actions.map(a => a.op), ['start'])
  // 0.4초마다 빠졌다 들어왔다 하는 것을 흉내 낸다 (한 판에 42번 다시 시작하던 병)
  let starts = 1
  for (let k = 1; k <= 40; k++) {
    const now = k * 400
    r = planLoops(r.run, k % 2 === 1 ? [] : t(0.4, 1 + k / 100), now)
    for (const a of r.actions) { if (a.op === 'start') starts++; assert.notEqual(a.op, 'stop') }
  }
  assert.equal(starts, 1)
  // 빠지면 꼬리 안에 조용해지고(mute) 다시 목표가 되면 set 으로 이어서 키운다
  const out = planLoops(r.run, [], 20000)
  assert.ok(out.actions.every(a => a.op === 'mute' || a.op === 'stop'))
  const m = planLoops(planLoops(r.run, [], 20100).run, [], 20200)
  assert.equal(m.actions.length, 0) // 이미 조용하면 되풀이해 시키지 않는다
  assert.ok(Math.abs(out.actions.find(a => a.op === 'mute')?.tc ?? P.field.soundLoopTailMs / 3000 - P.field.soundLoopTailMs / 3000) < 1e-9)
  // hold 보다 오래 빠졌다가 돌아오면 그때서야 멈추고 새로 시작한다
  const gone = planLoops(r.run, [], 20000 + hold + 100)
  assert.ok(gone.actions.some(a => a.op === 'stop'))
  assert.equal(planLoops(gone.run, t(0.4), 20000 + hold + 200).actions[0]!.op, 'start')
})

test('한 판(seed 3 · 4)에서 이어지는 소리 고리마다 새로 시작한 횟수 ≤ 8', async () => {
  const { soundLog } = await import('../../tools/field-sound-log.ts')
  for (const seed of [3, 4]) {
    const r = soundLog(seed, 1200)
    // 6 → 8 (판의 법칙 묶음: 다시 섬·버팀으로 달아났던 대가 돌아와 걷는 짧은 걸음이 늘었다 · seed 4 step_walk_few 8)
    for (const [slot, n] of Object.entries(r.starts)) assert.ok(n <= 8, `seed ${seed} ${slot} ${n}`)
  }
})

test('편이 무너지면(sideBreak) 무너지는 함성이 크게 한 번 · 버팀(stand)은 우리 편 것만 함성', () => {
  const s0 = [sq(0, 0, 'front', 40, 10)]
  const cam = camAt(40, 10)
  const at = (evs: SoundEngineEvent[]) => run(newSoundState(), [{ f: frame(0, s0), cam, ev: [], now: 0 }, { f: frame(1, s0, { events: evs }), cam, now: 100 }])[1]!.plays
  const big = at([ee(0, 'sideBreak', { side: 1 })]).find(p => p.slot === 'rout')!
  const small = at([ee(0, 'rout')]).find(p => p.slot === 'rout')!
  assert.ok(big.vol > small.vol)
  assert.equal(at([ee(0, 'stand', { side: 0 })]).filter(p => p.slot === 'war_cry').length, 1)
  assert.equal(at([ee(0, 'stand', { side: 1 })]).filter(p => p.slot === 'war_cry').length, 0)
})
