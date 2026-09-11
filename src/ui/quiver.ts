/**
 * 살통 — **돌려서 고른다** (docs/RUN.md · game/supply.ts)
 *
 * 형: **"화살 아직도 게임화면에서 하나하나 버튼인데 이거 리볼빙되듯 만들어야 한다니까?"**
 *
 * 맞는 말이었다. 예전엔 살 하나에 버튼 하나였다. 그러면 **살이 늘수록 줄이 길어지고**,
 * 좁은 화면에서 그 줄이 접히면서 궁수를 덮었다 (형: "몇 스테이지 가면 버튼이 캐릭터를 가린다").
 * 자리가 종류 수에 비례하는 UI 는 늘 언젠가 화면을 먹는다.
 *
 * 이제 자리는 **하나**다 (ui/wheel.ts 의 슬림 걸이). 돌리면 다음 살이 앞으로 오고,
 * 앞에 나온 살이 곧 드는 살이다. 종류가 아홉이 되어도 넓이가 안 변한다.
 *
 * ── 규칙 ──────────────────────────────────────────────────────────────
 * 1. **유엽전이 걸이의 첫 칸이다.** 무한이라 버튼이 없던 살인데, 걸이에서는 자리가 있어야
 *    "특수살을 내려놓는다"가 **돌리는 동작 하나**로 된다 (예전엔 같은 버튼을 두 번 누르는
 *    숨은 규칙이었다).
 * 2. **다 쓴 살에도 멈출 수 있다.** 0발이 보여야 아쉽다. 다만 들리지는 않는다 —
 *    그때는 유엽전으로 돌아가고, 아래 한 줄이 왜인지 말한다.
 * 3. 바꿔 드는 것은 **그 자리에서**다 (형: "클릭한 걸 지금 당장 들고 있어야지").
 *    loop 가 세이브 통지를 받아 즉시 장전한다. 소모는 쏠 때 발당 1이다.
 * 4. 재고가 있(었)는 살만 걸린다 — 한 번도 못 가져본 살은 보이지 않는 것이 맞다.
 */
import { ARROW_KINDS, DEFAULT_ARROW, arrowKind, type ArrowKindId } from '../game/arrows.ts'
import { ARROW_TINT, arrowIconSvg } from './arrowicons.ts'
import { onSaveChanged, writeSave, type SaveData } from '../game/save.ts'
import type { Overlay } from './overlay.ts'
import { makeWheel, type Wheel } from './wheel.ts'

const CSS = `
.q-wrap { display: flex; flex-direction: column; align-items: flex-start; }
.q-hint { color: var(--mute); font-size: 11px; letter-spacing: .08em; margin-bottom: 3px; }
.q-hint.q-hint-new { color: var(--accent); }
/* 걸이 카드 안쪽 — 아이콘·이름·남은 수. 좁으니 이름은 넓을 때만 나온다. */
.q-card { display: inline-flex; align-items: center; gap: 7px; }
.q-card .q-ic { color: var(--tint); line-height: 0; }
.q-card b { font-size: 13px; color: var(--accent); font-family: var(--num); }
.q-card .q-name { font-size: 13px; color: var(--ink); }
.wh-slim .wh-card.q-empty { opacity: .5; }
/* 아직 한 번도 안 들어 본 살 — 카드가 숨 쉰다. 앞에 세우는 순간 멎는다 (save.armedArrows). */
.wh-slim .wh-card.q-new { animation: q-breathe 1.4s ease-in-out infinite; }
@keyframes q-breathe {
  0%, 100% { box-shadow: 0 0 0 0 rgba(226, 176, 80, 0); }
  50% { box-shadow: 0 0 0 5px rgba(226, 176, 80, .35); }
}
@media (prefers-reduced-motion: reduce) {
  .wh-slim .wh-card.q-new { animation: none; box-shadow: 0 0 0 3px rgba(226, 176, 80, .35); }
}
/* 폰·낮은 화면 — 이름을 빼고 아이콘과 수만. 걸이라 **줄 수는 그대로**다. */
@media (max-width: 640px), (max-height: 560px) {
  .q-hint { display: none; }
  .q-card .q-name { display: none; }
}
`

