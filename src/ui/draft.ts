/**
 * 드래프트 화면 — 판을 시작하기 전 화살 한 장 (docs/HOOK.md ★1)
 *
 * 이 화면의 규칙은 하나다. **한 번의 입력으로 끝난다.**
 *   카드 클릭 1회 = 그 화살로 즉시 시작   ·   Esc 또는 [건너뛰기] 1회 = 기본 살로 즉시 시작
 * 확인 버튼도, 두 번째 화면도 없다. 제약 C1(탭 복귀 3초 안에 첫 발)이 이 화면의 상한이고,
 * 그걸 지키지 못하면 이 시스템은 재미가 아니라 관문이 된다.
 *
 * 다크 테마와 색은 ui/growth.ts와 같은 계열을 손으로 맞췄다 (overlay.ts의 hb-* 를 그대로 쓴다).
 * 아이콘은 인라인 SVG다 — 런타임 의존성도, 외부 파일도 늘리지 않는다 (A6·C6).
 */
import { arrowKind, DEFAULT_ARROW, type ArrowKindId } from '../game/arrows.ts'
import type { DraftOffer } from '../game/draft.ts'
import type { Overlay } from './overlay.ts'

const PANEL_ID = 'draft'

/** 카드에 붙는 단축키. DRAFT_SIZE와 같은 길이여야 한다. */
const KEYS = ['1', '2', '3'] as const

/**
 * 화면이 뜬 직후 이만큼(ms)은 바깥 클릭을 건너뛰기로 치지 않는다.
 *
 * 드래프트는 "한 번 더 누르면 다음 판"을 누른 그 pointerdown 다음 rAF 틱에 열린다 —
 * 리스너가 붙는 건 눌림 0~16ms 뒤인데 사람의 두 번째 클릭은 100~300ms 뒤에 온다.
 * 화면이 직접 연타를 유도하고 커서는 조준하던 쪽(=스크림 위)에 있으므로, 가드가 없으면
 * 카드 세 장이 한 프레임 번쩍하고 사라진 채 기본 살로 시작한다. 그 눌림은 건너뛰기 의사가
 * 아니라 판을 넘긴 클릭의 잔향이다 (loop.ts prevDrawing 소진과 같은 성격의 에지 방어).
 * mouseup(click)으로 옮기는 대신 시간으로 막는 이유: 판을 넘긴 그 눌림의 mouseup 자체가
 * 이 화면이 열린 뒤에 도착해서, click으로 들으면 되레 첫 손가락에 즉시 닫힌다.
 */
// TODO(params): ui.draftOutsideGuardMs — 손맛 노브가 되면 params.ts로 옮긴다
const OUTSIDE_GUARD_MS = 250

/**
 * 종류별 강조색. 카드를 **글자를 읽기 전에** 구분하게 하는 장치라 손맛 노브가 아니다 —
 * params.ts에 올리지 않는다 (A2는 "손맛에 관여하는 숫자"의 규칙이다).
 */
const TINT: Record<ArrowKindId, string> = {
  basic: '#b9c3cf',
  pierce: '#8fd3ff',
  burst: '#ffb347',
  split: '#c9a0ff',
  homing: '#7fd1c0',
  chain: '#9be08f',
  heavy: '#e0876a',
}

/**
 * 아이콘 대용 도형. 그림이 아니라 **효과의 그림풀이**다 —
 * 관통은 과녁 두 개를 꿴 선, 폭발은 터지는 방사선, 사슬은 점 셋을 잇는 꺾인 선.
 * 이름을 못 읽어도 무슨 일이 일어나는지 짐작되면 성공이다.
 */
const ICON: Record<ArrowKindId, string> = {
  basic: '<path d="M4 14h16"/><path d="M15 9l5 5-5 5"/>',
  pierce: '<path d="M3 14h22"/><circle cx="11" cy="14" r="4"/><circle cx="20" cy="14" r="4"/>',
  burst:
    '<circle cx="14" cy="14" r="3.2"/><path d="M20 14h4M17 19.2l2 2.5M11 19.2l-2 2.5M8 14H4M11 8.8L9 6.3M17 8.8l2-2.5"/>',
  split: '<path d="M3 14h11"/><path d="M14 14l9-6"/><path d="M14 14l9 6"/><circle cx="14" cy="14" r="1.6"/>',
  homing: '<path d="M3 21c8 0 12-3 15-9"/><circle cx="21" cy="8" r="2.6"/>',
  chain:
    '<path d="M3 19l6-5 6 6 6-8"/><circle cx="9" cy="14" r="2"/><circle cx="15" cy="20" r="2"/><circle cx="21" cy="12" r="2"/>',
  heavy: '<path d="M4 14h13"/><path d="M12 9l5 5-5 5"/><rect x="19" y="9" width="6" height="10" rx="1.5"/>',
}

