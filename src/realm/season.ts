/**
 * 한 계절을 넘긴다 — advance(realm, orders, snipes) → { next, report } (docs/realm/SYSTEMS.md §12 · BUILD §1-2)
 *
 * 순수 함수다: 입력이 같으면 출력이 같고, 안에서 아무것도 밖을 읽지 않는다. 받은 realm 은 건드리지 않고 복사본을 돌려준다.
 * 굴림은 전부 이름이 있다 (core/rng.ts roll) — 판정 하나를 더해도 다른 판정이 밀리지 않는다.
 *
 * R1 이 도는 순서 (SYSTEMS §12 의 번호):
 *   1 명령 확정 → 2 정찰 → 3 행군 → 4 기습 → 5 전투·생포 → 9 경계 감쇠 → 11 계절 +1
 * 6 회유 · 7 생산 · 8 이주 · 10 사건은 R3~R4 에서 이 자리에 끼운다 — 번호를 지켜야 순서가 안 바뀐다.
 *
 * ★ 알려진 틈 (R1): 정보는 고을 단위인데 **군대가 고을로 들어오는 것**은 SYSTEMS §2-2 의 "늘어남 상한" 밖이다.
 *   지금은 다른 나라 군대가 들어온 고을의 군세 정보를 보지 못한 채 두므로 범위가 참값을 놓칠 수 있다.
 *   설계에서 정할 일 — "행군은 보인다"로 할지, 군대 단위 정보로 갈지. (docs/STATUS.md 에 적어 둠)
 */
import { roll } from '../core/rng.ts'
import { P } from '../tune/params.ts'
import {
  ambushChance, bins, fate, headcount, losses, pick, power, strength, winChance,
  type Force, type UnitKind,
} from './battle.ts'
import type {
  Army, EdgeKind, Order, Realm, REdge, Report, ReportLine, RNode, SeasonOfYear, SnipeZone,
} from './types.ts'

const SEASONS: readonly SeasonOfYear[] = ['spring', 'summer', 'autumn', 'winter']

export function seasonOf(n: number): SeasonOfYear {
  return SEASONS[((n % 4) + 4) % 4]!
}

/** 저격 판 하나의 열쇠 — 고을과 공격 군대. 화면의 저격과 계절 처리가 같은 열쇠로 만난다 */
export function battleKey(node: string, army: string): string {
  return `${node}:${army}`
}

export function otherEnd(ed: REdge, from: string): string | null {
  if (ed.a === from) return ed.b
  if (ed.b === from) return ed.a
  return null
}

export function neighbors(r: Realm, node: string): string[] {
  const out: string[] = []
  for (const ed of Object.values(r.edges)) {
    const o = otherEnd(ed, node)
    if (o !== null) out.push(o)
  }
  return out.sort()
}

/** 이 계절에 이 길이 막혔는가 (SYSTEMS §1-1 · §1-3) */
export function blockedWhy(ed: REdge, season: SeasonOfYear): 'winterPass' | 'summerFord' | null {
  if (ed.kind === 'pass' && season === 'winter') return 'winterPass'
  if (ed.kind === 'ford' && season === 'summer') return 'summerFord'
  return null
}

/** 길 하나를 지나는 계절 수 */
export function marchSeasons(kind: EdgeKind, season: SeasonOfYear): number {
  const base = kind === 'pass' || kind === 'mudflat' ? P.realm.marchSlow : 1
  return base + (season === 'summer' ? P.realm.marchSummerExtra : 0)
}

/** 기습 은폐 — 길·고을 꼬리표·계절 (SYSTEMS §1-1 · §1-2 · §3) */
export function conceal(ed: REdge, node: RNode, season: SeasonOfYear): number {
  const R = P.realm
  const winter = season === 'winter'
  let c: number
  switch (ed.kind) {
    case 'field': c = R.concealField; break
    case 'pass': c = R.concealPass; break
    case 'forest': c = R.concealForest; break
    case 'reeds': c = winter ? R.concealReedsWinter : R.concealReeds; break
    case 'ford': c = R.concealFord; break
    case 'sea': c = R.concealSea; break
    case 'mudflat': c = R.concealMudflat; break
  }
  // 언 강 — 지키는 쪽이 강을 벽으로 믿는다. "겨울 = 기습의 계절"이 숫자로도 참이 되게
  if (winter && (ed.kind === 'ford' || ed.kind === 'reeds')) c += R.ambushWinterIce
  if ((season === 'spring' || season === 'autumn') && node.tags.includes('fog')) c += R.concealFog
  return c
}

