/**
 * 옥중 담판 — 회유를 짧은 말싸움으로 (docs/realm/WOO.md · 형 10-29: "회유할 때 장수 얼굴도 안 나오고 뭐가 얼마나 되는지 구체적이지 않음 ·
 * 미니게임화 (스카이림 화술 느낌)").
 *
 * 엔진은 그대로 두고 담판의 결과는 마음의 벽(resist)을 얼마나 깎느냐로만 들어간다. 「맡긴다」는 지금과 똑같이 돈다.
 *   - 말할 거리 넷(달래기 · 명분 · 이익 · 겁주기) + 걸 거리가 있으면 ★인연. 거리마다 그 사람과의 맞음 −2~+2 (판 안의 사실로 센다)
 *   - 마디마다 굴림 하나 roll(seed, season, 'woo-talk:<포로>:<마디>') — 고른 거리와 무관하다. 화면은 같은 함수로 미리 보인다
 *   - 담판은 계절 처음(장수 명령을 얹을 때 · season.applyArmyOrders) 에 판에 얹는다. 계절 끝(heroes.stepHeroes)은 곡식을 받고 넘어온 이를 들인다
 * 순수 함수만. heroes.ts 는 이 파일을 부르지 않는다 (고리 없음). 숫자는 P.realm.woo*.
 */
import { roll } from '../core/rng.ts'
import { P } from '../tune/params.ts'
import { bondOf, deokOf, hasTrait, isKin, isRuler, persuadeDropOf, recruitChance, resistOf } from './heroes.ts'
import type { Hero, Order, Realm, ReportLine, WooApproach, WooReact } from './types.ts'

export const WOO_APPROACHES: readonly WooApproach[] = ['soothe', 'cause', 'gain', 'fear']
/** 거리마다 쓰는 우리 장수의 능력치 (인연은 능력치를 쓰지 않는다) */
export const WOO_STAT: Readonly<Record<WooApproach, 'deok' | 'ryak' | 'mu' | null>> = { soothe: 'deok', cause: 'ryak', gain: 'deok', fear: 'mu', bond: null }
/** 한 판 마디 수 */
export const WOO_BEATS = 3

/** 갇힌 이의 결 — 맞음을 셀 때 쓰는 됨됨이 (특성 · 능력치로만 · 화면의 목소리 결과 비슷하게 가른다) */
export type Temper = 'young' | 'gruff' | 'sage' | 'elder' | 'charm' | 'bright' | 'cool' | 'sly' | 'shaman'
export function temperOf(r: Realm, h: Hero): Temper {
  const ruler = isRuler(r, h.id)
  if (h.look === 'w') {
    if (hasTrait(h, 'shaman')) return 'shaman'
    if (hasTrait(h, 'charm') || hasTrait(h, 'traitor')) return 'sly'
    if (ruler || h.mu + h.tong >= 14 || hasTrait(h, 'steadfast') || hasTrait(h, 'hundred')) return 'cool'
    if (h.ryak >= 8 || hasTrait(h, 'trader')) return 'sly'
    return 'bright'
  }
  if (hasTrait(h, 'charm')) return 'charm'
  if (ruler || ((hasTrait(h, 'steadfast') || hasTrait(h, 'hundred')) && h.tong >= 7)) return 'elder'
  if (hasTrait(h, 'shaman') || hasTrait(h, 'careful') || h.ryak >= 8 || h.chi >= 8) return 'sage'
  if (hasTrait(h, 'drinker') || hasTrait(h, 'glutton') || hasTrait(h, 'smith') || hasTrait(h, 'ironhand') || h.mu >= 8) return 'gruff'
  return 'young'
}

/** 맞음을 만든 사실 하나 — 화면이 칩으로 보인다 (n 은 더한 몫) */
export interface FitWhy { readonly key: string; readonly n: number }
/** 인연 — 짝 · 자식 · 부모가 우리 손에 있다 · 회유하는 이와 한 핏줄 · 처음 섬긴 나라가 같다 */
export interface BondHook { readonly kind: 'spouse' | 'child' | 'parent' | 'kin' | 'home'; readonly who: string | null }

/** 처음 섬긴 나라 */
export const bornOf = (h: Hero): string => h.born ?? h.faction

/** 나라가 무너졌나 — 땅이 하나도 없다 */
const fallen = (r: Realm, faction: string): boolean => !Object.values(r.nodes).some((n) => n.owner === faction)

