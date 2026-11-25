/**
 * 화살비(C) — 활에서 날아가는 긴 줄이 아니라 과녁에 떨어지는 비:
 *  찍은 테 안과 그 위쪽 하늘에만, 짧은 화살이 같은 각도(활 쪽에서 과녁 쪽으로 기움)로 빠르게 떨어지고
 *  떨어진 자리에 잠깐 박힌 화살과 먼지 점이 남는다. 활 쪽에서는 쏘아 올리는 짧은 줄이 위로 사라지는 것만.
 * 그리는 쪽 전용 · 낱낱 그림 · 동시에 떠 있는 수는 rainSlots 이하.
 */
import { P } from '../tune/params.ts'
import { hash2 } from './viewDots.ts'
import { spawn } from './viewMelee.ts'

const DEG = Math.PI / 180
const landed = new Map<number, number>()
export function resetRain(): void { landed.clear() }

/** rings: [x, y, 기울기 부호] 반복 (판 px) · launches: [x, y] 반복 (활 대 가운데) */
export function drawRain(ctx: CanvasRenderingContext2D, nowMs: number, zoom: number, rings: readonly number[], launches: readonly number[]): void {
  const F = P.field
  if (rings.length === 0) return
  const R = F.volleyRadiusCells * F.cellPx, dx = Math.cos(F.rainAngleDeg * DEG), dy = Math.sin(F.rainAngleDeg * DEG)
  const fall = F.rainFallMs, cyc = F.rainCycleMs, slots = F.rainSlots, len = F.rainLenPx
  const lw = Math.max(1.5, 1.5 / zoom)
  ctx.lineCap = 'round'
  // 떨어지는 화살: 어두운 갈색 자루 · 꼬리 잔상 한 장 · 밝은 촉 한 점
  const flying: number[] = [] // x, y, sgn, age 반복 (낱낱 한 번에 그린다)
  const stuck: number[] = []
  for (let r = 0; r < rings.length; r += 3) {
    const cx = rings[r]!, cy = rings[r + 1]!, sg = rings[r + 2]!
    for (let i = 0; i < slots; i++) {
      const t0 = nowMs + (i * 997) % cyc, cycle = Math.floor(t0 / cyc), age = t0 - cycle * cyc
      const hh = hash2(r * 131 + i, cycle), ang = (hh % 6283) / 1000, rad = Math.sqrt(((hh >>> 8) % 1000) / 1000) * R * 0.95
      const lx = cx + Math.cos(ang) * rad, ly = cy + Math.sin(ang) * rad * 0.8
      if (age < fall) {
        const t = age / fall
        flying.push(lx - sg * dx * F.rainSkyPx * (1 - t), ly - dy * F.rainSkyPx * (1 - t), sg, 0)
      } else if (age < fall + F.rainStickMs) {
        stuck.push(lx, ly, sg, 0)
        if ((hh >>> 4) % 2 === 0 && landed.get(r * 131 + i) !== cycle) { landed.set(r * 131 + i, cycle); spawn(0, lx, ly, (hh % 7) - 3, -4, nowMs, F.dustMs * 0.7, F.cellPx * 0.1) }
      }
    }
  }
  const draw = (arr: readonly number[], color: string, alpha: number, ext: number, head: boolean): void => {
    if (arr.length === 0) return
    ctx.strokeStyle = color; ctx.globalAlpha = alpha; ctx.lineWidth = lw
    ctx.beginPath()
    for (let i = 0; i < arr.length; i += 4) {
      const x = arr[i]!, y = arr[i + 1]!, sg = arr[i + 2]!
      ctx.moveTo(x - sg * dx * len * ext, y - dy * len * ext); ctx.lineTo(x, y)
    }
    ctx.stroke()
    if (head) {
      ctx.fillStyle = '#f4ead0'; ctx.beginPath()
      for (let i = 0; i < arr.length; i += 4) ctx.rect(arr[i]! - 1, arr[i + 1]! - 1, 2, 2)
      ctx.fill()
    }
  }
  draw(flying, '#3a2a18', 0.25, 2.2, false) // 꼬리 잔상
  draw(flying, '#3a2a18', 1, 1, true)
  // 박힌 화살: 짧은 줄을 거의 세워
  if (stuck.length > 0) {
    ctx.strokeStyle = '#3a2a18'; ctx.globalAlpha = 0.9; ctx.lineWidth = lw; ctx.beginPath()
    for (let i = 0; i < stuck.length; i += 4) { ctx.moveTo(stuck[i]! - stuck[i + 2]! * 2, stuck[i + 1]! - len * 0.45); ctx.lineTo(stuck[i]!, stuck[i + 1]!) }
    ctx.stroke()
  }
  // 쏘아 올리는 짧은 줄 (활 대마다 1초에 한 번 · 위로 사라진다)
  if (launches.length > 0) {
    ctx.strokeStyle = '#f4ead0'; ctx.lineWidth = lw; ctx.beginPath()
    ctx.globalAlpha = 0.8
    for (let i = 0; i < launches.length; i += 3) {
      const ph = (nowMs + launches[i + 2]!) % 1000
      if (ph > 300) continue
      const up = ph / 300 * F.cellPx * 5
      ctx.moveTo(launches[i]!, launches[i + 1]! - F.cellPx * 1.5 - up); ctx.lineTo(launches[i]!, launches[i + 1]! - F.cellPx * 1.5 - up - len)
    }
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}
