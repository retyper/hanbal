/**
 * 입력 기록 — 한 줄 `b36(틱),g,op,b36(u),b36(v)` 를 `;` 로 잇는다 (열전 src/raid/runlog.ts 의 b36 줄이기를 본받음).
 * 화면은 틱 번호만 적어 sim 에 넘긴다 (화면 상태가 sim 에 새지 않는다). 한 판 평균 20~60줄 · 1KB 안쪽.
 */
import type { FieldInput, InputGroup } from './types.ts'

const b36 = (n: number): string => n.toString(36)
const NUM = /^-?[0-9a-z]+$/

export function serialize(inputs: readonly FieldInput[]): string {
  return inputs.map(i => `${b36(i.tick)},${i.g},${i.op},${b36(i.u)},${b36(i.v)}`).join(';')
}

/** 깨진 줄이 하나라도 있으면 null (부분 재생으로 다른 판이 되는 것을 막는다) */
export function parse(text: string): FieldInput[] | null {
  if (text === '') return []
  const out: FieldInput[] = []
  for (const line of text.split(';')) {
    const f = line.split(',')
    if (f.length !== 5 || !NUM.test(f[0]!) || !/^[0-4]$/.test(f[1]!) || !/^[0-9]+$/.test(f[2]!) || !NUM.test(f[3]!) || !NUM.test(f[4]!)) return null
    out.push({ tick: parseInt(f[0]!, 36), g: Number(f[1]) as InputGroup, op: Number(f[2]), u: parseInt(f[3]!, 36), v: parseInt(f[4]!, 36) })
  }
  return out
}