/** 인연 — 걸 거리가 있으면 하나 (짝 > 자식 > 부모 > 한 핏줄 > 같은 고향). 우리 사람이거나 우리 옥에 있을 때만 */
export function bondHookOf(r: Realm, hero: string, by: string | null): BondHook | null {
  const h = r.heroes[hero]
  if (h === undefined || h.captor === null) return null
  const ours = (id: string | undefined): boolean => {
    const y = id !== undefined ? r.heroes[id] : undefined
    return y !== undefined && y.id !== hero && ((y.status === 'free' && y.faction === h.captor) || (y.status === 'captive' && y.captor === h.captor))
  }
  if (ours(h.spouse)) return { kind: 'spouse', who: h.spouse! }
  const kid = Object.values(r.heroes).filter((y) => y.parents?.includes(hero) === true && ours(y.id)).sort((a, b) => (a.id < b.id ? -1 : 1))[0]
  if (kid !== undefined) return { kind: 'child', who: kid.id }
  const par = (h.parents ?? []).filter((p) => ours(p)).sort()[0]
  if (par !== undefined) return { kind: 'parent', who: par }
  const b = by !== null ? r.heroes[by] : undefined
  if (b !== undefined && isKin(h, b)) return { kind: 'kin', who: b.id }
  if (b !== undefined && bornOf(b) === bornOf(h) && h.faction !== h.captor) return { kind: 'home', who: b.id }
  return null
}

/** 걸 거리 — 담판을 다시 띄우는 사실 (나라가 무너졌다 · 피붙이가 우리 손에 들어왔다 · 오래 아무도 구하러 오지 않았다) */
export function hookKeys(r: Realm, hero: string): string[] {
  const h = r.heroes[hero]
  if (h === undefined) return []
  const out: string[] = []
  if (fallen(r, h.faction)) out.push('fallen')
  const k = bondHookOf(r, hero, null)
  if (k !== null && k.kind !== 'kin' && k.kind !== 'home') out.push(`kin:${k.who}`)
  if (h.caughtAt !== undefined && r.season - h.caughtAt > P.realm.wooRescueSeasons) out.push('alone')
  return out
}

/** 거리 하나의 맞음 −2~+2 와 그 까닭 */
export function fitOf(r: Realm, hero: string, by: string | null, a: WooApproach): { fit: number; why: FitWhy[] } {
  const R = P.realm
  const h = r.heroes[hero]
  if (h === undefined) return { fit: 0, why: [] }
  if (a === 'bond') return bondHookOf(r, hero, by) !== null ? { fit: 2, why: [{ key: 'bond', n: 2 }] } : { fit: -2, why: [] }
  const t = temperOf(r, h)
  const why: FitWhy[] = []
  const add = (key: string, n: number, on: boolean): void => { if (on) why.push({ key, n }) }
  const alive = !fallen(r, h.faction)
  const trust = (bondOf(r, h) ?? 0) >= R.bondTrust
  const alone = h.caughtAt !== undefined && r.season - h.caughtAt > R.wooRescueSeasons
  switch (a) {
    case 'soothe':
      add('coward', 1, hasTrait(h, 'coward'))
      add('lowUiri', 1, h.uiri <= 4)
      add('young', 1, t === 'young' || t === 'bright')
      add('gruff', -2, t === 'gruff')
      add('elder', -1, t === 'elder')
      break
    case 'cause':
      add('fallen', 1, !alive)
      add('alone', 1, alone)
      add('sage', 1, t === 'sage' || t === 'elder' || t === 'shaman')
      add('alive', -1, alive)
      add('trust', -1, alive && trust)
      break
    case 'gain':
      add('trader', 1, hasTrait(h, 'trader') || hasTrait(h, 'glutton') || hasTrait(h, 'drinker'))
      add('traitor', 1, hasTrait(h, 'traitor'))
      add('steadfast', -2, hasTrait(h, 'steadfast'))
      add('highUiri', -1, h.uiri >= 8)
      add('cool', -1, t === 'cool')
      break
    case 'fear':
      add('coward', 2, hasTrait(h, 'coward'))
      add('gruff', -2, t === 'gruff')
      add('elder', -2, t === 'elder')
      add('cool', -2, t === 'cool')
      add('proud', -1, t === 'sage' || t === 'charm' || t === 'sly' || t === 'shaman')
      break
  }
  const fit = Math.max(-2, Math.min(2, why.reduce((s, w) => s + w.n, 0)))
  return { fit, why }
}

