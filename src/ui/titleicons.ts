/**
 * 칭호(업적) 아이콘 — arrowicons.ts와 같은 문법(viewBox 28×28 · stroke · currentColor)이다.
 *
 * 2026-08-26, 형: "칭호는 스팀 퀘스트같은거라면 스팀이랑 똑같이 아이콘이랑 업적 달성
 * 같은걸로 해놓던지." — 이름 텍스트 하나로 버티던 칭호에 그림을 준다. 조건의 **뜻**을
 * 그림풀이로 옮긴다 (예: 우박의 손 = 떨어지는 알갱이, 완궁 = 활 둘레의 완결 고리).
 */
import { UNLOCKS } from '../game/unlocks.ts'

export const TITLE_ICON: Record<string, string> = {
  // 첫 무결 — 무손실 첫 클리어. 원 안의 깔끔한 체크.
  'title.oneshot': '<circle cx="14" cy="14" r="9"/><path d="M9.5 14.5l3 3 6.5-7.5"/>',
  // 별을 쏘아올린 자 — 반짝임(4각 스파클). 별을 처음 모으기 시작한 순간.
  'title.firststar': '<path d="M14 3l2 9 9 2-9 2-2 9-2-9-9-2 9-2z"/>',
  // 매눈의 궁수 — 눈. 정중앙을 알아보는 눈이다.
  'title.hawk': '<path d="M3 14s4.5-7 11-7 11 7 11 7-4.5 7-11 7S3 14 3 14z"/><circle cx="14" cy="14" r="3"/>',
  // 우박의 손 — 연달아 떨어지는 알갱이. 콤보의 소리(보로로로록)를 그림으로.
  'title.avalanche': '<circle cx="8" cy="6" r="1.5"/><circle cx="16" cy="4.5" r="1.5"/><circle cx="22" cy="8" r="1.5"/>'
    + '<path d="M6 13l2 9M14 11l2 11M21 13l2 9"/>',
  // 백중(百中)의 손 — 과녁에 흩뿌려진 명중 자국. 누적 명중이 쌓인 흔적이다.
  'title.hundred': '<circle cx="14" cy="14" r="9"/>'
    + '<circle cx="11.5" cy="11.5" r="1.3" fill="currentColor" stroke="none"/>'
    + '<circle cx="16.5" cy="12.5" r="1.3" fill="currentColor" stroke="none"/>'
    + '<circle cx="12.5" cy="16.5" r="1.3" fill="currentColor" stroke="none"/>'
    + '<circle cx="17" cy="17" r="1.3" fill="currentColor" stroke="none"/>',
  // 바람을 읽는 궁수 — 겹친 바람결 셋. 바람 깃발과 같은 문법(물결선)이다.
  'title.wind': '<path d="M3 9c4-3 6 3 10 0s6 3 12 0"/><path d="M3 15c4-3 6 3 10 0s6 3 12 0"/>'
    + '<path d="M3 21c4-3 6 3 10 0s6 3 12 0"/>',
  // 완궁(完弓) — 활 옆모습을 완결의 고리(점선 원)가 감싼다. "완성됐다"는 뜻이 그림으로.
  'title.flawless': '<path d="M10 4 Q19 14 10 24" stroke-width="1.9"/><path d="M10 4 L10 24" stroke-width="0.9"/>'
    + '<circle cx="14" cy="14" r="11.5" stroke-dasharray="2.2 3.4" stroke-width="1.3"/>',
  // 마흔 고비를 넘은 자 — 산봉우리 + 깃발. 40판이라는 긴 길을 넘은 자리.
  'title.forty': '<path d="M3 22L11 8l4 7 3-4 7 11z"/><path d="M15 3v6"/><path d="M15 3l5 2.5-5 2.5"/>',
}

/** 아이콘 svg 마크업 한 조각. 모르는 id면 빈 원(？ 자리에 쓰는 것과 같은 침묵). */
export function titleIconSvg(id: string, size: number): string {
  return (
    `<svg width="${size}" height="${size}" viewBox="0 0 28 28" fill="none" ` +
    `stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" ` +
    `aria-hidden="true">${TITLE_ICON[id] ?? '<circle cx="14" cy="14" r="8" stroke-dasharray="2 3"/>'}</svg>`
  )
}

/** 이 id가 칭호(title)인가 — unlocks.ts를 다시 훑지 않고 UI가 바로 물어볼 수 있게. */
export function isTitleId(id: string): boolean {
  for (const d of UNLOCKS) if (d.id === id) return d.kind === 'title'
  return false
}
