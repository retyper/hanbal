/**
 * 단련터 — 판과 판 사이의 화톳불 (docs/realm/HERO-GROWTH.md ★ 둘째 판 §A · §C · 셈은 src/realm/drill.ts).
 *
 *   판이 끝나면(이기든 지든) 끝 화면이 이번 판의 공을 새기고(engraveRun), 「단련터」로 들어가 장수마다 공을 써 능력치를 하나씩 올린다.
 *   첫 화면의 「단련터」로도 들어온다 — 남은 공은 아무 때나 쓴다.
 *   장수는 얼굴 링으로 고른다 (hero-ring.ts · 58-B) — 고리 위에 필터 · 정렬, 고르면 고리 자리에 그 장수의 능력 · 유물 판을 편다.
 *   큰 초상은 고를 때도 펼쳤을 때도 같은 자리라 PC 에서 이마 · 눈썹이 잘리지 않는다 (형 11-20 HANDOFF A14).
 * 기록은 이 기기에만 (`hanbal.realm.drill` · 영웅전·해금처럼). 못 읽으면 빈 기록 — 지우지는 않는다.
 */
import { bustOf, forgetDrillFaces, noteDrillFaces, savedKidBust } from '../../realm/data/art.ts'
import { STAT_NAME } from '../../realm/data/prose.ts'
import { GRADE_COLOR, GRADE_NAME, type TraitGrade } from '../../realm/data/traits.ts'
import { RELICS } from '../../realm/data/relics.ts'
import { t, type Key } from '../../i18n/index.ts'
import { ELEM, elemOf, type Elem } from './ascend.ts'
import { DRILL_STATS, applyDrill, capOf, emptyDrill, engrave, engraveVows, gainOf, raise, raiseState, spendCost, uiriWith, type DrillEntry, type DrillStore } from '../../realm/drill.ts'
import type { GrowStat, Hero, Realm, Vow } from '../../realm/types.ts'
import { P } from '../../tune/params.ts'
import { relicRoom, slotsFor } from '../../realm/relics.ts'
import { nameHtml, splitTitle } from './heroview.ts'
import { mountRing, ringCard, ringHtml, type RingHandle, type RingHero, type RingOpts, type RingText } from './hero-ring.ts'
import { t as tr } from '../../i18n/index.ts'
import { loadRelics, pickerHtml, relicChips, relicDexHtml, slotsHtml, wornBy, wornLv, type RelicKit } from './relics.ts'

const KEY = 'hanbal.realm.drill'

type DrillReadKV = Pick<Storage, 'getItem'>
const parsed = new WeakMap<DrillReadKV, Map<string, { raw: string | null; value: unknown }>>()
const recovered = new WeakMap<DrillReadKV, { raw: string | null; faces: Record<string, Partial<DrillEntry>> }>()
const obj = (x: unknown): x is Record<string, unknown> => x !== null && typeof x === 'object' && !Array.isArray(x)
const strings = (x: unknown): x is string[] => Array.isArray(x) && x.every(v => typeof v === 'string')
const childId = (id: string): boolean => id.startsWith('kid-') || id.startsWith('clan-')
function read(kv: DrillReadKV, key: string): { raw: string | null; value: unknown } {
  let raw: string | null
  try { raw = kv.getItem(key) } catch { return { raw: null, value: null } }
  let cache = parsed.get(kv)
  if (!cache) { cache = new Map(); parsed.set(kv, cache) }
  const was = cache.get(key)
  if (was?.raw === raw) return was
  let value: unknown = null
  try { value = JSON.parse(raw ?? 'null') } catch { /* malformed source remains untouched */ }
  const next = { raw, value }; cache.set(key, next); return next
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

/** 판 밖 단련 기록 — 깨졌거나 없으면 빈 기록 */
export function loadDrill(storage?: DrillReadKV): DrillStore {
  try {
    const kv = storage ?? localStorage
    const source = read(kv, KEY)
    const v = source.value as Partial<DrillStore> | null
    if (v === null || typeof v !== 'object' || typeof v.h !== 'object' || v.h === null) return emptyDrill()
    const h: Record<string, DrillEntry> = {}
    for (const [id, e] of Object.entries(v.h)) {
      if (e === null || typeof e !== 'object') continue
      const add: Partial<Record<GrowStat, number>> = {}
      for (const s of DRILL_STATS) { const n = Math.max(0, Math.floor(num(e.add?.[s]))); if (n > 0) add[s] = n }
      h[id] = {
        points: Math.max(0, Math.floor(num(e.points))), level: Object.values(add).reduce((a, b) => a + (b ?? 0), 0), add, runs: Math.max(0, Math.floor(num(e.runs))),
        ...(typeof e.lastSeed === 'number' ? { lastSeed: e.lastSeed } : {}),
        ...(typeof e.name === 'string' ? { name: e.name } : {}),
        ...(e.look === 'g' || e.look === 'w' ? { look: e.look } : {}),
        ...(strings(e.traits) ? { traits: [...e.traits] } : {}),
        ...(typeof e.bust === 'string' && savedKidBust(id, { ...(e.look !== undefined ? { look: e.look } : {}), bust: e.bust }) === e.bust ? { bust: e.bust } : {}),
        ...(e.born !== undefined && typeof e.born === 'object' ? { born: e.born } : {}),
        // 의리 — 판 밖에서 움직인 몫 · 까닭 · 새긴 판 (UIRI)
        ...(typeof e.uiri === 'number' && Number.isFinite(e.uiri) && e.uiri !== 0 ? { uiri: Math.round(e.uiri) } : {}),
        ...(Array.isArray(e.tales) ? { tales: e.tales.filter((x): x is Vow => x === 'hold' || x === 'rescue' || x === 'heart' || x === 'turned').slice(-6) } : {}),
        ...(typeof e.uiriSeed === 'number' ? { uiriSeed: e.uiriSeed } : {}),
      }
    }
    const proof = recovered.get(kv)
    if (proof?.raw === source.raw) for (const [id, face] of Object.entries(proof.faces)) {
      if (h[id] !== undefined) h[id] = { ...h[id], ...face }
    }
    noteDrillFaces(Object.entries(h).map(([id, e]) => ({ id, ...e })))
    const paid = typeof v.paid === 'object' && v.paid !== null ? v.paid : {}
    const order = Array.isArray(v.order) ? v.order.filter((x): x is string => typeof x === 'string') : Object.keys(paid)
    return { v: 1, h, paid, order }
  } catch {
    return emptyDrill()
  }
}

export interface DrillFaceReport {
  restored: string[]
  unknown: { id: string; reason: 'missing-seed' | 'not-found' | 'identity-mismatch' | 'ambiguous' }[]
  sources: { id: string; key: string }[]
}

/** Cold app entry hook. Only exact known save keys are read; no load/migrate/write/replay. */
export function hydrateDrillFaces(storage?: DrillReadKV): DrillFaceReport {
  const report: DrillFaceReport = { restored: [], unknown: [], sources: [] }
  let kv: DrillReadKV
  try { kv = storage ?? localStorage } catch { return report }
  forgetDrillFaces()
  recovered.delete(kv) // Revalidate source strings on every explicit entry hook.
  const store = loadDrill(kv), raw = read(kv, KEY).raw
  const faces: Record<string, Partial<DrillEntry>> = {}
  for (const [id, e] of Object.entries(store.h)) {
    if (!childId(id)) continue
    if (savedKidBust(id, e) !== undefined) { noteDrillFaces([{ id, ...e }]); report.restored.push(id); continue }
    const seed = e.lastSeed ?? e.uiriSeed
    if (seed === undefined || !Number.isFinite(seed)) { report.unknown.push({ id, reason: 'missing-seed' }); continue }
    const keys = ['hanbal.realm.v2', 'hanbal.realm.v2.prev', `hanbal.realm.slot.${seed}`,
      ...Array.from({ length: Math.min(100, Math.max(1, Math.round(P.realm.saveSlots))) }, (_, i) => `hanbal.realm.save.${i}`)]
    const found: { key: string; look: 'g' | 'w'; traits: string[]; bust: string }[] = []
    let mismatch = false
    const consider = (h: unknown, key: string) => {
      if (!obj(h)) return
      if (typeof h['id'] === 'string' && h['id'] !== id) { mismatch = true; return }
      if ((e.name !== undefined && h['name'] !== e.name) || (e.look !== undefined && h['look'] !== e.look)) { mismatch = true; return }
      if ((h['look'] !== 'g' && h['look'] !== 'w') || !strings(h['traits'])) return
      const look = h['look'], traits = [...h['traits']], bust = savedKidBust(id, { look, traits })
      if (bust !== undefined) found.push({ key, look, traits, bust })
    }
    for (const key of keys) {
      const value = read(kv, key).value
      if (!obj(value)) continue
      const game = obj(value['game']) ? value['game'] : value
      for (const realm of [game['realm'], game['before']]) {
        if (!obj(realm) || realm['seed'] !== seed || !obj(realm['heroes'])) continue
        consider(realm['heroes'][id], key)
      }
    }
    const clan = read(kv, 'hanbal.realm.clan').value
    if (obj(clan)) {
      const clanParts = id.startsWith('clan-') ? id.split('-') : null
      const clanId = clanParts ? clanParts.slice(3).join('-') : id
      const originSeed = clanParts?.[2] ?? seed
      consider(clan[`${originSeed}:${clanId}`], 'hanbal.realm.clan')
    }
    if (found.length === 0 || new Set(found.map(x => x.bust)).size !== 1) {
      report.unknown.push({ id, reason: found.length > 0 ? 'ambiguous' : mismatch ? 'identity-mismatch' : 'not-found' }); continue
    }
    const f = found[0]!
    faces[id] = { look: f.look, traits: f.traits, bust: f.bust }
    noteDrillFaces([{ id, ...faces[id] }])
    report.restored.push(id); report.sources.push({ id, key: f.key })
  }
  recovered.set(kv, { raw, faces })
  return report
}

function saveDrill(s: DrillStore): void {
  for (const [id, e] of Object.entries(s.h)) {
    if (!childId(id)) continue
    const bust = bustOf(id) ?? savedKidBust(id, e)
    if (bust !== undefined && savedKidBust(id, { ...(e.look !== undefined ? { look: e.look } : {}), bust }) === bust) e.bust ??= bust
  }
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* 저장 못 하는 곳 — 이번 판의 공은 다음에 다시 새긴다(아직 안 새긴 몫으로 남는다) */ }
}

