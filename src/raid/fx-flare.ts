/**
 * 타격 섬광 (GAP §15-1 · 형 11-22 「5시간짜리 AI 게임보다 재밌어야지」 → 때리는 순간이 눈에 꽂히게).
 * 맞는 순간 2~3 프레임 동안 한쪽으로 긴 십자 빛살 + 하얀 마름모 심 + 짧은 빛 번짐 · 치명타는 더 크고 고리 하나.
 * 모양과 시간 나눔은 pixelfx 「Hit spark」·「Crit hit」(MIT · Copyright (c) 2026 Patch · github.com/patch-gg/pixelfx · 그 원본은
 * Sprite Fusion 「impact」 MIT · Copyright (c) 2026 Hugo Duprez) 를 보고 이 게임 화면(도트 칸 크기 · 판 좌표)에 맞춰 새로 쓴 것.
 * 화면 전용 — 판(haebi.ts)을 읽기만 한다 · 난수 없이 효과 자리로 결을 바꾼다 · 숫자는 전부 HAEBI_HIT_FLARE.
 */
import { HAEBI_HIT_FLARE as F } from '../tune/params.ts'
import type { Effect } from './haebi.ts'

const RAYS = F.rays

/** 자리로 정하는 0~1 (같은 타격은 늘 같은 모양) */
function hash01(x: number, y: number, k: number): number {
  const v = Math.sin(x * 12.9898 + y * 78.233 + k * 37.719) * 43758.5453
  return v - Math.floor(v)
}

function rayColor(u: number, crit: boolean): string {
  const c = crit ? F.critColors : F.colors
  return u < F.whiteUntil ? '#ffffff' : u < F.paleUntil ? c[0]! : u < F.warmUntil ? c[1]! : c[2]!
}

/** 한 줄 빛살: 뿌리는 굵고 끝은 머리카락 · 하양에서 바깥으로 식는다 · 칸(px) 단위로 끊어 도트처럼 */
function ray(ctx: CanvasRenderingContext2D, x: number, y: number, a: number, len: number, width: number, px: number, crit: boolean) {
  const c = Math.cos(a), s = Math.sin(a)
  for (let d = 0; d <= len; d += px) {
    const u = d / len, hw = width * Math.pow(1 - u, F.taper)
    ctx.fillStyle = rayColor(u, crit)
    const cx = Math.round((x + c * d) / px) * px, cy = Math.round((y + s * d) / px) * px
    ctx.fillRect(cx - px / 2, cy - px / 2, px, px)
    for (let o = px; o <= hw; o += px) for (const e of [-o, o]) {
      const ex = Math.round((x + c * d - s * e) / px) * px, ey = Math.round((y + s * d + c * e) / px) * px
      ctx.fillRect(ex - px / 2, ey - px / 2, px, px)
    }
  }
}

/** 하얀 마름모 심 + 옅은 테 */
function diamond(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, px: number, rim: string) {
  for (let dy = -r - 1; dy <= r + 1; dy++) for (let dx = -r - 1; dx <= r + 1; dx++) {
    const m = Math.abs(dx) + Math.abs(dy)
    if (m > r + 1) continue
    ctx.fillStyle = m <= r ? '#ffffff' : rim
    ctx.fillRect(Math.round(x / px) * px + dx * px - px / 2, Math.round(y / px) * px + dy * px - px / 2, px, px)
  }
}

/** 맞은 불꽃(hit) 하나의 섬광 — age 는 0~1 (효과 수명 비율) */
export function drawHitFlare(ctx: CanvasRenderingContext2D, f: Effect, age: number) {
  const t = age * f.total
  if (t > F.glowTime) return
  const crit = f.crit === true, big = f.mob === 'elite' || f.mob === 'boss'
  const scale = (crit ? F.critScale : 1) * (big ? F.bigScale : 1), px = F.px
  const aim = ((f.face ?? -1) > 0 ? Math.PI : 0) + (hash01(f.x, f.y, 1) - .5) * F.aimJitter
  const x = f.x, y = f.y - F.lift
  ctx.save()
  // 빛 번짐 — 작은 둥근 빛 하나 (화면 가득한 필터 아님 · 폰 그래픽 한도)
  const g = Math.max(0, 1 - t / F.glowTime)
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = g * (crit ? F.critGlowAlpha : F.glowAlpha)
  const R = F.glowRadius * scale
  const grad = ctx.createRadialGradient(x, y, 0, x, y, R)
  grad.addColorStop(0, crit ? F.critColors[0]! : F.colors[0]!); grad.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = grad; ctx.fillRect(x - R, y - R, R * 2, R * 2)
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
  if (t < F.flashTime) {
    // 첫 번쩍: 십자 전부 + 마름모
    for (let i = 0; i < RAYS.length; i++) {
      const r = RAYS[i]!, a = aim + r.a + (hash01(f.x, f.y, i + 2) - .5) * F.tilt
      ray(ctx, x, y, a, (r.len + hash01(f.y, f.x, i) * r.vary) * scale, r.w * scale, px, crit)
    }
    diamond(ctx, x, y, Math.round(F.core * scale), px, crit ? F.critColors[1]! : F.colors[1]!)
  } else if (t < F.afterTime) {
    // 두 번째 칸: 긴 빛살만 짧게 + 작은 심
    const r = RAYS[0]!
    ray(ctx, x, y, aim, r.len * F.afterLen * scale, r.w * F.afterLen * scale, px, crit)
    diamond(ctx, x, y, Math.max(1, Math.round(F.core * F.afterLen * scale)), px, crit ? F.critColors[1]! : F.colors[1]!)
  }
  // 치명타: 퍼지는 고리 하나
  if (crit && t < F.ringTime) {
    const u = t / F.ringTime
    ctx.globalAlpha = 1 - u; ctx.strokeStyle = F.critColors[0]!; ctx.lineWidth = px
    ctx.beginPath(); ctx.arc(x, y, F.ringFrom + (F.ringTo - F.ringFrom) * u, 0, Math.PI * 2); ctx.stroke()
  }
  ctx.restore()
}