/** 이번 판에 걸 수 있는 거리 — 넷 + 걸 거리가 있으면 인연 */
export function approachesOf(r: Realm, hero: string, by: string | null): WooApproach[] {
  return bondHookOf(r, hero, by) !== null ? [...WOO_APPROACHES, 'bond'] : [...WOO_APPROACHES]
}

/** 약한 곳 — 가장 맞는 거리의 맞음 (+1 이상일 때만 약한 곳이다) */
function weakFit(r: Realm, hero: string, by: string | null): number {
  return Math.max(...approachesOf(r, hero, by).map((a) => fitOf(r, hero, by, a).fit))
}

/** 먹힐 가망 — 맞음 × 우리 장수의 쓰는 능력치 × 기세(mom −1 · 0 · +1) */
export function chanceOf(r: Realm, hero: string, by: string | null, a: WooApproach, mom = 0): number {
  const R = P.realm
  const table = [R.wooFit0, R.wooFit1, R.wooFit2, R.wooFit3, R.wooFit4]
  const fit = fitOf(r, hero, by, a).fit
  const b = by !== null ? r.heroes[by] : undefined
  const k = WOO_STAT[a]
  const stat = b === undefined || k === null ? 5 : k === 'deok' ? deokOf(b) : b[k]
  const p = table[fit + 2]! + (k === null ? 0 : (stat - 5) * R.wooPerStat) + mom * R.wooMomentum
  return Math.min(R.wooChanceMax, Math.max(R.wooChanceMin, p))
}

/**
 * 보이는 가망 — 남의 속을 읽는 일이라 회유하는 이의 지략이 폭을 정한다 (COUNCIL 결정 5). 폭은 늘 참값을 품는다.
 * 9~10 한 값 · 7~8 ±10 · 4~6 ±20 · 3 이하 ±30 (dim: 「잘 모르겠다」)
 */
export function shownRange(r: Realm, by: string | null, p: number): { lo: number; hi: number; dim: boolean } {
  const ryak = by !== null ? (r.heroes[by]?.ryak ?? 3) : 3
  const w = ryak >= 9 ? 0 : ryak >= 7 ? 0.1 : ryak >= 4 ? 0.2 : 0.3
  const pc = Math.round(p * 100)
  if (w === 0) return { lo: pc, hi: pc, dim: false }
  // 참값이 가운데에만 오지 않게 — 폭을 참값 둘레로 밀어 둔다 (밀림은 장수·값마다 정해져 있다)
  const shift = (((pc * 7 + ryak * 13) % 11) / 10 - 0.5) * w
  let lo = Math.round((p - w + shift) * 20) * 5
  let hi = Math.round((p + w + shift) * 20) * 5
  lo = Math.max(0, Math.min(lo, pc))
  hi = Math.min(100, Math.max(hi, pc))
  return { lo, hi, dim: ryak <= 3 }
}

/** 마디 하나 */
export interface WooBeat { readonly a: WooApproach; readonly p: number; readonly u: number; readonly react: WooReact; readonly wall: number }
/** 한 판 */
export interface WooTalk {
  readonly beats: readonly WooBeat[]
  /** 처음 벽 · 끝난 벽 */
  readonly from: number
  readonly resist: number
  /** 어떻게 끝났나 — 다 했다(또는 맡겼다) · 노여움 · 벽이 무너졌다 */
  readonly end: 'done' | 'rage' | 'broke'
  /** 손을 내민다 — 굴렸으면 그 가망과 결과 */
  readonly hand: { readonly p: number; readonly u: number; readonly ok: boolean } | null
  readonly grudge: number
  /** 「이익」으로 더 낸 곡식 */
  readonly grain: number
}

/** 남은 벽 — 회유 중이면 그 벽, 아니면 처음 벽 */
export const wallOf = (r: Realm, hero: string): number => r.heroes[hero]?.persuade?.resist ?? resistOf(r, hero)

/**
 * 담판을 굴린다 — talk 는 마디마다 고른 거리(셋까지). 셋 안에서 멈췄으면 남은 마디는 맡긴다(지금 엔진의 흔들림 한 번을 남은 몫만큼).
 * 화면의 미리 보기와 계절 처음의 판이 같은 이 함수를 부른다.
 */
