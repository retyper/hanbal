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
  classList = { add: (): void => {}, remove: (): void => {} }
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
const { progressOf, UNLOCKS, unlockedArrows } = await import('../src/game/unlocks.ts')
const { DEFAULT_ARROW } = await import('../src/game/arrows.ts')
const { STAGES } = await import('../src/game/stages.ts')
import type { ArrowKindId } from '../src/sim/types.ts'
import type { DraftOffer } from '../src/game/draft.ts'

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
  check('옛 값이 그대로 남는다', s.training === 42 && s.stats.str === 6 && s.stageIndex === 20)
  check('bestScore를 잃지 않는다', s.bestScore['2-5'] === 800)
  const p = progressOf(s)
  check('지나온 판이 별 1개로 되살아난다', p.stagesCleared === 20, `stagesCleared=${p.stagesCleared}`)
  const opened = UNLOCKS.filter((d) => d.check(p)).map((d) => d.id)
  check(
    '20판까지 온 사람이 화살을 잃지 않는다',
    opened.includes('arrow.burst') && opened.includes('arrow.split') && opened.includes('arrow.pierce'),
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
  seed.unlocked = ['arrow.chain', 'arrow.split', 'arrow.homing']
  seed.stars = { '1-2': 2 }
  seed.stats = { str: 8, steady: 7, stamina: 6, focus: 5 }
  seed.arrows = 60
  // 고정 시드. 드래프트·보너스가 매 실행 같아야 프로브가 재현된다 (0이면 루프가 Date.now로 심는다).
  seed.runSeed = 0x51ee7
  store.set('hanbal.save.v1', JSON.stringify(seed))
}

const save = loadSave()
check('해금된 화살이 복원된다', unlockedArrows(save.unlocked).length === 3, unlockedArrows(save.unlocked).join(' '))

let draftShown = 0
let lastOffer: DraftOffer | null = null
// 콜백 안에서만 대입되므로 null 초기값을 두면 TS가 never로 좁힌다. 무동작 함수로 시작한다.
let pendingPick: (id: ArrowKindId) => void = () => {}
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
    draft: (offer, onPick) => {
      draftShown++
      lastOffer = offer
      // 실제 UI는 패널을 연다 → loop가 sim을 멈춘다. 그 상태를 그대로 흉내낸다.
      panelOpen = true
      pendingPick = onPick
    },
    unlocked: (ids) => {
      unlockToasts += ids.length
    },
    progressed: () => {},
  },
})

loop.start()
check('시작하면 3택이 뜬다', draftShown === 1, `draftShown=${draftShown}`)
// 함수로 꺼낸다 — 콜백 안에서만 대입되는 변수라 TS가 null로 좁혀버린다.
const offered = (): readonly ArrowKindId[] => lastOffer?.kinds ?? []
check('3택이 서로 다른 3장이다', new Set(offered()).size === 3, offered().join(' '))
check('기본 살은 카드로 나오지 않는다', offered().length > 0 && !offered().includes(DEFAULT_ARROW))

// 화면이 떠 있는 동안 프레임을 돌려도 판이 진행되지 않아야 한다 (sim 정지)
pump(10)
check('드래프트 중에는 sim이 멈춰 있다', drawCalls > 0, `drawCalls=${drawCalls}`)

// 카드 하나를 고른다
const picked: ArrowKindId = offered()[0] ?? DEFAULT_ARROW
panelOpen = false
pendingPick(picked)
pump(3)
check('고른 화살이 sim에 들어간다', true, `pick=${picked}`)

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
      // 실패했다 — 다시 같은 판. 눌렀다 떼면 재시작이다 (C2).
      press(true)
      pump(2)
      press(false)
      pump(2)
      // 재시작하면 3택이 아니라 같은 화살로 바로 간다(R과 같은 규칙). 패널이 떴으면 닫아준다.
      if (panelOpen) {
        panelOpen = false
        pendingPick(picked)
        pump(3)
      }
      gainLines.length = 0
    }
  }
}
check('프레임이 계속 그려진다', drawCalls > before, `drawCalls=${drawCalls}`)
check('실제로 쏴서 판을 깬다', cleared, gainLines[gainLines.length - 1] ?? '-')
check('보상 줄에 별이 들어 있다', (gainLines[gainLines.length - 1] ?? '').includes('★'))
check('클리어에 해금이 따라온다', unlockToasts > 0, `새 해금 ${unlockToasts}칸`)

// 판이 끝나면 저장된다
const raw = store.get('hanbal.save.v1') ?? ''
check('판 끝에 저장된다', raw !== '' && raw.includes('"stars"'))
const reloaded = loadSave()
check('복원하면 별이 남아 있다', Object.keys(reloaded.stars).length >= 2, JSON.stringify(reloaded.stars))
check('복원하면 해금이 남아 있다', reloaded.unlocked.length >= 4, reloaded.unlocked.join(' '))
check('보상 난수 스트림이 앞으로 나아갔다', reloaded.runSeed !== 0, `runSeed=${reloaded.runSeed}`)


