export {}
/**
 * 판 배치 프로브 — **한 화면에 들어오는가** (2026-09-11)
 *
 * 형: **"화면이 스크롤 너무 내려야 하는데 이거. 게임화면은 넓게 쓰는데 UI 인터페이스가
 * 너무 빈공간이 많아서 한눈에 안들어와."**
 *
 * 브라우저가 없으니(CLAUDE.md) 진짜 픽셀 높이는 못 잰다. 대신 **한 칸에 쌓이는 줄 수**를
 * 센다 — 스크롤의 원인은 결국 "위에서 아래로 몇 줄이 쌓이는가"이기 때문이다.
 * DOM 스텁으로 진짜 `ui/growth.ts`·`ui/loadout.ts` 를 세우고, 줄이 **어느 칸에** 들어갔는지
 * 트리에서 직접 읽는다.
 *
 *   한 줄로 쌓을 때 높이 ≈ 모든 줄의 합
 *   칸으로 나눌 때 높이 ≈ 칸 중 **가장 긴 것**
 *
 * 그리고 CSS 쪽 사실을 같이 못 박는다:
 *   ① 판의 폭이 화면 폭을 따라 커진다 (--pw 단계가 있다)
 *   ② 판의 **높이는 화면이 정한다** (.hb-tall) — 내용이 정하면 그게 곧 스크롤이다
 *   ③ 아래 줄(출정 버튼)은 칸 **밖**에 있다 — 늘 보인다
 *   ④ 글줄에는 상한이 있다
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
  /** 어떤 사건을 듣고 있는가. '자세히'(ui/detail.ts)는 contextmenu 를 거는 유일한 곳이다. */
  listens = new Set<string>()
  addEventListener(t: string): void { this.listens.add(t) }
  removeEventListener(): void {}
  insertAdjacentHTML(_where: string, html: string): void { this.innerHTML += html }
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
  panelBox: (id: string): El => {
    const box = panels.get(id) ?? new El('div')
    panels.set(id, box)
    return box
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

console.log('신궁 — 판 배치 프로브 (형: "세로롤링 너무 게임 안같고 뭔 웹페이지 같잖아")\n')

// ── 1. CSS — 판이 화면을 따라 넓어지는가 ──────────────────────────────
console.log('1. 판의 폭 · 굴리지 않는 화면')
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
  // 굴리지 않는다 — 판의 높이를 화면이 정한다.
  check(/\.hb-panel\.hb-tall\s*{[^}]*height:\s*min\(/.test(css), '판의 높이를 화면이 정한다 (.hb-tall)')
  check(/\.hb-tall\s+\.hb-body\s*{[^}]*overflow:\s*hidden/.test(css), '판 전체는 굴러가지 않는다')
  check(css.includes('.hb-tabs'), '칸을 갈아타는 탭 줄이 있다')
  check(/\.hb-foot\s*{[^}]*flex:\s*none/.test(css), '아래 줄은 칸 밖에 있다 (늘 보인다)')
  // 글줄 상한 — 넓어졌다고 한 줄이 화면을 가로지르면 읽기가 더 나빠진다.
  check(/\.hb-lead\s*{[^}]*max-width:\s*\d+ch/.test(css), '안내 글줄에 상한이 있다')
}

// ── 2. 성장 화면 — 칸으로 갈렸는가 ──────────────────────────────────
console.log('\n2. 성장 화면 — 한 칸에 쌓이는 줄')
{
  const { defaultSave } = await import('../src/game/save.ts')
  const { mountGrowth } = await import('../src/ui/growth.ts')
  const d = defaultSave(0)
  d.training = 9999
  // 활을 다 열어 둔다 — 줄이 가장 많은 최악의 경우로 재야 의미가 있다.
  d.unlocked = ['bow.horn', 'bow.composite', 'bow.war', 'bow.light']
  mountGrowth(overlay as never, d, () => {}, { muted: () => false, setMuted: () => {} } as never)
  const panel = panels.get('growth') as El

  /** 이 덩이 안의 '세로로 쌓이는 줄' 수. 스탯·개조 줄만 센다 (이게 높이의 전부다). */
  const rowsIn = (root: El): number => {
    let n = 0
    root.walk((e) => {
      const c = ` ${e.className} `
      if (c.includes(' g-row ') || c.includes(' f-row ')) n++
    })
    return n
  }
  const panes: El[] = []
  panel.walk((e) => { if (e.className.split(' ').includes('hb-pane')) panes.push(e) })
  check(panes.length >= 3, '성장이 칸 셋으로 갈렸다', `${panes.length}칸`)
  const each = panes.map(rowsIn)
  const stacked = each.reduce((a2, b2) => a2 + b2, 0)
  const tallest = each.reduce((a2, b2) => Math.max(a2, b2), 0)
  check(stacked > 0, '칸에 줄이 들어 있다', each.join(' · ') + '줄')
  check(
    tallest < stacked,
    '한 칸에 쌓이는 줄이 줄었다',
    `${stacked}줄 → ${tallest}줄 (${Math.round((1 - tallest / Math.max(1, stacked)) * 100)}% 짧아짐)`,
  )
  // 활 걸이는 줄이 아니라 **걸이** 하나다 (ui/wheel.ts) — 다섯 줄이 한 칸으로 접혔다.
  let wheels = 0
  panel.walk((e) => { if (e.className.split(' ').includes('wh')) wheels++ })
  check(wheels === 1, '활 걸이가 돌아가는 걸이 하나다', `${wheels}개`)
}

// ── 3. 출정 화면 — 네 칸 ─────────────────────────────────────────────
console.log('\n3. 출정 화면 — 네 칸')
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
  const panes: El[] = []
  panel.walk((e) => { if (e.className.split(' ').includes('hb-pane')) panes.push(e) })
  check(panes.length === 4, '출정이 칸 넷으로 갈렸다 (활·갑옷·부적·살 가게)', `${panes.length}칸`)
  const each = panes.map(blocksIn)
  const stacked = each.reduce((a2, b2) => a2 + b2, 0)
  const tallest = each.reduce((a2, b2) => Math.max(a2, b2), 0)
  check(tallest < stacked, '한 칸에 쌓이는 칸이 줄었다', `${stacked}칸 → ${tallest}칸`)

  // 활은 걸이 하나다 (형: "활선택하는게 버튼이 아니라 롤이었으면").
  let wheels = 0
  panel.walk((e) => { if (e.className.split(' ').includes('wh')) wheels++ })
  check(wheels === 1, '활이 돌아가는 걸이 하나다', `${wheels}개`)

  // 출정 버튼은 칸 **밖**에 있다 — 어느 칸을 보고 있든 늘 보여야 한다.
  let goInPane = false
  let goFound = false
  for (const pane of panes) pane.walk((e) => { if (e.className.split(' ').includes('l-go')) goInPane = true })
  panel.walk((e) => { if (e.className.split(' ').includes('l-go')) goFound = true })
  check(goFound && !goInPane, "'나선다' 가 칸 밖에 있다 (늘 보인다)")
}

