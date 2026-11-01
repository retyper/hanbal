/**
 * 장수 기술 장면 (컷인) — 비기·겨루기·사로잡기·물러나기를 고른 합이 풀릴 때 (형 11-01: "명궁의 한발 이런기술 쓰는데 화면이 어두워지면서 장수만 강조되고
 * 활을 강하게 당겼다 쏘는 그런 모습이 있어야 와 내가 기술을 썼다 하고 느껴질거임 · 기술마다 새롭게 고민 · 싸구려 svg 로 대충 때우지 마").
 *
 * 모든 장면이 같은 뼈대: 화면이 어두워지고 → 바람 줄기와 먹 띠가 휙 → 장수 초상이 미끄러져 들고 → 기술 이름이 붓으로 → 기술마다 제 몸짓(그림 낱낱) →
 * 맞는 순간 멈칫(히트스톱: 띠가 떨고 번쩍) → 걷힌다. 1.2~1.6초 · 누르면 바로 걷힌다.
 *
 * 그림은 모두 구운 래스터(public/realm/fx/skill/… · 설계와 굽는 말은 docs/realm/SKILL-FX.md). SVG·CSS 로 그린 효과는 쓰지 않는다.
 * 아직 안 구운 그림은 건너뛴다 — preloadSkillFx 가 미리 불러 본 것 가운데 닿은 것만 얹는다 (깨진 그림 표시 없음).
 * 움직임은 작은 그림 하나하나의 transform·opacity 뿐 (폰 그래픽 한도) · 어두워지는 막은 opacity 한 번.
 */
import { P } from '../../tune/params.ts'

/** 장면이 있는 기술 — 비기 아홉 + 장수의 명령 셋 */
export type SkillId = 'snipe' | 'rite' | 'sway' | 'stand' | 'ambush' | 'vanguard' | 'feint' | 'order' | 'shout' | 'duel' | 'capture' | 'retreat'
/** 장면의 소리 — battlefield 가 제 소리로 바꾼다 */
export type SkSfx = 'whoosh' | 'draw' | 'release' | 'impact' | 'drum' | 'bell' | 'rite' | 'cry' | 'shield' | 'clatter' | 'slash' | 'charge' | 'retreat' | 'capture' | 'gong'

/** 움직임 — 아래 CSS 의 키프레임 (wsk-<이름>) */
type Mv = 'fade' | 'pop' | 'flash' | 'slideL' | 'slideR' | 'streak' | 'flyR' | 'drop' | 'rise' | 'slam' | 'drawshoot' | 'jingle' | 'wave' | 'spray' | 'puff'
  | 'deflect' | 'partL' | 'leap' | 'slash' | 'thrust' | 'trailL' | 'spring' | 'beat' | 'snap' | 'clash' | 'lasso' | 'burst' | 'flagup'

/**
 * 그림 한 장(또는 n 장) — t·d 는 장면 처음부터 ms · x·y 는 화면 가운데 자리(%) · w 는 너비(화면 너비의 %) · n 장이면 dx·dy 만큼 벌리고 dt 만큼 늦춘다.
 * rot — 그 장이 놓이는 기울기(도) · n 장이면 ±rot 사이로 고르게 (불티 흩뿌림) · flip — 좌우 뒤집음
 */
interface Spr { readonly src: string; readonly t: number; readonly d: number; readonly x: number; readonly y: number; readonly w: number; readonly mv: Mv
  readonly n?: number; readonly dx?: number; readonly dy?: number; readonly dt?: number; readonly rot?: number; readonly flip?: boolean }
interface Seq { readonly sprites: readonly Spr[]; readonly hit: number | null; readonly cues: ReadonlyArray<readonly [number, SkSfx]> }

/** 함께 쓰는 그림 — 여러 기술이 나눠 쓴다 */
const C = {
  speed: 'skill/common/speedlines.png', band: 'skill/common/ink-band.png', brush: 'skill/common/title-brush.png',
  flash: 'skill/common/flash.png', ink: 'skill/common/ink-burst.png', spark: 'skill/common/spark.png', wave: 'skill/common/shout-wave.png',
  slash: 'skill/common/slash.png',
  // 이미 있는 그림
  dust: 'dust.png', spear: 'spear.png', arrow: 'arrow.png', shield: 'shield.png', rope: 'rope.png',
} as const

