/**
 * 65-BUILD 설치 갈래 — 망루 · 목책 · 항아리 (판 쪽 셈 · 화면은 fx-build.ts 가 읽어 그린다).
 * 레벨업 카드의 네 번째 갈래 (docs/realm/QUESTIONS-20261122.md §2 A ★). 고른 종류마다 제 쿨타임이 차면 장수 곁에 저절로 선다.
 * 자리는 난수를 쓰지 않는다 — 장수 자리 · 가장 가까운 적 쪽 · 지금까지 놓은 횟수(황금각)로만 정해져 같은 씨앗이면 늘 같은 자리.
 * 수치는 모두 HAEBI_BUILD (tune/params.ts).
 */
import { HAEBI_BUILD as B } from '../tune/params.ts'

export type BuildKind = 'tower' | 'fence' | 'jar'
/** 카드·나무에 서는 차례 (망루 → 목책 → 항아리) */
export const BUILD_KINDS: readonly BuildKind[] = ['tower', 'fence', 'jar']
export const isBuildKind = (k: string): k is BuildKind => k === 'tower' || k === 'fence' || k === 'jar'
/**
 * 선 설치물 하나 — born 놓인 판 시각 · life 남은 수명 · total 처음 수명 · hp·max 목책 체력(망루·항아리는 0) · cd 망루 다음 화살까지 · flash 쏘거나 맞거나 기세를 더한 반짝임
 */
export interface Structure { id: number; kind: BuildKind; x: number; y: number; born: number; life: number; total: number; hp: number; max: number; cd: number; flash: number }
/** items 선 것(놓인 차례) · cd 종류마다 다음 놓기까지 · waves 지금까지 놓은 횟수 · nextId · jarXp 항아리가 더 얹어 준 기세(기록) */
export interface BuildState { items: Structure[]; cd: Record<BuildKind, number>; waves: number; nextId: number; jarXp: number }
export const newBuild = (): BuildState => ({ items: [], cd: { tower: 0, fence: 0, jar: 0 }, waves: 0, nextId: 1, jarXp: 0 })

/** 한 번에 놓는 수 = 한꺼번에 서는 수 (단계 0 이면 0) */
export const buildCount = (kind: BuildKind, rank: number) => rank > 0 ? B[kind].count[Math.min(rank, B.max) - 1]! : 0
export const buildLife = (kind: BuildKind, rank: number) => B[kind].life + B[kind].lifeStep * (rank - 1)
/** 망루 화살 한 발이 그때 잡졸 체력의 몇 몫을 깎나 */
export const towerShare = (rank: number) => B.tower.share + B.tower.shareStep * (rank - 1)
/** 목책 체력 (판의 위협 배수를 곱하기 전) */
export const fenceHp = (rank: number) => B.fence.hp + B.fence.hpStep * (rank - 1)
export const jarRadius = (rank: number) => B.jar.radius + B.jar.radiusStep * (rank - 1)
/** 항아리 둘레에서 쓰러진 적의 기세 배수 */
export const jarShare = (rank: number) => 1 + B.jar.bonus + B.jar.bonusStep * (rank - 1)
/** 서 있는 것 (수명이 남았고 · 목책은 체력도) */
export const standing = (it: Structure) => it.life > 0 && (it.kind !== 'fence' || it.hp > 0)

const GOLDEN = Math.PI * (3 - Math.sqrt(5))
/**
 * 놓을 자리 (장수 곁 · 판 밖·장애물은 부르는 쪽이 다시 맞춘다) — i 이번 묶음의 몇째 · n 묶음 수 · aim 가장 가까운 적 쪽(없으면 보는 쪽)
 * 망루 = 둘레 ring 에 고르게 (놓을 때마다 황금각만큼 돌려 겹치지 않게) · 항아리 = 망루 반대쪽 둘레 · 목책 = 적 쪽 ahead 앞에 부채꼴
 */
export function buildSpot(kind: BuildKind, i: number, n: number, waves: number, x: number, y: number, aim: number, out: { x: number; y: number }) {
  const a = kind === 'fence' ? aim + (i - (n - 1) / 2) * B.fence.spread : waves * GOLDEN + i * Math.PI * 2 / n + (kind === 'jar' ? Math.PI : 0)
  const d = kind === 'fence' ? B.fence.ahead : kind === 'jar' ? B.jar.ring : B.tower.ring
  out.x = x + Math.cos(a) * d; out.y = y + Math.sin(a) * d
  return out
}
/** 성한 목책 둘레 밖으로 민다 (잡졸만 · 부르는 쪽이 거른다) */
export function pushOutOfFences(b: BuildState, body: { x: number; y: number }, radius: number) {
  for (const f of b.items) {
    if (f.kind !== 'fence' || !standing(f)) continue
    const reach = B.fence.r + radius, dx = body.x - f.x, dy = body.y - f.y, d = Math.hypot(dx, dy)
    if (d >= reach) continue
    if (d < 1e-6) { body.y = f.y + reach; continue }
    body.x = f.x + dx / d * reach; body.y = f.y + dy / d * reach
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
  for (const j of b.items) if (j.kind === 'jar' && standing(j) && Math.hypot(x - j.x, y - j.y) < r) { j.flash = flash; return jarShare(rank) }
  return 1
}
