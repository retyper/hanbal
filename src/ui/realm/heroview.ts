/**
 * 장수 카드의 조각 — 육각형 · 특성 칩 · 지금 하는 일 (docs/realm/HEROES.md §5)
 *
 * 판을 읽기만 하고 HTML 을 돌려준다. 고르는 손짓(맡기기·이끌기·회유)은 app.ts 가 받는다.
 * **본 만큼만** (HEROES §5): 우리 장수 · 싸워 본 장수 · 정찰로 본 장수만 능력치와 특성이 보이고, 아니면 얼굴과 이름뿐.
 */
import { STAT_NAME, josa } from '../../realm/data/prose.ts'
import { GRADE_COLOR, GRADE_NAME, TRAIT } from '../../realm/data/traits.ts'
import { armyOfHero, bondOf, bondTier, growNeed, heroArt, isRuler } from '../../realm/heroes.ts'
import { ART_DOES, ART_NAME } from './battlefield.ts'
import type { GrowStat, Hero, Realm } from '../../realm/types.ts'
import { P } from '../../tune/params.ts'
import { radarSvg } from './radar.ts'

const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/**
 * 이름 앞의 칭호 — 성이 아니다 (형: "이름들이 이렇게 성이 2자고 이름이 2~3자야? 옛날에 그랬어?").
 * 삼한·부여·고구려 사람은 성 없이 이름만 썼다 (성은 뒤 시대 · 왕실 몇). 그래서 판의 이름은 "칭호 + 이름"이다 — 칭호는 작게 떼어 보인다.
 * 변진의 우두머리 칭호 차례(삼국지 위서 동이전): 신지 · 험측 · 번예 · 살해 · 읍차.
 */
export const TITLE_MEAN: Readonly<Record<string, string>> = {
  신지: '삼한 큰 나라의 우두머리', 험측: '변진에서 신지 다음가는 우두머리', 번예: '변진의 셋째 우두머리', 살해: '변진의 넷째 우두머리', 읍차: '작은 나라·고을의 우두머리',
  견지: '마한 우두머리의 칭호', 견사: '사신을 맡은 벼슬', 장수: '군대를 이끄는 이', 군장: '고을과 나라의 우두머리', 거수: '무리의 우두머리',
  선인: '고구려의 낮은 벼슬', 패자: '고구려의 높은 벼슬', 조의: '고구려의 벼슬 — 검은 옷을 입는다', 우태: '고구려의 벼슬', 대가: '큰 무리를 거느린 귀족',
  진지렴: '진한의 우두머리 칭호', 삼로: '옥저·동예 읍락의 어른', 대사: '부여의 벼슬',
  마가: '부여의 네 가 — 말', 우가: '부여의 네 가 — 소', 저가: '부여의 네 가 — 돼지', 구가: '부여의 네 가 — 개',
  왕: '임금', 대왕: '임금', 우해왕: '우산국의 임금',
}

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
  return title === null ? esc(given) : `<small class="ttl" title="${esc(`${title} — ${TITLE_MEAN[title]} (칭호이지 성이 아니다)`)}">${esc(title)}</small>${esc(given)}`
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
  if (!seen) return '<span class="mute">특성은 아직 모른다</span>'
  const ts = h.traits ?? []
  if (ts.length === 0) return '<span class="mute">특성 없음</span>'
  return ts.map((id) => {
    const t = TRAIT[id]
    if (t === undefined) return ''
    return `<span class="trait${t.bad === true ? ' bad' : ''}" style="--g:${GRADE_COLOR[t.grade]}" title="${esc(t.line)}"><b>${esc(t.name)}</b><i>${GRADE_NAME[t.grade]}</i></span>`
  }).join('')
}

/** 특성 설명 줄 — 카드 안에서 칩 밑에. 끝에 그 장수의 비기 (싸움에서 장수 깃발로 한 번 — tactics) */
export function traitLines(h: Hero, seen: boolean): string {
  if (!seen) return ''
  const art = heroArt(h)
  return (h.traits ?? []).map((id) => TRAIT[id]).filter((t) => t !== undefined)
    .map((t) => `<p class="tline${t!.bad === true ? ' bad' : ''}"><b>${esc(t!.name)}</b> ${esc(t!.line)}</p>`).join('')
    + (art !== undefined ? `<p class="tline art"><b>비기 · ${esc(ART_NAME[art])}</b> ${esc(ART_DOES[art])}</p>` : '<p class="tline mute">비기 없음 — 싸움에선 북을 쳐 지휘한다</p>')
}

