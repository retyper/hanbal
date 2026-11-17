import { HAEBI_RUN as C, HAEBI_MOBS as M, HAEBI_STAGES as ST, HAEBI_ULT as U, HAEBI_AWAKEN as A } from '../tune/params.ts'
import { genArtOf } from '../realm/data/art.ts'
import { areaScale, awakenedLook, charge, slamRadius, slamWindup, wardMax, type HaebiRun, type Kit, type Missile, type StageId } from './haebi.ts'
import { WALK_CYCLE } from './walk-cycle.ts'

/** 돌팔매 묶음의 돌 · 바위 (전용 그림 H56~H58 이 오기 전엔 본편 바위 그림을 빌린다) */
const ROCK = 'fx/rock.png'
/** bandit-<종류> 가 아닌 적 그림 (11-16 H50~H53 · tools/sprite-kit/bake-raid-enemies.py) */
const MOB_ART: Record<string, string> = { tiger: 'beast-tiger', bear: 'beast-bear', hunter: 'snow-hunter', torch: 'torch-raider' }
export const imagePaths = [genArtOf('haebi').file, genArtOf('aw1-haebi').file, 'anim-px/bandit-club.png', 'anim-px/bandit-chief.png', 'anim-px/bandit-archer.png',
  ...['runner', 'slinger', 'shield', 'dog', 'berserker', 'firearcher', 'iron', 'shaman'].map(k => `anim-px/bandit-${k}.png`), ...['ford.webp', 'palisade.webp', 'digits.png', 'knife.png', 'soul.png', 'bell-ring.png', 'javelin.png','sword-wave.png','forest.webp','axe.png','impact-strip.png','slash-strip.png','death-strip.png','fire-strip.png','lightning-strip.png','talisman.png','wind-blade.png','arrow.png','hit.png','essence.png','essence-large.png',...['mark-slam','mark-ring','mark-move','mark-hero','mark-target','mark-arrow','bar-boss','plaque'].map(p=>`ui/${p}.png`)].map(p=>'raid/'+p), 'anim-px/bandit-warlord.png', ROCK,
  // 11-16 H45~H53: 스테이지 두목 둘 · 설원·산성 적 넷 · 넷째·다섯째 바닥
  ...['boss-ford', 'boss-palisade', 'boss-snow', 'boss-fortress', ...Object.values(MOB_ART)].map(n => `anim-px/${n}.png`), 'raid/snow.webp', 'raid/fortress.webp']
/** bar-boss.png 의 투명한 홈 [x0,y0,x1,y1] — tools/raid-ui-kit.py 가 public/realm/raid/ui/kit.json 에 적는 값 */
const BOSS_WIN = [104, 35, 626, 82] as const
/**
 * 구운 그림 띠 (11-18 형 플립7 「늑대 떼부터 초당 3프레임」) — 20칸 띠를 그리는 키(height) 그대로 한 번 줄여 캔버스에 굽는다.
 * 늑대 띠는 6400×128 인데 46px 로 판마다 90번 줄여 찍혔다 · 폰 GPU 텍스처 한도(4096)를 넘는 띠는 그릴 때마다 조각내 올릴 수 있다.
 * 구운 띠는 폭이 C.spriteBakeMax 를 넘지 않게 여러 줄로 접는다. 헤드리스 시험(node)에는 document 가 없어 그대로 그린다.
 */
type Baked = { c: CanvasImageSource; fw: number; fh: number; cols: number }
const bakedStrips = new Map<HTMLImageElement, Map<number, Baked | null>>()
function bakedStrip(img: HTMLImageElement, height: number): Baked | null {
  // 찾기 먼저 (판마다 200번 불린다 — 그림의 width·height 읽기도 값이 든다)
  const fh = Math.max(1, Math.round(height)), per = bakedStrips.get(img), had = per?.get(fh)
  if (had !== undefined) return had
  if (typeof document === 'undefined' || !img.width || !img.height || !img.complete) return null
  if (!per) { bakedStrips.set(img, new Map()); return bakedStrip(img, height) }
  const sw = img.width / 20, fw = Math.max(1, Math.round(sw * fh / img.height))
  if (fh >= img.height) { per.set(fh, null); return null }   // 키우는 그림(초상 판 등)은 굽지 않는다
  const cols = Math.max(1, Math.min(20, Math.floor(C.spriteBakeMax / fw))), rows = Math.ceil(20 / cols)
  const c = document.createElement('canvas'); c.width = cols * fw; c.height = rows * fh
  const g = c.getContext('2d')!; g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'
  for (let i = 0; i < 20; i++) g.drawImage(img, i * sw, 0, sw, img.height, (i % cols) * fw, Math.floor(i / cols) * fh, fw, fh)
  const b: Baked = { c, fw, fh, cols }; per.set(fh, b)
  // 굳힌 그림(ImageBitmap)으로 바꿔 쥔다 — 캔버스를 원본으로 찍으면 찍을 때마다 사본을 뜰 수 있다
  if (typeof createImageBitmap === 'function') void createImageBitmap(c).then(bm => { b.c = bm }, () => {})
  return b
}
export function sprite(ctx: CanvasRenderingContext2D, images: Map<string, HTMLImageElement>, path: string, x: number, y: number, height: number, frame: number, face = 1, flash = false) {
  const img = images.get(path); if (!img) return
  const b = bakedStrip(img, height)
  let src: CanvasImageSource = img, sx: number, sy = 0, sw: number, sh: number, dw: number, dh: number
  if (b) { src = b.c; sx = (frame % b.cols) * b.fw; sy = Math.floor(frame / b.cols) * b.fh; sw = dw = b.fw; sh = dh = b.fh }
  else { sw = img.width / 20; sh = img.height; sx = frame * sw; dh = height; dw = height * sw / sh }
  // 폰 프레임 (11-17): save/restore 대신 옮긴 만큼 되돌린다 — 적 230 명마다 save 가 판 그리기의 8% 를 먹었다
  const tx = Math.round(x), ty = Math.round(y), dx = -Math.round(dw / 2)
  const smooth = ctx.imageSmoothingEnabled
  ctx.translate(tx, ty); if (face !== 1) ctx.scale(face, 1); ctx.imageSmoothingEnabled = false
  ctx.drawImage(src, sx, sy, sw, sh, dx, -dh, dw, dh)
  // 맞은 번쩍: 같은 그림을 한 번 더 빛으로 더한다 — ctx.filter 는 폰에서 그림마다 소프트웨어로 돌아 프레임을 크게 깎았다 (11-16 플립7 20프레임)
  if (flash) { const op = ctx.globalCompositeOperation, a = ctx.globalAlpha; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * C.flashAdd; ctx.drawImage(src, sx, sy, sw, sh, dx, -dh, dw, dh); ctx.globalCompositeOperation = op; ctx.globalAlpha = a }
  if (face !== 1) ctx.scale(face, 1); ctx.translate(-tx, -ty); ctx.imageSmoothingEnabled = smooth
}
/**
 * 회피 잔상 — 화면 쪽에서만 들고 있는 그림 기록(판 상태는 읽기만). 지나온 자리마다 장수 실루엣을 남겨
 * 청록·자홍으로 살짝 갈라 빛으로 겹쳐 그리고 곧 사라진다.
 */
