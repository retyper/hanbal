/**
 * 비기 컷인 띠 — 본편 싸움(skillfx.ts)과 열전(raid)이 같이 쓰는 「각성 컷인」 뼈대 (형 11-17: "스킬바디 연출은 전신 나오는 게 촌스러워 ·
 * 연출 배경도 만들게 · 지금 컷인을 잘라 쓰면 되잖아").
 *
 * 화면이 어두워지고 → 비스듬한 띠가 휙 가로지르며 그 안에 기운 바탕(fx/skill/bg/<결>.webp)이 흐르고 → 장수의 윗몸(비기 전신에서 잘라 판을 뺀 그림 ·
 * skill-body/{,aw1/,aw2/}cut/<id>.webp · tools/skill-cut-bake.py)이 띠 위로 머리를 내밀며 미끄러져 들고 → 기술 이름이 붓으로 →
 * 맞는 순간 띠가 번쩍·떨고 → 걷힌다. 문법만 빌렸다 — 그림·글꼴은 모두 우리 것.
 *
 * 폰 그래픽 한도: 움직이는 것은 띠·바탕·장수·이름·번쩍 몇 장의 transform·opacity 뿐 · filter·blur 없음 · 띠 모양은 고정 rotate + overflow.
 * 길이는 부르는 쪽이 준다(endMs) — 모든 박자는 그 비율. 누르면 걷는 것은 부르는 쪽이 한다.
 */
import { hasSkillBody } from '../realm/data/skill-body.ts'
import { SKILL_BODY_AW1 } from '../realm/data/skill-body-aw1.ts'
import { SKILL_BODY_AW2 } from '../realm/data/skill-body-aw2.ts'

/** 띠 바탕의 결 — fx/skill/bg/<결>.webp (1800×600 · 왼쪽 가운데가 가장 밝다) */
export type CutBg = 'fire' | 'water' | 'wind' | 'bolt' | 'earth' | 'war' | 'spirit' | 'shadow' | 'arrow'
export const CUT_BGS: readonly CutBg[] = ['fire', 'water', 'wind', 'bolt', 'earth', 'war', 'spirit', 'shadow', 'arrow']
export const cutBgSrc = (art: string, bg: CutBg): string => `${art}fx/skill/bg/${bg}.webp`

/** 띠에 오르는 장수 그림 — cut: 판을 뺀 윗몸(띠 위로 머리가 나온다) · 아니면 네모 초상(가장자리를 흐린다) */
export interface CutHero { readonly src: string; readonly cut: boolean }

const AW2 = '../awaken2-hd/'
const AW1 = '../awaken-hd/'
/**
 * 컷인 얼굴 이름(bust id · ../awaken-hd/<id> · ../awaken2-hd/<id>)에서 띠에 올릴 그림을 고른다 — 경로는 art(…/realm/) 뒤에 붙는다.
 * 진각성 전신 → 1차 각성 전신 → 기본 비기 전신 → (없으면) 그 얼굴의 초상.
 */
export function cutHeroPath(face: string | null): CutHero | null {
  if (face === null) return null
  const id = face.startsWith(AW2) ? face.slice(AW2.length) : face.startsWith(AW1) ? face.slice(AW1.length) : face
  const tier = face.startsWith(AW2) ? 2 : face.startsWith(AW1) ? 1 : 0
  if (tier >= 2 && SKILL_BODY_AW2.has(id)) return { src: `skill-body/aw2/cut/${id}.webp`, cut: true }
  if (tier >= 1 && SKILL_BODY_AW1.has(id)) return { src: `skill-body/aw1/cut/${id}.webp`, cut: true }
  if (hasSkillBody(id)) return { src: `skill-body/cut/${id}.webp`, cut: true }
  return { src: `bust-hd/${face}.jpg`, cut: false }
}

const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

