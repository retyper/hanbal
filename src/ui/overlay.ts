/**
 * DOM 오버레이 레이어
 *
 * 캔버스 위에 얹는 얇은 DOM 판. **게임 렌더 루프와 완전히 분리돼 있다** —
 * 여기 있는 어떤 코드도 매 프레임 돌지 않는다. 값이 바뀌는 순간에만 DOM을 만진다 (A5).
 *
 * 구조는 셋뿐이다.
 *   hud()   : 항상 떠 있는 작은 것들(성장 버튼). 게임을 멈추지 않는다.
 *   toast() : 구석에서 몇 초 떴다 사라지는 알림. **누를 게 없다.** 복귀 화면이 이걸 쓴다 (C1·C4).
 *   panel() : 화면을 덮는 패널. 열려 있는 동안은 게임을 멈춰도 된다 — visible()로 알린다.
 *
 * 라이브러리는 쓰지 않는다 (A6). 색은 render/camera.ts THEME과 같은 계열을 손으로 맞췄다.
 * render를 import하지 않는 이유는 ui와 render가 서로를 모르는 같은 층이기 때문이다.
 */

export interface Overlay {
  root: HTMLElement
  /** 등록된 패널을 연다. 모르는 id면 아무 일도 일어나지 않는다. */
  show(id: string): void
  hide(): void
  /** 패널이 열려 있는가. 게임 루프는 이게 true인 동안 sim을 멈춰도 된다. */
  visible(): boolean
  /** 패널을 만들거나 이미 만든 걸 돌려준다. 여기에 내용을 채운다. */
  panel(id: string): HTMLElement
  /** 항상 보이는 층. 작은 버튼만 올린다. */
  hud(): HTMLElement
  /** 구석 알림. 확인 버튼 없음, 클릭 없이 사라진다. */
  toast(text: string, ms?: number): void
  /** dispose 때 같이 정리할 것 등록. */
  onDispose(fn: () => void): void
  dispose(): void
}

/** 토스트 기본 수명(ms). 읽고 지나갈 만큼만 — 붙잡아두지 않는다. */
const TOAST_MS = 3600
/** 화면에 동시에 쌓이는 토스트 수. 넘치면 오래된 것부터 지운다. */
const TOAST_MAX = 3

/**
 * 화면의 디자인 언어. **여기가 유일한 출처다** — 각 패널의 CSS는 여기서 정한
 * 토큰(--ink, --line …)과 클래스(.hb-btn, .hb-sec)를 쓰기만 한다.
 *
 * ── 왜 다시 그렸나 ──────────────────────────────────────────────────────
 * 형의 반려: **"UI도 너무 AI가 만든 티 내지 말고 크기도 더 키워."**
 * 맞는 말이었다. 예전 화면은 13px 본문 · 모든 모서리 6px 라운드 · 어디나 같은 굵기의 테두리 ·
 * system-ui 하나 — 어떤 앱에 붙여놔도 티가 안 나는, 그래서 아무 성격도 없는 화면이었다.
 *
 * 바꾼 것은 넷이다:
 *   1. **크기.** 본문 13 → 15px, 패널 520 → 680px, 버튼 패딩 7/12 → 11/18px.
 *   2. **모서리를 죽였다.** 6px 라운드 → 2~3px. 둥근 카드가 겹치면 그게 '기본 테마' 얼굴이다.
 *   3. **한쪽만 두꺼운 테두리를 쓰지 않는다.** 처음엔 패널 위에 3px 강조 띠를,
 *      버튼 hover에 왼쪽 잉크 바를 넣었다가 형에게 반려당했다 —
 *      "AI 특유의 네모박스 한쪽을 두껍게 만드는 그런 거 좀 제발 없애."
 *      맞는 말이다. 그건 성격이 아니라 **성격이 있는 척하는 장식**이고, 요즘 생성된 화면이
 *      다 그러고 있다. 이제 강조는 오직 **글자와 여백**이 만든다: 제목은 크고, 본문은 조용하고,
 *      구역은 얇은 괘선 하나로 나뉜다. hover는 배경 밝기만 바뀐다.
 *   4. **글꼴에 역할을 준다.** 글자와 숫자의 스택을 나눈다 (render/hud.ts와 같은 규칙).
 *      render를 import하지 않는 이유는 ui와 render가 서로를 모르는 같은 층이기 때문이다.
 */
