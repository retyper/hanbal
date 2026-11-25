import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { P } from '../../src/tune/params.ts'
import { audible, eventsFromDiff, newSoundState, stepSound } from '../../src/field/mainSoundModel.ts'
import type { SoundCam, SoundEvent, SoundFrame, SoundSquad } from '../../src/field/mainSoundModel.ts'

const U = P.field.unit
const cell = (c: number): number => c * U
/** 판 px 로 본 한 칸 */
const px = (c: number): number => c * P.field.cellPx

function sq(id: number, side: 0 | 1, grp: SoundSquad['grp'], uCells: number, vCells: number, o: Partial<SoundSquad> = {}): SoundSquad {
  return { id, side, grp, men: 400, u: cell(uCells), v: cell(vCells), stance: 0, lock: -1, target: -1, ...o }
}
const frame = (tick: number, squads: SoundSquad[], o: Partial<SoundFrame> = {}): SoundFrame =>
  ({ tick, squads, pieces: [], edge: [1000, 1000], end: null, winner: -1, ...o })
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
  const a0 = frame(0, [sq(0, 0, 'front', 40, 10), sq(1, 1, 'front', 43, 10)])
  const a1 = frame(1, [sq(0, 0, 'front', 40, 10, { lock: 1 }), sq(1, 1, 'front', 43, 10, { lock: 0 })])
  const cam = camAt(41, 10)
  const [o0, o1] = run(newSoundState(), [{ f: a0, cam, now: 0 }, { f: a1, cam, now: 100 }])
  assert.equal(o0!.plays.filter(p => p.slot === 'impact').length, 0)
  const hit = o1!.plays.filter(p => p.slot === 'impact')
  assert.equal(hit.length, 1)
  assert.ok(hit[0]!.vol > 0)
})

test('쾅의 세기는 사람 수에 비례한다', () => {
  const mk = (men: number) => {
    const a0 = frame(0, [sq(0, 0, 'front', 40, 10, { men }), sq(1, 1, 'front', 43, 10, { men })])
    const a1 = frame(1, [sq(0, 0, 'front', 40, 10, { men, lock: 1 }), sq(1, 1, 'front', 43, 10, { men, lock: 0 })])
    return run(newSoundState(), [{ f: a0, cam: camAt(41, 10), now: 0 }, { f: a1, cam: camAt(41, 10), now: 100 }])[1]!.plays.find(p => p.slot === 'impact')!.vol
  }
  assert.ok(mk(50) < mk(300))
  assert.ok(mk(300) <= mk(1500))
})

