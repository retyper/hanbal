export {}
/**
 * 지도 프로브 — **행로도가 실제로 그려지는지 숫자로 본다** (2026-09-10)
 *
 * 형: "지도가 지금 너무 멋이 없으니까 더 그럴듯하게 만들어봐. 지도답게좀." → 종이·산줄기·물길·
 * 바다·나침반·표제를 전부 SVG 로 그리게 됐다. 도형이 수백 개다.
 *
 * SVG 는 **조용히 실패한다**: 좌표 하나가 NaN 이면 그 도형만 안 그려지고 오류도 안 난다.
 * 브라우저를 못 여는 데스크탑(CLAUDE.md)에서 그걸 알아채는 길은 트리를 직접 세어 보는 것뿐이다.
 *
 * 여기서 못 박는 것:
 *   ① 어떤 속성에도 NaN·undefined 가 없다 (도형이 조용히 사라지는 유일한 경로)
 *   ② 판 50개 · 지명 5개 · 길 · 나침반 · 표제가 다 있다
 *   ③ 보스 칸 5개는 붉은 인장, 관문 칸 5개는 문(門)을 달고 있다
 *   ④ 길이 종이 밖으로 안 나간다
 *   ⑤ 잠긴 관문을 누르면 **이유를 말한다** (조용히 무시하지 않는다)
 *
 * 실행: node --experimental-strip-types tools/probe-map.ts
 */

// ─────────────────────────── DOM 스텁 ───────────────────────────

class El {
  tag: string
  ns: string
  attrs = new Map<string, string>()
  className = ''
  innerHTML = ''
  textContent = ''
  children: El[] = []
  parent: El | null = null
  listeners = new Map<string, Array<() => void>>()
  style = { setProperty: (): void => {}, height: '' }
  clientWidth = 680
  classList = {
    add: (c: string): void => { this.className = `${this.className} ${c}`.trim() },
    remove: (c: string): void => { this.className = this.className.split(' ').filter((z) => z !== c).join(' ') },
    contains: (c: string): boolean => this.className.split(' ').includes(c),
    toggle: (c: string, on?: boolean): void => {
      const has = this.classList.contains(c)
      const want = on ?? !has
      if (want && !has) this.classList.add(c)
      if (!want && has) this.classList.remove(c)
    },
  }

  constructor(tag: string, ns = '') {
    this.tag = tag
    this.ns = ns
  }

  setAttribute(k: string, v: string): void {
    this.attrs.set(k, v)
    // 진짜 DOM 은 class 속성과 className 이 같은 것이다 — SVG 는 el('g', { class: … }) 로 만든다.
    if (k === 'class') this.className = v
  }
  getAttribute(k: string): string | null { return this.attrs.get(k) ?? null }
  appendChild(c: El): El { c.parent = this; this.children.push(c); return c }
  append(...cs: El[]): void { for (const c of cs) this.appendChild(c) }
  replaceChildren(): void { this.children = [] }
  addEventListener(t: string, fn: () => void): void {
    const arr = this.listeners.get(t) ?? []
    arr.push(fn)
    this.listeners.set(t, arr)
  }
  click(): void { for (const fn of this.listeners.get('click') ?? []) fn() }
  querySelector(): El | null { return null }
  /** 트리 전체를 훑는다. */
  walk(fn: (e: El) => void): void {
    fn(this)
    for (const c of this.children) c.walk(fn)
  }
}

const g = globalThis as unknown as Record<string, unknown>
g['document'] = {
  createElement: (t: string): El => new El(t),
  createElementNS: (ns: string, t: string): El => new El(t, ns),
}
const timers: Array<() => void> = []
g['window'] = {
  addEventListener: (): void => {},
  removeEventListener: (): void => {},
  setTimeout: (fn: () => void): number => { timers.push(fn); return timers.length },
  clearTimeout: (): void => {},
}

// ─────────────────────────── 오버레이 스텁 ───────────────────────────

const panels = new Map<string, El>()
const hudRoot = new El('div')
const toasts: string[] = []
let shownId = ''
const overlay = {
  panel: (id: string): El => {
    const p = panels.get(id) ?? new El('div')
    panels.set(id, p)
    return p
  },
  hud: (): El => hudRoot,
  toast: (msg: string): void => { toasts.push(msg) },
  show: (id: string): void => { shownId = id },
  hide: (): void => { shownId = '' },
  showing: (id: string): boolean => shownId === id,
  onDispose: (): void => {},
  root: new El('div'),
}

// ─────────────────────────── 검사 ───────────────────────────

let fails = 0
function check(ok: boolean, label: string, detail = ''): void {
  if (!ok) fails++
  console.log(`  ${ok ? 'ok ' : '✗  '} ${label.padEnd(44)} ${detail}`)
}

const { mountMap, updateMap } = await import('../src/ui/map.ts')
const { CAMPAIGN, BOSS_EVERY } = await import('../src/game/stages.ts')

console.log('신궁 — 지도 프로브 (행로도)')

