export {}
/**
 * 하늘 프로브 — **장마다 화면이 정말 달라지는가, 그러면서 실루엣은 살아 있는가.**
 *
 * docs/MEGAHIT.md §4-1이 약속한 두 가지를 숫자로 확인한다.
 *   ① 장이 바뀌면 하늘이 **실제로** 바뀐다 (색이 같으면 진행이 안 보인다)
 *   ② 그런데도 **몸이 하늘에서 떨어져 나온다** — GDD 8장 실루엣 계약.
 *      이게 이 기능의 유일한 위험이다. 하늘을 예쁘게 만들다 궁수를 배경에 묻으면 반려다.
 *
 * 대비는 WCAG 상대휘도비로 잰다. 큰 도형이라 3:1이면 읽히지만,
 * 이 게임의 궁수는 **선 몇 개**라 훨씬 높아야 한다 — 5:1을 하한으로 잡는다.
 *
 * 실행: node --experimental-strip-types tools/probe-sky.ts
 */

const { skyOf, SKY_COUNT } = await import('../src/render/sky.ts')
const { THEME } = await import('../src/render/camera.ts')

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

/** WCAG 상대휘도. */
function lum(hex: string): number {
  const [r, g, b] = rgb(hex)
  const f = (v: number): number => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

function ratio(a: string, b: string): number {
  const la = lum(a)
  const lb = lum(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** 두 색이 얼마나 다른가 (0~255 채널 거리의 최댓값). 장이 바뀐 게 눈에 보이려면 벌어져야 한다. */
function delta(a: string, b: string): number {
  const A = rgb(a)
  const B = rgb(b)
  let d = 0
  for (let i = 0; i < 3; i++) d = Math.max(d, Math.abs((A[i] as number) - (B[i] as number)))
  return d
}

const MIN_CONTRAST = 5
const MIN_DELTA = 10

let fails = 0
function check(ok: boolean, label: string, detail: string): void {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  ✗  '} ${label.padEnd(40)} ${detail}`)
}

console.log('하늘 프로브 — 장마다 다르고, 그래도 실루엣이 산다\n')
console.log(
  '  ' + '장'.padEnd(4) + '시각'.padEnd(12) + '하늘 위'.padStart(10) + '하늘 아래'.padStart(11) +
  '몸 대비'.padStart(10) + '화살 대비'.padStart(11) + '별'.padStart(6) + '그림자'.padStart(9),
)
console.log('  ' + '─'.repeat(76))

const seen: string[] = []
for (let ch = 1; ch <= SKY_COUNT; ch++) {
  const s = skyOf(`${ch}-1`)
  seen.push(s.sky1)
  // 몸은 하늘의 **밝은 쪽**(sky1)과 싸운다 — 궁수는 화면 아래쪽, 지평선 근처에 선다.
  const body = ratio(THEME.body, s.sky1)
  const arrow = ratio(THEME.arrow, s.sky1)
  const shadow = s.lightDir === 0 ? '발밑' : `${s.lightDir > 0 ? '←' : '→'}${s.shadowLen.toFixed(2)}`
  console.log(
    '  ' + `${ch}`.padEnd(4) + s.name.padEnd(12) + s.sky0.padStart(10) + s.sky1.padStart(11) +
    `${body.toFixed(1)}:1`.padStart(10) + `${arrow.toFixed(1)}:1`.padStart(11) +
    s.stars.toFixed(2).padStart(6) + shadow.padStart(9),
  )
  check(body >= MIN_CONTRAST, `${ch}장 — 몸이 하늘에서 떨어진다`, `${body.toFixed(2)}:1 (하한 ${MIN_CONTRAST}:1)`)
  check(arrow >= MIN_CONTRAST, `${ch}장 — 화살이 하늘에서 떨어진다`, `${arrow.toFixed(2)}:1`)
  // 지면은 하늘보다 어두워야 '땅'이다. 밝으면 물처럼 보인다.
  check(lum(s.ground) < lum(s.sky1), `${ch}장 — 땅이 하늘보다 어둡다`, `${s.ground} vs ${s.sky1}`)
  // 능선 3겹은 서로 구분돼야 겹으로 읽힌다.
  check(
    lum(s.ridgeFaint) > lum(s.ridgeFar) && lum(s.ridgeFar) > lum(s.ridgeNear),
    `${ch}장 — 능선 3겹이 멀수록 밝다`,
    `${s.ridgeFaint} > ${s.ridgeFar} > ${s.ridgeNear}`,
  )
}

console.log('')
// ① 장이 실제로 바뀌는가 — 이웃한 장끼리 하늘이 충분히 다른가
for (let i = 1; i < seen.length; i++) {
  const d = delta(seen[i - 1] as string, seen[i] as string)
  check(d >= MIN_DELTA, `${i}장 → ${i + 1}장 하늘이 바뀐다`, `채널 차 ${d} (하한 ${MIN_DELTA})`)
}
// 전부 다른 색인가 (되풀이 전까지)
const uniq = new Set(seen)
check(uniq.size === seen.length, '다섯 시각이 전부 다른 하늘이다', `${uniq.size}/${seen.length}`)

// ② 무한 구간은 되풀이한다 — 새 팔레트를 무한히 만들 수는 없다
check(skyOf('6-1').name === skyOf('1-1').name, '6장은 1장의 하늘로 되풀이한다', skyOf('6-1').name)
check(skyOf('7-3').name === skyOf('2-3').name, '7장은 2장의 하늘로 되풀이한다', skyOf('7-3').name)
// 규칙 밖 id도 죽지 않는다
check(skyOf('sandbox').name === skyOf('1-1').name, '규칙 밖 id는 1장으로 떨어진다', skyOf('sandbox').name)

console.log('')
if (fails > 0) {
  console.log(`실패 ${fails}건`)
  process.exit(1)
}
console.log('전부 통과')
console.log('※ 이 프로브는 "다르고 읽히는가"만 답한다. 예쁜지는 형이 눈으로 판정한다.')
