/**
 * 장수 카드의 조각 — 육각형 · 특성 칩 · 지금 하는 일 (docs/realm/HEROES.md §5)
 *
 * 판을 읽기만 하고 HTML 을 돌려준다. 고르는 손짓(맡기기·이끌기·회유)은 app.ts 가 받는다.
 * **본 만큼만** (HEROES §5): 우리 장수 · 싸워 본 장수 · 정찰로 본 장수만 능력치와 특성이 보이고, 아니면 얼굴과 이름뿐.
 */
import { STAT_NAME, spanLabel, turnsLabel } from '../../realm/data/prose.ts'
import { GRADE_COLOR, GRADE_NAME, TRAIT } from '../../realm/data/traits.ts'
import { armyOfHero, bondOf, bondTier, growNeed, heroArt, honeyLeft, isRuler } from '../../realm/heroes.ts'
import { ART_DOES, ART_ICON, ART_NAME } from './battlefield.ts'
import type { GrowStat, Hero, Realm } from '../../realm/types.ts'
import { P } from '../../tune/params.ts'
import { radarSvg } from './radar.ts'
import { lazyTable, t as tr } from '../../i18n/index.ts'

const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/**
 * 이름 앞의 칭호 — 성이 아니다 (형: "이름들이 이렇게 성이 2자고 이름이 2~3자야? 옛날에 그랬어?").
 * 삼한·부여·고구려 사람은 성 없이 이름만 썼다 (성은 뒤 시대 · 왕실 몇). 그래서 판의 이름은 "칭호 + 이름"이다 — 칭호는 작게 떼어 보인다.
 * 변진의 우두머리 칭호 차례(삼국지 위서 동이전): 신지 · 험측 · 번예 · 살해 · 읍차.
 */
export const TITLE_MEAN: Readonly<Record<string, string>> = lazyTable('titleMean', ['신지', '험측', '번예', '살해', '읍차', '견지', '견사', '장수', '군장', '거수', '선인', '패자', '조의', '우태', '대가', '진지렴', '삼로', '대사', '마가', '우가', '저가', '구가', '왕', '대왕', '우해왕'])

/** "읍차 가람" → 칭호 · 이름. 칭호가 없으면 이름만 */
export function splitTitle(name: string): { title: string | null; given: string } {
  const i = name.indexOf(' ')
  if (i < 0) return { title: null, given: name }
  const t = name.slice(0, i)
  return TITLE_MEAN[t] !== undefined ? { title: t, given: name.slice(i + 1) } : { title: null, given: name }
}

/** 이름 HTML — 칭호는 작고 흐리게 앞에, 누르고 있으면 뜻 (성처럼 읽히지 않게) */
export function nameHtml(name: string): string {
  const { title, given } = splitTitle(name)
  return title === null ? esc(given) : `<small class="ttl" title="${esc(`${title}: ${TITLE_MEAN[title]}`)}">${esc(title)}</small>${esc(given)}`
}

/** 육각형 꼭짓점 순서 — STAT_NAME 의 순서 */
const AXES = ['mu', 'tong', 'ryak', 'chi', 'deok', 'uiri'] as const

/** 우리 장수는 금빛, 남의 장수는 붉은빛 */
export function heroRadar(h: Hero, seen: boolean, ours: boolean, size = 190): string {
  const axes = AXES.map((k) => ({ label: STAT_NAME[k], value: seen ? ((h as unknown as Record<string, number>)[k] ?? null) : null }))
  return radarSvg(axes, ours ? '#d9b36a' : '#e07a5f', size)
}

