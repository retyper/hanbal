/**
 * 67-BUILD2 설치물 그림 — 장승 · 솟대 · 봉수대 · 포차 · 우물 (판은 읽기만 한다 · 시계는 판 시각 s.t · 수치는 HAEBI_BUILD2.view).
 * 그림은 있는 것을 빌린다: 장승 = 설원 장식 장승(snow-3) · 솟대 = 본편 길 아이콘 솟대 · 봉수대 = 목책 판 화톳대(palisade-5) · 포차 잔해 = 산성 판 부서진 수레(fortress-5).
 * 포차는 부품 그림(받침·팔·줄 주머니·바퀴·균형추·바위·부러진 널 · public/realm/raid/pocha · 형 11-23 승인)을 코드가 조립해 던진다 · 우물은 캔버스로 그린다.
 * 땅 차례(drawBuild2Ground): 솟대 둘레 고리 · 우물 둘레 고리 · 혼줄 · 봉수대 화살비가 떨어질 금빛 표식.
 */
import { HAEBI_BUILD as B, HAEBI_BUILD2 as B2 } from '../tune/params.ts'
import type { HaebiRun, Missile } from './haebi.ts'
import { sotdaeRadius, wellRadius, totemLinks, standing, type Structure } from './build.ts'

const V = B2.view
const ART = { totem: 'raid/props/snow-3.webp', sotdae: 'icon/route-sotdae.png', beacon: 'raid/props/palisade-5.webp' } as const
/** 포차 부품 그림 (2배 크기 · view.pocha.scale 로 줄여 그린다) */
const POCHA_ART = { frame: 'raid/pocha/frame.png', arm: 'raid/pocha/arm.png', pouch: 'raid/pocha/pouch.png', wheel: 'raid/pocha/wheel.png', weight: 'raid/pocha/weight.png', rock: 'raid/pocha/rock.png', plankA: 'raid/pocha/plankA.png', plankB: 'raid/pocha/plankB.png' } as const
/** 미리 받아 둘 그림 — 장승·봉수대는 넓은 맵 장식(PROP_PATHS)에 이미 있어 솟대 아이콘과 포차 부품만 */
export const BUILD2_PATHS = [ART.sotdae, ...Object.values(POCHA_ART)]

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
    drawCatapult(ctx, images, s, it, fired(s, it))
  } else if (it.kind === 'well') drawWell(ctx, s, it, h)
}

