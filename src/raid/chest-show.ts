/**
 * 열전 보물 상자 연출 (60-JACKPOT · docs/realm/RAID-REWARD-MAP-20261122.md §3-1 · 형 11-22: 「다이센카는 보물상자 연출이 난리」).
 *
 * 화면만 한다. 판의 셈은 상자를 주운 그 걸음에 이미 끝났고(haebi.ts openJackpot), 여기서는 그 결과를 보여 주는 동안 판을 세워 둘 뿐이다 (레벨업 카드 창과 같다).
 *  - 상자가 가운데로 와 들썩이고 → 뚜껑이 터지며 빛이 솟는다. **빛 색이 개수를 먼저 알린다** (본편 유물 상자의 흔함·귀함·보배 + 대박 보라).
 *  - 룬이 하나씩 솟아 HUD 칸에 박힌다 (raid/pick-fly.ts) · 박힐 때마다 북이 한 음씩 오른다 · 새로 연 조합은 룬 둘이 합쳐져 금테가 된다.
 *  - 엽전은 낱낱이 터진다 (덩어리 그림을 통째로 밀지 않는다).
 *  - 8개(대박): 화면이 멎고 소리가 끊긴다. 「눌러!」 단추가 흔들린다. 누르면(안 눌러도 pushSeconds 뒤) 터진다.
 *  - 누르면 끝 결과로 건너뛴다 (나온 룬이 모두 줄에 선 채 skipHold 초 · 한 번 더 누르면 닫힘).
 * 연출 위에 글은 없다 (「눌러!」 하나뿐 · 메모리 no-effect-captions).
 * 시계는 화면의 틀(rAF)이 밀어 준다 (advance) — 타이머를 따로 돌리지 않는다. 가려진 탭에서는 틀이 안 돌므로 연출도 멈춘다.
 * 저사양: 엽전 수를 줄이고 · 화면 가장자리 빛과 빛의 크기 애니를 뺀다 (폰 GPU). 숫자는 모두 src/tune/params.ts HAEBI_JACKPOT.view.
 */
import { HAEBI_JACKPOT as JP, UI_FLY } from '../tune/params.ts'

export type ShowCfg = typeof JP.view
export type ShowEvent =
  | { readonly at: number; readonly kind: 'shake'; readonly index: number }
  | { readonly at: number; readonly kind: 'freeze' }
  | { readonly at: number; readonly kind: 'burst' }
  | { readonly at: number; readonly kind: 'rune'; readonly index: number; readonly merge: boolean }
  | { readonly at: number; readonly kind: 'fly'; readonly index: number }
  | { readonly at: number; readonly kind: 'end' }
/** tier 단계 번호(0~3) · total 끝나는 때(초 · 대박의 「눌러!」 기다림은 빼고) · burstAt 뚜껑이 터지는 때 · freeze 대박(멎음)인가 */
export interface ShowPlan { readonly tier: number; readonly total: number; readonly burstAt: number; readonly freeze: boolean; readonly events: readonly ShowEvent[] }

/** 그 개수의 단계 번호 — 표에 없는 수는 그보다 작은 가장 큰 단계 */
export function showTier(count: number): number {
  let tier = 0
  for (let i = 0; i < JP.counts.length; i++) if (JP.counts[i]! <= count) tier = i
  return tier
}
/** 룬이 HUD 칸에 닿기까지 (pick-fly 의 솟기 + 날기) */
const landSeconds = (UI_FLY.popMs + UI_FLY.flyMs) / 1000

/**
 * 연출 차례표 — 순수한 셈 (시험이 잰다). count 상자 단계(1·3·5·8) · runes 실제로 오른 칸 수(올릴 것이 없어 엽전이 된 몫은 뺀 수) · merges 새로 연 조합의 차례 번호.
 * 들썩임(빨라진다) → [대박이면 멎음] → 터짐 → 룬이 고른 틈으로 솟고(rune) 잠깐 머문 뒤 날아간다(fly) → 끝. 길이는 단계마다 seconds.
 */
