/**
 * 나의 역사 — 둔 판마다 한 권씩 꽂힌 책장 (DESIRE §9 「그림 역사책」 · 형 11-05: "나의 역사에 역사책으로 책장 만들어 준다며 · 하나도 없는데?").
 * 책등은 그 나라 깃발 빛 · 두께는 판의 길이(계절 수) · 위에 결과 표(이김 금빛 · 짐 먹빛 · 하는 중 파랑).
 * 책을 누르면 펼친다 — 왼쪽 표지(나라 · 판 · 결과) · 오른쪽 본기(그 판의 큰일을 계절 차례로) · 아래 흥망 그래프.
 * 판을 읽기만 한다 (절대 규칙 2) — 이름은 그 판의 처음 모습(startRegion)에서 꺼내 온다.
 */

export interface Book {
  readonly seed: number
  readonly title: string
  readonly sub: string
  readonly result: 'win' | 'lose' | 'quit' | 'now'
  readonly word: string
  readonly seasons: number
  readonly color: string
  /** 나라 깃발 그림 (img 꼬리) */
  readonly emblem: string
}

/** 책등 두께 (px) — 계절 수로 · 너무 얇거나 두껍지 않게 */
const thick = (n: number): number => Math.round(Math.max(30, Math.min(70, 26 + Math.sqrt(Math.max(0, n)) * 5)))
/** 책 높이 몫 — 판마다 조금씩 달라 책장이 살아 보이게 (시드로 정해 늘 같다) */
const tall = (seed: number): number => 140 + (Math.abs(seed * 2654435761) % 30)

export function shelfHtml(books: readonly Book[], esc: (s: string) => string): string {
  if (books.length === 0) return `<p class="mute">아직 둔 판이 없습니다. 판을 두면 여기 한 권씩 꽂힙니다.</p>`
  let h = `<div class="shelf"><div class="shelf-row">`
  for (const b of books) {
    h += `<button class="book ${b.result}" data-act="book-open" data-seed="${b.seed}" style="--bc:${b.color};--bw:${thick(b.seasons)}px;--bh:${tall(b.seed)}px" data-tip="${esc(`${b.title} · ${b.word}`)}">`
      + `<span class="bk-em">${b.emblem}</span><b class="bk-t">${esc(b.title)}</b><i class="bk-r">${esc(b.word)}</i></button>`
  }
  return h + `</div><i class="shelf-board"></i></div>`
}

export interface BookPage {
  readonly title: string
  readonly sub: string
  readonly word: string
  readonly result: Book['result']
  readonly emblem: string
  readonly color: string
  /** 본기 — 계절 이름과 한 줄 (큰일은 굵게) */
  readonly lines: ReadonlyArray<{ readonly when: string; readonly t: string; readonly big: boolean }>
  readonly stats: string
  readonly graph: string
}

export function bookHtml(p: BookPage, esc: (s: string) => string): string {
  let h = `<div class="bookov" role="dialog" aria-label="${esc(p.title)}"><div class="bookopen" style="--bc:${p.color}">`
  h += `<button class="bkx" data-act="book-close" aria-label="책 덮기">✕</button>`
  h += `<section class="bkcover ${p.result}"><span class="bkce">${p.emblem}</span><h3>${esc(p.title)}</h3><p>${esc(p.sub)}</p><b class="bkres">${esc(p.word)}</b>${p.stats}</section>`
  h += `<section class="bkpage"><h4>본기</h4>`
  if (p.lines.length === 0) h += `<p class="mute">이 판엔 적을 만한 큰일이 없었습니다.</p>`
  else h += `<ol class="bklines">${p.lines.map((l) => `<li class="${l.big ? 'big' : ''}"><i>${esc(l.when)}</i>${esc(l.t)}</li>`).join('')}</ol>`
  h += p.graph
  return h + `</section></div></div>`
}

