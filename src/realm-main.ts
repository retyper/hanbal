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
import { startRegion } from './realm/data/regions/index.ts'
import { headcount } from './realm/battle.ts'
import { forceOf } from './realm/season.ts'
import { migrate } from './realm/migrate.ts'
import type { Order, Realm, RegionId, Report, ReportLine } from './realm/types.ts'
import { mountRealmApp } from './ui/realm/app.ts'

const KEY = 'hanbal.realm.v2'
const GAMES = 'hanbal.realm.games'
/** 판 기록이 이보다 커지면 오래된 판부터 누른 것을 덜고, 그래도 크면 판을 덜어 낸다 (localStorage 는 5MB 안팎) */
const GAMES_MAX_CHARS = 3_000_000

interface Saved {
  readonly v: 2
  readonly nation: string
  readonly seed: number
  readonly log: Order[][]
  readonly realm: Realm
  readonly before: Realm | null
  readonly report: Report | null
}

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
  readonly seed: number
  readonly started: string
  readonly screen: string
  turns: Turn[]
  end: { kind: 'win' | 'lose' | 'quit'; season: number; at: string } | null
}

function load(): Saved | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw === null) return null
    const s = JSON.parse(raw) as Saved
    if (s.v !== 2) return null
    // 옛 판이면 사람의 눈금을 키운다 (migrate.ts — 위서 동이전의 규모)
    if (s.realm) migrate(s.realm)
    if (s.before) migrate(s.before)
    return s
  } catch {
    return null
  }
}

function save(s: Saved): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // 저장이 막힌 창(사생활 보호 모드) — 판은 계속 돈다, 다음에 이어서 못 할 뿐
  }
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

function fresh(nation: string, region: RegionId): Saved {
  // 시드는 화면 바깥(ui)에서만 시계로 만든다 — realm 안에서는 시계를 못 읽는다 (절대 규칙 1)
  const seed = (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0
  return { v: 2, nation, seed, log: [], realm: startRegion(region, seed, nation), before: null, report: null }
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
    v: 1, nation: s.nation, seed: s.seed, started: new Date().toISOString(),
    screen: `${window.innerWidth}x${window.innerHeight}`, turns: [], end: null,
  }
  games.push(g)
  return g
}

if (state !== null) game = recordFor(state)

const root = document.getElementById('realm')!
const app = mountRealmApp(root, {
  onAdvance(next, report, orders, mine) {
    if (state === null) return
    state = { ...state, log: [...state.log, [...orders]], before: state.realm, realm: next, report }
    save(state)
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
  },
  onNewGame(nation, region) {
    if (game !== null && game.end === null) game.end = { kind: 'quit', season: state?.realm.season ?? 0, at: new Date().toISOString() }
    state = fresh(nation, region)
    save(state)
    game = recordFor(state)
    turnStart = Date.now()
    taps = []
    saveGames(games)
    app.show(state.realm, null, null)
  },
  onTap(act, arg) {
    if (taps.length < 400) taps.push([Date.now() - turnStart, act, arg])
  },
  onExport() {
    const body = JSON.stringify({ exported: new Date().toISOString(), games, save: state }, null, 1)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([body], { type: 'application/json' }))
    a.download = `78guk-records-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000) // 바로 거두면 받기가 끊기는 브라우저가 있다 — 한 번만 도는 정리
  },
  gameCount: () => games.length,
})
app.show(state?.realm ?? null, state?.before ?? null, state?.report ?? null)

// 홈 화면에 앱으로 (형: "매번 웹페이지로 플레이해야돼?") — 활터와 같은 워커. https 에서만, 로드가 끝난 뒤에 (main.ts 와 같은 규칙)
if (location.protocol === 'https:' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}) }, { once: true })
}
