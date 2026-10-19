/**
 * 칠십팔국 앱 화면의 옷 (docs/realm/FLOW.md §5) — 모바일 게임처럼: 한 화면에 꽉 · 아래 탭 · 올라오는 판 · 떠 있는 단추.
 * 움직임은 CSS 전환뿐이다 (rAF·타이머 없음 — 절대 규칙 4).
 */
export const APP_CSS = `
html, body { margin: 0; height: 100%; overflow: hidden; background: #14181e; overscroll-behavior: none; }
.ap { --gold: #d9b36a; --ink: #e9e2d4; --mute: #8f887b; --card: #222833; --line: #343c49; --good: #8fd07a; --bad: #e08a74;
  --tabh: calc(62px + env(safe-area-inset-bottom)); --toph: calc(48px + env(safe-area-inset-top)); --legh: 34px;
  position: fixed; inset: 0; color: var(--ink); font: 15px/1.45 system-ui, -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;
  -webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-select: none; }
.ap h1, .ap h2, .ap h3, .ap .top b, .ap .next, .ap .brag { font-family: 'Gowun Batang', 'Apple SD Gothic Neo', serif; }
.ap h3 { margin: 4px 0 10px; font-size: 19px; color: var(--gold); } .ap h4 { margin: 14px 0 6px; font-size: 14px; color: var(--mute); font-weight: 600; }
.ap p { margin: 6px 0; } .ap .mute { color: var(--mute); font-size: 13px; }
.ap img.ic { width: 22px; height: 22px; vertical-align: -6px; margin-right: 2px; }
.ap img.em { width: 20px; height: 20px; vertical-align: -5px; margin-right: 4px; }

/* 위 상태 줄 */
.ap .top { position: absolute; left: 0; right: 0; top: 0; height: var(--toph); padding: env(safe-area-inset-top) 10px 0; box-sizing: border-box;
  display: flex; align-items: center; justify-content: space-between; gap: 8px; z-index: 5;
  background: linear-gradient(#0f1217f0, #0f1217c0); border-bottom: 1px solid #2a313c; }
.ap .top .tl { display: flex; align-items: center; gap: 6px; font-size: 16px; white-space: nowrap; }
.ap .top img.sic { width: 30px; height: 30px; }
.ap .top .tr { display: flex; align-items: center; gap: 10px; overflow: hidden; }
.ap .top .stat { display: flex; align-items: center; gap: 2px; font-size: 15px; white-space: nowrap; }
.ap .top .stat b { font-family: 'Bahnschrift', 'Barlow Condensed', system-ui, sans-serif; font-variant-numeric: tabular-nums; }
@media (max-width: 520px) { .ap .top .stat.nat b { display: none; } .ap .top .tr { gap: 6px; } }

/* 지도 — 남은 자리를 꽉. 폰 세로에서는 옆으로 민다 */
.ap .mapwrap { position: absolute; left: 0; right: 0; top: calc(var(--toph) + var(--legh)); bottom: var(--tabh); overflow: auto;
  background: #1a1d22; scrollbar-width: none; touch-action: pan-x pan-y; cursor: grab; }
.ap .mapwrap.dragging { cursor: grabbing; }
/* 확대·축소 단추 — 지도 왼쪽 아래 */
.ap .zbtns { position: absolute; left: 12px; bottom: calc(var(--tabh) + 14px); z-index: 6; display: flex; flex-direction: column; gap: 6px; }
.ap .zbtns button { width: 42px; height: 42px; border-radius: 12px; border: 1px solid #4a5363; background: #1b2028e6; color: var(--ink);
  font-size: 22px; cursor: pointer; box-shadow: 0 4px 10px #0008; }
.ap.sheet-open .zbtns, .ap.choosing .zbtns { display: none; }
.ap .mapwrap::-webkit-scrollbar { display: none; }

/* 깃발 줄 — 지도 왼쪽 위에 떠 있다. 누르면 그 나라 땅만 또렷하다 */
.ap .legend { position: absolute; left: 0; right: 0; top: var(--toph); height: var(--legh); box-sizing: border-box; z-index: 4; display: flex;
  align-items: center; gap: 4px; padding: 0 8px; overflow-x: auto; scrollbar-width: none; background: #0f1217; border-bottom: 1px solid #2a313c; }
.ap .legend::-webkit-scrollbar { display: none; } .ap .legend .lg { pointer-events: auto; flex: none; }
.ap .lg { display: flex; align-items: center; gap: 4px; padding: 2px 8px 2px 3px; border-radius: 16px; border: 1px solid #0006;
  background: color-mix(in srgb, var(--c) 30%, #14181ee0); color: #fff; font: inherit; font-size: 12px; cursor: pointer;
  box-shadow: 0 2px 6px #0007; border-left: 5px solid var(--c); }
.ap .lg img.lem { width: 22px; height: 22px; } .ap .lg b { font-size: 14px; min-width: 1em; }
.ap .lg span { display: none; } .ap .lg.on span, .ap .lg.me span { display: inline; }
.ap .lg.on { border-color: #fff; background: color-mix(in srgb, var(--c) 55%, #14181e); }
.ap .lg.gone { opacity: .45; }
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
  display: flex; background: #0f1217; border-top: 1px solid #2a313c; z-index: 8; }
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
  -webkit-overflow-scrolling: touch; background: #1b2028; border-radius: 18px 18px 0 0; border-top: 1px solid #3a4250;
  padding: 0 14px 18px; box-sizing: border-box; z-index: 7; transform: translateY(105%); transition: transform .22s ease-out;
  box-shadow: 0 -8px 24px #0009; user-select: text; -webkit-user-select: text; }
.ap.sheet-open .sheet { transform: none; }
.ap:not(.sheet-open) .sheet { visibility: hidden; transition: transform .22s ease-out, visibility 0s .22s; }
@media (min-width: 900px) { .ap .sheet { left: auto; right: 12px; width: 440px; bottom: calc(var(--tabh) + 8px); border-radius: 16px; max-height: calc(100% - var(--tabh) - var(--toph) - 20px); } }
.ap .grip { position: sticky; top: 0; height: 22px; margin: 0 -14px 4px; background: #1b2028; cursor: pointer; z-index: 1; }
.ap .grip::after { content: ''; position: absolute; left: 50%; top: 9px; width: 42px; height: 4px; margin-left: -21px; border-radius: 2px; background: #4a5363; }

/* 판 안의 것들 */
.ap .btn { display: inline-flex; align-items: center; gap: 4px; padding: 7px 12px; border-radius: 10px; border: 1px solid #4a5363; background: #2a313c;
  color: var(--ink); font: inherit; font-size: 14px; cursor: pointer; text-decoration: none; }
.ap .btn.on { background: linear-gradient(#a57a31, #7d5a22); border-color: #e0bd78; color: #fff4dc; }
.ap .btn.ghost { background: transparent; color: var(--mute); } .ap .btn:disabled { opacity: .4; cursor: default; }
.ap .btn.sm { padding: 3px 9px; font-size: 13px; margin-left: auto; } .ap .btn.wide { width: 100%; justify-content: center; margin-top: 10px; padding: 11px; }
.ap .btns { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.ap .banner { display: flex; align-items: center; gap: 8px; padding: 8px 10px; margin: 6px 0; border-radius: 10px; background: #2a2f38; font-size: 14px; }
.ap .banner.good { background: #24331f; color: #cfeabf; } .ap .banner.bad { background: #3a2622; color: #f1c6b8; }
.ap .acard, .ap .ncard, .ap .fcard { display: flex; gap: 10px; padding: 10px; margin: 8px 0; border-radius: 14px; background: var(--card); border: 1px solid var(--line); }
.ap .ncard, .ap .fcard { flex-direction: column; gap: 6px; }
.ap .acard .ab { flex: 1; min-width: 0; }
.ap .seasonfx { position: absolute; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center; pointer-events: none;
  background: radial-gradient(circle, #0009 0, #0000 70%); animation: sfx 2.2s ease-out forwards; }
.ap .seasonfx .band { position: absolute; left: 0; right: 0; top: 50%; height: min(52vh, 340px); transform: translateY(-50%);
  background: #14181e center / cover no-repeat; -webkit-mask-image: linear-gradient(to bottom, #0000, #000 16%, #000 84%, #0000);
  mask-image: linear-gradient(to bottom, #0000, #000 16%, #000 84%, #0000); animation: sfxband 2.2s ease-out forwards; }
.ap .seasonfx > div { position: relative; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 18px 34px; border-radius: 18px;
  background: #14181ee8; border: 1px solid #8a7040; box-shadow: 0 8px 40px #000a; animation: sfxin 1.6s cubic-bezier(.2, 1.4, .4, 1) forwards; }
.ap .seasonfx b { font-family: 'Gowun Batang', serif; font-size: 30px; color: var(--gold); letter-spacing: 2px; }
.ap .seasonfx span { font-size: 13.5px; color: #d8d0c0; } .ap .seasonfx img.sfx-ic { width: 54px; height: 54px; }
.ap .seasonfx.spring b { color: #f2b8c6; } .ap .seasonfx.summer b { color: #9fd18b; } .ap .seasonfx.autumn b { color: #f0b060; } .ap .seasonfx.winter b { color: #cfe3f5; }
@keyframes sfx { 0% { opacity: 0; } 12% { opacity: 1; } 70% { opacity: 1; } 100% { opacity: 0; } }
@keyframes sfxband { 0% { transform: translateY(-50%) scale(1.06); } 100% { transform: translateY(-50%) scale(1); } }
@keyframes sfxin { 0% { transform: scale(.7) translateY(16px); } 25% { transform: scale(1) translateY(0); } 100% { transform: scale(1.04); } }
@media (prefers-reduced-motion: reduce) { .ap .seasonfx, .ap .seasonfx > div { animation-duration: .8s; } }
.ap p.src { font-size: 12px; color: #a89c84; margin: 2px 0 4px; }
.ap .failbox { position: absolute; left: 12px; right: 12px; top: 56px; z-index: 50; padding: 12px; border-radius: 12px; background: #3a1d18; border: 1px solid #c8402a;
  color: #f3e6c8; display: flex; flex-direction: column; gap: 6px; font-size: 13px; } .ap .failbox span { color: #e8b8a8; word-break: break-all; }
.ap .pow { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; margin: 4px 0 2px; } .ap .pow b { color: var(--gold); font-size: 14px; }
.ap .pbar { flex: 1 1 80px; height: 8px; border-radius: 4px; background: #2a2f38; overflow: hidden; } .ap .pbar i { display: block; height: 100%; background: linear-gradient(90deg, #8a6a3a, #e0a050); }
.ap .pow .mute { flex-basis: 100%; font-size: 12.5px; }
.ap .kitrow { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 6px; margin: 3px 0; font-size: 13px; } .ap .kitrow img.ic { width: 20px; height: 20px; }
.ap .kitrow .kt { color: #c8c0b0; font-size: 12.5px; flex: 1 1 10em; } .ap .kitrow .btn.sm { margin-left: auto; }
.ap .hints { margin: 4px 0 6px; padding-left: 18px; font-size: 13px; color: #d8c89a; } .ap .hints li { margin: 1px 0; }
.ap .acard.fresh { border-color: #7aa83a; box-shadow: 0 0 0 2px #7aa83a55; animation: fresh 1.2s ease-out 1; } @keyframes fresh { from { background: #2f3d24; } }
.ap .face { flex: none; width: 64px; height: 64px; border-radius: 12px; object-fit: cover; border: 1px solid #4a5363; background: #2a313c; display: block; }
.ap .noface { background: radial-gradient(circle at 50% 38%, #4a5363 0 22%, transparent 23%), radial-gradient(ellipse at 50% 100%, #4a5363 0 45%, transparent 46%), #2a313c; }
.ap .an { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; } .ap .an.big h3 { margin: 0; }
.ap img.nic { width: 44px; height: 44px; } .ap img.fem { width: 30px; height: 30px; }
.ap .units { display: flex; flex-wrap: wrap; gap: 4px 10px; margin-top: 4px; font-size: 14px; }
.ap .go { margin-top: 6px; color: var(--bad); font-weight: 600; }
.ap .rows { margin-top: 8px; display: flex; flex-direction: column; gap: 4px; }
.ap .row { display: flex; align-items: center; gap: 6px; width: 100%; padding: 9px 10px; border-radius: 10px; border: 1px solid var(--line);
  background: #1f252e; color: var(--ink); font: inherit; font-size: 14px; text-align: left; cursor: pointer; box-sizing: border-box; margin: 3px 0; }
.ap .row.on { border-color: #e0bd78; background: #3a3020; } .ap .row:disabled { opacity: .45; cursor: default; }
.ap .row .dest { font-weight: 600; } .ap .row .sub { color: var(--mute); font-size: 13px; }
.ap .row .win, .ap .row > .mute { margin-left: auto; font-weight: 700; } .ap .win.good { color: var(--good); } .ap .win.bad { color: var(--bad); }
.ap .chip { align-self: flex-end; padding: 5px 12px; border-radius: 16px; border: 1px solid #4a5363; background: #222833; color: var(--ink); font: inherit; font-size: 13px; cursor: pointer; }
.ap .chip.on { background: #3a2a5a; border-color: #9a7ad8; }
.ap .split { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 8px; }
.ap .split label { display: flex; align-items: center; gap: 4px; font-size: 14px; }
.ap input[type=number] { width: 4.2em; font: inherit; font-size: 15px; background: #14181e; color: var(--ink); border: 1px solid #4a5363; border-radius: 8px; padding: 4px 6px; }
.ap .seg { display: flex; border: 1px solid #4a5363; border-radius: 10px; overflow: hidden; }
.ap .seg button { flex: 1; padding: 6px 4px; border: 0; background: #1f252e; color: var(--mute); font: inherit; font-size: 13px; cursor: pointer; }
.ap .seg button.on { background: #3a3020; color: var(--gold); }
.ap .stepper { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ap .stepper button { width: 34px; height: 34px; border-radius: 10px; border: 1px solid #4a5363; background: #2a313c; color: var(--ink); font-size: 20px; cursor: pointer; }
.ap .stepper b { min-width: 2.4em; text-align: center; font-size: 17px; }
.ap .stepper button.btn { width: auto; height: auto; font-size: 14px; margin-left: auto; white-space: nowrap; flex: none; }
.ap .stepper .mute { flex: 1 1 4em; min-width: 0; }
.ap .sheet { overflow-x: hidden; }
.ap .btn, .ap .row, .ap .chip { white-space: nowrap; }
.ap .stepper.sm button { width: 28px; height: 28px; font-size: 16px; } .ap .stepper.sm b { min-width: 2em; font-size: 15px; }
.ap .rel { margin-left: auto; padding: 2px 10px; border-radius: 12px; font-size: 12px; background: #2a313c; }
.ap .rel.war { background: #4a2420; color: #f1b8a8; } .ap .rel.truce { background: #23331f; color: #cfeabf; } .ap .rel.ally { background: #1f2c40; color: #b8d4f4; }
.ap .trade { display: flex; flex-direction: column; gap: 6px; padding: 8px; border-radius: 10px; background: #1a1f27; }
.ap .tr2 { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; } .ap .tr2 > span:first-child { width: 3.5em; color: var(--mute); font-size: 13px; }
.ap .splitp { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; padding: 10px; border-radius: 12px; background: #1a1f27; }
.ap .row .dest, .ap .row .sub { min-width: 0; overflow: hidden; text-overflow: ellipsis; } .ap .row .win, .ap .row .em { flex: none; }
.ap .acard > .ab > .splitp, .ap .acard > .ab > .rows { margin-left: -74px; } /* 얼굴 칸 밑까지 넓게 — 폰에서 단추가 접히지 않게 */
.ap .sprow { display: flex; align-items: center; gap: 8px; } .ap .sprow .stepper { flex-wrap: nowrap; } .ap .sprow .spn { width: 4em; font-size: 14px; }
.ap .spsum { font-size: 14px; color: #cfc6b4; } .ap .spsum b { color: var(--gold); }
.ap .splitp .seg button { white-space: normal; }
.ap .nightov { position: absolute; inset: 0; z-index: 40; background: #000; }
.ap .nightov iframe { width: 100%; height: 100%; border: 0; display: block; }
.ap .nightov [data-close] { position: absolute; right: 10px; top: 10px; z-index: 1; font-size: 13px; padding: 4px 10px; }
.ap .frow { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; } .ap .frow .mute { flex: 1 1 12em; } .ap .why { font-size: 13px; color: #d8c89a; margin: 4px 0 2px; } .ap .askc .why { margin: 2px 0 4px; }
.ap .fbtn { border: 0; padding: 0; background: none; cursor: pointer; border-radius: 50%; }
.ap .plimg { display: block; width: 100%; border-radius: 10px; margin: 6px 0; }
.ap .rface.sm { width: 34px; height: 34px; border-width: 1px; }
.ap .dseg { margin-bottom: 8px; } .ap .dseg button { font-size: 15px; padding: 8px; }
.ap .plh { display: flex; align-items: center; gap: 8px; width: 100%; border: 0; background: none; color: var(--ink); font: inherit; text-align: left; cursor: pointer; padding: 0; }
.ap .plh > span:nth-child(2) { flex: 1; min-width: 0; display: flex; flex-direction: column; } .ap .plh .mute { white-space: normal; }
.ap .plh .cost { flex: none; white-space: nowrap; }
.ap .askc { padding: 10px; margin: 8px 0; border-radius: 14px; background: #20252f; border: 1px solid #5a4a2a; }
.ap .askc.threat { border-color: #8a3a2a; background: #2a1f1f; } .ap .askc p { margin: 6px 0 2px; font-size: 14.5px; }
.ap .sus { color: #f1a08a; font-weight: 700; }
.ap .askpill { margin-left: auto; flex: none; display: flex; align-items: center; gap: 2px; padding: 2px 10px 2px 4px; border-radius: 16px;
  border: 1px solid #e0bd78; background: linear-gradient(#a57a31, #7d5a22); color: #fff4dc; font: inherit; font-size: 13px; font-weight: 700;
  cursor: pointer; pointer-events: auto; animation: askpulse 1.6s ease-in-out 3; }
@keyframes askpulse { 50% { box-shadow: 0 0 0 4px #e0bd7855; } }
.ap .asks { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin: 6px 0 4px; }
.ap .asks > div { padding: 6px 8px; border-radius: 10px; background: var(--card); display: flex; flex-direction: column; }
.ap .asks b { font-size: 14px; color: var(--gold); } .ap .asks span { font-size: 12px; color: var(--mute); }
.ap .how { display: flex; gap: 6px; margin: 2px 0 6px; }
.ap .hw { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 3px; padding: 9px 10px; border-radius: 12px;
  border: 1px solid var(--line); background: #1f252e; color: var(--ink); font: inherit; text-align: left; cursor: pointer; }
.ap .hw b { font-size: 15px; } .ap .hw .ln { font-size: 13px; color: #cfc6b4; } .ap .hw .mute { white-space: normal; font-size: 12px; }
.ap .hw.on { border-color: #e0bd78; background: #3a3020; } .ap .hw.amb.on { border-color: #9a7ad8; background: #2a2440; }
.ap .tip { margin: 0 0 6px; }
.ap .flow3 { display: flex; align-items: stretch; gap: 6px; margin: 4px 0; }
.ap .flow3 > div { flex: 1; display: flex; flex-direction: column; align-items: center; text-align: center; padding: 8px 6px; border-radius: 12px; background: var(--card); }
.ap .flow3 > div img.ic { width: 34px; height: 34px; } .ap .flow3 b { font-size: 15px; } .ap .flow3 span { font-size: 12px; color: var(--mute); white-space: normal; }
.ap .flow3 > i { align-self: center; font-style: normal; color: var(--gold); font-size: 13px; white-space: nowrap; }
.ap .goer { margin: 8px 0; } .ap .gname { font-size: 14px; font-weight: 600; }
.ap .story { color: #cfc6b4; font-style: italic; }
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
  background: #1b2028; border: 1px solid #4a4030; box-shadow: 0 16px 40px #000c; }
.ap .mt { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 18px; margin-bottom: 8px; }
.ap .mt span { color: var(--mute); font-size: 14px; } .ap .mt img.sic { width: 34px; height: 34px; }
.ap .scene { position: relative; margin: 6px 0 10px; }
.ap .scene img.ev { display: block; width: 100%; border-radius: 12px; }
.ap .scene img.who { position: absolute; right: 10px; bottom: 42px; width: 30%; max-width: 130px; aspect-ratio: 1; object-fit: cover; border-radius: 12px; border: 2px solid var(--gold); box-shadow: 0 6px 16px #000a; }
.ap .brag { font-size: 20px; font-weight: 700; color: #f6d88e; margin-top: 8px; text-shadow: 0 2px 6px #000; }
.ap .lines p { font-size: 15px; border-left: 3px solid #4a4030; padding-left: 8px; }
.ap .lines p.mute { border-left-color: #2f3540; }
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
.ap .bars { display: grid; grid-template-columns: 1fr 1fr; gap: 3px 10px; }
.ap .bar { display: flex; align-items: center; gap: 2px; font-size: 12px; } .ap .bar i { font-style: normal; width: 2.4em; color: var(--mute); }
.ap .bar b, .ap .bar s { width: 12px; height: 8px; border-radius: 2px; background: var(--gold); } .ap .bar s { background: #3a4250; }
`