export const BOOK_CSS = `
/* 책장 — 나무 선반 위에 책등이 선다 (부드러운 linear-gradient 금지 · 폰 한도: 단색과 radial 만) */
.ap .shelf { position: relative; margin: 10px auto 0; max-width: 980px; padding: 0 12px; }
.ap .shelf .shelf-row { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 3px; min-height: 180px; padding: 0 6px; }
.ap .shelf .shelf-board { display: block; height: 14px; background: #5a3a1c; border-top: 3px solid #8a5a2c; box-shadow: 0 6px 12px #000a; }
.ap .book { position: relative; width: var(--bw, 40px); height: var(--bh, 150px); padding: 8px 2px 10px; border: 0; border-radius: 3px 3px 1px 1px; cursor: pointer;
  background: var(--bc, #6a4a2a); box-shadow: inset 4px 0 0 #ffffff22, inset -5px 0 0 #00000055, 0 2px 4px #000a; color: #fff6e0; display: flex; flex-direction: column; align-items: center; gap: 6px; overflow: hidden; font: inherit; transition: translate .15s; }
.ap .book::before, .ap .book::after { content: ''; position: absolute; left: 0; right: 0; height: 3px; background: #e8c070cc; }
.ap .book::before { top: 14%; } .ap .book::after { bottom: 12%; }
@media (hover: hover) { .ap .book:hover { translate: 0 -8px; } }
.ap .book .bk-em img { width: 22px; height: 22px; object-fit: contain; filter: drop-shadow(0 1px 2px #000); }
.ap .book .bk-t { writing-mode: vertical-rl; text-orientation: upright; font-size: 13px; letter-spacing: 1px; text-shadow: 0 1px 2px #000; max-height: 100%; overflow: hidden; }
.ap .book .bk-r { position: absolute; top: 0; left: 50%; translate: -50% 0; font-style: normal; font-size: 0; width: 70%; height: 6px; border-radius: 0 0 3px 3px; background: #888; }
.ap .book.win .bk-r { background: #ffd24a; box-shadow: 0 0 8px #ffd24a; } .ap .book.lose .bk-r { background: #2a2a2a; } .ap .book.now .bk-r { background: #2f8cff; }
/* 펼친 책 */
.ap .bookov { position: fixed; inset: 0; z-index: 70; background: #000c; display: grid; place-items: center; padding: 12px; animation: bkin .2s ease-out; }
@keyframes bkin { from { opacity: 0; } }
.ap .bookopen { position: relative; width: min(980px, 100%); max-height: calc(100dvh - 24px); overflow: auto; display: grid; grid-template-columns: minmax(220px, 1fr) 2fr; gap: 0; border-radius: 8px; background: #efe2c4; color: #2a1c0e; box-shadow: 0 10px 40px #000, inset 0 0 0 6px var(--bc, #6a4a2a); }
@media (max-width: 700px) { .ap .bookopen { grid-template-columns: 1fr; } }
.ap .bkx { position: absolute; right: 10px; top: 10px; z-index: 2; width: 40px; height: 40px; border-radius: 50%; border: 1.5px solid #6a4a2a; background: #f8efd8; color: #2a1c0e; font-size: 18px; cursor: pointer; }
.ap .bkcover { padding: 28px 18px; display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; background: #2a1c0e; border-top: 14px solid var(--bc, #6a4a2a); color: #fff6e0; }
.ap .bkcover .bkce img { width: 84px; height: 84px; object-fit: contain; filter: drop-shadow(0 3px 6px #000a); }
.ap .bkcover h3 { margin: 4px 0 0; font-size: 24px; color: #ffe2a0; } .ap .bkcover p { margin: 0; opacity: .9; }
.ap .bkcover .bkres { margin-top: 6px; padding: 3px 14px; border-radius: 999px; background: #0006; }
.ap .bkcover.win .bkres { background: #ffd24a; color: #2a1606; }
.ap .bkcover .stats { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 14px; margin-top: 6px; } .ap .bkcover .stats span { display: inline-flex; align-items: baseline; gap: 3px; font-size: 13px; } .ap .bkcover .stats b { font-size: 18px; color: #ffe2a0; }
.ap .bkpage { padding: 22px 20px 18px; min-width: 0; }
.ap .bkpage h4 { margin: 0 0 8px; font-size: 18px; color: #6a2a10; }
.ap .bklines { margin: 0; padding: 0; list-style: none; display: grid; gap: 5px; }
.ap .bklines li { font-size: 14.5px; line-height: 1.5; } .ap .bklines li.big { font-weight: 800; color: #6a1a08; }
.ap .bklines li i { font-style: normal; color: #8a6a40; margin-right: 8px; font-size: 12.5px; }
.ap .bkpage .rise h4 { color: #6a2a10; } .ap .bkpage .risec { background: #2a1c0e; }
`
