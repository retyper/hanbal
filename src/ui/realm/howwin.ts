/**
 * 이기는 법 — 싸움에 지고 지도로 돌아오면 위에 띠 하나, 누르면 그림 넘기기 판 (형 10-29: "전투에서 패배하면 개빡치고 하기 싫어지니까
 * 지고 나서 게임 맵 돌아오면 상단에 알람 띄워 주자 · 설명 페이지들 이미지로 · 하나씩 넘겨 가면서 · 쉽게").
 *
 * 판 한 장 = 큰 그림 하나 + 짧은 말 한 줄 + 「해 보기」(그 탭을 연다). 글보다 그림 (메모리 show-not-read) · 굴리기 없음 (no-scroll-popups).
 * 방금 진 싸움에서 짐작되는 까닭(머릿수 · 무장 · 정찰 · 깃발 …)은 앞으로 당겨 붉은 딱지를 단다.
 * 그림은 지금 있는 것(병사·깃발·아이콘·사건 그림)으로 짠다 — 챗지피티 그림을 구우면 public/realm/howwin/<이름>.jpg 에 두고 HOWWIN_BAKED 에 이름을 넣는다
 * (docs/realm/ART-QUEUE.md 「이기는 법 여덟 장」).
 *
 * 화면의 일 — 판 상태는 읽기만 한다.
 */
import type { Equip } from '../../realm/battle.ts'
import { armyPower } from '../../realm/estimate.ts'
import { PLOT_NAME, TIER_NAME } from '../../realm/data/prose.ts'
import type { Army, Realm, Report, ReportLine } from '../../realm/types.ts'
import { P } from '../../tune/params.ts'

export type LessonId = 'draft' | 'iron' | 'scout' | 'plot' | 'pincer' | 'ally' | 'flag' | 'hero'
/** 넘기는 차례 — 까닭으로 짚인 것이 앞으로 나온다 */
export const LESSON_ORDER: readonly LessonId[] = ['draft', 'iron', 'scout', 'plot', 'pincer', 'ally', 'flag', 'hero']
/** 「해 보기」가 여는 곳 — 탭 · 외교 탭이면 그 칸 */
export interface LessonGo { readonly tab: 'draft' | 'army' | 'diplo' | 'heroes'; readonly mode?: 'envoy' | 'plot' | 'scout' }
const GO: Readonly<Record<LessonId, LessonGo>> = {
  draft: { tab: 'draft' },
  iron: { tab: 'army' }, // 군대 판의 「철제 강화」
  scout: { tab: 'diplo', mode: 'scout' },
  plot: { tab: 'diplo', mode: 'plot' },
  pincer: { tab: 'army' },
  ally: { tab: 'diplo', mode: 'envoy' },
  flag: { tab: 'army' }, // 깃발은 싸움 안에서 고른다 — 출정부터
  hero: { tab: 'heroes' },
}
/** 구운 그림이 들어온 장 — 이름이 있으면 짠 그림 대신 public/realm/howwin/howwin-<id>.jpg */
export const HOWWIN_BAKED: ReadonlySet<LessonId> = new Set<LessonId>(['draft', 'iron', 'scout', 'plot', 'pincer', 'ally', 'flag', 'hero'])

/** 방금 진 싸움 한 판에서 읽은 것 */
export interface Loss {
  readonly season: number
  /** 고을을 잃었거나 군대가 무너졌다 */
  readonly big: boolean
  readonly foe: string | null
  /** [우리, 적] 판정에 선 사람 */
  readonly men: readonly [number, number] | null
  /** [우리, 적] 무장 배수 (사람 수로 가중) */
  readonly gear: readonly [number, number] | null
  /** 깃발 상성 [이긴 합, 진 합] */
  readonly flags: readonly [number, number]
  /** 지킴이었나 */
  readonly def: boolean
  /** 짐작되는 까닭 — 앞의 것이 더 큰 까닭 (셋까지) */
  readonly causes: readonly LessonId[]
}

type Battle = Extract<ReportLine, { kind: 'battle' }>

/** 무장 배수의 평균 (사람 수로 가중) — 군대가 없으면 null */
function gearOf(r: Realm, armies: readonly Army[]): number | null {
  let men = 0, sum = 0
  for (const a of armies) {
    const p = armyPower(r, a.id)
    if (p === null || !(p.parts.men > 0)) continue
    men += p.parts.men
    sum += p.parts.gear * p.parts.men
  }
  return men > 0 ? sum / men : null
}

/**
 * 이번 계절 우리가 진 싸움 — 없으면 null. 여럿이면 크게 진 것(고을·군대를 잃은 것), 그다음 머릿수 차가 큰 것.
 * prev 는 계절 앞의 판(군대·정찰이 그때 그대로) · next 는 뒤의 판(잃은 고을)
 */
