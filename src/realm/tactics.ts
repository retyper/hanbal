/**
 * 직접 지휘하는 싸움 — 라운드마다 명령 하나 (docs/realm/BATTLE.md · 형 2026-10-19:
 * "포켓몬이나 가위바위보식 상성 · 포획시도는 유저가 직접 · 열세여도 잘 판단하면 이기고 우세여도 잘못 판단하면 진다")
 *
 * 한 판은 tacRounds 라운드. 라운드마다 두 쪽이 **동시에** 명령을 낸다 — 상대는 우리의 이번 선택을 보지 않는다.
 *   세모: 돌격 > 화살비 > 방진 > 돌격 (돌격은 활을 쏘는 쪽을 덮치고, 화살비는 서 있는 방패 벽을 두드리고, 방진은 돌격을 꺾는다)
 *   명령의 세기는 병종 구성이 정한다 — 창·기병은 돌격, 궁수·쇠뇌는 화살비, 방패·장창은 방진. 물 위에서는 수군이 돌격·화살비에 낀다.
 *   한 번씩 쓰는 것: 옆치기(산기슭으로 돌아왔거나 들길의 기병) · 불(갈대·숲, 여름이 아닐 때) · 일기토(무예 높은 장수끼리)
 *   사로잡기: 적이 줄수록 · 적 사기가 꺾일수록 · 우리가 우세할수록 잘 된다. 실패하면 그 라운드를 쫓는 데 쓴다.
 *   물러나기: 손실을 줄이고 끝낸다.
 * 라운드마다 밀린 만큼 사람이 줄고 사기가 오간다. 처음보다 많이 줄었거나 사기가 꺾이면 무너진다.
 * 끝까지 가면 남은 전투력의 몫으로 결과 다섯 칸(대승~대패)이 정해진다.
 *
 * 전부 순수 함수다. 굴림은 이름이 있다 (core/rng.ts roll) — `${key}:t${i}:…`. 같은 판 같은 명령이면 같은 결과다 (A1).
 * 플레이어 쪽 명령은 Tactic 으로 들어온다. 모자란 라운드는 맡긴다 — 같은 AI 가 고른다 (봇 시뮬도 이 길이다).
 */
import { roll } from '../core/rng.ts'
import { P } from '../tune/params.ts'
import type { Outcome, UnitKind } from './battle.ts'
import type { Cmd, Pending, RoundLog, Tactic } from './types.ts'

/** 한쪽의 싸움 입력 */
export interface Side {
  /** 처음 전투력 (자리·상성·진군 방식까지 곱한 값) */
  readonly F: number
  readonly mix: Readonly<Partial<Record<UnitKind, number>>>
  /** 처음 사기 — F 에 이미 들어 있다. 라운드의 사기는 이것에 대한 비로 F 를 흔든다 */
  readonly morale: number
  /** 싸움 앞의 사기 덤·감 (대로로 질서 있게 · 절벽에서 적이 뒤에 나타났다 …) */
  readonly moraleBonus?: number
  readonly hero: { readonly id: string; readonly mu: number; readonly ryak: number; readonly coward: boolean } | null
  /** 군량이 바닥이다 — 라운드마다 사기가 꺾인다 */
  readonly hungry: boolean
  /** 이 싸움에서 쓸 수 있는 한 번짜리 명령 (옆치기 · 불) — 일기토·사로잡기는 장수로 정해진다 */
  readonly specials: readonly Cmd[]
  /** 물 위 싸움 — 수군이 돌격·화살비에 낀다 */
  readonly water: boolean
  /** 플레이어 쪽인가 — Tactic 이 이쪽에 걸린다 */
  readonly player: boolean
  /** 상대를 보고 있나 (이번 계절 정찰·첩자 · 지키는 쪽은 다가오는 것을 봤다) — 낌새가 잘 맞는다 */
  readonly seen: boolean
  /** 사로잡기 가산 (저격 발 묶음 …) */
  readonly captureBonus?: number
  /** 맡겼을 때의 성향 — 겁 많은 장수는 일찍 물러난다 */
}