/** 판이 끝났다 — 공을 새기고, 이번에 새로 든 공을 돌려준다 (이미 새긴 판이면 빈 것). 몇 번 불러도 한 번만 든다 */
export function engraveRun(r: Realm): Record<string, number> {
  if (r.outcome == null) return {}
  const s = loadDrill()
  const won = r.outcome.kind === 'win'
  const g = gainOf(s, r, won)
  // 의리 — 공이 없어도 겪은 일은 새긴다 (같은 판은 한 번만 · drill.engraveVows)
  const v = engraveVows(s, r)
  if (Object.keys(g).length === 0) { if (v !== s) saveDrill(v); return {} }
  saveDrill(engrave(v, r, won))
  return g
}

/** 단련터의 + — 올렸으면 true */
export function raiseHero(id: string, stat: GrowStat, born: Pick<Hero, GrowStat> | undefined): boolean {
  const s = loadDrill()
  const n = raise(s, id, stat, born, relicRoom(wornBy(id), wornLv())) // 지닌 유물이 넓힌 그릇까지 (relics.ts)
  if (n === s) return false
  saveDrill(n)
  return true
}

/** 단련터에 볼 이가 있나 (첫 화면 단추) */
export function hasDrill(): boolean {
  return Object.keys(loadDrill().h).length > 0
}

/** 그 장수의 판 밖 단련 단계 (동행 고르기 카드) */
export function drillLevel(id: string): number {
  return loadDrill().h[id]?.level ?? 0
}


export interface DrillKit {
  readonly esc: (s: string) => string
  readonly bust: (id: string) => string | null
  /** 처음 몸 — 영웅전 명부 · 가문의 아이 (없으면 새길 때 적어 둔 몸) */
  readonly bodyOf: (id: string) => Hero | undefined
  /** 걸러 보는 갈래 — 나라 이름 · 등급 · 각성 여부 (영웅전 기록) */
  readonly meta: (id: string) => { nation: string; grade: TraitGrade | null; awake: boolean }
  /** 유물 칸 · 도감 (ui/realm/relics.ts) */
  readonly relic: RelicKit
  /** 그림 밑동 (realm/) — 얼굴 링이 초상 · 전투 띠 주소를 만든다 */
  readonly art: string
  /** 각성 모습을 켜 둔 장수인가 — 한 번 읽어 여럿에 묻는다 (56-A 토글 · 큰 그림과 전투 띠가 각성 모습으로) */
  readonly looks: () => (id: string) => boolean
  /** 고른 장수의 목소리 (소리 끄기 · 크기는 부른 쪽이 따른다) */
  readonly voice: (id: string) => void
}

/** 단련터에 세울 사람 — 끝 화면에서 오면 그 판의 우리 장수, 첫 화면이면 null(단련 기록이 있는 모두) */
export interface YardOpts {
  readonly ids: readonly string[] | null
  /** 이번에 새로 든 공 — 막대가 차오른다 */
  readonly gain: Readonly<Record<string, number>>
  /** 이 판에서 쓰러진 이 — 「다음 판엔 돌아온다」 */
  readonly fell: readonly string[]
  /** 처음 그릴 때만 차오른다 (+ 를 누를 때마다 다시 차오르지 않게) */
  readonly anim: boolean
  /** 방금 올린 칸 — `id:stat` */
  readonly last: string | null
  readonly from: 'end' | 'title'
  /** 열어 둔 유물 칸 — 그 장수 쪽에서 고르기 판이 올라온다 */
  readonly slot?: { readonly id: string; readonly i: number } | null
  /** 쓸 공이 남았는데 나가려 했다 — 한 번 더 누르면 나간다 · 공을 쓸 장수의 ▲ 표가 빛난다 (형 11-05: "다음으로 눌렀을 때 쓸 공이 남아 있으면 안 되잖아") */
  readonly leaveArmed?: boolean
}

