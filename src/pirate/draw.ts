/**
 * 바다도적 막기 — 그리기 (docs/realm/SNIPE.md §0-9). 활터 장면(render/scene.ts)에 갈고리로 끼운다.
 *
 *  - 하늘 자리에 바닷가 그림(realm/battle/battle-sea.jpg) · 물가 너머 물 · 목책
 *  - 칼잡이·두목은 칠십팔국 병사 띠(anim2)를 빌려 그린다 — 받을 그림은 docs/realm/ART-QUEUE.md 맨 위
 *  - 배 궁수는 활터의 적 궁수 그대로 (밑에 배만 깐다) · 궤짝은 나무 궤 + 그 안의 살 그림
 *
 * render 다 — 판(PirateRun·World)을 **읽기만** 한다 (A1). 그림이 아직 없으면 false 를 돌려 활터 그림이 선다.
 */
import { P } from '../tune/params.ts'
import { worldToScreenX, worldToScreenY, type Camera } from '../render/camera.ts'
import { sprite } from '../render/sprites.ts'
import type { SceneHooks } from '../render/scene.ts'
import type { Target, World } from '../sim/types.ts'
import type { PirateRun } from './sim.ts'
import { footY, type Lane } from './waves.ts'

const BASE = (import.meta.env?.BASE_URL ?? '/') + 'realm/'
const imgs = new Map<string, HTMLImageElement>()
/** 못 읽은 그림 — 없는 파일은 한 번 알면 다시 안 묻는다 */
const failed = new Set<string>()
function img(path: string): HTMLImageElement | null {
  if (typeof Image === 'undefined') return null
  let im = imgs.get(path)
  if (im === undefined) {
    im = new Image()
    im.onerror = () => { failed.add(path) }
    im.src = BASE + path
    imgs.set(path, im)
  }
  return im.complete && im.naturalWidth > 0 ? im : null
}
/** 후보 가운데 처음으로 읽힌 그림 — 앞의 것이 아직 오는 중이면 기다리고(null), 없는 파일이면 다음으로 (그림이 나중에 와도 따로 고칠 것 없다) */
function imgFirst(paths: readonly string[]): { im: HTMLImageElement; path: string } | null {
  for (const p of paths) {
    const im = img(p)
    if (im !== null) return { im, path: p }
    if (!failed.has(p)) return null
  }
  return null
}

