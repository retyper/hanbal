import type { Hero } from './types.ts'
import { HERO_BUST } from './data/hero-bust.ts'
import { AWAKEN_ART } from './data/awaken-art.ts'
/**
 * 각성 시련이 있는 장수 — 1차 각성 그림이 있는 이름난 장수 모두 (형 11-15: 「각성 시련을 모든 장수로」 · 처음엔 해비 하나였다).
 * 우리 장수는 공훈을 채우면 시련이 열리고, 열전의 두목을 쓰러뜨려야 각성한다. 자녀처럼 각성 그림이 없는 장수는 예전 길(공훈이 차면 바로 각성).
 * 배우는 판(tut-)의 다른 장수는 예전 길 그대로 — 판이 「갯골 싸움을 이기면 말갈기가 각성한다」를 약속하고, 첫 30분에 10분 열전을 끼우지 않는다. 해비만 판 안에서 시련을 보여 준다.
 */
export const hasAwakeningTrial = (h: Pick<Hero, 'id'>) => h.id === 'tut-haebi' || !h.id.startsWith('tut-') && AWAKEN_ART.has(HERO_BUST[h.id] ?? '')
