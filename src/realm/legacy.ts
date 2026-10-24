/**
 * 계승 가신 — 판이 끝날 때 우리 장수 셋을 골라 다음 판에 데려간다 (docs/realm/VISION §5-4 · PLAY §5 · BUILD §8 Q5).
 *
 * 디아블로의 창고 자리. 이겨도 져도 고른다 (VISION M7 — 져도 다음 판이 하고 싶다). 단 셋 — 첫 계단의 긴장을 지키는 상한.
 * 자란 능력치·특성(눈뜬 것 포함)·공은 그대로 따라온다. 정은 새로 쌓는다 (새 나라, 새 주인).
 * 다음 판에 같은 사람이 남의 장수로 있으면 그 사람이 우리를 따라온 것이다 — 그 나라에서 빠진다. 군주는 데려가지 못한다.
 *
 * 순수한 셈만 한다 — 고른 것을 이 기기에 두는 일은 화면(ui/realm/legacy.ts)이 한다.
 */
import { P } from '../tune/params.ts'
import { isRuler } from './heroes.ts'
import type { Hero, Realm } from './types.ts'

const sum = (h: Hero): number => h.mu + h.tong + h.ryak + h.chi + h.deok

/** 데려갈 수 있는 장수 — 우리 장수 가운데 살아 있고 군주가 아닌 이. 솜씨 합이 큰 차례 */
export function retainable(r: Realm): Hero[] {
  if (r.region === 'tutorial') return []
  return Object.values(r.heroes)
    .filter((h) => h.faction === r.player && h.status !== 'dead' && !isRuler(r, h.id) && !h.id.endsWith('-ruler'))
    .sort((a, b) => sum(b) - sum(a) || (a.id < b.id ? -1 : 1))
}

/** 다음 판으로 가져갈 몸 — 솜씨·특성·공은 그대로, 이 판의 자리·정·다친 몸은 내려놓는다 */
export function snapshot(h: Hero): Hero {
  const out: Hero = {
    id: h.id, name: h.name, faction: '', look: h.look,
    mu: h.mu, tong: h.tong, ryak: h.ryak, chi: h.chi, deok: h.deok, uiri: h.uiri, traits: [...(h.traits ?? [])],
    status: 'free', captor: null, at: null, post: null,
  }
  if (h.xp !== undefined) out.xp = { ...h.xp }
  if (h.grown !== undefined) out.grown = { ...h.grown }
  if (h.awoken !== undefined) out.awoken = h.awoken
  return out
}

/**
 * 새 판에 데려온 장수를 들인다 — 우리 도읍에 머문다. 들인 id 를 돌려준다 (판의 `retainers` 에도 적는다).
 * 배우는 판·셋 넘는 몫·그 판의 군주는 들이지 않는다.
 */
/** 이 난세 단계에서 데려갈 수 있는 동행 수 (회의 결정 — 촌장 3 · 군장·대가 2 · 왕·대왕 1 · 태왕·천손 0) */
export function retainMaxOf(tier: number): number {
  return Math.min(P.realm.retainMax, P.realm.retainByTier[Math.max(0, Math.min(P.realm.retainByTier.length - 1, tier - 1))] ?? 0)
}

export function bringRetainers(r: Realm, list: readonly Hero[]): string[] {
  if (r.region === 'tutorial' || r.scenario !== undefined) return [] // 캠페인의 장은 사서의 사람들로만
  const me = r.player
  const cap = r.factions[me]?.capital ?? null
  const out: string[] = []
  for (const x of list) {
    if (out.length >= retainMaxOf(r.tier ?? 1)) break
    if (out.includes(x.id) || isRuler(r, x.id) || x.id.endsWith('-ruler')) continue
    // 그 판에서 남의 군대를 이끌던 사람이면 군대에서 빠진다
    for (const a of Object.values(r.armies)) if (a.hero === x.id) a.hero = null
    r.heroes[x.id] = { ...snapshot(x), faction: me, at: cap }
    out.push(x.id)
  }
  if (out.length > 0) r.retainers = out
  return out
}
