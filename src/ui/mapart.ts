/**
 * 지도의 **바탕** — 종이 · 산줄기 · 강 · 바다 · 나침반 · 표제 (2026-09-10)
 *
 * 형: **"지도가 지금 너무 멋이 없으니까 더 그럴듯하게 만들어봐. 지도답게좀."**
 *
 * 맞는 말이다. 그전 지도는 어두운 판 위에 동그라미 50개와 선 하나였다 — **길은 있는데
 * 땅이 없었다.** 길만 있는 것은 노선도지 지도가 아니다. 지도가 지도로 보이는 건 길이 아니라
 * 그 둘레의 것들 때문이다: 종이의 결, 산줄기, 물길, 바다, 방위, 그리고 표제.
 *
 * ── 규칙 ───────────────────────────────────────────────────────────
 * 1. **에셋을 안 쓴다.** 전부 SVG 도형이다. 그림 파일을 붙이면 배율마다 흐려지고,
 *    이 지도는 폰에서 0.6배까지 줄어든다 (ui/map.ts fitBoard).
 * 2. **같은 자리에 같은 산이 선다.** 난수는 판 번호에서 나온 해시뿐이다 (core/rng 와 같은 정신).
 *    열 때마다 산이 옮겨 다니면 그건 지도가 아니라 화면보호기다.
 * 3. **길을 가리지 않는다.** 산·나무·물길은 줄 사이의 빈 띠에만 선다. 지도의 주인공은 길이다.
 * 4. 색은 종이의 것이다 — 이 게임의 어두운 팔레트(render/camera.ts)를 여기서는 안 쓴다.
 *    손에 든 낡은 종이 한 장이어야 어두운 화면 위에서 **물건**으로 보인다.
 */

/** 고지도의 색. 먹과 종이, 그리고 붉은 인주. */
export const INK = {
  paper0: '#e8dcbe',
  paper1: '#d9c8a2',
  paperEdge: '#b9a377',
  ink: '#4a3a26',
  inkSoft: '#8b7654',

  road: '#8a6b3f',
  roadAhead: '#b6a380',
  water: '#6f8ca1',
  waterSoft: '#93aabb',
  seal: '#b8332a',
  gold: '#c08a2b',
  green: '#5f7248',
} as const

const SVG_NS = 'http://www.w3.org/2000/svg'

