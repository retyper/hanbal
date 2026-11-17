/**
 * 막기 판(바다 도적 · 산적)의 적 체력 바 — 머리 위 바는 전부 이 한 꼴이다 (11-17 형: 「체력바도 색이 다르고 제대로 보이지도 않아」).
 * 어두운 테 · 검붉은 바탕 · 붉은 몸 · 위쪽 밝은 줄 · 칸 나눔. 방패(몇 대 더 맞아야 깨지나)는 같은 바의 오른쪽 쇳빛 칸.
 * 우리 쪽(목책)은 화면 위 파란 체력창이다 (pirate-main.ts) — 적은 붉게, 우리는 파랗게.
 * render 다 — 판을 읽기만 한다. 크기·색은 그림 값이라 손맛 노브가 아니다.
 */
export const FOE_BAR = {
  /** 바 높이 · 테 두께 · 가장 짧은 폭 (CSS px) — 폰에서 읽히는 크기 */
  h: 7, edge: 2, minW: 40,
  edgeCol: 'rgba(8, 4, 3, 0.92)', back: '#2a0f0b',
  hp: '#e0402c', hpHi: '#ff9e84',
  armor: '#c3ccd3', armorHi: '#f6f8fa',
  /** 위쪽 밝은 줄 두께 · 알파 */
  hiH: 2, hiA: 0.6,
} as const

/**
 * (x, y) = 바의 가운데 위 · w = 폭. hp · armor 는 바 폭에 대한 몫 (0~1) — 붉은 몸 [0, hp], 쇳빛 [hp, hp + armor].
 * cells > 1 이면 칸을 나눈다 (몇 대 남았나가 세어진다).
 */
export function drawFoeBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, hp: number, armor = 0, cells = 0): void {
  const B = FOE_BAR
  const e = B.edge
  const x0 = x - w / 2
  const r = Math.max(0, Math.min(1, hp))
  const a = Math.max(0, Math.min(1 - r, armor))
  ctx.fillStyle = B.edgeCol
  ctx.fillRect(x0 - e, y - e, w + e * 2, B.h + e * 2)
  ctx.fillStyle = B.back
  ctx.fillRect(x0, y, w, B.h)
  if (r > 0) {
    ctx.fillStyle = B.hp
    ctx.fillRect(x0, y, w * r, B.h)
    ctx.globalAlpha = B.hiA
    ctx.fillStyle = B.hpHi
    ctx.fillRect(x0, y, w * r, B.hiH)
    ctx.globalAlpha = 1
  }
  if (a > 0) {
    ctx.fillStyle = B.armor
    ctx.fillRect(x0 + w * r, y, w * a, B.h)
    ctx.globalAlpha = B.hiA
    ctx.fillStyle = B.armorHi
    ctx.fillRect(x0 + w * r, y, w * a, B.hiH)
    ctx.globalAlpha = 1
  }
  if (cells > 1) {
    ctx.fillStyle = B.edgeCol
    for (let i = 1; i < cells; i++) ctx.fillRect(x0 + (w * i) / cells - 1, y, 2, B.h)
  }
}
