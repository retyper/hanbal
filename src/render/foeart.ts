/**
 * 적의 몸 — **그림** (2026-09-20, 형: "캐릭터 적군 보스 등등도 전부 에셋 받아서 적용해야지.")
 *
 * 사람 적은 〈몸통·머리·다리〉만 그림이다. **팔과 무기는 여전히 절차적으로 그린다** (render/foe.ts) —
 * 나를 겨누는 팔, 당겨지는 시위, 물려 있는 화살이 이 게임의 예고(windup)라서 그림에 굳히면 안 된다.
 * 그래서 그림은 "팔 없는 몸"으로 받았다 (public/sprites/foe-*.png · 출처는 같은 폴더).
 *
 * 보스(render/bossart.ts)와 같은 원리다:
 * 1. **그림의 머리가 sim 의 헤드샷 자리에 온다.** 기준점은 머리 중심이고, 크기는 〈머리 → 발밑〉으로 정한다.
 * 2. 그림이 아직 안 떴거나 헤드리스면 false — 부르는 쪽이 벡터 몸을 그린다. 폴백은 지우지 않는다.
 * 3. 읽기만 한다 (A1). 프레임당 힙 할당 0 (A5).
 *
 * 아래 숫자는 손맛 노브가 아니라 **그림 한 장 한 장의 좌표**다. 재는 법: tools/preview (?hit=1).
 */
import { sprite } from './sprites.ts'

interface FoeArt {
  /** 머리 중심 — 그림 안의 자리 (0~1). */
  readonly headU: number
  readonly headV: number
  /** 발밑의 v. */
  readonly footV: number
  /** 어깨 — 팔이 나오는 자리. 그림은 왼쪽을 본다. */
  readonly shU: number
  readonly shV: number
}

/**
 * drawFoeArt 가 채우는 어깨의 화면 자리. ★ 팔은 여기서 나온다 (2026-09-20 두 번째 판).
 * 첫 판은 그림을 겨냥각에 따라 기우는 머리에 못 박아서 적이 겨눌 때마다 늘었다 줄었고, 팔은 코드의 어깨에서 나와 몸과 따로 놀았다.
 * sim 의 헤드샷 자리는 **곧게 선** 몸의 머리(target.y + r·archerHeadUp)다 — 기울기는 애초에 그림의 것이었다. 그래서 그림은 곧게 세운다.
 */
export const FOE_SH = { x: 0, y: 0 }

const ART = {
  archer: { headU: 0.5, headV: 0.112, footV: 0.985, shU: 0.47, shV: 0.31 },
  armored: { headU: 0.485, headV: 0.112, footV: 0.985, shU: 0.5, shV: 0.31 },
  gunner: { headU: 0.345, headV: 0.2, footV: 0.985, shU: 0.6, shV: 0.35 },
  slinger: { headU: 0.43, headV: 0.108, footV: 0.985, shU: 0.62, shV: 0.3 },
} as const satisfies Record<string, FoeArt>

export type FoeArtName = keyof typeof ART

/** 적의 테두리 빛 — 위협색(THEME.threat 계열). 몸 높이에 비례해 번진다. */
const RIM = { color: 'rgba(255, 96, 64, 0.95)', perHeight: 0.09, minPx: 4 } as const

/** 미리 받아 둔다 — 안 그러면 적이 나온 첫 몇 프레임은 벡터였다가 그림으로 툭 바뀐다. */
export function warmFoeArt(): void {
  for (const name of Object.keys(ART)) sprite(`foe-${name}`)
  for (let i = 0; i < SCOUT.length; i++) sprite(`foe-scout-${i}`)
  sprite('foe-falcon-a')
  sprite('foe-falcon-b')
  for (const name of Object.keys(PROP)) sprite(name)
  for (const c of CORPSE) sprite(c.name)
  for (const name of Object.keys(HERO)) sprite(`hero-${name}`)
  for (const name of Object.keys(TARGET)) sprite(`target-${name}`)
  for (const k of Object.keys(ARM) as (keyof typeof ARM)[]) { sprite(ARM[k].upper); sprite(ARM[k].fore) }
  sprite('limb-fist')
  sprite('prop-pole')
  for (const name of Object.values(FLY)) sprite(name)
  for (const c of SHOT_ART) if (c !== null) sprite(c.name)
}

