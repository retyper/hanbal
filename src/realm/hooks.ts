/**
 * 풍습의 셈 — 결 풍습 · 나라 고리 · 땅 한 수가 판에 거는 규칙 (docs/realm/CUSTOMS.md §8 · data/customs.ts).
 *
 * 한 곳에서 끝나는 규칙은 그 자리에 둔다 — 징병·쇠·짓기는 economy, 사신은 diplomacy, 싸움과 행군은 season.
 * 여기에는 ① 여러 곳이 함께 묻는 셈(숨기 덤 · 고갯길 · 도읍 에우기 · 다시 일어날 불씨)과 ② 계절 끝의 걸음(다시 일어남 · 쇠 실은 배 ·
 * 말 치는 들 · 거른 봄 제사 · 여름 큰물)과 ③ 판을 열 때의 것(바닷가 여덟 나라)과 ④ 지도 표(규칙은 지도에 보이게 · GAP §11)를 둔다.
 * 순수 함수 — 굴림이 없다 (A1). 셈은 hasCustom 하나로만 묻는다.
 */
import { P } from '../tune/params.ts'
import { seasonOf } from './calendar.ts'
import { customDef, hasCustom, holders, noteCustom, noteOnce, type CustomId } from './data/customs.ts'
import { addGood, framesOf, goodOf, harvestModOf, isRiverside, sodoNeighbors, stockOf } from './economy.ts'
import { addFavor, declareWar, makeTruce, relationOf } from './diplomacy.ts'
import { addBond } from './heroes.ts'
import type { Army, EdgeKind, Realm, ReportLine } from './types.ts'

const menIn = (a: Army): number => Object.values(a.mix).reduce((s, v) => s + (v ?? 0), 0)

/** 어느 나라든 그 나라의 도읍인가 */
export function isCapitalNode(r: Realm, node: string): boolean {
  return Object.values(r.factions).some((f) => f.capital === node)
}

/** 그 고을과 길로 맞닿은 고을 — id 순서 */
function nextTo(r: Realm, node: string): string[] {
  const out: string[] = []
  for (const ed of Object.values(r.edges)) {
    if (ed.a === node) out.push(ed.b)
    else if (ed.b === node) out.push(ed.a)
  }
  return out.sort()
}

// ───────── 여러 곳이 함께 묻는 셈

/** 그 나라 군대가 이 길로 숨어 갈 때 더 숨는 몫 — 갈대밭(갈대·나루 길) · 뱃길(바닷길) */
export function concealBonus(r: Realm, faction: string | null | undefined, kind: EdgeKind): number {
  if (faction == null) return 0
  let c = 0
  if ((kind === 'reeds' || kind === 'ford') && hasCustom(r, faction, 'landReeds')) c += P.realm.landReedsConceal
  if (kind === 'sea' && hasCustom(r, faction, 'landPort')) c += P.realm.landPortConceal
  return c
}

/** 그 나라 군대가 이 길을 지날 때 더 걸리는 계절 — 고갯목의 값: 고갯길 한 계절 더 */
export function passExtra(r: Realm, faction: string | null | undefined, kind: EdgeKind): number {
  if (faction == null || kind !== 'pass') return 0
  return hasCustom(r, faction, 'landHigh') ? P.realm.landHighPass : 0
}

/** 도읍 에우기(이서) — 남의 도읍을 칠 때의 성 배수 `t` 를 siegeFortPow 제곱으로 (판정 season.fight 와 셈 estimate 가 같이) */
export function siegeFort(r: Realm, faction: string, node: { readonly id: string; readonly owner: string | null }, t: number): number {
  if (t <= 1 || node.owner === faction || !isCapitalNode(r, node.id) || !hasCustom(r, faction, 'geumseong')) return t
  return Math.pow(t, P.realm.siegeFortPow)
}

/**
 * 도읍 에우기의 값 — 이서가 남의 도읍을 치면 그 나라와 동맹인 나라들이 모두 구하러 온다 (전쟁).
 * 「伊西古國來攻金城…忽有異兵來 其數不可勝紀 人皆珥竹葉」 — 구원군이 나타나 물리친 이야기를 값으로
 */
