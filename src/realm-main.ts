/**
 * 칠십팔국 시험판 — 앱 화면의 진입점 (realm.html, docs/realm/FLOW.md)
 *
 * 활터(index.html)와 번들을 나눴다: 시험판이 기존 게임의 첫 화면·예산을 건드리지 않게.
 * 저장은 `hanbal.realm.v2` — 고른 나라 · 판 시작 시드 + 계절마다 명령 기록 + 최신 판.
 * v1(나라 고르기·살림 전) 저장은 이어 받지 않는다 — 판의 모양이 달라졌다. 나라 고르기부터 다시.
 * 활터의 저장(`hanbal.save.v1`)은 건드리지 않는다.
 *
 * **판 기록** (`hanbal.realm.games`, 형: "내가 테스트하는 모든 기록도 다 데이터로서 저장해" — 2026-10-18):
 * 판마다 나라·시드·계절마다 내 명령·보고·내 살림·고민한 시간·누른 것. 새 판을 열어도 지난 판은 남는다.
 * 나라 판의 "기록 내보내기"로 JSON 한 장을 받고, tools/realm-records.ts 로 읽는다.
 */
import { startGfxSafe } from './ui/gfxsafe.ts'
// 갤럭시(Xclipse) 크롬은 부드러운 그러데이션·filter 색 함수를 못 그린다 — 그 기기에서만 되는 꼴로 바꿔 끼운다 (gfxsafe.ts · 형 10-28)
startGfxSafe()
import { startRegion } from './realm/data/regions/index.ts'
import { headcount } from './realm/battle.ts'
import { forceOf } from './realm/season.ts'
import { isOldTutorial, migrate, remapOldTutorial, remapOldTutorialJson } from './realm/migrate.ts'
import type { Order, Realm, RegionId, ReportLine } from './realm/types.ts'
import { mountRealmApp } from './ui/realm/app.ts'
import { takeRetainers } from './ui/realm/legacy.ts'
import { clanHeroes } from './ui/realm/dex.ts'
import { account, deleteAccount, finishSignIn, signIn, signOut } from './net/auth.ts'
import { canSync, makeSync } from './net/sync.ts'
import { bringRetainers } from './realm/legacy.ts'
import { drillRealm } from './realm/drill.ts'
import { loadDrill } from './ui/realm/drill.ts'
import { relicRealm } from './realm/relics.ts'
import { loadRelics } from './ui/realm/relics.ts'
import { dexCatalog } from './realm/dex.ts'
import { applyTier } from './realm/tier.ts'
import { watchUpdates } from './ui/realm/update.ts'
import { pinPage } from './ui/realm/scroll.ts'
import type { SlotInfo } from './ui/realm/front.ts'
import { defaultLabel, dropSave, listSaves, makeSaveFile, parseSaveFile, readSave, saveFileName, writeSave, type KV, type Saved, type SaveFile } from './ui/realm/saves.ts'
import { P } from './tune/params.ts'

const KEY = 'hanbal.realm.v2'
/** 한 계절 앞의 저장 — 지금 것이 깨졌으면 이걸로 되살린다 */
const PREV = 'hanbal.realm.v2.prev'
const GAMES = 'hanbal.realm.games'
/**
 * 다른 판 — 새 판을 열거나 다른 판으로 옮기면 하던 판(안 끝난 것)이 여기 남는다 (형 10-25: "본인이 하던 게임 저장된 거는 골라서 플레이할 수 있어야 ·
 * 마지막 자동저장이 맨 위에 있는 게 맞지만"). 판마다 열쇠 하나(시드) + 목록 하나. 이 기기에만 — 계정 맞추기는 지금 판만 간다
 */
const SLOTS = 'hanbal.realm.slots'
const slotKey = (seed: number): string => `hanbal.realm.slot.${seed}`
/** 남겨 두는 판 수 — 넘치면 가장 오래 안 한 판부터 뺀다 */
const SLOT_MAX = 6
/** 판 기록이 이보다 커지면 오래된 판부터 누른 것을 덜고, 그래도 크면 판을 덜어 낸다 (localStorage 는 5MB 안팎) */
const GAMES_MAX_CHARS = 3_000_000

