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
  /** 본기 — 계절 이름 · 한 줄 머리 · 자세한 말(누가 몇 명으로 · 몇 명 남았나 · 누가 어떻게) · 그 일의 그림 (큰일은 굵게 · 진 싸움은 먹빛) */
  readonly lines: ReadonlyArray<{ readonly when: string; readonly t: string; readonly d?: string; readonly img?: string; readonly big: boolean; readonly lose?: boolean }>
  readonly stats: string
  readonly graph: string
}

/**
 * 한 쪽에 들어갈 높이(px 어림) — 굴리지 않고 넘기게 (형 11-08: "책처럼 넘기게"). 667px 폰에서 쪽 안쪽이 ~500px 라 그보다 조금 작게.
 * 일 하나의 키 = 계절 줄 + 머리 줄 수(한 줄 17자) + 말 줄 수(한 줄 24자) · 그림(92px)보다 작지 않게
 */
const PAGE_ROOM = 480
const weight = (l: BookPage['lines'][number]): number => Math.max(105, 34 + Math.ceil([...l.t].length / 17) * 22 + (l.d !== undefined ? Math.ceil([...l.d].length / 24) * 22 : 0) + 13)

/**
 * 펼친 책 — 한 장씩 넘긴다 (형 11-08: "볼맛이 전혀 안 남 · 한 페이지에 몰아넣었음 · 책으로 만들었으면 책처럼 넘기게").
 * 첫 장 표지(나라 · 판 · 결과 · 셈) → 본기 여러 장(일마다 그림 · 한 줄 머리 · 자세한 말) → 마지막 장 흥망 그래프.
 * 넘기기: 아래 ‹ › · 쪽의 왼쪽·오른쪽 절반을 누름 · 옆으로 밀기 (bookTurn) · 화면을 굴리지 않는다.
 */
export function bookHtml(p: BookPage, esc: (s: string) => string): string {
  const pages: string[] = []
  pages.push(`<section class="bkpg bkcover ${p.result}"><span class="bkce">${p.emblem}</span><h3>${esc(p.title)}</h3><p>${esc(p.sub)}</p><b class="bkres">${esc(p.word)}</b>${p.stats}<i class="bkhint">넘겨서 본기를 읽는다 ›</i></section>`)
  if (p.lines.length === 0) pages.push(`<section class="bkpg bkpage"><h4>본기</h4><p class="mute">이 판엔 적을 만한 큰일이 없었습니다.</p></section>`)
  else {
    let cur: Array<BookPage['lines'][number]> = []
    let room = 0
    const flush = (): void => {
      if (cur.length === 0) return
      pages.push(`<section class="bkpg bkpage"><h4>본기</h4>${cur.map((l) => `<article class="bkent${l.big ? ' big' : ''}${l.lose === true ? ' lose' : ''}">`
        + `${l.img !== undefined ? `<img class="bkimg" src="${l.img}" alt="" loading="lazy">` : ''}<div class="bktx"><i>${esc(l.when)}</i><b>${esc(l.t)}</b>${l.d !== undefined ? `<p>${esc(l.d)}</p>` : ''}</div></article>`).join('')}</section>`)
      cur = []
      room = 0
    }
    for (const l of p.lines) {
      const w = weight(l)
      if (room + w > PAGE_ROOM) flush()
      cur.push(l)
      room += w
    }
    flush()
  }
  if (p.graph !== '') pages.push(`<section class="bkpg bkpage bkgraph"><h4>흥망</h4>${p.graph}</section>`)
  const n = pages.length
  let h = `<div class="bookov" role="dialog" aria-label="${esc(p.title)}"><div class="bookopen" style="--bc:${p.color}" data-pg="0" data-n="${n}">`
  h += `<button class="bkx" data-act="book-close" aria-label="책 덮기">✕</button>`
  h += `<div class="bkpages">${pages.map((x, i) => x.replace('<section class="bkpg', `<section data-i="${i}" class="bkpg${i === 0 ? ' on' : ''}`)).join('')}`
  h += `<button class="bktap prev" data-act="bk-prev" aria-label="앞 장"></button><button class="bktap next" data-act="bk-next" aria-label="다음 장"></button></div>`
  h += `<div class="bknav"><button class="bkb" data-act="bk-prev" aria-label="앞 장">‹</button><span class="bkpn">1 / ${n}</span><button class="bkb" data-act="bk-next" aria-label="다음 장">›</button></div>`
  return h + `</div></div>`
}

