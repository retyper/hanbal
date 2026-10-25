/**
 * 단추 글이 넘치면 줄을 바꾸는 대신 글씨를 줄인다 (형 10-25: "버튼 안에서 줄바꿈되는 건 자연스럽게 크기 축소로").
 * 한 줄로 세우고(nowrap) 넘친 단추만 넘친 만큼 글씨를 줄인다 — 그래도 넘치면(FIT_MIN 아래로 가야 하면) 그때는 줄을 바꾼다.
 * 읽기와 쓰기를 한 번씩 몰아서 한다 — 단추마다 번갈아 재면 그릴 때마다 판을 여러 번 다시 잰다.
 */

/** 글씨를 줄일 수 있는 끝 — 이보다 작으면 읽기 어렵다 */
const FIT_MIN = 0.72

/** 맞출 단추 — 칸이 정해진 갈래 단추 · 아래 탭 · 보통 단추 */
const FIT_SEL = '.seg button, .tabs button, .btn, .cmdm button'

export const FIT_CSS = `
.ap .fit1 { white-space: nowrap; }
/* 갈래·탭 단추는 칸 너비가 정해져 있다 — 글이 길어도 칸을 밀어내지 말고 안에서 넘치게 해야 잴 수 있다 */
.ap .seg button.fit1, .ap .tabs button.fit1 { min-width: 0; }
`

export function fitLabels(scope: ParentNode): void {
  const all = [...scope.querySelectorAll<HTMLElement>(FIT_SEL)]
  // 쓰기 — 지난번 줄인 것을 거두고 한 줄로
  for (const b of all) { b.style.fontSize = ''; b.classList.add('fit1') }
  // 읽기 — 넘친 것 (안이 넘치거나, 단추가 제 자리보다 넓어졌거나)
  const over: Array<[HTMLElement, number, number]> = []
  for (const b of all) {
    if (b.offsetParent === null) continue
    const room = Math.min(b.clientWidth, b.parentElement?.clientWidth ?? b.clientWidth)
    const need = b.scrollWidth
    if (need > room + 1) over.push([b, room / need, Number.parseFloat(getComputedStyle(b).fontSize)])
  }
  // 쓰기 — 넘친 만큼 줄이거나, 너무 줄여야 하면 줄을 바꾼다
  for (const [b, k, px] of over) {
    if (k < FIT_MIN || !Number.isFinite(px)) b.classList.remove('fit1')
    else b.style.fontSize = `${(px * k * 0.98).toFixed(1)}px`
  }
}
