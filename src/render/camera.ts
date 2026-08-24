/**
 * 카메라 — 월드(m, y 위쪽 +) ↔ 화면(px, y 아래쪽 +) 변환이 일어나는 유일한 장소.
 *
 * ARCHITECTURE A1: 여기는 render 레이어다. World를 읽기만 한다.
 * 흔들림·줌 같은 연출 상태는 sim에 넣지 않고 Camera 내부(비공개 필드)에 둔다.
 */
import { TAU, clamp, damp } from '../core/math.ts'
import { P } from '../tune/params.ts'
import type { World } from '../sim/types.ts'

export interface Camera {
  /** 화면 정중앙이 가리키는 월드 좌표 (m) */
  x: number
  y: number
  /** px per meter */
  scale: number
  /** 화면 공간 흔들림 오프셋 (px) */
  shakeX: number
  shakeY: number
  /** CSS 픽셀 기준 뷰포트 크기. 실제 백버퍼는 여기에 dpr을 곱한 크기다. */
  w: number
  h: number
  dpr: number
}

/**
 * 렌더 레이어 공통 팔레트 (GDD 8장 — 다크 모드 기본, 강조색은 과녁·궤적에만).
 * 파일 소유가 나뉘어 palette.ts를 새로 만들 수 없어, 렌더 레이어의 유일한 leaf인 여기에 둔다.
 */
export const THEME = {
  sky0: '#0b0e13',
  sky1: '#1a222c',
  ridgeFar: '#141b24',
  ridgeNear: '#0e141b',
  ground: '#080b0f',
  groundLine: '#28313c',
  body: '#c9d2dc',
  bodyDim: '#79838f',
  bow: '#d9cba6',
  bowWarn: '#ff6a45',
  string: '#8d97a3',
  accent: '#ffb347',
  accentDim: '#8a5f28',
  target2: '#e8eef5',
  trailHit: '#ffd88f',
  trailMiss: '#69747f',
  arrow: '#e3e9f0',
  hudDim: '#69737f',
  hudText: '#b9c3cf',
  gauge: '#5fb0a5',
  gaugeWarn: '#ff6a45',
  gaugeBack: '#1d232b',

  // ── 과녁의 살 (GDD 8장: 색 수는 늘리지 않는다 — 이미 있는 셋을 띠로 나눠 쓴다) ──
  /** 과녁 바깥 테. 어두운 하늘에서 과녁을 **찾을 수 있게** 하는 유일한 밝은 면이다. */
  targetRim: '#e8eef5',
  /** 테와 강조 사이의 어두운 띠. 이게 있어야 링이 링으로 보인다. */
  targetBand: '#121820',
  /** 지면에 세운 기둥 / 이동 과녁의 레일. 있는 줄도 모를 만큼 어둡게. */
  prop: '#1b232d',

  // ── 바람 (지금까지 화면에 없던 것) ──
  windPole: '#3a4756',
  windCloth: '#c96f4a',

  // ── 하늘과 땅의 결 ──
  star: '#4e5c6e',
  moon: '#cbd6e4',
  grass: '#131c24',
} as const

/**
 * 화면 구도 상수 (픽셀·화면 비율 — params.ts는 m/s/rad만 담기로 한 규약이라 여기 둔다).
 * 손맛에 직결되는 값은 전부 P에서 읽는다.
 */
const VIEW = {
  /** 화면 가장자리 여백 비율 */
  margin: 0.12,
  minScale: 8,
  maxScale: 110,
  /** 화살 포물선이 잘리지 않도록 위로 확보하는 높이 (m) */
  arcHeadroom: 5.5,
  /** 지면 아래 여유 (m) */
  belowGround: 0.6,
  /** 궁수 뒤쪽 여유 (m) */
  behindArcher: 2.4,
  /** 구도 추종 감쇠 계수 (/s) */
  followRate: 5,
  /** 흔들림 노이즈 주파수 (Hz) */
  shakeFreq: 34,
  /** 폭발이 명중보다 몇 배로 흔드는가. 소리·불덩이와 같은 순간에 온다. */
  burstShakeMul: 2.4,
  /** 대형 연쇄에서 잠깐 줌아웃하는 비율 (GDD 7장) */
  chainZoomOut: 0.05,
  /** 이 깊이 이상의 연쇄부터 줌아웃 */
  chainZoomDepth: 2,
  chainZoomDecay: 2.2,
  /** 레티나에서 4배 픽셀을 칠하면 A5 예산을 넘는다 */
  dprCap: 2,
} as const

