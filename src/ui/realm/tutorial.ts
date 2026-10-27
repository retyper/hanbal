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
import { P } from '../../tune/params.ts'

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
  /** 이 단계에서 배우는 일의 이름과 한 줄 뜻 — 띠 맨 위에 크게 · 단계가 열릴 때 화면 가운데 크게 (형 10-25: "하나하나마다 뭐 하는 건지 크게 텍스트가 떠야") */
  readonly name: string
  readonly what: string
  /** 띠에 뜨는 말 — 무엇을 왜 */
  readonly text: string
  /** 누를 곳 — 나중에 누를 것부터 (보이는 첫 것을 가리킨다) */
  readonly press: readonly Press[]
  /** 전장 안에서 빛낼 곳 — 고를 것 · 고른 뒤 누를 것. 전장은 어둡게 막지 않고 빛만 낸다 (싸움은 제 손으로) */
  readonly war?: { readonly pick: string; readonly go: string; readonly tab?: string }
  readonly done: (c: TutCtx) => boolean
}

const has = (c: TutCtx, k: Order['kind']): boolean => c.orders.some((o) => o.kind === k)
const marching = (c: TutCtx): boolean => has(c, 'march') || Object.values(c.r.armies).some((a) => a.faction === c.r.player && a.march !== null)
const FOE_HERO = 'tut-haebi'
const tab = (t: string): string => `[data-act="tab"][data-tab="${t}"]`
/** 해비가 우리 손에 있나 (옥 · 회유 중 · 이미 우리 장수) */
const haveFoe = (c: TutCtx): boolean => c.r.heroes[FOE_HERO]?.status === 'captive' || c.r.heroes[FOE_HERO]?.faction === c.r.player
/** 싸움을 한 번 치렀다 — 무엇을 골랐든 (사로잡기를 안 골라 이겨도 넘어간다 · 놀이 시험 10-27: 9/12 에 갇혔다) */
const fought = (c: TutCtx): boolean => haveFoe(c) || (c.report?.lines.some((l) => l.kind === 'battle') ?? false) || c.r.nodes['tut-gaetgol']?.owner === c.r.player

