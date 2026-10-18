/**
 * 지도 확대·축소·끌기 (형: "가로화면 플레이 할때 지도 너무 작은거 아냐? 확대하고 축소하고 이럴수 있어야할듯" — 2026-10-18)
 *
 * 배율 z 는 "지도 높이 = 칸 높이" 를 1 로 친다. 처음엔 칸을 가로로도 꽉 채우는 배율(cover)로 연다 — 가로 화면에서 옆이 비지 않게.
 * 손가락 둘로 벌리기 · 마우스 휠 · ＋/－ 단추로 키우고, 끌어서 옮긴다 (터치는 브라우저 스크롤, 마우스는 여기서).
 * 루프·타이머 없이 이벤트에서 바로 바꾼다 (절대 규칙 4). 지도 칸을 다시 그려도 `apply` 로 배율이 이어진다.
 */

/** 지도 바탕 그림의 가로:세로 (mapview 의 W / H) */
const ASPECT = 1264 / 848
/** cover 배율에 곱해 가장 크게 · 한 단추에 키우는 몫 · 끌기로 치는 거리(px) */
const MAX_OVER_COVER = 2.2
const STEP = 1.35
const DRAG_PX = 6

export interface MapZoom {
  /** 다시 그린 지도에 지금 배율을 입힌다 */
  apply(): void
  /** ＋/－ — 칸 가운데를 축으로 */
  step(dir: 1 | -1): void
  /** 방금 끌었으면 참 — 그 손짓의 click 은 고을 누르기가 아니다 */
  dragged(): boolean
}

export function attachZoom(wrap: HTMLElement): MapZoom {
  let z = 0 // 0 = 아직 안 정함 — 처음 apply 때 cover 로
  let moved = false

  const cover = (): number => Math.max(1, wrap.clientWidth / (wrap.clientHeight * ASPECT))
  const clamp = (v: number): number => Math.min(cover() * MAX_OVER_COVER, Math.max(1, v))
  const map = (): HTMLElement | null => wrap.querySelector<HTMLElement>('.map')

  function paintZ(): void {
    const m = map()
    if (m === null) return
    m.style.height = `${z * 100}%`
    // 글씨는 배율의 제곱근만큼 — 크게 보면 조금 커지되 고을 그림만큼 부풀지 않게
    m.style.setProperty('--z', String(z))
    m.style.setProperty('--zs', String(Math.sqrt(z)))
  }

  /** (cx, cy) 칸 안의 점을 축으로 배율을 바꾼다 — 그 점 아래 땅이 손가락 밑에 남는다 */
  function zoomAt(next: number, cx: number, cy: number): void {
    const n = clamp(next)
    if (n === z) return
    const k = n / z
    const sx = (wrap.scrollLeft + cx) * k - cx
    const sy = (wrap.scrollTop + cy) * k - cy
    z = n
    paintZ()
    wrap.scrollLeft = sx
    wrap.scrollTop = sy
  }

  wrap.addEventListener('wheel', (ev) => {
    if (map() === null) return
    ev.preventDefault()
    const rect = wrap.getBoundingClientRect()
    zoomAt(z * Math.exp(-ev.deltaY * 0.0015), ev.clientX - rect.left, ev.clientY - rect.top)
  }, { passive: false })

  // 손가락 둘 — 벌린 만큼
  let pinch: { d: number; z: number } | null = null
  const dist = (t: TouchList): number => Math.hypot(t[0]!.clientX - t[1]!.clientX, t[0]!.clientY - t[1]!.clientY)
  wrap.addEventListener('touchstart', (ev) => {
    if (ev.touches.length === 2) pinch = { d: dist(ev.touches), z }
  }, { passive: true })
  wrap.addEventListener('touchmove', (ev) => {
    if (pinch === null || ev.touches.length !== 2) return
    ev.preventDefault()
    const rect = wrap.getBoundingClientRect()
    const cx = (ev.touches[0]!.clientX + ev.touches[1]!.clientX) / 2 - rect.left
    const cy = (ev.touches[0]!.clientY + ev.touches[1]!.clientY) / 2 - rect.top
    moved = true
    zoomAt(pinch.z * (dist(ev.touches) / pinch.d), cx, cy)
  }, { passive: false })
  wrap.addEventListener('touchend', (ev) => {
    if (ev.touches.length < 2) pinch = null
  }, { passive: true })

  // 마우스로 끌기 — 터치는 브라우저가 스크롤한다
  let drag: { x: number; y: number; sl: number; st: number } | null = null
  wrap.addEventListener('pointerdown', (ev) => {
    moved = false
    if (ev.pointerType !== 'mouse' || ev.button !== 0) return
    drag = { x: ev.clientX, y: ev.clientY, sl: wrap.scrollLeft, st: wrap.scrollTop }
  })
  wrap.addEventListener('pointermove', (ev) => {
    if (drag === null) return
    const dx = ev.clientX - drag.x
    const dy = ev.clientY - drag.y
    if (!moved && Math.hypot(dx, dy) < DRAG_PX) return
    moved = true
    wrap.classList.add('dragging')
    wrap.scrollLeft = drag.sl - dx
    wrap.scrollTop = drag.st - dy
  })
  const end = (): void => {
    drag = null
    wrap.classList.remove('dragging')
  }
  wrap.addEventListener('pointerup', end)
  wrap.addEventListener('pointerleave', end)

  return {
    apply() {
      if (z === 0) z = cover()
      z = clamp(z)
      paintZ()
    },
    step(dir) {
      zoomAt(dir > 0 ? z * STEP : z / STEP, wrap.clientWidth / 2, wrap.clientHeight / 2)
    },
    dragged: () => moved,
  }
}
