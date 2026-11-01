/**
 * 처음 한 번 알림 — 배우는 판에 넣지 않은 기능은 본 게임에서 처음 만날 때 그 자리에서 한 번만 짧게 (형 11-01: "그래. 그렇게 해").
 *
 * 화면에 그 단추·칩이 처음 보이면 곁에 말풍선 하나와 숨 쉬는 테두리. 누르거나 글 길이만큼 지나면 걷힌다 (메모리: 알림은 반드시 걷힌다).
 * 본 것은 `hanbal.realm.firsts` 에 남는다 — 기록 지우기(wipe.ts)를 하면 다시 처음부터 알려 준다.
 * 자세한 것은 판마다 있는 「?」 설명(app GUIDE)으로 — 말풍선의 「자세히」가 그것을 연다.
 */
export interface First {
  readonly id: string
  /** 처음 보일 때 알릴 것 */
  readonly sel: string
  readonly title: string
  readonly text: string
  /** 「자세히」로 열 설명 (app GUIDE 의 열쇠) */
  readonly guide?: string
}

export const FIRSTS: readonly First[] = [
  { id: 'chief', sel: '.nring [data-act="nr-chief"].empty', title: '고을지기', text: '장수에게 이 고을을 맡기면 가을걷이와 집 늘기가 좋아집니다.', guide: 'post' },
  { id: 'guard', sel: '.grdap', title: '지킬 길', text: '적이 올 길을 하나 골라 지키세요. 그 길로 숨어 오는 적을 막습니다. 고르지 않으면 장수가 고릅니다.' },
  { id: 'place', sel: '.sheet [data-act="pl-open"]', title: '백성 배치', text: '붐비는 고을의 집을 한산한 고을로 옮깁니다. 옮긴 집마다 곡식이 듭니다.', guide: 'place' },
  { id: 'exp', sel: '.cmdc[data-job="exp"]:not(.off)', title: '원정', text: '장수를 먼 땅에 보내 좋은 것을 가져옵니다. 무엇이 나올지는 보낼 때 보이고, 잃는 것은 없습니다. 다녀오는 동안은 판에 없습니다.' },
  { id: 'wed', sel: '.cmdc[data-job="wed"]:not(.off)', title: '혼인', text: '남녀 장수를 짝지으면 몇 달 뒤 아이가 우리 장수로 나섭니다. 잔치에 곡식이 듭니다.' },
  { id: 'relic', sel: '[data-act="tomb-pick"]', title: '유물 상자', text: '상자 하나를 고르세요. 겉빛이 귀할수록 좋은 유물이 듭니다. 얻은 유물은 단련터에서 장수에게 끼웁니다.' },
]

const KEY = 'hanbal.realm.firsts'

export function loadFirsts(): Set<string> {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown
    return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
  } catch { return new Set() }
}

export function saveFirsts(seen: ReadonlySet<string>): void {
  try { localStorage.setItem(KEY, JSON.stringify([...seen])) } catch { /* 저장 못 하는 곳 — 이번에만 */ }
}

/** 지금 알릴 것 — 아직 안 본 것 가운데 화면에 보이는 첫 것 (보이는지는 화면 일이라 `shown` 으로 받는다) */
export function nextFirst(seen: ReadonlySet<string>, shown: (sel: string) => boolean): First | null {
  return FIRSTS.find((f) => !seen.has(f.id) && shown(f.sel)) ?? null
}

export const FIRST_CSS = `
.ap .fhint { position: fixed; z-index: 118; max-width: min(80vw, 320px); padding: 9px 13px 10px; border-radius: 12px; background: #1f1710f5; border: 1.5px solid #e8c46a; color: #f3e6c8; font-size: 13.5px; line-height: 1.5; box-shadow: 0 6px 22px #000c, 0 0 0 3px #e8c46a33; cursor: pointer; animation: fhin .28s cubic-bezier(.2,1.4,.4,1) both; }
.ap .fhint.up { transform: translate(-50%, calc(-100% - 12px)); }
.ap .fhint.dn { transform: translate(-50%, 12px); }
.ap .fhint b { display: block; color: #ffd27a; font-size: 15px; margin-bottom: 2px; }
.ap .fhint .fhmore { margin-top: 6px; padding: 3px 10px; border-radius: 999px; border: 1px solid #c9a45a; background: #3a2a16; color: #ffe2a8; font-size: 12.5px; }
.ap .fhint::after { content: ''; position: absolute; left: 50%; width: 10px; height: 10px; background: inherit; border: inherit; border-width: 0 1.5px 1.5px 0; transform: translateX(-50%) rotate(45deg); }
.ap .fhint.up::after { bottom: -7px; }
.ap .fhint.dn::after { top: -7px; transform: translateX(-50%) rotate(225deg); }
.ap .fhint.out { opacity: 0; transition: opacity .3s ease; }
.ap .fhon { outline: 3px solid #ffd27a; outline-offset: 3px; border-radius: 10px; animation: fhpulse 1s ease-in-out infinite alternate; }
@keyframes fhin { from { opacity: 0; scale: .85; } to { opacity: 1; scale: 1; } }
@keyframes fhpulse { from { outline-color: #ffd27a; } to { outline-color: #ffd27a44; } }
`