export function rescueCapital(r: Realm, attacker: string, node: string, victim: string | null, lines: ReportLine[]): void {
  if (victim === null || !isCapitalNode(r, node) || !hasCustom(r, attacker, 'geumseong')) return
  let n = 0
  for (const x of Object.keys(r.factions).sort()) {
    if (x === attacker || x === victim || relationOf(r, x, victim).state !== 'ally' || relationOf(r, x, attacker).state === 'war') continue
    declareWar(r, x, attacker, lines, 'rescue')
    n++
  }
  noteCustom(r, lines, attacker, 'geumseong', { node, other: victim, n })
}

/** 다시 일어남 — 도읍을 빼앗긴 채 불씨가 살아 있으면 [빼앗긴 계절, 들고일어날 수 있는 첫 계절, 마지막 계절]. 아니면 null */
export function riseState(r: Realm, faction: string): { lost: number; from: number; until: number } | null {
  if (!hasCustom(r, faction, 'ireoseom')) return null
  const st = r.rise?.[faction]
  if (st === undefined || st === 'done') return null
  const cap = r.factions[faction]?.capital
  if (cap === undefined || r.nodes[cap]?.owner === faction) return null
  if (r.season - st > P.realm.riseWindow) return null
  return { lost: st, from: st + P.realm.riseWait, until: st + P.realm.riseWindow }
}

// ───────── 판을 열 때

/**
 * 바닷가 여덟 나라(포상) — 판에 있는 포상 나라끼리 화친으로 시작한다. 가락은 처음부터 그들을 미워한다
 * (「浦上八國謀侵加羅」 — 나해이사금 14년). 판을 여는 함수(data/regions)가 한 번 부른다
 */
export function startCustoms(r: Realm): void {
  const ps = holders(r, 'posang')
  if (ps.length >= 2) for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) makeTruce(r, ps[i]!, ps[j]!)
  if (r.factions['guya'] !== undefined && !ps.includes('guya')) for (const p of ps) addFavor(r, 'guya', p, -P.realm.posangGuyaFavor)
}

// ───────── 계절 끝 (season.advance 9)

export function stepCustoms(r: Realm, lines: ReportLine[]): void {
  // 늘 걸린 것은 처음 한 번만 적는다 — 달천 철광(철광을 쥐었을 때) · 바닷가 여덟 나라(손잡은 포상 나라가 있을 때)
  for (const f of holders(r, 'dalcheon')) {
    const mine = Object.values(r.nodes).filter((n) => n.owner === f && n.kind === 'ironMine').sort((a, b) => (a.id < b.id ? -1 : 1))[0]
    if (mine !== undefined) noteOnce(r, lines, f, 'dalcheon', { node: mine.id })
  }
  for (const f of holders(r, 'posang')) {
    const mate = holders(r, 'posang').find((x) => x !== f && (relationOf(r, f, x).state === 'ally' || relationOf(r, f, x).state === 'truce'))
    if (mate !== undefined) noteOnce(r, lines, f, 'posang', { other: mate })
  }
  stepRise(r, lines)
  stepFuneral(r, lines)
  stepIronShip(r, lines)
  stepPasture(r, lines)
  stepSodoSkip(r, lines)
  stepFlood(r, lines)
}

/** 갈대밭(땅)의 값 — 여름 큰물: 여름이 끝날 때 우리 강가 고을의 집이 landReedsFlood 만큼 준다 */
function stepFlood(r: Realm, lines: ReportLine[]): void {
  if (seasonOf(r.season) !== 'summer' || P.realm.landReedsFlood <= 0) return
  for (const f of holders(r, 'landReeds')) {
    let lost = 0
    let at: string | undefined
    for (const n of Object.values(r.nodes).sort((a, b) => (a.id < b.id ? -1 : 1))) {
      if (n.owner !== f || n.hh <= 0 || !isRiverside(r, n.id)) continue
      const d = Math.round(n.hh * P.realm.landReedsFlood)
      if (d <= 0) continue
      n.hh -= d
      lost += d
      at ??= n.id
    }
    if (lost > 0) noteCustom(r, lines, f, 'landReeds', { ...(at !== undefined ? { node: at } : {}), n: lost })
  }
}

/**
 * 다시 일어남(압독·실직) — 도읍을 빼앗기고 riseWait 계절이 지나 riseWindow 안에, 빼앗은 나라가 도읍에 둔 군사가
 * 그 도읍 장정의 riseGuard 배보다 적으면 사람들이 들고일어나 되찾는다. 판에 한 번. 그 뒤 도읍의 집이 riseHH 만큼 준다
 * (「押督叛 發兵討平之 徙其餘衆於南地」 — 게임에서는 들고일어난 쪽이 이기는 갈래를 연다)
 */
