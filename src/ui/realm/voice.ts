/**
 * 장수 목소리 (형 10-26: "이런 게임에서는 성우 목소리들도 정말 중요 · 장수들에 각각 목소리를 입히고 싶어 · 시작은 「네, 부르셨습니까」 남자 여자 버전으로")
 *
 * 장수를 유닛처럼 움직이지는 않지만 왕이 장수를 부르고 명을 내리는 때는 판 곳곳에 있다 — 그때 한마디씩 (RTS 의 대답처럼).
 *   call — 우리 장수의 얼굴을 눌러 장수 판을 열 때 「네, 부르셨습니까」
 * 목소리 갈래는 장수의 생김(look)으로 — 지금은 남·여 둘. 갈래를 늘리면 같은 장수는 늘 같은 갈래가 나오게 id 로 고른다.
 * 그림처럼 받아 둔 것만 READY 에 올린다 — 없는 파일을 부르지 않는다.
 */
import type { Hero } from '../../realm/types.ts'

export type VoiceLine = 'call'
type Kind = 'm' | 'w'

/** 받아 둔 목소리 — public/realm/voice/<줄>-<갈래>.ogg */
// 구글 AI 스튜디오 Gemini TTS — 남 Arlo · 여 Kira 에 사극 말투 지시 (후보는 voice/cand · 고르기 판 realm/voice-picker.html · 형 10-26 남 3 · 여 2 가 기본)
const READY: ReadonlySet<string> = new Set<string>(['call-m', 'call-w'])

/** 같은 소리가 겹쳐 나오지 않게 — 이만큼(ms) 안에 또 누르면 조용히 */
const GAP_MS = 900
let lastAt = -Infinity

export const voiceKind = (h: Hero): Kind => (h.look === 'w' ? 'w' : 'm')

/** 그 장수의 그 줄 — 받아 둔 게 없으면 null */
export function voicePath(h: Hero, line: VoiceLine): string | null {
  const k = `${line}-${voiceKind(h)}`
  return READY.has(k) ? `realm/voice/${k}.ogg` : null
}

/** 이번에 소리를 내도 되나 — 너무 잦으면 거른다 (now 는 화면 쪽 시계) */
export function voiceGate(now: number): boolean {
  if (now - lastAt < GAP_MS) return false
  lastAt = now
  return true
}