const CSS = `
.d-h { display: flex; align-items: baseline; gap: 14px; }

/* 좁은 화면에서는 알아서 아래로 접힌다. 가로 스크롤은 만들지 않는다. */
.d-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(178px, 1fr)); gap: 12px; }

.d-card {
  display: flex; flex-direction: column; align-items: flex-start; gap: 10px;
  padding: 20px 18px 18px; text-align: left; min-height: 190px;
  border-color: #212b36; background: #101720e6; border-radius: 2px;
}
/* hover는 배경만 밝힌다. 카드의 성격은 아이콘 색(--tint)이 이미 말하고 있다. */
.d-card:hover, .d-card:focus-visible { background: #1e2934; border-color: #303c49; }
.d-card .d-ic { color: var(--tint); line-height: 0; }
.d-card .d-name { color: var(--ink); font-weight: 700; font-size: 18px; letter-spacing: -.01em; }
.d-card .d-desc { color: var(--body); font-size: 14px; line-height: 1.55; flex: 1; }
.d-card .d-k {
  position: absolute; top: 12px; right: 12px; color: var(--mute); font-size: 12px;
  font-family: var(--num); border: 1px solid var(--line); border-radius: 2px; padding: 1px 6px;
}

.d-foot {
  border-top: 1px solid var(--line); margin-top: 20px; padding-top: 16px;
  display: flex; align-items: center; gap: 14px;
}
.d-note { color: var(--mute); font-size: 13px; flex: 1; text-align: right; }
`

/**
 * 카드 3장을 띄우고, 고른 화살 하나를 돌려준다. **onPick은 정확히 한 번 불린다.**
 *
 * 고를 게 없으면(해금 0개) 화면을 만들지 않고 기본 살로 즉시 콜백한다 — 아무것도 못 고르는
 * 패널을 한 번 닫게 만드는 건 C1을 갉아먹는 짓이다. 호출자는 이 경우를 따로 챙기지 않아도 된다.
 *
 * 패널이 열려 있는 동안 game/loop.ts는 `ui.paused()`(= overlay.visible())로 sim을 세운다.
 * 그래서 이 화면이 떠 있는 동안 스태미나가 새거나 판이 끝나는 일은 없다.
 */
