/**
 * 전장 — 우리가 낀 싸움을 합(라운드)마다 직접 지휘한다 (docs/realm/BATTLE.md §전투 2판 · 형 2026-10-19:
 * "기병컨트롤은 방법이없나? 군대 운용이 제일 중요한데" · "창병움직이면 다른애들 가만있냐. 각자 행동 컨트롤")
 *
 * 계절을 넘기기 전에 열린다. 판정은 늘 advance 다 — 이 화면은 warroom.rehearse 로 시험 돌림을 하고,
 * 고른 명령(tactics)을 모아 끝에 host.done 으로 넘긴다. 같은 명령이면 진짜 판도 같다 (결정론).
 *
 * 한 합에 무리마다 깃발을 하나씩 든다 — 앞줄 · 활 · 기병 · 장수. 고르지 않은 무리는 장수가 알아서 움직인다.
 * "북을 울린다"를 누르면 그 합이 천천히 풀린다: 두 진의 깃발 → 무슨 일이 있었나(누가 몇이 무엇을 해서 어떻게 됐나) → 잃은 사람.
 * 싸움이 열리면 계절 띠처럼 그 싸움의 이름이 가운데 떴다 사라진다 (북 · 종).
 * 움직임은 CSS 애니메이션의 지연뿐이고, 소리만 타이머로 — 탭이 보일 때만 (절대 규칙 4).
 * 확률은 숫자로 안 보인다 — 사로잡기는 말과 색으로, 대신 사람 수(날랜 무리 · 호위)는 보인다 (realm-no-numbers).
 */
import { HERO_BUST, UNIT_ICON } from '../../realm/data/art.ts'
import { GROUP_NAME, battleName, endStory, fieldName, groupLabel, josa, roundStory, storyCtx } from '../../realm/data/prose.ts'
import { rehearse, type BattleLine } from '../../realm/warroom.ts'
import type { Approach, Cmd, Grp, Order, Realm, RoundLog, RoundOrder, Tactic } from '../../realm/types.ts'

const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/** 진군 방식의 이름 · 고르는 화면의 한 줄 (얻는 것 · 거는 것) */
export const APPROACH_NAME: Record<Approach, string> = {
  road: '대로로 간다', night: '밤길로 숨어 간다', ford: '여울을 몰래 건넌다', ridge: '산기슭으로 돌아간다', cliff: '절벽을 타고 오른다',
}
export const APPROACH_DOES: Record<Approach, { gain: string; risk: string }> = {
  road: { gain: '빠르고 질서 있게 닿는다 — 사기가 오른다', risk: '숨지 않는다. 적은 성과 장정으로 맞는다' },
  night: { gain: '들키지 않으면 잠든 적을 친다 — 성문도 장정도 못 막는다', risk: '들키면 기다리던 적의 매복에 걸린다' },
  ford: { gain: '갈대에 숨어 건넌다 — 들키지 않으면 강만 믿던 적을 친다', risk: '들키면 물 한가운데서 맞아 크게 잃는다' },
  ridge: { gain: '한 계절 더 돌아 뒤로 나온다 — 성을 비켜 치고 높은 곳에서 쏠 수 있다', risk: '들키면 산길에서 걸린다' },
  cliff: { gain: '산성 절벽을 넘어 성 안으로 — 적은 사람일수록 잘 된다', risk: '실패하면 떨어져 많이 잃는다' },
}

/** 계절에 막힌 길 — 갈 수는 있다. 고를 때 미리 보인다 (형: "불가능하게 만들지 말고 패널티 · 사전에 안내") */
export const HARD_LINE = {
  winterPass: '눈 덮인 고개 — 얼어서 사람을 잃고 한 계절 더 걸린다',
  summerFord: '장마에 불어난 나루 — 떠내려가 사람을 잃고 한 계절 더 걸린다',
} as const

