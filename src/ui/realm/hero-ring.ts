/**
 * 얼굴 링 — 장수 고르기를 얼굴 고리 하나로 (58-A · 형 11-21 시안 확정 · docs/realm/production/mockups/hero-ring).
 * 형: 「이름 글자보다 얼굴로 리볼빙이 낫다 · 영웅이 많아져도 문제없게 · 몇 개 중 몇 번째인지 번호 · 고를 때마다 목소리와 전투 애니메이션이 이미지 하단에」.
 *
 *  - 비스듬히 눕힌 원판 위 고리에 늘 ringSlots 칸만 돈다. 앞쪽 ±ringShow 칸만 얼굴, 뒤쪽 칸은 얼굴을 가린 빈 메달이고
 *    가려진 동안 다음 장수로 갈아 끼운다 (장수가 100명이어도 고리는 10칸).
 *  - 아래에 「7 / 26」 번호 + 전체 위치 막대(10명마다 눈금 · 누르면 그 자리로).
 *  - 끌기 · 휠 · ◀▶ · 방향키로 돌리고, 얼굴을 누르면 앞으로. 앞 장수를 한 번 더 누르거나 Enter 면 고른다(다시 누르면 뺀다).
 *    다음 장수는 오른쪽에 있다 (▶ · 손가락을 왼쪽으로 끌면 고리가 손을 따라 왼쪽으로 돈다).
 *  - 큰 그림은 기본 초상(bust-hd · 각성 모습을 켠 장수는 각성 초상) · 이름 · 출신 · 단련 · 능력치 막대.
 *  - 그림 아래 전투 띠(anim-px · 칸 배치는 싸움터와 같다: 서기 0~3 · 공격 12~17): 둘러볼 땐 서기 숨, 고르면 공격 한 번.
 *    (full20Generated 의 칸 표는 겨루기 띠 duel/sprites 의 칸이라 anim-px 띠에는 맞지 않는다 · 11-21 두만 띠로 확인)
 *
 * 쓰는 곳 셋 (58-B):
 *  - 「데려갈 장수」 (legacy.bringHtml · app.bringPopup) — 난세가 허락하는 수만큼 고른다.
 *  - 단련터 (drill.yardHtml) — 고리 위에 필터 · 정렬, 고르면 고리 자리에 그 장수의 단련 판(panel)을 편다. 큰 그림은 그대로라 PC 에서도 이마가 잘리지 않는다 (HANDOFF A14).
 *  - 열전 「장수 바꾸기」 (raid-main.renderHeroes) — 한 명만 · 고른 이를 한 번 더 고르면 그 장수로 바꾼다.
 *  위 칸(top) · 고리 위 한 줄(head) · 고리 대신 펴는 판(panel)은 부른 쪽이 만들어 넘긴다. 모양은 hringCss(scope) — 본편 .ap · 열전 #shop.
 *
 * 화면만 그린다 — 고름은 부른 쪽의 손잡이(onToggle)로만 바뀐다. 숨은 탭 · 링이 떨어져 나간 뒤에는 rAF 도 타이머도 돌지 않는다 (규칙 4).
 * 저사양 · 쉼 · 움직임 줄이기(q-low · q-rest · q-calm)에선 서기 숨을 멈춘 한 장으로 (한 번짜리 공격은 그대로).
 */
import { P, UI_SWAY } from '../../tune/params.ts'
import { swayBody, swayStep } from '../fx/sway.ts'
import { SPRITE_PX } from '../../realm/data/spritePx.ts'
import { bustOf, genArtOf, generalSprite } from '../../realm/data/art.ts'
import { standingCell, standsWithCompanion } from '../../raid/idle-pose.ts'
import { companionOf, idlePlan, stripCells, STRIP_CELLS } from '../../raid/hero-idle.ts'
import { companionPlace } from '../../raid/strip-geom.ts'
import { HAEBI_IDLE } from '../../tune/params.ts'
import { AWAKEN_ART } from '../../realm/data/awaken-art.ts'
import { STAT_NAME } from '../../realm/data/prose.ts'
import type { Hero } from '../../realm/types.ts'

/** 링 한 칸의 장수 — 그림 주소 · 정보 · 전투 띠 (다 만들어서 넘긴다) */
export interface RingHero {
  readonly id: string
  /** 읽는 이름 (칭호 포함 · 화면 읽기용) */
  readonly name: string
  /** 보이는 이름 HTML (칭호는 작게 · heroview.nameHtml) */
  readonly nameHtml: string
  /** 출신 — 나라 · 떠돌이 · 가문 */
  readonly from: string
  /** 단련 단계 — null 이면 배지를 두지 않는다 (열전) */
  readonly lv: number | null
  readonly face: string | null
  readonly big: string | null
  /** 큰 그림이 없을 때 */
  readonly bigAlt: string | null
  readonly stats: ReadonlyArray<readonly [string, number]>
  /** 전투 띠 주소 (anim-px/gen-*.png) */
  readonly sprite: string | null
  /** 단련 배지 다음 줄 — 부른 쪽이 만든 HTML (단련터의 공 · 열전의 무기와 휘장) */
  readonly extra?: string
  /** 얼굴 메달 아래 표 (단련터 ▲ 공 남음 · 열전 진) — 비우면 없다 */
  readonly mark?: string
}

export interface RingText {
  readonly title: string
  readonly party: string
  readonly prev: string
  readonly next: string
  readonly lv: (n: number) => string
}

