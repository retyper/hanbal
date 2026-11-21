/**
 * 55 불의 무녀 장군 그리기 — 판 상태를 읽기만 한다 (자세 · 고정 붉은 예고 · 판 시각 age). 화면 시계·난수 없음.
 * 사람 꼴 인형: 판정과 같은 변환(shaman.ts shamanPoint)으로 자세 그림 넷 중 하나를 그리고, 그 위에 따로 움직이는 것을 얹는다 —
 * 옷자락 둘(몸 뒤에서 숨·원무에 따라 펄럭임) → 옛 자세(바뀔 때 잠깐 옅게) → 몸 → 부서진 부채·방울 그을음 → 치마 끝 불꽃 무늬 빛(일렁임) →
 * 허리 장식(흔들림 · 부서지면 떨어진다) → 치마 끝 불꽃 혀 → 휘두를 때 팔 잔상(따로 그린 부채 팔·방울 팔) → 방울 울림.
 */
import { HAEBI_SHAMAN as S, HAEBI_GIANT as G, HAEBI_FX as FX, HAEBI_RUN as C } from '../tune/params.ts'
import type { Point, Shape } from './giant-core.ts'
import { SHAMAN_ART, SHAMAN_SOURCE, SHAMAN_FLAMES, bakedPoint, shamanBody, shamanGlow, type ShamanPiece } from './shaman-art.ts'
import { makeShamanPose, shamanCollisionBounds, shamanPoint, shamanSx, shamanSy, shamanHpOf, type ShamanState, type ShamanFrame, type ShamanHp, type ShamanKey } from './shaman.ts'
import { drawImugiThreats } from './imugi-view.ts'
import { AURA_ART } from './fx-aura.ts'

const V = S.view, K = S.rig.scale, TAU = Math.PI * 2, H = C.height
type XY = readonly [number, number]
type Images = ReadonlyMap<string, HTMLImageElement>
const point = (x: number, y: number): Point => ({ x, y })
const unit = (x: number) => Math.max(0, Math.min(1, x))
const smooth = (x: number) => { const t = unit(x); return t * t * (3 - 2 * t) }
/** 그리기 전용 의사난수 0~1 — 번호와 갈래로만 정해진다 (판의 난수와 무관) */
const rnd = (i: number, salt: number) => { const v = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453; return v - Math.floor(v) }
const FLAME = AURA_ART.flame, FLAME_BOX = [128, 20, 122, 328] as const, RING = 'raid/bell-ring.png'
const rigOf = (f: ShamanFrame) => S.rig.keys[f.key]!

/** 캔버스를 몸 판 원본 px 로 — shamanPoint 와 같은 차례 (발 기준 · scale · 가로/세로 몫 · 발을 축으로 기울임 · 좌우 · 들림) */
function bodySpace(ctx: CanvasRenderingContext2D, f: ShamanFrame) {
  const feet = rigOf(f).feet
  ctx.translate(f.x, f.y + f.lift); ctx.scale(f.facing, 1); ctx.rotate(f.lean); ctx.scale(K * shamanSx(f), K * shamanSy(f)); ctx.translate(-feet[0], -feet[1])
}
/** 몸 판 조각(몸·빛)을 원본 자리에 */
function sheet(ctx: CanvasRenderingContext2D, img: CanvasImageSource, piece: ShamanPiece) { const [x, y, w, h] = SHAMAN_SOURCE[piece].crop; ctx.drawImage(img, x, y, w, h) }
/** 불꽃 한 가닥 — 밑동 (x, y) · 높이 h (불꽃 그림 한 장을 N번 · 위로 선다) */
function flame(ctx: CanvasRenderingContext2D, img: HTMLImageElement | undefined, x: number, y: number, h: number, alpha: number) {
  if (!img || h <= 0 || alpha <= 0) return
  const [sx, sy, sw, sh] = FLAME_BOX, w = h * sw / sh
  ctx.globalAlpha = alpha; ctx.drawImage(img, sx, sy, sw, sh, x - w / 2, y - h * .94, w, h)
}

