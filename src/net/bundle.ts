/**
 * 맞추기의 셈 — 순수 함수만 (docs/realm/SERVER.md §3). 기기·서버·시계를 모른다.
 *
 *  - mergeProgress: 판 밖에 쌓인 것(도감 · 혈통 · 해금·휘장 · 단련 · 유물)을 합친다 — 늘기만 하는 것은 잃지 않는다 (S3)
 *  - plan: 이 기기 판과 서버 판, 마지막으로 맞춘 자리를 보고 올릴지·받을지·사람에게 물을지 (S2 — 몰래 덮지 않는다)
 */

/** 도감 한 칸 — f: 들음·만남·사로잡음·거느림 비트, b: 처음 본 판 (ui/realm/dex.ts) */
export interface DexEntry { f: number; b?: string }
/** 해금 (ui/realm/unlock.ts 의 Rec 와 같은 꼴) */
export interface UnlockRec { won: string[]; tutorial?: 'done' | 'quit'; tiers?: Record<string, number>; nations?: Record<string, number> }

/** 단련 (ui/realm/drill.ts · hanbal.realm.drill) — 여기는 합칠 때 보는 칸만 안다. 나머지는 기기가 읽을 때 걸러 낸다 */
export interface DrillLike {
  v?: number
  h?: Record<string, { level?: number; points?: number } & Record<string, unknown>>
  paid?: Record<string, Record<string, number>>
  order?: string[]
}
/** 유물 (ui/realm/relics.ts · hanbal.realm.relics) — wearAt: 끼운 것을 마지막으로 바꾼 때 (기기 시계 ms) */
export interface RelicsLike {
  v?: number
  own?: Record<string, { n?: number } & Record<string, unknown>>
  wear?: Record<string, string[]>
  wearAt?: number
  tombs?: Record<string, { ids?: string[]; pick?: string | null }>
  order?: string[]
}

export interface Progress {
  dex: Record<string, DexEntry>
  /** 혈통 — 열쇠 `seed:hero` (ui/realm/dex.ts ClanKid) */
  clan: Record<string, unknown>
  unlock: UnlockRec
  /** 단련 — 판을 져도 남는 장수의 성장 (HERO-GROWTH ★). 없던 옛 기록이면 비어 있다 */
  drill?: DrillLike
  /** 유물 — 무덤에서 얻은 것 · 장수가 끼운 것 */
  relics?: RelicsLike
}

export const EMPTY: Progress = { dex: {}, clan: {}, unlock: { won: [] } }

const maxRec = (a: Record<string, number> | undefined, b: Record<string, number> | undefined): Record<string, number> | undefined => {
  if (a === undefined && b === undefined) return undefined
  const o: Record<string, number> = { ...(a ?? {}) }
  for (const [k, v] of Object.entries(b ?? {})) o[k] = Math.max(o[k] ?? 0, v)
  return o
}

/**
 * a(이 기기)와 b(서버)를 합친다. 겹치면:
 * 도감은 비트 OR · 처음 본 판은 b(서버) 먼저 / 혈통은 합집합(b 먼저) / 해금은 합집합(정렬)·큰 값·done>quit.
 * 겹칠 때 늘 서버 쪽을 따르고 이긴 판은 정렬한다 — 두 기기가 서로 제 것을 올리는 핑퐁(쓰기 낭비)이 없다.
 * 계승 가신은 맞추지 않는다 (sync.ts PROGRESS_KEYS)
 */
export function mergeProgress(a: Progress, b: Progress): Progress {
  const dex: Record<string, DexEntry> = {}
  for (const [id, e] of Object.entries(b.dex)) dex[id] = { ...e }
  for (const [id, e] of Object.entries(a.dex)) {
    const o = dex[id]
    const bb = o?.b ?? e.b
    dex[id] = { f: (o?.f ?? 0) | e.f, ...(bb !== undefined ? { b: bb } : {}) }
  }
  const clan = { ...a.clan, ...b.clan }
  const won = [...new Set([...a.unlock.won, ...b.unlock.won])].sort()
  const tut = a.unlock.tutorial === 'done' || b.unlock.tutorial === 'done' ? 'done' : (a.unlock.tutorial ?? b.unlock.tutorial)
  const tiers = maxRec(a.unlock.tiers, b.unlock.tiers)
  const nations = maxRec(a.unlock.nations, b.unlock.nations)
  const unlock: UnlockRec = { won, ...(tut !== undefined ? { tutorial: tut } : {}), ...(tiers !== undefined ? { tiers } : {}), ...(nations !== undefined ? { nations } : {}) }
  const drill = mergeDrill(a.drill, b.drill)
  const relics = mergeRelics(a.relics, b.relics)
  return { dex, clan, unlock, ...(drill !== undefined ? { drill } : {}), ...(relics !== undefined ? { relics } : {}) }
}