export interface RingOpts {
  readonly heroes: readonly RingHero[]
  /** 고를 수 있는 수 */
  readonly max: number
  /** 이미 고른 장수 id */
  readonly picked: readonly string[]
  readonly text: RingText
  /** 고름을 바꾼다 — 부른 쪽의 손잡이(판·저장은 거기서만 바뀐다) · 바뀐 뒤의 고름을 돌려준다 */
  readonly onToggle: (id: string) => readonly string[]
  /** 새로 골랐다 — 그 장수 목소리 (소리 끄기는 부른 쪽이 따른다) */
  readonly onPicked?: (id: string) => void
  /** 처음 앞에 설 장수 — 없거나 목록에 없으면 이미 고른 이, 그것도 없으면 맨 앞 */
  readonly start?: string | null
  /** 앞 장수가 바뀌었다 — 부른 쪽이 기억한다 (다시 그려도 그 자리에서 · 아래 단추가 그 장수를 가리킨다) */
  readonly onFront?: (id: string) => void
  /** 위 칸(제목 · 고른 얼굴) 대신 넣을 HTML — 이때는 고른 수 · 고른 얼굴 칸이 없다 */
  readonly top?: string
  /** 고리 위 한 줄 HTML (단련터의 필터 · 정렬) */
  readonly head?: string
  /** 고리 대신 펴는 판 HTML — 앞 장수 한 사람만 그린다 (단련터의 능력 · 유물). 이때는 돌리지 않고 방향키도 받지 않는다 */
  readonly panel?: string
  /** 처음 그릴 때 공격 한 번 (펼친 판에 들어섰을 때 · 능력을 올렸을 때) */
  readonly attack?: boolean
  /** 얼굴 표가 숨 쉰다 (단련터에서 공을 남긴 채 나가려 했을 때) */
  readonly hot?: boolean
  /** 방향키 · Enter 를 받나 — 위에 떠 있는 판이 있으면 false (기본 true) */
  readonly keys?: boolean
}

export interface RingHandle {
  dispose(): void
}

/** 능력치 막대의 끝 — 능력치는 10 이 끝이다 (단련도 10 을 못 넘는다) */
const STAT_TOP = 10
const STATS = ['mu', 'tong', 'ryak', 'chi', 'deok'] as const
/** anim-px 장수 띠 스무 칸의 자리 (tools/sprite-normalize.mjs 규격 · 싸움터 spidle 0~3 · gatk 12~17 과 같은 칸) */
const IDLE: readonly number[] = [0, 1, 2, 3]
const ATTACK: readonly number[] = [12, 13, 14, 15, 16, 17]

const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

/** 그림 주소 셋 — 작은 얼굴 · 큰 판 · 큰 판이 없을 때. awake 면 각성 초상 (그 그림이 있을 때만) */
export function ringFaces(art: string, bust: string | undefined, awake: boolean): Pick<RingHero, 'face' | 'big' | 'bigAlt'> {
  if (bust === undefined) return { face: null, big: null, bigAlt: null }
  const aw = awake && AWAKEN_ART.has(bust)
  const small = `${art}${aw ? 'awaken' : 'bust'}/${bust}.jpg`
  return { face: small, big: `${art}${aw ? 'awaken-hd' : 'bust-hd'}/${bust}.jpg`, bigAlt: small }
}

/**
 * 장수 → 링 칸. 그림은 bust · bust-hd (각성 모습이면 awaken · awaken-hd), 전투 띠는 싸움터와 같은 그림(generalSprite → genArtOf).
 * awake — 영구 각성했고 각성 모습을 켜 둔 장수 (56-A 토글)
 */
export function ringCard(art: string, x: { readonly id: string; readonly name: string; readonly nameHtml: string; readonly from: string; readonly lv: number | null; readonly body: Hero | undefined; readonly awake: boolean }): RingHero {
  const body = x.body
  return {
    id: x.id, name: x.name, nameHtml: x.nameHtml, from: x.from, lv: x.lv,
    ...ringFaces(art, bustOf(x.id), x.awake),
    stats: body !== undefined ? STATS.map((s) => [STAT_NAME[s], body[s]] as const) : [],
    sprite: body !== undefined ? art + genArtOf(generalSprite({ ...body, ascended: x.awake, awakeningLook: x.awake })).file : null,
  }
}

/** 고리 칸 수 — 장수가 적으면 장수 수만큼 */
const slotCount = (n: number): number => Math.max(1, Math.min(n, Math.round(P.realm.ringSlots)))
/** 처음 앞에 설 장수 — 부른 쪽이 정한 이 · 이미 고른 이 · 맨 앞 */
const startOf = (o: RingOpts): number => {
  const s = o.start != null ? o.heroes.findIndex((h) => h.id === o.start) : -1
  return s >= 0 ? s : Math.max(0, o.heroes.findIndex((h) => o.picked.includes(h.id)))
}

const infoHtml = (h: RingHero, text: RingText): string =>
  `<span class="hrg-from">${esc(h.from)}</span><b class="hrg-name">${h.nameHtml}</b>`
  + (h.lv !== null ? `<span class="hrg-lv${h.lv > 0 ? '' : ' zero'}">${esc(text.lv(h.lv))}</span>` : '')
  + (h.extra !== undefined && h.extra !== '' ? `<span class="hrg-ex">${h.extra}</span>` : '')
  + (h.stats.length > 0 ? `<span class="hrg-st">${h.stats.map(([l, v]) => `<i>${esc(l)}</i><span class="hrg-tr"><span style="width:${Math.max(0, Math.min(100, (v / STAT_TOP) * 100)).toFixed(0)}%"></span></span><b>${v}</b>`).join('')}</span>` : '')

const partyHtml = (o: RingOpts, picked: readonly string[]): string => {
  let h = ''
  for (let j = 0; j < o.max; j++) {
    const id = picked[j]
    const i = id !== undefined ? o.heroes.findIndex((x) => x.id === id) : -1
    const x = o.heroes[i]
    h += x !== undefined
      ? `<button class="hrg-pf" data-i="${i}" aria-label="${esc(x.name)}"${x.face !== null ? ` style="background-image:url('${esc(x.face)}')"` : ''}></button>`
      : '<span class="hrg-pf none"></span>'
  }
  return h + `<em>${esc(o.text.party)}</em>`
}

