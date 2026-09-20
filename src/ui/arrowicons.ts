/**
 * 화살·활·부적의 아이콘과 강조색.
 *
 * 살통(quiver)·보급(supply) 등 화살 이름이 서는 모든 자리가 이걸 쓴다 (형: "이름만 주지
 * 말고 이미지 보여질 수 있도록").
 *
 * 색은 카드를 글자를 읽기 전에 구분하게 하는 장치라 손맛 노브가 아니다 — params.ts에
 * 올리지 않는다 (A2는 "손맛에 관여하는 숫자"의 규칙이다).
 */
import type { ArrowKindId } from '../game/arrows.ts'

export const ARROW_TINT: Record<ArrowKindId, string> = {
  basic: '#b9c3cf',
  pierce: '#8fd3ff',
  burst: '#ffb347',
  split: '#c9a0ff',
  homing: '#7fd1c0',
  chain: '#9be08f',
  heavy: '#e0876a',
  // 산전은 흩어짐(찬 회색빛 청록), 연주전은 잇달음(따뜻한 금빛). 두 살 다 '셋'을 주지만
  // 하나는 공간으로 하나는 시간으로 벌어져서, 색도 차갑고/따뜻하게 갈라 둔다.
  scatter: '#7fb8d8',
  rapid: '#f0c86a',
}

/**
 * 활의 옆모습 아이콘 (viewBox 0 0 28 28 · stroke). 실루엣 규칙은 게임 속 스틱맨의 활
 * (render/stickman.ts BOW_SKIN)과 같다 — 걸이·출정 화면에서 본 활을 손에 들었을 때 알아봐야 한다.
 */
export const BOW_ICON: Record<string, string> = {
  practice: '<path d="M10 4 Q20 14 10 24"/><path d="M10 4 L10 24" stroke-width="0.9"/>',
  gakgung:
    '<path d="M11 7 Q20 14 11 21"/><path d="M11 7 L15 3.5"/><path d="M11 21 L15 24.5"/>' +
    '<path d="M15 3.5 L15 24.5" stroke-width="0.9"/>',
  longbow: '<path d="M11 2 Q17 14 11 26"/><path d="M11 2 L11 26" stroke-width="0.9"/>',
  recurve:
    '<path d="M10 4 Q19 14 10 24"/><path d="M10 4 L10 24" stroke-width="0.9"/>' +
    '<path d="M14.5 14 L25 14" stroke-width="1.1"/>',
  compound:
    '<path d="M12 6 Q16 14 12 22"/><circle cx="12" cy="5" r="2.2"/><circle cx="12" cy="23" r="2.2"/>' +
    '<path d="M12 7.2 L12 20.8 M14 5.5 L14 22.5" stroke-width="0.9"/>',
}

/**
 * 잠긴 칸의 아이콘 자리 — 점선 실루엣. ui/titleicons.ts의 미확인 id 폴백과 같은 그림이다
 * (형: "해금 안된것들도 물음표만 떠야지 이미지도 글도 다 나와놓고 이름만 물음표하면
 * 그게 가려진거냐?" — 출정 화면의 잠긴 활이 이름은 ？？？로 가리면서 활 실루엣은 그대로
 * 보여주고 있었다. 아이콘도 같이 가려야 진짜로 가려진 것이다).
 */
const LOCK_ICON = '<circle cx="14" cy="14" r="8" stroke-dasharray="2 3"/>'

/** 활 아이콘 svg 한 조각. 잠긴 활은 id 대신 빈 문자열을 넘기면 점선 실루엣이 나온다. */
export function bowIconSvg(id: string, size: number): string {
  return (
    `<svg width="${size}" height="${size}" viewBox="0 0 28 28" fill="none" ` +
    `stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true">` +
    `${BOW_ICON[id] ?? LOCK_ICON}</svg>`
  )
}

/**
 * 화살 한 대의 **그림** (2026-09-20, 형: "밋밋한 SVG들 전부 에셋으로 바꿔야 겠어").
 *
 * 옛것은 효과의 그림풀이(선과 원)였다 — 뜻은 통했지만 물건으로 안 보였다. 이제는 촉을 크게
 * 당겨 잡은 그림 아홉 장이다. 아홉을 **한 장에 받아 잘라서**(tools/slice-grid.mjs) 화풍이 한 벌이고,
 * 그림마다 두른 빛이 ARROW_TINT 와 같은 색이라 카드의 강조색과 그대로 이어진다.
 * public/sprites/arrow-<id>.png · 출처는 public/sprites/출처.txt.
 */
const BASE: string = import.meta.env?.BASE_URL ?? '/'
export function arrowIcon(id: ArrowKindId, size: number): string {
  return `<img class="hb-art" src="${BASE}sprites/arrow-${id}.png" width="${size}" height="${size}" alt="" draggable="false">`
}

/**
 * 카드에 크게 서는 그림 한 장 — 갑옷(armor-) · 갈림길(fork-) · 스탯(stat-). 2026-09-20.
 * 예전엔 단색 글리프(.hb-ic)를 색만 바꿔 썼다 — 갑옷 세 벌이 같은 그림이었다.
 * 버튼 속 16px 글리프는 그대로 글리프다 (그림은 그 크기에서 죽이 된다).
 */
export function artIcon(name: string, size: number): string {
  return `<img class="hb-art" src="${BASE}sprites/${name}.png" width="${size}" height="${size}" alt="" draggable="false">`
}

// ─────────────────────────── 부적 ───────────────────────────
//
// 부적(符籍)은 노란 종이에 붉은 먹이다. 형: "부적도 부적마다 이미지 다르게 만들어줘."
// 넷은 같은 종이에 **다른 그림**을 그린다 — 살통 · 갑옷 · 금 · 도깨비. 한자를 못 읽어도 무슨 부적인지 안다.
// (옛것은 箭·甲·金·鬼 글자를 SVG 로 찍었다. 2026-09-20 에 그림으로 바꿨다 — public/sprites/charm-<id>.png)

const CHARM_ART: ReadonlySet<string> = new Set(['quiver', 'iron', 'gold', 'ghost'])

/** 부적 한 장. size는 px (정사각). 모르는 id 는 살통 부적 그림으로 받는다. */
export function charmIcon(id: string, size: number): string {
  const name = CHARM_ART.has(id) ? id : 'quiver'
  return `<img class="hb-art" src="${BASE}sprites/charm-${name}.png" width="${size}" height="${size}" alt="" draggable="false">`
}
