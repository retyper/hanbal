/**
 * 57 불가사리 그리기 — 판 상태를 읽기만 한다 (뼈 · 고정 붉은 예고 · 판 시각 age). 화면 시계·난수 없음.
 * 판정과 같은 뼈(bulgasari.ts bulgasariSkeleton) 위에 부위 그림을 얹는 컷아웃 인형:
 * 먼 뒷다리 → 먼 앞다리 → 꼬리 → 먼 어깨 철판 → 몸통 살 → 등 철갑 → 가까운 뒷다리 → 가까운 앞다리 → 가까운 어깨 철판 → 아래턱 → (입 안) → 머리.
 * 조각마다 몸 쪽 좌표의 2×3 행렬 하나 — 그림·카메라 경계·검수 도구가 같은 행렬을 쓴다.
 */
import { HAEBI_BULGASARI as B, HAEBI_GIANT as G, HAEBI_FX as FX } from '../tune/params.ts'
import type { Point, Shape } from './giant-core.ts'
import { BULGASARI_ART, BULGASARI_SOCKETS as S, BULGASARI_SOURCE, bakedPerSource, bakedPoint, type BulgasariPiece } from './bulgasari-art.ts'
import { bulgasariHpOf, legRest, makeBulgasariPose, type BulgasariHp, type BulgasariPose, type BulgasariState, type LegId } from './bulgasari.ts'
import { drawImugiThreats } from './imugi-view.ts'

