export {}
/**
 * 판 배치 프로브 — **한 화면에 들어오는가** (2026-09-11)
 *
 * 형: **"화면이 스크롤 너무 내려야 하는데 이거. 게임화면은 넓게 쓰는데 UI 인터페이스가
 * 너무 빈공간이 많아서 한눈에 안들어와."**
 *
 * 브라우저가 없으니(CLAUDE.md) 진짜 픽셀 높이는 못 잰다. 대신 **세로로 쌓이는 줄 수**를
 * 센다 — 스크롤의 원인은 결국 "위에서 아래로 몇 줄이 쌓이는가"이기 때문이다.
 * DOM 스텁으로 진짜 `ui/growth.ts` 를 세우고, 줄(.g-row 스탯 · .g-bow 활 · .f-row 개조)이
 * **어느 단에** 들어갔는지 트리에서 직접 읽는다.
 *
 *   한 단일 때 높이 ≈ 모든 줄의 합
 *   두 단일 때 높이 ≈ 두 단 중 **긴 쪽**
 *
 * 그리고 CSS 쪽 사실 셋을 같이 못 박는다:
 *   ① 판의 폭이 화면 폭을 따라 커진다 (--pw 단계가 있다)
 *   ② 넓은 화면에서 .hb-cols 가 두 단이 된다
 *   ③ 글줄에는 상한이 있다 (넓다고 한 줄이 화면을 가로지르면 안 된다)
 *
 * 실행: node --experimental-strip-types tools/probe-layout.ts
 */
import { readFileSync, readdirSync } from 'node:fs'

// ─────────────────────────── DOM 스텁 (probe-map.ts 와 같은 문법) ───────────────────────────

class El {
  tag: string
  className = ''
  innerHTML = ''
  textContent = ''
  type = ''
  title = ''
  disabled = false
  checked = false
  tabIndex = 0
  children: El[] = []
  parent: El | null = null
  attrs = new Map<string, string>()
  style: Record<string, string> & { setProperty: (k: string, v: string) => void } = Object.assign(
    Object.create(null) as Record<string, string>,
    { setProperty: (): void => {} },
  )
  clientWidth = 1060
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
  constructor(tag: string) { this.tag = tag }
  setAttribute(k: string, v: string): void {
    this.attrs.set(k, v)
    if (k === 'class') this.className = v
  }
  getAttribute(k: string): string | null { return this.attrs.get(k) ?? null }
  appendChild(c: El): El { c.parent = this; this.children.push(c); return c }
  append(...cs: El[]): void { for (const c of cs) this.appendChild(c) }
  replaceChildren(): void { this.children = [] }
  addEventListener(): void {}
  removeEventListener(): void {}
  focus(): void {}
  /** innerHTML 로 심은 것까지는 못 만든다 — 이 프로브가 세는 줄은 전부 createElement 로 만든다. */
  get firstChild(): El { return this.children[0] ?? this.appendChild(new El('span')) }
  querySelector(): El { return new El('b') }
  /** innerHTML 로 심은 것은 못 만든다 — 배치만 재는 프로브라 빈 껍데기를 돌려준다. */
  querySelectorAll(): El[] { return [new El('span'), new El('span'), new El('span')] }
  walk(fn: (e: El) => void): void {
    fn(this)
    for (const c of this.children) c.walk(fn)
  }
}

const g = globalThis as unknown as Record<string, unknown>
g['document'] = {
  createElement: (t: string): El => new El(t),
  createElementNS: (_ns: string, t: string): El => new El(t),
  addEventListener: (): void => {},
  removeEventListener: (): void => {},
}
g['window'] = {
  addEventListener: (): void => {},
  removeEventListener: (): void => {},
  setTimeout: (): number => 0,
  clearTimeout: (): void => {},
  matchMedia: (): { matches: boolean; addEventListener: () => void } => ({ matches: false, addEventListener: (): void => {} }),
}
g['localStorage'] = {
  getItem: (): string | null => null,
  setItem: (): void => {},
  removeItem: (): void => {},
  key: (): string | null => null,
  length: 0,
}