/** 특성 칩 — 등급의 오방색 테 · 나쁜 것은 붉게 · 누르면 한 줄이 펼쳐진다(title) */
export function traitChips(h: Hero, seen: boolean): string {
  if (!seen) return `<span class="mute">${tr('hv.traitUnknown')}</span>`
  const ts = h.traits ?? []
  if (ts.length === 0) return `<span class="mute">${tr('hv.traitNone')}</span>`
  return ts.map((id) => {
    const t = TRAIT[id]
    if (t === undefined) return ''
    // 설명은 칩에 쓰지 않는다 — 누르고 있는 동안·마우스를 올렸을 때 손가락·커서 곁에 (형 10-25: "신중 특성 텍스트는 그대로 쓰여 있지 말고")
    return `<span class="trait${t.bad === true ? ' bad' : ''}" style="--g:${GRADE_COLOR[t.grade]}" data-peek><b>${esc(t.name)}</b><i>${GRADE_NAME[t.grade]}</i><span class="peek"><b>${esc(t.name)} · ${GRADE_NAME[t.grade]}</b><span>${esc(t.line)}</span></span></span>`
  }).join('')
}

/**
 * 비기 — 싸움에서 장수 깃발로 한 번 쓰는 그 장수만의 수 (tactics). 싸움의 깃발 카드와 같은 그림으로 칩 하나, 설명은 펼침으로
 * (형 10-25: "비기도 너무 텍스트인데 적절하게 이미지화 · 깃발로 썼었나")
 */
export function artChip(h: Hero, seen: boolean, icon: (name: string, cls: string) => string): string {
  const art = seen ? heroArt(h) : undefined
  if (art === undefined) return ''
  return `<span class="trait artc" data-peek>${icon(ART_ICON[art], 'tric')}<b>${esc(ART_NAME[art])}</b><i>${tr('hv.artTag')}</i><span class="peek"><b>${tr('hv.artTitle', { name: esc(ART_NAME[art]) })}</b><span>${esc(ART_DOES[art])}</span></span></span>`
}

/** 지금 하는 일 한 줄 */
export function roleLine(r: Realm, h: Hero): string {
  const node = (id: string | null | undefined): string => (id != null ? (r.nodes[id]?.name ?? '?') : '?')
  if (h.status === 'dead') return tr('hv.dead')
  if (h.status === 'captive') return `${tr('hv.captive', { f: r.factions[h.captor ?? '']?.name ?? '?' })}${h.persuade ? ` · ${tr('hv.persuading')} · ${h.persuade.resist === undefined ? tr('hv.left', { span: spanLabel(r, h.persuade.left) }) : h.persuade.resist > 0 ? tr('hv.closed') : `${tr('hv.wavering')}${(h.persuade.tries ?? 0) > 0 ? ` · ${tr('hv.shook', { n: h.persuade.tries! })}` : ''}`}` : ''}`
  if (isRuler(r, h.id)) {
    const ra = armyOfHero(r, h.id)
    if (ra !== null) return ra.march !== null ? tr('hv.rulerMarch', { to: node(ra.march.to) }) : tr('hv.rulerLead', { at: node(ra.at) })
    return h.at === r.factions[h.faction]?.capital ? tr('hv.rulerHome') : tr('hv.rulerAt', { at: node(h.at) })
  }
  const ex = (r.expeditions ?? []).find((x) => x.hero === h.id)
  if (ex !== undefined) return tr('hv.expedition', { span: turnsLabel(r, Math.max(1, ex.back - r.season + 1)) })
  const honey = honeyLeft(r, h.id)
  const hurt = (h.woundedUntil !== undefined && h.woundedUntil > r.season ? tr('hv.hurt', { span: turnsLabel(r, h.woundedUntil - r.season) }) : '') + (honey > 0 ? tr('hv.honey', { span: turnsLabel(r, honey) }) : '')
  const a = armyOfHero(r, h.id)
  if (a !== null) {
    let n = 0
    for (const v of Object.values(a.mix)) n += v ?? 0
    return a.march !== null ? tr('hv.armyGo', { n, to: node(a.march.to), hurt }) : tr('hv.armyHere', { n, at: node(a.at), hurt })
  }
  if (h.post != null) return tr('hv.post', { node: node(h.post), hurt })
  return tr('hv.rest', { at: node(h.at), hurt })
}

