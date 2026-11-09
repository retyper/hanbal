/**
 * 장수 겨루기 시험판의 셈 (duel.html · docs/realm/council/1109-battle.md).
 *
 * 형 11-09: "타이밍 탭 식 패링 · 준비동작 타격동작 마무리 동작 · 공격 방어 패링 회피를 실시간으로 ·
 * 타이밍 잘 맞출수록 공격력 강화 · 자동은 기존 시스템대로".
 *
 * 적장은 수 셋 가운데 하나를 준비한다 — 빠른 찌르기 · 크게 휘두르기 · 속임수(헛동작 뒤 진짜).
 * 우리는 셋 가운데 고른다 — 받아치기(타격 순간) · 피하기(물러섬 → 빈틈) · 치기(빈틈에 · 느린 준비를 먼저 끊음).
 * 고를 것이 있는 타이밍이다: 같은 낌새에도 받아칠지(크게 얻고 크게 잃음) 피할지(안전) 끊을지(읽었으면 가장 큼) 다르다.
 *
 * 결정론 (ARCHITECTURE A1): 틱 하나씩, 입력은 { 틱, 손 } 뿐 · 적장의 고름은 시드 난수. 같은 시드 + 같은 입력 = 같은 판.
 * DOM·시계 없음. 그리기(duel-main.ts)는 이 상태를 읽기만 한다.
 */
import { makeRng, type Rng } from '../core/rng.ts'
import { P } from '../tune/params.ts'

export type Act = 'parry' | 'dodge' | 'strike'
export type FoeMove = 'jab' | 'heavy' | 'feint'
export type EvKind = 'perfect' | 'parry' | 'hit' | 'dodge' | 'counter' | 'interrupt' | 'clash' | 'blocked' | 'feint' | 'whiff' | 'windup'
export interface DuelEvent { readonly t: number; readonly kind: EvKind; readonly move?: FoeMove; readonly dmgMe: number; readonly dmgFoe: number }

export interface DuelOpts { readonly seed: number; readonly muMe: number; readonly muFoe: number }

export interface FoeAttack {
  readonly kind: FoeMove
  readonly t0: number
  /** 속임수의 헛동작 틱 (없으면 undefined) */
  readonly fakeAt?: number
  readonly strikeAt: number
}

export interface Duel {
  readonly opts: DuelOpts
  t: number
  readonly end: number
  me: {
    poise: number
    /** 이 틱까지 새 손을 못 낸다 */
    lockUntil: number
    /** 마지막으로 받아치기를 누른 틱 */
    parryAt: number
    dodgeAt: number
    /** 우리 치기 — 칼이 닿는 틱 (없으면 −1) */
    strikeLand: number
    strikeAt: number
    stunUntil: number
  }
  foe: {
    poise: number
    move: FoeAttack | null
    nextAt: number
    /** 이 틱까지 빈틈 (튕겨 냄·비킴·끊김 뒤) */
    openUntil: number
    stunUntil: number
    /** 막 끝낸 수 — 그리기용 (마무리 동작) */
    last: { kind: FoeMove; strikeAt: number; until: number } | null
  }
  events: DuelEvent[]
  over: null | 'win' | 'lose' | 'draw'
  stats: { perfect: number; parry: number; dodge: number; counter: number; interrupt: number; hit: number }
  rng: Rng
}

const D = (): typeof P.duel => P.duel

/** 적장 무예가 준비동작을 줄이는 배수 */
const speedOf = (mu: number): number => Math.max(0.6, 1 - D().muSpeed * (mu - 5))
/** 우리 장수 무예가 받아치기 폭을 넓히는 배수 */
const widthOf = (mu: number): number => Math.max(0.5, 1 + D().muWindow * (mu - 5))

export function createDuel(opts: DuelOpts): Duel {
  const R = D()
  const rng = makeRng((opts.seed ^ 0x6d75656c) >>> 0)
  return {
    opts,
    t: 0,
    end: Math.round(R.length),
    me: { poise: R.poise, lockUntil: 0, parryAt: -999, dodgeAt: -999, strikeLand: -1, strikeAt: -999, stunUntil: 0 },
    foe: { poise: R.poise, move: null, nextAt: 50, openUntil: 0, stunUntil: 0, last: null },
    events: [],
    over: null,
    stats: { perfect: 0, parry: 0, dodge: 0, counter: 0, interrupt: 0, hit: 0 },
    rng,
  }
}

const ev = (d: Duel, kind: EvKind, dmgMe: number, dmgFoe: number, move?: FoeMove): void => {
  d.me.poise = Math.max(0, d.me.poise - dmgMe)
  d.foe.poise = Math.max(0, d.foe.poise - dmgFoe)
  d.events.push(move === undefined ? { t: d.t, kind, dmgMe, dmgFoe } : { t: d.t, kind, move, dmgMe, dmgFoe })
}

