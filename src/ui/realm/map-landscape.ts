export type CountryMeasure = { readonly width: number; readonly priority: number }
export type CountryFold = { visible: number[]; hidden: number; overflow: boolean }

/** Presentation only. The input is the existing known-country DOM order, never Realm. */
export function planCountryFold(items: readonly CountryMeasure[], capacity: number, fixedWidth: number, fixedCount: number, moreWidth: number, gap: number): CountryFold {
  const all = items.map((_, i) => i)
  const width = (ids: readonly number[], more: boolean): number => fixedWidth + ids.reduce((n, i) => n + items[i]!.width, 0) + (more ? moreWidth : 0) + Math.max(0, fixedCount + ids.length + Number(more) - 1) * gap
  if (width(all, false) <= capacity) return { visible: all, hidden: 0, overflow: false }
  const priority = [...all].sort((a, b) => items[b]!.priority - items[a]!.priority || a - b)
  const chosen: number[] = []
  for (const i of priority) if (width([...chosen, i], true) <= capacity) chosen.push(i)
  chosen.sort((a, b) => a - b)
  return { visible: chosen, hidden: items.length - chosen.length, overflow: width(chosen, true) > capacity }
}

/** Uses the original country buttons. No state, RNG, clock, frame loop or icon copies. */
export function installMapLandscape(root: HTMLElement, labels: { more: () => string; close: () => string }): { sync(): void } {
  const legend = root.querySelector<HTMLElement>('.legend')!
  const media = window.matchMedia('(orientation: landscape)')
  const more = document.createElement('button')
  more.type = 'button'
  more.className = 'legend-more'
  more.setAttribute('aria-expanded', 'false')
  let expanded = false
  let hidden = 0

  const reset = (): void => {
    for (const e of legend.querySelectorAll<HTMLElement>('[data-land-fold-hidden]')) { e.hidden = false; delete e.dataset['landFoldHidden'] }
  }
  const sync = (): void => {
    reset()
    if (!media.matches || root.classList.contains('choosing')) {
      expanded = false
      more.remove()
      delete legend.dataset['expanded']
      delete legend.dataset['foldOverflow']
      root.style.removeProperty('--land-legend-left')
      root.style.removeProperty('--land-legend-right')
      for (const e of root.querySelectorAll<HTMLElement>('[data-land-menu-tip]')) { delete e.dataset['tip']; delete e.dataset['landMenuTip'] }
      for (const e of legend.querySelectorAll<HTMLElement>('[data-land-label]')) {
        e.removeAttribute('aria-label'); delete e.dataset['landLabel']
        if (e.dataset['landTip']) { delete e.dataset['tip']; delete e.dataset['landTip'] }
      }
      return
    }
    const date = root.querySelector<HTMLElement>('.top .tl'), resources = root.querySelector<HTMLElement>('.top .tr')
    if (!date || !resources) return
    for (const e of root.querySelectorAll<HTMLElement>('.tabs button.locked')) if (!e.dataset['tip'] && e.dataset['why']) { e.dataset['tip'] = e.dataset['why']; e.dataset['landMenuTip'] = '1' }
    if (root.classList.contains('sheet-open') || root.classList.contains('modal-open') || root.classList.contains('sel-open')) expanded = false
    const r = root.getBoundingClientRect(), d = date.getBoundingClientRect(), t = resources.getBoundingClientRect()
    root.style.setProperty('--land-legend-left', `${Math.ceil(d.right - r.left + 6)}px`)
    root.style.setProperty('--land-legend-right', `${Math.ceil(r.right - t.left + 6)}px`)
    legend.dataset['expanded'] = 'false' // Measure the collapsed row once, even while the popup is open.
    const countries = [...legend.querySelectorAll<HTMLButtonElement>(':scope > .lg')]
    if (!countries.length) { more.remove(); return }
    for (const country of countries) {
      const name = country.textContent?.replace(/\s+/g, ' ').trim() ?? ''
      country.setAttribute('aria-label', name)
      country.dataset['landLabel'] = '1'
      if (!country.dataset['tip'] && !country.title) { country.dataset['tip'] = name; country.dataset['landTip'] = '1' }
    }
    if (more.parentElement !== legend) legend.appendChild(more)
    more.hidden = false
    more.textContent = `+${countries.length}` // Measure a sufficient count width before hiding any original chip.
    const fixed = [...legend.children].filter((e): e is HTMLElement => e instanceof HTMLElement && e !== more && !e.classList.contains('lg'))
    const gap = Number.parseFloat(getComputedStyle(legend).columnGap) || 0
    const fold = planCountryFold(countries.map(e => ({ width: e.getBoundingClientRect().width, priority: e.classList.contains('me') ? 2 : e.classList.contains('on') ? 1 : 0 })), legend.clientWidth, fixed.reduce((n, e) => n + e.getBoundingClientRect().width, 0), fixed.length, more.getBoundingClientRect().width, gap)
    hidden = fold.hidden
    if (!hidden) expanded = false
    if (!expanded) {
      const visible = new Set(fold.visible)
      countries.forEach((e, i) => { if (!visible.has(i)) { e.hidden = true; e.dataset['landFoldHidden'] = '1' } })
    }
    legend.dataset['expanded'] = String(expanded)
    more.hidden = hidden === 0
    more.textContent = `${expanded ? '−' : '+'}${hidden}`
    more.setAttribute('aria-expanded', String(expanded))
    more.setAttribute('aria-label', `${expanded ? labels.close() : labels.more()} (${hidden})`)
    more.dataset['tip'] = more.getAttribute('aria-label')!
    legend.dataset['foldOverflow'] = String(fold.overflow)
  }
  more.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); expanded = !expanded; sync() })
  legend.addEventListener('click', e => { if (e.target instanceof Element && e.target.closest('.lg')) expanded = false })
  legend.addEventListener('keydown', e => { if (e.key === 'Escape' && expanded) { e.preventDefault(); e.stopPropagation(); expanded = false; sync(); more.focus() } })
  root.addEventListener('pointerdown', e => { if (expanded && e.target instanceof Node && !legend.contains(e.target)) { expanded = false; sync() } })
  media.addEventListener('change', sync)
  new ResizeObserver(sync).observe(root)
  void document.fonts.ready.then(sync)
  return { sync }
}
