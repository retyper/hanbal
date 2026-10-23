/**
 * 이겼다 · 졌다 — 화면 가운데 큰 글자가 쾅 박히고 금빛 불티가 낱낱이 튄다 (형 10-23: "승리하면 햅틱이랑 로고가 막 파방 하는 거랑 이펙트 튀는 거")
 *
 * 싸움 하나를 이겼을 때(battlefield)와 판을 끝냈을 때(front 끝 화면)가 같이 쓴다. 불티는 한 알씩 따로 난다 — 덩어리 그림을 흔들지 않는다.
 * 빛살(햇살)·붉은 동그라미는 쓰지 않는다 — 일장기처럼 읽힌다.
 */

/** 불티 수 — 한 번 터질 때 (두 번 터진다) */
const SPARKS = 56
/** 떨어지는 금박 수 */
const FLAKES = 26

/** 0..1 — 자리마다 늘 같은 값 (화면 꾸밈이라 판정과 상관없다) */
const hash = (i: number, k: number): number => {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453
  return x - Math.floor(x)
}

/**
 * 큰 글자 한 벌 — word 는 '승리' · '대승' · '패배' …, sub 는 그 밑의 한 줄.
 * delay(초) 뒤에 터진다 (CSS 변수 --wd). lose 면 불티 없이 무겁게 내려앉는다.
 */
export function winFxHtml(word: string, sub: string, delay: number, lose = false, brief = false): string {
  let h = `<div class="winfx${lose ? ' lose' : ''}${brief ? ' brief' : ''}" style="--wd:${delay}s" aria-hidden="true"><i class="wf-flash"></i>`
  if (!lose) {
    h += '<i class="wf-ring"></i><i class="wf-ring two"></i>'
    // 두 번 — 가운데에서 크게, 조금 뒤 양옆에서 한 번 더 (폭죽처럼)
    for (const [k, x, y, at] of [[0, 50, 50, 0], [1, 22, 38, 0.38], [2, 78, 40, 0.5]] as const) {
      h += `<div class="wf-burst" style="left:${x}%;top:${y}%">`
      const n = k === 0 ? SPARKS : SPARKS / 2
      for (let i = 0; i < n; i++) {
        const a = (i / n) * 360 + hash(i + k * 97, 1) * 10
        const r = (k === 0 ? 160 : 90) + hash(i + k * 97, 2) * (k === 0 ? 300 : 160)
        const s = 5 + hash(i + k * 97, 3) * 8
        h += `<b style="--a:${a.toFixed(1)}deg;--r:${r.toFixed(0)}px;--s:${s.toFixed(1)}px;--t:${(at + hash(i + k * 97, 4) * 0.15).toFixed(2)}s"></b>`
      }
      h += '</div>'
    }
    h += '<div class="wf-rain">'
    for (let i = 0; i < FLAKES; i++) {
      h += `<s style="--x:${(hash(i, 5) * 100).toFixed(1)}%;--t:${(0.3 + hash(i, 6) * 1.6).toFixed(2)}s;--z:${(0.6 + hash(i, 7) * 0.9).toFixed(2)};--sp:${(2.4 + hash(i, 8) * 2).toFixed(2)}s"></s>`
    }
    h += '</div>'
  }
  return h + `<div class="wf-word"><b>${word}</b>${sub !== '' ? `<span>${sub}</span>` : ''}</div></div>`
}

