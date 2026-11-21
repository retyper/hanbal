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
 * 화면만 그린다 — 고름은 부른 쪽의 손잡이(onToggle)로만 바뀐다. 숨은 탭 · 링이 떨어져 나간 뒤에는 rAF 도 타이머도 돌지 않는다 (규칙 4).
 * 저사양 · 쉼 · 움직임 줄이기(q-low · q-rest · q-calm)에선 서기 숨을 멈춘 한 장으로 (한 번짜리 공격은 그대로).
 * 단련터 · 열전 출전 고르기도 이 모듈을 쓰게 RingHero 만 만들어 넘기면 된다 (ringCard).
 */
import { P } from '../../tune/params.ts'
import { SPRITE_PX } from '../../realm/data/spritePx.ts'
import { bustOf, genArtOf, generalSprite } from '../../realm/data/art.ts'
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
  readonly lv: number
  readonly face: string | null
  readonly big: string | null
  /** 큰 그림이 없을 때 */
  readonly bigAlt: string | null
  readonly stats: ReadonlyArray<readonly [string, number]>
  /** 전투 띠 주소 (anim-px/gen-*.png) */
  readonly sprite: string | null
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

/**
 * 장수 → 링 칸. 그림은 bust · bust-hd (각성 모습이면 awaken · awaken-hd), 전투 띠는 싸움터와 같은 그림(generalSprite → genArtOf).
 * awake — 영구 각성했고 각성 모습을 켜 둔 장수 (56-A 토글)
 */
export function ringCard(art: string, x: { readonly id: string; readonly name: string; readonly nameHtml: string; readonly from: string; readonly lv: number; readonly body: Hero | undefined; readonly awake: boolean }): RingHero {
  const b = bustOf(x.id)
  const aw = x.awake && b !== undefined && AWAKEN_ART.has(b)
  const small = aw ? 'awaken' : 'bust'
  const body = x.body
  return {
    id: x.id, name: x.name, nameHtml: x.nameHtml, from: x.from, lv: x.lv,
    face: b !== undefined ? `${art}${small}/${b}.jpg` : null,
    big: b !== undefined ? `${art}${aw ? 'awaken-hd' : 'bust-hd'}/${b}.jpg` : null,
    bigAlt: b !== undefined ? `${art}${small}/${b}.jpg` : null,
    stats: body !== undefined ? STATS.map((s) => [STAT_NAME[s], body[s]] as const) : [],
    sprite: body !== undefined ? art + genArtOf(generalSprite({ ...body, ascended: x.awake, awakeningLook: x.awake })).file : null,
  }
}

/** 고리 칸 수 — 장수가 적으면 장수 수만큼 */
const slotCount = (n: number): number => Math.max(1, Math.min(n, Math.round(P.realm.ringSlots)))
/** 처음 앞에 설 장수 — 이미 고른 이가 있으면 그 사람 */
const startOf = (o: RingOpts): number => Math.max(0, o.heroes.findIndex((h) => o.picked.includes(h.id)))

