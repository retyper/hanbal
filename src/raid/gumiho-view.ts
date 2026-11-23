/**
 * 55 구미호 그리기 — 판 상태를 읽기만 한다 (관절 · 고정 붉은 예고 · 판 시각 age). 화면 시계·난수 없음.
 * 판정과 같은 관절 자리(gumiho.ts gumihoSkeleton) 위에 자세 그림을 얹는다: 뒤 꼬리 → 몸(자세 섞기 · 여인↔반여우 섞기 · 옷자락 물결) → 앞 꼬리.
 * 환영은 진짜와 같은 자세를 푸른 빛으로 옅게 · 그림자가 없다(진짜만 땅에 그림자) · 붉은 예고는 진짜 앞에만 있다.
 */
import { HAEBI_GUMIHO as F, HAEBI_GIANT as G, HAEBI_FX as FX, HAEBI_RUN as C } from '../tune/params.ts'
import type { Point, Shape } from './giant-core.ts'
import { GUMIHO_ART, GUMIHO_GROGGY, GUMIHO_SOURCE, GUMIHO_TAIL_ART, GUMIHO_TAIL_BONE, type GumihoPoseArt } from './gumiho-art.ts'
import { GUMIHO_TAILS, gumihoAngle, gumihoSkeleton, gumihoSquash, gumihoWorld, type GumihoFrame, type GumihoHp, type GumihoPoseId, type GumihoSkeleton, type GumihoState, type GumihoTail } from './gumiho.ts'
import { drawImugiThreats } from './imugi-view.ts'

const V = F.view, R = F.rig, K = R.scale, TAU = Math.PI * 2
const point = (x: number, y: number): Point => ({ x, y })
const unit = (x: number) => Math.max(0, Math.min(1, x))
const smooth = (x: number) => { const t = unit(x); return t * t * (3 - 2 * t) }
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const posePiece = (fox: boolean, pose: GumihoPoseId): GumihoPoseArt => `${fox ? 'fox' : 'woman'}-${pose}`
const NONE: ReadonlySet<number> = new Set()
export interface Rect { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number }

/** 덧칠한 그림 (부서진 팔 · 환영 빛) — 그림·빛마다 한 번 굽는다 · DOM 이 없으면 원본 */
const tinted = new WeakMap<object, Map<string, CanvasImageSource>>()
function tintOf(img: HTMLImageElement, color: string): CanvasImageSource {
  let m = tinted.get(img); if (!m) { m = new Map(); tinted.set(img, m) }
  const hit = m.get(color); if (hit) return hit
  if (typeof document === 'undefined') return img
  const c = document.createElement('canvas'); c.width = img.naturalWidth || img.width; c.height = img.naturalHeight || img.height
  const x = c.getContext('2d'); if (!x) return img
  x.drawImage(img, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height)
  m.set(color, c); return c
}
/** 자세 그림 하나를 몸 변환(gumihoWorld 와 같은 차례)으로 — 엉덩이 위는 한 장 · 아래 옷자락은 가로 띠로 물결 (발은 그대로) */
function poseImage(ctx: CanvasRenderingContext2D, src: CanvasImageSource, piece: GumihoPoseArt, f: GumihoFrame, pose: GumihoPoseId, t: number) {
  const S = GUMIHO_SOURCE[piece], [fx, fy] = S.feet!, [w, h] = S.size, Y = V.sway, n = Y.strips
  const top = Math.max(1, Math.min(fy - 1, Math.round(fy + R.poses[pose].hip[1]))), span = fy - top
  ctx.save()
  ctx.translate(f.x, f.y - f.lift); ctx.scale(f.facing * gumihoSquash(f), 1); ctx.transform(1, 0, -f.lean, 1, 0, 0); ctx.scale(K, K * (1 - f.crouch * R.crouch))
  const lean = Math.sin(t * TAU * Y.hz * .7) * Y.amp * Y.upper / K
  ctx.drawImage(src, 0, 0, w, top + 1, -fx + lean, -fy, w, top + 1)
  for (let k = 0; k < n; k++) {
    const y0 = Math.floor(top + span * k / n), y1 = k === n - 1 ? h : Math.ceil(top + span * (k + 1) / n) + 1, v = (k + .5) / n
    const weight = smooth((v - Y.from) / (Y.peak - Y.from)) * (1 - smooth((v - Y.to) / (1 - Y.to))), near = 1 - smooth(v / Y.from)
    const dx = Math.sin(t * TAU * Y.hz - v * Y.wave * TAU) * Y.amp / K * weight + lean * near
    ctx.drawImage(src, 0, y0, w, y1 - y0, -fx + dx, y0 - fy, w, y1 - y0)
  }
  ctx.restore()
}
/**
 * 몸 — 섞이는 동안은 앞 그림을 (1−k²) 로 옅게 깔고 다음 그림을 k 로 위에 얹는다 (가운데가 거의 비치지 않고 · 끝에 튀지 않게).
 * 변신 중엔 같은 자세로 여인 → 반여우 · 아니면 자세 pose → pose2.
 */