// ── 포차 (부품 그림 조립 · 형 11-23 「포차는 부품마다 에셋 만들어 입혀야」 「돌이 바닥에서 시작해서 던져져야」) ──
// 수치는 HAEBI_BUILD2.view.pocha (부품 크기·축 자리는 public/realm/raid/pocha/pocha.json 의 2배 그림 px 를 그대로 옮긴 것)
const P = V.pocha
type Part = 'weight' | 'frame' | 'arm' | 'pouch' | 'rock' | 'wheelL' | 'wheelR'
/** 부품 하나의 자리 — 가운데(cx, cy · 발밑 기준 · 오른쪽이 던지는 쪽 · 위가 −) · 돌림 rot(캔버스 라디안) · 세로 눌림 sy */
interface Place { cx: number; cy: number; rot: number; sy: number }
const R = (deg: number) => deg * Math.PI / 180
/** 쏜 뒤 팔이 「놓음」 각을 지나는 때 (가속하며 throwOut 초 동안 rest → over 로 넘어간다) */
const sweep = P.rest - (P.over - 360)
const releaseT = V.throwOut * Math.sqrt((P.rest - (P.release - 360)) / sweep)
/** 쏜 뒤 since 초 · 쏘는 간격 total 초에서의 팔 각(도 · 이어진 값) */
function armDeg(since: number, total: number) {
  if (!(since >= 0) || since === Infinity) return P.rest
  const T = V.throwOut
  if (since < T) return P.rest - sweep * (since / T) ** 2
  const wind = Math.min(P.wind, Math.max(P.windMin, (total - T - P.hold) * P.windShare)), w = (since - T - P.hold) / wind
  if (w <= 0) return P.over - 360
  if (w >= 1) return P.rest
  return P.over - 360 + sweep * w * w * (3 - 2 * w)
}
/** 그때의 자세 — 팔 각 · 주머니·추가 흔들리는 몫 · 바위가 주머니에 있나 · 뒤로 밀린 px */
function pose(since: number, total: number) {
  const a = armDeg(since, total), dt = 1 / 60, prev = armDeg(since - dt, total)
  const omega = since === Infinity || since < dt ? 0 : R(a - prev) / dt
  // 팔 끝·꼬리의 가로 빠르기 → 매달린 것이 뒤처진다 (캔버스 돌림 + = 아래 끝이 왼쪽으로)
  const ar = R(a), vTip = -Math.sin(ar) * omega * P.arm.len, vTail = Math.sin(ar) * omega * P.arm.tail
  const after = since >= V.throwOut && since < Infinity ? since - V.throwOut : -1
  const sway = after >= 0 ? P.sway * Math.exp(-after / P.swayDecay) * Math.sin(after * P.swayHz * Math.PI * 2) : 0
  const lag = (v: number) => Math.max(-P.lagMax, Math.min(P.lagMax, v * P.lag))
  const recoilK = since >= 0 && since < P.recoilTime ? Math.sin(since / P.recoilTime * Math.PI) * (1 - since / P.recoilTime) : 0
  const rock = !(since >= releaseT) || since === Infinity || a >= P.rest - 1e-6 && since > V.throwOut
  return { a, lagP: lag(vTip) + sway, lagW: lag(vTail) - sway * .6, rock, recoil: -P.recoil * recoilK }
}
/** 매달린 부품의 가운데 — 걸린 점(x, y)에서 hang 이 매달리고 rot 만큼 돌았다 */
function hang(x: number, y: number, size: readonly number[], pivot: readonly number[], rot: number): Place {
  const dx = (size[0]! / 2 - pivot[0]!) * P.scale, dy = (size[1]! / 2 - pivot[1]!) * P.scale, c = Math.cos(rot), s = Math.sin(rot)
  return { cx: x + dx * c - dy * s, cy: y + dx * s + dy * c, rot, sy: 1 }
}
/** 조립된 자리 (발밑 원점 · 오른쪽이 던지는 쪽) */
function assembled(p: ReturnType<typeof pose>): Record<Part, Place> {
  const S = P.scale, F = P.frame, foot = { x: p.recoil, y: -P.wheel.size[1] / 2 * S * P.wheelLift }
  const ax = foot.x + (F.axle[0] - F.foot[0]) * S, ay = foot.y + (F.axle[1] - F.foot[1]) * S, ar = R(p.a)
  const tip = { x: ax + Math.cos(ar) * P.arm.len, y: ay - Math.sin(ar) * P.arm.len }, tail = { x: ax - Math.cos(ar) * P.arm.tail, y: ay + Math.sin(ar) * P.arm.tail }
  const pouch = hang(tip.x, tip.y, P.pouch.size, P.pouch.hang, p.lagP)
  const seat = { x: (P.pouch.seat[0] - P.pouch.hang[0]) * S, y: (P.pouch.seat[1] - P.pouch.hang[1]) * S - P.rockLift }, c = Math.cos(p.lagP), s = Math.sin(p.lagP)
  const spin = p.recoil / (P.wheel.size[0] / 2 * S) * P.wheelRock
  const wheel = (side: 'wheelL' | 'wheelR') => hang(foot.x + (F[side][0] - F.foot[0]) * S, foot.y + (F[side][1] - F.foot[1]) * S, P.wheel.size, P.wheel.hub, spin)
  return {
    weight: hang(tail.x, tail.y, P.weight.size, P.weight.hang, p.lagW),
    frame: hang(foot.x, foot.y, F.size, F.foot, 0),
    arm: hang(ax, ay, P.arm.size, P.arm.axle, -ar),
    pouch,
    rock: { cx: tip.x + seat.x * c - seat.y * s + (P.rock.size[0] / 2 - P.rock.c[0]) * S, cy: tip.y + seat.x * s + seat.y * c + (P.rock.size[1] / 2 - P.rock.c[1]) * S, rot: 0, sy: 1 },
    wheelL: wheel('wheelL'), wheelR: wheel('wheelR'),
  }
}
/** 놓는 순간 바위 자리 (발밑 기준 · 던지는 쪽 +) — 날아가는 바위(drawLob)가 여기서 떠난다 */
const RELEASE = (() => { const r = assembled(pose(releaseT, Infinity)).rock; return { x: r.cx, y: r.cy } })()
/** 무너진 자리 — 발밑 기준 [x, y, 돌림, 세로 눌림] · 판마다 같은 id 면 늘 같게 (좌우 뒤집기 · 조금 흔들림) */
function scattered(id: number): Record<Part | 'plankA' | 'plankB', Place> {
  const side = id % 2 ? 1 : -1, j = (k: number) => ((id * 7919 + k * 104729) % 13 - 6) / 6 * P.jitter
  const at = (v: readonly number[], k: number): Place => ({ cx: side * v[0]! + j(k), cy: v[1]! + j(k + 1) * .3, rot: side * v[2]!, sy: v[3]! })
  const Q = P.scatter
  return { frame: at(Q.frame, 1), arm: at(Q.arm, 2), weight: at(Q.weight, 3), pouch: at(Q.pouch, 4), rock: at(Q.rock, 5), wheelL: at(Q.wheelL, 6), wheelR: at(Q.wheelR, 7), plankA: at(Q.plankA, 8), plankB: at(Q.plankB, 9) }
}
const IMG: Record<Part | 'plankA' | 'plankB', keyof typeof POCHA_ART> = { weight: 'weight', frame: 'frame', arm: 'arm', pouch: 'pouch', rock: 'rock', wheelL: 'wheel', wheelR: 'wheel', plankA: 'plankA', plankB: 'plankB' }
const SIZE: Record<keyof typeof POCHA_ART, readonly number[]> = { frame: P.frame.size, arm: P.arm.size, pouch: P.pouch.size, wheel: P.wheel.size, weight: P.weight.size, rock: P.rock.size, plankA: P.plankA.size, plankB: P.plankB.size }
function put(ctx: CanvasRenderingContext2D, images: Map<string, HTMLImageElement>, name: keyof typeof POCHA_ART, q: Place) {
  const img = images.get(POCHA_ART[name]); if (!img) return
  const w = SIZE[name][0]! * P.scale, h = SIZE[name][1]! * P.scale
  ctx.save(); ctx.translate(q.cx, q.cy); ctx.rotate(q.rot); ctx.scale(1, q.sy); ctx.drawImage(img, -w / 2, -h / 2, w, h); ctx.restore()
}
const lerp = (a: Place, b: Place, k: number): Place => ({ cx: a.cx + (b.cx - a.cx) * k, cy: a.cy + (b.cy - a.cy) * k, rot: a.rot + (b.rot - a.rot) * k, sy: a.sy + (b.sy - a.sy) * k })
const ORDER: Part[] = ['weight', 'frame', 'arm', 'pouch', 'rock', 'wheelL', 'wheelR']
/** 포차가 던지는 쪽 — 마지막으로 던진 바위의 쪽 (화면 쪽 기억) · 아직 안 던졌으면 장수가 보는 쪽 */
const faceOf = new WeakMap<Structure, number>()
function facing(s: HaebiRun, it: Structure) {
  for (const m of s.shots) if (m.kind === 'lob') {
    const sx = m.tx - m.vx * B2.catapult.flight, sy = m.ty - m.vy * B2.catapult.flight
    if (Math.abs(sx - it.x) < 1 && Math.abs(sy - it.y) < 1) faceOf.set(it, m.tx >= sx ? 1 : -1)
  }
  return faceOf.get(it) ?? (s.face < 0 ? -1 : 1)
}
/** 포차 (부품 조립) — 장전(주머니가 뒤쪽 바닥) → 쏘면 팔이 위로 넘어가며 놓는다 → 잠시 넘어간 채 → 감아 내린다 · 무너지면 부품이 흩어지고 다시 설 때 모여든다 */
function drawCatapult(ctx: CanvasRenderingContext2D, images: Map<string, HTMLImageElement>, s: HaebiRun, it: Structure, since: number) {
  const face = facing(s, it), down = it.down > 0 || !standing(it), a = ctx.globalAlpha
  ctx.save(); ctx.translate(it.x, it.y); ctx.scale(face, 1)
  if (down) {
    const k0 = it.down > 0 ? Math.max(0, Math.min(1, (P.assemble - it.down) / P.assemble)) : 0, k = k0 * k0 * (3 - 2 * k0)
    const from = scattered(it.id), to = assembled(pose(Infinity, Infinity))
    for (const n of ['plankA', 'plankB'] as const) { ctx.globalAlpha = a * (1 - k); put(ctx, images, n, from[n]) }
    ctx.globalAlpha = a
    for (const n of ORDER) put(ctx, images, IMG[n], lerp(from[n], to[n], k))
  } else {
    const place = assembled(pose(since, since + it.cd))
    for (const n of ORDER) if (n !== 'rock' || pose(since, since + it.cd).rock) put(ctx, images, IMG[n], place[n])
    // 쏘거나 맞은 순간 — 축 둘레에 빛이 번진다
    if (it.flash > 0) {
      const f = place.arm, g = it.flash / B.flash
      ctx.globalAlpha = a * g * P.glow; ctx.fillStyle = B.view.glow; ctx.beginPath(); ctx.arc(f.cx, f.cy, P.glowR, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = a
    }
  }
  ctx.restore()
}
/** 포차 바위 — 놓는 순간의 주머니 자리에서 떨어질 자리로 포물선 (떨어지는 때·자리는 판 그대로) · 놓기 전에는 포차가 주머니 안에 그린다 · 땅에는 작아지는 그림자 */
export function drawLob(ctx: CanvasRenderingContext2D, images: Map<string, HTMLImageElement>, m: Missile) {
  const flight = B2.catapult.flight, el = flight - Math.max(0, m.life)
  if (el < releaseT) return
  const sx = m.tx - m.vx * flight, sy = m.ty - m.vy * flight, face = m.tx >= sx ? 1 : -1
  const v = Math.min(1, (el - releaseT) / (flight - releaseT)), gx0 = sx + face * RELEASE.x
  const gx = gx0 + (m.tx - gx0) * v, gy = sy + (m.ty - sy) * v, h = -RELEASE.y * (1 - v) + Math.sin(v * Math.PI) * V.arc, a = ctx.globalAlpha
  ctx.globalAlpha = a * .35; ctx.fillStyle = '#0a0806'; ctx.beginPath(); ctx.ellipse(gx, gy, 10 + 8 * v, 4 + 3 * v, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = a
  put(ctx, images, 'rock', { cx: gx, cy: gy - h, rot: face * v * P.rockSpin, sy: 1 })
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