export const HERO_CSS = `
.ap .hrow { display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px; margin: 6px 0; border-radius: 12px; border: 1px solid var(--line);
  background: var(--card); color: var(--ink); font: inherit; text-align: left; cursor: pointer; box-sizing: border-box; }
.ap .hrow .face { width: 52px; height: 52px; } .ap .hrow .hb { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.ap .hrow .hb .mute { white-space: normal; } .ap .hrow .tr3 { display: flex; flex-wrap: wrap; gap: 3px; }
.ap .hrow.ruler { border-color: #8a7040; background: #262116; }
/* 이번 계절 묶인 장수 — 흐리게, 얼굴 위 모래시계가 천천히 돈다 (누르면 사정은 보인다) */
.ap .hrow { position: relative; } .ap .hrow.busy { opacity: .55; filter: saturate(.35); background: #0004; }
.ap .hrow.busy img { filter: grayscale(.7) brightness(.8); }
.ap .hrow .hdo { display: block; font-size: 13px; font-weight: 700; color: #f0d090; }
.ap .hrow .hbz { position: absolute; left: 40px; top: 2px; font-style: normal; font-size: 20px; color: #f0d090; text-shadow: 0 0 4px #000; animation: hbz 2.4s ease-in-out infinite; }
@keyframes hbz { 0%, 40% { transform: rotate(0); } 50%, 90% { transform: rotate(180deg); } 100% { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .ap .hrow .hbz { animation: none; } }
.ap .banner.busyb { background: #2a2418; border: 1px dashed #8a7040; color: #e8d8b0; }
/* 재상 — 쉬는 장수는 재상이 맡긴다 (형 10-26) · 장수 탭 맨 위 띠 · 장수 판의 맡김/직접 · 줄의 「재상이 맡긴다」·「직접」 */
.ap .jsbar { margin: 8px 0 10px; display: flex; flex-direction: column; gap: 6px; }
.ap .jsbar .seg button { min-height: 34px; white-space: normal; line-height: 1.2; }
.ap .jsbar .jsl { margin: 0; padding: 7px 10px; border-radius: 10px; background: #2a2418; border: 1px solid #8a7040; display: flex; flex-direction: column; gap: 3px; font-size: 13px; color: #e8d8b0; }
.ap .jsbar .jsl b { color: #f0d090; }
.ap .jsone { margin: 8px 0; display: flex; flex-direction: column; gap: 4px; } .ap .jsone small { font-size: 12.5px; color: #cfc6b4; }
.ap .hrow .jsd { display: block; font-size: 12.5px; font-weight: 700; color: #b8d89a; }
/* 알아서 찾은 일 한 줄 — 얼굴 · 이름 › 일 아이콘 · 어디 · 군사 · 무엇 (형 10-26) */
.ap .jrow { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; font-size: 13px; color: #e8d8b0; padding: 2px 0; }
.ap .jrow.tap { padding: 4px 6px; width: 100%; text-align: left; background: rgba(200,160,80,.08); border: 1px solid rgba(200,160,80,.35); border-radius: 8px; font: inherit; font-size: 13px; color: #e8d8b0; cursor: pointer; margin-top: 4px; }
.ap .jrow .jrf { width: 26px; height: 26px; border-radius: 50%; object-fit: cover; object-position: top; border: 1.5px solid #c8a050; background: #1c2129; flex: none; }
.ap .jrow b { color: #f6e6c0; font-weight: 800; }
.ap .jrow .jarr { font-style: normal; color: #c8a050; font-weight: 900; }
.ap .jrow .jri { width: 20px; height: 20px; object-fit: contain; flex: none; }
.ap .jrow .jpl { font-weight: 700; color: #b8d89a; }
.ap .jrow .jmen { display: inline-flex; align-items: center; gap: 1px; font-size: 12px; color: #cfe0b8; }
.ap .jrow small { font-size: 11.5px; color: #a8a090; }
.ap .todochip .tci { width: 18px; height: 18px; vertical-align: -4px; margin-right: 3px; }
.ap .jsm { display: inline-block; padding: 0 5px; border-radius: 6px; border: 1px solid #8a7040; font-size: 11px; font-weight: 700; color: #f0d090; vertical-align: 1px; }
/* 이번 계절 무엇을 — 📜 내가 시킨 일 · ⚙ 알아서 하는 일 (heroRow · 형 10-26: "림월드·팰월드처럼") */
.ap .hwk { display: inline-block; padding: 0 5px; border-radius: 6px; font-style: normal; font-size: 11px; font-weight: 700; vertical-align: 1px; white-space: nowrap; }
.ap .hwk.me { background: #4a3418; border: 1px solid #e0a850; color: #ffd890; } .ap .hwk.au { background: #22301e; border: 1px solid #6a9a50; color: #b8e09a; }
.ap .trait { display: inline-flex; align-items: baseline; gap: 3px; padding: 1px 7px; border-radius: 10px; border: 1.5px solid var(--g); background: #17110c;
  font-size: 12px; white-space: nowrap; } .ap .trait i { font-style: normal; font-size: 10px; color: var(--mute); }
.ap .trait.bad { border-style: dashed; color: #f1b8a8; }
.ap .hcard { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 4px; }
.ap .hcard img.big { width: 150px; height: 150px; border-radius: 16px; object-fit: cover; border: 2px solid #6a5a3a; }
/* 얼굴 — 이름은 바로 밑 가운데, 사서의 「?」는 얼굴 모서리에 작게 */
.ap .hcard .hpic { position: relative; display: inline-block; }
.ap .hcard .annb { position: absolute; right: -8px; top: -8px; display: flex; align-items: center; gap: 1px; padding: 3px 7px; border-radius: 14px;
  border: 1px solid #c0a060; background: #2a2016f0; color: #ffd27a; font: inherit; font-size: 14px; cursor: pointer; box-shadow: 0 2px 6px #000a; }
.ap .hcard .annb b { font-size: 13px; }
.ap .trait.artc { border-color: #e0bd78; background: #2a2016; align-items: center; } .ap .trait .tric { width: 18px; height: 18px; }
.ap .hcard .hn { font-size: 20px; color: var(--gold); font-family: 'Gowun Batang', serif; }
.ap .hcard .radar { margin: 2px auto; }
.ap .tline { text-align: left; font-size: 13.5px; margin: 3px 0; color: #d8d0c0; } .ap .tline.bad { color: #f1b8a8; } .ap .tline.art b { color: #ffd27a; }
.ap .hacts { display: flex; flex-direction: column; gap: 6px; width: 100%; margin-top: 8px; }
.ap .exp { display: flex; flex-direction: column; gap: 6px; text-align: left; padding: 12px; border-radius: 12px; border: 1px solid #3a5a6a;
  background: linear-gradient(#14100ccc, #14100c88 40%, #14100cee), var(--expbg, none) center / cover no-repeat, #2a2218; transition: background-image .3s; }
.ap .exp .mute, .ap .exp p { text-shadow: 0 1px 3px #000; }
.ap .exp .expd button { display: inline-flex; flex-direction: column; align-items: center; line-height: 1.2; }
.ap .exp .expd button small { font-size: 10.5px; opacity: .8; } .ap .exp .expd button:disabled { opacity: .45; }
.ap .exp > b { color: #9fd0f0; } .ap .exp .seg { flex-wrap: wrap; }
.ap .odds { display: flex; flex-direction: column; gap: 3px; }
.ap .od { position: relative; display: flex; align-items: center; gap: 8px; padding: 3px 8px; border-radius: 7px; background: #30281f; overflow: hidden; font-size: 12.5px; }
.ap .od i { position: absolute; left: 0; top: 0; bottom: 0; background: #2f4a5a; } .ap .od b, .ap .od em { position: relative; font-weight: 500; }
.ap .od b { flex: 1; } .ap .od em { font-style: normal; color: #9fd0f0; font-size: 12px; }
.ap .od.wanderer i, .ap .od.skill i { background: #5a4a2a; } .ap .od.wanderer em, .ap .od.skill em { color: #f0c860; } .ap .od.none em { color: var(--mute); }
.ap .wed { display: flex; flex-direction: column; gap: 6px; text-align: left; padding: 10px; border-radius: 12px; border: 1px solid #6a4a5a; background: #231a20; }
.ap .wed > b { color: #f0b8c8; }
.ap .wcand { display: flex; gap: 10px; align-items: center; padding: 6px 8px; border-radius: 10px; border: 1px solid var(--line); background: var(--card); color: var(--ink); font: inherit; text-align: left; cursor: pointer; }
.ap .wcand:disabled { opacity: .5; cursor: default; } .ap .wcand .face { width: 46px; height: 46px; flex: none; }
.ap .wcand > span { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.ap .wcand .hdo { font-size: 12.5px; font-weight: 700; color: #f0d090; }
/* 묶인 장수의 원정 칸 — 한 줄만, 흐리게 (형 10-24) */
.ap .exp.off { opacity: .62; }
/* 사서에 남은 사람 — 이름 곁 「📜 사서 ?」 */
.ap .annb { margin-left: 8px; vertical-align: middle; padding: 2px 8px; border-radius: 10px; border: 1px solid #a08050; background: #2a2016; color: #e8d4a8;
  font: inherit; font-size: 12px; cursor: pointer; }
.ap .annb b { color: #ffd27a; }
.ap .gbx.annal small { display: block; color: #c9a86a; font-size: 12px; margin: 2px 0 6px; }
/* 장수 그림 크게 보기 — 누르면 화면 가득, 아무 데나 누르면 닫힌다 */
/* .ap img 는 늘 pointer-events: none (끌기 막기) — 크게 보는 얼굴만 눌린다 (그래서 안 눌렸다 · 형 10-25) */
.ap img.big[data-act], .ap img.dxbig[data-act] { cursor: zoom-in; pointer-events: auto; -webkit-user-drag: none; }
.ap .bview { position: absolute; inset: 0; z-index: 95; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
  background: #000e; cursor: zoom-out; animation: bvin .2s ease-out; }
.ap .bview img, .ap .bview video { max-width: min(96vw, 900px); max-height: 88dvh; object-fit: contain; border-radius: 14px; box-shadow: 0 0 40px #000; border: 2px solid #6a5a3a; }
/* 각성 영상은 720×1280 전체를 보여 준다. 오른쪽 아래 표식만 작은 각성 문양으로 덮는다. */
.ap video.vloop { aspect-ratio: 720 / 1180; object-fit: cover; object-position: 50% 0; } /* 아래 워터마크 띠를 잘라 낸다 (형 11-12) */
.ap video.vloop.sq { aspect-ratio: 9 / 16; object-fit: contain; object-position: center; }
.ap .bview .vfull { position: relative; display: block; height: min(88dvh, calc(96vw * 1180 / 720)); aspect-ratio: 720 / 1180; box-shadow: 0 0 40px #000; }
.ap .bview .vfull video.vloop { display: block; width: 100%; height: 100%; max-width: none; max-height: none; border: 0; border-radius: 0; box-shadow: none; }
.ap .vthumb { position: relative; display: inline-block; max-width: 100%; }
.ap .hcard .hpic.framed { --awakening-frame-outset: 12px; padding: var(--awakening-frame-outset); }
.ap .hpic.framed .vthumb { display: block; }
.ap .hpic.framed .flms { bottom: calc(var(--awakening-frame-outset) + 4px); z-index: 6; }
.ap .hpic.framed .annb { z-index: 6; }
.ap .hcard .vthumb video.big.vloop { width: 150px; height: auto; border: 0; border-radius: 0; display: block; }
/* 720×1280 영상의 표식 중심 (600, 1160)에 육각 보석의 중심을 맞춘다. */
.ap .vmark { position: absolute; right: 16.6667%; bottom: 9.375%; transform: translate(50%, 50%); width: 10%; aspect-ratio: 1;
  background-position: center; background-size: contain; background-repeat: no-repeat; filter: drop-shadow(0 1px 2px #0009); pointer-events: none; z-index: 5; }
/* 장수 판의 「진각성」 칸 — 잠긴 진각성 초상 + 조건 셋(켜지면 금빛 ✓) · 누르면 진각성 영상 미리 보기 (형 11-05) */
.ap .twc { display: flex; align-items: center; gap: 10px; width: 100%; margin: 8px 0 4px; padding: 6px 10px 6px 6px; border-radius: 12px; background: #17120c; border: 1px solid #5a4a2a; color: #e8dcc0; text-align: left; cursor: pointer; transition: transform .08s; }
.ap .twc:active { transform: scale(.97); }
.ap .twc.on { border-color: #f2c14e; box-shadow: 0 0 12px #f2c14e66; background: #2a2010; }
.ap .twc .twp { position: relative; flex: none; width: 64px; height: 64px; border-radius: 10px; overflow: hidden; border: 1px solid #6a5a3a; }
.ap .twc .twp img { width: 100%; height: 100%; object-fit: cover; display: block; }
.ap .twc:not(.on) .twp::after { content: ""; position: absolute; inset: 0; background: #0b0906a8; }
.ap .twc .twl { position: absolute; z-index: 1; left: 4px; top: 2px; font-style: normal; font-size: 16px; }
.ap .twc .twv { position: absolute; z-index: 1; right: 4px; bottom: 2px; width: 22px; height: 22px; border-radius: 50%; background: #000a; color: #ffe8a8; font-style: normal; font-size: 11px; display: grid; place-items: center; border: 1px solid #f2c14e; }
.ap .twc .twt { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.ap .twc .twt > b { font-size: 16px; color: #f2c14e; letter-spacing: .1em; }
.ap .twc .twcs { display: flex; flex-wrap: wrap; gap: 4px; }
.ap .twc .twk { display: inline-flex; align-items: center; gap: 2px; padding: 1px 7px; border-radius: 9px; background: #241c12; border: 1px solid #4a3c26; color: #9a8c70; font-style: normal; font-size: 12px; }
.ap .twc .twk.ok { background: #4a3610; border-color: #f2c14e; color: #ffe8a8; }
.ap .twc .twk u { text-decoration: none; color: #ffd76a; font-weight: 900; }
.ap .bview small { color: #cbbf9f; font-size: 12px; }
@keyframes bvin { from { opacity: 0; transform: scale(.94); } }
@media (prefers-reduced-motion: reduce) { .ap .bview { animation: none; } }
/* 명령 — 일 카드 여섯 (그림 깔린 판) · 일 창 · 장수 고르기 · 갈 곳 (형 10-25: "혼인·원정처럼 제대로 된 창으로") */
.ap .cmdg { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; }
.ap .cmdc, .ap .cmdw, .ap .cmdm button { position: relative; overflow: hidden; color: var(--ink); font: inherit; text-align: left; border-radius: 12px; border: 1px solid #6a5a3a;
  background: linear-gradient(#14100c55, #14100cdd 70%), var(--cbg, none) center / cover no-repeat, #2a2218; text-shadow: 0 1px 3px #000; }
.ap .cmdc { display: flex; flex-direction: column; gap: 3px; min-height: 104px; padding: 10px; cursor: pointer; justify-content: flex-end; }
.ap .cmdc b, .ap .cmdw > b { display: flex; align-items: center; gap: 5px; color: #ffd27a; font-size: 15px; }
.ap .cmdc b img, .ap .cmdw > b img, .ap .cmdm img { width: 22px; height: 22px; }
.ap .cmdc span { font-size: 12px; color: #d8ccb0; } .ap .cmdc small { font-size: 12px; font-weight: 700; color: #f0d090; }
.ap .cmdc.set { border-color: #e0bd78; box-shadow: 0 0 0 1px #e0bd7866; } .ap .cmdc.off { filter: saturate(.4) brightness(.75); }
.ap .cmdw { display: flex; flex-direction: column; gap: 6px; padding: 14px 12px 10px; min-height: 92px; justify-content: flex-end; margin: 6px 0 4px; }
.ap .cmdw > span { font-size: 13px; color: #d8ccb0; }
.ap .cmdp { display: flex; gap: 6px; overflow-x: auto; padding: 2px 2px 6px; }
.ap .cmdp button { flex: none; width: 84px; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 6px 4px; border-radius: 10px;
  border: 1px solid var(--line); background: var(--card); color: var(--ink); font: inherit; cursor: pointer; }
.ap .cmdp button .face { width: 52px; height: 52px; } .ap .cmdp button b { font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.ap .cmdp button small { display: flex; flex-direction: column; align-items: center; font-size: 11px; color: var(--mute); line-height: 1.25; }
.ap .cmdp button small i { font-style: normal; }
/* 이끌 장수 꼬리표 — 맡은 고을(이끌면 내려놓는다) · 멀리서 온다 (형 11-03) */
.ap .ldgov { color: #ffd27a; font-weight: 700; } .ap .ldfar { color: #9cc3e8; }
.ap .btn.lead small .ldgov, .ap .btn.lead small .ldfar { display: block; font-style: normal; font-size: 11px; }
.ap .cmdp button.on { border-color: #e0bd78; box-shadow: 0 0 0 2px #e0bd78, 0 0 10px #e0bd7866; } .ap .cmdp button.on small { color: #ffe2a0; }
.ap .cmdp button.busy { opacity: .5; filter: saturate(.35); cursor: default; } .ap .cmdp button.busy small { color: #f0d090; }
.ap .cmdts { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 6px; margin: 4px 0 8px; }
.ap .cmdt { display: flex; flex-direction: column; gap: 2px; padding: 8px 10px; border-radius: 10px; border: 1px solid #6a5a3a; background: #2a2218; color: var(--ink); font: inherit; text-align: left; cursor: pointer; }
.ap .cmdt b { color: #f0e0b8; } .ap .cmdt small { font-size: 11.5px; color: var(--mute); }
.ap .cmdgo { width: 100%; justify-content: center; margin-top: 6px; }
.ap .cmdt:disabled { opacity: .45; cursor: default; }
.ap .cmdt .pgc { display: flex; flex-wrap: wrap; gap: 3px; margin: 2px 0; }
.ap .cmdt .pgc .gain, .ap .cmdt .pgc .cost { display: inline-flex; }
.ap .cmdt.pgtop { border-color: #e8c15a; box-shadow: 0 0 0 1px #e8c15a66 inset; }
.ap .cmdt .pgst { font-style: normal; font-size: 11px; color: #1a1408; background: #e8c15a; border-radius: 999px; padding: 0 6px; margin-right: 2px; }
.ap .cmdt .pgfr { width: 16px; height: 16px; object-fit: contain; vertical-align: -3px; }
.ap .cmdm { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; width: 100%; }
.ap .cmdm button { display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 2px; min-height: 64px; padding: 6px 4px; cursor: pointer; }
.ap .cmdm button b { font-size: 13px; color: #ffd27a; }
`

