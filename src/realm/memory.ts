/**
 * 장수의 기억 · 나라의 전례 장부 (docs/realm/MEMORY.md §3 · 형 10-30: "캐릭터가 사람처럼 '기억'하는 듯 · 진짜 고도의 캐릭터 활용")
 *
 *  - 적기: 계절 끝(season.advance)에 그 계절의 보고 줄과 명령에서 옮겨 적는다. 굴림이 없다 (A1 결정론).
 *    싸움(양쪽 장수 · 고을 · 상대 나라 · 길 · 결과) · 나눠 떠남(남긴 몫 · 그 사이 도읍이 털렸나) · 공작(했다/당했다) ·
 *    사로잡힘 · 풀려남(화친·도읍이 떨어짐·구출·넘어옴) · 회유(받았다/했다 · 거리 · 노여움) · 겨루기.
 *  - 아직 판을 바꾸지 않는다 — 읽는 것은 다음 걸음(회의 · 회유 · 알아서 행동하기). 그래서 여기의 묻는 손(lastBattleVs …)은 순수하다.
 *  - 없는 나라의 장수 · 쓰러진 장수에게는 적지 않는다.
 */
import { P } from '../tune/params.ts'
import type { Hero, Lesson, Mem, Order, Realm, ReportLine } from './types.ts'

type Battle = Extract<ReportLine, { kind: 'battle' }>
type Res = NonNullable<Mem['res']>

/** 나눠 떠남 — 이번 계절 남의 땅을 치러 제 고을을 떠난 군대 (season.departures 가 명령을 적용한 직후에 잰다) */
export interface Departure {
  readonly faction: string
  /** 떠난 고을 */
  readonly from: string
  /** 치러 가는 나라 */
  readonly foe: string
  /** 떠난 고을에 남긴 몫 0~100 */
  readonly keep: number
  /** 떠난 군대를 이끈 장수 */
  readonly heroes: readonly string[]
}

// ── 적는 손 ────────────────────────────────────────────────────────────────

function canRemember(r: Realm, h: Hero | undefined): h is Hero {
  return h !== undefined && h.status !== 'dead' && r.factions[h.faction] !== undefined
}

/** 줄을 줄인다 — keep 은 memKeepMax 까지만 지키고(넘치면 오래된 keep 부터 보통 줄로), 넘치는 줄은 오래된 보통 줄부터 지운다 */
function trimMem(mem: Mem[]): void {
  const R = P.realm
  let keeps = mem.filter((x) => x.keep === true).length
  for (let i = 0; i < mem.length && keeps > R.memKeepMax; i++) {
    if (mem[i]!.keep === true) { delete mem[i]!.keep; keeps-- }
  }
  while (mem.length > R.memMax) {
    const i = mem.findIndex((x) => x.keep !== true)
    mem.splice(i < 0 ? 0 : i, 1)
  }
}

/** 장수에게 한 줄 — 같은 계절 같은 일은 한 번 (총대장·부장으로 두 번 적히지 않게) */
export function remember(r: Realm, id: string | null | undefined, m: Mem): void {
  if (id === null || id === undefined) return
  const h = r.heroes[id]
  if (!canRemember(r, h)) return
  const mem = (h.mem ??= [])
  if (mem.some((x) => x.s === m.s && x.k === m.k && x.at === m.at && x.who === m.who && x.how === m.how && x.on === m.on)) return
  mem.push(clean(m))
  trimMem(mem)
}

/** undefined 칸을 지운다 — 저장에 "how":undefined 같은 빈 열쇠가 남지 않게 (JSON 은 버리지만 같음 비교가 흔들린다) */
function clean<T extends object>(x: T): T {
  const o = { ...x } as Record<string, unknown>
  for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k]
  return o as T
}

