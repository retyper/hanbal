/**
 * 「다음 달」 지도 연출 — 보고판보다 먼저, 지도 위에서 지난 한 달이 펼쳐진다
 * (형 11-22: "모바일 게임치고 본게임이 너무 정적인데 … 자극적인 인스턴트 먹다가 풀뜯어먹는 기분" · VISION §1 M2·M4 "결과가 나오는 순간은 늘 연출").
 *
 * 차례: (가) 이번 달 움직인 군대가 옛 자리에서 새 자리까지 길을 따라 걷는다 — 우리 군대는 이끄는 장수의 걷기 띠 + 군기, 적은 그 말
 *       (나) 싸움 — 그 고을에 불꽃이 터지고, 결과가 선다(이미 있는 연출: 우리 깃발 꽂힘 · 불과 연기 · 지켜 낸 방패). 치다 진 군대는 돌아간다
 *       (다) 거둔 것 — 철광·포구에서 거둔 「+n」(이미 있는 것) · 가을걷이 · 새 군사 · 새 마을이 고을 위로 떠오른다
 *       (라) 새 위협 — 우리 고을로 오는 적이 새로 보이면 그 고을에 붉은 고리가 숨 쉰다
 * 그다음 보고판. 누르거나 아무 키나 치면 바로 끝 상태로 · 숨은 탭이 되면 곧바로 끝낸다 (절대 규칙 4).
 *
 * 판은 이미 넘어갔다 — 여기는 그리기만 한다 (before · after 를 읽기만). 지도는 이미 새 판으로 그려져 있고, 연출이 끝날 때까지
 * 걷는 군대의 말 · 싸움 결과 표 · 거둔 표를 잠깐 감춰 두었다가 그 박자에 드러낸다.
 * 움직임은 transform · opacity 뿐 (걷기는 Web Animations · 그림띠는 translate steps) — 폰 그래픽 한도 (메모리 mobile-gpu-layer-limit).
 */
import type { Army, Realm, ReportLine } from '../../realm/types.ts'
import { P } from '../../tune/params.ts'
import { trimPolyline, type Pt } from './mapgeo.ts'

/** 길 위에 선 말의 자리 — 떠난 고을에서 길이의 몫 (mapview: trimPolyline 0.28~0.4 의 가운데) */
const ROAD_F = 0.34
/** 고을을 치는 군대가 멈춰 서는 자리 — 그 길의 몫 (고을 그림 바로 앞) */
const NEAR_F = 0.78
/** 걷는 길을 고르게 나눈 마디 수 — 같은 빠르기로 걷게 */
const STEPS = 18

export interface TpSquad { readonly src: string; readonly ar: number; readonly r?: number; readonly m?: boolean; readonly general?: boolean }
/** 걷는 군대의 생김 — 지도 말과 같은 그림띠(mapSquad) · 군기 빛 */
export interface TpLook { readonly squad: readonly TpSquad[]; readonly c: string; readonly c2: string }
/** 군대가 선 곳 — 고을, 또는 길 위 (from → to 의 몫 f) */
export type TpLoc = { readonly node: string } | { readonly from: string; readonly to: string; readonly f: number }
/** 한 토막 걸음 — 지도 몫 좌표(0..1) · 두 끝이 고을 자리인가 길 위 자리인가 (말이 서는 자리가 다르다) */
export interface TpLeg { readonly pts: readonly Pt[]; readonly a: 'node' | 'road'; readonly b: 'node' | 'road' }
export interface TpWalk {
  readonly army: string
  readonly foe: boolean
  readonly look: TpLook
  /** 이번 달 걸은 길 (싸우러 갔으면 그 고을 앞까지) */
  readonly go: TpLeg | null
  /** 치다 물러나 돌아간 길 */
  readonly back: TpLeg | null
  /** 이 군대가 친 싸움 (clashes 의 차례 · 없으면 -1) */
  readonly clash: number
  /** 싸움에서 흩어져 없어진 군대 — 불꽃과 함께 스러진다 */
  readonly gone: boolean
  /** 이 걸음이 보여 준 보고 줄 (닿았다) */
  readonly lines: readonly ReportLine[]
}
export type TpResult = 'taken' | 'burn' | 'held' | 'none'
export interface TpClash { readonly node: string; readonly at: Pt; readonly field: boolean; readonly result: TpResult; readonly ours: boolean; readonly line: ReportLine }
export interface TpItem { readonly icon: string; readonly n: number }
export interface TpGood { readonly node: string; readonly at: Pt; readonly items: readonly TpItem[]; /** 철광·포구에서 거둔 것 — 지도에 이미 있는 「+n」 표를 그 박자에 드러낸다 */ readonly haul: boolean; readonly line: ReportLine }
export interface TpMark { readonly node: string; readonly at: Pt }
export interface TurnPlan { readonly walks: readonly TpWalk[]; readonly clashes: readonly TpClash[]; readonly goods: readonly TpGood[]; readonly marks: readonly TpMark[] }

/** 지도 모양 — 고을 자리 · 두 고을 사이 길(a → b 방향) · 모두 지도 몫 좌표 */
export interface TpGeo {
  pos(id: string): Pt | undefined
  route(a: string, b: string): readonly Pt[] | null
}

