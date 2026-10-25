/**
 * 칠십팔국 앱 화면의 옷 (docs/realm/FLOW.md §5) — 모바일 게임처럼: 한 화면에 꽉 · 아래 탭 · 올라오는 판 · 떠 있는 단추.
 * 움직임은 CSS 전환뿐이다 (rAF·타이머 없음 — 절대 규칙 4).
 */
export const APP_CSS = `
html, body { margin: 0; height: 100%; overflow: hidden; background: #17110c; overscroll-behavior: none; }
.ap { --gold: #d9b36a; --ink: #e9e2d4; --mute: #8f887b; --card: #2a1f16; --line: #4d3b26; --good: #8fd07a; --bad: #e08a74;
  --tabh: calc(62px + env(safe-area-inset-bottom)); --toph: calc(48px + env(safe-area-inset-top)); --legh: 34px;
  /* 글꼴 셋 (public/fonts — 자체 호스팅, 기기마다 같게): 본문 고운돋움 · 제목 고운바탕 · 큰 의식 글자(계절·싸움 이름·첫 화면) 송명.
     조각에 없는 글자는 다음 글꼴로 넘어가니 깨지지 않는다 */
  --body: 'Gowun Dodum', system-ui, -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;
  --serif: 'Gowun Batang', 'Apple SD Gothic Neo', 'Batang', serif;
  --display: 'Song Myung', 'Gowun Batang', 'Batang', serif;
  position: fixed; inset: 0; color: var(--ink); font: 15px/1.45 var(--body);
  -webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-select: none;
  /* 꾹 누르면 설명이 뜬다 — 글이 골라지거나 아이폰의 복사 메뉴가 뜨지 않게 (형 10-23: "꾹 누르고 있으면 텍스트 선택돼 버림") */
  -webkit-touch-callout: none; }
.ap input, .ap textarea { user-select: text; -webkit-user-select: text; }
/* 그림은 마우스를 받지 않는다 — 누르는 건 늘 감싼 단추·칸이다. 브라우저 확장(포토샵 등)이 그림마다 띄우는 단추도 이걸로 안 뜬다 (형: "ps 버튼 뜨는게 짜증남") */
.ap img { pointer-events: none; -webkit-user-drag: none; }
.ap button, .ap input, .ap select, .ap textarea { font-family: inherit; }
.ap h1, .ap h2, .ap h3, .ap .top b, .ap .next, .ap .brag { font-family: var(--serif); }
.ap h3 { margin: 4px 0 10px; font-size: 19px; color: var(--gold); } .ap h4 { margin: 14px 0 6px; font-size: 14px; color: var(--mute); font-weight: 600; }
.ap p { margin: 6px 0; } .ap .mute { color: var(--mute); font-size: 13px; }
.ap img.ic { width: 22px; height: 22px; vertical-align: -6px; margin-right: 2px; }
.ap img.em { width: 20px; height: 20px; vertical-align: -5px; margin-right: 4px; }

/* 위 상태 줄 */
.ap .top { position: absolute; left: 0; right: 0; top: 0; height: var(--toph); padding: env(safe-area-inset-top) 10px 0; box-sizing: border-box;
  display: flex; align-items: center; justify-content: space-between; gap: 8px; z-index: 5;
  background: linear-gradient(#120d09f0, #120d09c0); border-bottom: 1px solid #3a2c1e; }
.ap .top .tl { display: flex; align-items: center; gap: 6px; font-size: 16px; white-space: nowrap; }
.ap .top img.sic { width: 30px; height: 30px; }
.ap .top .tr { display: flex; align-items: center; gap: 10px; overflow: hidden; }
.ap .top .stat { display: flex; align-items: center; gap: 2px; font-size: 15px; white-space: nowrap; }
.ap .top .stat b { font-family: 'Bahnschrift', 'Barlow Condensed', system-ui, sans-serif; font-variant-numeric: tabular-nums; }
@media (max-width: 520px) { .ap .top .stat.nat b { display: none; } .ap .top .tr { gap: 6px; } }

/* 지도 — 남은 자리를 꽉. 폰 세로에서는 옆으로 민다 */
.ap .mapwrap { position: absolute; left: 0; right: 0; top: calc(var(--toph) + var(--legh)); bottom: var(--tabh); overflow: auto;
  background: #221d1a; scrollbar-width: none; touch-action: pan-x pan-y; cursor: grab; }
.ap .mapwrap.dragging { cursor: grabbing; }
/* 확대·축소 단추 — 지도 왼쪽 아래 */
.ap .zbtns { position: absolute; left: 12px; bottom: calc(var(--tabh) + 14px); z-index: 6; display: flex; flex-direction: column; gap: 6px; }
.ap .zbtns button { width: 42px; height: 42px; border-radius: 12px; border: 1px solid #6a5236; background: #1f1710e6; color: var(--ink);
  font-size: 22px; cursor: pointer; box-shadow: 0 4px 10px #0008; }
.ap.sheet-open .zbtns, .ap.choosing .zbtns { display: none; }
.ap .mapwrap::-webkit-scrollbar { display: none; }

/* 깃발 줄 — 지도 왼쪽 위에 떠 있다. 누르면 그 나라 땅만 또렷하다 */
.ap .legend { position: absolute; left: 0; right: 0; top: var(--toph); height: var(--legh); box-sizing: border-box; z-index: 4; display: flex;
  align-items: center; gap: 4px; padding: 0 8px; overflow-x: auto; scrollbar-width: none; background: #120d09; border-bottom: 1px solid #3a2c1e; }
.ap .legend::-webkit-scrollbar { display: none; } .ap .legend .lg { pointer-events: auto; flex: none; }
.ap .lg { display: flex; align-items: center; gap: 4px; padding: 2px 8px 2px 3px; border-radius: 16px; border: 1px solid #0006;
  background: color-mix(in srgb, var(--c) 30%, #17110ce0); color: #fff; font: inherit; font-size: 12px; cursor: pointer;
  box-shadow: 0 2px 6px #0007; border-left: 5px solid var(--c); }
.ap .lg img.lem { width: 22px; height: 22px; } .ap .lg b { font-size: 14px; min-width: 1em; }
.ap .lg span { display: none; } .ap .lg.on span, .ap .lg.me span { display: inline; }
.ap .lg.on { border-color: #fff; background: color-mix(in srgb, var(--c) 55%, #17110c); }
.ap .lg.gone { opacity: .45; }
/* 우리와 싸우는 나라 — 붉은 테 · 칼 · 이름도 늘 보인다 */
.ap .lg.war { border: 2px solid #e0503a; box-shadow: 0 0 8px #e0503a99; position: relative; }
.ap .lg.war span { display: inline; }
.ap .lg .lgwar { font-style: normal; font-size: 13px; color: #ffb09a; margin-left: 2px; }
.ap .lg.ally { border: 2px solid #6ac06a; box-shadow: 0 0 8px #6ac06a99; }
.ap .lg.ally span { display: inline; }
.ap .lg .lgally { font-style: normal; font-size: 11px; color: #14200f; background: #8fd07a; border-radius: 6px; padding: 0 4px; margin-left: 2px; }
.ap .lg.truce { border: 1.5px dashed #b8d0a0; }
.ap.sheet-open .legend { opacity: .3; pointer-events: none; }
@media (min-width: 700px) { .ap .lg span { display: inline; } }

/* 다음 계절 */
.ap .next { position: absolute; right: 14px; bottom: calc(var(--tabh) + 14px); z-index: 6; padding: 12px 20px; border-radius: 28px;
  border: 1px solid #f0d08a; background: linear-gradient(#b8893a, #8a6224); color: #fff6df; font-size: 17px; font-weight: 700;
  box-shadow: 0 6px 16px #000a, inset 0 1px 0 #ffe3a0; cursor: pointer; }
.ap .next span { font-size: 20px; margin-left: 4px; }
.ap .next:active { transform: translateY(1px); filter: brightness(.95); }
.ap.sheet-open .next { opacity: 0; pointer-events: none; }

/* 아래 탭 */
.ap .tabs { position: absolute; left: 0; right: 0; bottom: 0; height: var(--tabh); padding-bottom: env(safe-area-inset-bottom); box-sizing: border-box;
  display: flex; background: #120d09; border-top: 1px solid #3a2c1e; z-index: 8; }
.ap .tabs button { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; border: 0;
  background: none; color: var(--mute); font: inherit; font-size: 12px; cursor: pointer; }
.ap .tabs button img.tic { width: 32px; height: 32px; opacity: .75; filter: grayscale(.4); }
.ap .tabs button.on { color: var(--gold); } .ap .tabs button.on img.tic { opacity: 1; filter: none; transform: translateY(-2px); }
.ap .tabs button { position: relative; } .ap .tabs .dot { position: absolute; top: 5px; right: calc(50% - 22px); width: 10px; height: 10px; border-radius: 50%; background: #e0402a; box-shadow: 0 0 0 2px var(--bg, #14161a); }
.ap .newb { display: inline-block; margin-top: 2px; padding: 1px 7px; border-radius: 9px; background: #3f8f3a; color: #fff; font-size: 11.5px; font-weight: 700; }

/* 올라오는 판 */
.ap .back { position: absolute; inset: 0; bottom: var(--tabh); background: #0007; opacity: 0; pointer-events: none; transition: opacity .2s; z-index: 6; }
.ap.sheet-open .back { opacity: 1; pointer-events: auto; }
.ap .sheet { position: absolute; left: 0; right: 0; bottom: var(--tabh); max-height: 72%; overflow-y: auto; overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch; background: #1f1710; border-radius: 18px 18px 0 0; border-top: 1px solid #54412a;
  padding: 0 14px 18px; box-sizing: border-box; z-index: 7; transform: translateY(105%); transition: transform .22s ease-out;
  box-shadow: 0 -8px 24px #0009; }
.ap.sheet-open .sheet { transform: none; }
.ap:not(.sheet-open) .sheet { visibility: hidden; transition: transform .22s ease-out, visibility 0s .22s; }
@media (min-width: 900px) { .ap .sheet { left: auto; right: 12px; width: 440px; bottom: calc(var(--tabh) + 8px); border-radius: 16px; max-height: calc(100% - var(--tabh) - var(--toph) - 20px); } }
.ap .grip { position: sticky; top: 0; height: 22px; margin: 0 -14px 4px; background: #1f1710; cursor: pointer; z-index: 1; }
.ap .grip::after { content: ''; position: absolute; left: 50%; top: 9px; width: 42px; height: 4px; margin-left: -21px; border-radius: 2px; background: #6a5236; }

/* 판 안의 것들 */
.ap .btn { display: inline-flex; align-items: center; gap: 4px; padding: 7px 12px; border-radius: 10px; border: 1px solid #6a5236; background: #3a2c1e;
  color: var(--ink); font: inherit; font-size: 14px; cursor: pointer; text-decoration: none; }
.ap .btn.pri { background: linear-gradient(#a57a31, #7d5a22); border-color: #e0bd78; color: #fff4dc; }
.ap .btn.on { border-color: #e0bd78; color: #ffe2a0; box-shadow: 0 0 0 1px #e0bd78; }
.ap .btn.ghost { background: transparent; color: var(--mute); } .ap .btn:disabled { opacity: .4; cursor: default; }
.ap .btn.sm { padding: 3px 9px; font-size: 13px; margin-left: auto; } .ap .btn.wide { width: 100%; justify-content: center; margin-top: 10px; padding: 11px; }
.ap .btns { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.ap .btns.dis { justify-content: flex-end; margin-top: 14px; padding-top: 8px; border-top: 1px dashed #4a3a28; }
.ap .menu3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 10px; } .ap .menu3 .btn { margin: 0; display: flex; justify-content: center; align-items: center; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ap .banner { display: flex; align-items: center; gap: 8px; padding: 8px 10px; margin: 6px 0; border-radius: 10px; background: #30241a; font-size: 14px; }
.ap .banner.good { background: #24331f; color: #cfeabf; } .ap .banner.bad { background: #3a2622; color: #f1c6b8; }
.ap .acard, .ap .ncard, .ap .fcard { display: flex; gap: 10px; padding: 10px; margin: 8px 0; border-radius: 14px; background: var(--card); border: 1px solid var(--line); }
.ap .ncard, .ap .fcard { flex-direction: column; gap: 6px; }
.ap .acard .ab { flex: 1; min-width: 0; }
.ap .seasonfx { position: absolute; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center; pointer-events: none;
  background: #000a; animation: sfx 2.6s ease-out forwards; }
/* 띠 — 그림이 띠 가득, 위아래 금선 테, 천천히 다가온다 */
.ap .seasonfx .band { position: absolute; left: 0; right: 0; top: 50%; height: min(62vh, 440px); transform: translateY(-50%); overflow: hidden;
  border-top: 2px solid #c9a45a; border-bottom: 2px solid #c9a45a; box-shadow: 0 0 0 1px #000, 0 -6px 0 -4px #8a6a3a, 0 6px 0 -4px #8a6a3a, 0 20px 50px #000c;
  animation: sfxband 2.6s cubic-bezier(.2, .8, .3, 1) forwards; }
.ap .seasonfx .bimg { position: absolute; inset: -4%; background: #17110c center / cover no-repeat; animation: sfxpan 2.6s ease-out forwards; }
.ap .seasonfx .band::after { content: ''; position: absolute; inset: 0; background: linear-gradient(#0000 40%, #0008 72%, #000c); }
@keyframes sfxpan { from { transform: scale(1.12) translateX(-1.5%); } to { transform: scale(1) translateX(1.5%); } }
/* 글 — 상자 없이 그림 아래쪽 어둠 위에 · 금빛 붓글씨 · 위아래 장식 줄 */
.ap .seasonfx > .stxt { position: absolute; left: 0; right: 0; bottom: calc(50% - min(31vh, 220px) + 16px); display: flex; flex-direction: column; align-items: center; gap: 2px;
  text-align: center; animation: sfxin 1.8s cubic-bezier(.2, 1.3, .4, 1) forwards; }
.ap .seasonfx b { font-family: var(--display); font-weight: 400; font-size: clamp(34px, 6vw, 56px); color: var(--gold); letter-spacing: 4px; line-height: 1.05;
  text-shadow: 0 2px 0 #000, 0 0 18px #000, 0 0 30px #0009; }
.ap .seasonfx span { font-size: clamp(13px, 2vw, 16px); color: #f3e8d2; text-shadow: 0 1px 3px #000, 0 0 10px #000; }
.ap .seasonfx img.sfx-ic { width: 46px; height: 46px; filter: drop-shadow(0 2px 6px #000); }
.ap .seasonfx .orn { display: block; width: min(56vw, 320px); height: 9px; background: linear-gradient(90deg, #0000, #c9a45a 30%, #f6d27a 50%, #c9a45a 70%, #0000) center / 100% 1px no-repeat;
  position: relative; } .ap .seasonfx .orn::after { content: '◆'; position: absolute; left: 50%; top: 50%; transform: translate(-50%, -52%); font-size: 9px; color: #f6d27a; text-shadow: 0 0 4px #000; }
.ap .seasonfx.spring b { color: #f2b8c6; } .ap .seasonfx.summer b { color: #9fd18b; } .ap .seasonfx.autumn b { color: #f0b060; } .ap .seasonfx.winter b { color: #cfe3f5; }
@keyframes sfx { 0% { opacity: 0; } 12% { opacity: 1; } 70% { opacity: 1; } 100% { opacity: 0; } }
/* 신방 — 붉은 등불 · 비단 휘장 · 은은히 일렁이는 불빛 */
.ap .honey { position: relative; overflow: hidden; display: flex; flex-direction: column; align-items: center; gap: 3px; margin: 8px 0; padding: 14px 12px 12px; border-radius: 16px; text-align: center;
  background: linear-gradient(#2a0a12cc, #3a0c18aa 45%, #1a0608ee), var(--hbg) center 40% / cover; border: 1px solid #c86a7a; box-shadow: inset 0 0 40px #ff6a7a33, 0 4px 18px #000a; }
.ap .honey::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse at 30% 20%, #ffb07055, #0000 50%), radial-gradient(ellipse at 75% 25%, #ff7a8a44, #0000 45%);
  animation: hflick 2.8s ease-in-out infinite alternate; pointer-events: none; }
@keyframes hflick { from { opacity: .6; } 40% { opacity: 1; } 70% { opacity: .75; } to { opacity: .95; } }
.ap .honey .hfaces { position: relative; display: flex; } .ap .honey .hf { width: 54px; height: 54px; border-radius: 50%; object-fit: cover; border: 2px solid #f0a0b0; box-shadow: 0 0 12px #ff8a9a88; }
.ap .honey .hf + .hf { margin-left: -12px; }
.ap .honey b { position: relative; font-family: var(--display); font-weight: 400; font-size: 22px; color: #ffd0d8; letter-spacing: 2px; text-shadow: 0 0 10px #ff6a8a99, 0 2px 4px #000; }
.ap .honey span { position: relative; font-size: 14px; color: #f8e0e4; } .ap .honey small { position: relative; font-size: 12px; color: #e8b8c0; }
@media (prefers-reduced-motion: reduce) { .ap .honey::before { animation: none; } }
.ap .honey .bridal-go { position: relative; margin: 4px 0 2px; border-color: #f0a0b0aa; color: #ffe0e6; background: linear-gradient(#5a2a3acc, #2a1218cc); box-shadow: 0 0 12px #ff8a9a55; }
/* 신방을 살펴본다 — 넉 장이 천천히 밀리며 넘어간다 (켄 번스) · 등잔빛 너울 · 마지막 장은 남는다 */
.ap .cere.bridal { background: #070405; justify-content: flex-start; padding-top: max(18px, env(safe-area-inset-top)); }
.ap .cere.bridal .bpic { position: absolute; inset: -9%; background: var(--hbg) center / cover no-repeat; opacity: 0; animation: bpin 1.4s ease-in-out calc(var(--i) * var(--s)) both, bkb calc(var(--s) + 1.6s) ease-out calc(var(--i) * var(--s)) both; }
@media (orientation: portrait) { .ap .cere.bridal .bpic { background-image: var(--vbg, var(--hbg)); } }
.ap .cere.bridal .bpic.odd { animation-name: bpin, bkb2; }
.ap .cere.bridal .bpic:nth-of-type(4) { inset: -2% -4% 0; background-position: center 100%; transform-origin: 50% 100%; } /* 댓돌 위 신 — 그림 맨 아래가 잘리지 않게 */
.ap .cere.bridal .bveil { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(ellipse 70% 60% at 50% 42%, #0000 40%, #0a0406cc 100%), linear-gradient(#0a0406cc, #0000 30%, #0000 85%, #0a040699); }
.ap .cere.bridal .bcap { position: absolute; left: 0; right: 0; top: calc(max(18px, env(safe-area-inset-top)) + 70px); z-index: 1; text-align: center; font-family: var(--display); font-size: clamp(22px, 6vw, 34px); letter-spacing: 3px; color: #ffe8d6; text-shadow: 0 0 18px #ff9a6a99, 0 2px 6px #000;
  opacity: 0; animation: bcap var(--s) ease-in-out calc(var(--i) * var(--s) + .5s) both; }
.ap .cere.bridal .bcap:last-of-type { animation-fill-mode: backwards; }
.ap .cere.bridal .bmote { position: absolute; inset: 0; pointer-events: none; }
.ap .cere.bridal .bmote i { position: absolute; bottom: -8px; left: var(--x); width: 4px; height: 4px; border-radius: 50%; background: radial-gradient(circle, #fff2d8, #ffb07a 60%, #0000 72%); animation: hmote var(--sp) linear var(--t) infinite; }
.ap .cere.bridal .bpair { position: relative; z-index: 2; display: flex; align-items: center; gap: 10px; padding: 6px 14px; animation: bpin .8s ease-out .6s both; }
.ap .cere.bridal .bpair .cf { width: 46px; height: 46px; border-radius: 50%; object-fit: cover; border: 2px solid #f0a0b0; }
.ap .cere.bridal .bpair b { font-size: 15px; color: #ffe0e6; text-shadow: 0 1px 4px #000; }
.ap .cere.bridal .bskip { position: absolute; z-index: 2; bottom: max(10px, env(safe-area-inset-bottom)); left: 0; right: 0; text-align: center; font-size: 12px; color: #e8c0c8aa; }
@keyframes bpin { from { opacity: 0; } to { opacity: 1; } }
@keyframes bkb { from { transform: scale(1.02) translate(-1%, 1%); } to { transform: scale(1.12) translate(1.5%, -1%); } }
@keyframes bkb2 { from { transform: scale(1.1) translate(1.5%, 0); } to { transform: scale(1.02); } }
@keyframes bcap { 0% { opacity: 0; transform: translateY(8px); } 18%, 78% { opacity: 1; transform: none; } 100% { opacity: 0; } }
@keyframes bflick { from { opacity: .92; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .ap .cere.bridal .bpic { animation: bpin .01s calc(var(--i) * var(--s)) both; } .ap .cere.bridal .bveil, .ap .cere.bridal .bmote { animation: none; } }
/* 혼례 · 탄생 — 한 장면씩 판 전체 */
.ap .cere { position: absolute; inset: 0; z-index: 75; overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; cursor: pointer;
  background: #000; animation: cin .6s ease-out both; }
.ap .cere.out { animation: cout .45s ease-in forwards; }
/* 등용 — 하얀 번쩍 → 특성 빛 → 큰 얼굴이 떠오른다 · 이름 · 「주군을 모시겠습니다」 · 특성이 하나씩 */
.ap .cere.hire { background: radial-gradient(ellipse at 50% 40%, color-mix(in srgb, var(--gc) 40%, #0000) 0, #0000 62%), #0b0907; }
.ap .cere.hire .cflash { position: absolute; inset: 0; background: #fff; opacity: 0; animation: hflash .9s ease-out 1.48s forwards; z-index: 5; pointer-events: none; }
@keyframes hflash { 0% { opacity: 1; } 35% { opacity: .85; } 100% { opacity: 0; } }
.ap .cere.hire .cglow { position: absolute; left: 50%; top: 40%; width: min(120vw, 900px); aspect-ratio: 1; transform: translate(-50%, -50%); border-radius: 50%;
  background: radial-gradient(circle, color-mix(in srgb, var(--gc) 55%, #fff0) 0, #0000 60%); animation: hglow 3.2s ease-in-out infinite alternate; pointer-events: none; }
@keyframes hglow { from { opacity: .55; transform: translate(-50%, -50%) scale(.92); } to { opacity: .95; transform: translate(-50%, -50%) scale(1.05); } }
.ap .cere.hire .cmote i { position: absolute; bottom: -10px; left: var(--x); width: 5px; height: 5px; border-radius: 50%; background: radial-gradient(circle, #fff8e0, var(--gc) 60%, #0000 72%);
  opacity: 0; animation: hmote var(--sp) linear var(--t) infinite; }
@keyframes hmote { 0% { opacity: 0; transform: translateY(0); } 15% { opacity: .9; } 100% { opacity: 0; transform: translateY(-80vh); } }
/* 화면 절반쯤 — 컷인 띠 셋(촥·촥·촥) 뒤 1.12초에 펑 하고 액자 속 얼굴이 다 드러난다 */
/* 액자 창(그림 자리)이 곧 .hframe — 액자(frame-hire.png 900×921, 창 193~707 × 222~736)는 그 둘레로 넘친다 */
.ap .cere.hire .hframe { --hw: min(52vw, 31vh); --hin: 0%; position: relative; z-index: 1; width: var(--hw); aspect-ratio: 1; margin: calc(var(--hw) * .43) 0 calc(var(--hw) * .36); }
.ap .cere.hire .hframe .hbust { position: absolute; inset: var(--hin, 9%); width: calc(100% - 2 * var(--hin, 9%)); height: calc(100% - 2 * var(--hin, 9%)); object-fit: cover; border-radius: 4px;
  box-shadow: 0 0 50px var(--gc), 0 14px 34px #000c; opacity: 0; animation: hpop .6s cubic-bezier(.2, 1.3, .35, 1) 1.48s both; }
.ap .cere.hire .hframe .hfr { position: absolute; left: -37.5%; top: -43.2%; width: 175.1%; height: 179.2%; background: url(__ART__ui/frame-hire.png) center / 100% 100% no-repeat; filter: drop-shadow(0 6px 14px #000d) drop-shadow(0 0 18px color-mix(in srgb, var(--gc) 45%, #0000));
  opacity: 0; animation: hpop .6s cubic-bezier(.2, 1.3, .35, 1) 1.48s both; }
/* 컷인 — 사선 띠 셋이 **하나씩 차례로**(0.10 · 0.56 · 1.02초): 띠 하나가 들어와 머물다, 다음 띠가 들어올 때 빠진다 (형 10-24: "셋이 동시에가 아니라 하나씩 보였다 바뀌었다").
   띠마다 그림의 한 곳을 크게(너무 크지 않게 — 형 10-24: "너무 많이 확대") · 하얀 테 · 들어오며 번쩍 · 안에서 천천히 밀린다. 1.48초에 펑 — 액자 속 얼굴 */
.ap .cere.hire .hbands { position: absolute; inset: 0; z-index: 4; pointer-events: none; overflow: hidden; }
.ap .cere.hire .hb { --w: max(44vw, 40vh); position: absolute; top: -12%; height: 124%; width: var(--w); min-width: 190px; overflow: hidden; transform: skewX(-16deg);
  border-left: 5px solid #fff; border-right: 5px solid #fff; box-shadow: 0 0 26px #fff9, 0 0 60px var(--gc); background: #000;
  opacity: 0; animation: hbin .26s cubic-bezier(.15, 1, .3, 1) var(--bd) both, hbout .2s cubic-bezier(.5, 0, .9, .4) var(--bo) forwards; }
/* 띠 속 그림 — 그림의 한 점(--cx --cy, 0~1)을 띠 한가운데에, 크기 --s 로. % 위치로는 그림이 띠보다 조금만 커서 셋이 다 같은 데를 비췄다 (형 10-24) */
.ap .cere.hire .hb > i { position: absolute; width: var(--s); height: var(--s); left: calc(50% - var(--cx) * var(--s)); top: calc(50% - var(--cy) * var(--s)); background-repeat: no-repeat; background-size: 100% 100%;
  transform: skewX(16deg); animation: hbpan 1.3s ease-out var(--bd) both; }
/* 띠 하나 — 화면 자리(left) · 들어오는 쪽(--from) · 그림의 어느 점을(--cx --cy) 얼마나 크게(--s) */
.ap .cere.hire { animation-duration: .12s; }
/* 띠마다 그림의 옆 소품(무기·손 쪽) → 반대 옆(머리·어깨 장신구) → 눈빛 */
/* 띠마다 다른 곳 — 손·무기(왼쪽 아래) → 어깨·장신구(오른쪽) → 마지막은 얼굴 */
/* 그림 크기는 띠 너비에 맞춘다 — 화면 높이로 정하면 세로 폰에서 얼굴이 띠 몇 개 너비라 귀만 보였다 (형 10-24: 견지 별이) */
.ap .cere.hire .hb.b1 { --bd: .10s; --bo: .56s; left: 6vw; --from: -110%; --cx: .26; --cy: .80; --s: max(calc(2.1 * var(--w)), 130vh); }
.ap .cere.hire .hb.b2 { --bd: .56s; --bo: 1.02s; left: 50vw; --from: 110%; --cx: .76; --cy: .60; --s: max(calc(2.1 * var(--w)), 130vh); }
.ap .cere.hire .hb.b3 { --bd: 1.02s; --bo: 1.48s; left: 28vw; --from: -110%; --cx: .50; --cy: .32; --s: max(calc(2.6 * var(--w)), 140vh); }
/* 세로 화면 — 띠가 넓으니 가운데로 */
@media (orientation: portrait) { .ap .cere.hire .hb.b1, .ap .cere.hire .hb.b2, .ap .cere.hire .hb.b3 { left: calc(50% - var(--w) / 2); } }
@keyframes hbin { 0% { opacity: 1; transform: skewX(-16deg) translateY(var(--from)); filter: brightness(3); } 70% { filter: brightness(1.4); } 100% { opacity: 1; transform: skewX(-16deg); filter: none; } }
@keyframes hbout { to { opacity: 0; transform: skewX(-16deg) scale(1.6, 1.15); filter: brightness(2.5); } }
@keyframes hbpan { from { transform: skewX(16deg) scale(1.12); } to { transform: skewX(16deg) scale(1); } }
@keyframes hpop { 0% { opacity: 0; transform: scale(1.18); filter: brightness(2.6); } 45% { opacity: 1; } 100% { opacity: 1; transform: none; filter: none; } }
@keyframes hrise { 0% { opacity: 0; transform: scale(.82) translateY(18px); filter: brightness(3) blur(10px); } 60% { opacity: 1; filter: brightness(1.2) blur(0); } 100% { opacity: 1; transform: none; filter: none; } }
.ap .cere.hire .cw { animation-delay: 1.86s; } .ap .cere.hire .cw > b { color: #fff4d8; text-shadow: 0 0 22px var(--gc), 0 3px 6px #000; }
.ap .cere.hire .hname { font-size: clamp(22px, 6vw, 30px); font-weight: 800; color: #fff; text-shadow: 0 2px 8px #000; }
.ap .cere.hire em { font-style: normal; font-family: var(--display); font-size: clamp(18px, 5vw, 24px); color: #ffe6b0; text-shadow: 0 2px 8px #000; opacity: 0; animation: wrin .6s ease-out 2.26s both; }
.ap .cere.hire .ctr { border-color: var(--g); opacity: 0; animation: wrin .4s ease-out both; }
@media (prefers-reduced-motion: reduce) { .ap .cere.hire .cflash, .ap .cere.hire .cmote, .ap .cere.hire .cglow, .ap .cere.hire .hbands { display: none; } }
@keyframes cin { from { opacity: 0; } to { opacity: 1; } } @keyframes cout { to { opacity: 0; } }
.ap .cere .cbg { position: absolute; inset: -3%; background: var(--hbg) center / cover no-repeat; filter: brightness(.55); animation: cbgz 7s ease-out both; }
@media (orientation: portrait) { .ap .cere .cbg { background-image: var(--vbg, var(--hbg)); } }
@keyframes cbgz { from { transform: scale(1.12); } to { transform: scale(1); } }
.ap .cere.wed .cbg { filter: brightness(.5) saturate(1.1) sepia(.15); }
.ap .cere.wed::after { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 45%, #ff8a9a22, #2a061088 75%); pointer-events: none; }
.ap .cere .cpair { position: relative; z-index: 1; display: flex; gap: 6px; }
.ap .cere .cpair > div { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.ap .cere .cl { animation: cpl 1.1s cubic-bezier(.2, 1.1, .4, 1) .2s both; } .ap .cere .cr { animation: cpr 1.1s cubic-bezier(.2, 1.1, .4, 1) .2s both; }
@keyframes cpl { from { opacity: 0; transform: translateX(-30vw); } to { opacity: 1; transform: none; } }
@keyframes cpr { from { opacity: 0; transform: translateX(30vw); } to { opacity: 1; transform: none; } }
.ap .cere .cf { width: clamp(96px, 28vw, 160px); height: auto; aspect-ratio: 1; border-radius: 50%; object-fit: cover; border: 3px solid #f0c8a0; box-shadow: 0 0 22px #ffb08099, 0 8px 24px #000c; }
.ap .cere .cpair b { color: #fff; font-size: 16px; text-shadow: 0 2px 6px #000; }
.ap .cere .cw { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; padding: 0 16px; animation: wrin .7s ease-out .9s both; }
.ap .cere .cw > b { font-family: var(--display); font-weight: 400; font-size: clamp(44px, 13vw, 76px); letter-spacing: 6px; color: #ffe0c0; text-shadow: 0 0 22px #ff9a7a, 0 3px 6px #000; }
.ap .cere.birth .cw > b { color: #fff0c0; text-shadow: 0 0 26px #f6d27a, 0 3px 6px #000; }
.ap .cere .cw span { font-size: clamp(15px, 4vw, 19px); color: #fff; text-shadow: 0 1px 5px #000; } .ap .cere .cw small { font-size: 13px; color: #f0d8c8; }
.ap .cere .cpet { position: absolute; inset: 0; pointer-events: none; }
.ap .cere .cpet i { position: absolute; top: -4%; left: var(--x); width: 11px; height: 8px; border-radius: 60% 0 60% 0; background: linear-gradient(135deg, #ffd6e0, #f08aa0); opacity: 0;
  animation: cpetal var(--sp) linear var(--t) infinite; }
@keyframes cpetal { 0% { opacity: 0; transform: translate(0, 0) rotate(0); } 10% { opacity: .95; } 100% { opacity: 0; transform: translate(-50px, 108vh) rotate(420deg); } }
.ap .cere .cglow { position: absolute; left: 50%; top: 42%; width: 70vmin; height: 70vmin; margin: -35vmin 0 0 -35vmin; border-radius: 50%;
  background: radial-gradient(circle, #fff4c8cc, #f6d27a55 35%, #0000 70%); animation: cglow 2.4s ease-out both, cpulse 2.6s ease-in-out 2.4s infinite alternate; }
@keyframes cglow { from { opacity: 0; transform: scale(.2); } to { opacity: 1; transform: none; } } @keyframes cpulse { to { opacity: .7; transform: scale(.94); } }
.ap .cere .ckid { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; animation: ckid 1.4s cubic-bezier(.2, 1.3, .4, 1) .5s both; }
@keyframes ckid { from { opacity: 0; transform: scale(.4); filter: brightness(3); } to { opacity: 1; transform: none; filter: none; } }
.ap .cere .cf.big { width: clamp(130px, 38vw, 210px); border-color: #f6d27a; box-shadow: 0 0 30px #f6d27acc, 0 10px 30px #000c; }
.ap .cere .cpar { display: flex; gap: 8px; margin-top: -18px; } .ap .cere .cf.sm { width: 46px; border-width: 2px; }
.ap .cere .ctrs { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; margin-top: 6px; }
.ap .cere .ctr { padding: 3px 10px; border-radius: 999px; background: #1a120ccc; border: 1px solid #c8a060; color: #f6e6c0; font-size: 13px; opacity: 0; animation: wrin .5s ease-out both; }
.ap .cere .ctr:nth-child(1) { animation-delay: 1.5s; } .ap .cere .ctr:nth-child(2) { animation-delay: 1.8s; } .ap .cere .ctr:nth-child(3) { animation-delay: 2.1s; } .ap .cere .ctr:nth-child(4) { animation-delay: 2.4s; }
.ap .cere .ctr.new { border-color: #ffd27a; color: #fff2c0; box-shadow: 0 0 14px #ffd27aaa; }
/* 특성 칩 — 누르고 있거나 올려 두면 설명 (tips.ts) · 그동안 장면이 닫히지 않는다 */
.ap .cere .ctr[data-tip] { cursor: help; -webkit-user-select: none; user-select: none; }
/* 사로잡음 — 뒤 그림을 어둡게 깔고 액자 위에 밧줄 · 잡혔을 땐 붉고 흐리게 (형 10-24) */
.ap .cere.capt .cbg { opacity: .42; filter: saturate(.8); }
.ap .cere.capt.lost .cbg { filter: grayscale(.45) brightness(.8); }
.ap .cere.capt.lost .hframe .hbust { filter: grayscale(.35); }
/* 옥 — 쇠띠 두른 나무 옥문 틀(fx/jail-frame.png) · 얼굴이 드러나면 쇠창살(fx/jail-bars.png)이 위 들보 속에서 내려와 철컹 닫힌다 (captSlamMs 와 같은 때 · 형 10-25: "철창 이미지랑 감옥 테두리는 제미나이로 따로") */
.ap .cere.capt .hframe .hbust { box-shadow: 0 0 30px #000, 0 14px 34px #000c; border-radius: 2px; }
/* 틀 그림의 빈 칸은 가로·세로 62.5% (그림 640 의 120~520) — 그 칸이 얼굴 판에 맞도록 둘레로 30% 씩 */
.ap .cere.capt .jail { position: absolute; left: -30%; top: -30%; width: 160%; height: 160%; z-index: 4; pointer-events: none;
  background: url(__ART__fx/jail-frame.png) center / 100% 100% no-repeat; filter: drop-shadow(0 12px 24px #000d);
  opacity: 0; animation: hpop .5s ease-out 1.48s both; }
.ap .cere.capt .jbars { position: absolute; inset: 0; z-index: 3; pointer-events: none; overflow: hidden; }
.ap .cere.capt .jbars b { position: absolute; inset: 0; background: url(__ART__fx/jail-bars.png) center / 100% 100% no-repeat; filter: drop-shadow(4px 6px 6px #000c);
  transform: translateY(-104%); animation: jdrop .34s cubic-bezier(.55, 0, .9, .45) 2.18s forwards, jbounce .3s ease-out 2.52s; }
@keyframes jdrop { to { transform: translateY(0); } }
@keyframes jbounce { 0% { transform: translateY(0); } 35% { transform: translateY(-5%); } 65% { transform: translateY(0); } 82% { transform: translateY(-1.5%); } 100% { transform: translateY(0); } }
@media (prefers-reduced-motion: reduce) { .ap .cere.capt .jbars b { animation: none; transform: none; } }
/* 확인 — 글 맨 아래 · 얼굴이 다 드러난 뒤 나타난다 */
.ap .cere .cok { position: relative; z-index: 8; margin-top: 6px; min-width: 140px; padding: 11px 28px; font-size: 16px; pointer-events: auto; justify-content: center; text-align: center; line-height: 1.2; /* 글자가 왼쪽에 붙고 오른쪽이 비었다 (형 10-25) */
  opacity: 0; animation: cokin .4s ease-out 2.2s both; }
@keyframes cokin { from { opacity: 0; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .ap .cere *, .ap .cere { animation-duration: .01s !important; animation-delay: 0s !important; } }
@keyframes sfxband { 0% { transform: translateY(-50%) scale(1.06); } 100% { transform: translateY(-50%) scale(1); } }
@keyframes sfxin { 0% { transform: scale(.7) translateY(16px); } 25% { transform: scale(1) translateY(0); } 100% { transform: scale(1.04); } }
@media (prefers-reduced-motion: reduce) { .ap .seasonfx, .ap .seasonfx > div { animation-duration: .8s; } }
.ap p.src { font-size: 12px; color: #a89c84; margin: 2px 0 4px; }
.ap .failbox { position: absolute; left: 12px; right: 12px; top: 56px; z-index: 50; padding: 12px; border-radius: 12px; background: #3a1d18; border: 1px solid #c8402a;
  color: #f3e6c8; display: flex; flex-direction: column; gap: 6px; font-size: 13px; } .ap .failbox span { color: #e8b8a8; word-break: break-all; }
.ap .pow { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; margin: 4px 0 2px; } .ap .pow b { color: var(--gold); font-size: 14px; }
.ap .pbar { flex: 1 1 80px; height: 8px; border-radius: 4px; background: #30241a; overflow: hidden; } .ap .pbar i { display: block; height: 100%; background: linear-gradient(90deg, #8a6a3a, #e0a050); }
.ap .pow .mute { flex-basis: 100%; font-size: 12.5px; }
.ap .kitrow { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 6px; margin: 3px 0; font-size: 13px; } .ap .kitrow img.ic { width: 20px; height: 20px; }
.ap .kitrow .kt { color: #c8c0b0; font-size: 12.5px; flex: 1 1 10em; } .ap .kitrow .btn.sm { margin-left: auto; }
.ap .hints { margin: 4px 0 6px; padding-left: 18px; font-size: 13px; color: #d8c89a; } .ap .hints li { margin: 1px 0; }
.ap .acard.fresh { border-color: #7aa83a; box-shadow: 0 0 0 2px #7aa83a55; animation: fresh 1.2s ease-out 1; } @keyframes fresh { from { background: #2f3d24; } }
.ap .face { flex: none; width: 64px; height: 64px; border-radius: 12px; object-fit: cover; border: 1px solid #6a5236; background: #3a2c1e; display: block; }
.ap .noface { background: radial-gradient(circle at 50% 38%, #6a5236 0 22%, transparent 23%), radial-gradient(ellipse at 50% 100%, #6a5236 0 45%, transparent 46%), #3a2c1e; }
.ap .an { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; } .ap .an.big h3 { margin: 0; }
.ap img.nic { width: 44px; height: 44px; } .ap img.fem { width: 30px; height: 30px; }
.ap .units { display: flex; flex-wrap: wrap; gap: 4px 10px; margin-top: 4px; font-size: 14px; }
.ap .go { margin-top: 6px; color: var(--bad); font-weight: 600; }
.ap .rows { margin-top: 8px; display: flex; flex-direction: column; gap: 4px; }
.ap .row { display: flex; align-items: center; gap: 6px; width: 100%; padding: 9px 10px; border-radius: 10px; border: 1px solid var(--line);
  background: #241a12; color: var(--ink); font: inherit; font-size: 14px; text-align: left; cursor: pointer; box-sizing: border-box; margin: 3px 0; }
.ap .row.on { border-color: #e0bd78; background: #3a3020; } .ap .row:disabled { opacity: .45; cursor: default; }
.ap .row .dest { font-weight: 600; } .ap .row .sub { color: var(--mute); font-size: 13px; }
.ap .row .win, .ap .row > .mute { margin-left: auto; font-weight: 700; } .ap .win.good { color: var(--good); } .ap .win.bad { color: var(--bad); }
.ap .chip { align-self: flex-end; padding: 5px 12px; border-radius: 16px; border: 1px solid #6a5236; background: #2a1f16; color: var(--ink); font: inherit; font-size: 13px; cursor: pointer; }
.ap .chip.on { background: #3a2a5a; border-color: #9a7ad8; }
.ap .split { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 8px; }
.ap .split label { display: flex; align-items: center; gap: 4px; font-size: 14px; }
.ap input[type=number] { width: 4.2em; font: inherit; font-size: 15px; background: #17110c; color: var(--ink); border: 1px solid #6a5236; border-radius: 8px; padding: 4px 6px; }
.ap .seg { display: flex; border: 1px solid #6a5236; border-radius: 10px; overflow: hidden; }
.ap .seg button { flex: 1; padding: 6px 4px; border: 0; background: #241a12; color: var(--mute); font: inherit; font-size: 13px; cursor: pointer; }
.ap .seg button.on { background: #3a3020; color: var(--gold); }
/* 얼굴로 고르기 — 함께 보낼 장수 · 암살에 보낼 이 (이름 글자 대신 명치판) */
.ap .fpick { display: flex; flex-wrap: wrap; gap: 8px; margin: 4px 0; }
.ap .fpick button { width: 54px; height: 54px; padding: 0; border-radius: 50%; overflow: hidden; border: 2px solid var(--line); background: #1e160f; color: var(--mute);
  font: inherit; font-size: 18px; cursor: pointer; opacity: .72; transition: transform .12s, opacity .12s; }
.ap .fpick button.busy, .ap .seg button.busy { opacity: .42; filter: grayscale(.85); cursor: default; position: relative; }
.ap .fpick button .fbz { position: absolute; right: 2px; bottom: 0; font-style: normal; font-size: 18px; color: #f0d090; text-shadow: 0 0 4px #000; }
/* 돌아온 장수 알림 — 위 왼쪽(도감 알림은 오른쪽) · 얼굴과 한 줄 */
.ap .bktoast { position: absolute; left: 10px; top: calc(var(--toph) + 8px); z-index: 44; display: flex; flex-direction: column; gap: 4px; max-width: min(78vw, 360px);
  padding: 8px; border-radius: 12px; border: 1px solid #8a6a3a; background: linear-gradient(#2a1f14f0, #1a130cf0); box-shadow: 0 6px 18px #000a; animation: bkin .35s cubic-bezier(.2, 1.3, .4, 1) both; }
.ap .bktoast.out { animation: cout .4s ease-in forwards; }
.ap .bktoast .bkhd { cursor: pointer; display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 800; color: #f0d090; }
.ap .bktoast .bkic { width: 20px; height: 20px; }
.ap .bktoast .bkrow { display: flex; align-items: center; gap: 8px; padding: 3px 4px; border: 0; border-radius: 8px; background: #0003; color: #f3e6c8; text-align: left; font-size: 13px; cursor: pointer; }
.ap .bktoast .bkrow:hover { background: #fff1; }
.ap .bktoast .bkf { width: 30px; height: 30px; border-radius: 50%; object-fit: cover; border: 1px solid #d9b36a; flex: none; }
.ap .bktoast .bkmore { font-size: 12px; color: #c9b48a; }
@keyframes bkin { from { opacity: 0; transform: translateX(-14px); } to { opacity: 1; transform: none; } }
.ap .row.mv .allyt { margin-left: auto; font-size: 12px; color: #9fd6a0; white-space: nowrap; }
.ap .hdo.big { font-size: 15px; font-weight: 800; color: #f0d090; margin: 6px 0; }
.ap .fpick button.on { border-color: var(--gold); box-shadow: 0 0 0 2px #d9b36a66, 0 0 14px #d9b36a55; opacity: 1; transform: scale(1.08); }
.ap .fpick img.fp { width: 100%; height: 100%; object-fit: cover; object-position: top; display: block; }
.ap .stepper { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ap .stepper button { width: 34px; height: 34px; border-radius: 10px; border: 1px solid #6a5236; background: #3a2c1e; color: var(--ink); font-size: 20px; cursor: pointer; }
.ap .stepper b { min-width: 2.4em; text-align: center; font-size: 17px; }
.ap .stepper button.btn { width: auto; height: auto; font-size: 14px; margin-left: auto; white-space: nowrap; flex: none; }
.ap .stepper .mute { flex: 1 1 4em; min-width: 0; }
.ap .sheet { overflow-x: hidden; }
/* 고을 판의 징병 — 병종을 큰 그림으로 */
.ap .draftc.big .dbig { display: grid; grid-template-columns: repeat(auto-fill, minmax(76px, 1fr)); gap: 6px; margin: 6px 0; }
.ap .draftc.big .dbig button { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 6px 4px; border-radius: 12px; border: 1px solid var(--line); background: #221b16; color: var(--ink); font: inherit; cursor: pointer; }
.ap .draftc.big .dbig img { width: 56px; height: 56px; object-fit: contain; filter: drop-shadow(0 2px 2px #0008); }
.ap .draftc.big .dbig b { font-size: 13px; } .ap .draftc.big .dbig small { font-size: 11px; color: var(--mute); }
/* 병종 이름은 줄을 바꾸지 않고 글자만 작아진다 (형 10-25) */
.ap .draftc .dbig button, .ap .draftc .seg button { container-type: inline-size; min-width: 0; }
.ap .draftc .dbig b, .ap .draftc .dbig small, .ap .draftc .seg button { white-space: nowrap; }
.ap .draftc.big .dbig b { font-size: min(13px, 19cqw); } .ap .draftc.big .dbig small { font-size: min(11px, 15cqw); }
.ap .draftc .seg button { display: inline-flex; align-items: center; justify-content: center; gap: 2px; font-size: min(13px, 18cqw); }
.ap .draftc .seg button .ic { width: min(22px, 26cqw); height: min(22px, 26cqw); flex: none; }
.ap .draftc.big .dbig button.on { border-color: var(--gold); background: #2a2416; box-shadow: 0 0 0 2px #d9b36a55; } .ap .draftc.big .dbig button:disabled { opacity: .4; }
.ap .yield { display: flex; flex-direction: column; gap: 2px; margin: 6px 0; padding: 7px 10px; border-radius: 10px; background: #1f2418; border: 1px solid #4f5a3a; font-size: 13px; }
.ap .yield b { color: var(--gold); font-size: 13.5px; } .ap .yield span { color: #d8dcc8; display: flex; align-items: center; gap: 4px; } .ap .yield .ic { width: 18px; height: 18px; }
/* 판을 열 때 — 카드가 아래에서 한 장씩, 살짝 기울었다 바로 선다 (하스스톤처럼 서로 다른 때에) */
.ap .sheet.deal > * { animation: deal .42s cubic-bezier(.2, .9, .3, 1.18) both; }
.ap .sheet.deal > :nth-child(even) { --rot: 1.2deg; }
.ap .sheet.deal > :nth-child(2) { animation-delay: 0.000s; }
.ap .sheet.deal > :nth-child(3) { animation-delay: 0.035s; }
.ap .sheet.deal > :nth-child(4) { animation-delay: 0.070s; }
.ap .sheet.deal > :nth-child(5) { animation-delay: 0.105s; }
.ap .sheet.deal > :nth-child(6) { animation-delay: 0.140s; }
.ap .sheet.deal > :nth-child(7) { animation-delay: 0.175s; }
.ap .sheet.deal > :nth-child(8) { animation-delay: 0.210s; }
.ap .sheet.deal > :nth-child(9) { animation-delay: 0.245s; }
.ap .sheet.deal > :nth-child(10) { animation-delay: 0.280s; }
.ap .sheet.deal > :nth-child(11) { animation-delay: 0.315s; }
.ap .sheet.deal > :nth-child(12) { animation-delay: 0.350s; }
.ap .sheet.deal > :nth-child(13) { animation-delay: 0.385s; }
.ap .sheet.deal > :nth-child(14) { animation-delay: 0.420s; }
.ap .sheet.deal > :nth-child(15) { animation-delay: 0.455s; }
.ap .sheet.deal > :nth-child(16) { animation-delay: 0.490s; }
.ap .sheet.deal > :nth-child(17) { animation-delay: 0.525s; }
.ap .sheet.deal > :nth-child(18) { animation-delay: 0.560s; }
.ap .sheet.deal > :nth-child(19) { animation-delay: 0.595s; }
.ap .sheet.deal > :nth-child(n+20) { animation-delay: .63s; }
@keyframes deal { from { opacity: 0; transform: translateY(22px) rotate(var(--rot, -1.2deg)) scale(.97); } }
@media (prefers-reduced-motion: reduce) { .ap .sheet.deal > * { animation: none; } }
.ap .btn, .ap .row, .ap .chip { white-space: nowrap; }
.ap .stepper.sm button { width: 28px; height: 28px; font-size: 16px; } .ap .stepper.sm b { min-width: 2em; font-size: 15px; }
.ap .rel { margin-left: auto; padding: 2px 10px; border-radius: 12px; font-size: 12px; background: #3a2c1e; }
.ap .rel.war { background: #4a2420; color: #f1b8a8; } .ap .rel.truce { background: #23331f; color: #cfeabf; } .ap .rel.ally { background: #1f2c40; color: #b8d4f4; }
.ap .trade { display: flex; flex-direction: column; gap: 6px; padding: 8px; border-radius: 10px; background: #1e160f; }
/* 사신 꾸미기 — 무엇을 · 누가 가나 (얼굴 줄) */
.ap .trade .cmh { display: flex; flex-direction: column; gap: 2px; } .ap .trade .cmh b { color: var(--gold); font-size: 15px; }
/* 이간 — 두 나라 깃발 */
.ap .sowf { display: inline-flex; align-items: center; gap: 2px; flex: none; margin-right: 4px; } .ap .sowf i { font-style: normal; font-size: 12px; color: #e8a07a; }
/* 고을 판의 공작 격자 — 펼친 갈래 · 보낸 갈래 · 여기서 못 거는 갈래(외교로) */
.ap .nplots { grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); } .ap .nplots .cmdt.on { border-color: var(--gold); background: #3a2c16; } .ap .nplots .cmdt.sent { border-color: #7fbf6a; } .ap .nplots .cmdt.away { opacity: .62; }
/* 누가 가나 — 한 줄로 밀던 것을 공작처럼 격자로 (형 10-25: "1행이라서 보기 힘듦 · 공작처럼") */
.ap .who .wlist { display: grid; grid-template-columns: repeat(auto-fill, minmax(78px, 1fr)); gap: 6px; padding: 2px 2px 6px; }
.ap .who .wg { flex: none; width: auto; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 6px 2px; border-radius: 12px;
  border: 1px solid var(--line); background: #201914; color: var(--ink); font: inherit; cursor: pointer; }
.ap .who .wg .wfc { width: 48px; height: 48px; border-radius: 50%; object-fit: cover; object-position: top; border: 2px solid #6a5236; background: #3a2c1e; display: block; }
.ap .who .wg b { font-size: 12px; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ap .who .wg i { font-style: normal; font-size: 10.5px; color: #f3d48a; } .ap .who .wg small { font-size: 10.5px; color: var(--mute); }
.ap .who .wg .feel { font-size: 10.5px; padding: 0 5px; }
.ap .who .wg.on { border-color: var(--gold); background: #2a2416; box-shadow: 0 0 0 2px #d9b36a55; } .ap .who .wg.on .wfc { border-color: var(--gold); }
.ap .who .wg:disabled { opacity: .42; cursor: default; }
.ap .who p { margin: 0; font-size: 12px; } .ap .who .warnl { color: #f0a090; }
.ap .sentb { display: flex; align-items: center; gap: 8px; } .ap .sentb span { flex: 1; min-width: 0; }
.ap .sentb .sface { width: 30px; height: 30px; border-radius: 50%; object-fit: cover; object-position: top; border: 2px solid #8a7040; flex: none; }
.ap .tr2 { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; } .ap .tr2 > span:first-child { width: 3.5em; color: var(--mute); font-size: 13px; }
/* 주고받기 표 — 물건마다 한 줄: 준다 | 물건 | 받는다 */
.ap .tgrid { display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 6px 10px; margin: 8px 0; }
.ap .tgrid.two { grid-template-columns: 1fr auto 1fr; }
.ap .tgrid .th { font-size: 12px; color: var(--mute); text-align: center; } .ap .tgrid .th.give { color: #e0b0a0; } .ap .tgrid .th.take { color: #b9d9a6; }
.ap .tgrid .tg { display: flex; flex-direction: column; align-items: center; gap: 1px; font-size: 11.5px; color: #d8cfbd; } .ap .tgrid .tg i { font-style: normal; }
.ap .tgrid .tg img { width: 26px; height: 26px; }
.ap .tgrid .tc { display: flex; flex-direction: column; align-items: center; gap: 1px; } .ap .tgrid .tc small { font-size: 10.5px; color: var(--mute); }
.ap .tgrid:not(.two) .tc { align-items: flex-start; }
.ap .splitp { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; padding: 10px; border-radius: 12px; background: #1e160f; }
.ap .row .dest, .ap .row .sub { min-width: 0; overflow: hidden; text-overflow: ellipsis; } .ap .row .win, .ap .row .em { flex: none; }
/* 맺은 나라에 공작 — 이름 밑 둘째 줄 (pactWarn) */
.ap .row .dest:has(.pwarn) { flex: 1; }
/* 고을 판 공작 — 누른 줄 밑 「누가 가나」 (plotWhoHtml) */
.ap .row.open { border-color: #e0bd78; background: #3a2e1c; border-bottom-left-radius: 0; border-bottom-right-radius: 0; }
.ap .pwhos { margin: -2px 0 6px; padding: 8px; border: 1px solid #e0bd78; border-top: 0; border-radius: 0 0 10px 10px; background: #241b12; }
.ap .pwhos > .mute { display: block; font-size: 12px; margin-bottom: 6px; }
.ap .pwl { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 6px; }
.ap .pwho { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 6px 4px; border-radius: 10px; border: 1px solid var(--line); background: #2a2016; color: var(--ink); font: inherit; cursor: pointer; text-align: center; min-width: 0; }
.ap .pwho:active { border-color: var(--gold); } .ap .pwho .fp { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; }
.ap .pwho b { font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; } .ap .pwho small { font-size: 10.5px; color: var(--mute); line-height: 1.25; }
.ap .row .dest .pwarn { display: block; margin-top: 1px; font-size: 11.5px; font-weight: 600; line-height: 1.3; color: #ff9a80; white-space: normal; }
/* 사신 단추 — 한 열 · 가로 길게 · 낌새는 오른쪽 끝 (askButtons · 형 10-25) */
.ap .btns.askl { display: flex; flex-direction: column; align-items: stretch; gap: 6px; }
.ap .btns.askl > .btn { width: 100%; justify-content: flex-start; gap: 8px; padding: 8px 10px; text-align: left; white-space: normal; }
.ap .btns.askl > .btn .al { flex: 1; min-width: 0; }
.ap .btns.askl > .btn.open { border-color: #e0bd78; background: #4a3822; box-shadow: 0 0 0 1px #e0bd78; border-bottom-left-radius: 0; border-bottom-right-radius: 0; }
.ap .btns.askl > .btn.open + * { margin-top: -6px; border-top: 1px solid #e0bd78; border-top-left-radius: 0; border-top-right-radius: 0; } .ap .btns.askl > .btn .feel { flex: none; margin-left: auto; }
.ap .acard > .ab > .splitp, .ap .acard > .ab > .rows { margin-left: -74px; } /* 얼굴 칸 밑까지 넓게 — 폰에서 단추가 접히지 않게 */
.ap .sprow { display: flex; align-items: center; gap: 8px; } .ap .sprow .stepper { flex-wrap: nowrap; } .ap .sprow .spn { width: 4em; font-size: 14px; }
.ap .spsum { font-size: 14px; color: #cfc6b4; } .ap .spsum b { color: var(--gold); }
.ap .splitp .seg button { white-space: normal; }
/* 출정 판 — 단계 머리 · 맨 아래 고정 띠 (판이 굴러도 늘 보인다) */
.ap .sortiep .sth { display: flex; align-items: center; gap: 8px; margin-top: 6px; font-size: 13px; font-weight: 700; color: var(--gold); }
.ap .sortiep .sth .seg.sm { margin-left: auto; } .ap .sortiep .sth .seg.sm button { padding: 2px 10px; font-size: 12px; white-space: nowrap; }
.ap .sortiebar { position: sticky; bottom: 0; z-index: 3; display: flex; gap: 6px; margin: 12px -14px -18px; padding: 10px 14px 12px; background: linear-gradient(#221b17ee, #221b17); border-top: 1px solid var(--line); box-shadow: 0 -6px 14px #0007; }
.ap .sortiebar .go { flex: 1; font-size: 15px; } .ap .sortiebar .btn { margin: 0; }
.ap .nightov { position: absolute; inset: 0; z-index: 40; background: #000; }
.ap .nightov iframe { width: 100%; height: 100%; border: 0; display: block; }
.ap .nightov [data-close] { position: absolute; right: 10px; top: 10px; z-index: 1; font-size: 13px; padding: 4px 10px; }
/* 눕힌 밤 판의 위는 화면 오른쪽 — 판의 오른쪽 위 = 화면 오른쪽 아래. 단추를 아래 오른쪽 모서리를 축으로 90° 돌려 그 자리에 */
.ap .nightov.rot [data-close] { top: auto; bottom: 10px; transform-origin: 100% 100%; transform: rotate(90deg) translateY(100%); }
.ap .frow { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; } .ap .frow .mute { flex: 1 1 12em; } .ap .why { font-size: 13px; color: #d8c89a; margin: 4px 0 2px; } .ap .askc .why { margin: 2px 0 4px; }
/* 나라 카드 — 우리 사이에 있었던 일 (때 · 무엇). 그쪽이 잘한 일은 초록, 잘못한 일은 붉게, 우리가 한 일은 금빛 */
.ap .deeds { border-top: 1px dashed var(--line); padding-top: 6px; } .ap .deeds h5 { margin: 0 0 4px; font-size: 12px; color: var(--mute); font-weight: 600; }
.ap .deeds .dd { display: flex; gap: 8px; font-size: 13px; line-height: 1.4; padding: 2px 0 2px 8px; border-left: 3px solid var(--line); margin: 2px 0; }
.ap .deeds .dd span { flex: none; color: var(--mute); font-size: 12px; min-width: 4.4em; } .ap .deeds .dd.good { border-color: var(--good); } .ap .deeds .dd.bad { border-color: var(--bad); } .ap .deeds .dd.us { border-color: var(--gold); }
.ap .deeds .btn { margin-top: 4px; }
/* 이름 앞 칭호 — 성처럼 읽히지 않게 작고 흐리게 · 이름만 들은 장수 표 */
.ap .ttl { font-size: .72em; color: var(--mute); font-weight: 500; margin-right: .3em; letter-spacing: -.02em; }
.ap .heard { font-size: 11px; color: #c9b98f; border: 1px solid #5a5040; border-radius: 8px; padding: 0 6px; margin-left: 4px; font-weight: 500; white-space: nowrap; }
.ap .heardp { font-size: 13px; color: #d8c89a; background: #2a2a22; border-left: 3px solid #8a7a50; padding: 6px 8px; border-radius: 6px; }
.ap .fbtn { border: 0; padding: 0; background: none; cursor: pointer; border-radius: 50%; }
.ap .plimg { display: block; width: 100%; border-radius: 10px; margin: 6px 0; }
.ap .rface.sm { width: 34px; height: 34px; border-width: 1px; }
.ap .farh { margin: 10px 0 4px; } .ap .farh b { display: block; font-size: 13.5px; color: var(--gold); } .ap .farh span { font-size: 12px; }
.ap .farseg button { display: inline-flex; flex-direction: column; align-items: center; line-height: 1.2; } .ap .farseg small { font-size: 10.5px; opacity: .8; }
.ap .scouthd { display: flex; align-items: center; gap: 10px; margin: 4px 0 10px; padding: 8px 10px; border-radius: 12px; background: #1d2418; border: 1px solid #4f5a3a; }
.ap .scouthd .scic { width: 52px; height: 52px; } .ap .scouthd b { display: block; font-size: 15px; color: var(--gold); } .ap .scouthd span { font-size: 12.5px; color: var(--mute); }
/* 「?」 — 판 이름 옆 작은 동그라미 · 누르면 설명 */
.ap .qh { display: flex; align-items: center; gap: 8px; }
.ap .qi { width: 24px; height: 24px; border-radius: 50%; border: 1px solid #c9a45a; background: #241a0e; color: #f3d48a; font: inherit; font-size: 14px; font-weight: 700; line-height: 1; cursor: pointer; padding: 0; }
.ap .guidebox { position: absolute; inset: 0; z-index: 80; display: flex; align-items: center; justify-content: center; padding: 16px; background: #000a; }
.ap .guidebox .gbx { max-width: 440px; width: 100%; padding: 16px 18px; border-radius: 14px; background: #1f1710; border: 1px solid #c9a45a; box-shadow: 0 10px 40px #000c; }
.ap .guidebox .gbx > b { display: block; font-size: 17px; color: var(--gold); margin-bottom: 6px; }
.ap .guidebox .gbx p { margin: 6px 0; font-size: 14.5px; line-height: 1.6; color: #ece2cf; }
.ap .guidebox .gbx .btn { display: block; margin: 12px 0 0 auto; }
.ap .dseg { margin-bottom: 8px; } .ap .dseg button { font-size: 15px; padding: 8px; }
.ap .plh { display: flex; align-items: center; gap: 8px; width: 100%; border: 0; background: none; color: var(--ink); font: inherit; text-align: left; cursor: pointer; padding: 0; }
.ap .plh > span:nth-child(2) { flex: 1; min-width: 0; display: flex; flex-direction: column; } .ap .plh .mute { white-space: normal; }
.ap .plh .cost { flex: none; white-space: nowrap; }
.ap .askc { padding: 10px; margin: 8px 0; border-radius: 14px; background: #2f2520; border: 1px solid #5a4a2a; }
.ap .askc.threat { border-color: #8a3a2a; background: #2a1f1f; } .ap .askc p { margin: 6px 0 2px; font-size: 14.5px; }
.ap .sus { color: #f1a08a; font-weight: 700; }
.ap .askpill { margin-left: auto; flex: none; display: flex; align-items: center; gap: 2px; padding: 2px 10px 2px 4px; border-radius: 16px;
  border: 1px solid #e0bd78; background: linear-gradient(#a57a31, #7d5a22); color: #fff4dc; font: inherit; font-size: 13px; font-weight: 700;
  cursor: pointer; pointer-events: auto; animation: askpulse 1.6s ease-in-out 3; }
@keyframes askpulse { 50% { box-shadow: 0 0 0 4px #e0bd7855; } }
.ap .asks { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin: 6px 0 4px; }
.ap .asks > div { padding: 6px 8px; border-radius: 10px; background: var(--card); display: flex; flex-direction: column; }
.ap .asks b { font-size: 14px; color: var(--gold); } .ap .asks span { font-size: 12px; color: var(--mute); }
.ap .how { display: flex; flex-direction: column; gap: 6px; margin: 2px 0 6px; }
.ap .hw { min-width: 0; display: flex; flex-direction: row; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 12px;
  border: 1px solid var(--line); background: #241a12; color: var(--ink); font: inherit; text-align: left; cursor: pointer; }
.ap .hw b { font-size: 15px; } .ap .hw .ln { font-size: 13px; color: #cfc6b4; } .ap .hw .mute { white-space: normal; font-size: 12px; }
.ap .hw .hwl { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; } .ap .hw .hwl small { font-weight: 400; color: var(--mute); font-size: 12px; }
.ap .hw .hwr { flex: none; display: flex; flex-direction: column; align-items: flex-end; gap: 3px; } .ap .hw .hwr .ln { white-space: nowrap; }
.ap .hw.on { border-color: #e0bd78; background: #3a3020; } .ap .hw.amb.on { border-color: #9a7ad8; background: #2a2440; }
.ap .tip { margin: 0 0 6px; }
.ap .flow3 { display: flex; align-items: stretch; gap: 6px; margin: 4px 0; }
.ap .flow3 > div { flex: 1; display: flex; flex-direction: column; align-items: center; text-align: center; padding: 8px 6px; border-radius: 12px; background: var(--card); }
.ap .flow3 > div img.ic { width: 34px; height: 34px; } .ap .flow3 b { font-size: 15px; } .ap .flow3 span { font-size: 12px; color: var(--mute); white-space: normal; }
.ap .flow3 > i { align-self: center; font-style: normal; color: var(--gold); font-size: 13px; white-space: nowrap; }
.ap .goer { margin: 8px 0; } .ap .gname { font-size: 14px; font-weight: 600; }
.ap .story { color: #cfc6b4; font-style: italic; }
/* 고을 판 — 형편 · 생산 · 할 일 (이름표 | 값) */
.ap .nsec { margin: 14px 0 4px; font-size: 13px; color: var(--gold); letter-spacing: .06em; border-bottom: 1px solid #4a3a28; padding-bottom: 3px; }
.ap .ntab { display: grid; grid-template-columns: auto 1fr; gap: 5px 12px; align-items: baseline; font-size: 14.5px; }
/* 고을 판의 접는 칸 (app.fold) — 제목 한 줄, 누르면 펼친다 */
.ap .nfh { display: flex; align-items: center; gap: 6px; width: 100%; margin: 6px 0 0; padding: 8px 10px; border: 1px solid #4a3a28; border-radius: 10px; background: #221a12; color: var(--gold); font: inherit; font-size: 13.5px; text-align: left; cursor: pointer; }
.ap .nfh > span { flex: 1; min-width: 0; } .ap .nfh small { font-size: 12px; margin-left: 4px; } .ap .nfh > i { font-style: normal; color: var(--mute); }
.ap .nfh.on { border-bottom-left-radius: 0; border-bottom-right-radius: 0; border-color: #8a6a3a; }
.ap .nfb { padding: 8px 10px; border: 1px solid #8a6a3a; border-top: 0; border-radius: 0 0 10px 10px; background: #1a140e; }
.ap .nfb > :first-child { margin-top: 0; }
.ap .ntab > span { color: var(--mute); font-size: 13px; white-space: nowrap; }
.ap .ntab > b { font-weight: 600; display: flex; flex-wrap: wrap; align-items: center; gap: 2px 6px; }
.ap .ntab small { font-weight: 400; font-size: 12px; color: var(--mute); }
.ap .ntab .gic { width: 18px; height: 18px; vertical-align: -3px; }
.ap .grid4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin: 8px 0; }
.ap .grid4 > div { display: flex; flex-direction: column; align-items: center; padding: 8px 2px; border-radius: 12px; background: var(--card); }
.ap .grid4 b { font-size: 18px; } .ap .grid4 span { font-size: 12px; color: var(--mute); }
.ap .goal { padding: 10px 12px; border-radius: 12px; background: #2d2716; color: #f3dca4; margin: 8px 0; }
.ap .goal b { float: right; }
.ap .nhead { display: flex; gap: 12px; align-items: center; } .ap .nhead h3 { margin: 0; }
.ap .rface { flex: none; width: 52px; height: 52px; border-radius: 50%; object-fit: cover; border: 2px solid #6a5a3a; display: block; }
.ap .fn { display: flex; flex-direction: column; min-width: 0; } .ap .fn b { display: flex; align-items: center; gap: 4px; }
.ap .top .stat.nat { border: 0; background: none; color: inherit; font: inherit; padding: 0; cursor: pointer; gap: 4px; }
.ap .tface { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 2px solid var(--gold); display: block; }
.ap img.nface { width: 84px; height: 84px; border-radius: 14px; object-fit: cover; border: 1px solid #6a5a3a; }
.ap .caps { display: flex; gap: 10px; flex-wrap: wrap; } .ap .cap { display: flex; flex-direction: column; align-items: center; font-size: 13px; width: 92px; text-align: center; }
.ap img.cface { width: 84px; height: 84px; border-radius: 12px; object-fit: cover; border: 2px solid #8a5a3a; }
.ap .help p { font-size: 14px; color: #d8d0c0; }

/* 보고 카드 */
.ap .modal { position: absolute; inset: 0; z-index: 20; display: none; align-items: center; justify-content: center; padding: 16px; background: #000b; }
.ap.modal-open .modal { display: flex; }
.ap .mcard { width: min(100%, 520px); max-height: 100%; overflow-y: auto; box-sizing: border-box; padding: 14px; border-radius: 18px;
  background: #1f1710; border: 1px solid #4a4030; box-shadow: 0 16px 40px #000c; }
.ap .mt { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 18px; margin-bottom: 8px; }
.ap .mt span { color: var(--mute); font-size: 14px; } .ap .mt img.sic { width: 34px; height: 34px; }
.ap .scene { position: relative; margin: 6px 0 10px; }
.ap .scene img.ev { display: block; width: 100%; border-radius: 12px; }
.ap .scene img.who { position: absolute; right: 10px; bottom: 42px; width: 30%; max-width: 130px; aspect-ratio: 1; object-fit: cover; border-radius: 12px; border: 2px solid var(--gold); box-shadow: 0 6px 16px #000a; }
.ap .brag { font-size: 20px; font-weight: 700; color: #f6d88e; margin-top: 8px; text-shadow: 0 2px 6px #000; }
.ap .lines p { font-size: 15px; border-left: 3px solid #4a4030; padding-left: 8px; }
.ap .lines p.mute { border-left-color: #40352f; }
.ap .mcard.end { text-align: center; } .ap .mcard.end img.ev { width: 100%; border-radius: 12px; } .ap .mcard.end h2 { font-size: 26px; color: var(--gold); margin: 12px 0 2px; }

/* 나라 고르기 */
.ap.choosing .mapwrap { top: 0; bottom: 0; overflow-y: auto; overflow-x: hidden; touch-action: pan-y; }
.ap.choosing .next, .ap.choosing .tabs, .ap.choosing .top { display: none; }
.ap .choose { max-width: 980px; margin: 0 auto; padding: calc(18px + env(safe-area-inset-top)) 14px 30px; }
.ap .choose h1 { font-size: 34px; margin: 0; color: var(--gold); text-align: center; letter-spacing: .08em; }
.ap .choose > p { text-align: center; } .ap .choose-links { margin: 6px 0 0; }
.ap .ncards { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 10px; margin-top: 14px; }
.ap .ncard.pick { flex-direction: row; align-items: flex-start; text-align: left; color: var(--ink); font: inherit; cursor: pointer; }
.ap .ncard.pick:active { border-color: var(--gold); }
.ap .ncard.pick .nb { flex: 1; min-width: 0; } .ap .ncard.pick p { font-size: 13px; color: #cfc6b4; margin: 4px 0 6px; }
.ap .hard { margin-left: auto; padding: 1px 8px; border-radius: 10px; background: #4a2420; color: #f1b8a8; font-size: 12px; }
/* 능력치 칸 — 카드가 좁으면 눈금이 줄어든다 (형: "능력치 부분이 우측으로 칸 넘어가지 않게") */
.ap .bars { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 3px 8px; }
.ap .bar { display: flex; align-items: center; gap: 2px; font-size: 12px; min-width: 0; } .ap .bar i { font-style: normal; flex: none; width: 2.4em; color: var(--mute); }
.ap .bar b, .ap .bar s { flex: 1 1 0; min-width: 3px; max-width: 12px; height: 8px; border-radius: 2px; background: var(--gold); } .ap .bar s { background: #54412a; }
/* 보고판 — 계절 띠가 걷힌 뒤 뜨고, 안의 것이 차례로 올라와 쌓인다. 누르면 다 (app.modalHtml) */
.ap .modal.late { animation: mlate .45s ease-out 1.9s both; }
@keyframes mlate { from { opacity: 0; visibility: hidden; } to { opacity: 1; visibility: visible; } }
.ap .modal.late .mcard { --t0: .35s; }
/* 정할 것 — 소식 카드 맨 위 · 확인은 카드 아래에 늘 붙어 있다 (형 10-24) */
.ap .mcard .rdecide { margin: 4px 0 10px; padding: 8px 10px; border-radius: 12px; border: 1px solid #e0b860; background: #2a1f10cc; }
/* 정할 것이 남은 보고판 — 화면 가득, 「확인」 없음 (app.reportHtml) */
.ap .modal:has(.mcard.fulld) { padding: 0; align-items: stretch; }
.ap.ap .mcard.fulld { width: 100%; max-width: none; max-height: none; height: 100%; border: 0; border-image: none; border-radius: 0; padding: max(12px, env(safe-area-inset-top)) 14px 18px; background: radial-gradient(ellipse at 50% 0%, #3a2a16, #17110c 70%); display: flex; flex-direction: column; overflow-y: auto; }
.ap .mcard.fulld .mt { margin-bottom: 8px; } .ap .mcard.fulld .mt .rdn { display: inline-grid; place-items: center; min-width: 22px; height: 22px; border-radius: 11px; background: #c0392b; color: #fff; font-size: 13px; margin-left: 4px; }
.ap .mcard.fulld .rdecide.full { flex: 1; margin: 0; padding: 0; border: 0; background: none; display: flex; flex-direction: column; justify-content: center; gap: 10px; }
.ap .mcard.fulld .cardc { flex-direction: column; gap: 10px; margin: 0; padding: 12px; border-color: #e0b860; box-shadow: 0 0 0 1px #e0b86033 inset, 0 10px 30px #000a; }
/* 넓은 창(PC 앱)에서 가로만 꽉 차고 높이가 34vh 에 막혀 그림 가운데 가슴께만 남았다 (형 10-25 해무리) — 그림 비율(3:2)을 지키며 폭을 줄이고 얼굴 쪽을 남긴다 */
.ap .mcard.fulld .cardc .cimg { width: min(100%, calc(40vh * 1.5)); aspect-ratio: 3 / 2; max-height: none; align-self: center; object-position: center 30%; }
.ap .mcard.fulld .cardc .cb { flex: 1; } .ap .mcard.fulld .cardc .cb > b { font-size: 18px; } .ap .mcard.fulld .cardc .cb > p { font-size: 15.5px; line-height: 1.45; }
.ap .mcard.fulld .cardc .copt { padding: 12px 14px; font-size: 16px; border-width: 1.5px; } .ap .mcard.fulld .cardc .copt .cot > span { font-size: 13.5px; }
.ap .askc .aqh { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; } .ap .askc .aqh b { color: var(--gold); font-size: 13.5px; } .ap .askc .aqh .aqi { width: 26px; height: 26px; object-fit: contain; }
/* 화면 가득 — 사신의 청을 사건 카드만큼 크게 (형 10-25: "어린애도 알지") */
.ap .mcard.fulld .askc { margin: 0; padding: 14px; border-color: #e0b860; box-shadow: 0 0 0 1px #e0b86033 inset, 0 10px 30px #000a; }
.ap .mcard.fulld .askc.threat { border-color: #e06a4a; box-shadow: 0 0 0 1px #e06a4a55 inset, 0 0 24px #c0392b55; }
.ap .mcard.fulld .askc .aqh { flex-direction: column; gap: 4px; margin-bottom: 8px; } .ap .mcard.fulld .askc .aqh .aqi { width: min(34vw, 150px); height: auto; aspect-ratio: 1; filter: drop-shadow(0 6px 12px #000a); } .ap .mcard.fulld .askc .aqh b { font-size: 20px; }
.ap .mcard.fulld .askc .an { justify-content: center; } .ap .mcard.fulld .askc .an .rface { width: 64px; height: 64px; } .ap .mcard.fulld .askc .an .fn b { font-size: 16px; }
.ap .mcard.fulld .askc > p { font-size: 16px; line-height: 1.5; text-align: center; }
.ap .mcard.fulld .askc .btns { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; } .ap .mcard.fulld .askc .btns .btn { justify-content: center; padding: 14px 16px; font-size: 17px; } .ap .mcard.fulld .askc .btns > .mute { grid-column: 1 / -1; text-align: center; }
.ap .mcard.fulld .rdecide.full > .cardc, .ap .mcard.fulld .rdecide.full > .askc { width: min(100%, 760px); align-self: center; }
.ap .mcard.fulld .cardc .copt { justify-content: center; min-height: 64px; } .ap .mcard.fulld .cardc .copt .cof { width: 72px; height: 72px; }
/* 고을지기 자리 — 고을 판 맨 위 (비면 붉은 점선 · 실루엣과 ?) */
.ap .chslot { display: flex; align-items: center; gap: 10px; width: 100%; margin: 6px 0 8px; padding: 8px 12px; border-radius: 12px; border: 1px solid #6a5a3a; background: #2a2118; color: var(--ink); font: inherit; text-align: left; cursor: pointer; }
.ap .chslot .cface, .ap .chslot .chsil { width: 54px; height: 54px; flex: none; border-radius: 50%; object-fit: cover; object-position: top; border: 2px solid #8a7040; }
.ap .chslot .chsil { position: relative; display: grid; place-items: center; background: #3a3029; border: 2px dashed #9a8a6a; overflow: hidden; }
.ap .chslot .chsil svg { position: absolute; inset: 12% 10% 0; width: 80%; height: 88%; fill: #8a7a66; opacity: .85; }
.ap .chslot .chsil b { position: relative; font-size: 24px; font-weight: 800; color: #f0d890; text-shadow: 0 1px 4px #000; }
.ap .chslot .chst { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.ap .chslot .chst small { font-size: 11.5px; color: var(--mute); } .ap .chslot .chst b { font-size: 16px; } .ap .chslot .chst i { font-style: normal; font-size: 12.5px; color: #cfc6b4; }
.ap .chslot .chgo { font-style: normal; font-size: 13px; color: var(--gold); white-space: nowrap; }
.ap .chslot.empty { border: 1.5px dashed #c0504a; background: #2a1a16; } .ap .chslot.empty .chst b { color: #e88a7a; }
.ap .chslot.away .cface { filter: grayscale(1) brightness(.6); } .ap .chslot.away .chst i { color: #e0a060; }
.ap .chslot.come { border-color: #6aa060; }
.ap .wandc .wtr { display: flex; flex-wrap: wrap; gap: 4px; margin: 2px 0 6px; } .ap .mcard.fulld .wandc .wtr { justify-content: center; }
/* 고을을 쥐었다 · 잃었다 — 큰 그림 한 장 (형 10-25) */
.ap .mcard.fulld.landc { justify-content: center; gap: 14px; }
.ap .landc .landv { position: relative; align-self: center; width: min(100%, calc(62vh * 16 / 9)); border-radius: 16px; overflow: hidden; box-shadow: 0 14px 40px #000c; animation: landin .6s cubic-bezier(.2, 1.1, .4, 1) both; }
.ap .landc .landi { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: cover; }
.ap .landc .landt { position: absolute; left: 0; right: 0; bottom: 0; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 40px 16px 16px; background: linear-gradient(#0000, #000c 45%); text-align: center; }
.ap .landc .landt b { font-size: clamp(22px, 4.2vw, 34px); letter-spacing: .04em; text-shadow: 0 2px 8px #000; animation: bigslam .55s cubic-bezier(.3, 1.6, .5, 1) .35s both; }
.ap .landc .landt span, .ap .landc .landt small { animation: bigup .4s ease-out .8s both; }
.ap .landc .landi { animation: bigzoom 1.6s ease-out both; }
.ap .landc .bigflash { position: absolute; inset: 0; z-index: 3; pointer-events: none; background: radial-gradient(circle, #fff 0, #fff8 40%, #0000 75%); animation: bigflash .5s ease-out both; }
.ap .landc.lost .bigflash { background: radial-gradient(circle, #ff6a4a 0, #c0392b88 40%, #0000 75%); }
.ap .landc { position: relative; } .ap .landc .landt .sowf.big .fem { width: 40px; height: 40px; } .ap .landc .landt .sowf.big i { font-size: 22px; }
@keyframes bigflash { from { opacity: 1; } to { opacity: 0; } }
@keyframes bigslam { 0% { transform: scale(2.2) translateY(-20px); opacity: 0; } 60% { transform: scale(.94); opacity: 1; } 100% { transform: scale(1); } }
@keyframes bigup { from { transform: translateY(12px); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes bigzoom { from { transform: scale(1.18); } to { transform: scale(1); } }
@media (prefers-reduced-motion: reduce) { .ap .landc .landt b, .ap .landc .landi, .ap .landc .bigflash, .ap .landc .landt span, .ap .landc .landt small { animation: none; } }
.ap .landc.won .landt b { color: #ffd77a; } .ap .landc.lost .landt b { color: #ff8a70; }
.ap .landc .landt span { font-size: 16px; color: #efe6d2; } .ap .landc .landt small { font-size: 13px; color: #cfc6b4; }
.ap .landc .landt .fem { width: 40px; height: 40px; }
.ap .landc .landok { align-self: center; width: min(100%, 360px); font-size: 18px; padding: 14px; }
@keyframes landin { from { transform: scale(.94); opacity: 0; } to { transform: none; opacity: 1; } }
.ap .mcard.fulld .fdnote { margin: 12px 0 0; text-align: center; color: var(--mute); font-size: 13px; }
.ap .mcard .rdecide .rdh { margin: 0 0 6px; color: #ffd27a; } .ap .mcard .rdecide .rdh b { display: inline-grid; place-items: center; min-width: 22px; height: 22px; border-radius: 11px; background: #c0392b; color: #fff; font-size: 13px; }
.ap .mcard .repfoot { position: sticky; bottom: -4px; margin: 8px -4px -4px; padding: 8px 4px 4px; background: linear-gradient(#1a130c00, #1a130cf0 35%); z-index: 2; }
.ap .mcard .repfoot .btn:disabled { opacity: .75; }
.ap .rv { animation: bkin .45s ease-out calc(var(--t0, 0s) + var(--t, 0s)) both; }
.ap .modal.fast { animation: none; } .ap .modal.fast .rv { animation-delay: 0s !important; animation-duration: .01s !important; }
@media (prefers-reduced-motion: reduce) { .ap .rv { animation-duration: .01s !important; animation-delay: 0s !important; } .ap .modal.late { animation-delay: .6s; } }
.ap .fall { display: flex; gap: 12px; align-items: center; margin: 8px 0 12px; padding: 12px; border-radius: 14px; background: linear-gradient(90deg, #2a1414, #1f1710); border: 1px solid #7a3a2a; }
.ap .fall img.flord, .ap .fall .flord { width: 72px; height: 72px; flex: none; border-radius: 12px; object-fit: cover; border: 2px solid #7a3a2a; filter: grayscale(.7) brightness(.85); }
.ap .fall b { display: flex; align-items: center; gap: 6px; font-family: 'Gowun Batang', serif; font-size: 20px; color: #f0b8a0; }
.ap .fall > div > span { display: block; font-size: 13.5px; color: var(--mute); margin-top: 3px; }
/* 지도에서 고른 말 — 아래 띠 · 합치기 */
.ap .selbar { position: absolute; left: 64px; right: 14px; bottom: calc(var(--tabh) + 70px); z-index: 7; display: none; align-items: center; gap: 8px; flex-wrap: wrap;
  padding: 6px 8px; border: 12px solid transparent; border-image: url(__ART__ui/frame-panel.png?v=3) 118 / 12px stretch; background: #1f1710f2 padding-box; filter: drop-shadow(0 6px 14px #000a); }
.ap .selbar .sbt b { display: flex; align-items: center; gap: 6px; }
.ap.sel-open .selbar { display: flex; } .ap.sheet-open .selbar { display: none; }
.ap .selbar .sbf { display: flex; } .ap .selbar .sbface { width: 38px; height: 38px; border-radius: 50%; object-fit: cover; border: 2px solid #ffd27a; margin-right: -8px; background: #3a2c1e; display: block; }
.ap .selbar .sbt { flex: 1; min-width: 140px; margin-left: 10px; display: flex; flex-direction: column; } .ap .selbar .sbt b { font-size: 14.5px; } .ap .selbar .sbt span { font-size: 12.5px; color: var(--mute); }
.ap .selbar .sbwhy { font-size: 12px; color: #e8a08a; width: 100%; text-align: right; }
.ap .selbar .sbx { border: 0; background: none; color: var(--mute); font-size: 18px; padding: 4px 6px; cursor: pointer; }
/* 집 보내기 — 고른 고을 그림 · 집 막대 · 조금·알맞게·많이 */
.ap .pprow { flex: 1; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; border: 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; padding: 0; }
.ap .dloss { margin: 4px 0 0; font-size: 12.5px; font-weight: 700; } .ap .dloss span { color: #e8a08a; }
/* 고른 말 띠는 글만큼만 — 화면 끝까지 늘이지 않는다 (형 10-23: "박스가 너무 크면 그거에 가려진 마을을 선택할 수가 없어") */
.ap .selbar { right: auto; max-width: min(calc(100% - 78px), 520px); }
.ap .selbar.pp { padding: 0 2px; gap: 4px; border-width: 9px; border-image-width: 9px; flex-wrap: nowrap; }
.ap .selbar.pp .sbface { width: 28px; height: 28px; margin-right: -4px; }
.ap .selbar.pp .sbt { min-width: 0; margin-left: 6px; } .ap .selbar.pp .sbt b { font-size: 13px; white-space: nowrap; } .ap .selbar.pp .sbt span { font-size: 11.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ap .selbar.pp .btn { padding: 1px 6px; font-size: 12.5px; white-space: nowrap; } .ap .selbar.pp .sbx { padding: 2px 4px; font-size: 16px; }
.ap .selbar .ppface { object-fit: contain; border-color: #e0b070; background: #3a2c1e; padding: 2px; box-sizing: border-box; }
.ap .selbar .sbt .ppbar { color: #e0b070; letter-spacing: 1px; }
.ap .selbar .ppamt { flex: 0 1 auto; } .ap .selbar .ppamt button { padding: 6px 12px; white-space: nowrap; }
.ap .selbar .ppamt button:disabled { opacity: .4; cursor: default; }
/* 길 보기 — 선의 생김새가 무슨 길인지 */
/* 단추는 늘 오른쪽 끝에 — 펼친 표가 넓어지면 단추가 왼쪽으로 밀려 「우리 땅」 밑에 숨어 못 접었다 (형 2026-10-20: "길 안내 책자 폈는데 접을수가 없음") */
.ap .roadkey { position: absolute; right: 14px; top: calc(var(--toph) + var(--legh) + 8px); z-index: 6; display: flex; flex-direction: column; align-items: flex-end; }
.ap .roadkey:has(.rk) { z-index: 12; } /* 펼친 표는 「우리 땅」·「지난 기록」 위로 */
.ap.sheet-open .roadkey, .ap.choosing .roadkey { display: none; }
/* 우리 땅으로 — 왼쪽 위, 깃발 줄 밑 (확대 단추와 떨어져) */
.ap .homebtn { position: absolute; left: 12px; top: calc(var(--toph) + var(--legh) + 8px); z-index: 6; padding: 6px 12px; border-radius: 12px;
  border: 1px solid #6a5236; background: #1f1710e6; color: var(--ink); font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; box-shadow: 0 0 0 1px #0006; }
.ap.sheet-open .homebtn, .ap.choosing .homebtn { display: none; }
.ap .roadkey > button { padding: 6px 10px; border-radius: 12px; border: 1px solid #6a5236; background: #1f1710e6; color: var(--ink); font: inherit; font-size: 13px; cursor: pointer; }
.ap .roadkey .rk { margin-top: 6px; padding: 10px 12px; border-radius: 14px; background: #1f1710f2; border: 1px solid #6a5236; width: min(78vw, 300px); box-sizing: border-box; }
.ap .roadkey .rk div { display: flex; align-items: center; gap: 8px; font-size: 13px; margin: 3px 0; }
.ap .roadkey .rk { max-height: calc(100dvh - var(--toph) - var(--legh) - 120px); overflow-y: auto; }
.ap .roadkey .rk b { white-space: nowrap; }
.ap .roadkey .rk .rki { width: 34px; height: 34px; flex: none; object-fit: contain; }
.ap .roadkey .rk .rkg { gap: 12px; flex-wrap: wrap; } .ap .roadkey .rk .rkg span { color: var(--ink); display: inline-flex; align-items: center; gap: 3px; } .ap .roadkey .rk svg { flex: none; background: #f3e6c8; border-radius: 4px; }
.ap .roadkey .rk span { color: var(--mute); font-size: 12px; } .ap .roadkey .rk h5 { margin: 8px 0 2px; font-size: 13px; color: var(--gold); }
/* 제사 단추 — 드는 것을 그림과 함께 */
.ap .ritebtn { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; text-align: left; }
.ap .ritebtn .cost { display: flex; gap: 8px; flex-wrap: wrap; font-size: 13px; } .ap .ritebtn .cost span { display: inline-flex; align-items: center; gap: 3px; }
.ap .ritebtn .cost img { width: 20px; height: 20px; } .ap .ritebtn .gain { font-size: 12.5px; color: #9fd18b; } .ap .ritebtn .short { color: #e8a08a; }
/* 징병 · 개척 — 군사는 붉은 기, 집 옮기기는 갈색 (형: "집 들이는거랑 군사뽑는거랑 구분이안가서 헷갈림") */
.ap .twoway { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin: 6px 0 10px; }
.ap .twoway .sec { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 10px 12px; border-radius: 14px; text-align: left; cursor: pointer; font: inherit; color: var(--ink); }
.ap .twoway .sec img { width: 30px; height: 30px; } .ap .twoway .sec b { font-size: 15px; } .ap .twoway .sec span { font-size: 12px; color: var(--mute); }
.ap .sec.men { background: #3a1c18; border: 1px solid #a0483a; } .ap .sec.home { background: #33281a; border: 1px solid #9a7444; }
.ap .sech { display: flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 10px; margin: 14px 0 6px; scroll-margin-top: 8px; }
.ap .sech img { width: 22px; height: 22px; } .ap .sech.men { background: #3a1c18; color: #f0a090; } .ap .sech.home { background: #33281a; color: #e4b878; }
.ap .ncard.draftc { border-left: 4px solid #b0503e; } .ap .ncard.settlec { border-left: 4px solid #a8804a; }
.ap .btn.pri.men { background: #9a3a2c; border-color: #c8604a; color: #fff2ec; } .ap .btn.pri.home { background: #7a5a30; border-color: #b08850; color: #fff6e6; }
/* 남의 고을 판 — 그 나라와 할 수 있는 것 (app.nationActs) */
.ap .nacts { margin: 12px 0 6px; padding: 10px; border-radius: 14px; background: #1f1710; border: 1px solid #6a5236; }
.ap .nacts .nah { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 4px; } .ap .nacts .nah b { font-size: 16px; }
.ap .nacts .nal { margin: 8px 0 4px; font-size: 13px; color: var(--gold); } .ap .nacts .nal .mute { font-size: 12px; }
.ap .nacts .btns { flex-wrap: wrap; } .ap .nacts .row .sub { margin-left: auto; margin-right: 6px; }
/* 지도 보기 켜고 끄기 (형: "좌하단에는 확대축소말고 뭔가 보이기 안보이기 토글") */
.ap .zbtns .lyb { font-size: 18px; }
.ap .layers { position: absolute; left: 62px; bottom: calc(var(--tabh) + 14px); z-index: 8; display: none; flex-direction: column; gap: 4px;
  padding: 8px; border-radius: 14px; background: #1f1710f2; border: 1px solid #6a5236; box-shadow: 0 8px 24px #000a; width: min(70vw, 240px); }
.ap .layers:not(:empty) { display: flex; } .ap.sheet-open .layers, .ap.choosing .layers { display: none; }
.ap .layers .lyh { font-size: 12.5px; color: var(--gold); margin: 0 2px 2px; }
.ap .layers .lyr { display: grid; grid-template-columns: 18px auto 1fr; align-items: center; gap: 6px; padding: 7px 8px; border-radius: 10px; border: 1px solid transparent;
  background: none; color: var(--mute); font: inherit; text-align: left; cursor: pointer; }
.ap .layers .lyr.on { color: var(--ink); background: #ffffff0a; border-color: #6a5236; } .ap .layers .lyr i { font-style: normal; color: var(--gold); }
.ap .layers .lyr b { font-size: 14px; } .ap .layers .lyr span { font-size: 11.5px; color: var(--mute); text-align: right; }
.ap.hide-terr .map .terr { display: none; } .ap.hide-roads .map .ly-roads { display: none; } .ap.hide-marches .map .ly-marches { display: none; }
.ap.hide-labels .map .lbs { display: none; } .ap.hide-flags .map .nd .flag { display: none; } .ap.hide-force .map .nd .foe { display: none; }
.ap.hide-army .map .toks { display: none; } .ap.hide-goods .map .lb .lbg { display: none; }
/* 전쟁을 걸어왔다 · 이웃끼리 전쟁 (app.warCard) */
.ap .warc { display: flex; gap: 10px; align-items: flex-start; margin: 8px 0 12px; padding: 12px; border-radius: 14px; background: linear-gradient(90deg, #3a1410, #1f1710); border: 1px solid #a0483a; position: relative; }
.ap .warc .flord { width: 76px; height: 76px; flex: none; border-radius: 12px; object-fit: cover; border: 2px solid #c8604a; }
.ap .warc img.mood.wm { position: absolute; left: 62px; top: 58px; width: 36px; height: 36px; }
.ap .warc .wb { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.ap .warc .wb b { display: flex; align-items: center; gap: 6px; font-family: 'Gowun Batang', serif; font-size: 19px; color: #ffb09a; }
.ap .warc .wb > span { font-size: 13.5px; } .ap .warc .btns { margin-top: 4px; }
.ap .warbar { display: flex; align-items: center; gap: 6px; margin: 6px 0; padding: 7px 10px; border-radius: 10px; background: #2a1c1a; border: 1px solid #6a3a30; font-size: 14px; }
.ap .warbar i { font-style: normal; color: #ff8a70; font-size: 16px; } .ap .warbar span { margin-left: 4px; }
/* 이주 — 집 옮기기는 개척(갈색)과 갈라 누런 흙빛 */
.ap .sec.move { background: #2e2a14; border: 1px solid #8a7a3a; } .ap .sech.move { background: #2e2a14; color: #e0cc80; }
.ap .btn.pri.move { background: #6a5a22; border-color: #a89048; color: #fff6dc; }
.ap .seg.wrap { flex-wrap: wrap; } .ap .seg.wrap button { flex: 1 0 30%; }
/* 외교의 손 — 보낼 사람 (VICTORY §2-2) */
.ap .hands { display: flex; align-items: center; gap: 10px; margin: 6px 0 8px; padding: 8px 10px; border-radius: 12px; background: #1f1710; border: 1px solid #6a5236; }
.ap .hands .hf { display: flex; flex: none; } .ap .hands .hf span { margin-right: -8px; transition: opacity .2s; } .ap .hands .hf span.used { opacity: .3; }
.ap .hands .hface { width: 34px; height: 34px; border-radius: 50%; object-fit: cover; border: 2px solid #8a7040; background: #3a2c1e; display: block; }
.ap .hands .ht { display: flex; flex-direction: column; margin-left: 8px; min-width: 0; } .ap .hands .ht b { font-size: 14.5px; } .ap .hands .ht span { font-size: 12px; color: var(--mute); }
/* 이기는 길 — 정복 · 맹주 (VICTORY §1) */
.ap .paths { margin: 8px 0 12px; padding: 10px; border-radius: 12px; background: #1f1710; border: 1px solid #4a4030; }
.ap .paths h4 { margin: 0 0 6px; color: var(--gold); flex-wrap: wrap; } .ap .paths h4 small { font-size: 12px; color: #e8d8b0; font-weight: 400; }
.ap .paths .path { display: grid; grid-template-columns: 44px 1fr auto; align-items: center; gap: 8px; margin: 4px 0; font-size: 13px; }
.ap .paths .path.sub, .ap .paths .path.rival { grid-template-columns: auto 1fr; }
.ap .paths .pbar { position: relative; height: 9px; border-radius: 5px; background: #3a2c1e; overflow: hidden; }
.ap .paths .pbar i { position: absolute; left: 0; top: 0; bottom: 0; background: linear-gradient(90deg, #8a6a30, #e0bd78); }
.ap .paths .pbar.pact i { background: linear-gradient(90deg, #3f6f8f, #8fc0e0); }
.ap .paths .clock { display: flex; gap: 3px; } .ap .paths .clock i { width: 12px; height: 12px; border-radius: 50%; border: 1px solid #8fc0e0; }
.ap .paths .clock i.on { background: #8fc0e0; } .ap .paths .path.rival span { color: #e8a08a; }
/* 보고 한 줄 — 그림 · 누가→누구 · 글 (app.reportRow) */
.ap .lines .rrow { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 6px 0; padding: 6px 8px; border-radius: 10px; background: #ffffff08; border-left: 3px solid #4a4030; }
.ap .lines .rrow.mute { opacity: .75; border-left-color: #40352f; }
.ap .lines .rrow img.ri { width: 30px; height: 30px; flex: none; filter: drop-shadow(0 1px 2px #0008); }
.ap .lines .rrow i.ri.dot { width: 8px; height: 8px; border-radius: 50%; background: #6a5a3a; margin: 0 11px; }
.ap .lines .rrow img.rface.rl { width: 34px; height: 34px; border-radius: 50%; object-fit: cover; border: 2px solid var(--gold); flex: none; }
.ap .lines .rflow { display: inline-flex; align-items: center; gap: 4px; flex: none; }
.ap .lines .rflow img.rem { width: 24px; height: 24px; }
.ap .remq { position: relative; display: inline-grid; place-items: center; } .ap .remq img.rem { filter: brightness(0) opacity(.55); }
.ap .remq b { position: absolute; inset: 0; display: grid; place-items: center; font-size: 15px; font-weight: 900; color: #f3e2b8; text-shadow: 0 1px 2px #000; }
.ap .lines .rflow .ar { font-style: normal; color: var(--gold); font-weight: 800; } .ap .lines .rflow .ar.foe { color: #ff8a70; }
.ap .lines .nchip { display: inline-flex; align-items: center; gap: 2px; padding: 1px 6px 1px 2px; border-radius: 9px; background: #2a2418; color: #d9a86a; font-size: 12.5px; font-weight: 700; }
.ap .lines .nchip img.nci { width: 20px; height: 20px; }
.ap .lines .rn { font-size: 17px; color: var(--ink); } .ap .lines .rn.good { color: #ecc862; }
.ap .lines .rtx { flex: 1 1 160px; min-width: 0; font-size: 14.5px; }
.ap .paths .pbar.iron i { background: linear-gradient(90deg, #5a6a7a, #a9c3dc); } .ap .paths .pbar.rite i { background: linear-gradient(90deg, #7a4a6a, #e0a0c8); }
.ap .paths .flags { display: flex; gap: 2px; min-height: 18px; } .ap .paths .flags img { width: 18px; height: 18px; }
.ap .paths .clock.rite i { border-color: #e0a0c8; } .ap .paths .clock.rite i.on { background: #e0a0c8; }
/* 백성 — 보내는 곳 ⟶ 받는 곳을 좌우로 (형: "보낼곳 받을곳은 좌 우로 배치해야 직관적이지") */
.ap .row.mvq { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; } .ap .row.mvq .ar { font-style: normal; color: #e4b878; }
.ap .row.mvq .nchip, .ap .mvq .nchip { display: inline-flex; padding: 1px 7px; border-radius: 9px; background: #2a2418; color: #d9a86a; font-size: 12.5px; font-weight: 700; }
/* 군량 — 계절치 스테퍼 */
.ap .ration { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 8px 0 2px; padding: 8px 10px; border-radius: 12px; background: #2a2418; border: 1px solid #6a5434; }
.ap .ration img.rci { width: 26px; height: 26px; } .ap .ration b { font-size: 14px; }
.ap .twoway { grid-template-columns: 1fr 1fr; } /* 백성 판은 개척·이주 두 칸 */
/* 우리 나라 깃발 — 어디서든 금빛 후광 (기록 · 보고 · 깃발 줄 · 외교) */
.ap img.mine { border-radius: 50%; background: radial-gradient(circle, #ffd27a55 0, #ffd27a00 70%); box-shadow: 0 0 0 1.5px #ffd27a, 0 0 7px 1px #ffd27acc; }
.ap .twoway .sec small { display: block; font-size: 11.5px; color: #a89c84; margin-top: 2px; } .ap .twoway .sec u { text-decoration: none; color: #f3d48a; }
.ap .settlec .gain { margin: 4px 0 6px; padding: 6px 9px; border-radius: 9px; background: #24301f; color: #d8f0c0; font-size: 13px; }
.ap .settlec .gain .gic { width: 20px; height: 20px; vertical-align: middle; margin: 0 2px; }
/* 아래 탭이 여섯 — 폰 세로에서 글이 넘치지 않게 */
/* 「다음 계절」 전에 데려온 판의 맨 위 한 줄 */
.ap .nudge { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 0 0 10px; padding: 8px 10px; border-radius: 10px; background: #3a2a14; border: 1px solid #c9a45a88; font-size: 13px; color: #f3e2b8; }
.ap .nudge span { flex: 1 1 200px; } .ap .nudge .btn { margin-left: auto; }
.ap .nudge .ndgs { flex: 1 1 100%; display: flex; flex-wrap: wrap; gap: 6px; }
.ap .nudge .ndg { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px 3px 3px; border-radius: 999px; border: 1px solid #c9a45a; background: #241a0e; color: #f3e2b8; font: inherit; font-size: 13px; cursor: pointer; }
.ap .nudge .ndf { width: 30px; height: 30px; border-radius: 50%; object-fit: cover; }
/* 카드 상자 — 청동·옻칠 나무 테 (ui/frame-panel.png · 싸움판 위 카드와 한 벌). 겹 클래스로 뒤에 오는 판별 CSS 보다 앞선다 */
.ap.ap :is(.acard, .ncard, .fcard, .hrow, .nacts, .askc, .trade, .splitp, .paths, .warc, .fall, .acct, .exp, .wed, .scouthd, .hands) {
  border: 11px solid transparent; border-image: url(__ART__ui/frame-panel.png?v=3) 118 / 11px stretch; border-radius: 0; background-clip: padding-box; }
.ap.ap :is(.acard.fresh) { box-shadow: none; filter: drop-shadow(0 0 6px #7aa83aaa); }
.ap.ap .hrow.ruler { filter: drop-shadow(0 0 5px #c9a45a88); }
@media (max-width: 420px) { .ap.ap :is(.acard, .ncard, .fcard, .hrow, .nacts, .askc, .trade, .splitp, .paths, .warc, .fall, .acct, .exp, .wed, .scouthd, .hands) { border-width: 9px; border-image-width: 9px; } }
/* 드는 값 — 붉은 ▼ · 물건 그림 · 수 */
.ap .cost { display: inline-flex; align-items: center; gap: 4px; margin-left: 4px; vertical-align: middle; flex-wrap: wrap; }
.ap .cost small { font-size: 11px; color: var(--mute); margin-right: 1px; }
.ap .cost .cg { display: inline-flex; align-items: center; gap: 1px; padding: 0 6px 0 3px; border-radius: 999px; background: #3a1410d0; border: 1px solid #c8503a99; color: #ffd0c0; font-size: 12.5px; font-weight: 700; line-height: 1.5; font-variant-numeric: tabular-nums; }
.ap .cost .cg i { font-style: normal; font-size: 9px; color: #ff6a4a; margin-right: 1px; }
.ap .cost .cgi { width: 16px; height: 16px; object-fit: contain; }
.ap .btn.pri .cost .cg { background: #2a0e08e0; }
.ap .hback { margin: 0 0 6px; }
/* 정찰 고정 📌 */
.ap .srow { display: flex; align-items: stretch; gap: 4px; } .ap .srow > .row { flex: 1; min-width: 0; }
.ap .srow .pin { flex: none; width: 40px; border-radius: 8px; border: 1px solid #5a4630; background: #1f1810; font-size: 16px; filter: grayscale(1) opacity(.45); cursor: pointer; }
.ap .srow .pin.on { filter: none; border-color: #e0b04a; background: #3a2c14; box-shadow: 0 0 8px #e0b04a66; }
/* 보낼 사람 줄 — 얼굴 밑에 맡은 일 · 쉬는 이는 「쉰다」 */
.ap .hands .hf > span { display: inline-flex; flex-direction: column; align-items: center; gap: 1px; vertical-align: top; }
.ap .hands .hf > span small { font-size: 10.5px; line-height: 1.1; max-width: 64px; text-align: center; color: #9fd18b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ap .hands .hf > span.used small { color: #e8c88a; }
/* 누가 가나 — 다른 일을 맡은 이 */
.ap .wg.off { opacity: .55; filter: grayscale(.6); cursor: default; } .ap .wg .busyw { font-style: normal; font-size: 11px; color: #e8a08a; }
/* 군대의 힘 — 그림 칩 넷 (군사 · 무장 · 장수 · 사기) · 눌러 두면 말 (data-tip) */
.ap .pchips { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 4px; }
.ap .pch { position: relative; display: inline-flex; align-items: center; gap: 3px; padding: 1px 7px 1px 3px; border-radius: 999px; background: #2a2016; border: 1px solid #5a4630; font-size: 12.5px; color: #efe3c6; }
.ap .pch .pchi { width: 20px; height: 20px; object-fit: contain; } .ap .pch b { font-variant-numeric: tabular-nums; }
.ap .pch .pchf { width: 22px; height: 22px; border-radius: 50%; object-fit: cover; border: 1px solid #c9a45a; }
.ap .pch > i { font-style: normal; font-size: 11px; color: #ffd27a; } .ap .pch.bad > i { color: #ff8a6a; }
.ap .pch.good { border-color: #9fd18b; background: #1e2a16; } .ap .pch.bad { border-color: #c8603a; background: #2e1a12; }
.ap .pch .pmb { width: 34px; height: 6px; border-radius: 3px; background: #0e0b08; overflow: hidden; box-shadow: inset 0 1px 2px #000c; }
.ap .pch .pmb i { display: block; height: 100%; background: linear-gradient(90deg, #a87a2a, #f6d27a); } .ap .pch.bad .pmb i { background: linear-gradient(90deg, #8a2a1a, #e0583c); } .ap .pch.good .pmb i { background: linear-gradient(90deg, #3f8f3a, #b6f09a); }
/* 판에 들어갈 때 가림막 — 첫 스플래시와 한 벌 (문장 · 단청 막대) */
.ap .loadcov { position: fixed; inset: 0; z-index: 9998; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 22px;
  background: radial-gradient(ellipse at 50% 42%, #2a2218 0, #14110d 55%, #0a0907 100%); transition: opacity .5s ease, visibility .5s; }
.ap .loadcov.out { opacity: 0; visibility: hidden; }
.ap .loadcov > img { width: min(30vw, 130px); aspect-ratio: 1; filter: drop-shadow(0 0 18px #f0c86a77); }
.ap .loadcov .lbar { width: min(66vw, 340px); height: 20px; padding: 3px; box-sizing: content-box; border-radius: 3px; background: linear-gradient(#0b0806, #1a120c);
  box-shadow: inset 0 1px 3px #000, 0 0 0 1px #c9a45a, 0 0 0 3px #2a1c0e, 0 0 0 4px #8a6a3a, 0 6px 16px #000a; }
.ap .loadcov .lbar i { display: block; height: 100%; width: 0; background: url(__ART__ui/dancheong-tile.jpg) 0 50% / auto 100% repeat-x;
  box-shadow: 0 0 10px #ffd27a55, inset -2px 0 0 #fff4c8aa; transition: width .3s cubic-bezier(.3, .8, .4, 1); }
/* 위 띠 수가 바뀔 때 — 늘면 위로 톡, 줄면 붉게 한 번 흔들 · 곁에 +/− 가 떠올랐다 사라진다 */
.ap .top .stat { position: relative; }
.ap .top .stat.bump b { animation: statbump .45s cubic-bezier(.3, 1.6, .5, 1); }
.ap .top .stat.dent b { animation: statdent .4s ease-out; }
@keyframes statbump { 0% { transform: scale(1); } 35% { transform: scale(1.22); color: #b6f09a; } 100% { transform: scale(1); } }
@keyframes statdent { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-3px); color: #ff8a6a; } 60% { transform: translateX(2px); color: #ff8a6a; } }
/* 줄면 붉은 수가 수 위에서 튕겨 나가고, 늘면 초록 수가 위에서 튀어 들어온다 (형 10-23: "감소 숫자가 너무 밑에서 발생하느라 없어져 버렸어") */
.ap .top .tr { overflow-x: clip; overflow-y: visible; }
.ap .top .dpop { position: absolute; left: 60%; top: 50%; font-style: normal; font-size: 13px; font-weight: 900; pointer-events: none; white-space: nowrap;
  text-shadow: 0 1px 2px #000, 0 0 6px #000, 0 0 2px #000; z-index: 5; }
.ap .top .dpop.down { color: #ff7a5a; animation: dpopout .9s cubic-bezier(.2, .7, .4, 1) both; }
.ap .top .dpop.up { color: #9ff07a; animation: dpopin .9s cubic-bezier(.3, 1.4, .5, 1) both; }
@keyframes dpopout { 0% { opacity: 1; transform: translate(-50%, -50%) scale(1.35); } 30% { opacity: 1; transform: translate(-20%, -130%) rotate(10deg) scale(1.1); } 100% { opacity: 0; transform: translate(20%, -240%) rotate(18deg) scale(.9); } }
@keyframes dpopin { 0% { opacity: 0; transform: translate(-50%, -260%) scale(.8); } 45% { opacity: 1; transform: translate(-50%, -50%) scale(1.35); } 75% { opacity: 1; transform: translate(-50%, -50%) scale(1); } 100% { opacity: 0; transform: translate(-50%, -50%) scale(1); } }
@media (prefers-reduced-motion: reduce) { .ap .top .stat b, .ap .top .dpop { animation: none !important; } }
/* 백성 배치 — 모아 둔 백성 통 · 고을 카드마다 −/+ */
.ap .plpool { position: sticky; top: 0; z-index: 2; display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; margin: 6px 0 8px; padding: 10px 14px; border-radius: 10px;
  background: linear-gradient(#2a2216f2, #1c160ef2); border: 1px solid #6a5434; box-shadow: 0 4px 12px #0008; }
.ap .plpool > span { color: var(--mute); font-size: 13px; } .ap .plpool > b { font-size: 22px; color: #e8dcc4; font-variant-numeric: tabular-nums; }
.ap .plpool > small { flex: 1 1 100%; color: var(--mute); font-size: 12px; display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.ap .plpool.full { border-color: #e0b04a; box-shadow: 0 0 0 1px #e0b04a66, 0 0 16px #e0b04a44; } .ap .plpool.full > b { color: #ffd27a; animation: plpulse 1.2s ease-in-out infinite alternate; }
@keyframes plpulse { from { opacity: .75; } to { opacity: 1; } }
.ap .plcard { margin: 0 0 8px; padding: 9px 10px; border-radius: 10px; background: #1f1a14; border: 1px solid #3a3024; transition: border-color .2s, background .2s; }
/* 이번 계절 할 일 — 다음 계절 단추 위 */
.ap .todo { position: absolute; right: 14px; bottom: calc(var(--tabh) + 78px); z-index: 6; max-width: min(78vw, 360px); }
.ap .todo:empty { display: none; }
.ap .todochip { padding: 8px 14px; border-radius: 999px; border: 1px solid #e0b860; background: #2a1f10f0; color: #ffe6b0; font: inherit; font-size: 13.5px; font-weight: 700; text-align: left; cursor: pointer; box-shadow: 0 4px 14px #000a; animation: todoglow 1.6s ease-in-out infinite alternate; }
@keyframes todoglow { to { box-shadow: 0 0 16px #ffd27a99; } }
/* 잠긴 탭 · 새로 열린 탭 */
.ap .tabs button.locked { opacity: .38; filter: grayscale(1); cursor: default; }
.ap .tabs button.fresh { animation: tabfresh 1s ease-in-out 4 alternate; } @keyframes tabfresh { to { box-shadow: 0 0 18px #ffd27a; background: #4a3a18; } }
.ap .tabtoast { position: absolute; left: 50%; bottom: calc(76px + env(safe-area-inset-bottom)); transform: translateX(-50%); z-index: 60; display: flex; flex-direction: column; gap: 2px; max-width: min(92vw, 440px);
  padding: 9px 14px; border-radius: 12px; background: #2a1f10f2; border: 1px solid #e0b860; box-shadow: 0 6px 20px #000a; cursor: pointer; animation: updin .35s ease-out both; }
.ap .tabtoast b { color: #ffd27a; } .ap .tabtoast span { color: #e8dcc0; font-size: 13.5px; }
/* 사신의 청 그림 */
.ap img.aic { width: 26px; height: 26px; vertical-align: middle; margin-right: 4px; object-fit: contain; } .ap img.aic.big { width: 40px; height: 40px; }
/* 교환 — 깃발 둘과 화살표 */
.ap .tflow { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 6px 0 8px; }
.ap .tflow .tfs { display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 64px; } .ap .tflow .tfs small { font-size: 12px; color: var(--mute); }
.ap .tflow .tfl { width: 48px; height: 48px; }
.ap .tflow .tfa { flex: 1; display: flex; flex-direction: column; align-items: center; } .ap .tflow .tfa i { font-style: normal; font-size: 30px; line-height: 1; color: #f0d090; }
.ap .tflow .tfa.r i { color: #ffb070; } .ap .tflow .tfa.l i { color: #9fd18b; } .ap .tflow .tfa small { font-size: 12px; color: #e8dcc0; }
/* 앱으로 설치 카드 */
.ap .instc { margin: 10px auto; max-width: 420px; padding: 10px 12px; border-radius: 12px; border: 1px solid #c9a45a; background: #1f1710ee; text-align: left; }
.ap .instc > b { color: #f3d48a; } .ap .instc p { margin: 6px 0; font-size: 13.5px; line-height: 1.5; color: #e8dcc0; }
.ap .instc .instr { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; } .ap .instc .chk { font-size: 13px; color: #cfc6b4; margin-right: auto; }
/* 침략 알림 — 붉게 */
.ap .cere.invade { background: #0b0605; }
/* 그림은 또렷하게 — 글자 자리만 아래를 어둡게 (형 10-25: "정말 침략당하는 이미지로") */
.ap .cere.invade .cbg { opacity: .92; filter: saturate(1.05) contrast(1.05); }
.ap .cere.invade::after { content: ''; position: absolute; inset: 0; z-index: 0; pointer-events: none; background: linear-gradient(#0000 35%, #0b0605cc 72%, #0b0605f0); }
.ap .cere.invade .cw { position: relative; z-index: 2; }
.ap .cere.invade .ifx { position: absolute; inset: 0; z-index: 1; pointer-events: none; overflow: hidden; }
/* 침략 — 불티가 피어오른다 */
.ap .cere.invade .emb { position: absolute; left: var(--x); bottom: -10px; width: var(--s); height: var(--s); border-radius: 50%; background: #ffb050; box-shadow: 0 0 8px #ff7a20, 0 0 16px #ff5a10; animation: iemb var(--d) linear var(--t) infinite; }
@keyframes iemb { 0% { transform: translate(0, 0); opacity: 0; } 10% { opacity: 1; } 100% { transform: translate(var(--w), -95vh); opacity: 0; } }
/* 공성 — 화살이 성벽 쪽으로 쏟아진다 · 처음 한 번 흔들린다 */
.ap .cere.invade.k-siege { animation: ishake .5s ease-out .15s both; }
@keyframes ishake { 0%, 100% { transform: none; } 20% { transform: translate(-6px, 3px); } 40% { transform: translate(5px, -4px); } 60% { transform: translate(-3px, 2px); } 80% { transform: translate(2px, -1px); } }
.ap .cere.invade .iarw { position: absolute; left: var(--x); top: -12%; width: 46px; transform: rotate(118deg); opacity: 0; animation: iarw var(--d) ease-in var(--t) 3 both; }
@keyframes iarw { 0% { transform: translate(0, 0) rotate(118deg); opacity: 0; } 15% { opacity: 1; } 100% { transform: translate(-30vw, 70vh) rotate(118deg); opacity: 0; } }
.ap .cere.invade .idust { position: absolute; left: 50%; bottom: 18%; width: 60%; transform: translateX(-50%); opacity: 0; animation: idust 1.4s ease-out .9s both; }
.ap .cere.invade .idust.c { bottom: 40%; width: 46%; animation-delay: .75s; }
@keyframes idust { 0% { opacity: 0; transform: translateX(-50%) scale(.6); } 30% { opacity: .75; } 100% { opacity: 0; transform: translateX(-50%) scale(1.3); } }
/* 조우 — 우리 깃발과 적 깃발이 양쪽에서 달려와 맞부딪힌다 */
.ap .cere.invade .iflag { position: absolute; top: 26%; width: 92px; height: 120px; background: var(--fc); clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 82%, 0 100%); display: flex; align-items: flex-start; justify-content: center; padding-top: 18px; box-sizing: border-box; box-shadow: inset 0 0 0 3px #0005; }
.ap .cere.invade .iflag img { width: 52px; height: 52px; filter: drop-shadow(0 2px 3px #000a); }
.ap .cere.invade .iflag.l { left: 50%; animation: iflagl .8s cubic-bezier(.3, 1.4, .5, 1) .15s both; } .ap .cere.invade .iflag.r { right: 50%; animation: iflagr .8s cubic-bezier(.3, 1.4, .5, 1) .15s both; }
@keyframes iflagl { 0% { transform: translateX(-60vw) rotate(-8deg); } 100% { transform: translateX(-112%) rotate(-4deg); } }
@keyframes iflagr { 0% { transform: translateX(60vw) rotate(8deg); } 100% { transform: translateX(112%) rotate(4deg); } }
/* 기습 — 어둠이 가장자리에서 조여 온다 */
.ap .cere.invade .idark { position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 50%, #0000 30%, #000c 80%); animation: idark 2.4s ease-in-out infinite alternate; }
@keyframes idark { from { opacity: .55; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .ap .cere.invade, .ap .cere.invade .emb, .ap .cere.invade .iarw, .ap .cere.invade .iflag, .ap .cere.invade .idark, .ap .cere.invade .idust { animation: none !important; } .ap .cere.invade .emb, .ap .cere.invade .iarw, .ap .cere.invade .idust { display: none; } }
.ap .cere.invade .cw > b { color: #ffb4a4; text-shadow: 0 0 22px #e04a3a, 0 3px 6px #000; }
.ap .cere.invade .iem { width: 40px; height: 40px; vertical-align: middle; margin-right: 6px; }
/* 정찰 칸 — 보내기와 고정을 떼어 놓는다 (형 10-24) */
.ap .scoutbox { display: flex; flex-direction: column; gap: 10px; margin: 6px 0; } .ap .scoutbox .keepbtn { align-self: flex-start; margin-top: 4px; }
.ap .plcard.off { opacity: .55; } .ap .plcard.off p { margin: 4px 0 0; font-size: 12.5px; }
.ap .plcard.up { border-color: #6fae5a; background: #1c2416; } .ap .plcard.down { border-color: #b8784a; background: #261c14; }
.ap .plch { display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; margin-bottom: 6px; } .ap .plch b { font-size: 15px; }
.ap .pltag { font-size: 11.5px; padding: 1px 7px; border-radius: 999px; } .ap .pltag.rv { background: #183048; color: #a8d4ff; border: 1px solid #3a6a9a; } .ap .pltag.hl { background: #2e2618; color: #d8c090; border: 1px solid #6a5a3a; }
.ap .plrow { display: flex; align-items: center; gap: 8px; } .ap .plrow > .btn { flex: none; min-width: 54px; font-variant-numeric: tabular-nums; }
.ap .plmid { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; } .ap .plmid > b { font-size: 15px; font-variant-numeric: tabular-nums; }
.ap .plmid > b i { font-style: normal; font-size: 12.5px; color: #9fd18b; } .ap .plcard.down .plmid > b i { color: #f0a070; }
.ap .plmid > small { font-size: 12px; color: var(--mute); display: flex; align-items: center; flex-wrap: wrap; gap: 2px; } .ap .plmid > small small { opacity: .7; font-size: 11px; }
.ap .plmid .gic { width: 18px; height: 18px; object-fit: contain; vertical-align: -4px; margin: 0 1px; }
.ap .plbar { display: block; height: 6px; border-radius: 3px; background: #0e0b08; box-shadow: inset 0 1px 2px #000c; overflow: hidden; }
.ap .plbar i { display: block; height: 100%; border-radius: 3px; background: linear-gradient(90deg, #8a6a2a, #e0b04a); transition: width .2s; }
.ap .plfoot { position: sticky; bottom: 0; padding: 8px 0; background: linear-gradient(#0000, var(--bg, #14110d) 30%); }
/* 이끌 장수 — 얼굴과 이름 (출정 단추 줄과 따로) */
.ap .leadrow { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 8px; padding-top: 8px; border-top: 1px dashed #4a3a28; }
.ap .leadrow > .mute { flex: 1 1 100%; font-size: 12px; }
.ap .btn.lead { gap: 6px; padding-left: 4px; }
.ap .btn.lead .lf { width: 34px; height: 34px; border-radius: 50%; object-fit: cover; border: 2px solid #c9a45a; }
.ap .btn.lead span { display: flex; flex-direction: column; align-items: flex-start; line-height: 1.2; } .ap .btn.lead small { font-size: 11px; opacity: .8; }
.ap .banner .txw { flex: 1 1 auto; min-width: 0; }
.ap .tabs button { min-width: 0; } .ap .tabs button span { white-space: nowrap; }
@media (max-width: 420px) { .ap .tabs button img.tic { width: 28px; height: 28px; } .ap .tabs button { font-size: 11.5px; } }
`

