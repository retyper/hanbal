import { tagPrimaryShot, primaryShotDirection, tagCriticalFinish } from './critical-finish.ts'
import { HAEBI_RUN as C, HAEBI_VANGUARD as V, HAEBI_STAGES as ST, HAEBI_MOBS as M, HAEBI_SHOP as SH, HAEBI_GOLD as G, HAEBI_ULT as U, HAEBI_TREE as T, HAEBI_AWAKEN as A } from '../tune/params.ts'
import { makeRng } from '../core/rng.ts'
import { josa } from '../core/josa.ts'
import { HAEBI_CHAMPION as CH } from '../tune/params.ts'
import { HAEBI_GIANT as GI } from '../tune/params.ts'
import { closestPoint, type Contact, type Shape, type Point } from './giant-core.ts'
import { createGiant, stepGiant, commitGiant, syncGiantPose, giantStruck, endGiant, giantContact as contactOf, giantHpKey, nearestLiveHpPart, giantSweep, giantAimParts, giantHasTarget, giantPart, giantRecoveryHit, giantPoisonFromLastHit, giantName, giantEntrySeconds, giantMidHpScale, giantMaxHp, type GiantKind, type GiantState } from './giant.ts'
import { HAEBI_AWAKEN_ULT as AC } from '../tune/params.ts'
import { HAEBI_KITS as K } from '../tune/params.ts'
import { HAEBI_JACKPOT as JP } from '../tune/params.ts'
import { initChampion, stepChampion, championDamageScale, championRecover, spawnView, type ChampionHooks, type ChampionPattern, type ChampionState, type SpawnView } from './champion.ts'
import { HAEBI_PALISADE as WL, HAEBI_BREAK as BR } from '../tune/params.ts'
import { createPalisade, damagePiece, piecesHit, tickPalisade, wallAim, wallMove, wallSettle, type Palisade, type WallPiece } from './palisade.ts'
import { HAEBI_WIDE as WD } from '../tune/params.ts'
import { solidsFor, pushOutOfSolids, type Solid } from './props.ts'
import type { Structure } from './build.ts'
import { newWide, fieldBounds, worldBounds, stepGate, simView, ringSpot, huntSpot, inSimView, strayed, type WideState } from './wide.ts'
import { HAEBI_BUILD as BU, HAEBI_CAP as CP } from '../tune/params.ts'
import { HAEBI_BREAKABLE as HW, HAEBI_BUILD2 as B2, HAEBI_BOSS_CHEST as BC, HAEBI_BUILDUP as B3, HAEBI_CAP60 as C60, HAEBI_BOSS_DUEL as BD, HAEBI_BOSS_HIT as BH, HAEBI_PACE as PC } from '../tune/params.ts'
import { addStatus, tickStatuses, type Status } from './status.ts'
import { BUILD_KINDS, ALL_BUILD_KINDS, isBuild2Kind, hasHp, bearsHp, wallTouching, rebuildOf, aggroOf, aggroNear, sotdaeRadius, sotdaeSlow, wellRadius, wellShare, wellCool, beaconEvery, beaconRadius, beaconShare, catapultEvery, catapultRadius, catapultShare, totemLineShare, segmentDistance, totemLinks, isBuildKind, newBuild, buildUnits, buildSpot, towerShare, towerFire, buildHp, standing, bodyR, pushOutOfBuild, touchingBuild, separateBuild, fenceTouching, jarBonusAt, BUILD_UPS, isBuildUp, FIRE_KINDS, TIMED_KINDS, firepowerMul, reloadInterval, type BuildKind, type BuildState } from './build.ts'

/**
 * 장수 열전 — 다이센카식 20분 판 (11-16 형: 「스테이지·판 밖 상점·휘장 · 무기 10단계 · 적 단계업」).
 * 무기 묶음(Kit) = 주 무기 + 그 무기 전용 보조 공격 + 공용 부적·번개 + 보조 능력 셋 + 조합 둘(묶음 전용) + 뇌화 연옥(공용).
 * 판(mode): stage = 독립 열전(스테이지 · 상점 강화 bonus) · trial = 본편 각성 시련(짧고 쉬움) · vanguard = 본편 선봉.
 */
export type Kit = 'axe' | 'bow' | 'spear' | 'sword' | 'dagger' | 'magic' | 'sling'
export type Power = 'axe' | 'gale' | 'ember' | 'thunder' | 'echo' | 'tempo' | 'reach' | 'bow' | 'rain' | 'spear' | 'javelin' | 'sword' | 'wave' | 'dagger' | 'knife' | 'bell' | 'soul' | 'sling' | 'skip' | 'hone' | 'drill' | 'tough' | 'breath' | 'nimble' | 'stout' | 'capA' | 'capB' | 'capC' | 'tower' | 'fence' | 'jar' | 'totem' | 'sotdae' | 'beacon' | 'catapult' | 'well' | 'firepower' | 'reload'
export const POWERS: Record<Power, { name: string; icon: string; max: number; color: string; desc: string }> = {
  axe: { name: '파쇄 도끼', icon: '斧', max: 10, color: '#f5c578', desc: '느리고 크게 앞을 내려찍어 맞은 적을 밀어내고 멈칫하게 함' },
  gale: { name: '질풍 도끼', icon: '風', max: 10, color: '#96e9cf', desc: '도끼를 높이 던져 앞에 떨어뜨림 · 박힌 도끼가 잠시 돌며 둘레를 벰' },
  ember: { name: '홍련 부적', icon: '火', max: 10, color: '#ff936b', desc: '내 무기가 맞힌 적에게 부적이 붙어 잠시 뒤 폭발' },
  thunder: { name: '벽력', icon: '雷', max: 10, color: '#b4c8ff', desc: '내 무기의 큰 한 방이 닿은 적에서 번개가 곁의 적으로 튐' },
  echo: { name: '메아리', icon: '響', max: 4, color: '#c4b5fa', desc: '보조 공격 수 · 한 번에 붙는 부적 수 · 번개 전이 수 증가' },
  tempo: { name: '맹공', icon: '迅', max: 5, color: '#efd887', desc: '모든 자동 공격의 발동 속도 증가' },
  reach: { name: '확산', icon: '波', max: 5, color: '#7dcedd', desc: '공격·폭발·번개 전이 범위 증가' },
  bow: { name: '속사', icon: '弓', max: 10, color: '#f2d48a', desc: '가까운 적에게 꿰뚫는 화살을 쏨 · 멈춰 서서 겨누면 모두 꿰뚫는 큰 화살' },
  rain: { name: '화살비', icon: '雨', max: 10, color: '#cfe3ff', desc: '가장 많이 뭉친 무리 위로 화살비가 늦게 쏟아짐' },
  spear: { name: '관통창', icon: '槍', max: 10, color: '#f0c98a', desc: '길고 좁게 찔러 한 줄을 꿰뚫음 · 줄 세울수록 세고, 곧게 달리면 돌격' },
  javelin: { name: '투창', icon: '投', max: 10, color: '#a8e0c6', desc: '멀리 날아가며 여러 적을 꿰뚫는 창을 던짐' },
  sword: { name: '환두대도', icon: '刀', max: 10, color: '#f6d9a0', desc: '앞을 넓게 벰 · 셋째 칼마다 걷는 쪽으로 큰 반달 검기' },
  wave: { name: '검기', icon: '氣', max: 10, color: '#a7d8ff', desc: '걷는 쪽으로 모든 적을 꿰뚫는 칼바람을 날림' },
  dagger: { name: '쌍단검', icon: '匕', max: 10, color: '#e9d6a8', desc: '손 닿는 데의 가장 센 적을 빠르게 찌름 · 등 뒤면 치명 · 독이 겹겹이' },
  knife: { name: '비도', icon: '飛', max: 10, color: '#d8e4f0', desc: '작은 칼을 부채꼴로 던져 앞을 꿰뚫음' },
  bell: { name: '방울 파동', icon: '鈴', max: 10, color: '#f3dc8a', desc: '방울 소리가 둘레의 모든 적을 침 · 한자리에 서 있을수록 굿판이 넓어짐' },
  soul: { name: '혼불', icon: '魂', max: 10, color: '#9fd8ff', desc: '적을 쫓아가 터지는 푸른 혼불을 띄움' },
  sling: { name: '돌팔매', icon: '石', max: 10, color: '#dcc8a0', desc: '멀리 던진 돌이 떨어진 둘레를 치고 한 번 더 튐 · 너무 가까운 적엔 약함' },
  skip: { name: '연환석', icon: '跳', max: 10, color: '#9fd0e0', desc: '맞힌 적에게서 곁의 적으로 튀어 가며 여러 번 치는 돌' },
  // ── 갈래 칸 (11-17 밤 · 이름·설명은 묶음마다 NODE_TEXT 가 덮는다) ──
  hone: { name: '벼리기', icon: '鍊', max: 5, color: '#f5b85a', desc: '주 무기 피해 증가' },
  drill: { name: '숙련', icon: '熟', max: 5, color: '#8fdcc4', desc: '보조 공격 피해와 공격 속도 증가' },
  tough: { name: '철벽', icon: '甲', max: 5, color: '#c0b6a0', desc: '받는 피해 감소' },
  breath: { name: '재생', icon: '息', max: 5, color: '#9fe0a0', desc: '초마다 체력을 조금씩 되찾음' },
  nimble: { name: '신속', icon: '捷', max: 3, color: '#b8e4f0', desc: '회피를 더 자주 · 이동 속도 증가' },
  stout: { name: '불굴', icon: '剛', max: 5, color: '#e0a090', desc: '최대 체력 증가' },
  capA: { name: '주 무기 끝', icon: '極', max: 3, color: '#ffd36a', desc: '' },
  capB: { name: '보조 끝', icon: '極', max: 3, color: '#7fe8d8', desc: '' },
  capC: { name: '되받아치기', icon: '反', max: 3, color: '#d0a8ff', desc: '' },
  // ── 65-BUILD 설치 갈래 (네 번째 갈래 · 규칙이 켜진 판에만 카드·나무에 나온다) ──
  tower: { name: '화살 망루', icon: '樓', max: BU.max, color: '#e8b46a', desc: '장수 앞에 망루가 서서 가까운 적에게 화살을 쏩니다. 몸으로 밀어 옮길 수 있고, 3단계와 5단계에 하나씩 더 섭니다' },
  fence: { name: '목책 바리케이드', icon: '柵', max: BU.max, color: '#c98f5a', desc: '장수 앞에 목책이 섭니다. 적은 지나가지 못하고 멈춰 서서 목책을 부수며, 부서져도 잠시 뒤 다시 섭니다' },
  // ── 67-BUILD2 설치 갈래 다섯 (규칙이 켜진 판에만 카드·나무에 나온다) ──
  totem: { name: '장승', icon: '將', max: BU.max, color: '#d9a46a', desc: '장수 앞에 장승이 서서 둘레의 적을 끌어모읍니다. 장승 둘 사이에 이어진 혼줄을 지나는 적은 다치고 느려집니다' },
  sotdae: { name: '솟대', icon: '鳥', max: BU.max, color: '#cfe6f5', desc: '장수 앞에 솟대가 섭니다. 둘레에 들어온 적이 느려집니다' },
  beacon: { name: '봉수대', icon: '烽', max: BU.max, color: '#ff9a5a', desc: '장수 앞에 봉수대가 섭니다. 때마다 연기를 올려 적이 가장 많이 뭉친 곳에 화살비를 부릅니다' },
  catapult: { name: '포차', icon: '砲', max: BU.max, color: '#c8a070', desc: '장수 앞에 포차가 섭니다. 멀리 뭉친 적에게 큰 바위를 던지고, 부서지면 잠시 뒤 다시 섭니다' },
  well: { name: '우물', icon: '井', max: BU.max, color: '#8fd0ff', desc: '장수 앞에 우물이 섭니다. 가까이 가면 물기운이 몇 초 동안 체력을 채워 주고, 물이 다시 차오를 때까지 기다립니다' },
  jar: { name: '기세 항아리', icon: '甕', max: BU.max, color: '#e7c27a', desc: '장수 앞에 항아리가 섭니다. 둘레에서 쓰러진 적이 기세를 더 줍니다. 몸으로 밀어 옮길 수 있습니다' },
  // ── 69-BUILDUP 설치물 강화 칸 (종류 칸을 쓰지 않는다 · 얹힐 설치물을 가진 판에만 카드·나무에 나온다) ──
  firepower: { name: '화력', icon: '烈', max: B3.max, color: '#ff8a4a', desc: '망루 화살, 봉수대 화살비, 포차 바위, 장승 혼줄의 피해가 커집니다. 설치물 종류 칸을 쓰지 않습니다' },
  reload: { name: '장전', icon: '裝', max: B3.max, color: '#f0d070', desc: '망루, 봉수대, 포차가 더 자주 쏩니다. 설치물 종류 칸을 쓰지 않습니다' },
}
export const KITS: Record<Kit, { primary: Power; secondary: Power; title: string; weapon: string; skill: string }> = {
  axe: { primary: 'axe', secondary: 'gale', title: '폭풍을 가르는 도끼', weapon: '도끼', skill: '천지개벽' },
  bow: { primary: 'bow', secondary: 'rain', title: '하늘을 덮는 화살', weapon: '활', skill: '파천일섬' },
  spear: { primary: 'spear', secondary: 'javelin', title: '대열을 꿰는 창', weapon: '창', skill: '용오름 창' },
  sword: { primary: 'sword', secondary: 'wave', title: '바람을 가르는 칼', weapon: '칼', skill: '섬광참' },
  dagger: { primary: 'dagger', secondary: 'knife', title: '그림자를 걷는 단검', weapon: '단검', skill: '환영난무' },
  magic: { primary: 'bell', secondary: 'soul', title: '혼을 부르는 방울', weapon: '방울', skill: '천벌' },
  sling: { primary: 'sling', secondary: 'skip', title: '하늘을 가르는 돌팔매', weapon: '돌팔매', skill: '돌벼락' },
}
// ── 기술 나무: 갈래 셋 × 네 층 (11-17 밤 · RAID-LINK §2 · D2 식 — 층은 그 갈래에 찍은 점으로 열린다 · HAEBI_TREE.tiers) ──
/** a 주 무기 갈래 · b 보조 갈래 · c 버팀 갈래 · d 설치 갈래 (65-BUILD 판에만) */
export type Branch = 'a' | 'b' | 'c' | 'd'
/** 무기 나무의 세 갈래 — 설치 갈래(d)는 규칙이 켜진 판에만 runBranches 가 더한다 (옛 판의 카드 뽑기·나무는 그대로) */
export const BRANCHES: readonly Branch[] = ['a', 'b', 'c']
const ALL_BRANCHES: readonly Branch[] = ['a', 'b', 'c', 'd']
/** 이 판의 갈래 — 65-BUILD 판은 넷 */
export const runBranches = (s: HaebiRun): readonly Branch[] => s.build ? ALL_BRANCHES : BRANCHES
/** 갈래마다 층(0~3)의 칸 — 확산(범위)·부적은 주 무기 갈래, 메아리(보조 수)·벽력은 보조 갈래, 기세는 버팀 갈래 · 조합은 늘 두 갈래를 잇는다 */
export function branchNodes(kit: Kit): Record<Branch, Power[][]> {
  const k = KITS[kit]
  return { a: [[k.primary], ['reach', 'ember'], ['hone'], ['capA']], b: [[k.secondary], ['echo', 'thunder'], ['drill'], ['capB']], c: [['tough', 'tempo'], ['breath', 'nimble'], ['stout'], ['capC']], d: [['tower', 'totem'], ['fence', 'sotdae', 'firepower'], ['jar', 'beacon', 'reload'], ['catapult', 'well']] }
}
/** 묶음마다 갈래 이름과 이름이 바뀌는 칸 (벼리기·숙련·갈래 끝) — 설명은 늘 「합니다」 */
export const NODE_TEXT: Record<Kit, { a: string; b: string } & Partial<Record<Power, { name: string; desc: string }>>> = {
  axe: { a: '파쇄', b: '질풍', hone: { name: '도끼날 벼리기', desc: '파쇄 도끼의 피해가 커집니다' }, drill: { name: '바람 길들이기', desc: '질풍 도끼가 더 세고 더 자주 날아갑니다' },
    capA: { name: '대지파쇄', desc: '휘두를 때마다 앞으로 땅이 갈라져 한 줄의 적을 모두 벱니다' }, capB: { name: '질풍회륜', desc: '박혀 돌던 질풍 도끼가 장수에게 되돌아오며 한 번 더 벱니다' } },
  bow: { a: '속사', b: '화살비', hone: { name: '시위 벼리기', desc: '속사 화살의 피해가 커집니다' }, drill: { name: '하늘 읽기', desc: '화살비가 더 세고 더 자주 쏟아집니다' },
    capA: { name: '관통일제', desc: '화살이 모든 적을 꿰뚫고 한 번에 더 많이 날아갑니다' }, capB: { name: '폭우', desc: '화살비가 떨어진 자리에 한 번 더 쏟아집니다' } },
  spear: { a: '찌르기', b: '투창', hone: { name: '창끝 벼리기', desc: '찌르기의 피해가 커집니다' }, drill: { name: '던지기 숙련', desc: '투창이 더 세고 더 자주 날아갑니다' },
    capA: { name: '삼방관통', desc: '앞과 양옆, 세 방향을 한꺼번에 찌릅니다' }, capB: { name: '대지창격', desc: '던진 창이 처음 꿰뚫은 자리에서 창날이 솟아 둘레를 칩니다' } },
  sword: { a: '베기', b: '검기', hone: { name: '칼날 벼리기', desc: '환두대도의 피해가 커집니다' }, drill: { name: '기 다스리기', desc: '검기가 더 세고 더 자주 날아갑니다' },
    capA: { name: '칼바람 베기', desc: '벨 때마다 짧은 검기가 함께 날아갑니다' }, capB: { name: '십자 검기', desc: '검기가 등 뒤로도 함께 날아갑니다' } },
  dagger: { a: '쌍검', b: '비도', hone: { name: '단검 벼리기', desc: '쌍단검의 피해가 커집니다' }, drill: { name: '손끝 숙련', desc: '비도가 더 세고 더 자주 날아갑니다' },
    capA: { name: '맹독쌍검', desc: '찌른 독이 더 세고 더 오래 갑니다' }, capB: { name: '폭렬비도', desc: '비도가 처음 맞힌 자리에서 작은 칼 셋이 앞으로 부채꼴로 튑니다' } },
  magic: { a: '방울', b: '혼불', hone: { name: '방울 울림', desc: '방울 파동의 피해가 커집니다' }, drill: { name: '혼 다스리기', desc: '혼불이 더 세고 더 자주 떠오릅니다' },
    capA: { name: '신령 부르기', desc: '방울이 울릴 때마다 혼불 신령이 날아가 적을 쫓습니다' }, capB: { name: '분열혼불', desc: '혼불이 터지면 작은 혼불로 갈라져 또 쫓아갑니다' } },
  sling: { a: '팔매', b: '물수제비', hone: { name: '팔매 벼리기', desc: '돌팔매의 피해가 커집니다' }, drill: { name: '연환석 숙련', desc: '연환석이 더 세고 더 자주 날아갑니다' },
    capA: { name: '땅울림', desc: '돌이 떨어진 둘레의 적이 잠시 어질어질 멈춥니다' }, capB: { name: '연쇄격', desc: '연환석이 훨씬 많이 튀고 튈 때마다 세집니다' } },
}
export const branchName = (kit: Kit, b: Branch) => b === 'c' ? '버팀' : b === 'd' ? '설치' : NODE_TEXT[kit][b]
/** 칸 이름·설명 — 묶음마다 다른 칸은 NODE_TEXT · 되받아치기는 그 묶음 비기 이름으로 */
export function nodeText(kit: Kit, p: Power) {
  if (p === 'capC') return { name: '되받아치기', desc: `맞으면 ${josa(KITS[kit].skill, '이', '가')} 작게 터집니다` }
  const t = NODE_TEXT[kit][p]
  return t ?? { name: POWERS[p].name, desc: POWERS[p].desc }
}
/** 그 묶음에서 고를 수 있는 칸 — 갈래 a·b·c 차례 */
export const kitPowers = (kit: Kit): Power[] => BRANCHES.flatMap(b => branchNodes(kit)[b].flat())
/** 이 판의 설치 종류 — 65-BUILD 판은 셋 · 67-BUILD2 판은 여덟 */
export const runKinds = (s: HaebiRun): readonly Power[] => s.build?.v2 ? ALL_BUILD_KINDS : BUILD_KINDS
/** 69-BUILDUP 화력·장전 칸이 이 판에 나오나 — 규칙 판에서 얹힐 설치물(화력 FIRE_KINDS · 장전 TIMED_KINDS)을 하나라도 가졌을 때만 (설치를 안 가는 판의 카드를 묽히지 않는다) */
export const buildUpOpen = (s: HaebiRun, p: Power) => !!s.build?.up && (p === 'firepower' ? FIRE_KINDS : p === 'reload' ? TIMED_KINDS : []).some(k => (s.ranks[k] ?? 0) > 0)
/** 이 판의 갈래 칸 — 설치 갈래(d)는 이 판의 설치 종류만 · 화력·장전은 나올 때만 (빈 층은 뺀다) */
export function runBranchNodes(s: HaebiRun): Record<Branch, Power[][]> {
  const t = branchNodes(s.kit), kinds = runKinds(s)
  return { ...t, d: t.d.map(row => row.filter(p => isBuildUp(p) ? buildUpOpen(s, p) : kinds.includes(p))).filter(row => row.length) }
}
/** 65-BUILD 설치 칸 가운데 지금 카드로 나올 수 있는 것 — 종류 칸(HAEBI_BUILD.kinds)이 다 차면 가진 종류만 */
export function buildChoices(s: HaebiRun): Power[] {
  if (!s.build) return []
  const kinds = runKinds(s), held = kinds.filter(k => (s.ranks[k] ?? 0) > 0)
  return held.length >= BU.kinds ? held : [...kinds]
}
/** 이 판에서 고를 수 있는 칸 — 무기 나무 + (65-BUILD 판) 설치 칸 + (69-BUILDUP 판) 나온 화력·장전 (종류 칸과 따로) */
export const runPowers = (s: HaebiRun): Power[] => s.build ? [...kitPowers(s.kit), ...buildChoices(s), ...BUILD_UPS.filter(p => buildUpOpen(s, p))] : kitPowers(s.kit)
export const attackPowers = (kit: Kit): Power[] => [KITS[kit].primary, KITS[kit].secondary, 'ember', 'thunder']
/** 칸이 선 갈래와 층 (그 묶음에 없는 칸은 null) */
export function nodeAt(kit: Kit, p: Power): { branch: Branch; tier: number } | null {
  const t = branchNodes(kit)
  for (const branch of ALL_BRANCHES) { const tier = t[branch].findIndex(row => row.includes(p)); if (tier >= 0) return { branch, tier } }
  return null
}
/** 그 갈래에 찍은 점 (주 무기 첫 단계도 1점 · 조합은 세지 않는다) */
export const branchPoints = (s: HaebiRun, b: Branch) => branchNodes(s.kit)[b].flat().reduce((n, p) => n + (s.ranks[p] ?? 0), 0)
/** 층이 열리는 점 — 설치 갈래(d)는 층 문턱이 없다 (셋 다 처음부터 열림) */
export const tierNeed = (b: Branch, tier: number) => b === 'd' ? 0 : T.tiers[tier]!
/** Branch thresholds are retained alongside the real parent after the 52 fixed-seed comparison. */
export const tierOpen = (s: HaebiRun, b: Branch, tier: number) => branchPoints(s, b) >= tierNeed(b, tier)
/** 52: four roots, then one real parent per ordinary power, plus the existing branch threshold. */
export function powerParents(kit: Kit): Partial<Record<Power, Power>> {
  const k = KITS[kit]
  return { reach: k.primary, ember: k.primary, hone: 'reach', capA: 'hone',
    echo: k.secondary, thunder: k.secondary, drill: 'echo', capB: 'drill',
    breath: 'tough', nimble: 'tempo', stout: 'tough', capC: 'stout' }
}
export const nodeParent = (kit: Kit, p: Power): Power | null => powerParents(kit)[p] ?? null
export function nodeOpen(s: HaebiRun, p: Power) {
  const parent = nodeParent(s.kit, p), at = nodeAt(s.kit, p)
  return !!at && (at.branch !== 'd' || !!s.build && (!isBuild2Kind(p) || !!s.build.v2) && (!isBuildUp(p) || buildUpOpen(s, p))) && (!parent || s.ranks[parent] >= 1) && tierOpen(s, at.branch, at.tier)
}
/** 가장 많이 찍은 갈래 (같으면 a → b → c) */
export function mainBranch(s: HaebiRun): Branch { let best: Branch = 'a'; for (const b of runBranches(s)) if (branchPoints(s, b) > branchPoints(s, best)) best = b; return best }
/** 그 묶음 나무를 다 채우는 점 (칸 끝 단계 합 + 조합 끝 단계) — 한 판 점(레벨 44 → 43점)의 두 배를 넘게 둔다 */
export const treeTotal = (kit: Kit) => kitPowers(kit).reduce((n, p) => n + POWERS[p].max, 0) + kitCombos(kit).length * T.max
/** 갈래 끝 단계가 곱하는 몫 (share + step × (단계−1)) */
const capShare = (rank: number, c: { share: number; step: number }) => c.share + c.step * (rank - 1)
export const COMBOS = [
  { id: 'cyclone', kit: 'axe', name: '산 가르기', old: '도끼 폭풍', needs: { axe: 4, gale: 3 }, desc: '셋째 내려찍기마다 앞으로 땅이 갈라져, 그 위를 지나는 적이 맞고 멈칫합니다.' },
  { id: 'inferno', kit: null, name: '뇌화 연옥', needs: { ember: 3, thunder: 3 }, desc: '번개가 떨어진 자리마다 불꽃 폭발이 일어납니다.' },
  { id: 'torrent', kit: 'axe', name: '천 갈래 바람', needs: { gale: 3, reach: 2 }, desc: '질풍 도끼가 떨어진 자리에서 작은 칼날 셋이 앞으로 갈라져 나갑니다.' },
  { id: 'volley', kit: 'bow', name: '일제 사격', old: '만 갈래 화살', needs: { bow: 4, rain: 3 }, desc: '겨눔 화살을 쏠 때마다 모두 꿰뚫는 화살 다섯 발이 앞으로 부채꼴로 나갑니다.' },
  { id: 'meteor', kit: 'bow', name: '유성 화살비', needs: { rain: 3, reach: 2 }, desc: '화살비가 떨어진 자리에서 화살 조각이 먼 쪽으로 튀어 나갑니다.' },
  { id: 'grove', kit: 'spear', name: '창벽', old: '창의 숲', needs: { spear: 4, javelin: 3 }, desc: '보는 쪽 앞에 창날이 가로 한 줄로 솟아, 넘어오는 적을 막고 찌릅니다.' },
  { id: 'boomerang', kit: 'spear', name: '회귀창', needs: { javelin: 3, reach: 2 }, desc: '던진 창이 되돌아오며 한 번 더 꿰뚫습니다.' },
  { id: 'tempest', kit: 'sword', name: '삼연격', old: '칼바람', needs: { sword: 4, wave: 3 }, desc: '셋째 칼의 반달 검기가 두 겹으로 나가고, 첫째·둘째 칼도 더 아파집니다.' },
  { id: 'splitwave', kit: 'sword', name: '분열검기', needs: { wave: 3, reach: 2 }, desc: '검기가 끝에서 두 갈래로 갈라져 더 날아갑니다.' },
  { id: 'shadowdance', kit: 'dagger', name: '표식 사냥', old: '그림자 춤', needs: { dagger: 4, knife: 3 }, desc: '곁의 가장 센 적에게 표식을 붙여 그림자가 벱니다. 표식 적을 찌르면 크게 터집니다.' },
  { id: 'venom', kit: 'dagger', name: '독 비수', needs: { knife: 3, reach: 2 }, desc: '비도에 맞은 적이 독으로 계속 깎입니다.' },
  { id: 'rite', kit: 'magic', name: '만신 굿', needs: { bell: 4, soul: 3 }, desc: '큰 굿판이 열려 둘레의 적을 한꺼번에 날립니다.' },
  { id: 'soulstorm', kit: 'magic', name: '혼불 회오리', needs: { soul: 3, reach: 2 }, desc: '혼불이 몸 둘레를 돌며 닿는 적을 태웁니다.' },
  { id: 'boulder', kit: 'sling', name: '거암돌진', needs: { sling: 4, skip: 3 }, desc: '큰 바위가 굴러가며 한 줄의 적을 모두 짓이기고 밀어냅니다.' },
  { id: 'daze', kit: 'sling', name: '진탕격', needs: { skip: 3, reach: 2 }, desc: '연환석에 맞은 적이 잠시 어질어질 멈춰 섭니다.' },
] as const
export type Combo = typeof COMBOS[number]['id']
export const kitCombos = (kit: Kit) => COMBOS.filter(c => c.kit === null || c.kit === kit)
/** 레벨업 카드 하나 — 능력(1층) 또는 조합(2층 · 금테) */
export type Pick = Power | Combo
const COMBO_IDS = new Set<string>(COMBOS.map(c => c.id))
export const isCombo = (k: string): k is Combo => COMBO_IDS.has(k)
export const comboOf = (id: Combo) => COMBOS.find(c => c.id === id)!
export type MobKind = 'club' | 'archer' | 'runner' | 'slinger' | 'shield' | 'dog' | 'berserker' | 'firearcher' | 'iron' | 'shaman' | 'tiger' | 'bear' | 'hunter' | 'torch' | 'elite' | 'boss'
export type StageId = keyof typeof ST
/** 판 밖 상점에서 산 단계 (HAEBI_SHOP 의 열둘) */
export type Bonus = Record<Exclude<keyof typeof SH, 'growth'>, number>
export const NO_BONUS: Bonus = { might: 0, vigor: 0, armor: 0, regen: 0, haste: 0, swift: 0, magnet: 0, wisdom: 0, revive: 0, reroll: 0, greed: 0, luck: 0 }
/** daze: 진탕격에 맞아 멈춘 남은 시간 · act: 창돌격꾼·범 예고(+)·돌진(−) 시간 · 투창 사냥꾼 겨눔(+) · 방화꾼 다음 불바닥까지 · vx·vy: 돌진·던질 방향 · buff: 무당이 북돋운 남은 시간 */
export interface Mob { id: number; x: number; y: number; hp: number; max: number; kind: MobKind; cd: number; flash: number; wind: number; aimX: number; aimY: number; act: number; vx: number; vy: number; buff: number; poison: number; pdps: number; daze: number; bornAt?: number; /** 59-WIDE 큰 놈 사냥: 아직 장수 화면에 들어온 적 없는 정예 (그동안 bornAt 을 지금으로 밀어 「빨리 잡기」가 처음 본 때부터 세어진다) */ unseen?: boolean; /** 58-KITS 단검 독 겹 */ stack?: number; /** 65-BUILD 끌려가 치고 있는 망루 id (없으면 장수) */ aggro?: number; /** 67-BUILD2 혼줄에 닿아 느려진 남은 초 */ slow?: number; /** 71-BOSSDUEL 마지막 두목이 나와 달아나는 남은 초 (치지도 맞지도 않고 다 달아나면 보상 없이 사라진다) */ flee?: number; /** 71-BOSSDUEL 우두머리가 부른 졸개 (달아나지 않는다) */ summoned?: true; phase?: 1 | 2 | 3; pattern?: ChampionPattern | null; patternSeq?: number; recovery?: number; champion?: ChampionState; bossRole?: 'midboss' | 'giant'; giant?: GiantState }
export interface Chest { id: number; eliteId: number; x: number; y: number; bornAt: number; pickedAt?: number; state: 'ground' | 'opened' | 'claimed' | 'expired'; choicesRemaining: number; gold: number; large: boolean;
  /** 60-JACKPOT: boss = 중간 보스 상자(조합 하나를 고른다) · jackpot = 정예 상자가 터뜨린 것 */ boss?: boolean; jackpot?: ChestJackpot }