/** 그림 한 장 한 장의 좌표 — 손맛 노브가 아니다 (render/foeart.ts 머리말과 같은 규칙) */
const ART = {
  sea: 'battle/battle-sea.jpg',
  /** 바닷가 그림에서 모래가 시작되는 줄 (0~1) — 이 줄을 궁수가 딛는 땅에 맞춘다 */
  seaSandV: 0.56,
  /** 칼잡이 — 수군 20컷 띠 (서기 0~3 · 걷기 4~11 · 공격 12~17) · 칸 가로/세로 */
  sword: { file: 'anim2/pirate-sword.png', ar: 153 / 160, walk0: 4, walkN: 8, hit0: 12, hitN: 6, tallM: 1.9 }, // 11-08 제미나이 칼 든 바다도적 20컷 (서기·달리기·칼질·맞음·쓰러짐 · assets_src/realm/gemini/pirate)
  /** 산적 판의 띠 — 산적 그림이 오기 전엔 도적 띠를 빌린다 (imgFirst) */
  banditSword: ['anim2/bandit-club.png', 'anim2/pirate-sword.png'],
  banditChief: ['anim2/bandit-chief.png', 'anim2/pirate-captain.png'],
  /** 산적 띠는 오른쪽을 본다 (도적 띠는 왼쪽) — 칸 가로/세로 · 20컷 차례는 같다 */
  banditAr: { 'anim2/bandit-club.png': 159 / 160, 'anim2/bandit-chief.png': 145 / 160 } as Record<string, number>,
  /** 방패 든 도적 — 방패 든 병사 20컷 띠 (방패가 깨지면 칼잡이 띠로) */
  shield: { file: 'anim2/shield.png', ar: 317 / 160, walk0: 4, walkN: 8, hit0: 12, hitN: 4 },
  /** 산적 판 바탕 — 고갯길 · 땅이 시작되는 줄 (0~1) */
  pass: 'battle/battle-pass.jpg',
  /** 세 길이 그림에 그려진 고갯길 (제미나이 11-12 · 아랫길 흙길 · 가운뎃길 벼랑 턱 · 윗길 능선) */
  passLanes: 'battle/battle-pass-lanes.jpg',
  passGroundV: 0.722,
  /** 두목 — 칼 든 장수 띠 */
  captain: { file: 'anim2/pirate-captain.png', ar: 143 / 160, walk0: 4, walkN: 8, hit0: 12, hitN: 6, tallM: 2.25 },
  /** 배 · 떠 오는 궤짝 그림 (제미나이 11-08 · assets_src/realm/gemini/pirate) — 못 읽으면 코드로 그린 꼴 */
  boat: 'pirate/boat.png',
  /** 목책 한 칸 — 멀쩡 · 부서짐 (제미나이 11-10 · 같은 틀 · 버팀목이 궁수 쪽) · 형: "개짜치게 만든 나무방패는 제미나이 이미지로" */
  palisade: ['pirate/palisade-0.png', 'pirate/palisade-1.png'],
  /** 목책 그림 높이 (m) · 그림 가로/세로 */
  palisadeTallM: 1.6,
  palisadeAr: 479 / 300,
  crate: 'pirate/crate.png',
  /** 걸음 한 바퀴(컷 여덟)가 디디는 거리 (m) */
  strideM: 1.6,
  /** 공격 컷이 넘어가는 빠르기 (컷/초) */
  hitFps: 10,
  /** 목책에 이만큼 다가오면 칼을 휘두른다 (m) */
  swingM: 1.4,
} as const

const COL = {
  water: 'rgba(38, 92, 110, 0.78)',
  waterDeep: 'rgba(18, 52, 70, 0.9)',
  foam: 'rgba(235, 244, 240, 0.85)',
  log: '#6b4a2b',
  logDark: '#3f2a16',
  logTip: '#a27c52',
  rope: '#c9b48a',
  broken: '#2d2115',
  hull: '#4a3320',
  hullTop: '#7a5634',
  barrel: '#7c5530',
  barrelBand: '#2e2418',
  glow: 'rgba(255, 214, 120, 0.55)',
  ring: '#f0c86a',
  hp: '#e2493a',
  hpBack: 'rgba(0,0,0,0.55)',
} as const

/** 바닷가 그림을 모래 줄이 땅에 오게 덮어 그리는 자리 (화면 꽉 · 찌그러짐 없이) */
function seaRect(cam: Camera, im: HTMLImageElement, v: number = ART.seaSandV): { x: number; y: number; w: number; h: number } {
  const gy = worldToScreenY(cam, 0)
  const iw = im.naturalWidth
  const ih = im.naturalHeight
  const s = Math.max(cam.w / iw, gy / (v * ih), (cam.h - gy) / ((1 - v) * ih))
  const w = iw * s
  return { x: (cam.w - w) / 2, y: gy - v * ih * s, w, h: ih * s }
}

