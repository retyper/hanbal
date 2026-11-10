/**
 * 마을 안 (docs/realm/TOWN.md) — 고을 일터를 눈으로 보이는 마을로.
 * 형 11-05: "배경은 빈 터 · 구역마다 1·2·3단계 에셋 · 스타크래프트 구도 · 목책과 해자 · 제작 시작하면 일꾼들은 망치질".
 * 형 11-08: "마을 안 컨텐츠가 허접하고 폰에서 UI 가 초보적 · 슬라이드 최대한 없게" → TOWN.md 「11-08 폰 UX 다시」.
 *
 * 세로 폰 한 화면에 넷이 붙박이로 선다 — 아무것도 구르지 않는다:
 *   ① 위 띠: 고을 이름 · 집 · 일손 · 터 (그림표+숫자 · 꾹 누르면 뜻)
 *   ② 판(.tvstage): 비스듬히 내려다본 빈 마을 터 그림 한 장(town/ground-*.png · 1376×768)을 폭에 꽉 차게(양옆 풀밭을 잘라) · 터 넷(LOTS)마다
 *      선 일터의 단 그림(town/work-<일터>-<단>.png) · 짓는 터엔 비계(town/build.png)와 망치질꾼과 얇은 진행 막대 · 고른 터엔 금빛 고리 ·
 *      가구 수만큼 사람이 광장과 길을 오간다 (유민 걷기 띠). 터를 누르면 고르기(data-act=town-lot).
 *   ③ 아래 칸(.tvdock): 고른 터 하나의 큰 그림 — 올리면 「지금 → 다음 단」, 빈 터면 그림표 타일(이 땅에 맞는 일터 · 잠긴 건 🔒 · 누르면 까닭),
 *      짓는 중이면 비계와 진행 막대.
 *   ④ 맨 아래 큰 단추 하나(.tvbar · data-act=work): 「짓기 시작 ▼값 ⏳달」 · 고르면 금빛 눌린 채 ✓ · 다시 누르면 거둠 · 못 하면 눌렀을 때 까닭.
 * 넓은 가로 화면에선 ③④ 가 오른쪽 기둥으로.
 *
 * 판을 읽기만 한다 (절대 규칙 2) — 판을 바꾸는 손은 app 의 「work」 명령 하나뿐. 사람 자리·걸음 빠르기는 고을 id 로 정해 다시 그려도 튀지 않는다.
 * 폰 그래픽 한도 (메모리 mobile-gpu-layer-limit): 넓은 칸에 transform·filter 애니 금지 · 부드러운 linear-gradient 금지 —
 * 움직이는 건 작은 사람 칸·작은 도장뿐이고, 밝아지기는 opacity 로.
 */
import { P } from '../../tune/params.ts'
import { BUILDER_ANIM, VILLAGER_ANIM } from '../../realm/data/art.ts'

/** 터 넷 — 가운데 x · 터 아랫단 y · 폭 (그림 비율) · 차례: 왼위 · 오른위 · 왼아래 · 오른아래. 11-08 바탕을 울타리 친 빈 마을(town/ground-field.png)로 바꾸며 광장의 빈 땅에 맞춰 다시 잼 · 터는 바탕에 그려져 있지 않고 town/lot.png 를 터마다 얹는다 (형 11-08: "만들지 못하는 공간들에 구역이 또 있고 성의 없어 보인다") */
const LOTS: ReadonlyArray<{ readonly x: number; readonly y: number; readonly w: number }> = [
  { x: 525 / 1376, y: 358 / 768, w: 300 / 1376 },
  { x: 850 / 1376, y: 358 / 768, w: 300 / 1376 },
  { x: 470 / 1376, y: 565 / 768, w: 340 / 1376 },
  { x: 890 / 1376, y: 565 / 768, w: 340 / 1376 },
]

/** 빈 터에 지을 수 있는 일터 하나 (이 땅에 맞는 것 · 잠긴 것도 까닭과 함께) */
export interface TownOption {
  readonly what: string
  readonly name: string
  /** 일터 그림표 (public/realm/icon) */
  readonly icon: string
  /** 1단 그림 (없으면 null) */
  readonly sprite: string | null
  /** 값 칩 HTML (app.costHtml) */
  readonly cost: string
  /** 1단 효과 숫자 (works.workEffect) */
  readonly eff: string
  readonly does: string
  /** 못 고르는 까닭 — 되면 null */
  readonly why: string | null
  /** 이번 달 이것으로 고름 (다음 달 선다) */
  readonly on: boolean
}

/** 터 하나에 무엇이 서 있나 */
export type TownSlot =
  | {
      readonly k: 'work'; readonly what: string; readonly name: string; readonly icon: string; readonly sprite: string | null; readonly lv: number; readonly max: number; readonly does: string
      /** 지금 단 효과 숫자 (works.workEffect) */
      readonly eff: string
      /** 다음 단 (다 올렸으면 null) */
      readonly next: { readonly sprite: string | null; readonly cost: string; readonly when: string; readonly gain: string; readonly why: string | null; readonly on: boolean } | null
      /** 지금 이 터를 올리는 중 */
      readonly going: { readonly left: string; readonly prog: number } | null
      /** 꾹 누르면 — 숫자 */
      readonly tip: string
    }
  | { readonly k: 'going'; readonly what: string; readonly name: string; readonly icon: string; readonly left: string; readonly prog: number; readonly tip: string }
  | { readonly k: 'empty'; readonly options: readonly TownOption[]; readonly when: string; readonly tip: string }
  | {
      readonly k: 'locked'; readonly why: string
      /** 터 닦기 — 맨 앞 잠긴 터에만 (없으면 null) · 닦는 중이면 going */
      readonly clear: { readonly cost: string; readonly when: string; readonly why: string | null; readonly on: boolean } | null
      readonly going: { readonly left: string; readonly prog: number } | null
    }

export interface TownViewIn {
  readonly id: string
  readonly name: string
  readonly hh: number
  /** 바탕 그림 경로 (art 기준) */
  readonly bg: string
  readonly art: string
  readonly slots: readonly TownSlot[]
  /** 이 땅의 터 수 (works.lotCap) */
  readonly lots: number
  /** 고른 터와 (빈 터면) 지을 일터 */
  readonly pick: { readonly lot: number; readonly what: string | null }
  /** 처음 여는 그림이면 밝아지며 */
  readonly fresh: boolean
  /** 지금 가진 것 — 이번 달 고른 것을 뺀 몫 (그림표+숫자 HTML · 형 11-09: "지을 때 내 재산이 얼마 있는지 안 보임") */
  readonly stock: string
  /** 지난 달 완공 — 「완공!」 도장 (없으면 null) */
  readonly stamp: { readonly icon: string; readonly name: string } | null
  /** 도읍(궁전) — 있으면 위 띠 밑에 「궁전」 띠가 서고 · on 이면 판 자리에 큰 공사·큰 잔치(html)가 선다 */
  readonly palace?: { readonly on: boolean; readonly html: string }
}
/** 앞뒤 — 발(아랫단)이 아래일수록 앞에 (터·사람 모두 · 형 11-08: "사람은 무조건 땅보다 위에") */
const zOf = (y: number): number => 10 + Math.round(y * 1000)
/** 고을 id 로 정하는 0~1 (다시 그려도 같은 자리) */
function hash01(s: string, i: number): number {
  let h = 2166136261 ^ i
  for (let j = 0; j < s.length; j++) h = Math.imul(h ^ s.charCodeAt(j), 16777619)
  return ((h >>> 0) % 10000) / 10000
}