/** 60-JACKPOT 정예 상자가 터뜨린 것 — count 단계(1·3·5·8) · picks 오른 칸(차례대로) · opened 그 가운데 새로 연 조합 · bonus 올릴 칸이 없어 엽전으로 바뀐 금 */
export interface ChestJackpot { count: number; picks: Pick[]; opened: Combo[]; bonus: number }
export interface Missile { x: number; y: number; vx: number; vy: number; life: number; kind: 'gale' | 'ember' | 'shard' | 'enemy' | 'arrow' | 'rain' | 'javelin' | 'wave' | 'barrage' | 'stone' | 'flame' | 'knife' | 'soul' | 'hurl' | 'pebble' | 'skip' | 'boulder' | 'tower' | 'signal' | 'lob'; damage: number; radius: number; hit: number[]; angle: number; tx: number; ty: number; gen?: number; source?: number; championShot?: boolean;
  /** 58-KITS: big = 큰 한 방(겨눔 화살 · 셋째 칼 반달 · 모두 꿰뚫음 · 벽력이 튐) · landed = 떨어져 박힌 질풍 도끼 · tick = 박힌 도끼가 다시 치기까지 · ember 의 source = 부적이 붙은 적 */
  big?: boolean; landed?: boolean; tick?: number }
/** 58-KITS 땅에 남는 것 — crack 산 가르기(갈라진 땅) · wall 창벽(가로 창날 줄) · (x,y) 에서 (cos,sin) 쪽 · 남은 life · 다음 치기까지 tick */
export interface KitZone { kind: 'crack' | 'wall'; x: number; y: number; cos: number; sin: number; life: number; tick: number; damage: number }
/**
 * 58-KITS 무기 개성 (docs/realm/WEAPON-IDENTITY-20261122.md) — 이 칸이 있는 판만 새 셈 (옛 기록은 없다 · 그대로 재생).
 * still 멈춰 선 시간(활 겨눔 · 방울 굿판) · aim 마지막으로 걸은 쪽 · runAim·runT 곧게 달리기를 시작한 쪽과 그 시간(창 돌격) · swing 휘두른 수(칼 1-2-3 · 도끼 셋째 내려찍기)
 * sealAt·sealLeft 이번 공격에 더 붙일 부적 · boltIdle 벽력이 준비된 채 기다린 시간 · mark 표식 적(0 = 없음) · step 그림자 걸음 재사용 · stepped 방금 그림자 걸음(다음 찌르기는 등 뒤) · focused 겨눔이 찼다고 알렸나
 */
export interface KitState { still: number; aim: number; runAim: number; runT: number; swing: number; sealAt: number; sealLeft: number; zones: KitZone[]; mark: number; step: number; stepped: boolean; focused: boolean; boltIdle: number }
export interface Effect { x: number; y: number; x2: number; y2: number; r: number; angle: number; life: number; total: number; kind: 'hit' | 'slash' | 'blast' | 'bolt' | 'skill' | 'ult' | 'death' | 'spike' | 'thrust' | 'buff' | 'ring' | 'thud'; color: string; mob?: Mob['kind']; face?: number; n?: number; crit?: boolean; ult?: Kit; tru?: boolean; awakened?: boolean; empowered?: boolean; awakenedRelease?: boolean; castSeq?: number; championCue?: 'enter' | 'roar' | 'recovery' | 'quake'; recoveryHit?: boolean; /** 64-BREAK 부위가 부서진 순간 (화면이 「부위 파괴!」) */ partBreak?: boolean; /** 66-CAP 최고 레벨 뒤 보상으로 받은 금 (화면이 「+금 · 회복」) */ capGold?: number; /** 68-BOSSCHEST 올릴 것이 없어 금으로 받은 보스 전리품 */ bossGold?: number; /** 67-BUILD2 우물이 한 번에 채운 체력 (화면이 물보라와 「+N」) */ wellHeal?: number }
/** 이어지는 비기(용오름 창의 솟음 · 환영난무의 순간 이동 · 돌벼락의 물결) — 남은 수 n · 다음까지 t 초 · 처음 자리 · 이미 벤 적 · k 힘 몫(되받아치기는 작게) */
export interface UltState { n: number; t: number; x: number; y: number; used: number[]; k: number }
export interface Drop { x: number; y: number; value: number; age: number }
type Cool = 'counter' | 'axe' | 'gale' | 'ember' | 'thunder' | 'orbit' | 'bow' | 'rain' | 'volley' | 'spear' | 'javelin' | 'grove' | 'sword' | 'wave' | 'tempest' | 'dagger' | 'knife' | 'shadow' | 'bell' | 'soul' | 'rite' | 'storm' | 'sling' | 'skip' | 'boulder'
export interface HaebiRun {
  mode: 'stage' | 'trial' | 'vanguard'; stage: StageId; bonus: Bonus; maxHp: number; revives: number; elites: number; kit: Kit; breaches: number; captains: number;
  seed: number; t: number; x: number; y: number; hp: number; face: number; moving: boolean;
  attack: number; hurt: number; inv: number; dash: number; dashCd: number; skillCd: number;
  cool: Record<Cool, number>; ult: UltState | null;
  /** combos = 연 조합 (고른 차례) · comboRanks = 그 단계 1~T.max (없으면 1) */
  ranks: Record<Power, number>; combos: Combo[]; comboRanks: Partial<Record<Combo, number>>; xp: number; level: number; offers: Pick[]; rerolls: number;
  /** 버팀 끝 「되받아치기」 — 맞은 다음 걸음에 비기가 작게 터진다 */
  counterDue: boolean;
  /** 시전 (HAEBI_ULT.cast · HAEBI_AWAKEN.cast) — 비기·각성을 누른 뒤 터지기까지 · 그동안 판이 느려지고 장수는 다치지 않는다 · tru = 진 비기(각성 중) · trueUlt = 지금 도는 비기가 진 비기 */
  cast: CastState | null; trueUlt: boolean;
  /**56A: qualification, appearance and the accepted manual-ult charge are independent. Legacy runs omit these fields. */
  permanentAwake?: boolean; appearanceAwake?: boolean; gritUltReady?: boolean; ultAwakened?: boolean; ultEmpowered?: boolean;
  /**56B accepted manual awakened sequence and its not-yet-emitted leading release cue. */
  awakenedCasts?: number; ultReleaseSeq?: number;
  /** gauge/form/formT describe timed grit in56A. canAwaken is a compatibility alias; old rules retain timed awake. */
  gauge: number; form: 'normal' | 'awake' | 'grit'; formT: number; wakes: number; canAwaken: boolean; ward: number;
  enemies: Mob[]; shots: Missile[]; fx: Effect[]; drops: Drop[];
  spawn: number; nextElite: number; nextBarrage: number; boss: boolean; next: number; kills: number; damage: number;
  state: 'playing' | 'won' | 'lost'; message: string; messageTime: number; comboKills: number; streakTime: number;
  giantFlow?: { midSpawned: boolean; midDefeated: boolean; finalSpawned: boolean; finalDefeated: boolean; finalOwner?: Mob };
  /** 56-C 목책 돌파 판의 진짜 목책 (규칙 56C 에만 · raid/palisade.ts) */
  palisade?: Palisade;
  chests?: Chest[]; chestChoice?: { id: number; left: number; nonce: number }; choiceOrigin?: 'level' | 'chest'; offerNonce?: number; chestGold?: number; chestsClaimed?: number; nextChestId?: number;
  /** 58-KITS 무기 개성 규칙 (opts.kitRules) — 없으면 옛 셈 */
  kits?: KitState;
  /** 59-WIDE 넓은 맵 (opts.mapRules · raid/wide.ts) — 없으면 한 장짜리 옛 판 */
  wide?: WideState;
  /** 61-SOLID 막는 장식 밑동 (opts.blockRules · raid/props.ts) — 없으면 장식은 그림뿐 */
  solids?: Solid[];
  /** 62-ANCHOR 장수가 순간이동하지 않는다 (opts.anchorRules) */
  anchored?: boolean;
  /** 73-PHANTOM 환영난무는 장수가 직접 적에서 적으로 옮겨 다니고 끝나면 처음 자리로 돌아온다 (opts.phantomRules) */
  phantom?: true;
  /** 74-BUFF 장수의 버프 목록 (물기운 · opts.buffRules) — 없으면 우물은 옛 대로 한 번에 채운다 */
  buffs?: Status[];
  /** 74-BUFF 물기운이 마지막으로 채운 양 (화면의 초록 숫자 · 읽기만) */
  waterPulse?: { at: number; n: number };
  /** 64-BREAK 부위 파괴 규칙 (opts.breakRules) */
  breakOn?: boolean;
  /** 65-BUILD 설치 갈래 (opts.buildRules · raid/build.ts) — 없으면 세 갈래 옛 판 (설치 칸의 단계도 ranks 에 없다) */
  build?: BuildState;
  /** 66-CAP 최고 레벨 뒤 보상 (opts.capRules) — n 받은 수 · gold 그렇게 받은 판 금 */
  cap?: { n: number; gold: number; /** 70-AWAKECAP 영구 각성 판의 최고 레벨 (HAEBI_CAP60.capLevel · 없으면 HAEBI_CAP.capLevel) */ top?: number; /** 처음 낸 70-AWAKECAP 판(옛 기록) — HAEBI_CAP60.v1 막대 */ v1?: true };
  /** 68-BOSSCHEST 중간 보스 상자가 늘 카드 셋 (opts.bossChestRules · 60-JACKPOT 판에만) */
  bossChest?: true;
  /** 71-BOSSDUEL 보스전은 보스와 겨루게 (opts.bossDuelRules · 스테이지 판만) */
  duel?: true;
  /** 72-BOSSHIT 거대 보스의 큰 공격은 최대 체력의 몫 아래로 안 내려간다 (opts.bossHitRules · 스테이지 판만) */
  bossHit?: true;
  /** 76-PACE 초반 곡선 (opts.paceRules · 스테이지 판만) */
  pace?: true;
  /** 60-JACKPOT 상자 규칙 (opts.chestRules) — 없으면 옛 고르는 상자 · pity 5개 넘게 못 터진 상자 수 · five·eight 이 판에서 터진 5개·8개 · ranks 상자가 올려 준 칸 수 */
  jackpots?: { pity: number; five: number; eight: number; ranks: number };
}
export interface RunInput { x: number; y: number; dash?: boolean; skill?: boolean; wake?: boolean; shortCutin?: boolean; /** 실제 카메라 안 발사자 ID, 0=없음. 생략한 봇·옛 기록은 전체 판. */ barrageSource?: number; viewBounds?: SpawnView }
export interface CastState { kind: 'ult' | 'wake'; t: number; total: number; tru: boolean; awakened?: boolean; empowered?: boolean; slow?: number; seq?: number }
export function random(s: HaebiRun) { const rng = makeRng(s.seed); const n = rng.next(); s.seed = rng.state(); return n }
/**
 * permanentAwake/appearanceAwake are entry snapshots supplied by the caller, never read from storage here.
 * awaken remains the fallback qualification alias. Explicit53B, plus default trial/vanguard, preserve timed-awake rules.
 * mastery: 숲·여울·목책을 다 깬 장수 (막대 절반으로 시작)
 */
export interface HaebiOpts { stage?: StageId; bonus?: Partial<Bonus>; awaken?: boolean; mastery?: boolean; permanentAwake?: boolean; appearanceAwake?: boolean; simRules?: '53B' | '56A' | '56B' | '55-IMUGI' | '56C' | '55-TIGER' | '57-BULGASARI' | '55-GUMIHO' | '55-SHAMAN'; /** 58-KITS 무기 개성 — 스테이지 규칙과 따로 켠다 (판 기록 opts 에 그대로 남아 재생도 같다) */ kitRules?: '58-KITS'; /** 60-JACKPOT 상자 — 정예 상자는 고르지 않고 터지고, 중간 보스 상자는 조합 하나를 고른다 (스테이지 판만 · 판 기록 opts 에 남아 재생도 같다) */ chestRules?: '60-JACKPOT'; /** 59-WIDE 넓은 맵 — 열전 스테이지 판에만 켜진다 (시련·선봉에 넘겨도 한 장짜리 그대로 · 판 기록 opts 에 남아 재생도 같다) */ mapRules?: '59-WIDE'; /** 61-SOLID 넓은 맵의 나무·바위·목책이 장수와 적을 막는다 (무기는 통과 · 59-WIDE 판에서만 · 판 기록 opts 에 남아 재생도 같다) */ blockRules?: '61-SOLID'; /** 62-ANCHOR 장수는 제 발로만 움직인다 — 단검의 그림자 걸음·환영난무가 장수를 순간이동시키지 않는다 (형 11-23 「때리다가 갑자기 순간이동 · 보스전에서 원하지 않는 곳으로」 · 판 기록 opts 에 남는다) */ anchorRules?: '62-ANCHOR'; /** 73-PHANTOM 환영난무는 장수가 직접 옮겨 다니며 벤다 (62-ANCHOR 위에 얹는다) */ phantomRules?: '73-PHANTOM'; /** 74-BUFF 우물이 지속 회복 버프(물기운)가 된다 — 쿨타임이 찼을 때 닿으면 HAEBI_BUILD2.well.time 초 동안 총량을 고르게 채운다 (67-BUILD2 판에서만 · 판 기록 opts 에 남는다) */ buffRules?: '74-BUFF'; /** 64-BREAK 부위 파괴가 느껴지게 — 몸통 피해가 가까운 부위로 번지고 · 부위 체력 낮춤 · 부서지면 그로기와 더 큰 피해 (판 기록 opts 에 남는다) */ breakRules?: '64-BREAK'; /** 66-CAP 최고 레벨 뒤 기세 막대가 다시 차면 회복과 판 금으로 바꾼다 (HAEBI_CAP · 판 기록 opts 에 남는다) */ capRules?: '66-CAP'; /** 68-BOSSCHEST 중간 보스 상자가 늘 카드 셋 (안 연 조합 → 조합 단계 → 갈래 끝·주 무기 두 단계 · HAEBI_BOSS_CHEST · 판 기록 opts 에 남는다) */ bossChestRules?: '68-BOSSCHEST'; /** 71-BOSSDUEL 보스전 잡졸을 줄인다 — 마지막 두목이 살아 있으면 저절로 나오는 잡졸 bossSpawn 배·적 상한 bossCap · 중간 보스면 midbossSpawn 배 · 마지막 두목이 나오는 순간 보통 잡졸은 달아나 사라진다 (HAEBI_BOSS_DUEL · 스테이지 판만 · 판 기록 opts 에 남는다) */ bossDuelRules?: '71-BOSSDUEL'; /** 72-BOSSHIT 거대 보스의 큰 공격은 맞으면 최대 체력의 큰 몫이 깎인다 (HAEBI_BOSS_HIT · 스테이지 판만 · 판 기록 opts 에 남는다) */ bossHitRules?: '72-BOSSHIT'; /** 70-AWAKECAP 영구 각성(permanentAwake)으로 들어온 판은 최고 레벨 60 · 51~60 은 막대가 더 길고 레벨 힘은 반 (겉모습 각성 appearanceAwake 는 상관없다 · HAEBI_CAP60 · 66-CAP 판에서만 · 판 기록 opts 에 남는다) */ awakeCapRules?: '70-AWAKECAP' | '70B-AWAKECAP'; /** 69-BUILDUP 설치 갈래에 화력·장전 칸 (종류 칸을 쓰지 않는다 · 얹힐 설치물을 가진 판에만 나온다 · HAEBI_BUILDUP · 65-BUILD 판에서만 · 판 기록 opts 에 남는다) */ buildUpRules?: '69-BUILDUP' | '69B-BUILDUP'; /** 67-BUILD2 설치 갈래에 장승·솟대·봉수대·포차·우물을 더한다 (65-BUILD 판에서만 · 판 기록 opts 에 남는다) */ build2Rules?: '67-BUILD2'; /** 65-BUILD 레벨업 카드의 네 번째 갈래 「설치」 — 고르면 망루·목책·항아리가 장수 앞에 서서 판 끝까지 남는다 · 장수·적은 지나가지 못하고 장수가 몸으로 밀어 옮긴다 (판 기록 opts 에 남는다) */ buildRules?: '65-BUILD'; /** 75-WALL 항아리·솟대·봉수대·우물도 체력이 있어 잡졸·정예가 물어 부순다 · 부서진 것은 효과가 끊긴다 (65-BUILD 판에서만 · HAEBI_BREAKABLE · 판 기록 opts 에 남는다) */ wallRules?: '75-WALL'; /** 76-PACE 초반 곡선 — 생성 속도 계단을 잇고 첫 정예를 당긴다 (HAEBI_PACE · 스테이지 판만 · 판 기록 opts 에 남는다) */ paceRules?: '76-PACE' }
/** 새 판이 쓰는 무기 규칙 */
export const KIT_RULES = '58-KITS' as const
/** 새 스테이지 판이 쓰는 상자 규칙 */
export const CHEST_RULES = '60-JACKPOT' as const
/** 새 열전 스테이지 판이 쓰는 맵 규칙 */
export const MAP_RULES = '59-WIDE' as const
/** 새 열전 스테이지 판이 쓰는 장애물 규칙 */
export const SOLID_RULES = '61-SOLID' as const
/** 새 판이 쓰는 「순간이동 없음」 규칙 */
export const ANCHOR_RULES = '62-ANCHOR' as const
/** 새 판이 쓰는 「환영난무는 장수가 직접 순간이동」 규칙 (62-ANCHOR 위에 얹는다) */
export const PHANTOM_RULES = '73-PHANTOM' as const
/** 새 판이 쓰는 「우물 = 지속 회복 버프」 규칙 (67-BUILD2 위에 얹는다) */
export const BUFF_RULES = '74-BUFF' as const
/** 새 판이 쓰는 부위 파괴 규칙 */
/** 새 판이 쓰는 「건물은 모두 부서진다」 규칙 (65-BUILD 위에 얹는다) */
export const WALL_RULES = '75-WALL' as const
/** 새 판이 쓰는 「초반 곡선」 규칙 */
export const PACE_RULES = '76-PACE' as const
export const BREAK_RULES = '64-BREAK' as const
/** 새 판이 쓰는 설치 갈래 규칙 */
export const BUILD_RULES = '65-BUILD' as const
/** 새 판이 쓰는 설치 다섯 종류 더 규칙 */
export const BUILD2_RULES = '67-BUILD2' as const
/** 새 판이 쓰는 설치물 강화 칸(화력·장전) 규칙 */
export const BUILDUP_RULES = '69B-BUILDUP' as const
/** 새 판이 쓰는 보스전 잡졸 줄임 규칙 */
export const BOSSDUEL_RULES = '71-BOSSDUEL' as const
export const BOSSHIT_RULES = '72-BOSSHIT' as const
/** 새 판이 쓰는 각성 최고 레벨 60 규칙 */
export const AWAKECAP_RULES = '70B-AWAKECAP' as const
/** 새 판이 쓰는 중간 보스 상자 규칙 */
export const BOSSCHEST_RULES = '68-BOSSCHEST' as const
/** 새 판이 쓰는 최고 레벨 뒤 보상 규칙 */
export const CAP_RULES = '66-CAP' as const
export function createHaebi(seed = 7, mode: HaebiRun['mode'] = 'stage', kit: Kit = 'axe', opts: HaebiOpts = {}): HaebiRun {
  const bonus = { ...NO_BONUS, ...opts.bonus }, maxHp = C.health + bonus.vigor * SH.vigor.step, stage: StageId = mode === 'trial' ? 'trial' : opts.stage ?? 'forest'
  // 55-IMUGI 는 여울만 · 56C(진짜 목책)는 목책 돌파만 · 55-TIGER(백두 대호)는 설원만 · 57-BULGASARI(진짜 목책 + 불가사리)는 목책 돌파만 · 55-GUMIHO(구미호)는 숲 산길 열전만(각성 시련은 아님) · 55-SHAMAN(불의 무녀 장군)은 불타는 산성만 — 다른 판에 들어오면 56B 그대로
  const rules = opts.simRules === '55-IMUGI' && (mode !== 'stage' || stage !== 'ford') || (opts.simRules === '56C' || opts.simRules === '57-BULGASARI') && (mode !== 'stage' || stage !== 'palisade') || opts.simRules === '55-TIGER' && (mode !== 'stage' || stage !== 'snow') || opts.simRules === '55-GUMIHO' && (mode !== 'stage' || stage !== 'forest') || opts.simRules === '55-SHAMAN' && (mode !== 'stage' || stage !== 'fortress') ? '56B' : opts.simRules
  const k = KITS[kit]
  // 65-BUILD 가 꺼진 판은 설치 칸을 ranks 에 넣지 않는다 (옛 판 상태·기록이 글자 하나까지 같게)
  const build = opts.buildRules === BUILD_RULES, build2 = build && opts.build2Rules === BUILD2_RULES, buildUp = build && (opts.buildUpRules === BUILDUP_RULES || opts.buildUpRules === '69-BUILDUP')
  // 67-BUILD2 가 꺼진 판은 새 다섯 칸을 ranks 에 넣지 않는다 (65-BUILD 판도 글자 하나까지 같게)
  const ranks = Object.fromEntries((Object.keys(POWERS) as Power[]).filter(p => isBuildUp(p) ? buildUp : isBuildKind(p) ? build && (build2 || !isBuild2Kind(p)) : true).map(p => [p, 0])) as Record<Power, number>
  // 평타(주 무기)만 들고 시작한다 (11-19 형: 「시작은 평타만」) — 보조 공격은 첫 레벨업 카드(맨 앞)로 · 비기는 첫 레벨업에서 열린다 (ultOpen)
  ranks[k.primary] = T.startPrimary; ranks[k.secondary] = T.startSecondary
  const s: HaebiRun = { mode, stage, bonus, maxHp, revives: bonus.revive, elites: 0, kit, breaches: 0, captains: 0, seed, t: 0, x: C.width / 2, y: C.height / 2, hp: maxHp, face: 1, moving: false,
    attack: 0, hurt: 0, inv: 0, dash: 0, dashCd: 0, skillCd: 0, ult: null,
    cool: { counter: 0, axe: 0, gale: 0, ember: 0, thunder: 0, orbit: 0, bow: 0, rain: 0, volley: 0, spear: 0, javelin: 0, grove: 0, sword: 0, wave: 0, tempest: 0, dagger: 0, knife: 0, shadow: 0, bell: 0, soul: 0, rite: 0, storm: 0, sling: 0, skip: 0, boulder: 0 },
    ranks, combos: [], comboRanks: {}, counterDue: false, cast: null, trueUlt: false,
    gauge: opts.mastery ? A.need * A.mastery : 0, form: 'normal', formT: 0, wakes: 0, canAwaken: !!opts.awaken, ward: 0,
    xp: 0, level: 1, offers: [], rerolls: 3 + bonus.reroll, enemies: [], shots: [], fx: [], drops: [],
    spawn: 0, nextElite: C.eliteEvery * ST[stage].length, nextBarrage: C.barrageAt, boss: false, next: 1, kills: 0, damage: 0,
    state: 'playing', message: kit === 'axe' ? '해비의 출전 · 첫 조합을 향해' : '출전 · 첫 조합을 향해', messageTime: 4, comboKills: 0, streakTime: 0 }
  if (mode === 'stage') Object.assign(s, { chests: [], chestGold: 0, chestsClaimed: 0, nextChestId: 1, choiceOrigin: 'level', offerNonce: 0 })
  if (rules === '56A' || rules === '56B' || rules === '56C' || rules === '55-IMUGI' || rules === '55-TIGER' || rules === '57-BULGASARI' || rules === '55-GUMIHO' || rules === '55-SHAMAN' || mode === 'stage' && rules !== '53B') Object.assign(s, { permanentAwake: opts.permanentAwake ?? opts.awaken ?? false, appearanceAwake: opts.appearanceAwake ?? true, gritUltReady: false, ultAwakened: false, ultEmpowered: false, canAwaken: opts.permanentAwake ?? opts.awaken ?? false })
  if (rules === '56B' || rules === '56C' || rules === '55-IMUGI' || rules === '55-TIGER' || rules === '57-BULGASARI' || rules === '55-GUMIHO' || rules === '55-SHAMAN' || mode === 'stage' && rules === undefined) Object.assign(s, { awakenedCasts: 0, ultReleaseSeq: 0 })
  if (rules === '55-IMUGI' || rules === '55-TIGER' || rules === '57-BULGASARI' || rules === '55-GUMIHO' || rules === '55-SHAMAN') s.giantFlow = { midSpawned: false, midDefeated: false, finalSpawned: false, finalDefeated: false }
  // 57 은 56C 의 진짜 목책을 그대로 세우고 그 위에 거대 보스 흐름을 얹는다
  if (rules === '56C' || rules === '57-BULGASARI') s.palisade = createPalisade()
  if (opts.kitRules === KIT_RULES) s.kits = { still: 0, aim: 0, runAim: 0, runT: 0, swing: 0, sealAt: -1, sealLeft: 0, zones: [], mark: 0, step: 0, stepped: false, focused: false, boltIdle: 0 }
  if (opts.mapRules === MAP_RULES && mode === 'stage' && stage !== 'trial') s.wide = newWide()
  if (s.wide && opts.blockRules === SOLID_RULES) s.solids = solidsFor(stage)
  if (opts.anchorRules === ANCHOR_RULES) s.anchored = true
  if (opts.phantomRules === PHANTOM_RULES && s.anchored) s.phantom = true
  if (opts.breakRules === BREAK_RULES) s.breakOn = true
  if (build) s.build = newBuild()
  if (build2) s.build!.v2 = true
  if (build2 && opts.buffRules === BUFF_RULES) s.buffs = []
  if (build && opts.wallRules === WALL_RULES) s.build!.wall = true
  if (buildUp) s.build!.up = true
  // 처음 낸 69-BUILDUP 판(옛 기록)은 처음 수치 그대로 (HAEBI_BUILDUP.v1)
  if (buildUp && opts.buildUpRules === '69-BUILDUP') s.build!.upV1 = true
  if (opts.capRules === CAP_RULES) s.cap = { n: 0, gold: 0 }
  if (s.cap && (opts.awakeCapRules === AWAKECAP_RULES || opts.awakeCapRules === '70-AWAKECAP') && s.permanentAwake === true) { s.cap.top = C60.capLevel; if (opts.awakeCapRules === '70-AWAKECAP') s.cap.v1 = true }
  if (opts.chestRules === CHEST_RULES && mode === 'stage') s.jackpots = { pity: 0, five: 0, eight: 0, ranks: 0 }
  if (opts.bossChestRules === BOSSCHEST_RULES && s.jackpots) s.bossChest = true
  if (opts.bossDuelRules === BOSSDUEL_RULES && mode === 'stage') s.duel = true
  if (opts.bossHitRules === BOSSHIT_RULES && mode === 'stage') s.bossHit = true
  if (opts.paceRules === PACE_RULES && mode === 'stage') { s.pace = true; s.nextElite = PC.eliteFirst * ST[stage].length }
  if (mode === 'vanguard') {
    s.level = V.startLevel; s.ranks[k.primary] = 4; s.ranks[k.secondary] = 3; s.ranks.echo = 2; s.ranks.tempo = 1; s.ranks.reach = 1
    s.combos = kitCombos(kit).filter(c => c.kit === kit).map(c => c.id); s.message = '선봉에 서기 · 전위대장 3명을 돌파하라'
  }
  return s
}
export const usesPermanentAwakening = (s: HaebiRun) => s.permanentAwake !== undefined
/** 58-KITS 무기 개성 규칙으로 도는 판 */
export const usesKitRules = (s: HaebiRun) => s.kits !== undefined
/** 59-WIDE 넓은 맵으로 도는 판 */
export const usesWideMap = (s: HaebiRun) => s.wide !== undefined
/** 60-JACKPOT 상자 규칙으로 도는 판 */
export const usesJackpot = (s: HaebiRun) => s.jackpots !== undefined
export const usesAwakenedCast = (s: HaebiRun) => s.awakenedCasts !== undefined
export const castSlow = (c?: CastState | null) => c?.slow ?? U.slow
export const castWallSeconds = (c?: CastState | null) => c ? c.total / castSlow(c) : 0
export const isPermanentAwake = (s: HaebiRun) => s.permanentAwake === true
/** Snapshot external qualification/preferences once; replay never consults current storage. */
export function normalizedRaidOpts(s: HaebiRun, opts: HaebiOpts): HaebiOpts {
  return { ...opts, ...(opts.bonus ? { bonus: { ...opts.bonus } } : {}), ...(usesPermanentAwakening(s) ? { simRules: usesGiantBoss(s) ? giantRules(s) : usesPalisade(s) ? '56C' as const : usesAwakenedCast(s) ? '56B' as const : '56A' as const, permanentAwake: isPermanentAwake(s), appearanceAwake: s.appearanceAwake !== false } : {}), ...(usesKitRules(s) ? { kitRules: KIT_RULES } : {}), ...(usesJackpot(s) ? { chestRules: CHEST_RULES } : {}), ...(usesWideMap(s) ? { mapRules: MAP_RULES } : {}) }
}
/** 이 판의 거대 보스 — 거대 보스 흐름이 선 판은 여울(이무기) · 설원(백두 대호) · 목책 돌파(불가사리) · 숲 산길(구미호) · 불타는 산성(불의 무녀 장군)이라 스테이지로 갈린다 */
export const giantKind = (s: HaebiRun): GiantKind => s.stage === 'snow' ? 'tiger' : s.stage === 'palisade' ? 'bulgasari' : s.stage === 'forest' ? 'gumiho' : s.stage === 'fortress' ? 'shaman' : 'imugi'
export const giantRules = (s: HaebiRun) => { const kind = giantKind(s); return kind === 'tiger' ? '55-TIGER' as const : kind === 'bulgasari' ? '57-BULGASARI' as const : kind === 'gumiho' ? '55-GUMIHO' as const : kind === 'shaman' ? '55-SHAMAN' as const : '55-IMUGI' as const }
const pacingDuration = (s: HaebiRun) => s.mode === 'vanguard' ? V.duration : (C.duration + (s.mode === 'stage' ? CH.extraSeconds : 0)) * ST[s.stage].length
export const usesGiantBoss = (s: HaebiRun) => s.giantFlow !== undefined
/** 56-C 진짜 목책이 선 판 (목책 돌파 · 규칙 56C) */
export const usesPalisade = (s: HaebiRun) => s.palisade !== undefined
export const raidRulesForStage = (stage: StageId) => stage === 'ford' ? '55-IMUGI' as const : stage === 'palisade' ? '57-BULGASARI' as const : stage === 'snow' ? '55-TIGER' as const : stage === 'forest' ? '55-GUMIHO' as const : stage === 'fortress' ? '55-SHAMAN' as const : '56B' as const
export const runDuration = (s: HaebiRun) => usesGiantBoss(s) ? bossTime(s) + GI.fightBudget : pacingDuration(s)
export const midbossTime = (s: HaebiRun) => bossTime(s) * GI.midFraction
export const giantMob = (s: HaebiRun) => s.giantFlow?.finalOwner ?? s.enemies.find(e => e.giant)
export function giantHUD(s: HaebiRun) {
  const e = giantMob(s), g = e?.giant
  return e && g ? { id: e.id, name: giantName(g), hp: Math.max(0, e.hp), max: e.max, phase: g.phase, enraged: g.enraged, entry: Math.min(1, g.age / giantEntrySeconds(g)) } : null
}
/** Camera bounds need logging only at possible champion births, not on every camera-follow frame. */
export const championViewNeeded = (s: HaebiRun, dt: number) => s.mode === 'stage' && (s.giantFlow ? !s.giantFlow.midSpawned && s.t + dt >= midbossTime(s) || !s.giantFlow.finalSpawned && s.t + dt >= bossTime(s) || s.nextElite < bossTime(s) && s.t + dt >= s.nextElite : !s.boss && s.t + dt >= bossTime(s) || s.nextElite < bossTime(s) && s.t + dt >= s.nextElite)
/** 마지막 두목이 나오는 때 */
export const bossTime = (s: HaebiRun) => C.bossAt * ST[s.stage].length
/** 본편 각성 시련의 이긴 기록이 말이 되는가 — 시련 판의 두목 때 이후 · 판 길이 안 (11-16: 열전을 20분으로 늘린 뒤 본편이 옛 10분 기준으로 재서 시련 통과를 버리고 있었다) */
export const trialWinValid = (elapsed: unknown) => typeof elapsed === 'number' && Number.isFinite(elapsed) && elapsed >= C.bossAt * ST.trial.length && elapsed <= C.duration * ST.trial.length + 1
/** 지금 토막(0~4) — 토막마다 나오는 적이 바뀐다 */
export const tierOf = (s: HaebiRun) => Math.min(4, Math.floor(s.t / bossTime(s) * 5))
/** 50-1 일반 스테이지만 밀도가 오르내린다. 선택·정지 중엔 판 시계와 함께 멈춘다. */
export const respite = (s: HaebiRun) => s.mode === 'stage' && s.t % (C.surgeSeconds + C.respiteSeconds) >= C.surgeSeconds
export const rangedMob = (kind: MobKind) => ['archer', 'slinger', 'firearcher', 'hunter', 'torch', 'shaman'].includes(kind)
/** 발(판 좌표)이 실제 화면 안에 있는 살아 있는 궁수. 카메라를 읽는 쪽에서 범위를 넘긴다. */
/** 59-WIDE: 봇·옛 부름처럼 범위를 안 넘기면 장수 화면(1배) 틀로 잰다 */
const SIM_VIEW = { left: 0, top: 0, right: 0, bottom: 0 }
export function barrageArcher(s: HaebiRun, view: { left: number; top: number; right: number; bottom: number } = s.wide ? simView(s, SIM_VIEW) : { left: 0, top: 0, right: C.width, bottom: C.height }) {
  return s.enemies.find(e => e.kind === 'archer' && e.hp > 0 && e.flee === undefined && e.x >= view.left && e.x <= view.right && e.y >= view.top && e.y <= view.bottom)
}
/** 판이 끝나고 받는 금 (형 11-16: 「중간 패배는 적게, 다 깨면 클리어로 더 많이」) · 시련·선봉은 없음 */
export function runGold(s: HaebiRun) {
  if (s.mode !== 'stage') return 0
  const raw = s.kills * G.perKill + Math.floor(s.t / 60) * G.perMinute + (s.state === 'won' ? G.clear : 0)
  return Math.floor(raw * ST[s.stage].gold * (1 + s.bonus.greed * SH.greed.step)) + (s.chestGold ?? 0) + (s.cap?.gold ?? 0)
}

