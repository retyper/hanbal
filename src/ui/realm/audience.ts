/**
 * 알현 — 남의 나라 군장이 화면 가득 들어와 제 입으로 말한다 (형 10-25: "동맹이나 화친, 조공 이벤트 발생 시 문명에서는
 * 애니메이션이나 대사 이런 것들이 다이나믹하게 오거든? 우리도 그런 거 필요하지 않을까?").
 *
 * 두 자리:
 *   청이 왔다 — 그 나라 대청을 배경으로 군장이 미끄러져 들어오고, 탈(마음)이 붙고, 말이 한 자씩 찍힌다 → 받는다·거절한다 (얻고 잃는 것은 아이콘+숫자)
 *   맺었다·틀어졌다 — 두 군장이 마주 보고 깃발이 부딪힌 뒤 한마디 (화친 · 동맹 · 조공 · 거절)
 * 말은 그 나라 성향(mind)에 따라 다르다 — 욕심 많은 나라는 거들먹거리고, 조심스런 나라는 에둘러 말한다.
 * 같은 청에 같은 말만 나오지 않게 id 로 고른다(결정론 — 다시 불러와도 같은 말).
 */
import type { AskKind, Mind } from '../../realm/types.ts'

type Temper = Exclude<Mind, 'player'>

/** 청을 건 군장의 첫마디 — 갈래 × 성향 */
const ASK_SAY: Readonly<Record<AskKind, Readonly<Record<Temper, readonly string[]>>>> = {
  truce: {
    greedy: ['피는 이만하면 충분히 흘렸소. 칼을 거두고 장터나 엽시다 — 서로 배는 불러야 하지 않겠소?', '싸워서 얻을 게 더 없으니 하는 말이오. 화친합시다. 손해 볼 일은 없을 거요.'],
    cautious: ['우리 두 나라가 서로 피를 흘리면 웃는 것은 남뿐이오. 이쯤에서 칼을 거둡시다.', '백성들이 지쳤소. 서로 치지 않기로 약조하고, 강가에 장터를 엽시다.'],
  },
  alliance: {
    greedy: ['함께라면 저 땅들을 나눠 가질 수 있소. 내 편에 서겠소?', '혼자 먹기엔 판이 크오. 손을 잡읍시다 — 몫은 넉넉히 드리리다.'],
    cautious: ['같은 적을 둔 사이요. 등을 맞대면 누구도 우리를 넘보지 못할 거요.', '오래 지켜보았소. 그대라면 믿고 등을 맡길 만하오. 동맹을 맺읍시다.'],
  },
  trade: {
    greedy: ['우리 창고에 남는 것과 그대 창고에 남는 것을 바꿉시다. 셈은 정확히 하리다.', '좋은 물건이 있소. 값만 맞으면 지금 바로 실어 보내지.'],
    cautious: ['서로 모자란 것을 메우자는 것뿐이오. 억지로 권하지는 않겠소.', '물길이 열려 있을 때 물건을 바꿔 둡시다. 내일 일은 모르니.'],
  },
  tribute: {
    greedy: ['…분하지만 그대의 힘을 인정하오. 이것을 받고 우리를 건드리지 마시오.', '머리를 숙이겠소. 대신 우리 땅에는 발을 들이지 마시오.'],
    cautious: ['우리 같은 작은 나라는 큰 나무 그늘에 기대야 사는 법이오. 해마다 이것을 바치겠소.', '싸우는 것보다 바치는 것이 백성에게 낫소. 받아 주시오.'],
  },
  demand: {
    greedy: ['곡간을 열어라. 바치면 살고, 거절하면 우리 창이 직접 가지러 간다.', '이 땅의 주인이 누구인지 알 때가 됐지. 바칠 것을 바쳐라.'],
    cautious: ['우리를 섭섭하게 하지 마시오. 이것만 보내면 조용히 지나가리다.', '힘이 없는 나라가 버티는 길은 하나뿐이오. 현명하게 고르시오.'],
  },
  joint: {
    greedy: ['저 고을을 같이 칩시다. 무너뜨린 뒤엔 먼저 깃발 꽂는 쪽이 임자요!', '때가 왔소. 두 나라 군사가 함께 들이치면 하루도 못 버틸 거요.'],
    cautious: ['동맹의 약조를 지킬 때요. 저곳을 함께 치면 싸움이 짧게 끝나오.', '혼자 치면 피가 많이 흐르오. 함께 갑시다.'],
  },
  aid: {
    greedy: ['동맹이라면 곳간도 나눠야 하지 않겠소? 조금만 보태 주시오.', '우리 군사가 굶으면 그대의 방패도 얇아지오. 곡식을 보내 주시오.'],
    cautious: ['부끄럽지만 청하오. 올해 흉년이 들어 곳간이 비었소.', '어려울 때 돕는 것이 동맹이라 믿소. 조금만 보태 주시오.'],
  },
}