const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
/** 못 누르는 단추 — 누르면 까닭이 뜬다 (app 의 denyPop · aria-disabled + data-why) */
const deny = (why: string | null): string => (why === null ? '' : ` aria-disabled="true" data-why="${esc(why)}"`)
const stars = (lv: number, max: number): string => '★'.repeat(lv) + '☆'.repeat(Math.max(0, max - lv))
const pct = (v: number): string => `${(v * 100).toFixed(2)}%`
const ic = (art: string, name: string, cls = 'tvi'): string => `<img class="${cls}" src="${art}icon/${name}.png" alt="">`
const prog = (p: number): string => `<u class="tvpb"><i style="--p:${Math.round(Math.max(0, Math.min(1, p)) * 100)}%"></i></u>`

/** 마을 안 사람 수 — 집 수로 (params) · 판에 보이는 수가 곧 일손 */
export function townHands(hh: number): number {
  const R = P.realm
  return Math.max(Math.round(R.townWalkMin), Math.min(Math.round(R.townWalkMax), Math.round(hh / Math.max(1, R.townHHPerWalker))))
}

/** 판 위의 터 하나 */
/** 고른 터의 바닥 표지 — 터 모양 그대로 마름모 · 흐르는 금빛 테두리 (네 모서리 꺾쇠가 왔다 갔다 해 거슬렸다 · 형 11-09 뺌) */
const SEL_MARK = '<i class="tvmark"><svg viewBox="0 0 200 100" preserveAspectRatio="none"><polygon points="100,4 196,50 100,96 4,50"/></svg></i>'

/** 터 하나의 그림들을 한 덩어리로 — 고르면 덩어리 테두리를 따라 금빛 윤곽 (이름표는 밖에 둔다) */
function wrapArt(html: string, sel: boolean): string {
  const at = html.indexOf('>') + 1
  const lb = html.indexOf('<b class="tvl"')
  const end = lb >= 0 ? lb : html.lastIndexOf('</button>')
  return html.slice(0, at) + (sel ? SEL_MARK : '') + '<span class="tvart">' + html.slice(at, end) + '</span>' + html.slice(end)
}

function lotHtml(t: TownViewIn, s: TownSlot, i: number, sel: boolean): string {
  return wrapArt(lotInner(t, s, i, sel), sel)
}

function lotInner(t: TownViewIn, s: TownSlot, i: number, sel: boolean): string {
  const L = LOTS[i]!
  const pos = `left:${pct(L.x)};top:${pct(L.y)};width:${pct(L.w)};z-index:${zOf(L.y)}`
  const open = (cls: string, tip: string): string => `<button class="tvlot2 ${cls}${sel ? ' sel' : ''}" data-act="town-lot" data-i="${i}"${tip !== '' ? ` data-tip="${esc(tip)}"` : ''} style="${pos}"><img class="tvlotbg" src="${t.art}town/${/^(locked|going clearing)/.test(cls) ? 'lot-rough' : 'lot'}.png" alt="">`
  if (s.k === 'work') {
    const up = s.going !== null
    const pic = s.sprite !== null ? `<img class="tvsp" src="${s.sprite}" alt="">` : ic(t.art, s.icon, 'tvic')
    const ghost = !up && s.next?.on === true && s.next.sprite !== null ? `<img class="tvsp ghost" src="${s.next.sprite}" alt="">` : ''
    return open(up ? 'going' : s.next?.on === true ? 'plan' : 'work', s.tip) + pic + ghost + (up ? `<img class="tvsc2" src="${t.art}town/build.png" alt="">` : '')
      + `<b class="tvl">${esc(s.name)} <i>${stars(s.lv, s.max)}</i>${up ? ` · ${esc(s.going!.left)}${prog(s.going!.prog)}` : s.next?.on === true ? ' · 다음 달부터' : ''}</b></button>`
  }
  if (s.k === 'going') return open('going', s.tip) + `<img class="tvsp" src="${t.art}town/build.png" alt=""><b class="tvl">${esc(s.name)} 짓는 중 · ${esc(s.left)}${prog(s.prog)}</b></button>`
  if (s.k === 'empty') {
    const on = s.options.find((o) => o.on)
    if (on !== undefined) {
      const pic = on.sprite !== null ? `<img class="tvsp ghost" src="${on.sprite}" alt="">` : ic(t.art, on.icon, 'tvic ghost')
      return open('plan', s.tip) + pic + `<b class="tvl">${esc(on.name)} · 다음 달부터</b></button>`
    }
    return open('empty', s.tip) + `<b class="tvl">빈 터</b></button>`
  }
  if (s.going !== null) return open('going clearing', s.why) + `<img class="tvsp" src="${t.art}town/build.png" alt=""><b class="tvl">터 닦는 중 · ${esc(s.going.left)}${prog(s.going.prog)}</b></button>`
  if (s.clear !== null) return open(`locked canclear${s.clear.on ? ' plan' : ''}`, s.why) + `<b class="tvl">${s.clear.on ? '✓ 다음 달 터 닦기' : '🔨 터 닦기'}</b></button>`
  return open('locked', s.why) + `<b class="tvl">🔒</b></button>`
}