export function lossOf(prev: Realm, next: Realm, rep: Report, me: string): Loss | null {
  const out: Loss[] = []
  for (const l of rep.lines) {
    if (l.kind !== 'battle' || l.pending !== undefined) continue
    const atkIds = [l.attacker, ...l.allies]
    const ourAtk = l.atkFaction === me || atkIds.some((id) => prev.armies[id]?.faction === me)
    const def = !ourAtk && l.defender === me
    if (!ourAtk && !def) continue
    const lost = ourAtk ? l.outcome === 'lose' || l.outcome === 'routed' : l.outcome === 'win' || l.outcome === 'rout'
    if (!lost) continue
    out.push(readLoss(prev, next, l, me, def))
  }
  if (out.length === 0) return null
  const gap = (x: Loss): number => (x.men !== null ? x.men[1] - x.men[0] : 0)
  return out.sort((a, b) => Number(b.big) - Number(a.big) || gap(b) - gap(a))[0]!
}

function readLoss(prev: Realm, next: Realm, l: Battle, me: string, def: boolean): Loss {
  const s: 0 | 1 = def ? 1 : 0
  const o: 0 | 1 = def ? 0 : 1
  const atkIds = new Set([l.attacker, ...l.allies])
  const near = (a: Army): boolean => (a.march === null && a.at === l.node) || (l.edge !== undefined && a.march?.edge === l.edge) || a.march?.to === l.node
  const atk = Object.values(prev.armies).filter((a) => atkIds.has(a.id))
  const dfd = Object.values(prev.armies).filter((a) => !atkIds.has(a.id) && near(a) && a.faction === (def ? me : l.defender))
  const ours = def ? dfd : atk.filter((a) => a.faction === me)
  const theirs = def ? atk : dfd
  const foe = def ? (l.atkFaction ?? prev.armies[l.attacker]?.faction ?? null) : l.defender
  const men = l.start !== undefined ? ([l.start.men[s], l.start.men[o]] as const) : null
  const go = gearOf(prev, ours), gt = gearOf(prev, theirs)
  const gear = gt !== null ? ([go ?? P.realm.equipStone, gt] as const) : null
  const mine = def ? 'd' : 'a'
  let won = 0, lostN = 0
  for (const rd of l.rounds ?? []) {
    if (rd.beat === mine) won++
    else if (rd.beat !== null) lostN++
  }
  // 크게 졌다 — 지키던 고을을 잃었거나 · 무너져 달아났거나 · 싸운 우리 군대가 흩어졌다
  const townLost = def && prev.nodes[l.node]?.owner === me && next.nodes[l.node]?.owner !== me
  const broke = (def ? l.outcome === 'rout' : l.outcome === 'routed') || ours.some((a) => next.armies[a.id] === undefined)
  // 까닭 — 앞의 것이 더 큰 까닭
  const causes: LessonId[] = []
  const add = (c: LessonId, on: boolean): void => { if (on && !causes.includes(c)) causes.push(c) }
  const more = men !== null && men[1] > men[0] * 1.15
  add('draft', more)
  add('iron', gear !== null && gear[1] - gear[0] > 0.04)
  const intel = prev.intel[me]?.[l.node]?.force
  add('scout', def ? l.ambush === 'success' : l.field !== true && (intel === null || intel === undefined || intel.season < prev.season - 1))
  add('flag', lostN > won)
  add('pincer', !def && !l.pincer && l.allies.length === 0 && more)
  add('ally', (def && l.pincer) || (men !== null && men[1] > men[0] * 1.6))
  add('plot', l.start !== undefined && l.start.morale[o] > l.start.morale[s] * 1.1)
  add('hero', l.start !== undefined && l.start.heroes[s] === null)
  return { season: next.season, big: townLost || broke, foe, men, gear, flags: [won, lostN], def, causes: causes.slice(0, 3) }
}

// ───────── 몇 번 띄웠나 — 판(시드)마다 · 같은 계절엔 한 번 · 세 번 넘게 띄운 뒤로는 크게 졌을 때만
const SEEN_KEY = 'hanbal.realm.howwin'
interface Seen { seed: number; n: number; last: number }
function readSeen(seed: number): Seen {
  try {
    const v = JSON.parse(localStorage.getItem(SEEN_KEY) ?? 'null') as Seen | null
    if (v !== null && v.seed === seed && Number.isFinite(v.n) && Number.isFinite(v.last)) return v
  } catch { /* 처음 · 저장이 막힌 곳 */ }
  return { seed, n: 0, last: -1 }
}
export function howWinDue(seed: number, loss: Loss): boolean {
  const s = readSeen(seed)
  if (s.last === loss.season) return false
  const free = Number(P.realm.howWinFreeShows)
  return s.n < (Number.isFinite(free) ? free : 3) || loss.big
}
export function howWinMark(seed: number, season: number): void {
  const s = readSeen(seed)
  try { localStorage.setItem(SEEN_KEY, JSON.stringify({ seed, n: s.n + 1, last: season })) } catch { /* 저장 못 하는 곳 */ }
}