function drawPalisade(ctx: CanvasRenderingContext2D, cam: Camera, run: PirateRun, time: number): void {
  const R = P.pirate
  const n = run.livesMax
  const gy = worldToScreenY(cam, 0)
  const s = cam.scale
  const pic0 = img(ART.palisade[0])
  const pic1 = img(ART.palisade[1])
  if (pic0 !== null && pic1 !== null) {
    // 그림 목책 한 채 — 칸마다 그리면 0.66m 사이로 겹쳐 통나무 더미가 된다. 맞을 때마다 흔들리고, 절반 넘게 부서지면 부서진 그림
    const dh = ART.palisadeTallM * s
    const dw = dh * ART.palisadeAr
    let lost = 0
    let since = 99
    for (let k = 0; k < n; k++) if (run.brokeAt[k]! >= 0) { lost++; since = Math.min(since, time - run.brokeAt[k]!) }
    const shake = since < 0.35 ? Math.sin(since * 80) * 4 : 0
    const cx = worldToScreenX(cam, R.palisadeX - 0.05 - (n - 1) * 0.33) + shake
    ctx.drawImage(lost * 2 > n ? pic1 : pic0, cx - dw / 2, gy - dh * 0.97, dw, dh)
    return
  }
  const logW = 0.2 * s
  const tall = 1.55 * s
  // 칸마다 통나무 셋 — 앞(오른쪽)부터 부서진다
  for (let k = 0; k < n; k++) {
    const broke = run.brokeAt[k]! >= 0
    const since = broke ? time - run.brokeAt[k]! : 99
    const shake = since < 0.35 ? Math.sin(since * 80) * 3 : 0
    const cx = worldToScreenX(cam, R.palisadeX - 0.05 - k * 0.66) + shake
    for (let j = 0; j < 3; j++) {
      const x = cx - logW * 1.5 + j * logW
      const h = broke ? tall * (0.22 + 0.12 * ((j * 7 + k * 3) % 3)) : tall * (0.94 + 0.06 * ((j + k) % 2))
      ctx.fillStyle = broke ? COL.broken : COL.log
      ctx.fillRect(x, gy - h, logW - 1, h)
      ctx.fillStyle = broke ? COL.logDark : COL.logTip
      ctx.beginPath()
      // 뾰족한 끝 · 부서진 것은 깨진 끝
      if (broke) {
        ctx.moveTo(x, gy - h)
        ctx.lineTo(x + logW * 0.3, gy - h - logW * 0.5)
        ctx.lineTo(x + logW * 0.6, gy - h - logW * 0.15)
        ctx.lineTo(x + logW - 1, gy - h - logW * 0.45)
        ctx.lineTo(x + logW - 1, gy - h)
      } else {
        ctx.moveTo(x, gy - h)
        ctx.lineTo(x + (logW - 1) / 2, gy - h - logW * 0.9)
        ctx.lineTo(x + logW - 1, gy - h)
      }
      ctx.closePath()
      ctx.fill()
    }
    if (!broke) {
      ctx.fillStyle = COL.rope
      ctx.fillRect(cx - logW * 1.6, gy - tall * 0.62, logW * 3.2, Math.max(2, s * 0.06))
    }
  }
}

/** 띠 한 컷을 발이 땅에 닿게 그린다 — 그림은 오른쪽을 본다 · 도적은 왼쪽(궁수)을 본다 */
function drawStrip(ctx: CanvasRenderingContext2D, im: HTMLImageElement, ar: number, frame: number, cx: number, soleY: number, tallPx: number, faceLeft: boolean): void {
  ctx.imageSmoothingQuality = 'high' // 줄여 그리는 몸 그림은 높은 품질로 (11-12 형: 유닛이 흐리다)
  const ch = im.naturalHeight
  const cw = ch * ar
  const dh = tallPx
  const dw = dh * ar
  ctx.save()
  ctx.translate(cx, soleY)
  if (faceLeft) ctx.scale(-1, 1)
  ctx.drawImage(im, frame * cw, 0, cw, ch, -dw / 2, -dh, dw, dh)
  ctx.restore()
}