/** 깃발(명령)의 이름 — 우리 옛 진법의 말로. '일기토'처럼 남의 나라 게임 말은 쓰지 않는다 (형 2026-10-19) */
export const CMD_NAME: Record<Cmd, string> = {
  charge: '돌격', hold: '방진', open: '길 트기', ford: '여울 막기', rocks: '바위 굴리기', gate: '성문 깨기', ram: '배 들이받기',
  volley: '화살비', counter: '맞쏘기', fire: '불화살', height: '높은 곳',
  flank: '옆치기', punch: '돌파', pursue: '추격', guard: '호위',
  drum: '북을 친다', duel: '장수 겨루기', capture: '적장 사로잡기', retreat: '물러난다',
}
export const CMD_ICON: Record<Cmd, string> = {
  charge: UNIT_ICON.spear, hold: UNIT_ICON.shield, open: UNIT_ICON.pike, ford: 'unit-gaya-heavy', rocks: 'unit-slingers', gate: 'emblem-stonegate', ram: UNIT_ICON.boat,
  volley: UNIT_ICON.bow, counter: UNIT_ICON.crossbow, fire: 'unit-fire-archers', height: 'unit-scouts',
  flank: UNIT_ICON.horse, punch: UNIT_ICON.horse, pursue: UNIT_ICON.horse, guard: 'unit-general',
  drum: 'unit-drummers', duel: 'unit-general', capture: 'unit-axemen', retreat: 'unit-porters',
}
/** 깃발 한 줄 — 무엇을 이기고 무엇에 지나 */
const CMD_DOES: Record<Cmd, string> = {
  charge: '길 튼 적을 뚫고 궁수까지 덮친다 · 버티는 방진에 꺾인다 (흔들리는 방진은 뚫는다)',
  hold: '돌격을 받아 꺾는다 · 덜 잃는다 · 서 있으면 화살받이가 된다',
  open: '앞줄을 벌려 우리 화살비를 세게 한다 · 방진을 이긴다 · 돌격에 뚫린다',
  ford: '여울목에서 버틴다 — 건너오는 돌격이 크게 꺾인다 · 이 땅에서만, 한 번',
  rocks: '비탈에서 바위를 굴려 맞붙기 전에 적 앞줄을 깎는다 · 이 땅에서만, 한 번',
  gate: '성문을 들이친다 — 방진에도 꺾이지 않는다 · 성 앞에서만, 한 번',
  ram: '뱃머리로 들이받는다 — 물 위의 돌격 · 배가 있을 때만, 한 번',
  volley: '적 앞줄에 화살을 퍼붓는다 · 서 있는 방진에 잘 먹힌다',
  counter: '적 궁수를 겨눈다 · 적 화살비가 약해진다',
  fire: '불을 놓는다 · 바람이 돌면 우리가 흔들린다 · 한 번',
  height: '높은 곳에서 내리쏜다 — 화살이 세고 방진이 단단해진다 · 이 땅에서만, 한 번',
  flank: '옆으로 돌아 궁수(없으면 앞줄 옆구리)를 친다 · 적 기병이 호위하면 막힌다',
  punch: '앞줄과 함께 들이친다 · 방진에 부딪히면 크게 다친다',
  pursue: '흔들리는 적을 쫓아 크게 벤다 · 안 흔들리면 헛걸음',
  guard: '장수 곁을 지킨다 — 사로잡기를 막고 옆치기를 받아 내고, 물러날 때 덜 잃는다',
  drum: '북을 쳐 군사를 다잡는다 — 사기가 조금 오른다',
  duel: '장수끼리 나선다 · 이기면 적이 무너지고, 지면 우리 장수가 다치거나 쓰러진다 · 한 번',
  capture: '날랜 무리를 적장에게 보낸다 · 무리가 호위보다 크고 적이 흔들릴수록 잘 된다 · 놓치면 무리를 잃는다',
  retreat: '징을 쳐 물린다 · 덜 잃고 장수는 안 잡힌다',
}
/** 겨뤄 본 적장의 버릇 — 앞줄이 즐겨 하는 것 */
const HABIT_LINE: Partial<Record<Cmd, string>> = {
  charge: '늘 먼저 달려든다', hold: '방패 뒤에서 버티기를 좋아한다', open: '앞줄을 벌리고 활부터 쏜다',
}
/** 적진의 낌새 — 적 앞줄이 다음에 할 것 */
const HINT_LINE: Partial<Record<Cmd, string>> = {
  charge: '창끝을 낮추고 달려들 기세다', hold: '방패를 겹쳐 세우고 버틸 채비다', open: '앞줄이 벌어지고 궁수들이 그 틈으로 나온다',
}
/** 적 앞줄의 수를 이기는 우리 앞줄의 수 — 방진 > 돌격 > 길 트기 > 방진 */
const FRONT_COUNTER: Partial<Record<Cmd, Cmd>> = { charge: 'hold', hold: 'open', open: 'charge' }
/** 땅이 주는 수 — 그 땅에서만 깃발에 뜬다 */
const TERRAIN_CMD: ReadonlySet<Cmd> = new Set<Cmd>(['ford', 'rocks', 'gate', 'ram', 'height'])

/** 소리 자리 (형: "공방필살 마지막일격등 상황에 맞게 소리 들어갈곳") — public/sfx 의 활터 소리. 바꾸려면 여기만 */
export const BATTLE_SFX = {
  charge: 'swing_01', hold: 'parry_01', open: 'shot_longbow', ford: 'parry_02', rocks: 'crash_02', gate: 'impactWood_heavy_001', ram: 'impactPlank_medium_000',
  volley: 'shot_loose', counter: 'shot_flecha', fire: 'crash_01', height: 'shot_longbow',
  flank: 'roar_01', punch: 'roar_01', pursue: 'roar_01', guard: 'parry_02',
  drum: 'impactWood_medium_000', duel: 'unsheath_01', capture: 'sheath_01', retreat: 'switch2',
  /** 맞부딪힘 — 상성에서 이겼다(필살) · 그냥 */
  crit: 'impactPunch_heavy_000', clash: 'impactWood_heavy_000',
  /** 사로잡았다 · 장수 겨루기 · 마지막 일격(적이 무너졌다) · 이겼다 · 졌다 */
  caught: 'jingleUnlock', duelWin: 'herodeath_01', final: 'bossdeath_01', win: 'jingleClear', lose: 'fail_gong',
  /** 싸움이 열린다 — 북 두 번, 종 한 번 */
  openDrum: 'impactWood_heavy_000', openBell: 'impactBell_heavy_001',
} as const

/** 한 합이 풀리는 사이 (초) — 깃발 → 이야기 → 사람 수 */
const STAGE_S = [0, 1.1, 2.4] as const

const ROUND_NAME = ['첫째', '둘째', '셋째', '넷째', '다섯째', '여섯째']

export interface WarHost {
  readonly art: string
  readonly me: string
  ding(name: string, vol?: number): void
  /** 다 골랐다 — 이 명령들로 진짜 넘긴다 */
  done(tactics: Record<string, Tactic>): void
}

function face(id: string | null, art: string, fallback: string): string {
  const file = id !== null ? HERO_BUST[id] : undefined
  return file !== undefined ? `<img class="wf" src="${art}bust/${file}.jpg" alt="">` : `<img class="wf unit" src="${art}icon/${fallback}.png" alt="">`
}