type Ghost = { x: number; y: number; frame: number; face: number; t: number; path: string }
const ghosts: Ghost[] = []
let ghostAt = -1, tint: HTMLCanvasElement | null = null
function trackGhosts(s: HaebiRun, path: string) {
  if (ghosts.length && s.t < ghosts[ghosts.length - 1]!.t) { ghosts.length = 0; ghostAt = -1 }   // 새 판
  if (s.dash > 0 && s.t - ghostAt >= C.ghostEvery) { ghosts.push({ x: s.x, y: s.y, frame: heroFrame(s), face: s.face, t: s.t, path }); ghostAt = s.t }
  while (ghosts.length && s.t - ghosts[0]!.t > C.ghostLife) ghosts.shift()
}
function drawGhosts(ctx: CanvasRenderingContext2D, images: Map<string, HTMLImageElement>, s: HaebiRun, height: number) {
  if (!ghosts.length) return
  const img = images.get(ghosts[0]!.path); if (!img) return
  const fw = img.width / 20, fh = img.height
  tint ??= document.createElement('canvas')
  if (tint.width !== fw || tint.height !== fh) { tint.width = fw; tint.height = fh }
  const t = tint.getContext('2d')!; t.imageSmoothingEnabled = false
  const w = height * fw / fh
  ctx.save(); ctx.imageSmoothingEnabled = false   // 밝은 땅에서 하얗게 날지 않게 덧칠(lighter 아님)
  for (const g of ghosts) {
    const k = 1 - (s.t - g.t) / C.ghostLife; if (k <= 0) continue
    for (const [color, dx, a] of [['#ff2bd6', C.ghostSplit, .55], ['#18e8ff', -C.ghostSplit * .5, 1]] as const) {
      t.globalCompositeOperation = 'copy'; t.drawImage(img, g.frame * fw, 0, fw, fh, 0, 0, fw, fh)
      t.globalCompositeOperation = 'source-in'; t.fillStyle = color; t.fillRect(0, 0, fw, fh)
      ctx.globalAlpha = C.ghostAlpha * a * k * k
      ctx.save(); ctx.translate(Math.round(g.x + dx * (2 - k)), Math.round(g.y)); ctx.scale(g.face, 1)
      ctx.drawImage(tint, -w / 2, -height, w, height); ctx.restore()
    }
  }
  ctx.restore()
}
/** 열전에 선 장수의 전투 그림 — 기본은 해비 · 각성 그림이 없으면 조합을 완성해도 기본 그림 그대로 (raid-main 이 장수마다 정함) */
const heroArt = { base: genArtOf('haebi').file, awake: genArtOf('aw1-haebi').file, body: genArtOf('haebi').body }
export function setHeroArt(baseKey: string, awakeKey?: string) { heroArt.base = genArtOf(baseKey).file; heroArt.awake = awakeKey ? genArtOf(awakeKey).file : heroArt.base; heroArt.body = genArtOf(baseKey).body }
export const heroArtFiles = () => [...new Set([heroArt.base, heroArt.awake])]
/** 판 안 각성(디지몬식) 동안만 각성 그림 — 조합을 열어도 모습은 그대로 (RAID-LINK §1) */
const heroSprite = (s: HaebiRun) => awakenedLook(s) ? heroArt.awake : heroArt.base
/** 걷기 위상(바퀴) — 화면 쪽 기억: 실제로 움직인 거리 ÷ 한 바퀴 보폭. 같은 판 같은 시각엔 한 번만 더하고, 새 판·순간 이동은 건너뛴다 */
const walk = { x: 0, y: 0, t: -1, phase: 0 }
function walkPhase(s: HaebiRun) {
  const d = Math.hypot(s.x - walk.x, s.y - walk.y)
  if (walk.t < 0 || s.t < walk.t || d > C.heroPx) walk.phase = 0
  else if (s.t > walk.t) walk.phase += d / (C.walkStride * C.heroPx * heroArt.body)
  walk.x = s.x; walk.y = s.y; walk.t = s.t
  return walk.phase
}
export function heroFrame(s: HaebiRun, portrait = false, menuTime = 0) {
  if (s.hurt > 0) return 18
  if (s.cast?.kind === 'ult') return 12   // 비기 시전: 기를 모으는 자세
  if (s.attack > 0) return 12 + Math.min(5, Math.floor((.3 - Math.min(.3, s.attack)) / .3 * 6))
  if (s.moving && !portrait) { const n = WALK_CYCLE[heroSprite(s)] ?? 8; return 4 + Math.floor(walkPhase(s) * n) % n }
  return [0, 1, 2, 1][Math.floor((menuTime || s.t) / .65) % 4]!
}
function axe(ctx: CanvasRenderingContext2D, images: Map<string, HTMLImageElement>, x: number, y: number, angle: number, size: number) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle)
  const img = images.get('raid/axe.png')
  ctx.imageSmoothingEnabled = false
  if (img) ctx.drawImage(img, -size, -size, size * 2, size * 2)
  ctx.restore()
}
function stamp(ctx: CanvasRenderingContext2D, images: Map<string, HTMLImageElement>, path: string, x: number, y: number, size: number, angle = 0) {
  const img = images.get(path); if (!img) return
  // 돌리지 않는 그림(기세 알 · 대부분)은 옮기지도 않는다 · 돌리면 돌린 만큼 되돌린다 (save/restore 없이 · 폰 프레임 11-17)
  if (!angle) { ctx.drawImage(img, x - size / 2, y - size / 2, size, size); return }
  ctx.translate(x, y); ctx.rotate(angle); ctx.drawImage(img, -size / 2, -size / 2, size, size); ctx.rotate(-angle); ctx.translate(-x, -y)
}
/** 바닥 표식(H23) — 그림이 있으면 w×h 로 깔고 true. 없으면 false 를 돌려 옛 선 그리기로 대신하게 한다 */
function decal(ctx: CanvasRenderingContext2D, images: Map<string, HTMLImageElement>, name: string, x: number, y: number, w: number, h: number, alpha = 1) {
  const img = images.get('raid/ui/' + name + '.png'); if (!img) return false
  ctx.save(); ctx.globalAlpha *= alpha; ctx.drawImage(img, x - w / 2, y - h / 2, w, h); ctx.restore(); return true
}
/** 적 그림 — 두목은 스테이지마다(HAEBI_STAGES.boss) · 정예는 산적 두령 · 나머지는 bandit-<종류> 또는 MOB_ART */
const warlord = (mob: string, stage: StageId) => 'anim-px/' + (mob === 'boss' ? ST[stage].boss : mob === 'elite' ? 'bandit-chief' : MOB_ART[mob] ?? 'bandit-' + mob) + '.png'
/** 산적 활잡이는 사거리 안에서 멈춰 서서 쏜다 — 메기기(13) → 당기기(14) → 놓기(16) · 걷는 그림으로 제자리걸음하지 않게 (H26) */
function archerFrame(s: HaebiRun, e: HaebiRun['enemies'][number]) {
  const d = Math.hypot(s.x - e.x, s.y - e.y)
  if (e.kind === 'archer') return d >= C.archerRange ? null : e.cd > C.archerCooldown - .35 ? 16 : e.cd < .7 ? 14 : 13
  // 적 단계 (11-16): 칸 12·13 준비 · 14·15 공격 · 16·17 마무리 (bake-raid-enemies.py)
  if (e.kind === 'runner') return e.act > 0 ? 12 : e.act < 0 ? 14 : null
  if (e.kind === 'slinger' || e.kind === 'firearcher') return d >= M.lobRange ? null : e.cd > M.lobCooldown - .4 ? 16 : e.cd < 1 ? 14 : 12
  if (e.kind === 'shaman') return d >= M.shamanRange ? null : e.cd > M.shamanEvery - .7 ? 14 : 12
  // 설원·산성 (11-16 H50~H53): 범 웅크림 12 → 덮침 14 → 내려앉음 16 · 곰 일어섬은 wind(13) → 내려침 14 · 투창 겨눔 12 → 던짐 14 → 새 창 16 · 방화꾼 단지 던짐 14
  if (e.kind === 'tiger') return e.act > 0 ? 12 : e.act < 0 ? 14 : e.cd > M.tigerCooldown - .3 ? 16 : null
  if (e.kind === 'bear') return e.cd > M.bearCooldown - M.bearWind - .35 && e.cd <= M.bearCooldown - M.bearWind ? 14 : null
  if (e.kind === 'hunter') return e.act > 0 ? 12 : e.cd > M.hunterCooldown - .35 ? 14 : e.cd > M.hunterCooldown - .8 ? 16 : null
  if (e.kind === 'torch') return e.cd > M.torchCooldown - .4 ? 14 : null
  if (d < 34 && e.cd > .6) return 14
  return null
}
const mobHeight = (mob: string) => mob === 'boss' ? 150 : mob === 'elite' ? 100 : mob in M ? (M as unknown as Record<string, { height: number }>)[mob]!.height : 64
/** 피해 숫자 — H32 글꼴 (위 줄 보통 · 아래 줄 급소·쓰러뜨림) · 그림이 없으면 글자로 */
function digits(ctx: CanvasRenderingContext2D, images: Map<string, HTMLImageElement>, text: string, x: number, y: number, h: number, hot: boolean) {
  const img = images.get('raid/digits.png'); if (!img) return false
  const cw = img.width / 10, ch = img.height / 2, w = h * cw / ch * .78
  let px = x - text.length * w / 2
  for (const c of text) { ctx.drawImage(img, Number(c) * cw, hot ? ch : 0, cw, ch, px - w * .11, y - h / 2, w / .78, h); px += w }
  return true
}
export function impactFrame(age: number) { return Math.min(7, Math.max(0, Math.floor(age * 8))) }
/** Simulation positions are ground contacts; project missiles at hand/bow height. */
export function projectileAnchor(b: Missile) {
  const release = b.kind === 'shard' ? 0 : Math.max(0,1-(C.galeLife-b.life)/C.shotReleaseTime)
  return {x:b.x+Math.sign(b.vx)*C.shotHandLead*release,y:b.y-(b.kind==='enemy'||b.kind==='hurl'?C.enemyShotHeight:C.heroShotHeight)}
}
function impact(ctx: CanvasRenderingContext2D, images: Map<string, HTMLImageElement>, x: number, y: number, radius: number, age: number) {
  const img = images.get('raid/impact-strip.png'); if (!img) return
  // Size is fixed for the whole event: expansion is authored inside the eight frames.
  ctx.drawImage(img, impactFrame(age) * 256, 0, 256, 256, x - radius, y - radius, radius * 2, radius * 2)
}
function effectStrip(ctx: CanvasRenderingContext2D, images: Map<string, HTMLImageElement>, name: string, x: number, y: number, radius: number, age: number, angle = 0) {
  const img = images.get(`raid/${name}-strip.png`); if (!img) return
  ctx.save(); ctx.translate(x,y); ctx.rotate(angle)
  ctx.drawImage(img,impactFrame(age)*256,0,256,256,-radius,-radius,radius*2,radius*2);ctx.restore()
}
/** 비기 빛깔 — 묶음마다 (도끼 흙불 · 활 하늘 · 창 은빛 · 칼 번개 · 단검 그림자 · 방울 신령 금빛) */
const ULT_COLOR: Record<Kit, string> = { axe: '#ffb04a', bow: '#d4ecff', spear: '#eef3ff', sword: '#8fd0ff', dagger: '#b48cff', magic: '#ffe27a', sling: '#e6cfa2' }
/** 진 비기(각성 중) 빛깔 — 묶음 빛에 금을 섞어 더 뜨겁게 (11-17 형: 「진 하늘굿처럼」) */
const TRUE_COLOR: Record<Kit, string> = { axe: '#ffd25a', bow: '#fff1b0', spear: '#ffe9a8', sword: '#ffe27a', dagger: '#ffc6f0', magic: '#fff3b8', sling: '#ffd98a' }
/** 진 비기가 터지는 자리: 금빛 충격 고리 둘 + 사방으로 뻗는 빛살 (lighter · 그라디언트·필터 없이 선만) */
function trueFlare(ctx: CanvasRenderingContext2D, x: number, y: number, age: number) {
  const op = ctx.globalCompositeOperation, a = ctx.globalAlpha
  ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#ffd86a'
  for (const [k, w] of [[1, 7], [.62, 4]] as const) {
    const r = 40 + 330 * Math.min(1, age * 1.8) * k
    ctx.globalAlpha = a * Math.max(0, 1 - age * 1.4); ctx.lineWidth = w; ctx.beginPath(); ctx.ellipse(x, y, r, r * .55, 0, 0, Math.PI * 2); ctx.stroke()
  }
  ctx.globalAlpha = a * Math.max(0, 1 - age * 2); ctx.lineWidth = 3; ctx.strokeStyle = '#fff2c0'; ctx.beginPath()
  for (let i = 0; i < 14; i++) { const ang = i * Math.PI / 7 + .2, r0 = 30 + age * 120, r1 = r0 + 70 + (i % 3) * 30; ctx.moveTo(x + Math.cos(ang) * r0, y - 40 + Math.sin(ang) * r0 * .6); ctx.lineTo(x + Math.cos(ang) * r1, y - 40 + Math.sin(ang) * r1 * .6) }
  ctx.stroke(); ctx.globalCompositeOperation = op; ctx.globalAlpha = a
}
/** 띠 그림의 한 칸을 (0,0)→(len,0) 으로 늘여 그린다 — 번개 띠(256×128 여덟 칸) */
function stripAlong(ctx: CanvasRenderingContext2D, img: HTMLImageElement | undefined, age: number, len: number, h: number) {
  if (img) ctx.drawImage(img, impactFrame(age) * 256, 0, 256, 128, 0, -h / 2, len, h)
}
/** 비기 그림 (판 상태는 읽기만) — f.ult 묶음마다 꼴이 다르다. 폰 프레임: filter·shadowBlur·그라디언트 없이 그림 띠와 선만 */
function drawUlt(ctx: CanvasRenderingContext2D, images: Map<string, HTMLImageElement>, s: HaebiRun, f: HaebiRun['fx'][number], age: number) {
  const kit = f.ult!, color = f.tru ? TRUE_COLOR[kit] : ULT_COLOR[kit], len = Math.hypot(f.x2 - f.x, f.y2 - f.y), lead = f.kind === 'skill'
  if (f.tru && lead) trueFlare(ctx, kit === 'sling' ? f.x2 : f.x, kit === 'sling' ? f.y2 : f.y, age)
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  if (kit === 'axe') {
    // 천지 가르기: 땅이 앞으로 갈라져 나간다 — 바닥 빛 띠 · 지그재그 금 · 금을 따라 차례로 터지는 흙불
    const reach = len * Math.min(1, age * 2.4), r = f.r
    ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.angle)
    ctx.globalAlpha *= .3 * (1 - age); ctx.fillRect(0, -r * .55, reach, r * 1.1); ctx.restore()
    ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.angle)
    for (const [w, c] of [[9, '#2a1407'], [3, color]] as const) {
      ctx.lineWidth = w; ctx.strokeStyle = c; ctx.beginPath(); ctx.moveTo(0, 0)
      for (let d = 26, i = 1; d < reach; d += 26, i++) ctx.lineTo(d, Math.sin(i * 2.3) * r * .28)
      ctx.lineTo(reach, 0); ctx.stroke()
    }
    for (let d = 40, i = 0; d < reach; d += 80, i++) impact(ctx, images, d, Math.sin(i * 1.7) * r * .2 - 8, r * .75, Math.max(0, age * 1.7 - i * .06))
    ctx.restore()
    impact(ctx, images, f.x, f.y - 8, U.axe.burst * areaScale(s), age)   // 내려찍은 발밑
    if (age < .45) axe(ctx, images, f.x, f.y - C.heroShotHeight, f.angle - 1.4 + Math.min(1, age * 5) * 1.4, 54)
  } else if (kit === 'bow') {
    // 하늘 꿰뚫기: 큰 화살 한 대가 화면 끝까지 — 지나간 자리에 빛줄기가 남아 옅어진다
    const head = len * Math.min(1, age * 3.2)
    ctx.save(); ctx.translate(f.x, f.y - C.heroShotHeight); ctx.rotate(f.angle); ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha *= .45 * (1 - age); ctx.lineWidth = f.r * .9; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(head, 0); ctx.stroke()
    ctx.globalAlpha = Math.min(1, (1 - age) * 2); ctx.lineWidth = 3; ctx.strokeStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(head, 0); ctx.stroke()
    ctx.restore()
    stamp(ctx, images, 'raid/arrow.png', f.x + Math.cos(f.angle) * head, f.y - C.heroShotHeight + Math.sin(f.angle) * head, 150, f.angle)
  } else if (kit === 'spear') {
    // 용오름 창: 창날 여덟이 몸 둘레를 돌며 솟구친다 (솟음마다 고리가 넓어진다)
    const rr = f.r * (.55 + .45 * age)
    ctx.save(); ctx.globalAlpha *= 1 - age; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(f.x, f.y, rr, rr * .6, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore()
    for (let j = 0; j < 8; j++) {
      const a = j * Math.PI / 4 + f.angle * .4 + age * 2.6
      stamp(ctx, images, 'raid/javelin.png', f.x + Math.cos(a) * rr, f.y + Math.sin(a) * rr * .6 - 30 - age * 80, 74, -Math.PI / 2 + Math.cos(a) * .35)
    }
  } else if (kit === 'sword') {
    // 번개 베기: 지나온 줄에 번개가 남고, 장수 잔상 넷 · 베기 셋
    ctx.save(); ctx.globalAlpha *= .32 * (1 - age)
    for (let i = 0; i < 4; i++) { const k = i / 4; sprite(ctx, images, heroSprite(s), f.x + (f.x2 - f.x) * k, f.y + (f.y2 - f.y) * k, C.heroPx, 12, Math.cos(f.angle) < 0 ? -1 : 1) }
    ctx.restore()
    ctx.save(); ctx.translate(f.x, f.y - C.heroShotHeight); ctx.rotate(f.angle); ctx.globalCompositeOperation = 'lighter'
    stripAlong(ctx, images.get('raid/lightning-strip.png'), age, len, f.r * .8); ctx.restore()
    for (let i = 1; i <= 3; i++) effectStrip(ctx, images, 'slash', f.x + (f.x2 - f.x) * i / 4, f.y + (f.y2 - f.y) * i / 4 - C.heroShotHeight, f.r * .9, Math.min(1, age + i * .08), f.angle + i * 1.3)
  } else if (kit === 'dagger') {
    if (!f.r) {
      // 사라짐(첫 조각)·돌아옴: 그림자 연기 · 돌아오는 줄
      if (lead) effectStrip(ctx, images, 'death', f.x, f.y - 20, 46, age)
      else { ctx.globalAlpha *= .6; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(f.x2, f.y2 - 30); ctx.lineTo(f.x, f.y - 30); ctx.stroke() }
      return
    }
    // 그림자 베기: 앞 자리에서 그 적까지 보랏빛 줄 · 앞 자리에 잔상 · 적 위에 엇갈린 베기 둘
    ctx.save(); ctx.globalAlpha *= .7 * (1 - age); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(f.x2, f.y2 - 30); ctx.lineTo(f.x, f.y - 30); ctx.stroke()
    ctx.globalAlpha *= .5; sprite(ctx, images, heroSprite(s), f.x2, f.y2, C.heroPx, 14, f.x2 < f.x ? 1 : -1); ctx.restore()
    for (const turn of [0, 1.7]) effectStrip(ctx, images, 'slash', f.x, f.y - 30, f.r * 1.3, age, f.angle * 2.1 + turn)
    stamp(ctx, images, 'raid/knife.png', f.x, f.y - 30, 40, f.angle * 2.1 + age * 6)
  } else if (kit === 'sling') {
    if (lead) {
      // 돌벼락 예고: 떨어질 둘레에 짙어지는 그림자 · 하늘에서 쏟아지는 돌 줄기 · 장수 머리 위로 크게 도는 팔매
      ctx.save(); ctx.globalAlpha *= .35 * (1 - age * .6); ctx.fillStyle = '#1a120a'; ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r, f.r * .62, 0, 0, Math.PI * 2); ctx.fill()
      ctx.globalAlpha = Math.min(1, (1 - age) * 2); ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r, f.r * .62, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore()
      for (let i = 0; i < 9; i++) {
        const k = (age * 3 + i * .37) % 1, a = i * 2.4, rr = f.r * Math.sqrt((i + .5) / 9)
        stamp(ctx, images, ROCK, f.x + Math.cos(a) * rr, f.y + Math.sin(a) * rr * .62 - (1 - k) * 300, 18 + (i % 3) * 5, k * 6 + i)
      }
      const hx = f.x2, hy = f.y2 - C.heroShotHeight - 26, spin = age * 26
      ctx.save(); ctx.globalAlpha *= 1 - age; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(hx, hy, 34, 12, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore()
      stamp(ctx, images, ROCK, hx + Math.cos(spin) * 34, hy + Math.sin(spin) * 12, 16, spin)
      return
    }
    // 떨어진 돌 하나: 흙먼지 터짐 · 땅에 박혔다 튀어 오르는 돌
    impact(ctx, images, f.x, f.y - 6, f.r * 1.1, age)
    stamp(ctx, images, ROCK, f.x, f.y - 10 - Math.sin(Math.min(1, age * 1.6) * Math.PI) * 18, 22 + (f.angle % 3) * 4, f.angle)
  } else {
    if (lead) {
      // 하늘 굿: 장수 둘레로 굿판 방울 소리가 크게 퍼진다
      const img = images.get('raid/bell-ring.png'), r = 260 * (.3 + .7 * age)
      if (img) { ctx.globalAlpha *= 1 - age * .7; ctx.drawImage(img, f.x - r, f.y - r * .6, r * 2, r * 1.2) }
      return
    }
    // 신령 번개: 적마다 하늘에서 곧게 내리꽂힘 · 자리마다 조금씩 늦게 (그리기만 · 맞는 건 한꺼번에)
    const late = ((f.x * 13 + f.y * 7) % 100) / 100 * .3, k = (age - late) / (1 - late)
    if (k < 0) return
    ctx.save(); ctx.translate(f.x, f.y - 330); ctx.rotate(Math.PI / 2); ctx.globalCompositeOperation = 'lighter'
    stripAlong(ctx, images.get('raid/lightning-strip.png'), k, 320, 44); ctx.restore()
    impact(ctx, images, f.x, f.y - 8, 34, k)
  }
}
/**
 * 피해 숫자 알갱이 (11-17 형: 「퍽 하고 테일즈위버처럼」) — 화면 쪽 기억(판 상태는 읽기만): 새로 생긴 숫자 표식(f.n)을 한 번씩 알갱이로 옮겨
 * 판 시각으로 날린다(멈추면 같이 멈추고 시전 동안은 같이 느려진다). 크게 찍혔다 줄며 포물선으로 옆·위로 튀고 살짝 흔들린다 ·
 * 겹쳐도 읽히게 좌우를 번갈아 다른 폭으로 · 치명타는 더 빠르고 크고 금·주황 + 작은 터짐 · 개수 한도 drawNumbers (새것만).
 */
