/**
 * 수집·해금 화면 (docs/HOOK.md ★2 · ★4)
 *
 * 이 화면의 규칙은 성장 화면과 대칭이다.
 *   성장 화면 : 올리면 **몸이** 어떻게 달라지는지 문장으로 보여준다
 *   수집 화면 : 아직 **열지 못한 칸**을 보여준다
 *
 * 그래서 여기서 제일 중요한 건 열린 목록이 아니라 **잠긴 목록**이다.
 * 잠긴 칸은 이름을 가리되(???) 세 가지는 반드시 보여준다:
 *   ① 무엇의 자리인가 (화살/칭호)  ② 조건 문구  ③ **지금 몇 / 몇인가**
 * ③이 없으면 조건은 그냥 벽이다. 숫자가 12/20으로 차 있어야 다음 판을 켠다.
 *
 * 여는 데 클릭 1회(HUD 버튼 또는 C), 닫는 데 1회 (제약 C1).
 * 매 프레임 도는 코드는 이 파일에 하나도 없다 — 값이 바뀌는 순간에만 DOM을 만진다 (A5).
 */
import { STAGES } from '../game/stages.ts'
import {
  currentTitle,
  emptyProgress,
  ratio,
  UNLOCKS,
  type Progress,
  type UnlockDef,
} from '../game/unlocks.ts'
import { STAR_MAX } from '../game/rewards.ts'
import type { Overlay } from './overlay.ts'

const PANEL_ID = 'collection'

/** 잠긴 칸의 이름 자리. 실루엣이다 — 뭔지 모르는 채로 보이는 게 요점이다. */
const MASK = '？？？'

const KIND_TAG: Record<UnlockDef['kind'], string> = {
  arrow: '화살',
  title: '칭호',
}

const CSS = `
.c-h { display: flex; align-items: baseline; gap: 10px; margin: 0 0 2px; }
.c-h h2 { font-size: 15px; margin: 0; flex: 1; color: #eaf0f7; font-weight: 600; letter-spacing: .04em; }
.c-stars { color: #b9c3cf; font-variant-numeric: tabular-nums; }
.c-stars b { color: #ffb347; font-weight: 600; }
.c-title { color: #56657a; font-size: 12px; margin: 0 0 12px; }
.c-title b { color: #7fd1c0; font-weight: 600; }

.c-sec { color: #56657a; font-size: 11px; letter-spacing: .1em; margin: 14px 0 6px; }

/* ── 해금 목록 ── */
.c-row {
  display: grid; grid-template-columns: 1fr auto; align-items: baseline; gap: 2px 12px;
  padding: 9px 0; border-top: 1px solid #1a222c;
}
.c-name { color: #eaf0f7; font-weight: 600; }
.c-row.c-locked .c-name { color: #3f4a59; letter-spacing: .08em; }
.c-tag { color: #56657a; font-size: 11px; margin-left: 7px; }
.c-hint { grid-column: 1; color: #56657a; font-size: 12px; }
.c-row.c-open .c-hint { color: #46525f; }
.c-count { grid-column: 2; grid-row: 1; color: #b9c3cf; font-size: 12px; font-variant-numeric: tabular-nums; }
.c-row.c-open .c-count { color: #7fd1c0; }
.c-bar { grid-column: 1 / -1; height: 2px; background: #1a222c; border-radius: 1px; margin-top: 5px; overflow: hidden; }
.c-bar i { display: block; height: 100%; background: #ffb347; border-radius: 1px; }
.c-row.c-open .c-bar { visibility: hidden; }

/* ── 판별 별 ── */
.c-grid { display: grid; grid-template-columns: repeat(10, 1fr); gap: 4px; }
.c-cell {
  text-align: center; padding: 4px 0 3px; border-radius: 4px; background: #111820;
  border: 1px solid #1a222c; line-height: 1.25;
}
.c-cell .c-n { display: block; color: #46525f; font-size: 10px; font-variant-numeric: tabular-nums; }
.c-cell .c-s { display: block; color: #2f3947; font-size: 10px; letter-spacing: -.5px; }
.c-cell.c-done { border-color: #2a3441; }
.c-cell.c-done .c-n { color: #8b97a6; }
.c-cell.c-done .c-s { color: #ffb347; }
.c-cell.c-full { background: #1a2028; }

.c-foot { border-top: 1px solid #1a222c; margin-top: 12px; padding-top: 11px; color: #46525f; font-size: 12px; }
`