/** 아래 칸 — 고른 터 하나 · 그리고 맨 아래 단추 */
function dockHtml(t: TownViewIn, s: TownSlot | undefined): { dock: string; bar: string } {
  const R = P.realm
  const node = t.id
  const busyWhy = '한 번에 하나만 짓습니다 · 다 서면 다음 것을 고를 수 있습니다'
  if (s !== undefined && s.k === 'locked' && s.going !== null) {
    return {
      dock: `<div class="tvfh"><b>🔨 터 닦는 중</b><span class="tveff">▲ 터 +1</span></div>`
        + `<div class="tvgoing"><img src="${t.art}town/build.png" alt=""><div class="tvprog"><i style="--p:${Math.round(s.going.prog * 100)}%"></i></div><b>${esc(s.going.left)} 남았습니다</b></div>`,
      bar: `<button class="tvgo"${deny(busyWhy)}>🔨 터 닦는 중 · ${esc(s.going.left)}</button>`,
    }
  }
  if (s !== undefined && s.k === 'locked' && s.clear !== null) {
    const c = s.clear
    return {
      dock: `<div class="tvfh"><b>잠긴 터</b><span class="tveff">▲ 터 +1</span></div>`
        + `<div class="tvup one tvclr"><img src="${t.art}town/lot.png" alt=""></div>`
        + `<p class="tvdoes">땅을 고르고 돌 테두리를 쌓아 일터 하나를 더 세울 터를 닦습니다</p>`,
      bar: c.on
        ? `<button class="tvgo on" data-act="clear-lot" data-node="${node}">✓ 다음 달 터 닦기를 시작합니다<small>다시 누르면 거둡니다</small></button>`
        : `<button class="tvgo" data-act="clear-lot" data-node="${node}"${deny(c.why)}>🔨 터 닦기 ${c.cost}<span class="whenc"><b>⏳${esc(c.when)}</b></span></button>`,
    }
  }
  if (s === undefined || s.k === 'locked') {
    const why = s?.why ?? '터를 고르세요'
    return {
      dock: `<div class="tvfh"><b>🔒 잠긴 터</b></div><div class="tvlock"><p>${esc(why)}</p><p class="mute">도읍은 터 ${Math.round(R.workLotCapital)}곳 · 마을과 포구는 ${Math.round(R.workLotTown)}곳 · 산성과 철광은 ${Math.round(R.workLotSmall)}곳입니다</p></div>`,
      bar: `<button class="tvgo"${deny(why)}>🔒 이 터는 쓸 수 없습니다</button>`,
    }
  }
  if (s.k === 'going') {
    return {
      dock: `<div class="tvfh">${ic(t.art, s.icon)}<b>${esc(s.name)}</b><span>짓는 중</span></div>`
        + `<div class="tvgoing"><img src="${t.art}town/build.png" alt=""><div class="tvprog"><i style="--p:${Math.round(s.prog * 100)}%"></i></div><b>${esc(s.left)} 남았습니다</b></div>`,
      bar: `<button class="tvgo"${deny(busyWhy)}>🔨 ${esc(s.name)} 짓는 중 · ${esc(s.left)}</button>`,
    }
  }
  if (s.k === 'work') {
    const head = `<div class="tvfh">${ic(t.art, s.icon)}<b>${esc(s.name)}</b><i>${stars(s.lv, s.max)}</i><span class="tveff">▲ ${esc(s.eff)}</span></div>`
    if (s.going !== null) {
      return {
        dock: head + `<div class="tvgoing"><img src="${t.art}town/build.png" alt=""><div class="tvprog"><i style="--p:${Math.round(s.going.prog * 100)}%"></i></div><b>${s.lv + 1}단으로 · ${esc(s.going.left)} 남았습니다</b></div>`,
        bar: `<button class="tvgo"${deny(busyWhy)}>🔨 ${esc(s.name)} ${s.lv + 1}단으로 올리는 중 · ${esc(s.going.left)}</button>`,
      }
    }
    if (s.next === null) {
      return {
        dock: head + `<div class="tvup one">${s.sprite !== null ? `<img src="${s.sprite}" alt="">` : ic(t.art, s.icon, 'tvbig')}</div><p class="tvdoes">가장 높은 단입니다 · <b class="tveff">▲ ${esc(s.eff)}</b></p>`,
        bar: `<button class="tvgo"${deny('다 올렸습니다 · 더 올릴 단이 없습니다')}>★ 다 올렸습니다</button>`,
      }
    }
    const n = s.next
    const cur = s.sprite !== null ? `<img src="${s.sprite}" alt="">` : ic(t.art, s.icon, 'tvbig')
    const nxt = n.sprite !== null ? `<img src="${n.sprite}" alt="">` : ic(t.art, s.icon, 'tvbig')
    return {
      dock: head + `<div class="tvup"><div class="tvcur">${cur}<b>${s.lv}단</b></div><i class="tvarrow">➜</i><div class="tvnxt">${nxt}<b>${s.lv + 1}단</b></div></div>`
        + `<div class="tvchips">${n.cost}<span class="whenc"><b>⏳${esc(n.when)}</b></span><span class="tvgain"><b>▲ ${esc(s.eff)} → ${esc(n.gain.replace(/^[^+−]*/, ''))}</b></span></div>`,
      bar: n.on
        ? `<button class="tvgo on" data-act="work" data-node="${node}" data-lot="${Math.max(0, Math.min(t.slots.length - 1, t.pick.lot))}" data-what="${s.what}">✓ ${esc(s.name)} ${s.lv + 1}단 · 다음 달 시작합니다<small>다시 누르면 거둡니다</small></button>`
        : `<button class="tvgo" data-act="work" data-node="${node}" data-lot="${Math.max(0, Math.min(t.slots.length - 1, t.pick.lot))}" data-what="${s.what}"${deny(n.why)}>${ic(t.art, s.icon)}${esc(s.name)} ${s.lv + 1}단으로 올리기 ${n.cost}<span class="whenc"><b>⏳${esc(n.when)}</b></span></button>`,
    }
  }
  // 빈 터 — 이 땅에 맞는 일터 타일
  const picked = s.options.find((o) => o.on) ?? s.options.find((o) => o.what === t.pick.what) ?? null
  const tiles = s.options.map((o) => {
    const on = picked?.what === o.what
    return `<button class="tvtile${on ? ' on' : ''}${o.why !== null ? ' lk' : ''}" data-act="town-what" data-what="${o.what}"${deny(o.why)}>${ic(t.art, o.icon, 'tvti')}<b>${esc(o.name)}</b><em class="tveff">▲ ${esc(o.eff)}</em><small>${o.why !== null ? '🔒' : o.cost}</small></button>`
  }).join('')
  const dock = `<div class="tvfh"><b>빈 터</b><span>${s.options.length > 0 ? '무엇을 세울까요 · ' + esc(s.when) + ' 걸려 섭니다' : '이 땅에 맞는 일터가 없습니다'}</span></div>`
    + `<div class="tvtiles">${tiles}</div>`
    + `<p class="tvdoes">${picked !== null ? `<b class="tveff">▲ ${esc(picked.eff)}</b> ${esc(picked.does)}${picked.why !== null ? ` · 🔒 ${esc(picked.why)}` : ''}` : '타일을 누르면 설명이 보입니다'}</p>`
  const bar = picked === null
    ? `<button class="tvgo"${deny(s.options.length > 0 ? '위 타일에서 지을 것을 먼저 고르세요' : '이 땅에 맞는 일터가 없습니다')}>지을 것을 고르세요</button>`
    : picked.on
      ? `<button class="tvgo on" data-act="work" data-node="${node}" data-lot="${Math.max(0, Math.min(t.slots.length - 1, t.pick.lot))}" data-what="${picked.what}">✓ ${esc(picked.name)} · 다음 달 짓기 시작합니다<small>다시 누르면 거둡니다</small></button>`
      : `<button class="tvgo" data-act="work" data-node="${node}" data-lot="${Math.max(0, Math.min(t.slots.length - 1, t.pick.lot))}" data-what="${picked.what}"${deny(picked.why)}>${ic(t.art, picked.icon)}${esc(picked.name)} 짓기 시작 ${picked.cost}<span class="whenc"><b>⏳${esc(s.when)}</b></span></button>`
  return { dock, bar }
}

