/**
 * 각성 연출의 결 — 장수마다 기운(불·물·번개·바람·땅)과 그 기운을 타고 나타나는 짐승 (형 11-01:
 * "디지몬 진화처럼 길고 강렬하게 · 온 세계의 기운이 한 곳으로 모이고 · 성격별로 물·번개·바람·불 · 동물 연출도 좋음, 우리는 단군신화 있으니까").
 *
 * 흐름 (시각은 app.ts ascendShow 가 P.realm.ascend* 로 준다):
 *  1. 모임 — 화면 둘레에서 기운 알갱이가 소용돌이치며 초상으로 빨려 든다 · 북이 두구두구 빨라진다 · 불꽃 칸 셋이 차례로 붙는다
 *  2. 소용돌이 — 초상이 빛으로 하얗게 바래고 그 둘레를 기운이 돈다 (번개는 내리꽂고 · 바람은 휘감고 · 물은 감돌고 · 땅은 돌이 떠오른다)
 *  3. 짐승 — 기운의 짐승이 뒤에서 솟는다 (단군신화의 곰과 범 · 물의 용 · 바람의 학 · 번개의 매)
 *  4. 번쩍 — 각성 초상 · 충격파 고리 · 「각성」 붓글씨 · 능력치
 * 알갱이는 낱낱이 (메모리: 이펙트는 낱낱이) · 넓은 막은 opacity 만 (메모리: 폰 그래픽 한도) · 움직임은 작은 칸에만.
 */
import type { Hero } from '../../realm/types.ts'
import type { Slot } from './sound.ts'

export type Elem = 'fire' | 'water' | 'bolt' | 'wind' | 'earth'

export interface ElemInfo {
  readonly name: string
  /** 짐승 그림 열쇠 (fx/awaken/beast-<id>.png · 검은 바탕 · screen 으로 얹는다) */
  readonly beast: string
  readonly beastName: string
  /** 짙은 · 가운데 · 밝은 · 심 (셰이더 그레이디언트와 알갱이) */
  readonly c: readonly [string, string, string, string]
  /** 소용돌이에 드는 소리 · 짐승이 솟을 때 소리 */
  readonly sfx: Slot
}

export const ELEM: Readonly<Record<Elem, ElemInfo>> = {
  fire: { name: '불', beast: 'tiger', beastName: '범', c: ['#7a0c02', '#ff5a1a', '#ffc04a', '#fff4d8'], sfx: 'cmd_fire' },
  water: { name: '물', beast: 'dragon', beastName: '용', c: ['#04205a', '#1a6aff', '#5ad0ff', '#eafcff'], sfx: 'cmd_ford' },
  bolt: { name: '번개', beast: 'hawk', beastName: '매', c: ['#2a0a6a', '#7a5aff', '#a8e0ff', '#ffffff'], sfx: 'battle_crit' },
  wind: { name: '바람', beast: 'crane', beastName: '학', c: ['#063a30', '#1aa88a', '#a8f4d8', '#f6fffa'], sfx: 'arrow_volley' },
  earth: { name: '땅', beast: 'bear', beastName: '곰', c: ['#3a2006', '#a86a1a', '#f0c060', '#fff4d6'], sfx: 'cmd_rocks' },
}

/** 장수마다 정해 두는 결 (장수 설정 docs/realm/cast 가 정하면 여기에) — 없으면 특성 · 가장 높은 능력치로 */
const ELEM_OF: Readonly<Record<string, Elem>> = {}

const BY_TRAIT: ReadonlyArray<readonly [string, Elem]> = [
  ['river', 'water'], ['shaman', 'bolt'], ['nighteye', 'bolt'], ['archer', 'wind'], ['mountain', 'earth'], ['steadfast', 'earth'], ['smith', 'fire'], ['ironhand', 'fire'],
]
/** 무예는 불(범) · 통솔은 땅(곰) · 지략은 번개(매) · 내정은 물(용) · 매력은 바람(학) */
const BY_STAT: ReadonlyArray<readonly ['mu' | 'tong' | 'ryak' | 'chi' | 'deok', Elem]> = [['mu', 'fire'], ['tong', 'earth'], ['ryak', 'bolt'], ['chi', 'water'], ['deok', 'wind']]

export function elemOf(h: Hero): Elem {
  const set = ELEM_OF[h.id]
  if (set !== undefined) return set
  const ts = h.traits ?? []
  for (const [t, e] of BY_TRAIT) if (ts.includes(t)) return e
  let best = BY_STAT[0]!
  for (const x of BY_STAT) if (h[x[0]] > h[best[0]]) best = x
  return best[1]
}

/** 판마다 같은 흩어짐 (꾸밈이라 판의 시드와 상관없다) */
const jit = (i: number, k: number, s: number): number => ((i * 73 + k * 151 + s * 37) % 101) / 101