/** 의리가 움직인 까닭 — 쉬운 말로 */
const TALE_KEY: Readonly<Record<Vow, Key>> = {
  hold: 'dy.tale.hold', rescue: 'dy.tale.rescue', heart: 'dy.tale.heart', turned: 'dy.tale.turned',
}

const bodyFor = (k: DrillKit, id: string, e: DrillEntry): (Pick<Hero, GrowStat> & { uiri: number }) | null => {
  const h = k.bodyOf(id)
  if (h !== undefined) return h
  const b = e.born
  return b !== undefined ? { mu: b.mu ?? 1, tong: b.tong ?? 1, ryak: b.ryak ?? 1, chi: b.chi ?? 1, deok: b.deok ?? 1, uiri: 5 } : null
}

/** 단련터에 늘어선 순서 — 화면을 다시 그려도 장수가 자리를 바꾸지 않게 */
let yardOrder: string[] = []

// ───────── 화면 상태 — 고리(거르기 · 찾기 · 정렬) · 펼친 장수 한 사람 · 떴다 사라지는 판. 판(realm)의 상태가 아니라 눈에 보이는 것만이다

type Tab = 'stat' | 'relic'
type Pop = 'help' | 'uiri' | 'dex' | 'filter' | 'sort'
const POPS: readonly Pop[] = ['help', 'uiri', 'dex', 'filter', 'sort']
/** 정렬 — 기본(이번 판 공 · 단련 · 남은 공 · 보는 동안 자리를 지킨다) · 단련 높은 순 · 공 많은 순 · 이름 순 */
type Sort = 'base' | 'level' | 'merit' | 'name'
const SORTS: readonly Sort[] = ['base', 'level', 'merit', 'name']
/** 정렬 이름 — 판에 고를 때(long) · 단추에 붙일 때(short) */
const SORT_NAME: Readonly<Record<Sort, { readonly long: Key; readonly short: Key }>> = {
  base: { long: 'dy.sBase', short: 'dy.sBaseS' }, level: { long: 'dy.sLevel', short: 'dy.sLevelS' },
  merit: { long: 'dy.sMerit', short: 'dy.sMeritS' }, name: { long: 'dy.sName', short: 'dy.sNameS' },
}
interface YardUi {
  q: string
  state: '' | 'ready' | 'awake' | 'relic'
  nation: string
  elem: string
  grade: string
  sort: Sort
  /** 펼친 장수 — 고리 자리에 그 장수의 단련 판 (null 이면 고리) */
  hero: string | null
  /** 고리 앞에 선 장수 — 다시 그려도 · 펼친 판에서 돌아와도 그 자리에서 */
  front: string | null
  /** 다음 그림에서 전투 띠가 공격 한 번 — 펼친 판에 들어섰다(enter · 목소리도) · 능력을 올렸다(raise) */
  burst: '' | 'enter' | 'raise'
  tab: Tab
  pop: Pop | null
}
const FRESH_UI: YardUi = { q: '', state: '', nation: '', elem: '', grade: '', sort: 'base', hero: null, front: null, burst: '', tab: 'stat', pop: null }
const ui: YardUi = { ...FRESH_UI }

/** 단련터에 들어설 때 — 거르기와 열어 둔 것을 비운다 */
export function yardReset(): void {
  Object.assign(ui, FRESH_UI)
}

const GROUPS = ['state', 'nation', 'elem', 'grade'] as const
type Group = (typeof GROUPS)[number]

/** 단련터의 누름 — 바뀌었으면 true (app.ts 가 다시 그린다) */
export function yardAct(act: string, d: Readonly<Record<string, string | undefined>>): boolean {
  switch (act) {
    case 'dy-hero': {
      // 아래 「단련하기」는 고리 앞에 선 장수를 · 얼굴 링과 펼친 판의 ◀ ▶ 는 그 장수를 편다
      const id = d['id'] ?? ui.front
      if (id === null) return false
      ui.hero = id; ui.front = id; ui.tab = 'stat'; ui.pop = null; ui.burst = 'enter'
      return true
    }
    case 'dy-hback': ui.hero = null; ui.pop = null; return true
    case 'dy-tab': ui.tab = d['v'] === 'relic' ? 'relic' : 'stat'; ui.pop = null; return true
    case 'dy-pop': ui.pop = POPS.find((p) => p === d['v']) ?? null; return true
    case 'dy-sort': {
      const v = SORTS.find((s) => s === d['v'])
      if (v === undefined) return false
      // 정렬을 바꾸면 새 줄의 맨 앞부터
      ui.sort = v; ui.pop = null; ui.front = null
      return true
    }
    case 'dy-fs': {
      const g = d['g'] as Group
      if (!GROUPS.includes(g)) return false
      const v = d['v'] ?? ''
      ui[g] = (ui[g] === v ? '' : v) as never
      return true
    }
    case 'dy-freset': ui.state = ''; ui.nation = ''; ui.elem = ''; ui.grade = ''; ui.q = ''; return true
  }
  return false
}

/** 능력을 올렸다 — 다음 그림에서 전투 띠가 공격 한 번 (형: 「퍽 하면 으아아아」) */
export function yardRaised(): void {
  ui.burst = 'raise'
}

/** 뒤로 — 열린 판을 닫고, 아니면 펼친 장수에서 고리로. 할 것이 있었으면 true */
export function yardBack(): boolean {
  if (ui.pop !== null) { ui.pop = null; return true }
  if (ui.hero !== null) { ui.hero = null; return true }
  return false
}

/** 링이 고른 장수를 펴는 길 — app 의 단련터 누름과 같다 (yardAct → 다시 그림) */
export type YardGo = (act: string, d: Readonly<Record<string, string>>) => void
/** 살아 있는 얼굴 링 · 다음 그림에서 살릴 것 (yardHtml 이 짜고 yardAfterPaint 가 살린다) */
let yardRing: RingHandle | null = null
let yardPlan: ((go: YardGo) => RingOpts) | null = null

/** 다시 그리기 전 — 살아 있는 링을 멈춘다 */
export function yardBeforePaint(): void {
  yardRing?.dispose()
  yardRing = null
}

/** 다시 그린 뒤 — 얼굴 링을 살린다 (고리든 펼친 판이든) */
export function yardAfterPaint(root: HTMLElement, go: YardGo): void {
  const el = root.querySelector<HTMLElement>('.front.dyard .hrg')
  const plan = yardPlan
  yardPlan = null
  if (el !== null && plan !== null) yardRing = mountRing(el, plan(go))
  ui.burst = ''
}

interface Row {
  readonly id: string
  readonly name: string
  readonly e: DrillEntry
  readonly born: (Pick<Hero, GrowStat> & { uiri: number }) | null
  readonly nation: string
  readonly grade: TraitGrade | null
  readonly awake: boolean
  readonly elem: Elem | null
  readonly worn: readonly string[]
  readonly canUp: boolean
  /** 지금 공으로 몇 단계 더 (그릇은 따지지 않는다 · 어림) */
  readonly can: number
}

const hit = (r: Row): boolean => {
  if (ui.q !== '' && !`${r.name} ${r.nation}`.toLowerCase().includes(ui.q.toLowerCase())) return false
  if (ui.nation !== '' && r.nation !== ui.nation) return false
  if (ui.elem !== '' && r.elem !== ui.elem) return false
  if (ui.grade !== '' && r.grade !== ui.grade) return false
  if (ui.state === 'ready') return r.canUp
  if (ui.state === 'awake') return r.awake
  if (ui.state === 'relic') return r.worn.length > 0
  return true
}

