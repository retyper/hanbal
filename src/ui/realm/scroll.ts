/**
 * 안쪽만 굴린다 — `scrollIntoView` 는 그 요소를 담은 상자만이 아니라 **페이지 전체까지** 굴린다.
 * 전체화면을 끈 뒤로는 그 바람에 판 전체가 위로 밀려 붙박이 위 카드가 잘렸다
 * (형 10-24: "전투 승리할 때 가끔 상단 고정 카드가 화면 바깥으로 밀려 올라가 위가 잘린다").
 * 그래서 가장 가까운 굴러가는 상자 하나만 굴린다. scroll-margin-top 은 지킨다 (붙박이 카드 아래로).
 */
export type Block = 'start' | 'center' | 'nearest'

/** 굴러가는 가장 가까운 상자 — 없으면 null (페이지는 굴리지 않는다) */
function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p !== null && p !== document.body; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY
    if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight) return p
  }
  return null
}

export function scrollInside(el: Element | null | undefined, block: Block = 'nearest', smooth = false): void {
  if (!(el instanceof HTMLElement)) return
  const box = scrollParent(el)
  if (box === null) return
  const er = el.getBoundingClientRect()
  const br = box.getBoundingClientRect()
  const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0
  const rel = er.top - br.top + box.scrollTop
  let top: number
  if (block === 'start') top = rel - margin
  else if (block === 'center') top = rel - (box.clientHeight - er.height) / 2
  else {
    if (er.top >= br.top + margin && er.bottom <= br.bottom) return
    top = er.top < br.top + margin ? rel - margin : rel - box.clientHeight + er.height
  }
  box.scrollTo({ top: Math.max(0, top), behavior: smooth ? 'smooth' : 'auto' })
}

/** 페이지는 굴러가지 않는다 — 무엇이 밀어 올려도(입력칸·옛 scrollIntoView) 바로 제자리로 */
export function pinPage(): void {
  const fix = (): void => { if (window.scrollY !== 0 || window.scrollX !== 0) window.scrollTo(0, 0) }
  window.addEventListener('scroll', fix, { passive: true })
}
