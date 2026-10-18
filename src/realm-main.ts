/**
 * 칠십팔국 시험판 — 앱 화면의 진입점 (realm.html, docs/realm/FLOW.md)
 *
 * 활터(index.html)와 번들을 나눴다: 시험판이 기존 게임의 첫 화면·예산을 건드리지 않게.
 * 저장은 `hanbal.realm.v2` — 고른 나라 · 판 시작 시드 + 계절마다 명령 기록 + 최신 판.
 * v1(나라 고르기·살림 전) 저장은 이어 받지 않는다 — 판의 모양이 달라졌다. 나라 고르기부터 다시.
 * 활터의 저장(`hanbal.save.v1`)은 건드리지 않는다.
 */
import { startRealm } from './realm/data/regions/byeonhan-mini.ts'
import type { Order, Realm, Report } from './realm/types.ts'
import { mountRealmApp } from './ui/realm/app.ts'

const KEY = 'hanbal.realm.v2'

interface Saved {
  readonly v: 2
  readonly nation: string
  readonly seed: number
  readonly log: Order[][]
  readonly realm: Realm
  readonly before: Realm | null
  readonly report: Report | null
}

function load(): Saved | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw === null) return null
    const s = JSON.parse(raw) as Saved
    return s.v === 2 ? s : null
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

function fresh(nation: string): Saved {
  // 시드는 화면 바깥(ui)에서만 시계로 만든다 — realm 안에서는 시계를 못 읽는다 (절대 규칙 1)
  const seed = (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0
  return { v: 2, nation, seed, log: [], realm: startRealm(seed, nation), before: null, report: null }
}

let state: Saved | null = load()

const root = document.getElementById('realm')!
const app = mountRealmApp(root, {
  onAdvance(next, report, orders) {
    if (state === null) return
    state = { ...state, log: [...state.log, [...orders]], before: state.realm, realm: next, report }
    save(state)
  },
  onNewGame(nation) {
    state = fresh(nation)
    save(state)
    app.show(state.realm, null, null)
  },
})
app.show(state?.realm ?? null, state?.before ?? null, state?.report ?? null)