/**
 * 계절 입자 — 봄 꽃잎 · 여름 장맛비 · 가을 잎 · 겨울 눈이 지도 위로 흩날린다 (그림 realm/fx · 제미나이)
 * 지도를 가리지 않게 성기고 옅게. 누르기는 지나간다. 움직임을 줄이라는 기기에선 안 띄운다.
 * __ART__ 는 app.ts 가 바꿔 넣는다.
 */
export const SEASONP_CSS = `
.ap .seasonp { position: absolute; left: 0; right: 0; top: calc(var(--toph) + var(--legh)); bottom: var(--tabh); pointer-events: none; overflow: hidden; z-index: 5; /* 지도 속 가장 높은 것(이름표 5)보다 뒤에 와 그 위로 — 눈이 도읍 뒤에 가려지지 않게 (형 10-23) · 첫 화면은 지도 층 안에 있어 묶으면 안 된다 */
  --sz: 22px; --sp: 1s; --op: .8; }
.ap.choosing .seasonp, .ap.war-open .seasonp, .ap:has(.nightov) .seasonp { display: none; } /* 밤 판·싸움 창 밑에서는 쉬게 — 화면 일을 나눠 쓴다 */
/* 입자 하나하나 — 자리 --x · 크기 --z · 빠르기 --d · 시작 --t · 흔들림 --w · 띠의 칸 --c 는 app.ts(seasonParticles)가 준다.
   그림은 덩어리에서 낱낱이 잘라 낸 여덟 칸 띠 (tools/particle-strip.mjs — 형: "뭉탱이로 내리고 … 개별적으로 흩날려야") */
.ap .seasonp i { position: absolute; top: -48px; left: var(--x); width: calc(var(--z) * var(--sz)); aspect-ratio: 1; opacity: var(--op);
  background: 0 0 / 800% 100% no-repeat; background-position-x: calc(var(--c) * 100% / 7);
  /* 떨어지기(아래로 고르게) · 흔들기(좌우로 부드럽게 오가기) · 돌기를 따로 — 한 줄에 꺾어 넣으면 꺾일 때마다 툭툭 끊겼다 (형 10-23: "프레임 너무 안 좋아 보이고 버벅거리는데") */
  animation: spfall calc(var(--d) * var(--sp)) linear calc(var(--t) * var(--sp)) infinite,
    spsway calc(var(--d) * var(--sp) * .22) ease-in-out calc(var(--t) * var(--sp)) infinite alternate,
    spspin calc(var(--d) * var(--sp) * .45) ease-in-out calc(var(--t) * var(--sp)) infinite alternate;
  will-change: translate, transform, rotate; backface-visibility: hidden; }
/* 봄 꽃비는 작고 성기게 — 셋에 하나만 (형 10-23: "너무 크고 너무 많이 내려. 좀 적당히") */
.ap .seasonp[data-s="spring"] { --sz: 12px; --op: .7; --sp: 1.25s; } .ap .seasonp[data-s="spring"] i { background-image: url(__ART__fx/petals-strip.png); }
.ap .seasonp[data-s="spring"] i:not(:nth-child(3n)) { display: none; }
.ap .seasonp[data-s="autumn"] { --sz: 20px; --sp: 1.1s; --op: .8; } .ap .seasonp[data-s="autumn"] i { background-image: url(__ART__fx/leaves-strip.png); }
.ap .seasonp[data-s="autumn"] i:not(:nth-child(3n)) { display: none; } /* 낙엽도 셋에 하나 · 작게 (형 10-23: "가을 낙엽도 너무 많아") */
/* 눈 — 대부분 결정 없는 작은 송이(둥근 점), 넷에 하나만 결정. 희어서 밝은 땅에 묻히니 옅은 테두리 */
.ap .seasonp[data-s="winter"] { --sz: 18px; --sp: 1.3s; --op: .9; } .ap .seasonp[data-s="winter"] i { background-image: url(__ART__fx/snow-strip.png); animation-name: spfall, spsway; }
.ap .seasonp[data-s="winter"] i.o { width: calc(var(--z) * 9px); border-radius: 50%; background: radial-gradient(circle, #fff 0 48%, #fff0 74%); box-shadow: 0 0 2px 1px #52637f88; }
/* 여름 장맛비 — 빗줄기 하나하나가 빠르게 비스듬히 (그림자·어둡게는 그림에 구워 둠) */
.ap .seasonp[data-s="summer"] { --sz: 42px; --sp: .11s; --op: .75; } .ap .seasonp[data-s="summer"] i { background-image: url(__ART__fx/rain-strip.png); animation-name: sprain; }
@keyframes spfall { from { translate: 0 0; } to { translate: 0 calc(100vh + 96px); } }
@keyframes spsway { from { transform: translateX(calc(var(--w) * -1)); } to { transform: translateX(var(--w)); } }
@keyframes spspin { from { rotate: -50deg; } to { rotate: 170deg; } }
@keyframes sprain { from { transform: translate(0, 0); } to { transform: translate(-45vh, calc(100vh + 96px)); } }
@media (prefers-reduced-motion: reduce) { .ap .seasonp { display: none; } }
`