/** 사로잡기 — 말과 색으로 (숫자 확률은 안 보인다) */
function captureWord(p: number): [string, string] {
  if (p >= 0.5) return ['잡을 수 있다', 'hi']
  if (p >= 0.3) return ['손이 닿는다', 'mid']
  if (p >= 0.15) return ['해볼 만하다', 'lo']
  if (p >= 0.05) return ['어렵다', 'no']
  return ['어림없다', 'no']
}

/**
 * 그 합의 말 — 눈에 보이는 잃은 수로 정한다 (우리 −37 · 적 −47 이면 우리가 민 것). 필살을 냈는데 "밀렸다"가 뜨면 헷갈린다.
 * 양쪽 다 안 잃었으면 판정의 기세(push)로.
 */
function pushWord(push: number, weAtk: boolean, lostUs: number, lostFoe: number): [string, string] {
  const p = lostUs + lostFoe > 0 ? lostFoe / (lostUs + lostFoe) : weAtk ? push : 1 - push
  if (p >= 0.62) return ['크게 밀었다', 'good']
  if (p >= 0.53) return ['조금 밀었다', 'good']
  if (p <= 0.38) return ['크게 밀렸다', 'bad']
  if (p <= 0.47) return ['조금 밀렸다', 'bad']
  return ['팽팽하다', '']
}

/** 싸움 앞의 한 줄 — 진군 방식과 기습의 결과 (우리 쪽 시점) */
function introLine(l: BattleLine, weAtk: boolean, foe: string): string {
  if (l.field === true) return '길 한가운데서 두 군대가 마주쳤다. 성도 장정도 없다.'
  const ap = l.approach ?? 'road'
  if (!weAtk) {
    if (l.ambush === 'success') return ap === 'cliff' ? `${josa(foe, '이', '가')} 절벽을 타고 성 안으로 뛰어내렸다!` : `${josa(foe, '이', '가')} 숨어 들이쳤다! 자다 깬 군사들이 무기를 찾는다.`
    if (l.ambush === 'caught') return `숨어 오던 ${josa(foe, '을', '를')} 먼저 알아챘다. 기다리던 대로 맞는다.`
    return `${josa(foe, '이', '가')} 대로로 다가온다. 진을 치고 맞는다.`
  }
  const ok = l.ambush === 'success'
  switch (ap) {
    case 'road': return '대로로 당당히 다가섰다. 적도 진을 치고 기다린다.'
    case 'night': return ok ? '밤길로 숨어 닿았다. 적은 아직 잠들어 있다 — 성문이 닫히기 전에 들이친다.' : '어둠 속에서 북이 울린다. 들켰다 — 적이 기다리고 있었다.'
    case 'ford': return ok ? '갈대에 숨어 여울을 건넜다. 적은 강을 벽으로 믿고 있었다.' : '강 한가운데서 들켰다. 물을 헤치는 사이 화살이 쏟아진다.'
    case 'ridge': return ok ? '산기슭을 돌아 적의 뒤로 나왔다 — 높은 곳을 잡았다.' : '산길에서 적의 척후에게 들켰다.'
    case 'cliff': return ok ? '절벽을 타고 올라 성 안으로 뛰어내렸다!' : '절벽을 오르다 들켰다. 돌과 화살에 많이 떨어졌다.'
  }
}

/** 한 쪽이 든 깃발들 — 앞줄 · 활 · 기병 · 장수(북은 빼고) */
function flags(o: RoundOrder | undefined, chip: Cmd, art: string): string {
  const xs: Cmd[] = o === undefined ? [chip] : [o.front, o.bows, o.horse, o.lead !== 'drum' ? o.lead : undefined].filter((c): c is Cmd => c !== undefined)
  return xs.map((c) => `<span class="wfl"><img src="${art}icon/${CMD_ICON[c]}.png" alt="">${CMD_NAME[c]}</span>`).join('')
}

/** 그 판의 이름 — 땅에서 딴다 (prose.battleName). 옛 보고처럼 판 기록이 모자라면 곳 이름으로 */
export function warName(r: Realm, l: BattleLine): string {
  return r.nodes[l.node] !== undefined ? battleName(r, l) : `${l.field === true && l.edge !== undefined ? fieldName(r, l.edge) : l.node} 싸움`
}

