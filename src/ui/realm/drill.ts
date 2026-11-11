/**
 * 단련터 — 판과 판 사이의 화톳불 (docs/realm/HERO-GROWTH.md ★ 둘째 판 §A · §C · 셈은 src/realm/drill.ts).
 *
 *   판이 끝나면(이기든 지든) 끝 화면이 이번 판의 공을 새기고(engraveRun), 「단련터」로 들어가 장수마다 공을 써 능력치를 하나씩 올린다.
 *   첫 화면의 「단련터」로도 들어온다 — 남은 공은 아무 때나 쓴다.
 * 기록은 이 기기에만 (`hanbal.realm.drill` · 영웅전·해금처럼). 못 읽으면 빈 기록 — 지우지는 않는다.
 */
import { STAT_NAME } from '../../realm/data/prose.ts'
import { GRADE_COLOR, GRADE_NAME, type TraitGrade } from '../../realm/data/traits.ts'
import { RELICS } from '../../realm/data/relics.ts'
import { t, type Key } from '../../i18n/index.ts'
import { ELEM, elemOf, type Elem } from './ascend.ts'
import { DRILL_STATS, capOf, emptyDrill, engrave, engraveVows, gainOf, raise, raiseState, spendCost, uiriWith, type DrillEntry, type DrillStore } from '../../realm/drill.ts'
import type { GrowStat, Hero, Realm, Vow } from '../../realm/types.ts'
import { P } from '../../tune/params.ts'
import { relicRoom, slotsFor } from '../../realm/relics.ts'
import { nameHtml } from './heroview.ts'
import { loadRelics, pickerHtml, relicChips, relicDexHtml, slotsHtml, wornBy, wornLv, type RelicKit } from './relics.ts'

const KEY = 'hanbal.realm.drill'

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

/** 판 밖 단련 기록 — 깨졌거나 없으면 빈 기록 */
export function loadDrill(): DrillStore {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<DrillStore> | null
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
        ...(e.born !== undefined && typeof e.born === 'object' ? { born: e.born } : {}),
        // 의리 — 판 밖에서 움직인 몫 · 까닭 · 새긴 판 (UIRI)
        ...(typeof e.uiri === 'number' && Number.isFinite(e.uiri) && e.uiri !== 0 ? { uiri: Math.round(e.uiri) } : {}),
        ...(Array.isArray(e.tales) ? { tales: e.tales.filter((x): x is Vow => x === 'hold' || x === 'rescue' || x === 'heart' || x === 'turned').slice(-6) } : {}),
        ...(typeof e.uiriSeed === 'number' ? { uiriSeed: e.uiriSeed } : {}),
      }
    }
    const paid = typeof v.paid === 'object' && v.paid !== null ? v.paid : {}
    const order = Array.isArray(v.order) ? v.order.filter((x): x is string => typeof x === 'string') : Object.keys(paid)
    return { v: 1, h, paid, order }
  } catch {
    return emptyDrill()
  }
}

