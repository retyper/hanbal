/**
 * 판 밖 상점 「샀다!」 손맛 (11-23 형 「상점 구매할 때도 제대로 사는 기분 뜨게 좀」 · WWE 오버액션 메모리).
 * 금 숫자에서 동전이 쏟아져 산 칸으로 날아가 박히고 → 칸이 크게 부풀며 금빛으로 번쩍 · 「힘 Lv.3!」 이 솟고 · 금 숫자는 또르르 줄어든다.
 * 다 올렸으면 「최대!」 도장. 화면 전용 · 판(haebi.ts)과 무관 · 숨은 탭이면 하지 않는다(규칙 4).
 */
import { HAEBI_SHOP_FX as F } from '../tune/params.ts'

export interface BuyFx { host: HTMLElement; from: DOMRect; to: HTMLElement; goldEl: HTMLElement | null; oldGold: number; newGold: number; coinHtml: string; label: string; level: number; maxed: boolean }

/** 동전이 닿는 데 걸리는 초 (소리를 이 박자에 건다) */
export const buyArrive = (level: number) => F.fly + F.stagger * Math.min(F.coins + Math.min(F.maxExtra, level), F.coins + F.maxExtra) * .6

export function playBuyFx(o: BuyFx): void {
  if (typeof document === 'undefined' || document.hidden) return
  const to = o.to.getBoundingClientRect()
  const n = F.coins + Math.min(F.maxExtra, o.level)
  const fx0 = o.from.left + o.from.width / 2, fy0 = o.from.top + o.from.height / 2
  const fx1 = to.left + to.width / 2, fy1 = to.top + to.height * .35
  for (let i = 0; i < n; i++) {
    const c = document.createElement('span'); c.className = 'sjx-coin'; c.innerHTML = o.coinHtml
    const jx = (i % 3 - 1) * 10, jy = ((i * 7) % 5 - 2) * 6
    c.style.left = `${fx0 + jx}px`; c.style.top = `${fy0 + jy}px`
    c.style.setProperty('--dx', `${fx1 - fx0 - jx}px`); c.style.setProperty('--dy', `${fy1 - fy0 - jy}px`); c.style.setProperty('--arc', `${-F.arc - (i % 3) * 14}px`)
    c.style.animationDuration = `${F.fly}s`; c.style.animationDelay = `${i * F.stagger}s`
    o.host.appendChild(c); c.addEventListener('animationend', () => c.remove(), { once: true })
  }
  const land = (F.fly + (n - 1) * F.stagger) * 1000
  // 칸: 동전이 다 닿을 때 부풀며 번쩍 · 솟는 글자
  window.setTimeout(() => {
    if (!o.to.isConnected) return
    o.to.classList.remove('sjx-pop'); void o.to.offsetWidth; o.to.classList.add('sjx-pop'); o.to.style.setProperty('--sjx-ms', `${F.popMs}ms`); o.to.style.setProperty('--sjx-pop', String(F.pop))
    const t = document.createElement('span'); t.className = 'sjx-rise' + (o.maxed ? ' max' : ''); t.textContent = o.maxed ? `${o.label} 최대!` : `${o.label} Lv.${o.level}!`
    const r = o.to.getBoundingClientRect(); t.style.left = `${r.left + r.width / 2}px`; t.style.top = `${r.top + r.height * .2}px`
    t.style.setProperty('--rise', `${-F.rise}px`); t.style.animationDuration = `${F.lift}s`
    o.host.appendChild(t); t.addEventListener('animationend', () => t.remove(), { once: true })
  }, land)
  // 금 숫자: 또르르 줄어든다 · 빨간 「−값」
  const g = o.goldEl
  if (g) {
    const text = (v: number) => { const img = g.querySelector('img'); g.textContent = ''; if (img) g.appendChild(img); g.append(Math.round(v).toLocaleString()) }
    const t0 = performance.now(), d = F.count * 1000
    const step = (now: number) => { const k = Math.min(1, (now - t0) / d); text(o.oldGold + (o.newGold - o.oldGold) * (1 - (1 - k) ** 3)); if (k < 1 && !document.hidden) requestAnimationFrame(step); else text(o.newGold) }
    requestAnimationFrame(step)
    const m = document.createElement('span'); m.className = 'sjx-minus'; m.textContent = `−${(o.oldGold - o.newGold).toLocaleString()}`
    const rg = document.createRange(); rg.selectNodeContents(g); const r = rg.getBoundingClientRect(); m.style.left = `${r.right + 8}px`; m.style.top = `${r.top + r.height / 2}px`   // 글자 끝 바로 옆 (h2 는 판 폭 전체)
    o.host.appendChild(m); m.addEventListener('animationend', () => m.remove(), { once: true })
  }
}
