/**
 * 최고 레벨 화면 (형 11-23 「레벨은 왜 44가 맥스지? 맥스 찍었다는 걸 유저가 알기도 어려운데」) — 판은 읽기만 한다 · 시계는 판 시각 s.t · 글자·크기는 HAEBI_CAP_VIEW.
 * ① 최고 레벨에 처음 닿은 순간 장수 위로 큰 글자 「수련을 모두 마쳤습니다」 (「부위 파괴!」와 같은 결 · 판마다 한 번 · 규칙과 상관없이)
 * ② 66-CAP 보상(fx.capGold)마다 장수 위로 작은 「+N금 · 회복」
 */
import { HAEBI_CAP_VIEW as V } from '../tune/params.ts'
import { maxLevel, type Effect, type HaebiRun } from './haebi.ts'

interface Pop { x: number; y: number; t: number; gold: number; boss?: boolean }
let runOf: HaebiRun | null = null
/** 큰 글자를 띄운 판 시각 (없으면 null) */
let bannerAt: number | null = null
let pops: Pop[] = []
let seen = new WeakSet<Effect>()

export function trackCap(s: HaebiRun) {
  if (runOf !== s) { runOf = s; bannerAt = null; pops = []; seen = new WeakSet() }
  if (bannerAt === null && s.level >= maxLevel(s)) bannerAt = s.t
  for (const f of s.fx) if ((f.capGold !== undefined || f.bossGold !== undefined) && !seen.has(f)) { seen.add(f); pops.push({ x: f.x, y: f.y, t: s.t, gold: f.capGold ?? f.bossGold!, boss: f.bossGold !== undefined }) }
  while (pops.length && s.t - pops[0]!.t > (pops[0]!.boss ? V.bannerLife : V.popLife)) pops.shift()
}

function text(ctx: CanvasRenderingContext2D, line: string, x: number, y: number, size: number, stroke: number, fill: string, alpha: number, scale: number) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(x, y); ctx.scale(scale, scale)
  ctx.font = `900 ${size}px "Noto Serif KR", serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.lineWidth = stroke; ctx.strokeStyle = V.edge; ctx.strokeText(line, 0, 0)
  ctx.fillStyle = fill; ctx.fillText(line, 0, 0)
  ctx.restore()
}

/** 큰 글자 — 처음 popTime 에 크게 튀어나왔다가 자리 잡고 떠오르며 옅어진다 · 보상 글자 — 작게 떠오르며 옅어진다 */
export function drawCap(ctx: CanvasRenderingContext2D, s: HaebiRun) {
  if (bannerAt !== null) {
    const age = s.t - bannerAt
    if (age >= 0 && age < V.bannerLife) {
      const pop = age < V.popTime ? V.popScale - (V.popScale - 1) * (age / V.popTime) : 1
      const a = age < V.bannerLife - V.fadeTime ? 1 : Math.max(0, (V.bannerLife - age) / V.fadeTime)
      text(ctx, V.banner, s.x, s.y - V.lift - age * V.rise, V.size, V.stroke, V.fill, a, pop)
    }
  }
  for (const p of pops) {
    const age = s.t - p.t; if (age < 0) continue
    // 68-BOSSCHEST 올릴 것이 없던 보스 상자의 금 — 크게 · 오래
    if (p.boss) { if (age < V.bannerLife) text(ctx, `보스 전리품 +${p.gold}금`, p.x, p.y - V.lift - age * V.rise, V.size, V.stroke, V.fill, Math.min(1, (V.bannerLife - age) / V.fadeTime), age < V.popTime ? V.popScale - (V.popScale - 1) * age / V.popTime : 1); continue }
    text(ctx, `+${p.gold}금 · 회복`, p.x, p.y - V.popLift - age / V.popLife * V.popRise, V.popSize, V.popStroke, V.popFill, Math.max(0, 1 - age / V.popLife), 1)
  }
}
