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
  | 'war_cry' | 'war_drums' | 'horse_start' | 'arrow_volley' | 'arrow_hit' | 'hero_dash' | 'hero_art' | 'clash' | 'impact' | 'gate' | 'rout' | 'end_win' | 'end_lose'
  | 'step_walk_few' | 'step_walk_mid' | 'step_walk_many' | 'step_run_few' | 'step_run_mid' | 'step_run_many' | 'hoof_walk' | 'hoof_gallop'

/** 이어지는 소리의 종류 — 발소리는 사람 수에 따라 세 단계(few · mid · many) 가운데 하나로 나간다 */
export type LoopBase = 'step_walk' | 'step_run' | 'hoof_walk' | 'hoof_gallop'
const TIERS = ['few', 'mid', 'many'] as const
const tierSlot = (base: LoopBase, tier: number): FieldSlot => (base === 'hoof_walk' || base === 'hoof_gallop' ? base : `${base}_${TIERS[tier]}`) as FieldSlot

/** ran 달리는 중(돌격·옆치기의 달린 거리 · 0 이면 걷기) · flee 달아남 · aim 지금 싸우는 상대(없으면 -1) · order 무리 명령 ORD_* */
export interface SoundSquad { id: number; side: 0 | 1; grp: 'front' | 'bows' | 'horse'; men: number; u: number; v: number; stance: number; lock: number; target: number; ran: number; flee: number; aim: number; order: number }
/** 엔진 사건 줄의 한 칸 (src/field/types.ts FieldEvent 에서 소리에 쓰는 것만 · tick 은 사건이 난 틱 = 돌기 전 틱 번호) */
export interface SoundEngineEvent { tick: number; kind: string; side: number; id: number; u: number; v: number; n: number; to: number; how: number }
export interface SoundPiece { id: number; kind: 'stake' | 'gate'; hp: number }
/** 한 프레임의 읽기 — 좌표는 sim 단위(1칸 = P.field.unit) */
/** hero = 우리 장수의 투지 (0~1000) · 투지로 한 번 더 쓴 횟수 · 두 장수의 쓰러진 틱(stun) — 투지가 차는 순간·쓰는 순간 · 장수가 쓰러지는 순간에 소리를 낸다 (없으면 안 낸다) */
export interface SoundFrame { tick: number; squads: readonly SoundSquad[]; pieces: readonly SoundPiece[]; edge: readonly [number, number]; end: string | null; winner: number; events?: readonly SoundEngineEvent[]; hero?: { grit: number; gritN: number; stun: number; foeStun: number } | undefined }
/** 카메라 — x, y 는 화면 가운데의 판 좌표(px) · zoom 은 화면 px / 판 px · zoomRel 은 맞춤 배율에 대한 몫(1 이상) */
export interface SoundCam { x: number; y: number; zoom: number; vpW: number; vpH: number; zoomRel: number }

export type FlagKind = 'charge' | 'hold' | 'open' | 'horse' | 'move'
/** u, v 가 없으면 화면 소리(깃발·끝)라 가운데에서 늘 같은 크기로 난다 */
export interface SoundEvent {
  kind: 'impact' | 'impactGood' | 'clash' | 'volley' | 'arrowHit' | 'gateBreak' | 'rout' | 'heroDash' | 'heroSkill' | 'artHit' | 'sideBreak' | 'stand' | 'regroup' | 'heroDown' | 'gritFull' | 'gritUse' | 'flag' | 'end'
  u?: number; v?: number
  /** 부딪힘 세기 0~1000 · clash 에서는 맞붙은 대 수 */
  power?: number
  /** impact 의 상성 구분 0 보통 · 1 맞음 · 2 막힘 · 사건이 난 틱 · 친 대 */
  how?: number; tick?: number; id?: number; side?: number
  flag?: FlagKind
  win?: boolean
}

