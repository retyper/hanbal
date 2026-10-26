/**
 * 장수 목소리 (형 10-26: "장수들에 각각 목소리를 입히고 싶어 · 그 장수를 탭하면 「네?」 혹은 「부르셨습니까?」 이런 식으로 곧바로 들리길 ·
 * 대사랑 목소리는 캐릭터 개성마다 · 음원 몇 개를 만들고 일단 돌려 써야겠지 · 남자 여자 섹시한 장수 목소리도")
 *
 * 목소리 결 아홉 — 장수마다 하나 (생김 · 특성 · 능력치로 고른다 · VOICE_OF 로 손으로 박을 수 있다).
 *   남: 젊은 무사 young · 거친 노장 gruff · 꾀 많은 책사 sage · 늙은 장수·군주 elder · 매혹 charm
 *   여: 당찬 젊은 무사 bright · 의젓한 장수 cool · 요염한 꾀 sly · 무녀 shaman
 * 결마다 짧은 대답 셋(tap-<결>-1..3) — 탭할 때마다 돌려 가며 하나 (같은 것이 연달아 안 나오게).
 * 결마다 장수 기술 외침 아홉(art-<결>-<기술>) — 싸움에서 그 기술을 쓰면 컷과 함께 (형 10-26: "특수기술 대사들도 · 가성 말고 힘줘서 · 애니나 게임 성우").
 * 구글 AI 스튜디오 Gemini TTS 무료 목소리에 사극 말투 지시로 뽑았다 (Enzo · Daro · Cruz · Arlo · Neno · Cleo · Kira · Lumi · Hali) —
 * 한 번에 세 줄을 뽑아 tools/split-voice.py 로 잘랐다. 들어 보는 판 realm/voice-picker.html.
 */
import { hasTrait } from '../../realm/heroes.ts'
import type { Art, Hero } from '../../realm/types.ts'

export type VoiceKind = 'm-young' | 'm-gruff' | 'm-sage' | 'm-elder' | 'm-charm' | 'w-bright' | 'w-cool' | 'w-sly' | 'w-shaman'
export type VoiceLine = 'tap'

/** 결마다 받아 둔 대답 수 — public/realm/voice/<줄>-<결>-<n>.ogg */
const TAKES: Readonly<Record<VoiceLine, number>> = { tap: 3 }

/** 손으로 박은 목소리 — 그림과 이야기가 뚜렷한 장수 (없으면 voiceKind 가 고른다) */
const VOICE_OF: Readonly<Record<string, VoiceKind>> = {}

/** 같은 소리가 겹쳐 나오지 않게 — 이만큼(ms) 안에 또 누르면 조용히 */
const GAP_MS = 450
let lastAt = -Infinity
const lastTake = new Map<string, number>()

/** 장수의 목소리 결 — 생김 · 특성 · 능력치. 같은 장수는 늘 같은 결 */
export function voiceKind(h: Hero, ruler = false): VoiceKind {
  const fixed = VOICE_OF[h.id]
  if (fixed !== undefined) return fixed
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

/** 그 장수의 그 줄 — 탭할 때마다 돌려 가며 하나 (화면 쪽 무작위 — 판의 결정론과 무관) */
export function voicePath(h: Hero, line: VoiceLine, ruler = false): string {
  const k = voiceKind(h, ruler)
  const n = TAKES[line]
  const key = `${line}-${k}`
  const prev = lastTake.get(key) ?? 0
  let t = 1 + Math.floor(Math.random() * n)
  if (n > 1 && t === prev) t = (t % n) + 1
  lastTake.set(key, t)
  return `realm/voice/${key}-${t}.ogg`
}

/** 장수 기술 외침 — 그 장수의 결로 */
export function artVoicePath(h: Hero, art: Art, ruler = false): string {
  return `realm/voice/art-${voiceKind(h, ruler)}-${art}.ogg`
}

/** 이번에 소리를 내도 되나 — 너무 잦으면 거른다 (now 는 화면 쪽 시계) */
export function voiceGate(now: number): boolean {
  if (now - lastAt < GAP_MS) return false
  lastAt = now
  return true
}
