/**
 * 띠 누끼 정리 조각 — sprite-audit.mjs(재기)와 sprite-normalize.mjs(고치기)가 같이 쓴다.
 *  · islandsOf: 칸마다 이어진 덩어리(8방향)를 찾아 가장 큰 것(몸+붙은 무기)만 남기고 떠 있는 부스러기·옆 칸에서 넘어온 조각을 가려낸다
 *  · cleanStrip: 반투명 후광(알파 < ALOW 는 지움) + 초록/마젠타 fringe despill + 부스러기 지움 → 새 RGBA
 */
export const A_ON = 40 // 몸으로 치는 알파
export const ALOW = 60 // 이보다 옅은 알파는 후광이라 지운다
const NEAR = 3 // 몸에 이만큼 붙어 있으면 붙은 조각(칼끝·창끝 · 몸과 떨어진 무기)으로 본다

/** 칸 하나의 덩어리. → { comps:[{id,area,minx,maxx,edgeL,edgeR,near}], label, mainId, remove:Set(id) } */
export function islandsOf(img, cx0, cw) {
  const { w: W, h: H, px } = img
  const label = new Int32Array(cw * H)
  const comps = []
  const stack = []
  for (let y0 = 0; y0 < H; y0++) for (let x0 = 0; x0 < cw; x0++) {
    const k0 = y0 * cw + x0
    if (label[k0] !== 0 || px[(y0 * W + cx0 + x0) * 4 + 3] <= A_ON) continue
    const id = comps.length + 1
    const c = { id, area: 0, minx: x0, maxx: x0, edgeL: false, edgeR: false, near: false }
    label[k0] = id; stack.push(k0)
    while (stack.length) {
      const k = stack.pop(), x = k % cw, y = (k - x) / cw
      c.area++; if (x < c.minx) c.minx = x; if (x > c.maxx) c.maxx = x
      if (x === 0) c.edgeL = true
      if (x === cw - 1) c.edgeR = true
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy
        if (nx < 0 || ny < 0 || nx >= cw || ny >= H) continue
        const nk = ny * cw + nx
        if (label[nk] === 0 && px[(ny * W + cx0 + nx) * 4 + 3] > A_ON) { label[nk] = id; stack.push(nk) }
      }
    }
    comps.push(c)
  }
  const remove = new Set()
  if (comps.length < 2) return { comps, label, mainId: comps[0]?.id ?? 0, remove }
  const main = comps.reduce((a, b) => (b.area > a.area ? b : a))
  // 몸 가까이(NEAR 칸 안)에 닿은 조각 표시
  const mx = new Uint8Array(cw * H)
  for (let y = 0; y < H; y++) for (let x = 0; x < cw; x++) if (label[y * cw + x] === main.id) mx[y * cw + x] = 1
  const dil = new Uint8Array(cw * H)
  for (let y = 0; y < H; y++) for (let x = 0; x < cw; x++) if (mx[y * cw + x]) {
    for (let dy = -NEAR; dy <= NEAR; dy++) for (let dx = -NEAR; dx <= NEAR; dx++) {
      const nx = x + dx, ny = y + dy
      if (nx >= 0 && ny >= 0 && nx < cw && ny < H) dil[ny * cw + nx] = 1
    }
  }
  for (let k = 0; k < cw * H; k++) if (dil[k] && label[k] > 0) comps[label[k] - 1].near = true
  for (const c of comps) {
    if (c.id === main.id) continue
    const edge = c.edgeL || c.edgeR
    if (c.area < main.area * 0.003 || (!c.near && (c.area < main.area * 0.015 || (edge && c.area < main.area * 0.05)))) remove.add(c.id)
  }
  return { comps, label, mainId: main.id, remove }
}

/** 한 칸의 선명도 — 안쪽(네 이웃이 다 몸인) 픽셀에서 라플라시안 분산 ÷ 밝기 분산 (대비에 안 휘둘리게) × 1000 */
export function sharpOf(img, cx0, cw) {
  const { w: W, h: H, px } = img
  const lum = (x, y) => { const i = (y * W + cx0 + x) * 4; return 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2] }
  const op = (x, y) => px[(y * W + cx0 + x) * 4 + 3] > 200
  let n = 0, s1 = 0, s2 = 0, l1 = 0, l2 = 0
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < cw - 1; x++) {
    if (!(op(x, y) && op(x - 1, y) && op(x + 1, y) && op(x, y - 1) && op(x, y + 1))) continue
    const v = lum(x, y), lap = lum(x - 1, y) + lum(x + 1, y) + lum(x, y - 1) + lum(x, y + 1) - 4 * v
    n++; s1 += lap; s2 += lap * lap; l1 += v; l2 += v * v
  }
  if (n < 50) return 0
  const lv = s2 / n - (s1 / n) ** 2, vv = l2 / n - (l1 / n) ** 2
  return vv > 1 ? (lv / vv) * 1000 : 0
}