function drawBody(ctx: CanvasRenderingContext2D, images: ReadonlyMap<string, HTMLImageElement>, f: GumihoFrame, t: number, tint: string | null): boolean {
  const img = (x: boolean, p: GumihoPoseId) => { const i = images.get(GUMIHO_ART[posePiece(x, p)]); return i ? tint ? tintOf(i, tint) : i : null }
  const layer = (x: boolean, p: GumihoPoseId, alpha: number) => { const src = img(x, p); if (!src) return false; if (alpha <= .01) return true; ctx.save(); ctx.globalAlpha *= Math.min(1, alpha); poseImage(ctx, src, posePiece(x, p), f, p, t); ctx.restore(); return true }
  const lead = f.mix < .5 ? f.pose : f.pose2
  if (f.fox > .01 && f.fox < .99) return layer(false, lead, 1 - f.fox * f.fox) && layer(true, lead, f.fox)
  const fox = f.fox >= .5
  if (f.pose !== f.pose2 && f.mix > .01 && f.mix < .99) return layer(fox, f.pose, 1 - f.mix * f.mix) && layer(fox, f.pose2, f.mix)
  return layer(fox, lead, 1)
}
/** 꼬리만 (그로기 동안 몸 뒤에 옅게) */
function drawFigureTails(ctx: CanvasRenderingContext2D, images: ReadonlyMap<string, HTMLImageElement>, f: GumihoFrame, sk: GumihoSkeleton, partHP: Readonly<Record<GumihoHp, number>>) {
  for (let i = GUMIHO_TAILS.length - 1; i >= 0; i--) {
    const tt = sk.tails[i]!, img = images.get(GUMIHO_ART[GUMIHO_TAIL_ART[i]!])
    if (tt.shown <= 0 || partHP[GUMIHO_TAILS[i]!] <= 0 || !img) continue
    drawTail(ctx, img, i, tt, f.facing)
  }
}
/** 꼬리 하나 — 그림의 뿌리→끝 줄을 꼬리 뼈에 맞춘다 (왼쪽을 보면 그 줄을 따라 뒤집는다) */
function drawTail(ctx: CanvasRenderingContext2D, src: CanvasImageSource, i: number, t: GumihoTail, facing: 1 | -1) {
  const bone = GUMIHO_TAIL_BONE[GUMIHO_TAIL_ART[i]!], [bx, by] = bone.base, [tx, ty] = bone.tip, chord = Math.hypot(tx - bx, ty - by)
  if (t.length < 1) return
  const k = t.length / chord
  ctx.save(); ctx.translate(t.base.x, t.base.y); ctx.rotate(t.angle); ctx.scale(1, facing); ctx.rotate(-Math.atan2(ty - by, tx - bx)); ctx.scale(k, k)
  ctx.drawImage(src, -bx, -by); ctx.restore()
}
interface FigureOpts { readonly alpha: number; readonly tint: string | null; readonly partHP: Readonly<Record<GumihoHp, number>>; readonly front: ReadonlySet<number>; readonly t: number }
/** 한 몸 (진짜 · 환영 · 쓰러짐이 같이 쓴다) */
function drawFigure(ctx: CanvasRenderingContext2D, images: ReadonlyMap<string, HTMLImageElement>, f: GumihoFrame, sk: GumihoSkeleton, o: FigureOpts): boolean {
  ctx.save(); ctx.globalAlpha *= o.alpha
  try {
    const tail = (i: number) => {
      const tt = sk.tails[i]!, img = images.get(GUMIHO_ART[GUMIHO_TAIL_ART[i]!])
      if (tt.shown <= 0 || o.partHP[GUMIHO_TAILS[i]!] <= 0 || !img) return
      ctx.save(); ctx.globalAlpha *= Math.min(1, tt.shown * 2); drawTail(ctx, o.tint ? tintOf(img, o.tint) : img, i, tt, f.facing); ctx.restore()
    }
    for (let i = GUMIHO_TAILS.length - 1; i >= 0; i--) if (!o.front.has(i)) tail(i)
    const drew = drawBody(ctx, images, f, o.t, o.tint)
    for (const i of o.front) tail(i)
    return drew
  } finally { ctx.restore() }
}
/** 앞에 그릴 꼬리 — 순차쓸기에서 지금 땅을 훑는 꼬리 하나만 (나머지는 늘 몸 뒤 · 몸과 얼굴을 가리지 않게) */
function frontTails(g: GumihoState): ReadonlySet<number> {
  const a = g.attack, o = a?.move === 'sweep' && g.state === 'strike' ? a.hits[a.step]?.owners[0] : null
  return o ? new Set([GUMIHO_TAILS.indexOf(o as typeof GUMIHO_TAILS[number])]) : NONE
}
/** 여우불이 일렁이는 시각 — 그리는 함수가 판 시각(age)으로 맞춘다 (화면 시계가 아니다) */
let clock = 0
/** 불꽃 꼴 — 둥근 밑동에서 혀 셋(가운데 긴 혀 · 양옆 짧은 혀)이 일렁이며 솟는다 (ph 는 일렁임 박자) */
function flame(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, ph: number) {
  const main = 2.3 + .5 * Math.sin(ph), left = 1.4 + .35 * Math.sin(ph * 1.7 + 1), right = 1.5 + .35 * Math.sin(ph * 1.3 + 2), bend = Math.sin(ph * .8) * .35
  ctx.beginPath(); ctx.moveTo(x - r * .9, y)
  ctx.quadraticCurveTo(x - r * .95, y - r * .7, x - r * .55 + bend * r * .5, y - r * left)
  ctx.quadraticCurveTo(x - r * .35, y - r * .85, x - r * .2, y - r * .75)
  ctx.quadraticCurveTo(x - r * .3 + bend * r, y - r * 1.6, x + bend * r, y - r * main)
  ctx.quadraticCurveTo(x + r * .25 + bend * r * .5, y - r * 1.3, x + r * .22, y - r * .75)
  ctx.quadraticCurveTo(x + r * .4, y - r * .85, x + r * .6 + bend * r * .5, y - r * right)
  ctx.quadraticCurveTo(x + r * .95, y - r * .7, x + r * .9, y)
  ctx.arc(x, y, r * .9, 0, Math.PI); ctx.fill()
}
/** 여우불 한 점 — 옅은 빛무리 · 푸른(또는 보랏) 겉불 · 흰 속불 (더하기 빛 · 혀가 일렁인다) */
function wisp(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, alpha: number, violet = false) {
  if (alpha <= .01 || r <= .5) return
  const ph = clock * 9 + x * .07 + y * .05, glow = violet ? V.fire.violet : V.fire.glow
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = glow
  ctx.globalAlpha *= unit(alpha) * .12; ctx.beginPath(); ctx.arc(x, y - r * .6, r * 1.8, 0, TAU); ctx.fill()
  ctx.globalAlpha *= 4; flame(ctx, x, y, r, ph)
  ctx.globalAlpha *= 1.5; ctx.fillStyle = V.fire.core; flame(ctx, x, y + r * .2, r * .5, ph + 1.3)
  ctx.restore()
}