/** 지난번 그린 단련터의 사람들 — 찾기 칸에 글자를 칠 때 다시 그리지 않고 수만 센다 */
let lastRows: readonly Row[] = []

/** 필터 판의 찾기 칸에 글자를 쳤다 — 다시 그리지 않고(글자판이 닫히지 않게) 맞는 수만 고친다 · 판을 닫으면 고리가 그 사람들로 */
export function yardSearch(root: HTMLElement, v: string): void {
  ui.q = v.trim()
  const n = lastRows.filter(hit).length
  const show = root.querySelector('.dyfshow')
  if (show !== null) show.textContent = t('dy.fShow', { n })
}

const ELEMS: readonly Elem[] = ['fire', 'water', 'bolt', 'wind', 'earth']
const GRADES: readonly TraitGrade[] = ['legend', 'precious', 'rare', 'good', 'common']

/** 눌린 채 남는 갈래 단추 — 채움 + 안으로 꺼짐 + ✓ (테두리 색만 바꾸지 않는다) */
const chip = (g: Group, v: string, label: string, color?: string): string => {
  const on = ui[g] === v
  return `<button class="dychip${on ? ' on' : ''}" data-act="dy-fs" data-g="${g}" data-v="${v}" aria-pressed="${on}"${color !== undefined ? ` style="--g:${color}"` : ''}>${on ? '✓ ' : ''}${label}</button>`
}

const popHtml = (title: string, body: string, cls = ''): string =>
  `<button class="dyveil" data-act="dy-pop" data-v="" aria-label="${t('dy.close')}"></button><div class="dysheet ${cls}"><div class="dysh"><b>${title}</b><button class="btn ghost" data-act="dy-pop" data-v="">${t('dy.close')}</button></div>${body}</div>`

/** 정렬한 줄 — 같으면 처음 순서 그대로 (sort 는 안정하다) */
function sorted(rows: readonly Row[]): Row[] {
  const xs = [...rows]
  if (ui.sort === 'level') xs.sort((a, b) => b.e.level - a.e.level || b.e.points - a.e.points)
  else if (ui.sort === 'merit') xs.sort((a, b) => b.e.points - a.e.points || b.e.level - a.e.level)
  else if (ui.sort === 'name') xs.sort((a, b) => splitTitle(a.name).given.localeCompare(splitTitle(b.name).given, 'ko'))
  return xs
}

/** 이번 판 공 · 다음 단련까지의 막대 (처음 그릴 때만 차오른다) */
const meritHtml = (o: YardOpts, r: Row): string => {
  const e = r.e
  const cost = spendCost(e.level)
  const gain = o.gain[r.id] ?? 0
  const to = Math.min(100, (e.points / cost) * 100)
  const from = o.anim ? Math.min(100, (Math.max(0, e.points - gain) / cost) * 100) : to
  return `<span class="dypt">${t('dy.merit', { n: `<b>${e.points}</b>` })}${gain > 0 ? `<i class="dyg">+${gain}</i>` : ''}</span><span class="dybar${e.points >= cost ? ' ready' : ''}"><i style="--from:${from.toFixed(1)}%;--to:${to.toFixed(1)}%"></i></span>`
}

/** 링 칸의 장수 — 단련한 몸의 능력치 · 공 · 등급 · 각성 모습 (펼친 판이면 능력치는 판이 보인다) */
function cardOf(k: DrillKit, o: YardOpts, r: Row, look: (id: string) => boolean, open: boolean): RingHero {
  const body = k.bodyOf(r.id)
  const c = ringCard(k.art, {
    id: r.id, name: r.name, nameHtml: nameHtml(r.name), from: `${r.nation}${r.elem !== null ? ` · ${ELEM[r.elem].name}` : ''}`,
    lv: r.e.level, body: body !== undefined ? applyDrill(body, r.e) : undefined, awake: look(r.id),
  })
  // 명부에 몸이 없는 장수(가문의 아이)는 새길 때 적어 둔 몸으로
  const born = r.born
  const stats = open ? [] : c.stats.length > 0 || born === null ? c.stats : DRILL_STATS.map((s) => [STAT_NAME[s], Math.min(10, born[s] + (r.e.add[s] ?? 0))] as const)
  const grade = r.grade !== null ? `<i class="dygr" style="--g:${GRADE_COLOR[r.grade]}">${GRADE_NAME[r.grade]}</i>` : ''
  const fire = r.awake ? '<i class="dyflag awb inl">🔥</i>' : ''
  const extra = open
    ? `${grade}${fire}${o.fell.includes(r.id) ? `<small class="dyfell">${t('dy.fell')}</small>` : ''}`
    : `${grade}${fire}${meritHtml(o, r)}${relicChips(k.relic.art, k.esc, r.worn)}`
  return { ...c, stats, extra, mark: r.canUp ? '▲' : o.fell.includes(r.id) ? '☠' : '' }
}

/** 위 칸 — 제목 · 사람 수 · 유물 도감 · 도움말 */
const topHtml = (k: DrillKit, n: number): string => {
  const dex = t('dy.relicDex', { a: relicOwned(), b: relicTotal() })
  return `<div class="dyhead"><h4 class="hrg-title">${t('dy.title')} <small class="dycount">${t('dy.count', { n })}</small></h4>`
    + `<button class="dyic" data-act="dy-pop" data-v="dex" data-tip="${k.esc(dex)}" aria-label="${k.esc(dex)}">◈</button>`
    + `<button class="dyic" data-act="dy-pop" data-v="help" aria-label="${t('dy.help')}">?</button></div>`
}

/** 고리 위 한 줄 — 필터 · 정렬 · 공 남은 장수만 (눌린 채 남는다) */
const chipsHtml = (usable: number): string => {
  const act = [ui.nation, ui.elem, ui.grade, ui.q].filter((x) => x !== '').length + (ui.state === 'awake' || ui.state === 'relic' ? 1 : 0)
  const sortOn = ui.sort !== 'base'
  const ready = ui.state === 'ready'
  return `<button class="dychip dyfbtn${act > 0 ? ' on' : ''}" data-act="dy-pop" data-v="filter" aria-pressed="${act > 0}">${act > 0 ? '✓ ' : ''}${t('dy.filter')}${act > 0 ? ` ${act}` : ''}</button>`
    + `<button class="dychip${sortOn ? ' on' : ''}" data-act="dy-pop" data-v="sort" aria-pressed="${sortOn}">${sortOn ? '✓ ' : ''}${t('dy.sort')}${sortOn ? ` · ${t(SORT_NAME[ui.sort].short)}` : ''}</button>`
    + `<button class="dychip${ready ? ' on' : ''}" data-act="dy-fs" data-g="state" data-v="ready" aria-pressed="${ready}">${ready ? '✓' : '▲'} ${t('dy.fReady')} ${usable}</button>`
}

const ringText = (): RingText => ({ title: t('dy.title'), party: '', prev: t('lc.prev'), next: t('lc.next'), lv: (n) => t('dy.lv', { n }) })

