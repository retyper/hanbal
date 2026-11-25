/**
 * 전장 소리 모델 — 순수 계산 (F3e · docs/realm/battle-study/40-cards.md)
 *
 * 한 프레임의 읽기(SoundFrame) · 카메라(SoundCam) · 사건 목록 · 지금 시각(ms) 을 받아
 * 「무엇을 얼마나 크게 · 어느 쪽에서 · 얼마나 빠르게 틀지」의 목록(Play[])을 낸다.
 * 난수·시계·DOM 을 모른다 (시계는 인자로 받고, 높낮이 흔들림은 박 번호의 해시). 같은 입력은 늘 같은 목록.
 * 파일 이름이 main 으로 시작해 tests/field/purity.test.ts 가 sim 쪽으로 보지 않는다. 대신 tests/field/sound.test.ts 가 같은 금지어를 센다.
 *
 * 사건 줄: 엔진의 정식 사건(run · impact · brace · rout · gateBreak · volley)은 F2c 가 만든다. 지금은 없으므로
 * eventsFromDiff() 가 앞뒤 프레임 차이에서 화면 쪽으로 뽑는다. F2c 가 사건 줄을 주면 stepSound 의 events 인자에 그것을 넘기면 된다.
 */
import { P } from '../tune/params.ts'

/** 소리 자리 이름 — 어떤 파일을 붙일지는 mainSound.ts 의 표가 정한다 (여기는 모른다) */
export type FieldSlot =
  | 'flag_charge' | 'flag_hold' | 'flag_open' | 'flag_move' | 'flag_horse'
  | 'war_cry' | 'war_drums' | 'horse_start' | 'arrow_volley' | 'clash' | 'impact' | 'gate' | 'rout' | 'end_win' | 'end_lose'
  | 'step_walk' | 'step_run' | 'hoof_walk' | 'hoof_gallop'

export interface SoundSquad { id: number; side: 0 | 1; grp: 'front' | 'bows' | 'horse'; men: number; u: number; v: number; stance: number; lock: number; target: number }
export interface SoundPiece { id: number; kind: 'stake' | 'gate'; hp: number }
/** 한 프레임의 읽기 — 좌표는 sim 단위(1칸 = P.field.unit) */
export interface SoundFrame { tick: number; squads: readonly SoundSquad[]; pieces: readonly SoundPiece[]; edge: readonly [number, number]; end: string | null; winner: number }
/** 카메라 — x, y 는 화면 가운데의 판 좌표(px) · zoom 은 화면 px / 판 px · zoomRel 은 맞춤 배율에 대한 몫(1 이상) */
export interface SoundCam { x: number; y: number; zoom: number; vpW: number; vpH: number; zoomRel: number }

export type FlagKind = 'charge' | 'hold' | 'open' | 'horse' | 'move'
/** u, v 가 없으면 화면 소리(깃발·끝)라 가운데에서 늘 같은 크기로 난다 */
export interface SoundEvent {
  kind: 'impact' | 'clash' | 'volley' | 'gateBreak' | 'rout' | 'flag' | 'end'
  u?: number; v?: number
  /** 부딪힘 세기 0~1000 */
  power?: number
  flag?: FlagKind
  win?: boolean
}

export interface Play { slot: FieldSlot; vol: number; pan: number; rate: number; loop: boolean }
export interface LoopInfo { slot: FieldSlot; vol: number; pan: number; beatMul: number; beatMs: number }

export interface SoundState {
  last: SoundFrame | null
  speeds: Readonly<Record<number, number>>
  gallop: Readonly<Record<number, 1>>
  lastAt: Readonly<Record<string, number>>
  beatAt: Readonly<Record<string, number>>
  beatN: Readonly<Record<string, number>>
  duckUntil: number
}
export const newSoundState = (): SoundState => ({ last: null, speeds: {}, gallop: {}, lastAt: {}, beatAt: {}, beatN: {}, duckUntil: -1 })

export interface SoundOut { state: SoundState; plays: Play[]; loops: LoopInfo[] }

