/**
 * 55 백두 대호 그리기 — 판 상태를 읽기만 한다 (뼈 · 고정 붉은 예고 · 판 시각 age). 화면 시계·난수 없음.
 * 판정과 같은 뼈(tiger.ts tigerSkeleton) 위에 부위 그림을 얹는다: 먼 쪽 다리 → 꼬리 → 몸 → 화살 묶음 → 목 → 아래턱 → 머리 → 가까운 쪽 다리.
 */
import { HAEBI_TIGER as T, HAEBI_GIANT as G, HAEBI_FX as FX, HAEBI_RUN as C } from '../tune/params.ts'
import type { Point } from './giant-core.ts'
import { TIGER_ART, TIGER_SOCKETS as S, TIGER_SOURCE, bakedPoint, type TigerPiece } from './tiger-art.ts'
import { makeTigerPose, tigerHpOf, type TigerPose, type TigerState, type TigerHp, type LegId } from './tiger.ts'
import { drawImugiThreats } from './imugi-view.ts'

const RK = T.rig.scale, V = T.view, TAU = Math.PI * 2
const point = (x: number, y: number): Point => ({ x, y })
const unit = (x: number) => Math.max(0, Math.min(1, x))
interface Item { readonly piece: TigerPiece; readonly at: Point; readonly angle: number; readonly pivot: readonly [number, number]; readonly sx: number; readonly sy: number; readonly shade: boolean; readonly src?: readonly [number, number, number, number] }
type Pin = 'body' | 'head' | 'head-roar' | 'jaw' | 'arrows'
type Bone = 'neck' | `${LegId}-upper` | `${LegId}-lower` | 'tail-tip'
const worldPerPx = (piece: TigerPiece, scale: number) => scale * RK * TIGER_SOURCE[piece].crop[2] / TIGER_SOURCE[piece].size[0]
function pin(piece: Pin, at: Point, angle: number, shade = false): Item {
  const s = S[piece], k = worldPerPx(piece, s.scale)
  return { piece, at, angle: angle + s.turn, pivot: bakedPoint(piece, s.pivot), sx: k, sy: k, shade }
}
function bone(piece: Bone, from: Point, to: Point, shade = false): Item {
  const s = S[piece], a = bakedPoint(piece, s.from), b = bakedPoint(piece, s.to), k = Math.hypot(to.x - from.x, to.y - from.y) / Math.hypot(b[0] - a[0], b[1] - a[1])
  return { piece, at: from, angle: Math.atan2(to.y - from.y, to.x - from.x) - Math.atan2(b[1] - a[1], b[0] - a[0]), pivot: a, sx: k, sy: k * s.thick, shade }
}
function slice(i: number, from: Point, to: Point, shade: boolean): Item {
  const s = S['tail-seg'], [x0, x1] = s.slices[i]!, a = bakedPoint('tail-seg', [x0, s.axisY[i]!]), b = bakedPoint('tail-seg', [x1, s.axisY[i]!]), size = TIGER_SOURCE['tail-seg'].size
  const k = Math.hypot(to.x - from.x, to.y - from.y) / Math.hypot(b[0] - a[0], b[1] - a[1]), left = Math.max(0, a[0]), right = Math.min(size[0], b[0])
  return { piece: 'tail-seg', at: from, angle: Math.atan2(to.y - from.y, to.x - from.x) - Math.atan2(b[1] - a[1], b[0] - a[0]), pivot: [a[0] - left, a[1]], sx: k, sy: k * s.thick, shade, src: [left, 0, right - left, size[1]] }
}
/** 그릴 조각 차례 (몸 쪽 좌표) — 그림과 카메라 경계가 같은 것을 쓴다 */
export function tigerLayout(pose: TigerPose, partHP: Readonly<Record<TigerHp, number>>): Item[] {
  const sk = pose.sk, broken = (id: TigerHp) => partHP[id] <= 0, items: Item[] = []
  const leg = (id: LegId) => { const l = sk.legs[id]; items.push(bone(`${id}-upper`, l.root, l.joint, broken(id)), bone(`${id}-lower`, l.joint, l.paw, broken(id))) }
  leg('hind-far'); leg('fore-far')
  for (let i = 0; i < 3; i++) items.push(slice(i, sk.tail[i]!, sk.tail[i + 1]!, broken('tail')))
  items.push(bone('tail-tip', sk.tail[3]!, sk.tail[4]!, broken('tail')))
  items.push(pin('body', sk.body.at, sk.body.angle))
  if (!broken('arrows')) items.push(pin('arrows', sk.arrows.at, sk.arrows.angle))
  items.push(bone('neck', sk.neck.from, sk.neck.to))
  const roar = sk.head.roar > .5
  if (!roar) items.push(pin('jaw', sk.jaw.at, sk.jaw.angle, broken('jaw')))
  items.push(pin(roar ? 'head-roar' : 'head', sk.head.at, sk.head.angle, broken('head')))
  leg('hind-near'); leg('fore-near')
  return items
}
function corners(it: Item): Point[] {
  const size = TIGER_SOURCE[it.piece].size, [x, y, w, h] = it.src ?? [0, 0, size[0], size[1]], c = Math.cos(it.angle), s = Math.sin(it.angle)
  return [[0, 0], [w, 0], [w, h], [0, h]].map(([u, v]) => { const px = (u! + (it.src ? 0 : x) - it.pivot[0]) * it.sx, py = (v! + (it.src ? 0 : y) - it.pivot[1]) * it.sy; return point(it.at.x + c * px - s * py, it.at.y + s * px + c * py) })
}
const squash = (pose: TigerPose) => 1 - pose.turn * V.turnSquash
const sinkY = (pose: TigerPose) => pose.sink * V.sinkDepth * RK
const toWorld = (pose: TigerPose, p: Point) => point(pose.anchor.x + pose.facing * squash(pose) * p.x, pose.anchor.y + p.y + sinkY(pose))
/**
 * 원래 그림 크기의 경계 (카메라가 온몸을 담는다) — 그리기만 · 판 상태를 바꾸지 않는다.
 * 카메라는 싸움 내내 가장 작은 배율을 지키므로, 하늘에서 내려오는 등장은 내려앉을 자리로 · 눈 속에 잠긴 몸은 땅 위 자리로 잰다 (가려진 몸 때문에 판이 작아지지 않게).
 */
