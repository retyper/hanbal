/**
 * 크레딧 — 만든 이 · 그림·영상·목소리 도구 · 효과음·음악 · 글꼴 · 도트 그림(LPC) · 오픈소스.
 * 첫 화면 「더 보기」의 크레딧 화면(openCredits)과, 나중에 엔딩에서 쓸 느린 두루마리(openCreditsRoll)가 같은 본문(creditsBodyHtml)을 쓴다.
 * 글은 모두 t() (ko · en). 효과음 출처는 public/realm/sfx/CREDITS.txt 를 불러와 늘 최신으로 — 파일의 저작자·허락·주소를 그대로 싣는다.
 * 공공누리·CC BY 는 출처 표시가 이용 조건이라 이 화면을 지우거나 줄이지 말 것 (형 10-23).
 */
import { t } from '../../i18n/index.ts'
import { DEVELOPER_NAME, STUDIO_NAME, STUDIO_URL } from '../../realm/studio.ts'

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))

/** 도트 장수(연습 싸움)에 쓴 LPC 겹 — [이름, 허락, 저작자]. 옛 credits.html 의 그대로 (tools/lpc-used.json 에서 만든 것) */
const LPC: readonly (readonly [string, string, string])[] = [
  ['Body Color', 'OGA-BY 3.0 · CC-BY-SA 3.0', 'bluecarrot16, JaidynReiman, Benjamin K. Smith (BenCreating), Evert, Eliza Wyatt (ElizaWy), TheraHedwig, MuffinElZangano, Durrani, Johannes Sjölund (wulax), Stephen Challener (Redshrike), Pierre Vigier (pvigier), ElizaWy, Matthew Krohn (makrohn)'],
  ['Human Female', 'OGA-BY 3.0 · CC-BY-SA 3.0', 'bluecarrot16, Benjamin K. Smith (BenCreating), Stephen Challener (Redshrike)'],
  ['Neutral', 'OGA-BY 3.0 · CC-BY-SA 3.0', 'JaidynReiman, ElizaWy, Stephen Challener (Redshrike)'],
  ['High ponytail', 'OGA-BY 3.0', 'JaidynReiman, ElizaWy, bluecarrot16'],
  ['Longsleeve 2', 'OGA-BY 3.0', 'ElizaWy, JaidynReiman, Stephen Challener (Redshrike), Johannes Sjölund (wulax)'],
  ['Narrow sash', 'OGA-BY 3.0 · CC-BY-SA 3.0', 'bluecarrot16, Nila122'],
  ['Long Pants', 'OGA-BY 3.0', 'JaidynReiman, ElizaWy, Bluecarrot16, Johannes Sjölund (wulax), Stephen Challener (Redshrike)'],
  ['Basic Boots', 'OGA-BY 3.0 · CC-BY-SA 3.0', 'JaidynReiman, bluecarrot16, Nila122'],
  ['Solid', 'OGA-BY 3.0 · CC-BY-SA 3.0', 'bluecarrot16, JaidynReiman, Nila122'],
  ['Quiver', 'OGA-BY 3.0 · CC-BY-SA 3.0', 'Johannes Sjölund (wulax)'],
  ['Recurve', 'CC-BY-SA 3.0', 'Daniel Eddeland (daneeklu), gr3yh47, Johannes Sjölund (wulax), Pierre Vigier (pvigier)'],
  ['Hair Tie', 'OGA-BY 3.0+ · CC-BY 3.0+', 'JaidynReiman'],
  ['Ponytail2', 'OGA-BY 3.0 · CC-BY-SA 3.0', 'JaidynReiman, Manuel Riecke (MrBeast), Joe White'],
  ['Spear', 'CC-BY-SA 3.0', 'Pierre Vigier (pvigier), Johannes Sjölund (wulax), Inboxninja'],
  ['Human Male', 'OGA-BY 3.0 · CC-BY-SA 3.0', 'bluecarrot16, Benjamin K. Smith (BenCreating), Stephen Challener (Redshrike)'],
  ['Short Topknot', 'OGA-BY 3.0+ · CC-BY 3.0+ · CC-BY-SA 3.0', 'JaidynReiman'],
  ['Leather Belt', 'OGA-BY 3.0 · CC-BY-SA 3.0', 'bluecarrot16, Johannes Sjölund (wulax), Matthew Krohn (makrohn)'],
  ['Arming Sword', 'OGA-BY 3.0', 'ElizaWy; walk and down by JaidynReiman'],
]