/** 그림 자리 — fx/awaken (제미나이로 구운 낱낱의 그림 · 형 11-03: "허접한 CSS 말고 이미지 소스 각각") */
const fx = (art: string, name: string, cls = ''): string => `<img${cls !== '' ? ` class="${cls}"` : ''} src="${art}fx/awaken/${name}.png" alt="">`

/** 1 모임 — 화면 둘레에서 소용돌이치며 가운데로 빨려 드는 빛줄기 · 알갱이 */
export function gatherHtml(e: Elem, n: number, s: number, art: string, pace: { readonly sec: number; readonly spread: number; readonly stagger: number }): string {
  let h = ''
  for (let i = 0; i < n; i++) {
    const a = Math.round((360 / n) * i + jit(i, 1, s) * 40)
    // 화면 가장자리에서 출발 — 화면 밖에서 오면 마지막 빠른 토막만 보여 휙 지나간다 (11-03)
    const R = (40 + jit(i, 2, s) * 22).toFixed(0)
    // 천천히 — 둘레에 떠서 잠깐 머물다 빨려 든다 (형 11-03: "너무 빨리 지나감 · 천천히 보여서 기대하게")
    const d = (pace.sec + jit(i, 3, s) * pace.spread).toFixed(2)
    const dl = (jit(i, 4, s) * pace.stagger).toFixed(2)
    // 빛줄기 — 머리가 가운데를 보고 꼬리를 끌며 꽂힌다 (그림의 머리가 왼쪽)
    h += `<i style="--a:${a}deg;--R:${R}vmax;--d:${d}s;--dl:${dl}s;--z:${(0.6 + jit(i, 5, s) * 0.9).toFixed(2)}">${fx(art, `st-${e}`, 'st')}${i % 3 === 0 ? mote(e, art, i) : ''}</i>`
  }
  // 가운데 기운 덩이 — 모일수록 짙어진다 (opacity 만)
  return `${fx(art, `orb-${e}`, 'axcore')}<div class="axgather e-${e}">${h}</div>`
}

/** 2 소용돌이 — 초상 둘레를 도는 알갱이 · 번개 줄기 */
export function vortexHtml(e: Elem, n: number, s: number, art: string): string {
  let h = ''
  for (let i = 0; i < n; i++) {
    const a = Math.round((360 / n) * i)
    const r = (34 + jit(i, 6, s) * 22).toFixed(0)
    const d = (0.7 + jit(i, 7, s) * 0.8).toFixed(2)
    h += `<i style="--a:${a}deg;--r:${r}cqmin;--d:${d}s;--z:${(0.7 + jit(i, 8, s) * 0.8).toFixed(2)};--y:${((jit(i, 9, s) - 0.5) * 16).toFixed(0)}cqmin">${mote(e, art, i)}</i>`
  }
  let bolts = ''
  if (e === 'bolt') {
    // 번개 줄기 여섯 — 위에서 초상 둘레로 내리꽂는다 · 그림 넷을 돌려 쓰고 반은 좌우를 뒤집는다
    for (let b = 0; b < 6; b++) {
      bolts += `<img class="axbolt${b % 2 === 1 ? ' flip' : ''}" src="${art}fx/awaken/bolt-${(b % 4) + 1}.png" alt="" style="--x:${(8 + jit(b, 11, s) * 84).toFixed(0)}%;--t:${(jit(b, 12, s) * 2).toFixed(2)}s">`
    }
  }
  return `<div class="axvortex e-${e}">${h}</div>${bolts !== '' ? `<div class="axbolts">${bolts}</div>` : ''}`
}

/** 알갱이 하나 — 불은 불티 · 땅은 돌 · 물은 물방울 · 번개는 불꽃 튀김 · 바람은 바람결 (그림마다 몇 벌을 돌려 쓴다) */
export function mote(e: Elem, art: string, i: number): string {
  if (e === 'fire') return fx(art, 'ember')
  if (e === 'earth') return `<img class="rk" src="${art}fx/rock.png" alt="">`
  if (e === 'water') return fx(art, `p-drop${i % 2 === 0 ? 1 : 3}`)
  if (e === 'bolt') return fx(art, `p-spark${(i % 3) + 1}`)
  return fx(art, 'st-wind', 'gust') // 바람결 그림(S 자)은 작게 보면 $ 표처럼 읽혀 짧은 바람 줄기로 (11-03)
}

/** 번쩍 뒤 충격파 고리 셋 — 그 기운의 고리 그림 */
export const ringsHtml = (e: Elem, art: string): string => `<div class="axrings">${fx(art, `ring-${e}`)}${fx(art, `ring-${e}`)}${fx(art, `ring-${e}`)}</div>`