function pickMove(d: Duel): FoeMove {
  const R = D()
  const tot = R.wJab + R.wHeavy + R.wFeint
  const x = d.rng.next() * tot
  return x < R.wJab ? 'jab' : x < R.wJab + R.wHeavy ? 'heavy' : 'feint'
}

function startMove(d: Duel): void {
  const R = D()
  const sp = speedOf(d.opts.muFoe)
  const kind = pickMove(d)
  const t0 = d.t
  if (kind === 'feint') {
    const fakeAt = t0 + Math.round(R.feintWind * sp)
    d.foe.move = { kind, t0, fakeAt, strikeAt: fakeAt + Math.round(R.feintReal * sp) }
  } else {
    d.foe.move = { kind, t0, strikeAt: t0 + Math.round((kind === 'jab' ? R.jabWind : R.heavyWind) * sp) }
  }
  ev(d, 'windup', 0, 0, kind)
}

function endMove(d: Duel, recover: number): void {
  const R = D()
  const m = d.foe.move
  if (m !== null) d.foe.last = { kind: m.kind, strikeAt: m.strikeAt, until: d.t + recover }
  d.foe.move = null
  d.foe.nextAt = d.t + recover + Math.round(R.gapMin + d.rng.next() * Math.max(0, R.gapMax - R.gapMin))
}

/** 적장의 타격이 닿는 틱 — 늦게 누른 손을 받아 주는 틈만큼 뒤에 판정한다 */
function resolveStrike(d: Duel, m: FoeAttack): void {
  const R = D()
  const w = widthOf(d.opts.muMe)
  const heavy = m.kind === 'heavy'
  const good = Math.round((heavy ? R.heavyGood : R.parryGood) * w)
  const perfect = Math.round(R.parryPerfect * w)
  const dp = d.me.parryAt - m.strikeAt
  const dd = m.strikeAt - d.me.dodgeAt
  const recover = heavy ? R.heavyRecover : R.jabRecover
  if (dd >= 0 && dd <= R.dodgeSafe) {
    d.stats.dodge++
    const open = Math.round(R.openTicks * (heavy ? R.dodgeOpenHeavy : R.dodgeOpenLight))
    d.foe.openUntil = d.t + open
    d.me.lockUntil = Math.min(d.me.lockUntil, d.t + 4) // 비켜 내면 곧 칠 수 있다
    ev(d, 'dodge', 0, 0, m.kind)
    endMove(d, recover + Math.round(open * 0.5))
    return
  }
  if (dp >= -good && dp <= R.parryLate) {
    d.me.lockUntil = d.t // 막아 내면 곧 풀린다 — 헛누름만 묶인다
    if (Math.abs(dp) <= perfect) {
      d.stats.perfect++
      d.foe.openUntil = d.t + Math.round(R.openTicks)
      d.foe.stunUntil = d.t + Math.round(R.stunTicks)
      ev(d, 'perfect', 0, Math.round(R.perfect * (heavy ? R.perfectHeavy : 1)), m.kind)
      endMove(d, recover + Math.round(R.openTicks * 0.5))
    } else {
      d.stats.parry++
      ev(d, 'parry', heavy ? R.heavyChip : 0, R.good, m.kind)
      endMove(d, recover)
    }
    return
  }
  d.stats.hit++
  d.me.stunUntil = d.t + Math.round(R.stunTicks)
  d.me.lockUntil = Math.max(d.me.lockUntil, d.me.stunUntil)
  d.me.strikeLand = -1 // 맞으면 내던 칼이 흩어진다
  ev(d, 'hit', heavy ? R.hitHeavy : R.hitJab, 0, m.kind)
  endMove(d, recover)
}

