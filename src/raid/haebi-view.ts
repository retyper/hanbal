import { criticalFinishFrames, criticalFinishHandled, drawCriticalFinishFrames } from './critical-finish.ts'
import {drawImugiParent,drawImugiThreats,drawImugiWater} from './imugi-view.ts'
import { drawTiger, drawTigerFall, drawTigerGround, drawTigerThreats } from './tiger-view.ts'
import { drawBulgasari, drawBulgasariFall, drawBulgasariGround, drawBulgasariThreats } from './bulgasari-view.ts'
import { drawGumiho, drawGumihoFall, drawGumihoGround, drawGumihoThreats } from './gumiho-view.ts'
import { fieldTransform, heroCacheHeight, wantsHeroHd } from './surface.ts'
import { HERO_HD, HERO_HD_SHEETS } from './hero-hd.ts'
import { championLaneContains, championPose, championFacing, championRecovery, drawChampionTells, drawChampionOverlays, drawGroundChests } from './champion-view.ts'
import { HAEBI_RUN as C, HAEBI_MOBS as M, HAEBI_CHAMPION as B, HAEBI_STAGES as ST, HAEBI_ULT as U, HAEBI_FX as K, HAEBI_PALISADE as WL } from '../tune/params.ts'
import { genArtOf } from '../realm/data/art.ts'
import { areaScale, awakenedLook, barrageArcher, charge, missileLife, slamRadius, slamWindup, type HaebiRun, type Kit, type Missile, type Mob, type StageId } from './haebi.ts'
import { fieldView } from './camera.ts'
import { WALK_CYCLE } from './walk-cycle.ts'
import { attackFrame, attackRole, heroPose, idleFrame, type HeroPose } from './hero-motion.ts'
import { HAEBI_ANIM as ANIM } from '../tune/params.ts'
import { AURA_ART, drawAura, drawAuraBurst, drawAuraGround, type AuraArt, type AuraAt, type AuraKind } from './fx-aura.ts'
import { HAEBI_IMPACT as FEEL, HAEBI_END as END } from '../tune/params.ts'
import type { RaidFeel } from './impact.ts'
import type { RaidEnding } from './ending.ts'
import { FX_PATHS, drawFx } from './fx-art.ts'
import { drawImpactParticles } from './fx-particles.ts'
import { HAEBI_FX_ART as FX_ART } from '../tune/params.ts'
import { CARD_FRAME_PATHS } from './card-skins.ts'
import { awakeCastDim, drawAwakeCastDim, drawAwakeUlt } from './awake-ult-view.ts'

/** 돌팔매 묶음의 돌 · 바위 (전용 그림 H56~H58 이 오기 전엔 본편 바위 그림을 빌린다) */
const ROCK = 'fx/rock.png'
/** 창돌격꾼은 길 대신 마지막 순간 몸만 움찔·번쩍인다. 판 상태는 쓰지 않는다. */
export const chargeRecoil = (e: Mob) => e.kind === 'runner' && e.act > 0 && e.act <= FEEL.mobFlash ? 1 - e.act / FEEL.mobFlash : 0
export const chargeLane = (e: Mob) => e.act > 0 && (e.kind === 'tiger' || e.kind === 'hunter')
/** bandit-<종류> 가 아닌 적 그림 (11-16 H50~H53 · tools/sprite-kit/bake-raid-enemies.py) */
const MOB_ART: Record<string, string> = { tiger: 'beast-tiger', bear: 'beast-bear', hunter: 'snow-hunter', torch: 'torch-raider' }
/** 51-2 스테이지마다 새 적 그림 (HAEBI_STAGES.<스테이지>.art · 판 셈은 그대로 · 그리기만) */
type StageArt = { readonly file: string; readonly scale: number }
const stageArt = (mob: string, stage: StageId): StageArt | undefined => (ST[stage].art as Partial<Record<string, StageArt>>)[mob]
const STAGE_ART_PATHS = [...new Set(Object.values(ST).flatMap(st => Object.values(st.art as Partial<Record<string, StageArt>>).map(a => `anim-px/${a!.file}.png`)))]
export const imagePaths = [...CARD_FRAME_PATHS, genArtOf('haebi').file, genArtOf('aw1-haebi').file, 'anim-px/bandit-club.png', 'anim-px/bandit-archer.png',
  ...['runner', 'slinger', 'shield', 'dog', 'berserker', 'firearcher', 'iron', 'shaman'].map(k => `anim-px/bandit-${k}.png`), ...['ford.webp', 'palisade.webp', 'palisade-wall.png', 'palisade-broken.png', 'palisade-gate.png', 'palisade-gate-open.png', 'palisade-gate-broken.png', 'chest.png', 'digits.png', 'knife.png', 'soul.png', 'bell-ring.png', 'javelin.png','sword-wave.png','forest.webp','axe.png','impact-strip.png','slash-strip.png','death-strip.png','fire-strip.png','lightning-strip.png','talisman.png','wind-blade.png','arrow.png','hit.png','essence.png','essence-large.png',...['mark-slam','mark-move','mark-hero','mark-target','mark-arrow','bar-boss','plaque'].map(p=>`ui/${p}.png`)].map(p=>'raid/'+p), 'anim-px/bandit-warlord.png', ROCK, AURA_ART.flame, AURA_ART.ember,
  // 11-16 H45~H53: 스테이지 두목 둘 · 설원·산성 적 넷 · 넷째·다섯째 바닥
  // 11-22 53-B 스테이지 정예 다섯 (Codex 67 · tools/sprite-kit/bake-elite-strips.py)
  ...['boss-ford', 'boss-palisade', 'boss-snow', 'boss-fortress', ...Object.values(MOB_ART), 'elite-forest', 'elite-ford', 'elite-palisade', 'elite-snow', 'elite-fortress'].map(n => `anim-px/${n}.png`), 'raid/snow.webp', 'raid/fortress.webp', ...FX_PATHS,
  // 11-22 51-2 스테이지마다 새 적 (Codex 67 · tools/sprite-kit/bake-stage-enemies.py)
  ...STAGE_ART_PATHS]
/** bar-boss.png 의 투명한 홈 [x0,y0,x1,y1] — tools/raid-ui-kit.py 가 public/realm/raid/ui/kit.json 에 적는 값 */
const BOSS_WIN = [104, 35, 626, 82] as const
/**
 * 구운 그림 띠 (11-18 형 플립7 「늑대 떼부터 초당 3프레임」) — 20칸 띠를 그리는 키(height) 그대로 한 번 줄여 캔버스에 굽는다.
 * 늑대 띠는 6400×128 인데 46px 로 판마다 90번 줄여 찍혔다 · 폰 GPU 텍스처 한도(4096)를 넘는 띠는 그릴 때마다 조각내 올릴 수 있다.
 * 구운 띠는 폭이 C.spriteBakeMax 를 넘지 않게 여러 줄로 접는다. 헤드리스 시험(node)에는 document 가 없어 그대로 그린다.
 */
