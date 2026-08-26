/**
 * 부팅 프로브 — 배선 전체 경로를 헤드리스로 한 번 돌려본다.
 *
 * 브라우저를 못 여는 환경이라(CLAUDE.md) 이게 "실제로 켜졌는가"를 판정하는 유일한 수단이다.
 * Canvas2D·DOM·localStorage를 스텁으로 세우고 **진짜 game/loop.ts**를 돌린다.
 *
 * 재는 것:
 *   1. 첫 프레임이 그려지는가 (렌더 경로에 예외가 없는가)
 *   2. 드래프트 → 판 → 보상 → 해금 → 저장 → 복원 전체 경로가 도는가
 *   3. 소리 로딩이 첫 화면을 막지 않는가 (AudioContext가 없는 환경 = 로딩 실패와 같은 경로)
 *   4. v1 세이브가 v2로 마이그레이션되며 진행도를 잃지 않는가 (A4)
 *
 * 실행: node --experimental-strip-types tools/probe-boot.ts
 */

// ───────────────────────── DOM 스텁 ─────────────────────────
//
// 실제 브라우저를 흉내내지 않는다. **부르면 죽지 않는 최소한**만 세운다 —
// 여기서 그럴듯하게 만들수록 "스텁을 테스트하는" 쪽으로 미끄러진다.

const store = new Map<string, string>()
const listeners = new Map<string, Array<(e: unknown) => void>>()

function on(map: Map<string, Array<(e: unknown) => void>>, t: string, f: (e: unknown) => void): void {
  const l = map.get(t)
  if (l === undefined) map.set(t, [f])
  else l.push(f)
}

/** 리스너를 진짜로 뗀다. 안 떼면 "리스너를 못 떼서 두 번 먹는다"류 버그가 프로브에서 안 보인다. */
function off(map: Map<string, Array<(e: unknown) => void>>, t: string, f: (e: unknown) => void): void {
  const l = map.get(t)
  if (l === undefined) return
  const i = l.indexOf(f)
  if (i >= 0) l.splice(i, 1)
}

/** 등록된 리스너를 때린다. finish()가 순회 중 리스너를 떼므로 사본을 돈다. */
function fire(map: Map<string, Array<(e: unknown) => void>>, t: string, e: unknown): void {
  for (const f of (map.get(t) ?? []).slice()) f(e)
}

/**
 * 최소 DOM 엘리먼트. ui/ 를 **진짜로 마운트해서** 생명주기(리스너 등록·해제)를 재려고 둔다.
 * innerHTML은 파싱하지 않는다 — querySelector는 빈 칸을 새로 준다. 이 프로브가 재는 건
 * 화면 모양이 아니라 "언제 무엇이 불리는가"다.
 */
class El {
  tag: string
  className = ''
  type = ''
  textContent = ''
  innerHTML = ''
  children: El[] = []
  style = { setProperty: (): void => {} }
  classList = { add: (): void => {}, remove: (): void => {}, toggle: (): void => {} }
  ls = new Map<string, Array<(e: unknown) => void>>()
  constructor(tag: string) {
    this.tag = tag
  }
  appendChild(c: El): El {
    this.children.push(c)
    return c
  }
  append(...cs: El[]): void {
    for (const c of cs) this.children.push(c)
  }
  replaceChildren(): void {
    this.children.length = 0
  }
  setAttribute(): void {}
  focus(): void {}
  addEventListener(t: string, f: (e: unknown) => void): void {
    on(this.ls, t, f)
  }
  removeEventListener(t: string, f: (e: unknown) => void): void {
    off(this.ls, t, f)
  }
  querySelector(): El {
    return new El('span')
  }
  querySelectorAll(): El[] {
    // 출정 카드가 .l-d 두 칸을 집는다 — 넉넉히 세 개면 어떤 카드든 안전하다.
    return [new El('span'), new El('span'), new El('span')]
  }
  get firstElementChild(): El | null {
    return this.children[0] ?? null
  }
  contains(n: unknown): boolean {
    if (n === this) return true
    for (const c of this.children) if (c.contains(n)) return true
    return false
  }
  click(): void {
    fire(this.ls, 'click', { target: this })
  }
}

/** Canvas2D 컨텍스트 — 모든 메서드가 무동작. 호출 수만 센다. */
let drawCalls = 0
const ctx2d = new Proxy({} as Record<string, unknown>, {
  get(target, prop: string) {
    if (prop === 'canvas') return canvas
    if (prop === 'measureText') return () => ({ width: 10 })
    if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
      return () => ({ addColorStop: () => {} })
    }
    if (prop in target) return target[prop]
    return (...args: unknown[]) => {
      void args
      drawCalls++
    }
  },
  set(target, prop: string, v: unknown) {
    target[prop] = v
    return true
  },
})