export interface Play { slot: FieldSlot; vol: number; pan: number; rate: number; loop: boolean }
export interface LoopInfo { slot: FieldSlot; base: LoopBase; tier: number; vol: number; pan: number; beatMul: number; beatMs: number }

export interface SoundState {
  last: SoundFrame | null
  speeds: Readonly<Record<number, number>>
  gallop: Readonly<Record<number, 1>>
  lastAt: Readonly<Record<string, number>>
  /** 이어지는 소리 종류마다 지금 단계 (0 적음 · 1 보통 · 2 많음) */
  tiers: Readonly<Record<string, number>>
  /** 단계가 바뀌어 두 고리가 겹쳐 넘어가는 중이면 옛 단계와 바뀐 시각(ms) */
  xfade: Readonly<Record<string, { from: number; at: number }>>
  lastNow: number
  duckUntil: number
  /** 무리마다 마지막으로 쾅을 낸 틱 (같은 무리는 soundImpactRepeatMs 뒤에야 다시) · 마지막 난전 함성 시각 */
  impactAt: Readonly<Record<number, number>>
  meleeCryAt: number
}
export const newSoundState = (): SoundState => ({ last: null, speeds: {}, gallop: {}, lastAt: {}, tiers: {}, xfade: {}, lastNow: -1, duckUntil: -1, impactAt: {}, meleeCryAt: -1 })

export interface SoundOut { state: SoundState; plays: Play[]; loops: LoopInfo[] }

const clamp = (x: number, lo: number, hi: number): number => x < lo ? lo : x > hi ? hi : x
const F = (): typeof P.field => P.field

/** 몸이 자리를 낼 화면 위치 — 판 좌표(px)로 바꿔 화면 px 로 */
function screenOf(cam: SoundCam, u: number, v: number): { sx: number; sy: number } {
  const f = F(), k = f.cellPx / f.unit
  return { sx: (u * k - cam.x) * cam.zoom + cam.vpW / 2, sy: (v * k - cam.y) * cam.zoom + cam.vpH / 2 }
}

/** 한 자리의 들림 — 좌우(pan) · 화면 밖 거리와 배율에 따른 크기(0~1) */
export function audible(cam: SoundCam, u: number | undefined, v: number | undefined): { pan: number; gain: number; inView: boolean } {
  const f = F()
  const nearMul = f.zoomNear / 100
  const zoomGain = (f.soundZoomFarPct + (100 - f.soundZoomFarPct) * clamp((cam.zoomRel - 1) / Math.max(0.001, nearMul - 1), 0, 1)) / 100
  if (u === undefined || v === undefined) return { pan: 0, gain: zoomGain, inView: true }
  const { sx, sy } = screenOf(cam, u, v)
  const hw = cam.vpW / 2, hh = cam.vpH / 2
  const out = Math.max(0, Math.abs(sx - hw) - hw, Math.abs(sy - hh) - hh)
  const fade = clamp(out / (cam.vpW * f.soundOffFadeScreens), 0, 1)
  const far = 1 - fade * (1 - f.soundOffMinPct / 100)
  return { pan: clamp((sx - hw) / hw, -1, 1) * (f.soundPanMaxPct / 100), gain: far * zoomGain, inView: out === 0 }
}

const centerOf = (qs: readonly SoundSquad[]): { u: number; v: number } | null => {
  let n = 0, su = 0, sv = 0
  for (const q of qs) if (q.men > 0) { n++; su += q.u; sv += q.v }
  return n === 0 ? null : { u: Math.trunc(su / n), v: Math.trunc(sv / n) }
}

const isMelee = (q: SoundSquad): boolean => q.men > 0 && q.grp !== 'bows' && (q.aim >= 0 || q.lock >= 0)