// ── 4. 칸으로 나눈 판이 몇이나 되는가 ─────────────────────────────────
console.log('\n4. 칸으로 나눈 판')
{
  const dir = 'src/ui'
  const users: string[] = []
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.ts') || f === 'tabs.ts') continue
    if (readFileSync(`${dir}/${f}`, 'utf8').includes('makeTabs(')) users.push(f.replace('.ts', ''))
  }
  check(users.length >= 2, '긴 판들이 칸으로 나뉘었다', users.join(' · ') || '(없다)')
}

// ── 5. 카드 겉면 — 세 층으로 갈렸는가 ─────────────────────────────────
//   형: "하스스톤은 (…) 화면에 가장중요한 설명, 탭할때 바로뜨는 부가 설명과 (…)
//        조금더 오래누르고 있으면 뜨는 추가설명, 이런식으로 커버하는데"
console.log('\n5. 카드 겉면 — 세 층')
{
  const panel = panels.get('loadout') as El
  const cards: El[] = []
  panel.walk((e) => { if (e.className.split(' ').includes('l-card')) cards.push(e) })
  check(cards.length > 0, '출정 화면에 카드가 있다', `${cards.length}장`)

  /**
   * 겉면에서 **글자를 지는 칸**의 수. 아이콘은 안 센다 — 자리를 먹는 건 글줄이다.
   *
   * 카드의 겉면은 innerHTML 한 덩이로 심는다 (스텁은 그걸 자식으로 안 쪼갠다).
   * 그래서 글자 칸은 문자열에서 센다 — 셈의 대상이 곧 소스에 적힌 그 칸들이다.
   */
  const faceLines = (card: El): number => {
    let n = 0
    for (const cls of ['l-n', 'l-d', 'l-key', 'l-syn2']) {
      n += (card.innerHTML.match(new RegExp(`class="[^"]*\\b${cls}\\b`, 'g')) ?? []).length
    }
    // innerHTML 이 아니라 createElement 로 붙인 칸도 있을 수 있다.
    card.walk((e) => {
      if (e === card) return
      const c = e.className.split(' ')
      if (c.includes('l-n') || c.includes('l-d') || c.includes('l-key') || c.includes('l-syn2')) n++
    })
    return n
  }
  const worst = cards.reduce((m, c) => Math.max(m, faceLines(c)), 0)
  // 예전 카드는 이름·한자·설명·값 넷을 겉면에 지고 있었다 (갑옷·부적은 넷, 활은 셋).
  check(worst <= 3, '겉면이 세 줄을 안 넘는다', `가장 긴 카드 ${worst}줄 (예전 4줄)`)

  const withDetail = cards.filter((c) => c.listens.has('contextmenu')).length
  check(withDetail === cards.length, '카드마다 길게 누르면 뜨는 설명이 있다', `${withDetail}/${cards.length}장`)

  // ② 탭하면 바로 뜨는 한 줄 — 활과 갑옷 두 곳에 있다.
  let syn = 0
  panel.walk((e) => { if (e.className.split(' ').includes('l-syn')) syn++ })
  check(syn >= 2, '고른 것의 설명이 바로 뜨는 줄이 있다', `${syn}곳`)

  // 안내 — 설명이 어디로 갔는지 한 번은 말해 줘야 한다.
  const css = readFileSync('src/ui/overlay.ts', 'utf8')
  check(css.includes('.hb-detail'), '말풍선 스타일이 있다')
  check(css.includes('.hb-tip'), "'길게 눌러 자세히' 안내 스타일이 있다")
}

