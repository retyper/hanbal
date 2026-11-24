/**
 * 65-BUILD 설치 갈래 — 망루 · 목책 · 항아리 (판 쪽 셈 · 화면은 fx-build.ts 가 읽어 그린다).
 * 레벨업 카드의 네 번째 갈래 (docs/realm/QUESTIONS-20261122.md §2 A ★). 소환물이 아니라 건물이다 (형 11-23 · 다이센카):
 * 처음 고른 순간 장수 앞에 하나 서서 판 끝까지 남고 · 3·5단계에 하나씩 더 선다 (우물만 늘 하나) · 장수·적이 지나가지 못하고 · 장수가 몸으로 천천히 밀어 옮긴다.
 * 자리는 난수를 쓰지 않는다 — 장수 자리 · 가장 가까운 적 쪽 · 그 종류의 몇째인지로만 정해져 같은 씨앗이면 늘 같은 자리.
 * 67-BUILD2 (형 11-23 「건설물 여러가지 더 · 창의적이게」): 장승 · 솟대 · 봉수대 · 포차 · 우물 다섯을 더해 여덟 종류 · 종류 칸은 그대로 셋.
 * 수치는 모두 HAEBI_BUILD · HAEBI_BUILD2 (tune/params.ts).
 */
import { HAEBI_BUILD as B, HAEBI_BUILD2 as B2, HAEBI_BUILDUP as B3 } from '../tune/params.ts'

export type BuildKind = 'tower' | 'fence' | 'jar' | 'totem' | 'sotdae' | 'beacon' | 'catapult' | 'well'
/** 65-BUILD 의 셋 — 카드·나무에 서는 차례 (망루 → 목책 → 항아리) */
export const BUILD_KINDS: readonly BuildKind[] = ['tower', 'fence', 'jar']
/** 67-BUILD2 가 더하는 다섯 (장승 · 솟대 · 봉수대 · 포차 · 우물) */
export const BUILD2_KINDS: readonly BuildKind[] = ['totem', 'sotdae', 'beacon', 'catapult', 'well']
export const ALL_BUILD_KINDS: readonly BuildKind[] = [...BUILD_KINDS, ...BUILD2_KINDS]
export const isBuildKind = (k: string): k is BuildKind => (ALL_BUILD_KINDS as readonly string[]).includes(k)
export const isBuild2Kind = (k: string): k is BuildKind => (BUILD2_KINDS as readonly string[]).includes(k)
/** 종류마다 놓는 거리 ahead · 몸 반지름 r */
const KP: Record<BuildKind, { ahead: number; r: number }> = { tower: B.tower, fence: B.fence, jar: B.jar, totem: B2.totem, sotdae: B2.sotdae, beacon: B2.beacon, catapult: B2.catapult, well: B2.well }
/** 체력이 있어 무너지는 종류 (망루 · 목책 · 장승 · 포차) — 나머지는 무적 */
export const hasHp = (k: BuildKind) => k === 'tower' || k === 'fence' || k === 'totem' || k === 'catapult'
/** 무너진 뒤 다시 서기까지 */
export const rebuildOf = (k: BuildKind) => k === 'tower' ? B.tower.rebuild : k === 'fence' ? B.fence.rebuild : k === 'totem' ? B2.totem.rebuild : B2.catapult.rebuild
/**
 * 선 설치물 하나 — hp·max 망루·목책 체력(항아리는 무적이라 0) · down 무너진 망루·목책이 다시 서기까지 남은 초(0 = 서 있음) ·
 * cd 망루 다음 화살까지 · flash 쏘거나 맞거나 기세를 더한 반짝임 · push 장수에게 밀린 뒤 흙먼지가 남는 초
 */