/** 글꼴 — public/fonts/CREDITS.txt 와 같은 내용 [이름, 허락, 만든 이, 주소, 쓰는 곳 키] */
const FONTS = [
  ['Gowun Batang', 'SIL OFL 1.1', 'Yagom.net / Yoon Design', 'https://fonts.google.com/specimen/Gowun+Batang', 'credits.font.batang'],
  ['Gowun Dodum', 'SIL OFL 1.1', 'Yagom.net / Yoon Design', 'https://fonts.google.com/specimen/Gowun+Dodum', 'credits.font.dodum'],
  ['Barlow Condensed', 'SIL OFL 1.1', 'Jeremy Tribby', 'https://fonts.google.com/specimen/Barlow+Condensed', 'credits.font.barlow'],
  ['Song Myung', 'SIL OFL 1.1', 'JIKJI SOFT', 'https://fonts.google.com/specimen/Song+Myung', 'credits.font.song'],
  ['East Sea Dokdo', 'SIL OFL 1.1', 'YoonDesign', 'https://fonts.google.com/specimen/East+Sea+Dokdo', 'credits.font.dokdo'],
] as const

const TOOLS = [
  ['Vite', 'MIT', 'https://vitejs.dev', 'credits.oss.vite'],
  ['TypeScript', 'Apache-2.0', 'https://www.typescriptlang.org', 'credits.oss.ts'],
  ['Electron', 'MIT', 'https://www.electronjs.org', 'credits.oss.electron'],
] as const

const row = (name: string, lic: string, who: string, link = ''): string =>
  `<div class="cr-row"><b>${esc(name)}</b>${lic !== '' ? `<span class="cr-lic">${esc(lic)}</span>` : ''}<span class="cr-who">${esc(who)}${link !== '' ? ` <a href="${esc(link)}" target="_blank" rel="noopener">${esc(t('credits.source'))}</a>` : ''}</span></div>`
const h2 = (title: string, small = ''): string => `<h2>${esc(title)}${small !== '' ? `<small>${esc(small)}</small>` : ''}</h2>`

/** sfx/CREDITS.txt → 묶음별 줄. 묶는 규칙과 이름 뽑기는 옛 credits.html 그대로 */
function soundHtml(txt: string): string {
  const rows = txt.split('\n').map((l) => l.trim()).filter((l) => l !== '' && !l.startsWith('#') && /^\S+\.(ogg|mp3|wav)\s/.test(l))
    .map((l) => { const m = l.match(/^(\S+)\s+(.*)$/)!; return { file: m[1]!, desc: m[2]! } })
  const GROUPS: readonly (readonly [string, string, (d: string) => boolean, number])[] = [
    [t('credits.sound.gugak'), t('credits.lic.kogl1'), (d) => d.startsWith('국립국악원'), 2],
    [t('credits.sound.gongu'), t('credits.lic.koglBy'), (d) => d.startsWith('공유마당'), 2],
    [t('credits.sound.hyung'), t('credits.lic.checking'), (d) => d.startsWith('형이'), 0],
    ['Freesound · OpenGameArt', 'CC0', () => true, 3],
  ]
  const used = new Set<{ file: string; desc: string }>()
  let h = ''
  for (const [title, lic, test, whoAt] of GROUPS) {
    const list = rows.filter((x) => !used.has(x) && test(x.desc))
    if (list.length === 0) continue
    list.forEach((x) => used.add(x))
    h += h2(title, `${lic} · ${list.length}`)
    for (const x of list) {
      const parts = x.desc.split(' · ')
      const url = (x.desc.match(/https?:\/\/\S+?(?=[\s)]|$)/) ?? [''])[0]!
      const name = (x.desc.match(/「([^」]+)」|"([^"]+)"/)?.[1]) ?? (x.desc.match(/"([^"]+)"/)?.[1]) ?? parts[1] ?? x.file
      const license = /공공누리/.test(x.desc) ? t('credits.lic.kogl1Short') : /CC BY/.test(x.desc) ? 'CC BY' : /CC0/.test(x.desc) ? 'CC0' : ''
      const who = whoAt > 0 ? (parts[whoAt] ?? '') : ''
      h += row(name, license, `${who}${who !== '' ? ' · ' : ''}${x.file}`, url)
    }
  }
  return h
}