export function talkRun(r: Realm, hero: string, by: string | null, talk: readonly WooApproach[]): WooTalk {
  const R = P.realm
  const h = r.heroes[hero]
  const from = wallOf(r, hero)
  const drop = persuadeDropOf(r, by)
  const weak = weakFit(r, hero, by)
  const open0 = from <= 0
  let wall = from
  let mom = 0
  let bonus = 0
  let grudge = h?.grudge ?? 0
  let end: WooTalk['end'] = 'done'
  let grain = 0
  let usedBond = false
  const beats: WooBeat[] = []
  for (let i = 0; i < Math.min(WOO_BEATS, talk.length); i++) {
    const a = talk[i]!
    if (a === 'bond' && usedBond) break // 인연은 판에 한 번
    if (a === 'bond') usedBond = true
    if (a === 'gain') grain += R.wooGainGrain
    const fit = fitOf(r, hero, by, a).fit
    const p = chanceOf(r, hero, by, a, mom)
    const u = roll(r.seed, r.season, `woo-talk:${hero}:${i}`)
    const hit = u < p
    // 가시를 짚고 크게 빗나가면 노여움 — 빗나간 몫 가운데 wooRageShare 만큼 (나머지는 버팀)
    const react: WooReact = hit ? (fit >= 1 && fit === weak ? 'big' : 'sway') : fit <= -2 && u >= p + (1 - p) * (1 - R.wooRageShare) ? 'rage' : 'hold'
    if (react === 'big') { if (open0) bonus += R.wooHandBig; else wall -= drop * R.wooBig }
    else if (react === 'sway') { if (open0) bonus += R.wooHandSway; else wall -= drop * R.wooSway }
    else if (react === 'rage') { wall = Math.max(0, wall) + drop * R.wooRage; grudge = Math.min(R.wooGrudgeMax, grudge + 1) }
    wall = Math.max(0, wall)
    beats.push({ a, p, u, react, wall })
    if (react === 'rage') { end = 'rage'; break }
    if (!open0 && wall <= 0) { end = 'broke'; break }
    mom = hit ? 1 : -1
  }
  // 셋을 다 하지 않았으면 남은 마디는 맡긴다 — 지금 엔진의 흔들림을 남은 몫만큼
  if (end === 'done' && !open0 && beats.length < WOO_BEATS) {
    const sway = 1 + (roll(r.seed, r.season, `woo-drop:${hero}`) * 2 - 1) * R.persuadeSway
    wall = Math.max(0, wall - drop * sway * (WOO_BEATS - beats.length) / WOO_BEATS)
    if (wall <= 0) end = 'broke'
  }
  // 손을 내민다 — 벽이 무너진 마디에서, 또는 무너진 뒤의 담판을 끝까지 했을 때
  let hand: WooTalk['hand'] = null
  if (end === 'broke' || (open0 && end === 'done' && beats.length > 0)) {
    const last = beats[beats.length - 1]
    const p = Math.min(R.recruitMax, Math.max(R.recruitMin, recruitChance(r, hero, by) + bonus + (last?.react === 'big' ? R.wooHandWeak : 0)))
    const u = roll(r.seed, r.season, `woo-hand:${hero}`)
    hand = { p, u, ok: u < p }
  }
  return { beats, from, resist: wall, end, hand, grudge, grain }
}

/**
 * 지금 담판을 열 수 있나 — 왜 열리나. 저절로 뜨는 때는 셋 (WOO §3): 처음 · 벽이 무너진 다음 계절 · 걸 거리가 새로 생겼을 때.
 * 그 밖에는 「마주 앉기」로 wooTalkGap 계절에 한 번 (free). 못 열면 null
 */
export function talkWhy(r: Realm, hero: string): 'first' | 'last' | 'hook' | 'free' | null {
  const h = r.heroes[hero]
  if (h === undefined || h.status !== 'captive' || h.captor === null) return null
  const pz = h.persuade
  if (pz === undefined || (pz.since === r.season && pz.talkAt === undefined)) return 'first'
  if (pz.resist === undefined || pz.talkAt === r.season) return null
  if (pz.resist <= 0 && (pz.tries ?? 0) === 0) return 'last'
  const seen = new Set(pz.hooks ?? [])
  if (hookKeys(r, hero).some((k) => !seen.has(k))) return 'hook'
  const last = pz.talkAt ?? pz.since
  if (last === undefined || r.season - last >= P.realm.wooTalkGap) return 'free'
  return null
}
/** 저절로 띄울 때인가 */
export const talkAuto = (r: Realm, hero: string): boolean => { const w = talkWhy(r, hero); return w !== null && w !== 'free' }

