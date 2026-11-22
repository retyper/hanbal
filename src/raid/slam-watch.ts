/**
 * 「쿵」 찾기 (형 11-23 「보스가 쿵 하는 건 쿵 하는 효과음도 들려야 함」) — 화면·소리 전용 · 판은 읽기만 한다.
 * 두 가지를 한 프레임에 새로 생긴 것만 돌려준다:
 *  - 거대 보스 땅 울림: 판이 남기는 고리 fx(championCue 'quake' · 착지·내려찍기·벽 박치기)
 *  - 장수급 적 내려찍기: 예고(tell)가 끝나 내려친 순간 (판이 fx 를 남기지 않아 상태 바뀜으로 잰다)
 * 보는 쪽(소리 · 땅 자국)마다 watcher 하나씩 — 서로의 「본 것」을 나누지 않는다.
 */
import type { Effect, HaebiRun, Mob } from './haebi.ts'

export interface Slam { x: number; y: number; r: number; boss: boolean }

export function slamWatcher() {
  let run: HaebiRun | null = null
  let seen = new WeakSet<Effect>()
  let telling = new WeakMap<Mob, { x: number; y: number; r: number }>()
  return (s: HaebiRun): Slam[] => {
    const out: Slam[] = []
    if (run !== s) { run = s; seen = new WeakSet(s.fx); telling = new WeakMap(); return out }
    for (const f of s.fx) if (!seen.has(f)) { seen.add(f); if (f.championCue === 'quake') out.push({ x: f.x, y: f.y, r: f.r, boss: true }) }
    for (const e of s.enemies) {
      const c = e.champion; if (!c) continue
      const was = telling.get(e)
      if (c.mode === 'tell' && e.pattern === 'slam') { if (e.wind > 0) telling.set(e, { x: e.aimX, y: e.aimY, r: c.radius }); continue }
      if (was) { telling.delete(e); if (e.hp > 0) out.push({ ...was, boss: false }) }
    }
    return out
  }
}
