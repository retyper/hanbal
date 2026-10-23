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
import { FACTION_ART, UNIT_ICON, bustOf } from '../../realm/data/art.ts'
import { GROUP_NAME, battleName, endStory, fieldName, groupLabel, josa, roundStory, storyCtx } from '../../realm/data/prose.ts'
import { groupMen } from '../../realm/tactics.ts'
import { rehearse, type BattleLine } from '../../realm/warroom.ts'
import { seasonOf } from '../../realm/season.ts'
import type { Act, Approach, Art, Cmd, Grp, Order, Realm, RoundLog, RoundOrder, Tactic } from '../../realm/types.ts'
import { snd } from './sound.ts'
import { WIN_BUZZ, winFxHtml } from './winfx.ts'

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
  drum: '격려', duel: '장수 겨루기', capture: '적장 사로잡기', retreat: '물러난다', art: '장수의 비기',
}
export const CMD_ICON: Record<Cmd, string> = {
  charge: UNIT_ICON.spear, hold: UNIT_ICON.shield, open: UNIT_ICON.pike, ford: 'unit-gaya-heavy', rocks: 'unit-slingers', gate: 'cmd-gate', ram: UNIT_ICON.boat,
  volley: UNIT_ICON.bow, counter: UNIT_ICON.crossbow, fire: 'unit-fire-archers', height: 'unit-scouts',
  flank: UNIT_ICON.horse, punch: UNIT_ICON.horse, pursue: UNIT_ICON.horse, guard: 'unit-general',
  drum: 'unit-drummers', duel: 'unit-general', capture: 'unit-axemen', retreat: 'unit-porters', art: 'status-morale-up',
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
  drum: '장수가 군사를 다잡는다 — 사기가 조금 오른다',
  duel: '장수끼리 나선다 · 이기면 적이 무너지고, 지면 우리 장수가 다치거나 쓰러진다 · 한 번',
  capture: '날랜 무리를 적장에게 보낸다 · 무리가 호위보다 크고 적이 흔들릴수록 잘 된다 · 놓치면 무리를 잃는다',
  retreat: '징을 쳐 물린다 · 덜 잃고 장수는 안 잡힌다',
  art: '그 장수만의 수 · 한 판에 한 번',
}

/** 장수의 비기 — 이름 · 그림 · 하는 일 (heroes.heroArt · tactics 의 비기). 장수마다 다르니 깃발에 그 이름으로 뜬다 */
export const ART_NAME: Readonly<Record<Art, string>> = {
  snipe: '명궁의 한 발', rite: '진중 굿', sway: '항복 권유', stand: '버텨라', ambush: '샛길 기습',
  vanguard: '선봉에 선다', feint: '거짓 퇴각', order: '진을 다잡는다', shout: '큰 외침',
}
export const ART_ICON: Readonly<Record<Art, string>> = {
  snipe: 'unit-archer', rite: 'unit-shaman', sway: 'status-betrayal', stand: 'unit-shield-wall', ambush: 'unit-scouts',
  vanguard: 'unit-general', feint: 'unit-porters', order: 'unit-drummers', shout: 'status-morale-up',
}
export const ART_DOES: Readonly<Record<Art, string>> = {
  snipe: '장수가 몸소 적장을 쏜다 — 적장이 다쳐 사로잡기 쉬워지고 적 사기가 꺾인다 · 한 번',
  rite: '진중에서 굿을 한다 — 우리 사기가 크게 오른다 (처음보다 높아질 수 있다) · 한 번',
  sway: '흔들리는 적에게 무기를 버리라 외친다 — 무리마다 일부가 넘어온다 · 안 흔들리면 헛일 · 한 번',
  stand: '백 사람의 이름을 부르며 버틴다 — 이 합 우리가 덜 잃는다 · 한 번',
  ambush: '샛길로 돌린 무리가 먼저 친다 — 적 궁수(없으면 앞줄)가 쓰러진다 · 한 번',
  vanguard: '장수가 맨 앞에 선다 — 이 합 우리 앞줄이 세다 · 한 번',
  feint: '물러나는 척 적의 돌격을 끌어들인다 — 적이 달려들면 꺾고, 안 달려들면 헛일 · 한 번',
  order: '흐트러진 진을 다잡는다 — 이 합 우리가 덜 잃는다 · 한 번',
  shout: '크게 외쳐 군사를 일으킨다 — 우리 사기가 오른다 · 한 번',
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
  volley: snd('arrow_volley'), counter: 'shot_flecha', fire: 'crash_01', height: 'shot_longbow',
  // 사람 고함·비명(roar · herodeath · bossdeath)은 걷었다 (형 10-23: "비명소리인지 사람 고함인지 너무 AI 가 만든 티") — 말발굽·쇠·북으로
  flank: snd('horses'), punch: snd('horses'), pursue: snd('horses'), guard: 'parry_02',
  drum: 'impactWood_medium_000', duel: 'unsheath_01', capture: 'sheath_01', retreat: 'switch2', art: 'impactBell_heavy_000',
  /** 맞부딪힘 — 상성에서 이겼다(필살) · 그냥 */
  crit: 'impactPunch_heavy_000', clash: 'impactWood_heavy_000',
  /** 사로잡았다 · 장수 겨루기 · 마지막 일격(적이 무너졌다) · 이겼다 · 졌다 */
  caught: 'jingleUnlock', duelWin: 'impactMetal_medium_001', final: 'impactWood_heavy_001', win: snd('horn_victory'), lose: snd('defeat'),
  /** 싸움이 열린다 — 북 두 번, 종 한 번, 함성 */
  openDrum: 'impactWood_heavy_000', openBell: 'impactBell_heavy_001', cry: snd('war_cry'),
} as const

/**
 * 타는 고을 — 불꽃 한 장을 늘였다 줄였다 하면 어색했다 (형 10-23: "불타는 이미지는 어색하지 않게"). 작은 불길 여럿이 저마다 솟았다 스러지고
 * 불티가 낱낱이 날아오른다 (이펙트는 낱낱이 — 덩어리를 흔들지 않는다). 자리는 늘 같다(꾸밈이라 판정과 상관없다)
 */
const FLAMES = 11
const EMBERS = 14
export function burnHtml(art: string, side: 'l' | 'r'): string {
  const h = (i: number, k: number): number => { const x = Math.sin(i * 12.9898 + k * 78.233 + (side === 'l' ? 0 : 17)) * 43758.5453; return x - Math.floor(x) }
  let s = `<div class="wburn ${side}"><i class="bed"></i>`
  for (let i = 0; i < FLAMES; i++) {
    s += `<img src="${art}fx/fire.png" alt="" style="--x:${(h(i, 1) * 100).toFixed(0)}%;--s:${(0.55 + h(i, 2) * 0.7).toFixed(2)};--t:${(-h(i, 3) * 1.4).toFixed(2)}s;--d:${(1.0 + h(i, 4) * 0.7).toFixed(2)}s">`
  }
  for (let i = 0; i < EMBERS; i++) {
    s += `<b style="--x:${(h(i, 5) * 100).toFixed(0)}%;--t:${(-h(i, 6) * 2.4).toFixed(2)}s;--d:${(1.6 + h(i, 7) * 1.4).toFixed(2)}s;--w:${Math.round(-30 + h(i, 8) * 60)}px"></b>`
  }
  return s + '</div>'
}

/** 한 합이 풀리는 사이 (초) — 깃발 → 이야기 → 사람 수 */
const STAGE_S = [0, 1.1, 2.4] as const

const ROUND_NAME = ['첫째', '둘째', '셋째', '넷째', '다섯째', '여섯째']

export interface WarHost {
  readonly art: string
  readonly me: string
  ding(name: string, vol?: number): void
  /** 음악 — 싸움이 열리면 싸움 음악, 끝나면 이긴·진 음악 (비기면 그대로) */
  music?(kind: 'war' | 'win' | 'lose'): void
  /** 다 골랐다 — 이 명령들로 진짜 넘긴다 */
  done(tactics: Record<string, Tactic>): void
}

/** 무리의 그림 — 싸움 기록의 잃은 사람 칩 */
const GROUP_ICON: Readonly<Record<Grp, string>> = { front: UNIT_ICON.spear, bows: UNIT_ICON.bow, horse: UNIT_ICON.horse }

/** 무리를 대표하는 병종 그림 — 그 무리에서 가장 많은 병종 (창병·방패병·장창병 · 궁수·쇠뇌 · 기병) */
function groupIcon(mix: Readonly<Partial<Record<string, number>>>, g: Grp | 'lead'): string {
  if (g === 'lead') return 'unit-general'
  const ks = Object.keys(mix).filter((k) => (mix[k] ?? 0) > 0 && (k === 'bow' || k === 'crossbow' ? 'bows' : k === 'horse' ? 'horse' : 'front') === g)
    .sort((p, q) => (mix[q] ?? 0) - (mix[p] ?? 0))
  const k = ks[0] as keyof typeof UNIT_ICON | undefined
  return k !== undefined && UNIT_ICON[k] !== undefined ? UNIT_ICON[k] : GROUP_ICON[g]
}

