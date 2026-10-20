/**
 * 배우는 판의 차례 (형 2026-10-19: "맨 위 첫번째 할 게임은 1:1수준으로 여러 기능 익혀가며 쉽게 할수 있어야함. 짜여진대로.
 * 모든기능 하나씩 해볼 수 있게. 적 여장수 포획도 시도하고 이건 튜토리얼급이니 100% 성공하도록").
 *
 * 지금 눌러야 할 곳 **하나**만 밝고 나머지는 어둡다 — 그곳만 눌린다 (형 2026-10-20: "다음만 누르면 넘어가지는데? … 그걸 눌러야 진행되게.
 * 다음 이전 버튼 없어도 되겠다. 요즘게임은 … 눌러야 하는 부분, 봐야하는부분을 제외한곳을 어둡게" · "동시에 안눌리게 처리하기도 하지").
 * 그 일을 하면 다음 단계로 넘어간다. 넘어갔는지는 판 상태와 이번 계절 고른 명령 · 누른 단추로 판정한다 (화면의 일 — 엔진은 모른다).
 *
 * 단계마다 누를 곳을 **나중 것부터** 적는다 (press). 화면에 보이고 눌리는 첫 것이 지금 누를 곳이다 —
 * 징병 판이 열려 있으면 「뽑기」, 아니면 아래 「징병」 탭. 그곳이 보고판·판에 가려 있으면 그것을 닫는 단추를 먼저 가리킨다.
 * 찾지 못하면 어둡게 하지도 막지도 않는다 (갇히지 않게).
 */
import type { Order, Realm, Report } from '../../realm/types.ts'

export interface TutCtx {
  /** 지금 판 (이번 계절 고른 것을 먼저 해 본 판) */
  readonly r: Realm
  /** 이번 계절 고른 명령 전부 */
  readonly orders: readonly Order[]
  /** 지난 계절 보고 */
  readonly report: Report | null
  /** 이 판에서 누른 단추 (data-act) */
  readonly acts: ReadonlySet<string>
}

/** 누를 곳 — 선택자, 또는 [선택자, 이때만] */
export type Press = string | readonly [string, (c: TutCtx) => boolean]

export interface TutStep {
  readonly id: string
  /** 띠에 뜨는 말 — 무엇을 왜 */
  readonly text: string
  /** 누를 곳 — 나중에 누를 것부터 (보이는 첫 것을 가리킨다) */
  readonly press: readonly Press[]
  /** 전장 안에서 빛낼 곳 — 고를 것 · 고른 뒤 누를 것. 전장은 어둡게 막지 않고 빛만 낸다 (싸움은 제 손으로) */
  readonly war?: { readonly pick: string; readonly go: string }
  readonly done: (c: TutCtx) => boolean
}

const has = (c: TutCtx, k: Order['kind']): boolean => c.orders.some((o) => o.kind === k)
const marching = (c: TutCtx): boolean => has(c, 'march') || Object.values(c.r.armies).some((a) => a.faction === c.r.player && a.march !== null)
const FOE_HERO = 'guya-3'
const tab = (t: string): string => `[data-act="tab"][data-tab="${t}"]`