export interface TpInput {
  readonly before: Realm
  readonly after: Realm
  readonly lines: readonly ReportLine[]
  readonly me: string
  readonly geo: TpGeo
  /** 그 고을이 보이나 (안개 · 넓어지는 지도) */
  readonly seen: (node: string) => boolean
  /** 그 줄의 나라를 다 아나 (모르는 나라 이야기는 들리지 않는다) */
  readonly heard: (l: ReportLine) => boolean
  /** 보여도 되는 남의 군대 (척후·첩자가 본 것 · 우리와 싸운 것) */
  readonly foes: ReadonlySet<string>
  readonly look: (a: Army, r: Realm) => TpLook
  /** 거둔 것 한 줄 → 어느 고을 위에 무엇을 (우리 것만) */
  readonly goods: (l: ReportLine) => { readonly node: string; readonly items: readonly TpItem[]; readonly haul?: boolean } | null
  /** 이번 달 새로 위협받는 우리 고을 */
  readonly threats: readonly string[]
}

const locOf = (a: Army): TpLoc => (a.march !== null ? { from: a.march.from, to: a.march.to, f: ROAD_F } : { node: a.at })
const isNode = (l: TpLoc): l is { readonly node: string } => 'node' in l
const lenOf = (p: readonly Pt[]): number => { let s = 0; for (let i = 1; i < p.length; i++) s += Math.hypot(p[i]![0] - p[i - 1]![0], p[i]![1] - p[i - 1]![1]); return s }

/** s 에서 e 까지 지도 몫 좌표의 꺾은선 — 길을 따라 (길이 없으면 곧게). 못 그리거나 거의 안 움직였으면 null */
export function pathOf(geo: TpGeo, s: TpLoc, e: TpLoc): Pt[] | null {
  const seg = (a: string, b: string, f0: number, f1: number): Pt[] | null => {
    const r = geo.route(a, b)
    if (r !== null && r.length >= 2) return f0 <= f1 ? trimPolyline(r, f0, f1) : trimPolyline([...r].reverse(), 1 - f0, 1 - f1)
    const p = geo.pos(a)
    const q = geo.pos(b)
    if (p === undefined || q === undefined) return null
    const at = (t: number): Pt => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]
    return [at(f0), at(f1)]
  }
  const out: Pt[] = []
  const add = (p: readonly Pt[] | null): boolean => {
    if (p === null) return false
    for (const q of p) { const l = out[out.length - 1]; if (l === undefined || Math.hypot(l[0] - q[0], l[1] - q[1]) > 1e-6) out.push(q) }
    return true
  }
  const done = (): Pt[] | null => (out.length >= 2 && lenOf(out) > 1e-3 ? out : null)
  let cur: string
  if (isNode(s)) {
    const p = geo.pos(s.node)
    if (p === undefined) return null
    out.push(p)
    cur = s.node
  } else {
    // 같은 길 위에서 — 앞으로 · 거꾸로 · 떠난 고을로 돌아감
    if (!isNode(e) && e.from === s.from && e.to === s.to) return add(seg(s.from, s.to, s.f, e.f)) ? done() : null
    if (!isNode(e) && e.from === s.to && e.to === s.from) return add(seg(s.from, s.to, s.f, 1 - e.f)) ? done() : null
    if (isNode(e) && e.node === s.from) return add(seg(s.from, s.to, s.f, 0)) ? done() : null
    if (!add(seg(s.from, s.to, s.f, 1))) return null
    cur = s.to
  }
  if (isNode(e)) {
    if (e.node !== cur && !add(seg(cur, e.node, 0, 1))) return null
    return done()
  }
  if (e.to === cur) return add(seg(e.to, e.from, 0, 1 - e.f)) ? done() : null // 그 길에 거꾸로 들어선다
  if (e.from !== cur && !add(seg(cur, e.from, 0, 1))) return null
  return add(seg(e.from, e.to, 0, e.f)) ? done() : null
}

const legOf = (geo: TpGeo, s: TpLoc, e: TpLoc): TpLeg | null => {
  const pts = pathOf(geo, s, e)
  return pts === null ? null : { pts, a: isNode(s) ? 'node' : 'road', b: isNode(e) ? 'node' : 'road' }
}

/** 싸우러 간 군대가 멈춰 서는 곳 — 그 고을로 드는 길 끝 (들판 싸움이면 그 길 가운데) */
function approach(r: Realm, geo: TpGeo, s: TpLoc, l: Extract<ReportLine, { kind: 'battle' }>): TpLoc {
  const B = l.node
  const edge = (a: string, b: string): boolean => geo.route(a, b) !== null
  if (l.field === true && l.edge !== undefined) {
    const ed = r.edges[l.edge]
    if (ed !== undefined) {
      if (!isNode(s) && ((s.from === ed.a && s.to === ed.b) || (s.from === ed.b && s.to === ed.a))) return { from: s.from, to: s.to, f: 0.5 }
      if (isNode(s) && (s.node === ed.a || s.node === ed.b)) return { from: s.node, to: s.node === ed.a ? ed.b : ed.a, f: 0.5 }
      return { from: ed.a, to: ed.b, f: 0.5 }
    }
  }
  if (!isNode(s)) {
    if (s.to === B) return { from: s.from, to: B, f: Math.max(s.f, NEAR_F) }
    if (edge(s.to, B)) return { from: s.to, to: B, f: NEAR_F }
  } else {
    if (s.node === B) return { node: B }
    if (edge(s.node, B)) return { from: s.node, to: B, f: NEAR_F }
  }
  return { node: B }
}

/**
 * 한 달의 연출 차례 — 판을 읽기만 한다. 보이는 싸움 · 걸은 군대(우리 것과 보인 적) · 우리가 거둔 것 · 새 위협.
 * 화면 밖으로 빠진 것은 틀는 쪽(playTurn)이 거른다
 */