/** 이번 계절에 정해 둔 명령 (app.ts 의 DRAFT_KEY) — 손 저장에 함께 담는다 */
const DRAFT = 'hanbal.realm.draft'

/** 한 계절의 기록 */
interface Turn {
  /** 넘긴 계절 번호 */
  readonly s: number
  /** 넘긴 때 (벽시계) */
  readonly at: string
  /** 그 계절을 붙잡고 있던 시간 (ms) */
  readonly ms: number
  /** 내 명령 */
  readonly orders: Order[]
  readonly lines: readonly ReportLine[]
  /** 넘긴 뒤 내 살림 */
  readonly me: { nodes: number; hh: number; men: number; grain: number; iron: number }
  /** 누른 것 — [계절 시작부터 ms, 손짓, 대상] */
  taps: Array<[number, string, string]>
}

interface GameRecord {
  readonly v: 1
  readonly nation: string
  /** 판 · 나라 이름 · 난세 단계 — 「나의 역사」에 (10-25 부터 적는다 · 옛 기록엔 없다) */
  readonly region?: string
  readonly name?: string
  readonly tier?: number
  readonly seed: number
  readonly started: string
  readonly screen: string
  turns: Turn[]
  end: { kind: 'win' | 'lose' | 'quit'; season: number; at: string } | null
}

function load(): Saved | null {
  return loadFrom(KEY) ?? loadFrom(PREV)
}

function loadFrom(key: string): Saved | null {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return null
    const s = JSON.parse(raw) as Saved
    if (s.v !== 2) return null
    return normalize(s)
  } catch {
    return null
  }
}

/** 옛 판을 지금 모양으로 — 자동 저장·선반·손 저장·파일 모두 이 길로 연다 */
function normalize(s0: Saved): Saved | null {
  try {
    let s = s0
    // 옛 배우는 판(골포·가락) → 한강 아래 백제·미추홀 — 하던 자리 그대로 잇는다 (migrate.remapOldTutorial)
    if (isOldTutorial(s.realm)) {
      const fresh = startRegion('tutorial', s.seed, 'baekje')
      s = { ...s, nation: 'baekje', realm: remapOldTutorial(s.realm, fresh), before: s.before !== null ? remapOldTutorial(s.before, fresh) : null, report: s.report !== null ? remapOldTutorialJson(s.report) : null, log: remapOldTutorialJson(s.log) }
    }
    // 옛 판이면 사람의 눈금을 키운다 (migrate.ts — 위서 동이전의 규모)
    if (s.realm) migrate(s.realm)
    if (s.before) migrate(s.before)
    return s
  } catch {
    return null
  }
}

function save(s: Saved): Saved {
  const out: Saved = { ...s, at: new Date().toISOString() }
  try {
    const old = localStorage.getItem(KEY)
    if (old !== null) localStorage.setItem(PREV, old)
  } catch {
    // 앞 저장을 못 옮겨도 지금 것은 쓴다
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(out))
  } catch {
    // 저장이 막힌 창(사생활 보호 모드) — 판은 계속 돈다, 다음에 이어서 못 할 뿐
  }
  return out
}

function loadSlots(): SlotInfo[] {
  try {
    const v = JSON.parse(localStorage.getItem(SLOTS) ?? '[]') as SlotInfo[]
    return Array.isArray(v) ? v.filter((x) => typeof x?.seed === 'number') : []
  } catch {
    return []
  }
}

function writeSlots(xs: readonly SlotInfo[]): void {
  try { localStorage.setItem(SLOTS, JSON.stringify(xs)) } catch { /* 목록을 못 쓰면 다음에 다시 */ }
}

