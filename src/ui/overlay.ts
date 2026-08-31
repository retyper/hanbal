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
  /**
   * sticky 패널은 Esc·바깥 클릭·다른 패널로의 갈아타기로 닫히지 않는다.
   * 출정·보급·여정 종료는 콜백이 정확히 한 번 와야 게임이 진행되는 흐름 필수 모달이라,
   * 습관적 Esc 한 번에 닫히면 choosing=true인 채 게임이 굳었다 (감사 P0 — 소프트락).
   */
  show(id: string, opts?: { sticky?: boolean }): void
  /** force=true 는 sticky 패널도 닫는다 — 흐름을 끝낸 패널 자신만 쓴다. */
  hide(force?: boolean): void
  /** 패널이 열려 있는가. 게임 루프는 이게 true인 동안 sim을 멈춰도 된다. */
  visible(): boolean
  /** **이** 패널이 열려 있는가. 같은 버튼이 열기/닫기 토글일 때 쓴다. */
  showing(id: string): boolean
  /** 패널을 만들거나 이미 만든 걸 돌려준다. 여기에 내용을 채운다. */
  panel(id: string): HTMLElement
  /** 항상 보이는 층. 작은 버튼만 올린다. */
  hud(): HTMLElement
  /** 구석 알림. 확인 버튼 없음, 클릭 없이 사라진다. */
  toast(text: string, ms?: number): void
  /**
   * 이 글자들을 캔버스가 명조로 그릴 거라고 브라우저에 미리 알린다.
   *
   * 웹폰트는 **DOM에 그 글자가 나와야** 받아온다 — 캔버스의 ctx.font 는 아무것도 요청하지
   * 않는다. 판 이름·결과 한마디는 캔버스에만 있어서, 이걸 안 부르면 그 글자들만 영원히
   * 대역 글꼴로 그려진다. 받아오면 다음 프레임부터 저절로 바뀐다 (지연 로딩이라 안전하다).
   */
  warmFont(text: string): void
  /** dispose 때 같이 정리할 것 등록. */
  onDispose(fn: () => void): void
  dispose(): void
}

/** 토스트 기본 수명(ms). 읽고 지나갈 만큼만 — 붙잡아두지 않는다. */
const TOAST_MS = 3600
/** 화면에 동시에 쌓이는 토스트 수. 넘치면 오래된 것부터 지운다. */
const TOAST_MAX = 3

/**
 * 애셋 경로의 뿌리. GitHub Pages는 서브경로(/레포명/)로 붙으므로 '/ui/…' 로 쓰면 404다.
 * 빌드가 주입하는 BASE_URL만이 진실이다 (vite.config.ts의 PUBLIC_BASE).
 */
const BASE = import.meta.env.BASE_URL

/**
 * 화면의 디자인 언어. **여기가 유일한 출처다** — 각 패널의 CSS는 여기서 정한
 * 토큰(--ink, --line …)과 클래스(.hb-btn, .hb-sec)를 쓰기만 한다.
 *
 * ── 왜 다시 그렸나 (2026-08-31, 형) ────────────────────────────────────
 * **"모바일에서 세로로 잘 작동하게 UI 싹 정리해줘. 그리고 너무 새까매 전체적으로.
 *   버튼이나 박스, 팝업은 좀 스타일있게 다운받은 리소스 써야 하는거 아니냐?"**
 *
 * 셋 다 맞는 지적이었고, 셋을 한 번에 고쳤다.
 *
 * ① **세로 화면.** 폰에서 패널은 가운데 뜬 상자가 아니라 **아래에서 올라오는 시트**가
 *    되어야 한다 (엄지가 닿는 곳이 화면 아래다). 닫기 ✕ 를 만들었다 — 예전엔 Esc와
 *    바깥 클릭뿐이라 폰에서는 **닫는 방법이 사실상 없었다.** 누르는 것은 전부 44px 이상,
 *    아래·옆 여백은 env(safe-area-inset-*) 로 노치·홈바를 피한다.
 *
 * ② **검정을 걷어냈다.** 예전 패널은 #0f151d~#0a0f15 — 거의 순검정이었다.
 *    이제 바탕은 따뜻한 먹지(#2f2e29~#262521)다. 하늘(render/sky.ts)도 같은 날 함께
 *    올렸다. 대비 규칙은 그대로 지킨다: 가장 어두운 글자(--mute)도 패널 대비 7:1 이상.
 *
 * ③ **테두리는 진짜 그림이다.** Kenney 'Fantasy UI Borders'(CC0)의 井자 창살 문양을
 *    9-slice(border-image)로 두른다. 96x96 · 173바이트다. 흰 마스크의 팔레트를 금색으로
 *    바꿔 넣었으므로(tools/tint-frames.mjs) CSS filter도, 색 보정도 필요 없다.
 *    제목 글꼴은 명조(Gowun Batang) — public/fonts. 출처는 public/ui/출처.txt.
 *
 * 그래도 지키는 것: 한쪽만 두꺼운 테두리는 여전히 안 쓴다 ("AI 특유의 네모박스 한쪽을
 * 두껍게 만드는 그런 거 좀 제발 없애" — 형). 강조는 글자 크기·여백·문양이 만든다.
 */