export function chestShowPlan(count: number, runes: number, merges: readonly number[] = [], v: ShowCfg = JP.view): ShowPlan {
  const tier = showTier(count), freeze = tier === JP.counts.length - 1, events: ShowEvent[] = []
  let t: number = v.enter
  const shakeAt: number[] = []
  for (let k = 0; k < v.shakes; k++) {
    shakeAt.push(t); events.push({ at: t, kind: 'shake', index: k })
    t += v.shakeGap[0] + (v.shakeGap[1] - v.shakeGap[0]) * (v.shakes > 1 ? k / (v.shakes - 1) : 0)
  }
  const burstAt = t
  if (freeze) events.push({ at: (shakeAt[Math.min(v.freezeAt, shakeAt.length - 1)] ?? burstAt) + v.freezeLag, kind: 'freeze' })
  events.push({ at: burstAt, kind: 'burst' })
  const hold = (i: number) => v.runeHold + (merges.includes(i) ? v.mergeSeconds : 0)
  const first = burstAt + v.burstHold, lastStart = v.seconds[tier]! - v.tail - landSeconds - hold(runes - 1)
  const gap = runes > 1 ? Math.max(v.runeGapMin, (lastStart - first) / (runes - 1)) : 0
  let done = burstAt + v.burstHold
  for (let i = 0; i < runes; i++) {
    const at = first + gap * i
    events.push({ at, kind: 'rune', index: i, merge: merges.includes(i) }, { at: at + hold(i), kind: 'fly', index: i })
    done = at + hold(i) + landSeconds
  }
  const total = Math.max(v.seconds[tier]!, done + v.tail)
  events.push({ at: total, kind: 'end' })
  // 같은 때의 일은 넣은 차례 그대로 (sort 는 안정적이다)
  events.sort((a, b) => a.at - b.at)
  return { tier, total, burstAt, freeze, events }
}

/** 엽전 한 알 — 옆으로 dx · 위로 rise 솟았다가 fall 만큼 떨어진다 · 크기 · 시간 · 도는 각 (늘 같은 꼴 · 황금각으로 고르게) */
export interface CoinSpec { readonly dx: number; readonly rise: number; readonly fall: number; readonly size: number; readonly ms: number; readonly spin: number }
const frac = (n: number) => n - Math.floor(n)
const PHI = (Math.sqrt(5) - 1) / 2
export function coinSpecs(n: number, v: ShowCfg = JP.view): CoinSpec[] {
  const out: CoinSpec[] = []
  for (let i = 0; i < n; i++) {
    const a = frac(i * PHI), b = frac(i * PHI * 2 + .37), c = frac(i * PHI * 3 + .71)
    out.push({ dx: (a * 2 - 1) * v.coinSpread, rise: v.coinRise * (.55 + .45 * b), fall: v.coinFall * (.6 + .4 * c), size: v.coinSize[0] + (v.coinSize[1] - v.coinSize[0]) * c, ms: v.coinMs[0] + (v.coinMs[1] - v.coinMs[0]) * b, spin: (a - .5) * 720 })
  }
  return out
}
/** 이 단계 · 이 그래픽에서 터지는 엽전 알 수 */
export const coinCount = (tier: number, low: boolean, v: ShowCfg = JP.view): number => Math.max(1, Math.round(v.coins[tier]! * (low ? v.lowCoins : 1)))

/** 연출이 보여 줄 것 — 판이 적어 둔 상자 결과 그대로 */
export interface ShowInput { readonly count: number; readonly picks: readonly string[]; readonly opened: readonly string[] }
export interface ShowHooks {
  /** 그림 주소의 앞머리 (…/realm/raid/) */
  readonly art: string
  /** 룬 그림 (img 태그) */
  icon(pick: string): string
  /** 그 룬의 갈래 빛깔 (불티 · 고리) */
  color(pick: string): string
  /** 조합인가 (금테) */
  combo(pick: string): boolean
  /** 새로 연 조합이 합쳐지기 전의 룬들 (그 조합의 재료) */
  parts(combo: string): readonly string[]
  /** 솟은 룬이 HUD 칸으로 날아간다 · step 몇 번째 룬(북 높이) */
  fly(holder: HTMLElement, pick: string, step: number): void
  /** 들썩일 때 북 */
  shake(step: number): void
  /** 뚜껑이 터질 때 그 단계의 곡 */
  burst(tier: number): void
  /** 대박이 멎을 때 */
  freeze(): void
  /** 저사양인가 */
  low(): boolean
  /** 「눌러!」 */
  label(): string
  /** 걷혔다 */
  done(): void
}

