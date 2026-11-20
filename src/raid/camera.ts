/**
 * 열전 전투판 확대 카메라 (11-19 형: 「돋보기 · 탭 확대 · 탭 더 가까이 · 탭 원래대로 · 확대 중엔 캐릭터가 늘 가운데」) — 화면 쪽 기억만.
 * 판(haebi.ts)은 읽기만 한다: 장수 자리를 읽어 화면 가운데를 정하고, 그리는 쪽(haebi-view drawField)이 이 변환으로 판을 그린다.
 * 판 밖(빈 바탕)이 보이지 않게 맵 끝에서는 가운데가 가장자리에 멈춘다 — 그때만 장수가 가운데에서 비켜난다.
 */
import { HAEBI_RUN as C, HAEBI_ZOOM as Z } from '../tune/params.ts'

export interface Cam {
  /** 단계 (0 = 1배) */
  level: number
  /** 지금 배율 (단계 배율로 부드럽게 다가간다) · 화면 가운데의 판 좌표 */
  zoom: number; x: number; y: number
}
export const newCam = (level = 0): Cam => ({ level: Math.max(0, Math.min(Z.levels.length - 1, Math.floor(level) || 0)), zoom: 1, x: C.width / 2, y: C.height / 2 })
export const levelZoom = (level: number) => Z.levels[level] ?? 1
/** 다음 단계 — 1배 → 조금 → 가까이 → 1배 … */
export const nextLevel = (level: number) => (level + 1) % Z.levels.length
/** 가장 가까이 — 단추가 되돌리기(돋보기 −)로 바뀐다 */
export const closest = (level: number) => level === Z.levels.length - 1

/** 배율 z 에서 화면 가운데가 갈 수 있는 자리 — 판 밖이 보이지 않게 */
export function clampCenter(z: number, x: number, y: number) {
  const hw = C.width / (2 * z), hh = C.height / (2 * z)
  return { x: Math.min(C.width - hw, Math.max(hw, x)), y: Math.min(C.height - hh, Math.max(hh, y)) }
}

/** 장수(hx, hy)를 따라간다 — dt 화면 초 · snap 이면 곧바로 (새 판) */
export function followCam(cam: Cam, hx: number, hy: number, dt: number, snap = false) {
  const zt = levelZoom(cam.level)
  cam.zoom = snap ? zt : zt + (cam.zoom - zt) * Math.exp(-Z.ease * dt)
  if (Math.abs(cam.zoom - zt) < 1e-3) cam.zoom = zt
  const want = clampCenter(cam.zoom, hx, hy), k = snap ? 1 : 1 - Math.exp(-Z.follow * dt)
  const c = clampCenter(cam.zoom, cam.x + (want.x - cam.x) * k, cam.y + (want.y - cam.y) * k)
  cam.x = c.x; cam.y = c.y
}

/** 캔버스 좌표(판 크기 px) → 판 좌표 · 마우스로 누른 곳으로 걷기가 확대 중에도 맞게 */
export const toField = (cam: Cam, px: number, py: number) => ({ x: cam.x + (px - C.width / 2) / cam.zoom, y: cam.y + (py - C.height / 2) / cam.zoom })
/** 그리는 변환과 같은 실제 시야. sim에는 화면 대신 선택한 발사자 ID만 입력한다. */
export const fieldView = (cam: { x: number; y: number; zoom: number }) => ({ left: cam.x - C.width / (2 * cam.zoom), right: cam.x + C.width / (2 * cam.zoom), top: cam.y - C.height / (2 * cam.zoom), bottom: cam.y + C.height / (2 * cam.zoom) })
