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

export type VoiceKind = 'm-young' | 'm-gruff' | 'm-sage' | 'm-elder' | 'm-charm' | 'w-bright' | 'w-cool' | 'w-sly' | 'w-shaman'
export type VoiceLine = 'tap' | 'obey'

/**
 * 싸움 맡김 — 우리 장수가 싸움을 맡아 들 때 셋(돌려 쓴다) · 맡긴 싸움이 끝나면 이김 · 짐 (auto-<결>-1..3 · win · lose)
 * 대사는 docs/realm/VOICE-LINES.md 「싸움 맡김」 · 녹음은 군장 말 묶음에 붙여 함께 뽑았다
 */
export const AUTO_LINE: Readonly<Record<VoiceKind, readonly [string, string, string, string, string]>> = {
  'm-young': ['싸움은 제게 맡기시오!', '단숨에 깨뜨리고 오겠소!', '지켜보기만 하시오!', '이겼소! 보셨소?', '면목 없소… 다음엔 꼭!'],
  'm-gruff': ['크하하, 이 싸움 내가 맡소!', '한바탕 쓸어 버리고 오리다!', '술상이나 차려 두시오!', '크하하! 싱겁구먼!', '크윽, 이번엔 내가 졌소.'],
  'm-sage': ['판은 이미 읽었습니다. 맡겨 주십시오.', '수를 두듯 이겨 보이겠습니다.', '서두르지 않고 이기겠습니다.', '헤아린 대로 되었습니다.', '수를 잘못 읽었습니다.'],
  'm-elder': ['허허, 늙은 칼이라도 날은 서 있소.', '이 싸움, 내가 거두리다.', '조상께 부끄럽지 않게 싸우겠소.', '허허, 아직 쓸 만하지요.', '허허… 늙은 몸이 부끄럽소.'],
  'm-charm': ['멋지게 이기고 오리다.', '그대는 웃으며 기다리시오.', '이 싸움, 내 몫으로 하지요.', '약속대로 이겼소.', '이런, 체면이 말이 아니군.'],
  'w-bright': ['제가 다 이기고 올게요!', '맡겨 주세요, 금방이에요!', '보고만 계세요!', '이겼어요! 봤죠?', '분해요… 다음엔 꼭 이길게요!'],
  'w-cool': ['맡겨 주십시오. 이기고 오겠습니다.', '싸움은 제가 끝냅니다.', '물러서지 않겠습니다.', '이겼습니다.', '…송구합니다.'],
  'w-sly': ['후후, 재미있게 놀다 올게요.', '저들, 금방 울게 될 거예요.', '제게 맡겨 두세요.', '후후, 너무 쉬웠네요.', '흥, 오늘은 봐준 거예요.'],
  'w-shaman': ['하늘이 우리 편이에요. 맡겨 주세요.', '방울이 이길 길을 일러 줘요.', '별이 이긴다고 말하네요.', '하늘이 웃어요.', '하늘이 등을 돌렸어요…'],
}

/** 결마다 받아 둔 대답 수 — public/realm/voice/<줄>-<결>-<n>.ogg */
const TAKES: Readonly<Record<VoiceLine, number>> = { tap: 3, obey: 3 }

/** 분부 받듦을 녹음해 둔 결 — 없는 결은 짧은 대답(tap)으로 */
const OBEY_KINDS: ReadonlySet<VoiceKind> = new Set<VoiceKind>(['m-young', 'm-gruff', 'm-sage', 'm-elder', 'm-charm', 'w-bright', 'w-cool', 'w-sly', 'w-shaman'])

/** 손으로 박은 목소리 — 그림과 이야기가 뚜렷한 장수 (없으면 voiceKind 가 고른다) */
const VOICE_OF: Readonly<Record<string, VoiceKind>> = {}

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
  'g-02-goguryeo-archer-prince': 'm-young', 'g-12-silla-youth': 'm-young', 'g-43-hwanna-amnok': 'm-young', 'g-56-haseulla-gwahama': 'm-young',
  'g-64-jumong': 'm-young', 'g-71-baekje-onjo': 'm-young', 'g-28-goguryeo-damul': 'm-young',
  // 고운 얼굴 — 매혹
  'g-24-wansan-onsan': 'm-charm', 'g-51-biryuna-mulgyeol': 'm-charm', 'g-62-beonye-hanul': 'm-charm', 'g-74-saro-hyeokgeose': 'm-charm',
  'g-84-wander-seoneul': 'm-charm', 'g-67-buyeo-daeso': 'm-charm',
  // 거친 얼굴 — 장사 · 술꾼 · 덩치
  'g-04-jinhan-giant': 'm-gruff', 'g-07-drunk-warrior': 'm-gruff', 'g-33-jeoga-metdol': 'm-gruff', 'g-45-dabeol-deulgae': 'm-gruff',
  'g-61-heomcheuk-bawi': 'm-gruff', 'g-63-heomcheuk-beogeum': 'm-gruff',
  // 책사 · 무당 얼굴 — 차분한 소리
  'g-06-strategist': 'm-sage', 'g-73-baekje-eureum': 'm-sage', 'g-75-saro-hogong': 'm-sage', 'g-36-gammun-gamdol': 'm-sage',
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
 * 성우진 — 같은 결의 장수를 이름으로 반씩 갈라 절반은 B(voice-b.ts · public/realm/voice/b/)로 말한다.
 * 전엔 같은 결이면 전혀 다른 장수가 똑같은 대사를 쳤다 (형 10-29: "성우진 B · 중복된 것들의 절반과 교체"). 같은 장수는 늘 같은 성우
 */
export function castOf(h: Hero): 'a' | 'b' {
  let s = 7
  for (const c of h.id) s = (s * 131 + c.charCodeAt(0)) >>> 0
  return (s >>> 3) % 2 === 1 ? 'b' : 'a'
}
const dirOf = (h: Hero): string => (castOf(h) === 'b' ? 'realm/voice/b/' : 'realm/voice/')

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
  return `${dirOf(h)}${key}-${t}.ogg`
}

/** 장수 기술 외침 — 그 장수의 결로 */
export function artVoicePath(h: Hero, art: Art, ruler = false): string {
  return `${dirOf(h)}art-${voiceKind(h, ruler)}-${art}.ogg`
}

/** 싸움 맡김 — 맡아 들 때(go · 셋을 돌려 가며) · 맡긴 싸움이 끝나면 이김(win) · 짐(lose) */
export function autoVoicePath(h: Hero, want: 'go' | 'win' | 'lose', ruler = false): string {
  const k = voiceKind(h, ruler)
  if (want !== 'go') return `${dirOf(h)}auto-${k}-${want}.ogg`
  const key = `auto-${k}`
  const prev = lastTake.get(key) ?? 0
  let t = 1 + Math.floor(Math.random() * 3)
  if (t === prev) t = (t % 3) + 1
  lastTake.set(key, t)
  return `${dirOf(h)}${key}-${t}.ogg`
}

/** 등용 첫마디 — 그 장수가 녹음한 대사 · 대사가 없는 장수(판에서 난 아이 등)는 그 결의 짧은 대답으로 */
export function hireVoicePath(h: Hero, ruler = false): string {
  return HIRE_LINE[h.id] !== undefined ? `realm/voice/hire/${h.id}.ogg` : voicePath(h, 'tap', ruler)
}

/** 이번에 소리를 내도 되나 — 너무 잦으면 거른다 (now 는 화면 쪽 시계) */
export function voiceGate(now: number): boolean {
  if (now - lastAt < GAP_MS) return false
  lastAt = now
  return true
}
