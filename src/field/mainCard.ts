/**
 * 조작 그림 한 장 (? 단추 · ? 키) — DOM. 키 글자 + 그림 + 세 낱말 이하, 네 묶음(장수 · 큰 수 · 무리 · 이기는 법).
 * 처음 화면에서는 가운데에 크게 떠 있다가(누름을 막지 않는다) 첫 걸음을 떼면 ? 단추로 줄어들며 날아간다.
 * ? 로 다시 열면 같은 그림이 떴다 사라지는 상자로 뜬다 (아무 데나 누르거나 Esc). 키 글자는 전부 actions.ts 표에서 읽는다.
 */
import { t } from '../i18n/index.ts'
import { P } from '../tune/params.ts'
import { keyLabel, KEYS, type ActionName } from './actions.ts'

export interface Help {
  toggle(): void
  close(): void
  /** 조작표가 열려 있는가 (큰 처음 화면 그림은 입력을 막지 않으니 세지 않는다) */
  isOpen(): boolean
  /** 처음 화면의 큰 조작표: true 면 가운데에 크게 · false 면 ? 단추로 줄어들며 사라진다 */
  big(show: boolean): void
}

const GOLD = '#ffd27a'
const CSS = `
#fd-help{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#000a;z-index:20;padding:0 calc(12px + env(safe-area-inset-right)) 0 calc(12px + env(safe-area-inset-left));box-sizing:border-box}
#fd-help[hidden]{display:none}
#fd-help.big{background:none;pointer-events:none;z-index:5;inset:calc(54px + env(safe-area-inset-top)) 0 calc(var(--fd-bar,64px) + 104px) 0;padding:0 calc(var(--fd-miniw,0px) + 24px)}
.touch #fd-help.big{bottom:calc(108px + env(safe-area-inset-bottom))}
#fd-help .card{max-width:min(820px,100%);background:#10140df2;border:1px solid ${GOLD}88;border-radius:12px;padding:10px 12px;box-sizing:border-box;color:#f3ecd8;transition:transform .65s cubic-bezier(.5,0,.8,.4),opacity .65s}
#fd-help.fly .card{transform:translate(var(--dx,0px),var(--dy,0px)) scale(.06);opacity:0}
#fd-help .gs{display:grid;grid-template-columns:1fr 1fr;gap:8px 14px}
#fd-help .g{min-width:0}
#fd-help h3{margin:0 0 3px;font-size:13px;color:${GOLD};white-space:nowrap}
#fd-help .r{display:flex;gap:4px;align-items:flex-end}
#fd-help .c{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:46px}
#fd-help kbd{font:inherit;font-size:15px;font-weight:700;color:#fff;background:#0b1a2e;border:2px solid #f3ecd8;border-bottom-width:4px;border-radius:6px;padding:1px 6px;min-width:18px;text-align:center;line-height:1.25}
#fd-help .c img{width:30px;height:30px;object-fit:contain}
#fd-help .c span{font-size:12px;line-height:1.1;white-space:nowrap}
#fd-help .rd{width:34px;height:34px;border-radius:50%;border:2px solid ${GOLD};background:#0b1a2ee6;display:flex;align-items:center;justify-content:center}
#fd-help .rd img{width:24px;height:24px}
#fd-help .stk{width:34px;height:34px;border-radius:50%;border:2px solid #f3ecd8aa;background:#fff2;position:relative}
#fd-help .stk::after{content:'';position:absolute;left:10px;top:10px;width:12px;height:12px;border-radius:50%;background:#f3ecd8}
#fd-help .mouse{width:20px;height:30px;border:2px solid #f3ecd8;border-radius:10px;position:relative;overflow:hidden;box-sizing:border-box}
#fd-help .mouse::after{content:'';position:absolute;right:0;top:0;width:8px;height:13px;background:#ff5a3c}
#fd-help .tgt{width:22px;height:22px;border-radius:50%;border:2px solid #ff6a3c;position:relative;margin:4px;box-sizing:border-box}
#fd-help .tgt::after{content:'';position:absolute;left:5px;top:5px;width:8px;height:8px;border-radius:50%;background:#ff6a3c}
#fd-help .arr{font-size:18px;color:${GOLD};align-self:center;margin:0 -2px}
#fd-help .bar{width:110px;height:16px;border-radius:8px;background:#000;border:2px solid #f3ecd8aa;position:relative;overflow:hidden;box-sizing:border-box;display:block}
#fd-help .bar b{position:absolute;left:0;top:0;bottom:0;border-radius:8px;display:block;width:14%}
#fd-help .bar.e b{background:#d6483a}
#fd-help .bar.o b{background:#2f8cff}
#fd-help .wc{gap:4px;min-width:110px}
#fd-help .wc span{font-size:13px;font-weight:700}
#fd-help .fd-mv{display:flex;align-items:center;gap:6px;margin:4px 0;font-size:16px}
#fd-help .fd-mv img{width:34px;height:34px;object-fit:contain}
#fd-help .fd-mv.beats{gap:4px;margin-top:8px}
#fd-help .x{margin:6px 0 0;font-size:12px;color:#f3ecd8aa}
#fd-help.big .x{display:none}
@media (max-height:460px){
#fd-help.big{padding:0 calc(var(--fd-miniw,0px) + 20px) 0 12px}
#fd-help .card{padding:6px 8px}
#fd-help .gs{grid-template-columns:1fr;gap:3px}
#fd-help .g{display:flex;align-items:center;gap:8px}
#fd-help h3{margin:0;width:58px;flex:none;font-size:12px;white-space:nowrap}
#fd-help .c{min-width:44px;gap:1px}
#fd-help .c img{width:22px;height:22px}
#fd-help .rd,#fd-help .stk{width:26px;height:26px}
#fd-help .rd img{width:18px;height:18px}
#fd-help .stk::after{left:7px;top:7px;width:10px;height:10px}
#fd-help kbd{font-size:13px;padding:0 5px}
#fd-help .c span{font-size:10.5px}
#fd-help .bar{width:78px;height:12px}
#fd-help .wc{min-width:78px}
#fd-help .wc span{font-size:11px}
}
@keyframes fd-pulse{0%,100%{box-shadow:0 0 0 0 ${GOLD}00}40%{box-shadow:0 0 0 6px ${GOLD}cc,0 0 16px ${GOLD}}}
#fd-helpbtn.pulse{animation:fd-pulse .55s ease-in-out 3;border-color:${GOLD}}
`