// ── 몸 위에 얹는 그림 (그을음 · 불 몸) — 자세 그림마다 한 번 굽는다 · DOM 이 없으면 없다 ──
const baked = new WeakMap<object, Map<string, HTMLCanvasElement | null>>()
function bake(img: HTMLImageElement, key: string, make: (x: CanvasRenderingContext2D, c: HTMLCanvasElement) => void, w: number, h: number): HTMLCanvasElement | null {
  let m = baked.get(img); if (!m) { m = new Map(); baked.set(img, m) }
  if (m.has(key)) return m.get(key)!
  let out: HTMLCanvasElement | null = null
  if (typeof document !== 'undefined') { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); const x = c.getContext('2d'); if (x) { make(x, c); out = c } }
  m.set(key, out); return out
}
/** 부서진 부채·방울 자리만 그을린 조각 (몸 그림의 그 둘레만 · 알파는 몸 그대로) */
function charPatch(img: HTMLImageElement, key: ShamanKey, part: 'fan' | 'bell'): { canvas: HTMLCanvasElement; at: XY } | null {
  const rig = S.rig.keys[key]!, c = rig[part][1], R = V.charRadius, [cx, cy] = SHAMAN_SOURCE[shamanBody(key)].crop
  const canvas = bake(img, `char-${part}`, x => {
    x.drawImage(img, cx - (c[0] - R), cy - (c[1] - R)); x.globalCompositeOperation = 'source-atop'
    const g = x.createRadialGradient(R, R, R * .15, R, R, R); g.addColorStop(0, V.char); g.addColorStop(.7, V.char); g.addColorStop(1, 'rgba(0,0,0,0)')
    x.fillStyle = g; x.fillRect(0, 0, R * 2, R * 2)
  }, R * 2, R * 2)
  return canvas ? { canvas, at: [c[0] - R, c[1] - R] } : null
}
/** 불로 된 몸 (등장·쓰러짐) — 몸 그림을 불빛 하나로 칠한 것 */
function fireBody(img: HTMLImageElement): HTMLCanvasElement | null {
  return bake(img, 'fire', x => { x.drawImage(img, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = '#ffb04a'; x.fillRect(0, 0, img.width, img.height) }, img.naturalWidth || img.width, img.naturalHeight || img.height)
}

// ── 몸 ──
const brokenOf = (g: ShamanState, id: ShamanHp) => g.partHP[id] <= 0
/** 원본 px 로 적은 조각을 (판 좌표가 아니라) 몸 판 원본 px 공간에 — pivot 을 at 에 · 몸 판 1px 당 조각 scale/K */
function piece(ctx: CanvasRenderingContext2D, img: HTMLImageElement, name: ShamanPiece, pivot: XY, at: XY, angle: number, scale: number, flip = 1) {
  const p = bakedPoint(name, pivot)
  ctx.save(); ctx.translate(at[0], at[1]); ctx.rotate(angle); ctx.scale(flip * scale / K, scale / K); ctx.drawImage(img, -p[0], -p[1]); ctx.restore()
}
/** 옷자락 둘 — 허리에 매달려 숨·걸음·원무에 따라 펄럭인다 (몸 뒤) */
function drawRobes(ctx: CanvasRenderingContext2D, images: Images, g: ShamanState, f: ShamanFrame) {
  const rig = rigOf(f), t = g.age
  const back = images.get(SHAMAN_ART['robe-back']), front = images.get(SHAMAN_ART['robe-front']), R = V.robe
  if (back) piece(ctx, back, 'robe-back', R.back.pivot, rig.robeBack, R.back.turn + Math.sin(t * TAU * R.back.hz) * R.back.sway + f.flare * R.back.flare, R.back.scale)
  if (front) piece(ctx, front, 'robe-front', R.front.pivot, rig.robeFront, R.front.turn + Math.sin(t * TAU * R.front.hz + 1.3) * R.front.sway - f.flare * R.front.flare, R.front.scale)
}
/** 치마 끝 불꽃 무늬 빛 — 일렁이며 밝아졌다 어두워진다 (빛 그림을 더해 그린다) */
function drawGlow(ctx: CanvasRenderingContext2D, images: Images, g: ShamanState, f: ShamanFrame, boost = 0) {
  const img = images.get(SHAMAN_ART[shamanGlow(f.key)]); if (!img) return
  const t = g.age, flick = .5 + .3 * Math.sin(t * TAU * V.glowHz) + .2 * Math.sin(t * TAU * V.glowHz * 1.73 + 1.1)
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= Math.min(1, V.glowAlpha * (1 - V.glowFlicker + V.glowFlicker * flick) + boost); sheet(ctx, img, shamanGlow(f.key)); ctx.restore()
}
/** 허리 장식 — 걸음·숨에 흔들린다 (부서지면 떨어져 안 그린다) */
function drawWaist(ctx: CanvasRenderingContext2D, images: Images, g: ShamanState, f: ShamanFrame) {
  if (brokenOf(g, 'waist')) return
  const img = images.get(SHAMAN_ART.waist); if (!img) return
  const w = rigOf(f).waist
  piece(ctx, img, 'waist', V.waist.pivot, [w[0], w[1]], Math.sin(g.age * TAU * V.waist.hz) * V.waist.swing + f.flare * .05, V.waist.scale)
}
/** 자세 하나를 그린다 (옷자락 · 몸 · 그을음 · 빛 · 허리 장식) — 몸 판 원본 px 공간에서 · fire 불로 된 몸(등장·쓰러짐)을 더하는 짙기 */
function drawBody(ctx: CanvasRenderingContext2D, images: Images, g: ShamanState, f: ShamanFrame, alpha: number, fire = 0, prev?: { key: ShamanKey; alpha: number }): boolean {
  const img = images.get(SHAMAN_ART[shamanBody(f.key)]); if (!img) return false
  ctx.save()
  try {
    bodySpace(ctx, f)
    if (fire > 0) { const flame = fireBody(img); if (flame) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= fire; sheet(ctx, flame, shamanBody(f.key)); ctx.restore() } }
    ctx.globalAlpha *= alpha
    if (alpha <= 0) return true
    drawRobes(ctx, images, g, f)
    if (prev && prev.alpha > 0) {
      // 자세가 막 바뀌었다 — 옛 자세를 잠깐 옅게 (옛 자세의 발 기준을 새 자세의 발에 맞춘다)
      const old = images.get(SHAMAN_ART[shamanBody(prev.key)]), a = S.rig.keys[prev.key]!.feet, b = rigOf(f).feet
      if (old) { ctx.save(); ctx.globalAlpha *= prev.alpha; ctx.translate(b[0] - a[0], b[1] - a[1]); sheet(ctx, old, shamanBody(prev.key)); ctx.restore() }
    }
    sheet(ctx, img, shamanBody(f.key))
    for (const part of ['fan', 'bell'] as const) if (brokenOf(g, part)) { const p = charPatch(img, f.key, part); if (p) ctx.drawImage(p.canvas, p.at[0], p.at[1]) }
    if (fire > 0) { const flame = fireBody(img); if (flame) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= fire * .6; sheet(ctx, flame, shamanBody(f.key)); ctx.restore() } }
    drawGlow(ctx, images, g, f, fire * .5)
    drawWaist(ctx, images, g, f)
  } finally { ctx.restore() }
  return true
}
/** 치마 끝·소매 불꽃 혀 — 무늬 자리에서 피어 올라 흔들린다 (판 좌표에서 늘 위로 · 판 시각으로만) */
function drawHemFlames(ctx: CanvasRenderingContext2D, images: Images, g: ShamanState, f: ShamanFrame, alpha: number) {
  const img = images.get(FLAME), pts = SHAMAN_FLAMES[f.key]; if (!img || !pts) return
  ctx.save()
  for (let i = 0; i < pts.length; i += 2) {
    const n = i / 2, ph = (g.age * V.hemHz * (.8 + .4 * rnd(n, 1)) + rnd(n, 2)) % 1, p = shamanPoint(f, [pts[i]!, pts[i + 1]!])
    const h = V.hemSize * (.55 + .45 * rnd(n, 3)) * (1 - .5 * ph) * (1 + f.flare * .35)
    flame(ctx, img, p.x + Math.sin(g.age * 5 + n) * V.hemSway * ph, p.y - ph * V.hemRise, h, alpha * V.hemAlpha * Math.sin(Math.PI * ph))
  }
  ctx.restore()
}
/** 방울이 울린다 — 방울 자리에서 금빛 고리가 퍼진다 (울린 판 시각 at 부터) */
function bellRing(ctx: CanvasRenderingContext2D, images: Images, c: Point, since: number, size: number = V.bellRing) {
  const img = images.get(RING); if (!img || since < 0 || since > V.bellLife) return
  const u = since / V.bellLife, r = size * (.25 + .75 * u)
  ctx.save(); ctx.globalAlpha = (1 - u) * .9; ctx.drawImage(img, c.x - r, c.y - r, r * 2, r * 2); ctx.restore()
}
const bellAt = (f: ShamanFrame) => shamanPoint(f, rigOf(f).bell[1])
/** 휘두를 때 팔 잔상 — 따로 그린 부채 팔(방울 팔)을 어깨에서 지금 팔 방향까지 돌려 몇 벌 옅게 더한다 */
function drawSmear(ctx: CanvasRenderingContext2D, images: Images, g: ShamanState, f: ShamanFrame) {
  const a = g.attack; if (g.state !== 'strike' || !a || (a.move !== 'sweep' && a.move !== 'chase' && a.move !== 'twin')) return
  const p = g.motion.progress; if (p > .75) return
  const arms: ('fan' | 'bell')[] = a.move === 'twin' ? ['fan', 'bell'] : ['fan']
  for (const arm of arms) {
    if (brokenOf(g, arm)) continue
    const name: ShamanPiece = arm === 'fan' ? 'fan-arm' : 'bell-arm', img = images.get(SHAMAN_ART[name]); if (!img) continue
    const rig = rigOf(f), from = rig[arm][0], to = rig[arm][1], sm = V.smear[arm], shoulder = shamanPoint(f, from)
    // 팔 그림의 어깨 → 손끝 축을 지금 자세의 어깨 → 부채(방울) 쪽에 맞춘다
    const local = Math.atan2(to[1] - from[1], to[0] - from[0]) + f.lean - Math.atan2(sm.tip[1] - sm.shoulder[1], sm.tip[0] - sm.shoulder[0]), dir = arm === 'fan' ? 1 : -1, pv = bakedPoint(name, sm.shoulder)
    ctx.save(); ctx.globalCompositeOperation = 'lighter'
    for (let k = 0; k < V.smear.copies; k++) {
      const u = unit(p / .6 - k * .12), ang = local - dir * V.smear.sweep * (1 - smooth(u))
      ctx.save(); ctx.globalAlpha = V.smear.alpha * (1 - k / V.smear.copies) * (1 - p / .75)
      ctx.translate(shoulder.x, shoulder.y); ctx.scale(f.facing, 1); ctx.rotate(ang); ctx.scale(sm.scale, sm.scale)
      ctx.drawImage(img, -pv[0], -pv[1]); ctx.restore()
    }
    ctx.restore()
  }
}