/** 전장 한 판의 화면 — 보인 합(shown)까지. 마지막 합은 천천히 풀린다(anim). sel 은 지금 고르는 깃발 */
export function warHtml(prev: Realm, after: Realm, l: BattleLine, me: string, art: string, shown: number, anim: boolean, left: number, sel: RoundOrder = {}): string {
  const weAtk = l.atkFaction === me
  const st = l.start
  const fname = (f: string | undefined): string => (f !== undefined ? (after.factions[f]?.name ?? '?') : '?')
  const atkF = l.atkFaction ?? prev.armies[l.attacker]?.faction
  const ourF = weAtk ? atkF : l.defender
  const foeF = weAtk ? l.defender : atkF
  const heroOf = (i: 0 | 1): string | null => st?.heroes[i] ?? null
  const ourHero = heroOf(weAtk ? 0 : 1)
  const foeHero = heroOf(weAtk ? 1 : 0)
  const hname = (id: string | null, f: string | undefined): string => (id !== null ? (prev.heroes[id]?.name ?? after.heroes[id]?.name ?? '?') : `${fname(f)} 군`)
  const ourName = hname(ourHero, ourF)
  const foeName = hname(foeHero, foeF)
  const ctx = storyCtx(prev, { start: st, atkFaction: atkF, defender: l.defender }, me)
  const rounds = (l.rounds ?? []).slice(0, shown)
  const last = rounds[rounds.length - 1]
  const n = (i: 0 | 1): number => (last === undefined ? 1 : i === 0 ? last.na : last.nd)
  const m = (i: 0 | 1): number => (last === undefined ? (st?.morale[i] ?? 1) : i === 0 ? last.ma : last.md)
  const men0 = (i: 0 | 1): number => st?.men[i] ?? 0
  const ourI: 0 | 1 = weAtk ? 0 : 1
  const foeI: 0 | 1 = weAtk ? 1 : 0
  const ourS: 'a' | 'd' = weAtk ? 'a' : 'd'
  const unitOf = (i: 0 | 1): string => (i === ourI ? UNIT_ICON.spear : UNIT_ICON.shield)
  const mixOf = (i: 0 | 1): Readonly<Partial<Record<string, number>>> => st?.mix?.[i] ?? {}

  // 지난 합의 값 — 천천히 풀 때 막대·사람 수가 거기서 새 값으로 간다
  const was = anim && rounds.length >= 2 ? rounds[rounds.length - 2] : undefined
  const n0 = (i: 0 | 1): number => (!anim ? n(i) : was === undefined ? 1 : i === 0 ? was.na : was.nd)
  const m0 = (i: 0 | 1): number => (!anim ? m(i) : was === undefined ? (st?.morale[i] ?? 1) : i === 0 ? was.ma : was.md)
  // 막대마다 제 키프레임 (battlecard 와 같은 길 — var() 키프레임은 크롬에서 칠이 안 됐다)
  let keys = ''
  let kn = 0
  const bar = (w1: number, w0: number): string => {
    if (w0 === w1) return `<i style="width:${w1}%"></i>`
    const k = `wb${kn++}`
    keys += `@keyframes ${k}{from{width:${w0}%}to{width:${w1}%}}`
    return `<i class="wgr" style="width:${w1}%;animation-name:${k}"></i>`
  }
  const side = (i: 0 | 1, hero: string | null, f: string | undefined, name: string, cls: string): string => {
    const now = Math.round(men0(i) * n(i))
    const old = Math.round(men0(i) * n0(i))
    const base = Math.max(0.05, st?.morale[i] ?? 1)
    const mr = (x: number): number => Math.round(Math.max(0, Math.min(1.2, x / base)) * 83)
    const num = old !== now ? `<span class="wn swap"><s>${old}명</s><u>${now}명</u></span>` : `<span class="wn">${now}명</span>`
    return `<div class="ws ${cls}">${face(hero, art, unitOf(i))}<b>${esc(name)}</b><span>${esc(fname(f))}</span>`
      + `<div class="wbar men">${bar(Math.round(n(i) * 100), Math.round(n0(i) * 100))}</div>${num}`
      + `<div class="wbar mor">${bar(mr(m(i)), mr(m0(i)))}</div><span class="wn">사기</span></div>`
  }

  let h = `<div class="wrbox">`
  h += `<div class="wrh"><b>${esc(warName(after, l))}</b>${left > 1 ? `<span class="mute">이번 계절 우리 싸움 ${left}판</span>` : ''}</div>`
  h += `<div class="wvs">${side(ourI, ourHero, ourF, ourName, 'us')}<i class="vs">VS</i>${side(foeI, foeHero, foeF, foeName, 'foe')}</div>`
  if (keys !== '') h += `<style>${keys}</style>`
  h += `<p class="wintro">${esc(introLine(l, weAtk, fname(foeF)))}${l.militia > 0 && !weAtk ? ` 마을 장정 ${l.militia}명이 함께 선다.` : l.militia > 0 ? ` 마을 장정 ${l.militia}명이 막아선다.` : ''}</p>`
  // 지나간 합들 — 마지막 합만 천천히
  h += `<div class="wlog">`
  rounds.forEach((rd, i) => {
    const slow = anim && i === rounds.length - 1
    const prevN = i === 0 ? [1, 1] : [rounds[i - 1]!.na, rounds[i - 1]!.nd]
    const lostUs = Math.max(0, Math.round(men0(ourI) * ((prevN[ourI] ?? 1) - (ourI === 0 ? rd.na : rd.nd))))
    const lostFoe = Math.max(0, Math.round(men0(foeI) * ((prevN[foeI] ?? 1) - (foeI === 0 ? rd.na : rd.nd))))
    const [pw, pc] = pushWord(rd.push, weAtk, lostUs, lostFoe)
    const crit = rd.beat === ourS
    const d = (k: number): string => (slow ? ` style="--d:${STAGE_S[k]}s"` : '')
    h += `<div class="wrd${slow ? ' slow' : ''}${crit ? ' crit' : ''}"><div class="wrn">${ROUND_NAME[i] ?? `${i + 1}`} 합</div>`
    h += `<div class="wcmds"${d(0)}><span class="wc us">${flags(weAtk ? rd.oa : rd.od, weAtk ? rd.a : rd.d, art)}</span><i>×</i><span class="wc foe">${flags(weAtk ? rd.od : rd.oa, weAtk ? rd.d : rd.a, art)}</span></div>`
    const story = ctx !== null ? roundStory(rd, rounds[i - 1], ctx) : []
    h += `<div class="wst"${d(1)}>${story.map((s) => `<p>${esc(s)}</p>`).join('')}</div>`
    // 사로잡기·물러나기로 끝난 합은 밀고 밀린 것이 없다
    if (rd.ev === 'capture-ok' || rd.ev === 'retreat') h += `<p class="wpush"${d(2)}>싸움이 거기서 끝났다</p></div>`
    else h += `<p class="wpush ${pc}"${d(2)}>${pw} · 우리 −${lostUs} · 적 −${lostFoe}</p></div>`
  })
  h += `</div>`

  const p = l.pending
  const ended = p === undefined
  if (p !== undefined && p.round === shown) {
    // 다음 합의 깃발을 든다 — 무리마다 하나, 장수 하나
    h += `<div class="wnext"><div class="wrn">${ROUND_NAME[shown] ?? `${shown + 1}`} 합 — 무리마다 깃발을 든다</div>`
    // 낌새는 본 것·들은 것에서만 (형: "직접본거나 주변정보여야지 짐작이머냐")
    const hl = p.hint !== null ? (p.hintSrc === 'habit' ? HABIT_LINE[p.hint] : HINT_LINE[p.hint]) : undefined
    if (p.hint !== null && hl !== undefined && p.hintSrc === 'habit') h += `<p class="whint"><b>적장의 버릇</b> ${esc(josa(foeName, '은', '는'))} 겨뤄 보니 ${esc(hl)} <span class="mute">— 이번 합에도 그럴지는 모른다</span></p>`
    else if (p.hint !== null && hl !== undefined) h += `<p class="whint"><b>적 앞줄의 낌새</b> ${esc(hl)} <span class="mute">— ${l.field === true ? '눈앞에서 맞붙어 보인다' : weAtk ? '척후가 이번 계절 보고 왔다' : '다가오는 것을 지켜봤다'}</span></p>`
    else h += `<p class="whint mute">적진의 속이 보이지 않는다 — 척후를 보냈거나 그 적장과 겨뤄 본 적이 있으면 보인다.</p>`
    if (p.foeWaver) h += `<p class="whint warn"><b>적이 흔들린다</b> 깃발이 기울고 대열이 성기다 — 방진도 돌격을 못 받아 낸다. 쫓을 때다.</p>`
    // 맞은편 — 적 무리마다 사람 수
    const foeRow = (Object.entries(p.foe) as [Grp, number][]).filter(([, v]) => v > 0).map(([g, v]) => `${esc(groupLabel(mixOf(foeI), g))} ${v}명`).join(' · ')
    if (foeRow !== '') h += `<p class="wfoe">맞은편 — 적 ${foeRow}</p>`
    const opt = (g: Grp | 'lead', c: Cmd): string => {
      const on = sel[g] === c
      let tag = ''
      if (g === 'front' && p.hint !== null && FRONT_COUNTER[p.hint] === c) tag = `<em>낌새의 맞수</em>`
      else if (c === 'pursue' && p.foeWaver) tag = `<em>지금이다</em>`
      else if (TERRAIN_CMD.has(c)) tag = `<em class="land">이 땅에서만</em>`
      let feel = ''
      if (c === 'capture') {
        const [w, cls] = captureWord(p.capture)
        feel = `<span class="wf-${cls}">${w}</span><span class="wcap">날랜 무리 ${p.squad}명 · 적장 곁 호위 ${p.escort}명</span>`
      }
      return `<button class="wcmd ${c}${on ? ' on' : ''}" data-war="pick" data-g="${g}" data-c="${c}"><img src="${art}icon/${CMD_ICON[c]}.png" alt=""><b>${CMD_NAME[c]}</b>${tag}${feel}<small>${esc(CMD_DOES[c])}</small></button>`
    }
    for (const gr of p.groups) {
      if (gr.options.length === 0) continue
      h += `<div class="wgrp"><div class="wgh"><b>${GROUP_NAME[gr.g]}</b> ${esc(groupLabel(mixOf(ourI), gr.g))} ${gr.men}명${sel[gr.g] === undefined ? '<span class="mute"> — 안 고르면 장수가 알아서</span>' : ''}</div>`
      h += `<div class="wcmdgrid">${gr.options.map((c) => opt(gr.g, c)).join('')}</div></div>`
    }
    if (p.lead.length > 0) {
      h += `<div class="wgrp"><div class="wgh"><b>장수</b> ${esc(ourName)}${sel.lead === undefined ? '<span class="mute"> — 안 고르면 북을 친다</span>' : ''}</div>`
      h += `<div class="wcmdgrid">${p.lead.map((c) => opt('lead', c)).join('')}</div></div>`
    }
    h += `<div class="wfoot"><button class="btn ghost" data-war="auto">이 싸움은 맡긴다</button>${left > 1 ? `<button class="btn ghost" data-war="autoall">남은 싸움 다 맡긴다</button>` : ''}`
    h += `<button class="btn on" data-war="go">북을 울린다</button></div></div>`
  } else if (ended) {
    const atkWon = l.outcome === 'rout' || l.outcome === 'win'
    const good = weAtk === atkWon && l.outcome !== 'draw'
    const place = l.field === true && l.edge !== undefined ? fieldName(after, l.edge) : (after.nodes[l.node]?.name ?? l.node)
    let res: string
    if (l.outcome === 'draw') res = weAtk ? '승부가 안 났다 — 물러난다' : `${josa(place, '을', '를')} 지켜 냈다`
    else if (l.field === true) res = good ? '적을 물리치고 길을 간다' : '밀려서 돌아간다'
    else if (weAtk) res = atkWon ? `${josa(place, '을', '를')} 차지한다` : '물러난다'
    else res = atkWon ? `${josa(place, '을', '를')} 빼앗긴다` : `${josa(place, '을', '를')} 지켜 냈다`
    const big = l.outcome === 'rout' || l.outcome === 'routed' ? (good ? '대승 — ' : '대패 — ') : ''
    const d = anim ? ` style="--d:${STAGE_S[2] + 0.8}s"` : ''
    h += `<div class="wend ${good ? 'good' : l.outcome === 'draw' ? '' : 'bad'}"${d}><b>${big}${esc(res)}</b>`
    if (ctx !== null && (l.rounds ?? []).length > 0) h += `<p class="wwhy">${esc(endStory(l, ctx))}</p>`
    if (l.captured !== null) {
      const c = after.heroes[l.captured]
      h += c?.faction === me ? '<p>' + esc(josa(c.name, '이', '가')) + ' 사로잡혀 갔다.</p>' : '<p>' + esc(josa(c?.name ?? '?', '을', '를')) + ' 사로잡았다!</p>'
    }
    if (l.killed !== null) h += `<p>${esc(josa(after.heroes[l.killed]?.name ?? '?', '이', '가'))} 쓰러졌다.</p>`
    h += `<button class="btn on wide" data-war="next">${left > 1 ? '다음 싸움으로' : '계절을 마무리한다'}</button></div>`
  }
  h += `</div>`
  return h
}