const clamp = (x: number, lo: number, hi: number): number => x < lo ? lo : x > hi ? hi : x
const F = (): typeof P.field => P.field

/** 몸이 자리를 낼 화면 위치 — 판 좌표(px)로 바꿔 화면 px 로 */
function screenOf(cam: SoundCam, u: number, v: number): { sx: number; sy: number } {
  const f = F(), k = f.cellPx / f.unit
  return { sx: (u * k - cam.x) * cam.zoom + cam.vpW / 2, sy: (v * k - cam.y) * cam.zoom + cam.vpH / 2 }
}

/** 한 자리의 들림 — 좌우(pan) · 화면 밖 거리와 배율에 따른 크기(0~1) */
export function audible(cam: SoundCam, u: number | undefined, v: number | undefined): { pan: number; gain: number } {
  const f = F()
  const nearMul = f.zoomNear / 100
  const zoomGain = (f.soundZoomFarPct + (100 - f.soundZoomFarPct) * clamp((cam.zoomRel - 1) / Math.max(0.001, nearMul - 1), 0, 1)) / 100
  if (u === undefined || v === undefined) return { pan: 0, gain: zoomGain }
  const { sx, sy } = screenOf(cam, u, v)
  const hw = cam.vpW / 2, hh = cam.vpH / 2
  const out = Math.max(0, Math.abs(sx - hw) - hw, Math.abs(sy - hh) - hh)
  const fade = clamp(out / (cam.vpW * f.soundOffFadeScreens), 0, 1)
  const far = 1 - fade * (1 - f.soundOffMinPct / 100)
  return { pan: clamp((sx - hw) / hw, -1, 1) * (f.soundPanMaxPct / 100), gain: far * zoomGain }
}

const centerOf = (qs: readonly SoundSquad[]): { u: number; v: number } | null => {
  let n = 0, su = 0, sv = 0
  for (const q of qs) if (q.men > 0) { n++; su += q.u; sv += q.v }
  return n === 0 ? null : { u: Math.trunc(su / n), v: Math.trunc(sv / n) }
}

/**
 * 앞뒤 프레임의 차이에서 사건을 뽑는다 (임시 · F2c 의 정식 사건 줄이 오면 이 함수만 갈아 끼운다).
 * 틱이 몇 칸 건너뛰었어도 주기 사건(화살비 · 쇳소리)은 건너뛴 틱마다 본다 (상한: maxCatchUpTicks).
 */
