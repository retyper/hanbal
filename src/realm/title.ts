/**
 * 판 끝 칭호 — 이긴 길마다 옛 임금 하나 (회의 결정 META §7-1 · 형 10-24: 큰 제사는 「해모수」).
 * 숫자 점수는 없다. 칭호의 색은 난세 단계의 색 — 화면이 정한다.
 */
import type { Realm } from './types.ts'

export interface Title {
  /** 칭호 — 도장에 찍히는 두세 글자 */
  readonly name: string
  /** 한 줄 — 왜 이 칭호인가 */
  readonly line: string
}

const BY_PATH: Readonly<Record<'conquest' | 'suzerain' | 'ironsea' | 'rite', Title>> = {
  conquest: { name: '동명', line: '활 하나로 나라를 세운 임금처럼, 칼로 판을 쥐었다' },
  suzerain: { name: '혁거세', line: '여섯 마을이 받들어 세운 임금처럼, 맹주로 추대되었다' },
  ironsea: { name: '수로', line: '쇠와 바닷길로 선 임금처럼: 쇠의 바다를 쥐었다' },
  rite: { name: '해모수', line: '하늘에서 내려온 임금처럼: 큰 제사로 하늘의 뜻을 얻었다' },
}
const LOST: Title = { name: '비류', line: '미추홀에서 꿈을 접은 형처럼, 여기까지였다' }

/** 끝난 판의 칭호 — 아직 안 끝났으면 null. 길이 적히지 않은 옛 판의 이김은 「동명」 */
export function titleOf(r: Realm): Title | null {
  const o = r.outcome
  if (o == null) return null
  if (o.kind === 'lose') return LOST
  return BY_PATH[o.path ?? 'conquest']
}
