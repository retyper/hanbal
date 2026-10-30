/**
 * 장수 목소리 (형 10-26: "장수들에 각각 목소리를 입히고 싶어 · 그 장수를 탭하면 「네?」 혹은 「부르셨습니까?」 이런 식으로 곧바로 들리길 ·
 * 대사랑 목소리는 캐릭터 개성마다 · 음원 몇 개를 만들고 일단 돌려 써야겠지 · 남자 여자 섹시한 장수 목소리도")
 *
 * 목소리 결 아홉 — 장수마다 하나 (생김 · 특성 · 능력치로 고른다 · VOICE_OF 로 손으로 박을 수 있다).
 *   남: 젊은 무사 young · 거친 노장 gruff · 꾀 많은 책사 sage · 늙은 장수·군주 elder · 매혹 charm
 *   여: 당찬 젊은 무사 bright · 의젓한 장수 cool · 요염한 꾀 sly · 무녀 shaman
 * 결마다 짧은 대답 셋(tap-<결>-1..3) — 탭할 때마다 돌려 가며 하나 (같은 것이 연달아 안 나오게).
 * 결마다 분부 받듦 셋(obey-<결>-1..3) — 일을 확정할 때(사신 · 공작 · 원정 · 맡기기 · 이끌기 · 설득) 「분부대로 하겠습니다」
 *   (형 10-27: "선택하면 소리 나는 건 좋은데, 확정 버튼 눌렀을 땐 「절 찾으셨습니까」가 아니라 「분부대로 하겠습니다」"). 대사는 docs/realm/VOICE-LINES.md.
 * 장수마다 등용 첫마디 하나(hire/<장수 id>) — 내 사람이 되는 장면에서 (형 10-26: "내 사람이 된 사람들의 첫 대사를 들으면 반갑고 흥분될 거 같아").
 *   대사는 hire-lines.ts · 한 줄을 고치면 그 장수 것만 다시 녹음한다 (tools/hire-voice-list.ts 가 결을 알려 준다).
 * 결마다 장수 기술 외침 아홉(art-<결>-<기술>) — 싸움에서 그 기술을 쓰면 컷과 함께 (형 10-26: "특수기술 대사들도 · 가성 말고 힘줘서 · 애니나 게임 성우").
 * 구글 AI 스튜디오 Gemini TTS 무료 목소리에 사극 말투 지시로 뽑았다 (Enzo · Daro · Cruz · Arlo · Neno · Cleo · Kira · Lumi · Hali) —
 * 한 번에 세 줄을 뽑아 tools/split-voice.py 로 잘랐다. 들어 보는 판 realm/voice-picker.html.
 */
import { bustOf } from '../../realm/data/art.ts'
import { HIRE_LINE } from '../../realm/data/hire-lines.ts'
import { hasTrait } from '../../realm/heroes.ts'
import type { Art, Hero } from '../../realm/types.ts'
import { LINES_NEW } from './voice-new.ts'

/** 처음 결 아홉 — 군장 말 · 성우진 B · C 는 이 아홉에만 있다 */
export type BaseKind = 'm-young' | 'm-gruff' | 'm-sage' | 'm-elder' | 'm-charm' | 'w-bright' | 'w-cool' | 'w-sly' | 'w-shaman'
/**
 * 10-29 더한 결 넷 — 청년 무장 · 젊은 여장수 · 중년 무장 · 나이 든 여인 (voice-new.ts · 형: "이미지로는 20대가 많은데 진지하면 목소리가 다 40대 같다").
 * A · B 칸에 녹음했다(B 는 10-30 · voice-b.ts) · C 는 아직 · 군장 말은 BASE_OF 의 가까운 결 것을 빌린다
 */
export type NewKind = 'm-knight' | 'w-knight' | 'm-veteran' | 'w-matron'
export type VoiceKind = BaseKind | NewKind
export const BASE_OF: Readonly<Record<NewKind, BaseKind>> = { 'm-knight': 'm-young', 'w-knight': 'w-cool', 'm-veteran': 'm-gruff', 'w-matron': 'w-cool' }
/** 그 결이 처음 아홉에 없으면 가까운 결로 */
export const baseKind = (k: VoiceKind): BaseKind => (k in BASE_OF ? BASE_OF[k as NewKind] : (k as BaseKind))
export type VoiceLine = 'tap' | 'obey'