/** 일의 결과 — 한 일을 한 쪽에서 보아 먹혔나(ok) · 막혔나(no) · 맞섰나(even) */
const ACT_RES: Readonly<Record<Act['res'], 'ok' | 'no' | 'even'>> = {
  won: 'ok', hit: 'ok', ok: 'ok', lost: 'no', blocked: 'no', wasted: 'no', fail: 'no', even: 'even', stall: 'even',
}

/**
 * 한 합의 일을 그림 줄로 (형: "창병 방패병 이런게 아이콘으로 안뜨고 누가 누굴 공격하고 성공했는지 실패했는지가 한눈에 안보여") —
 * [우리/적 · 무리 그림 · 명령] → [맞은편 무리 그림] · ✓ 먹혔다 / ✕ 막혔다 / = 맞섰다 · 맞은편이 잃은 사람.
 * 우리에게 좋은 일은 초록, 나쁜 일은 붉게. 글 이야기는 그 밑에 작게 남는다
 */
export function actRows(acts: readonly Act[] | undefined, ourS: 'a' | 'd', art: string, mixA: Readonly<Partial<Record<string, number>>>, mixD: Readonly<Partial<Record<string, number>>>): string {
  const list = (acts ?? []).filter((x) => !(x.c === 'drum' && x.tg === undefined))
  if (list.length === 0) return ''
  const mixOfS = (s: 'a' | 'd'): Readonly<Partial<Record<string, number>>> => (s === 'a' ? mixA : mixD)
  let h = '<div class="wacts">'
  for (const x of list) {
    const us = x.s === ourS
    const other = x.s === 'a' ? 'd' : 'a'
    const r = ACT_RES[x.res]
    const good = r === 'even' ? '' : (r === 'ok') === us ? ' good' : ' bad'
    const verb = x.c === 'art' && x.art !== undefined ? ART_NAME[x.art] : CMD_NAME[x.c]
    const badge = r === 'ok' ? '✓' : r === 'no' ? '✕' : '='
    const word = r === 'ok' ? (x.tg !== undefined ? '먹혔다' : '해냈다') : r === 'no' ? (x.res === 'wasted' ? '헛방' : '막혔다') : '맞섰다'
    h += `<div class="wact${us ? ' us' : ' foe'}${good}"><span class="who">${us ? '우리' : '적'}</span><img src="${art}icon/${groupIcon(mixOfS(x.s), x.g)}.png" alt=""><b>${esc(verb)}</b>`
    if (x.tg !== undefined) h += `<i class="arw">→</i><img class="tg" src="${art}icon/${groupIcon(mixOfS(other), x.tg)}.png" alt="">`
    h += `<span class="res">${badge} ${word}</span>`
    if ((x.tl ?? 0) > 0) h += `<span class="loss">${us ? '적' : '우리'} −${x.tl}</span>`
    if ((x.sl ?? 0) > 0) h += `<span class="loss own">${us ? '우리' : '적'} −${x.sl}</span>`
    h += '</div>'
  }
  return h + '</div>'
}

/** 원군이 닿은 합의 띠 (형: "열세에 밀린 아군에 로한의 기병대 같은 쾌감") — 우리 원군은 금빛, 적 원군은 붉게 */
export function reliefBanner(rd: RoundLog, ourS: 'a' | 'd', art: string): string {
  const x = rd.relief
  if (x === undefined) return ''
  const us = x.side === ourS
  const ic = x.horse ? UNIT_ICON.horse : UNIT_ICON.spear
  const line = us
    ? (x.horse ? `우리 기병 원군 ${x.men}명이 옆구리를 들이친다! 적이 흔들린다` : `우리 원군 ${x.men}명이 닿았다! 적의 옆을 친다`)
    : (x.horse ? `적의 기병 원군 ${x.men}명이 닿았다 — 우리 옆이 뚫린다` : `적의 원군 ${x.men}명이 닿았다 — 우리가 밀린다`)
  return `<div class="wrelief ${us ? 'us' : 'foe'}"><img src="${art}icon/${ic}.png" alt=""><b>${us ? '원군이다!' : '적의 원군'}</b><span>${esc(line)}</span></div>`
}

/** 한 합에 무리마다 잃은 사람 — [무리, 수] (그 합 앞의 무리 수에서 뺀다) */
function groupLoss(before: Readonly<Partial<Record<Grp, number>>>, after: Readonly<Partial<Record<Grp, number>>> | undefined): Array<[Grp, number]> {
  if (after === undefined) return []
  return (['front', 'bows', 'horse'] as const).map((g) => [g, Math.max(0, Math.round((before[g] ?? 0) - (after[g] ?? 0)))] as [Grp, number]).filter(([, n]) => n > 0)
}

/** 맡겼을 때 — 장수의 지략이 무엇을 해 주나 (aiOrder: 지략만큼 적 앞줄의 버릇을 읽어 맞수를 둔다 · 흔들리는 적에 들이친다) */
function autoLine(h: { name: string; ryak: number } | undefined): string {
  if (h === undefined) return '장수가 없다 — 무리마다 제 버릇대로 싸운다'
  const full = Math.max(1, Math.min(5, Math.round(h.ryak / 2)))
  const dots = '●'.repeat(full) + '○'.repeat(5 - full)
  const feel = h.ryak >= 8 ? '적의 수를 잘 읽어 맞수를 둔다 — 맡겨도 좋다' : h.ryak >= 6 ? '곧잘 맞수를 둔다' : h.ryak >= 4 ? '반쯤은 제 버릇대로 싸운다' : '수를 잘 못 읽는다 — 직접 고르는 게 낫다'
  return `${esc(h.name)} · 지략 <span class="wdots">${dots}</span> — ${feel}`
}

function face(id: string | null, art: string, fallback: string): string {
  const file = id !== null ? bustOf(id) : undefined
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
    case 'ridge': return ok ? '산기슭을 돌아 적의 뒤로 나왔다 — 높은 곳을 잡았다.' : '산길에서 적의 정찰꾼에게 들켰다.'
    case 'cliff': return ok ? '절벽을 타고 올라 성 안으로 뛰어내렸다!' : '절벽을 오르다 들켰다. 돌과 화살에 많이 떨어졌다.'
  }
}

/** 한 쪽이 든 깃발들 — 앞줄 · 활 · 기병 · 장수(북은 빼고) */
function flags(o: RoundOrder | undefined, chip: Cmd, art: string, ak?: Art): string {
  const xs: Cmd[] = o === undefined ? [chip] : [o.front, o.bows, o.horse, o.lead !== 'drum' ? o.lead : undefined].filter((c): c is Cmd => c !== undefined)
  // 장수의 비기는 그 비기의 이름·그림으로 (빛나는 칩)
  return xs.map((c) => (c === 'art' && ak !== undefined
    ? `<span class="wfl art"><img src="${art}icon/${ART_ICON[ak]}.png" alt="">${ART_NAME[ak]}</span>`
    : `<span class="wfl"><img src="${art}icon/${CMD_ICON[c]}.png" alt="">${CMD_NAME[c]}</span>`)).join('')
}

/** 싸움터 그림의 땅 — HoMM3 처럼 그 땅이 배경이 된다 (형: "싸울때 배경이 전쟁터 배경이어야") · docs/GAP.md §12 */
export type WarGround = 'field' | 'ford' | 'pass' | 'forest' | 'gate' | 'sea' | 'snow' | 'night'

/**
 * 받아 둔 싸움터 그림 (public/realm/battle/battle-<땅>.jpg). 아직 없는 땅은 있는 장면 그림을 어둡게 깐다 —
 * 그림이 오면 여기에 이름만 더한다 (ART-QUEUE)
 */
const WAR_BG_READY: ReadonlySet<WarGround> = new Set<WarGround>(['field', 'ford', 'pass', 'forest', 'gate', 'sea', 'snow', 'night'])
const WAR_BG_FALLBACK: Readonly<Record<WarGround, string>> = {
  field: 'event/event-goguryeo-hunt', ford: 'event/event-monsoon-ford', pass: 'event/event-goguryeo-hunt', forest: 'event/event-night-raid',
  gate: 'event/event-palisade-build', sea: 'event/event-eight-harbours', snow: 'event/event-winter-ambush', night: 'event/event-night-raid',
}

/** 이 싸움이 어디서 났나 — 밤길 · 겨울 · 성문 · 물 · 길의 종류 순으로 */
export function warGround(r: Realm, l: BattleLine): WarGround {
  const node = r.nodes[l.node]
  if (l.approach === 'night' && l.ambush === 'success') return 'night'
  if (seasonOf(r.season) === 'winter') return 'snow'
  const via = l.via
  if (via === 'sea' || (l.field !== true && node?.kind === 'port' && via === undefined)) return 'sea'
  if (l.field !== true && node !== undefined && (node.kind === 'fort' || node.kind === 'capital' || node.tags.includes('palisade'))) return 'gate'
  if (via === 'ford' || via === 'reeds' || via === 'mudflat') return 'ford'
  if (via === 'pass') return 'pass'
  if (via === 'forest') return 'forest'
  return 'field'
}

