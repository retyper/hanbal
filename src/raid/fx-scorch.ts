/**
 * 그을린 자국 (형 11-23 「홍련 부적은 폭발이 너무 짧다 · 폭발 자리에 탄 흔적이라도 남겼다 사라지게」) — 화면 전용.
 * 내 불빛 폭발(blast · 따뜻한 색 = 홍련 부적 · 뇌화)이 처음 보이면 그 자리를 적어 두고, 땅 표식 차례에 검게 그을린 자국 + 꺼져 가는 불씨를 그린다.
 * 판(haebi.ts)은 읽기만 한다 · 시계는 판 시각(s.t)이라 멈춤·숨은 탭에서 같이 멈춘다 · 자국 그림은 한 번 구워 다시 쓴다.
 */
import { HAEBI_SCORCH as S } from '../tune/params.ts'
import type { Effect, HaebiRun } from './haebi.ts'

interface Mark { x: number; y: number; r: number; t: number; seed: number }
let marks: Mark[] = []
let runOf: HaebiRun | null = null
let seen = new WeakSet<Effect>()
let stamp: HTMLCanvasElement | null = null

/** 따뜻한 빛(불)인가 — 찬 빛(화살비·혼불)은 자국을 남기지 않는다 */
const warm = (hex: string) => { const n = parseInt(hex.slice(1, 7), 16); return ((n >> 16) & 255) > ((n & 255) + 40) }

/** 이번 판의 새 불 폭발을 자국으로 적는다 · foe 는 적이 던진 것 (자국 없음) */
export function trackScorch(s: HaebiRun, foe: (f: Effect) => boolean) {
  if (runOf !== s || (marks.length && s.t < marks[marks.length - 1]!.t)) { runOf = s; marks = []; seen = new WeakSet() }
  for (const f of s.fx) {
    if (f.kind !== 'blast' || seen.has(f)) continue
    seen.add(f)
    if (foe(f) || !warm(f.color)) continue
    marks.push({ x: f.x, y: f.y, r: f.r, t: s.t, seed: (Math.abs(Math.round(f.x * 7 + f.y * 13)) % 997) / 997 })
  }
  while (marks.length && (s.t - marks[0]!.t > S.life || marks.length > S.max)) marks.shift()
}

/** 그을린 자국 한 장 (가운데 검고 가장자리로 번지는 갈색 · 한 번 굽는다) */
function scorchStamp(): HTMLCanvasElement | null {
  if (stamp) return stamp
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas'); c.width = c.height = S.bake
  const g = c.getContext('2d')!, h = S.bake / 2
  const grad = g.createRadialGradient(h, h, 0, h, h, h)
  grad.addColorStop(0, S.core); grad.addColorStop(.55, S.mid); grad.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grad; g.fillRect(0, 0, S.bake, S.bake)
  stamp = c; return c
}

/** 땅 표식 차례에 — 오래될수록 옅어진다 · 처음 얼마 동안 불씨가 깜빡이며 꺼진다 */
export function drawScorch(ctx: CanvasRenderingContext2D, s: HaebiRun) {
  if (!marks.length) return
  const img = scorchStamp(); if (!img) return
  const a0 = ctx.globalAlpha
  for (const m of marks) {
    const age = s.t - m.t; if (age < 0) continue
    const fade = age < S.life - S.fadeOut ? 1 : Math.max(0, (S.life - age) / S.fadeOut)
    const w = m.r * S.size, h = w * S.squash
    ctx.globalAlpha = a0 * S.alpha * fade
    ctx.drawImage(img, m.x - w, m.y - h, w * 2, h * 2)
    // 불씨: 자국 안 몇 점이 깜빡이다 꺼진다
    if (age < S.emberLife) {
      const k = 1 - age / S.emberLife
      ctx.fillStyle = S.ember
      for (let i = 0; i < S.embers; i++) {
        const u = (m.seed * 7.13 + i * .618) % 1, v = (m.seed * 3.71 + i * .382) % 1
        const ex = m.x + (u - .5) * w * 1.3, ey = m.y + (v - .5) * h * 1.3
        ctx.globalAlpha = a0 * k * (.55 + .45 * Math.sin(s.t * S.flicker + i * 2.1))
        ctx.fillRect(Math.round(ex) - S.emberPx / 2, Math.round(ey) - S.emberPx / 2, S.emberPx, S.emberPx)
      }
    }
  }
  ctx.globalAlpha = a0
}