export const TUT_STEPS: readonly TutStep[] = [
  {
    id: 'look', name: '우리 땅', what: '금빛 테두리 안이 우리 나라다', text: '여기가 우리 백제다. 금빛 테두리 안이 우리 땅이다. 빛나는 「우리 땅」을 눌러 본다.',
    press: ['.homebtn'], done: (c) => c.acts.has('home'),
  },
  {
    id: 'draft', name: '징병', what: '마을 장정을 뽑아 군사로 만든다', text: '「징병」을 열고 군사를 뽑는다. 집에서 사내를 뽑아 군대를 키운다.',
    press: ['[data-act="draft"]', tab('draft')], done: (c) => has(c, 'draft'),
  },
  {
    id: 'settle', name: '개척', what: '백성을 빈땅에 보내 새 마을을 연다', text: '「백성」을 열고 빈땅 솔뫼의 「개척단 보내기」를 누른다. 군사가 아니라 농사지을 백성이 간다. 닿으면 새 마을이 선다.',
    press: ['.stlgo[data-node="tut-solmoe"]', tab('people')], done: (c) => has(c, 'party') || has(c, 'settle'),
  },
  {
    id: 'scout', name: '정찰', what: '적 고을의 군세를 미리 엿본다', text: '왼쪽(서쪽) 갯골 마을을 누르고 「여기로 정찰을 보낸다」. 적 군세가 얼마인지 보인다. 정찰은 「외교」에서도 고른다.',
    press: ['[data-act="scout"][data-node="tut-gaetgol"]', '.nd[data-node="tut-gaetgol"]'], done: (c) => has(c, 'scout'),
  },
  {
    id: 'envoy', name: '사신', what: '이웃 나라에 말과 선물을 보낸다', text: '미추홀에 「선물」 사신을 보낸다. 곡식을 조금 얹고 「사신을 보낸다」. 선물은 늘 받는다. 사신은 칠 나라와도 오간다.',
    press: [
      '.trade [data-act="envoy"]', '.trade [data-act="cq"][data-side="give"][data-res="grain"]:not([data-d^="-"])',
      '[data-act="compose"][data-ask="gift"]', '[data-act="compose-go"][data-ask="gift"]', '.nd[data-node="tut-gaetgol"]',
    ],
    done: (c) => has(c, 'envoy'),
  },
  {
    id: 'rite', name: '제사', what: '소도에서 하늘에 빌어 수확을 늘린다', text: '아차 마을 위 「큰나무 소도」를 누르고 봄 제사를 지낸다. 그해 가을 수확량이 늘어난다.',
    press: ['[data-act="rite"]', '.nd[data-node="tut-sodo"]'], done: (c) => has(c, 'rite') || c.r.season > 0,
  },
  {
    id: 'next', name: '다음 계절', what: '정한 일이 한꺼번에 이루어진다', text: '이제 「다음 계절」을 누른다. 고른 일이 한꺼번에 이루어지고 소식이 온다.',
    press: ['.next'], done: (c) => c.r.season >= 1,
  },
  {
    id: 'march', name: '출정', what: '군대를 다른 고을로 보낸다', text: '갈대울의 우리 군대 말(장수 얼굴)을 누르고, 밝아진 갯골 마을을 누른다. 그리로 간다.',
    press: ['.nd[data-node="tut-gaetgol"][data-act="go"]', '.tok[data-army="a-us"]'],
    done: (c) => has(c, 'march') || Object.values(c.r.armies).some((a) => a.faction === c.r.player && (a.march !== null || a.at === 'tut-gaetgol')),
  },
  {
    id: 'battle', name: '전투', what: '합마다 명령을 골라 싸운다', text: '「다음 계절」을 누르면 전장이 열린다. 합마다 명령을 하나 고른다. 여기선 「적장 사로잡기」를 골라 본다 — 이 판에선 반드시 잡힌다.',
    // 사로잡기는 「장수」 탭에 있다 · 「전투 개시」는 무리마다 다 고르면 켜진다 — 나머지는 ★ 권함으로 채운다
    press: ['.next'], war: { pick: '[data-war="pick"][data-c="capture"]', go: '[data-war="go"]', tab: '[data-war="gtab"][data-g="lead"]' },
    done: fought,
  },
  {
    id: 'persuade', name: '회유', what: '사로잡은 적장을 우리 장수로 만든다', text: '사로잡은 해비를 우리 장수로 만든다. 「장수」의 「옥에 가둔 적장」에서 그 얼굴을 누르고 「회유한다」.',
    // 사로잡은 장수는 장수 판의 「옥에 가둔 적장」 칸에 있다 — 그 칸을 먼저 열게 (형 10-24: "10/12 에서 장수 탭 눌러도 다음으로 안 가짐")
    press: ['[data-act="persuade"]', `[data-act="hero"][data-id="${FOE_HERO}"]`, '[data-act="htab"][data-v="jail"]', tab('heroes')],
    // 해비를 못 잡았으면 회유는 건너뛴다 — 옥이 비어 갇혔다 (놀이 시험 10-27)
    done: (c) => !haveFoe(c) || c.orders.some((o) => o.kind === 'persuade') || c.r.heroes[FOE_HERO]?.persuade !== undefined || c.r.heroes[FOE_HERO]?.faction === c.r.player,
  },
  {
    id: 'plot', name: '공작', what: '몰래 적을 흔든다 — 소문·방화·암살', text: '「외교」의 「공작」에서 미추홀에 소문을 퍼뜨린다. 적 군사의 사기가 꺾인다.',
    press: ['[data-act="plot"][data-op="rumor"]', '[data-act="ppick"][data-op="rumor"]', '[data-act="plot-open"][data-op="rumor"]', '[data-act="dmode"][data-v="plot"]', tab('diplo')],
    done: (c) => c.orders.some((o) => o.kind === 'plot'),
  },
  {
    id: 'win', name: '도읍 차지', what: '적의 도읍을 쥐면 이긴다', text: '마지막이다. 군대를 미추홀 도읍으로 보내 쥐면 이 판을 이긴다.',
    press: [['.next', marching], '.nd[data-node="tut-michuhol-cap"][data-act="go"]', '.tok[data-army="a-us"]', ['.next', () => true]],
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
  const { pick, go, tab } = step.war
  // 고르기 전엔 그 탭 · 그 명령 카드, 고른 뒤엔 (잠겨 있으면) 아직 안 고른 무리 탭, 켜지면 「전투 개시」 (「★ 권함대로 채운다」는 뺐다 — 형 10-25)
  const sels = [`.ap .wr ${pick}:not(.on)`, `.ap .wr:has(${pick}.on) ${go}:not([disabled])`, `.ap .wr:has(${pick}.on):has(${go}[disabled]) .wgt[data-g]:not(.done)`]
  if (tab !== undefined) sels.push(`.ap .wr:not(:has(${pick}.on)) ${tab}:not(.on)`)
  return `${sels.join(', ')} { outline: 3px solid #ffd27a; outline-offset: 3px; animation: tutglow .9s ease-in-out infinite alternate; border-radius: 10px; }`
}

export function tutBandHtml(i: number, esc: (s: string) => string, stuck = false): string {
  if (i >= TUT_STEPS.length) {
    return `<div class="tutb done"><b>다 배웠다</b><span>이제 작은 판(변한 여섯 나라)이 열렸다. 처음 화면의 「새 게임」에서 고른다.</span><button class="btn sm on" data-act="tut-end">처음으로</button></div>`
  }
  // 건너뛰기 — 한 단계에 오래 머물면(갇힌 듯하면) 그때만 뜬다. 평소엔 눌러야 할 것을 눌러야 넘어간다 (형 10-20) · 막히면 그대로 떠난다 (형 10-24)
  const st = TUT_STEPS[i]!
  return `<div class="tutb"><b class="tutname"><i>${i + 1}/${TUT_STEPS.length}</i>${esc(st.name)}<small>${esc(st.what)}</small></b><span>${esc(st.text)}</span>${stuck ? '<button class="tutskip" data-act="tut-skip">막혔으면 건너뛰기 ›</button>' : ''}</div>`
}

// ───────── 스포트라이트 — 누를 곳만 밝고, 그곳만 눌린다

/** 가려졌을 때 먼저 닫을 것 — [덮는 것, 그 안의 닫기 단추, 갈래]: 보고판의 「확인」 · 열린 판의 손잡이. 띠 위에 그 말이 한 줄 붙는다 (TUT_CSS 의 data-pre) */
// 보고판이 화면 가득(정할 것이 남음)이면 「확인」이 없다 — 고를 단추(사건 카드 · 사신의 청 거절)를 가리킨다
// 고른 군대·개척단 띠도 — 폰에선 띠가 서쪽 고을(갯골)을 덮어 누를 수 없었다 (형 10-25 4/12)
const DISMISS: ReadonlyArray<readonly [string, string, string]> = [['.modal', '[data-act="rep-close"], .fulld [data-act="card-pick"], .fulld [data-act="answer"], .fulld [data-act="wand-pick"][data-v="0"]', 'rep'], ['.sheet', '.grip', 'grip'], ['.selbar', '[data-act="selclose"], [data-act="pp-close"]', 'sel']]

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
  // 구멍 둘레를 판 넷으로 덮는다 — 큰 그림자(200vmax)로 덮으면 어떤 폰은 구멍 안까지 칠해 누를 곳이 밤색으로 가렸다 (형 10-24: "선택 영역창 전부 밤색 · 핫픽스")
  hole.innerHTML = '<i class="t"></i><i class="b"></i><i class="l"></i><i class="r"></i>'
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
  /** 이 단계에서 이미 한 번 굴려 본 곳 — 두 번은 굴리지 않는다 (두 곳을 번갈아 굴리며 끝없이 오갔다 · 형 10-24 4/12) */
  let scrolled = new WeakSet<HTMLElement>()
  let scrolledStep = ''
  /** 지금 가리키는 것이 닫기 단추면 그 갈래 ('' 이면 단계의 누를 곳) */
  let pre = ''
  /**
   * 고리를 옮길 새 후보 — 몇 프레임 내리 같은 것이어야 옮긴다. 옮긴 뒤엔 잠깐 그대로.
   * 무엇 때문이든 두 곳이 번갈아 뽑히면 고리가 끝없이 오갔다 (형 10-24: 4/12 · 5/12 "엄청 왔다갔다") — 이제는 한 곳에 머문다.
   * 지금 가리키는 것이 사라지거나 안 보이면 바로 옮긴다
   */
  let cand: HTMLElement | null = null
  /** 지금 고리의 갈래 — 후보를 기다리는 동안 띠 말이 바뀌지 않게 */
  let keptPre = ''
  let candPre = ''
  /** 후보가 처음 뽑힌 때 — 프레임 수가 아니라 시간으로 센다 (가려진 탭·느린 폰에선 프레임이 1초에 하나라 8프레임이 8초였다 · 10-25) */
  let candAt = 0
  let movedAt = 0
  /** 방금 누를 곳을 누른 때 — 다음 곳으로는 바로 옮긴다 (기다리면 고리가 옛 곳에 남아 다시 누르면 방금 연 판이 닫혔다). 오래되면 안 친다 */
  let tappedAt = -1e9
  const TAP_FRESH_MS = 1500
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
  /** 화면(창) 밖에 통째로 있나 */
  const offView = (el: HTMLElement): boolean => {
    const r0 = el.getBoundingClientRect()
    return r0.bottom <= 0 || r0.top >= innerHeight || r0.right <= 0 || r0.left >= innerWidth
  }
  /**
   * 누를 곳의 자리 — 고을이면 그 이름표까지 (이름표는 지도 위 따로 깔린 글이라 눌러도 고을이 아니었다 · 형 10-25 4/12 갯골 · 6/12 소도).
   * 손가락은 그림보다 이름을 누른다
   */
  const zoneOf = (el: HTMLElement): { left: number; top: number; right: number; bottom: number } => {
    const a = el.getBoundingClientRect()
    const z = { left: a.left, top: a.top, right: a.right, bottom: a.bottom }
    const node = el.dataset['node']
    const lb = node !== undefined && el.classList.contains('nd') ? root.querySelector<HTMLElement>(`.lb[data-n="${node}"]`) : null
    if (lb !== null) {
      const b = lb.getBoundingClientRect()
      if (b.width > 1) { z.left = Math.min(z.left, b.left); z.top = Math.min(z.top, b.top); z.right = Math.max(z.right, b.right); z.bottom = Math.max(z.bottom, b.bottom) }
    }
    return z
  }
  const war = (): boolean => root.classList.contains('war-open') || root.querySelector('.wr') !== null
  /** 큰 장면이 떠 있나 — 그동안은 고리도 막기도 쉰다 */
  const cere = (): boolean => root.querySelector('.cere, .saveov') !== null // 「저장 · 불러오기」 창도 막지 않는다

  /**
   * 누를 곳을 덮고 있는 보고판·판 — 자리(좌표)로 본다. 화면 맨 위 요소를 찍어 보던 것(elementFromPoint)은 고리·어둠·판이 미끄러지는
   * 틈·지도 굴림에 흔들려 「닫아라」와 누를 곳 두 곳을 끝없이 오갔다 (형 10-24·10-25: 4/12 · 5/12 · 9/12 "무한순환").
   * 보고판은 떠 있으면 다 덮는다 · 판은 열려 있고 누를 곳의 한가운데가 판 자리 안이면 덮는다. 누를 곳이 그 안에 있으면 덮은 게 아니다
   */
  const coverOf = (el: HTMLElement | null): HTMLElement | null => {
    for (const [c] of DISMISS) {
      const x = root.querySelector<HTMLElement>(c)
      if (x === null || !shown(x) || (c === '.sheet' && !root.classList.contains('sheet-open'))) continue
      // 고른 띠는 덮었을 때만 — 가리킬 곳이 없을 때나, 고른 채 눌러야 하는 곳(갈 곳)일 때는 풀게 하지 않는다 (풀면 행군 단계가 되돌아간다)
      if (c === '.selbar' && (el === null || el.matches('[data-act="go"], [data-act="ptgo"]'))) continue
      if (el === null) return x
      if (x.contains(el)) continue
      if (c === '.modal') return x
      const a = el.getBoundingClientRect()
      // 판은 밀려 올라오는 중이어도 다 올라온 자리로 본다 (transform 을 뺀 배치 자리) — 미끄러지는 틈에 「아직 안 덮였다」고 보고 그 밑을 가리켰다
      const rr = root.getBoundingClientRect()
      const s = { left: rr.left + x.offsetLeft, top: rr.top + x.offsetTop, right: rr.left + x.offsetLeft + x.offsetWidth, bottom: rr.top + x.offsetTop + x.offsetHeight }
      const cx = a.left + a.width / 2
      const cy = a.top + a.height / 2
      if (cx >= s.left && cx <= s.right && cy >= s.top && cy <= s.bottom) return x
    }
    return null
  }

  function pick(): HTMLElement | null {
    if (step === undefined || ctx === null || war() || cere()) return null
    const sel = tutPick(step, ctx, (s) => first(s) !== null)
    const el = sel !== null ? first(sel) : null
    pre = ''
    const cover = coverOf(el)
    if (cover === null) return el
    // 덮은 것의 닫기 단추가 있으면 그것부터 — 없는 판(출정 판 같은)은 제 손으로 닫게 두고 누를 곳을 그대로 가리킨다
    const d = DISMISS.find(([c]) => cover.matches(c))
    const x = d !== undefined ? ([...cover.querySelectorAll<HTMLElement>(d[1])].find(shown) ?? null) : null
    if (x === null) return el
    pre = d![2]
    return x
  }

  function frame(): void {
    raf = 0
    let want = pick()
    let wantPre = pre
    const now = performance.now()
    const alive = target !== null && target.isConnected && shown(target)
    // 「먼저 닫아라」를 가리키기 시작했으면 그 판이 닫힐 때까지 붙잡는다 — 판이 미끄러지거나 지도가 굴러 누를 곳이 잠깐 드러나도 오가지 않게.
    // 누를 곳이 그 판 안에 나타나면(판이 바뀌어) 놓는다
    if (alive && keptPre !== '' && want !== target && want !== null && target!.closest('.modal, .sheet')?.contains(want) !== true) { want = target; wantPre = keptPre }
    if (want !== target) {
      if (want !== cand || wantPre !== candPre) { cand = want; candPre = wantPre; candAt = now }
      const tapped = now - tappedAt < TAP_FRESH_MS
      if (!alive || tapped || (now - candAt >= P.realm.tutSwitchMs && now - movedAt >= P.realm.tutSwitchMs)) {
        tappedAt = -1e9
        target = want
        pre = wantPre
        movedAt = now
        cand = null
      } else pre = keptPre
    } else cand = null
    keptPre = pre
    const b = band()
    if (b !== null && (b.dataset['pre'] ?? '') !== pre) b.dataset['pre'] = pre
    // 판이 아래에서 밀려 올라오는 동안엔 누를 곳이 아직 화면 밖이다 — 고리가 화면 아래로 날아갔다 오지 않게 그동안은 숨긴다 (10-25 재확인: 최대 1.2초)
    // 판 안에서 굴러 나간 것(움직이는 중이 아님)은 숨기지 않는다 — 그건 아래에서 굴려 보인다
    const sh = target?.closest<HTMLElement>('.sheet') ?? null
    const sliding = target !== null && sh !== null && offView(target) && sh.getAnimations({ subtree: true }).some((a) => a.playState === 'running')
    if (target === null || sliding) {
      view = null
      box.hidden = true
      hole.hidden = true
      if (b !== null) b.style.cssText = ''
      last = ''
    } else {
      view = target.closest<HTMLElement>('.mcard, .ncard') ?? target
      // 지도·판 안에서 다 안 보이면(반쯤 윗줄에 묻힌 고을도) 한 번만 굴려 가운데로 (그 뒤엔 지도를 끌어도 따라가기만)
      if (scrolledStep !== (step?.id ?? '')) {
        scrolledStep = step?.id ?? ''
        scrolled = new WeakSet()
      }
      if (!scrolled.has(target)) {
        scrolled.add(target)
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
        { const p = view === target ? pad : 2; hole.style.cssText = `--x:${v.left - p}px;--y:${v.top - p}px;--w:${v.width + p * 2}px;--h:${v.height + p * 2}px` }
        if (b !== null) {
          // 띠는 볼 곳과 누를 곳(고을이면 이름표까지)을 가리지 않게 — 그 밑(또는 위)에, 손 그림 틈만큼 띄워.
          // 실제 띠 높이로 재고, 어디에도 안 들어가면 덜 겹치는 화면 끝에 (형 10-25: 폰에서 띠가 소도 이름표를 덮어 누를 수 없었다)
          const z = zoneOf(target)
          const top = Math.min(v.top, z.top) - pad
          const bot = Math.max(v.bottom, z.bottom) + pad
          const gap = view === target ? 52 : 12
          const bh = Math.max(40, (b.firstElementChild as HTMLElement | null)?.offsetHeight ?? 110)
          const prefBelow = (top + bot) / 2 < innerHeight * 0.55
          const at = [prefBelow ? bot + gap : top - gap - bh, prefBelow ? top - gap - bh : bot + gap, bot + 4, top - 4 - bh, 8, innerHeight - 8 - bh]
          const fits = (y: number): boolean => y >= 4 && y + bh <= innerHeight - 4 && (y >= bot || y + bh <= top)
          const overlap = (y: number): number => Math.max(0, Math.min(y + bh, bot) - Math.max(y, top))
          const y = at.find(fits) ?? [8, innerHeight - 8 - bh].sort((p, q) => overlap(p) - overlap(q))[0]!
          b.style.cssText = `top:${Math.round(y)}px;bottom:auto`
        }
      }
    }
    if (step !== undefined) raf = requestAnimationFrame(frame)
  }

  // 누를 곳(과 배우기 띠, 지도 확대·축소) 밖의 누르기는 먹지 않는다 — 앱이 듣기 전에 (잡기 단계)
  document.addEventListener('click', (ev) => {
    if (target === null || view === null || box.hidden || !target.isConnected) return
    if (war()) return // 전장은 막지 않는다 (빛만)
    // 큰 장면(사로잡음·등용·혼례…)이 떠 있으면 막지 않는다 — 고리는 CSS 로 숨겼는데 누르기는 여기서 먹어 「확인」이 안 눌렸다 (형 10-24: "해비 사로잡았다 했는데 확인 눌러도 안 넘어가짐")
    if (cere()) return
    const t = ev.target as HTMLElement
    if (view.contains(t)) { tappedAt = performance.now(); return }
    // 누를 곳 둘레(이름표·손가락 너비) — 그것을 누른 것으로 넘겨 준다. 띠의 단추(건너뛰기)는 그대로
    if (t.closest('.tutb button') === null && ev.isTrusted) {
      const z = zoneOf(target)
      const s = P.realm.tutTapSlop
      if (ev.clientX >= z.left - s && ev.clientX <= z.right + s && ev.clientY >= z.top - s && ev.clientY <= z.bottom + s) {
        ev.preventDefault()
        ev.stopPropagation()
        tappedAt = performance.now()
        target.click()
        return
      }
    }
    // 고리가 옮겨 가는 틈 — 새로 가리킬 곳을 누른 것도 받는다 (재검토 10-25: 그 틈의 누르기가 먹혔다)
    if (cand !== null && cand.isConnected && (cand.closest<HTMLElement>('.mcard, .ncard') ?? cand).contains(t)) { tappedAt = performance.now(); return }
    if (t.closest('.tutband') !== null || t.closest('[data-act="zin"], [data-act="zout"]') !== null) return
    ev.preventDefault()
    ev.stopPropagation()
    // 엉뚱한 데를 누르면 고리가 한 번 크게 뛴다 — 여기를 누르라고
    box.classList.remove('tnudge')
    void box.offsetWidth
    box.classList.add('tnudge') // 'nudge' 는 쉬는 장수 띠(밤색 바탕)와 이름이 겹쳐 고리 안이 밤색으로 칠해졌다 (형 10-24 핫픽스)
  }, true)

  return {
    set(s, c) {
      if (s?.id !== step?.id) { target = null; cand = null; keptPre = '' } // 단계가 바뀌면 옛 곳을 붙잡지 않는다
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
/* 큰 장면(등용·사로잡음·혼례…)이 떠 있는 동안은 띠·고리를 숨긴다 — 고리가 장면 뒤를 가리켜 누를 수 없었다(10/12 막힘 · 형 10-24) */
.ap:has(.cere) .tutband, .ap:has(.cere) .tutspot, .ap:has(.cere) .tutring { display: none !important; }
.ap.war-open .tutspot, .ap.war-open .tutring, .ap:has(.wr) .tutspot, .ap:has(.wr) .tutring { display: none !important; }
.tutb { pointer-events: auto; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; max-width: 560px; padding: 10px 14px; border-radius: 14px;
  background: #1f1710f8; border: 1px solid #e8c06a; box-shadow: 0 6px 24px #000d; color: #f3ead8; font-size: 15px; line-height: 1.5; }
.tutb i { font-style: normal; color: #f3d48a; font-weight: 700; font-size: 12.5px; } .tutb > span { flex: 1 1 260px; }
/* 배우는 일의 이름 — 띠 맨 위에 크게 */
.tutb .tutname { flex: 1 0 100%; display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; font-family: var(--display); font-weight: 400; font-size: 24px; line-height: 1.15; color: #ffd27a; }
.tutb .tutname small { font-family: inherit; font-size: 14px; color: #e8d8b0; } .tutb .tutname i { font-family: system-ui, sans-serif; }
/* 단계가 열릴 때 화면 가운데 크게 — 누르기는 막지 않고 스스로 걷힌다 */
.ap .tutcap { position: absolute; left: 50%; top: 42%; z-index: 97; transform: translate(-50%, -50%); pointer-events: none; text-align: center; white-space: nowrap;
  padding: 14px 34px 16px; border-radius: 18px; background: radial-gradient(ellipse at 50% 50%, #1f1710f0 40%, #1f171000 75%); animation: tutcap 2.4s ease-out both; }
.ap .tutcap b { display: block; font-family: var(--display); font-weight: 400; font-size: clamp(40px, 9vw, 76px); line-height: 1.05; color: #ffd27a; text-shadow: 0 2px 0 #3a2410, 0 0 24px #e0a04088; }
.ap .tutcap span { display: block; margin-top: 6px; font-size: clamp(15px, 2.6vw, 20px); color: #f3ead8; text-shadow: 0 1px 4px #000; }
@keyframes tutcap { 0% { opacity: 0; transform: translate(-50%, -50%) scale(.85); } 12%, 70% { opacity: 1; transform: translate(-50%, -50%) scale(1); } 100% { opacity: 0; transform: translate(-50%, -54%) scale(1); } }
@media (prefers-reduced-motion: reduce) { .ap .tutcap { animation-duration: 1.6s; } }
.tutb.done b { color: #9fd18b; }
.tutb .tutskip { margin-left: auto; padding: 3px 9px; border-radius: 8px; border: 1px solid #6a5a3e; background: #0006; color: #c9b48a; font-size: 12px; cursor: pointer; }
/* 먼저 닫을 것을 가리킬 때 — 띠 맨 위에 한 줄 */
.tutband[data-pre="rep"] .tutb::before, .tutband[data-pre="grip"] .tutb::before { flex: 1 0 100%; color: #ffd27a; font-weight: 700; font-size: 13.5px; }
.tutband[data-pre="rep"] .tutb::before { content: '먼저 소식을 읽고 「확인」을 누른다'; }
.tutband[data-pre="grip"] .tutb::before { content: '먼저 열린 판을 닫는다 — 위의 손잡이를 누른다'; }
.tutband[data-pre="sel"] .tutb::before { flex: 1 0 100%; color: #ffd27a; font-weight: 700; font-size: 13.5px; content: '먼저 고른 것을 푼다 — ✕ 를 누른다'; }
@keyframes tutglow { from { box-shadow: 0 0 4px #ffd27a66; } to { box-shadow: 0 0 18px #ffd27a; } }
/* 스포트라이트 — 구멍 밖은 어둡다. 구멍은 누를 곳 크기, 둘레에 숨 쉬는 금빛 고리, 그 밑(또는 위)에서 손이 콕콕 가리킨다 */
/* 자리는 미끄러지지 않고 바로 붙는다 — 판이 굴러갈 때 고리가 뒤처지면 엉뚱한 데를 누르게 된다 */
.ap .tutspot { position: fixed; inset: 0; z-index: 95; pointer-events: none; }
.ap .tutspot i { position: absolute; background: #000000a8; }
.ap .tutspot .t { left: 0; right: 0; top: 0; height: max(0px, var(--y)); }
.ap .tutspot .b { left: 0; right: 0; top: calc(var(--y) + var(--h)); bottom: 0; }
.ap .tutspot .l { left: 0; width: max(0px, var(--x)); top: var(--y); height: var(--h); }
.ap .tutspot .r { left: calc(var(--x) + var(--w)); right: 0; top: var(--y); height: var(--h); }
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
.ap .tutring.tnudge .ring { animation: tutnudge .45s ease-out; }
@keyframes tutring { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.06); opacity: .8; } }
@keyframes tutwave { from { transform: scale(1); opacity: .9; } to { transform: scale(1.35); opacity: 0; } }
@keyframes tuthand { from { transform: translateY(6px); } to { transform: translateY(-4px); } }
@keyframes tuthandup { from { transform: translateY(-6px); } to { transform: translateY(4px); } }
@keyframes tutnudge { 0% { transform: scale(1); } 40% { transform: scale(1.25); border-color: #fff3c8; } 100% { transform: scale(1); } }
@media (prefers-reduced-motion: reduce) { .ap .tutring .ring, .ap .tutring .ring::after, .ap .tutring .hand { animation: none; } }
`