export const TUT_STEPS: readonly TutStep[] = [
  {
    id: 'look', text: '여기가 우리 골포국이다. 금빛 테두리 안이 우리 땅이다. 빛나는 「우리 땅」을 눌러 본다.',
    press: ['.homebtn'], done: (c) => c.acts.has('home'),
  },
  {
    id: 'draft', text: '「징병」을 열고 군사를 뽑는다. 집에서 사내를 뽑아 군대를 키운다.',
    press: ['[data-act="draft"]', tab('draft')], done: (c) => has(c, 'draft'),
  },
  {
    id: 'settle', text: '「백성」을 열고 빈땅 돌섬으로 집을 보낸다. 군사가 아니라 농사지을 집이다. 사람이 살면 새 마을이 된다.',
    press: ['[data-act="settle"][data-node="wild-dolseom"]', tab('people')], done: (c) => has(c, 'settle') || has(c, 'migrate'),
  },
  {
    id: 'scout', text: '오른쪽 봉황 마을을 누르고 「척후를 여기로 보낸다」. 적 군세가 얼마인지 보인다.',
    press: ['[data-act="scout"][data-node="guya-vil"]', '.nd[data-node="guya-vil"]'], done: (c) => has(c, 'scout'),
  },
  {
    id: 'envoy', text: '가락국에 「선물」 사신을 보낸다. 곡식을 조금 얹고 「사신을 보낸다」. 선물은 늘 받는다. 사신은 칠 나라와도 오간다.',
    press: [
      '.trade [data-act="envoy"]', '.trade [data-act="cq"][data-side="give"][data-res="grain"]:not([data-d^="-"])',
      '[data-act="compose"][data-ask="gift"]', '[data-act="compose-go"][data-ask="gift"]', '.nd[data-node="guya-vil"]',
    ],
    done: (c) => has(c, 'envoy'),
  },
  {
    id: 'rite', text: '안개골 위 「큰나무 소도」를 누르고 봄 제사를 지낸다. 가을에 거두는 곡식이 는다.',
    press: ['[data-act="rite"]', '.nd[data-node="sodo"]'], done: (c) => has(c, 'rite') || c.r.season > 0,
  },
  {
    id: 'next', text: '이제 「다음 계절」을 누른다. 고른 일이 한꺼번에 이루어지고 소식이 온다.',
    press: ['.next'], done: (c) => c.r.season >= 1,
  },
  {
    id: 'march', text: '갈대울의 우리 군대 말(장수 얼굴)을 누르고, 밝아진 봉황 마을을 누른다. 그리로 간다.',
    press: ['.nd[data-node="guya-vil"][data-act="go"]', '.tok[data-army="a-us"]'],
    done: (c) => has(c, 'march') || Object.values(c.r.armies).some((a) => a.faction === c.r.player && (a.march !== null || a.at === 'guya-vil')),
  },
  {
    id: 'battle', text: '「다음 계절」을 누르면 전장이 열린다. 합마다 명령을 하나 고른다. 여기선 「적장 사로잡기」를 골라 본다 — 이 판에선 반드시 잡힌다.',
    press: ['.next'], war: { pick: '[data-war="pick"][data-c="capture"]', go: '[data-war="go"]' },
    done: (c) => c.r.heroes[FOE_HERO]?.status === 'captive' || c.r.heroes[FOE_HERO]?.faction === c.r.player,
  },
  {
    id: 'persuade', text: '사로잡은 견지 쇠비를 우리 장수로 만든다. 「장수」에서 그 얼굴을 누르고 「회유한다」.',
    press: ['[data-act="persuade"]', `[data-act="hero"][data-id="${FOE_HERO}"]`, tab('heroes')],
    done: (c) => c.orders.some((o) => o.kind === 'persuade') || c.r.heroes[FOE_HERO]?.persuade !== undefined || c.r.heroes[FOE_HERO]?.faction === c.r.player,
  },
  {
    id: 'plot', text: '「외교」의 「공작」에서 가락국에 소문을 퍼뜨린다. 적 군사의 사기가 꺾인다.',
    press: ['[data-act="plot"][data-op="rumor"]', '[data-act="plot-open"][data-op="rumor"]', '[data-act="dmode"][data-v="plot"]', tab('diplo')],
    done: (c) => c.orders.some((o) => o.kind === 'plot'),
  },
  {
    id: 'win', text: '마지막이다. 군대를 가락 도읍으로 보내 쥐면 이 판을 이긴다.',
    press: [['.next', marching], '.nd[data-node="guya-cap"][data-act="go"]', '.tok[data-army="a-us"]', ['.next', () => true]],
    done: (c) => c.r.outcome?.kind === 'win',
  },
]

/** 지금 할 단계 — `from` 부터 이미 해낸 단계는 건너뛴다. 다 했으면 TUT_STEPS.length */
export function tutAt(from: number, c: TutCtx): number {
  let i = Math.max(0, from)
  while (i < TUT_STEPS.length && TUT_STEPS[i]!.done(c)) i++
  return i
}

/**
 * 지금 누를 곳 — 단계의 press 를 앞에서부터 보며 `ok`(화면에 있고 눌리는가)인 첫 선택자.
 * 화면 일(DOM)은 `ok` 로 받는다 — 시험에서는 가짜로 넣는다.
 */
export function tutPick(step: TutStep, c: TutCtx, ok: (sel: string) => boolean): string | null {
  for (const p of step.press) {
    const [sel, when] = typeof p === 'string' ? [p, null] : p
    if (when !== null && !when(c)) continue
    if (ok(sel)) return sel
  }
  return null
}

/** 전장 안에서만 빛낼 곳 — <style> 하나로 (전장은 다시 그려져도 그대로 빛난다) */
export function tutStyle(step: TutStep | undefined): string {
  if (step?.war === undefined) return ''
  const { pick, go } = step.war
  // 고르기 전엔 그 명령 카드, 고른 뒤엔 「북을 울린다」
  return `.ap .wr ${pick}:not(.on), .ap .wr:has(${pick}.on) ${go} { outline: 3px solid #ffd27a; outline-offset: 3px; animation: tutglow .9s ease-in-out infinite alternate; border-radius: 10px; }`
}

