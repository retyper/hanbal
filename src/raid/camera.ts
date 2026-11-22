/**
 * 열전 전투판 확대 카메라 (11-19 형: 「돋보기 · 탭 확대 · 탭 더 가까이 · 탭 원래대로 · 확대 중엔 캐릭터가 늘 가운데」) — 화면 쪽 기억만.
 * 판(haebi.ts)은 읽기만 한다: 장수 자리를 읽어 화면 가운데를 정하고, 그리는 쪽(haebi-view drawField)이 이 변환으로 판을 그린다.
 * 판 밖(빈 바탕)이 보이지 않게 맵 끝에서는 가운데가 가장자리에 멈춘다 — 그때만 장수가 가운데에서 비켜난다.
 *
 * 59-WIDE 넓은 맵 (11-22): 부르는 쪽이 지금 설 수 있는 땅(raid/wide.ts fieldBounds)을 넘기면 1배에서도 장수를 따라가고, 걷는 쪽을 조금 앞서 본다.
 * 땅을 안 넘기면(한 장짜리 옛 판) 예전 그대로다 — 1배 이하에서는 판 가운데에 고정.
 */
import { HAEBI_RUN as C, HAEBI_ZOOM as Z, HAEBI_WIDE as WD } from '../tune/params.ts'
import { BOARD, WORLD, type Rect, type WideState } from './wide.ts'

export interface Cam {
  /** 단계 (0 = 1배) */
  level: number
  /** 지금 배율 (단계 배율로 부드럽게 다가간다) · 화면 가운데의 판 좌표 */
  zoom: number; x: number; y: number
  /** 59-WIDE 앞서 보기 — 지금 앞선 만큼(px) · 지난 틀의 장수 자리 (없으면 아직 안 봤다) */
  leadX?: number; leadY?: number; heroX?: number; heroY?: number
}
export const newCam = (level = 0): Cam => ({ level: Math.max(0, Math.min(Z.levels.length - 1, Math.floor(level) || 0)), zoom: 1, x: C.width / 2, y: C.height / 2 })
export const levelZoom = (level: number) => Z.levels[level] ?? 1
/** 다음 단계 — 1배 → 조금 → 가까이 → 1배 … */
export const nextLevel = (level: number) => (level + 1) % Z.levels.length
/** 가장 가까이 — 단추가 되돌리기(돋보기 −)로 바뀐다 */
export const closest = (level: number) => level === Z.levels.length - 1

/** 배율 z 에서 화면 가운데가 갈 수 있는 자리 — 땅(bounds · 기본은 원래 판) 밖이 보이지 않게 · 화면이 땅보다 넓은 축은 땅 가운데에 */
export function clampCenter(z: number, x: number, y: number, bounds: Readonly<Rect> = BOARD) {
  const hw = C.width / (2 * z), hh = C.height / (2 * z)
  return {
    x: bounds.right - bounds.left <= 2 * hw ? (bounds.left + bounds.right) / 2 : Math.min(bounds.right - hw, Math.max(bounds.left + hw, x)),
    y: bounds.bottom - bounds.top <= 2 * hh ? (bounds.top + bounds.bottom) / 2 : Math.min(bounds.bottom - hh, Math.max(bounds.top + hh, y)),
  }
}