/** 칸 가장자리(왼/오른 끝 1px)에 닿은 불투명 픽셀 — 이웃 칸에서 이어지면 넘침(spill) */
export function edgeTouch(img, cx0, cw, prevCx0, prevCw, nextCx0) {
  const { w: W, h: H, px } = img
  const col = (x0, x) => { let n = 0; for (let y = 0; y < H; y++) if (px[(y * W + x0 + x) * 4 + 3] > 128) n++; return n }
  const out = []
  const l = col(cx0, 0), r = col(cx0, cw - 1)
  if (l > 0) out.push({ side: 'L', px: l, spill: prevCx0 !== undefined && col(prevCx0, prevCw - 1) > 0 })
  if (r > 0) out.push({ side: 'R', px: r, spill: nextCx0 !== undefined && col(nextCx0, 0) > 0 })
  return out
}

/**
 * 띠 전체를 정리한 새 RGBA 와 기록. cells=칸 수.
 * log: { halo(지운 옅은 픽셀), fringe(despill 한 픽셀), islands:[{cell,area,of}] }
 */
export function cleanStrip(img, cells) {
  const { w: W, h: H } = img
  const px = new Uint8Array(img.px)
  const cw = W / cells
  const log = { halo: 0, fringe: 0, islands: [] }
  for (let i = 0; i < cells; i++) {
    const cx0 = Math.round(i * cw), cwi = Math.round((i + 1) * cw) - cx0
    const isl = islandsOf(img, cx0, cwi)
    if (isl.remove.size) {
      const main = isl.comps.find((c) => c.id === isl.mainId).area
      for (const id of isl.remove) log.islands.push({ cell: i, area: isl.comps[id - 1].area, of: main })
      for (let y = 0; y < H; y++) for (let x = 0; x < cwi; x++) if (isl.remove.has(isl.label[y * cwi + x])) px[(y * W + cx0 + x) * 4 + 3] = 0
    }
    // 덩어리에 속하지 않은 옅은 알파 찌꺼기도 아래 후광 규칙이 지운다
    const op = (x, y) => x >= 0 && y >= 0 && x < cwi && y < H && px[(y * W + cx0 + x) * 4 + 3] >= ALOW
    for (let y = 0; y < H; y++) for (let x = 0; x < cwi; x++) {
      const k = (y * W + cx0 + x) * 4
      const a = px[k + 3]
      if (a === 0) continue
      if (a < ALOW) { px[k + 3] = 0; log.halo++; continue }
      // 바깥 2픽셀 안쪽만: 초록(#00FF00 바탕) · 마젠타(#FF00FF 바탕) 번짐을 걷는다
      let rim = false
      for (let dy = -2; dy <= 2 && !rim; dy++) for (let dx = -2; dx <= 2; dx++) if (!op(x + dx, y + dy)) { rim = true; break }
      if (!rim) continue
      const r = px[k], g = px[k + 1], b = px[k + 2]
      if (g > r + 25 && g > b + 25) { px[k + 1] = Math.max(r, b); log.fringe++ }
      else if (r > g + 45 && b > g + 45) { px[k] = Math.min(r, g + 25); px[k + 2] = Math.min(b, g + 25); log.fringe++ }
    }
  }
  return { img: { w: W, h: H, px }, log }
}

/** 칸 안에서 곧은 세로선으로 잘린 곳 — 몸(8px 이상 두께)이 한 열에서 뚝 끊기는 것이 24줄 이상 이어지면 (창대 같은 가는 세로선은 아님) */
export function flatCutOf(img, cx0, cw) {
  const { w: W, h: H, px } = img
  const a = (x, y) => px[(y * W + cx0 + x) * 4 + 3]
  const out = []
  for (let x = 8; x < cw - 8; x++) {
    for (const side of ['R', 'L']) {
      const dir = side === 'R' ? -1 : 1 // 몸이 있는 쪽
      let run = 0, best = 0
      for (let y = 0; y < H; y++) {
        let ok = a(x, y) <= A_ON
        for (let k = 1; k <= 8 && ok; k++) ok = a(x + dir * k, y) > 128
        if (ok) { run++; if (run > best) best = run } else run = 0
      }
      if (best >= 36) out.push({ x, side, run: best })
    }
  }
  return out
}