/**
 * 앞뒤 프레임에서 소리 사건을 뽑는다. 엔진의 사건 줄(cur.events · F2c)에서 [prev.tick, cur.tick) 틱 몫을 읽고,
 * 맞붙은 대는 주기마다 쇳소리 사건을 낸다 (대 수에 비례해 크게 · 건너뛴 틱마다 보되 maxCatchUpTicks 까지). 끝은 앞뒤 차이로 본다.
 * 엔진 사건 → 소리: impact(how) 쾅 · flankHit 상성 북 · rout 무너짐 · volley 활 · loss 가운데 화살(how 1) 꽂힘 · gateBreak · heroDash · heroSkill · artHit.
 * omen(적 큰 수 예고)은 소리를 정하지 않았다 (형이 고른 소리 가운데 경고로 쓸 것이 없다).
 */
export function eventsFromDiff(prev: SoundFrame | null, cur: SoundFrame): SoundEvent[] {
  if (prev === null || cur.tick === prev.tick) return []
  const ev: SoundEvent[] = []
  const byId = new Map<number, SoundSquad>()
  for (const q of cur.squads) byId.set(q.id, q)
  for (const e of cur.events ?? []) {
    if (e.tick < prev.tick || e.tick >= cur.tick) continue
    const pos = { u: e.u, v: e.v }
    switch (e.kind) {
      case 'impact': ev.push({ kind: 'impact', ...pos, power: clamp(Math.trunc(e.n * 1000 / F().soundImpactRefMen), 0, 1000), how: e.how, tick: e.tick, id: e.id }); break
      case 'flankHit': ev.push({ kind: 'impactGood', ...pos, tick: e.tick, id: e.id }); break
      case 'rout': ev.push({ kind: 'rout', ...pos, id: e.id }); break
      case 'volley': ev.push({ kind: 'volley', ...pos }); break
      case 'gateBreak': ev.push({ kind: 'gateBreak', ...pos }); break
      case 'artHit': ev.push({ kind: 'artHit', ...pos }); break
      case 'sideBreak': ev.push({ kind: 'sideBreak', ...pos, side: e.side }); break
      case 'stand': ev.push({ kind: 'stand', ...pos, side: e.side }); break
      case 'regroup': ev.push({ kind: 'regroup', ...pos, side: e.side }); break
      case 'heroDash': ev.push({ kind: 'heroDash', ...pos }); break
      case 'heroSkill': ev.push({ kind: 'heroSkill', ...pos }); break
      case 'loss': {
        const to = byId.get(e.to)
        if (e.how === 1 && to !== undefined) ev.push({ kind: 'arrowHit', u: to.u, v: to.v })
        break
      }
    }
  }
  // 투지: 우리 장수의 투지가 막 찼다 · 투지로 한 번 더 썼다 (화면 소리)
  if (prev.hero !== undefined && cur.hero !== undefined) {
    if (cur.hero.grit >= 1000 && prev.hero.grit < 1000) ev.push({ kind: 'gritFull' })
    if (cur.hero.gritN > prev.hero.gritN) ev.push({ kind: 'gritUse' })
    // 장수가 쓰러짐 (쓰러진 틱이 0 에서 오름) — 적장이면 판에서 가장 큰 순간이다
    if (cur.hero.foeStun > 0 && prev.hero.foeStun === 0) ev.push({ kind: 'heroDown', side: 1 })
    if (cur.hero.stun > 0 && prev.hero.stun === 0) ev.push({ kind: 'heroDown', side: 0 })
  }
  // 맞붙은 동안의 쇳소리 — 맞붙은 대마다 주기 틱에 한 번 (대 수가 많으면 더 자주 · 소리 쪽 간격이 상한)
  const first = Math.max(prev.tick + 1, cur.tick - F().maxCatchUpTicks + 1)
  const n = cur.squads.filter(isMelee).length
  if (n > 0) {
    for (let t = first; t <= cur.tick; t++) {
      for (const q of cur.squads) if (isMelee(q) && (t + q.id) % F().soundClashEveryTicks === 0) ev.push({ kind: 'clash', u: q.u, v: q.v, power: n })
    }
  }
  if (prev.end === null && cur.end !== null) ev.push({ kind: 'end', win: cur.winner === 0 })
  return ev
}