/**
 * 싸움 맡김 — 우리 장수가 싸움을 맡아 들 때 셋(돌려 쓴다) · 맡긴 싸움이 끝나면 이김 · 짐 (auto-<결>-1..3 · win · lose)
 * 대사는 docs/realm/VOICE-LINES.md 「싸움 맡김」 · 녹음은 군장 말 묶음에 붙여 함께 뽑았다
 */
export const AUTO_LINE: Readonly<Record<VoiceKind, readonly [string, string, string, string, string]>> = {
  'm-young': ['이 싸움, 제게 맡겨 주시옵소서!', '단숨에 깨뜨리고 오겠사옵니다!', '지켜보아 주시옵소서!', '이겼사옵니다! 보셨사옵니까!', '면목 없사옵니다… 다음엔 꼭!'],
  'm-gruff': ['크하하! 이 싸움은 소장이 맡겠사옵니다!', '한바탕 쓸어버리고 오겠사옵니다!', '술상이나 차려 두시옵소서!', '크하하! 싱겁기 짝이 없사옵니다!', '크윽… 이번엔 소장이 졌사옵니다.'],
  'm-sage': ['판은 이미 읽었사옵니다. 맡겨 주시옵소서!', '수를 두듯 이겨 보이겠사옵니다!', '서두르지 않고 이기겠사옵니다!', '헤아린 대로 되었사옵니다!', '수를 잘못 읽었사옵니다.'],
  'm-elder': ['허허, 늙은 칼이라도 날은 서 있사옵니다!', '이 싸움, 이 늙은이가 거두겠사옵니다!', '조상께 부끄럽지 않게 싸우겠사옵니다!', '허허, 아직 쓸 만하옵니다!', '허허… 늙은 몸이 부끄럽사옵니다.'],
  'm-charm': ['멋지게 이기고 오겠사옵니다!', '웃으며 기다려 주시옵소서!', '이 싸움, 제 몫으로 하겠사옵니다!', '약조대로 이겼사옵니다!', '이런… 체면이 말이 아니옵니다.'],
  'w-bright': ['제가 다 이기고 오겠사옵니다!', '맡겨 주시옵소서, 금방이옵니다!', '보고만 계시옵소서!', '이겼사옵니다! 보셨사옵니까!', '분하옵니다… 다음엔 꼭 이기겠사옵니다!'],
  'w-cool': ['맡겨 주시옵소서! 이기고 오겠사옵니다!', '이 싸움은 제가 끝내겠사옵니다!', '한 걸음도 물러서지 않겠사옵니다!', '이겼사옵니다!', '…송구하옵니다.'],
  'w-sly': ['후후, 재미있게 놀다 오겠사옵니다!', '저들, 금방 울게 될 것이옵니다!', '제게 맡겨 두시옵소서!', '후후, 너무 쉬웠사옵니다!', '흥… 오늘은 봐준 것이옵니다.'],
  'w-shaman': ['하늘이 우리 편이옵니다! 맡겨 주시옵소서!', '방울이 이길 길을 일러 주었사옵니다!', '별이 이긴다 하옵니다!', '하늘이 웃으시옵니다!', '하늘이 등을 돌렸사옵니다…'],
  'm-knight': LINES_NEW['m-knight'].auto, 'w-knight': LINES_NEW['w-knight'].auto, 'm-veteran': LINES_NEW['m-veteran'].auto, 'w-matron': LINES_NEW['w-matron'].auto,
}

/** 결마다 받아 둔 대답 수 — public/realm/voice/<줄>-<결>-<n>.ogg */
const TAKES: Readonly<Record<VoiceLine, number>> = { tap: 3, obey: 3 }

/** 분부 받듦을 녹음해 둔 결 — 없는 결은 짧은 대답(tap)으로 */
const OBEY_KINDS: ReadonlySet<VoiceKind> = new Set<VoiceKind>(['m-young', 'm-gruff', 'm-sage', 'm-elder', 'm-charm', 'w-bright', 'w-cool', 'w-sly', 'w-shaman', 'm-knight', 'w-knight', 'm-veteran', 'w-matron'])