/** 링의 뼈대 — 처음 그림부터 앞 장수의 그림 · 정보가 보인다 (돌리기는 mountRing) */
export function ringHtml(o: RingOpts): string {
  const n = o.heroes.length
  const i0 = startOf(o)
  const h0 = o.heroes[i0]
  if (h0 === undefined) return ''
  const one = o.panel !== undefined
  const pic = h0.big ?? h0.bigAlt
  const cls = `${one ? ' hrg-one' : ''}${o.head !== undefined && !one ? ' hrg-hashead' : ''}${o.top !== undefined ? ' hrg-own' : ''}${o.hot === true ? ' hrg-hot' : ''}`
  let h = `<div class="hrg${cls}">`
  h += `<div class="hrg-hero"><img class="hrg-pic" alt=""${pic !== null ? ` src="${esc(pic)}"` : ' hidden'}><i class="hrg-fade"></i>`
  h += `<div class="hrg-info">${infoHtml(h0, o.text)}</div><div class="hrg-fight"><canvas></canvas></div></div>`
  if (one) h += `<div class="hrg-wheel hrg-panel">${o.panel}</div>`
  else {
    const s = slotCount(n)
    h += `<div class="hrg-wheel">${o.head !== undefined ? `<div class="hrg-head">${o.head}</div>` : ''}<div class="hrg-ring"><i class="hrg-disc"></i>`
    for (let k = 0; k < s; k++) h += `<button class="hrg-slot" type="button"><span class="hrg-f"></span><b class="hrg-mk"></b></button>`
    h += n > 1 ? `<button class="hrg-arw l" type="button" aria-label="${esc(o.text.prev)}">◀</button><button class="hrg-arw r" type="button" aria-label="${esc(o.text.next)}">▶</button>` : ''
    h += `</div><div class="hrg-count"><b>${i0 + 1}</b> / ${n}</div>`
    if (n > 1) {
      h += `<div class="hrg-scrub"><span class="hrg-sbar">`
      for (let t = 10; t < n; t += 10) h += `<s style="left:${((t / (n - 1)) * 100).toFixed(2)}%"></s>`
      h += `<i style="left:${((i0 / (n - 1)) * 100).toFixed(2)}%"></i></span></div>`
    }
    h += `</div>`
  }
  if (o.top !== undefined) h += `<div class="hrg-top">${o.top}</div>`
  else {
    const picked = o.picked.filter((id) => o.heroes.some((x) => x.id === id)).slice(0, o.max)
    h += `<div class="hrg-top"><h4 class="hrg-title">${esc(o.text.title)} <small>${picked.length}/${o.max}</small></h4><div class="hrg-party">${partyHtml(o, picked)}</div></div>`
  }
  return h + `</div>`
}

const strips = new Map<string, HTMLImageElement>()
const stripOf = (src: string, onload: () => void): HTMLImageElement => {
  let im = strips.get(src)
  if (im === undefined) {
    im = new Image()
    im.decoding = 'async'
    im.src = src
    strips.set(src, im)
  }
  if (!im.complete) im.addEventListener('load', onload, { once: true })
  return im
}
const PX_NAME = /(gen-[^/]+)\.png$/

/**
 * 링을 살린다 — ringHtml 로 그린 .hrg 위에서. 떼어 낼 땐 dispose (링이 화면에서 사라져도 스스로 멈춘다).
 * 펼친 판(panel)이면 고리가 없다 — 큰 그림 · 정보 · 전투 띠만 산다.
 */