// ───────── 정과 성장 (HEROES §7, 형: "장수를 오래쓰면 친밀도? 호감도? 이런게 올라야 하지 않을까? 장수 키우는 맛도 있어야할듯")

const BOND_WORD: Record<'new' | 'warm' | 'trust' | 'sworn', string> = lazyTable('bondWord', ['new', 'warm', 'trust', 'sworn'])
const BOND_GIVES: Record<'new' | 'warm' | 'trust' | 'sworn', string> = lazyTable('bondGives', ['new', 'warm', 'trust', 'sworn'])
const GROW: readonly GrowStat[] = ['mu', 'tong', 'ryak', 'chi', 'deok']
const GROW_HOW: Record<GrowStat, string> = lazyTable('growHow', ['mu', 'tong', 'ryak', 'chi', 'deok'])

/** 정 띠 — 숫자 없이 길이와 말로 */
export function bondChip(r: Realm, h: Hero): string {
  const t = bondTier(r, h)
  return t === null ? '' : `<span class="bondc ${t}">${tr('hv.bondChip', { w: BOND_WORD[t] })}</span>`
}

/** 우리 장수 카드의 정과 자람 — 무엇을 하면 무엇이 자라는지까지 */
export function growthHtml(r: Realm, h: Hero): string {
  const t = bondTier(r, h)
  let s = ''
  if (t !== null) {
    const b = bondOf(r, h) ?? 0
    s += `<div class="bond"><div class="bl"><b>${tr('hv.bond')}</b><span>${BOND_WORD[t]}</span>${h.served !== undefined && h.served > 0 ? `<span class="mute">${tr('hv.together', { span: turnsLabel(r, h.served) })}</span>` : ''}</div>`
    s += `<div class="bbar"><i style="width:${Math.max(3, Math.min(100, b))}%"></i><u style="left:${P.realm.bondTrust}%"></u></div><p class="mute">${BOND_GIVES[t]}</p></div>`
  }
  s += `<div class="grow"><div class="bl"><b>${tr('hv.grow')}</b><span class="mute">${tr('hv.nextStep')}</span></div>`
  for (const k of GROW) {
    const v = h[k]
    const max = v >= 10
    const p = max ? 100 : Math.min(100, ((h.xp?.[k] ?? 0) / growNeed(h, k)) * 100)
    const up = h.grown?.[k] ?? 0
    s += `<div class="gr"><span class="gn">${STAT_NAME[k]}</span><span class="gbar"><i style="width:${Math.max(2, p)}%"></i></span>`
    s += `<span class="gx">${max ? tr('hv.maxed') : up > 0 ? `+${up}` : ''}</span><span class="mute gh">${GROW_HOW[k]}</span></div>`
  }
  return s + `</div>`
}