/** 판 좌표 경계 (카메라가 온몸을 담는다) — 몸 그림 네 귀 · 옷자락 둘레 · 등장 동안은 다 나온 자리로 */
export function shamanVisualBounds(g: ShamanState): { left: number; top: number; right: number; bottom: number } | null {
  if (g.state === 'dead') return null
  const f = g.state === 'entry' ? { ...g.motion.from, rise: 1 } : g.pose.frame, [x, y, w, h] = SHAMAN_SOURCE[shamanBody(f.key)].crop, pad = V.robe.back.scale * 150
  const pts = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map(p => shamanPoint(f, p as unknown as XY)), col = shamanCollisionBounds(g.state === 'entry' ? makeShamanPose(f, { ownerId: g.pose.ownerId, tick: g.pose.tick, alive: true, targetable: false, recovering: false, partHP: g.partHP }) : g.pose)
  return { left: Math.min(col.left, ...pts.map(p => p.x - pad)), right: Math.max(col.right, ...pts.map(p => p.x + pad)), top: Math.min(col.top, ...pts.map(p => p.y)), bottom: Math.max(col.bottom, ...pts.map(p => p.y + 10)) }
}
export interface ShamanViewOptions { readonly heroX: number; readonly heroY: number }
/** 몸 — 장수가 몸 뒤(발보다 위)에 서면 옅게 */
export function drawShaman(ctx: CanvasRenderingContext2D, images: Images, g: ShamanState, o: ShamanViewOptions): boolean {
  if (g.state === 'dead') return false
  const f = g.pose.frame, b = shamanVisualBounds(g), behind = !!b && o.heroY < f.y - V.behindPad && o.heroX > b.left && o.heroX < b.right && o.heroY > b.top
  const since = g.age - g.keyAt, prev = since < V.keyFade && g.keyFrom !== f.key ? { key: g.keyFrom, alpha: 1 - since / V.keyFade } : undefined
  // 등장: 먼저 불로 된 몸이 타오르고 → 그 속에서 몸이 드러난다
  const entry = g.state === 'entry', look = behind ? V.behindAlpha : 1, alpha = look * (entry ? smooth((f.rise - .3) / .6) : 1), fire = entry ? look * smooth(f.rise / .25) * (1 - smooth((f.rise - .45) / .55)) : 0
  if (!drawBody(ctx, images, g, f, alpha, fire, prev)) return false
  drawHemFlames(ctx, images, g, f, alpha)
  drawSmear(ctx, images, g, f)
  drawBells(ctx, images, g, f)
  drawBreaks(ctx, images, g)
  drawPartBars(ctx, g)
  return true
}
/** 방울이 울리는 때 — 방울·가로 화염의 몸 예고(한 번) · 세 걸음 추격(연타) · 막 전환 · 등장 */
function drawBells(ctx: CanvasRenderingContext2D, images: Images, g: ShamanState, f: ShamanFrame) {
  if (brokenOf(g, 'bell')) return
  const a = g.attack, c = bellAt(f)
  if (g.state === 'entry') { const t = g.age; for (const at of [.05, .3, .55]) bellRing(ctx, images, c, t - at, V.bellRing * 2.4); return }
  if (g.state === 'roar') { const t = S.roarSeconds - g.timer; for (const at of [0, .2, .4]) bellRing(ctx, images, c, t - at, V.bellRing * 1.3); return }
  if (!a) return
  const since = g.state === 'body' ? a.windup.body - g.timer : -1
  if (a.move === 'sweep' && g.state === 'body') bellRing(ctx, images, c, since - a.windup.body * .3)
  if (a.move === 'chase' && (g.state === 'body' || g.state === 'hold' || g.state === 'tell')) { const t = g.age % .22; bellRing(ctx, images, c, t, V.bellRing * .8) }
}
/** 부서진 순간 — 불꽃 터짐 · 부채·방울은 손에서 떨어져 구르고 허리 장식은 끊어져 떨어진다 (판 시각으로만) */
function drawBreaks(ctx: CanvasRenderingContext2D, images: Images, g: ShamanState) {
  const fl = images.get(FLAME)
  for (const [key, at] of Object.entries(g.brokenAt) as [ShamanHp, number][]) {
    const dt = g.age - at, part = g.pose.parts.find(p => shamanHpOf(p.id) === key); if (!part || dt < 0 || key === 'head') continue
    const c = part.collider.kind === 'ellipse' ? part.collider.center : part.end
    if (dt < V.breakLife) {
      const u = dt / V.breakLife, r = V.breakSize * (.3 + u)
      ctx.save(); ctx.globalAlpha = 1 - u; ctx.strokeStyle = '#ffcf7a'; ctx.lineWidth = 6 * (1 - u) + 1
      ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, TAU); ctx.stroke()
      ctx.globalCompositeOperation = 'lighter'
      for (let i = 0; i < 10; i++) { const a = i * TAU / 10 + at, d = r * (.4 + .6 * u); flame(ctx, fl, c.x + Math.cos(a) * d, c.y + Math.sin(a) * d, 70 * (1 - u) + 14, 1 - u) }
      flame(ctx, fl, c.x, c.y + 20, 150 * Math.sin(Math.PI * Math.min(1, u * 1.6)), 1 - u)
      ctx.restore()
    }
    if (dt < V.dropLife) {
      // 떨어지는 조각 — 부채는 부채 팔 그림의 부채만 · 방울은 방울 팔 그림의 방울만 · 허리 장식은 통째로
      const name: ShamanPiece = key === 'fan' ? 'fan-arm' : key === 'bell' ? 'bell-arm' : 'waist', img = images.get(SHAMAN_ART[name]); if (!img) continue
      const u = dt / V.dropLife, size = SHAMAN_SOURCE[name].size, [sx, sy, sw, sh] = key === 'fan' ? [size[0] * .55, 0, size[0] * .45, size[1]] : key === 'bell' ? [size[0] * .6, size[1] * .28, size[0] * .4, size[1] * .72] : [0, 0, size[0], size[1]]
      const scale = key === 'waist' ? V.waist.scale : V.smear[key].scale
      ctx.save(); ctx.globalAlpha = 1 - u * u; ctx.translate(c.x - g.pose.facing * u * 30, c.y + u * u * V.dropFall); ctx.rotate(u * V.dropSpin * (key === 'bell' ? -1 : 1)); ctx.scale(g.pose.facing * scale, scale)
      ctx.drawImage(img, sx, sy, sw, sh, -sw / 2, -sh / 2, sw, sh); ctx.restore()
    }
  }
}
/** 부위 체력 — 깎였지만 아직 남은 부위 곁에만 (화면 글 없음) */
function drawPartBars(ctx: CanvasRenderingContext2D, g: ShamanState) {
  const v = G.view
  ctx.save()
  for (const key of Object.keys(g.partHP) as ShamanHp[]) {
    const hp = g.partHP[key], max = g.partMax[key]; if (!(max > 0 && hp > 0 && hp < max)) continue
    const part = g.pose.parts.find(p => shamanHpOf(p.id) === key && p.visible); if (!part) continue
    const c = part.collider.kind === 'ellipse' ? point(part.collider.center.x, part.collider.center.y - part.collider.ry) : point((part.start.x + part.end.x) / 2, Math.min(part.start.y, part.end.y) - part.collider.radius)
    const x = c.x - v.partHpWidth / 2, y = c.y - v.partHpLift - v.partHpHeight
    ctx.fillStyle = FX.foe.rimDark; ctx.fillRect(x, y, v.partHpWidth, v.partHpHeight); ctx.fillStyle = FX.own.rim; ctx.fillRect(x, y, v.partHpWidth * hp / max, v.partHpHeight)
  }
  ctx.restore()
}
/**
 * 쓰러짐 (승리 막 내림 동안 · 판은 이미 끝났다) — 마지막 자세에서 무릎이 꺾이듯 주저앉고 불이 사위며 불티로 흩어진다.
 * 판 상태는 읽기만: 같은 변환으로 그림용 자세를 새로 만든다.
 */
