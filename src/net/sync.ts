/**
 * 판 맞추기 — 기기가 먼저, 서버는 뒤따른다 (docs/realm/SERVER.md §3)
 *
 * realm-main 이 판(Saved)과 판 기록을 쥐고, 여기는 그것을 서버와 맞춘다. 엔진은 이 파일을 모른다 (A1).
 *  - 열 때: 판의 얼굴(seed·rev·h)만 읽어 plan → 올리기/받기/묻기 · 판 밖에 쌓인 것은 받아 합친다
 *  - 계절을 넘길 때: 2분 묶음으로 올린다 · 탭이 가려질 때 미뤄 둔 것을 올린다(keepalive)
 *  - 올릴 때 updateTime 을 조건으로 — 그사이 다른 기기가 썼으면 다시 셈한다 (몰래 덮지 않는다)
 */
import { account, idToken } from './auth.ts'
import { EMPTY, lineage, logHash, mergeProgress, plan, sameProgress, type LastSync, type LocalHead, type Progress, type RemoteHead } from './bundle.ts'
import { commit, FsError, getDoc, listIds, type Write } from './firestore.ts'

/** 올리기 묶음 — 마지막 올림에서 이만큼은 미룬다 (무료 칸의 쓰기를 아낀다, S6) */
const PUSH_GAP_MS = 120_000
/** keepalive fetch 의 몸 한계 (브라우저 64KB) — 넘으면 다음 열 때 올린다 */
const KEEPALIVE_MAX = 60_000
/** 판 기록이 gzip 해도 이보다 크면 누른 것(taps)을 덜고 올린다 (보안 규칙의 900KB 아래로) */
const RECORD_MAX = 800_000
const SYNC_KEY = 'hanbal.sync'
const DEVICE_KEY = 'hanbal.device'
const OTHER_KEY = 'hanbal.realm.v2.other'
const PROGRESS_KEYS = { dex: 'hanbal.realm.dex', clan: 'hanbal.realm.clan', unlock: 'hanbal.realm.unlock', retain: 'hanbal.realm.retain' } as const

/** 판 한 벌 — realm-main 의 Saved (여기는 쓰는 칸만 안다) */
export interface SaveLike {
  readonly seed: number
  readonly nation: string
  readonly log: readonly unknown[]
  readonly realm: { readonly season: number; readonly region?: string; readonly tier?: number; readonly outcome?: { kind: string } | null; readonly factions: Record<string, { name: string }>; readonly player: string }
  readonly at?: string
}

export interface SyncHost {
  /** 지금 이 기기의 판 — 없으면 null */
  local(): SaveLike | null
  /** 지금 판의 기록 (realm-main GameRecord) — 없으면 null */
  record(): { seed: number; nation: string; started: string; end: unknown; turns: Array<{ taps?: unknown[] }> } | null
  /** 서버에서 받은 판으로 바꾼다 (JSON 그대로 · 기록이 있으면 같이). 판을 새로 연다 */
  adopt(saveJson: string, recordJson: string | null): void
}

export interface Side { readonly nation: string; readonly season: number; readonly region: string; readonly savedAt: string }
export type SyncState =
  | { readonly kind: 'off' }
  | { readonly kind: 'idle'; readonly at: string | null }
  | { readonly kind: 'busy' }
  | { readonly kind: 'error'; readonly msg: string }
  | { readonly kind: 'choose'; readonly here: Side; readonly there: Side }

// ───────── gzip (CompressionStream — 없는 곳은 맞추기를 끈다)

export const canSync = (): boolean => typeof CompressionStream === 'function' && typeof DecompressionStream === 'function'