/**
 * 손으로 박은 목소리 — 그림과 이야기가 뚜렷한 장수 (없으면 voiceKind 가 고른다).
 * 10-29 장수 설정 초안(docs/realm/cast)대로 — 초안이 「바꿈」이라 한 장수, 그리고 「맞음」이어도 군주 자리 · 얼굴 표가 다른 결을 고르던 장수.
 * 10-29 새 결 넷으로 다시 옮겼다 — 서른 아래 진지·냉정·결연한 이는 청년 무장 · 젊은 여장수, 35~50 무장 사내는 중년 무장, 마흔 넘은 여인은 나이 든 여인 (docs/realm/cast/README.md). 같은 얼굴의 다른 판 장수는 같은 결
 */
const VOICE_OF: Readonly<Record<string, VoiceKind>> = {
  'goja-1': 'm-gruff', // 살해 바다쇠
  'dokro-2': 'm-veteran', // 견지 쇠돌
  'mh-ogan': 'm-veteran', // 오간
  'tut-ogan': 'm-veteran', // 오간
  'jm-oi': 'm-gruff', // 오이
  'samul-ruler': 'm-young', // 읍차 물결 (그림대로 · 군주 결 대신)
  'ungcheon-ruler': 'm-veteran', // 읍차 곰내
  'sangdang-ruler': 'm-veteran', // 읍차 쇠달 (그림대로 · 군주 결 대신)
  'balla-ruler': 'm-sage', // 신지 큰뫼 (그림대로 · 군주 결 대신)
  'gampyeong-ruler': 'm-veteran', // 읍차 갯벌 (그림대로 · 군주 결 대신)
  'maek-ruler': 'm-young', // 거수 맥돌 (그림대로 · 군주 결 대신)
  'gwanna-ruler': 'm-veteran', // 패자 쇠뫼 (그림대로 · 군주 결 대신)
  'uga-ruler': 'm-veteran', // 우가 소두
  'bukokjeo-ruler': 'm-veteran', // 장수 두만 (그림대로 · 군주 결 대신)
  'jm-okjeo-ruler': 'm-veteran', // 군장 두만 (그림대로 · 군주 결 대신)
  'dabeol-ruler': 'm-elder', // 험측 달구
  'eumjeup-ruler': 'm-elder', // 읍차 즙
  'chopal-ruler': 'm-young', // 읍차 팔매
  'anya-ruler': 'm-sage', // 신지 아단 (그림대로 · 군주 결 대신)
  'goja-ruler': 'm-charm', // 험측 바우
  'dokro-ruler': 'm-charm', // 읍차 가람
  'maga-1': 'm-gruff', // 견사 말굽
  'tamna-1': 'm-veteran', // 살해 오름
  'bihwa-1': 'm-sage', // 살해 늪
  'usan-ruler': 'm-gruff', // 우해왕 물너울 (그림대로 · 군주 결 대신)
  'yangmaek-ruler': 'm-veteran', // 군장 맥손
  'wander-14': 'm-veteran', // 읍차 한결
  'golbeol-1': 'm-elder', // 살해 골개
  'apdok-1': 'm-veteran', // 살해 압
  'chopal-1': 'm-young', // 살해 여울
  'michuhol-1': 'm-veteran', // 살해 소금꾼
  'goguryeo-ruler': 'm-veteran', // 대왕 다물 (그림대로 · 군주 결 대신)
  'buyeo-ruler': 'm-sage', // 왕 금하 (그림대로 · 군주 결 대신)
  'geonma-1': 'm-gruff', // 살해 말발굽
  'gosaburi-1': 'm-young', // 살해 부리
  'baekje-ruler': 'm-sage', // 신지 온누리 (그림대로 · 군주 결 대신)
  'mujin-1': 'm-sage', // 살해 빛고을
  'guya-ruler': 'm-veteran', // 진지렴 쇠보 (그림대로 · 군주 결 대신)
  'siljik-1': 'm-veteran', // 살해 파도
  'sr-hyeokgeose': 'm-young', // 혁거세
  'sr-hogong': 'm-elder', // 호공
  'sr-alpyeong': 'm-sage', // 촌장 알평 (그림대로 · 군주 결 대신)
  'sr-jibaekho': 'm-gruff', // 촌장 지백호
  'sr-guryema': 'm-young', // 촌장 구례마 (그림대로 · 군주 결 대신)
  'sr-jita': 'm-charm', // 촌장 지타
  'sr-hojin': 'm-veteran', // 촌장 호진
  'wander-25': 'm-knight', // 견지 서늘
  'mh-mahan-3': 'm-veteran', // 읍차 금바위
  'sr-wae-ruler': 'm-gruff', // 왜인 우두머리 (그림대로 · 군주 결 대신)
  'jm-songyang': 'm-sage', // 송양 (그림대로 · 군주 결 대신)
  'jomun-1': 'm-sage', // 살해 솔개
  'mh-soseono': 'w-cool', // 소서노
  'wander-09': 'w-knight', // 신지 별하
  'wander-06': 'w-knight', // 번예 새벽
  'wander-20': 'w-bright', // 번예 이슬
  'dokro-1': 'w-cool', // 살해 너울
  'wander-04': 'w-knight', // 험측 소리
  'wander-13': 'w-sly', // 살해 노을
  'goja-2': 'w-bright', // 번예 물새
  'wander-01': 'w-sly', // 번예 다솜
  'wander-10': 'w-bright', // 번예 연이
  'wander-08': 'w-cool', // 살해 물결
  'usisan-ruler': 'w-cool', // 번예 소금
  'apdok-ruler': 'w-bright', // 읍차 누리 (그림대로 · 군주 결 대신)
  'bihwa-ruler': 'w-knight', // 번예 빛나 — 스물넷 제사장 · 무당 결이 나이 든 여인처럼 들려 젊은 결로 (형 10-29: "21살 아이돌 같은데 목소리가 아줌마")
  'michuhol-ruler': 'w-bright', // 읍차 비라
  'guya-3': 'w-knight', // 견지 쇠비
  'dabeol-2': 'w-sly', // 번예 달빛
  'chopal-2': 'w-knight', // 살해 들메
  'jomun-2': 'w-bright', // 번예 오디
  'baekje-2': 'w-knight', // 견지 매나
  'gwanna-2': 'w-knight', // 조의 쇠눈
  'geonma-ruler': 'w-bright', // 신지 마루 (그림대로 · 군주 결 대신)
  'gosaburi-ruler': 'w-knight', // 읍차 바람
  'mujin-ruler': 'w-matron', // 읍차 무등
  'siljik-ruler': 'w-matron', // 읍차 물가 (그림대로 · 군주 결 대신)
  'haseulla-ruler': 'w-knight', // 삼로 단궁
  'biryuna-ruler': 'w-bright', // 패자 송비
  'hwanna-ruler': 'w-sly', // 패자 가비 (그림대로 · 군주 결 대신)
  'maga-ruler': 'w-bright', // 마가 달리 (그림대로 · 군주 결 대신)
  'guga-ruler': 'w-bright', // 구가 누리
  'dongokjeo-ruler': 'w-matron', // 장수 소금 (그림대로 · 군주 결 대신)
  'bullae-ruler': 'w-knight', // 삼로 박달
  'jomun-ruler': 'w-knight', // 살해 이랑
  'golbeol-ruler': 'w-sly', // 살해 범
  'iseo-ruler': 'w-knight', // 읍차 시내 (그림대로 · 군주 결 대신)
  'byeokjin-ruler': 'w-bright', // 읍차 별 (그림대로 · 군주 결 대신)
  'us-ruler': 'w-bright', // 읍차 해솔
  'miri-ruler': 'w-bright', // 신지 달래 (그림대로 · 군주 결 대신)
  'buyeo-1': 'w-knight', // 대사 해달
  'jm-haedal': 'w-knight', // 해달
  'maek-1': 'w-sly', // 살해 범발
  'jeoga-1': 'w-cool', // 견사 엄니
  'bukokjeo-1': 'w-cool', // 장수 물범
  'jm-okjeo-1': 'w-cool', // 물범
  'yeonna-1': 'w-knight', // 선인 너울
  'eumjeup-1': 'w-cool', // 살해 벌
  'balla-1': 'w-shaman', // 살해 독무덤
  'daegaya-1': 'w-cool', // 견지 쇠뫼
  'gampyeong-1': 'w-matron', // 살해 뱃사공
  'wansan-1': 'w-knight', // 살해 완
  'yangmaek-1': 'w-knight', // 장수 솔매
  'wander-22': 'w-bright', // 신지 너울 — 스물둘. 젊은 여장수 결(Tari)도 서른 넘게 들려 가장 젊은 결로 (형 10-30: "이미지는 21살인데 목소리는 35살") · 성우진 D 를 고르면 그리로
  'sr-goya-1': 'w-sly', // 명활 달래
  'mh-mahan-2': 'w-knight', // 원산 지기 달래
  'jm-haengin-1': 'w-knight', // 산지기 너울
  // 10-29 새 결 넷으로 옮긴 장수 (docs/realm/cast 나이·성격대로)
  'guga-1': 'm-knight',
  'sr-danbi': 'w-knight',
  'anya-1': 'w-knight',
  'anya-2': 'w-knight',
  'jm-mari': 'm-veteran',
  'gwanna-1': 'm-veteran',
  'guya-1': 'm-veteran',
  'tut-maryeo': 'm-veteran',
  'sangdang-1': 'm-veteran',
  'goguryeo-1': 'm-veteran',
  'gammun-1': 'm-veteran',
  'saro-1': 'm-veteran',
  'mh-mahan-1': 'm-veteran',
}

