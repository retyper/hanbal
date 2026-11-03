/**
 * 첫 스플래시 · 판에 들어갈 때 가림막의 가운데 한 줄 (형 11-03: "스플래시 좀 더 길게 · 화면 중앙에 게임 tip 이나 역사적 사실, 기록 한 줄씩 · 읽을 수 있을 정도로 시간 좀 주고").
 * 도움말은 시스템 말이라 존댓말, 옛 기록은 이야기라 평서 (메모리 system-text-honorific). 기록은 사서에 적힌 것만 · 출처를 끝에 붙인다.
 * 고르는 굴림은 화면 쪽 무작위다 — 판의 결정론(A1)과 상관없다.
 */
export interface LoadTip {
  readonly kind: 'tip' | 'lore'
  readonly text: string
}

const TIPS: readonly string[] = [
  '깃발을 꾹 누르고 있으면 이번 합에 잃을 군사와 사기가 보입니다.',
  '정찰을 보내면 적 군세의 폭이 좁아집니다.',
  '장수 얼굴을 누르면 그 장수가 대답합니다.',
  '세 번 내리 이긴 장수는 각성합니다.',
  '우리 장수는 싸움에서 죽지 않습니다. 다쳐 누울 뿐입니다.',
  '사로잡은 적장은 옥에서 회유할 수 있습니다.',
  '장마철에는 여울과 수렁 길이 막힙니다.',
  '겨울에는 높은 고개를 넘기 어렵습니다.',
  '판이 끝나도 단련은 남습니다. 진 판에서도 장수는 자랍니다.',
  '판을 이기면 유물 상자 셋 가운데 하나를 고릅니다.',
  '동맹과 속국의 땅은 싸우지 않고 지나갑니다.',
  '「맡긴다」를 누르면 장수가 지략대로 깃발을 고릅니다.',
]

const LORE: readonly string[] = [
  '온조는 처음 나라 이름을 십제라 하였다. 『삼국사기』',
  '고국천왕은 을파소의 말을 따라 봄에 곡식을 빌려 주고 가을에 거두게 하였다. 진대법이다. 『삼국사기』',
  '사로의 임금은 거서간, 차차웅, 이사금, 마립간을 거쳐 왕이라 불렸다. 『삼국사기』',
  '이사금은 떡을 깨문 잇자국에서 나온 이름이라 한다. 『삼국사기』',
  '탈해가 매로 변하자 수로는 독수리로 변해 겨루었다. 『삼국유사』',
  '변진에서 나는 철은 한과 예와 왜가 모두 사 갔다. 『삼국지』 동이전',
  '부여는 정월에 하늘에 제사하는 영고를 열었다. 『삼국지』 동이전',
  '고구려는 시월에 나라 사람이 모두 모이는 동맹을 열었다. 『삼국지』 동이전',
  '동예는 시월에 하늘에 제사하며 무천이라 불렀다. 『삼국지』 동이전',
  '마한의 소도에 달아난 이는 아무도 잡아가지 못하였다. 『삼국지』 동이전',
  '동예에서는 남의 마을 경계를 넘으면 소와 말로 물어 주었다. 책화다. 『삼국지』 동이전',
  '혁거세는 알에서 나와 열세 살에 임금이 되었다. 『삼국사기』',
  '부여 말로 활을 잘 쏘는 이를 주몽이라 하였다. 『삼국사기』',
  '허황옥은 아유타국에서 배를 타고 와 수로의 왕비가 되었다. 『삼국유사』',
  '고구려에서는 혼인하면 신랑이 신부 집 뒤 작은 집에 머물렀다. 서옥이다. 『삼국지』 동이전',
]

let last = ''
/** 한 줄 — 바로 앞 줄과 겹치지 않게 · 셋에 둘은 옛 기록 */
export function loadTip(): LoadTip {
  for (let i = 0; i < 6; i++) {
    const lore = Math.random() < 0.6
    const pool = lore ? LORE : TIPS
    const text = pool[Math.floor(Math.random() * pool.length)]!
    if (text === last) continue
    last = text
    return { kind: lore ? 'lore' : 'tip', text }
  }
  return { kind: 'tip', text: TIPS[0]! }
}

/** 읽을 시간 — 글자 수에 비례 (메모리 notices-must-dismiss 의 noticeMs 와 같은 결) */
export function tipReadMs(t: LoadTip, minMs: number, perChar: number, maxMs: number): number {
  return Math.min(maxMs, Math.max(minMs, 1200 + t.text.length * perChar))
}

/** 가운데 한 줄 HTML — 작은 머리말(도움말 · 옛 기록)과 본문 */
export function tipHtml(t: LoadTip, esc: (s: string) => string): string {
  // 출처(『삼국사기』 …)는 작게 따로 — 본문이 먼저 읽히게
  const m = t.kind === 'lore' ? /^(.*?)\s*(『[^』]+』.*)$/.exec(t.text) : null
  const body = m !== null ? `${esc(m[1]!)}<small class="tips">${esc(m[2]!)}</small>` : esc(t.text)
  return `<span class="tipk">${t.kind === 'lore' ? '옛 기록' : '도움말'}</span>${body}`
}
