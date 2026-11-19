/**
 * 열전 판 빠르기 ×1 → ×2 → ×3 → ×1 (11-19 형) — 화면 쪽 기억만. 판(haebi.ts)의 걸음 크기는 그대로(runlog STEP · 1/120초)이고,
 * 한 프레임에 그 걸음을 몇 번 돌리느냐만 바뀐다. 판 기록은 걸음마다 입력을 적으니 빠르기와 상관없이 같은 기록 · 같은 판이다 (A1).
 */
import { HAEBI_SPEED as SP } from '../tune/params.ts'
import { STEP } from './runlog.ts'

/** 단계 (0 = ×1) — 기기 칸에서 읽은 값을 다듬는다 */
export const speedLevel = (v: unknown) => Math.max(0, Math.min(SP.steps.length - 1, Math.floor(Number(v)) || 0))
export const speedOf = (level: number) => SP.steps[level] ?? 1
/** 다음 단계 — ×1 → ×2 → ×3 → ×1 … */
export const nextSpeed = (level: number) => (level + 1) % SP.steps.length

/**
 * 한 프레임의 화면 시간 dt 를 판 걸음으로 바꾼다. acc 는 지난 프레임에서 남은 화면 시간 · 돌려주는 값이 다음 프레임의 acc.
 * mult 는 걸음마다 다시 묻는다 (비기 시전이 서는 그 걸음부터 ×1 · 프레임 가운데서 바뀌어도 맞게).
 * step 이 false 를 돌려주면 (레벨업 카드 · 판 끝) 거기서 멈추고 남은 시간은 버린다.
 */
export function runFrame(acc: number, dt: number, mult: () => number, step: () => boolean): number {
  acc += dt
  for (;;) {
    const need = STEP / Math.max(1, mult())
    if (acc < need - 1e-9) return acc   // 1/60 프레임이 ×3 에서 걸음 여섯이 되게 (뜨는 수 오차로 다섯이 되지 않게)
    acc -= need
    if (!step()) return 0
  }
}