/** 등용 대사를 새로 쓰고 아직 녹음하지 않은 장수 — hire/<id>.ogg 가 없다. 녹음하면 여기서 지운다 (tests/realm/hire-lines.test.ts) */
export const HIRE_UNRECORDED: ReadonlySet<string> = new Set<string>([])

/**
 * 얼굴이 고르는 목소리 — 명치판 그림을 보고 박았다. 특성·능력치보다 먼저 (형 10-26: "험측 하늘 이미지는 나이든 무속인인데 젊은 장수 목소리임").
 * 군주라고 다 늙은 목소리가 아니다 — 주몽·온조·혁거세는 젊다. 그림을 바꾸면 여기도 본다
 */
const VOICE_OF_FACE: Readonly<Record<string, VoiceKind>> = {
  // 늙은 얼굴 — 흰 수염 · 주름 · 쉰 넘은 군장
  'g-01-master-smith': 'm-elder', 'g-05-mahan-chieftain': 'm-elder', 'g-15-shaman-man': 'm-elder', 'g-18-daegaya-king': 'm-elder',
  'g-19-sabeol-veteran': 'm-elder', 'g-29-yeonna-myeongsol': 'm-elder', 'g-50-bullae-gwaha': 'm-elder', 'g-54-mokji-mahan': 'm-elder',
  'g-69-goryong-yong': 'm-elder', 'g-77-saro-sobeol': 'm-elder', 'g-90-haengin-gomok': 'm-elder',
  // 젊은 얼굴 — 군주여도 젊은 소리
  'g-02-goguryeo-archer-prince': 'm-knight', 'g-12-silla-youth': 'm-young', 'g-43-hwanna-amnok': 'm-young', 'g-56-haseulla-gwahama': 'm-young',
  'g-64-jumong': 'm-young', 'g-71-baekje-onjo': 'm-knight', 'g-28-goguryeo-damul': 'm-young',
  // 고운 얼굴 — 매혹
  'g-24-wansan-onsan': 'm-charm', 'g-51-biryuna-mulgyeol': 'm-charm', 'g-62-beonye-hanul': 'm-charm', 'g-74-saro-hyeokgeose': 'm-charm',
  'g-84-wander-seoneul': 'm-charm', 'g-67-buyeo-daeso': 'm-charm',
  // 거친 얼굴 — 장사 · 술꾼 · 덩치
  'g-04-jinhan-giant': 'm-gruff', 'g-07-drunk-warrior': 'm-gruff', 'g-33-jeoga-metdol': 'm-gruff', 'g-45-dabeol-deulgae': 'm-gruff',
  'g-61-heomcheuk-bawi': 'm-gruff', 'g-63-heomcheuk-beogeum': 'm-gruff',
  // 책사 · 무당 얼굴 — 차분한 소리
  'g-06-strategist': 'm-sage', 'g-73-baekje-eureum': 'm-sage', 'g-75-saro-hogong': 'm-sage', 'g-36-gammun-gamdol': 'm-sage',
  // 자란 아이 — 얼굴마다 설정대로 (docs/realm/cast/kids.md · 형 10-29)
  'y-g-01': 'm-young', 'y-g-02': 'm-charm', 'y-g-03': 'm-gruff', 'y-g-04': 'm-knight', 'y-g-05': 'm-young', 'y-g-06': 'm-charm', 'y-g-07': 'm-knight', 'y-g-09': 'm-sage',
  'y-g-10': 'm-knight', 'y-g-11': 'm-gruff', 'y-g-12': 'm-sage', 'y-g-13': 'm-young', 'y-g-14': 'm-knight', 'y-g-15': 'm-young', 'y-g-16': 'm-charm', 'y-g-17': 'm-knight',
  'y-w-01': 'w-bright', 'y-w-02': 'w-knight', 'y-w-03': 'w-bright', 'y-w-04': 'w-knight', 'y-w-05': 'w-sly', 'y-w-06': 'w-sly', 'y-w-07': 'w-knight', 'y-w-09': 'w-shaman',
  'y-w-10': 'w-knight', 'y-w-11': 'w-bright', 'y-w-12': 'w-shaman', 'y-w-13': 'w-sly', 'y-w-14': 'w-knight', 'y-w-15': 'w-bright', 'y-w-16': 'w-sly', 'y-w-17': 'w-knight',
}