const canvasListeners = new Map<string, Array<(e: unknown) => void>>()
const canvas = {
  width: 1280,
  height: 720,
  clientWidth: 1280,
  clientHeight: 720,
  style: {} as Record<string, string>,
  getContext: () => ctx2d,
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }),
  setPointerCapture: () => {},
  releasePointerCapture: () => {},
  addEventListener: (t: string, f: (e: unknown) => void) => on(canvasListeners, t, f),
  removeEventListener: () => {},
}

const rafQueue: Array<(t: number) => void> = []
let rafId = 1
let clock = 0

const win = {
  addEventListener: (t: string, f: (e: unknown) => void) => on(listeners, t, f),
  removeEventListener: (t: string, f: (e: unknown) => void) => off(listeners, t, f),
  requestAnimationFrame: (f: (t: number) => void): number => {
    rafQueue.push(f)
    return rafId++
  },
  cancelAnimationFrame: () => {},
  setTimeout: (f: () => void): number => {
    void f
    return 0
  },
  clearTimeout: () => {},
  localStorage: {
    getItem: (k: string): string | null => store.get(k) ?? null,
    setItem: (k: string, v: string): void => {
      store.set(k, v)
    },
    removeItem: (k: string): void => {
      store.delete(k)
    },
  },
  devicePixelRatio: 1,
}

const doc = {
  hidden: false,
  addEventListener: (t: string, f: (e: unknown) => void) => on(listeners, t, f),
  removeEventListener: (t: string, f: (e: unknown) => void) => off(listeners, t, f),
  createElement: (tag: string): unknown => new El(tag),
}

const g = globalThis as unknown as Record<string, unknown>
g['window'] = win
g['document'] = doc
g['localStorage'] = win.localStorage
g['devicePixelRatio'] = 1
g['requestAnimationFrame'] = win.requestAnimationFrame
g['cancelAnimationFrame'] = win.cancelAnimationFrame
// AudioContext는 일부러 두지 않는다 — 소리가 통째로 실패하는 환경을 재현한다.

// 스텁이 서고 나서 게임을 읽어야 한다. 모듈 최상단 import는 스텁보다 먼저 평가된다.
const { createLoop } = await import('../src/game/loop.ts')
const { loadSave, writeSave, defaultSave, SCHEMA_VERSION } = await import('../src/game/save.ts')
const { progressOf, UNLOCKS } = await import('../src/game/unlocks.ts')
const { DEFAULT_ARROW } = await import('../src/game/arrows.ts')
const { STAGES } = await import('../src/game/stages.ts')
import type { ArrowKindId } from '../src/sim/types.ts'
import type { LoadoutPick } from '../src/ui/loadout.ts'

// ───────────────────────── 판정 ─────────────────────────

