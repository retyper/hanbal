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
  /**
   * 그 패널의 **바깥 상자**. 높이를 화면이 정하게 하려고 .hb-tall 을 붙이는 자리다
   * (2026-09-11, 형: "세로롤링 너무 게임 안같고 뭔 웹페이지 같잖아").
   * 내용을 채우는 쪽은 panel() 을 쓴다 — 이건 판 전체의 성격을 정할 때만.
   */
  panelBox(id: string): HTMLElement
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

  /* ── 판의 폭 (2026-09-11, 형: "게임화면은 넓게 쓰는데 UI 인터페이스가 너무 빈공간이
     많아서 한눈에 안들어와") ──────────────────────────────────────────────
     680px 한 단에 못 박혀 있었다. 1920 짜리 화면에서도 판은 680px 이고 나머지 1240px 은
     어두운 막이었다 — 그래서 내용이 **세로로만** 자라고, 성장 화면은 한 화면에 안 들어와
     끝까지 스크롤해야 했다. 이제 폭은 화면을 따라간다. 넓어진 만큼은 .hb-cols 가
     **두 단으로** 쓴다 (세로로 쓰면 넓어진 의미가 없다).
     글줄은 .hb-lead 에서 64자로 끊는다 — 넓다고 한 줄이 길어지면 그건 읽기가 더 나빠진다. */
  --pw: 680px;

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

/* ── 아이콘 ────────────────────────────────────────────────────────────
   game-icons.net(CC BY 3.0)에서 받은 SVG를 **마스크로** 쓴다 — 색은 글자색을 따라간다
   (background: currentColor). 그래서 잠긴 줄은 아이콘까지 같이 흐려지고, 강조된 줄은
   아이콘까지 같이 강조된다. 파일은 색을 모른다. 출처는 public/icons/출처.txt.

   왜 <img>가 아닌가: img는 색을 못 바꾼다. 왜 인라인 SVG가 아닌가: 패스가 길어서
   14개를 번들에 넣으면 20KB가 넘는다 (C6). 파일로 두면 쓰는 화면을 열 때만 받는다. */
.hb-ic {
  display: inline-block; flex: none; width: 1.15em; height: 1.15em;
  background: currentColor; vertical-align: -.18em;
  -webkit-mask: var(--ic) center / contain no-repeat;
  mask: var(--ic) center / contain no-repeat;
}
.hb-ic.i-str { --ic: url(${BASE}icons/stat-str.svg); }
.hb-ic.i-steady { --ic: url(${BASE}icons/stat-steady.svg); }
.hb-ic.i-stamina { --ic: url(${BASE}icons/stat-stamina.svg); }
.hb-ic.i-focus { --ic: url(${BASE}icons/stat-focus.svg); }
.hb-ic.i-growth { --ic: url(${BASE}icons/nav-growth.svg); }
.hb-ic.i-collection { --ic: url(${BASE}icons/nav-collection.svg); }
.hb-ic.i-map { --ic: url(${BASE}icons/nav-map.svg); }
.hb-ic.i-sandbox { --ic: url(${BASE}icons/nav-sandbox.svg); }
.hb-ic.i-quiver { --ic: url(${BASE}icons/nav-quiver.svg); }
.hb-ic.i-fire { --ic: url(${BASE}icons/fork-fire.svg); }
.hb-ic.i-bomb { --ic: url(${BASE}icons/fork-bomb.svg); }
.hb-ic.i-wind { --ic: url(${BASE}icons/fork-wind.svg); }
.hb-ic.i-supply { --ic: url(${BASE}icons/nav-quiver.svg); }
.hb-ic.i-scout { --ic: url(${BASE}icons/fork-scout.svg); }
.hb-ic.i-single { --ic: url(${BASE}icons/fork-single.svg); }
.hb-ic.i-shield { --ic: url(${BASE}icons/def-shield.svg); }
.hb-ic.i-armor { --ic: url(${BASE}icons/def-armor.svg); }
.hb-ic.i-arrow { --ic: url(${BASE}icons/nav-quiver.svg); }
.hb-ic.i-forge { --ic: url(${BASE}icons/forge-anvil.svg); }
.hb-ic.i-charm { --ic: url(${BASE}icons/charm-rune.svg); }
.hb-ic.i-shop { --ic: url(${BASE}icons/shop-coins.svg); }
.hb-ic.i-bounty { --ic: url(${BASE}icons/bounty-crown.svg); }