/** 나라의 장부에 한 줄 */
function learn(r: Realm, faction: string, foe: string, l: Lesson): Lesson | null {
  if (r.factions[faction] === undefined || r.factions[foe] === undefined || faction === foe) return null
  const book = ((r.lessons ??= {})[faction] ??= {})
  const xs = (book[foe] ??= [])
  const e = clean(l)
  xs.push(e)
  while (xs.length > P.realm.lessonMax) xs.shift()
  return e
}

/**
 * 회의에서 낸 안이 받아들여졌나 · 그 결과 (TODO 회의 걸음 — MEMORY §3-2 1). 회의가 고른 안을 이 손으로 적는다:
 * remember(r, 낸 장수, { s, k: 'council', how: 안의 종류, foe, res: 받아들여졌으면 'ok' 아니면 'fail' }) — 결과가 나면 res 를 고쳐 쓴다.
 */
export function rememberCouncil(r: Realm, hero: string, how: string, foe: string | undefined, res: 'ok' | 'fail'): void {
  remember(r, hero, { s: r.season, k: 'council', how, ...(foe !== undefined ? { foe } : {}), res })
}
// TODO 'betrayed' — 동맹이 등을 돌림·약조 깨짐 (relation 줄 why 'betray'·'break' · pledge kept false) 은 회의 걸음과 함께 적는다

const sideRes = (o: Battle['outcome'], atk: boolean): Res => {
  const won = o === 'rout' || o === 'win'
  const lost = o === 'lose' || o === 'routed'
  return won ? (atk ? 'won' : 'lost') : lost ? (atk ? 'lost' : 'won') : 'draw'
}

/** 그 나라와 지금 손잡은 나라 수 */
export function allyCount(r: Realm, faction: string): number {
  let n = 0
  for (const [k, rel] of Object.entries(r.relations)) {
    if (rel.state !== 'ally') continue
    const [a, b] = k.split('|')
    if (a === faction ? r.factions[b ?? ''] !== undefined : b === faction && r.factions[a ?? ''] !== undefined) n++
  }
  return n
}

/** 이 나라가 최근 그 나라에 먹힌 공작 (memPlotWindow 안) — 가장 최근 것의 종류 */
function plotBefore(r: Realm, faction: string, foe: string): string | undefined {
  const xs = r.lessons?.[faction]?.[foe] ?? []
  for (let i = xs.length - 1; i >= 0; i--) {
    const l = xs[i]!
    if (r.season - l.s > P.realm.memPlotWindow) break
    if (l.k === 'p' && l.on !== 1 && l.res === 'ok') return l.how
  }
  return undefined
}

