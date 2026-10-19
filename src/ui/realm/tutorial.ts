/**
 * 배우는 판의 차례 (형 2026-10-19: "맨 위 첫번째 할 게임은 1:1수준으로 여러 기능 익혀가며 쉽게 할수 있어야함. 짜여진대로.
 * 모든기능 하나씩 해볼 수 있게. 적 여장수 포획도 시도하고 이건 튜토리얼급이니 100% 성공하도록").
 *
 * 화면 위 작은 띠에 할 일이 하나씩 뜨고, 눌러야 할 곳이 빛난다. 그 일을 하면 다음으로 넘어간다.
 * 넘어갔는지는 판 상태와 이번 계절 고른 명령 · 누른 단추로 판정한다 (화면의 일 — 엔진은 모른다).
 * 빛나는 곳은 CSS 선택자로 — 전장처럼 다시 그려지는 화면에서도 그대로 빛난다.
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

export interface TutStep {
  readonly id: string
  /** 띠에 뜨는 말 — 무엇을 왜 */
  readonly text: string
  /** 빛낼 곳 */
  readonly hl: readonly string[]
  readonly done: (c: TutCtx) => boolean
}

const has = (c: TutCtx, k: Order['kind']): boolean => c.orders.some((o) => o.kind === k)
const FOE_HERO = 'guya-3'

export const TUT_STEPS: readonly TutStep[] = [
  {
    id: 'look', text: '여기가 우리 골포국이다. 금빛 테두리 안이 우리 땅이다. 왼쪽 위 「우리 땅」을 눌러 본다.',
    hl: ['.homebtn'], done: (c) => c.acts.has('home'),
  },
  {
    id: 'draft', text: '아래 「징병」을 열고 군사를 뽑는다. 집에서 사내를 뽑아 군대를 키운다.',
    hl: ['[data-act="tab"][data-tab="draft"]', '[data-act="draft"]'], done: (c) => has(c, 'draft'),
  },
  {
    id: 'settle', text: '같은 판 아래 「개척」에서 빈땅 돌섬에 집을 보낸다. 사람이 살면 새 마을이 된다.',
    hl: ['[data-act="jump"][data-to="sec-settle"]', '[data-act="settle"]', '.nd[data-node="wild-dolseom"]'], done: (c) => has(c, 'settle') || has(c, 'migrate'),
  },
  {
    id: 'scout', text: '오른쪽 봉황 마을을 누르고 「척후를 여기로 보낸다」. 적 군세가 얼마인지 보인다.',
    hl: ['.nd[data-node="guya-vil"]', '[data-act="scout"]'], done: (c) => has(c, 'scout'),
  },
  {
    id: 'envoy', text: '봉황 마을 판의 사신에서 가락국에 「선물」을 고르고, 곡식을 조금 얹어 「사신을 보낸다」. 선물은 늘 받는다. 사신은 칠 나라와도 오간다.',
    hl: ['[data-act="compose-go"][data-ask="gift"]', '[data-act="compose"][data-ask="gift"]', '[data-act="cq"][data-side="give"][data-res="grain"]:not([data-d^="-"])', '.trade [data-act="envoy"]'],
    done: (c) => has(c, 'envoy'),
  },
  {
    id: 'rite', text: '안개골 위 「큰나무 소도」를 누르고 봄 제사를 지낸다. 가을에 거두는 곡식이 는다.',
    hl: ['.nd[data-node="sodo"]', '[data-act="rite"]'], done: (c) => has(c, 'rite') || c.r.season > 0,
  },
  {
    id: 'next', text: '이제 오른쪽 아래 「다음 계절」을 누른다. 고른 일이 한꺼번에 이루어지고 소식이 온다.',
    hl: ['.next'], done: (c) => c.r.season >= 1,
  },
  {
    id: 'march', text: '갈대울의 군대 말(신궁 얼굴)을 누르고 봉황 마을을 누른다. 「대로로 간다」를 고르고 군량은 넉넉히.',
    hl: ['.tok[data-army="a-us"]', '.nd[data-node="guya-vil"]', '[data-act="ap"][data-v="road"]', '[data-act="ration"][data-v="full"]'],
    done: (c) => c.orders.some((o) => o.kind === 'march') || Object.values(c.r.armies).some((a) => a.faction === c.r.player && (a.march !== null || a.at === 'guya-vil')),
  },
  {
    id: 'battle', text: '「다음 계절」을 누르면 전장이 열린다. 합마다 명령을 하나 고른다. 여기선 「적장 사로잡기」를 골라 본다 — 이 판에선 반드시 잡힌다.',
    hl: ['.next', '[data-war="cmd"][data-c="capture"]'],
    done: (c) => c.r.heroes[FOE_HERO]?.status === 'captive' || c.r.heroes[FOE_HERO]?.faction === c.r.player,
  },
  {
    id: 'persuade', text: '사로잡은 견지 쇠비를 우리 장수로 만든다. 아래 「장수」에서 그 얼굴을 누르고 「회유한다」.',
    hl: ['[data-act="tab"][data-tab="heroes"]', `[data-act="hero"][data-id="${FOE_HERO}"]`, '[data-act="persuade"]'],
    done: (c) => c.orders.some((o) => o.kind === 'persuade') || c.r.heroes[FOE_HERO]?.persuade !== undefined || c.r.heroes[FOE_HERO]?.faction === c.r.player,
  },
  {
    id: 'plot', text: '「외교」 판의 「공작」을 열고 가락국에 소문을 퍼뜨린다. 적 군사의 사기가 꺾인다.',
    hl: ['[data-act="tab"][data-tab="diplo"]', '[data-act="dmode"][data-v="plot"]', '[data-act="plot-open"][data-op="rumor"]', '[data-act="plot"][data-op="rumor"]'],
    done: (c) => c.orders.some((o) => o.kind === 'plot'),
  },
  {
    id: 'win', text: '마지막이다. 군대를 가락 도읍으로 보내 쥐면 이 판을 이긴다.',
    hl: ['.tok[data-army="a-us"]', '.nd[data-node="guya-cap"]', '[data-act="ap"][data-v="road"]', '.next'], done: (c) => c.r.outcome?.kind === 'win',
  },
]