// 보스 셋을 잡아본 사람 · 34판까지 가본 사람으로 세운다.
const jumps: number[] = []
mountMap(overlay as never, { '1-10': 3, '2-1': 1 }, 3, 34, false, (i) => jumps.push(i))
const panel = overlay.panel('map')

// ── ① NaN·undefined 가 없다 ──
console.log('\n1. 속성에 NaN·undefined 가 없다')
let bad = ''
let attrs = 0
panel.walk((e) => {
  for (const [k, v] of e.attrs) {
    attrs++
    if (v.includes('NaN') || v.includes('undefined') || v === '') {
      if (bad === '') bad = `<${e.tag} ${k}="${v}">`
    }
  }
})
check(bad === '', '모든 속성이 성한 값이다', bad === '' ? `${attrs}개 검사` : bad)

// ── ② 있어야 할 것들 ──
console.log('\n2. 지도에 있어야 할 것')
const byTag = new Map<string, El[]>()
panel.walk((e) => {
  const arr = byTag.get(e.tag) ?? []
  arr.push(e)
  byTag.set(e.tag, arr)
})
const nodes = (byTag.get('g') ?? []).filter((e) => e.className.includes('mp-node'))
const texts = byTag.get('text') ?? []
const words = texts.map((t) => t.textContent)
check(nodes.length === CAMPAIGN, `판이 ${CAMPAIGN}개다`, `${nodes.length}개`)
check(words.includes('神弓行路圖'), '표제가 있다')
check(words.includes('北'), '나침반이 있다')
for (const place of ['활터', '솔숲', '바람재', '돌다리', '높은재']) {
  check(words.includes(place), `지명 '${place}' 이 있다`)
}
const paths = byTag.get('path') ?? []
check(paths.length > 30, '산줄기·물길·바다가 그려졌다', `path ${paths.length}개`)

// ── ③ 보스는 인장, 관문은 문 ──
console.log('\n3. 보스는 인장 · 관문은 문(門)')
const bossMarks = (byTag.get('rect') ?? []).filter((e) => (e.getAttribute('transform') ?? '').startsWith('rotate(45'))
check(bossMarks.length === Math.floor(CAMPAIGN / BOSS_EVERY), '보스 칸이 마름모 인장이다', `${bossMarks.length}개`)
check(words.filter((t) => t === '鬼').length === Math.floor(CAMPAIGN / BOSS_EVERY), '인장에 鬼 가 찍혀 있다')
const gates = paths.filter((e) => (e.getAttribute('d') ?? '').includes('M ') && e.getAttribute('stroke-width') === '1.6')
check(gates.length >= 5, '관문에 문이 달려 있다', `${gates.length}개`)

// ── ④ 길이 종이 밖으로 안 나간다 ──
console.log('\n4. 길이 종이 안에 있다')
const svg = (byTag.get('svg') ?? [])[0]
const W = Number(svg?.getAttribute('width') ?? 0)
const H = Number(svg?.getAttribute('height') ?? 0)
let outside = 0
for (const e of byTag.get('g') ?? []) {
  if (!e.className.includes('mp-node')) continue
  for (const c of e.children) {
    const cx = Number(c.getAttribute('cx') ?? c.getAttribute('x') ?? NaN)
    const cy = Number(c.getAttribute('cy') ?? c.getAttribute('y') ?? NaN)
    if (Number.isFinite(cx) && (cx < 0 || cx > W)) outside++
    if (Number.isFinite(cy) && (cy < 0 || cy > H)) outside++
  }
}
check(W > 0 && H > 0, '종이 크기가 잡혔다', `${W}x${H}`)
check(outside === 0, '칸이 종이 밖으로 안 나간다', `${outside}건`)

// ── ⑤ 잠긴 관문은 **이유를 말한다** ──
console.log('\n5. 거절할 때 말한다')
toasts.length = 0
// 보스 셋을 잡았으니 4-1(31판)까지 열려 있다. 5-1(41판)은 잠겨 있어야 한다.
const ckpt41 = nodes[40]
ckpt41?.click()
check(toasts.length === 1 && toasts[0]!.includes('열린다'), '잠긴 문은 이유를 말한다', toasts[0] ?? '(말이 없다)')
toasts.length = 0
const plain = nodes[3]
plain?.click()
check(toasts.length === 1 && toasts[0]!.includes('문'), '보통 칸도 왜 못 가는지 말한다', toasts[0] ?? '(말이 없다)')
// 열린 관문은 두 번 눌러야 간다.
toasts.length = 0
jumps.length = 0
const ckpt31 = nodes[30]
ckpt31?.click()
check(jumps.length === 0 && toasts.length === 1, '열린 문도 한 번엔 안 간다 (확인을 받는다)', toasts[0] ?? '')
ckpt31?.click()
check(jumps.length === 1 && jumps[0] === 30, '두 번째에 간다', `index ${jumps[0]}`)

// ── ⑥ 세이브가 바뀌면 화면이 따라온다 ──
console.log('\n6. 갱신')
updateMap({ '1-10': 3 }, 1, 12, false)
check(true, 'updateMap 이 터지지 않는다')

console.log('')
if (fails > 0) {
  console.log(`실패 ${fails}건`)
  process.exit(1)
}
console.log('전부 통과')
