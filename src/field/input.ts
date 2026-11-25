/**
 * 고른 것 → 입력 줄 번역 (docs/realm/battle-study/50-control-v2.md · 「눌러서 고르고, 찍어서 보낸다」). 순수 함수 — 화면·DOM 을 모른다.
 * 보내기 = 고른 것마다 입력 하나(그 자리로) · 명령 단추 = 그 무리 입력 하나 · 같은 단추를 다시 누르면 「알아서」.
 * 명령 수 제한·다시 몰기 제한은 없다 (50 「없애는 것」). 길게 누름·끌기 손짓의 뜻도 없다 — 명령은 단추로만.
 * 적 위를 찍어도 엔진에 「그 적을 쳐라」(OP_ATTACK)가 오기 전에는 그 적의 자리로 가는 입력(OP_MOVE)을 낸다.
 */
import { OP_AUTO, OP_MOVE, OP_STANCE, type FieldInput, type InputGroup } from './types.ts'

/**
 * 무리마다 제 명령 (본편 전투 화면의 그 명령들 · 이름·그림은 war.cmdName.* 와 flag/flag-<이름>.png). 순서가 곧 OP_STANCE 의 u 이다:
 * 앞줄 0 돌격 · 1 방진 · 2 길 트기 / 활 0 화살비 · 1 맞쏘기 / 기병 0 옆치기 · 1 돌파 · 2 추격 · 3 호위
 */
export const CMDS: readonly (readonly string[])[] = [['charge', 'hold', 'open'], ['volley', 'counter'], ['flank', 'punch', 'pursue', 'guard']]
export type CmdGroup = 0 | 1 | 2

export interface InputCtx {
  /** 이 입력이 들어갈 틱 (시작 화면에서는 0) */
  tick: number
  mapUUnits: number
  mapVUnits: number
}

const clampInt = (n: number, hi: number): number => Math.max(0, Math.min(hi, Math.round(n)))

/** 고른 것 모두를 (u, v)(sim 단위)로 보낸다 — 무리마다 입력 하나 · 맵 밖은 맵 안으로 붙는다 */
export function sendInputs(sel: readonly InputGroup[], u: number, v: number, ctx: InputCtx): FieldInput[] {
  const pu = clampInt(u, ctx.mapUUnits), pv = clampInt(v, ctx.mapVUnits)
  return sel.map(g => ({ tick: ctx.tick, g, op: OP_MOVE, u: pu, v: pv }))
}

/** 명령 단추 (g 무리의 idx 번째): 지금 그 명령(고른 채)이면 「알아서」 (OP_AUTO) · 아니면 그 명령 (OP_STANCE · u = idx) */
export function cmdInput(g: CmdGroup, idx: number, current: number, ctx: InputCtx): FieldInput {
  if (current === idx) return { tick: ctx.tick, g, op: OP_AUTO, u: 0, v: 0 }
  return { tick: ctx.tick, g, op: OP_STANCE, u: idx, v: 0 }
}

/** 입력 줄에서 같은 무리의 같은 갈래를 새 입력으로 바꾼다 (시작 화면에서 꽂아 둔 것 · 알아서는 그 무리의 자리·자세를 비운다) */
export function mergePlan(plan: readonly FieldInput[], add: readonly FieldInput[]): FieldInput[] {
  let out = plan.slice()
  for (const i of add) {
    out = out.filter(x => !(x.g === i.g && (x.op === i.op || i.op === OP_AUTO)))
    out.push(i)
  }
  return out
}