/** 단련터 화면 — 얼굴 링 (장수 한 사람을 펼쳤으면 고리 자리에 그 사람의 단련 판) */
export function yardHtml(k: DrillKit, o: YardOpts): string {
  const store = loadDrill()
  // 끝 화면에서 왔으면 공을 못 번 우리 장수도 — 무덤에서 얻은 유물을 끼울 몸이 있어야 한다 (빈 기록으로 보인다)
  const ent = (id: string): DrillEntry => store.h[id] ?? { points: 0, level: 0, add: {}, runs: 0 }
  const ids = (o.ids ?? Object.keys(store.h)).filter((id) => store.h[id] !== undefined || (o.from === 'end' && k.bodyOf(id) !== undefined))
  const fresh = [...new Set(ids)].sort((a, b) => (o.gain[b] ?? 0) - (o.gain[a] ?? 0) || ent(b).level - ent(a).level || ent(b).points - ent(a).points || (a < b ? -1 : 1))
  // 단련·유물로 단계가 오르면 그 장수가 맨 앞으로 순간이동했다 (형 10-28) — 같은 장수들을 보는 동안은 처음 순서 그대로
  const same = fresh.length === yardOrder.length && fresh.every((id) => yardOrder.includes(id))
  const list = same ? [...yardOrder] : fresh
  yardOrder = list
  const rows: Row[] = list.map((id) => {
    const e = ent(id)
    const born = bodyFor(k, id, e)
    const body = k.bodyOf(id)
    const m = k.meta(id)
    const worn = wornBy(id)
    const room = relicRoom(worn, wornLv())
    let can = 0
    for (let left = e.points; left >= spendCost(e.level + can); can++) left -= spendCost(e.level + can)
    return {
      id, name: body?.name ?? e.name ?? id, e, born, nation: m.nation, grade: m.grade, awake: m.awake,
      elem: body !== undefined ? elemOf(body) : null, worn,
      canUp: born !== null && DRILL_STATS.some((s) => raiseState(store, id, s, born, room) === 'ok'), can,
    }
  })
  lastRows = rows
  yardPlan = null
  const shown = sorted(rows).filter(hit)
  const usable = rows.filter((r) => r.canUp).length
  const armed = o.leaveArmed === true && usable > 0
  const one = ui.hero !== null ? rows.find((r) => r.id === ui.hero) : undefined
  if (one === undefined) ui.hero = null
  const top = topHtml(k, shown.length)
  const pop = ui.pop !== null ? popBox(k, one ?? null, rows) : ''
  const frame = (body: string, bar: string, tall = false): string =>
    `<div class="front dyard dyring hrgscr"${tall ? ' style="--hrg-bar:calc(98px + env(safe-area-inset-bottom))"' : ''}>${body}${bar}${pop}</div>`

  // 장수 한 사람을 펼쳤다 — 큰 그림은 그대로 두고 고리 자리에 능력 · 유물 판 (◀ ▶ 로 옆 사람)
  if (one !== undefined) {
    const at = shown.findIndex((r) => r.id === one.id)
    const prev = at >= 0 && shown.length > 1 ? shown[(at - 1 + shown.length) % shown.length] : undefined
    const next = at >= 0 && shown.length > 1 ? shown[(at + 1) % shown.length] : undefined
    const step = (r: Row | undefined, label: string, mark: string): string =>
      r !== undefined ? `<button class="btn dystep" data-act="dy-hero" data-id="${k.esc(r.id)}" aria-label="${label}" data-tip="${k.esc(r.name)}">${mark}</button>` : ''
    const { panel, sheet } = trainHtml(k, o, store, one)
    const base: RingOpts = { heroes: [cardOf(k, o, one, k.looks(), true)], max: 0, picked: [], text: ringText(), onToggle: () => [], top, panel, attack: ui.burst !== '', keys: false }
    const voice = ui.burst === 'enter'
    yardPlan = () => { if (voice) k.voice(one.id); return base }
    return frame(ringHtml(base) + sheet, `<div class="hrg-go">${step(prev, t('lc.prev'), '◀')}<button class="btn pri" data-act="dy-hback">${t('dy.back')}</button>${step(next, t('lc.next'), '▶')}</div>`)
  }

  const leave = `<button class="btn${usable > 0 ? ' ghost' : ' pri'}${armed ? ' armed' : ''}" data-act="dy-next" data-usable="${usable}">${armed ? t('dy.leaveAnyway') : o.from === 'end' ? t('dy.nextRun') : t('dy.toTitle')}</button>`
  const warn = armed ? `<p class="dywarn">${t('dy.warn', { n: usable })}</p>` : ''
  // 아무도 없다 · 거른 끝에 아무도 없다 — 고리 대신 한 줄 (필터는 그대로 둔다)
  if (shown.length === 0) {
    const body = rows.length === 0
      ? `<div class="dyvoid">${top}<p class="mute dyempty">${t('dy.empty')}</p></div>`
      : `<div class="dyvoid">${top}<div class="hrg-head">${chipsHtml(usable)}</div><p class="mute dyempty">${t('dy.noMatch')}</p><button class="dychip ghost" data-act="dy-freset">${t('dy.fReset')}</button></div>`
    return frame(body, `<div class="hrg-go">${warn}${leave}</div>`, armed)
  }

  // 고리 — 앞에 설 장수: 보던 사람 · 나가려다 붙잡혔으면 공이 남은 첫 사람 · 맨 앞
  let start = shown.find((r) => r.id === ui.front)
  if (armed && start?.canUp !== true) start = shown.find((r) => r.canUp) ?? start
  start ??= shown[0]
  ui.front = start?.id ?? null
  const look = k.looks()
  const base: RingOpts = {
    heroes: shown.map((r) => cardOf(k, o, r, look, false)), max: 0, picked: [], text: ringText(), onToggle: () => [],
    start: ui.front, top, head: chipsHtml(usable), hot: armed, keys: ui.pop === null,
  }
  // 앞 장수를 한 번 더 누르거나 Enter — 그 장수를 편다 (목소리 · 공격은 펼친 판이 처음 그릴 때)
  yardPlan = (go) => ({ ...base, onToggle: (id) => { go('dy-hero', { id }); return [] }, onFront: (id) => { ui.front = id } })
  const train = `<button class="btn${usable > 0 ? ' pri' : ''}" data-act="dy-hero" aria-label="${t('dy.train')}">${t('dy.train')}</button>`
  return frame(ringHtml(base), `<div class="hrg-go">${warn}${leave}${train}</div>`, armed)
}

const relicOwned = (): number => Object.keys(loadRelics().own).length
const relicTotal = (): number => RELICS.length