export interface Structure { id: number; kind: BuildKind; x: number; y: number; hp: number; max: number; down: number; cd: number; flash: number; push: number }
/** items 선 것(놓인 차례) · nextId · jarXp 항아리가 더 얹어 준 기세(기록) */
export interface BuildState { items: Structure[]; nextId: number; jarXp: number; /** 67-BUILD2 판 (여덟 종류) */ v2?: true; /** 69-BUILDUP 판 (화력·장전 칸) */ up?: true; /** 처음 낸 69-BUILDUP 판(옛 기록) — HAEBI_BUILDUP.v1 수치 */ upV1?: true }
export const newBuild = (): BuildState => ({ items: [], nextId: 1, jarXp: 0 })

/** 그 단계에서 서 있는 수 — 1 + extraAt 에 이른 수 (단계 0 이면 0) · 우물만 늘 하나 (단계가 오르면 개수 대신 채우는 몫·쿨타임이 좋아진다) */
export const buildUnits = (rank: number, kind?: BuildKind) => rank > 0 ? (kind === 'well' ? 1 : 1 + B.extraAt.filter(r => rank >= r).length) : 0
/** 망루 화살 한 발이 그때 잡졸 체력의 몇 몫을 깎나 */
export const towerShare = (rank: number) => B.tower.share + B.tower.shareStep * (rank - 1)
/** 망루가 다시 쏘기까지 (맹공을 나누기 전) */
export const towerFire = (rank: number) => B.tower.fire * (1 - B.tower.fireStep * (rank - 1))
/** 목책 체력 (판의 위협 배수를 곱하기 전) */
export const fenceHp = (rank: number) => B.fence.hp + B.fence.hpStep * (rank - 1)
/** 망루 체력 (판의 위협 배수를 곱하기 전) */
export const towerHp = (rank: number) => B.tower.hp + B.tower.hpStep * (rank - 1)
/** 체력이 있는 종류의 그 단계 체력 (판의 위협 배수를 곱하기 전 · 무적이면 0) */
export const buildHp = (kind: BuildKind, rank: number) => kind === 'tower' ? towerHp(rank) : kind === 'fence' ? fenceHp(rank) : kind === 'totem' ? B2.totem.hp + B2.totem.hpStep * (rank - 1) : kind === 'catapult' ? B2.catapult.hp + B2.catapult.hpStep * (rank - 1) : 0
/** 단계 몫 (base + step × (단계−1)) */
const at = (base: number, step: number, rank: number) => base + step * (rank - 1)
export const sotdaeRadius = (rank: number) => at(B2.sotdae.radius, B2.sotdae.radiusStep, rank)
export const sotdaeSlow = (rank: number) => at(B2.sotdae.slow, B2.sotdae.slowStep, rank)
export const wellRadius = (rank: number) => at(B2.well.radius, B2.well.radiusStep, rank)
/** 우물이 한 번에 채우는 최대 체력의 몫 */
export const wellShare = (rank: number) => at(B2.well.share, B2.well.shareStep, rank)
/** 한 번 채운 뒤 다시 찰 때까지 (초) */
export const wellCool = (rank: number) => B2.well.cool - B2.well.coolStep * (rank - 1)
export const beaconEvery = (rank: number) => B2.beacon.every - B2.beacon.everyStep * (rank - 1)
export const beaconRadius = (rank: number) => at(B2.beacon.radius, B2.beacon.radiusStep, rank)
export const beaconShare = (rank: number) => at(B2.beacon.share, B2.beacon.shareStep, rank)
export const catapultEvery = (rank: number) => B2.catapult.every - B2.catapult.everyStep * (rank - 1)
export const catapultRadius = (rank: number) => at(B2.catapult.radius, B2.catapult.radiusStep, rank)
export const catapultShare = (rank: number) => at(B2.catapult.share, B2.catapult.shareStep, rank)
export const totemLineShare = (rank: number) => at(B2.totem.lineShare, B2.totem.lineStep, rank)
export const jarRadius = (rank: number) => B.jar.radius + B.jar.radiusStep * (rank - 1)
/** 항아리 둘레에서 쓰러진 적의 기세 배수 */
export const jarShare = (rank: number) => 1 + B.jar.bonus + B.jar.bonusStep * (rank - 1)
/** 서 있는 것 — 무너진 것(잔해)은 지나갈 수 있고 막지도 쏘지도 않는다 */
export const standing = (it: Structure) => it.down <= 0 && (!hasHp(it.kind) || it.hp > 0)
/** 이 잡졸이 망루에 끌리는 몫인가 — id 가 aggroEvery 의 배수 (난수 없이 늘 같은 놈) */
export const aggroShare = (id: number) => id % B.tower.aggroEvery === 0
/** 끄는 종류의 끌림 수치 (망루 · 포차 · 장승) — 그 밖은 null */
export const aggroOf = (k: BuildKind) => k === 'tower' ? B.tower : k === 'catapult' ? B2.catapult : k === 'totem' ? B2.totem : null
/**
 * 이 잡졸(id)을 끄는, 몸에서 가장 가까운 서 있는 설치물 — 망루·포차는 id 가 셋의 배수일 때 aggroR 안 · 장승은 둘의 배수일 때 더 넓은 aggroR 안
 * (65-BUILD 판에는 망루뿐이라 예전 셈 그대로)
 */
