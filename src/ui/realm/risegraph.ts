/**
 * 흥망 그래프 (docs/realm/DESIRE.md §9 · 형 11-05: "게임 끝났을 때 그래프 만들어 준다며 · 그래프 하나도 없는데?") — 판 끝 화면에.
 * 줄 셋: 군사 · 고을 · 백성(집). 우리는 늘 고정 파랑(메모리 my-land-fixed-blue)으로 굵게, 남은 나라는 깃발 빛으로 가늘게.
 * 눈금 숫자는 없다 — 줄 끝에 지금 값 하나 (숫자는 판 끝 한 번만 · DESIRE §9 선 5).
 * 옛 판 기록엔 모든 나라 값(all)이 없다 — 그때는 우리 줄만.
 */
import type { History } from './front.ts'

const W = 300
const H = 96
const PAD = 6
const METRICS = [
  { i: 2, name: '군사', unit: '명' },
  { i: 0, name: '고을', unit: '곳' },
  { i: 1, name: '백성', unit: '집' },
] as const

export interface RiseKit {
  readonly me: string
  /** 우리 줄 빛 (지도의 내 땅 파랑) */
  readonly mine: string
  readonly colorOf: (f: string) => string
  readonly nameOf: (f: string) => string
  readonly esc: (s: string) => string
}

/** 한 나라의 한 줄 — 계절마다 값 (그 계절에 없으면 null) */
function seriesOf(h: History, f: string, me: string, i: 0 | 1 | 2): Array<number | null> {
  return h.map((t) => {
    const v = t.all?.[f]
    if (v !== undefined) return v[i]
    if (f === me && t.me !== undefined) return i === 0 ? t.me.nodes : i === 1 ? t.me.hh : t.me.men
    return t.all !== undefined ? 0 : null // 모든 나라를 적은 계절에 없으면 망한 것 — 바닥
  })
}

function pathOf(vals: ReadonlyArray<number | null>, max: number): string {
  const n = vals.length
  let d = ''
  let pen = false
  vals.forEach((v, j) => {
    if (v === null) { pen = false; return }
    const x = PAD + (n <= 1 ? 0 : (j / (n - 1)) * (W - PAD * 2))
    const y = H - PAD - (max > 0 ? (v / max) * (H - PAD * 2) : 0)
    d += `${pen ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`
    pen = true
  })
  return d
}

export function riseGraphHtml(h: History, k: RiseKit): string {
  if (h.length < 2) return ''
  const others = [...new Set(h.flatMap((t) => Object.keys(t.all ?? {})))].filter((f) => f !== k.me).sort()
  let out = `<div class="rise"><h4>흥망</h4><div class="risegrid">`
  for (const m of METRICS) {
    const mine = seriesOf(h, k.me, k.me, m.i)
    const theirs = others.map((f) => ({ f, v: seriesOf(h, f, k.me, m.i) }))
    const max = Math.max(1, ...mine.map((v) => v ?? 0), ...theirs.flatMap((x) => x.v.map((v) => v ?? 0)))
    const last = [...mine].reverse().find((v) => v !== null) ?? 0
    let svg = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">`
    svg += `<line x1="${PAD}" y1="${H - PAD}" x2="${W - PAD}" y2="${H - PAD}" stroke="#ffffff22" stroke-width="1"/>`
    for (const x of theirs) {
      const d = pathOf(x.v, max)
      if (d !== '') svg += `<path d="${d}" fill="none" stroke="${k.colorOf(x.f)}" stroke-width="1.6" stroke-linejoin="round" opacity=".75" vector-effect="non-scaling-stroke"><title>${k.esc(k.nameOf(x.f))}</title></path>`
    }
    const dm = pathOf(mine, max)
    if (dm !== '') svg += `<path d="${dm}" fill="none" stroke="${k.mine}" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`
    svg += `</svg>`
    out += `<figure class="risec"><figcaption><b>${m.name}</b><span>${Math.round(last).toLocaleString('ko-KR')}${m.unit}</span></figcaption>${svg}</figure>`
  }
  out += `</div>`
  // 줄이 누구인가 — 우리 파랑 · 남은 나라는 깃발 빛 (많으면 여섯까지)
  out += `<p class="risekey"><i style="background:${k.mine}"></i>${k.esc(k.nameOf(k.me))}${others.slice(0, 6).map((f) => `<i class="o" style="background:${k.colorOf(f)}"></i>${k.esc(k.nameOf(f))}`).join('')}${others.length > 6 ? ` 외 ${others.length - 6}나라` : ''}</p>`
  return out + `</div>`
}

export const RISE_CSS = `
.ap .rise { margin: 10px 0 4px; } .ap .rise h4 { margin: 0 0 6px; color: var(--gold, #e0b45a); font-size: 15px; }
.ap .risegrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px; }
.ap .risec { margin: 0; padding: 6px 8px 4px; border-radius: 10px; background: #0b0a08b3; border: 1px solid #4a4030; }
.ap .risec figcaption { display: flex; justify-content: space-between; align-items: baseline; font-size: 13px; color: #d8d0c0; }
.ap .risec figcaption b { color: #f3d48a; } .ap .risec figcaption span { font-variant-numeric: tabular-nums; color: #8fc4ff; font-weight: 700; }
.ap .risec svg { display: block; width: 100%; height: 72px; }
.ap .risekey { margin: 6px 0 0; font-size: 12px; color: #b8b0a0; display: flex; flex-wrap: wrap; gap: 2px 10px; align-items: center; }
.ap .risekey i { display: inline-block; width: 14px; height: 4px; border-radius: 2px; margin-right: 4px; vertical-align: middle; }
.ap .risekey i.o { height: 2px; }
`
