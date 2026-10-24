/**
 * 새 빌드 알림 — 켜 둔 채로 하는 판이 옛 코드로 계속 돌지 않게 (형 10-24: "협보 원정 보냈는데 아직도 쉬는 걸로 나온다 · 왜 이렇게 못 고쳐"
 * — 고친 빌드가 올라가도 폰에 켜 둔 판은 옛 코드 그대로였다).
 *
 * 배포마다 dist/version.txt 에 빌드 이름이 적힌다 (vite.config.ts). 화면이 다시 보일 때와 누를 때만 들여다본다 —
 * 타이머로 돌지 않는다 (절대 규칙 4). 다르면 위에 띠 하나: 누르면 저장하고 새로 고친다. 띠는 저절로 걷히고, 다음에 또 들여다볼 때 다시 뜬다.
 */
/** 이만큼(ms) 안에는 다시 들여다보지 않는다 */
const CHECK_GAP_MS = 120_000
/** 띠가 떠 있는 시간(ms) — 알림은 반드시 걷힌다 */
const BAR_MS = 15_000

export function watchUpdates(root: HTMLElement, beforeReload: () => void): void {
  if (__BUILD_ID__ === 'dev') return
  let last = -Infinity
  const show = (): void => {
    if (root.querySelector('.updbar') !== null) return
    root.insertAdjacentHTML('beforeend', '<button class="updbar">새 판이 올라왔다 · 누르면 새로 고친다</button>')
    const el = root.querySelector<HTMLElement>('.updbar')!
    el.addEventListener('click', (e) => { e.stopPropagation(); beforeReload(); location.reload() })
    window.setTimeout(() => el.remove(), BAR_MS)
  }
  const check = async (): Promise<void> => {
    if (document.visibilityState !== 'visible') return
    const now = performance.now()
    if (now - last < CHECK_GAP_MS) return
    last = now
    try {
      const got = (await (await fetch('version.txt', { cache: 'no-store' })).text()).trim()
      if (got !== '' && got.length < 40 && got !== __BUILD_ID__) show()
    } catch { /* 길이 끊겼으면 다음에 */ }
  }
  document.addEventListener('visibilitychange', () => { void check() })
  root.addEventListener('pointerdown', () => { void check() }, { passive: true })
}

export const UPDATE_CSS = `
.ap .updbar { position: absolute; left: 50%; top: calc(8px + env(safe-area-inset-top)); transform: translateX(-50%); z-index: 99; padding: 9px 16px; border-radius: 999px;
  background: #2a1f10f2; border: 1px solid #e0b860; color: #ffe6b0; font: inherit; font-size: 14px; font-weight: 700; box-shadow: 0 6px 20px #000a; cursor: pointer; animation: updin .35s ease-out both; }
@keyframes updin { from { opacity: 0; transform: translate(-50%, -8px); } to { opacity: 1; transform: translateX(-50%); } }
`