/** 깃발을 꽂은 순간의 사건 (명령 종류마다) */
export const flagEvent = (flag: FlagKind): SoundEvent => ({ kind: 'flag', flag })

const GAP: Readonly<Record<FieldSlot, () => number>> = {
  flag_charge: () => 0, flag_hold: () => 0, flag_open: () => 0, flag_move: () => 0, flag_horse: () => 0,
  war_cry: () => F().soundGapCryMs, war_drums: () => F().soundGapDrumsMs, horse_start: () => F().soundGapCryMs, hero_dash: () => F().soundGapMs, hero_art: () => F().soundGapMs,
  arrow_volley: () => F().soundGapVolleyMs, arrow_hit: () => F().soundGapArrowHitMs, clash: () => F().soundGapClashMs, impact: () => F().soundGapImpactMs,
  gate: () => F().soundGapMs, rout: () => F().soundGapRoutMs, end_win: () => F().soundGapEndMs, end_lose: () => F().soundGapEndMs,
  step_walk_few: () => 0, step_walk_mid: () => 0, step_walk_many: () => 0, step_run_few: () => 0, step_run_mid: () => 0, step_run_many: () => 0, hoof_walk: () => 0, hoof_gallop: () => 0,
}
const PRIORITY: Readonly<Record<FieldSlot, number>> = {
  end_win: 0, end_lose: 0, impact: 1, gate: 2, war_cry: 3, rout: 3,
  flag_charge: 4, flag_hold: 4, flag_open: 4, flag_move: 4, flag_horse: 4,
  horse_start: 5, war_drums: 5, hero_dash: 5, hero_art: 5, arrow_volley: 6, arrow_hit: 6, clash: 7, hoof_gallop: 8, step_run_few: 8, step_run_mid: 8, step_run_many: 8,
  hoof_walk: 9, step_walk_few: 9, step_walk_mid: 9, step_walk_many: 9,
}
const FLAG_SLOT: Readonly<Record<FlagKind, FieldSlot>> = { charge: 'flag_charge', hold: 'flag_hold', open: 'flag_open', horse: 'flag_horse', move: 'flag_move' }
/** 걷는 사람 수 → 단계. 이전 단계가 있으면 내려갈 때 문턱의 몇 % 아래까지 내려가야 바뀐다 */
export function tierOf(prev: number | undefined, men: number): number {
  const f = F(), lo = [0, f.soundTierMidMen, f.soundTierManyMen]
  const hyst = 1 - f.soundTierHystPct / 100
  let t = 0
  for (let i = 1; i < lo.length; i++) if (men >= lo[i]! || (prev !== undefined && prev >= i && men >= lo[i]! * hyst)) t = i
  return t
}
/** 이보다 작게 들리는 소리는 내지 않는다 */
const AUDIBLE_MIN = 0.02

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
  // 말발굽은 걷기와 질주가 같은 파일이라 걷기를 느리고 작게 갈라 낸다
  return loops.map(l => {
    const walk = l.base === 'hoof_walk'
    return { slot: l.slot, gain: l.vol * f.soundMasterPct / 100 * (walk ? f.soundHoofWalkGainPct / 100 : 1), pan: l.pan, rate: clamp(l.beatMul, f.soundLoopRateMinPct / 100, f.soundLoopRateMaxPct / 100) * (walk ? f.soundHoofWalkRatePct / 100 : 1) }
  })
}

interface Cand { play: Play; pri: number; at: number }

/**
 * 한 프레임. events 는 호출한 쪽이 낸다 (eventsFromDiff 의 결과 + 깃발 꽂기, 나중엔 엔진의 사건 줄).
 * 숨은 탭이면 아무것도 내지 않고, 앞 프레임 기억만 갈아 둔다 (돌아와서 밀린 소리를 몰아 틀지 않게).
 */