/** 지금 하는 일 한 줄 */
export function roleLine(r: Realm, h: Hero): string {
  const node = (id: string | null | undefined): string => (id != null ? (r.nodes[id]?.name ?? '?') : '?')
  if (h.status === 'dead') return '죽었다'
  if (h.status === 'captive') return `${r.factions[h.captor ?? '']?.name ?? '?'}에 사로잡혀 있다${h.persuade ? ` · 회유 중 · ${h.persuade.resist === undefined ? `${h.persuade.left}계절 남음` : h.persuade.resist > 0 ? '아직 마음을 닫았다' : `마음이 흔들린다${(h.persuade.tries ?? 0) > 0 ? ` · ${h.persuade.tries}번 고개를 저었다` : ''}`}` : ''}`
  if (isRuler(r, h.id)) return `군주 · ${node(h.at)}에 있다`
  const ex = (r.expeditions ?? []).find((x) => x.hero === h.id)
  if (ex !== undefined) return `원정 중 · ${Math.max(1, ex.back - r.season + 1)}계절 뒤 돌아온다`
  const hurt = h.woundedUntil !== undefined && h.woundedUntil > r.season ? ` · 다쳐 누웠다 (${h.woundedUntil - r.season}계절)` : ''
  const a = armyOfHero(r, h.id)
  if (a !== null) {
    let n = 0
    for (const v of Object.values(a.mix)) n += v ?? 0
    return a.march !== null ? `군사 ${n}명을 이끌고 ${josa(node(a.march.to), '으로', '로')} 가는 중${hurt}` : `군사 ${n}명을 이끈다 · ${node(a.at)}${hurt}`
  }
  if (h.post != null) return `${josa(node(h.post), '을', '를')} 맡았다${hurt}`
  return `${node(h.at)}에서 쉰다${hurt}`
}

export const HERO_CSS = `
.ap .hrow { display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px; margin: 6px 0; border-radius: 12px; border: 1px solid var(--line);
  background: var(--card); color: var(--ink); font: inherit; text-align: left; cursor: pointer; box-sizing: border-box; }
.ap .hrow .face { width: 52px; height: 52px; } .ap .hrow .hb { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.ap .hrow .hb .mute { white-space: normal; } .ap .hrow .tr3 { display: flex; flex-wrap: wrap; gap: 3px; }
.ap .hrow.ruler { border-color: #8a7040; background: #262116; }
.ap .trait { display: inline-flex; align-items: baseline; gap: 3px; padding: 1px 7px; border-radius: 10px; border: 1.5px solid var(--g); background: #14181e;
  font-size: 12px; white-space: nowrap; } .ap .trait i { font-style: normal; font-size: 10px; color: var(--mute); }
.ap .trait.bad { border-style: dashed; color: #f1b8a8; }
.ap .hcard { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 4px; }
.ap .hcard img.big { width: 150px; height: 150px; border-radius: 16px; object-fit: cover; border: 2px solid #6a5a3a; }
.ap .hcard .hn { font-size: 20px; color: var(--gold); font-family: 'Gowun Batang', serif; }
.ap .hcard .radar { margin: 2px auto; }
.ap .tline { text-align: left; font-size: 13.5px; margin: 3px 0; color: #d8d0c0; } .ap .tline.bad { color: #f1b8a8; } .ap .tline.art b { color: #ffd27a; }
.ap .hacts { display: flex; flex-direction: column; gap: 6px; width: 100%; margin-top: 8px; }
.ap .exp { display: flex; flex-direction: column; gap: 6px; text-align: left; padding: 10px; border-radius: 12px; border: 1px solid #3a5a6a; background: #18222a; }
.ap .exp > b { color: #9fd0f0; } .ap .exp .seg { flex-wrap: wrap; }
.ap .odds { display: flex; flex-direction: column; gap: 3px; }
.ap .od { position: relative; display: flex; align-items: center; gap: 8px; padding: 3px 8px; border-radius: 7px; background: #1f2830; overflow: hidden; font-size: 12.5px; }
.ap .od i { position: absolute; left: 0; top: 0; bottom: 0; background: #2f4a5a; } .ap .od b, .ap .od em { position: relative; font-weight: 500; }
.ap .od b { flex: 1; } .ap .od em { font-style: normal; color: #9fd0f0; font-size: 12px; }
.ap .od.wanderer i, .ap .od.skill i { background: #5a4a2a; } .ap .od.wanderer em, .ap .od.skill em { color: #f0c860; } .ap .od.none em { color: var(--mute); }
.ap .wed { display: flex; flex-direction: column; gap: 6px; text-align: left; padding: 10px; border-radius: 12px; border: 1px solid #6a4a5a; background: #231a20; }
.ap .wed > b { color: #f0b8c8; }
.ap .wcand { display: flex; gap: 10px; align-items: center; padding: 6px 8px; border-radius: 10px; border: 1px solid var(--line); background: var(--card); color: var(--ink); font: inherit; text-align: left; cursor: pointer; }
.ap .wcand:disabled { opacity: .5; cursor: default; } .ap .wcand .face { width: 46px; height: 46px; flex: none; }
.ap .wcand > span { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
`

