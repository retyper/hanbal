/**
 * 손으로 하는 저장 · 불러오기 (형 10-26: "림월드랑 문명에도 있듯이 수동 저장이랑 불러오기도 만들어줘")
 *
 *  - 저장 칸 N개 (P.realm.saveSlots) — 칸마다 열쇠 하나 `hanbal.realm.save.<n>` + 목록 하나 `hanbal.realm.saves`
 *  - 파일로 내려받기 · 파일에서 불러오기 — 같은 모양의 JSON 한 장 (기기를 옮기거나 브라우저 저장이 날아가도 남는다)
 *
 * 여기는 글과 저장소 손잡이(KV)만 다룬다 — 화면(DOM)·시계는 부르는 쪽이 준다 (tests/realm/saves.test.ts).
 * 쓰기는 늘 「다 되거나, 하나도 안 바뀌거나」: 못 쓰면 칸·목록을 쓰기 전 그대로 되돌린다 (메모리: localStorage 되돌리기).
 */
import type { Order, Realm, Report } from '../../realm/types.ts'
import { seasonLabel } from '../../realm/data/prose.ts'
import { P } from '../../tune/params.ts'

/** 자동 저장 한 판 — realm-main 의 `hanbal.realm.v2` 와 같은 모양 */
export interface Saved {
  readonly v: 2
  readonly nation: string
  readonly seed: number
  readonly log: Order[][]
  readonly realm: Realm
  readonly before: Realm | null
  readonly report: Report | null
  /** 저장한 때 (ISO) — 첫 화면의 "○분 전 저장됨" */
  readonly at?: string
}

/** 저장 파일 한 장 — 칸에 넣는 것과 내려받는 파일이 같다 */
export interface SaveFile {
  readonly kind: typeof SAVE_KIND
  /** 파일 모양의 판 — 모양을 바꾸면 올리고, 읽는 쪽은 자기보다 새 것을 거절한다 */
  readonly fv: number
  /** 플레이어가 붙인 이름 (비우면 「3년 겨울 · 비화가야」) */
  readonly label: string
  /** 저장한 때 (ISO · 벽시계) */
  readonly savedAt: string
  readonly game: Saved
  /** 그 계절에 정해 둔 명령 (app.saveDraft 의 `hanbal.realm.draft`) — 같은 판·같은 계절일 때만 되살린다 */
  readonly draft: unknown
}

/** 저장 칸 목록의 한 줄 — 칸을 열지 않고도 그릴 수 있게 */
export interface SaveMeta {
  /** 칸 번호 (0 부터) */
  readonly n: number
  readonly label: string
  readonly nation: string
  /** 나라 이름 */
  readonly name: string
  readonly region: string
  readonly season: number
  readonly savedAt: string
}