export function tutBandHtml(i: number, esc: (s: string) => string): string {
  if (i >= TUT_STEPS.length) {
    return `<div class="tutb done"><b>다 배웠다</b><span>이제 작은 판(변한 여섯 나라)이 열렸다. 처음 화면의 「새 판」에서 고른다.</span><button class="btn sm on" data-act="tut-end">처음으로</button></div>`
  }
  return `<div class="tutb"><i>${i + 1}/${TUT_STEPS.length}</i><span>${esc(TUT_STEPS[i]!.text)}</span></div>`
}

// ───────── 스포트라이트 — 누를 곳만 밝고, 그곳만 눌린다

/** 가려졌을 때 먼저 닫을 것 — 보고판의 「확인」 · 열린 판의 손잡이. 띠 위에 그 말이 한 줄 붙는다 (TUT_CSS 의 data-pre) */
const DISMISS: ReadonlyArray<readonly [string, string]> = [['.modal [data-act="rep-close"]', 'rep'], ['.sheet .grip', 'grip']]

export interface Spot {
  /** 지금 단계와 판 — 없으면 끈다 */
  set(step: TutStep | undefined, c: TutCtx | null): void
}

/**
 * 볼 곳에 구멍 뚫린 어둠 · 누를 곳에 숨 쉬는 고리와 가리키는 손. 볼 곳(과 배우기 띠) 밖의 누르기는 먹지 않는다.
 * 볼 곳은 누를 곳을 품은 카드 — 보고판이면 보고판 통째(읽어야 하니까), 판 속 단추면 그 카드, 아니면 누를 곳 그 자체
 * (형: "눌러야 하는 부분, 봐야하는부분을 제외한곳을 어둡게").
 * 자리는 그림틀(rAF)마다 다시 잰다 — 판이 미끄러져 열리거나 지도를 끌어도 따라간다. 숨은 탭에서는 rAF 가 서므로 돌지 않는다 (규칙 4).
 * 전장이 열린 동안은 끈다 (싸움은 제 손으로 — 사로잡기 단추만 tutStyle 로 빛난다).
 */