/** 떠 있는 판 — 필터(찾기 포함) · 정렬 · 도움말 · 유물 도감 · 의리 */
function popBox(k: DrillKit, one: Row | null, rows: readonly Row[]): string {
  if (ui.pop === 'help') return popHtml(t('dy.help'), `<p class="dybody-t">${t('dy.helpBody', { first: spendCost(0), step: spendCost(1) - spendCost(0) })}</p><p class="dyfine">${t('dy.fine')}</p>`)
  if (ui.pop === 'dex') return popHtml(t('dy.relicDex', { a: relicOwned(), b: relicTotal() }), relicDexHtml(k.relic), 'tall')
  if (ui.pop === 'uiri' && one !== null && one.born !== null) {
    const top = Math.min(10, one.born.uiri + P.realm.uiriRoom)
    const last = one.e.tales?.[one.e.tales.length - 1]
    return popHtml(t('dy.uiriTitle'), `<p class="dybody-t">${t('dy.uiriBody', { top })}</p>${last !== undefined ? `<p class="dyfine">${t('dy.uiriLast', { why: t(TALE_KEY[last]) })}</p>` : ''}`)
  }
  if (ui.pop === 'sort') {
    const h = SORTS.map((s) => { const on = ui.sort === s; return `<button class="dychip${on ? ' on' : ''}" data-act="dy-sort" data-v="${s}" aria-pressed="${on}">${on ? '✓ ' : ''}${t(SORT_NAME[s].long)}</button>` }).join('')
    return popHtml(t('dy.sort'), `<div class="dyfc">${h}</div>`)
  }
  if (ui.pop === 'filter') {
    const nations = [...new Set(rows.map((r) => r.nation))].filter((x) => x !== '').sort()
    const elems = new Set(rows.map((r) => r.elem))
    const grades = new Set(rows.map((r) => r.grade))
    let h = `<input class="dysearch" type="search" value="${k.esc(ui.q)}" placeholder="${t('dy.search')}" enterkeyhint="search" autocomplete="off">`
    h += `<div class="dyfg"><b>${t('dy.gState')}</b><div class="dyfc">${chip('state', 'ready', t('dy.fReady'))}${chip('state', 'awake', t('dy.fAwake'))}${chip('state', 'relic', t('dy.fRelic'))}</div></div>`
    h += `<div class="dyfg"><b>${t('dy.gNation')}</b><div class="dyfc">${nations.map((n) => chip('nation', k.esc(n), k.esc(n))).join('')}</div></div>`
    h += `<div class="dyfg"><b>${t('dy.gElem')}</b><div class="dyfc">${ELEMS.filter((e) => elems.has(e)).map((e) => chip('elem', e, ELEM[e].name)).join('')}</div></div>`
    h += `<div class="dyfg"><b>${t('dy.gGrade')}</b><div class="dyfc">${GRADES.filter((g) => grades.has(g)).map((g) => chip('grade', g, GRADE_NAME[g], GRADE_COLOR[g])).join('')}</div></div>`
    h += `<div class="dyfgo"><button class="btn ghost" data-act="dy-freset">${t('dy.fReset')}</button><button class="btn pri dyfshow" data-act="dy-pop" data-v="">${t('dy.fShow', { n: rows.filter(hit).length })}</button></div>`
    return popHtml(t('dy.filter'), h)
  }
  return ''
}

/** 펼친 장수의 단련 판 — 공 · 두 갈래(능력 · 유물) 중 하나만. 유물 고르기 판(sheet)은 화면 위에 따로 뜬다 */
function trainHtml(k: DrillKit, o: YardOpts, store: DrillStore, r: Row): { panel: string; sheet: string } {
  const e = r.e
  const born = r.born
  const cost = spendCost(e.level)
  let h = `<div class="dymer">${meritHtml(o, r)}<small>${t('dy.next', { n: cost })}${r.can > 1 ? ` · ${t('dy.canN', { n: r.can })}` : ''}</small></div>`
  const room = relicRoom(r.worn, wornLv())
  const slots = slotsFor(e.level)
  h += `<div class="dytabs"><button class="dytab${ui.tab === 'stat' ? ' on' : ''}" data-act="dy-tab" data-v="stat" aria-pressed="${ui.tab === 'stat'}">${ui.tab === 'stat' ? '✓ ' : ''}${t('dy.tabStat')}</button>`
  h += `<button class="dytab${ui.tab === 'relic' ? ' on' : ''}" data-act="dy-tab" data-v="relic" aria-pressed="${ui.tab === 'relic'}">${ui.tab === 'relic' ? '✓ ' : ''}${t('dy.tabRelic', { a: r.worn.length, b: slots })}</button></div>`
  h += `<div class="dypane">`
  let sheet = ''
  if (ui.tab === 'stat' && born !== null) {
    for (const s of DRILL_STATS) {
      const cap = capOf(born, s, room)
      const st = raiseState(store, r.id, s, born, room)
      const add = e.add[s] ?? 0
      const why = st === 'cap' ? t('dy.whyCap', { n: cap - born[s] }) : st === 'poor' ? t('dy.whyPoor', { n: cost }) : t('dy.whyOk', { n: cost, stat: STAT_NAME[s] })
      const bw = Math.min(100, (born[s] / 10) * 100)
      const aw = Math.min(100 - bw, (add / 10) * 100)
      h += `<div class="dyst2${o.last === `${r.id}:${s}` ? ' up' : ''}"><span class="dysn">${STAT_NAME[s]}</span><span class="dyval"><b>${Math.min(10, born[s] + add)}</b>${add > 0 ? `<i>+${add}</i>` : ''}</span>`
      h += `<span class="dytrk"><s style="width:${bw}%"></s><s class="add" style="left:${bw}%;width:${aw}%"></s><u style="left:${Math.min(100, (cap / 10) * 100)}%"></u></span>`
      h += st === 'ok'
        ? `<button class="dyplus" data-act="dy-up" data-id="${k.esc(r.id)}" data-s="${s}" data-tip="${k.esc(why)}">+<small>${cost}</small></button>`
        : `<button class="dyplus off" aria-disabled="true" data-why="${k.esc(why)}">${st === 'cap' ? t('dy.capped') : `+<small>${cost}</small>`}</button>`
      h += `</div>`
    }
    const shift = e.uiri ?? 0
    const uv = uiriWith(born.uiri, shift)
    const top = Math.min(10, born.uiri + P.realm.uiriRoom)
    h += `<div class="dyst2 dyui"><span class="dysn">${STAT_NAME.uiri}</span><span class="dyval"><b>${uv}</b>${shift !== 0 ? `<i${shift < 0 ? ' class="dn"' : ''}>${shift > 0 ? '+' : ''}${shift}</i>` : ''}</span>`
    h += `<span class="dytrk"><s style="width:${Math.min(100, (born.uiri / 10) * 100)}%"></s><u style="left:${(top / 10) * 100}%"></u></span>`
    h += `<button class="dyplus dyq" data-act="dy-pop" data-v="uiri" aria-label="${t('dy.uiriTitle')}">?</button></div>`
  } else if (ui.tab === 'relic') {
    const sel = o.slot?.id === r.id ? o.slot.i : null
    h += slotsHtml(k.relic, r.id, e.level, sel)
    if (sel !== null) sheet = `<button class="dyveil" data-act="rl-close" aria-label="${t('dy.close')}"></button><div class="dysheet">${pickerHtml(k.relic, r.id, sel)}</div>`
  }
  return { panel: h + `</div>`, sheet }
}

