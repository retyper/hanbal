/**
 * 알현 — 남의 나라 군장이 화면 가득 들어와 제 입으로 말한다 (형 10-25: "동맹이나 화친, 조공 이벤트 발생 시 문명에서는
 * 애니메이션이나 대사 이런 것들이 다이나믹하게 오거든? 우리도 그런 거 필요하지 않을까?").
 *
 * 두 자리:
 *   청이 왔다 — 그 나라 대청을 배경으로 군장이 미끄러져 들어오고, 탈(마음)이 붙고, 말이 한 자씩 찍힌다 → 받는다·거절한다 (얻고 잃는 것은 아이콘+숫자)
 *   맺었다·틀어졌다 — 두 군장이 마주 보고 깃발이 부딪힌 뒤 한마디 (화친 · 동맹 · 조공 · 거절)
 * 말은 군장의 목소리 결(voice.ts voiceKind) × 나라 성향 — 욕심 많은 나라는 적극, 조심스런 나라는 소극 (chief-lines.ts · 216줄).
 * 말이 찍히기 시작할 때 그 군장이 제 목소리로 말한다 (형 10-26: "타국에서 걸어오는 말 대사들도 전체화면 이벤트 뜰 때 목소리로").
 */
import type { AskKind, Mind } from '../../realm/types.ts'
import { CHIEF_LINE, type ChiefMood, type ChiefSit } from './chief-lines.ts'
import { CHIEF_LINE_B } from './chief-lines-b.ts'
import { baseKind, type VoiceKind } from './voice.ts'

/** 맺거나 틀어진 뒤의 한마디 */
export type PactKind = 'truce' | 'ally' | 'vassal' | 'refused' | 'gift'
const PACT_SIT: Readonly<Record<PactKind, ChiefSit>> = { truce: 'peace', ally: 'ally', vassal: 'vassal', refused: 'refused', gift: 'gift' }

/** 군장의 한마디 — 화면 글과 그 군장 목소리 (없는 소리는 조용히) */
export interface ChiefSay { readonly text: string; readonly voice: string }

/** 욕심 많은 나라는 적극(a) · 조심스런 나라는 소극(p) */
const moodOf = (m: Mind | undefined): ChiefMood => (m === 'greedy' ? 'a' : 'p')

/** cast b — 성우진 B 의 군장(얼굴로 반씩 · voice.ts castOf)은 다른 말·다른 목소리 (chief-lines-b.ts · 형 10-29) */
function chiefSay(k: VoiceKind, sit: ChiefSit, mind: Mind | undefined, cast: 'a' | 'b'): ChiefSay {
  const md = moodOf(mind)
  // 새 결 넷(청년 무장 등)은 군장 말이 없어 가까운 옛 결의 말 · 목소리로 (voice.ts BASE_OF)
  const vk = baseKind(k)
  const [a, p] = (cast === 'b' ? CHIEF_LINE_B : CHIEF_LINE)[vk][sit]
  return { text: md === 'a' ? a : p, voice: `realm/voice/${cast === 'b' ? 'b/' : ''}chief/${vk}-${sit}-${md}.ogg` }
}

/** 청을 건 군장의 첫마디 — 갈래 × 군장 목소리 결 × 나라 성향 */
export function askSay(kind: AskKind, mind: Mind | undefined, vk: VoiceKind, cast: 'a' | 'b' = 'a'): ChiefSay {
  return chiefSay(vk, kind, mind, cast)
}
/** 맺거나 틀어진 뒤 저쪽 군장의 한마디 */
export function pactSay(kind: PactKind, mind: Mind | undefined, vk: VoiceKind, cast: 'a' | 'b' = 'a'): ChiefSay {
  return chiefSay(vk, PACT_SIT[kind], mind, cast)
}

/** 말이 한 자씩 찍힌다 — 글자마다 늦춤(CSS). 다 찍히는 데 `per` 초씩 */
export function typed(text: string, esc: (s: string) => string, start = 0.6, per = 0.035): string {
  return [...text].map((ch, i) => `<i style="--d:${(start + i * per).toFixed(3)}s">${ch === ' ' ? '&nbsp;' : esc(ch)}</i>`).join('')
}