/** 계정 칸 · 갈라진 판 고르기 (docs/realm/SERVER.md) */
export const CLOUD_CSS = `
.ap .acct { padding: 10px 12px; border-radius: 12px; background: var(--card); border: 1px solid var(--line); margin-bottom: 14px; }
.ap .acct p { margin: 4px 0; } .ap .btn.danger { color: #f0a090; border-color: #6a3a32; }
.ap .acctl { margin-top: 6px; } .ap .acctl .btn { padding: 4px 12px; }
.ap .cloudpick { position: absolute; inset: 0; z-index: 90; display: flex; align-items: center; justify-content: center; padding: 16px; background: #0b0d11e6; }
.ap .cloudpick > div { max-width: 520px; width: 100%; } .ap .cloudpick h3 { text-align: center; }
.ap .cloudpick .pickrow { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px; }
.ap .cloudpick .pickc { display: flex; flex-direction: column; gap: 4px; align-items: center; padding: 16px 10px; border-radius: 14px; }
.ap .cloudpick .pickc b { font-family: var(--serif); font-size: 20px; color: var(--gold); } .ap .cloudpick .pickc small { color: var(--mute); }
`

/**
 * 손으로 만든 결 — 단추와 판을 그림(9칸 늘이기)으로 (형 2026-10-22: "버튼이나 ui 스타일도 생 css 같은 걸로 만든 거 같지 않게 … 이미지를 교묘히").
 * 그림: realm/ui/ — 어두운 쇠판(보조 단추) · 금빛 청동판(주 단추 · 다음 계절) · 옻칠 나무에 청동 테(시트·보고판). 제미나이 · tools/nine-slice.mjs
 * 그림의 가운데 기둥은 한 줄로 고르게 해 두어, 단추가 길어져도 무늬가 늘어나 보이지 않는다. __ART__ 는 app.ts 가 바꿔 넣는다.
 */