const infoHtml = (h: RingHero, text: RingText): string =>
  `<span class="hrg-from">${esc(h.from)}</span><b class="hrg-name">${h.nameHtml}</b>`
  + `<span class="hrg-lv${h.lv > 0 ? '' : ' zero'}">${esc(text.lv(h.lv))}</span>`
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
  const s = slotCount(n)
  const i0 = startOf(o)
  const h0 = o.heroes[i0]
  if (h0 === undefined) return ''
  const picked = o.picked.filter((id) => o.heroes.some((x) => x.id === id)).slice(0, o.max)
  const pic = h0.big ?? h0.bigAlt
  let h = `<div class="hrg">`
  h += `<div class="hrg-hero"><img class="hrg-pic" alt=""${pic !== null ? ` src="${esc(pic)}"` : ' hidden'}><i class="hrg-fade"></i>`
  h += `<div class="hrg-info">${infoHtml(h0, o.text)}</div><div class="hrg-fight"><canvas></canvas></div></div>`
  h += `<div class="hrg-wheel"><div class="hrg-ring"><i class="hrg-disc"></i>`
  for (let k = 0; k < s; k++) h += `<button class="hrg-slot" type="button"><span class="hrg-f"></span></button>`
  h += n > 1 ? `<button class="hrg-arw l" type="button" aria-label="${esc(o.text.prev)}">◀</button><button class="hrg-arw r" type="button" aria-label="${esc(o.text.next)}">▶</button>` : ''
  h += `</div><div class="hrg-count"><b>${i0 + 1}</b> / ${n}</div>`
  if (n > 1) {
    h += `<div class="hrg-scrub"><span class="hrg-sbar">`
    for (let t = 10; t < n; t += 10) h += `<s style="left:${((t / (n - 1)) * 100).toFixed(2)}%"></s>`
    h += `<i style="left:${((i0 / (n - 1)) * 100).toFixed(2)}%"></i></span></div>`
  }
  h += `</div>`
  h += `<div class="hrg-top"><h4 class="hrg-title">${esc(o.text.title)} <small>${picked.length}/${o.max}</small></h4><div class="hrg-party">${partyHtml(o, picked)}</div></div>`
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