/* 앱으로 설치 — 아래 줄 구석의 작은 단추. 브라우저가 된다고 할 때만 뜬다 (ui/install.ts). */
.hb-install { font-size: 13px; color: var(--teal); border-color: #3f5a55; }
.hb-install:hover { color: var(--ink); border-color: var(--teal); }

/* ── 게임 화면 — 굴리지 않는다 (2026-09-11, ui/tabs.ts) ────────────────────────
   형: "능력치강화랑 대장간 이런거 이렇게 한 화면에 세로로 몰아넣는게 맞아?"
       "세로롤링 너무 게임 안같고 뭔 웹페이지 같잖아."

   맞다. 판이 **긴 문서**였다. 이제 판의 높이는 **화면이 정하고**(.hb-tall), 내용은
   위의 칸으로 갈아탄다. 한 칸에 들어갈 만큼만 한 칸에 넣는다 — 안 들어가면 칸을 늘리지
   화면을 늘리지 않는다. 아래 줄(출정 버튼)은 **늘 보인다.** */
.hb-panel.hb-tall { height: min(760px, 100%); }
.hb-tall .hb-body {
  /* flex: 1 이 없으면 안쪽이 **내용 높이**로 줄어든다 — 판은 760px 인데 칸은 317px 이고
     남은 440px 이 빈 종이가 된다 (2026-09-11, 브라우저로 직접 재서 찾았다). */
  flex: 1; display: flex; flex-direction: column; overflow: hidden;
}
.hb-screen { display: flex; flex-direction: column; flex: 1; min-height: 0; }

/* 탭 줄 — 글자와 밑줄뿐이다. 한쪽만 두꺼운 네모는 안 쓴다 (형의 오랜 반려). */
.hb-tabs { display: flex; gap: 2px; flex: none; border-bottom: 1px solid var(--line); }
.hb-tab {
  flex: 1; min-height: 42px; padding: 9px 10px 8px; border: 0; background: transparent;
  color: var(--mute); font: inherit; font-weight: 700; font-size: 14px; letter-spacing: .04em;
  cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px;
  transition: color .12s, border-color .12s;
}
.hb-tab:hover { color: var(--dim); }
.hb-tab:focus-visible { outline: 2px solid var(--teal); outline-offset: -2px; }
.hb-tab.hb-tab-on { color: var(--accent); border-bottom-color: var(--accent); }
@media (pointer: coarse) { .hb-tab { min-height: 46px; } }

/* 칸 — 하나만 보인다. 넘치면 그 칸 안에서만 굴린다 (아주 낮은 화면의 마지막 수단이다). */
.hb-panes { position: relative; flex: 1; min-height: 0; }
.hb-pane {
  display: none; height: 100%; overscroll-behavior: contain; padding-top: 10px;
  /* 세로는 마지막 수단으로 굴리고, **가로는 절대 안 굴린다** — 머리 그림이 칸 밖으로
     8px 번지게 되어 있어(.f-h 의 음수 여백) 그것만으로 가로 막대가 생겼다 (2026-09-11). */
  overflow-y: auto; overflow-x: hidden;
}
.hb-pane.hb-on { display: block; }
/* 내용이 칸보다 짧으면 **가운데로 모은다** — 위에 붙고 아래가 텅 비면 그게 곧 빈 화면이다. */
.hb-pane.hb-on.hb-mid { display: flex; flex-direction: column; justify-content: center; }
.hb-pane > :first-child { margin-top: 0; }

/* 아래 줄 — 늘 보인다. 출정 버튼이 굴려야 나오면 그건 게임이 아니다. */
.hb-foot {
  flex: none; display: flex; align-items: center; gap: 12px;
  border-top: 1px solid var(--line); padding-top: 11px; margin-top: 10px;
}
.hb-foot:empty { display: none; }

/* ── 걸이 — 돌려서 고른다 (2026-09-11, ui/wheel.ts) ────────────────────────────
   형: "활선택하는게 버튼이 아니라 롤이었으면 좋겠어. 리볼빙형식이라고 해야하나?"

   가운데 한 장이 앞에 나오고 양옆이 물러난다. 자리와 크기는 JS 가 transform 으로 쓰고,
   **부드러움은 여기 transition 이 만든다** — 그래야 프레임마다 도는 코드가 없다 (A5).
   양옆이 반쯤 보이는 것이 이 물건의 전부다: "옆에 더 있다"를 화살표보다 형태가 먼저 말한다. */
.wh {
  position: relative; display: grid; align-items: center;
  grid-template-columns: auto 1fr auto; gap: 6px;
}
.wh-stage {
  /* 칸이 크면 걸이도 커진다. 고정 178px 로 두니 넓은 화면에서 아래가 텅 비었다 (2026-09-11). */
  position: relative; height: clamp(168px, 38vh, 280px); overflow: hidden; touch-action: pan-y;
}
.wh-card {
  position: absolute; left: 50%; top: 50%;
  /* 무대 높이를 따라간다 — 내용 높이로 두니 큰 화면에서 카드만 작고 위아래가 비었다. */
  height: 82%;
  display: flex; flex-direction: column; gap: 4px;
  background: var(--card); border-radius: 2px; padding: 13px 14px 14px;
  text-align: left; cursor: pointer; color: var(--body);
  transition: transform .22s cubic-bezier(.2,.7,.3,1), opacity .18s;
  will-change: transform;
}
/* 카드 테두리는 다른 카드와 같은 문양이다 — 걸이라고 다른 종이를 쓰지 않는다. */
.wh-card::before {
  content: ""; position: absolute; inset: 0; pointer-events: none;
  border: 11px solid transparent;
  border-image: url(${BASE}ui/frame-card.png) 32 / 11px stretch;
}
/* 가운데 한 장만 또렷하다. 고른 것이 곧 앞에 나온 것이다. */
.wh-card.wh-mid { background: var(--card-hi); box-shadow: 0 8px 26px #0009; }
.wh-card.wh-lock { filter: grayscale(.6); }
.wh-card .wh-n { color: var(--ink); font-weight: 700; font-size: 16px; line-height: 1.25; }
.wh-card.wh-mid .wh-n { color: var(--accent); }
.wh-card.wh-lock .wh-n { color: var(--mute); letter-spacing: .1em; }
.wh-card .wh-d { color: var(--dim); font-size: 12px; line-height: 1.4; }
.wh-card .wh-ic { line-height: 0; margin-bottom: 5px; color: var(--dim); }
.wh-card.wh-mid .wh-ic { color: var(--accent); }
/* 화살표 — 손가락이 닿는 크기(44px)를 지킨다. 글리프는 크게, 테두리는 없이. */
.wh-arm {
  width: 40px; min-width: 40px; height: 64px; padding: 0; justify-content: center;
  font-size: 26px; line-height: 1; color: var(--dim); background: transparent; border-color: transparent;
}
.wh-arm:hover { background: var(--card); color: var(--ink); }
@media (pointer: coarse) { .wh-arm { width: 44px; min-width: 44px; height: 72px; } }
/* 몇 번째인가 — 점 다섯. 숫자를 쓰지 않는 이유는 세는 것이 아니라 **어디쯤인지**를 보는 것이라서다. */
.wh-pips { grid-column: 1 / -1; display: flex; justify-content: center; gap: 6px; margin-top: 2px; }
.wh-pips i { width: 5px; height: 5px; border-radius: 50%; background: var(--line); transition: background .18s, transform .18s; }
.wh-pips i.wh-on { background: var(--accent); transform: scale(1.4); }
/* 좁은 화면 — 카드가 작아지니 무대도 낮춘다. */
@media (max-width: 480px) { .wh-stage { height: 158px; } }
@media (max-height: 560px) { .wh-stage { height: 158px; } }

/* ── 자세히 말풍선 (2026-09-11, ui/detail.ts) ─────────────────────────────────
   형: "하스스톤은 (…) 화면에 가장중요한 설명, 탭할때 바로뜨는 부가 설명과 (…) 조금더
        오래누르고 있으면 뜨는 추가설명, 이런식으로 커버하는데 우리도 그런것좀 해야해."

   카드 겉면은 이름과 숫자 하나만 지고, 나머지는 **길게 누르면** 여기로 뜬다.
   클릭을 안 먹는다(pointer-events:none) — 화면 위에 잠깐 놓이는 종이 한 장이다.
   스크림(패널)보다 위에 선다: 패널 위의 카드를 눌러 뜨는 물건이라 그 아래면 가려진다. */
.hb-detail {
  position: fixed; z-index: 3; display: none; pointer-events: none;
  max-width: min(320px, calc(100vw - 20px));
  background: #24231fF7; border: 1px solid var(--line); border-radius: 3px;
  padding: 11px 13px 10px; box-shadow: 0 10px 30px #000000cc;
  font-size: 13px; line-height: 1.55; color: var(--body);
}
.hb-detail.hb-on { display: block; }
.hb-dt { color: var(--ink); font-weight: 700; font-size: 15px; letter-spacing: -.01em; }
.hb-ds { color: var(--mute); font-weight: 400; font-size: 12px; margin-left: 7px; letter-spacing: .06em; }
.hb-dl { margin-top: 6px; }
/* 수치 — 이름과 값이 두 칸으로 선다. 문장 속 숫자보다 표가 빠르다. */
.hb-dg {
  display: grid; grid-template-columns: auto 1fr; gap: 2px 12px;
  margin-top: 8px; padding-top: 7px; border-top: 1px solid var(--line);
  font-size: 12px; color: var(--mute);
}
.hb-dg b { color: var(--ink); font-weight: 700; text-align: right; }
.hb-df { margin-top: 7px; color: var(--accent); font-size: 12px; }

/* 구역 머리에 붙는 작은 안내 — "길게 눌러 자세히". 한 번 알면 안 읽는 글자라 아주 작다. */
.hb-tip { color: var(--mute); font-size: 11px; letter-spacing: 0; font-weight: 400; margin-left: auto; }
@media (hover: hover) and (pointer: fine) { .hb-tip.hb-tip-touch { display: none; } }
@media (pointer: coarse) { .hb-tip.hb-tip-mouse { display: none; } }

/* ── 엽전(葉錢) — 이 게임의 돈 (2026-09-11, game/money.ts) ──────────────────────
   형: "적절한 금화 아이콘으로 만들어. 그리고 어느곳에서든 사용처에서 금화 아이콘이랑 숫자 같이 써."

   파일(.svg)로 두지 않는 이유: .hb-ic 는 currentColor 로 칠하는 마스크라 **색을 못 고른다.**
   돈은 줄 색을 따라가면 안 된다 — 언제나 놋쇠빛이어야 한 눈에 돈으로 읽힌다.
   둥근 테 + 네모 구멍, 도형 둘이면 상평통보가 된다. 캔버스 쪽(money.ts drawCoin)과 같은 그림이다. */
.hb-coin {
  display: inline-block; flex: none; position: relative;
  width: 1.05em; height: 1.05em; margin-right: .34em; vertical-align: -.16em;
  border-radius: 50%; background: #ffd35c; box-shadow: inset 0 0 0 .085em #8a6a1e;
}
.hb-coin::after { content: ''; position: absolute; inset: 33%; background: #8a6a1e; }

/* 올릴 수 있다는 표시. 점 하나. 모달로 막지 않는다 (C1) */
.hb-dot {
  position: absolute; top: -4px; right: -4px; width: 8px; height: 8px; border-radius: 50%;
  background: var(--accent); box-shadow: 0 0 0 2px #14171d; opacity: 0; transition: opacity .2s;
}
.hb-btn.hb-has .hb-dot { opacity: 1; animation: hb-pulse 1.6s ease-in-out infinite; }
/* 점은 **숨 쉰다** (2026-09-02). 형의 여자친구는 11판까지 이 버튼을 한 번도 안 눌렀다 —
   가만한 점은 처음 보는 사람에게 장식이다. 크기가 아니라 움직임이 눈을 부른다.
   화면을 가리지도, 소리를 내지도 않는다 (C1·C3). */
@keyframes hb-pulse {
  0%, 100% { transform: scale(1); box-shadow: 0 0 0 2px #14171d; }
  50% { transform: scale(1.35); box-shadow: 0 0 0 2px #14171d, 0 0 8px 2px #ffb34766; }
}

/* 우상단은 캔버스 HUD(훈련치·바람·무음)의 자리다 — 토스트가 그 위를 통째로 덮었었다
   (UI 전수조사 겹침 2번). 우하단은 어느 레이어도 안 쓰는 빈 구석이라 여기가 토스트의 집이다. */
/* ★ 패널(스크림)보다 위다. 아래에 있으면 패널이 열린 동안 뜬 알림이 **어두운 막에 가려**
   아무것도 안 보인다 — 지도에서 "한 번 더 누르면 간다"는 확인이 안 보여서 형이
   "아직도 스테이지 이동이 안돼"라고 한 것이 이거였다. 알림은 언제나 맨 위다. */
.hb-toasts {
  position: absolute; z-index: 2;
  right: calc(20px + var(--safe-r)); bottom: calc(20px + var(--safe-b));
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
  position: absolute; inset: 0; z-index: 1; display: none; align-items: center; justify-content: center;
  background: #0e1116e6; pointer-events: auto; padding: 20px;
  -webkit-backdrop-filter: blur(3px); backdrop-filter: blur(3px);
}
.hb-scrim.hb-open { display: flex; }

/* 패널 = [바깥(문양 테두리·그림자)] + [안쪽(스크롤)]. 테두리는 스크롤과 함께 흐르면 안 된다. */
.hb-panel {
  position: relative; display: none; width: min(var(--pw), 100%); max-height: 100%;
  background: linear-gradient(180deg, var(--paper) 0%, var(--paper2) 100%);
  border-radius: 3px;
  box-shadow: 0 26px 80px #000000cc;
  /* ★ 문양 테두리의 두께만큼 **안쪽으로 물린다.**
     이게 없으면 스크롤한 글자가 테두리 위를 지나간다 — 형: "슬라이드 할때 글자가 그걸
     넘어가는데. 종이위에서 글자가 왔다갔다 하는거같잖아." 맞는 말이다. 테두리는 종이의
     가장자리지 글자가 지나다니는 길이 아니다. 안쪽 칸(.hb-body)이 자기 상자에서 잘리므로,
     이제 글자는 테두리에 **닿기 전에** 사라진다. */
  padding: 15px;
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
  padding: 10px 18px 12px; scrollbar-width: thin;
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
/* 안내 글줄. **64자에서 끊는다** — 판이 넓어져도 한 줄이 화면을 가로지르면 읽기가 죽는다. */
.hb-lead { color: var(--dim); font-size: 14px; margin: 3px 0 13px; max-width: 64ch; }

/* ── 두 단 (2026-09-11) ────────────────────────────────────────────────
   넓은 화면에서만 두 단이 된다. 좁으면 한 단으로 되돌아가므로 폰에서는 아무것도 안 바뀐다.
   align-items:start — 두 단의 길이가 다른 게 정상이다. 늘여 맞추면 빈 칸이 다시 생긴다. */
.hb-cols { display: grid; grid-template-columns: 1fr; gap: 0 38px; }
@media (min-width: 900px) {
  .hb-cols { grid-template-columns: 1fr 1fr; align-items: start; }
  /* 단의 첫 덩어리는 위 괘선을 지운다 — 단이 갈린 자리에 선이 또 있으면 두 번 나눈 것이다. */
  .hb-cols > div > :first-child.g-bows,
  .hb-cols > div > :first-child.hb-sec { margin-top: 0; border-top: none; }
}
/* 구역 이름 + 그 뒤로 이어지는 괘선. 상자를 하나 더 만드는 대신 선 하나로 나눈다. */
.hb-sec {
  display: flex; align-items: center; gap: 12px;
  color: var(--dim); font-size: 12px; letter-spacing: .2em; margin: 16px 0 8px;
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

/* ── 넓은 화면 — 판이 따라 넓어진다 (2026-09-11) ────────────────────────────
   게임은 화면을 다 쓰는데 판만 680px 이면, 켜는 순간 화면의 3분의 2가 빈 막이 된다.
   단계로 올린다: 넓어질수록 .hb-cols 가 두 단을 쓸 자리가 생긴다. */
@media (min-width: 900px)  { .hb-ui { --pw: 880px; } }
@media (min-width: 1200px) { .hb-ui { --pw: 1100px; } }
@media (min-width: 1600px) { .hb-ui { --pw: 1280px; } }

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
  /* ── 아래 버튼 줄 = 손가락으로 누르는 **바** ─────────────────────────
     형: "몇 스테이지 가면 버튼이 캐릭터를 가린다고 모바일 세로로 플레이할때.
          컴퓨터에서는 버튼 적당히 크더라도 모바일에선 배치가 정말 적절해야해."
     맞다. 그리고 원인은 크기가 아니라 **줄 수**였다: 글자가 붙은 버튼이 넉 줄까지
     접히면서 위로 자라 궁수를 덮었다. 살통에 살 종류가 늘수록 더 자란다 —
     즉 "몇 스테이지 가면" 나빠진다.

     그래서 폰에서는 글자를 지우고 **아이콘만 남긴다**. 모바일 게임들이 하는 그대로다:
     한 손으로 닿는 아래쪽에, 크기가 변하지 않는 칸들이 줄지어 선다.
     최대 두 줄(길잡이 넷 + 살통)로 고정되고, 그 높이만큼 카메라가 자리를 비워 둔다
     (render/camera.ts VIEW.bandBottomPx — 이 둘은 같이 움직여야 한다). */
  .hb-hud { gap: 8px; }
  .hb-hud .hb-btn { padding: 0 10px; min-width: 46px; height: 46px; justify-content: center; }
  .hb-hud .hb-lbl { display: none; }
  .hb-hud .hb-ic { width: 24px; height: 24px; vertical-align: 0; }

  .hb-panel { padding: 12px; }
  .hb-body { padding: 4px 8px calc(10px + var(--safe-b)); }
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
/* ── 낮은 화면 (가로로 눕힌 폰) ────────────────────────────────────────
   형: "아직도 가로화면에서 버튼이랑 화면이 겹치는게 난 이해가 안된다."
   가로 폰은 폭이 844라 위의 (max-width: 640px) 규칙에 안 걸려서, 글자 붙은 큰 버튼이
   그대로 두세 줄로 접혔다 — 높이가 390px뿐인 화면에서 그건 화면의 3분의 1이다.
   여기서는 아이콘만 남기고 **한 줄로 고정**한다 (넘치면 옆으로 민다).
   render/camera.ts 의 VIEW.bandBottomShortPx 가 이 한 줄만큼만 비운다. */
@media (max-height: 560px) {
  .hb-hud {
    gap: 8px; flex-wrap: nowrap; overflow-x: auto;
    max-width: calc(100vw - 36px - var(--safe-l) - var(--safe-r));
  }
  .hb-hud .hb-btn { padding: 0 10px; min-width: 46px; height: 46px; justify-content: center; }
  .hb-hud .hb-lbl { display: none; }
  .hb-hud .hb-ic { width: 24px; height: 24px; vertical-align: 0; }
  /* 낮은 화면에서는 패널도 화면을 꽉 채운다 — 시트로 올릴 세로가 없다. */
  .hb-scrim { padding: 10px; }
  .hb-panel { max-height: 100%; }
  .hb-panel { padding: 12px; }
  .hb-body { padding: 6px 10px 8px; }
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
    panelBox(id: string): HTMLElement {
      const found = panels.get(id)
      if (found !== undefined) return found.outer
      this.panel(id)
      return (panels.get(id) as { outer: HTMLElement }).outer
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