/**
 * 계절 처음 — 담판을 판에 얹는다 (season.applyArmyOrders 가 장수 명령 뒤에 부른다). 회유가 이미 걸려 있어야 한다(startPersuade 가 먼저).
 * 곡식이 이번 계절 몫(+이익)에 못 미치면 담판은 없고 맡긴다
 */
export function applyTalks(r: Realm, orders: readonly Order[], lines: ReportLine[]): void {
  const R = P.realm
  for (const o of orders) {
    if (o.kind !== 'persuade' || o.talk === undefined || o.talk.length === 0) continue
    const h = r.heroes[o.hero]
    const pz = h?.persuade
    if (h === undefined || pz === undefined || h.captor === null || pz.by !== o.by || pz.resist === undefined) continue
    if (talkWhy(r, h.id) === null) continue
    const extra = o.talk.slice(0, WOO_BEATS).filter((a) => a === 'gain').length * R.wooGainGrain
    if ((r.stock[h.captor]?.grain ?? 0) < R.persuadeGrain + extra) continue
    const t = talkRun(r, h.id, o.by, o.talk)
    pz.resist = t.resist
    pz.talkAt = r.season
    pz.hooks = hookKeys(r, h.id)
    pz.talkGrain = t.grain
    if (t.grudge > 0) h.grudge = t.grudge
    if (t.hand !== null) {
      if (t.hand.ok) pz.handAt = r.season
      else pz.tries = (pz.tries ?? 0) + 1
    }
    lines.push({ kind: 'persuade', hero: h.id, faction: h.captor, step: 'talk', by: o.by, d: t.resist - t.from, reacts: t.beats.map((b) => b.react), broke: t.end === 'broke' })
    if (t.hand !== null && !t.hand.ok) lines.push({ kind: 'persuade', hero: h.id, faction: h.captor, step: 'refuse' })
  }
}

/** 마음의 벽을 쌓은 것 — 칩으로 (key 는 화면 이름표 · n 은 더한 벽) */
export function wallParts(r: Realm, hero: string): Array<{ key: 'base' | 'uiri' | 'loyal' | 'ruler' | 'steadfast'; n: number }> {
  const R = P.realm
  const h = r.heroes[hero]
  if (h === undefined) return []
  const out: Array<{ key: 'base' | 'uiri' | 'loyal' | 'ruler' | 'steadfast'; n: number }> = [{ key: 'base', n: R.resistBase }]
  if (h.uiri > 5) out.push({ key: 'uiri', n: (h.uiri - 5) * R.resistPerUiri })
  if ((bondOf(r, h) ?? 0) >= R.bondTrust) out.push({ key: 'loyal', n: R.resistLoyal })
  if (isRuler(r, hero)) out.push({ key: 'ruler', n: R.resistRuler })
  if (hasTrait(h, 'steadfast')) out.push({ key: 'steadfast', n: R.resistSteadfast })
  return out
}

/**
 * 맡겨 둘 때의 어림 — 벽이 무너질 때까지 계절 · 곡식 모두 (열에 하나 ~ 열에 아홉). 굴림이라 범위다 (ODDS 원칙 1).
 * 시드와 상관없는 고정 굴림으로 센다 (같은 판이면 늘 같은 범위)
 */
export function wooOutlook(r: Realm, hero: string, by: string | null): { wall: [number, number]; grain: [number, number] } {
  const R = P.realm
  const N = 200
  const resist = Math.max(0, wallOf(r, hero))
  const drop = persuadeDropOf(r, by)
  const p = Math.max(0.01, recruitChance(r, hero, by))
  const walls: number[] = []
  const totals: number[] = []
  for (let i = 0; i < N; i++) {
    let w = resist
    let n = 0
    while (w > 0 && n < 99) { n++; w -= drop * (1 + (roll(7, i, `wo-w:${n}`) * 2 - 1) * R.persuadeSway) }
    let t = 0
    do t++; while (roll(7, i, `wo-t:${t}`) >= p && t < 99)
    walls.push(n)
    totals.push(n + t)
  }
  const q = (xs: number[], f: number): number => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(f * xs.length))]!
  return { wall: [q(walls, 0.1), q(walls, 0.9)], grain: [q(totals, 0.1) * R.persuadeGrain, q(totals, 0.9) * R.persuadeGrain] }
}