function warBg(art: string, g: WarGround): string {
  return WAR_BG_READY.has(g) ? `${art}battle/battle-${g}.jpg` : `${art}${WAR_BG_FALLBACK[g]}.jpg`
}

/** 그 판의 이름 — 땅에서 딴다 (prose.battleName). 옛 보고처럼 판 기록이 모자라면 곳 이름으로 */
export function warName(r: Realm, l: BattleLine): string {
  return r.nodes[l.node] !== undefined ? battleName(r, l) : `${l.field === true && l.edge !== undefined ? fieldName(r, l.edge) : l.node} 싸움`
}

/** 전장 한 판의 화면 — 보인 합(shown)까지. 마지막 합은 천천히 풀린다(anim). sel 은 지금 고르는 깃발 */
/** 활을 쏘는 명령 — 그 합에 화살이 날아간다 */
const SHOOT_CMD: ReadonlySet<string> = new Set(['volley', 'counter', 'open', 'height'])
/** 한 무리의 화살 수 */
const VOLLEY_N = 14

/**
 * 화살 한 무리 — 낱낱이 (형: "화살이 지금 이미지 통째로 날아가는데"). dir r: 우리(왼쪽)가 쏜다 · l: 적(오른쪽)이 쏜다.
 * 화살마다 떠나는 자리·높이·거리·때가 조금씩 다르다 (꾸밈이라 판의 시드와 상관없이 고정된 굴림)
 */
function volleyHtml(art: string, dir: 'r' | 'l', at: number): string {
  let s = dir === 'r' ? 3 : 11
  const rnd = (): number => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
  let h = ''
  for (let i = 0; i < VOLLEY_N; i++) {
    h += `<i style="--x:${(2 + rnd() * 14).toFixed(1)}%;--y:${(52 + rnd() * 24).toFixed(1)}%;--dx:${(56 + rnd() * 16).toFixed(1)}vw;--up:${(12 + rnd() * 16).toFixed(1)}vh;--t:${(at + rnd() * 0.35).toFixed(2)}s;--z:${(0.75 + rnd() * 0.4).toFixed(2)}">`
      + `<b style="background-image:url('${art}fx/arrow.png')"></b></i>`
  }
  return `<div class="wfx-volley ${dir}">${h}</div>`
}

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
  // 마지막 합에 맞은 쪽은 흔들린다 (형: "피격당한쪽이 흔들리거나") — 우리는 붉게, 적은 금빛으로 번쩍
  const hitOf = (i: 0 | 1): string => {
    if (!anim) return ''
    const lost = Math.round(men0(i) * (n0(i) - n(i)))
    if (lost <= 0) return ''
    const j: 0 | 1 = i === 0 ? 1 : 0
    const other = Math.round(men0(j) * (n0(j) - n(j)))
    return ` hit${lost > other * 1.3 ? ' hithard' : ''}`
  }
  const side = (i: 0 | 1, hero: string | null, f: string | undefined, name: string, cls: string): string => {
    const now = Math.round(men0(i) * n(i))
    const old = Math.round(men0(i) * n0(i))
    const base = Math.max(0.05, st?.morale[i] ?? 1)
    const mr = (x: number): number => Math.round(Math.max(0, Math.min(1.2, x / base)) * 83)
    const num = old !== now ? `<span class="wn swap"><s>${old}명</s><u>${now}명</u></span>` : `<span class="wn">${now}명</span>`
    const hitFx = hitOf(i) !== '' ? `<img class="wfx-hit" src="${art}fx/impact.png" alt="">` : ''
    const em = f !== undefined ? FACTION_ART[f]?.emblem : undefined
    return `<div class="ws ${cls}${hitOf(i)}" style="--hd:${STAGE_S[1] + 0.15}s">${hitFx}${face(hero, art, unitOf(i))}<b>${esc(name)}</b><span class="wnat">${em !== undefined ? `<img src="${art}icon/${em}.png" alt="">` : ''}${esc(fname(f))}</span>`
      + `<div class="wbar men">${bar(Math.round(n(i) * 100), Math.round(n0(i) * 100))}</div>${num}`
      + `<div class="wbar mor">${bar(mr(m(i)), mr(m0(i)))}</div><span class="wn">사기</span></div>`
  }

  // 싸움터 배경 (땅마다) · 위 카드는 굴려도 그 자리에 (형: "싸우는로그가 스크롤로 보이더라도 상단에 캐릭터랑 체력바 있는 그 카드는 고정")
  const ground = warGround(prev, l)
  let h = `<div class="wbg g-${ground}${WAR_BG_READY.has(ground) ? '' : ' stand'}" style="background-image:url('${warBg(art, ground)}')"></div>`
  // 싸움의 기운 — 흙먼지 둘이 바닥을 흐르고, 이 합에 활을 쏜 쪽에서 화살이 낱낱이 활꼴로 날아간다 (그림: realm/fx)
  h += `<div class="wfx"><img class="wfx-dust a" src="${art}fx/dust.png" alt=""><img class="wfx-dust b" src="${art}fx/dust.png" alt="">`
  if (anim && last !== undefined) {
    const usShoot = SHOOT_CMD.has(weAtk ? last.a : last.d), foeShoot = SHOOT_CMD.has(weAtk ? last.d : last.a)
    if (usShoot) h += volleyHtml(art, 'r', STAGE_S[1] - 0.5)
    if (foeShoot) h += volleyHtml(art, 'l', STAGE_S[1] - (usShoot ? 0.25 : 0.5))
  }
  h += `</div><div class="wrbox">`
  // 위 카드는 그 싸움터를 무대로 — 길·성문·물가·눈밭·밤 (형 10-23: "길에서 마주치거나 수성하거나 공성할 때는 그 위치에 맞게 배경")
  h += `<div class="wtop" style="--wtbg:url('${warBg(art, ground)}')"><div class="wrh"><b>${esc(warName(after, l))}</b>${left > 1 ? `<span class="mute">이번 계절 우리 싸움 ${left}판</span>` : ''}</div>`
  h += `<div class="wvs">${side(ourI, ourHero, ourF, ourName, 'us')}<i class="vs">VS</i>${side(foeI, foeHero, foeF, foeName, 'foe')}</div></div>`
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
    h += `<div class="wrd${slow ? ' slow' : ''}${crit ? ' crit' : ''}"><div class="wrn">${ROUND_NAME[i] ?? `${i + 1}`} 합</div>${reliefBanner(rd, ourS, art)}`
    const akOf = (sd: 'a' | 'd'): Art | undefined => (rd.acts ?? []).find((x) => x.c === 'art' && x.s === sd)?.art
    h += `<div class="wcmds"${d(0)}><span class="wc us">${flags(weAtk ? rd.oa : rd.od, weAtk ? rd.a : rd.d, art, akOf(ourS))}</span><i>×</i><span class="wc foe">${flags(weAtk ? rd.od : rd.oa, weAtk ? rd.d : rd.a, art, akOf(ourS === 'a' ? 'd' : 'a'))}</span></div>`
    const story = ctx !== null ? roundStory(rd, rounds[i - 1], ctx) : []
    // 누가 누구를 · 됐나 — 그림 줄이 먼저, 글 이야기는 그 밑에 작게
    const rows = actRows(rd.acts, ourS, art, mixOf(0), mixOf(1))
    h += `<div class="wst${rows !== '' ? ' sm' : ''}"${d(1)}>${rows}${story.map((s) => `<p>${esc(s)}</p>`).join('')}</div>`
    // 사로잡기·물러나기로 끝난 합은 밀고 밀린 것이 없다
    if (rd.ev === 'capture-ok' || rd.ev === 'retreat') h += `<p class="wpush"${d(2)}>싸움이 거기서 끝났다</p></div>`
    else {
      // 무리마다 — 앞줄·활·말 그림과 잃은 수 (형: "전투로그에서도 다이나믹함이 보이게끔 유닛마다 아이콘도 같이")
      const gBefore = (sd: 0 | 1): Readonly<Partial<Record<Grp, number>>> => (i === 0 ? groupMen(mixOf(sd) as Parameters<typeof groupMen>[0]) : (sd === 0 ? rounds[i - 1]!.ga : rounds[i - 1]!.gd) ?? {})
      const chips = (sd: 0 | 1): string => groupLoss(gBefore(sd), sd === 0 ? rd.ga : rd.gd).map(([g, k]) => `<span class="wl"><img src="${art}icon/${GROUP_ICON[g]}.png" alt="">−${k}</span>`).join('')
      const cu = chips(ourI)
      const cf = chips(foeI)
      h += `<p class="wpush ${pc}"${d(2)}>${pw}</p><p class="wloss"${d(2)}><span class="us">우리 ${cu !== '' ? cu : `−${lostUs}`}</span><span class="foe">적 ${cf !== '' ? cf : `−${lostFoe}`}</span></p></div>`
    }
  })
  h += `</div>`

  const p = l.pending
  const ended = p === undefined
  if (p !== undefined && p.round === shown) {
    // 다음 합의 깃발을 든다 — 무리마다 하나, 장수 하나
    h += `<div class="wnext"><div class="wrn">${ROUND_NAME[shown] ?? `${shown + 1}`} 합 </div>`
    // 낌새는 본 것·들은 것에서만 (형: "직접본거나 주변정보여야지 짐작이머냐")
    const hl = p.hint !== null ? (p.hintSrc === 'habit' ? HABIT_LINE[p.hint] : HINT_LINE[p.hint]) : undefined
    if (p.hint !== null && hl !== undefined && p.hintSrc === 'habit') h += `<p class="whint"><b>적장의 버릇</b> ${esc(josa(foeName, '은', '는'))} 겨뤄 보니 ${esc(hl)} <span class="mute">— 이번 합에도 그럴지는 모른다</span></p>`
    else if (p.hint !== null && hl !== undefined) h += `<p class="whint"><b>적 앞줄의 낌새</b> ${esc(hl)} <span class="mute">— ${l.field === true ? '눈앞에서 맞붙어 보인다' : weAtk ? '척후가 이번 계절 보고 왔다' : '다가오는 것을 지켜봤다'}</span></p>`
    else h += `<p class="whint mute">적진의 속이 보이지 않는다 — 정찰을 보냈거나 그 적장과 겨뤄 본 적이 있으면 보인다.</p>`
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
      // 장수의 비기 — 그 장수만의 이름·그림 (형: "아이콘과 함께 그거라는걸 알게 해줘야함")
      const ak = c === 'art' ? p.art : undefined
      if (ak !== undefined) tag = `<em class="art">비기</em>`
      return `<button class="wcmd ${c}${on ? ' on' : ''}" data-war="pick" data-g="${g}" data-c="${c}"><img src="${art}icon/${ak !== undefined ? ART_ICON[ak] : CMD_ICON[c]}.png" alt=""><b>${ak !== undefined ? ART_NAME[ak] : CMD_NAME[c]}</b>${tag}${feel}<small>${esc(ak !== undefined ? ART_DOES[ak] : CMD_DOES[c])}</small></button>`
    }
    for (const gr of p.groups) {
      if (gr.options.length === 0) continue
      h += `<div class="wgrp"><div class="wgh"><b>${GROUP_NAME[gr.g]}</b> ${esc(groupLabel(mixOf(ourI), gr.g))} ${gr.men}명${sel[gr.g] === undefined ? '<span class="mute"> — 안 고르면 장수가 알아서</span>' : ''}</div>`
      h += `<div class="wcmdgrid">${gr.options.map((c) => opt(gr.g, c)).join('')}</div></div>`
    }
    if (p.lead.length > 0) {
      h += `<div class="wgrp"><div class="wgh"><b>장수</b> ${esc(ourName)}${sel.lead === undefined ? '<span class="mute"> — 안 고르면 격려</span>' : ''}</div>`
      h += `<div class="wcmdgrid">${p.lead.map((c) => opt('lead', c)).join('')}</div></div>`
    }
    // 맡기면 장수의 지략대로 — 그 장수의 얼굴·지략을 단추 옆에 (형: "장수의 지략?수치가 … 버튼주변에 뭔가보여지면")
    const ourH = ourHero !== null ? (prev.heroes[ourHero] ?? after.heroes[ourHero]) : undefined
    h += `<div class="wfoot"><div class="wauto">${ourH !== undefined ? face(ourHero, art, unitOf(ourI)) : ''}<span>${autoLine(ourH)}</span></div>`
    // 누구에게 무엇을 맡기나 — 말로 (형 10-23: "'이 싸움은 맡긴다'는 뭔 소린지 모르겠잖아. 장수에게 전투를 전부 일임한다 이런 식으로")
    const whom = ourHero !== null ? `${josa(ourName, '에게', '에게')} 이 싸움을 끝까지 맡긴다` : '이 싸움은 끝까지 알아서 싸운다'
    h += `<button class="btn ghost" data-war="auto">${esc(whom)}</button>${left > 1 ? `<button class="btn ghost" data-war="autoall">남은 싸움도 모두 장수들에게</button>` : ''}`
    // 이 합을 싸운다 — 장수의 「격려」와 헷갈리지 않게 북 말은 뺐다 (형 10-23: "북을 친다가 있는데 북을 울린다라고 하면 헷갈리잖아 · 설명이 쓸데없어")
    h += `<button class="btn pri" data-war="go">싸운다</button></div></div>`
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
    const fall = l.field !== true && atkWon
    if (fall) h += `<div class="wfx burn"${d}><img class="wfx-smoke" src="${art}fx/smoke.png" alt="">${burnHtml(art, 'l')}${burnHtml(art, 'r')}</div>`
    h += `<div class="wend ${good ? 'good' : l.outcome === 'draw' ? '' : 'bad'}"${d}><b>${big}${esc(res)}</b>`
    if (ctx !== null && (l.rounds ?? []).length > 0) h += `<p class="wwhy">${esc(endStory(l, ctx))}</p>`
    if (l.captured !== null) {
      const c = after.heroes[l.captured]
      h += c?.faction === me ? '<p>' + esc(josa(c.name, '이', '가')) + ' 사로잡혀 갔다.</p>' : '<p>' + esc(josa(c?.name ?? '?', '을', '를')) + ' 사로잡았다!</p>'
    }
    if (l.killed !== null) h += `<p>${esc(josa(after.heroes[l.killed]?.name ?? '?', '이', '가'))} 쓰러졌다.</p>`
    h += `<button class="btn pri wide" data-war="next">${left > 1 ? '다음 싸움으로' : '계절을 마무리한다'}</button></div>`
  }
  h += `</div>`
  return h
}

