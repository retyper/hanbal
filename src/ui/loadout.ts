/**
 * 여정의 시작과 끝 (docs/RUN.md)
 *
 * 시작: 활 한 자루 + 살통 하나를 고른다. **이 조합이 런의 빌드다** — 판마다 3택을
 * 강요하던 옛 드래프트를 대체한다 (형의 반려: "과녁이 화살보다 많으면 사실상 1택").
 *
 * 끝은 여기 없다 — 여정 종료는 **재정비**(ui/growth.ts showReinforce)다. 결과 머리 아래가
 * 곧 성장 줄이고, 그 '다음'이 이 화면이다 (2026-09-02, 형의 요구).
 */
import { ARROW_KINDS, type ArrowKindId } from '../game/arrows.ts'
import { ARROW_TINT, arrowIconSvg, bowIconSvg } from './arrowicons.ts'
import { BOW_KINDS, bowKind, masteryLevel, type BowKindId } from '../game/bows.ts'
import { unlockOfBow } from '../game/unlocks.ts'
import type { ForkOption } from '../game/forks.ts'
import type { Overlay } from './overlay.ts'

const PANEL_ID = 'loadout'

const CSS = `
.l-h { display: flex; align-items: baseline; gap: 14px; }
.l-h h2 { flex: 1; font-size: 30px; letter-spacing: .02em; }
.l-run { color: var(--dim); font-size: 13px; letter-spacing: .12em; }
.l-run b { color: var(--teal); font-size: 20px; margin-left: 6px; }
.l-best { color: var(--dim); font-size: 13px; letter-spacing: .08em; }
.l-best b { color: var(--accent); font-size: 20px; margin-left: 6px; }
.l-sec { color: var(--dim); font-size: 13px; letter-spacing: .12em; margin: 18px 0 8px; }
.l-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
@media (max-width: 400px) { .l-grid { grid-template-columns: 1fr; } }
/* 카드의 틀(문양 테두리·바탕·눌림)은 .hb-card 가 진다 (ui/overlay.ts).
   여기는 그 안에 무엇이 어떤 크기로 들어가는지만 정한다. */
.l-card .l-bic { color: var(--dim); line-height: 0; margin-bottom: 4px; }
.l-card.hb-on .l-bic { color: var(--teal); }
.l-card { display: flex; flex-direction: column; gap: 3px; }
.l-card .l-ic { color: var(--tint); line-height: 0; margin-bottom: 4px; }
/* 갈림길 카드의 아이콘은 크게 — 글을 읽기 전에 무슨 카드인지 알아야 한다. */
.l-card .l-ic .hb-ic { width: 30px; height: 30px; }
.l-card .l-syn2 { letter-spacing: .08em; }
.l-card .l-n { color: var(--ink); font-weight: 700; font-size: 15px; }
.l-card .l-d { color: var(--dim); font-size: 12px; line-height: 1.45; }
.l-card.hb-on .l-n { color: var(--teal); }
/* 잠긴 활 — 흐리게, 조건은 보이게 (수집 화면과 같은 문법). 클릭은 안 먹는다. */
.l-card.l-lock { opacity: .55; cursor: default; }
.l-card.l-lock:hover { background: var(--card); }
.l-card.l-lock .l-n { color: var(--mute); letter-spacing: .08em; }
.l-syn { color: var(--teal); font-size: 13px; min-height: 22px; margin-top: 12px; }
.l-card .l-syn2 { color: var(--teal); font-size: 12px; }
.l-foot { display: flex; align-items: center; gap: 14px; margin-top: 8px; }
/* 전체 초기화 — 개발 단계의 필수품. 시작 버튼과 헷갈리지 않게 구석에 작게, 위험색은 무장 후에만. */
.l-wipe { margin-left: auto; font-size: 12px; color: var(--mute); }
.l-wipe.l-armed { color: #ff6a45; border-color: #ff6a4577; }
.l-go { font-size: 17px; padding: 13px 26px; }

`

export interface LoadoutPick {
  bow: BowKindId
}

/**
 * 런 시작 로드아웃. onStart는 정확히 한 번 불린다 — 안 부르면 여정이 시작되지 않는다.
 * bows/arrows 는 해금으로 열린 것만 온다 (연습궁·유엽전은 항상 포함).
 */