export function aggroNear(b: BuildState, body: { x: number; y: number }, id: number) {
  let best: Structure | undefined, d = Infinity
  for (const it of b.items) {
    const a = aggroOf(it.kind)
    if (!a || !standing(it) || id % a.aggroEvery !== 0) continue
    const n = Math.hypot(body.x - it.x, body.y - it.y)
    if (n < a.aggroR && n < d) { d = n; best = it }
  }
  return best
}
/** 몸 반지름 */
export const bodyR = (it: Structure) => KP[it.kind].r

/**
 * 놓을 자리 — 장수 앞 ahead px (aim 가장 가까운 적 쪽 · 없으면 보는 쪽) · 그 종류의 i 째(0·1·2)는 0 · −spread · +spread 만큼 옆으로 돌린다.
 * 판 밖·장애물·다른 설치물은 부르는 쪽이 다시 맞춘다.
 */
export function buildSpot(kind: BuildKind, i: number, x: number, y: number, aim: number, out: { x: number; y: number }) {
  const a = aim + (i === 0 ? 0 : i === 1 ? -B.spread : B.spread)
  out.x = x + Math.cos(a) * KP[kind].ahead; out.y = y + Math.sin(a) * KP[kind].ahead
  return out
}
/** 몸(둘레 radius)을 서 있는 설치물 밖으로 민다 — 겹친 깊이만큼 가운데에서 먼 쪽으로 (미끄러지듯 비켜 간다) · skip 은 건너뛸 설치물 */
export function pushOutOfBuild(b: BuildState, body: { x: number; y: number }, radius: number, skip?: Structure) {
  for (const it of b.items) {
    if (it === skip || !standing(it)) continue
    const reach = bodyR(it) + radius, dx = body.x - it.x, dy = body.y - it.y, d = Math.hypot(dx, dy)
    if (d >= reach) continue
    if (d < 1e-6) { body.y = it.y + reach; continue }   // 한가운데 — 아래(앞)로
    body.x = it.x + dx / d * reach; body.y = it.y + dy / d * reach
  }
}
/** 장수가 밀고 있는 설치물이 있나 — 몸이 겹친 서 있는 설치물 */
export const touchingBuild = (b: BuildState, body: { x: number; y: number }, radius: number) => b.items.some(it => standing(it) && Math.hypot(body.x - it.x, body.y - it.y) < bodyR(it) + radius)
/** 설치물끼리 겹치면 반씩 벌린다 (놓인 차례대로 · 같은 자리면 뒤의 것을 아래로) — 줄줄이 붙은 것이 다 풀리도록 settlePasses 번까지 되풀이 */
export function separateBuild(b: BuildState) {
  const list = b.items
  for (let pass = 0; pass < B.settlePasses; pass++) {
    let moved = false
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const p = list[i]!, q = list[j]!
      if (!standing(p) || !standing(q)) continue
      const reach = bodyR(p) + bodyR(q), dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy)
      if (d >= reach) continue
      const nx = d < 1e-6 ? 0 : dx / d, ny = d < 1e-6 ? 1 : dy / d, over = (reach - d) / 2
      p.x -= nx * over; p.y -= ny * over; q.x += nx * over; q.y += ny * over; moved = true
    }
    if (!moved) return
  }
}
/** 몸이 닿은 성한 목책 (없으면 undefined) */
export function fenceTouching(b: BuildState, body: { x: number; y: number }, radius: number) {
  for (const f of b.items) if (f.kind === 'fence' && standing(f) && Math.hypot(body.x - f.x, body.y - f.y) < B.fence.r + radius + B.fence.touch) return f
  return undefined
}
/** 이 자리에서 쓰러진 적의 기세 배수 — 둘레 안 항아리가 있으면 jarShare (여럿이 겹쳐도 한 번) · 그 항아리가 반짝인다 */
export function jarBonusAt(b: BuildState, rank: number, x: number, y: number, flash: number) {
  if (rank <= 0) return 1
  const r = jarRadius(rank)
  for (const j of b.items) if (j.kind === 'jar' && Math.hypot(x - j.x, y - j.y) < r) { j.flash = flash; return jarShare(rank) }
  return 1
}
/** 점(x, y)에서 선분 (ax, ay)–(bx, by) 까지 거리 */
export function segmentDistance(x: number, y: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy, k = l ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l)) : 0
  return Math.hypot(x - ax - dx * k, y - ay - dy * k)
}
/** 67-BUILD2 혼줄 — 서 있는 장승마다 link 안의 가장 가까운 다른 장승과 잇는다 (같은 쌍은 한 번 · 놓인 차례대로) */
export function totemLinks(b: BuildState): [Structure, Structure][] {
  const list = b.items.filter(it => it.kind === 'totem' && standing(it)), out: [Structure, Structure][] = []
  for (const p of list) {
    let best: Structure | undefined, d: number = B2.totem.link
    for (const q of list) if (q !== p) { const n = Math.hypot(p.x - q.x, p.y - q.y); if (n < d) { d = n; best = q } }
    if (best && !out.some(([a, c]) => a === best && c === p || a === p && c === best)) out.push([p, best])
  }
  return out
}
/**
 * 69-BUILDUP 설치물 강화 칸 — 화력(공격하는 설치물의 피해) · 장전(때마다 쏘는 설치물의 빠르기).
 * 설치물 종류가 아니라 종류 칸을 쓰지 않는다 · 얹힐 설치물을 하나라도 가져야 카드·나무에 나온다 (수치는 HAEBI_BUILDUP)
 */