function noteBattle(r: Realm, l: Battle): void {
  if (l.pending !== undefined || l.atkFaction === undefined) return
  const s = r.season
  const af = l.atkFaction
  const df = l.defender
  const at = l.node
  const how = l.field === true ? 'field' : l.approach
  const ah = [l.start?.heroes[0] ?? null, ...(l.start?.aides?.[0] ?? [])].filter((x): x is string => x !== null)
  const dh = [l.start?.heroes[1] ?? null, ...(l.start?.aides?.[1] ?? [])].filter((x): x is string => x !== null)
  const ra = sideRes(l.outcome, true)
  const rd = sideRes(l.outcome, false)
  // 도읍을 빼앗거나 잃은 싸움은 크게 남는다
  const big = r.factions[df]?.capital === at && ra === 'won' && l.field !== true
  const fallen = new Set(l.fallen ?? (l.killed !== null ? [l.killed] : []))
  for (const id of ah) remember(r, id, { s, k: 'battle', at, foe: df, ...(dh[0] !== undefined ? { who: dh[0] } : {}), ...(how !== undefined ? { how } : {}), res: ra, ...(big ? { keep: true } : {}) })
  for (const id of dh) remember(r, id, { s, k: 'battle', at, foe: af, ...(ah[0] !== undefined ? { who: ah[0] } : {}), ...(how !== undefined ? { how } : {}), res: rd, on: 1, ...(big ? { keep: true } : {}) })
  // 사로잡힌 장수 — 누구에게 · 어디서
  for (const id of l.captives ?? (l.captured !== null ? [l.captured] : [])) {
    const atkSide = ah.includes(id)
    remember(r, id, { s, k: 'captured', at, foe: atkSide ? df : af, ...((atkSide ? dh[0] : ah[0]) !== undefined ? { who: (atkSide ? dh[0] : ah[0])! } : {}), keep: true })
  }
  // 겨루기 — 건 장수와 받은 장수 (받은 쪽은 무예가 가장 높은 이가 나온다 · tactics.duelist)
  for (const rd0 of l.rounds ?? []) {
    for (const act of rd0.acts ?? []) {
      if (act.c !== 'duel' || act.hero === undefined) continue
      const theirs = act.s === 'a' ? dh : ah
      const lost = rd0.lostHero
      const foeHero = lost !== undefined && theirs.includes(lost.hero) ? lost.hero : champion(r, theirs)
      const won = act.res === 'won'
      const kill = foeHero !== undefined && fallen.has(won ? foeHero : act.hero)
      remember(r, act.hero, { s, k: 'duel', at, foe: act.s === 'a' ? df : af, ...(foeHero !== undefined ? { who: foeHero } : {}), res: won ? 'won' : 'lost', ...(kill ? { keep: true } : {}) })
      if (foeHero !== undefined) remember(r, foeHero, { s, k: 'duel', at, foe: act.s === 'a' ? af : df, who: act.hero, res: won ? 'lost' : 'won', on: 1, ...(kill ? { keep: true } : {}) })
    }
  }
  // 장부 — 친 나라 · 맞은 나라
  const plot = plotBefore(r, af, df)
  learn(r, af, df, { s, k: 'b', at, ...(how !== undefined ? { how } : {}), res: ra, ...(plot !== undefined ? { plot: 1 } : {}), ally: allyCount(r, df) })
  learn(r, df, af, { s, k: 'b', at, ...(how !== undefined ? { how } : {}), res: rd, on: 1 })
  // 나눠 떠난 뒤의 첫 싸움 — 그 떠남에 결과를 붙인다
  for (const e of r.lessons?.[af]?.[df] ?? []) {
    if (e.k === 's' && e.res === undefined && s - e.s <= P.realm.memSplitWatch) e.res = ra
  }
}

/** 그 무리에서 겨루기에 나설 이 — 무예가 가장 높은 이 (같으면 id 차례) */
function champion(r: Realm, ids: readonly string[]): string | undefined {
  return [...ids].sort((a, b) => (r.heroes[b]?.mu ?? 0) - (r.heroes[a]?.mu ?? 0) || (a < b ? -1 : 1))[0]
}

/**
 * 계절 끝 — 이번 계절의 보고 줄 · 명령 · 떠남에서 기억과 장부를 적는다 (season.advance 가 r.season 을 올리기 전에 부른다).
 * 굴림이 없고 판의 다른 칸을 건드리지 않는다 — 판의 흐름은 그대로다.
 */