// ── 6. 살통 — 버튼 줄이 아니라 걸이인가 ──────────────────────────────
//   형: "화살 아직도 게임화면에서 하나하나 버튼인데 이거 리볼빙되듯 만들어야 한다니까?"
console.log('\n6. 살통 — 걸이')
{
  const { defaultSave } = await import('../src/game/save.ts')
  const { mountQuiver } = await import('../src/ui/quiver.ts')
  const d = defaultSave(0)
  // 가져본 적 있는 살 넷 — 이게 있어야 살통이 뜬다.
  for (const k of ['burst', 'chain', 'split', 'rapid']) d.arrowStock[k] = 3
  const hud = new El('div')
  const o2 = { ...overlay, hud: (): El => hud }
  mountQuiver(o2 as never, d)

  let wheels = 0
  let cards = 0
  let buttons = 0
  hud.walk((e) => {
    const c = e.className.split(' ')
    if (c.includes('wh')) wheels++
    if (c.includes('wh-card')) cards++
    // 예전 모습: 살 하나에 버튼 하나 (.q-btn). 하나라도 남아 있으면 안 고친 것이다.
    if (c.includes('q-btn')) buttons++
  })
  check(wheels === 1, '살통이 걸이 하나다', `걸이 ${wheels}개`)
  check(buttons === 0, '살 하나에 버튼 하나이던 것이 없어졌다', `남은 버튼 ${buttons}개`)
  // 유엽전 + 가져본 살 넷 = 다섯 칸. **자리는 하나**이고 칸만 늘어난다.
  check(cards === 5, '유엽전까지 걸이에 걸린다', `${cards}칸 (유엽전 + 4)`)
  let slim = 0
  hud.walk((e) => { if (e.className.split(' ').includes('wh-slim')) slim++ })
  check(slim === 1, '좁은 자리용(슬림) 걸이를 쓴다')
}

// ── 7. 활 그림 — 각각 등록됐는가 ─────────────────────────────────────
//   형: "활도 각각 이미지로 등록되어야해. 개떡같은 svg 말고."
console.log('\n7. 활 그림')
{
  const { BOW_KINDS } = await import('../src/game/bows.ts')
  const missing: string[] = []
  for (const b of BOW_KINDS) {
    const f = `public/sprites/bow-${b.id}.png`
    try { readFileSync(f) } catch { missing.push(b.id) }
  }
  check(missing.length === 0, '활마다 그림이 있다', missing.length === 0 ? `${BOW_KINDS.length}자루` : `없는 것: ${missing.join(' ')}`)
  // 비율이 안 눌렸는가 — 정사각으로 억지로 맞추면 활이 눌린다 (형: "이상하게 잘렸는데?").
  // 다섯이 **같은 비율**이어야 한 벌로 읽힌다.
  const shape = BOW_KINDS.map((b) => {
    const f = readFileSync(`public/sprites/bow-${b.id}.png`)
    return [f.readUInt32BE(16), f.readUInt32BE(20)]
  })
  const ratios = shape.map(([w, h]) => (w ?? 1) / (h ?? 1))
  const spread = Math.max(...ratios) - Math.min(...ratios)
  check(spread < 0.25, '다섯의 비율이 비슷하다 (한 벌로 읽힌다)',
    shape.map(([w, h]) => `${w ?? 0}x${h ?? 0}`).join(' · '))
  const ui = readFileSync('src/ui/overlay.ts', 'utf8')
  check(!/\.wh-card \.wh-art\s*{[^}]*transform:\s*rotate/.test(ui),
    '카드에서 돌리지 않는다 (그림이 이미 대각선이다)')
}

