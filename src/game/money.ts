/**
 * 돈 — **냥(兩)** 과 엽전 (2026-09-11)
 *
 * 형: **"재화를 '훈련'으로 하니까 전혀 돈버는 기분이 아니야. 제대로 돈 처럼 느껴지게 만들어.
 *      '훈련'이라고 하지말고 적절한 금화 아이콘으로 만들어. 그리고 어느곳에서든 사용처에서
 *      금화 아이콘이랑 숫자 같이 써."**
 *
 * 맞는 지적이다. '훈련치'는 **가계부의 말이 아니라 체육관의 말**이다. 같은 숫자로 활을 사고
 * 갑옷을 장만하고 화살을 채우는데, 이름이 '훈련치'면 아무리 모아도 **번 것 같지가 않다.**
 * 게임이 주는 것과 쓰는 것이 같다면 그건 돈이라고 불러야 한다.
 *
 * ── 왜 '냥'인가 ───────────────────────────────────────────────────────
 * 이 세계는 고려·조선이다. 원(圓)은 아직 없고 골드는 남의 말이다. **냥(兩)** 은 그 시대에
 * 실제로 값을 세던 단위이고, 화살 하나(육량전 = 여섯 냥짜리 살)에도 이미 이 게임 안에서
 * 쓰이고 있다. 새로 지어낸 말이 아니라 **이미 이 세계에 있던 말**을 쓴다.
 *
 * 아이콘은 **엽전(葉錢)** 이다 — 둥근 테에 네모난 구멍. 상평통보의 그 모양이라 한 번 보면
 * 돈이 아닌 다른 것으로는 안 읽힌다. 동전 그림 하나면 설명이 필요 없다.
 *
 * ── 이 파일의 규칙 ────────────────────────────────────────────────────
 * 1. **세이브의 필드 이름은 안 바꾼다** (`SaveData.training`). 옛 세이브를 마이그레이션할
 *    이유가 화면의 낱말 하나 때문이면 그건 값을 못 하는 위험이다. 바뀌는 것은 **보이는 말**뿐이다.
 * 2. 값을 화면에 적는 곳은 **전부 여기를 지난다.** 두 곳이 각자 '냥'을 붙이면 언젠가
 *    한쪽이 옛말로 남는다 (실제로 '훈련치'가 열두 파일에 흩어져 있었다).
 * 3. DOM 은 `coinHtml()`, 캔버스는 `drawCoin()`. 둘이 같은 그림을 그린다 —
 *    같은 돈이 화면 두 곳에서 다르게 생기면 그건 두 가지 돈이다.
 */

/** 화폐의 이름. 숫자 뒤에 붙는다 ("12냥"). */
export const COIN_NAME = '냥'

/**
 * 엽전의 생김새 — 반지름(px) 대비 비율. 손맛 값이 아니라 **한 그림의 치수**라
 * (render/hud.ts 의 HUD 상수·render/stickman.ts 의 SWORD 와 같은 성격) 노브로 올리지 않는다.
 */
const COIN = {
  /** 놋쇠빛 — 강조색(주황)과 구분되게 조금 더 노랗다. */
  gold: '#ffd35c',
  dark: '#8a6a1e',
  /** 테의 굵기와 자리. 이 한 줄이 없으면 그냥 노란 동그라미다. */
  rimW: 0.16,
  rimAt: 0.86,
  /** 네모 구멍의 반변. 엽전의 서명이라 이것 하나가 '돈'을 만든다. */
  hole: 0.34,
} as const

export const COIN_GOLD = COIN.gold

/**
 * 값 하나를 글자로. **아이콘을 못 쓰는 자리**(토스트·title 속성)에서만 쓴다 —
 * 그림이 들어갈 수 있는 자리에는 `coinHtml()` 쪽이 낫다.
 */
export function coinText(n: number): string {
  return `${Math.floor(n)}${COIN_NAME}`
}

/**
 * 엽전 + 숫자 한 덩이 (DOM). `<i class="hb-coin">` 는 ui/overlay.ts 의 CSS 가 그린다.
 * `bold` 면 숫자가 굵어진다 — 지갑처럼 "지금 가진 것"을 보여주는 자리에서 쓴다.
 */
export function coinHtml(n: number, bold = false): string {
  const num = `${Math.floor(n)}`
  return `<i class="hb-coin" aria-hidden="true"></i>${bold ? `<b>${num}</b>` : num}`
}

/** 아이콘만 (숫자는 호출자가 따로 붙인다). */
export const COIN_ICON = '<i class="hb-coin" aria-hidden="true"></i>'

/**
 * 엽전 하나 (캔버스). (x, y) 는 **중심**, r 은 반지름 (px).
 * 둥근 테 + 네모 구멍 + 테두리 한 줄. 셋이면 8px 로 줄어도 엽전으로 읽힌다.
 */
export function drawCoin(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.fillStyle = COIN.gold
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = COIN.dark
  ctx.lineWidth = Math.max(1, r * COIN.rimW)
  ctx.beginPath()
  ctx.arc(x, y, r * COIN.rimAt, 0, Math.PI * 2)
  ctx.stroke()
  const h = r * COIN.hole
  ctx.fillStyle = COIN.dark
  ctx.fillRect(x - h, y - h, h * 2, h * 2)
}