/** 한 장 넘긴다 (dir +1 다음 · -1 앞) — 판을 다시 그리지 않고 그 자리의 쪽만 바꾼다 */
export function bookTurn(root: HTMLElement, dir: 1 | -1): void {
  const bk = root.querySelector<HTMLElement>('.bookopen')
  if (bk === null) return
  const n = Number(bk.dataset['n'] ?? '1')
  const i = Number(bk.dataset['pg'] ?? '0')
  const j = Math.max(0, Math.min(n - 1, i + dir))
  if (j === i) return
  bk.dataset['pg'] = String(j)
  bk.querySelectorAll<HTMLElement>('.bkpg').forEach((pg) => {
    const k = Number(pg.dataset['i'])
    pg.classList.toggle('on', k === j)
    pg.classList.remove('fwd', 'back')
    if (k === j) pg.classList.add(dir > 0 ? 'fwd' : 'back')
  })
  const pn = bk.querySelector('.bkpn')
  if (pn !== null) pn.textContent = `${j + 1} / ${n}`
}

/** 옆으로 밀어 넘기기 — 책이 열릴 때 한 번 건다 (밀린 거리 40px 넘으면 한 장) */
export function bookSwipe(root: HTMLElement): void {
  const pages = root.querySelector<HTMLElement>('.bkpages')
  if (pages === null || pages.dataset['sw'] === '1') return
  pages.dataset['sw'] = '1'
  let x0: number | null = null
  let swiped = false
  pages.addEventListener('pointerdown', (e) => { x0 = e.clientX; swiped = false })
  pages.addEventListener('pointerup', (e) => {
    if (x0 === null) return
    const dx = e.clientX - x0
    x0 = null
    if (Math.abs(dx) > 40) { swiped = true; bookTurn(root, dx < 0 ? 1 : -1) }
  })
  // 밀고 뗀 손이 쪽 절반 누름(bk-next/prev)으로 한 번 더 넘기지 않게
  pages.addEventListener('click', (e) => { if (swiped) { swiped = false; e.stopPropagation(); e.preventDefault() } }, true)
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
/* 펼친 책 — 한 장씩 넘긴다 (형 11-08: "책처럼 넘기게") · 굴리지 않는다 · 쪽 크기는 화면에 맞춰 고정 */
.ap .bookov { position: fixed; inset: 0; z-index: 70; background: #000c; display: grid; place-items: center; padding: 12px; animation: bkin .2s ease-out; }
@keyframes bkin { from { opacity: 0; } }
.ap .bookopen { position: relative; width: min(560px, 100%); height: min(calc(100dvh - 24px), 760px); display: flex; flex-direction: column; border-radius: 8px; background: #efe2c4; color: #2a1c0e; box-shadow: 0 10px 40px #000, inset 0 0 0 6px var(--bc, #6a4a2a); overflow: hidden; }
.ap .bkx { position: absolute; right: 10px; top: 10px; z-index: 4; width: 40px; height: 40px; border-radius: 50%; border: 1.5px solid #6a4a2a; background: #f8efd8; color: #2a1c0e; font-size: 18px; cursor: pointer; }
.ap .bkpages { position: relative; flex: 1; min-height: 0; perspective: 1400px; }
.ap .bkpg { position: absolute; inset: 0; display: none; overflow: hidden; }
.ap .bkpg.on { display: flex; flex-direction: column; }
/* 넘김 — 종이가 등에서 넘어오듯 살짝 돌며 들어온다 (한 장만 · transform·opacity 뿐) */
.ap .bkpg.on.fwd { transform-origin: 0 50%; animation: bkfwd .34s cubic-bezier(.2,.8,.3,1) both; }
.ap .bkpg.on.back { transform-origin: 100% 50%; animation: bkback .34s cubic-bezier(.2,.8,.3,1) both; }
@keyframes bkfwd { from { opacity: .2; transform: rotateY(-24deg) translateX(18px); } }
@keyframes bkback { from { opacity: .2; transform: rotateY(24deg) translateX(-18px); } }
@media (prefers-reduced-motion: reduce) { .ap .bkpg.on.fwd, .ap .bkpg.on.back { animation: none; } }
/* 쪽 절반 누름 — 왼쪽은 앞 장 · 오른쪽은 다음 장 (보이지 않는 단추) */
.ap .bktap { position: absolute; top: 56px; bottom: 0; width: 34%; z-index: 3; border: 0; background: none; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.ap .bktap.prev { left: 0; } .ap .bktap.next { right: 0; }
.ap .bkpg.bkgraph.on ~ .bktap { width: 16%; } /* 그래프 장은 탭(군사·고을·백성)을 눌러야 해서 가장자리만 */
.ap .bknav { flex: none; display: flex; align-items: center; justify-content: center; gap: 18px; padding: 8px 0 12px; border-top: 1px solid #c9b48a; background: #e6d6b2; }
.ap .bknav .bkb { width: 54px; height: 40px; border-radius: 20px; border: 1.5px solid #6a4a2a; background: #f8efd8; color: #2a1c0e; font-size: 22px; line-height: 1; cursor: pointer; }
.ap .bknav .bkpn { min-width: 64px; text-align: center; font-size: 14px; color: #6a4a2a; font-variant-numeric: tabular-nums; }
.ap .bkcover { padding: 40px 22px 18px; align-items: center; justify-content: center; gap: 10px; text-align: center; background: #2a1c0e; border-top: 14px solid var(--bc, #6a4a2a); color: #fff6e0; }
.ap .bkcover .bkce img { width: 110px; height: 110px; object-fit: contain; filter: drop-shadow(0 3px 6px #000a); }
.ap .bkcover h3 { margin: 4px 0 0; font-size: 28px; color: #ffe2a0; } .ap .bkcover p { margin: 0; opacity: .9; }
.ap .bkcover .bkres { margin-top: 6px; padding: 4px 16px; border-radius: 999px; background: #0006; font-size: 17px; }
.ap .bkcover.win .bkres { background: #ffd24a; color: #2a1606; }
.ap .bkcover .stats { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px 16px; margin-top: 10px; } .ap .bkcover .stats span { display: inline-flex; align-items: baseline; gap: 3px; font-size: 14px; } .ap .bkcover .stats b { font-size: 22px; color: #ffe2a0; }
.ap .bkcover .bkhint { margin-top: auto; font-style: normal; font-size: 13px; color: #e8c070; opacity: .85; }
.ap .bkpage { padding: 18px 18px 12px; gap: 12px; }
.ap .bkpage h4 { margin: 0; padding-right: 48px; font-size: 19px; color: #6a2a10; letter-spacing: .1em; }
/* 본기 한 일 — 왼쪽 그림 · 오른쪽 계절 · 굵은 머리 · 자세한 말 */
.ap .bkent { display: grid; grid-template-columns: 92px minmax(0, 1fr); gap: 12px; align-items: start; padding-bottom: 12px; border-bottom: 1px dashed #c9b48a; }
.ap .bkent:last-child { border-bottom: 0; }
.ap .bkent .bkimg { width: 92px; height: 92px; object-fit: cover; border-radius: 6px; box-shadow: 0 2px 6px #0006; border: 2px solid #6a4a2a; }
.ap .bkent.big .bkimg { border-color: #b8860b; box-shadow: 0 0 0 2px #ffd24a88, 0 2px 6px #0006; }
.ap .bkent.lose .bkimg { opacity: .75; border-color: #3a3a3a; }
.ap .bkent .bktx { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.ap .bkent .bktx i { font-style: normal; color: #8a6a40; font-size: 12.5px; }
.ap .bkent .bktx b { font-size: 16px; line-height: 1.35; color: #3a1a08; }
.ap .bkent.big .bktx b { color: #6a1a08; }
.ap .bkent.lose .bktx b { color: #3a3a3a; }
.ap .bkent .bktx p { margin: 0; font-size: 14px; line-height: 1.55; color: #3a2a18; }
.ap .bkpage .rise h4 { color: #6a2a10; } .ap .bkpage .risec { background: #2a1c0e; }
`