/** 조작 그림: 키 글자(폰은 둥근 단추) + 그림 + 세 낱말 이하 */
function cardHtml(base: string, touch: boolean): string {
  const kl = (a: ActionName, i = 0): string => keyLabel(KEYS[a][i] ?? '')
  const img = (p: string): string => `<img src="${base}${p}" alt="">`
  const chip = (cap: string | null, icon: string | null, label: string): string => {
    const pic = icon === null ? '' : touch ? `<i class="rd">${img(icon)}</i>` : img(icon)
    return `<div class="c">${!touch && cap !== null ? `<kbd>${cap}</kbd>` : ''}${pic}<span>${label}</span></div>`
  }
  const g = (title: string, body: string): string => `<div class="g"><h3>${title}</h3><div class="r">${body}</div></div>`
  const tgt = `<b class="arr">→</b><div class="c"><i class="tgt"></i><span>${t('field.card.aim')}</span></div>`
  const walk = touch ? `<div class="c"><i class="stk"></i><span>${t('field.card.walk')}</span></div>` : `<div class="c"><kbd>${kl('heroUp') + kl('heroLeft') + kl('heroDown') + kl('heroRight')}</kbd><span>${t('field.card.walk')}</span></div>`
  const hero = g(t('field.card.hero'), walk + chip(kl('dash'), 'flag/flag-charge.png', t('field.dash')) + chip(kl('skillQ'), 'flag/flag-art-shout.png', t('war.artName.shout')) + chip(kl('rally'), 'flag/flag-guard.png', t('field.rally')))
  const big = g(t('field.card.big'), chip(kl('cmd1'), 'flag/flag-charge.png', t('field.i.charge')) + chip(kl('cmd2'), 'flag/flag-hold.png', t('field.i.hold')) + chip(kl('cmd3'), 'flag/flag-volley.png', t('field.card.volley')) + chip(kl('cmd4'), 'flag/flag-flank.png', t('war.cmdName.flank')) + tgt)
  const send = `<b class="arr">→</b><div class="c">${touch ? '<i class="tgt" style="border-color:#ffd27a"></i>' : '<i class="mouse"></i>'}<span>${t('field.card.send')}</span></div>`
  const squads = g(t('field.card.squad'), chip(kl('pickFront'), 'icon/unit-spear.png', t('field.g.0')) + chip(kl('pickBows'), 'icon/unit-archer.png', t('field.g.1')) + chip(kl('pickHorse'), 'icon/unit-buyeo-cavalry.png', t('field.g.2')) + chip(kl('pickHero'), 'icon/unit-general.png', t('field.g.3')) + send)
  const bar = (c: string, label: string): string => `<div class="c wc"><i class="bar ${c}"><b></b></i><span>${label}</span></div>`
  const win = g(t('field.card.win'), bar('e', t('field.card.foe0')) + bar('o', t('field.card.our0')))
  return `<div class="gs">${hero}${big}${squads}${win}</div>`
}

