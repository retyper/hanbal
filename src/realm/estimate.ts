/**
 * 한 군대가 이번 계절에 갈 수 있는 길마다의 셈 — 제 정보로만 (docs/realm/SYSTEMS.md §2-3 · §3 · §11)
 *
 * 화면(view.ts)과 AI(ai.ts)가 **같은 셈**을 쓴다. 둘이 따로 셈하면 플레이어가 보는 승률과 AI 가 믿는 승률이 갈라진다.
 * 승률은 범위로 낸다 — 모르는 입력(적 군세)을 끝에서 끝까지 넣는다. 범위가 좁혀지는 것이 정찰의 보상이다.
 */
import { P } from '../tune/params.ts'
import {
  ambushChance, ambushSizePenalty, counterMul, fightHead, gearMul, headcount, leadMul, roleMul, strength, winChance, type Field, type Force, type UnitKind,
} from './battle.ts'
import { militiaMen } from './economy.ts'
import { ambushTraitOf } from './heroes.ts'
import { alertRange, seenMix, visibleRange } from './intel.ts'
import {
  approachConceal, approachOptions, blockedWhy, cliffChance, conceal, concealOf, forceOf, fortMul, marchSeasons, otherEnd, seasonOf, seenMarches,
} from './season.ts'
import type { Approach, Army, EdgeKind, Realm, REdge } from './types.ts'

export interface Move {
  readonly edge: REdge
  readonly to: string
  /** 길을 지나는 계절 수 */
  readonly seasons: number
  /** 이번 계절에 막혔으면 까닭 */
  readonly blocked: 'winterPass' | 'summerFord' | null
  /** 남이 쥔 땅인가 (싸움이 날 수 있다). 아무도 안 쥔 빈땅·소도는 아니다 */
  readonly hostile: boolean
  /** 정면으로 칠 때의 승률 범위 [최악, 최선] — 남의 땅인데 모르면 null, 제 땅이면 null */
  readonly win: readonly [number, number] | null
  /** 기습이 먹혔을 때 — 성·지형을 안 받고 장정이 없다. 모르면 null */
  readonly winAmbush: readonly [number, number] | null
  /** 기습이 들켰을 때 — 기다리던 적에게 걸린다. 모르면 null */
  readonly winCaught: readonly [number, number] | null
  /** 정보의 나이 (계절). 모르면 Infinity */
  readonly age: number
  /** 기습 확률 (모르는 것은 P.realm.aiAssume* 로 본다). 큰 군대는 낮다 */
  readonly ambushP: number
  /** 이 길로 이 군대가 숨기 좋은가 — 땅·계절·무리 크기만 (season.concealOf). 지도의 기습 길 표시 */
  readonly conceal: 'good' | 'fair' | 'poor'
  /** 무리가 커서 숨기 어렵다 (concealOf 의 bigArmy) — 지도 칩 "무리가 커 들킨다" */
  readonly bigArmy: boolean
  /** 들이칠 고을에 성·높은 터가 있나 — 기습이 성을 건너뛰는 값이 크다 */
  readonly walled: boolean
}

const concealBits = (c: ReturnType<typeof concealOf>): { conceal: Move['conceal']; bigArmy: boolean } => ({ conceal: c.tier, bigArmy: c.why.includes('bigArmy') })

type Range = readonly [number, number]