interface Row {
  def: UnlockDef
  el: HTMLElement
  name: HTMLElement
  hint: HTMLElement
  count: HTMLElement
  fill: HTMLElement
}

interface Cell {
  id: string
  el: HTMLElement
  stars: HTMLElement
}

type StarMap = Readonly<Record<string, number>>

const NO_STARS: StarMap = {}

// 화면 하나짜리 게임이라 마운트도 하나다. 여기 상태를 두면 loop가 update만 부르면 된다.
let cur: Progress = emptyProgress()
let curUnlocked: readonly string[] = []
let curStars: StarMap = NO_STARS
let refreshFn: (() => void) | null = null

/** 별 문자열. 채운 만큼 ★, 나머지 ☆. */
function starText(n: number): string {
  let s = ''
  for (let i = 0; i < STAR_MAX; i++) s += i < n ? '★' : '☆'
  return s
}

/**
 * 수집 화면을 오버레이에 붙인다.
 *
 * `p`·`unlocked`·`stars`는 **여는 순간 다시 읽는다**. 부르는 쪽이 같은 객체를 계속 갱신하든
 * 새로 만들어 `updateCollection`으로 넘기든 화면은 항상 최신을 그린다.
 */
export function mountCollection(
  o: Overlay,
  p: Progress,
  unlocked: readonly string[],
  stars?: StarMap,
): void {
  cur = p
  curUnlocked = unlocked
  curStars = stars ?? NO_STARS

  const panel = o.panel(PANEL_ID)

  const style = document.createElement('style')
  style.textContent = CSS
  panel.appendChild(style)

  const head = document.createElement('div')
  head.className = 'c-h'
  head.innerHTML = '<h2>수집</h2><div class="c-stars"><b></b></div>'
  const starOut = head.querySelector('b') as HTMLElement

  const title = document.createElement('p')
  title.className = 'c-title'

  panel.append(head, title)

  const secUnlock = document.createElement('div')
  secUnlock.className = 'c-sec'
  secUnlock.textContent = '해금'
  panel.appendChild(secUnlock)

  const rows: Row[] = []
  for (let i = 0; i < UNLOCKS.length; i++) {
    const d = UNLOCKS[i]
    if (d === undefined) continue
    const el = document.createElement('div')
    el.className = 'c-row'
    el.innerHTML = `
      <div><span class="c-name"></span><span class="c-tag"></span></div>
      <div class="c-count"></div>
      <div class="c-hint"></div>
      <div class="c-bar"><i></i></div>`
    ;(el.querySelector('.c-tag') as HTMLElement).textContent = KIND_TAG[d.kind]
    rows.push({
      def: d,
      el,
      name: el.querySelector('.c-name') as HTMLElement,
      hint: el.querySelector('.c-hint') as HTMLElement,
      count: el.querySelector('.c-count') as HTMLElement,
      fill: el.querySelector('.c-bar i') as HTMLElement,
    })
    panel.appendChild(el)
  }

  const secStage = document.createElement('div')
  secStage.className = 'c-sec'
  secStage.textContent = '판별 별'
  panel.appendChild(secStage)

  const grid = document.createElement('div')
  grid.className = 'c-grid'
  const cells: Cell[] = []
  for (let i = 0; i < STAGES.length; i++) {
    const s = STAGES[i]
    if (s === undefined) continue
    const el = document.createElement('div')
    el.className = 'c-cell'
    el.innerHTML = '<span class="c-n"></span><span class="c-s"></span>'
    ;(el.querySelector('.c-n') as HTMLElement).textContent = String(i + 1)
    el.title = s.id
    cells.push({ id: s.id, el, stars: el.querySelector('.c-s') as HTMLElement })
    grid.appendChild(el)
  }
  panel.appendChild(grid)

  const foot = document.createElement('div')
  foot.className = 'c-foot'
  // 조건을 갈아넣는 게임이 아니라는 걸 화면이 직접 말한다 (C3).
  foot.textContent = '조건은 판을 깨다 보면 지나간다. 따로 갈아넣을 것은 없다.'
  panel.appendChild(foot)

  // ── HUD 버튼 ──
  // 새로 열린 게 있으면 점 하나. 모달로 막지 않는다 (C1).
  let seen = curUnlocked.length

  const open = document.createElement('button')
  open.type = 'button'
  open.className = 'hb-btn'
  open.innerHTML = '수집 <span class="hb-key">C</span><span class="hb-dot"></span>'
  open.setAttribute('aria-label', '수집 화면 열기')

  // 다른 패널(성장)이 열려 있는 상태에서 눌렀으면 **닫는 게 아니라 갈아타는 것**이다.
  // o.visible() 하나만 보면 성장 화면을 켜둔 채 수집을 누른 사람이 아무 화면도 못 본다.
  const isOpen = (): boolean => o.visible() && panel.classList.contains('hb-open')

  const toggle = (): void => {
    if (isOpen()) {
      o.hide()
      return
    }
    seen = curUnlocked.length
    open.classList.remove('hb-has')
    refresh()
    o.show(PANEL_ID)
  }
  open.addEventListener('click', toggle)
  o.hud().appendChild(open)

  function refresh(): void {
    starOut.textContent = `★ ${cur.totalStars} / ${STAGES.length * STAR_MAX}`
    const t = currentTitle(curUnlocked)
    title.innerHTML = t === '' ? '아직 칭호가 없다' : `칭호 <b>${t}</b>`

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      if (row === undefined) continue
      const d = row.def
      const got = curUnlocked.includes(d.id)
      const at = d.at(cur)
      const shown = at < d.goal ? at : d.goal
      row.el.classList.toggle('c-open', got)
      row.el.classList.toggle('c-locked', !got)
      row.name.textContent = got ? d.label : MASK
      row.hint.textContent = d.hint
      row.count.textContent = got ? '열림' : `${Math.floor(shown)} / ${d.goal}`
      row.fill.style.width = `${Math.round(ratio(d, cur) * 100)}%`
    }

    for (let i = 0; i < cells.length; i++) {
      const c = cells[i]
      if (c === undefined) continue
      const n = curStars[c.id] ?? 0
      c.stars.textContent = starText(n)
      c.el.classList.toggle('c-done', n > 0)
      c.el.classList.toggle('c-full', n >= STAR_MAX)
    }

    open.classList.toggle('hb-has', curUnlocked.length > seen)
  }

  refreshFn = refresh

  const onKey = (e: KeyboardEvent): void => {
    if (e.key !== 'c' && e.key !== 'C') return
    if (e.altKey || e.ctrlKey || e.metaKey) return
    const el = e.target
    // 입력칸 안에서의 C는 그 사람 것이다.
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return
    e.preventDefault()
    toggle()
  }
  window.addEventListener('keydown', onKey)
  o.onDispose(() => {
    window.removeEventListener('keydown', onKey)
    refreshFn = null
  })

  refresh()
}

/**
 * 판이 끝났다 / 세이브가 바뀌었다. 화면이 열려 있지 않아도 불러도 된다 —
 * HUD 버튼의 점만 켜지고 DOM은 그때 한 번만 갱신된다.
 */
export function updateCollection(p: Progress, unlocked: readonly string[], stars?: StarMap): void {
  cur = p
  curUnlocked = unlocked
  if (stars !== undefined) curStars = stars
  refreshFn?.()
}

/**
 * 새로 열렸다. 구석에 잠깐 뜨고 사라진다 — 판 흐름을 끊는 확인 창은 만들지 않는다 (C1).
 * **무엇이 열렸는지 이름을 말해준다.** 여기서까지 가리면 딴 게임이 된다.
 */
export function showUnlocked(o: Overlay, ids: readonly string[]): void {
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]
    if (id === undefined) continue
    for (let j = 0; j < UNLOCKS.length; j++) {
      const d = UNLOCKS[j]
      if (d === undefined || d.id !== id) continue
      o.toast(`${KIND_TAG[d.kind]} 해금 · ${d.label}`)
      break
    }
  }
}