export function eventsFromDiff(prev: SoundFrame | null, cur: SoundFrame): SoundEvent[] {
  if (prev === null || cur.tick === prev.tick) return []
  const ev: SoundEvent[] = []
  const byId = new Map<number, SoundSquad>()
  for (const q of cur.squads) byId.set(q.id, q)
  const prevOf = new Map<number, SoundSquad>()
  for (const q of prev.squads) prevOf.set(q.id, q)
  const seen = new Set<number>()
  for (const q of cur.squads) {
    const p = prevOf.get(q.id)
    if (q.men <= 0 || p === undefined) continue
    // 처음 맞물린 순간 (한 쌍에 한 번)
    if (p.lock < 0 && q.lock >= 0) {
      const o = byId.get(q.lock)
      if (o !== undefined) {
        const key = Math.min(q.id, o.id) * 1000 + Math.max(q.id, o.id)
        if (!seen.has(key)) {
          seen.add(key)
          const charging = (s: SoundSquad): boolean => s.grp === 'horse' || (s.grp === 'front' && s.stance === 0)
          const power = clamp(Math.trunc((q.men + o.men) * 1000 / F().soundImpactRefMen), 0, 1000)
          ev.push({ kind: charging(q) || charging(o) ? 'impact' : 'clash', u: Math.trunc((q.u + o.u) / 2), v: Math.trunc((q.v + o.v) / 2), power })
        }
      }
    }
  }
  const cycle = Math.max(1, Math.round(F().arrowCycleMs * F().hz / 1000))
  const first = Math.max(prev.tick + 1, cur.tick - F().maxCatchUpTicks + 1)
  const pairSeen = new Set<number>()
  for (let t = first; t <= cur.tick; t++) {
    for (const q of cur.squads) {
      if (q.men <= 0) continue
      if (q.grp === 'bows' && q.target >= 0 && (t + q.id) % cycle === 0) ev.push({ kind: 'volley', u: q.u, v: q.v })
      if (q.lock >= 0 && (t + q.id) % F().soundClashEveryTicks === 0) {
        const o = byId.get(q.lock)
        const key = o === undefined ? -1 : Math.min(q.id, o.id) * 1000 + Math.max(q.id, o.id) + t * 1000000
        if (o !== undefined && pairSeen.has(key)) continue
        pairSeen.add(key)
        ev.push({ kind: 'clash', u: o === undefined ? q.u : Math.trunc((q.u + o.u) / 2), v: o === undefined ? q.v : Math.trunc((q.v + o.v) / 2), power: 0 })
      }
    }
  }
  const hp0 = new Map<number, number>()
  for (const p of prev.pieces) hp0.set(p.id, p.hp)
  for (const p of cur.pieces) {
    if (p.kind === 'gate' && (hp0.get(p.id) ?? 0) > 0 && p.hp <= 0) ev.push({ kind: 'gateBreak' })
  }
  for (const side of [0, 1] as const) {
    const low = F().edgeLowPermille
    if (prev.edge[side] > low && cur.edge[side] <= low) {
      const c = centerOf(cur.squads.filter(q => q.side === side))
      ev.push(c === null ? { kind: 'rout' } : { kind: 'rout', u: c.u, v: c.v })
    }
  }
  if (prev.end === null && cur.end !== null) ev.push({ kind: 'end', win: cur.winner === 0 })
  return ev
}

/** 깃발을 꽂은 순간의 사건 (명령 종류마다) */
export const flagEvent = (flag: FlagKind): SoundEvent => ({ kind: 'flag', flag })

const GAP: Readonly<Record<FieldSlot, () => number>> = {
  flag_charge: () => 0, flag_hold: () => 0, flag_open: () => 0, flag_move: () => 0, flag_horse: () => 0,
  war_cry: () => F().soundGapCryMs, war_drums: () => F().soundGapDrumsMs, horse_start: () => F().soundGapCryMs,
  arrow_volley: () => F().soundGapVolleyMs, clash: () => F().soundGapClashMs, impact: () => F().soundGapImpactMs,
  gate: () => F().soundGapMs, rout: () => F().soundGapCryMs, end_win: () => F().soundGapEndMs, end_lose: () => F().soundGapEndMs,
  step_walk: () => 0, step_run: () => 0, hoof_walk: () => 0, hoof_gallop: () => 0,
}
const PRIORITY: Readonly<Record<FieldSlot, number>> = {
  end_win: 0, end_lose: 0, impact: 1, gate: 2, war_cry: 3, rout: 3,
  flag_charge: 4, flag_hold: 4, flag_open: 4, flag_move: 4, flag_horse: 4,
  horse_start: 5, war_drums: 5, arrow_volley: 6, clash: 7, hoof_gallop: 8, step_run: 8, hoof_walk: 9, step_walk: 9,
}
const FLAG_SLOT: Readonly<Record<FlagKind, FieldSlot>> = { charge: 'flag_charge', hold: 'flag_hold', open: 'flag_open', horse: 'flag_horse', move: 'flag_move' }
/** 이보다 작게 들리는 소리는 내지 않는다 */
const AUDIBLE_MIN = 0.02

/** 박 번호에서 −1~1 (같은 입력은 같은 값) */
function hashUnit(key: string, n: number): number {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619)
  h = Math.imul(h ^ n, 2654435761) >>> 0
  return (h % 2001) / 1000 - 1
}

function refSpeed(g: SoundSquad['grp']): number {
  return g === 'front' ? F().speedFrontCellsPerSec : g === 'bows' ? F().speedBowsCellsPerSec : F().speedHorseCellsPerSec
}

