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
import { ARROW_TINT, arrowIconSvg } from './arrowicons.ts'
import { bowKind, masteryLevel, type BowKindId } from '../game/bows.ts'
import { wipeSave } from '../game/save.ts'
import type { Overlay } from './overlay.ts'

const PANEL_ID = 'loadout'
const OVER_ID = 'runover'

const CSS = `
.l-h { display: flex; align-items: baseline; gap: 14px; }
.l-h h2 { flex: 1; }
.l-best { color: var(--dim); font-size: 13px; letter-spacing: .08em; }
.l-best b { color: var(--accent); font-size: 20px; margin-left: 6px; }
.l-sec { color: var(--dim); font-size: 13px; letter-spacing: .12em; margin: 18px 0 8px; }
.l-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
.l-card {
  display: flex; flex-direction: column; gap: 3px; text-align: left; padding: 12px 14px;
  border: 1px solid #212b36; background: #101720e6; border-radius: 2px; cursor: pointer;
  font: inherit; color: var(--body);
}
.l-card:hover { background: #1e2934; }
.l-card .l-ic { color: var(--tint); line-height: 0; margin-bottom: 2px; }
.l-card .l-n { color: var(--ink); font-weight: 700; font-size: 15px; }
.l-card .l-d { color: var(--dim); font-size: 12px; line-height: 1.45; }
.l-card.l-on { border-color: var(--teal); background: #14231f; }
.l-card.l-on .l-n { color: var(--teal); }
.l-syn { color: var(--teal); font-size: 13px; min-height: 22px; margin-top: 12px; }
.l-foot { display: flex; align-items: center; gap: 14px; margin-top: 8px; }
/* 전체 초기화 — 개발 단계의 필수품. 시작 버튼과 헷갈리지 않게 구석에 작게, 위험색은 무장 후에만. */
.l-wipe { margin-left: auto; font-size: 12px; color: var(--mute); }
.l-wipe.l-armed { color: #ff6a45; border-color: #ff6a4577; }
.l-go { font-size: 17px; padding: 13px 26px; }
.l-go:not([disabled]) { border-color: var(--accent); color: var(--accent); }

.o-wrap { text-align: center; padding: 8px 0 4px; }
.o-reach { font-size: 15px; color: var(--dim); letter-spacing: .1em; }
.o-stage { font-size: 52px; font-weight: 700; color: var(--ink); font-family: var(--num); line-height: 1.2; }
.o-score { color: var(--body); margin-top: 4px; }
.o-new { color: var(--accent); font-weight: 700; margin-top: 10px; }
.o-old { color: var(--dim); margin-top: 10px; }
.o-foot { margin-top: 22px; }
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
  onStart: (pick: LoadoutPick) => void,
): void {
  const panel = o.panel(PANEL_ID)
  panel.replaceChildren()
  panel.setAttribute('aria-label', '여정 준비')

  const style = document.createElement('style')
  style.textContent = CSS
  panel.appendChild(style)

  const head = document.createElement('div')
  head.className = 'l-h'
  head.innerHTML = '<h2>여정 준비</h2>' +
    (bestRunStage > 0 ? `<div class="l-best">최고 기록<b>${bestRunStage}판</b></div>` : '')
  const sub = document.createElement('p')
  sub.className = 'hb-lead'
  sub.textContent = '활 하나를 들고 갈 수 있는 데까지 간다. 특수살은 보스가 보급한다 — 화살이 바닥나면 여정이 끝난다.'
  panel.append(head, sub)

  // 시작 선택은 지난 여정의 것. 없던 게 해금돼도 손이 기억하는 활이 먼저다.
  const pick: LoadoutPick = {
    bow: bows.includes(last.bow) ? last.bow : 'practice',
  }

  const bowCards = new Map<BowKindId, HTMLButtonElement>()
  const syn = document.createElement('div')
  syn.className = 'l-syn'

  const refresh = (): void => {
    for (const [id, el] of bowCards) el.classList.toggle('l-on', id === pick.bow)
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
  for (const id of bows) {
    const b = bowKind(id)
    const card = document.createElement('button')
    card.type = 'button'
    card.className = 'l-card'
    const lv = masteryLevel(Math.floor(bowHits[id] ?? 0))
    card.innerHTML = `<span class="l-n"></span><span class="l-d"></span>`
    ;(card.querySelector('.l-n') as HTMLElement).textContent = b.name + (lv > 0 ? ` · 숙련 ${lv}` : '')
    ;(card.querySelector('.l-d') as HTMLElement).textContent = b.perk
    card.addEventListener('click', () => {
      pick.bow = id
      refresh()
    })
    bowCards.set(id, card)
    bowGrid.appendChild(card)
  }
  panel.appendChild(bowGrid)

  panel.appendChild(syn)

  const foot = document.createElement('div')
  foot.className = 'l-foot'
  const go = document.createElement('button')
  go.type = 'button'
  go.className = 'hb-btn l-go'
  go.textContent = '여정 시작'
  foot.appendChild(go)

  // ── 전체 초기화 (형: "메모리 삭제하고 싹 처음부터 시작할 수 있는 버튼") ──
  // 성장 화면(Tab) 아래에도 같은 게 있지만, 여정 준비가 "처음부터"의 자연스러운 자리다.
  // 파괴적이라 두 번 눌러야 한다: 1번째 누름은 무장(4초 유효), 2번째가 실행.
  const wipe = document.createElement('button')
  wipe.type = 'button'
  wipe.className = 'hb-btn l-wipe'
  wipe.textContent = '기록 전부 삭제'
  let wipeTimer = 0
  wipe.addEventListener('click', () => {
    if (!wipe.classList.contains('l-armed')) {
      wipe.classList.add('l-armed')
      wipe.textContent = '정말 전부 지운다?'
      window.clearTimeout(wipeTimer)
      wipeTimer = window.setTimeout(() => {
        wipe.classList.remove('l-armed')
        wipe.textContent = '기록 전부 삭제'
      }, 4000)
      return
    }
    window.clearTimeout(wipeTimer)
    wipeSave()
    // 새로고침이 가장 확실한 초기화다 — 루프·화면이 들고 있는 상태까지 전부 새로 선다.
    location.reload()
  })
  foot.appendChild(wipe)
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
    o.hide()
    onStart({ bow: pick.bow })
  })

  refresh()
  o.show(PANEL_ID)
}

/** 여정 종료 화면. 클릭 한 번이면 닫히고 onNext — 결과에 가두지 않는다 (C1). */
export function showRunOver(
  o: Overlay,
  reached: number,
  score: number,
  best: number,
  isNew: boolean,
  onNext: () => void,
): void {
  const panel = o.panel(OVER_ID)
  panel.replaceChildren()
  panel.setAttribute('aria-label', '여정 종료')

  const style = document.createElement('style')
  style.textContent = CSS
  panel.appendChild(style)

  const wrap = document.createElement('div')
  wrap.className = 'o-wrap'
  wrap.innerHTML =
    `<div class="o-reach">화살이 다했다 — 이번 여정은</div>` +
    `<div class="o-stage">${reached}판</div>` +
    `<div class="o-score">점수 <b>${score}</b></div>` +
    (isNew
      ? `<div class="o-new">최고 기록 경신</div>`
      : `<div class="o-old">최고 기록 ${best}판</div>`) +
    `<div class="o-foot"><button class="hb-btn l-go" type="button">새 여정</button></div>`
  panel.appendChild(wrap)

  let done = false
  const onVisibility = (): void => {
    if (!document.hidden && !done) o.show(OVER_ID)
  }
  document.addEventListener('visibilitychange', onVisibility, true)
  ;(wrap.querySelector('button') as HTMLButtonElement).addEventListener('click', () => {
    if (done) return
    done = true
    document.removeEventListener('visibilitychange', onVisibility, true)
    o.hide()
    onNext()
  })
  o.show(OVER_ID)
}

/**
 * 보스 보급 3택 (docs/RUN.md · game/supply.ts). onPick은 정확히 한 번.
 * 건너뛰기가 없다 — 보급은 상이지 숙제가 아니라, 안 받을 이유가 없다.
 */
export function mountSupply(
  o: Overlay,
  offer: readonly ArrowKindId[],
  count: number,
  onPick: (id: ArrowKindId) => void,
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
  sub.textContent = `보스를 잡았다. 하나 골라라 — ${count}발이 살통에 들어온다.`
  panel.append(head, sub)

  const grid = document.createElement('div')
  grid.className = 'l-grid'
  let done = false
  const onVisibility = (): void => {
    if (!document.hidden && !done) o.show('supply')
  }
  document.addEventListener('visibilitychange', onVisibility, true)
  const finish = (id: ArrowKindId): void => {
    if (done) return
    done = true
    document.removeEventListener('visibilitychange', onVisibility, true)
    o.hide()
    onPick(id)
  }
  for (const id of offer) {
    const k = ARROW_KINDS.find((a) => a.id === id)
    if (k === undefined) continue
    const card = document.createElement('button')
    card.type = 'button'
    card.className = 'l-card'
    // 아이콘은 효과의 그림풀이다 — 이름을 읽기 전에 무슨 살인지 짐작돼야 한다.
    card.style.setProperty('--tint', ARROW_TINT[id])
    card.innerHTML =
      `<span class="l-ic">${arrowIconSvg(id, 30)}</span>` +
      `<span class="l-n"></span><span class="l-d"></span><span class="l-d"></span>`
    const parts = card.querySelectorAll('.l-d')
    ;(card.querySelector('.l-n') as HTMLElement).textContent = `${k.name} +${count}발`
    ;(parts[0] as HTMLElement).textContent = k.origin
    ;(parts[1] as HTMLElement).textContent = k.desc
    card.addEventListener('click', () => finish(id))
    grid.appendChild(card)
  }
  panel.appendChild(grid)
  o.show('supply')
}