/** 맺거나 틀어진 뒤의 한마디 */
export type PactKind = 'truce' | 'ally' | 'vassal' | 'refused' | 'gift'
const PACT_SAY: Readonly<Record<PactKind, Readonly<Record<Temper, readonly string[]>>>> = {
  truce: {
    greedy: ['좋소. 오늘부터 우리 사이에 칼은 없소 — 장터에서 봅시다.', '약조했소. 먼저 깨는 쪽이 하늘의 벌을 받을 거요.'],
    cautious: ['이 잔을 비우면 우리 사이에 피는 없소. 오래 가기를 바라오.', '고맙소. 강가의 장터가 붐비는 날이 오래 가길.'],
  },
  ally: {
    greedy: ['이제 그대의 적이 곧 나의 적이오. 나눠 먹을 날을 기다리겠소!', '손을 잡았으니 두려울 게 없소. 함께 크게 먹읍시다.'],
    cautious: ['등을 맡기겠소. 그대도 내게 등을 맡기시오.', '하늘과 땅에 맹세하오. 이 동맹을 먼저 저버리지 않겠소.'],
  },
  vassal: {
    greedy: ['…그대 깃발 아래 서겠소. 대신 약조는 지키시오.', '이제 해마다 그대에게 바치리다. 우리를 지켜 주시오.'],
    cautious: ['큰 나무 그늘에 들었으니 한시름 놓았소. 해마다 잊지 않고 바치리다.', '받아 주어 고맙소. 우리 백성도 이제 두 다리 뻗고 자겠구려.'],
  },
  refused: {
    greedy: ['하! 돌아가 그대 군장에게 전하라 — 어림없다고.', '그 청을 들어줄 까닭이 하나도 없군. 사신은 돌려보내마.'],
    cautious: ['미안하지만 지금은 받아들일 수 없소. 때가 아니오.', '좋은 뜻은 알겠소. 하지만 우리 사정이 허락지 않소.'],
  },
  gift: {
    greedy: ['오, 귀한 것이로군! 그대를 다시 보게 됐소.', '이런 선물이라면 언제든 환영이오.'],
    cautious: ['마음 써 주어 고맙소. 잊지 않으리다.', '귀한 것을 보내 주셨구려. 우리 사이가 한 뼘 가까워졌소.'],
  },
}

/** 고르는 말 — 같은 열쇠면 늘 같은 말 */
function pick(xs: readonly string[], key: string): string {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return xs[h % xs.length] ?? xs[0] ?? ''
}
const temper = (m: Mind | undefined): Temper => (m === 'greedy' ? 'greedy' : 'cautious')

export function askSay(kind: AskKind, mind: Mind | undefined, key: string): string {
  return pick(ASK_SAY[kind][temper(mind)], key)
}
export function pactSay(kind: PactKind, mind: Mind | undefined, key: string): string {
  return pick(PACT_SAY[kind][temper(mind)], key)
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
.ap .aud .audlord { position: absolute; right: 2%; bottom: 0; height: 100%; aspect-ratio: 1; object-fit: cover; object-position: top; -webkit-mask-image: radial-gradient(ellipse 50% 58% at 50% 42%, #000 58%, #0000 100%); mask-image: radial-gradient(ellipse 50% 58% at 50% 42%, #000 58%, #0000 100%); animation: audin .7s cubic-bezier(.2, 1.1, .4, 1) .15s both; }
.ap .aud .audtop { position: absolute; left: 16px; top: 14px; right: 16px; display: flex; align-items: center; gap: 10px; z-index: 2; animation: audup .4s ease-out .3s both; }
.ap .aud .audtop .aqi { width: 34px; height: 34px; } .ap .aud .audtop b { font-size: 15px; color: var(--gold); letter-spacing: .04em; text-shadow: 0 1px 4px #000; }
.ap .aud .audname { position: relative; z-index: 2; display: flex; align-items: center; gap: 8px; margin: 0 16px 6px; animation: audup .4s ease-out .45s both; }
.ap .aud .audname .fem { width: 38px; height: 38px; } .ap .aud .audname b { font-size: clamp(20px, 3.4vw, 28px); text-shadow: 0 2px 8px #000; } .ap .aud .audname span { color: #d9ccb4; font-size: 14px; text-shadow: 0 1px 4px #000; }
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

/* 맺었다 · 틀어졌다 — 두 군장이 마주 본다 */
.ap .pact { position: relative; aspect-ratio: 16 / 9; width: min(100%, calc(62vh * 16 / 9)); align-self: center; border-radius: 16px; overflow: hidden; box-shadow: 0 14px 40px #000c; }
.ap .pact .pactbg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; filter: brightness(.7); animation: audbg 2.4s ease-out both; }
.ap .pact .pl { position: absolute; bottom: 0; height: 82%; aspect-ratio: 1; object-fit: cover; object-position: top; -webkit-mask-image: radial-gradient(ellipse 50% 58% at 50% 42%, #000 58%, #0000 100%); mask-image: radial-gradient(ellipse 50% 58% at 50% 42%, #000 58%, #0000 100%); }
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
@media (max-width: 640px) { .ap .aud .audlord { opacity: .55; right: -10%; } .ap .aud .audsay, .ap .aud .audwhat { max-width: none; } .ap .pact .psay { width: 86%; } }
@media (prefers-reduced-motion: reduce) { .ap .aud *, .ap .pact * { animation: none !important; opacity: 1 !important; } }
`