export function mountRing(host: HTMLElement, o: RingOpts): RingHandle {
  const R = P.realm
  const hs = o.heroes
  const n = hs.length
  const ring = host.querySelector<HTMLElement>('.hrg-ring')
  const disc = host.querySelector<HTMLElement>('.hrg-disc')
  const pic = host.querySelector<HTMLImageElement>('.hrg-pic')
  const info = host.querySelector<HTMLElement>('.hrg-info')
  const count = host.querySelector<HTMLElement>('.hrg-count')
  const dot = host.querySelector<HTMLElement>('.hrg-scrub i')
  const bar = host.querySelector<HTMLElement>('.hrg-sbar')
  // 위 칸을 부른 쪽이 짰으면 고른 수 · 고른 얼굴 칸이 없다 (그쪽 <small> 을 건드리지 않게)
  const party = o.top === undefined ? host.querySelector<HTMLElement>('.hrg-party') : null
  const tally = o.top === undefined ? host.querySelector<HTMLElement>('.hrg-title small') : null
  const cv = host.querySelector<HTMLCanvasElement>('.hrg-fight canvas')
  const ctx = cv?.getContext('2d') ?? null
  if (n === 0 || pic === null || info === null) return { dispose() {} }
  const slots = ring !== null ? [...ring.querySelectorAll<HTMLElement>('.hrg-slot')] : []
  const S = Math.max(1, slots.length)
  // 장수가 다섯 이하면 뒤쪽도 얼굴 (갈아 끼울 장수가 없다)
  const show = n <= 5 ? n : R.ringShow
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  const mod = (i: number): number => ((i % n) + n) % n

  let pos = startOf(o)
  let target = pos
  let picked = o.picked.filter((id) => hs.some((x) => x.id === id)).slice(0, o.max)
  let drag: { x: number; p: number; w: number; id: number; moved: boolean } | null = null
  let eatUntil = 0
  let wheelAcc = 0
  let wheelAt = 0
  let shown = mod(pos)
  let bigShown = shown
  let since = 0
  let attackAt: number | null = o.attack === true ? performance.now() : null
  let last = 0
  let raf = 0
  let timer = 0
  let alive = true
  let geo = { cx: 0, cy: 0, rx: 0, ry: 0, size: 0 }
  // 고리가 도는 빠르기만큼 얼굴이 도는 쪽으로 기운다 (A1 · 자석 흔들림 · 앞 얼굴일수록 크게) — 멈추면 용수철로 출렁이다 선다
  const lean = swayBody()
  const leanCfg = { ...UI_SWAY, maxTilt: UI_SWAY.ring.max }
  let leanPos = pos

  const calm = (): boolean => reduce || host.closest('.q-low, .q-rest, .q-calm') !== null
  /** 움직임 줄이기면 기울지 않는다 */
  const still = (): boolean => reduce || host.closest('.q-calm') !== null

  /**
   * 위 덩이(.hrg-top · 제목·배너)가 큰 초상과 겹치면 초상을 그 아래에서 시작하게 한다 — 얼굴을 가리지 않게
   * (11-23 형 「가로 화면 이거 머리 가리는데」 → 「세로일 때도 얼굴 가리는 거」). 겹치지 않으면(가로에서 배너가 옆 칸으로 간 때) 0.
   */
  const topEl = host.querySelector<HTMLElement>('.hrg-top')
  const heroEl = host.querySelector<HTMLElement>('.hrg-hero')
  function fitTop(): void {
    if (topEl === null || heroEl === null) return
    const a = topEl.getBoundingClientRect()
    const b = heroEl.getBoundingClientRect()
    const over = a.width > 0 && a.right > b.left + 1 && a.left < b.right - 1 && a.bottom > b.top
    heroEl.style.setProperty('--hrg-toph', over ? `${Math.round(a.bottom - b.top)}px` : '0px')
  }
  function measure(): void {
    if (ring === null || disc === null) return
    const w = ring.clientWidth
    const h = ring.clientHeight
    const k = Math.cos((R.ringTilt * Math.PI) / 180) * 0.95
    const f = R.ringFace
    // 옆 얼굴(0.81배)이 폭 안에, 뒤 얼굴 머리(0.5배 · 위 0.7)부터 앞 얼굴 턱(1.12배 · 아래 0.3)까지가 높이 안에
    const rx = Math.max(8, Math.min(w / 2 / (1 + 0.81 * f), h / (2 * k + 1.372 * f)))
    const size = 2 * rx * f
    const ry = rx * k
    const total = 2 * ry + 0.686 * size
    geo = { cx: w / 2, cy: (h - total) / 2 + ry + 0.35 * size, rx, ry, size }
    for (const el of slots) { el.style.width = `${size.toFixed(1)}px`; el.style.height = `${size.toFixed(1)}px` }
    disc.style.left = `${(geo.cx - rx * 1.12).toFixed(1)}px`
    disc.style.top = `${(geo.cy - ry * 1.12).toFixed(1)}px`
    disc.style.width = `${(rx * 2.24).toFixed(1)}px`
    disc.style.height = `${(ry * 2.24).toFixed(1)}px`
    ring.style.setProperty('--hrg-fy', `${(geo.cy + ry).toFixed(1)}px`)
  }

  function face(el: HTMLElement, i: number): void {
    const h = hs[i]
    if (h === undefined || el.dataset['i'] === String(i)) return
    el.dataset['i'] = String(i)
    const f = el.firstElementChild as HTMLElement | null
    if (f !== null) f.style.backgroundImage = h.face !== null ? `url('${h.face}')` : 'none'
    const mk = el.querySelector<HTMLElement>('.hrg-mk')
    if (mk !== null) mk.textContent = h.mark ?? ''
    el.setAttribute('aria-label', h.name)
    const on = picked.includes(h.id)
    el.classList.toggle('on', on)
    el.setAttribute('aria-pressed', String(on))
  }

  function layout(): void {
    const base = Math.round(pos)
    const fr = pos - base
    const half = Math.floor(S / 2)
    for (let k = 0; k < slots.length; k++) {
      const el = slots[k]
      if (el === undefined) continue
      // 칸 k 는 앞 칸에서 off 만큼 떨어진 자리 · 그 자리의 장수 = base + off (뒤로 넘어가는 동안 갈아 끼운다)
      const off = ((((k - base) % S) + S + half) % S) - half
      const rel = off - fr
      const a = Math.PI / 2 - (rel / S) * Math.PI * 2
      const depth = (Math.sin(a) + 1) / 2
      const sc = 0.5 + depth * 0.62
      const x = geo.cx + Math.cos(a) * geo.rx
      const y = geo.cy + Math.sin(a) * geo.ry
      el.style.transform = `translate(${(x - geo.size / 2).toFixed(1)}px,${(y - geo.size * 0.7).toFixed(1)}px) rotate(${(lean.r * depth).toFixed(2)}deg) scale(${sc.toFixed(3)})`
      el.style.zIndex = String(10 + Math.round(depth * 100))
      el.style.opacity = (0.35 + depth * 0.65).toFixed(2)
      face(el, mod(base + off))
      el.classList.toggle('hid', Math.abs(rel) > show + 1e-6)
      el.classList.toggle('fr', Math.abs(rel) < 0.5)
    }
  }

  function swapBig(h: RingHero): void {
    if (pic === null) return
    bigShown = shown
    const src = h.big ?? h.bigAlt
    if (src === null) { pic.hidden = true; return }
    pic.hidden = false
    let alt = h.big !== null ? h.bigAlt : null
    pic.classList.add('swap')
    pic.onload = (): void => { pic.classList.remove('swap') }
    pic.onerror = (): void => {
      if (alt !== null) { const a = alt; alt = null; pic.src = a } else pic.classList.remove('swap')
    }
    pic.src = src
  }

  /** 앞 장수가 바뀌면 정보 · 번호 · 위치 점을 곧바로, 큰 그림은 잠깐 머문 뒤에 */
  function showFront(now: number): void {
    const i = mod(Math.round(pos))
    const h = hs[i]
    if (h === undefined || info === null) return
    if (i !== shown) {
      shown = i
      since = now
      attackAt = null
      info.innerHTML = infoHtml(h, o.text)
      if (count !== null) count.innerHTML = `<b>${i + 1}</b> / ${n}`
      if (dot !== null) dot.style.left = `${((i / Math.max(1, n - 1)) * 100).toFixed(2)}%`
      o.onFront?.(h.id)
    }
    if (bigShown !== shown && now - since >= R.ringBigMs) swapBig(h)
  }

  function drawFight(now: number): void {
    if (cv === null || ctx === null) return
    const h = hs[shown]
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const W = Math.round(cv.clientWidth * dpr)
    const H = Math.round(cv.clientHeight * dpr)
    if (W === 0 || H === 0) return
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H }
    ctx.clearRect(0, 0, W, H)
    const im = h?.sprite != null ? stripOf(h.sprite, wake) : null
    if (h === undefined || im === null || !im.complete || im.naturalWidth === 0) return
    const m = SPRITE_PX[(PX_NAME.exec(h.sprite ?? '') ?? [])[1] ?? '']
    const cells = m?.cells ?? 20
    const cw = im.naturalWidth / cells
    const ch = im.naturalHeight
    const feet = m?.feet ?? ch
    const body = m?.bodyPx ?? ch * 0.86
    const xim = standsWithCompanion(h.sprite ?? '') ? stripOf(companionOf(h.sprite ?? ''), wake) : null
    const xReady = xim !== null && xim.complete && xim.naturalWidth > 0
    let frame = IDLE[0] ?? 0
    if (attackAt !== null && now - attackAt < R.ringAttackMs) frame = ATTACK[Math.min(ATTACK.length - 1, Math.floor(((now - attackAt) / R.ringAttackMs) * ATTACK.length))] ?? frame
    else {
      attackAt = null
      // 열전 판 안과 같은 서 있는 움직임 (숨쉬기 · 눈 깜빡임 · 개성 동작 · raid/idle-pose.ts) — 앞 장수가 바뀐 뒤의 시각으로
      frame = standingCell(h.sprite ?? '', (now - since) / 1000, xReady, calm())
    }
    // 도트는 또렷하게 — 칸 그대로 늘리고(이웃 화소를 섞지 않는다) 두 배 넘으면 반 배 단위로
    let s = Math.min((H * 0.88) / body, W / cw)
    if (s >= 2) s = Math.floor(s * 2) / 2
    const base = H - Math.round(H * 0.05)
    ctx.imageSmoothingEnabled = false
    ctx.fillStyle = 'rgba(0,0,0,.38)'
    ctx.beginPath()
    ctx.ellipse(W / 2, base, body * s * 0.24, body * s * 0.05, 0, 0, Math.PI * 2)
    ctx.fill()
    const w = cw * s
    if (frame >= STRIP_CELLS && xim !== null && xReady) {
      // 덧 띠 칸 — 본 띠와 같은 배율 s 로 (뿌리, 발 줄) 점이 발 자리에 오게 (열전 haebi-view 와 같은 strip-geom)
      const xw = xim.naturalWidth / stripCells(companionOf(h.sprite ?? ''))
      const p = companionPlace(xw, xim.naturalHeight, s, feet, idlePlan(h.sprite ?? '')?.xGeom)
      ctx.drawImage(xim, (frame - STRIP_CELLS) * xw, 0, xw, xim.naturalHeight, Math.round(W / 2 + p.left), Math.round(base + p.top), p.w, p.h)
      return
    }
    ctx.drawImage(im, Math.min(frame, STRIP_CELLS - 1) * cw, 0, cw, ch, Math.round(W / 2 - w / 2), Math.round(base - feet * s), w, ch * s)
  }

  function tick(t: number): void {
    raf = 0
    if (!alive) return
    if (!host.isConnected) { dispose(); return }
    if (document.hidden) { last = 0; return }
    const dt = last > 0 ? Math.min(0.05, (t - last) / 1000) : 0
    last = t
    const moving = drag?.moved === true
    if (!moving) {
      if (reduce) pos = target
      else {
        pos += (target - pos) * Math.min(1, dt * R.ringEase)
        if (Math.abs(target - pos) < 0.002) pos = target
      }
    }
    // 기울기 — pos 가 늘면 얼굴들이 왼쪽으로 간다 · 가는 쪽으로 윗머리가 (칸/초 × perSlot 도 · ±max)
    if (!still() && dt > 0) {
      const aim = Math.max(-leanCfg.maxTilt, Math.min(leanCfg.maxTilt, ((leanPos - pos) / dt) * UI_SWAY.ring.perSlot))
      swayStep(lean, { x: 0, y: 0, s: 1, r: aim }, dt, UI_SWAY.ring.spring, UI_SWAY.ring.spring, leanCfg)
    }
    leanPos = pos
    const leaning = Math.abs(lean.r) > UI_SWAY.restDeg || Math.abs(lean.vr) > UI_SWAY.restSpin
    if (!leaning) { lean.r = 0; lean.vr = 0 }
    layout()
    showFront(t)
    drawFight(t)
    if (moving || pos !== target || attackAt !== null || bigShown !== shown || leaning) { raf = requestAnimationFrame(tick); return }
    last = 0
    // 가만히 있을 땐 서기 숨 한 컷마다 한 번만 깬다 (rAF 를 계속 돌리지 않는다)
    // 계획이 있는 띠는 눈 깜빡임(blinkTime)을 놓치지 않게 그 반 박자마다 · 예전 띠는 서기 숨 한 컷마다
    if (!calm()) timer = window.setTimeout(() => { timer = 0; wake() }, idlePlan(hs[shown]?.sprite ?? '') !== null ? Math.round(HAEBI_IDLE.blinkTime * 500) : R.ringIdleMs - (t % R.ringIdleMs) + 4)
  }

  function wake(): void {
    if (!alive || raf !== 0) return
    if (!host.isConnected) { dispose(); return }
    if (document.hidden) return
    if (timer !== 0) { clearTimeout(timer); timer = 0 }
    raf = requestAnimationFrame(tick)
  }

  function paintPicked(): void {
    if (tally !== null) tally.textContent = `${picked.length}/${o.max}`
    if (party !== null) party.innerHTML = partyHtml(o, picked)
    for (const el of slots) {
      const h = hs[Number(el.dataset['i'] ?? -1)]
      const on = h !== undefined && picked.includes(h.id)
      el.classList.toggle('on', on)
      el.setAttribute('aria-pressed', String(on))
    }
  }

  function step(d: number): void {
    target = Math.round(target) + d
    wake()
  }

  function goTo(i: number): void {
    let d = mod(i - Math.round(target))
    if (d > n / 2) d -= n
    if (d !== 0) {
      target = Math.round(target) + d
      // 멀리 뛰면 마지막 몇 칸만 돌아 들어온다 (수십 명을 다 돌리지 않게)
      if (Math.abs(target - pos) > S / 2 + R.ringJump) pos = target - Math.sign(d) * R.ringJump
    }
    wake()
  }

  function toggle(i: number): void {
    const h = hs[i]
    if (h === undefined) return
    const was = picked.includes(h.id)
    picked = o.onToggle(h.id).filter((id) => hs.some((x) => x.id === id)).slice(0, o.max)
    if (!was && picked.includes(h.id)) {
      attackAt = performance.now()
      o.onPicked?.(h.id)
    }
    paintPicked()
    wake()
  }

  /** 얼굴을 눌렀다 — 앞 장수면 고르고, 아니면 앞으로 */
  function choose(i: number): void {
    if (i === mod(Math.round(target)) && Math.abs(target - pos) < 0.5) toggle(i)
    else goTo(i)
  }

  if (ring !== null) {
    for (const el of slots) {
      el.addEventListener('click', (e) => {
        if (e.timeStamp < eatUntil) return
        choose(Number(el.dataset['i'] ?? 0))
      })
    }
    ring.addEventListener('pointerdown', (e) => {
      if (e.target instanceof Element && e.target.closest('.hrg-arw') !== null) return
      drag = { x: e.clientX, p: pos, w: Math.max(1, ring.clientWidth), id: e.pointerId, moved: false }
    })
    ring.addEventListener('pointermove', (e) => {
      if (drag === null || e.pointerId !== drag.id) return
      const dx = e.clientX - drag.x
      if (!drag.moved && Math.abs(dx) > 6) {
        drag.moved = true
        try { ring.setPointerCapture(e.pointerId) } catch { /* 이미 놓았다 */ }
      }
      if (drag.moved) {
        pos = drag.p - (dx / drag.w) * R.ringDrag
        target = pos
        wake()
      }
    })
    const drop = (e: PointerEvent): void => {
      if (drag === null || e.pointerId !== drag.id) return
      if (drag.moved) { target = Math.round(pos); eatUntil = e.timeStamp + 350 }
      drag = null
      wake()
    }
    ring.addEventListener('pointerup', drop)
    ring.addEventListener('pointercancel', drop)
    host.querySelector('.hrg-arw.l')?.addEventListener('click', () => step(-1))
    host.querySelector('.hrg-arw.r')?.addEventListener('click', () => step(1))
    host.querySelector('.hrg-wheel')?.addEventListener('wheel', (ev) => {
      const e = ev as WheelEvent
      e.preventDefault()
      let d = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX
      if (e.deltaMode !== 0) d *= R.ringWheelPx
      if (e.timeStamp - wheelAt > 250) wheelAcc = 0
      wheelAt = e.timeStamp
      // 마우스 휠 한 칸은 한 장수 · 터치패드의 잔 굴림은 모아서
      if (Math.abs(d) >= R.ringWheelPx) { step(Math.sign(d)); wheelAcc = 0; return }
      wheelAcc += d
      if (Math.abs(wheelAcc) >= R.ringWheelPx) { step(Math.sign(wheelAcc)); wheelAcc = 0 }
    }, { passive: false })
    bar?.addEventListener('pointerdown', (e) => {
      const b = bar.getBoundingClientRect()
      if (b.width <= 0) return
      goTo(Math.round(Math.max(0, Math.min(1, (e.clientX - b.left) / b.width)) * (n - 1)))
    })
  }
  party?.addEventListener('click', (e) => {
    const b = e.target instanceof Element ? e.target.closest<HTMLElement>('.hrg-pf[data-i]') : null
    if (b !== null) goTo(Number(b.dataset['i'] ?? 0))
  })
  const keys = ring !== null && o.keys !== false
  const onKey = (e: KeyboardEvent): void => {
    if (!host.isConnected) { dispose(); return }
    // 숨겨 둔 판(열전의 닫힌 상자) 안의 링은 듣지 않는다
    if (host.closest('[hidden]') !== null) return
    const t = e.target instanceof Element ? e.target : null
    if (t?.closest('input, textarea, select') != null) return
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { step(1); e.preventDefault() }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { step(-1); e.preventDefault() }
    else if (e.key === 'Enter') {
      // 다른 단추(떠나기 · 닫기)에 손이 가 있으면 그 단추가 받는다
      if (t?.closest('button') != null && t.closest('.hrg-slot') === null) return
      e.preventDefault()
      toggle(mod(Math.round(target)))
    }
  }
  const onVis = (): void => { if (!document.hidden) wake() }
  if (keys) window.addEventListener('keydown', onKey)
  document.addEventListener('visibilitychange', onVis)
  // 쉼(q-rest)에서 깨어나면 서기 숨도 다시
  host.addEventListener('pointerdown', wake)
  const seen = ring ?? cv
  const ro = typeof ResizeObserver !== 'undefined' && seen !== null ? new ResizeObserver(() => { fitTop(); measure(); layout(); wake() }) : null
  if (seen !== null) ro?.observe(seen)
  if (topEl !== null) ro?.observe(topEl)

  function dispose(): void {
    if (!alive) return
    alive = false
    if (raf !== 0) cancelAnimationFrame(raf)
    if (timer !== 0) clearTimeout(timer)
    raf = 0
    timer = 0
    if (keys) window.removeEventListener('keydown', onKey)
    document.removeEventListener('visibilitychange', onVis)
    ro?.disconnect()
  }

  // 처음 그림(ringHtml 이 넣어 둔 것)도 큰 판이 없으면 작은 판으로
  const first = hs[shown]
  if (first !== undefined && first.big !== null && first.bigAlt !== null) {
    const alt = first.bigAlt
    pic.onerror = (): void => { pic.onerror = null; pic.src = alt }
  }
  fitTop()
  measure()
  layout()
  paintPicked()
  wake()
  return { dispose }
}

