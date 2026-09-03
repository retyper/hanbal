export {}
/**
 * 오프닝 프로브 — **가로 안내가 세로에서만 뜨는지 숫자로 본다.**
 *
 * 브라우저를 못 여는 데스크탑(CLAUDE.md)이라, DOM을 최소 스텁으로 세우고 ui/opening.ts 를
 * 진짜로 mount 한 뒤 트리를 들여다본다. 회전 자체는 CSS라 probe-style.ts 가 문법·토큰을 보고,
 * 여기서는 **언제 붙고 언제 떨어지는가**와 **시작이 정확히 한 번인가**만 본다.
 *
 * 실행: node --experimental-strip-types tools/probe-opening.ts
 * 하나라도 어긋나면 종료 코드 1.
 */

class El {
  tag: string
  className = ''
  innerHTML = ''
  textContent = ''
  children: El[] = []
  parent: El | null = null
  style = { setProperty: (): void => {} }
  ls = new Map<string, Array<(e: unknown) => void>>()
  constructor(tag: string) {
    this.tag = tag
  }
  appendChild(c: El): El {
    c.parent = this
    this.children.push(c)
    return c
  }
  remove(): void {
    const p = this.parent
    if (p !== null) p.children = p.children.filter((x) => x !== this)
    this.parent = null
  }
  replaceChildren(): void {
    this.children.length = 0
  }
  setAttribute(): void {}
  addEventListener(t: string, f: (e: unknown) => void): void {
    const a = this.ls.get(t) ?? []
    a.push(f)
    this.ls.set(t, a)
  }
  removeEventListener(t: string, f: (e: unknown) => void): void {
    const a = this.ls.get(t) ?? []
    const i = a.indexOf(f)
    if (i >= 0) a.splice(i, 1)
  }
  fire(t: string, e: unknown = {}): void {
    for (const f of [...(this.ls.get(t) ?? [])]) f(e)
  }
  /** 이 아래 어딘가에 이 클래스가 붙은 요소가 있는가. */
  find(cls: string): El | null {
    if (this.className === cls) return this
    for (const c of this.children) {
      const hit = c.find(cls)
      if (hit !== null) return hit
    }
    return null
  }
}

/** 세로/가로를 코드로 뒤집기 위한 matchMedia 스텁. */
let portrait = true
const mqls: Array<() => void> = []
const matchMedia = (q: string): unknown => ({
  media: q,
  get matches(): boolean {
    return q.includes('portrait') ? portrait : false
  },
  addEventListener: (_t: string, f: () => void): void => {
    mqls.push(f)
  },
  removeEventListener: (_t: string, f: () => void): void => {
    const i = mqls.indexOf(f)
    if (i >= 0) mqls.splice(i, 1)
  },
})
const turn = (toPortrait: boolean): void => {
  portrait = toPortrait
  for (const f of [...mqls]) f()
}

const win = new El('window')
const g = globalThis as unknown as Record<string, unknown>
g['document'] = { createElement: (t: string): El => new El(t) }
g['window'] = {
  innerWidth: 390,
  innerHeight: 844,
  matchMedia,
  addEventListener: (t: string, f: (e: unknown) => void): void => win.addEventListener(t, f),
  removeEventListener: (t: string, f: (e: unknown) => void): void => win.removeEventListener(t, f),
}

const { mountOpening } = await import('../src/ui/opening.ts')

let fails = 0
function check(ok: boolean, label: string, detail = ''): void {
  if (!ok) fails++
  console.log(`  ${ok ? 'ok ' : '✗  '} ${label.padEnd(40)} ${detail}`)
}

const panel = new El('div')
let openId = ''
const overlay = {
  panel: (): El => panel,
  show: (id: string): void => {
    openId = id
  },
  hide: (): void => {
    openId = ''
  },
}
let started = 0
const save = { bestRunStage: 0, runCount: 0 }
mountOpening(
  overlay as unknown as Parameters<typeof mountOpening>[0],
  save as unknown as Parameters<typeof mountOpening>[1],
  () => {
    started++
  },
)

console.log('\n1. 첫 화면 문구')
const wrap = panel.find('op-wrap')
check(wrap !== null && openId === 'opening', '오프닝이 열렸다', openId)
const html = wrap?.innerHTML ?? ''
check(html.includes('신궁') && html.includes('神弓'), '이름이 서 있다')
check(html.includes('마지막 한 발에, 시간이 멎는다'), '바뀐 첫 문구가 있다')
check(html.includes('한 판 30초'), '30초짜리 판이라고 말한다')
check(html.includes('아직 한 발도 쏘지 않았다'), '첫 여정 문구가 있다')
check(html.includes('언제 꺼도 손해 없다'), 'C2를 첫 화면에서 약속한다')

console.log('\n2. 가로 안내 (세로일 때만)')
const hint = (): El | null => (wrap === null ? null : wrap.find('op-turn'))
check(hint() !== null, '세로에서 안내가 뜬다')
check((hint()?.innerHTML ?? '').includes('op-phone'), '눕는 폰 그림이 들어 있다')
check((hint()?.innerHTML ?? '').includes('가로로'), '문구가 가로를 말한다')
turn(false)
check(hint() === null, '가로로 돌리면 그 자리에서 사라진다')
turn(true)
check(hint() !== null, '다시 세우면 돌아온다')

console.log('\n3. 시작 (C1 — 아무 데나 한 번)')
wrap?.fire('click')
check(started === 1 && openId === '', '누르면 정확히 한 번 시작한다', `started=${started}`)
check(mqls.length === 0, '시작하면 orientation 리스너를 뗀다', `남은 ${mqls.length}`)
check((win.ls.get('keydown') ?? []).length === 0, '시작하면 keydown도 뗀다')
wrap?.fire('click')
check(started === 1, '두 번 눌러도 한 번', `started=${started}`)

console.log(fails === 0 ? '\n전부 통과' : `\n${fails}건 어긋남`)
process.exit(fails === 0 ? 0 : 1)
