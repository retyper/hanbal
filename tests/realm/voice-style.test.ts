/**
 * 여자 장수 말투에 남자처럼 들리게 하는 말이 없어야 한다 (11-11 형: "번예 달빛은 여자인데 남자 목소리로 녹음했냐" — 「나직하고」가 들어가 있었다).
 * 메모리 voice-book-cast: 여자 style 에 낮은·굵직·묵직·거친·걸걸·바다/뱃사람 같은 말 → 남자처럼 된다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HERO_VOICE } from '../../src/ui/realm/voice-hero.ts'

const MALE_SOUNDING = /낮|나직|굵|묵직|거친|걸걸|쉰 목|허스키|중저음|탁한|뱃사람|사내/
/** 「…가 아니다」 꼴의 부정 문장은 뺀다 (「늙거나 쉰 목소리가 아니다」) */
const positive = (s: string): string => s.split(/(?<=[.。])\s*/).filter((x) => !/아니다\.?$/.test(x.trim())).join(' ')
/** 형이 녹음본을 들은 사람 (11-10 뱃사공 · 형 판정 뒤 손대지 않는다) */
const HEARD = new Set(['gampyeong-1'])
/** 형이 「게이임 · 절대 쓰지 말 것」으로 판정한 목소리 */
const BANNED = new Set(['Enya', 'Gacrux', 'Kore', 'Pulcherrima', 'Vindemiatrix', 'Zali', 'Sami'])

test('여자 장수 말투에 남자처럼 들리는 말이 없다', () => {
  const bad = Object.entries(HERO_VOICE).filter(([id, v]) => v.male !== true && !HEARD.has(id) && MALE_SOUNDING.test(positive(v.style))).map(([id, v]) => `${id}: ${v.style}`)
  assert.deepEqual(bad, [])
})

test('새로 정한 목소리에 금지 목소리가 없다 (옛 소서노 Kore 는 형이 고른 것이라 둔다)', () => {
  const bad = Object.entries(HERO_VOICE).filter(([id, v]) => id !== 'mh-soseono' && BANNED.has(v.voice)).map(([id, v]) => `${id}: ${v.voice}`)
  assert.deepEqual(bad, [])
})