function drawRunner(ctx: CanvasRenderingContext2D, cam: Camera, w: World, t: Target, x: number, captain: boolean, bandit: boolean, shielded = false, p: PirateRun | null = null): boolean {
  let a: { readonly ar: number; readonly walk0: number; readonly walkN: number; readonly hit0: number; readonly hitN: number; readonly tallM: number } = captain ? ART.captain : ART.sword
  let im: HTMLImageElement | null
  let flip = false // 오른쪽을 보는 띠는 뒤집어야 궁수 쪽으로 달려온다
  const broken = !shielded && !captain && t.kind === 'archer' // 방패가 깨진 도적 — 칼잡이 띠로
  if (shielded) {
    im = img(ART.shield.file)
    a = { ...ART.shield, tallM: P.pirate.shieldTallM }
    flip = true
  } else if (bandit) {
    const got = imgFirst(captain ? ART.banditChief : ART.banditSword)
    im = got === null ? null : got.im
    const ar = got === null ? undefined : ART.banditAr[got.path]
    if (ar !== undefined) { a = { ...a, ar }; flip = true }
  } else im = img(captain ? ART.captain.file : ART.sword.file)
  if (im === null) return false
  if (broken) a = { ...a, tallM: P.pirate.shieldTallM }
  const R = P.pirate
  const near = t.x - R.palisadeX < ART.swingM
  const frame = near
    ? a.hit0 + (Math.floor((w.elapsed + t.id * 0.37) * ART.hitFps) % a.hitN)
    : a.walk0 + (Math.floor((R.spawnX + 4 - t.x) / (ART.strideM / a.walkN) + t.id) % a.walkN)
  const lane: Lane = bandit ? (p?.lane[t.id] ?? 0) : 0
  const soleY = worldToScreenY(cam, bandit ? footY(lane, t.x) : 0)
  drawStrip(ctx, im, a.ar, frame, x, soleY, a.tallM * cam.scale, flip) // 도적 띠는 왼쪽(궁수)을 보고 그렸다 · 산적·방패 띠는 오른쪽이라 뒤집는다 (형 11-10)
  if (captain && t.hpMax > 0) {
    // 두목의 남은 몸 — 머리 위 한 줄
    const bw = Math.max(36, t.r * 1.6 * cam.scale)
    const by = soleY - a.tallM * cam.scale - 10
    ctx.fillStyle = COL.hpBack
    ctx.fillRect(x - bw / 2 - 1, by - 1, bw + 2, 7)
    ctx.fillStyle = COL.hp
    ctx.fillRect(x - bw / 2, by, bw * Math.max(0, t.hp / t.hpMax), 5)
  }
  return true
}

function drawBoat(ctx: CanvasRenderingContext2D, cam: Camera, x: number): void {
  const R = P.pirate
  const s = cam.scale
  const gy = worldToScreenY(cam, 0)
  const deck = worldToScreenY(cam, R.boatDeck)
  const half = 1.3 * s
  const pic = img(ART.boat)
  if (pic !== null) {
    // 배 그림 — 물에 잠긴 줄(gy)이 배 밑 1/6 쯤에 오게 · 갑판 높이(deck)까지 뱃전이 닿는다
    const dw = half * 2.6
    const dh = dw * pic.naturalHeight / pic.naturalWidth
    ctx.drawImage(pic, x - dw / 2, gy + dh * 0.16 - dh, dw, dh)
    return
  }
  ctx.fillStyle = COL.hull
  ctx.beginPath()
  ctx.moveTo(x - half * 1.25, deck)
  ctx.lineTo(x + half * 1.15, deck - 0.15 * s)
  ctx.lineTo(x + half * 0.8, gy + 0.1 * s)
  ctx.lineTo(x - half * 0.85, gy + 0.1 * s)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = COL.hullTop
  ctx.fillRect(x - half * 1.2, deck - 0.08 * s, half * 2.3, 0.1 * s)
}