export function drawShamanFall(ctx: CanvasRenderingContext2D, images: Images, g: ShamanState, elapsed: number): void {
  const u = unit(elapsed / V.fallSeconds); if (u >= 1) return
  const c = g.motion.current, F = V.fall, k = 1 - (1 - u) * (1 - u)
  const f: ShamanFrame = { ...c, key: 0, spin: 0, turn: 0, lean: c.lean + F.lean * k, lift: c.lift + F.lift * k, squash: F.squash * k, flare: .1, rise: 1 - Math.max(0, u - V.fallHold) / (1 - V.fallHold) }
  const alpha = u < V.fallHold ? 1 : 1 - (u - V.fallHold) / (1 - V.fallHold)
  // 옅어지며 불로 사위어 간다
  drawBody(ctx, images, g, f, alpha, Math.sin(Math.PI * unit((u - V.fallHold * .6) / (1 - V.fallHold * .6))) * .9)
  // 불티: 몸에서 흩어져 오른다
  const fl = images.get(FLAME), body = makeShamanPose(f, { ownerId: g.pose.ownerId, tick: g.pose.tick, alive: true, targetable: false, recovering: false, partHP: g.partHP }).parts.find(p => p.id === 'root')
  if (!fl || !body) return
  ctx.save(); ctx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < 18; i++) {
    const ph = (u * 1.8 + rnd(i, 7)) % 1, x = body.start.x + (rnd(i, 8) - .5) * 160, y = body.end.y + 140 - ph * 260
    flame(ctx, fl, x + Math.sin(elapsed * 3 + i) * 14, y, 18 * (1 - ph), (1 - u) * Math.sin(Math.PI * ph))
  }
  ctx.restore()
}