function measureSpeeds(prev: SoundFrame, cur: SoundFrame): Record<number, number> {
  const out: Record<number, number> = {}
  const dt = (cur.tick - prev.tick) / F().hz
  if (dt <= 0) return out
  const p = new Map<number, SoundSquad>()
  for (const q of prev.squads) p.set(q.id, q)
  for (const q of cur.squads) {
    const o = p.get(q.id)
    if (o === undefined || q.men <= 0) continue
    const du = q.u - o.u, dv = q.v - o.v
    out[q.id] = Math.sqrt(du * du + dv * dv) / F().unit / dt
  }
  return out
}

function nearestFoeCells(cur: SoundFrame, q: SoundSquad): number {
  let best = Infinity
  for (const e of cur.squads) {
    if (e.side === q.side || e.men <= 0) continue
    const du = e.u - q.u, dv = e.v - q.v
    const d = Math.sqrt(du * du + dv * dv) / F().unit
    if (d < best) best = d
  }
  return best
}

/** 이어지는 소리 파일을 돌리는 목표 — 크기 · 좌우 · 재생 빠르기(박자 배율이 그대로 먹되 하한·상한 안에서) */
export interface LoopTarget { slot: FieldSlot; gain: number; pan: number; rate: number }
export function loopTargets(loops: readonly LoopInfo[]): LoopTarget[] {
  const f = F()
  return loops.map(l => ({ slot: l.slot, gain: l.vol * f.soundMasterPct / 100, pan: l.pan, rate: clamp(l.beatMul, f.soundLoopRateMinPct / 100, f.soundLoopRateMaxPct / 100) }))
}

interface Cand { play: Play; pri: number; at: number }

/**
 * 한 프레임. events 는 호출한 쪽이 낸다 (eventsFromDiff 의 결과 + 깃발 꽂기, 나중엔 엔진의 사건 줄).
 * 숨은 탭이면 아무것도 내지 않고, 앞 프레임 기억만 갈아 둔다 (돌아와서 밀린 소리를 몰아 틀지 않게).
 */