/** 같은 소리가 겹쳐 나오지 않게 — 이만큼(ms) 안에 또 누르면 조용히 */
const GAP_MS = 450
let lastAt = -Infinity
const lastTake = new Map<string, number>()

/** 장수의 목소리 결 — 생김 · 특성 · 능력치. 같은 장수는 늘 같은 결 */
export function voiceKind(h: Hero, ruler = false): VoiceKind {
  const fixed = VOICE_OF[h.id]
  if (fixed !== undefined) return fixed
  const face = bustOf(h.id)
  const byFace = face !== undefined ? VOICE_OF_FACE[face] : undefined
  if (byFace !== undefined) return byFace
  if (h.look === 'w') {
    if (hasTrait(h, 'shaman')) return 'w-shaman'
    if (hasTrait(h, 'charm') || hasTrait(h, 'traitor')) return 'w-sly'
    if (ruler || h.mu + h.tong >= 14 || hasTrait(h, 'steadfast') || hasTrait(h, 'hundred')) return 'w-cool'
    if (h.ryak >= 8 || hasTrait(h, 'trader')) return 'w-sly'
    return 'w-bright'
  }
  if (hasTrait(h, 'charm')) return 'm-charm'
  if (ruler || ((hasTrait(h, 'steadfast') || hasTrait(h, 'hundred')) && h.tong >= 7)) return 'm-elder'
  if (hasTrait(h, 'shaman') || hasTrait(h, 'careful') || h.ryak >= 8 || h.chi >= 8) return 'm-sage'
  if (hasTrait(h, 'drinker') || hasTrait(h, 'glutton') || hasTrait(h, 'smith') || hasTrait(h, 'ironhand') || h.mu >= 8) return 'm-gruff'
  if (hasTrait(h, 'coward')) return 'm-young'
  // 나머지는 이름으로 둘 중 하나 — 모두가 같은 소리를 내지 않게
  let s = 0
  for (const c of h.id) s = (s * 31 + c.charCodeAt(0)) >>> 0
  return s % 3 === 0 ? 'm-gruff' : 'm-young'
}

