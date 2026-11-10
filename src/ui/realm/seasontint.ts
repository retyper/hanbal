/**
 * 계절 빛을 그림 전체에 — worldmap.ts 와 일꾼(tintworker.ts)이 같이 쓴다. 가볍게 두려고 따로 뗐다 (일꾼 묶음에 지도 자료가 딸려 오지 않게).
 * seasonTint(worldmap.ts)와 같은 식을 점마다 배열을 만들고 풀지 않고 제자리에서 센다 (시험이 seasonTint 와 맞춰 본다).
 * 4배 느린 폰에서 세계판 한 장이 0.6초 긴 작업이었다 (카드 C · 형 11-11)
 */
type Season = 'spring' | 'summer' | 'autumn' | 'winter'

export function tintPixels(d: Uint8ClampedArray, season: Season): void {
  const n = d.length
  switch (season) {
    case 'spring': return
    case 'summer':
      for (let i = 0; i < n; i += 4) { d[i] = d[i]! * 0.86; d[i + 1] = d[i + 1]! * 0.95; d[i + 2] = d[i + 2]! * 0.88 }
      return
    case 'autumn':
      for (let i = 0; i < n; i += 4) {
        const r = d[i]!, g = d[i + 1]!, b = d[i + 2]!
        const leaf = g > r && g > b ? Math.min(1, (g - Math.max(r, b)) / 40) : 0
        d[i] = r + (g - r) * 0.85 * leaf + 10
        d[i + 1] = g * (1 - 0.12 * leaf)
        d[i + 2] = b * (1 - 0.35 * leaf)
      }
      return
    case 'winter':
      for (let i = 0; i < n; i += 4) {
        const r = d[i]!, g = d[i + 1]!, b = d[i + 2]!
        const w = Math.min(255, (0.3 * r + 0.59 * g + 0.11 * b) * 1.12 + 26)
        d[i] = w * 0.95 * 0.7 + r * 0.3 * 0.95
        d[i + 1] = w * 0.98 * 0.7 + g * 0.3
        d[i + 2] = Math.min(255, w * 1.04) * 0.7 + b * 0.3
      }
  }
}
