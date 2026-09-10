/**
 * 패링 버튼 — 폰에는 F 키가 없다 (2026-09-10)
 *
 * 형: **"'환도패링' 기능을 넣어"** → 버튼에 적히는 이름은 **패링**이다 (형의 재지시).
 *
 * 숨참기 버튼(ui/steady.ts)과 **같은 문법**이다: HUD 줄 맨 앞의 동그란 버튼, 손가락 화면에서만
 * 보이고, pointerdown 에서 캡처를 잡아 손가락이 미끄러져도 up 을 놓치지 않는다.
 *
 * 다른 점 하나: 숨참기는 **누르고 있는** 것이고 패링은 **누른 순간**이다. sim 이 상승 에지만
 * 보므로(sim/bow.ts ArcherState.parryHeld) 꾹 눌러도 한 번만 휘두른다. 그래서 버튼은
 * "지금 휘두를 수 있는가"를 색으로만 말하면 된다 — 쿨은 화면(칼이 아직 돌고 있다)이 말한다.
 */
import type { Overlay } from './overlay.ts'

const CSS = `
.pr-btn {
  display: none; width: 58px; height: 58px; padding: 0; border-radius: 50%;
  justify-content: center; align-items: center; flex-direction: column; gap: 1px;
  color: var(--gold); border-color: #6a5a3a; touch-action: none;
}
.pr-btn.pr-on { background: #3a3222; color: var(--ink); border-color: var(--gold); }
.pr-btn i.pr-lbl { font-size: 10px; font-style: normal; letter-spacing: .1em; line-height: 1; }
.pr-btn svg { display: block; }
@media (pointer: coarse) { .pr-btn { display: inline-flex; } }
/* 좁은 폰 — 패링이 한 자리를 더 먹는다. 둘을 조금 줄여 버튼 줄이 한 줄 더 늘지 않게 한다
   (줄 수가 곧 아래 띠의 높이이고, 띠가 두꺼워지면 버튼이 궁수를 덮는다 — render/camera.ts). */
@media (max-width: 420px) { .pr-btn { width: 48px; height: 48px; } }
`

/**
 * 칼 한 자루 — 날 · 코등이 · 자루 · 자루끝 (2026-09-10, 형: "칼 아이콘이 있어야지").
 *
 * 날은 **채운 삼각형**이다. 22px 로 줄면 가는 선 여러 개는 서로 붙어 먼지가 되지만,
 * 채운 도형은 실루엣이 남는다 — 아이콘은 그림이 아니라 실루엣이다.
 */
const ICON = `<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
  <path d="M21.2 1.6 12.3 13.35 10.7 11.85Z" fill="currentColor" />
  <path d="M9.14 10.43 13.86 14.77" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" fill="none" />
  <path d="M11.5 12.6 8.45 15.91" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none" />
  <circle cx="7.7" cy="16.9" r="1.5" fill="currentColor" />
</svg>`

/**
 * 누르면 한 번 휘두른다. `hit(true)` 는 곧장 게임 루프로 간다 — 에지는 sim 이 잡으므로
 * 여기서는 눌림/뗌을 그대로 넘기기만 한다.
 */
export function mountParry(o: Overlay, hit: (on: boolean) => void): void {
  const style = document.createElement('style')
  style.textContent = CSS

  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'hb-btn pr-btn'
  // 이름은 **패링**이다 (2026-09-10, 형: "환도라고 하지 말고 패링이라고 하고").
  // 물건 이름(환도)은 세계의 말이지만, 버튼에 적히는 건 **지금 무엇을 하는가**여야 한다.
  btn.setAttribute('aria-label', '패링 — 날아오는 화살을 칼로 쳐서 되돌린다')
  btn.innerHTML = `${ICON}<i class="pr-lbl">패링</i>`

  const set = (on: boolean): void => {
    btn.classList.toggle('pr-on', on)
    hit(on)
  }
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    try { btn.setPointerCapture(e.pointerId) } catch { /* 캡처 실패해도 아래 up 들이 받는다 */ }
    set(true)
  })
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
    btn.addEventListener(type, () => set(false))
  }
  // 탭이 숨거나 창을 벗어나도 반드시 푼다 (숨참기와 같은 이유 — 눌린 채로 남으면 에지가 영영 안 온다).
  const onBlur = (): void => set(false)
  window.addEventListener('blur', onBlur)
  o.onDispose(() => window.removeEventListener('blur', onBlur))

  // 숨참기 다음 자리 — 숨참기가 prepend 로 맨 앞에 서므로 여기도 prepend 면 패링이 앞에 온다.
  // 왼손 엄지가 닿는 순서: 패링(급한 것) → 숨(오래 누르는 것).
  o.hud().prepend(btn)
  o.hud().prepend(style)
}