export const WAR_CSS = `
.ap .tn.hard { color: #f0a08a; }
.ap.war-open .tutband, .ap.war-open .tutbar { display: none; }
.ap .wr { position: fixed; inset: 0; z-index: 60; background: #0d0f13f2; overflow-y: auto; -webkit-overflow-scrolling: touch; }
.ap .wrbox { max-width: 600px; margin: 0 auto; padding: 14px 14px 40px; }
.ap .wrh { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; color: var(--gold); font-size: 19px; margin-bottom: 8px; }
.ap .wrh b { font-family: 'Gowun Batang', serif; letter-spacing: 1px; }
.ap .wvs { display: flex; align-items: flex-start; gap: 8px; }
.ap .wvs .vs { font-style: normal; font-weight: 800; color: #c8402a; font-size: 20px; align-self: center; }
.ap .ws { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; text-align: center; }
.ap .ws b { font-size: 15px; margin-top: 4px; } .ap .ws > span { font-size: 12px; color: var(--mute); }
.ap .wf { width: 84px; height: 84px; border-radius: 14px; object-fit: cover; border: 2px solid #6a5a3a; background: #2a313c; }
.ap .wf.unit { object-fit: contain; padding: 6px; }
.ap .ws.foe .wf { border-color: #7a3a2a; }
.ap .wbar { width: 100%; height: 8px; border-radius: 4px; background: #2a2f38; overflow: hidden; margin-top: 6px; }
.ap .wbar i { display: block; height: 100%; }
.ap .wbar i.wgr { animation-duration: 1s; animation-timing-function: ease-out; animation-delay: 2.4s; animation-fill-mode: both; }
.ap .wn.swap { display: inline-grid; } .ap .wn.swap > * { grid-area: 1 / 1; text-decoration: none; }
.ap .wn.swap s { animation: wout .3s ease-out 2.4s both; } .ap .wn.swap u { animation: wrin .3s ease-out 2.4s both; }
@keyframes wout { to { opacity: 0; } }
.ap .wbar.men i { background: linear-gradient(90deg, #3f8f3a, #8fd07a); } .ap .ws.foe .wbar.men i { background: linear-gradient(90deg, #8a3a2a, #e08a74); }
.ap .wbar.mor { height: 5px; } .ap .wbar.mor i { background: #d9b36a; }
.ap .ws .wn { font-size: 12px; color: var(--ink); }
.ap .wintro { margin: 12px 0 6px; padding: 8px 10px; border-radius: 10px; background: #1a1f27; font-size: 14.5px; }
.ap .wlog { display: flex; flex-direction: column; gap: 8px; margin: 8px 0; }
.ap .wrd { padding: 8px 10px; border-radius: 12px; background: #161a20; border: 1px solid #343c49; }
.ap .wrd.crit { border-color: #d9b36a; box-shadow: 0 0 0 1px #d9b36a55 inset; }
.ap .wrn { font-size: 12px; color: var(--mute); margin-bottom: 4px; }
.ap .wcmds { display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 700; }
.ap .wc { display: inline-flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 3px; padding: 3px 6px; border-radius: 12px; background: #222833; flex: 1; min-width: 0; }
.ap .wc.foe { background: #2d1f1d; }
.ap .wfl { display: inline-flex; align-items: center; gap: 2px; font-size: 12.5px; white-space: nowrap; padding: 0 3px; }
.ap .wfl img { width: 22px; height: 22px; object-fit: contain; }
.ap .wcmds > i { font-style: normal; color: #c8402a; }
.ap .wst { margin: 6px 0 2px; }
.ap .wst p { margin: 3px 0; font-size: 14.5px; line-height: 1.5; }
.ap .wrd.crit .wst p:first-child { color: var(--gold); }
.ap .wpush { margin: 4px 0 0; text-align: center; font-size: 13px; color: var(--mute); }
.ap .wpush.good { color: var(--good); } .ap .wpush.bad { color: var(--bad); }
.ap .wrd.slow .wcmds, .ap .wrd.slow .wst, .ap .wrd.slow .wpush { opacity: 0; animation: wrin .45s ease-out var(--d, 0s) both; }
.ap .wrd.slow .wcmds { animation-name: wrflip; }
@keyframes wrin { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes wrflip { from { opacity: 0; transform: rotateX(90deg); } to { opacity: 1; transform: none; } }
.ap .wnext { margin-top: 12px; padding: 10px; border-radius: 14px; background: #1b2028; border: 1px solid #4a4030; animation: wrin .4s ease-out both; }
.ap .wr.slow .wnext { animation-delay: 3.1s; }
.ap .whint { margin: 2px 0 6px; font-size: 14px; } .ap .whint b { color: var(--gold); margin-right: 4px; }
.ap .whint.warn b { color: #ff9a70; }
.ap .wfoe { margin: 0 0 8px; font-size: 13px; color: #e0b0a0; }
.ap .wgrp { margin: 8px 0; }
.ap .wgh { font-size: 13.5px; margin-bottom: 4px; } .ap .wgh b { color: var(--gold); margin-right: 4px; }
.ap .wcmdgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 6px; }
.ap .wcmd { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 7px 9px; border-radius: 12px; border: 1px solid #4a5363;
  background: #222833; color: var(--ink); font: inherit; text-align: left; cursor: pointer; position: relative; }
.ap .wcmd.on { border-color: var(--gold); background: #3a3222; box-shadow: 0 0 0 2px #d9b36a66; }
.ap .wcmd img { width: 30px; height: 30px; object-fit: contain; position: absolute; right: 8px; top: 7px; opacity: .9; }
.ap .wcmd b { font-size: 15.5px; } .ap .wcmd small { font-size: 11.5px; color: var(--mute); line-height: 1.35; padding-right: 2px; }
.ap .wcmd em { font-style: normal; font-size: 11px; color: #14161a; background: var(--gold); border-radius: 6px; padding: 0 5px; }
.ap .wcmd em.land { background: #7fb07a; }
.ap .wcmd .wcap { font-size: 12px; color: var(--ink); }
.ap .wcmd.capture { border-color: #8a6a2a; } .ap .wcmd.retreat { background: #1a1d22; }
.ap .wf-hi { color: var(--good); font-weight: 700; font-size: 13px; } .ap .wf-mid { color: var(--gold); font-size: 13px; }
.ap .wf-lo { color: var(--bad); font-size: 13px; } .ap .wf-no { color: #8b8478; font-size: 13px; }
.ap .wfoot { display: flex; gap: 8px; justify-content: flex-end; align-items: center; margin-top: 10px; flex-wrap: wrap; }
.ap .wfoot .btn.on { font-size: 16px; padding: 8px 18px; }
.ap .wend { margin-top: 14px; padding: 12px; border-radius: 14px; text-align: center; background: #1b2028; animation: wrin .5s ease-out var(--d, 0s) both; }
.ap .wend b { font-size: 21px; } .ap .wend.good b { color: var(--good); } .ap .wend.bad b { color: var(--bad); }
.ap .wend .wwhy { font-size: 14.5px; color: #e8dcc0; }
.ap .wr.fast .wrd.slow .wcmds, .ap .wr.fast .wrd.slow .wst, .ap .wr.fast .wrd.slow .wpush, .ap .wr.fast .wend, .ap .wr.fast .wnext { animation-delay: 0s !important; animation-duration: .01s !important; }
.ap .wr.fast .wbar i.wgr, .ap .wr.fast .wn.swap > * { animation-delay: 0s !important; animation-duration: .01s !important; }
/* 싸움이 열린다 — 계절 띠처럼 가운데 이름 (북 · 종) */
.ap .warfx { position: fixed; inset: 0; z-index: 70; display: flex; align-items: center; justify-content: center; pointer-events: none;
  background: radial-gradient(circle, #000b 0, #0000 72%); animation: sfx 2.4s ease-out forwards; }
.ap .warfx > div { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 18px 36px; border-radius: 18px; background: #1a1210ee;
  border: 1px solid #a0502a; box-shadow: 0 8px 40px #000c; animation: sfxin 1.6s cubic-bezier(.2, 1.4, .4, 1) forwards; }
.ap .warfx b { font-family: 'Gowun Batang', serif; font-size: 30px; color: #f0c080; letter-spacing: 2px; }
.ap .warfx span { font-size: 13.5px; color: #e0d0c0; }
@media (prefers-reduced-motion: reduce) { .ap .wr *, .ap .warfx, .ap .warfx * { animation-duration: .01s !important; animation-delay: 0s !important; transition: none !important; } }
`