export function townViewHtml(t: TownViewIn): string {
  const slots = t.slots.slice(0, LOTS.length)
  const selI = Math.max(0, Math.min(slots.length - 1, t.pick.lot))
  const busyAt = slots.findIndex((s) => s.k === 'going' || (s.k === 'work' && s.going !== null))
  let lotsHtml = ''
  slots.forEach((s, i) => { lotsHtml += lotHtml(t, s, i, i === selI) })
  // 사람 — 짓는 터 앞에서 망치질하는 일꾼 · 나머지는 길 셋(가로 길 · 세로 길 · 둘레 길)에 고루 흩어져 오간다.
  // 시작점은 차례대로 등분(k/m)하고 해시는 살짝만 흔든다 — 해시만으로 뿌리면 한 곳에 몰렸다 (11-08 · 집 1200 폰 스크린샷)
  const n = townHands(t.hh)
  const workers = busyAt >= 0 ? Math.max(2, Math.min(4, Math.round(n * 0.4))) : 0
  const walkers = n - workers
  const ROADS = ['h', 'v', 'ring'] as const
  // 길마다 몇이 서나 — 가로 길이 가장 길어 많이, 둘레 길·세로 길 순
  const share = [Math.round(walkers * 0.6), 0, 0] as [number, number, number] // 11-08 울타리 마을 바탕엔 안쪽 둘레 길이 없다 — 둘레 몫은 0 (울타리 위에 서던 사람들)
  share[1] = Math.max(0, walkers - share[0])
  /** 사람마다 셋 가운데 하나 — 고을 id 로 정해 다시 그려도 같은 사람 */
  const vOf = (i: number): number => Math.floor(hash01(t.id, i + 307) * VILLAGER_ANIM.length) % VILLAGER_ANIM.length
  let folk = ''
  let w = 0
  for (let i = 0; i < n; i++) {
    const a = hash01(t.id, i)
    const b = hash01(t.id, i + 101)
    const c = hash01(t.id, i + 211)
    if (i < workers) {
      // 공사판 안 — 돌 테두리 안쪽 마당에 둥글게 서서 말뚝을 박는다. 터 그림(z = zOf(L.y))보다 위에 그린다:
      // 전엔 발 자리(y)로 z 를 매겨 터 그림 뒤에 깔려 하나도 안 보였다 (11-09 폰 스크린샷)
      const L = LOTS[busyAt]!
      const ang = Math.PI * (0.15 + 0.7 * (i + 0.5) / workers)
      const x = L.x + Math.cos(ang) * L.w * 0.3
      const y = L.y - L.w * 0.3 + Math.sin(ang) * L.w * 0.1
      folk += `<i class="tvf work" style="left:${pct(x)};top:${pct(y)};z-index:${zOf(L.y) + 1 + Math.round(Math.sin(ang) * 5)};--d:${(-c * 1.2).toFixed(2)}s;${x > L.x ? '--fl:-1;' : ''}"><u></u><s></s></i>`
      continue
    }
    // 몇째 길의 몇째 사람인가
    let road: (typeof ROADS)[number] = 'h'
    let k = w
    let m = share[0]
    if (w >= share[0] + share[1]) { road = 'ring'; k = w - share[0] - share[1]; m = share[2] } else if (w >= share[0]) { road = 'v'; k = w - share[0]; m = share[1] }
    w++
    const u = (k + 0.5 + (a - 0.5) * 0.5) / Math.max(1, m) // 0~1 · 등분 + 살짝 흔듦
    const delay = `--d:${(-b * 9).toFixed(1)}s`
    if (road === 'h') {
      // 가로 길(y≈0.48) — 울타리 안 광장을 가로지르는 길 · 짧게 오간다
      const y = 0.45 + c * 0.05
      const x0 = 0.22 + u * 0.5 // 울타리 안쪽(가로 0.17~0.85)에서만
      const sc = 0.82 + (y - 0.4) * 1.2
      folk += `<i class="tvf walk v${vOf(i)}" style="left:${pct(x0)};top:${pct(y)};z-index:${zOf(y) + 1};--dx:${(6 + c * 6).toFixed(1)}cqw;--sc:${sc.toFixed(2)};--dur:${(7 + c * 5).toFixed(1)}s;${delay}"><u></u></i>`
    } else if (road === 'v') {
      // 세로 길(x≈0.5) — 위 문에서 아래 문까지 고루 · 멀수록(위) 작게
      const x0 = 0.48 + c * 0.04
      const y0 = 0.12 + u * 0.62
      const sc = 0.66 + y0 * 0.6
      folk += `<i class="tvf walkv v${vOf(i)}" style="left:${pct(x0)};top:${pct(y0)};z-index:${zOf(y0) + 1};--dy:${(8 + c * 8).toFixed(1)}cqh;--sc:${sc.toFixed(2)};--dur:${(7 + c * 5).toFixed(1)}s;${delay}"><u></u></i>`
    } else {
      // 둘레 길 — 타원 길의 위·아래 호에 고루(양끝은 폰에서 잘린다) · 제자리 가까이를 가로로 오간다
      const ang = u < 0.5 ? Math.PI * (0.2 + 0.6 * u * 2) : Math.PI * (1.2 + 0.6 * (u - 0.5) * 2)
      const x0 = 0.5 + Math.cos(ang) * 0.42
      const y0 = 0.5 + Math.sin(ang) * 0.38
      const sc = 0.66 + y0 * 0.6
      folk += `<i class="tvf walk v${vOf(i)}" style="left:${pct(x0)};top:${pct(y0)};z-index:${zOf(y0) + 1};--dx:${(4 + c * 5).toFixed(1)}cqw;--sc:${sc.toFixed(2)};--dur:${(6 + c * 5).toFixed(1)}s;${delay}"><u></u></i>`
    }
  }
  const built = slots.filter((s) => s.k === 'work').length
  const { dock, bar } = dockHtml(t, slots[selI])
  const stamp = t.stamp !== null
    ? `<div class="tvdone" data-act="town-stamp-x"><i class="tvflash"></i><div class="tvstamp"><b>완공!</b><span>${ic(t.art, t.stamp.icon)}${esc(t.stamp.name)}</span></div></div>`
    : ''
  const pal = t.palace
  if (pal?.on === true) {
    return `<div class="townv pal" role="dialog" aria-label="${esc(t.name)} 도읍">`
      + `<div class="tvtop"><b>궁전</b><button class="tvx" data-act="town-out" aria-label="나가기">✕</button></div>`
      + `<div class="tvpal"><div class="tvhall"><b>도읍 · ${esc(t.name)}</b></div><div class="tvpbody">${pal.html}</div></div>`
      + `<div class="tvbar"><div class="tvhave">${t.stock}</div><button class="tvgo" data-act="palace-tab" data-v="0">${ic(t.art, 'settle-hamlet')}마을 안 보기</button></div></div>`
  }
  const palBand = pal !== undefined ? `<button class="tvpband" data-act="palace-tab" data-v="1">${ic(t.art, 'treasure-silla-crown')}<b>궁전</b><span>큰 공사 · 큰 잔치</span><i>➜</i></button>` : ''
  return `<div class="townv${t.fresh ? ' fresh' : ''}${pal !== undefined ? ' hascap' : ''}" role="dialog" aria-label="${esc(t.name)} 마을 안">`
    + `<div class="tvtop"><b>${esc(t.name)}</b>`
    + `<span class="tvst" data-tip="집 ${t.hh}채 · 집이 늘면 일손도 늡니다">${ic(t.art, 'settle-hamlet')}${t.hh}</span>`
    + `<span class="tvst" data-tip="일손 ${n} · 집 ${Math.round(P.realm.townHHPerWalker)}채에 하나씩 저절로 일합니다">${ic(t.art, 'unit-porters')}${n}</span>`
    + `<span class="tvst" data-tip="터 ${built}/${t.lots} · 터마다 일터 하나를 짓고 단을 올립니다 · 같은 일터를 여러 터에 지으면 몫이 더해집니다">${ic(t.art, 'settle-clearing')}${built}/${t.lots}</span>`
    + `<button class="tvx" data-act="town-out" aria-label="마을에서 나가기">✕</button></div>`
    + palBand
    + `<div class="tvstage"><div class="tvboard"><img class="tvbg" src="${t.art}${t.bg}" alt="">${lotsHtml}${folk}</div>${stamp}</div>`
    + `<div class="tvdock">${dock}</div><div class="tvbar"><div class="tvhave">${t.stock}</div>${bar}</div></div>`
}

