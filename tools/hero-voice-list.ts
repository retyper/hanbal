/**
 * 장수 전용 성우 녹음 묶음 (src/ui/realm/voice-hero.ts) — AI 스튜디오에 넣을 글과 자를 이름·글자 수를 낸다.
 *   npx tsx tools/hero-voice-list.ts <장수 id> [calm|shout] [--json]
 * calm: 대답 셋 · 분부 셋 · 이김 · 짐 · 등용(있으면) — 차분한 묶음
 * shout: 싸움 맡김 셋 · 기술 외침 — 함성 지시를 더한 묶음 (메모리: 외침은 차분한 줄과 섞지 않는다)
 * 자르기: py -I tools/split-voice.py <ffmpeg> <wav> public/realm/voice/hero/<id> <이름들> <글자 수들>
 */
import { HERO_VOICE, BASE_STYLE, SHOUT_STYLE, FEM_LEAD, FEM_STYLE } from '../src/ui/realm/voice-hero.ts'
import { HIRE_LINE } from '../src/realm/data/hire-lines.ts'

const GAP = '빈 줄로 나뉜 대사는 따로따로 읽고 대사 사이에는 1초 쉰다.'

export function batch(id: string, kind: 'calm' | 'shout'): { voice: string; style: string; text: string; names: string[]; lens: number[] } {
  const v = HERO_VOICE[id]
  if (v === undefined) throw new Error(`HERO_VOICE 에 없는 장수: ${id}`)
  const rows: Array<[string, string]> = kind === 'calm'
    ? [['tap-1', v.tap[0]], ['tap-2', v.tap[1]], ['tap-3', v.tap[2]], ['obey-1', v.obey[0]], ['obey-2', v.obey[1]], ['obey-3', v.obey[2]], ['auto-win', v.auto[3]], ['auto-lose', v.auto[4]],
      ...(HIRE_LINE[id] !== undefined ? [['hire', HIRE_LINE[id]!] as [string, string]] : [])]
    : [['auto-1', v.auto[0]], ['auto-2', v.auto[1]], ['auto-3', v.auto[2]], ['art', v.art[1]]]
  const who = v.male === true ? v.style : `${FEM_LEAD} ${v.style} ${FEM_STYLE}`
  const style = kind === 'calm' ? `${BASE_STYLE} ${who} ${GAP}` : `${BASE_STYLE} ${who} ${SHOUT_STYLE} ${GAP}`
  return { voice: v.voice, style, text: rows.map((r) => r[1]).join('\n\n'), names: rows.map((r) => r[0]), lens: rows.map((r) => r[1].replace(/<[^>]+>/g, '').replace(/\s/g, '').length + (/<laugh>/.test(r[1]) ? 3 : 0)) } // 웃음 태그는 글자 셋쯤의 길이
}

const [id, kind = 'calm', flag] = process.argv.slice(2)
if (id !== undefined) {
  const b = batch(id, kind === 'shout' ? 'shout' : 'calm')
  if (flag === '--json') console.log(JSON.stringify(b))
  else console.log(`목소리 ${b.voice}\n말투 ${b.style}\n---\n${b.text}\n---\n${b.names.join(',')} ${b.lens.join(',')}`)
}