export function createSpot(root: HTMLElement): Spot {
  const hole = document.createElement('div')
  hole.className = 'tutspot'
  hole.hidden = true
  const box = document.createElement('div')
  box.className = 'tutring'
  box.innerHTML = '<i class="ring"></i><i class="hand"></i>'
  box.hidden = true
  root.append(hole, box)
  const band = (): HTMLElement | null => root.querySelector<HTMLElement>('.tutband')
  let step: TutStep | undefined
  let ctx: TutCtx | null = null
  let target: HTMLElement | null = null
  /** 볼 곳 — 누를 곳을 품은 카드 */
  let view: HTMLElement | null = null
  let scrolled: HTMLElement | null = null
  /** 지금 가리키는 것이 닫기 단추면 그 갈래 ('' 이면 단계의 누를 곳) */
  let pre = ''
  let raf = 0
  let last = ''

  const shown = (el: HTMLElement): boolean => {
    if ((el as HTMLButtonElement).disabled) return false
    const b = el.getBoundingClientRect()
    return b.width > 1 && b.height > 1 && getComputedStyle(el).visibility !== 'hidden'
  }
  const first = (sel: string): HTMLElement | null => [...root.querySelectorAll<HTMLElement>(sel)].find(shown) ?? null
  /** 그 자리 한가운데에서 맨 위에 있는 것이 그것인가 (보고판·판에 가리지 않았나) */
  const onTop = (el: HTMLElement): boolean => {
    const b = el.getBoundingClientRect()
    const x = Math.min(innerWidth - 1, Math.max(0, b.left + b.width / 2))
    const y = Math.min(innerHeight - 1, Math.max(0, b.top + b.height / 2))
    if (x < b.left || x > b.right || y < b.top || y > b.bottom) return true // 화면 밖 — 가린 게 아니라 굴려 보일 것
    const hit = document.elementFromPoint(x, y)
    return hit === null || el.contains(hit) || hit.closest('.tutband') !== null
  }
  /** 판·지도의 굴리는 틀 밖으로 나가 있나 */
  const scrolledOut = (el: HTMLElement): boolean => {
    const wrap = el.closest<HTMLElement>('.mapwrap, .sheet')
    if (wrap === null) return false
    const r0 = el.getBoundingClientRect()
    const w0 = wrap.getBoundingClientRect()
    return r0.top < w0.top || r0.bottom > w0.bottom || r0.left < w0.left || r0.right > w0.right
  }
  const war = (): boolean => root.classList.contains('war-open') || root.querySelector('.wr') !== null

  function pick(): HTMLElement | null {
    if (step === undefined || ctx === null || war()) return null
    const sel = tutPick(step, ctx, (s) => first(s) !== null)
    const el = sel !== null ? first(sel) : null
    pre = ''
    // 판·지도 안에서 굴러 나가 안 보이는 것은 가린 게 아니다 — 굴려 보인다 (frame). 닫으라고 하면 폰에서 열고 닫기를 되풀이했다
    if (el !== null && (onTop(el) || scrolledOut(el))) return el
    // 가려졌거나(보고판 · 판) 못 찾았으면 — 닫는 단추가 보이면 그것부터
    for (const [d, k] of DISMISS) {
      const x = first(d)
      if (x !== null && onTop(x)) {
        pre = k
        return x
      }
    }
    return el
  }

  function frame(): void {
    raf = 0
    target = pick()
    const b = band()
    if (b !== null && (b.dataset['pre'] ?? '') !== pre) b.dataset['pre'] = pre
    if (target === null) {
      view = null
      box.hidden = true
      hole.hidden = true
      if (b !== null) b.style.cssText = ''
      last = ''
    } else {
      view = target.closest<HTMLElement>('.mcard, .ncard') ?? target
      // 지도·판 안에서 다 안 보이면(반쯤 윗줄에 묻힌 고을도) 한 번만 굴려 가운데로 (그 뒤엔 지도를 끌어도 따라가기만)
      if (scrolled !== target) {
        scrolled = target
        if (target.closest('.mapwrap, .sheet') !== null && (scrolledOut(target) || !onTop(target))) target.scrollIntoView({ block: 'center', inline: 'center' }) // 윗줄·띠에 묻혀도
      }
      const r = target.getBoundingClientRect()
      const v = view.getBoundingClientRect()
      const pad = 6
      const at = (x: DOMRect, p: number): string => `left:${x.left - p}px;top:${x.top - p}px;width:${x.width + p * 2}px;height:${x.height + p * 2}px;--rad:${Math.min(18, (Math.min(x.width, x.height) + p * 2) / 2)}px`
      const key = [r.left, r.top, r.width, r.height, v.left, v.top, v.width, v.height, innerWidth, innerHeight].map(Math.round).join(',')
      if (key !== last) {
        last = key
        box.hidden = false
        hole.hidden = false
        const below = r.top + r.height / 2 < innerHeight * 0.55 // 누를 곳이 위쪽이면 손은 그 밑에
        box.style.cssText = at(r, pad)
        box.classList.toggle('up', !below)
        hole.style.cssText = at(v, view === target ? pad : 2)
        if (b !== null) {
          // 띠는 볼 곳을 가리지 않게 — 볼 곳 밑(또는 위)에, 누를 곳의 손 그림 틈만큼 띄워
          // 자리가 없으면(보고판처럼 큰 카드) 누를 곳의 반대쪽 화면 끝에
          const gap = view === target ? 58 : 14
          const need = 110
          const roomBelow = innerHeight - v.bottom - pad - gap
          const roomAbove = v.top - pad - gap
          const prefBelow = v.top + v.height / 2 < innerHeight * 0.55
          b.style.cssText = prefBelow && roomBelow >= need ? `top:${v.bottom + pad + gap}px;bottom:auto`
            : roomAbove >= need ? `top:auto;bottom:${innerHeight - v.top + pad + gap}px`
              : roomBelow >= need ? `top:${v.bottom + pad + gap}px;bottom:auto`
                : below ? `top:auto;bottom:12px` : `top:12px;bottom:auto`
        }
      }
    }
    if (step !== undefined) raf = requestAnimationFrame(frame)
  }

  // 누를 곳(과 배우기 띠, 지도 확대·축소) 밖의 누르기는 먹지 않는다 — 앱이 듣기 전에 (잡기 단계)
  document.addEventListener('click', (ev) => {
    if (target === null || view === null || box.hidden || !target.isConnected) return
    const t = ev.target as HTMLElement
    if (view.contains(t) || t.closest('.tutband') !== null || t.closest('[data-act="zin"], [data-act="zout"]') !== null) return
    ev.preventDefault()
    ev.stopPropagation()
    // 엉뚱한 데를 누르면 고리가 한 번 크게 뛴다 — 여기를 누르라고
    box.classList.remove('nudge')
    void box.offsetWidth
    box.classList.add('nudge')
  }, true)

  return {
    set(s, c) {
      step = s
      ctx = c
      if (s === undefined) {
        if (raf !== 0) cancelAnimationFrame(raf)
        raf = 0
        target = null
        view = null
        box.hidden = true
        hole.hidden = true
        last = ''
        const b = band()
        if (b !== null) b.style.cssText = ''
        return
      }
      if (raf === 0) raf = requestAnimationFrame(frame)
    },
  }
}