// ───────── 그림
export interface HowKit {
  readonly art: string
  /** 그 나라 깃발 그림 (icon 폴더 이름) — 없으면 null */
  readonly flag: (f: string | null) => string | null
  /** 그 탭이 열리기까지 남은 계절 (0 이면 열림) */
  readonly wait: (tab: LessonGo['tab']) => number
}

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
const pct = (x: number): number => Math.round(x * 100)

/** 무장 배수에서 가장 가까운 단계 */
function tierOf(g: number): Equip {
  const R = P.realm
  const all: Array<[Equip, number]> = [['stone', R.equipStone], ['bronze', R.equipBronze], ['ironTip', R.equipIronTip], ['iron', R.equipIron], ['ringSword', R.equipRingSword]]
  return all.sort((a, b) => Math.abs(a[1] - g) - Math.abs(b[1] - g))[0]![0]
}
const TIER_IC: Readonly<Record<Equip, string>> = {
  stone: 'good-wood', leather: 'treasure-mandolin-dagger', bronze: 'treasure-mandolin-dagger', ironTip: 'good-arrow-bundle', iron: 'treasure-iron-helmet', ringSword: 'treasure-ring-sword',
}
/** 띠에 뜨는 까닭 그림 */
const CAUSE_IC: Readonly<Record<LessonId, string>> = {
  draft: 'icon/sol-spear', iron: 'icon/treasure-iron-helmet', scout: 'icon/unit-scouts', plot: 'icon/plot-schemes',
  pincer: 'icon/war-melee', ally: 'icon/ask-joint', flag: 'flag/flag-hold', hero: 'icon/unit-general',
}
/** 판의 바탕 그림 (event 폴더) */
const BG: Readonly<Record<LessonId, string>> = {
  draft: 'event-invade-field', iron: 'event-bow-forge', scout: 'event-spy-rumor', plot: 'event-plot-burn',
  pincer: 'event-relief-cavalry', ally: 'event-alliance-oath', flag: 'event-war-council', hero: 'event-sniped-commander',
}
const TITLE: Readonly<Record<LessonId, string>> = {
  draft: '군사 더 뽑기', iron: '쇠 무기 들리기', scout: '정찰 보내기', plot: '공작으로 흔들기',
  pincer: '두 군대로 협공', ally: '동맹 부르기', flag: '깃발 상성', hero: '장수 붙이기',
}

/** 위 띠 — 그림 · 「⚔ 이기는 법」 · 짚인 까닭 그림 (셋까지) */
export function bannerHtml(k: HowKit, loss: Loss): string {
  const cs = loss.causes.map((c) => `<img class="lsn-bcz" src="${k.art}${CAUSE_IC[c]}.png" alt="">`).join('')
  return `<div class="lsn-bn${loss.big ? ' big' : ''}" role="button" aria-label="이기는 법 보기"><img class="lsn-bni" src="${k.art}icon/war-broken-banner.png" alt="">`
    + `<b>⚔ 이기는 법</b>${cs !== '' ? `<span class="lsn-bcs">${cs}</span>` : ''}<i class="lsn-bgo">▶</i></div>`
}

export interface Lesson { readonly id: LessonId; readonly cause: boolean; readonly html: string }

/** 넘길 판들 — 까닭으로 짚인 것이 먼저, 나머지는 정한 차례 */
export function lessons(k: HowKit, loss: Loss | null): Lesson[] {
  const causes = loss?.causes ?? []
  const ids = [...causes, ...LESSON_ORDER.filter((x) => !causes.includes(x))]
  return ids.map((id) => ({ id, cause: causes.includes(id), html: pageHtml(k, id, causes.includes(id) ? loss : null) }))
}

function pageHtml(k: HowKit, id: LessonId, loss: Loss | null): string {
  const g = GO[id]
  const w = k.wait(g.tab)
  const pic = HOWWIN_BAKED.has(id) ? `<div class="lsn-pic baked" style="background-image:url('${k.art}howwin/howwin-${id}.jpg')"></div>` : `<div class="lsn-pic" style="background-image:url('${k.art}event/${BG[id]}.jpg')"><div class="lsn-st">${picHtml(k, id, loss)}</div></div>`
  const go = w > 0 ? `<button class="lsn-go" disabled>🔒 ${w}계절 뒤에 열립니다</button>` : `<button class="lsn-go" data-lsn="go" data-id="${id}">해 보기</button>`
  return `<div class="lsn-pg" data-id="${id}">${loss !== null ? '<i class="lsn-why">이번 싸움</i>' : ''}${pic}<h4 class="lsn-h">${esc(TITLE[id])}</h4><p class="lsn-ln${loss !== null ? ' why' : ''}">${esc(lineOf(id, loss))}</p>${go}</div>`
}

