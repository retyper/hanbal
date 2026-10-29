/**
 * 외침 다시 녹음 묶음 — 결 하나에 열세 줄(싸움 맡김 첫마디 셋 · 이김 · 기술 외침 아홉) (형 10-29: "외치는 목소리들이 확실하게 흥분되고 격앙되게 ·
 * 지금은 뭔가 방안에서 아마추어가 독백하는 느낌"). 짐(lose)·짧은 대답·분부는 차분해도 되어 그대로 둔다.
 * 외침만 따로 한 묶음으로 뽑는다 — 차분한 줄과 섞으면 한 묶음 안에서 기세가 평평해진다 (말투 칸은 아래 STYLE).
 *   node --experimental-strip-types tools/shout-list.ts --batch m-young a   → 넣을 글 · sha256 · 이름 · 글자 수 (split-voice.py 인자) · 목소리 · 말투
 *   node --experimental-strip-types tools/shout-list.ts --kinds a           → 그 성우진에서 외침을 뽑을 결
 * 자른 것은 성우진 칸(public/realm/voice/ · b/ · c/)에 옛 것과 같은 이름으로.
 */
import { createHash } from 'node:crypto'
import { AUTO_LINE, type BaseKind, type VoiceKind } from '../src/ui/realm/voice.ts'
import { ART_B, LINES_B, VOICE_B } from '../src/ui/realm/voice-b.ts'
import { ART_C, LINES_C, VOICE_C } from '../src/ui/realm/voice-c.ts'
import { ART_A, VOICE_NEW } from '../src/ui/realm/voice-new.ts'

type Cast = 'a' | 'b' | 'c'
const VOICE_A: Readonly<Record<VoiceKind, string>> = {
  'm-young': 'Enzo', 'm-gruff': 'Daro', 'm-sage': 'Cruz', 'm-elder': 'Arlo', 'm-charm': 'Neno',
  'w-bright': 'Cleo', 'w-cool': 'Kira', 'w-sly': 'Lumi', 'w-shaman': 'Hali', ...VOICE_NEW,
}
const ARTS = Object.keys(ART_A) as Array<keyof typeof ART_A>

/** 외침 말투 칸 — 남녀만 바꾼다 */
export const style = (female: boolean): string =>
  `Performed by a professional Korean anime and video game voice ${female ? 'actress' : 'actor'}. SHOUTED battle cry on a roaring battlefield, commanding hundreds of soldiers over the noise. Highly excited, furious, adrenaline-charged, at the top of the lungs but full chest voice, never falsetto or head voice, powerful from the diaphragm. NOT a calm indoor monologue, NOT reading aloud. Korean historical drama (사극) diction. One-second silence between lines.`

function source(k: VoiceKind, c: Cast): { voice: string; auto: readonly string[]; art: Readonly<Record<string, string>> } {
  if (c === 'a') return { voice: VOICE_A[k], auto: AUTO_LINE[k], art: ART_A }
  if (c === 'b') return { voice: VOICE_B[k as BaseKind], auto: LINES_B[k as BaseKind].auto, art: ART_B }
  return { voice: VOICE_C[k as BaseKind], auto: LINES_C[k as BaseKind].auto, art: ART_C }
}

export function batch(k: VoiceKind, c: Cast): { voice: string; lines: string[]; names: string[] } {
  const s = source(k, c)
  if (s.voice === undefined || s.auto === undefined) throw new Error(`성우진 ${c} 에 ${k} 가 없다`)
  const lines = [s.auto[0]!, s.auto[1]!, s.auto[2]!, s.auto[3]!, ...ARTS.map((a) => s.art[a]!)]
  const names = [...['1', '2', '3', 'win'].map((x) => `auto-${k}-${x}`), ...ARTS.map((a) => `art-${k}-${a}`)]
  return { voice: s.voice, lines, names }
}

const arg = process.argv
if (arg.includes('--batch')) {
  const i = arg.indexOf('--batch')
  const k = arg[i + 1] as VoiceKind
  const c = (arg[i + 2] ?? 'a') as Cast
  const { voice, lines, names } = batch(k, c)
  const body = lines.join('\n\n')
  console.log(JSON.stringify({
    voice, style: style(k.startsWith('w-')), body,
    sha256: createHash('sha256').update(body, 'utf8').digest('hex'),
    dir: c === 'a' ? 'public/realm/voice' : `public/realm/voice/${c}`,
    names: names.join(','),
    weights: lines.map((t) => t.replace(/[\s.,!?…·'"]/g, '').length).join(','),
  }))
} else {
  const c = (arg[arg.indexOf('--kinds') + 1] ?? 'a') as Cast
  console.log(Object.keys(c === 'a' ? VOICE_A : c === 'b' ? VOICE_B : VOICE_C).join(' '))
}
