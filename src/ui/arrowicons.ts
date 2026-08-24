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

/** 활 아이콘 svg 한 조각. */
export function bowIconSvg(id: string, size: number): string {
  return (
    `<svg width="${size}" height="${size}" viewBox="0 0 28 28" fill="none" ` +
    `stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true">` +
    `${BOW_ICON[id] ?? ''}</svg>`
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