type Baked = { c: CanvasImageSource; fw: number; fh: number; cols: number }
const bakedStrips = new Map<HTMLImageElement, Map<number, Baked | null>>()
function bakedStrip(img: HTMLImageElement, height: number, warmWhite = false, layout?: { cell: readonly [number, number]; cols: number }): Baked | null {
  // 찾기 먼저 (판마다 200번 불린다 — 그림의 width·height 읽기도 값이 든다)
  const fh = Math.max(1, Math.round(height)), per = bakedStrips.get(img), had = per?.get(fh)
  if (had !== undefined) return had
  if (typeof document === 'undefined' || !img.width || !img.height || !img.complete) return null
  if (!per) { bakedStrips.set(img, new Map()); return bakedStrip(img, height, warmWhite, layout) }
  const nativeH = layout?.cell[1] ?? img.height, sourceCols = layout?.cols ?? 20
  const sw = layout?.cell[0] ?? img.width / 20, fw = Math.max(1, Math.round(sw * fh / nativeH))
  if (fh >= nativeH && img.width <= C.spriteBakeMax) { per.set(fh, null); return null }   // 키우는 그림(초상 판 등)은 굽지 않는다
  const cols = Math.max(1, Math.min(20, Math.floor(C.spriteBakeMax / fw))), rows = Math.ceil(20 / cols)
  const c = document.createElement('canvas'); c.width = cols * fw; c.height = rows * fh
  const g = c.getContext('2d')!; g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'
  for (let i = 0; i < 20; i++) g.drawImage(img, (i % sourceCols) * sw, Math.floor(i / sourceCols) * nativeH, sw, nativeH, (i % cols) * fw, Math.floor(i / cols) * fh, fw, fh)
  const b: Baked = { c, fw, fh, cols }; per.set(fh, b)
  if (warmWhite) whiteStrip(c, c.width, c.height)
  while (per.size > 3) { const key = per.keys().next().value!; const old = per.get(key); if (old && 'close' in old.c) (old.c as ImageBitmap).close(); per.delete(key) }
  // 굳힌 그림(ImageBitmap)으로 바꿔 쥔다 — 캔버스를 원본으로 찍으면 찍을 때마다 사본을 뜰 수 있다
  if (typeof createImageBitmap === 'function') void createImageBitmap(c).then(bm => { if (per.get(fh) !== b) { bm.close(); return }; if (warmWhite) whiteStrip(bm, c.width, c.height); b.c = bm }, () => {})
  return b
}
const whiteStrips = new WeakMap<object, HTMLCanvasElement>()
function whiteStrip(src: CanvasImageSource, width: number, height: number) {
  let white = whiteStrips.get(src)
  if (!white && typeof document !== 'undefined') {
    white = document.createElement('canvas'); white.width = width; white.height = height
    const g = white.getContext('2d')!; g.drawImage(src, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#fff'; g.fillRect(0, 0, width, height)
    whiteStrips.set(src, white)
  }
  return white
}
export function sprite(ctx: CanvasRenderingContext2D, images: Map<string, HTMLImageElement>, path: string, x: number, y: number, height: number, frame: number, face = 1, flash: boolean | 'white' = false, density?: number) {
  const img = images.get(path); if (!img) return
  const layout = HERO_HD_SHEETS[path], nativeH = layout?.cell[1] ?? img.height
  const b = bakedStrip(img, density === undefined ? height : heroCacheHeight(height, density, nativeH), density !== undefined, layout)
  let src: CanvasImageSource = img, sx: number, sy = 0, sw: number, sh: number, dw: number, dh: number
  if (b) { src = b.c; sx = (frame % b.cols) * b.fw; sy = Math.floor(frame / b.cols) * b.fh; sw = b.fw; sh = b.fh; dh = density === undefined ? b.fh : height; dw = density === undefined ? b.fw : b.fw * height / b.fh }
  else { sw = layout?.cell[0] ?? img.width / 20; sh = nativeH; sx = (frame % (layout?.cols ?? 20)) * sw; sy = Math.floor(frame / (layout?.cols ?? 20)) * sh; dh = height; dw = height * sw / sh }
  if (density !== undefined) dw = Math.round(height * (layout?.cell[0] ?? img.width / 20) / nativeH)
  // 폰 프레임 (11-17): save/restore 대신 옮긴 만큼 되돌린다 — 적 230 명마다 save 가 판 그리기의 8% 를 먹었다
  const tx = Math.round(x), ty = Math.round(y), dx = -Math.round(dw / 2)
  const smooth = ctx.imageSmoothingEnabled
  ctx.translate(tx, ty); if (face !== 1) ctx.scale(face, 1); ctx.imageSmoothingEnabled = false
  ctx.drawImage(src, sx, sy, sw, sh, dx, -dh, dw, dh)
  if (flash === 'white') {
    const white = whiteStrip(src, b ? b.cols * b.fw : img.width, b ? Math.ceil(20 / b.cols) * b.fh : img.height)
    if (white) ctx.drawImage(white, sx, sy, sw, sh, dx, -dh, dw, dh)
  }
  // 맞은 번쩍: 같은 그림을 한 번 더 빛으로 더한다 — ctx.filter 는 폰에서 그림마다 소프트웨어로 돌아 프레임을 크게 깎았다 (11-16 플립7 20프레임)
  if (flash === true) { const op = ctx.globalCompositeOperation, a = ctx.globalAlpha; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * C.flashAdd; ctx.drawImage(src, sx, sy, sw, sh, dx, -dh, dw, dh); ctx.globalCompositeOperation = op; ctx.globalAlpha = a }
  if (face !== 1) ctx.scale(face, 1); ctx.translate(-tx, -ty); ctx.imageSmoothingEnabled = smooth
}
/**
 * 회피 잔상 — 화면 쪽에서만 들고 있는 그림 기록(판 상태는 읽기만). 지나온 자리마다 장수 실루엣을 남겨
 * 청록·자홍으로 살짝 갈라 빛으로 겹쳐 그리고 곧 사라진다.
 */
type Ghost = { x: number; y: number; frame: number; face: number; t: number; path: string }
const ghosts: Ghost[] = []
let ghostAt = -1, tint: HTMLCanvasElement | null = null
function trackGhosts(s: HaebiRun, path: string, frame: number) {
  if (ghosts.length && s.t < ghosts[ghosts.length - 1]!.t) { ghosts.length = 0; ghostAt = -1 }   // 새 판
  if (s.dash > 0 && s.t - ghostAt >= C.ghostEvery) { ghosts.push({ x: s.x, y: s.y, frame, face: s.face, t: s.t, path }); ghostAt = s.t }
  while (ghosts.length && s.t - ghosts[0]!.t > C.ghostLife) ghosts.shift()
}
function drawGhosts(ctx: CanvasRenderingContext2D, images: Map<string, HTMLImageElement>, s: HaebiRun, height: number) {
  if (!ghosts.length) return
  const img = images.get(ghosts[0]!.path); if (!img) return
  const layout = HERO_HD_SHEETS[ghosts[0]!.path], fw = layout?.cell[0] ?? img.width / 20, fh = layout?.cell[1] ?? img.height
  tint ??= document.createElement('canvas')
  if (tint.width !== fw || tint.height !== fh) { tint.width = fw; tint.height = fh }
  const t = tint.getContext('2d')!; t.imageSmoothingEnabled = false
  const w = height * fw / fh
  ctx.save(); ctx.imageSmoothingEnabled = false   // 밝은 땅에서 하얗게 날지 않게 덧칠(lighter 아님)
  for (const g of ghosts) {
    const k = 1 - (s.t - g.t) / C.ghostLife; if (k <= 0) continue
    for (const [color, dx, a] of [['#ff2bd6', C.ghostSplit, .55], ['#18e8ff', -C.ghostSplit * .5, 1]] as const) {
      t.globalCompositeOperation = 'copy'; t.drawImage(img, (g.frame % (layout?.cols ?? 20)) * fw, Math.floor(g.frame / (layout?.cols ?? 20)) * fh, fw, fh, 0, 0, fw, fh)
      t.globalCompositeOperation = 'source-in'; t.fillStyle = color; t.fillRect(0, 0, fw, fh)
      ctx.globalAlpha = C.ghostAlpha * a * k * k
      ctx.save(); ctx.translate(Math.round(g.x + dx * (2 - k)), Math.round(g.y)); ctx.scale(g.face, 1)
      ctx.drawImage(tint, -w / 2, -height, w, height); ctx.restore()
    }
  }
  ctx.restore()
}
/** 열전에 선 장수의 전투 그림 — 기본은 해비 · 각성 그림이 없으면 조합을 완성해도 기본 그림 그대로 (raid-main 이 장수마다 정함) */
const heroArt = { base: genArtOf('haebi').file, awake: genArtOf('aw1-haebi').file, body: genArtOf('haebi').body, grow: genArtOf('haebi').body / genArtOf('aw1-haebi').body }
export function setHeroArt(baseKey: string, awakeKey?: string) { const b = genArtOf(baseKey), a = awakeKey ? genArtOf(awakeKey) : b; heroArt.base = b.file; heroArt.awake = a.file; heroArt.body = b.body; heroArt.grow = b.body / a.body }
/**
 * 장수 그림 키 — 각성 그림은 큰 관·깃털 때문에 칸 안에 몸이 작게 그려진 판이 있다(칸 160 에 다 못 담음 · tools/sprite-kit/aw1-intake.py).
 * 그만큼 키워 몸 키(정수리~발)를 보통 모습과 같게 한다 — 본편 전장이 genArtOf().body 로 맞추는 것과 같은 법. 몸 비가 같으면 그대로다
 */
const heroH = (s: HaebiRun) => awakenedLook(s) ? C.heroPx * heroArt.grow : C.heroPx
export const heroArtFiles = () => [...new Set([heroArt.base, heroArt.awake])]
/** 판 안 각성(디지몬식) 동안만 각성 그림 — 조합을 열어도 모습은 그대로 (RAID-LINK §1) */
const heroSprite = (s: HaebiRun, images?: Map<string, HTMLImageElement>, density = 1) => {
  const normal = awakenedLook(s) ? heroArt.awake : heroArt.base, hd = HERO_HD[normal]
  return hd && wantsHeroHd(density) && images?.has(hd) ? hd : normal
}
export function heroHdFiles(density: number): string[] { return wantsHeroHd(density) ? [...new Set([heroArt.base, heroArt.awake].flatMap(p => HERO_HD[p] ? [HERO_HD[p]!] : []))] : [] }
/** Decode happens in the loader; masks are painted without pixel readback before first HIT. */
export function warmHeroSprites(images: Map<string, HTMLImageElement>, density: number) {
  for (const [path, height] of [[heroArt.base, C.heroPx], [heroArt.awake, C.heroPx * heroArt.grow]] as const) {
    const hd = HERO_HD[path], use = hd && wantsHeroHd(density) && images.has(hd) ? hd : path, img = images.get(use)
    if (!img) continue
    const layout = HERO_HD_SHEETS[use]
    const b = bakedStrip(img, heroCacheHeight(height, density, layout?.cell[1] ?? img.height), true, layout)
    if (!b) whiteStrip(img, img.width, img.height)
  }
}
/** 몸놀림(hero-motion.ts) 재료 — 걷기 칸은 실제로 움직인 거리 ÷ 한 바퀴 보폭(몸 키 비례)으로 넘긴다 · 띠마다 걷기 칸 수 */
const poseOptions = (s: HaebiRun) => ({ stride: C.walkStride * C.heroPx * heroArt.body, cells: WALK_CYCLE[heroSprite(s)] ?? 8 })
/** 움직임 줄이기(기기 설정)면 몸 변형(런지·늘임·출렁·기울기·잔상)을 끈다 — 칸 박자는 그대로 */
const calmMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
/** 장수 칸 — 초상(portrait)은 판 상태만으로(걷지 않음 · 기억 없음) · 판 위는 heroPose 와 같다 */
export function heroFrame(s: HaebiRun, portrait = false, menuTime = 0) {
  if (!portrait) return heroPose(s, poseOptions(s)).frame
  if (s.hurt > 0) return ANIM.hurtCell
  if (s.cast?.kind === 'ult') return ANIM.castCell   // 비기 시전: 기를 모으는 자세
  if (s.attack > 0) return attackFrame(attackRole(s.kit), ANIM.window - s.attack) ?? idleFrame(menuTime || s.t)
  return idleFrame(menuTime || s.t)
}
/**
 * 장수 몸 (62-A) — 몸놀림의 변형(런지 dx · 가로/세로 늘임 · 기울기)을 발 자리에 한 번 걸고 잔상 → 몸 → 각성 빛을 같은 변형으로 그린다.
 * 판 좌표·발밑 표식·그림자는 그대로 s.x/s.y. 변형이 없으면 예전처럼 곧바로 찍는다(save/restore 없이).
 */
function drawHero(ctx: CanvasRenderingContext2D, images: Map<string, HTMLImageElement>, s: HaebiRun, path: string, density: number, pose: HeroPose) {
  const h = heroH(s), plain = pose.sx === 1 && pose.sy === 1 && !pose.lean
  const x = Math.round(s.x + pose.dx), y = Math.round(s.y), ox = plain ? x : 0, oy = plain ? y : 0
  if (!plain) { ctx.save(); ctx.translate(x, y); ctx.transform(pose.sx, 0, -pose.lean, pose.sy, 0, 0) }
  if (pose.ghosts > 0 && pose.ghostAlpha > 0) {
    const a = ctx.globalAlpha
    for (let i = pose.ghosts; i >= 1; i--) { ctx.globalAlpha = a * pose.ghostAlpha * (1 - (i - 1) / pose.ghosts); sprite(ctx, images, path, ox + pose.ghostStep * i, oy, h, pose.ghostFrame, pose.face, false, density) }
    ctx.globalAlpha = a
  }
  sprite(ctx, images, path, ox, oy, h, pose.frame, pose.face, s.hurt > 0, density)
  if (awakenedLook(s)) {
    // 각성: 몸이 금빛으로 맥박친다 (같은 그림을 빛으로 한 번 더)
    const op = ctx.globalCompositeOperation; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .16 + .12 * Math.sin(s.t * 7)
    sprite(ctx, images, path, ox, oy, h, pose.frame, pose.face, false, density); ctx.globalCompositeOperation = op; ctx.globalAlpha = 1
  }
  if (!plain) ctx.restore()
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
/** 적 그림 — 두목·정예는 스테이지마다(HAEBI_STAGES.boss · .elite) · 나머지는 스테이지 그림(.art) · 없으면 bandit-<종류> 또는 MOB_ART */
const warlord = (mob: string, stage: StageId) => 'anim-px/' + (mob === 'boss' ? ST[stage].boss : mob === 'elite' ? ST[stage].elite : stageArt(mob, stage)?.file ?? MOB_ART[mob] ?? 'bandit-' + mob) + '.png'
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
const mobHeight = (mob: string) => mob === 'boss' ? 150 : mob === 'elite' ? B.view.eliteArtHeight : mob in M ? (M as unknown as Record<string, { height: number }>)[mob]!.height : 64
/** 그림을 그리는 키 — 스테이지 그림은 칸이 커서(144) scale 만큼 키운다 · 머리 위 표식·별·막대는 mobHeight 그대로(몸 키가 옛 그림과 같다) */
const artHeight = (mob: string, stage: StageId) => mobHeight(mob) * (stageArt(mob, stage)?.scale ?? 1)
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
  const release = b.kind === 'shard' ? 0 : Math.max(0,1-(missileLife(b.kind)-b.life)/C.shotReleaseTime)
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
  const kit = f.ult!, color = (f.awakened ?? f.tru) ? TRUE_COLOR[kit] : ULT_COLOR[kit], len = Math.hypot(f.x2 - f.x, f.y2 - f.y), lead = f.kind === 'skill'
  if (drawAwakeUlt(ctx, images, f, age, kit === 'axe' ? U.axe.burst * areaScale(s) : 0, (x, y, alpha) => {
    ctx.save(); ctx.globalAlpha *= alpha; sprite(ctx, images, heroSprite(s), x, y, heroH(s), 12, Math.cos(f.angle) < 0 ? -1 : 1); ctx.restore()
  })) return true
  if ((f.awakened ?? f.tru) && lead) trueFlare(ctx, kit === 'sling' ? f.x2 : f.x, kit === 'sling' ? f.y2 : f.y, age)
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  if (kit === 'axe') {
    // 천지개벽: 땅이 앞으로 갈라져 나간다 — 바닥 빛 띠 · 지그재그 금 · 금을 따라 차례로 터지는 흙불
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
    // 파천일섬: 큰 화살 한 대가 화면 끝까지 — 지나간 자리에 빛줄기가 남아 옅어진다
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
    // 섬광참: 지나온 줄에 번개가 남고, 장수 잔상 넷 · 베기 셋
    ctx.save(); ctx.globalAlpha *= .32 * (1 - age)
    for (let i = 0; i < 4; i++) { const k = i / 4; sprite(ctx, images, heroSprite(s), f.x + (f.x2 - f.x) * k, f.y + (f.y2 - f.y) * k, heroH(s), 12, Math.cos(f.angle) < 0 ? -1 : 1) }
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
    // 환영난무: 앞 자리에서 그 적까지 보랏빛 줄 · 앞 자리에 잔상 · 적 위에 엇갈린 베기 둘
    ctx.save(); ctx.globalAlpha *= .7 * (1 - age); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(f.x2, f.y2 - 30); ctx.lineTo(f.x, f.y - 30); ctx.stroke()
    ctx.globalAlpha *= .5; sprite(ctx, images, heroSprite(s), f.x2, f.y2, heroH(s), 14, f.x2 < f.x ? 1 : -1); ctx.restore()
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
      // 천벌: 장수 둘레로 굿판 방울 소리가 크게 퍼진다
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
function drawNumbers(ctx: CanvasRenderingContext2D, images: Map<string, HTMLImageElement>, s: HaebiRun, viewTime = s.t) {
  const hit = images.get('raid/hit.png')
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'
  for (const p of nums) {
    const age = viewTime - p.t, k = age / p.life; if (k < 0 || k >= 1) continue
    const x = p.x + p.vx * age, y = p.y + p.vy * age + p.g * age * age / 2
    const popT = FEEL.numberPopTime, pa = viewTime - p.pop, peak = p.crit ? FEEL.numberCriticalPop : FEEL.numberPop, scale = pa < popT ? peak - (peak - 1) * pa / popT : 1
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
/**
 * 장수 오라 (11-18 형: 「투지 오라랑 각성 오라 이펙트도 필요」) — 영웅의 투지 = 하늘빛 가닥 · 각성 = 금빛 불기둥. 입자는 fx-aura.ts 가 낱낱이 그린다.
 * 켜진 순간(한 번 터지는 고리)은 화면 쪽 기억으로 잡는다 (판 상태는 읽기만): 투지는 켠 그때 · 각성은 시전(컷인)이 끝나 둘레를 치는 그때.
 * 각성 가닥에는 무기 묶음 빛(TRUE_COLOR · ULT_COLOR)이 섞여 장수마다 결이 다르다.
 */
const auraArt: AuraArt = {}, auraAt: AuraAt & { tints: string[] } = { x: 0, y: 0, t: 0, height: 0, tints: [], density: 1, gain: 1, art: auraArt }
const auraMem = { t: -1, form: 'normal' as HaebiRun['form'], casting: false, burst: -9 }
function heroAura(s: HaebiRun, images: Map<string, HTMLImageElement>): AuraKind | null {
  if (s.t < auraMem.t) { auraMem.form = 'normal'; auraMem.casting = false; auraMem.burst = -9 }   // 새 판
  const casting = s.cast?.kind === 'wake', form = s.form === 'grit' ? 'grit' : awakenedLook(s) ? 'awake' : 'normal'
  if (form === 'grit' ? auraMem.form !== 'grit' : form === 'awake' && !casting && (auraMem.casting || auraMem.form !== 'awake')) auraMem.burst = s.t
  auraMem.t = s.t; auraMem.form = form; auraMem.casting = casting
  if (form === 'normal') return null
  auraAt.x = s.x; auraAt.y = s.y; auraAt.t = s.t; auraAt.height = C.heroPx
  auraArt.flame = images.get(AURA_ART.flame); auraArt.ember = images.get(AURA_ART.ember); auraArt.ring = images.get(AURA_ART.ring)
  auraAt.tints[0] = TRUE_COLOR[s.kit]; auraAt.tints[1] = ULT_COLOR[s.kit]
  // 붐비는 장면(늑대 떼)에서는 입자를 덜 · 각성 시전 동안은 낮게 시작해 차오른다
  auraAt.density = s.enemies.length > K.aura.crowd ? K.aura.crowdDensity : 1
  auraAt.gain = casting && s.cast ? K.aura.castFrom + (1 - K.aura.castFrom) * (1 - Math.max(0, s.cast.t) / s.cast.total) : 1
  return form
}
// ── 누구 것인가 (11-18 형 플립: 「적 공격 이펙트랑 내 공격 이펙트가 헷갈림」) ── 붉은 것 = 적이 나를 때릴 자리 · 금빛·하늘빛 = 내 것 (빛·굵기는 HAEBI_FX)
const TAU = Math.PI * 2, GOLDEN_TURN = Math.PI * (3 - Math.sqrt(5))
/** 적이 나를 때릴 자리 하나 — k 0(막 뜸) → 1(떨어짐) · left 남은 초 · on 내가 그 안에 서 있나. 판마다 다시 쓰는 그릇 */
type Zone = { x: number; y: number; r: number; k: number; left: number; on: boolean }
const zones: Zone[] = [], flames: Missile[] = []
let zoneN = 0
function zone(s: HaebiRun, x: number, y: number, r: number, k: number, left: number) {
  const z = zones[zoneN] ??= { x: 0, y: 0, r: 0, k: 0, left: 0, on: false }; zoneN++
  z.x = x; z.y = y; z.r = r; z.k = Math.max(0, Math.min(1, k)); z.left = left; z.on = Math.hypot(s.x - x, s.y - y) < r
  return z.on
}
/** 적이 나를 때릴 자리를 모은다 (두목·정예·곰 내려찍기 · 돌·불 던지기 · 일제 사격) — 돌려주는 값: 내가 그런 자리나 불바닥 안에 서 있나 */
function collectThreats(s: HaebiRun) {
  let on = false; zoneN = 0; flames.length = 0
  for (const e of s.enemies) {
    if (e.giant) continue
    if (e.champion) {
      if (e.hp > 0 && e.champion.mode === 'tell' && e.wind > 0 && e.pattern === 'slam') on = zone(s, e.aimX, e.aimY, e.champion.radius, 1 - e.wind / B.slamWind, e.wind) || on
      else on = championLaneContains(e, s.x, s.y) || on
    } else if (e.wind > 0) on = zone(s, e.aimX, e.aimY, slamRadius(e.kind), 1 - e.wind / slamWindup(e.kind), e.wind) || on
  }
  for (const b of s.shots) {
    if (b.kind === 'stone') on = zone(s, b.x, b.y, b.radius, 1 - b.life / M.lobDelay, b.life) || on
    else if (b.kind === 'barrage') on = zone(s, b.x, b.y, C.barrageRadius, 1 - b.life / C.barrageDelay, b.life) || on
    else if (b.kind === 'flame') { flames.push(b); on = Math.hypot(s.x - b.x, s.y - b.y) < b.radius || on }
  }
  return on
}
/**
 * 겹친 원들의 겉 테만 길에 싣는다 — 원마다 둘레를 RIM_SLOTS 토막으로 나눠 다른 원 안에 든 토막은 빼고 남은 호만 긋는다.
 * 불바닥이 줄지어 겹칠 때(방화꾼이 달리며 떨어뜨린 줄) 테가 고리처럼 얽히지 않고 한 덩이의 둘레가 된다. 꼭 같은 자리의 원 둘은 하나만 남긴다.
 */
const RIM_SLOTS = 48, rimIn = new Uint8Array(RIM_SLOTS)
function unionRim(ctx: CanvasRenderingContext2D, list: readonly Missile[]) {
  const n = list.length, step = TAU / RIM_SLOTS
  for (let i = 0; i < n; i++) {
    const c = list[i]!, r = c.radius
    let whole = false, any = false
    rimIn.fill(0)
    for (let j = 0; j < n && !whole; j++) {
      if (j === i) continue
      const o = list[j]!, d = Math.hypot(o.x - c.x, o.y - c.y)
      if (d >= r + o.radius || d + o.radius <= r && d + r > o.radius) continue   // 안 닿음 · 저쪽이 이 안에 들어 있음
      if (d + r <= o.radius) { whole = d + r < o.radius || j < i; continue }     // 이 원이 통째로 저쪽 안
      const mid = Math.atan2(o.y - c.y, o.x - c.x), half = Math.acos((d * d + r * r - o.radius * o.radius) / (2 * d * r))
      for (let k = Math.ceil((mid - half) / step - .5), end = Math.floor((mid + half) / step - .5); k <= end; k++) rimIn[(k % RIM_SLOTS + RIM_SLOTS) % RIM_SLOTS] = 1
      any = true
    }
    if (whole) continue
    if (!any) { ctx.moveTo(c.x + r, c.y); ctx.arc(c.x, c.y, r, 0, TAU); continue }
    for (let k = 0; k < RIM_SLOTS; k++) {
      if (rimIn[k]) continue
      let end = k; while (end < RIM_SLOTS && !rimIn[end]) end++
      ctx.moveTo(c.x + Math.cos(k * step) * r, c.y + Math.sin(k * step) * r); ctx.arc(c.x, c.y, r, k * step, end * step); k = end
    }
  }
}
/**
 * 적이 나를 때릴 자리 — 한 가지 꼴 (맞는 범위 그대로의 원): 붉은 테(검붉은 받침) · 맥박치는 붉은 바닥에 흐르는 빗금 · 가운데로 줄어드는 고리(남은 시간) ·
 * 떨어지기 직전 한 번 번쩍. 타는 불바닥은 불 그림 둘레에 같은 붉은 바닥과 테(빗금·고리 없이 = 지금 타는 중). 꽉 찬 붉은 동그라미로는 그리지 않는다.
 * 폰 프레임: 자리가 몇이든 길 하나에 모아 한 번씩만 칠한다(바닥 · 빗금 · 테 둘 · 고리 둘) — 자리마다 따로 그리는 건 용암 테 그림과 마지막 번쩍뿐.
 */
function drawThreats(ctx: CanvasRenderingContext2D, images: Map<string, HTMLImageElement>, s: HaebiRun) {
  const F = K.foe, a = ctx.globalAlpha, beat = 1 - F.pulseDepth * (.5 + .5 * Math.sin(s.t * F.pulse))
  if (!zoneN && !flames.length) return
  if (flames.length) {
    // 타는 불바닥: 붉은 바닥(겹쳐도 한 번만 칠해진다) 위에 불 그림
    ctx.beginPath()
    for (const b of flames) { ctx.moveTo(b.x + b.radius, b.y); ctx.arc(b.x, b.y, b.radius, 0, TAU) }
    ctx.fillStyle = F.fill; ctx.globalAlpha = a * F.flameFill * beat; ctx.fill(); ctx.globalAlpha = a
    const fire = images.get('raid/fire-strip.png')
    if (fire) for (const b of flames) { const r = b.radius * 1.1; ctx.drawImage(fire, impactFrame((s.t * 1.7 + b.x * .01) % 1) * 256, 0, 256, 256, b.x - r, b.y - 10 - r, r * 2, r * 2) }
  }
  if (zoneN) {
    // 바닥: 붉은빛이 맥박친다 (겹친 자리도 한 번만 칠해져 진해지지 않는다)
    ctx.beginPath()
    for (let i = 0; i < zoneN; i++) { const z = zones[i]!; ctx.moveTo(z.x + z.r, z.y); ctx.arc(z.x, z.y, z.r, 0, TAU) }
    ctx.fillStyle = F.fill; ctx.globalAlpha = a * F.fillAlpha * beat; ctx.fill()
    // 용암 테 그림: 떨어질 때가 가까울수록 진하게
    const art = images.get('raid/ui/mark-slam.png')
    if (art) for (let i = 0; i < zoneN; i++) { const z = zones[i]!, d = z.r * F.artScale; ctx.globalAlpha = a * (F.artFrom + (F.artTo - F.artFrom) * z.k); ctx.drawImage(art, z.x - d, z.y - d, d * 2, d * 2) }
    // 빗금: 왼쪽 아래에서 오른쪽 위로 긋고 천천히 흐른다
    const slide = s.t * F.hatchSlide % F.hatchGap
    ctx.beginPath()
    for (let i = 0; i < zoneN; i++) {
      const z = zones[i]!
      for (let o = slide - z.r; o < z.r; o += F.hatchGap) { const h = Math.sqrt(z.r * z.r - o * o) * Math.SQRT1_2, cx = z.x + o * Math.SQRT1_2, cy = z.y + o * Math.SQRT1_2; ctx.moveTo(cx - h, cy + h); ctx.lineTo(cx + h, cy - h) }
    }
    ctx.strokeStyle = F.rim; ctx.lineWidth = F.hatchWidth; ctx.lineCap = 'butt'; ctx.globalAlpha = a * F.hatchAlpha; ctx.stroke()
  }
  // 테: 검붉은 받침 위에 붉은 줄 (떨어질 자리 + 불바닥)
  ctx.beginPath()
  for (let i = 0; i < zoneN; i++) { const z = zones[i]!; ctx.moveTo(z.x + z.r, z.y); ctx.arc(z.x, z.y, z.r, 0, TAU) }
  unionRim(ctx, flames)
  ctx.globalAlpha = a; ctx.strokeStyle = F.rimDark; ctx.lineWidth = F.rimDarkWidth; ctx.stroke()
  ctx.strokeStyle = F.rim; ctx.lineWidth = F.rimWidth; ctx.stroke()
  if (zoneN) {
    // 가운데로 줄어드는 고리 = 남은 시간
    ctx.beginPath()
    for (let i = 0; i < zoneN; i++) { const z = zones[i]!, r = z.r * (1 - z.k); if (r > 1) { ctx.moveTo(z.x + r, z.y); ctx.arc(z.x, z.y, r, 0, TAU) } }
    ctx.strokeStyle = F.rim; ctx.lineWidth = F.closeRim; ctx.stroke(); ctx.strokeStyle = F.hot; ctx.lineWidth = F.closeWidth; ctx.stroke()
    for (let i = 0; i < zoneN; i++) {
      const z = zones[i]!
      // 내가 그 안에 서 있다: 테가 한 겹 더 빠르게 뛴다 · 떨어지기 직전: 한 번 번쩍
      if (z.on) { ctx.globalAlpha = a * F.onAlpha * (.5 + .5 * Math.sin(s.t * F.onPulse)); ctx.strokeStyle = F.hot; ctx.lineWidth = F.onWidth; ctx.beginPath(); ctx.arc(z.x, z.y, z.r + F.rimWidth, 0, TAU); ctx.stroke() }
      if (z.left < F.flash) { ctx.globalAlpha = a * F.flashAlpha * (1 - Math.max(0, z.left) / F.flash); ctx.fillStyle = F.hot; ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, TAU); ctx.fill() }
    }
  }
  ctx.globalAlpha = a
}
/** 내 기술이 떨어질 자리 (화살비) — 가는 금빛 테와 안으로 모이는 빛 알뿐: 피할 필요가 없으니 적의 표식보다 덜 눈에 띄게 · 붉은빛은 쓰지 않는다. 길 둘로 모아 칠한다 */
function drawOwnZones(ctx: CanvasRenderingContext2D, s: HaebiRun) {
  const O = K.own, r = C.rainRadius * areaScale(s), a = ctx.globalAlpha
  let n = 0
  ctx.beginPath()
  for (const b of s.shots) if (b.kind === 'rain') { ctx.moveTo(b.x + r, b.y); ctx.arc(b.x, b.y, r, 0, TAU); n++ }
  if (!n) return
  ctx.strokeStyle = O.rim; ctx.lineWidth = O.rimWidth; ctx.globalAlpha = a * O.rimAlpha; ctx.stroke()
  ctx.beginPath()
  for (const b of s.shots) if (b.kind === 'rain') {
    const k = Math.max(0, Math.min(1, b.life / C.rainDelay))
    for (let j = 0; j < O.motes; j++) { const ang = j * GOLDEN_TURN + b.x * .05 + b.y * .03, d = r * k * (.55 + .45 * (j * .618 % 1)); ctx.rect(b.x + Math.cos(ang) * d - O.moteSize / 2, b.y + Math.sin(ang) * d - O.moteSize / 2, O.moteSize, O.moteSize) }
  }
  ctx.fillStyle = O.mote; ctx.globalAlpha = a * O.moteAlpha; ctx.fill(); ctx.globalAlpha = a
}
/** 꼬리를 다는 내 투사체 (곧게 나는 것) */
const OWN_TRAIL = new Set<Missile['kind']>(['arrow', 'javelin', 'knife', 'shard', 'gale', 'ember', 'soul', 'wave'])
/** 날아가는 것의 꼬리 — 적의 화살·창은 검붉은 받침에 붉은 줄 · 내 것은 무기 묶음 빛 한 줄. 길 하나씩에 모아 한 번에 긋는다 (투사체가 몇이든 칠하기는 셋) */
function drawTrails(ctx: CanvasRenderingContext2D, s: HaebiRun) {
  const T = K.trail, a = ctx.globalAlpha
  let n = 0
  ctx.lineCap = 'round'; ctx.beginPath()
  for (const b of s.shots) if (b.kind === 'enemy' || b.kind === 'hurl') {
    const v = Math.hypot(b.vx, b.vy) || 1, y = b.y - C.enemyShotHeight
    ctx.moveTo(b.x, y); ctx.lineTo(b.x - b.vx / v * T.foeLen, y - b.vy / v * T.foeLen); n++
  }
  if (n) { ctx.strokeStyle = K.foe.rimDark; ctx.lineWidth = T.foeWidth + 3; ctx.stroke(); ctx.strokeStyle = K.foe.rim; ctx.lineWidth = T.foeWidth; ctx.stroke() }
  n = 0; ctx.beginPath()
  for (const b of s.shots) if (OWN_TRAIL.has(b.kind)) {
    const v = Math.hypot(b.vx, b.vy) || 1, y = b.y - C.heroShotHeight
    ctx.moveTo(b.x, y); ctx.lineTo(b.x - b.vx / v * T.ownLen, y - b.vy / v * T.ownLen); n++
  }
  if (n) { ctx.strokeStyle = ULT_COLOR[s.kit]; ctx.lineWidth = T.ownWidth; ctx.globalAlpha = a * T.ownAlpha; ctx.stroke(); ctx.globalAlpha = a }
  ctx.lineCap = 'butt'
}
/**
 * 터짐(blast)이 누구 것인가 — 화면 쪽 기억 (판 상태는 읽기만): 적이 떨어뜨릴 자리(돌·불·일제 사격)를 판마다 적어 두었다가,
 * 바로 그 자리에서 난 터짐을 적의 것으로 본다. 1 = 적의 돌·화살(흙먼지) · 2 = 적의 불 · 0 = 내 것
 */
const foeSpots: { x: number; y: number; fire: boolean }[] = [], blastOf = new WeakMap<object, 0 | 1 | 2>()
let spotN = 0, spotT = -1
function trackFoeBlasts(s: HaebiRun) {
  if (s.t < spotT) spotN = 0   // 새 판
  spotT = s.t
  for (const f of s.fx) if (f.kind === 'blast' && !blastOf.has(f)) {
    let who: 0 | 1 | 2 = 0
    for (let i = 0; i < spotN; i++) { const p = foeSpots[i]!; if (p.x === f.x && p.y === f.y) { who = p.fire ? 2 : 1; break } }
    blastOf.set(f, who)
  }
  spotN = 0
  for (const b of s.shots) if (b.kind === 'stone' || b.kind === 'barrage') { const p = foeSpots[spotN] ??= { x: 0, y: 0, fire: false }; spotN++; p.x = b.x; p.y = b.y; p.fire = b.kind === 'stone' && !!b.gen }
}
/** 따뜻한 빛인가 (붉은 쪽이 푸른 쪽보다 셈) — 내 터짐 가운데 불빛(부적·뇌화)과 찬 빛(화살비·혼불)을 가른다 */
const warmth = new Map<string, boolean>()
function warm(color: string) {
  let w = warmth.get(color)
  if (w === undefined) { w = parseInt(color.slice(1, 3), 16) > parseInt(color.slice(5, 7), 16); warmth.set(color, w) }
  return w
}
/* 11-19 형: 「투지 연출에서 물방울 보호막 캔버스로 만들던 거 필요 없을 듯」 → 몸 둘레 보호막(drawWard)을 지움 · 막는 힘(s.ward)은 그대로 · 체력 막대의 하늘빛 줄(#hp-ward)이 남은 양을 보인다 */
/** 비기·각성 시전: 기운이 장수에게 모여드는 고리 (남은 시간만큼 오므라든다) · 진 비기·각성은 금빛 겹고리 */
function drawCast(ctx: CanvasRenderingContext2D, s: HaebiRun) {
  const c = s.cast; if (!c) return
  const k = Math.max(0, c.t / c.total), gold = (c.awakened ?? c.tru) || c.kind === 'wake', op = ctx.globalCompositeOperation, a = ctx.globalAlpha
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
  return k > 0 ? ((best.awakened ?? best.tru) ? 7 : 3.5) * k : 0
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
// ── 56-C 목책 (그리기만 · 판의 palisade 를 읽기만 한다) ──
const PALISADE_ART = { wall: 'raid/palisade-wall.png', broken: 'raid/palisade-broken.png', gate: 'raid/palisade-gate.png', open: 'raid/palisade-gate-open.png', smashed: 'raid/palisade-gate-broken.png' } as const
/** 목책 발밑 그늘 — 땅 차례에 길 하나로 (열린 문은 기둥뿐이라 빼고) */
function drawPalisadeShadow(ctx: CanvasRenderingContext2D, s: HaebiRun) {
  const P = s.palisade!, V = WL.view
  ctx.beginPath()
  for (const p of P.pieces) if (p.kind !== 'o') { const cx = (p.x0 + p.x1) / 2, rx = (p.x1 - p.x0) * V.shadowWidth; ctx.moveTo(cx + rx, P.y + V.foot); ctx.ellipse(cx, P.y + V.foot, rx, V.shadowHeight, 0, 0, TAU) }
  const a = ctx.globalAlpha; ctx.fillStyle = '#0b0806'; ctx.globalAlpha = a * V.shadowAlpha; ctx.fill(); ctx.globalAlpha = a
}
/** 부서진 마디에서 나무 조각이 튀고 흙먼지가 인다 (부서진 때부터 debrisLife 초 · 마디 자리로 정한 각 · 난수 없음) */
function drawPalisadeDebris(ctx: CanvasRenderingContext2D, images: Map<string, HTMLImageElement>, cx: number, y: number, width: number, age: number) {
  const V = WL.view, t = age * V.debrisLife, dust = V.debrisSize * V.dustGrow * (1 + age)
  ctx.save(); ctx.globalAlpha *= 1 - age
  for (let j = -1; j <= 1; j++) drawFx(ctx, images, 'fx_dust_puff', cx + j * width * V.dustSpread, y - V.debrisFrom / 3 - t * V.dustRise, dust, dust)
  ctx.fillStyle = '#7a5434'
  for (let j = 0; j < V.debris; j++) {
    // 위쪽 반원으로 고르게 (마디 자리로 조금씩 어긋나게) · 빠르기와 크기는 조각마다 조금씩 다르게
    const ang = -Math.PI * (j + .5) / V.debris + Math.sin(j * 2.4 + cx) * .25, v = V.debrisSpeed * (.55 + .45 * ((j * .618) % 1))
    const x = cx + Math.cos(ang) * v * t, py = y - V.debrisFrom + Math.sin(ang) * v * t * (V.debrisLift / V.debrisSpeed) + V.debrisGravity * t * t / 2, size = V.debrisSize * (.35 + .25 * (j % 3))
    ctx.save(); ctx.translate(x, py); ctx.rotate(t * V.debrisSpin + j); ctx.fillRect(-size / 2, -size / 6, size, size / 3); ctx.restore()
  }
  ctx.restore()
}
/** 부서질 때 판이 떤다 — 가장 최근에 부서진 마디의 나이로 (큰 문은 두 배) */
function palisadeQuake(s: HaebiRun) {
  let q = 0
  for (const p of s.palisade!.pieces) if (p.brokenAt !== undefined) { const k = 1 - (s.t - p.brokenAt) / WL.view.breakShakeLife; if (k > 0) q = Math.max(q, WL.view.breakShake * k * (p.kind === 'g' ? WL.view.gateShake : 1)) }
  return q
}
/**
 * 목책 마디들 — 몸들과 같은 위→아래 차례의 한 자리(발 y)에서 그린다: 뒤의 몸은 가리고 앞의 몸은 위에 선다.
 * 성한 말뚝 · 부서진 말뚝 · 큰 문(닫힘 · 부서지면 쪼개진 문짝) · 열린 문(기둥과 가로대). 맞으면 번쩍이며 흔들리고(판의 flash) · 깎인 체력 막대 ·
 * 장수가 마디 바로 뒤에 서면 그 마디를 옅게 (가려 안 보이지 않게).
 */
function drawPalisade(ctx: CanvasRenderingContext2D, images: Map<string, HTMLImageElement>, s: HaebiRun, time: number) {
  const P = s.palisade!, V = WL.view
  for (let i = 0; i < P.pieces.length; i++) {
    const p = P.pieces[i]!, width = p.x1 - p.x0, cx = (p.x0 + p.x1) / 2
    const img = images.get(PALISADE_ART[p.kind === 'w' ? p.hp > 0 ? 'wall' : 'broken' : p.kind === 'o' ? 'open' : p.hp > 0 ? 'gate' : 'smashed'])
    if (!img) continue
    const dw = p.kind === 'w' ? width * (p.hp > 0 ? V.wallDraw : V.brokenDraw) : width + V.gateOverhang * 2, dh = img.height * dw / img.width
    const k = p.flash > 0 ? p.flash / WL.flash : 0, top = P.y + V.foot - dh, left = cx - dw / 2 + (k ? Math.sin(time * V.shakeHz + i * 1.7) * V.shake * k : 0)
    const a = ctx.globalAlpha, fade = s.y < P.y && s.y > top && Math.abs(s.x - cx) < dw / 2 + V.behindPad ? V.behindAlpha : 1
    ctx.globalAlpha = a * fade; ctx.drawImage(img, left, top, dw, dh)
    // 맞은 번쩍: 같은 그림을 빛으로 한 번 더 (적이 맞을 때와 같은 결 · filter 없이)
    if (k) { const op = ctx.globalCompositeOperation; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * fade * C.flashAdd * k; ctx.drawImage(img, left, top, dw, dh); ctx.globalCompositeOperation = op }
    ctx.globalAlpha = a
    if (p.brokenAt !== undefined && s.t - p.brokenAt < V.debrisLife) drawPalisadeDebris(ctx, images, cx, P.y, width, (s.t - p.brokenAt) / V.debrisLife)
    // 깎인 체력 — 눈에 띄게(barFrom 아래로) 깎였을 때만 · 큰 문은 그 뒤로 늘 · 말뚝은 맞은 뒤 잠깐 (스친 공격의 작은 흠으로 막대가 줄줄이 뜨지 않게)
    if (p.hp > 0 && p.hp < p.max * V.barFrom && (p.kind === 'g' || p.hitAt !== undefined && s.t - p.hitAt < V.barShow)) {
      const bw = width * V.barWidth, by = top - V.barLift
      ctx.fillStyle = '#111c'; ctx.fillRect(cx - bw / 2, by, bw, V.barHeight)
      ctx.fillStyle = '#ef9873'; ctx.fillRect(cx - bw / 2, by, bw * p.hp / p.max, V.barHeight)
    }
  }
}
/** 그리는 차례 (위에서 아래로) — 판마다 다시 쓰는 배열 · false = 목책 줄 (56-C) */
const order: (HaebiRun['enemies'][number] | null | false)[] = []
/**
 * cam: 확대 카메라 (raid/camera.ts · 11-19 돋보기 단추) — 화면 가운데의 판 좌표와 배율. 판 위의 것(땅·몸·효과·피해 숫자·오라)은 판과 함께 커지고,
 * 화면에 붙은 것(맞을 때 붉은 테 · 두목 막대)은 그대로 · 없으면 1배
 */
export function drawField(ctx: CanvasRenderingContext2D, images: Map<string, HTMLImageElement>, s: HaebiRun, destination: { x: number; y: number } | null, cam?: { zoom: number; x: number; y: number }, feel?: RaidFeel, ending?: RaidEnding, criticalLow = false) {
  const W = C.width, H = C.height
  fieldTransform(ctx)   // 그림마다 옮겼다 되돌리는 셈의 작은 오차가 판마다 쌓이지 않게 (sprite·stamp 는 save/restore 없이 · 11-17)
  ctx.fillStyle = '#273c35'; ctx.fillRect(0, 0, W, H)
  const endShake = ending?.active ? END.shake * Math.max(0, 1 - ending.elapsed / END.shakeLife) : 0
  const quake = Math.max(endShake, Math.min(FEEL.shakeMax, Math.max(shakeOf(s), feel?.shake ?? 0, s.palisade ? palisadeQuake(s) : 0))), time = ending?.active ? ending.elapsed : feel?.time ?? s.t
  const qx = quake ? Math.round(Math.sin(time * FEEL.shakeXHz) * quake) : 0, qy = quake ? Math.round(Math.cos(time * FEEL.shakeYHz) * quake * FEEL.shakeYShare) : 0
  const z = cam?.zoom ?? 1, density = z * Math.max((ctx.canvas?.width ?? W) / W, (ctx.canvas?.height ?? H) / H)
  if (z !== 1 && cam) fieldTransform(ctx, z, W / 2 - cam.x * z + qx, H / 2 - cam.y * z + qy)
  else if (quake) fieldTransform(ctx, 1, qx, qy)
  const bg = images.get('raid/' + ST[s.stage].bg) ?? images.get('raid/forest.webp')
  const baked = bg && fieldBackdrop(bg, W, H)
  if (baked) ctx.drawImage(baked, 0, 0)
  else { if (bg) { const sw = bg.height * W / H; ctx.drawImage(bg, (bg.width - sw) / 2, 0, sw, bg.height, 0, 0, W, H) } ctx.fillStyle = '#11281b25'; ctx.fillRect(0, 0, W, H) }
  // ── 땅 표식 (모든 몸보다 먼저) ── 아래부터: 내 발밑 표식 · 내 오라 고리 · 내 기술이 떨어질 자리 → 적의 겨눔 줄 · 적이 나를 때릴 자리.
  //    적의 것이 늘 위에, 더 진하게 (예전엔 내 발밑 금빛 표식이 적이 던진 돌의 자리를 덮었다 · 11-18 형 플립)
  trackFoeBlasts(s)
  const aura = heroAura(s, images), danger = collectThreats(s)
  // 내 발밑 표식 — 맞을 자리 안에 서 있으면 옅게 물러난다
  if (!decal(ctx, images, 'mark-hero', s.x, s.y, 72, 32, danger ? K.own.heroMarkDim : K.own.heroMark)) { ctx.strokeStyle = '#f9d89788'; ctx.fillStyle = '#ffd97726'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(s.x, s.y, 29, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke() }
  if (aura) drawAuraGround(ctx, aura, auraAt)
  drawOwnZones(ctx, s)
  // 창돌격꾼·범 돌진 · 투창 사냥꾼 겨눔 예고: 겨눈 줄이 점점 진해진다 (투창은 가늘게)
  for (const e of s.enemies) if (chargeLane(e)) {
    const thin = e.kind === 'hunter', k = 1 - e.act / (thin ? M.hunterWind : charge(e.kind)!.wind)
    ctx.save(); ctx.globalAlpha = .25 + .55 * k; ctx.strokeStyle = K.foe.line; ctx.lineWidth = thin ? 3 + 4 * k : 6 + 10 * k; ctx.lineCap = 'round'
    ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.aimX, e.aimY); ctx.stroke(); ctx.restore()
  }
  // 두목·곰 내려찍기 · 돌·불 던지기 · 일제 사격이 떨어질 자리 · 타는 불바닥 — 모두 같은 붉은 말
  // 못 주운 기세는 마지막 1초에 옅어지며 사라진다 (dropLife)
  for (const d of s.drops) { const fade = Math.min(1, C.dropLife - d.age); if (fade < 1) ctx.globalAlpha = Math.max(0, fade); stamp(ctx, images, d.value > 2 ? 'raid/essence-large.png' : 'raid/essence.png', d.x, d.y, d.value > 2 ? 23 : 15); if (fade < 1) ctx.globalAlpha = 1 }
  drawGroundChests(ctx, images, s)
  if (destination) decal(ctx, images, 'mark-move', destination.x, destination.y, 30, 26, .85)
  // 발밑 그림자는 길 하나로 한 번에 칠한다 (적마다 fill 하던 것 · 폰 프레임 11-17) — 땅이라 모든 몸보다 먼저 그려도 된다
  ctx.fillStyle = '#07181655'; ctx.beginPath()
  for (const e of s.enemies) { if(e.giant)continue; const rx = e.kind === 'boss' || e.kind === 'elite' ? 24 : 16; ctx.moveTo(e.x + rx, e.y + 2); ctx.ellipse(e.x, e.y + 2, rx, 6, 0, 0, Math.PI * 2) }
  ctx.fill()
  // 백두 대호의 큰 그림자 · 잠행 눈 더미 (땅 표식 차례) · 이긴 막 내림 동안 쓰러지는 몸 (판에서는 이미 사라졌다)
  for (const e of s.enemies) if (e.giant?.kind === 'tiger') drawTigerGround(ctx, images, e.giant); else if (e.giant?.kind === 'bulgasari') drawBulgasariGround(ctx, e.giant); else if (e.giant?.kind === 'gumiho') drawGumihoGround(ctx, images, e.giant)
  const fallen = ending?.kind === 'victory' ? s.giantFlow?.finalOwner?.giant : undefined
  if (fallen?.kind === 'tiger') drawTigerFall(ctx, images, fallen, ending!.elapsed); else if (fallen?.kind === 'bulgasari') drawBulgasariFall(ctx, images, fallen, ending!.elapsed); else if (fallen?.kind === 'gumiho') drawGumihoFall(ctx, images, fallen, ending!.elapsed)
  if (s.palisade) drawPalisadeShadow(ctx, s)
  // 위에서 아래로 그린다 (null = 장수 · false = 목책 줄) — 판마다 새 배열을 만들지 않는다
  const wallY = s.palisade?.y ?? 0
  order.length = 0; for (const e of s.enemies) order.push(e); order.push(null); if (s.palisade) order.push(false)
  order.sort((a, b) => (a ? a.y : a === null ? s.y : wallY) - (b ? b.y : b === null ? s.y : wallY))
  const archer = s.mode === 'stage' ? barrageArcher(s, cam ? fieldView(cam) : undefined) : undefined
  for (const e of order) {
    if (e === false) { drawPalisade(ctx, images, s, time); continue }
    if (e) {
      if(e.giant){if(e.giant.kind==='tiger')drawTiger(ctx,images,e.giant,{heroX:s.x,heroY:s.y});else if(e.giant.kind==='bulgasari')drawBulgasari(ctx,images,e.giant,{heroX:s.x,heroY:s.y});else if(e.giant.kind==='gumiho')drawGumiho(ctx,images,e.giant,{heroX:s.x,heroY:s.y});else drawImugiParent(ctx,images,e.giant,{bounds:cam?fieldView(cam):{left:0,top:0,right:W,bottom:H},density});continue}
      const big = e.kind === 'boss' || e.kind === 'elite', h = mobHeight(e.kind)
      const target = s.mode === 'vanguard' && e.kind === 'boss'
      const wave = ending?.kind === 'victory' && e.kind !== 'boss' ? (ending.elapsed - ending.freeze - Math.hypot(e.x - ending.boss.x, e.y - ending.boss.y) * END.waveDelay) / END.mobFallLife : -1
      if (wave >= 1) continue
      // 무당이 북돋운 적 · 성난 광전사: 발밑 붉은 기운
      if (e.buff > 0 || e.kind === 'berserker' && e.hp < e.max / 2) { ctx.save(); ctx.globalAlpha = .45 + .25 * Math.sin(s.t * 12 + e.id); ctx.fillStyle = '#ff3b2f'; ctx.beginPath(); ctx.ellipse(e.x, e.y + 2, 22, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore() }
      if (target) decal(ctx, images, 'mark-target', e.x, e.y, 100, 45)
      const warning = chargeRecoil(e), recoil = Math.max(warning, Math.max(0, Math.min(1, e.flash / FEEL.mobFlash))), white = e.flash > FEEL.mobFlash - FEEL.whiteTime || warning > 1 - FEEL.whiteTime / FEEL.mobFlash
      const steady = !!e.champion || e.kind === 'boss' || e.kind === 'iron' || e.kind === 'bear'
      const lag = steady ? 0 : Math.sign(e.x - s.x) * C.knockback * recoil
      const jitter = recoil * FEEL.mobJitter * Math.sin(time * FEEL.mobJitterHz + e.id)
      ctx.save(); ctx.translate(e.x + jitter - lag, e.y)
      if (wave >= 0) { ctx.globalAlpha *= 1 - wave; ctx.translate(Math.sign(e.x - ending!.boss.x) * wave * FEEL.deathDistance, -Math.sin(wave * Math.PI) * FEEL.deathLift); ctx.rotate(Math.sign(e.x - ending!.boss.x) * wave * FEEL.deathSpin) }
      const recovery = championRecovery(e)
      if (recovery > 0) ctx.rotate((s.x < e.x ? -1 : 1) * B.view.recoveryLean * recovery)
      ctx.scale(1 + (FEEL.squashX - 1) * recoil, 1 + (FEEL.squashY - 1) * recoil)
      sprite(ctx, images, warlord(e.kind, s.stage), 0, 0, artHeight(e.kind, s.stage), wave >= 0 || white ? 18 : championPose(e) ?? (e.wind > 0 ? 13 : archerFrame(s, e) ?? 4 + Math.floor(s.t * 8 + e.id) % 8), championFacing(e, s.x < e.x ? -1 : 1), white ? 'white' : e.flash > 0)
      ctx.restore()
      if (e === archer) {
        // 적대 공격의 주체: 머리 위 붉은 화살촉. 원형 붉은 고리는 쓰지 않는다.
        const x = e.x, y = e.y - h - C.barrageMarkLift, w = C.barrageMarkWidth / 2, mh = C.barrageMarkHeight
        ctx.save(); ctx.fillStyle = K.foe.line; ctx.strokeStyle = '#241513'; ctx.lineWidth = 2
        ctx.beginPath(); ctx.moveTo(x - w, y - mh); ctx.lineTo(x + w, y - mh); ctx.lineTo(x, y); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore()
      }
      // 진탕격: 머리 위를 도는 별 둘
      if (e.daze > 0) for (let i = 0; i < 2; i++) { const a = s.t * 7 + i * Math.PI; stamp(ctx, images, 'raid/hit.png', e.x + Math.cos(a) * 14, e.y - h - 4 + Math.sin(a) * 4, 14, a) }
      if (target) decal(ctx, images, 'mark-arrow', e.x, e.y - h - 26 + Math.sin(s.t * 4) * 4, 22, 39)
      if (big && !(e.champion && e.kind === 'elite')) { ctx.fillStyle = '#111c'; ctx.fillRect(e.x - 28, e.y - h, 56, 5); ctx.fillStyle = '#ef9873'; ctx.fillRect(e.x - 28, e.y - h, 56 * e.hp / e.max, 5) }
    } else {
      if (ending?.kind === 'victory' && ending.elapsed > ending.freeze) {
        ctx.save(); ctx.globalAlpha = FX_ART.rayAlpha * Math.min(1, (ending.elapsed - ending.freeze) / END.cameraTime)
        drawFx(ctx, images, 'fx_victory_rays', s.x, s.y - heroH(s) * FX_ART.heroRayLift, heroH(s) * FX_ART.heroRayWidth, heroH(s) * FX_ART.heroRayHeight)
        ctx.restore()
      }
      // 몸놀림은 한 프레임에 한 번만 묻는다 (회피 잔상·몸·각성 빛이 같은 칸) — 맞은 순간 멈춤 · 움직임 줄이기 · 판 끝 연출 · 저사양을 함께 넘긴다
      const heroPath = heroSprite(s, images, density), pose = heroPose(s, { ...poseOptions(s), stopped: feel?.stopped ?? false, still: calmMotion || !!ending?.active, low: criticalLow })
      trackGhosts(s, heroPath, pose.frame); drawGhosts(ctx, images, s, heroH(s))
      // 오라: 뒤 겹(몸 뒤 빛 · 뒤 가닥) → 몸 → 앞 겹(앞 가닥 · 불티) · 발밑 고리와 표식은 땅 표식 차례에 이미 그렸다
      if (aura) drawAura(ctx, aura, false, auraAt)
      drawCast(ctx, s)
      drawHero(ctx, images, s, heroPath, density, pose)
      if (aura) { drawAura(ctx, aura, true, auraAt); drawAuraBurst(ctx, aura, auraAt, s.t - auraMem.burst) }
    }
  }
  // 날아가는 것의 꼬리 (적 = 붉은 줄 · 내 것 = 무기 묶음 빛) — 그림보다 먼저
  drawTrails(ctx, s)
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
    } else if (b.kind === 'flame') {
      // 불바닥은 땅 표식 차례에 그렸다 (drawThreats)
    } else if (b.kind === 'stone') {
      // 적이 던진 돌·기름 단지: 던진 자리(tx,ty)에서 떨어질 자리로 포물선 · 뒤에 붉은 꼬리 점 (떨어질 자리 표식은 땅 차례에)
      const F = K.foe, u = 1 - Math.max(0, b.life) / M.lobDelay
      for (let j = F.lobTail; j >= 0; j--) {
        const v = Math.max(0, u - j * F.lobTailGap), px = b.tx + (b.x - b.tx) * v, py = b.ty + (b.y - b.ty) * v - Math.sin(v * Math.PI) * F.lobArc - F.lobLift
        if (j) { ctx.globalAlpha = .7 * (1 - j / (F.lobTail + 1)); ctx.fillStyle = F.rim; ctx.beginPath(); ctx.arc(px, py, F.lobSize * (1 - j / (F.lobTail + 1)), 0, TAU); ctx.fill(); ctx.globalAlpha = 1; continue }
        if (!b.gen) { stamp(ctx, images, ROCK, px, py, F.lobSize * 3, u * 9); continue }
        ctx.fillStyle = F.rimDark; ctx.beginPath(); ctx.arc(px, py, F.lobSize + 2, 0, TAU); ctx.fill()
        ctx.fillStyle = F.jar; ctx.beginPath(); ctx.arc(px, py, F.lobSize, 0, TAU); ctx.fill()
        ctx.fillStyle = F.jarHot; ctx.beginPath(); ctx.arc(px, py - 1, F.lobSize * .45, 0, TAU); ctx.fill()
      }
    } else if (b.kind === 'pebble') {
      // 돌팔매: 손 높이에서 떠나 포물선을 그리고 땅에 떨어진다 · 땅에는 작아지는 그림자
      const u = 1 - Math.max(0, b.life) / C.slingFlight
      ctx.save(); ctx.globalAlpha = .35; ctx.fillStyle = '#0a0806'; ctx.beginPath(); ctx.ellipse(b.x, b.y, 7 + 4 * u, 3 + 2 * u, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore()
      stamp(ctx, images, ROCK, b.x, b.y - C.heroShotHeight * (1 - u) - Math.sin(u * Math.PI) * C.slingArc, 17, u * 9)
    } else if (b.kind === 'skip') {
      // 연환석: 튈 때마다 통통 뛰는 작은 돌
      const hop = Math.abs(Math.sin((C.skipLife - b.life) * 9))
      stamp(ctx, images, ROCK, p.x, p.y + C.heroShotHeight * .6 - hop * 22, 16, b.life * 14)
    } else if (b.kind === 'boulder') {
      // 거암돌진: 땅을 굴러간다 (굴러간 거리만큼 돈다)
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
      // 산적 일제 사격: 화살이 붉은 줄을 끌며 내리꽂힌다 (떨어질 자리 표식은 땅 차례에 · 두목 내려찍기·던진 돌과 같은 붉은 말)
      const k = Math.max(0, b.life) / C.barrageDelay, r = C.barrageRadius
      ctx.strokeStyle = K.foe.rim; ctx.lineWidth = K.trail.foeWidth; ctx.beginPath()
      for (let i = 0; i < 5; i++) { const x = b.x + Math.cos(i * 2.4) * r * .5, y = b.y + Math.sin(i * 2.4) * r * .35 - 24 - k * 260 - i * 16; ctx.moveTo(x, y); ctx.lineTo(x, y - K.trail.foeLen) }
      ctx.stroke()
      for (let i = 0; i < 5; i++) stamp(ctx, images, 'raid/arrow.png', b.x + Math.cos(i * 2.4) * r * .5, b.y + Math.sin(i * 2.4) * r * .35 - 14 - k * 260 - i * 16, 38, Math.PI / 2)
    } else if (b.kind === 'rain') {
      // 화살비: 남은 시간만큼 위에서 화살 셋이 무기 묶음 빛을 끌며 내려온다 (떨어질 자리의 금빛 테는 땅 차례에 · 판정은 땅 좌표 그대로)
      const k = Math.max(0, b.life) / C.rainDelay
      ctx.strokeStyle = ULT_COLOR[s.kit]; ctx.lineWidth = K.trail.ownWidth; ctx.globalAlpha = K.trail.ownAlpha; ctx.beginPath()
      for (let i = 0; i < 3; i++) { const x = b.x + (i - 1) * 18, y = b.y - 30 - k * 150 - i * 12; ctx.moveTo(x, y); ctx.lineTo(x, y - K.trail.ownLen) }
      ctx.stroke(); ctx.globalAlpha = 1
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
  const finishFrames = criticalFinishFrames(s, s.fx, time, s.state === 'playing' && !ending?.active, criticalLow, FEEL.criticalFinish)
  let particleBudget = FX_ART.particleBudget
  for (const f of s.fx) {
    if (f.championCue) continue // State-based champion rings below; do not borrow bell-magic artwork.
    if (f.kind === 'hit' ? hitSkip-- > 0 : f.kind === 'death' && deathSkip-- > 0) continue   // 쓰러지는 몸도 새것 drawDeaths 개만
    const remaining = f.life - (ending?.effectTime ?? 0); if (remaining <= 0) continue
    const age = 1 - remaining / f.total; ctx.save(); ctx.globalAlpha = Math.min(1, remaining / f.total * 1.5); ctx.strokeStyle = f.color; ctx.fillStyle = f.color; ctx.lineWidth = 3
    if (particleBudget > 0 && (f.kind === 'hit' || f.kind === 'death')) particleBudget -= drawImpactParticles(ctx, images, f, age, particleBudget)
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
      const nativeAwake = f.ult ? drawUlt(ctx, images, s, f, age) : false
      if (!f.ult) impact(ctx, images, f.x, f.y - 12, f.r, age)
      if (!nativeAwake && (f.awakened ?? f.tru) && f.kind === 'ult') { ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#ffd66a'; ctx.lineWidth = 3; ctx.globalAlpha = Math.max(0, 1 - age); const r = 14 + 46 * age; ctx.beginPath(); ctx.ellipse(f.x, f.y, r, r * .5, 0, 0, Math.PI * 2); ctx.stroke() }
    } else if (f.kind === 'ring') {
      // 방울 파동 · 만신 굿: 고리가 맞는 범위까지 퍼지며 옅어진다
      const img = images.get('raid/bell-ring.png'), r = f.r * (.35 + .65 * age)
      if (img) { ctx.globalAlpha *= 1 - age * .6; ctx.drawImage(img, f.x - r, f.y - r * .6, r * 2, r * 1.2) }
    } else if (f.kind === 'buff') {
      // 무당이 둘레를 북돋는 고리(적 · 나를 때리진 않는다 = 검붉고 가늘게) · 영웅의 투지를 켠 순간(내 것 = 하늘빛)
      const foe = f.r === M.shamanRadius
      ctx.strokeStyle = foe ? K.foe.buff : K.own.grit; ctx.lineWidth = foe ? K.foe.buffWidth : 4; ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * age, f.r * age * .55, 0, 0, Math.PI * 2); ctx.stroke()
    } else if (f.kind === 'blast') {
      const foe = blastOf.get(f)
      if (foe) {
        // 적의 것이 떨어졌다: 불 종류는 불 · 돌·화살은 흙먼지 · 붉은 테가 퍼져 나가며 옅어진다
        if (foe === 2) effectStrip(ctx, images, 'fire', f.x, f.y, f.r * 1.3, age); else impact(ctx, images, f.x, f.y - 6, f.r * 1.25, age)
        ctx.strokeStyle = K.foe.rim; ctx.lineWidth = 1 + K.foe.rimWidth * (1 - age); ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1 + K.foe.shock * age), 0, TAU); ctx.stroke()
      } else {
        // 내 것: 불빛(부적·뇌화)은 불 · 찬 빛(화살비·혼불)은 흙먼지 터짐 · 그 빛의 가는 고리가 번진다
        if (warm(f.color)) effectStrip(ctx, images, 'fire', f.x, f.y, f.r * 1.3, age); else impact(ctx, images, f.x, f.y - 6, f.r, age)
        ctx.lineWidth = K.own.ringWidth; ctx.globalAlpha *= K.own.ringAlpha; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (.55 + .45 * age), 0, TAU); ctx.stroke()
      }
    } else if (f.kind === 'death') {
      if (f.mob && !(s.giantFlow?.finalDefeated && f.mob === 'boss') && !criticalFinishHandled(s, f)) {
        const away = -(f.face ?? 1), elite = f.mob === 'elite' || f.mob === 'boss'
        const flight = Math.min(1, age / FEEL.deathBounceAt)
        const bounce = age < FEEL.deathBounceAt ? Math.sin(Math.PI * flight) * FEEL.deathLift : Math.sin(Math.PI * (age - FEEL.deathBounceAt) / (1 - FEEL.deathBounceAt)) * FEEL.deathBounce
        ctx.save(); ctx.translate(f.x + away * flight * (elite ? FEEL.deathEliteDistance : FEEL.deathDistance), f.y + 20 - bounce)
        ctx.rotate(away * flight * FEEL.deathSpin)
        ctx.globalAlpha *= Math.min(1, (1 - age) / (1 - FEEL.deathFadeAt))
        sprite(ctx, images, warlord(f.mob, s.stage), 0, 0, artHeight(f.mob, s.stage), 18, f.face ?? 1)
        ctx.restore()
      }
      effectStrip(ctx,images,'death',f.x,f.y+12,f.r*1.6,age)
    } else stamp(ctx, images, 'raid/hit.png', f.x, f.y, 30 * (1 - age * .5))
    ctx.restore()
  }
  drawCriticalFinishFrames(ctx, finishFrames, (mob, face) => sprite(ctx, images, warlord(mob, s.stage), 0, 0, artHeight(mob, s.stage), 18, face))
  // 붉은 예고는 내 FX 뒤에: 실제 원/돌진/탄환 길만 표시하고 안전한 부채 사이를 채우지 않는다.
  for(const e of s.enemies)if(e.giant?.kind==='imugi'&&e.giant.attack&&e.giant.state==='strike')drawImugiWater(ctx,e.giant.attack)
  drawThreats(ctx, images, s); drawChampionTells(ctx, s)
  for(const e of s.enemies)if(e.giant?.kind==='imugi'&&e.giant.attack&&(e.giant.state==='tell'||e.giant.state==='strike'))drawImugiThreats(ctx,e.giant.attack.shapes)
  for(const e of s.enemies)if(e.giant?.kind==='imugi'&&e.giant.environment&&e.giant.state!=='entry'&&e.giant.state!=='dead')drawImugiThreats(ctx,e.giant.environment.shapes)
  for(const e of s.enemies)if(e.giant?.kind==='tiger')drawTigerThreats(ctx,e.giant);else if(e.giant?.kind==='bulgasari')drawBulgasariThreats(ctx,e.giant);else if(e.giant?.kind==='gumiho')drawGumihoThreats(ctx,e.giant)
  // 피해 숫자 — 알갱이로 튀어 나간다 (trackNumbers · drawNumbers)
  trackNumbers(s); ctx.save(); drawNumbers(ctx, images, s, s.t + (ending?.effectTime ?? 0)); ctx.restore()
  drawChampionOverlays(ctx, images, s, mobHeight, cam ? fieldView(cam) : undefined)
  // 여기부터 화면에 붙은 것 — 확대해도 그대로 (흔들림만)
  if (z !== 1) fieldTransform(ctx, 1, qx, qy)
  if (s.hurt > 0) { ctx.strokeStyle = '#ff735a99'; ctx.lineWidth = 12; ctx.strokeRect(0, 0, W, H) }
  const boss = s.enemies.find(e => e.kind === 'boss' && !e.giant)
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
  if (s.state === 'playing' && awakeCastDim(s.cast) > 0) { fieldTransform(ctx); drawAwakeCastDim(ctx, s.cast, W, H) }
}