export function planTurn(x: TpInput): TurnPlan {
  const { before, after, me, geo } = x
  const clashes: TpClash[] = []
  const lineOf: Array<Extract<ReportLine, { kind: 'battle' }>> = []
  const atkOf = new Map<string, number>()
  for (const l of x.lines) {
    if (l.kind !== 'battle' || !x.seen(l.node) || !x.heard(l)) continue
    let at: Pt | undefined
    if (l.field === true && l.edge !== undefined) {
      const ed = after.edges[l.edge] ?? before.edges[l.edge]
      const rt = ed !== undefined ? geo.route(ed.a, ed.b) : null
      if (rt !== null && rt.length >= 2) at = trimPolyline(rt, 0.5, 0.5)[0]
    }
    at ??= geo.pos(l.node)
    if (at === undefined) continue
    const atkWon = l.outcome === 'win' || l.outcome === 'rout'
    const owner = after.nodes[l.node]?.owner ?? null
    // 지도의 표와 같은 셈 (app mapPart: 들판 싸움은 표가 없다 · 빼앗았으면 우리 깃발 아니면 불 · 지켜 냈으면 방패)
    const result: TpResult = l.field === true ? 'none'
      : atkWon && owner === l.atkFaction ? (l.atkFaction === me ? 'taken' : 'burn')
        : !atkWon && l.defender === me && owner === me ? 'held' : 'none'
    const i = clashes.length
    clashes.push({ node: l.node, at, field: l.field === true, result, ours: l.atkFaction === me || l.defender === me, line: l })
    lineOf.push(l)
    for (const id of [l.attacker, ...l.allies]) if (!atkOf.has(id)) atkOf.set(id, i)
  }
  const walks: TpWalk[] = []
  const ids = [...new Set([...Object.keys(before.armies), ...Object.keys(after.armies)])].sort()
  for (const id of ids) {
    const a0 = before.armies[id]
    const a1 = after.armies[id]
    if (a0 === undefined) continue // 새로 선 군대 — 걷지 않고 그 자리에 선다 (새 군사 표가 떠오른다)
    const a = a1 ?? a0
    const ours = a.faction === me
    if (!ours && !x.foes.has(id)) continue
    const s = locOf(a0)
    const e = a1 !== undefined ? locOf(a1) : null
    const ci = atkOf.get(id) ?? -1
    let go: TpLeg | null = null
    let back: TpLeg | null = null
    if (ci >= 0) {
      const c = clashes[ci]!
      const ap = approach(after.edges[lineOf[ci]!.edge ?? ''] !== undefined ? after : before, geo, s, lineOf[ci]!)
      if (e !== null && !c.field && isNode(e) && e.node === c.node) go = legOf(geo, s, e) // 쳐서 들어앉았다
      else {
        go = legOf(geo, s, ap)
        if (e !== null) back = legOf(geo, ap, e)
      }
    } else if (e !== null) go = legOf(geo, s, e)
    if (go === null && back === null) continue
    walks.push({ army: id, foe: !ours, look: x.look(a, a1 !== undefined ? after : before), go, back, clash: ci, gone: a1 === undefined, lines: x.lines.filter((l) => l.kind === 'arrive' && l.army === id) })
  }
  // 우리 군대부터 (한 번에 걷는 수를 넘으면 뒤의 것이 빠진다)
  walks.sort((p, q) => Number(p.foe) - Number(q.foe) || (p.army < q.army ? -1 : p.army > q.army ? 1 : 0))
  const goods: TpGood[] = []
  for (const l of x.lines) {
    const g = x.goods(l)
    if (g === null || !x.seen(g.node)) continue
    const at = geo.pos(g.node)
    if (at === undefined) continue
    goods.push({ node: g.node, at, items: g.items, haul: g.haul === true, line: l })
  }
  const marks: TpMark[] = []
  for (const n of x.threats) { const at = geo.pos(n); if (at !== undefined && x.seen(n)) marks.push({ node: n, at }) }
  return { walks, clashes, goods, marks }
}

/** 박자 — 모두 ms · 연출이 시작한 때부터 (-1 은 없음) · k 는 줄인 몫(가장 긴 시간을 넘으면 1 보다 작다) */
export interface TpTimes {
  readonly walkAt: readonly number[]
  readonly walkMs: number
  readonly backAt: readonly number[]
  readonly backMs: number
  readonly clashAt: readonly number[]
  readonly goodAt: readonly number[]
  readonly markAt: readonly number[]
  readonly end: number
  readonly k: number
}

