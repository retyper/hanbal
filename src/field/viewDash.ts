/**
 * 장수 내닫기 그림 (51 §6 · 열전의 대시 칸 한 장): 내닫는 동안(dash) 그 장수의 대시 칸(public/realm/anim-px/dash/gen-<띠 열쇠>.png)을
 * 서기와 같은 배율로 발 자리에 그리고 · 잔상 두세 장 · 발밑 흙먼지. 대시 칸이 없는 장수는 옛 그림 그대로.
 * 표(src/raid/dash-cells.ts)와 열전의 그리기 값(HAEBI_DASH: 발 내림 · 가로 늘임 · 잔상 옅기)은 읽기만 한다.
 */
import { P, HAEBI_DASH as DASH } from '../tune/params.ts'
import { DASH_CELLS } from '../raid/dash-cells.ts'
import { spawn } from './viewMelee.ts'

const imgs = new Map<string, HTMLImageElement | null>()
function dashImg(base: string, name: string): HTMLImageElement | null {
  const key = `${base}anim-px/dash/gen-${name}.png`
  let i = imgs.get(key)
  if (i === undefined) {
    if (!(name in DASH_CELLS)) { imgs.set(key, null); return null }
    i = new Image(); i.decoding = 'async'; i.src = key
    imgs.set(key, i)
  }
  return i !== null && i.complete && i.naturalWidth > 0 ? i : null
}

interface Ghost { x: number; y: number; flip: boolean; at: number }
const ghosts: Ghost[] = []
let ghostAt = -1e9, dustAt = -1e9
let cur: { img: HTMLImageElement; x: number; y: number; flip: boolean; k: number } | null = null
const ghostK = new Map<string, number>()
let gk = 1, gImg: HTMLImageElement | null = null

export function resetDash(): void { ghosts.length = 0; ghostAt = -1e9; dustAt = -1e9; cur = null }

/**
 * 내닫는 장수 하나를 올린다 — 대시 칸이 있으면 true (부른 쪽은 서기 그림을 안 그린다).
 * name 은 띠 열쇠에서 gen- 을 뺀 것 · bodyH 는 서기 그림 몸 키(px) · bodyPx 는 manifest 의 몸 키
 */
export function queueDash(base: string, name: string, x: number, y: number, flip: boolean, bodyH: number, bodyPx: number, nowMs: number): boolean {
  const img = dashImg(base, name)
  if (img === null) return false
  const k = bodyH / bodyPx * DASH_CELLS[name]!
  gImg = img; gk = k
  cur = { img, x, y, flip, k }
  if (nowMs - ghostAt >= P.field.dashGhostMs) { ghostAt = nowMs; ghosts.push({ x, y, flip, at: nowMs }) }
  if (nowMs - dustAt >= P.field.dashGhostMs) {
    dustAt = nowMs
    const dir = flip ? 1 : -1
    for (let i = 0; i < DASH.dust; i++) spawn(0, x + dir * DASH.dustDist * k * (0.3 + 0.2 * i), y - 2 + Math.sin((i + 1) * 2.1) * 4, dir * 10, -6, nowMs, P.field.runDustLife, DASH.dustSize * k * 0.8)
  }
  ghostK.clear()
  return true
}

function place(c: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, flip: boolean, k: number, stretch: number): void {
  const face = flip ? -1 : 1, g = DASH.geom
  const tx = Math.round(x), ty = Math.round(y + DASH.drop * k)
  const sm = c.imageSmoothingEnabled; c.imageSmoothingEnabled = false
  c.translate(tx, ty); c.scale(face * stretch, 1)
  c.drawImage(img, Math.round(-g.root * k), Math.round(-g.foot * k), Math.round(img.naturalWidth * k), Math.round(g.h * k))
  c.scale(face * stretch, 1); c.translate(-tx, -ty); c.imageSmoothingEnabled = sm
}

/** 잔상(옅어지는 대시 칸) 다음 지금 대시 칸 — 그 프레임에 올린 것이 없으면 잔상만 마저 걷힌다 */
export function drawDash(c: CanvasRenderingContext2D, nowMs: number): void {
  const F = P.field
  let w = 0
  for (const g of ghosts) if (nowMs - g.at < F.dashGhostLifeMs) ghosts[w++] = g
  ghosts.length = Math.min(w, F.dashGhostMax)
  const img = cur?.img ?? gImg
  if (img !== null) {
    const a = c.globalAlpha
    for (const g of ghosts) {
      const t = 1 - (nowMs - g.at) / F.dashGhostLifeMs
      if (t <= 0 || nowMs - g.at < 1) continue
      c.globalAlpha = a * DASH.ghostAlpha * t * t
      place(c, img, g.x, g.y, g.flip, gk, 1)
    }
    c.globalAlpha = a
  }
  if (cur !== null) place(c, cur.img, cur.x, cur.y, cur.flip, cur.k, DASH.stretch)
  cur = null
}