const K = B.rig.scale, V = B.view, TAU = Math.PI * 2
const point = (x: number, y: number): Point => ({ x, y })
const unit = (x: number) => Math.max(0, Math.min(1, x))
type XY = readonly [number, number]
/** x' = a·x + c·y + e · y' = b·x + d·y + f (캔버스 transform 과 같은 차례) */
export type Mat = readonly [number, number, number, number, number, number]
const mul = (m: Mat, n: Mat): Mat => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]]
const T = (x: number, y: number): Mat => [1, 0, 0, 1, x, y]
const Rm = (a: number): Mat => [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0]
const Sm = (x: number, y: number): Mat => [x, 0, 0, y, 0, 0]
export const apply = (m: Mat, x: number, y: number): Point => point(m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5])
/** 그릴 조각 하나 — 몸 쪽 좌표 행렬 · 부서져 어둡게 · 지울 다각형(구운 그림 px) · 짙기 */
export interface Item { readonly piece: BulgasariPiece; readonly m: Mat; readonly shade: boolean; readonly clip?: readonly XY[]; readonly alpha?: number }
/** 원본 1px 의 몸 쪽 크기 → 구운 그림 1px 의 크기 */
const worldPerBaked = (piece: BulgasariPiece, scale: number) => scale * K / bakedPerSource(piece)
type Pin = 'body' | 'back' | 'head' | 'jaw' | 'shoulder-near' | 'shoulder-far'
function pinMat(piece: Pin, at: Point, angle: number, sy = 1): Mat {
  const s = S[piece], k = worldPerBaked(piece, s.scale), p = bakedPoint(piece, s.pivot)
  return mul(mul(mul(T(at.x, at.y), Rm(angle + s.turn)), Sm(k, k * sy)), T(-p[0], -p[1]))
}
/** 다리 한 장 — 소켓→발 축으로만 줄고 늘며(무릎을 굽히는 듯) 굵기는 쉬는 길이 그대로 */
function legMat(id: LegId, root: Point, paw: Point): Mat {
  const s = S[id], a = bakedPoint(id, s.from), b = bakedPoint(id, s.to), img = Math.hypot(b[0] - a[0], b[1] - a[1])
  const r = legRest(id), rest = Math.hypot(r.paw.x - r.socket.x, r.paw.y - r.socket.y), now = Math.hypot(paw.x - root.x, paw.y - root.y)
  return mul(mul(mul(mul(T(root.x, root.y), Rm(Math.atan2(paw.y - root.y, paw.x - root.x))), Sm(now / img, rest / img * s.width)), Rm(-Math.atan2(b[1] - a[1], b[0] - a[0]))), T(-a[0], -a[1]))
}
function tailMat(root: Point, tip: Point): Mat {
  const s = S.tail, a = bakedPoint('tail', s.from), b = bakedPoint('tail', s.to), k = Math.hypot(tip.x - root.x, tip.y - root.y) / Math.hypot(b[0] - a[0], b[1] - a[1])
  return mul(mul(mul(T(root.x, root.y), Rm(Math.atan2(tip.y - root.y, tip.x - root.x) - Math.atan2(b[1] - a[1], b[0] - a[0]))), Sm(k, k)), T(-a[0], -a[1]))
}
const LIP = S.head.lip.map(p => bakedPoint('head', p))
/** 이만큼 벌어져야 아래턱 그림으로 바꾼다 (그 아래는 머리 그림의 다문 입) */
const JAW_SHOW = .06
/** 그릴 조각 차례 (몸 쪽 좌표) — 그림과 카메라 경계와 검수 도구가 같은 것을 쓴다 */
export function bulgasariLayout(pose: BulgasariPose, partHP: Readonly<Record<BulgasariHp, number>>): Item[] {
  const sk = pose.sk, broken = (id: BulgasariHp) => partHP[id] <= 0, items: Item[] = []
  const leg = (id: LegId) => { const l = sk.legs[id]; items.push({ piece: id, m: legMat(id, l.root, l.paw), shade: (id === 'fore-near' || id === 'fore-far') && broken(id) }) }
  const swell = 1 + sk.body.swell * .06
  leg('hind-far'); leg('fore-far')
  items.push({ piece: 'tail', m: tailMat(sk.tail.at, sk.tail.tip), shade: false })
  if (!broken('shoulder')) items.push({ piece: 'shoulder-far', m: pinMat('shoulder-far', point(sk.shoulder.at.x + B.rig.far[0] * K * 1.4, sk.shoulder.at.y + B.rig.far[1] * K * 1.6), sk.shoulder.angle), shade: false })
  items.push({ piece: 'body', m: pinMat('body', sk.body.at, sk.body.angle, swell), shade: false })
  if (!broken('back')) items.push({ piece: 'back', m: pinMat('back', sk.back.at, sk.body.angle), shade: false })
  leg('hind-near'); leg('fore-near')
  if (!broken('shoulder')) items.push({ piece: 'shoulder-near', m: pinMat('shoulder-near', sk.shoulder.at, sk.shoulder.angle), shade: false })
  // 다문 입은 머리 그림의 아랫입술 그대로 · 벌리면 그 입술을 지우고 아래턱 그림이 경첩에서 돌아 내려온다
  const open = sk.jaw.open > JAW_SHOW
  if (open) items.push({ piece: 'jaw', m: pinMat('jaw', sk.jaw.at, sk.jaw.angle - B.rig.jaw.angle), shade: broken('jaw') })
  items.push({ piece: 'head', m: pinMat('head', sk.head.at, sk.head.angle), shade: broken('head'), ...(open ? { clip: LIP } : {}) })
  return items
}
function corners(it: Item): Point[] {
  const [w, h] = BULGASARI_SOURCE[it.piece].size
  return [[0, 0], [w, 0], [w, h], [0, h]].map(([u, v]) => apply(it.m, u!, v!))
}
const squash = (pose: BulgasariPose) => 1 - pose.turn * V.turnSquash
const sinkY = (pose: BulgasariPose) => pose.sink * V.sinkDepth * K
const toWorld = (pose: BulgasariPose, p: Point) => point(pose.anchor.x + pose.facing * squash(pose) * p.x, pose.anchor.y + p.y + sinkY(pose))
/**
 * 원래 그림 크기의 경계 (카메라가 온몸을 담는다) — 그리기만 · 판 상태를 바꾸지 않는다.
 * 등장 동안은 내려설 자리로 · 땅속에 잠긴 몸은 땅 위 자리로 잰다 (가려진 몸 때문에 판이 작아지지 않게).
 */