function saveDrill(s: DrillStore): void {
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
  /** 큰 판(900px) 주소 — 없는 장수는 null (그림 없으면 bust 로 갈아 낀다) */
  readonly bustHd: (id: string) => string | null
  /** 처음 몸 — 영웅전 명부 · 가문의 아이 (없으면 새길 때 적어 둔 몸) */
  readonly bodyOf: (id: string) => Hero | undefined
  /** 걸러 보는 갈래 — 나라 이름 · 등급 · 각성 여부 (영웅전 기록) */
  readonly meta: (id: string) => { nation: string; grade: TraitGrade | null; awake: boolean }
  /** 유물 칸 · 도감 (ui/realm/relics.ts) */
  readonly relic: RelicKit
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
  /** 쓸 공이 남았는데 나가려 했다 — 한 번 더 누르면 나간다 · 공을 쓸 장수 카드가 빛난다 (형 11-05: "다음으로 눌렀을 때 쓸 공이 남아 있으면 안 되잖아") */
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

/** 단련터에 늘어선 순서 — 화면을 다시 그려도 카드가 자리를 바꾸지 않게 */
let yardOrder: string[] = []

// ───────── 화면 상태 — 목록(거르기 · 찾기) · 장수 한 사람 쪽 · 떴다 사라지는 판. 판(realm)의 상태가 아니라 눈에 보이는 것만이다

type Tab = 'stat' | 'relic'
type Pop = 'help' | 'uiri' | 'dex' | 'filter'
interface YardUi {
  q: string
  state: '' | 'ready' | 'awake' | 'relic'
  nation: string
  elem: string
  grade: string
  hero: string | null
  tab: Tab
  pop: Pop | null
}
const FRESH_UI: YardUi = { q: '', state: '', nation: '', elem: '', grade: '', hero: null, tab: 'stat', pop: null }
const ui: YardUi = { ...FRESH_UI }
/** 장수 쪽에 들어갔다 나올 때 목록을 보던 자리 */
let listTop = 0
/** 거르기를 바꿨다 — 다시 그린 목록은 맨 위부터 */
let resetTop = false

/** 단련터에 들어설 때 — 거르기와 열어 둔 것을 비운다 */
export function yardReset(): void {
  Object.assign(ui, FRESH_UI)
  listTop = 0
}

const GROUPS = ['state', 'nation', 'elem', 'grade'] as const
type Group = (typeof GROUPS)[number]

/** 단련터의 누름 — 바뀌었으면 true (app.ts 가 다시 그린다) */
export function yardAct(root: HTMLElement, act: string, d: Readonly<Record<string, string | undefined>>): boolean {
  switch (act) {
    case 'dy-hero':
      listTop = root.querySelector<HTMLElement>('.dylist')?.scrollTop ?? listTop
      ui.hero = d['id'] ?? null; ui.tab = 'stat'; ui.pop = null
      return true
    case 'dy-hback': ui.hero = null; ui.pop = null; return true
    case 'dy-tab': ui.tab = d['v'] === 'relic' ? 'relic' : 'stat'; ui.pop = null; return true
    case 'dy-pop': ui.pop = d['v'] === 'help' || d['v'] === 'uiri' || d['v'] === 'dex' || d['v'] === 'filter' ? d['v'] : null; return true
    case 'dy-fs': {
      const g = d['g'] as Group
      if (!GROUPS.includes(g)) return false
      const v = d['v'] ?? ''
      ui[g] = (ui[g] === v ? '' : v) as never
      resetTop = true
      return true
    }
    case 'dy-freset': ui.state = ''; ui.nation = ''; ui.elem = ''; ui.grade = ''; ui.q = ''; resetTop = true; return true
  }
  return false
}

/** 뒤로 — 열린 판을 닫고, 아니면 장수 쪽에서 목록으로. 할 것이 있었으면 true */
export function yardBack(): boolean {
  if (ui.pop !== null) { ui.pop = null; return true }
  if (ui.hero !== null) { ui.hero = null; return true }
  return false
}

/** 다시 그리기 전 — 목록을 보던 자리를 적어 둔다 */
export function yardBeforePaint(root: HTMLElement): void {
  const l = root.querySelector<HTMLElement>('.dylist')
  if (l === null) return
  listTop = resetTop ? 0 : l.scrollTop
  resetTop = false
}

/** 다시 그린 뒤 — 목록을 보던 자리로 */
export function yardAfterPaint(root: HTMLElement): void {
  const l = root.querySelector<HTMLElement>('.dylist')
  if (l !== null) l.scrollTop = listTop
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

const hit = (r: Row, useQ = true): boolean => {
  if (useQ && ui.q !== '' && !`${r.name} ${r.nation}`.toLowerCase().includes(ui.q.toLowerCase())) return false
  if (ui.nation !== '' && r.nation !== ui.nation) return false
  if (ui.elem !== '' && r.elem !== ui.elem) return false
  if (ui.grade !== '' && r.grade !== ui.grade) return false
  if (ui.state === 'ready') return r.canUp
  if (ui.state === 'awake') return r.awake
  if (ui.state === 'relic') return r.worn.length > 0
  return true
}

/** 찾기 칸에 글자를 쳤다 — 다시 그리지 않고(글자판이 닫히지 않게) 카드를 숨기고 보인다 */
export function yardSearch(root: HTMLElement, v: string): void {
  ui.q = v.trim()
  const q = ui.q.toLowerCase()
  let n = 0
  for (const el of root.querySelectorAll<HTMLElement>('.dyrow')) {
    const ok = q === '' || (el.dataset['q'] ?? '').includes(q)
    // 거르기 칸이 이미 숨긴 카드는 그대로 숨긴다
    const show = ok && el.dataset['pass'] === '1'
    el.hidden = !show
    if (show) n++
  }
  const c = root.querySelector('.dycount')
  if (c !== null) c.textContent = t('dy.count', { n })
  const none = root.querySelector<HTMLElement>('.dynone')
  if (none !== null) none.hidden = n > 0
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

/** 카드 · 장수 쪽 어귀의 그림 — 큰 판을 오른쪽에 깔고, 없으면 작은 판 */
const artHtml = (k: DrillKit, id: string): string => {
  const hd = k.bustHd(id)
  const sm = k.bust(id)
  const src = hd ?? sm
  if (src === null) return '<span class="dyart nof"></span>'
  const fb = hd !== null && sm !== null ? ` onerror="this.onerror=null;this.src='${k.esc(sm)}'"` : ''
  return `<span class="dyart"><img src="${k.esc(src)}"${fb} alt="" loading="lazy" decoding="async"></span>`
}

const subLine = (k: DrillKit, r: Row): string => {
  const g = r.grade !== null ? `<i class="dygr" style="--g:${GRADE_COLOR[r.grade]}">${GRADE_NAME[r.grade]}</i>` : ''
  return `${k.esc(r.nation)}${r.elem !== null ? ` · ${ELEM[r.elem].name}` : ''}${g}`
}

/** 단련터 화면 — 목록 (장수 한 사람이 열려 있으면 그 사람 쪽) */
export function yardHtml(k: DrillKit, o: YardOpts): string {
  const store = loadDrill()
  // 끝 화면에서 왔으면 공을 못 번 우리 장수도 — 무덤에서 얻은 유물을 끼울 몸이 있어야 한다 (빈 기록으로 보인다)
  const ent = (id: string): DrillEntry => store.h[id] ?? { points: 0, level: 0, add: {}, runs: 0 }
  const ids = (o.ids ?? Object.keys(store.h)).filter((id) => store.h[id] !== undefined || (o.from === 'end' && k.bodyOf(id) !== undefined))
  const fresh = [...new Set(ids)].sort((a, b) => (o.gain[b] ?? 0) - (o.gain[a] ?? 0) || ent(b).level - ent(a).level || ent(b).points - ent(a).points || (a < b ? -1 : 1))
  // 단련·유물로 단계가 오르면 그 카드가 맨 앞으로 순간이동했다 (형 10-28) — 같은 장수들을 보는 동안은 처음 순서 그대로
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
  const usable = rows.filter((r) => r.canUp).length
  const one = ui.hero !== null ? rows.find((r) => r.id === ui.hero) : undefined
  const armed = o.leaveArmed === true && usable > 0
  const go = `<div class="dygo">${armed ? `<p class="dywarn">${t('dy.warn', { n: usable })}</p>` : ''}`
    + (one !== undefined
      ? `<button class="btn pri big" data-act="dy-hback">${t('dy.back')}</button></div>`
      : `<button class="btn pri big${armed ? ' armed' : ''}" data-act="dy-next" data-usable="${usable}">${armed ? t('dy.leaveAnyway') : o.from === 'end' ? t('dy.nextRun') : t('dy.toTitle')}</button></div>`)
  const style = `--rows:${P.realm.drillRows};--rowmin:${P.realm.drillRowMinPx}px;--artw:${P.realm.drillArtPct}%`
  if (one !== undefined) return `<div class="front dyard dyone" style="${style}">${heroHtml(k, o, store, one)}${go}${ui.pop !== null ? popBox(k, one) : ''}</div>`
  return `<div class="front dyard" style="${style}">${listHead(k, rows)}${listBody(k, o, rows, armed)}${go}${ui.pop !== null ? popBox(k, null) : ''}</div>`
}

/** 위 띠 · 찾기 · 거르기 */
function listHead(k: DrillKit, rows: readonly Row[]): string {
  const n = rows.filter((r) => hit(r)).length
  const act = [ui.nation, ui.elem, ui.grade].filter((x) => x !== '').length
  const open = ui.pop === 'filter'
  let h = `<div class="dytop"><h2>${t('dy.title')}</h2><span class="dycount">${t('dy.count', { n })}</span>`
  h += `<button class="dyic" data-act="dy-pop" data-v="dex" data-tip="${k.esc(t('dy.relicDex', { a: relicOwned(), b: relicTotal() }))}" aria-label="${t('dy.relicDex', { a: relicOwned(), b: relicTotal() })}">◈</button>`
  h += `<button class="dyic" data-act="dy-pop" data-v="help" aria-label="${t('dy.help')}">?</button></div>`
  h += `<div class="dyfind"><input class="dysearch" type="search" value="${k.esc(ui.q)}" placeholder="${t('dy.search')}" enterkeyhint="search" autocomplete="off">`
  h += `<button class="dychip dyfbtn${act > 0 || open ? ' on' : ''}" data-act="dy-pop" data-v="${open ? '' : 'filter'}" aria-pressed="${act > 0}">${act > 0 ? '✓ ' : ''}${t('dy.filter')}${act > 0 ? ` ${act}` : ''}</button></div>`
  h += `<div class="dyquick">${chip('state', 'ready', t('dy.fReady'))}${chip('state', 'awake', t('dy.fAwake'))}${chip('state', 'relic', t('dy.fRelic'))}`
  h += `${act > 0 || ui.state !== '' || ui.q !== '' ? `<button class="dychip ghost" data-act="dy-freset">${t('dy.fReset')}</button>` : ''}</div>`
  return h
}

const relicOwned = (): number => Object.keys(loadRelics().own).length
const relicTotal = (): number => RELICS.length

/** 카드 목록 — 한 화면에 drillRows 장 */
function listBody(k: DrillKit, o: YardOpts, rows: readonly Row[], armed: boolean): string {
  let h = `<div class="dylist">`
  if (rows.length === 0) h += `<p class="mute dyempty">${t('dy.empty')}</p>`
  let shown = 0
  for (const r of rows) {
    const pass = hit(r)
    if (pass) shown++
    const e = r.e
    const cost = spendCost(e.level)
    const gain = o.gain[r.id] ?? 0
    const to = Math.min(100, (e.points / cost) * 100)
    const from = o.anim ? Math.min(100, (Math.max(0, e.points - gain) / cost) * 100) : to
    // data-pass: 거르기 칸이 통과시킨 카드 (찾기 글자는 따로 · yardSearch)
    const pass2 = hit(r, false)
    const hidden = !pass
    const g = r.grade !== null ? GRADE_COLOR[r.grade] : '#5a5a5a'
    h += `<button class="dyrow${gain > 0 && o.anim ? ' fresh' : ''}${r.canUp && armed ? ' canup' : ''}${r.awake ? ' awk' : ''}" style="--g:${g}" data-act="dy-hero" data-id="${k.esc(r.id)}" data-q="${k.esc(`${r.name} ${r.nation}`.toLowerCase())}" data-pass="${pass2 ? 1 : 0}"${hidden ? ' hidden' : ''}>`
    h += `${artHtml(k, r.id)}<span class="dyshade"></span><span class="dyinfo">`
    h += `<span class="dyl1"><b class="dyname">${nameHtml(r.name)}</b>${e.level > 0 ? `<span class="dlv">${t('dy.lv', { n: e.level })}</span>` : `<span class="dlv zero">${t('dy.lv', { n: 0 })}</span>`}</span>`
    h += `<span class="dysub">${subLine(k, r)}</span>`
    h += `<span class="dyl3"><span class="dypt">${t('dy.merit', { n: `<b>${e.points}</b>` })}${gain > 0 ? `<i class="dyg">+${gain}</i>` : ''}</span><span class="dybar${e.points >= cost ? ' ready' : ''}"><i style="--from:${from.toFixed(1)}%;--to:${to.toFixed(1)}%"></i></span>${relicChips(k.relic.art, k.esc, r.worn)}</span>`
    h += `</span>`
    h += `${r.awake ? '<i class="dyflag awb">🔥</i>' : ''}${r.canUp ? '<i class="dyflag up">▲</i>' : ''}${o.fell.includes(r.id) ? `<i class="dyflag fell" data-tip="${k.esc(t('dy.fell'))}">☠</i>` : ''}`
    h += `</button>`
  }
  h += `<p class="mute dyempty dynone"${shown > 0 || rows.length === 0 ? ' hidden' : ''}>${t('dy.noMatch')}</p>`
  lastShown = shown
  return h + `</div>`
}

/** 떠 있는 판 — 거르기 · 도움말 · 유물 도감 · 의리 */
function popBox(k: DrillKit, one: Row | null): string {
  if (ui.pop === 'help') return popHtml(t('dy.help'), `<p class="dybody-t">${t('dy.helpBody', { first: spendCost(0), step: spendCost(1) - spendCost(0) })}</p><p class="dyfine">${t('dy.fine')}</p>`)
  if (ui.pop === 'dex') return popHtml(t('dy.relicDex', { a: relicOwned(), b: relicTotal() }), relicDexHtml(k.relic), 'tall')
  if (ui.pop === 'uiri' && one !== null && one.born !== null) {
    const top = Math.min(10, one.born.uiri + P.realm.uiriRoom)
    const last = one.e.tales?.[one.e.tales.length - 1]
    return popHtml(t('dy.uiriTitle'), `<p class="dybody-t">${t('dy.uiriBody', { top })}</p>${last !== undefined ? `<p class="dyfine">${t('dy.uiriLast', { why: t(TALE_KEY[last]) })}</p>` : ''}`)
  }
  if (ui.pop === 'filter') {
    const rows = [...yardOrder]
    const nations = [...new Set(rows.map((id) => k.meta(id).nation))].filter((x) => x !== '').sort()
    const elems = new Set(rows.map((id) => { const b = k.bodyOf(id); return b !== undefined ? elemOf(b) : null }))
    const grades = new Set(rows.map((id) => k.meta(id).grade))
    let h = `<div class="dyfg"><b>${t('dy.gNation')}</b><div class="dyfc">${nations.map((n) => chip('nation', k.esc(n), k.esc(n))).join('')}</div></div>`
    h += `<div class="dyfg"><b>${t('dy.gElem')}</b><div class="dyfc">${ELEMS.filter((e) => elems.has(e)).map((e) => chip('elem', e, ELEM[e].name)).join('')}</div></div>`
    h += `<div class="dyfg"><b>${t('dy.gGrade')}</b><div class="dyfc">${GRADES.filter((g) => grades.has(g)).map((g) => chip('grade', g, GRADE_NAME[g], GRADE_COLOR[g])).join('')}</div></div>`
    h += `<div class="dyfgo"><button class="btn ghost" data-act="dy-freset">${t('dy.fReset')}</button><button class="btn pri" data-act="dy-pop" data-v="">${t('dy.fShow', { n: filteredCount(rows.length) })}</button></div>`
    return popHtml(t('dy.filter'), h)
  }
  return ''
}
let lastShown = 0
const filteredCount = (fallback: number): number => lastShown > 0 ? lastShown : fallback

/** 장수 한 사람 쪽 — 넓은 그림 띠 · 공 · 두 갈래(능력 · 유물) 중 하나만 */
function heroHtml(k: DrillKit, o: YardOpts, store: DrillStore, r: Row): string {
  const e = r.e
  const born = r.born
  const cost = spendCost(e.level)
  const g = r.grade !== null ? GRADE_COLOR[r.grade] : '#5a5a5a'
  const gain = o.gain[r.id] ?? 0
  const to = Math.min(100, (e.points / cost) * 100)
  const from = o.anim ? Math.min(100, (Math.max(0, e.points - gain) / cost) * 100) : to
  let h = `<div class="dyband${r.awake ? ' awk' : ''}" style="--g:${g}">${artHtml(k, r.id)}<span class="dyshade"></span>`
  h += `<button class="dyic dyx" data-act="dy-hback" aria-label="${t('dy.back')}">‹</button>`
  h += `<div class="dyinfo"><b class="dyname big">${nameHtml(r.name)}</b><span class="dysub">${subLine(k, r)}</span><span class="dyl1"><span class="dlv${e.level > 0 ? '' : ' zero'}">${t('dy.lv', { n: e.level })}</span>${r.awake ? '<i class="dyflag awb inl">🔥</i>' : ''}</span>`
  if (o.fell.includes(r.id)) h += `<small class="dyfell">${t('dy.fell')}</small>`
  h += `</div></div>`
  h += `<div class="dymer"><span class="dypt">${t('dy.merit', { n: `<b>${e.points}</b>` })}${gain > 0 ? `<i class="dyg">+${gain}</i>` : ''}</span><span class="dybar${e.points >= cost ? ' ready' : ''}"><i style="--from:${from.toFixed(1)}%;--to:${to.toFixed(1)}%"></i></span>`
  h += `<small>${t('dy.next', { n: cost })}${r.can > 1 ? ` · ${t('dy.canN', { n: r.can })}` : ''}</small></div>`
  const room = relicRoom(r.worn, wornLv())
  const slots = slotsFor(e.level)
  h += `<div class="dytabs"><button class="dytab${ui.tab === 'stat' ? ' on' : ''}" data-act="dy-tab" data-v="stat" aria-pressed="${ui.tab === 'stat'}">${ui.tab === 'stat' ? '✓ ' : ''}${t('dy.tabStat')}</button>`
  h += `<button class="dytab${ui.tab === 'relic' ? ' on' : ''}" data-act="dy-tab" data-v="relic" aria-pressed="${ui.tab === 'relic'}">${ui.tab === 'relic' ? '✓ ' : ''}${t('dy.tabRelic', { a: r.worn.length, b: slots })}</button></div>`
  h += `<div class="dypane">`
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
    if (sel !== null) h += `<button class="dyveil" data-act="rl-close" aria-label="${t('dy.close')}"></button><div class="dysheet">${pickerHtml(k.relic, r.id, sel)}</div>`
  }
  return h + `</div>`
}

/** 끝 화면의 단련 한 줄 — 이번 판에 공을 번 장수 얼굴과 「+공」, 그리고 단련터로 */
export function yardStripHtml(k: DrillKit, rows: ReadonlyArray<{ id: string; name: string; earned: number }>, spare: number): string {
  if (rows.length === 0) return ''
  let h = `<div class="dystrip"><h4>이번 판의 공 <small>져도 남는다 · 단련터에서 쓴다</small></h4><div class="dysl">`
  for (const x of rows.slice(0, 8)) {
    const src = k.bust(x.id)
    h += `<span class="dysf">${src !== null ? `<img src="${src}" alt="">` : '<span class="nof"></span>'}<b>${nameHtml(x.name)}</b><i>+${x.earned}</i></span>`
  }
  h += `</div><button class="btn pri big dyopen" data-act="dy-open">단련터 ›${spare > 0 ? `<small>쓸 공 ${spare}</small>` : ''}</button></div>`
  return h
}

export const DRILL_CSS = `
/* 단련터 — 큰 그림 띠 카드 목록 한 줄에 한 사람 · 사람을 누르면 그 사람 쪽 (docs/realm/DRILL-UI.md) */
.ap .front.dyard { display: flex; flex-direction: column; overflow: hidden; }
.ap .dytop { display: flex; align-items: center; gap: 6px; flex: none; min-height: 48px; padding: 0 8px 0 14px; }
.ap .dytop h2 { margin: 0; font-size: 20px; color: var(--gold); }
.ap .dycount { flex: 1; color: var(--mute); font-size: 13px; }
.ap .dyic { flex: none; width: 44px; height: 44px; border-radius: 50%; border: 1px solid #6a5630; background: #1d160e; color: #e6d3a0; font: inherit; font-size: 20px; font-weight: 800; cursor: pointer; }
.ap .dyfind { flex: none; display: flex; gap: 8px; padding: 0 12px 6px; }
.ap .dysearch { flex: 1; min-width: 0; height: 44px; box-sizing: border-box; padding: 0 14px; border-radius: 22px; border: 1px solid #5a4a2c; background: #0d0f14; color: #f0e2c0; font: inherit; font-size: 16px; }
.ap .dysearch::placeholder { color: #7f7664; }
.ap .dyquick { flex: none; display: flex; gap: 6px; padding: 0 12px 8px; }
/* 눌린 채 남는 단추 — 채움 + 안으로 꺼짐 + ✓ */
.ap .dychip { flex: none; min-height: 44px; box-sizing: border-box; padding: 0 14px; border-radius: 22px; border: 1px solid #5a4a2c; background: #1d160e; color: #d9cfb6; font: inherit; font-size: 14px; font-weight: 700; cursor: pointer; }
.ap .dychip.on { background: linear-gradient(#b8892f, #e2b958); border-color: #ffd98a; color: #2a1606; box-shadow: inset 0 3px 6px #5a3a0a99; }
.ap .dychip.ghost { background: none; border-color: #4a3e2a; color: #a89c84; }
.ap .dyquick .dychip { min-height: 38px; padding: 0 12px; } .ap .dyquick .dychip.ghost { margin-left: auto; }
.ap .dylist { flex: 1 1 0; min-height: 0; overflow-y: auto; container-type: size; overscroll-behavior: contain; }
.ap .dyrow { position: relative; display: block; width: 100%; box-sizing: border-box; height: max(var(--rowmin), calc(100cqh / var(--rows))); padding: 0; margin: 0; overflow: hidden; border: 0; border-bottom: 2px solid #0a0c10; border-left: 5px solid var(--g, #5a5a5a); background: #17110c; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.ap .dyrow[hidden], .ap .dynone[hidden] { display: none; }
.ap .dyart { position: absolute; top: 0; right: 0; bottom: 0; width: var(--artw); overflow: hidden; background: #17110c; }
.ap .dyart img { width: 100%; height: 100%; object-fit: cover; object-position: 50% 14%; display: block; }
.ap .dyshade { position: absolute; inset: 0; background: linear-gradient(90deg, #0c0a08f2 0%, #0c0a08e6 36%, #0c0a0866 62%, #0c0a0800 100%); pointer-events: none; }
.ap .dyinfo { position: absolute; left: 0; top: 0; bottom: 0; width: 62%; display: flex; flex-direction: column; justify-content: center; gap: 1px; padding: 2px 6px 2px 10px; min-width: 0; }
.ap .dyl1 { display: flex; align-items: center; gap: 6px; min-width: 0; }
.ap .dyname { font-size: 18px; color: #f6ead0; text-shadow: 0 1px 3px #000; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.ap .dyname.big { font-size: 24px; }
.ap .dysub { font-size: 12px; color: #cfc4a8; text-shadow: 0 1px 2px #000; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ap .dygr { font-style: normal; margin-left: 6px; padding: 0 5px; border-radius: 6px; background: var(--g); color: #fff; font-size: 11px; font-weight: 700; text-shadow: 0 1px 1px #000a; }
.ap .dyl3 { display: flex; align-items: center; gap: 6px; min-width: 0; }
.ap .dyl3 .rlchip { margin-left: 0; width: 20px; height: 20px; } .ap .dyl3 .rlchip img { width: 17px; height: 17px; }
.ap .dyflag { position: absolute; right: 8px; top: 6px; font-style: normal; font-size: 16px; text-shadow: 0 1px 3px #000; }
.ap .dyflag.up { top: auto; bottom: 6px; padding: 1px 6px; border-radius: 8px; background: #e2b958; color: #2a1606; font-size: 12px; font-weight: 800; text-shadow: none; }
.ap .dyflag.fell { top: auto; bottom: 6px; right: auto; left: 12px; }
.ap .dyflag.awb { right: 8px; } .ap .dyflag.inl { position: static; }
.ap .dyrow.fresh { animation: dyin .5s ease-out both; }
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
/* 작은 폰 — 카드가 낮아지면 줄 사이를 좁히고 등급 알약은 접는다 (등급은 왼쪽 띠 빛깔로 남는다) */
.ap .dyname, .ap .dysub, .ap .dyl3 { line-height: 1.15; }
@container (max-height: 560px) { .dyrow .dyname { font-size: 16px; } .dyrow .dysub { font-size: 11px; } .dyrow .dygr { display: none; } .dyrow .dyinfo { gap: 0; } .dyrow .dlv { border-width: 4px 6px; font-size: 11px; } .dyrow .dypt { font-size: 12px; } .dyrow .dypt b { font-size: 14px; } }
/* 쓸 공이 남은 채 나가려 했다 — 그 장수 카드가 금빛으로 숨 쉰다 (형 11-05) */
.ap .dyrow.canup { box-shadow: inset 0 0 0 3px #ffd98a, inset 0 0 22px #ffb02a99; animation: dycanup 1s ease-in-out infinite alternate; }
@keyframes dycanup { from { box-shadow: inset 0 0 0 2px #ffd98a99, inset 0 0 10px #ffb02a55; } to { box-shadow: inset 0 0 0 4px #ffd98a, inset 0 0 26px #ffb02aaa; } }
@media (prefers-reduced-motion: reduce) { .ap .dyrow.canup { animation: none; } }
/* 아래 붙박이 */
.ap .front.dyard .dygo { flex: none; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px 12px calc(8px + env(safe-area-inset-bottom, 0px)); border-top: 1px solid #2a2418; background: #101318; }
.ap .dygo .btn { width: 100%; max-width: 560px; min-height: 48px; display: flex; align-items: center; justify-content: center; text-align: center; }
.ap .dygo .dywarn { margin: 0; color: #ffd27a; font-weight: 700; text-align: center; font-size: 13px; }
.ap .dygo .btn.armed { opacity: .85; }
/* 장수 한 사람 쪽 */
.ap .dyband { position: relative; flex: none; height: clamp(120px, 24%, 220px); overflow: hidden; border-bottom: 4px solid var(--g, #5a5a5a); background: #17110c; }
.ap .dyband .dyart { width: 66%; } .ap .dyband .dyart img { object-position: 50% 12%; }
.ap .dyband .dyinfo { width: 66%; padding-left: 58px; gap: 3px; }
.ap .dyband .dyx { position: absolute; left: 6px; top: 6px; z-index: 2; background: #0c0a08b0; }
.ap .dyband .dyflag.awb { top: 8px; right: 10px; }
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
.ap .dyfgo { display: flex; gap: 8px; margin-top: 4px; } .ap .dyfgo .btn { flex: 1; min-height: 48px; }
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