function stepRise(r: Realm, lines: ReportLine[]): void {
  const R = P.realm
  for (const f of holders(r, 'ireoseom')) {
    const st = r.rise?.[f]
    if (st === 'done') continue
    const cap = r.factions[f]!.capital
    const node = r.nodes[cap]
    if (node === undefined) continue
    if (node.owner === f) {
      if (st !== undefined) delete r.rise![f]
      continue
    }
    if (st === undefined) {
      (r.rise ??= {})[f] = r.season
      continue
    }
    const since = r.season - st
    if (since > R.riseWindow) {
      r.rise![f] = 'done' // 불씨가 꺼졌다
      continue
    }
    if (since < R.riseWait || node.owner === null) continue
    const holder = node.owner
    const here = Object.values(r.armies).filter((a) => a.at === cap && a.march === null && a.faction === holder)
    const guard = here.reduce((s, a) => s + menIn(a), 0)
    if (guard >= node.hh * R.militiaPerHH * R.riseGuard) continue
    // 들고일어난다 — 남은 지킴이는 흩어지고, 도읍이 돌아온다
    for (const a of here) {
      if (a.hero !== null && r.heroes[a.hero] !== undefined) r.heroes[a.hero]!.at = null
      delete r.armies[a.id]
    }
    const men = Math.round(node.hh * R.riseMen)
    node.owner = f
    node.takenAt = r.season
    node.hh = Math.max(0, Math.round(node.hh * (1 - R.riseHH)))
    node.sown = Math.min(node.sown, node.hh)
    if (men > 0) {
      let i = 1
      while (r.armies[`a-${f}-rise-${r.season}-${i}`] !== undefined) i++
      const id = `a-${f}-rise-${r.season}-${i}`
      r.armies[id] = { id, faction: f, hero: null, mix: { spear: men }, equip: 'stone', morale: 1, at: cap, march: null }
    }
    r.rise![f] = 'done'
    if (relationOf(r, f, holder).state !== 'war') declareWar(r, f, holder, lines, 'attack')
    for (const known of Object.values(r.intel)) {
      const k = known[cap]
      if (k !== undefined) k.force = null
    }
    lines.push({ kind: 'take', faction: f, node: cap })
    noteCustom(r, lines, f, 'ireoseom', { node: cap, other: holder, n: men })
  }
}

/**
 * 말 장례(마한) — 가을마다 곡식(소)과 가진 말을 장례에 바쳐 크게 묻는다. 군주 말고 우리 장수마다 정이 오른다
 * (「牛馬盡於送死」 — 소와 말은 장례에 다 쓴다). 곡식이 모자라면 그해는 거른다
 */
function stepFuneral(r: Realm, lines: ReportLine[]): void {
  const R = P.realm
  if (seasonOf(r.season) !== 'autumn') return
  for (const f of holders(r, 'maljangrye')) {
    const s = stockOf(r, f)
    if (s.grain < R.maljangGrain) continue
    const horses = Math.max(0, Math.floor(goodOf(s, 'horse')))
    s.grain -= R.maljangGrain
    if (horses > 0) addGood(r, f, 'horse', -horses)
    const d = R.maljangBond + Math.min(R.maljangBond, horses * R.maljangHorseBond)
    const heroes = Object.values(r.heroes).filter((h) => h.faction === f && h.status === 'free').sort((a, b) => (a.id < b.id ? -1 : 1))
    for (const h of heroes) addBond(r, h, d, lines)
    noteCustom(r, lines, f, 'maljangrye', { n: horses, m: Math.round(d) })
  }
}

/** 쇠 실은 배(가락) — 가을에 포구가 있으면 soebaeKeep 을 넘는 쇠를 soebaeMax 까지 배에 실어 곡식으로 바꾼다 */
function stepIronShip(r: Realm, lines: ReportLine[]): void {
  const R = P.realm
  if (seasonOf(r.season) !== 'autumn') return
  for (const f of holders(r, 'soebae')) {
    const port = Object.values(r.nodes).filter((n) => n.owner === f && n.kind === 'port').sort((a, b) => (a.id < b.id ? -1 : 1))[0]
    if (port === undefined) continue
    const s = stockOf(r, f)
    const x = Math.min(R.soebaeMax, Math.floor(s.iron - R.soebaeKeep))
    if (x <= 0) continue
    const grain = Math.round(x * R.soebaePrice)
    s.iron -= x
    s.grain += grain
    noteCustom(r, lines, f, 'soebae', { node: port.id, n: x, m: grain })
  }
}

