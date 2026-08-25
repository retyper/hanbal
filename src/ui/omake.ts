/**
 * 오마케 — 실험장 (형의 주문: "내가 직접 적들 소환하고 테스트해볼 수 있게").
 *
 * 기록에 아무것도 남기지 않는 모래판이다. 판 점프도 여기 있다 —
 * "맨날 1탄부터 수십 탄까지 깨러 가야 하는" 비효율의 해답 (개발 중 확인용).
 * 성장 화면 하단의 버튼으로 들어오고, 나가면 하던 여정의 그 판으로 돌아간다.
 */
import type { Overlay } from './overlay.ts'

export interface OmakeHooks {
  enter(): void
  exit(): void
  spawn(kind: string): void
  refill(): void
  /** 1부터 세는 판 번호로 여정을 옮긴다 (실험장이 아니라 실제 여정 이동). */
  jump(no: number): void
}

const CSS = `
.o-bar {
  position: absolute; top: 64px; right: 18px; display: none; flex-direction: column;
  gap: 6px; align-items: flex-end; pointer-events: auto;
}
.o-bar.on { display: flex; }
.o-bar .hb-btn { font-size: 12px; padding: 6px 10px; }
.o-row { display: flex; gap: 6px; }
.o-tag { color: var(--mute); font-size: 11px; letter-spacing: .12em; }
.o-jump { width: 64px; background: #121a23; border: 1px solid #26313d; color: var(--ink);
  font: inherit; font-size: 12px; padding: 6px 8px; border-radius: 2px; }
`

const SPAWNS: ReadonlyArray<readonly [string, string]> = [
  ['static', '과녁'],
  ['moving', '이동'],
  ['aerial', '공중'],
  ['bonus', '보급'],
  ['charger', '돌진'],
  ['archer', '적 궁수'],
  ['archer-armored', '갑옷병'],
  ['window', '창문 사수'],
  ['peek', '숨는 사수'],
  ['drone', '드론'],
  ['bonus-heal', '기력 보급'],
  ['boss-0', '눈알귀신'],
  ['boss-1', '갑주귀신'],
  ['boss-2', '쌍눈귀신'],
  ['boss-3', '폭주귀신'],
]

export function mountOmake(o: Overlay, hooks: OmakeHooks): void {
  const style = document.createElement('style')
  style.textContent = CSS
  const bar = document.createElement('div')
  bar.className = 'o-bar'
  o.root.appendChild(style)
  o.root.appendChild(bar)

  let on = false
  const tag = document.createElement('div')
  tag.className = 'o-tag'
  tag.textContent = '오마케 — 기록에 남지 않는다'
  bar.appendChild(tag)

  // 소환 버튼들 — 두 줄로
  for (const chunk of [SPAWNS.slice(0, 5), SPAWNS.slice(5, 11), SPAWNS.slice(11)]) {
    const row = document.createElement('div')
    row.className = 'o-row'
    for (const [kind, label] of chunk) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'hb-btn'
      b.textContent = label
      b.addEventListener('click', () => hooks.spawn(kind))
      row.appendChild(b)
    }
    bar.appendChild(row)
  }

  const util = document.createElement('div')
  util.className = 'o-row'
  const mk = (label: string, fn: () => void): void => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'hb-btn'
    b.textContent = label
    b.addEventListener('click', fn)
    util.appendChild(b)
  }
  mk('화살 +10', () => hooks.refill())
  mk('나가기', () => {
    on = false
    bar.classList.remove('on')
    hooks.exit()
  })
  bar.appendChild(util)

  // 판 점프 — 실험장이 아니라 실제 여정 이동. 개발 중 수십 판을 깨러 가지 않기 위한 문이다.
  const jumpRow = document.createElement('div')
  jumpRow.className = 'o-row'
  const input = document.createElement('input')
  input.className = 'o-jump'
  input.type = 'number'
  input.min = '1'
  input.placeholder = '판 번호'
  const go = document.createElement('button')
  go.type = 'button'
  go.className = 'hb-btn'
  go.textContent = '판 이동'
  go.addEventListener('click', () => {
    const n = Math.floor(Number(input.value))
    if (Number.isFinite(n) && n >= 1) {
      on = false
      bar.classList.remove('on')
      hooks.jump(n)
    }
  })
  jumpRow.append(input, go)
  bar.appendChild(jumpRow)

  // 진입 버튼 — 성장 화면이 아니라 HUD 구석? 성장 화면과 무관하게 열 수 있어야 하니 HUD에 작게.
  const openBtn = document.createElement('button')
  openBtn.type = 'button'
  openBtn.className = 'hb-btn'
  openBtn.style.fontSize = '11px'
  openBtn.style.padding = '5px 8px'
  openBtn.textContent = '오마케'
  openBtn.addEventListener('click', () => {
    on = !on
    bar.classList.toggle('on', on)
    if (on) hooks.enter()
    else hooks.exit()
  })
  o.hud().appendChild(openBtn)
}