/**
 * 적의 몸을 그림으로 그린다. 그렸으면 true.
 * (hx, hy) 머리 중심의 화면 자리 (sim 의 헤드샷 자리) · footY 발밑의 화면 y.
 * 그림은 전부 **왼쪽(궁수 쪽)** 을 본다. faceRight 면 뒤집는다.
 */
export function drawFoeArt(
  ctx: CanvasRenderingContext2D, name: FoeArtName, hx: number, hy: number, footY: number, faceRight: boolean,
): boolean {
  const im = sprite(`foe-${name}`)
  if (im === null) return false
  const art = ART[name]
  const span = (art.footV - art.headV) * im.naturalHeight
  if (span <= 0 || footY <= hy) return false
  const s = (footY - hy) / span
  const dw = im.naturalWidth * s
  const dh = im.naturalHeight * s
  // ★ 적은 **눈에 띄어야 한다.** 그린 적은 예전의 빨간 막대보다 어두워서 밤·노을 배경에 묻힌다 (남빛 총통수가 특히).
  //   캔버스의 그림자는 그림의 알파를 따라 번지므로, 위협색 그림자를 오프셋 없이 주면 **실루엣을 두른 붉은 테**가 된다.
  ctx.save()
  ctx.shadowColor = RIM.color
  ctx.shadowBlur = Math.max(RIM.minPx, dh * RIM.perHeight)
  const dir = faceRight ? -1 : 1
  ctx.translate(hx, hy)
  ctx.scale(dir, 1)
  ctx.drawImage(im, -art.headU * dw, -art.headV * dh, dw, dh)
  ctx.restore()
  FOE_SH.x = hx + dir * (art.shU - art.headU) * dw
  FOE_SH.y = hy + (art.shV - art.headV) * dh
  return true
}

/**
 * 그리지 않고 **어깨의 자리만** 구한다 — 팔·활의 자리는 몸보다 먼저 정해져야 해서 (foe.ts 는 어깨에서 그립을 뻗는다).
 * 그림이 아직 안 떴으면 false. 인자는 drawFoeArt 와 같다.
 */
export function foeShoulder(name: FoeArtName, hx: number, hy: number, footY: number, faceRight: boolean): boolean {
  const im = sprite(`foe-${name}`)
  if (im === null) return false
  const art = ART[name]
  const span = (art.footV - art.headV) * im.naturalHeight
  if (span <= 0 || footY <= hy) return false
  const s = (footY - hy) / span
  const dir = faceRight ? -1 : 1
  FOE_SH.x = hx + dir * (art.shU - art.headU) * im.naturalWidth * s
  FOE_SH.y = hy + (art.shV - art.headV) * im.naturalHeight * s
  return true
}

/**
 * 척후 — **칼을 내리치며 달려오는 4컷** (2026-09-20 두 번째 판, 형: "판떼기가 흔들려오는거같아. 칼을 휘두르며 달려오는 모션이어야해").
 * 컷마다 자세가 달라 트림된 크기가 다르다 — srcH 는 원본에서의 키(px)라, 그걸로 **네 컷의 배율을 하나로** 맞춘다 (안 그러면 컷마다 사람이 커졌다 작아진다).
 * 그림은 오른쪽을 본다. 기준점은 머리 — sim 의 헤드샷 자리에 못 박는다.
 */
const SCOUT = [
  { headU: 0.65, headV: 0.284, srcH: 396 },
  { headU: 0.586, headV: 0.128, srcH: 342 },
  { headU: 0.572, headV: 0.126, srcH: 309 },
  { headU: 0.808, headV: 0.164, srcH: 320 },
] as const
/** 원본에서 곧게 선 사람의 키 (px) — 주인공·적 시트와 같은 비례로 받았다. */
const SCOUT_STAND = 360

