// Deterministic, ordinary-input bot for balance probes and the dev review page.
import { HAEBI_RUN as C, HAEBI_MOBS as M } from '../tune/params.ts'
import { createHaebi, choose, stepHaebi, isCombo, KITS, type HaebiRun, type Kit, type Pick, type Power, type RunInput } from './haebi.ts'
export type Route = 'storm' | 'fire' | 'mixed'
/** 길은 도끼 묶음 이름으로 적고(axe=주 무기 · gale=보조), 다른 묶음은 그 자리에 제 무기를 넣는다 · 조합 카드(금테)가 나오면 늘 그것부터 (기술 나무 2층 · 3층 비기 강화) */
export function botChoice(s: HaebiRun, route: Route): Pick {
  const combo = s.offers.find(isCombo); if (combo) return combo
  const k = KITS[s.kit], swap = (p: Power): Power => p === 'axe' ? k.primary : p === 'gale' ? k.secondary : p
  const priorities: Record<Route, Power[]> = { storm: ['gale', 'axe', 'echo', 'tempo', 'reach', 'thunder', 'ember'], fire: ['ember', 'thunder', 'tempo', 'echo', 'reach', 'gale', 'axe'], mixed: ['gale', 'ember', 'thunder', 'axe', 'echo', 'tempo', 'reach'] }
  const target: Partial<Record<Power, number>> = { axe: 4, gale: 3, ember: 3, thunder: 3, echo: 2, tempo: 3, reach: 3 }
  const order = priorities[route].map(swap), want = (p: Power) => target[p === k.primary ? 'axe' : p === k.secondary ? 'gale' : p] ?? 3
  return order.find(p => s.offers.includes(p) && s.ranks[p] < want(p)) ?? order.find(p => s.offers.includes(p)) ?? s.offers[0]!
}
/** react: 고리·돌진 예고를 알아채기까지 걸리는 초 (0 = 완벽 · 사람은 .4~.6 쯤) */
export function botInput(s: HaebiRun, react = 0): RunInput {
  // Circle gently inside the arena; approach the boss after it arrives.
  const boss = s.enemies.find(e => e.kind === 'boss')
  const a = s.t * .14, tx = boss ? boss.x + Math.cos(a) * 120 : C.width / 2 + Math.cos(a) * 155, ty = boss ? boss.y + Math.sin(a) * 120 : C.height / 2 + Math.sin(a) * 120
  let x = tx - s.x, y = ty - s.y
  const danger = s.enemies.find(e => e.wind > 0 && Math.hypot(s.x - e.aimX, s.y - e.aimY) < C.bossRadius + 20)
  if (danger) { x = s.x - danger.aimX || 1; y = s.y - danger.aimY || 1 }
  // 일제 사격의 붉은 고리에서 비켜난다 (보통 사람도 하는 만큼)
  // 떨어질 고리·불바닥에서 비켜난다 — 겹친 고리는 모두 합쳐 밀어내는 쪽으로
  let rx = 0, ry = 0
  for (const b of s.shots) if (b.kind === 'flame' || b.kind === 'barrage' && C.barrageDelay - b.life >= react || b.kind === 'stone' && M.lobDelay - b.life >= react) { const dx = s.x - b.x, dy = s.y - b.y, d = Math.hypot(dx, dy) || 1; if (d < b.radius + 20) { rx += dx / d * (b.radius + 20 - d); ry += dy / d * (b.radius + 20 - d) } }
  const ring = rx || ry
  if (ring && !danger) { x = rx; y = ry }
  // 창돌격꾼이 겨눈 줄에서 옆으로 비켜난다
  // (범·투창 사냥꾼의 붉은 줄도 같다)
  const laneWind = (k: string) => k === 'runner' ? M.runnerWind : k === 'tiger' ? M.tigerWind : k === 'hunter' ? M.hunterWind : 0
  const lane = s.enemies.find(e => laneWind(e.kind) > 0 && e.act > 0 && e.act <= laneWind(e.kind) - react && Math.abs((s.x - e.x) * e.vy - (s.y - e.y) * e.vx) < 40 && (s.x - e.x) * e.vx + (s.y - e.y) * e.vy > 0)
  if (lane && !danger && !ring) { x = -lane.vy; y = lane.vx }
  const len = Math.hypot(x, y) || 1
  return { x: x / len, y: y / len, skill: s.skillCd === 0 && s.enemies.some(e => Math.hypot(e.x - s.x, e.y - s.y) < 230), dash: !!danger && s.dashCd === 0 }
}
export function replay(seed = 7, until: number = C.duration, route: Route = 'storm', onMinute?: (s: HaebiRun) => void, kit: Kit = 'axe', opts: Parameters<typeof createHaebi>[3] = {}) {
  const s = createHaebi(seed, 'stage', kit, opts); let minute = 1
  while (s.t < until && s.state === 'playing') {
    if (s.offers.length) choose(s, botChoice(s, route))
    else stepHaebi(s, botInput(s), 1 / 120)
    if (s.t >= minute * 60) { onMinute?.(s); minute++ }
  }
  return s
}
