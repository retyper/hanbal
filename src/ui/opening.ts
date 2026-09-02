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
 */
import type { SaveData } from '../game/save.ts'
import type { Overlay } from './overlay.ts'

const PANEL_ID = 'opening'
const BASE: string = import.meta.env?.BASE_URL ?? '/'

const CSS = `
.op-wrap {
  position: relative; margin: -12px -8px -10px; min-height: min(78vh, 640px);
  display: flex; flex-direction: column; justify-content: flex-end; align-items: center;
  padding: 24px 18px 30px; overflow: hidden; border-radius: 2px; cursor: pointer;
  background:
    linear-gradient(to bottom, rgba(20, 18, 14, .18), rgba(20, 18, 14, .12) 45%, rgba(38, 37, 33, .86) 78%, var(--paper) 100%),
    url(${BASE}art/suryeopdo.jpg) center 42% / cover no-repeat;
}
.op-cap { position: absolute; right: 12px; top: 10px; color: rgba(255, 244, 220, .6); font-size: 11px; letter-spacing: .06em; }
.op-hanja { font-family: var(--serif); color: rgba(255, 236, 200, .55); font-size: 22px; letter-spacing: .5em; margin-bottom: 4px; }
.op-title {
  font-family: var(--serif); font-weight: 700; color: var(--ink); font-size: 76px; line-height: 1.05;
  letter-spacing: .12em; text-shadow: 0 2px 18px rgba(0, 0, 0, .55);
}
.op-sub { color: var(--dim); font-size: 14px; letter-spacing: .12em; margin-top: 10px; text-align: center; }
.op-rec { color: var(--gold); font-size: 13px; letter-spacing: .1em; margin-top: 14px; }
.op-go {
  margin-top: 26px; color: var(--accent); font-weight: 700; font-size: 17px; letter-spacing: .2em;
  animation: op-blink 1.6s ease-in-out infinite;
}
@keyframes op-blink { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }
.op-key { color: var(--mute); font-size: 11px; letter-spacing: .1em; margin-top: 8px; }
@media (max-width: 640px) {
  .op-title { font-size: 56px; }
  .op-wrap { min-height: min(72vh, 560px); }
}
`

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
  wrap.innerHTML =
    '<div class="op-cap">무용총 「수렵도」</div>' +
    '<div class="op-hanja">神弓</div>' +
    '<div class="op-title">신궁</div>' +
    '<div class="op-sub">활 한 번 안 잡아본 사람이 궁수가 되는 길</div>' +
    (d.bestRunStage > 0
      ? `<div class="op-rec">가장 멀리 ${d.bestRunStage}판 · 여정 ${d.runCount}번</div>`
      : '<div class="op-rec">첫 여정</div>') +
    '<div class="op-go">활을 든다</div>' +
    '<div class="op-key">아무 데나 누르면 시작 · 소리는 M</div>'
  panel.appendChild(wrap)

  let done = false
  const go = (): void => {
    if (done) return
    done = true
    window.removeEventListener('keydown', onKey)
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