/** 한 줄 — 까닭이면 방금 싸움의 숫자로, 아니면 늘 맞는 말로 (합니다체 · 메모리 system-text-honorific) */
function lineOf(id: LessonId, loss: Loss | null): string {
  const R = P.realm
  switch (id) {
    case 'draft': return loss?.men != null ? `적이 ${Math.round(loss.men[1] - loss.men[0])}명 더 많았습니다` : '머릿수가 많은 쪽이 이깁니다'
    case 'iron': return loss !== null ? '적의 무장이 우리보다 좋았습니다' : `쇠 무장은 청동보다 ${pct(R.equipIron / R.equipBronze - 1)}% 셉니다`
    case 'scout': return loss === null ? '적의 군사와 낌새가 미리 보입니다' : loss.def ? '적의 기습을 미리 몰랐습니다' : '적의 군사를 모르고 쳤습니다'
    case 'plot': return loss !== null ? '적의 사기가 더 높았습니다' : `소문은 적의 사기를 ${pct(R.plotRumorMorale)}% 깎습니다`
    case 'pincer': return loss !== null ? '한 군대로만 쳤습니다' : `두 길에서 같은 계절에 닿으면 ${pct(R.pincer - 1)}% 더 셉니다`
    case 'ally': return loss !== null && loss.men !== null && loss.men[1] > loss.men[0] * 1.6 ? `적이 ${(loss.men[1] / Math.max(1, loss.men[0])).toFixed(1)}배나 많았습니다` : loss !== null ? '적이 두 길로 협공했습니다' : '함께 치자고 하거나 군대를 빌립니다'
    case 'flag': return loss !== null ? `깃발 상성에서 ${loss.flags[1]}번 밀렸습니다` : '적의 낌새를 보고 이기는 깃발을 고릅니다'
    case 'hero': return loss !== null ? '장수 없이 싸웠습니다' : '장수가 이끌면 군대가 더 셉니다'
  }
}

/** 병사 n 명 그림 — 적이면 붉은 테에 마주 본다 */
function crowd(k: HowKit, n: number, foe: boolean, unit = 'sol-spear'): string {
  let h = ''
  for (let i = 0; i < n; i++) h += `<img src="${k.art}icon/${unit}.png" alt="" style="--i:${i}">`
  return `<span class="lsn-crowd${foe ? ' foe' : ''}">${h}</span>`
}
const big = (k: HowKit, name: string, cls = ''): string => `<img class="lsn-big${cls !== '' ? ` ${cls}` : ''}" src="${k.art}icon/${name}.png" alt="">`
const tag = (t: string, cls = ''): string => `<b class="lsn-tag${cls !== '' ? ` ${cls}` : ''}">${esc(t)}</b>`
const col = (inner: string, under: string, cls = ''): string => `<span class="lsn-col${cls !== '' ? ` ${cls}` : ''}">${inner}${under}</span>`