/**
 * 하던 판을 올릴 선반 자리 — 보통은 그 판의 시드. 옮겨 갈 판이 같은 판(같은 시드)의 다른 때면(손 저장을 불러올 때) 새 자리를 낸다:
 * 시드 자리에 두면 「다른 판」 목록이 지금 판과 같은 시드라 가리고, 그 판을 다시 선반에 올릴 때 덮어쓴다
 */
function shelfIdFor(pick: Saved): number {
  if (state === null || state.seed !== pick.seed) return state?.seed ?? 0
  const used = new Set(loadSlots().map((x) => x.seed))
  let id = Date.now() % 0x7fffffff
  while (used.has(id) || id === pick.seed) id = (id + 1) % 0x7fffffff
  return id
}

/**
 * 하던 판을 선반에 — 끝난 판은 안 남긴다(첫 화면이 이어 하지 않는 판). 자리가 모자라면 가장 오래된 판부터 빼고 다시 쓴다.
 * 써졌는지 다시 읽어 확인한다 — 못 썼으면 false (부르는 쪽은 지금 판을 덮지 않는다)
 */
function shelve(s: Saved | null, id = s?.seed ?? 0): boolean {
  if (s === null) return true
  const r = s.realm
  if (r.outcome && !(r.endless === true && r.outcome.kind === 'win')) return true
  let xs = loadSlots().filter((x) => x.seed !== id)
  const json = JSON.stringify(s)
  for (;;) {
    try {
      localStorage.setItem(slotKey(id), json)
      break
    } catch {
      const old = [...xs].sort((a, b) => (a.at < b.at ? -1 : 1))[0]
      if (old === undefined) return false
      try { localStorage.removeItem(slotKey(old.seed)) } catch { /* 그대로 */ }
      xs = xs.filter((x) => x.seed !== old.seed)
    }
  }
  let ok = false
  try { ok = localStorage.getItem(slotKey(id)) === json } catch { ok = false }
  if (!ok) return false
  xs = [{ seed: id, nation: s.nation, name: r.factions[r.player]?.name ?? '', region: r.region ?? 'byeonhan-mini', season: r.season, at: s.at ?? new Date().toISOString() }, ...xs]
  while (xs.length > SLOT_MAX) {
    const drop = xs.pop()!
    try { localStorage.removeItem(slotKey(drop.seed)) } catch { /* 그대로 */ }
  }
  writeSlots(xs)
  return true
}

/**
 * 고른 판을 지금 판으로 — 하던 판을 선반에 확실히 올린 뒤, 고른 판을 KEY 에 써 보고 써졌을 때만 바꾼다.
 * 어디서든 막히면 지금 판·자동 저장은 그대로 두고 까닭을 돌려준다 (메모리: localStorage 되돌리기)
 */
function switchTo(pick: Saved): string | null {
  if (!shelve(state, shelfIdFor(pick))) return '지금 판을 「다른 판」에 남길 자리가 모자라다 — 판을 바꾸지 않았다. 「파일로 내려받기」로 지금 판을 남겨 두자.'
  const out: Saved = { ...pick, at: new Date().toISOString() }
  const json = JSON.stringify(out)
  let old: string | null = null
  try { old = localStorage.getItem(KEY) } catch { old = null }
  let ok = false
  try { localStorage.setItem(KEY, json); ok = localStorage.getItem(KEY) === json } catch { ok = false }
  if (!ok) {
    if (old !== null) { try { localStorage.setItem(KEY, old) } catch { /* 쓰기 전과 같은 것 — 들어간다 */ } }
    return '고른 판을 쓸 자리가 모자라다 — 판을 바꾸지 않았다. 지금 판은 그대로다.'
  }
  if (old !== null) { try { localStorage.setItem(PREV, old) } catch { /* 한 계절 앞 저장은 못 옮겨도 된다 · 지금 판은 선반에 있다 */ } }
  state = out
  game = recordFor(state)
  turnStart = Date.now()
  taps = []
  sync.dirty(true)
  return null
}