export function noteMemory(r: Realm, lines: readonly ReportLine[], orders: readonly Order[], departs: readonly Departure[]): void {
  const s = r.season
  // 1 — 공작이 먼저 (같은 계절 싸움의 「공작 뒤」를 재려고)
  for (const l of lines) {
    if (l.kind !== 'plot') continue
    const res: Res = l.ok ? 'ok' : 'fail'
    const shown = l.exposed ?? l.caught
    if (l.agent !== undefined) {
      remember(r, l.agent, { s, k: 'plot', foe: l.target, how: l.op, res, ...(l.node !== undefined ? { at: l.node } : {}), ...(l.op === 'assassin' && l.hero !== undefined ? { who: l.hero } : {}) })
      if (l.agentFate === 'captured') remember(r, l.agent, { s, k: 'captured', foe: l.target, how: 'plot', ...(l.node !== undefined ? { at: l.node } : {}), keep: true })
    }
    // 노린 장수 — 먹혔거나 들켰으면 안다 (누가 보냈는지는 드러났을 때만)
    if (l.op === 'assassin' && l.hero !== undefined && (l.ok || l.caught)) {
      remember(r, l.hero, { s, k: 'plot', how: 'assassin', res, on: 1, ...(shown ? { foe: l.faction } : {}), ...(l.agent !== undefined && shown ? { who: l.agent } : {}) })
    }
    // 구출 — 빼낸 우리 장수가 풀려났다
    if (l.op === 'rescue' && l.ok && l.hero !== undefined) remember(r, l.hero, { s, k: 'freed', foe: l.target, how: 'rescue', ...(l.agent !== undefined ? { who: l.agent } : {}), keep: true })
    learn(r, l.faction, l.target, { s, k: 'p', how: l.op, res, ...(l.node !== undefined ? { at: l.node } : {}) })
    if (shown) learn(r, l.target, l.faction, { s, k: 'p', how: l.op, res, on: 1 })
  }
  // 2 — 나눠 떠남 (싸움보다 먼저 — 이번 계절에 떠나 이번 계절에 붙은 싸움도 그 떠남에 붙는다)
  for (const d of departs) {
    learn(r, d.faction, d.foe, { s, k: 's', at: d.from, n: d.keep })
    for (const id of d.heroes) remember(r, id, { s, k: 'split', at: d.from, foe: d.foe, n: d.keep, res: 'ok' })
  }
  // 3 — 싸움 · 사로잡힘 · 겨루기
  for (const l of lines) if (l.kind === 'battle') noteBattle(r, l)
  // 4 — 털림: 떠난 고을·도읍을 이번 계절 남에게 빼앗겼다 → 지켜보는 떠남(memSplitWatch 안)에 붙인다
  const taken = lines.filter((l): l is Extract<ReportLine, { kind: 'take' }> => l.kind === 'take')
  if (taken.length > 0) {
    for (const [f, book] of Object.entries(r.lessons ?? {})) {
      const cap = r.factions[f]?.capital
      for (const xs of Object.values(book)) {
        for (const e of xs) {
          if (e.k !== 's' || e.raid === 1 || s - e.s > P.realm.memSplitWatch) continue
          if (taken.some((t) => t.faction !== f && (t.node === e.at || t.node === cap))) e.raid = 1
        }
      }
      for (const h of Object.values(r.heroes)) {
        if (h.faction !== f || h.mem === undefined) continue
        for (const m of h.mem) {
          if (m.k === 'split' && m.res === 'ok' && s - m.s <= P.realm.memSplitWatch && taken.some((t) => t.faction !== f && (t.node === m.at || t.node === cap))) m.res = 'fail'
        }
      }
    }
  }
  // 5 — 사로잡힘(혼자 머물다 · 사신으로 갔다가) · 풀려남 · 회유
  for (const l of lines) {
    switch (l.kind) {
      case 'heroMoved':
        if (l.captor !== null) remember(r, l.hero, { s, k: 'captured', foe: l.captor, keep: true })
        break
      case 'envoyHeld':
        remember(r, l.hero, { s, k: 'captured', foe: l.to, how: 'envoy', keep: true })
        break
      case 'freed':
        remember(r, l.hero, { s, k: 'freed', foe: l.from, how: l.why, keep: true })
        break
      case 'recruit':
        if (l.how !== 'persuade') break
        remember(r, l.hero, { s, k: 'freed', foe: l.faction, how: 'turned', ...(l.by != null ? { who: l.by } : {}), keep: true })
        if (l.by != null) remember(r, l.by, { s, k: 'woo', who: l.hero, res: 'ok' })
        break
      case 'persuade': {
        if (l.step !== 'talk') break
        const o = orders.find((x): x is Extract<Order, { kind: 'persuade' }> => x.kind === 'persuade' && x.hero === l.hero)
        const how = o?.talk !== undefined && o.talk.length > 0 ? o.talk.join('+') : undefined
        const res: Res | undefined = l.broke === true ? 'ok' : (l.reacts ?? []).includes('rage') ? 'fail' : undefined
        const base = { s, k: 'woo' as const, ...(how !== undefined ? { how } : {}), ...(res !== undefined ? { res } : {}) }
        remember(r, l.hero, { ...base, foe: l.faction, on: 1, ...(l.by != null ? { who: l.by } : {}) })
        if (l.by != null) remember(r, l.by, { ...base, who: l.hero })
        break
      }
      default: break
    }
  }
}

