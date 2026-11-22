/**
 * 59-WIDE 넓은 맵을 그린다 (docs/realm/RAID-REWARD-MAP-20261122.md 4-2 · 4-4) — 그리기만 (판은 읽기만 한다 · 수치 HAEBI_WIDE.view).
 * 세 겹: ① 이어 깔리는 바닥(public/realm/raid/ground-<스테이지>.webp · tools/sprite-kit/ground-tile.py) ② 가운데 「결전장」 = 지금 스테이지 그림(가장자리를 바닥에 섞는다)
 * ③ 낱개 장식(HAEBI_WIDE.view.props · 그림이 오면 적는다). 그 위에 안개 문(닫히는 고리)과 화면 가장자리 화살표(정예 · 땅의 상자 · 결전장).
 * 보이는 것만 그린다: 바닥은 화면만큼만 칠하고, 결전장·안개·장식은 화면에 걸칠 때만.
 */
import { HAEBI_RUN as C, HAEBI_WIDE as WD } from '../tune/params.ts'
import type { HaebiRun } from './haebi.ts'
import { BOARD, type Rect } from './wide.ts'

const V = WD.view, TAU = Math.PI * 2
export const groundPath = (stage: string) => `raid/ground-${stage}.webp`
/** 처음에 받아 둘 바닥 그림 (스테이지 다섯) */
export const GROUND_PATHS = ['forest', 'ford', 'palisade', 'snow', 'fortress'].map(groundPath)

/** 화면에 걸치나 (화면 밖 pad 까지) — 몸·효과·알을 거를 때 */
export const inView = (view: Readonly<Rect>, x: number, y: number, pad: number = V.cull) => x >= view.left - pad && x <= view.right + pad && y >= view.top - pad && y <= view.bottom + pad

// ── 바닥 ──
/** 바닥 무늬 — 결전장 그림과 같은 배율로 한 번 줄이고 같은 어둠을 덮어 구워 둔다 (틀마다 큰 그림을 줄이지 않는다) */
let tile: { img: HTMLImageElement; ctx: CanvasRenderingContext2D; pattern: CanvasPattern | null } | null = null
function tilePattern(ctx: CanvasRenderingContext2D, img: HTMLImageElement): CanvasPattern | null {
  if (tile?.img === img && tile.ctx === ctx) return tile.pattern
  if (typeof document === 'undefined') return null   // 헤드리스 시험(node)
  const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(img.width * V.tileScale)); canvas.height = Math.max(1, Math.round(img.height * V.tileScale))
  const c = canvas.getContext('2d')!
  c.drawImage(img, 0, 0, canvas.width, canvas.height); c.fillStyle = '#11281b25'; c.fillRect(0, 0, canvas.width, canvas.height)
  tile = { img, ctx, pattern: ctx.createPattern(canvas, 'repeat') }
  return tile.pattern
}
/** 결전장 — 스테이지 그림을 판 높이에 맞추고(숨어 있던 옆 폭 bleed 까지) 네 가장자리를 투명하게 깎아 구워 둔다 */
let arena: { img: HTMLImageElement; canvas: HTMLCanvasElement; bleed: number } | null = null
function arenaCanvas(bg: HTMLImageElement) {
  if (arena?.img === bg) return arena
  if (typeof document === 'undefined') return null
  const W = C.width, H = C.height, full = bg.width * H / bg.height, bleed = Math.max(0, Math.min(V.bleed, Math.floor((full - W) / 2))), w = W + bleed * 2
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = H
  const c = canvas.getContext('2d')!, sw = bg.height * w / H
  c.drawImage(bg, (bg.width - sw) / 2, 0, sw, bg.height, 0, 0, w, H)
  c.fillStyle = '#11281b25'; c.fillRect(0, 0, w, H)
  c.globalCompositeOperation = 'destination-out'
  const fade = (x0: number, y0: number, x1: number, y1: number, x: number, y: number, fw: number, fh: number) => { const g = c.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, '#000f'); g.addColorStop(1, '#0000'); c.fillStyle = g; c.fillRect(x, y, fw, fh) }
  const f = V.feather
  fade(0, 0, f, 0, 0, 0, f, H); fade(w, 0, w - f, 0, w - f, 0, f, H); fade(0, 0, 0, f, 0, 0, w, f); fade(0, H, 0, H - f, 0, H - f, w, f)
  arena = { img: bg, canvas, bleed }
  return arena
}
/** 바닥과 결전장 — view 는 지금 화면(판 좌표) · 바닥 그림이 아직 없으면 스테이지 민무늬 색 */
export function drawWideGround(ctx: CanvasRenderingContext2D, images: Map<string, HTMLImageElement>, s: HaebiRun, bg: HTMLImageElement | undefined, view: Readonly<Rect>) {
  const x = Math.floor(view.left) - 2, y = Math.floor(view.top) - 2, w = Math.ceil(view.right - view.left) + 4, h = Math.ceil(view.bottom - view.top) + 4
  const img = images.get(groundPath(s.stage)), pattern = img ? tilePattern(ctx, img) : null
  ctx.fillStyle = pattern ?? V.base[s.stage]; ctx.fillRect(x, y, w, h)
  const a = bg ? arenaCanvas(bg) : null
  if (a) { if (view.right > -a.bleed && view.left < C.width + a.bleed && view.bottom > 0 && view.top < C.height) ctx.drawImage(a.canvas, -a.bleed, 0) }
  else if (bg && view.right > 0 && view.left < C.width && view.bottom > 0 && view.top < C.height) { const sw = bg.height * C.width / C.height; ctx.drawImage(bg, (bg.width - sw) / 2, 0, sw, bg.height, 0, 0, C.width, C.height) }
}
/** 이 스테이지의 낱개 장식 (위에서 아래로 그릴 차례에 끼운다 · 지금은 비어 있다) */
let propsOf: { stage: string; list: readonly (typeof V.props)[number][] } | null = null
export function wideProps(s: HaebiRun) { if (propsOf?.stage !== s.stage) propsOf = { stage: s.stage, list: V.props.filter(p => p.stage === s.stage) }; return propsOf.list }