// ── 땅 ──
/** 땅에 붙은 것 — 발밑 그림자 · 등장 불 고리와 불기둥 · 원무 동안 몸 둘레를 도는 불길 */
export function drawShamanGround(ctx: CanvasRenderingContext2D, images: Images, g: ShamanState): void {
  if (g.state === 'dead') return
  const f = g.pose.frame, fl = images.get(FLAME)
  ctx.save()
  ctx.globalAlpha = V.shadowAlpha * smooth(f.rise * 2); ctx.fillStyle = '#140805'; ctx.beginPath(); ctx.ellipse(f.x, f.y + 4, V.shadowWidth * (1 + f.flare * .25), V.shadowHeight, 0, 0, TAU); ctx.fill()
  if (g.state === 'entry') {
    // 방울이 울리고 → 땅에 불 고리가 피어나고 → 그 가운데 불기둥에서 걸어 나온다
    const k = 1 - g.timer / S.entrySeconds, bloom = smooth((k - .12) / .4), r = V.ringBloom * bloom, home = g.motion.from, fade = 1 - smooth((k - .82) / .18)
    if (bloom > 0) {
      ctx.globalAlpha = .55 * fade; ctx.strokeStyle = '#ff8a3a'; ctx.lineWidth = 10; ctx.beginPath(); ctx.ellipse(home.x, home.y, r, r * .42, 0, 0, TAU); ctx.stroke()
      ctx.globalCompositeOperation = 'lighter'
      for (let i = 0; i < 22; i++) { const a = i * TAU / 22, ph = (g.age * 1.6 + rnd(i, 3)) % 1; flame(ctx, fl, home.x + Math.cos(a) * r, home.y + Math.sin(a) * r * .42, (40 + 30 * rnd(i, 4)) * (1 - .4 * ph) * bloom, fade * (.6 + .4 * Math.sin(Math.PI * ph))) }
      const column = smooth((k - .18) / .2) * (1 - smooth((k - .66) / .22))
      for (let i = 0; i < 7; i++) flame(ctx, fl, home.x - home.facing * S.motion.entry.walk + (i - 3) * 24, home.y + 6, (340 + 70 * Math.sin(g.age * 7 + i * 1.3)) * column * (1 - Math.abs(i - 3) * .12), column * .9)
    }
  } else if (g.state === 'body' && g.attack?.move === 'ring') {
    // 원무: 옷자락이 그리는 불길이 몸 둘레를 돈다 (그리기만 · 바닥 판정은 붉은 고리)
    const p = 1 - g.timer / g.attack.windup.body, r = 80 + 120 * p
    ctx.globalCompositeOperation = 'lighter'
    for (let i = 0; i < 10; i++) { const a = f.spin * TAU + i * TAU / 10; flame(ctx, fl, f.x + Math.cos(a) * r, f.y + Math.sin(a) * r * .42, 26 + 12 * rnd(i, 5), .7 * Math.sin(Math.PI * p)) }
  }
  ctx.restore()
}

