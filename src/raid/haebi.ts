import { HAEBI_RUN as C, HAEBI_VANGUARD as V, HAEBI_STAGES as ST, HAEBI_MOBS as M, HAEBI_SHOP as SH, HAEBI_GOLD as G } from '../tune/params.ts'
import { makeRng } from '../core/rng.ts'

/**
 * 장수 열전 — 다이센카식 20분 판 (11-16 형: 「스테이지·판 밖 상점·휘장 · 무기 10단계 · 적 단계업」).
 * 무기 묶음(Kit) = 주 무기 + 그 무기 전용 보조 공격 + 공용 부적·번개 + 보조 능력 셋 + 조합 둘(묶음 전용) + 뇌화 연옥(공용).
 * 판(mode): stage = 독립 열전(스테이지 · 상점 강화 bonus) · trial = 본편 각성 시련(짧고 쉬움) · vanguard = 본편 선봉.
 */
export type Kit = 'axe' | 'bow' | 'spear' | 'sword' | 'dagger' | 'magic'
export type Power = 'axe' | 'gale' | 'ember' | 'thunder' | 'echo' | 'tempo' | 'reach' | 'bow' | 'rain' | 'spear' | 'javelin' | 'sword' | 'wave' | 'dagger' | 'knife' | 'bell' | 'soul'
export const POWERS: Record<Power, { name: string; icon: string; max: number; color: string; desc: string }> = {
  axe: { name: '파쇄 도끼', icon: '斧', max: 10, color: '#f5c578', desc: '직접 휘두르는 도끼의 위력과 범위 증가' },
  gale: { name: '질풍 도끼', icon: '風', max: 10, color: '#96e9cf', desc: '회전하는 도끼 투사체가 적을 관통' },
  ember: { name: '홍련 부적', icon: '火', max: 10, color: '#ff936b', desc: '날아간 부적이 폭발하여 무리를 불태움' },
  thunder: { name: '벽력', icon: '雷', max: 10, color: '#b4c8ff', desc: '번개가 주변 적 사이를 연쇄 타격' },
  echo: { name: '메아리', icon: '響', max: 4, color: '#c4b5fa', desc: '보조 공격·부적 발사 수와 번개 전이 수 증가' },
  tempo: { name: '몰아치는 기세', icon: '迅', max: 5, color: '#efd887', desc: '모든 자동 공격의 발동 속도 증가' },
  reach: { name: '큰 물결', icon: '波', max: 5, color: '#7dcedd', desc: '공격·폭발·번개 전이 범위 증가' },
  bow: { name: '속사', icon: '弓', max: 10, color: '#f2d48a', desc: '가장 가까운 적에게 꿰뚫는 화살을 연달아 쏨' },
  rain: { name: '화살비', icon: '雨', max: 10, color: '#cfe3ff', desc: '무리 위로 화살비가 늦게 쏟아져 범위 피해' },
  spear: { name: '꿰뚫는 창', icon: '槍', max: 10, color: '#f0c98a', desc: '길고 좁게 찔러 한 줄의 적을 모두 꿰뚫음' },
  javelin: { name: '투창', icon: '投', max: 10, color: '#a8e0c6', desc: '멀리 날아가며 여러 적을 꿰뚫는 창을 던짐' },
  sword: { name: '환두대도', icon: '刀', max: 10, color: '#f6d9a0', desc: '빠르고 넓게 앞을 베는 칼질의 위력과 범위 증가' },
  wave: { name: '검기', icon: '氣', max: 10, color: '#a7d8ff', desc: '모든 적을 꿰뚫고 날아가는 칼바람을 날림' },
  dagger: { name: '쌍단검', icon: '匕', max: 10, color: '#e9d6a8', desc: '바로 앞의 적을 아주 빠르게 연달아 찌름' },
  knife: { name: '비도', icon: '飛', max: 10, color: '#d8e4f0', desc: '작은 칼을 부채꼴로 던져 앞을 꿰뚫음' },
  bell: { name: '방울 파동', icon: '鈴', max: 10, color: '#f3dc8a', desc: '방울 소리가 둘레로 퍼지며 모든 적을 침' },
  soul: { name: '혼불', icon: '魂', max: 10, color: '#9fd8ff', desc: '적을 쫓아가 터지는 푸른 혼불을 띄움' },
}
export const KITS: Record<Kit, { primary: Power; secondary: Power; title: string; weapon: string; skill: string }> = {
  axe: { primary: 'axe', secondary: 'gale', title: '폭풍을 가르는 도끼', weapon: '도끼', skill: '천지 가르기' },
  bow: { primary: 'bow', secondary: 'rain', title: '하늘을 덮는 화살', weapon: '활', skill: '하늘 꿰뚫기' },
  spear: { primary: 'spear', secondary: 'javelin', title: '대열을 꿰는 창', weapon: '창', skill: '용오름 창' },
  sword: { primary: 'sword', secondary: 'wave', title: '바람을 가르는 칼', weapon: '칼', skill: '번개 베기' },
  dagger: { primary: 'dagger', secondary: 'knife', title: '그림자를 걷는 단검', weapon: '단검', skill: '그림자 베기' },
  magic: { primary: 'bell', secondary: 'soul', title: '혼을 부르는 방울', weapon: '방울', skill: '하늘 굿' },
}
const SHARED: readonly Power[] = ['ember', 'thunder', 'echo', 'tempo', 'reach']
/** 그 묶음에서 고를 수 있는 능력 — POWERS 순서 그대로 (도끼 묶음은 예전 일곱과 같은 순서) */
export const kitPowers = (kit: Kit): Power[] => (Object.keys(POWERS) as Power[]).filter(k => k === KITS[kit].primary || k === KITS[kit].secondary || SHARED.includes(k))
export const attackPowers = (kit: Kit): Power[] => [KITS[kit].primary, KITS[kit].secondary, 'ember', 'thunder']
export const COMBOS = [
  { id: 'cyclone', kit: 'axe', name: '도끼 폭풍', needs: { axe: 4, gale: 3 }, desc: '거대한 도끼들이 주위를 돌며 적을 갈아버립니다.' },
  { id: 'inferno', kit: null, name: '뇌화 연옥', needs: { ember: 3, thunder: 3 }, desc: '번개가 떨어진 자리마다 불꽃 폭발이 일어납니다.' },
  { id: 'torrent', kit: 'axe', name: '천 갈래 바람', needs: { gale: 3, echo: 2 }, desc: '질풍 도끼가 적을 맞힐 때 작은 칼날로 갈라집니다.' },
  { id: 'volley', kit: 'bow', name: '만 갈래 화살', needs: { bow: 4, rain: 3 }, desc: '사방으로 화살 고리가 쉴 새 없이 퍼져 나갑니다.' },
  { id: 'meteor', kit: 'bow', name: '유성 화살비', needs: { rain: 3, echo: 2 }, desc: '화살비가 떨어진 자리에서 화살 조각이 튀어 나갑니다.' },
  { id: 'grove', kit: 'spear', name: '창의 숲', needs: { spear: 4, javelin: 3 }, desc: '주위 땅에서 창날이 돌아가며 솟구칩니다.' },
  { id: 'boomerang', kit: 'spear', name: '돌아오는 창', needs: { javelin: 3, echo: 2 }, desc: '던진 창이 되돌아오며 한 번 더 꿰뚫습니다.' },
  { id: 'tempest', kit: 'sword', name: '칼바람', needs: { sword: 4, wave: 3 }, desc: '온몸을 휘감는 칼바람이 주위를 연달아 벱니다.' },
  { id: 'splitwave', kit: 'sword', name: '갈라지는 검기', needs: { wave: 3, echo: 2 }, desc: '검기가 끝에서 두 갈래로 갈라져 더 날아갑니다.' },
  { id: 'shadowdance', kit: 'dagger', name: '그림자 춤', needs: { dagger: 4, knife: 3 }, desc: '그림자가 둘레의 적 셋을 쉴 새 없이 벱니다.' },
  { id: 'venom', kit: 'dagger', name: '독 비수', needs: { knife: 3, echo: 2 }, desc: '비도에 맞은 적이 독으로 계속 깎입니다.' },
  { id: 'rite', kit: 'magic', name: '만신 굿', needs: { bell: 4, soul: 3 }, desc: '큰 굿판이 열려 둘레의 적을 한꺼번에 날립니다.' },
  { id: 'soulstorm', kit: 'magic', name: '혼불 회오리', needs: { soul: 3, echo: 2 }, desc: '혼불이 몸 둘레를 돌며 닿는 적을 태웁니다.' },
] as const
export type Combo = typeof COMBOS[number]['id']
export const kitCombos = (kit: Kit) => COMBOS.filter(c => c.kit === null || c.kit === kit)
export type MobKind = 'club' | 'archer' | 'runner' | 'slinger' | 'shield' | 'dog' | 'berserker' | 'firearcher' | 'iron' | 'shaman' | 'tiger' | 'bear' | 'hunter' | 'torch' | 'elite' | 'boss'
export type StageId = keyof typeof ST
/** 판 밖 상점에서 산 단계 (HAEBI_SHOP 의 열둘) */
export type Bonus = Record<Exclude<keyof typeof SH, 'growth'>, number>
export const NO_BONUS: Bonus = { might: 0, vigor: 0, armor: 0, regen: 0, haste: 0, swift: 0, magnet: 0, wisdom: 0, revive: 0, reroll: 0, greed: 0, luck: 0 }
/** act: 창돌격꾼·범 예고(+)·돌진(−) 시간 · 투창 사냥꾼 겨눔(+) · 방화꾼 다음 불바닥까지 · vx·vy: 돌진·던질 방향 · buff: 무당이 북돋운 남은 시간 */
export interface Mob { id: number; x: number; y: number; hp: number; max: number; kind: MobKind; cd: number; flash: number; wind: number; aimX: number; aimY: number; act: number; vx: number; vy: number; buff: number; poison: number; pdps: number }
export interface Missile { x: number; y: number; vx: number; vy: number; life: number; kind: 'gale' | 'ember' | 'shard' | 'enemy' | 'arrow' | 'rain' | 'javelin' | 'wave' | 'barrage' | 'stone' | 'flame' | 'knife' | 'soul' | 'hurl'; damage: number; radius: number; hit: number[]; angle: number; tx: number; ty: number; gen?: number }
export interface Effect { x: number; y: number; x2: number; y2: number; r: number; angle: number; life: number; total: number; kind: 'hit' | 'slash' | 'blast' | 'bolt' | 'skill' | 'death' | 'spike' | 'thrust' | 'buff' | 'ring'; color: string; mob?: Mob['kind']; face?: number; n?: number; crit?: boolean }
export interface Drop { x: number; y: number; value: number; age: number }
type Cool = 'axe' | 'gale' | 'ember' | 'thunder' | 'orbit' | 'bow' | 'rain' | 'volley' | 'spear' | 'javelin' | 'grove' | 'sword' | 'wave' | 'tempest' | 'dagger' | 'knife' | 'shadow' | 'bell' | 'soul' | 'rite' | 'storm'
export interface HaebiRun {
  mode: 'stage' | 'trial' | 'vanguard'; stage: StageId; bonus: Bonus; maxHp: number; revives: number; elites: number; kit: Kit; breaches: number; captains: number;
  seed: number; t: number; x: number; y: number; hp: number; face: number; moving: boolean;
  attack: number; hurt: number; inv: number; dash: number; dashCd: number; skillCd: number;
  cool: Record<Cool, number>;
  ranks: Record<Power, number>; combos: Combo[]; xp: number; level: number; offers: Power[]; rerolls: number;
  enemies: Mob[]; shots: Missile[]; fx: Effect[]; drops: Drop[];
  spawn: number; nextElite: number; nextBarrage: number; boss: boolean; next: number; kills: number; damage: number;
  state: 'playing' | 'won' | 'lost'; message: string; messageTime: number; comboKills: number; streakTime: number;
}
export interface RunInput { x: number; y: number; dash?: boolean; skill?: boolean }
export function random(s: HaebiRun) { const rng = makeRng(s.seed); const n = rng.next(); s.seed = rng.state(); return n }
export function createHaebi(seed = 7, mode: HaebiRun['mode'] = 'stage', kit: Kit = 'axe', opts: { stage?: StageId; bonus?: Partial<Bonus> } = {}): HaebiRun {
  const bonus = { ...NO_BONUS, ...opts.bonus }, maxHp = C.health + bonus.vigor * SH.vigor.step, stage: StageId = mode === 'trial' ? 'trial' : opts.stage ?? 'forest'
  const k = KITS[kit]
  const ranks = Object.fromEntries((Object.keys(POWERS) as Power[]).map(p => [p, 0])) as Record<Power, number>
  ranks[k.primary] = 1
  const s: HaebiRun = { mode, stage, bonus, maxHp, revives: bonus.revive, elites: 0, kit, breaches: 0, captains: 0, seed, t: 0, x: C.width / 2, y: C.height / 2, hp: maxHp, face: 1, moving: false,
    attack: 0, hurt: 0, inv: 0, dash: 0, dashCd: 0, skillCd: 0,
    cool: { axe: 0, gale: 0, ember: 0, thunder: 0, orbit: 0, bow: 0, rain: 0, volley: 0, spear: 0, javelin: 0, grove: 0, sword: 0, wave: 0, tempest: 0, dagger: 0, knife: 0, shadow: 0, bell: 0, soul: 0, rite: 0, storm: 0 },
    ranks, combos: [],
    xp: 0, level: 1, offers: [], rerolls: 3 + bonus.reroll, enemies: [], shots: [], fx: [], drops: [],
    spawn: 0, nextElite: C.eliteEvery * ST[stage].length, nextBarrage: C.barrageAt, boss: false, next: 1, kills: 0, damage: 0,
    state: 'playing', message: kit === 'axe' ? '해비의 출전 · 첫 조합을 향해' : '출전 · 첫 조합을 향해', messageTime: 4, comboKills: 0, streakTime: 0 }
  if (mode === 'vanguard') {
    s.level = V.startLevel; s.ranks[k.primary] = 4; s.ranks[k.secondary] = 3; s.ranks.echo = 2; s.ranks.tempo = 1; s.ranks.reach = 1
    s.combos = kitCombos(kit).filter(c => c.kit === kit).map(c => c.id); s.message = '선봉에 서기 · 전위대장 3명을 돌파하라'
  }
  return s
}
export const runDuration = (s: HaebiRun) => s.mode === 'vanguard' ? V.duration : C.duration * ST[s.stage].length
/** 마지막 두목이 나오는 때 */
export const bossTime = (s: HaebiRun) => C.bossAt * ST[s.stage].length
/** 본편 각성 시련의 이긴 기록이 말이 되는가 — 시련 판의 두목 때 이후 · 판 길이 안 (11-16: 열전을 20분으로 늘린 뒤 본편이 옛 10분 기준으로 재서 시련 통과를 버리고 있었다) */
export const trialWinValid = (elapsed: unknown) => typeof elapsed === 'number' && Number.isFinite(elapsed) && elapsed >= C.bossAt * ST.trial.length && elapsed <= C.duration * ST.trial.length + 1
/** 지금 토막(0~4) — 토막마다 나오는 적이 바뀐다 */
export const tierOf = (s: HaebiRun) => Math.min(4, Math.floor(s.t / bossTime(s) * 5))
/** 판이 끝나고 받는 금 (형 11-16: 「중간 패배는 적게, 다 깨면 클리어로 더 많이」) · 시련·선봉은 없음 */
export function runGold(s: HaebiRun) {
  if (s.mode !== 'stage') return 0
  const raw = s.kills * G.perKill + s.elites * G.perElite + Math.floor(s.t / 60) * G.perMinute + (s.state === 'won' ? G.clear : 0)
  return Math.floor(raw * ST[s.stage].gold * (1 + s.bonus.greed * SH.greed.step))
}

