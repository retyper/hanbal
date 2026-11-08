/**
 * 적장 사로잡기 — 다른 무리가 맞부딪는 동안 우리 장수가 뛰어나가 쓰러진 적장을 머리에 이고 돌아와 우리 진 땅바닥에 내려놓는다
 * (형 11-08: "다른전투 하는 도중에 데려와야 · 적장은 내 장수랑 같이 딸려와야 · 머리에 이고오는 느낌 · 우리진영에 도착하면 땅바닥에 쓰러져 있고").
 *
 * 무대: 잡는 장수(.wgen) · 쓰러지는 적장(.wgen.gtaken, 제자리에서 CSS gfall 로 쓰러진다) · 잡은 쪽 진에 미리 그려 둔 누운 적장(.wcapt.late).
 * 누운 적장은 들어 올릴 때 나타나 장수의 걸음과 같은 시계로 머리 위에서 들썩이다가 제자리(translate 0)로 내려앉는다 — 그 뒤로는 그 자리에 누워 있다.
 * 움직임은 전부 translate·rotate·scale·opacity·배경 칸 (폰 그래픽 한도: filter 를 움직이지 않는다). 시계는 battle-playback 과 같다.
 */
import type { Act, RoundLog } from '../../realm/types.ts'
import { P } from '../../tune/params.ts'
import { captureAttempts } from './battle-strikes.ts'
import type { BattlePlayback } from './battle-playback.ts'

type Side = Act['s']

/** 이 합에 먹힌 사로잡기 (한 합에 하나뿐 — 먹히면 그 합이 끝난다) */
export function caughtIn(round: RoundLog): { side: Side; target: string } | undefined {
  const c = captureAttempts(round).find((x) => x.succeeded && x.target !== undefined)
  return c === undefined ? undefined : { side: c.side, target: c.target! }
}

/** 장수를 들어 올려 데려와 내려놓기까지 — 맞부딪힘부터 */
export function carryEnd(clash: number): number {
  const R = P.realm
  return clash + R.warCapGrabS + R.warCapLiftS + R.warCapCarryS + R.warCapDropS
}

/**
 * 맞부딪힘 연출(battle-strikes)에 넘길 합 — 사로잡기를 뺀다. 그래야 다른 무리는 여느 합처럼 맞붙는다
 * (사로잡기가 먹힌 합은 엔진이 거기서 끝내 병사 기록이 없다 → 기록 없는 무리는 맞은편 앞줄과 그냥 맞붙는다).
 */
export function withoutCapture(round: RoundLog): RoundLog {
  const { ev, acts, ...rest } = round
  return {
    ...rest,
    ...(ev !== undefined && ev !== 'capture-ok' && ev !== 'capture-fail' ? { ev } : {}),
    ...(acts !== undefined ? { acts: acts.filter((a) => a.c !== 'capture') } : {}),
  }
}

export interface CaptureCast {
  /** 잡는 장수 · 잡히는 적장 · 잡은 쪽 진에 누울 적장 */
  readonly capturer: HTMLElement
  readonly target: HTMLElement
  readonly captive: HTMLElement
  /** 잡은 쪽이 거울로 뒤집힌 진(.wf2s.foe)인가 */
  readonly mirrored: boolean
}

export function captureCast(field: HTMLElement, round: RoundLog, weAtk: boolean): CaptureCast | null {
  const c = caughtIn(round)
  if (c === undefined) return null
  const ours = c.side === (weAtk ? 'a' : 'd')
  const mine = field.querySelector<HTMLElement>(ours ? '.wf2s.us' : '.wf2s.foe')
  const theirs = field.querySelector<HTMLElement>(ours ? '.wf2s.foe' : '.wf2s.us')
  const capturer = mine?.querySelector<HTMLElement>('.wgen.gsp:not(.gcap-aide):not(.gdown)')
  const target = theirs?.querySelector<HTMLElement>(`.wgen.gsp.gtaken[data-hero="${CSS.escape(c.target)}"]`)
  const captive = mine?.querySelector<HTMLElement>(`.wcapt.late[data-hero="${CSS.escape(c.target)}"]`)
  if (capturer == null || target == null || captive == null) return null
  return { capturer, target, captive, mirrored: !ours }
}