/** 공개 계약에 없는 연출 상태. createCamera가 항상 이 형태로 만들므로 캐스팅이 안전하다. */
interface CameraX extends Camera {
  tx: number
  ty: number
  ts: number
  shakeAmp: number
  shakeAge: number
  zoomOut: number
  framed: boolean
  lastTick: number
}

export function createCamera(): Camera {
  const c: CameraX = {
    x: 0, y: 0, scale: 40,
    shakeX: 0, shakeY: 0,
    w: 1, h: 1, dpr: 1,
    tx: 0, ty: 0, ts: 40,
    shakeAmp: 0, shakeAge: 0,
    zoomOut: 0,
    framed: false,
    lastTick: -1,
  }
  return c
}

export function resizeCamera(cam: Camera, canvas: HTMLCanvasElement): void {
  const dpr = clamp(globalThis.devicePixelRatio || 1, 1, VIEW.dprCap)
  // 레이아웃 전이면 client 크기가 0이다. 0으로 나누면 이후 전 좌표가 NaN이 된다.
  const cw = canvas.clientWidth > 0 ? canvas.clientWidth : canvas.width
  const ch = canvas.clientHeight > 0 ? canvas.clientHeight : canvas.height
  const nw = cw > 0 ? cw : 1
  const nh = ch > 0 ? ch : 1
  // 게임 루프가 매 프레임 부른다. 값이 그대로면 아무것도 하지 않아야 한다 —
  // 여기서 구도를 매번 리셋하면 카메라가 영원히 스냅만 하고 부드럽게 따라가지 못한다.
  if (nw === cam.w && nh === cam.h && dpr === cam.dpr) return
  cam.w = nw
  cam.h = nh
  cam.dpr = dpr
  const bw = Math.round(nw * dpr)
  const bh = Math.round(nh * dpr)
  // 같은 값을 다시 쓰면 브라우저가 백버퍼를 통째로 재할당한다.
  if (canvas.width !== bw) canvas.width = bw
  if (canvas.height !== bh) canvas.height = bh
  const cx = cam as CameraX
  cx.framed = false
}

/** 구도: 궁수 + 스테이지에 정의된 모든 과녁이 여유를 두고 들어와야 한다. */
function frame(cam: CameraX, w: World): void {
  const a = w.archer
  let minX = a.x - VIEW.behindArcher
  let maxX = a.x + VIEW.behindArcher
  let minY = -VIEW.belowGround
  let maxY = a.y + VIEW.arcHeadroom

  // 살아있는 과녁이 아니라 stage 정의를 쓴다. 과녁이 깨질 때마다 화면이 줌인되면 조준이 흔들린다.
  const specs = w.stage.targets
  for (let i = 0; i < specs.length; i++) {
    const s = specs[i]
    if (s === undefined) continue
    const r = s.r ?? 0.5
    const ax = s.ampX ?? 0
    const ay = s.ampY ?? 0
    if (s.x - r - ax < minX) minX = s.x - r - ax
    if (s.x + r + ax > maxX) maxX = s.x + r + ax
    if (s.y - r - ay < minY) minY = s.y - r - ay
    if (s.y + r + ay + VIEW.arcHeadroom > maxY) maxY = s.y + r + ay + VIEW.arcHeadroom
  }

  const spanX = Math.max(maxX - minX, 1)
  const spanY = Math.max(maxY - minY, 1)
  const availW = cam.w * (1 - VIEW.margin * 2)
  const availH = cam.h * (1 - VIEW.margin * 2)
  const fit = Math.min(availW / spanX, availH / spanY)
  cam.ts = clamp(fit, VIEW.minScale, VIEW.maxScale)
  cam.tx = (minX + maxX) * 0.5
  cam.ty = (minY + maxY) * 0.5
}