/** 저장소 손잡이 — 손 저장 칸 (ui/realm/saves.ts) */
const kv: KV = {
  getItem: (k) => localStorage.getItem(k),
  setItem: (k, v) => localStorage.setItem(k, v),
  removeItem: (k) => localStorage.removeItem(k),
}

/** 이번 계절에 정해 둔 명령 — 손 저장·파일에 함께 */
function draftNow(): unknown {
  try { return JSON.parse(localStorage.getItem(DRAFT) ?? 'null') as unknown } catch { return null }
}

/** 손 저장(칸·파일) 하나를 연다 — 판을 바꾼 뒤 그때 정해 둔 명령을 되살린다 (app.show 의 restoreDraft 가 읽는다) */
function openSave(f: SaveFile): string | null {
  const pick = normalize(f.game)
  if (pick === null) return '판이 깨져 있다 — 불러오지 않았다'
  const why = switchTo(pick)
  if (why !== null) return why
  try { localStorage.setItem(DRAFT, JSON.stringify(f.draft ?? null)) } catch { /* 명령 없이 그 계절 처음부터 */ }
  app.show(state!.realm, state!.before, state!.report)
  return null
}

/** 파일로 내려받는다 — 「기록 내보내기」와 같은 길 (Blob + a.download) */
function download(name: string, body: string): void {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([body], { type: 'application/json' }))
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000) // 바로 거두면 받기가 끊기는 브라우저가 있다 — 한 번만 도는 정리
}

function loadGames(): GameRecord[] {
  try {
    const raw = localStorage.getItem(GAMES)
    const g = raw === null ? [] : (JSON.parse(raw) as GameRecord[])
    return Array.isArray(g) ? g : []
  } catch {
    return []
  }
}

function saveGames(games: GameRecord[]): void {
  try {
    let json = JSON.stringify(games)
    // 넘치면: 오래된 판의 누른 것부터, 그다음 오래된 판 통째로. 지금 판은 남긴다
    for (let i = 0; json.length > GAMES_MAX_CHARS && i < games.length - 1; i++) {
      for (const t of games[i]!.turns) t.taps = []
      json = JSON.stringify(games)
    }
    while (json.length > GAMES_MAX_CHARS && games.length > 1) {
      games.shift()
      json = JSON.stringify(games)
    }
    localStorage.setItem(GAMES, json)
  } catch {
    // 위와 같다
  }
}