export interface CutBandOpts {
  /** …/realm/ (끝에 /) */
  readonly art: string
  readonly bg: CutBg
  /** 띠 바탕 그림을 얹을지 — 아직 못 불러온 그림이면 false (띠는 제 빛깔 그러데이션만) */
  readonly bgReady?: boolean
  readonly hero: CutHero | null
  /** 장면 전체 길이(ms) · 맞는 순간(ms · 없으면 null) */
  readonly endMs: number
  readonly hitMs: number | null
  /** 맞는 순간 떠는 한 번의 길이(ms) — 두 번 떤다 */
  readonly shakeMs?: number
  /** 적의 기술 — 띠가 거꾸로 기울고 장수는 오른쪽, 이름은 왼쪽 */
  readonly foe?: boolean
  /** 기술 이름 · 그 밑 작은 글(장수 이름) — 없으면 안 그린다 (부르는 쪽이 제 이름 자리를 쓸 때) */
  readonly title?: string
  readonly sub?: string
  /** 이름 붓 자국 그림 (art 뒤 경로) — 없으면 붓 자국 없이 글자만 */
  readonly brush?: string | null
  /** 이름 상자 안에 더 얹을 HTML (헛침의 갈라진 먹 · 먹힘 도장) */
  readonly ttlExtra?: string
  /** 장수 위에 덮을 HTML (헛침의 잿빛 막) */
  readonly heroExtra?: string
  /** 어두운 막 (0~1) — 부르는 쪽이 제 막을 쓰면 null */
  readonly dim?: number | null
  /** 큰 판 (열전 각성·진 비기 · 11-17 형: 「비각성 궁극기 컷인보다 더 멋지게」) — 금빛 겹테 · 뒤에 거꾸로 기운 둘째 띠 · 띠 안을 흐르는 속도선 · 더 센 떨림과 금빛 터짐 */
  readonly grand?: boolean
}

/**
 * 띠 한 판의 HTML — `.cbd` 하나(자리 잡힌 부모를 가득 채운다 · 크기 단위 cqw·cqh 는 이 상자 기준).
 * 끝나면 .cbd 가 visibility:hidden 이 된다(cbd-end) — 걷는 것은 부르는 쪽.
 */
export function cutBandHtml(o: CutBandOpts): string {
  const end = Math.max(1, Math.round(o.endMs))
  const hs = o.shakeMs ?? 90
  const shake = o.hitMs !== null ? `animation:${o.grand === true ? 'cbd-hs2' : 'cbd-hs'} ${hs}ms steps(2) ${Math.round(o.hitMs)}ms ${o.grand === true ? 4 : 2}` : ''
  const grand = o.grand === true
  let h = `<div class="cbd bg-${o.bg}${o.foe === true ? ' foe' : ''}${grand ? ' grand' : ''}" style="--end:${end}ms" aria-hidden="true">`
  if (o.dim !== undefined && o.dim !== null) h += `<i class="cbd-dim" style="--dim:${o.dim}"></i>`
  h += `<div class="cbd-rig" style="${shake}">`
  // 띠 — 위아래 가는 빛 띠 둘이 엇갈려 지나가고, 가운데 넓은 띠에 기운 바탕이 흐른다
  h += '<i class="cbd-stripe a"></i><i class="cbd-stripe b"></i>'
  if (grand) h += '<i class="cbd-band2"><i class="cbd-speed"></i></i>'
  h += '<div class="cbd-band">'
  if (o.bgReady !== false) h += `<img class="cbd-plate" src="${cutBgSrc(o.art, o.bg)}" alt="" decoding="async">`
  h += '<i class="cbd-shade"></i>' + (grand ? '<i class="cbd-speed"></i>' : '') + '<i class="cbd-glint"></i>'
  if (o.hitMs !== null) h += `<i class="cbd-flash" style="animation-delay:${Math.round(o.hitMs)}ms"></i>`
  h += '</div>'
  if (grand && o.hitMs !== null) h += `<i class="cbd-burst" style="animation-delay:${Math.round(o.hitMs)}ms"></i>`
  // 장수 — 띠 위로 머리를 내민 윗몸 · 그림이 없으면 장수 표식
  const hero = o.hero
  const img = hero === null ? `<img class="cbd-face unit" src="${o.art}icon/unit-general.png" alt="">` : `<img class="cbd-face${hero.cut ? '' : ' sq'}" src="${o.art}${hero.src}" alt="" decoding="async">`
  h += `<div class="cbd-hero${hero !== null && !hero.cut ? ' sq' : ''}">${img}${o.heroExtra ?? ''}</div>`
  if (o.title !== undefined) {
    const brush = o.brush !== undefined && o.brush !== null ? `<img class="cbd-brush" src="${o.art}${o.brush}" alt="">` : ''
    const long = [...o.title].length > 5 ? ' class="long"' : ''
    h += `<div class="cbd-ttl">${brush}${o.ttlExtra ?? ''}<b${long}>${esc(o.title)}</b>${o.sub !== undefined && o.sub !== '' ? `<span>${esc(o.sub)}</span>` : ''}</div>`
  }
  return h + '</div></div>'
}