export function bulgasariVisualBounds(g: BulgasariState): { left: number; top: number; right: number; bottom: number } | null {
  if (g.state === 'dead') return null
  const pose = g.state === 'entry' ? makeBulgasariPose({ ...g.motion.impact, hop: 0, sink: 0 }, { ownerId: g.pose.ownerId, tick: g.pose.tick, alive: true, targetable: false, recovering: false, partHP: g.partHP }) : g.pose
  const flat = { ...pose, sink: 0, turn: 0 }, pts = bulgasariLayout(pose, g.partHP).flatMap(it => corners(it).map(p => toWorld(flat, p)))
  return pts.length ? { left: Math.min(...pts.map(p => p.x)), top: Math.min(...pts.map(p => p.y)), right: Math.max(...pts.map(p => p.x)), bottom: Math.max(...pts.map(p => p.y)) } : null
}
/** 그림마다 한 번 굽는 덧칠 (부서진 다리·머리는 어둡게 · 벗겨진 살은 붉게) — DOM 이 없으면 원본 */
const tinted = new Map<string, WeakMap<object, CanvasImageSource>>()
function tintOf(img: HTMLImageElement, color: string): CanvasImageSource {
  let cache = tinted.get(color); if (!cache) { cache = new WeakMap(); tinted.set(color, cache) }
  const hit = cache.get(img); if (hit) return hit
  if (typeof document === 'undefined') return img
  const c = document.createElement('canvas'); c.width = img.naturalWidth || img.width; c.height = img.naturalHeight || img.height
  const x = c.getContext('2d'); if (!x) return img
  x.drawImage(img, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height)
  cache.set(img, c); return c
}
export interface BulgasariViewOptions { readonly heroX: number; readonly heroY: number }
/** 몸 — 장수가 몸 뒤에 서면 옅게 · 철갑이 벗겨진 살은 붉게 숨쉰다 · 부서진 철갑은 조각나 날아간다 */
export function drawBulgasari(ctx: CanvasRenderingContext2D, images: ReadonlyMap<string, HTMLImageElement>, g: BulgasariState, o: BulgasariViewOptions): boolean {
  if (g.state === 'dead' || g.pose.sink >= 1) return false
  const b = bulgasariVisualBounds(g), behind = !!b && o.heroY < g.pose.anchor.y - V.behindPad && o.heroX > b.left && o.heroX < b.right && o.heroY > b.top
  if (!drawPose(ctx, images, g, g.pose, behind ? V.behindAlpha : 1)) return false
  drawBreaks(ctx, images, g)
  drawPartBars(ctx, g)
  return true
}
/**
 * 쓰러짐 (승리 막 내림 동안 · 판은 이미 끝났다) — 마지막 자세에서 다리가 꺾이고 몸이 주저앉으며 옅어진다.
 * 판 상태는 읽기만: 같은 순수 뼈 셈(makeBulgasariPose)으로 그림용 자세를 새로 만든다.
 */
