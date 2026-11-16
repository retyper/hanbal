// 조사 붙이기 — 가벼운 곳(열전 raid.html 등)에서도 쓰도록 prose.ts 에서 떼어 냄 (prose.ts 는 다시 내보낸다)
/**
 * 숫자를 우리말로 읽을 때 끝소리의 받침 — 0 없음 · 8 ㄹ · 그 밖 받침 있음 (josa 가 쓴다).
 * 끝자리: 영(ㅇ) 일(ㄹ) 이 삼(ㅁ) 사 오 육(ㄱ) 칠(ㄹ) 팔(ㄹ) 구 · 끝이 0 이면 십(ㅂ) 백(ㄱ) 천(ㄴ) 만(ㄴ).
 * "철 2를" · "집 16이" · "곡식 300을" · "군사 1로" (형: "텍스트들 규칙에서 항상 한글 조사 틀리지 않게").
 */
function numberFinal(s: string): number {
  const d = s.replace(/[^0-9]/g, '')
  if (d === '' || /^0+$/.test(d)) return 21 // 영 — ㅇ
  const zeros = d.length - d.replace(/0+$/, '').length
  if (zeros > 0) return zeros === 1 ? 17 : zeros === 2 ? 1 : 4 // 십(ㅂ) · 백(ㄱ) · 천·만(ㄴ)
  return ({ '1': 8, '2': 0, '3': 16, '4': 0, '5': 0, '6': 1, '7': 8, '8': 8, '9': 0 } as Record<string, number>)[d[d.length - 1]!]!
}

/** 받침이 있으면 앞 것, 없으면 뒤 것 — 을/를 · 이/가 · 은/는 · 과/와 · 으로/로. 숫자로 끝나면 우리말 읽기로 판정한다 */
export function josa(word: string, withFinal: string, without: string): string {
  const c = word.charCodeAt(word.length - 1)
  let fin: number
  if (c >= 0x30 && c <= 0x39) fin = numberFinal(word)
  else if (c < 0xac00 || c > 0xd7a3) return word + without
  else fin = (c - 0xac00) % 28
  if (withFinal === '으로' && fin === 8) return word + without // ㄹ 받침은 "로"
  return word + (fin !== 0 ? withFinal : without)
}
