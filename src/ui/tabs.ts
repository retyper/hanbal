/**
 * 탭 — **판을 스크롤이 아니라 칸으로 나눈다** (2026-09-11)
 *
 * 형: **"능력치강화랑 대장간 이런거 이렇게 한 화면에 세로로 몰아넣는게 맞아? 게임들이
 * 이래서 게임 하겠냐?"** 그리고: **"세로롤링 너무 게임 안같고 뭔 웹페이지 같잖아."**
 *
 * 둘 다 같은 말이고, 맞는 말이다. 그동안 판은 **긴 문서**였다 — 능력치 아래 활 걸이,
 * 그 아래 대장간, 그 아래 설정. 다 보려면 굴려야 하고, 굴리는 화면은 게임이 아니라
 * 웹페이지다. 두 단으로 갈라 봤지만(추가 30) 그건 문서를 **두 줄로** 만든 것뿐이었다.
 *
 * 게임 메뉴는 굴리지 않는다. **화면이 딱 한 판이고, 위의 칸으로 갈아탄다.**
 * 한 칸에 들어갈 만큼만 한 칸에 넣는다 — 안 들어가면 칸을 늘리지 화면을 늘리지 않는다.
 *
 * ── 이 부품이 지키는 것 ──────────────────────────────────────────────
 * 1. **판의 높이는 화면이 정한다** (.hb-tall). 내용이 높이를 정하면 그게 곧 스크롤이다.
 * 2. **아래 줄은 늘 보인다** (foot). 출정 버튼이 굴려야 나오면 그건 게임이 아니다.
 * 3. 칸을 갈아타도 **아무것도 다시 만들지 않는다** — 만들어 두고 보이기만 바꾼다.
 *    (활 걸이의 자리, 고른 부적 같은 것이 칸을 옮겼다고 풀리면 안 된다.)
 * 4. 키보드로도 간다 — 좌우 키.
 */

export interface TabSpec {
  id: string
  label: string
  /** 칸 안쪽. 부르는 쪽이 채운다. */
  pane: HTMLElement
}

export interface Tabs {
  /** 판에 붙일 요소 (탭 줄 + 칸들). */
  el: HTMLElement
  /** 늘 보이는 아래 줄. 여기에 출정 버튼 같은 것을 넣는다. */
  foot: HTMLElement
  show(id: string): void
  current(): string
}

/**
 * 탭 줄 하나를 만든다. `panes` 의 순서가 곧 탭의 순서다.
 * `onShow` 는 칸이 실제로 보이게 된 뒤에 불린다 — 그때 크기를 재야 하는 것들(걸이·지도)이 있다.
 */
export function makeTabs(specs: readonly TabSpec[], onShow?: (id: string) => void): Tabs {
  const el = document.createElement('div')
  el.className = 'hb-screen'

  const bar = document.createElement('div')
  bar.className = 'hb-tabs'
  bar.setAttribute('role', 'tablist')

  const panes = document.createElement('div')
  panes.className = 'hb-panes'

  const foot = document.createElement('div')
  foot.className = 'hb-foot'

  const btns = new Map<string, HTMLButtonElement>()
  let cur = specs[0]?.id ?? ''
  /**
   * 처음 한 번은 onShow 를 안 부른다. 이 함수가 끝나기 전이라 부르는 쪽의 물건(걸이 같은 것)이
   * 아직 안 세워졌다 — 거기서 크기를 재려 들면 아직 없는 것을 만진다.
   */
  let ready = false

  const show = (id: string): void => {
    if (!btns.has(id)) return
    cur = id
    for (const [k, b] of btns) {
      const on = k === id
      b.classList.toggle('hb-tab-on', on)
      b.setAttribute('aria-selected', on ? 'true' : 'false')
      b.tabIndex = on ? 0 : -1
    }
    for (const sp of specs) sp.pane.classList.toggle('hb-on', sp.id === id)
    if (ready && onShow !== undefined) onShow(id)
  }

  for (const sp of specs) {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'hb-tab'
    b.textContent = sp.label
    b.setAttribute('role', 'tab')
    b.addEventListener('click', () => show(sp.id))
    bar.appendChild(b)
    btns.set(sp.id, b)
    sp.pane.classList.add('hb-pane')
    sp.pane.setAttribute('role', 'tabpanel')
    panes.appendChild(sp.pane)
  }

  bar.addEventListener('keydown', (e) => {
    const dir = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0
    if (dir === 0) return
    e.preventDefault()
    const i = specs.findIndex((sp) => sp.id === cur)
    const n = specs.length
    const nx = specs[((i + dir) % n + n) % n]
    if (nx !== undefined) {
      show(nx.id)
      btns.get(nx.id)?.focus()
    }
  })

  el.append(bar, panes, foot)
  show(cur)
  ready = true
  return { el, foot, show, current: (): string => cur }
}