export const AUD_CSS = `
/* 알현 — 청이 왔다 (형 10-25: 문명처럼 군장이 들어와 말한다) */
.ap .aud { position: relative; overflow: hidden; border-radius: 16px; width: min(100%, 1080px); align-self: center; margin: 0 auto; min-height: min(66vh, 600px); display: flex; flex-direction: column; justify-content: flex-end; background: #120c08; box-shadow: 0 14px 40px #000c; }
.ap .aud .audbg { position: absolute; inset: 0; background-size: cover; background-position: center; filter: brightness(.62) saturate(.9); animation: audbg 2.4s ease-out both; }
.ap .aud.threat .audbg { filter: brightness(.5) saturate(1.1) sepia(.35) hue-rotate(-20deg); }
.ap .aud .audlord { position: absolute; right: 2%; bottom: 0; height: 100%; aspect-ratio: 1; object-fit: cover; object-position: top; -webkit-mask: url(__ART__fx/mask-bust.png) center / 100% 100% no-repeat; mask: url(__ART__fx/mask-bust.png) center / 100% 100% no-repeat; animation: audin .7s cubic-bezier(.2, 1.1, .4, 1) .15s both; }
.ap .aud .audtop { position: absolute; left: 16px; top: 14px; right: 16px; display: flex; align-items: center; gap: 10px; z-index: 2; animation: audup .4s ease-out .3s both; }
.ap .aud .audtop .aqi { width: 34px; height: 34px; } .ap .aud .audtop b { font-size: 15px; color: var(--gold); letter-spacing: .04em; text-shadow: 0 1px 4px #000; }
.ap .aud .audname { position: relative; z-index: 2; display: flex; align-items: center; gap: 8px; margin: 0 16px 6px; animation: audup .4s ease-out .45s both; }
.ap .aud .audname .fem { width: 38px; height: 38px; } .ap .aud .audname b { font-size: clamp(20px, 3.4vw, 28px); text-shadow: 0 2px 8px #000; } .ap .aud .audname span { color: #d9ccb4; font-size: 14px; text-shadow: 0 1px 4px #000; }
.ap .aud .audname span.rel { margin-left: 0; padding: 3px 10px; font-size: 13px; text-shadow: none; color: #e6d8c6; background: #3a2c1ecc; } /* 우리와의 사이 — 탈 옆 (형 10-27) */
.ap .aud .audname span.rel.war { background: #4a2420ee; color: #f1b8a8; } .ap .aud .audname span.rel.truce { background: #23331fee; color: #cfeabf; } .ap .aud .audname span.rel.ally { background: #1f2c40ee; color: #b8d4f4; }
.ap .aud .audname img.mood { width: 40px; height: 40px; animation: audpop .5s cubic-bezier(.3, 1.6, .5, 1) .9s both; }
.ap .aud .audsay { position: relative; z-index: 2; margin: 0 16px 10px; max-width: min(640px, 70%); padding: 12px 16px; border-radius: 14px 14px 14px 4px; background: #f3ead6; color: #2a1d10; font-size: clamp(15px, 2.2vw, 19px); line-height: 1.5; box-shadow: 0 6px 20px #000a; animation: audup .35s ease-out .5s both; }
.ap .aud.threat .audsay { background: #2a0e0a; color: #ffd8cc; border: 1.5px solid #c8503a; }
.ap .aud .audsay i { font-style: normal; opacity: 0; animation: audch .01s linear var(--d) forwards; }
.ap .aud .audwhat { position: relative; z-index: 2; margin: 0 16px 12px; padding: 8px 12px; border-radius: 10px; background: #000a; font-size: 14px; color: #efe6d2; max-width: min(640px, 72%); animation: audup .4s ease-out 1.1s both; }
.ap .aud .audbtns { position: relative; z-index: 2; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 0 16px 16px; animation: audup .4s ease-out 1.3s both; }
.ap .aud .audbtns .btn { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 12px; font-size: 17px; }
.ap .aud .audbtns .btn.on { box-shadow: 0 0 0 2px var(--gold), 0 0 18px #ffd27a88; }
.ap .aud .audbtns small { font-size: 12px; color: #d9ccb4; font-weight: 500; }
.ap .gain { display: inline-flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.ap .gain .gg { display: inline-flex; align-items: center; gap: 1px; padding: 0 6px 0 3px; border-radius: 999px; background: #10301ad0; border: 1px solid #4ac87a99; color: #c8ffd8; font-size: 12.5px; font-weight: 700; line-height: 1.5; font-variant-numeric: tabular-nums; }
.ap .gain .gg i { font-style: normal; font-size: 9px; color: #5aff8a; margin-right: 1px; } .ap .gain .cgi { width: 16px; height: 16px; object-fit: contain; }
@keyframes audbg { from { transform: scale(1.12); } to { transform: none; } }
@keyframes audin { from { transform: translateX(40%); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes audup { from { transform: translateY(14px); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes audpop { 0% { transform: scale(0) rotate(-30deg); } 70% { transform: scale(1.25) rotate(8deg); } 100% { transform: none; } }
@keyframes audch { to { opacity: 1; } }

/* 맺었다 · 틀어졌다 — 두 군장이 마주 본다
 * 얼굴 가림막은 미리 구운 그림(fx/mask-bust.png) — CSS 그러데이션은 갤럭시 호환 모드에서 계단으로 층층이 보였고, 위쪽 끝(모자·머리가 잘린 자리)이 흐려지지 않아 머리가 뚝 잘려 보였다 (형 10-29) */
.ap .pact { position: relative; aspect-ratio: 16 / 9; width: min(100%, calc(62vh * 16 / 9)); align-self: center; border-radius: 16px; overflow: hidden; box-shadow: 0 14px 40px #000c; }
.ap .pact .pactbg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; filter: brightness(.7); animation: audbg 2.4s ease-out both; }
.ap .pact .pl { position: absolute; bottom: 0; height: 82%; aspect-ratio: 1; object-fit: cover; object-position: top; -webkit-mask: url(__ART__fx/mask-bust.png) center / 100% 100% no-repeat; mask: url(__ART__fx/mask-bust.png) center / 100% 100% no-repeat; }
.ap .pact .pl.a { left: 2%; animation: pactl .7s cubic-bezier(.2, 1.1, .4, 1) .1s both; transform: scaleX(-1); }
.ap .pact .pl.b { right: 2%; animation: pactr .7s cubic-bezier(.2, 1.1, .4, 1) .1s both; }
.ap .pact .pflags { position: absolute; left: 50%; top: 10%; transform: translateX(-50%); display: flex; align-items: center; gap: 10px; z-index: 2; }
.ap .pact .pflags .fem { width: 54px; height: 54px; } .ap .pact .pflags .fem:first-child { animation: pflagl .6s cubic-bezier(.3, 1.4, .5, 1) .5s both; } .ap .pact .pflags .fem:last-child { animation: pflagr .6s cubic-bezier(.3, 1.4, .5, 1) .5s both; }
.ap .pact .pflags i { font-style: normal; font-size: 28px; color: var(--gold); text-shadow: 0 0 12px #000; animation: audpop .5s cubic-bezier(.3, 1.6, .5, 1) .95s both; }
.ap .pact.bad .pflags i { color: #ff6a4a; }
.ap .pact .psay { position: absolute; left: 0; right: 0; margin: 0 auto; bottom: 6%; width: min(560px, 60%); z-index: 2; padding: 10px 14px; border-radius: 14px; background: #f3ead6; color: #2a1d10; font-size: clamp(14px, 2vw, 18px); line-height: 1.5; text-align: center; box-shadow: 0 6px 20px #000a; animation: audup .35s ease-out 1s both; }
.ap .pact.bad .psay { background: #2a0e0a; color: #ffd8cc; border: 1.5px solid #c8503a; }
.ap .pact .psay i { font-style: normal; opacity: 0; animation: audch .01s linear var(--d) forwards; }
@keyframes pactl { from { transform: scaleX(-1) translateX(60%); opacity: 0; } to { transform: scaleX(-1); opacity: 1; } }
@keyframes pactr { from { transform: translateX(60%); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes pflagl { from { transform: translateX(-120px) rotate(-30deg); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes pflagr { from { transform: translateX(120px) rotate(30deg); opacity: 0; } to { transform: none; opacity: 1; } }
.ap .landc .pactt { display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; }
.ap .landc .pactt b { font-size: clamp(22px, 4.2vw, 32px); color: #ffd77a; text-shadow: 0 2px 8px #000; animation: bigslam .55s cubic-bezier(.3, 1.6, .5, 1) .35s both; }
.ap .landc.lost .pactt b { color: #ff8a70; } .ap .landc .pactt span { font-size: 15px; color: #efe6d2; animation: audup .4s ease-out .8s both; }
/* 공작 큰 화면 — 누가 · 어디에 · 무엇을 · 성공/실패 도장 (형 10-26) */
.ap .plotv { position: relative; aspect-ratio: 16 / 9; width: min(100%, calc(62vh * 16 / 9)); align-self: center; border-radius: 16px; overflow: hidden; box-shadow: 0 14px 40px #000c; }
.ap .plotv .pbg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; animation: audbg 2.4s ease-out both; }
.ap .plotv.fail .pbg { filter: grayscale(.65) brightness(.55) sepia(.2); }
.ap .plotv .pred { position: absolute; inset: 0; pointer-events: none; background: linear-gradient(transparent 45%, #000c); }
.ap .plotv.fail .pred { background: radial-gradient(circle at 50% 45%, #b3261e44, #3a0a06cc 75%), linear-gradient(transparent 45%, #000d); }
.ap .plotv .pagent { position: absolute; left: 3%; bottom: 5%; display: flex; flex-direction: column; align-items: center; gap: 2px; z-index: 2; animation: audup .4s ease-out .3s both; }
.ap .plotv .pagent .plf { width: clamp(84px, 18vw, 170px); aspect-ratio: 1; border-radius: 50%; object-fit: cover; object-position: top; border: 3px solid #e0b04a; box-shadow: 0 0 0 2px #000, 0 6px 20px #000c; background: #1c2129; }
.ap .plotv.fail .pagent .plf { border-color: #c8503a; filter: saturate(.7); }
.ap .plotv .pagent .plf.ic { padding: 14px; box-sizing: border-box; object-fit: contain; }
.ap .plotv .pagent b { font-size: clamp(15px, 2.4vw, 20px); color: #fff; text-shadow: 0 2px 6px #000; }
.ap .plotv .pagent small { font-size: 12px; color: #e8dcc0; text-shadow: 0 1px 4px #000; }
.ap .plotv .pstamp { position: absolute; right: 5%; top: 7%; z-index: 3; width: clamp(120px, 26%, 260px); height: auto; transform: rotate(-12deg); filter: drop-shadow(0 3px 8px #000a); animation: pstamp .5s cubic-bezier(.3, 1.6, .5, 1) .6s both; }
.ap .plotv.fail .pstamp { transform: rotate(8deg); animation-name: pstampf; filter: drop-shadow(0 3px 8px #000c) brightness(1.15); }
@keyframes pstampf { 0% { transform: rotate(8deg) scale(2.6); opacity: 0; } 60% { transform: rotate(8deg) scale(.92); opacity: 1; } 100% { transform: rotate(8deg) scale(1); } }
.ap .plotv .pinfo { position: absolute; left: calc(3% + clamp(84px, 18vw, 170px) + 18px); right: 4%; bottom: 6%; z-index: 2; display: flex; flex-direction: column; align-items: flex-start; gap: 4px; animation: audup .4s ease-out .9s both; }
.ap .plotv .pinfo .fem { width: 34px; height: 34px; } .ap .plotv .pinfo .sowf.big .fem { width: 32px; height: 32px; }
.ap .plotv .pinfo .pact2 { font-size: clamp(14px, 2.2vw, 19px); font-weight: 700; color: #fff; text-shadow: 0 2px 6px #000; }
.ap .plotv .pinfo .paft { font-size: 13px; color: #ffd0c0; background: #3a0a06b0; border: 1px solid #c8503a88; border-radius: 8px; padding: 1px 8px; }
@keyframes pstamp { 0% { transform: rotate(-12deg) scale(2.6); opacity: 0; } 60% { transform: rotate(-12deg) scale(.92); opacity: 1; } 100% { transform: rotate(-12deg) scale(1); } }
@media (max-width: 640px) { .ap .aud .audlord { opacity: .55; right: -10%; } .ap .aud .audsay, .ap .aud .audwhat { max-width: none; } .ap .pact .psay { width: 86%; } }
@media (prefers-reduced-motion: reduce) { .ap .aud *, .ap .pact * { animation: none !important; opacity: 1 !important; } }
`