const CSS = `
.hb-ui {
  position: fixed; inset: 0; z-index: 40; pointer-events: none;
  font: 15px/1.65 "Pretendard","Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif;
  color: #b9c3cf; -webkit-font-smoothing: antialiased;

  --ink: #eaf0f7;
  --body: #b3bdc9;
  --dim: #6b7888;
  --mute: #3f4a59;
  --line: #232d39;
  --accent: #ffb347;
  --teal: #7fd1c0;
  --num: "Bahnschrift","DIN Alternate","Avenir Next Condensed","Malgun Gothic",system-ui,sans-serif;
}
.hb-ui * { box-sizing: border-box; }
.hb-ui b, .hb-ui .hb-num { font-family: var(--num); font-variant-numeric: tabular-nums; }

/* 왼쪽 아래 — 지면 밑이라 조준선이 지나가지 않는다. 버튼이 발사 클릭을 먹으면 C1 위반이다. */
.hb-hud { position: absolute; left: 18px; bottom: 18px; display: flex; gap: 10px; align-items: flex-end; }
.hb-hud > * { pointer-events: auto; }

.hb-btn {
  position: relative; display: inline-flex; align-items: center; gap: 9px;
  background: #121a23e6; color: var(--body); border: 1px solid #26313d; border-radius: 2px;
  padding: 11px 18px; font: inherit; font-weight: 600; cursor: pointer;
  transition: background .12s, color .12s, border-color .12s, box-shadow .12s;
}
/* hover는 배경 밝기만. 잉크 바도, 테두리 색도 건드리지 않는다. */
.hb-btn:hover { background: #1e2833; color: var(--ink); }
.hb-btn:focus-visible { outline: 2px solid var(--teal); outline-offset: 2px; }
.hb-btn[disabled] { opacity: .4; cursor: default; }
.hb-btn[disabled]:hover { background: #121a23e6; color: var(--body); }
.hb-btn .hb-key {
  color: var(--mute); font-family: var(--num); font-size: 12px; letter-spacing: .06em;
  border: 1px solid #26313d; border-radius: 2px; padding: 1px 5px; line-height: 1.35;
}

/* 올릴 수 있다는 표시. 점 하나. 모달로 막지 않는다 (C1) */
.hb-dot {
  position: absolute; top: -4px; right: -4px; width: 8px; height: 8px; border-radius: 50%;
  background: var(--accent); box-shadow: 0 0 0 2px #0b0e13; opacity: 0; transition: opacity .2s;
}
.hb-btn.hb-has .hb-dot { opacity: 1; }

.hb-toasts { position: absolute; top: 20px; right: 20px; display: flex; flex-direction: column; gap: 8px; align-items: flex-end; }
.hb-toast {
  background: #101821f2; border: 1px solid #26313d;
  border-radius: 2px; padding: 10px 16px; color: #d7dde6; white-space: nowrap;
  animation: hb-in .26s ease-out both, hb-out .45s ease-in forwards;
}
.hb-toast .hb-plus { color: var(--accent); font-family: var(--num); font-weight: 700; }
@keyframes hb-in { from { opacity: 0; transform: translateY(-7px); } to { opacity: 1; transform: none; } }
@keyframes hb-out { to { opacity: 0; transform: translateY(-5px); } }

.hb-scrim {
  position: absolute; inset: 0; display: none; align-items: center; justify-content: center;
  background: #04070ae0; backdrop-filter: blur(3px); pointer-events: auto; padding: 28px;
}
.hb-scrim.hb-open { display: flex; }
.hb-panel {
  display: none; width: min(680px, 100%); max-height: 100%; overflow-y: auto;
  background: linear-gradient(180deg, #0f151d 0%, #0a0f15 100%);
  border: 1px solid #26313d;
  border-radius: 3px; padding: 26px 30px 22px;
  box-shadow: 0 26px 80px #000000cc; scrollbar-width: thin;
}
.hb-panel.hb-open { display: block; }
.hb-panel:focus { outline: none; }

/* 패널 안 공통 — 제목과 구역 이름. 각 패널이 자기 것으로 다시 정의하지 않는다. */
.hb-panel h2 {
  font-size: 24px; line-height: 1.25; margin: 0; color: var(--ink);
  font-weight: 700; letter-spacing: -.01em;
}
.hb-lead { color: var(--dim); font-size: 14px; margin: 4px 0 20px; }
/* 구역 이름 + 그 뒤로 이어지는 괘선. 상자를 하나 더 만드는 대신 선 하나로 나눈다. */
.hb-sec {
  display: flex; align-items: center; gap: 12px;
  color: var(--dim); font-size: 12px; letter-spacing: .2em; margin: 24px 0 10px;
}
.hb-sec::after { content: ""; flex: 1; height: 1px; background: var(--line); }

@media (prefers-reduced-motion: reduce) {
  .hb-toast { animation: none; }
  .hb-btn { transition: none; }
}
@media (max-width: 560px) {
  .hb-ui { font-size: 14px; }
  .hb-panel { padding: 20px 18px 18px; }
  .hb-panel h2 { font-size: 20px; }
}
`