export const GROW_CSS = `
.ap .bondc { display: inline-block; padding: 0 7px; border-radius: 9px; font-size: 11.5px; border: 1px solid #6a5a3a; color: #d8c89a; }
.ap .bondc.trust { border-color: #c9a23a; color: #f0d27a; } .ap .bondc.sworn { border-color: #e07a5f; color: #ffd0b8; background: #3a2018; }
.ap .bond, .ap .grow { width: 100%; text-align: left; margin-top: 8px; }
.ap .bl { display: flex; gap: 8px; align-items: baseline; } .ap .bl b { color: var(--gold); }
.ap .bbar { position: relative; height: 9px; border-radius: 5px; background: #30241a; margin: 4px 0; overflow: hidden; }
.ap .bbar i { position: absolute; left: 0; top: 0; bottom: 0; background: linear-gradient(90deg, #8a6a3a, #e0a050); border-radius: 5px; }
.ap .bbar u { position: absolute; top: 0; bottom: 0; width: 2px; background: #fff6; }
.ap .gr { display: grid; grid-template-columns: 3em 1fr 3.2em; gap: 6px; align-items: center; font-size: 13px; margin: 3px 0; }
.ap .gr .gh { grid-column: 2 / 4; font-size: 11.5px; margin-top: -3px; }
.ap .gbar { height: 7px; border-radius: 4px; background: #30241a; overflow: hidden; } .ap .gbar i { display: block; height: 100%; background: #7aa83a; }
.ap .gx { font-size: 12px; color: #9fd07a; }
`