/**
 * 띠의 모양 — `.ap` 같은 바깥 이름에 기대지 않는다 (열전도 그대로 쓴다). 키프레임은 transform·opacity 만.
 * --bh 띠 높이 · --by 띠 가운데 높이 · --cc 결의 빛깔.
 */
export const CUTIN_BAND_CSS = `
.cbd { position: absolute; inset: 0; container-type: size; overflow: hidden; pointer-events: none; animation: cbd-end var(--end) steps(1) forwards; --cc: #ffd27a; --cc2: #7a3a10; --dir: 1; }
@keyframes cbd-end { to { visibility: hidden; } }
.cbd.bg-fire { --cc: #ff9a4a; --cc2: #6b1a06; } .cbd.bg-water { --cc: #6fe6d8; --cc2: #06323a; } .cbd.bg-wind { --cc: #a8f2cf; --cc2: #0b3a4a; }
.cbd.bg-bolt { --cc: #c49bff; --cc2: #2a0f5c; } .cbd.bg-earth { --cc: #f3c063; --cc2: #4a2c08; } .cbd.bg-war { --cc: #ff6a48; --cc2: #4e0a06; }
.cbd.bg-spirit { --cc: #ffe8a0; --cc2: #123a26; } .cbd.bg-shadow { --cc: #c3c6ff; --cc2: #14142c; } .cbd.bg-arrow { --cc: #ffd98a; --cc2: #102028; }
.cbd.foe { --dir: -1; }
.cbd-dim { position: absolute; inset: 0; background: #05040a; opacity: 0; animation: cbd-dim var(--end) linear both; }
.cbd.foe .cbd-dim { background: #1c0406; }
@keyframes cbd-dim { 0% { opacity: 0; } 8% { opacity: var(--dim); } 86% { opacity: var(--dim); } 100% { opacity: 0; } }
.cbd-rig { position: absolute; inset: 0; --bh: min(50cqh, 60cqw, 400px); --by: 40cqh; }
@container (orientation: portrait) { .cbd-rig { --bh: min(30cqh, 66cqw, 400px); --by: 31cqh; } }
/* 띠 — 화면보다 넓은 띠를 고정 기울기로 · 들어올 땐 띠 방향으로 휙 (rotate 는 고정, 움직임은 transform 만) */
.cbd-band, .cbd-stripe { position: absolute; left: -20cqw; width: 140cqw; rotate: calc(-7deg * var(--dir)); transform-origin: 50% 50%; }
.cbd-band { top: calc(var(--by) - var(--bh) / 2); height: var(--bh); overflow: hidden; background: linear-gradient(90deg, var(--cc2), color-mix(in srgb, var(--cc) 55%, var(--cc2)) 32%, var(--cc2) 70%, #000);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--cc) 70%, #fff0), 0 10px 28px #000c; animation: cbd-band var(--end) cubic-bezier(.2, .9, .25, 1) both; }
@keyframes cbd-band { 0% { opacity: 0; transform: translateX(calc(-70cqw * var(--dir))) scaleY(.2); } 13% { opacity: 1; transform: translateX(0) scaleY(1); } 86% { opacity: 1; transform: translateX(0) scaleY(1); } 100% { opacity: 0; transform: translateX(calc(40cqw * var(--dir))) scaleY(.5); } }
.cbd-stripe { height: max(4px, calc(var(--bh) * .035)); background: linear-gradient(90deg, #0000, var(--cc) 25%, #fff 50%, var(--cc) 75%, #0000); opacity: 0; }
.cbd-stripe.a { top: calc(var(--by) - var(--bh) / 2 - var(--bh) * .1); animation: cbd-st-a var(--end) cubic-bezier(.2, .9, .25, 1) 30ms both; }
.cbd-stripe.b { top: calc(var(--by) + var(--bh) / 2 + var(--bh) * .07); animation: cbd-st-b var(--end) cubic-bezier(.2, .9, .25, 1) 70ms both; }
@keyframes cbd-st-a { 0% { opacity: 0; transform: translateX(calc(90cqw * var(--dir))); } 16% { opacity: .9; transform: translateX(calc(-3cqw * var(--dir))); } 84% { opacity: .7; transform: translateX(calc(-8cqw * var(--dir))); } 100% { opacity: 0; transform: translateX(calc(-40cqw * var(--dir))); } }
@keyframes cbd-st-b { 0% { opacity: 0; transform: translateX(calc(-90cqw * var(--dir))); } 16% { opacity: .9; transform: translateX(calc(3cqw * var(--dir))); } 84% { opacity: .7; transform: translateX(calc(8cqw * var(--dir))); } 100% { opacity: 0; transform: translateX(calc(40cqw * var(--dir))); } }
/* 기운 바탕 — 띠보다 조금 넓게 깔고 천천히 흘린다 (한 장의 transform) · 적이면 좌우를 뒤집어 기운이 적 쪽에서 */
.cbd-plate { position: absolute; left: -8%; top: 0; width: 116%; height: 100%; object-fit: cover; object-position: 30% 50%; animation: cbd-flow var(--end) linear both; }
.cbd.foe .cbd-plate { scale: -1 1; }
@keyframes cbd-flow { from { transform: translateX(5%); } to { transform: translateX(-5%); } }
.cbd-shade { position: absolute; inset: 0; background: linear-gradient(180deg, #0009, #0000 18%, #0000 80%, #000a), linear-gradient(calc(90deg * var(--dir)), #0000 48%, #0006 78%, #000a); }
.cbd-glint { position: absolute; top: -10%; bottom: -10%; left: 0; width: 22%; background: linear-gradient(90deg, #fff0, #fff9 50%, #fff0); opacity: 0; transform: translateX(-120%) skewX(-24deg); animation: cbd-glint calc(var(--end) * .32) ease-out calc(var(--end) * .08) both; }
@keyframes cbd-glint { 0% { opacity: 0; transform: translateX(-120%) skewX(-24deg); } 15% { opacity: 1; } 100% { opacity: 0; transform: translateX(560%) skewX(-24deg); } }
.cbd-flash { position: absolute; inset: 0; background: radial-gradient(ellipse at 35% 50%, #fff, color-mix(in srgb, var(--cc) 70%, #fff0) 45%, #fff0 75%); opacity: 0; animation: cbd-flash 300ms ease-out both; }
@keyframes cbd-flash { 0% { opacity: 0; } 12% { opacity: .95; } 100% { opacity: 0; } }
/* 장수 — 띠 위로 머리를 내민다 · 아래·옆은 그림에서 이미 흐려 두었다 (구운 알파) */
.cbd-hero { position: absolute; left: 1cqw; top: calc(var(--by) + var(--bh) * .5 - var(--bh) * 1.36); height: calc(var(--bh) * 1.36); aspect-ratio: 440 / 500; z-index: 2;
  animation: cbd-hero var(--end) cubic-bezier(.2, 1.1, .35, 1) 60ms both; }
.cbd.foe .cbd-hero { left: auto; right: 1cqw; }
@container (orientation: portrait) { .cbd-hero { left: 0; } .cbd.foe .cbd-hero { right: 0; } }
.cbd-hero.sq { aspect-ratio: 1; height: calc(var(--bh) * 1.12); top: calc(var(--by) - var(--bh) * .62); }
@keyframes cbd-hero { 0% { opacity: 0; transform: translateX(calc(-28cqw * var(--dir))) scale(1.08); } 18% { opacity: 1; transform: translateX(0) scale(1); } 84% { opacity: 1; transform: translateX(calc(1.5cqw * var(--dir))) scale(1.035); } 100% { opacity: 0; transform: translateX(calc(-8cqw * var(--dir))) scale(1.035); } }
.cbd-face { display: block; width: 100%; height: 100%; object-fit: contain; }
.cbd-face.sq { object-fit: cover; -webkit-mask-image: radial-gradient(closest-side, #000 72%, #0000); mask-image: radial-gradient(closest-side, #000 72%, #0000); }
.cbd-face.unit { object-fit: contain; padding: 12%; box-sizing: border-box; }
/* 기술 이름 — 띠의 아래 가장자리에 걸쳐 붓으로 */
.cbd-ttl { position: absolute; left: 44cqw; right: 2cqw; top: calc(var(--by) + var(--bh) * .08); z-index: 3; display: flex; flex-direction: column; align-items: center; gap: 4px;
  animation: cbd-ttl var(--end) cubic-bezier(.2, 1.2, .4, 1) calc(var(--end) * .1) both; }
.cbd.foe .cbd-ttl { left: 2cqw; right: 44cqw; }
@container (orientation: portrait) { .cbd-ttl { left: 30cqw; top: calc(var(--by) + var(--bh) * .22); } .cbd.foe .cbd-ttl { left: 2cqw; right: 30cqw; } }
@keyframes cbd-ttl { 0% { opacity: 0; transform: translateX(calc(40cqw * var(--dir))) scale(1.3); } 20% { opacity: 1; transform: translateX(0) scale(1); } 84% { opacity: 1; transform: translateX(0) scale(1); } 100% { opacity: 0; transform: translateX(calc(14cqw * var(--dir))); } }
.cbd-brush { position: absolute; left: -10%; top: 50%; width: 120%; height: auto; translate: 0 -62%; z-index: -1; }
.cbd-ttl b { font-family: var(--display, 'Song Myung', 'Gowun Batang', 'Batang', serif); font-weight: 400; font-size: clamp(28px, min(9.5cqw, 15cqh), 72px); line-height: 1.05; color: #fff6dc; text-align: center; letter-spacing: .04em;
  -webkit-text-stroke: 1px #2a1400; paint-order: stroke fill; text-shadow: 0 3px 0 #2a1400, 0 0 14px color-mix(in srgb, var(--cc) 80%, #0000), 0 0 3px #000; white-space: nowrap; }
.cbd-ttl b.long { font-size: clamp(22px, min(7cqw, 11cqh), 54px); }
.cbd-ttl span { font-size: clamp(12px, min(3.4cqw, 4.6cqh), 18px); font-weight: 800; color: #ffe6b0; background: #000c; padding: 2px 12px; border-radius: 9px; border: 1px solid color-mix(in srgb, var(--cc) 60%, #0000); }
@keyframes cbd-hs { 0% { translate: -6px 3px; } 50% { translate: 6px -3px; } 100% { translate: 0 0; } }
/* 큰 판 (grand) — 금빛 겹테 · 둘째 띠 · 속도선(딱 끊기는 줄무늬를 background-position 으로 흘림) · 금빛 터짐 (radial) · 이름 금빛 */
.cbd.grand { --cc: #ffd66a; }
.cbd.grand .cbd-band { box-shadow: 0 0 0 3px #ffd66a, 0 0 0 6px #4a2a06, 0 0 0 8px #fff0b0, 0 10px 28px #000c; }
.cbd-band2 { position: absolute; left: -20cqw; width: 140cqw; top: calc(var(--by) - var(--bh) * .95); height: calc(var(--bh) * .34); rotate: calc(5deg * var(--dir)); overflow: hidden;
  background: #2a0d04; box-shadow: 0 0 0 2px #ffd66a; animation: cbd-band2 var(--end) cubic-bezier(.2, .9, .25, 1) 40ms both; }
@keyframes cbd-band2 { 0% { opacity: 0; transform: translateX(calc(70cqw * var(--dir))); } 15% { opacity: .95; transform: translateX(0); } 86% { opacity: .95; transform: translateX(0); } 100% { opacity: 0; transform: translateX(calc(-40cqw * var(--dir))); } }
/* 속도선: 가로로 끊긴 빛줄 여섯 줄(딱 끊기는 줄무늬 · 줄마다 길이가 달라 겹치지 않게)이 띠 방향으로 흐른다 — 움직임은 background-position */
.cbd-speed { position: absolute; inset: 0; mix-blend-mode: screen; background-repeat: repeat-x;
  background-image: linear-gradient(90deg, #0000 62%, #fff8 62%), linear-gradient(90deg, #0000 70%, #ffd66a99 70%), linear-gradient(90deg, #0000 55%, #fff6 55%), linear-gradient(90deg, #0000 74%, #ffd66aaa 74%), linear-gradient(90deg, #0000 60%, #fff7 60%), linear-gradient(90deg, #0000 68%, #ffd66a88 68%);
  background-size: 180px 2px, 260px 3px, 140px 2px, 300px 3px, 210px 2px, 240px 2px;
  background-position: 0 14%, 40px 29%, 90px 44%, 10px 61%, 120px 76%, 60px 90%; animation: cbd-speed .3s linear infinite; }
@keyframes cbd-speed { to { background-position: calc(-180px * var(--dir)) 14%, calc(40px - 260px * var(--dir)) 29%, calc(90px - 140px * var(--dir)) 44%, calc(10px - 300px * var(--dir)) 61%, calc(120px - 210px * var(--dir)) 76%, calc(60px - 240px * var(--dir)) 90%; } }
.cbd-band2 .cbd-speed { mix-blend-mode: normal; background-image: linear-gradient(90deg, #0000 50%, #ffd66a 50%), linear-gradient(90deg, #0000 64%, #fff2c0cc 64%); background-size: 120px 3px, 170px 2px; background-position: 0 32%, 50px 70%; animation: cbd-speed2 .24s linear infinite; }
@keyframes cbd-speed2 { to { background-position: calc(120px * var(--dir)) 32%, calc(50px + 170px * var(--dir)) 70%; } }
.cbd-burst { position: absolute; left: 10cqw; top: calc(var(--by) - var(--bh)); width: 50cqw; height: calc(var(--bh) * 2); z-index: 1; background: radial-gradient(closest-side, #fff8, #ffd66a77 40%, #ffd66a00); opacity: 0; animation: cbd-burst 420ms ease-out both; }
@keyframes cbd-burst { 0% { opacity: 0; transform: scale(.4); } 18% { opacity: 1; } 100% { opacity: 0; transform: scale(1.5); } }
.cbd.grand .cbd-ttl b { color: #ffe9a0; font-size: clamp(30px, min(10.5cqw, 16cqh), 80px); text-shadow: 0 3px 0 #2a1400, 0 0 18px #ffb84a, 0 0 4px #000; }
.cbd.grand .cbd-ttl b.long { font-size: clamp(24px, min(7.6cqw, 12cqh), 60px); }
.cbd.grand .cbd-hero { animation-name: cbd-hero2; }
@keyframes cbd-hero2 { 0% { opacity: 0; transform: translateX(calc(-28cqw * var(--dir))) scale(1.18); } 16% { opacity: 1; transform: translateX(0) scale(1); } 84% { opacity: 1; transform: translateX(calc(2cqw * var(--dir))) scale(1.06); } 100% { opacity: 0; transform: translateX(calc(-8cqw * var(--dir))) scale(1.06); } }
@keyframes cbd-hs2 { 0% { translate: -11px 5px; } 50% { translate: 10px -6px; } 100% { translate: 0 0; } }
@media (prefers-reduced-motion: reduce) {
  .cbd-band, .cbd-band2, .cbd-stripe, .cbd-hero, .cbd-ttl, .cbd-rig, .cbd-speed { animation: none !important; } .cbd-burst { display: none; }
  .cbd-stripe { opacity: .7; } .cbd-plate { animation: none; } .cbd-glint { display: none; } .cbd-flash { animation: none; }
}
`

let injected = false
/** 본편 밖(열전 등)에서 쓸 때 — 띠 모양을 문서에 한 번 넣는다 */
export function ensureCutinBandCss(): void {
  if (injected || typeof document === 'undefined') return
  injected = true
  const s = document.createElement('style')
  s.dataset['cbd'] = '1'
  s.textContent = CUTIN_BAND_CSS
  document.head.appendChild(s)
}