/**
 * 들어갈 때의 막 — 카메라가 지도 속 그 고을로 파고든다 (형 11-05: "카메라가 마을로 들어가는 연출 · 마을 혼자 커지면 안 된다").
 * 지도(.map)가 그 고을을 축으로 커지고(.tvdive · 손가락 확대와 같은 GPU 늘림 · 잠깐만) 막은 끝 무렵에 그 고을 둘레부터 어두워진다.
 * 그 끝에 마을 판이 조금 작게서 다가오며 밝아진다(.fresh) — 나갈 땐 거꾸로 판이 멀어지고 지도가 그 고을에서 물러난다(.tvrise)
 */
export function townVeilHtml(x: number, y: number): string {
  return `<div class="tvveil" style="--x:${x.toFixed(0)}px;--y:${y.toFixed(0)}px"></div>`
}

/** 짓는 터를 톡톡 — 일꾼들이 잠깐 더 빨리 두드리고 흙먼지가 터진다 (손맛만 · 판은 안 바뀐다). 판 칸(.tvboard)과 터 단추를 받는다 */
export function townCheer(board: HTMLElement, lot: HTMLElement): void {
  const R = P.realm
  board.classList.remove('cheer')
  void board.offsetWidth
  board.classList.add('cheer')
  window.setTimeout(() => board.classList.remove('cheer'), R.townCheerMs)
  const bb = board.getBoundingClientRect()
  const lb = lot.getBoundingClientRect()
  const cx = ((lb.left + lb.width / 2 - bb.left) / Math.max(1, bb.width)) * 100
  const cy = ((lb.top + lb.height * 0.8 - bb.top) / Math.max(1, bb.height)) * 100
  const k = Math.round(R.townCheerPuffs)
  for (let i = 0; i < k; i++) {
    const ang = (Math.PI * 2 * i) / Math.max(1, k)
    const el = document.createElement('i')
    el.className = 'tvpuff'
    el.style.cssText = `left:${cx.toFixed(1)}%;top:${cy.toFixed(1)}%;--px:${(Math.cos(ang) * 26).toFixed(0)}px;--py:${(Math.sin(ang) * 12 - 14).toFixed(0)}px`
    board.appendChild(el)
    window.setTimeout(() => el.remove(), R.townCheerMs)
  }
}

