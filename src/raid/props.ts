/**
 * 59-WIDE 넓은 맵의 낱개 장식 자리 · 61-SOLID 부딪히는 장식 (판 쪽 · 화면은 wide-view.ts 가 이걸 읽어 그린다).
 * 자리는 스테이지 이름과 씨앗으로 늘 같다 (core/rng · 판의 난수와 무관).
 * 61-SOLID (형 11-22 「장애물을 무기도 나도 적도 다 통과하네 · 그러면 안 되는 거 아님?」 → 「무기는 통과」):
 *   몸이 있는 장식(나무 밑동 · 바위 · 목책 · 망루 · 수레 · 장승 · 성벽)은 장수와 적을 막는다 · 갈대·덤불·눈더미·징검돌·모닥불·통나무는 지나간다.
 *   막는 꼴 = 밑동의 가로 캡슐(가운데 ± 반폭 hw · 두께 반지름 r) · 무기·화살·효과는 막지 않는다.
 */
import { HAEBI_WIDE as WD } from '../tune/params.ts'
import { makeRng } from '../core/rng.ts'
import { BOARD, WORLD } from './wide.ts'

const V = WD.view
/** 이 스테이지의 낱개 장식 (위에서 아래로 그릴 차례에 끼운다) */
export interface WideProp { sprite: string; x: number; y: number; width: number; height: number; kind: number }
/** 부딪히는 밑동 — 가로 선분 (x0~x1, y) 둘레 r */
export interface Solid { x0: number; x1: number; y: number; r: number }

export const propPath = (stage: string, index: number) => `raid/props/${stage}-${index}.webp`
/** 처음에 받아 둘 낱개 장식 그림 (스테이지마다 6~8개) */
export const PROP_PATHS = Object.entries(V.props).flatMap(([stage, kinds]) => kinds.map((_, i) => propPath(stage, i)))
/**
 * 스테이지의 장식을 흩는다 — 스테이지 이름과 씨앗으로 늘 같은 자리.
 * 발밑(x, y)에서 위로 선 그림 상자가 결전장(가운데 칸 + pad · 안개 문이 닫히는 자리)에 걸치면 버리고, 밑동끼리 gap 안이면 버린다. 키 큰 것(나무·망루)은 덜 뽑는다.
 */
export function scatterProps(stage: string): WideProp[] {
  const kinds = V.props[stage] ?? [], S = V.scatter, list: WideProp[] = []
  if (!kinds.length) return list
  const rng = makeRng([...stage].reduce<number>((n, c) => (n * 31 + c.charCodeAt(0)) | 0, S.seed))
  const weight = kinds.map(([, h]) => h > S.tall ? S.tallShare : 1), total = weight.reduce((a, b) => a + b, 0)
  for (let tries = 0; list.length < S.count && tries < S.count * 40; tries++) {
    let r = rng.next() * total, k = 0
    while (k < kinds.length - 1 && r >= weight[k]!) { r -= weight[k]!; k++ }
    const [w, h] = kinds[k]!
    const x = Math.round(WORLD.left + S.edge + w / 2 + rng.next() * (WORLD.right - WORLD.left - 2 * S.edge - w)), y = Math.round(WORLD.top + S.edge + h + rng.next() * (WORLD.bottom - WORLD.top - 2 * S.edge - h))
    if (x + w / 2 > BOARD.left - S.pad && x - w / 2 < BOARD.right + S.pad && y > BOARD.top - S.pad && y - h < BOARD.bottom + S.pad) continue
    if (list.some(p => Math.hypot(p.x - x, p.y - y) < S.gap)) continue
    list.push({ sprite: propPath(stage, k), x, y, width: w, height: h, kind: k })
  }
  // 가운데 칸(결전장)에도 몸 없는 장식만 몇 개 — 막는 것(61-SOLID)은 두목과 싸우는 자리라 넣지 않는다 · 장수가 서는 한가운데는 비운다 (11-22 형 「가운데만 원본 그림」 → 둘레와 같은 바닥)
  const soft = kinds.map((_, i) => i).filter(i => !(WD.solid[stage] ?? [])[i]), M = V.centerScatter
  if (soft.length) {
    const rc = makeRng([...stage].reduce<number>((n, c) => (n * 37 + c.charCodeAt(0)) | 0, M.seed))
    for (let tries = 0, n = 0; n < M.count && tries < M.count * 40; tries++) {
      const k = soft[Math.floor(rc.next() * soft.length)]!, [w, h] = kinds[k]!
      const x = Math.round(BOARD.left + w / 2 + rc.next() * (BOARD.right - BOARD.left - w)), y = Math.round(BOARD.top + h + rc.next() * (BOARD.bottom - BOARD.top - h))
      if (Math.hypot(x - (BOARD.left + BOARD.right) / 2, y - (BOARD.top + BOARD.bottom) / 2) < M.core) continue
      if (list.some(p => Math.hypot(p.x - x, p.y - y) < M.gap)) continue
      list.push({ sprite: propPath(stage, k), x, y, width: w, height: h, kind: k }); n++
    }
  }
  return list
}

/** 61-SOLID 막는 밑동 — 장식 자리마다 HAEBI_WIDE.solid[스테이지][종류] (없으면 지나간다) */
export function solidsFor(stage: string): Solid[] {
  const table = WD.solid[stage] ?? []
  const out: Solid[] = []
  for (const p of scatterProps(stage)) {
    const f = table[p.kind]; if (!f) continue
    const [hw, r] = f
    out.push({ x0: p.x - hw, x1: p.x + hw, y: p.y - r * WD.solidLift, r })
  }
  return out
}

/** 몸(둘레 radius)을 밑동 밖으로 민다 — 겹친 깊이만큼 가장 가까운 쪽으로 (미끄러지듯 비켜 간다) */
export function pushOutOfSolids(solids: readonly Solid[], body: { x: number; y: number }, radius: number) {
  for (const o of solids) {
    const reach = o.r + radius
    if (body.y < o.y - reach || body.y > o.y + reach || body.x < o.x0 - reach || body.x > o.x1 + reach) continue
    const cx = Math.max(o.x0, Math.min(o.x1, body.x)), dx = body.x - cx, dy = body.y - o.y, d = Math.hypot(dx, dy)
    if (d >= reach) continue
    if (d < 1e-6) { body.y = o.y + (dy < 0 ? -reach : reach); continue }   // 한가운데 — 아래(앞)로
    const k = reach / d
    body.x = cx + dx * k; body.y = o.y + dy * k
  }
}