export const WINFX_CSS = `
.ap .winfx { position: absolute; inset: 0; z-index: 5; display: flex; align-items: center; justify-content: center; pointer-events: none; overflow: hidden; }
/* 글자 뒤를 어둡게 — 밝은 그림 위에서도 금빛 글자가 읽히게 */
.ap .winfx::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse 60% 45% at 50% 50%, #000d, #0006 60%, #0000 85%); opacity: 0; animation: wfdim .5s ease-out var(--wd) both; }
@keyframes wfdim { to { opacity: 1; } }
.ap .winfx .wf-flash { position: absolute; inset: 0; background: radial-gradient(ellipse 70% 60% at 50% 50%, #fffbeef0, #f6d27a99 40%, #f0c86a22 75%); opacity: 0;
  animation: wfflash .9s ease-out calc(var(--wd) + .05s) both; }
.ap .winfx.lose .wf-flash { background: radial-gradient(ellipse 70% 50% at 50% 50%, #000c, #0000 80%); animation-duration: 1.8s; }
@keyframes wfflash { 0% { opacity: 0; } 12% { opacity: 1; } 100% { opacity: 0; } }
/* 둥근 물결 하나 — 글자가 박힐 때 땅이 울리듯 (빛살 없이 테만) */
.ap .winfx .wf-ring { position: absolute; left: 50%; top: 50%; width: 120px; height: 120px; margin: -60px 0 0 -60px; border-radius: 50%; border: 5px solid #ffe2a0; box-shadow: 0 0 18px #ffd27a; opacity: 0;
  animation: wfring .9s ease-out calc(var(--wd) + .12s) both; }
.ap .winfx .wf-ring.two { animation-delay: calc(var(--wd) + .32s); border-width: 3px; }
/* 0% 는 숨긴다 — 기다리는 동안(animation-delay) 첫 칸이 보이면 안 된다 */
@keyframes wfring { 0% { opacity: 0; transform: scale(.3); } 2% { opacity: .9; transform: scale(.3); } 100% { opacity: 0; transform: scale(4.2); border-width: 1px; } }
.ap .winfx .wf-burst { position: absolute; width: 0; height: 0; }
/* 불티 한 알 — 날아가는 쪽으로 길쭉한 낟알 (빛살처럼 붙박이로 서 있지 않고 날아가며 꺼진다) */
.ap .winfx .wf-burst b { position: absolute; left: 0; top: 0; width: calc(var(--s) * 2.6); height: var(--s); margin: calc(var(--s) / -2) 0 0 0; border-radius: 50%;
  background: radial-gradient(ellipse, #fffef4, #ffe08a 40%, #e09a30 80%); box-shadow: 0 0 10px 3px #ffcf6acc; opacity: 0;
  animation: wfspark 1.3s cubic-bezier(.12, .75, .3, 1) calc(var(--wd) + .06s + var(--t)) both; }
@keyframes wfspark { 0% { opacity: 0; transform: rotate(var(--a)) translateX(0) scale(1.4); } 2% { opacity: 1; } 65% { opacity: 1; }
  100% { opacity: 0; transform: rotate(var(--a)) translateX(var(--r)) scale(.3); } }
/* 금박이 위에서 팔랑팔랑 */
.ap .winfx .wf-rain s { position: absolute; top: -6%; left: var(--x); width: calc(9px * var(--z)); height: calc(5px * var(--z)); border-radius: 2px; background: linear-gradient(135deg, #fff2c0, #d9a23e);
  opacity: 0; animation: wfrain var(--sp) linear calc(var(--wd) + var(--t)) both; }
@keyframes wfrain { 0% { opacity: 0; transform: translateY(0) rotate(0); } 10% { opacity: 1; } 100% { opacity: 0; transform: translateY(110vh) translateX(30px) rotate(540deg); } }
/* 큰 글자 — 위에서 쾅 박히고 한 번 흔들린다 */
.ap .winfx .wf-word { position: relative; display: flex; flex-direction: column; align-items: center; gap: 2px; animation: wfslam .7s cubic-bezier(.2, 1.4, .35, 1) var(--wd) both; }
.ap .winfx .wf-word b { font-family: 'East Sea Dokdo', var(--display); font-weight: 400; font-size: clamp(170px, 40vw, 380px); line-height: .8; letter-spacing: .06em;
  background: linear-gradient(#fffbe0 8%, #f6d27a 45%, #c08a30 78%, #7a4e18); -webkit-background-clip: text; background-clip: text; color: transparent;
  text-shadow: none; filter: drop-shadow(0 4px 0 #2a1606) drop-shadow(0 0 30px #f0c86acc) drop-shadow(0 10px 24px #000); }
.ap .winfx .wf-word span { font-family: 'Gowun Batang', serif; font-size: clamp(16px, 4.4vw, 24px); color: #f3e2b8; text-shadow: 0 2px 8px #000; letter-spacing: .08em; }
@keyframes wfslam { 0% { opacity: 0; transform: scale(2.8); } 55% { opacity: 1; transform: scale(.92); } 70% { transform: scale(1.04) rotate(-1deg); } 85% { transform: scale(.99) rotate(.6deg); } 100% { opacity: 1; transform: none; } }
.ap .winfx.lose .wf-word b { background: linear-gradient(#e8e2d6, #9a9080 60%, #5a5248); -webkit-background-clip: text; background-clip: text; filter: drop-shadow(0 3px 0 #111) drop-shadow(0 8px 20px #000); }
.ap .winfx.lose .wf-word { animation: wfsink 1.4s ease-out var(--wd) both; }
@keyframes wfsink { 0% { opacity: 0; transform: translateY(-30px); } 100% { opacity: 1; transform: none; } }
/* 싸움 하나 — 잠깐 크게 보이고 걷힌다 (밑의 결과 글을 읽게) */
.ap .winfx.brief { animation: wfout .6s ease-in calc(var(--wd) + 2.3s) forwards; }
@keyframes wfout { to { opacity: 0; visibility: hidden; } }
@media (prefers-reduced-motion: reduce) { .ap .winfx .wf-burst, .ap .winfx .wf-rain, .ap .winfx .wf-ring { display: none; } .ap .winfx .wf-word { animation-duration: .3s; } }
`

/** 폰 떨림 — 이겼을 때 "파바방" (안드로이드만 · 아이폰 사파리는 진동을 막아 두었다) */
export const WIN_BUZZ: readonly number[] = [40, 30, 40, 30, 60, 50, 220]
export function buzz(pattern: readonly number[]): void {
  if (typeof navigator.vibrate !== 'function' || document.visibilityState !== 'visible') return
  try { navigator.vibrate([...pattern]) } catch { /* 진동이 없는 곳 */ }
}
