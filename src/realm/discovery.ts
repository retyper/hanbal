/**
 * 발견 — 아는 나라가 늘면 지도가 넓어진다 (형: "시간지나서 발견국가가 많아지면 확장하는거지 지도도" — 2026-10-19 · docs/realm/WORLD-MAP.md §2)
 *
 * `Realm.known` 이 없으면(옛 판 · 변한·영남 판) 모두가 모두를 안다 — 이 파일은 아무 일도 안 한다.
 * 삼한 남부 판은 제 나라와 길로 맞닿은 이웃만 알고 시작한다. 그 뒤로 이렇게 알게 된다 (계절 끝, 9단계):
 *   border  — 제 땅·제 군대가 선 고을·가는 길 끝과 길로 맞닿은 고을의 주인
 *   envoy   — 사신을 주고받았다 (보낸 쪽도 받은 쪽도)
 *   market  — 장터가 섰다
 *   war     — 싸웠다
 *   spy     — 첩자가 그 나라 소문 속 다른 나라 이름을 들었다
 *   scout   — 정찰한 고을의 주인
 *   ally    — 동맹이 아는 나라를 나눠 준다
 *   rumor   — 아는 나라에게서 그 너머 한 나라의 이야기를 듣는다 (계절마다 discoverDrift 의 굴림)
 * 굴림은 `disc:<나라>` 하나뿐이다 — 같은 판·같은 명령이면 같은 발견.
 */
import { roll } from '../core/rng.ts'
import { P } from '../tune/params.ts'
import type { DiscoverHow, Realm, ReportLine } from './types.ts'

/** `a` 가 `b` 를 아나 — 발견이 없는 판이면 늘 안다 */
export function knows(r: Realm, a: string, b: string): boolean {
  if (a === b) return true
  const k = r.known?.[a]
  return k === undefined || k.includes(b)
}

/** `a` 가 아는 나라들 (제 나라 빼고) — 발견이 없는 판이면 모든 나라 */
export function knownOf(r: Realm, a: string): string[] {
  const k = r.known?.[a]
  return k === undefined ? Object.keys(r.factions).filter((f) => f !== a).sort() : [...k]
}

/** 처음 아는 나라 — 제 땅과 길로 맞닿은 고을의 주인 */
export function initialKnown(r: Realm): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const f of Object.keys(r.factions).sort()) out[f] = [...neighboursOf(r, f)].sort()
  return out
}

function neighboursOf(r: Realm, f: string): Set<string> {
  const mine = new Set<string>()
  for (const n of Object.values(r.nodes)) if (n.owner === f) mine.add(n.id)
  for (const a of Object.values(r.armies)) {
    if (a.faction !== f) continue
    mine.add(a.at)
    if (a.march !== null) mine.add(a.march.to)
  }
  const out = new Set<string>()
  for (const ed of Object.values(r.edges)) {
    for (const [x, y] of [[ed.a, ed.b], [ed.b, ed.a]] as const) {
      if (!mine.has(x)) continue
      const o = r.nodes[y]?.owner
      if (o !== null && o !== undefined && o !== f) out.add(o)
    }
  }
  for (const id of mine) {
    const o = r.nodes[id]?.owner
    if (o !== null && o !== undefined && o !== f) out.add(o)
  }
  return out
}

/** `a` 가 `b` 를 알게 된다 — 이미 알면 아무 일도 없다 */
export function discover(r: Realm, a: string, b: string, how: DiscoverHow, lines: ReportLine[]): void {
  if (r.known === undefined || a === b || r.factions[a] === undefined || r.factions[b] === undefined) return
  const k = (r.known[a] ??= [])
  if (k.includes(b)) return
  k.push(b)
  k.sort()
  lines.push({ kind: 'discover', faction: a, nation: b, how })
}

/** 9 — 이번 계절에 생긴 일로 서로 알게 된다 (보고의 줄을 읽는다) */
export function stepDiscovery(r: Realm, lines: ReportLine[]): void {
  if (r.known === undefined) return
  const seen = lines.slice() // 이번 계절에 이미 적힌 줄만 — 새 발견 줄은 다시 읽지 않는다
  const both = (a: string, b: string, how: DiscoverHow): void => {
    discover(r, a, b, how, lines)
    discover(r, b, a, how, lines)
  }
  for (const l of seen) {
    switch (l.kind) {
      case 'envoy': both(l.from, l.to, 'envoy'); break
      case 'market': both(l.a, l.b, 'market'); break
      case 'battle': if (l.atkFaction !== undefined) both(l.atkFaction, l.defender, 'war'); break
      case 'rumor':
        discover(r, l.viewer, l.about, 'spy', lines)
        if (l.other !== undefined) discover(r, l.viewer, l.other, 'spy', lines)
        break
      case 'scout': {
        const o = r.nodes[l.node]?.owner
        if (o !== null && o !== undefined) discover(r, l.faction, o, 'scout', lines)
        break
      }
      default: break
    }
  }
  const alive = (f: string): boolean => Object.values(r.nodes).some((n) => n.owner === f)
  const fs = Object.keys(r.factions).sort().filter(alive)
  // 맞닿은 이웃
  for (const f of fs) for (const o of [...neighboursOf(r, f)].sort()) discover(r, f, o, 'border', lines)
  // 동맹이 아는 나라를 나눈다
  for (const f of fs) {
    for (const g of knownOf(r, f)) {
      const rel = r.relations?.[f < g ? `${f}|${g}` : `${g}|${f}`]
      if (rel?.state !== 'ally') continue
      for (const x of knownOf(r, g)) if (x !== f) discover(r, f, x, 'ally', lines)
    }
  }
  // 소문 — 아는 나라가 아는, 아직 모르는 나라 하나
  for (const f of fs) {
    if (roll(r.seed, r.season, `disc:${f}`) >= P.realm.discoverDrift) continue
    const cands = new Set<string>()
    for (const g of knownOf(r, f)) for (const x of knownOf(r, g)) if (x !== f && !knows(r, f, x) && alive(x)) cands.add(x)
    const list = [...cands].sort()
    if (list.length === 0) continue
    const pick = list[Math.floor(roll(r.seed, r.season, `disc-pick:${f}`) * list.length)]!
    discover(r, f, pick, 'rumor', lines)
  }
}

