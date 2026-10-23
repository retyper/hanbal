/**
 * 원정 — 장수를 지도 바깥 먼 땅으로 보낸다 (docs/realm/SYSTEMS.md §15-4 · 슬롯 ⑩ · 팰월드 파견).
 *
 * 형의 메모: "팰월드에선 레어팰을 찾아 뛰어다니며 … 발견도 도박" · "수작업 시키다가 자동화".
 * 좋은 장수를 보낼수록 좋은 것이 오지만, 그동안 그는 판에 없다 — 그것이 원정의 결정이다.
 * 결과는 **보낼 때 정해진다** (같은 판이면 같은 결과). 보낼 때 무엇이 자주·가끔·드물게 나오는지 다 보인다 (정보의 계약).
 * 기다림은 결과를 바꾸지 않는다 — 여는 순간만 미룬다. 빈손일 수는 있어도 잃는 것은 없다 (자리를 비운 탓에 잃지 않는다 — VISION M5).
 *
 * 먼 땅 넷 — 이름은 사료에서: 왜(동이전: 변진의 철을 왜가 사 간다) · 주호(동이전: 마한 서쪽 바다의 큰 섬, 소·돼지를 기른다) ·
 * 늑도(사천 늑도 — 원삼국 바닷길의 옛 교역섬, 유적) · 읍루(동이전: 북쪽 깊은 숲, 독화살). 바닷길 셋은 포구가 있어야 간다.
 */
import { roll } from '../core/rng.ts'
import { P } from '../tune/params.ts'
import { HERO_POOL } from './data/heroes-pool.ts'
import { TRAIT } from './data/traits.ts'
import { armyOfHero, homeOf, honeyLeft, isRuler } from './heroes.ts'
import { DESTS } from './data/dests.ts'
import type { ExpDest, ExpGot, Expedition, Hero, Order, Realm, ReportLine } from './types.ts'

export { DESTS, DEST_IDS, type DestInfo } from './data/dests.ts'


/** 길이 — 계절 수 (짧게 · 보통 · 길게) */
export const EXP_SEASONS: readonly [number, number, number] = [2, 4, 8]
const EXP_MUL: readonly [number, number, number] = [1, 2.2, 5]

/** 장수의 솜씨 0~1 — 무예·지략·매력 (거친 길을 헤치고 · 꾀를 내고 · 사람을 사귄다) */
const skillOf = (h: Hero): number => Math.max(0, Math.min(1, (h.mu + h.ryak + h.deok) / 30))

export type GotKind = 'none' | 'iron' | 'grain' | 'wanderer' | 'skill'

/** 나올 것의 몫 (합 1) — 화면이 자주·가끔·드물게로 보인다 */
export function expOdds(h: Hero, dest: ExpDest, len: 0 | 1 | 2): Record<GotKind, number> {
  const q = skillOf(h)
  const b = DESTS[dest].bias
  const w: Record<GotKind, number> = {
    none: Math.max(0.06, 0.42 - 0.12 * len - 0.25 * q),
    iron: 0.24 * b.iron,
    grain: 0.24 * b.grain,
    wanderer: (0.03 + 0.04 * len + 0.04 * q) * b.wanderer,
    skill: (0.04 + 0.04 * len + 0.08 * q) * b.skill * (canLearn(h, dest) ? 1 : 0),
  }
  const sum = w.none + w.iron + w.grain + w.wanderer + w.skill
  return { none: w.none / sum, iron: w.iron / sum, grain: w.grain / sum, wanderer: w.wanderer / sum, skill: w.skill / sum }
}

const canLearn = (h: Hero, dest: ExpDest): boolean => (h.traits ?? []).length < 3 && DESTS[dest].skills.some((t) => !(h.traits ?? []).includes(t))

/** 얻는 철·곡식의 양 — 길이 × 솜씨 × 땅 */
export function expAmount(h: Hero, dest: ExpDest, len: 0 | 1 | 2, kind: 'iron' | 'grain'): number {
  const base = kind === 'iron' ? P.realm.expIron : P.realm.expGrain
  return Math.round(base * EXP_MUL[len] * (0.7 + 0.6 * skillOf(h)) * DESTS[dest].bias[kind])
}

/** 원정 중인가 */
export const onExpedition = (r: Realm, hero: string): Expedition | undefined => (r.expeditions ?? []).find((x) => x.hero === hero)

/** 땅으로 닿나 — 이 판에서 그 먼 땅에 길이 있고, 바닷길이면 우리 포구가 있다. 안 닿는 곳은 화면에 아예 안 띄운다 */
export function destReachable(r: Realm, faction: string, dest: ExpDest): boolean {
  const d = DESTS[dest]
  if (!d.from.includes(r.region ?? 'byeonhan-mini')) return false
  return !d.sea || Object.values(r.nodes).some((n) => n.owner === faction && n.kind === 'port')
}