const cell = (n: number): string => `${(100 * n) / 19}%`
const px = (x: number, y: number): string => `${x.toFixed(1)}px ${y.toFixed(1)}px`

export function playCapture(field: HTMLElement, cast: CaptureCast, clash: number, playback: BattlePlayback): () => void {
  const R = P.realm
  if (typeof field.animate !== 'function' || document.hidden || field.closest('.fast') !== null || matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {}
  const { capturer, target, captive, mirrored } = cast
  const frame = capturer.querySelector<HTMLElement>('.gspf')
  const body = capturer.querySelector<HTMLElement>('.gbody')
  if (frame === null || body === null) return () => {}

  // 화면 칸 → 진 안 칸 (전장이 줄어 있을 수 있고, 적 진은 거울이다)
  const box = field.getBoundingClientRect()
  const sx = box.width / Math.max(1, field.clientWidth)
  const sy = box.height / Math.max(1, field.clientHeight)
  const local = (dx: number, dy: number): { x: number; y: number } => ({ x: (dx / sx) * (mirrored ? -1 : 1), y: dy / sy })
  const cr = capturer.getBoundingClientRect()
  const tr = target.getBoundingClientRect()
  const kr = captive.getBoundingClientRect()
  const ccx = cr.x + cr.width / 2
  const tcx = tr.x + tr.width / 2
  const kcx = kr.x + kr.width / 2
  const gb = parseFloat(getComputedStyle(capturer).getPropertyValue('--gb')) || 0.9

  // 달려가 적장 바로 앞에 선다
  const dx = tcx - ccx
  const run = local(dx - Math.sign(dx) * cr.width * R.warCapReach, tr.bottom - cr.bottom)
  // 누운 적장의 자리 셋 (누운 자리 기준): 쓰러진 곳 · 장수 머리 위 · 누운 자리(0)
  const fallen = local(tcx - kcx, tr.bottom - kr.bottom)
  const head = local(ccx - kcx, cr.top + cr.height * (1 - gb) + cr.height * 0.06 - kr.bottom)

  const t1 = clash
  const t0 = Math.max(0, t1 - R.warCapRunS)
  const tLift = clash + R.warCapGrabS
  const tBack = tLift + R.warCapLiftS
  const tHome = tBack + R.warCapCarryS
  const tEnd = tHome + R.warCapDropS
  const span = tHome - t0

  const anims: Animation[] = []
  const play = (el: HTMLElement, keys: Keyframe[], startS: number, durS: number, fill: FillMode): void => {
    const a = el.animate(keys, { duration: Math.max(1, durS * 1000), delay: startS * 1000, fill })
    a.playbackRate = playback.rate
    anims.push(a)
  }
  const at = (t: number, from: number, len: number): number => Math.min(1, Math.max(0, (t - from) / len))

  // 장수의 자리 — 나갔다가(달리기) 그 자리에서 들어 올리고 이고 돌아온다. 끝나면 CSS(승리 때 앞으로 나서기 등)에 넘긴다
  play(capturer, [
    { translate: px(0, 0), offset: 0 },
    { translate: px(run.x, run.y), offset: at(t1 - 0.1, t0, span) },
    { translate: px(run.x, run.y), offset: at(tBack, t0, span) },
    { translate: px(0, 0), offset: 1 },
  ], t0, span, 'none')
  // 돌아올 땐 돌아서서 걷는다
  play(body, [{ scale: '-1 1' }, { scale: '-1 1' }], tBack, R.warCapCarryS, 'none')

  // 그림 칸 — 걷기(4~11) · 칼질(12~17) · 서기(0) · 다시 걷기
  const stride = capturer.matches('.gmt') ? R.warRideStride : R.warWalkStride
  const cyclePx = Math.max(1, frame.offsetHeight) * stride
  const walkSteps = (dist: number): number => Math.min(96, Math.max(4, Math.round((dist / cyclePx) * 8)))
  const keys: Keyframe[] = []
  const put = (t: number, n: number): void => { keys.push({ backgroundPositionX: cell(n), offset: at(t, t0, span), easing: 'steps(1)' }) }
  const dist = Math.hypot(run.x, run.y)
  const outN = walkSteps(dist)
  const swing = t1 - 0.13
  for (let i = 0; i < outN; i++) put(t0 + ((swing - t0) * i) / outN, 4 + (i % 8))
  for (let i = 0; i < 6; i++) put(swing + 0.07 * i, 12 + i)
  put(swing + 0.42, 0)
  const backN = walkSteps(dist)
  for (let i = 0; i < backN; i++) put(tBack + (R.warCapCarryS * i) / backN, 4 + (i % 8))
  put(tHome, 0)
  keys[0] = { ...keys[0], offset: 0 }
  play(frame, keys, t0, span, 'none')

  // 쓰러진 적장 — 들어 올리는 순간 제자리에서 사라진다 (CSS 의 늦은 숨김보다 먼저 · 처음부터 이 시계가 쥔다)
  const total = tEnd + 0.1
  const lift = at(tLift, 0, total)
  play(target, [{ opacity: 1, offset: 0 }, { opacity: 1, offset: lift }, { opacity: 0, offset: lift }, { opacity: 0, offset: 1 }], 0, total, 'forwards')

  // 누운 적장 — 쓰러진 곳에서 머리 위로 · 장수와 같이 들썩이며 돌아와 · 땅에 내려앉는다
  const ck: Keyframe[] = [
    { opacity: 0, translate: px(fallen.x, fallen.y), rotate: '0deg', offset: 0 },
    { opacity: 0, translate: px(fallen.x, fallen.y), rotate: '0deg', offset: lift },
    { opacity: 1, translate: px(fallen.x, fallen.y), rotate: '0deg', offset: lift, easing: 'cubic-bezier(.3, 0, .3, 1)' },
    { opacity: 1, translate: px(head.x + run.x, head.y + run.y), rotate: '-6deg', offset: at(tBack, 0, total) },
  ]
  const bob = cr.height * R.warCapBob / sy
  const bobs = Math.max(2, Math.round(backN / 4)) * 2
  for (let i = 1; i <= bobs; i++) {
    const u = i / bobs
    const up = i % 2 === 1
    ck.push({ opacity: 1, translate: px(head.x + run.x * (1 - u), head.y + run.y * (1 - u) - (up ? bob : 0)), rotate: up ? '3deg' : '-4deg', offset: at(tBack + R.warCapCarryS * u, 0, total) })
  }
  ck[ck.length - 1] = { ...ck[ck.length - 1], easing: 'cubic-bezier(.5, 0, .9, .6)' }
  // 털썩 — 내려앉아 한 번 튄다
  ck.push({ opacity: 1, translate: px(0, 0), rotate: '0deg', offset: at(tEnd - 0.06, 0, total), easing: 'ease-out' })
  ck.push({ opacity: 1, translate: px(0, -bob * 0.6), rotate: '0deg', offset: at(tEnd + 0.02, 0, total), easing: 'ease-in' })
  ck.push({ opacity: 1, translate: px(0, 0), rotate: '0deg', offset: 1 })
  play(captive, ck, 0, total, 'forwards')

  const stop = (): void => {
    document.removeEventListener('visibilitychange', onVisibility)
    for (const a of anims) a.cancel()
    anims.length = 0
  }
  const onVisibility = (): void => { if (document.hidden) stop() }
  document.addEventListener('visibilitychange', onVisibility)
  return stop
}