export function tigerVisualBounds(g: TigerState): { left: number; top: number; right: number; bottom: number } | null {
  if (g.state === 'dead') return null
  const pose = g.state === 'entry' ? makeTigerPose({ ...g.motion.from, hop: 0, sink: 0 }, { ownerId: g.pose.ownerId, tick: g.pose.tick, alive: true, targetable: false, recovering: false, partHP: g.partHP }) : g.pose
  const flat = { ...pose, sink: 0 }, pts = tigerLayout(pose, g.partHP).flatMap(it => corners(it).map(p => toWorld(flat, p)))
  return pts.length ? { left: Math.min(...pts.map(p => p.x)), top: Math.min(...pts.map(p => p.y)), right: Math.max(...pts.map(p => p.x)), bottom: Math.max(...pts.map(p => p.y)) } : null
}
/** 부서진 부위는 어둡게 (그림마다 한 번 굽는다 · DOM 이 없으면 원본) */
const shaded = new WeakMap<object, CanvasImageSource>()
function shadeOf(img: HTMLImageElement): CanvasImageSource {
  const hit = shaded.get(img); if (hit) return hit
  if (typeof document === 'undefined') return img
  const c = document.createElement('canvas'); c.width = img.naturalWidth || img.width; c.height = img.naturalHeight || img.height
  const x = c.getContext('2d'); if (!x) return img
  x.drawImage(img, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = V.brokenShade; x.fillRect(0, 0, c.width, c.height)
  shaded.set(img, c); return c
}
/** 외곽선용 한 색 실루엣 (그림마다 한 번 굽는다) */
const inked = new WeakMap<object, CanvasImageSource>()
function inkOf(img: HTMLImageElement): CanvasImageSource | null {
  const hit = inked.get(img); if (hit) return hit
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas'); c.width = img.naturalWidth || img.width; c.height = img.naturalHeight || img.height
  const x = c.getContext('2d'); if (!x) return null
  x.drawImage(img, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = V.outlineColor; x.fillRect(0, 0, c.width, c.height)
  inked.set(img, c); return c
}
export interface TigerViewOptions { readonly heroX: number; readonly heroY: number }
/** 몸 — 돌아서는 순간 가로로 눌렸다 펴지고, 눈 속에 잠기면 땅 아래로 가린다 · 장수가 몸 뒤에 서면 옅게 */
export function drawTiger(ctx: CanvasRenderingContext2D, images: ReadonlyMap<string, HTMLImageElement>, g: TigerState, o: TigerViewOptions): boolean {
  if (g.state === 'dead' || g.pose.sink >= 1) return false
  const b = tigerVisualBounds(g), behind = !!b && o.heroY < g.pose.anchor.y - V.behindPad && o.heroX > b.left && o.heroX < b.right && o.heroY > b.top
  if (!drawPose(ctx, images, g, g.pose, behind ? V.behindAlpha : 1)) return false
  drawBreaks(ctx, images, g)
  drawPartBars(ctx, g)
  return true
}
/**
 * 쓰러짐 (승리 막 내림 동안 · 판은 이미 끝났다) — 마지막 자세에서 앞다리가 꺾이고 몸이 눈 위로 무너지며 옅어진다.
 * 판 상태는 읽기만: 같은 순수 뼈 셈(makeTigerPose)으로 그림용 자세를 새로 만든다.
 */
export function drawTigerFall(ctx: CanvasRenderingContext2D, images: ReadonlyMap<string, HTMLImageElement>, g: TigerState, elapsed: number): void {
  const u = unit(elapsed / V.fallSeconds); if (u >= 1) return
  const c = g.motion.current, F = V.fall, k = 1 - (1 - u) * (1 - u)
  const f = { ...c, lift: c.lift + F.lift * RK * k, pitch: c.pitch - F.pitch * k, neck: c.neck + F.neck * k, head: c.head + F.head * k, jaw: Math.max(c.jaw, F.jaw * k), roar: 0, sink: 0, hop: 0, turn: 0,
    paw: c.paw.map((v, i) => v + (F.paw[i] ?? 0) * RK * k), tail: c.tail.map((v, i) => v + (F.tail[i] ?? 0) * k) }
  const pose = makeTigerPose(f, { ownerId: g.pose.ownerId, tick: g.pose.tick, alive: true, targetable: false, recovering: false, partHP: g.partHP })
  drawPose(ctx, images, g, pose, u < V.fallHold ? 1 : 1 - (u - V.fallHold) / (1 - V.fallHold))
}
function drawPose(ctx: CanvasRenderingContext2D, images: ReadonlyMap<string, HTMLImageElement>, g: TigerState, pose: TigerPose, alpha: number): boolean {
  const items = tigerLayout(pose, g.partHP)
  if (items.some(it => !images.get(TIGER_ART[it.piece]))) return false
  ctx.save()
  try {
    ctx.globalAlpha *= alpha
    ctx.translate(pose.anchor.x, pose.anchor.y + sinkY(pose)); ctx.scale(pose.facing * squash(pose), 1)
    if (pose.sink > 0) { ctx.beginPath(); ctx.rect(-2000, -2000, 4000, 2000 + V.sinkClip * RK - sinkY(pose)); ctx.clip() }
    // 외곽선: 모든 부위의 어두운 실루엣을 둘레로 먼저 찍고 그 위에 몸 (흰 범이 흰 눈에 묻히지 않게 · GAP §15-6)
    const a0 = ctx.globalAlpha; ctx.globalAlpha = a0 * V.outlineAlpha
    for (const it of items) {
      const ink = inkOf(images.get(TIGER_ART[it.piece])!); if (!ink) break
      for (let d = 0; d < V.outlineDirs; d++) {
        const t = d * TAU / V.outlineDirs, ox = Math.cos(t) * V.outlinePx / Math.abs(it.sx), oy = Math.sin(t) * V.outlinePx / Math.abs(it.sy)
        ctx.save(); ctx.translate(it.at.x, it.at.y); ctx.rotate(it.angle); ctx.scale(it.sx, it.sy)
        if (it.src) ctx.drawImage(ink, it.src[0], it.src[1], it.src[2], it.src[3], -it.pivot[0] + ox, -it.pivot[1] + oy, it.src[2], it.src[3])
        else ctx.drawImage(ink, -it.pivot[0] + ox, -it.pivot[1] + oy)
        ctx.restore()
      }
    }
    ctx.globalAlpha = a0
    for (const it of items) {
      const img = images.get(TIGER_ART[it.piece])!, src: CanvasImageSource = it.shade ? shadeOf(img) : img
      ctx.save(); ctx.translate(it.at.x, it.at.y); ctx.rotate(it.angle); ctx.scale(it.sx, it.sy)
      if (it.src) ctx.drawImage(src, it.src[0], it.src[1], it.src[2], it.src[3], -it.pivot[0], -it.pivot[1], it.src[2], it.src[3])
      else ctx.drawImage(src, -it.pivot[0], -it.pivot[1])
      ctx.restore()
    }
    if (g.state !== 'dead') drawBreath(ctx, g, pose)
  } finally { ctx.restore() }
  return true
}
/** 서린 입김 — 판 시각으로 몇 개만 (회복 중엔 헐떡여 잦게) */
function drawBreath(ctx: CanvasRenderingContext2D, g: TigerState, pose: TigerPose) {
  const every = g.state === 'recover' ? V.puffRecover : V.puffEvery, n = Math.floor(g.age / every), m = pose.sk.mouth
  ctx.save(); ctx.fillStyle = V.snowRim
  for (let k = 0; k < 3; k++) {
    const t = g.age - (n - k) * every; if (t < 0 || t > V.puffLife) continue
    const u = t / V.puffLife, r = V.puffSize * RK * (.5 + u)
    ctx.globalAlpha = V.puffAlpha * (1 - u)
    ctx.beginPath(); ctx.arc(m.x + u * V.puffRise * RK, m.y - u * V.puffRise * RK * .6, r, 0, TAU); ctx.fill()
  }
  ctx.restore()
}
/** 부서진 순간 — 서리 터짐 · 화살 묶음은 등에서 떨어져 눈보라를 일으킨다 */
function drawBreaks(ctx: CanvasRenderingContext2D, images: ReadonlyMap<string, HTMLImageElement>, g: TigerState) {
  for (const [key, at] of Object.entries(g.brokenAt) as [TigerHp, number][]) {
    const dt = g.age - at
    const part = g.pose.parts.find(p => tigerHpOf(p.id) === key); if (!part) continue
    const c = part.collider.kind === 'ellipse' ? part.collider.center : point((part.start.x + part.end.x) / 2, (part.start.y + part.end.y) / 2)
    if (dt >= 0 && dt < V.breakLife) {
      const u = dt / V.breakLife, r = V.breakSize * RK * (.3 + u)
      ctx.save(); ctx.globalAlpha = 1 - u; ctx.strokeStyle = V.snowRim; ctx.lineWidth = 6 * (1 - u) + 1
      ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, TAU); ctx.stroke()
      ctx.fillStyle = V.snowRim
      for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + at, d = r * (.6 + .5 * u); ctx.beginPath(); ctx.arc(c.x + Math.cos(a) * d, c.y + Math.sin(a) * d, 4 * (1 - u) + 1.5, 0, TAU); ctx.fill() }
      ctx.restore()
    }
    if (key === 'arrows' && dt >= 0 && dt < V.fallLife) {
      const img = images.get(TIGER_ART.arrows); if (!img) continue
      const u = dt / V.fallLife, it = pin('arrows', g.pose.sk.arrows.at, g.pose.sk.arrows.angle), w = toWorld(g.pose, it.at)
      ctx.save(); ctx.globalAlpha = 1 - u * u; ctx.translate(w.x - g.pose.facing * u * V.fallDrift * RK, w.y + u * u * V.fallDrop * RK); ctx.scale(g.pose.facing, 1); ctx.rotate(it.angle - u * V.fallSpin); ctx.scale(it.sx, it.sy)
      ctx.drawImage(img, -it.pivot[0], -it.pivot[1]); ctx.restore()
    }
  }
}
/** 부위 체력 — 깎였지만 아직 남은 부위 곁에만 (화면 글 없음) */
function drawPartBars(ctx: CanvasRenderingContext2D, g: TigerState) {
  const v = G.view
  ctx.save()
  for (const key of Object.keys(g.partHP) as TigerHp[]) {
    const hp = g.partHP[key], max = g.partMax[key]; if (!(max > 0 && hp > 0 && hp < max)) continue
    const part = g.pose.parts.find(p => tigerHpOf(p.id) === key && p.visible); if (!part) continue
    const c = part.collider.kind === 'ellipse' ? point(part.collider.center.x, part.collider.center.y - part.collider.ry) : point((part.start.x + part.end.x) / 2, Math.min(part.start.y, part.end.y))
    const x = c.x - v.partHpWidth / 2, y = c.y - v.partHpLift - v.partHpHeight
    ctx.fillStyle = FX.foe.rimDark; ctx.fillRect(x, y, v.partHpWidth, v.partHpHeight); ctx.fillStyle = FX.own.rim; ctx.fillRect(x, y, v.partHpWidth * hp / max, v.partHpHeight)
  }
  ctx.restore()
}
/** 눈보라 터짐 — 퍼지는 눈 고리와 사방으로 튀는 눈 덩이 (u 0→1) */
function burst(ctx: CanvasRenderingContext2D, x: number, y: number, u: number, size: number) {
  if (u < 0 || u >= 1) return
  const r = size * (.35 + .9 * u)
  ctx.save(); ctx.globalAlpha = (1 - u) * .85; ctx.strokeStyle = V.snowRim; ctx.fillStyle = V.snowRim; ctx.lineWidth = 2 + 8 * (1 - u)
  ctx.beginPath(); ctx.ellipse(x, y, r, r * .38, 0, 0, TAU); ctx.stroke()
  for (let i = 0; i < 10; i++) { const a = i * TAU / 10 + .3, d = r * (.7 + .25 * Math.sin(i * 3.1)), h = size * .5 * Math.sin(Math.PI * u) * (.6 + .4 * Math.cos(i * 1.7)); ctx.beginPath(); ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * .38 - h, 3 + 5 * (1 - u), 0, TAU); ctx.fill() }
  ctx.restore()
}
/** 땅을 울린 뒤 몇 초까지의 눈보라 (등장 착지 · 덮치기 착지 · 잠행 솟구침 · 눈사태 내리찍기) — 판 상태(시각·박자)로만 */
function landingBurst(ctx: CanvasRenderingContext2D, g: TigerState) {
  const p = g.pose, size = V.landSize * RK
  if (g.state === 'entry') { const k = 1 - g.timer / T.entrySeconds; burst(ctx, p.anchor.x, p.anchor.y, (k - T.motion.entry.fall) / (1 - T.motion.entry.fall) * V.landSpan, size * 1.3); return }
  const move = g.state === 'strike' ? g.attack?.move : g.state === 'recover' ? g.last : null
  if (move !== 'pounce' && move !== 'dive' && move !== 'avalanche') return
  const m = T.moves[move], since = g.state === 'strike' ? (g.motion.progress - m.impactAt) * m.strike : (1 - m.impactAt) * m.strike + g.motion.recoverSeconds - g.timer
  const at = move === 'avalanche' ? point(p.anchor.x + p.facing * (T.rig.fore.paw[0] + 20) * RK, p.anchor.y) : p.anchor
  burst(ctx, at.x, at.y, since / V.landLife, size)
}
/** 땅에 붙은 것 — 큰 그림자 · 잠행의 눈 더미 셋(붉은 것은 진짜 하나만 · 붉은 예고 차례에) · 화살 묶음이 부서졌으면 진짜 더미 위로 꼬리 끝 */
export function drawTigerGround(ctx: CanvasRenderingContext2D, images: ReadonlyMap<string, HTMLImageElement>, g: TigerState): void {
  if (g.state === 'dead') return
  const p = g.pose, a = g.attack
  landingBurst(ctx, g)
  ctx.save()
  if (p.sink < 1) { ctx.globalAlpha = V.shadowAlpha * (1 - p.sink); ctx.fillStyle = '#0b1420'; ctx.beginPath(); ctx.ellipse(p.anchor.x - p.facing * V.shadowShift * RK, p.anchor.y + 4, V.shadowWidth * RK, V.shadowHeight * RK, 0, 0, TAU); ctx.fill() }
  if (a?.move === 'dive' && a.mounds && (g.state === 'body' || g.state === 'hold' || g.state === 'tell')) {
    const shown = g.state !== 'body' || 1 - g.timer / a.windup.body >= T.moves.dive.tailAt
    if (shown) a.mounds.forEach((m, i) => {
      ctx.globalAlpha = V.moundAlpha; ctx.fillStyle = '#c9d6e6'; ctx.beginPath(); ctx.ellipse(m.x, m.y + 6, V.moundWidth, V.moundHeight * .7, 0, 0, TAU); ctx.fill()
      ctx.fillStyle = V.snowRim; ctx.beginPath(); ctx.ellipse(m.x, m.y, V.moundWidth * .8, V.moundHeight, 0, Math.PI, TAU); ctx.fill()
      // 화살 묶음이 부서졌으면 진짜 더미에서 꼬리 끝이 먼저 솟는다 (붉은 바닥 전의 몸 예고)
      if (i === a.real && g.partHP.arrows <= 0) {
        const img = images.get(TIGER_ART['tail-tip'])
        if (img) { const it = bone('tail-tip', point(0, 0), point(0, -V.peekHeight * RK)); ctx.save(); ctx.globalAlpha = 1; ctx.translate(m.x, m.y - V.moundHeight * .4); ctx.rotate(it.angle); ctx.scale(it.sx, it.sy); ctx.drawImage(img, -it.pivot[0], -it.pivot[1]); ctx.restore() }
      }
    })
  }
  ctx.restore()
}
/** 붉은 예고(판의 고정 모양 그대로) · 막 환경 · 그리고 그 위의 눈(눈사태 앞머리 · 포효 눈보라 · 꼬리 눈발) */
export function drawTigerThreats(ctx: CanvasRenderingContext2D, g: TigerState): void {
  if (g.state === 'dead') return
  const a = g.attack
  if (g.state !== 'entry') drawImugiThreats(ctx, g.environment.shapes)
  if (a && (g.state === 'tell' || g.state === 'strike')) drawImugiThreats(ctx, a.shapes)
  if (!a || g.state !== 'strike') return
  const p = g.motion.progress
  ctx.save(); ctx.fillStyle = V.snowRim; ctx.strokeStyle = V.snowRim
  if (a.move === 'avalanche' && a.lines && (a.front ?? 0) > 0) {
    const half = T.moves.avalanche.width / 2, front = a.front ?? 0
    ctx.globalAlpha = V.frontAlpha
    for (const x of a.lines) {
      ctx.fillRect(x - half, 0, half * 2, front)
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(x - half + (i + .5) * half / 2, front, half / 3.2, 0, TAU); ctx.fill() }
    }
  } else if (a.move === 'roar') {
    const band = T.moves.roar.band * C.width
    ctx.globalAlpha = V.roarAlpha * (1 - p); ctx.lineWidth = 3
    for (const [x0, dir] of [[0, 1], [C.width - band, -1]] as const) for (let i = 0; i < 9; i++) {
      const y = (i + .5) * C.height / 9, x = x0 + band * ((i * .37 + p * 1.5) % 1)
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - dir * 60, y + 18); ctx.stroke()
    }
  } else if (a.move === 'tail') {
    const arc = a.shapes[0]
    if (arc?.kind === 'arc') { ctx.globalAlpha = .55 * (1 - p); ctx.lineWidth = (arc.outer - arc.inner) * .5; ctx.beginPath(); ctx.arc(arc.center.x, arc.center.y, (arc.inner + arc.outer) / 2, arc.angle - arc.halfAngle, arc.angle - arc.halfAngle + 2 * arc.halfAngle * unit(p * 1.6)); ctx.stroke() }
  }
  ctx.restore()
}