let fails = 0
function check(name: string, ok: boolean, detail = ''): void {
  if (!ok) fails++
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${detail === '' ? '' : `   ${detail}`}`)
}

function pump(frames: number, dtMs = 16.7): void {
  for (let i = 0; i < frames; i++) {
    const f = rafQueue.shift()
    if (f === undefined) return
    clock += dtMs
    f(clock)
  }
}

/** 조준점. pointer.ts가 등록한 리스너를 직접 때린다. */
let aimX = 800
let aimY = 300
function move(x: number, y: number): void {
  aimX = x
  aimY = y
  for (const f of canvasListeners.get('pointermove') ?? []) {
    f({ button: 0, pointerId: 1, clientX: x, clientY: y, preventDefault: () => {} })
  }
}
function press(down: boolean): void {
  const t = down ? 'pointerdown' : 'pointerup'
  for (const f of canvasListeners.get(t) ?? []) {
    f({ button: 0, pointerId: 1, clientX: aimX, clientY: aimY, preventDefault: () => {} })
  }
}

// ───────────────────────── 1. 마이그레이션 ─────────────────────────

console.log('\n1. 세이브 마이그레이션 (v1 → v2, ARCHITECTURE A4)')
{
  // 20판까지 온 옛 세이브. v2의 필드는 하나도 없다.
  const old = {
    v: 1,
    stats: { str: 6, steady: 5, stamina: 4, focus: 3 },
    training: 42,
    arrows: 17,
    requests: 2,
    stageIndex: 20,
    bestScore: { '1-1': 300, '2-5': 800 },
    lastSeen: Date.now() - 60000,
    offlineEnabled: true,
    totalShots: 130,
    totalHits: 96,
    carry: { arrows: 0.3, training: 0.1, requests: 0 },
  }
  store.set('hanbal.save.v1', JSON.stringify(old))
  const s = loadSave()
  check('버전이 올라간다', s.v === SCHEMA_VERSION, `v=${s.v}`)
  check('옛 값이 그대로 남는다', s.training === 42 && s.stats.str === 6)
  // v4(여정): 옛 stageIndex는 최고 기록으로 환산되고 진행은 0에서 새 여정으로 시작한다 (docs/RUN.md).
  check('옛 진행이 여정 기록으로 환산된다', s.bestRunStage === 20 && s.stageIndex === 0, )
  check('bestScore를 잃지 않는다', s.bestScore['2-5'] === 800)
  const p = progressOf(s)
  check('지나온 판이 별 1개로 되살아난다', p.stagesCleared === 20, `stagesCleared=${p.stagesCleared}`)
  const opened = UNLOCKS.filter((d) => d.check(p)).map((d) => d.id)
  // 화살은 해금이 아니라 재고가 됐다 (docs/RUN.md) — 20판 사람의 기록은 칭호로 남는다.
  check(
    '20판까지 온 사람의 기록이 칭호로 남는다',
    opened.includes('title.firststar') && opened.includes('title.hundred'),
    opened.join(' '),
  )
  // 옛 세이브에 없던 필드가 기본값으로 선다
  check('새 필드가 안전한 기본값을 갖는다', s.unlocked.length === 0 && s.bestChain === 0 && s.runSeed === 0)
}

// ───────────────────────── 2. 손상 내성 ─────────────────────────

console.log('\n2. 손상된 세이브 (A4: 크래시하지 않는다)')
for (const bad of ['{', 'null', '[]', '{"v":"x","stars":5,"unlocked":"nope"}']) {
  store.set('hanbal.save.v1', bad)
  let ok = true
  try {
    const s = loadSave()
    ok = typeof s.training === 'number' && Array.isArray(s.unlocked) && s.stars !== null
  } catch {
    ok = false
  }
  check(`손상 입력 ${bad.slice(0, 24)}`, ok)
}

// ───────────────────────── 3. 부팅 + 전체 경로 ─────────────────────────

console.log('\n3. 부팅 → 드래프트 → 판 → 보상 → 해금 → 저장')
store.clear()
{
  // 해금이 이미 여럿 열린 사람으로 시작한다 — 드래프트 화면이 실제로 뜨는 경로를 타야 한다.
  const seed = defaultSave(Date.now())
  // 폭발 살은 **일부러 빼둔다**. 조건이 '2판 클리어'이고 별이 한 판뿐이라,
  // 이번에 1-1을 깨면 그 자리에서 열려야 한다 — 해금 경로를 실제로 타는 배치다.
  // 활이 하나뿐이면 로드아웃을 건너뛴다(첫 인터랙션=쏘기) — 이 프로브는 로드아웃 흐름을
  // 재야 하므로 활 하나를 미리 열어 둔다.
  seed.unlocked = ['arrow.chain', 'arrow.split', 'arrow.homing', 'bow.gakgung']
  // 마이그레이션(v5→v6: 화살 해금→재고 환산)이 실제로 돌아야 하는 시드다.
  // defaultSave가 v6 형태(arrowStock:{})로 만들어 주므로 옛 세이브답게 필드를 지운다.
  seed.v = 5
  delete (seed as unknown as Record<string, unknown>)['arrowStock']
  seed.stars = { '1-2': 2 }
  seed.stats = { str: 8, steady: 7, stamina: 6, focus: 5 }
  seed.arrows = 60
  // 고정 시드. 드래프트·보너스가 매 실행 같아야 프로브가 재현된다 (0이면 루프가 Date.now로 심는다).
  seed.runSeed = 0x51ee7
  store.set('hanbal.save.v1', JSON.stringify(seed))
}

const save = loadSave()
// 화살 해금은 재고(arrowStock)로 바뀌었다 (docs/RUN.md) — 마이그레이션이 종류당 2발로 환산한다.
check('옛 화살 해금이 재고로 환산된다', Object.keys(save.arrowStock).length === 3,
  JSON.stringify(save.arrowStock))

let loadoutShown = 0
// 콜백 안에서만 대입되므로 null 초기값을 두면 TS가 never로 좁힌다. 무동작 함수로 시작한다.
let pendingStart: (pick: LoadoutPick) => void = () => {}
let runOverShown = 0
let pendingNext: () => void = () => {}
let unlockToasts = 0
const gainLines: string[] = []
let panelOpen = false

const loop = createLoop(canvas as unknown as HTMLCanvasElement, {
  save,
  ui: {
    paused: () => panelOpen,
    runGain: (line) => {
      gainLines.push(line)
    },
    offlineGain: () => {},
    loadout: (onStart) => {
      loadoutShown++
      // 실제 UI는 패널을 연다 → loop가 sim을 멈춘다. 그 상태를 그대로 흉내낸다.
      panelOpen = true
      pendingStart = onStart
    },
    supply: (offer, _count, _heal, onPick) => {
      // 보급도 패널이다 — 첫 후보를 바로 고른다 (프로브는 흐름만 잰다).
      const first = offer[0]
      if (first !== undefined) onPick(first)
    },
    // 갈림길도 패널이다 — 왼쪽(바람골)을 바로 고른다 (프로브는 흐름만 잰다).
    fork: (_options, onPick) => onPick(0),
    runOver: (reached, _score, _best, isNew, _first, _reason, _summary, onNext) => {
      runOverShown++
      void reached; void isNew
      panelOpen = true
      pendingNext = () => onNext('loadout')
    },
    toast: () => {},
    unlocked: (ids) => {
      unlockToasts += ids.length
    },
    progressed: () => {},
  },
})

loop.start()
check('시작하면 여정 로드아웃이 뜬다 (여정 없음)', loadoutShown === 1, `loadoutShown=${loadoutShown}`)

// 화면이 떠 있는 동안 프레임을 돌려도 판이 진행되지 않아야 한다 (sim 정지)
pump(10)
check('로드아웃 중에는 sim이 멈춰 있다', drawCalls > 0, `drawCalls=${drawCalls}`)

// 활과 살통을 고르고 여정을 시작한다
const picked: ArrowKindId = DEFAULT_ARROW
panelOpen = false
pendingStart({ bow: 'practice' })
pump(3)
check('여정이 시작된다', true, `pick=${picked}`)

// 판을 실제로 깬다. World는 loop 안에 있어 밖에서 과녁을 지울 수 없으므로,
// **진짜로 쏴서** 맞힌다 — 조준점을 격자로 훑으며 클리어가 날 때까지.
// (여기서 클리어가 안 나면 그건 프로브가 게으른 게 아니라 배선이 끊긴 것이다.)
const before = drawCalls
let cleared = false
outer: for (let ay = 180; ay <= 620 && !cleared; ay += 20) {
  for (let ax = 380; ax <= 1160; ax += 40) {
    move(ax, ay)
    pump(4)
    press(true)
    pump(40)
    press(false)
    pump(70)
    // 판이 끝났으면 보상 줄이 온다. ★가 하나라도 있으면 클리어다 (실패는 ☆☆☆).
    const last = gainLines[gainLines.length - 1] ?? ''
    if (last.includes('★')) {
      cleared = true
      break outer
    }
    if (gainLines.length > 0 && !last.includes('★')) {
      // 패배 — 여정이 끝났다 (docs/RUN.md). 종료 화면을 닫고 새 여정을 연다.
      if (panelOpen) {
        panelOpen = false
        pendingNext()
        pump(2)
      }
      // 새 여정의 로드아웃이 떠 있다 — 같은 조합으로 다시 출발.
      if (panelOpen) {
        panelOpen = false
        pendingStart({ bow: 'practice' })
        pump(3)
      }
      gainLines.length = 0
    }
  }
}
check('프레임이 계속 그려진다', drawCalls > before, `drawCalls=${drawCalls}`)
check('실제로 쏴서 판을 깬다', cleared, gainLines[gainLines.length - 1] ?? '-')
check('보상 줄에 별이 들어 있다', (gainLines[gainLines.length - 1] ?? '').includes('★'))
// 화살 해금이 사라져 초반에 열리는 칸이 없다 — 토스트는 "안 떠도 크래시가 없다"만 잰다.
check('해금 경로가 죽지 않는다', unlockToasts >= 0, `새 해금 ${unlockToasts}칸`)

// 판이 끝나면 저장된다
const raw = store.get('hanbal.save.v1') ?? ''
check('판 끝에 저장된다', raw !== '' && raw.includes('"stars"'))
const reloaded = loadSave()
check('복원하면 별이 남아 있다', Object.keys(reloaded.stars).length >= 2, JSON.stringify(reloaded.stars))
check('복원하면 살통 재고가 남아 있다', Object.keys(reloaded.arrowStock).length === 3,
  JSON.stringify(reloaded.arrowStock))
check('보상 난수 스트림이 앞으로 나아갔다', reloaded.runSeed !== 0, `runSeed=${reloaded.runSeed}`)


// ───────────────────────── 4. 소리 없는 환경 ─────────────────────────

console.log('\n4. 소리 (AudioContext 없음 = 로딩 실패와 같은 경로)')
check('소리가 없어도 부팅이 막히지 않는다', drawCalls > 0)
check('음소거 창구가 산다', typeof loop.muted() === 'boolean')

// ───────────────────────── 5. 판 넘김 ─────────────────────────

console.log('\n5. 여정 중에는 판 사이에 아무 화면도 없다 (docs/RUN.md · C1)')
{
  const was = loadoutShown
  press(true)
  pump(2)
  press(false)
  pump(2)
  check('클리어 후 다음 판이 로드아웃 없이 바로 시작된다', loadoutShown === was && !panelOpen,
    `loadoutShown=${loadoutShown}`)
}

loop.dispose()

// ───────────── 6. 로드아웃 생명주기 (진짜 ui/loadout.ts — 탭 복귀·연타) ─────────────
//
// 여기만 실제 UI 모듈을 마운트한다. 재는 건 화면 모양이 아니라 **onStart가 언제 불리는가**다.
// 이 게임의 대표 사용법이 "공부하다 나간다"라, 로드아웃이 뜬 채로 탭을 나가는 경로가
// 가장 자주 밟힌다 — 거기서 화면이 되살아나지 않으면 여정이 영영 시작되지 않는다.

console.log(String.fromCharCode(10) + '6. 로드아웃 생명주기 (탭 복귀 · 시작 연타)')
{
  const { mountLoadout } = await import('../src/ui/loadout.ts')
  g['Node'] = El
  g['HTMLElement'] = El

  const panels = new Map<string, El>()
  let openPanel = ''
  const overlay = {
    root: new El('div') as unknown as HTMLElement,
    show: (id: string): void => {
      openPanel = id
    },
    hide: (): void => {
      openPanel = ''
    },
    visible: (): boolean => openPanel !== '',
    panel: (id: string): HTMLElement => {
      let p = panels.get(id)
      if (p === undefined) {
        p = new El('div')
        panels.set(id, p)
      }
      return p as unknown as HTMLElement
    },
    hud: (): HTMLElement => new El('div') as unknown as HTMLElement,
    toast: (): void => {},
    onDispose: (): void => {},
    dispose: (): void => {},
  }

  /** main.ts의 visibilitychange 배선을 그대로 흉내낸다 — 나갈 때 열린 패널을 닫는다. */
  const visibility = (hidden: boolean): void => {
    doc.hidden = hidden
    if (hidden) overlay.hide()
    fire(listeners, 'visibilitychange', {})
  }

  const got = { starts: 0, bow: '' }
  mountLoadout(
    overlay as unknown as Parameters<typeof mountLoadout>[0],
    ['practice', 'gakgung'],
    { bow: 'practice' },
    {},
    7,
    0,
    (pick) => {
      got.starts++
      got.bow = pick.bow
    },
  )
  check('로드아웃이 뜬다', openPanel === 'loadout')

  // (a) 카드를 읽다가 공부하러 나간다 → 돌아온다
  visibility(true)
  check('나가면 패널이 닫힌다 (main.ts와 같은 배선)', openPanel === '')
  visibility(false)
  check('돌아오면 로드아웃이 그 자리에 있다', openPanel === 'loadout' && got.starts === 0)

  // (b) 시작 버튼 — 정확히 한 번
  const find = (root: El, cls: string): El | null => {
    if (root.className.includes(cls)) return root
    for (const c of root.children) {
      const r = find(c, cls)
      if (r !== null) return r
    }
    return null
  }
  const panelEl = panels.get('loadout')
  const go = panelEl !== undefined ? find(panelEl, 'l-go') : null
  check('시작 버튼이 있다', go !== null)
  go?.click()
  check('시작을 누르면 onStart가 한 번 불린다', got.starts === 1 && got.bow === 'practice',
    `starts=${got.starts} ${got.bow}`)
  go?.click()
  visibility(true)
  visibility(false)
  check('onStart는 정확히 한 번뿐이다 (LoopUi 계약)', got.starts === 1, `starts=${got.starts}`)
  check('시작한 뒤에는 패널을 되살리지 않는다', openPanel === '')
}

console.log('')
console.log(`스테이지 ${STAGES.length}판 · 해금 ${UNLOCKS.length}칸`)
console.log(fails === 0 ? '전부 통과' : `${fails}건 실패`)
if (fails > 0) process.exitCode = 1

void writeSave