export const TOWN_CSS = `
.ap .tvveil { position: fixed; inset: 0; z-index: 60; pointer-events: none; background: radial-gradient(circle at var(--x) var(--y), #0b090699 0, #0b0906 45vmax); opacity: 0; animation: tvveil var(--tz, .56s) ease-in forwards; }
@keyframes tvveil { 0%, 40% { opacity: 0; } to { opacity: 1; } }
.ap .map.tvdive { transform-origin: var(--ox) var(--oy); animation: tvdive var(--tz, .56s) cubic-bezier(.55, 0, .85, .4) forwards; }
@keyframes tvdive { to { transform: translate(var(--dx, 0px), var(--dy, 0px)) scale(var(--ds, 5)); } }
.ap .map.tvdive .nring { opacity: 0; transition: opacity .12s; }
.ap .map.tvrise { transform-origin: var(--ox) var(--oy); animation: tvrise var(--tf, .38s) cubic-bezier(.15, .65, .35, 1) both; }
@keyframes tvrise { from { transform: translate(var(--dx, 0px), var(--dy, 0px)) scale(var(--ds, 5)); opacity: .15; } }
.ap .townov { position: fixed; inset: 0; z-index: 61; background: #0b0906; display: grid; }
/* 세로: 위 띠 · 판 · 아래 칸 · 단추 — 넷이 붙박이 · 아무것도 구르지 않는다 (TOWN.md 11-08) */
.ap .townv { display: grid; grid-template-areas: "top" "stage" "dock" "bar"; grid-template-rows: auto auto 1fr auto; grid-template-columns: 100%; height: 100%; min-height: 0; color: #f3e6c8; }
.ap .townv.fresh { animation: tvin var(--tf, .38s) ease-out both; }
@keyframes tvin { from { opacity: 0; } }
.ap .townv.fresh .tvboard { animation: tvnear var(--tf, .38s) cubic-bezier(.2, .7, .3, 1) both; }
@keyframes tvnear { from { transform: scale(var(--bf, .84)); } }
.ap .townov.out { animation: tvout var(--tf, .38s) ease-in forwards; }
@keyframes tvout { to { opacity: 0; } }
.ap .townov.out .tvboard { animation: tvaway var(--tf, .38s) ease-in forwards; }
@keyframes tvaway { to { transform: scale(var(--bf, .84)); } }
/* ① 위 띠 */
.ap .tvtop { grid-area: top; display: flex; align-items: center; gap: 10px; padding: 6px 10px; padding-top: max(6px, env(safe-area-inset-top, 0px)); background: #1c1610; border-bottom: 1px solid #3a2c1e; min-height: 44px; box-sizing: border-box; }
.ap .tvtop > b { font-size: 18px; color: #f3d48a; margin-right: auto; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ap .tvst { display: inline-flex; align-items: center; gap: 3px; font-size: 14px; font-weight: 700; white-space: nowrap; }
.ap .tvst img { width: 22px; height: 22px; object-fit: contain; }
.ap .tvx { width: 38px; height: 38px; flex: none; border-radius: 50%; border: 1px solid #c9a45a; background: #1c1610e0; color: #f3e6c8; font-size: 18px; cursor: pointer; }
/* 궁전 띠 · 궁전 판 (도읍 · 큰 공사 넷 + 큰 잔치 · 한 화면 · 구르지 않는다) */
.ap .townv.hascap { grid-template-areas: "top" "band" "stage" "dock" "bar"; grid-template-rows: auto auto auto 1fr auto; }
.ap .tvpband { grid-area: band; display: flex; align-items: center; gap: 8px; min-height: 48px; padding: 4px 12px; border: 0; border-bottom: 1px solid #c9a45a; background: url(__ART__town/palace-hall.jpg) center/cover, #2a1f14; color: #ffe2a0; font: inherit; font-size: 16px; cursor: pointer; text-shadow: 0 1px 3px #000; -webkit-tap-highlight-color: transparent; }
.ap .tvpband img { width: 30px; height: 30px; object-fit: contain; }
.ap .tvpband span { font-size: 13px; color: #f3e6c8; margin-right: auto; }
.ap .townv.pal { grid-template-areas: "top" "pal" "bar"; grid-template-rows: auto 1fr auto; }
.ap .tvpal { grid-area: pal; min-height: 0; display: flex; flex-direction: column; overflow: hidden; background: #1c1610; }
.ap .tvhall { flex: none; height: min(26vw, 14dvh); display: flex; align-items: flex-end; padding: 8px 12px; background: linear-gradient(0deg, #1c1610cc, transparent 60%), url(__ART__town/palace-hall.jpg) center/cover, #2a1f14; color: #f3d48a; font-size: 20px; text-shadow: 0 2px 6px #000; }
.ap .tvpbody { flex: 1; min-height: 0; overflow-y: auto; padding: 4px 12px 8px; }
.ap .tvpbody h3 { margin: 4px 0; font-size: 15px; display: flex; align-items: center; gap: 6px; }
.ap .tvpbody .wgrid { gap: 6px; margin: 2px 0 6px; }
.ap .tvpbody .wcard { padding: 5px 4px; gap: 2px; }
.ap .tvpbody .wcard .wpic, .ap .tvpbody .wcard .wimg { width: 44px; height: 44px; }
.ap .tvpbody .wcard .wname { font-size: 13px; }
.ap .tvpbody .wcard .wgfx { font-size: 11.5px; }
.ap .tvpbody .wcard .btn { min-height: 36px; }
.ap .tvpbody .wfeast { margin: 2px 0 4px; padding: 6px 8px; gap: 6px; }
.ap .tvpbody .wfeast .btn { min-height: 44px; }
/* 낮은 폰(640 높이)에서도 큰 공사 넷이 한 화면에 — 머리 그림·그림·설명 줄을 줄인다 (슬라이드 금지) */
@media (max-height: 720px) {
  .ap .tvhall { height: min(18vw, 9dvh); font-size: 16px; padding: 4px 10px; }
  .ap .tvpbody { padding: 2px 8px 4px; } .ap .tvpbody h3 { margin: 2px 0; font-size: 13px; }
  .ap .tvpbody .wgrid { gap: 4px; } .ap .tvpbody .wcard { padding: 3px 3px; }
  .ap .tvpbody .wcard .wpic, .ap .tvpbody .wcard .wimg { width: 30px; height: 30px; }
  .ap .tvpbody .wcard .wgfx { display: none; } .ap .tvpbody .wcard .wname { font-size: 12px; }
  .ap .tvpbody .wcard .btn { min-height: 30px; font-size: 12px; padding: 2px 4px; }
  .ap .tvpbody .wfeast { padding: 4px 6px; } .ap .tvpbody .wfeast .btn { min-height: 36px; }
}
/* ② 판 — 바탕 그림 한 장(1376×768)을 폭에 꽉 차게 · 양옆 풀밭(터는 가로 14~86%)을 잘라 크게 · 세로가 모자라면 위아래를 24% 까지 잘라 맞추고, 세로가 남으면(가로 화면 기둥) 위아래에 띠를 둔다 */
.ap .tvstage { grid-area: stage; position: relative; overflow: hidden; background: #2c3a1e; min-height: 0; container-type: size; height: min(calc(100vw * 0.7344), 46dvh); }
.ap .tvboard { isolation: isolate; --bw: min(100cqw / 0.76, 100cqh * 1376 / 768 / 0.76); position: absolute; left: 50%; top: 50%; width: var(--bw); aspect-ratio: 1376 / 768; margin-left: calc(var(--bw) / -2); margin-top: calc(var(--bw) * 768 / 1376 / -2); }
.ap .tvbg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
/* 터 — 아랫단(돌 테두리 아래)에 맞춰 선다 · 그림은 터 폭 그대로 · 누르면 고른다 */
.ap .tvlot2 { position: absolute; z-index: 4; translate: -50% -100%; display: grid; justify-items: center; align-items: end; padding: 0; border: 0; background: none; font: inherit; color: inherit; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.ap .tvlot2 .tvlotbg { grid-area: 1 / 1; width: 100%; height: auto; display: block; align-self: end; pointer-events: none; }
.ap .tvlot2 .tvsp { grid-area: 1 / 1; width: 100%; height: auto; display: block; }
.ap .tvlot2 .tvic { grid-area: 1 / 1; width: 34%; height: auto; margin-bottom: 14%; filter: drop-shadow(0 4px 6px #000a); }
.ap .tvlot2 .tvsc2 { grid-area: 1 / 1; width: 70%; margin-bottom: 8%; opacity: .95; }
.ap .tvlot2 .tvl { position: absolute; left: 50%; bottom: 0; translate: -50% 50%; z-index: 5; background: #1c1610e8; border: 1px solid #c9a45a; border-radius: 10px; padding: 2px 8px; color: #f3e6c8; font-size: clamp(11px, 1.2cqw + 6px, 14px); white-space: nowrap; }
.ap .tvlot2 .tvl i { font-style: normal; color: #f3d48a; }
.ap .tvlot2 .tvl .tvpb { display: block; height: 4px; margin: 3px 0 1px; border-radius: 2px; background: #000a; }
.ap .tvlot2 .tvl .tvpb i { display: block; height: 100%; width: var(--p); border-radius: 2px; background: #f3d48a; }
.ap .tvlot2.going .tvsp:not([src$="build.png"]) { opacity: .55; }
.ap .tvlot2 .ghost { opacity: .55; animation: tvplan 1.4s ease-in-out infinite alternate; }
@keyframes tvplan { from { opacity: .4; } to { opacity: .8; } }

.ap .tvlot2.empty .tvl { background: #1c1610b0; color: #e8dcc0; }
.ap .tvlot2.locked { opacity: .9; } .ap .tvlot2.canclear { opacity: 1; } .ap .tvlot2.canclear:not(.sel) .tvart { opacity: .5; } .ap .tvlot2.canclear .tvl { border-color: #e0bd78; color: #ffe2a0; } .ap .tvclr img { opacity: .85; } .ap .tvlot2.locked .tvl { background: #0b0906c0; border-color: #6a5a3a; }
/* 고른 터 — 메가히트 게임처럼 (형 11-08: "css 동그라미 성의없다 · 제대로 선택된 느낌")
   ① 건물이 톡 튀며 떠오른 채로 남는다 ② 그림 테두리를 따라 금빛 윤곽 (drop-shadow 는 폰에서도 그려진다 · 움직이지 않는 거르개)
   ③ 바닥엔 터 모양 마름모 — 테두리가 흐르고 네 모서리 꺾쇠가 숨 쉰다 (움직임은 transform·opacity·stroke 만) */
.ap .tvlot2 .tvart { grid-area: 1 / 1; position: relative; z-index: 1; display: grid; justify-items: center; align-items: end; width: 100%; }
.ap .tvlot2 .tvart > * { grid-area: 1 / 1; }
.ap .tvlot2.sel .tvart { transform: translateY(-5%); animation: tvpop .46s cubic-bezier(.2, 1.7, .45, 1) both;
  filter: drop-shadow(2px 0 0 #ffe08a) drop-shadow(-2px 0 0 #ffe08a) drop-shadow(0 2px 0 #ffe08a) drop-shadow(0 -2px 0 #ffe08a) drop-shadow(0 0 7px #ffc84acc); }
@keyframes tvpop { 0% { transform: translateY(0) scale(1); } 45% { transform: translateY(-10%) scale(1.08); } 100% { transform: translateY(-5%) scale(1); } }
.ap .tvmark { position: absolute; left: 50%; bottom: -4%; width: 114%; aspect-ratio: 2; translate: -50% 0; z-index: 0; pointer-events: none; animation: tvmarkin .32s ease-out both; }
@keyframes tvmarkin { from { opacity: 0; transform: scale(.7); } to { opacity: 1; transform: none; } }
.ap .tvmark svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.ap .tvmark polygon { fill: #ffd76a2e; stroke: #ffe08a; stroke-width: 3.5; stroke-dasharray: 16 9; vector-effect: non-scaling-stroke; animation: tvdash 1.1s linear infinite; }
@keyframes tvdash { to { stroke-dashoffset: -25; } }
.ap .tvlot2:active .tvart { translate: 0 2px; }
/* 마을 사람 — 유민 걷기 8컷 띠 · 크기는 판 폭에 따라(폰에선 집보다 작게) · 오가는 이는 가로로 오가며 돌아선다 · 일하는 이는 제자리에서 까딱 */
.ap .tvf { --ph: calc(clamp(14px, 5cqw, 30px) / 0.6375); --ar: ${VILLAGER_ANIM[0].ar.toFixed(4)}; position: absolute; width: calc(var(--ph) * var(--ar)); height: var(--ph); margin: calc(var(--ph) * -1) 0 0 calc(var(--ph) * var(--ar) / -2); z-index: 3; pointer-events: none; }
.ap .tvf u { position: absolute; inset: 0; background: url('__ART__${VILLAGER_ANIM[0].file}') 0 0 / 800% 100% no-repeat; }
${VILLAGER_ANIM.map((v, k) => `.ap .tvf.v${k} { --ar: ${v.ar.toFixed(4)}; } .ap .tvf.v${k} u { background-image: url('__ART__${v.file}'); }`).join('\n')}
.ap .tvf.walk { scale: var(--sc, 1); animation: tvwalk var(--dur, 9s) linear var(--d, 0s) infinite; }
.ap .tvf.walk u { animation: tvstep .8s steps(7) infinite; }
@keyframes tvstep { to { background-position-x: 100%; } }
@keyframes tvwalk { 0% { translate: 0 0; transform: scaleX(1); } 49.9% { translate: var(--dx) 0; transform: scaleX(1); } 50% { translate: var(--dx) 0; transform: scaleX(-1); } 100% { translate: 0 0; transform: scaleX(-1); } }
.ap .tvf.walkv { scale: var(--sc, 1); animation: tvwalkv var(--dur, 9s) linear var(--d, 0s) infinite; }
.ap .tvf.walkv u { animation: tvstep .8s steps(7) infinite; }
@keyframes tvwalkv { 0% { translate: 0 0; transform: scaleX(1); } 49.9% { translate: 0 var(--dy); transform: scaleX(1); } 50% { translate: 0 var(--dy); transform: scaleX(-1); } 100% { translate: 0 0; transform: scaleX(-1); } }
/* 짓는 터 앞 일꾼 — 나무 메로 말뚝을 박는 8컷 (11-09 · 전엔 걷는 사람이 위아래로 흔들렸다) */
.ap .tvf.work { --ar: ${BUILDER_ANIM.ar.toFixed(4)}; z-index: 5; transform: scaleX(var(--fl, 1)); }
.ap .tvf.work u { background-image: url('__ART__${BUILDER_ANIM.file}'); animation: tvstep var(--hm, .9s) steps(${BUILDER_ANIM.nf}, jump-none) var(--d, 0s) infinite; }
/* 일하는 곳의 흙먼지 — 메가 말뚝을 치는 컷에 맞춰 말뚝 밑에서 작은 점 하나가 피었다 사라진다 */
.ap .tvf.work s { position: absolute; left: 78%; bottom: -2px; width: 10px; height: 10px; border-radius: 50%; background: #d8c09088; opacity: 0; animation: tvdust var(--hm, .9s) ease-out var(--d, 0s) infinite; }
@keyframes tvdust { 0%, ${(BUILDER_ANIM.hitAt * 100 - 0.1).toFixed(1)}% { transform: scale(.3); opacity: 0; } ${(BUILDER_ANIM.hitAt * 100).toFixed(1)}% { transform: scale(.3); opacity: .9; } 100% { transform: scale(1.8) translateY(-6px); opacity: 0; } }
/* 톡톡 — 일꾼이 잠깐 더 빨리 · 비계가 들썩 · 흙먼지 낱낱이 */
.ap .tvboard.cheer .tvf.work { --hm: .45s; }
.ap .tvboard.cheer .tvlot2.going .tvsc2, .ap .tvboard.cheer .tvlot2.going .tvsp[src$="build.png"] { animation: tvknock .16s ease-in-out 0s 4 alternate; }
@keyframes tvknock { to { translate: 0 -3px; } }
.ap .tvpuff { position: absolute; z-index: 6; width: 14px; height: 14px; border-radius: 50%; background: #d8c090aa; translate: -50% -50%; pointer-events: none; animation: tvpuff .6s ease-out forwards; }
@keyframes tvpuff { from { transform: scale(.4); opacity: .95; } to { transform: translate(var(--px), var(--py)) scale(1.8); opacity: 0; } }
/* 완공! — 흰 번쩍 뒤 도장이 비스듬히 쾅 · 누르면 걷힌다 */
.ap .tvdone { position: absolute; inset: 0; z-index: 8; display: grid; place-items: center; cursor: pointer; }
.ap .tvdone .tvflash { position: absolute; inset: 0; background: #fff; animation: tvflash .7s ease-out both; }
@keyframes tvflash { from { opacity: .92; } to { opacity: 0; } }
.ap .tvstamp { position: relative; display: grid; justify-items: center; gap: 4px; padding: 10px 26px 8px; border: 4px solid #f3d48a; border-radius: 16px; background: #1a120cd8; box-shadow: 0 0 30px #f3d48a66, inset 0 0 14px #000a; animation: tvstamp .62s cubic-bezier(.2, 1.5, .4, 1) .08s both; }
.ap .tvstamp b { font-family: var(--display); font-weight: 400; font-size: clamp(34px, 11vw, 56px); letter-spacing: 4px; color: #fff4d8; text-shadow: 0 0 18px #f3d48a, 0 3px 6px #000; white-space: nowrap; }
.ap .tvstamp span { display: flex; align-items: center; gap: 6px; color: #ffe2a0; font-size: 15px; font-weight: 700; }
.ap .tvstamp span img { width: 26px; height: 26px; }
@keyframes tvstamp { 0% { opacity: 0; transform: scale(3) rotate(-14deg); } 70% { opacity: 1; transform: scale(.94) rotate(-4deg); } 100% { opacity: 1; transform: scale(1) rotate(-5deg); } }
.ap .tvdone.out { animation: tvout .3s ease-in forwards; }
/* ③ 아래 칸 — 고른 터 하나 · 구르지 않는다 (넘치면 그림이 줄어든다) */
.ap .tvdock { grid-area: dock; min-height: 0; overflow: hidden; display: flex; flex-direction: column; gap: 8px; padding: 8px 12px; background: #1c1610; border-top: 2px solid #c9a45a; }
.ap .tvi { width: 28px; height: 28px; object-fit: contain; flex: none; }
.ap .tvfh { display: flex; align-items: center; gap: 8px; min-height: 30px; }
.ap .tvfh > b { font-size: 18px; color: #f3d48a; white-space: nowrap; }
.ap .tvfh > i { font-style: normal; color: #f3d48a; letter-spacing: 1px; white-space: nowrap; }
.ap .tvfh > span { font-size: 13px; color: #d9ccb0; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ap .tvup { flex: 1; min-height: 0; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; justify-items: center; gap: 6px; }
.ap .tvup.one { grid-template-columns: 1fr; }
.ap .tvup img { max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain; display: block; }
.ap .tvup .tvbig { width: 40%; }
.ap .tvcur, .ap .tvnxt { display: grid; justify-items: center; gap: 4px; min-height: 0; width: 100%; }
.ap .tvcur b, .ap .tvnxt b { font-size: 14px; color: #d9ccb0; } .ap .tvnxt b { color: #ffe2a0; }
.ap .tvcur img { opacity: .75; }
.ap .tvarrow { font-style: normal; font-size: 30px; color: #f3d48a; text-shadow: 0 0 10px #f3d48a88; animation: tvarrow .9s ease-in-out infinite alternate; }
@keyframes tvarrow { from { translate: -3px 0; } to { translate: 3px 0; } }
.ap .tvchips { display: flex; justify-content: center; align-items: center; flex-wrap: wrap; gap: 8px; }
.ap .tvchips .cost, .ap .tvgo .cost { font-size: 15px; }
.ap .tvgain b { color: #9fd38a; font-size: 14px; }
.ap .tvgoing { flex: 1; min-height: 0; display: grid; grid-template-rows: 1fr auto auto; justify-items: center; gap: 6px; }
.ap .tvgoing img { max-width: 100%; max-height: 100%; width: auto; height: auto; min-height: 0; object-fit: contain; }
.ap .tvgoing b { color: #ffe2a0; font-size: 15px; }
.ap .tvprog { width: min(100%, 320px); height: 12px; border-radius: 7px; background: #000a; border: 1px solid #6a5236; overflow: hidden; }
.ap .tvprog i { display: block; height: 100%; width: var(--p); background: #f3d48a; border-radius: 7px; }
.ap .tvtiles { display: grid; grid-template-columns: repeat(4, 1fr); grid-auto-rows: minmax(96px, 150px); align-content: start; gap: 8px; flex: 1; min-height: 0; }
.ap .tvtile { position: relative; display: grid; justify-items: center; align-content: center; gap: 4px; padding: 8px 4px 6px; border-radius: 12px; border: 1px solid #6a5236; background: #2a2016; color: #f3e6c8; font: inherit; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.ap .tvtile .tvti { width: clamp(40px, 13vw, 60px); height: clamp(40px, 13vw, 60px); object-fit: contain; }
.ap .tvtile b { font-size: 13px; white-space: nowrap; }
.ap .tvtile small { font-size: 11px; color: #d9ccb0; display: flex; gap: 2px; }
.ap .tvtile small .cost { font-size: 11px; } .ap .tvtile small .cgi { width: 14px; height: 14px; }
.ap .tveff { font-style: normal; font-weight: 700; color: #9be37a; text-shadow: 0 1px 0 #000a; white-space: nowrap; }
.ap .tvfh .tveff { margin-left: 4px; padding: 2px 8px; border-radius: 999px; background: #1f3a18cc; border: 1px solid #6fbf55; font-size: 14px; }
.ap .tvtile .tveff { font-size: 11px; line-height: 1.15; white-space: normal; text-align: center; }
.ap .tvdoes .tveff { font-size: 15px; }
.ap .tvtile.on { border-color: #e0bd78; background: #4a3718; box-shadow: 0 0 0 2px #e0bd78 inset, 0 0 12px #e0bd7866; color: #ffe2a0; }
.ap .tvtile.on::after { content: '✓'; position: absolute; top: 3px; right: 7px; color: #ffe2a0; font-weight: 700; }
.ap .tvtile.lk { opacity: .55; } .ap .tvtile.lk .tvti { filter: grayscale(1); }
.ap .tvtile:active { translate: 0 1px; }
.ap .tvdoes { margin: 0; font-size: 13px; color: #d9ccb0; text-align: center; min-height: 1.4em; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.ap .tvlock { flex: 1; display: grid; place-content: center; text-align: center; gap: 6px; } .ap .tvlock p { margin: 0; font-size: 14px; }
/* ④ 맨 아래 큰 단추 하나 — 고르면 금빛 눌린 채 ✓ (메모리 confirm-bar-bottom · wwe-overreaction-ux) */
.ap .tvhave { display: flex; justify-content: center; gap: 12px; margin-bottom: 6px; font-size: 14px; font-weight: 700; color: #f3e6c8; }
.ap .tvhave span { display: inline-flex; align-items: center; gap: 3px; white-space: nowrap; }
.ap .tvhave span.no { color: #8f8470; }
.ap .tvhave img { width: 22px; height: 22px; object-fit: contain; }
.ap .tvbar { grid-area: bar; padding: 8px 12px calc(8px + env(safe-area-inset-bottom, 0px)); background: #1c1610; border-top: 1px solid #3a2c1e; }
.ap .tvgo { width: 100%; min-height: 58px; box-sizing: border-box; display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 6px 8px; padding: 8px 12px; border-radius: 14px; border: 2px solid #e0bd78; background: #8d6626; color: #fff4dc; font: inherit; font-size: 17px; font-weight: 700; cursor: pointer; box-shadow: 0 3px 0 #4a3718, 0 6px 14px #000a; -webkit-tap-highlight-color: transparent; }
.ap .tvgo:active { translate: 0 2px; box-shadow: 0 1px 0 #4a3718; }
.ap .tvgo .tvi { width: 26px; height: 26px; }
.ap .tvgo small { flex-basis: 100%; font-size: 12px; font-weight: 400; color: #e8dcc0; }
.ap .tvgo.on { background: #4a3718; color: #ffe2a0; border-color: #ffe2a0; box-shadow: 0 0 0 2px #e0bd78, inset 0 3px 8px #000a; translate: 0 2px; }
.ap .tvgo[aria-disabled="true"] { background: #2a2016; border-color: #6a5236; color: #a3957a; box-shadow: none; }
/* 넓은 가로 화면 — 아래 칸과 단추가 오른쪽 기둥으로 · 판이 세로를 다 쓴다 */
@media (min-width: 760px) and (orientation: landscape) {
  .ap .townv { grid-template-areas: "top dock" "stage dock" "stage bar"; grid-template-columns: 1fr minmax(300px, 36%); grid-template-rows: auto 1fr auto; }
  .ap .tvstage { height: auto; }
  .ap .tvdock { border-top: 0; border-left: 2px solid #c9a45a; }
  .ap .tvtop { border-right: 1px solid #3a2c1e; }
  .ap .tvx { position: fixed; top: 12px; right: 14px; z-index: 70; width: auto; height: 44px; padding: 0 18px 0 14px; border-radius: 22px; border-width: 2px; font-size: 16px; font-weight: 700; box-shadow: 0 4px 14px #000c; }
  .ap .tvx::after { content: ' 나가기'; }
  .ap .tvdock { padding-top: 64px; }
}
@media (prefers-reduced-motion: reduce) { .ap .tvf, .ap .tvf u, .ap .tvf s, .ap .tvveil, .ap .map.tvdive, .ap .map.tvrise, .ap .townv.fresh, .ap .townv.fresh .tvboard, .ap .townov.out .tvboard, .ap .tvarrow, .ap .tvlot2.sel .tvart, .ap .tvmark, .ap .tvmark polygon, .ap .tvmark u, .ap .tvstamp, .ap .tvpuff { animation: none !important; } }
.ap.q-low .tvf u, .ap.q-low .tvf s, .ap.q-low .tvf.walk, .ap.q-low .tvf.walkv { animation-play-state: paused; }
`
