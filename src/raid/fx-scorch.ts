/**
 * 그을린 자국 (형 11-23 「홍련 부적은 폭발이 너무 짧다 · 폭발 자리에 탄 흔적이라도 남겼다 사라지게」) — 화면 전용.
 * 내 불빛 폭발(blast · 따뜻한 색 = 홍련 부적 · 뇌화)이 처음 보이면 그 자리를 적어 두고, 땅 표식 차례에 검게 그을린 자국 + 꺼져 가는 불씨를 그린다.
 * 판(haebi.ts)은 읽기만 한다 · 시계는 판 시각(s.t)이라 멈춤·숨은 탭에서 같이 멈춘다 · 자국 그림은 한 번 구워 다시 쓴다.
 */
import { HAEBI_SCORCH as S } from '../tune/params.ts'
import type { Effect, HaebiRun } from './haebi.ts'
import { slamWatcher } from './slam-watch.ts'

interface Mark { x: number; y: number; r: number; t: number; seed: number; burn: boolean; wave?: boolean }
let marks: Mark[] = []
let runOf: HaebiRun | null = null
let seen = new WeakSet<Effect>()
const slams = slamWatcher()   // 보스 「쿵」 · 장수급 적 내려찍기 자리 (11-23 형 「보스가 쿵」)
let stamp: HTMLCanvasElement | null = null, crater: HTMLCanvasElement | null = null

/** 따뜻한 빛(불)인가 — 찬 빛(화살비·혼불)은 자국을 남기지 않는다 */
const warm = (hex: string) => { const n = parseInt(hex.slice(1, 7), 16); return ((n >> 16) & 255) > ((n & 255) + 40) }

/** 이번 판의 새 불 폭발을 자국으로 적는다 · foe 는 적이 던진 것 (자국 없음) */
export function trackScorch(s: HaebiRun, foe: (f: Effect) => boolean) {
  if (runOf !== s || (marks.length && s.t < marks[marks.length - 1]!.t)) { runOf = s; marks = []; seen = new WeakSet() }
  for (const f of s.fx) {
    if (seen.has(f)) continue
    // 땅을 때린 것만: 폭발(blast) · 기술 내려찍기(skill · 각성 아닌 ult) · 돌팔매 떨어짐(thud) · 솟는 가시(spike) (11-23 형 「폭발·파괴 기술은 다 땅에 자국을」)
    const ground = f.kind === 'blast' || f.kind === 'thud' || f.kind === 'spike' || f.kind === 'skill' || (f.kind === 'ult' && !f.awakened && !f.tru)
    if (!ground) continue
    seen.add(f)
    if (f.r < S.minR) continue
    const burn = f.kind === 'blast' && !foe(f) && warm(f.color)
    marks.push({ x: f.x, y: f.y, r: Math.min(f.r, S.maxR), t: s.t, seed: (Math.abs(Math.round(f.x * 7 + f.y * 13)) % 997) / 997, burn })
  }
  for (const q of slams(s)) marks.push({ x: q.x, y: q.y, r: Math.min(q.boss ? S.quakeR : q.r, S.maxR), t: s.t, seed: (Math.abs(Math.round(q.x * 7 + q.y * 13)) % 997) / 997, burn: false, wave: true })
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

/** 패인 흙 자국 (가운데 어두운 흙 · 가장자리 밝은 흙 고리 · 한 번 굽는다) */
function craterStamp(): HTMLCanvasElement | null {
  if (crater) return crater
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas'); c.width = c.height = S.bake
  const g = c.getContext('2d')!, h = S.bake / 2
  const grad = g.createRadialGradient(h, h, 0, h, h, h)
  grad.addColorStop(0, S.dirtCore); grad.addColorStop(.6, S.dirtMid); grad.addColorStop(.82, S.dirtRim); grad.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grad; g.fillRect(0, 0, S.bake, S.bake)
  crater = c; return c
}
/** 땅 표식 차례에 — 오래될수록 옅어진다 · 처음 얼마 동안 불씨가 깜빡이며 꺼진다 */
export function drawScorch(ctx: CanvasRenderingContext2D, s: HaebiRun) {
  if (!marks.length) return
  const burnImg = scorchStamp(), dirtImg = craterStamp(); if (!burnImg || !dirtImg) return
  const a0 = ctx.globalAlpha
  for (const m of marks) {
    const img = m.burn ? burnImg : dirtImg
    const age = s.t - m.t; if (age < 0) continue
    const fade = age < S.life - S.fadeOut ? 1 : Math.max(0, (S.life - age) / S.fadeOut)
    const w = m.r * S.size, h = w * S.squash
    ctx.globalAlpha = a0 * (m.burn ? S.alpha : S.dirtAlpha) * fade
    ctx.drawImage(img, m.x - w, m.y - h, w * 2, h * 2)
    // 땅 울림 충격파: 흙빛 고리가 퍼지며 가늘어진다 (보스 「쿵」 · 내려찍기)
    if (m.wave && age < S.waveLife) {
      const k = age / S.waveLife, rr = m.r * (.4 + k * S.waveGrow)
      ctx.globalAlpha = a0 * (1 - k) * S.waveAlpha; ctx.strokeStyle = S.waveColor; ctx.lineWidth = S.waveWidth * (1 - k) + 1
      ctx.beginPath(); ctx.ellipse(m.x, m.y, rr, rr * S.squash, 0, 0, Math.PI * 2); ctx.stroke()
    }
    // 불씨: 자국 안 몇 점이 깜빡이다 꺼진다
    if (m.burn && age < S.emberLife) {
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