function fresh(nation: string, region: RegionId, tier = 1): Saved {
  // 시드는 화면 바깥(ui)에서만 시계로 만든다 — realm 안에서는 시계를 못 읽는다 (절대 규칙 1)
  const seed = (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0
  const realm = startRegion(region, seed, nation)
  applyTier(realm, tier) // 난세 단계 — 이웃이 처음부터 세다 (tier.ts)
  bringRetainers(realm, takeRetainers(region, tier, (id) => dexCatalog().find((x) => x.id === id)?.hero ?? clanHeroes().find((x) => x.id === id)?.hero)) // 동행 — 영웅전에서 고른 이가 우리 도읍에 (VISION §5-4 · 형 10-25)
  drillRealm(realm, loadDrill()) // 단련 — 우리 장수(처음 장수 · 군주 · 동행)가 단련터에서 키운 몸으로 (HERO-GROWTH ★ 둘째 판 · 난세 단계와 상관없이)
  relicRealm(realm, loadRelics().wear) // 유물 — 단련터에서 끼운 껴묻거리를 지니고 온다 (HERO-GROWTH ★ §B · 칸 수는 단련 단계로)
  return { v: 2, nation, seed, log: [], realm, before: null, report: null }
}

function myLot(r: Realm): Turn['me'] {
  const me = r.player
  const nodes = Object.values(r.nodes).filter((n) => n.owner === me)
  const st = r.stock[me] ?? { grain: 0, iron: 0 }
  return {
    nodes: nodes.length,
    hh: Math.round(nodes.reduce((s, n) => s + n.hh, 0)),
    men: Object.values(r.armies).filter((a) => a.faction === me).reduce((s, a) => s + headcount(forceOf(r, a)), 0),
    grain: Math.round(st.grain),
    iron: Math.round(st.iron),
  }
}

let state: Saved | null = load()
const games = loadGames()
/** 지금 판의 기록 — 시드로 찾는다. 기록 전에 시작한 판이면 지금부터 적는다 */
let game: GameRecord | null = null
let turnStart = Date.now()
let taps: Turn['taps'] = []

function recordFor(s: Saved): GameRecord {
  const had = games.find((g) => g.seed === s.seed && g.nation === s.nation)
  if (had !== undefined) return had
  const g: GameRecord = {
    v: 1, nation: s.nation, region: s.realm.region ?? 'byeonhan-mini', name: s.realm.factions[s.realm.player]?.name ?? '', tier: s.realm.tier ?? 1, seed: s.seed, started: new Date().toISOString(),
    screen: `${window.innerWidth}x${window.innerHeight}`, turns: [], end: null,
  }
  games.push(g)
  return g
}

if (state !== null) game = recordFor(state)

// ───────── 계정 · 서버 맞추기 (docs/realm/SERVER.md) — 판은 늘 기기가 먼저, 서버는 뒤따른다
const sync = makeSync({
  local: () => state,
  record: () => game,
  adopt(saveJson, recordJson) {
    // 서버 판으로 바꾼다 — 기기에 쓰고 판을 새로 연다 (불러오기·migrate 는 여느 때처럼 load 가 한다). 기기의 하던 판은 선반에
    let there = Number.NaN
    try { there = (JSON.parse(saveJson) as Partial<Saved>).seed ?? Number.NaN } catch { /* 깨진 판이면 아래 load 가 거른다 */ }
    if (state !== null && state.seed !== there) shelve(state)
    try { localStorage.setItem(KEY, saveJson) } catch { return false }
    if (recordJson !== null) {
      try {
        const rec = JSON.parse(recordJson) as GameRecord
        const i = games.findIndex((g) => g.seed === rec.seed)
        if (i < 0 || games[i]!.turns.length < rec.turns.length) { if (i >= 0) games.splice(i, 1); games.push(rec); saveGames(games) }
      } catch { /* 기록이 깨졌으면 판만 */ }
    }
    location.reload()
    return true
  },
}, () => app.cloudChanged())

const root = document.getElementById('realm')!
/**
 * 스플래시를 걷는다 — 글꼴과 첫 화면 그림을 다 받았을 때 (늦어도 SPLASH_MAX_MS). 너무 빨리 걷히면 번쩍이므로 SPLASH_MIN_MS 는 보인다
 * (realm.html #splash · 형 10-23: "이미지 로딩되는 게 고스란히 보이는데")
 */
const SPLASH_MIN_MS = 2600 // 형 10-28: 조금 더 길게 — 고지문도 읽히게
const SPLASH_MAX_MS = 6000
function hideSplashWhenReady(): void {
  const el = document.getElementById('splash')
  if (el === null) return
  const t0 = performance.now()
  const bar = el.querySelector<HTMLElement>('.lbar')
  const fill = bar?.querySelector<HTMLElement>('i') ?? null
  let done = 0
  const tick = (): void => {
    done++
    if (bar === null || fill === null) return
    const now = getComputedStyle(fill).width
    bar.classList.add('go')
    fill.style.width = now
    requestAnimationFrame(() => { fill.style.width = `${Math.round(28 + (72 * done) / 3)}%` })
  }
  const img = (src: string): Promise<void> => new Promise((ok) => { const i = new Image(); i.onload = i.onerror = () => { tick(); ok() }; i.src = src })
  const base = import.meta.env.BASE_URL
  const ready = Promise.all([document.fonts.ready.then(() => { tick() }), img(`${base}realm/title/title-lobby.jpg`), img(`${base}realm/logo/emblem.png`)])
  const late = new Promise<void>((ok) => setTimeout(ok, SPLASH_MAX_MS))
  void Promise.race([ready, late]).then(() => {
    setTimeout(() => {
      el.classList.add('out')
      el.addEventListener('transitionend', () => el.remove(), { once: true })
    }, Math.max(0, SPLASH_MIN_MS - (performance.now() - t0)))
  })
}
hideSplashWhenReady()

const app = mountRealmApp(root, {
  onAdvance(next, report, orders, mine) {
    if (state === null) return
    state = save({ ...state, log: [...state.log, [...orders]], before: state.realm, realm: next, report })
    game ??= recordFor(state)
    const now = Date.now()
    game.turns.push({
      s: report.season, at: new Date(now).toISOString(), ms: now - turnStart,
      orders: [...mine], lines: report.lines, me: myLot(next), taps,
    })
    if (next.outcome && game.end === null) game.end = { kind: next.outcome.kind, season: next.outcome.season, at: new Date(now).toISOString() }
    turnStart = now
    taps = []
    saveGames(games)
    sync.dirty(next.outcome != null) // 판이 끝났으면 바로, 아니면 2분 묶음
  },
  onNewGame(nation, region, tier) {
    // 하던 판은 선반에 — 첫 화면 「다른 판」에서 다시 이어 한다 (못 남겨도 새 판은 연다 · 한 계절 앞 저장 PREV 도 남아 있다)
    shelve(state)
    state = save(fresh(nation, region, tier ?? 1))
    game = recordFor(state)
    turnStart = Date.now()
    taps = []
    saveGames(games)
    sync.dirty(true)
    app.show(state.realm, null, null, true) // 새 판 — 서막부터
  },
  slots: () => loadSlots().filter((x) => x.seed !== state?.seed),
  onResume(seed) {
    // 고른 판을 먼저 읽고(없으면 멈춤), 하던 판을 선반에 확실히 올린 뒤에야 지금 판을 바꾼다 — 판을 날리지 않게 (메모리: localStorage 되돌리기)
    const pick = loadFrom(slotKey(seed))
    if (pick === null) return false
    if (switchTo(pick) !== null) return false
    try { localStorage.removeItem(slotKey(seed)) } catch { /* 남아도 목록에서 빠지면 안 보인다 */ }
    writeSlots(loadSlots().filter((x) => x.seed !== seed))
    app.show(state!.realm, state!.before, state!.report)
    return true
  },
  saves: {
    list: () => listSaves(kv),
    save(n, label) {
      if (state === null) return '저장할 판이 없다'
      const w = writeSave(kv, n, makeSaveFile(state, draftNow(), label, new Date().toISOString()))
      if (w.ok) return null
      return w.why === 'full' ? '저장할 자리가 모자라다 — 아무것도 바꾸지 않았다. 「파일로 내려받기」로 이 판을 파일에 남겨 두자.' : '없는 칸이다'
    },
    load(n) {
      const p = readSave(kv, n)
      return p.ok ? openSave(p.file) : p.why
    },
    drop(n) {
      return dropSave(kv, n) ? null : '칸을 비우지 못했다 — 그대로 두었다'
    },
    download(label) {
      if (state === null) return '내려받을 판이 없다'
      const f = makeSaveFile(state, draftNow(), label.trim() === '' ? defaultLabel(state.realm) : label, new Date().toISOString())
      try { download(saveFileName(f), JSON.stringify(f)) } catch { return '파일을 만들지 못했다' }
      return null
    },
    loadFile(text) {
      if (text.length > P.realm.saveFileMaxMB * 1024 * 1024) return '파일이 너무 크다 — 삼한열전 판으로 읽을 수 없습니다'
      const p = parseSaveFile(text)
      return p.ok ? openSave(p.file) : p.why
    },
  },
  onDropSlot(seed) {
    try { localStorage.removeItem(slotKey(seed)) } catch { /* 그대로 */ }
    writeSlots(loadSlots().filter((x) => x.seed !== seed))
  },
  onTap(act, arg) {
    if (taps.length < 400) taps.push([Date.now() - turnStart, act, arg])
  },
  onExport() {
    // 그 계절에 정해 둔 명령도 담는다 — 막힌 판을 그대로 다시 돌려 보려고 (형: "9년 가을에서 다음으로 안넘어가져")
    const body = JSON.stringify({ exported: new Date().toISOString(), games, save: state, draft: draftNow() }, null, 1)
    download(`78guk-records-${new Date().toISOString().slice(0, 10)}.json`, body)
  },
  gameCount: () => games.length,
  pastGames: () => [...games].reverse().map((g) => ({
    nation: g.nation, name: g.name ?? '', region: g.region ?? null, tier: g.tier ?? null, started: g.started,
    end: g.end, seasons: g.turns.length, current: g.seed === state?.seed,
  })),
  history: () => (game?.turns ?? []).map((t) => ({ s: t.s, lines: t.lines })),
  savedAt: () => state?.at ?? null,
  async resetPlay() {
    // 서버 것부터 — 이 기기만 지우면 다음 맞추기 때 서버의 도감·해금이 되살아난다. 서버를 못 지우면 이 기기 것도 그대로 둔다
    if (account() !== null) {
      try { await sync.wipe() } catch (e) { console.warn('[기록] 서버 기록을 못 지웠다:', e); return false }
      sync.forget()
    }
    // 판·판 밖 기록만 — 소리·지도 층 같은 설정과 계정·기기 표시는 남긴다 (localStorage.clear() 는 쓰지 않는다)
    const keep = new Set(['hanbal.realm.mute', 'hanbal.realm.layers'])
    for (const k of Object.keys(localStorage)) if ((k.startsWith('hanbal.realm.') || k.startsWith('hanbal.night.')) && !keep.has(k)) localStorage.removeItem(k)
    location.reload()
    return true
  },
  cloud: {
    available: canSync,
    who: () => account(),
    state: () => sync.state(),
    signIn,
    signOut() { signOut(); sync.forget(); app.cloudChanged() },
    syncNow() { void sync.start() },
    choose(pick) { void sync.choose(pick) },
    async remove() {
      // 서버 자료부터 지우고 계정을 지운다. 로그인이 오래돼 계정이 안 지워지면 로그아웃까지만 — 다시 들어와 한 번 더 (맞추기가 다시 올리지 않게)
      let r: 'ok' | 'relogin' | 'error' = 'error'
      try { await sync.wipe(); r = await deleteAccount() } catch (e) { console.warn('[계정] 지우기 실패:', e) }
      if (r === 'relogin') signOut()
      if (r !== 'error') sync.forget()
      app.cloudChanged()
      return r
    },
  },
})
app.show(state?.realm ?? null, state?.before ?? null, state?.report ?? null)

void finishSignIn()
  .then((r) => { if (r !== null && 'error' in r) console.warn('[계정] 로그인 못 함:', r.error) })
  .catch((e: unknown) => console.warn('[계정] 로그인 못 함:', e))
  .finally(() => { if (account() !== null) void sync.start(); app.cloudChanged() })
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') sync.flush() })
// 새 빌드가 올라왔으면 띠로 알린다 — 켜 둔 판이 옛 코드로 계속 돌지 않게 (형 10-24)
watchUpdates(root, () => sync.flush())
// 페이지는 굴러가지 않는다 — 전체화면을 끈 뒤 싸움 결과로 굴리다 판 전체가 밀려 위 카드가 잘렸다 (형 10-24)
pinPage()

// 홈 화면에 앱으로 (형: "매번 웹페이지로 플레이해야돼?") — 활터와 같은 워커. https 에서만, 로드가 끝난 뒤에 (main.ts 와 같은 규칙)
if (location.protocol === 'https:' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}) }, { once: true })
}