/** 시험판(?mvp)의 조작 그림: 세 줄(키 글자 + 짧은 말) + 상성 그림 한 줄 (창 ▶ 기병 ▶ 활 ▶ 창 · 엔진 KIND_BEATS 그대로) */
function mvpCardHtml(base: string): string {
  const kb = (a: ActionName): string => `<kbd>${keyLabel(KEYS[a][0] ?? '')}</kbd>`
  const row = (body: string): string => `<div class="fd-mv">${body}</div>`
  const img = (p: string): string => `<img src="${base}${p}" alt="">`
  const pick = kb('pickFront') + kb('pickBows') + kb('pickHorse') + kb('pickHero') + `<span>${t('field.mvp.pick')}</span><b class="arr">→</b><span>${t('field.mvp.flags')}</span>` + kb('cmd1') + kb('cmd2')
  const order = `<i class="mouse"></i><span>${t('field.mvp.order')}</span>`
  const pause = `<kbd>Space</kbd><span>${t('field.mvp.pause')}</span>`
  const arr = '<b class="arr">▶</b>'
  const beats = img('icon/unit-spear.png') + arr + img('icon/unit-buyeo-cavalry.png') + arr + img('icon/unit-archer.png') + arr + img('icon/unit-spear.png')
  return row(pick) + row(order) + row(pause) + `<div class="fd-mv beats">${beats}</div>`
}

export function mountHelp(root: HTMLElement, base: string, mvp = false): Help {
  const style = document.createElement('style')
  style.textContent = CSS
  document.head.append(style)
  const box = document.createElement('div')
  box.id = 'fd-help'; box.hidden = true
  const card = document.createElement('div')
  card.className = 'card'
  box.append(card)
  root.append(box)
  let built = ''
  let flyTimer = 0
  const fill = (): void => {
    const touch = root.classList.contains('touch')
    const key = touch ? 't' : 'p'
    if (key === built) return
    built = key
    card.innerHTML = `${mvp ? mvpCardHtml(base) : cardHtml(base, touch)}<p class="x">${t('field.help.close', { k: keyLabel(KEYS.help[0] ?? '') })}</p>`
  }
  const stop = (): void => { clearTimeout(flyTimer); box.classList.remove('fly') }
  box.addEventListener('pointerdown', e => { if (box.classList.contains('big')) return; e.stopPropagation(); box.hidden = true })
  return {
    toggle() {
      stop()
      const wasBig = box.classList.contains('big') && !box.hidden
      box.classList.remove('big')
      fill()
      box.hidden = wasBig ? false : !box.hidden
    },
    close() { stop(); box.hidden = true; box.classList.remove('big') },
    isOpen() { return !box.hidden && !box.classList.contains('big') },
    big(show) {
      if (show) {
        if (!box.hidden) return
        stop(); fill(); box.classList.add('big'); box.hidden = false
        return
      }
      if (!box.classList.contains('big') || box.hidden || box.classList.contains('fly')) return
      // ? 단추 쪽으로 줄어들며 날아간다 · 도착하면 단추가 세 번 번쩍인다
      const btn = document.getElementById('fd-helpbtn')
      const cr = card.getBoundingClientRect()
      if (btn !== null) {
        const br = btn.getBoundingClientRect()
        box.style.setProperty('--dx', `${Math.round(br.left + br.width / 2 - (cr.left + cr.width / 2))}px`)
        box.style.setProperty('--dy', `${Math.round(br.top + br.height / 2 - (cr.top + cr.height / 2))}px`)
      }
      box.classList.add('fly')
      flyTimer = window.setTimeout(() => {
        box.hidden = true; box.classList.remove('big', 'fly')
        if (btn !== null) { btn.classList.add('pulse'); setTimeout(() => btn.classList.remove('pulse'), 1800) }
      }, P.field.helpFlyMs)
    },
  }
}
