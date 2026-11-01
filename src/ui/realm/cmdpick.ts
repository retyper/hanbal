/**
 * 명령 탭 일 창에서 아래 칸(갈 곳 · 원정 땅)을 펼쳐 보일 장수.
 * 고른 장수가 아직 쉬면 그 장수 · 방금 이 창에서 일을 준 장수(keep)도 그대로 — 그 장수의 「이번 달: … · 취소」가 남는다.
 * 아니면 그 일에 가장 맞는 쉬는 장수(free 맨 앞).
 * (형 11-02: "을음 원정 보낸 것 같은데 소서노가 뜬금없이 원정 보내짐" — 보내자마자 다음 장수로 넘어가
 *  같은 자리에 「보낸다」가 또 떠서, 한 번 더 누르면 엉뚱한 이가 떠났다)
 */
export function cmdPickId(free: readonly string[], cmdHero: string, keep: boolean): string {
  if (cmdHero !== '' && (keep || free.includes(cmdHero))) return cmdHero
  return free[0] ?? ''
}