export function mountLoadout(
  o: Overlay,
  bows: readonly BowKindId[],
  last: LoadoutPick,
  bowHits: Readonly<Record<string, number>>,
  bestRunStage: number,
  runCount: number,
  /** 이번 여정이 시작되는 판 (1부터). 체크포인트가 있으면 1이 아니다 — 화면이 먼저 말한다. */
  startStage: number,
  onStart: (pick: LoadoutPick) => void,
): void {
  const panel = o.panel(PANEL_ID)
  panel.replaceChildren()
  panel.setAttribute('aria-label', '여정 준비')

  const style = document.createElement('style')
  style.textContent = CSS
  panel.appendChild(style)

  // ── 출정식 (형: "시작이 여행을 떠나는 것 같아야 시작할 맛이 나지") ──
  // 제목은 크게, 이번이 몇 번째 여정인지, 기록은 옆에. 문장은 떠나는 사람의 것으로.
  const head = document.createElement('div')
  head.className = 'l-h'
  head.innerHTML = `<h2>출정</h2><div class="l-run">여정<b>${runCount + 1}</b></div>` +
    // 어디서 출발하는가 — 체크포인트(보스 다음 판)가 있으면 "또 1판부터"가 아니다.
    (startStage > 1 ? `<div class="l-run">출발<b>${startStage}판</b></div>` : '') +
    (bestRunStage > 0 ? `<div class="l-best">가장 멀리<b>${bestRunStage}판</b></div>` : '')
  const sub = document.createElement('p')
  sub.className = 'hb-lead'
  sub.textContent = '동이 트기 전, 활 한 자루를 고른다. 10판마다 귀신이 길을 막고, 화살이 다하면 여정도 끝난다.'
  panel.append(head, sub)

  // 시작 선택은 지난 여정의 것. 없던 게 해금돼도 손이 기억하는 활이 먼저다.
  const pick: LoadoutPick = {
    bow: bows.includes(last.bow) ? last.bow : 'practice',
  }

  const bowCards = new Map<BowKindId, HTMLButtonElement>()
  const syn = document.createElement('div')
  syn.className = 'l-syn'

  const refresh = (): void => {
    for (const [id, el] of bowCards) el.classList.toggle('hb-on', id === pick.bow)
    // 궁합은 판에 그 살을 장전했을 때 성립한다 — 여기서는 활이 어떤 살과 궁합인지만 알려준다.
    const s = bowKind(pick.bow).synergy
    syn.textContent = s !== undefined ? `궁합 — ${s.label}` : ''
  }

  const section = (title: string): void => {
    const h = document.createElement('div')
    h.className = 'l-sec'
    h.textContent = title
    panel.appendChild(h)
  }

  section('활')
  const bowGrid = document.createElement('div')
  bowGrid.className = 'l-grid'
  // 열린 활 먼저, 그 뒤에 잠긴 활 — 잠긴 슬롯이 보여야 '다음 여정의 이유'가 생긴다
  // (Hades의 무기 벽, 발라트로의 잠긴 덱 — 감사 시작경험).
  for (const b of BOW_KINDS) {
    const id = b.id
    const owned = id === 'practice' || bows.includes(id)
    const card = document.createElement('button')
    card.type = 'button'
    card.className = owned ? 'hb-card l-card' : 'hb-card l-card l-lock'
    const lv = masteryLevel(Math.floor(bowHits[id] ?? 0))
    // 잠긴 활은 이름만이 아니라 그림도 가린다 — 실루엣까지 보이면 "가려졌다"가 아니다.
    card.innerHTML = `<span class="l-bic">${bowIconSvg(owned ? id : '', 34)}</span>` +
      `<span class="l-n"></span><span class="l-d"></span><span class="l-d"></span>`
    const descs = card.querySelectorAll('.l-d')
    if (owned) {
      ;(card.querySelector('.l-n') as HTMLElement).textContent = b.name + (lv > 0 ? ` · 숙련 ${lv}` : '')
      ;(descs[0] as HTMLElement).textContent = b.perk
      ;(descs[1] as HTMLElement).textContent = b.cost === '없음' ? '' : `대가 — ${b.cost}`
      card.addEventListener('click', () => {
        pick.bow = id
        refresh()
      })
      bowCards.set(id, card)
    } else {
      ;(card.querySelector('.l-n') as HTMLElement).textContent = '？？？'
      ;(descs[0] as HTMLElement).textContent = unlockOfBow(id)?.hint ?? ''
    }
    bowGrid.appendChild(card)
  }
  panel.appendChild(bowGrid)

  panel.appendChild(syn)

  const foot = document.createElement('div')
  foot.className = 'l-foot'
  const go = document.createElement('button')
  go.type = 'button'
  go.className = 'hb-btn hb-pri l-go'
  go.textContent = '활을 들고 나선다 →'
  foot.appendChild(go)

  // 전체 초기화 버튼은 성장 화면(g-danger) 한 곳뿐이다 —
  // 매 출정마다 파괴 버튼을 볼 이유가 없다 (감사 UI구조).
  panel.appendChild(foot)

  let done = false
  // 공부하러 나가면 main.ts가 패널을 닫는다. 돌아왔을 때 이 화면이 되살아나지 않으면
  // onStart가 영영 안 불리고 게임이 어디에도 없는 상태로 굳는다 (드래프트 시절의 그 버그).
  const onVisibility = (): void => {
    if (!document.hidden && !done) o.show(PANEL_ID)
  }
  document.addEventListener('visibilitychange', onVisibility, true)
  go.addEventListener('click', () => {
    if (done) return
    done = true
    document.removeEventListener('visibilitychange', onVisibility, true)
    o.hide(true)
    onStart({ bow: pick.bow })
  })

  refresh()
  o.show(PANEL_ID, { sticky: true })
}

