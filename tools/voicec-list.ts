/**
 * 성우진 C 녹음 묶음 — 결 하나에 스무 줄(짧은 대답 셋 · 분부 셋 · 싸움 맡김 다섯 · 기술 외침 아홉) (src/ui/realm/voice-c.ts)
 *   node --experimental-strip-types tools/voicec-list.ts              → 결마다 다 있나 · 없는 것
 *   node --experimental-strip-types tools/voicec-list.ts --batch m-young → 넣을 글 · sha256 · 이름 · 글자 수 (split-voice.py 인자) · 목소리 이름
 * 자른 것은 public/realm/voice/c/<이름>.ogg
 */
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { ART_C, LINES_C, VOICE_C } from '../src/ui/realm/voice-c.ts'
import type { VoiceKind } from '../src/ui/realm/voice.ts'

const DIR = new URL('../public/realm/voice/c/', import.meta.url)
const KINDS = Object.keys(LINES_C) as VoiceKind[]
const ARTS = Object.keys(ART_C) as Array<keyof typeof ART_C>

function batch(k: VoiceKind): { lines: string[]; names: string[] } {
  const L = LINES_C[k]
  const lines = [...L.tap, ...L.obey, ...L.auto, ...ARTS.map((a) => ART_C[a])]
  const names = [
    ...L.tap.map((_, i) => `tap-${k}-${i + 1}`), ...L.obey.map((_, i) => `obey-${k}-${i + 1}`),
    ...['1', '2', '3', 'win', 'lose'].map((x) => `auto-${k}-${x}`), ...ARTS.map((a) => `art-${k}-${a}`),
  ]
  return { lines, names }
}

const arg = process.argv
if (arg.includes('--batch')) {
  const k = arg[arg.indexOf('--batch') + 1] as VoiceKind
  if (LINES_C[k] === undefined) throw new Error('--batch <결>')
  const { lines, names } = batch(k)
  const body = lines.join('\n\n')
  console.log(JSON.stringify({
    voice: VOICE_C[k], body,
    sha256: createHash('sha256').update(body, 'utf8').digest('hex'),
    names: names.join(','),
    weights: lines.map((t) => t.replace(/[\s.,!?…·'"]/g, '').length).join(','),
  }))
} else {
  for (const k of KINDS) {
    const miss = batch(k).names.filter((n) => !existsSync(new URL(`${n}.ogg`, DIR)))
    console.log(`${k} (${VOICE_C[k]}) ${miss.length === 0 ? '다 있음' : `없음 ${miss.length}`}`)
  }
}