test('방진끼리 맞물리면 쾅이 아니라 쇳소리다', () => {
  const a0 = frame(0, [sq(0, 0, 'front', 40, 10, { stance: 1 }), sq(1, 1, 'front', 43, 10, { stance: 1 })])
  const a1 = frame(1, [sq(0, 0, 'front', 40, 10, { stance: 1, lock: 1 }), sq(1, 1, 'front', 43, 10, { stance: 1, lock: 0 })])
  const ev = eventsFromDiff(a0, a1)
  assert.equal(ev.filter(e => e.kind === 'impact').length, 0)
  assert.equal(ev.filter(e => e.kind === 'clash').length, 1)
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
function horseLoop(cellsPerSec: number) {
  const step = cellsPerSec * U / P.field.hz
  const f0 = frame(0, [sq(0, 0, 'horse', 10, 10), sq(1, 1, 'front', 100, 10)])
  const f1 = frame(1, [sq(0, 0, 'horse', 10, 10, { u: cell(10) + step }), sq(1, 1, 'front', 100, 10)])
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

test('기병은 느리고 먼 데서는 걷는 발굽, 빠르면 질주 발굽', () => {
  assert.ok(horseLoop(2).loops.some(l => l.slot === 'hoof_walk'))
  assert.ok(horseLoop(8).loops.some(l => l.slot === 'hoof_gallop'))
})

test('질주가 시작되는 순간 말 울음(horse_start)이 한 번', () => {
  const step = 8 * U / P.field.hz
  const mk = (t: number, du: number) => frame(t, [sq(0, 0, 'horse', 10, 10, { u: cell(10) + du }), sq(1, 1, 'front', 100, 10)])
  const cam = camAt(10, 10)
  const outs = run(newSoundState(), [
    { f: mk(0, 0), cam, ev: [], now: 0 }, { f: mk(1, step), cam, ev: [], now: 100 }, { f: mk(2, 2 * step), cam, ev: [], now: 200 },
  ])
  assert.equal(outs[1]!.plays.filter(p => p.slot === 'horse_start').length, 1)
  assert.equal(outs[2]!.plays.filter(p => p.slot === 'horse_start').length, 0)
})

test('걷는 보병과 돌격 보병은 다른 이어지는 소리', () => {
  const step = 3 * U / P.field.hz
  const mk = (t: number, stance: number) => frame(t, [sq(0, 0, 'front', 10, 10, { u: cell(10) + t * step, stance }), sq(1, 1, 'front', 100, 10)])
  const cam = camAt(10, 10)
  const walk = run(newSoundState(), [{ f: mk(0, 1), cam, ev: [], now: 0 }, { f: mk(1, 1), cam, ev: [], now: 100 }])[1]!
  const charge = run(newSoundState(), [{ f: mk(0, 0), cam, ev: [], now: 0 }, { f: mk(1, 0), cam, ev: [], now: 100 }])[1]!
  assert.ok(walk.loops.some(l => l.base === 'step_walk') && !walk.loops.some(l => l.base === 'step_run'))
  assert.ok(charge.loops.some(l => l.base === 'step_run') && !charge.loops.some(l => l.base === 'step_walk'))
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
  const mk = (t: number, lock: boolean) => frame(t, [sq(0, 0, 'front', 10, 10, { u: cell(10) + t * step, stance: 1 }), sq(1, 1, 'front', 100, 10), sq(2, 0, 'front', 40, 10, { lock: lock ? 3 : -1 }), sq(3, 1, 'front', 43, 10, { lock: lock ? 2 : -1 })])
  const cam = camAt(25, 10)
  const quiet = run(newSoundState(), [{ f: mk(0, false), cam, ev: [], now: 0 }, { f: mk(1, false), cam, ev: [], now: 100 }])[1]!.loops.find(l => l.base === 'step_walk')!.vol
  const ducked = run(newSoundState(), [{ f: mk(0, false), cam, ev: [], now: 0 }, { f: mk(1, true), cam, now: 100 }])[1]!
  const d = ducked.loops.find(l => l.base === 'step_walk')!.vol
  assert.ok(d < quiet)
  assert.ok(ducked.plays.some(p => p.slot === 'impact'))
})

test('문 부서짐 · 사기 꺾임 · 끝은 차이에서 사건이 된다', () => {
  const s = [sq(0, 0, 'front', 40, 10), sq(1, 1, 'front', 60, 10)]
  const a = frame(0, s, { pieces: [{ id: 7, kind: 'gate', hp: 100 }, { id: 8, kind: 'stake', hp: 50 }] })
  const b = frame(1, s, { pieces: [{ id: 7, kind: 'gate', hp: 0 }, { id: 8, kind: 'stake', hp: 0 }], edge: [1000, P.field.edgeLowPermille] })
  const kinds = eventsFromDiff(a, b).map(e => e.kind).sort()
  assert.deepEqual(kinds, ['gateBreak', 'rout'])
  const c = frame(2, s, { pieces: b.pieces, edge: b.edge, end: 'morale', winner: 0 })
  const e = eventsFromDiff(b, c)
  assert.deepEqual(e, [{ kind: 'end', win: true }])
})

test('틱이 안 바뀐 프레임에는 사건이 없다 (같은 틱을 두 번 읽어도 쾅은 한 번)', () => {
  const a = frame(3, [sq(0, 0, 'front', 40, 10, { lock: 1 }), sq(1, 1, 'front', 43, 10, { lock: 0 })])
  assert.deepEqual(eventsFromDiff(a, a), [])
})

test('활은 겨누는 동안 화살비 사건이 주기마다 나온다', () => {
  const cycle = Math.round(P.field.arrowCycleMs * P.field.hz / 1000)
  let n = 0
  let prev = frame(0, [sq(0, 0, 'bows', 40, 10, { target: 1 }), sq(1, 1, 'front', 60, 10)])
  for (let t = 1; t <= cycle * 3; t++) {
    const cur = frame(t, prev.squads.map(q => ({ ...q })))
    n += eventsFromDiff(prev, cur).filter(e => e.kind === 'volley').length
    prev = cur
  }
  assert.equal(n, 3)
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
  const slow = loopTargets(horseLoop(1).loops)[0]!, fast = loopTargets(horseLoop(30).loops)[0]!
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
  const mk = (t: number) => frame(t, [...Array.from({ length: n }, (_, i) => sq(i, 0, 'front', 10 + i, 10, { u: cell(10 + i) + t * step, stance, men })), sq(90, 1, 'front', 100, 10)])
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

test('발소리 크기는 사람 수에 따르고 단계 파일 이름은 자리 이름이다', () => {
  const w = walkers(100, 0)
  const o = run(newSoundState(), [{ f: w.a, cam: camAt(10, 10), ev: [], now: 0 }, { f: w.b, cam: camAt(10, 10), ev: [], now: 100 }])[1]!
  assert.equal(o.loops[0]!.slot, 'step_run_few')
})

test('말발굽 걷기는 질주보다 느리고 작게 같은 파일에서 나온다', async () => {
  const { loopTargets } = await import('../../src/field/mainSoundModel.ts')
  const walk = loopTargets(horseLoop(2).loops).find(t => t.slot === 'hoof_walk')!
  const gal = loopTargets(horseLoop(8).loops).find(t => t.slot === 'hoof_gallop')!
  assert.ok(walk.rate < gal.rate)
  assert.ok(walk.gain < gal.gain)
})

test('꽂히는 화살은 쏜 뒤 화살이 닿는 때에 맞은 대 자리에서 주기마다 한 번', () => {
  const cycle = P.field.arrowCycleMs, flight = P.field.arrowFlightMs
  const sqs = [sq(0, 0, 'bows', 40, 10, { target: 1 }), sq(1, 1, 'front', 60, 10)]
  const cam = camAt(50, 10)
  let st = newSoundState(), hits = 0
  const times: number[] = []
  for (let t = 0, tick = 0; t <= cycle * 4; t += 33, tick = Math.floor(t * P.field.hz / 1000)) {
    const o = stepSound(st, frame(tick, sqs), cam, [], 1000 + t, false)
    st = o.state
    for (const p of o.plays) if (p.slot === 'arrow_hit') { hits++; times.push(t) }
  }
  assert.ok(hits >= 3 && hits <= 5, String(hits))
  for (let i = 1; i < times.length; i++) assert.ok(Math.abs(times[i]! - times[i - 1]! - cycle) <= 34 + 1, times.join())
  // 겨누지 않으면 나지 않는다
  let st2 = newSoundState(), n2 = 0
  for (let t = 0; t <= cycle * 3; t += 33) {
    const o = stepSound(st2, frame(0, [sq(0, 0, 'bows', 40, 10), sq(1, 1, 'front', 60, 10)]), cam, [], 1000 + t, false)
    st2 = o.state
    n2 += o.plays.filter(p => p.slot === 'arrow_hit').length
  }
  assert.equal(n2, 0)
  assert.ok(flight < cycle)
})