const sparks = (t: number, x: number, y: number, n = 8): Spr => ({ src: C.spark, t, d: 340, x, y, w: 10, mv: 'spray', n, rot: 160 })
const hitFx = (t: number, x: number, y: number): Spr[] => [
  { src: C.flash, t, d: 320, x, y, w: 52, mv: 'flash' },
  { src: C.ink, t: t + 20, d: 360, x, y, w: 40, mv: 'burst' },
  sparks(t + 10, x, y),
]

/** 기술마다 제 몸짓 — 우리는 늘 왼쪽(x 작은 쪽), 적은 오른쪽 · 위 띠(y 20~42)는 초상과 이름 자리, 몸짓은 그 밑 전장(y 50~85) */
export const SKILL_SEQ: Readonly<Record<SkillId, Seq>> = {
  // 명궁의 한 발 — 활을 끝까지 당겨 떨다가 놓는다 · 한 줄기 빛 화살이 전장을 가로질러 적장에 꽂힌다
  snipe: {
    sprites: [
      { src: 'skill/snipe/bow-draw.png', t: 420, d: 700, x: 28, y: 62, w: 52, mv: 'drawshoot' },
      { src: 'skill/snipe/arrow-streak.png', t: 900, d: 230, x: 52, y: 61, w: 80, mv: 'flyR' },
      ...hitFx(1170, 80, 60),
    ],
    hit: 1170,
    cues: [[260, 'whoosh'], [440, 'draw'], [900, 'release'], [1170, 'impact']],
  },
  // 진중 굿 — 무당의 방울과 부채가 흔들리고, 혼불이 군사들 사이에서 피어올라 하늘로 오른다
  rite: {
    sprites: [
      { src: 'skill/rite/shaman-bells.png', t: 400, d: 900, x: 30, y: 60, w: 34, mv: 'jingle' },
      { src: 'skill/rite/spirit-flame.png', t: 480, d: 640, x: 10, y: 80, w: 10, mv: 'rise', n: 10, dx: 4.2, dy: -1.2, dt: 40 },
      { src: C.flash, t: 1010, d: 420, x: 26, y: 66, w: 60, mv: 'flash' },
    ],
    hit: 1010,
    cues: [[260, 'whoosh'], [400, 'bell'], [520, 'rite'], [1010, 'cry']],
  },
  // 항복 권유 — 외침이 물결로 건너가고, 적의 창이 하나둘 땅에 떨어지고, 흰 깃발이 오른다
  sway: {
    sprites: [
      { src: C.wave, t: 400, d: 620, x: 30, y: 60, w: 54, mv: 'wave', n: 3, dx: 12, dt: 140 },
      { src: C.spear, t: 820, d: 440, x: 62, y: 52, w: 13, mv: 'drop', n: 6, dx: 5, dy: 3, dt: 50 },
      { src: 'skill/sway/white-flag.png', t: 1000, d: 520, x: 82, y: 58, w: 22, mv: 'flagup' },
    ],
    hit: 820,
    cues: [[260, 'whoosh'], [400, 'cry'], [820, 'clatter'], [1000, 'bell']],
  },
  // 버텨라 — 둥근 방패가 쾅 내려와 벽이 되고, 날아든 화살이 튕겨 나간다
  stand: {
    sprites: [
      { src: 'skill/stand/shield-wall.png', t: 440, d: 1000, x: 28, y: 66, w: 60, mv: 'slam' },
      { src: C.dust, t: 600, d: 600, x: 8, y: 76, w: 18, mv: 'puff', n: 4, dx: 13, dt: 30 },
      { src: C.arrow, t: 700, d: 420, x: 56, y: 54, w: 12, mv: 'deflect', n: 6, dx: 1.5, dy: 4, dt: 45 },
      sparks(760, 42, 62, 6),
    ],
    hit: 600,
    cues: [[260, 'whoosh'], [600, 'shield'], [780, 'shield']],
  },
  // 샛길 기습 — 갈대가 갈라지며 자객 같은 날랜 군사(한국식 저고리·두건·짧은 창)가 뛰쳐나와 적 궁수를 벤다
  ambush: {
    sprites: [
      { src: 'skill/ambush/reeds.png', t: 360, d: 1100, x: 40, y: 76, w: 64, mv: 'partL' },
      { src: 'skill/ambush/reeds.png', t: 360, d: 1100, x: 92, y: 76, w: 64, mv: 'partL', flip: true },
      { src: 'skill/ambush/raider.png', t: 640, d: 520, x: 70, y: 64, w: 24, mv: 'leap', n: 3, dx: 7, dy: 3, dt: 90 },
      { src: C.slash, t: 900, d: 300, x: 78, y: 58, w: 40, mv: 'slash', n: 2, dx: 4, dt: 110, rot: 30 },
      ...hitFx(980, 80, 58),
    ],
    hit: 980,
    cues: [[260, 'whoosh'], [640, 'charge'], [900, 'slash'], [980, 'impact']],
  },
  // 선봉에 선다 — 장수의 창끝이 바람을 가르며 앞으로 내질러지고, 맞부딪는 자리가 터진다
  vanguard: {
    sprites: [
      { src: C.speed, t: 480, d: 520, x: 50, y: 62, w: 140, mv: 'streak' },
      { src: 'skill/vanguard/spear-thrust.png', t: 560, d: 640, x: 50, y: 62, w: 92, mv: 'thrust' },
      ...hitFx(900, 66, 62),
      { src: C.dust, t: 920, d: 520, x: 56, y: 72, w: 22, mv: 'puff', n: 3, dx: 9, dt: 40 },
    ],
    hit: 900,
    cues: [[260, 'whoosh'], [560, 'cry'], [900, 'impact']],
  },
  // 거짓 퇴각 — 흙먼지를 일으키며 물러나다가, 쫓아온 자리에서 깎은 말뚝이 솟고 칼날이 엇갈린다
  feint: {
    sprites: [
      { src: C.dust, t: 400, d: 640, x: 44, y: 74, w: 20, mv: 'trailL', n: 4, dx: -7, dt: 70 },
      { src: 'skill/feint/trap-stakes.png', t: 860, d: 620, x: 50, y: 74, w: 46, mv: 'spring' },
      { src: C.slash, t: 960, d: 300, x: 56, y: 62, w: 42, mv: 'slash', n: 2, dt: 90, rot: 50 },
      ...hitFx(1000, 58, 62),
    ],
    hit: 1000,
    cues: [[260, 'whoosh'], [400, 'retreat'], [860, 'clatter'], [1000, 'impact']],
  },
  // 진을 다잡는다 — 큰 북이 세 번 울리고, 울림마다 방패가 한 줄로 착착 선다
  order: {
    sprites: [
      { src: 'skill/order/war-drum.png', t: 380, d: 1000, x: 28, y: 62, w: 36, mv: 'beat' },
      { src: C.wave, t: 500, d: 520, x: 28, y: 62, w: 46, mv: 'wave', n: 3, dt: 200 },
      { src: C.shield, t: 720, d: 600, x: 14, y: 78, w: 10, mv: 'snap', n: 5, dx: 7.5, dt: 50 },
    ],
    hit: 900,
    cues: [[260, 'whoosh'], [500, 'drum'], [700, 'drum'], [900, 'drum'], [960, 'shield']],
  },
  // 큰 외침 — 초상에서 큰 울림이 거듭 퍼지고 불티가 튀며, 앞의 흙먼지가 적 쪽으로 밀려난다
  shout: {
    sprites: [
      { src: C.wave, t: 380, d: 640, x: 26, y: 40, w: 72, mv: 'wave', n: 4, dt: 110 },
      sparks(420, 26, 40, 10),
      { src: C.dust, t: 600, d: 700, x: 46, y: 74, w: 22, mv: 'puff', n: 4, dx: 10, dt: 50 },
    ],
    hit: 420,
    cues: [[260, 'whoosh'], [380, 'cry'], [600, 'drum']],
  },
  // 장수 겨루기 — 두 칼날이 엇갈려 불꽃이 튄다
  duel: {
    sprites: [
      { src: 'skill/duel/crossed-blades.png', t: 500, d: 760, x: 50, y: 62, w: 66, mv: 'clash' },
      ...hitFx(720, 50, 60),
    ],
    hit: 720,
    cues: [[260, 'whoosh'], [500, 'slash'], [720, 'impact']],
  },
  // 적장 사로잡기 — 올가미가 날아가 적장을 감는다
  capture: {
    sprites: [
      { src: 'skill/capture/lasso.png', t: 480, d: 760, x: 70, y: 60, w: 36, mv: 'lasso' },
      { src: C.rope, t: 820, d: 520, x: 76, y: 64, w: 26, mv: 'pop' },
      { src: C.dust, t: 900, d: 520, x: 76, y: 72, w: 20, mv: 'puff', n: 2, dx: 8, dt: 40 },
    ],
    hit: 900,
    cues: [[260, 'whoosh'], [480, 'whoosh'], [900, 'capture']],
  },
  // 물러나기 — 징이 울리고 군사가 흙먼지를 끌며 물러난다
  retreat: {
    sprites: [
      { src: 'skill/retreat/jing-gong.png', t: 380, d: 900, x: 28, y: 60, w: 30, mv: 'beat' },
      { src: C.dust, t: 520, d: 700, x: 40, y: 76, w: 20, mv: 'trailL', n: 5, dx: -6, dt: 60 },
    ],
    hit: null,
    cues: [[260, 'whoosh'], [380, 'gong'], [560, 'retreat']],
  },
}