export const TUT_CSS = `
.ap .tutband { position: absolute; left: 8px; right: 8px; top: calc(var(--toph) + var(--legh) + 6px); z-index: 96; pointer-events: none; display: flex; justify-content: center; }
.ap .tutband:empty { display: none; }
/* 전장이 열린 동안은 띠를 숨긴다 — 싸움에 집중 (전투 쪽이 다는 war-open, 아니면 전장 DOM 으로) */
.ap.war-open .tutband, .ap:has(.wr) .tutband { display: none; }
.tutb { pointer-events: auto; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; max-width: 560px; padding: 10px 14px; border-radius: 14px;
  background: #1b2028f8; border: 1px solid #e8c06a; box-shadow: 0 6px 24px #000d; color: #f3ead8; font-size: 15px; line-height: 1.5; }
.tutb i { font-style: normal; color: #f3d48a; font-weight: 700; font-size: 12.5px; } .tutb > span { flex: 1 1 260px; }
.tutb.done b { color: #9fd18b; }
/* 먼저 닫을 것을 가리킬 때 — 띠 맨 위에 한 줄 */
.tutband[data-pre="rep"] .tutb::before, .tutband[data-pre="grip"] .tutb::before { flex: 1 0 100%; color: #ffd27a; font-weight: 700; font-size: 13.5px; }
.tutband[data-pre="rep"] .tutb::before { content: '먼저 소식을 읽고 「확인」을 누른다'; }
.tutband[data-pre="grip"] .tutb::before { content: '먼저 열린 판을 닫는다 — 위의 손잡이를 누른다'; }
@keyframes tutglow { from { box-shadow: 0 0 4px #ffd27a66; } to { box-shadow: 0 0 18px #ffd27a; } }
/* 스포트라이트 — 구멍 밖은 어둡다. 구멍은 누를 곳 크기, 둘레에 숨 쉬는 금빛 고리, 그 밑(또는 위)에서 손이 콕콕 가리킨다 */
/* 자리는 미끄러지지 않고 바로 붙는다 — 판이 굴러갈 때 고리가 뒤처지면 엉뚱한 데를 누르게 된다 */
.ap .tutspot { position: fixed; z-index: 95; pointer-events: none; border-radius: var(--rad, 14px); box-shadow: 0 0 0 200vmax #000000a8; }
.ap .tutring { position: fixed; z-index: 95; pointer-events: none; border-radius: var(--rad, 14px); }
.ap .tutspot[hidden], .ap .tutring[hidden] { display: none; }
.ap .tutring .ring { position: absolute; inset: -3px; border-radius: inherit; border: 3px solid #ffd27a; box-shadow: 0 0 16px #ffd27a, inset 0 0 10px #ffd27a88;
  animation: tutring 1s ease-in-out infinite; }
.ap .tutring .ring::after { content: ''; position: absolute; inset: -3px; border-radius: inherit; border: 2px solid #ffd27a; animation: tutwave 1.4s ease-out infinite; }
.ap .tutring .hand { position: absolute; left: 50%; top: 100%; width: 40px; height: 40px; margin: 8px 0 0 -20px; font-style: normal; font-size: 34px; line-height: 40px; text-align: center;
  filter: drop-shadow(0 2px 3px #000); animation: tuthand .8s ease-in-out infinite alternate; }
.ap .tutring .hand::before { content: '👆'; }
.ap .tutring.up .hand { top: auto; bottom: 100%; margin: 0 0 8px -20px; } .ap .tutring.up .hand::before { content: '👇'; }
.ap .tutring.up .hand { animation-name: tuthandup; }
.ap .tutring.nudge .ring { animation: tutnudge .45s ease-out; }
@keyframes tutring { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.06); opacity: .8; } }
@keyframes tutwave { from { transform: scale(1); opacity: .9; } to { transform: scale(1.35); opacity: 0; } }
@keyframes tuthand { from { transform: translateY(6px); } to { transform: translateY(-4px); } }
@keyframes tuthandup { from { transform: translateY(-6px); } to { transform: translateY(4px); } }
@keyframes tutnudge { 0% { transform: scale(1); } 40% { transform: scale(1.25); border-color: #fff3c8; } 100% { transform: scale(1); } }
@media (prefers-reduced-motion: reduce) { .ap .tutring .ring, .ap .tutring .ring::after, .ap .tutring .hand { animation: none; } }
`