/** 「데려갈 장수」 팝업 틀 — legacy.ts 의 .bringov 를 화면 가득히 (완료 단추 .bringgo 는 아래 붙박이) */
const BRING_BOX = `
.ap .bringov.hrgov { padding: 0; background: #0b0907; }
.ap .bringov .bringbox.hrgbox { width: 100%; height: 100%; max-height: none; margin: 0; padding: 0; border: 0; border-radius: 0; overflow: hidden; background: #120f0c; box-shadow: none; --hrg-bar: calc(68px + env(safe-area-inset-bottom)); }
.ap .bringov .hrgbox .bx { z-index: 9; width: 44px; height: 44px; right: max(4px, env(safe-area-inset-right)); top: calc(env(safe-area-inset-top) + 2px); font-size: 20px; color: #e9dcc0; text-shadow: 0 1px 4px #000; }
.ap .bringov .hrgbox .bringgo { height: var(--hrg-bar); box-sizing: border-box; align-items: center; padding: 0 14px env(safe-area-inset-bottom); background: #0d0a07e8; border-top: 1px solid #3a2e1e; }
.ap .bringov .hrgbox .bringgo .btn { padding: 5px 14px; font-size: 17px; }
@media (orientation: landscape) { .ap .bringov .hrgbox .bringgo { left: 50%; } }
`