// ── 붉은 예고 · 불 ──
/** 앞으로 칠 자리(연타의 다음 줄·호) — 붉게 칠하지 않고 점선만 (붉은 바닥은 실제 피해와 같다) */
function outline(ctx: CanvasRenderingContext2D, shapes: readonly Shape[]) {
  ctx.save(); ctx.setLineDash([10, 9]); ctx.strokeStyle = FX.foe.line; ctx.globalAlpha = .55; ctx.lineWidth = 2
  for (const s of shapes) {
    ctx.beginPath()
    if (s.kind === 'box') { const c = Math.cos(s.angle), n = Math.sin(s.angle); [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([u, v], i) => { const x = s.center.x + c * u! * s.halfX - n * v! * s.halfY, y = s.center.y + n * u! * s.halfX + c * v! * s.halfY; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y) }); ctx.closePath() }
    else if (s.kind === 'arc') { ctx.arc(s.center.x, s.center.y, s.outer, s.angle - s.halfAngle, s.angle + s.halfAngle); ctx.arc(s.center.x, s.center.y, s.inner, s.angle + s.halfAngle, s.angle - s.halfAngle, true); ctx.closePath() }
    else if (s.kind === 'cone') { ctx.moveTo(s.center.x, s.center.y); ctx.arc(s.center.x, s.center.y, s.radius, s.angle - s.halfAngle, s.angle + s.halfAngle); ctx.closePath() }
    else if (s.kind === 'circle') ctx.arc(s.center.x, s.center.y, s.radius, 0, TAU)
    ctx.stroke()
  }
  ctx.restore()
}
/** 붉은 바닥(판의 고정 모양 그대로) · 막 환경 불 · 앞으로 칠 자리 점선 · 그리고 그 위의 불 (휘두른 불길 · 불 고리 · 불기둥 · 불벽) */
export function drawShamanThreats(ctx: CanvasRenderingContext2D, images: Images, g: ShamanState): void {
  if (g.state === 'dead') return
  const a = g.attack, fl = images.get(FLAME)
  if (g.state !== 'entry') { drawImugiThreats(ctx, g.environment.shapes); drawEnvFire(ctx, fl, g) }
  if (!a) return
  if (g.state === 'tell' || g.state === 'strike') drawImugiThreats(ctx, a.shapes)
  // 몸 예고 동안엔 바닥이 없다 · 붉은 바닥이 뜬 뒤에야 다음 타(연타)의 자리를 점선으로
  if (g.state === 'tell' || g.state === 'strike') outline(ctx, a.subs.slice(a.sub + 1).flatMap(s => s.shapes))
  if (g.state !== 'strike') return
  const p = g.motion.progress, s = a.subs[a.sub]!, hit = unit((p - s.impactAt) / Math.max(1e-6, 1 - s.impactAt))
  ctx.save(); ctx.globalCompositeOperation = 'lighter'
  const shape = s.shapes[0]
  if (a.move === 'sweep' && shape?.kind === 'cone') {
    // 부채가 지나간 자리로 불길이 가로로 번진다
    for (let i = 0; i < 9; i++) for (let j = 0; j < 3; j++) { const t = i / 8, ang = shape.angle - shape.halfAngle + 2 * shape.halfAngle * t, d = shape.radius * (.45 + .25 * j); if (t > p / Math.max(.01, s.impactAt) + .1) continue; flame(ctx, fl, shape.center.x + Math.cos(ang) * d, shape.center.y + Math.sin(ang) * d, 44 + 20 * rnd(i + j * 9, 1), (1 - hit) * .9) }
  } else if (a.move === 'ring' && shape?.kind === 'arc') {
    const n = 30, r = (shape.inner + shape.outer) / 2
    for (let i = 0; i <= n; i++) { const ang = shape.angle - shape.halfAngle + 2 * shape.halfAngle * i / n; flame(ctx, fl, shape.center.x + Math.cos(ang) * r, shape.center.y + Math.sin(ang) * r, (60 + 26 * Math.sin(g.age * 9 + i)) * smooth(p / .25), (1 - smooth((p - .7) / .3)) * .95) }
  } else if (a.move === 'pillars') {
    // 불기둥: 땅에서 솟구쳐 길게 선다 (가운데가 가장 높다)
    const rise = smooth((p - s.impactAt * .6) / (s.impactAt * .5)) * (1 - smooth((p - .8) / .2) * .6)
    for (const c of a.centers ?? []) for (let i = 0; i < 5; i++) flame(ctx, fl, c.x + (i - 2) * 16, c.y + 12, V.pillar * (1 - Math.abs(i - 2) * .18) * (.85 + .15 * Math.sin(g.age * 11 + i)) * rise, .95)
  } else if (a.move === 'chase' && shape?.kind === 'box') {
    const c = Math.cos(shape.angle), n = Math.sin(shape.angle)
    for (let i = 0; i < 8; i++) { const t = i / 7 - .5, along = t * shape.halfX * 2; if (t + .5 > p * 1.4) continue; flame(ctx, fl, shape.center.x + c * along, shape.center.y + n * along, 70 + 20 * rnd(i, 2), 1 - hit * .8) }
  } else if (a.move === 'twin' && (shape?.kind === 'cone' || shape?.kind === 'arc')) {
    const inner = shape.kind === 'arc' ? shape.inner : 0, outer = shape.kind === 'arc' ? shape.outer : shape.radius, r = (inner + outer) / 2 + (shape.kind === 'cone' ? 10 : 0), n = 22
    for (let i = 0; i <= n; i++) { const t = i / n; if (t > p * 1.5) continue; const ang = shape.angle - shape.halfAngle + 2 * shape.halfAngle * t; flame(ctx, fl, shape.center.x + Math.cos(ang) * r, shape.center.y + Math.sin(ang) * r, 54 + 18 * rnd(i, 6), 1 - hit) }
  } else if (a.move === 'pulse' && a.bands) {
    // 지금 타는 띠는 불벽 · 이미 탄 띠는 잦아든다
    const n = a.bands.length
    a.bands.forEach((band, k) => {
      const local = p * n - k; if (local < 0) return
      const heat = local < 1 ? smooth(local / .2) : .45 * (1 - smooth((local - 1) / 1.5))
      // 불벽: 띠 안에 엇갈려 선 불꽃 (줄마다 반 칸 어긋나고 높이·자리가 조금씩 다르다)
      for (const b of band) if (b.kind === 'box') for (let j = 0; j < 5; j++) for (let i = 0; i < 6; i++) {
        const n = i + j * 7 + k * 31, x = b.center.x - b.halfX + (i + .25 + .5 * (j % 2) + (rnd(n, 5) - .5) * .4) * b.halfX * 2 / 6.5, y = (j + .9 + (rnd(n, 6) - .5) * .5) * H / 5
        flame(ctx, fl, x, y, V.band * (.6 + .4 * rnd(n, 4)) * (.9 + .1 * Math.sin(g.age * 9 + n)), heat)
      }
    })
  }
  ctx.restore()
}
/** 막 환경 불 — 붉은 띠 위에 낮은 불꽃 (막3 양옆 불벽은 위에서 아래로 차례로 솟는 맥동) */
function drawEnvFire(ctx: CanvasRenderingContext2D, fl: HTMLImageElement | undefined, g: ShamanState) {
  const e = g.environment; if (!fl) return
  const on = e.active ? 1 : .35 * unit(e.age / G.environmentTell)
  ctx.save(); ctx.globalCompositeOperation = 'lighter'
  const shapes = e.shapes.flatMap(s => s.kind === 'union' ? s.shapes : [s])
  shapes.forEach((s, k) => {
    if (s.kind !== 'box') return
    const long = Math.max(s.halfX, s.halfY), n = Math.max(2, Math.round(long / 46)), vertical = s.halfY > s.halfX
    for (let i = 0; i < n; i++) {
      const t = (i + .5) / n, x = vertical ? s.center.x : s.center.x - s.halfX + t * s.halfX * 2, y = vertical ? s.center.y - s.halfY + t * s.halfY * 2 : s.center.y
      const pulse = e.phase === 3 ? .5 + .5 * Math.sin((g.age * 1.3 - t) * TAU) : .75 + .25 * Math.sin(g.age * 6 + i + k)
      flame(ctx, fl, x, y + 6, (e.phase === 3 ? 70 : 34) * pulse * (.7 + .3 * rnd(i, k)), on * .8)
    }
  })
  ctx.restore()
}
/** 시험: 몸 그림을 그리는 캔버스 변환 (판정의 shamanPoint 와 같은 점을 내야 한다) */
export const shamanBodySpace = bodySpace
