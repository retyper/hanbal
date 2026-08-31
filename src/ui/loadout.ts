/**
 * 여정의 시작과 끝 (docs/RUN.md)
 *
 * 시작: 활 한 자루 + 살통 하나를 고른다. **이 조합이 런의 빌드다** — 판마다 3택을
 * 강요하던 옛 드래프트를 대체한다 (형의 반려: "과녁이 화살보다 많으면 사실상 1택").
 *
 * 끝: 도달한 판과 점수를 보여준다. 결과 화면에 가두지 않는다 — 클릭 한 번이면
 * 다음 여정의 로드아웃이다 (C1).
 */
import { ARROW_KINDS, type ArrowKindId } from '../game/arrows.ts'
import { ARROW_TINT, arrowIconSvg, bowIconSvg } from './arrowicons.ts'
import { BOW_KINDS, bowKind, masteryLevel, type BowKindId } from '../game/bows.ts'
import { unlockOfBow } from '../game/unlocks.ts'
import type { ForkOption } from '../game/forks.ts'
import type { Overlay } from './overlay.ts'

const PANEL_ID = 'loadout'
const OVER_ID = 'runover'

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
.l-card .l-ic { color: var(--tint); line-height: 0; margin-bottom: 2px; }
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

.o-wrap { text-align: center; padding: 8px 0 4px; }
.o-reach { font-size: 15px; color: var(--dim); letter-spacing: .1em; }
.o-stage { font-size: 52px; font-weight: 700; color: var(--ink); font-family: var(--num); line-height: 1.2; }
@media (max-width: 640px) { .o-stage { font-size: 44px; } .l-h h2 { font-size: 26px; } }
.o-score { color: var(--body); margin-top: 4px; }
.o-new { color: var(--accent); font-weight: 700; margin-top: 10px; }
.o-old { color: var(--dim); margin-top: 10px; }
/* 남은 것 — 기록 줄보다 밝게. "죽었다"가 아니라 "가져간다"가 이 화면의 마지막 말이어야 한다. */
.o-keep { color: var(--body); margin-top: 14px; font-size: 14px; }
.o-keep b { color: var(--accent); font-weight: 700; }
.o-dot { color: var(--dim); margin: 0 8px; }
.o-foot { margin-top: 22px; display: flex; gap: 10px; justify-content: center; }
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

/** 여정 종료 화면. 클릭 한 번이면 닫히고 onNext — 결과에 가두지 않는다 (C1). */
export function showRunOver(
  o: Overlay,
  reached: number,
  score: number,
  best: number,
  isNew: boolean,
  first: boolean,
  reason: 'defeat' | 'abandon' | 'death',
  summary: { training: number; stars: number; jung: number; molgi: boolean },
  onNext: (mode: 'again' | 'loadout') => void,
): void {
  const panel = o.panel(OVER_ID)
  panel.replaceChildren()
  panel.setAttribute('aria-label', '여정 종료')

  const style = document.createElement('style')
  style.textContent = CSS
  panel.appendChild(style)

  const wrap = document.createElement('div')
  wrap.className = 'o-wrap'
  // 이번 여정이 **영구히** 남긴 것만 센다. 판별 점수처럼 여정과 함께 사라지는 건 안 쓴다 —
  // "가져간다"고 써놓고 안 가져가면 그 줄은 다음부터 아무도 안 읽는다.
  const keeps: string[] = []
  if (summary.training > 0) keeps.push(`훈련치 <b>${summary.training}</b>`)
  if (summary.stars > 0) keeps.push(`별 <b>${summary.stars}</b>`)
  if (summary.molgi) keeps.push(`<b>몰기</b>`)
  else if (summary.jung >= 3) keeps.push(`최고 <b>${summary.jung}중</b>`)
  const lead = reason === 'death'
    ? '쓰러졌다 — 이번 여정은'
    : reason === 'abandon'
      ? '여정을 접었다 — 이번은'
      : '화살이 다했다 — 이번 여정은'
  wrap.innerHTML =
    `<div class="o-reach">${lead}</div>` +
    `<div class="o-stage">${reached}판</div>` +
    `<div class="o-score">점수 <b>${score}</b></div>` +
    (first
      ? `<div class="o-old">첫 기록 — 여기서부터 시작이다</div>`
      : isNew
        ? `<div class="o-new">최고 기록 경신</div>`
        : `<div class="o-old">최고 기록 ${best}판</div>`) +
    // ── 남은 것 ── 로그라이트의 종료 화면은 벌이 아니라 **다음 런의 발사대**다.
    // 여기 아무것도 없으면 화면이 하는 말은 "너 죽었다" 하나뿐이고, 그건 다시 설 이유가 못 된다.
    // 0인 항목은 아예 안 쓴다 — '훈련치 0'은 위로가 아니라 조롱이다.
    (keeps.length > 0 ? `<div class="o-keep">가져간다 &nbsp;${keeps.join('<span class="o-dot">·</span>')}</div>` : '') +
    // 재도전의 마찰은 클릭 하나면 족하다 — 다수 경로(같은 활)가 주 버튼이다 (감사 UI P1).
    `<div class="o-foot"><button class="hb-btn hb-pri l-go" data-m="again" type="button">같은 활로 다시 나선다 →</button>` +
    `<button class="hb-btn" data-m="loadout" type="button">채비 바꾸기</button></div>`
  panel.appendChild(wrap)

  let done = false
  const onVisibility = (): void => {
    if (!document.hidden && !done) o.show(OVER_ID)
  }
  document.addEventListener('visibilitychange', onVisibility, true)
  for (const btn of Array.from(wrap.querySelectorAll('button'))) {
    btn.addEventListener('click', () => {
      if (done) return
      done = true
      document.removeEventListener('visibilitychange', onVisibility, true)
      o.hide(true)
      onNext((btn as HTMLButtonElement).dataset['m'] === 'again' ? 'again' : 'loadout')
    })
  }
  o.show(OVER_ID, { sticky: true })
}

/** 갈림길 카드의 밑색 — 바람골은 하늘, 밀집은 위험. game/forks.ts의 id로 고른다. */
const FORK_TINT: Record<string, string> = { wind: '#7fd6c8', dense: '#ff8f5d' }

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
    card.innerHTML = `<span class="l-n"></span><span class="l-syn2"></span><span class="l-d"></span>`
    ;(card.querySelector('.l-n') as HTMLElement).textContent = `${idx + 1}) ${opt.title}`
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