/** 장수(hx, hy)를 따라간다 — dt 화면 초 · snap 이면 곧바로 (새 판) · bounds 를 넘기면 그 땅 안에서 따라가며 걷는 쪽을 앞서 본다 (59-WIDE) */
export function followCam(cam: Cam, hx: number, hy: number, dt: number, snap = false, framing?: number, bounds?: Readonly<Rect>) {
  const zt = framing ?? levelZoom(cam.level)
  cam.zoom = snap ? zt : zt + (cam.zoom - zt) * Math.exp(-Z.ease * dt)
  if (Math.abs(cam.zoom - zt) < 1e-3) cam.zoom = zt
  let tx = hx, ty = hy
  if (bounds) {
    // 앞서 보기: 지난 틀부터 움직인 빠르기(장수 걸음 빠르기에 견줘 0~1 · 순간 이동은 1 로 눌린다)만큼 그쪽을 lookAhead px 까지
    const V = WD.view, px = cam.heroX ?? hx, py = cam.heroY ?? hy
    if (snap) { cam.leadX = 0; cam.leadY = 0 }
    else if (dt > 0) {
      const vx = (hx - px) / (dt * C.speed), vy = (hy - py) / (dt * C.speed), v = Math.max(1, Math.hypot(vx, vy)), k = 1 - Math.exp(-V.leadEase * dt)
      cam.leadX = (cam.leadX ?? 0) + (vx / v * V.lookAhead - (cam.leadX ?? 0)) * k; cam.leadY = (cam.leadY ?? 0) + (vy / v * V.lookAhead - (cam.leadY ?? 0)) * k
    }
    if (snap || dt > 0) { cam.heroX = hx; cam.heroY = hy }
    tx += cam.leadX ?? 0; ty += cam.leadY ?? 0
  }
  const want = clampCenter(cam.zoom, tx, ty, bounds), k = snap ? 1 : 1 - Math.exp(-Z.follow * dt)
  const c = clampCenter(cam.zoom, cam.x + (want.x - cam.x) * k, cam.y + (want.y - cam.y) * k, bounds)
  cam.x = c.x; cam.y = c.y
}

/** 캔버스 좌표(판 크기 px) → 판 좌표 · 마우스로 누른 곳으로 걷기가 확대 중에도 · 넓은 맵에서도 맞게 */
export const toField = (cam: Cam, px: number, py: number) => ({ x: cam.x + (px - C.width / 2) / cam.zoom, y: cam.y + (py - C.height / 2) / cam.zoom })
/** 그리는 변환과 같은 실제 시야. sim에는 화면 대신 선택한 발사자 ID만 입력한다. */
export const fieldView = (cam: { x: number; y: number; zoom: number }) => ({ left: cam.x - C.width / (2 * cam.zoom), right: cam.x + C.width / (2 * cam.zoom), top: cam.y - C.height / (2 * cam.zoom), bottom: cam.y + C.height / (2 * cam.zoom) })

const CAM: Rect = { left: 0, top: 0, right: 0, bottom: 0 }
/**
 * 59-WIDE 카메라가 볼 수 있는 땅 — 넓은 맵이 아니면 undefined(예전 그대로 · 원래 판).
 * 안개 문이 camLag 만큼 닫힐 때까지는 세계 전체다(밀려 들어오는 안개가 화면에 보인다). 그 뒤로 조여 들어 다 닫히면 결전장과 같아진다 (보스 싸움의 화면은 옛 판 그대로).
 */
export function cameraBounds(s: { wide?: WideState }): Readonly<Rect> | undefined {
  const w = s.wide; if (!w) return undefined
  const lag = WD.view.camLag, k = w.gate <= lag ? 0 : (w.gate - lag) / (1 - lag)
  CAM.left = WORLD.left + (BOARD.left - WORLD.left) * k; CAM.top = WORLD.top + (BOARD.top - WORLD.top) * k
  CAM.right = WORLD.right + (BOARD.right - WORLD.right) * k; CAM.bottom = WORLD.bottom + (BOARD.bottom - WORLD.bottom) * k
  return CAM
}

/** Whole board plus the current original-art overhang. View-only; no pose mutations. */
export function bossFrameZoom(bounds: {left:number;right:number;top:number;bottom:number} | null, maximum: number): number {
  if (!bounds) return maximum
  const hw = Math.max(C.width / 2, C.width / 2 - bounds.left, bounds.right - C.width / 2)
  const hh = Math.max(C.height / 2, C.height / 2 - bounds.top, bounds.bottom - C.height / 2)
  return Math.min(maximum, C.width / (2 * hw), C.height / (2 * hh))
}