// ── 묻는 손 (순수 · 회의가 읽는다) ─────────────────────────────────────────

export interface BattleNote {
  readonly s: number
  readonly at?: string
  readonly how?: string
  readonly res: Res
  /** 지킨 싸움 */
  readonly on: boolean
  /** 그 싸움 앞에 그 나라에 먹힌 공작이 있었다 (나라 장부만) */
  readonly plot: boolean
}

/** 장수 또는 나라의 그 나라와의 마지막 싸움 */
export function lastBattleVs(r: Realm, who: { readonly hero: string } | { readonly faction: string }, foe: string): BattleNote | null {
  if ('hero' in who) {
    const xs = r.heroes[who.hero]?.mem ?? []
    for (let i = xs.length - 1; i >= 0; i--) {
      const m = xs[i]!
      if (m.k === 'battle' && m.foe === foe && m.res !== undefined) return { s: m.s, ...(m.at !== undefined ? { at: m.at } : {}), ...(m.how !== undefined ? { how: m.how } : {}), res: m.res, on: m.on === 1, plot: false }
    }
    return null
  }
  const xs = r.lessons?.[who.faction]?.[foe] ?? []
  for (let i = xs.length - 1; i >= 0; i--) {
    const l = xs[i]!
    if (l.k === 'b' && l.res !== undefined) return { s: l.s, ...(l.at !== undefined ? { at: l.at } : {}), ...(l.how !== undefined ? { how: l.how } : {}), res: l.res, on: l.on === 1, plot: l.plot === 1 }
  }
  return null
}

/** 그 나라를 칠 때 쓴 길마다 이긴·진 수 (우리가 친 싸움만 · 들판 싸움은 뺀다) — 많이 쓴 차례 */
export function routesVs(r: Realm, faction: string, foe: string): Array<{ how: string; won: number; lost: number; last: number }> {
  const t = new Map<string, { how: string; won: number; lost: number; last: number }>()
  for (const l of r.lessons?.[faction]?.[foe] ?? []) {
    if (l.k !== 'b' || l.on === 1 || l.how === undefined || l.how === 'field') continue
    const x = t.get(l.how) ?? { how: l.how, won: 0, lost: 0, last: l.s }
    if (l.res === 'won') x.won++
    else if (l.res === 'lost') x.lost++
    x.last = Math.max(x.last, l.s)
    t.set(l.how, x)
  }
  return [...t.values()].sort((a, b) => b.won + b.lost - (a.won + a.lost) || b.last - a.last || (a.how < b.how ? -1 : 1))
}

/** 그 나라를 칠 때 이긴 길 — 이긴 수 − 진 수가 가장 큰 길 (이긴 적이 있어야) · 같으면 최근에 쓴 길 */
export function bestRouteVs(r: Realm, faction: string, foe: string): { how: string; won: number; lost: number } | null {
  const best = routesVs(r, faction, foe).filter((x) => x.won > 0).sort((a, b) => b.won - b.lost - (a.won - a.lost) || b.last - a.last || (a.how < b.how ? -1 : 1))[0]
  return best === undefined ? null : { how: best.how, won: best.won, lost: best.lost }
}

