/**
 * 육각형 능력치 그림 (docs/realm/HEROES.md §1 · 형: "육각형이나 7각형 이런거로 능력치 매핑")
 *
 * 칸 수만큼 꼭짓점을 두고 1~10 을 반지름으로 찍는다. 칸이 몇 개든 그린다 — 여섯이 기본.
 * 모르는 능력치는 null — 그 꼭짓점은 "?" 로 두고 면을 그리지 않는다 (본 만큼만, HEROES §5).
 */

/** 능력치 최댓값 — 반지름 끝 */
const MAX = 10

export interface RadarAxis {
  readonly label: string
  readonly value: number | null
}

export function radarSvg(axes: readonly RadarAxis[], color: string, size = 180): string {
  const n = axes.length
  const c = size / 2
  const r = size * 0.3
  const at = (i: number, k: number): [number, number] => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n
    return [c + Math.cos(a) * r * k, c + Math.sin(a) * r * k]
  }
  const poly = (k: number): string => axes.map((_, i) => at(i, k).map((v) => v.toFixed(1)).join(',')).join(' ')
  let s = `<svg class="radar" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">`
  for (const k of [1, 0.75, 0.5, 0.25]) s += `<polygon points="${poly(k)}" fill="${k === 1 ? '#1f252e' : 'none'}" stroke="#3a4250" stroke-width="1"/>`
  axes.forEach((_, i) => {
    const [x, y] = at(i, 1)
    s += `<line x1="${c}" y1="${c}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#3a4250" stroke-width="1"/>`
  })
  if (axes.every((a) => a.value !== null)) {
    const pts = axes.map((a, i) => at(i, Math.max(0.05, a.value! / MAX)).map((v) => v.toFixed(1)).join(',')).join(' ')
    s += `<polygon points="${pts}" fill="${color}" fill-opacity=".35" stroke="${color}" stroke-width="2"/>`
  }
  axes.forEach((a, i) => {
    const [x, y] = at(i, 1.28)
    s += `<text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="middle" font-size="12" fill="#cfc6b4" font-weight="700">${a.label}</text>`
    const [vx, vy] = at(i, 1.28)
    s += `<text x="${vx.toFixed(1)}" y="${(vy + 17).toFixed(1)}" text-anchor="middle" font-size="11" fill="${color}">${a.value ?? '?'}</text>`
  })
  return s + `</svg>`
}