/**
 * 성우진 — 같은 결의 장수를 이름으로 셋씩 갈라 A · B(voice-b.ts · voice/b/) · C(voice-c.ts · voice/c/)로 말한다.
 * 전엔 같은 결이면 전혀 다른 장수가 똑같은 대사를 쳤다 (형 10-29: "성우진 B · 중복된 것들의 절반과 교체" · "성우진 C · 대사 제대로").
 * 같은 장수는 늘 같은 성우. C 를 아직 녹음하지 않은 결은 A·B 반반으로 (없는 소리를 부르지 않게)
 */
const castHash = (h: Hero): number => {
  let s = 7
  for (const c of h.id) s = (s * 131 + c.charCodeAt(0)) >>> 0
  return s >>> 3
}
/** 성우진 B 를 녹음해 둔 결 — public/realm/voice/b/ (10-30 새 결 넷도 B 녹음 · C 는 아직이라 새 결은 A·B 반반) */
const B_KINDS: ReadonlySet<VoiceKind> = new Set<VoiceKind>(['m-young', 'm-gruff', 'm-sage', 'm-elder', 'm-charm', 'w-bright', 'w-cool', 'w-sly', 'w-shaman', 'm-knight', 'w-knight', 'm-veteran', 'w-matron'])
/** 성우진 C 를 녹음해 둔 결 — public/realm/voice/c/ (tools/voicec-list.ts 가 다 있나 본다) */
const C_KINDS: ReadonlySet<VoiceKind> = new Set<VoiceKind>(['m-young', 'm-gruff', 'm-sage', 'm-elder', 'm-charm', 'w-bright', 'w-cool', 'w-sly', 'w-shaman'])
export function castOf(h: Hero, ruler = false): 'a' | 'b' | 'c' {
  const k = voiceKind(h, ruler)
  if (!B_KINDS.has(k)) return 'a'
  const t = castHash(h)
  if (t % 3 === 2 && C_KINDS.has(k)) return 'c'
  return t % 2 === 1 ? 'b' : 'a'
}
/** 군장 말(chief-lines · chief-lines-b)은 A·B 둘뿐 — 예전처럼 반씩 */
export function chiefCastOf(h: Hero): 'a' | 'b' {
  return castHash(h) % 2 === 1 ? 'b' : 'a'
}
const CAST_DIR = { a: 'realm/voice/', b: 'realm/voice/b/', c: 'realm/voice/c/' } as const
const dirOf = (h: Hero, ruler = false): string => CAST_DIR[castOf(h, ruler)]