export function stepSound(st: SoundState, frame: SoundFrame, cam: SoundCam, events: readonly SoundEvent[], nowMs: number, hidden: boolean): SoundOut {
  if (hidden) return { state: { ...newSoundState(), last: frame, lastAt: st.lastAt }, plays: [], loops: [] }
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
  // 기병 질주 시작 — 돌격·옆치기로 달리기 시작한 순간 (한 번 · ran) · 달아나는 기병도 달린다
  const gallop: Record<number, 1> = {}
  for (const q of frame.squads) {
    if (q.grp !== 'horse' || q.men <= 0 || q.lock >= 0 || q.aim >= 0) continue
    if (q.ran > 0 || q.flee === 1) {
      gallop[q.id] = 1
      if (st.gallop[q.id] === undefined) add('horse_start', 0.6, q.u, q.v)
    }
  }
  const impactAt: Record<number, number> = { ...st.impactAt }
  const repeatTicks = Math.round(f.impactRepeatMs * f.hz / 1000)
  for (const e of events) {
    switch (e.kind) {
      case 'impact': {
        // 무리마다 첫 접촉에만 (같은 무리는 soundImpactRepeatMs 뒤에야 다시)
        if (e.id !== undefined && e.tick !== undefined) {
          const last = impactAt[e.id]
          if (last !== undefined && e.tick - last < repeatTicks && e.tick >= last) break
          impactAt[e.id] = e.tick
        }
        const power = clamp(e.power ?? 0, 0, 1000)
        const how = e.how ?? 0
        if (how === 2) add('impact', (0.5 + 0.5 * power / 1000) * f.soundBlockedGainPct / 100, e.u, e.v, false, f.soundBlockedRatePct / 100) // 막힘: 같은 소리를 낮은 세기·낮은 빠르기로
        else {
          add('impact', 0.5 + 0.5 * power / 1000, e.u, e.v)
          if (how === 1) add('war_drums', 0.6, e.u, e.v) // 상성이 맞음: 세게 + 형이 고른 북 한 번
        }
        duckUntil = nowMs + f.soundDuckMs
        break
      }
      case 'impactGood': add('war_drums', 0.6, e.u, e.v); break
      case 'clash': add('clash', 0.3 + 0.5 * Math.min(1, (e.power ?? 1) / f.soundMeleeCountCap), e.u, e.v); break
      case 'volley': add('arrow_volley', 0.5, e.u, e.v); break
      case 'arrowHit': add('arrow_hit', 0.5, e.u, e.v); break
      case 'gateBreak': add('gate', 0.8, e.u, e.v); break
      case 'rout': add('rout', 0.7, e.u, e.v); break
      case 'sideBreak': add('rout', 1, e.u, e.v); break // 편이 무너져 다 달아남: 무너지는 함성을 한 번 크게
      case 'stand': if (e.side === 0) add('war_cry', 0.6, e.u, e.v); break // 버팀: 형이 고른 함성 가운데 우리 편 것
      case 'regroup': if (e.side === 0) add('war_cry', 0.4, e.u, e.v); break // 다시 섬: 같은 함성을 작게 (우리 편만)
      case 'heroDown': // 장수가 쓰러짐: 적장이면 형이 고른 북과 함성을 크게 · 우리 장수면 쾅 한 번
        if (e.side === 1) { add('war_drums', 1, e.u, e.v); add('war_cry', 0.9, e.u, e.v) } else add('impact', 0.9, e.u, e.v)
        break
      case 'gritFull': add('war_drums', 0.7, undefined, undefined); break // 투지가 찼다: 북 한 번 (단추가 금빛으로 부를 때)
      case 'gritUse': add('war_cry', 0.8, undefined, undefined); break // 투지로 한 번 더: 비기 소리 위에 함성
      case 'heroDash': add('hero_dash', 0.5, e.u, e.v); break
      case 'heroSkill': add('hero_art', 0.7, e.u, e.v); break
      case 'artHit': add('impact', 0.7, e.u, e.v); break
      case 'end': add(e.win === true ? 'end_win' : 'end_lose', 0.9, undefined, undefined); break
      case 'flag': {
        const k = e.flag ?? 'move'
        add(FLAG_SLOT[k], 0.7, e.u, e.v)
        if (k === 'charge') add('war_cry', 0.6, e.u, e.v)
        break
      }
    }
  }
  // 난투 함성 — 맞붙은 대가 일정 수 이상이면 드문드문 한 번 (대 수에 비례해 커진다)
  const melee = frame.squads.filter(isMelee)
  let meleeCryAt = st.meleeCryAt
  if (melee.length >= f.soundMeleeCryMinEngaged && (meleeCryAt < 0 || nowMs - meleeCryAt >= f.soundMeleeCryEveryMs)) {
    const c = centerOf(melee)
    if (c !== null) { add('war_cry', 0.3 + 0.4 * Math.min(1, melee.length / f.soundMeleeCountCap), c.u, c.v); meleeCryAt = nowMs }
  }

  // 이어지는 소리 — 종류마다 한 줄 · 대마다 사람 수와 들림을 더하고, 걸음 빠르기는 박자 배율로 낸다
  // 발소리는 한 명분 토막을 여러 겹으로 미리 구운 파일 세 단계(적음 · 보통 · 많음)가 있어 걷는 사람 수에 따라 하나를 고른다
  const duck = nowMs < duckUntil ? f.soundDuckPct / 100 : 1
  const groups = new Map<LoopBase, { w: number; pan: number; mul: number; men: number }>()
  for (const q of frame.squads) {
    const sp = speeds[q.id] ?? 0
    if (q.men <= 0 || q.lock >= 0 || (q.grp !== 'bows' && q.aim >= 0) || (sp <= 0 && q.ran <= 0)) continue
    // 달리는 발소리 = 돌격·옆치기로 달리는 중(ran)이거나 달아나는 중(flee) · 아니면 걷는 발소리 · 기병은 질주 발굽과 걷기 발굽
    const running = q.ran > 0 || q.flee === 1
    const base: LoopBase = q.grp === 'horse' ? (gallop[q.id] === 1 ? 'hoof_gallop' : 'hoof_walk') : running ? 'step_run' : 'step_walk'
    const a = audible(cam, q.u, q.v)
    // 질주는 적 가까이 갈수록 커져 접촉 직전에 가장 크다 (접촉하면 맞붙음으로 빠져 곧바로 끊긴다 · 꼬리 soundLoopTailMs)
    const near = base === 'hoof_gallop' ? f.soundGallopFarPct / 100 + (1 - f.soundGallopFarPct / 100) * clamp(1 - nearestFoeCells(frame, q) / f.soundGallopRangeCells, 0, 1) : 1
    const w = q.men * a.gain * near
    const g = groups.get(base) ?? { w: 0, pan: 0, mul: 0, men: 0 }
    g.w += w; g.pan += w * a.pan; g.mul += w * (sp / refSpeed(q.grp)); g.men += a.inView ? q.men : 0
    groups.set(base, g)
  }
  const loops: LoopInfo[] = []
  const tiers: Record<string, number> = { ...st.tiers }
  const xfade: Record<string, { from: number; at: number }> = {}
  for (const [k, v] of Object.entries(st.xfade)) if (nowMs - v.at < f.soundTierXfadeMs && nowMs >= v.at) xfade[k] = v
  for (const [base, g] of groups) {
    if (g.w <= 0) continue
    const mul = clamp(g.mul / g.w, f.soundBeatMulMinPct / 100, f.soundBeatMulMaxPct / 100)
    const beat = base === 'step_walk' ? f.soundWalkBeatMs : base === 'step_run' ? f.soundRunBeatMs : base === 'hoof_walk' ? f.soundHoofWalkBeatMs : f.soundHoofGallopBeatMs
    const vol = f.soundLoopVolPct / 100 * Math.sqrt(Math.min(1, g.w / f.soundLoopMenRef)) * duck
    const pan = g.pan / g.w
    const crowd = base === 'step_walk' || base === 'step_run'
    const tier = crowd ? tierOf(st.tiers[base], g.men) : 0
    if (crowd && st.tiers[base] !== undefined && tier !== st.tiers[base]) xfade[base] = { from: st.tiers[base]!, at: nowMs }
    tiers[base] = tier
    const x = xfade[base]
    const t = x === undefined ? 1 : clamp((nowMs - x.at) / Math.max(1, f.soundTierXfadeMs), 0, 1)
    const one = (tr: number, k: number): void => { loops.push({ slot: tierSlot(base, tr), base, tier: tr, vol: vol * k, pan, beatMul: mul, beatMs: beat / mul }) }
    // 단계가 바뀌는 동안은 옛 단계는 줄고 새 단계는 늘어난다 (같은 힘 겹침 · 뚝 끊기지 않게)
    if (x !== undefined && t < 1) { one(x.from, Math.cos(t * Math.PI / 2)); one(tier, Math.sin(t * Math.PI / 2)) } else one(tier, 1)
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
  const next: SoundState = { last: advanced ? frame : st.last, speeds, gallop, lastAt, tiers, xfade, lastNow: nowMs, duckUntil, impactAt, meleeCryAt }
  return { state: next, plays, loops }
}

/** 돌고 있는 이어지는 소리 하나 — 마지막으로 목표에 있던 시각(ms)과 지금 목표 크기 */
export interface LoopRun { lastSeen: number; gain: number }
/** 재생 쪽이 할 일: start 새로 틂 · set 크기·빠르기·좌우만 바꿈(고리는 안 끊긴다) · mute 목표에서 빠져 조용히(고리는 살려 둔다) · stop 실제로 멈춤. tc = 시간 상수(초) */
export interface LoopAction { op: 'start' | 'set' | 'mute' | 'stop'; slot: FieldSlot; gain: number; pan: number; rate: number; tc: number }

/**
 * 고리를 끊지 않고 세기·빠르기만 soundLoopFadeMs 에 걸쳐 바꾼다. 목표에서 빠진 고리는 꼬리 soundLoopTailMs 로 조용해지되 (쾅과 함께 끊김)
 * 살려 두고, 다시 목표가 되면 이어서 키운다. 실제로 멈추는 것(다음에 새로 트는 것)은 빠진 지 soundLoopHoldMs 가 넘은 뒤뿐이다 —
 * 걷기·질주 갈림이나 단계가 틱마다 뒤집혀도 0.4초마다 다시 시작하지 않는다 (11-25 검수: 말발굽 고리가 한 판에 42번 다시 시작됐다).
 */
export function planLoops(run: Readonly<Record<string, LoopRun>>, targets: readonly LoopTarget[], nowMs: number): { run: Record<string, LoopRun>; actions: LoopAction[] } {
  const f = F()
  const next: Record<string, LoopRun> = {}
  const actions: LoopAction[] = []
  const fadeTc = f.soundLoopFadeMs / 3000, tailTc = f.soundLoopTailMs / 3000
  const seen = new Set<string>()
  for (const t of targets) {
    seen.add(t.slot)
    next[t.slot] = { lastSeen: nowMs, gain: t.gain }
    actions.push({ op: run[t.slot] === undefined ? 'start' : 'set', slot: t.slot, gain: t.gain, pan: t.pan, rate: t.rate, tc: fadeTc })
  }
  for (const [slot, r] of Object.entries(run)) {
    if (seen.has(slot)) continue
    if (nowMs - r.lastSeen > f.soundLoopHoldMs) { actions.push({ op: 'stop', slot: slot as FieldSlot, gain: 0, pan: 0, rate: 1, tc: tailTc }); continue }
    next[slot] = { lastSeen: r.lastSeen, gain: 0 }
    if (r.gain > 0) actions.push({ op: 'mute', slot: slot as FieldSlot, gain: 0, pan: 0, rate: 1, tc: tailTc })
  }
  return { run: next, actions }
}
