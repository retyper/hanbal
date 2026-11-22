/**
 * 부위 파괴가 느껴지게 — 화면 쪽 (docs/realm/RAID-BOSS-SIEGE-20261123.md §2 · 64-BREAK · 형 11-23 「그로기도 없고 알 수도 없어 허무」).
 * ① 부서진 순간 「부위 파괴!」 글자가 크게 튀어 오른다(WWE 오버액션 · 메모리 wwe-overreaction-ux) ② 그로기(멈춰 선) 동안 머리 위에 별이 돈다.
 * 판은 읽기만 한다 · 시계는 판 시각(s.t) · 글자·색·크기는 HAEBI_BREAK_VIEW.
 */
import { HAEBI_BREAK_VIEW as V } from '../tune/params.ts'
import type { Effect, HaebiRun, Mob } from './haebi.ts'
import { giantPart } from './giant.ts'

interface Burst { x: number; y: number; t: number }
let bursts: Burst[] = []
let runOf: HaebiRun | null = null
let seen = new WeakSet<Effect>()

export function trackBreaks(s: HaebiRun) {
  if (runOf !== s) { runOf = s; bursts = []; seen = new WeakSet() }
  for (const f of s.fx) if (f.partBreak && !seen.has(f)) { seen.add(f); bursts.push({ x: f.x, y: f.y, t: s.t }) }
  while (bursts.length && s.t - bursts[0]!.t > V.textLife) bursts.shift()
}

/** 「부위 파괴!」 — 처음 0.12초에 크게 튀어나왔다가 자리 잡고 위로 떠오르며 옅어진다 */
export function drawBreakText(ctx: CanvasRenderingContext2D, s: HaebiRun) {
  for (const b of bursts) {
    const age = s.t - b.t; if (age < 0) continue
    const pop = age < V.popTime ? V.popScale - (V.popScale - 1) * (age / V.popTime) : 1
    const a = age < V.textLife - V.fadeTime ? 1 : Math.max(0, (V.textLife - age) / V.fadeTime)
    ctx.save()
    ctx.globalAlpha = a
    ctx.translate(b.x, b.y - V.lift - age * V.rise); ctx.scale(pop, pop)
    ctx.font = `900 ${V.size}px "Noto Serif KR", serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.lineWidth = V.stroke; ctx.strokeStyle = V.edge; ctx.strokeText(V.text, 0, 0)
    ctx.fillStyle = V.fill; ctx.fillText(V.text, 0, 0)
    ctx.restore()
  }
}

/** 그로기 — 머리(없으면 몸) 위로 별 몇 개가 빙글 돈다 */
export function drawGroggy(ctx: CanvasRenderingContext2D, s: HaebiRun, e: Mob) {
  if (!s.breakOn || !e.giant || e.daze <= 0 || e.hp <= 0) return
  const head = giantPart(e.giant, 'head')
  const hx = head ? (head.start.x + head.end.x) / 2 : e.x, hy = (head ? Math.min(head.start.y, head.end.y) : e.y - V.bodyLift) - V.starLift
  ctx.save()
  for (let i = 0; i < V.stars; i++) {
    const a = s.t * V.spin + i * Math.PI * 2 / V.stars, x = hx + Math.cos(a) * V.orbit, y = hy + Math.sin(a) * V.orbit * .35
    ctx.globalAlpha = .55 + .45 * Math.sin(a)
    ctx.fillStyle = V.star
    ctx.beginPath()
    for (let k = 0; k < 10; k++) { const r = k % 2 ? V.starSize * .45 : V.starSize, q = k * Math.PI / 5 - Math.PI / 2; ctx[k ? 'lineTo' : 'moveTo'](x + Math.cos(q) * r, y + Math.sin(q) * r) }
    ctx.closePath(); ctx.fill()
  }
  ctx.restore()
}
