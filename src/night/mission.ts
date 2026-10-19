/**
 * 밤 판의 갈래 — 무엇이 칠십팔국으로 결과를 보내나 (night-main.ts · 형: "암살은 쏘기전에 연습모드 먼저 할수 있게 해줘")
 *
 *   practice  — 궁술 연습장 (night.html?practice=1). 기록만 남긴다
 *   rehearsal — 임무 전 연습. 같은 활·같은 화살로 **다른 지붕**. 결과를 안 보낸다
 *   mission   — 진짜 임무. 결과(또는 건너뛰기)를 보낸다
 */
export type NightMode = 'practice' | 'rehearsal' | 'mission'

/** 결과를 칠십팔국으로 보내는 것은 진짜 임무뿐이다 */
export const reportsResult = (mode: NightMode): boolean => mode === 'mission'

/**
 * n 번째 연습의 시드 — 진짜 시드에서 갈라 내되 결코 같지 않다 (진짜 지붕의 배치를 미리 보지 못한다).
 * 연습마다 다른 지붕이 나온다.
 */
export function rehearsalSeed(mission: number, n: number): number {
  const s = (Math.imul((mission ^ 0x5bd1e995) >>> 0, 2654435761) + Math.imul(n + 1, 40503)) >>> 0
  return s === mission >>> 0 ? (s ^ 1) >>> 0 : s
}
