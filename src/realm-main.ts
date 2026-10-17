/**
 * 칠십팔국 시험판 — 글자 지도의 진입점 (realm.html, docs/realm/BUILD.md §5 R1)
 *
 * 활터(index.html)와 번들을 나눴다: 시험판이 기존 게임의 첫 화면·예산을 건드리지 않게.
 * 저장은 `hanbal.realm.v1` (BUILD §1-4) — 판 시작 시드 + 계절마다 명령 기록 + 최신 스냅숏.
 * 기록으로 처음부터 다시 돌리면 스냅숏과 같아야 한다 (tests/realm 의 리플레이 시험이 같은 것을 잰다).
 * 활터의 저장(`hanbal.save.v1`)은 건드리지 않는다.
 */
import { byeonhanMini } from './realm/data/regions/byeonhan-mini.ts'
import type { Order, Realm, Report } from './realm/types.ts'
import { mountTextMap } from './ui/realm/textmap.ts'

const KEY = 'hanbal.realm.v1'

interface Saved {
  readonly v: 1
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
    return s.v === 1 ? s : null
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

function fresh(): Saved {
  // 시드는 화면 바깥(ui)에서만 시계로 만든다 — realm 안에서는 시계를 못 읽는다 (절대 규칙 1)
  const seed = (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0
  return { v: 1, seed, log: [], realm: byeonhanMini(seed), before: null, report: null }
}

let state: Saved = load() ?? fresh()
save(state)

const root = document.getElementById('realm')!
const view = mountTextMap(root, {
  onAdvance(next, report, orders) {
    state = { ...state, log: [...state.log, [...orders]], before: state.realm, realm: next, report }
    save(state)
  },
  onNewGame() {
    state = fresh()
    save(state)
    view.show(state.realm, null, null)
  },
})
view.show(state.realm, state.before, state.report)