export function drawBulgasariFall(ctx: CanvasRenderingContext2D, images: ReadonlyMap<string, HTMLImageElement>, g: BulgasariState, elapsed: number): void {
  const u = unit(elapsed / V.fallSeconds); if (u >= 1) return
  const c = g.motion.current, F = V.fall, k = 1 - (1 - u) * (1 - u)
  const f = { ...c, lift: c.lift + F.lift * K * k, pitch: c.pitch + F.pitch * k, head: c.head + F.head * k, jaw: Math.max(c.jaw, F.jaw * k), sink: 0, hop: 0, turn: 0, swell: c.swell * (1 - k),
    paw: c.paw.map((v, i) => v + (F.paw[i] ?? 0) * K * k), tail: c.tail + F.tail * k }
  const pose = makeBulgasariPose(f, { ownerId: g.pose.ownerId, tick: g.pose.tick, alive: true, targetable: false, recovering: false, partHP: g.partHP })
  drawPose(ctx, images, g, pose, u < V.fallHold ? 1 : 1 - (u - V.fallHold) / (1 - V.fallHold))
}
/** 한 조각을 캔버스에 (행렬 · 지울 다각형 · 덧칠 · tint 를 주면 그 빛으로 구운 그림) */
function drawItem(ctx: CanvasRenderingContext2D, img: HTMLImageElement, it: Item, tint?: string) {
  const src: CanvasImageSource = tint ? tintOf(img, tint) : it.shade ? tintOf(img, V.brokenShade) : img
  ctx.save(); ctx.transform(it.m[0], it.m[1], it.m[2], it.m[3], it.m[4], it.m[5])
  if (it.alpha !== undefined) ctx.globalAlpha *= it.alpha
  if (it.clip) {
    const [w, h] = BULGASARI_SOURCE[it.piece].size
    ctx.beginPath(); ctx.rect(0, 0, w, h); it.clip.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.clip('evenodd')
  }
  ctx.drawImage(src, 0, 0)
  ctx.restore()
}
/** 턱이 벌어지면 윗입술과 아래턱 사이를 입 안 빛으로 메운다 (머리 그림의 아랫입술은 지운다) */
function mouthCavity(items: readonly Item[]): Point[] | null {
  const head = items.find(i => i.piece === 'head'), jaw = items.find(i => i.piece === 'jaw')
  if (!head?.clip || !jaw) return null
  const lip = S.head.lip, j = S.jaw, top = [lip[0]!, lip[1]!].map(p => bakedPoint('head', p)), low = [j.lipFront, j.lipBack].map(p => bakedPoint('jaw', p))
  return [apply(head.m, top[0]![0], top[0]![1]), apply(head.m, top[1]![0], top[1]![1]), apply(jaw.m, low[0]![0], low[0]![1]), apply(jaw.m, low[1]![0], low[1]![1])]
}
function drawPose(ctx: CanvasRenderingContext2D, images: ReadonlyMap<string, HTMLImageElement>, g: BulgasariState, pose: BulgasariPose, alpha: number): boolean {
  const items = bulgasariLayout(pose, g.partHP)
  if (items.some(it => !images.get(BULGASARI_ART[it.piece]))) return false
  ctx.save()
  try {
    ctx.globalAlpha *= alpha
    ctx.translate(pose.anchor.x, pose.anchor.y + sinkY(pose)); ctx.scale(pose.facing * squash(pose), 1)
    if (pose.sink > 0) { ctx.beginPath(); ctx.rect(-2000, -2000, 4000, 2000 + V.sinkClip * K - sinkY(pose)); ctx.clip() }
    const exposed = (['back', 'shoulder'] as const).some(id => g.partHP[id] <= 0) && g.state !== 'dead'
    const pulse = exposed ? V.exposedPulse * (.55 + .45 * Math.sin(g.age * TAU * V.exposedPulseHz)) : 0
    for (const it of items) {
      const img = images.get(BULGASARI_ART[it.piece])!
      if (it.piece === 'head') { const cave = mouthCavity(items); if (cave) { ctx.fillStyle = V.mouthColor; ctx.beginPath(); cave.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); ctx.fill() } }
      drawItem(ctx, img, it)
      // 철갑이 벗겨진 살 — 같은 몸 그림을 붉게 구워 한 번 더 (숨쉬듯 · 약점이 드러났다)
      if (it.piece === 'body' && pulse > 0) drawItem(ctx, img, { ...it, alpha: pulse }, V.exposedTint)
    }
  } finally { ctx.restore() }
  return true
}
/** 부서진 순간 — 철갑은 조각나 사방으로 날아가 떨어지고 · 쇠 불티가 튄다 · 다리·턱·머리는 불티만 */
function drawBreaks(ctx: CanvasRenderingContext2D, images: ReadonlyMap<string, HTMLImageElement>, g: BulgasariState) {
  const pose = g.pose, items = bulgasariLayout(pose, Object.fromEntries(Object.keys(g.partHP).map(k => [k, 1])) as Record<BulgasariHp, number>)
  for (const [key, at] of Object.entries(g.brokenAt) as [BulgasariHp, number][]) {
    const dt = g.age - at; if (dt < 0 || dt >= Math.max(V.plateLife, V.sparkLife)) continue
    const part = pose.parts.find(p => bulgasariHpOf(p.id) === key); if (!part) continue
    const c = part.collider.kind === 'ellipse' ? part.collider.center : point((part.start.x + part.end.x) / 2, (part.start.y + part.end.y) / 2)
    sparks(ctx, c.x, c.y, dt / V.sparkLife, at)
    if (key !== 'back' && key !== 'shoulder') continue
    // 철갑 조각: 그 그림을 칸으로 나눠 칸마다 다른 길로 날린다 (부서진 때로 정한 각 · 난수 없음)
    const u = dt / V.plateLife; if (u >= 1) continue
    const pieces: BulgasariPiece[] = key === 'back' ? ['back'] : ['shoulder-near']
    for (const piece of pieces) {
      const it = items.find(i => i.piece === piece), img = images.get(BULGASARI_ART[piece]); if (!it || !img) continue
      const [w, h] = BULGASARI_SOURCE[piece].size, cols = 4, rows = 2, t = dt
      ctx.save(); ctx.translate(pose.anchor.x, pose.anchor.y + sinkY(pose)); ctx.scale(pose.facing, 1); ctx.globalAlpha *= 1 - u * u
      for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
        const j = r * cols + q, sx = q * w / cols, sy = r * h / rows, cx = sx + w / cols / 2, cy = sy + h / rows / 2, mid = apply(it.m, cx, cy)
        const ang = -Math.PI * (q + .5) / cols + Math.sin(j * 2.1 + at) * .35, v = V.plateSpeed * (.6 + .4 * ((j * .618) % 1))
        const x = mid.x + Math.cos(ang) * v * t, y = mid.y - V.plateRise * t + Math.sin(ang) * v * t * .3 + V.plateGravity * t * t / 2, spin = (j % 2 ? 1 : -1) * V.plateSpin * t
        ctx.save(); ctx.translate(x, y); ctx.rotate(spin); ctx.transform(it.m[0], it.m[1], it.m[2], it.m[3], 0, 0)
        ctx.drawImage(img, sx, sy, w / cols, h / rows, -w / cols / 2, -h / rows / 2, w / cols, h / rows); ctx.restore()
      }
      ctx.restore()
    }
  }
}
/** 쇠 불티 — 판 시각으로 몇 개만 (u 0→1 · seed 는 그 일이 난 판 나이) */
function sparks(ctx: CanvasRenderingContext2D, x: number, y: number, u: number, seed: number) {
  if (u < 0 || u >= 1) return
  ctx.save(); ctx.strokeStyle = V.sparkColor; ctx.globalAlpha = 1 - u; ctx.lineWidth = 2.5 * (1 - u) + 1
  for (let i = 0; i < V.sparks; i++) {
    const a = i * TAU / V.sparks + Math.sin(seed * 7 + i) * .4, d = V.sparkSpeed * u * (.6 + .4 * ((i * .618 + seed) % 1)), tail = 10 + 18 * (1 - u)
    const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d + 160 * u * u
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - Math.cos(a) * tail, py - Math.sin(a) * tail); ctx.stroke()
  }
  ctx.restore()
}
/** 부위 체력 — 깎였지만 아직 남은 부위 곁에만 (화면 글 없음) */
function drawPartBars(ctx: CanvasRenderingContext2D, g: BulgasariState) {
  const v = G.view
  ctx.save()
  for (const key of Object.keys(g.partHP) as BulgasariHp[]) {
    const hp = g.partHP[key], max = g.partMax[key]; if (!(max > 0 && hp > 0 && hp < max)) continue
    const part = g.pose.parts.find(p => bulgasariHpOf(p.id) === key && p.visible); if (!part) continue
    const c = part.collider.kind === 'ellipse' ? point(part.collider.center.x, part.collider.center.y - part.collider.ry) : point((part.start.x + part.end.x) / 2, Math.min(part.start.y, part.end.y) - part.collider.radius)
    const x = c.x - v.partHpWidth / 2, y = c.y - v.partHpLift - v.partHpHeight
    ctx.fillStyle = FX.foe.rimDark; ctx.fillRect(x, y, v.partHpWidth, v.partHpHeight); ctx.fillStyle = FX.own.rim; ctx.fillRect(x, y, v.partHpWidth * hp / max, v.partHpHeight)
  }
  ctx.restore()
}
/** 흙먼지 터짐 — 퍼지는 고리와 튀는 흙덩이 (u 0→1) */
function burst(ctx: CanvasRenderingContext2D, x: number, y: number, u: number, size: number, color: string = V.dirt) {
  if (u < 0 || u >= 1) return
  const r = size * (.35 + .9 * u)
  ctx.save(); ctx.globalAlpha = (1 - u) * .8; ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2 + 8 * (1 - u)
  ctx.beginPath(); ctx.ellipse(x, y, r, r * .36, 0, 0, TAU); ctx.stroke()
  for (let i = 0; i < 10; i++) { const a = i * TAU / 10 + .3, d = r * (.7 + .25 * Math.sin(i * 3.1)), hh = size * .45 * Math.sin(Math.PI * u) * (.6 + .4 * Math.cos(i * 1.7)); ctx.beginPath(); ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * .36 - hh, 3 + 6 * (1 - u), 0, TAU); ctx.fill() }
  ctx.restore()
}
/** 땅을 울린 뒤 몇 초까지의 흙먼지 (등장 착지 · 앞발 · 출현 · 박힘) — 판 상태(시각·박자)로만 */
function landingBurst(ctx: CanvasRenderingContext2D, g: BulgasariState) {
  const p = g.pose, size = V.landSize * K, a = g.attack
  if (g.state === 'entry') {
    const k = 1 - g.timer / B.entrySeconds
    burst(ctx, p.anchor.x, p.anchor.y, (k - B.entry.land) * B.entrySeconds / V.landLife, size * 1.25)
    burst(ctx, g.entry.door.x + g.entry.facing * B.entry.lunge * K * .5, g.entry.door.y + B.entry.behind * K, (k - B.entry.burst) * B.entrySeconds / V.landLife, size * 1.4, V.rust)
    return
  }
  const move = g.state === 'strike' ? a?.move : null
  if (!a || !move) return
  const since = (g.motion.progress - a.impactAt) * a.strike
  if (move === 'stomp' && a.slam) burst(ctx, a.slam.x, a.slam.y, since / V.landLife, size * .8)
  if (move === 'burrow' && a.landing) burst(ctx, a.landing.x, a.landing.y, since / V.landLife, size * 1.2)
}
/** 땅에 붙은 것 — 큰 그림자 · 지하 질주 흙 두둑(땅속 앞머리가 지나는 자리) · 땅을 울린 흙먼지 */
export function drawBulgasariGround(ctx: CanvasRenderingContext2D, g: BulgasariState): void {
  if (g.state === 'dead') return
  const p = g.pose, a = g.attack
  landingBurst(ctx, g)
  ctx.save()
  if (p.sink < 1) { ctx.globalAlpha = V.shadowAlpha * (1 - p.sink); ctx.fillStyle = '#120c08'; ctx.beginPath(); ctx.ellipse(p.anchor.x - p.facing * V.shadowShift * K, p.anchor.y + 4, V.shadowWidth * K, V.shadowHeight * K, 0, 0, TAU); ctx.fill() }
  if (a?.move === 'burrow' && a.path && (g.state === 'tell' || g.state === 'strike')) {
    // 흙 두둑: 붉은 예고 동안 띠 시작에서 들썩이고 · 타격이 오면 앞머리를 따라 갈라지며 솟는다
    const from = a.path.from, to = a.path.to, go = g.state === 'strike' ? a.front ?? 0 : 0
    const ux = to.x - from.x, uy = to.y - from.y, at = point(from.x + ux * go, from.y + uy * go)
    ctx.globalAlpha = V.trenchAlpha; ctx.strokeStyle = V.dirt; ctx.lineCap = 'round'; ctx.lineWidth = V.trenchWidth * K
    ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(at.x, at.y); ctx.stroke()
    const bob = 1 + .15 * Math.sin(g.age * TAU * 3)
    ctx.fillStyle = V.dirt; ctx.beginPath(); ctx.ellipse(at.x, at.y, V.moundSize * K * bob, V.moundSize * K * .45 * bob, 0, Math.PI, TAU); ctx.fill()
  }
  ctx.restore()
}
/** 붉은 예고(판의 고정 모양 그대로) · 막 환경 · 그 위의 쇠(흡수에 빨려 드는 부스러기 · 회전 살포 철편 · 박힘 불티 · 등장 문 씹기 불티) */
export function drawBulgasariThreats(ctx: CanvasRenderingContext2D, g: BulgasariState): void {
  if (g.state === 'dead') return
  const a = g.attack
  if (g.state !== 'entry') drawImugiThreats(ctx, g.environment.shapes)
  if (a && (g.state === 'tell' || g.state === 'strike')) drawImugiThreats(ctx, a.shapes)
  if (g.state === 'entry') {
    // 문 쇠붙이를 씹을 때 입에서 불티 (머리 판정의 끝이 입이다)
    const k = 1 - g.timer / B.entrySeconds, mouth = g.pose.parts.find(p => p.id === 'head')?.end
    if (mouth && !g.entry.gateDown) for (const c of B.entry.chompAt) sparks(ctx, mouth.x, mouth.y, (k - c) * B.entrySeconds / V.sparkLife, c)
    return
  }
  if (g.wallHitAt !== undefined) { const u = (g.age - g.wallHitAt) / V.sparkLife, head = g.pose.parts.find(p => p.id === 'head'); if (head && u < 1 && head.collider.kind === 'ellipse') sparks(ctx, head.collider.center.x, head.collider.center.y, u, g.wallHitAt) }
  if (!a) return
  ctx.save()
  const since = g.age - a.at
  if (a.move === 'suction' && (g.state === 'tell' || g.state === 'strike')) {
    // 쇠 부스러기가 부채 끝에서 입으로 빨려 든다
    const cone = a.shapes[0]
    if (cone?.kind === 'cone') for (let i = 0; i < V.suckBits; i++) {
      const u = (since * 1.3 + i / V.suckBits) % 1, ang = cone.angle + (((i * .618) % 1) * 2 - 1) * cone.halfAngle, d = cone.radius * (1 - u * u)
      ctx.globalAlpha = .4 + .5 * u; ctx.fillStyle = i % 3 ? V.iron : V.rust
      ctx.save(); ctx.translate(cone.center.x + Math.cos(ang) * d, cone.center.y + Math.sin(ang) * d); ctx.rotate(since * 9 + i); ctx.fillRect(-V.suckSize, -V.suckSize / 2, V.suckSize * 2, V.suckSize); ctx.restore()
    }
  } else if (a.move === 'spin' && g.state === 'strike' && a.lines) {
    // 등 철편이 선을 따라 날아간다
    const s = B.moves.spin, c = point(g.motion.prepared.x, g.motion.prepared.y), u = unit(g.motion.progress / s.impactAt)
    ctx.fillStyle = V.rust; ctx.strokeStyle = V.iron; ctx.lineWidth = 2
    for (const [j, ang] of a.lines.entries()) {
      const d = s.inner * .5 + (s.inner * .5 + s.length) * u
      ctx.save(); ctx.globalAlpha = 1 - Math.max(0, u - .8) * 5; ctx.translate(c.x + Math.cos(ang) * d, c.y + Math.sin(ang) * d - 30 * Math.sin(Math.PI * u)); ctx.rotate(ang + since * 14 + j)
      ctx.beginPath(); ctx.moveTo(-V.shardSize, -V.shardSize * .35); ctx.lineTo(V.shardSize, 0); ctx.lineTo(-V.shardSize * .6, V.shardSize * .4); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore()
    }
  }
  ctx.restore()
}
/** 붉은 예고 모양 그대로 (검수 · 시험용) */
export const bulgasariThreatShapes = (g: BulgasariState): readonly Shape[] => g.attack && (g.state === 'tell' || g.state === 'strike') ? g.attack.shapes : []