/** phase 는 달리기의 위상 (rad). tall 은 곧게 선 사람의 키 (px) — 다른 적과 같은 식으로 구한 값을 넘긴다. */
export function drawScoutArt(
  ctx: CanvasRenderingContext2D, phase: number, hx: number, hy: number, tall: number, faceLeft: boolean,
): boolean {
  const n = SCOUT.length
  const i = ((Math.floor((phase / (Math.PI * 2)) * n) % n) + n) % n
  const im = sprite(`foe-scout-${i}`)
  if (im === null) return false
  const f = SCOUT[i]
  if (f === undefined) return false
  const dh = tall * (f.srcH / SCOUT_STAND)
  const dw = dh * (im.naturalWidth / im.naturalHeight)
  ctx.save()
  ctx.shadowColor = RIM.color
  ctx.shadowBlur = Math.max(RIM.minPx, tall * RIM.perHeight)
  ctx.translate(hx, hy)
  ctx.scale(faceLeft ? -1 : 1, 1)
  ctx.drawImage(im, -f.headU * dw, -f.headV * dh, dw, dh)
  ctx.restore()
  return true
}

/**
 * 매 — 두 컷 (날개를 든 a · 내린 b). 기준점은 **눈**이다 — sim 의 급소(foeWeakSpot 3)가 눈이라서.
 * perRx 는 그림의 긴 변이 몸 반경(rx)의 몇 배인가다. 두 컷은 트림된 크기가 달라(날개를 들면 세로로 길다)
 * 같은 값을 쓰면 몸이 커졌다 작아졌다 한다 — 원본에서 **몸길이가 같도록** 잰 두 값이다 (몸길이 ≈ 2.2rx).
 */
const FALCON = {
  a: { eyeU: 0.12, eyeV: 0.805, perRx: 2.7 },
  b: { eyeU: 0.115, eyeV: 0.147, perRx: 2.36 },
} as const

/** 매를 그림으로 그린다. (ex, ey) 눈의 화면 자리 · rx 몸의 반경 · wingsUp 날개를 든 컷인가. */
export function drawFalconArt(
  ctx: CanvasRenderingContext2D, ex: number, ey: number, rx: number, wingsUp: boolean,
): boolean {
  const im = sprite(wingsUp ? 'foe-falcon-a' : 'foe-falcon-b')
  if (im === null) return false
  const f = wingsUp ? FALCON.a : FALCON.b
  const s = (rx * f.perRx) / Math.max(im.naturalWidth, im.naturalHeight)
  const dw = im.naturalWidth * s
  const dh = im.naturalHeight * s
  ctx.drawImage(im, ex - f.eyeU * dw, ey - f.eyeV * dh, dw, dh)
  return true
}

/**
 * 물건 — 화차 · 화약궤. 기준점(u, v)을 화면의 한 점에 못 박고, 크기는 〈기준점 → 밑단〉으로 정한다.
 * 화차의 기준점은 **화약궤**다 — sim 의 급소(foeWeakSpot 4)가 거기라서.
 */
const PROP = {
  hwacha: { u: 0.354, v: 0.553, bottomV: 0.99 },
  crate: { u: 0.5, v: 0.62, bottomV: 0.99 },
} as const

export function drawPropArt(
  ctx: CanvasRenderingContext2D, name: keyof typeof PROP, ax: number, ay: number, bottomY: number,
): boolean {
  const im = sprite(name)
  if (im === null) return false
  const a = PROP[name]
  const span = (a.bottomV - a.v) * im.naturalHeight
  if (span <= 0 || bottomY <= ay) return false
  const s = (bottomY - ay) / span
  ctx.drawImage(im, ax - a.u * im.naturalWidth * s, ay - a.v * im.naturalHeight * s, im.naturalWidth * s, im.naturalHeight * s)
  return true
}

/**
 * 시체 — 나뒹구는 몸 한 장을 래그돌의 각도(ang)로 돌린다. 가라앉으면(settle → 1) **눕는다**:
 * rest 는 그 그림을 땅에 눕히는 각도다 (그림마다 몸의 기울기가 달라서 따로 잰다).
 * span 은 그림의 긴 변이 몸 반경(r)의 몇 배인가 · lift 는 누웠을 때 중심을 땅 위로 올리는 양 (r 배수).
 */
const CORPSE = [
  /* 0 */ { name: 'dead-archer', rest: -1.1, span: 2.9, lift: 0.42 },
  /* 1 */ { name: 'dead-archer', rest: -1.1, span: 2.9, lift: 0.42 },
  /* 2 */ { name: 'dead-archer', rest: -1.1, span: 2.9, lift: 0.42 },
  /* 3 매     */ { name: 'dead-falcon', rest: 0.25, span: 2.6, lift: 0.75 },
  /* 4 화차   */ { name: 'dead-hwacha', rest: 0, span: 3.2, lift: 0.6 },
  /* 5 총통수 */ { name: 'dead-gunner', rest: -0.95, span: 3.1, lift: 0.45 },
  /* 6 투석군 */ { name: 'dead-slinger', rest: -0.6, span: 2.9, lift: 0.42 },
] as const

