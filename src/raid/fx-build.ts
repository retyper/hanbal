/**
 * 65-BUILD 설치물 그림 — 망루 · 목책 · 항아리 (판은 읽기만 한다 · 시계는 판 시각 s.t · 수치는 HAEBI_BUILD.view).
 * 새 그림 없이 빌린다: 망루·목책 = 넓은 맵 목책 판 장식(palisade-2 · palisade-0 · 잔해 palisade-1) · 항아리 = 본편 장 항아리 그림.
 * 설치물은 건물이라 솟거나 옅어지지 않는다 (형 11-23 「떴다 사라지면 별로」) — 장수가 밀 때 발밑 흙먼지 · 무너진 목책·망루는 잔해와 다시 서기 고리 (망루 잔해는 같은 그림을 옅게 주저앉혀).
 * 땅 차례(drawBuildGround): 항아리가 기세를 더하는 둘레를 옅은 금빛 고리로 (규칙이 보이게).
 * 몸 차례(drawStructure): 위에서 아래로 그리는 줄에 끼어 적·장수와 앞뒤가 맞는다.
 */
import { HAEBI_BUILD as B } from '../tune/params.ts'
import type { HaebiRun } from './haebi.ts'
import { jarRadius, type Structure } from './build.ts'

const V = B.view
const ART = { tower: 'raid/props/palisade-2.webp', fence: 'raid/props/palisade-0.webp', rubble: 'raid/props/palisade-1.webp', jar: 'icon/good-soybean-jar.png' } as const
/** 미리 받아 둘 그림 — 망루·목책은 넓은 맵 장식(PROP_PATHS)에 이미 있어 항아리만 */
export const BUILD_PATHS = [ART.jar]

/** 항아리 둘레 고리 — 땅 표식 차례 (몸보다 먼저) · 기세를 더한 순간 진해진다 */
export function drawBuildGround(ctx: CanvasRenderingContext2D, s: HaebiRun) {
  const b = s.build
  if (!b || !b.items.length) return
  const r = jarRadius(s.ranks.jar), a = ctx.globalAlpha
  for (const it of b.items) {
    if (it.kind !== 'jar') continue
    const glow = it.flash / B.flash
    ctx.globalAlpha = a * V.ringFill * (1 + glow); ctx.fillStyle = V.ring
    ctx.beginPath(); ctx.arc(it.x, it.y, r, 0, Math.PI * 2); ctx.fill()
    ctx.globalAlpha = a * Math.min(1, V.ringAlpha * (1 + 2 * glow)); ctx.strokeStyle = V.ring; ctx.lineWidth = 2
    ctx.setLineDash([...V.dash]); ctx.stroke(); ctx.setLineDash([])
  }
  ctx.globalAlpha = a
}

/** 설치물 하나 — 발밑(x, y)에서 위로 */
export function drawStructure(ctx: CanvasRenderingContext2D, images: Map<string, HTMLImageElement>, s: HaebiRun, it: Structure) {
  const rubble = it.down > 0
  const img = images.get(rubble && it.kind === 'fence' ? ART.rubble : ART[it.kind]), a = ctx.globalAlpha, glow = it.flash / B.flash
  // 발밑 그림자
  const size = it.kind === 'jar' ? V.jarH : it.kind === 'fence' ? V.fenceW : V.towerH
  ctx.fillStyle = '#07181655'; ctx.beginPath(); ctx.ellipse(it.x, it.y + 2, size * V.shadow[it.kind], V.shadow.h, 0, 0, Math.PI * 2); ctx.fill()
  // 밀리는 동안 발밑 흙먼지 (알마다 판 시각으로 흔들린다)
  if (it.push > 0) {
    const D = V.dust, k = it.push / B.pushDust
    ctx.globalAlpha = a * D.alpha * k; ctx.fillStyle = D.color; ctx.beginPath()
    for (let i = 0; i < D.n; i++) {
      const ang = s.t * 9 + i * Math.PI * 2 / D.n + it.id, r = D.spread * (.5 + .5 * Math.sin(s.t * 13 + i))
      const x = it.x + Math.cos(ang) * r, y = it.y + Math.sin(ang) * r * .4
      ctx.moveTo(x + D.size, y); ctx.arc(x, y, D.size, 0, Math.PI * 2)
    }
    ctx.fill(); ctx.globalAlpha = a
  }
  if (img) {
    const h = it.kind === 'tower' ? V.towerH : it.kind === 'jar' ? V.jarH : V.fenceW * img.height / img.width, w = h * img.width / img.height
    const foot = it.y + (it.kind === 'fence' ? V.fenceLift : 0)
    if (rubble && it.kind === 'tower') { ctx.globalAlpha = a * V.rubbleAlpha; ctx.drawImage(img, it.x - w / 2, foot - h * V.rubbleSquash, w, h * V.rubbleSquash); ctx.globalAlpha = a }
    else ctx.drawImage(img, it.x - w / 2, foot - h, w, h)
    // 쏘거나 기세를 더한 순간 — 망루 꼭대기 · 항아리 아가리에 빛이 번진다
    if (glow > 0 && it.kind !== 'fence') {
      const [at, r] = V.glowAt[it.kind]
      ctx.globalAlpha = a * glow * V.glowAlpha; ctx.fillStyle = V.glow
      ctx.beginPath(); ctx.arc(it.x, foot - h * at, h * r, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = a
    }
  }
  if (it.kind === 'jar') { ctx.globalAlpha = a; return }
  const top = it.kind === 'tower' ? it.y - V.towerH * (rubble ? V.rubbleSquash : 1) - V.hpLift : it.y + V.fenceLift - (img ? V.fenceW * img.height / img.width : V.fenceW) - V.hpLift
  // 잔해 — 다시 서기까지 고리가 차오른다
  if (rubble) {
    ctx.strokeStyle = '#111c'; ctx.lineWidth = V.rebuildW + 2; ctx.beginPath(); ctx.arc(it.x, top, V.rebuildR, 0, Math.PI * 2); ctx.stroke()
    ctx.strokeStyle = V.rebuildColor; ctx.lineWidth = V.rebuildW; ctx.beginPath()
    ctx.arc(it.x, top, V.rebuildR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - it.down / B[it.kind].rebuild)); ctx.stroke()
  } else if (it.hp < it.max) {
    // 다친 망루·목책 — 머리 위 체력 띠
    const w = V.hpBar
    ctx.fillStyle = '#111c'; ctx.fillRect(it.x - w / 2, top, w, V.hpH)
    ctx.fillStyle = glow > 0 ? '#ffd0a0' : '#e3a25e'; ctx.fillRect(it.x - w / 2, top, w * Math.max(0, it.hp / it.max), V.hpH)
  }
  ctx.globalAlpha = a
}