/** 우리 칼이 닿는 틱 */
function landStrike(d: Duel): void {
  const R = D()
  d.me.strikeLand = -1
  const m = d.foe.move
  if (d.t < d.foe.openUntil || d.t < d.foe.stunUntil) {
    d.stats.counter++
    d.foe.stunUntil = d.t + Math.round(R.stunTicks)
    ev(d, 'counter', 0, R.counter)
    return
  }
  if (m !== null && d.t < m.strikeAt) {
    // 크게 휘두르기·속임수는 칼을 다 들어 올리면(준비의 armor 몫 뒤) 버틴다 — 늦게 끊으면 우리 칼이 튕긴다
    const upTo = m.fakeAt ?? m.strikeAt
    const armored = m.kind !== 'jab' && (m.fakeAt === undefined || d.t < m.fakeAt) && d.t >= m.t0 + Math.round(R.armor * (upTo - m.t0))
    if (armored) {
      d.me.stunUntil = d.t + Math.round(R.stunTicks)
      d.me.lockUntil = Math.max(d.me.lockUntil, d.me.stunUntil)
      ev(d, 'blocked', R.blockedChip, 0, m.kind)
      return
    }
    if (m.kind === 'jab' || (m.fakeAt !== undefined && d.t >= m.fakeAt)) {
      // 빠른 찌르기와는 맞부딪힌다 — 둘 다 조금씩
      ev(d, 'clash', R.clash, R.clash, m.kind)
      endMove(d, R.jabRecover)
      return
    }
    d.stats.interrupt++
    d.foe.stunUntil = d.t + Math.round(R.stunTicks)
    d.foe.openUntil = d.t + Math.round(R.openTicks * 0.5)
    ev(d, 'interrupt', 0, R.interrupt, m.kind)
    endMove(d, R.heavyRecover)
    return
  }
  // 서 있는 적장을 치면 막히고 칼이 튕긴다 — 비틀거리는 사이 적장이 곧바로 되친다 (마구 누르기 막기)
  d.me.stunUntil = d.t + Math.round(R.stunTicks)
  d.me.lockUntil = Math.max(d.me.lockUntil, d.me.stunUntil)
  if (d.foe.move === null) d.foe.nextAt = Math.min(d.foe.nextAt, d.t + 2)
  ev(d, 'blocked', R.blockedChip, 0)
}

/** 한 틱. input 은 이 틱에 누른 손 (없으면 undefined) */
export function stepDuel(d: Duel, input?: Act): void {
  if (d.over !== null) return
  const R = D()
  d.t++
  // ── 우리 손
  if (input !== undefined && d.t >= d.me.lockUntil) {
    if (input === 'parry') {
      d.me.parryAt = d.t
      d.me.lockUntil = d.t + Math.round(R.parryLock)
    } else if (input === 'dodge') {
      d.me.dodgeAt = d.t
      d.me.lockUntil = d.t + Math.round(R.dodgeLen)
    } else {
      d.me.strikeAt = d.t
      d.me.strikeLand = d.t + Math.round(R.strikeWind)
      d.me.lockUntil = d.t + Math.round(R.strikeWind + R.strikeRecover)
    }
  }
  if (d.me.strikeLand === d.t) landStrike(d)
  // ── 적장
  const m = d.foe.move
  if (m !== null) {
    if (m.fakeAt === d.t) ev(d, 'feint', 0, 0, m.kind)
    if (d.t === m.strikeAt + Math.round(R.parryLate)) resolveStrike(d, m)
  } else if (d.t >= d.foe.nextAt && d.t >= d.foe.stunUntil && d.t >= d.foe.openUntil) {
    startMove(d)
  }
  // ── 끝
  if (d.foe.poise <= 0) d.over = 'win'
  else if (d.me.poise <= 0) d.over = 'lose'
  else if (d.t >= d.end) {
    const diff = d.me.poise - d.foe.poise
    d.over = diff > R.drawBand ? 'win' : diff < -R.drawBand ? 'lose' : 'draw'
  }
}

/** 맡겼을 때 이길 몫 — 본편 겨루기와 같은 셈 (tactics.ts · tacDuelPerMu) */
export const autoWinChance = (muMe: number, muFoe: number): number =>
  Math.min(0.9, Math.max(0.1, 0.5 + P.realm.tacDuelPerMu * (muMe - muFoe)))

/** 그리기용: 적장이 지금 어느 단계인가 */
export type FoePhase = 'idle' | 'windup' | 'fake' | 'strike' | 'recover' | 'stun'
export function foePhase(d: Duel): { phase: FoePhase; k: number; kind?: FoeMove } {
  const m = d.foe.move
  if (d.t < d.foe.stunUntil) return { phase: 'stun', k: 0 }
  if (m !== null) {
    if (m.fakeAt !== undefined && d.t < m.fakeAt) return { phase: 'windup', k: (d.t - m.t0) / (m.fakeAt - m.t0), kind: m.kind }
    if (m.fakeAt !== undefined && d.t < m.fakeAt + 8) return { phase: 'fake', k: (d.t - m.fakeAt) / 8, kind: m.kind }
    const from = m.fakeAt !== undefined ? m.fakeAt + 8 : m.t0
    if (d.t < m.strikeAt) return { phase: 'windup', k: (d.t - from) / Math.max(1, m.strikeAt - from), kind: m.kind }
    return { phase: 'strike', k: 1, kind: m.kind }
  }
  const l = d.foe.last
  if (l !== null && d.t < l.until) return { phase: 'recover', k: (d.t - l.strikeAt) / Math.max(1, l.until - l.strikeAt), kind: l.kind }
  return { phase: 'idle', k: 0 }
}