/** 판 번호 하나에서 0..1 을 뽑는다. 같은 번호는 언제나 같은 값 — 산이 안 돌아다닌다. */
export function hash01(n: number): number {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

function el(tag: string, attrs: Record<string, string>): SVGElement {
  const e = document.createElementNS(SVG_NS, tag)
  for (const k in attrs) e.setAttribute(k, attrs[k] as string)
  return e
}

/**
 * 종이 — 바탕색·얼룩·접힌 자국·닳은 가장자리.
 * 얼룩이 없으면 색종이고, 접힌 자국이 없으면 화면이다. 낡음은 이 둘에서 나온다.
 */
function paper(g: SVGElement, w: number, h: number): void {
  g.appendChild(el('rect', { x: '0', y: '0', width: String(w), height: String(h), rx: '3', fill: 'url(#mp-paper)' }))
  // 얼룩 — 큰 것 넷. 위치는 고정 해시라 늘 같은 자리다.
  for (let i = 0; i < 4; i++) {
    const cx = hash01(900 + i) * w
    const cy = hash01(950 + i) * h
    const r = 40 + hash01(980 + i) * 70
    g.appendChild(el('circle', {
      cx: String(cx), cy: String(cy), r: String(r),
      fill: INK.paperEdge, opacity: String(0.05 + hash01(1000 + i) * 0.05),
    }))
  }
  // 접힌 자국 — 세로 둘. 아주 흐리게, 양쪽으로 그림자 한 줄씩.
  for (const t of [0.34, 0.68]) {
    const x = Math.round(w * t)
    g.appendChild(el('line', { x1: String(x), y1: '0', x2: String(x), y2: String(h), stroke: INK.paperEdge, 'stroke-width': '1', opacity: '0.35' }))
    g.appendChild(el('line', { x1: String(x + 1), y1: '0', x2: String(x + 1), y2: String(h), stroke: '#fff', 'stroke-width': '1', opacity: '0.22' }))
  }
  // 가장자리 — 안쪽으로 한 겹 더 그은 테두리. 고지도의 광곽(匡郭)이다.
  g.appendChild(el('rect', {
    x: '6.5', y: '6.5', width: String(w - 13), height: String(h - 13),
    fill: 'none', stroke: INK.ink, 'stroke-width': '1.4', opacity: '0.55', rx: '2',
  }))
  g.appendChild(el('rect', {
    x: '10.5', y: '10.5', width: String(w - 21), height: String(h - 21),
    fill: 'none', stroke: INK.ink, 'stroke-width': '0.7', opacity: '0.35', rx: '1',
  }))
}

/** 산줄기 하나 — 봉우리 여럿을 한 붓으로. 뒤쪽 능선은 흐리게 한 겹 더 깐다. */
function ridge(g: SVGElement, x0: number, y: number, wide: number, seed: number, tall: number): void {
  const peaks = 2 + Math.floor(hash01(seed) * 3)
  const step = wide / peaks
  for (const [dy, op, col] of [[3, 0.28, INK.inkSoft], [0, 0.7, INK.ink]] as const) {
    let d = `M ${x0} ${y + dy}`
    for (let i = 0; i < peaks; i++) {
      const px = x0 + step * (i + 0.5)
      const ph = tall * (0.6 + hash01(seed * 7 + i) * 0.7)
      d += ` L ${px} ${y + dy - ph} L ${x0 + step * (i + 1)} ${y + dy}`
    }
    g.appendChild(el('path', { d, fill: 'none', stroke: col, 'stroke-width': dy === 0 ? '1.5' : '1', opacity: String(op), 'stroke-linejoin': 'round' }))
  }
  // 봉우리 하나에 빗금 — 바위 낀 산이라는 뜻. 하나면 충분하다.
  const hx = x0 + step * 0.5
  g.appendChild(el('path', {
    d: `M ${hx - 3} ${y - 2} L ${hx} ${y - tall * 0.5} L ${hx + 3} ${y - 2}`,
    fill: INK.ink, opacity: '0.18',
  }))
}

/** 소나무 한 그루 — 줄기 하나에 삼각 둘. 작게 여러 그루면 숲이 된다. */
function pine(g: SVGElement, x: number, y: number, s: number): void {
  g.appendChild(el('line', { x1: String(x), y1: String(y), x2: String(x), y2: String(y - s * 1.1), stroke: INK.ink, 'stroke-width': '1', opacity: '0.55' }))
  for (let i = 0; i < 2; i++) {
    const yy = y - s * (0.55 + i * 0.42)
    g.appendChild(el('path', {
      d: `M ${x - s * 0.45} ${yy} L ${x} ${yy - s * 0.5} L ${x + s * 0.45} ${yy} Z`,
      fill: INK.green, opacity: '0.45',
    }))
  }
}

/** 물길 — 두 줄로 그린다. 한 줄은 개천이고 두 줄이라야 강이다. */
function river(g: SVGElement, d: string): void {
  g.appendChild(el('path', { d, fill: 'none', stroke: INK.waterSoft, 'stroke-width': '5.5', opacity: '0.5', 'stroke-linecap': 'round' }))
  g.appendChild(el('path', { d, fill: 'none', stroke: INK.water, 'stroke-width': '1.2', opacity: '0.75', 'stroke-linecap': 'round' }))
}

/** 바다 — 아래 가장자리의 물결 세 줄. 지도의 끝이 어디인지 말해 준다. */
function sea(g: SVGElement, w: number, y: number): void {
  for (let r = 0; r < 3; r++) {
    let d = `M 14 ${y + r * 7}`
    for (let x = 14; x < w - 14; x += 22) {
      d += ` q 5.5 -4 11 0 q 5.5 4 11 0`
    }
    g.appendChild(el('path', { d, fill: 'none', stroke: INK.water, 'stroke-width': '1', opacity: String(0.45 - r * 0.1) }))
  }
}

/** 나침반 — 네 갈래 별과 東西南北. 지도에 방위가 없으면 그림이다. */
function compass(g: SVGElement, cx: number, cy: number, r: number): void {
  g.appendChild(el('circle', { cx: String(cx), cy: String(cy), r: String(r), fill: 'none', stroke: INK.ink, 'stroke-width': '1', opacity: '0.5' }))
  g.appendChild(el('circle', { cx: String(cx), cy: String(cy), r: String(r * 0.62), fill: 'none', stroke: INK.ink, 'stroke-width': '0.6', opacity: '0.35' }))
  // 네 갈래 — 위쪽(北)만 먹으로 채운다. 나머지는 비운다.
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 - Math.PI / 2
    const ax = cx + Math.cos(a) * r
    const ay = cy + Math.sin(a) * r
    const bx = cx + Math.cos(a + Math.PI / 4) * r * 0.26
    const by = cy + Math.sin(a + Math.PI / 4) * r * 0.26
    const dx = cx + Math.cos(a - Math.PI / 4) * r * 0.26
    const dy = cy + Math.sin(a - Math.PI / 4) * r * 0.26
    g.appendChild(el('path', {
      d: `M ${ax} ${ay} L ${bx} ${by} L ${cx} ${cy} L ${dx} ${dy} Z`,
      fill: i === 0 ? INK.seal : INK.ink, opacity: i === 0 ? '0.8' : '0.35',
    }))
  }
  const n = el('text', { x: String(cx), y: String(cy - r - 4), 'text-anchor': 'middle', fill: INK.ink, 'font-size': '9', opacity: '0.7' })
  n.textContent = '北'
  n.setAttribute('font-family', 'var(--serif)')
  g.appendChild(n)
}

