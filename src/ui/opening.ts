/**
 * 오프닝 — 켜면 곧바로 판이 아니라, 문 앞에 한 번 선다 (2026-09-03)
 *
 * 형: **"게임 시작할 때는 바로 게임 페이지 가지 말고 오프닝 화면을 띄워줘. 바람의나라 느낌처럼."**
 *
 * 그동안은 C1(3초 안에 첫 발) 때문에 스플래시를 안 만들었다. 형의 결정으로 바꾸되 C1의 정신은
 * 지킨다: **딱 한 번(켤 때만)**, 로딩이 아니라 그림이고, **아무 데나 한 번 누르면** 사라진다.
 * 탭을 숨겼다 돌아올 때는 뜨지 않는다 — 그건 시작이 아니라 복귀다.
 *
 * 바람의나라의 그 화면: 그림 한 장 위에 제목 글씨, 아래에 깜빡이는 "시작" 한 줄. 그게 전부다.
 * 그림은 고구려 무용총 「수렵도」(public/art/출처.txt) — 말 위에서 몸을 돌려 쏘는 사람들.
 * 이 게임의 이름 '신궁'이 그 그림 위에 서면 이름이 저절로 설명된다.
 *
 * ── 가로 안내 (2026-09-03, 형) ────────────────────────────────────────
 * **"첫 실행 화면에서 게임을 가로로 플레이하라는 애니메이션 떴으면 좋겠다. 첫 화면 문구도 바꾸고."**
 *
 * 이 게임은 활을 **옆으로** 쏜다. 세로로 들면 카메라가 폭에 묶여(render/camera.ts VIEW.portraitAspect)
 * 과녁까지의 거리가 우표만 해진다. 그래서 글로 "가로로 하세요"라고 쓰는 대신 **폰이 실제로 눕는
 * 그림**을 보여준다 — 말보다 빠르고, 글을 안 읽는 사람도 따라 한다.
 *
 * 규칙 셋:
 *   ① 세로일 때만 뜬다. 이미 가로면 잔소리다 (matchMedia orientation, 돌리면 그 자리에서 사라진다).
 *   ② 되돌아가는 회전은 안 보여준다 — 눕힌 채로 멈췄다가 사라지고 다시 시작한다.
 *      왕복시키면 "다시 세우라"는 뜻으로 읽힌다.
 *   ③ 막지 않는다. 세로로도 게임은 된다. 여기서도 아무 데나 누르면 그냥 시작한다 (C1).
 */
import type { SaveData } from '../game/save.ts'
import type { Overlay } from './overlay.ts'

const PANEL_ID = 'opening'
/** 첫 화면의 불티·화살 수. 폰에서도 가벼운 수 — CSS 애니메이션이라 rAF 를 안 돈다 (C3). */
const EMBERS = 14
const STREAKS = 3
const BASE: string = import.meta.env?.BASE_URL ?? '/'

