import type { Hero } from './types.ts'
import { HERO_BUST } from './data/hero-bust.ts'
import { AWAKEN_ART } from './data/awaken-art.ts'
import { P } from '../tune/params.ts'
/**
 * 본편의 시련 관문이 열려 있나 — 스위치 하나 (P.realm.ascendTrialOpen · 각성 v2 · docs/realm/study-20261118/30-PROPOSAL.md 1절 ⑧ · 7-1 가4).
 *  1 (기본 · 지금 규칙): 불꽃이 다 켜지면 시련이 열리고, 시련을 넘어야 힘(능력치 · 각성기)이 붙는다.
 *  0 (형의 판이 끝난 뒤 켠다): 본편 장수에게 시련이 없다. 불꽃이 다 켜지는 싸움 끝에 예전 길(heroes.kindle → awardAwakening)로 곧바로 붙는다.
 * 수치만 본다. 판 밖 기록(영웅전 · 열전 기록)은 읽지 않는다 (A1). 옛 저장을 고치는 줄도 없다:
 * 시련이 열린 채(trialReady) 멈춘 장수는 0 에서 다음에 이기는 제 몫의 싸움 끝에 예전 길을 탄다.
 */
/** Legacy entry + merit path is preserved for rollback/tests, closed in the 56-A product. */
export const legacyAwakeningOpen = (): boolean => Math.round(P.realm.legacyAwakeningOpen) >= 1

export const ascendTrialOpen = (): boolean => Math.round(P.realm.ascendTrialOpen) >= 1
/**
 * 각성 시련이 있는 장수 — 1차 각성 그림이 있는 이름난 장수 모두 (형 11-15: 「각성 시련을 모든 장수로」 · 처음엔 해비 하나였다).
 * 우리 장수는 공훈을 채우면 시련이 열리고, 열전의 두목을 쓰러뜨려야 각성한다. 자녀처럼 각성 그림이 없는 장수는 예전 길(공훈이 차면 바로 각성).
 * 배우는 판(tut-)의 다른 장수는 예전 길 그대로 — 판이 「갯골 싸움을 이기면 말갈기가 각성한다」를 약속하고, 첫 30분에 10분 열전을 끼우지 않는다. 해비만 판 안에서 시련을 보여 준다.
 * 관문이 닫히면(ascendTrialOpen 0) 본편 장수는 모두 예전 길이다. 배우는 판의 해비는 그대로 시련을 보여 준다 (열전을 처음 만나는 자리).
 */
export const hasAwakeningTrial = (h: Pick<Hero, 'id'>) => legacyAwakeningOpen() && ( h.id === 'tut-haebi' || ascendTrialOpen() && !h.id.startsWith('tut-') && AWAKEN_ART.has(HERO_BUST[h.id] ?? ''))