const COMBO_GOLD = '#f2c45a'
/**
 * 미리 그려 둘 꼴 (raid/warm-dom.ts · 출전 화면에서 한 번) — 터진 상자 · 빛 · 룬 · 엽전 · 결과 줄 · 「눌러!」가 다 든 대박 판 한 장.
 * 처음 터질 때 치를 값(꼴 셈 · 그림 풀기 · 칠하기)을 출전 화면에서 미리 치러, 상자를 주운 틀이 끊기지 않게 한다
 */
export const chestShowWarmHtml = (art: string, icon: string, label: string, v: ShowCfg = JP.view): string => {
  const tier = JP.counts.length - 1
  return `<div id="chest-show" class="t${tier} open" style="position:absolute;--cs-c:${v.colors[tier]};--cs-size:${v.chest}px;--cs-rune:${v.rune}px;--cs-dim:${v.dim};--cs-glow:${v.glow};--cs-push:${v.pushPx}px"><i class="cs-dim"></i><i class="cs-edge" style="opacity:1"></i><div class="cs-stage"><i class="cs-glow"></i><img class="cs-chest" src="${art}chest-open.png" alt=""><img class="cs-chest" src="${art}chest.png" alt="" style="position:absolute;inset:0"><div class="cs-runes"><div class="cs-r combo"><span class="rune">${icon}</span></div></div><i class="cs-coin" style="width:${v.coinSize[1]}px;height:${v.coinSize[1]}px"></i></div><div class="cs-row"><div class="cs-r"><span class="rune">${icon}</span></div></div><button class="cs-push">${label}</button></div>`
}

export class ChestShow {
  private plan: ShowPlan | null = null
  private input: ShowInput | null = null
  private el: HTMLElement | null = null
  private clock = 0
  private cursor = 0
  private frozen = false
  private frozenFor = 0
  private skipped = false
  private burst = false
  private low = false
  private coinsLeft: CoinSpec[] = []
  private coinAt = 0
  private holders = new Map<number, HTMLElement>()
  private rowed = new Set<number>()
  private readonly host: HTMLElement
  private readonly hooks: ShowHooks
  private readonly v: ShowCfg
  constructor(host: HTMLElement, hooks: ShowHooks, v: ShowCfg = JP.view) { this.host = host; this.hooks = hooks; this.v = v }

  get active(): boolean { return this.plan !== null }
  /** 대박이 멎어 「눌러!」를 기다리는 중 */
  get waiting(): boolean { return this.frozen }
  get tier(): number { return this.plan?.tier ?? -1 }
  get elapsed(): number { return this.clock }

