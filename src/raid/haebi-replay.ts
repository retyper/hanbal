// Deterministic, ordinary-input bot for balance probes and the dev review page.
import { HAEBI_RUN as C, HAEBI_MOBS as M } from '../tune/params.ts'
import { createHaebi, choose, stepHaebi, isCombo, KITS, nodeAt, branchPoints, wakeReady, ultOpen, type Branch, type HaebiRun, type Kit, type Pick, type Power, type RunInput } from './haebi.ts'
/** storm·fire·mixed: 예전 길(능력 이름 차례) · deepA/B/C: 한 갈래에 몰빵(그 갈래 칸이 있으면 늘 그것 · 끝 칸 먼저) · spread: 가장 덜 찍은 갈래부터 고르게 */
export type Route = 'storm' | 'fire' | 'mixed' | 'deepA' | 'deepB' | 'deepC' | 'spread'
/** 갈래 안에서 봇이 찍는 차례 — [칸, 이 단계까지] 를 앞에서부터 (공격을 먼저 세우고 → 갈래 끝 → 나머지를 채운다 · 사람이 몰빵할 때의 흔한 길) */
const BRANCH_WANTS: Record<Branch, (k: typeof KITS[Kit]) => [Power, number][]> = {
  a: k => [[k.primary, 4], ['ember', 2], ['reach', 1], ['capA', 1], ['hone', 3], [k.primary, 10], ['capA', 3], ['reach', 5], ['hone', 5], ['ember', 10]],
  b: k => [[k.secondary, 4], ['echo', 2], ['thunder', 1], ['capB', 1], ['drill', 3], [k.secondary, 10], ['capB', 3], ['echo', 4], ['drill', 5], ['thunder', 10]],
  c: () => [['tempo', 3], ['tough', 3], ['capC', 1], ['stout', 3], ['breath', 3], ['capC', 3], ['tempo', 5], ['tough', 5], ['stout', 5], ['breath', 5], ['nimble', 3]],
}
/** 고를 카드 중 그 갈래의 바람 차례 (없으면 Infinity) */
function wantIndex(s: HaebiRun, p: Power) {
  const at = nodeAt(s.kit, p); if (!at) return Infinity
  const i = BRANCH_WANTS[at.branch](KITS[s.kit]).findIndex(([q, n]) => q === p && s.ranks[p] < n)
  return i < 0 ? Infinity : i
}
/** spread 가 갈래를 견주는 무게 — 버팀은 조금 덜 (공격 없이 버티기만 하면 못 깬다) */
const SPREAD_WEIGHT: Record<Branch, number> = { a: 1, b: 1, c: .7 }
function treeChoice(s: HaebiRun, route: 'deepA' | 'deepB' | 'deepC' | 'spread'): Pick {
  const cards = s.offers.filter((p): p is Power => !isCombo(p)), combo = s.offers.find(isCombo)
  const branch = (p: Power) => nodeAt(s.kit, p)!.branch
  const best = (list: Power[]) => [...list].sort((x, y) => wantIndex(s, x) - wantIndex(s, y))[0]
  if (route === 'spread') {
    if (combo) return combo
    const load = (p: Power) => branchPoints(s, branch(p)) / SPREAD_WEIGHT[branch(p)]
    return [...cards].sort((x, y) => load(x) - load(y) || wantIndex(s, x) - wantIndex(s, y))[0] ?? s.offers[0]!
  }
  const focus = route === 'deepA' ? 'a' : route === 'deepB' ? 'b' : 'c'
  const mine = best(cards.filter(p => branch(p) === focus))
  if (mine) return mine
  // 몰빵의 둘째 갈래: 주 무기·보조 몰빵은 버팀으로 버티고, 버팀 몰빵은 주 무기로 친다 (사람이 흔히 가는 길)
  const second = best(cards.filter(p => branch(p) === (focus === 'c' ? 'a' : 'c')))
  if (second && wantIndex(s, second) < Infinity) return second
  if (combo) return combo
  return best(cards) ?? s.offers[0]!
}
/** 길은 도끼 묶음 이름으로 적고(axe=주 무기 · gale=보조), 다른 묶음은 그 자리에 제 무기를 넣는다 · 조합 카드(금테)가 나오면 늘 그것부터 (기술 나무 2층 · 3층 비기 강화) */
export function botChoice(s: HaebiRun, route: Route): Pick {
  if (route === 'deepA' || route === 'deepB' || route === 'deepC' || route === 'spread') return treeChoice(s, route)
  const combo = s.offers.find(isCombo); if (combo) return combo
  const k = KITS[s.kit], swap = (p: Power): Power => p === 'axe' ? k.primary : p === 'gale' ? k.secondary : p
  const priorities: Record<'storm' | 'fire' | 'mixed', Power[]> = { storm: ['gale', 'axe', 'echo', 'tempo', 'reach', 'thunder', 'ember'], fire: ['ember', 'thunder', 'tempo', 'echo', 'reach', 'gale', 'axe'], mixed: ['gale', 'ember', 'thunder', 'axe', 'echo', 'tempo', 'reach'] }
  const target: Partial<Record<Power, number>> = { axe: 4, gale: 3, ember: 3, thunder: 3, echo: 2, tempo: 3, reach: 3 }
  const order = priorities[route].map(swap), want = (p: Power) => target[p === k.primary ? 'axe' : p === k.secondary ? 'gale' : p] ?? 3
  return order.find(p => s.offers.includes(p) && s.ranks[p] < want(p)) ?? order.find(p => s.offers.includes(p)) ?? s.offers[0]!
}
/** 봇이 주우러 가는 기세 알 거리(px) */
const BOT_PICKUP = 260, BOT_PICKUP_HP = .6
/** react: 고리·돌진 예고를 알아채기까지 걸리는 초 (0 = 완벽 · 사람은 .4~.6 쯤) */
export function botInput(s: HaebiRun, react = 0): RunInput {
  // Circle gently inside the arena; approach the boss after it arrives.
  const boss = s.enemies.find(e => e.kind === 'boss')
  const a = s.t * .14, tx = boss ? boss.x + Math.cos(a) * 120 : C.width / 2 + Math.cos(a) * 155, ty = boss ? boss.y + Math.sin(a) * 120 : C.height / 2 + Math.sin(a) * 120
  let x = tx - s.x, y = ty - s.y
  // 떨어진 기세 줍기: 두목 전 · 체력이 넉넉할 때(BOT_PICKUP_HP) 가까운 알(BOT_PICKUP 안) 쪽으로 걷는다 (사람도 줍는다 · 11-17 끌어오기 둘레 밖은 안 날아옴)
  if (!boss && s.hp > s.maxHp * BOT_PICKUP_HP) { let best = BOT_PICKUP, bx = 0, by = 0; for (const d of s.drops) { const n = Math.hypot(d.x - s.x, d.y - s.y); if (n < best) { best = n; bx = d.x; by = d.y } } if (best < BOT_PICKUP) { x = bx - s.x; y = by - s.y } }
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
  // 각성 막대가 차면 바로 누른다 (사람도 단추가 뜨면 누른다 · 11-17 각성 단추)
  return { x: x / len, y: y / len, skill: ultOpen(s) && s.skillCd === 0 && s.enemies.some(e => Math.hypot(e.x - s.x, e.y - s.y) < 230), dash: !!danger && s.dashCd === 0, wake: wakeReady(s) }
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