/** 크레딧 본문 한 덩어리 (화면 · 두루마리 공용) */
export async function creditsBodyHtml(base: string): Promise<string> {
  let sound = ''
  try { sound = soundHtml(await (await fetch(`${base}realm/sfx/CREDITS.txt`)).text()) } catch { sound = `<p class="cr-lead">${esc(t('credits.sound.fail'))}</p>` }
  const studio = STUDIO_NAME.trim() !== '' ? STUDIO_NAME : t('credits.tbd')
  const dev = DEVELOPER_NAME.trim() !== '' ? DEVELOPER_NAME : studio
  const site = STUDIO_NAME.trim() !== '' && STUDIO_URL !== '' ? `<div class="cr-row"><b>${esc(t('credits.site'))}</b><span class="cr-who"><a href="${esc(STUDIO_URL)}" target="_blank" rel="noopener">${esc(STUDIO_URL.replace(/^https?:\/\//, ''))}</a></span></div>` : ''
  return `<section>${h2(t('credits.makers'))}`
    + `<div class="cr-row"><b>${esc(t('credits.studio'))}</b><span class="cr-who">${esc(studio)}</span></div>`
    + `<div class="cr-row"><b>${esc(t('credits.developer'))}</b><span class="cr-who">${esc(dev)}</span></div>${site}</section>`
    + `<section>${h2(t('credits.ai'))}<p class="cr-lead">${esc(t('credits.ai.lead'))}</p>`
    + `<ul class="cr-list"><li>${esc(t('credits.ai.art'))}</li><li>${esc(t('credits.ai.video'))}</li><li>${esc(t('credits.ai.voice'))}</li><li>${esc(t('credits.ai.runtime'))}</li></ul></section>`
    + `<section>${h2(t('credits.sound'))}<p class="cr-lead">${esc(t('credits.sound.lead'))}</p>${sound}`
    + `<p class="cr-note">${esc(t('credits.sound.kogl'))}</p></section>`
    + `<section>${h2(t('credits.fonts'))}${FONTS.map(([n, lic, who, url, use]) => row(n, lic, `${who} · ${t(use)}`, url)).join('')}</section>`
    + `<section>${h2(t('credits.lpc'), `Universal LPC Spritesheet Character Generator · ${LPC.length}`)}<p class="cr-lead">${esc(t('credits.lpc.lead'))}</p>${LPC.map(([n, lic, who]) => row(n, lic, who)).join('')}</section>`
    + `<section>${h2(t('credits.oss'))}${TOOLS.map(([n, lic, url, use]) => row(n, lic, t(use), url)).join('')}</section>`
}

