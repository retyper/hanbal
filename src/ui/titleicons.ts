/**
 * 칭호(업적) 아이콘 — 둥근 메달 그림이다 (2026-09-20, 형: "밋밋한 SVG들 전부 에셋으로").
 *
 * 2026-08-26, 형: "칭호는 스팀 퀘스트같은거라면 스팀이랑 똑같이 아이콘이랑 업적 달성
 * 같은걸로 해놓던지." — 그때는 조건의 뜻을 선으로 옮긴 그림풀이였다. 이제는 같은 뜻을
 * 메달에 새긴 그림 여덟 장이다 (public/sprites/title-<이름>.png · 출처는 같은 폴더).
 * 잠긴 칸은 여전히 점선 실루엣이다 — 그림까지 보여주면 가린 게 아니다.
 */
import { UNLOCKS } from '../game/unlocks.ts'

/** 그림이 있는 칭호 — 조건의 뜻을 메달에 새겼다. */
export const TITLE_ART: ReadonlySet<string> = new Set([
  'title.oneshot',   // 첫 무결 — 깔끔한 체크
  'title.firststar', // 별을 쏘아올린 자 — 반짝이는 별
  'title.hawk',      // 매눈의 궁수 — 매의 눈
  'title.avalanche', // 우박의 손 — 쏟아지는 우박
  'title.hundred',   // 백중의 손 — 살이 잔뜩 꽂힌 과녁
  'title.wind',      // 바람을 읽는 궁수 — 바람결 셋
  'title.flawless',  // 완궁 — 고리에 든 각궁
  'title.forty',     // 마흔 고비를 넘은 자 — 고개 위의 깃발
])

const BASE: string = import.meta.env?.BASE_URL ?? '/'

/** 아이콘 마크업 한 조각. 모르는 id면 점선 원(？ 자리에 쓰는 것과 같은 침묵). */
export function titleIcon(id: string, size: number): string {
  if (TITLE_ART.has(id)) {
    return `<img class="hb-art" src="${BASE}sprites/${id.replace('.', '-')}.png" width="${size}" height="${size}" alt="" draggable="false">`
  }
  return (
    `<svg width="${size}" height="${size}" viewBox="0 0 28 28" fill="none" ` +
    `stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" ` +
    `aria-hidden="true"><circle cx="14" cy="14" r="8" stroke-dasharray="2 3"/></svg>`
  )
}

/** 이 id가 칭호(title)인가 — unlocks.ts를 다시 훑지 않고 UI가 바로 물어볼 수 있게. */
export function isTitleId(id: string): boolean {
  for (const d of UNLOCKS) if (d.id === id) return d.kind === 'title'
  return false
}