/** 뼈대 그림 — 모든 장면에 */
const FRAME = [C.speed, C.band, C.brush] as const

/** 장면에 쓰는 모든 그림 (중복 없이) — 문서(SKILL-FX.md)·미리 불러오기 */
export function skillAssets(): string[] {
  const s = new Set<string>(FRAME)
  for (const q of Object.values(SKILL_SEQ)) for (const x of q.sprites) s.add(x.src)
  for (const x of [C.flash, C.ink, C.spark]) s.add(x)
  return [...s]
}

/** 닿은 그림 — 미리 불러 본 결과 (안 구운 그림은 여기 없다) */
const READY = new Set<string>()
let asked = false
/** 싸움이 열릴 때 한 번 — 장면 그림을 미리 불러 둔다. 못 불러온 것은 장면에서 빠진다 */
export function preloadSkillFx(art: string): void {
  if (asked || typeof Image === 'undefined') return
  asked = true
  for (const src of skillAssets()) {
    const im = new Image()
    im.onload = (): void => { READY.add(src) }
    im.decoding = 'async'
    im.src = `${art}fx/${src}`
  }
}
/** 시험용 — 닿았다고 치는 그림 (tests) */
export function markSkillReady(srcs: readonly string[]): void { for (const s of srcs) READY.add(s) }