function picHtml(k: HowKit, id: LessonId, loss: Loss | null): string {
  const R = P.realm
  const foeFlag = k.flag(loss?.foe ?? null)
  const foeMark = foeFlag !== null ? `<img class="lsn-em" src="${k.art}icon/${foeFlag}.png" alt="">` : ''
  switch (id) {
    case 'draft': {
      if (loss?.men != null) {
        const [o, t] = loss.men
        const top = Math.max(1, o, t)
        const n = (x: number): number => Math.max(1, Math.min(5, Math.round((5 * x) / top)))
        return col(crowd(k, n(o), false), tag(`우리 ${Math.round(o)}`, 'bad'))
          + '<i class="lsn-vs">⚔</i>'
          + col(foeMark + crowd(k, n(t), true), tag(`적 ${Math.round(t)}`, 'foe'))
          + `<span class="lsn-plus">＋ ${crowd(k, 2, false)}</span>`
      }
      return col(crowd(k, 5, false), tag('우리 ✓', 'good')) + '<i class="lsn-vs">⚔</i>' + col(crowd(k, 2, true), tag('적', 'foe'))
    }
    case 'iron': {
      if (loss?.gear != null) {
        const [o, t] = loss.gear.map(tierOf) as [Equip, Equip]
        return col(big(k, TIER_IC[o]), tag(`우리 ${TIER_NAME[o]}`, 'bad')) + '<i class="lsn-vs">⚔</i>' + col(big(k, TIER_IC[t], 'foe'), tag(`적 ${TIER_NAME[t]}`, 'foe'))
      }
      return col(big(k, 'treasure-mandolin-dagger'), tag(`청동 ×${R.equipBronze}`)) + '<i class="lsn-ar">▶</i>'
        + col(big(k, 'treasure-iron-helmet') + big(k, 'treasure-iron-ingots', 'sm'), tag(`쇠 ×${R.equipIron}`, 'good'))
    }
    case 'scout': {
      const seen = loss === null
      return col(big(k, 'unit-scouts'), tag('정찰', 'good')) + '<i class="lsn-ar">▶</i>'
        + col(`<span class="lsn-fog${seen ? ' clear' : ''}">${crowd(k, 3, true)}${seen ? '' : '<i class="lsn-q">?</i>'}</span>`, tag(seen ? '보인다 👁' : '못 봤다', seen ? 'good' : 'bad'))
    }
    case 'plot': {
      const ops = (['burn', 'rumor', 'sow'] as const).map((op) => col(big(k, `plot-${op}`, 'mid'), tag(PLOT_NAME[op])))
      return `<span class="lsn-row3">${ops.join('')}</span><span class="lsn-sub">${tag(`곡식 −${pct(R.plotBurnShare)}%`, 'bad')}${tag(`사기 −${pct(R.plotRumorMorale)}%`, 'bad')}</span>`
    }
    case 'pincer': {
      return col(crowd(k, 2, false), '<i class="lsn-arr r">➜</i>', 'side')
        + col(big(k, 'settle-hill-fort', 'town'), tag(`×${R.pincer}`, 'good'))
        + col(crowd(k, 2, false, 'sol-bow'), '<i class="lsn-arr l">➜</i>', 'side flip')
    }
    case 'ally': {
      return col(big(k, 'ask-joint'), tag('함께 치자', 'good')) + '<i class="lsn-vs">＋</i>' + col(big(k, 'ask-troops'), tag('군대 빌리기', 'good'))
    }
    case 'flag': {
      const f = (c: 'hold' | 'charge' | 'open', name: string, cls: string): string => `<span class="lsn-fl ${cls}"><img src="${k.art}flag/flag-${c}.png" alt=""><b>${name}</b></span>`
      // 세모 — 방진 ▶ 돌격 ▶ 길 트기 ▶ 방진 (화살표가 이기는 쪽에서 지는 쪽으로)
      const arrow = (d: string): string => `<path d="${d}" marker-end="url(#lsnHead)"/>`
      return `<span class="lsn-tri"><svg class="lsn-tsv" viewBox="0 0 230 176" aria-hidden="true"><defs><marker id="lsnHead" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M0 0L10 5L0 10z" fill="#ffd27a"/></marker></defs>`
        + `${arrow('M146 42 Q182 52 192 88')}${arrow('M170 122 Q115 138 62 122')}${arrow('M38 88 Q48 52 84 42')}</svg>`
        + `${f('hold', '방진', 't')}${f('charge', '돌격', 'r')}${f('open', '길 트기', 'l')}</span>`
    }
    case 'hero': {
      return col(big(k, 'unit-general'), tag('장수 ★', 'good')) + '<i class="lsn-ar">▶</i>' + col(crowd(k, 3, false), tag('더 세다', 'good'))
    }
  }
}

/**
 * 판을 연다 — 넘기기(밀기 · 그림 누르기 · ‹ ›) · 점 · ✕ · 바탕 누르기로 닫힘. 「해 보기」는 닫고 go 를 부른다.
 * 굴리기 없음 — 한 장이 한 화면에 든다
 */
