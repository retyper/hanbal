/**
 * 자세히 — **길게 누르면 뜨는 말풍선** (2026-09-11)
 *
 * 형: **"갑옷만 봐도 지금 갑옷하나만 고르는거 봐도 화면에 꽉차는데 이거 맞냐고?
 * 하스스톤은 작은 화면을 커버하기 위해 화면에 가장중요한 설명, 탭할때 바로뜨는 부가 설명과
 * 어쩔수없이 더 추가되어서 보여지는 조금더 오래누르고 있으면 뜨는 추가설명, 이런식으로
 * 커버하는데 우리도 그런것좀 해야해."**
 *
 * 맞는 지적이다. 그동안 카드 한 장이 **아는 것을 전부** 적고 있었다 — 이름·한자·장점·대가·
 * 수치·값까지 다섯 줄. 카드 셋이면 화면이 찬다. 정보를 지우는 게 답이 아니라 **층을 나누는**
 * 것이 답이고, 하스스톤이 하는 그대로 세 층이면 된다:
 *
 *   ① **겉면**       이름 + 숫자 하나. 고를지 말지는 이것으로 정한다.
 *   ② **누르면**     고른다. 그리고 그 아래 한 줄에 부가 설명이 **바로** 뜬다 (각 화면의 몫).
 *   ③ **길게 누르면** 이 파일 — 나머지 전부가 말풍선으로 뜬다. 유래·대가·수치·잠금 조건.
 *
 * ── 규칙 ──────────────────────────────────────────────────────────────
 * 1. **길게 눌러 연 뒤에는 그 누름이 '고르기'로 안 샌다.** 자세히 보려다 장비가 바뀌면
 *    그건 배신이다. 캡처 단계에서 그 한 번의 click 을 삼킨다.
 * 2. **말풍선은 클릭을 안 먹는다** (pointer-events: none). 화면 위에 뜨는 종이일 뿐이다.
 * 3. **화면 밖으로 안 나간다.** 위에 자리가 없으면 아래로 뒤집고, 좌우는 잘라 맞춘다.
 * 4. 데스크탑은 **올려두면** 뜬다 (hover). 마우스에 '길게 누르기'는 없는 동작이다.
 * 5. 매 프레임 도는 코드가 없다 (A5). 열고 닫을 때만 DOM 을 만진다.
 */

/** 말풍선 한 장에 들어가는 것. 없는 칸은 그냥 안 그린다. */
export interface Detail {
  title: string
  /** 한자·유래 같은 작은 부제. */
  sub?: string
  /** 본문 — 한 줄에 한 문장. 빈 문자열은 건너뛴다. */
  lines?: readonly string[]
  /** 수치 — [이름, 값]. 표로 선다. */
  stats?: readonly (readonly [string, string])[]
  /** 맨 아래 한 줄 — 값이나 잠금 조건. 강조색이다. */
  foot?: string
}

/** 손가락으로 눌러 이 시간을 넘기면 말풍선이 뜬다 (ms). */
const HOLD_MS = 400
/** 마우스를 올려두고 이 시간을 넘기면 뜬다 (ms). 누르는 것보다 조금 느긋하게. */
const HOVER_MS = 480
/** 이만큼(px) 손가락이 밀리면 그건 누른 게 아니라 스크롤이다. */
const SLOP = 12

let host: HTMLElement | null = null
let bubble: HTMLElement | null = null
/** 지금 열려 있게 만든 그 요소. 같은 것을 또 열라고 하면 아무 일도 안 한다. */
let openFor: HTMLElement | null = null
/** 방금 길게 눌러 열었다 — 뒤따라오는 click 한 번을 삼킨다. */
let swallow = false

/**
 * 말풍선이 살 곳을 정한다. 오버레이 뿌리(.hb-ui)에 **한 장만** 만든다 —
 * 카드마다 하나씩 만들면 그게 곧 DOM 수백 개다.
 *
 * 처음 attachDetail 이 불릴 때 저절로 선다. 각 화면이 따로 부르지 않아도 되고,
 * 헤드리스 프로브(DOM 스텁에 querySelector 가 없다)에서는 조용히 아무것도 안 한다 —
 * 말풍선이 없으면 열기가 그냥 지나간다.
 */
function ensureHost(): void {
  if (host !== null || bubble !== null) return
  const doc = globalThis.document as Document | undefined
  if (doc === undefined || typeof doc.querySelector !== 'function') return
  const root = doc.querySelector('.hb-ui') ?? doc.body
  if (root === null || root === undefined) return
  host = root as HTMLElement
  const el = doc.createElement('div')
  el.className = 'hb-detail'
  el.setAttribute('role', 'tooltip')
  host.appendChild(el)
  bubble = el
  // 어디든 새로 누르거나 굴리면 닫는다. 말풍선은 붙잡아두는 물건이 아니다.
  const bye = (): void => closeDetail()
  window.addEventListener('pointerdown', bye, true)
  window.addEventListener('scroll', bye, true)
  window.addEventListener('resize', bye)
  window.addEventListener('blur', bye)
}