export interface FightResult {
  readonly outcome: Outcome
  /** 처음 사람에 대한 남은 몫 0~1 — 부른 쪽이 군대에 곱한다 */
  readonly na: number
  readonly nd: number
  /** 사기 변화 (끝 - 처음) — 부른 쪽이 군대 사기에 더한다 */
  readonly dma: number
  readonly dmd: number
  /** 사로잡힌 쪽 (그 쪽 장수가 잡혔다) */
  readonly captured: 'a' | 'd' | null
  /** 무너진 쪽 — 그 쪽 장수가 난전에 쓰러질 수 있다 */
  readonly broke: 'a' | 'd' | null
  /** 일기토에서 진 장수 — 쓰러졌나 다쳤나 */
  readonly duel: { readonly loser: 'a' | 'd'; readonly kill: boolean } | null
  readonly rounds: readonly RoundLog[]
  readonly pending?: Pending
  /** 플레이어가 명령을 하나라도 냈나 */
  readonly led: boolean
}

export const BASIC: readonly Cmd[] = ['charge', 'volley', 'hold']
/** 세모 — 열쇠가 값을 이긴다 */
export const BEATS: Readonly<Partial<Record<Cmd, Cmd>>> = { charge: 'volley', volley: 'hold', hold: 'charge' }
/** 값을 이기는 명령 */
export const COUNTER: Readonly<Partial<Record<Cmd, Cmd>>> = { volley: 'charge', hold: 'volley', charge: 'hold' }

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x))
}

/** 두 세기의 몫 — a^k / (a^k + d^k). 라운드마다 쌓이니 한 번 굴림의 battleK 보다 무르게 (tacK) */
export function edgeOf(a: number, d: number): number {
  const k = P.realm.tacK
  const x = Math.pow(Math.max(0, a), k)
  const y = Math.pow(Math.max(0, d), k)
  return x + y === 0 ? 0.5 : x / (x + y)
}

/** 병종 몫 — 돌격 · 화살비 · 방진에 맞는 사람의 몫 */
export function shares(mix: Readonly<Partial<Record<UnitKind, number>>>, water: boolean): { charge: number; volley: number; hold: number } {
  let n = 0
  for (const v of Object.values(mix)) n += v ?? 0
  if (n <= 0) return { charge: 0, volley: 0, hold: 0 }
  const g = (k: UnitKind): number => mix[k] ?? 0
  const boat = water ? g('boat') : 0
  return {
    charge: (g('spear') + g('horse') + g('pike') * 0.5 + boat * 0.5) / n,
    volley: (g('bow') + g('crossbow') + boat * 0.5) / n,
    hold: (g('shield') + g('pike') * 0.5) / n,
  }
}

/** 명령 하나의 세기 — 병종 구성으로 (0.5~1.7 쯤). 사로잡기·물러나기는 싸우는 세기가 아니다 */
export function might(side: Pick<Side, 'mix' | 'water'>, cmd: Cmd): number {
  const R = P.realm
  const s = shares(side.mix, side.water)
  const base = (x: number): number => R.tacShareBase + R.tacShareGain * x
  switch (cmd) {
    case 'charge': return base(s.charge) * R.tacChargeMul
    case 'volley': return base(s.volley)
    case 'hold': return base(s.hold) * R.tacHoldMul
    case 'flank': return base(s.charge) * R.tacFlankMul
    case 'fire': return 1
    case 'duel': return 1
    case 'capture': return R.tacCapSpend
    case 'retreat': return 0
  }
}

function taken(cmd: Cmd): number {
  const R = P.realm
  switch (cmd) {
    case 'charge': case 'flank': return R.tacTakenCharge
    case 'hold': return R.tacTakenHold
    case 'volley': return R.tacTakenVolley
    case 'capture': return R.tacTakenCapture
    default: return 1
  }
}

interface State {
  na: number
  nd: number
  ma: number
  md: number
  usedA: Set<Cmd>
  usedD: Set<Cmd>
  /** 일기토로 장수를 잃은 쪽 */
  lostA: boolean
  lostD: boolean
  /** 일기토로 다친 장수 — 사로잡기가 쉽다 */
  hurtA: boolean
  hurtD: boolean
}

/** 남은 전투력 — 처음 F × 남은 사람 × 사기의 비 × 장수를 잃었으면 */
function live(s: Side, n: number, m: number, lost: boolean): number {
  return s.F * n * (m / Math.max(0.05, s.morale)) * (lost ? P.realm.tacDuelLeader : 1)
}