export function mountDraft(o: Overlay, offer: DraftOffer, onPick: (id: ArrowKindId) => void): void {
  if (offer.kinds.length === 0) {
    onPick(DEFAULT_ARROW)
    return
  }

  const panel = o.panel(PANEL_ID)
  // 판마다 다시 그린다. 지난 판의 카드가 남아 있으면 안 고른 화살로 시작하게 된다.
  panel.replaceChildren()
  panel.setAttribute('aria-label', '화살 고르기')

  const style = document.createElement('style')
  style.textContent = CSS
  panel.appendChild(style)

  const head = document.createElement('div')
  head.className = 'd-h'
  head.innerHTML = '<h2>화살 고르기</h2>'

  const sub = document.createElement('p')
  sub.className = 'hb-lead'
  sub.textContent = '이 판에서만 쓴다. 고르는 즉시 시작한다.'

  panel.append(head, sub)

  let done = false
  /** 이 화면이 마지막으로 뜬 시각. 바로 뒤에 도착하는 잔향 클릭을 가려낸다. */
  let bornAt = performance.now()
  /** 어떤 경로로 들어와도 여기 한 곳에서 끝난다 — 리스너를 못 떼면 다음 판의 1키가 두 번 먹는다. */
  const finish = (id: ArrowKindId): void => {
    if (done) return
    done = true
    window.removeEventListener('keydown', onKey, true)
    window.removeEventListener('mousedown', onOutside, true)
    document.removeEventListener('visibilitychange', onVisibility, true)
    o.hide()
    onPick(id)
  }

  const cards = document.createElement('div')
  cards.className = 'd-cards'
  const picks: ArrowKindId[] = []

  for (let i = 0; i < offer.kinds.length; i++) {
    const id = offer.kinds[i]
    if (id === undefined) continue
    const kind = arrowKind(id)
    const key = KEYS[picks.length]
    picks.push(id)

    const card = document.createElement('button')
    card.type = 'button'
    card.className = 'hb-btn d-card'
    card.style.setProperty('--tint', TINT[id])
    card.innerHTML =
      `<span class="d-ic"><svg width="34" height="34" viewBox="0 0 28 28" fill="none" ` +
      `stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" ` +
      `aria-hidden="true">${ICON[id]}</svg></span>` +
      `<span class="d-name"></span><span class="d-desc"></span>` +
      (key === undefined ? '' : `<span class="d-k">${key}</span>`)
    ;(card.querySelector('.d-name') as HTMLElement).textContent = kind.name
    ;(card.querySelector('.d-desc') as HTMLElement).textContent = kind.desc
    card.setAttribute('aria-label', `${kind.name} — ${kind.desc}`)
    card.addEventListener('click', () => finish(id))
    cards.appendChild(card)
  }
  panel.appendChild(cards)

  const foot = document.createElement('div')
  foot.className = 'd-foot'
  const skip = document.createElement('button')
  skip.type = 'button'
  skip.className = 'hb-btn'
  skip.innerHTML = '건너뛰기 <span class="hb-key">Esc</span>'
  skip.addEventListener('click', () => finish(DEFAULT_ARROW))
  const note = document.createElement('div')
  note.className = 'd-note'
  note.textContent = '건너뛰면 기본 살로 바로 시작한다'
  foot.append(skip, note)
  panel.appendChild(foot)

  /**
   * 캡처 단계로 듣는다. 이유가 셋이다.
   *  - Esc: overlay가 먼저 hide()만 하고 끝내면 아무도 고르지 않은 채 화면만 사라져 판이 멈춘다.
   *  - Tab: growth 화면이 이 위로 열리면 드래프트가 미아가 된다. 여기서 막는다.
   *  - 1/2/3: 다른 리스너가 먼저 먹지 않게.
   */
  const onKey = (e: KeyboardEvent): void => {
    if (done || e.altKey || e.ctrlKey || e.metaKey) return
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      finish(DEFAULT_ARROW)
      return
    }
    if (e.key === 'Tab') {
      // 카드 사이의 Tab 이동은 브라우저 것이다. 성장 화면만 못 열게 막는다.
      e.stopPropagation()
      return
    }
    const i = KEYS.indexOf(e.key as (typeof KEYS)[number])
    if (i < 0) return
    const id = picks[i]
    if (id === undefined) return
    e.preventDefault()
    e.stopPropagation()
    finish(id)
  }

  /**
   * 패널 바깥(어두운 부분) 클릭. overlay는 이걸 그냥 hide()로 처리하는데,
   * 그러면 아무도 안 고른 채 화면이 사라져 판이 시작되지 않는다. 건너뛴 것으로 친다 —
   * 어차피 한 번의 입력으로 판이 시작된다는 규칙은 지켜진다.
   */
  const onOutside = (e: MouseEvent): void => {
    if (done) return
    const t = e.target
    if (t instanceof Node && panel.contains(t)) return
    // 방금 뜬 화면을 지우는 눌림은 판을 넘긴 그 클릭의 잔향이다 (OUTSIDE_GUARD_MS 주석).
    // 여기서 전파까지 끊어야 한다 — overlay의 스크림 리스너가 뒤이어 hide()를 부르면
    // 아무도 안 고른 채 화면만 사라져 loop가 choosing에 갇힌다.
    if (performance.now() - bornAt < OUTSIDE_GUARD_MS) {
      e.preventDefault()
      e.stopPropagation()
      return
    }
    finish(DEFAULT_ARROW)
  }

  /**
   * 탭 복귀 방어 — 이 화면은 자기 생명주기를 스스로 지킨다.
   *
   * main.ts는 자리를 뜰 때 열린 패널을 일괄로 닫는다(복귀 첫 발까지 2클릭, C1). 그런데
   * 드래프트만은 닫혀도 finish()가 안 불려 "아직 아무도 안 골랐다"가 남고, loop는
   * choosing=true에 갇혀 판 넘김도 R도 안 먹는다 — 공부하다 나가는 게 대표 사용법인
   * 이 게임에서 가장 자주 밟히는 경로다. 그래서 돌아오면 고르던 세 장을 그 자리에 다시 띄운다.
   * done은 그대로 false이므로 'onPick은 정확히 한 번'(LoopUi 계약)은 유지된다.
   */
  const onVisibility = (): void => {
    if (done || document.hidden) return
    // 창을 다시 활성화한 그 클릭이 페이지까지 들어와 화면을 지우지 않도록 가드를 다시 연다.
    bornAt = performance.now()
    o.show(PANEL_ID)
    focusFirst()
  }

  /** 첫 카드에 초점. 키보드로 들어온 사람이 Enter 한 번으로 끝낼 수 있게 (C5의 반대편). */
  const focusFirst = (): void => {
    const first = cards.firstElementChild
    if (first instanceof HTMLElement) first.focus()
  }

  window.addEventListener('keydown', onKey, true)
  window.addEventListener('mousedown', onOutside, true)
  document.addEventListener('visibilitychange', onVisibility, true)

  o.show(PANEL_ID)
  bornAt = performance.now()
  focusFirst()
}
