/**
 * 흥망 그래프 (docs/realm/DESIRE.md §9 · 형 11-05: "게임 끝났을 때 그래프 만들어 준다며 · 그래프 하나도 없는데?") — 판 끝 화면 · 책장.
 * 표는 하나만 크게 — 위 단추로 군사 · 고을 · 백성 · 곡식 · 철을 바꿔 본다 (형 11-05: "3개 한 번에 말고 1개만, 버튼 눌러서 바꿔 볼 수 있게 · 자원양도").
 * 바꾸기는 라디오 단추와 CSS 만으로 — 다시 그리지 않는다. 고른 단추는 금빛 + ✓ (메모리 wwe-overreaction-ux).
 * 우리는 늘 고정 파랑(메모리 my-land-fixed-blue)으로 굵게, 남은 나라는 깃발 빛으로 가늘게.
 * 가로축은 실제 날짜, 세로축은 현재 지표의 값 — 긴 판에서도 변화량을 읽을 수 있게 한다.
 * 옛 판 기록엔 모든 나라 값(all)이 없거나 앞의 셋뿐이다 — 없는 값은 그 줄을 비운다.
 */
import type { History } from './front.ts'
import { lang, t as tr } from '../../i18n/index.ts'

const W = 300
const H = 160
const LEFT = 56
const RIGHT = W - 9
const TOP = 12
const BOTTOM = 129
/** all 의 칸 · me 의 이름 · 단위 */
const METRICS = [
  { i: 2, key: 'men', get name() { return tr('rg.men') }, get unit() { return tr('rg.menU') } },
  { i: 0, key: 'nodes', get name() { return tr('rg.nodes') }, get unit() { return tr('rg.nodesU') } },
  { i: 1, key: 'hh', get name() { return tr('rg.hh') }, get unit() { return tr('rg.hhU') } },
  { i: 3, key: 'grain', get name() { return tr('rg.grain') }, unit: '' },
  { i: 4, key: 'iron', get name() { return tr('rg.iron') }, unit: '' },
] as const
type Metric = (typeof METRICS)[number]
const axisNumber = (v: number): string => v >= 10000
  ? new Intl.NumberFormat(lang() === 'en' ? 'en-US' : 'ko-KR', { notation: 'compact', maximumFractionDigits: 1 }).format(v)
  : Math.round(v).toLocaleString(lang() === 'en' ? 'en-US' : 'ko-KR')

export interface RiseKit {
  readonly me: string
  /** 우리 줄 빛 (지도의 내 땅 파랑) */
  readonly mine: string
  readonly colorOf: (f: string) => string
  readonly nameOf: (f: string) => string
  readonly esc: (s: string) => string
  readonly dateOf: (season: number) => string
}

/** 한 나라의 한 줄 — 달마다 값 (그때 몰랐으면 null) */
function seriesOf(h: History, f: string, me: string, m: Metric): Array<number | null> {
  return h.map((t) => {
    const v = t.all?.[f]
    if (v !== undefined) return v[m.i] ?? null
    if (f === me && t.me !== undefined) return t.me[m.key] ?? null
    return t.all !== undefined ? 0 : null // 모든 나라를 적은 달에 없으면 망한 것 — 바닥
  })
}

function pathOf(vals: ReadonlyArray<number | null>, max: number): string {
  const n = vals.length
  let d = ''
  let pen = false
  vals.forEach((v, j) => {
    if (v === null) { pen = false; return }
    const x = LEFT + (n <= 1 ? 0 : (j / (n - 1)) * (RIGHT - LEFT))
    const y = BOTTOM - (max > 0 ? (v / max) * (BOTTOM - TOP) : 0)
    d += `${pen ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`
    pen = true
  })
  return d
}

let seq = 0

