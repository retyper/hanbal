/**
 * 호흡정지 버튼 — **폰에는 Shift도 우클릭도 없다.**
 *
 * 형: "폰에서는 숨참기 못하니까 숨참기 버튼을 왼쪽에 만들어줘야할듯."
 * 맞다. 호흡정지(steady)는 이 게임에서 떨림을 죽이는 유일한 손이고(sim/bow.ts),
 * 그게 없으면 폰 사용자는 **깊은 판을 구조적으로 못 깬다** — 조작이 하나 통째로 빠진 채였다.
 *
 * 자리: HUD 버튼 줄의 **맨 왼쪽**. 새 줄을 만들지 않는 이유는 그게 곧 궁수를 덮기 때문이다
 * (render/camera.ts VIEW.bandBottomPx — 줄 수가 곧 띠의 높이다). 왼손 엄지가 여기를 누르고
 * 오른손이 당겼다 놓는다.
 *
 * 손가락 화면에서만 보인다. 마우스로는 버튼을 누른 채 조준할 수 없어서 있으나 마나다 —
 * 데스크탑은 Shift와 우클릭이 이미 그 일을 한다 (input/pointer.ts).
 */
import type { Overlay } from './overlay.ts'

const CSS = `
.st-btn {
  display: none; width: 58px; height: 58px; padding: 0; border-radius: 50%;
  justify-content: center; align-items: center; flex-direction: column; gap: 1px;
  color: var(--teal); border-color: #4a5f5a; touch-action: none;
}
/* 누르고 있는 동안 — 켜졌다는 걸 손이 아니라 눈으로도 확인해야 한다. */
.st-btn.st-on { background: #2c3a37; color: var(--ink); border-color: var(--teal); }
.st-btn .hb-ic { width: 24px; height: 24px; vertical-align: 0; }
.st-btn i.st-lbl { font-size: 10px; font-style: normal; letter-spacing: .1em; line-height: 1; }
@media (pointer: coarse) { .st-btn { display: inline-flex; } }
`

/** 누르고 있는 동안 호흡을 멈춘다. `hold(true/false)`는 게임 루프로 곧장 간다. */
export function mountSteady(o: Overlay, hold: (on: boolean) => void): void {
  const style = document.createElement('style')
  style.textContent = CSS

  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'hb-btn st-btn'
  btn.setAttribute('aria-label', '호흡정지 — 누르고 있는 동안 떨림이 멎는다')
  btn.innerHTML = '<i class="hb-ic i-focus"></i><i class="st-lbl">숨</i>'

  const set = (on: boolean): void => {
    btn.classList.toggle('st-on', on)
    hold(on)
  }
  // pointerdown 에서 캡처를 잡는다 — 손가락이 버튼 밖으로 미끄러져도 up 을 놓치지 않는다.
  // (놓친 up = 영원히 숨을 참고 있는 궁수)
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    try { btn.setPointerCapture(e.pointerId) } catch { /* 캡처 실패해도 아래 up 들이 받는다 */ }
    set(true)
  })
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
    btn.addEventListener(type, () => set(false))
  }
  // 탭이 숨거나 창을 벗어나도 반드시 푼다.
  const onBlur = (): void => set(false)
  window.addEventListener('blur', onBlur)
  o.onDispose(() => window.removeEventListener('blur', onBlur))

  // HUD 줄의 **맨 앞**에 선다 (왼쪽). 다른 버튼들은 나중에 붙으므로 prepend 여야 한다.
  o.hud().prepend(btn)
  o.hud().prepend(style)
}
