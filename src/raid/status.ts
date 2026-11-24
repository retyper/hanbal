// 74-BUFF 상태 효과 틀 — 장수의 버프(물기운)와 적의 디버프(독·느려짐·어지러움)를 한 모양으로 읽는다.
//   장수: 판이 s.buffs 목록을 쥔다 (우물의 물기운이 여기 붙고 틱마다 고르게 채운다 · 시간은 판 dt 로만)
//   적: 독·느려짐·어지러움은 예전 칸(Mob.poison · slow · daze)을 그대로 두고 mobStatuses 가 읽어 목록으로 보여 준다
//       (옛 판 기록이 그대로 돌아야 해서 옮기지 않았다 — 칸은 한 곳, 목록은 읽기 전용)
// 결정론(A1): Math.random · Date.now · DOM 없음.
import { HAEBI_STATUS as ST, HAEBI_BUILD2 as B2 } from '../tune/params.ts'

export type StatusKind = 'water' | 'poison' | 'slow' | 'daze'
export interface Status {
  kind: StatusKind
  /** 남은 시간 (초) */
  t: number
  /** 붙을 때의 지속 시간 (초) */
  total: number
  /** 세기 — 물기운은 지속 동안 채울 총량(체력), 독은 초당 피해 */
  power: number
  /** 겹친 수 (1) */
  stacks: number
  /** 마지막 숫자 이후 쌓인 양과 시간 (화면의 초록 숫자가 이 값으로 뜬다) */
  acc: number
  pulseT: number
}
type Statused = { poison: number; pdps: number; daze: number; slow?: number; stack?: number; hp: number }

/** 같은 종류가 이미 있으면 겹치지 않고 시간만 새로 잰다 (true = 새로 붙음) */
export function addStatus(list: Status[], kind: StatusKind, t: number, power: number): boolean {
  const have = list.find(x => x.kind === kind)
  if (have) { have.t = Math.max(have.t, t); have.total = Math.max(have.total, t); have.power = Math.max(have.power, power); return false }
  list.push({ kind, t, total: t, power, stacks: 1, acc: 0, pulseT: 0 })
  return true
}
export const hasStatus = (list: readonly Status[] | undefined, kind: StatusKind) => !!list?.some(x => x.kind === kind && x.t > 0)

/**
 * 한 걸음 — 물기운은 남은 시간만큼 dt 에 비례해 총량을 고르게 채운다 (마지막 걸음은 남은 시간만큼만).
 * emit(종류, 양) 은 펄스 초마다(끝날 때 마지막 한 번) 한 번 — 판이 받아 화면 숫자로 쓴다.
 * give(양) 은 판이 받아 체력에 더하고 실제로 찬 양을 돌려준다 · 꽉 차서 못 받은 만큼은 사라진다.
 */
export function tickStatuses(list: Status[], dt: number, give: (amount: number) => number, emit: (kind: StatusKind, amount: number) => void) {
  for (let i = list.length - 1; i >= 0; i--) {
    const b = list[i]!
    const step = Math.min(dt, b.t)
    if (b.kind === 'water' && step > 0) {
      const got = give(b.power * step / b.total)
      b.acc += got; b.pulseT += step
      if (b.pulseT >= B2.well.pulse - 1e-9 || b.t - step <= 1e-9) { const n = Math.round(b.acc); if (n > 0) { emit(b.kind, n); b.acc = 0 } b.pulseT = 0 }
    }
    b.t -= step
    if (b.t <= 1e-9) list.splice(i, 1)
  }
}

/** 적에게 붙은 디버프 목록 (읽기 전용 · 화면과 시험이 쓴다) */
export function mobStatuses(e: Statused): Status[] {
  const out: Status[] = []
  const add = (kind: StatusKind, t: number, power: number, stacks = 1) => { if (t > 0) out.push({ kind, t, total: ST.ref[kind], power, stacks, acc: 0, pulseT: 0 }) }
  add('poison', e.poison, e.pdps, Math.max(1, e.stack ?? 1))
  add('slow', e.slow ?? 0, 0)
  add('daze', e.daze, 0)
  return out
}