/** 판 차례 둘을 하나로 — 서버 쪽 차례 먼저, 이 기기에만 있는 것은 뒤에 */
const joinOrder = (a: string[] | undefined, b: string[] | undefined): string[] => [...new Set([...(b ?? []), ...(a ?? [])])]

/**
 * 단련 — 장수마다 더 나아간 쪽 (단련 단계가 높은 쪽, 같으면 공이 많은 쪽, 그것도 같으면 서버).
 * 두 기기에서 따로 번 공을 더하지는 않는다 — 판마다 치른 장부(paid)는 합쳐서, 같은 판의 공을 두 번 받지 않게 한다.
 * 한 기기의 성장이 다른 기기 것보다 뒤로 가는 일은 없다
 */
export function mergeDrill(a: DrillLike | undefined, b: DrillLike | undefined): DrillLike | undefined {
  if (a === undefined) return b
  if (b === undefined) return a
  const h: NonNullable<DrillLike['h']> = {}
  for (const id of new Set([...Object.keys(b.h ?? {}), ...Object.keys(a.h ?? {})])) {
    const ea = a.h?.[id], eb = b.h?.[id]
    if (ea === undefined || eb === undefined) { h[id] = (ea ?? eb)!; continue }
    const la = ea.level ?? 0, lb = eb.level ?? 0
    h[id] = la > lb || (la === lb && (ea.points ?? 0) > (eb.points ?? 0)) ? ea : eb
  }
  const paid: Record<string, Record<string, number>> = {}
  for (const k of new Set([...Object.keys(b.paid ?? {}), ...Object.keys(a.paid ?? {})])) {
    const o: Record<string, number> = { ...(b.paid?.[k] ?? {}) }
    for (const [hid, n] of Object.entries(a.paid?.[k] ?? {})) o[hid] = Math.max(o[hid] ?? 0, n)
    paid[k] = o
  }
  return { v: 1, h, paid, order: joinOrder(a.order, b.order) }
}

/**
 * 유물 — 얻은 것은 합집합 (고른 횟수는 큰 쪽) · 연 무덤도 합집합 (고른 쪽이 있으면 그쪽).
 * 끼운 것은 나중에 바꾼 기기를 따른다(wearAt) — 같으면 서버. 그 뒤 없는 유물 · 둘이 같이 낀 유물을 걷어 낸다
 */
export function mergeRelics(a: RelicsLike | undefined, b: RelicsLike | undefined): RelicsLike | undefined {
  if (a === undefined) return b
  if (b === undefined) return a
  const own: NonNullable<RelicsLike['own']> = {}
  for (const id of new Set([...Object.keys(b.own ?? {}), ...Object.keys(a.own ?? {})])) {
    const oa = a.own?.[id], ob = b.own?.[id]
    own[id] = oa !== undefined && ob !== undefined ? { ...ob, n: Math.max(oa.n ?? 1, ob.n ?? 1) } : (ob ?? oa)!
  }
  const tombs: NonNullable<RelicsLike['tombs']> = {}
  for (const k of new Set([...Object.keys(b.tombs ?? {}), ...Object.keys(a.tombs ?? {})])) {
    const ta = a.tombs?.[k], tb = b.tombs?.[k]
    tombs[k] = (tb !== undefined && (typeof tb.pick === 'string' || ta === undefined || typeof ta.pick !== 'string') ? tb : ta)!
  }
  const atA = a.wearAt ?? 0, atB = b.wearAt ?? 0
  const pick = atA > atB ? a.wear : b.wear
  const wear: Record<string, string[]> = {}
  const taken = new Set<string>()
  for (const hid of Object.keys(pick ?? {}).sort()) {
    const keep = (pick?.[hid] ?? []).filter((id) => own[id] !== undefined && !taken.has(id))
    for (const id of keep) taken.add(id)
    if (keep.length > 0) wear[hid] = keep
  }
  const wearAt = Math.max(atA, atB)
  return { v: 1, own, wear, ...(wearAt > 0 ? { wearAt } : {}), tombs, order: joinOrder(a.order, b.order) }
}