export const WAR_CSS = `
.ap .tn.hard { color: #f0a08a; }
.ap.war-open .tutband, .ap.war-open .tutbar { display: none; }
.ap .wr { position: fixed; inset: 0; z-index: 60; background: #0d0f13; overflow: hidden; }
/* 위아래로만 굴린다 — 옆으로 밀리던 것 (형 10-23: "전투 화면에서 불필요하게 x축 스크롤") */
.ap .wsc { position: absolute; inset: 0; z-index: 1; overflow-x: hidden; overflow-y: auto; overscroll-behavior: contain; touch-action: pan-y; -webkit-overflow-scrolling: touch; }
.ap .wsc .wrbox { overflow-wrap: anywhere; }
.ap .wfxl { position: absolute; inset: 0; z-index: 0; pointer-events: none; }
.ap .wfxt { position: absolute; inset: 0; z-index: 2; pointer-events: none; overflow: hidden; }
.ap .wwin { position: absolute; inset: 0; z-index: 4; pointer-events: none; }
/* 싸움터 — 화면 뒤에 붙박이. 받아 둔 싸움터 그림이 없으면(stand) 장면 그림을 더 어둡고 흐리게 */
.ap .wbg { position: absolute; inset: 0; z-index: 0; background: center / cover no-repeat; filter: brightness(.62) saturate(.9); }
.ap .wbg.stand { filter: brightness(.3) saturate(.7) blur(2px); transform: scale(1.04); }
.ap .wbg.g-snow { filter: brightness(.45) saturate(.6) hue-rotate(-8deg); } .ap .wbg.g-night { filter: brightness(.3) saturate(.7); }
.ap .wbg::after { content: ''; position: absolute; inset: 0; background: linear-gradient(#0d0f1340, #0d0f1300 30%, #0d0f1388 55%, #0d0f13dd 90%); }
.ap .wrbox { position: relative; z-index: 1; max-width: 600px; margin: 0 auto; padding: 0 14px 40px; }
/* 위 카드 — 굴려도 늘 보인다 (포켓몬의 HP 창) */
.ap .wtop { position: sticky; top: 0; z-index: 3; margin: 0 -14px; padding: calc(10px + env(safe-area-inset-top)) 14px 10px;
  background: linear-gradient(#0d0f1388, #0d0f1311 35%, #0d0f1344 70%, #0d0f13f2), var(--wtbg) center 55% / cover no-repeat;
  border-bottom: 1px solid #6a5236; border-radius: 0 0 16px 16px; box-shadow: 0 6px 18px #000a; }
.ap .wtop .ws b, .ap .wtop .ws > span, .ap .wtop .wn, .ap .wrh { text-shadow: 0 1px 3px #000, 0 0 8px #000c; }
.ap .wtop .wf { box-shadow: 0 4px 14px #000c; }
@media (max-width: 520px) { .ap .wtop .wf { width: 58px; height: 58px; } .ap .wtop .wrh { font-size: 16px; margin-bottom: 4px; } }
.ap .wrh { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; color: var(--gold); font-size: 19px; margin-bottom: 8px; }
.ap .wrh b { font-family: 'Gowun Batang', serif; letter-spacing: 1px; }
.ap .wvs { display: flex; align-items: flex-start; gap: 8px; }
.ap .wvs .vs { font-style: normal; font-weight: 800; color: #c8402a; font-size: 20px; align-self: center; }
.ap .ws { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; text-align: center; }
.ap .ws b { font-size: 15px; margin-top: 4px; } .ap .ws > span { font-size: 12px; color: var(--mute); }
.ap .ws .wnat { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; color: #e8dcc0; }
.ap .ws .wnat img { width: 20px; height: 20px; object-fit: contain; filter: drop-shadow(0 1px 2px #000); }
.ap .wf { width: 84px; height: 84px; border-radius: 14px; object-fit: cover; border: 2px solid #6a5a3a; background: #3a2c1e; }
.ap .wf.unit { object-fit: contain; padding: 6px; }
.ap .ws.foe .wf { border-color: #7a3a2a; }
.ap .wbar { width: 100%; height: 8px; border-radius: 4px; background: #30241a; overflow: hidden; margin-top: 6px; }
.ap .wbar i { display: block; height: 100%; }
.ap .wbar i.wgr { animation-duration: 1s; animation-timing-function: ease-out; animation-delay: 2.4s; animation-fill-mode: both; }
.ap .wn.swap { display: inline-grid; } .ap .wn.swap > * { grid-area: 1 / 1; text-decoration: none; }
.ap .wn.swap s { animation: wout .3s ease-out 2.4s both; } .ap .wn.swap u { animation: wrin .3s ease-out 2.4s both; }
@keyframes wout { to { opacity: 0; } }
.ap .wbar.men i { background: linear-gradient(90deg, #3f8f3a, #8fd07a); } .ap .ws.foe .wbar.men i { background: linear-gradient(90deg, #8a3a2a, #e08a74); }
.ap .wbar.mor { height: 5px; } .ap .wbar.mor i { background: #d9b36a; }
.ap .ws .wn { font-size: 12px; color: var(--ink); }
.ap .wintro { margin: 12px 0 6px; padding: 8px 10px; border-radius: 10px; background: #1e160fe6; font-size: 14.5px; }
.ap .wlog { display: flex; flex-direction: column; gap: 8px; margin: 8px 0; }
.ap .wrd { padding: 8px 10px; border-radius: 12px; background: #201a16e6; border: 1px solid #4d3b26; }
.ap .wrd.crit { border-color: #d9b36a; box-shadow: 0 0 0 1px #d9b36a55 inset; }
.ap .wrn { font-size: 12px; color: var(--mute); margin-bottom: 4px; }
.ap .wcmds { display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 700; }
.ap .wc { display: inline-flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 3px; padding: 3px 6px; border-radius: 12px; background: #2a1f16; flex: 1; min-width: 0; }
.ap .wc.foe { background: #2d1f1d; }
.ap .wfl { display: inline-flex; align-items: center; gap: 2px; font-size: 12.5px; white-space: nowrap; padding: 0 3px; }
.ap .wfl img { width: 22px; height: 22px; object-fit: contain; }
.ap .wcmds > i { font-style: normal; color: #c8402a; }
.ap .wst { margin: 6px 0 2px; }
.ap .wacts { display: flex; flex-direction: column; gap: 4px; margin: 2px 0 6px; }
.ap .wrelief { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 4px 0 6px; padding: 8px 10px; border-radius: 12px; font-size: 14px; animation: wrel .9s ease-out both; }
.ap .wrelief img { width: 34px; height: 34px; object-fit: contain; }
.ap .wrelief b { font-family: 'Gowun Batang', serif; font-size: 18px; }
.ap .wrelief.us { background: linear-gradient(90deg, #5a4318, #2c2416); border: 1px solid #e0bd78; color: #fff1cc; box-shadow: 0 0 18px #e0bd7855; }
.ap .wrelief.us b { color: #ffd27a; }
.ap .wrelief.foe { background: linear-gradient(90deg, #4a1c16, #241614); border: 1px solid #b0584a; color: #ffd0c4; }
@keyframes wrel { from { opacity: 0; transform: translateX(-24px); } to { opacity: 1; transform: none; } }
.ap .wact { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; padding: 4px 8px; border-radius: 9px; background: #ffffff08; border-left: 3px solid #6a6458; font-size: 13.5px; }
.ap .wact.us { border-left-color: #c9a45a; } .ap .wact.foe { border-left-color: #b0584a; }
.ap .wact img { width: 26px; height: 26px; object-fit: contain; }
.ap .wact .who { font-size: 11px; color: #a89c84; min-width: 24px; }
.ap .wact .arw { font-style: normal; color: #a89c84; }
.ap .wact .res { margin-left: auto; font-weight: 700; padding: 1px 7px; border-radius: 8px; background: #ffffff10; color: #d8cfbd; }
.ap .wact.good .res { background: #2f4a26; color: #b8e09a; } .ap .wact.bad .res { background: #4a2420; color: #ffb0a0; }
.ap .wact .loss { font-size: 12px; color: #e0a090; } .ap .wact .loss.own { color: #a89c84; }
.ap .wst.sm p { font-size: 12.5px; color: #a89c84; margin: 2px 0; }
.ap .wst p { margin: 3px 0; font-size: 14.5px; line-height: 1.5; }
.ap .wrd.crit .wst p:first-child { color: var(--gold); }
.ap .wpush { margin: 4px 0 0; text-align: center; font-size: 13px; color: var(--mute); }
.ap .wpush.good { color: var(--good); } .ap .wpush.bad { color: var(--bad); }
.ap .wfl.art { color: #ffd27a; text-shadow: 0 0 6px #ffd27a88; } .ap .wcmd.art { border-color: #c8a050; background: linear-gradient(#2a2418, #1d1a14); } .ap .wcmd em.art { background: #c8a050; color: #1b1408; }
/* 무리마다 잃은 사람 — 그림 칩 */
.ap .wloss { display: flex; justify-content: center; gap: 14px; flex-wrap: wrap; margin: 3px 0 0; font-size: 13px; }
.ap .wloss > span { display: inline-flex; align-items: center; gap: 5px; } .ap .wloss .us { color: #9fd18b; } .ap .wloss .foe { color: #e8a08a; }
.ap .wl { display: inline-flex; align-items: center; gap: 1px; font-weight: 700; } .ap .wl img { width: 22px; height: 22px; object-fit: contain; }
.ap .wrd.slow .wloss { opacity: 0; animation: wrin .45s ease-out var(--d, 0s) both; }
/* 맞은 쪽 — 흔들리고 번쩍 (우리 붉게 · 적 금빛) */
.ap .ws.hit { animation: wshake .5s ease-in-out var(--hd, 1.2s) both; position: relative; }
.ap .ws.hit.hithard { animation-name: wshakeh; }
.ap .ws.hit::after { content: ''; position: absolute; inset: -4px; border-radius: 14px; pointer-events: none; opacity: 0; animation: wflash .6s ease-out var(--hd, 1.2s) both; }
.ap .ws.us.hit::after { background: radial-gradient(circle, #ff4a3a66, #ff4a3a00 70%); } .ap .ws.foe.hit::after { background: radial-gradient(circle, #ffd27a66, #ffd27a00 70%); }
@keyframes wshake { 0%, 100% { transform: translateX(0); } 20% { transform: translateX(-5px); } 40% { transform: translateX(5px); } 60% { transform: translateX(-3px); } 80% { transform: translateX(2px); } }
@keyframes wshakeh { 0%, 100% { transform: translateX(0) rotate(0); } 15% { transform: translateX(-9px) rotate(-2deg); } 35% { transform: translateX(8px) rotate(2deg); } 55% { transform: translateX(-6px) rotate(-1deg); } 75% { transform: translateX(3px); } }
@keyframes wflash { 0% { opacity: 0; } 25% { opacity: 1; } 100% { opacity: 0; } }
/* 그림 효과 (realm/fx — 제미나이, 검은 바탕을 밝기로 알파) */
.ap .wfx { position: absolute; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; }
.ap .wfx-dust { position: absolute; bottom: -14%; width: 60vw; max-width: 640px; opacity: .3; animation: wdust 26s linear infinite; }
.ap .wfx-dust.a { left: -20%; } .ap .wfx-dust.b { left: 45%; animation-duration: 34s; animation-direction: reverse; opacity: .22; }
@keyframes wdust { 0% { transform: translateX(-6%) scale(1); } 50% { transform: translateX(6%) scale(1.08); } 100% { transform: translateX(-6%) scale(1); } }
/* 화살 — 앞으로는 고르게(바깥 i), 위아래는 오르다 떨어지게(안쪽 b), 머리는 오를 때 들리고 떨어질 때 숙인다. 적이 쏘면 통째로 뒤집는다 */
.ap .wfx-volley { position: absolute; inset: 0; } .ap .wfx-volley.l { transform: scaleX(-1); }
.ap .wfx-volley i { position: absolute; left: var(--x); top: var(--y); width: calc(var(--z) * 96px); height: calc(var(--z) * 13px); opacity: 0; animation: wvx .95s linear var(--t) both; }
.ap .wfx-volley b { position: absolute; inset: 0; background: center / 100% 100% no-repeat; animation: wvy .95s linear var(--t) both; }
.ap .wfx-volley b::before { content: ''; position: absolute; right: 92%; top: 38%; height: 24%; width: 110%; border-radius: 2px; background: linear-gradient(to left, #ffffff99, #fff0); }
@keyframes wvx { 0% { opacity: 0; transform: translateX(0); } 8% { opacity: 1; } 88% { opacity: 1; } 100% { opacity: 0; transform: translateX(var(--dx)); } }
@keyframes wvy { 0% { transform: translateY(0) rotate(-28deg); animation-timing-function: ease-out; } 50% { transform: translateY(calc(var(--up) * -1)) rotate(0deg); animation-timing-function: ease-in; } 100% { transform: translateY(0) rotate(30deg); } }
.ap .ws .wfx-hit { position: absolute; left: 50%; top: 42px; width: 150px; height: 150px; margin: -75px 0 0 -75px; z-index: 2; pointer-events: none; opacity: 0; animation: whitfx .55s ease-out var(--hd, 1.2s) both; }
@keyframes whitfx { 0% { opacity: 0; transform: scale(.3) rotate(0); } 25% { opacity: 1; transform: scale(1.05) rotate(12deg); } 100% { opacity: 0; transform: scale(1.35) rotate(24deg); } }
.ap .wend { position: relative; } .ap .wend > b { position: relative; }
.ap .wfx.burn { opacity: 0; animation: wrin 1.2s ease-out var(--d, 0s) both; }
/* 불 — 작은 불길 여럿이 바닥에서 솟아 스러진다 · 불티는 낱낱이 위로 · 밑에 붉은 숯불 기운 */
.ap .wburn { position: absolute; bottom: 1%; width: min(46vw, 430px); height: min(40vw, 360px); }
.ap .wburn.l { left: 1%; } .ap .wburn.r { right: 2%; width: min(36vw, 330px); height: min(32vw, 290px); }
.ap .wburn .bed { position: absolute; left: 5%; right: 5%; bottom: 0; height: 22%; border-radius: 50%; background: radial-gradient(ellipse at 50% 70%, #ffb04acc, #ff6a1a66 45%, #0000 75%);
  filter: blur(6px); animation: wbed 1.3s ease-in-out infinite alternate; }
.ap .wburn img { position: absolute; bottom: 0; left: calc(var(--x) * .8); width: calc(52% * var(--s)); transform-origin: 50% 100%; mix-blend-mode: screen; opacity: 0;
  animation: wtongue var(--d) ease-out var(--t) infinite; }
.ap .wburn b { position: absolute; bottom: 12%; left: var(--x); width: 4px; height: 4px; border-radius: 50%; background: #ffd27a; box-shadow: 0 0 6px 2px #ff9a3a; opacity: 0;
  animation: wember var(--d) linear var(--t) infinite; }
@keyframes wtongue { 0% { opacity: 0; transform: translateY(8%) scale(.5, .6); } 18% { opacity: .95; transform: translateY(0) scale(1, 1); }
  60% { opacity: .75; transform: translateY(-14%) scale(.85, 1.15); } 100% { opacity: 0; transform: translateY(-34%) scale(.35, .7); } }
@keyframes wember { 0% { opacity: 0; transform: translate(0, 0); } 12% { opacity: 1; } 100% { opacity: 0; transform: translate(var(--w), -220%) ; } }
@keyframes wbed { from { opacity: .7; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .ap .wburn img, .ap .wburn b { animation: none; opacity: .8; } }
.ap .wfx-smoke { position: absolute; bottom: 18%; left: 2%; width: min(42vw, 380px); opacity: .7; animation: wsmoke 9s ease-in-out infinite alternate; }
@keyframes wsmoke { from { transform: translateY(0) scale(1); } to { transform: translateY(-30px) scale(1.12); } }
/* 맡기기 — 그 장수의 얼굴과 지략 */
.ap .wauto { flex: 1 1 100%; display: flex; align-items: center; gap: 8px; font-size: 13px; color: #d8cfbf; }
.ap .wauto .wf { width: 30px; height: 30px; border-radius: 50%; } .ap .wauto .wdots { color: var(--gold); letter-spacing: 1px; }
.ap .wfoot .btn small { display: block; font-size: 11px; font-weight: 500; opacity: .85; }
/* 이겼다 — 크게 (형: "이기면 … 막 지랄 발광") */
.ap .wend.good { animation: wrin .5s ease-out var(--d, 0s) both, wwin 1.4s ease-out calc(var(--d, 0s) + .3s) both; }
.ap .wend.good b { display: inline-block; animation: wwinb .9s cubic-bezier(.2, 1.6, .4, 1) calc(var(--d, 0s) + .3s) both; }
@keyframes wwin { 0% { box-shadow: 0 0 0 0 #ffd27a00; } 30% { box-shadow: 0 0 0 6px #ffd27aaa, 0 0 40px 10px #ffd27a88; } 100% { box-shadow: 0 0 0 0 #ffd27a00, 0 0 18px 2px #ffd27a33; } }
@keyframes wwinb { 0% { transform: scale(.4); } 60% { transform: scale(1.25); } 100% { transform: scale(1); } }
@media (prefers-reduced-motion: reduce) { .ap .ws.hit, .ap .ws.hit::after, .ap .wend.good, .ap .wend.good b, .ap .wfx-dust, .ap .wfx-smoke { animation: none; } .ap .wfx-volley, .ap .ws .wfx-hit { display: none; } }
.ap .wrd.slow .wcmds, .ap .wrd.slow .wst, .ap .wrd.slow .wpush { opacity: 0; animation: wrin .45s ease-out var(--d, 0s) both; }
.ap .wrd.slow .wcmds { animation-name: wrflip; }
@keyframes wrin { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes wrflip { from { opacity: 0; transform: rotateX(90deg); } to { opacity: 1; transform: none; } }
.ap .wnext { margin-top: 12px; padding: 10px; border-radius: 14px; background: #1f1710; border: 1px solid #4a4030; animation: wrin .4s ease-out both; }
.ap .wr.slow .wnext { animation-delay: 3.1s; }
.ap .whint { margin: 2px 0 6px; font-size: 14px; } .ap .whint b { color: var(--gold); margin-right: 4px; }
.ap .whint.warn b { color: #ff9a70; }
.ap .wfoe { margin: 0 0 8px; font-size: 13px; color: #e0b0a0; }
.ap .wgrp { margin: 8px 0; }
.ap .wgh { font-size: 13.5px; margin-bottom: 4px; } .ap .wgh b { color: var(--gold); margin-right: 4px; }
.ap .wcmdgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 6px; }
.ap .wcmd { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 7px 9px; border-radius: 12px; border: 1px solid #6a5236;
  background: #2a1f16; color: var(--ink); font: inherit; text-align: left; cursor: pointer; position: relative; }
.ap .wcmd.on { border-color: var(--gold); background: #3a3222; box-shadow: 0 0 0 2px #d9b36a66; }
.ap .wcmd img { width: 30px; height: 30px; object-fit: contain; position: absolute; right: 8px; top: 7px; opacity: .9; }
.ap .wcmd b { font-size: 15.5px; } .ap .wcmd small { font-size: 11.5px; color: var(--mute); line-height: 1.35; padding-right: 2px; }
.ap .wcmd em { font-style: normal; font-size: 11px; color: #14161a; background: var(--gold); border-radius: 6px; padding: 0 5px; }
.ap .wcmd em.land { background: #7fb07a; }
.ap .wcmd .wcap { font-size: 12px; color: var(--ink); }
.ap .wcmd.capture { border-color: #8a6a2a; } .ap .wcmd.retreat { background: #221d1a; }
.ap .wf-hi { color: var(--good); font-weight: 700; font-size: 13px; } .ap .wf-mid { color: var(--gold); font-size: 13px; }
.ap .wf-lo { color: var(--bad); font-size: 13px; } .ap .wf-no { color: #8b8478; font-size: 13px; }
.ap .wfoot { display: flex; gap: 8px; justify-content: flex-end; align-items: center; margin-top: 10px; flex-wrap: wrap; }
.ap .wfoot .btn.pri { font-size: 16px; padding: 8px 18px; }
.ap .wend { margin-top: 14px; padding: 12px; border-radius: 14px; text-align: center; background: #1f1710; animation: wrin .5s ease-out var(--d, 0s) both; }
.ap .wend b { font-size: 21px; } .ap .wend.good b { color: var(--good); } .ap .wend.bad b { color: var(--bad); }
.ap .wend .wwhy { font-size: 14.5px; color: #e8dcc0; }
.ap .wr.fast .wrd.slow .wcmds, .ap .wr.fast .wrd.slow .wst, .ap .wr.fast .wrd.slow .wpush, .ap .wr.fast .wend, .ap .wr.fast .wnext { animation-delay: 0s !important; animation-duration: .01s !important; }
.ap .wr.fast .wbar i.wgr, .ap .wr.fast .wn.swap > * { animation-delay: 0s !important; animation-duration: .01s !important; }
/* 싸움이 열린다 — 판 전체: 싸움터 그림이 다가오고, 양쪽 깃발·장수가 밀려들고, 이름이 쾅 (형 10-23: "전투가 발생했다는 게 확 실감이 안 나는데")
   히어로즈·토탈워의 싸움 앞 화면처럼 — 누가 누구와 어디서, 세기는 막대로 */
.ap .wopen { position: fixed; inset: 0; z-index: 70; overflow: hidden; background: #000; cursor: pointer; animation: woout 3.4s ease-in forwards; }
@keyframes woout { 0%, 86% { opacity: 1; } 100% { opacity: 0; visibility: hidden; } }
.ap .wopen .wob { position: absolute; inset: -4%; background: center / cover no-repeat; filter: brightness(.75) saturate(1.05); animation: wozoom 3.4s ease-out both; }
@keyframes wozoom { from { transform: scale(1.18); filter: brightness(.2); } 25% { filter: brightness(.8); } to { transform: scale(1); } }
.ap .wopen::before { content: ''; position: absolute; inset: 0; z-index: 1; background: radial-gradient(ellipse at 50% 50%, #0000 30%, #000c 100%); }
.ap .wopen .wofl { position: absolute; inset: 0; z-index: 2; background: radial-gradient(circle, #ff6a3a88, #b0281a55 40%, #0000 75%); opacity: 0; animation: woflash .7s ease-out .9s both; }
@keyframes woflash { 0% { opacity: 0; } 15% { opacity: 1; } 100% { opacity: 0; } }
.ap .wopen .woin { position: absolute; inset: 0; z-index: 3; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 8px; padding: 0 4vw; animation: woshake .5s ease-out .9s both; }
@keyframes woshake { 0%, 100% { transform: none; } 20% { transform: translate(-8px, 3px); } 40% { transform: translate(7px, -4px); } 60% { transform: translate(-4px, 2px); } 80% { transform: translate(2px, -1px); } }
.ap .wosd { display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; min-width: 0; }
.ap .wosd.us { animation: woinl .55s cubic-bezier(.2, 1.3, .4, 1) .25s both; } .ap .wosd.foe { animation: woinr .55s cubic-bezier(.2, 1.3, .4, 1) .45s both; }
@keyframes woinl { from { opacity: 0; transform: translateX(-60vw); } to { opacity: 1; transform: none; } }
@keyframes woinr { from { opacity: 0; transform: translateX(60vw); } to { opacity: 1; transform: none; } }
.ap .wosd .woe { width: clamp(40px, 11vw, 64px); aspect-ratio: 1; object-fit: contain; filter: drop-shadow(0 2px 6px #000); }
.ap .wosd .wf { width: clamp(84px, 26vw, 150px); height: auto; aspect-ratio: 1; border-radius: 18px; border: 3px solid var(--c, #9fd18b); box-shadow: 0 0 0 2px #000a, 0 10px 30px #000d, 0 0 24px var(--c, #9fd18b); }
.ap .wosd b { font-family: var(--display); font-weight: 400; font-size: clamp(16px, 4.4vw, 24px); color: #fff; text-shadow: 0 2px 6px #000; }
.ap .wosd span { font-size: 13px; color: #f0e4cc; text-shadow: 0 1px 4px #000; }
.ap .wom { display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; }
.ap .wom .wox { font-style: normal; font-size: clamp(34px, 10vw, 60px); color: #ffcf8a; text-shadow: 0 0 18px #ff6a3a, 0 2px 4px #000; animation: wostamp .5s cubic-bezier(.2, 1.6, .4, 1) .8s both; }
@keyframes wostamp { from { opacity: 0; transform: scale(3.2) rotate(-12deg); } to { opacity: 1; transform: none; } }
.ap .wohead { position: absolute; z-index: 3; left: 0; right: 0; top: 14%; text-align: center; padding: 0 16px; animation: wrin .5s ease-out .95s both; }
.ap .wohead b { display: block; font-family: var(--display); font-weight: 400; font-size: clamp(30px, 8.5vw, 52px); color: #f6d8a0; letter-spacing: 3px; text-shadow: 0 0 14px #000, 0 3px 6px #000; }
.ap .wohead span { display: block; margin-top: 4px; font-size: clamp(15px, 4vw, 19px); color: #fff; text-shadow: 0 1px 5px #000; }
.ap .wofoot { position: absolute; z-index: 3; left: 50%; bottom: 14%; width: min(80vw, 460px); transform: translateX(-50%); text-align: center; animation: wrin .5s ease-out 1.15s both; }
.ap .wobar { display: flex; height: 12px; border-radius: 6px; overflow: hidden; box-shadow: 0 0 0 2px #000a, 0 4px 14px #000c; }
.ap .wobar i { display: block; height: 100%; } .ap .wobar i.us { background: linear-gradient(90deg, #3f8f3a, #8fd07a); } .ap .wobar i.foe { background: linear-gradient(90deg, #e08a74, #8a3a2a); }
.ap .wofoot em { display: inline-block; margin-top: 10px; font-style: normal; font-size: 13.5px; color: #ffd6c8; background: #5a1a10cc; border: 1px solid #c8402a; border-radius: 999px; padding: 3px 12px; }
.ap .wofoot small { display: block; margin-top: 8px; font-size: 11.5px; color: #e0d0c0aa; }
@media (prefers-reduced-motion: reduce) { .ap .wopen, .ap .wopen * { animation-duration: .01s !important; animation-delay: 0s !important; } .ap .wopen { animation: woout 2.2s steps(1) forwards !important; } }
/* 싸움이 열린다 — 계절 띠처럼 가운데 이름 (북 · 종) */
.ap .warfx { position: fixed; inset: 0; z-index: 70; display: flex; align-items: center; justify-content: center; pointer-events: none;
  background: radial-gradient(circle, #000b 0, #0000 72%); animation: sfx 2.4s ease-out forwards; }
.ap .warfx > div { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 18px 36px; border-radius: 18px; background: #1a1210ee;
  border: 1px solid #a0502a; box-shadow: 0 8px 40px #000c; animation: sfxin 1.6s cubic-bezier(.2, 1.4, .4, 1) forwards; }
.ap .warfx b { font-family: var(--display); font-weight: 400; font-size: 32px; color: #f0c080; letter-spacing: 2px; }
.ap .warfx span { font-size: 13.5px; color: #e0d0c0; }
@media (prefers-reduced-motion: reduce) { .ap .wr *, .ap .warfx, .ap .warfx * { animation-duration: .01s !important; animation-delay: 0s !important; transition: none !important; } }
`