export function drawCorpseArt(
  ctx: CanvasRenderingContext2D, look: number, x: number, y: number, r: number, ang: number, settle: number,
): boolean {
  const c = CORPSE[look]
  if (c === undefined) return false
  const im = sprite(c.name)
  if (im === null) return false
  const s = (r * c.span) / Math.max(im.naturalWidth, im.naturalHeight)
  const dw = im.naturalWidth * s
  const dh = im.naturalHeight * s
  // 화차는 구르지 않는다 — 부서져 주저앉을 뿐이다.
  const spin = look === 4 ? ang * 0.25 : ang
  // (x, y) 는 몸의 **중심**이다. 누우면 중심이 땅에 닿아 몸의 절반이 땅 밑으로 들어가므로, 가라앉는 만큼 들어 올린다.
  ctx.translate(x, y - r * c.lift * settle)
  ctx.rotate(spin * (1 - settle) + c.rest * settle)
  ctx.drawImage(im, -dw / 2, -dh / 2, dw, dh)
  return true
}

/**
 * 궁수(주인공)의 몸 — 적 궁수와 같은 길이다: **몸통·머리·다리만 그림**이고, 활팔·활·시위팔·화살은
 * render/stickman.ts 가 지금처럼 관절 위에 그린다. 당김·겨냥·떨림은 전부 팔과 활에 있어서 그대로다.
 * 척추가 "언제나 수직"인 것이 이 게임의 자세 규격(docs/FORM.md 2-2)이라 선 그림 한 장이 그대로 맞는다.
 *
 * plain 맨몸 · a0 가죽갑 · a1 두정갑 · a2 찰갑 (World.armorLook). 갑옷이 다 벗겨지면 맨몸으로 돌아간다.
 * 끄려면 HERO_ART 를 false 로 — 스틱맨으로 돌아간다 (벡터 몸은 폴백으로 그대로 있다).
 */
export const HERO_ART = true

/**
 * ★ 2026-09-20 두 번째 판 — 형: **"커서를 움직일때마다 캐릭터가 커졌다 작아졌다 하는 버그랑 어깨 위치가 고정되지 못하고
 *   계속 팔이랑 몸통이 분리되는 문제"**, 그리고 **"활쏘는 자세가 아니라 너무 곧게 서있잖아."**
 *
 * 첫 판은 그림을 **머리**에 못 박았다. 그런데 스틱맨의 머리와 어깨는 겨냥각을 따라 턱 둘레를 돈다 (computeRig) —
 * 그래서 〈머리 → 발〉 거리가 커서를 따라 변했고(= 그림이 늘었다 줄었다 했고), 그림의 어깨와 팔의 시작점이 따로 놀았다.
 * 이제는 이렇다:
 *   1. 그림은 **턱(앵커)** 에 못 박는다. 턱은 sim 의 고정점(ArcherState.x·y)이라 겨냥해도 안 움직인다.
 *      크기는 〈턱 → 땅〉이고 둘 다 상수다 — 그림은 더 이상 숨을 쉬지 않는다.
 *   2. 팔은 rig 의 어깨가 아니라 **그림의 어깨 두 점**에서 나온다 (HERO_SH). 손의 자리(그립·시위손)는 여전히 rig 의 것이라
 *      당김과 겨냥은 그대로다. 달라진 것은 윗팔의 시작점 몇 cm 뿐이다.
 *   3. 몸은 사법 자세로 다시 받았다 — 발을 넓게 딛고 가슴을 열고 머리만 과녁을 본다. 가슴이 보는 사람을 향하므로 어깨가 둘이다:
 *      활팔은 과녁 쪽(화면 오른쪽) 어깨, 시위팔은 반대쪽 어깨.
 */
