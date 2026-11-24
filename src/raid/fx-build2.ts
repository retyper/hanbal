/**
 * 67-BUILD2 설치물 그림 — 장승 · 솟대 · 봉수대 · 포차 · 우물 (판은 읽기만 한다 · 시계는 판 시각 s.t · 수치는 HAEBI_BUILD2.view).
 * 그림은 있는 것을 빌린다: 장승 = 설원 장식 장승(snow-3) · 솟대 = 본편 길 아이콘 솟대 · 봉수대 = 목책 판 화톳대(palisade-5) · 포차 잔해 = 산성 판 부서진 수레(fortress-5).
 * 포차는 부품 그림(받침·팔·줄 주머니·바퀴·균형추·바위·부러진 널 · public/realm/raid/pocha · 형 11-23 승인)을 코드가 조립해 던진다 · 우물은 캔버스로 그린다.
 * 땅 차례(drawBuild2Ground): 솟대 둘레 고리 · 우물 둘레 고리 · 혼줄 · 봉수대 화살비가 떨어질 금빛 표식.
 */
import { HAEBI_BUILD as B, HAEBI_BUILD2 as B2 } from '../tune/params.ts'
import type { Effect, HaebiRun, Missile } from './haebi.ts'
import { sotdaeRadius, wellRadius, wellCool, totemLinks, standing, type Structure } from './build.ts'

const V = B2.view
const ART = { totem: 'raid/props/snow-3.webp', sotdae: 'icon/route-sotdae.png', beacon: 'raid/props/palisade-5.webp' } as const
/** 포차 부품 그림 (2배 크기 · view.pocha.scale 로 줄여 그린다) */
const POCHA_ART = { frame: 'raid/pocha/frame.png', arm: 'raid/pocha/arm.png', pouch: 'raid/pocha/pouch.png', wheel: 'raid/pocha/wheel.png', weight: 'raid/pocha/weight.png', rock: 'raid/pocha/rock.png', plankA: 'raid/pocha/plankA.png', plankB: 'raid/pocha/plankB.png' } as const
/** 미리 받아 둘 그림 — 장승·봉수대는 넓은 맵 장식(PROP_PATHS)에 이미 있어 솟대 아이콘과 포차 부품만 */
/** 우물 부품 그림 (2배 크기 · view.wellArt.scale 로 줄여 그린다 · 하나라도 아직 안 떴으면 캔버스 우물로 그린다) */
const WELL_NAMES = ['rimBack', 'rimFront', 'waterFull', 'waterDry', 'post', 'roof', 'beam', 'pulley', 'bucket'] as const
const WELL_ART = Object.fromEntries(WELL_NAMES.map(n => [n, `raid/well/${n}.png`])) as Record<typeof WELL_NAMES[number], string>
export const BUILD2_PATHS = [ART.sotdae, ...Object.values(POCHA_ART), ...Object.values(WELL_ART)]

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
    if (!standing(it)) continue
    if (it.kind === 'sotdae') ring(ctx, it.x, it.y, sotdaeRadius(s.ranks.sotdae), V.sotdaeRing, V.sotdaeAlpha, V.sotdaeAlpha / 3)
    else if (it.kind === 'well') { const k = wellFull(s, it); ring(ctx, it.x, it.y, wellRadius(s.ranks.well), V.wellRing, V.wellAlpha * (k >= 1 ? 1 : V.wellCold), V.wellFill * (k >= 1 ? 1 : V.wellCold)) }
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
  if (down && it.kind !== 'totem' && it.kind !== 'catapult') {
    // 75-WALL 부서진 항아리·솟대·봉수대·우물 — 납작한 잔해 (우물은 물이 말라 있다 · 효과가 끊긴 것이 보이게)
    const x = it.x, y = it.y, sq = B.view.rubbleSquash
    ctx.save(); ctx.translate(x, y); ctx.scale(1, sq); ctx.translate(-x, -y); ctx.globalAlpha = a * B.view.rubbleAlpha
    if (it.kind === 'sotdae') stand(ctx, images.get(ART.sotdae), x, y, h)
    else if (it.kind === 'beacon') stand(ctx, images.get(ART.beacon), x, y, h)
    else if (WELL_NAMES.every(n => images.get(WELL_ART[n]))) drawWellArt(ctx, images, s, it)
    else drawWell(ctx, s, it, h)
    ctx.restore(); ctx.globalAlpha = a
    return
  }
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
  } else if (it.kind === 'well') {
    if (WELL_NAMES.every(n => images.get(WELL_ART[n]))) drawWellArt(ctx, images, s, it)
    else drawWell(ctx, s, it, h)
  }
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

