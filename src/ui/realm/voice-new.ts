/**
 * 결 넷 더 (형 10-29: "우리 무장들이 이미지로는 20대가 많은데 진지하면 목소리가 다 40대 같다 · 진지하면서도 젊은 목소리").
 *   m-knight 청년 무장 (남 20대 · 진지하고 곧다 · 낮고 단단하되 젊게)   w-knight 젊은 여장수 (여 20대 · 단정하고 결연하다)
 *   m-veteran 중년 무장 (남 35~50 · 굵고 노련하다)                       w-matron 나이 든 여인 (여 40~55 · 차분하고 묵직하다)
 * 성우진 A 칸(public/realm/voice/ 바로 아래 · 이름 꼴은 다른 결과 같다)에 녹음했다. 10-30 성우진 B(voice-b.ts · Iapetus · Zephyr(옛 Erinome) · Schedar · Vindemiatrix)도 녹음해 이 결의 장수는 A · B 반반으로 말한다 · C 는 아직 (voice.ts castOf).
 * 군장 말은 가까운 옛 결의 것을 빌린다 (voice.ts BASE_OF). 사극 말투 · 부르는 말(주군 · 그대 · 전하) 없이 · 「~요」로 끝나는 말 없이.
 * 대사는 챗지피티와 교차 검증해 고친 안을 그대로 받았다 (형 10-29).
 * 녹음: AI 스튜디오 Gemini TTS 무료 목소리 VOICE_NEW (A · B · C 와 겹치지 않게) · tools/voicenew-list.ts 가 묶음 글을 낸다.
 * 10-30 젊은 여장수는 Gemini 3.8 TTS 규칙으로 다시 녹음 — 말투 칸은 짧게(나이·성별 없이) · 차분한 줄(대답·분부·짐)과 외침(맡김·이김·기술)을 따로 ·
 *   외침 대본엔 꺾쇠 태그(<heavy breath> <grunt> <argh>)만 · 말투 칸 글은 docs/realm/cast/README.md 「젊은 여장수 새 목소리」.
 */
import type { Art } from '../../realm/types.ts'
import type { NewKind } from './voice.ts'

/** 결마다 목소리 — AI 스튜디오 이름 */
export const VOICE_NEW: Readonly<Record<NewKind, string>> = {
  // w-knight 는 10-30 Tari → Leda (형: "성우진 D 중에서는 Leda 가 제일 젊네" · Tari 는 서른 넘게 들렸다)
  'm-knight': 'Orus', 'w-knight': 'Leda', 'm-veteran': 'Ludo', 'w-matron': 'Jori',
}

/** 짧은 대답 셋 · 분부 받듦 셋 · 싸움 맡김 다섯(맡김 셋 · 이김 · 짐) */
export const LINES_NEW: Readonly<Record<NewKind, { tap: readonly string[]; obey: readonly string[]; auto: readonly [string, string, string, string, string] }>> = {
  'm-knight': {
    tap: ['예, 여기 있사옵니다.', '부르셨사옵니까.', '명을 기다리고 있었사옵니다.'],
    obey: ['분부 받들겠사옵니다.', '반드시 해내겠사옵니다.', '맡은 일은 끝까지 완수하겠사옵니다.'],
    auto: ['이 싸움, 소장이 맡겠사옵니다!', '흔들림 없이 적을 꺾겠사옵니다!', '한 걸음도 물러서지 않겠사옵니다!', '적을 물리쳤사옵니다!', '면목 없사옵니다. 반드시 설욕하겠사옵니다.'],
  },
  'w-knight': {
    tap: ['예, 여기 있사옵니다.', '부르셨사옵니까.', '분부를 기다리고 있었사옵니다.'],
    obey: ['분부 받들겠사옵니다.', '반드시 완수하겠사옵니다.', '목숨을 걸고 임무를 다하겠사옵니다.'],
    auto: ['이 싸움, 제가 맡겠사옵니다!', '한 치도 물러서지 않겠사옵니다!', '반드시 이기고 돌아오겠사옵니다!', '적을 물리쳤사옵니다!', '송구하옵니다. 다시 한번 기회를 주시옵소서.'],
  },
  'm-veteran': {
    tap: ['소장, 여기 있소이다.', '부르셨소이까.', '무슨 일이옵니까.'],
    obey: ['알겠소이다. 맡겨 주시옵소서.', '이런 일은 손에 익었사옵니다.', '분부대로 처리하겠소이다.'],
    auto: ['싸움은 겪어 본 자가 이기는 법이옵니다!', '소장이 판을 정리하고 오겠소이다!', '느긋이 기다리시옵소서!', '예상대로였소이다! 적을 물리쳤소이다!', '허, 이번엔 소장이 수를 읽지 못했소이다.'],
  },
  'w-matron': {
    tap: ['예, 여기 있사옵니다.', '찾으셨사옵니까.', '말씀하시옵소서.'],
    obey: ['분부대로 하겠사옵니다.', '염려 놓으시옵소서.', '이 몸이 맡겠사옵니다.'],
    auto: ['이 싸움은 이 몸이 맡겠사옵니다!', '서두르지 않고 적을 꺾겠사옵니다!', '무사히 돌아오겠사옵니다! 심려 놓으시옵소서!', '무사히 적을 물리쳤사옵니다!', '부끄럽사옵니다. 이 몸이 부족했사옵니다.'],
  },
}

/** 기술 외침 — A 칸의 다른 결과 같은 글을 제 목소리로 (realm/voice-picker.html 「싸움 기술 외침」 · 숨 쉴 자리에 쉼표·느낌표만 더함) */
export const ART_A: Readonly<Record<Art, string>> = {
  snipe: '이 화살을 받아라!',
  rite: '천지신명이시여, 굽어살피소서!',
  sway: '칼을 거두고 우리 편에 서라!',
  stand: '한 걸음도 물러서지 마라!',
  ambush: '지금이다! 샛길로 쳐라!',
  vanguard: '나를 따르라!',
  feint: '물러나는 척하라!',
  order: '진을 갖춰라!',
  shout: '두려워 마라! 우리가 이긴다!',
}