export type BuildUp = 'firepower' | 'reload'
export const BUILD_UPS: readonly BuildUp[] = ['firepower', 'reload']
export const isBuildUp = (k: string): k is BuildUp => k === 'firepower' || k === 'reload'
/** 화력이 얹히는 종류 — 피해를 주는 설치물 (망루 화살 · 장승 혼줄 · 봉수대 화살비 · 포차 바위) */
export const FIRE_KINDS: readonly BuildKind[] = ['tower', 'totem', 'beacon', 'catapult']
/** 장전이 얹히는 종류 — 때마다 쏘는 설치물 (망루 · 봉수대 · 포차) */
export const TIMED_KINDS: readonly BuildKind[] = ['tower', 'beacon', 'catapult']
/** 화력 단계의 피해 배수 */
export const firepowerMul = (rank: number, v1 = false) => 1 + (v1 ? B3.v1.dmgStep : B3.dmgStep) * rank
/** 장전 단계를 얹은 쏘는 간격 — 예전 간격(맹공으로 나눈 것) ÷ (1 + rateStep × 단계) · minInterval 초 아래로는 줄지 않는다 (단계 0 이면 예전 간격 그대로) */
export const reloadInterval = (interval: number, rank: number, v1 = false) => rank > 0 ? Math.max(B3.minInterval, interval / (1 + (v1 ? B3.v1.rateStep : B3.rateStep) * rank)) : interval