export function mountQuiver(o: Overlay, d: SaveData): void {
  const wrap = document.createElement('div')
  wrap.className = 'q-wrap'
  const style = document.createElement('style')
  style.textContent = CSS
  const hint = document.createElement('div')
  hint.className = 'q-hint'
  wrap.append(style, hint)
  o.hud().appendChild(wrap)

  /** 걸이에 걸리는 살 — 유엽전이 첫 칸, 그다음은 가져본 적 있는 살들. */
  function ring(): ArrowKindId[] {
    const out: ArrowKindId[] = [DEFAULT_ARROW]
    for (const k of ARROW_KINDS) {
      if (k.id === DEFAULT_ARROW) continue
      // 키가 있으면 가져본 적 있는 살이다. 0발이어도 자리는 남는다 — "다 썼다"가 보여야 아쉽다.
      if (!Number.isFinite(Math.floor(d.arrowStock[k.id] ?? Number.NaN))) continue
      out.push(k.id)
    }
    return out
  }

  const stockOf = (id: ArrowKindId): number =>
    id === DEFAULT_ARROW ? Number.POSITIVE_INFINITY : Math.floor(d.arrowStock[id] ?? 0)

  /** 카드 겉면 — 아이콘 · 이름 · 남은 수. 유엽전은 무한이라 수를 안 쓴다. */
  function face(id: ArrowKindId): string {
    const n = stockOf(id)
    const count = id === DEFAULT_ARROW ? '' : `<b>×${n}</b>`
    return `<span class="q-card" style="--tint:${ARROW_TINT[id] ?? '#ffb347'}">`
      + `<span class="q-ic">${arrowIconSvg(id, 20)}</span>`
      + `<span class="q-name">${arrowKind(id).name}</span>${count}</span>`
  }

  let ids = ring()
  let wheel: Wheel | null = null

  /** 앞에 나온 살을 든다. 다 쓴 살이면 안 들고 유엽전으로 돌아간다. */
  function take(id: ArrowKindId): void {
    if (stockOf(id) <= 0 && id !== DEFAULT_ARROW) {
      d.runArrow = DEFAULT_ARROW
    } else {
      d.runArrow = id
      // 한 번이라도 앞에 세웠으면 '새 살'이 아니다 — 숨쉬기를 멈춘다.
      if (id !== DEFAULT_ARROW && d.armedArrows.indexOf(id) < 0) d.armedArrows.push(id)
    }
    writeSave(d)
  }

  const refresh = (): void => {
    const next = ring()
    const changed = next.length !== ids.length || next.some((v, i) => v !== ids[i])
    ids = next
    // 살이 하나뿐(유엽전)이면 고를 것이 없다 — 걸이를 아예 안 보여준다.
    wrap.style.display = ids.length > 1 ? '' : 'none'
    if (ids.length <= 1) return

    if (wheel === null) {
      wheel = makeWheel({
        slim: true,
        label: '살통',
        items: ids.map((id) => ({ id, html: face(id) })),
        onPick: (id) => {
          take(id as ArrowKindId)
          refresh()
        },
      })
      wrap.appendChild(wheel.el)
    } else if (changed) {
      wheel.set(ids.map((id) => ({ id, html: face(id) })))
    } else {
      // 수만 바뀐 경우 — 자리를 지키며 겉면만 다시 채운다.
      wheel.set(ids.map((id) => ({ id, html: face(id) })))
    }

    // 들고 있는 살을 앞으로 (다른 곳에서 바뀌었을 수 있다 — 살통이 비어 유엽전으로 돌아간 경우).
    const at = ids.indexOf(d.runArrow as ArrowKindId)
    if (at >= 0 && at !== wheel.index()) wheel.to(at, true)

    // 카드 꾸밈 — 다 쓴 살은 흐리고, 한 번도 안 들어 본 살은 숨 쉰다.
    let fresh = 0
    const cards = wheel.cards()
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i]
      const card = cards[i]
      if (id === undefined || card === undefined) continue
      const n = stockOf(id)
      const isNew = id !== DEFAULT_ARROW && n > 0 && d.armedArrows.indexOf(id) < 0
      if (isNew) fresh++
      card.classList.toggle('q-empty', n <= 0)
      card.classList.toggle('q-new', isNew)
    }

    const held = d.runArrow as ArrowKindId
    hint.textContent = fresh > 0 && held === DEFAULT_ARROW
      ? '새 살이 들어왔다 — 돌려서 앞에 세우면 든다'
      : held === DEFAULT_ARROW
        ? '살통 — 돌리면 바로 바꿔 든다 · 쏠 때마다 1발씩 준다'
        : `들고 있음: ${arrowKind(held).name}`
    hint.className = 'q-hint' + (fresh > 0 && held === DEFAULT_ARROW ? ' q-hint-new' : '')
  }

  refresh()
  onSaveChanged(refresh)
}
