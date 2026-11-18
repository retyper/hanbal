/**
 * 본편 추천 점 (형 11-18 「튜토리얼에 너무 배우는 게 많은데. 인게임에서 장수랑 열전에 추천 표시 자주 뜨게 하면 되는 거 아닐까.
 * 그냥 타고 들어가게. 각성 조건 달성되면 추천 무조건 뜨게」).
 *
 * 금빛 맥박 점 하나가 길을 따라 옮겨 붙는다: 「장수」 탭 → 장수 목록의 그 장수 줄(맨 위로) → 장수 판의 시련·열전 카드 → 출전 단추.
 *  - 무조건 (hard): 각성 조건을 채운 장수. 그 장수로 끝낼 때까지 꺼지지 않는다 (조건이 풀려야 꺼진다)
 *      옛 규칙(ascendTrialOpen 1): 시련이 열린 장수 (trialReady · 아직 안 넘음) → 시련 카드
 *      새 규칙(0): 불꽃을 채웠는데 도깨비 도장이 없는 장수 → 열전 카드 (목책) · 도장 둘이 다 있고 이 판에서 깨어난 장수 → 장수 판의 초상 (한 번 보면 끝)
 *  - 자주 (soft): 새로 들어온 장수(한 번) · 열전에서 아직 아무 판도 못 깬 장수 하나(턴마다 바뀜) · 열전 금이 쌓였을 때.
 *      그 장수 판에 한 번 들어가 보면 끈다 (새 장수는 영영 · 나머지는 recQuietTurns 턴)
 *  - 배우는 판에서는 아무것도 안 뜬다. 장수 추천은 한 번에 recHeroMax 까지 (무조건은 늘 뜬다)
 *
 * 판의 셈은 읽기만 한다 (A1). 끈 기록은 화면 쪽 저장 칸(REC_KEY) 하나에 판(씨앗 · 나라)마다 둔다.
 */
import type { Hero, Realm } from '../../realm/types.ts'
import { ascendTrialOpen, hasAwakeningTrial } from '../../realm/trial-rules.ts'
import { sealsOf } from '../../realm/person.ts'
import { AWAKEN_ART } from '../../realm/data/awaken-art.ts'
import { P } from '../../tune/params.ts'

export const REC_KEY = 'hanbal.realm.rec'
/** 왜 추천하나 — trial(옛 시련) · demon(목책 도깨비) · woke(도장 둘 · 깨어난 모습) · newbie · untried · shop */
export type RecWhy = 'trial' | 'demon' | 'woke' | 'newbie' | 'untried' | 'shop'
/** 장수 판에서 점이 붙는 곳 — 시련 카드 · 열전 카드 · 초상 */
export type RecTo = 'trial' | 'raid' | 'pic'
export interface Rec { readonly id: string; readonly whys: readonly RecWhy[]; readonly hard: boolean; readonly to: RecTo }

/** 판 하나의 끈 기록 */
export interface RecBook {
  /** 본 적 있는 우리 장수 — 여기 없는 이가 나타나면 새로 들어온 장수다 */
  known: string[]
  /** 새로 들어와 아직 장수 판을 안 열어 본 장수 */
  fresh: string[]
  /** 가벼운 추천을 끈 턴 (untried · shop) */
  quiet: Partial<Record<RecWhy, number>>
  /** 도장 둘로 깨어난 모습을 이미 본 장수 */
  woke: string[]
}
type Shelf = { order: string[]; books: Record<string, RecBook> }
const SHELF_MAX = 6

const bookKey = (r: Realm): string => `${r.seed}:${r.player}`
function loadShelf(): Shelf {
  try {
    const v = JSON.parse(localStorage.getItem(REC_KEY) ?? 'null') as Partial<Shelf> | null
    if (v !== null && typeof v === 'object' && Array.isArray(v.order) && v.books !== null && typeof v.books === 'object') return { order: v.order.filter((x) => typeof x === 'string'), books: v.books }
  } catch { /* 깨진 칸 · 사생활 창 */ }
  return { order: [], books: {} }
}
function saveShelf(s: Shelf): void {
  try { localStorage.setItem(REC_KEY, JSON.stringify(s)) } catch { /* 저장 못 하는 곳 · 이번 화면만 */ }
}
const strs = (x: unknown): string[] => (Array.isArray(x) ? x.filter((v): v is string => typeof v === 'string') : [])

