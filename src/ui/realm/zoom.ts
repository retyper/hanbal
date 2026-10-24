/**
 * 지도 확대·축소·끌기 (형: "가로화면 플레이 할때 지도 너무 작은거 아냐? 확대하고 축소하고 이럴수 있어야할듯" — 2026-10-18)
 *
 * 배율 z 는 "지도 높이 = 칸 높이" 를 1 로 친다. 처음엔 칸을 가로로도 꽉 채우는 배율(cover)로 연다 — 가로 화면에서 옆이 비지 않게.
 * 손가락 둘로 벌리기 · 마우스 휠 · ＋/－ 단추로 키우고, 끌어서 옮긴다 (터치는 브라우저 스크롤, 마우스는 여기서).
 * 루프·타이머 없이 이벤트에서 바로 바꾼다 (절대 규칙 4). 지도 칸을 다시 그려도 `apply` 로 배율이 이어진다.
 *
 * 손을 움직이는 동안(휠·두 손가락)은 지도를 GPU 로만 늘린다(transform) — 높이를 바꾸면 고을·그림·물결 필터가 통째로 다시 배치돼 버벅인다
 * (형 10-24: "맵 확대 축소할 때 버벅거리지 않게"). 손을 떼면(휠은 COMMIT_MS 쉬면) 한 번만 진짜 배율로 굳힌다.
 */

import { declutterSoon } from './declutter.ts'

/** 지도 바탕 그림의 가로:세로 (mapview 의 W / H) */
const ASPECT = 1264 / 848
/** cover 배율에 곱해 가장 크게 · 한 단추에 키우는 몫 · 끌기로 치는 거리(px) */
const MAX_OVER_COVER = 2.2
const STEP = 1.35
const DRAG_PX = 6
/** 밝혀진 땅 둘레에 두는 여백 (지도 너비·높이의 몫) */
const SEEN_PAD = 0.07

export interface MapZoom {
  /** 다시 그린 지도에 지금 배율을 입힌다 */
  apply(): void
  /** ＋/－ — 칸 가운데를 축으로 */
  step(dir: 1 | -1): void
  /** 방금 끌었으면 참 — 그 손짓의 click 은 고을 누르기가 아니다 */
  dragged(): boolean
}

/** 끈 뒤 이만큼 안의 click 만 끌기의 끝으로 본다 (ms) — 화면의 손짓이라 params 가 아니라 여기 */
const DRAG_HOLD_MS = 500
/** 휠이 이만큼 쉬면 늘린 그림을 진짜 배율로 굳힌다 (ms) */
const COMMIT_MS = 160