interface HeroArt {
  /** 턱(앵커)의 자리 */
  readonly jawU: number
  readonly jawV: number
  /** 활팔 어깨 (과녁 쪽) · 시위팔 어깨 */
  readonly bowU: number
  readonly strU: number
  readonly shV: number
  readonly footV: number
}
const STANCE: HeroArt = { jawU: 0.525, jawV: 0.199, bowU: 0.641, strU: 0.315, shV: 0.276, footV: 0.99 }
const HERO: Record<'plain' | 'a0' | 'a1' | 'a2', HeroArt> = {
  plain: STANCE,
  a0: STANCE,
  a1: STANCE,
  /* 찰갑은 어깨 가리개가 있어 어깨가 조금 높고 넓다 */
  a2: { ...STANCE, bowU: 0.643, strU: 0.306, shV: 0.262 },
}

/** drawHeroArt 가 채우는 두 어깨의 화면 자리. */
export const HERO_SH = { bowX: 0, bowY: 0, strX: 0, strY: 0 }

/** 그 갑옷의 그림이 있는가 — 없는 벌은 부르는 쪽이 벡터 몸을 그린다. */
export function heroArtName(armorOn: boolean, armorLook: number): keyof typeof HERO | null {
  if (!HERO_ART) return null
  if (!armorOn) return 'plain'
  const name = `a${armorLook}`
  return name in HERO ? (name as keyof typeof HERO) : null
}

/**
 * (jawX, jawY) 턱의 화면 자리 · footY 발밑의 화면 y. 그림은 오른쪽을 본다 — faceLeft 면 뒤집는다.
 * 그렸으면 true 이고, HERO_SH 에 두 어깨의 화면 자리가 들어 있다.
 */
export function drawHeroArt(
  ctx: CanvasRenderingContext2D, name: keyof typeof HERO, jawX: number, jawY: number, footY: number, faceLeft: boolean,
): boolean {
  const im = sprite(`hero-${name}`)
  if (im === null) return false
  const art = HERO[name]
  const span = (art.footV - art.jawV) * im.naturalHeight
  if (span <= 0 || footY <= jawY) return false
  const s = (footY - jawY) / span
  const dw = im.naturalWidth * s
  const dh = im.naturalHeight * s
  const dir = faceLeft ? -1 : 1
  ctx.save()
  ctx.translate(jawX, jawY)
  ctx.scale(dir, 1)
  ctx.drawImage(im, -art.jawU * dw, -art.jawV * dh, dw, dh)
  ctx.restore()
  HERO_SH.bowX = jawX + dir * (art.bowU - art.jawU) * dw
  HERO_SH.strX = jawX + dir * (art.strU - art.jawU) * dw
  HERO_SH.bowY = jawY + (art.shV - art.jawV) * dh
  HERO_SH.strY = HERO_SH.bowY
  return true
}

/**
 * 과녁 — 정면에서 본 그림을 **판정 타원(rx, ry)에 맞춰 늘려** 얹는다. 맞으면 눌리는 것(rx ≠ ry)이 그대로 산다.
 * 링의 비율은 점수의 문법이다 (scene.ts DRAW.ringBand 0.76 · ringAccent 0.5 · ringCore 0.2) — 그림도 그 비율로 주문했다.
 * k 는 그림이 판정 원보다 얼마나 큰가 (짚 테두리·등의 뚜껑처럼 판정 밖으로 나가는 장식). up 은 위로 올리는 양 (ry 배수).
 */
const TARGET = {
  static: { k: 1.08, up: 0 },
  pierce: { k: 1.12, up: 0 },
  supply: { k: 1.05, up: 0 },
  heal: { k: 1.05, up: 0 },
  lantern: { k: 1.12, up: 0.06 },
} as const

export function drawTargetArt(
  ctx: CanvasRenderingContext2D, name: keyof typeof TARGET, x: number, y: number, rx: number, ry: number,
): boolean {
  const im = sprite(`target-${name}`)
  if (im === null) return false
  const a = TARGET[name]
  // 그림의 가로세로비는 지킨다 (등은 세로로 길다) — 긴 변을 판정 지름 × k 에 맞춘다.
  const long = Math.max(im.naturalWidth, im.naturalHeight)
  const dw = (im.naturalWidth / long) * rx * 2 * a.k
  const dh = (im.naturalHeight / long) * ry * 2 * a.k
  ctx.drawImage(im, x - dw / 2, y - dh / 2 - ry * a.up, dw, dh)
  return true
}

