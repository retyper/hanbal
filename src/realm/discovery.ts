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
import { monthly, seasonIdx } from './calendar.ts'
import { hopsFrom } from './data/regions/rivals.ts'
import type { DiscoverHow, NodeIntel, Realm, ReportLine } from './types.ts'

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

/**
 * 화면이 그 나라를 보이나 — 플레이어는 소개 줄(`meet.wait`)에 선 나라를 아직 모르는 것처럼 본다 (이름·땅·소식).
 * 판의 셈(AI · 외교 · 사건)은 늘 `knows` 를 쓴다. 이것은 화면(src/ui)과 화면만 쓰는 셈(advice · dex)만 부른다
 */
export function met(r: Realm, a: string, b: string): boolean {
  return knows(r, a, b) && !(a === r.player && r.meet !== undefined && r.meet.wait.some((x) => x.nation === b))
}

/** 처음 아는 나라 — 제 땅과 길로 맞닿은 고을의 주인 */
export function initialKnown(r: Realm): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const f of Object.keys(r.factions).sort()) out[f] = [...neighboursOf(r, f)].sort()
  return out
}

/**
 * 판을 열 때 안개를 건다 — 저마다 제 땅과 길로 맞닿은 고을만 보고, 맞닿은 이웃과 처음부터 얽힌 나라(싸움·화친·동맹)만 안다.
 * 형 10-27: "1장 시작할 때 너무 맵이 다 보이잖아. 모든 게임은 시작할 때 기본적으로 자기 지도랑 길로 연결된 곳만 보이게".
 * 이미 안개가 있는 판(영남·삼한·넓어지는 지도)은 그대로 둔다.
 */