// ───────── 정과 성장 (HEROES §7, 형: "장수를 오래쓰면 친밀도? 호감도? 이런게 올라야 하지 않을까? 장수 키우는 맛도 있어야할듯")

const BOND_WORD: Record<'new' | 'warm' | 'trust' | 'sworn', string> = { new: '낯설다', warm: '정이 들었다', trust: '믿는다', sworn: '한마음' }
const BOND_GIVES: Record<'new' | 'warm' | 'trust' | 'sworn', string> = {
  new: '함께 지내고 이기다 보면 정이 든다.',
  warm: '더 깊어지면 이끄는 군대의 사기가 오르고, 꾀어도 잘 안 넘어간다.',
  trust: '이끄는 군대의 사기가 오른다. 꾀어도 잘 안 넘어간다. 정이 끝까지 차면 새 특성에 눈뜬다.',
  sworn: '목숨을 맡긴 사이다.',
}
const GROW: readonly GrowStat[] = ['mu', 'tong', 'ryak', 'chi', 'deok']
const GROW_HOW: Record<GrowStat, string> = { mu: '싸우면', tong: '싸우면', ryak: '공작에 성공하면', chi: '고을을 맡으면', deok: '고을을 맡거나 회유하면' }

/** 정 띠 — 숫자 없이 길이와 말로 */
export function bondChip(r: Realm, h: Hero): string {
  const t = bondTier(r, h)
  return t === null ? '' : `<span class="bondc ${t}">정 · ${BOND_WORD[t]}</span>`
}

/** 우리 장수 카드의 정과 자람 — 무엇을 하면 무엇이 자라는지까지 */
export function growthHtml(r: Realm, h: Hero): string {
  const t = bondTier(r, h)
  let s = ''
  if (t !== null) {
    const b = bondOf(r, h) ?? 0
    s += `<div class="bond"><div class="bl"><b>정</b><span>${BOND_WORD[t]}</span>${h.served !== undefined && h.served > 0 ? `<span class="mute">함께한 지 ${h.served}계절</span>` : ''}</div>`
    s += `<div class="bbar"><i style="width:${Math.max(3, Math.min(100, b))}%"></i><u style="left:${P.realm.bondTrust}%"></u></div><p class="mute">${BOND_GIVES[t]}</p></div>`
  }
  s += `<div class="grow"><div class="bl"><b>자람</b><span class="mute">다음 단계까지</span></div>`
  for (const k of GROW) {
    const v = h[k]
    const max = v >= 10
    const p = max ? 100 : Math.min(100, ((h.xp?.[k] ?? 0) / growNeed(h, k)) * 100)
    const up = h.grown?.[k] ?? 0
    s += `<div class="gr"><span class="gn">${STAT_NAME[k]}</span><span class="gbar"><i style="width:${Math.max(2, p)}%"></i></span>`
    s += `<span class="gx">${max ? '끝까지' : up > 0 ? `+${up}` : ''}</span><span class="mute gh">${GROW_HOW[k]}</span></div>`
  }
  return s + `</div>`
}

export const GROW_CSS = `
.ap .bondc { display: inline-block; padding: 0 7px; border-radius: 9px; font-size: 11.5px; border: 1px solid #6a5a3a; color: #d8c89a; }
.ap .bondc.trust { border-color: #c9a23a; color: #f0d27a; } .ap .bondc.sworn { border-color: #e07a5f; color: #ffd0b8; background: #3a2018; }
.ap .bond, .ap .grow { width: 100%; text-align: left; margin-top: 8px; }
.ap .bl { display: flex; gap: 8px; align-items: baseline; } .ap .bl b { color: var(--gold); }
.ap .bbar { position: relative; height: 9px; border-radius: 5px; background: #2a2f38; margin: 4px 0; overflow: hidden; }
.ap .bbar i { position: absolute; left: 0; top: 0; bottom: 0; background: linear-gradient(90deg, #8a6a3a, #e0a050); border-radius: 5px; }
.ap .bbar u { position: absolute; top: 0; bottom: 0; width: 2px; background: #fff6; }
.ap .gr { display: grid; grid-template-columns: 3em 1fr 3.2em; gap: 6px; align-items: center; font-size: 13px; margin: 3px 0; }
.ap .gr .gh { grid-column: 2 / 4; font-size: 11.5px; margin-top: -3px; }
.ap .gbar { height: 7px; border-radius: 4px; background: #2a2f38; overflow: hidden; } .ap .gbar i { display: block; height: 100%; background: #7aa83a; }
.ap .gx { font-size: 12px; color: #9fd07a; }
`