/** 싸움이 열리는 판 — 싸움터 그림 · 양쪽 깃발과 장수 · 이름 · 누가 쳐들어왔나 · 세기 막대 · 어느 나라와 싸우는 중인가 */
function openHtml(prev: Realm, after: Realm, l: BattleLine, me: string, art: string, us: number, them: number): string {
  const weAtk = l.atkFaction === me
  const atkF = l.atkFaction ?? prev.armies[l.attacker]?.faction
  const ourF = weAtk ? atkF : l.defender
  const foeF = weAtk ? l.defender : atkF
  const fname = (f: string | undefined): string => (f !== undefined ? (after.factions[f]?.name ?? '?') : '?')
  const st = l.start
  const ourHero = st?.heroes[weAtk ? 0 : 1] ?? null
  const foeHero = st?.heroes[weAtk ? 1 : 0] ?? null
  const hname = (id: string | null, f: string | undefined): string => (id !== null ? (prev.heroes[id]?.name ?? after.heroes[id]?.name ?? '?') : `${fname(f)} 군`)
  const color = (f: string | undefined): string => (f !== undefined ? (FACTION_ART[f]?.color ?? '#ccc') : '#ccc')
  const emb = (f: string | undefined): string => {
    const e = f !== undefined ? FACTION_ART[f]?.emblem : undefined
    return e !== undefined ? `<img class="woe" src="${art}icon/${e}.png" alt="">` : ''
  }
  const place = after.nodes[l.node]?.name ?? prev.nodes[l.node]?.name ?? ''
  const foe = fname(foeF)
  const sub = l.field === true ? `길에서 ${josa(foe, '과', '와')} 맞닥뜨렸다`
    : weAtk ? `${josa(place, '을', '를')} 친다`
    : `${josa(foe, '이', '가')} ${josa(place, '으로', '로')} 쳐들어왔다!`
  const ground = warGround(prev, l)
  const side = (cls: string, f: string | undefined, hero: string | null, n: number, fallback: string): string =>
    `<div class="wosd ${cls}" style="--c:${color(f)}">${emb(f)}${face(hero, art, fallback)}<b>${esc(hname(hero, f))}</b><span>${esc(fname(f))} · ${n.toLocaleString('ko-KR')}명</span></div>`
  const share = Math.round((us / Math.max(1, us + them)) * 100)
  return `<div class="wob" style="background-image:url('${warBg(art, ground)}')"></div><div class="wofl"></div>`
    + `<div class="wohead"><b>${esc(warName(after, l))}</b><span>${esc(sub)}</span></div>`
    + `<div class="woin">${side('us', ourF, ourHero, us, UNIT_ICON.spear)}<div class="wom"><i class="wox">⚔</i></div>${side('foe', foeF, foeHero, them, UNIT_ICON.shield)}</div>`
    + `<div class="wofoot"><div class="wobar"><i class="us" style="width:${share}%"></i><i class="foe" style="width:${100 - share}%"></i></div>`
    + `<em>⚔ ${esc(josa(foe, '과', '와'))} 싸우는 중</em><small>누르면 넘어간다</small></div>`
}

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
  // 배경·효과는 붙박이 층에, 글은 그 위 굴리는 층에 — 굴려도 배경이 안 움직이고, 깃발을 골라도 배경을 다시 깔지 않는다
  // (형 10-23: "전투 스크롤할 때 뒷배경이 자꾸 움직임 · 전투할 때 뭔가 선택하면 깜빡임")
  const ov = document.createElement('div')
  ov.className = 'wr'
  ov.innerHTML = '<div class="wbg"></div><div class="wfxl"></div><div class="wsc"></div><div class="wfxt"></div><div class="wwin"></div>'
  const bgEl = ov.querySelector<HTMLElement>('.wbg')!
  const fxEl = ov.querySelector<HTMLElement>('.wfxl')!
  const fxTop = ov.querySelector<HTMLElement>('.wfxt')!
  const sc = ov.querySelector<HTMLElement>('.wsc')!
  const winEl = ov.querySelector<HTMLElement>('.wwin')!
  root.appendChild(ov)
  // 싸우는 동안 배우기 띠는 숨긴다 (형: "싸우는도중에 하단에 배우기 창 계속 떠있어서 짜증나")
  root.classList.add('war-open')
  const timers: number[] = []
  const clearTimers = (): void => { for (const x of timers.splice(0)) clearTimeout(x) }
  const at = (s: number, name: string, vol: number): void => {
    timers.push(window.setTimeout(() => { if (document.visibilityState === 'visible') host.ding(name, vol) }, s * 1000))
  }

  /** 폰 떨림 — 잘됐을 때만 (좋은 합 · 사로잡기 · 이김). 진 쪽 떨림은 헷갈려서 안 쓴다 (형: "공격하거나 잘됐을때로 긍정 피드백 시켜야 하나? 헷갈리니까??") */
  const buzz = (s: number, pattern: number[]): void => {
    if (typeof navigator.vibrate !== 'function') return
    timers.push(window.setTimeout(() => { if (document.visibilityState === 'visible') navigator.vibrate(pattern) }, s * 1000))
  }
  // 소리 — 깃발 → 맞부딪힘(필살이면 크게) → 마지막 일격 · 이김/짐. 탭이 보일 때만
  const sound = (rd: RoundLog | undefined, weAtk: boolean, end: BattleLine | null): void => {
    clearTimers()
    if (document.visibilityState !== 'visible') return
    if (rd !== undefined) {
      const ourSide = weAtk ? 'a' : 'd'
      const wePushed = weAtk ? rd.push > 0.55 : rd.push < 0.45
      if (rd.ev === 'capture-ok' && rd.by === ourSide) buzz(STAGE_S[1], [30, 50, 30, 50, 70])
      else if (rd.beat === ourSide) buzz(STAGE_S[1], [25, 40, 25])
      else if (wePushed) buzz(STAGE_S[1], [15])
      at(STAGE_S[0], BATTLE_SFX[weAtk ? rd.a : rd.d], 0.45)
      // 우리가 달려드는 합엔 함성
      const ours = weAtk ? rd.a : rd.d
      if (ours === 'charge' || ours === 'pursue' || ours === 'flank') at(STAGE_S[0] + 0.15, BATTLE_SFX.cry, 0.26)
      if (rd.ev === 'capture-ok') at(STAGE_S[1], rd.by === ourSide ? BATTLE_SFX.caught : BATTLE_SFX.lose, 0.5)
      else if (rd.ev === 'duel-win' || rd.ev === 'duel-lose') at(STAGE_S[1], BATTLE_SFX.duelWin, 0.45)
      else at(STAGE_S[1], rd.beat !== null ? BATTLE_SFX.crit : BATTLE_SFX.clash, rd.beat !== null ? 0.6 : 0.4)
    }
    if (end !== null) {
      const atkWon = end.outcome === 'rout' || end.outcome === 'win'
      const good = (end.atkFaction === host.me) === atkWon && end.outcome !== 'draw'
      if (end.outcome === 'rout' || end.outcome === 'routed') at(STAGE_S[2] + 0.4, BATTLE_SFX.final, 0.5)
      at(STAGE_S[2] + 1, good ? BATTLE_SFX.win : BATTLE_SFX.lose, 0.45)
      if (end.outcome !== 'draw') timers.push(window.setTimeout(() => host.music?.(good ? 'win' : 'lose'), (STAGE_S[2] + 1) * 1000))
      // 이겼다 — 부우웅 크게 (듀오링고처럼)
      if (good) buzz(STAGE_S[2] + 1, end.outcome === 'rout' ? [60, 40, 60, 40, 60, 40, 120, 60, 300] : [...WIN_BUZZ])
    }
  }

  /** 싸움이 열린다 — 이름 띠 · 북 두 번 · 종 (계절 띠와 같은 길: 애니메이션이 끝나면 지운다) */
  const band = (l: BattleLine): void => {
    if (named === l.key) return
    named = l.key
    host.music?.('war')
    const weAtk = l.atkFaction === host.me
    const st = l.start
    const us = st !== undefined ? st.men[weAtk ? 0 : 1] : 0
    const them = st !== undefined ? st.men[weAtk ? 1 : 0] : 0
    const el = document.createElement('div')
    el.className = 'wopen'
    el.innerHTML = openHtml(prev, t.after, l, host.me, host.art, us, them)
    el.addEventListener('animationend', (e) => { if (e.target === el) el.remove() })
    el.addEventListener('click', (e) => { e.stopPropagation(); el.remove() })
    root.appendChild(el)
    if (document.visibilityState === 'visible') {
      at(0, BATTLE_SFX.openDrum, 0.5)
      at(0.38, BATTLE_SFX.openDrum, 0.5)
      at(0.9, BATTLE_SFX.openBell, 0.45)
      at(0.95, BATTLE_SFX.cry, 0.4)
      buzz(0.9, [40, 30, 90])
    }
  }

  const paintNow = (anim: boolean): void => {
    const l = t.line!
    const shown = l.pending !== undefined ? l.pending.round : (l.rounds ?? []).length
    const tpl = document.createElement('template')
    tpl.innerHTML = warHtml(prev, t.after, l, host.me, host.art, shown, anim, left, sel)
    const bg = tpl.content.querySelector<HTMLElement>('.wbg')
    if (bg !== null) {
      if (bgEl.className !== bg.className) bgEl.className = bg.className
      if (bgEl.style.backgroundImage !== bg.style.backgroundImage) bgEl.style.backgroundImage = bg.style.backgroundImage
      bg.remove()
    }
    // 화살은 글판 위로 날아간다 — 흙먼지만 뒤에 (형 10-23: "배경이 막 화살 날아다니는 거 같은데 보드판 뒤로 밀려서 안 보임")
    fxTop.replaceChildren(...tpl.content.querySelectorAll('.wfx-volley'))
    fxEl.replaceChildren(...tpl.content.querySelectorAll('.wfx'))
    sc.replaceChildren(tpl.content)
    // 싸움이 끝났다 — 이겼으면 「승리」가 쾅, 졌으면 「패배」가 내려앉는다 (형: "승리했다는 이펙트가 더 확실히")
    winEl.replaceChildren()
    if (anim && l.pending === undefined && l.outcome !== 'draw') {
      const atkWon = l.outcome === 'rout' || l.outcome === 'win'
      const good = (l.atkFaction === host.me) === atkWon
      const word = good ? (l.outcome === 'rout' || l.outcome === 'routed' ? '대승' : '승리') : (l.outcome === 'rout' || l.outcome === 'routed' ? '대패' : '패배')
      winEl.innerHTML = winFxHtml(word, '', STAGE_S[2] + 0.9, !good, true)
    }
  }

  const draw = (anim: boolean): void => {
    const l = t.line!
    const shown = l.pending !== undefined ? l.pending.round : (l.rounds ?? []).length
    ov.classList.toggle('slow', anim)
    ov.classList.remove('fast')
    paintNow(anim)
    sound(anim ? (l.rounds ?? [])[shown - 1] : undefined, l.atkFaction === host.me, anim && l.pending === undefined ? l : null)
    if (!anim) band(l)
    if (anim) sc.querySelector('.wrd.slow')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    else sc.scrollTop = 0
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
        // 다시 그리지 않고 고른 표만 옮긴다 — 다시 그리면 배경·그림이 깜빡였다
        for (const x of sc.querySelectorAll<HTMLElement>(`[data-war="pick"][data-g="${g}"]`)) x.classList.toggle('on', sel[g] === x.dataset['c'])
        b.closest('.wgrp')?.querySelector<HTMLElement>('.wgh .mute')?.toggleAttribute('hidden', sel[g] !== undefined)
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