const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/** 장면의 소리 — 시각(초)과 소리. 부르는 쪽이 제 소리 시계에 건다 */
export function skillCues(id: SkillId): Array<readonly [number, SkSfx]> {
  const sp = P.realm.warSkSpeed
  return SKILL_SEQ[id].cues.map(([t, s]) => [(t * sp) / 1000, s] as const)
}

/**
 * 장면 한 판의 HTML — 초상(bust · 없으면 장수 그림) · 기술 이름 · 장수 이름 · 기술의 몸짓.
 * 바깥 상자가 끝까지 도는 애니메이션(wsk-end)이 끝나면 부르는 쪽이 걷는다 · 누르면 바로 걷는다.
 */
export function skillCutHtml(art: string, id: SkillId, bust: string | null, heroName: string, skillName: string): string {
  const R = P.realm
  const sp = R.warSkSpeed
  const end = Math.round(R.warSkEndMs * sp)
  const ms = (x: number): string => `${Math.round(x * sp)}ms`
  const seq = SKILL_SEQ[id]
  const img = (src: string): string => `${art}fx/${src}`
  let h = `<div class="wsk k-${id}" style="--end:${end}ms;--dim:${R.warSkDim}">`
  h += `<i class="wsk-dim"></i>`
  // 바람 줄기 · 먹 띠 — 위 띠 자리를 가로지른다
  if (READY.has(C.speed)) h += `<i class="wsk-sp" style="left:50%;top:31%;width:150cqw;z-index:2"><img class="wsk-m mv-streak" src="${img(C.speed)}" alt="" style="animation-duration:${ms(640)};animation-delay:0ms"></i>`
  if (READY.has(C.band)) h += `<i class="wsk-sp" style="left:50%;top:31%;width:120cqw;z-index:3"><img class="wsk-b mv-slideR" src="${img(C.band)}" alt="" style="animation-duration:${end}ms;animation-delay:0ms"></i>`
  // 초상 — 왼쪽에서 미끄러져 든다 · 맞는 순간 떤다
  const shake = seq.hit !== null ? `,wsk-hs ${R.warSkHitMs}ms steps(2) ${ms(seq.hit)} 2` : ''
  const face = bust !== null ? `<img class="wsk-face" src="${art}bust/${bust}.jpg" alt="">` : `<img class="wsk-face unit" src="${art}icon/unit-general.png" alt="">`
  h += `<div class="wsk-bust" style="animation:wsk-slideL ${end}ms cubic-bezier(.2,1.2,.4,1) 60ms both${shake}">${face}</div>`
  // 기술 이름 — 붓 자국 위에 큰 글씨 · 그 밑에 장수 이름
  const brush = READY.has(C.brush) ? `<img class="wsk-brush" src="${img(C.brush)}" alt="">` : ''
  h += `<div class="wsk-ttl" style="animation:wsk-slideR ${end}ms cubic-bezier(.2,1.2,.4,1) ${ms(140)} both${shake}">${brush}<b class="${[...skillName].length > 5 ? 'long' : ''}">${esc(skillName)}</b><span>${esc(heroName)}</span></div>`
  // 기술의 몸짓 — 그림 낱낱
  let z = 10
  for (const s of seq.sprites) {
    if (!READY.has(s.src)) continue
    const n = s.n ?? 1
    for (let i = 0; i < n; i++) {
      const rot = s.rot !== undefined ? (n > 1 ? -s.rot + (2 * s.rot * i) / (n - 1) : s.rot) : 0
      const wrap = `left:${(s.x + (s.dx ?? 0) * i).toFixed(1)}%;top:${(s.y + (s.dy ?? 0) * (i % 2 === 0 ? i / 2 : -(i + 1) / 2)).toFixed(1)}%;width:${s.w}cqw;z-index:${z++}${rot !== 0 ? `;rotate:${rot.toFixed(0)}deg` : ''}${s.flip === true ? ';scale:-1 1' : ''}`
      h += `<i class="wsk-sp${n > 1 ? ' wsk-n' : ''}" style="${wrap}"><img class="wsk-m mv-${s.mv}" src="${img(s.src)}" alt="" style="animation-duration:${ms(s.d)};animation-delay:${ms(s.t + (s.dt ?? 0) * i)}"></i>`
    }
  }
  return h + '</div>'
}

