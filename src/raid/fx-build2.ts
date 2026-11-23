/**
 * 67-BUILD2 설치물 그림 — 장승 · 솟대 · 봉수대 · 포차 · 우물 (판은 읽기만 한다 · 시계는 판 시각 s.t · 수치는 HAEBI_BUILD2.view).
 * 그림은 있는 것을 빌린다: 장승 = 설원 장식 장승(snow-3) · 솟대 = 본편 길 아이콘 솟대 · 봉수대 = 목책 판 화톳대(palisade-5) · 포차 잔해 = 산성 판 부서진 수레(fortress-5).
 * 포차·우물은 맞는 그림이 없어 캔버스로 그린다 (전용 그림은 Codex 주문 거리).
 * 땅 차례(drawBuild2Ground): 솟대 둘레 고리 · 우물 둘레 고리 · 혼줄 · 봉수대 화살비가 떨어질 금빛 표식.
 */
import { HAEBI_BUILD as B, HAEBI_BUILD2 as B2 } from '../tune/params.ts'
import type { HaebiRun, Missile } from './haebi.ts'
import { sotdaeRadius, wellRadius, totemLinks, standing, type Structure } from './build.ts'

const V = B2.view
const ART = { totem: 'raid/props/snow-3.webp', sotdae: 'icon/route-sotdae.png', beacon: 'raid/props/palisade-5.webp', rubble: 'raid/props/fortress-5.webp' } as const
/** 미리 받아 둘 그림 — 장승·봉수대·수레는 넓은 맵 장식(PROP_PATHS)에 이미 있어 솟대 아이콘만 */
export const BUILD2_PATHS = [ART.sotdae]
const ROCK = 'fx/rock.png'

/** 쏜 순간(cd 가 다시 찬 때)을 화면 쪽에서 기억한다 — 봉수대 연기 · 포차 팔 */
const lastCd = new WeakMap<Structure, number>(), firedAt = new WeakMap<Structure, number>()
function fired(s: HaebiRun, it: Structure) {
  const last = lastCd.get(it)
  if (last !== undefined && it.cd > last + 1e-6) firedAt.set(it, s.t)
  lastCd.set(it, it.cd)
  const at = firedAt.get(it)
  return at === undefined || s.t < at ? Infinity : s.t - at
}

function ring(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha: number, fill: number) {
  const a = ctx.globalAlpha
  ctx.globalAlpha = a * fill; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
  ctx.globalAlpha = a * alpha; ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.setLineDash([...B.view.dash]); ctx.stroke(); ctx.setLineDash([])
  ctx.globalAlpha = a
}

/** 땅 차례 — 솟대·우물 둘레 · 혼줄 · 봉수대 표식 */
export function drawBuild2Ground(ctx: CanvasRenderingContext2D, s: HaebiRun) {
  const b = s.build
  if (!b?.v2) return
  const a = ctx.globalAlpha
  for (const it of b.items) {
    if (it.kind === 'sotdae') ring(ctx, it.x, it.y, sotdaeRadius(s.ranks.sotdae), V.sotdaeRing, V.sotdaeAlpha, V.sotdaeAlpha / 3)
    else if (it.kind === 'well') ring(ctx, it.x, it.y, wellRadius(s.ranks.well), V.wellRing, V.wellAlpha, V.wellFill)
  }
  // 혼줄 — 장승 둘 사이의 푸른 빛줄 (출렁인다)
  const links = totemLinks(b)
  if (links.length) {
    ctx.lineCap = 'round'
    for (const [p, q] of links) {
      const lift = V.h.totem * .55, wob = Math.sin(s.t * 6 + p.id) * 4
      ctx.globalAlpha = a * V.lineAlpha * .4; ctx.strokeStyle = V.line; ctx.lineWidth = V.lineGlow
      ctx.beginPath(); ctx.moveTo(p.x, p.y - lift); ctx.quadraticCurveTo((p.x + q.x) / 2, (p.y + q.y) / 2 - lift + wob, q.x, q.y - lift); ctx.stroke()
      ctx.globalAlpha = a * V.lineAlpha; ctx.lineWidth = V.lineW; ctx.stroke()
      // 땅에 닿는 판정 줄 (옅게)
      ctx.globalAlpha = a * V.lineAlpha * .35; ctx.lineWidth = B2.totem.lineW; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke()
    }
    ctx.lineCap = 'butt'
  }
  // 봉수대 화살비가 떨어질 자리 — 내 기술 표식(금빛 · 적의 붉은 말과 갈린다) · 남은 시간만큼 채워진다
  for (const m of s.shots) if (m.kind === 'signal') {
    const k = 1 - Math.max(0, m.life) / B2.beacon.delay
    ctx.globalAlpha = a * V.markAlpha; ctx.strokeStyle = V.mark; ctx.lineWidth = 3
    ctx.beginPath(); ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2); ctx.stroke()
    ctx.globalAlpha = a * V.markAlpha * .35; ctx.fillStyle = V.mark; ctx.beginPath(); ctx.arc(m.x, m.y, m.radius * k, 0, Math.PI * 2); ctx.fill()
  }
  ctx.globalAlpha = a
}

