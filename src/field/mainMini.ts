/**
 * 미니맵 — 싸우는 동안(준비 화면 포함) 오른쪽 위 「다시」 아래에 늘 떠 있는 판 전체 그림.
 * VModel 과 카메라를 읽기만 한다 (sim 을 모른다). 바닥은 한 번 구워 두고 매 프레임 그 위에 대·장수·카메라 상자만 올린다.
 * 누르거나 끌면 그 자리로 카메라가 간다 (onPan) — 돌아오는 것은 field-main 의 몫.
 */
import { P } from '../tune/params.ts'
import { fieldView, type Cam, type Viewport } from './viewCamera.ts'
import type { VModel } from './viewRead.ts'
import { G_HIGH } from './types.ts'

export interface Mini {
  /** tags: 시험판의 우리 무리 키 번호 (판 단위 자리 · 덩어리 곁에 숫자) */
  sync(m: VModel, cam: Cam, vp: Viewport, show: boolean, nowMs: number, tags?: readonly { u: number; v: number; label: string }[]): void
}
/** onOrder: 시험판의 오른쪽 누름 — 고른 무리를 그 자리(판 px)로 (chain = Shift 로 길 잇기) */
export interface MiniHandlers { onPan(x: number, y: number): void; onOrder?: ((x: number, y: number, chain: boolean) => void) | undefined }

const GROUND = ['#b49560', '#7aa6b8', '#35607f', '#4a4036', '#dcc583', '#56703c', '#6e5232', '#dbe8f0'] as const
/** 높은 터의 가장자리 줄 (미니맵에서 언덕이 어디서 시작하는지) */
const HIGH_EDGE = '#3a2a12'
const MINE = '#2f8cff', FOE = '#d6483a', GOLD = '#ffd27a'
const CSS = `
#fd-mini{position:absolute;right:calc(8px + env(safe-area-inset-right));top:calc(58px + env(safe-area-inset-top));z-index:3;border:1px solid #fff5;border-radius:6px;background:#000a;overflow:hidden;touch-action:none;opacity:.92}
#fd-mini[hidden]{display:none}
#fd-mini canvas{display:block}
`

