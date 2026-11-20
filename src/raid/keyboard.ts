/** 화면에 열린 상자를 먼저 처리해 전투 입력과 확인 입력이 겹치지 않게 한다. */
const visible = (e: HTMLElement | null): e is HTMLElement => !!e && !e.closest('[hidden]') && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden'
const buttons = (root: ParentNode, selector: string) => Array.from(root.querySelectorAll<HTMLButtonElement>(selector)).filter(b => visible(b) && !b.disabled)

export function raidShortcut(e: KeyboardEvent, root: HTMLElement, pause: () => void, closeTree: () => void) {
  // 기본 브라우저 단축키·입력칸·한글 조합은 전투 입력에도 넘기지 않는다.
  if (e.altKey || e.ctrlKey || e.metaKey || e.isComposing || e.target instanceof HTMLElement && (e.target.isContentEditable || !!e.target.closest('input,textarea,select'))) return true
  const tree = root.querySelector<HTMLElement>('#tree-view'), refund = root.querySelector<HTMLElement>('#refund-ask'), shop = root.querySelector<HTMLElement>('#shop'), overlay = root.querySelector<HTMLElement>('#overlay'), menu = root.querySelector<HTMLElement>('#menu')
  const box = [tree, refund, shop, overlay, menu].find(visible)
  const tap = (b: HTMLButtonElement | undefined) => { if (!b) return false; e.preventDefault(); if (!e.repeat) b.click(); return true }
  if (e.key === 'Escape' || e.key.toLowerCase() === 'p' || e.code === 'KeyP') {
    e.preventDefault()
    if (!e.repeat) {
      if (box === tree) closeTree()
      else if (box === refund) buttons(root, '#refund-no')[0]?.click()
      else if (box === shop) buttons(root, '#close-shop')[0]?.click()
      else pause()
    }
    return true
  }
  if (!box) return false
  if (/^[1-9]$/.test(e.key) && box === overlay) {
    const choices = buttons(box, '.choices [data-up]'), result = buttons(box, '.result-acts button')
    return tap((choices.length ? choices : result)[Number(e.key) - 1])
  }
  if (e.key !== 'Enter' && e.key !== ' ') return false
  const focused = document.activeElement
  if (focused instanceof HTMLButtonElement && box.contains(focused) && visible(focused) && !focused.disabled) return tap(focused)
  const selector = box === tree ? '.tree-close' : box === refund ? '#refund-yes' : box === shop ? '#close-shop' : box === overlay ? '#resume,.result-acts .primary' : '#start'
  return tap(buttons(box, selector)[0])
}

export function keyHints(root: HTMLElement) {
  const mark = (b: HTMLButtonElement | null, key: string) => {
    if (!b) return
    b.classList.add('key-target'); b.setAttribute('aria-keyshortcuts', key === 'P' ? 'Escape P' : key === 'Enter' ? 'Enter Space' : key)
    let hint = b.querySelector<HTMLElement>(':scope > .key-hint')
    if (!hint) { hint = document.createElement('kbd'); hint.className = 'key-hint'; hint.setAttribute('aria-hidden', 'true'); b.appendChild(hint) }
    hint.textContent = key
  }
  for (const id of ['start', 'resume', 'close-shop', 'refund-yes']) mark(root.querySelector<HTMLButtonElement>(`#${id}`), 'Enter')
  mark(root.querySelector<HTMLButtonElement>('#pause'), 'P'); mark(root.querySelector<HTMLButtonElement>('.tree-close'), 'Esc')
  root.querySelectorAll<HTMLButtonElement>('.choices [data-up]').forEach((b, i) => mark(b, String(i + 1)))
  root.querySelectorAll<HTMLButtonElement>('.result-acts button').forEach((b, i) => mark(b, String(i + 1)))
}
