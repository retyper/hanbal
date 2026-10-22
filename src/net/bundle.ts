/**
 * 맞추기의 셈 — 순수 함수만 (docs/realm/SERVER.md §3). 기기·서버·시계를 모른다.
 *
 *  - mergeProgress: 판 밖에 쌓인 것(도감 · 혈통 · 해금·휘장 · 계승 가신)을 합친다 — 늘기만 하는 것은 잃지 않는다 (S3)
 *  - plan: 이 기기 판과 서버 판, 마지막으로 맞춘 자리를 보고 올릴지·받을지·사람에게 물을지 (S2 — 몰래 덮지 않는다)
 */

/** 도감 한 칸 — f: 들음·만남·사로잡음·거느림 비트, b: 처음 본 판 (ui/realm/dex.ts) */
export interface DexEntry { f: number; b?: string }
/** 해금 (ui/realm/unlock.ts 의 Rec 와 같은 꼴) */
export interface UnlockRec { won: string[]; tutorial?: 'done' | 'quit'; tiers?: Record<string, number>; nations?: Record<string, number> }

export interface Progress {
  dex: Record<string, DexEntry>
  /** 혈통 — 열쇠 `seed:hero` (ui/realm/dex.ts ClanKid) */
  clan: Record<string, unknown>
  unlock: UnlockRec
  /** 계승 가신 (ui/realm/legacy.ts Rec) — 없으면 null */
  retain: unknown
}

export const EMPTY: Progress = { dex: {}, clan: {}, unlock: { won: [] }, retain: null }

const maxRec = (a: Record<string, number> | undefined, b: Record<string, number> | undefined): Record<string, number> | undefined => {
  if (a === undefined && b === undefined) return undefined
  const o: Record<string, number> = { ...(a ?? {}) }
  for (const [k, v] of Object.entries(b ?? {})) o[k] = Math.max(o[k] ?? 0, v)
  return o
}

/**
 * a(이 기기)와 b(서버)를 합친다. 겹치면:
 * 도감은 비트 OR · 처음 본 판은 a 먼저 / 혈통은 합집합(a 먼저) / 해금은 합집합·큰 값·done>quit / 계승 가신은 a 가 있으면 a (기기에서 방금 고른 것)
 */
export function mergeProgress(a: Progress, b: Progress): Progress {
  const dex: Record<string, DexEntry> = {}
  for (const [id, e] of Object.entries(b.dex)) dex[id] = { ...e }
  for (const [id, e] of Object.entries(a.dex)) {
    const o = dex[id]
    const bb = e.b ?? o?.b
    dex[id] = { f: (o?.f ?? 0) | e.f, ...(bb !== undefined ? { b: bb } : {}) }
  }
  const clan = { ...b.clan, ...a.clan }
  const won = [...new Set([...a.unlock.won, ...b.unlock.won])]
  const tut = a.unlock.tutorial === 'done' || b.unlock.tutorial === 'done' ? 'done' : (a.unlock.tutorial ?? b.unlock.tutorial)
  const tiers = maxRec(a.unlock.tiers, b.unlock.tiers)
  const nations = maxRec(a.unlock.nations, b.unlock.nations)
  const unlock: UnlockRec = { won, ...(tut !== undefined ? { tutorial: tut } : {}), ...(tiers !== undefined ? { tiers } : {}), ...(nations !== undefined ? { nations } : {}) }
  return { dex, clan, unlock, retain: a.retain ?? b.retain }
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
export interface LastSync { readonly seed: number; readonly rev: number; readonly updateTime: string }

/** fetch: 서버 판이 더 나아갔는데 갈라졌는지 모른다 — 받아서 lineage 로 가린다 */
export type Plan = 'none' | 'push' | 'pull' | 'fetch' | 'choose'

export function plan(local: LocalHead | null, remote: RemoteHead | null, last: LastSync | null): Plan {
  if (local === null && remote === null) return 'none'
  if (remote === null) return 'push'
  if (local === null) return 'pull'
  const localMoved = last === null || last.seed !== local.seed || last.rev !== local.rev
  const remoteMoved = last === null || last.updateTime !== remote.updateTime
  if (!localMoved && !remoteMoved) return 'none'
  if (!localMoved) return 'pull'
  if (!remoteMoved) return 'push'
  // 둘 다 나아갔다 (또는 처음 맞추는 기기 · 로그아웃했다 다시 들어옴). 같은 판이면 기록의 앞부분으로 가린다 — 한 줄기면 덮어도 잃는 계절이 없다
  if (local.seed !== remote.seed) return 'choose'
  if (local.rev >= remote.rev) return local.hashAt(remote.rev) === remote.h ? (local.rev === remote.rev ? 'none' : 'push') : 'choose'
  return 'fetch'
}

/** 서버 판을 받아 본 뒤 — 내 기록이 서버 기록의 앞부분이면 받고, 아니면 고른다 */
export function lineage(localLog: readonly unknown[], remoteLog: readonly unknown[]): 'pull' | 'choose' {
  return localLog.length <= remoteLog.length && logHash(remoteLog.slice(0, localLog.length)) === logHash(localLog) ? 'pull' : 'choose'
}