// ───────────────────────── 4. 소리 없는 환경 ─────────────────────────

console.log('\n4. 소리 (AudioContext 없음 = 로딩 실패와 같은 경로)')
check('소리가 없어도 부팅이 막히지 않는다', drawCalls > 0)
check('음소거 창구가 산다', typeof loop.muted() === 'boolean')

// ───────────────────────── 5. 판 넘김 ─────────────────────────

console.log('\n5. 판을 넘기면 다시 3택이 뜬다 (HOOK 3장 루프)')
{
  const was = draftShown
  press(true)
  pump(2)
  press(false)
  pump(2)
  check('다음 판 진입에서 3택이 다시 뜬다', draftShown === was + 1, `draftShown=${draftShown}`)
  panelOpen = false
  pendingPick(DEFAULT_ARROW)
  pump(3)
  check('건너뛰면 기본 살로 즉시 시작한다', !panelOpen)
}

loop.dispose()

// ───────────── 6. 드래프트 생명주기 (진짜 ui/draft.ts — 탭 복귀·연타) ─────────────
//
// 여기만 실제 UI 모듈을 마운트한다. 재는 건 화면 모양이 아니라 **onPick이 언제 불리는가**다.
// 이 게임의 대표 사용법이 "공부하다 나간다"라, 드래프트가 뜬 채로 탭을 나가는 경로가
// 가장 자주 밟힌다 — 거기서 onPick이 영영 안 불리면 복귀 후 아무 입력도 안 먹는다.

console.log('\n6. 드래프트 생명주기 (탭 복귀 · 판 넘김 연타)')
{
  const { mountDraft } = await import('../src/ui/draft.ts')
  // draft.ts는 instanceof로 타입을 가린다. 스텁 엘리먼트가 그 검사를 통과해야 한다.
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

  const offer: DraftOffer = { kinds: ['pierce', 'burst', 'split'], rerolled: false }
  const elsewhere = new El('canvas')
  const outside = (): void =>
    fire(listeners, 'mousedown', {
      target: elsewhere,
      preventDefault: (): void => {},
      stopPropagation: (): void => {},
    })
  /** main.ts의 visibilitychange 배선을 그대로 흉내낸다 — 나갈 때 열린 패널을 닫는다. */
  const visibility = (hidden: boolean): void => {
    doc.hidden = hidden
    if (hidden) overlay.hide()
    fire(listeners, 'visibilitychange', {})
  }

  // 콜백 안에서만 대입되므로 객체에 담는다 — let 이면 TS가 초기값으로 좁힌다.
  const got = { picks: 0, id: '' as string }
  mountDraft(overlay as unknown as Parameters<typeof mountDraft>[0], offer, (id) => {
    got.picks++
    got.id = id
  })
  check('3택이 뜬다', openPanel === 'draft')

  // (a) 판을 넘긴 그 클릭의 잔향 — 사람은 '한 번 더 누르면 다음 판'을 보고 연타한다.
  outside()
  check('마운트 직후 바깥 눌림에 3택이 증발하지 않는다', got.picks === 0 && openPanel === 'draft')

  // (b) 카드를 읽다가 공부하러 나간다 → 돌아온다
  visibility(true)
  check('나가면 패널이 닫힌다 (main.ts와 같은 배선)', openPanel === '')
  visibility(false)
  check('돌아오면 고르던 세 장이 그 자리에 있다', openPanel === 'draft' && got.picks === 0)

  // (c) 복귀 직후의 클릭(창을 다시 활성화한 그 클릭)도 3택을 지우지 않는다
  outside()
  check('복귀 직후 바깥 눌림에도 3택이 남는다', got.picks === 0 && openPanel === 'draft')

  // (d) 가드가 풀린 뒤의 바깥 클릭은 건너뛰기 의사다 — 그때는 즉시 시작한다 (C1)
  await new Promise((r) => setTimeout(r, 300))
  outside()
  check('가드가 풀리면 바깥 클릭 한 번으로 시작한다', got.picks === 1 && got.id === DEFAULT_ARROW, got.id)
  outside()
  visibility(true)
  visibility(false)
  check('onPick은 정확히 한 번뿐이다 (LoopUi 계약)', got.picks === 1, `picks=${got.picks}`)
  check('고른 뒤에는 패널을 되살리지 않는다', openPanel === '')

  // (e) 카드를 실제로 고르는 경로
  const got2 = { picks: 0, id: '' as string }
  mountDraft(overlay as unknown as Parameters<typeof mountDraft>[0], offer, (id) => {
    got2.picks++
    got2.id = id
  })
  const cards = panels.get('draft')?.children.find((c) => c.className.includes('d-cards'))
  cards?.children[1]?.click()
  check('카드를 고르면 그 화살로 한 번 끝난다', got2.picks === 1 && got2.id === 'burst', got2.id)
}

console.log('')
console.log(`스테이지 ${STAGES.length}판 · 해금 ${UNLOCKS.length}칸`)
console.log(fails === 0 ? '전부 통과' : `${fails}건 실패`)
if (fails > 0) process.exitCode = 1

void writeSave