const CSS = `
.cr-wrap { position: fixed; inset: 0; z-index: 9990; display: flex; flex-direction: column; background: #14110d; color: #e8dcc0; font-family: 'Gowun Dodum', 'Apple SD Gothic Neo', 'Malgun Gothic', system-ui, sans-serif; }
.cr-wrap * { box-sizing: border-box; }
.cr-head { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: #14110df0; border-bottom: 1px solid #3a2f22; }
.cr-head h1 { margin: 0; font-size: 18px; color: #e0bd78; letter-spacing: .06em; }
.cr-back { padding: 8px 14px; border-radius: 10px; border: 1px solid #6a5236; background: #1f1710; color: #e8dcc0; font: inherit; font-size: 14px; cursor: pointer; }
.cr-scroll { flex: 1; overflow-y: auto; overflow-x: hidden; -webkit-overflow-scrolling: touch; }
.cr-main { max-width: 760px; margin: 0 auto; padding: 8px 16px calc(48px + env(safe-area-inset-bottom)); overflow-wrap: anywhere; }
.cr-wrap h2 { font-size: 15px; color: #e0bd78; margin: 28px 0 8px; letter-spacing: .08em; }
.cr-wrap h2 small { display: block; margin-top: 2px; color: #9a8f7c; font-weight: 400; font-size: 12px; letter-spacing: 0; }
.cr-lead { color: #9a8f7c; font-size: 13px; line-height: 1.7; margin: 6px 0; }
.cr-list { margin: 6px 0; padding-left: 20px; color: #cfc3a8; font-size: 13.5px; line-height: 1.7; }
.cr-list li { margin: 4px 0; }
.cr-row { display: grid; grid-template-columns: 1fr auto; gap: 2px 10px; padding: 9px 12px; margin: 6px 0; border-radius: 10px; background: #211a12; border-left: 3px solid #6a5236; }
.cr-row b { font-size: 14px; font-weight: 600; min-width: 0; }
.cr-who { color: #9a8f7c; font-size: 12.5px; min-width: 0; }
.cr-lic { grid-row: span 2; align-self: center; font-size: 11.5px; color: #c9e0b0; max-width: 40vw; text-align: right; }
.cr-row:not(:has(.cr-lic)) { grid-template-columns: 1fr; }
.cr-row a { color: #bcd3f0; font-size: 12px; }
.cr-note { margin-top: 20px; padding: 12px 14px; border-radius: 12px; background: #1d2418; color: #c9d8b8; font-size: 12.5px; line-height: 1.7; }
@media (max-width: 480px) { .cr-row { grid-template-columns: 1fr; } .cr-lic { grid-row: auto; text-align: left; max-width: none; } }
.cr-roll .cr-main { text-align: center; }
.cr-roll .cr-row { background: none; border: 0; display: block; padding: 4px 0; margin: 2px 0; }
.cr-roll .cr-lic { display: inline; margin-right: 8px; max-width: none; }
.cr-roll h2 { font-size: 20px; margin-top: 56px; }
.cr-roll .cr-note, .cr-roll .cr-list { text-align: left; }
.cr-rollbox { position: absolute; inset: 0; overflow: hidden; }
.cr-rollin { position: absolute; left: 0; right: 0; top: 100%; animation: crroll var(--crdur) linear forwards; will-change: transform; }
@keyframes crroll { to { transform: translateY(calc(-100% - 100vh)); } }
.cr-skip { position: absolute; left: 0; right: 0; bottom: calc(14px + env(safe-area-inset-bottom)); text-align: center; font-size: 12px; color: #8e8166; pointer-events: none; }
@media (prefers-reduced-motion: reduce) { .cr-rollin { animation: none; top: 0; position: relative; } .cr-rollbox { overflow-y: auto; } }
`

function mount(cls: string): HTMLElement {
  document.getElementById('crwrap')?.remove()
  const el = document.createElement('div')
  el.id = 'crwrap'
  el.className = `cr-wrap ${cls}`
  document.body.appendChild(el)
  return el
}

/** 첫 화면 「더 보기」에서 여는 크레딧 화면 */
export async function openCredits(base: string): Promise<void> {
  const el = mount('')
  el.innerHTML = `<style>${CSS}</style><div class="cr-head"><button class="cr-back" type="button">${esc(t('credits.back'))}</button><h1>${esc(t('credits.title'))}</h1></div><div class="cr-scroll"><div class="cr-main"><p class="cr-lead">${esc(t('credits.loading'))}</p></div></div>`
  const close = (): void => { removeEventListener('keydown', onKey); el.remove() }
  const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') close() }
  el.querySelector('.cr-back')!.addEventListener('click', close)
  addEventListener('keydown', onKey)
  const body = await creditsBodyHtml(base)
  if (el.isConnected) el.querySelector('.cr-main')!.innerHTML = body
}

/** 엔딩 두루마리 — 같은 크레딧을 천천히 밀어 올린다. 아무 데나 누르면 끝 (끝나면 onDone). 아직 엔딩에는 잇지 않았다 */
export async function openCreditsRoll(base: string, onDone?: () => void, secondsPerScreen = 9): Promise<void> {
  const el = mount('cr-roll')
  const body = await creditsBodyHtml(base)
  el.innerHTML = `<style>${CSS}</style><div class="cr-rollbox"><div class="cr-rollin"><div class="cr-main"><h2 style="margin-top:24px">${esc(t('credits.title'))}</h2>${body}<h2>${esc(t('credits.thanks'))}</h2></div></div></div><div class="cr-skip">${esc(t('credits.skip'))}</div>`
  const inner = el.querySelector<HTMLElement>('.cr-rollin')!
  // 길이만큼 흐르는 시간 — 화면 한 장 높이를 secondsPerScreen 초에 지나가게 (글이 길수록 오래)
  const screens = (inner.offsetHeight + innerHeight) / Math.max(1, innerHeight)
  el.style.setProperty('--crdur', `${Math.round(screens * secondsPerScreen)}s`)
  let done = false
  const end = (): void => { if (done) return; done = true; removeEventListener('keydown', end, true); el.remove(); onDone?.() }
  inner.addEventListener('animationend', end)
  el.addEventListener('pointerdown', end)
  addEventListener('keydown', end, true)
}