export function stepSound(st: SoundState, frame: SoundFrame, cam: SoundCam, events: readonly SoundEvent[], nowMs: number, hidden: boolean): SoundOut {
  if (hidden) return { state: { ...newSoundState(), last: frame, speeds: {}, lastAt: st.lastAt }, plays: [], loops: [] }
  const f = F()
  const advanced = st.last === null || frame.tick !== st.last.tick
  const speeds = advanced && st.last !== null ? measureSpeeds(st.last, frame) : st.speeds
  const cands: Cand[] = []
  const add = (slot: FieldSlot, base: number, u: number | undefined, v: number | undefined, loop = false, rate = 1): void => {
    const a = audible(cam, u, v)
    const vol = base * a.gain * f.soundMasterPct / 100
    if (vol >= AUDIBLE_MIN) cands.push({ play: { slot, vol, pan: a.pan, rate, loop }, pri: PRIORITY[slot], at: cands.length })
  }

  let duckUntil = st.duckUntil
  // 기병 질주 시작 — 달리는 빠르기가 문턱을 넘었거나 적 대에 가까이 달려드는 순간 (한 번)
  const gallop: Record<number, 1> = {}
  for (const q of frame.squads) {
    if (q.grp !== 'horse' || q.men <= 0 || q.lock >= 0) continue
    const sp = speeds[q.id] ?? 0
    if (sp > 0 && (sp >= f.soundGallopMinCellsPerSec || nearestFoeCells(frame, q) <= f.soundGallopRangeCells)) {
      gallop[q.id] = 1
      if (st.gallop[q.id] === undefined) add('horse_start', 0.6, q.u, q.v)
    }
  }
  for (const e of events) {
    switch (e.kind) {
      case 'impact': {
        const power = clamp(e.power ?? 0, 0, 1000)
        add('impact', 0.5 + 0.5 * power / 1000, e.u, e.v)
        add('war_drums', 0.4, e.u, e.v)
        duckUntil = nowMs + f.soundDuckMs
        break
      }
      case 'clash': add('clash', 0.5, e.u, e.v); break
      case 'volley': add('arrow_volley', 0.5, e.u, e.v); break
      case 'gateBreak': add('gate', 0.8, e.u, e.v); break
      case 'rout': add('rout', 0.7, e.u, e.v); break
      case 'end': add(e.win === true ? 'end_win' : 'end_lose', 0.9, undefined, undefined); break
      case 'flag': {
        const k = e.flag ?? 'move'
        add(FLAG_SLOT[k], 0.7, e.u, e.v)
        if (k === 'charge') add('war_cry', 0.6, e.u, e.v)
        break
      }
    }
  }

  // 이어지는 소리 — 종류마다 한 줄 · 대마다 사람 수와 들림을 더하고 박은 걸음 빠르기를 따른다
  const duck = nowMs < duckUntil ? f.soundDuckPct / 100 : 1
  const groups = new Map<FieldSlot, { w: number; pan: number; mul: number; n: number }>()
  for (const q of frame.squads) {
    const sp = speeds[q.id] ?? 0
    if (q.men <= 0 || q.lock >= 0 || sp <= 0) continue
    const slot: FieldSlot = q.grp === 'horse' ? (gallop[q.id] === 1 ? 'hoof_gallop' : 'hoof_walk') : q.grp === 'front' && q.stance === 0 ? 'step_run' : 'step_walk'
    const a = audible(cam, q.u, q.v)
    const w = q.men * a.gain
    const g = groups.get(slot) ?? { w: 0, pan: 0, mul: 0, n: 0 }
    g.w += w; g.pan += w * a.pan; g.mul += w * (sp / refSpeed(q.grp)); g.n++
    groups.set(slot, g)
  }
  const loops: LoopInfo[] = []
  const beatAt: Record<string, number> = {}, beatN: Record<string, number> = { ...st.beatN }
  for (const [slot, g] of groups) {
    if (g.w <= 0) continue
    const mul = clamp(g.mul / g.w, f.soundBeatMulMinPct / 100, f.soundBeatMulMaxPct / 100)
    const base = slot === 'step_walk' ? f.soundWalkBeatMs : slot === 'step_run' ? f.soundRunBeatMs : slot === 'hoof_walk' ? f.soundHoofWalkBeatMs : f.soundHoofGallopBeatMs
    const beatMs = base / mul
    const vol = f.soundLoopVolPct / 100 * Math.sqrt(Math.min(1, g.w / f.soundLoopMenRef)) * duck
    const pan = g.pan / g.w
    loops.push({ slot, vol, pan, beatMul: mul, beatMs })
    const due = st.beatAt[slot]
    if (due === undefined || nowMs >= due) {
      const n = (beatN[slot] ?? 0) + 1
      beatN[slot] = n
      const rate = 1 + hashUnit(slot, n) * f.soundRateJitterPct / 100
      const vv = vol * f.soundMasterPct / 100
      if (vv >= AUDIBLE_MIN) cands.push({ play: { slot, vol: vv, pan, rate, loop: true }, pri: PRIORITY[slot], at: cands.length })
      beatAt[slot] = nowMs + beatMs
    } else beatAt[slot] = due
  }

  // 같은 소리 되풀이 간격 → 우선순위 → 동시 수 상한
  const lastAt: Record<string, number> = { ...st.lastAt }
  cands.sort((a, b) => a.pri - b.pri || a.at - b.at)
  const plays: Play[] = []
  for (const c of cands) {
    if (plays.length >= f.soundVoicesMax) break
    const last = lastAt[c.play.slot]
    if (last !== undefined && nowMs - last < GAP[c.play.slot]() && nowMs >= last) continue
    lastAt[c.play.slot] = nowMs
    plays.push(c.play)
  }
  const next: SoundState = { last: advanced ? frame : st.last, speeds, gallop, lastAt, beatAt, beatN, duckUntil }
  return { state: next, plays, loops }
}