/** 차례를 박자로 — 걷기(다 같이 · 조금씩 어긋나게) → 싸움 하나씩 → 거둔 것 하나씩 → 위협 고리. 아무것도 없으면 짧은 쉼 */
export function timeline(plan: TurnPlan, lead: number): TpTimes {
  const R = P.realm
  const sp = Math.max(0.1, R.tpSpeed)
  const ms = (v: number): number => v / sp
  const walkMs = ms(R.tpWalkMs)
  const backMs = ms(R.tpWalkBackMs)
  const stag = ms(R.tpStaggerMs)
  let n = 0
  const walkAt = plan.walks.map((w) => (w.go !== null ? lead + n++ * stag : -1))
  const goEnd = Math.max(lead, ...plan.walks.map((w, i) => (w.go !== null ? walkAt[i]! + walkMs : lead)))
  const clashAt = plan.clashes.map((_, j) => goEnd + (j === 0 && n === 0 ? 0 : ms(R.tpClashGapMs) * (j + (n > 0 ? 0.25 : 0))))
  // 돌아가는 걸음 — 그 싸움의 결과가 선 뒤 (싸움이 화면 밖이면 걸음을 마치고 한 박자 뒤)
  const backAt = plan.walks.map((w, i) => (w.back === null ? -1
    : w.clash >= 0 ? clashAt[w.clash]! + ms(R.tpResultMs) + ms(R.tpClashGapMs) * 0.5
      : (walkAt[i]! >= 0 ? walkAt[i]! + walkMs : lead) + ms(R.tpResultMs)))
  const lastClash = clashAt.length > 0 ? clashAt[clashAt.length - 1]! : -1
  const tG = lastClash >= 0 ? lastClash + ms(R.tpResultMs) + ms(R.tpGoodGapMs) : goEnd
  const goodAt = plan.goods.map((_, i) => tG + i * ms(R.tpGoodGapMs))
  const tM = tG + plan.goods.length * ms(R.tpGoodGapMs)
  const markAt = plan.marks.map((_, i) => tM + i * ms(R.tpMarkGapMs))
  const ends = [
    goEnd,
    ...backAt.filter((t) => t >= 0).map((t) => t + backMs),
    ...clashAt.map((t) => t + ms(R.tpClashMs)),
    ...goodAt.map((t) => t + ms(R.tpGoodMs)),
    ...markAt.map((t) => t + ms(R.tpMarkMs)),
  ]
  const busy = plan.walks.length + plan.clashes.length + plan.goods.length + plan.marks.length > 0
  const raw = busy ? Math.max(...ends) + ms(R.tpTailMs) : lead + ms(R.tpQuietMs)
  if (raw <= R.tpMaxMs || raw <= lead) return { walkAt, walkMs, backAt, backMs, clashAt, goodAt, markAt, end: raw, k: 1 }
  // 너무 길다 — 처음 쉼은 두고 그 뒤를 고르게 줄인다
  const k = Math.max(0.2, (R.tpMaxMs - lead) / (raw - lead))
  const sq = (t: number): number => (t < 0 ? t : lead + (t - lead) * k)
  return { walkAt: walkAt.map(sq), walkMs: walkMs * k, backAt: backAt.map(sq), backMs: backMs * k, clashAt: clashAt.map(sq), goodAt: goodAt.map(sq), markAt: markAt.map(sq), end: R.tpMaxMs, k }
}

// ───────── 틀기 (DOM)

export interface TpHost {
  readonly root: HTMLElement
  readonly art: string
  /** 고을에 머무는 말 줄이 고을 한가운데서 비켜 서는 몫 (mapview tokAnchorDx) */
  readonly tokDx: number
  /** 저사양 · 움직임 줄이기 — 페이드만 */
  readonly short: boolean
  /** 첫 박자까지 (계절 띠가 뜬 달은 길게) */
  readonly lead: number
  /** 「누르면 넘어갑니다」 */
  readonly hint: string
  readonly sound: (what: 'clash' | 'coin', vol: number) => void
  /** 끝났다 (다 돌았거나 · 눌러 건너뛰었거나 · 탭이 숨었거나) — 한 번만 */
  readonly onEnd: (shown: ReadonlySet<ReportLine>) => void
}

export interface TurnPlayer {
  /** 바로 끝 상태로 */
  finish(): void
  /** 지도를 다시 깔았으면(morph) 연출 층을 다시 붙인다 */
  attach(map: Element | null): void
  /** 지도에서 이미 보여 준 보고 줄 — 보고판이 다시 적지 않는다 */
  readonly shown: ReadonlySet<ReportLine>
  readonly active: () => boolean
}