/**
 * 팔 — **관절은 그대로고 옷만 입힌다** (2026-09-20, 형: "팔도 … 전부 에셋 바꿔야하는거아냐?").
 *
 * 어깨·팔꿈치·손의 자리는 여전히 render/stickman.ts · foe.ts 가 계산한다 (당김·겨냥·떨림이 거기 있다).
 * 여기서는 그 두 토막 〈어깨→팔꿈치〉〈팔꿈치→손〉 위에 **세로로 선 소매 그림**을 돌려서 늘려 얹을 뿐이다.
 * 그림은 위가 몸 쪽 끝이다. upperCut 은 윗팔로 쓸 때 그림의 위에서 몇 할만 쓰는가 —
 * 산적은 윗팔 그림을 못 받아서 아랫팔 그림의 소매 부분(손목 감개 위)을 윗팔로 쓴다.
 */
// ★ 2026-09-20 두 번째 판 — 형: "상박과 하박이 자연스럽게 이어지지 못하고 어긋나있어."
//   윗팔 그림(헐렁한 비대칭 소매)과 아랫팔 그림(좁은 소매)이 폭도 중심선도 달라서 팔꿈치에서 턱이 졌다.
//   이제 **같은 소매 그림**으로 위·아래를 잇는다 — 윗팔은 그 그림의 소매 부분(upperCut), 폭은 거의 같게.
const ARM = {
  hero: { upper: 'limb-hero-fore', upperCut: 0.6, upperW: 1.08, fore: 'limb-hero-fore', foreW: 1 },
  foe: { upper: 'limb-foe-fore', upperCut: 0.62, upperW: 1.08, fore: 'limb-foe-fore', foreW: 1 },
  gunner: { upper: 'limb-gunner-fore', upperCut: 0.7, upperW: 1.08, fore: 'limb-gunner-fore', foreW: 1 },
  peasant: { upper: 'limb-peasant-fore', upperCut: 0.34, upperW: 1.12, fore: 'limb-peasant-fore', foreW: 1 },
} as const
export type ArmSkin = keyof typeof ARM

function segment(
  ctx: CanvasRenderingContext2D, im: HTMLImageElement, cut: number,
  x0: number, y0: number, x1: number, y1: number, wide: number,
): void {
  const len = Math.hypot(x1 - x0, y1 - y0)
  if (len < 0.5) return
  // 토막 끝을 조금씩 겹친다 — 안 그러면 굽은 팔꿈치에 틈이 보인다.
  const over = wide * 0.3
  ctx.save()
  ctx.translate(x0, y0)
  ctx.rotate(Math.atan2(y1 - y0, x1 - x0) - Math.PI / 2)
  ctx.drawImage(im, 0, 0, im.naturalWidth, im.naturalHeight * cut, -wide / 2, -over, wide, len + over * 2)
  ctx.restore()
}

/**
 * 팔 하나 (화면 px). (x0,y0) 어깨 → (jx,jy) 팔꿈치 → (x1,y1) 손. wide 는 아랫팔의 굵기 (px).
 * 그림이 아직 안 떴으면 false — 부르는 쪽이 선으로 그린다.
 */
export function drawArmArt(
  ctx: CanvasRenderingContext2D, skin: ArmSkin,
  x0: number, y0: number, jx: number, jy: number, x1: number, y1: number, wide: number,
): boolean {
  const a = ARM[skin]
  const up = sprite(a.upper)
  const fore = sprite(a.fore)
  if (up === null || fore === null) return false
  segment(ctx, up, a.upperCut, x0, y0, jx, jy, wide * a.upperW)
  segment(ctx, fore, 1, jx, jy, x1, y1, wide * a.foreW)
  return true
}

/** 주먹 — 활대를 쥐었다 · 줄을 쥐었다는 못. r 은 반지름 (px). 그림은 손가락이 오른쪽을 본다. */
export function drawFistArt(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, faceLeft: boolean): boolean {
  const im = sprite('limb-fist')
  if (im === null) return false
  const dh = r * 2.3
  const dw = dh * (im.naturalWidth / im.naturalHeight)
  ctx.save()
  ctx.translate(x, y)
  if (faceLeft) ctx.scale(-1, 1)
  ctx.drawImage(im, -dw / 2, -dh / 2, dw, dh)
  ctx.restore()
  return true
}