export function openLessons(root: HTMLElement, pages: readonly Lesson[], go: (g: LessonGo) => void): void {
  root.querySelector('.lsn-box')?.remove()
  if (pages.length === 0) return
  const box = document.createElement('div')
  box.className = 'lsn-box'
  box.innerHTML = `<div class="lsn-card" role="dialog" aria-label="이기는 법"><button class="lsn-x" data-lsn="x" aria-label="닫기">✕</button><div class="lsn-view"></div>`
    + `<div class="lsn-nav"><button class="lsn-pv" data-lsn="prev" aria-label="앞 장">‹</button><span class="lsn-dots">${pages.map((p, i) => `<i data-lsn="dot" data-i="${i}" class="${p.cause ? 'why' : ''}"></i>`).join('')}</span><button class="lsn-nx" data-lsn="next" aria-label="다음 장">›</button></div></div>`
  root.append(box)
  const view = box.querySelector<HTMLElement>('.lsn-view')!
  let at = -1
  const show = (i: number): void => {
    const j = Math.max(0, Math.min(pages.length - 1, i))
    if (j === at) return
    const dir = j > at ? 'in-r' : 'in-l'
    at = j
    view.innerHTML = pages[j]!.html
    view.firstElementChild?.classList.add(at === 0 && dir === 'in-r' ? 'in-0' : dir)
    box.querySelectorAll('.lsn-dots i').forEach((d, k) => d.classList.toggle('on', k === j))
    box.querySelector('.lsn-pv')!.toggleAttribute('disabled', j === 0)
    box.querySelector('.lsn-nx')!.toggleAttribute('disabled', j === pages.length - 1)
  }
  const close = (): void => box.remove()
  box.addEventListener('click', (ev) => {
    ev.stopPropagation() // 판 밑의 지도·단추가 같이 눌리지 않게
    const t = ev.target as HTMLElement
    if (t === box) { close(); return }
    const b = t.closest<HTMLElement>('[data-lsn]')
    const a = b?.dataset['lsn']
    if (a === 'x') close()
    else if (a === 'prev') show(at - 1)
    else if (a === 'next') show(at + 1)
    else if (a === 'dot') show(Number(b!.dataset['i']))
    else if (a === 'go') { const id = b!.dataset['id'] as LessonId; close(); go(GO[id]) }
    else if (t.closest('.lsn-pic') !== null) show(at + 1 >= pages.length ? 0 : at + 1) // 그림을 누르면 다음 장
  })
  // 밀어 넘기기
  let x0: number | null = null
  box.addEventListener('pointerdown', (ev) => { x0 = ev.clientX })
  box.addEventListener('pointerup', (ev) => {
    if (x0 === null) return
    const dx = ev.clientX - x0
    x0 = null
    if (Math.abs(dx) > 40) show(at + (dx < 0 ? 1 : -1))
  })
  show(0)
}

/**
 * 위 띠를 띄운다 — 누르면 판 · 띠 밖을 누르면 걷힘 · 정한 시간이면 걷힘 (값이 깨져도 기본값 · 상한 30초) (메모리 notices-must-dismiss)
 */
export function showBanner(root: HTMLElement, html: string, open: () => void): void {
  root.querySelector('.lsn-bn')?.remove()
  root.insertAdjacentHTML('beforeend', html)
  const el = root.querySelector<HTMLElement>('.lsn-bn')
  if (el === null) return
  const v = Number(P.realm.howWinToastMs)
  const life = Number.isFinite(v) && v > 0 ? Math.min(v, 30000) : 9000
  const gone = (): void => {
    root.removeEventListener('pointerdown', outside, true)
    if (!el.isConnected || el.classList.contains('out')) return
    el.classList.add('out')
    window.setTimeout(() => el.remove(), 350)
  }
  const outside = (ev: Event): void => { if (!el.contains(ev.target as Node)) gone() }
  root.addEventListener('pointerdown', outside, true)
  el.addEventListener('click', (ev) => { ev.stopPropagation(); gone(); open() })
  window.setTimeout(gone, life)
}

/** 걷는다 — 뒤로가기 · 판을 새로 열 때 */
export function closeHowWin(root: HTMLElement): boolean {
  const box = root.querySelector('.lsn-box')
  if (box !== null) { box.remove(); return true }
  const bn = root.querySelector('.lsn-bn')
  if (bn !== null) { bn.remove(); return true }
  return false
}