function byId<T extends { id: string }>(xs: Iterable<T>): T[] {
  return [...xs].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/**
 * 제 정보로 본 그 고을에 대한 승률 범위 셋 — 정면 · 기습이 먹힘 · 들킴. 모르면 셋 다 null. 도하는 넣지 않는다.
 * 기습이 먹히면 장정이 못 모인다 — 장정 몫은 가호로 셈한다 (땅·가호는 누구나 안다, 모르는 것은 군대뿐이다).
 */
function winVs(
  r: Realm, faction: string, to: string, myF: number, atk?: { force: Force; edge: EdgeKind },
): { win: Range | null; ambush: Range | null; caught: Range | null; age: number } {
  const R = P.realm
  const node = r.nodes[to]!
  const k = (r.intel[faction] ?? {})[to]
  const none = { win: null, ambush: null, caught: null }
  if (node.owner === faction || node.kind === 'sodo' || !k?.force) return { ...none, age: Infinity }
  const age = r.season - k.force.season
  const range = visibleRange({ f0: k.force.f0, src: k.force.src, u: k.force.u }, age)
  if (range === null) return { ...none, age }
  const t = fortMul(node, seasonOf(r.season))
  // 병종의 쓰임 — 우리 쪽은 안다(길·공수). 저쪽 구성은 정찰로 본 몫이 있을 때만 넣는다 (판정의 battle.power 와 같은 셈 · 정찰의 보상)
  const seen = seenMix(r, faction, to)?.mix
  const foe: Force | null = seen !== undefined ? { mix: seen, equip: 'bronze', mu: 1, morale: 1 } : null
  const ground = (fort: number, ambushed: boolean): Field => ({ fort, crossing: false, ambush: 'none', snipeAtk: 1, snipeDef: 1, ...(atk !== undefined ? { edge: atk.edge } : {}), ambushed })
  const aMul = (g: Field): number => (atk === undefined ? 1 : roleMul(atk.force, g, 'atk') * (foe !== null ? counterMul(atk.force, foe) : 1))
  const dMul = (g: Field): number => (foe === null ? 1 : roleMul(foe, g, 'def') * (atk !== undefined ? counterMul(foe, atk.force) : 1))
  const front = ground(t, false)
  const hit = ground(1, true)
  // 행군은 보인다 (FLOW §7 #2) — 그 고을 주인이 보내는 보인 증원은 범위 위쪽에 더한다 (언제 닿을지는 모른다)
  let extra = 0
  for (const a of seenMarches(r, faction)) if (a.faction === node.owner && a.march!.to === to) extra += strength(forceOf(r, a))
  const mil = strength({ mix: { spear: militiaMen(r, to) }, equip: 'stone', mu: 1, morale: P.realm.militiaMorale })
  const lo = range[0]
  const hi = range[1] + extra
  const span = (f: number, dLo: number, dHi: number): Range => [winChance(f, dHi), winChance(f, dLo)]
  return {
    win: span(myF * aMul(front), lo * t * dMul(front), hi * t * dMul(front)),
    // 먹힌 기습 — 성·장정이 없고, 첫 칼에 지키는 쪽이 먼저 잃는다 (판정의 fight 와 같다)
    ambush: span(myF * R.ambushSuccess * aMul(hit), Math.max(0, lo - mil) * (1 - R.ambushFirstStrike) * dMul(hit), Math.max(0, hi - mil) * (1 - R.ambushFirstStrike) * dMul(hit)),
    caught: span(myF * R.ambushCaught * aMul(front), lo * t * dMul(front), hi * t * dMul(front)),
    age,
  }
}

/**
 * 이 길로 칠 때 병종·지형이 어떻게 걸리나 — 화면의 "칠까" 고르기에 한두 줄 (형: "창병 궁병 방패병 조합도, 지형에따라, 공격인지 방어인지에 따라").
 * 우리 구성(mix)·길·성은 안다. 저쪽 구성은 정찰로 본 몫이 있을 때만 말한다. 많아야 셋, 판정과 같은 규칙(battle.roleMul · counterMul)을 말로.
 */
export function matchupHints(r: Realm, viewer: string, mix: Readonly<Partial<Record<UnitKind, number>>>, targetNode: string, edge: EdgeKind): string[] {
  const n = Object.values(mix).reduce((s, v) => s + (v ?? 0), 0)
  if (n <= 0) return []
  const share = (k: UnitKind): number => (mix[k] ?? 0) / n
  const out: string[] = []
  if (edge === 'forest' && share('bow') >= 0.2) out.push('숲길이라 우리 궁수가 힘을 못 쓴다')
  if (edge === 'field' && share('spear') >= 0.3) out.push('들길이라 창병이 세다')
  if (edge === 'pass' && share('spear') >= 0.3) out.push('좁은 고갯길이라 창병이 창을 못 휘두른다')
  const node = r.nodes[targetNode]
  const walled = node !== undefined && fortMul(node, seasonOf(r.season)) > 1
  const seen = seenMix(r, viewer, targetNode)?.mix
  if (seen !== undefined) {
    const top = (Object.entries(seen) as Array<[UnitKind, number]>).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]
    if (top !== undefined && top[1] >= 0.4) {
      if (top[0] === 'bow') out.push(walled ? '성 위에 궁수가 많다 — 방패병이 화살을 막는다' : '적은 궁수가 많다 — 방패병이 화살을 막는다')
      else if (top[0] === 'spear') out.push('적은 창병이 많다 — 궁수가 멀리서 잘 맞힌다')
      else if (top[0] === 'shield') out.push('적은 방패병이 많다 — 창병이 방패 벽을 뚫는다')
    }
  } else if (walled) out.push('성 위의 궁수는 지킬 때 세다 — 정찰하면 구성이 보인다')
  return out.slice(0, 3)
}