export function updateCamera(cam: Camera, w: World, dtReal: number): void {
  const cx = cam as CameraX
  frame(cx, w)

  if (!cx.framed) {
    // 첫 프레임에 스르륵 밀려들어오면 C1(3초 안에 첫 발)을 방해한다. 즉시 확정한다.
    cx.x = cx.tx
    cx.y = cx.ty
    cx.scale = cx.ts
    cx.framed = true
  } else {
    cx.x = damp(cx.x, cx.tx, VIEW.followRate, dtReal)
    cx.y = damp(cx.y, cx.ty, VIEW.followRate, dtReal)
    cx.scale = damp(cx.scale, cx.ts * (1 - cx.zoomOut), VIEW.followRate, dtReal)
  }

  // 이벤트는 읽기만 한다. 비우는 건 게임 루프의 몫이다.
  // 같은 tick을 두 번 그리면 흔들림이 이중으로 걸리므로 tick으로 가드한다.
  if (w.tick !== cx.lastTick) {
    cx.lastTick = w.tick
    const ev = w.events
    for (let i = 0; i < ev.length; i++) {
      const e = ev[i]
      if (e === undefined) continue
      if (e.t === 'hit') {
        cx.shakeAmp = P.hit.shakeAmp
        cx.shakeAge = 0
      } else if (e.t === 'burst') {
        // 폭발은 명중보다 크게 흔든다. 이게 "터졌다"의 몸으로 오는 신호다.
        cx.shakeAmp = P.hit.shakeAmp * VIEW.burstShakeMul
        cx.shakeAge = 0
      } else if (e.t === 'chain' && e.depth >= VIEW.chainZoomDepth) {
        cx.zoomOut = VIEW.chainZoomOut
      }
    }
  }

  cx.zoomOut = damp(cx.zoomOut, 0, VIEW.chainZoomDecay, dtReal)

  if (cx.shakeAmp > 0) {
    cx.shakeAge += dtReal
    if (cx.shakeAge >= P.hit.shakeCutoff) {
      // ★ 다음 조준을 방해하지 않도록 컷오프에서 강제로 끊는다 (feel-lens).
      cx.shakeAmp = 0
      cx.shakeX = 0
      cx.shakeY = 0
    } else {
      cx.shakeAmp = damp(cx.shakeAmp, 0, P.hit.shakeDecay, dtReal)
      // valueNoise는 호출마다 클로저를 만든다(core/math.ts). 매 프레임 도는 자리라 사인 두 개로 낸다.
      // 서로 나누어떨어지지 않는 주파수라 정직한 사인파처럼 들리지 않고 덜컹거린다.
      const ph = cx.shakeAge * VIEW.shakeFreq * TAU
      cx.shakeX = Math.sin(ph) * cx.shakeAmp
      cx.shakeY = Math.sin(ph * 1.37 + 1.1) * cx.shakeAmp
    }
  } else {
    cx.shakeX = 0
    cx.shakeY = 0
  }
}

export function worldToScreenX(cam: Camera, wx: number): number {
  return (wx - cam.x) * cam.scale + cam.w * 0.5 + cam.shakeX
}

export function worldToScreenY(cam: Camera, wy: number): number {
  return cam.h * 0.5 - (wy - cam.y) * cam.scale + cam.shakeY
}

/**
 * 역변환에는 흔들림을 넣지 않는다.
 * 넣으면 명중 직후 카메라가 떨리는 동안 마우스 조준점까지 같이 떨려서 다음 발을 못 겨눈다.
 */
export function screenToWorldX(cam: Camera, sx: number): number {
  return (sx - cam.w * 0.5) / cam.scale + cam.x
}

export function screenToWorldY(cam: Camera, sy: number): number {
  return (cam.h * 0.5 - sy) / cam.scale + cam.y
}