/** 기운 색을 CSS 변수로 */
export function elemVars(e: Elem): string {
  const [c0, c1, c2, c3] = ELEM[e].c
  return `--c0:${c0};--c1:${c1};--c2:${c2};--c3:${c3}`
}

/**
 * 연출 CSS — 시각: --tv 소용돌이 · --tb 짐승 · --tf 번쩍 (app ascendShow). 옛 장면(불꽃 칸 · 액자 · 붓글씨 · 능력치)은 appstyle 의 .ascfx 그대로.
 */
export const ASCEND_CSS = `
/* 1 모임 — 둘레에서 빛줄기가 감겨 들며 작아진다 · 가운데 기운 덩이가 짙어진다 */
.ap .axcore { position: absolute; left: 50%; top: 42%; width: min(80vmin, 560px); aspect-ratio: 1; translate: -50% -50%; z-index: 0; pointer-events: none; opacity: 0;
  animation: axcore var(--tf) ease-in forwards, axgone .8s ease-out calc(var(--tf) + 200ms) forwards; }
@keyframes axcore { 0% { opacity: 0; } 40% { opacity: .35; } 100% { opacity: .95; } }
.ap .axgather .st { position: absolute; left: 0; top: 50%; width: calc(170px * var(--z)); height: auto; translate: 0 -50%; max-width: none; }
.ap .axgather > i > img:not(.st) { position: absolute; left: -40%; top: -40%; width: 180%; height: 180%; }
.ap .axgather { position: absolute; left: 50%; top: 42%; width: 0; height: 0; z-index: 2; pointer-events: none; animation: axgone 1.2s ease-in var(--tv) forwards; }
.ap .axgather > i { position: absolute; left: 0; top: 0; width: calc(22px * var(--z)); height: calc(22px * var(--z)); margin: calc(-11px * var(--z)); opacity: 0;
  animation: axsuck var(--d) cubic-bezier(.4, 0, .8, .6) var(--dl) infinite; }
.ap .axvortex > i > * { display: block; width: 100%; height: 100%; }
.ap .axgather .rk, .ap .axvortex .rk { filter: brightness(.9) sepia(.6); }
@keyframes axsuck { 0% { opacity: 0; transform: rotate(var(--a)) translateX(var(--R)) scale(1.4); } 15% { opacity: 1; } 85% { opacity: 1; } 100% { opacity: 0; transform: rotate(calc(var(--a) + 70deg)) translateX(2vmin) scale(.3); } }
/* 2 소용돌이 — 초상 둘레를 돈다 (cq: 액자 칸 크기) */
.ap .axcard { container-type: size; }
.ap .axvortex { position: absolute; left: 50%; top: 50%; width: 0; height: 0; z-index: 3; pointer-events: none; opacity: 0;
  animation: axfade .35s ease-out var(--tv) forwards, axgone .35s linear calc(var(--tf) + 900ms) forwards; }
.ap .axvortex > i { position: absolute; left: 0; top: 0; width: calc(22px * var(--z)); height: calc(22px * var(--z)); margin: calc(-11px * var(--z));
  animation: axorbit var(--d) linear var(--tv) infinite; }
.ap .axvortex.e-earth > i { animation-name: axorbitup; }
@keyframes axorbit { from { transform: rotate(var(--a)) translateX(var(--r)) translateY(var(--y)); } to { transform: rotate(calc(var(--a) + 360deg)) translateX(var(--r)) translateY(var(--y)); } }
@keyframes axorbitup { from { transform: rotate(var(--a)) translateX(var(--r)) translateY(30cqmin) rotate(0deg); } to { transform: rotate(calc(var(--a) + 200deg)) translateX(calc(var(--r) * .8)) translateY(-10cqmin) rotate(220deg); } }
/* 초상이 빛으로 바랜다 — 그림 위 겹의 opacity 만 (폰 그래픽 한도) */
.ap .axsil { position: absolute; inset: 0; z-index: 1; background: radial-gradient(ellipse at 50% 40%, var(--c3), var(--c2) 55%, var(--c1)); mix-blend-mode: screen; opacity: 0;
  animation: axsilin calc(var(--tf) - var(--tv)) ease-in var(--tv) forwards, axgone .5s ease-out var(--tf) forwards; }
@keyframes axsilin { 0% { opacity: 0; } 60% { opacity: .75; } 85% { opacity: .55; } 100% { opacity: 1; } }
/* 떨림 — 모임에 작게 · 소용돌이에 크게 · 번쩍 바로 앞에 가장 크게 */
.ap .ascfx.evo .axcard { animation: axpop .55s cubic-bezier(.2, 1.4, .4, 1) .15s both, axquake .11s linear .8s calc((var(--tv) - .8s) / .11s), axquake2 .08s linear var(--tv) calc((var(--tf) - var(--tv)) / .08s), axboom .6s cubic-bezier(.2, 1.6, .4, 1) var(--tf); }
@keyframes axquake { 0%, 100% { transform: none; } 25% { transform: translate(-1.5px, 1px); } 75% { transform: translate(1.5px, -1px); } }
@keyframes axquake2 { 0%, 100% { transform: none; } 25% { transform: translate(-4px, 2px) rotate(-.6deg); } 50% { transform: translate(3px, -3px); } 75% { transform: translate(4px, 1px) rotate(.6deg); } }
/* 번개 줄기 — 소용돌이 동안 번쩍번쩍 */
.ap .axbolts { position: absolute; inset: 0; z-index: 2; pointer-events: none; opacity: 0; animation: axfade .1s linear var(--tv) forwards, axgone .3s linear var(--tf) forwards; }
.ap .axbolt { position: absolute; left: var(--x); top: 0; width: 16%; height: 62%; translate: -50% 0; opacity: 0; animation: axzap .5s steps(1) calc(var(--tv) + var(--t)) infinite; }
.ap .axbolt.flip { scale: -1 1; }
/* 바람 알갱이 — 가로로 긴 바람 줄기라 칸보다 넓게 · 눌리지 않게 */
.ap .ascfx i > img.gust.gust { position: relative; left: -110%; top: 35%; width: 320%; height: auto; max-width: none; }
/* 그림 위 끝이 곧게 잘렸다 — 위쪽을 서서히 드러낸다 (그림 검토 11-03) */
.ap .axbolt { -webkit-mask-image: linear-gradient(transparent, #000 18%); mask-image: linear-gradient(transparent, #000 18%); }
@keyframes axzap { 0% { opacity: 1; } 12% { opacity: .2; } 20% { opacity: 1; } 34% { opacity: 0; } 100% { opacity: 0; } }
/* 3 짐승 — 액자 뒤에서 솟는다 · 알파 그림 (넓은 칸에 섞기 모드를 걸지 않는다 · 폰 그래픽 한도) */
.ap .axbeast { position: absolute; left: 50%; top: 44%; width: min(150vw, 980px, 120vh); translate: -50% -50%; z-index: 0; pointer-events: none; opacity: 0;
  animation: axbeast 1.1s cubic-bezier(.2, 1.2, .4, 1) var(--tb) forwards, axbeastb 1.6s ease-in-out calc(var(--tf) + 700ms) infinite alternate; }
@keyframes axbeast { 0% { opacity: 0; transform: scale(.55) translateY(12%); } 55% { opacity: 1; } 100% { opacity: .9; transform: none; } }
@keyframes axbeastb { from { opacity: .9; } to { opacity: .55; } }
.ap .axbeast.gone { display: none; }
/* 4 번쩍 — 충격파 고리 셋 */
.ap .axrings { position: absolute; left: 50%; top: 42%; width: 0; height: 0; z-index: 4; pointer-events: none; }
.ap .axrings img { position: absolute; left: -20vmin; top: -20vmin; width: 40vmin; height: 40vmin; opacity: 0;
  animation: axring .9s cubic-bezier(.1, .7, .3, 1) var(--tf) forwards; }
.ap .axrings img:nth-child(2) { animation-delay: calc(var(--tf) + 140ms); } .ap .axrings img:nth-child(3) { animation-delay: calc(var(--tf) + 300ms); }
@keyframes axring { 0% { opacity: 1; transform: scale(.1); } 100% { opacity: 0; transform: scale(3.2); } }
.ap .ascfx.evo .axflash { background: var(--c3); }
.ap .ascfx.evo .axveil { background: radial-gradient(ellipse at 50% 42%, color-mix(in srgb, var(--c0) 70%, #000) 0, #07080c 70%); }
/* 확인 — 다 보고 나서 누른다 (형 11-01: "탭으로 스킵 안 되게 · 확인 버튼 눌러서 종료") · 화면 아래 붙박이 (메모리: 완료 단추는 하단) */
.ap .ascfx.evo { cursor: default; }
.ap .axok { position: absolute; left: 0; right: 0; bottom: 0; z-index: 6; display: flex; justify-content: center; padding: 14px 16px calc(14px + env(safe-area-inset-bottom)); background: linear-gradient(transparent, #000c 40%);
  opacity: 0; pointer-events: none; animation: axokin .4s ease-out var(--tok) forwards; }
.ap .axok .btn { min-width: min(70vw, 280px); font-size: 18px; padding: 12px 18px; }
@keyframes axokin { from { opacity: 0; } to { opacity: 1; pointer-events: auto; } }
@media (prefers-reduced-motion: reduce) { .ap .axgather, .ap .axvortex, .ap .axbolts { display: none; } }
`