// ── 8. 지도 — 넓어진 판을 실제로 채우는가 ─────────────────────────────
console.log('\n8. 행로도 — 넓어진 판을 채운다')
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

// ── 9. 끝난 화면 — GAME OVER 가 주인공인가 ────────────────────────────
//   형: "실패화면에는 수렵총 말고 다른걸 써야겠는데. 143판보다 게임오버가 더 중요하잖아.
//        왤케 텍스트가 쓸데없이 많아. 몰기는 이 몰기가 뭐야 대체."
//   눈으로 봐야 아는 것(색·여백)은 못 재지만, **무엇이 제일 큰가**와 **줄이 몇 개인가**는
//   숫자다. 이 셋은 다시 늘어나기 쉬운 것들이라 여기에 못 박아 둔다.
console.log('\n9. 끝난 화면 — GAME OVER')
{
  const { defaultSave } = await import('../src/game/save.ts')
  const { showReinforce } = await import('../src/ui/growth.ts')
  const css = readFileSync('src/ui/growth.ts', 'utf8')

  const headCss = /\.r-head\s*{([^}]*)}/.exec(css)?.[1] ?? ''
  check(!headCss.includes('url('), '끝난 화면 머리에 그림이 없다')
  const over = Number(/\.r-over\s*{[^}]*font-size:\s*(\d+)px/.exec(css)?.[1] ?? 0)
  const stage = Number(/\.r-stage b\s*{[^}]*font-size:\s*(\d+)px/.exec(css)?.[1] ?? 0)
  check(over > stage && over >= 40, 'GAME OVER 가 판 수보다 크다', `${over}px vs ${stage}px`)

  const d2 = defaultSave(0)
  d2.training = 40
  showReinforce(
    overlay as never, d2,
    {
      reached: 143, best: 143, score: 900, isNew: true, first: false, reason: 'death',
      training: 40, stars: 2, jung: 5, molgi: true, nextStage: 121,
    } as never,
    { muted: () => false, setMuted: () => {} } as never,
    () => {},
  )
  const rp = panels.get('reinforce') as El
  let rhead: El | null = null
  rp.walk((e) => { if (e.className.split(' ').includes('r-head')) rhead = e })
  const html = rhead === null ? '' : (rhead as El).innerHTML
  check(html.includes('GAME OVER'), '가장 먼저 GAME OVER 라고 쓴다')
  check(!html.includes('몰기'), "'몰기'라는 말을 안 쓴다", html.includes('연달아') ? '연달아 5발 이라고 쓴다' : '')
  // 줄 수 — 죽은 직후에 읽히는 글은 한두 줄이다. 다섯 줄이면 이미 많은 것이다.
  const lines = (html.match(/<div class="r-/g) ?? []).length
  check(lines <= 5, '머리의 줄이 다섯을 안 넘는다', `${lines}줄`)

  // 강화 칸에도 머리 그림 — 대장간만 그림이 있으면 그쪽만 만든 칸으로 읽힌다.
  check(/\.s-h\s*{[^}]*url\(/.test(css), '강화 머리에 그림이 있다 (.s-h)')
  const hasStatHead = (root: El): boolean => {
    let yes = false
    root.walk((e) => { if (e.className.split(' ').includes('s-h')) yes = true })
    return yes
  }
  check(hasStatHead(rp), '끝난 화면의 강화 칸에 머리 그림이 선다')
  check(hasStatHead(panels.get('growth') as El), '성장 화면의 능력치 칸에도 같은 머리가 선다')
}

console.log('')
if (fails > 0) {
  console.log(`실패 ${fails}건`)
  process.exit(1)
}
console.log('전부 통과')
