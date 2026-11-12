/**
 * 전략 회의의 새 안건 셋의 말 — 먼저 공작 · 두 갈래로 · 동맹이 튼튼하니 치지 말자/때를 기다리자/이간하자 (docs/realm/MEMORY.md §3-2 1 ·
 * 형 10-30: "이번 계절에 치지 말고 저들이 식량이 많기 때문에 공작을 통해 곳간에 불을 질러 둔 뒤에 치자 · 지형이 유리하니 두 갈래 길로 동시 공격 ·
 * 동맹이 튼튼한 국가이니 주변 다른 국가를 적으로 돌릴 수 있다 치지 말자 혹은 때를 기다리자 혹은 다른 나라를 공작으로 이간시키자").
 *
 * 결(voice.voiceKind)을 여섯 숨결로 묶는다 — 거친 이 · 젊은 이 · 어른 · 기사 · 꾀돌이 · 무당. 숨결마다 처지마다 두 마디.
 * 높임은 council-says 와 같다 — 문장마다 '합니다', 권할 땐 -시지요, 청할 땐 -주십시오. 고를 때 sageuk 이 사극 말투로 바꾼다.
 * 바뀌는 낱말은 {이름} · {이름|조사} (fill 이 받침을 본다). 까닭(지난 일 · 본 것)은 여기 넣지 않고 council-recall 이 앞에 붙인다.
 *
 * 처지(Scheme) — 들어갈 칸:
 *   plotAdvise    먼저 곳간에 불을 — {foe} {there}
 *   plotAgainst   곧장 친다 — {there}
 *   pincerAdvise  두 갈래로 함께 — {there} {via}(다른 군대가 선 고을) {with}(그 군대를 이끄는 이 · 없으면 그 군대)
 *   pincerAgainst 한 길로 — {there}
 *   allyHold      치지 않는다 — {foe} {ally}
 *   allyWait      때를 기다린다 — {foe} {ally}
 *   allySow       이간한다 — {foe} {ally}
 *   allyGo        그래도 친다 (거친 이만) — {foe} {ally}
 *   skyWait       날씨·때를 기다린다 (장마가 걷히면 · 해자가 얼면) — {there} · 까닭(그 날씨)은 앞에 붙는다
 *   skyGo         그래도 지금 친다 — {there}
 */
import type { Hero } from '../../realm/types.ts'
import { fill, pickIdx, sageuk } from './council-says.ts'
import { lazyTree } from '../../i18n/index.ts'
import { voiceKind, type VoiceKind } from './voice.ts'

export type Scheme = 'plotAdvise' | 'plotAgainst' | 'pincerAdvise' | 'pincerAgainst' | 'allyHold' | 'allyWait' | 'allySow' | 'allyGo' | 'skyWait' | 'skyGo'
type Tone = 'gruff' | 'young' | 'wise' | 'knight' | 'sly' | 'shaman'

/** 처지마다 반드시 들어갈 칸 (시험이 본다) */
export const SCHEME_NEED: Readonly<Record<Scheme, readonly string[]>> = {
  plotAdvise: ['foe', 'there'], plotAgainst: ['there'], pincerAdvise: ['there'], pincerAgainst: ['there'],
  allyHold: ['foe', 'ally'], allyWait: ['ally'], allySow: ['foe', 'ally'], allyGo: ['foe'],
  skyWait: ['there'], skyGo: ['there'],
}

const TONE_OF: Readonly<Record<VoiceKind, Tone>> = {
  'm-gruff': 'gruff', 'm-young': 'young', 'w-bright': 'young', 'm-charm': 'young',
  'm-sage': 'wise', 'm-elder': 'wise', 'w-matron': 'wise',
  'm-knight': 'knight', 'w-knight': 'knight', 'w-cool': 'knight', 'm-veteran': 'knight',
  'w-sly': 'sly', 'w-shaman': 'shaman',
}

export const SCHEME_SAYS: Readonly<Record<Tone, Readonly<Record<Scheme, readonly string[]>>>> = lazyTree('scheme', { gruff: { plotAdvise: 2, plotAgainst: 2, pincerAdvise: 2, pincerAgainst: 2, allyHold: 2, allyWait: 2, allySow: 2, allyGo: 2, skyWait: 2, skyGo: 2 }, young: { plotAdvise: 2, plotAgainst: 2, pincerAdvise: 2, pincerAgainst: 2, allyHold: 2, allyWait: 2, allySow: 2, allyGo: 2, skyWait: 2, skyGo: 2 }, wise: { plotAdvise: 2, plotAgainst: 2, pincerAdvise: 2, pincerAgainst: 2, allyHold: 2, allyWait: 2, allySow: 2, allyGo: 2, skyWait: 2, skyGo: 2 }, knight: { plotAdvise: 2, plotAgainst: 2, pincerAdvise: 2, pincerAgainst: 2, allyHold: 2, allyWait: 2, allySow: 2, allyGo: 2, skyWait: 2, skyGo: 2 }, sly: { plotAdvise: 2, plotAgainst: 2, pincerAdvise: 2, pincerAgainst: 2, allyHold: 2, allyWait: 2, allySow: 2, allyGo: 2, skyWait: 2, skyGo: 2 }, shaman: { plotAdvise: 2, plotAgainst: 2, pincerAdvise: 2, pincerAgainst: 2, allyHold: 2, allyWait: 2, allySow: 2, allyGo: 2, skyWait: 2, skyGo: 2 } })

/** 이 장수가 이 처지에서 할 말 — 숨결의 두 마디 가운데 하나 (장수·처지·계절로 정해진다) · 앞에 까닭(why)을 붙인다 */
export function schemeSay(h: Hero, sc: Scheme, v: Readonly<Record<string, string>>, season: number, why = ''): string {
  const pool = SCHEME_SAYS[TONE_OF[voiceKind(h)]][sc]
  const line = fill(pool[pickIdx(`${h.id}:${sc}:${season}`, pool.length)]!, v)
  return sageuk(why !== '' ? `${why} ${line}` : line)
}
