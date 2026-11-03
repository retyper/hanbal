/**
 * 받는 막대 — 스플래시·판 가림막이 같이 쓴다 (형 11-04: "매번 95% 쯤에서 계속 멈춰 있다가 100 이 되네. 점진적으로 변해야").
 *
 * 예전 막대는 받은 일의 **개수**로 찼다. 그림 수십 장은 캐시에서 한꺼번에 끝나 95% 로 뛰고, 몇 초 걸리는 지도 바탕(worldMapReady)은
 * 일 하나라 맨 끝에 한 칸만 차지했다. 이제는
 *  - 일마다 몫(무게)을 따로 준다 — 무거운 일(지도 바탕)은 막대의 큰 몫
 *  - 아직 안 끝난 일도 걸린 시간만큼 제 몫 안에서 조금씩 찬다(예상 시간에 닿으면 몫의 2/3 쯤 · creepMax 를 넘지 않는다) — 기다리는 동안 멈춰 보이지 않게
 *  - 가운데 한 줄을 읽힐 최소 시간도 일 하나(linear) — 다 받고도 100% 에 몇 초 멈춰 있지 않고 걷히는 때에 100% 가 된다
 *  - 보이는 막대는 목표를 부드럽게 따라간다 · 뒤로 가지 않는다
 * rAF 는 보이는 탭에서만 돈다 (절대 규칙 4) · 다 차거나 막대가 문서에서 빠지면 멈춘다.
 */
import { P } from '../../tune/params.ts'

interface Job { readonly w: number; readonly expect: number; readonly t0: number; readonly linear: boolean; done: boolean }

export interface LoadBar {
  /** 일을 건다 — 무게 · 예상 시간(ms) · linear 면 예상 시간에 맞춰 곧게 찬다(읽을 시간처럼 끝이 정해진 기다림) */
  add<T>(p: Promise<T>, weight: number, expectMs: number, linear?: boolean): Promise<T>
  /** 다 됐다 (늦어도 걷히는 때 포함) — 끝까지 채운다 */
  finish(): void
}

export function loadBar(fill: HTMLElement, from = 0): LoadBar {
  const jobs: Job[] = []
  let finished = false
  let shown = from
  let raf = 0
  fill.style.transition = 'none'
  const target = (now: number): number => {
    if (finished) return 100
    const total = jobs.reduce((s, j) => s + j.w, 0)
    if (total <= 0) return from
    let got = 0
    for (const j of jobs) {
      if (j.done) { got += j.w; continue }
      const x = (now - j.t0) / Math.max(1, j.expect)
      got += j.w * (j.linear ? Math.min(1, x) : P.realm.loadBarCreepMax * (1 - Math.exp(-1.2 * x)))
    }
    return from + (100 - from) * (got / total)
  }
  const frame = (now: number): void => {
    raf = 0
    if (!fill.isConnected) return
    const t = target(now)
    shown = Math.max(shown, shown + (t - shown) * P.realm.loadBarEase)
    if (finished && t - shown < 0.5) shown = 100
    fill.style.width = `${shown.toFixed(1)}%`
    if (shown < 100) raf = requestAnimationFrame(frame)
  }
  const kick = (): void => { if (raf === 0) raf = requestAnimationFrame(frame) }
  kick()
  return {
    add<T>(p: Promise<T>, weight: number, expectMs: number, linear = false): Promise<T> {
      const j: Job = { w: weight, expect: expectMs, t0: performance.now(), linear, done: false }
      jobs.push(j)
      kick()
      const end = (): void => { j.done = true; kick() }
      p.then(end, end)
      return p
    },
    finish(): void { finished = true; kick() },
  }
}
