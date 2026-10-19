/**
 * 지도 글씨 자리 잡기 (형: "여전히 텍스트가 확대 했을때 장수밑 군사숫자와 겹친다던가 하는 문제가있음") —
 *
 * mapview.placeLabels 는 그리기 전에 글씨 크기를 어림해 자리를 잡는다. 확대하면 글씨·말에 위 끝(clamp)이 걸려
 * 어림과 실제가 어긋나고, 이름이 고을에서 멀어지거나 말·숫자와 겹친다. 그래서 그린 뒤 **실제 자리를 재서** 다시 둔다:
 * 이름마다 제 고을 그림의 실제 테두리에 붙여 아래 → 더 아래 → 오른쪽 → 왼쪽 → 위 차례로 대 보고 처음 비는 곳에 둔다.
 * 장애물 = 우리 군대 말(얼굴·숫자) · 고을 그림 · 깃발 · 군세 칩 · 갈 곳 칩, 그리고 먼저 자리 잡은 이름 (도읍이 먼저).
 * 지도를 다시 그렸을 때와 배율이 바뀌었을 때 한 번씩 (rAF 하나 — 보이는 탭에서만 돈다).
 */

interface Box { l: number; t: number; r: number; b: number }

const box = (e: Element): Box => {
  const r = e.getBoundingClientRect()
  return { l: r.left, t: r.top, r: r.right, b: r.bottom }
}
const hit = (a: Box, b: Box, pad: number): boolean => a.l < b.r + pad && a.r + pad > b.l && a.t < b.b + pad && a.b + pad > b.t

/** 걸리면 안 되는 것들 — 이름 말고 지도 위의 기호 */
const OBST = '.tok img, .tok b, .nd img.st, .nd .thr, .nd .men, .nd .tchip'

export function declutter(map: HTMLElement): void {
  const labels = [...map.querySelectorAll<HTMLElement>('.lbs .lb')]
  if (labels.length === 0) return
  const mr = map.getBoundingClientRect()
  if (mr.width <= 0) return
  const obst = [...map.querySelectorAll(OBST)].map(box).filter((b) => b.r > b.l && b.b > b.t)
  const placed: Box[] = []
  // 먼저 자리를 잡는 차례 — 도읍(별) · 우리 고을 · 여느 고을 · 주인 없는 땅 (지도 글씨의 위계 — GAP M1)
  const rank = (l: HTMLElement): number => (l.querySelector('.star') !== null ? 0 : l.classList.contains('me') ? 1 : l.classList.contains('k-free') ? 3 : 2)
  labels.sort((a, b) => rank(a) - rank(b))
  for (const l of labels) {
    const icon = map.querySelector(`.nd[data-node="${l.dataset['n'] ?? ''}"] img.st`)
    const b0 = box(l)
    const w = b0.r - b0.l
    const h = b0.b - b0.t
    if (icon === null || w <= 0 || h <= 0) continue
    const ic = box(icon)
    const cx = (ic.l + ic.r) / 2
    // 후보 — 이름 상자의 왼쪽 위 (화면 좌표)
    const tries: Array<[number, number]> = [
      [cx - w / 2, ic.b + 1], // 아래
      [cx - w / 2, ic.b + h * 0.9], // 더 아래 (말 숫자 밑)
      [ic.r + 3, (ic.t + ic.b) / 2 - h / 2], // 오른쪽
      [ic.l - w - 3, (ic.t + ic.b) / 2 - h / 2], // 왼쪽
      [cx - w / 2, ic.t - h - 2], // 위
      [ic.r + 3, ic.b - h * 0.2], // 오른쪽 아래
      [ic.l - w - 3, ic.b - h * 0.2], // 왼쪽 아래
      // 한 바퀴 더 멀리 — 빽빽한 판에서 도읍·우리 고을처럼 숨기지 않는 이름이 비켜 설 자리
      [cx - w / 2, ic.b + h * 1.9], [cx - w / 2, ic.t - h * 2.1], [ic.r + 3, ic.t - h], [ic.l - w - 3, ic.t - h],
      [ic.r + 3, ic.b + h * 0.6], [ic.l - w - 3, ic.b + h * 0.6], [cx + w * 0.4, ic.b + h * 1.2], [cx - w * 1.4, ic.b + h * 1.2],
    ]
    let pick = tries[0]!
    let found = false
    for (const [x, y] of tries) {
      const b = { l: x, t: y, r: x + w, b: y + h }
      if (obst.some((o) => hit(b, o, 0)) || placed.some((o) => hit(b, o, 2))) continue
      pick = [x, y]
      found = true
      break
    }
    // 빈 데가 없으면 덜 중요한 이름은 숨긴다 — 가까이 보면 다시 뜬다 (CK3·지도 그리기의 글씨 위계). 도읍·우리 고을은 늘 남는다
    const crowd = !found && rank(l) >= 2
    l.classList.toggle('crowd', crowd)
    if (crowd) continue
    // .lb 는 translateX(-50%) 로 가운데를 맞춘다 — left 는 상자 가운데
    l.style.left = `${(((pick[0] + w / 2) - mr.left) / mr.width * 100).toFixed(3)}%`
    l.style.top = `${((pick[1] - mr.top) / mr.height * 100).toFixed(3)}%`
    placed.push({ l: pick[0], t: pick[1], r: pick[0] + w, b: pick[1] + h })
  }
}

/** 한 프레임 뒤에 한 번 — 그 사이 여러 번 불러도 한 번만 돈다 */
export function declutterSoon(wrap: HTMLElement): void {
  const w = wrap as HTMLElement & { _dc?: number | undefined }
  if (w._dc !== undefined) return
  w._dc = requestAnimationFrame(() => {
    w._dc = undefined
    const m = wrap.querySelector<HTMLElement>('.map')
    if (m !== null) declutter(m)
  })
}
