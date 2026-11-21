/**
 * 열전 레벨업 · 보물 상자 카드를 고르면 (A1 · 형 11-20: 「이펙트가 판 레이아웃 경계를 넘나듦 · 소리와 딱 맞음」) —
 * 그 카드의 룬이 판 밖으로 튀어 나가 그 능력이 쓰이는 칸에 박힌다. 박히는 순간에 「고름」 소리 (land).
 *
 * 갈 곳 차례: 이어서 뜬 고르기 판의 「지금 가진 칸」(같은 그림) → 싸움판 HUD 능력 칸(#loadout) → 조합 띠(#combo-badges, 같은 그림) → 능력 칸 묶음.
 * 화면에 없거나 덮였으면(세로 폰은 고른 뒤 멈춤 판이 HUD 를 덮는다 · 숨은 조합 띠) 그 자리에서 부풀었다 사라지고 그 꼭대기에서 소리. 판 상태는 읽지도 쓰지도 않는다.
 */
import { flyOut, onScreen, takeAfterimage, type Afterimage, type Box } from '../ui/fx/flyout.ts'

/** 고르기 전에 적어 둔 카드 룬 — 자리 · 그림 · 그림의 표(빌린 그림 빛깔) · 갈래 빛깔 · 판의 잔상(고른 카드는 빈자리) */
export interface PickFrom { readonly box: Box; readonly img: string | null; readonly cls: string; readonly color: string; readonly after: Afterimage | null }

/** 고르기 전에 — 고르면 판이 다시 그려지거나 닫혀 카드가 사라지므로, 지금 보이는 룬의 자리(흔들려 기운 그대로)와 그림 · 판의 잔상을 떠 둔다 */
export function pickFrom(card: HTMLElement): PickFrom {
  const im = card.querySelector<HTMLImageElement>('.rune img')
  const q = (im ?? card).getBoundingClientRect()
  const cs = getComputedStyle(card)
  return { box: { left: q.left, top: q.top, width: q.width, height: q.height }, img: im?.getAttribute('src') ?? null, cls: im?.className ?? '', color: cs.getPropertyValue('--c').trim() || cs.getPropertyValue('--accent').trim(), after: takeAfterimage(card.closest('.panel'), card) }
}

/**
 * 고른 뒤 — 판이 다시 그려지고 HUD 가 새 칸을 단 다음에 부른다. 돌려주는 값 = 박힐 때까지(ms).
 * land(초) — 날기가 시작될 때 박힐 때까지 남은 초를 받아 소리 시계로 건다 (그 사이 판이 바빠도 박히는 순간에 난다)
 */
export function flyPick(from: PickFrom, key: string, land: (inSec: number) => void, doc: Document = document): number {
  const w = doc.defaultView
  /** 화면 안이고 다른 판에 덮이지 않은 칸 (세로 폰은 고른 뒤 멈춤 판이 HUD 를 덮는다) */
  const seen = (e: Element | null | undefined): HTMLElement | null => {
    if (e == null || w === null || !(e instanceof HTMLElement)) return null
    const q = e.getBoundingClientRect()
    if (!onScreen(q, w.innerWidth, w.innerHeight)) return null
    const top = doc.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2)
    return top !== null && (top === e || e.contains(top)) ? e : null
  }
  /** 같은 그림을 단 칸 (능력 그림은 능력마다 하나) */
  const same = (sel: string): HTMLElement | null => {
    if (from.img === null) return null
    for (const im of doc.querySelectorAll<HTMLImageElement>(sel)) if (im.getAttribute('src') === from.img) { const v = seen(im.parentElement); if (v !== null) return v }
    return null
  }
  const overlay = doc.getElementById('overlay')
  const target = (overlay !== null && !overlay.hidden ? same('#overlay .lv-have img') : null)
    ?? seen(doc.querySelector(`#loadout .power-slot[data-power="${key}"]`))
    ?? same('#combo-badges img')
    ?? seen(doc.getElementById('loadout'))
  // 이어서 고르기 판이 또 떴으면 그 판이 잔상을 덮으니 잔상은 띄우지 않는다
  const after = overlay !== null && !overlay.hidden ? null : from.after
  return flyOut({ after, from: from.box, to: target?.getBoundingClientRect() ?? null, img: from.img, imgClass: from.cls, ...(from.color !== '' ? { color: from.color } : {}), pulse: target, cue: land }, doc)
}