/**
 * 갈림길 카드의 밑색 — game/forks.ts 의 id로 고른다. 색이 곧 그 카드가 무엇을 건드리는지다:
 * 불(화공)·폭발(화약고)은 강조색 계열, 바람·보급은 청록(안전), 척후·단발은 위험색.
 */
const FORK_TINT: Record<string, string> = {
  fire: '#ff8f5d', bomb: '#ffb347', wind: '#7fd6c8',
  supply: '#9be08f', scout: '#ff6a45', single: '#c9a0ff',
}

/**
 * 갈림길 2택 (docs/MEGAHIT.md §3 · game/forks.ts). 판이 끝나면 뜬다. onPick은 정확히 한 번 —
 * 카드를 고르는 순간 그 모디파이어를 얹은 다음 판으로 바로 들어간다.
 *
 * ★ 형의 반려 (2026-08-26): "그따위로 텍스트로 선택하게 하는 게임이 어딨냐?" — 캔버스
 *   힌트 문자열 + 숫자키였던 첫 구현을 버렸다. 보급 3택과 같은 카드 문법으로 다시 짰다 —
 *   이 게임에 이미 있던, 형이 반려한 적 없는 문법을 그대로 물려받는 게 제일 안전하다.
 *   건너뛰기는 없다 — 텍스트 힌트 시절의 "그냥 당기면 기본값" 관용은 사라졌다.
 */
export function mountFork(
  o: Overlay,
  options: readonly [ForkOption, ForkOption],
  onPick: (index: 0 | 1) => void,
): void {
  const panel = o.panel('fork')
  panel.replaceChildren()
  panel.setAttribute('aria-label', '갈림길')

  const style = document.createElement('style')
  style.textContent = CSS
  panel.appendChild(style)

  const head = document.createElement('div')
  head.className = 'l-h'
  head.innerHTML = '<h2>갈림길</h2>'
  const sub = document.createElement('p')
  sub.className = 'hb-lead'
  sub.textContent = '다음 판에 무엇을 얹을까 — 하나를 고른다.'
  panel.append(head, sub)

  const grid = document.createElement('div')
  grid.className = 'l-grid'
  let done = false
  const onVisibility = (): void => {
    if (!document.hidden && !done) o.show('fork')
  }
  document.addEventListener('visibilitychange', onVisibility, true)
  const finish = (i: 0 | 1): void => {
    if (done) return
    done = true
    document.removeEventListener('visibilitychange', onVisibility, true)
    o.hide(true)
    onPick(i)
  }
  for (let i = 0; i < options.length; i++) {
    const opt = options[i]
    if (opt === undefined) continue
    const idx = i as 0 | 1
    const card = document.createElement('button')
    card.type = 'button'
    card.className = 'hb-card l-card'
    card.style.setProperty('--tint', FORK_TINT[opt.id] ?? '#7fd6c8')
    // 아이콘 → 이름 → 한자 뿌리 → 설명. 활·살 카드와 같은 뼈대라 한 화면으로 읽힌다.
    card.innerHTML = `<span class="l-ic"><i class="hb-ic"></i></span>`
      + `<span class="l-n"></span><span class="l-syn2"></span><span class="l-d"></span>`
    ;(card.querySelector('.hb-ic') as HTMLElement).classList.add(`i-${opt.id}`)
    ;(card.querySelector('.l-n') as HTMLElement).textContent = opt.title
    ;(card.querySelector('.l-syn2') as HTMLElement).textContent = opt.origin
    ;(card.querySelector('.l-d') as HTMLElement).textContent = opt.desc
    card.addEventListener('click', () => finish(idx))
    grid.appendChild(card)
  }
  panel.appendChild(grid)

  o.show('fork', { sticky: true })
}