/** 봉수대 화살비 — 남은 시간만큼 위에서 화살이 내리꽂힌다 */
export function drawSignal(ctx: CanvasRenderingContext2D, images: Map<string, HTMLImageElement>, m: Missile) {
  const img = images.get('raid/arrow.png'); if (!img) return
  const k = Math.max(0, m.life) / B2.beacon.delay, w = V.arrow, h = w * img.height / img.width
  for (let i = 0; i < V.arrows; i++) {
    const ang = i * 2.4, x = m.x + Math.cos(ang) * m.radius * .45, y = m.y + Math.sin(ang) * m.radius * .3 - 14 - k * V.fall - i * 14
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 2); ctx.drawImage(img, -w / 2, -h / 2, w, h); ctx.restore()
  }
}
/** 포차 바위 — 던진 자리에서 떨어질 자리로 포물선 · 땅에는 작아지는 그림자 */
export function drawLob(ctx: CanvasRenderingContext2D, images: Map<string, HTMLImageElement>, m: Missile) {
  const u = 1 - Math.max(0, m.life) / B2.catapult.flight, a = ctx.globalAlpha
  ctx.globalAlpha = a * .35; ctx.fillStyle = '#0a0806'; ctx.beginPath(); ctx.ellipse(m.x, m.y, 10 + 8 * u, 4 + 3 * u, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = a
  const img = images.get(ROCK), y = m.y - Math.sin(u * Math.PI) * V.arc - V.h.catapult * .5 * (1 - u)
  if (img) { ctx.save(); ctx.translate(m.x, y); ctx.rotate(u * 9); ctx.drawImage(img, -V.rock / 2, -V.rock / 2, V.rock, V.rock); ctx.restore() }
}

/** 그림 한 장을 발밑(x, y)에서 높이 h 로 */
function stand(ctx: CanvasRenderingContext2D, img: HTMLImageElement | undefined, x: number, y: number, h: number, squash = 1) {
  if (!img) return 0
  const w = h * img.width / img.height
  ctx.drawImage(img, x - w / 2, y - h * squash, w, h * squash)
  return w
}

/** 설치물 하나 (67 다섯) — 발밑(x, y)에서 위로 · 잔해·체력 띠·흙먼지·그림자는 fx-build 가 함께 그린다 */
export function drawStructure2(ctx: CanvasRenderingContext2D, images: Map<string, HTMLImageElement>, s: HaebiRun, it: Structure) {
  const h = V.h[it.kind as keyof typeof V.h], a = ctx.globalAlpha, down = !standing(it)
  if (it.kind === 'totem') {
    if (down) { ctx.globalAlpha = a * B.view.rubbleAlpha; stand(ctx, images.get(ART.totem), it.x, it.y, h, B.view.rubbleSquash); ctx.globalAlpha = a; return }
    stand(ctx, images.get(ART.totem), it.x, it.y, h)
    if (it.flash > 0) { ctx.globalAlpha = a * it.flash / B.flash * .6; ctx.fillStyle = V.line; ctx.beginPath(); ctx.arc(it.x, it.y - h * .72, h * .16, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = a }
  } else if (it.kind === 'sotdae') {
    // 솟대 — 장대 그림 위에서 새가 가끔 깡충 (화면만)
    const hop = Math.max(0, Math.sin(s.t * V.hop.hz * Math.PI * 2 + it.id)) ** 8 * V.hop.height
    ctx.save(); ctx.translate(0, -hop * .3); stand(ctx, images.get(ART.sotdae), it.x, it.y + hop * .3, h); ctx.restore()
  } else if (it.kind === 'beacon') {
    stand(ctx, images.get(ART.beacon), it.x, it.y, h)
    // 쏜 뒤 연기가 피어오른다
    const since = fired(s, it), S = V.smoke
    if (since < S.life) for (let i = 0; i < S.n; i++) {
      const u = (since / S.life + i / S.n) % 1, x = it.x + Math.sin(s.t * 2 + i * 1.7) * 8 * u, y = it.y - h * .85 - u * S.rise
      ctx.globalAlpha = a * S.alpha * (1 - u) * (1 - since / S.life); ctx.fillStyle = S.color
      ctx.beginPath(); ctx.arc(x, y, S.size * (.5 + u), 0, Math.PI * 2); ctx.fill()
    }
    ctx.globalAlpha = a
  } else if (it.kind === 'catapult') {
    if (down) { ctx.globalAlpha = a * .8; stand(ctx, images.get(ART.rubble), it.x, it.y, h * .8); ctx.globalAlpha = a; return }
    drawCatapult(ctx, it, h, fired(s, it))
  } else if (it.kind === 'well') drawWell(ctx, s, it, h)
}

/** 포차 (캔버스) — 바퀴 달린 받침 · 던질 때 앞으로 젖혀졌다 돌아오는 팔 · 팔 끝 바위 */
function drawCatapult(ctx: CanvasRenderingContext2D, it: Structure, h: number, since: number) {
  const w = h * 1.2, base = it.y - V.wheel, wood = '#7a5232', dark = '#4b3020'
  ctx.fillStyle = dark; ctx.fillRect(it.x - w / 2, base - 8, w, 10)
  ctx.fillStyle = wood; ctx.fillRect(it.x - w / 2 + 2, base - 7, w - 4, 6)
  for (const sx of [-1, 1]) { ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(it.x + sx * w * .32, it.y - V.wheel, V.wheel, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = wood; ctx.beginPath(); ctx.arc(it.x + sx * w * .32, it.y - V.wheel, V.wheel * .45, 0, Math.PI * 2); ctx.fill() }
  // 받침 기둥 (A 꼴)
  ctx.strokeStyle = wood; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(it.x - 14, base - 6); ctx.lineTo(it.x, base - h * .55); ctx.lineTo(it.x + 14, base - 6); ctx.stroke()
  // 팔 — 쏜 뒤 throwOut 초는 앞으로 젖히고 throwBack 초에 걸쳐 돌아온다
  const throwK = since < V.throwOut ? since / V.throwOut : since < V.throwOut + V.throwBack ? 1 - (since - V.throwOut) / V.throwBack : 0
  const ang = V.armRest + throwK * V.armSwing, px = it.x, py = base - h * .55, ex = px + Math.cos(ang) * V.arm, ey = py + Math.sin(ang) * V.arm
  ctx.strokeStyle = dark; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(px - Math.cos(ang) * 14, py - Math.sin(ang) * 14); ctx.lineTo(ex, ey); ctx.stroke(); ctx.lineCap = 'butt'
  if (since > V.throwOut) { ctx.fillStyle = '#8b8378'; ctx.beginPath(); ctx.arc(ex, ey, 8, 0, Math.PI * 2); ctx.fill() }
}

/** 우물 (캔버스) — 돌 둘레 · 검푸른 물 · 장수가 곁에 있으면 물방울이 솟는다 */
function drawWell(ctx: CanvasRenderingContext2D, s: HaebiRun, it: Structure, h: number) {
  const rx = B2.well.r, ry = rx * .55, top = it.y - h * .5, a = ctx.globalAlpha
  ctx.fillStyle = '#6f6a62'; ctx.beginPath(); ctx.ellipse(it.x, it.y - 4, rx, ry, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#8d877d'; ctx.fillRect(it.x - rx, top, rx * 2, it.y - 4 - top)
  ctx.beginPath(); ctx.ellipse(it.x, top, rx, ry, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#1d3d52'; ctx.beginPath(); ctx.ellipse(it.x, top, rx * .72, ry * .62, 0, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = '#4e483f'; ctx.lineWidth = 2; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(it.x + i * rx * .6, top + ry * .6); ctx.lineTo(it.x + i * rx * .6, it.y - 6); ctx.stroke() }
  // 두레박 기둥과 들보
  ctx.strokeStyle = '#6b4a2e'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(it.x - rx * .9, top); ctx.lineTo(it.x - rx * .9, top - h * .7); ctx.lineTo(it.x + rx * .9, top - h * .7); ctx.lineTo(it.x + rx * .9, top); ctx.stroke()
  const near = Math.hypot(s.x - it.x, s.y - it.y) < wellRadius(s.ranks.well), D = V.drops
  if (near) for (let i = 0; i < D.n; i++) {
    const u = (s.t * .9 + i / D.n) % 1
    ctx.globalAlpha = a * (1 - u); ctx.fillStyle = D.color
    ctx.beginPath(); ctx.arc(it.x + Math.sin(i * 2.1 + s.t) * rx * .5, top - u * D.rise, D.size, 0, Math.PI * 2); ctx.fill()
  }
  ctx.globalAlpha = a
}