  start(input: ShowInput): void {
    if (this.plan) this.finish()
    const merges = input.picks.flatMap((p, i) => input.opened.includes(p) && input.picks.indexOf(p) === i ? [i] : [])
    this.plan = chestShowPlan(input.count, input.picks.length, merges, this.v); this.input = input
    this.clock = 0; this.cursor = 0; this.frozen = false; this.frozenFor = 0; this.skipped = false; this.burst = false; this.coinsLeft = []; this.holders.clear(); this.rowed.clear()
    this.low = this.hooks.low()
    const doc = this.host.ownerDocument, win = doc.defaultView, v = this.v, tier = this.plan.tier
    const short = win ? Math.min(win.innerWidth, win.innerHeight) : v.chest / v.chestShare
    const size = Math.round(Math.min(v.chest, short * v.chestShare))
    const el = this.el = doc.createElement('div')
    el.id = 'chest-show'; el.className = `t${tier}${this.low ? ' low' : ''}`
    el.style.cssText = `--cs-c:${v.colors[tier]};--cs-size:${size}px;--cs-rune:${Math.round(v.rune * size / v.chest)}px;--cs-dim:${v.dim};--cs-glow:${this.low ? v.glowLow : v.glow};--cs-push:${v.pushPx}px`
    el.innerHTML = `<i class="cs-dim" aria-hidden="true"></i>${tier >= 2 && !this.low ? '<i class="cs-edge" aria-hidden="true"></i>' : ''}<div class="cs-stage" aria-hidden="true"><i class="cs-glow"></i><img class="cs-chest" src="${this.hooks.art}chest.png" alt="" draggable="false"><div class="cs-runes"></div></div><div class="cs-row" aria-hidden="true"></div>${this.plan.freeze ? `<button class="cs-push" hidden>${this.hooks.label()}</button>` : ''}`
    this.host.appendChild(el)
    // 터진 그림을 미리 받아 둔다 (터지는 틀에 그림을 푸느라 끊기지 않게)
    const open = doc.createElement('img'); open.src = this.hooks.art + 'chest-open.png'; void open.decode?.().catch(() => undefined)
    const chest = this.q('.cs-chest')
    if (!this.low) this.q('.cs-dim')?.animate([{ opacity: 0 }, { opacity: v.dim }], { duration: v.enter * 1000, easing: 'ease-out' })
    chest?.animate([{ transform: `translateY(${-v.enterDrop}px) scale(.35)`, opacity: 0 }, { transform: 'translateY(6px) scale(1.08)', opacity: 1, offset: .7 }, { transform: 'none', opacity: 1 }], { duration: v.enter * 1000, easing: 'ease-out', fill: 'backwards' })
  }

  /** 화면의 틀마다 — dt 진짜 지난 초 (가려진 탭에서는 불리지 않는다) */
  advance(dt: number): void {
    const plan = this.plan; if (!plan) return
    if (this.frozen) { this.frozenFor += dt; if (this.frozenFor >= this.v.pushSeconds) this.push(); return }
    this.clock += dt
    while (this.plan === plan && !this.frozen && this.cursor < plan.events.length && plan.events[this.cursor]!.at <= this.clock) this.fire(plan.events[this.cursor++]!)
    if (this.plan === plan && this.coinsLeft.length && this.clock >= this.coinAt) this.coinWave()
  }

  /**
   * 누름 · 아무 키 — 멎어 있으면 「눌러!」를 누른 것 · 아니면 끝 결과로 건너뛰고 · 한 번 더면 닫는다.
   * 막 열렸을 때의 누름은 버린다 (skipGuard · 싸우던 손이 그대로 눌러 연출을 못 보고 넘기지 않게 · 「눌러!」도 뜨자마자는 pushGuard 동안 안 눌린다)
   */
  skip(): void {
    const plan = this.plan; if (!plan) return
    if (this.frozen) { if (this.frozenFor >= this.v.pushGuard) this.push(); return }
    if (this.skipped) { this.close(); return }
    if (this.clock < this.v.skipGuard) return
    this.skipped = true
    this.q('.cs-push')?.remove()
    this.settle()
    this.coinsLeft = []
    if (!this.burst) this.open(false)
    // 아직 안 날아간 룬은 날리지 않고 결과 줄에 세운다
    for (const h of this.holders.values()) h.remove()
    this.holders.clear()
    for (let i = 0; i < (this.input?.picks.length ?? 0); i++) this.toRow(i)
    this.cursor = plan.events.length - 1; this.clock = plan.total - this.v.skipHold
  }

  /** 곧바로 걷는다 (판이 바뀜 · 탭이 가려짐 · 창이 뒤로 감) */
  finish(): void { if (this.plan) this.close() }

  private q<T extends HTMLElement = HTMLElement>(sel: string): T | null { return this.el?.querySelector<T>(sel) ?? null }
  /** 돌던 애니를 모두 끝 꼴로 (끝없이 도는 것은 못 끝내니 지운다) */
  private settle(): void { for (const a of this.el?.getAnimations({ subtree: true }) ?? []) { try { a.finish() } catch { a.cancel() } } }