/**
 * 보스 보급 3택 (docs/RUN.md · game/supply.ts). onPick은 정확히 한 번.
 * 건너뛰기가 없다 — 보급은 상이지 숙제가 아니라, 안 받을 이유가 없다.
 */
export function mountSupply(
  o: Overlay,
  offer: readonly ArrowKindId[],
  count: number,
  stock: Readonly<Record<string, number>>,
  /** 0보다 크면 회복 카드가 선다 — 잃은 체력이 있을 때만 (감사·형의 주문). */
  heal: number,
  onPick: (id: ArrowKindId | 'heal') => void,
): void {
  const panel = o.panel('supply')
  panel.replaceChildren()
  panel.setAttribute('aria-label', '보스 보급')

  const style = document.createElement('style')
  style.textContent = CSS
  panel.appendChild(style)

  const head = document.createElement('div')
  head.className = 'l-h'
  head.innerHTML = '<h2>보급</h2>'
  const sub = document.createElement('p')
  sub.className = 'hb-lead'
  sub.textContent = `보스를 잡았다. 하나를 고른다 — ${count}발이 살통에 들어온다.`
  panel.append(head, sub)

  const grid = document.createElement('div')
  grid.className = 'l-grid'
  let done = false
  let healCard: HTMLButtonElement | null = null
  const onVisibility = (): void => {
    if (!document.hidden && !done) o.show('supply')
  }
  document.addEventListener('visibilitychange', onVisibility, true)
  const finish = (id: ArrowKindId): void => {
    if (done) return
    done = true
    document.removeEventListener('visibilitychange', onVisibility, true)
    o.hide(true)
    onPick(id)
  }
  for (const id of offer) {
    const k = ARROW_KINDS.find((a) => a.id === id)
    if (k === undefined) continue
    const card = document.createElement('button')
    card.type = 'button'
    card.className = 'hb-card l-card'
    // 아이콘은 효과의 그림풀이다 — 이름을 읽기 전에 무슨 살인지 짐작돼야 한다.
    card.style.setProperty('--tint', ARROW_TINT[id])
    card.innerHTML =
      `<span class="l-ic">${arrowIconSvg(id, 30)}</span>` +
      `<span class="l-n"></span><span class="l-syn2"></span><span class="l-d"></span><span class="l-d"></span>`
    const parts = card.querySelectorAll('.l-d')
    ;(card.querySelector('.l-n') as HTMLElement).textContent = `${k.name} +${count}발`
    // 선택의 근거는 재고다 — '지금 몇 발인가'가 없으면 3택이 감이 된다 (감사 UI).
    const have = Math.floor(stock[id] ?? Number.NaN)
    ;(card.querySelector('.l-syn2') as HTMLElement).textContent = Number.isFinite(have)
      ? `지금 ${have}발 → ${have + count}발`
      : '처음 얻는 살'
    ;(parts[0] as HTMLElement).textContent = k.origin
    ;(parts[1] as HTMLElement).textContent = k.desc
    card.addEventListener('click', () => finish(id))
    grid.appendChild(card)
  }
  if (heal > 0) {
    // 회복 — 화살 대신 몸을 고른다. 체력을 되찾는 유일한 길이라 셋과 나란히 설 자격이 있다.
    healCard = document.createElement('button')
    healCard.type = 'button'
    healCard.className = 'hb-card l-card'
    healCard.style.setProperty('--tint', '#7fd6c8')
    healCard.innerHTML =
      `<span class="l-ic"><svg width="30" height="30" viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M14 6v16M6 14h16" /></svg></span>` +
      `<span class="l-n">숨을 고른다</span><span class="l-syn2">기력 +${heal}</span>` +
      `<span class="l-d">화살 대신 몸을 추스른다.</span>`
    healCard.addEventListener('click', () => finish2())
    grid.appendChild(healCard)
  }
  const finish2 = (): void => {
    if (done) return
    done = true
    document.removeEventListener('visibilitychange', onVisibility, true)
    o.hide(true)
    onPick('heal')
  }
  panel.appendChild(grid)
  o.show('supply', { sticky: true })
}
