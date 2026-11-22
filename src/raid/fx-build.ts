/**
 * 65-BUILD 설치물 그림 — 망루 · 목책 · 항아리 (판은 읽기만 한다 · 시계는 판 시각 s.t · 수치는 HAEBI_BUILD.view).
 * 새 그림 없이 빌린다: 망루·목책 = 넓은 맵 목책 판 장식(palisade-2 · palisade-0 · 부서진 palisade-1) · 항아리 = 본편 장 항아리 그림.
 * 땅 차례(drawBuildGround): 항아리가 기세를 더하는 둘레를 옅은 금빛 고리로 (규칙이 보이게).
 * 몸 차례(drawStructure): 위에서 아래로 그리는 줄에 끼어 적·장수와 앞뒤가 맞는다.
 */
import { HAEBI_BUILD as B } from '../tune/params.ts'
import type { HaebiRun } from './haebi.ts'
import { jarRadius, type Structure } from './build.ts'

const V = B.view
const ART = { tower: 'raid/props/palisade-2.webp', fence: 'raid/props/palisade-0.webp', broken: 'raid/props/palisade-1.webp', jar: 'icon/good-soybean-jar.png' } as const
/** 미리 받아 둘 그림 — 망루·목책은 넓은 맵 장식(PROP_PATHS)에 이미 있어 항아리만 */
export const BUILD_PATHS = [ART.jar]

/** 놓일 때 솟아오르고(pop) 걷힐 때 옅어진다(fade) */
const pop = (s: HaebiRun, it: Structure) => { const k = Math.min(1, Math.max(0, (s.t - it.born) / V.pop)); return V.popFrom + (1 - V.popFrom) * (1 - (1 - k) ** 2) }
const fade = (it: Structure) => Math.min(1, Math.max(0, it.life / V.fade))

/** 항아리 둘레 고리 — 땅 표식 차례 (몸보다 먼저) · 기세를 더한 순간 진해진다 */
export function drawBuildGround(ctx: CanvasRenderingContext2D, s: HaebiRun) {
  const b = s.build
  if (!b || !b.items.length) return
  const r = jarRadius(s.ranks.jar), a = ctx.globalAlpha
  for (const it of b.items) {
    if (it.kind !== 'jar') continue
    const glow = it.flash / B.flash, k = fade(it) * pop(s, it)
    ctx.globalAlpha = a * k * V.ringFill * (1 + glow); ctx.fillStyle = V.ring
    ctx.beginPath(); ctx.arc(it.x, it.y, r, 0, Math.PI * 2); ctx.fill()
    ctx.globalAlpha = a * k * Math.min(1, V.ringAlpha * (1 + 2 * glow)); ctx.strokeStyle = V.ring; ctx.lineWidth = 2
    ctx.setLineDash([...V.dash]); ctx.stroke(); ctx.setLineDash([])
  }
  ctx.globalAlpha = a
}

/** 설치물 하나 — 발밑(x, y)에서 위로 */
export function drawStructure(ctx: CanvasRenderingContext2D, images: Map<string, HTMLImageElement>, s: HaebiRun, it: Structure) {
  const path = it.kind === 'fence' ? it.hp < it.max * V.half ? ART.broken : ART.fence : ART[it.kind]
  const img = images.get(path), a = ctx.globalAlpha, k = pop(s, it), glow = it.flash / B.flash
  ctx.globalAlpha = a * fade(it)
  // 발밑 그림자
  const size = it.kind === 'jar' ? V.jarH : it.kind === 'fence' ? V.fenceW : V.towerH
  ctx.fillStyle = '#07181655'; ctx.beginPath(); ctx.ellipse(it.x, it.y + 2, size * V.shadow[it.kind] * k, V.shadow.h * k, 0, 0, Math.PI * 2); ctx.fill()
  if (img) {
    const h = (it.kind === 'tower' ? V.towerH : it.kind === 'jar' ? V.jarH : V.fenceW * img.height / img.width) * k, w = h * img.width / img.height
    const foot = it.y + (it.kind === 'fence' ? V.fenceLift : 0)
    ctx.drawImage(img, it.x - w / 2, foot - h, w, h)
    // 쏘거나 기세를 더한 순간 — 망루 꼭대기 · 항아리 아가리에 빛이 번진다
    if (glow > 0 && it.kind !== 'fence') {
      const [at, r] = V.glowAt[it.kind]
      ctx.globalAlpha = a * fade(it) * glow * V.glowAlpha; ctx.fillStyle = V.glow
      ctx.beginPath(); ctx.arc(it.x, foot - h * at, h * r, 0, Math.PI * 2); ctx.fill()
    }
  }
  // 다친 목책 — 머리 위 체력 띠
  if (it.kind === 'fence' && it.hp < it.max) {
    const w = V.hpBar, y = it.y + V.fenceLift - (img ? V.fenceW * img.height / img.width : V.fenceW) - V.hpLift
    ctx.globalAlpha = a * fade(it); ctx.fillStyle = '#111c'; ctx.fillRect(it.x - w / 2, y, w, V.hpH)
    ctx.fillStyle = glow > 0 ? '#ffd0a0' : '#e3a25e'; ctx.fillRect(it.x - w / 2, y, w * Math.max(0, it.hp / it.max), V.hpH)
  }
  ctx.globalAlpha = a
}