  private fire(e: ShowEvent): void {
    const v = this.v
    if (e.kind === 'shake') {
      this.hooks.shake(e.index)
      const k = 1 + e.index * v.shakeGrow
      this.q('.cs-chest')?.animate([
        { transform: 'none' }, { transform: `translateY(${-v.shakePx * k}px) rotate(${-v.shakeDeg * k}deg)`, offset: .25 }, { transform: `translateY(0) rotate(${v.shakeDeg * k}deg)`, offset: .55 },
        { transform: `translateY(${-v.shakePx * k * .4}px) rotate(${-v.shakeDeg * k * .5}deg)`, offset: .8 }, { transform: 'none' },
      ], { duration: v.shakeMs, easing: 'ease-in-out' })
    } else if (e.kind === 'freeze') {
      // 화면이 멎는다 — 들썩이던 상자가 그 꼴로 서고 「눌러!」가 뜬다
      this.frozen = true; this.frozenFor = 0
      for (const a of this.el?.getAnimations({ subtree: true }) ?? []) a.pause()
      this.el?.classList.add('frozen')
      const push = this.q<HTMLButtonElement>('.cs-push'); if (push) { push.hidden = false; push.focus({ preventScroll: true }) }
      this.hooks.freeze()
    } else if (e.kind === 'burst') this.open(true)
    else if (e.kind === 'rune') this.rune(e.index, e.merge)
    else if (e.kind === 'fly') {
      const h = this.holders.get(e.index), pick = this.input?.picks[e.index]
      if (h && pick !== undefined) { this.holders.delete(e.index); this.hooks.fly(h, pick, e.index); h.remove(); this.toRow(e.index) }
    } else this.close()
  }

  /** 「눌러!」 — 멎음이 풀리고 곧바로 터진다 */
  private push(): void {
    const plan = this.plan; if (!plan || !this.frozen) return
    this.frozen = false
    this.el?.classList.remove('frozen')
    this.q('.cs-push')?.remove()
    this.settle()
    this.clock = plan.burstAt; this.cursor = plan.events.findIndex(x => x.kind === 'burst')
    this.fire(plan.events[this.cursor++]!)
  }