const CSS = `
.op-wrap {
  position: relative; margin: -12px -8px -10px; min-height: min(78vh, 640px);
  display: flex; flex-direction: column; justify-content: flex-end; align-items: center;
  padding: 24px 18px 30px; overflow: hidden; border-radius: 2px; cursor: pointer;
  background: var(--paper);
}
/* ── 살아 있는 첫 화면 (2026-09-10, 형: "게임 시작할 때 이미지 자체가 흥미진진해야") ──
   그림이 천천히 다가오고(켄 번즈), 불티가 오르고, 화살이 가로지르고, 제목이 숨 쉰다. 에셋 없이 CSS 뿐. */
.op-bg {
  position: absolute; inset: -4%; z-index: 0;
  background: url(${BASE}art/suryeopdo.jpg) center 42% / cover no-repeat;
  animation: op-kb 26s ease-in-out infinite alternate;
  filter: saturate(1.15) contrast(1.06);
}
@keyframes op-kb { from { transform: scale(1) translate(0, 0); } to { transform: scale(1.1) translate(-1.5%, 1%); } }
.op-veil {
  position: absolute; inset: 0; z-index: 1; pointer-events: none;
  background:
    radial-gradient(ellipse at 50% 40%, rgba(0, 0, 0, 0) 40%, rgba(8, 6, 4, .55) 100%),
    linear-gradient(to bottom, rgba(20, 18, 14, .22), rgba(20, 18, 14, .1) 45%, rgba(38, 37, 33, .88) 78%, var(--paper) 100%);
}
.op-wrap > :not(.op-bg):not(.op-veil):not(.op-fx) { position: relative; z-index: 2; }
/* 불티 — 아래에서 위로 흔들리며 오른다. 위치·박자는 JS가 심는다 (UI 난수는 sim 밖이다). */
.op-fx { position: absolute; inset: 0; z-index: 1; pointer-events: none; overflow: hidden; }
.op-ember {
  --sway: 0px; position: absolute; bottom: -6px; width: 4px; height: 4px; border-radius: 50%;
  background: var(--accent); box-shadow: 0 0 8px 2px rgba(255, 179, 71, .55); opacity: 0;
  animation: op-ember linear infinite;
}
@keyframes op-ember {
  0% { transform: translate(0, 0) scale(1); opacity: 0; }
  10% { opacity: .9; }
  50% { transform: translate(var(--sway), -55vh) scale(.8); opacity: .7; }
  100% { transform: translate(calc(var(--sway) * -1), -105vh) scale(.3); opacity: 0; }
}
/* 화살 — 왼쪽 아래에서 오른쪽 위로 가로지르는 가는 빛줄기 셋. */
.op-streak {
  position: absolute; left: -30%; width: 22%; height: 2px; border-radius: 1px;
  background: linear-gradient(to right, rgba(255, 216, 143, 0), rgba(255, 216, 143, .95) 70%, #fff);
  transform-origin: 100% 50%; opacity: 0; animation: op-streak 5.5s cubic-bezier(.2, .8, .3, 1) infinite;
}
@keyframes op-streak {
  0%, 62% { transform: translate(0, 0) rotate(-9deg); opacity: 0; }
  64% { opacity: 1; }
  82% { transform: translate(600%, -34vh) rotate(-9deg); opacity: .9; }
  84%, 100% { transform: translate(650%, -37vh) rotate(-9deg); opacity: 0; }
}
/* 낙관 — 붉은 도장 하나. 이름 곁에 찍히면 그림이 '작품'이 된다. */
.op-seal {
  display: inline-block; margin-left: 10px; vertical-align: 18px; width: 30px; height: 30px; line-height: 30px;
  background: #b8332a; color: #fff2dc; font-family: var(--serif); font-size: 14px; letter-spacing: 0;
  border-radius: 3px; box-shadow: 0 1px 4px rgba(0, 0, 0, .5); transform: rotate(-6deg); text-shadow: none;
}
.op-cap { position: absolute; right: 12px; top: 10px; color: rgba(255, 244, 220, .6); font-size: 11px; letter-spacing: .06em; }
.op-hanja { font-family: var(--serif); color: rgba(255, 236, 200, .55); font-size: 22px; letter-spacing: .5em; margin-bottom: 4px; }
.op-title {
  font-family: var(--serif); font-weight: 700; color: var(--ink); font-size: 76px; line-height: 1.05;
  letter-spacing: .12em; text-shadow: 0 2px 18px rgba(0, 0, 0, .55);
  animation: op-glow 3.2s ease-in-out infinite;
}
@keyframes op-glow {
  0%, 100% { text-shadow: 0 2px 18px rgba(0, 0, 0, .55), 0 0 0 rgba(255, 179, 71, 0); }
  50% { text-shadow: 0 2px 18px rgba(0, 0, 0, .55), 0 0 28px rgba(255, 179, 71, .55); }
}
.op-sub { font-family: var(--serif); color: var(--ink); font-size: 17px; letter-spacing: .1em; margin-top: 12px; text-align: center; }
.op-sub2 { color: var(--dim); font-size: 13px; letter-spacing: .06em; margin-top: 6px; text-align: center; }
.op-rec { color: var(--gold); font-size: 13px; letter-spacing: .1em; margin-top: 14px; }
.op-go {
  margin-top: 24px; color: var(--accent); font-weight: 700; font-size: 17px; letter-spacing: .2em;
  animation: op-blink 1.6s ease-in-out infinite;
}
@keyframes op-blink { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }
.op-key { color: var(--mute); font-size: 11px; letter-spacing: .1em; margin-top: 8px; }

/* 가로 안내 — 폰이 눕는 그림 한 컷 */
.op-turn {
  display: flex; align-items: center; gap: 12px; margin-top: 18px;
  padding: 9px 16px 9px 12px; border-radius: 999px;
  border: 1px solid rgba(214, 176, 106, .38); background: rgba(24, 22, 18, .55);
}
.op-turn-box { position: relative; width: 46px; height: 46px; flex: none; }
.op-phone {
  position: absolute; left: 50%; top: 50%; width: 26px; height: 42px; margin: -21px 0 0 -13px;
  border: 2px solid var(--gold); border-radius: 5px; background: rgba(214, 176, 106, .12);
  transform-origin: 50% 50%; animation: op-turn 3.4s ease-in-out infinite;
}
/* 화면 속 화살 한 발 — 눕히면 이 선이 길어진다(=멀리 본다)는 뜻 */
.op-phone::after {
  content: ''; position: absolute; left: 4px; right: 4px; top: 50%; height: 2px; margin-top: -1px;
  background: var(--accent); opacity: .9; border-radius: 1px;
}
@keyframes op-turn {
  0%, 16% { transform: rotate(0deg); opacity: 1; }
  40%, 84% { transform: rotate(-90deg); opacity: 1; }
  93% { transform: rotate(-90deg); opacity: 0; }
  94%, 100% { transform: rotate(0deg); opacity: 0; }
}
.op-turn-txt { color: var(--ink); font-size: 13px; letter-spacing: .04em; line-height: 1.5; text-align: left; }
.op-turn-txt b { color: var(--gold); font-weight: 700; }
@media (prefers-reduced-motion: reduce) {
  .op-phone { animation: none; transform: rotate(-90deg); }
  .op-go, .op-bg, .op-title, .op-ember, .op-streak { animation: none; }
  .op-ember, .op-streak { display: none; }
}
@media (max-width: 640px) {
  .op-title { font-size: 56px; }
  .op-wrap { min-height: min(72vh, 560px); }
}
`