/**
 * 원래 그림 크기의 경계 (카메라가 온몸과 꼬리를 담는다) — 그리기만 · 판 상태를 바꾸지 않는다.
 * 등장 중엔 걸어 나와 설 자리로 잰다 (안 보이는 몸 때문에 판이 작아지지 않게).
 */
export function gumihoVisualBounds(g: GumihoState): Rect | null {
  if (g.state === 'dead') return null
  // 꼬리 찌르기·훑기로 잠깐 틀고 늘어난 꼬리는 재지 않는다 (카메라는 싸움 내내 가장 작은 배율을 지켜 한 번 멀어지면 돌아오지 않는다)
  const base = g.pose.frame, f: GumihoFrame = { ...base, ...(g.state === 'entry' ? { y: g.motion.from.y, fade: 1 } : {}), lift: 0, raise: base.raise.map(() => 0), reach: base.reach.map(() => 1) }, pts: Point[] = []
  const pose = f.mix < .5 ? f.pose : f.pose2, S = GUMIHO_SOURCE[posePiece(f.fox >= .5, pose)], [fx, fy] = S.feet!, [w, h] = S.size
  for (const [u, v] of [[0, 0], [w, 0], [w, h], [0, h]] as const) pts.push(gumihoWorld(f, point((u - fx) * K, (v - fy) * K)))
  const sk = gumihoSkeleton(f)
  sk.tails.forEach((t, i) => { if (t.shown <= 0 || g.partHP[GUMIHO_TAILS[i]!] <= 0) return; const r = t.length * .35; for (const p of [t.base, t.tip]) pts.push(point(p.x - r, p.y - r), point(p.x + r, p.y + r)) })
  return { left: Math.min(...pts.map(p => p.x)), top: Math.min(...pts.map(p => p.y)), right: Math.max(...pts.map(p => p.x)), bottom: Math.max(...pts.map(p => p.y)) }
}
export interface GumihoViewOptions { readonly heroX: number; readonly heroY: number; readonly daze?: number }
/** 그로기 칸 그림 — 처음 쓸 때 한 번 받는다(없거나 아직 안 왔으면 옛 자세로 그린다) · 판 상태는 읽기만 */
const groggyImg = new Map<string, HTMLImageElement>()
function groggyArt(path: string): HTMLImageElement | null {
  if (typeof document === 'undefined') return null
  let img = groggyImg.get(path)
  if (!img) { img = new Image(); img.src = (import.meta.env?.BASE_URL ?? '/') + 'realm/' + path; groggyImg.set(path, img) }
  return img.complete && img.naturalWidth > 0 ? img : null
}
/** 그로기가 시작된 판 시각 — 구미호마다 (그로기가 끝나면 지운다) */
const groggyAt = new WeakMap<GumihoState, { at: number; big: boolean }>()
/** 그로기 동작 칸: 휘청 → 주저앉음(한 번) → 땅 짚고 숨(되풀이) · 큰 부위(머리·팔)가 깨졌으면 옷이 찢긴 판 · 그렸으면 true */
function drawGroggyBody(ctx: CanvasRenderingContext2D, g: GumihoState, f: GumihoFrame, daze: number): boolean {
  if (daze <= 0) { groggyAt.delete(g); return false }
  if (!groggyAt.has(g)) groggyAt.set(g, { at: g.age, big: daze >= V.groggy.minDaze })   // 도끼 멈칫(.25초)·작은 부위 휘청은 옛 자세 그대로
  const G0 = groggyAt.get(g)!
  if (!G0.big) return false
  const torn = g.partHP['head'] <= 0 || g.partHP['fan-arm'] <= 0 || g.partHP['claw-arm'] <= 0
  const A = torn ? GUMIHO_GROGGY.torn : GUMIHO_GROGGY.intact, img = groggyArt(A.path)
  if (!img) return false
  const T = V.groggy, age = g.age - G0.at
  const frame = age < 4 * T.fall ? Math.floor(age / T.fall) : 4 + Math.floor((age - 4 * T.fall) / T.breath) % 4
  const feet = gumihoWorld(f, { x: 0, y: 0 } as Point)
  ctx.save(); ctx.translate(feet.x, feet.y); ctx.scale(K * f.facing, K)
  ctx.drawImage(img, frame * A.cell[0], 0, A.cell[0], A.cell[1], -A.feet[0], -A.feet[1], A.cell[0], A.cell[1])
  ctx.restore(); return true
}
/** 몸 — 환영 둘(있으면) · 진짜(장수가 몸 뒤에 서면 옅게) · 변신 빛 · 부서짐 · 부위 체력 */
export function drawGumiho(ctx: CanvasRenderingContext2D, images: ReadonlyMap<string, HTMLImageElement>, g: GumihoState, o: GumihoViewOptions): boolean {
  if (g.state === 'dead') return false
  clock = g.age
  const f = g.pose.frame, b = gumihoVisualBounds(g), behind = !!b && o.heroY < f.y - V.behindPad && o.heroX > b.left && o.heroX < b.right && o.heroY > b.top
  drawIllusions(ctx, images, g)
  drawGhostTail(ctx, images, g)
  drawChange(ctx, g, false)
  let drew = true
  if (f.fade > .01) {
    ctx.save(); ctx.globalAlpha *= f.fade
    // 11-23 형 「그로기 때 그로기 모습이 아니다」: 그로기 동안은 동작 칸(gm_groggy) · 꼬리는 옅게 뒤에
    const dazed = (o.daze ?? 0) > 0
    if (!dazed) groggyAt.delete(g)
    const groggy = dazed && drawGroggyBody(ctx, g, f, o.daze!)
    if (groggy) { ctx.save(); ctx.globalAlpha *= V.groggy.tailAlpha; drawFigureTails(ctx, images, f, g.pose.sk, g.partHP); ctx.restore() }
    else drew = drawFigure(ctx, images, f, g.pose.sk, { alpha: behind ? V.behindAlpha : 1, tint: null, partHP: g.partHP, front: frontTails(g), t: g.age })
    // 11-23 형 「구미호 상체에 검게 그림자」: 부서진 팔 둘레를 어둡게 덧칠하던 것(shadeArms)이 가슴·어깨까지 덮었다 → 뺌 · 부위 파괴는 글자·그로기 별·(옷 찢김 그림 86)으로
    ctx.restore()
  }
  drawChange(ctx, g, true)
  drawBreaks(ctx, images, g)
  drawPartBars(ctx, g)
  return drew
}
/** 환영 둘 — 진짜와 같은 자세 · 푸른 빛으로 옅게 깜빡인다 · 맞지도 때리지도 않는다 (진짜 자리가 정해진 몸 예고 blinkAt 부터 타격이 끝날 때까지) */
function drawIllusions(ctx: CanvasRenderingContext2D, images: ReadonlyMap<string, HTMLImageElement>, g: GumihoState) {
  const a = g.attack; if (!a || a.move !== 'illusion' || !a.spots || !a.spotFacing || a.real === undefined) return
  const q = F.moves.illusion, I = V.illusion
  const show = g.state === 'body' ? unit((1 - g.timer / (a.windup.body || 1) - q.blinkAt) / q.blinkFade) : g.state === 'hold' || g.state === 'tell' ? 1 : g.state === 'strike' ? 1 - g.motion.progress : 0
  if (show <= 0) return
  const f = g.pose.frame
  a.spots.forEach((spot, i) => {
    if (i === a.real) return
    const fi: GumihoFrame = { ...f, x: spot.x, y: spot.y, facing: a.spotFacing![i]!, fade: 1, lift: 0 }, flick = 1 - I.depth * (.5 + .5 * Math.sin(g.age * TAU * I.flicker + i * 2.1))
    drawFigure(ctx, images, fi, gumihoSkeleton(fi), { alpha: I.alpha * show * flick, tint: I.tint, partHP: g.partHP, front: NONE, t: g.age + i })
    for (let k = 0; k < 3; k++) wisp(ctx, spot.x + Math.sin(g.age * 2 + k * 2.1 + i) * 70, spot.y - 120 - k * 90 + Math.sin(g.age * 3 + k) * 10, V.fire.size * .8, show * .5)
  })
}
/** 막 1 환영 예고의 꼬리 그림자 — 몸을 낮추는 동안 등 뒤로 꼬리 하나가 비쳐 감긴다 (그림만 · 판정 없음) */
function drawGhostTail(ctx: CanvasRenderingContext2D, images: ReadonlyMap<string, HTMLImageElement>, g: GumihoState) {
  const a = g.attack
  if (!a || a.move !== 'illusion' || g.phase !== 1 || g.state !== 'body' && g.state !== 'hold' && g.state !== 'tell') return
  const img = images.get(GUMIHO_ART['tail-5']); if (!img) return
  const f = g.pose.frame, sk = gumihoSkeleton({ ...f, tails: GUMIHO_TAILS.length }), u = g.state === 'body' ? 1 - g.timer / (a.windup.body || 1) : 1
  const base = sk.tails[4]!, angle = gumihoAngle(f.facing, R.tails.rest[4]! + V.ghostTail.coil * (1 - u) + Math.sin(g.age * TAU * .8) * .15), length = R.tails.length[4]! * (.55 + .45 * u)
  ctx.save(); ctx.globalAlpha *= V.ghostTail.alpha * smooth(u * 2) * f.fade
  drawTail(ctx, tintOf(img, V.illusion.tint), 4, { base: base.base, tip: point(base.base.x + Math.cos(angle) * length, base.base.y + Math.sin(angle) * length), angle, length, shown: 1 }, f.facing)
  ctx.restore()
}
/** 변신(막 2)·웃음(막 3) — 여우불이 몸 뒤를 돌고(front=false) · 반여우가 되는 순간 흰 빛 · 꼬리가 나올 때마다 여우불이 터진다(front=true) */
function drawChange(ctx: CanvasRenderingContext2D, g: GumihoState, front: boolean) {
  if (g.state !== 'roar') return
  const total = g.phase === 2 ? F.transformSeconds : F.roarSeconds, k = 1 - g.timer / total, sk = g.pose.sk, c = point((sk.hip.x + sk.neck.x) / 2, (sk.hip.y + sk.neck.y) / 2), T = F.motion.transform
  const O = V.orbit
  if (!front) { for (let i = 0; i < O.count; i++) { const a = i * TAU / O.count + g.age * O.speed, r = O.radius + O.wobble * Math.sin(g.age * 3 + i); wisp(ctx, c.x + Math.cos(a) * r, c.y + Math.sin(a) * r * .6, V.fire.size, Math.sin(Math.PI * k) * .9, i % 3 === 0) } return }
  if (g.phase !== 2) return
  const flash = Math.sin(Math.PI * unit((k - T.fox) / T.foxSpan))
  if (flash > 0) {
    // 몸 가운데서 번지는 흰 빛 (가장자리는 투명하게 · 잠깐만)
    const r = V.flashRadius * (1 + flash * .3), glow = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r)
    glow.addColorStop(0, V.fire.core); glow.addColorStop(.45, V.fire.glow); glow.addColorStop(1, 'rgba(143,211,255,0)')
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = V.flash * flash; ctx.fillStyle = glow; ctx.beginPath(); ctx.ellipse(c.x, c.y, r * .75, r, 0, 0, TAU); ctx.fill(); ctx.restore()
  }
  sk.tails.forEach(t => { if (t.shown > 0 && t.shown < 1) wisp(ctx, t.tip.x, t.tip.y, V.fire.size * (1 + 2 * t.shown), 1 - t.shown) })
}
/** 부서진 순간 — 여우불 고리 · 끊긴 꼬리는 떨어지며 사라진다 */
function drawBreaks(ctx: CanvasRenderingContext2D, images: ReadonlyMap<string, HTMLImageElement>, g: GumihoState) {
  for (const [key, at] of Object.entries(g.brokenAt) as [GumihoHp, number][]) {
    const dt = g.age - at; if (dt < 0) continue
    const i = GUMIHO_TAILS.indexOf(key as typeof GUMIHO_TAILS[number]), part = g.pose.parts.find(p => p.id === key); if (!part) continue
    const c = part.collider.kind === 'ellipse' ? part.collider.center : point((part.start.x + part.end.x) / 2, (part.start.y + part.end.y) / 2)
    if (dt < V.breakLife) {
      const u = dt / V.breakLife, r = V.breakSize * (.3 + u)
      ctx.save(); ctx.globalAlpha = 1 - u; ctx.strokeStyle = V.fire.glow; ctx.lineWidth = 6 * (1 - u) + 1; ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, TAU); ctx.stroke(); ctx.restore()
      for (let k = 0; k < 8; k++) { const a = k * TAU / 8 + at; wisp(ctx, c.x + Math.cos(a) * r * (.6 + .5 * u), c.y + Math.sin(a) * r * (.6 + .5 * u), 6 * (1 - u) + 2, 1 - u, k % 2 === 0) }
    }
    if (i >= 0 && dt < V.dropLife) {
      const img = images.get(GUMIHO_ART[GUMIHO_TAIL_ART[i]!]), t = g.pose.sk.tails[i]!; if (!img || t.length < 1) continue
      const u = dt / V.dropLife
      ctx.save(); ctx.globalAlpha = 1 - u * u; ctx.translate(0, u * u * V.dropFall)
      drawTail(ctx, img, i, { ...t, angle: t.angle + u * V.dropSpin * -g.pose.facing }, g.pose.facing); ctx.restore()
    }
  }
}
/** 부위 체력 — 깎였지만 아직 남은 부위 곁에만 (화면 글 없음) */
function drawPartBars(ctx: CanvasRenderingContext2D, g: GumihoState) {
  const v = G.view
  ctx.save()
  for (const key of Object.keys(g.partHP) as GumihoHp[]) {
    const hp = g.partHP[key], max = g.partMax[key]; if (!(max > 0 && hp > 0 && hp < max)) continue
    const part = g.pose.parts.find(p => p.id === key && p.visible); if (!part) continue
    const c = part.collider.kind === 'ellipse' ? point(part.collider.center.x, part.collider.center.y - part.collider.ry) : point((part.start.x + part.end.x) / 2, Math.min(part.start.y, part.end.y))
    const x = c.x - v.partHpWidth / 2, y = c.y - v.partHpLift - v.partHpHeight
    ctx.fillStyle = FX.foe.rimDark; ctx.fillRect(x, y, v.partHpWidth, v.partHpHeight); ctx.fillStyle = FX.own.rim; ctx.fillRect(x, y, v.partHpWidth * hp / max, v.partHpHeight)
  }
  ctx.restore()
}
/**
 * 쓰러짐 (승리 막 내림 동안 · 판은 이미 끝났다) — 무릎 꿇듯 주저앉고 꼬리가 늘어지며 여우불로 흩어진다.
 * 판 상태는 읽기만: 마지막 자세에서 그림용 자세를 새로 만든다.
 */