// 폰 그래픽 한도 (메모리 mobile-gpu-layer-limit): 부드러운 linear-gradient · filter 밝기 금지 — 둥근 그러데이션과 drop-shadow 만
export const HOWWIN_CSS = `
.ap .lsn-bn { position: absolute; left: 50%; top: calc(var(--toph) + var(--legh) + 10px); z-index: 79; transform: translateX(-50%); display: flex; align-items: center; gap: 8px;
  max-width: calc(100vw - 32px); box-sizing: border-box; padding: 6px 14px 6px 6px; border-radius: 999px; background: #2a1208f2; border: 2px solid #ffd27a; color: #ffe8b0; cursor: pointer;
  box-shadow: 0 0 0 0 #ffd27a88, 0 8px 22px #000b; animation: lsnIn .55s cubic-bezier(.2,1.6,.4,1) both, lsnPulse 1.6s ease-in-out .6s infinite; white-space: nowrap; }
.ap .lsn-bn.big { border-color: #ff8a6a; background: radial-gradient(ellipse at top, #5a1a0cf5, #2a1208f5); }
.ap .lsn-bn.out { animation: lsnOut .35s ease-in forwards; }
.ap .lsn-bn > b { font-family: var(--display); font-size: 19px; letter-spacing: 1px; color: #ffe08a; text-shadow: 0 2px 0 #000; }
.ap .lsn-bn .lsn-bni { width: 34px; height: 34px; flex: none; border-radius: 50%; background: #0006; padding: 2px; animation: lsnWave 1.2s ease-in-out infinite; transform-origin: 30% 90%; }
.ap .lsn-bn .lsn-bcs { display: flex; gap: 2px; min-width: 0; }
.ap .lsn-bn .lsn-bcz { width: 26px; height: 26px; object-fit: contain; border-radius: 6px; background: #0005; border: 1px solid #e0705a; }
.ap .lsn-bn .lsn-bgo { font-style: normal; color: #ffd27a; font-size: 14px; }
@keyframes lsnIn { 0% { opacity: 0; translate: 0 -24px; scale: .8; } 100% { opacity: 1; translate: 0 0; scale: 1; } }
@keyframes lsnOut { to { opacity: 0; translate: 0 -14px; } }
@keyframes lsnPulse { 0%, 100% { box-shadow: 0 0 0 0 #ffd27a88, 0 8px 22px #000b; } 50% { box-shadow: 0 0 0 8px #ffd27a00, 0 8px 22px #000b; } }
@keyframes lsnWave { 0%, 100% { rotate: -6deg; } 50% { rotate: 6deg; } }

.ap .lsn-box { position: absolute; inset: 0; z-index: 86; display: flex; align-items: center; justify-content: center; padding: 12px 16px; box-sizing: border-box; background: #000c; animation: lsnFade .2s ease-out both; touch-action: pan-y; }
@keyframes lsnFade { from { opacity: 0; } to { opacity: 1; } }
.ap .lsn-card { position: relative; width: min(100%, 420px); max-height: 100%; box-sizing: border-box; padding: 14px 14px 10px; border-radius: 16px; background: #1f1710; border: 2px solid #c9a45a; box-shadow: 0 12px 40px #000d; overflow: hidden; }
.ap .lsn-x { position: absolute; right: 8px; top: 8px; z-index: 3; width: 36px; height: 36px; border-radius: 50%; border: 1px solid #c9a45a; background: #000a; color: #f0e2c0; font-size: 17px; cursor: pointer; }
.ap .lsn-pg { position: relative; display: flex; flex-direction: column; align-items: stretch; gap: 8px; }
.ap .lsn-pg.in-r { animation: lsnR .28s ease-out both; } .ap .lsn-pg.in-l { animation: lsnL .28s ease-out both; } .ap .lsn-pg.in-0 { animation: lsnFade .3s ease-out both; }
@keyframes lsnR { from { opacity: 0; translate: 40px 0; } to { opacity: 1; translate: 0 0; } }
@keyframes lsnL { from { opacity: 0; translate: -40px 0; } to { opacity: 1; translate: 0 0; } }
.ap .lsn-why { position: absolute; left: 8px; top: 8px; z-index: 2; padding: 3px 10px; border-radius: 6px; background: #b8321e; color: #fff3e0; font-style: normal; font-weight: 800; font-size: 13px; box-shadow: 0 2px 6px #000a; rotate: -4deg; }
.ap .lsn-pic { position: relative; width: 100%; aspect-ratio: 4 / 3; max-height: 46vh; border-radius: 12px; overflow: hidden; background: #2a1f16 center / cover no-repeat; cursor: pointer; }
.ap .lsn-pic::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse at center, #000a 0%, #000d 100%); }
.ap .lsn-pic.baked::before { display: none; }
.ap .lsn-st { position: absolute; inset: 0; display: flex; flex-wrap: wrap; align-items: center; justify-content: center; align-content: center; gap: 6px 10px; padding: 10px; box-sizing: border-box; }
.ap .lsn-h { margin: 2px 0 0; text-align: center; font-family: var(--display); font-size: 24px; color: #ffe08a; letter-spacing: 1px; text-shadow: 0 2px 0 #000; }
.ap .lsn-ln { margin: 0; text-align: center; font-size: 15px; color: #ece2cf; min-height: 1.45em; }
.ap .lsn-ln.why { color: #ffb49c; font-weight: 700; }
.ap .lsn-go { align-self: center; min-width: 60%; padding: 11px 18px; border-radius: 12px; border: 2px solid #ffd27a; background: radial-gradient(ellipse at top, #7a5414, #3a260c); color: #fff2cc; font-size: 17px; font-weight: 800; cursor: pointer; box-shadow: 0 4px 12px #000a; }
.ap .lsn-go:disabled { border-color: #6a5a40; background: #2a2016; color: #a99a7c; font-size: 14px; }
.ap .lsn-nav { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-top: 8px; }
.ap .lsn-nav button { width: 40px; height: 34px; border-radius: 10px; border: 1px solid #6a5232; background: #0005; color: #f0e2c0; font-size: 22px; line-height: 1; cursor: pointer; }
.ap .lsn-nav button:disabled { opacity: .3; }
.ap .lsn-dots { display: flex; gap: 7px; align-items: center; }
.ap .lsn-dots i { width: 9px; height: 9px; border-radius: 50%; background: #6a5a40; cursor: pointer; }
.ap .lsn-dots i.why { background: #a8402c; }
.ap .lsn-dots i.on { background: #ffd27a; transform: scale(1.35); }
.ap .lsn-dots i.why.on { background: #ff7a5a; }

/* 그림 짜기 — 병사·물건·깃발을 늘어놓는다 */
.ap .lsn-col { position: relative; display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 0; }
.ap .lsn-crowd { display: flex; align-items: flex-end; }
.ap .lsn-crowd img { width: 46px; height: 46px; object-fit: contain; margin-left: -18px; filter: drop-shadow(0 2px 2px #000c); }
.ap .lsn-crowd img:first-child { margin-left: 0; }
.ap .lsn-crowd.foe img { transform: scaleX(-1); filter: drop-shadow(0 0 3px #ff5a3a) drop-shadow(0 2px 2px #000c); }
.ap .lsn-big { width: 74px; height: 74px; object-fit: contain; filter: drop-shadow(0 3px 4px #000c); }
.ap .lsn-big.sm { position: absolute; width: 40px; height: 40px; right: -14px; top: 30px; }
.ap .lsn-big.mid { width: 60px; height: 60px; }
.ap .lsn-big.foe { filter: drop-shadow(0 0 4px #ff5a3a) drop-shadow(0 3px 4px #000c); }
.ap .lsn-big.town { width: 86px; height: 86px; }
.ap .lsn-tag { padding: 2px 8px; border-radius: 6px; background: #000b; border: 1px solid #8a7450; color: #f0e2c0; font-size: 13px; white-space: nowrap; }
.ap .lsn-tag.good { border-color: #8fd07a; color: #c8f0b4; } .ap .lsn-tag.bad { border-color: #e08a74; color: #ffc2b0; } .ap .lsn-tag.foe { border-color: #ff7a5a; color: #ffd0c0; }
.ap .lsn-vs, .ap .lsn-ar { font-style: normal; font-size: 26px; color: #ffd27a; text-shadow: 0 2px 0 #000; }
.ap .lsn-ar { animation: lsnNudge 1s ease-in-out infinite; }
@keyframes lsnNudge { 0%, 100% { translate: 0 0; } 50% { translate: 5px 0; } }
.ap .lsn-em { position: absolute; top: -26px; width: 26px; height: 26px; }
.ap .lsn-plus { flex-basis: 100%; display: flex; align-items: center; justify-content: center; gap: 4px; color: #c8f0b4; font-size: 22px; font-weight: 800; }
.ap .lsn-plus .lsn-crowd img { width: 34px; height: 34px; margin-left: -12px; }
.ap .lsn-plus .lsn-crowd img:first-child { margin-left: 0; }
.ap .lsn-fog { position: relative; display: flex; padding: 4px 6px; border-radius: 10px; background: #8a8a8a55; }
.ap .lsn-fog:not(.clear) .lsn-crowd { opacity: .25; }
.ap .lsn-fog.clear { background: #8fd07a22; box-shadow: 0 0 0 1px #8fd07a; }
.ap .lsn-q { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-style: normal; font-size: 34px; font-weight: 800; color: #ffd27a; text-shadow: 0 2px 0 #000; }
.ap .lsn-row3 { display: flex; gap: 12px; }
.ap .lsn-sub { flex-basis: 100%; display: flex; justify-content: center; gap: 8px; }
.ap .lsn-col.side .lsn-crowd img { width: 40px; height: 40px; margin-left: -16px; }
.ap .lsn-col.flip .lsn-crowd { transform: scaleX(-1); }
.ap .lsn-arr { font-style: normal; font-size: 26px; color: #ffd27a; text-shadow: 0 2px 0 #000; animation: lsnNudge 1s ease-in-out infinite; }
.ap .lsn-col.flip .lsn-arr { transform: scaleX(-1); }
.ap .lsn-tri { position: relative; width: 230px; height: 176px; }
.ap .lsn-fl { position: absolute; display: flex; flex-direction: column; align-items: center; gap: 2px; }
.ap .lsn-fl img { width: 52px; height: 63px; filter: drop-shadow(0 3px 4px #000c); }
.ap .lsn-fl b { padding: 1px 6px; border-radius: 6px; background: #000b; font-size: 12.5px; color: #f0e2c0; white-space: nowrap; }
.ap .lsn-fl.t { left: 50%; top: 0; translate: -50% 0; } .ap .lsn-fl.r { right: 0; bottom: 0; } .ap .lsn-fl.l { left: 0; bottom: 0; }
.ap .lsn-tsv { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.ap .lsn-tsv path:not([fill]) { fill: none; stroke: #ffd27a; stroke-width: 5; stroke-linecap: round; filter: drop-shadow(0 2px 1px #000); }
`