  /** 뚜껑이 터진다 — 빛 색이 개수를 알린다 · loud 면 곡과 엽전도 (건너뛸 때는 조용히 꼴만) */
  private open(loud: boolean): void {
    const plan = this.plan!, v = this.v
    this.burst = true
    this.el?.classList.add('open')
    const chest = this.q<HTMLImageElement>('.cs-chest'); if (chest) chest.src = this.hooks.art + 'chest-open.png'
    if (!loud) return
    this.hooks.burst(plan.tier)
    chest?.animate([{ transform: `scale(${v.burstPop})` }, { transform: 'scale(.94)', offset: .6 }, { transform: 'none' }], { duration: v.burstMs, easing: 'ease-out' })
    const glow = this.q('.cs-glow')
    // 저사양은 빛이 커지는 애니 없이 켜지기만 한다 (넓은 transform 금지)
    if (glow) glow.animate(this.low ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: 'scale(.35)' }, { opacity: 1, transform: 'scale(1.12)', offset: .35 }, { opacity: .85, transform: 'scale(1)' }], { duration: v.glowMs, easing: 'ease-out' })
    this.q('.cs-edge')?.animate([{ opacity: 0 }, { opacity: 1, offset: .25 }, { opacity: .5 }], { duration: v.edgeMs, easing: 'ease-out', fill: 'forwards' })
    this.coinsLeft = coinSpecs(coinCount(plan.tier, this.low, v), v); this.coinAt = this.clock
    this.coinWave()
  }

  /** 엽전 한 물결 — 낱낱이 솟았다 떨어진다 */
  private coinWave(): void {
    const stage = this.q('.cs-stage'), v = this.v; if (!stage) { this.coinsLeft = []; return }
    const doc = stage.ownerDocument
    for (const c of this.coinsLeft.splice(0, v.coinWave)) {
      const coin = doc.createElement('i'); coin.className = 'cs-coin'; coin.style.cssText = `width:${c.size.toFixed(0)}px;height:${c.size.toFixed(0)}px`
      stage.appendChild(coin)
      const a = coin.animate([
        { transform: 'translate(0,0) scale(.4) rotate(0deg)', opacity: 1 },
        { transform: `translate(${(c.dx * .6).toFixed(1)}px,${(-c.rise).toFixed(1)}px) scale(1) rotate(${(c.spin * .5).toFixed(0)}deg)`, opacity: 1, offset: .45, easing: 'ease-in' },
        { transform: `translate(${c.dx.toFixed(1)}px,${(c.fall - c.rise * .2).toFixed(1)}px) scale(.85) rotate(${c.spin.toFixed(0)}deg)`, opacity: 0 },
      ], { duration: c.ms, easing: 'ease-out', fill: 'forwards' })
      a.onfinish = () => coin.remove()
    }
    this.coinAt = this.clock + v.coinGap / 1000
  }

  private holder(pick: string): HTMLElement {
    const h = this.host.ownerDocument.createElement('div'), combo = this.hooks.combo(pick)
    h.className = `cs-r${combo ? ' combo' : ''}`; h.style.setProperty('--c', combo ? COMBO_GOLD : this.hooks.color(pick))
    h.innerHTML = `<span class="rune">${this.hooks.icon(pick)}</span>`
    return h
  }

  /** 룬 하나가 상자에서 솟는다 — 새로 연 조합이면 재료 룬 둘이 양쪽에서 와 합쳐진 뒤 금테로 */
  private rune(index: number, merge: boolean): void {
    const pick = this.input?.picks[index], box = this.q('.cs-runes'); if (pick === undefined || !box) return
    const v = this.v, h = this.holder(pick)
    box.appendChild(h); this.holders.set(index, h)
    const rise = [{ transform: 'translateY(60%) scale(.3)', opacity: 0 }, { transform: 'translateY(-8%) scale(1.2)', opacity: 1, offset: .65 }, { transform: 'none', opacity: 1 }]
    const parts = merge ? this.hooks.parts(pick).slice(0, 2) : []
    if (parts.length < 2) { h.animate(rise, { duration: v.runeMs, easing: 'ease-out', fill: 'backwards' }); return }
    const ms = v.mergeSeconds * 1000
    // 재료 둘이 양쪽에서 모여 한가운데서 겹치고, 그 자리에서 금테 조합이 튀어나온다
    parts.forEach((p, i) => {
      const part = this.holder(p), dir = i ? 1 : -1
      part.classList.add('part'); box.appendChild(part)
      const far = dir * v.mergeFrom * 100
      const a = part.animate([
        { transform: `translate(${far}%,30%) scale(.5)`, opacity: 0 }, { transform: `translate(${far * .9}%,0) scale(1)`, opacity: 1, offset: .3 },
        { transform: `translate(${far * .8}%,0) scale(1)`, opacity: 1, offset: .55 }, { transform: 'translate(0,0) scale(.7)', opacity: .9 },
      ], { duration: ms, easing: 'ease-in', fill: 'forwards' })
      a.onfinish = () => part.remove()
    })
    h.animate([{ transform: 'scale(.2)', opacity: 0 }, { transform: 'scale(1.45)', opacity: 1, offset: .55 }, { transform: 'none', opacity: 1 }], { duration: v.runeMs, delay: ms, easing: 'ease-out', fill: 'backwards' })
  }

  /** 결과 줄에 작은 그림으로 남긴다 (무엇이 나왔는지 끝까지 보인다) */
  private toRow(index: number): void {
    const pick = this.input?.picks[index], row = this.q('.cs-row'); if (pick === undefined || !row || this.rowed.has(index)) return
    this.rowed.add(index)
    const cell = this.holder(pick); cell.classList.add('got'); row.appendChild(cell)
    if (!this.skipped) cell.animate([{ transform: 'scale(.4)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: this.v.rowMs, easing: 'ease-out' })
  }

  private close(): void {
    const el = this.el
    this.plan = null; this.input = null; this.el = null; this.frozen = false; this.coinsLeft = []; this.holders.clear()
    el?.remove()
    this.hooks.done()
  }
}