const panels = new Map<string, El>()
const overlay = {
  panel: (id: string): El => {
    const p = panels.get(id) ?? new El('div')
    panels.set(id, p)
    return p
  },
  hud: (): El => new El('div'),
  toast: (): void => {},
  show: (): void => {},
  hide: (): void => {},
  showing: (): boolean => false,
  onDispose: (): void => {},
  warmFont: (): void => {},
  root: new El('div'),
}

// ─────────────────────────── 검사 ───────────────────────────

let fails = 0
function check(ok: boolean, label: string, detail = ''): void {
  if (!ok) fails++
  console.log(`  ${ok ? 'ok ' : '✗  '} ${label.padEnd(46)} ${detail}`)
}

console.log('신궁 — 판 배치 프로브 (형: "빈공간이 너무 많아서 한눈에 안들어와")\n')

// ── 1. CSS — 판이 화면을 따라 넓어지는가 ──────────────────────────────
console.log('1. 판의 폭 · 두 단')
{
  const css = readFileSync('src/ui/overlay.ts', 'utf8')
  // --pw 의 단계. 기본 하나 + 넓은 화면용 여럿.
  const steps = [...css.matchAll(/--pw:\s*(\d+)px/g)].map((m) => Number(m[1]))
  check(steps.length >= 3, '판 폭이 화면 폭을 따라 커진다', `단계 ${steps.join(' → ')}px`)
  check(
    steps.length >= 2 && Math.max(...steps) >= 1000,
    '가장 넓은 단계가 1000px 이상이다',
    `최대 ${steps.length > 0 ? Math.max(...steps) : 0}px`,
  )
  check(css.includes('width: min(var(--pw), 100%)'), '판이 그 폭을 실제로 쓴다')
  // 두 단 — 좁을 때 1단, 넓을 때 2단.
  const cols = /\.hb-cols\s*{[^}]*grid-template-columns:\s*1fr\s*;/.test(css)
  const cols2 = /\.hb-cols\s*{\s*grid-template-columns:\s*1fr 1fr/.test(css)
  check(cols, '좁은 화면에서는 한 단이다 (폰은 그대로)')
  check(cols2, '넓은 화면에서는 두 단이 된다')
  // 글줄 상한 — 넓어졌다고 한 줄이 화면을 가로지르면 읽기가 더 나빠진다.
  check(/\.hb-lead\s*{[^}]*max-width:\s*\d+ch/.test(css), '안내 글줄에 상한이 있다')
}

// ── 2. 성장 화면 — 줄이 두 단으로 갈렸는가 ────────────────────────────
console.log('\n2. 성장 화면 — 세로로 쌓이는 줄')
{
  const { defaultSave } = await import('../src/game/save.ts')
  const { mountGrowth } = await import('../src/ui/growth.ts')
  const d = defaultSave(0)
  d.training = 9999
  // 활을 다 열어 둔다 — 줄이 가장 많은 최악의 경우로 재야 의미가 있다.
  d.unlocked = ['bow.horn', 'bow.composite', 'bow.war', 'bow.light']
  mountGrowth(overlay as never, d, () => {}, { muted: () => false, setMuted: () => {} } as never)
  const panel = panels.get('growth') as El

  /** 이 덩이 안의 '세로로 쌓이는 줄' 수. 스탯·활·개조 줄만 센다 (이게 높이의 전부다). */
  const rowsIn = (root: El): number => {
    let n = 0
    root.walk((e) => {
      const c = ` ${e.className} `
      if (c.includes(' g-row ') || c.includes(' g-bow ') || c.includes(' f-row ')) n++
    })
    return n
  }

  const cols = ((): El | null => {
    let found: El | null = null
    panel.walk((e) => { if (found === null && e.className.split(' ').includes('hb-cols')) found = e })
    return found
  })()
  check(cols !== null, '성장 화면이 두 단 틀을 쓴다')
  if (cols !== null) {
    const [a, b] = (cols as El).children
    const ra = a === undefined ? 0 : rowsIn(a)
    const rb = b === undefined ? 0 : rowsIn(b)
    const stacked = ra + rb
    const tallest = Math.max(ra, rb)
    check(ra > 0 && rb > 0, '두 단에 내용이 나뉘어 있다', `왼쪽 ${ra}줄 · 오른쪽 ${rb}줄`)
    check(
      tallest < stacked,
      '세로로 쌓이는 줄이 줄었다',
      `${stacked}줄 → ${tallest}줄 (${Math.round((1 - tallest / Math.max(1, stacked)) * 100)}% 짧아짐)`,
    )
    // 두 단이 너무 기울면 한쪽만 길어 결국 스크롤이 산다.
    const skew = Math.abs(ra - rb) / Math.max(1, stacked)
    check(skew <= 0.45, '두 단의 길이가 심하게 안 기운다', `치우침 ${(skew * 100).toFixed(0)}% (상한 45%)`)
  }
}

// ── 3. 출정 화면 — 네 구역이 두 단으로 갈렸는가 ───────────────────────
console.log('\n3. 출정 화면 — 구역이 두 단으로')
{
  const { defaultSave } = await import('../src/game/save.ts')
  const { mountLoadout } = await import('../src/ui/loadout.ts')
  const d = defaultSave(0)
  d.training = 9999
  // 살 가게는 **발견한 살**만 판다 — 비워 두면 가게가 한 줄로 줄어 재는 의미가 없다.
  for (const k of ['burst', 'chain', 'split', 'scatter', 'rapid']) d.arrowStock[k] = 3
  mountLoadout(overlay as never, ['practice', 'horn', 'composite', 'war', 'light'] as never, d, 1, () => {})
  const panel = panels.get('loadout') as El

  /** 구역 머리(.l-sec) · 카드 판(.l-grid) · 가게 줄(.l-srow) — 세로로 자리를 먹는 것들. */
  const blocksIn = (root: El): number => {
    let n = 0
    root.walk((e) => {
      const c = ` ${e.className} `
      if (c.includes(' l-sec ') || c.includes(' l-grid ') || c.includes(' l-srow ')) n++
    })
    return n
  }
  const cols = ((): El | null => {
    let found: El | null = null
    panel.walk((e) => { if (found === null && e.className.split(' ').includes('hb-cols')) found = e })
    return found
  })()
  check(cols !== null, '출정 화면이 두 단 틀을 쓴다')
  if (cols !== null) {
    const [a, b] = (cols as El).children
    const ra = a === undefined ? 0 : blocksIn(a)
    const rb = b === undefined ? 0 : blocksIn(b)
    check(ra > 0 && rb > 0, '두 단에 내용이 나뉘어 있다', `왼쪽 ${ra}칸 · 오른쪽 ${rb}칸`)
    check(
      Math.max(ra, rb) < ra + rb,
      '세로로 쌓이는 칸이 줄었다',
      `${ra + rb}칸 → ${Math.max(ra, rb)}칸`,
    )
  }
}

// ── 4. 두 단을 쓰는 판이 몇이나 되는가 ────────────────────────────────
console.log('\n4. 두 단을 쓰는 판')
{
  const dir = 'src/ui'
  const users: string[] = []
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.ts') || f === 'overlay.ts') continue
    if (readFileSync(`${dir}/${f}`, 'utf8').includes("'hb-cols'")) users.push(f.replace('.ts', ''))
  }
  check(users.length >= 3, '긴 판들이 두 단을 쓴다', users.join(' · ') || '(없다)')
}

// ── 5. 지도 — 넓어진 판을 실제로 채우는가 ─────────────────────────────
console.log('\n5. 행로도 — 넓어진 판을 채운다')
{
  const src = readFileSync('src/ui/map.ts', 'utf8')
  const m = /const MAP_MAX_SCALE = ([\d.]+)/.exec(src)
  const cap = m === null ? 0 : Number(m[1])
  check(cap > 1, '지도가 판 폭에 맞춰 **커지기도** 한다', `상한 ×${cap}`)
  check(
    src.includes('Math.min(MAP_MAX_SCALE, avail / BOARD_W)'),
    '배율이 칸 폭에서 나온다 (고정 배율이 아니다)',
  )
}

console.log('')
if (fails > 0) {
  console.log(`실패 ${fails}건`)
  process.exit(1)
}
console.log('전부 통과')
