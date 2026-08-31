/**
 * 화살 아이콘 — 종류별 그림풀이와 강조색 (드래프트 시절의 것을 공용으로 살렸다).
 *
 * 그림이 아니라 **효과의 그림풀이**다 — 관통은 과녁 두 개를 꿴 선, 폭발은 터지는 방사선,
 * 사슬은 점 셋을 잇는 꺾인 선. 이름을 못 읽어도 무슨 일이 일어나는지 짐작되면 성공이다.
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

export const ARROW_ICON: Record<ArrowKindId, string> = {
  basic: '<path d="M4 14h16"/><path d="M15 9l5 5-5 5"/>',
  pierce: '<path d="M3 14h22"/><circle cx="11" cy="14" r="4"/><circle cx="20" cy="14" r="4"/>',
  burst:
    '<circle cx="14" cy="14" r="3.2"/><path d="M20 14h4M17 19.2l2 2.5M11 19.2l-2 2.5M8 14H4M11 8.8L9 6.3M17 8.8l2-2.5"/>',
  split: '<path d="M3 14h11"/><path d="M14 14l9-6"/><path d="M14 14l9 6"/><circle cx="14" cy="14" r="1.6"/>',
  homing: '<path d="M3 21c8 0 12-3 15-9"/><circle cx="21" cy="8" r="2.6"/>',
  chain:
    '<path d="M3 19l6-5 6 6 6-8"/><circle cx="9" cy="14" r="2"/><circle cx="15" cy="20" r="2"/><circle cx="21" cy="12" r="2"/>',
  heavy: '<path d="M4 14h13"/><path d="M12 9l5 5-5 5"/><rect x="19" y="9" width="6" height="10" rx="1.5"/>',
  // 산전 — 한 점에서 부채꼴로 갈라지는 살 셋. 세전(split)과 헷갈리면 안 되므로
  // 갈라지는 자리를 **왼쪽 끝(손)** 에 둔다. 세전은 오른쪽 끝(과녁)에서 갈라진다.
  scatter:
    '<path d="M4 14l18-6"/><path d="M4 14h19"/><path d="M4 14l18 6"/><circle cx="4" cy="14" r="1.8"/>',
  // 연주전 — 같은 선 위에 잇달아 나가는 살 셋. 구슬을 꿴 모양 그대로다.
  rapid:
    '<path d="M3 14h20"/><path d="M8 11l3 3-3 3"/><path d="M14 11l3 3-3 3"/><path d="M20 11l3 3-3 3"/>',
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

/** 아이콘 svg 마크업 한 조각. size는 px. 색은 CSS의 color(currentColor)를 따른다. */
export function arrowIconSvg(id: ArrowKindId, size: number): string {
  return (
    `<svg width="${size}" height="${size}" viewBox="0 0 28 28" fill="none" ` +
    `stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" ` +
    `aria-hidden="true">${ARROW_ICON[id]}</svg>`
  )
}