/**
 * 링 모양 — 접두 hrg- (다른 화면의 이름과 겹치지 않게) · @S 자리에 scope 를 넣어 그 아래에서만 (본편 .ap · 열전 #shop).
 * 폰 그래픽 한도: 부드러운 linear-gradient · filter 를 쓰지 않는다 (radial-gradient · 단색 · box-shadow 만) · 움직이는 것은 작은 얼굴 칸의 transform 뿐.
 * 세로: 위 그림 · 정보 · 전투 동작 / 아래 링. 가로: 왼쪽 그림 · 정보 · 전투 동작 / 오른쪽 링. 완료 단추는 아래 붙박이(.bringgo · .hrg-go).
 * .hrgscr 는 링 한 화면의 틀 (단련터 · 열전) — 아래 붙박이 띠 .hrg-go 의 높이 --hrg-bar 를 정한다.
 */
const RING_CSS = `
@S .hrgscr { position: absolute; inset: 0; overflow: hidden; background: #120f0c; --hrg-bar: calc(68px + env(safe-area-inset-bottom)); }
@S .hrg-go { position: absolute; left: 0; right: 0; bottom: 0; z-index: 9; display: flex; flex-wrap: wrap; align-content: center; align-items: center; justify-content: center; gap: 4px 10px; height: var(--hrg-bar); box-sizing: border-box; padding: 0 14px env(safe-area-inset-bottom); background: #0d0a07e8; border-top: 1px solid #3a2e1e; }
@S .hrg-go > button { flex: 1 1 0; max-width: 260px; min-width: 0; min-height: 48px; box-sizing: border-box; justify-content: center; padding: 5px 14px; font-size: 17px; }
@S .hrg-go > .pri, @S .hrg-go > .primary { flex-grow: 1.25; max-width: 320px; }
@S .hrg-go > p { flex: 1 0 100%; margin: 0; text-align: center; font-size: 13px; font-weight: 700; line-height: 1.3; color: #ffd27a; }
@S .hrg { position: absolute; inset: 0; display: flex; flex-direction: column; overflow: hidden; container-type: size; color: #efe6d4; background: #120f0c; }
@S .hrg-hero { position: relative; flex: 1 1 auto; min-height: 42cqh; overflow: hidden; }
@S .hrg-pic { position: absolute; left: 0; right: 0; bottom: 0; top: var(--hrg-toph, 0px); width: 100%; height: calc(100% - var(--hrg-toph, 0px)); object-fit: cover; object-position: 50% 12%; transition: opacity .18s; }
@S .hrg-pic.swap { opacity: 0; }
@S .hrg-fade { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(150% 100% at 50% 0%, #120f0c00 58%, #120f0cd0 84%, #120f0c 100%); }
@S .hrg-info { position: absolute; left: 14px; bottom: 8px; width: min(52cqw, 300px); display: flex; flex-direction: column; align-items: flex-start; gap: .3em; z-index: 3; font-size: 12.5px; text-shadow: 0 1px 3px #000, 0 0 10px #000; }
@S .hrg-from { color: #cbbd9f; font-size: 1.04em; }
@S .hrg-name { font-family: var(--serif); font-size: clamp(26px, 8cqw, 46px); line-height: 1.05; color: #f6e7c4; }
@S .hrg-name .ttl { font-size: .42em; color: #cbbd9f; margin-right: .3em; vertical-align: .35em; font-weight: 400; }
@S .hrg-lv { font-size: 1em; font-weight: 700; color: #2a1805; background: #e3b45c; border: 1px solid #f6d48a; border-radius: 6px; padding: .08em .65em; text-shadow: none; }
@S .hrg-lv.zero { color: #cbbd9f; background: #2a2219; border-color: #5b4a2c; }
@S .hrg-ex { display: flex; flex-wrap: wrap; align-items: center; gap: .3em .5em; width: 100%; }
@S .hrg-st { display: grid; grid-template-columns: auto minmax(48px, 1fr) auto; gap: .24em .65em; align-items: center; width: 100%; font-size: 1em; margin-top: .15em; }
@S .hrg-st i { font-style: normal; color: #d6c8a8; }
@S .hrg-st b { color: #f6d48a; font-variant-numeric: tabular-nums; min-width: 1.3em; text-align: right; }
@S .hrg-tr { height: .48em; border-radius: .24em; background: #ffffff24; overflow: hidden; box-shadow: 0 0 4px #000a; }
@S .hrg-tr span { display: block; height: 100%; border-radius: inherit; background: #e0ad55; }
@S .hrg-fight { position: absolute; right: 2cqw; bottom: 4px; width: 42cqw; height: min(36cqw, 26cqh); z-index: 4; pointer-events: none; }
@S .hrg-fight canvas { display: block; width: 100%; height: 100%; }
@S .hrg-wheel { position: relative; flex: 0 0 auto; height: calc(47cqw + 50px); padding-bottom: var(--hrg-bar); display: flex; flex-direction: column; align-items: center; z-index: 5;
  background: radial-gradient(closest-side, #2a2418 0%, #120f0c00 100%); }
@S .hrg-head { position: relative; z-index: 130; flex: 0 0 auto; display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; width: 100%; box-sizing: border-box; padding: 8px 10px 0; }
@S .hrg.hrg-hashead .hrg-wheel { height: calc(47cqw + 106px); }
@S .hrg-ring { position: relative; flex: 1 1 auto; width: 100%; min-height: 0; touch-action: none; cursor: grab; }
@S .hrg-disc { position: absolute; border-radius: 50%; border: 2px solid #e3b45c55; pointer-events: none;
  background: radial-gradient(closest-side, #e3b45c22, #e3b45c00 78%), repeating-radial-gradient(closest-side, #e3b45c00 0 17%, #e3b45c2a 17.4% 18%); }
@S .hrg-wheel, @S .hrg-slot, @S .hrg-arw, @S .hrg-pf, @S .hrg-scrub { box-sizing: content-box; }
@S .hrg-slot { position: absolute; left: 0; top: 0; padding: 0; margin: 0; border-radius: 50%; border: 2px solid #8a6d3b; background: #0c0b09; cursor: pointer; overflow: hidden; transform-origin: 50% 70%; opacity: 0; will-change: transform; }
@S .hrg-slot:hover, @S .hrg-slot:focus-visible { outline: none; }
@S .hrg-f { position: absolute; inset: 0; background: #0c0b09 center 14% / cover no-repeat; transition: opacity .15s; }
@S .hrg-slot.hid { background: radial-gradient(circle at 50% 40%, #3a3022, #15120e); border-color: #4a3c25; }
@S .hrg-slot.hid .hrg-f { opacity: 0; }
@S .hrg-slot.fr { border-color: #f6d48a; box-shadow: 0 0 0 3px #e3b45c55, 0 0 18px #e3b45c88; }
@S .hrg-slot.on::after { content: "✓"; position: absolute; right: 6%; top: 6%; width: 30%; height: 30%; border-radius: 50%; background: #e3b45c; color: #2a1805; font: 700 14px/1 var(--body); display: grid; place-items: center; }
@S .hrg-mk { position: absolute; left: 0; right: 0; bottom: 5%; width: max-content; min-width: 1.6em; margin: 0 auto; padding: .15em .45em; box-sizing: border-box; border-radius: 999px; background: #e3b45c; color: #2a1805; font: 800 12px/1 var(--body); text-align: center; box-shadow: 0 0 0 1px #2a1805aa; pointer-events: none; }
@S .hrg-mk:empty, @S .hrg-slot.hid .hrg-mk { display: none; }
@S .hrg.hrg-hot .hrg-mk { animation: hrgmk .9s ease-in-out infinite alternate; }
@keyframes hrgmk { from { box-shadow: 0 0 0 1px #2a1805aa, 0 0 4px #ffd98a66; } to { box-shadow: 0 0 0 2px #fff3c8, 0 0 14px #ffd98a; } }
@S .hrg-arw { position: absolute; top: calc(var(--hrg-fy, 70%) - 22px); width: 44px; height: 44px; border-radius: 50%; border: 1px solid #6b5532; background: #1b1712d8; color: #f6d48a; font-size: 16px; cursor: pointer; display: grid; place-items: center; z-index: 120; padding: 0; }
@S .hrg-arw.l { left: 4px; } @S .hrg-arw.r { right: 4px; }
@S .hrg-count { flex: 0 0 auto; color: #a89c86; font-size: 14px; font-variant-numeric: tabular-nums; line-height: 1.2; }
@S .hrg-count b { font-family: var(--serif); color: #f6d48a; font-size: 21px; }
@S .hrg-scrub { flex: 0 0 auto; width: min(64%, 360px); padding: 9px 0 7px; cursor: pointer; touch-action: none; }
@S .hrg-sbar { position: relative; display: block; height: 4px; border-radius: 2px; background: #ffffff1c; }
@S .hrg-sbar s { position: absolute; top: -3px; bottom: -3px; width: 2px; margin-left: -1px; background: #e3b45c99; }
@S .hrg-sbar i { position: absolute; top: 50%; width: 12px; height: 12px; margin: -6px 0 0 -6px; border-radius: 50%; background: #f6d48a; box-shadow: 0 0 8px #e3b45c; }
@S .hrg-top { position: absolute; left: 14px; right: 52px; top: calc(env(safe-area-inset-top) + 8px); padding-bottom: 6px; z-index: 6; text-shadow: 0 1px 3px #000, 0 0 8px #000; }
@S .hrg.hrg-own .hrg-top { right: 14px; }
@S .hrg-title { margin: 0; font-family: var(--serif); font-size: clamp(19px, 5.6cqw, 28px); color: #f6d48a; font-weight: 700; }
@S .hrg-title small { font-family: var(--body); font-size: .62em; color: #d6c8a8; font-weight: 400; margin-left: .3em; }
@S .hrg-party { display: flex; align-items: center; gap: 6px; margin-top: 6px; color: #d6c8a8; font-size: 13px; }
@S .hrg-party em { font-style: normal; margin-left: 2px; }
@S .hrg-pf { width: 36px; height: 36px; padding: 0; border-radius: 50%; border: 2px solid #e3b45c; background: #0c0b09 center 14% / cover no-repeat; cursor: pointer; flex: 0 0 auto; }
@S .hrg-pf.none { border: 1.5px dashed #b08c4e; background: #0c0b09d0; cursor: default; }
@S .hrg.hrg-one .hrg-hero { flex: 0 0 auto; height: max(30cqh, calc(100cqh - 470px - var(--hrg-bar, 68px))); min-height: 0; }
@S .hrg-wheel.hrg-panel { flex: 1 1 0; height: auto; min-height: 0; align-items: stretch; box-sizing: border-box; overflow: hidden; }
@media (orientation: landscape) {
  @S .hrg-go { left: 50%; }
  @S .hrg { flex-direction: row; }
  @S .hrg-hero { flex: 0 0 50cqw; min-height: 0; }
  @S .hrg.hrg-one .hrg-hero { flex: 0 0 50cqw; height: auto; }
  @S .hrg-fade { background: radial-gradient(100% 160% at 0% 45%, #120f0c00 60%, #120f0cd0 86%, #120f0c 100%); }
  @S .hrg-info { left: max(16px, env(safe-area-inset-left)); bottom: 12px; width: min(24cqw, 380px); font-size: clamp(12.5px, 1.2cqw, 17px); }
  @S .hrg-top { left: max(14px, env(safe-area-inset-left)); }
  @S .hrg-arw.r { right: max(4px, env(safe-area-inset-right)); }
  @S .hrg-name { font-size: clamp(24px, 4.4cqw, 52px); }
  @S .hrg-fight { left: 26cqw; right: auto; bottom: 6px; width: 23cqw; height: min(46cqh, 24cqw); }
  @S .hrg-wheel { flex: 1 1 auto; height: auto; padding-top: calc(env(safe-area-inset-top) + 44px); }
  @S .hrg.hrg-hashead .hrg-wheel { height: auto; }
  @S .hrg.hrg-own .hrg-wheel { padding-top: calc(env(safe-area-inset-top) + 8px); }
  @S .hrg-top, @S .hrg.hrg-own .hrg-top { right: auto; width: 46cqw; }
  @S .hrg-title { font-size: clamp(19px, 2.6cqw, 30px); }
}
@media (prefers-reduced-motion: reduce) { @S .hrg-pic, @S .hrg-f { transition: none; } @S .hrg.hrg-hot .hrg-mk { animation: none; } }
`

/** 링 모양을 scope 아래에 — 본편은 HRING_CSS(.ap), 열전은 hringCss('#shop') */
export const hringCss = (scope: string): string => RING_CSS.replaceAll('@S', scope)

export const HRING_CSS = BRING_BOX + hringCss('.ap')