/** 최고 레벨 — 66-CAP 판은 HAEBI_CAP.capLevel(50) · 끈 판은 예전 44 */
export const maxLevel = (s: HaebiRun) => s.cap ? s.cap.top ?? CP.capLevel : C.maxLevel
/** 66-CAP 다음 레벨까지의 막대 (레벨 L) */
const capXp = (L: number) => CP.xpBase + L * CP.xpPerLevel + L ** 2 * CP.xpCurve
/**
 * 다음 레벨까지의 막대 — 70-AWAKECAP 판의 50~59 는 66 곡선 × (1 + xpRise × (L − 49)) ·
 * 60 뒤 넘침 보상은 66 판의 50 뒤와 같은 막대(capXp(50))마다 (회복·금이 나오는 빠르기가 같다)
 */
export const xpNeeded = (s: HaebiRun) => s.cap ? s.cap.top ? s.level >= s.cap.top ? capXp(CP.capLevel) : s.level >= CP.capLevel ? capXp(s.level) * (1 + (s.cap.v1 ? C60.v1.xpRise : C60.xpRise) * (s.level - CP.capLevel + 1)) : capXp(s.level) : CP.xpBase + s.level * CP.xpPerLevel + s.level ** 2 * CP.xpCurve : C.xpBase + s.level * C.xpPerLevel + s.level ** 2 * C.xpCurve
/** 레벨 힘 — 70-AWAKECAP 판의 51~60 은 레벨마다 levelPower × powerShare 만 */
export const powerScale = (s: HaebiRun) => (s.cap?.top ? 1 + (Math.min(s.level, CP.capLevel) - 1) * CP.levelPower + Math.max(0, s.level - CP.capLevel) * CP.levelPower * C60.powerShare : 1 + (s.level - 1) * (s.cap ? CP.levelPower : C.levelPower)) * (1 + s.bonus.might * SH.might.step)
export const areaScale = (s: HaebiRun) => 1 + s.ranks.reach * C.reachStep
/** 떨어진 기세를 끌어오는 둘레. 끝10단은 유한한 판 대각선으로 모든 자리를 덮는다. */
export const magnetRadius = (s: HaebiRun) => s.bonus.magnet >= SH.magnet.max ? Math.hypot(C.width, C.height) : C.dropMagnet * (1 + s.bonus.magnet * SH.magnet.step)
/** 열전 시간을 예전 10분 판의 시각으로 — 국면·적 몰려옴은 예전 10분 곡선을 판 길이만큼 늘린다 (11-16 형: 「10분보다 길어지더라도 즐기게」) */
const paced = (s: HaebiRun) => s.t * 600 / pacingDuration(s)
/** 마리/초 — 옛 곡선은 토막 사이가 계단 (3.2→5 · 9→13 · 18→23) · 76-PACE 는 세 계단을 rampPaced(예전 10분 시각) 동안 이어 간다 · 숲은 앞부분에 stageBoost 가 더 얹힌다 */
export const paceFade = (s: HaebiRun) => s.pace ? Math.max(0, 1 - paced(s) / PC.boostPaced) : 0
export function spawnRate(s: HaebiRun): number {
  const p = paced(s), early = (u: number) => C.spawnEarly + u / 70, mid = (u: number) => C.spawnMid + (u - 120) / 45, late = (u: number) => C.spawnLate + (u - 300) / 35
  if (!s.pace) return p < 120 ? early(p) : p < 300 ? mid(p) : p < 480 ? late(p) : C.spawnFeast
  const w = PC.rampPaced, line = (a: number, b: number, from: number) => a + (b - a) * (p - from) / w, boost = 1 + ((PC.stageBoost as Record<string, number>)[s.stage] ?? 0) * paceFade(s)
  return boost * (p < 120 ? early(p) : p < 120 + w ? line(early(120), mid(120 + w), 120) : p < 300 ? mid(p) : p < 300 + w ? line(mid(300), late(300 + w), 300) : p < 480 ? late(p) : p < 480 + w ? line(late(480), C.spawnFeast, 480) : C.spawnFeast)
}
export function phase(s: HaebiRun) { const u = paced(s); return s.mode === 'vanguard' ? `전위 돌파 ${s.breaches}/3` : u < 120 ? '첫 불씨' : u < 300 ? '힘의 결합' : u < 480 ? '폭풍의 진격' : s.t < bossTime(s) ? '압도' : '마지막 두목' }
export function comboReady(s: HaebiRun, c: typeof COMBOS[number]) { return Object.entries(c.needs).every(([k, v]) => s.ranks[k as Power] >= v) }
function announce(s: HaebiRun, text: string) { s.message = text; s.messageTime = 4 }
// ── 기술 나무 (RAID-LINK §2) ──
/** 조합 단계 — 열지 않았으면 0 · 연 조합은 1~T.max */
export const comboRank = (s: HaebiRun, id: Combo) => s.combos.includes(id) ? Math.max(1, s.comboRanks[id] ?? 1) : 0
/** 조합 단계가 그 효과에 곱하는 몫 (1단계 = 1) */
const cp = (s: HaebiRun, id: Combo) => 1 + (comboRank(s, id) - 1) * T.rankStep
/** 3층 비기 강화 — 이 묶음의 조합 하나라도 T.max 단계 */
export const ultUpgraded = (s: HaebiRun) => kitCombos(s.kit).some(c => comboRank(s, c.id) >= T.max)
/** 레벨업 카드로 나올 수 있는 조합 — 조건이 찼고 아직 T.max 아래 · fresh = 아직 안 연 것 */
export function comboChoices(s: HaebiRun) {
  // 60-JACKPOT: 이미 연 조합은 조건이 안 차도 다음 단계가 나온다 (중간 보스 상자가 조건 없이 열어 준 조합)
  const ready = kitCombos(s.kit).filter(c => (comboReady(s, c) || s.jackpots !== undefined && comboRank(s, c.id) > 0) && comboRank(s, c.id) < T.max)
  return { fresh: ready.filter(c => !comboRank(s, c.id)).map(c => c.id), more: ready.filter(c => comboRank(s, c.id) > 0).map(c => c.id) }
}
/** 레벨업 카드 셋 — 층이 열렸고 끝 단계가 아닌 칸에서 · 조합(금테)은 맨 끝 자리 · 첫 고름은 갈래마다 하나 */
function offer(s: HaebiRun) {
  const pool = runPowers(s).filter(k => s.ranks[k] < POWERS[k].max && nodeOpen(s, k))
  const { fresh, more } = comboChoices(s)
  if (!pool.length && !fresh.length && !more.length || s.level >= maxLevel(s)) return
  if (s.mode === 'stage') { s.choiceOrigin = 'level'; s.offerNonce = (s.offerNonce ?? 0) + 1 }
  if (s.level === 1) { const k = KITS[s.kit]; s.offers = ([k.secondary, k.primary, 'tempo'] as Power[]).filter(p => s.ranks[p] < POWERS[p].max); return }
  powerOffers(s, pool)
  // 조합 카드는 한 번에 하나 · 맨 끝 자리 — 새로 조건이 찬 조합은 늘, 연 조합의 다음 단계는 upgradeChance 몫으로
  const combo = fresh[0] ?? (more.length && random(s) < T.upgradeChance ? more[Math.floor(random(s) * more.length)] : undefined)
  if (combo) { if (s.offers.length >= 3) s.offers[s.offers.length - 1] = combo; else s.offers.push(combo) }
}
/** 칸 셋을 무게대로 뽑는다 — 무게 = 1 + lean × 그 갈래 점수 몫 (찍은 갈래로 끌림) · 셋이 다 주 갈래면 가운데를 다른 갈래 칸으로 (조합 카드가 끝을 덮어도 남게) */
function powerOffers(s: HaebiRun, pool: Power[]) {
  s.offers = []
  const branch = (p: Power) => nodeAt(s.kit, p)!.branch
  // 설치 갈래(d)는 65-BUILD 판에만 점이 있다 (꺼진 판은 0 이라 무게가 예전 그대로)
  const points = { a: branchPoints(s, 'a'), b: branchPoints(s, 'b'), c: branchPoints(s, 'c'), d: s.build ? branchPoints(s, 'd') : 0 }, total = points.a + points.b + points.c + points.d || 1
  const weight = (p: Power) => 1 + T.lean * points[branch(p)] / total
  const draw = (from: Power[]) => {
    let r = random(s) * from.reduce((n, p) => n + weight(p), 0)
    for (const p of from) { r -= weight(p); if (r < 0) return p }
    return from[from.length - 1]!
  }
  while (s.offers.length < 3 && s.offers.length < pool.length) s.offers.push(draw(pool.filter(k => !s.offers.includes(k))))
  const main = mainBranch(s), others = pool.filter(k => branch(k) !== main && !s.offers.includes(k))
  if (s.offers.length && others.length && s.offers.every(k => branch(k as Power) === main)) {
    if (s.offers.length < 3) s.offers.push(draw(others)); else s.offers[1] = draw(others)
  }
}
export function reroll(s: HaebiRun) { if (s.state !== 'playing' || s.choiceOrigin === 'chest' || s.level === 1 || !s.offers.length || s.rerolls <= 0) return false; s.rerolls--; offer(s); return true }
/** 상자가 올리는 차례 — ① 조건이 찬 새 조합 ② 연 조합의 다음 단계 ③ 높은 층 기술부터 (같은 층이면 많이 찍은 갈래) */
function chestOrder(s: HaebiRun): Pick[] {
  const { fresh, more } = comboChoices(s)
  const powers = kitPowers(s.kit).filter(p => nodeOpen(s, p) && s.ranks[p] < POWERS[p].max).sort((a, b) => {
    const x = nodeAt(s.kit, a)!, y = nodeAt(s.kit, b)!
    return y.tier - x.tier || branchPoints(s, y.branch) - branchPoints(s, x.branch)
  })
  return [...fresh, ...more, ...powers]
}
/** 60-JACKPOT 이번 상자의 단계 몫 [1개, 3개, 5개, 8개] — 5개 넘게 못 터진 상자마다 5개 몫이 오르고 그만큼 가장 낮은 단계에서 뺀다 (화면의 확률 표와 판의 굴림이 같은 셈) */
export function jackpotOdds(s: HaebiRun, fast: boolean): [number, number, number, number] {
  const base = fast ? JP.fast : JP.slow, p8 = base[3], p5 = Math.min(1 - p8, base[2] + (s.jackpots?.pity ?? 0) * JP.pityStep)
  const rest = Math.max(0, 1 - p8 - p5), p3 = base[0] > 0 ? Math.min(base[1], rest) : rest
  return [rest - p3, p3, p5, p8]
}
/** 60-JACKPOT 정예 상자 — 고르지 않고 터진다. 단계는 판의 시드 난수 한 번, 칸은 chestOrder 의 맨 앞을 하나 올릴 때마다 다시 셈한다. 올릴 칸이 없으면 엽전 */
function openJackpot(s: HaebiRun, chest: Chest) {
  const j = s.jackpots!, [p1, , p5, p8] = jackpotOdds(s, chest.large), r = random(s)
  const count = JP.counts[r < p8 ? 3 : r < p8 + p5 ? 2 : p1 > 0 && r >= 1 - p1 ? 0 : 1]
  const out: ChestJackpot = { count, picks: [], opened: [], bonus: 0 }
  for (let i = 0; i < count; i++) {
    const pick = chestOrder(s)[0], fresh = pick !== undefined && isCombo(pick) && !comboRank(s, pick)
    if (pick === undefined || !applyPick(s, pick)) { out.bonus += Math.floor(JP.spareGold * ST[s.stage].gold * (1 + s.bonus.greed * SH.greed.step)); continue }
    out.picks.push(pick); if (fresh) out.opened.push(pick as Combo)
  }
  if (count >= JP.counts[2]) { j.pity = 0; if (count >= JP.counts[3]) j.eight++; else j.five++ } else j.pity++
  j.ranks += out.picks.length; s.chestGold = (s.chestGold ?? 0) + out.bonus
  chest.jackpot = out; chest.state = 'claimed'; chest.choicesRemaining = 0
}
/**
 * 68-BOSSCHEST 보스 전리품 — 서로 다른 카드 셋까지: ① 안 연 조합(묶음 차례 · 뇌화 연옥 포함) ② 연 조합의 다음 단계 ③ 갈래 끝(capA·capB·capC) → 주 무기 → 나머지 칸 (상자 차례)
 * 셋 가운데 조합만 하나라도 다른 카드로 채워지니 뇌화 연옥 혼자 나오는 일은 올릴 칸이 하나도 남지 않았을 때뿐이다
 */
