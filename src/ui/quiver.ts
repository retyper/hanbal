/**
 * 살통 — 특수살 재고와 다음 판 장전 (docs/RUN.md · game/supply.ts)
 *
 * HUD 구석의 버튼 줄이다. 누르면 **다음 판**에 그 살을 장전한다(재고 1 소모는 판이
 * 시작될 때 loop가 한다). 다시 누르면 취소. 판 도중에는 아무것도 바꾸지 않는다 —
 * 화살 종류는 판 경계에서만 바뀐다 (A1).
 *
 * 유엽전은 무한이라 버튼이 없다. 재고가 있(었)는 살만 줄에 선다 —
 * 한 번도 못 가져본 살은 보이지 않는 것이 맞다. 뭐가 있는지는 보스가 알려준다.
 */
import { ARROW_KINDS, DEFAULT_ARROW, type ArrowKindId } from '../game/arrows.ts'
import { ARROW_TINT, arrowIconSvg } from './arrowicons.ts'
import { onSaveChanged, writeSave, type SaveData } from '../game/save.ts'
import type { Overlay } from './overlay.ts'

const CSS = `
.q-row { display: flex; gap: 8px; align-items: flex-end; }
.q-btn { padding: 7px 12px; font-size: 13px; display: inline-flex; align-items: center; gap: 7px; }
.q-btn .q-ic { color: var(--tint); line-height: 0; }
.q-btn b { font-size: 13px; color: var(--accent); }
.q-btn.q-on { border-color: var(--teal); color: var(--teal); }
.q-btn.q-empty { opacity: .45; }
.q-hint { color: var(--mute); font-size: 11px; letter-spacing: .08em; margin-bottom: 4px; }
`

export function mountQuiver(o: Overlay, d: SaveData): void {
  const wrap = document.createElement('div')
  const style = document.createElement('style')
  style.textContent = CSS
  const hint = document.createElement('div')
  hint.className = 'q-hint'
  const row = document.createElement('div')
  row.className = 'q-row'
  wrap.append(style, hint, row)
  o.hud().appendChild(wrap)

  const refresh = (): void => {
    row.replaceChildren()
    let any = false
    for (const k of ARROW_KINDS) {
      if (k.id === DEFAULT_ARROW) continue
      // 키가 있으면 가져본 적 있는 살이다. 0발이어도 자리는 남는다 — "다 썼다"가 보여야 아쉽다.
      const stock = Math.floor(d.arrowStock[k.id] ?? Number.NaN)
      if (!Number.isFinite(stock)) continue
      any = true
      const btn = document.createElement('button')
      btn.type = 'button'
      const armed = d.runArrow === k.id
      btn.className = 'hb-btn q-btn' + (armed ? ' q-on' : '') + (stock <= 0 ? ' q-empty' : '')
      // 아이콘이 먼저, 이름이 다음 — 색과 도형이 글자보다 빨리 읽힌다 (ui/arrowicons.ts).
      btn.style.setProperty('--tint', ARROW_TINT[k.id])
      btn.innerHTML = `<span class="q-ic">${arrowIconSvg(k.id, 20)}</span>${k.name}<b>×${stock}</b>`
      btn.setAttribute('aria-label', `${k.name} ${stock}발${armed ? ' · 다음 판 장전됨' : ''}`)
      btn.disabled = stock <= 0 && !armed
      btn.addEventListener('click', () => {
        // 토글 — 장전을 물리면 유엽전으로 돌아간다. 재고는 판이 시작될 때에만 줄어든다.
        d.runArrow = d.runArrow === k.id ? DEFAULT_ARROW : (k.id as ArrowKindId)
        writeSave(d)
        refresh()
      })
      row.appendChild(btn)
    }
    hint.textContent = !any
      ? ''
      : d.runArrow === DEFAULT_ARROW
        ? '살통 — 누르면 다음 판에 장전 (판당 1발)'
        : `다음 판: ${ARROW_KINDS.find((a) => a.id === d.runArrow)?.name ?? ''}`
    wrap.style.display = any ? '' : 'none'
  }

  refresh()
  onSaveChanged(refresh)
}