const CSS = `
.hb-ui {
  position: fixed; inset: 0; z-index: 40; pointer-events: none;
  font: 15px/1.65 "Pretendard","Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif;
  color: #e2dbcd; -webkit-font-smoothing: antialiased;

  /* ★ 대비 규칙 (2026-08-24, 형의 반려: "회색 글씨 쳐 안 보여").
     가장 어두운 글자(--mute)도 패널 배경(#2a2a26) 대비 7:1 이상이어야 한다.
     위계는 밝기 차가 아니라 크기·굵기·자간으로 만든다 — 어둡게 눌러서 만들지 않는다.
     (아래 값들의 실측: ink 12.8 · body 10.0 · dim 8.5 · mute 7.6 · accent 8.1 · teal 8.5) */
  --ink: #f8f3e8;
  --body: #e2dbcd;
  --dim: #cfc7b6;
  --mute: #c3bbaa;
  --line: #47443c;
  --accent: #ffb347;
  --teal: #7fd6c8;
  --gold: #c9a468;

  /* 면 — 먹지 세 단계. 패널 > 카드 > 눌린 자리 순으로 어두워진다. */
  --paper: #2f2e29;
  --paper2: #262521;
  --card: #34332d;
  --card-hi: #3f3d35;
  --sunk: #232219;

  --num: "Bahnschrift","Barlow Condensed","DIN Alternate","Avenir Next Condensed","Malgun Gothic",system-ui,sans-serif;
  /** 큰 글자 전용 명조. render/hud.ts 의 FONT_SERIF 와 같은 스택이어야 한 화면으로 읽힌다. */
  --serif: "Gowun Batang","Apple SD Gothic Neo","Batang",serif;

  /* 노치·홈바. 지원 안 하는 브라우저에서는 0으로 떨어진다. */
  --safe-b: env(safe-area-inset-bottom, 0px);
  --safe-l: env(safe-area-inset-left, 0px);
  --safe-r: env(safe-area-inset-right, 0px);
  --safe-t: env(safe-area-inset-top, 0px);
}
.hb-ui * { box-sizing: border-box; }
.hb-ui b, .hb-ui .hb-num { font-family: var(--num); font-variant-numeric: tabular-nums; }

/* 왼쪽 아래 — 지면 밑이라 조준선이 지나가지 않는다. 버튼이 발사 클릭을 먹으면 C1 위반이다. */
/* 좁은 화면에서는 줄바꿈한다 — 안 하면 수집 버튼부터 화면 밖으로 잘린다 (겹침 9번). */
.hb-hud {
  position: absolute; display: flex; gap: 10px; align-items: flex-end; flex-wrap: wrap;
  left: calc(18px + var(--safe-l)); bottom: calc(18px + var(--safe-b));
  max-width: calc(100vw - 36px - var(--safe-l) - var(--safe-r));
}
.hb-hud > * { pointer-events: auto; }

.hb-btn {
  position: relative; display: inline-flex; align-items: center; gap: 9px;
  background: var(--card); color: var(--body); border: 1px solid var(--line); border-radius: 2px;
  padding: 11px 18px; font: inherit; font-weight: 600; cursor: pointer;
  transition: background .12s, color .12s, border-color .12s, box-shadow .12s;
}
/* hover는 배경 밝기만. 잉크 바도, 테두리 색도 건드리지 않는다. */
.hb-btn:hover { background: var(--card-hi); color: var(--ink); }
.hb-btn:focus-visible { outline: 2px solid var(--teal); outline-offset: 2px; }
.hb-btn[disabled] { opacity: .45; cursor: default; }
/* 눌림 — 클릭 촉감의 한 프레임 (감사: hover와 결과 사이가 비어 있었다). */
.hb-btn:active:not([disabled]) { background: var(--sunk); transform: translateY(1px); }
/* 화면당 딱 하나의 채운 주행동 버튼 — 출정·재출정의 그 버튼이다. */
.hb-btn.hb-pri { background: var(--accent); color: #241a06; border-color: var(--accent); font-weight: 700; }
.hb-btn.hb-pri:hover { background: #ffc46a; border-color: #ffc46a; color: #241a06; }
.hb-btn.hb-pri:active:not([disabled]) { background: #e69d33; }
.hb-btn[disabled]:hover { background: var(--card); color: var(--body); }
.hb-btn .hb-key {
  color: var(--mute); font-family: var(--num); font-size: 12px; letter-spacing: .06em;
  border: 1px solid var(--line); border-radius: 2px; padding: 1px 5px; line-height: 1.35;
}

/* 올릴 수 있다는 표시. 점 하나. 모달로 막지 않는다 (C1) */
.hb-dot {
  position: absolute; top: -4px; right: -4px; width: 8px; height: 8px; border-radius: 50%;
  background: var(--accent); box-shadow: 0 0 0 2px #14171d; opacity: 0; transition: opacity .2s;
}
.hb-btn.hb-has .hb-dot { opacity: 1; }

/* 우상단은 캔버스 HUD(훈련치·바람·무음)의 자리다 — 토스트가 그 위를 통째로 덮었었다
   (UI 전수조사 겹침 2번). 우하단은 어느 레이어도 안 쓰는 빈 구석이라 여기가 토스트의 집이다. */
.hb-toasts {
  position: absolute; right: calc(20px + var(--safe-r)); bottom: calc(20px + var(--safe-b));
  display: flex; flex-direction: column-reverse; gap: 8px; align-items: flex-end;
}
.hb-toast {
  background: #2f2e29f2; border: 1px solid var(--line);
  border-radius: 2px; padding: 10px 16px; color: var(--body); white-space: nowrap;
  box-shadow: 0 6px 22px #0008;
  animation: hb-in .26s ease-out both, hb-out .45s ease-in forwards;
}
.hb-toast .hb-plus { color: var(--accent); font-family: var(--num); font-weight: 700; }
@keyframes hb-in { from { opacity: 0; transform: translateY(-7px); } to { opacity: 1; transform: none; } }
@keyframes hb-out { to { opacity: 0; transform: translateY(-5px); } }

.hb-scrim {
  position: absolute; inset: 0; display: none; align-items: center; justify-content: center;
  background: #0e1116e6; pointer-events: auto; padding: 28px;
  -webkit-backdrop-filter: blur(3px); backdrop-filter: blur(3px);
}
.hb-scrim.hb-open { display: flex; }

/* 패널 = [바깥(문양 테두리·그림자)] + [안쪽(스크롤)]. 테두리는 스크롤과 함께 흐르면 안 된다. */
.hb-panel {
  position: relative; display: none; width: min(680px, 100%); max-height: 100%;
  background: linear-gradient(180deg, var(--paper) 0%, var(--paper2) 100%);
  border-radius: 3px;
  box-shadow: 0 26px 80px #000000cc;
}
.hb-panel.hb-open { display: flex; flex-direction: column; }
/* 종이결 — 아주 얕은 잡티 한 겹. 파일을 받지 않고 SVG 잡음으로 만든다(스케일 자유·수백 바이트).
   깔린 순서: 종이결(::after, 아래) → 내용 → 문양 테두리(::before, 위). */
.hb-panel::after {
  content: ""; position: absolute; inset: 0; z-index: 0; pointer-events: none;
  border-radius: 3px; opacity: .06;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='.35'/%3E%3C/svg%3E");
}
/* 문양 테두리 — Kenney Fantasy UI Borders (CC0). 96x96 마스크를 9-slice로 두른다. */
.hb-panel::before {
  content: ""; position: absolute; inset: 0; z-index: 3; pointer-events: none;
  border: 16px solid transparent;
  border-image: url(${BASE}ui/frame-panel.png) 32 / 16px stretch;
}
.hb-body {
  position: relative; z-index: 1; overflow-y: auto; overscroll-behavior: contain;
  /* flex 세로 칸에서 min-height:auto 는 내용보다 작아지지 않는다 — 0으로 풀어야 스크롤이 산다. */
  min-height: 0;
  padding: 26px 30px 22px; scrollbar-width: thin;
}
.hb-body:focus { outline: none; }

/* 닫기 — 스크림에 붙어 있어 **내용이 아무리 길어도 자리를 지킨다.**
   흐름 필수 모달(sticky)에서는 사라진다: 그건 고르기 전에는 못 닫는 화면이다. */
.hb-x {
  position: absolute; top: calc(14px + var(--safe-t)); right: calc(14px + var(--safe-r));
  width: 44px; height: 44px; display: none; align-items: center; justify-content: center;
  background: #2f2e29d9; color: var(--dim); border: 1px solid var(--line); border-radius: 2px;
  font: 20px/1 var(--num); cursor: pointer; padding: 0;
}
.hb-scrim.hb-open:not(.hb-sticky) .hb-x { display: flex; }
.hb-x:hover { background: var(--card-hi); color: var(--ink); }
.hb-x:focus-visible { outline: 2px solid var(--teal); outline-offset: 2px; }

/* 패널 안 공통 — 제목과 구역 이름. 각 패널이 자기 것으로 다시 정의하지 않는다. */
.hb-panel h2 {
  font-size: 26px; line-height: 1.25; margin: 0; color: var(--ink);
  font-family: var(--serif); font-weight: 700; letter-spacing: .01em;
}
.hb-lead { color: var(--dim); font-size: 14px; margin: 4px 0 20px; }
/* 구역 이름 + 그 뒤로 이어지는 괘선. 상자를 하나 더 만드는 대신 선 하나로 나눈다. */
.hb-sec {
  display: flex; align-items: center; gap: 12px;
  color: var(--dim); font-size: 12px; letter-spacing: .2em; margin: 24px 0 10px;
}
.hb-sec::after { content: ""; flex: 1; height: 1px; background: var(--line); }

/* 카드 — 고르는 것(활·보급·갈림길)의 틀. 같은 문양의 작은 판이다. */
.hb-card {
  position: relative; background: var(--card); border: 0; border-radius: 2px;
  padding: 14px 16px; cursor: pointer; font: inherit; color: var(--body); text-align: left;
  transition: background .12s;
}
.hb-card::before {
  content: ""; position: absolute; inset: 0; pointer-events: none;
  border: 11px solid transparent;
  border-image: url(${BASE}ui/frame-card.png) 32 / 11px stretch;
}
.hb-card:hover { background: var(--card-hi); }
.hb-card:focus-visible { outline: 2px solid var(--teal); outline-offset: 2px; }
.hb-card.hb-on { background: #2c3a37; }
.hb-card.hb-on::before { border-image-source: url(${BASE}ui/frame-card-on.png); }

@media (prefers-reduced-motion: reduce) {
  .hb-toast { animation: none; }
  .hb-btn { transition: none; }
}

/* ── 손가락으로 누르는 화면 ────────────────────────────────────────────
   44px는 애플·구글이 같이 말하는 최소 터치 크기다. 키 힌트(Tab·C)는 지운다 —
   키보드가 없는 기기에서 폭만 먹는 글자다. */
@media (pointer: coarse) {
  .hb-btn { min-height: 44px; padding: 11px 16px; }
  .hb-btn .hb-key { display: none; }
}

/* ── 세로 화면 (폰) ────────────────────────────────────────────────────
   패널이 가운데 뜬 상자에서 **아래에서 올라오는 시트**가 된다. 엄지가 닿는 곳이 아래고,
   위쪽 스크림을 눌러 닫을 수 있다. 캔버스 구도도 같은 기준으로 아래 띠를 비워 둔다
   (render/camera.ts VIEW.bandBottom). */
@media (max-width: 640px) {
  .hb-ui { font-size: 14px; }
  .hb-scrim { padding: 0; align-items: flex-end; }
  .hb-panel {
    width: 100%; max-height: 90dvh; border-radius: 10px 10px 0 0;
    box-shadow: 0 -14px 44px #000000cc;
  }
  .hb-panel::after { border-radius: 10px 10px 0 0; }
  .hb-panel::before { border-width: 13px; border-image-width: 13px; }
  /* 시트를 잡아 올리는 손잡이. 형태만으로 "여기가 시트의 위"라고 말한다. */
  .hb-grab {
    position: relative; z-index: 2; flex: none; height: 18px;
    display: flex; align-items: center; justify-content: center;
  }
  .hb-grab::before { content: ""; width: 42px; height: 4px; border-radius: 2px; background: var(--line); }
  .hb-body { padding: 6px 18px calc(20px + var(--safe-b)); }
  .hb-panel h2 { font-size: 22px; }
  /* ✕는 시트가 아니라 **화면**의 오른쪽 위에 둔다. 시트에 붙이면 시트 높이(내용에 따라
     변한다)에 자리가 묶여, 짧은 시트에서는 허공에 뜬다. 폰에서는 시트 위쪽 스크림을
     누르는 게 어차피 더 빠른 닫기라, ✕는 늘 같은 자리에 있는 두 번째 길이면 된다. */
  .hb-x { width: 40px; height: 40px; }
  /* 토스트는 HUD 버튼 줄 **위**로 올린다. 좁은 화면에서 버튼 줄이 두세 줄로 접히므로
     높이는 고정값으로 못 적는다 — 띄울 때마다 실제 높이를 재서 넣는다 (아래 toast()). */
  .hb-toasts { left: 12px; right: 12px; align-items: center; }
  .hb-toast { white-space: normal; text-align: center; }
}
/* 손잡이는 세로 시트에서만 보인다 (가로에서는 자리만 먹는 줄이다). */
.hb-grab { display: none; }
`