type Num = { x: number; y: number; vx: number; vy: number; g: number; t: number; life: number; text: string; crit: boolean; kill: boolean; spin: number; sum: number; pop: number }
const nums: Num[] = [], seenNum = new WeakSet<object>()
let numT = -1, numFlip = 0
function trackNumbers(s: HaebiRun) {
  if (s.t < numT) nums.length = 0   // 새 판
  numT = s.t
  for (const f of s.fx) {
    if (f.n === undefined || f.mob === 'boss' || seenNum.has(f)) continue
    seenNum.add(f)
    const crit = !!f.crit, kill = f.kind === 'death', sp = crit ? C.numCritSpeed : 1
    // 같은 자리 · 방금 난 숫자에 더한다 (11-18 · 무리를 한꺼번에 치면 한 덩이) — 더해지면 다시 크게 튄다
    const near = nums.find(p => s.t - p.t < C.numMergeTime && p.kill === kill && Math.abs(p.x - f.x) < C.numMerge && Math.abs(p.y - (f.y - (kill ? 30 : 16))) < C.numMerge)
    if (near) { near.sum += f.n; near.text = String(Math.round(near.sum)); near.pop = s.t; if (crit && !near.crit) { near.crit = true; near.life = C.numCritLife } continue }
    numFlip = (numFlip + 1) % 6
    const side = (numFlip % 2 ? 1 : -1) * (.45 + (numFlip >> 1) * .3)
    nums.push({ x: f.x, y: f.y - (kill ? 30 : 16), vx: side * C.numSpread * sp, vy: -C.numRise * sp, g: C.numGravity * sp * sp, t: s.t, life: crit ? C.numCritLife : C.numLife, text: String(Math.round(f.n)), crit, kill, spin: side * C.numWobble, sum: f.n, pop: s.t })
    if (nums.length > C.drawNumbers) nums.shift()
  }
  for (let i = nums.length - 1; i >= 0; i--) if (s.t - nums[i]!.t >= nums[i]!.life) nums.splice(i, 1)
}
function drawNumbers(ctx: CanvasRenderingContext2D, images: Map<string, HTMLImageElement>, s: HaebiRun) {
  const hit = images.get('raid/hit.png')
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'
  for (const p of nums) {
    const age = s.t - p.t, k = age / p.life; if (k < 0 || k >= 1) continue
    const x = p.x + p.vx * age, y = p.y + p.vy * age + p.g * age * age / 2
    const popT = C.numPopTime / (p.crit ? C.numCritSpeed : 1), pa = s.t - p.pop, scale = pa < popT ? C.numPop - (C.numPop - 1) * pa / popT : 1
    const size = p.crit ? C.numCritSize : p.kill ? C.numKill : C.numSize
    ctx.save(); ctx.translate(x, y); ctx.rotate(p.spin * Math.sin(age * 34) * (1 - k)); ctx.scale(scale, scale)
    ctx.globalAlpha = k < .72 ? 1 : (1 - k) / .28
    // 치명타: 숫자 뒤 작은 터짐 (빛으로 더함)
    if (p.crit && hit && age < .2) { ctx.globalCompositeOperation = 'lighter'; const r = C.numCritBurst * (.55 + age * 3); ctx.globalAlpha = 1 - age / .2; ctx.drawImage(hit, -r / 2, -r / 2, r, r); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1 }
    if (!digits(ctx, images, p.text, 0, 0, size, p.crit)) {
      ctx.font = '900 ' + size + "px 'Barlow Condensed', system-ui, sans-serif"
      ctx.lineWidth = 5; ctx.strokeStyle = p.crit ? '#5a1408' : '#2a1d12'; ctx.strokeText(p.text, 0, 0)
      ctx.fillStyle = p.crit ? '#ffb43a' : '#fff6e2'; ctx.fillText(p.text, 0, 0)
    }
    ctx.restore()
  }
}
/** 각성 오라 (11-17 형: 「캐릭터 에셋 주변에 여러 오라」) — 뒤: 몸 뒤 빛 · 발밑에서 서로 거꾸로 도는 고리 둘 · 솟는 금빛 기운 / 앞: 오르는 불티. 'lighter' · filter 없음 */
let auraGlow: CanvasGradient | null = null
function drawAura(ctx: CanvasRenderingContext2D, s: HaebiRun, front: boolean) {
  const t = s.t, R = C.auraRing, op = ctx.globalCompositeOperation, a = ctx.globalAlpha
  ctx.globalCompositeOperation = 'lighter'
  if (!front) {
    // 몸 뒤 둥근 빛 (그라디언트 하나를 한 번만 만들어 옮겨 쓴다)
    auraGlow ??= (() => { const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 62); g.addColorStop(0, '#ffd56aa0'); g.addColorStop(.55, '#ff9a3a40'); g.addColorStop(1, '#ff9a3a00'); return g })()
    const pulse = .8 + .2 * Math.sin(t * 7), cy = s.y - C.heroPx * .5
    ctx.save(); ctx.translate(s.x, cy); ctx.scale(pulse, pulse * 1.35); ctx.fillStyle = auraGlow; ctx.fillRect(-62, -62, 124, 124); ctx.restore()
    ctx.globalCompositeOperation = 'lighter'
    // 발밑 고리: 안쪽은 이쪽으로, 바깥은 저쪽으로 돈다 (끊긴 호 셋씩)
    ctx.strokeStyle = '#ffd66a'
    for (const [r, dir, w, al] of [[R, 1, 4.5, 1], [R * 1.42, -1, 3, .7]] as const) {
      ctx.lineWidth = w; ctx.globalAlpha = a * al; ctx.beginPath()
      for (let i = 0; i < 3; i++) { const a0 = dir * t * C.auraSpin + i * Math.PI * 2 / 3; ctx.moveTo(s.x + Math.cos(a0) * r, s.y + Math.sin(a0) * r * .34); ctx.ellipse(s.x, s.y, r, r * .34, 0, a0, a0 + 1.25) }
      ctx.stroke()
    }
    // 솟는 기운: 발밑에서 위로 오르며 가늘어지는 불꽃 혀
    ctx.fillStyle = '#ffae38'
    for (let i = 0; i < C.auraFlames; i++) {
      const ph = (t * 1.25 + i / C.auraFlames) % 1, side = Math.sin(i * 2.399) * R * .62, x = s.x + side + Math.sin(t * 5 + i) * 4, y = s.y - ph * C.auraFlameRise
      ctx.globalAlpha = a * .8 * (1 - ph); ctx.beginPath(); ctx.ellipse(x, y - 10, 9 * (1 - ph * .6), 24 * (1 - ph * .4), 0, 0, Math.PI * 2); ctx.fill()
    }
  } else {
    // 불티: 몸 둘레에서 반짝이며 오른다
    ctx.fillStyle = '#fff1b8'
    for (let i = 0; i < C.auraSparks; i++) {
      const ph = (t * .9 + i * .137) % 1, ang = i * 2.399 + t * .8, x = s.x + Math.cos(ang) * (18 + i % 4 * 9), y = s.y - 14 - ph * (C.heroPx + 30)
      ctx.globalAlpha = a * (1 - ph) * (.6 + .4 * Math.sin(t * 20 + i)); const r = 1.6 + (i % 3) * .8; ctx.fillRect(x - r, y - r, r * 2, r * 2)
    }
  }
  ctx.globalCompositeOperation = op; ctx.globalAlpha = a
}
/** 영웅의 투지 보호막 — 몸 둘레 반투명 방패 빛 ('lighter' · filter 없음) · 남은 흡수량만큼 짙고, 막아 낸 직후엔 번쩍 */
let wardGlow: CanvasGradient | null = null
function drawWard(ctx: CanvasRenderingContext2D, s: HaebiRun) {
  if (s.ward <= 0) return
  const k = Math.min(1, s.ward / wardMax(s)), flash = s.inv > C.hitInv - A.gritShieldFlash ? 1 : 0, p = .5 + .5 * Math.sin(s.t * 5)
  const op = ctx.globalCompositeOperation, a = ctx.globalAlpha, cy = s.y - C.heroPx * .46, rx = A.gritShieldRx * (1 + .03 * p), ry = A.gritShieldRy * (1 + .03 * p)
  ctx.globalCompositeOperation = 'lighter'
  // 껍질: 가운데는 비고 가장자리가 하늘빛 (그라디언트 하나를 한 번만 만들어 늘려 쓴다)
  wardGlow ??= (() => { const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1); g.addColorStop(0, '#2f86ff12'); g.addColorStop(.6, '#3a96ff3a'); g.addColorStop(.88, '#78c8ffb0'); g.addColorStop(1, '#78c8ff00'); return g })()
  ctx.globalAlpha = a * Math.min(1, A.gritShieldAlpha * (.55 + .45 * k) + flash * .4)
  ctx.save(); ctx.translate(s.x, cy); ctx.scale(rx, ry); ctx.fillStyle = wardGlow; ctx.fillRect(-1, -1, 2, 2); ctx.restore()
  ctx.globalCompositeOperation = 'lighter'
  // 테두리 · 위쪽을 도는 흰 윤기 한 줄
  ctx.strokeStyle = flash ? '#ffffff' : '#62c0ff'; ctx.lineWidth = 2; ctx.globalAlpha = a * (.35 + .4 * k + flash * .25)
  ctx.beginPath(); ctx.ellipse(s.x, cy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke()
  const sheen = s.t * 1.6 % (Math.PI * 2)
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.globalAlpha = a * (.3 + .4 * k)
  ctx.beginPath(); ctx.ellipse(s.x, cy, rx * .86, ry * .9, 0, sheen, sheen + .7); ctx.stroke()
  ctx.globalCompositeOperation = op; ctx.globalAlpha = a
}
/** 비기·각성 시전: 기운이 장수에게 모여드는 고리 (남은 시간만큼 오므라든다) · 진 비기·각성은 금빛 겹고리 */
function drawCast(ctx: CanvasRenderingContext2D, s: HaebiRun) {
  const c = s.cast; if (!c) return
  const k = Math.max(0, c.t / c.total), gold = c.tru || c.kind === 'wake', op = ctx.globalCompositeOperation, a = ctx.globalAlpha
  ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = gold ? '#ffd66a' : ULT_COLOR[s.kit]
  for (const [m, w] of (gold ? [[1, 4], [1.5, 2]] : [[1, 3]]) as [number, number][]) {
    const r = (24 + 150 * k) * m; ctx.lineWidth = w; ctx.globalAlpha = a * (1 - k * .7) * .9
    ctx.beginPath(); ctx.ellipse(s.x, s.y, r, r * .4, 0, 0, Math.PI * 2); ctx.stroke()
  }
  ctx.globalCompositeOperation = op; ctx.globalAlpha = a
}
/** 비기가 터지는 순간 판이 떤다 — 가장 새 비기 머리 조각의 나이로 (진 비기는 더 크게) · 그리기만 */
function shakeOf(s: HaebiRun) {
  let best: HaebiRun['fx'][number] | null = null
  for (const f of s.fx) if (f.kind === 'skill' && f.ult && (!best || f.life / f.total > best.life / best.total)) best = f
  if (!best) return 0
  const k = 1 - (best.total - best.life) / .3
  return k > 0 ? (best.tru ? 7 : 3.5) * k : 0
}
export function drawPortrait(ctx: CanvasRenderingContext2D, images: Map<string, HTMLImageElement>, s: HaebiRun, menuTime = 0) {
  const { width: w, height: h } = ctx.canvas; ctx.clearRect(0, 0, w, h)
  const bg = ctx.createRadialGradient(w / 2, h * .46, 20, w / 2, h / 2, h * .65)
  bg.addColorStop(0, awakenedLook(s) ? '#6c5932' : '#394e46'); bg.addColorStop(1, '#111c20'); ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = '#d9bc6955'; ctx.lineWidth = 1
  for (const r of [90, 120, 145]) { ctx.beginPath(); ctx.arc(w / 2, h * .55, r, 0, Math.PI * 2); ctx.stroke() }
  sprite(ctx, images, heroSprite(s), w / 2, h - 24, h - 28, heroFrame(s, true, menuTime), 1, s.hurt > 0)
  if (s.hurt > 0) { ctx.fillStyle = '#f5654933'; ctx.fillRect(0, 0, w, h) }
}
/** 판 바탕 — 큰 그림을 판 크기로 줄이고 어둡게 덮은 것을 한 번만 구워 둔다 (판마다 큰 그림을 줄여 그리던 것 · 폰 프레임 11-17) */
let backdrop: { img: HTMLImageElement; canvas: HTMLCanvasElement } | null = null
function fieldBackdrop(bg: HTMLImageElement, W: number, H: number) {
  if (backdrop?.img === bg) return backdrop.canvas
  if (typeof document === 'undefined') return null   // 헤드리스 시험(node) — 그때그때 그린다
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H
  const c = canvas.getContext('2d')!, sw = bg.height * W / H
  c.fillStyle = '#273c35'; c.fillRect(0, 0, W, H)
  c.drawImage(bg, (bg.width - sw) / 2, 0, sw, bg.height, 0, 0, W, H)
  c.fillStyle = '#11281b25'; c.fillRect(0, 0, W, H)
  backdrop = { img: bg, canvas }; return canvas
}
/** 그리는 차례 (위에서 아래로) — 판마다 다시 쓰는 배열 */
const order: (HaebiRun['enemies'][number] | null)[] = []
export function drawField(ctx: CanvasRenderingContext2D, images: Map<string, HTMLImageElement>, s: HaebiRun, destination: { x: number; y: number } | null) {
  const W = C.width, H = C.height
  ctx.setTransform(1, 0, 0, 1, 0, 0)   // 그림마다 옮겼다 되돌리는 셈의 작은 오차가 판마다 쌓이지 않게 (sprite·stamp 는 save/restore 없이 · 11-17)
  ctx.fillStyle = '#273c35'; ctx.fillRect(0, 0, W, H)
  const quake = shakeOf(s)
  if (quake) ctx.setTransform(1, 0, 0, 1, Math.round(Math.sin(s.t * 91) * quake), Math.round(Math.cos(s.t * 77) * quake * .6))
  const bg = images.get('raid/' + ST[s.stage].bg) ?? images.get('raid/forest.webp')
  const baked = bg && fieldBackdrop(bg, W, H)
  if (baked) ctx.drawImage(baked, 0, 0)
  else { if (bg) { const sw = bg.height * W / H; ctx.drawImage(bg, (bg.width - sw) / 2, 0, sw, bg.height, 0, 0, W, H) } ctx.fillStyle = '#11281b25'; ctx.fillRect(0, 0, W, H) }
  for (const e of s.enemies) if (e.wind > 0) {
    // 내려찍기 경고: 금 간 땅 원(점점 진해짐) + 바깥까지 자라는 고리 = 맞는 범위 그대로 (지름 2r)
    const r = slamRadius(e.kind), k = 1 - e.wind / slamWindup(e.kind)
    if (!decal(ctx, images, 'mark-slam', e.aimX, e.aimY, r * 2, r * 2, .55 + .45 * k) || !decal(ctx, images, 'mark-ring', e.aimX, e.aimY, r * 2 * k, r * 2 * k)) {
      ctx.fillStyle = '#df4c3455'; ctx.strokeStyle = '#ffc1a0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(e.aimX, e.aimY, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
      ctx.beginPath(); ctx.arc(e.aimX, e.aimY, r * k, 0, Math.PI * 2); ctx.stroke()
    }
  }
  // 창돌격꾼·범 돌진 · 투창 사냥꾼 겨눔 예고: 겨눈 줄이 점점 진해진다 (투창은 가늘게)
  for (const e of s.enemies) if (e.act > 0 && (charge(e.kind) || e.kind === 'hunter')) {
    const thin = e.kind === 'hunter', k = 1 - e.act / (thin ? M.hunterWind : charge(e.kind)!.wind)
    ctx.save(); ctx.globalAlpha = .25 + .55 * k; ctx.strokeStyle = '#ff4a3a'; ctx.lineWidth = thin ? 3 + 4 * k : 6 + 10 * k; ctx.lineCap = 'round'
    ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.aimX, e.aimY); ctx.stroke(); ctx.restore()
  }
  // 돌팔매·불화살 떨어질 자리 · 타는 불바닥
  for (const b of s.shots) if (b.kind === 'stone') {
    const k = Math.max(0, b.life) / M.lobDelay, r = b.radius
    ctx.save(); ctx.strokeStyle = b.gen ? '#ff7a3a' : '#e8c890'; ctx.fillStyle = b.gen ? '#ff5a2a33' : '#e8c89026'; ctx.lineWidth = 3
    ctx.beginPath(); ctx.ellipse(b.x, b.y, r, r * .6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
    ctx.beginPath(); ctx.ellipse(b.x, b.y, r * (1 - k), r * .6 * (1 - k), 0, 0, Math.PI * 2); ctx.stroke()
    // 포물선: 던진 자리(tx,ty)에서 떨어질 자리로
    const u = 1 - k, px = b.tx + (b.x - b.tx) * u, py = b.ty + (b.y - b.ty) * u - Math.sin(u * Math.PI) * 160
    ctx.fillStyle = b.gen ? '#ff8a3a' : '#8a7a66'; ctx.beginPath(); ctx.arc(px, py - 20, b.gen ? 6 : 7, 0, Math.PI * 2); ctx.fill(); ctx.restore()
  } else if (b.kind === 'flame') effectStrip(ctx, images, 'fire', b.x, b.y - 10, b.radius * 1.1, (s.t * 1.7 + b.x * .01) % 1)
  // 못 주운 기세는 마지막 1초에 옅어지며 사라진다 (dropLife)
  for (const d of s.drops) { const fade = Math.min(1, C.dropLife - d.age); if (fade < 1) ctx.globalAlpha = Math.max(0, fade); stamp(ctx, images, d.value > 2 ? 'raid/essence-large.png' : 'raid/essence.png', d.x, d.y, d.value > 2 ? 23 : 15); if (fade < 1) ctx.globalAlpha = 1 }
  if (destination) decal(ctx, images, 'mark-move', destination.x, destination.y, 30, 26, .85)
  // 발밑 그림자는 길 하나로 한 번에 칠한다 (적마다 fill 하던 것 · 폰 프레임 11-17) — 땅이라 모든 몸보다 먼저 그려도 된다
  ctx.fillStyle = '#07181655'; ctx.beginPath()
  for (const e of s.enemies) { const rx = e.kind === 'boss' || e.kind === 'elite' ? 24 : 16; ctx.moveTo(e.x + rx, e.y + 2); ctx.ellipse(e.x, e.y + 2, rx, 6, 0, 0, Math.PI * 2) }
  ctx.fill()
  // 위에서 아래로 그린다 (null = 장수) — 판마다 새 배열을 만들지 않는다
  order.length = 0; for (const e of s.enemies) order.push(e); order.push(null)
  order.sort((a, b) => (a ? a.y : s.y) - (b ? b.y : s.y))
  for (const e of order) {
    if (e) {
      const big = e.kind === 'boss' || e.kind === 'elite', h = mobHeight(e.kind)
      const target = s.mode === 'vanguard' && e.kind === 'boss'
      // 무당이 북돋운 적 · 성난 광전사: 발밑 붉은 기운
      if (e.buff > 0 || e.kind === 'berserker' && e.hp < e.max / 2) { ctx.save(); ctx.globalAlpha = .45 + .25 * Math.sin(s.t * 12 + e.id); ctx.fillStyle = '#ff3b2f'; ctx.beginPath(); ctx.ellipse(e.x, e.y + 2, 22, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore() }
      if (target) decal(ctx, images, 'mark-target', e.x, e.y, 100, 45)
      sprite(ctx, images, warlord(e.kind, s.stage), e.x, e.y, h, e.wind > 0 ? 13 : archerFrame(s, e) ?? 4 + Math.floor(s.t * 8 + e.id) % 8, s.x < e.x ? -1 : 1, e.flash > 0)
      // 어지럼 돌: 머리 위를 도는 별 둘
      if (e.daze > 0) for (let i = 0; i < 2; i++) { const a = s.t * 7 + i * Math.PI; stamp(ctx, images, 'raid/hit.png', e.x + Math.cos(a) * 14, e.y - h - 4 + Math.sin(a) * 4, 14, a) }
      if (target) decal(ctx, images, 'mark-arrow', e.x, e.y - h - 26 + Math.sin(s.t * 4) * 4, 22, 39)
      if (big) { ctx.fillStyle = '#111c'; ctx.fillRect(e.x - 28, e.y - h, 56, 5); ctx.fillStyle = '#ef9873'; ctx.fillRect(e.x - 28, e.y - h, 56 * e.hp / e.max, 5) }
    } else {
      if (!decal(ctx, images, 'mark-hero', s.x, s.y, 72, 32, .8)) { ctx.strokeStyle = '#f9d89788'; ctx.fillStyle = '#ffd97726'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(s.x, s.y, 29, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke() }
      trackGhosts(s, heroSprite(s)); drawGhosts(ctx, images, s, C.heroPx)
      // 각성(금빛)·투지(붉은빛) 동안 발밑에 뛰는 빛 고리 — 그림 하나 더 없이 선 두 개
      if (s.form === 'awake') drawAura(ctx, s, false)
      drawCast(ctx, s)
      if (s.form !== 'normal') { const p = .5 + .5 * Math.sin(s.t * 9); ctx.save(); ctx.strokeStyle = s.form === 'awake' ? '#ffe08a' : '#ff9a52'; ctx.globalAlpha = .35 + .4 * p; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(s.x, s.y, 40 + 8 * p, 13 + 3 * p, 0, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha *= .5; ctx.beginPath(); ctx.ellipse(s.x, s.y, 56 + 10 * p, 18 + 4 * p, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore() }
      sprite(ctx, images, heroSprite(s), s.x, s.y, C.heroPx, heroFrame(s), s.face, s.hurt > 0)
      if (s.form === 'awake') {
        // 각성: 몸이 금빛으로 맥박친다 (같은 그림을 빛으로 한 번 더) + 앞쪽 불티
        const op = ctx.globalCompositeOperation; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .16 + .12 * Math.sin(s.t * 7)
        sprite(ctx, images, heroSprite(s), s.x, s.y, C.heroPx, heroFrame(s), s.face); ctx.globalCompositeOperation = op; ctx.globalAlpha = 1
        drawAura(ctx, s, true)
      }
      drawWard(ctx, s)
    }
  }
  for (const b of s.shots) {
    const p = projectileAnchor(b)
    if (b.kind === 'gale') axe(ctx, images, p.x, p.y, b.angle, 30)
    else if (b.kind === 'ember') {
      stamp(ctx, images, 'raid/talisman.png', p.x, p.y, 38, Math.atan2(b.vy,b.vx) + Math.PI / 4)
    } else if (b.kind === 'enemy' || b.kind === 'arrow') {
      stamp(ctx, images, 'raid/arrow.png', p.x, p.y, b.kind === 'arrow' ? 42 : 48, Math.atan2(b.vy,b.vx))
    } else if (b.kind === 'javelin') {
      // 투창 전용 그림(H27)이 오기 전에는 화살 그림을 길게
      stamp(ctx, images, images.has('raid/javelin.png') ? 'raid/javelin.png' : 'raid/arrow.png', p.x, p.y, 76, Math.atan2(b.vy,b.vx))
    } else if (b.kind === 'hurl') {
      // 맥족 사냥꾼의 창 — 투창 그림 그대로
      stamp(ctx, images, 'raid/javelin.png', p.x, p.y, 68, Math.atan2(b.vy, b.vx))
    } else if (b.kind === 'stone' || b.kind === 'flame') {
      // 돌팔매·불바닥은 위에서 땅 표식과 함께 따로 그린다
    } else if (b.kind === 'pebble') {
      // 돌팔매: 손 높이에서 떠나 포물선을 그리고 땅에 떨어진다 · 땅에는 작아지는 그림자
      const u = 1 - Math.max(0, b.life) / C.slingFlight
      ctx.save(); ctx.globalAlpha = .35; ctx.fillStyle = '#0a0806'; ctx.beginPath(); ctx.ellipse(b.x, b.y, 7 + 4 * u, 3 + 2 * u, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore()
      stamp(ctx, images, ROCK, b.x, b.y - C.heroShotHeight * (1 - u) - Math.sin(u * Math.PI) * C.slingArc, 17, u * 9)
    } else if (b.kind === 'skip') {
      // 물수제비: 튈 때마다 통통 뛰는 작은 돌
      const hop = Math.abs(Math.sin((C.skipLife - b.life) * 9))
      stamp(ctx, images, ROCK, p.x, p.y + C.heroShotHeight * .6 - hop * 22, 16, b.life * 14)
    } else if (b.kind === 'boulder') {
      // 굴러가는 바위: 땅을 굴러간다 (굴러간 거리만큼 돈다)
      const r = b.radius, roll = (C.boulderLife - b.life) * C.boulderSpeed / r * Math.sign(b.vx || 1)
      ctx.save(); ctx.globalAlpha = .4; ctx.fillStyle = '#0a0806'; ctx.beginPath(); ctx.ellipse(b.x, b.y + 2, r * .9, r * .3, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore()
      stamp(ctx, images, ROCK, b.x, b.y - r * .75, r * 1.9, roll)
    } else if (b.kind === 'knife') {
      stamp(ctx, images, 'raid/knife.png', p.x, p.y, 40, Math.atan2(b.vy, b.vx))
    } else if (b.kind === 'soul') {
      stamp(ctx, images, 'raid/soul.png', p.x, p.y, 44, Math.atan2(b.vy, b.vx))
    } else if (b.kind === 'wave') {
      stamp(ctx, images, images.has('raid/sword-wave.png') ? 'raid/sword-wave.png' : 'raid/wind-blade.png', p.x, p.y, b.gen ? 40 : 58, Math.atan2(b.vy,b.vx))
    } else if (b.kind === 'barrage') {
      // 산적 일제 사격: 붉은 경고 판 + 줄어드는 고리, 끝날 때 화살이 내리꽂힌다 (두목 내려찍기와 같은 말)
      const k = Math.max(0, b.life) / C.barrageDelay, r = C.barrageRadius
      if (!decal(ctx, images, 'mark-slam', b.x, b.y, r * 2, r * 2, .5 + .5 * (1 - k)) || !decal(ctx, images, 'mark-ring', b.x, b.y, r * 2 * (1 - k), r * 2 * (1 - k))) {
        ctx.save(); ctx.strokeStyle = '#ff8a5c'; ctx.lineWidth = 3; ctx.globalAlpha = .9; ctx.beginPath(); ctx.ellipse(b.x, b.y, r, r, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore()
      }
      for (let i = 0; i < 5; i++) stamp(ctx, images, 'raid/arrow.png', b.x + Math.cos(i * 2.4) * r * .5, b.y + Math.sin(i * 2.4) * r * .35 - 14 - k * 260 - i * 16, 38, Math.PI / 2)
    } else if (b.kind === 'rain') {
      // 화살비: 떨어질 자리를 옅은 고리로 미리 보이고, 남은 시간만큼 위에서 화살 셋이 내려온다 (판정은 땅 좌표 그대로)
      const k = Math.max(0, b.life) / C.rainDelay
      decal(ctx, images, 'mark-ring', b.x, b.y, C.rainRadius * 2 * areaScale(s), C.rainRadius * 2 * areaScale(s), .35 * (1 - k) + .15)
      for (let i = 0; i < 3; i++) stamp(ctx, images, 'raid/arrow.png', b.x + (i - 1) * 18, b.y - 20 - k * 150 - i * 12, 40, Math.PI / 2)
    } else stamp(ctx, images, 'raid/wind-blade.png', p.x, p.y, 27, Math.atan2(b.vy,b.vx))
  }
  if (s.combos.includes('soulstorm')) for (let i = 0, n = C.stormOrbs + s.ranks.echo; i < n; i++) {
    const a = s.t * 3.2 + i * Math.PI * 2 / n
    stamp(ctx, images, 'raid/soul.png', s.x + Math.cos(a) * C.stormRadius * areaScale(s), s.y - 18 + Math.sin(a) * C.stormRadius * areaScale(s), 42, a + Math.PI / 2)
  }
  if (s.combos.includes('cyclone')) for (let i = 0; i < 3; i++) {
    const a = s.t * 2.8 + i * Math.PI * 2 / 3
    axe(ctx, images, s.x + Math.cos(a) * C.orbitRadius * areaScale(s), s.y - 18 + Math.sin(a) * C.orbitRadius * areaScale(s), a + s.t * 4, 48)
  }
  // 맞은 불꽃(hit)은 새것 drawHits 개만 — 화살이 무리를 꿰면 한 프레임에 수백 개가 쌓여 폰이 버벅였다 (11-17 형 「이쯤 오면 렉」)
  let hitSkip = -C.drawHits, deathSkip = -C.drawDeaths; for (const f of s.fx) if (f.kind === 'hit') hitSkip++; else if (f.kind === 'death') deathSkip++
  for (const f of s.fx) {
    if (f.kind === 'hit' ? hitSkip-- > 0 : f.kind === 'death' && deathSkip-- > 0) continue   // 쓰러지는 몸도 새것 drawDeaths 개만
    const age = 1 - f.life / f.total; ctx.save(); ctx.globalAlpha = Math.min(1, f.life / f.total * 1.5); ctx.strokeStyle = f.color; ctx.fillStyle = f.color; ctx.lineWidth = 3
    if (f.kind === 'bolt') {
      const img=images.get('raid/lightning-strip.png'),dx=f.x2-f.x,dy=f.y2-f.y
      ctx.translate(f.x,f.y-20);ctx.rotate(Math.atan2(dy,dx))
      if(img) ctx.drawImage(img,impactFrame(age)*256,0,256,128,0,-14,Math.hypot(dx,dy),28)
    } else if (f.kind === 'slash') {
      effectStrip(ctx,images,'slash',f.x,f.y-C.heroShotHeight,f.r,age,f.angle)
    } else if (f.kind === 'thrust') {
      // 창 찌르기: 베기 띠를 찌른 방향으로 길고 납작하게 (길이 = 찌른 거리)
      ctx.translate(f.x, f.y - C.heroShotHeight); ctx.rotate(f.angle); ctx.scale(1, .32)
      effectStrip(ctx, images, 'slash', f.r / 2, 0, f.r / 2, age)
    } else if (f.kind === 'thud') {
      // 돌팔매가 떨어진 자리: 흙먼지 고리 + 작은 터짐 (맞는 둘레 그대로)
      ctx.globalAlpha *= 1 - age; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * (.5 + .5 * age), f.r * .55 * (.5 + .5 * age), 0, 0, Math.PI * 2); ctx.stroke()
      impact(ctx, images, f.x, f.y - 6, f.r * .8, age)
    } else if (f.kind === 'spike') {
      impact(ctx, images, f.x, f.y - 8, f.r, age)
    } else if (f.kind === 'skill' || f.kind === 'ult') {
      if (f.ult) drawUlt(ctx, images, s, f, age); else impact(ctx, images, f.x, f.y - 12, f.r, age)
      if (f.tru && f.kind === 'ult') { ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#ffd66a'; ctx.lineWidth = 3; ctx.globalAlpha = Math.max(0, 1 - age); const r = 14 + 46 * age; ctx.beginPath(); ctx.ellipse(f.x, f.y, r, r * .5, 0, 0, Math.PI * 2); ctx.stroke() }
    } else if (f.kind === 'ring') {
      // 방울 파동 · 만신 굿: 고리가 맞는 범위까지 퍼지며 옅어진다
      const img = images.get('raid/bell-ring.png'), r = f.r * (.35 + .65 * age)
      if (img) { ctx.globalAlpha *= 1 - age * .6; ctx.drawImage(img, f.x - r, f.y - r * .6, r * 2, r * 1.2) }
    } else if (f.kind === 'buff') {
      ctx.strokeStyle = '#ff5a4a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * age, f.r * age * .55, 0, 0, Math.PI * 2); ctx.stroke()
    } else if (f.kind === 'blast') {
      effectStrip(ctx,images,'fire',f.x,f.y,f.r*1.3,age)
    } else if (f.kind === 'death') {
      if (f.mob) {
        ctx.save(); ctx.translate(f.x, f.y + 20); ctx.rotate((f.face ?? 1) * Math.min(1,age * 2) * .65)
        ctx.globalAlpha *= Math.max(0, 1 - age * 1.3)
        sprite(ctx, images, warlord(f.mob, s.stage), 0, 0, mobHeight(f.mob), 18, f.face ?? 1)
        ctx.restore()
      }
      effectStrip(ctx,images,'death',f.x,f.y+12,f.r*1.6,age)
    } else stamp(ctx, images, 'raid/hit.png', f.x, f.y, 30 * (1 - age * .5))
    ctx.restore()
  }
  // 피해 숫자 — 알갱이로 튀어 나간다 (trackNumbers · drawNumbers)
  trackNumbers(s); ctx.save(); drawNumbers(ctx, images, s); ctx.restore()
  if (s.hurt > 0) { ctx.strokeStyle = '#ff735a99'; ctx.lineWidth = 12; ctx.strokeRect(0, 0, W, H) }
  const boss = s.enemies.find(e => e.kind === 'boss')
  if (boss) {
    // Upper-right lane beneath the clock, clear of the DOM health/loadout HUD.
    const bx=W-440, by=128, name=s.mode==='vanguard'?`제${s.captains} 전위대장 · ${s.breaches}/3 돌파`:ST[s.stage].bossName
    const bar=images.get('raid/ui/bar-boss.png'), plate=images.get('raid/ui/plaque.png')
    if (bar && plate) {
      // H21 두목 게이지: 통째로 같은 배율(늘이지 않음) · 투명하게 뚫린 홈(BOSS_WIN) 밑에 채움을 먼저 칠한다 · 이름은 아래 이름판에
      const k=420/bar.width, [wx0,wy0,wx1,wy1]=BOSS_WIN, top=by-wy0*k
      ctx.fillStyle='#071519';ctx.fillRect(bx+wx0*k,by,(wx1-wx0)*k,(wy1-wy0)*k)
      ctx.fillStyle='#a9413b';ctx.fillRect(bx+wx0*k,by,(wx1-wx0)*k*boss.hp/boss.max,(wy1-wy0)*k)
      ctx.drawImage(bar,bx,top,420,bar.height*k)
      const pw=200, ph=pw*plate.height/plate.width, py=by+(wy1-wy0)*k+8
      ctx.drawImage(plate,bx+210-pw/2,py,pw,ph)
      ctx.fillStyle='#fff5dc';ctx.font='bold 15px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(name,bx+210,py+ph/2);ctx.textBaseline='alphabetic'
    } else {
      ctx.fillStyle='#071519dd';ctx.fillRect(bx,by,420,28)
      ctx.fillStyle='#a9413b';ctx.fillRect(bx+2,by+2,416*boss.hp/boss.max,24)
      ctx.fillStyle='#fff5dc';ctx.font='bold 16px system-ui';ctx.textAlign='center'
      ctx.fillText(name,bx+210,by+21)
    }
  }
}