// ───────── 본 땅 — 지도는 보고 다닌 만큼 그려진다 (형: "지도 밝히는건 정찰같은게 해야하지 않나" — 2026-10-19)
//
// 나라를 아는 것(known)과 그 땅을 본 것(intel.land)은 다르다. 땅을 보는 길:
//   제 땅과 그 이웃 (판을 열 때) · 정찰한 고을과 그 이웃 · 새로 쥔 고을의 이웃 · 동맹이 나눠 준 땅 (season.ts)
//   그리고 여기 — 우리 군대가 선 고을과 그 이웃 · 싸운 고을 · 사신과 장사꾼이 오간 길 (도읍에서 도읍까지)
// 플레이어 눈만 넓힌다 — AI 는 땅을 안 보고 나라를 본다 (발견). 굴림 없음.

/** 9 — 이번 계절에 본 땅 (플레이어) */
export function stepSight(r: Realm, lines: ReportLine[]): void {
  if (r.known === undefined || r.player === undefined) return
  const me = r.player
  const known = (r.intel[me] ??= {})
  const adj = new Map<string, string[]>()
  for (const ed of Object.values(r.edges).sort((x, y) => (x.id < y.id ? -1 : 1))) {
    ;(adj.get(ed.a) ?? adj.set(ed.a, []).get(ed.a)!).push(ed.b)
    ;(adj.get(ed.b) ?? adj.set(ed.b, []).get(ed.b)!).push(ed.a)
  }
  const see = (id: string): void => {
    if (r.nodes[id] !== undefined) known[id] ??= { land: true, force: null, alert: null }
  }
  const around = (id: string): void => {
    see(id)
    for (const nb of adj.get(id) ?? []) see(nb)
  }
  // 군대 — 선 자리와 가는 길 끝
  for (const a of Object.values(r.armies).sort((x, y) => (x.id < y.id ? -1 : 1))) {
    if (a.faction !== me) continue
    around(a.at)
    if (a.march !== null) see(a.march.to)
  }
  const seen = lines.slice()
  for (const l of seen) {
    if (l.kind === 'battle' && (l.defender === me || r.armies[l.attacker]?.faction === me)) around(l.node)
    // 사신·장사꾼이 오간 길 — 도읍에서 도읍까지 가장 짧은 길의 고을들. 그 길에 사는 나라도 알게 된다
    let other: string | null = null
    let how: DiscoverHow = 'envoy'
    if (l.kind === 'envoy' && (l.from === me || l.to === me)) other = l.from === me ? l.to : l.from
    if (l.kind === 'market' && (l.a === me || l.b === me)) { other = l.a === me ? l.b : l.a; how = 'market' }
    if (other === null) continue
    const from = r.factions[me]?.capital
    const to = r.factions[other]?.capital
    if (from === undefined || to === undefined) continue
    for (const id of pathBetween(adj, from, to)) {
      see(id)
      const o = r.nodes[id]?.owner
      if (o !== null && o !== undefined && o !== me) discover(r, me, o, how, lines)
    }
  }
}

/** 길로 가장 짧은 고을들 (양 끝 포함) — 같은 길이면 id 순 (adj 가 정렬돼 있다) */
function pathBetween(adj: ReadonlyMap<string, readonly string[]>, from: string, to: string): string[] {
  const prev = new Map<string, string>([[from, from]])
  const q = [from]
  for (let i = 0; i < q.length && !prev.has(to); i++) {
    for (const nb of adj.get(q[i]!) ?? []) {
      if (prev.has(nb)) continue
      prev.set(nb, q[i]!)
      q.push(nb)
    }
  }
  if (!prev.has(to)) return []
  const out = [to]
  while (out[out.length - 1] !== from) out.push(prev.get(out[out.length - 1]!)!)
  return out.reverse()
}
