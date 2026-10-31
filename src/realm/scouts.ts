/**
 * 정찰 여러 개 · 이웃은 늘 보인다 (docs/realm/FOCUS.md D · 형 11-01: "정찰 1개로 여러 전선을 못 봄")
 *
 *  - **파수** — 플레이어 고을과 길로 맞닿은 고을은 턴마다 군세가 범위로 보인다 (출처 'watch' · 흐림 P.realm.watchBlur).
 *    정찰이 본 것이 더 좁으면 그것을 남긴다 — 새 파수가 아는 것을 흐리게 만들지 않는다.
 *  - **정찰꾼** — 먼 곳용. 우리 고을에서 길 P.realm.scoutReach 번 안의 본 땅까지 간다.
 *    몇 명인지는 고을 수에 따라 1 → 2 → 3 (scoutTowns2 · scoutTowns3).
 *  - 정찰꾼 수는 사람과 AI 가 같은 규칙이다 — 판(season.resolveScouts)이 한도를 넘는 정찰 명령을 버린다.
 *
 * 굴림은 `watch-u:<나라>:<고을>` 하나뿐 (A1) — 같은 판이면 같은 범위.
 */
import { roll } from '../core/rng.ts'
import { P } from '../tune/params.ts'
import { ageSeasons } from './calendar.ts'
import { sourceBlur } from './intel.ts'
import { nodeStrength } from './season.ts'
import type { NodeIntel, Realm } from './types.ts'

/** 그 나라의 고을 수 */
export function townCount(r: Realm, faction: string): number {
  let n = 0
  for (const x of Object.values(r.nodes)) if (x.owner === faction) n++
  return n
}

/** 그 나라가 한 턴에 보낼 수 있는 정찰꾼 수 — 고을 수에 따라 1 · 2 · 3 */
export function scoutCap(r: Realm, faction: string): number {
  const n = townCount(r, faction)
  return n >= P.realm.scoutTowns3 ? 3 : n >= P.realm.scoutTowns2 ? 2 : 1
}

/** 길로 맞닿은 고을들 (id 순) */
function adjacency(r: Realm): Map<string, string[]> {
  const adj = new Map<string, string[]>()
  for (const ed of Object.values(r.edges).sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0))) {
    ;(adj.get(ed.a) ?? adj.set(ed.a, []).get(ed.a)!).push(ed.b)
    ;(adj.get(ed.b) ?? adj.set(ed.b, []).get(ed.b)!).push(ed.a)
  }
  return adj
}

/** 우리 고을에서 길 몇 번 — 우리 고을은 0 · `max` 번 넘게 걸리는 곳은 없다 */
function hops(r: Realm, faction: string, max: number, adj = adjacency(r)): Map<string, number> {
  const out = new Map<string, number>()
  let ring: string[] = []
  for (const n of Object.values(r.nodes)) if (n.owner === faction) { out.set(n.id, 0); ring.push(n.id) }
  for (let d = 1; d <= max && ring.length > 0; d++) {
    const next: string[] = []
    for (const id of ring.sort()) {
      for (const nb of adj.get(id) ?? []) {
        if (out.has(nb) || r.nodes[nb] === undefined) continue
        out.set(nb, d)
        next.push(nb)
      }
    }
    ring = next
  }
  return out
}

/** 파수가 보는 고을 — 우리 고을과 길로 맞닿은 남의 고을·빈땅 (id 순) */
export function watchedNodes(r: Realm, faction: string): string[] {
  const out: string[] = []
  for (const [id, d] of hops(r, faction, 1)) if (d === 1) out.push(id)
  return out.sort()
}

/**
 * 정찰꾼이 갈 수 있는 곳 — 우리 고을에서 길 scoutReach 번 안, 본 땅, 우리 땅이 아닌 곳.
 * 가까운 곳이 먼저 (같은 거리면 id 순). 맞닿은 곳도 든다 — 파수는 범위만, 정찰은 정확한 군세·병종·경계를 본다.
 */
export function scoutTargets(r: Realm, faction: string): string[] {
  const known = r.intel[faction] ?? {}
  const fog = r.known !== undefined
  const out: Array<[string, number]> = []
  for (const [id, d] of hops(r, faction, P.realm.scoutReach)) {
    if (d === 0) continue
    if (fog && known[id]?.land !== true) continue
    out.push([id, d])
  }
  return out.sort((x, y) => x[1] - y[1] || (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0)).map((x) => x[0])
}

