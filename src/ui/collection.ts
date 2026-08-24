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
.c-h { display: flex; align-items: baseline; gap: 14px; }
.c-h h2 { flex: 1; }
.c-stars { color: var(--dim); font-size: 13px; letter-spacing: .12em; }
.c-stars b { color: var(--accent); font-weight: 700; font-size: 22px; margin-left: 8px; }
.c-title { color: var(--dim); font-size: 14px; margin: 4px 0 4px; }
.c-title b { color: var(--teal); font-weight: 700; font-family: inherit; }

/* ── 해금 목록 ── */
.c-row {
  display: grid; grid-template-columns: 1fr auto; align-items: baseline; gap: 3px 16px;
  padding: 13px 0; border-top: 1px solid var(--line);
}
.c-row:first-of-type { border-top: none; }
.c-name { color: var(--ink); font-weight: 700; font-size: 16px; }
/* 잠긴 칸은 흐리게 + 자간을 벌린다. 색만 죽이면 그냥 안 보이는 글자가 된다 (HOOK 2번). */
.c-row.c-locked .c-name { color: var(--mute); letter-spacing: .1em; font-weight: 600; }
.c-tag {
  color: var(--mute); font-size: 11px; margin-left: 10px; letter-spacing: .14em;
  border: 1px solid var(--line); border-radius: 2px; padding: 2px 6px;
}
.c-hint { grid-column: 1; color: var(--dim); font-size: 13px; }
.c-row.c-open .c-hint { color: var(--mute); }
.c-count { grid-column: 2; grid-row: 1; color: var(--body); font-size: 14px; }
.c-row.c-open .c-count { color: var(--teal); }
.c-bar { grid-column: 1 / -1; height: 3px; background: #161e27; margin-top: 8px; overflow: hidden; }
.c-bar i { display: block; height: 100%; background: var(--accent); }
.c-row.c-open .c-bar { visibility: hidden; }

/* ── 판별 별 ── 격자가 곧 진행도의 그림이다. 칸을 키워 한눈에 덩어리로 읽히게 한다. */
.c-grid { display: grid; grid-template-columns: repeat(10, 1fr); gap: 5px; }
.c-cell {
  text-align: center; padding: 7px 0 5px; border-radius: 2px; background: #0e151d;
  border: 1px solid #18202a; line-height: 1.3;
}
.c-cell .c-n { display: block; color: var(--mute); font-size: 12px; }
.c-cell .c-s { display: block; color: #2b3542; font-size: 12px; letter-spacing: -1px; }
.c-cell.c-done { border-color: #2c3846; background: #121a23; }
.c-cell.c-done .c-n { color: #93a0b0; }
.c-cell.c-done .c-s { color: var(--accent); }
/* 별 셋은 채운 칸으로. 격자를 훑을 때 무손실 판이 덩어리로 보인다. */
.c-cell.c-full { background: #1d2530; border-color: #3a4655; }

.c-foot { border-top: 1px solid var(--line); margin-top: 20px; padding-top: 16px; color: var(--mute); font-size: 13px; }
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
 * 별을 받은 판 중 가장 멀리 간 판 번호. 무한 구간에는 격자 칸이 없어서
 * (판이 끝없이 늘어나므로) **여기까지 왔다**를 알려줄 자리가 이 한 줄뿐이다.
 */
function furthestStage(stars: StarMap): number {
  let best = 0
  for (const id of Object.keys(stars)) {
    if ((stars[id] ?? 0) <= 0) continue
    const dash = id.indexOf('-')
    if (dash < 0) continue
    const ch = Number(id.slice(0, dash))
    const n = Number(id.slice(dash + 1))
    if (!Number.isFinite(ch) || !Number.isFinite(n)) continue
    const no = (ch - 1) * 10 + n
    if (no > best) best = no
  }
  return best
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
  head.innerHTML = '<h2>수집</h2><div class="c-stars">별<b></b></div>'
  const starOut = head.querySelector('b') as HTMLElement

  const title = document.createElement('p')
  title.className = 'c-title'

  panel.append(head, title)

  const secUnlock = document.createElement('div')
  secUnlock.className = 'hb-sec'
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
  secStage.className = 'hb-sec'
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
    // 캠페인 40판의 만점이 분모다. 무한 구간의 별은 여기 안 들어가므로(칸이 없다)
    // 만점을 넘긴 사람에게는 분모를 떼고 총합만 보여준다 — 아니면 "120 / 120"에서 멈춰 보인다.
    const campaignMax = STAGES.length * STAR_MAX
    starOut.textContent = cur.totalStars > campaignMax
      ? String(cur.totalStars)
      : `${cur.totalStars} / ${campaignMax}`

    const t = currentTitle(curUnlocked)
    const far = furthestStage(curStars)
    const reach = far > STAGES.length ? ` · 최고 ${far}판` : ''
    title.innerHTML = (t === '' ? '아직 칭호가 없다' : `칭호 <b>${t}</b>`) + reach

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