/** 표제(標題) — 두 겹 테두리 안의 이름. 고지도는 이름을 상자에 넣는다. */
function cartouche(g: SVGElement, x: number, y: number, w: number, h: number, title: string, sub: string): void {
  g.appendChild(el('rect', { x: String(x), y: String(y), width: String(w), height: String(h), fill: INK.paper0, opacity: '0.75', rx: '1' }))
  g.appendChild(el('rect', { x: String(x), y: String(y), width: String(w), height: String(h), fill: 'none', stroke: INK.ink, 'stroke-width': '1.2', opacity: '0.7', rx: '1' }))
  g.appendChild(el('rect', { x: String(x + 3), y: String(y + 3), width: String(w - 6), height: String(h - 6), fill: 'none', stroke: INK.ink, 'stroke-width': '0.6', opacity: '0.4' }))
  const t = el('text', { x: String(x + w / 2), y: String(y + h * 0.46), 'text-anchor': 'middle', fill: INK.ink, 'font-size': '15', 'letter-spacing': '3' })
  t.setAttribute('font-family', 'var(--serif)')
  t.textContent = title
  g.appendChild(t)
  const s = el('text', { x: String(x + w / 2), y: String(y + h * 0.82), 'text-anchor': 'middle', fill: INK.inkSoft, 'font-size': '9', 'letter-spacing': '1.5' })
  s.setAttribute('font-family', 'var(--serif)')
  s.textContent = sub
  g.appendChild(s)
}

/**
 * 바탕 한 장을 통째로 그린다. `rowY` 는 각 줄(장)의 중심 y — 산·나무는 **줄 사이**에만 선다.
 * 길과 판은 ui/map.ts 가 이 위에 얹는다.
 */
export function drawMapArt(
  svg: SVGElement, w: number, h: number, rowY: readonly number[], seaY: number,
): void {
  const defs = el('defs', {})
  const grad = el('linearGradient', { id: 'mp-paper', x1: '0', y1: '0', x2: '0.6', y2: '1' })
  const s0 = el('stop', { offset: '0', 'stop-color': INK.paper0 })
  const s1 = el('stop', { offset: '1', 'stop-color': INK.paper1 })
  grad.append(s0, s1)
  defs.appendChild(grad)
  svg.appendChild(defs)

  const bg = el('g', {})
  paper(bg, w, h)

  // ── 산줄기 — 줄과 줄 사이의 빈 띠에만. 뒤로 갈수록(깊은 장) 높고 잦다. ──
  for (let r = 0; r < rowY.length - 1; r++) {
    const y = ((rowY[r] as number) + (rowY[r + 1] as number)) / 2 + 12
    const clusters = 2 + (r % 2)
    for (let c = 0; c < clusters; c++) {
      const seed = 31 + r * 13 + c
      const x0 = 30 + hash01(seed) * (w - 200) + c * 40
      ridge(bg, x0, y, 70 + hash01(seed + 1) * 50, seed, 11 + r * 2.5)
    }
    // 소나무 몇 그루 — 산 곁에.
    for (let t = 0; t < 3; t++) {
      const seed = 71 + r * 17 + t
      pine(bg, 40 + hash01(seed) * (w - 90), y + 4, 7 + hash01(seed + 3) * 3)
    }
  }

  // ── 물길 — 셋째 줄 언저리를 가로지른다. 길을 건너지 않게 아래쪽으로 흐른다. ──
  const ry = (rowY[2] ?? h * 0.5) + 30
  river(bg, `M 18 ${ry - 10} q 60 16 118 2 q 66 -16 128 8 q 70 26 142 4 q 60 -18 ${w - 40} 10`)

  sea(bg, w, seaY)
  compass(bg, w - 46, 44, 17)
  cartouche(bg, 18, 18, 132, 46, '神弓行路圖', '신궁 행로도')
  svg.appendChild(bg)
}
