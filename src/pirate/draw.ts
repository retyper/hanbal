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

const BASE = (import.meta.env?.BASE_URL ?? '/') + 'realm/'
const imgs = new Map<string, HTMLImageElement>()
function img(path: string): HTMLImageElement | null {
  if (typeof Image === 'undefined') return null
  let im = imgs.get(path)
  if (im === undefined) {
    im = new Image()
    im.src = BASE + path
    imgs.set(path, im)
  }
  return im.complete && im.naturalWidth > 0 ? im : null
}

/** 그림 한 장 한 장의 좌표 — 손맛 노브가 아니다 (render/foeart.ts 머리말과 같은 규칙) */
const ART = {
  sea: 'battle/battle-sea.jpg',
  /** 바닷가 그림에서 모래가 시작되는 줄 (0~1) — 이 줄을 궁수가 딛는 땅에 맞춘다 */
  seaSandV: 0.56,
  /** 칼잡이 — 수군 20컷 띠 (서기 0~3 · 걷기 4~11 · 공격 12~17) · 칸 가로/세로 */
  sword: { file: 'anim2/marine.png', ar: 372 / 160, walk0: 4, walkN: 8, hit0: 12, hitN: 6, tallM: 1.9 },
  /** 두목 — 칼 든 장수 띠 */
  captain: { file: 'anim2/gen-g-sword.png', ar: 150 / 160, walk0: 4, walkN: 8, hit0: 12, hitN: 6, tallM: 2.25 },
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
function seaRect(cam: Camera, im: HTMLImageElement): { x: number; y: number; w: number; h: number } {
  const gy = worldToScreenY(cam, 0)
  const iw = im.naturalWidth
  const ih = im.naturalHeight
  const v = ART.seaSandV
  const s = Math.max(cam.w / iw, gy / (v * ih), (cam.h - gy) / ((1 - v) * ih))
  const w = iw * s
  return { x: (cam.w - w) / 2, y: gy - v * ih * s, w, h: ih * s }
}

function drawPalisade(ctx: CanvasRenderingContext2D, cam: Camera, run: PirateRun, time: number): void {
  const R = P.pirate
  const n = run.livesMax
  const gy = worldToScreenY(cam, 0)
  const s = cam.scale
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

function drawRunner(ctx: CanvasRenderingContext2D, cam: Camera, w: World, t: Target, x: number, captain: boolean): boolean {
  const a = captain ? ART.captain : ART.sword
  const im = img(a.file)
  if (im === null) return false
  const R = P.pirate
  const near = t.x - R.palisadeX < ART.swingM
  const frame = near
    ? a.hit0 + (Math.floor((w.elapsed + t.id * 0.37) * ART.hitFps) % a.hitN)
    : a.walk0 + (Math.floor((R.spawnX + 4 - t.x) / (ART.strideM / a.walkN) + t.id) % a.walkN)
  const soleY = worldToScreenY(cam, 0)
  drawStrip(ctx, im, a.ar, frame, x, soleY, a.tallM * cam.scale, true)
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
  ctx.fillStyle = COL.barrel
  ctx.beginPath()
  ctx.ellipse(x, y, r * 0.78, r, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = COL.barrelBand
  ctx.fillRect(x - r * 0.78, y - r * 0.5, r * 1.56, Math.max(2, r * 0.12))
  ctx.fillRect(x - r * 0.78, y + r * 0.38, r * 1.56, Math.max(2, r * 0.12))
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

export function pirateHooks(run: () => PirateRun | null): SceneHooks {
  return {
    noThreat: true,
    backdrop(ctx, cam): boolean {
      const im = img(ART.sea)
      if (im === null) return false
      const q = seaRect(cam, im)
      ctx.drawImage(im, q.x, q.y, q.w, q.h)
      return true
    },
    ground(ctx, cam, w): void {
      const p = run()
      const gy = worldToScreenY(cam, 0)
      // 활터의 풀밭을 모래로 덮는다 — 같은 그림의 아랫단
      const im = img(ART.sea)
      if (im !== null) {
        const q = seaRect(cam, im)
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
      if (p !== null) drawPalisade(ctx, cam, p, w.tick * w.dt)
    },
    target(ctx, cam, w, t, x, y, rx): boolean {
      const p = run()
      if (p === null) return false
      const role = p.role[t.id]
      if (role === 'anchor') return true
      if (role === 'sword') return drawRunner(ctx, cam, w, t, x, false)
      if (role === 'captain') return drawRunner(ctx, cam, w, t, x, true)
      if (role === 'barrel') { drawCask(ctx, p, t, x, y, rx); return true }
      if (role === 'archer') drawBoat(ctx, cam, x)
      return false
    },
  }
}
