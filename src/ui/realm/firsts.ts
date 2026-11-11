/**
 * 처음 한 번 알림 — 배우는 판에 넣지 않은 기능은 본 게임에서 처음 만날 때 그 자리에서 한 번만 짧게 (형 11-01: "그래. 그렇게 해").
 *
 * 화면에 그 단추·칩이 처음 보이면 곁에 말풍선 하나와 숨 쉬는 테두리. 누르거나 글 길이만큼 지나면 걷힌다 (메모리: 알림은 반드시 걷힌다).
 * 본 것은 `hanbal.realm.firsts` 에 남는다 — 기록 지우기(wipe.ts)를 하면 다시 처음부터 알려 준다.
 * 자세한 것은 판마다 있는 「?」 설명(app GUIDE)으로 — 말풍선의 「자세히」가 그것을 연다.
 */
import { t } from '../../i18n/index.ts'

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
  { id: 'chief', sel: '.nring [data-act="nr-chief"].empty', get title() { return t('first.chief.title') }, get text() { return t('first.chief.text') }, guide: 'post' },
  { id: 'guard', sel: '.grdap', get title() { return t('first.guard.title') }, get text() { return t('first.guard.text') } },
  { id: 'place', sel: '.sheet [data-act="pl-open"]', get title() { return t('first.place.title') }, get text() { return t('first.place.text') }, guide: 'place' },
  { id: 'exp', sel: '.cmdc[data-job="exp"]:not(.off)', get title() { return t('first.exp.title') }, get text() { return t('first.exp.text') } },
  { id: 'wed', sel: '.cmdc[data-job="wed"]:not(.off)', get title() { return t('first.wed.title') }, get text() { return t('first.wed.text') } },
  { id: 'relic', sel: '[data-act="tomb-pick"]', get title() { return t('first.relic.title') }, get text() { return t('first.relic.text') } },
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
/* 말풍선은 누름을 막지 않는다 — 밑의 단추가 그대로 눌린다 (「자세히」만 받는다 · 저절로 걷힌다 · 위원회 11-04 UX ③) */
.ap .fhint { pointer-events: none; } .ap .fhint .fhmore { pointer-events: auto; }
.ap .fhon { outline: 3px solid #ffd27a; outline-offset: 3px; border-radius: 10px; animation: fhpulse 1s ease-in-out infinite alternate; }
@keyframes fhin { from { opacity: 0; scale: .85; } to { opacity: 1; scale: 1; } }
@keyframes fhpulse { from { outline-color: #ffd27a; } to { outline-color: #ffd27a44; } }
`