async function gz(text: string): Promise<Uint8Array> {
  const s = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))
  return new Uint8Array(await new Response(s).arrayBuffer())
}
async function gunzip(b: Uint8Array): Promise<string> {
  const s = new Blob([b as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Response(s).text()
}

// ───────── 기기 칸

function readJson<T>(key: string, def: T): T {
  try { const v = JSON.parse(localStorage.getItem(key) ?? 'null') as T | null; return v ?? def } catch { return def }
}
function writeJson(key: string, v: unknown): void {
  try { if (v === null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(v)) } catch { /* 저장 못 하는 곳 */ }
}
function localProgress(): Progress {
  return {
    dex: readJson(PROGRESS_KEYS.dex, {}), clan: readJson(PROGRESS_KEYS.clan, {}),
    unlock: { ...readJson(PROGRESS_KEYS.unlock, { won: [] as string[] }) }, retain: readJson<unknown>(PROGRESS_KEYS.retain, null),
  }
}
function writeProgress(p: Progress): void {
  writeJson(PROGRESS_KEYS.dex, p.dex); writeJson(PROGRESS_KEYS.clan, p.clan); writeJson(PROGRESS_KEYS.unlock, p.unlock); writeJson(PROGRESS_KEYS.retain, p.retain)
}
function deviceId(): string {
  let id = ''
  try { id = localStorage.getItem(DEVICE_KEY) ?? '' } catch { id = '' }
  if (id === '') { id = [...crypto.getRandomValues(new Uint8Array(8))].map((b) => b.toString(16).padStart(2, '0')).join(''); try { localStorage.setItem(DEVICE_KEY, id) } catch { /* 저장 못 하는 곳 */ } }
  return id
}

const head = (s: SaveLike): LocalHead => ({ seed: s.seed, rev: s.log.length, hashAt: (n) => logHash(s.log.slice(0, n)) })
const sideOf = (s: SaveLike): Side => ({
  nation: s.realm.factions[s.realm.player]?.name ?? s.nation, season: s.realm.season, region: s.realm.region ?? 'byeonhan-mini', savedAt: s.at ?? '',
})

// ───────── 맞추기

export function makeSync(host: SyncHost, onChange: (s: SyncState) => void): {
  state(): SyncState
  /** 열 때 · 로그인 직후 */
  start(): Promise<void>
  /** 계절을 넘겼다 (판 끝이면 force) */
  dirty(force?: boolean): void
  /** 탭이 가려질 때 — 미뤄 둔 것을 올린다 */
  flush(): void
  /** 둘이 갈라졌을 때 형이 고른 쪽 */
  choose(pick: 'here' | 'there'): Promise<void>
  /** 계정 지우기 — 서버의 내 자료를 다 지운다 (기기 판은 남는다) */
  wipe(): Promise<void>
  /** 로그아웃 — 맞춘 자리를 잊는다 */
  forget(): void
} {
  let st: SyncState = account() !== null && canSync() ? { kind: 'idle', at: null } : { kind: 'off' }
  let lastPush = 0
  let pending = false
  let timer = 0
  let busy = false
  /** 고르기 중인 서버 판의 updateTime — 이 기기 것을 고르면 이걸 조건으로 덮는다 */
  let chooseRemote: RemoteHead | null = null

  const set = (s: SyncState): void => { st = s; onChange(s) }
  const last = (): LastSync | null => readJson<LastSync | null>(SYNC_KEY, null)
  const remember = (l: LastSync | null): void => writeJson(SYNC_KEY, l)
  const uidPath = (): string | null => { const a = account(); return a === null ? null : `users/${a.uid}` }

  async function remoteHead(base: string, token: string): Promise<RemoteHead | null> {
    const d = await getDoc(`${base}/saves/main`, token, ['seed', 'rev', 'h', 'savedAt', 'meta'])
    if (d === null) return null
    return { seed: Number(d.fields['seed']), rev: Number(d.fields['rev']), h: String(d.fields['h'] ?? ''), updateTime: d.updateTime }
  }

  async function pullSave(base: string, token: string): Promise<{ json: string; seed: number; rev: number; updateTime: string; log: unknown[] } | null> {
    const d = await getDoc(`${base}/saves/main`, token)
    if (d === null) return null
    const json = await gunzip(d.fields['data'] as Uint8Array)
    const s = JSON.parse(json) as SaveLike
    return { json, seed: s.seed, rev: s.log.length, updateTime: d.updateTime, log: [...s.log] }
  }

  async function adopt(base: string, token: string, p: { json: string; seed: number; rev: number; updateTime: string }): Promise<void> {
    const mine = host.local()
    if (mine !== null) writeJson(OTHER_KEY, mine) // 고르지 않은 쪽도 한 벌 남긴다
    const rec = await getDoc(`${base}/records/${p.seed}`, token)
    const recJson = rec !== null && rec.fields['data'] instanceof Uint8Array ? await gunzip(rec.fields['data']) : null
    remember({ seed: p.seed, rev: p.rev, updateTime: p.updateTime })
    host.adopt(p.json, recJson)
  }

  /** 판(과 기록·판 밖에 쌓인 것)을 올린다. ifUpdateTime: 서버 판의 지금 updateTime(없으면 null) */
  async function push(base: string, token: string, ifUpdateTime: string | null, keepalive = false): Promise<void> {
    const s = host.local()
    if (s === null) return
    const data = await gz(JSON.stringify(s))
    const writes: Write[] = [{
      kind: 'set', path: `${base}/saves/main`, ifUpdateTime, stamp: 'updatedAt',
      data: {
        v: 1, fmt: 'gz', data, seed: s.seed, rev: s.log.length, h: logHash(s.log), savedAt: s.at ?? new Date().toISOString(),
        meta: { nation: s.nation, nationName: sideOf(s).nation, region: sideOf(s).region, tier: s.realm.tier ?? 1, season: s.realm.season, outcome: s.realm.outcome?.kind ?? null },
        device: { id: deviceId(), kind: 'web' },
      },
    }]
    const rec = host.record()
    if (rec !== null && !keepalive) {
      let rd = await gz(JSON.stringify(rec))
      if (rd.length > RECORD_MAX) rd = await gz(JSON.stringify({ ...rec, turns: rec.turns.map((t) => ({ ...t, taps: [] })) }))
      if (rd.length <= RECORD_MAX) writes.push({ kind: 'set', path: `${base}/records/${rec.seed}`, stamp: 'updatedAt', data: { v: 1, fmt: 'gz', data: rd, nation: rec.nation, region: s.realm.region ?? '', started: rec.started, end: rec.end ?? null } })
    }
    if (keepalive && data.length > KEEPALIVE_MAX) return // 다음 열 때 올린다
    const times = await commit(writes, token, keepalive)
    remember({ seed: s.seed, rev: s.log.length, updateTime: times[0] ?? '' })
    lastPush = Date.now()
    pending = false
  }

  /** 판 밖에 쌓인 것 — 받아 합치고, 달라졌으면 기기에 쓰고, 서버와 다르면 올린다 */
  async function progress(base: string, token: string): Promise<void> {
    const d = await getDoc(base, token)
    const remote: Progress = d !== null && typeof d.fields['progress'] === 'string' ? { ...EMPTY, ...(JSON.parse(d.fields['progress']) as Partial<Progress>) } : EMPTY
    const here = localProgress()
    const merged = mergeProgress(here, remote)
    if (!sameProgress(merged, here)) writeProgress(merged)
    if (d === null || !sameProgress(merged, remote)) await commit([{ kind: 'set', path: base, stamp: 'updatedAt', data: { v: 1, progress: JSON.stringify(merged) } }], token)
  }

  const fail = (e: unknown): void => { set({ kind: 'error', msg: e instanceof Error ? e.message : String(e) }) }

  async function run(retry = 0): Promise<void> {
    const base = uidPath()
    if (base === null || !canSync()) { set({ kind: 'off' }); return }
    if (busy) return
    busy = true
    set({ kind: 'busy' })
    try {
      const token = await idToken()
      if (token === null) { set({ kind: 'off' }); return }
      await progress(base, token)
      const local = host.local()
      const remote = await remoteHead(base, token)
      let p = plan(local !== null ? head(local) : null, remote, last())
      let pulled: Awaited<ReturnType<typeof pullSave>> = null
      if (p === 'fetch') {
        pulled = await pullSave(base, token)
        p = pulled !== null && local !== null ? lineage(local.log, pulled.log) : 'pull'
      }
      if (p === 'push') await push(base, token, remote?.updateTime ?? null)
      else if (p === 'pull') { pulled ??= await pullSave(base, token); if (pulled !== null) { await adopt(base, token, pulled); return } }
      else if (p === 'choose' && local !== null && remote !== null) {
        const meta = (await getDoc(`${base}/saves/main`, token, ['meta', 'savedAt']))?.fields ?? {}
        const m = (meta['meta'] ?? {}) as { nationName?: string; season?: number; region?: string }
        chooseRemote = remote
        set({ kind: 'choose', here: sideOf(local), there: { nation: m.nationName ?? '', season: m.season ?? 0, region: m.region ?? '', savedAt: String(meta['savedAt'] ?? '') } })
        return
      } else if (p === 'none' && remote !== null && local !== null) remember({ seed: local.seed, rev: local.log.length, updateTime: remote.updateTime })
      set({ kind: 'idle', at: new Date().toISOString() })
    } catch (e) {
      if (e instanceof FsError && e.conflict && retry < 2) { busy = false; await run(retry + 1); return } // 그사이 다른 기기가 썼다 — 다시 셈한다
      fail(e)
    } finally {
      busy = false
    }
  }

  const later = (): void => {
    if (timer !== 0 || document.visibilityState !== 'visible') return
    timer = window.setTimeout(() => { timer = 0; if (pending) void run() }, Math.max(0, PUSH_GAP_MS - (Date.now() - lastPush)))
  }

  return {
    state: () => st,
    start: () => run(),
    dirty(force = false) {
      if (st.kind === 'off' || st.kind === 'choose') return
      pending = true
      if (force || Date.now() - lastPush >= PUSH_GAP_MS) void run()
      else later()
    },
    flush() {
      if (timer !== 0) { clearTimeout(timer); timer = 0 }
      if (!pending || st.kind === 'off' || st.kind === 'choose' || busy) return
      const base = uidPath()
      if (base === null) return
      // 가려지는 중 — 토큰이 살아 있을 때만, 판만, keepalive 로
      void idToken().then((t) => (t !== null ? push(base, t, last()?.updateTime ?? null, true) : undefined)).catch(() => { /* 다음 열 때 */ })
    },
    async choose(pick) {
      const base = uidPath()
      const remote = chooseRemote
      if (base === null || remote === null) return
      chooseRemote = null
      set({ kind: 'busy' })
      try {
        const token = await idToken()
        if (token === null) { set({ kind: 'off' }); return }
        if (pick === 'there') {
          const p = await pullSave(base, token)
          if (p !== null) { await adopt(base, token, p); return }
        } else {
          // 서버 판도 한 벌 남기고 덮는다
          const p = await pullSave(base, token)
          if (p !== null) try { localStorage.setItem(OTHER_KEY, p.json) } catch { /* 저장 못 하는 곳 */ }
          await push(base, token, remote.updateTime)
        }
        set({ kind: 'idle', at: new Date().toISOString() })
      } catch (e) { fail(e) }
    },
    async wipe() {
      const base = uidPath()
      if (base === null) return
      const token = await idToken()
      if (token === null) return
      const recs = await listIds(`${base}/records`, token)
      const writes: Write[] = [...recs.map((id) => ({ kind: 'delete' as const, path: `${base}/records/${id}` })), { kind: 'delete', path: `${base}/saves/main` }, { kind: 'delete', path: base }]
      for (let i = 0; i < writes.length; i += 400) await commit(writes.slice(i, i + 400), token)
      remember(null)
    },
    forget() { remember(null); if (timer !== 0) { clearTimeout(timer); timer = 0 } pending = false; set({ kind: 'off' }) },
  }
}
