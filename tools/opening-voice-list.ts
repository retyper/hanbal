/**
 * 오프닝 내레이션 녹음 묶음 — AI 스튜디오에 넣을 글·목소리·말투와 자를 이름·글자 수를 낸다 (docs/realm/OPENING.md 「녹음 대본」).
 *   node --experimental-strip-types tools/opening-voice-list.ts [--json]
 * 여덟 줄을 한 번에 (빈 줄로 나눠 1초 쉼) 받아 자른다.
 * 자르기: py -I tools/split-voice.py <ffmpeg> <wav> public/realm/voice/opening 01,02,…,08 <글자 수들>  → 01.ogg … 08.ogg
 * 글은 화면 자막(src/i18n/ko.ts opening.1~8)과 한 글자도 다르면 안 되므로 거기서 그대로 읽는다.
 */
import { ko } from '../src/i18n/ko.ts'

/** 목소리 — 장수 성우와 겹치지 않는 낮은 남자 (Gacrux · 안 되면 Fenrir) */
export const VOICE = 'Gacrux'
export const STYLE = '한국 사극 다큐멘터리의 남자 내레이터. 낮고 굵으며 울림이 있는 중후한 중년 남성의 목소리로, 비장하고 장엄하게 읽는다. 평소 말보다 확연히 느리게, 한 줄을 한 호흡으로 묵직하게 눌러 읽고 문장 끝은 낮게 가라앉힌다. 소리 지르거나 연기하듯 꾸미지 않고, 억눌린 결의와 엄숙함이 배어 있다. 마지막 줄은 한 단계 더 힘을 실어 다짐하듯 읽는다. 대사와 대사 사이에는 1초 쉰다.'

export function batch(): { voice: string; style: string; text: string; names: string[]; lens: number[] } {
  const rows = Array.from({ length: 8 }, (_, i) => [String(i + 1).padStart(2, '0'), ko[`opening.${i + 1}` as keyof typeof ko]] as const)
  return { voice: VOICE, style: STYLE, text: rows.map((r) => r[1]).join('\n\n'), names: rows.map((r) => r[0]), lens: rows.map((r) => r[1].replace(/\s/g, '').length) }
}

if (/opening-voice-list.ts$/.test(process.argv[1] ?? '')) {
  const b = batch()
  if (process.argv.includes('--json')) console.log(JSON.stringify(b))
  else console.log(`목소리 ${b.voice}\n말투 ${b.style}\n---\n${b.text}\n---\n${b.names.join(',')} ${b.lens.join(',')}`)
}
