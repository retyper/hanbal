/**
 * 플레이 기록 지우기의 이 기기 몫 (형 11-01: "데이터 초기화 할 때 남겨지는 게 너무 많던데 · 확실하게").
 *
 * 지울 것: 삼한열전(`hanbal.realm.`)과 궁술 연습장(`hanbal.night.`)의 모든 칸 — 판 · 저장 칸 · 영웅전 · 해금 · 연대기 · 단련 · 유물 ·
 * 배우는 판 · 처음 한 번 알림까지. 남길 것: 설정(소리 · 지도 층 · 그래픽 · 화면 돌림 · 싸움 도움말)과 계정 · 기기 표시.
 * 활터(`hanbal.save.v1`)는 제 「처음부터」가 따로 있다 (realm-main 머리말).
 *
 * 지운 뒤 새로고침 사이에 아직 떠 있는 화면이 무엇이든 다시 써 넣을 수 있다 — 그래서 표시를 남기고,
 * 다음 열 때 다른 모듈이 저장을 읽기 전에(realm-main 의 맨 첫 import) 한 번 더 지운다. localStorage.clear() 는 쓰지 않는다.
 */
const PREFIX = ['hanbal.realm.', 'hanbal.night.'] as const
/** 설정 — 기록이 아니다 */
const KEEP: ReadonlySet<string> = new Set([
  'hanbal.realm.mute', 'hanbal.realm.layers', 'hanbal.realm.gfx', 'hanbal.realm.gfx.auto',
  'hanbal.realm.warHelp', 'hanbal.realm.battle0', 'hanbal.night.rotate',
])
const MARK = 'hanbal.wipe'

/** 지울 칸인가 */
export const wipeable = (k: string): boolean => PREFIX.some((p) => k.startsWith(p)) && !KEEP.has(k)

/** 이 기기의 기록을 지운다 — 남은 칸 수 (0 이어야 한다) */
export function wipeLocal(): number {
  try {
    for (const k of Object.keys(localStorage)) if (wipeable(k)) localStorage.removeItem(k)
    return Object.keys(localStorage).filter(wipeable).length
  } catch { return -1 }
}

/** 지우고, 새로고침 뒤에도 한 번 더 지우라고 표시해 둔다 */
export function wipeAndMark(): void {
  try { sessionStorage.setItem(MARK, '1') } catch { /* 표시를 못 남겨도 지금 지운 것은 지워졌다 */ }
  wipeLocal()
}

// 새로고침 뒤 첫 일 — 표시가 있으면 다른 무엇보다 먼저 한 번 더
try {
  if (sessionStorage.getItem(MARK) === '1') {
    wipeLocal()
    sessionStorage.removeItem(MARK)
  }
} catch { /* 저장소를 못 쓰는 곳 */ }