export function mountMini(root: HTMLElement, h: MiniHandlers): Mini {
  const style = document.createElement('style')
  style.textContent = CSS
  document.head.append(style)
  const box = document.createElement('div')
  box.id = 'fd-mini'; box.hidden = true
  const cv = document.createElement('canvas')
  box.append(cv)
  root.append(box)
  const g = cv.getContext('2d') as CanvasRenderingContext2D
  let cw = 0, chh = 0, dprUsed = 0
  /** 구워 둔 바닥 (판이 바뀌면 다시) */
  let ground: HTMLCanvasElement | null = null, groundFor: Readonly<Uint8Array> | null = null, groundKey = ''
  /** 지금 판 → 상자 안 배율과 놓인 자리 */
  let sc = 1, ox = 0, oy = 0, worldW = 1, worldH = 1
  /** 살아 있는 적의 큰 수 예고: 길(판 px)과 뜬 시각 */
  let omen: { pts: { x: number; y: number }[]; at: number } | null = null
  let down = false
  const toWorld = (ev: PointerEvent): { x: number; y: number } => {
    const r = cv.getBoundingClientRect()
    return { x: (ev.clientX - r.left - ox) / sc, y: (ev.clientY - r.top - oy) / sc }
  }
  const pan = (ev: PointerEvent): void => { const w = toWorld(ev); h.onPan(Math.max(0, Math.min(worldW, w.x)), Math.max(0, Math.min(worldH, w.y))) }
  cv.addEventListener('pointerdown', ev => {
    ev.preventDefault(); ev.stopPropagation()
    if (ev.button === 2 && h.onOrder !== undefined) { const w = toWorld(ev); h.onOrder(Math.max(0, Math.min(worldW, w.x)), Math.max(0, Math.min(worldH, w.y)), ev.shiftKey); return }
    down = true; try { cv.setPointerCapture(ev.pointerId) } catch { /* 합성 입력 */ } pan(ev)
  })
  cv.addEventListener('contextmenu', ev => ev.preventDefault())
  cv.addEventListener('pointermove', ev => { if (down) pan(ev) })
  const up = (): void => { down = false }
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up)

  function layout(m: VModel): void {
    const F = P.field
    const phone = root.classList.contains('touch')
    const bw = phone ? F.miniPhoneW : F.miniW, bh = phone ? F.miniPhoneH : F.miniH
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    worldW = m.mapU * F.cellPx; worldH = m.mapW * F.cellPx
    sc = Math.min(bw / worldW, bh / worldH)
    const w = Math.round(worldW * sc), hh = Math.round(worldH * sc)
    if (w !== cw || hh !== chh || dpr !== dprUsed) {
      cw = w; chh = hh; dprUsed = dpr
      cv.width = Math.round(w * dpr); cv.height = Math.round(hh * dpr)
      cv.style.width = `${w}px`; cv.style.height = `${hh}px`
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      ground = null
    }
    ox = 0; oy = 0
    root.style.setProperty('--fd-miniw', `${w}px`)
  }
  function bake(m: VModel): void {
    const key = `${m.rule}|${m.mapU}|${m.mapW}|${cw}`
    if (ground !== null && groundFor === m.cells && groundKey === key) return
    const c = document.createElement('canvas')
    c.width = Math.max(1, cw); c.height = Math.max(1, chh)
    const x = c.getContext('2d') as CanvasRenderingContext2D
    const cs = worldW / m.mapU * sc, rs = worldH / m.mapW * sc
    for (let cu = 0; cu < m.mapU; cu++) for (let cv2 = 0; cv2 < m.mapW; cv2++) {
      x.fillStyle = GROUND[m.cells[cu * m.mapW + cv2] ?? 0] ?? GROUND[0]
      x.fillRect(Math.floor(cu * cs), Math.floor(cv2 * rs), Math.ceil(cs) + 1, Math.ceil(rs) + 1)
    }
    // 높은 터 가장자리: 옆이 낮은 칸이면 그쪽 변에 어두운 줄
    x.fillStyle = HIGH_EDGE
    const hi = (cu: number, cv2: number): boolean => cu < 0 || cv2 < 0 || cu >= m.mapU || cv2 >= m.mapW ? true : m.cells[cu * m.mapW + cv2] === G_HIGH
    for (let cu = 0; cu < m.mapU; cu++) for (let cv2 = 0; cv2 < m.mapW; cv2++) {
      if (m.cells[cu * m.mapW + cv2] !== G_HIGH) continue
      const X = Math.floor(cu * cs), Y = Math.floor(cv2 * rs)
      if (!hi(cu - 1, cv2)) x.fillRect(X, Y, 2, Math.ceil(rs) + 1)
      if (!hi(cu + 1, cv2)) x.fillRect(X + Math.ceil(cs) - 1, Y, 2, Math.ceil(rs) + 1)
      if (!hi(cu, cv2 - 1)) x.fillRect(X, Y, Math.ceil(cs) + 1, 2)
      if (!hi(cu, cv2 + 1)) x.fillRect(X, Y + Math.ceil(rs) - 1, Math.ceil(cs) + 1, 2)
    }
    ground = c; groundFor = m.cells; groundKey = key
  }
  const px = (u: number): number => u / P.field.unit * P.field.cellPx * sc
  return {
    sync(m, cam, vp, show, nowMs, tags) {
      if (box.hidden === show) box.hidden = !show
      if (!show) { root.style.setProperty('--fd-miniw', '0px'); return }
      const F = P.field
      layout(m); bake(m)
      for (const e of m.events) if (e.kind === 'omen' && e.side === 1 && e.pts.length >= 2) { omen = { pts: e.pts.map(p => ({ x: px(p.u), y: px(p.v) })), at: nowMs } }
      if (omen !== null && nowMs - omen.at > F.omenMs) omen = null
      g.clearRect(0, 0, cw, chh)
      if (ground !== null) g.drawImage(ground, 0, 0, cw, chh)
      // 대: 사람 수에 비례하는 덩어리 (달아나는 대는 흐리게)
      let maxMen = 1
      for (const q of m.squads) if (q.menMax > maxMen) maxMen = q.menMax
      for (const q of m.squads) {
        if (q.men <= 0) continue
        const r = F.miniBlobMinPx + (F.miniBlobMaxPx - F.miniBlobMinPx) * Math.sqrt(q.men / maxMen)
        g.globalAlpha = q.flee === 1 ? 0.35 : 0.95
        g.fillStyle = q.side === 0 ? MINE : FOE
        g.beginPath(); g.arc(px(q.u), px(q.v), r, 0, Math.PI * 2); g.fill()
      }
      g.globalAlpha = 1
      // 적의 큰 수 예고: 올 길 위의 붉은 화살표
      if (omen !== null) {
        g.strokeStyle = '#ff3b2a'; g.fillStyle = '#ff3b2a'; g.lineWidth = 2; g.lineJoin = 'round'
        g.beginPath(); omen.pts.forEach((p, i) => { if (i === 0) g.moveTo(p.x, p.y); else g.lineTo(p.x, p.y) }); g.stroke()
        const a = omen.pts[omen.pts.length - 2]!, b = omen.pts[omen.pts.length - 1]!, ang = Math.atan2(b.y - a.y, b.x - a.x), s = F.miniArrowPx
        g.beginPath(); g.moveTo(b.x, b.y); g.lineTo(b.x - Math.cos(ang - 0.5) * s, b.y - Math.sin(ang - 0.5) * s); g.lineTo(b.x - Math.cos(ang + 0.5) * s, b.y - Math.sin(ang + 0.5) * s); g.closePath(); g.fill()
      }
      // 장수: 우리는 금빛 점과 테 · 적장은 붉은 점
      for (const e of m.heroes) {
        const x = px(e.u), y = px(e.v)
        g.fillStyle = e.side === 0 ? GOLD : FOE
        g.beginPath(); g.arc(x, y, F.miniHeroPx, 0, Math.PI * 2); g.fill()
        if (e.side === 0) { g.strokeStyle = GOLD; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, F.miniHeroPx + 3, 0, Math.PI * 2); g.stroke() }
      }
      // 원군 예고 (실험실): 들어설 자리에 그 편 색 세모 + 남은 초 (아직 안 부른 원군은 안 보인다)
      for (const r of m.reinf) {
        if (r.done || r.tick < 0) continue
        const x = px(r.u), y = px(r.v), s = F.miniArrowPx, left = Math.max(0, Math.ceil((r.tick - m.tick) / F.hz))
        g.fillStyle = r.side === 0 ? MINE : FOE; g.strokeStyle = '#000'; g.lineWidth = 1
        g.beginPath(); g.moveTo(x, y - s); g.lineTo(x + s, y + s * 0.7); g.lineTo(x - s, y + s * 0.7); g.closePath(); g.fill(); g.stroke()
        g.font = 'bold 11px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'bottom'; g.fillStyle = '#fff'
        g.fillText(String(left), x, y - s - 1)
      }
      // 시험판: 우리 무리 키 번호 (덩어리 곁 · 검은 테 흰 숫자)
      if (tags !== undefined && tags.length > 0) {
        g.font = 'bold 11px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 3; g.strokeStyle = '#000'; g.fillStyle = '#fff'
        for (const k of tags) { const x = px(k.u) - 7, y = px(k.v); g.strokeText(k.label, x, y); g.fillText(k.label, x, y) }
      }
      // 카메라가 보는 곳: 가는 흰 상자
      const v = fieldView(cam, vp)
      g.strokeStyle = '#fff'; g.lineWidth = 1
      g.strokeRect(Math.max(0, v.left * sc) + 0.5, Math.max(0, v.top * sc) + 0.5, Math.min(cw, v.right * sc) - Math.max(0, v.left * sc) - 1, Math.min(chh, v.bottom * sc) - Math.max(0, v.top * sc) - 1)
    },
  }
}