/** 지금 할 단계 — `from` 부터 이미 해낸 단계는 건너뛴다. 다 했으면 TUT_STEPS.length */
export function tutAt(from: number, c: TutCtx): number {
  let i = Math.max(0, from)
  while (i < TUT_STEPS.length && TUT_STEPS[i]!.done(c)) i++
  return i
}

/** 지금 단계의 빛낼 곳 — <style> 하나로 (다시 그려지는 화면에서도 빛나게) */
export function tutStyle(step: TutStep | undefined): string {
  if (step === undefined || step.hl.length === 0) return ''
  return `${step.hl.map((s) => `.ap ${s}, .wr ${s}`).join(',\n')} { outline: 3px solid #ffd27a; outline-offset: 2px; box-shadow: 0 0 14px #ffd27acc; animation: tutglow 1.1s ease-in-out infinite alternate; border-radius: 10px; }`
}

export function tutBandHtml(i: number, esc: (s: string) => string): string {
  if (i >= TUT_STEPS.length) {
    return `<div class="tutb done"><b>다 배웠다</b><span>이제 작은 판(변한 여섯 나라)이 열렸다. 처음 화면의 「새 판」에서 고른다.</span><button class="btn sm on" data-act="tut-end">처음으로</button></div>`
  }
  const s = TUT_STEPS[i]!
  return `<div class="tutb"><i>배우기 ${i + 1} / ${TUT_STEPS.length}</i><span>${esc(s.text)}</span>`
    + `<span class="tutbtns"><button class="btn sm ghost" data-act="tut-skip">이건 건너뛴다</button><button class="btn sm ghost" data-act="tut-quit">배우기 그만</button></span></div>`
}

export const TUT_CSS = `
.ap .tutband { position: absolute; left: 8px; right: 8px; top: calc(var(--toph) + var(--legh) + 6px); z-index: 70; pointer-events: none; display: flex; justify-content: center; }
.ap .tutband:empty { display: none; }
.ap:has(.wr) .tutband { top: auto; bottom: 10px; z-index: 70; } /* 전장에서는 아래로 — 두 장수 얼굴을 가리지 않게 */
.tutb { pointer-events: auto; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; max-width: 560px; padding: 9px 12px; border-radius: 14px;
  background: #1b2028f4; border: 1px solid #c8a050; box-shadow: 0 6px 20px #000b; color: #eee6d4; font-size: 14px; line-height: 1.45; }
.tutb i { font-style: normal; color: #f3d48a; font-weight: 700; font-size: 12.5px; } .tutb > span:not(.tutbtns) { flex: 1 1 260px; }
.tutb .tutbtns { display: flex; gap: 6px; margin-left: auto; } .tutb.done b { color: #9fd18b; }
@keyframes tutglow { from { box-shadow: 0 0 4px #ffd27a66; } to { box-shadow: 0 0 18px #ffd27a; } }
`
