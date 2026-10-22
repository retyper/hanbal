/**
 * 옛 판을 지금 판으로 — 사람의 눈금 (형: "가구수랑 징병량이 초반이라서 적은건가? 실제로 이시대에 이수준이었나?" — 2026-10-18)
 *
 * 위서 동이전: 변진 큰 나라 4~5천 가, 작은 나라 6~7백 가. 옛 판은 도읍 300~750 집 · 군대 100~200 명이었다.
 * 지금 판은 사람(가호·빈땅의 품·군사·장정)을 PEOPLE_SCALE 배로 센다 — 큰 나라 3~5천 집, 군대 수백 명.
 * 곡식·철 같은 물건의 셈은 그대로다: 한 사람당 드는 곡식·철(수확·군량·채비·무장)을 같은 배로 나눴다 (params "사람 눈금 ×4").
 * 그래서 판의 흐름(누가 이기나)은 옛 판과 같고, 숫자만 사료에 가까워졌다.
 *
 * 옛 저장(scale 없음 = 1)은 판을 넘기거나 먼저 해 볼 때(season.advance · planned) 한 번 키운다.
 */
import { initialKnown } from './discovery.ts'
import { scaleMen } from './kit.ts'
import type { Realm } from './types.ts'

/** 지금 판의 사람 눈금 — 옛 판의 몇 배인가 */
export const PEOPLE_SCALE = 4

/**
 * 옛 이름 → 우리 역사책의 이름 (형: "가장 중요한 건 한국사 기록이야" — 2026-10-18). 저장된 판의 나라·도읍 이름도 바꾼다.
 * 세력 id(guya 등)는 그대로라 판의 셈은 같다.
 */
const RENAME: Readonly<Record<string, string>> = {
  갯마을: '골포국', 구야국: '가락국', 안야국: '아라국', 미리미동국: '추화국', 고자미동국: '고자국', 독로국: '거칠산국',
  '갯마을 도읍': '골포 도읍', '구야 도읍': '가락 도읍', '안야 도읍': '아라 도읍', '미리미동 도읍': '추화 도읍', '고자미동 도읍': '고자 도읍', '독로 도읍': '거칠산 도읍',
}

function rename(r: Realm): void {
  for (const f of Object.values(r.factions)) {
    const to = RENAME[f.name]
    if (to !== undefined) (f as { name: string }).name = to
  }
  for (const id of Object.keys(r.nodes)) {
    const n = r.nodes[id]!
    const to = RENAME[n.name]
    if (to !== undefined) r.nodes[id] = { ...n, name: to }
  }
}

/** 옛 판이면 사람을 키운다 (제자리에서 바꾼다). 이미 지금 눈금이면 아무 일도 없다. 옛 이름은 늘 고친다 */
export function migrate(r: Realm): void {
  rename(r)
  // 활 쏘는 장군의 이름이 '신궁'이던 옛 판 (형: "군장이 신궁이다는 설명 너무 짜치는디")
  const chief = r.heroes['chief']
  if (chief !== undefined && chief.name === '신궁') (chief as { name: string }).name = '살해 매눈'
  // 특성이 생기기 전의 판 — 장수마다 빈 특성 줄을 채운다 (없으면 정이 100에 닿는 계절에 막혔다)
  for (const h of Object.values(r.heroes)) if (!Array.isArray(h.traits)) (h as { traits: readonly string[] }).traits = []
  for (const w of r.wanderers ?? []) if (!Array.isArray(w.hero.traits)) (w.hero as { traits: readonly string[] }).traits = []
  // 발견이 없던 영남 판 — 이웃과, 이미 사이가 생긴(사신·싸움·약조) 나라만 아는 것으로 (형: "시작할땐 주변 밝혀진애들만")
  if (r.region === 'yeongnam' && r.known === undefined) {
    const k = initialKnown(r)
    for (const key of Object.keys(r.relations ?? {})) {
      const [a, b] = key.split('|')
      if (a === undefined || b === undefined || r.factions[a] === undefined || r.factions[b] === undefined) continue
      if (!k[a]!.includes(b)) k[a]!.push(b)
      if (!k[b]!.includes(a)) k[b]!.push(a)
    }
    for (const x of Object.values(k)) x.sort()
    r.known = k
  }
  const s = r.scale ?? 1
  if (s === PEOPLE_SCALE || !(s > 0)) return
  const f = PEOPLE_SCALE / s
  const up = (x: number): number => Math.round(x * f)
  for (const id of Object.keys(r.nodes).sort()) {
    const n = r.nodes[id]!
    r.nodes[id] = { ...n, hh: up(n.hh), sown: up(n.sown), ...(n.room !== undefined ? { room: up(n.room) } : {}) }
  }
  for (const a of Object.values(r.armies)) scaleMen(a, f)
  for (const known of Object.values(r.intel)) {
    for (const k of Object.values(known)) if (k.force && Number.isFinite(k.force.f0)) k.force = { ...k.force, f0: k.force.f0 * f }
  }
  r.scale = PEOPLE_SCALE
}

