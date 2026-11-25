/**
 * 고정 걸음 누적 — 화면 틀이 sim 틱을 몰아 돌리지 않게 (docs/realm/battle-study/40-cards.md F3a)
 * 순수 함수. rAF·숨은 탭 처리는 src/field-main.ts 가 한다.
 */

export interface Advance { ticks: number; acc: number }

/**
 * acc(ms)에 dtMs 를 더해 hz 로 몇 틱을 돌릴지 센다. 한 번에 maxCatchUp 틱을 넘기면 나머지 시간은 버린다(탭 복귀·긴 프레임).
 * dt 가 음수나 NaN 이면 0 으로 본다.
 */
export function advance(acc: number, dtMs: number, hz: number, maxCatchUp: number): Advance {
  const step = 1000 / hz
  let a = acc + (dtMs > 0 ? dtMs : 0)
  let ticks = Math.floor(a / step)
  if (ticks > maxCatchUp) { ticks = maxCatchUp; a = 0 } else a -= ticks * step
  return { ticks, acc: a }
}
