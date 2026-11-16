import { HAEBI_RUN as C, HAEBI_MOBS as M, HAEBI_STAGES as ST, HAEBI_ULT as U } from '../tune/params.ts'
import { genArtOf } from '../realm/data/art.ts'
import { areaScale, charge, slamRadius, slamWindup, type HaebiRun, type Kit, type Missile, type StageId } from './haebi.ts'
import { WALK_CYCLE } from './walk-cycle.ts'

/** bandit-<종류> 가 아닌 적 그림 (11-16 H50~H53 · tools/sprite-kit/bake-raid-enemies.py) */
const MOB_ART: Record<string, string> = { tiger: 'beast-tiger', bear: 'beast-bear', hunter: 'snow-hunter', torch: 'torch-raider' }
export const imagePaths = [genArtOf('haebi').file, genArtOf('aw1-haebi').file, 'anim-px/bandit-club.png', 'anim-px/bandit-chief.png', 'anim-px/bandit-archer.png',
  ...['runner', 'slinger', 'shield', 'dog', 'berserker', 'firearcher', 'iron', 'shaman'].map(k => `anim-px/bandit-${k}.png`), ...['ford.webp', 'palisade.webp', 'digits.png', 'knife.png', 'soul.png', 'bell-ring.png', 'javelin.png','sword-wave.png','forest.webp','axe.png','impact-strip.png','slash-strip.png','death-strip.png','fire-strip.png','lightning-strip.png','talisman.png','wind-blade.png','arrow.png','hit.png','essence.png','essence-large.png',...['mark-slam','mark-ring','mark-move','mark-hero','mark-target','mark-arrow','bar-boss','plaque'].map(p=>`ui/${p}.png`)].map(p=>'raid/'+p), 'anim-px/bandit-warlord.png',
  // 11-16 H45~H53: 스테이지 두목 둘 · 설원·산성 적 넷 · 넷째·다섯째 바닥
  ...['boss-ford', 'boss-palisade', 'boss-snow', 'boss-fortress', ...Object.values(MOB_ART)].map(n => `anim-px/${n}.png`), 'raid/snow.webp', 'raid/fortress.webp']