export function drawGumihoFall(ctx: CanvasRenderingContext2D, images: ReadonlyMap<string, HTMLImageElement>, g: GumihoState, elapsed: number): void {
  const u = unit(elapsed / V.fallSeconds); if (u >= 1) return
  clock = g.age + elapsed
  const c = g.pose.frame, k = 1 - (1 - u) * (1 - u), Fl = V.fall
  const f: GumihoFrame = { ...c, crouch: lerp(c.crouch, Fl.crouch, k), lean: c.lean + Fl.lean * k, lift: 0, fade: 1, turn: 0, raise: c.raise.map(v => v + Fl.droop * k), reach: c.reach.map(v => v * (1 - .4 * k)) }
  const alpha = u < V.fallHold ? 1 : 1 - (u - V.fallHold) / (1 - V.fallHold), sk = gumihoSkeleton(f)
  // 발을 축으로 등 쪽으로 기울며 땅으로 가라앉는다
  ctx.save(); ctx.translate(f.x, f.y + Fl.sink * k); ctx.rotate(-f.facing * Fl.tilt * k); ctx.translate(-f.x, -f.y)
  drawFigure(ctx, images, f, sk, { alpha, tint: null, partHP: g.partHP, front: NONE, t: g.age })
  ctx.restore()
  for (let i = 0; i < 12; i++) { const s = (i * .37 + u * 1.3) % 1, x = f.x + Math.sin(i * 2.3) * 110, y = f.y - 40 - s * 380; wisp(ctx, x, y, V.fire.size * (1 - s * .5), (1 - s) * unit(u * 3) * (1 - u), i % 3 === 0) }
}
/** 땅을 울린 뒤 (도약 착지) — 흙먼지 고리와 튀는 잎 */
function burst(ctx: CanvasRenderingContext2D, x: number, y: number, u: number, size: number) {
  if (u < 0 || u >= 1) return
  const r = size * (.35 + .9 * u)
  ctx.save(); ctx.globalAlpha = (1 - u) * .8; ctx.strokeStyle = '#d9caa4'; ctx.fillStyle = '#7a9a52'; ctx.lineWidth = 2 + 8 * (1 - u)
  ctx.beginPath(); ctx.ellipse(x, y, r, r * .38, 0, 0, TAU); ctx.stroke()
  for (let i = 0; i < 10; i++) { const a = i * TAU / 10 + .3, d = r * (.7 + .25 * Math.sin(i * 3.1)), h = size * .5 * Math.sin(Math.PI * u) * (.6 + .4 * Math.cos(i * 1.7)); ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d * .38 - h, 5 * (1 - u) + 2, 3, a, 0, TAU); ctx.fill() }
  ctx.restore()
}
/** 땅에 붙은 것 — 발밑 그림자(진짜만 · 환영엔 없다) · 등장 때 모이는 여우불 · 부채를 펴는 여우불 고리 · 도약 착지 */
export function drawGumihoGround(ctx: CanvasRenderingContext2D, _images: ReadonlyMap<string, HTMLImageElement>, g: GumihoState): void {
  if (g.state === 'dead') return
  clock = g.age
  const f = g.pose.frame, S = V.shadow, a = g.attack
  ctx.save(); ctx.globalAlpha = S.alpha * f.fade * (1 - Math.min(.6, f.lift * S.lift)); ctx.fillStyle = '#0b1014'
  ctx.beginPath(); ctx.ellipse(f.x, f.y + 4, S.width * (1 - Math.min(.4, f.lift * S.lift)), S.height, 0, 0, TAU); ctx.fill(); ctx.restore()
  if (g.state === 'entry') {
    const k = 1 - g.timer / F.entrySeconds, E = F.motion.entry, n = V.entry.wisps, from = g.motion.from, cx = from.x, cy = from.y - E.rise - 200 * K
    const gather = unit(k / E.step), out = 1 - unit((k - E.step) / (1 - E.step) * 2)
    for (let i = 0; i < n; i++) { const th = i * TAU / n + gather * 2.2, r = V.entry.radius * (1 - smooth(gather)) + 30; wisp(ctx, cx + Math.cos(th) * r, cy + Math.sin(th) * r * .7 - Math.sin(g.age * 3 + i) * 6, V.fire.size * (.6 + .4 * Math.abs(Math.sin(i * 1.7))), unit(k * 4) * out, i % 4 === 0) }
    if (k >= E.open) { const u = (k - E.open) / (1 - E.open), sk = g.pose.sk; for (let i = 0; i < 14; i++) { const th = i * TAU / 14, r = 50 + u * 230; wisp(ctx, sk.fanTip.x + Math.cos(th) * r, sk.fanTip.y + Math.sin(th) * r * .6, V.fire.size * (1 - u * .5), 1 - u, i % 2 === 0) } }
  }
  const leapt = a?.move === 'leap' && g.state === 'strike' ? (g.motion.progress - a.impactAt) * a.strike : g.state === 'recover' && g.last === 'leap' ? (1 - F.moves.leap.impactAt) * F.moves.leap.strike + g.motion.recoverSeconds - g.timer : -1
  if (leapt >= 0) burst(ctx, f.x, f.y, leapt / V.land.life, V.land.size)
}
/** 환경 결 — 숲바람 띠엔 잎 · 꼬리 호와 꼬리선엔 여우불 (판 시각으로 몇 개만 · 판정은 붉은 모양 그대로) */
function drawEnvironment(ctx: CanvasRenderingContext2D, g: GumihoState) {
  const e = g.environment, on = e.active ? 1 : unit(e.age / G.environmentTell) * .5
  if (on <= 0) return
  const leaf = (s: Shape, k: number) => {
    if (s.kind === 'box') { for (let i = 0; i < 9; i++) { const v = (i * .31 + g.age * .35 + k * .5) % 1, x = s.center.x + Math.sin(i * 2.7 + g.age * 2) * s.halfX * .7, y = s.center.y - s.halfY + v * s.halfY * 2; ctx.save(); ctx.globalAlpha = .7 * on; ctx.fillStyle = i % 3 ? '#8fb55a' : '#c9a24a'; ctx.beginPath(); ctx.ellipse(x, y, 7, 3.5, g.age * 3 + i, 0, TAU); ctx.fill(); ctx.restore() } }
    else if (s.kind === 'arc') { for (let i = 0; i < 9; i++) { const a = s.angle - s.halfAngle + ((i / 9 + g.age * .12) % 1) * s.halfAngle * 2, r = (s.inner + s.outer) / 2; wisp(ctx, s.center.x + Math.cos(a) * r, s.center.y + Math.sin(a) * r, V.fire.size * .8, .55 * on, i % 3 === 0) } }
    else if (s.kind === 'line') { for (let i = 0; i < 6; i++) { const v = (i / 6 + g.age * .2) % 1; wisp(ctx, lerp(s.from.x, s.to.x, v), lerp(s.from.y, s.to.y, v), V.fire.size * .7, .55 * on, i % 2 === 0) } }
    else if (s.kind === 'union') s.shapes.forEach((c, i) => leaf(c, i))
  }
  e.shapes.forEach((s, i) => leaf(s, i))
}
/** 붉은 예고(판의 고정 모양 그대로) · 막 환경 · 그 위 타격 빛 (찌르기 줄 · 곡풍 · 베기 · 꼬리 훑기 · 꼬리 찌르기) */
export function drawGumihoThreats(ctx: CanvasRenderingContext2D, g: GumihoState): void {
  if (g.state === 'dead') return
  clock = g.age
  const a = g.attack
  // 판 밖(체력 막대 아래 · 테두리 너머)으로 나간 붉은 예고는 자른다 — 판정도 판 안의 장수만 잰다
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, C.width, C.height); ctx.clip()
  try {
    if (g.state !== 'entry') { drawImugiThreats(ctx, g.environment.shapes); drawEnvironment(ctx, g) }
    if (a && (g.state === 'tell' || g.state === 'strike')) drawImugiThreats(ctx, a.shapes)
    if (!a || g.state !== 'strike') return
    const p = g.motion.progress, k = unit(p / Math.max(a.impactAt, 1e-6)), fade = 1 - unit((p - a.impactAt) / (1 - a.impactAt)), S = V.streak
    ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = V.fire.core; ctx.lineCap = 'round'; ctx.globalAlpha = S.alpha * fade
    for (const s of a.shapes) {
      if (s.kind === 'line') { ctx.lineWidth = S.width; ctx.beginPath(); ctx.moveTo(s.from.x, s.from.y); ctx.lineTo(lerp(s.from.x, s.to.x, k), lerp(s.from.y, s.to.y, k)); ctx.stroke() }
      else if (s.kind === 'arc') { ctx.lineWidth = (s.outer - s.inner) * .5; ctx.beginPath(); ctx.arc(s.center.x, s.center.y, (s.inner + s.outer) / 2, s.angle - s.halfAngle, s.angle - s.halfAngle + 2 * s.halfAngle * k); ctx.stroke() }
      else if (s.kind === 'cone') { ctx.lineWidth = S.width * 1.6; ctx.beginPath(); ctx.arc(s.center.x, s.center.y, s.radius * .75, s.angle - s.halfAngle, s.angle - s.halfAngle + 2 * s.halfAngle * k); ctx.stroke() }
    }
  } finally { ctx.restore() }
}