/** 같은가 — 합친 것이 서버와 다를 때만 올린다 (쓰기를 아낀다, S6) */
export function sameProgress(a: Progress, b: Progress): boolean {
  return stable(a) === stable(b)
}
/** 열쇠 차례를 고정한 JSON — 같은 내용이면 같은 글자 */
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`
  if (v !== null && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`).join(',')}}`
  return JSON.stringify(v) ?? 'null'
}

// ───────── 판 맞추기 (§3-1)

/** 명령 기록의 지문 — FNV-1a 32비트. 같은 기록이면 어느 기기에서든 같은 글자 */
export function logHash(log: readonly unknown[]): string {
  const t = JSON.stringify(log)
  let h = 0x811c9dc5
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 }
  return h.toString(16).padStart(8, '0')
}

/** 서버 판의 얼굴 — seed 는 판의 이름, rev 는 넘긴 계절 수(log.length), h 는 그때 기록의 지문 */
export interface RemoteHead { readonly seed: number; readonly rev: number; readonly h: string; readonly updateTime: string }
/** 이 기기 판 — 지문은 앞에서 n 계절까지로 잰다 (서버 판이 내 판의 앞부분인가) */
export interface LocalHead { readonly seed: number; readonly rev: number; hashAt(n: number): string }
/** 마지막으로 맞춘 자리 (기기의 hanbal.sync) */
export interface LastSync { readonly seed: number; readonly rev: number; readonly h: string; readonly updateTime: string }

/** fetch: 서버 판이 더 나아갔는데 갈라졌는지 모른다 — 받아서 lineage 로 가린다 */
export type Plan = 'none' | 'push' | 'pull' | 'fetch' | 'choose'

export function plan(local: LocalHead | null, remote: RemoteHead | null, last: LastSync | null): Plan {
  if (local === null && remote === null) return 'none'
  if (remote === null) return 'push'
  if (local === null) return 'pull'
  const localMoved = last === null || last.seed !== local.seed || last.rev !== local.rev || local.hashAt(last.rev) !== last.h
  const remoteMoved = last === null || last.updateTime !== remote.updateTime
  if (!localMoved && !remoteMoved) return 'none'
  if (!localMoved) return 'pull'
  if (!remoteMoved) {
    // 서버는 맞춘 그대로. 이 기기 판이 그 맞춘 판의 뒤를 이은 것일 때만 올린다 —
    // 저장이 막혀 옛 판으로 물러났거나 묵은 탭에서 갈라진 판이 서버의 더 나아간 판을 덮지 않게
    const descends = last !== null && local.seed === last.seed ? local.rev >= last.rev && local.hashAt(last.rev) === last.h : true
    return descends ? 'push' : 'fetch'
  }
  // 둘 다 나아갔다 (또는 처음 맞추는 기기 · 로그아웃했다 다시 들어옴). 같은 판이면 기록의 앞부분으로 가린다 — 한 줄기면 덮어도 잃는 계절이 없다
  if (local.seed !== remote.seed) return 'choose'
  if (local.rev >= remote.rev) return local.hashAt(remote.rev) === remote.h ? (local.rev === remote.rev ? 'none' : 'push') : 'choose'
  return 'fetch'
}

/** 서버 판을 받아 본 뒤 — 내 기록이 서버 기록의 앞부분이면 받고, 아니면 고른다 */
export function lineage(localLog: readonly unknown[], remoteLog: readonly unknown[]): 'pull' | 'choose' {
  return localLog.length <= remoteLog.length && logHash(remoteLog.slice(0, localLog.length)) === logHash(localLog) ? 'pull' : 'choose'
}
