/**
 * 폰 폭 확인용 판 — 변한 작은 판을 한 계절 돌려 보고까지 만든 뒤, 이번 계절 카드를 바꿔 끼운다 (tools/phone-shot.ts 와 함께).
 *   node --experimental-strip-types tools/phone-save.ts <나갈 json> <카드: quarrel-town|quarrel-feast|romance|exile|fugitive|none|captive|woo> [시드]
 *   captive — 카드 없이 적장 하나를 우리 옥에 (회유 화면) · woo — 그 적장을 이미 달래는 중 (진행 줄) · woo0 — 벽이 막 무너졌다 (담판이 저절로 뜬다)
 *   lost — 카드 없이, 이번 보고에 우리가 쳐서 진 싸움 한 판 (적이 셋 배 · 온 쇠 · 깃발에 밀림 · 정찰 없음) — 보고를 닫으면 「이기는 법」 띠 (howwin.ts)
 */
import { writeFileSync } from 'node:fs'
import { startRegion } from '../src/realm/data/regions/index.ts'
import { HERO_POOL } from '../src/realm/data/heroes-pool.ts'
import { advance } from '../src/realm/season.ts'
import { festCard } from '../src/realm/festival.ts'
import type { Card, ReportLine } from '../src/realm/types.ts'

const out = process.argv[2]!
const kind = process.argv[3] ?? 'quarrel-town'
const seed = Number(process.argv[4] ?? 7)
const r0 = startRegion((process.env.REGION ?? 'byeonhan-mini') as Parameters<typeof startRegion>[0], seed, process.env.NATION ?? 'us')
// ADV=n — 그만큼 더 넘긴 판 (달 시계에서 계절 끝 달을 찍을 때)
let r1 = r0
for (let i = 0; i < Number(process.env.ADV ?? 0); i++) r1 = advance(r1, []).next
const { next, report } = advance(r1, [])
const ours = Object.values(next.heroes).filter((h) => h.faction === next.player && h.status === 'free')
// 장수가 모자라면 남의 장수를 데려와 둘을 맞춘다 (남녀 하나씩)
for (const look of ['g', 'w'] as const) {
  if (ours.some((h) => h.look === look && !h.id.endsWith('-ruler'))) continue
  const x = Object.values(next.heroes).find((h) => h.faction !== next.player && h.look === look && !h.id.endsWith('-ruler'))
  if (x !== undefined) { x.faction = next.player; x.at = next.factions[next.player]!.capital; for (const a of Object.values(next.armies)) if (a.hero === x.id) a.hero = null; ours.push(x) }
}
const g = ours.find((h) => h.look === 'g' && !h.id.endsWith('-ruler'))!
const w = ours.find((h) => h.look === 'w' && !h.id.endsWith('-ruler'))!
const other = Object.keys(next.factions).find((f) => f !== next.player)!
const town = Object.values(next.nodes).find((n) => n.owner === next.player && n.id !== next.factions[next.player]!.capital)?.id
const cards: Record<string, Card | null> = {
  'quarrel-town': { kind: 'quarrel', season: next.season, hero: g.id, hero2: w.id, why: 'town', ...(town !== undefined ? { node: town } : {}) },
  'quarrel-feast': { kind: 'quarrel', season: next.season, hero: g.id, hero2: w.id, why: 'feast' },
  romance: { kind: 'romance', season: next.season, hero: g.id, hero2: w.id },
  exile: { kind: 'exile', season: next.season, guest: HERO_POOL[3]!.id, from: other },
  fugitive: { kind: 'fugitive', season: next.season, from: other },
  none: null,
}
next.card = cards[kind] ?? null
// 옥에 가둔 적장 — 회유 화면을 찍는다 (docs/realm/WOO.md). 고를 장수가 넉넉하게 남의 장수 넷을 더 데려온다
if (kind === 'captive' || kind === 'woo' || kind === 'woo0') {
  const foes = Object.values(next.heroes).filter((h) => h.faction !== next.player && h.status === 'free' && !h.id.endsWith('-ruler')).sort((a, b) => (a.id < b.id ? -1 : 1))
  const cap = (kind === 'woo0' ? foes.find((h) => !h.traits.includes('steadfast')) : undefined) ?? foes[0]!
  for (const x of foes.filter((h) => h !== cap).slice(0, 4)) { x.faction = next.player; x.at = next.factions[next.player]!.capital; for (const a of Object.values(next.armies)) if (a.hero === x.id) a.hero = null }
  cap.status = 'captive'
  cap.captor = next.player
  cap.at = null
  cap.post = null
  cap.caughtAt = next.season - 1
  for (const a of Object.values(next.armies)) if (a.hero === cap.id) a.hero = null
  if (kind === 'woo') cap.persuade = { by: g.id, left: 4, resist: 3.2, tries: 0, since: next.season - 2, talkAt: next.season - 2 }
  if (kind === 'woo0') cap.persuade = { by: g.id, left: 2, resist: 0, tries: 0, since: next.season - 4, talkAt: next.season - 4 }
  next.stock[next.player]!.grain = Math.max(next.stock[next.player]!.grain, 300)
}
// 진 싸움 — 우리 군대 하나가 이웃 나라 고을을 쳤다가 졌다 (보고에 한 줄 · 적 군대는 쇠로)
if (kind === 'lost') {
  const ours = Object.values(r0.armies).find((a) => a.faction === r0.player)!
  const foeArmy = Object.values(r0.armies).find((a) => a.faction !== r0.player && a.march === null)!
  foeArmy.equip = 'iron'
  delete foeArmy.kit
  const R = (a: 'a' | 'd' | null, c1: string, c2: string): unknown => ({ a: c1, d: c2, beat: a, push: 0.3, na: 0, nd: 0, ma: 0, md: 0 })
  ;(report.lines as ReportLine[]).push({
    kind: 'battle', node: foeArmy.at, attacker: ours.id, allies: [], pincer: false, defender: foeArmy.faction, ambush: 'none', p: 0.3, outcome: 'lose',
    captured: null, killed: null, militia: 0, atkFaction: r0.player,
    start: { men: [80, 240], morale: [1, 1.2], heroes: [null, null] },
    rounds: [R('d', 'charge', 'hold'), R('a', 'hold', 'charge'), R('d', 'open', 'charge'), R('d', 'charge', 'hold')],
  } as unknown as ReportLine)
}
// 협공 — 우리 군대 둘이 같은 남의 고을에 같은 턴에 닿을 수 있게: 남의 고을 곁 우리 고을 둘에 군대를 하나씩 세운다 (형 11-05 협공 반짝임 확인)
if (kind === 'pincer') {
  const mine = new Set(Object.values(next.nodes).filter((n) => n.owner === next.player).map((n) => n.id))
  const nb = (id: string): string[] => Object.values(next.edges).flatMap((e) => (e.a === id ? [e.b] : e.b === id ? [e.a] : []))
  const foe = Object.values(next.nodes).filter((n) => n.owner !== null && n.owner !== next.player && n.kind !== 'sodo').sort((a, b) => (a.id < b.id ? -1 : 1))
  const base = Object.values(next.armies).find((a) => a.faction === next.player)!
  for (const f of foe) {
    const near = nb(f.id).filter((x) => x !== f.id)
    if (near.length < 2) continue
    // 남의 고을 곁 두 자리 — 우리 땅으로 바꿔 두고 군대를 하나씩
    const [p, q] = near.slice(0, 2) as [string, string]
    for (const x of [p, q]) { next.nodes[x]!.owner = next.player; mine.add(x) }
    base.at = p
    base.march = null
    const half = Object.fromEntries(Object.entries(base.mix).map(([k, n]) => [k, Math.floor((n as number) / 2)]))
    for (const [k, n] of Object.entries(half)) (base.mix as Record<string, number>)[k] = (base.mix as Record<string, number>)[k]! - (n as number)
    next.armies['pin-2'] = { ...base, id: 'pin-2', at: q, hero: null, mix: half }
    console.log('pincer', f.name, '<-', next.nodes[p]!.name, next.nodes[q]!.name)
    break
  }
}
// 마을 안 — 도읍에 선 일터 둘(논 2단 · 장정 마을 1단)과 짓는 중인 장터 하나, 곳간은 넉넉히 (townview 폰 폭 확인 · 11-08)
//   TOWN=done — 지난 달 막 완공된 것으로 (보고 줄을 남긴다 · 「완공!」 도장을 찍는다)
if (kind === 'town') {
  const cap = next.factions[next.player]!.capital
  const n = next.nodes[cap]!
  next.nodes[cap] = { ...n, lots: { paddy: 2, yard: 1 } }
  const mode = process.env.TOWN ?? 'build' // build — 장터 짓는 중 · idle — 아무것도 안 짓는 중(빈 터 타일) · done — 지난 달 논 2단 완공(보고 줄 · 도장)
  if (mode === 'build') next.works = [{ faction: next.player, node: cap, what: 'market', done: next.season + 1 }]
  if (mode === 'done') (report.lines as ReportLine[]).push({ kind: 'work', faction: next.player, node: cap, what: 'paddy', done: true, lv: 2 })
  const st = next.stock[next.player]!
  st.grain = Math.max(st.grain, 400); st.wood = Math.max(st.wood ?? 0, 60); st.iron = Math.max(st.iron, 40); st.salt = Math.max(st.salt ?? 0, 40)
  console.log('town', cap)
}
// 곳간을 부을 곳 (wonders.ts · 위원회 11-08 ⑦) — 도읍을 키워 큰 공사가 열린 판: 우리가 솟대 숲 2단 · 구야가 큰 쇠부리 가마 짓는 중 · 고인돌 큰 무덤은 남이 다 지음 · 곳간 넉넉
//   GREAT=done — 지난 달 솟대 숲이 섰고 큰 잔치에 손님이 왔다 (보고 줄 · 획득 팝)
if (kind === 'great') {
  const cap = next.factions[next.player]!.capital
  next.nodes[cap]!.hh = 9000
  const other2 = Object.keys(next.factions).filter((f) => f !== next.player)
  const st = next.stock[next.player]!
  st.grain = 30000; st.wood = 900; st.iron = 600
  if (process.env.GREAT === 'done') {
    next.nodes[cap] = { ...next.nodes[cap]!, wonder: 'sotdae' }
    ;(report.lines as ReportLine[]).push({ kind: 'wonder', faction: next.player, what: 'sotdae', node: cap, ev: 'done', stage: 4 })
    ;(report.lines as ReportLine[]).push({ kind: 'feast', faction: next.player, grain: 9000, got: 'guest', who: HERO_POOL[0]!.id, p: 0.35 })
  } else next.wonderWorks = [{ faction: next.player, node: cap, what: 'sotdae', stage: process.env.GREAT === 'next' ? 3 : 2, ...(process.env.GREAT === 'next' ? { busy: next.season } : {}), poured: { grain: 4000, good: 100 } }] // GREAT=next — 이번 달 끝에 다 선다 (다음 달을 누르면 획득 팝)
  if (next.known?.[next.player] !== undefined && !next.known[next.player]!.includes(other2[0]!)) next.known[next.player]!.push(other2[0]!) // 짓는 나라를 알아야 범위가 보인다
  next.wonderWorks = [...(next.wonderWorks ?? []), { faction: other2[0]!, node: next.factions[other2[0]!]!.capital, what: 'furnace', stage: 1, busy: next.season + 1, poured: { grain: 900, good: 30 } }]
  const o2 = next.factions[other2[1]!]!.capital
  next.nodes[o2] = { ...next.nodes[o2]!, wonder: 'dolmen' }
  console.log('great', cap)
}
// 도읍 궁궐·조정 (palace.ts · CAPITAL §2) — PALACE=1 처음(1단) · 2 큰 마루 집 + 재상 앉음 · build 3단 쌓는 중(비계) · 4 토성 궁성 + 세 자리 + 대신 뽑기 · done 지난 달 막 3단 완공(보고 줄 · 도장)
if (kind === 'palace') {
  const cap = next.factions[next.player]!.capital
  next.nodes[cap]!.hh = 9000
  const st = next.stock[next.player]!
  st.grain = 60000; st.wood = 3000; st.iron = 2000
  const fac = next.factions[next.player]!
  const mode = process.env.PALACE ?? '2'
  const mine = Object.values(next.heroes).filter((h) => h.faction === next.player && h.status === 'free' && h.id !== fac.ruler && !Object.values(next.armies).some((a) => a.hero === h.id))
  // 앉힐 장수가 넉넉하게 남의 장수를 데려온다
  const foes = Object.values(next.heroes).filter((h) => h.faction !== next.player && h.status === 'free' && !h.id.endsWith('-ruler')).sort((a, b) => (a.id < b.id ? -1 : 1))
  for (const x of foes.slice(0, 6)) { x.faction = next.player; x.at = cap; for (const a of Object.values(next.armies)) if (a.hero === x.id) a.hero = null; mine.push(x) }
  const tier = mode === '4' ? 4 : mode === 'build' || mode === 'done' ? 3 : mode === '2' ? 2 : 1
  if (tier > 1 || mode === 'build') fac.palace = { tier: tier as 1 | 2 | 3 | 4, stage: mode === 'build' ? 2 : 0, ...(mode === 'build' ? { busy: next.season + 1 } : {}) }
  if (tier === 4) next.nodes[cap] = { ...next.nodes[cap]!, walled: true }
  const pick = [...mine].sort((a, b) => (a.id < b.id ? -1 : 1))
  if (tier >= 2) fac.seats = { chancellor: pick[0]!.id }
  if (tier === 4) { fac.seats = { chancellor: pick[0]!.id, general: pick[1]!.id, priest: pick[2]!.id }; fac.autoDraft = true }
  if (mode === 'done') (report.lines as ReportLine[]).push({ kind: 'palace', faction: next.player, ev: 'done', tier: 3, stage: 0 })
  console.log('palace', mode, cap, pick.map((h) => h.id).join(','))
}
// 제천 대회 (festival.ts · CAPITAL §1-3) — 궁궐 3단 + 천군 앉음 · FEST=card 카드 화면(보고에서) · now 도읍 판의 금빛 띠(카드가 떠 있다) · soon 「다음 제천 대회: N달 뒤」 띠 (ADV=1 로 시월이 되게 · soon 은 ADV 없이)
if (kind === 'fest') {
  const cap = next.factions[next.player]!.capital
  next.nodes[cap]!.hh = 9000
  const st = next.stock[next.player]!
  st.grain = 60000; st.wood = 3000; st.iron = 2000
  const fac = next.factions[next.player]!
  fac.palace = { tier: 3, stage: 0 }
  const foes = Object.values(next.heroes).filter((h) => h.faction !== next.player && h.status === 'free' && !h.id.endsWith('-ruler')).sort((a, b) => (a.id < b.id ? -1 : 1))
  const mine = Object.values(next.heroes).filter((h) => h.faction === next.player && h.status === 'free' && h.id !== fac.ruler && !Object.values(next.armies).some((a) => a.hero === h.id))
  if (mine.length < 2) for (const x of foes.slice(0, 2)) { x.faction = next.player; x.at = cap; for (const a of Object.values(next.armies)) if (a.hero === x.id) a.hero = null; mine.push(x) }
  mine.sort((a, b) => (a.id < b.id ? -1 : 1))
  fac.seats = { priest: mine[mine.length - 1]!.id }
  mine[mine.length - 1]!.deok = 8
  const mode = process.env.FEST ?? 'card'
  if (mode !== 'soon') next.card = festCard(next, next.player, next.season)
  console.log('fest', mode, next.season, next.card?.hero, next.card?.hero2, next.card?.guest)
}
const quiet = kind === 'fest' && process.env.FEST !== 'card' || kind === 'captive' || kind === 'woo' || kind === 'woo0' || kind === 'pincer' || (kind === 'town' && process.env.TOWN !== 'done') || (kind === 'great' && process.env.GREAT !== 'done') || (kind === 'palace' && process.env.PALACE !== 'done') // 보고 없이 판 위에서 연다
writeFileSync(out, JSON.stringify({ v: 2, nation: process.env.NATION ?? 'us', seed, log: [], realm: next, before: quiet ? null : r0, report: quiet ? null : report }))
console.log('ok', kind, g.name, w.name)