/**
 * 전장을 연다 — 이번 계절에 우리가 낄 싸움이 없으면 false (부른 쪽이 바로 넘긴다).
 * 싸움마다 시험 돌림으로 판을 찾고, 다 끝나면 host.done(tactics).
 */
export function openWar(root: HTMLElement, prev: Realm, orders: readonly Order[], host: WarHost): boolean {
  const done: Record<string, Tactic> = {}
  let cur: { key: string; cmds: (Cmd | RoundOrder)[] } | null = null
  /** 지금 고르는 합의 깃발 — 무리마다 */
  let sel: { -readonly [K in keyof RoundOrder]: RoundOrder[K] } = {}
  let t = rehearse(prev, orders, done, null, host.me)
  if (t.line === null) return false
  /** 처음 우리 싸움 수 — 머리의 "몇 판" */
  let left = t.left
  /** 이름 띠를 띄운 판 — 판마다 한 번 */
  let named: string | undefined
  const ov = document.createElement('div')
  ov.className = 'wr'
  root.appendChild(ov)
  // 싸우는 동안 배우기 띠는 숨긴다 (형: "싸우는도중에 하단에 배우기 창 계속 떠있어서 짜증나")
  root.classList.add('war-open')
  const timers: number[] = []
  const clearTimers = (): void => { for (const x of timers.splice(0)) clearTimeout(x) }
  const at = (s: number, name: string, vol: number): void => {
    timers.push(window.setTimeout(() => { if (document.visibilityState === 'visible') host.ding(name, vol) }, s * 1000))
  }

  // 소리 — 깃발 → 맞부딪힘(필살이면 크게) → 마지막 일격 · 이김/짐. 탭이 보일 때만
  const sound = (rd: RoundLog | undefined, weAtk: boolean, end: BattleLine | null): void => {
    clearTimers()
    if (document.visibilityState !== 'visible') return
    if (rd !== undefined) {
      const ourSide = weAtk ? 'a' : 'd'
      at(STAGE_S[0], BATTLE_SFX[weAtk ? rd.a : rd.d], 0.45)
      if (rd.ev === 'capture-ok') at(STAGE_S[1], rd.by === ourSide ? BATTLE_SFX.caught : BATTLE_SFX.lose, 0.5)
      else if (rd.ev === 'duel-win' || rd.ev === 'duel-lose') at(STAGE_S[1], BATTLE_SFX.duelWin, 0.45)
      else at(STAGE_S[1], rd.beat !== null ? BATTLE_SFX.crit : BATTLE_SFX.clash, rd.beat !== null ? 0.6 : 0.4)
    }
    if (end !== null) {
      const atkWon = end.outcome === 'rout' || end.outcome === 'win'
      const good = (end.atkFaction === host.me) === atkWon && end.outcome !== 'draw'
      if (end.outcome === 'rout' || end.outcome === 'routed') at(STAGE_S[2] + 0.4, BATTLE_SFX.final, 0.5)
      at(STAGE_S[2] + 1, good ? BATTLE_SFX.win : BATTLE_SFX.lose, 0.45)
    }
  }

  /** 싸움이 열린다 — 이름 띠 · 북 두 번 · 종 (계절 띠와 같은 길: 애니메이션이 끝나면 지운다) */
  const band = (l: BattleLine): void => {
    if (named === l.key) return
    named = l.key
    const weAtk = l.atkFaction === host.me
    const st = l.start
    const us = st !== undefined ? st.men[weAtk ? 0 : 1] : 0
    const them = st !== undefined ? st.men[weAtk ? 1 : 0] : 0
    const el = document.createElement('div')
    el.className = 'warfx'
    el.innerHTML = `<div><b>${esc(warName(t.after, l))}</b><span>우리 ${us.toLocaleString('ko-KR')}명 · 적 ${them.toLocaleString('ko-KR')}명</span></div>`
    el.addEventListener('animationend', (e) => { if (e.target === el) el.remove() })
    root.appendChild(el)
    if (document.visibilityState === 'visible') {
      at(0, BATTLE_SFX.openDrum, 0.5)
      at(0.38, BATTLE_SFX.openDrum, 0.5)
      at(0.95, BATTLE_SFX.openBell, 0.4)
    }
  }

  const paintNow = (anim: boolean): void => {
    const l = t.line!
    const shown = l.pending !== undefined ? l.pending.round : (l.rounds ?? []).length
    ov.innerHTML = warHtml(prev, t.after, l, host.me, host.art, shown, anim, left, sel)
  }

  const draw = (anim: boolean): void => {
    const l = t.line!
    const shown = l.pending !== undefined ? l.pending.round : (l.rounds ?? []).length
    ov.classList.toggle('slow', anim)
    ov.classList.remove('fast')
    paintNow(anim)
    sound(anim ? (l.rounds ?? [])[shown - 1] : undefined, l.atkFaction === host.me, anim && l.pending === undefined ? l : null)
    if (!anim) band(l)
    if (anim) ov.querySelector('.wrd.slow')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    else ov.scrollTop = 0
  }

  const finish = (): void => {
    clearTimers()
    ov.remove()
    root.classList.remove('war-open')
    host.done({ ...done })
  }

  /** 지금 판을 다 골랐다 — 그 명령으로 굳히고 결과를 보인다 (남은 합은 맡긴다) */
  const settle = (): void => {
    const key = cur?.key ?? t.line?.key
    if (key === undefined) return
    done[key] = { cmds: [...(cur?.key === key ? cur.cmds : [])] }
    cur = null
    sel = {}
    t = rehearse(prev, orders, done, null, host.me, key)
    if (t.line === null) advanceTo()
    else draw(true)
  }

  /** 다음 우리 싸움으로 — 없으면 마무리 */
  const advanceTo = (): void => {
    t = rehearse(prev, orders, done, null, host.me)
    if (t.line === null) {
      finish()
      return
    }
    left = t.left
    draw(false)
  }

  ov.addEventListener('click', (ev) => {
    ev.stopPropagation()
    const b = (ev.target as HTMLElement).closest<HTMLElement>('[data-war]')
    if (b === null) {
      ov.classList.add('fast') // 아무 데나 누르면 이 합을 끝까지 바로
      return
    }
    const l = t.line
    if (l === null || l.key === undefined) return
    host.ding('click1', 0.18)
    switch (b.dataset['war']) {
      case 'pick': {
        // 무리마다 깃발 하나 — 같은 것을 또 누르면 내린다(맡긴다). 다시 그리되 자리는 그대로
        const g = b.dataset['g'] as Grp | 'lead'
        const c = b.dataset['c'] as Cmd
        sel = { ...sel, [g]: sel[g] === c ? undefined : c }
        if (sel[g] === undefined) delete sel[g]
        const y = ov.scrollTop
        ov.classList.remove('slow')
        ov.classList.add('fast')
        paintNow(false)
        ov.scrollTop = y
        return
      }
      case 'go': {
        if (cur === null || cur.key !== l.key) cur = { key: l.key, cmds: [] }
        cur.cmds.push({ ...sel })
        sel = {}
        t = rehearse(prev, orders, done, cur, host.me)
        if (t.line === null || t.line.key !== cur.key) {
          // 그 합으로 판이 끝났다 — 굳히고 결과를 보인다
          settle()
          return
        }
        if (t.line.pending === undefined) {
          done[cur.key] = { cmds: [...cur.cmds] }
          cur = null
        }
        draw(true)
        return
      }
      case 'auto': settle(); return
      case 'autoall': {
        if (cur !== null) done[cur.key] = { cmds: [...cur.cmds] }
        finish()
        return
      }
      case 'next': {
        if (cur !== null) done[cur.key] = { cmds: [...cur.cmds] }
        cur = null
        sel = {}
        left = Math.max(0, left - 1)
        advanceTo()
        return
      }
      default: return
    }
  })
  draw(false)
  return true
}