/** 남은 전투력의 몫 — 공격 쪽 시점 0~1 */
function shareOf(a: Side, d: Side, st: State): number {
  return edgeOf(live(a, st.na, st.ma, st.lostA), live(d, st.nd, st.md, st.lostD))
}

/**
 * 사로잡기 확률 — `me` 가 `foe` 의 장수를 (형: "적군의 전체적 수가 줄 수록 포획 확률이 높아지는거고")
 *   바탕 + 적이 줄어든 몫 + 남은 전투력이 우리 쪽으로 기운 몫 + 적 사기가 꺾인 몫 + 무예 차이
 * 겁 많은 장수는 먼저 달아나 반으로 준다. 적장이 없으면 0.
 */
export function captureChance(me: Side, foe: Side, myN: number, foeN: number, foeM: number, edge: number, foeHurt: boolean): number {
  const R = P.realm
  if (foe.hero === null) return 0
  let c = R.tacCapBase + R.tacCapPerLoss * (1 - foeN) + R.tacCapEdge * (edge - 0.5)
  c += R.tacCapMorale * Math.max(0, 1 - foeM / Math.max(0.05, foe.morale))
  c += R.tacCapPerMu * ((me.hero?.mu ?? 3) - foe.hero.mu)
  c += me.captureBonus ?? 0
  if (foeHurt) c += 0.2
  // 우리가 거의 다 잃었으면 쫓을 사람이 없다
  c *= clamp(myN / 0.5, 0, 1)
  if (foe.hero.coward) c *= 0.5
  return clamp(c, R.tacCapMin, R.captureMax)
}

/** 이 라운드에 고를 수 있는 명령 */
export function optionsOf(me: Side, foe: Side, used: ReadonlySet<Cmd>, foeHeroGone: boolean): Cmd[] {
  const out: Cmd[] = [...BASIC]
  for (const c of me.specials) if ((c === 'flank' || c === 'fire') && !used.has(c)) out.push(c)
  if (me.hero !== null && foe.hero !== null && !foeHeroGone && me.hero.mu >= P.realm.tacDuelMu && !used.has('duel')) out.push('duel')
  if (foe.hero !== null && !foeHeroGone) out.push('capture')
  out.push('retreat')
  return out
}

/**
 * 맡긴 쪽의 명령 — 제 처지와 상대 구성만 보고 (상대의 이번 선택은 모른다).
 * 상대가 가장 센 명령을 낼 거라 보고 지략만큼 그 맞수를 고르거나, 제 가장 센 명령을 고른다.
 * 그래서 플레이어는 "적은 궁수가 많으니 화살비를 낼 것 → 돌격" 을 읽을 수 있고, 적장이 꾀가 많으면 한 수 더 읽힌다.
 */
export function aiCmd(me: Side, foe: Side, opts: readonly Cmd[], cap: number, edge: number, myN: number, atk: boolean, key: string, seed: number, season: number): Cmd {
  const R = P.realm
  const r = (k: string): number => roll(seed, season, `${key}:${k}`)
  if (opts.includes('capture') && cap >= R.tacAiCapture) return 'capture'
  // 밀린다 — 치러 온 쪽은 물러난다. 지키는 쪽은 끝까지 버틴다 (겁 많은 장수는 일찍)
  const coward = me.hero?.coward === true
  if (atk && edge < (coward ? 0.35 : 0.22) && myN < 0.75) return 'retreat'
  if (!atk && edge < 0.12 && myN < 0.5) return 'retreat'
  if (opts.includes('fire') && r('fire') < 0.55) return 'fire'
  if (opts.includes('flank') && r('flank') < 0.6) return 'flank'
  if (opts.includes('duel') && me.hero !== null && foe.hero !== null && me.hero.mu >= foe.hero.mu + 1 && r('duel') < 0.5) return 'duel'
  // 상대의 가장 센 명령
  const foeBest = [...BASIC].sort((x, y) => might(foe, y) - might(foe, x))[0]!
  const ryak = me.hero?.ryak ?? 3
  const pCounter = clamp(R.tacAiCounter + 0.05 * (ryak - 5), 0.1, 0.9)
  if (r('counter') < pCounter) {
    const c = COUNTER[foeBest]!
    if (might(me, c) >= 0.75) return c
  }
  // 제 세기대로 — 센 명령일수록 잘 고른다 (세제곱으로 무게)
  const w = BASIC.map((c) => Math.pow(might(me, c), 3))
  const sum = w.reduce((s, x) => s + x, 0)
  let x = r('pick') * sum
  for (let i = 0; i < BASIC.length; i++) {
    x -= w[i]!
    if (x < 0) return BASIC[i]!
  }
  return BASIC[BASIC.length - 1]!
}

