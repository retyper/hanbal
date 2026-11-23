/**
 * 65-BUILD 설치 갈래 — 망루 · 목책 · 항아리 (판 쪽 셈 · 화면은 fx-build.ts 가 읽어 그린다).
 * 레벨업 카드의 네 번째 갈래 (docs/realm/QUESTIONS-20261122.md §2 A ★). 소환물이 아니라 건물이다 (형 11-23 · 다이센카):
 * 처음 고른 순간 장수 앞에 하나 서서 판 끝까지 남고 · 3·5단계에 하나씩 더 선다 · 장수·적이 지나가지 못하고 · 장수가 몸으로 천천히 밀어 옮긴다.
 * 자리는 난수를 쓰지 않는다 — 장수 자리 · 가장 가까운 적 쪽 · 그 종류의 몇째인지로만 정해져 같은 씨앗이면 늘 같은 자리.
 * 수치는 모두 HAEBI_BUILD (tune/params.ts).
 */
import { HAEBI_BUILD as B } from '../tune/params.ts'

export type BuildKind = 'tower' | 'fence' | 'jar'
/** 카드·나무에 서는 차례 (망루 → 목책 → 항아리) */
export const BUILD_KINDS: readonly BuildKind[] = ['tower', 'fence', 'jar']
export const isBuildKind = (k: string): k is BuildKind => k === 'tower' || k === 'fence' || k === 'jar'
/**
 * 선 설치물 하나 — hp·max 목책 체력(망루·항아리는 무적이라 0) · down 부서진 목책이 다시 서기까지 남은 초(0 = 서 있음) ·
 * cd 망루 다음 화살까지 · flash 쏘거나 맞거나 기세를 더한 반짝임 · push 장수에게 밀린 뒤 흙먼지가 남는 초
 */
export interface Structure { id: number; kind: BuildKind; x: number; y: number; hp: number; max: number; down: number; cd: number; flash: number; push: number }
/** items 선 것(놓인 차례) · nextId · jarXp 항아리가 더 얹어 준 기세(기록) */
export interface BuildState { items: Structure[]; nextId: number; jarXp: number }
export const newBuild = (): BuildState => ({ items: [], nextId: 1, jarXp: 0 })

/** 그 단계에서 서 있는 수 — 1 + extraAt 에 이른 수 (단계 0 이면 0) */
export const buildUnits = (rank: number) => rank > 0 ? 1 + B.extraAt.filter(r => rank >= r).length : 0
/** 망루 화살 한 발이 그때 잡졸 체력의 몇 몫을 깎나 */
export const towerShare = (rank: number) => B.tower.share + B.tower.shareStep * (rank - 1)
/** 망루가 다시 쏘기까지 (맹공을 나누기 전) */
export const towerFire = (rank: number) => B.tower.fire * (1 - B.tower.fireStep * (rank - 1))
/** 목책 체력 (판의 위협 배수를 곱하기 전) */
export const fenceHp = (rank: number) => B.fence.hp + B.fence.hpStep * (rank - 1)
export const jarRadius = (rank: number) => B.jar.radius + B.jar.radiusStep * (rank - 1)
/** 항아리 둘레에서 쓰러진 적의 기세 배수 */
export const jarShare = (rank: number) => 1 + B.jar.bonus + B.jar.bonusStep * (rank - 1)
/** 서 있는 것 — 부서진 목책(잔해)은 지나갈 수 있고 막지도 않는다 */
export const standing = (it: Structure) => it.down <= 0 && (it.kind !== 'fence' || it.hp > 0)
/** 몸 반지름 */
export const bodyR = (it: Structure) => B[it.kind].r

/**
 * 놓을 자리 — 장수 앞 ahead px (aim 가장 가까운 적 쪽 · 없으면 보는 쪽) · 그 종류의 i 째(0·1·2)는 0 · −spread · +spread 만큼 옆으로 돌린다.
 * 판 밖·장애물·다른 설치물은 부르는 쪽이 다시 맞춘다.
 */
export function buildSpot(kind: BuildKind, i: number, x: number, y: number, aim: number, out: { x: number; y: number }) {
  const a = aim + (i === 0 ? 0 : i === 1 ? -B.spread : B.spread)
  out.x = x + Math.cos(a) * B[kind].ahead; out.y = y + Math.sin(a) * B[kind].ahead
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