/** 우물이 얼마나 찼나 0~1 (1 = 쿨타임이 끝나 쓸 수 있다) — 판의 쿨타임을 읽기만 한다 */
const wellFull = (s: HaebiRun, it: Structure) => !standing(it) ? 0 : it.cd <= 0 ? 1 : Math.max(0, Math.min(1, 1 - it.cd / wellCool(s.ranks.well)))

/** 우물 (캔버스 · 그림이 아직 안 떴을 때) — 돌 둘레 · 물은 쿨타임 동안 바닥에서 차오르고 다 차면 번쩍이며 물방울이 솟는다 (쿨타임 중에는 빈 바닥) */
function drawWell(ctx: CanvasRenderingContext2D, s: HaebiRun, it: Structure, h: number) {
  const rx = B2.well.r, ry = rx * .55, top = it.y - h * .5, a = ctx.globalAlpha, W = V.water, k = wellFull(s, it), ready = k >= 1
  ctx.fillStyle = '#6f6a62'; ctx.beginPath(); ctx.ellipse(it.x, it.y - 4, rx, ry, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#8d877d'; ctx.fillRect(it.x - rx, top, rx * 2, it.y - 4 - top)
  ctx.beginPath(); ctx.ellipse(it.x, top, rx, ry, 0, 0, Math.PI * 2); ctx.fill()
  // 우물 속 — 빈 바닥 위에 물이 k 만큼 차오른다 (깊이가 얕아지는 모양으로 안쪽 타원이 커진다)
  ctx.fillStyle = W.dry; ctx.beginPath(); ctx.ellipse(it.x, top, rx * .72, ry * .62, 0, 0, Math.PI * 2); ctx.fill()
  if (k > 0) {
    ctx.fillStyle = W.full; ctx.beginPath(); ctx.ellipse(it.x, top + ry * .62 * (1 - k) * .6, rx * .72 * (.35 + .65 * k), ry * .62 * (.35 + .65 * k), 0, 0, Math.PI * 2); ctx.fill()
  }
  if (ready) {
    const pulse = .5 + .5 * Math.sin(s.t * 4)
    ctx.globalAlpha = a * W.glow * (.6 + .4 * pulse); ctx.fillStyle = W.shine
    ctx.beginPath(); ctx.ellipse(it.x - rx * .15, top - ry * .1, rx * .42, ry * .3, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = a
  }
  ctx.strokeStyle = '#4e483f'; ctx.lineWidth = 2; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(it.x + i * rx * .6, top + ry * .6); ctx.lineTo(it.x + i * rx * .6, it.y - 6); ctx.stroke() }
  // 두레박 기둥과 들보
  ctx.strokeStyle = '#6b4a2e'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(it.x - rx * .9, top); ctx.lineTo(it.x - rx * .9, top - h * .7); ctx.lineTo(it.x + rx * .9, top - h * .7); ctx.lineTo(it.x + rx * .9, top); ctx.stroke()
  const D = V.drops
  if (ready) for (let i = 0; i < D.n; i++) {
    const u = (s.t * .9 + i / D.n) % 1
    ctx.globalAlpha = a * (1 - u); ctx.fillStyle = D.color
    ctx.beginPath(); ctx.arc(it.x + Math.sin(i * 2.1 + s.t) * rx * .5, top - u * D.rise, D.size, 0, Math.PI * 2); ctx.fill()
  }
  ctx.globalAlpha = a
}

// ── 우물 (부품 그림 조립 · 형 11-25 「우물은 왜 에셋 안 만들고 있지」 · 포차와 같은 길) ──
// 수치는 HAEBI_BUILD2.view.wellArt (부품 크기·축 자리는 public/realm/raid/well/well.json 의 2배 그림 px 를 그대로 옮긴 것)
const WA = V.wellArt
type WellPart = typeof WELL_NAMES[number]
/** 채운 순간(쿨타임이 다시 찬 때) · 다 찬 순간(쿨타임이 0 이 된 때)을 화면 쪽에서 기억한다 */
const wellFillAt = new WeakMap<Structure, number>(), wellReadyAt = new WeakMap<Structure, number>(), wellSeen = new WeakMap<Structure, { cd: number }>()
function wellClock(s: HaebiRun, it: Structure) {
  const last = wellSeen.get(it)
  if (last) {
    if (it.cd > last.cd + 1e-6) { wellFillAt.set(it, s.t); wellReadyAt.delete(it) }
    else if (last.cd > 0 && it.cd <= 0) wellReadyAt.set(it, s.t)
    last.cd = it.cd
  } else wellSeen.set(it, { cd: it.cd })
  const f = wellFillAt.get(it), r = wellReadyAt.get(it)
  return { fill: f === undefined || s.t < f ? Infinity : s.t - f, ready: r === undefined || s.t < r ? Infinity : s.t - r }
}
/** 번호 · 낱알로 정해지는 0~1 값 (판 시각 말고는 아무것도 안 읽는다 · 같은 판이면 늘 같게) */
function wellRand(id: number, k: number, j: number) { const x = Math.sin(id * 12.9898 + k * 78.233 + j * 37.719) * 43758.5453; return x - Math.floor(x) }
const easeOut = (u: number) => 1 - (1 - u) * (1 - u), easeIn = (u: number) => u * u
function putWell(ctx: CanvasRenderingContext2D, images: Map<string, HTMLImageElement>, name: WellPart, x: number, y: number, pivot: readonly number[], rot = 0, flip = 1) {
  const img = images.get(WELL_ART[name]); if (!img) return
  const m = WA[name], w = m.size[0] * WA.scale, h = m.size[1] * WA.scale
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(flip, 1); ctx.drawImage(img, -pivot[0]! * WA.scale, -pivot[1]! * WA.scale, w, h); ctx.restore()
}
/** 물방울 하나 — 둥근 방울 + 흰 점 (낱낱이 날아간다) */
function drop(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, light: string, alpha: number) {
  ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = light; ctx.beginPath(); ctx.arc(x - r * .3, y - r * .3, r * .35, 0, Math.PI * 2); ctx.fill()
}
/** 우물 (부품 조립) — 물은 쿨타임만큼 입구 바닥에서 차오르고 · 두레박이 물에 얹혀 오른다 · 채우면 두레박이 당겨졌다 떨어지며 줄이 출렁이고 물방울이 튄다 · 다 차면 번쩍 */
function drawWellArt(ctx: CanvasRenderingContext2D, images: Map<string, HTMLImageElement>, s: HaebiRun, it: Structure) {
  const a = ctx.globalAlpha, c = wellClock(s, it), Pl = WA.pull, Rd = WA.ready, Sp = WA.spray, Rp = WA.rope
  const [orx, ory] = WA.open, cy = WA.cy, seed = Math.floor((wellFillAt.get(it) ?? 0) * 100) + it.id
  // 물 높이 — 채운 직후에는 물이 빠져 내려간다 (drain 초) · 그 뒤로 쿨타임만큼 차오른다
  const k = wellFull(s, it), kd = c.fill < WA.drain ? 1 - easeOut(c.fill / WA.drain) : k
  ctx.save(); ctx.translate(it.x, it.y)
  // 두레박 자리 — 물에 얹혀 오르내린다 + 채울 때 위로 당겨졌다 떨어지며 튕긴다 + 흔들린다
  let lift = 0, sway = 0
  const tL = Pl.upT + Pl.dropT
  if (c.fill < Infinity) {
    const u = c.fill
    if (u < Pl.upT) lift = Pl.up * easeOut(u / Pl.upT)
    else if (u < tL) lift = Pl.up * (1 - easeIn((u - Pl.upT) / Pl.dropT))
    else lift = Pl.bounce * Math.exp(-(u - tL) / Pl.decay) * Math.abs(Math.sin((u - tL) * Pl.hz * Math.PI))
    sway = Pl.sway * Math.exp(-u / Pl.swayDecay) * Math.sin(u * Pl.swayHz * Math.PI * 2)
  }
  if (c.ready < Infinity) sway += Rd.sway * Math.exp(-c.ready / Rd.swayDecay) * Math.sin(c.ready * Rd.swayHz * Math.PI * 2)
  if (kd >= 1) sway += WA.idleSway * Math.sin(s.t * 1.7 + it.id)
  const attachX = -WA.pulleyR, attachY = WA.pulleyY
  const baseY = WA.restY + WA.sink * (1 - kd), hangY = baseY - lift, hangX = attachX + Math.sin(sway) * Math.max(6, hangY - attachY) * .5
  // 뒤: 기둥 · 둘레 뒤 반쪽 · 빈 바닥 · 물(입구 안에서만)
  for (const side of [-1, 1]) putWell(ctx, images, 'post', side * WA.postX, WA.postFootY, WA.post.foot, 0, side)
  putWell(ctx, images, 'rimBack', 0, cy, WA.rimBack.c)
  putWell(ctx, images, 'waterDry', 0, cy, WA.waterDry.c)
  ctx.save(); ctx.beginPath(); ctx.ellipse(0, cy, orx, ory, 0, 0, Math.PI * 2); ctx.clip()
  if (kd > 0) putWell(ctx, images, 'waterFull', 0, cy + WA.depth * (1 - kd), WA.waterFull.c)
  // 다 찼을 때 번쩍 — 입구 안쪽만 밝아졌다 가라앉는다
  if (c.ready < Rd.flash) { const g = 1 - c.ready / Rd.flash; ctx.globalAlpha = a * Rd.flashAlpha * g; ctx.fillStyle = V.water.shine; ctx.fillRect(-orx, cy - ory, orx * 2, ory * 2); ctx.globalAlpha = a }
  ctx.restore()
  // 들보 · 도르래 · 줄 · 두레박
  putWell(ctx, images, 'beam', 0, WA.beamY, WA.beam.c)
  putWell(ctx, images, 'pulley', 0, WA.pulleyY, WA.pulley.hub, (hangY - attachY) / WA.pulleyR)
  const len = hangY - attachY, u2 = c.fill - tL, slack = u2 > 0 && u2 < Infinity ? Pl.slack * Math.exp(-u2 / Pl.slackDecay) * Math.sin(u2 * Pl.slackHz * Math.PI * 2) : 0
  const endY = attachY + Math.max(3, WA.ropeMax - len), rx = WA.pulleyR
  ctx.lineCap = 'round'
  for (const [col, w] of [[Rp.dark, Rp.w + 1.6], [Rp.color, Rp.w]] as const) {
    ctx.strokeStyle = col; ctx.lineWidth = w
    ctx.beginPath(); ctx.moveTo(attachX, attachY); ctx.quadraticCurveTo((attachX + hangX) / 2 + slack, (attachY + hangY) / 2, hangX, hangY + 1); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(rx, attachY); ctx.quadraticCurveTo(rx - slack * .5, (attachY + endY) / 2, rx + sway * 4, endY); ctx.stroke()
  }
  ctx.fillStyle = Rp.dark; ctx.beginPath(); ctx.arc(rx + sway * 4, endY + 1, Rp.knot, 0, Math.PI * 2); ctx.fill()
  putWell(ctx, images, 'bucket', hangX, hangY, WA.bucket.hang, sway)
  // 앞: 둘레 앞 반쪽 · 지붕
  putWell(ctx, images, 'rimFront', 0, cy, WA.rimFront.c)
  putWell(ctx, images, 'roof', 0, WA.roofY, WA.roof.base)
  // 물방울 낱낱 — 당겨 올린 두레박에서 튀고 · 떨어질 때 입구에서 튄다 · 다 차면 반짝이가 인다
  const ox = attachX, oy = WA.restY - Pl.up
  for (let i = 0; i < Sp.n; i++) {
    const u = c.fill - Pl.upT; if (!(u >= 0 && u <= Sp.life)) break
    const ang = -Math.PI / 2 + (wellRand(it.id, seed, i) - .5) * Sp.spread * Math.PI, v = Sp.speed * (.55 + .45 * wellRand(it.id, seed, i + 40))
    drop(ctx, ox + Math.cos(ang) * v * u, oy + Math.sin(ang) * v * u + Sp.gravity * u * u / 2, Sp.size * (.6 + .6 * wellRand(it.id, seed, i + 80)), Sp.color, Sp.light, a * (1 - u / Sp.life))
  }
  for (let i = 0; i < Sp.land; i++) {
    const u = c.fill - tL; if (!(u >= 0 && u <= Sp.landLife)) break
    const ang = -Math.PI / 2 + (wellRand(it.id, seed, i + 120) - .5) * 2.2, v = Sp.landSpeed * (.5 + .5 * wellRand(it.id, seed, i + 160))
    drop(ctx, hangX + Math.cos(ang) * v * u, cy + Math.sin(ang) * v * u * .6 + Sp.gravity * .25 * u * u, Sp.size * .8, Sp.color, Sp.light, a * (1 - u / Sp.landLife))
  }
  if (kd >= 1) for (let i = 0; i < Rd.sparks; i++) {
    const u = (s.t / Rd.sparkLife + i / Rd.sparks) % 1, sx = (wellRand(it.id, i, 7) - .5) * orx * 1.5, sy = cy - ory * .2 - u * 14, r = Rd.sparkSize * Math.sin(u * Math.PI)
    ctx.globalAlpha = a * Math.sin(u * Math.PI); ctx.fillStyle = V.water.shine
    ctx.beginPath(); ctx.moveTo(sx, sy - r); ctx.lineTo(sx + r * .3, sy); ctx.lineTo(sx, sy + r); ctx.lineTo(sx - r * .3, sy); ctx.closePath(); ctx.fill()
    ctx.beginPath(); ctx.moveTo(sx - r, sy); ctx.lineTo(sx, sy + r * .3); ctx.lineTo(sx + r, sy); ctx.lineTo(sx, sy - r * .3); ctx.closePath(); ctx.fill()
  }
  ctx.restore(); ctx.globalAlpha = a
}

/** 채운 순간의 물보라와 「+N」 — 판의 효과(wellHeal)를 한 번씩 읽어 장수 둘레에 그린다 (시계는 판 시각 s.t · 판은 읽기만) */
interface HealPop { x: number; y: number; t: number; n: number; seed: number }
let healRun: HaebiRun | null = null, healPops: HealPop[] = [], healSeen = new WeakSet<Effect>()
export function drawWellHeal(ctx: CanvasRenderingContext2D, s: HaebiRun) {
  if (healRun !== s) { healRun = s; healPops = []; healSeen = new WeakSet() }
  for (const f of s.fx) if (f.wellHeal !== undefined && !healSeen.has(f)) { healSeen.add(f); healPops.push({ x: f.x, y: f.y, t: s.t, n: f.wellHeal, seed: healPops.length }) }
  const H = V.heal, S = H.splash
  while (healPops.length && s.t - healPops[0]!.t > H.life) healPops.shift()
  for (const p of healPops) {
    const age = s.t - p.t; if (age < 0) continue
    const u = age / H.life, fade = Math.max(0, 1 - u)
    ctx.save()
    ctx.fillStyle = S.color
    for (let i = 0; i < S.n; i++) {
      const ang = (i / S.n) * Math.PI * 2 + p.seed, d = S.spread * Math.min(1, u * 2.2), up = Math.sin(Math.min(1, u * 1.6) * Math.PI) * S.rise * (.6 + .4 * Math.sin(i * 2.3))
      ctx.globalAlpha = fade; ctx.beginPath(); ctx.arc(p.x + Math.cos(ang) * d, p.y - 10 + Math.sin(ang) * d * .4 - up, S.size * (1 - u * .5), 0, Math.PI * 2); ctx.fill()
    }
    ctx.globalAlpha = fade; ctx.font = `900 ${H.size}px "Noto Serif KR", serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.lineWidth = H.stroke; ctx.strokeStyle = H.edge; ctx.strokeText(`+${p.n}`, p.x, p.y - H.lift - u * H.rise)
    ctx.fillStyle = H.fill; ctx.fillText(`+${p.n}`, p.x, p.y - H.lift - u * H.rise)
    ctx.restore()
  }
}