const HIDE_MARKS = ':is(.burnsm, .burnfx, .plant, .wonring, .wonchip, .heldchip)'
const esc = (s: string): string => (typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(s) : s.replace(/["\\]/g, '\\$&'))
/** 지도 바깥 둘레 — 화면에서 이만큼 벗어나도 보이는 것으로 친다 (px) */
const EDGE_PAD = 40

/** 꺾은선을 같은 길이 마디로 — 같은 빠르기로 걷게 */
function resample(p: readonly Pt[], n: number): Pt[] {
  if (p.length < 2) return [...p]
  const out: Pt[] = []
  for (let i = 0; i <= n; i++) out.push(trimPolyline(p, i / n, i / n)[0]!)
  return out
}

export function playTurn(plan: TurnPlan, host: TpHost): TurnPlayer {
  const { root } = host
  const shown = new Set<ReportLine>()
  let done = false
  const timers: number[] = []
  const map = root.querySelector<HTMLElement>('.mapwrap .map')
  const wrap = root.querySelector<HTMLElement>('.mapwrap')
  const layer = document.createElement('div')
  layer.className = 'tply'
  layer.setAttribute('aria-hidden', 'true')
  const hint = document.createElement('div')
  hint.className = 'tply-hint'
  hint.textContent = host.hint
  // 감추기는 그 요소에 data-tph 만 단다 (규칙은 TURNPLAY_CSS 에 붙박이) — 스타일시트 글을 바꾸면 문서 전체의 꼴을 다시 셈해
  // 폰 4배 느림에서 한 번에 120ms 가 걸렸다. 지도를 고쳐 깔아(morph) 속성이 지워지면 그 표는 조금 일찍 보일 뿐이다
  const hides = new Map<string, Element[]>()
  const hide = (key: string, els: Iterable<Element>, kind: 'w' | 's' | 'd'): void => {
    const list = [...els]
    for (const e of list) e.setAttribute('data-tph', kind)
    if (list.length > 0) hides.set(key, list)
  }
  const reveal = (key: string): void => {
    const list = hides.get(key)
    if (list === undefined) return
    hides.delete(key)
    for (const e of list) e.removeAttribute('data-tph')
  }
  const at = (t: number, f: () => void): void => { timers.push(window.setTimeout(() => { if (!done) f() }, Math.max(0, t))) }

  let swallowUntil = 0
  const onDown = (): void => { swallowUntil = performance.now() + 600; finish() }
  const onKey = (e: KeyboardEvent): void => { e.stopPropagation(); e.preventDefault(); finish() }
  const onClick = (e: MouseEvent): void => {
    if (performance.now() > swallowUntil) return
    swallowUntil = 0
    e.stopPropagation()
    e.preventDefault()
  }
  const onHide = (): void => { if (document.visibilityState !== 'visible') finish() }
  const unlisten = (): void => {
    removeEventListener('pointerdown', onDown, true)
    removeEventListener('keydown', onKey, true)
    removeEventListener('wheel', onDown, true)
    document.removeEventListener('visibilitychange', onHide)
  }

  function finish(): void {
    if (done) return
    done = true
    for (const t of timers) window.clearTimeout(t)
    timers.length = 0
    unlisten()
    // 건너뛴 누름의 click 은 먹는다 — 그 손가락이 「다음 달」을 또 누르지 않게. 잠깐 뒤 스스로 걷는다
    if (swallowUntil > performance.now()) window.setTimeout(() => removeEventListener('click', onClick, true), 650)
    else removeEventListener('click', onClick, true)
    for (const k of [...hides.keys()]) reveal(k)
    layer.remove()
    hint.remove()
    root.classList.remove('tply-on')
    host.onEnd(shown)
  }

  const player: TurnPlayer = {
    finish,
    attach(m) { if (!done && m !== null && layer.parentElement !== m) m.append(layer) },
    shown,
    active: () => !done,
  }
  if (map === null || wrap === null || document.visibilityState !== 'visible') { finish(); return player }

  addEventListener('pointerdown', onDown, true)
  addEventListener('keydown', onKey, true)
  addEventListener('wheel', onDown, { capture: true, passive: true })
  addEventListener('click', onClick, true)
  document.addEventListener('visibilitychange', onHide)
  root.classList.add('tply-on')
  map.append(layer)
  if (!host.short) root.append(hint) // 짧은 판은 1초 안에 끝난다 — 안내가 뜰 틈이 없다

  // 자리 재기 — 지도 판의 px (확대해도 지도 안의 좌표는 그대로) · 말 하나를 재서 걷는 군대를 같은 크기 · 같은 자리에 세운다
  const mw = map.offsetWidth || 1
  const mh = map.offsetHeight || 1
  const mr = map.getBoundingClientRect()
  const sc = mr.width / mw || 1
  const wr = wrap.getBoundingClientRect()
  const tk = map.querySelector<HTMLElement>('.tok.unit')
  const tkr = tk?.getBoundingClientRect()
  const sqr = tk?.querySelector('.squad')?.getBoundingClientRect()
  const tokW = tkr !== undefined && tkr.width > 1 ? tkr.width / sc : 42
  const colH = tkr !== undefined && tkr.height > 1 ? tkr.height / sc : 86
  const H = sqr !== undefined && sqr.height > 1 ? sqr.height / sc : 66
  const offNode: Pt = [host.tokDx * mw + 2 + tokW / 2, -colH / 2 + H]
  const offRoad: Pt = [0, -colH / 2 + H]
  const px = (p: Pt, off: Pt = [0, 0]): Pt => [p[0] * mw + off[0], p[1] * mh + off[1]]
  const onScreen = (q: Pt): boolean => {
    const x = mr.left + q[0] * sc
    const y = mr.top + q[1] * sc
    return x >= wr.left - EDGE_PAD && x <= wr.right + EDGE_PAD && y >= wr.top - EDGE_PAD && y <= wr.bottom + EDGE_PAD
  }
  /** 한 토막 걸음의 px 마디 — 두 끝의 말 자리가 다르면(고을 ↔ 길 위) 그 사이를 고르게 잇는다 */
  const legPx = (l: TpLeg): Pt[] => {
    const a = l.a === 'node' ? offNode : offRoad
    const b = l.b === 'node' ? offNode : offRoad
    const pts = resample(l.pts, STEPS)
    return pts.map((p, i) => { const t = i / (pts.length - 1); return px(p, [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]) })
  }

  // 화면 밖은 거른다 — 카메라는 그대로 (형이 보는 곳만) · 거른 것은 처음부터 지도에 그대로 보인다
  const walkPx = plan.walks.map((w) => ({ w, go: w.go !== null ? legPx(w.go) : null, back: w.back !== null ? legPx(w.back) : null }))
  const ends = (p: Pt[] | null): Pt[] => (p === null ? [] : [p[0]!, p[p.length - 1]!])
  const clashes = plan.clashes.filter((c) => onScreen(px(c.at)))
  const keepC = new Set(clashes)
  const walks = walkPx.filter((x) => [...ends(x.go), ...ends(x.back)].some(onScreen)).slice(0, Math.max(1, Math.round(P.realm.tpMaxWalkers)))
    .map((x) => ({ ...x, clash: x.w.clash >= 0 && keepC.has(plan.clashes[x.w.clash]!) ? clashes.indexOf(plan.clashes[x.w.clash]!) : -1 }))
  const goods = plan.goods.filter((g) => onScreen(px(g.at)))
  const marks = plan.marks.filter((m) => onScreen(px(m.at)))
  const sub: TurnPlan = { walks: walks.map((x) => ({ ...x.w, clash: x.clash })), clashes, goods, marks }
  const T = timeline(sub, host.lead)
  // 불꽃 · 거둔 것 그림을 미리 푼다 (decode 는 메인 스레드 밖) — 터지는 그 프레임에 그림을 푸느라 멈추지 않게
  const warm = [...(clashes.length > 0 ? ['fx/impact.png', 'fx/strike-burst.svg', 'icon/war-melee.png'] : []), ...goods.flatMap((g) => g.items.map((it) => `icon/${it.icon}.png`))]
  for (const f of new Set(warm)) { const im = new Image(); im.src = host.art + f; im.decode().catch(() => undefined) }

  // 그 박자까지 감춘다 — 걷는 군대의 말 · 싸움 결과 표 · 거둔 표
  // 짧은 판은 새 자리의 말이 스며든다 (opacity · .tply-on 동안 transition) · 긴 판은 걷는 군대가 닿을 때 그 자리에 선다
  for (const x of walks) {
    if (x.w.gone) continue
    const els = [...map.querySelectorAll(`.tok[data-army="${esc(x.w.army)}"]`)].map((t) => (t.parentElement?.matches('.toks.mv') === true ? t.parentElement : t))
    hide(`w:${x.w.army}`, els, host.short ? 's' : 'w')
  }
  for (const c of clashes) if (c.result !== 'none') hide(`c:${c.node}`, map.querySelectorAll(`.nd[data-node="${esc(c.node)}"] > ${HIDE_MARKS}`), 'd')
  for (const g of goods) if (g.haul) hide(`g:${g.node}`, map.querySelectorAll(`.nd[data-node="${esc(g.node)}"] > .haulchip`), 'd')

  const D = (v: number): number => (v / Math.max(0.1, P.realm.tpSpeed)) * T.k
  const tokReveal = (id: string): void => reveal(`w:${id}`)
  const fadeOut = (el: HTMLElement, ms: number, drop = false): void => {
    el.animate([{ opacity: 1, translate: '0 0' }, { opacity: 0, translate: drop ? '0 18px' : '0 0' }], { duration: ms, fill: 'forwards', easing: 'ease-in' })
  }
  const showLines = (ls: readonly ReportLine[]): void => { for (const l of ls) shown.add(l) }

  if (host.short) {
    // 저사양 · 움직임 줄이기 — 걷기 · 불꽃 없이 새 자리가 스며들고 표가 선다
    const S = P.realm.tpShortMs
    const t1 = host.lead + S * 0.15
    const t2 = host.lead + S * 0.35
    for (const x of walks) at(t1, () => { tokReveal(x.w.army); showLines(x.w.lines) })
    at(t2, () => {
      for (const c of clashes) { reveal(`c:${c.node}`); shown.add(c.line) }
      for (const g of goods) { if (g.haul) reveal(`g:${g.node}`); else layer.append(goodEl(g, true)); shown.add(g.line) }
      for (const m of marks) layer.append(markEl(m, true))
    })
    at(host.lead + S, finish)
    return player
  }

  // 걷는 군대
  walks.forEach((x, i) => {
    const w = x.w
    const sq = w.look.squad[0]
    if (sq === undefined || (x.go === null && x.back === null)) { tokReveal(w.army); return }
    const ww = H * sq.ar
    const el = document.createElement('div')
    el.className = `tply-w${w.foe ? ' foe' : ''}`
    el.style.cssText = `width:${ww.toFixed(1)}px;height:${H.toFixed(1)}px;--tc:${w.look.c};--tc2:${w.look.c2}`
    const k = ((([...w.army].reduce((h, ch) => h * 31 + ch.charCodeAt(0), 7)) % 97) + 97) % 97 / 97
    el.innerHTML = `<i class="tply-fl"></i><i class="tply-b"><i class="tply-sq${sq.r !== undefined ? ' v2' : ''}${sq.m === true ? ' mg' : ''}" style="--ar:${sq.ar.toFixed(3)};${sq.r !== undefined ? `--r:${sq.r.toFixed(3)};` : ''}--k:${k.toFixed(2)}"><u style="background-image:url('${sq.src}')"></u></i></i>`
    // 같은 길을 함께 걷는 군대가 한 몸으로 겹치지 않게 옆으로 조금씩
    const jx = ((i % 3) - 1) * ww * 0.35
    const tr = (p: Pt): string => `translate(${(p[0] - ww / 2 + jx).toFixed(1)}px, ${(p[1] - H).toFixed(1)}px)`
    const faceLeft = (p: Pt[]): boolean => p[p.length - 1]![0] < p[0]![0] - 0.5
    const first = x.go ?? x.back!
    el.style.transform = tr(first[0]!)
    el.classList.toggle('flip', faceLeft(first))
    const t0 = x.go !== null ? T.walkAt[i]! : x.clash >= 0 ? T.clashAt[x.clash]! : x.back !== null ? T.backAt[i]! : host.lead
    el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, delay: t0, fill: 'backwards' })
    layer.append(el)
    const move = (pts: Pt[], t: number, ms: number): void => {
      el.animate(pts.map((p, j) => ({ transform: tr(p), offset: j / (pts.length - 1) })), { duration: ms, delay: t, fill: 'forwards', easing: 'linear' })
    }
    if (x.go !== null) move(x.go, T.walkAt[i]!, T.walkMs)
    const stand = (t: number): void => at(t, () => { el.classList.add('rest') })
    const arrive = (t: number): void => at(t, () => { tokReveal(w.army); showLines(w.lines); fadeOut(el, 220) })
    const goBack = (): void => {
      const bt = T.backAt[i]!
      at(bt, () => { el.classList.remove('atk', 'rest'); el.classList.toggle('flip', faceLeft(x.back!)) })
      move(x.back!, bt, T.backMs)
      arrive(bt + T.backMs)
    }
    if (x.clash >= 0) {
      const ct = T.clashAt[x.clash]!
      if (x.go !== null) stand(T.walkAt[i]! + T.walkMs)
      at(ct, () => { el.classList.remove('rest'); el.classList.add('atk') })
      if (w.gone) at(ct + D(P.realm.tpResultMs), () => fadeOut(el, D(500), true))
      else if (x.back !== null) goBack()
      else arrive(ct + D(P.realm.tpResultMs) + 120)
    } else if (x.back !== null) {
      if (x.go !== null) stand(T.walkAt[i]! + T.walkMs)
      goBack()
    } else arrive(x.go !== null ? T.walkAt[i]! + T.walkMs : host.lead)
  })

  // 싸움 — 불꽃 · 칼 둘이 맞부딪고 · 결과가 선다
  clashes.forEach((c, j) => {
    const t = T.clashAt[j]!
    at(t, () => {
      const [x, y] = px(c.at)
      const el = document.createElement('div')
      el.className = `tply-c${c.ours ? ' ours' : ''}`
      const s = H * 1.5
      el.style.cssText = `left:${(x - s / 2).toFixed(1)}px;top:${(y - s / 2).toFixed(1)}px;width:${s.toFixed(1)}px;height:${s.toFixed(1)}px;--d:${D(P.realm.tpClashMs).toFixed(0)}ms`
      el.innerHTML = `<img class="tply-cb" src="${host.art}fx/impact.png" alt=""><img class="tply-cs" src="${host.art}fx/strike-burst.svg" alt=""><img class="tply-cx" src="${host.art}icon/war-melee.png" alt="">`
      layer.append(el)
      at(D(P.realm.tpClashMs), () => el.remove())
      host.sound('clash', P.realm.tpClashVol * (c.ours ? 1 : 0.6))
    })
    at(t + D(P.realm.tpResultMs), () => { reveal(`c:${c.node}`); shown.add(c.line) })
  })

  // 거둔 것 — 고을 위로 그림과 수가 떠오른다 (철광·포구는 지도에 있던 「+n」 표를 이 박자에)
  goods.forEach((g, i) => at(T.goodAt[i]!, () => {
    if (g.haul) reveal(`g:${g.node}`)
    else layer.append(goodEl(g, false))
    shown.add(g.line)
    if (i < 4) host.sound('coin', 0.3)
  }))
  // 새 위협 — 붉은 고리 둘이 퍼진다
  marks.forEach((m, i) => at(T.markAt[i]!, () => layer.append(markEl(m, false))))
  at(T.end, finish)
  return player

  function goodEl(g: TpGood, still: boolean): HTMLElement {
    const [x, y] = px(g.at)
    const el = document.createElement('div')
    el.className = `tply-g${still ? ' still' : ''}`
    el.style.cssText = `left:${x.toFixed(1)}px;top:${(y - H * 0.55).toFixed(1)}px;--d:${D(P.realm.tpGoodMs).toFixed(0)}ms`
    el.innerHTML = g.items.map((it) => `<span><img src="${host.art}icon/${it.icon}.png" alt="">${it.n > 0 ? `+${it.n}` : ''}</span>`).join('')
    el.addEventListener('animationend', () => el.remove())
    return el
  }
  function markEl(m: TpMark, still: boolean): HTMLElement {
    const [x, y] = px(m.at)
    const el = document.createElement('div')
    el.className = `tply-m${still ? ' still' : ''}`
    const s = H * 1.6
    el.style.cssText = `left:${(x - s / 2).toFixed(1)}px;top:${(y - s / 2).toFixed(1)}px;width:${s.toFixed(1)}px;height:${s.toFixed(1)}px;--d:${D(P.realm.tpMarkMs).toFixed(0)}ms`
    el.innerHTML = '<i></i><i></i>'
    el.lastElementChild!.addEventListener('animationend', () => el.remove())
    return el
  }
}

/**
 * 연출 층의 꼴 — 지도(.map) 안 0,0 에 붙은 크기 없는 층 · 걷는 군대는 지도 말과 같은 그림띠 규칙(mapview .tok.unit .sq)을 빌려
 * 같은 keyframes(mqwalk · mqidle · mqatk)로 돈다. 띠 칸 변수(--nf · --w0 …)는 mapview 와 같은 값
 */
export const TURNPLAY_CSS = `
.map .tply { position: absolute; left: 0; top: 0; width: 0; height: 0; z-index: 7; pointer-events: none; }
.map .tply-w { position: absolute; left: 0; top: 0; pointer-events: none; }
.map .tply-w::after { content: ''; position: absolute; left: 6%; right: 6%; bottom: -8%; height: 22%; border-radius: 50%; border: 2px solid var(--tc, #9fd18b); box-shadow: 0 0 0 1px var(--tc2, #201811); z-index: -1; }
.map .tply-w .tply-b { position: absolute; inset: 0; display: flex; justify-content: center; align-items: flex-end; }
.map .tply-w.flip .tply-b { transform: scaleX(-1); }
.map .tply-fl { position: absolute; left: 6%; top: -34%; width: 5%; min-width: 2px; height: 74%; background: #5a3a1a; border-radius: 2px; z-index: 1; }
.map .tply-fl::after { content: ''; position: absolute; left: 100%; top: 0; width: 640%; height: 34%; min-height: 6px; background: var(--tc, #c8402a); box-shadow: inset 0 -2px 0 var(--tc2, #201811); clip-path: polygon(0 0, 100% 0, 80% 50%, 100% 100%, 0 100%); transform-origin: left center; animation: tokflag .6s ease-in-out infinite alternate; }
.map .tply-sq { position: relative; display: block; height: 100%; aspect-ratio: var(--ar, 1); }
.map .tply-sq u { position: absolute; inset: 0; overflow: hidden; background-size: 0 0; }
.map .tply-sq.v2 u { left: 50%; right: auto; width: calc(var(--r, 1) * 100%); transform: translateX(-50%); --nf: 20; --i0: 0%; --i1: 21.0526%; --w0: 21.0526%; --w1: 63.1579%; --a0: 63.1579%; --a1: 94.7368%; --tpin: 4; --tpwn: 8; --tpan: 6; --tpis: 1.6; --tpws: 1.4; --tpas: 1.3; }
.map .tply-sq.mg u { --nf: 8; --i0: 0%; --i1: 14.2857%; --tpin: 1; --w0: 0%; --w1: 114.2857%; --tpwn: 8; --tpws: 2.3; --a0: 0%; --a1: 114.2857%; --tpan: 8; --tpas: 3; }
.map .tply-sq u::before { content: ''; position: absolute; left: 0; top: 0; width: calc(var(--nf, 8) * 100%); height: 100%; background-image: inherit; background-size: 100% 100%; background-repeat: no-repeat;
  animation: mqwalk calc(.42s * var(--tpws, 1)) steps(var(--tpwn, 2)) calc(var(--k, .5) * -.4s) infinite; }
.map .tply-w.rest .tply-sq u::before { animation: mqidle calc(1.25s * var(--tpis, 1)) steps(var(--tpin, 2)) infinite; }
.map .tply-w.atk .tply-sq u::before { animation: mqatk calc(.32s * var(--tpas, 1)) steps(var(--tpan, 2)) infinite; }
.map .tply-c { position: absolute; pointer-events: none; }
.map .tply-c img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; opacity: 0; }
.map .tply-c .tply-cb { animation: tplyburst var(--d, 800ms) ease-out both; }
.map .tply-c .tply-cs { inset: 18%; width: 64%; height: 64%; animation: tplyburst calc(var(--d, 800ms) * .7) ease-out calc(var(--d, 800ms) * .08) both; }
.map .tply-c .tply-cx { inset: 22%; width: 56%; height: 56%; animation: tplyswords var(--d, 800ms) cubic-bezier(.3, 1.6, .5, 1) both; }
@keyframes tplyburst { 0% { opacity: 0; transform: scale(.25); } 18% { opacity: 1; } 100% { opacity: 0; transform: scale(1.45); } }
@keyframes tplyswords { 0% { opacity: 0; transform: scale(1.8) rotate(-20deg); } 22% { opacity: 1; transform: scale(.9) rotate(0); } 34% { transform: scale(1.08); } 80% { opacity: 1; transform: scale(1); } 100% { opacity: 0; transform: scale(1); } }
.map .tply-g { position: absolute; transform: translate(-50%, -100%); display: inline-flex; gap: 4px; white-space: nowrap; pointer-events: none; animation: tplyrise var(--d, 1300ms) ease-out both; }
.map .tply-g span { display: inline-flex; align-items: center; gap: 2px; padding: 1px 7px 1px 3px; border-radius: 10px; background: #3a2a10; color: #ffe08a; border: 1px solid #ffd27a; box-shadow: 0 1px 4px #000a; font-weight: 900; font-size: 14px; line-height: 1.3; }
.map .tply-g img { width: 20px; height: 20px; object-fit: contain; }
@keyframes tplyrise { 0% { opacity: 0; translate: 0 10px; scale: .6; } 16% { opacity: 1; translate: 0 0; scale: 1.2; } 28% { scale: 1; } 75% { opacity: 1; translate: 0 -12px; } 100% { opacity: 0; translate: 0 -22px; } }
.map .tply-g.still { animation-name: tplyfade; }
.map .tply-m { position: absolute; pointer-events: none; }
.map .tply-m i { position: absolute; inset: 0; border-radius: 50%; border: 3px solid #ff5a3a; opacity: 0; animation: tplyring var(--d, 1000ms) ease-out both; }
.map .tply-m i + i { animation-delay: calc(var(--d, 1000ms) * .3); }
@keyframes tplyring { 0% { opacity: 0; transform: scale(.3); } 20% { opacity: 1; } 100% { opacity: 0; transform: scale(1.5); } }
.map .tply-m.still i { animation-name: tplyfade; }
@keyframes tplyfade { 0% { opacity: 0; } 20%, 70% { opacity: 1; } 100% { opacity: 0; } }
.map [data-tph="w"] { visibility: hidden; }
.map [data-tph="d"] { display: none; }
.map [data-tph="s"] { opacity: 0; }
.ap.tply-on .map :is(.tok, .toks.mv) { transition: opacity .3s; }
.ap .tply-hint { position: absolute; left: 50%; bottom: 22%; transform: translateX(-50%); z-index: 40; pointer-events: none; padding: 4px 12px; border-radius: 999px; background: #201811d0; color: #f3e6c8; font-size: 13px; font-weight: 700; white-space: nowrap; animation: tplyhint .3s ease-out .6s both; }
@keyframes tplyhint { from { opacity: 0; } to { opacity: 1; } }
@media (orientation: landscape) { .ap .tply-hint { bottom: auto; top: 14%; } }
@media (prefers-reduced-motion: reduce) { .map .tply-fl::after, .map .tply-sq u::before { animation: none; } }
`