/** 끝 화면의 단련 한 줄 — 이번 판에 공을 번 장수 얼굴과 「+공」, 그리고 단련터로 */
export function yardStripHtml(k: DrillKit, rows: ReadonlyArray<{ id: string; name: string; earned: number }>, spare: number): string {
  if (rows.length === 0) return ''
  let h = `<div class="dystrip"><h4>${tr('dy.runGongs')} <small>${tr('dy.runNote')}</small></h4><div class="dysl">`
  for (const x of rows.slice(0, 8)) {
    const src = k.bust(x.id)
    h += `<span class="dysf">${src !== null ? `<img src="${src}" alt="">` : '<span class="nof"></span>'}<b>${nameHtml(x.name)}</b><i>+${x.earned}</i></span>`
  }
  h += `</div><button class="btn pri big dyopen" data-act="dy-open">${tr('dy.yard')}${spare > 0 ? `<small>${tr('dy.spare', { n: spare })}</small>` : ''}</button></div>`
  return h
}

export const DRILL_CSS = `
/* 단련터 — 얼굴 링 한 화면 (hero-ring.ts · 58-B) · 고리 위에 필터 · 정렬 · 고르면 고리 자리에 그 장수의 능력 · 유물 판 (docs/realm/DRILL-UI.md) */
.ap .front.dyard { display: flex; flex-direction: column; overflow: hidden; }
.ap .dyhead { display: flex; align-items: center; gap: 6px; }
.ap .dyhead .hrg-title { flex: 1; min-width: 0; }
.ap .dyic { flex: none; width: 44px; height: 44px; border-radius: 50%; border: 1px solid #6a5630; background: #1d160e; color: #e6d3a0; font: inherit; font-size: 20px; font-weight: 800; cursor: pointer; }
.ap .dysearch { flex: 1; min-width: 0; height: 44px; box-sizing: border-box; padding: 0 14px; border-radius: 22px; border: 1px solid #5a4a2c; background: #0d0f14; color: #f0e2c0; font: inherit; font-size: 16px; }
.ap .dysearch::placeholder { color: #7f7664; }
.ap .dysheet .dysearch { display: block; width: 100%; margin: 0 0 10px; }
/* 눌린 채 남는 단추 — 채움 + 안으로 꺼짐 + ✓ */
.ap .dychip { flex: none; min-height: 44px; box-sizing: border-box; padding: 0 14px; border-radius: 22px; border: 1px solid #5a4a2c; background: #1d160e; color: #d9cfb6; font: inherit; font-size: 14px; font-weight: 700; cursor: pointer; }
.ap .dychip.on { background: linear-gradient(#b8892f, #e2b958); border-color: #ffd98a; color: #2a1606; box-shadow: inset 0 3px 6px #5a3a0a99; }
.ap .dychip.ghost { background: none; border-color: #4a3e2a; color: #a89c84; }
.ap .hrg-head .dychip { padding: 0 11px; font-size: 13.5px; }
.ap .dygr { font-style: normal; margin-left: 6px; padding: 0 5px; border-radius: 6px; background: var(--g); color: #fff; font-size: 11px; font-weight: 700; text-shadow: 0 1px 1px #000a; }
.ap .hrg-ex .dygr { margin-left: 0; }
.ap .hrg-ex .rlchip { margin-left: 0; width: 20px; height: 20px; } .ap .hrg-ex .rlchip img { width: 17px; height: 17px; }
.ap .hrg-ex .dyfell { flex: 1 0 100%; }
.ap .dyflag { position: absolute; right: 8px; top: 6px; font-style: normal; font-size: 16px; text-shadow: 0 1px 3px #000; }
.ap .dyflag.awb { right: 8px; } .ap .dyflag.inl { position: static; }
@keyframes dyin { from { transform: translateY(10px) scale(.97); opacity: 0; } to { transform: none; opacity: 1; } }
.ap .dyempty { padding: 24px 18px; text-align: center; }
.ap .dlv { display: inline-block; flex: none; padding: 0 4px; border: 5px solid transparent; border-image: url(__ART__ui/btn-gold.png?v=2) 30 35 fill / 5px 7px stretch; border-radius: 0; color: #2a1606; font-size: 12px; font-weight: 800; line-height: 1.2; background: none; }
.ap .dlv.zero { border-image: url(__ART__ui/btn-dark.png?v=2) 30 33 fill / 5px 7px stretch; color: #cbbf9f; font-weight: 700; }
.ap .dyfell { color: #e0a090; font-size: 11.5px; }
.ap .dypt { font-size: 12.5px; color: #cfc6b4; white-space: nowrap; text-shadow: 0 1px 2px #000; } .ap .dypt b { color: #ffd27a; font-size: 15px; }
.ap .dypt .dyg { font-style: normal; margin-left: 4px; color: #9fff8a; font-weight: 800; animation: dypop 1.2s ease-out both; display: inline-block; }
@keyframes dypop { 0% { transform: scale(2.2); opacity: 0; } 30% { transform: scale(1.3); opacity: 1; } 100% { transform: none; } }
.ap .dybar { flex: 1 1 36px; max-width: 90px; height: 8px; border-radius: 4px; background: #30241acc; overflow: hidden; }
.ap .dybar i { display: block; height: 100%; width: var(--to); background: linear-gradient(90deg, #8a6a3a, #f0c060); border-radius: 4px; animation: dyfill 1.4s .25s cubic-bezier(.2,.8,.2,1) both; }
.ap .dybar.ready i { background: linear-gradient(90deg, #c9a23a, #ffe08a); box-shadow: 0 0 8px #ffd27a99; }
@keyframes dyfill { from { width: var(--from); } to { width: var(--to); } }
/* 아무도 없을 때 · 거른 끝에 아무도 없을 때 — 고리 대신 한 줄 */
.ap .dyvoid { position: absolute; left: 0; right: 0; top: 0; bottom: var(--hrg-bar); display: flex; flex-direction: column; align-items: center; gap: 10px; padding: calc(env(safe-area-inset-top) + 8px) 14px 12px; box-sizing: border-box; overflow-y: auto; }
.ap .dyvoid .dyhead { align-self: stretch; }
/* 아래 붙박이 띠(.hrg-go) — 펼친 판의 ◀ ▶ 는 작게 · 공을 남긴 채 나가려 하면 「그래도 나갑니다」는 흐리게 */
.ap .hrg-go > .dystep { flex: 0 0 56px; padding: 5px 0; }
.ap .hrg-go .btn.armed { opacity: .85; }
/* 펼친 판 — 고리 자리 (hero-ring .hrg-panel) */
.ap .hrg-panel .dymer { padding-top: 10px; }
/* 낮은 화면(작은 폰) — 능력 여섯 줄이 밀지 않고 다 보이게 줄을 낮춘다 */
@media (max-height: 700px) { .ap .hrg-panel .dyst2 { flex-basis: 40px; min-height: 40px; } .ap .hrg-panel .dyplus { min-height: 40px; } }
/* 낮은 가로 화면(폰을 눕힌 것) — 아래 띠도 낮추고 줄 사이를 더 좁힌다 (값은 + 단추에 있다) */
@media (orientation: landscape) and (max-height: 500px) {
  .ap .front.dyard.dyring { --hrg-bar: calc(56px + env(safe-area-inset-bottom)); }
  .ap .hrg-panel .dymer { padding: 6px 14px 2px; } .ap .hrg-panel .dymer small { display: none; }
  .ap .hrg-panel .dytabs { padding: 2px 12px 4px; } .ap .hrg-panel .dytab { min-height: 40px; }
  .ap .hrg-panel .dyst2 { flex-basis: 38px; min-height: 38px; } .ap .hrg-panel .dyplus { min-height: 38px; }
}
.ap .dymer { flex: none; display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; align-items: center; padding: 8px 14px 4px; } .ap .dymer small { grid-column: 1 / 3; color: var(--mute); font-size: 12px; }
.ap .dymer .dybar { max-width: none; height: 10px; }
.ap .dytabs { flex: none; display: flex; gap: 6px; padding: 4px 12px 8px; }
.ap .dytab { flex: 1; min-height: 44px; border-radius: 10px; border: 1px solid #5a4a2c; background: #1d160e; color: #d9cfb6; font: inherit; font-weight: 700; cursor: pointer; }
.ap .dytab.on { background: linear-gradient(#b8892f, #e2b958); border-color: #ffd98a; color: #2a1606; box-shadow: inset 0 3px 6px #5a3a0a99; }
.ap .dypane { flex: 1 1 0; min-height: 0; overflow-y: auto; padding: 0 12px 8px; display: flex; flex-direction: column; gap: 2px; }
.ap .dyst2 { display: grid; grid-template-columns: 3em 3.6em 1fr 58px; align-items: center; gap: 8px; flex: 1 1 46px; min-height: 46px; max-height: 76px; }
.ap .dyst2 .dysn { color: #e6d9b8; font-weight: 700; }
.ap .dyval { display: flex; align-items: baseline; gap: 3px; } .ap .dyval b { color: #f6ead0; font-size: 20px; } .ap .dyval i { font-style: normal; color: #9fd07a; font-size: 12px; } .ap .dyval i.dn { color: #e08a7a; }
.ap .dytrk { position: relative; height: 10px; border-radius: 5px; background: #2a2016; }
.ap .dytrk s { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 5px 0 0 5px; background: repeating-linear-gradient(135deg, #8a7040 0 4px, #6d5a32 4px 8px); text-decoration: none; }
.ap .dytrk s.add { border-radius: 0 5px 5px 0; background: linear-gradient(90deg, #d9b36a, #ffe08a); }
.ap .dytrk u { position: absolute; top: -3px; bottom: -3px; width: 2px; background: #cbbf9f; text-decoration: none; }
.ap .dyst2.up .dyval b { animation: dyup .8s ease-out both; color: #ffe08a; }
@keyframes dyup { 0% { transform: scale(2); } 100% { transform: none; } }
.ap .dyplus { box-sizing: border-box; min-width: 58px; min-height: 44px; padding: 0 2px; border: 6px solid transparent; border-image: url(__ART__ui/btn-gold.png?v=2) 30 35 fill / 6px 8px stretch; border-radius: 0; background: none; color: #2a1606; font: inherit; font-weight: 800; cursor: pointer; }
.ap .dyplus small { font-weight: 700; font-size: 11px; color: #4a2e10; margin-left: 2px; }
.ap .dyplus.off { border-image: url(__ART__ui/btn-dark.png?v=2) 30 33 fill / 6px 8px stretch; color: #8a7e6a; } .ap .dyplus.off small { color: #8a7e6a; }
.ap .dyplus.dyq { border-image: url(__ART__ui/btn-dark.png?v=2) 30 33 fill / 6px 8px stretch; color: #efe3c6; }
.ap .dypane .rlslots { flex-direction: column; align-items: stretch; } .ap .dypane .rlslot { flex: none; min-height: 56px; }
/* 떴다 사라지는 판 — 아래에서 올라온다 (밀어 내리는 화면 대신) */
.ap .dyveil { position: absolute; inset: 0; z-index: 20; border: 0; background: #000a; cursor: pointer; }
.ap .dysheet { position: absolute; left: 0; right: 0; bottom: 0; z-index: 21; max-height: 78%; overflow-y: auto; box-sizing: border-box; padding: 10px 14px calc(14px + env(safe-area-inset-bottom, 0px)); border-radius: 16px 16px 0 0; border-top: 2px solid #c9a23a; background: #120d08; animation: dyin .25s ease-out both; }
.ap .dysheet.tall { max-height: 88%; }
.ap .dysh { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; color: var(--gold); font-size: 17px; }
.ap .dysh .btn { min-height: 44px; }
.ap .dybody-t { margin: 4px 0; line-height: 1.6; color: #e0d4b8; font-size: 14px; } .ap .dyfine { margin: 6px 0 0; color: var(--mute); font-size: 12px; line-height: 1.5; }
.ap .dyfg { margin-bottom: 10px; } .ap .dyfg > b { display: block; margin-bottom: 4px; color: #cbbf9f; font-size: 13px; }
.ap .dyfc { display: flex; flex-wrap: wrap; gap: 6px; }
.ap .dyfc .dychip { min-height: 44px; }
.ap .dyfgo { display: flex; gap: 8px; margin-top: 4px; } .ap .dyfgo .btn { flex: 1; min-height: 48px; justify-content: center; }
/* 필터 판의 「모두 풀기 · n명 보기」는 판 아래에 붙박이 — 나라가 많아 판을 밀어도 늘 보인다 */
.ap .dysheet .dyfgo { position: sticky; bottom: calc(-14px - env(safe-area-inset-bottom, 0px)); margin: 4px -14px 0; padding: 8px 14px calc(14px + env(safe-area-inset-bottom, 0px)); background: #120d08; border-top: 1px solid #3a2e1e; }
.ap .dysheet .rlpick { margin: 0; border: 0; padding: 0; background: none; } .ap .dysheet .rlpl { max-height: none; }
/* 둥근 얼굴 — 끝 화면의 공 줄 (청동 테 그림 · ui/ring-portrait.png) */
.ap .dystrip .dysf img, .ap .dystrip .dysf .nof { background: url(__ART__ui/ring-portrait.png) center / 100% 100% no-repeat, #17110c !important; background-origin: border-box; border-style: solid; border-color: transparent !important; border-radius: 50%; box-sizing: border-box; width: 54px !important; height: 54px !important; border-width: 9px !important; }
.ap .dystrip { max-width: 560px; margin: 10px auto 4px; padding: 2px 4px; border: 12px solid transparent; border-image: url(__ART__ui/frame-panel.png?v=3) 118 / 12px stretch; border-radius: 0; background: #1f1710f2 padding-box; text-align: left; }
.ap .dystrip h4 { margin: 0 0 6px; color: var(--gold); } .ap .dystrip h4 small { color: var(--mute); font-weight: 400; margin-left: 6px; }
.ap .dystrip .dysl { display: flex; flex-wrap: wrap; gap: 6px; }
.ap .dystrip .dysf { display: flex; flex-direction: column; align-items: center; width: 64px; gap: 1px; }
.ap .dystrip .dysf img, .ap .dystrip .dysf .nof { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; object-position: top; border: 2px solid #8a7040; background: #17110c; }
.ap .dystrip .dysf b { font-size: 11.5px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ap .dystrip .dysf i { font-style: normal; font-weight: 800; color: #9fff8a; font-size: 13px; }
.ap .dystrip .dyopen { display: flex; flex-direction: column; align-items: center; margin: 8px auto 0; } .ap .dystrip .dyopen small { font-size: 11.5px; font-weight: 400; }
`