/**
 * 날아가는 것 — 그림은 전부 **가로로 누워 촉이 오른쪽**이다. 꽁무니에서 촉으로 가는 방향으로 돌려서 그 길이에 맞춰 얹는다.
 * 굵기는 그림의 비율을 따르되 minPx 아래로는 안 내려간다 — 화살은 가늘어서 멀리 당겨 잡은 판에서 실오라기가 된다.
 */
const FLY = {
  basic: 'fly-basic', burst: 'fly-fire', chain: 'fly-whistle', heavy: 'fly-heavy', pierce: 'fly-dart',
} as const

function lying(
  ctx: CanvasRenderingContext2D, im: HTMLImageElement,
  backX: number, backY: number, tipX: number, tipY: number, minPx: number,
): void {
  const len = Math.hypot(tipX - backX, tipY - backY)
  const h = Math.max(minPx, len * (im.naturalHeight / im.naturalWidth))
  ctx.save()
  ctx.translate(backX, backY)
  ctx.rotate(Math.atan2(tipY - backY, tipX - backX))
  ctx.drawImage(im, 0, -h / 2, len, h)
  ctx.restore()
}

/** 내 화살 한 대. kind 에 제 그림이 없으면(세전·산전·연주전·신전) 유엽전 그림을 쓴다. */
export function drawArrowArt(
  ctx: CanvasRenderingContext2D, kind: string, backX: number, backY: number, tipX: number, tipY: number,
): boolean {
  const im = sprite((FLY as Record<string, string>)[kind] ?? FLY.basic)
  if (im === null) return false
  lying(ctx, im, backX, backY, tipX, tipY, 5)
  return true
}

/**
 * 적이 쏜 것 (EnemyShot.look): 0 화살 · 1 돌 · 2 신기전 · 3 혼불 · 4 탄환. long 은 길쭉한 것(방향으로 돌린다),
 * 아니면 둥근 것(size = 지름 px). ★ 날아오는 것은 **보여야 피한다** — 적과 같은 붉은 테를 두른다.
 * 혼불과 탄환은 예전의 빛·꼬리가 곧 가독성이라 그림으로 안 바꾼다 (null).
 */
const SHOT_ART = [
  /* 0 */ { name: 'fly-enemy', long: true, size: 0 },
  /* 1 */ { name: 'fly-stone', long: false, size: 15 },
  /* 2 */ { name: 'fly-rocket', long: true, size: 0 },
  /* 3 */ null,
  /* 4 */ null,
] as const

export function drawShotArt(
  ctx: CanvasRenderingContext2D, look: number, x: number, y: number, dirX: number, dirY: number, lenPx: number, spin: number,
): boolean {
  const c = SHOT_ART[look]
  if (c === undefined || c === null) return false
  const im = sprite(c.name)
  if (im === null) return false
  ctx.save()
  ctx.shadowColor = RIM.color
  ctx.shadowBlur = 6
  if (c.long) {
    lying(ctx, im, x - dirX * lenPx, y - dirY * lenPx, x, y, 6)
  } else {
    ctx.translate(x, y)
    ctx.rotate(spin)
    ctx.drawImage(im, -c.size / 2, -c.size / 2, c.size, c.size * (im.naturalHeight / im.naturalWidth))
  }
  ctx.restore()
  return true
}

/** 과녁의 받침 — 나무 장대. 위(y0)에서 땅(y1)까지 세로로 이어 깐다. wide 는 굵기 (px). */
export function drawPoleArt(ctx: CanvasRenderingContext2D, x: number, y0: number, y1: number, wide: number): boolean {
  const im = sprite('prop-pole')
  if (im === null) return false
  const th = wide * (im.naturalHeight / im.naturalWidth)
  // 땅에서 위로 깐다 — 맨 위 토막은 과녁 뒤에 가려져서 잘려도 안 보인다.
  for (let y = y1 - th; y > y0 - th; y -= th) {
    const top = Math.max(y, y0)
    const cut = (top - y) / th
    ctx.drawImage(im, 0, im.naturalHeight * cut, im.naturalWidth, im.naturalHeight * (1 - cut), x - wide / 2, top, wide, th * (1 - cut))
  }
  return true
}