function drawCask(ctx: CanvasRenderingContext2D, run: PirateRun, t: Target, x: number, y: number, r: number): void {
  const pulse = 0.5 + 0.5 * Math.sin(run.w.elapsed * 6)
  ctx.fillStyle = COL.glow
  ctx.globalAlpha = 0.35 + 0.4 * pulse
  ctx.beginPath()
  ctx.arc(x, y, r * 1.45, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1
  const pic = img(ART.crate)
  if (pic !== null) {
    // 궤짝 그림 — 화살 묶음이 비죽한 나무 궤 · 맞는 둥근 자리(r)에 몸통을 맞춘다
    const dh = r * 2.3
    const dw = dh * pic.naturalWidth / pic.naturalHeight
    ctx.drawImage(pic, x - dw / 2, y - dh * 0.58, dw, dh)
  } else {
    ctx.fillStyle = COL.barrel
    ctx.beginPath()
    ctx.ellipse(x, y, r * 0.78, r, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = COL.barrelBand
    ctx.fillRect(x - r * 0.78, y - r * 0.5, r * 1.56, Math.max(2, r * 0.12))
    ctx.fillRect(x - r * 0.78, y + r * 0.38, r * 1.56, Math.max(2, r * 0.12))
  }
  // 무엇이 들었나 — 그 살의 그림을 궤짝 위에 크게
  const kind = run.barrelArrow[t.id] ?? 'pierce'
  const im = sprite(`arrow-${kind}`)
  if (im !== null) {
    const sz = r * 2.1
    const bx = x
    const by = y - r - sz * 0.45
    ctx.save()
    ctx.beginPath()
    ctx.arc(bx, by, sz / 2, 0, Math.PI * 2)
    ctx.clip()
    ctx.drawImage(im, bx - sz / 2, by - sz / 2, sz, sz)
    ctx.restore()
    ctx.strokeStyle = COL.ring
    ctx.lineWidth = Math.max(1.5, r * 0.12)
    ctx.beginPath()
    ctx.arc(bx, by, sz / 2, 0, Math.PI * 2)
    ctx.stroke()
  }

}

/** 장면 갈고리 — run() 은 지금 판을 돌려준다 (판이 바뀌어도 같은 갈고리) */
/** 물 그라디언트 — 물가의 화면 자리가 바뀔 때만 다시 굽는다 (프레임당 할당 0, A5) */
let waterGrad: CanvasGradient | null = null
let waterKey = -1

/**
 * 산적 판의 가만히 선 그림 한 장 — 고갯길 그림 + 세 길(흙길) + 목책 그늘 + 위아래 어둠.
 * 크기·구도가 바뀔 때만 다시 굽는다 (프레임당 gradient·큰 그림 0 — 겨루기와 같은 길). 흔들림은 그릴 때 밀어서 준다.
 */
const BAKE = { margin: 16 } as const
const PATH = {
  /** 길은 그림에 그려져 있다 — 코드는 발자국·그늘만 옅게 (알파 0.2 이하) · 다짐길 — 배경 위에 얹는 반투명 어두운 흙 (곱하기 느낌) · 윗면 밝은 흙 얇게 · 벼랑 턱 아래만 그늘 */
  earth: 'rgba(86, 56, 28, 0.14)', lip: 'rgba(240, 212, 160, 0.12)', shade: 'rgba(24, 16, 8, 0.18)', shadeDeep: 'rgba(24, 16, 8, 0.1)',
  rut: 'rgba(52, 34, 16, 0.18)', grass: 'rgba(96, 108, 44, 0.18)', stone: 'rgba(150, 140, 124, 0.18)', stoneDark: 'rgba(60, 50, 40, 0.18)',
  /** 길 흙 두께 · 윗단 두께 · 벼랑 그늘 깊이 (m) */
  thick: 0.36, lipH: 0.09, shadeH: 0.95, groundThick: 0.45,
} as const
let bakeC: HTMLCanvasElement | null = null
let bakeKey = ''

const STEP = 0.25

/** 길의 윗선을 따라 x0→x1 간 뒤 dy(m) 아래 선을 거꾸로 돌아와 닫은 조각을 칠한다 */
function bandFill(ctx: CanvasRenderingContext2D, cam: Camera, lane: Lane, x0: number, x1: number, dyTop: number, dyBot: number, style: string): void {
  ctx.fillStyle = style
  ctx.beginPath()
  for (let x = x0; x <= x1 + 1e-6; x += STEP) {
    const px = worldToScreenX(cam, x)
    const py = worldToScreenY(cam, footY(lane, x) + dyTop)
    if (x === x0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  // 아랫선은 울퉁불퉁 — 깎아 낸 흙 벼랑 (위치만의 함수라 늘 같은 모양)
  for (let x = x1; x >= x0 - 1e-6; x -= STEP) ctx.lineTo(worldToScreenX(cam, x), worldToScreenY(cam, footY(lane, x) + dyBot + (dyBot < -0.1 ? (Math.sin(x * 5.3) * 0.5 + Math.sin(x * 12.1 + 1) * 0.5) * 0.09 : 0)))
  ctx.closePath()
  ctx.fill()
}

/** 길 한 줄 — 얹는 흙띠 + 풀 경계 + 바퀴자국·발자국 점 + 돌. ledge 면 아래에만 벼랑 그늘이 진다 */
function dirtBand(ctx: CanvasRenderingContext2D, cam: Camera, lane: Lane, x0: number, x1: number, ledge: boolean): void {
  const th = ledge ? PATH.thick : PATH.groundThick
  if (ledge) {
    bandFill(ctx, cam, lane, x0, x1, -0.04, -PATH.shadeH, PATH.shadeDeep)
    bandFill(ctx, cam, lane, x0, x1, -0.04, -PATH.shadeH * 0.5, PATH.shade)
  }
  bandFill(ctx, cam, lane, x0, x1, 0.02, -th, PATH.earth)
  bandFill(ctx, cam, lane, x0, x1, 0.04, -PATH.lipH, PATH.lip)
  // 바퀴자국 둘 — 점선 (위치만의 함수)
  for (let r = 0; r < 2; r++) {
    ctx.fillStyle = PATH.rut
    for (let x = x0 + (r * 0.37) % 0.7; x < x1; x += 0.7) {
      ctx.fillRect(worldToScreenX(cam, x), worldToScreenY(cam, footY(lane, x) - th * (0.38 + r * 0.3)), 0.34 * cam.scale, 1.6)
    }
  }
  // 발자국 점
  ctx.fillStyle = PATH.rut
  for (let i = 0; i < 40; i++) {
    const x = x0 + ((i * 0.6180339) % 1) * (x1 - x0)
    const y = footY(lane, x) - th * (0.15 + ((i * 0.7548776) % 1) * 0.6)
    ctx.beginPath()
    ctx.ellipse(worldToScreenX(cam, x), worldToScreenY(cam, y), 2.2, 1.3, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  // 풀 경계 — 아랫가장자리에 들쭉날쭉 풀 (배경과 섞이게)
  ctx.strokeStyle = PATH.grass
  ctx.lineWidth = 1.4
  ctx.beginPath()
  for (let x = x0; x < x1; x += 0.16) {
    const px = worldToScreenX(cam, x)
    const py = worldToScreenY(cam, footY(lane, x) - th + 0.02 + (Math.sin(x * 5.3) * 0.5 + Math.sin(x * 12.1 + 1) * 0.5) * 0.09)
    const h = (2 + ((x * 37) % 3)) * (cam.scale / 40)
    ctx.moveTo(px, py)
    ctx.lineTo(px + (((x * 53) % 2) - 1) * 2, py - h * 2)
  }
  ctx.stroke()
  // 돌 몇 개
  for (let i = 0; i < 12; i++) {
    const x = x0 + ((i * 0.6180339 + 0.2) % 1) * (x1 - x0)
    const y = footY(lane, x) - th * (0.25 + ((i * 0.7548776) % 1) * 0.5)
    const rr = (0.03 + ((i * 3) % 4) * 0.015) * cam.scale
    const px = worldToScreenX(cam, x)
    const py = worldToScreenY(cam, y)
    ctx.fillStyle = PATH.stoneDark
    ctx.beginPath()
    ctx.ellipse(px + 1, py + 1, rr * 1.3, rr * 0.8, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = PATH.stone
    ctx.beginPath()
    ctx.ellipse(px, py, rr * 1.3, rr * 0.8, 0, 0, Math.PI * 2)
    ctx.fill()
  }
}

function bakeBandit(cam: Camera, im: HTMLImageElement): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null
  const key = [cam.w, cam.h, cam.dpr, Math.round(cam.scale * 100), Math.round(cam.x * 100), Math.round(cam.y * 100)].join(',')
  if (bakeC !== null && key === bakeKey) return bakeC
  const m = BAKE.margin
  const c = bakeC ?? document.createElement('canvas')
  c.width = Math.round((cam.w + m * 2) * cam.dpr)
  c.height = Math.round((cam.h + m * 2) * cam.dpr)
  const g = c.getContext('2d')
  if (g === null) return null
  g.setTransform(cam.dpr, 0, 0, cam.dpr, m * cam.dpr, m * cam.dpr)
  g.imageSmoothingEnabled = true
  g.imageSmoothingQuality = 'high'
  const c0: Camera = { ...cam, shakeX: 0, shakeY: 0 }
  // 바탕 그림 — 마진까지 덮는다
  g.fillStyle = '#2a2418'
  g.fillRect(-m, -m, cam.w + m * 2, cam.h + m * 2)
  const q = seaRect(c0, im, ART.passGroundV)
  g.drawImage(im, q.x, q.y, q.w, q.h)
  const gy = worldToScreenY(c0, 0)
  const xr = c0.x + (cam.w / 2 + m) / cam.scale
  const R = P.pirate
  const wide = cam.w + m * 2
  // 아랫길 — 땅 줄에 얇게 얹은 다짐길 (화면 높이의 6% 이하)
  dirtBand(g, c0, 0, c0.x - (cam.w / 2 + m) / cam.scale - 1, xr + 1, false)
  dirtBand(g, c0, 1, R.palisadeX, xr + 1, true)
  dirtBand(g, c0, 2, R.midDropX, xr + 1, true)
  void wide
  void gy
  // 목책 그늘
  g.fillStyle = 'rgba(20, 12, 4, 0.4)'
  g.beginPath()
  g.ellipse(worldToScreenX(c0, R.palisadeX - 0.4), gy + 0.18 * cam.scale, 1.5 * cam.scale, 0.2 * cam.scale, 0, 0, Math.PI * 2)
  g.fill()
  // 위·아래 어둠 — 그림이 장면(무대)으로 읽히게
  const top = g.createLinearGradient(0, -m, 0, cam.h * 0.28)
  top.addColorStop(0, 'rgba(8, 6, 4, 0.55)')
  top.addColorStop(1, 'rgba(8, 6, 4, 0)')
  g.fillStyle = top
  g.fillRect(-m, -m, wide, cam.h * 0.28 + m)
  const bot = g.createLinearGradient(0, cam.h * 0.82, 0, cam.h + m)
  bot.addColorStop(0, 'rgba(8, 6, 4, 0)')
  bot.addColorStop(1, 'rgba(8, 6, 4, 0.5)')
  g.fillStyle = bot
  g.fillRect(-m, cam.h * 0.82, wide, cam.h * 0.18 + m)
  bakeC = c
  bakeKey = key
  return c
}

/** 목책 곁 횃불 둘 — 불꽃만 움직인다 (판의 시계로) */
function drawTorches(ctx: CanvasRenderingContext2D, cam: Camera, t: number): void {
  const R = P.pirate
  const fire = img('fx/fire.png')
  const gy = worldToScreenY(cam, 0)
  for (let i = 0; i < 2; i++) {
    const x = worldToScreenX(cam, R.palisadeX + 0.3 + i * 0.9)
    const h = (1.7 + i * 0.25) * cam.scale
    ctx.fillStyle = COL.logDark
    ctx.fillRect(x - 2, gy - h, 4, h)
    ctx.fillStyle = COL.logTip
    ctx.fillRect(x - 3, gy - h, 6, 5)
    if (fire !== null) {
      const f = 0.85 + 0.15 * Math.sin(t * 11 + i * 2.4)
      const sz = 0.95 * cam.scale * f
      ctx.drawImage(fire, x - sz / 2, gy - h - sz * 0.85, sz, sz)
    }
  }
}

export function pirateHooks(run: () => PirateRun | null): SceneHooks {
  const bandit = (): boolean => run()?.mode === 'bandit'
  return {
    noThreat: true,
    get ownGround(): boolean { return bandit() },
    lift(_w, t): number {
      const p = run()
      if (p === null || p.mode !== 'bandit') return 0
      const r = p.role[t.id]
      return r === 'sword' || r === 'shield' || r === 'captain' ? footY(p.lane[t.id] ?? 0, t.x) : 0
    },
    backdrop(ctx, cam): boolean {
      const b = bandit()
      const im = img(b ? ART.passLanes : ART.sea)
      if (im === null) return false
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      if (b) {
        const c = bakeBandit(cam, im)
        if (c !== null) {
          ctx.drawImage(c, cam.shakeX - BAKE.margin, cam.shakeY - BAKE.margin, cam.w + BAKE.margin * 2, cam.h + BAKE.margin * 2)
          return true
        }
      }
      const q = seaRect(cam, im, b ? ART.passGroundV : ART.seaSandV)
      ctx.drawImage(im, q.x, q.y, q.w, q.h)
      return true
    },
    ground(ctx, cam, w): void {
      const p = run()
      const gy = worldToScreenY(cam, 0)
      const b = bandit()
      if (!b) {
        // 활터의 풀밭을 모래로 덮는다 — 같은 그림의 아랫단
        const im = img(ART.sea)
        if (im !== null) {
          const q = seaRect(cam, im, ART.seaSandV)
          const top = gy - 3
          const sy = ((top - q.y) / q.h) * im.naturalHeight
          ctx.drawImage(im, 0, sy, im.naturalWidth, im.naturalHeight - sy, q.x, top, q.w, q.y + q.h - top)
        }
        // 물가 너머는 물 — 도적이 물에서 걸어 나온다
        const R = P.pirate
        const sx = worldToScreenX(cam, R.shoreX)
        if (sx < cam.w) {
          // 물은 땅 줄 아래 얕은 띠 — 아래로 갈수록 그림(젖은 모래)이 비친다
          const deep = 0.9 * cam.scale
          if (waterGrad === null || waterKey !== gy * 10000 + deep) {
            waterGrad = ctx.createLinearGradient(0, gy - 2, 0, gy + deep)
            waterGrad.addColorStop(0, COL.water)
            waterGrad.addColorStop(1, 'rgba(38, 92, 110, 0)')
            waterKey = gy * 10000 + deep
          }
          ctx.fillStyle = waterGrad
          ctx.fillRect(sx, gy - 2, cam.w - sx, deep + 2)
          // 물결 거품 — 물가에서 밀려왔다 빠진다
          const surge = Math.sin(w.elapsed * 1.3) * 0.35 * cam.scale
          ctx.fillStyle = COL.foam
          ctx.fillRect(sx - 0.2 * cam.scale + surge, gy - 2, 0.5 * cam.scale, 3)
          for (let i = 0; i < 4; i++) {
            const fx = sx + ((i * 0.27 + w.elapsed * 0.06) % 1) * (cam.w - sx)
            ctx.globalAlpha = 0.5
            ctx.fillRect(fx, gy + 3 + i * 4, 0.6 * cam.scale, 2)
          }
          ctx.globalAlpha = 1
        }
        // 땅 줄 — 발이 디딜 자리
        ctx.fillStyle = 'rgba(40, 30, 20, 0.35)'
        ctx.fillRect(0, gy - 1, Math.min(cam.w, sx), 2)
      }
      if (p !== null) drawPalisade(ctx, cam, p, w.tick * w.dt)
      if (b) drawTorches(ctx, cam, w.tick * w.dt)
    },
    target(ctx, cam, w, t, x, y, rx): boolean {
      const p = run()
      if (p === null) return false
      const role = p.role[t.id]
      if (role === 'anchor') return true
      const b = p.mode === 'bandit'
      if (role === 'sword') return drawRunner(ctx, cam, w, t, x, false, b, false, p)
      if (role === 'shield') return drawRunner(ctx, cam, w, t, x, false, b, t.armored, p)
      if (role === 'captain') return drawRunner(ctx, cam, w, t, x, true, b, false, p)
      if (role === 'barrel') { drawCask(ctx, p, t, x, y, rx); return true }
      if (role === 'archer') { if (!b) drawBoat(ctx, cam, x) }
      return false
    },
  }
}