export const xpNeeded = (s: HaebiRun) => C.xpBase + s.level * C.xpPerLevel + s.level ** 2 * C.xpCurve
export const powerScale = (s: HaebiRun) => (1 + (s.level - 1) * C.levelPower) * (1 + s.bonus.might * SH.might.step)
export const areaScale = (s: HaebiRun) => 1 + s.ranks.reach * C.reachStep
/** 열전 시간을 예전 10분 판의 시각으로 — 국면·적 몰려옴은 예전 10분 곡선을 판 길이만큼 늘린다 (11-16 형: 「10분보다 길어지더라도 즐기게」) */
const paced = (s: HaebiRun) => s.t * 600 / runDuration(s)
export function phase(s: HaebiRun) { const u = paced(s); return s.mode === 'vanguard' ? `전위 돌파 ${s.breaches}/3` : u < 120 ? '첫 불씨' : u < 300 ? '힘의 결합' : u < 480 ? '폭풍의 진격' : s.t < bossTime(s) ? '압도' : '마지막 두목' }
export function comboReady(s: HaebiRun, c: typeof COMBOS[number]) { return Object.entries(c.needs).every(([k, v]) => s.ranks[k as Power] >= v) }
function announce(s: HaebiRun, text: string) { s.message = text; s.messageTime = 4 }
function offer(s: HaebiRun) {
  const attackKeys = attackPowers(s.kit)
  const slotsFull = attackKeys.filter(k => s.ranks[k] > 0).length >= C.attackSlots
  const pool = kitPowers(s.kit).filter(k => s.ranks[k] < POWERS[k].max && !(slotsFull && attackKeys.includes(k) && !s.ranks[k]))
  if (!pool.length || s.level >= C.maxLevel) return
  if (s.level === 1) { s.offers = [KITS[s.kit].secondary, 'ember', 'thunder']; return }
  // A developing attack is always offered; the remaining choices retain seeded variety.
  const attacks = pool.filter(k => attackKeys.includes(k))
  const developing = attacks.filter(k => s.ranks[k] > 0)
  const first = (developing.length ? developing : attacks)[Math.floor(random(s) * (developing.length || attacks.length))]
  s.offers = first ? [first] : []
  while (s.offers.length < 3 && s.offers.length < pool.length) {
    const rest = pool.filter(k => !s.offers.includes(k))
    s.offers.push(rest[Math.floor(random(s) * rest.length)]!)
  }
}
export function reroll(s: HaebiRun) { if (s.state !== 'playing' || s.level === 1 || !s.offers.length || s.rerolls <= 0) return false; s.rerolls--; offer(s); return true }
export function choose(s: HaebiRun, key: Power) {
  if (s.state !== 'playing' || !s.offers.includes(key) || s.ranks[key] >= POWERS[key].max) return false
  s.xp -= xpNeeded(s); s.ranks[key]++; s.level++; s.offers = []; s.hp = Math.min(s.maxHp, s.hp + C.levelHeal)
  for (const c of kitCombos(s.kit)) if (comboReady(s, c) && !s.combos.includes(c.id)) { s.combos.push(c.id); announce(s, `조합 완성 · ${c.name}`) }
  if (s.xp >= xpNeeded(s)) offer(s)
  return true
}
function fx(s: HaebiRun, kind: Effect['kind'], x: number, y: number, r = 18, color = '#ffdba0', angle = 0, x2 = x, y2 = y) {
  if (s.fx.length >= C.maxFx) s.fx.shift()
  const life = kind === 'bolt' ? .24 : kind === 'death' ? .45 : kind === 'skill' ? .65 : .32
  s.fx.push({ kind, x, y, r, color, angle, x2, y2, life, total: life })
}
/** 맞는 쪽이 덜 받는 몫 — 무당이 북돋운 적 */
const guard = (e: Mob) => e.buff > 0 ? 1 - M.shamanArmor : 1
function hit(s: HaebiRun, e: Mob, amount: number, knock = true) {
  if (e.hp <= 0) return
  // 급소 (상점 「행운」) — 강화가 없으면 난수를 뽑지 않는다 (예전 판과 같은 차례)
  const crit = s.bonus.luck > 0 && random(s) < s.bonus.luck * SH.luck.step
  amount *= guard(e) * (crit ? 2 : 1)
  s.damage += Math.min(e.hp, amount); e.hp -= amount; e.flash = .12
  if (knock && e.kind !== 'boss' && e.kind !== 'iron' && e.kind !== 'bear') { const d = Math.hypot(e.x - s.x, e.y - s.y) || 1; e.x += (e.x - s.x) / d * C.knockback; e.y += (e.y - s.y) / d * C.knockback }
  // 피해 숫자 (형 11-16: 「한방이라 강해지는지 모르겠다」) — 맞은 자리의 이펙트에 실어 화면이 띄운다
  if (e.hp > 0) { fx(s, 'hit', e.x, e.y - 22); Object.assign(s.fx[s.fx.length - 1]!, { n: amount, crit }); return }
  s.kills++; s.comboKills++; s.streakTime = 2; s.hp = Math.min(s.maxHp, s.hp + C.killHeal); if (e.kind === 'elite') s.elites++
  fx(s, 'death', e.x, e.y - 20, e.kind === 'boss' ? 80 : 25, '#d4af76')
  Object.assign(s.fx[s.fx.length - 1]!, { mob: e.kind, face: s.x < e.x ? -1 : 1, n: amount, crit })
  const value = e.kind === 'boss' ? 100 : e.kind === 'elite' ? 45 : M[e.kind].xp
  if (s.drops.length >= C.maxDrops) s.xp += value
  else s.drops.push({ x: e.x, y: e.y, value, age: 0 })
  if (e.kind === 'boss') {
    if (s.mode === 'vanguard') { s.breaches++; announce(s, `전위대장 격파 · ${s.breaches}/3 돌파 확보`) }
    if (s.mode !== 'vanguard' || s.breaches === 3) { s.state = 'won'; s.offers = []; announce(s, s.mode === 'vanguard' ? '전위 완전 돌파 · 본대가 진격한다' : '산길을 가른 폭풍 · 토벌 완료') }
  }
}
function blast(s: HaebiRun, x: number, y: number, radius: number, damage: number, color = '#ff995e') {
  fx(s, 'blast', x, y, radius, color)
  for (const e of s.enemies) if (Math.hypot(e.x - x, e.y - y) < radius) hit(s, e, damage)
}
function nearest(s: HaebiRun, x: number, y: number, excluded: number[] = [], radius = Infinity) {
  let best: Mob | undefined, d = radius
  for (const e of s.enemies) { if (e.hp <= 0 || excluded.includes(e.id)) continue; const n = Math.hypot(e.x - x, e.y - y); if (n < d) { d = n; best = e } }
  return best
}
const SPEED: Partial<Record<Missile['kind'], number>> = { enemy: C.enemyShotSpeed, arrow: C.bowSpeed, javelin: C.javelinSpeed, wave: C.waveSpeed, rain: 0, barrage: 0, stone: 0, flame: 0, knife: C.knifeSpeed, soul: C.soulSpeed, hurl: M.hunterSpeed }
const LIFE: Partial<Record<Missile['kind'], number>> = { arrow: C.bowLife, javelin: C.javelinLife, wave: C.waveLife, rain: C.rainDelay, barrage: C.barrageDelay, stone: M.lobDelay, flame: M.flameLife, knife: C.knifeLife, soul: C.soulLife, hurl: M.hunterLife }
const RADIUS: Partial<Record<Missile['kind'], number>> = { gale: 25, wave: C.waveRadius, javelin: 16, arrow: 10, barrage: C.barrageRadius, stone: M.lobRadius, flame: M.flameRadius, knife: 12, soul: 16 }
function shoot(s: HaebiRun, kind: Missile['kind'], angle: number, damage: number, x = s.x, y = s.y, tx = x, ty = y, gen = 0) {
  if (s.shots.length >= C.maxShots) return undefined
  const speed = SPEED[kind] ?? C.galeSpeed
  const b: Missile = { x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: LIFE[kind] ?? C.galeLife, kind, damage, radius: RADIUS[kind] ?? 12, hit: [], angle, tx, ty }
  if (gen) b.gen = gen
  s.shots.push(b); return b
}
/** 한 번 꿰뚫고 멈추는 수 — 도끼 묶음(gale·shard)은 예전 그대로 */
function pierce(s: HaebiRun, b: Missile) {
  if (b.kind === 'knife') return C.knifePierce + Math.floor(s.ranks.knife / 3)
  if (b.kind === 'soul') return 1
  return b.kind === 'shard' ? 2 : b.kind === 'arrow' ? C.bowPierce + Math.floor(s.ranks.bow / 2) : b.kind === 'javelin' ? C.javelinPierce + s.ranks.javelin : b.kind === 'wave' ? Infinity : 3 + s.ranks.gale
}
/** 잡졸 체력 — 시간이 갈수록 두꺼워진다 (스테이지 hp 배수) */
const mobHp = (s: HaebiRun) => C.mobHp * (1 + s.t * C.hpTimeScale + (s.t / 60) ** 2 * C.hpTimeCurve) * ST[s.stage].hp
export function spawnMob(s: HaebiRun, kind?: Mob['kind']) {
  const side = Math.floor(random(s) * 4), p = random(s)
  if (s.mode === 'vanguard') kind ??= random(s) < C.archerShare + s.t * C.archerTimeShare ? 'archer' : 'club'
  else if (!kind) { const [a, b] = ST[s.stage].tiers[tierOf(s)]!; kind = random(s) < M[b].share ? b : a }
  const hp = kind === 'boss' ? (s.mode === 'vanguard' ? V.captainHp[Math.min(2, s.captains)]! : C.bossHp * ST[s.stage].bossHp) : kind === 'elite' ? C.eliteHp * (1 + s.t / runDuration(s)) * ST[s.stage].hp : s.mode === 'vanguard' ? V.mobHp : mobHp(s) * M[kind].hp
  // 산들개는 한쪽에서 떼로 몰려온다
  const pack = kind === 'dog' ? M.dogPack : 1
  for (let i = 0; i < pack; i++) s.enemies.push({ id: s.next++, x: (side === 0 ? 15 : side === 1 ? C.width - 15 : p * C.width) + i * 9, y: (side === 2 ? 24 : side === 3 ? C.height - 15 : 40 + p * (C.height - 55)) + (i % 2) * 14,
    hp, max: hp, kind, cd: 2, flash: 0, wind: 0, aimX: 0, aimY: 0, act: 0, vx: 0, vy: 0, buff: 0, poison: 0, pdps: 0 })
}
/** 겨눴다 곧게 내닫는 적 (창돌격꾼 · 범) — 예고·돌진 시간 · 돌진 배속 · 다시 겨누기까지 · 겨누는 거리 */
const CHARGE = {
  runner: { range: M.runnerRange, wind: M.runnerWind, dash: M.runnerDash, speed: M.runnerDashSpeed, cd: M.runnerCooldown },
  tiger: { range: M.tigerRange, wind: M.tigerWind, dash: M.tigerDash, speed: M.tigerDashSpeed, cd: M.tigerCooldown },
} as const
export const charge = (kind: MobKind) => kind === 'runner' || kind === 'tiger' ? CHARGE[kind] : null
/** 내려찍기(wind) 범위 · 준비 시간 — 두목·정예 · 반달곰 */
export const slamRadius = (kind: MobKind) => kind === 'bear' ? M.bearRadius : C.bossRadius
export const slamWindup = (kind: MobKind) => kind === 'bear' ? M.bearWind : C.bossWindup
function hurt(s: HaebiRun, amount: number) { if (s.inv > 0) return; s.hp -= Math.max(1, amount * ST[s.stage].damage - s.bonus.armor * SH.armor.step); s.inv = C.hitInv; s.hurt = .3 }
/** 시간이 갈수록 적 한 대가 아파진다 — 가만히 서서 고르기만 해도 깨지 않게 (형 11-15) */
const threat = (s: HaebiRun) => 1 + s.t * C.threatTimeScale
function won(s: HaebiRun) { return s.state === 'won' }
/** 주 무기 — 가장 가까운 적을 향해 (도끼 묶음은 예전 해비 코드 그대로) */
function primary(s: HaebiRun, target: Mob, angle: number, dist: number, power: number, area: number, tempo: number) {
  const cos = Math.cos(angle), sin = Math.sin(angle)
  if (s.kit === 'axe') {
    const reach = (C.axeRange + C.axeRankRange * s.ranks.axe) * area
    if (!s.cool.axe && dist < reach) {
      s.cool.axe = C.axeCooldown / tempo; s.attack = .3; s.face = Math.cos(angle) < 0 ? -1 : 1
      fx(s, 'slash', s.x, s.y, reach, '#ffe2a0', angle)
      for (const e of s.enemies) if (Math.hypot(e.x - s.x, e.y - s.y) < reach && (s.ranks.axe >= 4 || (e.x - s.x) * Math.cos(angle) + (e.y - s.y) * Math.sin(angle) > -30)) hit(s, e, (C.axeDamage + C.axeRankDamage * s.ranks.axe) * power)
    }
  } else if (s.kit === 'bow') {
    if (!s.cool.bow && dist < C.bowRange * area) {
      s.cool.bow = C.bowCooldown / tempo; s.attack = .3; s.face = cos < 0 ? -1 : 1
      const count = 1 + Math.floor(s.ranks.bow / 3)
      for (let i = 0; i < count; i++) shoot(s, 'arrow', angle + (i - (count - 1) / 2) * .12, (C.bowDamage + C.bowRankDamage * s.ranks.bow) * power)
    }
  } else if (s.kit === 'spear') {
    const length = (C.spearLength + C.spearRankLength * s.ranks.spear) * area, width = C.spearWidth * area * (s.ranks.spear >= 4 ? 1.6 : 1)
    if (!s.cool.spear && dist < length) {
      s.cool.spear = C.spearCooldown / tempo; s.attack = .3; s.face = cos < 0 ? -1 : 1
      fx(s, 'thrust', s.x, s.y, length, '#ffe2a0', angle)
      for (const e of s.enemies) {
        const ex = e.x - s.x, ey = e.y - s.y, along = ex * cos + ey * sin
        if (along > -12 && along < length && Math.abs(ey * cos - ex * sin) < width) hit(s, e, (C.spearDamage + C.spearRankDamage * s.ranks.spear) * power)
      }
    }
  } else if (s.kit === 'dagger') {
    // 쌍단검: 짧게 아주 빠르게 · 4단계부터 등 뒤까지
    const reach = (C.daggerRange + C.daggerRankRange * s.ranks.dagger) * area
    if (!s.cool.dagger && dist < reach) {
      s.cool.dagger = C.daggerCooldown / tempo; s.attack = .3; s.face = cos < 0 ? -1 : 1
      fx(s, 'slash', s.x, s.y, reach, '#f1e4c0', angle)
      for (const e of s.enemies) {
        const ex = e.x - s.x, ey = e.y - s.y, d = Math.hypot(ex, ey) || 1
        if (d < reach && (s.ranks.dagger >= 4 || (ex * cos + ey * sin) / d > C.daggerArc)) hit(s, e, (C.daggerDamage + C.daggerRankDamage * s.ranks.dagger) * power)
      }
    }
  } else if (s.kit === 'magic') {
    // 방울 파동: 방향 없이 둘레 전체
    const r = (C.bellRadius + C.bellRankRadius * s.ranks.bell) * area
    if (!s.cool.bell && dist < r) {
      s.cool.bell = C.bellCooldown / tempo; s.attack = .3
      fx(s, 'ring', s.x, s.y, r, '#f3dc8a')
      for (const e of s.enemies) if (Math.hypot(e.x - s.x, e.y - s.y) < r) hit(s, e, (C.bellDamage + C.bellRankDamage * s.ranks.bell) * power)
    }
  } else {
    const reach = (C.swordRange + C.swordRankRange * s.ranks.sword) * area
    if (!s.cool.sword && dist < reach) {
      s.cool.sword = C.swordCooldown / tempo; s.attack = .3; s.face = cos < 0 ? -1 : 1
      fx(s, 'slash', s.x, s.y, reach, '#fff0c8', angle)
      for (const e of s.enemies) {
        const ex = e.x - s.x, ey = e.y - s.y, d = Math.hypot(ex, ey) || 1
        if (d < reach && (s.ranks.sword >= 4 || (ex * cos + ey * sin) / d > -C.swordArc)) hit(s, e, (C.swordDamage + C.swordRankDamage * s.ranks.sword) * power)
      }
    }
  }
  void target
}
/** 던지는 창·검기는 활잡이부터 노린다 — 가까이 못 가는 묶음이 화살에만 맞다 지지 않게 (형 11-15 난이도) */
function archerAngle(s: HaebiRun) {
  let best: Mob | null = null, bd: number = C.archerHunt
  for (const e of s.enemies) if (e.kind === 'archer' && e.hp > 0) { const d = Math.hypot(e.x - s.x, e.y - s.y); if (d < bd) { bd = d; best = e } }
  return best ? Math.atan2(best.y - s.y, best.x - s.x) : null
}
/** 묶음 전용 보조 공격 (도끼 묶음 = 질풍 도끼, 예전 그대로) */
function secondary(s: HaebiRun, target: Mob, angle: number, power: number, tempo: number) {
  if (s.kit === 'axe') {
    if (s.ranks.gale && !s.cool.gale) {
      s.cool.gale = C.galeCooldown / tempo; const count = 1 + Math.ceil(s.ranks.gale / 2) + s.ranks.echo
      for (let i = 0; i < count; i++) shoot(s, 'gale', angle + (i - (count - 1) / 2) * .24, (C.galeDamage + C.galeRankDamage * s.ranks.gale) * power)
    }
  } else if (s.kit === 'bow') {
    if (s.ranks.rain && !s.cool.rain) {
      s.cool.rain = C.rainCooldown / tempo
      const targets = s.enemies.filter(e => e.hp > 0), count = 1 + Math.ceil(s.ranks.rain / 2) + s.ranks.echo
      for (let i = 0; i < count; i++) {
        const e = i ? targets[Math.floor(random(s) * targets.length)] : target
        if (e) shoot(s, 'rain', 0, (C.rainDamage + C.rainRankDamage * s.ranks.rain) * power, e.x + (random(s) - .5) * C.rainSpread, e.y + (random(s) - .5) * C.rainSpread)
      }
    }
  } else if (s.kit === 'spear') {
    if (s.ranks.javelin && !s.cool.javelin) {
      angle = archerAngle(s) ?? angle
      s.cool.javelin = C.javelinCooldown / tempo; const count = 1 + Math.floor(s.ranks.javelin / 3) + s.ranks.echo
      for (let i = 0; i < count; i++) shoot(s, 'javelin', angle + (i - (count - 1) / 2) * .18, (C.javelinDamage + C.javelinRankDamage * s.ranks.javelin) * power)
    }
  } else if (s.kit === 'dagger') {
    if (s.ranks.knife && !s.cool.knife) {
      s.cool.knife = C.knifeCooldown / tempo; const count = 2 + Math.floor(s.ranks.knife / 3) + s.ranks.echo
      for (let i = 0; i < count; i++) shoot(s, 'knife', angle + (i - (count - 1) / 2) * .16, (C.knifeDamage + C.knifeRankDamage * s.ranks.knife) * power)
    }
  } else if (s.kit === 'magic') {
    if (s.ranks.soul && !s.cool.soul) {
      s.cool.soul = C.soulCooldown / tempo; const count = 1 + Math.ceil(s.ranks.soul / 2) + s.ranks.echo
      for (let i = 0; i < count; i++) shoot(s, 'soul', angle + (i - (count - 1) / 2) * .9, (C.soulDamage + C.soulRankDamage * s.ranks.soul) * power)
    }
  } else if (s.ranks.wave && !s.cool.wave) {
    angle = archerAngle(s) ?? angle
    s.cool.wave = C.waveCooldown / tempo; const count = 1 + Math.floor(s.ranks.wave / 3) + s.ranks.echo
    for (let i = 0; i < count; i++) shoot(s, 'wave', angle + (i - (count - 1) / 2) * .3, (C.waveDamage + C.waveRankDamage * s.ranks.wave) * power)
  }
}
/** 묶음 조합 중 스스로 도는 것 (도끼 폭풍은 예전 그대로) */
function aura(s: HaebiRun, power: number, area: number) {
  if (s.combos.includes('cyclone') && !s.cool.orbit) {
    s.cool.orbit = C.orbitInterval
    for (let i = 0; i < 3; i++) {
      const a = s.t * 2.8 + i * Math.PI * 2 / 3, x = s.x + Math.cos(a) * C.orbitRadius * area, y = s.y + Math.sin(a) * C.orbitRadius * area
      for (const e of s.enemies) if (Math.hypot(e.x - x, e.y - y) < 65 * area) hit(s, e, C.orbitDamage * power)
    }
  }
  if (s.combos.includes('volley') && !s.cool.volley) {
    s.cool.volley = C.volleyInterval
    for (let i = 0; i < C.volleyArrows; i++) shoot(s, 'arrow', s.t + i * Math.PI * 2 / C.volleyArrows, C.volleyDamage * power)
  }
  if (s.combos.includes('grove') && !s.cool.grove) {
    s.cool.grove = C.groveInterval
    for (let i = 0; i < C.groveSpikes; i++) {
      const a = s.t * 1.3 + i * Math.PI * 2 / C.groveSpikes, x = s.x + Math.cos(a) * C.groveRadius * area, y = s.y + Math.sin(a) * C.groveRadius * area
      fx(s, 'spike', x, y, C.groveHit * area, '#e8eefc')
      for (const e of s.enemies) if (Math.hypot(e.x - x, e.y - y) < C.groveHit * area) hit(s, e, C.groveDamage * power)
    }
  }
  if (s.combos.includes('shadowdance') && !s.cool.shadow) {
    // 그림자 춤: 둘레의 적 셋(+메아리)을 그림자가 벤다
    s.cool.shadow = C.shadowInterval; const used: number[] = []
    for (let i = 0; i < C.shadowTargets + s.ranks.echo; i++) {
      const e = nearest(s, s.x, s.y, used, C.shadowRange * area); if (!e) break
      used.push(e.id); fx(s, 'slash', e.x, e.y + C.heroShotHeight - 20, 46, '#b48cff', i * 2.1); hit(s, e, C.shadowDamage * power)
    }
  }
  if (s.combos.includes('rite') && !s.cool.rite) {
    s.cool.rite = C.riteInterval; const r = C.riteRadius * area
    fx(s, 'ring', s.x, s.y, r, '#ffb35a')
    for (const e of s.enemies) if (Math.hypot(e.x - s.x, e.y - s.y) < r) hit(s, e, C.riteDamage * power)
  }
  if (s.combos.includes('soulstorm') && !s.cool.storm) {
    s.cool.storm = C.stormInterval
    for (let i = 0; i < C.stormOrbs + s.ranks.echo; i++) {
      const a = s.t * 3.2 + i * Math.PI * 2 / (C.stormOrbs + s.ranks.echo), x = s.x + Math.cos(a) * C.stormRadius * area, y = s.y + Math.sin(a) * C.stormRadius * area
      for (const e of s.enemies) if (Math.hypot(e.x - x, e.y - y) < 40 * area) hit(s, e, C.stormDamage * power, false)
    }
  }
  if (s.combos.includes('tempest') && !s.cool.tempest) {
    s.cool.tempest = C.tempestInterval
    const r = C.tempestRadius * area
    fx(s, 'slash', s.x, s.y, r, '#fff0c8', s.t * 6); fx(s, 'slash', s.x, s.y, r, '#fff0c8', s.t * 6 + Math.PI)
    for (const e of s.enemies) if (Math.hypot(e.x - s.x, e.y - s.y) < r) hit(s, e, C.tempestDamage * power)
  }
}
export function stepHaebi(s: HaebiRun, input: RunInput, dt: number) {
  if (s.state !== 'playing' || s.offers.length) return
  dt = Math.max(0, Math.min(.05, dt)); s.t += dt
  for (const key of ['attack', 'hurt', 'inv', 'dash', 'dashCd', 'skillCd', 'messageTime', 'streakTime'] as const) s[key] = Math.max(0, s[key] - dt)
  if (!s.streakTime) s.comboKills = 0
  for (const key of Object.keys(s.cool) as Cool[]) s.cool[key] = Math.max(0, s.cool[key] - dt)
  s.hp = Math.min(s.maxHp, s.hp + (C.regen + s.bonus.regen * SH.regen.step) * dt)
  const len = Math.hypot(input.x, input.y), divisor = Math.max(1, len)
  let dx = input.x / divisor, dy = input.y / divisor
  s.moving = len > .05
  if (dx) s.face = Math.sign(dx)
  if (input.dash && !s.dashCd) { s.dash = C.dashTime; s.dashCd = C.dashCooldown; s.inv = C.dashInv }
  if (s.dash && !len) dx = s.face
  const speed = C.speed * (1 + s.bonus.swift * SH.swift.step) * (s.dash ? C.dashSpeed : 1)
  s.x = Math.max(32, Math.min(C.width - 32, s.x + dx * speed * dt)); s.y = Math.max(65, Math.min(C.height - 24, s.y + dy * speed * dt))
  const power = powerScale(s), area = areaScale(s), tempo = 1 + s.ranks.tempo * C.tempoStep + s.bonus.haste * SH.haste.step
  if (input.skill && !s.skillCd) {
    s.skillCd = C.skillCooldown; s.inv = C.skillInv; s.attack = .3
    fx(s, 'skill', s.x, s.y, C.skillRange * area, '#ffdf8b')
    blast(s, s.x, s.y, C.skillRange * area, C.skillDamage * power)
    s.shots = s.shots.filter(b => b.kind !== 'enemy' && b.kind !== 'hurl')
  }
  const target = nearest(s, s.x, s.y)
  if (target) {
    const angle = Math.atan2(target.y - s.y, target.x - s.x), dist = Math.hypot(target.x - s.x, target.y - s.y)
    primary(s, target, angle, dist, power, area, tempo)
    secondary(s, target, angle, power, tempo)
    if (s.ranks.ember && !s.cool.ember) {
      s.cool.ember = C.emberCooldown / tempo
      const targets = s.enemies.filter(e => e.hp > 0)
      for (let i = 0; i < 1 + s.ranks.echo; i++) { const e = i ? targets[Math.floor(random(s) * targets.length)] : target; if (e) shoot(s, 'ember', Math.atan2(e.y - s.y, e.x - s.x), (C.emberDamage + C.emberRankDamage * s.ranks.ember) * power, s.x, s.y, e.x, e.y) }
    }
    if (s.ranks.thunder && !s.cool.thunder) {
      s.cool.thunder = C.thunderCooldown / tempo
      const used: number[] = []; let x = target.x, y = target.y - 160
      for (let i = 0; i < 2 + Math.ceil(s.ranks.thunder / 2) + s.ranks.echo; i++) {
        const e = i === 0 ? target : nearest(s, x, y, used, C.thunderRange * area)
        if (!e) break
        used.push(e.id); fx(s, 'bolt', x, y, 1, '#b8d5ff', 0, e.x, e.y); x = e.x; y = e.y
        hit(s, e, (C.thunderDamage + s.ranks.thunder * C.thunderRankDamage) * power, false)
        if (s.combos.includes('inferno')) blast(s, x, y, C.emberRange * area, C.emberDamage * power)
      }
    }
  }
  aura(s, power, area)
  s.spawn -= dt
  const rate = s.mode === 'vanguard' ? V.spawnEarly + (V.spawnLate - V.spawnEarly) * s.t / V.duration : paced(s) < 120 ? C.spawnEarly + paced(s) / 70 : paced(s) < 300 ? C.spawnMid + (paced(s) - 120) / 45 : paced(s) < 480 ? C.spawnLate + (paced(s) - 300) / 35 : C.spawnFeast
  if (s.spawn <= 0) { if (s.enemies.length < C.maxEnemies) spawnMob(s); s.spawn = 1 / (rate * ST[s.stage].spawn) }
  if (s.mode !== 'vanguard' && s.t >= s.nextElite && s.nextElite < bossTime(s)) { spawnMob(s, 'elite'); s.nextElite += C.eliteEvery * ST[s.stage].length; announce(s, '정예 산적 · 쓰러뜨리면 기세 대량 획득') }
  if (s.mode !== 'vanguard' && !s.boss && s.t >= bossTime(s)) { spawnMob(s, 'boss'); s.boss = true; announce(s, '마지막 두목 · 완성한 힘을 쏟아부어라') }
  if (s.mode === 'vanguard' && s.captains < 3 && s.breaches === s.captains && s.t >= V.captainAt[s.captains]!) {
    spawnMob(s, 'boss'); s.captains++
    announce(s, `제${s.captains} 전위대장 출현 · 금빛 표적을 향해 돌파하라`)
  }
  if (s.mode !== 'vanguard' && s.t >= s.nextBarrage) {
    // 산적 일제 사격: 서 있는 자리에 붉은 고리가 먼저 뜨고 잠시 뒤 떨어진다 — 움직이면 안 맞고, 서 있으면 다 맞는다 (형 11-15: 가만히 있어도 깬다)
    const k = Math.min(1, s.t / bossTime(s)), damage = C.barrageDamage * (1 + s.t * C.barrageTimeScale)
    shoot(s, 'barrage', 0, damage, s.x, s.y)
    for (let i = 0; i < Math.floor(k * C.barrageExtra + .5); i++) { const a = random(s) * Math.PI * 2, d = C.barrageRadius * (1.4 + random(s) * 1.6); shoot(s, 'barrage', 0, damage, Math.max(32, Math.min(C.width - 32, s.x + Math.cos(a) * d)), Math.max(65, Math.min(C.height - 24, s.y + Math.sin(a) * d))) }
    s.nextBarrage += C.barrageEvery + (C.barrageEveryLate - C.barrageEvery) * k
  }
  for (const e of s.enemies) {
    if (e.hp <= 0) continue
    e.cd = Math.max(0, e.cd - dt); e.flash = Math.max(0, e.flash - dt); e.buff = Math.max(0, e.buff - dt)
    // 독 비수: 독이 도는 동안 초마다 깎인다 (숫자는 띄우지 않는다)
    if (e.poison > 0) { e.poison -= dt; const bite = e.pdps * dt; if (bite >= e.hp) { hit(s, e, e.hp + 1, false); continue } e.hp -= bite; s.damage += bite }
    const x = s.x - e.x, y = s.y - e.y, d = Math.hypot(x, y) || 1
    const kind = e.kind, m = kind === 'elite' || kind === 'boss' ? null : M[kind]
    const v = (C.mobSpeed + s.t * C.speedTimeScale) * (m?.speed ?? 1) * (e.buff > 0 ? M.shamanSpeed : 1) * (kind === 'berserker' && e.hp < e.max / 2 ? M.berserkSpeed : 1)
    const ch = charge(kind)
    if (e.wind > 0) { e.wind -= dt; if (e.wind <= 0 && Math.hypot(s.x - e.aimX, s.y - e.aimY) < slamRadius(kind)) hurt(s, kind === 'bear' ? M.bearDamage * threat(s) : C.bossDamage) }
    else if ((kind === 'boss' || kind === 'elite') && d < 180 && !e.cd) { e.wind = C.bossWindup; e.aimX = s.x; e.aimY = s.y; e.cd = C.bossCooldown }
    // 반달곰: 가까이 오면 일어서서(바닥 원) 내려친다
    else if (kind === 'bear' && d < M.bearRange && !e.cd) { e.wind = M.bearWind; e.aimX = s.x; e.aimY = s.y; e.cd = M.bearCooldown }
    else if (ch && e.act > 0) {
      // 창돌격꾼·범: 예고(붉은 줄) 동안 멈춰 겨눈다 → 곧게 돌진(범은 길게 덮침)
      e.act -= dt; if (e.act <= 0) e.act = -ch.dash
    } else if (ch && e.act < 0) {
      e.act = Math.min(0, e.act + dt); e.x += e.vx * v * ch.speed * dt; e.y += e.vy * v * ch.speed * dt
      e.x = Math.max(10, Math.min(C.width - 10, e.x)); e.y = Math.max(20, Math.min(C.height - 10, e.y)); if (!e.act) e.cd = ch.cd
    } else if (ch && d < ch.range && !e.cd) { e.act = ch.wind; e.vx = x / d; e.vy = y / d; e.aimX = e.x + e.vx * ch.range * 1.4; e.aimY = e.y + e.vy * ch.range * 1.4 }
    else if (kind === 'hunter' && e.act > 0) {
      // 맥족 투창: 붉은 줄로 겨눈 쪽으로 빠른 창 한 자루
      e.act -= dt; if (e.act <= 0) { e.act = 0; shoot(s, 'hurl', Math.atan2(e.vy, e.vx), M.hunterDamage * threat(s), e.x, e.y); e.cd = M.hunterCooldown }
    } else if (kind === 'hunter' && d < M.hunterRange && !e.cd) { e.act = M.hunterWind; e.vx = x / d; e.vy = y / d; e.aimX = e.x + e.vx * M.hunterRange * 1.3; e.aimY = e.y + e.vy * M.hunterRange * 1.3 }   // 다시 잴 동안은 다가온다 (멀리 쌓여 창비가 되지 않게)
    else if (kind === 'torch') {
      // 횃불 방화꾼: 달리며 지나간 자리에 짧은 불바닥 · 가까우면 기름 단지(불화살과 같은 고리)
      e.act -= dt
      if (e.act <= 0) { e.act = M.torchTrail; if (s.shots.filter(b => b.kind === 'flame').length < M.flameCap) { const f = shoot(s, 'flame', 0, M.flameDamage, e.x, e.y); if (f) f.life = M.torchTrailLife } }
      if (d < M.torchRange && !e.cd) { shoot(s, 'stone', 0, M.lobDamage * threat(s), s.x, s.y, e.x, e.y, 1); e.cd = M.torchCooldown }
      if (d > 23) { e.x += x / d * v * dt; e.y += y / d * v * dt }
    } else if (kind === 'archer' && d < C.archerRange) { if (!e.cd) { shoot(s, 'enemy', Math.atan2(y, x), C.enemyShotDamage * (1 + s.t * C.shotTimeScale), e.x, e.y); e.cd = C.archerCooldown } }
    else if ((kind === 'slinger' || kind === 'firearcher') && d < M.lobRange) {
      // 투석꾼·불화살: 서 있는 자리에 고리 → 잠시 뒤 떨어짐 (불화살은 불바닥을 남김)
      if (!e.cd) { shoot(s, 'stone', 0, M.lobDamage * threat(s), s.x, s.y, e.x, e.y, kind === 'firearcher' ? 1 : 0); e.cd = M.lobCooldown }
    } else if (kind === 'shaman' && d < M.shamanRange) {
      if (!e.cd) { e.cd = M.shamanEvery; fx(s, 'buff', e.x, e.y, M.shamanRadius, '#ff5a4a'); for (const o of s.enemies) if (o !== e && Math.hypot(o.x - e.x, o.y - e.y) < M.shamanRadius) o.buff = M.shamanBuff }
    } else if (d > 23) { e.x += x / d * v * dt; e.y += y / d * v * dt }
    if (d < 26 && !e.cd) { hurt(s, C.contactDamage * threat(s) * (m?.hit ?? 1)); e.cd = 1 }
  }
  // Iterate a snapshot: splitting missiles are simulated starting on the next tick.
  for (const b of [...s.shots]) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt
    if (b.kind === 'gale' || b.kind === 'ember' || b.kind === 'shard' || b.kind === 'enemy') b.angle += dt * 10
    if (b.kind === 'enemy' || b.kind === 'hurl') { if (Math.hypot(b.x - s.x, b.y - s.y) < 20) { hurt(s, b.damage); b.life = 0 } }
    else if (b.kind === 'stone') {
      if (b.life <= 0) { fx(s, 'blast', b.x, b.y, b.radius, b.gen ? '#ff7a3a' : '#c9b08a'); if (Math.hypot(b.x - s.x, b.y - s.y) < b.radius) hurt(s, b.damage); if (b.gen) shoot(s, 'flame', 0, M.flameDamage, b.x, b.y) }
    } else if (b.kind === 'flame') { if (Math.hypot(b.x - s.x, b.y - s.y) < b.radius) hurt(s, b.damage) }
    else if (b.kind === 'ember') {
      if (Math.hypot(b.x - b.tx, b.y - b.ty) < 20 || b.life <= 0) { blast(s, b.x, b.y, (C.emberRange + s.ranks.ember * 10) * area, b.damage); b.life = 0 }
    } else if (b.kind === 'barrage') {
      if (b.life <= 0) { fx(s, 'blast', b.x, b.y, C.barrageRadius, '#ff8a5c'); if (Math.hypot(b.x - s.x, b.y - s.y) < C.barrageRadius) hurt(s, b.damage) }
    } else if (b.kind === 'rain') {
      if (b.life <= 0) {
        blast(s, b.x, b.y, C.rainRadius * area, b.damage, '#cfe3ff')
        if (s.combos.includes('meteor')) for (let i = 0; i < 3; i++) shoot(s, 'shard', i * Math.PI * 2 / 3 + s.t, b.damage * C.splitDamage, b.x, b.y)
      }
    } else {
      if (b.kind === 'javelin' && !b.gen && s.combos.includes('boomerang') && b.life < C.javelinLife * C.boomerangTurn) {
        const a = Math.atan2(s.y - b.y, s.x - b.x), v = Math.hypot(b.vx, b.vy)
        b.vx = Math.cos(a) * v; b.vy = Math.sin(a) * v; b.angle = a; b.hit = []; b.gen = 1
      }
      if (b.kind === 'soul') {
        // 혼불: 가장 가까운 적 쪽으로 천천히 꺾는다
        const t = nearest(s, b.x, b.y)
        if (t) { const want = Math.atan2(t.y - b.y, t.x - b.x); let turn = want - b.angle; turn = Math.atan2(Math.sin(turn), Math.cos(turn)); b.angle += Math.max(-C.soulTurn * dt, Math.min(C.soulTurn * dt, turn)); b.vx = Math.cos(b.angle) * C.soulSpeed; b.vy = Math.sin(b.angle) * C.soulSpeed }
      }
      if (b.kind === 'wave' && !b.gen && b.life <= 0 && s.combos.includes('splitwave')) for (const turn of [-.6, .6]) shoot(s, 'wave', b.angle + turn, b.damage * C.splitDamage, b.x, b.y, b.x, b.y, 1)
      for (const e of s.enemies) {
        if (e.hp <= 0 || b.hit.includes(e.id) || Math.hypot(b.x - e.x, b.y - e.y) > b.radius + 18) continue
        if (b.kind === 'soul') { blast(s, b.x, b.y, C.soulRadius * areaScale(s), b.damage, '#9fd8ff'); b.life = 0; break }
        hit(s, e, b.damage * (e.kind === 'shield' ? M.shieldBlock : 1)); b.hit.push(e.id)
        if (b.kind === 'knife' && s.combos.includes('venom')) { e.poison = C.venomTime; e.pdps = Math.max(e.pdps, b.damage * C.venomShare) }
        if (b.kind === 'gale' && s.combos.includes('torrent') && b.hit.length === 1) for (let i = 0; i < 3; i++) shoot(s, 'shard', i * Math.PI * 2 / 3 + b.angle, b.damage * .6, b.x, b.y)
        if (b.hit.length >= pierce(s, b)) { b.life = 0; break }
      }
    }
  }
  for (const d of s.drops) {
    d.age += dt; const dx = s.x - d.x, dy = s.y - d.y, dist = Math.hypot(dx, dy) || 1
    if (dist < C.dropMagnet * (1 + s.bonus.magnet * SH.magnet.step) || d.age > C.dropLife / 2) { const travel = Math.min(dist, C.dropSpeed * dt); d.x += dx / dist * travel; d.y += dy / dist * travel }
    if (dist < 22 || d.age > C.dropLife) { s.xp += d.value * (1 + s.bonus.wisdom * SH.wisdom.step); d.value = 0 }
  }
  s.drops = s.drops.filter(d => d.value > 0); s.enemies = s.enemies.filter(e => e.hp > 0)
  s.shots = s.shots.filter(b => b.life > 0 && b.x > -60 && b.x < C.width + 60 && b.y > -60 && b.y < C.height + 60)
  for (const f of s.fx) f.life -= dt
  s.fx = s.fx.filter(f => f.life > 0)
  // 되살아나기 (상점 「부활」) — 체력 반으로, 잠깐 무적, 날아오던 것을 지운다
  if (s.hp <= 0 && s.revives > 0) { s.revives--; s.hp = s.maxHp / 2; s.inv = 2; s.shots = s.shots.filter(b => b.kind !== 'enemy' && b.kind !== 'hurl' && b.kind !== 'stone' && b.kind !== 'flame' && b.kind !== 'barrage'); announce(s, '다시 일어선다 · 부활') }
  if (s.hp <= 0 || s.t >= runDuration(s) && !won(s)) { s.hp = Math.max(0, s.hp); s.state = 'lost'; s.offers = [] }
  else if (s.state === 'playing' && s.xp >= xpNeeded(s)) offer(s)
}