export function riseGraphHtml(h: History, k: RiseKit): string {
  if (h.length < 2) return ''
  const others = [...new Set(h.flatMap((t) => Object.keys(t.all ?? {})))].filter((f) => f !== k.me).sort()
  // 값이 하나라도 적힌 것만 단추로 (옛 기록엔 곡식·철이 없다)
  const shown = METRICS.filter((m) => [k.me, ...others].some((f) => seriesOf(h, f, k.me, m).some((v) => v !== null)))
  if (shown.length === 0) return ''
  const id = `rise${++seq}`
  let radios = ''
  let tabs = ''
  let figs = ''
  shown.forEach((m, j) => {
    radios += `<input type="radio" class="riser" name="${id}" id="${id}-${j}"${j === 0 ? ' checked' : ''}>`
    const mine = seriesOf(h, k.me, k.me, m)
    const theirs = others.map((f) => ({ f, v: seriesOf(h, f, k.me, m) }))
    const max = Math.max(1, ...mine.map((v) => v ?? 0), ...theirs.flatMap((x) => x.v.map((v) => v ?? 0)))
    const last = [...mine].reverse().find((v) => v !== null) ?? 0
    tabs += `<label for="${id}-${j}"><b>${m.name}</b><small>${Math.round(last).toLocaleString(lang() === 'en' ? 'en-US' : 'ko-KR')}${m.unit}</small></label>`
    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${tr('rg.aria', { name: m.name })}">`
    for (const fraction of [0, .5, 1]) {
      const y = BOTTOM - fraction * (BOTTOM - TOP)
      const value = axisNumber(max * fraction)
      svg += `<line x1="${LEFT}" y1="${y}" x2="${RIGHT}" y2="${y}" stroke="#ffffff2c" stroke-width="1"/>`
      svg += `<text x="${LEFT - 5}" y="${y + 3}" text-anchor="end" fill="#cfc3ad" font-size="10">${value}${m.unit}</text>`
    }
    const marks = [...new Set([0, Math.floor((h.length - 1) / 2), h.length - 1])]
    marks.forEach((idx, pos) => {
      const point = h[idx]
      if (point === undefined) return
      const x = LEFT + (idx / (h.length - 1)) * (RIGHT - LEFT)
      const anchor = pos === 0 ? 'start' : pos === marks.length - 1 ? 'end' : 'middle'
      svg += `<line x1="${x}" y1="${BOTTOM}" x2="${x}" y2="${BOTTOM + 4}" stroke="#ffffff66" stroke-width="1"/>`
      svg += `<text x="${x}" y="${H - 7}" text-anchor="${anchor}" fill="#cfc3ad" font-size="10">${k.esc(k.dateOf(point.s))}</text>`
    })
    for (const x of theirs) {
      const d = pathOf(x.v, max)
      if (d !== '') svg += `<path d="${d}" fill="none" stroke="${k.colorOf(x.f)}" stroke-width="1.6" stroke-linejoin="round" opacity=".75" vector-effect="non-scaling-stroke"><title>${k.esc(k.nameOf(x.f))}</title></path>`
    }
    const dm = pathOf(mine, max)
    if (dm !== '') svg += `<path d="${dm}" fill="none" stroke="${k.mine}" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`
    svg += `</svg>`
    figs += `<figure class="risec">${svg}</figure>`
  })
  let out = `<div class="rise"><h4>${tr('rg.title')}</h4>${radios}<div class="risetabs">${tabs}</div><div class="risefigs">${figs}</div>`
  // 줄이 누구인가 — 우리 파랑 · 남은 나라는 깃발 빛 (많으면 여섯까지)
  out += `<p class="risekey"><i style="background:${k.mine}"></i>${k.esc(k.nameOf(k.me))}${others.slice(0, 6).map((f) => `<i class="o" style="background:${k.colorOf(f)}"></i>${k.esc(k.nameOf(f))}`).join('')}${others.length > 6 ? ` ${tr('rg.more', { n: others.length - 6 })}` : ''}</p>`
  return out + `</div>`
}

/** n 번째 라디오가 켜지면 n 번째 단추가 눌리고 n 번째 표가 보인다 (단추는 다섯까지) */
const PICK = [1, 2, 3, 4, 5].map((n) => `.ap .rise .riser:nth-of-type(${n}):checked ~ .risefigs .risec:nth-child(${n}) { display: block; }
.ap .rise .riser:nth-of-type(${n}):checked ~ .risetabs label:nth-child(${n}) { background: linear-gradient(#5a4214, #3a2a0c); border-color: #f2c14e; color: #ffe8a8; transform: translateY(1px); box-shadow: inset 0 2px 6px #0008, 0 0 10px #f2c14e55; }
.ap .rise .riser:nth-of-type(${n}):checked ~ .risetabs label:nth-child(${n}) b::before { content: '✓ '; color: #ffd76a; }`).join('\n')

export const RISE_CSS = `
.ap .rise { margin: 10px 0 4px; } .ap .rise h4 { margin: 0 0 6px; color: var(--gold, #e0b45a); font-size: 15px; }
.ap .rise .riser { position: absolute; opacity: 0; pointer-events: none; width: 0; height: 0; }
.ap .risetabs { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 6px; }
.ap .risetabs label { flex: 1 1 0; min-width: 58px; display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 6px 4px; border-radius: 10px; cursor: pointer;
  background: #1a1510; border: 1px solid #4a4030; color: #d8d0c0; font-size: 13px; transition: transform .08s; }
.ap .risetabs label:active { transform: scale(.94); }
.ap .risetabs label b { font-size: 13.5px; } .ap .risetabs label small { font-size: 12px; color: #8fc4ff; font-weight: 700; font-variant-numeric: tabular-nums; }
.ap .risefigs .risec { display: none; margin: 0; padding: 6px 8px 4px; border-radius: 10px; background: #0b0a08b3; border: 1px solid #4a4030; animation: risein .25s ease-out; }
@keyframes risein { from { opacity: 0; transform: translateY(4px); } }
.ap .risec svg { display: block; width: 100%; height: auto; }
${PICK}
.ap .risekey { margin: 6px 0 0; font-size: 12px; color: #b8b0a0; display: flex; flex-wrap: wrap; gap: 2px 10px; align-items: center; }
.ap .risekey i { display: inline-block; width: 14px; height: 4px; border-radius: 2px; margin-right: 4px; vertical-align: middle; }
.ap .risekey i.o { height: 2px; }
`
