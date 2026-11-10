/**
 * 끊김 기록 — 50ms 를 넘긴 긴 작업(PerformanceObserver longtask)을 「어느 화면에서 · 얼마나 · 판이 얼마나 큰지」와 함께 40건까지 남긴다 (hanbal.realm.perf).
 * 형 11-11: "어떤 상황에서 프레임 드랍 되는지 너 알 수 있나? 모니터링 필요하나?" — 나는 형 폰을 못 본다. 형이 나라 탭에서 「복사」해 붙여 주면 어디서 끊기는지 안다.
 * 비용: 긴 작업이 났을 때만 한 줄 적는다 (rAF·타이머를 돌리지 않는다 · 절대 규칙 4).
 */
const KEY = 'hanbal.realm.perf'
const MAX = 40
const LONG_MS = 50

export interface PerfHit {
  readonly t: number
  readonly ms: number
  readonly where: string
  readonly tier: string
  readonly nodes: number
  readonly dpr: number
  readonly w: number
  readonly h: number
}

let hits: PerfHit[] = load()

function load(): PerfHit[] {
  try {
    const raw = localStorage.getItem(KEY)
    const v: unknown = raw === null ? [] : JSON.parse(raw)
    return Array.isArray(v) ? (v as PerfHit[]).slice(-MAX) : []
  } catch { return [] }
}
function save(): void {
  try { localStorage.setItem(KEY, JSON.stringify(hits)) } catch { /* 저장이 막히면 이번 판만 */ }
}

/** 켠다 — where() 는 지금 맨 위에 뜬 화면 이름 (app.ts 가 준다) */
export function startPerfLog(root: HTMLElement, where: () => string): void {
  if (typeof PerformanceObserver === 'undefined') return
  try {
    const po = new PerformanceObserver((list) => {
      let added = false
      for (const e of list.getEntries()) {
        if (e.duration < LONG_MS) continue
        hits.push({
          t: Date.now(), ms: Math.round(e.duration), where: where(),
          tier: [...root.classList].filter((c) => /^q-/.test(c)).join(' '),
          nodes: root.getElementsByTagName('*').length, dpr: Math.round(devicePixelRatio * 10) / 10, w: innerWidth, h: innerHeight,
        })
        added = true
      }
      if (added) { if (hits.length > MAX) hits.splice(0, hits.length - MAX); save() }
    })
    po.observe({ type: 'longtask', buffered: true })
  } catch { /* longtask 를 모르는 브라우저 */ }
}

const two = (n: number): string => String(n).padStart(2, '0')
/** 붙여 넣기 좋은 글 — 한 줄에 한 건 */
export function perfText(): string {
  if (hits.length === 0) return '끊김 기록 없음'
  return hits.map((h) => {
    const d = new Date(h.t)
    return `${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())} · ${h.ms}ms · ${h.where} · ${h.tier || 'q-?'} · ${h.nodes}칸 · ${h.w}×${h.h}@${h.dpr}`
  }).join('\n')
}
export function perfClear(): void { hits = []; save() }
export const perfCount = (): number => hits.length

/** 나라 탭 그래픽 줄 아래 — 건수·가장 긴 것 · 복사 · 지움 */
export function perfRowHtml(): string {
  const worst = hits.reduce((m, h) => Math.max(m, h.ms), 0)
  const tail = hits.slice(-3).map((h) => `${h.ms}ms ${h.where}`).join(' · ')
  return `<div class="gfxq perfq"><b>끊김 기록</b><small class="mute">${hits.length === 0 ? '아직 없음' : `${hits.length}건 · 가장 긴 ${worst}ms · 최근: ${tail}`}</small>`
    + `<span class="seg sm"><button data-act="perf-copy"${hits.length === 0 ? ' disabled' : ''}>복사</button><button data-act="perf-clear"${hits.length === 0 ? ' disabled' : ''}>지움</button></span></div>`
}