export function attachZoom(wrap: HTMLElement): MapZoom {
  let z = 0 // 0 = 아직 안 정함 — 처음 apply 때 cover 로
  /** 배율을 정한 판 — 새 판(다른 비율)을 열면 cover 부터 다시 */
  let zFor = ''
  let moved = false
  /** 마지막으로 끈 때 — 끈 뒤 잠깐만 "끌었다"로 친다 (끌기가 남아 다음 누르기를 삼키지 않게) */
  let movedAt = 0

  // 판마다 지도 비율·가장 큰 배율이 다르다 (영남 판은 고을이 빽빽해 더 크게 본다) — mapview 가 data-aspect · data-zmax 로 단다
  const aspect = (): number => Number(map()?.dataset["aspect"]) || ASPECT
  const maxOver = (): number => Number(map()?.dataset["zmax"]) || MAX_OVER_COVER
  const cover = (): number => Math.max(1, wrap.clientWidth / (wrap.clientHeight * aspect()))
  /**
   * 가장 작게 볼 배율 — 밝혀진 땅(mapview 의 data-seen)이 칸을 채우는 데까지만 줄인다
   * (형: "지도크기도 문명처럼 유저가 보이는 구역을 기반으로 최대 축소 가능한 정도를 조절"). 땅이 넓어지면 더 줄일 수 있다.
   */
  const minZ = (): number => {
    const b = (map()?.dataset["seen"] ?? "0,0,1,1").split(",").map(Number)
    const bw = Math.min(1, (b[2]! - b[0]!) + 2 * SEEN_PAD)
    const bh = Math.min(1, (b[3]! - b[1]!) + 2 * SEEN_PAD)
    const fit = Math.min(wrap.clientWidth / (bw * wrap.clientHeight * aspect()), 1 / bh)
    // 칸보다 작게는 안 줄인다 (옆이 까맣게 비지 않게)
    return Math.max(cover(), Math.min(fit, cover() * maxOver() * 0.8))
  }
  const clamp = (v: number): number => Math.min(cover() * maxOver(), Math.max(minZ(), v))
  const map = (): HTMLElement | null => wrap.querySelector<HTMLElement>('.map')

  function paintZ(): void {
    const m = map()
    if (m === null) return
    m.style.height = `${z * 100}%`
    // 글씨는 배율의 제곱근만큼 — 크게 보면 조금 커지되 고을 그림만큼 부풀지 않게
    m.style.setProperty('--z', String(z))
    m.style.setProperty('--zs', String(Math.sqrt(z)))
    // 멀리 볼 때는 배너의 둘째 줄(지금 땅이름)을 감춘다 — 글씨가 고을을 덮지 않게 (GAP M1)
    m.dataset['zl'] = z >= cover() * 1.45 ? 'near' : 'far'
    declutterSoon(wrap) // 배율이 바뀌면 글씨가 말·숫자와 겹칠 수 있다 — 그린 뒤 비킨다
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

  /**
   * 손짓 하나 — 시작한 점(cx0, cy0 · 칸 안)을 축으로 s 배 늘리고 (tx, ty) 만큼 옮겨 보인다. 높이·스크롤은 아직 그대로다
   */
  let live: { s: number; cx0: number; cy0: number; sl0: number; st0: number; tx: number; ty: number } | null = null
  let commitTimer = 0
  const liveStart = (cx: number, cy: number): void => {
    if (live !== null) return
    live = { s: 1, cx0: cx, cy0: cy, sl0: wrap.scrollLeft, st0: wrap.scrollTop, tx: 0, ty: 0 }
    const m = map()
    if (m !== null) { m.style.transformOrigin = `${live.sl0 + cx}px ${live.st0 + cy}px`; m.style.willChange = 'transform' }
  }
  const liveSet = (s: number, tx: number, ty: number): void => {
    if (live === null) return
    live.s = clamp(z * s) / z
    live.tx = tx
    live.ty = ty
    const m = map()
    if (m !== null) m.style.transform = `translate(${tx}px, ${ty}px) scale(${live.s})`
  }
  /** 늘린 그림을 진짜 배율로 — 축이던 땅이 손 밑에 그대로 남게 스크롤을 맞춘다 */
  const commit = (): void => {
    window.clearTimeout(commitTimer)
    const g = live
    live = null
    const m = map()
    if (m !== null) { m.style.transform = ''; m.style.transformOrigin = ''; m.style.willChange = '' }
    if (g === null || g.s === 1) return
    z = clamp(z * g.s)
    paintZ()
    wrap.scrollLeft = (g.sl0 + g.cx0) * g.s - (g.cx0 + g.tx)
    wrap.scrollTop = (g.st0 + g.cy0) * g.s - (g.cy0 + g.ty)
  }

  wrap.addEventListener('wheel', (ev) => {
    if (map() === null) return
    ev.preventDefault()
    const rect = wrap.getBoundingClientRect()
    liveStart(ev.clientX - rect.left, ev.clientY - rect.top)
    if (live !== null) liveSet(live.s * Math.exp(-ev.deltaY * 0.0015), 0, 0)
    window.clearTimeout(commitTimer)
    commitTimer = window.setTimeout(commit, COMMIT_MS)
  }, { passive: false })

  // 손가락 둘 — 벌린 만큼 (손가락 사이 가운데가 움직이면 지도도 따라 옮긴다)
  let pinch: { d: number } | null = null
  const dist = (t: TouchList): number => Math.hypot(t[0]!.clientX - t[1]!.clientX, t[0]!.clientY - t[1]!.clientY)
  const mid = (t: TouchList): readonly [number, number] => {
    const rect = wrap.getBoundingClientRect()
    return [(t[0]!.clientX + t[1]!.clientX) / 2 - rect.left, (t[0]!.clientY + t[1]!.clientY) / 2 - rect.top]
  }
  wrap.addEventListener('touchstart', (ev) => {
    if (ev.touches.length !== 2) return
    commit()
    pinch = { d: dist(ev.touches) }
    const [cx, cy] = mid(ev.touches)
    liveStart(cx, cy)
  }, { passive: true })
  wrap.addEventListener('touchmove', (ev) => {
    if (pinch === null || live === null || ev.touches.length !== 2) return
    ev.preventDefault()
    const [cx, cy] = mid(ev.touches)
    moved = true
    movedAt = performance.now()
    liveSet(dist(ev.touches) / pinch.d, cx - live.cx0, cy - live.cy0)
  }, { passive: false })
  const pinchEnd = (ev: TouchEvent): void => {
    if (ev.touches.length >= 2 || pinch === null) return
    pinch = null
    commit()
  }
  wrap.addEventListener('touchend', pinchEnd, { passive: true })
  wrap.addEventListener('touchcancel', pinchEnd, { passive: true })

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
    movedAt = performance.now()
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
      // 손짓 도중 지도를 다시 그렸으면 늘리던 것은 버린다 (새 지도엔 transform 이 없다)
      if (live !== null) { window.clearTimeout(commitTimer); live = null }
      const region = map()?.dataset["region"] ?? ''
      if (z === 0 || region !== zFor) z = Math.max(cover(), minZ())
      zFor = region
      z = clamp(z)
      paintZ()
    },
    step(dir) {
      commit()
      zoomAt(dir > 0 ? z * STEP : z / STEP, wrap.clientWidth / 2, wrap.clientHeight / 2)
    },
    dragged: () => moved && performance.now() - movedAt < DRAG_HOLD_MS,
  }
}
