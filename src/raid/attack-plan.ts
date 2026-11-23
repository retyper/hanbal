/**
 * 띠마다 공격 칸 계획 (11-23 · 참고 연구: 잘 만든 2D 액션의 기본 공격은 그린 칸 9~11 장을 50ms 남짓씩 · 마지막 칸을 150ms 쯤 붙든다) — 화면만.
 * 판이 피해를 주는 때는 판이 정한다. 화면은 맞힘 칸(hit)이 그때 보이게 칸 차례를 늘이거나 줄일 뿐이다 (판 셈 그대로).
 *   cells 칸들 · times 칸마다 초(cells 와 같은 길이) · hit 맞힘 칸의 차례(0 부터).
 * planAttackCell: 공격 시계 age 초에 보일 칸 — hitAt 초에 hit 칸이 서고 end 초까지가 한 번의 공격.
 *   hit 앞 칸들은 hitAt 안에 들게(길면 줄이고 · 짧으면 첫 칸을 붙들었다 시작) · hit 칸은 제 초 그대로(줄이지 않는다) ·
 *   hit 뒤 칸들은 남은 시간 안에(길면 줄이고 · 짧으면 마지막 칸을 end 까지 붙든다) · end 를 넘으면 null(서기·걷기로).
 */
export interface AttackPlan { readonly cells: readonly number[]; readonly times: readonly number[]; readonly hit: number }

const sum = (a: readonly number[]) => a.reduce((n, x) => n + x, 0)
/** 칸 차례 cells·times 를 길이 span 안에서 t 초 때의 칸으로 (넘치면 비율로 줄이고 · 모자라면 마지막 칸) */
function within(cells: readonly number[], times: readonly number[], t: number, span: number): number {
  const total = sum(times), k = total > span && total > 0 ? span / total : 1
  let left = t
  for (let i = 0; i < cells.length; i++) { left -= times[i]! * k; if (left < 0) return cells[i]! }
  return cells[cells.length - 1]!
}
export function planAttackCell(p: AttackPlan, age: number, hitAt: number, end: number, held = false): number | null {
  const hit = Math.max(0, Math.min(p.cells.length - 1, p.hit)), hitEnd = hitAt + p.times[hit]!
  if (age >= end && !(held && age < hitEnd)) return null
  // 맞은 순간 멈춤(held) 동안은 맞힘 칸에 머문다 (열전 맞은 멈춤과 같다)
  if (held && age < hitEnd) return p.cells[hit]!
  if (age < hitAt) {
    const pre = p.cells.slice(0, hit), pt = p.times.slice(0, hit)
    if (!pre.length) return p.cells[hit]!
    const lead = Math.max(0, hitAt - sum(pt))   // 짧으면 첫 칸을 붙들었다가 hit 직전에 끝나게
    return age < lead ? pre[0]! : within(pre, pt, age - lead, hitAt - lead)
  }
  if (age < hitEnd) return p.cells[hit]!
  const post = p.cells.slice(hit + 1), qt = p.times.slice(hit + 1)
  return post.length ? within(post, qt, age - hitEnd, Math.max(0, end - hitEnd)) : p.cells[hit]!
}
/** 공격 계획의 길이(초) · 맞힘 칸까지의 길이 — 시험·화면이 늘임·줄임을 셈한다 */
export const planLength = (p: AttackPlan) => sum(p.times)
export const planLead = (p: AttackPlan) => sum(p.times.slice(0, p.hit))