/** 방어측 지형·성 배수 T (SYSTEMS §4-2 · §1-2) — 겹치면 곱한다 */
export function fortMul(node: RNode, season: SeasonOfYear): number {
  const R = P.realm
  let t = 1
  if (node.kind === 'fort') t *= R.fortSanseong
  if (node.tags.includes('palisade')) t *= R.fortPalisade
  if (node.tags.includes('high')) t *= R.fortHigh
  if (node.tags.includes('moat') && season !== 'winter') t *= R.fortMoat
  return t
}

function heroOf(r: Realm, a: Army) {
  if (a.hero === null) return null
  const h = r.heroes[a.hero]
  return h !== undefined && h.status === 'free' ? h : null
}

export function forceOf(r: Realm, a: Army): Force {
  return { mix: a.mix, equip: a.equip, mu: heroOf(r, a)?.mu ?? 1, morale: a.morale }
}

/** 여러 군대를 한 판정 입력으로 — 병력은 더하고, 장비·지휘는 가장 큰 군대·가장 센 장수의 것 */
function mergeForces(r: Realm, armies: readonly Army[]): Force {
  const mix: Partial<Record<UnitKind, number>> = {}
  let biggest: Army | null = null
  let mu = 1
  let moraleSum = 0
  let n = 0
  for (const a of armies) {
    const c = headcount(forceOf(r, a))
    for (const [k, v] of Object.entries(a.mix) as Array<[UnitKind, number]>) mix[k] = (mix[k] ?? 0) + v
    if (biggest === null || c > headcount(forceOf(r, biggest))) biggest = a
    mu = Math.max(mu, heroOf(r, a)?.mu ?? 1)
    moraleSum += a.morale * c
    n += c
  }
  return { mix, equip: biggest?.equip ?? 'stone', mu, morale: n > 0 ? moraleSum / n : 1 }
}

/** 고을에 머무는(행군 중이 아닌) 군대 — id 순서로 (결정론) */
export function armiesAt(r: Realm, node: string): Army[] {
  return Object.values(r.armies)
    .filter((a) => a.at === node && a.march === null)
    .sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0))
}

/** 정보가 다루는 그 고을의 군세 — 머무는 군대 strength 의 합 (intel.ts 의 F) */
export function nodeStrength(r: Realm, node: string, owner: string | null): number {
  let f = 0
  for (const a of armiesAt(r, node)) if (a.faction === owner) f += strength(forceOf(r, a))
  return f
}

function bestRyak(r: Realm, armies: readonly Army[]): number {
  let best = 1
  for (const a of armies) best = Math.max(best, heroOf(r, a)?.ryak ?? 1)
  return best
}

/**
 * 물러날 곳 — 먼저 `prefer`(떠나온 고을), 아니면 이웃 가운데 제 나라 땅. 어느 쪽이든 **적이 머물지 않는** 곳이어야 한다.
 * 떠나온 사이에 남이 쥔 고을로 돌아가면 한 고을에 두 나라가 함께 머문다 (시험이 잡았다). 없으면 null — 흩어진다.
 */
function retreatTo(r: Realm, a: Army, from: string, prefer: string | null): string | null {
  const safe = (n: string): boolean =>
    r.nodes[n]?.owner === a.faction && !armiesAt(r, n).some((x) => x.faction !== a.faction)
  if (prefer !== null && safe(prefer)) return prefer
  return neighbors(r, from).find(safe) ?? null
}

function scaleMix(a: Army, keep: number): void {
  for (const k of Object.keys(a.mix) as UnitKind[]) a.mix[k] = Math.round((a.mix[k] ?? 0) * keep)
}

/**
 * 미리 보기 — 이번 계절에 열리는 싸움 (SYSTEMS §12 가). 상태를 바꾸지 않는다.
 * 저격 화면은 여기서 나온 열쇠로 판을 열고, 결과를 advance 의 snipes 에 넣는다.
 */
export function preview(realm: Realm, orders: readonly Order[]): string[] {
  const r = structuredClone(realm)
  applyOrders(r, orders, [])
  const keys: string[] = []
  for (const a of Object.values(r.armies).sort((x, y) => (x.id < y.id ? -1 : 1))) {
    const m = a.march
    if (m === null || m.left !== 1) continue
    const owner = r.nodes[m.to]?.owner ?? null
    if (owner !== null && owner !== a.faction && armiesAt(r, m.to).some((d) => d.faction !== a.faction)) {
      keys.push(battleKey(m.to, a.id))
    }
  }
  return keys
}

/** 1 — 명령 확정: 출정 명령을 군대에 싣는다. 막힌 길은 보고에 남기고 떠나지 않는다 */
function applyOrders(r: Realm, orders: readonly Order[], lines: ReportLine[]): void {
  const season = seasonOf(r.season)
  for (const o of orders) {
    if (o.kind !== 'march') continue
    const a = r.armies[o.army]
    const ed = r.edges[o.edge]
    if (a === undefined || ed === undefined || a.march !== null) continue
    const to = otherEnd(ed, a.at)
    if (to === null) continue
    const why = blockedWhy(ed, season)
    if (why !== null) {
      lines.push({ kind: 'blocked', army: a.id, edge: ed.id, why })
      continue
    }
    a.march = { from: a.at, to, edge: ed.id, left: marchSeasons(ed.kind, season), ambush: o.ambush }
  }
}