/** 말 치는 들(땅) — 그 나라 고을과 맞닿은(또는 쥔) 목장 땅이 남의 것이 아니면, 겨울 빼고 계절마다 말이 들고 먹이 곡식이 든다 */
function stepPasture(r: Realm, lines: ReportLine[]): void {
  const R = P.realm
  if (seasonOf(r.season) === 'winter') return
  for (const f of holders(r, 'landPasture')) {
    const field = pastureFor(r, f)
    if (field === null) continue
    const s = stockOf(r, f)
    if (s.grain < R.landPastureGrain) continue
    s.grain -= R.landPastureGrain
    addGood(r, f, 'horse', R.landPastureHorse)
    noteOnce(r, lines, f, 'landPasture', { node: field, n: R.landPastureHorse, m: R.landPastureGrain }) // 계절마다 드는 것은 처음 한 번만 적는다 (지도 표가 늘 말한다)
  }
}

/** 그 나라가 말을 치는 목장 땅 — 쥐었거나, 제 고을과 맞닿고 주인이 없는 목장. 없으면 null */
export function pastureFor(r: Realm, faction: string): string | null {
  const mine = Object.values(r.nodes).filter((n) => n.owner === faction).map((n) => n.id).sort()
  for (const id of mine) if (r.nodes[id]!.tags.includes('pasture')) return id
  for (const id of mine) {
    for (const nb of nextTo(r, id)) {
      const n = r.nodes[nb]
      if (n !== undefined && n.tags.includes('pasture') && (n.owner === null || n.owner === faction)) return nb
    }
  }
  return null
}

/** 소도 곁(땅) — 봄이 끝날 때까지 봄 제사를 안 지냈으면 그해 가을걷이가 준다 (소도와 맞닿은 고을이 있을 때만) */
function stepSodoSkip(r: Realm, lines: ReportLine[]): void {
  if (seasonOf(r.season) !== 'spring') return
  const year = Math.floor(r.season / 4)
  for (const f of holders(r, 'landSodo')) {
    const near = sodoNeighbors(r, f)
    if (near.length === 0 || r.blessed?.[f] === year) continue
    const mul = harvestModOf(r, f) * P.realm.landSodoSkip
    ;(r.harvestMod ??= {})[f] = { year, mul }
    noteCustom(r, lines, f, 'landSodo', { node: near[0]!, n: 0 })
  }
}

// ───────── 지도 표 (규칙은 지도에 보이게 — GAP §11)

export interface CustomMark {
  readonly id: CustomId
  /** 고을 이름표 옆의 짧은 글 (두세 낱말) */
  readonly label: string
  /** 누르면 뜨는 말 */
  readonly tip: string
  /** 지금 막 걸려 있다 (빛나게) */
  readonly hot?: boolean
}

/**
 * 그 고을에 지금 걸린 풍습 — 보는 나라(viewer)의 것만, 다시 일어날 불씨는 누구의 것이든 (빼앗은 쪽이 알아야 한다).
 * 규칙이 걸릴 때만 뜬다: 여름의 갈대 · 봄의 소도 · 쌓인 덩이쇠 · 가을의 쇠배.
 */