/** 장면의 모양 — 키프레임마다 transform·opacity 만 (폰 그래픽 한도) · 크기 단위 cqw·cqh 는 장면 상자(.wsk) 기준 */
export const SKFX_CSS = `
.ap .wsk { position: absolute; inset: 0; z-index: 7; container-type: size; overflow: hidden; pointer-events: auto; cursor: pointer; animation: wsk-end var(--end) steps(1) forwards; }
@keyframes wsk-end { to { visibility: hidden; } }
.ap .wsk-dim { position: absolute; inset: 0; background: #05040a; opacity: 0; animation: wsk-dim var(--end) linear both; }
@keyframes wsk-dim { 0% { opacity: 0; } 8% { opacity: var(--dim); } 86% { opacity: var(--dim); } 100% { opacity: 0; } }
.ap .wsk-sp { position: absolute; display: block; translate: -50% -50%; pointer-events: none; }
.ap .wsk-sp > img { display: block; width: 100%; height: auto; opacity: 0; animation-timing-function: cubic-bezier(.2, .9, .3, 1); animation-fill-mode: both; }
.ap .wsk-sp > .wsk-b { animation-name: wsk-slideR; }
.ap .wsk-bust { position: absolute; left: 3%; top: 31%; translate: 0 -50%; width: min(44cqw, 300px); aspect-ratio: 1; z-index: 4; pointer-events: none; }
.ap .wsk-face { width: 100%; height: 100%; object-fit: cover; object-position: top; -webkit-mask: url(__ART__fx/mask-bust.png) center / 100% 100% no-repeat; mask: url(__ART__fx/mask-bust.png) center / 100% 100% no-repeat; }
.ap .wsk-face.unit { object-fit: contain; -webkit-mask: none; mask: none; }
.ap .wsk-ttl { position: absolute; left: 46%; right: 3%; top: 31%; translate: 0 -50%; z-index: 5; display: flex; flex-direction: column; align-items: center; gap: 4px; pointer-events: none; }
.ap .wsk-brush { position: absolute; left: -8%; top: 50%; width: 116%; height: auto; translate: 0 -62%; z-index: -1; }
.ap .wsk-ttl b { font-family: var(--display); font-weight: 400; font-size: clamp(30px, 10cqw, 64px); line-height: 1.05; color: #fff4d6; text-align: center; letter-spacing: .03em; -webkit-text-stroke: 1px #2a1400; paint-order: stroke fill; text-shadow: 0 3px 0 #2a1400, 0 0 16px #000; white-space: nowrap; }
.ap .wsk-ttl b.long { font-size: clamp(22px, 7.4cqw, 52px); }
.ap .wsk-ttl span { font-size: clamp(13px, 3.6cqw, 18px); font-weight: 800; color: #ffe6b0; background: #000c; padding: 2px 12px; border-radius: 9px; }
@keyframes wsk-slideL { 0% { transform: translateX(-70cqw); opacity: 0; } 22% { transform: translateX(0); opacity: 1; } 84% { transform: translateX(0); opacity: 1; } 100% { transform: translateX(-12cqw); opacity: 0; } }
@keyframes wsk-slideR { 0% { transform: translateX(70cqw); opacity: 0; } 22% { transform: translateX(0); opacity: 1; } 84% { transform: translateX(0); opacity: 1; } 100% { transform: translateX(12cqw); opacity: 0; } }
@keyframes wsk-hs { 0% { translate: -6px calc(-50% + 3px); } 50% { translate: 6px calc(-50% - 3px); } 100% { translate: 0 -50%; } }
.ap .wsk-m.mv-fade { animation-name: wsk-fade; } @keyframes wsk-fade { 0% { opacity: 0; } 15% { opacity: 1; } 80% { opacity: 1; } 100% { opacity: 0; } }
.ap .wsk-m.mv-pop { animation-name: wsk-pop; } @keyframes wsk-pop { 0% { opacity: 0; transform: scale(.3); } 30% { opacity: 1; transform: scale(1.25); } 45% { transform: scale(1); } 80% { opacity: 1; } 100% { opacity: 0; transform: scale(1); } }
.ap .wsk-m.mv-flash { animation-name: wsk-flash; animation-timing-function: ease-out; } @keyframes wsk-flash { 0% { opacity: 0; transform: scale(.5); } 18% { opacity: 1; transform: scale(1.1); } 100% { opacity: 0; transform: scale(1.5); } }
.ap .wsk-m.mv-burst { animation-name: wsk-burst; animation-timing-function: ease-out; } @keyframes wsk-burst { 0% { opacity: 1; transform: scale(.2); } 40% { opacity: 1; transform: scale(1.1); } 100% { opacity: 0; transform: scale(1.4); } }
.ap .wsk-m.mv-streak { animation-name: wsk-streak; animation-timing-function: linear; } @keyframes wsk-streak { 0% { opacity: 0; transform: translateX(30cqw); } 20% { opacity: 1; } 75% { opacity: 1; } 100% { opacity: 0; transform: translateX(-30cqw); } }
.ap .wsk-m.mv-flyR { animation-name: wsk-flyR; animation-timing-function: cubic-bezier(.5, 0, 1, 1); } @keyframes wsk-flyR { 0% { opacity: 0; transform: translateX(-40cqw) scaleX(.6); } 12% { opacity: 1; } 92% { opacity: 1; transform: translateX(22cqw) scaleX(1.1); } 100% { opacity: 0; transform: translateX(24cqw) scaleX(1.1); } }
.ap .wsk-m.mv-drawshoot { animation-name: wsk-drawshoot; animation-timing-function: linear; }
@keyframes wsk-drawshoot { 0% { opacity: 0; transform: translateX(-20cqw) scale(.9); } 14% { opacity: 1; transform: translateX(0) scale(1); } 30% { transform: translate(1px, -1px) scale(1.02); } 36% { transform: translate(-1px, 1px) scale(1.03); } 42% { transform: translate(2px, 0) scale(1.04); } 48% { transform: translate(-2px, -1px) scale(1.05); } 54% { transform: translate(2px, 1px) scale(1.06); } 60% { transform: translate(-2px, 0) scale(1.07); } 66% { transform: translateX(-4cqw) scale(.98); } 78% { opacity: 1; transform: translateX(-1cqw) scale(1); } 100% { opacity: 0; transform: translateX(-3cqw) scale(1); } }
.ap .wsk-m.mv-slideL { animation-name: wsk-slideL; } .ap .wsk-m.mv-slideR { animation-name: wsk-slideR; }
.ap .wsk-m.mv-drop { animation-name: wsk-drop; animation-timing-function: cubic-bezier(.5, 0, .9, .6); } @keyframes wsk-drop { 0% { opacity: 0; transform: translateY(-10cqh) rotate(-35deg); } 15% { opacity: 1; } 60% { transform: translateY(4cqh) rotate(70deg); } 70% { transform: translateY(3cqh) rotate(80deg); } 85% { opacity: 1; transform: translateY(4cqh) rotate(85deg); } 100% { opacity: 0; transform: translateY(4cqh) rotate(85deg); } }
.ap .wsk-m.mv-rise { animation-name: wsk-rise; animation-timing-function: ease-out; } @keyframes wsk-rise { 0% { opacity: 0; transform: translateY(4cqh) scale(.6); } 25% { opacity: 1; } 100% { opacity: 0; transform: translateY(-26cqh) scale(1.1); } }
.ap .wsk-m.mv-slam { animation-name: wsk-slam; animation-timing-function: cubic-bezier(.6, 0, .9, .5); } @keyframes wsk-slam { 0% { opacity: 0; transform: translateY(-24cqh) scale(1.15); } 16% { opacity: 1; transform: translateY(0) scale(1); } 20% { transform: translateY(-1.2cqh) scale(1.02); } 26% { transform: translateY(0) scale(1); } 82% { opacity: 1; } 100% { opacity: 0; } }
.ap .wsk-m.mv-jingle { animation-name: wsk-jingle; animation-timing-function: ease-in-out; } @keyframes wsk-jingle { 0% { opacity: 0; transform: translateY(6cqh) rotate(0); } 14% { opacity: 1; transform: translateY(0) rotate(-14deg); } 26% { transform: rotate(14deg); } 38% { transform: rotate(-12deg); } 50% { transform: rotate(12deg); } 62% { transform: rotate(-8deg); } 74% { transform: rotate(6deg); } 86% { opacity: 1; transform: rotate(0); } 100% { opacity: 0; } }
.ap .wsk-m.mv-wave { animation-name: wsk-wave; animation-timing-function: ease-out; } @keyframes wsk-wave { 0% { opacity: 0; transform: scale(.3); } 20% { opacity: 1; } 100% { opacity: 0; transform: scale(1.7); } }
.ap .wsk-m.mv-spray { animation-name: wsk-spray; animation-timing-function: cubic-bezier(.1, .8, .3, 1); } @keyframes wsk-spray { 0% { opacity: 1; transform: translateX(0) scale(1); } 100% { opacity: 0; transform: translateX(16cqw) scale(.3); } }
.ap .wsk-m.mv-puff { animation-name: wsk-puff; animation-timing-function: ease-out; } @keyframes wsk-puff { 0% { opacity: 0; transform: scale(.4) translateY(2cqh); } 25% { opacity: .9; } 100% { opacity: 0; transform: scale(1.4) translateY(-3cqh); } }
.ap .wsk-m.mv-deflect { animation-name: wsk-deflect; animation-timing-function: linear; } @keyframes wsk-deflect { 0% { opacity: 0; transform: translateX(26cqw) rotate(180deg); } 10% { opacity: 1; } 50% { transform: translateX(-10cqw) rotate(180deg); } 100% { opacity: 0; transform: translate(-2cqw, -18cqh) rotate(260deg); } }
.ap .wsk-m.mv-partL { animation-name: wsk-partL; animation-timing-function: cubic-bezier(.3, 0, .2, 1); } @keyframes wsk-partL { 0% { opacity: 0; } 12% { opacity: 1; transform: translateX(0); } 40% { transform: translateX(-24cqw); } 85% { opacity: 1; transform: translateX(-26cqw); } 100% { opacity: 0; transform: translateX(-26cqw); } }
.ap .wsk-m.mv-leap { animation-name: wsk-leap; animation-timing-function: linear; } @keyframes wsk-leap { 0% { opacity: 0; transform: translate(-30cqw, 14cqh) scale(.8); } 15% { opacity: 1; } 50% { transform: translate(-12cqw, -6cqh) scale(1); } 80% { opacity: 1; transform: translate(0, 0) scale(1.05); } 100% { opacity: 0; transform: translate(2cqw, 1cqh) scale(1.05); } }
.ap .wsk-m.mv-slash { animation-name: wsk-slash; animation-timing-function: cubic-bezier(.2, .9, .2, 1); transform-origin: 0 50%; } @keyframes wsk-slash { 0% { opacity: 1; transform: scaleX(0); } 45% { opacity: 1; transform: scaleX(1); } 100% { opacity: 0; transform: scaleX(1.05); } }
.ap .wsk-m.mv-thrust { animation-name: wsk-thrust; animation-timing-function: cubic-bezier(.7, 0, .2, 1); } @keyframes wsk-thrust { 0% { opacity: 0; transform: translateX(-60cqw) scaleX(.7); } 52% { opacity: 1; transform: translateX(6cqw) scaleX(1.12); } 60% { transform: translateX(3cqw) scaleX(1); } 85% { opacity: 1; } 100% { opacity: 0; transform: translateX(3cqw); } }
.ap .wsk-m.mv-trailL { animation-name: wsk-trailL; animation-timing-function: ease-out; } @keyframes wsk-trailL { 0% { opacity: 0; transform: translateX(6cqw) scale(.6); } 25% { opacity: .9; } 100% { opacity: 0; transform: translateX(-12cqw) scale(1.3); } }
.ap .wsk-m.mv-spring { animation-name: wsk-spring; animation-timing-function: cubic-bezier(.2, 1.6, .4, 1); transform-origin: 50% 100%; } @keyframes wsk-spring { 0% { opacity: 0; transform: scaleY(0); } 30% { opacity: 1; transform: scaleY(1); } 85% { opacity: 1; } 100% { opacity: 0; transform: scaleY(1); } }
.ap .wsk-m.mv-beat { animation-name: wsk-beat; animation-timing-function: ease-out; } @keyframes wsk-beat { 0% { opacity: 0; transform: scale(.7); } 12% { opacity: 1; transform: scale(1); } 14% { transform: scale(1.12); } 22% { transform: scale(1); } 34% { transform: scale(1.12); } 42% { transform: scale(1); } 54% { transform: scale(1.14); } 62% { transform: scale(1); } 88% { opacity: 1; } 100% { opacity: 0; } }
.ap .wsk-m.mv-snap { animation-name: wsk-snap; animation-timing-function: cubic-bezier(.3, 1.6, .5, 1); } @keyframes wsk-snap { 0% { opacity: 0; transform: translateY(-8cqh) rotate(-20deg); } 28% { opacity: 1; transform: translateY(0) rotate(0); } 85% { opacity: 1; } 100% { opacity: 0; } }
.ap .wsk-m.mv-clash { animation-name: wsk-clash; animation-timing-function: cubic-bezier(.2, 1.4, .4, 1); } @keyframes wsk-clash { 0% { opacity: 0; transform: scale(1.6); } 28% { opacity: 1; transform: scale(1); } 32% { transform: translate(3px, -2px); } 36% { transform: translate(-3px, 2px); } 40% { transform: translate(0, 0); } 85% { opacity: 1; } 100% { opacity: 0; } }
.ap .wsk-m.mv-lasso { animation-name: wsk-lasso; animation-timing-function: cubic-bezier(.3, .2, .3, 1); } @keyframes wsk-lasso { 0% { opacity: 0; transform: translate(-46cqw, -6cqh) rotate(-200deg) scale(.6); } 20% { opacity: 1; } 55% { transform: translate(0, 0) rotate(0) scale(1); } 62% { transform: scale(.85); } 85% { opacity: 1; transform: scale(.85); } 100% { opacity: 0; transform: scale(.85); } }
.ap .wsk-m.mv-flagup { animation-name: wsk-flagup; animation-timing-function: cubic-bezier(.2, 1.3, .4, 1); transform-origin: 50% 100%; } @keyframes wsk-flagup { 0% { opacity: 0; transform: translateY(8cqh) scaleY(.4); } 35% { opacity: 1; transform: translateY(0) scaleY(1); } 85% { opacity: 1; } 100% { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .ap .wr .wsk { animation-duration: var(--end) !important; } .ap .wsk .wsk-sp { display: none; } .ap .wsk-bust, .ap .wsk-ttl { animation: none !important; } .ap .wsk-dim { animation: none; opacity: var(--dim); } }
`