/**
 * 협공의 셈 (SYSTEMS §4-5) — 같은 고을로 같은 계절에 닿는 군대들의 합친 승률 범위 (정면).
 * 서로 다른 길이 둘 이상이면 ×pincer. 닿는 계절이 다르면 협공이 아니다 — 부르는 쪽이 고른다.
 */
export function jointWin(r: Realm, faction: string, legs: readonly { army: Army; edge: REdge }[], to: string): Range | null {
  let f = 0
  // 병종의 쓰임은 군대마다 제 길로 (판정의 groupPower 와 같다) — 협공의 상성은 넣지 않는다
  for (const x of legs) {
    const fo = forceOf(r, x.army)
    f += strength(fo) * roleMul(fo, { fort: 1, crossing: false, ambush: 'none', snipeAtk: 1, snipeDef: 1, edge: x.edge.kind }, 'atk')
  }
  if (new Set(legs.map((x) => x.edge.id)).size >= 2) f *= P.realm.pincer
  return winVs(r, faction, to, f).win
}

/** 기습의 기대 승률 — 먹힐 확률로 기습·들킴 범위의 가운데를 섞는다. AI 가 정면과 견준다. 모르면 null */
export function ambushWorth(m: Move): number | null {
  if (m.winAmbush === null || m.winCaught === null) return null
  const mid = (x: Range): number => (x[0] + x[1]) / 2
  return m.ambushP * mid(m.winAmbush) + (1 - m.ambushP) * mid(m.winCaught)
}

export function movesOf(r: Realm, faction: string, a: Army): Move[] {
  const R = P.realm
  const season = seasonOf(r.season)
  const known = r.intel[faction] ?? {}
  const myF = strength(forceOf(r, a))
  const myRyak = a.hero !== null ? (r.heroes[a.hero]?.ryak ?? 1) : 1
  const size = -ambushSizePenalty(headcount(forceOf(r, a)))
  const out: Move[] = []
  for (const ed of byId(Object.values(r.edges))) {
    const to = otherEnd(ed, a.at)
    if (to === null) continue
    const node = r.nodes[to]!
    // 아무도 안 쥔 빈땅은 칠 데가 아니다 — 장정이 없다. 개척(settle)이나 깃발 꽂기로 쥔다
    const hostile = node.owner !== null && node.owner !== faction && node.kind !== 'sodo'
    const k = known[to]
    const v = winVs(r, faction, to, myF, { force: forceOf(r, a), edge: ed.kind })
    const al = k?.alert ? alertRange(k.alert.v, r.season - k.alert.season) : null
    const ambushP = ambushChance(conceal(ed, node, season), myRyak, R.aiAssumeRyak, size + ambushTraitOf(a.hero !== null ? (r.heroes[a.hero] ?? null) : null, ed.kind), 0, al === null ? R.aiAssumeAlert : al[1])
    out.push({
      edge: ed, to, seasons: marchSeasons(ed.kind, season), blocked: blockedWhy(ed, season), hostile,
      win: v.win, winAmbush: v.ambush, winCaught: v.caught, age: v.age, ambushP,
      ...concealBits(concealOf(r, ed.id, headcount(forceOf(r, a)), to)), walled: fortMul(node, season) > 1,
    })
  }
  return out
}