/** 우리 장수 (자유로운 · 얼굴이 있어 열전에 데려갈 수 있는) — id 순 */
export function recHeroes(r: Realm, me: string, face: (id: string) => string | undefined): Hero[] {
  return Object.values(r.heroes).filter((h) => h.faction === me && h.status === 'free' && face(h.id) !== undefined).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/**
 * 그 판의 끈 기록을 읽고, 새로 들어온 장수를 적는다. 처음 보는 판이면 지금 장수를 모두 「본 적 있음」으로 (판을 열자마자 다 새 장수가 되지 않게).
 * write 가 false 면(따로 띄운 시험 화면) 읽기만 한다
 */
export function syncBook(r: Realm, me: string, face: (id: string) => string | undefined, write: boolean): RecBook {
  const shelf = loadShelf(), key = bookKey(r), raw = shelf.books[key] as Partial<RecBook> | undefined
  const ours = recHeroes(r, me, face).map((h) => h.id)
  const book: RecBook = raw === undefined ? { known: ours, fresh: [], quiet: {}, woke: [] }
    : { known: strs(raw.known), fresh: strs(raw.fresh), quiet: raw.quiet !== null && typeof raw.quiet === 'object' ? raw.quiet : {}, woke: strs(raw.woke) }
  let changed = raw === undefined
  for (const id of ours) if (!book.known.includes(id)) { book.known.push(id); book.fresh.push(id); changed = true }
  if (changed && write) {
    shelf.books[key] = book
    shelf.order = [key, ...shelf.order.filter((k) => k !== key)]
    for (const old of shelf.order.slice(SHELF_MAX)) delete shelf.books[old]
    shelf.order = shelf.order.slice(0, SHELF_MAX)
    saveShelf(shelf)
  }
  return book
}

/** 장수 판에 들어갔다 — 그 장수에게 붙은 가벼운 추천과 「깨어난 모습」 추천을 끈다 */
export function visitRec(r: Realm, rec: Rec, write: boolean): void {
  if (!write) return
  const shelf = loadShelf(), key = bookKey(r), book = shelf.books[key]
  if (book === undefined) return
  for (const w of rec.whys) {
    if (w === 'newbie') book.fresh = book.fresh.filter((id) => id !== rec.id)
    else if (w === 'untried' || w === 'shop') book.quiet[w] = r.season
    else if (w === 'woke' && !book.woke.includes(rec.id)) book.woke.push(rec.id)
  }
  saveShelf(shelf)
}

/** 열전 기록 가운데 추천이 읽는 것 — 장수마다 깬 판 · 남은 금 · 가장 싼 다음 강화 값 */
export interface RaidPeek { readonly cleared: Readonly<Record<string, readonly string[]>>; readonly gold: number; readonly cheapest: number }

/** 지금 추천할 장수 — 무조건 먼저, 그다음 가벼운 것 (recHeroMax 까지) */
export function recsOf(r: Realm, me: string, face: (id: string) => string | undefined, dex: Readonly<Record<string, { readonly f: number } | undefined>>, raid: RaidPeek, book: RecBook): Rec[] {
  if (r.region === 'tutorial' || r.outcome) return []
  const R = P.realm, ours = recHeroes(r, me, face)
  const hard: Rec[] = []
  const v2 = !ascendTrialOpen()
  for (const h of ours) {
    if (hasAwakeningTrial(h)) { if (h.trialReady === true && h.trialCleared !== true) hard.push({ id: h.id, whys: ['trial'], hard: true, to: 'trial' }); continue }
    if (!v2 || !AWAKEN_ART.has(face(h.id) ?? '')) continue
    const s = sealsOf(dex, h.id)
    if ((h.ascended === true || s.flame) && !s.demon) hard.push({ id: h.id, whys: ['demon'], hard: true, to: 'raid' })
    else if (s.both && h.ascended === true && !book.woke.includes(h.id)) hard.push({ id: h.id, whys: ['woke'], hard: true, to: 'pic' })
  }
  const room = Math.max(0, Math.round(R.recHeroMax) - hard.length)
  const quiet = (w: RecWhy): boolean => { const t = book.quiet[w]; return typeof t === 'number' && r.season < t + Math.round(R.recQuietTurns) }
  const soft = new Map<string, RecWhy[]>()
  const add = (id: string, w: RecWhy): void => {
    if (hard.some((x) => x.id === id)) return
    const had = soft.get(id)
    if (had !== undefined) had.push(w)
    else if (soft.size < room) soft.set(id, [w])
  }
  const live = new Set(ours.map((h) => h.id))
  for (const id of book.fresh) if (live.has(id)) add(id, 'newbie')
  // 열전 금 — 가장 많이 데려간 장수로 (처음이면 첫 장수)
  if (!quiet('shop') && raid.cheapest > 0 && raid.gold >= raid.cheapest * R.recShopMul && ours.length > 0) {
    const used = [...ours].sort((a, b) => (raid.cleared[b.id]?.length ?? 0) - (raid.cleared[a.id]?.length ?? 0))
    add(used[0]!.id, 'shop')
  }
  // 열전에서 아직 아무 판도 못 깬 장수 하나 — 턴마다 돌아가며
  if (!quiet('untried')) {
    const fresh = ours.filter((h) => (raid.cleared[h.id]?.length ?? 0) === 0 && !soft.has(h.id) && !hard.some((x) => x.id === h.id))
    if (fresh.length > 0) add(fresh[Math.abs(Math.floor(r.season)) % fresh.length]!.id, 'untried')
  }
  return [...hard, ...[...soft].map(([id, whys]) => ({ id, whys, hard: false, to: 'raid' as const }))]
}

/** 금빛 맥박 점 — 글을 얹지 않는다 (읽지 않고 보이게 · 꼬리표 금지) */
export const recDot = (label: string): string => `<i class="rqd" role="img" aria-label="${label}"></i>`

/** 누르면 그 자리에서 금빛 고리 하나와 불티 여덟이 터진다 (낱낱의 작은 점 · 넓은 칸은 안 움직인다) */
export function recBurst(at: HTMLElement, host: HTMLElement): void {
  const b = at.getBoundingClientRect()
  const el = document.createElement('div')
  el.className = 'rqburst'
  el.style.left = `${b.left + b.width / 2}px`
  el.style.top = `${b.top + b.height / 2}px`
  el.innerHTML = `<i class="rqring"></i>${Array.from({ length: 8 }, (_, i) => `<i class="rqsp" style="--a:${i * 45}deg"></i>`).join('')}`
  host.appendChild(el)
  const ms = Math.max(200, Number(P.realm.recBurstMs) || 650)
  setTimeout(() => el.remove(), ms * 1.5) // 애니가 멈춰도(백그라운드 · 값이 깨져도) 반드시 걷힌다
}

export const recCss = (): string => {
  const pulse = Math.max(400, Number(P.realm.recPulseMs) || 1100), burst = Math.max(200, Number(P.realm.recBurstMs) || 650)
  return `
.ap .rqd { position: absolute; z-index: 3; width: 10px; height: 10px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #fff4c2, #f2c94c 55%, #b8862a); box-shadow: 0 0 0 2px #2a1a06, 0 0 8px #ffd27a; pointer-events: none; font-style: normal; }
.ap .rqd::after { content: ''; position: absolute; inset: -4px; border-radius: 50%; border: 2px solid #ffd27a; animation: rqpulse ${pulse}ms ease-out infinite; }
@keyframes rqpulse { 0% { transform: scale(.6); opacity: .95; } 100% { transform: scale(1.7); opacity: 0; } }
.ap .tabs .rqd { top: 3px; left: calc(50% - 24px); }
.ap .dseg button { position: relative; } .ap .dseg .rqd { top: -4px; right: -3px; }
.ap .hrow > .rqd { top: 6px; left: 6px; }
.ap .hrow.rq-row { box-shadow: 0 0 0 2px #f2c94ccc, 0 0 12px #f2c94c66; }
.ap .trial-card.rq-on { position: relative; border: 2px solid #f2c94c !important; background: linear-gradient(180deg, #3a2c10cc, #1c160acc); box-shadow: 0 0 14px #f2c94c55; }
.ap .trial-card .btn.rq-go { position: relative; overflow: visible; }
.ap .trial-card .btn.rq-go > .rqd { top: -6px; right: -6px; }
.ap .hpic > .rqd { top: 8px; left: 8px; width: 16px; height: 16px; }
.rqburst { position: fixed; z-index: 9999; width: 0; height: 0; pointer-events: none; }
.rqburst .rqring { position: absolute; left: -22px; top: -22px; width: 44px; height: 44px; border-radius: 50%; border: 3px solid #ffd27a; animation: rqring ${burst}ms ease-out both; }
.rqburst .rqsp { position: absolute; left: -4px; top: -4px; width: 8px; height: 8px; border-radius: 50%; background: #fff0b0; box-shadow: 0 0 6px #f2c94c; transform: rotate(var(--a)) translateY(0); animation: rqsp ${burst}ms cubic-bezier(.2, .8, .3, 1) both; }
@keyframes rqring { from { transform: scale(.3); opacity: 1; } to { transform: scale(2.4); opacity: 0; } }
@keyframes rqsp { from { transform: rotate(var(--a)) translateY(0) scale(1.2); opacity: 1; } to { transform: rotate(var(--a)) translateY(-46px) scale(.3); opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .ap .rqd::after { animation: none; opacity: .6; } .rqburst { display: none; } }
`
}