export function fogStart(r: Realm): void {
  if (r.known !== undefined) return
  for (const f of Object.keys(r.factions).sort()) {
    const known: Record<string, NodeIntel> = {}
    const see = (id: string): void => { known[id] = r.intel[f]?.[id] ?? { land: true, force: null, alert: null } }
    for (const n of Object.values(r.nodes)) if (n.owner === f) see(n.id)
    for (const ed of Object.values(r.edges)) {
      if (r.nodes[ed.a]?.owner === f) see(ed.b)
      if (r.nodes[ed.b]?.owner === f) see(ed.a)
    }
    for (const a of Object.values(r.armies)) if (a.faction === f) see(a.at)
    r.intel[f] = known
  }
  const k = initialKnown(r)
  for (const key of Object.keys(r.relations).sort()) {
    const [a, b] = key.split('|') as [string, string]
    if (k[a] !== undefined && !k[a].includes(b)) k[a] = [...k[a], b].sort()
    if (k[b] !== undefined && !k[b].includes(a)) k[b] = [...k[b], a].sort()
  }
  r.known = k
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
export function stepDiscovery(r: Realm, lines: ReportLine[], drift = true): void {
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
  if (!drift) return
  // 먼 소식 — 빈 땅이 사이를 가르는 판(타국 몇만 남긴 자유판)은 아무와도 안 닿아 소문이 돌 길이 없다. 계절 farMeetSeasons 마다
  // 아직 모르는 가장 가까운 나라(길 걸음 수) 하나를 떠돌이 장사꾼의 소식으로 안다 — 첫 만남 ~6계절 · 둘째 ~12
  // (FOCUS J · 11-01: 영남 판 40계절 내내 아무도 못 만났다) · 달 시계 판만 (옛 판은 그대로)
  if (monthly(r)) {
    for (const f of fs) {
      const kn = knownOf(r, f).filter((x) => alive(x)).length
      if (seasonIdx(r) + 1 < P.realm.farMeetSeasons * (kn + 1)) continue
      const hops = hopsFrom(r, r.factions[f]?.capital)
      const far = (x: string): number => hops.get(r.factions[x]?.capital ?? '') ?? Infinity
      const next = fs.filter((x) => x !== f && !knows(r, f, x)).sort((a, b) => far(a) - far(b) || (a < b ? -1 : 1))[0]
      if (next !== undefined) discover(r, f, next, 'rumor', lines)
    }
  }
  // 소문 — 아는 나라가 아는, 아직 모르는 나라 하나 (계절마다 한 번 · 달 시계면 계절 끝 달에만 — drift)
  for (const f of fs) {
    // 영남 판은 더 좁고 촘촘해 소문이 빨리 돈다 (2026-10-21 안개를 켜며 — 80판 시뮬로 맞춘 값, BALANCE)
    if (roll(r.seed, r.season, `disc:${f}`) >= (r.region === 'yeongnam' ? P.realm.discoverDriftYeongnam : P.realm.discoverDrift)) continue
    const cands = new Set<string>()
    for (const g of knownOf(r, f)) for (const x of knownOf(r, g)) if (x !== f && !knows(r, f, x) && alive(x)) cands.add(x)
    const list = [...cands].sort()
    if (list.length === 0) continue
    const pick = list[Math.floor(roll(r.seed, r.season, `disc-pick:${f}`) * list.length)]!
    discover(r, f, pick, 'rumor', lines)
  }
}

// ───────── 새 나라 소개 — 한 계절에 하나씩 (FOCUS G · 형: "한 계절에 모르는 도시 2개 이상이면 과부하")
//
// 판의 셈은 그대로 둔다: 플레이어의 known 은 이번 턴에 바로 늘고, AI·외교·사건은 그것을 본다 (줄을 sim 에 걸면 realm-sim 이 달라진다).
// 화면만 늦춘다: 이번 턴에 알게 된 나라는 meet.wait 줄 끝에 서고, 화면은 met() 으로 그 줄의 나라를 아직 모르는 것처럼 본다.

/** 이번 턴에 우리와 직접 얽힌 나라 — 싸움 · 사신 · 장터 · 사이가 바뀜 · 우리 고을을 오가는 군대 · 드러난 공작 · 우리에게 건 청 · 사건 카드의 나라 */
function touching(r: Realm, me: string, lines: readonly ReportLine[]): Set<string> {
  const out = new Set<string>()
  const pair = (a: string, b: string): void => {
    if (a === me) out.add(b)
    else if (b === me) out.add(a)
  }
  for (const l of lines) {
    switch (l.kind) {
      case 'battle': {
        const atk = l.atkFaction ?? r.armies[l.attacker]?.faction
        if (atk !== undefined) pair(atk, l.defender)
        break
      }
      case 'envoy': pair(l.from, l.to); break
      case 'market': pair(l.a, l.b); break
      case 'relation': pair(l.a, l.b); break
      case 'sighted': out.add(l.faction); break
      case 'plot': if (l.target === me && (l.exposed ?? l.caught)) out.add(l.faction); break
      case 'ask': pair(l.ask.from, l.ask.to); break
      default: break
    }
  }
  for (const a of r.asks ?? []) if (a.to === me) out.add(a.from)
  if (r.card?.from !== undefined) out.add(r.card.from)
  return out
}

/**
 * 11 끝 — 새 나라 소개. 플레이어가 이번 턴에 알게 된 나라(discover 줄)를 줄 끝에 세우고, 한 계절에 meetPerSeason 나라씩 화면에 낸다.
 * 소개되는 나라만 discover 줄이 보고에 남는다 — 줄을 섰던 나라는 소개되는 턴의 보고에 다시 적힌다 (그 줄이 화면의 소개 카드가 된다).
 * 달 시계면 석 달에 하나다 (`seasonIdx`). 우리와 직접 얽힌 나라는 이름 없이 둘 수 없어 줄을 건너뛴다.
 * 땅을 다 잃은 나라는 조용히 줄에 남는다 (다시 일어나면 그때 소개). known 은 만지지 않는다 · 굴림 없음.
 * `t` 는 방금 넘긴 턴 번호 (보고의 season).
 */
export function stepMeet(r: Realm, lines: ReportLine[], t: number): void {
  const me = r.player
  if (r.known === undefined || me === undefined) return
  const fresh: Array<{ nation: string; how: DiscoverHow }> = []
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]!
    if (l.kind !== 'discover' || l.faction !== me) continue
    fresh.push({ nation: l.nation, how: l.how })
    lines.splice(i--, 1)
  }
  if (fresh.length === 0 && r.meet === undefined) return
  const si = seasonIdx(r, t)
  let n = r.meet !== undefined && r.meet.at === si ? r.meet.n : 0
  const wait = [...(r.meet?.wait ?? []), ...fresh]
  const urgent = touching(r, me, lines)
  const alive = (f: string): boolean => Object.values(r.nodes).some((x) => x.owner === f)
  const keep: Array<{ nation: string; how: DiscoverHow }> = []
  const show = (x: { nation: string; how: DiscoverHow }): void => {
    lines.push({ kind: 'discover', faction: me, nation: x.nation, how: x.how })
    n++
  }
  for (const x of wait) if (urgent.has(x.nation)) show(x)
  for (const x of wait) {
    if (urgent.has(x.nation)) continue
    if (n < P.realm.meetPerSeason && alive(x.nation)) show(x)
    else keep.push(x)
  }
  r.meet = { wait: keep, at: si, n }
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