/** 열려 있으면 닫는다. 닫혀 있으면 아무 일도 안 한다. */
export function closeDetail(): void {
  if (bubble === null || openFor === null) return
  bubble.classList.remove('hb-on')
  openFor = null
}

function render(d: Detail): string {
  let html = `<div class="hb-dt">${esc(d.title)}`
  if (d.sub !== undefined && d.sub !== '') html += `<span class="hb-ds">${esc(d.sub)}</span>`
  html += '</div>'
  for (const line of d.lines ?? []) {
    if (line === '') continue
    html += `<div class="hb-dl">${esc(line)}</div>`
  }
  if (d.stats !== undefined && d.stats.length > 0) {
    html += '<div class="hb-dg">'
    for (const [k, v] of d.stats) html += `<span>${esc(k)}</span><b>${esc(v)}</b>`
    html += '</div>'
  }
  if (d.foot !== undefined && d.foot !== '') html += `<div class="hb-df">${esc(d.foot)}</div>`
  return html
}

/** 이름·설명은 우리 데이터지만, 문자열을 HTML 로 넣는 자리에는 언제나 문을 건다. */
function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;'))
}

/** 말풍선을 이 요소 옆에 띄운다. 위가 좁으면 아래로 뒤집는다. */
function place(anchor: HTMLElement): void {
  if (bubble === null || typeof anchor.getBoundingClientRect !== 'function') return
  const r = anchor.getBoundingClientRect()
  const b = bubble.getBoundingClientRect()
  const M = 10
  const vw = window.innerWidth
  const vh = window.innerHeight
  // 세로 — 위가 넉넉하면 위, 아니면 아래.
  const above = r.top - b.height - 8
  const below = r.bottom + 8
  const top = above >= M ? above : Math.min(below, vh - b.height - M)
  // 가로 — 카드 가운데에 맞추고 화면 안으로 밀어 넣는다.
  let left = r.left + r.width / 2 - b.width / 2
  left = Math.max(M, Math.min(left, vw - b.width - M))
  bubble.style.left = `${Math.round(left)}px`
  bubble.style.top = `${Math.round(Math.max(M, top))}px`
}

/**
 * 이 요소에 '자세히'를 붙인다. `get` 은 **열 때마다** 불린다 —
 * 값이 바뀌는 카드(담금질 단수·값)라도 늘 지금 것이 뜬다.
 */
export function attachDetail(el: HTMLElement, get: () => Detail | null): void {
  let timer = 0
  let sx = 0
  let sy = 0

  const open = (): void => {
    ensureHost()
    if (bubble === null) return
    const d = get()
    if (d === null) return
    bubble.innerHTML = render(d)
    bubble.classList.add('hb-on')
    openFor = el
    // 내용을 넣은 **뒤에** 자리를 잡는다 — 크기를 알아야 화면 밖인지 판정할 수 있다.
    place(el)
  }

  const cancel = (): void => {
    if (timer !== 0) {
      window.clearTimeout(timer)
      timer = 0
    }
  }

  el.addEventListener('pointerdown', (e) => {
    cancel()
    sx = e.clientX
    sy = e.clientY
    timer = window.setTimeout(() => {
      timer = 0
      // 길게 눌러 열었다 — 이 누름은 '고르기'가 아니다 (아래 capture 리스너가 삼킨다).
      swallow = true
      open()
    }, HOLD_MS)
  })
  el.addEventListener('pointermove', (e) => {
    if (timer === 0) return
    if (Math.abs(e.clientX - sx) > SLOP || Math.abs(e.clientY - sy) > SLOP) cancel()
  })
  for (const t of ['pointerup', 'pointercancel', 'pointerleave'] as const) {
    el.addEventListener(t, cancel)
  }
  // ★ 길게 눌러 연 그 한 번의 click 을 **삼킨다.** capture 라 카드 자신의 처리보다 먼저 온다.
  el.addEventListener('click', (e) => {
    if (!swallow) return
    swallow = false
    e.stopPropagation()
    e.preventDefault()
  }, true)

  // 마우스 — 올려두면 뜬다. '길게 누르기'는 손가락의 말이다.
  el.addEventListener('mouseenter', () => {
    cancel()
    timer = window.setTimeout(() => {
      timer = 0
      open()
    }, HOVER_MS)
  })
  el.addEventListener('mouseleave', () => {
    cancel()
    if (openFor === el) closeDetail()
  })
  // 오른쪽 버튼 — 바로 연다. 데스크탑에서 기다리기 싫은 사람의 길.
  el.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    open()
  })
}