// ── 안개 문 ──
/** 닫히는 고리 — 설 수 있는 땅 밖을 스테이지 빛 안개로 덮고, 안쪽으로 fogEdge 만큼 번진다 (땅 차례 · 몸보다 먼저 = 적이 안개에서 걸어 나온다) */
export function drawWideFog(ctx: CanvasRenderingContext2D, s: HaebiRun, view: Readonly<Rect>, time: number, low: boolean) {
  const w = s.wide; if (!w || w.gate <= 0) return
  const color = V.fog[s.stage], fade = Math.min(1, w.gate / V.fogFadeIn), alpha = fade * V.fogAlpha * (low ? 1 : 1 - V.fogPulseShare * (.5 + .5 * Math.sin(time * V.fogPulse)))
  const L = Math.floor(view.left) - 2, T = Math.floor(view.top) - 2, R = Math.ceil(view.right) + 2, B = Math.ceil(view.bottom) + 2
  ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color
  // 고리 밖 — 화면에서 고리 안을 뺀 길 하나로 한 번에 칠한다 (띠 넷으로 나누면 반 화소 걸친 이음매가 줄로 보인다)
  const x0 = Math.max(L, w.left), x1 = Math.min(R, w.right)
  if (w.left > L || w.right < R || w.top > T || w.bottom < B) { ctx.beginPath(); ctx.rect(L, T, R - L, B - T); ctx.rect(w.left, w.top, w.right - w.left, w.bottom - w.top); ctx.fill('evenodd') }
  // 안쪽으로 번지는 가장자리
  const e = V.fogEdge, y0 = Math.max(T, w.top), y1 = Math.min(B, w.bottom)
  const edge = (gx0: number, gy0: number, gx1: number, gy1: number, x: number, y: number, fw: number, fh: number) => { if (fw <= 0 || fh <= 0) return; const g = ctx.createLinearGradient(gx0, gy0, gx1, gy1); g.addColorStop(0, color); g.addColorStop(1, color + '00'); ctx.fillStyle = g; ctx.fillRect(x, y, fw, fh) }
  if (w.left + e > L && w.left < R) edge(w.left, 0, w.left + e, 0, w.left, y0, e, y1 - y0)
  if (w.right - e < R && w.right > L) edge(w.right, 0, w.right - e, 0, w.right - e, y0, e, y1 - y0)
  if (w.top + e > T && w.top < B) edge(0, w.top, 0, w.top + e, x0, w.top, x1 - x0, e)
  if (w.bottom - e < B && w.bottom > T) edge(0, w.bottom, 0, w.bottom - e, x0, w.bottom - e, x1 - x0, e)
  // 고리 끝의 밝은 줄 — 어디까지가 벽인지 한눈에
  const r = V.fogRim
  ctx.globalAlpha = fade * V.fogRimAlpha; ctx.fillStyle = '#ffffff'
  if (y1 > y0) { ctx.fillRect(w.left - r / 2, y0, r, y1 - y0); ctx.fillRect(w.right - r / 2, y0, r, y1 - y0) }
  if (x1 > x0) { ctx.fillRect(x0, w.top - r / 2, x1 - x0, r); ctx.fillRect(x0, w.bottom - r / 2, x1 - x0, r) }
  ctx.restore()
}