/** 진군 방식 하나의 셈 — 고르는 화면이 말·색으로 보인다 (확률은 숫자로 안 보인다) */
export interface ApproachMove {
  readonly ap: Approach
  /** 먹힐 확률 (대로는 1 — 숨지 않는다) */
  readonly p: number
  /** 먹혔을 때 · 들켰을 때의 판세 범위. 모르면 null */
  readonly hit: Range | null
  readonly miss: Range | null
  /** 길 계절 (산기슭은 더 걸린다) */
  readonly seasons: number
}

/**
 * 진군 방식마다의 셈 (형: "강을 도하해 기습 · 대로로 행군 · 산기슭 · 절벽" 2026-10-19) — 판정(season.fight)과 같은 규칙을 범위로.
 * 산기슭이 먹히면 성을 반쯤 비켜 친다 — 정면과 기습 범위의 가운데로 본다. 절벽은 사람이 적을수록 잘 된다.
 */
export function approachMoves(r: Realm, faction: string, a: Army, m: Move): ApproachMove[] {
  const R = P.realm
  const node = r.nodes[m.to]!
  const season = seasonOf(r.season)
  const myRyak = a.hero !== null ? (r.heroes[a.hero]?.ryak ?? 1) : 1
  const known = (r.intel[faction] ?? {})[m.to]
  const al = known?.alert ? alertRange(known.alert.v, r.season - known.alert.season) : null
  const size = -ambushSizePenalty(headcount(forceOf(r, a))) + ambushTraitOf(a.hero !== null ? (r.heroes[a.hero] ?? null) : null, m.edge.kind)
  const mid = (x: Range | null, y: Range | null): Range | null => (x === null || y === null ? null : [(x[0] + y[0]) / 2, (x[1] + y[1]) / 2])
  const out: ApproachMove[] = []
  for (const ap of approachOptions(r, m.edge, m.to)) {
    const seasons = m.seasons + (ap === 'ridge' ? R.apRidgeExtra : 0)
    if (ap === 'road') {
      out.push({ ap, p: 1, hit: m.win, miss: m.win, seasons })
      continue
    }
    const p = ap === 'cliff'
      ? cliffChance(r, a)
      : ambushChance(conceal(m.edge, node, season) + approachConceal(ap), myRyak, R.aiAssumeRyak, size, 0, al === null ? R.aiAssumeAlert : al[1])
    const hit = ap === 'ridge' ? mid(m.win, m.winAmbush) : m.winAmbush
    out.push({ ap, p, hit, miss: m.winCaught, seasons })
  }
  return out
}

/**
 * 한 군대의 힘 — 화면의 힘 막대 (형: "부대마다 전투력은 어떻게 나오고. 숫자로만 판별불가하잖아").
 * total = 싸우는 머릿수 × 무장 × 지휘 × 사기 (battle.strength — 정찰이 보는 값과 같은 잣대). 상성·지형·성은 상대와 자리에 따라 붙어 여기엔 없다.
 */
export function armyPower(r: Realm, armyId: string): { total: number; parts: { men: number; gear: number; lead: number; morale: number } } | null {
  const a = r.armies[armyId]
  if (a === undefined) return null
  const f = forceOf(r, a)
  return { total: strength(f), parts: { men: fightHead(f), gear: gearMul(f), lead: leadMul(f.mu), morale: f.morale } }
}