/**
 * 옛 배우는 판(골포·가락 — 변한 지도를 빌린 판) → 한강 아래 백제·미추홀 (2026-10-22, data/regions/tutorial.ts).
 * 판의 id 를 새 판 것으로 바꾸고 이름·생김(그림이 붙는 것)은 새 판에서 가져온다. 하던 판은 그 자리 그대로 잇는다.
 * 'sodo' 는 꼴(kind)·표(tag) 값과 글자가 같아 통째 바꾸기에서 빼고 따로 옮긴다.
 */
const OLD_TUT_ID: Readonly<Record<string, string>> = {
  'our-cap': 'tut-wirye-cap', 'our-north': 'tut-acha', 'our-east': 'tut-galdae', 'wild-dolseom': 'tut-solmoe', 'guya-vil': 'tut-gaetgol', 'guya-cap': 'tut-michuhol-cap',
  'us-ruler': 'tut-onjo', chief: 'tut-ogan', 'us-1': 'tut-maryeo', 'guya-ruler': 'tut-biryu', 'guya-3': 'tut-haebi', us: 'baekje', guya: 'michuhol',
}
export function isOldTutorial(r: Realm | null | undefined): boolean {
  return r?.region === 'tutorial' && r.nodes['our-cap'] !== undefined
}
/** 판 밖의 것(보고 등)도 같은 id 로 — JSON 으로 받아 JSON 으로 돌려준다 */
export function remapOldTutorialJson<T>(v: T): T {
  let j = JSON.stringify(v)
  for (const [a, b] of Object.entries(OLD_TUT_ID)) j = j.replaceAll(`"${a}"`, `"${b}"`)
  return JSON.parse(j) as T
}
export function remapOldTutorial(r: Realm, fresh: Realm): Realm {
  if (!isOldTutorial(r)) return r
  const x = remapOldTutorialJson(r) as Realm & { nodes: Record<string, Realm['nodes'][string]>; edges: Record<string, Realm['edges'][string]> }
  // 소도 — 고을 열쇠 · 길 끝 · 앎 · 지켜봄
  if (x.nodes['sodo'] !== undefined) { x.nodes['tut-sodo'] = { ...x.nodes['sodo']!, id: 'tut-sodo' }; delete x.nodes['sodo'] }
  for (const [id, e] of Object.entries(x.edges)) x.edges[id] = { ...e, a: e.a === 'sodo' ? 'tut-sodo' : e.a, b: e.b === 'sodo' ? 'tut-sodo' : e.b, kind: fresh.edges[id]?.kind ?? e.kind }
  for (const k of Object.values(x.intel)) if (k['sodo'] !== undefined) { k['tut-sodo'] = k['sodo']!; delete k['sodo'] }
  if (x.watch['sodo'] !== undefined) { x.watch['tut-sodo'] = x.watch['sodo']!; delete x.watch['sodo'] }
  for (const id of Object.keys(x.nodes)) { const n = fresh.nodes[id]; if (n !== undefined) x.nodes[id] = { ...x.nodes[id]!, name: n.name } }
  for (const id of Object.keys(x.heroes)) { const h = fresh.heroes[id]; if (h !== undefined) x.heroes[id] = { ...x.heroes[id]!, name: h.name, look: h.look } }
  for (const id of Object.keys(x.factions)) { const f = fresh.factions[id]; if (f !== undefined) x.factions[id] = { ...x.factions[id]!, name: f.name } }
  return x
}