/** 귀띔 — 적의 이번 명령을 맞힐 수도 틀릴 수도 있다 */
function hintOf(me: Side, foeCmd: Cmd, key: string, seed: number, season: number): Cmd {
  const R = P.realm
  const acc = Math.min(0.95, (me.seen ? R.tacHintScout : R.tacHintBase) + R.tacHintPerRyak * Math.max(0, (me.hero?.ryak ?? 1) - 5))
  if (roll(seed, season, `${key}:hint`) < acc) return foeCmd
  const others = BASIC.filter((c) => c !== foeCmd)
  return others[Math.floor(roll(seed, season, `${key}:hint-alt`) * others.length)] ?? 'charge'
}

/**
 * 한 판을 싸운다. `tactic` 은 플레이어 쪽(atk.player 또는 def.player)의 명령.
 * 굴림 열쇠는 `key` — season.battleKey 와 같은 값을 넣는다.
 */
export function fightRounds(atk: Side, def: Side, key: string, seed: number, season: number, tactic?: Tactic): FightResult {
  const R = P.realm
  const st: State = {
    na: 1, nd: 1,
    ma: atk.morale + (atk.moraleBonus ?? 0), md: def.morale + (def.moraleBonus ?? 0),
    usedA: new Set(), usedD: new Set(), lostA: false, lostD: false, hurtA: false, hurtD: false,
  }
  const rounds: RoundLog[] = []
  const memo: { pending?: Pending; led: boolean } = { led: false }
  let captured: 'a' | 'd' | null = null
  let broke: 'a' | 'd' | null = null
  let retreat: 'a' | 'd' | 'both' | null = null
  let duel: { loser: 'a' | 'd'; kill: boolean } | null = null
  const rk = (i: number, k: string): number => roll(seed, season, `${key}:t${i}:${k}`)
  const total = Math.max(1, Math.round(R.tacRounds))

  for (let i = 0; i < total; i++) {
    const edge = shareOf(atk, def, st)
    const capA = captureChance(atk, def, st.na, st.nd, st.md, edge, st.hurtD)
    const capD = captureChance(def, atk, st.nd, st.na, st.ma, 1 - edge, st.hurtA)
    const goneD = st.lostD && duel?.kill === true && duel.loser === 'd'
    const goneA = st.lostA && duel?.kill === true && duel.loser === 'a'
    const optA = optionsOf(atk, def, st.usedA, goneD)
    const optD = optionsOf(def, atk, st.usedD, goneA)
    const ai = (me: Side, foe: Side, opts: Cmd[], cap: number, e: number, n: number, isAtk: boolean): Cmd =>
      aiCmd(me, foe, opts, cap, e, n, isAtk, `${key}:t${i}:${isAtk ? 'a' : 'd'}`, seed, season)
    // 맡긴 쪽(또는 AI)을 먼저 정한다 — 플레이어의 이번 선택을 보지 않는다
    const aiA = ai(atk, def, optA, capA, edge, st.na, true)
    const aiD = ai(def, atk, optD, capD, 1 - edge, st.nd, false)
    const pick = (me: Side, opts: Cmd[], aiPick: Cmd, foePick: Cmd, cap: number, isAtk: boolean): Cmd => {
      if (!me.player || tactic === undefined) return aiPick
      const c = tactic.cmds[i]
      if (c !== undefined && opts.includes(c)) {
        memo.led = true
        return c
      }
      if (c === undefined && tactic.open === true && memo.pending === undefined) {
        const m: Partial<Record<Cmd, number>> = {}
        for (const o of opts) m[o] = might(me, o)
        memo.pending = { round: i, options: opts, might: m, capture: cap, hint: hintOf(me, foePick, `${key}:t${i}`, seed, season), weAtk: isAtk, seen: me.seen }
      }
      return aiPick
    }
    const cA = pick(atk, optA, aiA, aiD, capA, true)
    const cD = pick(def, optD, aiD, aiA, capD, false)
    if (cA === 'duel') st.usedA.add('duel')
    if (cD === 'duel') st.usedD.add('duel')
    if (cA === 'flank' || cA === 'fire') st.usedA.add(cA)
    if (cD === 'flank' || cD === 'fire') st.usedD.add(cD)

    // 물러나기 — 싸우기 전에 끝난다. 물러나는 쪽은 그 라운드 몫의 일부만 잃는다
    if (cA === 'retreat' || cD === 'retreat') {
      const loss = R.tacRoundLoss * R.tacRetreatLoss
      if (cA === 'retreat') st.na = Math.max(0, st.na - loss)
      if (cD === 'retreat') st.nd = Math.max(0, st.nd - loss)
      retreat = cA === 'retreat' && cD === 'retreat' ? 'both' : cA === 'retreat' ? 'a' : 'd'
      rounds.push({ a: cA, d: cD, beat: null, push: 0.5, na: st.na, nd: st.nd, ma: st.ma, md: st.md, ev: 'retreat', by: retreat === 'd' ? 'd' : 'a' })
      break
    }

    let ev: RoundLog['ev']
    let by: 'a' | 'd' | undefined
    let effA = live(atk, st.na, st.ma, st.lostA) * might(atk, cA)
    let effD = live(def, st.nd, st.md, st.lostD) * might(def, cD)
    let takeA = taken(cA)
    let takeD = taken(cD)
    let lossScale = 1
    let beat: 'a' | 'd' | null = null

    // 일기토 — 장수끼리 나선다. 군대는 숨을 죽이고 본다 (이 라운드 손실이 적다)
    if (cA === 'duel' || cD === 'duel') {
      const starter: 'a' | 'd' = cA === 'duel' ? 'a' : 'd'
      const muA = atk.hero?.mu ?? 1
      const muD = def.hero?.mu ?? 1
      const pA = clamp(0.5 + R.tacDuelPerMu * (muA - muD), 0.1, 0.9)
      const aWins = rk(i, 'duel') < pA
      const loser: 'a' | 'd' = aWins ? 'd' : 'a'
      const kill = rk(i, 'duel-kill') < R.tacDuelKill
      duel = { loser, kill }
      if (loser === 'a') { st.lostA = true; st.hurtA = !kill } else { st.lostD = true; st.hurtD = !kill }
      st.ma += aWins ? R.tacDuelWin : -R.tacDuelLose
      st.md += aWins ? -R.tacDuelLose : R.tacDuelWin
      ev = aWins === (starter === 'a') ? 'duel-win' : 'duel-lose'
      by = starter
      lossScale = 0.3
      effA = live(atk, st.na, st.ma, st.lostA)
      effD = live(def, st.nd, st.md, st.lostD)
      takeA = 1
      takeD = 1
    } else {
      // 사로잡기 — 먹히면 판이 끝난다. 둘 다 가면 공격 쪽 먼저
      let caught: 'a' | 'd' | null = null
      for (const who of ['a', 'd'] as const) {
        if ((who === 'a' ? cA : cD) !== 'capture' || caught !== null) continue
        by = who
        if (rk(i, `cap-${who}`) < (who === 'a' ? capA : capD)) {
          caught = who
          ev = 'capture-ok'
        } else ev = 'capture-fail'
      }
      if (caught !== null) {
        captured = caught === 'a' ? 'd' : 'a'
        rounds.push({ a: cA, d: cD, beat: null, push: caught === 'a' ? 1 : 0, na: st.na, nd: st.nd, ma: st.ma, md: st.md, ev: 'capture-ok', by: caught })
        break
      }
      // 불 — 바람이 적 쪽이면 적이 크게 잃고 흩어진다. 바람이 돌면 우리 쪽이 흔들린다
      const burn = (who: 'a' | 'd'): void => {
        if (rk(i, `fire-${who}`) < R.tacFireOk) {
          ev = 'fire-ok'
          if (who === 'a') { effD *= R.tacFireDealt; takeD += R.tacFireTaken } else { effA *= R.tacFireDealt; takeA += R.tacFireTaken }
        } else {
          ev = 'fire-back'
          if (who === 'a') { st.ma -= R.tacFireBack; effA *= 0.8 } else { st.md -= R.tacFireBack; effD *= 0.8 }
        }
        by = who
      }
      if (cA === 'fire') burn('a')
      if (cD === 'fire') burn('d')
      // 세모 — 옆치기는 방진을 이기고 어느 명령에도 지지 않는다
      const winsOver = (x: Cmd, y: Cmd): boolean => BEATS[x] === y || (x === 'flank' && y === 'hold')
      if (winsOver(cA, cD)) beat = 'a'
      else if (winsOver(cD, cA)) beat = 'd'
      if (beat === 'a') { effA *= R.tacTriUp; effD *= R.tacTriDown }
      else if (beat === 'd') { effD *= R.tacTriUp; effA *= R.tacTriDown }
    }

    const p = edgeOf(effA, effD)
    const push = clamp(p + (rk(i, 'push') - 0.5) * R.tacJitter, 0.03, 0.97)
    st.nd = Math.max(0, st.nd - R.tacRoundLoss * 2 * push * takeD * lossScale)
    st.na = Math.max(0, st.na - R.tacRoundLoss * 2 * (1 - push) * takeA * lossScale)
    const dm = (push - 0.5) * R.tacMoraleSwing
    st.ma += dm
    st.md -= dm
    if (beat === 'a') st.md -= R.tacTriMorale
    if (beat === 'd') st.ma -= R.tacTriMorale
    if (atk.hungry) st.ma -= R.tacHungry
    if (def.hungry) st.md -= R.tacHungry
    st.ma = clamp(st.ma, 0.1, 1.6)
    st.md = clamp(st.md, 0.1, 1.6)
    rounds.push({ a: cA, d: cD, beat, push, na: st.na, nd: st.nd, ma: st.ma, md: st.md, ...(ev !== undefined ? { ev } : {}), ...(by !== undefined ? { by } : {}) })

    // 무너짐 — 처음보다 많이 줄었거나 사기가 꺾였다. 둘 다면 더 밀린 쪽만
    const downA = st.na < R.tacBreakMen || st.ma / Math.max(0.05, atk.morale) < R.tacBreakMorale
    const downD = st.nd < R.tacBreakMen || st.md / Math.max(0.05, def.morale) < R.tacBreakMorale
    if (downA || downD) {
      const s = shareOf(atk, def, st)
      broke = downA && downD ? (s >= 0.5 ? 'd' : 'a') : downA ? 'a' : 'd'
      break
    }
  }

  const s = shareOf(atk, def, st)
  let outcome: Outcome
  if (captured === 'd' || broke === 'd' || retreat === 'd') outcome = s >= R.tacRoutShare || captured === 'd' ? 'rout' : 'win'
  else if (captured === 'a' || broke === 'a' || retreat === 'a') outcome = s <= 1 - R.tacRoutShare || captured === 'a' ? 'routed' : 'lose'
  else if (retreat === 'both') outcome = 'draw'
  else outcome = s >= R.tacWinShare ? 'win' : s <= 1 - R.tacWinShare ? 'lose' : 'draw'
  // 무너진 쪽은 쫓기며 더 잃는다 (물러난 쪽은 아니다 — 물러나기의 값이다)
  if (outcome === 'rout' && retreat !== 'd') st.nd = Math.max(0, st.nd - R.tacChase)
  if (outcome === 'routed' && retreat !== 'a') st.na = Math.max(0, st.na - R.tacChase)
  if (outcome === 'rout' || outcome === 'routed') broke ??= outcome === 'rout' ? 'd' : 'a'
  if (retreat !== null) broke = null

  return {
    outcome, na: st.na, nd: st.nd,
    // 싸움 앞의 덤·감(moraleBonus)은 그 판에만 — 남는 것은 라운드에서 오간 몫
    dma: st.ma - atk.morale - (atk.moraleBonus ?? 0), dmd: st.md - def.morale - (def.moraleBonus ?? 0),
    captured, broke, duel, rounds, led: memo.led,
    ...(memo.pending !== undefined ? { pending: memo.pending } : {}),
  }
}