/** 범위의 폭 (위/아래 비) — 지금 이 정보가 얼마나 흐린가 */
function spread(f: NonNullable<NodeIntel['force']>, age: number): number {
  const R = P.realm
  if (age >= R.intelBlindAge || !Number.isFinite(f.f0)) return Infinity
  const b = sourceBlur(f.src) ?? sourceBlur('merchant')
  const u = Number.isFinite(f.u) ? f.u : 0.5
  const a = Math.max(0, age)
  const lo = (1 - b * u) * Math.pow(1 - R.intelLossMax, a)
  const hi = (1 + b * (1 - u)) * Math.pow(1 + R.intelGrowMax, a)
  return lo <= 0 ? Infinity : hi / lo
}

/**
 * 파수 — 플레이어 나라의 고을 이웃 군세를 지금 것으로 (턴 끝, 턴이 넘어간 뒤 · 그래서 다음 턴에 고를 때 「이번 달」이다).
 * 이미 아는 것이 더 좁으면(이번 달·지난달의 정찰) 그대로 둔다. 땅·경계·곳간은 건드리지 않는다.
 *
 * 플레이어 자리만 건다 — AI 는 원래 맞닿은 곳을 정찰로 본다(ai.scoutStale). 모든 나라에 걸면 봇 대전(realm-sim)에서
 * 싸움이 두 배 가까이 되고 큰 나라가 굴러간다 (변한 축소판 60판: 거칠산국 이김 3%→65%) · 형에게 물어볼 일 (11-01)
 */
export function watchBorders(r: Realm): void {
  const f = r.player
  if (f === undefined || r.factions[f] === undefined) return
  const known = (r.intel[f] ??= {})
  for (const id of watchedNodes(r, f)) {
    const n = r.nodes[id]!
    if (n.owner === null) continue // 빈땅·주인 없는 소도엔 지킬 군세가 없다 (지도에 「0」만 흩뿌리지 않게)
    const force = { f0: nodeStrength(r, id, n.owner), src: 'watch' as const, u: roll(r.seed, r.season, `watch-u:${f}:${id}`), season: r.season }
    const had = known[id]?.force
    if (had && (keepsLastTurn(r, had) || spread(had, ageSeasons(r, had.season)) <= spread(force, 0))) continue
    // 파수는 군세만 본다 — 정찰이 본 병종 몫(seenMix)은 본 때(mixAt)째 남겨, 제 나이대로 낡는다
    const mixAt = had?.mix !== undefined ? (had.mixAt ?? had.season) : undefined
    const keep = had?.mix !== undefined && mixAt !== undefined && ageSeasons(r, mixAt) < P.realm.intelBlindAge ? { mix: had.mix, mixAt } : {}
    known[id] = { ...(known[id] ?? { alert: null }), land: true, force: { ...force, ...keep } }
  }
}

/** 지난 턴의 정찰·첩자가 본 것은 한 턴 동안 그대로 — 병종 몫(seenMix)이 고르기 전에 사라지지 않게 (옛 판은 한 턴이 한 계절이다) */
function keepsLastTurn(r: Realm, f: NonNullable<NodeIntel['force']>): boolean {
  return r.season - f.season <= 1 && (sourceBlur(f.src) ?? Infinity) < P.realm.watchBlur
}

/** 고정해 둔 정찰 자리 (화면이 브라우저에 남긴 글) — 옛 판은 고을 id 하나, 새 판은 JSON 목록 */
export function parseScoutKeep(raw: string | null): string[] {
  if (raw === null || raw === '') return []
  if (raw.startsWith('[')) {
    try {
      const v: unknown = JSON.parse(raw)
      return Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && x !== ''))] : []
    } catch { return [] }
  }
  return [raw]
}

/** 이번 턴 초안의 정찰 자리 — 옛 초안은 `scout: '고을'`(빈 글이면 없음), 새 초안은 `scouts: [...]` */
export function draftScouts(d: Readonly<Record<string, unknown>>): string[] {
  const v = d['scouts']
  if (Array.isArray(v)) return [...new Set(v.filter((x): x is string => typeof x === 'string' && x !== ''))]
  const one = d['scout']
  return typeof one === 'string' && one !== '' ? [one] : []
}
