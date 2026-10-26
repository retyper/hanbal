/**
 * 군장 말 목소리 목록 — 남의 나라 군장이 알현·맺음 화면에서 하는 말 (src/ui/realm/chief-lines.ts · 결 아홉 × 상황 열둘 × 적극·소극)
 *   npx tsx tools/chief-voice-list.ts                → 결·말씨마다 소리 파일이 몇 개 있나 · 없는 것
 *   npx tsx tools/chief-voice-list.ts --batch m-young a → 녹음 묶음 한 번(12줄): 넣을 글 · sha256 · 이름 · 글자 수 (split-voice.py 인자)
 *   … --batch m-young a --auto → 그 뒤에 싸움 맡김 다섯 줄(voice.ts AUTO_LINE · auto-<결>-1..3 · win · lose)을 붙여 한 번에
 *   … --batch m-young a --auto-only → 싸움 맡김 다섯 줄만
 *   npx tsx tools/chief-voice-list.ts --write        → public/realm/voice/chief/lines.json (들어 보는 판 realm/voice-picker.html 이 읽는다)
 * 한 줄을 고치면: chief-lines.ts 를 고치고 → 같은 결·같은 말씨로 다시 뽑아 split-voice.py 로 public/realm/voice/chief/<결>-<상황>-<a|p>.ogg → --write.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { CHIEF_LINE, CHIEF_SITS, CHIEF_SIT_NAME, type ChiefMood } from '../src/ui/realm/chief-lines.ts'
import { AUTO_LINE, type VoiceKind } from '../src/ui/realm/voice.ts'

const DIR = new URL('../public/realm/voice/chief/', import.meta.url)
const KINDS = Object.keys(CHIEF_LINE) as VoiceKind[]
const MOODS: readonly ChiefMood[] = ['a', 'p']
const file = (k: VoiceKind, s: string, m: ChiefMood): string => `${k}-${s}-${m}`
const text = (k: VoiceKind, s: (typeof CHIEF_SITS)[number], m: ChiefMood): string => CHIEF_LINE[k][s][m === 'a' ? 0 : 1]

const arg = process.argv
if (arg.includes('--batch')) {
  const i = arg.indexOf('--batch')
  const k = arg[i + 1] as VoiceKind
  const m = arg[i + 2] as ChiefMood
  if (CHIEF_LINE[k] === undefined || !MOODS.includes(m)) throw new Error('--batch <결> <a|p>')
  const auto = arg.includes('--auto')
  const only = arg.includes('--auto-only')
  const sits = only ? [] : CHIEF_SITS
  const lines = [...sits.map((s) => text(k, s, m)), ...(auto || only ? AUTO_LINE[k] : [])]
  const body = lines.join('\n\n')
  console.log(JSON.stringify({
    body,
    sha256: createHash('sha256').update(body, 'utf8').digest('hex'),
    names: [...sits.map((s) => file(k, s, m)), ...(auto || only ? ['1', '2', '3', 'win', 'lose'].map((x) => `auto-${k}-${x}`) : [])].join(','),
    // 글자 수 — 빈칸·문장부호 뺀 소리 나는 글자
    weights: lines.map((t) => t.replace(/[\s.,!?…·'"]/g, '').length).join(','),
  }))
} else if (arg.includes('--write')) {
  mkdirSync(DIR, { recursive: true })
  const rows = KINDS.flatMap((k) => CHIEF_SITS.flatMap((s) => MOODS.map((m) => ({ kind: k, sit: s, sitName: CHIEF_SIT_NAME[s], mood: m, file: file(k, s, m), text: text(k, s, m), has: existsSync(new URL(`${file(k, s, m)}.ogg`, DIR)) }))))
  writeFileSync(new URL('lines.json', DIR), JSON.stringify(rows) + '\n')
  console.log(`lines.json ${rows.length}줄 · 소리 ${rows.filter((r) => r.has).length}`)
} else {
  let all = 0
  for (const k of KINDS) for (const m of MOODS) {
    const miss = CHIEF_SITS.filter((s) => !existsSync(new URL(`${file(k, s, m)}.ogg`, DIR)))
    all += CHIEF_SITS.length - miss.length
    console.log(`${k} ${m} ${CHIEF_SITS.length - miss.length}/${CHIEF_SITS.length}${miss.length > 0 && miss.length < CHIEF_SITS.length ? ` 없음: ${miss.join(' ')}` : ''}`)
  }
  console.log(`모두 ${all}/${KINDS.length * CHIEF_SITS.length * MOODS.length}`)
}