/** 2 — 정찰: 땅을 열고 군세를 a=0 으로 · 들키면 경계 + (SYSTEMS §2-4) */
function resolveScouts(r: Realm, orders: readonly Order[], lines: ReportLine[]): void {
  const R = P.realm
  for (const o of orders) {
    if (o.kind !== 'scout') continue
    const node = r.nodes[o.node]
    const known = r.intel[o.faction]
    if (node === undefined || known === undefined) continue
    const scout = o.hero !== null ? r.heroes[o.hero] : undefined
    const ourRyak = scout !== undefined && scout.status === 'free' ? scout.ryak : R.scoutRyak
    const theirRyak = bestRyak(r, armiesAt(r, node.id).filter((a) => a.faction !== o.faction))
    const pDetect = Math.min(1, Math.max(0, R.scoutDetectBase + R.scoutDetectPerRyak * (theirRyak - ourRyak)))
    const detected = roll(r.seed, r.season, `scout:${o.faction}:${node.id}`) < pDetect
    const w = r.watch[node.id]!
    if (detected) w.alert = Math.min(R.alertMax, w.alert + R.alertOnDetect)
    known[node.id] = {
      land: true,
      force: { f0: nodeStrength(r, node.id, node.owner), src: 'scout', u: roll(r.seed, r.season, `scout-u:${o.faction}:${node.id}`), season: r.season },
      alert: { v: w.alert, season: r.season },
    }
    for (const nb of neighbors(r, node.id)) known[nb] ??= { land: true, force: null, alert: null }
    lines.push({ kind: 'scout', faction: o.faction, node: node.id, detected })
  }
}

/** 4·5 — 한 군대가 적 고을에 닿았다: 기습 → 전투 → 생포 */
function fight(r: Realm, a: Army, snipes: Readonly<Record<string, SnipeZone>>, lines: ReportLine[]): void {
  const R = P.realm
  const season = seasonOf(r.season)
  const m = a.march!
  const node = r.nodes[m.to]!
  const ed = r.edges[m.edge]!
  const defenders = armiesAt(r, node.id).filter((d) => d.faction !== a.faction)
  const defFaction = node.owner ?? defenders[0]!.faction
  const w = r.watch[node.id]!

  // 4 — 기습
  let ambush: 'none' | 'success' | 'caught' = 'none'
  if (m.ambush) {
    const p = ambushChance(conceal(ed, node, season), heroOf(r, a)?.ryak ?? 1, bestRyak(r, defenders), 0, w.lull, w.alert)
    ambush = roll(r.seed, r.season, `ambush:${ed.id}:${a.id}`) < p ? 'success' : 'caught'
    if (ambush === 'success') {
      // 이웃 고을이 기습당했다 — 같은 나라의 이웃이 경계를 올린다 (SYSTEMS §3)
      for (const nb of neighbors(r, node.id)) {
        if (r.nodes[nb]?.owner === defFaction) r.watch[nb]!.alert = Math.min(R.alertMax, r.watch[nb]!.alert + R.alertOnAmbushed)
      }
    }
  }

  // 저격 — 플레이어가 쏜 쪽은 상대 군대. 머리·몸통·북은 그 군대 F 에, 다리·몸통은 생포에 (SYSTEMS §4-2 · §5-3)
  const key = battleKey(node.id, a.id)
  const zone = snipes[key] ?? 'miss'
  const playerIsAtk = r.factions[a.faction]?.mind === 'player'
  const xMul = zone === 'head' ? R.snipeHead : zone === 'body' ? R.snipeBody : zone === 'drum' ? R.snipeDrum : 1
  const atkF = forceOf(r, a)
  const defF = mergeForces(r, defenders)
  const field = {
    fort: fortMul(node, season),
    crossing: ed.kind === 'ford' && season !== 'winter',
    ambush,
    // 북은 방어측만 (SYSTEMS §4-2)
    snipeAtk: playerIsAtk || zone === 'drum' ? 1 : xMul,
    snipeDef: playerIsAtk ? xMul : 1,
  }
  const p = winChance(power(atkF, defF, field, 'atk'), power(defF, atkF, field, 'def'))
  const outcome = pick(bins(p), roll(r.seed, r.season, `battle:${key}`))

  // 손실
  const loss = losses(outcome)
  scaleMix(a, 1 - loss.atk)
  for (const d of defenders) scaleMix(d, 1 - loss.def)

  // 5 — 진 쪽 장수의 운명 (생포를 먼저, 남은 몫에서 전사)
  const atkWon = outcome === 'rout' || outcome === 'win'
  const atkLost = outcome === 'lose' || outcome === 'routed'
  let captured: string | null = null
  let killed: string | null = null
  if (atkWon || atkLost) {
    const loserArmies = atkWon ? defenders : [a]
    const loserHero = loserArmies.map((x) => heroOf(r, x)).find((x) => x !== null) ?? null
    if (loserHero !== null) {
      const sniped = atkWon === playerIsAtk // 플레이어가 쏜 쪽이 진 쪽이다
      let bonus = 0
      if (atkWon && ambush === 'success') bonus += R.captureAmbush
      if (sniped && zone === 'leg') bonus += R.captureLegShot
      if (sniped && zone === 'body') bonus += R.captureBodyShot
      const f = fate(outcome, bonus)
      const r2 = roll(r.seed, r.season, `fate:${key}`)
      const winner = atkWon ? a.faction : defFaction
      if (r2 < f.capture) {
        loserHero.status = 'captive'
        loserHero.captor = winner
        captured = loserHero.id
      } else if (r2 < f.capture + f.death) {
        loserHero.status = 'dead'
        killed = loserHero.id
      }
      if (captured !== null || killed !== null) for (const x of loserArmies) if (x.hero === loserHero.id) x.hero = null
    }
  }

  // 자리 — 이기면 들어가 고을을 쥐고, 지거나 교착이면 떠난 고을로 돌아간다
  a.march = null
  if (atkWon) {
    for (const d of defenders) {
      const back = retreatTo(r, d, node.id, null)
      if (back !== null) d.at = back
      else delete r.armies[d.id] // 물러날 곳이 없다 — 흩어진다
    }
    a.at = node.id
    if (node.kind !== 'sodo') {
      node.owner = a.faction
      lines.push({ kind: 'take', faction: a.faction, node: node.id })
    }
    // 주인이 바뀐 고을의 옛 군세 정보는 뜻이 없다 — 지운다 (아는 척하지 않는다)
    for (const known of Object.values(r.intel)) {
      const k = known[node.id]
      if (k !== undefined) k.force = null
    }
  } else {
    // 지거나 교착 — 떠나온 고을로. 그새 남이 쥐었으면 이웃의 제 땅으로, 그것도 없으면 흩어진다
    const back = retreatTo(r, a, m.from, m.from)
    if (back !== null) a.at = back
    else delete r.armies[a.id]
  }
  lines.push({ kind: 'battle', node: node.id, attacker: a.id, defender: defFaction, ambush, p, outcome, captured, killed })
}

