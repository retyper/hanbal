/**
 * 장수 전용 성우 (형 11-02: "캐릭터마다 성우를 따로 · 목소리 모델마다 제대로 이해해야").
 * 주요 인물마다 바탕 목소리(AI 스튜디오 이름) 하나와 그 사람 말투 지시 한 줄을 고정하고, 그 사람 대사로 따로 녹음한다.
 * 녹음한 장수는 결 묶음(voice.ts voiceSlot) 대신 public/realm/voice/hero/<장수 id>/ 의 소리를 낸다 — 아직이면 결 묶음 그대로.
 *
 * 말투 지시는 BASE_STYLE + 그 사람 style. BASE_STYLE 은 형이 목소리 도감의 말투 시험에서 고른 「나」(애니·게임 더빙 성우)에
 * "문장 중간에 끊지 않게"를 더한 것 (형 11-02: "'저 성을 (쉬고) 반드시' 이렇게 템포 치는 것만 빼면 좋음").
 * 외침 줄(싸움 맡김 · 기술)은 SHOUT_STYLE 을 더해 따로 뽑는다 (메모리: 외침은 격앙되게 · 차분한 줄과 한 묶음에 섞지 않는다).
 * 견본·판정은 목소리 도감 아티팩트 (메모리 voice-book-cast).
 */
import type { Art } from '../../realm/types.ts'

export const BASE_STYLE = '한국 애니메이션·게임 더빙 전문 성우의 녹음실 연기. 발음이 또박또박 맑고, 목소리에 울림과 힘이 있으며, 캐릭터가 분명하다. 문장 중간에 일부러 끊거나 뜸을 들이지 않고 한 호흡으로 이어 읽는다. 연극 배우나 일상 대화 말투가 아니다.'
export const SHOUT_STYLE = '전장에서 수백 군사에게 외치는 함성. 흥분하고 격앙되어 가슴에서 터져 나오는 큰 소리. 가성이 아니다.'

export interface HeroVoice {
  /** AI 스튜디오 목소리 이름 */
  readonly voice: string
  /** 그 사람만의 말투 지시 (BASE_STYLE 뒤에 붙는다) */
  readonly style: string
  /** 짧은 대답 셋 · 분부 받듦 셋 */
  readonly tap: readonly [string, string, string]
  readonly obey: readonly [string, string, string]
  /** 싸움 맡김 셋 · 이김 · 짐 */
  readonly auto: readonly [string, string, string, string, string]
  /** 그 장수의 기술(heroArt) 하나와 외침 */
  readonly art: readonly [Art, string]
  /** 녹음을 마쳤나 — 참이면 hero/<id>/ 의 소리를 낸다 */
  readonly recorded: boolean
}

export const HERO_VOICE: Readonly<Record<string, HeroVoice>> = {
  // 소서노 — 온조의 어머니 · 31세 · 나라를 세우는 사람. 형: "고귀한 느낌의 귀족, 하지만 건방지진 않은 우아한 이미지" · 도감에서 Kore (11-02)
  'mh-soseono': {
    voice: 'Kore',
    style: '나라를 세운 우아한 왕비. 따뜻한 위엄과 여유, 품위 있고 차분하다. 거만하거나 차갑지 않다.',
    tap: ['말씀하소서.', '부르셨사옵니까.', '곁에 있사옵니다. 하명하소서.'],
    obey: ['그리하겠사옵니다. 염려 마소서.', '맡겨 주소서. 차질 없이 해내겠사옵니다.', '뜻을 받들겠사옵니다.'],
    auto: ['이 싸움은 제가 맡겠사옵니다! 지켜보소서!', '흔들리지 마라! 우리가 세울 나라다!', '백성의 땅을 지킨다! 나아가라!', '이겼사옵니다. 다친 이부터 살피소서.', '송구하옵니다. 다시 일어서면 되옵니다.'],
    art: ['shout', '두려워 마라! 이 땅은 우리가 지킨다! 함성을 올려라!'],
    recorded: true,
  },
}

/** 그 장수의 전용 소리 폴더 — 녹음 전이면 null */
export function heroVoiceDir(id: string): string | null {
  return HERO_VOICE[id]?.recorded === true ? `realm/voice/hero/${id}/` : null
}
