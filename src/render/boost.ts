/**
 * 막기 판 켜짐 — 산적·바다도적(src/pirate-main.ts)만 켠다. render 가 읽기만 하는 한 칸짜리 스위치.
 * 활터의 밤·낮 판은 그대로 둔다.
 *
 * 11-16 형: 「화살이 왜 미사일같이 커다란 이미지야 · 암살 컨텐츠에서 따올 거 제대로 안 따온 거임?」 —
 * 켜지면 날아가는 살은 **밤 판의 살**이다 (구운 또렷한 살 + 옅은 짧은 꼬리 · 리본 궤적·공기 타원·잔상 궤적 없음),
 * 겨눔 점선은 작은 점, 그림자 번짐(shadowBlur)은 안 쓴다 (폰 GPU).
 */
import { PIRATE_VISIBILITY } from '../tune/params.ts'

export const BOOST = {
  on: false,
  /** 나는 살 뒤 짧은 꼬리 — 색 · 몇 스텝 거리만큼 (밤 판은 3) */
  streak: 'rgba(40, 30, 18, 0.32)',
  streakSteps: 3,
  /** 겨눔 점선의 점 반지름 (CSS px) · 밑점 테 · 점 알파 — 밝은 바탕에서도 읽히되 화면을 덮지 않게 */
  dotR: 1.9,
  dotEdge: PIRATE_VISIBILITY.dotEdge,
  dotAlpha: 0.85,
  /** 이 x(m)부터는 물 — 떨어진 살이 땅에 박혀 남지 않는다 (바다도적 판이 물가로 정한다) */
  waterX: Infinity,
  /** 박힌 살 — 밖으로 나온 대의 길이 (m · 밤 판은 0.55) · 어두운 테 굵기 · 밝은 대 굵기 (CSS px) */
  pinLen: 0.5, pinEdge: 3.2, pinCore: 1.6,
}

/**
 * 박힌 살 한 대 (막기 판) — 그림 살의 깃이 나무색이라 도적의 갈색 몸·모래에 묻혔다 (11-16 형: 「화살이 제대로 꽂히지도 않잖아」).
 * 밤 판의 박힌 살처럼 선으로 긋되, 어두운 테 위에 밝은 대 + 흰 깃 둘 — 몸에도 모래에도 읽힌다. tail 은 깃 끝, entry 는 박힌 자리 (화면 px)
 */
export function drawPinBoost(ctx: CanvasRenderingContext2D, tailX: number, tailY: number, entryX: number, entryY: number): void {
  const dx = entryX - tailX
  const dy = entryY - tailY
  const len = Math.hypot(dx, dy)
  if (len < 1) return
  const ux = dx / len
  const uy = dy / len
  const f = Math.min(6, len * 0.3)
  ctx.lineCap = 'round'
  ctx.strokeStyle = 'rgba(16, 10, 4, 0.85)'
  ctx.lineWidth = BOOST.pinEdge
  ctx.beginPath()
  ctx.moveTo(tailX, tailY)
  ctx.lineTo(entryX, entryY)
  ctx.stroke()
  ctx.strokeStyle = '#ecdcb8'
  ctx.lineWidth = BOOST.pinCore
  ctx.beginPath()
  ctx.moveTo(tailX, tailY)
  ctx.lineTo(entryX, entryY)
  // 깃 — 꼬리에서 대를 따라 비스듬히 둘
  ctx.moveTo(tailX + ux * f, tailY + uy * f)
  ctx.lineTo(tailX - uy * f * 0.55, tailY + ux * f * 0.55)
  ctx.moveTo(tailX + ux * f, tailY + uy * f)
  ctx.lineTo(tailX + uy * f * 0.55, tailY - ux * f * 0.55)
  ctx.stroke()
}