/** 3·4·5 — 행군: 남은 계절을 줄이고, 닿은 군대를 처리한다 */
function resolveMarches(r: Realm, snipes: Readonly<Record<string, SnipeZone>>, lines: ReportLine[]): void {
  const marching = Object.values(r.armies)
    .filter((a) => a.march !== null)
    .sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0))
  for (const a of marching) {
    if (r.armies[a.id] === undefined) continue // 앞의 싸움에서 흩어졌다
    const m = a.march!
    m.left -= 1
    if (m.left > 0) continue
    const node = r.nodes[m.to]!
    const hostile = armiesAt(r, node.id).some((d) => d.faction !== a.faction)
    if (hostile && node.kind !== 'sodo') {
      fight(r, a, snipes, lines)
    } else {
      a.march = null
      a.at = node.id
      lines.push({ kind: 'arrive', army: a.id, node: node.id })
      if (node.owner !== a.faction && node.kind !== 'sodo') {
        node.owner = a.faction
        lines.push({ kind: 'take', faction: a.faction, node: node.id })
        for (const known of Object.values(r.intel)) {
          const k = known[node.id]
          if (k !== undefined) k.force = null
        }
      }
    }
  }
  // 병력이 바닥난 군대는 흩어진다
  for (const a of Object.values(r.armies)) if (headcount(forceOf(r, a)) < 1) delete r.armies[a.id]
}

/** 9 — 경계는 계절마다 0 으로 돌아간다 */
function decayWatch(r: Realm): void {
  for (const w of Object.values(r.watch)) w.alert = Math.max(0, w.alert - P.realm.alertDecay)
}

export function advance(
  realm: Realm,
  orders: readonly Order[],
  snipes: Readonly<Record<string, SnipeZone>> = {},
): { next: Realm; report: Report } {
  const r = structuredClone(realm)
  const lines: ReportLine[] = []
  applyOrders(r, orders, lines) // 1
  resolveScouts(r, orders, lines) // 2
  resolveMarches(r, snipes, lines) // 3 · 4 · 5
  decayWatch(r) // 9
  const report: Report = { season: r.season, lines }
  r.season += 1 // 11
  return { next: r, report }
}