/** 링을 살린다 — ringHtml 로 그린 .hrg 위에서. 떼어 낼 땐 dispose (링이 화면에서 사라져도 스스로 멈춘다) */
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
  const party = host.querySelector<HTMLElement>('.hrg-party')
  const tally = host.querySelector<HTMLElement>('.hrg-title small')
  const cv = host.querySelector<HTMLCanvasElement>('.hrg-fight canvas')
  const ctx = cv?.getContext('2d') ?? null
  if (n === 0 || ring === null || disc === null || pic === null || info === null || count === null || party === null || tally === null) return { dispose() {} }
  const slots = [...ring.querySelectorAll<HTMLElement>('.hrg-slot')]
  const S = slots.length
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
  let attackAt: number | null = null
  let last = 0
  let raf = 0
  let timer = 0
  let alive = true
  let geo = { cx: 0, cy: 0, rx: 0, ry: 0, size: 0 }

  const calm = (): boolean => reduce || host.closest('.q-low, .q-rest, .q-calm') !== null

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
    el.setAttribute('aria-label', h.name)
    const on = picked.includes(h.id)
    el.classList.toggle('on', on)
    el.setAttribute('aria-pressed', String(on))
  }

  function layout(): void {
    const base = Math.round(pos)
    const fr = pos - base
    const half = Math.floor(S / 2)
    for (let k = 0; k < S; k++) {
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
      el.style.transform = `translate(${(x - geo.size / 2).toFixed(1)}px,${(y - geo.size * 0.7).toFixed(1)}px) scale(${sc.toFixed(3)})`
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
    if (h === undefined || info === null || count === null) return
    if (i !== shown) {
      shown = i
      since = now
      attackAt = null
      info.innerHTML = infoHtml(h, o.text)
      count.innerHTML = `<b>${i + 1}</b> / ${n}`
      if (dot !== null) dot.style.left = `${((i / Math.max(1, n - 1)) * 100).toFixed(2)}%`
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
    let frame = IDLE[0] ?? 0
    if (attackAt !== null && now - attackAt < R.ringAttackMs) frame = ATTACK[Math.min(ATTACK.length - 1, Math.floor(((now - attackAt) / R.ringAttackMs) * ATTACK.length))] ?? frame
    else {
      attackAt = null
      if (!calm()) frame = IDLE[Math.floor(now / R.ringIdleMs) % IDLE.length] ?? frame
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
    ctx.drawImage(im, frame * cw, 0, cw, ch, Math.round(W / 2 - w / 2), Math.round(base - feet * s), w, ch * s)
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
    layout()
    showFront(t)
    drawFight(t)
    if (moving || pos !== target || attackAt !== null || bigShown !== shown) { raf = requestAnimationFrame(tick); return }
    last = 0
    // 가만히 있을 땐 서기 숨 한 컷마다 한 번만 깬다 (rAF 를 계속 돌리지 않는다)
    if (!calm()) timer = window.setTimeout(() => { timer = 0; wake() }, R.ringIdleMs - (t % R.ringIdleMs) + 4)
  }

  function wake(): void {
    if (!alive || raf !== 0) return
    if (!host.isConnected) { dispose(); return }
    if (document.hidden) return
    if (timer !== 0) { clearTimeout(timer); timer = 0 }
    raf = requestAnimationFrame(tick)
  }

  function paintPicked(): void {
    if (tally === null || party === null) return
    tally.textContent = `${picked.length}/${o.max}`
    party.innerHTML = partyHtml(o, picked)
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
  party.addEventListener('click', (e) => {
    const b = e.target instanceof Element ? e.target.closest<HTMLElement>('.hrg-pf[data-i]') : null
    if (b !== null) goTo(Number(b.dataset['i'] ?? 0))
  })
  const onKey = (e: KeyboardEvent): void => {
    if (!host.isConnected) { dispose(); return }
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
  window.addEventListener('keydown', onKey)
  document.addEventListener('visibilitychange', onVis)
  // 쉼(q-rest)에서 깨어나면 서기 숨도 다시
  host.addEventListener('pointerdown', wake)
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { measure(); layout(); wake() }) : null
  ro?.observe(ring)

  function dispose(): void {
    if (!alive) return
    alive = false
    if (raf !== 0) cancelAnimationFrame(raf)
    if (timer !== 0) clearTimeout(timer)
    raf = 0
    timer = 0
    window.removeEventListener('keydown', onKey)
    document.removeEventListener('visibilitychange', onVis)
    ro?.disconnect()
  }

  // 처음 그림(ringHtml 이 넣어 둔 것)도 큰 판이 없으면 작은 판으로
  const first = hs[shown]
  if (first !== undefined && first.big !== null && first.bigAlt !== null) {
    const alt = first.bigAlt
    pic.onerror = (): void => { pic.onerror = null; pic.src = alt }
  }
  measure()
  layout()
  paintPicked()
  wake()
  return { dispose }
}

/**
 * 링 모양 — 접두 hrg- (다른 화면의 이름과 겹치지 않게).
 * 폰 그래픽 한도: 부드러운 linear-gradient · filter 를 쓰지 않는다 (radial-gradient · 단색 · box-shadow 만) · 움직이는 것은 작은 얼굴 칸의 transform 뿐.
 * 세로: 위 그림 · 정보 · 전투 동작 / 아래 링. 가로: 왼쪽 그림 · 정보 · 전투 동작 / 오른쪽 링. 완료 단추(.bringgo)는 아래 붙박이.
 */
export const HRING_CSS = `
.ap .bringov.hrgov { padding: 0; background: #0b0907; }
.ap .bringov .bringbox.hrgbox { width: 100%; height: 100%; max-height: none; margin: 0; padding: 0; border: 0; border-radius: 0; overflow: hidden; background: #120f0c; box-shadow: none; --hrg-bar: calc(68px + env(safe-area-inset-bottom)); }
.ap .bringov .hrgbox .bx { z-index: 9; width: 44px; height: 44px; right: max(4px, env(safe-area-inset-right)); top: calc(env(safe-area-inset-top) + 2px); font-size: 20px; color: #e9dcc0; text-shadow: 0 1px 4px #000; }
.ap .bringov .hrgbox .bringgo { height: var(--hrg-bar); box-sizing: border-box; align-items: center; padding: 0 14px env(safe-area-inset-bottom); background: #0d0a07e8; border-top: 1px solid #3a2e1e; }
.ap .bringov .hrgbox .bringgo .btn { padding: 5px 14px; font-size: 17px; }
.ap .hrg { position: absolute; inset: 0; display: flex; flex-direction: column; overflow: hidden; container-type: size; color: #efe6d4; background: #120f0c; }
.ap .hrg-hero { position: relative; flex: 1 1 auto; min-height: 42cqh; overflow: hidden; }
.ap .hrg-pic { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 50% 12%; transition: opacity .18s; }
.ap .hrg-pic.swap { opacity: 0; }
.ap .hrg-fade { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(150% 100% at 50% 0%, #120f0c00 58%, #120f0cd0 84%, #120f0c 100%); }
.ap .hrg-info { position: absolute; left: 14px; bottom: 8px; width: min(52cqw, 300px); display: flex; flex-direction: column; align-items: flex-start; gap: .3em; z-index: 3; font-size: 12.5px; text-shadow: 0 1px 3px #000, 0 0 10px #000; }
.ap .hrg-from { color: #cbbd9f; font-size: 1.04em; }
.ap .hrg-name { font-family: var(--serif); font-size: clamp(26px, 8cqw, 46px); line-height: 1.05; color: #f6e7c4; }
.ap .hrg-name .ttl { font-size: .42em; color: #cbbd9f; margin-right: .3em; vertical-align: .35em; font-weight: 400; }
.ap .hrg-lv { font-size: 1em; font-weight: 700; color: #2a1805; background: #e3b45c; border: 1px solid #f6d48a; border-radius: 6px; padding: .08em .65em; text-shadow: none; }
.ap .hrg-lv.zero { color: #cbbd9f; background: #2a2219; border-color: #5b4a2c; }
.ap .hrg-st { display: grid; grid-template-columns: auto minmax(48px, 1fr) auto; gap: .24em .65em; align-items: center; width: 100%; font-size: 1em; margin-top: .15em; }
.ap .hrg-st i { font-style: normal; color: #d6c8a8; }
.ap .hrg-st b { color: #f6d48a; font-variant-numeric: tabular-nums; min-width: 1.3em; text-align: right; }
.ap .hrg-tr { height: .48em; border-radius: .24em; background: #ffffff24; overflow: hidden; box-shadow: 0 0 4px #000a; }
.ap .hrg-tr span { display: block; height: 100%; border-radius: inherit; background: #e0ad55; }
.ap .hrg-fight { position: absolute; right: 2cqw; bottom: 4px; width: 42cqw; height: min(36cqw, 26cqh); z-index: 4; pointer-events: none; }
.ap .hrg-fight canvas { display: block; width: 100%; height: 100%; }
.ap .hrg-wheel { position: relative; flex: 0 0 auto; height: calc(47cqw + 50px); padding-bottom: var(--hrg-bar); display: flex; flex-direction: column; align-items: center; z-index: 5;
  background: radial-gradient(closest-side, #2a2418 0%, #120f0c00 100%); }
.ap .hrg-ring { position: relative; flex: 1 1 auto; width: 100%; min-height: 0; touch-action: none; cursor: grab; }
.ap .hrg-disc { position: absolute; border-radius: 50%; border: 2px solid #e3b45c55; pointer-events: none;
  background: radial-gradient(closest-side, #e3b45c22, #e3b45c00 78%), repeating-radial-gradient(closest-side, #e3b45c00 0 17%, #e3b45c2a 17.4% 18%); }
.ap .hrg-slot { position: absolute; left: 0; top: 0; padding: 0; margin: 0; border-radius: 50%; border: 2px solid #8a6d3b; background: #0c0b09; cursor: pointer; overflow: hidden; transform-origin: 50% 70%; opacity: 0; will-change: transform; }
.ap .hrg-f { position: absolute; inset: 0; background: #0c0b09 center 14% / cover no-repeat; transition: opacity .15s; }
.ap .hrg-slot.hid { background: radial-gradient(circle at 50% 40%, #3a3022, #15120e); border-color: #4a3c25; }
.ap .hrg-slot.hid .hrg-f { opacity: 0; }
.ap .hrg-slot.fr { border-color: #f6d48a; box-shadow: 0 0 0 3px #e3b45c55, 0 0 18px #e3b45c88; }
.ap .hrg-slot.on::after { content: "✓"; position: absolute; right: 6%; top: 6%; width: 30%; height: 30%; border-radius: 50%; background: #e3b45c; color: #2a1805; font: 700 14px/1 var(--body); display: grid; place-items: center; }
.ap .hrg-arw { position: absolute; top: calc(var(--hrg-fy, 70%) - 22px); width: 44px; height: 44px; border-radius: 50%; border: 1px solid #6b5532; background: #1b1712d8; color: #f6d48a; font-size: 16px; cursor: pointer; display: grid; place-items: center; z-index: 120; padding: 0; }
.ap .hrg-arw.l { left: 4px; } .ap .hrg-arw.r { right: 4px; }
.ap .hrg-count { flex: 0 0 auto; color: #a89c86; font-size: 14px; font-variant-numeric: tabular-nums; line-height: 1.2; }
.ap .hrg-count b { font-family: var(--serif); color: #f6d48a; font-size: 21px; }
.ap .hrg-scrub { flex: 0 0 auto; width: min(64%, 360px); padding: 9px 0 7px; cursor: pointer; touch-action: none; }
.ap .hrg-sbar { position: relative; display: block; height: 4px; border-radius: 2px; background: #ffffff1c; }
.ap .hrg-sbar s { position: absolute; top: -3px; bottom: -3px; width: 2px; margin-left: -1px; background: #e3b45c99; }
.ap .hrg-sbar i { position: absolute; top: 50%; width: 12px; height: 12px; margin: -6px 0 0 -6px; border-radius: 50%; background: #f6d48a; box-shadow: 0 0 8px #e3b45c; }
.ap .hrg-top { position: absolute; left: 14px; right: 52px; top: calc(env(safe-area-inset-top) + 8px); z-index: 6; text-shadow: 0 1px 3px #000, 0 0 8px #000; }
.ap .hrg-title { margin: 0; font-family: var(--serif); font-size: clamp(19px, 5.6cqw, 28px); color: #f6d48a; font-weight: 700; }
.ap .hrg-title small { font-family: var(--body); font-size: .62em; color: #d6c8a8; font-weight: 400; margin-left: .3em; }
.ap .hrg-party { display: flex; align-items: center; gap: 6px; margin-top: 6px; color: #d6c8a8; font-size: 13px; }
.ap .hrg-party em { font-style: normal; margin-left: 2px; }
.ap .hrg-pf { width: 36px; height: 36px; padding: 0; border-radius: 50%; border: 2px solid #e3b45c; background: #0c0b09 center 14% / cover no-repeat; cursor: pointer; flex: 0 0 auto; }
.ap .hrg-pf.none { border: 1.5px dashed #b08c4e; background: #0c0b09d0; cursor: default; }
@media (orientation: landscape) {
  .ap .bringov .hrgbox .bringgo { left: 50%; }
  .ap .hrg { flex-direction: row; }
  .ap .hrg-hero { flex: 0 0 50cqw; min-height: 0; }
  .ap .hrg-fade { background: radial-gradient(100% 160% at 0% 45%, #120f0c00 60%, #120f0cd0 86%, #120f0c 100%); }
  .ap .hrg-info { left: max(16px, env(safe-area-inset-left)); bottom: 12px; width: min(24cqw, 380px); font-size: clamp(12.5px, 1.2cqw, 17px); }
  .ap .hrg-top { left: max(14px, env(safe-area-inset-left)); }
  .ap .hrg-arw.r { right: max(4px, env(safe-area-inset-right)); }
  .ap .hrg-name { font-size: clamp(24px, 4.4cqw, 52px); }
  .ap .hrg-fight { left: 26cqw; right: auto; bottom: 6px; width: 23cqw; height: min(46cqh, 24cqw); }
  .ap .hrg-wheel { flex: 1 1 auto; height: auto; padding-top: calc(env(safe-area-inset-top) + 44px); }
  .ap .hrg-top { right: auto; width: 46cqw; }
  .ap .hrg-title { font-size: clamp(19px, 2.6cqw, 30px); }
}
@media (prefers-reduced-motion: reduce) { .ap .hrg-pic, .ap .hrg-f { transition: none; } }
`