export const UI_CSS = `
.ap .btn { border-style: solid; border-color: transparent; border-width: 9px 12px; border-radius: 0; background: none;
  border-image: url(__ART__ui/btn-dark.png?v=2) 30 33 fill / 9px 12px stretch; padding: 3px 6px; color: #efe3c6; text-shadow: 0 1px 2px #000c;
  transition: filter .12s, transform .06s; }
.ap .btn:hover { filter: brightness(1.12); } .ap .btn:active:not(:disabled) { transform: translateY(1px) scale(.96); filter: brightness(.9); transition-duration: .08s; }
.ap .btn:not(:active) { transition: filter .12s, transform .16s cubic-bezier(.3, 1.8, .5, 1); }
/* 금빛 판은 「누르면 나아가는 단추」(go)에만 — 골라 둔 것(on)은 쇠판에 금테와 ✓ (형: "선택한 적 없는데 선택되어 있는 버튼") */
.ap .btn.pri { border-image-source: url(__ART__ui/btn-gold.png?v=2); border-image-slice: 30 35 fill; color: #2a1606; font-weight: 700; text-shadow: 1px 1px 0 #f7dc9a; }
.ap .btn.on { box-shadow: 0 0 0 2px #e0bd78, 0 0 10px #e0bd7888; color: #ffe2a0; filter: none; }
.ap .btn.on::before { content: '✓ '; color: #ffd27a; }
.ap .btn.ghost { color: #c9bea6; filter: saturate(.7) brightness(.92); } .ap .btn.ghost:hover { filter: saturate(.8) brightness(1.05); }
.ap .btn:disabled, .ap .btn:disabled:hover { filter: grayscale(.7) brightness(.7); opacity: .6; transform: none; }
.ap .btn.sm { border-width: 7px 9px; border-image-width: 7px 9px; padding: 1px 4px; }
.ap .btn.wide { padding: 7px 8px; } .ap .btn.big { padding: 7px 18px; }
.ap .btn.pri.men { filter: hue-rotate(-28deg) saturate(1.25); } .ap .btn.pri.home, .ap .btn.pri.move { filter: saturate(.85); }
/* 다음 계절 — 큰 금빛 판 */
.ap .next { border-style: solid; border-color: transparent; border-width: 12px 16px; border-radius: 0; background: none; box-shadow: none;
  border-image: url(__ART__ui/btn-gold.png?v=2) 30 35 fill / 12px 16px stretch; padding: 4px 10px; color: #2a1606; text-shadow: 1px 1px 0 #f7dc9a;
  filter: drop-shadow(0 6px 12px #000b); }
/* 아래 판(시트) · 보고판 — 옻칠한 나무에 청동 테 */
.ap .sheet { border: 18px solid transparent; border-image: url(__ART__ui/panel.png?v=2) 64 fill / 18px stretch; background: none; border-radius: 0; padding: 0 2px 6px; }
.ap .mcard { border: 18px solid transparent; border-image: url(__ART__ui/panel.png?v=2) 64 fill / 18px stretch; background: none; border-radius: 0; padding: 4px; }
/* 위 띠 · 아래 탭 — 옻칠한 널판에 청동 띠 */
.ap .top { border: 0 solid transparent; border-width: 0 0 5px; border-image: url(__ART__ui/bar.png?v=1) 14 0 fill / 0 0 5px stretch; background: none; }
.ap .tabs { border: 0 solid transparent; border-width: 5px 0 0; border-image: url(__ART__ui/bar.png?v=1) 14 0 fill / 5px 0 0 stretch; background: none; }
/* 판 안의 카드 · 「이어 하기」 — 짙은 밤빛 판에 가는 청동 줄 · 모서리 징 */
.ap .acard, .ap .ncard:not(.pick), .ap .fcard, .ap .front .cont { border: 10px solid transparent; border-radius: 0; background: none;
  border-image: url(__ART__ui/card.png?v=1) 24 fill / 10px stretch; padding: 2px; }
/* 판 안의 작은 칸들 — 푸른 잿빛 대신 나무판에 어울리는 짙은 밤빛 · 청동빛 줄 */
.ap { --card: #2a1f16; --line: #4d3b26; }
/* 글씨 — 판 위에서 또렷하게 (형: "버튼이 까매서 글씨도 까매가지고 안보이는경우 · 글씨가 너무 얇아서 안보이는경우도")
   쇠판 단추는 늘 밝은 글씨, 금빛 판은 늘 짙은 글씨 · 단추 글씨는 굵게 */
.ap .btn, .ap .seg button, .ap .next { font-weight: 700; }
.ap .btn:not(.pri) .mute, .ap .btn:not(.pri) small, .ap .seg button:not(.on) .mute { color: #cbbf9f; }
.ap .btn.pri .mute, .ap .btn.pri small, .ap .seg button.on .mute { color: #4a2e10; }
.ap .btn.pri.men, .ap .btn.pri.home, .ap .btn.pri.move { color: #2a1606; }
.ap .btn.danger { color: #ffb4a4; }
.ap .btn:disabled { color: #c8bda8; }
/* 얇은 글씨 — 흐린 말은 한 단 밝게 · 판 안 글씨는 그림자로 가장자리를 세우고, 작은 글씨는 획을 살짝 두껍게 */
.ap { --mute: #ada391; }
.ap .tabs button { font-size: 13px; color: #cdbf9f; font-weight: 700; } .ap .tabs button.on { color: var(--gold); }
.ap .sheet, .ap .modal, .ap .tipb { text-shadow: 0 1px 1px #0009; }
.ap .sheet .mute, .ap .sheet small, .ap .modal .mute, .ap .modal small, .ap .tabs button, .ap .legend .lg { -webkit-text-stroke: .25px currentColor; }
.ap .sheet, .ap .modal, .ap .front { scrollbar-color: #8a6a3a #1f1710; }
/* 판 손잡이 — 옻칠 나무 빛에 청동 손잡이 */
.ap .grip { background: #26170d; } .ap .grip::after { background: #8a6a3a; box-shadow: 0 1px 0 #0008; }
/* 마디 단추 — 작은 쇠판, 고른 것은 금빛 */
.ap .seg { border: 0; border-radius: 0; overflow: visible; gap: 3px; }
.ap .seg button { border: 6px solid transparent; border-image: url(__ART__ui/btn-dark.png?v=2) 30 33 fill / 6px 8px stretch; background: none; padding: 0 2px; color: #d8cdb4; }
.ap .seg button.on { border-image-source: url(__ART__ui/btn-gold.png?v=2); border-image-slice: 30 35 fill; background: none; color: #2a1606; font-weight: 700; }
`