export function createOverlay(): Overlay {
  const root = document.createElement('div')
  root.className = 'hb-ui'

  const style = document.createElement('style')
  style.textContent = CSS
  root.appendChild(style)

  const hudLayer = document.createElement('div')
  hudLayer.className = 'hb-hud'

  const toastLayer = document.createElement('div')
  toastLayer.className = 'hb-toasts'
  // 알림은 읽는 것이지 조작하는 게 아니다. 화살을 쏘는 클릭을 절대 가로채면 안 된다 (C1).
  toastLayer.setAttribute('aria-live', 'polite')

  const scrim = document.createElement('div')
  scrim.className = 'hb-scrim'

  root.append(hudLayer, toastLayer, scrim)
  document.body.appendChild(root)

  const panels = new Map<string, HTMLElement>()
  const disposers: Array<() => void> = []
  const timers: number[] = []
  let openId = ''

  const hide = (): void => {
    if (openId === '') return
    const el = panels.get(openId)
    if (el !== undefined) el.classList.remove('hb-open')
    scrim.classList.remove('hb-open')
    openId = ''
  }

  const show = (id: string): void => {
    const el = panels.get(id)
    if (el === undefined) return
    if (openId !== '' && openId !== id) hide()
    el.classList.add('hb-open')
    scrim.classList.add('hb-open')
    openId = id
    // 키보드로 들어온 사람이 바로 스크롤·탭 이동을 할 수 있게.
    el.focus()
  }

  // 바깥(어두운 부분)을 누르면 닫힌다. 패널 안 클릭은 통과시키지 않는다.
  const onScrim = (e: MouseEvent): void => {
    if (e.target === scrim) hide()
  }
  scrim.addEventListener('mousedown', onScrim)

  // Esc는 언제나 닫기다. 열려 있지 않으면 아무것도 하지 않는다 (판 일시정지는 loop의 몫).
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && openId !== '') {
      e.preventDefault()
      hide()
    }
  }
  window.addEventListener('keydown', onKey)

  return {
    root,
    show,
    hide,
    visible: (): boolean => openId !== '',
    hud: (): HTMLElement => hudLayer,
    panel(id: string): HTMLElement {
      const found = panels.get(id)
      if (found !== undefined) return found
      const el = document.createElement('div')
      el.className = 'hb-panel'
      el.tabIndex = -1
      el.setAttribute('role', 'dialog')
      el.setAttribute('aria-modal', 'true')
      scrim.appendChild(el)
      panels.set(id, el)
      return el
    },
    toast(text: string, ms?: number): void {
      const life = ms !== undefined && ms > 0 ? ms : TOAST_MS
      const el = document.createElement('div')
      el.className = 'hb-toast'
      el.textContent = text
      // 사라지는 애니메이션은 CSS가 수명 뒤에 시작한다. rAF를 쓰지 않는 이유는
      // 숨은 탭에서 rAF가 아예 안 돌기 때문 — 복귀 순간 뜨는 토스트가 굳어버린다.
      el.style.animationDelay = `0s, ${life}ms`
      toastLayer.appendChild(el)
      while (toastLayer.childElementCount > TOAST_MAX) {
        toastLayer.firstElementChild?.remove()
      }
      const t = window.setTimeout(() => {
        el.remove()
        const i = timers.indexOf(t)
        if (i >= 0) timers.splice(i, 1)
      }, life + 500)
      timers.push(t)
    },
    onDispose(fn: () => void): void {
      disposers.push(fn)
    },
    dispose(): void {
      for (let i = 0; i < timers.length; i++) {
        const t = timers[i]
        if (t !== undefined) window.clearTimeout(t)
      }
      timers.length = 0
      for (let i = 0; i < disposers.length; i++) disposers[i]?.()
      disposers.length = 0
      scrim.removeEventListener('mousedown', onScrim)
      window.removeEventListener('keydown', onKey)
      panels.clear()
      root.remove()
    },
  }
}