/** 저장소 손잡이 — localStorage 와 같은 꼴 (시험에서는 Map 으로) */
export interface KV {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export const SAVE_KIND = 'hanbal.realm.save'
export const SAVE_FV = 1
export const SAVE_INDEX = 'hanbal.realm.saves'
export const saveKey = (n: number): string => `hanbal.realm.save.${n}`

/** 저장 칸 수 */
export const saveSlotCount = (): number => Math.max(1, Math.round(P.realm.saveSlots))

/** 비운 이름 대신 — 「3년 겨울 · 비화가야」 */
export function defaultLabel(r: Realm): string {
  return `${seasonLabel(r.season)} · ${r.factions[r.player]?.name ?? ''}`
}

/** 이름을 다듬는다 — 앞뒤 빈칸·줄바꿈을 걷고 한도까지 */
export function cleanLabel(s: string, r: Realm): string {
  const t = s.replace(/\s+/g, ' ').trim().slice(0, Math.max(1, Math.round(P.realm.saveNameMax)))
  return t === '' ? defaultLabel(r) : t
}

export function makeSaveFile(game: Saved, draft: unknown, label: string, savedAt: string): SaveFile {
  return { kind: SAVE_KIND, fv: SAVE_FV, label: cleanLabel(label, game.realm), savedAt, game, draft: draftFor(game, draft) }
}

/** 초안이 이 판·이 계절 것일 때만 담는다 — 다른 판의 초안은 버린다 */
function draftFor(game: Saved, draft: unknown): unknown {
  if (draft === null || typeof draft !== 'object') return null
  const d = draft as Record<string, unknown>
  return d['seed'] === game.realm.seed && d['season'] === game.realm.season && d['player'] === game.realm.player ? draft : null
}

export const serializeSave = (f: SaveFile): string => JSON.stringify(f)

export type Parsed = { readonly ok: true; readonly file: SaveFile } | { readonly ok: false; readonly why: string }

const BAD = '이 파일은 삼한열전 판으로 읽을 수 없습니다'

const isObj = (x: unknown): x is Record<string, unknown> => x !== null && typeof x === 'object' && !Array.isArray(x)

/** 판 하나의 뼈대 — 이것만 있으면 화면이 열린다 (나머지는 migrate 가 메운다) */
function realmOk(r: unknown): r is Realm {
  if (!isObj(r)) return false
  const f = r['factions']
  return typeof r['season'] === 'number' && Number.isFinite(r['season']) && typeof r['player'] === 'string' && typeof r['seed'] === 'number'
    && isObj(f) && isObj(f[r['player']]) && isObj(r['nodes']) && isObj(r['armies']) && isObj(r['heroes'])
}

function gameOk(g: unknown): g is Saved {
  if (!isObj(g) || g['v'] !== 2 || typeof g['nation'] !== 'string' || typeof g['seed'] !== 'number' || !Number.isFinite(g['seed'])) return false
  if (!realmOk(g['realm'])) return false
  if (g['before'] !== null && g['before'] !== undefined && !realmOk(g['before'])) return false
  if (g['report'] !== null && g['report'] !== undefined && !isObj(g['report'])) return false
  return g['log'] === undefined || Array.isArray(g['log'])
}

/** 빠진 칸을 메운다 — 옛 파일에 log·before·report 가 없을 수 있다 */
function fill(g: Saved): Saved {
  return { ...g, log: Array.isArray(g.log) ? g.log : [], before: g.before ?? null, report: g.report ?? null }
}

/**
 * 글 한 장을 저장 파일로 읽는다. 받아들이는 꼴 셋:
 *  1) 저장 파일 (`kind: hanbal.realm.save`) · 2) 자동 저장 한 판 (`v: 2`) · 3) 「기록 내보내기」 파일의 `save`
 * 못 읽으면 까닭을 쉬운 말로.
 */
export function parseSaveFile(text: string): Parsed {
  let o: unknown
  try { o = JSON.parse(text) } catch { return { ok: false, why: BAD } }
  if (!isObj(o)) return { ok: false, why: BAD }
  if (o['kind'] === SAVE_KIND) {
    if (typeof o['fv'] !== 'number') return { ok: false, why: BAD }
    if (o['fv'] > SAVE_FV) return { ok: false, why: '더 새 게임에서 만든 파일이다 — 게임을 새로 고친 뒤 다시 불러온다' }
    if (!gameOk(o['game'])) return { ok: false, why: '판이 깨져 있다 — 불러오지 않았다' }
    const game = fill(o['game'])
    const label = typeof o['label'] === 'string' ? cleanLabel(o['label'], game.realm) : defaultLabel(game.realm)
    return { ok: true, file: { kind: SAVE_KIND, fv: SAVE_FV, label, savedAt: typeof o['savedAt'] === 'string' ? o['savedAt'] : (game.at ?? ''), game, draft: draftFor(game, o['draft']) } }
  }
  const g = o['v'] === 2 ? o : isObj(o['save']) ? o['save'] : null
  if (g === null) return { ok: false, why: BAD }
  if (!gameOk(g)) return { ok: false, why: '판이 깨져 있다 — 불러오지 않았다' }
  const game = fill(g)
  return { ok: true, file: { kind: SAVE_KIND, fv: SAVE_FV, label: defaultLabel(game.realm), savedAt: game.at ?? '', game, draft: draftFor(game, o['draft']) } }
}

export function metaOf(n: number, f: SaveFile): SaveMeta {
  const r = f.game.realm
  return { n, label: f.label, nation: f.game.nation, name: r.factions[r.player]?.name ?? '', region: r.region ?? 'byeonhan-mini', season: r.season, savedAt: f.savedAt }
}

/** 내려받을 파일 이름 — `삼한열전-비화가야-3년겨울.json` (파일 이름에 못 쓰는 글자는 뺀다) */
export function saveFileName(f: SaveFile): string {
  const r = f.game.realm
  const raw = `삼한열전-${r.factions[r.player]?.name ?? f.game.nation}-${seasonLabel(r.season)}`
  return `${raw.replace(/[\\/:*?"<>|\s]+/g, '')}.json`
}

// ───────── 칸 — 목록 하나 + 칸마다 열쇠 하나

export function readIndex(kv: KV): SaveMeta[] {
  let v: unknown
  try { v = JSON.parse(kv.getItem(SAVE_INDEX) ?? '[]') } catch { return [] }
  if (!Array.isArray(v)) return []
  const out: SaveMeta[] = []
  for (const m of v) {
    if (!isObj(m) || typeof m['n'] !== 'number' || !Number.isInteger(m['n']) || m['n'] < 0 || out.some((x) => x.n === m['n'])) continue
    out.push({
      n: m['n'], label: String(m['label'] ?? ''), nation: String(m['nation'] ?? ''), name: String(m['name'] ?? ''),
      region: String(m['region'] ?? ''), season: typeof m['season'] === 'number' ? m['season'] : 0, savedAt: String(m['savedAt'] ?? ''),
    })
  }
  return out.sort((a, b) => a.n - b.n)
}

/** 칸 N개 — 빈 칸은 null */
export function listSaves(kv: KV, count = saveSlotCount()): Array<SaveMeta | null> {
  const idx = readIndex(kv)
  return Array.from({ length: count }, (_, n) => idx.find((m) => m.n === n) ?? null)
}

export type Wrote = { readonly ok: true; readonly meta: SaveMeta } | { readonly ok: false; readonly why: 'full' | 'slot' }

/**
 * 칸 n 에 쓴다 — 칸을 쓰고, 다시 읽어 맞는지 보고, 목록을 쓴다. 어디서든 막히면 칸을 쓰기 전 것으로 되돌린다
 * (다른 칸·자동 저장·선반은 건드리지 않는다 — 자리를 내려고 무엇도 지우지 않는다)
 */
export function writeSave(kv: KV, n: number, f: SaveFile, count = saveSlotCount()): Wrote {
  if (!Number.isInteger(n) || n < 0 || n >= count) return { ok: false, why: 'slot' }
  const key = saveKey(n)
  const json = serializeSave(f)
  let old: string | null = null
  try { old = kv.getItem(key) } catch { old = null }
  const undo = (): void => {
    try { if (old === null) kv.removeItem(key); else kv.setItem(key, old) } catch { /* 쓰기 전과 같은 크기 — 되돌리기는 들어간다 */ }
  }
  try { kv.setItem(key, json) } catch { undo(); return { ok: false, why: 'full' } }
  let same = false
  try { same = kv.getItem(key) === json } catch { same = false }
  if (!same) { undo(); return { ok: false, why: 'full' } }
  const meta = metaOf(n, f)
  const idx = [...readIndex(kv).filter((m) => m.n !== n), meta].sort((a, b) => a.n - b.n)
  try { kv.setItem(SAVE_INDEX, JSON.stringify(idx)) } catch { undo(); return { ok: false, why: 'full' } }
  return { ok: true, meta }
}

/** 칸 n 을 읽는다 — 비었거나 깨졌으면 까닭 */
export function readSave(kv: KV, n: number): Parsed {
  let raw: string | null = null
  try { raw = kv.getItem(saveKey(n)) } catch { raw = null }
  if (raw === null) return { ok: false, why: '빈 칸이다' }
  const p = parseSaveFile(raw)
  return p.ok ? p : { ok: false, why: '이 칸의 판이 깨져 있다 — 불러오지 않았다' }
}

/** 칸 n 을 비운다 — 목록에서 먼저 빼고 칸을 지운다. 목록을 못 쓰면 칸도 그대로 둔다 */
export function dropSave(kv: KV, n: number): boolean {
  const idx = readIndex(kv)
  try { kv.setItem(SAVE_INDEX, JSON.stringify(idx.filter((m) => m.n !== n))) } catch { return false }
  try { kv.removeItem(saveKey(n)) } catch { /* 목록에서 빠졌으면 안 보인다 · 다음 저장이 덮는다 */ }
  return true
}