export function bossLoot(s: HaebiRun): Pick[] {
  const combos = kitCombos(s.kit), k = KITS[s.kit]
  const closed = combos.filter(c => !comboRank(s, c.id)).map(c => c.id)
  const more = combos.filter(c => comboRank(s, c.id) > 0 && comboRank(s, c.id) < T.max).map(c => c.id)
  const order = (p: Power) => p === 'capA' || p === 'capB' || p === 'capC' ? 0 : p === k.primary ? 1 : 2
  const powers = (chestOrder(s).filter(p => !isCombo(p)) as Power[]).map((p, i) => ({ p, i })).sort((a, b) => order(a.p) - order(b.p) || a.i - b.i).map(x => x.p)
  return [...closed, ...more, ...powers].slice(0, 3)
}
/** 지금 고르는 것이 68-BOSSCHEST 보스 전리품 창인가 (화면이 「보스 전리품 · 두 단계」 띠를 붙인다) */
export const bossLootOpen = (s: HaebiRun) => !!s.bossChest && s.choiceOrigin === 'chest' && !!s.chests?.find(c => c.id === s.chestChoice?.id)?.boss
function chestOffers(s: HaebiRun, chest: Chest) {
  // 60-JACKPOT 중간 보스 상자: 이 묶음의 아직 안 연 조합 셋까지 · 고르면 조건 없이 바로 열린다 (다 열었으면 아래 옛 차례대로 한 단계)
  const closed = chest.boss && !s.bossChest ? kitCombos(s.kit).filter(c => !comboRank(s, c.id)).map(c => c.id) : []
  s.offers = chest.boss && s.bossChest ? bossLoot(s) : closed.length ? closed.slice(0, 3) : chestOrder(s).slice(0, 3)
  if (!s.offers.length) {
    // 68-BOSSCHEST: 올릴 것이 하나도 없으면 큰 금 (빈 창을 띄우지 않는다)
    if (chest.boss && s.bossChest) {
      const gold = Math.floor(BC.gold * ST[s.stage].gold * (1 + s.bonus.greed * SH.greed.step))
      s.chestGold = (s.chestGold ?? 0) + gold; fx(s, 'ring', s.x, s.y, CP.ring, '#ffd66b'); s.fx[s.fx.length - 1]!.bossGold = gold
    }
    chest.state = 'claimed'; chest.choicesRemaining = 0; return false
  }
  s.choiceOrigin = 'chest'; s.offerNonce = (s.offerNonce ?? 0) + 1
  s.chestChoice = { id: chest.id, left: chest.choicesRemaining, nonce: s.offerNonce }
  return true
}
function pendingChest(s: HaebiRun) {
  if (s.offers.length || s.state !== 'playing') return false
  for (const c of s.chests ?? []) if (c.state === 'opened' && c.choicesRemaining > 0 && chestOffers(s, c)) return true
  delete s.chestChoice; if (s.mode === 'stage') s.choiceOrigin = 'level'
  return false
}
function collectChests(s: HaebiRun) {
  for (const c of s.chests ?? []) if (c.state === 'ground' && Math.hypot(c.x - s.x, c.y - s.y) < CH.chestRadius) {
    c.state = 'opened'; c.pickedAt = s.t; s.chestGold = (s.chestGold ?? 0) + c.gold; s.chestsClaimed = (s.chestsClaimed ?? 0) + 1
    if (s.jackpots && !c.boss) openJackpot(s, c)
  }
  pendingChest(s)
}
export function expireChests(s: HaebiRun) {
  for (const c of s.chests ?? []) if (c.state !== 'claimed') c.state = 'expired'
  delete s.chestChoice; s.offers = []; if (s.mode === 'stage') s.choiceOrigin = 'level'
  if (usesPermanentAwakening(s)) s.gritUltReady = false
  if (usesAwakenedCast(s)) s.ultReleaseSeq = 0
}
/** 카드 고르기 — 능력은 한 단계 · 조합은 처음이면 열고(금테) 다시 고르면 단계를 올린다 (자동 개방 없음) */
function applyPick(s: HaebiRun, key: Pick, force = false) {
  if (isCombo(key)) {
    const c = comboOf(key), rank = comboRank(s, key)
    // force = 60-JACKPOT 중간 보스 상자 (조건 없이 연다) · 그렇게 연 조합은 조건이 안 차도 다음 단계를 올린다
    if (rank >= T.max || !kitCombos(s.kit).some(x => x.id === key) || !(comboReady(s, c) || force && !rank || s.jackpots !== undefined && rank > 0)) return false
    // 조건 없이 열 때, 그 조합이 얹히는 무기가 아예 없으면 1단계로 같이 준다 (없는 무기 위의 조합은 아무 일도 안 한다)
    if (force && !rank) for (const p of Object.keys(c.needs) as Power[]) if (!s.ranks[p]) s.ranks[p] = 1
    if (!rank) s.combos.push(key)
    s.comboRanks[key] = rank + 1
    // 옛 규칙 판(기록 재생)은 옛 조합 이름 그대로 알린다 (판 상태가 바뀌지 않게 · old)
    const name = !s.kits && 'old' in c ? c.old : c.name
    announce(s, rank + 1 >= T.max ? `비기 강화 · ${KITS[s.kit].skill}` : rank ? `조합 강화 · ${name} ${rank + 1}단계` : `조합 개방 · ${name}`)
  } else {
    // 남의 묶음 칸 · 잠긴 층 · 끝 단계는 못 고른다
    if (!POWERS[key] || s.ranks[key] >= POWERS[key].max || !nodeOpen(s, key)) return false
    // 65-BUILD 종류 칸이 다 찼으면 새 종류는 못 고른다
    if (isBuildKind(key) && !buildChoices(s).includes(key)) return false
    s.ranks[key]++
    if (s.build && isBuildKind(key)) buildPicked(s, key)
    if (key === 'stout') { s.maxHp += T.stout; s.hp += T.stout }
    const at = nodeAt(s.kit, key)!
    if (at.branch !== 'd' && at.tier === T.tiers.length - 1 && s.ranks[key] === 1) announce(s, `갈래 끝 · ${nodeText(s.kit, key).name}`)
  }
  return true
}
export function choose(s: HaebiRun, key: Pick, nonce?: number) {
  if (s.state !== 'playing' || !s.offers.includes(key) || nonce !== undefined && nonce !== (s.offerNonce ?? 0)) return false
  const chest = s.choiceOrigin === 'chest' ? s.chests?.find(c => c.id === s.chestChoice?.id && c.state === 'opened' && c.choicesRemaining > 0) : null
  if (s.choiceOrigin === 'chest' && !chest || !chest && s.level >= maxLevel(s) || !applyPick(s, key, chest?.boss === true)) return false
  // 68-BOSSCHEST: 보스 전리품의 칸(조합 아님)은 한꺼번에 BC.ranks 단계 (끝 단계에서 멈춘다)
  if (chest?.boss && s.bossChest && !isCombo(key)) for (let i = 1; i < BC.ranks; i++) applyPick(s, key, true)
  s.offers = []
  if (chest) {
    chest.choicesRemaining--
    if (chest.choicesRemaining > 0 && chestOffers(s, chest)) return true
    chest.state = 'claimed'; delete s.chestChoice
    if (!pendingChest(s) && s.xp >= xpNeeded(s)) offer(s)
    return true
  }
  s.xp -= xpNeeded(s); s.level++; s.hp = Math.min(s.maxHp, s.hp + (s.cap ? CP.levelHeal : C.levelHeal))
  // 비기가 열리는 레벨에 닿았다 — 장수 둘레에 금빛 고리 (단추가 터지며 켜지는 것은 그리는 쪽 · 글 꼬리표는 없다)
  if (s.level === U.unlockLevel) fx(s, 'ring', s.x, s.y, U.unlockRing, '#ffd66b')
  if (!pendingChest(s) && s.xp >= xpNeeded(s)) offer(s)
  return true
}
// ── 판 안 각성 (RAID-LINK §1) ──
/** 다음 각성까지 모아야 하는 점 */
export const gaugeNeed = (s: HaebiRun) => A.need * (1 + s.wakes * A.needGrowth)
/** 막대 몫 0~1 — 각성(투지) 동안은 남은 시간 */
export const gaugeRatio = (s: HaebiRun) => s.form !== 'normal' ? s.formT / (s.form === 'awake' ? A.sec : A.gritSec) : Math.min(1, s.gauge / gaugeNeed(s))
/** Appearance is independent of strength. Legacy vanguard keeps its authored awakened appearance. */
export const awakenedLook = (s: HaebiRun) => usesPermanentAwakening(s) ? isPermanentAwake(s) && s.appearanceAwake !== false : s.form === 'awake' || s.mode === 'vanguard'
export const ultAwakened = (s: HaebiRun) => usesPermanentAwakening(s) ? isPermanentAwake(s) : s.form === 'awake'
export const ultEmpowered = (s: HaebiRun) => usesPermanentAwakening(s) ? s.ultEmpowered === true : s.trueUlt
/** 66-CAP 최고 레벨 뒤 기세 막대가 찰 때마다 비우고 — 최대 체력의 HAEBI_CAP.heal 몫을 되찾고 판 금을 받는다 (장수 둘레 금빛 고리에 금 액수를 싣는다) */
function capOverflow(s: HaebiRun) {
  while (s.xp >= xpNeeded(s)) {
    s.xp -= xpNeeded(s)
    const gold = Math.floor(CP.gold * ST[s.stage].gold * (1 + s.bonus.greed * SH.greed.step))
    s.hp = Math.min(s.maxHp, s.hp + s.maxHp * CP.heal); s.cap!.n++; s.cap!.gold += gold
    fx(s, 'ring', s.x, s.y, CP.ring, '#ffd66b'); s.fx[s.fx.length - 1]!.capGold = gold
  }
}
/** 지금 모습이 곱하는 몫 */
function formBoost(s: HaebiRun) {
  if (usesPermanentAwakening(s)) {
    const a = isPermanentAwake(s), grit = s.form === 'grit'
    return { power: (a ? A.permanent.power : 1) * (grit ? A.gritPower : 1), tempo: (a ? A.permanent.tempo : 1) * (grit ? A.gritTempo : 1), move: (a ? A.permanent.move : 1) * (grit ? A.gritMove : 1), ult: a ? A.permanent.ultRate : 1 }
  }
  return s.form === 'awake' ? { power: A.power, tempo: A.tempo, move: A.move, ult: A.ultRate } : s.form === 'grit' ? { power: A.gritPower, tempo: A.gritTempo, move: A.gritMove, ult: 1 } : { power: 1, tempo: 1, move: 1, ult: 1 }
}
/** 적을 잡아 막대를 채운다 — 다 차면 찬 채로 기다린다 (각성 단추 · 11-17 형) */
function fillGauge(s: HaebiRun, kind: MobKind) {
  if (s.mode === 'vanguard' && !usesPermanentAwakening(s) || s.form !== 'normal' || s.state !== 'playing') return
  s.gauge = Math.min(gaugeNeed(s), s.gauge + (kind === 'boss' ? A.boss : kind === 'elite' ? A.elite : A.kill))
}
/** 각성 단추를 누를 수 있나 — 막대가 다 찼고 보통 모습 · 시전 중이 아님 */
export const wakeReady = (s: HaebiRun) => (s.mode !== 'vanguard' || usesPermanentAwakening(s)) && s.state === 'playing' && s.form === 'normal' && !s.cast && s.gauge >= gaugeNeed(s)
/** 영웅의 투지 보호막이 처음 두르는 흡수량 (최대 체력의 gritShield 몫) — 체력 막대 덧막대 · 몸 둘레 방패 빛 */
export const wardMax = (s: HaebiRun) => s.maxHp * A.gritShield
/** 각성(본편 각성 장수) 또는 영웅의 투지 — 각성은 HAEBI_AWAKEN.cast 초 동안 컷인(시전)을 거쳐 둘레를 친다 · 투지는 최대 체력의 gritShield 몫 보호막을 두른다 */
function awaken(s: HaebiRun) {
  s.gauge = 0; s.wakes++
  if (usesPermanentAwakening(s)) s.gritUltReady = true
  const timedAwake = !usesPermanentAwakening(s) && s.canAwaken
  s.form = timedAwake ? 'awake' : 'grit'; s.formT = timedAwake ? A.sec : A.gritSec
  if (!timedAwake) { s.ward = wardMax(s); announce(s, '영웅의 투지 · 보호막이 몸을 감싼다'); fx(s, 'buff', s.x, s.y, 90, '#ffb35a'); fx(s, 'ring', s.x, s.y, A.gritShieldBurst, '#bfe8ff'); return }
  // 각성 컷인이 이름을 보여 주니 가운데 알림 띠는 띄우지 않는다
  s.cast = { kind: 'wake', t: A.cast, total: A.cast, tru: false }
}
/** 각성 시전이 끝나는 순간 둘레를 치고 밀어낸다 */
function wakeBurst(s: HaebiRun) {
  s.inv = Math.max(s.inv, C.skillInv)
  const r = A.burstRadius * areaScale(s), damage = A.burstDamage * powerScale(s)
  fx(s, 'ring', s.x, s.y, r, '#ffe08a')
  for (const e of s.enemies) if (e.hp > 0 && inRadius(e, s.x, s.y, r)) hit(s, e, damage)
  if (s.palisade) wallHit(s, disk(s.x, s.y, r), 'skill')
}
/** 비기 이름 — 각성 중엔 「진」 (11-17 형: 「진 하늘굿처럼 각성 기술로」) */
export const ultName = (kit: Kit, tru: boolean) => tru ? `진 ${KITS[kit].skill}` : KITS[kit].skill
function fx(s: HaebiRun, kind: Effect['kind'], x: number, y: number, r = 18, color = '#ffdba0', angle = 0, x2 = x, y2 = y) {
  if (s.fx.length >= C.maxFx) s.fx.shift()
  const life = kind === 'bolt' ? .24 : kind === 'death' ? .45 : kind === 'skill' ? .65 : .32
  s.fx.push({ kind, x, y, r, color, angle, x2, y2, life, total: life })
}
/** 맞는 쪽이 덜 받는 몫 — 무당이 북돋운 적 */
const guard = (e: Mob) => e.buff > 0 ? 1 - M.shamanArmor : 1
/** 밀리지 않는 적 — 두목 · 철갑 · 반달곰 */
const steady = (e: Mob) => !!e.champion || e.kind === 'boss' || e.kind === 'iron' || e.kind === 'bear'
/** 장수가 설 수 있는 판 안 */
/** 장수가 설 수 있는 자리로 — 한 장짜리 판은 예전 그대로(32 ~ 폭−32 · 65 ~ 높이−24) · 59-WIDE 는 지금 땅(안개 문이 닫히면 줄어든다)에 같은 여유 */
const heroX = (s: HaebiRun, x: number) => { const f = fieldBounds(s); return Math.max(f.left + 32, Math.min(f.right - 32, x)) }, heroY = (s: HaebiRun, y: number) => { const f = fieldBounds(s); return Math.max(f.top + 65, Math.min(f.bottom - 24, y)) }
const disk = (x: number, y: number, radius: number): Shape => ({ kind: 'circle', center: { x, y }, radius })
const lineShape = (x: number, y: number, cos: number, sin: number, length: number, width: number, back = width / 2): Shape => ({ kind: 'box', center: { x: x + cos * (length - back) / 2, y: y + sin * (length - back) / 2 }, halfX: (length + back) / 2, halfY: width, angle: Math.atan2(sin, cos) })
function giantContact(e: Mob, shape: Shape): Contact<string> | null {
  const g = e.giant
  return g ? contactOf(g, shape) : null
}
function aimAt(e: Mob, x: number, y: number): Point {
  if (!e.giant) return e
  let best: Point = e, d = Infinity
  for (const p of giantAimParts(e.giant)) {
    const q = closestPoint({ x, y }, p.collider), n = Math.hypot(q.x - x, q.y - y)
    if (n < d) { best = q; d = n }
  }
  return best
}
const mobDistance = (e: Mob, x: number, y: number) => { const q = aimAt(e, x, y); return Math.hypot(q.x - x, q.y - y) }
const inRadius = (e: Mob, x: number, y: number, r: number) => r <= 0 ? false : e.giant ? !!giantContact(e, disk(x, y, r)) : Math.hypot(e.x - x, e.y - y) < r
function defaultGiantContact(s: HaebiRun, e: Mob, origin: Point | null): Contact<string> | null {
  const at = origin ?? s, aim = aimAt(e, at.x, at.y)
  return giantContact(e, disk(aim.x, aim.y, 0))
}
function hit(s: HaebiRun, e: Mob, amount: number, knock = true, origin: { x: number; y: number } | null = { x: s.x, y: s.y }, geometry?: Shape | Contact<string>, periodic = false, primaryDirection?: number) {
  if (e.hp <= 0 || e.flee !== undefined) return
  const contact = e.giant ? geometry && 'partId' in geometry ? geometry : geometry ? giantContact(e, geometry as Shape) : defaultGiantContact(s, e, origin) : null
  if (e.giant && !contact) return
  if (COLLECT.on) COLLECT.hits.push(e)
  const recoveryHit = e.giant ? !periodic && e.giant.state === 'recover' && !e.giant.recoveryHitUsed : !!e.champion && (e.recovery ?? 0) > 0 && !e.champion.recoveryHitUsed
  if (recoveryHit) { if (e.giant) giantRecoveryHit(e.giant); else e.champion!.recoveryHitUsed = true }
  // 급소 (상점 「행운」) — 강화가 없으면 난수를 뽑지 않는다 (예전 판과 같은 차례)
  const crit = !periodic && s.bonus.luck > 0 && random(s) < s.bonus.luck * SH.luck.step
  amount *= guard(e) * (crit ? 2 : 1) * championDamageScale(e, origin)
  if (e.giant && contact) {
    // 64-BREAK: 부서져 멈춰 선 동안 더 아프다
    if (s.breakOn && e.daze > 0) amount *= BR.groggyDamage
    // 부위가 처음 부서지면(백두 대호) 아파서 포효한다 — 맞은 자리에 등장·포효와 같은 큰 반응
    let brokeId: string | null = giantStruck(e.giant, contact.partId, amount) ? contact.partId : null
    // 64-BREAK: 몸통(체력 칸 없는 조각)에 맞으면 가장 가까운 성한 부위로도 번진다 — 범위 공격만으로도 부위가 깨진다
    if (s.breakOn && !periodic && giantHpKey(e.giant, contact.partId) === null) { const near = nearestLiveHpPart(e.giant, contact.point); if (near && giantStruck(e.giant, near.id, amount * BR.spill)) brokeId = near.id }
    if (brokeId !== null) {
      fx(s, 'ring', contact.point.x, contact.point.y, 65, '#e8dcc0'); s.fx[s.fx.length - 1]!.championCue = 'roar'
      if (s.breakOn) {
        // 큰 부위(머리·팔·다리)는 그로기 · 작은 부위(꼬리 마디 등)는 잠깐 휘청 — 꼬리마다 멈추면 보스가 너무 자주 선다
        const key = giantHpKey(e.giant, brokeId), max = key === null ? 0 : (e.giant.partMax as Record<string, number>)[key] ?? 0
        e.daze = Math.max(e.daze, max >= e.max * BR.majorShare ? BR.groggy : BR.groggyMinor); s.fx[s.fx.length - 1]!.partBreak = true
      }
    }
    amount *= contact.weakScale
  }
  if (BUILD_TALLY.src) BUILD_TALLY.dealt += Math.min(e.hp, amount)
  s.damage += Math.min(e.hp, amount); e.hp -= amount; e.flash = .12
  if (knock && !steady(e)) { const d = Math.hypot(e.x - s.x, e.y - s.y) || 1, ox = e.x, oy = e.y; e.x += (e.x - s.x) / d * C.knockback; e.y += (e.y - s.y) / d * C.knockback; if (s.palisade) wallMove(s.palisade, e, ox, oy, mobRadius(e)) }
  const hitX = contact?.point.x ?? e.x, hitY = contact?.point.y ?? e.y
  // 피해 숫자 (형 11-16: 「한방이라 강해지는지 모르겠다」) — 맞은 자리의 이펙트에 실어 화면이 띄운다
  if (e.hp > 0) { if (periodic) return; fx(s, 'hit', hitX, hitY - 22); Object.assign(s.fx[s.fx.length - 1]!, { n: amount, crit }); if (recoveryHit) s.fx[s.fx.length - 1]!.recoveryHit = true; return }
  s.kills++; s.comboKills++; s.streakTime = 2; s.hp = Math.min(s.maxHp, s.hp + C.killHeal); if (e.kind === 'elite') s.elites++
  if (e.giant) endGiant(e.giant, e, Math.round(s.t * 120))
  fx(s, 'death', hitX, hitY - 20, e.kind === 'boss' ? 80 : 25, '#d4af76')
  Object.assign(s.fx[s.fx.length - 1]!, { mob: e.kind, face: s.x < e.x ? -1 : 1, n: amount, crit })
  if (primaryDirection !== undefined) tagCriticalFinish(s.fx[s.fx.length - 1]!, primaryDirection)
  if (recoveryHit) s.fx[s.fx.length - 1]!.recoveryHit = true
  if (s.mode === 'stage' && (e.kind === 'elite' || e.bossRole === 'midboss')) {
    const large = e.bornAt !== undefined && s.t - e.bornAt <= CH.fastSeconds
    const gold = Math.floor(G.perElite * ST[s.stage].gold * (1 + s.bonus.greed * SH.greed.step))
    s.chests!.push({ id: s.nextChestId!++, eliteId: e.id, x: e.x, y: e.y, bornAt: s.t, state: 'ground', choicesRemaining: s.jackpots ? e.bossRole === 'midboss' ? 1 : 0 : large ? 2 : 1, gold, large, ...(s.jackpots && e.bossRole === 'midboss' ? { boss: true } : {}) })
  }
  let value = e.kind === 'boss' ? 100 : e.kind === 'elite' ? 45 : M[e.kind].xp
  // 65-BUILD 기세 항아리: 둘레에서 쓰러진 적은 기세를 더 준다
  if (s.build) { const k = jarBonusAt(s.build, s.ranks.jar, e.x, e.y, BU.flash); s.build.jarXp += value * (k - 1); value *= k }
  // 판 위 기세 알이 끝까지 차면 가장 가까운 알에 보탠다 (그냥 주면 멀리서도 먹힌다)
  if (s.drops.length >= C.maxDrops) { let best = s.drops[0]!, bd = Infinity; for (const d of s.drops) { const n = Math.hypot(d.x - e.x, d.y - e.y); if (n < bd) { bd = n; best = d } } best.value += value; best.age = 0 }
  else s.drops.push({ x: e.x, y: e.y, value, age: 0 })
  if (e.bossRole === 'midboss') { s.giantFlow!.midDefeated = true }
  else if (e.kind === 'boss') {
    if (e.giant) s.giantFlow!.finalDefeated = true
    if (s.mode === 'vanguard') { s.breaches++; announce(s, `전위대장 격파 · ${s.breaches}/3 돌파 확보`) }
    if (s.mode !== 'vanguard' || s.breaches === 3) { s.state = 'won'; s.offers = []; announce(s, s.mode === 'vanguard' ? '전위 완전 돌파 · 본대가 진격한다' : `${e.giant ? giantName(e.giant) : ST[s.stage].bossName} 격파 · 토벌 완료`) }
  }
  fillGauge(s, e.kind)
}
// ── 56-C 목책 (raid/palisade.ts · 목책 돌파 판에만) ──
/** 목책에 부딪히는 몸 반지름 — 정예·두목은 크게 */
const mobRadius = (e: Mob) => e.kind === 'elite' || e.kind === 'boss' ? WL.bigR : WL.mobR
/** 문으로 돌 때 거쳐 갈 자리 — 판마다 다시 쓰는 그릇 (판 상태가 아니다) */
const AIM = { x: 0, y: 0 }
/** 마디를 깎는다 — 번쩍이 꺼져 있을 때만 작은 불꽃(fx hit · 맞은 소리) · 부서지면 흙먼지(fx thud) */
function wallDamage(s: HaebiRun, p: WallPiece, amount: number, x: number) {
  const P = s.palisade!, quiet = p.flash > 0
  if (damagePiece(P, p, amount, s.t)) { fx(s, 'thud', (p.x0 + p.x1) / 2, P.y, (p.x1 - p.x0) * WL.breakDust, '#c9a27a'); return }
  if (!quiet) fx(s, 'hit', x, P.y - WL.hitLift)
}
/**
 * 장수의 공격·비기 모양에 닿은 목책 마디를 깎는다 — 한 번에 그 갈래의 정한 값(HAEBI_PALISADE.hit · 레벨과 무관).
 * 공격의 피해 숫자는 쓰지 않는다(무기 단계·조합으로 수십 배가 된다) · 터짐은 마디가 번쩍이는 동안 다시 안 깎는다 · 날아가는 것은 넘어가니 부르지 않는다.
 */