export function createOverlay(): Overlay {
  const root = document.createElement('div')
  root.className = 'hb-ui'

  // 글꼴은 **첫 페인트를 막지 않게** 여기서 붙인다 (C6: 0.3초 안에 첫 그림).
  // <head>에 두면 렌더 차단 스타일시트가 되고, 이 파일은 어차피 첫 프레임 뒤에 돈다.
  // 이미 붙어 있으면 두 번 붙이지 않는다 (dispose 후 재생성 대비).
  /** 아직 못 보낸 미리 받기 요청. 스타일시트가 붙기 전에 부르면 아무 일도 안 일어난다. */
  const warmQueue: string[] = []
  let fontsLinked = false
  const runWarm = (): void => {
    if (!fontsLinked || document.fonts === undefined) return
    for (let i = 0; i < warmQueue.length; i++) {
      const t = warmQueue[i]
      if (t !== undefined && t !== '') void document.fonts.load(`700 40px "Gowun Batang"`, t).catch(() => {})
    }
    warmQueue.length = 0
  }

  const existing = document.querySelector('link[data-hb-fonts]')
  if (existing === null) {
    const fonts = document.createElement('link')
    fonts.rel = 'stylesheet'
    fonts.href = `${BASE}fonts/fonts.css`
    fonts.setAttribute('data-hb-fonts', '1')
    // 못 받아도 게임은 그대로 돈다 — 대역 글꼴이 이미 다 그리고 있다.
    fonts.addEventListener('load', () => { fontsLinked = true; runWarm() })
    fonts.addEventListener('error', () => { warmQueue.length = 0 })
    document.head.appendChild(fonts)
  } else {
    fontsLinked = true
  }

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

  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'
  closeBtn.className = 'hb-x'
  closeBtn.textContent = '✕'
  closeBtn.setAttribute('aria-label', '닫기')
  scrim.appendChild(closeBtn)

  root.append(hudLayer, toastLayer, scrim)
  document.body.appendChild(root)

  /** id → [바깥(문양·그림자), 안쪽(스크롤·내용)] */
  const panels = new Map<string, { outer: HTMLElement; body: HTMLElement }>()
  const disposers: Array<() => void> = []
  const timers: number[] = []
  let openId = ''
  let stickyOpen = false

  const hide = (force = false): void => {
    if (openId === '') return
    // 흐름 필수 모달은 자기 자신(완료 콜백)만 닫을 수 있다 — Tab·C·탭 이탈로는 안 닫힌다.
    if (stickyOpen && !force) return
    stickyOpen = false
    const p = panels.get(openId)
    if (p !== undefined) p.outer.classList.remove('hb-open')
    scrim.classList.remove('hb-open', 'hb-sticky')
    openId = ''
  }

  const show = (id: string, opts?: { sticky?: boolean }): void => {
    const p = panels.get(id)
    if (p === undefined) return
    // 흐름 필수 모달 위로는 아무도 못 끼어든다 (성장 Tab·수집 C 포함).
    if (stickyOpen && openId !== id) return
    if (openId !== '' && openId !== id) hide()
    stickyOpen = opts?.sticky === true
    p.outer.classList.add('hb-open')
    scrim.classList.add('hb-open')
    scrim.classList.toggle('hb-sticky', stickyOpen)
    // 패널이 자기 이름을 body에 달아 두면(mountLoadout) 대화상자의 이름으로 올려 준다.
    const label = p.body.getAttribute('aria-label')
    if (label !== null) p.outer.setAttribute('aria-label', label)
    openId = id
    // 키보드로 들어온 사람이 바로 스크롤·탭 이동을 할 수 있게.
    p.body.focus()
    // 시트를 다시 열면 지난번 스크롤 위치가 남아 있다 — 늘 첫 줄부터 보여야 한다.
    p.body.scrollTop = 0
  }

  // 바깥(어두운 부분)을 누르면 닫힌다. 패널 안 클릭은 통과시키지 않는다.
  const onScrim = (e: MouseEvent): void => {
    if (e.target === scrim && !stickyOpen) hide()
  }
  scrim.addEventListener('mousedown', onScrim)
  closeBtn.addEventListener('click', () => hide())

  // Esc는 언제나 닫기다. 열려 있지 않으면 아무것도 하지 않는다 (판 일시정지는 loop의 몫).
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && openId !== '' && !stickyOpen) {
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
    showing: (id: string): boolean => openId === id,
    hud: (): HTMLElement => hudLayer,
    panel(id: string): HTMLElement {
      const found = panels.get(id)
      if (found !== undefined) return found.body
      const outer = document.createElement('div')
      outer.className = 'hb-panel'
      outer.setAttribute('role', 'dialog')
      outer.setAttribute('aria-modal', 'true')
      // 세로 시트의 손잡이. 가로에서는 display:none 이라 자리를 먹지 않는다.
      const grab = document.createElement('div')
      grab.className = 'hb-grab'
      const body = document.createElement('div')
      body.className = 'hb-body'
      body.tabIndex = -1
      outer.append(grab, body)
      scrim.appendChild(outer)
      panels.set(id, { outer, body })
      return body
    },
    toast(text: string, ms?: number): void {
      const life = ms !== undefined && ms > 0 ? ms : TOAST_MS
      // 좁은 화면에서는 토스트가 HUD 버튼 줄 바로 위에 선다. 버튼 줄은 화면 폭에 따라
      // 한 줄~세 줄로 접히므로 높이를 상수로 적을 수 없다 — 띄우는 순간 한 번 잰다.
      // (프레임마다 도는 코드가 아니다. A5 위반이 아님 — 값이 바뀌는 순간의 한 번이다.)
      if (window.innerWidth <= 640) {
        toastLayer.style.bottom = `calc(${hudLayer.offsetHeight + 28}px + var(--safe-b))`
      } else {
        toastLayer.style.bottom = ''
      }
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
    warmFont(text: string): void {
      warmQueue.push(text)
      runWarm()
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