/** 그 나라를 칠 때 진 길 — 진 수 − 이긴 수가 가장 큰 길 (진 적이 있어야) */
export function worstRouteVs(r: Realm, faction: string, foe: string): { how: string; won: number; lost: number } | null {
  const worst = routesVs(r, faction, foe).filter((x) => x.lost > x.won).sort((a, b) => b.lost - b.won - (a.lost - a.won) || b.last - a.last || (a.how < b.how ? -1 : 1))[0]
  return worst === undefined ? null : { how: worst.how, won: worst.won, lost: worst.lost }
}

/**
 * 나눠 떠난 지난 일 — 가장 최근의 떠남 하나: 어디서 · 누구를 치러 · 남긴 몫 · 그 사이 털렸나 · 그 싸움의 결과(있으면).
 * 회의가 「지난 가을 다 데려갔다가 도읍이 털렸사옵니다. 3할은 남기시옵소서」 / 「다 끌고 가 이겼사옵니다」를 짓는다
 */
export function splitLesson(r: Realm, faction: string): { s: number; foe: string; at?: string; keep: number; raid: boolean; res?: Res } | null {
  let best: { s: number; foe: string; at?: string; keep: number; raid: boolean; res?: Res } | null = null
  for (const [foe, xs] of Object.entries(r.lessons?.[faction] ?? {}).sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    for (const l of xs) {
      if (l.k !== 's' || (best !== null && l.s <= best.s)) continue
      best = { s: l.s, foe, ...(l.at !== undefined ? { at: l.at } : {}), keep: l.n ?? 0, raid: l.raid === 1, ...(l.res !== undefined ? { res: l.res } : {}) }
    }
  }
  return best
}

/** 그 장수가 그 나라에 사로잡힌 마지막 일 (기억이 남아 있으면) */
export function wasCapturedBy(r: Realm, hero: string, faction: string): { s: number; at?: string; who?: string; how?: string } | null {
  const xs = r.heroes[hero]?.mem ?? []
  for (let i = xs.length - 1; i >= 0; i--) {
    const m = xs[i]!
    if (m.k === 'captured' && m.foe === faction) return { s: m.s, ...(m.at !== undefined ? { at: m.at } : {}), ...(m.who !== undefined ? { who: m.who } : {}), ...(m.how !== undefined ? { how: m.how } : {}) }
  }
  return null
}

/** 그 나라에 공작을 먼저 하고 친 싸움 — 이긴 수 · 진 수 · 마지막 공작 종류 (공작 없이 친 싸움과 견줄 수 있게 함께) */
export function plotBeforeWin(r: Realm, faction: string, foe: string): { won: number; lost: number; bareWon: number; bareLost: number; op?: string } | null {
  const xs = r.lessons?.[faction]?.[foe] ?? []
  let won = 0, lost = 0, bareWon = 0, bareLost = 0
  let op: string | undefined
  for (let i = 0; i < xs.length; i++) {
    const l = xs[i]!
    if (l.k === 'p' && l.on !== 1 && l.res === 'ok') op = l.how
    if (l.k !== 'b' || l.on === 1) continue
    const w = l.res === 'won' ? 1 : 0
    const f = l.res === 'lost' ? 1 : 0
    if (l.plot === 1) { won += w; lost += f } else { bareWon += w; bareLost += f }
  }
  if (won + lost + bareWon + bareLost === 0) return null
  return { won, lost, bareWon, bareLost, ...(op !== undefined ? { op } : {}) }
}

/** 그 나라를 칠 때 그 나라와 손잡은 나라 수 — 마지막으로 친 때 */
export function foeAlliesWhenStruck(r: Realm, faction: string, foe: string): number | null {
  const xs = r.lessons?.[faction]?.[foe] ?? []
  for (let i = xs.length - 1; i >= 0; i--) if (xs[i]!.k === 'b' && xs[i]!.on !== 1 && xs[i]!.ally !== undefined) return xs[i]!.ally!
  return null
}