function wallHit(s: HaebiRun, shape: Shape, source: keyof typeof WL.hit) {
  if (s.palisade) piecesHit(s.palisade, shape, (p, x) => { if (source !== 'splash' || p.flash <= 0) wallDamage(s, p, WL.hit[source], x) })
}
/** 밀려난 적이 목책을 뚫고 넘어가지 않게 (밀기 전 자리에서 잰다) */
function pushMob(s: HaebiRun, e: Mob, dx: number, dy: number) {
  const ox = e.x, oy = e.y; e.x += dx; e.y += dy
  if (s.palisade) wallMove(s.palisade, e, ox, oy, mobRadius(e))
}
/** 장수가 막은 마디 쪽으로 밀면 내려친다 (내가 부수면 지름길) — 미는 방향이 마디 쪽으로 bashPush 이상 · bashEvery ÷ 맹공 마다 */
function heroBash(s: HaebiRun, p: WallPiece, dx: number, dy: number, power: number, tempo: number) {
  const P = s.palisade!
  if (p.hp <= 0 || P.bashCd > 0) return
  const cx = Math.max(p.x0, Math.min(p.x1, s.x)), cy = Math.max(P.y - WL.depth, Math.min(P.y + WL.depth, s.y)), vx = cx - s.x, vy = cy - s.y
  if ((dx * vx + dy * vy) / (Math.hypot(vx, vy) || 1) < WL.bashPush) return
  P.bashCd = WL.bashEvery / tempo; s.attack = .3
  if (Math.abs(vx) > 1) s.face = vx < 0 ? -1 : 1
  wallDamage(s, p, WL.bash * power, cx)
}
/** 정예·두목이 성한 마디에 막혔다 — 밀면 초마다 깎고(두목은 크게 · 정예는 문으로 돌다 걸린 만큼) · 돌진이 박히면 한 번 크게 깎고 돌진을 멈춰 비틀거린다 */
function championWall(s: HaebiRun, e: Mob, ox: number, oy: number, dashing: boolean, dt: number, hooks: ChampionHooks) {
  const p = wallMove(s.palisade!, e, ox, oy, WL.bigR)
  if (!p || p.hp <= 0) return
  const x = Math.max(p.x0, Math.min(p.x1, e.x))
  if (dashing && e.champion!.mode === 'dash') { wallDamage(s, p, WL.champDash, x); championRecover(e, hooks); return }
  wallDamage(s, p, (e.kind === 'boss' ? WL.bossBash : WL.champBash) * dt, x)
}
function blast(s: HaebiRun, x: number, y: number, radius: number, damage: number, color = '#ff995e') {
  fx(s, 'blast', x, y, radius, color)
  for (const e of s.enemies) if (inRadius(e, x, y, radius)) hit(s, e, damage, true, { x, y }, disk(x, y, radius))
  if (s.palisade) wallHit(s, disk(x, y, radius), 'splash')
}
/** 59-WIDE: 장수가 겨눌 수 있는 적 — 장수 화면(1배)에 둘레 여유를 더한 틀 안 (화면 밖 먼 적을 저절로 쏘지 않는다 · 한 장짜리 판은 판 전체 = 예전 그대로 · 거대 보스는 늘) */
const aimable = (s: HaebiRun, e: Mob) => !s.wide || !!e.giant || inSimView(s, e.x, e.y, -WD.spawnMargin)
function nearest(s: HaebiRun, x: number, y: number, excluded: number[] = [], radius = Infinity, seen = false) {
  let best: Mob | undefined, d = radius
  for (const e of s.enemies) { if (e.hp <= 0 || e.flee !== undefined || excluded.includes(e.id)) continue; if (e.giant && !giantHasTarget(e.giant)) continue; if (seen && !aimable(s, e)) continue; const n = mobDistance(e, x, y); if (n < d) { d = n; best = e } }
  return best
}
const SPEED: Partial<Record<Missile['kind'], number>> = { pebble: 0, skip: C.skipSpeed, boulder: C.boulderSpeed, enemy: C.enemyShotSpeed, arrow: C.bowSpeed, javelin: C.javelinSpeed, wave: C.waveSpeed, rain: 0, barrage: 0, stone: 0, flame: 0, knife: C.knifeSpeed, soul: C.soulSpeed, hurl: M.hunterSpeed, tower: BU.tower.speed, signal: 0, lob: 0 }
const LIFE: Partial<Record<Missile['kind'], number>> = { pebble: C.slingFlight, enemy: C.enemyShotLife, skip: C.skipLife, boulder: C.boulderLife, arrow: C.bowLife, javelin: C.javelinLife, wave: C.waveLife, rain: C.rainDelay, barrage: C.barrageDelay, stone: M.lobDelay, flame: M.flameLife, knife: C.knifeLife, soul: C.soulLife, hurl: M.hunterLife, tower: BU.tower.life0 }
/** 투사체 종류의 처음 수명(초) — 보는 쪽이 발사 직후 손끝 보정을 잴 때 같은 값을 쓴다 */
export const missileLife = (kind: Missile['kind']) => LIFE[kind] ?? C.galeLife
const RADIUS: Partial<Record<Missile['kind'], number>> = { skip: 14, boulder: C.boulderRadius, gale: 25, wave: C.waveRadius, javelin: 16, arrow: 10, barrage: C.barrageRadius, stone: M.lobRadius, flame: M.flameRadius, knife: 12, soul: 16, tower: BU.tower.radius }
function shoot(s: HaebiRun, kind: Missile['kind'], angle: number, damage: number, x = s.x, y = s.y, tx = x, ty = y, gen = 0) {
  if (s.shots.length >= C.maxShots) return undefined
  const speed = SPEED[kind] ?? C.galeSpeed
  const b: Missile = { x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: LIFE[kind] ?? C.galeLife, kind, damage, radius: RADIUS[kind] ?? 12, hit: [], angle, tx, ty }
  if (gen) b.gen = gen
  s.shots.push(b); return b
}
/** 한 번 꿰뚫고 멈추는 수 — 도끼 묶음(gale·shard)은 예전 그대로 */
function pierce(s: HaebiRun, b: Missile) {
  if (b.kind === 'tower') return 1   // 65-BUILD 망루 화살은 첫 적에서 멈춘다
  if (b.big && b.kind === 'arrow') return Infinity   // 58-KITS 겨눔 화살 · 일제 사격
  if (b.kind === 'knife') return C.knifePierce + Math.floor(s.ranks.knife / 3)
  if (b.kind === 'soul') return 1
  if (b.kind === 'skip') return C.skipBounces + Math.ceil(s.ranks.skip / 2) + (s.kit === 'sling' ? s.ranks.capB * T.cap.sling.b.bounces : 0)
  if (b.kind === 'arrow' && s.kit === 'bow' && s.ranks.capA) return Infinity   // 관통일제 (갈래 끝)
  if (b.kind === 'boulder') return Infinity
  return b.kind === 'shard' ? 2 : b.kind === 'arrow' ? C.bowPierce + Math.floor(s.ranks.bow / 2) : b.kind === 'javelin' ? C.javelinPierce + s.ranks.javelin : b.kind === 'wave' ? Infinity : 3 + s.ranks.gale
}
/** 잡졸 체력 — 시간이 갈수록 두꺼워진다 (스테이지 hp 배수) */
const mobHp = (s: HaebiRun) => C.mobHp * (1 + s.t * C.hpTimeScale + (s.t / 60) ** 2 * C.hpTimeCurve) * ST[s.stage].hp
/** 59-WIDE 자리 셈을 받는 그릇 (판 상태가 아니다) */
const SPOT = { x: 0, y: 0 }
export function spawnMob(s: HaebiRun, kind?: Mob['kind'], view?: SpawnView, single = false) {
  const side = Math.floor(random(s) * 4), p = random(s)
  if (s.mode === 'vanguard') kind ??= random(s) < C.archerShare + s.t * C.archerTimeShare ? 'archer' : 'club'
  else if (!kind) { const [a, b] = ST[s.stage].tiers[tierOf(s)]!; const share = s.mode === 'stage' && rangedMob(b) ? Math.min(M[b].share, C.stageRangedShare) : M[b].share; kind = random(s) < share ? b : a }
  const hp = kind === 'boss' ? (s.mode === 'vanguard' ? V.captainHp[Math.min(2, s.captains)]! : C.bossHp * ST[s.stage].bossHp) : kind === 'elite' ? C.eliteHp * (1 + s.t / pacingDuration(s)) * ST[s.stage].hp : s.mode === 'vanguard' ? V.mobHp : mobHp(s) * M[kind].hp
  // 산들개는 한쪽에서 떼로 몰려온다
  const pack = kind === 'dog' && !single ? M.dogPack : 1
  const bounds = s.mode === 'stage' && (kind === 'elite' || kind === 'boss') ? spawnView(view) : spawnView()
  // 59-WIDE: 잡졸은 장수 화면 바로 밖 둘레에 · 정예는 멀리(큰 놈 사냥 · 화살표가 가리킨다) · 두목(중간 보스)은 닫힌 결전장에 예전 그대로
  const hunt = !!s.wide && kind === 'elite', spot = !!s.wide && kind !== 'boss'
  if (hunt) huntSpot(s, (side + p) * Math.PI / 2, random(s), SPOT); else if (spot) ringSpot(s, side, p, SPOT)
  for (let i = 0; i < pack; i++) {
    const e: Mob = { id: s.next++, x: (spot ? SPOT.x : side === 0 ? bounds.left + 15 : side === 1 ? bounds.right - 15 : bounds.left + p * (bounds.right - bounds.left)) + i * 9,
      y: (spot ? SPOT.y : side === 2 ? bounds.top + 24 : side === 3 ? bounds.bottom - 15 : bounds.top + 40 + p * (bounds.bottom - bounds.top - 55)) + (i % 2) * 14,
      hp, max: hp, kind, cd: 2, flash: 0, wind: 0, aimX: 0, aimY: 0, act: 0, vx: 0, vy: 0, buff: 0, poison: 0, pdps: 0, daze: 0 }
    initChampion(s, e); s.enemies.push(e)
    if (hunt) e.unseen = true
    if (s.palisade) wallSettle(s.palisade, e, mobRadius(e))   // 목책 띠 안에서 태어나면 가까운 쪽으로
    if (e.champion) { fx(s, 'ring', e.x, e.y - 20, 65, '#e8dcc0'); s.fx[s.fx.length - 1]!.championCue = 'enter' }
  }
}
/** One parent Mob. The thirteen parts never enter enemies or allocate rewards. */
export function spawnGiant(s: HaebiRun, view?: SpawnView): Mob | undefined {
  if (!s.giantFlow || s.giantFlow.finalSpawned) return undefined
  const kind = giantKind(s), hp = giantMaxHp(kind), bounds = spawnView(view), e: Mob = { id: s.next++, x: (bounds.left + bounds.right) / 2, y: (bounds.top + bounds.bottom) / 2, hp, max: hp, kind: 'boss', cd: 0, flash: 0, wind: 0, aimX: 0, aimY: 0, act: 0, vx: 0, vy: 0, buff: 0, poison: 0, pdps: 0, daze: 0, bornAt: s.t, bossRole: 'giant' }
  // 불가사리는 목책의 큰 문으로 들어온다 (목책 · 장수 쪽을 넘긴다 · 다른 거대 보스는 쓰지 않는다)
  e.giant = kind === 'bulgasari' ? createGiant(kind, e, Math.round(s.t * 120), s.palisade, s.x) : createGiant(kind, e, Math.round(s.t * 120)); s.enemies.push(e)
  if (s.breakOn) { const hp = e.giant.partHP as Record<string, number>, max = (e.giant as { partMax?: Record<string, number> }).partMax; for (const k of Object.keys(hp)) { hp[k] = hp[k]! * BR.partScale; if (max && k in max) max[k] = max[k]! * BR.partScale } }
  s.giantFlow.finalSpawned = true; s.giantFlow.finalOwner = e; s.boss = true
  fx(s, 'ring', e.x, e.y, 65, '#e8dcc0'); s.fx[s.fx.length - 1]!.championCue = 'enter'
  return e
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
function hurt(s: HaebiRun, amount: number, floor = 0) {
  // 무적: 회피·비기 뒤 · 시전 중 · 각성 동안 (11-17 형: 「각성하면 무적」)
  if (s.inv > 0 || s.cast || !usesPermanentAwakening(s) && s.form === 'awake') return
  let loss = Math.max(1, amount * ST[s.stage].damage * (1 - s.ranks.tough * T.tough) - s.bonus.armor * SH.armor.step); s.inv = C.hitInv
  // 72-BOSSHIT 보스의 큰 공격: 최대 체력의 몫 아래로 안 내려간다 (단련은 그대로 줄인다)
  if (floor > 0) loss = Math.max(loss, floor * s.maxHp * (1 - s.ranks.tough * T.tough))
  // 영웅의 투지 보호막이 먼저 받는다 · 다 깎이면 깨지는 빛
  if (s.ward > 0) { const took = Math.min(s.ward, loss); s.ward -= took; loss -= took; if (s.ward <= 0) { s.ward = 0; fx(s, 'ring', s.x, s.y, A.gritShieldBurst, '#bfe8ff') } }
  if (loss > 0) { s.hp -= loss; s.hurt = .3 }
  // 되받아치기 (버팀 끝): 맞으면 다음 걸음에 비기가 작게 터진다
  if (s.ranks.capC && !s.cool.counter) { s.counterDue = true; s.cool.counter = T.counterCd - T.counterCdStep * (s.ranks.capC - 1) }
}
/** 시간이 갈수록 적 한 대가 아파진다 — 가만히 서서 고르기만 해도 깨지 않게 (형 11-15) */
const threat = (s: HaebiRun) => 1 + s.t * C.threatTimeScale
function won(s: HaebiRun) { return s.state === 'won' }
/** 주 무기 — 가장 가까운 적을 향해 (도끼 묶음은 예전 해비 코드 그대로) · 3층 벼리기가 피해를 · 4층 갈래 끝(capA)이 꼴을 바꾼다 */
function primary(s: HaebiRun, target: Mob, angle: number, dist: number, power: number, area: number, tempo: number) {
  const cos = Math.cos(angle), sin = Math.sin(angle), cap = s.ranks.capA
  power *= 1 + s.ranks.hone * T.hone
  if (s.kit === 'axe') {
    const reach = (C.axeRange + C.axeRankRange * s.ranks.axe) * area
    if (!s.cool.axe && dist < reach) {
      s.cool.axe = C.axeCooldown / tempo; s.attack = .3; s.face = Math.cos(angle) < 0 ? -1 : 1
      fx(s, 'slash', s.x, s.y, reach, '#ffe2a0', angle)
      const damage = (C.axeDamage + C.axeRankDamage * s.ranks.axe) * power
      for (const e of s.enemies) if (e.giant || Math.hypot(e.x - s.x, e.y - s.y) < reach && (s.ranks.axe >= 4 || (e.x - s.x) * Math.cos(angle) + (e.y - s.y) * Math.sin(angle) > -30)) hit(s, e, damage, true, undefined, s.ranks.axe >= 4 ? disk(s.x, s.y, reach) : { kind: 'diskCap', center: { x: s.x, y: s.y }, radius: reach, angle, minAlong: -30 }, false, cos < 0 ? -1 : 1)
      if (s.palisade) wallHit(s, s.ranks.axe >= 4 ? disk(s.x, s.y, reach) : { kind: 'diskCap', center: { x: s.x, y: s.y }, radius: reach, angle, minAlong: -30 }, 'melee')
      if (cap) {
        // 대지파쇄: 내려친 쪽으로 땅이 길게 갈라져 그 줄을 모두 벤다
        const c = T.cap.axe.a, length = c.length * area, width = c.width * area
        fx(s, 'thrust', s.x, s.y, length, '#d9a85a', angle)
        for (const e of s.enemies) if (e.hp > 0 && inLine(s.x, s.y, e, cos, sin, length, width)) hit(s, e, damage * capShare(cap, c), false, undefined, lineShape(s.x, s.y, cos, sin, length, width))
        if (s.palisade) wallHit(s, lineShape(s.x, s.y, cos, sin, length, width), 'melee')
      }
    }
  } else if (s.kit === 'bow') {
    if (!s.cool.bow && dist < C.bowRange * area) {
      s.cool.bow = C.bowCooldown / tempo; s.attack = .3; s.face = cos < 0 ? -1 : 1
      // 관통일제: 단계마다 extra 대 더 (모두 꿰뚫기는 pierce)
      const count = 1 + Math.floor(s.ranks.bow / 3) + cap * T.cap.bow.a.extra, damage = (C.bowDamage + C.bowRankDamage * s.ranks.bow) * power * K.bow.base * (cap ? capShare(cap, T.cap.bow.a) : 1)
      for (let i = 0; i < count; i++) { const b = shoot(s, 'arrow', angle + (i - (count - 1) / 2) * .12, damage); tagPrimaryShot(b) }
    }
  } else if (s.kit === 'spear') {
    const length = (C.spearLength + C.spearRankLength * s.ranks.spear) * area, width = C.spearWidth * area * (s.ranks.spear >= 4 ? 1.6 : 1)
    if (!s.cool.spear && dist < length) {
      s.cool.spear = C.spearCooldown / tempo; s.attack = .3; s.face = cos < 0 ? -1 : 1
      const damage = (C.spearDamage + C.spearRankDamage * s.ranks.spear) * power, side = cap ? capShare(cap, T.cap.spear.a) : 0
      // 삼방관통(갈래 끝): 앞과 양옆(spread) 세 방향 · 옆 찌르기는 share 몫
      const prongs: [number, number][] = cap ? [[angle, 1], [angle + T.cap.spear.a.spread, side], [angle - T.cap.spear.a.spread, side]] : [[angle, 1]]
      const giantUsed = new Set<number>()
      for (const [a, k] of prongs) {
        const c = Math.cos(a), n = Math.sin(a)
        fx(s, 'thrust', s.x, s.y, length, '#ffe2a0', a)
        for (const e of s.enemies) {
          const ex = e.x - s.x, ey = e.y - s.y, along = ex * c + ey * n
          if (e.giant ? !giantUsed.has(e.id) : along > -12 && along < length && Math.abs(ey * c - ex * n) < width) {
            const shape = lineShape(s.x, s.y, c, n, length, width, 12)
            if (!e.giant || giantContact(e, shape)) { hit(s, e, damage * k, true, undefined, shape, false, c < 0 ? -1 : 1); if (e.giant) giantUsed.add(e.id) }
          }
        }
        if (s.palisade) wallHit(s, lineShape(s.x, s.y, c, n, length, width, 12), 'melee')
      }
    }
  } else if (s.kit === 'dagger') {
    // 쌍단검: 짧게 아주 빠르게 · 4단계부터 등 뒤까지 · 맹독쌍검(갈래 끝)은 찌른 적에 독
    const reach = (C.daggerRange + C.daggerRankRange * s.ranks.dagger) * area
    if (!s.cool.dagger && dist < reach) {
      s.cool.dagger = C.daggerCooldown / tempo; s.attack = .3; s.face = cos < 0 ? -1 : 1
      fx(s, 'slash', s.x, s.y, reach, '#f1e4c0', angle)
      const damage = (C.daggerDamage + C.daggerRankDamage * s.ranks.dagger) * power
      for (const e of s.enemies) {
        const ex = e.x - s.x, ey = e.y - s.y, d = Math.hypot(ex, ey) || 1
        if (e.giant || d < reach && (s.ranks.dagger >= 4 || (ex * cos + ey * sin) / d > C.daggerArc)) {
          const shape: Shape = s.ranks.dagger >= 4 ? disk(s.x, s.y, reach) : { kind: 'cone', center: { x: s.x, y: s.y }, radius: reach, angle, halfAngle: Math.acos(C.daggerArc) }
          if (e.giant && !giantContact(e, shape)) continue
          hit(s, e, damage, true, undefined, shape, false, ex < 0 ? -1 : 1)
          if (cap && e.hp > 0) { if (e.giant) giantPoisonFromLastHit(e.giant); e.poison = Math.max(e.poison, T.cap.dagger.a.poison); e.pdps = Math.max(e.pdps, damage * capShare(cap, T.cap.dagger.a)) }
        }
      }
      if (s.palisade) wallHit(s, s.ranks.dagger >= 4 ? disk(s.x, s.y, reach) : { kind: 'cone', center: { x: s.x, y: s.y }, radius: reach, angle, halfAngle: Math.acos(C.daggerArc) }, 'melee')
    }
  } else if (s.kit === 'sling') {
    // 돌팔매: 가까운 적(돌 수만큼 서로 다른 적)이 선 자리로 돌이 포물선을 그리며 slingFlight 초 만에 떨어진다 · 떨어진 둘레를 친다 (땅울림은 떨어질 때)
    if (!s.cool.sling && dist < C.slingRange * area) {
      s.cool.sling = C.slingCooldown / tempo; s.attack = .3; s.face = cos < 0 ? -1 : 1
      const used: number[] = [], damage = (C.slingDamage + C.slingRankDamage * s.ranks.sling) * power
      for (let i = 0; i < 1 + Math.floor(s.ranks.sling / 3); i++) {
        const e = i ? nearest(s, s.x, s.y, used, C.slingRange * area) : target; if (!e) break
        used.push(e.id)
        const aim = aimAt(e, s.x, s.y)
        const b = shoot(s, 'pebble', Math.atan2(aim.y - s.y, aim.x - s.x), damage, s.x, s.y, aim.x, aim.y)
        if (b) { b.vx = (aim.x - s.x) / C.slingFlight; b.vy = (aim.y - s.y) / C.slingFlight; b.radius = (C.slingSplash + C.slingRankSplash * s.ranks.sling) * area * (s.ranks.sling >= 4 ? C.slingWide : 1); tagPrimaryShot(b) }
      }
    }
  } else if (s.kit === 'magic') {
    // 방울 파동: 방향 없이 둘레 전체 · 신령 부르기(갈래 끝)는 울릴 때마다 혼불이 단계 수만큼
    const r = (C.bellRadius + C.bellRankRadius * s.ranks.bell) * area
    if (!s.cool.bell && dist < r) {
      s.cool.bell = C.bellCooldown / tempo; s.attack = .3
      fx(s, 'ring', s.x, s.y, r, '#f3dc8a')
      for (const e of s.enemies) if (inRadius(e, s.x, s.y, r)) hit(s, e, (C.bellDamage + C.bellRankDamage * s.ranks.bell) * power, true, undefined, undefined, false, e.x < s.x ? -1 : 1)
      if (s.palisade) wallHit(s, disk(s.x, s.y, r), 'melee')
      for (let i = 0; i < cap; i++) shoot(s, 'soul', angle + (i - (cap - 1) / 2) * 1.2, (C.soulDamage + C.soulRankDamage * s.ranks.soul) * power * capShare(cap, T.cap.magic.a), s.x, s.y, s.x, s.y, 1)
    }
  } else {
    const reach = (C.swordRange + C.swordRankRange * s.ranks.sword) * area
    if (!s.cool.sword && dist < reach) {
      s.cool.sword = C.swordCooldown / tempo; s.attack = .3; s.face = cos < 0 ? -1 : 1
      fx(s, 'slash', s.x, s.y, reach, '#fff0c8', angle)
      const damage = (C.swordDamage + C.swordRankDamage * s.ranks.sword) * power
      for (const e of s.enemies) {
        const ex = e.x - s.x, ey = e.y - s.y, d = Math.hypot(ex, ey) || 1
        if (e.giant || d < reach && (s.ranks.sword >= 4 || (ex * cos + ey * sin) / d > -C.swordArc)) hit(s, e, damage, true, undefined, s.ranks.sword >= 4 ? disk(s.x, s.y, reach) : { kind: 'cone', center: { x: s.x, y: s.y }, radius: reach, angle, halfAngle: Math.acos(-C.swordArc) }, false, ex < 0 ? -1 : 1)
      }
      if (s.palisade) wallHit(s, s.ranks.sword >= 4 ? disk(s.x, s.y, reach) : { kind: 'cone', center: { x: s.x, y: s.y }, radius: reach, angle, halfAngle: Math.acos(-C.swordArc) }, 'melee')
      // 칼바람 베기(갈래 끝): 벨 때마다 짧은 검기 (갈라지지 않는다 · gen 1)
      if (cap) { const b = shoot(s, 'wave', angle, damage * capShare(cap, T.cap.sword.a), s.x, s.y, s.x, s.y, 1); if (b) b.life = T.cap.sword.a.life }
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
/** 묶음 전용 보조 공격 (도끼 묶음 = 질풍 도끼, 예전 그대로) · 3층 숙련이 피해·빠르기를 · 4층 갈래 끝(capB)은 대개 날아간 뒤(움직이는 투사체 쪽)에서 */
function secondary(s: HaebiRun, target: Mob, angle: number, power: number, tempo: number) {
  power *= 1 + s.ranks.drill * T.drill; tempo *= 1 + s.ranks.drill * T.drillTempo
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
        if (e) { const at = aimAt(e, s.x, s.y); shoot(s, 'rain', 0, (C.rainDamage + C.rainRankDamage * s.ranks.rain) * power, at.x + (random(s) - .5) * C.rainSpread, at.y + (random(s) - .5) * C.rainSpread) }
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
  } else if (s.kit === 'sling') {
    // 연환석: 맞힌 적에게서 곁의 적으로 튀어 간다 (튀는 수 = pierce)
    if (s.ranks.skip && !s.cool.skip) {
      s.cool.skip = C.skipCooldown / tempo; const count = 1 + Math.floor(s.ranks.skip / 4) + s.ranks.echo
      for (let i = 0; i < count; i++) shoot(s, 'skip', angle + (i - (count - 1) / 2) * .35, (C.skipDamage + C.skipRankDamage * s.ranks.skip) * power)
    }
  } else if (s.kit === 'magic') {
    if (s.ranks.soul && !s.cool.soul) {
      s.cool.soul = C.soulCooldown / tempo; const count = 1 + Math.ceil(s.ranks.soul / 2) + s.ranks.echo
      for (let i = 0; i < count; i++) shoot(s, 'soul', angle + (i - (count - 1) / 2) * .9, (C.soulDamage + C.soulRankDamage * s.ranks.soul) * power)
    }
  } else if (s.ranks.wave && !s.cool.wave) {
    angle = archerAngle(s) ?? angle
    s.cool.wave = C.waveCooldown / tempo; const count = 1 + Math.floor(s.ranks.wave / 3) + s.ranks.echo, damage = (C.waveDamage + C.waveRankDamage * s.ranks.wave) * power
    for (let i = 0; i < count; i++) shoot(s, 'wave', angle + (i - (count - 1) / 2) * .3, damage)
    // 십자 검기(갈래 끝): 등 뒤로도
    if (s.ranks.capB) for (let i = 0; i < count; i++) shoot(s, 'wave', angle + Math.PI + (i - (count - 1) / 2) * .3, damage * capShare(s.ranks.capB, T.cap.sword.b))
  }
}
/** 묶음 조합 중 스스로 도는 것 (도끼 폭풍은 예전 그대로) · kits = 58-KITS 판: 둘레형(도끼 폭풍·만 갈래·창의 숲·그림자 춤·칼바람)은 aura58 이 새 꼴로 */
function aura(s: HaebiRun, power: number, area: number, kits = false) {
  if (!kits && s.combos.includes('cyclone') && !s.cool.orbit) {
    s.cool.orbit = C.orbitInterval
    for (let i = 0; i < 3; i++) {
      const a = s.t * 2.8 + i * Math.PI * 2 / 3, x = s.x + Math.cos(a) * C.orbitRadius * area, y = s.y + Math.sin(a) * C.orbitRadius * area
      for (const e of s.enemies) if (inRadius(e, x, y, 65 * area)) hit(s, e, C.orbitDamage * power * cp(s, 'cyclone'), true, { x, y }, disk(x, y, 65 * area))
      if (s.palisade) wallHit(s, disk(x, y, 65 * area), 'splash')
    }
  }
  if (!kits && s.combos.includes('volley') && !s.cool.volley) {
    s.cool.volley = C.volleyInterval
    for (let i = 0; i < C.volleyArrows; i++) shoot(s, 'arrow', s.t + i * Math.PI * 2 / C.volleyArrows, C.volleyDamage * power * cp(s, 'volley'))
  }
  if (!kits && s.combos.includes('grove') && !s.cool.grove) {
    s.cool.grove = C.groveInterval
    for (let i = 0; i < C.groveSpikes; i++) {
      const a = s.t * 1.3 + i * Math.PI * 2 / C.groveSpikes, x = s.x + Math.cos(a) * C.groveRadius * area, y = s.y + Math.sin(a) * C.groveRadius * area
      fx(s, 'spike', x, y, C.groveHit * area, '#e8eefc')
      for (const e of s.enemies) if (inRadius(e, x, y, C.groveHit * area)) hit(s, e, C.groveDamage * power * cp(s, 'grove'), true, null, disk(x, y, C.groveHit * area))
      if (s.palisade) wallHit(s, disk(x, y, C.groveHit * area), 'splash')
    }
  }
  if (!kits && s.combos.includes('shadowdance') && !s.cool.shadow) {
    // 그림자 춤: 둘레의 적 셋(+메아리)을 그림자가 벤다
    s.cool.shadow = C.shadowInterval; const used: number[] = []
    for (let i = 0; i < C.shadowTargets + s.ranks.echo; i++) {
      const e = nearest(s, s.x, s.y, used, C.shadowRange * area); if (!e) break
      used.push(e.id); fx(s, 'slash', e.x, e.y + C.heroShotHeight - 20, 46, '#b48cff', i * 2.1); hit(s, e, C.shadowDamage * power * cp(s, 'shadowdance'))
    }
  }
  if (s.combos.includes('rite') && !s.cool.rite) {
    s.cool.rite = C.riteInterval; const r = C.riteRadius * area
    fx(s, 'ring', s.x, s.y, r, '#ffb35a')
    for (const e of s.enemies) if (inRadius(e, s.x, s.y, r)) hit(s, e, C.riteDamage * power * cp(s, 'rite'))
    if (s.palisade) wallHit(s, disk(s.x, s.y, r), 'splash')
  }
  if (s.combos.includes('soulstorm') && !s.cool.storm) {
    s.cool.storm = C.stormInterval
    for (let i = 0; i < C.stormOrbs + s.ranks.echo; i++) {
      const a = s.t * 3.2 + i * Math.PI * 2 / (C.stormOrbs + s.ranks.echo), x = s.x + Math.cos(a) * C.stormRadius * area, y = s.y + Math.sin(a) * C.stormRadius * area
      for (const e of s.enemies) if (inRadius(e, x, y, 40 * area)) hit(s, e, C.stormDamage * power * cp(s, 'soulstorm'), false, { x, y }, disk(x, y, 40 * area))
      if (s.palisade) wallHit(s, disk(x, y, 40 * area), 'splash')
    }
  }
  if (s.combos.includes('boulder') && !s.cool.boulder) {
    // 거암돌진: 가장 많이 걸리는 줄로 큰 바위가 굴러가며 모두 짓이기고 앞으로 밀어낸다
    const r = C.boulderRadius * area, a = bestAim(s, C.boulderSpeed * C.boulderLife, r, C.boulderDamage * power * cp(s, 'boulder'))
    if (s.enemies.length) { s.cool.boulder = C.boulderInterval; const b = shoot(s, 'boulder', a, C.boulderDamage * power * cp(s, 'boulder')); if (b) b.radius = r }
  }
  if (!kits && s.combos.includes('tempest') && !s.cool.tempest) {
    s.cool.tempest = C.tempestInterval
    const r = C.tempestRadius * area
    fx(s, 'slash', s.x, s.y, r, '#fff0c8', s.t * 6); fx(s, 'slash', s.x, s.y, r, '#fff0c8', s.t * 6 + Math.PI)
    for (const e of s.enemies) if (inRadius(e, s.x, s.y, r)) hit(s, e, C.tempestDamage * power * cp(s, 'tempest'))
    if (s.palisade) wallHit(s, disk(s.x, s.y, r), 'splash')
  }
}
// ── 58-KITS 무기 개성 (11-22 형 「그래 추천대로해」 · docs/realm/WEAPON-IDENTITY-20261122.md · 수치는 HAEBI_KITS · 새 규칙 판만) ──
// 몸 둘레 360도는 방울과 비기·각성 터짐만 · 공용 부적·벽력은 내 무기가 맞힌 데서 붙고 튄다 · 칼 반달만 걷는 쪽으로 (시험)
/** 이번 걸음의 힘·범위·빠르기 — 날아간 것이 맞을 때 붙는 덧붙임(부적·벽력)도 같은 몫을 쓴다 (걸음마다 다시 채우는 그릇 · 판 상태가 아니다) */
const KC = { power: 1, area: 1, tempo: 1 }
/** 무기 한 번이 맞힌 적을 모으는 그릇 (collect 동안만 · 판 상태가 아니다) */
const COLLECT = { on: false, hits: [] as Mob[] }
/** 헤드리스 도구가 읽는 설치물 피해 셈 (판 상태가 아니다 · 판·재생에 아무 일도 하지 않는다) — src 지금 치는 것이 설치물(망루 화살 · 봉수대 화살비 · 포차 바위 · 장승 혼줄) · dealt 그렇게 깎은 체력 합 (도구가 0 으로 되돌린다) */
export const BUILD_TALLY = { src: false, dealt: 0, healed: 0 }
/** run 안에서 hit 이 실제로 맞힌 적 (같은 적은 한 번 · 맞힌 차례) */
function collect(run: () => void): Mob[] {
  if (COLLECT.on) { run(); return [] }
  COLLECT.on = true; COLLECT.hits = []
  try { run() } finally { COLLECT.on = false }
  return [...new Set(COLLECT.hits)]
}
const turnOf = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b))
/** 큰 놈 — 정예·두목·거구 (단검이 노리고 · 도끼 4단계가 세게 친다) */
const bigFoe = (e: Mob) => !!e.giant || !!e.champion || e.kind === 'elite' || e.kind === 'boss'
/** (x,y) 에서 radius 안의 가장 센 적 — 큰 놈 먼저, 그다음 남은 체력 (같으면 가까운 쪽) */
function strongest(s: HaebiRun, x: number, y: number, radius: number) {
  let best: Mob | undefined, score = -Infinity, bd = Infinity
  for (const e of s.enemies) {
    if (e.hp <= 0 || e.giant && !giantHasTarget(e.giant)) continue
    const d = mobDistance(e, x, y); if (d >= radius) continue
    const v = (bigFoe(e) ? e.max : 0) + e.hp
    if (v > score || v === score && d < bd) { score = v; bd = d; best = e }
  }
  return best
}
/** 등 뒤 — 장수를 보지 않는 적: 멈칫(어지럼) · 내려찍기 준비 · 돌진 겨눔·돌진 · 투창 겨눔 · 정예 돌진 · 지쳐 숨 고름 */
const offGuard = (e: Mob) => e.daze > 0 || e.wind > 0 || (!!charge(e.kind) || e.kind === 'hunter') && e.act !== 0 || e.champion?.mode === 'dash' || (e.recovery ?? 0) > 0 || e.giant?.state === 'recover'
/** 걸음마다 — 멈춰 선 시간 · 걷는 쪽 · 곧게 달린 시간 · 그림자 걸음 재사용 · 활 겨눔이 찬 순간 발밑 고리 */
function kitMove(s: HaebiRun, dx: number, dy: number, dt: number) {
  const k = s.kits!
  if (s.moving) {
    const a = Math.atan2(dy, dx)
    if (k.runT > 0 && Math.abs(turnOf(a, k.runAim)) < K.runTurn) k.runT += dt; else { k.runAim = a; k.runT = dt }
    k.aim = a; k.still = Math.max(0, k.still - dt * K.stillDecay)
  } else { k.runT = 0; k.still = Math.min(K.stillCap, k.still + dt) }
  k.step = Math.max(0, k.step - dt)
  k.boltIdle = s.ranks.thunder && !s.cool.thunder ? k.boltIdle + dt : 0
  if (s.kit === 'bow') {
    if (k.still >= K.bow.focus && !k.focused) { k.focused = true; fx(s, 'ring', s.x, s.y, K.bow.ring, '#ffe7a6') }
    else if (k.still < K.bow.focus) k.focused = false
  }
}
/** 벽력 — 큰 한 방이 닿은 적에서 곁의 적으로 튄다 (예전 「2.9초마다 혼자 친다」 대신) */
function chainBolt(s: HaebiRun, first: Mob) {
  const used: number[] = [], start = aimAt(first, s.x, s.y)
  let x = start.x, y = start.y - 160
  for (let i = 0; i < 2 + Math.ceil(s.ranks.thunder / 2) + s.ranks.echo; i++) {
    const e = i === 0 ? first : nearest(s, x, y, used, C.thunderRange * KC.area)
    if (!e) break
    const origin = { x, y }, at = aimAt(e, x, y); used.push(e.id); fx(s, 'bolt', x, y, 1, '#b8d5ff', 0, at.x, at.y); x = at.x; y = at.y
    hit(s, e, (C.thunderDamage + s.ranks.thunder * C.thunderRankDamage) * KC.power, false, origin)
    if (s.combos.includes('inferno')) blast(s, x, y, C.emberRange * KC.area, C.emberDamage * KC.power * cp(s, 'inferno'))
  }
}
/**
 * 공용 덧붙임 — 부적은 내 무기가 맞힌 적에 한 장씩 붙어 seal.delay 초 뒤 터지고(메아리마다 한 장 더 · 따로 날아가지 않는다),
 * 벽력은 큰 한 방(big)이 닿은 적에서 튄다. 그래서 같은 칸이어도 창은 줄 따라, 방울은 둘레로, 단검은 큰 놈 하나에 붙는다.
 */
function addOns(s: HaebiRun, hits: Mob[], big: boolean) {
  const k = s.kits!, live = hits.filter(e => e.hp > 0)
  if (!live.length) return
  if (s.ranks.ember) {
    if (!s.cool.ember && k.sealAt !== s.t) { k.sealAt = s.t; k.sealLeft = 1 + s.ranks.echo; s.cool.ember = C.emberCooldown / KC.tempo }
    if (k.sealAt === s.t) for (const e of live) {
      if (k.sealLeft <= 0) break
      if (s.shots.some(b => b.kind === 'ember' && b.source === e.id)) continue
      const at = aimAt(e, s.x, s.y), b = shoot(s, 'ember', 0, (C.emberDamage + C.emberRankDamage * s.ranks.ember) * KC.power, at.x, at.y)
      if (!b) break
      b.vx = 0; b.vy = 0; b.life = K.seal.delay; b.source = e.id; k.sealLeft--
    }
  }
  if ((big || k.boltIdle >= K.boltIdle) && s.ranks.thunder && !s.cool.thunder) { s.cool.thunder = C.thunderCooldown / KC.tempo; k.boltIdle = 0; chainBolt(s, live[0]!) }
}
/** 장수 둘레 radius 안의 적 수 (거구 빼고) */
const crowdNear = (s: HaebiRun, radius: number) => s.enemies.reduce((n, e) => n + (e.hp > 0 && !e.giant && Math.hypot(e.x - s.x, e.y - s.y) < radius ? 1 : 0), 0)
/** 주 무기 (58) — 묶음마다 하나의 문법 · 4단계가 몸 둘레 원으로 바뀌지 않는다 */
function primary58(s: HaebiRun, target: Mob, angle: number, dist: number, power: number, area: number, tempo: number) {
  const k = s.kits!, cos = Math.cos(angle), sin = Math.sin(angle), cap = s.ranks.capA, side = (c: number) => c < 0 ? -1 : 1
  power *= 1 + s.ranks.hone * T.hone
  if (s.kit === 'axe') {
    // 도끼: 느리게 크게 앞으로 내려찍는다 · 맞은 놈은 밀려나 멈칫 (둘러싸여도 앞을 열어 빠져나간다)
    const P = K.axe, r = s.ranks.axe, reach = (C.axeRange + C.axeRankRange * r) * area
    if (s.cool.axe || dist >= reach) return
    s.cool.axe = P.cooldown / tempo; s.attack = .3; s.face = side(cos)
    fx(s, 'slash', s.x, s.y, reach, '#ffe2a0', angle)
    const damage = (C.axeDamage + C.axeRankDamage * r) * power * P.damage, knock = P.knock * (r >= 4 ? P.rank4Knock : 1)
    const shape: Shape = { kind: 'diskCap', center: { x: s.x, y: s.y }, radius: reach, angle, minAlong: P.back }
    const hits = collect(() => {
      for (const e of s.enemies) if (e.giant || Math.hypot(e.x - s.x, e.y - s.y) < reach && (e.x - s.x) * cos + (e.y - s.y) * sin > P.back) {
        hit(s, e, damage * (r >= 4 && bigFoe(e) ? P.rank4Big : 1), true, undefined, shape, false, side(cos))
        if (e.hp > 0 && !steady(e)) { const d = Math.hypot(e.x - s.x, e.y - s.y) || 1; pushMob(s, e, (e.x - s.x) / d * knock, (e.y - s.y) / d * knock); e.daze = Math.max(e.daze, P.daze) }
      }
      if (cap) {
        // 대지파쇄: 내려친 쪽으로 땅이 길게 갈라져 그 줄을 모두 벤다
        const c = T.cap.axe.a, length = c.length * area, width = c.width * area
        fx(s, 'thrust', s.x, s.y, length, '#d9a85a', angle)
        for (const e of s.enemies) if (e.hp > 0 && inLine(s.x, s.y, e, cos, sin, length, width)) hit(s, e, damage * capShare(cap, c), false, undefined, lineShape(s.x, s.y, cos, sin, length, width))
        if (s.palisade) wallHit(s, lineShape(s.x, s.y, cos, sin, length, width), 'melee')
      }
    })
    if (s.palisade) wallHit(s, shape, 'melee')
    // 산 가르기 (조합): 셋째 내려찍기마다 앞으로 갈라진 땅이 남는다
    k.swing++
    if (s.combos.includes('cyclone') && k.swing % K.crack.every === 0) k.zones.push({ kind: 'crack', x: s.x, y: s.y, cos, sin, life: K.crack.life, tick: 0, damage: damage * K.crack.share * cp(s, 'cyclone') })
    addOns(s, hits, true)
  } else if (s.kit === 'bow') {
    // 활: 멀리서 꿰뚫는다 · 멈춰 서서 겨눔이 차면 다음 화살이 크고 모두 꿰뚫는다 (일제 사격 조합은 그때 앞 부채 다섯 발)
    if (s.cool.bow || dist >= C.bowRange * area) return
    s.cool.bow = C.bowCooldown / tempo; s.attack = .3; s.face = side(cos)
    const count = 1 + Math.floor(s.ranks.bow / 3) + cap * T.cap.bow.a.extra, damage = (C.bowDamage + C.bowRankDamage * s.ranks.bow) * power * K.bow.base * (cap ? capShare(cap, T.cap.bow.a) : 1)
    for (let i = 0; i < count; i++) { const b = shoot(s, 'arrow', angle + (i - (count - 1) / 2) * .12, damage); tagPrimaryShot(b) }
    const focus = k.still >= K.bow.focus
    if (focus) {
      k.still = 0; k.focused = false
      const b = shoot(s, 'arrow', angle, damage * K.bow.damage)
      if (b) { b.big = true; b.radius = K.bow.radius; tagPrimaryShot(b) }
      fx(s, 'ring', s.x, s.y, K.bow.ring, '#ffe7a6')
    }
    // 일제 사격 (조합): volleyInterval 초마다 모두 꿰뚫는 화살이 앞 부채로 (사방 고리가 아니다)
    if (s.combos.includes('volley') && !s.cool.volley) { s.cool.volley = C.volleyInterval; for (let i = 0, n = K.volley.arrows; i < n; i++) { const v = shoot(s, 'arrow', angle + (i - (n - 1) / 2) * K.volley.spread, C.volleyDamage * power * cp(s, 'volley')); if (v) v.big = true } }
  } else if (s.kit === 'spear') {
    // 창: 앞으로 길게 꿴다 · 줄 세울수록 세고 · 곧게 달리면 「돌격」(더 길게 · 꿴 적을 앞으로 민다)
    const P = K.spear, charged = k.runT >= P.chargeTime
    const length = (C.spearLength + C.spearRankLength * s.ranks.spear) * area * (charged ? P.length : 1), width = C.spearWidth * area * (s.ranks.spear >= 4 ? 1.6 : 1)
    if (s.cool.spear || dist >= length) return
    s.cool.spear = C.spearCooldown / tempo; s.attack = .3; s.face = side(cos)
    const lane = (e: Mob, c: number, n: number) => { const ex = e.x - s.x, ey = e.y - s.y, along = ex * c + ey * n; return along > -12 && along < length && Math.abs(ey * c - ex * n) < width }
    const lined = s.enemies.reduce((n, e) => n + (e.hp > 0 && !e.giant && lane(e, cos, sin) ? 1 : 0), 0)
    const damage = (C.spearDamage + C.spearRankDamage * s.ranks.spear) * power * P.base * (charged ? P.damage : 1) * (1 + P.lineBonus * Math.min(P.lineMax, Math.max(0, lined - 1))), share = cap ? capShare(cap, T.cap.spear.a) : 0
    // 삼방관통(갈래 끝): 앞과 양옆(spread) 세 방향 · 옆 찌르기는 share 몫
    const prongs: [number, number][] = cap ? [[angle, 1], [angle + T.cap.spear.a.spread, share], [angle - T.cap.spear.a.spread, share]] : [[angle, 1]]
    const giantUsed = new Set<number>()
    const hits = collect(() => {
      for (const [a, m] of prongs) {
        const c = Math.cos(a), n = Math.sin(a), shape = lineShape(s.x, s.y, c, n, length, width, 12)
        fx(s, 'thrust', s.x, s.y, length, charged ? '#fff3c4' : '#ffe2a0', a)
        for (const e of s.enemies) {
          if (e.giant ? giantUsed.has(e.id) || !giantContact(e, shape) : !lane(e, c, n)) continue
          hit(s, e, damage * m, true, undefined, shape, false, side(c)); if (e.giant) giantUsed.add(e.id)
          if (charged && e.hp > 0 && !steady(e)) pushMob(s, e, c * P.knock, n * P.knock)
        }
        if (s.palisade) wallHit(s, shape, 'melee')
      }
    })
    addOns(s, hits, charged || lined > P.bigPierce)
  } else if (s.kit === 'dagger') {
    // 단검: 손 닿는 데의 가장 센 적 하나를 녹인다 · 등 뒤면 치명 · 독이 겹겹이 · 둘러싸이면 그 적 등 뒤로 그림자 걸음
    const P = K.dagger, reach = (C.daggerRange + C.daggerRankRange * s.ranks.dagger) * area
    if (s.cool.dagger || dist >= reach) return
    const marked = k.mark ? s.enemies.find(e => e.id === k.mark && e.hp > 0) : undefined
    const pick = marked && mobDistance(marked, s.x, s.y) < reach ? marked : strongest(s, s.x, s.y, reach) ?? target
    if (!s.anchored && !k.step && crowdNear(s, P.stepRadius * area) >= P.stepCrowd) {
      const at = aimAt(pick, s.x, s.y), d = Math.hypot(at.x - s.x, at.y - s.y) || 1, px = s.x, py = s.y
      s.x = heroX(s, at.x + (at.x - px) / d * P.stepBeside); s.y = heroY(s, at.y + (at.y - py) / d * P.stepBeside)
      if (s.palisade) wallSettle(s.palisade, s, WL.heroR)
      k.step = P.stepCd; k.stepped = true; s.inv = Math.max(s.inv, C.dashInv)
      fx(s, 'slash', px, py, 40, '#b48cff', angle)
    }
    const at = aimAt(pick, s.x, s.y), a = Math.atan2(at.y - s.y, at.x - s.x), c = Math.cos(a), n = Math.sin(a)
    s.cool.dagger = C.daggerCooldown / tempo; s.attack = .3; s.face = side(c)
    fx(s, 'slash', s.x, s.y, reach, '#f1e4c0', a)
    const back = k.stepped || offGuard(pick), most = s.ranks.dagger >= 4 ? P.poisonMax4 : P.poisonMax
    k.stepped = false
    const arc = s.ranks.dagger >= 4 ? P.arc4 : C.daggerArc, damage = (C.daggerDamage + C.daggerRankDamage * s.ranks.dagger) * power * P.base, shape: Shape = { kind: 'cone', center: { x: s.x, y: s.y }, radius: reach, angle: a, halfAngle: Math.acos(arc) }
    let big = back
    const hits = collect(() => {
      for (const e of s.enemies) {
        const ex = e.x - s.x, ey = e.y - s.y, d = Math.hypot(ex, ey) || 1
        if (e !== pick && !e.giant && !(d < reach && (ex * c + ey * n) / d > arc)) continue
        if (e.giant && !giantContact(e, shape)) continue
        const crit = e === pick && back
        hit(s, e, damage * (crit ? P.crit : 1), true, undefined, shape, false, ex < 0 ? -1 : 1)
        if (crit) { const f = s.fx[s.fx.length - 1]; if (f && (f.kind === 'hit' || f.kind === 'death')) f.crit = true }
        if (e.hp <= 0) continue
        if (e.poison <= 0) e.stack = 0
        e.stack = Math.min(most, (e.stack ?? 0) + 1); e.poison = Math.max(e.poison, P.poisonTime)
        if (e.giant) giantPoisonFromLastHit(e.giant)
        e.pdps = damage * P.poisonShare * e.stack
        if (cap) { e.poison = Math.max(e.poison, T.cap.dagger.a.poison); e.pdps = Math.max(e.pdps, damage * capShare(cap, T.cap.dagger.a)) }
        if (e === pick && e.stack >= P.bigStacks) big = true
        // 표식 사냥 (조합): 표식 적을 찌르면 크게 터진다
        if (e === marked) { fx(s, 'slash', at.x, at.y + C.heroShotHeight - 20, 60, '#b48cff', a); hit(s, e, C.shadowDamage * K.mark.burst * power * cp(s, 'shadowdance'), false, undefined, shape); k.mark = 0; big = true }
      }
    })
    if (s.palisade) wallHit(s, shape, 'melee')
    addOns(s, hits, big)
  } else if (s.kit === 'sling') {
    // 돌팔매: 멀리 떨어뜨리고 튀긴다 · 너무 가까운 적은 반만 아프다 (거리를 벌린다) · 멀수록 둘레가 크다
    const P = K.sling, range = C.slingRange * area
    if (s.cool.sling || dist >= range) return
    s.cool.sling = C.slingCooldown / tempo; s.attack = .3; s.face = side(cos)
    const used: number[] = [], damage = (C.slingDamage + C.slingRankDamage * s.ranks.sling) * power
    const far = () => { let best: Mob | undefined, bd = range; for (const e of s.enemies) { if (e.hp <= 0 || used.includes(e.id) || e.giant && !giantHasTarget(e.giant)) continue; const d = mobDistance(e, s.x, s.y); if (d >= P.near && d < bd) { bd = d; best = e } } return best }
    for (let i = 0; i < 1 + Math.floor(s.ranks.sling / 3); i++) {
      const e = far() ?? (i ? nearest(s, s.x, s.y, used, range) : target); if (!e) break
      used.push(e.id)
      const at = aimAt(e, s.x, s.y), d = Math.hypot(at.x - s.x, at.y - s.y)
      const b = shoot(s, 'pebble', Math.atan2(at.y - s.y, at.x - s.x), damage, s.x, s.y, at.x, at.y)
      if (b) { b.vx = (at.x - s.x) / C.slingFlight; b.vy = (at.y - s.y) / C.slingFlight; b.radius = (C.slingSplash + C.slingRankSplash * s.ranks.sling) * area * (s.ranks.sling >= 4 ? C.slingWide : 1) * (1 + P.far * Math.min(1, d / range)); tagPrimaryShot(b) }
    }
  } else if (s.kit === 'magic') {
    // 방울: 둘레가 내 땅 · 한자리에 서 있을수록 굿판이 넓고 세다 (걸으면 줄어든다) · 굿판이 다 차면 큰 한 방
    const P = K.bell, g = Math.min(1, k.still / P.groundTime), r = (C.bellRadius + C.bellRankRadius * s.ranks.bell) * area * (1 + P.radius * g)
    if (s.cool.bell || dist >= r) return
    s.cool.bell = C.bellCooldown / tempo; s.attack = .3
    fx(s, 'ring', s.x, s.y, r, g >= 1 ? '#ffd36a' : '#f3dc8a')
    const hits = collect(() => { for (const e of s.enemies) if (inRadius(e, s.x, s.y, r)) hit(s, e, (C.bellDamage + C.bellRankDamage * s.ranks.bell) * power * (1 + P.damage * g), true, undefined, undefined, false, e.x < s.x ? -1 : 1) })
    if (s.palisade) wallHit(s, disk(s.x, s.y, r), 'melee')
    for (let i = 0; i < cap; i++) shoot(s, 'soul', angle + (i - (cap - 1) / 2) * 1.2, (C.soulDamage + C.soulRankDamage * s.ranks.soul) * power * capShare(cap, T.cap.magic.a), s.x, s.y, s.x, s.y, 1)
    addOns(s, hits, g >= 1)
  } else {
    // 칼: 앞을 넓게 벤다 · 1-2-3 박자 · 셋째 칼에 걷는 쪽으로 큰 반달 검기 (서 있으면 벤 쪽) · 셋째 칼은 앞을 밀어낸다
    const P = K.sword, reach = (C.swordRange + C.swordRankRange * s.ranks.sword) * area
    if (s.cool.sword || dist >= reach) return
    s.cool.sword = C.swordCooldown / tempo; s.attack = .3; s.face = side(cos)
    fx(s, 'slash', s.x, s.y, reach, '#fff0c8', angle)
    k.swing++
    const third = k.swing % P.every === 0, storm = s.combos.includes('tempest'), arc = s.ranks.sword >= 4 ? P.arc4 : C.swordArc
    const damage = (C.swordDamage + C.swordRankDamage * s.ranks.sword) * power, shape: Shape = { kind: 'cone', center: { x: s.x, y: s.y }, radius: reach, angle, halfAngle: Math.acos(-arc) }
    const cut = damage * (!third && storm ? 1 + K.tempest.share * cp(s, 'tempest') : 1)
    const hits = collect(() => {
      for (const e of s.enemies) {
        const ex = e.x - s.x, ey = e.y - s.y, d = Math.hypot(ex, ey) || 1
        if (!e.giant && !(d < reach && (ex * cos + ey * sin) / d > -arc)) continue
        hit(s, e, cut, true, undefined, shape, false, ex < 0 ? -1 : 1)
        if (third && e.hp > 0 && !steady(e)) pushMob(s, e, ex / d * P.knock, ey / d * P.knock)
      }
    })
    if (s.palisade) wallHit(s, shape, 'melee')
    if (third) {
      // 반달 검기 — 삼연격(조합)이면 여러 겹
      const dir = s.moving ? k.aim : angle, layers = storm ? K.tempest.layers : 1
      fx(s, 'slash', s.x, s.y, reach * 1.3, '#fff6dc', dir)
      for (let j = 0; j < layers; j++) { const b = shoot(s, 'wave', dir + (j - (layers - 1) / 2) * K.tempest.spread, damage * P.waveShare * (storm ? cp(s, 'tempest') : 1)); if (b) { b.big = true; b.radius = C.waveRadius * P.waveRadius * area; b.life = P.waveLife } }
    }
    // 칼바람 베기(갈래 끝): 벨 때마다 짧은 검기 (갈라지지 않는다 · gen 1)
    if (cap) { const b = shoot(s, 'wave', angle, damage * capShare(cap, T.cap.sword.a), s.x, s.y, s.x, s.y, 1); if (b) b.life = T.cap.sword.a.life }
    addOns(s, hits, third)
  }
}
/** 화살비가 떨어질 자리 — 활 거리 × look 안에서 적이 가장 많이 뭉친 곳 (같으면 먼 곳 · 화면 아무 데나 떨어지지 않는다) */
function rainSpot(s: HaebiRun, fallback: Mob) {
  const look = C.bowRange * K.rain.look
  let best = fallback, most = -1, far = -1
  for (const e of s.enemies) {
    if (e.hp <= 0 || e.giant && !giantHasTarget(e.giant)) continue
    const d = mobDistance(e, s.x, s.y); if (d >= look) continue
    let n = 0; for (const o of s.enemies) if (o.hp > 0 && Math.hypot(o.x - e.x, o.y - e.y) < K.rain.cluster) n++
    if (n > most || n === most && d > far) { most = n; far = d; best = e }
  }
  return best
}
/** 보조 공격 (58) — 질풍 도끼는 높이 던져 앞에 박히고 · 화살비는 뭉친 곳에만 · 검기는 걷는 쪽으로 · 나머지는 예전 그대로 */
function secondary58(s: HaebiRun, target: Mob, angle: number, dist: number, power: number, tempo: number) {
  if (s.kit !== 'axe' && s.kit !== 'bow' && s.kit !== 'sword') { secondary(s, target, angle, power, tempo); return }
  power *= 1 + s.ranks.drill * T.drill; tempo *= 1 + s.ranks.drill * T.drillTempo
  if (s.kit === 'axe') {
    if (!s.ranks.gale || s.cool.gale) return
    const P = K.gale, count = 1 + Math.ceil(s.ranks.gale / 2) + s.ranks.echo, far = Math.max(P.throwMin, Math.min(P.throw, dist)) * KC.area
    s.cool.gale = C.galeCooldown / tempo
    for (let i = 0; i < count; i++) {
      const a = angle + (i - (count - 1) / 2) * .24, tx = heroX(s, s.x + Math.cos(a) * far), ty = heroY(s, s.y + Math.sin(a) * far)
      const b = shoot(s, 'gale', a, (C.galeDamage + C.galeRankDamage * s.ranks.gale) * power, s.x, s.y, tx, ty)
      if (b) { b.vx = (tx - s.x) / P.flight; b.vy = (ty - s.y) / P.flight; b.life = P.flight + P.spin }
    }
  } else if (s.kit === 'bow') {
    if (!s.ranks.rain || s.cool.rain) return
    s.cool.rain = C.rainCooldown / tempo
    // 첫 화살비는 가장 가까운 적(몸을 지킨다) · 나머지는 가장 많이 뭉친 곳에 (화면 아무 데나 떨어지지 않는다)
    const near = aimAt(target, s.x, s.y), spot = aimAt(rainSpot(s, target), s.x, s.y), count = 1 + Math.ceil(s.ranks.rain / 2) + s.ranks.echo
    for (let i = 0; i < count; i++) { const at = i ? spot : near, spread = C.rainSpread * (i > 1 ? K.rain.spreadMore : 1); shoot(s, 'rain', 0, (C.rainDamage + C.rainRankDamage * s.ranks.rain) * power, at.x + (random(s) - .5) * spread, at.y + (random(s) - .5) * spread) }
  } else if (s.ranks.wave && !s.cool.wave) {
    // 검기: 걷는 쪽으로 (서 있으면 활잡이 먼저 · 그다음 가까운 적)
    const aim = s.moving ? s.kits!.aim : archerAngle(s) ?? angle
    s.cool.wave = C.waveCooldown / tempo; const count = 1 + Math.floor(s.ranks.wave / 3) + s.ranks.echo, damage = (C.waveDamage + C.waveRankDamage * s.ranks.wave) * power
    for (let i = 0; i < count; i++) shoot(s, 'wave', aim + (i - (count - 1) / 2) * .3, damage)
    // 십자 검기(갈래 끝): 등 뒤로도
    if (s.ranks.capB) for (let i = 0; i < count; i++) shoot(s, 'wave', aim + Math.PI + (i - (count - 1) / 2) * .3, damage * capShare(s.ranks.capB, T.cap.sword.b))
  }
}
/** 조합 (58) — 창벽 · 표식 사냥 · 땅에 남은 것(갈라진 땅 · 창벽) · 둘레를 갖는 만신 굿·혼불 회오리와 거암돌진은 예전 셈 그대로 */
function aura58(s: HaebiRun, angle: number | null, power: number, area: number, dt: number) {
  const k = s.kits!
  aura(s, power, area, true)
  if (s.combos.includes('grove') && !s.cool.grove && angle !== null) {
    // 창벽: 보는 쪽 앞에 창날이 가로 한 줄로 솟아 넘어오는 적을 막는다
    s.cool.grove = K.wall.every
    const dir = s.moving ? k.aim : angle, c = Math.cos(dir), n = Math.sin(dir)
    k.zones.push({ kind: 'wall', x: s.x + c * K.wall.ahead * area, y: s.y + n * K.wall.ahead * area, cos: c, sin: n, life: K.wall.life, tick: 0, damage: C.groveDamage * power * cp(s, 'grove') })
  }
  if (s.combos.includes('shadowdance') && !s.cool.shadow) {
    // 표식 사냥: 둘레의 가장 센 적 하나에 표식 · 그림자가 그 적만 벤다
    s.cool.shadow = K.mark.every
    let e = k.mark ? s.enemies.find(o => o.id === k.mark && o.hp > 0) : undefined
    if (!e || mobDistance(e, s.x, s.y) > C.shadowRange * area) { e = strongest(s, s.x, s.y, C.shadowRange * area); k.mark = e?.id ?? 0 }
    if (e) { const at = aimAt(e, s.x, s.y); fx(s, 'ring', at.x, at.y, 30, '#b48cff'); fx(s, 'slash', at.x, at.y + C.heroShotHeight - 20, 46, '#b48cff', s.t * 2.1); hit(s, e, C.shadowDamage * power * cp(s, 'shadowdance')) }
  }
  for (const z of k.zones) {
    z.life -= dt; z.tick -= dt
    const a = Math.atan2(z.sin, z.cos)
    if (z.kind === 'crack') {
      // 산 가르기: 갈라진 땅 위의 적은 맞고 멈칫한다
      const L = K.crack.length * area, W = K.crack.width * area, shape = lineShape(z.x, z.y, z.cos, z.sin, L, W)
      if (z.tick > 0) continue
      z.tick = K.crack.tick; fx(s, 'thrust', z.x, z.y, L, '#d9a85a', a)
      for (const e of s.enemies) if (e.hp > 0 && inLine(z.x, z.y, e, z.cos, z.sin, L, W)) { hit(s, e, z.damage, false, { x: z.x, y: z.y }, shape); if (e.hp > 0 && !steady(e)) e.daze = Math.max(e.daze, K.crack.daze) }
      if (s.palisade) wallHit(s, shape, 'splash')
      continue
    }
    // 창벽: 가로 줄(px,py) · 넘어오는 적은 벽 바깥으로 밀린다
    const px = -z.sin, py = z.cos, half = (K.wall.spikes - 1) / 2 * K.wall.gap * area, W = K.wall.width * area
    const shape = lineShape(z.x - px * (half + W), z.y - py * (half + W), px, py, 2 * (half + W), W, 0)
    for (const e of s.enemies) {
      if (e.hp <= 0 || e.giant || steady(e)) continue
      const rx = e.x - z.x, ry = e.y - z.y, along = rx * z.cos + ry * z.sin
      if (Math.abs(rx * px + ry * py) < half + W && Math.abs(along) < W) { const to = along >= 0 ? W : -W; pushMob(s, e, z.cos * (to - along), z.sin * (to - along)) }
    }
    if (z.tick > 0) continue
    z.tick = K.wall.tick
    for (let i = 0; i < K.wall.spikes; i++) { const o = (i - (K.wall.spikes - 1) / 2) * K.wall.gap * area; fx(s, 'spike', z.x + px * o, z.y + py * o, W * 1.6, '#e8eefc') }
    for (const e of s.enemies) {
      if (e.hp <= 0) continue
      const rx = e.x - z.x, ry = e.y - z.y
      if (e.giant ? giantContact(e, shape) : Math.abs(rx * px + ry * py) < half + W && Math.abs(rx * z.cos + ry * z.sin) < W * 1.6) hit(s, e, z.damage, false, { x: z.x, y: z.y }, shape)
    }
    if (s.palisade) wallHit(s, shape, 'splash')
  }
  k.zones = k.zones.filter(z => z.life > 0)
}
// ── 비기 (형 11-16: 무기마다 꼴이 다르게 · 수치는 HAEBI_ULT · DPS 는 tools/raid-ult-dps.ts) ──
/** 비기 그림 — 첫 조각은 'skill'(소리·컷인 신호), 잇따르는 조각은 'ult' · 그리는 쪽이 f.ult 로 묶음마다 다르게 그린다 */
function ultFx(s: HaebiRun, lead: boolean, x: number, y: number, r: number, angle = 0, x2 = x, y2 = y) {
  fx(s, lead ? 'skill' : 'ult', x, y, r, '#ffdf8b', angle, x2, y2)
  const f = s.fx[s.fx.length - 1]!; f.ult = s.kit; f.life = f.total = U[s.kit].fx; if (s.trueUlt) f.tru = true
  if (usesPermanentAwakening(s)) { f.awakened = s.ultAwakened === true; f.empowered = s.ultEmpowered === true }
  if (lead && (s.ultReleaseSeq ?? 0) > 0) { f.awakenedRelease = true; f.castSeq = s.ultReleaseSeq!; s.ultReleaseSeq = 0 }
}
/** (x0,y0) 에서 angle 쪽으로 길이 length · 반폭 width 의 띠 안인가 (발밑 조금 뒤까지) */
function inLine(x0: number, y0: number, e: Mob, cos: number, sin: number, length: number, width: number) {
  if (e.giant) return !!giantContact(e, lineShape(x0, y0, cos, sin, length, width))
  const ex = e.x - x0, ey = e.y - y0, along = ex * cos + ey * sin
  return along > -width / 2 && along < length && Math.abs(ey * cos - ex * sin) < width
}
/** 줄 비기의 방향 — 가까운 적 몇 쪽으로 줄을 대 보고 실제로 깎을 체력이 가장 많은 쪽.
 *  toward 가 있으면(칼: 움직이는 쪽) 그 쪽 cone 안의 줄만 견준다 · 걸리는 적이 없으면 toward 또는 보는 쪽 */
function bestAim(s: HaebiRun, length: number, width: number, damage: number, toward: number | null = null, cone = Math.PI) {
  const near = s.enemies.filter(e => e.hp > 0).map(e => ({ e, d: mobDistance(e, s.x, s.y) })).sort((a, b) => a.d - b.d || a.e.id - b.e.id).slice(0, U.aimTries)
  let best = toward ?? (s.face < 0 ? Math.PI : 0), most = 0
  for (const { e } of near) {
    const at = aimAt(e, s.x, s.y), a = Math.atan2(at.y - s.y, at.x - s.x), cos = Math.cos(a), sin = Math.sin(a)
    if (toward !== null && Math.abs(Math.atan2(Math.sin(a - toward), Math.cos(a - toward))) > cone) continue
    let sum = 0
    for (const o of s.enemies) if (o.hp > 0 && inLine(s.x, s.y, o, cos, sin, length, width)) sum += Math.min(o.hp, damage)
    if (sum > most) { most = sum; best = a }
  }
  return best
}
/** 비기가 열렸나 — 판은 평타만으로 시작하고 첫 레벨업(HAEBI_ULT.unlockLevel)에서 열린다 (11-19 형) · 선봉은 높은 레벨로 시작해 처음부터 */
export const ultOpen = (s: HaebiRun) => s.level >= U.unlockLevel
/** 비기 재사용 (3층 비기 강화면 짧게) */
const ultCooldown = (s: HaebiRun) => U[s.kit].cooldown * (ultUpgraded(s) ? T.ultCooldown : 1)
/** 비기를 누름 — 재사용은 지금부터 돌고, 시전(cast 초 · 진 비기는 trueCast)이 끝나면 터진다 */
function startUlt(s: HaebiRun, shortCutin = false) {
  if (usesPermanentAwakening(s)) {
    const empowered = s.gritUltReady === true, t = empowered ? U.trueCast : U.cast
    s.skillCd = ultCooldown(s); s.gritUltReady = false
    if (usesAwakenedCast(s)) {
      const awakened = isPermanentAwake(s), previous = s.awakenedCasts!
      const slow = awakened ? AC.slow : AC.normalSlow
      const wall = awakened ? AC.firstWall * (shortCutin || previous > 0 ? AC.shortFactor : 1) : empowered ? AC.normalEmpoweredWall : AC.normalWall
      if (awakened) s.awakenedCasts = previous + 1
      s.cast = { kind: 'ult', t: wall * slow, total: wall * slow, tru: false, awakened, empowered, slow, ...(awakened ? { seq: s.awakenedCasts! } : {}) }
      return
    }
    s.cast = { kind: 'ult', t, total: t, tru: false, awakened: isPermanentAwake(s), empowered }
    return
  }
  const tru = s.form === 'awake', t = tru ? U.trueCast : U.cast
  s.skillCd = ultCooldown(s); s.cast = { kind: 'ult', t, total: t, tru }
}
/** 비기 — free: 되받아치기(버팀 끝)로 작게 터질 때 · 날아오던 화살도 그대로 둔다 (k = 힘 몫 · 이어지는 비기도 그 몫으로) · 재사용은 누를 때(startUlt) */
function ultimate(s: HaebiRun, mx: number, my: number, power: number, area: number, free = false, k = 1) {
  if (!free) s.shots = s.shots.filter(b => b.kind !== 'enemy' && b.kind !== 'hurl')
  s.inv = Math.max(s.inv, C.skillInv); s.attack = .3; power *= k
  const moveAim = s.moving && (mx || my) ? Math.atan2(my, mx) : null
  if (s.kit === 'axe' || s.kit === 'bow' || s.kit === 'sword') {
    // 줄 비기: 도끼는 땅을 가르고 · 활은 화면을 꿰고 · 칼은 그 줄을 따라 내달린다
    const u = U[s.kit], width = u.width * area, damage = u.damage * power, x0 = s.x, y0 = s.y
    let length = s.kit === 'bow' ? u.length : u.length * area
    let angle = s.kit === 'sword' ? bestAim(s, length, width, damage, moveAim, U.sword.cone) : bestAim(s, length, width, damage)
    if (s.kit === 'sword') {
      // 판 밖으로는 못 나간다 — 실제로 내달린 거리·방향만큼만 벤다
      const ex = heroX(s, x0 + Math.cos(angle) * length), ey = heroY(s, y0 + Math.sin(angle) * length)
      length = Math.hypot(ex - x0, ey - y0); if (length > 1) angle = Math.atan2(ey - y0, ex - x0)
    }
    const cos = Math.cos(angle), sin = Math.sin(angle)
    ultFx(s, true, x0, y0, width, angle, x0 + cos * length, y0 + sin * length)
    // 도끼는 내려찍은 발밑도 둘레로 터진다 (burst · 갈라진 줄과 겹쳐도 한 번만)
    const burst = s.kit === 'axe' ? U.axe.burst * area : 0
    for (const e of s.enemies) if (inLine(x0, y0, e, cos, sin, length, width) || inRadius(e, x0, y0, burst)) hit(s, e, damage, true, undefined, { kind: 'union', shapes: burst > 0 ? [lineShape(x0, y0, cos, sin, length, width), disk(x0, y0, burst)] : [lineShape(x0, y0, cos, sin, length, width)] })
    // 목책: 비기 줄이 닿은 마디를 먼저 깎고 · 칼은 안 부서진 마디 앞에서 멈춘다
    if (s.palisade) wallHit(s, { kind: 'union', shapes: burst > 0 ? [lineShape(x0, y0, cos, sin, length, width), disk(x0, y0, burst)] : [lineShape(x0, y0, cos, sin, length, width)] }, 'skill')
    if (s.kit === 'sword') { s.x = x0 + cos * length; s.y = y0 + sin * length; if (s.palisade) wallMove(s.palisade, s, x0, y0, WL.heroR) }
    if (Math.abs(cos) > .1) s.face = cos < 0 ? -1 : 1
  } else if (s.kit === 'magic') {
    // 천벌: 화면의 모든 적 · 번개 줄은 고르게 bolts 개만 그린다 (맞는 건 모두)
    const alive = s.enemies.filter(e => e.hp > 0), every = Math.max(1, Math.ceil(alive.length / U.magic.bolts))
    ultFx(s, true, s.x, s.y, 0)
    for (const e of alive) hit(s, e, U.magic.damage * power, false, null)
    alive.forEach((e, i) => { if (i % every === 0) ultFx(s, false, e.x, e.y, 0, 0, e.x, e.y) })
  } else if (s.kit === 'sling') {
    // 돌벼락: range 안에서 가장 많이 걸리는 자리(가까운 적 몇 곳을 대 봄)를 골라, 그 둘레 radius 에 돌이 물결 지어 쏟아진다
    const p = U.sling, R = p.radius * area, one = p.damage * power
    let cx = heroX(s, s.x + (s.face < 0 ? -1 : 1) * R), cy = s.y, most = 0
    const near = s.enemies.filter(e => e.hp > 0 && mobDistance(e, s.x, s.y) < p.range * area).sort((a, b) => Math.hypot(a.x - s.x, a.y - s.y) - Math.hypot(b.x - s.x, b.y - s.y) || a.id - b.id).slice(0, U.aimTries)
    for (const c of near) {
      let sum = 0
      for (const o of s.enemies) if (o.hp > 0 && inRadius(o, aimAt(c, s.x, s.y).x, aimAt(c, s.x, s.y).y, R)) sum += Math.min(o.hp, one * p.stones * p.waves * (p.splash / p.radius) ** 2)
      if (sum > most) { const at = aimAt(c, s.x, s.y); most = sum; cx = at.x; cy = at.y }
    }
    ultFx(s, true, cx, cy, R, 0, s.x, s.y)   // 그림자 고리 (떨어질 자리) · 장수는 팔매를 크게 돌린다
    s.ult = { n: p.waves, t: 0, x: cx, y: cy, used: [], k }
  } else {
    s.ult = { n: s.kit === 'spear' ? U.spear.pulses : U.dagger.targets, t: 0, x: s.x, y: s.y, used: [], k }
    if (s.kit === 'dagger') ultFx(s, true, s.x, s.y, 0)   // 그림자로 사라짐
  }
}
/** 돌벼락의 돌이 고르게 퍼지는 각 (해바라기 씨 배열) */
const GOLDEN = Math.PI * (3 - Math.sqrt(5))
/** 이어지는 비기의 한 걸음 — 용오름 창은 넓어지며 솟고, 환영난무는 다음 적에게 옮겨 가 베고, 돌벼락은 물결마다 둘레 전체에 돌이 떨어진다 */
function ultTick(s: HaebiRun, dt: number, power: number, area: number) {
  const u = s.ult!; u.t -= dt; power *= u.k
  while (u.t <= 0 && u.n > 0) {
    if (s.kit === 'spear') {
      const p = U.spear, i = p.pulses - u.n, r = (p.r0 + (p.r1 - p.r0) * i / Math.max(1, p.pulses - 1)) * area
      ultFx(s, i === 0, s.x, s.y, r, i)
      for (const e of s.enemies) {
        const d = Math.hypot(e.x - s.x, e.y - s.y)
        if (e.hp <= 0 || !inRadius(e, s.x, s.y, r)) continue
        hit(s, e, p.damage * power, true, undefined, disk(s.x, s.y, r))
        if (e.hp > 0 && !steady(e)) pushMob(s, e, (e.x - s.x) / (d || 1) * p.knock, (e.y - s.y) / (d || 1) * p.knock)
      }
      if (s.palisade) wallHit(s, disk(s.x, s.y, r), 'skill')
    } else if (s.kit === 'sling') {
      // 물결마다 돌 stones 개 — 해바라기 씨처럼 둘레 전체에 고르게, 물결마다 조금씩 어긋나게
      const p = U.sling, i = p.waves - u.n, R = p.radius * area, r = p.splash * area, all = p.waves * p.stones
      for (let j = 0; j < p.stones; j++) {
        const k = j * p.waves + i, rr = R * Math.sqrt((k + .5) / all), a = k * GOLDEN, x = u.x + Math.cos(a) * rr, y = u.y + Math.sin(a) * rr
        ultFx(s, false, x, y, r, k)
        for (const e of s.enemies) if (e.hp > 0 && inRadius(e, x, y, r)) hit(s, e, p.damage * power, false, null, disk(x, y, r))
        if (s.palisade) wallHit(s, disk(x, y, r), 'skill')
      }
    } else {
      const p = U.dagger, i = p.targets - u.n, e = nearest(s, s.x, s.y, u.used, p.range * area)
      if (!e) u.n = 1
      else {
        const at = aimAt(e, s.x, s.y), side = s.x < at.x ? -1 : 1, px = s.x, py = s.y, r = p.splash * area
        // 62-ANCHOR: 장수는 제자리 · 그림자 분신만 날아가 벤다 (화면은 px,py → 적 자리의 그림자 길로 같다)
        // 73-PHANTOM: 62-ANCHOR 위에서도 환영난무만은 장수가 직접 옮겨 다니며 벤다 (그동안 무적)
        const hop = !s.anchored || !!s.phantom
        if (hop) { s.x = heroX(s, at.x + side * p.beside); s.y = heroY(s, at.y); s.face = -side } else s.face = side < 0 ? 1 : -1
        if (s.phantom) s.inv = Math.max(s.inv, U.phantom.inv)
        u.used.push(e.id)
        if (s.palisade && hop) wallSettle(s.palisade, s, WL.heroR)   // 그림자 걸음은 목책을 넘지만 마디 속에 서지는 않는다
        ultFx(s, false, at.x, at.y, r, i, px, py)
        for (const o of s.enemies) if (o.hp > 0 && inRadius(o, at.x, at.y, r)) hit(s, o, p.damage * power, true, undefined, disk(at.x, at.y, r))
        if (s.palisade) wallHit(s, disk(at.x, at.y, r), 'skill')
      }
    }
    u.n--; u.t += s.kit === 'spear' ? U.spear.gap : s.kit === 'sling' ? U.sling.gap : U.dagger.gap
  }
  if (u.n > 0) return
  if (s.kit === 'dagger') { ultFx(s, false, u.x, u.y, 0, 0, s.x, s.y); s.x = u.x; s.y = u.y }   // 처음 자리로 돌아옴
  if (s.phantom && s.kit === 'dagger') s.inv = Math.max(s.inv, U.phantom.landInv)   // 착지 무적
  s.ult = null
}
// ── 59-WIDE 넓은 맵 (raid/wide.ts · 수치 HAEBI_WIDE · 새 규칙 판만 · docs/realm/RAID-REWARD-MAP-20261122.md 4장) ──
/** 일제 사격 발사자가 화면에 있나 — 한 장짜리 판은 판 안 · 넓은 맵은 장수 화면(1배)에 둘레 여유를 더한 틀(카메라가 앞서 보는 만큼) */
const onField = (s: HaebiRun, e: Mob) => s.wide ? inSimView(s, e.x, e.y, -WD.spawnMargin) : e.x >= 0 && e.x <= C.width && e.y >= 0 && e.y <= C.height
/** 안개 문 — 보스 gateWarn 초 전부터 세계 끝에서 결전장으로 닫힌다 · 닫히기 시작하면 포효로 알린다 (화면이 결전장 쪽 화살표를 띄운다) */
function gateStep(s: HaebiRun, dt: number) {
  const mid = s.giantFlow && !s.giantFlow.midDefeated ? midbossTime(s) : null
  if (stepGate(s.wide!, s.t, dt, mid, bossTime(s))) { fx(s, 'ring', s.x, s.y, 65, '#e8dcc0'); s.fx[s.fx.length - 1]!.championCue = 'roar' }
}
/**
 * 넓은 맵의 적·알·상자를 걸음마다 — 정예가 장수 화면에 처음 들어온 때를 적고(그 전엔 bornAt 을 지금으로 민다 = 「빨리 잡기」는 본 때부터) ·
 * 안개 문이 닫히는 동안은 고리가 안으로 밀고(적 · 알 · 땅의 상자 · 피해 없음) · 뒤처진 잡졸은 장수가 가는 쪽 둘레로 옮긴다(정예·두목은 걸어서 온다).
 */
function herdWide(s: HaebiRun) {
  const w = s.wide!, [ex, et, eb] = WD.edge, closing = w.gate > 0
  for (const e of s.enemies) {
    if (e.hp <= 0 || e.giant) continue
    if (e.unseen) { if (inSimView(s, e.x, e.y, WD.seenInset)) delete e.unseen; else e.bornAt = s.t }
    // 지금 땅 안으로 (열려 있을 땐 세계 끝 · 밀려난 적이 세계 밖에 서지 않게 · 닫히는 동안은 고리가 민다)
    e.x = Math.max(w.left + ex, Math.min(w.right - ex, e.x)); e.y = Math.max(w.top + et, Math.min(w.bottom - eb, e.y))
    if (e.champion || e.kind === 'elite' || e.kind === 'boss' || !strayed(s, e.x, e.y)) continue
    const dx = s.x - e.x, dy = s.y - e.y
    ringSpot(s, Math.abs(dx) * C.height > Math.abs(dy) * C.width ? dx > 0 ? 1 : 0 : dy > 0 ? 3 : 2, random(s), SPOT)
    e.x = SPOT.x; e.y = SPOT.y; e.act = 0; e.wind = 0
  }
  // 상자는 늘 장수가 닿는 자리에 (땅 끝 띠 안에서 쓰러진 정예) · 알은 고리가 밀 때만
  for (const c of s.chests ?? []) if (c.state === 'ground') { c.x = heroX(s, c.x); c.y = heroY(s, c.y) }
  if (closing) for (const d of s.drops) { d.x = heroX(s, d.x); d.y = heroY(s, d.y) }
}
// ── 65-BUILD 설치 갈래 (raid/build.ts) ──
/** 놓을 자리를 받는 그릇 (판 상태가 아니다) */
const BSPOT = { x: 0, y: 0 }
/** 설치물을 제자리에 맞춘다 — 서로 겹치지 않게 · 장식 밑동 밖 · 장수가 설 수 있는 땅 안 · 성한 목책(56-C) 너머로 가지 않게 · 그 뒤 장수가 겹쳤으면 장수가 비켜 선다 */
function settleBuild(s: HaebiRun) {
  const b = s.build!
  separateBuild(b)
  for (const it of b.items) {
    if (!standing(it)) continue
    const ox = it.x, oy = it.y
    if (s.solids) pushOutOfSolids(s.solids, it, bodyR(it))
    it.x = heroX(s, it.x); it.y = heroY(s, it.y)
    if (s.palisade) wallMove(s.palisade, it, ox, oy, bodyR(it))
  }
  pushOutOfBuild(b, s, WL.heroR)
}
/** 그 종류의 i 째를 장수 앞에 하나 놓는다 (가장 가까운 적 쪽 · 없으면 보는 쪽) */
function placeBuild(s: HaebiRun, kind: BuildKind, i: number) {
  const b = s.build!
  const t = nearest(s, s.x, s.y, undefined, Infinity, true), at = t ? aimAt(t, s.x, s.y) : null
  const aim = at ? Math.atan2(at.y - s.y, at.x - s.x) : s.face < 0 ? Math.PI : 0
  buildSpot(kind, i, s.x, s.y, aim, BSPOT)
  const max = buildHp(kind, s.ranks[kind], !!b.wall) * threat(s)
  b.items.push({ id: b.nextId++, kind, x: heroX(s, BSPOT.x), y: heroY(s, BSPOT.y), hp: max, max, down: 0, cd: 0, flash: 0, push: 0, ...(b.wall && !hasHp(kind) ? { w: true as const } : {}) })
  settleBuild(s)
}
/** 설치 칸을 골랐다 — 망루·목책은 새 단계 체력으로 (깎인 만큼은 그대로) · 처음과 extraAt 단계에서 장수 앞에 하나 더 */
function buildPicked(s: HaebiRun, kind: BuildKind) {
  const rank = s.ranks[kind]
  if (kind !== 'jar' || s.build!.wall) for (const f of s.build!.items) if (f.kind === kind) { const max = buildHp(kind, rank, !!s.build!.wall) * threat(s); if (f.down <= 0) f.hp += max - f.max; f.max = max }
  for (let i = buildUnits(rank - 1, kind); i < buildUnits(rank, kind); i++) placeBuild(s, kind, i)
}
/** 장수가 설치물을 몸으로 민다 (다이센카) — 겹치면 이번 걸음이 pushShare 몫으로 줄고, 겹친 설치물은 장수 몸 밖으로 미끄러진다 · 못 가는 설치물(장식·땅 끝)이면 장수가 막힌다 */
function heroPush(s: HaebiRun, fromX: number, fromY: number) {
  const b = s.build!
  if (!touchingBuild(b, s, WL.heroR)) return
  s.x = fromX + (s.x - fromX) * BU.pushShare; s.y = fromY + (s.y - fromY) * BU.pushShare
  for (const it of b.items) {
    if (!standing(it)) continue
    const reach = bodyR(it) + WL.heroR, dx = it.x - s.x, dy = it.y - s.y, d = Math.hypot(dx, dy)
    if (d >= reach) continue
    const nx = d < 1e-6 ? s.face : dx / d, ny = d < 1e-6 ? 0 : dy / d
    it.x = s.x + nx * reach; it.y = s.y + ny * reach; it.push = BU.pushDust
  }
  settleBuild(s)
}
/** 망루 화살 한 발의 피해 — 그때 잡졸 체력의 towerShare 몫 */
export const towerShot = (s: HaebiRun) => mobHp(s) * towerShare(s.ranks.tower ?? 0) * fireMul(s)
/** 69-BUILDUP 화력 배수 (규칙이 꺼진 판은 1 그대로) */
const fireMul = (s: HaebiRun) => s.build?.up ? firepowerMul(s.ranks.firepower ?? 0, s.build.upV1) : 1
/** 69-BUILDUP 장전을 얹은 쏘는 간격 (규칙이 꺼진 판은 그대로) */
const reloadIv = (s: HaebiRun, interval: number) => s.build?.up ? reloadInterval(interval, s.ranks.reload ?? 0, s.build.upV1) : interval
/**
 * 망루에 끌린 잡졸 한 걸음 — 끌린 망루가 무너졌으면 장수에게 돌아가고 · aggroR 안에 서 있는 망루가 있으면 끌린다 ·
 * 끌렸으면 그 망루로 걸어가(닿으면) 친다. 끌려 있는 동안 true (장수를 쫓지도 치지도 않는다)
 */
function towerAggro(s: HaebiRun, e: Mob, bite: number, v: number, dt: number) {
  const b = s.build!
  let t = e.aggro === undefined ? undefined : b.items.find(it => it.id === e.aggro && standing(it))
  if (!t) { delete e.aggro; t = aggroNear(b, e, e.id); if (!t) return false; e.aggro = t.id }
  const a = aggroOf(t.kind)!, dx = t.x - e.x, dy = t.y - e.y, d = Math.hypot(dx, dy) || 1
  if (d > bodyR(t) + mobRadius(e) + a.touch) {
    const ox = e.x, oy = e.y
    e.x += dx / d * v * dt; e.y += dy / d * v * dt
    if (s.palisade) wallMove(s.palisade, e, ox, oy, mobRadius(e))
  } else { t.hp -= C.contactDamage * threat(s) * bite * a.bite * dt; t.flash = BU.flash }
  return true
}
/** 67-BUILD2 적이 느려지는 몫 — 혼줄에 닿은 뒤 lineSlowT 초 · 솟대 둘레 안 (가장 센 것 하나만) */
function mobSlow(s: HaebiRun, e: Mob) {
  let k: number = (e.slow ?? 0) > 0 ? B2.totem.lineSlow : 1
  const r = s.ranks.sotdae ?? 0
  if (r) for (const it of s.build!.items) if (it.kind === 'sotdae' && standing(it) && Math.hypot(e.x - it.x, e.y - it.y) < sotdaeRadius(r)) { k = Math.min(k, 1 - sotdaeSlow(r)); break }
  return k
}
/** 67-BUILD2 cluster px 안에 적이 가장 많이 뭉친 적 (거대 보스 빼고 · ok 로 거른다) — 같으면 from 에서 먼 것 (from 이 없으면 먼저 것) */
function denseSpot(s: HaebiRun, ok: (e: Mob) => boolean, cluster: number, from?: { x: number; y: number }) {
  let best: Mob | undefined, bn = 0, bd = -1
  for (const e of s.enemies) {
    if (e.hp <= 0 || e.giant || e.flee !== undefined || !ok(e)) continue
    let n = 0
    for (const o of s.enemies) if (o.hp > 0 && !o.giant && o.flee === undefined && Math.hypot(o.x - e.x, o.y - e.y) < cluster) n++
    const d = from ? Math.hypot(e.x - from.x, e.y - from.y) : 0
    if (n > bn || n === bn && d > bd) { best = e; bn = n; bd = d }
  }
  return best
}
/** 67-BUILD2 봉수대 — 장수 화면에서 가장 뭉친 곳에 delay 초 뒤 화살비 (금빛 표식이 먼저) */
function beaconStep(s: HaebiRun, it: Structure, dt: number, tempo: number) {
  it.cd -= dt
  if (it.cd > 0) return
  const rank = s.ranks.beacon, t = denseSpot(s, e => aimable(s, e), B2.beacon.cluster)
  if (!t) { it.cd = 0; return }
  const m = shoot(s, 'signal', 0, mobHp(s) * beaconShare(rank) * fireMul(s), t.x, t.y)
  if (m) { m.life = B2.beacon.delay; m.radius = beaconRadius(rank) }
  it.cd = reloadIv(s, beaconEvery(rank) / tempo); it.flash = BU.flash
}
/** 67-BUILD2 포차 — minRange~range 안에서 가장 뭉친 곳(같으면 먼 곳)으로 바위를 던진다 (flight 초 뒤 떨어진다) */
function catapultStep(s: HaebiRun, it: Structure, dt: number, tempo: number) {
  it.cd -= dt
  if (it.cd > 0) return
  const rank = s.ranks.catapult, C2 = B2.catapult
  const t = denseSpot(s, e => { const d = Math.hypot(e.x - it.x, e.y - it.y); return d >= C2.minRange && d <= C2.range }, C2.cluster, it)
  if (!t) { it.cd = 0; return }
  const m = shoot(s, 'lob', Math.atan2(t.y - it.y, t.x - it.x), mobHp(s) * catapultShare(rank) * fireMul(s), it.x, it.y, t.x, t.y)
  if (m) { m.life = C2.flight; m.vx = (t.x - it.x) / C2.flight; m.vy = (t.y - it.y) / C2.flight; m.radius = catapultRadius(rank) }
  it.cd = reloadIv(s, catapultEvery(rank) / tempo); it.flash = BU.flash
}
// ── 71-BOSSDUEL 보스전은 보스와 겨루게 (HAEBI_BOSS_DUEL) ──
/** 마지막 두목(옛 두목 · 거대 보스)이 살아 있나 */
const finalBossAlive = (s: HaebiRun) => s.boss && s.enemies.some(e => e.kind === 'boss' && e.bossRole !== 'midboss' && e.hp > 0)
/** 저절로 나오는 잡졸의 몫 — 마지막 두목 bossSpawn · 중간 보스 midbossSpawn · 그 밖 1 */
const duelSpawn = (s: HaebiRun) => finalBossAlive(s) ? BD.bossSpawn : s.enemies.some(e => e.bossRole === 'midboss' && e.hp > 0) ? BD.midbossSpawn : 1
/** 저절로 나오는 잡졸이 멈추는 판 위 적 수 — 마지막 두목이 살아 있으면 bossCap (부른 졸개는 C.maxEnemies 그대로) */
const duelCap = (s: HaebiRun) => finalBossAlive(s) ? BD.bossCap : C.maxEnemies
/** 마지막 두목이 나온 순간 — 판 위 보통 잡졸이 달아난다 (정예 · 우두머리 · 부른 졸개 · 두목 · 거대 보스는 남는다) · 두목이 등장 고리를 안 띄웠으면 포효 고리 (fxAt 두목을 부르기 전 fx 수) */
function bossRout(s: HaebiRun, fxAt: number) {
  if (!s.fx.slice(fxAt).some(f => f.championCue === 'enter')) { const b = s.enemies.find(e => e.kind === 'boss' && e.bossRole !== 'midboss' && e.hp > 0); if (b) fx(s, 'ring', b.x, b.y - 20, BD.roar, BD.roarColor) }
  for (const e of s.enemies) if (e.hp > 0 && e.kind !== 'boss' && e.kind !== 'elite' && !e.giant && !e.champion && !e.summoned && e.bossRole === undefined) e.flee = BD.flee
}
/** 달아나는 잡졸 한 걸음 — 장수에게서 멀어지고 · 다 달아나면 흙먼지를 남기고 보상 없이 사라진다 (쓰러뜨린 것이 아니다) */
function fleeStep(s: HaebiRun, e: Mob, dt: number) {
  const x = e.x - s.x, y = e.y - s.y, d = Math.hypot(x, y) || 1, v = (C.mobSpeed + s.t * C.speedTimeScale) * BD.fleeSpeed
  e.x += x / d * v * dt; e.y += y / d * v * dt; e.flee = e.flee! - dt
  if (e.flee <= 0) { fx(s, 'ring', e.x, e.y, BD.puff, BD.puffColor); e.hp = 0 }
}
/** 67-BUILD2 판마다 — 혼줄(장승 둘 사이)을 지나는 적이 다치고 느려진다 · 우물은 쿨타임이 찼을 때 장수가 곁에 오면 체력을 한 번에 채우고 쿨타임이 돈다 (우물은 판에 하나) */
function build2Step(s: HaebiRun, dt: number) {
  const b = s.build!
  for (const e of s.enemies) if (e.slow) e.slow = Math.max(0, e.slow - dt)
  const links = totemLinks(b)
  if (links.length) {
    const dps = mobHp(s) * totemLineShare(s.ranks.totem) * fireMul(s)
    for (const e of s.enemies) {
      if (e.hp <= 0 || e.giant) continue
      for (const [p, q] of links) if (segmentDistance(e.x, e.y, p.x, p.y, q.x, q.y) < B2.totem.lineW + mobRadius(e)) { e.slow = B2.totem.lineSlowT; BUILD_TALLY.src = true; hit(s, e, dps * dt, false, null, undefined, true); BUILD_TALLY.src = false; break }
    }
  }
  if (s.buffs?.length) tickStatuses(s.buffs, dt, amount => { const h0 = s.hp; s.hp = Math.min(s.maxHp, s.hp + amount); BUILD_TALLY.healed += s.hp - h0; return s.hp - h0 }, (_k, n) => { s.waterPulse = { at: s.t, n } })
  const w = s.ranks.well ?? 0
  if (w) for (const it of b.items) {
    if (it.kind !== 'well' || !standing(it)) continue
    it.cd = Math.max(0, it.cd - dt)
    if (it.cd > 0 || s.hp >= s.maxHp || Math.hypot(s.x - it.x, s.y - it.y) >= wellRadius(w)) continue
    // 74-BUFF: 한 번에 채우지 않고 물기운을 붙인다 (체력이 가득이면 붙이지 않는 건 그대로 — 쿨타임만 쓰고 한 방울도 못 받는 일이 없게)
    if (s.buffs) { if (addStatus(s.buffs, 'water', B2.well.time, s.maxHp * wellShare(w) * B2.well.buffMul)) { it.cd = wellCool(w); it.flash = BU.flash }; continue }
    const h0 = s.hp; s.hp = Math.min(s.maxHp, s.hp + s.maxHp * wellShare(w)); BUILD_TALLY.healed += s.hp - h0
    it.cd = wellCool(w); it.flash = BU.flash
    fx(s, 'ring', s.x, s.y, B2.view.heal.ring, B2.view.heal.color); s.fx[s.fx.length - 1]!.wellHeal = Math.round(s.hp - h0)
  }
}
/** 설치물 한 걸음 — 망루 화살 · 봉수대·포차 (67) · 무너진 것은 잔해로 rebuild 초 뒤 같은 자리에 다시 선다 (항아리·솟대·봉수대·우물은 무적) */
function buildStep(s: HaebiRun, dt: number, tempo: number) {
  const b = s.build!
  let rebuilt = false
  for (const it of b.items) {
    it.flash = Math.max(0, it.flash - dt); it.push = Math.max(0, it.push - dt)
    if (bearsHp(it)) {
      if (it.down > 0) { it.down -= dt; if (it.down <= 0) { it.down = 0; it.max = buildHp(it.kind, s.ranks[it.kind], !!b.wall) * threat(s); it.hp = it.max; rebuilt = true } continue }
      if (it.hp <= 0) { it.hp = 0; it.down = rebuildOf(it.kind); fx(s, 'thud', it.x, it.y, bodyR(it) * 2, '#c9a27a'); continue }
    }
    if (it.kind === 'beacon') { beaconStep(s, it, dt, tempo); continue }
    if (it.kind === 'catapult') { catapultStep(s, it, dt, tempo); continue }
    if (it.kind !== 'tower') continue
    it.cd -= dt
    if (it.cd > 0) continue
    const t = nearest(s, it.x, it.y, undefined, BU.tower.range)
    if (!t) { it.cd = 0; continue }
    const at = aimAt(t, it.x, it.y)
    shoot(s, 'tower', Math.atan2(at.y - it.y, at.x - it.x), towerShot(s), it.x, it.y)
    it.cd = reloadIv(s, towerFire(s.ranks.tower) / tempo); it.flash = BU.flash
  }
  if (rebuilt) settleBuild(s)
  if (b.v2) build2Step(s, dt)
}
export function stepHaebi(s: HaebiRun, input: RunInput, dt: number) {
  if (s.state !== 'playing' || s.offers.length) return
  dt = Math.max(0, Math.min(.05, dt))
  // 시전 동안 판이 느려진다 (컷인을 보고 → 터지는 것을 본다 · 11-17 형)
  if (s.cast) dt *= castSlow(s.cast)
  s.t += dt
  if (s.wide) gateStep(s, dt)
  const boost = formBoost(s)
  for (const key of ['attack', 'hurt', 'inv', 'dash', 'dashCd', 'messageTime', 'streakTime'] as const) s[key] = Math.max(0, s[key] - dt)
  s.skillCd = Math.max(0, s.skillCd - dt * boost.ult)
  // 각성(투지)이 풀리면 보통 모습으로 · 막대는 처음부터 다시 (각성 시전 동안은 각성 시간이 줄지 않는다)
  if (s.form !== 'normal' && s.cast?.kind !== 'wake') { s.formT = Math.max(0, s.formT - dt); if (!s.formT) { s.form = 'normal'; s.ward = 0 } }   // 11-19 형: 「풀리면 풀린 거지 「다시 모아라」 글은 지워야」
  if (!s.streakTime) s.comboKills = 0
  for (const key of Object.keys(s.cool) as Cool[]) s.cool[key] = Math.max(0, s.cool[key] - dt)
  s.hp = Math.min(s.maxHp, s.hp + (C.regen + s.bonus.regen * SH.regen.step + s.ranks.breath * T.breath) * dt)
  const len = Math.hypot(input.x, input.y), divisor = Math.max(1, len)
  let dx = input.x / divisor, dy = input.y / divisor
  s.moving = len > .05
  if (dx) s.face = Math.sign(dx)
  if (input.dash && !s.dashCd) { s.dash = C.dashTime; s.dashCd = C.dashCooldown * (1 - s.ranks.nimble * T.nimble); s.inv = C.dashInv }
  if (s.dash && !len) dx = s.face
  const speed = C.speed * (1 + s.bonus.swift * SH.swift.step + s.ranks.nimble * T.nimbleMove) * (s.dash ? C.dashSpeed : 1) * boost.move
  const fromX = s.x, fromY = s.y
  s.x = heroX(s, s.x + dx * speed * dt); s.y = heroY(s, s.y + dy * speed * dt)
  if (s.solids) pushOutOfSolids(s.solids, s, WL.heroR)
  if (s.build) heroPush(s, fromX, fromY)   // 65-BUILD 설치물은 지나가지 못하고 몸으로 민다
  // 56-C 목책: 성한 마디는 못 지나간다 (막은 마디 쪽으로 밀고 있으면 아래에서 내려친다)
  const pushed = s.palisade ? wallMove(s.palisade, s, fromX, fromY, WL.heroR) : null
  if (s.kits) kitMove(s, dx, dy, dt)
  if (s.giantFlow) for (const e of s.enemies) if (e.giant && e.hp > 0) {
    // 불가사리만 목책을 넘겨받는다 (큰 문 씹기 · 박치기가 박힌 마디 · 출현 자리 마디)
    const wall = e.giant.kind === 'bulgasari' && s.palisade ? { wall: s.palisade, smash: (i: number, amount: number, x: number) => { const p = s.palisade!.pieces[i]; if (p) wallDamage(s, p, amount, x) } } : {}
    const cue = stepGiant(e.giant, e, { dt, tick: Math.round(s.t * 120), player: s, speed: C.speed * (1 + s.bonus.swift * SH.swift.step + s.ranks.nimble * T.nimbleMove) * boost.move, dazed: e.daze > 0, random: () => random(s), ...wall })
    if (cue) { fx(s, 'ring', e.x, e.y, 65, '#e8dcc0'); s.fx[s.fx.length - 1]!.championCue = cue }
  }
  const power = powerScale(s) * boost.power, area = areaScale(s), tempo = (1 + s.ranks.tempo * C.tempoStep + s.bonus.haste * SH.haste.step) * boost.tempo
  if (s.palisade) { tickPalisade(s.palisade, dt); if (pushed) heroBash(s, pushed, dx, dy, power, tempo) }
  // 3층 비기 강화 (조합 하나를 끝 단계로)
  const up = ultUpgraded(s), uPower = power * (up ? T.ultDamage : 1), uArea = area * (up ? T.ultArea : 1)
  // 시전: 비기·각성을 누르면 cast 초 뒤 터진다 · 그동안 다른 비기·각성은 기다린다 (각성 컷인과 비기 컷인이 겹치지 않게 · 11-17 형)
  if (s.cast) {
    s.cast.t -= dt
    if (s.cast.t <= 0) {
      const c = s.cast; s.cast = null
      if (c.kind === 'wake') wakeBurst(s)
      else {
        s.trueUlt = c.tru
        if (usesPermanentAwakening(s)) { s.ultAwakened = c.awakened === true; s.ultEmpowered = c.empowered === true }
        const empowered = usesPermanentAwakening(s) ? c.empowered === true : c.tru
        if (usesAwakenedCast(s) && c.awakened && c.seq !== undefined) {
          for (const e of s.enemies) if (e.hp > 0) e.daze = Math.max(e.daze, AC.enemyDaze)
          s.ultReleaseSeq = c.seq
        }
        ultimate(s, dx, dy, uPower * (empowered ? U.trueDamage : 1), uArea * (empowered ? U.trueArea : 1))
      }
    }
  } else if (input.wake && wakeReady(s)) awaken(s)
  else if (input.skill && !s.skillCd && ultOpen(s)) startUlt(s, input.shortCutin)
  // 되받아치기 (버팀 끝): 맞은 다음 걸음에 비기가 작게 · 이어지는 비기가 도는 중이면 건너뛴다
  if (s.counterDue) { s.counterDue = false; if (!s.ult) { s.trueUlt = false; if (usesPermanentAwakening(s)) { s.ultAwakened = isPermanentAwake(s); s.ultEmpowered = false }; ultimate(s, dx, dy, uPower, uArea, true, T.counter + T.counterStep * (s.ranks.capC - 1)) } }
  if (s.ult) ultTick(s, dt, uPower * (ultEmpowered(s) ? U.trueDamage : 1), uArea * (ultEmpowered(s) ? U.trueArea : 1))
  const target = nearest(s, s.x, s.y, undefined, Infinity, true)
  let aimAngle: number | null = null
  if (s.kits) { KC.power = power; KC.area = area; KC.tempo = tempo }
  if (target && s.kits) {
    // 58-KITS: 묶음마다 다른 꼴 · 부적·벽력은 무기가 맞힌 데서 (addOns)
    const at = aimAt(target, s.x, s.y), dist = Math.hypot(at.x - s.x, at.y - s.y)
    aimAngle = Math.atan2(at.y - s.y, at.x - s.x)
    primary58(s, target, aimAngle, dist, power, area, tempo)
    secondary58(s, target, aimAngle, dist, power, tempo)
  } else if (target) {
    const at = aimAt(target, s.x, s.y), angle = Math.atan2(at.y - s.y, at.x - s.x), dist = Math.hypot(at.x - s.x, at.y - s.y)
    primary(s, target, angle, dist, power, area, tempo)
    secondary(s, target, angle, power, tempo)
    if (s.ranks.ember && !s.cool.ember) {
      s.cool.ember = C.emberCooldown / tempo
      const targets = s.enemies.filter(e => e.hp > 0 && aimable(s, e))
      for (let i = 0; i < 1 + s.ranks.echo; i++) { const e = i ? targets[Math.floor(random(s) * targets.length)] : target; if (e) { const at = aimAt(e, s.x, s.y); shoot(s, 'ember', Math.atan2(at.y - s.y, at.x - s.x), (C.emberDamage + C.emberRankDamage * s.ranks.ember) * power, s.x, s.y, at.x, at.y) } }
    }
    if (s.ranks.thunder && !s.cool.thunder) {
      s.cool.thunder = C.thunderCooldown / tempo
      const used: number[] = []; let x = aimAt(target, s.x, s.y).x, y = aimAt(target, s.x, s.y).y - 160
      for (let i = 0; i < 2 + Math.ceil(s.ranks.thunder / 2) + s.ranks.echo; i++) {
        const e = i === 0 ? target : nearest(s, x, y, used, C.thunderRange * area)
        if (!e) break
        const origin = { x, y }, at = aimAt(e, x, y); used.push(e.id); fx(s, 'bolt', x, y, 1, '#b8d5ff', 0, at.x, at.y); x = at.x; y = at.y
        hit(s, e, (C.thunderDamage + s.ranks.thunder * C.thunderRankDamage) * power, false, origin)
        if (s.combos.includes('inferno')) blast(s, x, y, C.emberRange * area, C.emberDamage * power * cp(s, 'inferno'))
      }
    }
  }
  if (s.kits) aura58(s, aimAngle, power, area, dt); else aura(s, power, area)
  if (s.build) buildStep(s, dt, tempo)
  s.spawn -= dt
  const rate = s.mode === 'vanguard' ? V.spawnEarly + (V.spawnLate - V.spawnEarly) * s.t / V.duration : spawnRate(s)
  if (s.spawn <= 0) { if (s.enemies.length < (s.duel ? duelCap(s) : C.maxEnemies)) spawnMob(s); s.spawn = 1 / (rate * ST[s.stage].spawn * (respite(s) ? C.respiteSpawn : 1) * (s.duel ? duelSpawn(s) : 1)) }
  if (s.mode !== 'vanguard' && s.t >= s.nextElite && s.nextElite < bossTime(s)) { spawnMob(s, 'elite', input.viewBounds); s.nextElite += C.eliteEvery * ST[s.stage].length; if (s.mode !== 'stage') announce(s, `${ST[s.stage].eliteName} · 쓰러뜨리면 기세 대량 획득`) }
  if (s.giantFlow && !s.giantFlow.midSpawned && s.t >= midbossTime(s)) { spawnMob(s, 'boss', input.viewBounds); const mid = s.enemies[s.enemies.length - 1]!; mid.bossRole = 'midboss'; mid.hp *= giantMidHpScale(giantKind(s)); mid.max = mid.hp; s.giantFlow.midSpawned = true }
  if (s.giantFlow && !s.giantFlow.finalSpawned && s.t >= bossTime(s)) { const at = s.fx.length; spawnGiant(s, input.viewBounds); if (s.duel) bossRout(s, at) }
  if (!s.giantFlow && s.mode !== 'vanguard' && !s.boss && s.t >= bossTime(s)) { const at = s.fx.length; spawnMob(s, 'boss', input.viewBounds); s.boss = true; if (s.duel) bossRout(s, at); if (s.mode !== 'stage') announce(s, '마지막 두목 · 완성한 힘을 쏟아부어라') }
  if (s.mode === 'vanguard' && s.captains < 3 && s.breaches === s.captains && s.t >= V.captainAt[s.captains]!) {
    spawnMob(s, 'boss'); s.captains++
    announce(s, `제${s.captains} 전위대장 출현 · 금빛 표적을 향해 돌파하라`)
  }
  const source = s.mode === 'stage' ? input.barrageSource === undefined ? barrageArcher(s) : s.enemies.find(e => e.id === input.barrageSource && e.kind === 'archer' && e.hp > 0 && onField(s, e)) : undefined
  // 발사자가 안 보이는 동안 밀린 사격을 쌓아 두지 않는다.
  if (s.mode === 'stage' && !source) s.nextBarrage = Math.max(s.nextBarrage, s.t)
  if (s.mode !== 'vanguard' && (s.mode !== 'stage' || source) && s.t >= s.nextBarrage) {
    // 산적 일제 사격: 서 있는 자리에 붉은 고리가 먼저 뜨고 잠시 뒤 떨어진다 — 움직이면 안 맞고, 서 있으면 다 맞는다 (형 11-15: 가만히 있어도 깬다)
    const k = Math.min(1, s.t / bossTime(s)), damage = C.barrageDamage * (1 + s.t * C.barrageTimeScale)
    const fire = (x: number, y: number) => { const b = shoot(s, 'barrage', 0, damage, x, y); if (b && source) b.source = source.id }
    fire(s.x, s.y)
    for (let i = 0; i < Math.floor(k * C.barrageExtra + .5); i++) { const a = random(s) * Math.PI * 2, d = C.barrageRadius * (1.4 + random(s) * 1.6); fire(heroX(s, s.x + Math.cos(a) * d), heroY(s, s.y + Math.sin(a) * d)) }
    s.nextBarrage += C.barrageEvery + (C.barrageEveryLate - C.barrageEvery) * k
  }
  for (const e of s.enemies) {
    if (e.hp <= 0) continue
    if (e.flee !== undefined) { fleeStep(s, e, dt); continue }
    e.cd = Math.max(0, e.cd - dt); e.flash = Math.max(0, e.flash - dt); e.buff = Math.max(0, e.buff - dt)
    // 독 비수: 독이 도는 동안 초마다 깎인다 (숫자는 띄우지 않는다)
    if (e.giant) {
      if (e.poison > 0) { e.poison = Math.max(0, e.poison - dt); const part = giantPart(e.giant, e.giant.poisonPart); const point = part ? closestPoint(s, part.collider) : aimAt(e, s.x, s.y); hit(s, e, e.pdps * dt, false, null, disk(point.x, point.y, 0), true) }
      e.daze = Math.max(0, e.daze - dt); continue
    }
    if (e.poison > 0) { e.poison -= dt; const bite = e.pdps * dt * championDamageScale(e, null); if (bite >= e.hp) { hit(s, e, e.hp + 1, false, null); continue } e.hp -= bite; s.damage += bite }
    // 진탕격: 멈춰 선 동안은 걷지도 치지도 못한다
    if (e.daze > 0) { e.daze = Math.max(0, e.daze - dt); continue }
    if (e.champion) {
      const ox = e.x, oy = e.y, dashing = e.champion.mode === 'dash'
      const hooks: ChampionHooks = {
        hurt: amount => hurt(s, amount),
        fan: angle => { const b = shoot(s, 'enemy', angle, CH.fanDamage, e.x, e.y); if (b) { b.vx = Math.cos(angle) * CH.fanSpeed; b.vy = Math.sin(angle) * CH.fanSpeed; b.life = CH.fanLife; b.championShot = true } },
        // 부른 졸개는 목책 너머에 생기지 않는다 (부른 자리에서 잰다)
        summon: (kind, x, y) => { if (s.enemies.length < C.maxEnemies) { const at = s.enemies.length; spawnMob(s, kind, undefined, true); for (const child of s.enemies.slice(at)) { if (s.duel) child.summoned = true; const f = fieldBounds(s); child.x = Math.max(f.left + 20, Math.min(f.right - 20, x)); child.y = Math.max(f.top + 30, Math.min(f.bottom - 20, y)); if (s.palisade) wallMove(s.palisade, child, e.x, e.y, mobRadius(child)) } } },
        cue: cue => { fx(s, 'ring', e.x, e.y - 20, 65, '#e8dcc0'); s.fx[s.fx.length - 1]!.championCue = cue },
      }
      // 56-C: 정예는 문으로 돌아 오고 · 두목은 목책을 부수며 곧장 온다 (돌진은 둘 다 박힌다)
      const bitten = s.build?.wall ? wallTouching(s.build, e, mobRadius(e)) : []
      for (const w of bitten) { w.hp -= C.contactDamage * threat(s) * HW.championBite * dt; w.flash = BU.flash }
      stepChampion(s, e, dt, hooks, s.palisade && e.kind !== 'boss' && wallAim(s.palisade, e.x, e.y, s.x, s.y, WL.bigR, AIM) ? AIM : null)
      if (s.palisade) championWall(s, e, ox, oy, dashing, dt, hooks)
      continue
    }
    const x = s.x - e.x, y = s.y - e.y, d = Math.hypot(x, y) || 1
    const kind = e.kind, m = kind === 'elite' || kind === 'boss' ? null : M[kind]
    // 65-BUILD 목책: 닿은 잡졸은 멈춰 서서 목책을 친다 (그동안 걷지도 장수를 치지도 않는다)
    if (s.build?.wall && m) { const hit = wallTouching(s.build, e, mobRadius(e)); if (hit.length) { for (const w of hit) { w.hp -= C.contactDamage * threat(s) * (m.hit ?? 1) * HW.bite * dt; w.flash = BU.flash }; continue } }
    else if (s.build && m) { const f = fenceTouching(s.build, e, mobRadius(e)); if (f) { f.hp -= C.contactDamage * threat(s) * (m.hit ?? 1) * BU.fence.bite * dt; f.flash = BU.flash; continue } }
    const v = (C.mobSpeed + s.t * C.speedTimeScale) * (m?.speed ?? 1) * (s.pace ? 1 + ((PC.speedBoost as Record<string, number>)[s.stage] ?? 0) * paceFade(s) : 1) * (e.buff > 0 ? M.shamanSpeed : 1) * (kind === 'berserker' && e.hp < e.max / 2 ? M.berserkSpeed : 1) * (s.build?.v2 ? mobSlow(s, e) : 1)
    // 65-BUILD 망루 어그로: 붙어 싸우는 잡졸 셋에 하나가 가까운 망루로 끌려가 친다
    if (s.build && m && !rangedMob(kind) && towerAggro(s, e, m.hit ?? 1, v, dt)) continue
    const ch = charge(kind)
    // 56-C 목책: 걷는 방향만 문 쪽으로 돈다 (거리·겨눔·돌진은 그대로 장수 쪽 · 돌진은 목책에 박힌다)
    let mx = x / d, my = y / d
    const ox = e.x, oy = e.y, rushing = !!ch && e.act < 0
    if (s.palisade && wallAim(s.palisade, e.x, e.y, s.x, s.y, mobRadius(e), AIM)) { const ax = AIM.x - e.x, ay = AIM.y - e.y, ad = Math.hypot(ax, ay) || 1; mx = ax / ad; my = ay / ad }
    if (e.wind > 0) { e.wind -= dt; if (e.wind <= 0 && Math.hypot(s.x - e.aimX, s.y - e.aimY) < slamRadius(kind)) hurt(s, kind === 'bear' ? M.bearDamage * threat(s) : C.bossDamage) }
    else if ((kind === 'boss' || kind === 'elite') && d < 180 && !e.cd) { e.wind = C.bossWindup; e.aimX = s.x; e.aimY = s.y; e.cd = C.bossCooldown }
    // 반달곰: 가까이 오면 일어서서(바닥 원) 내려친다
    else if (kind === 'bear' && d < M.bearRange && !e.cd) { e.wind = M.bearWind; e.aimX = s.x; e.aimY = s.y; e.cd = M.bearCooldown }
    else if (ch && e.act > 0) {
      // 창돌격꾼·범: 예고(붉은 줄) 동안 멈춰 겨눈다 → 곧게 돌진(범은 길게 덮침)
      e.act -= dt; if (e.act <= 0) e.act = -ch.dash
    } else if (ch && e.act < 0) {
      e.act = Math.min(0, e.act + dt); e.x += e.vx * v * ch.speed * dt; e.y += e.vy * v * ch.speed * dt
      const f = fieldBounds(s); e.x = Math.max(f.left + 10, Math.min(f.right - 10, e.x)); e.y = Math.max(f.top + 20, Math.min(f.bottom - 10, e.y)); if (!e.act) e.cd = ch.cd
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
      if (d > 23) { e.x += mx * v * dt; e.y += my * v * dt }
    } else if (kind === 'archer' && d < C.archerRange) { if (!e.cd) { shoot(s, 'enemy', Math.atan2(y, x), C.enemyShotDamage * (1 + s.t * C.shotTimeScale), e.x, e.y); e.cd = C.archerCooldown } }
    else if ((kind === 'slinger' || kind === 'firearcher') && d < M.lobRange) {
      // 투석꾼·불화살: 서 있는 자리에 고리 → 잠시 뒤 떨어짐 (불화살은 불바닥을 남김)
      if (!e.cd) { shoot(s, 'stone', 0, M.lobDamage * threat(s), s.x, s.y, e.x, e.y, kind === 'firearcher' ? 1 : 0); e.cd = M.lobCooldown }
    } else if (kind === 'shaman' && d < M.shamanRange) {
      if (!e.cd) { e.cd = M.shamanEvery; fx(s, 'buff', e.x, e.y, M.shamanRadius, '#ff5a4a'); for (const o of s.enemies) if (o !== e && Math.hypot(o.x - e.x, o.y - e.y) < M.shamanRadius) o.buff = M.shamanBuff }
    } else if (d > 23) { e.x += mx * v * dt; e.y += my * v * dt }
    if (s.palisade) {
      const p = wallMove(s.palisade, e, ox, oy, mobRadius(e))
      // 창돌격꾼 돌진이 성한 마디에 박혔다 — 크게 깎고 돌진은 거기서 끝
      if (p && rushing) { wallDamage(s, p, WL.chargeBreak, Math.max(p.x0, Math.min(p.x1, e.x))); e.act = 0; e.cd = ch!.cd }
    }
    if (d < 26 && !e.cd) { hurt(s, C.contactDamage * threat(s) * (m?.hit ?? 1)); e.cd = 1 }
  }
  if (s.wide) herdWide(s)
  if (s.build) {
    // 65-BUILD: 적은 설치물을 지나가지 못한다 (밀지도 못한다) · 거대 보스는 막히지 않고 몸에 닿은 설치물을 밀쳐 낸다
    for (const e of s.enemies) if (e.hp > 0 && !e.giant) pushOutOfBuild(s.build, e, mobRadius(e))
    let shoved = false
    for (const e of s.enemies) if (e.giant && e.hp > 0) for (const it of s.build.items) {
      if (!standing(it) || !giantContact(e, disk(it.x, it.y, bodyR(it)))) continue
      const dx = it.x - e.x, dy = it.y - e.y, d = Math.hypot(dx, dy) || 1
      it.x += dx / d * BU.shove * dt; it.y += dy / d * BU.shove * dt; it.push = BU.pushDust; shoved = true
    }
    if (shoved) settleBuild(s)
  }
  if (s.solids) {
    for (const e of s.enemies) if (e.hp > 0 && !e.giant) pushOutOfSolids(s.solids, e, mobRadius(e))
    for (const d of s.drops) pushOutOfSolids(s.solids, d, 0)
    for (const c of s.chests ?? []) if (c.state === 'ground') pushOutOfSolids(s.solids, c, 0)
  }
  // 목책 띠 안에 남은 적이 없게 (부른 졸개 · 여러 밀림이 겹친 때) — 가까운 쪽으로
  if (s.palisade) for (const e of s.enemies) if (e.hp > 0 && !e.giant) wallSettle(s.palisade, e, mobRadius(e))
  // Iterate a snapshot: splitting missiles are simulated starting on the next tick.
  for (const b of [...s.shots]) {
    BUILD_TALLY.src = b.kind === 'tower' || b.kind === 'signal' || b.kind === 'lob'
    const from = { x: b.x, y: b.y }
    const travel = b.championShot ? Math.max(0, Math.min(dt, b.life)) : dt
    b.x += b.vx * travel; b.y += b.vy * travel; b.life -= dt
    if (b.kind === 'gale' || b.kind === 'ember' || b.kind === 'shard' || b.kind === 'enemy') b.angle += dt * 10
    if (b.kind === 'enemy' || b.kind === 'hurl') { if (Math.hypot(b.x - s.x, b.y - s.y) < (b.championShot ? CH.fanHitRadius : 20)) { hurt(s, b.damage); b.life = 0 } }
    else if (b.kind === 'stone') {
      if (b.life <= 0) { fx(s, 'blast', b.x, b.y, b.radius, b.gen ? '#ff7a3a' : '#c9b08a'); if (Math.hypot(b.x - s.x, b.y - s.y) < b.radius) hurt(s, b.damage); if (b.gen) shoot(s, 'flame', 0, M.flameDamage, b.x, b.y) }
    } else if (b.kind === 'flame') { if (Math.hypot(b.x - s.x, b.y - s.y) < b.radius) hurt(s, b.damage) }
    else if (b.kind === 'ember' && s.kits && b.source !== undefined) {
      // 58-KITS 붙은 부적: 붙은 적을 따라가다 delay 초 뒤(그 적이 먼저 쓰러지면 그 자리에서) 터진다
      const t = s.enemies.find(e => e.id === b.source && e.hp > 0)
      if (t) { const at = aimAt(t, s.x, s.y); b.x = at.x; b.y = at.y }
      if (!t || b.life <= 0) { blast(s, b.x, b.y, (C.emberRange + s.ranks.ember * 10) * area, b.damage); b.life = 0 }
    } else if (b.kind === 'ember') {
      if (Math.hypot(b.x - b.tx, b.y - b.ty) < 20 || b.life <= 0) { blast(s, b.x, b.y, (C.emberRange + s.ranks.ember * 10) * area, b.damage); b.life = 0 }
    } else if (b.kind === 'pebble') {
      // 돌팔매: 떨어진 자리 둘레를 치고 밀어낸다 (위에서 떨어지니 방패로 못 막는다)
      if (b.life <= 0) {
        fx(s, 'thud', b.tx, b.ty, b.radius, '#d8c8a8')
        const land = () => { for (const e of s.enemies) {
          const d = Math.hypot(e.x - b.tx, e.y - b.ty)
          if (e.hp <= 0 || !inRadius(e, b.tx, b.ty, b.radius)) continue
          // 58-KITS: 장수 바로 곁에 떨어진 돌은 반만 아프다 (돌팔매는 거리를 벌린다)
          hit(s, e, s.kits && Math.hypot(e.x - s.x, e.y - s.y) < K.sling.near ? b.damage * K.sling.nearShare : b.damage, true, null, disk(b.tx, b.ty, b.radius), false, primaryShotDirection(b))
          if (e.hp > 0 && !steady(e)) pushMob(s, e, (e.x - b.tx) / (d || 1) * C.slingKnock, (e.y - b.ty) / (d || 1) * C.slingKnock)
          // 땅울림 (팔매 갈래 끝): 떨어진 둘레가 잠시 멈춘다 (두목·정예·철갑·곰은 버틴다)
          if (s.ranks.capA && s.kit === 'sling' && e.hp > 0 && !steady(e) && e.kind !== 'elite') e.daze = Math.max(e.daze, T.cap.sling.a.daze + T.cap.sling.a.daStep * (s.ranks.capA - 1))
        } }
        if (!s.kits) land()
        else {
          const hits = collect(land); addOns(s, hits, hits.length >= K.sling.bigHits)
          // 58-KITS: 떨어진 돌이 앞으로 한 번 더 튄다 (튄 돌은 다시 안 튄다)
          if (!b.gen) {
            const nx = heroX(s, b.tx + Math.cos(b.angle) * K.sling.bounce * area), ny = heroY(s, b.ty + Math.sin(b.angle) * K.sling.bounce * area)
            const o = shoot(s, 'pebble', b.angle, b.damage * K.sling.bounceShare, b.tx, b.ty, nx, ny, 1)
            if (o) { o.vx = (nx - b.tx) / C.slingFlight; o.vy = (ny - b.ty) / C.slingFlight; o.radius = b.radius }
          }
        }
        if (s.palisade) wallHit(s, disk(b.tx, b.ty, b.radius), 'melee')   // 떨어진 돌은 그 자리 목책도 친다
      }
    } else if (b.kind === 'signal') {
      // 67-BUILD2 봉수대 화살비: 금빛 표식 뒤 그 자리에 떨어진다 (부적·번개는 붙지 않는다)
      if (b.life <= 0) blast(s, b.x, b.y, b.radius, b.damage, '#cfe3ff')
    } else if (b.kind === 'lob') {
      // 67-BUILD2 포차 바위: 포물선으로 날아 떨어진 자리 둘레를 친다 (그을린 자국 · 패인 자국)
      if (b.life <= 0) { blast(s, b.tx, b.ty, b.radius, b.damage, '#ff9a55'); fx(s, 'thud', b.tx, b.ty, b.radius, '#c9a27a') }
    } else if (b.kind === 'barrage') {
      if (s.mode === 'stage' && (!source || b.source !== source.id || source.hp <= 0)) { b.life = 0; continue }
      if (b.life <= 0) { fx(s, 'blast', b.x, b.y, C.barrageRadius, '#ff8a5c'); if (Math.hypot(b.x - s.x, b.y - s.y) < C.barrageRadius) hurt(s, b.damage) }
    } else if (b.kind === 'rain') {
      if (b.life <= 0) {
        if (s.kits) addOns(s, collect(() => blast(s, b.x, b.y, C.rainRadius * area, b.damage, '#cfe3ff')), false)
        else blast(s, b.x, b.y, C.rainRadius * area, b.damage, '#cfe3ff')
        // 유성 화살비: 58-KITS 는 떨어진 자리에서 장수와 먼 쪽으로만 부채 (사방이 아니다)
        const away = Math.atan2(b.y - s.y, b.x - s.x)
        if (s.combos.includes('meteor')) for (let i = 0; i < 3; i++) shoot(s, 'shard', s.kits ? away + (i - 1) * K.shard.spread : i * Math.PI * 2 / 3 + s.t, b.damage * C.splitDamage * cp(s, 'meteor'), b.x, b.y)
        // 폭우 (화살비 갈래 끝): 같은 자리에 한 번 더 (두 번째는 다시 안 부른다)
        if (!b.gen && s.kit === 'bow' && s.ranks.capB) { const c = T.cap.bow.b, again = shoot(s, 'rain', 0, b.damage * capShare(s.ranks.capB, c), b.x, b.y, b.x, b.y, 1); if (again) again.life = c.delay }
      }
    } else if (s.kits && b.kind === 'gale' && b.gen !== 1) {
      // 58-KITS 질풍 도끼: 높이 던져 날아가는 동안은 치지 않고 · 떨어지면 둘레를 치고 박힌 채 돌며 · 질풍회륜(갈래 끝)이면 장수 쪽으로 돌아오며 벤다
      const P = K.gale
      if (!b.landed) {
        if (b.life > P.spin) continue
        b.landed = true; b.vx = 0; b.vy = 0; b.x = b.tx; b.y = b.ty; b.tick = P.spinEvery
        addOns(s, collect(() => blast(s, b.x, b.y, P.splash * area, b.damage, '#96e9cf')), false)
        // 천 갈래 바람 (조합): 떨어진 자리에서 앞으로 조각 셋
        if (s.combos.includes('torrent')) for (let i = 0; i < 3; i++) shoot(s, 'shard', b.angle + (i - 1) * K.shard.spread, b.damage * .6 * cp(s, 'torrent'), b.x, b.y)
      }
      b.tick = (b.tick ?? 0) - dt
      if (b.tick <= 0) {
        b.tick = P.spinEvery
        const r = P.spinRadius * area
        addOns(s, collect(() => { for (const e of s.enemies) if (e.hp > 0 && inRadius(e, b.x, b.y, r)) hit(s, e, b.damage * P.spinShare, false, { x: b.x, y: b.y }, disk(b.x, b.y, r)) }), false)
        if (s.palisade) wallHit(s, disk(b.x, b.y, r), 'splash')
      }
      if (b.life <= 0 && s.ranks.capB) {
        const a = Math.atan2(s.y - b.y, s.x - b.x)
        b.vx = Math.cos(a) * C.galeSpeed; b.vy = Math.sin(a) * C.galeSpeed; b.angle = a; b.hit = []; b.gen = 1; b.landed = false; b.life = C.galeLife * T.cap.axe.b.turn; b.damage *= capShare(s.ranks.capB, T.cap.axe.b)
      }
    } else {
      // 회귀창(조합) · 질풍회륜(질풍 갈래 끝): 날아가던 것이 장수 쪽으로 되돌아오며 다시 꿰뚫는다
      const back = b.gen ? 0 : b.kind === 'javelin' && s.combos.includes('boomerang') && b.life < C.javelinLife * C.boomerangTurn ? cp(s, 'boomerang')
        : b.kind === 'gale' && s.kit === 'axe' && s.ranks.capB && b.life < C.galeLife * T.cap.axe.b.turn ? capShare(s.ranks.capB, T.cap.axe.b) : 0
      if (back) {
        const a = Math.atan2(s.y - b.y, s.x - b.x), v = Math.hypot(b.vx, b.vy)
        b.vx = Math.cos(a) * v; b.vy = Math.sin(a) * v; b.angle = a; b.hit = []; b.gen = 1; b.damage *= back
      }
      if (b.kind === 'soul') {
        // 혼불: 가장 가까운 적 쪽으로 천천히 꺾는다
        const t = nearest(s, b.x, b.y)
        if (t) { const want = Math.atan2(aimAt(t, b.x, b.y).y - b.y, aimAt(t, b.x, b.y).x - b.x); let turn = want - b.angle; turn = Math.atan2(Math.sin(turn), Math.cos(turn)); b.angle += Math.max(-C.soulTurn * dt, Math.min(C.soulTurn * dt, turn)); b.vx = Math.cos(b.angle) * C.soulSpeed; b.vy = Math.sin(b.angle) * C.soulSpeed }
      }
      if (b.kind === 'wave' && !b.gen && b.life <= 0 && s.combos.includes('splitwave')) for (const turn of [-.6, .6]) shoot(s, 'wave', b.angle + turn, b.damage * C.splitDamage * cp(s, 'splitwave'), b.x, b.y, b.x, b.y, 1)
      for (const e of s.enemies) {
        if (e.hp <= 0 || b.hit.includes(e.id)) continue
        const contact = e.giant ? giantSweep(e.giant, from, b, b.radius) : null
        if (e.giant ? !contact : Math.hypot(b.x - e.x, b.y - e.y) > b.radius + 18) continue
        if (b.kind === 'soul') {
          const burst = () => blast(s, contact?.point.x ?? b.x, contact?.point.y ?? b.y, C.soulRadius * areaScale(s), b.damage, '#9fd8ff')
          if (s.kits) addOns(s, collect(burst), false); else burst()
          b.life = 0
          // 분열혼불 (혼불 갈래 끝): 터진 자리에서 작은 혼불로 갈라져 다른 적을 쫓는다 (갈라진 것은 다시 안 갈라진다)
          if (!b.gen && s.kit === 'magic' && s.ranks.capB) for (let i = 0, n = T.cap.magic.b.split; i < n; i++) { const o = shoot(s, 'soul', b.angle + (i - (n - 1) / 2) * 1.6, b.damage * capShare(s.ranks.capB, T.cap.magic.b), b.x, b.y, b.x, b.y, 1); if (o) o.hit.push(e.id) }
          break
        }
        hit(s, e, b.damage * (e.kind === 'shield' ? M.shieldBlock : 1), true, { x: b.x - b.vx * dt, y: b.y - b.vy * dt }, contact ?? undefined, false, primaryShotDirection(b)); b.hit.push(e.id)
        if (s.kits && b.kind !== 'tower') addOns(s, [e], !!b.big)
        if (b.kind === 'boulder' && e.hp > 0 && !steady(e)) { const v = Math.hypot(b.vx, b.vy) || 1; pushMob(s, e, b.vx / v * C.boulderKnock, b.vy / v * C.boulderKnock) }
        if (b.kind === 'skip') {
          // 연환석: 맞힌 적 곁의 다음 적으로 튄다 · 진탕격이면 멈춰 세운다 (두목·정예·철갑·곰은 버틴다)
          if (s.combos.includes('daze') && e.hp > 0 && !steady(e) && e.kind !== 'elite') e.daze = C.dazeTime * cp(s, 'daze')
          const n = b.hit.length < pierce(s, b) ? nearest(s, b.x, b.y, b.hit, C.skipRange * area) : undefined
          if (!n) { b.life = 0; break }
          const at = aimAt(n, b.x, b.y), a = Math.atan2(at.y - b.y, at.x - b.x); b.vx = Math.cos(a) * C.skipSpeed; b.vy = Math.sin(a) * C.skipSpeed; b.angle = a; b.life = C.skipLife
          // 연쇄격 (갈래 끝): 튈 때마다 세진다
          if (s.kit === 'sling' && s.ranks.capB) b.damage *= 1 + T.cap.sling.b.grow
          break
        }
        if (b.kind === 'knife' && s.combos.includes('venom')) { e.poison = C.venomTime; e.pdps = Math.max(e.pdps, b.damage * C.venomShare * cp(s, 'venom')) }
        // 대지창격 (투창 갈래 끝): 던진 창이 처음 꿰뚫은 자리에서 창날이 솟아 둘레를 친다 (회귀창은 돌아올 때도 한 번)
        if (b.kind === 'javelin' && b.hit.length === 1 && s.kit === 'spear' && s.ranks.capB) { const c = T.cap.spear.b, r = c.radius * area; fx(s, 'spike', e.x, e.y, r, '#e8eefc'); for (const o of s.enemies) if (o !== e && o.hp > 0 && Math.hypot(o.x - e.x, o.y - e.y) < r) hit(s, o, b.damage * capShare(s.ranks.capB, c), true, { x: e.x, y: e.y }); if (s.palisade) wallHit(s, disk(e.x, e.y, r), 'splash') }
        // 폭렬비도 (비도 갈래 끝): 처음 맞힌 자리에서 작은 칼이 사방으로 (튄 칼은 다시 안 튄다)
        if (b.kind === 'knife' && !b.gen && b.hit.length === 1 && s.kit === 'dagger' && s.ranks.capB) for (let i = 0, n = T.cap.dagger.b.shards; i < n; i++) { const o = shoot(s, 'knife', s.kits ? b.angle + (i - (n - 1) / 2) * K.shard.spread : b.angle + (i + 1) * Math.PI * 2 / (n + 1), b.damage * capShare(s.ranks.capB, T.cap.dagger.b), b.x, b.y, b.x, b.y, 1); if (o) o.hit.push(e.id) }
        if (!s.kits && b.kind === 'gale' && s.combos.includes('torrent') && b.hit.length === 1) for (let i = 0; i < 3; i++) shoot(s, 'shard', i * Math.PI * 2 / 3 + b.angle, b.damage * .6 * cp(s, 'torrent'), b.x, b.y)
        if (b.hit.length >= pierce(s, b)) { b.life = 0; break }
      }
    }
  }
  BUILD_TALLY.src = false
  if (s.giantFlow) for (const e of s.enemies) if (e.giant) {
    // 백두 대호 포효(눈보라)는 띠 안의 장수를 바깥으로 밀어낸다 · 불가사리 흡수는 끌어당긴다 (장수가 설 수 있는 판 안까지 · 성한 목책은 넘지 않는다)
    commitGiant(e.giant, e, s, amount => hurt(s, amount, s.bossHit && amount >= BH.from ? BH.share * amount / BH.ref : 0), e.daze > 0, (dx, dy) => { const ox = s.x, oy = s.y; s.x = heroX(s, s.x + dx); s.y = heroY(s, s.y + dy); if (s.palisade) wallMove(s.palisade, s, ox, oy, WL.heroR) })
    syncGiantPose(e.giant, e, Math.round(s.t * 120))
  }
  for (const d of s.drops) {
    d.age += dt; const dx = s.x - d.x, dy = s.y - d.y, dist = Math.hypot(dx, dy) || 1
    // 끌어오는 둘레 안의 것만 날아온다 (기본 + 상점 「끌어오기」) · 못 주운 것은 dropLife 에 사라진다 (11-17 형: 「가운데 가만히 있어도 맵의 모든 돈이 먹어짐」 — 예전엔 반쯤 지나면 어디서든 날아왔다)
    if (dist < magnetRadius(s)) { const travel = Math.min(dist, C.dropSpeed * dt); d.x += dx / dist * travel; d.y += dy / dist * travel }
    if (dist < 22) { s.xp += d.value * (1 + s.bonus.wisdom * SH.wisdom.step); d.value = 0 }
    else if (d.age > C.dropLife) d.value = 0
  }
  s.drops = s.drops.filter(d => d.value > 0); s.enemies = s.enemies.filter(e => e.hp > 0)
  const edge = worldBounds(s)
  s.shots = s.shots.filter(b => b.life > 0 && b.x > edge.left - 60 && b.x < edge.right + 60 && b.y > edge.top - 60 && b.y < edge.bottom + 60 && (s.mode !== 'stage' || b.kind !== 'barrage' || s.enemies.some(e => e.id === b.source && e.hp > 0)))
  for (const f of s.fx) f.life -= dt
  s.fx = s.fx.filter(f => f.life > 0)
  // 되살아나기 (상점 「부활」) — 체력 반으로, 잠깐 무적, 날아오던 것을 지운다
  if (s.hp <= 0 && s.revives > 0) { s.revives--; s.hp = s.maxHp / 2; s.inv = 2; s.shots = s.shots.filter(b => b.kind !== 'enemy' && b.kind !== 'hurl' && b.kind !== 'stone' && b.kind !== 'flame' && b.kind !== 'barrage'); announce(s, '다시 일어선다 · 부활') }
  if (won(s)) { s.hp = Math.max(0, s.hp); expireChests(s); return }
  if (s.hp <= 0 || s.t >= runDuration(s) && !won(s)) { s.hp = Math.max(0, s.hp); s.state = 'lost'; if (s.mode === 'stage' || usesPermanentAwakening(s)) expireChests(s); else s.offers = [] }
  else if (s.state === 'playing') { if (s.mode === 'stage') collectChests(s); if (s.cap && !s.offers.length && s.level >= maxLevel(s)) capOverflow(s); if (!s.offers.length && s.xp >= xpNeeded(s)) offer(s) }
}