/** 가로 안내 한 컷. 세로일 때만 DOM에 올라간다. */
function turnHint(): HTMLElement {
  const el = document.createElement('div')
  el.className = 'op-turn'
  el.innerHTML =
    '<div class="op-turn-box"><div class="op-phone"></div></div>' +
    '<div class="op-turn-txt"><b>가로로 눕히고 하는 게임</b><br>활은 옆으로 쏜다 — 눕히면 과녁이 커진다</div>'
  return el
}

/**
 * 오프닝을 띄운다. onStart 는 정확히 한 번 — 누르거나 아무 키나 치면.
 * 사용자 제스처가 곧 소리의 열쇠이기도 하다 (autoplay 정책): 이 클릭이 첫 제스처가 된다.
 */
export function mountOpening(o: Overlay, d: SaveData, onStart: () => void): void {
  const panel = o.panel(PANEL_ID)
  panel.replaceChildren()
  panel.setAttribute('aria-label', '신궁')

  const style = document.createElement('style')
  style.textContent = CSS
  panel.appendChild(style)

  const wrap = document.createElement('div')
  wrap.className = 'op-wrap'
  // 불티 열넷·화살 셋 — 자리와 박자는 여기서 심는다. UI 난수는 sim 밖이다 (A1과 무관).
  let fx = ''
  for (let i = 0; i < EMBERS; i++) {
    const left = (Math.random() * 100).toFixed(1)
    const dur = (6 + Math.random() * 7).toFixed(1)
    const delay = (-Math.random() * 12).toFixed(1)
    const sway = ((Math.random() - 0.5) * 80).toFixed(0)
    fx += `<i class="op-ember" style="left:${left}%;animation-duration:${dur}s;animation-delay:${delay}s;--sway:${sway}px"></i>`
  }
  for (let i = 0; i < STREAKS; i++) {
    fx += `<i class="op-streak" style="bottom:${18 + i * 14}%;animation-delay:${(i * 1.9).toFixed(1)}s"></i>`
  }
  wrap.innerHTML =
    '<div class="op-bg"></div><div class="op-veil"></div>' +
    `<div class="op-fx">${fx}</div>` +
    '<div class="op-cap">무용총 「수렵도」</div>' +
    '<div class="op-hanja">神弓</div>' +
    '<div class="op-title">신궁<span class="op-seal">弓</span></div>' +
    '<div class="op-sub">마지막 한 발에, 시간이 멎는다</div>' +
    '<div class="op-sub2">활 한 번 안 잡아본 스틱맨이 신궁이 되기까지 · 한 판 30초</div>' +
    (d.bestRunStage > 0
      ? `<div class="op-rec">가장 멀리 ${d.bestRunStage}판 · 여정 ${d.runCount}번</div>`
      : '<div class="op-rec">아직 한 발도 쏘지 않았다</div>') +
    '<div class="op-go">활을 든다</div>' +
    '<div class="op-key">아무 데나 누르면 시작 · 언제 꺼도 손해 없다 · 소리는 M</div>'
  panel.appendChild(wrap)

  // 세로일 때만 안내를 건다. 형이 폰을 돌리는 순간 사라지는 게 곧 "됐다"는 신호다.
  const mq = window.matchMedia?.('(orientation: portrait)')
  let hint: HTMLElement | null = null
  const syncTurn = (): void => {
    const want = mq ? mq.matches : window.innerHeight > window.innerWidth
    if (want && !hint) {
      hint = turnHint()
      wrap.appendChild(hint)
    } else if (!want && hint) {
      hint.remove()
      hint = null
    }
  }
  syncTurn()
  mq?.addEventListener('change', syncTurn)

  let done = false
  const go = (): void => {
    if (done) return
    done = true
    window.removeEventListener('keydown', onKey)
    mq?.removeEventListener('change', syncTurn)
    o.hide(true)
    onStart()
  }
  const onKey = (e: KeyboardEvent): void => {
    if (e.altKey || e.ctrlKey || e.metaKey) return
    // M은 음소거 키다 — 오프닝에서도 그 뜻 그대로 두고 시작하지 않는다.
    if (e.key === 'm' || e.key === 'M') return
    go()
  }
  wrap.addEventListener('click', go)
  window.addEventListener('keydown', onKey)

  o.show(PANEL_ID, { sticky: true })
}