/** 갈 수 있나 — 까닭이 있으면 그 글, 되면 null */
export function expBlock(r: Realm, faction: string, hero: string, dest: ExpDest, len: 0 | 1 | 2): string | null {
  const h = r.heroes[hero]
  if (h === undefined || h.faction !== faction || h.status !== 'free') return '우리 장수만 보낼 수 있다'
  if (isRuler(r, hero)) return '군주는 나라를 비울 수 없다'
  if (onExpedition(r, hero) !== undefined) return '벌써 원정 중이다'
  if (h.woundedUntil !== undefined && h.woundedUntil > r.season) return '다쳐 누워 있다'
  if (h.awayUntil !== undefined && h.awayUntil >= r.season) return '자리를 비웠다'
  if (honeyLeft(r, hero) > 0) return '신혼이다 — 짝과 집에 머문다'
  const a = armyOfHero(r, hero)
  if (a !== null && a.march !== null) return '군대를 이끌고 가는 중이다'
  if ((r.expeditions ?? []).filter((x) => x.faction === faction).length >= P.realm.expMax) return `원정은 한꺼번에 ${P.realm.expMax}까지다`
  if (!DESTS[dest].from.includes(r.region ?? 'byeonhan-mini')) return '이 땅에서는 닿지 않는다'
  if (DESTS[dest].sea && !Object.values(r.nodes).some((n) => n.owner === faction && n.kind === 'port')) return '바닷길은 포구가 있어야 간다'
  if ((r.stock[faction]?.grain ?? 0) < P.realm.expGrainPer * EXP_SEASONS[len]) return '길 양식이 모자란다'
  return null
}

/** 보낼 때 정한다 — 같은 판·같은 계절·같은 장수·같은 길이면 같은 결과 */
function decide(r: Realm, h: Hero, dest: ExpDest, len: 0 | 1 | 2): ExpGot {
  const key = `exp:${h.id}:${dest}:${len}`
  const odds = expOdds(h, dest, len)
  let x = roll(r.seed, r.season, key)
  let kind: GotKind = 'none'
  for (const k of ['none', 'iron', 'grain', 'wanderer', 'skill'] as const) {
    if (x < odds[k]) { kind = k; break }
    x -= odds[k]
  }
  if (kind === 'wanderer') {
    const taken = new Set([...Object.keys(r.heroes), ...(r.wanderers ?? []).map((w) => w.hero.id),
      ...(r.expeditions ?? []).flatMap((e) => (e.got.kind === 'wanderer' ? [e.got.hero] : []))])
    const pool = HERO_POOL.filter((p) => !taken.has(p.id))
    if (pool.length > 0) return { kind: 'wanderer', hero: pool[Math.floor(roll(r.seed, r.season, `${key}:who`) * pool.length)]!.id }
    kind = 'iron'
  }
  if (kind === 'skill') {
    const can = DESTS[dest].skills.filter((t) => !(h.traits ?? []).includes(t) && TRAIT[t] !== undefined)
    if (can.length > 0 && (h.traits ?? []).length < 3) return { kind: 'skill', trait: can[Math.floor(roll(r.seed, r.season, `${key}:what`) * can.length)]! }
    kind = 'iron'
  }
  if (kind === 'iron' || kind === 'grain') return { kind, n: expAmount(h, dest, len, kind) }
  return { kind: 'none' }
}

/** 1 — 원정 명령. 규칙에 안 맞으면 아무 일도 없다 */
export function sendExpeditions(r: Realm, orders: readonly Order[], lines: ReportLine[]): void {
  for (const o of orders) {
    if (o.kind !== 'expedition') continue
    if (expBlock(r, o.faction, o.hero, o.dest, o.len) !== null) continue
    const h = r.heroes[o.hero]!
    const a = armyOfHero(r, o.hero)
    if (a !== null) a.hero = null // 이끌던 군대는 그 자리에 남는다
    r.stock[o.faction]!.grain -= P.realm.expGrainPer * EXP_SEASONS[o.len]
    const back = r.season + EXP_SEASONS[o.len]
    const got = decide(r, h, o.dest, o.len)
    h.at = null
    h.post = null
    h.awayUntil = back
    ;(r.expeditions ??= []).push({ hero: o.hero, faction: o.faction, dest: o.dest, len: o.len, back, got })
    lines.push({ kind: 'expGo', faction: o.faction, hero: o.hero, dest: o.dest, back })
  }
}

/** 9 — 돌아온 원정이 짐을 푼다. 나라가 없어졌으면 장수는 돌아올 데가 없다 (떠돈다 — 판에서 빠진다) */
export function stepExpeditions(r: Realm, lines: ReportLine[]): void {
  const list = r.expeditions ?? []
  if (list.length === 0) return
  const home = list.filter((x) => x.back <= r.season)
  if (home.length === 0) return
  r.expeditions = list.filter((x) => x.back > r.season)
  for (const x of home) {
    const h = r.heroes[x.hero]
    const at = homeOf(r, x.faction)
    if (h === undefined || at === null) continue
    h.at = at
    delete h.awayUntil
    let got: ExpGot = x.got
    const st = (r.stock[x.faction] ??= { grain: 0, iron: 0 })
    if (got.kind === 'wanderer') {
      const p = HERO_POOL.find((w) => w.id === (got as { hero: string }).hero)
      // 그새 그 사람이 판에 들어왔으면 (떠돌이로 나타났거나 남이 들였으면) 대신 쇠를 가져온다
      if (p === undefined || r.heroes[p.id] !== undefined || (r.wanderers ?? []).some((w) => w.hero.id === p.id)) got = { kind: 'iron', n: expAmount(h, x.dest, x.len, 'iron') }
      else r.heroes[p.id] = { ...structuredClone(p), faction: x.faction, status: 'free', captor: null, at, post: null, bond: P.realm.bondHired }
    }
    if (got.kind === 'iron') st.iron += got.n
    else if (got.kind === 'grain') st.grain += got.n
    else if (got.kind === 'skill') {
      const t = got.trait
      if ((h.traits ?? []).length < 3 && !(h.traits ?? []).includes(t)) (h as { traits: readonly string[] }).traits = [...(h.traits ?? []), t]
      else got = { kind: 'none' }
    }
    lines.push({ kind: 'expBack', faction: x.faction, hero: x.hero, dest: x.dest, got })
  }
}