export function customMarks(r: Realm, nodeId: string, viewer: string): CustomMark[] {
  const n = r.nodes[nodeId]
  if (n === undefined) return []
  const out: CustomMark[] = []
  const season = seasonOf(r.season)
  // 다시 일어날 불씨 — 빼앗긴 도읍 (누구에게나)
  for (const f of holders(r, 'ireoseom')) {
    if (r.factions[f]?.capital !== nodeId) continue
    const st = riseState(r, f)
    if (st === null) continue
    const who = r.factions[f]?.name ?? ''
    out.push({ id: 'ireoseom', label: '불씨', tip: `${who} 사람들이 숨죽이고 있다. 도읍을 비워 두면 들고일어난다`, hot: r.season >= st.from })
  }
  const owner = n.owner
  if (owner !== viewer || owner === null) return out
  const has = (id: CustomId): boolean => hasCustom(r, owner, id)
  const cap = r.factions[owner]?.capital === nodeId
  // 책화 — 남의 땅과 맞닿은 우리 고을 (경계): 들어온 적은 물어내야 한다
  if (has('chaekhwa') && nextTo(r, nodeId).some((x) => { const o = r.nodes[x]?.owner; return o != null && o !== owner && r.nodes[x]?.kind !== 'sodo' })) out.push({ id: 'chaekhwa', label: '책화', tip: '경계: 이리로 쳐들어온 적은 물어내야 해서 첫 합에 기세가 꺾인다' })
  if (cap && has('maljangrye')) out.push({ id: 'maljangrye', label: '말 장례', tip: '가을마다 소·말을 장례에 바쳐 장수들의 정이 오른다 · 기병은 못 뽑는다', hot: season === 'autumn' })
  if (n.kind === 'ironMine' && has('dalcheon')) out.push({ id: 'dalcheon', label: '쇠 곱', tip: `${customDef('dalcheon').name}: 쇠가 곱으로 난다 · 여기서는 군사를 못 뽑는다` })
  if (n.kind === 'ironMine' && has('landIron')) out.push({ id: 'landIron', label: '쇠 다루기', tip: '무장을 올리는 데 쇠가 적게 든다. 이웃이 이 철광을 노린다' })
  if (cap && has('sonoe')) out.push({ id: 'sonoe', label: `쇠뇌 ${framesOf(r, owner)}틀`, tip: '쇠뇌 틀: 틀마다 쇠뇌병을 세운다 · 방패를 뚫는다' })
  if (cap && has('deongisoe') && goodOf(stockOf(r, owner), 'iron') >= P.realm.deongiCovet) out.push({ id: 'deongisoe', label: '덩이쇠', tip: '쇠가 쌓였다: 곡식 대신 쇠로 징병값을 낼 수 있고, 이웃이 탐낸다', hot: true })
  if (n.kind === 'port' && has('soebae') && season === 'autumn') out.push({ id: 'soebae', label: '쇠배', tip: '가을: 남는 쇠를 배에 실어 곡식을 사 온다', hot: true })
  if (n.kind === 'port' && has('landPort')) out.push({ id: 'landPort', label: '뱃길', tip: '바닷길로 가는 기습이 잘 숨고, 수군을 나무 반만 들여 뽑는다 · 사내들이 바다에 나가 이 포구의 장정이 적다' })
  const edges = Object.values(r.edges).filter((e) => e.a === nodeId || e.b === nodeId)
  if (has('landReeds') && (n.tags.includes('reeds') || n.tags.includes('shallows') || edges.some((e) => e.kind === 'reeds' || e.kind === 'ford'))) {
    out.push(season === 'summer'
      ? { id: 'landReeds', label: '큰물', tip: '여름: 물이 불어 강가 고을의 집이 조금 준다 · 갈대·나루 길 기습은 잘 숨는다', hot: true }
      : { id: 'landReeds', label: '갈대밭', tip: '갈대·나루 길로 가는 기습이 잘 숨는다' })
  }
  if (has('landHigh') && (n.tags.includes('high') || n.kind === 'fort' || edges.some((e) => e.kind === 'pass'))) out.push({ id: 'landHigh', label: '고갯목', tip: '고갯길·높은 터로 쳐들어온 적은 첫 합에 사기가 깎인다 · 우리도 고갯길은 한 계절 더' })
  if (has('landSodo') && sodoNeighbors(r, owner).includes(nodeId)) {
    out.push(season === 'spring' && r.blessed?.[owner] !== Math.floor(r.season / 4)
      ? { id: 'landSodo', label: '제사 때', tip: '봄 제사를 거르면 그해 가을걷이가 준다 · 제사는 반값', hot: true }
      : { id: 'landSodo', label: '소도 곁', tip: '소도 제사가 반값이다' })
  }
  if (has('landPasture') && pastureFor(r, owner) !== null && nextTo(r, nodeId).includes(pastureFor(r, owner)!)) out.push({ id: 'landPasture', label: '말 치는 들', tip: '곁의 너른 들에서 말을 친다. 계절마다 말이 들고 먹이 곡식이 든다' })
  return out
}