// ── 화면 가장자리 화살표 ──
export type ArrowKind = 'elite' | 'chest' | 'arena'
export interface EdgeArrow { kind: ArrowKind; x: number; y: number; angle: number }
const ARROWS: EdgeArrow[] = []
/**
 * 화면 밖의 정예 · 땅의 상자 · (안개 문이 닫히는 동안) 결전장을 가리키는 화살표 — 화면 좌표(판 크기 px). 화면 안에 보이는 것은 화살표가 없다.
 * 화면 가운데에서 그쪽으로 그은 줄이 안쪽 틀(HUD 를 피한 inset)과 만나는 자리에 놓는다. 가까운 것부터 max 개.
 */
export function edgeArrows(s: HaebiRun, cam: { zoom: number; x: number; y: number }): EdgeArrow[] {
  ARROWS.length = 0
  if (!s.wide || s.state !== 'playing') return ARROWS
  const A = V.arrow, W = C.width, H = C.height, z = cam.zoom
  const add = (kind: ArrowKind, tx: number, ty: number) => {
    const px = (tx - cam.x) * z + W / 2, py = (ty - cam.y) * z + H / 2
    if (px >= 0 && px <= W && py >= 0 && py <= H) return
    const dx = px - W / 2, dy = py - H / 2
    const k = Math.min(dx > 0 ? (W - A.inset - W / 2) / dx : dx < 0 ? (A.inset - W / 2) / dx : Infinity, dy > 0 ? (H - A.bottom - H / 2) / dy : dy < 0 ? (A.top - H / 2) / dy : Infinity)
    ARROWS.push({ kind, x: W / 2 + dx * k, y: H / 2 + dy * k, angle: Math.atan2(dy, dx) })
  }
  // 닫히는 동안 결전장 밖에 있으면 가운데로
  if (s.wide.gate > 0 && s.wide.gate < 1 && (s.x < BOARD.left || s.x > BOARD.right || s.y < BOARD.top || s.y > BOARD.bottom)) add('arena', W / 2, H / 2)
  for (const e of s.enemies) if (e.kind === 'elite' && e.hp > 0) add('elite', e.x, e.y - 30)
  for (const c of s.chests ?? []) if (c.state === 'ground') add('chest', c.x, c.y - 12)
  if (ARROWS.length > A.max) ARROWS.length = A.max
  return ARROWS
}
/** 화살표 하나: 색 테를 두른 둥근 판(그 안의 그림은 icon 이 그린다 · 글 없음) + 바깥쪽 화살촉 · 그쪽으로 까딱인다 */
export function drawEdgeArrows(ctx: CanvasRenderingContext2D, arrows: readonly EdgeArrow[], time: number, icon: (kind: ArrowKind, x: number, y: number, r: number) => void) {
  const A = V.arrow
  for (const a of arrows) {
    const bob = Math.sin(time * A.bobRate) * A.bob, cos = Math.cos(a.angle), sin = Math.sin(a.angle), x = a.x + cos * bob, y = a.y + sin * bob
    const color = a.kind === 'elite' ? A.foe : a.kind === 'chest' ? A.loot : A.arena
    ctx.save()
    ctx.fillStyle = A.rim + 'cc'; ctx.strokeStyle = color; ctx.lineWidth = 3
    ctx.beginPath(); ctx.arc(x, y, A.badge, 0, TAU); ctx.fill(); ctx.stroke()
    // 화살촉: 판 바깥에서 그쪽으로
    const tip = A.badge + A.size, bx = x + cos * (A.badge + 3), by = y + sin * (A.badge + 3), half = A.size * .62
    ctx.fillStyle = color; ctx.strokeStyle = A.rim; ctx.lineWidth = 2; ctx.lineJoin = 'round'
    ctx.beginPath(); ctx.moveTo(x + cos * tip, y + sin * tip); ctx.lineTo(bx - sin * half, by + cos * half); ctx.lineTo(bx + sin * half, by - cos * half); ctx.closePath(); ctx.fill(); ctx.stroke()
    ctx.beginPath(); ctx.arc(x, y, A.badge - 2, 0, TAU); ctx.clip()
    icon(a.kind, x, y, A.badge - 2)
    ctx.restore()
  }
}