/** 그 장수의 그 줄 — 탭할 때마다 돌려 가며 하나 (화면 쪽 무작위 — 판의 결정론과 무관) */
export function voicePath(h: Hero, want: VoiceLine, ruler = false): string {
  const k = voiceKind(h, ruler)
  const line: VoiceLine = want === 'obey' && !OBEY_KINDS.has(k) ? 'tap' : want
  const n = TAKES[line]
  const key = `${line}-${k}`
  const prev = lastTake.get(key) ?? 0
  let t = 1 + Math.floor(Math.random() * n)
  if (n > 1 && t === prev) t = (t % n) + 1
  lastTake.set(key, t)
  return `${dirOf(h, ruler)}${key}-${t}.ogg`
}

/** 장수 기술 외침 — 그 장수의 결로 */
export function artVoicePath(h: Hero, art: Art, ruler = false): string {
  return `${dirOf(h, ruler)}art-${voiceKind(h, ruler)}-${art}.ogg`
}

/** 싸움 맡김 — 맡아 들 때(go · 셋을 돌려 가며) · 맡긴 싸움이 끝나면 이김(win) · 짐(lose) */
export function autoVoicePath(h: Hero, want: 'go' | 'win' | 'lose', ruler = false): string {
  const k = voiceKind(h, ruler)
  if (want !== 'go') return `${dirOf(h, ruler)}auto-${k}-${want}.ogg`
  const key = `auto-${k}`
  const prev = lastTake.get(key) ?? 0
  let t = 1 + Math.floor(Math.random() * 3)
  if (t === prev) t = (t % 3) + 1
  lastTake.set(key, t)
  return `${dirOf(h, ruler)}${key}-${t}.ogg`
}

/** 등용 첫마디 — 그 장수가 녹음한 대사 · 대사가 없는 장수(판에서 난 아이 등)는 그 결의 짧은 대답으로 */
export function hireVoicePath(h: Hero, ruler = false): string {
  return HIRE_LINE[h.id] !== undefined && !HIRE_UNRECORDED.has(h.id) ? `realm/voice/hire/${h.id}.ogg` : voicePath(h, 'tap', ruler)
}

/** 이번에 소리를 내도 되나 — 너무 잦으면 거른다 (now 는 화면 쪽 시계) */
export function voiceGate(now: number): boolean {
  if (now - lastAt < GAP_MS) return false
  lastAt = now
  return true
}