/** bar-boss.png 의 투명한 홈 [x0,y0,x1,y1] — tools/raid-ui-kit.py 가 public/realm/raid/ui/kit.json 에 적는 값 */
const BOSS_WIN = [104, 35, 626, 82] as const
export function sprite(ctx: CanvasRenderingContext2D, images: Map<string, HTMLImageElement>, path: string, x: number, y: number, height: number, frame: number, face = 1, flash = false) {
  const img = images.get(path); if (!img) return
  const w = img.width / 20, h = img.height
  ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.scale(face, 1); ctx.imageSmoothingEnabled = false
  ctx.drawImage(img, frame * w, 0, w, h, -height * w / h / 2, -height, height * w / h, height)
  // 맞은 번쩍: 같은 그림을 한 번 더 빛으로 더한다 — ctx.filter 는 폰에서 그림마다 소프트웨어로 돌아 프레임을 크게 깎았다 (11-16 플립7 20프레임)
  if (flash) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = C.flashAdd; ctx.drawImage(img, frame * w, 0, w, h, -height * w / h / 2, -height, height * w / h, height) }
  ctx.restore()
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
const heroSprite = (s: HaebiRun) => s.combos.length ? heroArt.awake : heroArt.base
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
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.drawImage(img, -size / 2, -size / 2, size, size); ctx.restore()
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
const ULT_COLOR: Record<Kit, string> = { axe: '#ffb04a', bow: '#d4ecff', spear: '#eef3ff', sword: '#8fd0ff', dagger: '#b48cff', magic: '#ffe27a' }
/** 띠 그림의 한 칸을 (0,0)→(len,0) 으로 늘여 그린다 — 번개 띠(256×128 여덟 칸) */
function stripAlong(ctx: CanvasRenderingContext2D, img: HTMLImageElement | undefined, age: number, len: number, h: number) {
  if (img) ctx.drawImage(img, impactFrame(age) * 256, 0, 256, 128, 0, -h / 2, len, h)
}
/** 비기 그림 (판 상태는 읽기만) — f.ult 묶음마다 꼴이 다르다. 폰 프레임: filter·shadowBlur·그라디언트 없이 그림 띠와 선만 */
function drawUlt(ctx: CanvasRenderingContext2D, images: Map<string, HTMLImageElement>, s: HaebiRun, f: HaebiRun['fx'][number], age: number) {
  const kit = f.ult!, color = ULT_COLOR[kit], len = Math.hypot(f.x2 - f.x, f.y2 - f.y), lead = f.kind === 'skill'
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
export function drawPortrait(ctx: CanvasRenderingContext2D, images: Map<string, HTMLImageElement>, s: HaebiRun, menuTime = 0) {
  const { width: w, height: h } = ctx.canvas; ctx.clearRect(0, 0, w, h)
  const bg = ctx.createRadialGradient(w / 2, h * .46, 20, w / 2, h / 2, h * .65)
  bg.addColorStop(0, s.combos.length ? '#6c5932' : '#394e46'); bg.addColorStop(1, '#111c20'); ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = '#d9bc6955'; ctx.lineWidth = 1
  for (const r of [90, 120, 145]) { ctx.beginPath(); ctx.arc(w / 2, h * .55, r, 0, Math.PI * 2); ctx.stroke() }
  sprite(ctx, images, heroSprite(s), w / 2, h - 24, h - 28, heroFrame(s, true, menuTime), 1, s.hurt > 0)
  if (s.hurt > 0) { ctx.fillStyle = '#f5654933'; ctx.fillRect(0, 0, w, h) }
}
export function drawField(ctx: CanvasRenderingContext2D, images: Map<string, HTMLImageElement>, s: HaebiRun, destination: { x: number; y: number } | null) {
  const W = C.width, H = C.height
  ctx.fillStyle = '#273c35'; ctx.fillRect(0, 0, W, H)
  const bg = images.get('raid/' + ST[s.stage].bg) ?? images.get('raid/forest.webp')
  if (bg) { const sw = bg.height * W / H; ctx.drawImage(bg, (bg.width - sw) / 2, 0, sw, bg.height, 0, 0, W, H) }
  ctx.fillStyle = '#11281b25'; ctx.fillRect(0, 0, W, H)
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
  for (const d of s.drops) stamp(ctx, images, d.value > 2 ? 'raid/essence-large.png' : 'raid/essence.png', d.x, d.y, d.value > 2 ? 23 : 15)
  if (destination) decal(ctx, images, 'mark-move', destination.x, destination.y, 30, 26, .85)
  const entities = [...s.enemies.map(e => ({ y: e.y, e })), { y: s.y, e: null }].sort((a, b) => a.y - b.y)
  for (const { e } of entities) {
    if (e) {
      const big = e.kind === 'boss' || e.kind === 'elite', h = mobHeight(e.kind)
      const target = s.mode === 'vanguard' && e.kind === 'boss'
      ctx.fillStyle = '#07181655'; ctx.beginPath(); ctx.ellipse(e.x, e.y + 2, big ? 24 : 16, 6, 0, 0, Math.PI * 2); ctx.fill()
      // 무당이 북돋운 적 · 성난 광전사: 발밑 붉은 기운
      if (e.buff > 0 || e.kind === 'berserker' && e.hp < e.max / 2) { ctx.save(); ctx.globalAlpha = .45 + .25 * Math.sin(s.t * 12 + e.id); ctx.fillStyle = '#ff3b2f'; ctx.beginPath(); ctx.ellipse(e.x, e.y + 2, 22, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore() }
      if (target) decal(ctx, images, 'mark-target', e.x, e.y, 100, 45)
      sprite(ctx, images, warlord(e.kind, s.stage), e.x, e.y, h, e.wind > 0 ? 13 : archerFrame(s, e) ?? 4 + Math.floor(s.t * 8 + e.id) % 8, s.x < e.x ? -1 : 1, e.flash > 0)
      if (target) decal(ctx, images, 'mark-arrow', e.x, e.y - h - 26 + Math.sin(s.t * 4) * 4, 22, 39)
      if (big) { ctx.fillStyle = '#111c'; ctx.fillRect(e.x - 28, e.y - h, 56, 5); ctx.fillStyle = '#ef9873'; ctx.fillRect(e.x - 28, e.y - h, 56 * e.hp / e.max, 5) }
    } else {
      if (!decal(ctx, images, 'mark-hero', s.x, s.y, 72, 32, .8)) { ctx.strokeStyle = '#f9d89788'; ctx.fillStyle = '#ffd97726'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(s.x, s.y, 29, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke() }
      trackGhosts(s, heroSprite(s)); drawGhosts(ctx, images, s, C.heroPx)
      sprite(ctx, images, heroSprite(s), s.x, s.y, C.heroPx, heroFrame(s), s.face, s.hurt > 0)
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
  for (const f of s.fx) {
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
    } else if (f.kind === 'spike') {
      impact(ctx, images, f.x, f.y - 8, f.r, age)
    } else if (f.kind === 'skill' || f.kind === 'ult') {
      if (f.ult) drawUlt(ctx, images, s, f, age); else impact(ctx, images, f.x, f.y - 12, f.r, age)
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
  // 피해 숫자 (형 11-16: 「한방이라 강해지는지 모르겠다」) — 맞은 자리에서 툭 커졌다 떠오르며 사라짐 · 쓰러뜨린 한 방은 금빛으로 크게
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'
  for (const f of s.fx) {
    if (f.n === undefined || f.mob === 'boss') continue
    const age = 1 - f.life / f.total, kill = f.kind === 'death', hot = kill || !!f.crit, pop = age < .18 ? 1.45 - age / .18 * .45 : 1
    ctx.globalAlpha = Math.min(1, (1 - age) * 2.2)
    const y = f.y - (kill ? 30 : 14) - age * 26, text = String(Math.round(f.n)), size = (f.crit ? 26 : kill ? 21 : 16) * pop
    if (digits(ctx, images, text, f.x, y, size, hot)) continue
    ctx.font = `700 ${Math.round(size)}px 'Barlow Condensed', system-ui, sans-serif`
    ctx.lineWidth = 4; ctx.strokeStyle = hot ? '#5a1408' : '#2a1d12'; ctx.strokeText(text, f.x, y)
    ctx.fillStyle = hot ? '#ffc94a' : '#fff6e2'; ctx.fillText(text, f.x, y)
  }
  ctx.restore()
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
