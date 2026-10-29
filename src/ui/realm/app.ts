/**
 * 칠십팔국 — 앱 화면 (docs/realm/FLOW.md §5)
 *
 * 한 화면에 꽉 찬다. 페이지는 내려가지 않는다: 위 상태 줄 · 가운데 지도 · 아래 탭. 탭이나 고을을 누르면
 * 아래에서 판(시트)이 올라오고 그 안만 스크롤한다. 계절을 넘기면 보고가 카드로 뜬다.
 * 화면은 판을 읽기만 하고, 바꾸는 일은 명령을 모아 advance 에 넘기는 것 하나다 (절대 규칙 2 의 정신).
 * 루프·타이머가 없다 — 누르면 다시 그린다 (절대 규칙 4). 글은 FLOW §6: 짧게, AI 말투 금지.
 */
import { aiOrders } from '../../realm/ai.ts'
import { headcount, strength, type Equip, type UnitKind } from '../../realm/battle.ts'
import { CUSTOM_ICON, FACTION_ART, GOOD_ICON, SEASON_ICON, SOL_ANIM2, SOL_ANIM_AR, UNIT_ICON, bustOf, flagIcon, kidBust, nodeIcon, noteGrowing, noteKids } from '../../realm/data/art.ts'
import { NATIONS, type NationInfo } from '../../realm/data/nations.ts'
import { YEONGNAM_NATIONS } from '../../realm/data/nations-yeongnam.ts'
import { SOUTH_NATIONS } from '../../realm/data/nations-south.ts'
import { WORLD_NATIONS } from '../../realm/data/nations-world.ts'
import { HAENGIN_NATION, JUMONG_NATIONS } from '../../realm/data/regions/jumong.ts'
import { MAHAN_NATIONS } from '../../realm/data/regions/mahan.ts'
import { SEORA_NATIONS } from '../../realm/data/regions/seorabeol.ts'
import { chapterOfRegion } from '../../realm/data/campaign.ts'
import { knownOf, knows } from '../../realm/discovery.ts'
import { GRADE_COLOR, GRADE_NAME, TRAIT } from '../../realm/data/traits.ts'
import { CARDS, cardFallback, cardInfo } from '../../realm/data/cards.ts'
import { cardPreview, type CardFx } from '../../realm/events.ts'
import {
  ASK_KIND_NAME, ASK_NAME, deedText, GEAR_NAME, TIER_NAME, PLOT_DOES, PLOT_NAME, askLine, arriveWhen, josa, EDGE_NAME, NODE_KIND_NAME, SEASON_LINE, SETTLED_NAME, STAT_NAME, TAG_LINE, UNIT_NAME, reportText, seasonLabel, whyLine, NODE_NOW, BUILD_NAME, BOW_NAME, CONCEAL_LINE, GOOD_NAME, GOOD_USE, tagNow,
} from '../../realm/data/prose.ts'
import { canEscort, envoyChanceFor, envoyClash, envoyOptions, favorOf, friendly, jointTargets, lentEta, openAsks, relationOf } from '../../realm/diplomacy.ts'
import {
  GOODS, armCost, buildCost, canBuild, canGuard, draftCost, draftIronCost, draftLimit, draftNeeds, draftPay, goodOf, guardCost, hhGrowth, isCoast, militiaMen, nextBuild, nodeHarvest, nodeYield, nodeSpecials, upkeepOf, riteAllowed, riteCost,
  autoFlows, crowdOf, migratePath, fieldMul, homeRoom, isRiverside, landMul, placeLimit, placeNodes, workMul,
  goodsWorth,
} from '../../realm/economy.ts'
import { goalReach, goalRoute } from '../../realm/goal.ts'
import { approachMoves, armyPower, jointWin, matchupHints, movesOf, type Move } from '../../realm/estimate.ts'
import { kitLines } from '../../realm/kit.ts'
import { alertRange, seenMix, visibleRange } from '../../realm/intel.ts'
import { advance, concealOf, draftable, forceOf, neighbors, newArmyId, otherEnd, planned, rationCost, rationExtra, seasonOf, seenMarches } from '../../realm/season.ts'
import { NIGHT_OPS, PLOT_OPS, exposeChance, assassinArrows, assassinBow, assassinGuard, bowUpCost, escapeChance, plotAgents, plotChance, plotCost, plotTargets, rescueGuard } from '../../realm/plots.ts'
import { allianceWhy, leaderOf, tookRecently, truceWhy, winningAgainst } from '../../realm/stance.ts'
// 등용 대사 — 장수마다 한 마디 (형 10-24: "장수마다 각각 등용 대사 개성 있고 다양하고 독특하게")
import { startRegion } from '../../realm/data/regions/index.ts'
import { HIRE_BY_TRAIT, HIRE_LINE, HIRE_PLAIN } from '../../realm/data/hire-lines.ts'
import { DESTS, DEST_IDS, EXP_SEASONS, destReachable, expAmount, expBlock, expOdds, onExpedition } from '../../realm/expedition.ts'
import { foundable, joinable, partiesOf, partyCost, partyMoves, partySize } from '../../realm/parties.ts'
import { canCohabit, canWed, heroJobOf, heroSeen, honeyLeft, idleHeroOrders, together, inheritOf, isRuler, postHero, rulerOf, wanderersFor, wooable } from '../../realm/heroes.ts'
import type { Approach, Army, EdgeKind, EnvoyAsk, ExpDest, Good, Hand, Hero, Order, Party, PlotOp, Ration, Realm, RegionId, Report, ReportLine, Tactic } from '../../realm/types.ts'
import { P } from '../../tune/params.ts'
import { MAP_CSS, roadSvg, ROUTE_SIGN_NAME, mapHtml, warmNextSeason, type RouteSign, type MapMarch, type MapTarget, type MapToken } from './mapview.ts'
import { LEGACY_CSS, bringHtml, clearBring, toggleBring } from './legacy.ts'
import { DEX_CSS, clanHeroes, dexHtml, dexToastHtml, loadDex, recordDex, type DexBoard } from './dex.ts'
import { DEX_SERVED, dexCatalog } from '../../realm/dex.ts'
import { DRILL_CSS, drillLevel, engraveRun, hasDrill, loadDrill, raiseHero, yardHtml, yardStripHtml, type DrillKit } from './drill.ts'
import { applyDrill, earnedOf } from '../../realm/drill.ts'
import { RELIC_CSS, openRunTomb, pickRunRelic, putRelic, relicChips, takeOffRelic, tombHtml, tombRun, tombStripHtml, wornBy, type RelicKit } from './relics.ts'
import { RELIC } from '../../realm/data/relics.ts'
import { LEVEL_LINE, TIER_MAX, levelName } from '../../realm/tier.ts'
import { FIT_CSS, MQ_CSS, fitLabels, marquee } from './fit.ts'
import { annalOf } from '../../realm/data/annals.ts'
import { WOO_CSS, outlookHtml, miniHtml, pickBoxHtml, progressHtml, wallHtml, whoHtml, wooBest, type WooKit } from './woo-view.ts'
import { GROW_CSS, HERO_CSS, TITLE_MEAN, artChip, bondChip, growthHtml, heroRadar, nameHtml, roleLine, splitTitle, traitChips } from './heroview.ts'
import { APP_CSS, CLOUD_CSS, SEASONP_CSS, UI_CSS } from './appstyle.ts'
import { GOAL_CSS, goalBandHtml, goalRowsHtml } from './goalband.ts'
import { contestOpen } from '../../realm/scenario.ts'
import { installTips, TIP_CSS } from './tips.ts'
import { UPDATE_CSS } from './update.ts'
import { scrollInside } from './scroll.ts'
import { retainMaxOf } from '../../realm/legacy.ts'
import { morph } from './morph.ts'
import { rehearse, type BattleLine } from '../../realm/warroom.ts'
import { BATTLE_CSS, battleCard } from './battlecard.ts'
import { APPROACH_DOES, APPROACH_NAME, B0_KEY, HARD_LINE, WAR_CSS, b0On, openWar } from './battlefield.ts'
import { attachZoom } from './zoom.ts'
import { TUT_CSS, TUT_STEPS, createSpot, tutAt, tutBandHtml, tutStyle } from './tutorial.ts'
import { LOG_CSS, LOG_GROUPS, lineNations, logGroup, logNations, logRows, logbookHtml, type LogFilter } from './logbook.ts'
import { markTutorialOver, markWon, nationWon, tutorialOver, unlockedBoards, tierOpen, tierWon } from './unlock.ts'
import { TINT_CSS, tint } from './tint.ts'
import { SAVE_CSS, saveBoxHtml, type SaveAsk } from './savebox.ts'
import { defaultLabel, type SaveMeta } from './saves.ts'
import { nationKit } from './kitcolor.ts'
import { handsOf, idleHeroes, ownHand, ownHandsIn } from '../../realm/hands.ts'
import { pactOf } from '../../realm/suzerain.ts'
import { ironOf, riteOf } from '../../realm/paths.ts'
import { MOOD_CSS, MOOD_WORD, moodImg, moodOf } from './mood.ts'
import { AUD_CSS, askSay, pactSay, typed, type PactKind } from './audience.ts'
import { customDef, customsOf } from '../../realm/data/customs.ts'
import { BOARDS, FRONT_CSS, PROLOGUE_STEPS, customsHtml, winNeed, boardHtml, detailHtml, endingHtml, nationsHtml, prologueHtml, slotsHtml, titleHtml, type FrontKit, type History, type SlotInfo } from './front.ts'
import { SCENE_SOUND, makeMusic, playOnce, snd, sndFile, tapSlot } from './sound.ts'
import { exileArt, exileBeats, fugitiveBeats, quarrelArt, quarrelBeats, romanceBeats, romanceFlip, sayOfBeat } from './card-lines.ts'
import { HERO_POOL } from '../../realm/data/heroes-pool.ts'
import { chiefCastOf, hireVoicePath, voiceGate, voiceKind, voicePath, type VoiceLine } from './voice.ts'
import { WINFX_CSS, WIN_BUZZ, buzz } from './winfx.ts'
import type { Side, SyncState } from '../../net/sync.ts'
import { FEEL_CSS, alertFeel, ambushRangeFeel, chanceFeel, envoyFeel, favorFeel, fightFeel, plotFeel, unknownFeel } from './feel.ts'
import { adviseMarch, guardRange } from './council-lines.ts'
import { APPROACH_SHORT, COUNCIL_ART, councilAgendas, takeCount, type Agenda, type AgendaId, type Voice } from './council-agenda.ts'

export interface AppHost {
  /** 플레이 기록을 다 지운다(계정·설정은 남김) — 로그인했으면 서버 것부터. 못 지웠으면 false (형 10-24) */
  resetPlay?(): Promise<boolean>
  /** 계절을 넘긴 뒤 — 저장은 바깥이 한다. `orders` 는 AI 것까지 전부, `mine` 은 플레이어 것 */
  onAdvance(next: Realm, report: Report, orders: readonly Order[], mine: readonly Order[]): void
  /** 나라를 골라 새 판 */
  /** tier — 난세 단계 (없으면 1) */
  onNewGame(nation: string, region: RegionId, tier?: number): void
  /** 누른 것 하나 — 판 기록에 남긴다 */
  onTap(act: string, arg: string): void
  /** 판 기록을 파일로 */
  onExport(): void
  /** 남아 있는 판 기록 수 */
  gameCount(): number
  /** 「나의 역사」 — 둔 판들, 최근 것부터 (형 10-25: "완료한 게임들 기록은 어디서 보냐 · 나의 역사 기록") */
  pastGames?(): ReadonlyArray<PastGame>
  /** 이 판의 지난 계절 보고들 — 끝 화면의 연대기 */
  history(): History
  /** 마지막으로 저장한 때 (ISO) — 첫 화면의 "이어 하기" */
  savedAt(): string | null
  /** 선반에 남은 다른 판들 (형 10-25: 하던 판을 골라서) — 없으면 칸을 안 그린다 */
  slots?(): readonly SlotInfo[]
  /** 그 판으로 옮긴다 — 하던 판은 선반에. 못 옮기면 false (지금 판은 그대로) */
  onResume?(seed: number): boolean
  /** 선반의 판 하나를 지운다 */
  onDropSlot?(seed: number): void
  /** 계정·서버 맞추기 (docs/realm/SERVER.md) — 없으면 계정 칸을 안 그린다 */
  cloud?: CloudHost
  /** 손으로 하는 저장 · 불러오기 (ui/realm/saves.ts) — 없으면 단추를 안 그린다 */
  saves?: SaveHost
}

/** 저장 칸 · 파일 — realm-main 이 잇는다. 모두 못 했으면 까닭(쉬운 말), 됐으면 null */
export interface SaveHost {
  /** 칸 N개 — 빈 칸은 null */
  list(): ReadonlyArray<SaveMeta | null>
  /** 지금 판을 칸 n 에 (이름이 비면 「3년 겨울 · 비화가야」) — 못 쓰면 아무것도 안 바뀐다 */
  save(n: number, label: string): string | null
  /** 칸 n 의 판을 연다 — 하던 판은 선반(「다른 판」)에 먼저 올린다 */
  load(n: number): string | null
  drop(n: number): string | null
  /** 지금 판을 .json 파일로 */
  download(label: string): string | null
  /** 파일 글을 읽어 연다 — 모양이 틀리면 아무것도 안 바뀐다 */
  loadFile(text: string): string | null
}

/** 계정 — realm-main 이 net/auth · net/sync 를 이어 준다 */
export interface CloudHost {
  /** 이 브라우저에서 맞추기가 되나 (gzip 이 없는 옛 브라우저는 안 된다) */
  available(): boolean
  who(): { email: string; name: string } | null
  state(): SyncState
  signIn(): void
  signOut(): void
  syncNow(): void
  choose(pick: 'here' | 'there'): void
  /** 계정 지우기 — 서버 자료·계정을 지운다 (기기 판은 남는다) */
  remove(): Promise<'ok' | 'relogin' | 'error'>
}

const ART: string = (import.meta.env?.BASE_URL ?? '/') + 'realm/'
/** 이번 계절에 정해 둔 명령 — 다른 화면에 다녀와도 남는다 (saveDraft) */
const DRAFT_KEY = 'hanbal.realm.draft'
/** 탭의 빨간 점 — 이 판에서 이미 본 것 (dotKeys) */
const SEEN_KEY = 'hanbal.realm.seen'
/** 밤 활 연습장 (SNIPE §0, 형: "궁술연습장도 만들어서 아무때나 해볼수 있게") */
/** 소리 (public/sfx — 활터와 같은 곳 · 이름에 / 가 있으면 public 아래 길: realm/sfx — sound.ts). 끄기는 나라 판에서, 기억은 이 기기에만 */
const BASE: string = import.meta.env?.BASE_URL ?? '/'
const SFX: string = BASE + 'sfx/'
const MUTE_KEY = 'hanbal.realm.mute'
/**
 * 전체 화면은 「앱으로 설치」로만 — 브라우저에서 전체 화면을 켜면 크롬이 「전체 화면을 종료하려면 …」 안내를 늘 띄우고, 페이지는 그것을 끌 수 없다
 * (형 10-23: "어디에서도 이런 거 안 나오게"). 설치한 앱은 realm.webmanifest 의 display:fullscreen 으로 처음부터 바 없이 뜨고 안내도 없다.
 * 크롬이 설치를 권할 수 있으면(beforeinstallprompt — realm.html 이 받아 둔다) 설정에 「앱으로 설치」 단추가 뜬다.
 */
type InstallPrompt = { prompt(): Promise<void> }
const installPrompt = (): InstallPrompt | null => (window as unknown as { __bip?: InstallPrompt }).__bip ?? null
/** 「앱으로 설치」 카드를 다시 보지 않기 — 이 기기에만 · 숨겨도 작은 단추는 남는다 */
const INSTALL_HIDE_KEY = 'hanbal.installHide'
const installed = (): boolean => matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches
/** 장의 목표 띠를 접어 두었나 — 이 기기에만 */
const GOAL_FOLD_KEY = 'hanbal.realm.goalfold'
function goalFolded(): boolean {
  try { return localStorage.getItem(GOAL_FOLD_KEY) === '1' } catch { return false }
}
function muted(): boolean {
  try { return localStorage.getItem(MUTE_KEY) === '1' } catch { return false }
}
function ding(name: string, vol = 0.6, rate = 1, dur = 0): void {
  if (muted()) return
  // 확장자가 이미 붙은 이름(snd() 의 'realm/sfx/x.ogg')엔 또 붙이지 않는다 — 전엔 /.w+$/ 라 「.ogg.ogg」로 받아 깃발·징병·출정 소리가 안 났다 (형 10-24)
  playOnce(`${name.includes('/') ? BASE : SFX}${name}${/\.\w+(#t=[\d.]+)?$/.test(name) ? '' : '.ogg'}`, vol, rate, dur) // 탭이 가려져 있으면 안 낸다 (규칙 4)
}
/** 판마다 「?」 단추로 여는 설명 — 판 위에는 고를 것만 두고, 읽을 거리는 여기로 (형 10-23: "설명서를 물음표 버튼 같은 거 하나 만들어서 필요할 때 읽어 볼 수 있게") */
const GUIDE: Readonly<Record<string, { readonly title: string; readonly body: readonly string[] }>> = {
  paths: { title: '승리 조건: 넷 가운데 하나만 이루면 이긴다', body: [
    '정복: 나라마다 도읍(★)이 하나씩 있다. 막대만큼 도읍을 쥐면 이긴다. 우리 도읍을 빼앗기면 진다.',
    '맹주: 아는 나라 절반 넘게를 속국과 동맹으로 채우고 네 계절을 끊기지 않고 버티면 진왕이 된다. 속국은 한 나라, 동맹은 반 나라로 센다(속국이 하나는 있어야). 동그라미가 그 네 계절이다.',
    '속국은 외교의 「속국 삼기」로 만든다. 우리 힘이 그 나라보다 훨씬 셀수록 잘 받아들인다.',
    '철·뱃길: 철광이나 포구를 하나 쥐어야 열린다. 한 해 안에 여러 나라와 철을 바꾸고, 바꾼 나라 수 × 철이 막대를 채우면 변진의 쇠가 우리 뱃길로 흐른다.',
    '큰 제사: 소도 곁 고을을 쥐고 봄·가을 제사를 한 번도 거르지 않고 이어 지내고, 그해 가을 집이 넉넉하면 큰 제사가 열린다. 사슬 고리가 이어 지낸 제사다.',
    '소문: 다른 나라가 어느 길에 가까우면 아래에 붉게 뜬다. 그 길을 끊어야 한다.',
  ] },
  move: { title: '군대 옮기기', body: [
    '군대 말을 누르고, 지도에서 군사를 보낼 곳(금빛으로 빛나는 고을)을 선택하면 그리로 간다. 제 고을을 누르면 머문다.',
    '칩의 숫자는 닿는 데 걸리는 계절이다. 초록은 이길 듯, 붉음은 질 듯.',
    '협공: 다른 우리 군대와 같은 계절에 닿으면 한 판으로 함께 싸운다.',
    '같은 고을의 다른 말을 더 누르면 함께 골라진다. 합치기도 여기서.',
  ] },
  envoy: { title: '사신', body: [
    '남의 속은 그 나라에 첩자를 심거나 동맹을 맺어야 귀에 들어온다. 그 밖엔 우리 신하의 짐작뿐이다.',
    '사신마다 한 사람이 간다. 군장의 사자나 쉬는 장수.',
    '이번 계절 보낼 사람 = 사자 하나 + 쉬는 장수 수. 사신·공작 하나에 한 사람이 든다.',
    '한 나라에 동맹과 교역처럼 서로 안 부딪히는 사신은 함께 보낼 수 있다.',
    '매력이 높거나 매혹·장사꾼(교역) 특성이 있는 장수가 가면 더 잘 먹힌다. 싸우는 나라에 가면 붙잡힐 수 있다.',
    '화친: 몇 계절 서로 치지 않기로 한다. 맺으면 서로 잡아 둔 장수를 돌려준다.',
    '동맹: 함께 싸운다. 장터가 서고, 본 것을 나누고, 함께 치자·지원 요청·군대 빌리기를 할 수 있다.',
    '교역: 무엇을 주고 무엇을 받을지 정한다. 저들 창고에 없는 것은 못 받는다.',
    '선물: 늘 받는다. 호감이 오른다.',
    '속국 삼기: 바치라고 할 몫을 정한다. 받아들이면 우리를 섬기는 속국이 되어 다달이 바치고, 맹주의 셈에 한 나라로 든다. 거절하면 전쟁이 난다.',
    '함께 치자: 동맹이 두 계절 안에 칠 곳을 고른다. 지키면 호감이 오르고, 못 지키면 내려간다.',
    '지원 요청: 동맹에게 곡식을 그냥 달라고 한다. 호감이 높고 저들 창고가 넉넉할수록 잘 준다.',
    '군대 빌리기: 동맹 군대가 와서 몇 계절 우리 고을을 지켜 준다. 지도에 「도움」 말로 보인다.',
    '약조 깨기: 화친·동맹을 우리가 먼저 깨면 다른 나라들도 우리를 덜 믿는다.',
  ] },
  plot: { title: '공작', body: [
    '몰래 하는 일: 소문·방화·첩자·매수·이간·암살.',
    '보낼 사람만큼 벌인다 (위의 「이번 계절 보낼 사람」).',
    '보낸 게 드러나면 그 나라와 사이가 한 칸 나빠진다. 동맹은 화친으로, 화친은 중립으로, 중립은 전쟁으로. 암살은 두 칸.',
    '지략 높은 장수가 있으면 잘 된다.',
  ] },
  people: { title: '백성', body: [
    '고을마다 나는 것이 다르다. 강가 들은 쌀이 더 나고, 철산은 철, 바닷가는 소금·물고기, 숲은 나무, 목장은 말이 난다. 쌀과 특산은 사는 집이 많을수록 많이 난다.',
    '백성 배치: 고을에서 떼어 모았다가 원하는 고을에 나누어 붓는다. 한 계절에 나라 집의 몇 할까지, 옮긴 집마다 곡식이 든다.',
    '개척단: 우리 고을에서 꾸리면 맞닿은 빈땅으로 바로 떠난다. 닿으면 새 마을이 선다. 다른 우리 고을로 데려가 「여기 자리 잡기」를 누르면 그 고을로 이주한다.',
    '군대로 빈땅을 차지하면 깃발만 꽂힌다. 사는 사람이 없어 아무것도 안 난다.',
    '붐비는(품을 넘긴) 고을의 백성은 저절로 한산한 이웃 고을로 조금씩 넘어간다.',
  ] },
  place: { title: '백성 배치', body: [
    '고을에서 −를 누르면 그 집들이 위의 「모아 둔 백성」으로 오고, 다른 고을에서 +를 누르면 거기로 간다.',
    '모아 둔 백성이 다 자리를 잡아야 정할 수 있다.',
    '옮긴 고을은 자리 잡느라 한동안 집이 늘지 않는다. 옮긴 집마다 곡식이 든다.',
    '카드마다 그만큼 살면 나는 쌀(한 해)과 특산(계절마다)이 보인다. 강가 논은 쌀이 더, 높은 터는 덜 난다.',
  ] },
  post: { title: '장수 맡기기', body: [
    '고을을 맡긴 장수는 내정·지략·매력과 특성이 그 고을에 걸린다. 가을걷이·집 늘기·장정.',
    '군대를 이끄는 장수는 무예·통솔이 싸움에 걸린다.',
    '장수 한 명은 한 계절에 한 가지 일만 한다. 원정·고을 맡기·군대 이끌기·사신 동행·자객·회유 가운데 하나.',
    '멀리 있는 고을에 맡기면 정예를 거느리고 그 계절 동안 길을 간다.',
  ] },
  jail: { title: '옥', body: [
    '싸움에서 「적장 사로잡기」로 잡아 온 적장이 여기 갇힌다.',
    '회유하면 우리 장수가 된다. 계절마다 곡식이 들고, 맡긴 우리 장수의 매력이 빠르기를 정한다.',
    '화친·동맹을 맺거나 그 나라 도읍이 떨어지면 풀려나 돌아간다.',
  ] },
  // 출정의 「어떻게」 — 판 위에는 이름과 판세만, 뜻은 여기 (형 10-27: "출정 보낼 때 어떻게에 텍스트가 너무 많음 · 획기적으로 줄이고 물음표")
  march: { title: '어떻게 갈까: 진군 방식과 군량', body: [
    ...(Object.keys(APPROACH_NAME) as Array<keyof typeof APPROACH_NAME>).map((k) => `${APPROACH_NAME[k]}: ${APPROACH_DOES[k].gain}. ${APPROACH_DOES[k].risk}.`),
    '판세: 그 방식으로 닿았을 때 싸움이 어떨지. 숨어 가는 길은 「몰래 닿기」가 되면 「안 들키면」, 안 되면 「들키면」의 판세가 된다. 큰 군대일수록 잘 안 숨는다.',
    '숨기 좋은 길: 숲·갈대·밤·안개처럼 숨을 데가 있는 길. 길 이름에 손을 대면 까닭이 보인다.',
    '군량: 길 계절치는 늘 챙긴다. 그 위로 더 챙긴 만큼 남의 땅에서 버틴다. 바닥나면 사기가 꺾이고, 남의 땅에 머물면 사람이 흩어진다.',
    '상성: 창은 방패를, 방패는 활을, 활은 창을 이긴다. 성과 높은 데의 궁수, 들판의 창병처럼 땅도 걸린다.',
  ] },
  draft: { title: '징병', body: [
    '집(다섯 식구 남짓)에서 사람을 뽑아 군사로 만든다. 군사는 움직이고 쳐들어가지만 곡식을 먹는다.',
    '장정은 뽑지 않은 집의 사내들이다. 적이 오면 제 고을만 지킨다. 집이 많을수록 많고 곡식을 안 먹는다.',
    '봄에 뽑으면 그해 가을걷이가 준다. 가을·겨울은 거둔 뒤라 뽑기 좋은 때다.',
    '⚡ 알아서 뽑기: 고을마다 뽑을 수 있는 만큼, 뽑을 수 있는 병종을 골고루 섞어 곡식이 닿는 데까지 뽑는다.',
    '고을마다 병종 하나를 골라 뽑는다. 섞으려면 병종을 바꿔 한 번 더 뽑는다. 앞줄(창·방패)이 받아 내고 뒷줄(활)이 쏜다.',
    '뽑은 만큼 그 고을의 집(일손)이 준다. 철을 들여 장착하면 처음부터 한 단계 좋은 무기를 든다.',
    '백성을 다른 고을로 옮기거나 빈땅에 마을을 여는 일은 「백성」 탭에서 한다.',
  ] },
  scout: { title: '정찰', body: [
    '정찰꾼은 한 계절에 한 곳만 간다. 장수는 안 간다.',
    '하나를 고르면 앞서 고른 곳은 풀린다.',
    '다녀오면 그곳의 군세·병종·경계가 보인다. 오래되면 흐려진다.',
  ] },
}
const guideBtn = (k: string): string => `<button class="qi" data-act="guide" data-k="${k}" aria-label="설명 보기">?</button>`
const PRACTICE: string = (import.meta.env?.BASE_URL ?? '/') + 'night.html?practice=1'
/** night.html 이 올라갔다 (f9e77aa) — 없는 쪽으로 보내지 않으려 둔 스위치 */
const PRACTICE_READY = true
const NIGHT: string = (import.meta.env?.BASE_URL ?? '/') + 'night.html'
/** 2장 송양의 활쏘기 겨루기 — 낮의 과녁판 (형 10-25: "암살 스테이지면 안 되는 거 아님??") */
const CONTEST: string = (import.meta.env?.BASE_URL ?? '/') + 'contest.html'
/** 보고판이 쌓이는 빠르기 (초) — 소식 한 줄 · 무너진 나라 한 장. 계절 띠(seasonFx)가 걷힌 뒤 시작한다 (CSS .modal.late) */
const LINE_S = 0.6
/** 계절 종이 울린 뒤 그 계절 장면의 소리가 나기까지 (ms) */
const SCENE_CUE_MS = 1400
/** 혼례·탄생 장면 — 계절 띠가 걷힌 뒤 뜨고, 이만큼 머문다 (누르면 바로 넘긴다) */
const CEREMONY_LEAD_MS = 2000
const CEREMONY_MS = 6500
/** 새로 열린 탭 알림이 머무는 시간 (ms) */
const TAB_TOAST_MS = 7000
/** 장수가 우리 편이 된 길 — 등용 장면의 한 줄 */
type JoinHow = 'persuade' | 'wanderer' | 'expedition' | 'exile' | 'grown' | 'join'
const JOIN_LINE: Readonly<Record<JoinHow, string>> = {
  persuade: '마음을 돌려 우리 장수가 되었다', wanderer: '떠돌던 인재가 우리를 찾아왔다', expedition: '원정길에서 만나 우리를 따라왔다',
  exile: '몸을 맡기러 우리를 찾아왔다', grown: '다 자라 장수로 나섰다', join: '우리 장수가 되었다',
}
/** 한 계절에 띄우는 등용 장면 수 — 넘치면 나머지는 계절 기록으로 */
const JOIN_SCENES_MAX = 4
/** 배우는 판의 단계 이름 — CSS 로는 2.4초에 걷힌다. 애니메이션이 안 끝나도 이때는 걷힌다 (ms) */
const TUT_CAP_MAX_MS = 3000
/** 도감 알림이 아무리 늦어도 걷히는 때 (ms) — CSS 로는 5.5초에 걷힌다 */
const DEX_TOAST_MAX_MS = 9000
/** 세로 구도로 따로 그린 장면 그림 (public/realm/event-v) — 세로 화면에선 16:9 가운데 띠만 남아 용 허리만 보였다 (형 10-24) */
const SCENE_V: ReadonlySet<string> = new Set(['event-dream', 'event-newborn', 'event-marriage', 'event-bridal-a', 'event-bridal-b', 'event-bridal-c', 'event-bridal-d'])
/** 큰 장면 바탕 — 가로 그림(--hbg) · 세로 화면이면 세로 그림(--vbg, 있으면) */
const sceneBg = (name: string): string => `--hbg:url('${ART}event/${name}.jpg')${SCENE_V.has(name) ? `;--vbg:url('${ART}event-v/${name}.jpg')` : ''}`
/** 신방 넉 장 — 휘장 너머 그림자 · 풀린 옷고름 · 이불 끝의 발 · 댓돌 위 포개진 신 (그림: realm/event/event-bridal-*) */
const BRIDAL_SHOTS: ReadonlyArray<readonly [string, string]> = [
  ['event-bridal-a', '등잔불이 낮게 흔들린다'],
  ['event-bridal-b', '옷고름이 풀렸다'],
  ['event-bridal-c', '화촉 두 자루가 함께 꺼졌다'],
  ['event-bridal-d', '댓돌 위 신 두 켤레가 포개졌다'],
]
/** 판을 그린 뒤 다음 계절 지도 그림을 미리 받기까지 (ms) — 그리는 동안 끼어들지 않게 */
const WARM_MS = 1200
const FALL_S = 1.6
/** 싸움 카드 하나가 다 풀리는 데 걸리는 때 — 카드 안 줄들의 가장 늦은 --d 에 한 박자 */
const battleCardSeconds = (html: string): number => Math.max(0, ...[...html.matchAll(/--d:([\d.]+)s/g)].map((m) => Number(m[1]))) + 0.8
/** 지도 보기 켜고 끄기 — 겹마다 이름과 무엇인지 */
const LAYERS = [
  { id: 'terr', name: '땅빛', hint: '나라 색 · 경계' },
  { id: 'roads', name: '길', hint: '들길·고갯길·나루…' },
  { id: 'marches', name: '행군 화살', hint: '우리 출정 · 다가오는 적' },
  { id: 'labels', name: '이름', hint: '고을 이름' },
  { id: 'flags', name: '깃발', hint: '고을 주인' },
  { id: 'goods', name: '특산', hint: '쇠·소금·나무·말: 고을마다 나는 것' },
  { id: 'force', name: '군세 수', hint: '정찰꾼이 본 적 군세' },
  { id: 'army', name: '우리 군대', hint: '장수 얼굴 말' },
] as const
type LayerId = (typeof LAYERS)[number]['id']
const LAYER_KEY = 'hanbal.realm.layers'
const HAND_NAME = { dead: '적장이 쓰러졌다', wounded: '적장이 다쳤다', fled: '적장이 달아났다', withdrew: '조용히 물러났다', cleared: '다 쓰러뜨렸다', skip: '자객에게 맡겼다' } as const
/** 구출의 손 — 데려 나왔나 · 북이 울렸나 (형 10-26) */
const RESCUE_HAND_NAME = { dead: '', wounded: '', fled: '북이 울려 달아났다', withdrew: '조용히 물러났다', cleared: '옥에서 데려 나왔다', skip: '보낸 이에게 맡겼다' } as const
/** 공작 결과 큰 화면의 그림 — 공작마다 제 그림 (구출은 10-26 제미나이 Argon) */
const plotArt = (op: PlotOp): string => `event-plot-${op}`

type Ask = EnvoyAsk
type Envoy = Extract<Order, { kind: 'envoy' }>
type Sheet =
  | { kind: 'army' } | { kind: 'draft' } | { kind: 'people' } | { kind: 'diplo' } | { kind: 'scout' } | { kind: 'nation' } | { kind: 'help' }
  | { kind: 'node'; id: string } | { kind: 'heroes' } | { kind: 'hero'; id: string } | { kind: 'log' } | { kind: 'place' }

const REL_NAME = { war: '전쟁', neutral: '중립', truce: '화친', ally: '동맹' } as const
/** 지금 사이가 뜻하는 것 — 나라 카드 밑 한 줄 */
const REL_NOW = {
  war: '서로 친다. 화친을 청하면 멈출 수 있다.',
  neutral: '아직 아무 사이도 아니다. 먼저 치면 전쟁이 된다.',
  truce: '서로 안 친다. 계절마다 장터가 서서 곡식이 오간다.',
  ally: '서로 안 치고 땅을 지나간다. 본 것을 나누고, 같은 적을 친다.',
} as const
/** 자세한 것이 필요한 사신 — goods: 곡식·철 · place: 고을 · confirm: 다짐 */
const ASK_NEEDS: Partial<Record<Ask, 'goods' | 'place' | 'confirm'>> = { trade: 'goods', gift: 'goods', aid: 'goods', tribute: 'goods', joint: 'place', troops: 'place', break: 'confirm' }
/** 집이 느는(주는) 까닭 — economy.hhGrowth 의 열쇠 */
const GROWTH_WHY: Readonly<Record<string, string>> = {
  crowded: '붐벼서 집이 더디게 늘어난다', uprooted: '억지로 옮겨 와 자리 잡는 중이다',
  fed: '배부르고 평화롭다', hunger: '굶는다', post: '맡은 장수가 돌본다', settle: '새로 일군 땅이라 빨리 큰다', full: '더 들어설 자리가 없다', threat: '적이 다가와 술렁인다',
}
/** 빈 몫 — 다섯 물건 */
const noGoods = (): Record<Good, number> => ({ grain: 0, iron: 0, salt: 0, wood: 0, horse: 0 })
/** 물건의 그림 */
/** 사신을 꾸밀 때 한 번 누름에 오르내리는 몫 */
const GOOD_STEP: Record<Good, number> = { grain: 10, iron: 5, salt: 5, wood: 5, horse: 1 }
/** hero — 사신으로 가는 우리 장수 ('' 이면 군장의 사자) */
const NO_COMPOSE = { to: '', ask: 'truce' as Ask, give: noGoods(), take: noGoods(), target: '', hero: '' }
/** 이번 계절 사신의 열쇠 — 한 나라에 부딪히지 않는 사신 여럿 (envoyClash · 형: "동맹과 교역은 동시에 못하는거야?") */
const ekey = (to: string, ask: Ask): string => `${to}:${ask}`
/** 공작 다섯의 그림 */
const PLOT_ICON: Readonly<Record<PlotOp, string>> = {
  // 공작 칩 그림 — 공작만 쓰는 새 그림 여섯 (형 10-26: "공작 아이콘에 누끼가 제대로 안 따짐. 새로 만드는 게 낫겠음" · 제미나이 · 초록 바탕을 잘랐다).
  // 옛 그림(status-* · good-cowries · unit-archer)은 다른 화면이 쓰니 그대로 둔다
  rumor: 'plot-rumor', sow: 'plot-sow', bribe: 'plot-bribe', burn: 'plot-burn', spy: 'plot-spy', assassin: 'plot-assassin',
  // 구출 — 끊긴 밧줄과 열린 옥문 (10-26 제미나이 Argon)
  rescue: 'plot-rescue',
}
/** 따라 누르면 되는 단추의 작은 「추천」 딱지 (형 10-29: "문명에서는 탭마다 추천 스티커를 우상단에 작게") */
const REC_ST = '<i class="recst">추천</i>'
/** 아래 탭 — more 는 길게 누르면 뜨는 말 (tips.ts) */
const TABS = [
  { id: 'army', name: '군대', icon: 'unit-shield-wall', more: '우리 군대를 고르고 길을 정한다. 지도에서 군대를 눌러도 된다.' },
  { id: 'draft', name: '징병', icon: 'unit-spear', more: '마을 장정을 군사로 뽑는다. 뽑은 만큼 그 마을에서 농사지을 일손이 줄어든다.' },
  // 백성 — 개척·이주 (형: "군사징병이랑 개척 좀 확실히 구분필요함")
  { id: 'people', name: '백성', icon: 'settle-farm-village', more: '개척단을 꾸려 빈땅에 새 마을을 열거나, 다른 우리 고을로 데려가 자리 잡게 한다(이주). 붐비면 저절로도 옮겨 간다.' },
  { id: 'diplo', name: '외교', icon: 'good-tribute-bell', more: '이웃 나라와 화친·동맹을 맺고, 사신의 청에 답하고, 몰래 공작(소문·암살…)을 보낸다.' },
  // 장수 탭 — 첫 칸 「명령」에 장수에게 시키는 일을 모았다 (형 10-25: "명령 탭은 장수 탭이어야 하는 거 아님?")
  { id: 'heroes', name: '장수', icon: 'unit-general', more: '장수에게 일을 맡긴다(명령): 고을·군대·사신·공작·원정·혼인. 우리 장수·사로잡은 장수 명부도 여기.' },
  { id: 'nation', name: '나라', icon: 'settle-capital', more: '나라 살림 · 목표 · 이번 계절 사건 · 제사.' },
] as const

/**
 * 「명령」 탭의 일 여섯 — 고르면 그림 깔린 창에서 장수와 갈 곳을 고른다 (형 10-25: "성주 배치·군사 지휘·사신·자객도 혼인·원정처럼 제대로 된 창으로").
 * stat 은 그 일에 먹히는 능력치 — 장수 고르는 칸에 보이고, 가장 높은 이를 먼저 골라 둔다. ruler — 군주도 할 수 있는 일
 */
type CmdJob = 'post' | 'lead' | 'envoy' | 'plot' | 'exp' | 'wed'
const CMD_JOBS: ReadonlyArray<{ id: CmdJob; name: string; icon: string; art: string; line: string; stat: ReadonlyArray<'mu' | 'tong' | 'ryak' | 'chi' | 'deok'>; ruler: boolean }> = [
  { id: 'post', name: '고을 맡기', icon: 'settle-capital', art: 'event-festival', line: '맡은 고을에 솜씨가 걸린다', stat: ['chi', 'ryak', 'deok'], ruler: false },
  { id: 'lead', name: '군대 이끌기', icon: 'unit-general', art: 'event-relief-cavalry', line: '장수 없는 군대를 맡아 싸운다', stat: ['mu', 'tong'], ruler: false },
  { id: 'envoy', name: '사신', icon: 'good-tribute-bell', art: 'event-outside-envoy', line: '이웃 나라에 말을 전한다', stat: ['deok'], ruler: false },
  // 공작 — 소문·이간·매수·방화·첩자·암살 (형 10-25: "자객이 아니라 공작 · 공작 속에 여러 가지가 있다")
  { id: 'plot', name: '공작', icon: 'plot-schemes', art: 'event-spy-rumor', line: '몰래 적을 흔든다. 여섯 가지', stat: ['ryak'], ruler: false },
  { id: 'exp', name: '원정', icon: 'route-searoute', art: 'event-expedition-return', line: '먼 땅에서 좋은 것을 가져온다', stat: ['mu', 'ryak', 'deok'], ruler: true },
  { id: 'wed', name: '혼인', icon: 'status-alliance', art: 'event-marriage', line: '짝을 지어 아이를 얻는다', stat: [], ruler: true },
]
/** 군주가 친히 이끌 때(친정) 거는 것 — 군대 판·지도 띠의 장수 고르기가 같은 말 */
const RULER_LEAD_TIP = '군주가 도읍을 비우는 동안 다스림(능력치가 나라에 거는 몫)이 반으로 준다 · 지면 사로잡힐 수 있다'

/**
 * 처음 하는 사람에게는 탭을 계절마다 하나씩 연다 — 첫 화면에 탭 여섯·장수·외교·사건이 한꺼번에 쏟아져 무엇부터 할지 몰랐다
 * (형 10-24: 동료 플레이 "정보가 한 번에 많이 들어와서 뭐가 뭔지 전혀 이해가 안 됨" · 문명처럼 하나씩).
 * 한 판이라도 이긴 사람(배우는 판 빼고)은 처음부터 다 열린다.
 */
const TAB_OPEN_AT: Readonly<Record<(typeof TABS)[number]['id'], number>> = { army: 0, draft: 0, nation: 0, heroes: 1, diplo: 2, people: 3 }
const TAB_NEW_LINE: Readonly<Record<(typeof TABS)[number]['id'], string>> = {
  army: '', draft: '', nation: '',
  heroes: '우리 장수에게 고을·군대를 맡기고, 떠돌이 인재를 들인다',
  diplo: '이웃 나라와 화친·교역·동맹을 맺고, 사신의 청에 답한다',
  people: '개척단으로 빈땅에 마을을 열고, 백성을 옮긴다',
}

const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const span = (lo: number, hi: number, f: (x: number) => string): string => (f(lo) === f(hi) ? f(lo) : `${f(lo)}~${f(hi)}`)
const icon = (name: string, cls = 'ic'): string => `<img class="${cls}" src="${ART}icon/${name}.png" alt="">`
/** 드는 값 칩 — 붉은 ▼ 와 물건 그림과 수. per 는 「계절마다」처럼 앞에 붙는 말 */
function costHtml(g: Partial<Record<'grain' | 'iron' | 'wood' | 'salt' | 'horse', number>>, per = ''): string {
  const NAME = { grain: '곡식', iron: '철', wood: '나무', salt: '소금', horse: '말' } as const
  const parts = (['grain', 'iron', 'wood', 'salt', 'horse'] as const).filter((k) => (g[k] ?? 0) > 0)
    .map((k) => `<b class="cg" title="${NAME[k]} ${g[k]}"><i>▼</i>${icon(GOOD_ICON[k], 'cgi')}${g[k]}</b>`)
  return parts.length === 0 ? '' : `<span class="cost">${per !== '' ? `<small>${per}</small>` : ''}${parts.join('')}</span>`
}
/** 얻는 것 — 비용(▼ 붉게)의 짝 (▲ 푸르게) · ODDS.md 원칙 3 "무엇을은 늘 또렷하게" */
function gainHtml(g: Partial<Record<'grain' | 'iron' | 'wood' | 'salt' | 'horse', number>>): string {
  const NAME = { grain: '곡식', iron: '철', wood: '나무', salt: '소금', horse: '말' } as const
  const parts = (['grain', 'iron', 'wood', 'salt', 'horse'] as const).filter((k) => (g[k] ?? 0) > 0)
    .map((k) => `<b class="gg" title="${NAME[k]} ${g[k]}"><i>▲</i>${icon(GOOD_ICON[k], 'cgi')}${g[k]}</b>`)
  return parts.length === 0 ? '' : `<span class="gain">${parts.join('')}</span>`
}
/** 물건 아닌 것 — 수확·사기·정·집·경계·호감·장수. 좋으면 ▲ 푸르게 · 나쁘면 ▼ 붉게 (costHtml·gainHtml 과 같은 꼴) */
const fxChip = (good: boolean, ic: string, text: string): string =>
  `<span class="${good ? 'gain' : 'cost'}"><b class="${good ? 'gg' : 'cg'}" title="${esc(text)}"><i>${good ? '▲' : '▼'}</i>${icon(ic, 'cgi')}${esc(text)}</b></span>`
const signed = (n: number): string => (n > 0 ? `+${n}` : `${n}`)
/** 사건 답 한 갈래가 하는 일 — 아이콘과 숫자로 (형 10-25: "얻게 되거나 잃게 되는 거 이미지랑 숫자로 확실하게" · ODDS 원칙 3) */
function fxHtml(r: Realm, fx: CardFx): string {
  const g = fx.grain ?? 0
  const n = fx.iron ?? 0
  let h = gainHtml({ grain: Math.max(0, g), iron: Math.max(0, n) }) + costHtml({ grain: Math.max(0, -g), iron: Math.max(0, -n) })
  if (fx.harvest !== undefined && fx.harvest !== 1) {
    const d = Math.round((fx.harvest - 1) * 100)
    h += fxChip(d > 0, 'status-autumn', `수확 ${signed(d)}%`)
  }
  if (fx.morale !== undefined) h += fxChip(fx.morale > 0, fx.morale > 0 ? 'status-morale-up' : 'status-morale-down', `사기 ${signed(Math.round(fx.morale * 100))}%`)
  if (fx.bond !== undefined) h += fxChip(fx.bond > 0, fx.bond > 0 ? 'mood-warm' : 'mood-angry', `장수들 정 ${signed(fx.bond)}`)
  for (const [id, d] of fx.bonds ?? []) h += fxChip(d > 0, d > 0 ? 'mood-warm' : 'mood-angry', `${r.heroes[id]?.name ?? ''} 정 ${signed(d)}`)
  const hh = (fx.hurt ?? []).reduce((a, [, d]) => a + d, 0)
  if (hh > 0) h += fxChip(false, 'settle-hamlet', `집 -${hh}`)
  if (fx.watch !== undefined) h += fxChip(true, 'settle-beacon', `경계 +${Math.round(fx.watch * 100)}%`)
  for (const fv of fx.favor ?? []) {
    if (fv.to.length === 0) continue
    const who = fv.to.length === 1 ? r.factions[fv.to[0]!]?.name ?? '' : (fx.favor!.length > 1 ? '다른 나라들' : '이웃 나라들')
    h += fxChip(fv.d > 0, fv.d > 0 ? 'mood-joy' : 'mood-angry', `${who} 호감 ${signed(fv.d)}`)
  }
  if (fx.foe !== undefined) h += fxChip(true, 'war-broken-banner', `${r.factions[fx.foe.faction]?.name ?? ''} 사기 -${Math.round(fx.foe.d * 100)}%`)
  if (fx.join !== undefined) h += fxChip(true, 'unit-general', '새 장수')
  if (fx.wed !== undefined) h += fxChip(true, 'mood-warm', '혼인')
  // 아무 일 없음 — 글 대신 「곡식 0」 그림 칩 (형 10-26: "아무 일 없는 건 텍스트로 하지 말고 0 으로 이미지화")
  return h === '' ? `<span class="cnone"><b class="gz" title="오가는 것 없음">${icon(GOOD_ICON.grain, 'cgi')}0</b></span>` : h
}
/** 큰 얼굴 — 900px 판이 있으면 그것 (알현처럼 화면 가득일 때) · 900px 판이 없는 얼굴(아이 · 몇 군주)은 320px 판으로 갈아 낀다
 *  (형 10-27: "우리 밀정 누가 갔는지 얼굴이 안 보이는데 — 찌그러진 빈 타원 동그라미밖에 없음" — 없는 bust-hd 를 불러 빈 그림이 떴다) */
const bustHd = (h: Hero | undefined, cls: string): string =>
  h !== undefined && bustOf(h.id) !== undefined
    ? `<img class="${cls}" src="${ART}bust-hd/${bustOf(h.id)}.jpg" onerror="this.onerror=null;this.src='${ART}bust/${bustOf(h.id)}.jpg'" alt="">`
    : ''
const bust = (h: Hero | undefined, cls = 'face'): string =>
  h !== undefined && bustOf(h.id) !== undefined ? `<img class="${cls}" src="${ART}bust/${bustOf(h.id)}.jpg" alt="">` : `<span class="${cls} noface"></span>`
/** 우리 나라 — 깃발마다 금빛 후광을 두른다 (형 2026-10-20: "사용자의 나라는 로그에서 아이콘도 뭔가 후광이 있거나 특별하게 … 내나라가 어느나란지도 모르겠어서") */
let MINE = ''
/**
 * 판 위에서는 나라 얼굴이 그 판의 진짜 군주 — 2장의 고구려는 주몽이지 넓은 판의 군주 그림이 아니다
 * (형 10-23: "고구려는 군주 이미지가 따로 있는데 장수 중에 군주로 주몽이 또 있는 건 뭐냐"). 판 바깥(나라 고르기)에서는 비운다
 */
let LIVE_RULER: Readonly<Record<string, string>> = {}
const emblem = (f: string | null, cls = 'em'): string => (f !== null && FACTION_ART[f] !== undefined ? icon(flagIcon(f)!, f === MINE ? `${cls} mine` : cls) : '')
const sorted = <T extends { id: string }>(xs: Iterable<T>): T[] => [...xs].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))

/** 나라마다 얼굴 하나 — 그 나라의 군주 (판의 Faction.ruler 와 같은 id — 나라 고르기 화면엔 판이 없어 이름 규칙으로) */
const rulerId = (nation: string): string => `${nation}-ruler`

/** 판마다 나라 고르기 글 — 변한 6국 축소판 · 영남 판 */
const nationsOf = (region: RegionId): readonly NationInfo[] => (region === 'yeongnam' ? YEONGNAM_NATIONS : region === 'south' ? SOUTH_NATIONS : region === 'world' ? WORLD_NATIONS
  : region === 'tutorial' ? SOUTH_NATIONS.filter((n) => n.id === 'baekje' || n.id === 'michuhol')
    : region === 'jumong' ? [...JUMONG_NATIONS, HAENGIN_NATION] : region === 'mahan' ? MAHAN_NATIONS : region === 'seorabeol' ? SEORA_NATIONS : NATIONS)
/** 「나의 역사」의 판 이름 · 옛 기록의 나라 이름 (판마다 같은 id 면 앞 것) */
const BOARD_NAME_OF: Readonly<Record<string, string>> = Object.fromEntries(BOARDS.map((b) => [b.id, b.name]))
const FACTION_NAME_OF: Readonly<Record<string, string>> = Object.fromEntries((['byeonhan-mini', 'yeongnam', 'south', 'world', 'tutorial', 'mahan', 'jumong', 'seorabeol'] as const).flatMap((rg) => nationsOf(rg).map((n) => [n.id, n.name] as const)).reverse())

/** 판마다 나라의 진짜 군주 — 나라 고르기·자세히 보기에서도 그 판의 얼굴로 (2장 고구려 = 젊은 궁수 주몽 · 형 10-24) */
const BOARD_RULERS = new Map<RegionId, Readonly<Record<string, string>>>()
function boardRuler(region: RegionId, nation: string): string | undefined {
  let m = BOARD_RULERS.get(region)
  if (m === undefined) {
    const r = startRegion(region, 1, nation)
    m = Object.fromEntries(Object.values(r.factions).flatMap((f) => (f.ruler !== undefined ? [[f.id, f.ruler]] : [])))
    BOARD_RULERS.set(region, m)
  }
  return m[nation]
}

function nationFace(id: string, cls = 'nface', ruler?: string): string {
  // ruler — 저장된 판의 진짜 군주 (첫 화면 「이어 하기」: 2장 고구려는 젊은 궁수 주몽 — 형 10-24)
  const hid = ruler ?? LIVE_RULER[id] ?? rulerId(id)
  const file = hid !== undefined ? bustOf(hid) : undefined
  return file !== undefined ? `<img class="${cls}" src="${ART}bust/${file}.jpg" alt="">` : ''
}

/** 도감(dex.ts)이 쓰는 그림 손 */
const DEX_KIT = {
  esc,
  bust: (id: string): string | null => (bustOf(id) !== undefined ? `${ART}bust/${bustOf(id)}.jpg` : null),
  kid: (key: string, look: 'g' | 'w', traits?: readonly string[]): string | null => { const f = kidBust(key, look, traits); return f !== undefined ? `${ART}bust/${f}.jpg` : null },
  grow: (id: string): { lv: number; relics: string } => ({ lv: drillLevel(id), relics: relicChips(ART, esc, wornBy(id)) }),
}

/** 처음 몸 — 영웅전 명부 · 가문의 아이 (단련터 · 동행 고르기의 단련 몸) */
const drillBody = (id: string): Hero | undefined => dexCatalog().find((x) => x.id === id)?.hero ?? clanHeroes().find((x) => x.id === id)?.hero
/** 유물(relics.ts)이 쓰는 그림 손 — 장수 이름은 명부 · 단련 기록에서 */
const RELIC_KIT: RelicKit = { art: ART, esc, nameOf: (id: string): string => drillBody(id)?.name ?? loadDrill().h[id]?.name ?? id }
/** 단련터(drill.ts)가 쓰는 그림 손 */
const DRILL_KIT: DrillKit = {
  esc,
  bust: (id: string): string | null => (bustOf(id) !== undefined ? `${ART}bust/${bustOf(id)}.jpg` : null),
  bodyOf: drillBody,
  relic: RELIC_KIT,
}

/** 판의 앞과 끝(front.ts)이 쓰는 그림 손 */
const KIT: FrontKit = {
  art: ART, esc, icon, nations: nationsOf, face: nationFace, boardRuler,
  emblem: (f, cls) => emblem(f, cls),
  bust: (id) => (bustOf(id) !== undefined ? `${ART}bust/${bustOf(id)}.jpg` : null),
  won: nationWon,
}

/** 계절 입자 서른여섯 — 자리·크기·빠르기·흔들림·그림 칸을 한 번 정해 둔다 (꾸밈이라 판의 시드와 상관없다). 넷 중 셋은 눈일 때 둥근 송이(.o) */
const SP_N = 36
function seasonParticles(): string {
  let s = 7
  const rnd = (): number => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
  let h = ''
  for (let i = 0; i < SP_N; i++) {
    const d = 9 + rnd() * 9
    h += `<i${i % 4 !== 0 ? ' class="o"' : ''} style="--x:${(rnd() * 100).toFixed(1)}%;--z:${(0.6 + rnd() * 0.8).toFixed(2)};--d:${d.toFixed(1)};--t:${(-rnd() * d).toFixed(1)};--w:${Math.round(12 + rnd() * 40)}px;--c:${Math.floor(rnd() * 8)}"></i>`
  }
  return h
}

/** 첫 화면 · 판 고르기 · 나라 고르기 · 자세히 — null 이면 판 위 */
/** 「나의 역사」 한 줄 — realm-main 의 판 기록에서 */
export interface PastGame {
  readonly nation: string
  readonly name: string
  readonly region: string | null
  readonly tier: number | null
  readonly started: string
  readonly end: { readonly kind: 'win' | 'lose' | 'quit'; readonly season: number; readonly at: string } | null
  readonly seasons: number
  readonly current: boolean
}

type Front = { kind: 'title' } | { kind: 'boards' } | { kind: 'nations'; region: RegionId } | { kind: 'detail'; region: RegionId; id: string } | { kind: 'annals' }
  /** 도감 — back: 돌아갈 판 바깥 화면 (null 이면 판으로) */
  | { kind: 'dex'; board: DexBoard; sel: string | null; back: Front | null }
  /** 단련터 — 끝 화면(end)에서 오면 그 판의 우리 장수, 첫 화면(title)에서 오면 단련 기록이 있는 모두 (drill.ts · HERO-GROWTH ★ §C) */
  | { kind: 'drill'; from: 'end' | 'title'; ids: string[] | null; gain: Record<string, number>; fell: string[]; anim: boolean; last: string | null; slot?: { id: string; i: number } | null }
  /** 옛 무덤 — 이긴 판의 상자 셋 (relics.ts · HERO-GROWTH ★ §B). fresh 면 방금 연 상자가 터진다 */
  | { kind: 'tomb'; fresh: boolean }

export function mountRealmApp(root: HTMLElement, host: AppHost): { show(r: Realm | null, before: Realm | null, report: Report | null, fresh?: boolean): void; cloudChanged(): void } {
  const style = document.createElement('style')
  style.textContent = FIT_CSS + MQ_CSS + TIP_CSS + UPDATE_CSS + APP_CSS.replaceAll('__ART__', ART) + LOG_CSS + TINT_CSS + MOOD_CSS + AUD_CSS.replaceAll('__ART__', ART) + MAP_CSS.replaceAll('__ART__', ART) + FEEL_CSS + BATTLE_CSS + WAR_CSS.replaceAll('__ART__', ART) + HERO_CSS + GROW_CSS + WOO_CSS + DEX_CSS.replaceAll('__ART__', ART) + LEGACY_CSS + DRILL_CSS.replaceAll('__ART__', ART) + RELIC_CSS.replaceAll('__ART__', ART) + CLOUD_CSS + WINFX_CSS + SAVE_CSS + (FRONT_CSS + SEASONP_CSS + UI_CSS + GOAL_CSS).replaceAll('__ART__', ART)
  document.head.appendChild(style)
  root.classList.add('ap')
  installTips(root)
  /** 배경 음악 · 계절 바람 — 싸움 창이 열려 있으면 싸움 음악 */
  const music = makeMusic(BASE, muted, () => root.querySelector('.nightov') !== null) // 밤 판이 떠 있으면 조용히 — 밤 판은 제 소리를 낸다
  let warOn = false
  root.innerHTML = `<header class="top"></header><div class="mapwrap"></div><div class="seasonp" aria-hidden="true">${seasonParticles()}</div><div class="legend"></div><div class="zbtns"><button data-act="layers" class="lyb" aria-label="보기">👁</button><button data-act="zin">＋</button><button data-act="zout">－</button></div><div class="layers"></div><button class="next" data-act="next"></button><div class="todo"></div><div class="selbar"></div><div class="roadkey"></div><div class="tutband"></div><div class="goalb"></div>`
    + `<nav class="tabs"></nav><div class="back" data-act="close"></div><section class="sheet"></section><div class="modal"></div><div class="plbox"></div>`
  const $ = (sel: string): HTMLElement => root.querySelector<HTMLElement>(sel)!
  const zoom = attachZoom($('.mapwrap'))
  // 배우는 판의 빛낼 곳 — 단계마다 갈아 끼우는 <style> (tutorial.ts)
  const tutSheet = document.createElement('style')
  tutSheet.textContent = ''
  document.head.appendChild(tutSheet)
  const tutBase = document.createElement('style')
  tutBase.textContent = TUT_CSS
  document.head.appendChild(tutBase)
  // 누를 곳만 밝히고 그곳만 눌리게 (tutorial.createSpot — 형: "그걸 눌러야 진행되게")
  const spot = createSpot(root)
  /** 배우는 판 — 지금 할 단계 · 이 판에서 누른 단추 · 그만뒀나 (이 기기에 판마다 기억) */
  let tut = { seed: -1, i: 0, acts: new Set<string>(), off: false }
  const TUT_KEY = 'hanbal.realm.tut'
  const loadTut = (): void => {
    if (realm === null || realm.region !== 'tutorial') return
    if (tut.seed === realm.seed) return
    tut = { seed: realm.seed, i: 0, acts: new Set(), off: false }
    try {
      const d = JSON.parse(localStorage.getItem(TUT_KEY) ?? 'null') as { seed?: number; i?: number; acts?: string[]; off?: boolean } | null
      if (d !== null && d.seed === realm.seed) tut = { seed: realm.seed, i: d.i ?? 0, acts: new Set(d.acts ?? []), off: d.off === true }
    } catch { /* 처음부터 */ }
  }
  const saveTut = (): void => {
    try { localStorage.setItem(TUT_KEY, JSON.stringify({ seed: tut.seed, i: tut.i, acts: [...tut.acts], off: tut.off })) } catch { /* 저장 못 하는 곳 */ }
  }

  let realm: Realm | null = null
  let before: Realm | null = null
  /** 이번 계절에 막 알게 된 나라 — 지도에서 한 번 서서히 드러난다 (발견) */
  let fresh = new Set<string>()
  let report: Report | null = null
  let showReport = false
  /** 판 바깥의 화면 — 처음엔 첫 화면 */
  let front: Front | null = { kind: 'title' }
  /** 옛 무덤 — 고른 상자가 떨리는 중 (그동안 다른 누름은 먹지 않는다) */
  let tombShaking = false
  /** 새 판의 서막 몇째 장 — null 이면 없음 */
  let prologue: number | null = null
  /** 끝난 판의 지도를 둘러보는 중 */
  let looking = false
  let sheet: Sheet | null = null
  /** 이번 계절의 명령 거리 */
  let armyOrders: Order[] = [] // 나누기·모으기 — 화면은 이걸 먼저 해 본 판을 보인다
  let musters: Order[] = [] // 징병·해산
  let settles: Order[] = [] // 개척 — 나누기처럼 먼저 해 본 판에 든다 (그래야 남은 몫·곡식이 맞게 보인다)
  const pick: Record<string, { edge: string; ambush: boolean; approach?: Approach; ration?: Ration; goal?: string; follow?: boolean; adviser?: string } | undefined> = {}
  /** 먼 갈 곳을 거둔 군대 — 이번 계절 「머문다」를 눌렀다 (형 10-25 · goal.ts) */
  let goalStop: string[] = []
  /** 이번 계절 큰 화면으로 본 땅의 바뀜 — `계절:고을` (확인을 눌렀다) */
  const landSeen = new Set<string>()
  let scout = ''
  /** 정찰 고정 — 매 계절 저절로 그곳으로 (형 10-23: "정찰을 매 턴 보내야 하는데 지속 정찰로 고정 버튼") · 이 기기에 */
  const KEEP_KEY = 'hanbal.realm.scoutKeep'
  let scoutKeep = ((): string => { try { return localStorage.getItem(KEEP_KEY) ?? '' } catch { return '' } })()
  const setKeep = (v: string): void => { scoutKeep = v; try { if (v === '') localStorage.removeItem(KEEP_KEY); else localStorage.setItem(KEEP_KEY, v) } catch { /* 저장 못 하는 곳 */ } }
  /** 소도 제사 — 봄·가을에 한 번 */
  let rite = false
  /** 남의 나라가 걸어온 청에 대한 답 — 답이 없으면 거절로 친다 */
  const answers: Record<string, boolean> = {}
  /** 군대 말을 한 번이라도 눌러 봤나 — 그 전까지만 「명령?」 말풍선 (배운 뒤엔 시끄럽다) */
  const TOK_KEY = 'hanbal.realm.tokTapped'
  let tokTapped = ((): boolean => { try { return localStorage.getItem(TOK_KEY) === '1' } catch { return false } })()
  /** 사건 카드의 자막 몇째 장 — 열쇠는 card:계절 (화면의 일 · 판은 모른다) */
  const cardBeat: Record<string, number> = {}
  /** 경계를 강화할 우리 고을 */
  let guards: string[] = []
  /** 보고 카드에서 답·경계를 누른 뒤 다시 그릴 때는 싸움 카드를 다시 돌리지 않는다 */
  let fastNext = false
  /** 이번 계절의 사신 — ekey(나라, 청)마다 하나 */
  const envoys: Record<string, Envoy> = {}
  /** 그 나라에 이번 계절 보낸 사신들 */
  const sentTo = (to: string): Envoy[] => Object.values(envoys).filter((e) => e.to === to)
  /** 이번 계절의 공작 (한 계절에 P.realm.plotsPerSeason 개) · 외교 판의 갈래 · 펼친 공작 */
  let plots: Order[] = []
  /** 장수 명령 — 맡기기 · 이끌기 · 회유 · 떠돌이 들이기 (HEROES §3·§4) */
  let heroOrders: Order[] = []
  /** 「다음 계절」 전에 한 번 물어본 계절 — 쉬는 장수·안 보낸 정찰이 있으면 그 판으로 데려가고, 한 번 더 누르면 넘긴다 (형 10-23) */
  let nudgedAt = -1
  /** 군막 — 이번 계절 「다음 계절」 앞에서 전략 회의를 연 계절 (councilDue) */
  let councilAt = -1
  /** 이번 계절 전략 회의를 마친 군대(나눠 떠난 무리도) — 「다음 계절」에서 같은 회의를 또 열지 않는다 (형 10-29: "전략회의 한번 하고 다음 계절 넘어갈 때 똑같은 전략회의 또 발생") */
  const councilDone = new Map<string, number>()
  /** 전략 회의 — 적 고을을 칠 때 화면 가득 (지도에서 고른 출정 · 「다음 계절」 앞 마지막 걸음). next 면 출정 뒤 계절을 넘긴다 */
  // step — 지금 안건(다 지나면 정리) · beat — 그 안건에서 몇째 장수가 말하는 중(다 말하면 물음과 고르기)
  let stratOpen: { army: string; next: boolean; goal?: string; step?: number; beat?: number; man?: boolean } | null = null
  /** 회유를 맡길 장수 — 포로마다 */
  const persuadeBy: Record<string, string> = {}
  /** 회유할 사람 고르기 상자를 띄운 포로 (woo-view.pickBoxHtml) */
  let wooPick: string | null = null
  /** 고른 세기(난이도) — 판마다. 캠페인의 장은 판 고르기 화면에서 고른다 (없으면 보통 · 군장) */
  const tierPick: Partial<Record<RegionId, number>> = {}
  /** 캠페인의 장에 쓸 세기 — 판 고르기 화면 맨 위 */
  let chapTier = 1
  /** 원정 고르는 중 — 장수마다 갈 곳·길이 (명령이 되기 전) */
  const expPick: Record<string, { dest: ExpDest; len: 0 | 1 | 2 }> = {}
  /** 나라 카드에서 "있었던 일"을 다 펼친 나라 */
  const deedsOpen = new Set<string>()
  /** 외교 판에서 펼친 나라 — 접으면 군주 얼굴 · 깃발 · 이름 · 군주 · 탈 · 사이만 (형 10-27: "나라마다 열고 닫을 수 있게") */
  const diploOpen = new Set<string>()
  let diploMode: 'envoy' | 'plot' | 'scout' = 'envoy'
  /** 장수 판의 탭 — 우리 장수 · 옥에 가둔 적장 · 적장 (형 10-23: "한 페이지에 다 담지 말고 탭을 나눠야") */
  let heroTab: 'cmd' | 'mine' | 'jail' | 'foe' = 'cmd'
  /** 「명령」에서 연 일 창 — null 이면 일 카드 여섯 · cmdHero 는 그 창에서 고른 장수 ('' 이면 그 일에 가장 맞는 이) */
  let cmdJob: CmdJob | null = null
  /** 판을 열기 전 「데려갈 장수」 팝업 — 고른 판 (형 10-25: "게임 시작할 때 데려갈 장수가 팝업으로 · 영웅전 내 기록의 장수만 · 가능한 수대로 체크") */
  let bringAsk: { nation: string; region: RegionId; tier: number } | null = null
  /** 이번에 새로 새긴 단련 공 — 끝 화면이 처음 그려질 때 (drill.engraveRun). 단련터의 막대가 이만큼 차오른다 */
  let drillGain: Record<string, number> = {}
  /** 판이 끝났으면 공을 새긴다 — 몇 번 불러도 한 번만 든다 (무한 모드로 이어 둔 몫만 더) */
  const engraveNow = (r: Realm | null): void => {
    if (r === null || r.outcome == null) return
    const g = engraveRun(r)
    if (Object.keys(g).length > 0) drillGain = g
  }
  /** 단련터를 나선다 — 끝 화면에서 왔으면 끝 화면으로(필름은 건너뛰고 단추부터), 첫 화면에서 왔으면 첫 화면으로 */
  const yardLeave = (): void => {
    const end = front?.kind === 'drill' && front.from === 'end' && realm?.outcome != null
    drillGain = {}
    front = end ? null : { kind: 'title' }
    fastNext = end
    paint()
  }
  /** 첫 화면 「다른 판」에서 ✕ 를 한 번 누른 판 — 한 번 더 누르면 지운다 */
  let slotArmed: number | null = null
  /** 첫 화면 「더 보기」를 펼친 채로 — 안에서 단추(새 전투 시험)를 눌러 다시 그려도 접히지 않게 */
  let fmoreOpen = false
  /** 「저장 · 불러오기」 창 — 열려 있으면 (game: 판 안 · title: 첫 화면의 불러오기만) */
  let saveBox: { mode: 'game' | 'title'; name: string; ask: SaveAsk | null; msg: { text: string; bad: boolean } | null } | null = null
  let cmdHero = ''
  /** 공작 칩 격자(외교·고을 판)에서 펼친 갈래 — null 이면 접힘 */
  let plotOpen: PlotOp | null = null
  /** 장수 판에서 「공작」으로 데려온 장수 — 「누가 가나」 맨 앞에 켜 둔다 (null 이면 없음) */
  let plotAgent: string | null = null
  /** 펼친 갈래에서 누른 노릴 곳 줄 — 그 바로 밑에 「누가 가나」를 펼친다 (plotKey) */
  let plotPick = ''
  /** 이간 — 왼쪽 · 오른쪽 칸에 고른 나라 (형 10-27: "리스트를 쫙 두지 말고 왼쪽에 하나 오른쪽에 하나 나라 빈칸 · 국기로 선택") */
  let sowA = ''
  let sowB = ''
  /** 고을 판에서 펼쳐 둔 칸 (땅 이야기 · 고을 형편 · 나는 것 …) — 처음엔 다 접혀 있다 (형 10-25: "마을마다 있는 상세한 정보 너무 길게 … 접어두거나") */
  const foldOpen = new Set<string>()
  /** 접는 칸 하나 — 제목 줄(누르면 펼침/접음)과 몸. 몸이 비면 아무것도 안 그린다 */
  const fold = (k: string, title: string, body: string): string =>
    body === '' ? '' : `<button class="nfh${foldOpen.has(k) ? ' on' : ''}" data-act="fold" data-k="${k}"><span>${title}</span><i>${foldOpen.has(k) ? '▴' : '▾'}</i></button>${foldOpen.has(k) ? `<div class="nfb">${body}</div>` : ''}`
  /** 시트 안의 손 상태 */
  let openArmy = ''
  /** 출정을 꾸리는 군대의 판 (형: "다 같이 간다 말고 … 출정? 일부만 출정?") — 군사는 처음엔 전부, 줄이면 나머지가 남아 지킨다 */
  // chose — 전략 회의에서 안건마다 고른 말(그 말의 label) · lead — 나서서 이끌겠다는 장수 · wait — 이번 계절은 기다린다
  let sortieD: { take: Partial<Record<UnitKind, number>>; hero: boolean; edge: string | null; approach: Approach; ration: Ration | undefined; follow?: boolean; adviser?: string; chose?: Partial<Record<AgendaId, string>>; lead?: string; wait?: boolean } = { take: {}, hero: true, edge: null, approach: 'road', ration: undefined }
  /** 출정 판의 진군 방식·군량 단추가 가리키는 이름 (군대 id 대신) */
  const SORTIE = '~sortie'
  /** 출정 판을 연다 — 이미 정한 출정이 있으면 그대로 불러온다 */
  function openSortie(a: Army): void {
    const p = pick[a.id]
    openArmy = a.id
    sortieD = { take: { ...a.mix }, hero: true, edge: p?.edge ?? null, approach: p?.approach ?? (p?.ambush === true ? 'night' : 'road'), ration: p?.ration, ...(p?.follow === true ? { follow: true } : {}), ...(p?.adviser !== undefined ? { adviser: p.adviser } : {}) }
  }
  const draftUnit: Record<string, UnitKind> = {}
  const draftN: Record<string, number> = {}
  /** 징병에 철을 들여 한 단계 좋은 무기로 */
  const draftIron: Record<string, boolean> = {}
  /** 사신을 꾸미는 중 — 누구에게 · 무엇을 · 얼마 · 어디 */
  let compose: { to: string; ask: Ask; give: Record<Good, number>; take: Record<Good, number>; target: string; hero: string } = { ...NO_COMPOSE, give: noGoods(), take: noGoods() }
  let note = ''
  /** 방금 나눈 무리 — 그 카드를 밝히고 눈앞으로 가져온다 (다음 누름에 지운다) */
  let freshArmy = ''
  /** 이번 계절에 직접 쏜 결과 — 적장마다 (한 번만 쏜다) */
  const hands: Record<string, Hand> = {}
  /**
   * 지도에서 고른 우리 군대 — 갈 곳이 밝아진다. 같은 고을의 말을 하나씩 더 누르면 함께 골라진다
   * (형: "같은지역군대들은 하나씩 탭한다면 둘이 동시선택할수있게하고 합치기 버튼이 떴으면")
   */
  let armySel: string[] = []
  /** 아래 띠에서 장수 얼굴을 눌러 연 「이끌 장수」 고르기 — 그 군대 id (고른 군대가 바뀌면 저절로 닫힌다) */
  let leadPop = ''
  /**
   * 고른 개척단 — 계획 판(plan)의 개척단 id. 이번 계절 꾸리기로 한 것도 계획 판에는 벌써 서 있다.
   * (형 10-23: "백성 배치 … 아직도 이해가 안 돼" → 문명의 개척자처럼 지도에 말 하나). armySel 과 함께 켜지지 않는다
   */
  let partySel = ''
  /** 장수 판의 「사신으로 보낸다」 — 다음에 꾸리는 사신에 이 장수를 미리 고른다 */
  let envoyPick = ''
  /** 배우는 판 — 지금 단계와 그 단계에 들어선 때 (오래 머물면 「건너뛰기」) */
  let tutStepAt: [number, number] = [-1, 0]
  /** 등용 단추를 누른 그 순간 장면을 보여 준 떠돌이 — 계절이 넘어갈 때 같은 장면을 또 띄우지 않는다 */
  const hireShown = new Set<string>()
  /** 태몽을 이미 보여 준 짝 — 한 쌍에 한 번 (이 화면을 여는 동안) */
  const dreamt = new Set<string>()
  /** 백성 배치 판에서 고르는 중인 몫 — 고을 → 더하고 뺀 집 (모아 둔 백성 = −합) */
  let placeDraft: Record<string, number> = {}
  /** 백성 배치 −/+ 한 번의 몫 — 뗄 때는 한 집은 남기고 한도 안에서, 부을 때는 모아 둔 만큼 · 품까지. 0 이면 못 누른다 */
  function placeStepOf(id: string, add: boolean): number {
    const base = realm!
    const ids = placeNodes(base, me())
    const dd = (x: string): number => placeDraft[x] ?? 0
    const n = base.nodes[id]!
    const now = n.hh + dd(id)
    const step = P.realm.placeStep
    if (add) {
      const pool = -ids.reduce((s, x) => s + dd(x), 0)
      return Math.max(0, Math.min(step, pool, homeRoom(n) - now))
    }
    const out = ids.reduce((s, x) => s + Math.max(0, -dd(x)), 0)
    let k = Math.max(0, Math.min(step, now - 1))
    // 이 고을이 받은 몫을 되돌리는 동안은 옮김이 늘지 않는다 — 넘는 만큼만 한도에 걸린다
    const grow = (x: number): number => Math.max(0, -(dd(id) - x)) - Math.max(0, -dd(id))
    while (k > 0 && out + grow(k) > placeLimit(base, me())) k--
    return k
  }
  /** 길 보기 펼침 */
  let roadOpen = false
  /** 지난 기록 — 걸러 보기 갈래 · 나라 (logbook.ts) */
  let logFilter: LogFilter = 'all'
  let logNation: string | null = null
  /** 지도 보기 켜고 끄기 — 펼침 (켜고 끈 것은 이 기기에 기억) */
  let layersOpen = false
  const hiddenLayers = new Set<LayerId>()
  try {
    const v = JSON.parse(localStorage.getItem(LAYER_KEY) ?? '[]') as unknown
    if (Array.isArray(v)) for (const x of v) if (LAYERS.some((l) => l.id === x)) hiddenLayers.add(x as LayerId)
  } catch { /* 처음엔 다 켜짐 */ }
  applyLayers()
  /** 탭의 빨간 점 — 본 것 */
  let seenKeys = new Set<string>()
  /** 지도에서 또렷하게 볼 나라 — 깃발 줄에서 누른다 */
  let focus: string | null = null

  const me = (): string => realm!.player
  /** 안내 글에 낱말 색 — 나라는 그 나라 색, 군사는 붉게, 마을은 갈색 (tint.ts) */
  // 한 덩이로 감싼다 — 띠(flex) 안에서 색칠한 낱말마다 칸이 갈려 세로로 쪼개지던 것 (형 10-23: "도읍 졸본 도읍을 잃었다 이거 너무 좁아서 다 세로로 줄바꿈")
  const tx = (s: string): string => `<span class="txw">${realm === null ? esc(s) : tint(esc(s), {
    nations: Object.values(realm.factions).map((f) => [f.name, FACTION_ART[f.id]?.color ?? '#888'] as const),
    heroes: Object.values(realm.heroes).map((x) => x.name),
    places: Object.values(realm.nodes).map((n) => n.name),
  })}</span>`
  // 맡기기·이끌기는 나누기처럼 먼저 해 본 판에 든다 — 장수 카드가 바뀐 자리를 바로 보인다
  // 들이기도 든다 — 들인 떠돌이가 바로 우리 장수로 보이고 군대를 이끌 수 있게 (형: "들인다 했을때 바로 적용되어야 하고 군사배치에도 쓸수 있어야 함")
  const planWith = (ss: readonly Order[]): Realm => planned(realm!, [...armyOrders, ...ss, ...heroOrders.filter((o) => o.kind === 'hire' || o.kind === 'assign' || o.kind === 'lead')])
  const plan = (): Realm => planWith(settles)

  // ───────── 개척단 — 꾸리기(party)·옮기기(partyGo) 명령은 settles 에 든다 (계획 판에 바로 보인다 · parties.ts)
  type FormOrder = Extract<Order, { kind: 'party' }>
  /** 이번 계절 꾸리는 개척단의 id — 엔진(parties.formParty)이 붙이는 이름과 같다 (한 고을에 한 계절 하나만 꾸린다) */
  const formId = (node: string): string => `party-${realm!.season}-${node}`
  const formOf = (id: string): FormOrder | undefined => settles.find((o): o is FormOrder => o.kind === 'party' && formId(o.node) === id)
  /** 개척단을 길 하나로 — 이번 계절 꾸린 것이면 꾸리기에 길을 싣고, 서 있던 것이면 partyGo. 같은 길을 또 누르면 거둔다 */
  function sendParty(id: string, edge: string): void {
    const f = formOf(id)
    if (f !== undefined) {
      const rest = settles.filter((x) => x !== f)
      settles = [...rest, f.edge === edge ? { kind: 'party', faction: f.faction, node: f.node } : { ...f, edge }]
      return
    }
    const g = settles.find((o) => o.kind === 'partyGo' && o.party === id)
    settles = settles.filter((x) => x !== g && !(x.kind === 'partyJoin' && x.party === id))
    if (g === undefined || (g.kind === 'partyGo' && g.edge !== edge)) settles = [...settles, { kind: 'partyGo', party: id, edge }]
  }
  const clearParty = (): void => { partySel = '' }
  /** 이번 계절 지금 선 우리 고을에 눌러앉힐 수 있는 개척단 — 계절 처음 판 기준 (이번 계절 꾸린 것은 거두기로 한다) */
  const joinHere = (node: string): Party[] => partiesOf(realm!, me()).filter((p) => p.at === node && joinable(realm!, p) && formOf(p.id) === undefined)
  const joining = (id: string): boolean => settles.some((o) => o.kind === 'partyJoin' && o.party === id)

  /**
   * 이번 계절 고른 것을 다 치르고 남는 것 (형: "철이부족해도 강화 선택이 가능해져버려있고") — 징병·무장·목책·경계는 엔진과 같은 함수로
   * 먼저 해 보고, 제사·공작·자객의 활·사신 선물은 값만 뺀다. 단추는 이 남은 몫으로 켜고 끈다. 그리기 한 번에 한 번 셈한다.
   */
  let leftCache: { key: string; st: Record<Good, number> } | null = null
  function left(): Record<Good, number> {
    const key = JSON.stringify([realm!.season, armyOrders, settles, heroOrders, musters, guards, rite, plots, envoys])
    if (leftCache !== null && leftCache.key === key) return leftCache.st
    const p = planned(realm!, [
      ...armyOrders, ...settles, ...musters.filter((o) => o.kind !== 'disband'),
      ...guards.map((node): Order => ({ kind: 'guard', faction: me(), node })),
      ...heroOrders.filter((o) => o.kind === 'hire' || o.kind === 'assign' || o.kind === 'lead'),
    ])
    const st = Object.fromEntries(GOODS.map((g) => [g, goodOf(p.stock[me()], g)])) as Record<Good, number>
    const pay = (c: { grain: number; iron: number } | null): void => {
      if (c !== null) { st.grain -= c.grain; st.iron -= c.iron }
    }
    if (rite) pay(riteCost(realm!, me()))
    for (const o of plots) if (o.kind === 'plot') pay(plotCost(o.op, o.agent ?? null))
    if (musters.some((o) => o.kind === 'bowUp')) pay(bowUpCost(realm!, me()))
    for (const e of Object.values(envoys)) for (const g of GOODS) st[g] -= e.give[g] ?? 0
    // 원정 길 양식 — 계절을 넘길 때 징병·등용 뒤에 치른다. 여기서 안 빼면 「보낼 수 있다」고 해 놓고 말없이 빠진다 (형 10-24)
    for (const o of heroOrders) if (o.kind === 'expedition') st.grain -= P.realm.expGrainPer * EXP_SEASONS[o.len]
    leftCache = { key, st }
    return st
  }

  function resetTurn(): void {
    armyOrders = []
    leadPop = ''
    armySel = [] // 지난 계절에 움직인 군대가 다음 계절에 골라진 채로 남지 않게 (형: "전계절에 이동시킨유닛이 자동선택되어있음")
    clearParty()
    musters = []
    settles = []
    for (const k of Object.keys(pick)) delete pick[k]
    goalStop = []
    // 고정해 둔 곳을 우리가 차지했거나(없어졌거나) 하면 고정은 저절로 풀린다 — 우리 땅은 정찰할 것이 없다
    if (scoutKeep !== '' && realm !== null && (realm.nodes[scoutKeep] === undefined || realm.nodes[scoutKeep]?.owner === me())) setKeep('')
    // 고정해 둔 곳이 아직 맞닿아 있으면 그리로 — 아니면 이번 계절은 쉰다(고정은 남는다)
    scout = scoutKeep !== '' && realm !== null && scoutable(realm).includes(scoutKeep) ? scoutKeep : ''
    rite = false
    for (const k of Object.keys(answers)) delete answers[k]
    guards = []
    for (const k of Object.keys(envoys)) delete envoys[k]
    plots = []
    for (const k of Object.keys(hands)) delete hands[k]
    heroOrders = []
    plotOpen = null
    openArmy = ''
    note = ''
    compose = { ...NO_COMPOSE, give: noGoods(), take: noGoods() }
  }

  /**
   * 우리 장수가 이번 계절 묶여 있는 까닭 — 원정 중 · 다침 · 자리를 비움 · 이번 계절 고른 일(자객·사신·원정·혼인·이끌기·맡기기). 쉬면 null.
   * 묶인 장수는 판에서 흐리게 하고 할 일 단추를 숨긴다 — 누르면 사정은 보인다 (형 10-23: "원정 중이거나 뭐 하고 있어서 못 쓰는 턴에는 … 정보만 보여 주게")
   */
  /** 이번 계절 이 장수가 묶인 일 — [긴 말, 「~하는 중」 짧은 말] · 없으면 null */
  function heroJob(r: Realm, id: string): readonly [string, string] | null {
    const h = r.heroes[id]
    if (h === undefined || h.faction !== me() || h.status !== 'free') return null
    const ex = (r.expeditions ?? []).find((x) => x.hero === id)
    if (ex !== undefined) { const n = Math.max(1, ex.back - r.season + 1); return [`원정 중 · ${n}계절 뒤 돌아온다`, `원정 중 · ${n}계절 뒤`] }
    if (h.woundedUntil !== undefined && h.woundedUntil > r.season) { const n = h.woundedUntil - r.season; return [`다쳐 누웠다 · ${n}계절`, `다쳐 쉬는 중 · ${n}계절`] }
    if (h.awayUntil !== undefined && h.awayUntil >= r.season) return ['자리를 비웠다', '길에 있는 중']
    const pl = plots.find((o): o is Extract<Order, { kind: 'plot' }> => o.kind === 'plot' && o.agent === id)
    if (pl !== undefined) return NIGHT_OPS.has(pl.op) ? ['이번 계절 자객으로 간다', '자객으로 가는 중'] : [`이번 계절 ${PLOT_NAME[pl.op]} 공작을 하러 간다`, `${PLOT_NAME[pl.op]} 공작 가는 중`]
    const ev = Object.values(envoys).find((e) => e.hero === id)
    if (ev !== undefined) { const to = r.factions[ev.to]?.name ?? ''; return [`이번 계절 ${to}에 사신으로 간다`, `${to}에 사신 가는 중`] }
    for (const o of heroOrders) {
      if (o.kind === 'expedition' && o.hero === id) return ['이번 계절 원정을 떠난다', '원정 떠나는 중']
      if (o.kind === 'wed' && (o.a === id || o.b === id)) return ['이번 계절 혼인한다', '혼인하는 중']
      if (o.kind === 'assign' && o.hero === id && o.node !== null) { const n = r.nodes[o.node]?.name ?? ''; return [`이번 계절 ${josa(n, '을', '를')} 맡는다`, `${n} 맡으러 가는 중`] }
      if (o.kind === 'lead' && o.hero === id) return ['이번 계절 군대를 이끈다', '군대 이끌러 가는 중']
      if (o.kind === 'persuade' && o.by === id) return ['이번 계절 포로를 달랜다', '포로 달래는 중']
      if (o.kind === 'cohabit' && o.hero === id) return ['이번 계절 짝에게 가서 함께 지낸다', '짝에게 가는 중']
      // 짝을 맞는 쪽 — 오는 짝을 기다려야 하니 다른 일을 맡으면 안 된다 (형 10-24: "신방에 들이기 해 두면 자꾸 조작 가능하게 보인다")
      if (o.kind === 'cohabit' && r.heroes[o.hero]?.spouse === id) return ['이번 계절 짝을 맞아 함께 지낸다', '짝 맞는 중']
    }
    return null
  }
  function heroBusy(r: Realm, id: string): string | null { return heroJob(r, id)?.[0] ?? null }
  /** 이번 계절 내가 시킨 일이 있나 — 사신·공작·원정·혼인·맡기기·이끌기·대기… (없으면 알아서 일한다) */
  function orderedByMe(id: string): boolean {
    return plots.some((p) => p.kind === 'plot' && p.agent === id) || Object.values(envoys).some((e) => e.hero === id)
      || heroOrders.some((o) => heroJobOf(o) === id || (o.kind === 'assign' && o.hero === id) || (o.kind === 'wed' && (o.a === id || o.b === id)))
  }

  /**
   * 대기시킬 수 있나 — 연락이 닿고(원정 중·먼 길 위·사로잡힘이 아니고) 내려놓을 것이 있다(맡은 고을 · 이끄는 군대 · 이번 계절 시킨 일)
   * (형 10-24: "사신 보내 두거나 원정 보내 사실상 연락할 수 없는 상태가 아니면 대기 상태로 만드는 버튼")
   */
  function canStandBy(r: Realm, id: string): boolean {
    const h = r.heroes[id]
    if (h === undefined || h.faction !== me() || h.status !== 'free') return false
    if ((r.expeditions ?? []).some((x) => x.hero === id) || (h.awayUntil !== undefined && h.awayUntil >= r.season)) return false
    const army = Object.values(r.armies).find((a) => a.hero === id)
    if (army !== undefined && army.march !== null) return false // 싸우러 가는 길 — 연락이 안 닿는다
    const job = heroOrders.some((o) => heroJobOf(o) === id || (o.kind === 'assign' && o.hero === id))
      || Object.values(envoys).some((e) => e.hero === id) || plots.some((p) => p.kind === 'plot' && p.agent === id)
    return job || h.post != null || army !== undefined
  }

  /** 대기 — 이번 계절 시킨 일을 거두고(사신은 사자만 간다 · 그 장수의 자객 공작은 거둔다) 맡은 자리·군대를 내려놓는 명령을 넣는다 */
  function standBy(id: string): void {
    if (realm === null || !canStandBy(realm, id)) return
    heroOrders = heroOrders.filter((o) => heroJobOf(o) !== id && !(o.kind === 'assign' && o.hero === id))
    for (const [k, e] of Object.entries(envoys)) if (e.hero === id) { const { hero: _drop, ...rest } = e; envoys[k] = rest }
    plots = plots.filter((p) => !(p.kind === 'plot' && p.agent === id))
    delete hands[id]
    const h = realm.heroes[id]!
    if (h.post != null || Object.values(realm.armies).some((a) => a.hero === id)) heroOrders = [...heroOrders, { kind: 'assign', hero: id, node: null }]
    // 손수 쉬게 한 장수 — 재상이 다음 계절에 도로 일을 주지 않게 직접 부리는 장수로 (장수 판에서 다시 「재상에게 맡김」으로 돌린다)
    setManual(id, true)
  }

  /**
   * 이 군대를 지금 이끌 수 있는 우리 장수 — 같은 고을에 혼자 있고 이번 계절 묶인 일이 없다(다침·길 위·원정·다른 일은 heroBusy).
   * 군주도 든다(친정). 군대 판의 「이끌 장수」와 지도 띠의 장수 고르기가 같은 셈을 쓴다
   */
  function leadCands(r: Realm, a: Army): Hero[] {
    return sorted(Object.values(r.heroes)).filter((x) => x.faction === me() && x.status === 'free' && x.at === a.at && !Object.values(r.armies).some((b) => b.hero === x.id) && heroBusy(r, x.id) === null && !handLocked(r, x.id))
  }

  /**
   * 우리 장수에게 일을 맡기면 그 장수가 곧바로 대답한다 — 「네?」 「부르셨습니까?」 (voice.ts · 형 10-26: "다른 데에서는 아무데서도 장수목소리가 안들리는데").
   * 너무 잦으면 voiceGate 가 거른다
   */
  function bark(id: string | undefined, line: VoiceLine = 'tap'): void {
    const h = id !== undefined && id !== '' ? realm?.heroes[id] : undefined
    // 내 군주는 나 자신이다 — 부르면 대답하지 않는다 (형 10-29: "내가 나를 부르는 격")
    if (h === undefined || realm === null || h.faction !== me() || isRuler(realm, h.id) || !voiceGate(performance.now())) return
    ding(voicePath(h, line, isRuler(realm, h.id)), P.realm.voiceVol)
  }

  /**
   * 일을 확정하면 그 장수가 분부를 받든다 — 「분부대로 하겠습니다」 (고를 때는 bark 의 짧은 대답 · 형 10-27).
   * 우리 장수만 — 이름 없는 사자 · 고용 밀정 · 고용 자객은 장수가 아니라 소리가 없다
   */
  function obey(id: string | undefined): void { bark(id, 'obey') }

  /**
   * 지도 띠에서 이 군대의 장수를 바꾼다 — 고른 장수가 이끌고(lead) 이끌던 장수는 그 고을에 남는다(assign null · 대기와 같은 명령).
   * 이번 계절 이 군대에 먼저 고른 장수는 거두고 다시 정한다. 계절 처음의 장수를 다시 고르면 그대로 둔다. id '' 는 장수 없이(대기)
   * (형 10-26: "하단 장수아이콘 탭하면 … 맡기기 가능한 장수골라서 · 이미 장수가 이끄는 군대라면 다른 가능한장수로 교체")
   */
  function pickLeader(armyId: string, id: string): void {
    if (realm === null) return
    heroOrders = heroOrders.filter((o) => !(o.kind === 'lead' && o.army === armyId))
    const was = realm.armies[armyId]?.hero ?? null
    if (was !== null && was === id) {
      heroOrders = heroOrders.filter((o) => !(o.kind === 'assign' && o.hero === was && o.node === null))
      return
    }
    const cur = plan().armies[armyId]?.hero ?? null
    if (id === '') {
      if (cur !== null) standBy(cur)
      return
    }
    if (cur !== null) heroOrders = [...heroOrders, { kind: 'assign', hero: cur, node: null }]
    heroOrders = [...heroOrders, { kind: 'lead', hero: id, army: armyId }]
  }

  /** 이 장수를 직접 부리나 — 판에 적는다 (계절을 넘기면 판과 함께 저장된다 · 그 전엔 초안에) */
  function setManual(id: string, self: boolean): void {
    if (realm === null) return
    const list = (realm.manual?.[me()] ?? []).filter((x) => x !== id)
    if (self) list.push(id)
    realm.manual = { ...(realm.manual ?? {}), [me()]: list.sort() }
  }

  /** 이번 계절 아무 일도 안 맡은 우리 장수 — 군대·고을·사신·자객·원정·혼인 어디에도 없다 (군주·다친 이·떠나 있는 이 빼고) */
  function restingHeroes(p: Realm): Hero[] {
    const busy = new Set<string>()
    for (const o of [...heroOrders, ...plots]) {
      for (const k of ['hero', 'agent', 'by', 'a', 'b'] as const) { const v = (o as Record<string, unknown>)[k]; if (typeof v === 'string') busy.add(v) }
    }
    for (const e of Object.values(envoys)) if (e.hero !== undefined) busy.add(e.hero)
    const idle = sorted(Object.values(p.heroes)).filter((h) => h.faction === me() && h.status === 'free' && !isRuler(p, h.id) && h.at !== null && h.post == null
      && !Object.values(p.armies).some((a) => a.hero === h.id) && !busy.has(h.id)
      && !(h.awayUntil !== undefined && h.awayUntil >= p.season) && !(h.woundedUntil !== undefined && h.woundedUntil > p.season)
      && !(p.expeditions ?? []).some((x) => x.hero === h.id))
    // 사신·공작은 「군장의 사자 + 일 없는 장수」가 나른다 (hands.ts) — 군장의 사자를 넘어 쓴 만큼은 일 없는 장수가 나르는 중이라 쉬는 게 아니다
    // (형 10-23: "장수 하나 사신 보내기 했었는데 쉬고 있는 장수 있다고 뜨는 바람에 사신 보내기 취소되고 … 안 쉬는데 쉰다고 잡는 거 심각한 문제")
    const carrying = Math.max(0, handsUsed() - P.realm.handsBase)
    return idle.slice(0, Math.max(0, idle.length - carrying))
  }

  // ───────── 알아서 일한다 — 림월드·팰월드처럼 장수는 늘 스스로 일을 찾는다 (안의 이름은 옛 「재상」 그대로 · chancellor*)
  // (형 10-26: "쉬는 장수들 일일이 뭐 시키기가 너무 귀찮은데 … 왕이 신하한테 명령을 한다면 하나하나 할 일 매 턴 알려주는 게 이상하잖아")
  // (형 10-26: "자동배치를 재상이 지시하는식으로 하는게 아니라 원래 자동으로 다 알아서 하지만 원정같은 대기필요한 거는 항상 유저가 직접 보내야 하고
  //  사신이나 공작으로 보낼때에는 마을 맡고있는 애들도 내가 보낼수가 있어서 안보낸 경우에만 알아서 고을 맡기를 하는거임")
  //  - 이번 계절 내가 시킨 일이 없으면 고을·군대를 알아서 맡는다 (heroes.idleHeroOrders — AI 와 같은 셈)
  //  - 원정·사신·공작·혼인은 알아서 안 한다 — 내가 보낼 때만 (idleHeroOrders 는 맡기·이끌기만 낸다)
  //  - 고을을 맡은 장수도 사신·공작에 보낼 수 있다 — 그 계절만 자리를 비우고 자리는 그대로, 다음 계절 다시 맡는다 (hands.ownHand)
  /** 재상이 쉬는 장수를 맡나 — 판에 적힌 것 (없으면 켜짐) */
  const autoIdle = (r: Realm): boolean => r.autoIdle !== false
  /** 군주가 직접 부리는 장수 — 재상이 안 건드린다 */
  const manualOf = (r: Realm): ReadonlySet<string> => new Set(r.manual?.[me()] ?? [])
  let chanCache: { key: string; os: Order[] } | null = null
  /**
   * 재상이 이번 계절 맡길 일 — 쉬는 장수(직접 부리는 장수 · 사신·공작을 나르는 손 빼고)에게, AI 와 같은 셈으로 (heroes.idleHeroOrders).
   * 「다음 계절」을 누르면 우리 명령 뒤에 붙는다 — 군주가 고른 일이 먼저다
   */
  function chancellorOrders(): Order[] {
    if (realm === null || !autoIdle(realm)) return []
    const key = JSON.stringify([realm.seed, realm.player, realm.season, armyOrders, settles, heroOrders, plots, envoys, realm.manual?.[me()] ?? []])
    if (chanCache !== null && chanCache.key === key) return chanCache.os
    const p = plan()
    const free = new Set(restingHeroes(p).map((h) => h.id))
    const manual = manualOf(realm)
    const skip = new Set(Object.values(p.heroes).filter((h) => h.faction === me() && (!free.has(h.id) || manual.has(h.id))).map((h) => h.id))
    const os = idleHeroOrders(p, me(), skip, true).map((o): Order => (o.kind === 'assign' || o.kind === 'lead' ? { ...o, by: 'chancellor' } : o))
    chanCache = { key, os }
    return os
  }
  /**
   * 쉬는 장수가 알아서 찾은 일 — 그림 한 줄: 얼굴 · 이름 → 일 아이콘 · 어디 · 무엇 (형 10-26: "재상이 맡긴다가 아니라 알아서 할 일을 찾아 한다 · 텍스트만 주지 말고 아이콘도 · 누가 어디에 뭘 하러 가는지")
   */
  function chanJobHtml(id: string): string {
    const o = chancellorOrders().find((x) => (x.kind === 'assign' || x.kind === 'lead') && x.hero === id)
    if (o === undefined || realm === null) return ''
    const p = plan()
    const h = p.heroes[id]
    if (h === undefined) return ''
    const far = h.at
    let place = '', what = '', ic = '', men = ''
    if (o.kind === 'assign' && o.node !== null) { place = p.nodes[o.node]?.name ?? ''; what = '고을을 맡으러'; ic = 'settle-capital' }
    else if (o.kind === 'lead') {
      const a = p.armies[o.army]
      if (a === undefined) return ''
      place = p.nodes[a.at]?.name ?? ''; what = '군대를 이끌러'; ic = 'unit-general'
      men = `<span class="jmen">${icon('unit-spear', 'jri')}${headcount(forceOf(p, a)).toLocaleString('ko-KR')}</span>`
    } else return ''
    const away = (o.kind === 'assign' ? o.node : p.armies[(o as { army: string }).army]?.at) !== far
    return `<span class="jrow">${bust(h, 'jrf')}<b>${esc(h.name)}</b><i class="jarr">›</i>${icon(ic, 'jri')}<span class="jpl">${esc(place)}</span>${men}<small>${what}${away ? ' · 먼 길' : ''}</small></span>`
  }
  /** 쉬는 장수가 알아서 찾은 일 — 글 한 줄 (「안개골 마을 고을지기」 · 「갈대울 마을의 군사 120명」) */
  function chanJob(id: string): string | null {
    const o = chancellorOrders().find((x) => (x.kind === 'assign' || x.kind === 'lead') && x.hero === id)
    if (o === undefined || realm === null) return null
    const p = plan()
    const far = p.heroes[id]?.at
    if (o.kind === 'assign' && o.node !== null) return `${p.nodes[o.node]?.name ?? ''} 고을지기${far !== o.node ? ' · 먼 길' : ''}`
    if (o.kind === 'lead') {
      const a = p.armies[o.army]
      return a === undefined ? null : `${p.nodes[a.at]?.name ?? ''}의 군사 ${headcount(forceOf(p, a))}명${far !== a.at ? ' · 먼 길' : ''}`
    }
    return null
  }
  /** 군주가 손수 일을 줘야 하는 쉬는 장수 — 재상이 맡으면 직접 부리는 장수만 */
  function waitingHeroes(p: Realm): Hero[] {
    const idle = restingHeroes(p)
    if (realm === null || !autoIdle(realm)) return idle
    const manual = manualOf(realm)
    return idle.filter((h) => manual.has(h.id))
  }
  /** 장수 탭 맨 위 — 재상에게 맡기기 켜고 끄기 · 이번 계절 재상이 할 일 */
  function chancellorBar(): string {
    if (realm === null) return ''
    const on = autoIdle(realm)
    let h = `<div class="jsbar"><div class="seg"><button class="${on ? 'on' : ''}" data-act="js-all" data-v="1">⚙ 알아서 일한다</button><button class="${on ? '' : 'on'}" data-act="js-all" data-v="0">내가 하나하나 맡긴다</button></div>`
    if (on) {
      const jobs = chancellorOrders().flatMap((o) => (o.kind === 'assign' || o.kind === 'lead' ? [o.hero] : []))
      h += jobs.length > 0
        ? `<div class="jsl"><b>⚙ 이번 계절 알아서 갈 곳 · ${jobs.length}명</b>${jobs.map((id) => chanJobHtml(id)).join('')}</div>`
        : `<p class="mute">장수는 고을·군대를 알아서 맡는다. 원정·사신·공작은 내가 보낼 때만 간다. 고을을 맡은 장수도 보낼 수 있다.</p>`
    }
    return h + `</div>`
  }

  /** 그 판 맨 위 — 왜 데려왔는지 한 줄 · 그냥 넘기기 */
  function nudgeHtml(r: Realm, kind: 'heroes' | 'scout'): string {
    if (nudgedAt !== r.season) return ''
    const idle = kind === 'heroes' ? waitingHeroes(plan()) : []
    const msg = kind === 'heroes'
      ? (idle.length === 0 ? '' : realm !== null && autoIdle(realm) ? `직접 부리는 장수 ${idle.length}명이 쉰다: 누르면 그 장수에게 일을 준다` : `쉬는 장수 ${idle.length}명: 누르면 그 장수에게 일을 준다`)
      : (scout === '' ? '이번 계절 정찰을 아직 안 보냈다. 볼 곳을 하나 고른다' : '')
    if (msg === '') return ''
    // 누가 쉬는지 얼굴로 바로 — 누르면 그 장수 판 (형 10-23: "쉬는 장수 1명 뜨긴 하는데 누가 쉬는지를 바로바로 알 수 있어야지")
    const faces = idle.map((x) => `<button class="ndg" data-act="hero" data-id="${x.id}">${bust(x, 'ndf')}<b>${esc(x.name)}</b></button>`).join('')
    return `<div class="nudge"><span>${msg}</span>${faces !== '' ? `<div class="ndgs">${faces}</div>` : ''}<button class="btn sm" data-act="next">그냥 넘긴다 ›</button></div>`
  }

  /** 이 군대의 먼 갈 곳 — 이번 계절 고른 것이 먼저, 거뒀으면 없음, 아니면 판에 있는 것 */
  function goalOf(a: Army): string | undefined {
    if (goalStop.includes(a.id)) return undefined
    const c = pick[a.id]
    if (c !== undefined) return c.goal
    return realm?.armies[a.id]?.goal
  }

  function ordersNow(): Order[] {
    const p = plan()
    const out: Order[] = [...armyOrders, ...settles, ...heroOrders, ...musters]
    for (const [army, c] of Object.entries(pick)) {
      const a = p.armies[army]
      if (c !== undefined && a !== undefined && a.march === null) out.push({ kind: 'march', army, edge: c.edge, ambush: c.ambush, ...(c.approach !== undefined ? { approach: c.approach } : {}), ...(c.ration !== undefined ? { ration: c.ration } : {}), ...(c.follow === true ? { follow: true } : {}), ...(c.adviser !== undefined ? { adviser: c.adviser } : {}) })
      if (c?.goal !== undefined && a !== undefined && a.march === null) out.push({ kind: 'goal', army, node: c.goal })
    }
    for (const army of goalStop) out.push({ kind: 'goal', army, node: null })
    if (scout !== '') out.push({ kind: 'scout', faction: me(), node: scout, hero: null })
    if (rite) out.push({ kind: 'rite', faction: me() })
    // 사건 카드의 답은 answers 의 'card:<계절>' 칸에 (참 = 첫째 · 거짓 = 둘째 · 'hush:<계절>' 도 참이면 셋째 침묵) — 초안 저장·계절 초기화를 청의 답과 함께 탄다
    for (const [ask, yes] of Object.entries(answers)) {
      if (ask === 'contest:archery') out.push({ kind: 'contest', faction: me(), id: 'archery', won: yes })
      else if (ask.startsWith('hush:')) continue
      else if (ask.startsWith('card:')) { if (ask === `card:${realm?.season ?? -1}`) out.push({ kind: 'card', faction: me(), pick: answers[`hush:${realm?.season ?? -1}`] === true ? 2 : yes ? 0 : 1 }) } else out.push({ kind: 'answer', ask, yes })
    }
    for (const node of guards) out.push({ kind: 'guard', faction: me(), node })
    for (const to of Object.keys(envoys).sort()) out.push(envoys[to]!)
    out.push(...plots)
    return out
  }

  /**
   * 고른 군량(더 챙길 계절 수) — 안 골랐으면 기본(rationReserve)을, 곡식이 대는 만큼까지. 옛 'full'·'light' 도 받는다
   */
  function rationExtraOf(r: Realm, a: Army, seasons: number, want: Ration | undefined): number {
    let n = rationExtra(want) ?? P.realm.rationReserve
    const grain = left().grain
    while (n > 0 && rationCost(r, a, seasons, n) > grain) n--
    return n
  }

  /** 승리 조건 넷이 얼마나 찼나 (0~1) — 우리 쪽 · 판의 길 판(pathsHtml)과 같은 셈 */
  function pathShares(r: Realm, f: string = me()): Array<[string, number]> {
    if (r.region === 'tutorial' || r.scenario !== undefined) return []
    const need = winNeed(r.region ?? 'byeonhan-mini')
    const held = Object.values(r.factions).filter((x) => r.nodes[x.capital]?.owner === f).length
    const pact = pactOf(r, f)
    const streak = r.suzerain?.[f]?.streak ?? 0
    const S = Math.max(1, P.realm.suzerainSeasons)
    const io = ironOf(r, f)
    const ri = riteOf(r, f)
    const cl = (x: number): number => Math.max(0, Math.min(1, x))
    return [
      ['정복', cl(held / Math.max(1, need))],
      // 맹주 — 손잡은 나라를 채우는 데 반, 맹약을 네 계절 버티는 데 반
      ['맹주', pact.score < pact.need || pact.vassals < P.realm.suzerainMinVassals ? cl(pact.score / Math.max(1, pact.need)) * 0.5 : 0.5 + cl(streak / S) * 0.5],
      ['철과 뱃길', io.gate ? cl(Math.min(io.score / Math.max(1, io.need), io.partners.length / Math.max(1, io.minPartners))) : 0],
      ['큰 제사', cl(Math.min(ri.chain / Math.max(1, ri.need), ri.hh / Math.max(1, ri.hhNeed)))],
    ]
  }
  /** 승리가 가깝다 — 넷 가운데 하나가 이번 계절에 문턱(pathAlertShare)을 넘으면 크게 한 번 (형 10-26: "승리 목표 달성의 80%가 되면 한번 알림") */
  function nearWinToast(prev: Realm, next: Realm): void {
    if (next.outcome != null) return
    const was = new Map(pathShares(prev))
    const T = P.realm.pathAlertShare
    const hit = pathShares(next).filter(([k, v]) => v >= T && v < 1 && (was.get(k) ?? 0) < T)
    if (hit.length === 0) return
    goToast(`<span class="gtk">승리가 가깝다</span>${hit.map(([k, v]) => `<b>${k}</b> ${Math.floor(v * 100)}%`).join(' · ')}: 이대로면 곧 이긴다`, 'big')
  }

  /** 잠깐 떴다 스스로 걷히는 한 줄 — 누르면 바로 닫힌다 (메모리 notices-must-dismiss · 걷힘은 CSS 애니메이션 끝에서 · 타이머 없음) */
  function goToast(html: string, cls = ''): void {
    root.querySelector('.gotoast')?.remove()
    const el = document.createElement('div')
    el.className = `gotoast${cls !== '' ? ` ${cls}` : ''}`
    el.innerHTML = html
    el.addEventListener('animationend', () => el.remove())
    el.addEventListener('click', () => el.remove())
    root.append(el)
  }

  function armyName(r: Realm, a: Army): string {
    const h = a.hero !== null ? r.heroes[a.hero] : undefined
    return h !== undefined && h.status === 'free' ? h.name : `별동대 ${headcount(forceOf(r, a))}`
  }

  /** 우리 고을 — 가장 최근에 차지한 것이 맨 위 (형 10-27: "내 마을 점점 많아지면 뭐가 뭔지 모르니까") · 처음부터 쥔 고을은 그 밑에 이름 순 */
  function myTowns(r: Realm): Array<Realm['nodes'][string]> {
    return sorted(Object.values(r.nodes)).filter((n) => n.owner === me()).sort((a, b) => (b.takenAt ?? -1) - (a.takenAt ?? -1))
  }

  function scoutable(r: Realm): string[] {
    const mine = Object.values(r.nodes).filter((n) => n.owner === me())
    return [...new Set(mine.flatMap((n) => neighbors(r, n.id)))].filter((id) => r.nodes[id]?.owner !== me()).sort()
  }

  // ───────── 위 상태 줄
  function topHtml(r: Realm): string {
    const season = seasonOf(r.season)
    const st = left() // 이번 계절 고른 것을 치르고 남는 몫
    const men = Object.values(r.armies).filter((a) => a.faction === me()).reduce((s, a) => s + headcount(forceOf(r, a)), 0)
    const nation = r.factions[me()]
    // 누르면 바로 뜨는 말 (tips.ts) — 폰엔 마우스를 올릴 일이 없다
    // 첫 화면으로 가는 길은 나라 탭 맨 밑 「첫 화면으로」 (형 10-24: "좌상단 홈 버튼은 없애도 될 듯 · 나라 탭에서 눌러서 갈 수 있게")
    // 계절 이름을 누르면 지난 기록 — 따로 있던 「지난 기록」 단추를 대신한다 (형 10-28: 그 자리만큼 목표 띠를 올려 지도를 넓게)
    return `<button class="tl" data-act="log-open" aria-label="지난 기록">${icon(SEASON_ICON[season], 'sic')}<b>${esc(seasonLabel(r.season))}</b><i class="tlx">📜</i></button>`
      + `<div class="tr">${(['grain', 'iron', 'salt', 'wood', 'horse'] as const).filter((g) => g === 'grain' || g === 'iron' || goodOf(st, g) > 0).map((g) => goodStat(r, g, goodOf(st, g))).join('')}`
      + `<span class="stat" data-tip="군사, 우리 군대를 다 합친 사람 수">${icon('unit-spear')}<b>${men}</b></span>`
      + `<button class="stat nat" data-act="tab" data-tab="nation">${bust(r.heroes[r.factions[me()]?.ruler ?? rulerId(me())], 'tface')}${emblem(me())}<b>${esc(nation?.name ?? '')}</b></button></div>`
  }

  /**
   * 위 띠의 물건 하나 — 누르면 어디에 쓰나, 길게 누르면 이번 계절 어디서 얼마나 들고 나나
   * (형: "소금은 어디다쓰는거지?" · "매턴 어느고을에서 뭐가 얼머나 자원이 생산되는지 어떻게알지?")
   */
  function goodStat(r: Realm, g: Good, have: number): string {
    const mine = sorted(Object.values(r.nodes)).filter((n) => n.owner === me())
    const season = seasonOf(r.season)
    const from = mine.map((n) => [n.name, goodOf(nodeYield(r, n.id, season), g)] as const).filter(([, v]) => v > 0)
    const sum = from.reduce((s, [, v]) => s + v, 0)
    const bits: string[] = []
    bits.push(from.length > 0 ? `이번 계절 +${sum} (${from.map(([nm, v]) => `${nm} ${v}`).join(' · ')})` : '이번 계절 나는 곳이 없다')
    if (g === 'grain') {
      const hv = mine.reduce((s, n) => s + nodeHarvest(r, n.id), 0)
      bits.push(`가을걷이 약 +${hv} (여름이 끝날 때)`)
      bits.push(`군량 −${upkeepOf(r, me(), season === 'winter')} (계절마다)`)
    }
    return `<span class="stat" data-g="${g}" data-tip="${esc(GOOD_NAME[g])}: ${esc(GOOD_USE[g])}" data-more="${esc(bits.join(' / '))}">${icon(GOOD_ICON[g])}<b>${Math.floor(have)}</b></span>`
  }

  /**
   * 위 띠의 수가 굴러 바뀐다 — 계절을 넘기면 600ms, 이번 계절 고르는 동안은 250ms · 곁에 +/− 가 떠올랐다 사라진다
   * (docs/realm/UX-JUICE.md 2-#2 · "작게 누르고 크게 돌려받는다"). 꾸밈이라 판과 상관없다
   */
  const lastTop = new Map<string, number>()
  let lastTopSeason = -1
  function rollTop(season: number): void {
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
    const turn = lastTopSeason !== -1 && season !== lastTopSeason
    const fresh = lastTopSeason === -1 || Math.abs(season - lastTopSeason) > 1
    lastTopSeason = season
    for (const el of root.querySelectorAll<HTMLElement>('.top .stat[data-g]')) {
      const g = el.dataset['g']!
      const b = el.querySelector('b')
      if (b === null) continue
      const to = Number(b.textContent)
      const from = lastTop.get(g)
      lastTop.set(g, to)
      if (from === undefined || from === to || fresh || still) continue
      const d = to - from
      const pop = document.createElement('i')
      pop.className = `dpop ${d > 0 ? 'up' : 'down'}`
      pop.textContent = `${d > 0 ? '+' : '−'}${Math.abs(d)}`
      el.appendChild(pop)
      pop.addEventListener('animationend', () => pop.remove())
      el.classList.remove('bump', 'dent')
      void el.offsetWidth
      el.classList.add(d > 0 ? 'bump' : 'dent')
      const dur = turn ? P.realm.uiRollMs : P.realm.uiRollPlanMs
      const t0 = performance.now()
      const step = (now: number): void => {
        const k = Math.min(1, (now - t0) / dur)
        const e = 1 - (1 - k) ** 3
        b.textContent = String(Math.round(from + d * e))
        if (k < 1 && b.isConnected) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    }
  }

  // ───────── 지도
  function mapPart(r: Realm): string {
    const marches: MapMarch[] = []
    for (const a of Object.values(r.armies)) {
      if (a.faction !== me()) continue
      if (a.march !== null) marches.push({ from: a.march.from, to: a.march.to, left: a.march.left, ambush: a.march.ambush })
      const c = pick[a.id]
      const ed = c !== undefined && a.march === null ? r.edges[c.edge] : undefined
      if (ed !== undefined) marches.push({ from: a.at, to: otherEnd(ed, a.at)!, left: null, ambush: c!.ambush })
      // 먼 갈 곳 — 거기까지의 길을 화살로 이어 (이번 계절 고른 첫 걸음은 위에서 그렸다 · 길 위의 군대는 닿는 고을부터)
      const g = goalOf(a)
      if (g !== undefined) {
        const start = a.march !== null ? a.march.to : ed !== undefined ? otherEnd(ed, a.at)! : a.at
        for (const [x, y] of goalRoute(r, me(), start, g)) marches.push({ from: x, to: y, left: null, ambush: false })
      }
    }
    // 우리를 지키러 오는 동맹 군대는 적이 아니다 — 초록 화살 「도우러」
    for (const a of seenMarches(r, me())) if (a.march !== null && a.lent?.to !== me()) marches.push({ from: a.march.from, to: a.march.to, left: a.march.left, foe: true })
    for (const a of lentToMe(r)) if (a.march !== null) marches.push({ from: a.march.from, to: a.march.to, left: a.march.left, ally: true })
    // 개척단 — 흙빛 점선 (이번 계절 고른 길은 남은 계절 없이)
    for (const p of partiesOf(r, me())) if (p.march !== null) marches.push({ from: p.march.from, to: p.march.to, left: realm!.parties?.[p.id]?.march != null ? p.march.left : null, people: true })
    const ps = partySel !== '' ? r.parties?.[partySel] : undefined
    // 척후를 보낸 고을은 고른 고을처럼 금빛 고리를 돌리지 않는다 — 작은 「척후」 표만 (형 10-27: "클릭하라고 지시하는 것 같다")
    const sel = ps !== undefined ? (ps.march?.from ?? ps.at) : sheet?.kind === 'node' ? sheet.id : ''
    // 지도에서 바로 움직인다 (형: "다른게임에서는 지도에서 바로 배치 조절하는거 같은데") — 말을 누르고, 밝아진 고을을 누른다
    // 길 위의 군대도 말을 둔다 — 길 가운데쯤에 (형: "내 군대 번예연이 군대가 지도에서 안보임")
    const tokens: MapToken[] = [...sorted(Object.values(r.armies)).filter((a) => a.faction === me()), ...lentToMe(r)].map((a) => {
      const hero = a.hero !== null ? r.heroes[a.hero] : undefined
      const file = hero !== undefined ? bustOf(hero.id) : undefined
      const kinds = (Object.entries(a.mix) as Array<[UnitKind, number]>).filter(([, v]) => v > 0).sort((x, y) => y[1] - x[1]).map(([k]) => k)
      const top = kinds[0] ?? 'spear'
      return {
        squad: squadOf(kinds),
        army: a.id, node: a.at, men: headcount(forceOf(r, a)), morale: a.morale, sel: armySel.includes(a.id), going: pick[a.id] !== undefined,
        img: file !== undefined ? `${ART}bust/${file}.jpg` : `${ART}icon/${UNIT_ICON[top]}.png`,
        ...(a.march !== null ? { march: { from: a.march.from, to: a.march.to, left: a.march.left } } : {}),
        ...(a.faction !== me() ? { ally: a.faction } : {}),
        // 이번 계절 시킨 일이 없는 우리 군대 — 「명령?」 (길 위 · 떠나기로 함 · 남이 빌려준 군대는 빼고)
        // 한 번 눌러 본 뒤로 영영 안 뜨던 것을 — 가끔 2초씩 떴다 사라지게 (형 10-29: "가끔 「명령?」 2초간 떴다 없어지게 하는 거 괜찮았는데 왜 안 뜨지?")
        ...(a.faction === me() && a.march === null && pick[a.id] === undefined ? { wait: true } : {}),
      }
    })
    // 보인 적의 군대 — 길 위에 그 나라 빛 테의 말로 (형 10-27: "대로로 오는 적군이나 기습이 예견된 적군은 텍스트 말고 동맹군 오듯이 유닛들이 맵에")
    // 몇 명인지는 모른다 — 「적」 · 몰래 오는 낌새면 어둡게
    const sneaky = new Set((report?.lines ?? []).flatMap((l) => (l.kind === 'sighted' && l.suspect === true ? [(l as { army: string }).army] : [])))
    for (const a of seenMarches(r, me())) {
      if (a.march === null || a.lent?.to === me()) continue
      tokens.push({ army: a.id, node: a.march.from, men: 0, sel: false, going: false, img: `${ART}icon/unit-spear.png`, foe: a.faction, squad: squadOf([]),
        ...(sneaky.has(a.id) ? { sneak: true } : {}), march: { from: a.march.from, to: a.march.to, left: a.march.left } })
    }
    // 개척단의 말 — 군대 말처럼 누르면 고르고 갈 곳이 빛난다 (지난 계절부터 길 위에 있으면 길 가운데)
    for (const p of partiesOf(r, me())) {
      const was = realm!.parties?.[p.id]?.march
      tokens.push({ army: p.id, node: p.march?.from ?? p.at, men: p.hh, sel: partySel === p.id, going: p.march !== null && was == null, img: `${ART}icon/unit-porters.png`, party: true,
        ...(was != null ? { march: { from: was.from, to: was.to, left: was.left } } : {}) })
    }
    const a0 = armySel.length > 0 ? r.armies[armySel[0]!] : undefined
    const a = a0?.faction === me() ? a0 : undefined
    // 다른 우리 군대가 언제 어디에 닿나 — 이미 가는 군대 · 이번 계절에 보낼 군대. 칠 곳 칩에 협공을 미리 (형: "같은 계절에 도착하게 맞춰서 … 합쳐져서 공격이 안오네??")
    const others = new Map<string, number[]>()
    for (const o of Object.values(r.armies)) {
      if (o.faction !== me() || armySel.includes(o.id)) continue
      const c = pick[o.id]
      const when = o.march !== null ? { to: o.march.to, k: o.march.left } : c !== undefined ? (() => { const mv = movesOf(r, me(), o).find((x) => x.edge.id === c.edge); return mv !== undefined ? { to: mv.to, k: mv.seasons } : null })() : null
      if (when !== null) others.set(when.to, [...(others.get(when.to) ?? []), when.k])
    }
    const pincerChip = (to: string, k: number, hostile: boolean): string => {
      const ks = others.get(to)
      if (!hostile || ks === undefined) return ''
      if (ks.includes(k)) return `<span class="tn pin">협공</span>`
      const d = Math.min(...ks.map((x) => Math.abs(x - k)))
      return `<span class="tn hard">${d}계절 어긋남</span>`
    }
    const targets: MapTarget[] = a === undefined || a.march !== null ? [] : movesOf(r, me(), a).map((m) => ({
      // 막힌 길도 갈 수는 있다 — 무엇을 잃는지 칩으로 미리 (형: "불가능하게 만들지 말고 패널티 · 사전에 안내")
      node: m.to, edge: m.edge.id, off: false, on: armySel.every((id) => pick[id]?.edge === m.edge.id),
      // 걸리는 계절은 늘 — 칠 곳에도 (형: "적을 치러갈때 그 마을까지 얼마나걸리는지 여전히 안보임")
      chip: (m.blocked !== null ? `<span class="tn hard">${esc(HARD_LINE[m.blocked])}</span>`
        : m.hostile ? `${m.win !== null ? fightFeel(m.win[0], m.win[1]) : unknownFeel()}${m.conceal === "good" ? `<span class="tn hide">숨기 좋은 길</span>` : m.bigArmy ? `<span class="tn big">무리가 커 들킨다</span>` : ""}` : '')
        + `<span class="tn when">${m.seasons}계절</span>${pincerChip(m.to, m.seasons, m.hostile)}`,
    }))
    // 먼 곳 — 옆 고을이 아니어도 누르면 계절마다 한 걸음씩 간다 (우리·친한 나라·빈땅을 지나서) (형 10-25: "매번 옆 고을을 선택해 줘야 하는 게 귀찮어")
    if (a !== undefined && a.march === null && armySel.length === 1) {
      const near = new Set(targets.map((t) => t.node))
      for (const [to, x] of goalReach(r, me(), a.at)) {
        if (near.has(to) || x.hops < 2) continue
        const n = r.nodes[to]!
        const hostile = n.owner !== null && n.owner !== me() && n.kind !== 'sodo'
        // 먼 곳은 칩을 달지 않는다 — 판 가득 「몇 계절 · 멀리」가 붙어 어지럽고 버벅였다. 고른 곳 하나만 (형 10-26: "가까운 것들만 보여주고 나머지는 멀리 보내면 알아서 계산된 대로만 이동하게")
        const on = goalOf(a) === to
        targets.push({ node: to, edge: x.edge, goal: to, off: false, on,
          chip: on ? `${hostile ? `<span class="tn hard">적 고을</span>` : ''}<span class="tn when">${x.seasons}계절</span><span class="tn far">멀리</span>` : '' })
      }
    }
    // 머물기도 지도에서 — 제 고을을 누르면 떠나기를 거둔다 (형: "머물기는 지도에서 선택을 못하고")
    if (a !== undefined && a.march === null) targets.push({ node: a.at, edge: '', off: false, on: armySel.every((id) => pick[id] === undefined), chip: `<span class="tn stay">머문다</span>` })
    if (partySel !== '' && armySel.length === 0) targets.push(...partyTargets(r, partySel))
    const fr = fresh
    if (!showReport) fresh = new Set() // 드러나는 것은 한 번만 — 계절 소식을 닫고 지도를 볼 때
    // 군대를 고르지 않았을 때만 — 개척할 수 있는 빈땅에 「＋마을」
    const going = new Set(partiesOf(r, me()).flatMap((p) => (p.march !== null && foundable(r, me(), p.march.to) ? [p.march.to] : [])))
    const stl = armySel.length === 0 && partySel === '' && r.region !== 'tutorial' ? new Set(foundLands(r).filter((to) => !(r.nodes[to]?.owner === me() && (r.nodes[to]?.hh ?? 0) > 0))) : new Set<string>()
    // 지난 계절 싸움으로 주인이 바뀐 고을 (보고에 남은 것) — 지도에 불과 연기
    const burn = new Set<string>()
    // 우리가 빼앗았으면 불 대신 우리 깃발 · 지켜 냈으면 방패 (형 10-23: "졌을 때는 불나는 게 맞는데 이겼을 땐 어떤 연출")
    const taken = new Set<string>()
    const held = new Set<string>()
    for (const l of report?.lines ?? []) {
      if (l.kind !== 'battle' || l.field === true) continue
      const atkWon = l.outcome === 'win' || l.outcome === 'rout'
      if (atkWon && r.nodes[l.node]?.owner === l.atkFaction) (l.atkFaction === me() ? taken : burn).add(l.node)
      else if (!atkWon && l.defender === me() && r.nodes[l.node]?.owner === me()) held.add(l.node)
    }
    if (armySel.length === 0 && partySel === '') for (const to of going) stl.add(to)
    return mapHtml(r, me(), ART, marches, sel, focus, tokens, targets, fr, stl, burn, going, taken, held, scout)
  }

  /**
   * 고른 개척단이 갈 곳 — 빈땅은 「새 마을」, 우리 고을은 「지나간다」, 칩에 걸리는 계절. 지난 계절부터 길 위에 있는 개척단은 못 돌린다.
   * `r` 은 이번 계절 고른 것이 든 판
   */
  function partyTargets(r: Realm, id: string): MapTarget[] {
    const p = r.parties?.[id]
    if (p === undefined || realm!.parties?.[id]?.march != null) return []
    return partyMoves(r, me(), p.march?.from ?? p.at).map((m) => ({
      node: m.to, edge: m.edge, off: false, on: p.march?.edge === m.edge, act: 'ptgo',
      chip: (m.found ? `<span class="tn newv">새 마을</span>` : `<span class="tn share">우리 고을</span>`) + `<span class="tn when">${m.seasons}계절</span>`,
    }))
  }

  /** 개척단이 마을을 열 수 있는 빈땅 — 우리 고을과 길로 맞닿은 곳 (지도의 「＋마을」 · 백성 판의 땅 목록) */
  function foundLands(r: Realm): string[] {
    const out = new Set<string>()
    for (const n of Object.values(r.nodes)) {
      if (n.owner !== me() || n.kind === 'wild' || n.kind === 'sodo') continue
      for (const m of partyMoves(r, me(), n.id)) if (m.found) out.add(m.to)
    }
    return [...out].sort()
  }

  /** 추천할 빈땅 — 임자 없고, 가는 개척단이 없고, 맞닿은 우리 고을에서 지금 꾸릴 수 있는 첫 곳 (이번 계절 이미 꾸렸으면 없음) */
  function settleRec(r: Realm): string | null {
    if (settles.some((o) => o.kind === 'party')) return null
    const going = new Set(partiesOf(r, me()).flatMap((p) => (p.march !== null ? [p.march.to] : [])))
    return foundLands(r).find((to) => r.nodes[to]?.owner === null && !going.has(to) && partySource(r, to) !== null) ?? null
  }

  /** 빈땅에 개척단을 보낼 고을 — 맞닿은 우리 고을 가운데 개척단을 꾸릴 수 있고 이번 계절 아직 안 꾸린 곳, 도읍이 아닌 가장 붐비는 곳 먼저 */
  function partySource(r: Realm, to: string): { from: string; edge: string } | null {
    const caps = new Set(Object.values(r.factions).map((f) => f.capital))
    const c: Array<{ from: string; edge: string }> = []
    for (const n of Object.values(r.nodes)) {
      if (n.owner !== me() || n.kind === 'wild' || settles.some((o) => o.kind === 'party' && o.node === n.id) || partySize(r, me(), n.id) <= 0) continue
      const m = partyMoves(r, me(), n.id).find((x) => x.to === to && x.found)
      if (m !== undefined) c.push({ from: n.id, edge: m.edge })
    }
    c.sort((a, b) => Number(caps.has(a.from)) - Number(caps.has(b.from)) || crowdOf(r.nodes[b.from]!) - crowdOf(r.nodes[a.from]!) || (a.from < b.from ? -1 : 1))
    return c[0] ?? null
  }

  /** 개척단을 못 꾸리는 까닭 한 줄 */
  function partyWhy(r: Realm, node: string): string {
    if (partiesOf(r, me()).length >= P.realm.partyMax) return `개척단은 한꺼번에 ${P.realm.partyMax}까지 둔다`
    const n = r.nodes[node]!
    if (Math.floor(n.hh * P.realm.partyShare) < P.realm.partyMin) return '백성이 아직 적다'
    return '곡식이나 나무가 모자란다'
  }

  /** 지도에서 켜고 끄는 겹 (형: "좌하단에는 확대축소말고 뭔가 보이기 안보이기 토글 필요할듯") — 끈 것은 .ap.hide-<id> */
  function layersHtml(): string {
    let h = `<div class="lyh">지도에 보이기</div>`
    for (const l of LAYERS) {
      const on = !hiddenLayers.has(l.id)
      h += `<button class="lyr${on ? ' on' : ''}" data-act="layer" data-v="${l.id}"><i>${on ? '●' : '○'}</i><b>${l.name}</b><span>${l.hint}</span></button>`
    }
    return h
  }

  function toggleLayer(id: LayerId): void {
    if (hiddenLayers.has(id)) hiddenLayers.delete(id)
    else hiddenLayers.add(id)
    applyLayers()
    try { localStorage.setItem(LAYER_KEY, JSON.stringify([...hiddenLayers])) } catch { /* 저장 못 하는 곳 */ }
  }

  function applyLayers(): void {
    for (const l of LAYERS) root.classList.toggle(`hide-${l.id}`, hiddenLayers.has(l.id))
  }

  /**
   * 길 보기 — 선의 생김새가 무슨 길이고 무엇이 다른지 (형: "경로에 직선이랑 점선 이런건 뭔차이임").
   * 길의 선은 지도의 것(mapview.roadSvg) 그대로 그려 보인다.
   */
  function roadKeyHtml(): string {
    let h = `<button data-act="roadkey" aria-label="길 보기">${roadOpen ? '✕' : '?'}</button>`
    if (!roadOpen) return h
    const road = (k: EdgeKind): string => `<svg width="54" height="16" viewBox="0 0 54 16">${roadSvg('M7 8H47', k, 0.85)}</svg>`
    const line = (attrs: string): string => `<svg width="54" height="14" viewBox="0 0 54 14"><path d="M4 7H50" fill="none" ${attrs.replace(/stroke-width="(\d+)"/, (_, w: string) => `stroke-width="${Math.max(3, Number(w) * 0.7)}"`)}/></svg>`
    const ROAD: ReadonlyArray<[EdgeKind, string]> = [
      ['field', '한 계절 · 빠르고 트였다 · 숨기 어렵다'],
      ['pass', '두 계절 · 겨울엔 눈이 덮는다 · 창을 휘두르기 좁다'],
      ['forest', '숨기 좋다 · 숲에선 활을 못 쏜다'],
      ['reeds', '숨기 좋다 · 겨울엔 더 좋다'],
      ['ford', '강을 건넌다 · 여름 장마엔 물이 붇는다'],
      ['sea', '배로 건너는 바닷길'],
      ['mudflat', '두 계절 · 발이 빠진다'],
    ]
    h += `<div class="rk"><h5>길</h5>${ROAD.map(([k, t]) => `<div>${road(k)}<b>${EDGE_NAME[k]}</b><span>${t}</span></div>`).join('')}`
    // 길 기호 — 계절·닿는 고을에 따라 바뀐다 (mapview.routeSign)
    h += `<h5>길 기호 · 계절따라 바뀐다</h5>`
    h += (Object.keys(ROUTE_SIGN_NAME) as RouteSign[]).map((s) => `<div><img class="rki" src="${ART}icon/route-${s}.png" alt=""><span>${esc(ROUTE_SIGN_NAME[s])}</span></div>`).join('')
    h += `<h5>특산 · 고을 위 둥근 표</h5><div class="rkg">${(['iron', 'salt', 'wood', 'horse'] as const).map((g) => `<span>${icon(GOOD_ICON[g])}${GOOD_NAME[g]}</span>`).join('')}</div>`
    h += `<div><span>흐린 표는 아무도 안 사는 땅, 일구면 난다</span></div>`
    h += `<h5>화살</h5>`
    h += `<div>${line('stroke="#c8402a" stroke-width="7"')}<span>이번 계절 떠나기로 고른 길</span></div>`
    h += `<div>${line('stroke="#c8402a" stroke-width="7" stroke-dasharray="10 6"')}<span>이미 가는 중 · 남은 계절이 적힌다</span></div>`
    h += `<div>${line('stroke="#3a2a5a" stroke-width="8" stroke-dasharray="2 10" stroke-linecap="round"')}<span>몰래 가는 기습 길</span></div>`
    h += `<div>${line('stroke="#3a2a5a" stroke-width="7" stroke-dasharray="10 6"')}<span>우리 쪽으로 오는 적</span></div>`
    h += `<h5>땅 사이 금</h5><div>${line('stroke="#2a1d10" stroke-width="3"')}<span>나라와 나라의 경계</span></div>`
    h += `<div>${line('stroke="#6b4a2a" stroke-width="3" stroke-dasharray="3 4"')}<span>같은 나라 고을끼리의 금</span></div></div>`
    return h
  }

  /** 배우는 판의 띠 — 지금 할 일 하나 · 눌러야 할 곳이 빛난다 (tutorial.ts) */
  function paintTut(r: Realm): void {
    const band = $('.tutband')
    if (realm === null || realm.region !== 'tutorial' || front !== null || prologue !== null || (realm.outcome && !realm.endless)) {
      band.innerHTML = ''
      tutSheet.textContent = ''
      spot.set(undefined, null)
      return
    }
    loadTut()
    if (tut.off) {
      band.innerHTML = ''
      tutSheet.textContent = ''
      spot.set(undefined, null)
      return
    }
    const ctx = { r, orders: ordersNow(), report, acts: tut.acts }
    const i = tutAt(tut.i, ctx)
    if (i !== tut.i) {
      tut.i = i
      saveTut()
      if (i >= TUT_STEPS.length) markTutorialOver('done')
    }
    if (i !== tutStepAt[0]) {
      // 새 단계 — 배우는 일의 이름을 화면 가운데 크게 (스스로 걷히고, 누르기는 막지 않는다 · 메모리: 알림은 반드시 걷힌다)
      if (tutStepAt[0] !== -1 || i === 0) {
        const st = TUT_STEPS[i]
        root.querySelector('.tutcap')?.remove()
        if (st !== undefined) {
          root.insertAdjacentHTML('beforeend', `<div class="tutcap"><b>${esc(st.name)}</b><span>${esc(st.what)}</span></div>`)
          const el = root.querySelector('.tutcap')
          el?.addEventListener('animationend', () => el.remove())
          window.setTimeout(() => el?.remove(), TUT_CAP_MAX_MS)
        }
      }
      tutStepAt = [i, performance.now()]
    }
    band.innerHTML = tutBandHtml(i, esc, performance.now() - tutStepAt[1] > P.realm.tutStuckMs)
    tutSheet.textContent = tutStyle(TUT_STEPS[i])
    spot.set(TUT_STEPS[i], ctx)
  }

  /**
   * 지도에서 고른 말 — 아래에 띠로. 같은 고을에서 둘 넘게 고르면 합치기 단추, 길 위의 군대면 어디로 가는 중인지.
   */
  /** 회군 단추 — 길 위의 우리 군대 (형: "가는도중에 있는 군대는 회군할수 있게 해야하는거아님?"). 고른 판(plan)에는 이미 돌아선 길이 보인다 */
  /** 서 있는 고을이 싸울 땅이 됐다(동맹을 깬 뒤 등) — 그 자리에서 친다 (형 10-24) */
  function assaultBtn(r: Realm, a: Army): string {
    const node = r.nodes[a.at]
    if (a.lent !== undefined || a.march !== null || node === undefined || node.owner === null || node.owner === me() || node.kind === 'sodo' || friendly(r, me(), node.owner)) return ''
    const on = armyOrders.some((o) => o.kind === 'assault' && o.army === a.id)
    return `<div class="btns"><button class="btn ${on ? 'on' : 'pri'}" data-act="assault" data-army="${a.id}">${on ? `이번 계절 ${esc(josa(node.name, '을', '를'))} 친다 · 누르면 거둔다` : `⚔ 서 있는 ${esc(josa(node.name, '을', '를'))} 친다`}</button></div>`
  }

  function turnBackBtn(a: Army): string {
    if (a.lent !== undefined) return ''
    const on = armyOrders.some((o) => o.kind === 'turnBack' && o.army === a.id)
    return `<div class="btns"><button class="btn ${on ? 'on' : 'ghost'} sm" data-act="turnback" data-army="${a.id}">${on ? '회군한다 · 누르면 거둔다' : '회군: 떠난 고을로 돌린다'}</button></div>`
  }

  /** 개척단의 아래 띠 — 어디서 왔고 몇 가구인지 · 갈 곳 / 가는 중 · 이번 계절 꾸린 것이면 거두기 */
  function partyBarHtml(r: Realm): string {
    const p = r.parties?.[partySel]
    if (p === undefined) return ''
    const close = `<button class="sbx" data-act="pp-close" aria-label="고르기 풀기">✕</button>`
    const was = realm!.parties?.[p.id]?.march
    let h = `<div class="sbf">${icon('unit-porters', 'sbface ppface')}</div><div class="sbt"><b>${esc(r.nodes[p.home]?.name ?? '')} 개척단 · 백성 ${p.hh}가구</b>`
    if (was != null) h += `<span>${esc(josa(r.nodes[was.to]?.name ?? '', '으로', '로'))} 가는 중 · ${esc(arriveWhen(realm!.season, was.left))}</span>`
    else if (p.march !== null) h += `<span>→ ${esc(r.nodes[p.march.to]?.name ?? '')} · ${foundable(r, me(), p.march.to) ? '닿으면 새 마을' : '지나간다'} · ${esc(arriveWhen(realm!.season, p.march.left))}</span>`
    else h += `<span>${partyTargets(r, p.id).length > 0 ? '보낼 곳을 선택한다' : '지금 갈 수 있는 길이 없다'}</span>`
    h += `</div>`
    if (joinHere(p.at).some((x) => x.id === p.id)) h += `<button class="btn pri home sm" data-act="ptjoin" data-army="${p.id}">여기 자리 잡기</button>`
    if (formOf(p.id) !== undefined) h += `<button class="btn ghost sm" data-act="party-undo" data-node="${p.home}">꾸리기 거두기</button>`
    return h + close
  }

  function selBarHtml(r: Realm): string {
    if (partySel !== '' && armySel.length === 0) return partyBarHtml(r)
    const sel = armySel.map((id) => r.armies[id]).filter((a): a is Army => a !== undefined)
    if (sel.length === 0) return ''
    const first = sel[0]!
    // 우리 군대 하나가 서 있으면 장수 얼굴을 눌러 이끌 장수를 고르거나 바꾼다 (형 10-26)
    const swap = sel.length === 1 && first.faction === me() && first.march === null
    const faces = sel.map((a) => bust(a.hero !== null ? r.heroes[a.hero] : undefined, 'sbface')).join('')
    let h = swap
      ? `<button class="sbf sbfb${leadPop === first.id ? ' on' : ''}" data-act="ldpop" data-army="${first.id}" aria-label="이끌 장수 고르기">${faces}<i class="sbsw">⇄</i></button><div class="sbt">`
      : `<div class="sbf">${faces}</div><div class="sbt">`
    if (first.faction !== me()) {
      h += `<b>${esc(r.factions[first.faction]?.name ?? '')} 군대 · ${headcount(forceOf(r, first))}명</b><span>${esc(lentLine(r, first))}</span>`
    } else if (first.march !== null) {
      h += `<b>${esc(armyName(r, first))}</b><span>${esc(josa(r.nodes[first.march.to]?.name ?? '', '으로', '로'))} 가는 중 · ${esc(arriveWhen(r.season, first.march.left))}</span>${turnBackBtn(first)}`
    } else if (sel.length === 1) {
      const more = Object.values(r.armies).filter((x) => x.faction === me() && x.id !== first.id && x.at === first.at && x.march === null).length
      h += `<b>${esc(armyName(r, first))} · ${headcount(forceOf(r, first))}명 ${guideBtn('move')}</b><span>군사를 보낼 곳을 선택한다${more > 0 ? ' · 옆 말도 누르면 함께' : ''}</span>`
    } else {
      const men = sel.reduce((s, a) => s + headcount(forceOf(r, a)), 0)
      // 이번 계절 장수 명령을 넣은 모습으로 센다 — 장수를 빼낸 군대는 장수 없는 군대 (형 10-26: "한 장수를 빼고 … 합치기가 안 됨")
      const pl = plan()
      const heroes = sel.filter((a) => (pl.armies[a.id]?.hero ?? null) !== null).length
      h += `<b>${sel.length}군 · ${men}명</b><span>갈 곳을 누르면 함께 간다</span>`
      h += `</div><button class="btn pri sm" data-act="selmerge" ${heroes > 1 ? 'disabled' : ''}>합치기</button>`
      if (heroes > 1) h += `<span class="sbwhy">장수 둘은 한 군대를 함께 못 이끈다</span>`
      return h + `<button class="sbx" data-act="selclose" aria-label="고르기 풀기">✕</button>`
    }
    return h + `</div><button class="sbx" data-act="selclose" aria-label="고르기 풀기">✕</button>` + (swap && leadPop === first.id ? leadPickHtml(r, first) : '')
  }


  /**
   * 출정 전 군막 — 이번 계절 적 고을로 드는 우리 군대 가운데 아직 길을 장수와 정하지 않은 가장 큰 군대 하나.
   * 지도에서 바로 보냈든 멀리 걸어 둔 목표의 마지막 걸음이든 같다 (형 10-29: "주몽판 다 차지할 때까지 군사회의 한 번도 안 했다")
   */
  function councilDue(r: Realm): { army: string; edge: string; goal?: string } | null {
    const ours = Object.values(r.armies).filter((a) => a.faction === me() && a.march === null).sort((x, y) => headcount(forceOf(r, y)) - headcount(forceOf(r, x)) || (x.id < y.id ? -1 : 1))
    for (const a of ours) {
      const c = pick[a.id]
      if (councilDone.get(a.id) === r.season) continue
      if (c !== undefined && (c.adviser !== undefined || (c.approach !== undefined && c.approach !== 'road'))) continue
      let edge = c?.edge ?? ''
      const goal = goalOf(a)
      if (c === undefined && goal !== undefined) edge = goalReach(r, me(), a.at).get(goal)?.edge ?? ''
      if (edge === '') continue
      const m = movesOf(r, me(), a).find((x) => x.edge.id === edge)
      if (m === undefined || !m.hostile) continue
      // 뜻이 갈리는 안건이 있을 때만 연다 — 군량만 갈리면 저절로 열지 않는다 (위원회: 판돈이 클 때만 · 형 10-29: 안건 여럿)
      if (!agendasFor(r, a, a, m, c?.ration).some((x) => x.id !== 'ration')) continue
      return { army: a.id, edge, ...(goal !== undefined ? { goal } : {}) }
    }
    return null
  }

  /**
   * 전략 회의 화면 — 화면 가득. 누가 가나 · 장수 · 장수들의 안(길) · 군량과 국고 · 함께 치는 군대. 아래 붙박이 띠에 출정 (메모리 confirm-bar-bottom).
   * paint 때마다 다시 그린다 (안의 단추들이 sortieD 를 바꾸고 paint 를 부른다)
   */
  function stratPaint(): void {
    let ov = root.querySelector<HTMLElement>('.stov')
    const r = realm !== null ? plan() : null
    const a = stratOpen !== null && r !== null ? r.armies[stratOpen.army] : undefined
    const ed = a !== undefined && sortieD.edge !== null ? r!.edges[sortieD.edge] : undefined
    if (a === undefined || ed === undefined || r === null || a.march !== null) { ov?.remove(); if (stratOpen !== null && (a === undefined || a.march !== null)) stratOpen = null; return }
    if (ov === null) {
      root.insertAdjacentHTML('beforeend', `<div class="stov"></div>`)
      ov = root.querySelector<HTMLElement>('.stov')!
    }
    const to = r.nodes[otherEnd(ed, a.at)!]
    const probe = sortieProbe(a)
    const m = movesOf(r, me(), probe).find((x) => x.edge.id === ed.id)
    const keep = ov.querySelector<HTMLElement>('.stbody')?.scrollTop ?? 0
    // 사건 카드처럼 — 회의 그림을 깔고 안건 하나씩: 장수가 한 사람씩 아뢴다(누르면 다음) → 물음 하나와 큰 결정 카드 → 다음 안건 → 정리와 「결정」 (형 10-29)
    const st = stratOpen!
    const ags = m !== undefined && m.hostile ? agendasFor(r, a, probe, m, sortieD.ration) : []
    const step = Math.min(st.step ?? 0, ags.length)
    const on = step < ags.length
    const man = st.man === true || ags.length === 0
    const head = `<div class="sthd"><h2>전략 회의${on ? ` <small>안건 ${step + 1} / ${ags.length}</small>` : ''}</h2><p>${esc(josa(armyName(r, a), '이', '가'))} <b>${esc(josa(to?.name ?? '', '을', '를'))}</b> 치러 간다${m !== undefined ? ` · ${m.seasons}계절 · ${m.win !== null ? fightFeel(m.win[0], m.win[1]) : unknownFeel()}` : ''}</p>`
      + (on ? `<button class="stx" data-act="strat-x"${st.next ? ' data-v="keep"' : ''} aria-label="${st.next ? '그대로 간다' : '그만둔다'}">✕</button>` : '') + `</div>`
    const inner = on && m !== undefined ? agendaHtml(r, a, probe, m, ags[step]!, st.beat ?? 0)
      : `<div class="stbody">${note !== '' ? `<div class="banner bad">${tx(note)}</div>` : ''}${summaryHtml(ags)}`
        + (ags.length > 0 ? `<button class="stman${man ? ' on' : ''}" data-act="st-man"><span>직접 정한다. 군사 · 길 · 군량</span><i>${man ? '▴' : '▾'}</i></button>` : '')
        + `${man ? sortiePanel(r, a, 'strat') : ''}</div>${sortieBar(r, a)}`
    ov.innerHTML = `<div class="stbox${ags.length > 0 ? ' cnx' : ''}" style="--bg:url('${ART}event/${COUNCIL_ART}.jpg')">${head}${inner}</div>`
    const body = ov.querySelector<HTMLElement>('.stbody')
    if (body !== null) body.scrollTop = keep
  }

  /** 출정을 정했다 — 전략 회의를 닫고, 「다음 계절」 앞에서 열었으면 이어서 넘긴다. 넘겼으면 true */
  function stratDone(): boolean {
    const st = stratOpen
    stratOpen = null
    if (st !== null && realm !== null) { councilDone.set(st.army, realm.season); councilAt = realm.season }
    if (st === null || !st.next) return false
    paint()
    root.querySelector<HTMLElement>('[data-act="next"]')?.click()
    return true
  }

  /** 이 출정의 안건들 (council-agenda.ts) — a 는 군대 전부, probe 는 출정할 무리(판세·길은 그 힘으로) */
  function agendasFor(r: Realm, a: Army, probe: Army, m: Move, ration: Ration | undefined): Agenda[] {
    const pk = pick[a.id]
    const had = pk !== undefined && pk.edge === m.edge.id ? rationCost(r, probe, m.seasons, rationExtraOf(r, probe, m.seasons, pk.ration)) : 0
    return councilAgendas(r, me(), a, m, approachMoves(r, me(), probe, m), {
      canLead: (id) => leadCands(r, a).some((x) => x.id === id),
      rationNow: rationExtraOf(r, probe, m.seasons, ration),
      rationCost: (e) => rationCost(r, probe, m.seasons, e),
      grain: left().grain + had,
    })
  }

  /** 장수의 말을 따른다 — 출정 판에 바로 건다 (군사 몇 할 · 길과 이끌 이 · 군량 · 기다림). 「결정」 한 번에 모두 이루어진다 */
  function applyVoice(a: Army, v: Voice): void {
    const o = v.opt
    if (o.k === 'take') {
      sortieD.take = {}
      for (const [k, n] of Object.entries(a.mix) as Array<[UnitKind, number]>) sortieD.take[k] = o.share >= 1 ? n : Math.round(n * o.share)
      sortieD.hero = true // 장수가 데려가는 무리를 이끈다 — 남는 몫이 지킨다
    } else if (o.k === 'route') {
      sortieD.approach = o.ap
      if (v.hero !== null) sortieD.adviser = v.hero.id
      else delete sortieD.adviser
      if (o.lead !== undefined) sortieD.lead = o.lead
      else delete sortieD.lead
    } else if (o.k === 'ration') sortieD.ration = o.extra
    else sortieD.wait = o.k === 'wait'
  }

  /**
   * 전략 회의의 안건 한 장 — 말하는 장수가 하나씩(크게 얼굴 · 자막처럼 말 · 누르면 다음) · 다 말하면 물음 하나와 큰 결정 카드.
   * 군주의 뜻(얼굴 없는 말)은 아뢰지 않고 카드로만 · 카드의 얼굴은 그 말을 한 장수(군주의 뜻이면 군주)
   */
  function agendaHtml(r: Realm, a: Army, probe: Army, m: Move, ag: Agenda, beat: number): string {
    const says = ag.voices.filter((v) => v.hero !== null)
    if (beat < says.length) {
      const v = says[beat]!
      return `<div class="cnstage" data-act="cn-next"><h3 class="cnt">${esc(ag.title)}</h3><div class="cnspk">${bust(v.hero!, 'cnbig')}<b>${nameHtml(v.hero!.name)}</b></div>`
        + `<p class="cnsub" aria-live="polite">${esc(v.line)}</p><div class="cnav"><small>${beat + 1}/${says.length} · 누르면 다음 ›</small><button class="cskip" data-act="cn-skip">건너뛰기 »</button></div></div>`
    }
    const ruler = r.factions[me()]?.ruler
    const rh = ruler !== undefined ? r.heroes[ruler] : undefined
    let h = `<div class="cnq"><p class="cnask">${esc(ag.title)}</p><div class="cnopts${ag.voices.length > 2 ? ' n3' : ''}">`
    for (const v of ag.voices) {
      const face = v.hero !== null ? bust(v.hero, 'cof') : rh !== undefined ? bust(rh, 'cof') : ''
      const on = sortieD.chose?.[ag.id] === v.label
      h += `<button class="cnopt${on ? ' on' : ''}" data-act="cn-pick" data-ag="${ag.id}" data-l="${esc(v.label)}">${face}<span class="cot"><small>${v.hero !== null ? `${esc(v.hero.name)}의 말` : '내 뜻'}</small><b>${esc(v.label)}</b><span>${esc(voiceDoes(r, a, probe, m, v))}</span></span></button>`
    }
    return h + `</div><button class="cnre" data-act="cn-replay">다시 듣는다</button></div>`
  }

  /** 그 말을 따르면 무엇이 되나 — 결정 카드의 아랫줄 */
  function voiceDoes(r: Realm, a: Army, probe: Army, m: Move, v: Voice): string {
    const o = v.opt
    if (o.k === 'take') {
      const total = headcount(forceOf(r, a))
      if (o.share >= 1) return `${total.toLocaleString('ko-KR')}명 모두 출정 · ${josa(r.nodes[a.at]?.name ?? '', '이', '가')} 빈다`
      const go = takeCount(a, o.share)
      return `${go.toLocaleString('ko-KR')}명 출정 · ${(total - go).toLocaleString('ko-KR')}명 남아 지킨다`
    }
    if (o.k === 'route') {
      const lead = o.lead !== undefined ? r.heroes[o.lead] : undefined
      return `${APPROACH_NAME[o.ap]}${lead !== undefined ? ` · ${josa(lead.name, '이', '가')} 이끈다` : ''}`
    }
    if (o.k === 'ration') return `군량 ${m.seasons + o.extra}계절치 · 곡식 ${rationCost(r, probe, m.seasons, o.extra).toLocaleString('ko-KR')}`
    return o.k === 'wait' ? '이번 계절은 떠나지 않고 성을 지킨다' : '이번 계절에 떠난다'
  }

  /** 회의를 다 했다 — 안건마다 고른 것 (누르면 그 안건으로 돌아가 고친다) */
  function summaryHtml(ags: readonly Agenda[]): string {
    if (ags.length === 0) return `<p class="cnnone">장수들의 뜻이 갈리지 않습니다. 아래에서 직접 정합니다</p>`
    let h = `<div class="cnsum"><h3>회의에서 정한 것</h3>`
    ags.forEach((ag, i) => {
      const c = sortieD.chose?.[ag.id]
      const off = sortieD.wait === true && ag.id !== 'wait'
      h += `<button class="cnsr${off ? ' off' : ''}" data-act="cn-goto" data-i="${i}"><span>${esc(ag.title)}</span><b>${esc(off ? '-' : (c ?? '정하지 않았다'))}</b><i>고친다 ›</i></button>`
    })
    return h + `</div>`
  }

  /** 아래 띠의 「누가 이끄나」 — 지금 장수(빛남) · 이 고을에서 이끌 수 있는 장수(무예·통솔) · 장수 없이 */
  function leadPickHtml(r: Realm, a: Army): string {
    const stat = CMD_JOBS.find((j) => j.id === 'lead')!.stat
    const st = (x: Hero): string => stat.map((k) => `<i>${STAT_NAME[k]} ${x[k]}</i>`).join('')
    const cur = a.hero !== null ? r.heroes[a.hero] : undefined
    const cands = leadCands(r, a)
    let h = `<div class="ldpk"><b>누가 이끄나</b>`
    if (cur === undefined && cands.length === 0) return h + `<p class="mute">이 고을에 맡길 장수가 없다</p></div>`
    h += `<div class="cmdp">`
    if (cur !== undefined) h += `<button class="on" data-act="ldpop" data-army="${a.id}">${bust(cur, 'face')}<b>${nameHtml(cur.name)}</b><small><i>이끄는 중</i>${st(cur)}</small></button>`
    for (const x of cands) {
      const ruler = isRuler(r, x.id)
      h += `<button data-act="ldpick" data-army="${a.id}" data-id="${x.id}"${ruler ? ` data-tip="${RULER_LEAD_TIP}"` : ''}>${bust(x, 'face')}<b>${nameHtml(x.name)}</b><small>${ruler ? '<i>친히 이끈다</i>' : ''}${st(x)}</small></button>`
    }
    h += `</div>`
    if (cands.length === 0) h += `<p class="mute">이 고을에 바꿀 장수가 없다</p>`
    if (cur !== undefined) h += `<button class="btn ghost sm" data-act="ldpick" data-army="${a.id}" data-id="">장수 없이</button>`
    return h + `</div>`
  }

  /** 동맹이 빌려준, 우리를 지키는 군대 (diplomacy troops) */
  function lentToMe(r: Realm): Army[] {
    return sorted(Object.values(r.armies)).filter((a) => a.faction !== me() && a.lent?.to === me())
  }

  /** 빌린 군대가 어디를 언제 지키나 — 지도 띠 · 고을 판 */
  function lentLine(r: Realm, a: Army): string {
    const l = a.lent!
    const place = r.nodes[l.node]?.name ?? ''
    const till = `${seasonLabel(l.until)}까지 머문다`
    const eta = lentEta(r, a.id)
    if (eta === 0) return `${josa(place, '을', '를')} 지키는 중 · ${till}`
    if (eta === null) return `${josa(place, '으로', '로')} 가는 길이 막혔다 · ${till}`
    return `${josa(place, '을', '를')} 지키러 오는 중 · ${arriveWhen(r.season, eta)} · ${till}`
  }

  /** 지도 유닛의 병사 셋 — 가장 많은 병종 둘, 셋째는 둘째 병종(없으면 첫째) · 수군은 땅에선 걷는 그림 · 모르는 군대는 창병 */
  function squadOf(kinds: readonly UnitKind[]): Array<{ src: string; ar: number; r?: number }> {
    const anim = (k: UnitKind | undefined): string => (k === undefined ? 'spear' : k === 'boat' ? 'marine' : k)
    const a = anim(kinds[0])
    const b = anim(kinds[1] ?? kinds[0])
    // 새 20컷 띠가 있으면 그것 (art.ts SOL_ANIM2) — 병사 칸은 옛 비, 안의 그림만 넓다
    return [a, b === a ? a : b, a].map((k) => {
      const ar = SOL_ANIM_AR[k] ?? 1
      const a2 = SOL_ANIM2[k]
      return a2 !== undefined ? { src: `${ART}anim2/${k}.png`, ar, r: a2 / ar } : { src: `${ART}anim/${k}.png`, ar }
    })
  }

  /** 그 나라가 이기는 데 얼마나 다가섰나 (0~1) — 승리 길 넷 가운데 가장 찬 것 · 장 판·배우는 판은 도읍 차지로 */
  function winShare(r: Realm, f: string): number {
    const ps = pathShares(r, f)
    if (ps.length > 0) return Math.max(...ps.map(([, v]) => v))
    const held = Object.values(r.factions).filter((x) => r.nodes[x.capital]?.owner === f).length
    return Math.max(0, Math.min(1, held / Math.max(1, winNeed(r.region ?? 'byeonhan-mini'))))
  }

  /**
   * 깃발 줄 — 맨 왼쪽이 우리 나라(누르면 우리 땅으로 · 따로 있던 「우리 땅」 단추를 대신한다).
   * 그 오른쪽은 우리와 친하고 강한 나라일수록 가까이 (형 10-28: "나와 서로 친하면서 강할수록 우리랑 가까이 붙이고") ·
   * 칩 밑의 금빛 막대는 그 나라가 이기는 데 얼마나 다가섰나 (승리 길 가운데 가장 찬 것)
   */
  function legendHtml(r: Realm): string {
    const count = (f: string): number => Object.values(r.nodes).filter((n) => n.owner === f).length
    // 아는 나라만 (삼한 남부 판의 발견 — 모르는 나라는 깃발 줄에도 없다)
    const known = sorted(Object.values(r.factions)).filter((f) => knows(r, me(), f.id)).map((f) => ({ f, n: count(f.id) }))
    const top = Math.max(1, ...known.map((x) => x.n))
    const near = (id: string, n: number): number => {
      if (id === me()) return 99
      if (n === 0) return -99
      const rel = relationOf(r, me(), id).state
      const base = rel === 'ally' ? 0.85 : rel === 'truce' ? 0.65 : rel === 'war' ? 0.05 : 0.45
      const fr = Math.max(0, Math.min(1, base + favorOf(r, me(), id) / 400))
      return fr * (0.4 + (0.6 * n) / top)
    }
    const fs = known.sort((a, b) => near(b.f.id, b.n) - near(a.f.id, a.n))
    let h = ''
    for (const { f, n } of fs) {
      const kit = nationKit(f.id)
      const rel = f.id !== me() && n > 0 ? relationOf(r, me(), f.id).state : null
      const atWar = rel === 'war'
      // 동맹은 초록 테, 화친은 옅은 점선 테 (형 10-23: "전쟁 중인 나라는 빨간 테두리 쳐 놨는데 동맹국은 아직 아무 표시 없는 듯")
      const cls = `${focus === f.id ? ' on' : ''}${f.id === me() ? ' me' : ''}${n === 0 ? ' gone' : ''}${atWar ? ' war' : rel === 'ally' ? ' ally' : rel === 'truce' ? ' truce' : ''}`
      // 남의 나라는 군장 얼굴(탈)을 함께 — 깃발 줄만 봐도 누가 우리를 어떻게 보는지 (mood.ts)
      const mood = f.id !== me() && n > 0 ? moodImg(ART, moodOf(r, me(), f.id).mood, 'mood sm') : ''
      const ws = n > 0 ? winShare(r, f.id) : 0
      const act = f.id === me() ? 'data-act="home"' : `data-act="focus" data-id="${f.id}"`
      h += `<button class="lg${cls}" ${act} style="--c:${kit.c};--c2:${kit.c2}"${atWar ? ` title="${esc(josa(f.name, '과', '와'))} 싸우는 중"` : ''}>${atWar ? '<i class="lgwar">⚔</i>' : rel === 'ally' ? '<i class="lgally">동맹</i>' : ''}${emblem(f.id, 'lem')}<b>${n}</b><span>${esc(f.name)}</span>${mood}${ws > 0.02 ? `<i class="lgwin" style="width:${Math.round(ws * 100)}%"></i>` : ''}</button>`
    }
    return h
  }

  // ───────── 군대
  /**
   * 어떻게 갈지 — 진군 방식과 군량 (형: "강을 도하해 기습 · 대로로 행군 · 산기슭으로 · 절벽을 올라간다 · 식량은 어떻게 챙겨가고").
   * 방식마다 얻는 것과 거는 것을 말로, 먹힐 낌새와 판세를 색으로. 숨어 가는 길은 도박이다 — 큰 군대는 잘 안 숨는다.
   */
  function marchChoice(r: Realm, a: Army, m: Move, c: { approach?: Approach; ambush: boolean; ration?: Ration } | undefined = pick[a.id], key = a.id, quiet = false): string {
    const feel = (w: readonly [number, number] | null): string => (w !== null ? fightFeel(w[0], w[1]) : unknownFeel())
    let h = ''
    if (m.hostile) {
      // 병종·지형·공수가 어떻게 걸리나 (상성 — 창 > 방패 > 활 > 창 · 성과 높은 데의 궁수 · 들판의 창병 …)
      const hints = matchupHints(r, me(), a.mix, m.to, m.edge.kind)
      h += hints.length > 0 ? `<details class="hintd"><summary>상성 ${hints.length}가지</summary><ul class="hints">${hints.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></details>` : ''
      const chosen: Approach = c?.approach ?? (c?.ambush === true ? 'night' : 'road')
      const moves = approachMoves(r, me(), a, m)
      // 군막 — 장수 둘이 저마다 길 하나를 권하고 적이 지킬 길목을 읽는다 (council-lines.ts · COUNCIL.md 1주 조각 ②)
      // 전략 회의 화면에서는 안건이 이미 말했다 — 길 단추에 얼굴을 또 붙이지 않는다 (quiet)
      const advs = quiet ? [] : adviseMarch(r, me(), a, m.to, moves)
      h += `<div class="how">`
      for (const x of moves) {
        const does = APPROACH_DOES[x.ap]
        const adv = advs.find((v) => v.ap === x.ap)
        // 한 줄에 하나 — 왼쪽은 이름과 얻고 거는 것, 오른쪽은 판세 (좁은 폰에서도 읽히게) · 권한 장수가 있으면 얼굴과 한 줄
        h += `<button class="hw ${x.ap !== 'road' ? 'amb ' : ''}${chosen === x.ap ? 'on' : ''}${adv !== undefined ? ' adv' : ''}" data-act="ap" data-army="${key}" data-v="${x.ap}" data-adv="${adv?.hero.id ?? ''}" data-tip="${esc(`${does.gain}. ${does.risk}`)}">`
        if (adv !== undefined) h += `<span class="hwa">${bust(adv.hero, 'hwf')}<span class="hws"><b>${esc(adv.hero.name)}</b> ${esc(adv.say)}<small>${esc(adv.readSay)}</small></span></span>`
        h += `<span class="hwl"><b>${APPROACH_NAME[x.ap]}${x.seasons !== m.seasons ? ` <small>${x.seasons}계절</small>` : ''}</b>`
        h += `</span><span class="hwr">`
        if (x.ap === 'road') h += `<span class="ln">${feel(x.hit)}</span>`
        else {
          // 적이 이 길목을 지키면 깎이고 비켜 가면 오른다 — 남의 속이 섞여 범위 (ODDS)
          const [lo, hi] = guardRange(x.p, x.ap)
          h += `<span class="ln">${x.ap === 'cliff' ? '오르기' : '몰래'} ${ambushRangeFeel(lo, hi)}</span><span class="ln">되면 ${feel(x.hit)} · 들키면 ${feel(x.miss)}</span>`
        }
        h += `</span></button>`
      }
      h += `</div>`
      // 길과 때 (형이 고름: "길과 때의 싸움") — 이 길이 왜 숨기 좋은지·나쁜지
      const cv = concealOf(r, m.edge.id, headcount(forceOf(r, a)), m.to)
      const cw = cv.why.map((w) => CONCEAL_LINE[w]).filter((x) => x !== undefined)
      h += `<p class="mute tip"><b${cw.length > 0 ? ` data-tip="${esc(cw.join(' · '))}"` : ''}>${cv.tier === 'good' ? '숨기 좋은 길' : cv.tier === 'fair' ? '그저 그런 길' : '숨기 나쁜 길'}</b></p>`
    }
    // 군량 — 몇 계절치를 챙기나 (형: "넉넉히랑 안듦 두개밖에 없는데 이거 기본수치로 주고 줄일수 있게").
    // 길 계절은 늘 챙기고, 그 위에 더 챙길 계절을 고른다. 기본은 옛 "넉넉히"(rationReserve). 더 챙길수록 곡식이 든다
    const extra = rationExtraOf(r, a, m.seasons, c?.ration)
    const cost = rationCost(r, a, m.seasons, extra)
    const total = m.seasons + extra
    h += `<div class="ration">${icon('good-rice', 'rci')}<b>군량 ${total}계절치</b>`
    h += `<span class="stepper sm"><button data-act="ration" data-army="${key}" data-v="less" ${extra <= 0 ? 'disabled' : ''}>−</button><b>${total}</b>`
    h += `<button data-act="ration" data-army="${key}" data-v="more" ${extra >= P.realm.rationMaxExtra || rationCost(r, a, m.seasons, extra + 1) > left().grain + cost ? 'disabled' : ''}>+</button></span>`
    h += cost > 0 ? costHtml({ grain: cost }) : `<span class="mute">곡식 안 듦</span>`
    // 국고 — 지금 남은 곡식과 이 군량을 챙긴 뒤 (형 10-29: "군량 컨트롤은 지금 국고도 같이 보여줘야") · 이 군대가 이미 챙겨 둔 몫은 되돌려 셈한다
    const pk = pick[key === SORTIE ? openArmy : key]
    const had = pk !== undefined && pk.edge === m.edge.id ? rationCost(r, a, m.seasons, rationExtraOf(r, a, m.seasons, pk.ration)) : 0
    const base = left().grain + had
    h += `<span class="treas">국고 ${icon(GOOD_ICON.grain, 'tri')}<b>${base.toLocaleString('ko-KR')}</b> → <b class="${base - cost < 0 ? 'neg' : ''}">${(base - cost).toLocaleString('ko-KR')}</b></span>`
    h += `<button class="btn ghost sm${extra === P.realm.rationReserve ? ' on' : ''}" data-act="ration" data-army="${key}" data-v="full">기본</button></div>`
    if (extra <= 0) h += `<p class="mute tip">닿자마자 군량이 바닥난다</p>`
    return h
  }

  /** 출정에 고른 군사가 군대 전부인가 */
  function sortieAll(a: Army): boolean {
    return (Object.entries(a.mix) as Array<[UnitKind, number]>).every(([k, n]) => n <= 0 || (sortieD.take[k] ?? 0) >= n)
  }
  /** 출정할 무리 — 전부면 그 군대 그대로, 일부면 떼어 낼 무리(판세를 그 힘으로 본다) */
  function sortieProbe(a: Army): Army {
    if (sortieAll(a)) return a
    return { id: SORTIE, faction: a.faction, hero: sortieD.hero ? a.hero : null, mix: { ...sortieD.take }, equip: a.equip, morale: a.morale, at: a.at, march: null }
  }

  /**
   * 출정 꾸리기 — 누가 가나(처음엔 전부 — 줄이면 나머지가 남아 지킨다) · 장수 · (전략이면) 장수들의 안·길·군량.
   * 갈 곳은 지도에서 이미 골랐다 — 「어디로」를 다시 묻지 않는다 (형 10-29: "본인이 어디서 어디로 가게 이미 선택했는데 필요 없는 구간").
   * split — 군대 창의 나누기(여기 남긴다) · strat — 전략 회의 화면
   */
  function sortiePanel(r: Realm, a: Army, mode: 'split' | 'strat'): string {
    const hero = a.hero !== null ? r.heroes[a.hero] : undefined
    const all = sortieAll(a)
    const sent = Object.values(sortieD.take).reduce((s, n) => s + (n ?? 0), 0)
    const total = headcount(forceOf(r, a))
    let h = `<div class="splitp sortiep"><div class="sth">${mode === 'split' ? '떼어 낼 군사' : '누가 가나'} <span class="seg sm"><button class="${all ? 'on' : ''}" data-act="sqall" data-v="all">전부</button><button data-act="sqall" data-v="half">절반</button></span></div>`
    for (const [k, n] of Object.entries(a.mix) as Array<[UnitKind, number]>) {
      if (n <= 0) continue
      const v = sortieD.take[k] ?? 0
      const step = Math.max(5, Math.round(n / 10 / 5) * 5)
      h += `<div class="sprow">${icon(UNIT_ICON[k])}<span class="spn">${UNIT_NAME[k]}</span><span class="stepper sm">`
      h += `<button data-act="sq" data-army="${a.id}" data-kind="${k}" data-d="${-step}">−</button><b>${v}</b>`
      h += `<button data-act="sq" data-army="${a.id}" data-kind="${k}" data-d="${step}">+</button></span><span class="mute">/ ${n}</span></div>`
    }
    h += mode === 'split'
      ? `<div class="spsum">떼어 낸다 <b>${sent}</b>명 · 남는다 <b>${total - sent}</b>명</div>`
      : `<div class="spsum">출정 <b>${sent}</b>명${all ? ' · 군대 전부' : ` · 남아 지킨다 <b>${total - sent}</b>명`}</div>`
    if (hero !== undefined && hero.status === 'free' && !all) {
      h += `<div class="sth">장수</div><div class="seg"><button class="${sortieD.hero ? 'on' : ''}" data-act="shero" data-v="1">${esc(josa(hero.name, '이', '가'))} 이끌고 간다</button>`
      h += `<button class="${sortieD.hero ? '' : 'on'}" data-act="shero" data-v="0">${esc(josa(hero.name, '은', '는'))} 남아 지킨다</button></div>`
    } else if (hero !== undefined) h += `<div class="mute">${esc(josa(hero.name, '이', '가'))} 이끈다</div>`
    if (mode === 'split') return h + `</div>`
    // 장수들의 안 · 길 · 군량 — 출정할 무리의 힘으로 판세를 본다
    const probe = sortieProbe(a)
    const m = movesOf(r, me(), probe).find((x) => x.edge.id === sortieD.edge)
    if (m !== undefined) {
      h += `<div class="sth">장수들의 안 · 어떻게 갈까 ${guideBtn('march')}</div>`
      if (m.blocked !== null) h += `<div class="banner bad">${esc(HARD_LINE[m.blocked])}</div>`
      h += marchChoice(r, probe, m, { approach: sortieD.approach, ambush: sortieD.approach !== 'road', ...(sortieD.ration !== undefined ? { ration: sortieD.ration } : {}) }, SORTIE, true)
      // ⑤ 같은 고을을 치는 다른 우리 군대가 있으면 — 다 같이 들이칠까, 뒤따라 원군으로 들이칠까 (형 10-25: "원군으로도 안 오고 그냥 한 번에 합산")
      const mates = m.hostile ? Object.values(r.armies).filter((o) => o.faction === me() && o.id !== a.id
        && ((o.march !== null && o.march.to === m.to) || (pick[o.id] !== undefined && o.march === null && r.edges[pick[o.id]!.edge] !== undefined && otherEnd(r.edges[pick[o.id]!.edge]!, o.at) === m.to))) : []
      if (mates.length > 0) {
        const f = sortieD.follow === true
        h += `<div class="sth">${esc(mates.map((o) => armyName(r, o)).join(' · '))}도 그리로 간다</div><div class="seg"><button class="${f ? '' : 'on'}" data-act="sfollow" data-v="0">다 같이 들이친다</button>`
          + `<button class="${f ? 'on' : ''}" data-act="sfollow" data-v="1" data-tip="처음엔 빠져 있다가 몇 합 뒤에 원군으로 들이친다. 지친 적이 흔들리고 우리 사기가 오른다">뒤따른다 · 원군으로</button></div>`
      }
    }
    return h + `</div>`
  }

  /** 출정 띠 — 판 맨 아래에 붙어 굴려도 보인다 (형: "설정을 싹 마치고 맨 아래 출정버튼 · 하단고정") */
  /**
   * 가는 곳이 싸울 곳이면 「출정」, 우리 땅·동맹 땅이면 「이동」 (형 10-24: "맨날 출정이 아니라 적국이면 공격하러 간다는 걸, 군사 이동이면 이동이라고")
   */
  function goWord(r: Realm, a: Army, edge: string | undefined): '출정' | '이동' {
    if (edge === undefined) return '출정'
    const m = movesOf(r, me(), a).find((x) => x.edge.id === edge)
    return m !== undefined && !m.hostile ? '이동' : '출정'
  }

  function sortieBar(r: Realm, a: Army): string {
    const all = sortieAll(a)
    const sent = Object.values(sortieD.take).reduce((s, n) => s + (n ?? 0), 0)
    const total = headcount(forceOf(r, a))
    const ed = sortieD.edge !== null ? r.edges[sortieD.edge] : undefined
    const dest = ed !== undefined ? r.nodes[otherEnd(ed, a.at)!]?.name : undefined
    const m = ed !== undefined ? movesOf(r, me(), sortieProbe(a)).find((x) => x.edge.id === ed.id) : undefined
    if (stratOpen === null) {
      // 군대 창의 나누기 — 떼어 내 여기 남긴다
      const w = sent <= 0 ? '떼어 낼 군사를 고른다' : all ? '다 떼어 낼 수는 없다. 몇은 남긴다' : splitBlocked(r, a, sent, total)
      return `<div class="sortiebar"><button class="btn pri wide go" data-act="sortie-go" data-army="${a.id}" ${w !== null ? 'disabled' : ''}>${esc(w ?? `${sent.toLocaleString('ko-KR')}명을 떼어 낸다`)}</button><button class="btn ghost" data-act="open" data-army="${a.id}">접기</button></div>`
    }
    const waiting = sortieD.wait === true
    const why = waiting ? null : sent <= 0 ? '보낼 군사를 고른다' : !all ? splitBlocked(r, a, sent, total) : dest === undefined ? '갈 곳을 고른다' : null
    // 결정 — 고른 것이 한 줄에 (몇 명 · 어디로 · 어느 길 · 누가 이끄나) · 기다리면 그 말
    const lead = sortieD.lead !== undefined ? r.heroes[sortieD.lead] : undefined
    const how = m !== undefined && m.hostile ? ` · ${APPROACH_SHORT[sortieD.approach]}${lead !== undefined ? ` · ${josa(lead.name, '이', '가')} 이끈다` : ''}` : ''
    const label = waiting ? '결정: 이번 계절은 기다린다' : why !== null ? why : dest !== undefined
      ? `결정 · ${m !== undefined && !m.hostile ? '이동' : '출정'}: ${sent.toLocaleString('ko-KR')}명 · ${josa(dest, '으로', '로')}${m !== undefined ? ` · ${m.seasons}계절` : ''}${how}`
      : `${sent.toLocaleString('ko-KR')}명을 떼어 둔다`
    // 전략 회의의 띠 — 출정 · (「다음 계절」 앞이면) 그대로 간다 · 그만둔다
    let h = `<div class="sortiebar"><button class="btn pri wide go" data-act="sortie-go" data-army="${a.id}" ${why !== null ? 'disabled' : ''}>${esc(label)}</button>`
    return h + (stratOpen.next ? `<button class="btn ghost" data-act="strat-x" data-v="keep">그대로 간다</button>` : `<button class="btn ghost" data-act="strat-x">그만둔다</button>`) + `</div>`
  }

  /** 나누기가 안 되는 까닭 — 되면 null (엔진 season.splitArmy 의 규칙과 같다) */
  function splitBlocked(r: Realm, a: Army, sent: number, total: number): string | null {
    const n = Object.values(r.armies).filter((x) => x.faction === a.faction).length
    if (n >= P.realm.armyMax) return `군대가 벌써 ${n}개다. ${P.realm.armyMax}개까지만 둔다. 다른 군대를 합류시키면 자리가 난다.`
    if (sent < P.realm.splitMin) return `${P.realm.splitMin}명은 넘게 보내야 한다.`
    if (total - sent < P.realm.splitMin) return `남아 지킬 군사가 ${P.realm.splitMin}명은 있어야 한다. 다 보내려면 「전부」를 누른다.`
    return null
  }

  /**
   * 부대의 힘과 무장 (형: "창병 궁수 방패병 다르지 않나 · 무장해서 뽑으면 그 수도 파악 · 부대마다 전투력은 어떻게 나오고 · 철이 아니면 뭘로 싸움?") —
   * 병종마다 몇 명이 무엇을 들었나, 힘이 얼마이고 무엇 때문인가, 병종마다 무장 올리기.
   */
  function gearBlock(r: Realm, a: Army): string {
    let h = ''
    const p = armyPower(r, a.id)
    if (p !== null) {
      const mine = sorted(Object.values(r.armies)).filter((x) => x.faction === me()).map((x) => armyPower(r, x.id)?.total ?? 0)
      const top = Math.max(1, ...mine)
      // 무장은 평균이 가장 가까운 단계의 이름으로 (돌·나무 · 청동 · 쇠날 · 온 쇠 · 고리칼)
      const R = P.realm
      const near = ([['stone', R.equipStone], ['bronze', R.equipBronze], ['ironTip', R.equipIronTip], ['iron', R.equipIron], ['ringSword', R.equipRingSword]] as Array<[Equip, number]>)
        .sort((x, y) => Math.abs(x[1] - p.parts.gear) - Math.abs(y[1] - p.parts.gear))[0]![0]
      const gear = `${TIER_NAME[near]} 무장`
      const lead = a.hero === null ? '장수가 없다' : p.parts.lead >= 1.15 ? '장수가 잘 이끈다' : '장수가 이끈다'
      const mor = p.parts.morale < 0.9 ? '사기가 낮다' : p.parts.morale > 1.05 ? '사기가 높다' : '사기 보통'
      // 글 대신 그림 칩 — 무엇이든 한눈에 (형 10-23: "군사 xxx명, 쇠날 무장, 장수가 잘 이끈다, 사기가 낮다 … 아이콘이나 뭔가로 이미지화")
      const GEAR_IC: Record<Equip, string> = { stone: 'settle-stone-fortress', leather: 'settle-stone-fortress', bronze: 'treasure-bronze-mirror', ironTip: 'treasure-iron-helmet', iron: 'treasure-iron-helmet', ringSword: 'treasure-ring-sword' }
      const hero = a.hero !== null ? r.heroes[a.hero] : undefined
      const leadChip = hero !== undefined ? `<span class="pch ${p.parts.lead >= 1.15 ? 'good' : ''}" data-tip="${esc(lead)}">${bust(hero, 'pchf')}${p.parts.lead >= 1.15 ? '<i>★</i>' : ''}</span>` : `<span class="pch bad" data-tip="${esc(lead)}">${icon('unit-general', 'pchi')}<i>✕</i></span>`
      const morCls = p.parts.morale < 0.9 ? 'bad' : p.parts.morale > 1.05 ? 'good' : ''
      const chips = `<span class="pch" data-tip="군사 ${headcount(forceOf(r, a))}명">${icon(UNIT_ICON.spear, 'pchi')}<b>${headcount(forceOf(r, a)).toLocaleString('ko-KR')}</b></span>`
        + `<span class="pch" data-tip="${esc(gear)}">${icon(GEAR_IC[near], 'pchi')}<b>${esc(TIER_NAME[near])}</b></span>`
        + leadChip
        + `<span class="pch ${morCls}" data-tip="${esc(mor)}">${icon(p.parts.morale < 0.9 ? 'status-morale-down' : 'status-morale-up', 'pchi')}<span class="pmb"><i style="width:${Math.round(Math.max(0.05, Math.min(1, p.parts.morale / 1.3)) * 100)}%"></i></span></span>`
      h += `<div class="pow"><b>전투력 ${Math.round(p.total).toLocaleString('ko-KR')}</b><span class="pbar"><i style="width:${Math.max(4, (p.total / top) * 100)}%"></i></span>`
      h += `<span class="pchips">${chips}</span></div>`
    }
    const canArm = a.march === null && r.nodes[a.at]?.owner === me()
    const st = left()
    for (const [k, rows] of Object.entries(kitLines(a)) as Array<[UnitKind, Array<{ tier: Equip; n: number }>]>) {
      const n = rows.reduce((s, x) => s + x.n, 0)
      if (n <= 0) continue
      h += `<div class="kitrow">${icon(UNIT_ICON[k])}<b>${UNIT_NAME[k]} ${n}</b><span class="kt">${rows.slice().reverse().map((x) => `${esc(GEAR_NAME[k]?.[x.tier] ?? TIER_NAME[x.tier])} ${x.n}`).join(' · ')}</span>`
      const ac = canArm ? armCost(r, a.id, k) : null
      const on = musters.some((o) => o.kind === 'arm' && o.army === a.id && o.unit === k)
      if (ac !== null) {
        // 글은 esc, 드는 값 칩은 그 뒤에 (칩까지 esc 하면 <span class="cost"> 가 글자로 보였다 — 형 10-23)
        // 한 마디 — 「철제 강화」, 누르면 「쇠날창 무장」 (형 10-27: "쇠 강화 버튼이 너무 길어서 병 수랑 행이 나눠져서 너무 크잖아")
        const gear = GEAR_NAME[k]?.[ac.to] ?? TIER_NAME[ac.to]
        const label = on ? `${esc(gear)} 무장` : `철제 강화 ${costHtml({ iron: ac.iron })}`
        // 올리는 중이면 이 단추는 "취소" — 골라 둔 표(금테 ✓)를 달지 않는다 (형 10-23: "올리는중 취소 버튼이 이상하게 황금색 테두리")
        h += `<button class="btn sm ${on ? 'ghost' : ''}" data-act="arm" data-army="${a.id}" data-unit="${k}" data-tip="${esc(on ? `${ac.n}명이 ${josa(gear, '으로', '로')} 무장한다 · 누르면 거둔다` : `${ac.n}명을 ${josa(gear, '으로', '로')}`)}" ${on || (st.iron >= ac.iron && st.grain >= ac.grain) ? '' : 'disabled'}>${label}</button>`
      }
      h += `</div>`
    }
    return h
  }

  function sortie(r: Realm): string {
    const byTo = new Map<string, Array<{ army: Army; move: Pick<Move, 'seasons' | 'edge' | 'hostile'> }>>()
    for (const [army, c] of Object.entries(pick)) {
      const a = r.armies[army]
      if (c === undefined || a === undefined || a.march !== null) continue
      const m = movesOf(r, me(), a).find((x) => x.edge.id === c.edge)
      if (m === undefined) continue
      byTo.set(m.to, [...(byTo.get(m.to) ?? []), { army: a, move: m }])
    }
    // 이미 길 위에 있는 군대도 — 앞서 보낸 군대와 이번에 보내는 군대가 같은 계절에 닿으면 협공이다
    for (const a of sorted(Object.values(r.armies))) {
      const ed = a.march !== null ? r.edges[a.march.edge] : undefined
      if (a.faction !== me() || a.march === null || ed === undefined || !byTo.has(a.march.to)) continue
      const own = r.nodes[a.march.to]?.owner ?? null
      byTo.get(a.march.to)!.push({ army: a, move: { seasons: a.march.left, edge: ed, hostile: own !== null && own !== me() } })
    }
    let h = ''
    for (const [to, legs] of [...byTo].sort((x, y) => (x[0] < y[0] ? -1 : 1))) {
      if (legs.length < 2 || !legs[0]!.move.hostile) continue
      if (new Set(legs.map((x) => x.move.seasons)).size > 1) {
        h += `<div class="banner">${esc(r.nodes[to]!.name)}: 닿는 계절이 달라 따로 싸운다</div>`
        continue
      }
      const w = jointWin(r, me(), legs.map((x) => ({ army: x.army, edge: x.move.edge })), to)
      const two = new Set(legs.map((x) => x.move.edge.id)).size >= 2
      h += `<div class="banner good">협공 ${esc(r.nodes[to]!.name)} · ${legs.length}군${two ? ' · 두 길로 들어가 더 세다' : ''} ${w === null ? unknownFeel() : fightFeel(w[0], w[1])}</div>`
    }
    return h
  }

  function armySheet(r: Realm): string {
    let h = `<h3>군대</h3>${threatsHtml(r)}${sortie(r)}`
    if (note !== '') h += `<div class="banner bad">${tx(note)}</div>`
    const armies = sorted(Object.values(r.armies)).filter((a) => a.faction === me())
    if (armies.length === 0) h += `<p class="mute">군대가 없다. 징병으로 뽑는다.</p>`
    for (const a of armies) {
      const hero = a.hero !== null ? r.heroes[a.hero] : undefined
      const disbanding = musters.some((o) => o.kind === 'disband' && o.army === a.id)
      const fresh = freshArmy === a.id
      h += `<div class="acard${fresh ? ' fresh' : ''}">${bust(hero)}<div class="ab">${fresh ? `<div class="banner good">${goWord(r, a, pick[a.id]?.edge)}: ${pick[a.id] !== undefined && r.edges[pick[a.id]!.edge] !== undefined ? `${esc(josa(r.nodes[otherEnd(r.edges[pick[a.id]!.edge]!, a.at)!]?.name ?? '', '으로', '로'))} 떠난다. 지도에 화살표가 생겼다.` : '여기 남는다.'}</div>` : ''}<div class="an"><b>${esc(armyName(r, a))}</b>`
      h += `<span class="mute">${esc(r.nodes[a.at]?.name ?? '')} · ${headcount(forceOf(r, a))}명</span></div><div class="units">`
      h += `</div>${gearBlock(r, a)}`
      if (realm!.armies[a.id] === undefined) h += `<div class="mute">이번 계절에 나눴다</div>`
      if (a.march !== null) {
        h += `<div class="mute">${esc(josa(r.nodes[a.march.to]?.name ?? '', '으로', '로'))} 가는 중 · ${esc(arriveWhen(r.season, a.march.left))}${a.march.ambush ? ' · 몰래 가는 길' : ''}</div>`
        h += turnBackBtn(a)
        h += `</div></div>`
        continue
      }
      if (disbanding) {
        h += `<div class="mute">해산한다</div><div class="btns"><button class="btn ghost" data-act="undisband" data-army="${a.id}">해산 취소</button></div></div></div>`
        continue
      }
      h += assaultBtn(r, a)
      const open = openArmy === a.id
      // 출정 판을 열면 출정은 아래 붙박이 띠가 맡는다 — 위 단추는 숨긴다 (형 10-23: "하단 고정 만들었으면 방패병 밑의 출정 버튼은 없애야")
      // 고치기 단추엔 어디서 어디로 — 떠나는 고을 → 닿을 곳 (형 10-27: "출정 고치기는 출발 지점과 목표 지점 둘 다")
      const pk = pick[a.id]
      const goTo = pk !== undefined ? (pk.goal ?? (r.edges[pk.edge] !== undefined ? otherEnd(r.edges[pk.edge]!, a.at) : undefined)) : undefined
      // 군대 창은 나누기·합치기·장수 — 보내기는 지도에서 (형 10-29: "군대 창에서 하게 하니까 복잡해짐 · 이동은 화면에서만")
      h += `<div class="btns">${open ? '' : `<button class="btn" data-act="open" data-army="${a.id}">나누기</button>`}${pk !== undefined && goTo != null ? `<button class="btn ghost" data-act="sortie-cancel" data-army="${a.id}">${goWord(r, a, pk.edge)} 거두기 ${flowPair(r, a.at, goTo)}</button>` : ''}`
      for (const b of armies) {
        if (b.id !== a.id && b.at === a.at && b.march === null) h += `<button class="btn" data-act="merge" data-army="${a.id}" data-into="${b.id}">${esc(armyName(r, b))}에 합류</button>`
      }
      // 장수 없는 군대 — 이 고을에 혼자 있는 우리 장군이 바로 이끈다 (들인 떠돌이도)
      h += `</div>`
      // 장수 없는 군대 — 이끌 장수를 얼굴로 (출정 단추와 줄을 나눈다 · 형 10-23: "출정 버튼이랑 장수 이끌게 하기 버튼 구분 · 장수 얼굴 이미지도")
      if (a.hero === null) {
        const can = leadCands(r, a)
        if (can.length > 0) {
          h += `<div class="leadrow"><span class="mute">이끌 장수</span>`
          for (const y of can) {
            // 군주도 친히 이끈다(친정) — 도읍을 비우면 다스림이 준다
            h += isRuler(r, y.id)
              ? `<button class="btn lead" data-act="lead" data-id="${y.id}" data-army="${a.id}" data-tip="${RULER_LEAD_TIP}">${bust(y, 'lf')}<span>${esc(y.name)}<small>친히 이끈다</small></span></button>`
              : `<button class="btn lead" data-act="lead" data-id="${y.id}" data-army="${a.id}">${bust(y, 'lf')}<span>${esc(y.name)}<small>이끈다</small></span></button>`
          }
          h += `</div>`
        }
      }
      h += `<div class="btns">`
      h += `</div>`
      if (pick[a.id] !== undefined && !open) {
        const ed = r.edges[pick[a.id]!.edge]
        if (ed !== undefined) h += `<div class="go">→ ${esc(r.nodes[otherEnd(ed, a.at)!]?.name ?? '')}${pick[a.id]!.ambush ? ' · 기습' : ''}</div>`
      }
      const g = goalOf(a)
      if (g !== undefined && !open) h += `<div class="go">⇢ ${esc(r.nodes[g]?.name ?? '')}까지 계절마다 한 걸음씩 간다 · 「머문다」로 거둔다</div>`
      if (open) h += sortiePanel(r, a, 'split')
      else if (pk === undefined && goalOf(a) === undefined) h += `<p class="mute tip">보내기는 지도에서, 이 군대를 누르고 갈 곳을 누른다</p>`
      // 해산은 카드 맨 밑에 작게 — 잘못 누르기 쉬운 자리에서 뺀다 (형: "해산 버튼은 더 맨 밑에")
      if (r.nodes[a.at]?.owner === me()) h += `<div class="btns dis"><button class="btn ghost sm" data-act="disband" data-army="${a.id}">해산</button></div>`
      h += `</div></div>`
    }
    if (armyOrders.length > 0) h += `<button class="btn ghost wide" data-act="undo-split">나누기·합류 되돌리기</button>`
    const oa = openArmy !== '' ? r.armies[openArmy] : undefined
    if (oa !== undefined && oa.faction === me() && oa.march === null) h += sortieBar(r, oa)
    return h
  }

  // ───────── 징병 (형: "군사징병이랑 개척 좀 확실히 구분필요함" — 군사는 「징병」, 집 옮기기는 「백성」 탭)
  function draftSheet(r: Realm): string {
    const season = seasonOf(r.season)
    // 설명은 ? 안으로 (형 10-23: "징병 탭에 더 이상 백성 옮기는 탭 설명 넣을 필요가 없어졌어 · 물음표 아이콘에서 부연 설명")
    // 「징병 · 군사 뽑기」는 같은 말 두 번 (형 10-27)
    let h = `<h3 class="sech men">${icon('unit-spear')}징병 ${guideBtn('draft')}</h3>`
    if (note !== '') h += `<div class="banner bad">${tx(note)}</div>`
    if (season === 'spring') h += `<div class="banner bad">${tx('봄에 뽑으면 그해 가을 수확량이 줄어든다')}</div>`
    if (season === 'autumn' || season === 'winter') h += `<div class="banner good">${tx('거둔 뒤라 뽑기 좋은 때다')}</div>`
    const pending = musters.filter((o): o is Extract<Order, { kind: 'draft' }> => o.kind === 'draft')
    // 알아서 뽑기 — 고을마다 뽑을 수 있는 만큼, 창병과 궁병을 섞어 곡식이 닿는 데까지 (형 10-24: "모든 고을에서 다 최대로 골고루")
    // 설명은 ? 안으로 (형 10-27: "물음표가 분명히 존재하는데 아직도 징병 탭에 텍스트가 너무 많음")
    // 추천 딱지 — 아직 안 뽑았으면 따라 누르면 되는 단추 (형 10-29 · 문명)
    h += `<div class="btns"><button class="btn pri men wide" data-act="auto-draft">⚡ 알아서 뽑기${pending.length === 0 ? REC_ST : ''}</button></div>`
    for (const n of myTowns(r)) h += draftCard(r, n.id, false)
    if (pending.length > 0) {
      h += `<h4>이번 계절 징병</h4>`
      pending.forEach((o) => {
        h += `<div class="row">${icon(UNIT_ICON[o.unit])}${esc(r.nodes[o.node]?.name ?? '')} ${UNIT_NAME[o.unit]} ${o.n}<button class="btn ghost sm" data-act="undraft" data-i="${musters.indexOf(o)}">취소</button></div>`
      })
    }
    return h
  }

  /**
   * 고을 하나의 징병 칸 — 징병 판과 고을 판이 같이 쓴다. big 이면 병종을 큰 그림으로
   * (형: "내도시 누르면 여기서 징병 누를필요 없이 바로 큰 병종별 이미지와 함께 간편하게 뽑을수 있게")
   */
  function draftCard(r: Realm, id: string, big: boolean): string {
    const n = r.nodes[id]!
    const pending = musters.filter((o): o is Extract<Order, { kind: 'draft' }> => o.kind === 'draft')
    let h = ''
    {
      const done = pending.filter((o) => o.node === n.id).reduce((s, o) => s + o.n, 0)
      const unit = draftUnit[n.id] ?? 'spear'
      const limAll = Math.max(0, draftLimit(r, me(), n.id) - done)
      // 기병은 말이, 수군은 배 지을 나무가 있어야 뽑는다 (땅마다 나는 것)
      const lim = Math.max(0, Math.min(limAll, draftLimit(r, me(), n.id, unit) - done))
      const step = Math.max(1, Math.round(lim / 10))
      const want = Math.min(lim, draftN[n.id] ?? Math.min(lim, 20))
      h += `<div class="ncard draftc${big ? ' big' : ''}"><div class="an">${big ? `<b>여기서 군사 뽑기</b>` : `${icon(nodeIcon(n), 'nic')}<b>${esc(n.name)}</b>`}`
      h += `<span class="mute">${tx(`집 ${Math.floor(n.hh)} · 장정 ${militiaMen(r, n.id)}${done > 0 ? ` · 뽑는 중 군사 ${done}` : ''}`)}</span></div>`
      // 고을 판 — 이 고을에서 이번 계절 뽑기로 한 것 (다 뽑아 한도가 찼어도 보이고 취소할 수 있게)
      const mine = (): string => (big ? pending.filter((o) => o.node === n.id).map((o) => `<div class="row">${icon(UNIT_ICON[o.unit])}${UNIT_NAME[o.unit]} ${o.n}명 뽑는다<button class="btn ghost sm" data-act="undraft" data-i="${musters.indexOf(o)}">취소</button></div>`).join('') : '')
      if (limAll <= 0) {
        h += `<div class="mute">이번 계절엔 더 못 뽑는다</div>${mine()}</div>`
        return h
      }
      if (big) {
        // 알아서 — 이 고을에서 뽑을 수 있는 병종 모두를 골고루 (형 10-25: "고을 눌렀을때 나오는 그마을 군사뽑기도 자동버튼")
        h += `<div class="btns"><button class="btn pri men wide" data-act="auto-draft" data-node="${n.id}">⚡ 알아서 뽑기 · ${limAll}명</button></div>`
        // 병종 — 큰 그림 타일 (누르면 그 병종으로)
        h += `<div class="dbig">`
        for (const u of draftable(n, r, me())) {
          const ul = Math.max(0, Math.min(limAll, draftLimit(r, me(), n.id, u) - done))
          h += `<button class="${u === unit ? 'on' : ''}" data-act="dunit" data-node="${n.id}" data-unit="${u}" ${ul <= 0 ? 'disabled' : ''}><img src="${ART}icon/${UNIT_ICON[u]}.png" alt=""><b>${UNIT_NAME[u]}</b><small>${ul > 0 ? `${ul}명까지` : u === 'horse' ? '말이 없다' : u === 'boat' ? '나무가 없다' : u === 'crossbow' ? '틀이 찼다' : '못 뽑는다'}</small></button>`
        }
        h += `</div>`
      } else {
        h += `<div class="seg">`
        for (const u of draftable(n, r, me())) h += `<button class="${u === unit ? 'on' : ''}" data-act="dunit" data-node="${n.id}" data-unit="${u}">${icon(UNIT_ICON[u])}${UNIT_NAME[u]}</button>`
        h += `</div>`
      }
      // 채비 값 — 덩이쇠(변한)는 쌓인 쇠·모자란 곡식 몫을 쇠로 낸다 (economy.draftPay · 계획판 위에서) · 쇠는 값 칩에 보인다
      const dp = draftPay(plan(), me(), Math.max(0, want))
      const nd = draftNeeds(unit, Math.max(1, want), r, me())
      if (unit === 'crossbow') h += `<p class="mute">${lim > 0 ? `${costHtml({ iron: nd.iron })} ${tx('쇠뇌 틀만큼만')}` : tx('쇠뇌 틀이 다 찼거나 쇠가 없다')}</p>`
      if (unit === 'horse') h += `<p class="mute">${lim > 0 ? costHtml({ horse: nd.horse }) : '말이 없다: 목장(너른벌을 일구면)에서 나거나 바꿔 온다'}</p>`
      if (unit === 'boat') h += `<p class="mute">${lim > 0 ? costHtml({ wood: nd.wood }) : '배 지을 나무가 없다. 솔숲·산·산성 땅에서 난다'}</p>`
      // 철을 더 들이면 처음부터 한 단계 좋은 무기 — 「쇠날창 장착」 한 마디 (형 10-27: "텍스트 너무 길지 않냐 · 쇠날창 장착 이런 식으로")
      const ic = want > 0 ? draftIronCost(r, me(), want, unit) : null
      if (ic !== null) h += `<label class="chk"><input type="checkbox" data-act="diron" data-node="${n.id}" ${draftIron[n.id] === true ? 'checked' : left().iron < ic.iron ? 'disabled' : ''}> ${esc(GEAR_NAME[unit]?.[ic.to] ?? TIER_NAME[ic.to])} 장착 ${costHtml({ iron: ic.iron })}</label>`
      // 뽑은 만큼 일손이 빠진다 (season.draftArmy · draftHHPerMan) — 글 대신 집 ▼ 칩 (가을걷이는 봄 띠가 이미 말한다)
      const hhLoss = Math.round(want * P.realm.draftHHPerMan)
      h += `<div class="stepper"><button data-act="dn" data-node="${n.id}" data-d="${-step}">−</button><b>${want}</b>`
      h += `<button data-act="dn" data-node="${n.id}" data-d="${step}">+</button><span class="mute">명 · 최대 ${lim}</span>${costHtml({ grain: Math.ceil(dp.grain), ...(dp.iron > 0 ? { iron: dp.iron } : {}) })}`
      h += `${hhLoss > 0 ? `<span class="cost"><b class="cg" title="집 ${hhLoss}"><i>▼</i>${icon('settle-farm-village', 'cgi')}${hhLoss}</b></span>` : ''}</div>`
      // 뽑기 단추는 숫자 줄 밑에 크게 한 줄 — 이게 뽑는 단추라고 바로 알게 (형 10-27)
      h += `<div class="btns"><button class="btn pri men wide" data-act="draft" data-node="${n.id}" ${want <= 0 ? 'disabled' : ''}>군사 ${want}명 뽑기</button></div>`
      h += mine()
      h += `</div>`
    }
    return h
  }

  // ───────── 백성 — 이번 계절 백성 이동 (군사가 아니다)
  /** 짝 한 줄 — [보내는 고을] ⟶ [받는 고을] */
  const flowPair = (r: Realm, from: string, to: string): string =>
    `<span class="nchip">${esc(r.nodes[from]?.name ?? '')}</span><i class="ar">→</i><span class="nchip">${esc(r.nodes[to]?.name ?? '')}</span>`

  /**
   * 백성 판 — 개척단 · 개척할 수 있는 땅 · 붐벼서 저절로 옮겨 가는 백성.
   * 고을끼리 백성을 옮기는 일은 손에서 뺐다 — 붐비면 저절로 이웃으로 넘친다 (economy.autoFlows)
   */
  function peopleSheet(r: Realm): string {
    let h = `<h3 class="sech home">${icon('settle-farm-village')}백성 ${guideBtn('people')}</h3>`
    if (note !== '') h += `<div class="banner bad">${tx(note)}</div>`
    const placed = settles.find((o) => o.kind === 'place')
    h += `<div class="btns btnq"><button class="btn pri home wide${placed !== undefined ? ' on' : ''}" data-act="pl-open">${icon('unit-porters')}백성 배치${placed !== undefined ? ' · 이번 계절 나누었다' : ''}</button>${guideBtn('place')}</div>`
    const ps = partiesOf(r, me())
    const wilds = foundLands(r).filter((to) => !(r.nodes[to]?.owner === me() && (r.nodes[to]?.hh ?? 0) > 0))
    if (ps.length > 0 || wilds.length > 0) {
      h += `<h4 class="sech home">${icon('unit-porters')}개척단</h4>`
      if (ps.length === 0) h += `<p class="mute">지도에서 깜빡이는 「＋마을」을 누른다</p>`
    }
    for (const p of partiesOf(realm!, me()).filter((x) => joining(x.id))) {
      h += `<div class="row mvq"><button class="pprow" data-act="ptjoin" data-army="${p.id}">${icon('unit-porters', 'gic')}<span class="nchip">${esc(r.nodes[p.home]?.name ?? '')} 개척단</span><span class="mute">백성 ${p.hh}가구 · ${esc(josa(r.nodes[p.at]?.name ?? '', '에', '에'))} 자리 잡는다 · 누르면 거둔다</span></button></div>`
    }
    for (const p of ps) {
      const where = p.march !== null ? `${esc(josa(r.nodes[p.march.to]?.name ?? '', '으로', '로'))} 간다` : `${esc(r.nodes[p.at]?.name ?? '')}에 섰다 · 갈 곳을 고른다`
      h += `<div class="row mvq"><button class="pprow" data-act="ptok" data-army="${p.id}">${icon('unit-porters', 'gic')}<span class="nchip">${esc(r.nodes[p.home]?.name ?? '')} 개척단</span><span class="mute">백성 ${p.hh}가구 · ${where}</span></button></div>`
    }
    const lands = [...new Set([...foundLands(r), ...ps.flatMap((p) => (p.march !== null && foundable(r, me(), p.march.to) ? [p.march.to] : []))])].sort()
    if (lands.length > 0) {
      h += `<h4 id="sec-settle" class="sech home">${icon('settle-hamlet')}개척할 수 있는 땅</h4>`
      h += lands.map((to) => settleCard(r, to)).join('')
    }
    const auto = autoFlows(r, me())
    if (auto.length > 0) {
      h += `<h4 class="sech home">${icon('unit-porters')}붐벼서 저절로 옮겨 가는 백성</h4>`
      for (const x of auto) h += `<div class="row mvq">${flowPair(r, x.from, x.to)}<span class="mute">${x.n}가구</span></div>`
    }
    return h
  }

  /**
   * 백성 배치 (사민 徙民) — 양동이에 물 나누듯 (형 10-23). 고을 카드마다 −/+ 로 집을 떼어 「모아 둔 백성」에 담고,
   * 다른 고을에 붓는다. 모아 둔 백성이 남아 있으면 못 정한다. 한 계절에 나라 가호의 placeShare 까지 · 옮긴 집마다 곡식.
   */
  function placeSheet(): string {
    const base = realm!
    const ids = placeNodes(base, me())
    const step = P.realm.placeStep
    const d = (id: string): number => placeDraft[id] ?? 0
    const pool = -ids.reduce((s, id) => s + d(id), 0)
    const out = ids.reduce((s, id) => s + Math.max(0, -d(id)), 0)
    const lim = placeLimit(base, me())
    let h = `<button class="btn ghost sm hback" data-act="tab" data-tab="people">‹ 백성</button>`
    h += `<h3 class="sech home">${icon('unit-porters')}백성 배치 <small class="mute">옛말로 사민</small> ${guideBtn('place')}</h3>`
    h += `<div class="plpool${pool > 0 ? ' full' : ''}"><span>모아 둔 백성</span><b>${pool}가구</b><small>이번 계절 ${out} / ${lim}가구 옮김${out > 0 ? ` ${costHtml({ grain: Math.ceil(out * P.realm.migrateGrain) })}` : ''}</small></div>`
    for (const id of ids) {
      const n = base.nodes[id]!
      const room = homeRoom(n)
      const now = n.hh + d(id)
      const cap = base.factions[me()]?.capital === id
      const land = isRiverside(base, id) ? `<span class="pltag rv">강가 논 · 쌀 +${Math.round(P.realm.riverRice * 100)}%</span>` : landMul(base, id) < 1 ? `<span class="pltag hl">높은 터 · 쌀 −${Math.round(P.realm.hillRice * 100)}%</span>` : ''
      // 이만큼 살면 나는 것 — 쌀(내년 봄 심는 집 기준)과 특산
      const pr = { ...base, nodes: { ...base.nodes, [id]: { ...n, hh: now } } }
      const y = nodeYield(pr, id, 'summer')
      const rice = Math.round(now * P.realm.harvestPerHH * fieldMul(base, id))
      const goods = (['iron', 'salt', 'wood', 'horse'] as const).filter((g) => (y[g] ?? 0) > 0)
      const yl = `${icon('good-rice', 'gic')}쌀 ${rice}${goods.map((g) => ` · ${icon(GOOD_ICON[g], 'gic')}${GOOD_NAME[g]} ${y[g]}`).join('')}`
      const kSub = placeStepOf(id, false)
      const kAdd = placeStepOf(id, true)
      const dd = d(id)
      h += `<div class="plcard${dd !== 0 ? (dd > 0 ? ' up' : ' down') : ''}"><div class="plch"><b>${esc(n.name)}</b><span class="mute">${cap ? '도읍' : NODE_KIND_NAME[n.kind]}</span>${land}</div>`
        + `<div class="plrow"><button class="btn sm" data-act="pl-sub" data-node="${id}" ${kSub > 0 ? '' : 'disabled'}>−${kSub > 0 ? kSub : step}</button>`
        + `<div class="plmid"><b>${now.toLocaleString('ko-KR')}가구${dd !== 0 ? ` <i>${dd > 0 ? '+' : ''}${dd}</i>` : ''}</b><span class="plbar"><i style="width:${Math.min(100, Math.round((now / Math.max(1, room)) * 100))}%"></i></span><small>품 ${room.toLocaleString('ko-KR')} · ${yl} <small>계절마다 · 쌀은 한 해</small></small></div>`
        + `<button class="btn sm" data-act="pl-add" data-node="${id}" ${kAdd > 0 ? '' : 'disabled'}>+${kAdd > 0 ? kAdd : step}</button></div></div>`
    }
    // 우리 고을인데 못 옮기는 곳 — 말없이 빠지면 버그처럼 보인다. 흐리게 두고 까닭을 (형 10-24: "개마들머리 점령했는데 인구 이동에 없다")
    const cap = base.factions[me()]?.capital
    for (const n of sorted(Object.values(base.nodes)).filter((x) => x.owner === me() && x.kind !== 'sodo' && !ids.includes(x.id) && (x.kind !== 'wild' || x.hh > 0 || (x.room ?? 0) > 0))) {
      const why = cap !== undefined && migratePath(base, me(), cap, n.id, true) !== null ? '고갯길·물길이 이 철엔 막혀 못 오간다' : '도읍에서 우리 땅만 밟고는 닿지 않는다. 사이에 남의 땅이 있다'
      h += `<div class="plcard off"><div class="plch"><b>${esc(n.name)}</b><span class="mute">${NODE_KIND_NAME[n.kind]}</span></div><p class="mute">${why}</p></div>`
    }
    const moved = ids.some((id) => d(id) !== 0)
    h += `<div class="btns plfoot"><button class="btn ghost" data-act="pl-reset" ${moved ? '' : 'disabled'}>처음대로</button>`
      + `<button class="btn pri home" data-act="pl-ok" ${pool === 0 && out > 0 ? '' : 'disabled'}>${pool > 0 ? `모아 둔 백성 ${pool}가구를 먼저 나눈다` : '이대로 나눈다'}</button></div>`
    return h
  }

  /**
   * 빈땅 하나 — 생산품 · 「골포에서 개척단 보내기」 큰 단추 하나 (맞닿은 우리 고을에서 꾸려 바로 이 길로).
   * 이 땅으로 가는 개척단이 있으면 그것을 고르는 단추
   */
  function settleCard(r: Realm, to: string): string {
    const n = r.nodes[to]!
    const gains = nodeSpecials(r, to).map((g) => `${icon(GOOD_ICON[g], 'gic')}${GOOD_NAME[g]}`)
    let h = `<div class="ncard settlec" id="stl-${to}"><div class="an">${icon(nodeIcon(n), 'nic')}<b>${esc(n.name)}</b></div>`
    if (gains.length > 0) h += `<p class="gain">생산품 · ${gains.join(' ')}</p>`
    const going = partiesOf(r, me()).find((p) => p.march?.to === to)
    if (going !== undefined) return h + `<button class="btn home wide stlgo on" data-act="ptok" data-army="${going.id}" data-node="${to}">${esc(r.nodes[going.home]?.name ?? '')} 개척단이 간다 · 백성 ${going.hh}가구</button></div>`
    const src = partySource(r, to)
    if (src === null) return h + `<p class="mute">맞닿은 우리 고을에서 개척단을 꾸릴 수 없다. 백성·곡식·나무가 모자라거나 길이 막혔다</p></div>`
    const k = partySize(r, me(), src.from)
    const c = partyCost(k)
    h += `<button class="btn pri home wide stlgo" data-act="party-to" data-node="${to}" data-from="${src.from}" data-edge="${src.edge}">${esc(r.nodes[src.from]?.name ?? '')}에서 개척단 보내기${settleRec(r) === to ? REC_ST : ''}</button>`
    return h + `<p class="mute">백성 ${k}가구 ${costHtml({ grain: c.grain, wood: c.wood })}</p></div>`
  }

  /**
   * 사건 카드 — 이번 계절 우리에게 온 일 (events.ts · 림월드 스토리텔러). 선택 둘, 고르지 않으면 첫째.
   * 보고판 꼬리와 나라 판 맨 위에 같은 카드
   */
  function cardHtml(r: Realm): string {
    const c = r.card
    if (c === undefined || c === null || c.season !== r.season || r.outcome) return ''
    const info = cardInfo(c)
    // 쫓겨 온 사람 — 아직 우리 장수가 아니라 떠돌이 명단에서 (뽑을 때 정해 둔 사람)
    const guest = c.kind === 'exile' && c.guest !== undefined ? HERO_POOL.find((h) => h.id === c.guest) : undefined
    const sub = (s: string): string => s.replaceAll('{a}', r.heroes[c.hero ?? '']?.name ?? '').replaceAll('{b}', r.heroes[c.hero2 ?? '']?.name ?? '').replaceAll('{n}', r.nodes[c.node ?? '']?.name ?? '')
      .replaceAll('{g}', guest?.name ?? '').replaceAll('{f}', r.factions[c.from ?? '']?.name ?? '')
    const ans = answers[`card:${c.season}`]
    const pick = ans === undefined ? null : answers[`hush:${c.season}`] === true ? 2 : ans ? 0 : 1
    // 자막처럼 — 두 줄씩, 누르면 다음 장. 다 보면 한 줄 물음과 짧은 답 둘 (형 10-27 지인: "성세천하처럼 자막 두 줄 · 질문 한 줄 · 선택지 세 마디")
    // 사람이 나오는 사건은 누가 나오나(말투·성별·사이)에 따라 자막과 그림을 고른다 (card-lines.ts)
    const qa = c.kind === 'quarrel' || c.kind === 'romance' ? r.heroes[c.hero ?? ''] : undefined
    const qb = c.kind === 'quarrel' || c.kind === 'romance' ? r.heroes[c.hero2 ?? ''] : undefined
    const two = qa !== undefined && qb !== undefined
    const q = c.kind === 'quarrel' && two ? quarrelArt(info.art, qa, qb)
      : c.kind === 'romance' && qa !== undefined ? { art: info.art, flip: romanceFlip(qa) }
        : guest !== undefined ? { art: exileArt(info.art, guest), flip: false } : { art: info.art, flip: false }
    const img = `<img class="cimg${q.flip ? ' flip' : ''}" src="${ART}event/${q.art}.jpg" alt="">`
    const beats = (c.kind === 'quarrel' && two ? quarrelBeats(r, c, qa, qb)
      : c.kind === 'romance' && two ? romanceBeats(r, c, qa, qb)
        : guest !== undefined ? exileBeats(r, c, guest)
          : c.kind === 'fugitive' ? fugitiveBeats(r, c) ?? info.beats : info.beats).map(sub)
    const at = pick !== null ? beats.length : Math.min(cardBeat[`card:${c.season}`] ?? 0, beats.length)
    // 장수의 말은 왼쪽에 작은 둥근 얼굴과 이름, 오른쪽에 말 (형 10-29)
    const beatHtml = (b: string): string => {
      const say = sayOfBeat(b)
      const who = say !== null ? r.heroes[say.hero] ?? HERO_POOL.find((x) => x.id === say.hero) : undefined
      if (say === null || who === undefined) return `<p class="csub" aria-live="polite">${esc(b)}</p>`
      return `<div class="csub csay" aria-live="polite"><span class="cwho">${bust(who, 'cwf')}<small>${esc(who.name)}</small></span><span class="cline">${esc(say.line)}</span></div>`
    }
    if (at < beats.length) {
      return `<div class="cardc story${info.bad ? ' bad' : ''}" data-act="card-beat">${img}<div class="cb"><b>${icon(info.icon, 'cic')}${esc(info.name)}</b>`
        + beatHtml(beats[at]!) + `<div class="cnav"><small>${at + 1}/${beats.length} · 누르면 다음 ›</small><button class="cskip" data-act="card-skip">건너뛰기 »</button></div></div></div>`
    }
    // 쫓겨 온 사람은 받기 전에 누구인지 — 얼굴 · 이름 · 특성
    // 연정 소문은 두 사람 얼굴을 나란히 — 탭탭 넘기다 와도 누가 누구인지 (형 10-29: "누가 누구랑 뭔 일 있는지 전혀 모른다")
    const who0 = guest !== undefined ? `<div class="cguest">${bust(guest, 'cof')}<span><b>${esc(guest.name)}</b><span class="wtr">${traitChips(guest, true)}</span></span></div>`
      : c.kind === 'romance' && qa !== undefined && qb !== undefined ? `<div class="cguest">${bust(qa, 'cof')}<b>${esc(qa.name)}</b><span class="cheart">♥</span>${bust(qb, 'cof')}<b>${esc(qb.name)}</b></div>` : ''
    let h = `<div class="cardc${info.bad ? ' bad' : ''}${info.opts.length > 2 ? ' n3' : ''}">${img}<div class="cb"><b>${icon(info.icon, 'cic')}${esc(info.name)}</b>${who0}<p class="cask">${esc(sub(info.ask))}</p><div class="copts">`
    // 고르지 않았을 때 걸리는 답 — 엔진(events.resolveCard)과 같게: 망명자는 둘째(돌려보낸다) · 장수 다툼은 침묵
    const fallback = cardFallback(c.kind)
    info.opts.forEach((o, i) => {
      // 그 답이 어느 장수 쪽인지 — 답 이름에 먼저 나오는 장수의 얼굴을 곁에 (형 10-25: "누구 편 든다 할 때 장수들 얼굴 이미지도 있어야")
      const ia = o.name.indexOf('{a}')
      const ib = o.name.indexOf('{b}')
      const who = ia >= 0 && (ib < 0 || ia < ib) ? c.hero : ib >= 0 ? c.hero2 : undefined
      const face = who != null && r.heroes[who] !== undefined ? bust(r.heroes[who], 'cof') : guest !== undefined && i === 0 ? bust(guest, 'cof') : ''
      // 얻고 잃는 것 — 아이콘·숫자로. 굴리는 답이면 % 와 「이루면 · 어긋나면」 (ODDS: 사건 카드의 답은 % + 갈래마다 아이콘·숫자)
      const pv = cardPreview(r, c, i === 2 ? 2 : i === 0 ? 0 : 1, left())
      let fx = ''
      if (pv !== null) {
        const sure = fxHtml(r, pv.sure)
        if (pv.chance === undefined) fx = `<span class="cfx">${sure}</span>`
        else {
          if (!sure.includes('cnone')) fx += `<span class="cfx">${sure}</span>`
          fx += `<span class="codd">${chanceFeel(pv.chance)}</span>`
          fx += `<span class="cfx"><small>이루면</small>${fxHtml(r, pv.win ?? {})}</span><span class="cfx"><small>어긋나면</small>${fxHtml(r, pv.lose ?? {})}</span>`
        }
      }
      // 답은 이름 한 마디 + 얻고 잃는 그림 — 긴 뜻은 길게 누르면 (data-tip)
      h += `<button class="copt${pick === i ? ' on' : ''}${face !== '' ? ' hasf' : ''}" data-act="card-pick" data-v="${i}" data-tip="${esc(sub(o.does))}">${face}<span class="cot"><b>${esc(sub(o.name))}</b>${fx}${i === fallback && pick === null ? '<i>고르지 않으면 이것</i>' : ''}</span></button>`
    })
    return h + `</div></div></div>`
  }

  // ───────── 남의 나라가 걸어온 청 · 다가오는 적 (형: "적이 뭔가 거래를 걸어온다거나 동맹요구하거나 · 기습에 대비하거나 경계를 강화하거나")
  /** 이번 계절 아직 안 고른 것 — 사건 카드 · 답하지 않은 사신의 청 */
  function repTodo(): number {
    const r = realm!
    // 배우는 판도 화면 가득 — 고리는 고를 단추를 가리킨다 (tutorial DISMISS) (형 10-25: "조공요구도 해적도 거래요청도 다 화면의 대빵 크게")
    const c = r.card
    const card = c !== undefined && c !== null && c.season === r.season && !r.outcome && answers[`card:${c.season}`] === undefined ? 1 : 0
    return card + openAsks(r, me()).filter((a) => answers[a.id] === undefined).length + wandArrivals().filter((w) => answers[wandKey(w.hero.id)] === undefined).length
  }

  /** 이번 계절 우리 고을에 막 닿은 떠돌이 — 들일지 정할 것 (형 10-25: "빨간 불은 들어오는데 방랑 장수 이벤트가 안 생기네") */
  function wandArrivals(): Array<{ hero: Hero; node: string; until: number; price: number }> {
    const r = realm!
    if (report === null || r.outcome) return []
    const came = new Set(report.lines.flatMap((l) => (l.kind === 'wanderer' ? [l.hero] : [])))
    return wanderersFor(r, me()).filter((w) => came.has(w.hero.id))
  }
  const wandKey = (id: string): string => `wand:${id}:${realm!.season}`

  /** 떠돌이 한 사람 — 들인다 · 나중에 (사건 카드 꼴 · 화면 가득일 때 크게) */
  function wandCard(w: { hero: Hero; node: string; until: number; price: number }): string {
    const r = realm!
    const ans = answers[wandKey(w.hero.id)]
    const can = left().grain >= w.price || heroOrders.some((o) => o.kind === 'hire' && o.hero === w.hero.id)
    const stay = Math.max(0, w.until - r.season)
    return `<div class="cardc wandc"><img class="cimg" src="${ART}event/event-wanderer-arrives.jpg" alt=""><div class="cb"><b>떠돌이 인재가 왔다</b>`
      + `<p>${esc(`${josa(w.hero.name, '이', '가')} ${r.nodes[w.node]?.name ?? ''}에 머문다`)}</p><div class="wtr">${traitChips(w.hero, true)}</div><div class="copts">`
      + `<button class="copt hasf${ans === true ? ' on' : ''}" data-act="wand-pick" data-id="${w.hero.id}" data-v="1" ${can ? '' : 'disabled'}>${bust(w.hero, 'cof')}<span class="cot"><b>들인다</b><span>${can ? costHtml({ grain: w.price }) : `곡식이 모자란다 ${costHtml({ grain: w.price })}`}</span></span></button>`
      + `<button class="copt${ans === false ? ' on' : ''}" data-act="wand-pick" data-id="${w.hero.id}" data-v="0"><span class="cot"><b>나중에 정한다</b><span>${stay}계절 안에 떠난다 · 장수 탭에서 들일 수 있다</span></span></button>`
      + `</div></div></div>`
  }

  /** 우리와 그 나라의 사이 한 칩 — 전쟁 · 속국(우리를 섬김) · 섬김(우리가 바침) · 동맹 · 화친 · 아무 사이 아님 (형 10-27: "타국이 말 거는 이벤트 뜰 때 이 나라랑 관계도 탈 옆에") */
  function relChipHtml(r: Realm, f: string): string {
    const rel = relationOf(r, me(), f)
    const v = rel.vassal !== undefined && rel.vassal.until >= r.season ? rel.vassal.lord : null
    if (rel.state === 'war') return '<span class="rel war">전쟁</span>'
    if (v === me()) return '<span class="rel ally">속국</span>'
    if (v === f) return '<span class="rel truce">섬김</span>'
    if (rel.state === 'ally') return '<span class="rel ally">동맹</span>'
    if (rel.state === 'truce') return '<span class="rel truce">화친</span>'
    return '<span class="rel neutral">아무 사이 아님</span>'
  }

  function askCard(a: ReturnType<typeof openAsks>[number]): string {
    const lead = realm!.heroes[realm!.factions[a.from]?.ruler ?? rulerId(a.from)]
    const ans = answers[a.id]
    // 청마다 그림 — 화면 가득일 때 크게 (무슨 청인지 그림 · 누가 보냈는지 얼굴)
    let h = `<div class="askc ${a.kind === 'demand' ? 'threat' : ''}"><div class="aqh">${icon(`ask-${a.kind === 'demand' ? 'tribute' : a.kind}`, 'aqi')}<b>사신의 청 · ${esc(ASK_KIND_NAME[a.kind])}</b></div><div class="an">${bust(lead, 'rface')}<div class="fn"><b>${emblem(a.from, 'fem')}${esc(realm!.factions[a.from]?.name ?? '')}</b>`
    h += `<span class="mute">${esc(lead?.name ?? '')}</span></div>${moodImg(ART, moodOf(realm!, me(), a.from).mood, 'mood fmood')}${relChipHtml(realm!, a.from)}</div><p>${esc(askLine(a, realm!.factions[a.from]?.name ?? '', a.node !== undefined ? (realm!.nodes[a.node]?.name ?? '') : ''))}</p>`
    if (a.why !== undefined && readsMind(realm!, a.from)) h += heardHtml(realm!, a.from, `저들이 이 청을 낸 까닭은 이렇습니다. ${whyLine(a.why, a.about !== undefined ? (realm!.factions[a.about]?.name ?? '') : '')}`)
    h += `<div class="btns"><button class="btn ${ans === true ? 'on' : ''}" data-act="answer" data-id="${a.id}" data-yes="1">받는다</button>`
    h += `<button class="btn ${ans === false ? 'on' : ''}" data-act="answer" data-id="${a.id}" data-yes="0">거절한다</button>`
    if (ans === undefined) h += `<span class="mute">답하지 않으면 거절</span>`
    return h + `</div></div>`
  }

  /**
   * 알현 — 청을 건 나라의 군장이 화면 가득 들어와 제 입으로 말한다 (형 10-25: "동맹·화친·조공 때 문명에서는 애니메이션이나 대사가 다이나믹하게 오거든")
   * 대청 배경 → 군장이 미끄러져 들어오고 → 이름·탈(마음) → 말이 한 자씩 → 무엇을 청하나 → 받는다·거절한다(얻고 잃는 것은 아이콘+숫자)
   */
  function audienceHtml(a: ReturnType<typeof openAsks>[number]): string {
    const r = realm!
    const f = r.factions[a.from]
    const lead = r.heroes[f?.ruler ?? rulerId(a.from)]
    const ans = answers[a.id]
    const threat = a.kind === 'demand'
    const md = moodOf(r, me(), a.from)
    // 군장의 말 — 그 군장 목소리 결 × 나라 성향 (chief-lines.ts) · 말이 찍히기 시작할 때 제 목소리로 (형 10-26)
    const say = askSay(a.kind, f?.mind, lead !== undefined ? voiceKind(lead, true) : 'm-elder', lead !== undefined ? chiefCastOf(lead) : 'a')
    if (!bigSounded.has(`aud:${a.id}`)) {
      bigSounded.add(`aud:${a.id}`)
      window.setTimeout(() => ding(snd(threat ? 'war_drum' : 'envoy'), 0.5), 200)
      if (lead !== undefined) window.setTimeout(() => { if (document.querySelector('.ap .aud') !== null && voiceGate(performance.now())) ding(say.voice, P.realm.voiceVol) }, P.realm.chiefVoiceMs)
    }
    const face = bustHd(lead, 'audlord') || bust(lead, 'audlord')
    const what = askLine(a, f?.name ?? '', a.node !== undefined ? (r.nodes[a.node]?.name ?? '') : '')
    const why = a.why !== undefined && readsMind(r, a.from) ? ` · <span class="mute">${esc(`속셈: ${whyLine(a.why, a.about !== undefined ? (r.factions[a.about]?.name ?? '') : '')}`)}</span>` : ''
    // 받으면 오가는 것 — 저쪽이 주는 것은 ▲, 우리가 내는 것은 ▼
    const swap = `${gainHtml(a.give)}${costHtml(a.take)}`
    let h = `<div class="aud${threat ? ' threat' : ''}"><i class="audbg" style="background-image:url('${ART}event/event-court-hall.jpg')"></i>${face}`
    h += `<div class="audtop">${icon(`ask-${threat ? 'tribute' : a.kind}`, 'aqi')}<b>사신의 청 · ${esc(ASK_KIND_NAME[a.kind])}</b></div>`
    h += `<div class="audname">${emblem(a.from, 'fem')}<b>${esc(f?.name ?? '')}</b><span>${esc(lead?.name ?? '')}</span>${moodImg(ART, md.mood)}${relChipHtml(r, a.from)}</div>`
    h += `<div class="audsay">${typed(say.text, esc)}</div>`
    h += `<div class="audwhat">${esc(what)}${why}</div>`
    h += `<div class="audbtns"><button class="btn${ans === true ? ' on' : ''}" data-act="answer" data-id="${a.id}" data-yes="1"><b>받는다</b>${swap !== '' ? `<small>${swap}</small>` : ''}</button>`
    h += `<button class="btn ghost${ans === false ? ' on' : ''}" data-act="answer" data-id="${a.id}" data-yes="0"><b>거절한다</b><small>${threat ? '전쟁이 된다' : '사이가 조금 식는다'}</small></button></div></div>`
    return h
  }

  function asksHtml(): string {
    const asks = openAsks(realm!, me())
    if (asks.length === 0) return ''
    return `<h4>사신이 왔다 · 이번 계절 안에 답한다</h4>` + asks.map(askCard).join('')
  }

  /** 우리 고을로 오는 적 — 보인 행군마다 경계 강화 단추 */
  function threatsHtml(r: Realm): string {
    const foes = seenMarches(realm!, me()).filter((a) => a.march !== null && realm!.nodes[a.march.to]?.owner === me())
    if (foes.length === 0) return ''
    const suspect = new Set((report?.lines ?? []).filter((l) => l.kind === 'sighted' && l.suspect === true).map((l) => (l as { army: string }).army))
    let h = `<h4>다가오는 적</h4>`
    for (const a of foes) {
      const to = a.march!.to
      const on = guards.includes(to)
      const can = on || (canGuard(r, me(), to) && left().grain >= guardCost().grain)
      h += `<div class="row foerow">${emblem(a.faction)}<span class="fet">${esc(realm!.factions[a.faction]?.name ?? '')} → <b>${esc(realm!.nodes[to]?.name ?? '')}</b> · ${a.march!.left}계절${suspect.has(a.id) ? ' · <span class="sus">몰래 오는 낌새</span>' : ''}</span>`
      h += `<button class="btn sm ${on ? 'on' : ''}" data-act="guard" data-node="${to}" ${can ? '' : 'disabled'}>경계 강화 ${costHtml({ grain: guardCost().grain })}</button></div>`
    }
    return h
  }

  // ───────── 소도
  /**
   * 소도의 제사 (형: "소도는 왜있는거고?") — 씨 뿌린 봄과 거둔 가을에 귀신에게 제사한다 (삼한 사료).
   * 소도와 맞닿은 고을을 쥔 나라만 지낸다 — 그래서 소도 곁 땅이 다툴 거리가 된다. 소도 안의 군대는 아무도 못 친다.
   */
  function riteCard(r: Realm): string {
    const season = seasonOf(r.season)
    let h = `<p class="story">천군이 지키는 성스러운 땅이다. 칼을 들고 들어가 싸울 수 없다. 여기 머무는 군대는 아무도 못 친다.</p>`
    const rc = riteCost(r, me(), season)
    h += `<div class="ncard"><div class="an">${icon('status-good-omen', 'nic')}<b>제사</b><span class="mute">봄·가을에 한 번</span></div>`
    h += `<div class="mute">소도와 맞닿은 고을을 차지해야 지낸다.</div>`
    // 무엇을 내고 무엇을 얻는지 단추에 그림과 함께 (형: "제사지낼때 무슨손실나는지 버튼에 아예 보이게 만들어. 이미지 함께")
    const st = left()
    const short = !rite && (st.grain < rc.grain || st.iron < rc.iron)
    const cost = `<span class="cost"><span>${icon('good-rice')}곡식 −${rc.grain}${st.grain < rc.grain && !rite ? ' <i class="short">모자라다</i>' : ''}</span>${rc.iron > 0 ? `<span>${icon('treasure-iron-ingots')}철 −${rc.iron}${st.iron < rc.iron && !rite ? ' <i class="short">모자라다</i>' : ''}</span>` : ''}</span>`
    const gain = season === 'spring' ? '그해 가을 수확량이 늘어난다' : '모든 군대의 사기가 오른다'
    const label = season === 'spring' ? '봄 제사를 지낸다' : '가을 제사를 지낸다'
    if (season !== 'spring' && season !== 'autumn') h += `<div class="mute">지금은 제사철이 아니다. 봄과 가을에 지낸다.</div>`
    else if (!rite && !riteAllowed(r, me())) h += `<div class="mute">지금은 지낼 수 없다. 소도 곁 고을이 없거나 곡식이 모자라다.</div>${cost}`
    else h += `<div class="btns"><button class="btn ${rite ? 'on' : ''} wide ritebtn" data-act="rite" ${short ? 'disabled' : ''}><b>${rite ? `${label} · 누르면 거둔다` : label}</b>${cost}<span class="gain">${gain}</span></button></div>`
    return h + `</div>`
  }

  // ───────── 외교
  /**
   * 외교의 손 (VICTORY §2-2) — 이번 계절 보낼 사람: 군장의 사자 + 쉬는 장수. 사신·공작 하나에 한 사람.
   * 다 나가면 사신·공작 단추가 꺼진다 (handsFull)
   */
  function handsCap(r: Realm): number {
    return handsOf(r, me())
  }
  /** 사자·쉬는 장수가 나르는 수 — 고을지기가 몸소 가는 것은 빼고 센다 (hands.ownHand · 엔진 limitHands 와 같은 셈) */
  function handsUsed(): number {
    const all = Object.keys(envoys).length + plots.length
    return realm === null ? all : all - ownHandsIn(realm, [...Object.values(envoys), ...plots], me())
  }
  /** 사자·쉬는 장수가 다 나갔다 — 「사자」·「알아서」·「고용 자객」·쉬는 장수는 더 못 보낸다 (고을지기는 몸소 갈 수 있다) */
  function handsFull(r: Realm): boolean {
    return handsUsed() >= handsCap(r)
  }
  /** 이번 계절 아직 안 보낸, 몸소 갈 수 있는 고을지기 */
  function freeGovernors(r: Realm): string[] {
    return sorted(Object.values(r.heroes)).filter((x) => ownHand(r, me(), x.id) && heroBusy(r, x.id) === null).map((x) => x.id)
  }
  /** 보낼 사람이 아무도 없다 — 사자·쉬는 장수도 다 나갔고 몸소 갈 고을지기도 없다. 그때만 사신·공작 단추를 끈다 */
  function handsOut(r: Realm): boolean {
    return handsFull(r) && freeGovernors(r).length === 0
  }
  /** 이 장수를 지금 사신·공작에 보낼 수 있나 — 고을지기는 늘(제 몸이 손), 나머지는 사자·쉬는 장수 몫이 남았을 때 */
  function handFor(r: Realm, id: string): boolean {
    return id !== '' && ownHand(r, me(), id) ? true : !handsFull(r)
  }
  /** 이 장수에게 일을 주면 사신·공작 손이 모자라 빠진다 — 일 없는 장수이고 손이 다 찼다 */
  function handLocked(r: Realm, id: string): boolean {
    return idleHeroes(r, me()).includes(id) && handsUsed() >= handsCap(r)
  }
  function handsHtml(r: Realm): string {
    const cap = handsCap(r)
    const used = handsUsed()
    const idle = idleHeroes(r, me())
    // 몸소 가는 고을지기 — 제 얼굴 칸을 더한다 (보낼 사람 수는 안 깎는다)
    const govs = [...new Set([...Object.values(envoys).map((e) => e.hero), ...plots.map((o) => (o.kind === 'plot' ? o.agent : undefined))]
      .filter((id): id is string => id !== undefined && ownHand(r, me(), id)))].sort()
    // 얼굴마다 맡은 일 — 이름 붙은 일(사신 따라간 장수 · 자객)은 그 얼굴에, 이름 없는 일은 사자부터 차례로
    const slots: Array<{ face: string; id?: string; job?: string; gov?: boolean }> = [{ face: icon('unit-scouts', 'hface msgr') }, ...idle.map((id) => ({ face: bust(r.heroes[id], 'hface'), id })), ...govs.map((id) => ({ face: bust(r.heroes[id], 'hface'), id, gov: true }))]
    const fn = (f: string): string => r.factions[f]?.name ?? ''
    const loose: string[] = []
    for (const e of Object.values(envoys)) {
      const job = `${fn(e.to)} ${ASK_NAME[e.ask as Ask] ?? '사신'}`
      const s = e.hero !== undefined ? slots.find((x) => x.id === e.hero && x.job === undefined) : undefined
      if (s !== undefined) s.job = job
      else loose.push(job)
    }
    for (const o of plots) {
      if (o.kind !== 'plot') continue
      const job = o.op === 'assassin' ? '자객' : `${PLOT_NAME[o.op]}`
      const s = o.agent !== undefined ? slots.find((x) => x.id === o.agent && x.job === undefined) : undefined
      if (s !== undefined) s.job = job
      else loose.push(job)
    }
    for (const job of loose) { const s = slots.find((x) => x.job === undefined); if (s !== undefined) s.job = job }
    let h = `<div class="hands"><div class="hf">${slots.map((s) => `<span class="${s.job !== undefined ? 'used' : ''}">${s.face}<small>${s.job !== undefined ? esc(s.job) : s.id === undefined ? '보낼 수 있다' : '쉰다'}</small>${s.gov === true ? '<i class="gvtag">고을 맡음</i>' : ''}</span>`).join('')}</div>`
    h += `<div class="ht"><b>이번 계절 보낼 사람 ${Math.min(used, cap)}/${cap}${govs.length > 0 ? ` · 고을지기 ${govs.length}` : ''}</b></div></div>`
    if (used >= cap) h += `<div class="banner ${freeGovernors(r).length > 0 ? '' : 'bad'}">${tx(freeGovernors(r).length > 0 ? '사자와 쉬는 장수는 다 나갔다. 고을을 맡은 장수는 몸소 보낼 수 있다. 그 계절엔 고을을 비운다.' : '보낼 사람이 다 나갔다. 장수를 군대에서 빼서 쉬게 하면 더 보낼 수 있다.')}</div>`
    return h
  }

  /** 함께 칠 곳 · 빌린 군대가 지킬 곳 (형: "어딜치자고 한건지도 좀 같이 말해줘라") */
  function envoyWhere(r: Realm, e: Extract<Order, { kind: 'envoy' }>): string {
    const n = e.target !== undefined ? r.nodes[e.target] : undefined
    if (n === undefined) return ''
    const owner = n.owner !== null ? r.factions[n.owner]?.name : undefined
    return `: ${esc(owner !== undefined && n.owner !== me() ? `${owner}의 ` : '')}${esc(e.ask === 'joint' ? `${josa(n.name, '을', '를')} 함께 친다` : `${n.name} 지키기`)}`
  }

  function diploSheet(r: Realm): string {
    let h = `<h3 class="qh">외교 ${guideBtn(diploMode)}</h3><div class="seg dseg"><button class="${diploMode === 'envoy' ? 'on' : ''}" data-act="dmode" data-v="envoy">사신</button><button class="${diploMode === 'plot' ? 'on' : ''}" data-act="dmode" data-v="plot">공작 ${plots.length > 0 ? plots.length : ''}</button><button class="${diploMode === 'scout' ? 'on' : ''}" data-act="dmode" data-v="scout">정찰${scout !== '' ? ' 1' : ''}</button></div>`
    // 정찰은 사람 손을 안 쓴다 — 장수 얼굴 줄 대신 정찰꾼 그림 (형 10-23: "정찰에는 장수 얼굴을 보여 줄 필요 없으니 정찰꾼 그래픽")
    if (diploMode === 'scout') return h + `<div class="scouthd">${icon('unit-scouts', 'scic')}<div><b>정찰꾼</b><span>한 계절에 한 곳 · 장수는 안 간다</span></div></div>` + scoutSheet(r)
    h += handsHtml(r)
    if (diploMode === 'plot') return h + plotSheet(r)
    h += asksHtml()
    const out = Object.values(envoys)
    for (const e of out) h += sentBanner(r, e, true)
    // 맺으면 뭐가 되는지는 ? 안에 (GUIDE.envoy — 형 10-23: "탭마다 있는 설명 고봉밥들은 전부 다 물음표에")
    // 앞서가는 나라 — 모두 이기려 하니, 앞선 나라는 다른 나라들이 함께 막으려 한다 (stance.leaderOf)
    const L = leaderOf(r, me())
    if (L === me()) h += `<div class="banner bad">우리가 앞서간다. 다른 나라들이 손을 잡고, 맺은 약조도 깨고 등을 돌릴 수 있다.</div>`
    else if (L !== null) h += `<div class="banner">앞서가는 나라: ${emblem(L, 'fem')}<b>${esc(r.factions[L]?.name ?? '')}</b> · 다른 나라들이 함께 막으려 한다. 손잡을 때다.</div>`
    // 지금 벌어진 전쟁 — 아는 나라끼리 (형: "누구랑 누가 전쟁나면 그걸 좀 잘 보여줬음")
    const live = sorted(Object.values(r.factions)).filter((x) => x.id !== me() && knows(r, me(), x.id) && Object.values(r.nodes).some((n) => n.owner === x.id))
    const wars: string[] = []
    for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
      if (relationOf(r, live[i]!.id, live[j]!.id).state === 'war') wars.push(`<div class="warbar">${emblem(live[i]!.id, 'fem')}<i>⚔</i>${emblem(live[j]!.id, 'fem')}<span>${tx(`${live[i]!.name} · ${live[j]!.name}`)}</span></div>`)
    }
    if (wars.length > 0) h += `<h4>지금 싸우는 나라들</h4>${wars.join('')}`
    // 땅이 하나도 없는 나라(무너진 나라)는 사신을 받을 곳이 없다 — 맨 아래에 이름만 (형: "지도에없는나라인데 상호작용까지 아직도 가능")
    const hasLand = (f: string): boolean => Object.values(r.nodes).some((n) => n.owner === f)
    const gone = sorted(Object.values(r.factions)).filter((x) => x.id !== me() && knows(r, me(), x.id) && !hasLand(x.id))
    for (const f of sorted(Object.values(r.factions)).filter((x) => x.id !== me() && knows(r, me(), x.id) && hasLand(x.id))) {
      const rel = relationOf(r, me(), f.id)
      const left = rel.until !== null ? ` ${Math.max(0, rel.until - r.season)}계절` : ''
      const lead = r.heroes[f.ruler ?? rulerId(f.id)]
      const md = moodOf(r, me(), f.id)
      // 꾸미는 중이거나 보낸 사신이 있는 나라는 펼친 채로
      const fo = diploOpen.has(f.id) || compose.to === f.id
      h += `<div class="fcard${fo ? ' open' : ' shut'}"><div class="an fhd" data-act="fopen" data-to="${f.id}">${lead !== undefined ? `<button class="fbtn" data-act="hero" data-id="${lead.id}">${bust(lead, 'rface')}</button>` : ''}<div class="fn"><b>${emblem(f.id, 'fem')}${esc(f.name)}</b><span class="mute">${lead !== undefined ? `군주 ${nameHtml(lead.name)}${lead.status === 'captive' ? ' · 사로잡힘' : lead.status === 'dead' ? ' · 죽음' : ''}` : ''}</span></div>${moodImg(ART, md.mood, 'mood fmood')}<span class="rel ${rel.state}">${REL_NAME[rel.state]}${left}</span><i class="fchev">${fo ? '▾' : '▸'}</i></div>`
      if (!fo) { h += `</div>`; continue }
      h += `<div class="moodl ${md.mood}">${moodImg(ART, md.mood)}<div><b>${esc(MOOD_WORD[md.mood])}</b>${said(advisor(r), md.say)}</div></div>`
      h += `<div class="frow"><span class="mute">${REL_NOW[rel.state]}</span>${favorFeel(favorOf(r, me(), f.id))}</div>`
      // 우리 사이에 있었던 일 — 언제 누가 무엇을 (형: "이나라가 나한테 잘못한일 잘한일 이런거를 언제 그랬는지와 함께")
      const deeds = (rel.deeds ?? []).slice().reverse()
      if (deeds.length > 0) {
        const open = deedsOpen.has(f.id)
        h += `<div class="deeds"><h5>우리 사이에 있었던 일</h5>`
        for (const d of open ? deeds : deeds.slice(0, 3)) {
          const t = deedText(r, me(), f.id, d)
          h += `<div class="dd ${t.tone}"><span>${seasonLabel(d.s)}</span>${esc(t.text)}</div>`
        }
        if (deeds.length > 3) h += `<button class="btn ghost sm" data-act="deeds" data-to="${f.id}">${open ? '접기' : `더 보기 · ${deeds.length - 3}`}</button>`
        h += `</div>`
      }
      // 그쪽 속셈 — 첩자를 심었거나 동맹일 때만 보인다 (형: "속셈은 아무에게나 드러내게 하지 말고 … 간접정보로"). 깰 속셈은 안 보인다
      const tw = readsMind(r, f.id) ? truceWhy(r, f.id, me()) : null
      const aw = tw === null && readsMind(r, f.id) ? allianceWhy(r, f.id, me()) : null
      const mw = tw ?? aw
      if (mw !== null) {
        h += heardHtml(r, f.id, `${tw !== null ? '화친할 마음이 있다고 합니다' : '손잡을 마음이 있다고 합니다'}: ${whyLine(mw.why, mw.about !== undefined ? (r.factions[mw.about]?.name ?? '') : '')}`)
      } else if (readsMind(r, f.id) && rel.state === 'war' && winningAgainst(r, f.id, me())) h += heardHtml(r, f.id, '저들은 이기고 있다고 여깁니다. 화친은 잘 안 받을 겁니다.')
      // 맺은 약속 — 두 계절 안에 칠 곳 (동맹의 "함께 치자")
      for (const p of rel.pledges ?? []) {
        const who = p.by === me() ? '우리가' : josa(f.name, '이', '가')
        h += `<div class="banner ${p.by === me() ? 'bad' : 'good'}">약속: ${esc(who)} ${esc(josa(r.nodes[p.node]?.name ?? '', '을', '를'))} 친다 · ${Math.max(0, p.until - r.season)}계절 안에</div>`
      }
      // 사이에 따라 보낼 수 있는 사신이 다르다 (형: "동맹 되고나서도 동맹버튼이 아직도 활성이면 뭘 의미하는거고")
      h += askButtons(r, f.id, '')
      h += `</div>`
    }
    if (gone.length > 0) h += `<h4>무너진 나라</h4><p class="mute">${gone.map((f) => `${emblem(f.id, 'fem')}${esc(f.name)}`).join(' · ')}</p>`
    return h
  }

  /** 보낸 사신 한 줄 — 누가 갔나(얼굴) · 어느 나라에 무엇을 · 거두기 */
  function sentBanner(r: Realm, e: Envoy, nation: boolean): string {
    const who = e.hero !== undefined ? r.heroes[e.hero] : undefined
    const face = who !== undefined ? bust(who, 'sface') : icon('unit-scouts', 'sface')
    const whoName = who !== undefined ? who.name : '사자'
    return `<div class="banner good sentb">${face}<span>${tx(`${josa(whoName, '이', '가')} 간다: ${nation ? `${r.factions[e.to]?.name ?? ''}에 ` : ''}${ASK_NAME[e.ask]}`)}${envoyWhere(r, e)}</span><button class="btn ghost sm" data-act="unenvoy" data-key="${ekey(e.to, e.ask)}">거둔다</button></div>`
  }

  /**
   * 사신 단추들 — 누르면 아래에 꾸미기(누가 가나 · 무엇을)가 열린다. 이미 보낸 것은 켜진 채로(누르면 거둔다),
   * 보낸 것과 부딪히는 것·보낼 사람이 없으면 꺼진다. sm — 고을 판의 작은 단추
   */
  function askButtons(r: Realm, to: string, sm: string): string {
    let h = `<div class="btns askl">`
    for (const ask of envoyOptions(r, me(), to)) {
      const k = ekey(to, ask)
      const sel = envoys[k] !== undefined
      const clash = !sel && sentTo(to).some((e) => envoyClash(e.ask, ask))
      const sure = ask === 'gift' || ask === 'break'
      const c = envoyChanceFor(r, me(), to, ask, noGoods(), noGoods())
      // ✓(on)는 보냈을 때만 — 꾸미는 중(open)에도 ✓가 붙어 보낸 줄 알았다 (형 10-25)
      const open = !sel && compose.to === to && compose.ask === ask
      h += `<button class="btn${sm}${sel ? ' on' : ''}${open ? ' open' : ''}${ask === 'break' ? ' ghost' : ''}" ${sel ? `data-act="unenvoy" data-key="${k}"` : `data-act="compose" data-to="${to}" data-ask="${ask}"`} ${clash || (!sel && handsOut(r)) ? 'disabled' : ''}>`
      // 청마다 그림 — 화친·교역·선물·조공 요구… (형 10-24: "이것들도 다 아이콘 만들어 와 · 직관화")
      h += `${icon(`ask-${ask}`, 'aic')}<span class="al">${askLabel(r, to, ask)}${sel ? ' · 보낸다' : ''}</span>${sel || sure ? '' : envoyFeel(c[0], c[1], ask)}</button>`
      // 꾸미는 칸은 누른 단추 바로 밑에 (형 10-25: "누르면 바로밑에 열려야 하는데 너무 멀리 조공요구 밑에서 열림")
      if (open) h += composeHtml(r, to)
    }
    h += `</div>`
    // 단추가 왜 꺼졌나 — 보낼 사람이 다 나갔다
    if (handsOut(r)) h += `<p class="mute">${tx(`보낼 사람이 다 나갔다 (${handsUsed()}/${handsCap(r)}): 군대에서 장수를 빼 쉬게 하면 한 사람 더 보낸다.`)}</p>`
    else if (handsFull(r)) h += `<p class="mute">${tx('사자는 다 나갔다. 고을을 맡은 장수를 몸소 보낸다.')}</p>`
    return h
  }

  /**
   * 누가 가나 (형: "함께보낼 장수 선택은 맨날 못하네. 동맹 누르면 리스트가 뜨고 거기서 선택하거나하게 해주면 … 장수로 외교를 한다가 느껴질거같은데").
   * 군장의 사자(늘 있다) + 우리 장수 모두 — 갈 수 있는 이는 얼굴 밑에 그이가 가면 먹힐 낌새, 못 가는 이는 흐리게 까닭과.
   * 장수가 가면 그 계절 자리를 비우고, 싸우는 나라에 가면 붙잡힐 수 있다
   */
  function whoGoesHtml(r: Realm, to: string, ask: Ask): string {
    const busy = new Set<string>()
    for (const e of Object.values(envoys)) if (e.hero !== undefined) busy.add(e.hero)
    for (const p of plots) if (p.kind === 'plot' && p.agent !== undefined) busy.add(p.agent)
    const sure = ask === 'gift' || ask === 'break'
    const feel = (hero?: string): string => {
      if (sure) return ''
      const c = envoyChanceFor(r, me(), to, ask, compose.give, compose.take, hero)
      return envoyFeel(c[0], c[1], ask)
    }
    const ruler = r.factions[me()]?.ruler
    const mine = sorted(Object.values(r.heroes)).filter((x) => x.faction === me() && x.status === 'free' && x.id !== ruler)
    // 갈 수 있는 이 먼저 — 고을을 맡은 장수도 간다 (그 계절엔 고을을 비우고 다음 계절 돌아와 다시 맡는다 · 형 10-26)
    const can = (id: string): boolean => canEscort(r, me(), id) && !busy.has(id) && heroBusy(r, id) === null && handFor(r, id)
    mine.sort((a, b) => Number(can(b.id)) - Number(can(a.id)))
    const anon = !handsFull(r)
    // 잘 먹힐 장수가 앞 — 공작과 같은 결 (형 10-27) · 받아들일 게 뻔한 청(선물·끊기)은 그대로
    const score = (hero?: string): number => { const c = envoyChanceFor(r, me(), to, ask, compose.give, compose.take, hero); return c[0] + c[1] }
    const goers = mine.filter((y) => can(y.id))
    if (!sure) goers.sort((a, b) => score(b.id) - score(a.id))
    let h = `<div class="who"><div class="nal">누가 가나</div><div class="wlist">`
    // 사자·쉬는 장수가 다 나갔으면 사자는 흐리게 — 고을을 맡은 장수는 몸소 간다
    h += `<button class="wg${anon ? (compose.hero === '' ? ' on' : '') : ' off'}" data-act="chero" data-id="" ${anon ? '' : 'disabled'}>${icon('unit-scouts', 'wfc')}<b>사자</b>${anon ? feel() : '<i class="busyw">다 나갔다</i>'}</button>`
    for (const x of goers) {
      const tr = (x.traits ?? []).filter((t) => t === 'charm' || (ask === 'trade' && t === 'trader')).map((t) => TRAIT[t]?.name).filter((t) => t !== undefined)[0]
      h += `<button class="wg${compose.hero === x.id ? ' on' : ''}" data-act="chero" data-id="${x.id}">${bust(x, 'wfc')}<b>${esc(x.name)}</b>`
      h += `${x.post != null ? '<i class="gvtag">고을 맡음</i>' : ''}${tr !== undefined ? `<i>${esc(tr)}</i>` : ''}${feel(x.id)}`
      h += `</button>`
    }
    // 못 가는 장수 — 흐리게 남기고 무슨 일인지 (형 10-23: "이미 다른 일 하고 있는데 … 뭘 일 시켰고 뭘 안 시켰는지 모르잖아")
    // 군대를 이끄는 장군도 흐리게 — 왜 못 가는지 보이게 (한 사람 한 가지 일 · 형 10-25: "군사를 맡은 장군은 사신으로 못 보내야")
    for (const x of mine.filter((y) => !can(y.id))) {
      const e = Object.values(envoys).find((v) => v.hero === x.id)
      const leads = Object.values(r.armies).some((a) => a.hero === x.id)
      const why = leads ? '군대를 이끈다' : e !== undefined ? `${r.factions[e.to]?.name ?? ''} 사신` : plots.some((p) => p.kind === 'plot' && p.agent === x.id) ? '공작' : heroBusy(r, x.id) !== null ? heroBusy(r, x.id)!.replace(/^이번 계절 /, '') : !handFor(r, x.id) ? '보낼 손이 다 찼다' : '다른 일'
      h += `<button class="wg off" disabled>${bust(x, 'wfc')}<b>${esc(x.name)}</b><i class="busyw">${esc(why)}</i></button>`
    }
    h += `</div>`
    const went = compose.hero !== '' ? r.heroes[compose.hero] : undefined
    if (went !== undefined && relationOf(r, me(), to).state === 'war') h += `<p class="mute warnl">${tx(`싸우는 나라다: ${josa(went.name, '이', '가')} 붙잡힐 수 있다`)}</p>`
    else if (went?.post != null) h += `<p class="mute">${tx(`그 계절엔 ${josa(r.nodes[went.post]?.name ?? '', '이', '가')} 빈다: 다음 계절 돌아와 다시 맡는다`)}</p>`
    else if (mine.length > 0 && !mine.some((x) => can(x.id))) h += `<p class="mute">${tx('장수가 다 바쁘다. 군대에서 장수를 빼 쉬게 하면 그이를 보낼 수 있다.')}</p>`
    else h += `<p class="mute">${tx('매력이 높거나 매혹·장사꾼(교역) 특성이 있는 장수가 가면 더 잘 먹힌다. 그 계절엔 자리를 비운다.')}</p>`
    return h + `</div>`
  }

  /** 사신 단추의 이름 — 깨기는 무엇을 깨는지 (형: "약조는 무슨약조를 했엇고 뭘 깨는지 알아야 할거같은데") */
  function askLabel(r: Realm, to: string, ask: Ask): string {
    if (ask !== 'break') return ASK_NAME[ask]
    return relationOf(r, me(), to).state === 'ally' ? '동맹 깨기' : '화친 깨기'
  }

  /** 깨기 다짐 — 지금 맺은 것 · 깨면 무엇이 되는지 */
  function breakHint(r: Realm, to: string): string {
    const rel = relationOf(r, me(), to)
    const name = r.factions[to]?.name ?? ''
    const now = rel.state === 'ally'
      ? `지금 ${josa(name, '과', '와')} 동맹이다: 서로 안 치고, 함께 치자·지원·군대 빌리기를 주고받는다.`
      : `지금 ${josa(name, '과', '와')} 화친이다${rel.until !== null ? ` (${Math.max(0, rel.until - r.season)}계절 남음)` : ''}: 서로 안 치고 장터가 선다.`
    return `${now} 깨면 중립이 되고, ${name}의 호감이 크게 깎이며, 다른 나라들도 우리를 덜 믿는다.${rel.state === 'ally' ? ' 서로 빌려준 군대는 돌아간다.' : ''}`
  }

  /** 사신의 자세한 것 — 교역·선물·지원·조공은 무엇을 얼마나, 함께 치자는 어디를, 군대 빌리기는 어느 고을로, 약조 깨기는 다짐 */
  function composeHtml(r: Realm, to: string): string {
    const ask = compose.ask
    const need = ASK_NEEDS[ask]
    const st = r.stock[me()] ?? { grain: 0, iron: 0 }
    // 갈래 설명은 ? 안에 (GUIDE.envoy · 형 10-23: "외교에 화친부터 선물까지 카드 … 설명도 다 물음표에") — 약조 깨기는 지금 형편이라 그대로
    let h = `<div class="trade"><div class="cmh"><b>${icon(`ask-${ask}`, 'aic big')}${askLabel(r, to, ask)} ${guideBtn('envoy')}</b>${ask === 'break' ? `<span class="mute">${esc(breakHint(r, to))}</span>` : ''}</div>`
    h += whoGoesHtml(r, to, ask)
    let ok = true
    if (need === 'goods') {
      // 물건마다 한 줄 — 왼쪽에 우리가 주는 것, 가운데 물건, 오른쪽에 받는 것 (형 10-23: "준다 받는다는 좌우로 · 행렬 맞추고")
      const give = ask === 'trade' || ask === 'gift'
      const take = ask !== 'gift'
      const step = (side: 'give' | 'take', res: Good): string => `<span class="stepper sm"><button data-act="cq" data-side="${side}" data-res="${res}" data-d="${-GOOD_STEP[res]}">−</button>`
        + `<b>${compose[side][res]}</b><button data-act="cq" data-side="${side}" data-res="${res}" data-d="${GOOD_STEP[res]}">+</button></span>`
      // 누가 누구에게 — 큰 깃발 둘과 값이 더 가는 쪽 화살표 (형 10-24: "우리가 주는 게 더 많으면 화살표가 오른쪽 · 국기도 크게")
      const gv = goodsWorth(compose.give, r, me()), tv = goodsWorth(compose.take, r, me())
      const dir = gv === 0 && tv === 0 ? '' : gv > tv * 1.05 ? 'r' : tv > gv * 1.05 ? 'l' : 'eq'
      h += `<div class="tflow"><span class="tfs">${emblem(me(), 'tfl')}<small>우리</small></span><span class="tfa ${dir}"><i>${dir === 'r' ? '➜' : dir === 'l' ? '⬅' : '⇄'}</i><small>${dir === 'r' ? '우리가 더 준다' : dir === 'l' ? '우리가 더 받는다' : dir === 'eq' ? '엇비슷하다' : '고르면 보인다'}</small></span><span class="tfs">${emblem(to, 'tfl')}<small>${esc(r.factions[to]?.name ?? '')}</small></span></div>`
      h += `<div class="tgrid${give && take ? ' two' : ''}">`
      h += `${give ? '<span class="th give">우리가 준다</span>' : ''}<span class="th"></span>${take ? '<span class="th take">받는다</span>' : ''}`
      for (const res of GOODS) {
        if (give) h += `<span class="tc give">${step('give', res)}<small>창고 ${Math.floor(goodOf(st, res))}</small></span>`
        h += `<span class="tg">${icon(GOOD_ICON[res])}<i>${GOOD_NAME[res]}</i></span>`
        if (take) h += `<span class="tc take">${step('take', res)}</span>`
      }
      h += `</div>`
      ok = GOODS.every((g) => compose.give[g] <= goodOf(st, g)) && GOODS.some((g) => compose.give[g] + compose.take[g] > 0)
      // 저들 창고에 그만큼 없다 — 받아 줄 수가 없다 (형: "상대 자원이 부족해서 거래가 성립이 안되면 어떻게 해야함??")
      const theirs = r.stock[to]
      const short = theirs !== undefined ? GOODS.filter((g) => compose.take[g] > goodOf(theirs, g)) : []
      if (short.length > 0) h += `<div class="banner bad">${tx(`저들 창고에 ${josa(short.map((g) => GOOD_NAME[g]).join('·'), '이', '가')} 그만큼 없다: 줄여서 청한다.`)}</div>`
    } else if (need === 'place') {
      const places = ask === 'joint' ? jointTargets(r, me(), to) : sorted(Object.values(r.nodes)).filter((n) => n.owner === me()).map((n) => n.id)
      if (places.length === 0) h += `<div class="mute">고를 곳이 없다.</div>`
      h += `<div class="rows">`
      for (const id of places) {
        h += `<button class="row ${compose.target === id ? 'on' : ''}" data-act="ctarget" data-node="${id}">${emblem(r.nodes[id]?.owner ?? null)}<span class="dest">${esc(r.nodes[id]?.name ?? '')}</span></button>`
      }
      h += `</div>`
      ok = compose.target !== ''
    }
    // 사자가 다 나갔으면 고을을 맡은 장수를 골라야 간다
    if (!handFor(r, compose.hero)) ok = false
    const sure = ask === 'gift' || ask === 'break'
    const c = envoyChanceFor(r, me(), to, ask, compose.give, compose.take, compose.hero || undefined)
    h += `<button class="btn pri" data-act="envoy" data-to="${to}" data-ask="${ask}" ${ok ? '' : 'disabled'}>${ask === 'break' ? '정말 깬다' : '사신을 보낸다'}${sure ? '' : ` ${envoyFeel(c[0], c[1], ask)}`}</button></div>`
    return h
  }

  // ───────── 공작 (형: "다양한 외교나 공작이 가능 해야하는거 아님?")
  /**
   * 우리 쪽에서 짐작을 말하는 사람 — 지략이 가장 높은 우리 신하. 화면은 판이 아는 것을 내레이션하지 않고 이 사람의 입으로 짐작한다
   * (형 2026-10-20: "전지적작가시점에서 정보전달하면안된다니까? 주변정보나 인물의 발언 같은걸로 해야해")
   * 우리 군주는 빠진다 — 군주는 플레이어 자신이다 (형 2026-10-21: "본인이본인한테 뭔가 말을한다는게 말이되나?"). 신하가 없으면 이름 없는 "신하의 짐작"
   */
  function advisor(r: Realm): Hero | undefined {
    return sorted(Object.values(r.heroes)).filter((h) => h.faction === me() && h.status !== 'dead' && h.status !== 'captive' && !isRuler(r, h.id))
      .sort((a, b) => b.ryak - a.ryak || (a.id < b.id ? -1 : 1))[0]
  }
  /** 사람의 말 한 줄 — 얼굴 · 이름 · 따옴표 */
  function said(h: Hero | undefined, text: string, who?: string, face?: string): string {
    return `<span class="said">${face ?? bust(h, 'sface')}<span><i>${esc(who ?? (h !== undefined ? `${h.name}의 짐작` : '신하의 짐작'))}</i><q>${tx(text)}</q></span></span>`
  }
  /** 그 나라 속을 들은 말 — 첩자가 전했나, 동맹이 귀띔했나 (readsMind 일 때만) */
  // 말하는 이는 늘 우리 장수(꾀가 가장 높은 이) — 그 나라 군장이 제 속을 「저들이」라며 귀띔하는 꼴이었다 (형 10-25: "귀띔은 요청한 국가에서 직접 주는게 말이 되나? 우리 장수중하나여야")
  function heardHtml(r: Realm, f: string, text: string): string {
    const ally = relationOf(r, me(), f).state === 'ally'
    const adv = advisor(r)
    const src = ally ? `동맹 ${r.factions[f]?.name ?? ''} 쪽에서 들은 말` : '심어 둔 첩자가 전한 말'
    return `<div class="why">${said(adv, text, adv !== undefined ? `${adv.name}: ${src}` : src, adv !== undefined ? undefined : icon('status-spy', 'sface'))}</div>`
  }

  /** 그 나라 속을 읽나 — 그 나라 땅에 우리 첩자가 있거나 동맹이다. 아니면 속셈은 안 보인다 */
  function readsMind(r: Realm, f: string): boolean {
    if (relationOf(r, me(), f).state === 'ally') return true
    return (r.spies?.[me()] ?? []).some((s) => s.until >= r.season && r.nodes[s.node]?.owner === f)
  }

  /** 직접 쏘기 — 한 계절에 한 적장은 한 번만 쏜다 (거뒀다 다시 걸어도 쏜 결과가 남는다) */
  function shootHtml(i: number, o: Extract<Order, { kind: 'plot' }>): string {
    const hand = o.hand ?? (o.hero !== undefined ? hands[o.hero] : undefined)
    const rescue = o.op === 'rescue'
    const names = rescue ? RESCUE_HAND_NAME : HAND_NAME
    // 건너뛰기 — 자객 솜씨로 굴린다. 진짜 지붕을 보고 맡겼으면 조금 덜 산다 (plotSkipSeenMul)
    if (hand?.result === 'skip') return `<div class="banner">${names.skip} · ${rescue ? '보낸 이' : '자객'}의 솜씨에 달렸다${hand.seen === true ? ' · 지붕을 보고 물러난 뒤라 적이 조금 더 깨어 있다' : ''}</div>`
    if (hand !== undefined) {
      const good = rescue ? hand.result === 'cleared' : hand.result === 'dead' || hand.result === 'wounded'
      return `<div class="banner ${good ? 'good' : 'bad'}">직접 쐈다 · ${names[hand.result]}${hand.alarm ? ' · 들켰다' : ''} · 이번 계절엔 다시 못 쏜다</div>`
    }
    // 구출 — 보초를 다 쓰러뜨리면 묶인 장수를 데려 나온다 (형 10-26: "구출작전은 암살이랑 비슷하게 활쏘기겜으로")
    if (rescue) return `<button class="btn pri wide" data-act="shoot" data-i="${i}">${icon('unit-archer')} 직접 구한다 · 밤 지붕 위로</button><p class="mute">보초를 다 쓰러뜨리면 묶인 장수를 데려 나온다. 들어가면 먼저 연습해 볼 수 있다. 안 가거나 건너뛰면 보낸 이가 알아서 한다.</p>`
    return `<button class="btn pri wide" data-act="shoot" data-i="${i}">${icon('unit-archer')} 직접 쏜다 · 밤 지붕 위로</button><p class="mute">들어가면 먼저 연습해 볼 수 있다. 진짜는 한 번만 쏜다. 안 쏘거나 건너뛰면 자객이 알아서 한다.</p>`
  }

  /** 맺은 나라를 노리는 공작 — 들키면 무엇이 깨지나 (형: "동맹한테 뭐 보내면 발각시 동맹 깨진다느니 그런거 있어야") */
  function pactWarn(r: Realm, target: string, op: PlotOp): string {
    const s = relationOf(r, me(), target).state
    if (s !== 'ally' && s !== 'truce') return ''
    const steps = op === 'assassin' ? 2 : 1
    const to = s === 'ally' ? (steps === 2 ? '중립' : '화친') : (steps === 2 ? '전쟁' : '중립')
    // 이름 밑 둘째 줄에 — 이름 바로 뒤에 붙어 「소문 동맹」「방화 동맹」으로 읽히고 긴 말은 잘렸다 (형 10-25)
    return `<span class="pwarn">⚠ 들키면 ${josa(REL_NAME[s], '이', '가')} 깨져 ${josa(to, '으로', '로')}${op === 'assassin' ? ' (두 칸)' : ''}</span>`
  }

  /** 공작에 간 이 — 장수 이름, 없으면 고용 자객(암살) · 알아서(나머지) */
  function plotWho(r: Realm, o: Order): string {
    if (o.kind !== 'plot') return ''
    if (o.agent !== undefined) return r.heroes[o.agent]?.name ?? ''
    return NIGHT_OPS.has(o.op) ? '고용 자객' : '고용 밀정'
  }
  /** 공작 한 줄(갈래 · 노릴 곳)의 열쇠와 같은 것 — 누른 줄 바로 밑에 「누가 가나」를 펼친다 */
  type PlotTarget = ReturnType<typeof plotTargets>[number]
  const plotKey = (op: PlotOp, t: PlotTarget): string => `${op}|${t.target}|${t.node ?? ''}|${t.other ?? ''}|${t.hero ?? ''}`
  const plotSame = (op: PlotOp, t: PlotTarget) => (p: Order): boolean => p.kind === 'plot' && p.op === op && p.target === t.target && p.node === t.node && p.other === t.other && p.hero === t.hero

  /**
   * 누가 가나 — 누른 공작 줄 바로 밑 (형 10-25: "누구 보낼지 선택도 그거 바로 아래 떠야"). 하나 누르면 바로 간다 — 값과 먹힐 낌새는 단추마다.
   * 암살·구출: 고용 자객 또는 우리 장수 · 나머지: 「알아서」(우리 나라 지략 가장 높은 이의 솜씨) 또는 우리 장수 — 그 장수의 지략으로 셈한다 (plots.ourRyak).
   * 고을을 맡은 장수도 간다 — 「고을 맡음」 표 · 그 계절엔 고을을 비우고 다음 계절 다시 맡는다 (hands.ownHand · 형 10-26)
   */
  function plotWhoHtml(r: Realm, op: PlotOp, t: PlotTarget): string {
    const busy = new Set<string>()
    for (const e of Object.values(envoys)) if (e.hero !== undefined) busy.add(e.hero)
    for (const p of plots) if (p.kind === 'plot' && p.agent !== undefined) busy.add(p.agent)
    const night = NIGHT_OPS.has(op)
    const st = left()
    // 장수 판에서 「공작」으로 데려온 장수가 맨 앞 · 그다음 지략 높은 순
    const ids = plotAgents(r, me()).filter((id) => !busy.has(id) && heroBusy(r, id) === null)
      .sort((a, b) => Number(b === plotAgent) - Number(a === plotAgent) || (r.heroes[b]?.ryak ?? 0) - (r.heroes[a]?.ryak ?? 0) || (a < b ? -1 : 1))
    // 사신의 「사자」와 같은 결 — 고용 밀정(고용 자객)은 장수가 없어도 늘 있고, 우리 장수는 고른다.
    // 잘 먹힐 이가 맨 앞 — 금테는 고른 것과 헷갈려 뺐다 (형 10-27: "가장 확률 높은 애를 가장 첫 번째로 · 강조 빼. 내가 이미 선택한 거랑 헷갈리니까")
    const opts: Array<{ agent: string; face: string; name: string; sub: string; tag: string }> = [
      night ? { agent: '', face: icon('unit-archer', 'fp'), name: '고용 자객', sub: '잡혀도 값만 잃는다', tag: '' }
        : { agent: '', face: icon('status-spy', 'fp'), name: '고용 밀정', sub: `지략 ${P.realm.plotHiredRyak}`, tag: '' },
    ]
    for (const id of ids.slice(0, 8)) {
      const x = r.heroes[id]
      if (x === undefined) continue
      opts.push({ agent: id, face: bust(x, 'fp'), name: x.name, sub: night ? `지략 ${x.ryak} · 빠져나올 길 ${Math.round(escapeChance(r, id) * 100)}%` : `지략 ${x.ryak}`, tag: x.post != null ? '<i class="gvtag">고을 맡음</i>' : '' })
    }
    const rows = opts.map((o) => {
      const c = plotChance(r, me(), op, t.target, t.node, t.hero, o.agent === '' ? null : o.agent)
      const cost = plotCost(op, o.agent === '' ? null : o.agent)
      return { ...o, c, cost, ok: handFor(r, o.agent) && st.grain >= cost.grain && st.iron >= cost.iron }
    }).sort((a, b) => Number(b.agent !== '' && b.agent === plotAgent) - Number(a.agent !== '' && a.agent === plotAgent) || Number(b.ok) - Number(a.ok) || (b.c[0] + b.c[1]) - (a.c[0] + a.c[1]))
    let h = '<div class="pwhos"><div class="pwl">'
    for (const x of rows) {
      h += `<button class="pwho${x.agent !== '' && x.agent === plotAgent ? ' on' : ''}" data-act="plot" data-op="${op}" data-target="${t.target}" data-node="${t.node ?? ''}" data-other="${t.other ?? ''}" data-hero="${t.hero ?? ''}" data-agent="${x.agent}" ${x.ok ? '' : 'disabled'}>`
        + `${x.face}<b>${esc(x.name)}</b>${x.tag}<small>${esc(x.sub)}</small>${plotFeel(x.c[0], x.c[1])}${costHtml({ grain: x.cost.grain, iron: x.cost.iron })}</button>`
    }
    h += '</div>'
    // 들키면 누가 보냈는지 드러날 수 있다 — 드러나면 그 나라와 크게 틀어지고 다른 나라도 우리를 덜 믿는다
    const ex = exposeChance(r, me(), t.target, t.node, night ? null : undefined)
    h += `<p class="mute">들켜도 누가 보냈는지 숨길 길 ${plotFeel(1 - ex, 1 - ex, false)}${night ? ' · 장수가 가면 화살이 더 있고, 들키면 몸을 빼야 한다' : ''}</p>`
    if (handsFull(r)) h += `<p class="mute">${tx('사자와 쉬는 장수는 다 나갔다. 고을을 맡은 장수는 몸소 간다.')}</p>`
    return h + '</div>'
  }

  /** 공작 한 갈래를 펼친 칸 — 노릴 곳 줄(하나뿐이면 바로 「누가 가나」) · 보낸 줄은 누가 갔나와 거두기 · 밤 공작은 직접 쏘기·자객의 활 */
  /** 이간 칸 — 두 빈칸에 깃발을 하나씩 넣으면 그 둘 사이를 노린다. 보낸 이간은 위에 줄로 (거두기) */
  function sowPanel(r: Realm, ts: PlotTarget[], full: boolean): string {
    let h = `<div class="rows">`
    for (const [i, o] of plots.entries()) {
      if (o.kind !== 'plot' || o.op !== 'sow') continue
      h += `<button class="row on" data-act="unplot" data-i="${i}"><span class="sowf">${emblem(o.target)}<i>⇄</i>${emblem(o.other ?? null)}</span><span class="dest">${esc(`${r.factions[o.target]?.name ?? ''} ↔ ${r.factions[o.other ?? '']?.name ?? ''}`)}<span class="pwent">${esc(plotWho(r, o))} 간다</span></span><span class="win">거둔다</span></button>`
    }
    h += `</div>`
    if (full) return h
    const ns = [...new Set(ts.flatMap((t) => [t.target, t.other ?? '']))].filter((f) => f !== '').sort((a, b) => ((r.factions[a]?.name ?? '') < (r.factions[b]?.name ?? '') ? -1 : 1))
    const slot = (f: string, side: 'a' | 'b'): string => (f !== ''
      ? `<button class="sows on" data-act="sowslot" data-side="${side}">${emblem(f, 'fem')}<b>${esc(r.factions[f]?.name ?? '')}</b></button>`
      : `<button class="sows" data-act="sowslot" data-side="${side}"><i>?</i></button>`)
    h += `<div class="sowpick">${slot(sowA, 'a')}<i class="sowx">⇄</i>${slot(sowB, 'b')}</div>`
    h += `<div class="sowflags">${ns.map((f) => `<button class="${f === sowA || f === sowB ? 'on' : ''}" data-act="sowflag" data-f="${f}" data-tip="${esc(r.factions[f]?.name ?? '')}">${emblem(f, 'fem')}</button>`).join('')}</div>`
    if (sowA !== '' && sowB !== '') {
      const [x, y] = sowA < sowB ? [sowA, sowB] : [sowB, sowA]
      const t = ts.find((p) => p.target === x && p.other === y)
      if (t === undefined) h += `<p class="mute">이 둘은 갈라놓을 수 없다</p>`
      else if (plots.some(plotSame('sow', t))) h += `<p class="mute">이미 보냈다</p>`
      else h += plotWhoHtml(r, 'sow', t)
    }
    return h
  }

  function plotPanel(r: Realm, op: PlotOp, ts: PlotTarget[], full: boolean): string {
    if (op === 'sow' && ts.length > 0) return sowPanel(r, ts, full)
    const night = NIGHT_OPS.has(op)
    if (ts.length === 0) return `<p class="mute">${op === 'rescue' ? '잡혀간 우리 장수가 없다.' : `지금은 노릴 데가 없다.${op === 'bribe' || op === 'spy' ? ' 아는 마을이어야 한다. 정찰부터.' : op === 'assassin' ? ' 겨뤄 본 적장만 노릴 수 있다.' : ''}`}</p>`
    let h = `<div class="rows">`
    for (const t of ts) {
      const i = plots.findIndex(plotSame(op, t))
      const sent = i >= 0 ? (plots[i] as Extract<Order, { kind: 'plot' }>) : undefined
      const k = plotKey(op, t)
      const open = sent === undefined && !full && (plotPick === k || ts.length === 1)
      const hero = t.hero !== undefined ? r.heroes[t.hero] : undefined
      const label = hero !== undefined ? (op === 'rescue' ? `${hero.name} · ${r.factions[t.target]?.name} ${r.nodes[t.node ?? '']?.name ?? ''}에 갇힘` : `${hero.name} · ${r.factions[t.target]?.name}`) : t.node !== undefined ? `${r.nodes[t.node]?.name} · ${r.factions[t.target]?.name}` : t.other !== undefined ? `${r.factions[t.target]?.name} ↔ ${r.factions[t.other]?.name}` : (r.factions[t.target]?.name ?? '')
      // 이간은 두 나라 깃발을 다 (형 10-25: "이간할 때 두 나라 국기 아이콘 다 나와야")
      const flags = hero !== undefined ? bust(hero, 'rface sm') : t.other !== undefined ? `<span class="sowf">${emblem(t.target)}<i>⇄</i>${emblem(t.other)}</span>` : emblem(t.target)
      if (sent !== undefined) {
        // 보냈다 — 누가 갔나 · 누르면 거둔다
        h += `<button class="row on" data-act="unplot" data-i="${i}">${flags}<span class="dest">${esc(label)}<span class="pwent">${esc(plotWho(r, sent))} 간다</span></span><span class="win">거둔다</span></button>`
        // 고른 적장 바로 밑에 "직접 쏜다" (형: "직접쏜다버튼이 너무 위에있어서 적군눌러도 반응없는줄 알았음")
        if (night) h += shootHtml(i, sent)
        continue
      }
      const c = plotChance(r, me(), op, t.target, t.node, t.hero, night ? null : undefined)
      h += `<button class="row${open ? ' open' : ''}" data-act="ppick" data-op="${op}" data-k="${esc(k)}" ${full ? 'disabled' : ''}>${flags}<span class="dest">${esc(label)}${pactWarn(r, t.target, op)}</span><span class="win">${plotFeel(c[0], c[1])}</span></button>`
      if (open) h += plotWhoHtml(r, op, t)
    }
    h += `</div>`
    if (full) h += `<p class="mute">${plots.length >= P.realm.plotsPerSeason ? `한 계절에 ${P.realm.plotsPerSeason}가지까지: 하나를 거두면 다시 건다` : '보낼 사람이 다 나갔다'}</p>`
    if (night) {
      // 자객의 활 — 계단으로 오른다 (형: "완만한 성장이 아니라 계단적 성장")
      const st = left()
      const bt = assassinBow(r, me())
      const bu = bowUpCost(r, me())
      const buying = musters.some((o) => o.kind === 'bowUp')
      h += `<div class="frow"><span class="mute">자객의 활 · <b>${esc(BOW_NAME[bt] ?? '')}</b></span>`
      if (bu !== null) h += `<button class="btn sm ${buying ? 'ghost' : ''}" data-act="bowup" ${buying || (st.grain >= bu.grain && st.iron >= bu.iron) ? '' : 'disabled'}>${buying ? '올리는 중 · 취소' : `${esc(josa(BOW_NAME[bu.to] ?? '', '으로', '로'))} ${costHtml({ grain: bu.grain, iron: bu.iron })}`}</button>`
      h += `</div>`
    }
    return h
  }

  /**
   * 공작 — 그림 칩(그림 + 이름) 격자. 누른 칩이 든 줄 바로 밑에 노릴 곳 · 누가 가나가 펼쳐진다. 한 번 더 누르면 접는다.
   * 갈래 설명은 칩의 말풍선(data-tip — 닿자마자). scope: 고을 판이면 그 나라·그 고을에 걸 것만 (여기서 못 거는 갈래는 외교의 공작 칸으로) ·
   * null 이면 외교 판(아는 나라 모두) (형 10-26: "공작이름이랑 설명이 같이 붙어있어서 자리낭비 · 선택한거 바로 밑에 보낼 장수가 뜨지 않고 너무 아래 멀리있어")
   */
  function plotGrid(r: Realm, scope: { f: string; node: string } | null): string {
    const full = plots.length >= P.realm.plotsPerSeason || handsOut(r)
    const targetsOf = (op: PlotOp): PlotTarget[] => {
      const all = plotTargets(r, me(), op).filter((t) => knows(r, me(), t.target)) // 아는 나라에만 (발견)
      return scope === null ? all : op === 'sow' ? [] : all.filter((t) => t.target === scope.f && (t.node === undefined || t.node === scope.node))
    }
    let h = `<div class="pogrid">`
    for (const op of PLOT_OPS) {
      const ts = targetsOf(op)
      const sent = plots.filter((p) => p.kind === 'plot' && p.op === op && (scope === null || p.target === scope.f)).length
      // 구출 — 잡혀간 우리 장수가 없으면 흐리게 닫아 둔다 (형 10-26: "잡혀간 우리 장수가있는나라의 경우 구출 이 활성화되면")
      const none = op === 'rescue' && plotTargets(r, me(), op).length === 0
      // 고을 판에서 여기 못 거는 갈래 — 누르면 외교의 공작 칸이 그 갈래로 열린다
      const away = scope !== null && ts.length === 0 && !none
      const why = none ? '잡혀간 우리 장수가 없다' : !away ? '' : op === 'sow' ? '두 나라 사이: 외교에서 고른다' : op === 'assassin' ? '이 고을엔 노릴 적장이 없다. 외교에서 고른다' : op === 'rescue' ? '여기 갇힌 우리 장수가 없다. 외교에서 고른다' : '외교에서 고른다'
      const open = plotOpen === op && !away && !none
      h += `<button class="pochip${open ? ' on' : ''}${sent > 0 ? ' sent' : ''}${away ? ' away' : ''}" data-act="${away ? 'cmd-plot' : 'plot-open'}" data-op="${op}" data-tip="${esc(`${PLOT_DOES[op]}${why !== '' ? ` · ${why}` : ''}`)}"${none ? ' disabled' : ''}>`
        + `${icon(PLOT_ICON[op], 'poic')}<b>${PLOT_NAME[op]}</b>${sent > 0 ? `<i class="ponum">${sent}</i>` : ''}</button>`
      if (open) h += `<div class="popan">${plotPanel(r, op, ts, full)}</div>`
    }
    return h + `</div>`
  }

  function plotSheet(r: Realm): string {
    let h = ''
    for (const [i, o] of plots.entries()) {
      if (o.kind !== 'plot') continue
      const where = o.node !== undefined ? r.nodes[o.node]?.name : o.other !== undefined ? `${r.factions[o.target]?.name} ↔ ${r.factions[o.other]?.name}` : r.factions[o.target]?.name
      const target = o.hero !== undefined ? r.heroes[o.hero]?.name : where
      const sowF = o.other !== undefined ? `<span class="sowf">${emblem(o.target)}<i>⇄</i>${emblem(o.other)}</span>` : ''
      h += `<div class="banner good">${sowF}${PLOT_NAME[o.op]} · ${esc(target ?? '')} · ${esc(plotWho(r, o))}<button class="btn ghost sm" data-act="unplot" data-i="${i}">거둔다</button></div>`
      // 암살·구출은 직접 쏠 수 있다 — 밤 판 (SNIPE §0). 안 쏘면 굴림. 그 칸을 펼쳤으면 보낸 줄 바로 밑에 띄운다
      if (NIGHT_OPS.has(o.op) && plotOpen !== o.op) h += shootHtml(i, o)
    }
    h += `<div class="nal">공작 <span class="mute">한 계절에 ${P.realm.plotsPerSeason}가지 · 지금 ${plots.length}</span></div>`
    return h + plotGrid(r, null)
  }

  // ───────── 밤 판 (SNIPE §0) — 지도 위에 틀(iframe)로 띄우고, 끝나면 postMessage 로 결과를 받는다
  function openNight(i: number): void {
    const o = plots[i]
    if (o === undefined || o.kind !== 'plot' || realm === null) return
    const arrows = assassinArrows(realm, o.agent)
    const bow = assassinBow(realm, me())
    // 구출 — 옥이 있는 고을의 경비 · 셋째 판에 적장 대신 묶인 우리 장수 (kind=rescue · who=이름)
    const rescue = o.op === 'rescue'
    const guard = rescue ? rescueGuard(realm, o.node ?? null) : o.hero !== undefined ? assassinGuard(realm, o.hero) : 1
    // 판의 배치는 판 시드·계절·대상으로 — 같은 계절 같은 대상이면 같은 밤
    let seed = (realm.seed ^ Math.imul(realm.season + 1, 2654435761)) >>> 0
    for (const ch of o.hero ?? o.target) seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619) >>> 0
    const kind = rescue ? `&kind=rescue&who=${encodeURIComponent(realm.heroes[o.hero ?? '']?.name ?? '')}` : ''
    openFrame(`${NIGHT}?seed=${seed}&arrows=${arrows}&bow=${bow}&guard=${guard}${kind}&id=plot-${i}&back=about:blank`, rescue ? '밤의 구출' : '밤의 암살')
  }

  /**
   * 궁술 연습장도 지도 위 틀로 (형: "연습하다 돌아가기 누르면 게임화면이 아니라 아예시작화면으로 튀어버려") —
   * 전에는 페이지째 night.html 로 갔다가 돌아오며 realm.html 을 새로 불러 첫 화면이 떴다
   */
  /**
   * 연습 싸움 — 판을 거치지 않고 1장(백제 대 마한) 판에서 우리 군대 하나가 이번 계절 바로 적 고을에 닿게 해 싸움을 연다 (형 10-28: "곧바로 테스트해 볼 수 있게").
   * 하던 판·저장·판 기록은 건드리지 않는다 — 끝나면 첫 화면으로. 붙을 고을은 매번 바뀐다
   */
  function openSpar(): void {
    const seed = Math.floor(Math.random() * 1e9)
    const r = startRegion('mahan', seed, 'baekje')
    const mine = sorted(Object.values(r.armies)).filter((a) => a.faction === r.player && a.hero !== null)
    const fronts = Object.values(r.edges).flatMap((e) => {
      const na = r.nodes[e.a]
      const nb = r.nodes[e.b]
      if (na === undefined || nb === undefined) return []
      if (na.owner === r.player && nb.owner !== null && nb.owner !== r.player) return [{ from: e.a, to: e.b, edge: e.id }]
      if (nb.owner === r.player && na.owner !== null && na.owner !== r.player) return [{ from: e.b, to: e.a, edge: e.id }]
      return []
    })
    const a = mine[seed % Math.max(1, mine.length)]
    const f = fronts[seed % Math.max(1, fronts.length)]
    if (a === undefined || f === undefined) { goToast('연습 싸움을 열 수 없습니다'); return }
    a.at = f.from
    a.march = { from: f.from, to: f.to, edge: f.edge, left: 1, ambush: false, aim: r.nodes[f.to]?.owner ?? null }
    // 장수 여럿 — 우리 군대 둘을 더 같은 길로 (비기·겨루기 「누가 나서나」 · 「누구를 잡나」도 시험되게)
    for (const b of mine.filter((x) => x !== a).slice(0, 2)) { b.at = f.from; b.march = { ...a.march } }
    const back = (): void => { warOn = false; front = { kind: 'title' }; paint() }
    try {
      if (openWar(root, r, aiOrders(r), { art: ART, me: r.player, ding, music: (k) => { if (k === 'war') music.war(); else music.result(k) }, done: back })) { warOn = true; music.war(); music.primeResults(); return }
    } catch (e) { failNote(e) }
    goToast('이번엔 싸움이 열리지 않았습니다. 한 번 더 눌러 주세요')
  }

  function openPractice(): void {
    const bow = realm !== null ? assassinBow(realm, me()) : 0
    openFrame(`${PRACTICE}&bow=${bow}&back=about:blank`, '궁술 연습장')
  }

  /**
   * 2장 송양의 활쏘기 겨루기 — 목표 띠 밑에 단추. 밤 판에서 직접 쏘고, 맞혔는지가 이 계절의 답(초안과 같이 탄다)이 되어
   * 계절이 넘어갈 때 엔진에 간다 (scenario.resolveContests · 점검 10-25: 장 소개가 약속하고 안 지키던 것)
   */
  function contestHtml(r: Realm): string {
    if (!contestOpen(r, me())) return ''
    const got = answers['contest:archery']
    if (got !== undefined) return `<div class="gcontest done${got ? ' won' : ''}">🏹 ${got ? '과녁을 맞혔다' : '빗맞혔다'}<small>계절이 넘어가면 송양이 안다</small></div>`
    return `<button class="gcontest" data-act="contest">🏹 송양이 활 솜씨를 겨루자 한다<small>직접 쏜다. 이기면 송양의 마음이 크게 기운다</small></button>`
  }
  function openContest(): void {
    if (realm === null) return
    const bow = assassinBow(realm, me())
    const seed = (realm.seed ^ 0x51a7) >>> 0 // 한 판에 한 과녁 — 다시 열어도 같은 언덕
    openFrame(`${CONTEST}?seed=${seed}&bow=${bow}&id=contest-archery&back=about:blank`, '송양과의 활쏘기 겨루기')
  }

  function openFrame(src: string, title: string): void {
    const ov = document.createElement('div')
    ov.className = 'nightov'
    ov.innerHTML = `<iframe src="${src}" title="${title}"></iframe><button class="btn" data-close>닫기</button>`
    root.appendChild(ov)
    music.refresh()
    const close = (): void => { ov.remove(); music.refresh() }
    ov.querySelector('[data-close]')!.addEventListener('click', close)
    // "돌아가기"는 틀을 about:blank 로 보낸다 — 그때만 닫는다 (결과판의 '연습장'처럼 틀 안에서 옮겨 가는 건 그대로 둔다)
    const ifr = ov.querySelector('iframe')!
    ifr.addEventListener('load', () => {
      try {
        if (ifr.contentWindow?.location.href === 'about:blank') close()
      } catch {
        close() // 다른 곳으로 나갔다
      }
    })
  }

  window.addEventListener('message', (ev) => {
    if (ev.origin !== location.origin) return
    // 밤 판의 결과 — 연습은 결과를 안 보낸다 (night-main.ts). skip 은 건너뛰기, seen 이면 진짜 지붕을 본 뒤다
    const m = ev.data as { type?: string; id?: string; result?: Hand['result']; alarm?: boolean; seen?: boolean; rot?: boolean }
    // 세로 폰에서 밤 판이 통째로 눕는다 — 바깥 「닫기」도 같이 눕혀 판의 오른쪽 위에 둔다 (night-main.ts layoutStage)
    if (m?.type === 'hanbal.night.rotated') {
      root.querySelector('.nightov')?.classList.toggle('rot', m.rot === true)
      return
    }
    // 송양과의 겨루기 — 맞히면(쓰러뜨리거나 다치게) 이긴다. 건너뛰면 안 겨룬 것
    if (m?.type === 'hanbal.night.result' && m.id === 'contest-archery' && m.result !== undefined && m.result !== 'cleared') {
      if (m.result !== 'skip') answers['contest:archery'] = m.result === 'dead' || m.result === 'wounded'
      else root.querySelector('.nightov')?.remove()
      saveDraft()
      paint()
      return
    }
    if (m?.type !== 'hanbal.night.result' || typeof m.id !== 'string' || !m.id.startsWith('plot-') || m.result === undefined) return
    const i = Number(m.id.slice(5))
    const o = plots[i]
    if (o === undefined || o.kind !== 'plot' || !NIGHT_OPS.has(o.op)) return
    // 암살은 cleared 가 없고(셋째 판에 적장이 있다), 구출은 적장을 쏠 일이 없다 — 판과 어긋난 결과는 버린다
    if (o.op === 'assassin' ? m.result === 'cleared' : m.result === 'dead' || m.result === 'wounded') return
    const hand: Hand = m.result === 'skip' ? { result: 'skip', alarm: false, seen: m.seen === true } : { result: m.result, alarm: m.alarm === true }
    plots = plots.map((p, j) => (j === i ? { ...o, hand } : p))
    if (o.hero !== undefined) hands[o.hero] = hand
    // 건너뛰면 밤 판을 닫는다 (쏜 결과는 밤 판의 "돌아가기"로 닫는다)
    if (m.result === 'skip') root.querySelector('.nightov')?.remove()
    host.onTap('night', m.result)
    paint()
  })

  // ───────── 장수 (docs/realm/HEROES.md §5)
  function heroRow(r: Realm, h: Hero, extra = ''): string {
    const seen = h.faction === me() || heroSeen(realm!, me(), h.id)
    const job = heroJob(r, h.id)
    // 이번 계절 무엇을 하나 — 📜 내가 시킨 일 · ⚙ 알아서 하는 일(맡은 고을·군대를 이어 가거나 계절 끝에 찾아 갈 곳) · 직접 부리는 장수 (형 10-26)
    const ours = h.faction === me() && h.status === 'free' && !isRuler(r, h.id)
    const chan = ours && job === null ? chanJob(h.id) : null
    const mine = ours && realm !== null && autoIdle(realm) && manualOf(realm).has(h.id)
    const keeps = h.post != null || Object.values(r.armies).some((a) => a.hero === h.id)
    const work = h.faction !== me() || h.status !== 'free' ? '' : orderedByMe(h.id) ? ' <i class="hwk me">📜 명령</i>'
      : !ours ? '' : job === null && !mine && realm !== null && autoIdle(realm) && (chan !== null || keeps) ? ' <i class="hwk au">⚙ 알아서</i>' : ''
    return `<button class="hrow${isRuler(r, h.id) ? ' ruler' : ''}${job !== null ? ' busy' : ''}" data-act="hero" data-id="${h.id}">${bust(h)}${job !== null ? `<i class="hbz">⏳</i>` : ''}<span class="hb">`
      + `<b>${nameHtml(h.name)}${isRuler(r, h.id) ? ' <span class="mute">군주</span>' : ''}${h.drill !== undefined && h.drill.lv > 0 && h.faction === me() ? ` <span class="dlv">단련 ${h.drill.lv}</span>` : ''}${h.faction === me() ? relicChips(ART, esc, h.relics) : ''}${mine ? ' <span class="jsm">직접</span>' : ''}${work}${seen ? '' : ' <span class="heard">이름만 들었다</span>'}</b>`
      + (job !== null ? `<span class="hdo">⏳ ${esc(job[1])}</span>` : `<span class="mute">${esc(roleLine(r, h))}</span>`)
      + (chan !== null ? `<span class="jsd">${chanJobHtml(h.id)}</span>` : '')
      + `<span class="tr3">${h.faction === me() && h.status === 'free' ? bondChip(r, h) : ''}${traitChips(h, seen)}</span>${extra}</span></button>`
  }

  function heroesSheet(r: Realm): string {
    const mine = sorted(Object.values(r.heroes)).filter((h) => h.faction === me() && h.status === 'free')
    const ruler = mine.filter((h) => isRuler(r, h.id))
    const caps = sorted(Object.values(r.heroes)).filter((x) => x.status === 'captive' && x.captor === me())
    const foes = sorted(Object.values(r.heroes)).filter((x) => x.faction !== me() && x.status === 'free' && heroSeen(realm!, me(), x.id))
    const wand = wanderersFor(r, me()) // 들인 이는 벌써 위 장군 줄에 있다
    const tab = (v: typeof heroTab, name: string, n: number): string => `<button class="${heroTab === v ? 'on' : ''}" data-act="htab" data-v="${v}">${name}${n > 0 ? ` <i>${n}</i>` : ''}</button>`
    let h = `<div class="seg dseg">${tab('cmd', '명령', 0)}${tab('mine', '우리 장수', mine.length + wand.length)}${tab('jail', '옥에 가둔 적장', caps.length)}${tab('foe', '적장', foes.length)}</div>`
    // 재상에게 맡기기 — 명령 칸·우리 장수 칸 맨 위에 (형 10-26)
    if (heroTab === 'mine' || (heroTab === 'cmd' && cmdJob === null)) h += chancellorBar()
    if (heroTab === 'cmd') return h + (cmdJob === null ? cmdGridHtml(r) : cmdWinHtml(r, cmdJob))
    if (heroTab === 'jail') {
      if (caps.length === 0) return h + `<p class="mute">옥에 가둔 적장이 없다. 싸움에서 「적장 사로잡기」로 잡아 온다.</p>`
      h += `<p class="mute">회유하면 우리 장수가 된다 ${guideBtn('jail')}</p>`
      for (const x of caps) h += heroRow(r, x, miniHtml(wooKit(r), realm!, x.id))
      return h
    }
    if (heroTab === 'foe') {
      if (foes.length === 0) return h + `<p class="mute">아직 겨뤄 보거나 정찰로 본 적장이 없다.</p>`
      for (const x of foes) h += heroRow(r, x)
      return h
    }
    for (const x of ruler) h += heroRow(r, x)
    h += `<h4>장군 · 누르면 능력치와 할 일</h4>`
    const hiredNow = new Set(heroOrders.flatMap((o) => (o.kind === 'hire' ? [o.hero] : [])))
    for (const x of mine.filter((y) => !isRuler(r, y.id))) h += heroRow(r, x, hiredNow.has(x.id) ? `<span class="newb">새로 들였다</span>` : '')
    // 자라는 아이 — 아직 장수가 아니라 일을 못 맡는다 (형 10-24)
    const kids = (r.growing ?? []).filter((g) => g.hero.faction === me())
    if (kids.length > 0) {
      h += `<h4>자라는 아이</h4>`
      for (const g of kids) h += `<div class="hrow busy grow">${bust(g.hero)}<i class="hbz">⏳</i><span class="hb"><b>${nameHtml(g.hero.name)}</b><span class="hdo">⏳ 자라는 중 · ${Math.max(1, g.grown - r.season)}계절 뒤 장수로</span><span class="mute">${(g.hero.parents ?? []).map((p) => r.heroes[p]?.name ?? '').filter((s) => s !== '').join(' · ')}의 아이</span></span></div>`
    }
    // 떠돌이 인재 — 들일 수 있는 이
    if (wand.length > 0) {
      h += `<h4>떠돌이 인재가 우리 고을에 왔다</h4>`
      // 추천 딱지 — 곡식이 닿는 이 가운데 가장 센 하나 (아무도 안 들였을 때)
      const anyHired = heroOrders.some((o) => o.kind === 'hire')
      const pickW = anyHired ? undefined : [...wand].filter((w) => left().grain >= w.price).sort((a, b) => (b.hero.mu + b.hero.tong + b.hero.ryak + b.hero.chi) - (a.hero.mu + a.hero.tong + a.hero.ryak + a.hero.chi))[0]
      for (const w of wand) {
        const hired = heroOrders.some((o) => o.kind === 'hire' && o.hero === w.hero.id)
        h += `<div class="askc">${heroRow(r, w.hero, `<span class="mute">${esc(r.nodes[w.node]?.name ?? '')} · ${Math.max(0, w.until - r.season)}계절 안에 떠난다</span>`)}`
        h += `<div class="btns"><button class="btn ${hired ? 'on' : ''}" data-act="hire" data-id="${w.hero.id}" ${hired || left().grain >= w.price ? '' : 'disabled'}>${hired ? '들인다 · 취소' : `들인다 ${costHtml({ grain: w.price })}`}${pickW === w ? REC_ST : ''}</button></div></div>`
      }
    }
    return h
  }

  /** 그 일에 먹히는 능력치의 합 — 가장 맞는 장수를 먼저 */
  function cmdScore(x: Hero, job: CmdJob): number {
    return (CMD_JOBS.find((j) => j.id === job)?.stat ?? []).reduce((n, k) => n + x[k], 0)
  }

  /** 이 장수가 이 일을 지금 못 하는 까닭 — 할 수 있으면 null */
  function cmdWhy(r: Realm, job: CmdJob, x: Hero): string | null {
    const tied = heroJob(r, x.id)
    if (tied !== null) return tied[1]
    if (heroOrders.some((o) => (o.kind === 'assign' || o.kind === 'lead' || o.kind === 'persuade') && o.hero === x.id)) return '이번 계절 자리를 내려놓는다'
    if (job === 'wed') {
      if (x.spouse !== undefined || realm!.heroes[x.id]?.spouse !== undefined) return '짝이 있다'
      return wedHtml(r, x) === '' ? '짝이 될 장수가 없다' : null
    }
    // 장군은 군대를 떠나지 않는다 — 사신·자객으로 못 간다 (엔진 canEscort·plotAgents 와 같게 · 형 10-25: "군사를 맡은 장군은 사신으로 못 보내야")
    if ((job === 'envoy' || job === 'plot') && Object.values(r.armies).some((a) => a.hero === x.id)) return '군대를 이끈다'
    if (job === 'exp') return null // 원정 칸이 제 사정(길 양식·한꺼번에 몇)을 말한다
    if (handLocked(r, x.id)) return '사신·공작을 나르는 손'
    if (job === 'post') return postTargets(r, x) === '' ? '맡을 고을이 없다' : null
    if (job === 'lead') return Object.values(r.armies).some((a) => a.hero === x.id) ? '벌써 군대를 이끈다' : leadTargets(r, x) === '' ? '이끌 군대가 없다' : null
    // 사신·공작 — 고을을 맡은 장수는 제 몸이 손이라 늘 간다 (hands.ownHand)
    return handFor(r, x.id) ? null : '이번 계절 보낼 손이 다 찼다'
  }

  /** 이 일을 맡을 수 있는 우리 장수 — 할 수 있는 이 먼저, 그 일에 맞는 순 */
  /** 장수가 지금 하는 일 — 한 마디 (형 10-27: "장수 일 시킬 때 항상 뭐 하고 있는지 · 도읍 맡고 있으면 맡고 있다고") */
  function doingShort(r: Realm, x: Hero): string {
    if (x.post != null) return `${r.nodes[x.post]?.name ?? ''} 맡음`
    const a = Object.values(r.armies).find((y) => y.hero === x.id)
    if (a !== undefined) return a.march !== null ? `${josa(r.nodes[a.march.to]?.name ?? '', '으로', '로')} 행군` : `${r.nodes[a.at]?.name ?? ''} 군대 이끎`
    return '쉰다'
  }

  function cmdHeroes(r: Realm, job: CmdJob): Array<{ x: Hero; why: string | null }> {
    const def = CMD_JOBS.find((j) => j.id === job)!
    return sorted(Object.values(r.heroes)).filter((x) => x.faction === me() && x.status === 'free' && (def.ruler || !isRuler(r, x.id)))
      .map((x) => ({ x, why: cmdWhy(r, job, x) }))
      .sort((a, b) => (a.why === null ? 0 : 1) - (b.why === null ? 0 : 1) || cmdScore(b.x, job) - cmdScore(a.x, job))
  }

  /** 이번 계절 이 일에 정한 것 — [말, 취소 단추] */
  function cmdNow(r: Realm, job: CmdJob): Array<[string, string]> {
    const nm = (id: string): string => r.heroes[id]?.name ?? ''
    const undo = (act: string, id: string): string => `<button class="btn ghost sm" data-act="${act}" data-id="${id}">취소</button>`
    const out: Array<[string, string]> = []
    for (const o of heroOrders) {
      if (job === 'post' && o.kind === 'assign' && o.node !== null) out.push([`${nm(o.hero)} → ${r.nodes[o.node]?.name ?? ''}`, undo('unhero', o.hero)])
      if (job === 'lead' && o.kind === 'lead') out.push([`${nm(o.hero)} → ${r.armies[o.army] !== undefined ? armyName(r, r.armies[o.army]!) : ''}`, undo('unhero', o.hero)])
      if (job === 'exp' && o.kind === 'expedition') out.push([`${nm(o.hero)} → ${DESTS[o.dest].name}`, undo('unexp', o.hero)])
      if (job === 'wed' && o.kind === 'wed') out.push([`${nm(o.a)} · ${nm(o.b)}`, undo('unwed', o.a)])
    }
    if (job === 'envoy') for (const e of Object.values(envoys)) if (e.hero !== undefined) out.push([`${nm(e.hero)} → ${r.factions[e.to]?.name ?? ''} ${ASK_NAME[e.ask as Ask] ?? ''}`, ''])
    if (job === 'plot') for (const o of plots) if (o.kind === 'plot') out.push([`${PLOT_NAME[o.op]} → ${NIGHT_OPS.has(o.op) ? nm(o.hero ?? '') : r.factions[o.target]?.name ?? ''}${o.agent !== undefined ? ` · ${nm(o.agent)}` : ''}`, ''])
    return out
  }

  /** 명령 — 일 카드 여섯. 카드마다 이번 계절 정한 것 · 아니면 맡길 수 있는 장수 수 */
  function cmdGridHtml(r: Realm): string {
    let h = `<div class="cmdg">`
    for (const j of CMD_JOBS) {
      const now = cmdNow(r, j.id)
      const can = cmdHeroes(r, j.id).filter((c) => c.why === null).length
      const sub = now.length > 0 ? now.map(([t]) => esc(t)).join('<br>') : can > 0 ? `맡길 장수 ${can}` : '지금은 맡길 장수가 없다'
      h += `<button class="cmdc${now.length > 0 ? ' set' : ''}${now.length === 0 && can === 0 ? ' off' : ''}" data-act="cmd" data-job="${j.id}" style="--cbg:url('${ART}event/${j.art}.jpg')">`
        + `<b>${icon(j.icon)}${j.name}</b><span>${j.line}</span><small>${sub}</small></button>`
    }
    return h + `</div>`
  }

  /** 일 창 — 그림 · 이번 계절 정한 것 · 누구를 · 어디로 */
  function cmdWinHtml(r: Realm, job: CmdJob): string {
    const def = CMD_JOBS.find((j) => j.id === job)!
    let h = `<button class="btn ghost sm hback" data-act="cmd-back">‹ 명령</button>`
    h += `<div class="cmdw" style="--cbg:url('${ART}event/${def.art}.jpg')"><b>${icon(def.icon)}${def.name}</b><span>${def.line}</span>`
    for (const [t, b] of cmdNow(r, job)) h += `<div class="banner good">이번 계절: ${esc(t)}${b}</div>`
    h += `</div>`
    // 공작은 갈래부터 — 여섯 가지를 그림으로. 암살만 우리 장수가 몸소 가고(장수 판에서 왔으면 그 장수), 나머지는 나라의 꾀로 한다
    if (job === 'plot') {
      const full = handsOut(r)
      // 갈래는 그림 칩 — 설명은 말풍선 (외교·고을 판의 공작 칩과 같다 · 형 10-26)
      h += `<h4>어떤 공작을</h4><div class="pogrid">`
      for (const op of PLOT_OPS) {
        // 구출 — 잡혀간 우리 장수가 있을 때만
        const none = op === 'rescue' && plotTargets(r, me(), op).length === 0
        h += `<button class="pochip" data-act="cmd-plot" data-op="${op}" data-tip="${esc(none ? '잡혀간 우리 장수가 없다' : PLOT_DOES[op])}"${full || none ? ' disabled' : ''}>${icon(PLOT_ICON[op], 'poic')}<b>${PLOT_NAME[op]}</b></button>`
      }
      return h + `</div>${full ? '<p class="mute">이번 계절 보낼 손이 다 찼다.</p>' : ''}`
    }
    const list = cmdHeroes(r, job)
    if (list.length === 0) return h + `<p class="mute">맡길 장수가 없다.</p>`
    const free = list.filter((c) => c.why === null)
    const pickId = free.some((c) => c.x.id === cmdHero) ? cmdHero : free[0]?.x.id ?? ''
    h += `<h4>누가 가나</h4><div class="cmdp">`
    for (const { x, why } of list) {
      const st = def.stat.map((k) => `<i>${STAT_NAME[k]} ${x[k]}</i>`).join('')
      h += why !== null
        ? `<button class="busy" aria-disabled="true" data-tip="${esc(why)}">${bust(x, 'face')}<b>${nameHtml(x.name)}</b><small>⏳ ${esc(why)}</small></button>`
        : `<button class="${x.id === pickId ? 'on' : ''}" data-act="cmd-hero" data-id="${x.id}">${bust(x, 'face')}<b>${nameHtml(x.name)}</b><small>${st}</small><small class="cdo">${esc(doingShort(r, x))}</small></button>`
    }
    h += `</div>`
    const x = r.heroes[pickId]
    if (x === undefined) return h + `<p class="mute">이번 계절엔 맡길 장수가 없다.</p>`
    switch (job) {
      case 'post': return h + `<h4>어느 고을을</h4>` + postTargets(r, x)
      case 'lead': return h + `<h4>어느 군대를</h4>` + leadTargets(r, x)
      // 맡은 자리가 어떻게 되는지 미리 (한 사람 한 가지 일 · 형 10-25)
      case 'envoy': return h + (x.post != null ? `<p class="mute">따라 나간 계절엔 ${esc(josa(r.nodes[x.post]?.name ?? '', '이', '가'))} 빈다</p>` : '')
        + `<button class="btn pri cmdgo" data-act="hero-envoy" data-id="${x.id}">${icon('good-tribute-bell')}${esc(josa(x.name, '을', '를'))} 보낼 나라를 고른다 ›</button>`
      case 'exp': return h + (Object.values(r.armies).some((a) => a.hero === x.id) ? `<p class="mute">이끌던 군대는 그 자리에 두고 떠난다</p>` : x.post != null ? `<p class="mute">맡은 ${esc(josa(r.nodes[x.post]?.name ?? '', '을', '를'))} 내려놓고 떠난다</p>` : '') + expHtml(r, x)
      case 'wed': return h + wedHtml(r, x)
    }
  }

  /** 고을 맡기의 갈 곳 — 이끌던 군대에서 빠져 이 고을 · 지금 있는 고을 · 우리 땅으로 이어진 다른 고을(정예가 따라가고 한 계절 길에 있다) */
  function postTargets(r: Realm, x: Hero): string {
    const army = Object.values(r.armies).find((a) => a.hero === x.id)
    const at = army?.at ?? x.at ?? null
    if (at === null) return ''
    const holderOf = (n: string): Hero | undefined => Object.values(r.heroes).find((y) => y.post === n && y.faction === me() && y.id !== x.id)
    const card = (n: string, sub: string): string => {
      const hd = holderOf(n)
      return `<button class="cmdt" data-act="assign" data-id="${x.id}" data-node="${n}"><b>${esc(r.nodes[n]?.name ?? '')}</b><small>${sub}${hd !== undefined ? ` · ${esc(hd.name)} 대신` : ''}</small></button>`
    }
    let h = ''
    if (army !== undefined) {
      if (army.march === null && r.nodes[at]?.owner === me() && at !== r.factions[me()]?.capital) h += card(at, '군대에서 빠져 맡는다')
    } else {
      const cap = r.factions[me()]?.capital
      if (x.post !== at && r.nodes[at]?.owner === me() && at !== cap) h += card(at, '지금 있는 고을')
      const far = myTowns(r).filter((n) => n.id !== at && n.id !== cap && n.kind !== 'sodo' && n.hh > 0 && migratePath(r, me(), at, n.id) !== null)
      for (const n of far) h += card(n.id, `정예 ${P.realm.escortMen}명과 한 계절 길`)
    }
    if (h === '') return ''
    return `<div class="cmdts">${h}</div>` + (x.post != null ? `<button class="btn ghost" data-act="assign" data-id="${x.id}" data-node="">맡은 고을을 내려놓는다</button>` : '')
  }

  /** 군대 이끌기의 갈 곳 — 장수 없는 우리 군대 (여기 있으면 바로 · 우리 땅으로 이어진 곳이면 가서) */
  function leadTargets(r: Realm, x: Hero): string {
    const at = x.at
    if (at === null || Object.values(r.armies).some((a) => a.hero === x.id)) return ''
    let h = ''
    for (const a of sorted(Object.values(r.armies)).filter((b) => b.faction === me() && b.march === null && b.hero === null && (b.at === at || (r.nodes[b.at]?.owner === me() && migratePath(r, me(), at, b.at) !== null)))) {
      h += `<button class="cmdt" data-act="lead" data-id="${x.id}" data-army="${a.id}"><b>${esc(armyName(r, a))}</b><small>${headcount(forceOf(r, a))}명 · ${a.at === at ? '여기 있다' : `${esc(r.nodes[a.at]?.name ?? '')}에 가서`}</small></button>`
    }
    return h === '' ? '' : `<div class="cmdts">${h}</div>`
  }

  function heroSheet(r: Realm, id: string): string {
    const x = r.heroes[id] ?? (realm!.wanderers ?? []).find((w) => w.hero.id === id)?.hero
    if (x === undefined) return ''
    const ours = x.faction === me() && x.status === 'free'
    const seen = x.faction === me() || heroSeen(realm!, me(), x.id) || (realm!.wanderers ?? []).some((w) => w.hero.id === id)
    const file = bustOf(x.id)
    let h = `<button class="btn ghost sm hback" data-act="hero-back">‹ 장수 목록</button><div class="hcard">`
    // 사서에 남은 사람 — 얼굴 모서리의 「📜?」를 누르면 사서의 이야기 (형 10-25: 이름 줄에 붙이면 특성처럼 보였다 · 그림과 물음표만)
    const annal = annalOf(x.id)
    h += `<div class="hpic">${file !== undefined ? `<img class="big" src="${ART}bust/${file}.jpg" alt="" data-act="bust-view" data-src="${ART}bust/${file}.jpg">` : bust(x, 'face')}${annal !== undefined ? `<button class="annb" data-act="annal" data-id="${x.id}" aria-label="사서에 남은 이야기">📜<b>?</b></button>` : ''}</div>`
    // 판 밖 단련을 들고 온 장수 — 「단련 n」 (HERO-GROWTH ★ §A)
    h += `<div class="hn">${nameHtml(x.name)}${x.drill !== undefined && x.drill.lv > 0 && x.faction === me() ? ` <span class="dlv">단련 ${x.drill.lv}</span>` : ''}${x.faction === me() ? relicChips(ART, esc, x.relics) : ''}</div><div class="mute">${emblem(x.faction)}${esc(r.factions[x.faction]?.name ?? '떠돌이')}${isRuler(r, x.id) ? ' 군주' : ''} · ${esc(roleLine(r, x))}</div>`
    h += heroRadar(x, seen, ours)
    h += `<div class="tr3">${traitChips(x, seen)}${artChip(x, seen, icon)}</div>`
    if (ours) h += growthHtml(r, x)
    // 아는 만큼 — 우리 장수 · 싸워 봤거나 정찰·첩자로 본 장수 · 이름만 들은 장수 (형: "이름 들어본 군주나 적장이랑 싸워본 적장이랑은 구분해야")
    if (!seen) h += `<p class="heardp">이름만 들었다. 싸워 보거나 정찰하면 능력치와 특성이 보인다.</p>`
    else if (!ours && x.faction !== me()) h += `<p class="mute">싸워 봤거나 정찰로 본 장수, 본 그대로다.</p>`
    const st = splitTitle(x.name)
    if (st.title !== null) h += `<p class="mute">${esc(st.title)}: ${esc(TITLE_MEAN[st.title] ?? '')}</p>`
    h += `<div class="hacts">`
    // 혈통 — 짝과 아이 (SYSTEMS §5-10)
    if (x.spouse !== undefined) {
      const sp = r.heroes[x.spouse]
      const kid = (r.births ?? []).find((v) => v.a === id || v.b === id)
      const honey = honeyLeft(r, id)
      const near = together(r, id, x.spouse)
      // 신혼 — 등불 밝힌 신방 (형 10-23: "가정을 꾸리는 도중에는 야시시한 상태 표시랑 배경 이미지")
      if (honey > 0 && sp !== undefined) {
        h += `<div class="honey" style="--hbg:url('${ART}event/event-bridal-a.jpg')"><div class="hfaces">${bust(x, 'hf')}${bust(sp, 'hf')}</div>`
          + `<b>신방에 들었다</b><span>${esc(josa(sp.name, '과', '와'))} 함께 지낸다 · ${honey}계절</span>`
          + (!near && ours && heroOrders.some((o) => o.kind === 'cohabit' && (o.hero === id || o.hero === x.spouse))
            ? `<button class="btn home sm on" data-act="uncohabit" data-id="${id}">이번 계절 함께 지내러 간다 · 누르면 거둔다</button>`
            : !near && ours && canCohabit(realm!, id) && heroBusy(r, id) === null ? `<button class="btn pri home sm" data-act="cohabit" data-id="${id}">${esc(josa(r.nodes[sp.at ?? '']?.name ?? '', '으로', '로'))} 가서 함께 지낸다</button>` : '')
          + `<button class="btn sm bridal-go" data-act="bridal-look" data-id="${id}">신방을 살펴본다</button>`
          + `<small>${near ? '함께 지낸다' : '떨어져 있다: 이번 계절이 지나면 아이가 한 계절 늦어진다'}${kid !== undefined ? ` · 아이는 ${Math.max(1, kid.due - r.season + 1)}계절쯤 뒤${(kid.late ?? 0) > 0 ? ` (떨어져 지내 ${kid.late}계절 늦어졌다)` : ''}` : ''}</small></div>`
      } else h += `<p class="mute">짝 · ${sp !== undefined ? nameHtml(sp.name) : '?'}${kid !== undefined ? ` · 아이가 ${Math.max(1, kid.due - r.season + 1)}계절쯤 뒤 나선다` : ''}</p>`
    }
    if (x.parents !== undefined) h += `<p class="mute">${x.parents.map((p) => (r.heroes[p] !== undefined ? nameHtml(r.heroes[p]!.name) : '?')).join(' · ')}의 아이</p>`
    const weds = heroOrders.filter((o): o is Extract<Order, { kind: 'wed' }> => o.kind === 'wed' && (o.a === id || o.b === id))
    for (const o of weds) {
      const other = r.heroes[o.a === id ? o.b : o.a]
      h += `<div class="banner good">이번 계절: ${esc(josa(other?.name ?? '', '과', '와'))} 혼인한다 ${costHtml({ grain: P.realm.wedGrain })}<button class="btn ghost sm" data-act="unwed" data-id="${id}">취소</button></div>`
    }
    // 묶인 장수 — 사정만 보이고 할 일은 숨긴다
    const busy = ours ? heroBusy(r, id) : null
    if (busy !== null) h += `<div class="banner busyb">⏳ ${esc(busy)}: 이번 계절엔 다른 일을 못 한다</div>`
    if (ours && canStandBy(r, id)) h += `<button class="btn ghost standby" data-act="standby" data-id="${id}" data-tip="맡은 고을·이끌던 군대·이번 계절 시킨 일을 다 내려놓고 쉰다">⏸ 대기, 다 내려놓고 쉰다</button>`
    // 재상에게 맡김 / 직접 부린다 — 쉬게 되면 누가 일을 주나 (형 10-26)
    if (ours && !isRuler(r, id) && realm !== null && autoIdle(realm)) {
      const self = manualOf(realm).has(id)
      const chan = busy === null ? chanJob(id) : null
      h += `<div class="jsone"><div class="seg"><button class="${self ? '' : 'on'}" data-act="js-one" data-id="${id}" data-v="auto">알아서</button><button class="${self ? 'on' : ''}" data-act="js-one" data-id="${id}" data-v="self">직접 부린다</button></div>`
        + (self ? `<small>쉬어도 스스로 일을 찾지 않는다. 손수 맡긴다</small>` : chan !== null ? `<small>계절이 끝나면 알아서 간다</small>${chanJobHtml(id)}` : `<small>쉬게 되면 계절이 끝날 때 알아서 할 일을 찾아 간다</small>`) + `</div>`
    }
    // 한 번 맺은 짝은 계속 — 지금 판·계절 처음 판 어느 쪽이든 짝이 있으면 혼인 칸을 안 띄운다
    const pending = heroOrders.filter((o) => (o.kind === 'assign' || o.kind === 'lead' || o.kind === 'persuade' || o.kind === 'hire') && o.hero === id)
    for (const o of pending) {
      const what = o.kind === 'assign' ? (o.node === null ? '맡은 일을 그만둔다' : `${josa(r.nodes[o.node]?.name ?? '', '을', '를')} 맡는다`) : o.kind === 'lead' ? '군대를 이끈다' : o.kind === 'hire' ? '우리 장수로 들였다' : '회유한다'
      h += `<div class="banner good">이번 계절: ${esc(what)}<button class="btn ghost sm" data-act="unhero" data-id="${id}">취소</button></div>`
    }
    const locked = ours && busy === null && pending.length === 0 && handLocked(r, id)
    if (locked) h += `<div class="banner busyb">⏳ 이번 계절 사신·공작을 나르는 손이다. 사신·공작을 하나 거두면 이 장수에게 일을 줄 수 있다</div>`
    // 할 일 — 일마다 그림 깔린 창으로 간다 (명령 탭의 그 창에 이 장수를 골라 둔 채로)
    if (ours && pending.every((o) => o.kind === 'hire') && busy === null && !locked) {
      const jobs = CMD_JOBS.filter((j) => (j.ruler || !isRuler(r, id)) && cmdWhy(r, j.id, x) === null)
      if (jobs.length > 0) h += `<div class="cmdm">${jobs.map((j) => `<button data-act="cmd" data-job="${j.id}" data-id="${id}" style="--cbg:url('${ART}event/${j.art}.jpg')">${icon(j.icon)}<b>${j.name}</b></button>`).join('')}</div><p class="mute">한 계절에 한 가지 ${guideBtn('post')}</p>`
    }
    // 회유 — 우리가 사로잡은 장수
    if (x.status === 'captive' && x.captor === me() && x.persuade === undefined && pending.length === 0 && !wooable(r, id)) {
      h += `<p class="mute">${esc(`${r.factions[x.faction]?.name ?? ''}의 군주: 나라가 남아 있는 동안은 꺾이지 않는다. 그 나라를 무너뜨리면 회유할 수 있다.`)}</p>`
    }
    if (x.status === 'captive' && x.captor === me() && x.persuade === undefined && pending.length === 0 && wooable(r, id)) {
      // 얼굴로 고른다 · 벽은 막대와 까닭 · 가망은 % · 곡식은 범위 (WOO §1 · 형 10-29: "장수 얼굴도 안 나오고 뭐가 얼마나 되는지 구체적이지 않음")
      const kit = wooKit(r)
      const byH = wooByOf(r, id)
      const by = byH?.id ?? null
      h += wallHtml(kit, realm!, id)
      h += whoHtml(kit, realm!, id, byH, byH !== null && byH.id === wooBest(realm!, me(), id, kit.jobOf)?.id)
      h += outlookHtml(kit, realm!, id, by)
      h += `<button class="btn pri" data-act="persuade" data-id="${id}" data-by="${by ?? ''}">회유한다 ${costHtml({ grain: P.realm.persuadeGrain }, '계절마다')}</button>`
    }
    if (x.status === 'captive' && x.captor === me() && realm!.heroes[id]?.persuade !== undefined) h += progressHtml(wooKit(r), realm!, id)
    return h + `</div></div>`
  }

  /** 도읍을 잃고 피한 조정 — 되찾을 날이 얼마나 남았나 (형: "내도읍 뺏기자마자 지는건 좀 오바") */
  function exileHtml(r: Realm): string {
    const ex = r.factions[me()]?.exile
    if (ex === undefined || r.outcome) return ''
    const cap = r.nodes[r.factions[me()]!.capital]
    const left = Math.max(1, ex.since + P.realm.exileSeasons - r.season)
    return `<div class="banner bad exileb">${icon('status-bad-omen')}${tx(`도읍 ${josa(cap?.name ?? '', '을', '를')} 잃었다: 조정은 ${r.nodes[ex.seat]?.name ?? ''}에 피해 있다. ${left}계절 안에 되찾지 못하면 나라가 끝난다.`)}</div>`
  }


  /** 회유 화면이 쓰는 손 — 그림 · 이름 · 이번 계절 묶인 장수 */
  function wooKit(r: Realm): WooKit {
    return { esc, bust, name: nameHtml, icon, cost: costHtml, grainIcon: GOOD_ICON.grain, jobOf: (y) => heroJob(r, y)?.[1] ?? null }
  }
  /** 이 포로를 회유할 우리 장수 — 고른 이가 한가하면 그 사람, 아니면 추천 */
  function wooByOf(r: Realm, id: string): Hero | null {
    const kit = wooKit(r)
    const want = persuadeBy[id] !== undefined ? r.heroes[persuadeBy[id]!] : undefined
    if (want !== undefined && want.faction === me() && want.status === 'free' && kit.jobOf(want.id) === null) return want
    return wooBest(realm!, me(), id, kit.jobOf)
  }
  /** 회유할 사람 고르기 상자 — 떴다 사라진다 (굴리지 않는다 · 한 줄에 셋) */
  function wooPaint(): void {
    let ov = root.querySelector<HTMLElement>('.dpov')
    const r = realm !== null && front === null && wooPick !== null ? plan() : null
    const x = r !== null && wooPick !== null ? r.heroes[wooPick] : undefined
    if (r === null || x === undefined || x.status !== 'captive' || x.captor !== me()) { ov?.remove(); wooPick = null; return }
    if (ov === null) {
      root.insertAdjacentHTML('beforeend', `<div class="dpov"></div>`)
      ov = root.querySelector<HTMLElement>('.dpov')!
    }
    ov.innerHTML = pickBoxHtml(wooKit(r), realm!, me(), x.id, wooByOf(r, x.id)?.id ?? null)
  }

  /**
   * 혼인 고르기 — 짝이 될 우리 장수와, 아이가 물려받을 수 있는 것 (정보의 계약 — 혼인 전에 다 보인다)
   * (형의 메모: "팰월드에선 … 알 부화시키기도 도박" — 혈통이 그 자리다)
   */
  function wedHtml(r: Realm, x: Hero): string {
    const busy = new Set(heroOrders.flatMap((o) => (o.kind === 'wed' ? [o.a, o.b] : [])))
    const all = sorted(Object.values(r.heroes)).filter((y) => y.id !== x.id && !busy.has(y.id) && canWed(r, me(), x.id, y.id))
    // 이미 일을 맡은 상대는 고를 수 없게 흐리게 · 무슨 일인지 (형 10-24)
    const cands = all.filter((y) => heroBusy(r, y.id) === null)
    const tied = all.filter((y) => heroBusy(r, y.id) !== null)
    if (all.length === 0) return ''
    const grain = r.stock[me()]?.grain ?? 0
    let h = `<div class="wed"><b>혼인</b>${costHtml({ grain: P.realm.wedGrain }, '잔치')}<span class="mute">${P.realm.wedSeasons}계절쯤 뒤 아이가 자라 나선다. 부모 특성은 하나하나 반반으로 내려오고, 드물게(${Math.round(P.realm.wedSurprise * 100)}%) 둘 다 없던 한 등급 위 특성이 터진다.</span>`
    for (const y of cands) {
      const inh = inheritOf(r, x.id, y.id)
      const chips = inh.traits.map((t) => TRAIT[t]).filter((t) => t !== undefined)
        .map((t) => `<span class="trait${t!.bad === true ? ' bad' : ''}" style="--g:${GRADE_COLOR[t!.grade]}"><b>${esc(t!.name)}</b><i>반반</i></span>`).join('')
      h += `<button class="wcand" data-act="wed" data-id="${x.id}" data-with="${y.id}"${grain < P.realm.wedGrain ? ' disabled' : ''}>${bust(y, 'face')}<span><b>${nameHtml(y.name)}</b>`
      h += `<span class="tr3">${chips}<span class="trait" style="--g:${GRADE_COLOR[inh.surpriseGrade]}"><b>?</b><i>${GRADE_NAME[inh.surpriseGrade]} 이상 · 드묾</i></span></span></span></button>`
    }
    for (const y of tied) h += `<button class="wcand busy" disabled>${bust(y, 'face')}<span><b>${nameHtml(y.name)}</b><span class="hdo">⏳ ${esc(heroJob(r, y.id)?.[1] ?? '')}</span></span></button>`
    if (grain < P.realm.wedGrain) h += `<p class="mute">곡식이 모자란다 (${Math.floor(grain)} / ${P.realm.wedGrain}).</p>`
    return h + `</div>`
  }

  /**
   * 원정 — 먼 땅 넷 · 길이 셋 · 무엇이 자주·가끔·드물게 나오나 (숫자 대신 말 — 메모리 realm-no-numbers). 결과는 보낼 때 정해진다
   * (형의 메모: "팰월드에선 … 매 지대에서 확인 … 발견도 도박" — 팰 파견 자리)
   */
  /**
   * 이 장수의 원정 고르기 — 화면이 보여 주는 것과 「보낸다」가 보내는 것이 같아야 한다.
   * (형 10-24: "원정 보냈는데 다음 계절에 계속 활성화된 상태" — 땅을 안 누르고 보내면 화면은 갈 수 있는 첫 땅을 보이는데
   *  명령은 「왜의 포구」로 나가, 2장처럼 왜에 못 닿는 판에서는 계절을 넘길 때 원정이 빠졌다)
   */
  function expPickOf(r: Realm, id: string): { dest: ExpDest; len: 0 | 1 | 2 } {
    const dests = DEST_IDS.filter((d) => destReachable(r, me(), d))
    const pick0 = expPick[id] ?? { dest: dests[0] ?? DEST_IDS[0]!, len: 1 as 0 | 1 | 2 }
    return dests.includes(pick0.dest) || dests.length === 0 ? pick0 : { ...pick0, dest: dests[0]! }
  }

  function expHtml(r: Realm, x: Hero): string {
    const away = onExpedition(r, x.id)
    if (away !== undefined) return `<div class="exp" style="--expbg:url('${ART}exp/exp-${away.dest}.jpg')"><b>원정 중</b><span class="mute">${esc(DESTS[away.dest].name)} · ${Math.max(1, away.back - r.season + 1)}계절 뒤 돌아온다. 무엇을 가져올지는 떠날 때 이미 정해졌다.</span></div>`
    if (x.faction !== me() || x.status !== 'free' || isRuler(r, x.id)) return ''
    const sent = heroOrders.find((o): o is Extract<Order, { kind: 'expedition' }> => o.kind === 'expedition' && o.hero === x.id)
    if (sent !== undefined) return `<div class="banner good">이번 계절: ${esc(josa(DESTS[sent.dest].name, '으로', '로'))} 원정 · ${EXP_SEASONS[sent.len]}계절<button class="btn ghost sm" data-act="unexp" data-id="${x.id}">취소</button></div>`
    // 이번 계절 다른 일을 맡은 장수 — 땅·길이 단추까지 다 눌려 보이면 시킬 수 있는 줄 안다 (형 10-24). 한 줄로만
    const tiedUp = heroBusy(r, x.id)
    if (tiedUp !== null) return `<div class="exp off"><b>원정</b><span class="mute">⏳ ${esc(tiedUp)}: 이번 계절엔 못 보낸다</span></div>`
    // 먼 땅은 다 보이되 못 가는 곳은 흐린 단추로 — 왜 못 가는지는 단추 밑에 (형 10-23: "못 가면 버튼은 있지만 비활성화 · 보낼 수 있는지 없는지도 모르잖아")
    const dests = DEST_IDS.filter((d) => destReachable(r, me(), d))
    const pick = expPickOf(r, x.id)
    const farWhy = (d: ExpDest): string => (DESTS[d].from.includes(r.region ?? 'byeonhan-mini') ? '포구가 있어야' : '이 땅에선 멀다')
    const word = (p: number): string => (p >= 0.3 ? '자주' : p >= 0.12 ? '가끔' : p > 0 ? '드물게' : '없다')
    const odds = expOdds(x, pick.dest, pick.len)
    // 쉬는 장수가 원정을 떠나면 사람 손이 하나 준다 — 이미 고른 공작·사신이 버려지지 않게 (형 10-23: "방화·소문 이미 보냈는데 원정을 중복해서 보낼 수 있는 건 말이 안 되지")
    const handsShort = idleHeroes(r, me()).includes(x.id) && handsUsed() > handsCap(r) - 1
    // 같은 계절에 고른 다른 원정과, 다른 데 쓰기로 한 곡식까지 센다 — 계절을 넘길 때 막혀 말없이 빠지지 않게 (형 10-24: "원정 보낸 것 같은데 다음 계절 또 쉬는 장수")
    const sending = heroOrders.filter((o) => o.kind === 'expedition').length
    const busyNow = (realm!.expeditions ?? []).filter((e) => e.faction === me()).length
    const queued = busyNow + sending >= P.realm.expMax ? `원정은 한꺼번에 ${P.realm.expMax}까지다` : left().grain < P.realm.expGrainPer * EXP_SEASONS[pick.len] ? '길 양식이 모자란다. 이번 계절 다른 데 쓰기로 한 곡식을 빼면' : null
    const block = heroBusy(r, x.id) ?? expBlock(r, me(), x.id, pick.dest, pick.len) ?? queued ?? (handsShort ? '이번 계절 사람 손이 다 찼다. 공작·사신을 줄이면 보낼 수 있다' : null)
    // 고른 먼 땅의 그림이 원정 칸 뒤에 깔린다 — 고르면 바뀐다
    let h = `<div class="exp" style="--expbg:url('${ART}exp/exp-${pick.dest}.jpg')"><b>원정</b><span class="mute">먼 땅으로 보낸다. 좋은 장수일수록 좋은 것을 가져오지만, 그동안 판에 없다.</span><div class="seg expd">`
    for (const d of DEST_IDS) {
      const ok = dests.includes(d)
      h += `<button class="${d === pick.dest ? 'on' : ''}" data-act="exp-dest" data-id="${x.id}" data-v="${d}" ${ok ? '' : 'disabled'}>${esc(DESTS[d].name)}${ok ? '' : `<small>${farWhy(d)}</small>`}</button>`
    }
    h += `</div><p class="mute">${esc(DESTS[pick.dest].line)}${DESTS[pick.dest].sea ? ' (우리 포구에서 배를 띄운다)' : ''}</p><div class="seg">`
    for (const l of [0, 1, 2] as const) h += `<button class="${l === pick.len ? 'on' : ''}" data-act="exp-len" data-id="${x.id}" data-v="${l}">${['짧게', '보통', '길게'][l]} · ${EXP_SEASONS[l]}계절</button>`
    h += `</div><div class="odds">`
    const rows: Array<[keyof typeof odds, string]> = [
      ['iron', `쇠 (${expAmount(x, pick.dest, pick.len, 'iron')}쯤)`], ['grain', `곡식 (${expAmount(x, pick.dest, pick.len, 'grain')}쯤)`],
      ['wanderer', '그곳 사람이 따라온다 (새 장수)'], ['skill', `낯선 재주 (${DESTS[pick.dest].skills.map((t) => TRAIT[t]?.name ?? t).join('·')})`], ['none', '빈손'],
    ]
    for (const [k, label] of rows) h += `<span class="od ${k}"><i style="width:${Math.round(odds[k] * 100)}%"></i><b>${esc(label)}</b><em>${word(odds[k])}</em></span>`
    h += `</div>`
    // 못 보내도 단추는 그대로 — 흐리게 두고 까닭을 밑에 (형 10-23: "버튼은 두되 비활성화해 두라고")
    h += `<button class="btn" data-act="exp-go" data-id="${x.id}" ${block !== null ? 'disabled' : ''}>${esc(josa(DESTS[pick.dest].name, '으로', '로'))} 보낸다 ${costHtml({ grain: P.realm.expGrainPer * EXP_SEASONS[pick.len] }, '길 양식')}</button>`
    if (block !== null) h += `<p class="mute">${esc(block)}</p>`
    return h + `</div>`
  }

  // ───────── 정찰
  function scoutSheet(r: Realm): string {
    const known = r.intel[me()] ?? {}
    let h = ''
    for (const id of scoutable(r)) {
      const n = r.nodes[id]!
      const f = known[id]?.force
      const age = f ? r.season - f.season : null
      const v = f ? visibleRange({ f0: f.f0, src: f.src, u: f.u }, age!) : null
      h += `<div class="srow"><button class="row ${scout === id ? 'prs' : ''}" data-act="scout" data-node="${id}">${emblem(n.owner)}<span class="dest">${esc(n.name)}</span>`
      h += `<span class="sub">${v !== null ? `${span(v[0], v[1], (x) => String(Math.round(x)))} · ${age === 0 ? '이번 계절' : `${age}계절 전`}` : '못 봤다'}</span></button>`
      // 📌 고정 — 매 계절 저절로 여기로
      h += `<button class="pin${scoutKeep === id ? ' prs' : ''}" data-act="scout-keep" data-node="${id}" data-tip="${scoutKeep === id ? '매 계절 여기로 정찰: 누르면 고정을 푼다' : '매 계절 여기로 정찰 고정'}" aria-label="정찰 고정">📌</button></div>`
    }
    if (scoutKeep !== '' && !scoutable(r).includes(scoutKeep)) h += `<p class="mute">📌 고정한 ${esc(josa(r.nodes[scoutKeep]?.name ?? '', '은', '는'))} 지금 맞닿지 않아 쉰다</p>`
    return h
  }

  // ───────── 나라
  function nationSheet(r: Realm): string {
    const info = nationsOf(r.region ?? 'byeonhan-mini').find((x) => x.id === me())
    const mine = Object.values(r.nodes).filter((n) => n.owner === me())
    const st = r.stock[me()] ?? { grain: 0, iron: 0 }
    let h = `<div class="nhead">${nationFace(me())}<div><h3>${emblem(me())}${esc(r.factions[me()]?.name ?? '')}</h3><p class="mute">${esc(info?.blurb ?? '')}</p>${info !== undefined ? `<p class="mute src">${esc(info.source)}</p>` : ''}</div></div>`
    // 군주가 사로잡혔다 — 돌아오는 길을 말한다 (형 10-23: "주몽을 뺏겨 버렸네 … 주몽 없이 고구려를 어떻게 끌지")
    const rul = r.factions[me()]?.ruler
    const rh = rul !== undefined ? r.heroes[rul] : undefined
    if (rh !== undefined && rh.status === 'captive' && rh.captor !== null) {
      const by = r.factions[rh.captor]?.name ?? ''
      h += `<div class="banner bad">${tx(`⛓ 군주 ${josa(rh.name, '이', '가')} ${by}에 사로잡혀 있다. ${josa(by, '과', '와')} 화친을 맺거나 ${by}의 도읍을 빼앗으면 돌아온다. 그동안 군주의 다스림이 걸리지 않는다.`)}</div>`
    }
    h += customsHtml({ esc, icon }, me(), customsOf(r, me()))
    const need = winNeed(r.region ?? 'byeonhan-mini')
    const held = Object.values(r.factions).filter((x) => r.nodes[x.capital]?.owner === me()).length
    h += cardHtml(realm!) // 미리 적용한 판(r)에선 카드가 이미 답해져 사라졌다 — 실제 판으로
    if (r.scenario === undefined) h += `<div class="goal">목표 · 도읍 ${need}곳을 차지한다 (우리 도읍 포함) <b>${held} / ${need}</b>${(r.tier ?? 1) !== 1 ? ` <span class="tierc">${levelName(r.tier ?? 1)}</span>` : ''}</div>`
    h += exileHtml(r)
    // 캠페인의 장은 그 장의 목표가 승리 조건 — 모두 이루면 이기고 다음 장이 열린다 (넷 가운데 하나인 일반 판의 길은 안 쓴다) (형 10-23: "좌상단 체크 깨는 거는 그걸 깨야 다음 게임이 열려서 그런 거지?")
    if (r.scenario !== undefined) h += `<div class="paths chapg"><h4>이 장의 승리 조건 <small>모두 이루면 이긴다 · 이기면 다음 장이 열린다</small></h4>${goalRowsHtml(r, esc)}</div>`
    else h += pathsHtml(r, held, need)
    h += `<div class="grid4"><div>${icon('settle-farm-village')}<b>${mine.length}</b><span>고을</span></div>`
    h += `<div>${icon('good-hemp')}<b>${Math.floor(mine.reduce((s, n) => s + n.hh, 0))}</b><span>집</span></div>`
    h += `<div>${icon('good-rice')}<b>${Math.floor(st.grain)}</b><span>곡식</span></div>`
    h += `<div>${icon('treasure-iron-ingots')}<b>${Math.floor(st.iron)}</b><span>철</span></div></div>`
    const caps2 = Object.values(r.heroes).filter((x) => x.status === 'captive' && x.captor === me())
    if (caps2.length > 0) {
      h += `<h4>사로잡은 장수</h4><div class="caps">`
      for (const x of caps2) h += `<div class="cap">${bust(x, 'cface')}<b>${nameHtml(x.name)}</b><span class="mute">${STAT_NAME.mu} ${x.mu} · ${STAT_NAME.ryak} ${x.ryak} · ${STAT_NAME.chi} ${x.chi} · ${STAT_NAME.deok} ${x.deok}</span></div>`
      h += `</div>`
    }
    // 차림 — 세 칸 격자로 줄을 맞춘다: 보기 · 설정과 다른 놀이 · 판 (형: "버튼들이 너무 질서없이")
    h += `<div class="menu3"><button class="btn" data-act="help">도움말</button><button class="btn" data-act="log-open">지난 기록</button><button class="btn" data-act="dex-open">영웅전</button>`
    if (!installed() && installPrompt() !== null) h += `<button class="btn ghost" data-act="install">앱으로 설치, 바 없는 전체 화면</button>`
    if (host.saves !== undefined) h += `<button class="btn" data-act="save-open" data-tip="판을 저장 칸에 남기거나 불러온다 · 파일로 내려받기">저장 · 불러오기</button>`
    h += `<button class="btn ghost" data-act="mute">${muted() ? '소리 켜기' : '소리 끄기'}</button><button class="btn ghost" data-act="export" data-tip="지금까지 둔 판 ${host.gameCount()}개의 기록을 파일로 받는다">기록 내보내기</button>`
    h += `<a class="btn ghost" href="${(import.meta.env?.BASE_URL ?? '/')}" data-tip="활쏘기 모드 (신궁)">활터</a>${PRACTICE_READY ? `<button class="btn ghost" data-act="practice-open">궁술 연습장</button>` : ''}`
    h += `<button class="btn ghost" data-act="newgame" data-tip="판 고르기로, 새 게임을 시작하기 전까지 지금 판은 그대로다">새 게임</button><button class="btn ghost" data-act="lobby" data-tip="이 판은 저장돼 있어 「이어 하기」로 돌아온다">⌂ 첫 화면으로</button></div>`
    return h + acctHtml() + resetHtml()
  }

  // ───────── 계정 (docs/realm/SERVER.md) — 나라 판 맨 아래 · 첫 화면 한 줄 · 갈라진 판 고르기
  /** 계정 지우기를 한 번 눌렀다 — 두 번째 누름에서 지운다 (브라우저 확인 창은 쓰지 않는다) */
  let acctArmed = false
  /** 이번에 띄운 동안 「확인」으로 닫았다 (다시 보지 않기를 안 골랐으면 다음에 켤 때 또 뜬다) */
  let instClosed = false
  /** 「플레이 기록 지우기」를 한 번 눌렀다 — 한 번 더 눌러야 지운다 */
  let resetArmed = false
  function syncWord(s: SyncState): string {
    switch (s.kind) {
      case 'off': return '클라우드 저장 꺼짐'
      case 'busy': return '클라우드에 저장하는 중…'
      case 'choose': return '두 기기의 판이 갈라졌습니다. 하나를 골라 주세요'
      case 'error': return `클라우드 저장 못 함. ${s.msg}`
      case 'idle': return s.at !== null ? `최근 클라우드 저장 ${new Date(s.at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}` : '클라우드 저장 준비됨'
    }
  }
  /** 플레이 기록 지우기 — 계정과 설정은 남긴다. 두 번 눌러야 (형 10-24: "계정으로 플레이한 데이터 초기화하는 버튼") */
  function resetHtml(): string {
    if (host.resetPlay === undefined) return ''
    const cloud = host.cloud?.who() != null
    return `<h3>기록 지우기</h3><div class="acct"><p class="mute">지금 판 · 저장 칸 · 영웅전 · 해금한 판 · 연대기 · 데려갈 장수를 다 지우고 처음부터 한다.${cloud ? ' 계정에 저장된 같은 기록도 함께 지운다.' : ''} 계정과 소리 같은 설정은 남는다. 되돌릴 수 없다.</p>`
      + `<div class="btns"><button class="btn ghost danger" data-act="reset-play">${resetArmed ? '한 번 더 누르면 지운다. 되돌릴 수 없다' : '플레이 기록 모두 지우기'}</button></div></div>`
  }

  function acctHtml(): string {
    const c = host.cloud
    if (c === undefined) return ''
    let h = `<h3>계정</h3><div class="acct">`
    if (!c.available()) return h + `<p class="mute">이 브라우저에서는 로그인·클라우드 저장이 안 된다 (너무 옛 브라우저). 이 기기에서는 그대로 이어 한다.</p></div>`
    const who = c.who()
    if (who === null) {
      h += `<p class="mute">구글로 로그인하면 판이 클라우드에 저장돼 폰·피시 어디서든 이어 한다. 로그인하지 않아도 이 기기에는 저장된다.</p>`
      return h + `<div class="btns"><button class="btn pri" data-act="acct-in">구글 로그인</button></div></div>`
    }
    h += `<p><b>${esc(who.name !== '' ? who.name : who.email)}</b> <span class="mute">${esc(who.email)}</span></p><p class="mute">${esc(syncWord(c.state()))}</p>`
    h += `<div class="btns"><button class="btn" data-act="acct-sync">지금 클라우드 저장</button><button class="btn ghost" data-act="acct-out">로그아웃</button>`
    h += `<button class="btn ghost danger" data-act="acct-del">${acctArmed ? '한 번 더 누르면 삭제: 클라우드의 판·영웅전·기록이 다 지워진다' : '계정 삭제'}</button></div></div>`
    return h
  }
  /** 첫 화면 한 줄 — 새 기기에서 판을 시작하기 전에 들어와야 저쪽 판을 받는다 */
  /**
   * 앱으로 설치 — 웹에서 하는 사람에게 권하는 카드 (형 10-24: "ios 에서도 PWA 로 받을 수 있지? · 제안하는 카드 · 다시 보지 않기 · 체크해도 웹이면 언제든 받을 수 있게").
   * 아이폰 사파리는 설치 단추가 없다 — 공유 → 「홈 화면에 추가」를 글로. 안드로이드·피시 크롬은 설치 단추(있으면). 숨겨도 작은 단추는 늘 남는다.
   */
  function installCard(): string {
    if (installed()) return ''
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    let hide = false
    try { hide = localStorage.getItem(INSTALL_HIDE_KEY) === '1' } catch { hide = false }
    if (hide || instClosed) return '' // 다시 여는 단추는 「더 보기」 안에 (frontHtml links)
    // 카카오톡 안의 브라우저는 설치를 못 한다 — 바깥 브라우저(크롬·사파리)로 여는 단추 (지인들은 카톡으로 받은 주소를 연다)
    if (/KAKAOTALK/i.test(navigator.userAgent)) {
      return `<div class="instc"><button class="instx" data-act="inst-ok" aria-label="닫기">✕</button><b>📲 앱으로 설치하면 더 편리합니다</b><p>카카오톡 안에서는 설치할 수 없습니다. 아래 단추로 ${ios ? '사파리' : '크롬'}에서 연 뒤 설치해 주세요.</p>`
        + `<div class="instr"><a class="btn pri sm" href="kakaotalk://web/openExternal?url=${encodeURIComponent(location.href)}">${ios ? '사파리로' : '크롬으로'} 열기</a><label class="chk"><input type="checkbox" class="insthide"> 다시 보지 않기</label><button class="btn sm" data-act="inst-ok">확인</button></div></div>`
    }
    const how = ios
      ? '사파리 아래 <b>공유</b> 단추(네모에 위 화살표) → <b>「홈 화면에 추가」</b>. 홈 화면의 삼한열전 아이콘으로 열면 주소창 없이 꽉 찬 화면으로 즐길 수 있습니다.'
      : installPrompt() !== null ? '아래 단추를 누르면 바로 설치됩니다. 홈 화면·바탕화면의 아이콘으로 열면 주소창 없이 꽉 찬 화면으로 즐길 수 있습니다.'
        : '브라우저 메뉴(⋮) → <b>「앱 설치」</b> 또는 <b>「홈 화면에 추가」</b>를 누르세요. 아이콘으로 열면 주소창 없이 꽉 찬 화면으로 즐길 수 있습니다.'
    // 첫 화면 위쪽에 뜨는 알림 — ✕ 로 끈다 (형 10-28: "상단에 나오는 팝업으로 만들어서 끌 수 있게")
    return `<div class="instc"><button class="instx" data-act="inst-ok" aria-label="닫기">✕</button><b>📲 앱으로 설치하면 더 편리합니다</b><p>${how}</p>`
      + `<div class="instr">${!ios && installPrompt() !== null ? '<button class="btn pri sm" data-act="install">앱으로 설치</button>' : ''}<label class="chk"><input type="checkbox" class="insthide"> 다시 보지 않기</label><button class="btn sm" data-act="inst-ok">확인</button></div></div>`
  }

  /**
   * 이번 계절 할 일 하나 — 처음 하는 사람에게만, 「다음 계절」 위에. 누르면 그 판이 열린다
   * (형 10-24: "한 화면에 할 일 하나" · 동료가 빨간불을 무시하고 다음 계절만 눌렀다)
   */
  function todoHtml(r: Realm): string {
    if (r.region === 'tutorial' || r.outcome || sheet !== null) return ''
    // 장수가 알아서 일하는 것은 알림 거리가 아니다 — 늘 그렇다 (형 10-26: "원래 자동으로 다 알아서 하지만") · 장수 판 맨 위에 누가 어디로 가는지
    if (!novice()) return ''
    const drafted = musters.some((o) => o.kind === 'draft')
    const canDraft = Object.values(r.nodes).some((n) => n.owner === me() && draftLimit(r, me(), n.id) > 0)
    const idle = tabWait(r, 'heroes') === 0 ? waitingHeroes(r).length : 0
    const asks = openAsks(r, me()).filter((a) => answers[a.id] === undefined).length
    const armyIdle = Object.values(r.armies).some((a) => a.faction === me() && a.march === null && pick[a.id] === undefined && goalOf(a) === undefined)
    const t = asks > 0 && tabWait(r, 'diplo') === 0 ? { tab: 'diplo', line: `사신이 왔다: 외교에서 답한다` }
      : !drafted && canDraft && r.season < 4 ? { tab: 'draft', line: '징병에서 군사를 뽑는다 (⚡ 알아서 뽑기)' }
        : idle > 0 ? { tab: 'heroes', line: `쉬는 장수 ${idle}명: 장수에서 일을 맡긴다` }
          : armyIdle && r.season >= 1 ? { tab: 'army', line: '군대에서 갈 곳을 고른다. 빈땅·약한 이웃' }
            : null
    return t === null ? '' : `<button class="todochip" data-act="tab" data-tab="${t.tab}">👉 이번 계절 · ${esc(t.line)}</button>`
  }

  /**
   * 추천 딱지 — 이번 계절 손대면 좋은 탭 오른쪽 위에 작은 「추천」 (형 10-29: "문명에서는 탭마다 추천 스티커를 우상단에 작게 붙여서 잘 모르는 유저들이 그냥 따라할 수 있게").
   * 처음 하는 사람만 보던 「이번 계절 할 일」(todoHtml)과 같은 셈을 모두에게 · 어지럽지 않게 앞선 둘만 · 지금 열어 둔 탭은 빼고
   */
  function recTabs(r: Realm): Map<string, string> {
    let out = new Map<string, string>()
    if (r.region === 'tutorial' || r.outcome) return out
    const asks = openAsks(r, me()).filter((a) => answers[a.id] === undefined).length
    const drafted = musters.some((o) => o.kind === 'draft')
    const canDraft = Object.values(r.nodes).some((n) => n.owner === me() && draftLimit(r, me(), n.id) > 0)
    const idleHeroes = waitingHeroes(r).length
    const armyIdle = Object.values(r.armies).some((a) => a.faction === me() && a.march === null && pick[a.id] === undefined && goalOf(a) === undefined)
    if (asks > 0) out.set('diplo', `답을 기다리는 사신 ${asks}명`)
    if (idleHeroes > 0) out.set('heroes', `쉬는 장수 ${idleHeroes}명: 일을 맡기면 좋다`)
    if (armyIdle && r.season >= 1) out.set('army', '이번 계절 할 일 없는 군대가 있다')
    if (!drafted && canDraft) out.set('draft', '더 뽑을 수 있는 군사가 있다')
    // 우리 고을로 오는 적 — 군대 탭이 먼저 (막을 군대를 보낸다)
    if (seenMarches(r, me()).some((a) => a.march !== null && r.nodes[a.march.to]?.owner === me())) { out.delete('army'); out = new Map([['army', '우리 고을로 적이 온다. 막을 군대를'], ...out]) }
    if (!out.has('heroes') && wanderersFor(r, me()).length > 0) out.set('heroes', '데려올 수 있는 떠돌이 장수가 있다')
    // 개척 — 임자 없는 빈땅에 지금 개척단을 보낼 수 있으면 (우리 마을에 품이 남은 것은 빈땅이 아니다 · 형 10-29: "개척할 빈땅이 없는데 백성에 추천")
    if (settleRec(r) !== null) out.set('people', '개척할 빈땅이 있다')
    for (const k of [...out.keys()]) if (sheet?.kind === k) out.delete(k)
    return new Map([...out].slice(0, P.realm.recTabMax))
  }

  /**
   * 나의 역사 — 둔 판들을 최근 것부터 (형 10-25). 나라 깃발 · 판(장이면 「n장 이름」) · 이김/짐/그만둠/하는 중 · 몇 계절 · 시작한 날.
   * 옛 기록엔 판 이름이 없어 나라만 보인다
   */
  function annalsHtml(): string {
    // 열자마자 그만둔 판(한 계절도 안 넘긴 것)은 빼고 — 기록이 그것들로 뒤덮였다
    const xs = (host.pastGames?.() ?? []).filter((g) => g.current || g.seasons > 0 || g.end?.kind === 'win')
    const won = xs.filter((g) => g.end?.kind === 'win').length
    const boardOf = (rg: string | null): string => {
      if (rg === null) return ''
      const ch = chapterOfRegion(rg as RegionId)
      return ch !== undefined ? `${ch.n}장 ${ch.name}` : (BOARD_NAME_OF[rg] ?? '')
    }
    let h = `<div class="front annals"><div class="fhead"><button class="btn ghost" data-act="fr-back">‹ 처음으로</button><h2>나의 역사</h2></div>`
    h += `<p class="ansum">둔 판 ${xs.length} · 이긴 판 ${won}</p><div class="anl">`
    for (const g of xs) {
      // 끝이 없으면 하는 중(지금 판) · 멈춘 판(선반에 올려 둔 판 — 첫 화면 「다른 판」에서 잇는다)
      const [cls, word] = g.end === null ? (g.current ? ['now', '하는 중'] : ['quit', '멈춘 판']) : g.end.kind === 'win' ? ['win', '이겼다'] : g.end.kind === 'lose' ? ['lose', '졌다'] : ['quit', '그만뒀다']
      const d = new Date(g.started)
      const date = Number.isFinite(d.getTime()) ? `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}` : ''
      h += `<div class="anr ${cls}">${emblem(g.nation, 'anem')}<span class="ant"><b>${esc(g.name !== '' ? g.name : (FACTION_NAME_OF[g.nation] ?? g.nation))}</b><small>${esc(boardOf(g.region))}${g.tier !== null && g.region !== 'tutorial' ? ` · ${esc(levelName(g.tier))}` : ''}</small></span>`
        + `<span class="anx"><i class="anres">${word}</i><small>${g.end !== null ? esc(seasonLabel(g.end.season)) : `${g.seasons}계절째`} · ${date}</small></span></div>`
    }
    return h + `</div></div>`
  }

  /** 판을 연다 — 데려갈 수 있는 장수가 있으면 먼저 「데려갈 장수」 팝업 (배우는 판·동행이 없는 난세·영웅전에 거느린 이가 없으면 곧장) */
  function startWithBring(nation: string, region: RegionId, tier: number): void {
    if (region === 'tutorial' || retainMaxOf(tier) === 0 || servedHeroes().length === 0) { host.onNewGame(nation, region, tier); return }
    bringAsk = { nation, region, tier }
    bringPopup()
  }
  /** 「데려갈 장수」 팝업을 (다시) 그린다 — 영웅전에서 거느려 본 장수만 · 난세가 허락하는 수까지 체크 */
  function bringPopup(): void {
    if (bringAsk === null) return
    const max = retainMaxOf(bringAsk.tier)
    // 단련한 몸으로 온다 — 카드에 「단련 n」과 그 몸의 능력치 (HERO-GROWTH ★ §A)
    const drill = loadDrill()
    const drilled = (id: string): Hero | null => {
      const b = drillBody(id)
      const e = drill.h[id]
      return b !== undefined && e !== undefined && e.level > 0 ? applyDrill(b, e) : null
    }
    const body = `<div class="bringbox" role="dialog" aria-label="데려갈 장수"><button class="bx" data-act="bring-x" aria-label="닫기">✕</button>${bringHtml(DEX_KIT, servedHeroes(), max, drilled)}`
      + `<div class="bringgo"><button class="btn ghost" data-act="bring-none">혼자 간다</button><button class="btn pri" data-act="bring-go">이대로 떠난다</button></div></div>`
    let ov = root.querySelector<HTMLElement>('.bringov')
    if (ov === null) { root.insertAdjacentHTML('beforeend', `<div class="bringov"></div>`); ov = root.querySelector<HTMLElement>('.bringov')! }
    ov.innerHTML = body
  }

  /** 「저장 · 불러오기」 창을 (다시) 그린다 — 닫혀 있으면 걷는다 */
  function savePaint(): void {
    let ov = root.querySelector<HTMLElement>('.saveov')
    if (saveBox === null || host.saves === undefined) { ov?.remove(); return }
    if (ov === null) {
      root.insertAdjacentHTML('beforeend', `<div class="saveov"></div>`)
      ov = root.querySelector<HTMLElement>('.saveov')!
      // 이름은 다시 그려도 남게 · 파일 고르기는 고른 뒤에 읽는다 (창이 열려 있는 동안만 — 창과 함께 사라진다)
      ov.addEventListener('input', (e) => { const t = e.target as HTMLInputElement; if (saveBox !== null && t.classList.contains('svname')) saveBox.name = t.value })
      ov.addEventListener('change', (e) => {
        const t = e.target as HTMLInputElement
        const f = t.classList.contains('svpick') ? t.files?.[0] : undefined
        if (f === undefined) return
        t.value = ''
        if (f.size > P.realm.saveFileMaxMB * 1024 * 1024) { saveSay('파일이 너무 큽니다. 삼한열전 판으로 읽을 수 없습니다', true); return }
        void f.text().then((text) => saveOpened(host.saves?.loadFile(text) ?? null), () => saveSay('파일을 읽지 못했습니다', true))
      })
    }
    const live = realm !== null && (!realm.outcome || (realm.endless === true && realm.outcome.kind === 'win'))
    ov.innerHTML = saveBoxHtml({ esc, emblem: (f, cls) => emblem(f, cls) }, {
      mode: saveBox.mode, slots: host.saves.list(), name: saveBox.name, placeholder: realm !== null ? defaultLabel(realm) : '',
      nameMax: Math.round(P.realm.saveNameMax), hasGame: live, ask: saveBox.ask, msg: saveBox.msg,
      shelf: saveBox.mode === 'title' ? slotsHtml(KIT, host.slots?.() ?? [], slotArmed) : undefined,
    })
  }
  function saveSay(text: string, bad: boolean): void {
    if (saveBox === null) return
    saveBox.msg = { text, bad }
    saveBox.ask = null
    savePaint()
  }
  /** 불러오기(칸·파일)의 끝 — 됐으면 창을 걷고 그 판으로 들어간다 (realm-main 이 app.show 로 판을 갈아 끼웠다) */
  function saveOpened(why: string | null): void {
    if (why !== null) { saveSay(why, true); return }
    saveBox = null
    savePaint()
    front = null
    paint()
    coverMap()
  }
  /** 물어본 것을 한다 (덮어쓰기 · 비우기 · 불러오기) — 또는 빈 칸 저장 */
  function saveDo(n: number, act: SaveAsk['act'] | 'save'): void {
    const sv = host.saves
    if (sv === undefined || saveBox === null) return
    const label = sv.list()[n]?.label ?? ''
    if (act === 'load') { saveOpened(sv.load(n)); return }
    if (act === 'drop') { const why = sv.drop(n); saveSay(why ?? `${n + 1}번 칸을 비웠습니다`, why !== null); return }
    saveDraft() // 이번 계절에 정해 둔 명령까지 담기게
    const why = sv.save(n, saveBox.name)
    if (why === null) saveBox.name = '' // 다음 저장은 다시 그때의 계절 · 나라 이름으로
    saveSay(why ?? `${n + 1}번 칸에 저장했습니다${act === 'over' && label !== '' ? ` (옛 「${label}」 대신)` : ''}`, why !== null)
  }

  /** 영웅전에 「거느림」으로 오른 장수 — 판을 열 때 데려갈 수 있는 이 (군주는 빼고) */
  function servedHeroes(): ReadonlyArray<{ id: string; name: string }> {
    const dex = loadDex()
    // 가문 — 혼인해서 난 아이도 데려간다 (형 10-25)
    return [...dexCatalog().filter((x) => !x.ruler && ((dex[x.id]?.f ?? 0) & DEX_SERVED) !== 0).map((x) => ({ id: x.id, name: x.name })), ...clanHeroes().map((x) => ({ id: x.id, name: x.name }))]
  }

  /** 처음 하는 사람인가 — 배우는 판 말고 한 판이라도 이겼으면 아니다 */
  function novice(): boolean {
    return !(['mahan', 'jumong', 'seorabeol', 'byeonhan-mini', 'yeongnam', 'south', 'world'] as const).some((b) => tierWon(b) > 0)
  }
  /** 이 탭이 열리기까지 남은 계절 (0 이면 열림) */
  function tabWait(r: Realm, id: (typeof TABS)[number]['id']): number {
    if (r.region === 'tutorial' || !novice()) return 0
    return Math.max(0, TAB_OPEN_AT[id] - r.season)
  }
  /** 이번에 막 열린 탭 — 반짝이고 한 줄 알림 (판마다 한 번) */
  let newTab = ''
  function noteNewTabs(r: Realm): void {
    if (r.region === 'tutorial' || !novice()) return
    const key = 'hanbal.realm.tabsOpen'
    let seen: { seed: number; ids: string[] } = { seed: r.seed, ids: [] }
    try { const v = JSON.parse(localStorage.getItem(key) ?? 'null') as typeof seen | null; if (v !== null && v.seed === r.seed) seen = v } catch { /* 처음 */ }
    for (const t of TABS) {
      if (tabWait(r, t.id) > 0 || seen.ids.includes(t.id)) continue
      seen.ids.push(t.id)
      // 바로 이번 계절에 열린 것만 알린다 — 옛 판을 열었을 때 한꺼번에 뜨지 않게
      if (TAB_NEW_LINE[t.id] !== '' && TAB_OPEN_AT[t.id] > 0 && r.season === TAB_OPEN_AT[t.id]) { newTab = t.id; tabToast(t.name, TAB_NEW_LINE[t.id]) }
    }
    try { localStorage.setItem(key, JSON.stringify(seen)) } catch { /* 저장 못 하는 곳 */ }
  }
  /** 새로 열린 탭 알림 — 아래 탭 위에 한 줄, 7초면 걷히고 누르면 바로 걷힌다 */
  function tabToast(name: string, line: string): void {
    root.querySelector('.tabtoast')?.remove()
    root.insertAdjacentHTML('beforeend', `<div class="tabtoast"><b>🔓 새로 열렸다: ${esc(name)}</b><span>${esc(line)}</span></div>`)
    const el = root.querySelector<HTMLElement>('.tabtoast')!
    const gone = (): void => { el.remove(); if (newTab !== '') { newTab = ''; paint() } }
    el.addEventListener('click', gone)
    window.setTimeout(gone, TAB_TOAST_MS)
  }

  function acctLine(): string {
    const c = host.cloud
    if (c === undefined || !c.available()) return ''
    const who = c.who()
    if (who === null) return `<p class="fine acctl"><button class="btn ghost" data-act="acct-in" data-tip="다른 기기에서 하던 판을 이어 할 수 있습니다">구글 로그인</button></p>`
    return `<p class="fine acctl mute">${esc(who.email)} · ${esc(syncWord(c.state()))}</p>`
  }
  /** 갈라진 판 고르기 — 카드 둘. 고르지 않은 쪽도 기기에 한 벌 남는다 (sync OTHER_KEY) */
  function chooseHtml(): string {
    const s = host.cloud?.state()
    if (s?.kind !== 'choose') return ''
    const card = (x: Side, pick: 'here' | 'there', title: string): string =>
      `<button class="btn pickc" data-act="acct-pick" data-v="${pick}"><small>${title}</small><b>${esc(x.nation)}</b><span>${esc(seasonLabel(x.season))}</span><span class="mute">${x.savedAt !== '' ? esc(new Date(x.savedAt).toLocaleString('ko-KR')) : ''}</span></button>`
    return `<div class="cloudpick"><div><h3>어느 판으로 이어 하시겠습니까</h3><p class="mute">이 기기와 다른 기기에서 따로 나아간 판이 있습니다. 고르지 않은 쪽도 이 기기에 한 벌 남겨 둡니다.</p>`
      + `<div class="pickrow">${card(s.here, 'here', '이 기기 판')}${card(s.there, 'there', '다른 기기 판')}</div></div></div>`
  }

  /**
   * 이기는 길 (VICTORY §1) — 정복: 도읍 막대 · 맹주(진왕): 손잡은 나라 막대 + 네 계절 시계.
   * 남이 맹주에 가까우면 그 나라도 한 줄 (우리가 아는 만큼 — 소문으로 들은 것)
   */
  function pathsHtml(r: Realm, held: number, need: number): string {
    if (r.region === 'tutorial') return ''
    const bar = (v: number, of: number, cls = ''): string => `<span class="pbar ${cls}"><i style="width:${Math.max(3, Math.min(100, (v / Math.max(1, of)) * 100))}%"></i></span>`
    const pact = pactOf(r, me())
    const streak = r.suzerain?.[me()]?.streak ?? 0
    const S = P.realm.suzerainSeasons
    const clock = Array.from({ length: S }, (_, i) => `<i class="${i < streak ? 'on' : ''}"></i>`).join('')
    let h = `<div class="paths"><h4 class="qh">승리 조건 <small>넷 가운데 하나만 이루면 이긴다</small>${guideBtn('paths')}</h4>`
    h += `<div class="path"><b>정복</b>${bar(held, need)}<span>도읍 ${held}/${need}</span></div>`
    h += `<div class="path"><b>맹주</b>${bar(pact.score, pact.need, 'pact')}<span data-tip="속국은 한 나라, 동맹은 반 나라로 센다">속국 ${pact.vassals} · 동맹 ${pact.allies}: ${pact.score}/${pact.need}</span></div>`
    h += `<div class="path sub"><span class="clock">${clock}</span><span class="mute">${streak > 0 ? `맹약 ${streak}/${S} 계절` : '손잡고 네 계절 버티기'}</span></div>`
    // 철과 뱃길 — 교역 장부: 올해 철을 바꾼 나라 깃발이 한 줄로 · 셈(나라 수 × 철) 막대
    const io = ironOf(r, me())
    h += `<div class="path"><b>철·뱃길</b>${bar(io.score, io.need, 'iron')}<span>${io.partners.length}나라 · 철 ${io.iron}</span></div>`
    h += `<div class="path sub"><span class="flags">${io.partners.length > 0 ? io.partners.map((f) => emblem(f, 'fem')).join('') : ''}</span><span class="mute">${!io.gate ? '철광·포구를 쥐어야 열린다' : `올해 ${io.minPartners}나라 넘게와 철 바꾸기`}</span></div>`
    // 큰 제사 — 사슬(봄·가을 제사를 내리) · 집 막대
    const ri = riteOf(r, me())
    const chain = Array.from({ length: ri.need }, (_, i) => `<i class="${i < ri.chain ? 'on' : ''}" title="${i % 2 === 0 ? '봄' : '가을'}"></i>`).join('')
    h += `<div class="path"><b>큰 제사</b>${bar(ri.hh, ri.hhNeed, 'rite')}<span>집 ${ri.hh.toLocaleString('ko-KR')}/${ri.hhNeed.toLocaleString('ko-KR')}</span></div>`
    h += `<div class="path sub"><span class="clock rite">${chain}</span><span class="mute">제사 사슬 ${ri.chain}/${ri.need}</span></div>`
    // 남의 철과 뱃길 · 큰 제사 — 소문으로 들은 것 (아는 나라만)
    for (const key of Object.keys(r.pathNear ?? {}).sort()) {
      const [kind, f] = key.split(':') as [string, string]
      if (f === me() || !knows(r, me(), f)) continue
      h += `<div class="path rival">${emblem(f, 'fem')}<span>${tx(kind === 'iron' ? `소문: ${r.factions[f]?.name ?? ''} 포구로 철이 흐른다. 뱃길을 끊지 않으면 그 나라가 이긴다` : `소문: ${r.factions[f]?.name ?? ''}의 제사 사슬이 길다. 소도 곁 땅을 흔들지 않으면 큰 제사가 열린다`)}</span></div>`
    }
    // 남의 맹약 — 소문 (아는 나라만)
    for (const f of Object.keys(r.suzerain ?? {}).sort()) {
      if (f === me() || !knows(r, me(), f)) continue
      const s = r.suzerain![f]!
      if (s.streak <= 0) continue
      h += `<div class="path rival">${emblem(f, 'fem')}<span>${tx(`소문: ${r.factions[f]?.name ?? ''} 군장이 맹약의 해 ${s.streak}/${S} 계절이다. 깨지 않으면 진왕이 된다`)}</span></div>`
    }
    return h + `</div>`
  }

  function helpSheet(): string {
    return `<h3>도움말</h3><div class="help">`
      + `<p><b>한 계절 = 한 턴.</b> 명령을 고르고 다음 계절을 누른다.</p>`
      + `<p><b>봄</b>에 심은 집 수만큼 가을에 거두니, 봄에 군사를 뽑으면 그만큼 가을걷이가 준다. <b>여름</b>엔 장마로 나루가 막히고 길이 느려진다. `
      + `<b>가을</b>엔 곡식이 들어오고, <b>겨울</b>엔 강이 얼어 언 강을 건너 기습하기 좋지만 고개가 막히고 군량이 더 든다.</p>`
      + `<p><b>개척단</b> 빈땅은 아무도 안 사는 땅이다. 우리 고을에서 「개척단 꾸리기」를 하면 지도에 개척단이 서고, 군대처럼 빈땅으로 옮기면 그 자리에 마을이 선다. 빈땅을 눌러 「개척단 보내기」를 해도 된다. 곡식·나무가 든다. 붐비는 고을의 백성은 저절로 이웃 고을로 옮겨 간다.</p>`
      + `<p><b>백성 · 장정 · 군사</b> 백성은 가구로 센다. 한 가구는 다섯 식구 남짓이고, 농사지어 곡식을 낸다. 징병하면 가구에서 사내를 뽑는다. 군사 둘에 한 가구 몫의 일손이 빠져 그만큼 덜 거둔다. 군사는 움직이고 쳐들어가지만 곡식을 먹는다. 곡식이 떨어지면 사기가 꺾인다. 장정은 뽑히지 않은 사내들로, 적이 오면 돌창·몽둥이를 들고 제 고을만 지킨다(집 둘에 하나꼴 · 수는 많아도 약하다). 해산하면 일손이 집으로 돌아간다.</p>`
      + `<p><b>지도</b> 땅 색과 깃발이 주인. 왼쪽 위 깃발을 누르면 그 나라 땅만 또렷하다. 초록 수는 우리 군사, 붉은 수는 정찰꾼이 본 적 군세, ?는 아직 못 본 곳. ✕는 이번 계절 막힌 길. 보랏빛 화살은 다가오는 적.</p>`
      + `<p><b>판세</b>는 색으로 보인다. 초록이면 이길 듯하고 붉으면 질 듯하다. 두 색이 섞이고 ?가 붙으면 아직 잘 모른다. 정찰하면 또렷해진다.</p>`
      + `<p><b>소도</b> 마한 사람들이 하늘에 제사 지내던 성스러운 터다(삼국지 동이전: 큰 나무에 방울과 북을 달고, 도망친 사람이 들어가면 잡지 못했다). 그래서 아무도 못 친다. 소도 곁 고을을 차지하면 봄·가을에 제사를 지낸다. 봄 제사는 수확을, 가을 제사는 사기를 올린다.</p>`
      + `<p><b>협공</b> 같은 계절에 두 길로 들어가면 한 판으로 싸우고 더 세다.</p>`
      + `<p><b>목표</b> 나라마다 도읍(★)이 하나씩 있다. 판이 클수록 더 많이 쥐어야 한다. 나라 판의 목표 줄에 몇 곳인지 나온다. 우리 도읍을 빼앗기면 진다.</p></div>`
  }

  // ───────── 고을
  function nodeSheet(r: Realm, id: string): string {
    const n = r.nodes[id]!
    const known = (r.intel[me()] ?? {})[id]
    const ours = n.owner === me()
    const who = n.owner === null ? '주인 없음' : (r.factions[n.owner]?.name ?? '')
    const isCap = Object.values(r.factions).some((f) => f.capital === id)
    const kind = n.kind === 'wild' && n.hh > 0 ? SETTLED_NAME : isCap ? (n.kind === 'port' ? '도읍 · 항구' : '도읍') : NODE_KIND_NAME[n.kind]
    let h = `<div class="an big">${icon(nodeIcon(n), 'nic')}<div><h3>${esc(n.name)}${NODE_NOW[id] !== undefined ? ` <small class="mute">지금의 ${esc(NODE_NOW[id]!)}</small>` : ""}</h3><span class="mute">${emblem(n.owner)}${esc(who)} · ${kind}</span></div></div>`
    // 고을지기 자리 — 맨 위에. 비었으면 실루엣과 물음표 (형 10-25: "자리가 비어 있단 걸 확실히") · 누르면 앉힐 장수
    if (ours && n.kind !== 'sodo' && n.hh > 0) h += chiefSlot(r, id) + (foldOpen.has('chief') ? `<div class="nfb">${chiefHtml(r, id)}</div>` : '')
    if (ours || known?.land) {
      const lines = n.tags.map((t) => TAG_LINE[t]).join(' ')
      const now = n.tags.map((t) => tagNow(t, seasonOf(r.season))).filter((x) => x !== null).join(' ')
      h += fold('land', '이 땅 이야기', `${lines !== '' ? `<p class="story">${esc(lines)}</p>` : ''}${now !== '' ? `<p class="mute">${esc(now)}</p>` : ''}`)
    }
    if (n.kind === 'sodo') h += riteCard(r)
    if (n.kind === 'wild') {
      if (n.owner === null) h += `<p class="story">아무도 살지 않는 땅이다. 사람을 보내 일구면 마을이 된다. ${n.room ?? 0}집까지 들어선다.</p>`
      else if (ours && n.hh <= 0) h += `<p class="story">깃발만 꽂은 빈땅이다. 사는 사람이 없어 아무것도 나지 않는다. 개척단이 와야 마을이 선다. 붐비는 이웃 고을이 있으면 백성이 조금씩 저절로 넘어오기도 한다.</p>`
      if (n.owner === null || ours) {
        const can = foundLands(r).includes(id) || partiesOf(r, me()).some((p) => p.march?.to === id)
        h += can ? settleCard(r, id) : `<p class="mute">우리 고을과 길로 맞닿고, 그 길이 열려 있어야 개척단이 간다.</p>`
      }
    }
    if (ours) {
      const men = Object.values(r.armies).filter((a) => a.at === id && a.faction === me() && a.march === null).reduce((s, a) => s + headcount(forceOf(r, a)), 0)
      for (const a of lentToMe(r).filter((x) => x.lent!.node === id)) h += `<p class="story">${emblem(a.faction)} ${esc(r.factions[a.faction]?.name ?? '')} 군대 ${headcount(forceOf(r, a))}명: ${esc(lentLine(r, a))}</p>`
      const g = hhGrowth(r, id)
      const status = `<div class="ntab">`
        + `<span>백성</span><b>${Math.floor(n.hh).toLocaleString('ko-KR')}가구 <small>약 ${Math.round(n.hh * P.realm.peoplePerHH).toLocaleString('ko-KR')}명</small></b>`
        + `<span>늘어남</span><b>다음 계절 ${g.per >= 0 ? '+' : ''}${g.per}가구${g.why.length > 0 ? ` <small>${esc(g.why.map((w) => GROWTH_WHY[w] ?? w).join(' · '))}</small>` : ''}</b>`
        + `<span>지키는 힘</span><b>장정 ${militiaMen(r, id)}${militiaMen(r, id) > 0 ? ` <small>군사 약 ${militiaWorth(r, militiaMen(r, id))}명 몫</small>` : ''} · 군사 ${men}</b>`
        + `<span>징병</span><b>${draftLimit(r, me(), id)}명 더 뽑을 수 있다</b></div>`
      // 고을 형편 · 나는 것 · 고을지기는 접어 둔다 — 제목 줄에 한 줄 요약
      h += fold('stat', `고을 형편 <small class="mute">백성 ${Math.floor(n.hh).toLocaleString('ko-KR')}가구 · 장정 ${militiaMen(r, id)} · 군사 ${men}</small>`, status)
      h += fold('yield', '이 땅에서 나는 것', nodeYieldHtml(r, id))
      h += `<h4 class="nsec">할 일</h4>`
      const guarded = guards.includes(id)
      // 개척단 꾸리기 — 지도에 개척단이 서고 군대처럼 빈땅으로 보낸다. 배우는 판에서는 빈땅 판의 단추로 한다
      for (const p of n.kind !== 'wild' ? partiesOf(realm!, me()).filter((x) => x.at === id && (joining(x.id) || joinHere(id).includes(x))) : []) {
        h += joining(p.id)
          ? `<div class="btns"><button class="btn home wide on" data-act="ptjoin" data-army="${p.id}">${icon('unit-porters')}${esc(r.nodes[p.home]?.name ?? '')} 개척단 ${p.hh}가구가 여기 자리 잡는다 · 누르면 거둔다</button></div>`
          : `<div class="btns"><button class="btn pri home wide" data-act="ptjoin" data-army="${p.id}">${icon('unit-porters')}${esc(r.nodes[p.home]?.name ?? '')} 개척단 ${p.hh}가구를 여기 자리 잡게 한다 · 이주</button></div>`
      }
      if (r.region !== 'tutorial' && n.kind !== 'wild') {
        if (settles.some((o) => o.kind === 'party' && o.node === id)) h += `<div class="btns"><button class="btn home wide on" data-act="party-undo" data-node="${id}">개척단을 꾸렸다 · 누르면 거둔다</button></div>`
        else {
          const k = partySize(r, me(), id)
          const c = partyCost(k)
          const near = partyMoves(r, me(), id).filter((m) => m.found).sort((x, y) => x.seasons - y.seasons || (x.to < y.to ? -1 : 1))[0]
          // 갈 빈땅이 없으면 개척은 할 일이 아니다 — 단추를 아예 안 보인다 (형 10-27: "주변에 빈땅이 있을 때만 · 다른 때에는 개척 전혀 필요가 없잖아")
          if (near !== undefined) {
            const what = `${esc(josa(r.nodes[near.to]?.name ?? '', '으로', '로'))} 개척단 보내기`
            h += `<div class="btns"><button class="btn pri home wide" data-act="party" data-node="${id}" ${k > 0 ? '' : 'disabled'}>${icon('unit-porters')}${what}${k > 0 ? ` · 백성 ${k}가구 ${costHtml({ grain: c.grain, wood: c.wood })}` : ''}</button></div>`
            if (k <= 0) h += `<p class="mute">${esc(partyWhy(r, id))}</p>`
          }
        }
      }
      h += draftCard(r, id, true)
      h += `<div class="btns"><button class="btn ${guarded ? 'on' : ''}" data-act="guard" data-node="${id}" data-tip="경계를 올리면 이 고을로 오는 기습이 잘 들킨다 · 한 계절 동안" ${guarded || (canGuard(r, me(), id) && left().grain >= guardCost().grain) ? '' : 'disabled'}>경계 강화 ${costHtml({ grain: guardCost().grain })}</button></div>`
      // 목책·해자 — 나무로 짓는다 (땅마다 나는 것). 다음 계절에 선다
      const nb = nextBuild(r, id)
      const queued = musters.some((o) => o.kind === 'build' && o.node === id) || (r.builds ?? []).some((b) => b.node === id)
      if (nb !== null) {
        const bc = buildCost(nb, r, me())
        const ok = queued || (canBuild(r, me(), id, nb) && left().wood >= bc.wood && left().grain >= bc.grain)
        h += `<div class="btns"><button class="btn ${queued ? 'on' : ''}" data-act="build" data-node="${id}" data-what="${nb}" ${ok ? '' : 'disabled'}>${queued ? `${BUILD_NAME[nb]} 짓는 중` : `${josa(BUILD_NAME[nb], '을', '를')} 두른다 ${costHtml({ wood: bc.wood, grain: bc.grain })}`}</button></div>`
        h += `<p class="mute">${nb === 'palisade' ? '지키는 쪽이 세진다.' : '목책 앞에서 한 번 더 막는다 · 겨울엔 언다.'} 다음 계절에 선다.</p>`
      }
    }
    // 이 땅에서 나는 것 — 남의 고을·빈땅도 보인다 (칠 까닭 · 바꿀 까닭). 우리 고을은 위 「고을 형편」 밑에 이미 있다
    if (!ours) h += fold('yield', '이 땅에서 나는 것', nodeYieldHtml(r, id))
    if (!ours && n.kind !== 'sodo' && !(n.kind === 'wild' && n.owner === null && known?.force == null)) {
      const f = known?.force
      let force = '못 봤다'
      if (f) {
        const v = visibleRange({ f0: f.f0, src: f.src, u: f.u }, r.season - f.season)
        force = v === null ? '너무 오래됐다' : `${span(v[0], v[1], (x) => String(Math.round(x)))} · ${r.season === f.season ? '이번 계절' : `${r.season - f.season}계절 전`}`
      }
      let alert = ''
      if (known?.alert) {
        const v = alertRange(known.alert.v, r.season - known.alert.season)
        if (v !== null) alert = ` · 경계 ${alertFeel(v[0], v[1])}`
      }
      h += `<p>군세 <b>${force}</b><span class="mute">${alert}</span></p>`
      // 정찰로 본 병종 — 몇 할씩 (형: "정찰하면 '궁수가 많다' 같은 구성이 보이게")
      const sm = seenMix(r, me(), id)
      if (sm !== null) {
        const parts = (Object.entries(sm.mix) as Array<[UnitKind, number]>).filter(([, v]) => v > 0).sort((x, y) => y[1] - x[1])
        h += `<p class="mute">병종 · ${parts.map(([k, v]) => `${UNIT_NAME[k]} ${Math.round(v * 10)}할`).join(' · ')}${sm.age > 0 ? ` (${sm.age}계절 전)` : ''}</p>`
      }
      // 못 가는 곳도 단추는 두되 흐리게 — 왜 못 가는지 (형 10-23: "태백 기슭 마을에는 정찰 보내기 버튼이 왜 없")
      if (!scoutable(r).includes(id)) h += `<div class="btns"><button class="btn" disabled>정찰꾼 보내기</button></div><p class="mute">정찰꾼은 우리 고을과 길로 맞닿은 곳에만 간다</p>`
      // 척후는 한 계절에 한 곳뿐 — 여러 곳을 누르면 다 가는 줄 알지 않게 (형: "매판 눌러줘야하고 누르면 전부다 정찰 가겠지? 할거라고")
      if (scoutable(r).includes(id)) {
        const there = scout !== '' && scout !== id ? (r.nodes[scout]?.name ?? '') : ''
        h += `<div class="scoutbox"><div class="mute">정찰은 한 계절에 <b>한 곳</b> · 군세·병종·경계가 보인다</div>`
        // 보낸 뒤엔 금빛 테 대신 눌려 들어간 단추 (형 10-27: "황금 테두리가 아니라 눌려 있는 버튼 연출로")
        h += `<button class="btn ${scout === id ? 'prs' : ''}" data-act="scout" data-node="${id}">${scout === id ? '정찰꾼이 여기로 간다 · 누르면 거둔다' : there !== '' ? `정찰꾼을 ${esc(there)}에서 여기로 돌린다` : '여기로 정찰을 보낸다'}</button>`
        // 고정 풀기는 따로 떼어 아래에 — 붙어 있으면 잘못 누른다 (형 10-24)
        if (scout === id || scoutKeep === id) h += `<button class="btn sm ${scoutKeep === id ? 'prs' : 'ghost'} keepbtn" data-act="scout-keep" data-node="${id}">${scoutKeep === id ? '📌 매 계절 여기로 고정됨 · 누르면 푼다' : '📌 매 계절 여기로 고정'}</button>`
        h += `</div>`
      }
    }
    // 이 나라와 지금 할 수 있는 것 — 외교 판까지 안 가고 여기서 바로 (형: "타국 마을 누르면 … 얘내랑 할수있는 상호작용만 추려서 보여주고 바로 할수 있게")
    if (!ours && n.owner !== null && n.kind !== 'sodo' && knows(r, me(), n.owner) && r.factions[n.owner] !== undefined) h += nationActs(r, n.owner, id)
    // 보내기는 지도에서 — 군대를 누르고 이 고을을 누른다 (형 10-29)
    return h
  }

  /**
   * 다스리는 장수 — 이 고을을 맡은 장수 (부르는 이름은 형이 고른다 · 「촌장」은 난이도 첫 단계라 안 씀). 장수 판까지 안 가고 고을 판에서 바로 앉히고 바꾼다
   * (형 10-24: "마을 눌렀을 때 거기서도 통치하는 애 배치할 수 있게"). 앉힐 수 있는 이는 장수 판의 「맡는다」와 같다 —
   * 여기 있거나 우리 땅으로 이어진 곳에 있는 한가한 장수 (멀면 정예를 거느리고 그 계절 길에 있다) · 군대를 이끄는 이는 그 군대가 여기 있을 때만
   */
  /** 고을지기 자리 한 칸 — 앉은 이(얼굴·이름) · 자리를 비운 이(흐리게) · 빈자리(실루엣과 ?) · 이번 계절 오는 이 */
  function chiefSlot(r: Realm, id: string): string {
    const posted = Object.values(r.heroes).find((y) => y.post === id && y.faction === me() && y.status === 'free')
    const acting = postHero(r, id) // 도읍은 늘 군주가 맡는다 · 자리를 비운 계절엔 없다
    // 도읍 — 군주의 자리 · 바꿀 수 없다 (형 10-26)
    if (r.factions[me()]?.capital === id) {
      const lord = rulerOf(r, me())
      const away = acting === null
      return `<div class="chslot${away ? ' away' : ''}">${lord !== null ? bust(lord, 'cface') : ''}<span class="chst"><small>고을지기 · 도읍</small><b>${nameHtml(lord?.name ?? '')}</b><i>${away ? '군주가 도읍을 비웠다. 돌아오면 다시 다스린다' : '군주가 몸소 다스린다'}</i></span></div>`
    }
    const coming = heroOrders.find((o): o is Extract<Order, { kind: 'assign' }> => o.kind === 'assign' && o.node === id)
    const cx = coming !== undefined ? r.heroes[coming.hero] : undefined
    const sil = `<span class="chsil"><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="14" r="7.5"/><path d="M5 40c0-10 6.5-15 15-15s15 5 15 15z"/></svg><b>?</b></span>`
    const open = foldOpen.has('chief') ? '▴' : '▾'
    let face: string, name: string, sub: string, cls: string
    if (cx !== undefined) { face = bust(cx, 'cface'); name = cx.name; sub = '이번 계절 온다'; cls = 'come' }
    else if (acting !== null) { face = bust(acting, 'cface'); name = acting.name; sub = isRuler(r, acting.id) && posted === undefined ? '군주가 몸소 맡는다' : `${STAT_NAME.chi} ${acting.chi} · ${STAT_NAME.ryak} ${acting.ryak} · ${STAT_NAME.deok} ${acting.deok}`; cls = '' }
    else if (posted !== undefined) { face = bust(posted, 'cface'); name = posted.name; sub = '이번 계절 자리를 비웠다'; cls = 'away' }
    else { face = sil; name = '비었다'; sub = '앉히면 내정·특성이 이 고을에 걸린다'; cls = 'empty' }
    return `<button class="chslot ${cls}" data-act="fold" data-k="chief">${face}<span class="chst"><small>고을지기</small><b>${nameHtml(name)}</b><i>${esc(sub)}</i></span><i class="chgo">${cls === 'empty' ? '앉힌다' : '바꾼다'} ${open}</i></button>`
  }

  function chiefHtml(r: Realm, id: string): string {
    if (r.factions[me()]?.capital === id) return '' // 도읍은 군주의 자리 — 앉힐 장수가 없다
    const holder = Object.values(r.heroes).find((y) => y.post === id && y.faction === me() && y.status === 'free')
    const coming = heroOrders.find((o): o is Extract<Order, { kind: 'assign' }> => o.kind === 'assign' && o.node === id)
    // 앉은 이는 위의 자리 칸(chiefSlot)이 보인다 — 여기는 앉힐 장수만
    let h = ''
    if (coming !== undefined) {
      const c = r.heroes[coming.hero]
      return h + `<div class="banner good">이번 계절: ${esc(josa(c?.name ?? '', '이', '가'))} 고을지기로 온다<button class="btn ghost sm" data-act="unhero" data-id="${coming.hero}">취소</button></div>`
    }
    const ordered = (hid: string): boolean => heroOrders.some((o) => (o.kind === 'assign' || o.kind === 'lead' || o.kind === 'persuade') && o.hero === hid)
    const reach = (x: Hero): 'here' | 'far' | null => {
      const army = Object.values(r.armies).find((a) => a.hero === x.id)
      if (army !== undefined) return army.march === null && army.at === id ? 'here' : null
      if (x.at === null) return null
      if (x.at === id) return 'here'
      return migratePath(r, me(), x.at, id) !== null ? 'far' : null
    }
    const cands = sorted(Object.values(r.heroes))
      .filter((x) => x.faction === me() && x.status === 'free' && x.id !== holder?.id && !isRuler(r, x.id) && heroBusy(r, x.id) === null && !handLocked(r, x.id) && !ordered(x.id) && reach(x) !== null)
      .sort((a, b) => b.chi - a.chi)
    if (cands.length === 0) return h + `<p class="mute">지금 보낼 수 있는 한가한 장수가 없다.</p>`
    h += `<div class="mute">${holder !== undefined ? '바꿔 앉힐 장수' : '앉힐 장수'} · 내정 높은 순</div><div class="seg wrap farseg">`
    for (const x of cands.slice(0, 8)) {
      const far = reach(x) === 'far'
      h += `<button data-act="assign" data-id="${x.id}" data-node="${id}" data-tip="${far ? `정예 ${P.realm.escortMen}명을 거느리고 온다 · 이번 계절은 길에 있다` : '여기 있어 바로 맡는다'}">${esc(x.name)}<small>${STAT_NAME.chi} ${x.chi}${far ? ' · 먼 길' : ''}</small></button>`
    }
    return h + `</div>`
  }

  /**
   * 장정 N 명이 우리 군사 몇 명 몫인가 — 돌창에 갑옷·진형이 없어 한 사람이 군사의 4~6분의 1 (militiaMorale)
   * (형 10-24: "수성할 때 장정들의 전투력이랑 군사들의 전투력은 차등을 둬야" — 이미 다르다, 머릿수만 보여 몰랐다)
   */
  function militiaWorth(r: Realm, n: number): number {
    const eq = r.factions[me()]?.equip ?? 'bronze'
    const one = strength({ mix: { spear: 100 }, equip: eq, mu: 1, morale: 1 })
    const mil = strength({ mix: { spear: 100 }, equip: 'stone', mu: 1, morale: P.realm.militiaMorale })
    return Math.round((n * mil) / Math.max(1e-9, one))
  }

  /** 생산 — 「생산품 · 곡식 · 나무」 · 이번 계절 얼마 · 가을걷이 · 고기잡이 (형: "나무 난다 이런 말 말고 생산품: 나무") */
  function nodeYieldHtml(r: Realm, id: string): string {
    const n = r.nodes[id]!
    const y = nodeYield(r, id)
    const goods = (['grain', 'iron', 'salt', 'wood', 'horse'] as const).filter((g) => (y[g] ?? 0) > 0)
    const hv = nodeHarvest(r, id)
    const fish = n.kind !== 'sodo' && isCoast(r, id)
    let h = `<h4 class="nsec">생산</h4><div class="ntab">`
    if (goods.length > 0) h += `<span>생산품</span><b>${goods.map((g) => `${icon(GOOD_ICON[g], 'gic')}${GOOD_NAME[g]} ${y[g]}`).join(' · ')} <small>이번 계절</small></b>`
    else {
      // 아무도 안 사는 땅 — 일구면 무엇이 나는지 (지도의 흐린 특산 표와 같은 것)
      const sp = nodeSpecials(r, id)
      if (sp.length > 0) h += `<span>생산품</span><b>${sp.map((g) => `${icon(GOOD_ICON[g], 'gic')}${GOOD_NAME[g]}`).join(' · ')} <small>사람이 살면</small></b>`
    }
    if (hv > 0) h += `<span>가을걷이</span><b>${icon('good-rice', 'gic')}곡식 약 ${hv} <small>여름이 끝날 때</small></b>`
    if (n.kind !== 'sodo' && n.owner !== null) {
      const lm = landMul(r, id)
      if (lm !== 1) h += `<span>땅</span><b>${lm > 1 ? `강가 논: 쌀이 ${Math.round((lm - 1) * 100)}% 더 난다` : `높은 터: 쌀이 ${Math.round((1 - lm) * 100)}% 덜 난다`}</b>`
      // 소수는 안 보인다 — 말로 (형 10-23: "소수는 아무 데도 안 쓰고 있지 않냐")
      if (goods.some((g) => g !== 'grain')) { const w = workMul(n.hh); h += `<span>일손</span><b>${w < 0.75 ? '모자라다' : w < 1.2 ? '알맞다' : '넉넉하다'} <small>사는 집이 많을수록 철·나무·소금·말이 더 난다</small></b>` }
    }
    // 바닷가 — 고기잡이는 겨울에 쉰다 (지도의 고기 표가 겨울엔 얼어 흐려진다)
    if (fish) h += `<span>고기잡이</span><b>${icon('good-dried-fish', 'gic')}${seasonOf(r.season) === 'winter' ? '겨울엔 쉰다 · 봄에 다시' : '곡식이 조금 · 겨울엔 쉰다'}</b>`
    h += `</div>`
    return goods.length > 0 || hv > 0 || fish || nodeSpecials(r, id).length > 0 ? h : ''
  }

  /**
   * 남의 고을을 눌렀을 때 — 그 나라와 이번 계절 할 수 있는 것만 추려서 바로 누르게:
   * 사신(사이에 따라 열리는 것만) · 이 고을에 첩자·매수 · 그 나라에 소문·불 · 이 고을에 있는 적장 암살.
   * 자세히 꾸며야 하는 사신(교역·조공·함께 치자 …)은 외교 판의 그 칸을 열어 준다.
   */
  function nationActs(r: Realm, f: string, node: string): string {
    const fac = r.factions[f]!
    const rel = relationOf(r, me(), f)
    let h = `<div class="nacts"><div class="nah">${emblem(f, 'fem')}<b>${esc(fac.name)}</b><span class="rel ${rel.state}">${REL_NAME[rel.state]}</span>${favorFeel(favorOf(r, me(), f))}</div>`
    // 그 군장의 얼굴 — 우리를 어떻게 보나 (mood.ts)
    const md = moodOf(r, me(), f)
    h += `<div class="moodl ${md.mood}">${moodImg(ART, md.mood)}<div><b>${esc(MOOD_WORD[md.mood])}</b>${said(advisor(r), md.say)}</div></div>`
    // 사신
    // 사신 — 누르면 이 자리에서 누가 가나·무엇을 (형: "사신자세히는 사신선택지들 밑에 있어야할듯")
    h += `<div class="nal">사신</div>`
    for (const e of sentTo(f)) h += sentBanner(r, e, false)
    h += askButtons(r, f, ' sm')
    h += `<div class="btns"><button class="btn ghost sm" data-act="nat-diplo" data-to="${f}">사신 자세히 · 그 나라와 있었던 일</button></div>`
    // 공작 — 그림 칩 격자 · 누른 칩 바로 밑에 노릴 곳과 누가 가나 (plotGrid · 형 10-26: "사신은 간편해졌는데 공작은 아직도 공작이름이랑 설명이 같이 붙어있어서")
    // 이 고을·이 나라에 바로 걸 수 있는 갈래는 누르면 밑에 펼치고, 여기서 못 거는 갈래(두 나라 갈라놓기 · 이 고을에 없는 적장 암살)는 외교의 공작 칸으로
    h += `<div class="nal">공작 <span class="mute">한 계절에 ${P.realm.plotsPerSeason}가지 · 지금 ${plots.length}</span></div>` + plotGrid(r, { f, node })
    // 외교 판의 공작 칸 — 공작 밑에 (형: "외교에서 자세히 누르면 공작으로는 안넘어가네")
    h += `<div class="btns"><button class="btn ghost sm" data-act="nat-plot" data-to="${f}">공작 자세히</button></div></div>`
    return h
  }

  // ───────── 보고 카드
  function sceneOf(b: Realm, after: Realm, rep: Report): string {
    let best: { ev: string; hero: Hero | null; line: string } | null = null
    let rank = 0
    for (const l of rep.lines) {
      if (l.kind !== 'battle') continue
      const weAtk = b.armies[l.attacker]?.faction === after.player
      if (!weAtk && l.defender !== after.player) continue
      const cap = l.captured !== null ? after.heroes[l.captured] : undefined
      const dead = l.killed !== null ? after.heroes[l.killed] : undefined
      const node = after.nodes[l.node]?.name ?? ''
      const cands: Array<[number, { ev: string; hero: Hero | null; line: string }]> = []
      if (cap !== undefined && cap.captor === after.player) cands.push([4, { ev: 'event-capture', hero: cap, line: `${josa(cap.name, '을', '를')} 사로잡았다` }])
      if (dead !== undefined && dead.faction !== after.player) cands.push([3, { ev: 'event-sniped-commander', hero: dead, line: `${josa(dead.name, '이', '가')} 쓰러졌다` }])
      // 겨울 기습은 눈 속 매복 그림으로
      const raid = seasonOf(b.season) === 'winter' ? 'event-winter-ambush' : 'event-night-raid'
      if (weAtk && l.ambush === 'success') cands.push([2, { ev: raid, hero: null, line: `${node}에 몰래 들이쳤다` }])
      if (weAtk && l.ambush === 'caught') cands.push([2, { ev: raid, hero: null, line: `${node} 기습이 들켰다` }])
      if (!weAtk && l.ambush === 'success') cands.push([2, { ev: raid, hero: null, line: `${node}에 기습을 당했다` }])
      // 우리 원군이 닿아 이겼다 — 로한의 기병대 (형: "열세에 밀린 아군에 … 쾌감")
      const ourSide = weAtk ? 'a' : 'd'
      const came = (l.rounds ?? []).find((x) => x.relief?.side === ourSide)?.relief
      const atkWon = l.outcome === 'rout' || l.outcome === 'win'
      if (came !== undefined && atkWon === weAtk && l.outcome !== 'draw') cands.push([3.5, { ev: came.horse ? 'event-relief-cavalry' : 'event-expedition-return', hero: null, line: `원군이 닿아 ${node} 싸움을 이겼다` }])
      // 우리 장수가 사로잡혔다 — 쓰러짐과 따로, 붙잡혀 꿇은 그림으로 (형 10-24: "사로잡았거나 사로잡혔으면 계절 정리 카드에서 이미지 별도로")
      if (cap !== undefined && cap.faction === after.player) cands.push([3.8, { ev: 'event-captured-ours', hero: cap, line: `${josa(cap.name, '이', '가')} 사로잡혔다` }])
      else if (dead !== undefined && dead.faction === after.player) cands.push([1, { ev: 'event-sniped-commander', hero: dead, line: `${josa(dead.name, '을', '를')} 잃었다` }])
      for (const [k, p] of cands) if (k > rank) { rank = k; best = p }
    }
    // 싸움이 없어도 그 계절의 큰일 하나를 그림으로 (형: "보드게임 특성상 UX 부족한 부분들을 … 애니메이션 · 그림으로 채웠잖아")
    const pl = after.player
    const fn = (f: string): string => after.factions[f]?.name ?? ''
    for (const l of rep.lines) {
      let c: [number, { ev: string; hero: Hero | null; line: string }] | null = null
      if (l.kind === 'relation' && (l.a === pl || l.b === pl)) {
        const other = l.a === pl ? l.b : l.a
        if (l.state === 'ally') c = [0.9, { ev: 'event-alliance-oath', hero: after.heroes[after.factions[other]?.ruler ?? ''] ?? null, line: `${josa(fn(other), '과', '와')} 동맹을 맺었다` }]
        else if (l.state === 'truce') c = [0.8, { ev: 'event-outside-envoy', hero: after.heroes[after.factions[other]?.ruler ?? ''] ?? null, line: `${josa(fn(other), '과', '와')} 화친했다` }]
        else if (l.state === 'war') c = [0.7, { ev: 'event-people-quarrel', hero: null, line: `${josa(fn(other), '과', '와')} 전쟁이다` }]
      } else if (l.kind === 'recruit' && l.faction === pl && after.heroes[l.hero] !== undefined) {
        const ev = l.how === 'persuade' ? 'event-captive-persuade' : 'event-wanderer-arrives'
        c = [0.85, { ev, hero: after.heroes[l.hero]!, line: `${josa(after.heroes[l.hero]!.name, '이', '가')} 우리 장수가 됐다` }]
      } else if (l.kind === 'wanderer' && after.nodes[l.node]?.owner === pl) {
        const w = (after.wanderers ?? []).find((x) => x.hero.id === l.hero)
        if (w !== undefined) c = [0.5, { ev: 'event-wanderer-arrives', hero: w.hero, line: `떠돌이 ${josa(w.hero.name, '이', '가')} ${after.nodes[l.node]?.name ?? ''}에 왔다` }]
      } else if (l.kind === 'rite' && l.faction === pl) {
        c = [0.6, { ev: l.season === 'spring' ? 'event-divination' : 'event-festival', hero: null, line: l.season === 'spring' ? '봄 제사를 지냈다' : '가을 제사를 지냈다' }]
      } else if (l.kind === 'card' && l.faction === pl) {
        c = [0.88, { ev: cardInfo({ kind: l.card, ...(l.why !== undefined ? { why: l.why } : {}) }).art, hero: l.hero !== undefined ? after.heroes[l.hero] ?? null : null, line: `${CARDS[l.card].name}: ${l.card === 'quarrel' ? (l.pick === 2 ? '침묵했다' : `${after.heroes[l.hero ?? '']?.name ?? ''} 편을 들었다`) : (CARDS[l.card].opts[l.pick]?.name ?? '')}` }]
      } else if (l.kind === 'expBack' && l.faction === pl) {
        const g = l.got
        const big = g.kind === 'wanderer' || g.kind === 'skill'
        c = [big ? 0.92 : g.kind === 'none' ? 0.3 : 0.6, { ev: 'event-expedition-return', hero: g.kind === 'wanderer' ? after.heroes[g.hero] ?? null : after.heroes[l.hero] ?? null,
          line: `${DESTS[l.dest].name}에서 ${josa(after.heroes[l.hero]?.name ?? '', '이', '가')} 돌아왔다${g.kind === 'wanderer' ? ` · ${josa(after.heroes[g.hero]?.name ?? '', '이', '가')} 따라왔다` : g.kind === 'skill' ? ` · 「${TRAIT[g.trait]?.name ?? ''}」을 배웠다` : ''}` }]
      } else if (l.kind === 'wed' && l.faction === pl) {
        c = [0.7, { ev: 'event-marriage', hero: after.heroes[l.a] ?? null, line: `${josa(after.heroes[l.a]?.name ?? '', '과', '와')} ${josa(after.heroes[l.b]?.name ?? '', '이', '가')} 혼인했다` }]
      } else if (l.kind === 'birth' && l.faction === pl) {
        c = [l.surprise !== undefined ? 0.95 : 0.8, { ev: 'event-newborn', hero: null, line: `${after.heroes[l.a]?.name ?? ''}·${after.heroes[l.b]?.name ?? ''}의 아이 ${josa(after.heroes[l.hero]?.name ?? '', '이', '가')} 나섰다` }]
      } else if (l.kind === 'hunger' && l.faction === pl) {
        c = [0.75, { ev: 'event-sky-drought', hero: null, line: '곡식이 바닥났다' }]
      } else if (l.kind === 'settle' && l.faction === pl) {
        c = [0.5, { ev: 'event-expedition-return', hero: null, line: `${josa(after.nodes[l.to]?.name ?? '', "을", "를")} 일구러 떠났다` }]
      } else if (l.kind === 'blocked' && l.why === 'summerFord' && b.armies[l.army]?.faction === pl) {
        c = [0.5, { ev: 'event-monsoon-ford', hero: null, line: '장마에 나루가 막혔다' }]
      } else if (l.kind === 'build' && l.faction === pl && l.done) {
        c = [0.55, { ev: 'event-palisade-build', hero: null, line: `${after.nodes[l.node]?.name ?? ''}에 ${josa(BUILD_NAME[l.what], "이", "가")} 섰다` }]
      } else if (l.kind === 'rumor' && l.viewer === pl) {
        c = [0.45, { ev: 'event-spy-rumor', hero: null, line: `${fn(l.about)}에서 첩보가 왔다` }]
      } else if (l.kind === 'bowUp' && l.faction === pl) {
        c = [0.65, { ev: 'event-bow-forge', hero: null, line: `자객의 활이 ${josa(BOW_NAME[l.tier] ?? '', '이', '가')} 됐다` }]
      } else if (l.kind === 'pledge' && l.from === pl && l.kept) {
        c = [0.8, { ev: 'event-eight-harbours', hero: null, line: `${josa(fn(l.to), '과', '와')} 함께 쳤다` }]
      } else if (l.kind === 'envoy' && l.from === pl && l.accepted && l.ask === 'trade') {
        c = [0.4, { ev: 'event-iron-trade', hero: null, line: `${josa(fn(l.to), '과', '와')} 물건을 바꿨다` }]
      }
      if (c !== null && c[0] > rank) { rank = c[0]; best = c[1] }
    }
    if (best === null) return ''
    return `<div class="scene"><img class="ev" src="${ART}event/${best.ev}.jpg" alt="">${best.hero !== null ? bust(best.hero, 'who') : ''}<div class="brag">${esc(best.line)}</div></div>`
  }

  /** 끝 화면의 단련 한 줄 — 이번 판에 공을 번 장수와 단련터 단추 (HERO-GROWTH ★ §C) */
  function drillStrip(r: Realm): string {
    const ids = Object.keys(r.merit ?? {}).filter((id) => earnedOf(r, id) > 0)
    const rows = ids.map((id) => ({ id, name: r.heroes[id]?.name ?? id, earned: earnedOf(r, id) })).sort((a, b) => b.earned - a.earned || (a.id < b.id ? -1 : 1))
    const store = loadDrill()
    return yardStripHtml(DRILL_KIT, rows, ids.reduce((s, id) => s + (store.h[id]?.points ?? 0), 0))
  }
  /** 끝 화면에서 단련터로 — 그 판의 우리 장수(쓰러진 이 · 공을 번 이) */
  function yardFromEnd(r: Realm): Front {
    const ours = Object.values(r.heroes).filter((h) => h.faction === me()).map((h) => h.id)
    const ids = [...new Set([...Object.keys(r.merit ?? {}), ...ours])]
    const fell = ids.filter((id) => r.heroes[id]?.status === 'dead')
    return { kind: 'drill', from: 'end', ids, gain: drillGain, fell, anim: true, last: null }
  }

  function modalHtml(r: Realm): string {
    // 이겼어도 계속 두는 판이면 보고가 이어진다 — 도읍을 모두 쥔 계절에 한 번 더 끝 화면
    const endNow = r.outcome && (!r.endless || (r.unified !== undefined && r.unified === r.season - 1))
    if (endNow) {
      if (looking) return ''
      // 이겼으면 다음 난세 단계가 열렸다
      const t = r.tier ?? 1
      const opened = r.outcome?.kind === 'win' && t >= 1 && t < TIER_MAX ? `<p class="tierup">「<b>${levelName(t + 1)}</b>」 세기가 열렸다. 이웃이 처음부터 더 센 판</p>` : ''
      // 휘장 — 이 나라로 이겼다는 표가 나라 고르기에 붙는다 (META §2-①)
      const badge = r.outcome?.kind === 'win' && (r.region ?? 'byeonhan-mini') !== 'tutorial'
        ? `<p class="tierup">${esc(josa(r.factions[me()]?.name ?? '', '으로', '로'))} 이긴 <b>휘장</b>을 받았다. 나라 고르기에 붙는다</p>` : ''
      // 배우는 판은 세기·무덤·단련·데려가기를 말하지 않는다 — 처음 하는 사람에게 아직 없는 것들이다 (형 10-27: "튜토리얼에 아직도 장수 데려가기가 남아 있는 듯")
      if ((r.region ?? 'byeonhan-mini') === 'tutorial') return endingHtml(KIT, r, host.history(), '', `<p class="retainnote"><button class="btn ghost sm" data-act="export">기록 내보내기</button></p>`)
      return endingHtml(KIT, r, host.history(), opened + badge + tombStripHtml(RELIC_KIT, r) + drillStrip(r), `<p class="mute retainnote">우리 장수로 부린 이는 영웅전에 남습니다. 다음 판을 열 때 영웅전에서 골라 데려갈 수 있습니다.</p><p class="retainnote"><button class="btn ghost sm" data-act="export">기록 내보내기</button></p>`)
    }
    if (!showReport || before === null || report === null) return ''
    const season = seasonOf(r.season)
    // 우리가 낀 싸움은 카드로 한 판씩 풀어 보이고, 글 줄에서는 뺀다
    const cards = report.lines.map((l, i) => (l.kind === 'battle' ? battleCard(before!, r, l, me(), ART, i) : ''))
    // 넓어지는 지도 — 모르는 나라 이야기는 들리지 않는다 (줄에 적힌 나라 id 를 훑는다)
    const heard = (l: ReportLine): boolean => r.known === undefined
      || Object.values(l).every((v) => typeof v !== 'string' || r.factions[v] === undefined || knows(r, me(), v))
    // 전쟁 — 우리에게 걸어온 것은 카드로, 남의 나라끼리는 깃발 둘로 (형: "누구랑 누가 전쟁나면 그걸 좀 잘 보여줬음 · 상대가 걸어왔다는걸 알려줘야지")
    type Rel = Extract<ReportLine, { kind: 'relation' }>
    const isWar = (l: ReportLine): l is Rel => l.kind === 'relation' && l.state === 'war'
    const onUs = report.lines.filter((l): l is Rel => isWar(l) && (l.a === me() || l.b === me()) && l.by !== undefined && l.by !== me() && heard(l))
    const between = report.lines.filter((l): l is Rel => isWar(l) && l.a !== me() && l.b !== me() && heard(l))
    const lines = report.lines
      .filter((l, i) => cards[i] === '' && heard(l) && !onUs.includes(l as Rel) && !between.includes(l as Rel))
      .map((l) => ({ l, x: reportText(before!, r, l, me()) }))
      .filter((y): y is { l: ReportLine; x: string } => y.x !== null)
    // 차례 — 나라가 무너졌으면 그것부터, 그다음 싸움 카드, 그다음 소식이 한 줄씩 올라와 쌓인다
    // (형: "한번에 왕창 텍스트 똭 놓지말고 하나씩 올라와서 쌓이게 · 너무빠르게말고 · 한번탭하면 바로 다나오게")
    let t = 0
    // 이번 계절 정할 것(사건 카드 · 사신의 청) — 아직 안 골랐으면 소식보다 먼저 화면 가득, 다 골라야 소식이 열린다
    // (형 10-24: 동료 플레이 "이벤트 선택지를 고르지도 않고 넘어감" · 10-25: "선택해야 하는 이벤트가 뜰 경우에는 화면 전체로 하고 무조건 선택하게")
    const todo = repTodo()
    const decide = cardHtml(realm!) + asksHtml() + wandArrivals().map(wandCard).join('')
    if (todo > 0) {
      // 하나씩 — 둘을 한 화면에 주면 헷갈린다 (형 10-25). 사건 카드 → 사신의 청 → 떠돌이
      const rc = realm!.card
      const first = rc != null && rc.season === realm!.season && answers[`card:${rc.season}`] === undefined ? cardHtml(realm!)
        : openAsks(realm!, me()).filter((a) => answers[a.id] === undefined).map((a) => audienceHtml(a))[0]
          ?? wandArrivals().filter((w) => answers[wandKey(w.hero.id)] === undefined).map(wandCard)[0] ?? ''
      return `<div class="mcard fulld"><div class="mt">${icon(SEASON_ICON[season], 'sic')}<b>${esc(seasonLabel(r.season))}</b><span>정할 것 <b class="rdn">${todo}</b></span></div>`
        + `<div class="rdecide full">${first}</div><p class="fdnote">${todo > 1 ? `고르면 다음 것이 이어진다 · 남은 ${todo - 1}` : '고르면 이 계절의 소식이 이어진다'}</p></div>`
    }
    // 고을을 쥐었거나 잃었다 — 어디인지 큰 그림과 함께 하나씩, 확인만 누르고 넘어간다 (형 10-25)
    const lands = (r.region ?? 'byeonhan-mini') === 'tutorial' ? [] : landChanges(before, r).filter((x) => !landSeen.has(x.key))
    // 우리 공작이 먹혔다 — 갈래마다 제 그림으로 크게 (형 10-25: "공작이 성공한 것도 각각 이미지 · 전체화면 연출 · 확인 버튼")
    const wins = (r.region ?? 'byeonhan-mini') === 'tutorial' ? [] : plotWins(r, report).filter((x) => !landSeen.has(x.key))
    const pacts = (r.region ?? 'byeonhan-mini') === 'tutorial' ? [] : pactBigs(r, report).filter((x) => !landSeen.has(x.key))
    const backs = (r.region ?? 'byeonhan-mini') === 'tutorial' ? [] : freedBigs(r, report).filter((x) => !landSeen.has(x.key))
    const bigs = [...lands.map((x) => landBig(r, x)), ...pacts, ...wins, ...backs]
    if (bigs.length > 0) return bigCardHtml(r, bigs[0]!, bigs.length - 1)
    let h = `<div class="mcard" data-act="rep-fast"><div class="mt">${icon(SEASON_ICON[season], 'sic')}<b>${esc(seasonLabel(r.season))}</b><span>${esc(SEASON_LINE[season])}</span></div>`
    if (decide !== '') h += `<div class="rdecide"><h4 class="rdh">이번 계절 정할 것 · 다 골랐다</h4>${decide}</div>`
    for (const l of onUs) {
      h += warCard(r, l, t)
      t += FALL_S
    }
    for (const f of fallen(before, r)) {
      h += fallCard(r, f, t)
      t += FALL_S
    }
    for (const l of between) {
      const txt = reportText(before, r, l, me())
      if (txt === null) continue
      const [x, y] = l.by === l.b ? [l.b, l.a] : [l.a, l.b]
      h += `<div class="warbar rv" style="--t:${t}s">${emblem(x, 'fem')}<i>⚔</i>${emblem(y, 'fem')}<span>${tx(txt)}</span></div>`
      t += LINE_S
    }
    if (cards.some((c) => c !== '')) {
      for (const c of cards) {
        if (c === '') continue
        h += `<div class="rv" style="--t:${t}s">${c}</div>`
        t += battleCardSeconds(c)
      }
    } else {
      const sc = sceneOf(before, r, report)
      if (sc !== '') {
        h += `<div class="rv" style="--t:${t}s">${sc}</div>`
        t += LINE_S
      }
    }
    h += `<div class="lines">${lines.length === 0 ? `<p class="mute rv" style="--t:${t}s">조용한 계절이었다.</p>` : groupedRows(r, lines, t)}</div>`
    // 아직 길 위의 우리 군대 — 언제 닿나 (형: "그 턴이 다음턴인지 그다음인지 몰라가지고 헷갈림. 왜안오는거야")
    const going = sorted(Object.values(r.armies)).filter((a) => a.faction === me() && a.march !== null)
    if (going.length > 0) {
      h += `<div class="lines">${going.map((a, i) => `<div class="rrow rv" style="--t:${(t + (lines.length + i) * LINE_S).toFixed(2)}s">${icon('unit-spear', 'ri')}<span class="rflow"><span class="nchip">${esc(r.nodes[a.march!.from]?.name ?? '')}</span><i class="ar">➜</i><span class="nchip">${esc(r.nodes[a.march!.to]?.name ?? '')}</span></span>`
        + `<span class="rtx">${tx(`${josa(armyName(r, a), '이', '가')} 가는 중: ${arriveWhen(r.season, a.march!.left)}`)}</span></div>`).join('')}</div>`
    }
    const tail = threatsHtml(r)
    if (tail !== '') h += `<div class="rv" style="--t:${(t + Math.max(1, lines.length) * LINE_S).toFixed(2)}s">${tail}</div>`
    // 확인은 늘 보이게(카드 아래 붙박이) · 정할 것을 다 골라야 눌린다
    return h + `<div class="repfoot"><button class="btn pri wide" data-act="rep-close" ${todo > 0 ? 'disabled' : ''}>${todo > 0 ? `정할 것 ${todo}개를 먼저 고른다` : '확인'}</button></div></div>`
  }

  /**
   * 계절 소식을 갈래마다 묶는다 — 머리(그림 · 이름 · 몇 줄) 아래 우리 일이 먼저, 남의 일은 뒤.
   * 한 갈래가 길면 앞의 몇 줄만 펴 두고 나머지는 접는다 (형 10-25: "로그는 너무 복잡하고 많은데 카테고리별로 묶어야")
   */
  function groupedRows(r: Realm, lines: ReadonlyArray<{ l: ReportLine; x: string }>, t0: number): string {
    const ours = (l: ReportLine): boolean => lineNations(r, l).includes(me())
    let i = 0
    let h = ''
    for (const [g, name, ic] of LOG_GROUPS) {
      const rows = lines.filter((y) => logGroup(y.l) === g)
      if (rows.length === 0) continue
      const sorted = [...rows.filter((y) => ours(y.l)), ...rows.filter((y) => !ours(y.l))]
      const show = sorted.length > P.realm.repGroupOpen + 1 ? P.realm.repGroupOpen : sorted.length
      h += `<div class="rgrp"><h4 class="rgh rv" style="--t:${(t0 + i * LINE_S).toFixed(2)}s">${icon(ic, 'rgi')}<span>${esc(name)}</span><b>${sorted.length}</b></h4>`
      for (const y of sorted.slice(0, show)) h += reportRow(r, y.l, y.x, t0 + i++ * LINE_S)
      if (sorted.length > show) {
        h += `<details class="rmore rv" style="--t:${(t0 + i++ * LINE_S).toFixed(2)}s"><summary>${sorted.length - show}줄 더 보기</summary>${sorted.slice(show).map((y) => reportRow(r, y.l, y.x, 0)).join('')}</details>`
      }
      h += `</div>`
    }
    return h
  }

  /**
   * 우리에게 전쟁을 걸어왔다 — 그 군장의 얼굴 · 성난 탈 · 무엇 때문에 · 속셈 짐작 · 바로 할 수 있는 것.
   */
  function warCard(r: Realm, l: Extract<ReportLine, { kind: 'relation' }>, t: number): string {
    const f = l.by!
    const name = r.factions[f]?.name ?? ''
    const lord = r.heroes[r.factions[f]?.ruler ?? rulerId(f)]
    const why = reportText(before!, r, l, me()) ?? ''
    // 속셈 짐작 — 화면에 보이는 것으로만
    const lands = (x: string): number => Object.values(r.nodes).filter((n) => n.owner === x).length
    const guess = leaderOf(r, f) === me() ? '우리가 앞서간다고 보고 막으려는 듯합니다.' : tookRecently(r, me(), f) ? '빼앗긴 땅을 되찾으려는 겁니다.'
      : lands(f) > lands(me()) ? '우리를 만만하게 보는 모양입니다.' : '우리 땅이 탐나는 모양입니다.'
    let h = `<div class="warc rv" style="--t:${t}s">${bust(lord, 'flord')}${moodImg(ART, 'angry', 'mood wm')}<div class="wb"><b>${emblem(f, 'fem')}<span>${esc(josa(name, '이', '가'))} 전쟁을 걸어왔다</span></b>`
    h += `<span>${tx(why.replace(/^.*?— /, ''))}</span>${said(advisor(r), guess)}`
    h += `<div class="btns"><button class="btn sm${envoys[ekey(f, 'truce')] !== undefined ? ' on' : ''}" data-act="envoy" data-to="${f}" data-ask="truce">${envoys[ekey(f, 'truce')] !== undefined ? '화친 사신을 보낸다 · 거두기' : '화친을 청한다'}</button><button class="btn ghost sm" data-act="nat-diplo" data-to="${f}">외교 판</button></div></div></div>`
    return h
  }

  /** 지난 기록 판 (형: "최근로그 확인할수 있어야함. 어디서 조공요구했는지 · 어디서 전쟁선포했는지") — logbook.ts */
  function logSheet(): string {
    const r = realm!
    const hist = host.history()
    const heard = (l: ReportLine): boolean => r.known === undefined
      || Object.values(l).every((v) => typeof v !== 'string' || r.factions[v] === undefined || knows(r, me(), v))
    const rows = logRows(r, hist, me(), logFilter, logNation, heard)
    const nations = logNations(r, hist, me()).filter((f) => knows(r, me(), f))
    return logbookHtml({ esc, emblem: (f, cls) => emblem(f, cls), row: (l, text) => reportRow(r, l, text, 0) }, r, rows, nations, logFilter, logNation)
  }

  /**
   * 보고 한 줄을 그림으로 (형: "눈에 안들어옴. 국가아이콘이라던가 자원아이콘이라던가 화살표 방향 적극이용 · 항상 최선의 전달은 이미지나 애니메이션") —
   * 왼쪽에 무슨 일인지 그림 하나, 가운데에 누가→누구 / 어디→어디 (깃발·고을 그림과 화살표), 그 옆에 글 (낱말 색).
   */
  function reportRow(r: Realm, l: ReportLine, text: string, t: number): string {
    const L = l as unknown as Record<string, unknown>
    const isF = (v: unknown): v is string => typeof v === 'string' && r.factions[v] !== undefined
    const isN = (v: unknown): v is string => typeof v === 'string' && r.nodes[v] !== undefined
    const nchip = (id: string): string => `<span class="nchip">${icon(nodeIcon(r.nodes[id]!), 'nci')}${esc(r.nodes[id]!.name)}</span>`
    const fchip = (f: string): string => emblem(f, 'rem')
    let ic = ''
    switch (l.kind) {
      case 'take': ic = 'settle-besieged'; break
      case 'arrive': ic = 'unit-spear'; break
      case 'sighted': ic = 'status-spy'; break
      case 'battle': ic = 'unit-shield-wall'; break
      case 'harvest': case 'spoil': ic = 'good-rice'; break
      case 'market': ic = 'settle-market'; break
      case 'draft': ic = UNIT_ICON[l.unit]; break
      case 'disband': case 'settle': case 'migrate': case 'place': ic = 'settle-farm-village'; break
      case 'hunger': ic = 'status-famine'; break
      case 'envoy': case 'answered': case 'ask': ic = 'good-tribute-bell'; break
      case 'recall': ic = l.owner !== undefined ? 'unit-spear' : 'good-tribute-bell'; break
      // 전쟁 줄의 그림은 까닭대로 — 배신만 등 뒤의 칼, 이간·공작은 그 공작 그림, 나머지는 환두대도 (형: "이간도 안했는데 이간 칼 이미지가 뜸")
      case 'relation': ic = l.state === 'war'
        ? (l.why === 'betray' || l.why === 'distrust' ? 'status-betrayal' : l.why === 'sow' ? PLOT_ICON.sow : l.why === 'plot' ? 'plot-schemes' : 'treasure-ring-sword')
        : l.state === 'ally' ? 'status-alliance' : 'good-tribute-bell'; break
      case 'plot': ic = PLOT_ICON[l.op]; break
      case 'mystery': case 'rumor': case 'confess': ic = 'plot-schemes'; break
      case 'build': ic = 'settle-palisade'; break
      case 'rite': ic = 'status-good-omen'; break
      case 'blocked': ic = 'settle-pass'; break
      case 'relicSave': ic = 'status-good-omen'; break
      case 'discover': ic = 'settle-beacon'; break
      case 'arm': ic = 'treasure-iron-ingots'; break
      case 'bowUp': ic = 'unit-archer'; break
      case 'suzerain': ic = 'treasure-silla-crown'; break
      case 'grow': case 'bond': case 'awaken': ic = 'status-morale-up'; break
      case 'wed': ic = 'status-alliance'; break
      case 'persuade': ic = l.step === 'waver' ? 'status-alliance' : 'status-morale-down'; break
      case 'exile': ic = 'status-bad-omen'; break
      case 'retake': ic = 'settle-capital'; break
      case 'card': ic = CARDS[l.card].icon; break
      case 'omen': ic = 'status-good-omen'; break
      case 'expGo': case 'expStay': case 'expBack': ic = 'settle-port-town'; break
      case 'birth': ic = 'status-good-omen'; break
      case 'custom': ic = CUSTOM_ICON[l.id] ?? 'status-good-omen'; break
      default: ic = ''
    }
    // 장수 얼굴이 주인공인 줄 — 들임·떠돌이·자람
    const hero = typeof L['hero'] === 'string' ? (r.heroes[L['hero'] as string] ?? (realm!.wanderers ?? []).find((w) => w.hero.id === L['hero'])?.hero) : undefined
    const lead = (l.kind === 'recruit' || l.kind === 'persuade' || l.kind === 'wanderer' || l.kind === 'grow' || l.kind === 'bond' || l.kind === 'awaken' || l.kind === 'birth' || l.kind === 'expBack' || l.kind === 'chancellor') && hero !== undefined
      ? bust(hero, 'rface rl') : ic !== '' ? icon(ic, 'ri') : '<i class="ri dot"></i>'
    // 누가→누구 · 어디→어디
    let flow = ''
    const from = L['from']
    const to = L['to']
    // 누가 보냈는지 모르는 공작 — 국기 대신 물음표 실루엣 (형 10-23: "어느 나란지 모른다고 했는데 왼쪽에 국기가 그대로 표시됨")
    const unk = `<span class="remq">${icon('emblem-stonegate', 'rem')}<b>?</b></span>`
    if (l.kind === 'plot' && l.faction !== me()) {
      const known = l.caught && (l.exposed ?? true)
      flow = `${known ? fchip(l.faction) : unk}<i class="ar foe">➜</i>${l.node !== undefined && isN(l.node) ? nchip(l.node) : isF(l.target) ? fchip(l.target) : ''}`
    } else if (l.kind === 'sighted' && isF(L['faction']) && isN(to)) flow = `${fchip(L['faction'] as string)}<i class="ar foe">➜</i>${nchip(to as string)}`
    else if (isN(from) && isN(to)) flow = `${nchip(from)}<i class="ar">➜</i>${nchip(to)}`
    else if (isF(from) && isF(to)) flow = `${fchip(from)}<i class="ar">➜</i>${fchip(to)}`
    else if (isF(L['a']) && isF(L['b'])) {
      const by = L['by']
      const [x, y] = by === L['b'] ? [L['b'] as string, L['a'] as string] : [L['a'] as string, L['b'] as string]
      flow = `${fchip(x)}<i class="ar">${l.kind === 'relation' && l.state === 'war' ? '⚔' : l.kind === 'market' || (l.kind === 'relation' && l.state !== 'war') ? '⇄' : '➜'}</i>${fchip(y)}`
    } else if (l.kind === 'battle' && isF(l.atkFaction) && isF(l.defender)) flow = `${fchip(l.atkFaction)}<i class="ar">⚔</i>${fchip(l.defender)}`
    else if (l.kind === 'take' && isF(l.faction)) flow = `${fchip(l.faction)}<i class="ar">➜</i>${nchip(l.node)}`
    else if (isF(L['faction']) && L['faction'] !== me()) flow = fchip(L['faction'] as string)
    else if (isN(L['node'])) flow = nchip(L['node'] as string)
    // 회유 — 달랜 우리 장수의 얼굴 (WOO §1-4 · 「송양의 벽 −1.7 (협보)」)
    if ((l.kind === 'persuade' || l.kind === 'recruit') && l.by != null && r.heroes[l.by] !== undefined) flow = bust(r.heroes[l.by], 'rface sm')
    // 수가 핵심인 줄은 크게
    const big = l.kind === 'harvest' ? `<b class="rn good">+${Math.round(l.grain)}</b>` : l.kind === 'spoil' ? `<b class="rn good">+${Math.round(l.grain)}</b>` : l.kind === 'draft' ? `<b class="rn">+${l.n}</b>` : ''
    const mute = text.startsWith('소문') ? ' mute' : ''
    return `<div class="rrow rv${mute}" style="--t:${t.toFixed(2)}s">${lead}${flow !== '' ? `<span class="rflow">${flow}</span>` : ''}${big}<span class="rtx">${tx(text)}</span></div>`
  }

  /** 이번 계절에 무너진 나라 — 지난 판엔 땅이 있었는데 이제 없다. 우리가 아는 나라만 */
  /** 이번 계절 우리가 쥔 고을(남의 땅이던 곳) · 잃은 고을 — 고을 id 순 */
  function landChanges(b: Realm, a: Realm): Array<{ key: string; node: string; won: boolean; other: string | null }> {
    const out: Array<{ key: string; node: string; won: boolean; other: string | null }> = []
    for (const id of Object.keys(a.nodes).sort()) {
      const n = a.nodes[id]!
      if (n.kind === 'sodo') continue
      const was = b.nodes[id]?.owner ?? null
      if (was !== me() && was !== null && n.owner === me()) out.push({ key: `${a.season}:${id}`, node: id, won: true, other: was })
      else if (was === me() && n.owner !== me()) out.push({ key: `${a.season}:${id}`, node: id, won: false, other: n.owner })
    }
    return out
  }

  /** 큰 화면 한 장 — 그림 · 깃발 · 제목 · 한두 줄 · 확인 하나 (땅의 바뀜 · 공작이 먹혔다) */
  /** tone — 시작 연출: good 흰 번쩍 · bad 어둠에서 밝아진다 · plain 그냥 보인다 (없으면 good 으로 가른다 · 형 10-26: "다 똑같이 흰 화면 반짝이면서 시작하면 안 됨") */
  interface Big { key: string; art: string; good: boolean; tone?: 'good' | 'bad' | 'plain'; flags: string; title: string; sub: string; small: string; sfx: string; stage?: string; voice?: string }

  /**
   * 맺었다 · 틀어졌다 — 두 군장이 마주 보고 깃발이 부딪힌 뒤 저쪽 군장이 한마디 (형 10-25: 문명처럼)
   * 나라마다 한 장 — 조공 > 동맹 > 화친 > 선물 > 거절
   */
  function pactBigs(r: Realm, rep: Report): Big[] {
    const best = new Map<string, PactKind>()
    const rank: Readonly<Record<PactKind, number>> = { vassal: 5, ally: 4, truce: 3, gift: 2, refused: 1 }
    const put = (f: string, k: PactKind): void => { const was = best.get(f); if (was === undefined || rank[was] < rank[k]) best.set(f, k) }
    for (const l of rep.lines) {
      if (l.kind === 'relation' && (l.a === me() || l.b === me()) && (l.state === 'truce' || l.state === 'ally')) put(l.a === me() ? l.b : l.a, l.state === 'ally' ? 'ally' : 'truce')
      else if (l.kind === 'answered' && l.yes && l.askKind === 'tribute') put(l.from, 'vassal')
      else if (l.kind === 'envoy' && l.from === me()) {
        if (l.accepted && l.ask === 'tribute') put(l.to, 'vassal')
        else if (l.accepted && l.ask === 'gift') put(l.to, 'gift')
        else if (!l.accepted && (l.ask === 'truce' || l.ask === 'alliance' || l.ask === 'tribute' || l.ask === 'trade')) put(l.to, 'refused')
      }
    }
    const out: Big[] = []
    const mine = r.heroes[r.factions[me()]?.ruler ?? rulerId(me())]
    for (const [f, k] of [...best.entries()].sort((x, y) => (x[0] < y[0] ? -1 : 1))) {
      const fac = r.factions[f]
      if (fac === undefined) continue
      const lord = r.heroes[fac.ruler ?? rulerId(f)]
      const key = `${r.season}:pact:${f}:${k}`
      const bad = k === 'refused'
      const T: Readonly<Record<PactKind, readonly [string, string, string, string]>> = {
        truce: [`${josa(fac.name, '과', '와')} 화친을 맺었다`, '서로 치지 않고 장터를 연다', 'event-truce-pact', `realm/sfx/${sndFile('tap_bell', 'g2')}`], // 방울 둘째 — 옛 feast_a(12초 「뎅뎅뎅」)는 안 쓴다 (형 10-27)
        ally: [`${josa(fac.name, '과', '와')} 동맹을 맺었다`, '같은 적을 함께 친다', 'event-alliance-oath', snd('horn_victory')],
        vassal: [`${josa(fac.name, '이', '가')} 우리를 섬긴다`, '해마다 바칠 것을 바친다', 'event-tribute-bow', snd('coins')],
        gift: [`${josa(fac.name, '이', '가')} 선물을 반겼다`, '사이가 한 뼘 가까워졌다', 'event-court-hall', snd('coins')],
        refused: [`${josa(fac.name, '이', '가')} 우리 청을 물리쳤다`, '사신이 빈손으로 돌아왔다', 'event-court-hall', snd('war_drum')],
      }
      const [title, sub, bg, sfx] = T[k]
      const say = pactSay(k, fac.mind, lord !== undefined ? voiceKind(lord, true) : 'm-elder', lord !== undefined ? chiefCastOf(lord) : 'a')
      const stage = `<div class="pact${bad ? ' bad' : ''}"><img class="pactbg" src="${ART}event/${bg}.jpg" alt="">${bustHd(mine, 'pl a')}${bustHd(lord, 'pl b')}`
        + `<div class="pflags">${emblem(me(), 'fem')}<i>${bad ? '✕' : '⇄'}</i>${emblem(f, 'fem')}</div><div class="psay">${typed(say.text, esc, 1.1)}</div></div>`
      out.push({ key, art: bg, good: !bad, ...(k === 'gift' ? { tone: 'plain' as const } : {}), flags: '', title, sub, small: lord?.name ?? '', sfx, stage, ...(lord !== undefined ? { voice: say.voice } : {}) })
    }
    return out
  }

  /**
   * 잡혀갔던 우리 장수가 돌아왔다 — 화친으로 풀려났거나 잡아 둔 나라의 도읍이 떨어져 옥에서 나왔다 (heroes.releaseCaptives).
   * (형 10-27: "견지 쇠비 잡혀갔었는데 갑자기 장수 활성화되어 있음 … 돌아왔다는 전체화면 연출 있어야") · 구출은 공작 판(plotWins)이 따로 띄운다
   */
  function freedBigs(r: Realm, rep: Report): Big[] {
    const out: Big[] = []
    for (const l of rep.lines) {
      if (l.kind !== 'freed' || l.faction !== me()) continue
      const h = r.heroes[l.hero]
      if (h === undefined) continue
      const from = r.factions[l.from]?.name ?? ''
      const key = `${r.season}:freed:${l.hero}`
      const sub = l.why === 'peace' ? `${josa(from, '과', '와')} 화친하며 풀려났다` : `${from} 도읍이 떨어져 옥에서 나왔다`
      const stage = `<div class="pact"><img class="pactbg" src="${ART}event/event-expedition-return.jpg" alt="">${bustHd(h, 'pl a')}`
        + `<div class="pflags">${emblem(l.from, 'fem')}<i>➜</i>${emblem(me(), 'fem')}</div></div>`
      out.push({ key, art: 'event-expedition-return', good: true, flags: '', title: `${josa(h.name, '이', '가')} 돌아왔다`, sub, small: h.name, sfx: snd('horn_victory'), stage })
    }
    return out
  }

  /** 땅의 바뀜 — 어디 · 누구에게서/누구에게 */
  function landBig(r: Realm, x: { key: string; node: string; won: boolean; other: string | null }): Big {
    const n = r.nodes[x.node]!
    const isCap = Object.values(r.factions).some((f) => f.capital === x.node) || n.kind === 'capital'
    const kind = isCap ? '도읍' : NODE_KIND_NAME[n.kind]
    const who = x.other !== null ? (r.factions[x.other]?.name ?? '') : ''
    return {
      key: x.key, good: x.won, art: x.won ? 'event-take-town' : 'event-invade-raid', flags: emblem(x.won ? me() : x.other, 'fem'),
      title: x.won ? `${josa(n.name, '을', '를')} 차지했다` : `${josa(n.name, '을', '를')} 빼앗겼다`,
      sub: x.won ? (who !== '' ? `${who}의 ${josa(kind, '이었다', '였다')}` : '') : (who !== '' ? `${josa(who, '이', '가')} 쥐었다` : '우리 손을 떠났다'),
      small: `${kind} · 백성 ${Math.floor(n.hh).toLocaleString('ko-KR')}가구`,
      sfx: x.won ? snd('horn_victory') : snd('defeat'),
    }
  }

  /** 이번 계절 먹힌 우리 공작 — 갈래마다 제 그림 · 제 말 · 제 소리 */
  /**
   * 이번 계절 우리 공작 — 먹혔든 어긋났든 한 장씩 크게: 누가(보낸 장수 얼굴) · 어디에 · 무엇을 걸었나 · 성공/실패 도장 · 그 뒤 일(들킴 · 드러남 · 자객의 끝)
   * (형 10-26: "공작은 내 어떤 장수가 어디에다 뭘 걸었고 실패/성공 전체화면 연출로 띄워 달라니까")
   */
  function plotWins(r: Realm, rep: Report): Big[] {
    const out: Big[] = []
    for (const l of rep.lines) {
      if (l.kind !== 'plot' || l.faction !== me()) continue
      const key = `${r.season}:plot:${l.op}:${l.target}:${l.node ?? ''}:${l.other ?? ''}:${l.hero ?? ''}:${l.ok ? 1 : 0}`
      const fn = r.factions[l.target]?.name ?? ''
      const nn = l.node !== undefined ? (r.nodes[l.node]?.name ?? '') : ''
      const on = l.other !== undefined ? (r.factions[l.other]?.name ?? '') : ''
      const hn = l.hero !== undefined ? (r.heroes[l.hero]?.name ?? '') : ''
      const ag = l.agent !== undefined ? r.heroes[l.agent] : undefined
      const who = ag?.name ?? (NIGHT_OPS.has(l.op) ? '고용 자객' : '우리 밀정')
      const town = nn !== '' ? `${fn} ${nn}` : fn
      const deed: Readonly<Record<PlotOp, string>> = {
        rumor: `${fn}에 흉흉한 소문을 퍼뜨렸다`, sow: `${josa(fn, '과', '와')} ${on} 사이를 갈라놓으려 했다`, bribe: `${town}의 장정들을 매수하러 갔다`,
        burn: `${fn}의 곳간에 불을 놓으러 갔다`, spy: `${town}에 첩자를 심으러 갔다`, assassin: `${fn}의 ${josa(hn, '을', '를')} 어둠 속에서 노렸다`,
        rescue: `${fn}에 잡혀 있는 ${josa(hn, '을', '를')} 구하러 갔다`,
      }
      const act = `${josa(who, '이', '가')} ${deed[l.op]}`
      // 먹혔으면 무엇이 됐나 · 어긋났으면 왜
      let title: string, sub: string, sfx: string
      if (l.ok) {
        switch (l.op) {
          case 'rumor': title = `${fn}에 흉흉한 소문이 돈다`; sub = '군사들이 수군대며 기운이 꺾였다'; sfx = snd('war_drum'); break
          case 'sow': title = `${josa(fn, '과', '와')} ${josa(on, '이', '가')} 등을 돌렸다`; sub = '두 나라 사이가 틀어졌다. 싸움이 붙을 수도 있다'; sfx = snd('tap_brush'); break
          case 'bribe': title = `${nn} 장정들을 매수했다`; sub = '두 계절 동안 싸우러 나오지 않는다'; sfx = snd('tap_coin'); break
          case 'burn': title = `${fn}의 곳간이 불탄다`; sub = '쌓아 둔 곡식이 잿더미가 됐다'; sfx = 'realm/sfx/cmd_fire_c1.ogg'; break
          case 'spy': title = `${nn}에 첩자를 심었다`; sub = '네 계절 동안 그곳 군세가 훤히 보인다'; sfx = snd('tap_move'); break
          case 'rescue': title = `${josa(hn, '을', '를')} 구해 냈다`; sub = '옥을 깨고 우리 도읍으로 돌아왔다'; sfx = snd('horn_victory'); break
          default: title = l.result === 'kill' ? `${josa(hn, '이', '가')} 쓰러졌다` : `${josa(hn, '이', '가')} 화살을 맞았다`; sub = l.result === 'kill' ? `${fn}의 장수 하나가 사라졌다` : '몇 계절 동안 군대를 이끌지 못한다'; sfx = 'realm/sfx/battle_final_c1.ogg'
        }
      } else {
        title = `${PLOT_NAME[l.op]}: 어긋났다`
        sub = l.op === 'assassin' ? `${josa(hn, '은', '는')} 살아남았다` : l.op === 'rescue' ? `${josa(hn, '은', '는')} 아직 ${fn}에 갇혀 있다` : l.op === 'sow' ? '두 나라는 그대로다' : '먹히지 않았다'
        sfx = snd('defeat')
      }
      // 그 뒤 일 — 들켰나 · 누가 보냈는지 드러났나 · 자객은
      const after: string[] = []
      if (l.agentFate === 'captured' && ag !== undefined) after.push(`${josa(ag.name, '이', '가')} 사로잡혔다`)
      else if (l.agentFate === 'escaped' && ag !== undefined) after.push(`${josa(ag.name, '이', '가')} 몸만 빠져나왔다`)
      if (l.exposed === true) after.push('누가 보냈는지 드러났다. 사이가 나빠졌다')
      else if (l.caught) after.push('들켰다: 그쪽이 경계를 올렸다 · 누가 했는지는 모른다')
      // 얼굴 그림이 없는 장수면 빈 테 대신 공작 그림
      const face = (ag !== undefined ? bustHd(ag, 'plf') : '') || icon(PLOT_ICON[l.op], 'plf ic')
      const flags = l.op === 'sow' ? `<span class="sowf big">${emblem(l.target, 'fem')}<i>⇄</i>${emblem(l.other ?? null, 'fem')}</span>` : emblem(l.target, 'fem')
      const stage = `<div class="plotv${l.ok ? ' ok' : ' fail'}"><img class="pbg" src="${ART}event/${plotArt(l.op)}.jpg" alt=""><i class="pred"></i>`
        + `<div class="pagent">${face}<b>${esc(who)}</b><small>${esc(PLOT_NAME[l.op])}</small></div>`
        + `<img class="pstamp" src="${ART}fx/stamp-${l.ok ? 'ok' : 'fail'}.png" alt="${l.ok ? '성공' : '실패'}">`
        + `<div class="pinfo">${flags}<span class="pact2">${esc(act)}</span>${after.map((x) => `<span class="paft">${esc(x)}</span>`).join('')}</div></div>`
      out.push({ key, art: plotArt(l.op), good: l.ok, flags: '', title, sub, small: PLOT_NAME[l.op], sfx, stage })
    }
    return out
  }

  /** 소리는 그 장이 처음 뜰 때 한 번 */
  const bigSounded = new Set<string>()
  /**
   * 큰 화면 — 시작 → 그림이 밀려 들어오고 → 제목이 내려꽂힌다 → 소리 (형 10-25: "유저가 퍽 하면 게임은 으아아아 — 오버액션을 연쇄로")
   * 시작은 결에 따라: 득이면 흰 번쩍 · 나쁘면 어둠에서 천천히 · 중립이면 그냥 (형 10-26)
   */
  function bigCardHtml(r: Realm, x: Big, rest: number): string {
    if (!bigSounded.has(x.key)) {
      bigSounded.add(x.key)
      window.setTimeout(() => ding(x.sfx, 0.55), 220)
      // 맺었다·틀어졌다 — 저쪽 군장이 한마디를 제 목소리로 (말이 찍히기 시작할 때)
      const v = x.voice
      if (v !== undefined) window.setTimeout(() => { if (document.querySelector('.ap .pact') !== null && voiceGate(performance.now())) ding(v, P.realm.voiceVol) }, P.realm.pactVoiceMs)
    }
    const tone = x.tone ?? (x.good ? 'good' : 'bad')
    const open = tone === 'good' ? '<i class="bigflash"></i>' : tone === 'bad' ? '<i class="bigdark"></i>' : ''
    return `<div class="mcard fulld landc ${x.good ? 'won' : 'lost'} t-${tone}">${open}<div class="mt">${icon(SEASON_ICON[seasonOf(r.season)], 'sic')}<b>${esc(seasonLabel(r.season))}</b></div>`
      + (x.stage !== undefined
        ? `${x.stage}<div class="pactt"><b>${esc(x.title)}</b>${x.sub !== '' ? `<span>${esc(x.sub)}</span>` : ''}</div>`
        : `<div class="landv"><img class="landi" src="${ART}event/${x.art}.jpg" alt=""><div class="landt">${x.flags}<b>${esc(x.title)}</b>${x.sub !== '' ? `<span>${esc(x.sub)}</span>` : ''}<small>${esc(x.small)}</small></div></div>`)
      + `<button class="btn pri wide landok" data-act="land-ok" data-k="${x.key}">확인</button>${rest > 0 ? `<p class="fdnote">이어서 ${rest}가지 더</p>` : ''}</div>`
  }

  function fallen(b: Realm, after: Realm): string[] {
    const has = (x: Realm, f: string): boolean => Object.values(x.nodes).some((n) => n.owner === f)
    return Object.keys(b.factions).sort().filter((f) => f !== after.player && has(b, f) && !has(after, f) && knows(after, me(), f))
  }

  /** 나라가 무너졌다 — 깃발 · 군주 · 누가 도읍을 쥐었나 (형: "나라가 멸망하면 멸망한거 띄워줘야 할듯") */
  function fallCard(r: Realm, f: string, t: number): string {
    const name = r.factions[f]?.name ?? ''
    const cap = r.factions[f]?.capital
    const by = cap !== undefined ? r.nodes[cap]?.owner ?? null : null
    const lord = r.heroes[r.factions[f]?.ruler ?? rulerId(f)]
    const byLine = by === me() ? '우리가 마지막 땅을 쥐었다' : by !== null ? `${josa(r.factions[by]?.name ?? '', '이', '가')} 도읍을 쥐었다` : '땅이 모두 흩어졌다'
    const fate = lord === undefined ? '' : lord.status === 'captive' ? ` · 군주 ${josa(lord.name, '은', '는')} 사로잡혔다` : lord.status === 'dead' ? ` · 군주 ${josa(lord.name, '은', '는')} 죽었다` : ` · 군주 ${josa(lord.name, '은', '는')} 몸을 피했다`
    return `<div class="fall rv" style="--t:${t}s">${bust(lord, 'flord')}<div><b>${emblem(f, 'fem')}<span>${esc(josa(name, '이', '가'))} 무너졌다</span></b><span>${tx(byLine + fate)}</span></div></div>`
  }

  /**
   * 난세 단계 고르기 — 디아블로의 고통 단계 (tier.ts · 형의 메모: "최대한 빨리 보스를 잡을때까지 강해지려고함"). 이 판을 이긴 단계 + 1 까지 열린다
   */
  function tierHtml(region: RegionId, pick0?: number, act = 'tier-pick'): string {
    const open = tierOpen(region)
    const pick = Math.min(pick0 ?? tierPick[region] ?? 1, open)
    // 세기 — 문명의 개척자·왕·신처럼 칭호로 (형 10-23). 잠긴 칭호도 보인다 — 무엇을 향해 가는지
    // 동행 수도 단계마다 다르다 — 고를 때 보이게 (형 10-24: "난이도에 따라 데려갈 장수 숫자가 변하면 선택할 때 알려 줘야")
    const carry = retainMaxOf(pick)
    let h = `<div class="tierp"><b>세기 · ${esc(levelName(pick))}</b><span class="mute">${esc(LEVEL_LINE[pick] ?? '')} · 영웅전의 장수를 ${carry > 0 ? `${carry}명까지 데려간다` : '데려가지 못한다'}</span><div class="seg">`
    for (let t = 0; t <= TIER_MAX; t++) {
      h += t <= open
        ? `<button class="${t === pick ? 'on' : ''}${t === TIER_MAX ? ' apex' : ''}" data-act="${act}" data-v="${t}">${esc(levelName(t))}</button>`
        : `<button class="locked" disabled data-tip="앞 세기로 이기면 열린다">🔒 ${esc(levelName(t))}</button>`
    }
    return h + `</div></div>`
  }

  /** 첫 화면이 한 화면에 안 들어가면 한 단계씩 줄인다 (front.ts .tight · .tight2) — 그려진 뒤에 재고, 화면 크기가 바뀌면 다시 */
  function fitTitle(): void {
    const tv = root.querySelector<HTMLElement>('.front.title .tv')
    if (tv === null) return
    const logo = tv.querySelector<HTMLImageElement>('img.ltitle')
    if (logo !== null && !logo.complete) logo.addEventListener('load', fitTitle, { once: true }) // 로고가 다 받아진 뒤 다시 잰다
    tv.classList.remove('tight', 'tight2')
    const over = (): boolean => tv.scrollHeight > tv.clientHeight + 1
    if (over()) tv.classList.add('tight')
    if (over()) tv.classList.add('tight2')
  }
  window.addEventListener('resize', () => { if (front?.kind === 'title') fitTitle() })
  // 크롬이 설치를 권할 수 있게 된 때(beforeinstallprompt — realm.html 이 받아 둔다)는 첫 화면이 그려진 뒤일 때가 많다 — 그때 다시 그려
  // 「앱으로 설치하면 더 편리합니다」 알림에 바로 설치 단추가 뜨게 (형 10-29: "설명서만 있고 바로 설치하는 버튼이 없다") · 설치를 마치면 알림을 걷는다
  window.addEventListener('beforeinstallprompt', () => setTimeout(paint, 0))
  window.addEventListener('appinstalled', () => setTimeout(paint, 0))

  // ───────── 판 바깥 — 첫 화면 · 판 고르기 · 나라 고르기 (front.ts)
  function frontHtml(f: Front): string {
    // 활터·연습장·소리 출처·시험·기록·로그인은 「더 보기」 안에 접는다 — 늘어놓았더니 폰에서 화면 밑으로 넘쳤다 (형 10-28)
    const links = `<details class="fmore"${fmoreOpen ? ' open' : ''}><summary class="btn ghost">더 보기</summary><button class="fmbg" data-act="fmore-x" aria-label="닫기"></button><div class="fmpan"><b class="fmh">더 보기</b>${document.documentElement.classList.contains('gfxsafe') ? '<small class="mute">그래픽 호환 모드 켜짐</small>' : ''}${f.kind === 'title' ? acctLine() : ''}<p class="fine">${installed() ? '' : `<button class="btn ghost" data-act="inst-show">📲 앱으로 설치</button>`}<a class="btn ghost" href="${(import.meta.env?.BASE_URL ?? '/')}">활터</a> ${PRACTICE_READY ? `<button class="btn ghost" data-act="practice-open">궁술 연습장</button>` : ''}`
      // 소리의 출처 — 공공누리 제1유형·CC BY 는 출처를 밝혀야 쓸 수 있다 (형 10-23: "출처표기해야 상업적으로 사용가능하니까 주의")
      + ` <a class="btn ghost" href="${BASE}realm/credits.html">소리 출처</a>`
      // 새 전투 시험 (BATTLE-LIVE 0번) — 이 기기에서만 켜진다 · 형과 지인이 켜고 꺼 보며 견준다 (형 10-28)
      + ` <button class="btn ghost" data-act="spar-open" data-tip="판을 거치지 않고 싸움 한 판을 바로 엽니다. 하던 판은 그대로입니다">⚔ 연습 싸움</button>`
      // 판 기록 — 판 밖(첫 화면 · 끝 화면)에서도 받는다. 아래 「나라」 탭은 판 안에서만 보여 찾기 어려웠다 (형 10-26: "나라 탭이 어딨음??")
      + (host.gameCount() > 0 ? ` <button class="btn ghost" data-act="export" data-tip="지금까지 둔 판 ${host.gameCount()}개의 기록을 파일로 받는다">기록 내보내기</button>` : '') + `</p><button class="btn fmx" data-act="fmore-x">닫기</button></div></details>`
    switch (f.kind) {
      case 'title': {
        // 영웅전(도감) — 판을 넘어 남는 것 (VISION §5-4)
        const dexBtn = `<button class="btn big" data-act="dex-open">영웅전</button>` // 형 10-25: 도감보다 즐거운 이름 · 숫자는 들어가면 보인다
          + (hasDrill() ? `<button class="btn big" data-act="dy-title">단련터</button>` : '') // 남은 단련 공은 아무 때나 쓴다 (HERO-GROWTH ★ §C)
          + ((host.pastGames?.() ?? []).length > 0 ? `<button class="btn big" data-act="annals-open">나의 역사</button>` : '')
        // 끝나지 않은 다른 판들은 불러오기 안에 (형 10-28: 첫 화면에 늘어놓으니 단추가 화면 밖으로) — 몇 판 있는지만 단추에
        const shelfN = (host.slots?.() ?? []).length
        const loadBtn = host.saves !== undefined ? `<button class="btn big" data-act="save-open-title">불러오기${shelfN > 0 ? `<small class="ldn">끝나지 않은 판 ${shelfN}</small>` : ''}</button>` : ''
        return titleHtml(KIT, realm, host.savedAt(), installCard() + links, realm === null && !tutorialOver(), loadBtn + dexBtn)
      }
      case 'dex': return dexHtml(DEX_KIT, f.board, f.sel, f.back === null ? '판으로' : '처음으로')
      case 'drill': return yardHtml(DRILL_KIT, f)
      case 'tomb': return tombRun(realm) ? tombHtml(RELIC_KIT, realm, f.fresh) : ''
      case 'annals': return annalsHtml()
      case 'boards': return boardHtml(KIT, realm !== null && !realm.outcome, unlockedBoards(realm?.region ?? null), tierWon, tierHtml('jumong', chapTier, 'chap-tier'))
      case 'nations': return nationsHtml(KIT, f.region)
      case 'detail': return detailHtml(KIT, f.region, f.id, f.region === 'tutorial' ? '' : tierHtml(f.region))
    }
  }

  // ───────── 그리기
  /**
   * 이번 계절에 정해 둔 명령을 남긴다 (형: "궁술연습장이나 활터 가버리면 그턴에서 내가 해놨던거 다 날아가버리는데") —
   * 다른 화면에 다녀오거나 새로고침해도 같은 판·같은 계절이면 그대로 되살린다. 저장이 안 되는 곳이면 그냥 없이 간다.
   */
  function saveDraft(): void {
    if (realm === null) return
    // hireShown — 등용 장면을 이미 띄운 떠돌이. 초안과 함께 남겨야 앱이 다시 열려도(새 빌드 · 껐다 켬) 계절 끝에 또 뜨지 않는다 (형 10-25: "마파람 등용 한번 떴었는데 왜 또 뜨지")
    const d = { seed: realm.seed, season: realm.season, player: realm.player, armyOrders, musters, settles, pick, goalStop, landSeen: [...landSeen], scout, rite, answers, guards, envoys, plots, heroOrders, persuadeBy, hands, hireShown: [...hireShown], autoIdle: realm.autoIdle, manual: realm.manual?.[me()] }
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)) } catch { /* 저장 못 하는 곳 */ }
  }

  function restoreDraft(): void {
    if (realm === null) return
    let d: Record<string, unknown> | null = null
    try { d = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null') as Record<string, unknown> | null } catch { d = null }
    if (d === null || d['seed'] !== realm.seed || d['season'] !== realm.season || d['player'] !== realm.player) return
    const list = (k: string): Order[] => (Array.isArray(d![k]) ? (d![k] as Order[]) : [])
    const rec = <T>(k: string): Record<string, T> => (typeof d![k] === 'object' && d![k] !== null ? (d![k] as Record<string, T>) : {})
    armyOrders = list('armyOrders')
    musters = list('musters')
    settles = list('settles').filter((o) => o.kind !== 'migrateAuto') // 자동 분배는 늘 켜짐 — 옛 초안의 켜고 끄기는 버린다
    plots = list('plots')
    heroOrders = list('heroOrders')
    guards = Array.isArray(d['guards']) ? (d['guards'] as string[]) : []
    scout = typeof d['scout'] === 'string' ? d['scout'] : ''
    rite = d['rite'] === true
    Object.assign(pick, rec<{ edge: string; ambush: boolean; ration?: Ration }>('pick'))
    for (const p of Object.values(pick)) if (p !== undefined && typeof p.ration === 'string') p.ration = rationExtra(p.ration) ?? P.realm.rationReserve
    Object.assign(answers, rec<boolean>('answers'))
    if (Array.isArray(d['hireShown'])) for (const id of d['hireShown'] as unknown[]) if (typeof id === 'string') hireShown.add(id)
    if (Array.isArray(d['goalStop'])) goalStop = (d['goalStop'] as unknown[]).filter((x): x is string => typeof x === 'string')
    if (Array.isArray(d['landSeen'])) for (const k of d['landSeen'] as unknown[]) if (typeof k === 'string') landSeen.add(k)
    // 옛 초안은 나라 열쇠 — 새 열쇠로 다시 단다
    for (const e of Object.values(rec<Envoy>('envoys'))) if (e !== null && typeof e === 'object' && typeof e.to === 'string') envoys[ekey(e.to, e.ask)] = e
    Object.assign(persuadeBy, rec<string>('persuadeBy'))
    Object.assign(hands, rec<Hand>('hands'))
    // 재상에게 맡기기 — 계절 가운데 바꾼 것 (판에는 계절을 넘길 때 실린다)
    if (typeof d['autoIdle'] === 'boolean') realm.autoIdle = d['autoIdle']
    if (Array.isArray(d['manual'])) realm.manual = { ...(realm.manual ?? {}), [me()]: (d['manual'] as unknown[]).filter((x): x is string => typeof x === 'string').sort() }
  }

  /**
   * 탭의 빨간 점 (형: "떠돌이 장수 오거나 뭔가 특별한 거 생기면 그 탭에는 빨간색 점") — 탭마다 새로 생긴 일의 열쇠.
   * 탭을 열면 본 것으로 친다. 답할 청은 답할 때까지 켜 둔다.
   */
  function dotKeys(r: Realm, tab: (typeof TABS)[number]['id']): string[] {
    const R = realm!
    switch (tab) {
      case 'heroes':
        return [
          ...wanderersFor(r, me()).map((w) => `w:${w.hero.id}`),
          ...Object.values(r.heroes).filter((x) => x.status === 'captive' && x.captor === me()).map((x) => `c:${x.id}`),
        ]
      case 'diplo': return openAsks(R, me()).filter((a) => answers[a.id] === undefined).map((a) => `a:${a.id}:${R.season}`)
      case 'army': return seenMarches(R, me()).filter((a) => a.march !== null && R.nodes[a.march.to]?.owner === me()).map((a) => `m:${a.id}:${R.season}`)
      default: return []
    }
  }

  function markSeen(tab: string): void {
    if (realm === null || !TABS.some((t) => t.id === tab)) return
    if (tab === 'diplo') return // 답할 청은 답해야 꺼진다
    for (const k of dotKeys(plan(), tab as (typeof TABS)[number]['id'])) seenKeys.add(k)
    try { localStorage.setItem(SEEN_KEY, JSON.stringify({ seed: realm.seed, player: realm.player, keys: [...seenKeys] })) } catch { /* 저장 못 하는 곳 */ }
  }

  function loadSeen(): void {
    seenKeys = new Set()
    if (realm === null) return
    try {
      const d = JSON.parse(localStorage.getItem(SEEN_KEY) ?? 'null') as { seed?: number; player?: string; keys?: string[] } | null
      if (d !== null && d.seed === realm.seed && d.player === realm.player && Array.isArray(d.keys)) seenKeys = new Set(d.keys)
    } catch { /* 없으면 처음부터 */ }
  }

  /**
   * 계절이 넘어간다 (형: "턴 넘어갈때 넘어간다는것좀 보여졌음 좋겠네 … 하스스톤은 매번 뭔지 나오고") —
   * 화면 가운데 새 계절 이름이 크게 떴다 사라지고 종이 한 번 울린다. 애니메이션이 끝나면 지운다(타이머 없음).
   */
  function seasonFx(season: number): void {
    const s = seasonOf(season)
    const el = document.createElement('div')
    el.className = `seasonfx ${s}`
    el.innerHTML = `<i class="band"><i class="bimg" style="--hbg:url('${ART}season/season-${s}.jpg');--vbg:url('${ART}season-v/season-${s}.jpg')"></i></i><div class="stxt"><i class="orn"></i>${icon(SEASON_ICON[s], 'sfx-ic')}<b>${esc(seasonLabel(season))}</b><span>${esc(SEASON_LINE[s])}</span><i class="orn"></i></div>`
    el.addEventListener('animationend', (e) => { if (e.target === el) el.remove() }) // 안쪽 글자의 애니메이션이 먼저 끝나도 띠를 걷지 않는다
    root.appendChild(el)
    ding(snd('season_turn'), 0.4)
  }

  /**
   * 혼례와 아이 — 계절 띠가 걷힌 뒤 한 장면씩 (형 10-23: "혼인하고 자식 낳는 거 하면 별도의 연출 필요하지 않나?").
   * 혼례: 두 사람이 양쪽에서 다가와 나란히 · 꽃잎. 아이: 금빛 속에서 얼굴이 떠오르고 물려받은 특성이 하나씩. 누르면 다음 장면
   */
  /**
   * 신방을 살펴본다 — 등잔 아래 넉 장이 천천히 넘어간다 · 두 사람 얼굴은 아래에 작게 (형 10-24: "신방 카드에 신방을 살펴본다 버튼 · 어느 정도 선정성을 갖춘 상업용 이미지 · 영상 연출 · 배경음악")
   * 그림 속 사람은 얼굴이 안 보이게 — 누구인지는 화면이 얹는 얼굴이 말한다. 누르면 닫힌다.
   */
  function bridalLook(r: Realm, id: string): void {
    const x = r.heroes[id]
    const sp = x?.spouse !== undefined ? r.heroes[x.spouse] : undefined
    if (x === undefined || sp === undefined || root.querySelector('.cere.bridal') !== null) return
    const S = P.realm.bridalShotS
    const pics = BRIDAL_SHOTS.map(([f, line], i) => `<i class="bpic${i % 2 === 1 ? ' odd' : ''}" style="--i:${i};${sceneBg(f)}"></i><span class="bcap" style="--i:${i}">${esc(line)}</span>`).join('')
    let motes = ''
    for (let i = 0; i < 14; i++) motes += `<i style="--x:${(i * 43) % 100}%;--t:${((i * 0.41) % 3).toFixed(2)}s;--sp:${(5 + ((i * 0.7) % 3)).toFixed(2)}s"></i>`
    root.insertAdjacentHTML('beforeend', `<div class="cere bridal" style="--s:${S}s;--n:${BRIDAL_SHOTS.length}">${pics}<i class="bveil"></i><div class="bmote">${motes}</div>`
      + `<div class="bpair">${bust(x, 'cf')}<b>${esc(x.name)} · ${esc(sp.name)}</b>${bust(sp, 'cf')}</div><span class="bskip">누르면 닫힌다</span></div>`)
    const el = root.lastElementChild as HTMLElement
    music.bridal()
    let gone = false
    const close = (): void => {
      if (gone) return
      gone = true
      el.classList.add('out')
      window.setTimeout(() => { el.remove(); if (realm !== null) music.map(seasonOf(realm.season)) }, 450)
    }
    el.addEventListener('click', (e) => { e.stopPropagation(); close() })
  }

  function ceremonyFx(prev: Realm, r: Realm, rep: Report): void {
    noteFaces(r) // 갓 난 아이도 얼굴이 있게 — 화면이 판을 그리기 전에 장면이 먼저 뜬다
    const scenes: string[] = []
    /** 등용 장면을 이미 띄운(띄울) 장수 — 같은 장수가 두 번 뜨지 않게 */
    const joinShown = new Set<string>()
    for (const l of rep.lines) {
      if (l.kind === 'wed' && l.faction === me()) {
        const a = r.heroes[l.a], b = r.heroes[l.b]
        let petals = ''
        for (let i = 0; i < 22; i++) petals += `<i style="--x:${(i * 37) % 100}%;--t:${((i * 0.29) % 2.4).toFixed(2)}s;--sp:${(3.6 + ((i * 0.53) % 2.2)).toFixed(2)}s"></i>`
        scenes.push(`<div class="cere wed"><i class="cbg" style="${sceneBg('event-marriage')}"></i><div class="cpet">${petals}</div>`
          + `<div class="cpair"><div class="cl">${bust(a, 'cf')}<b>${esc(a?.name ?? '')}</b></div><div class="cr">${bust(b, 'cf')}<b>${esc(b?.name ?? '')}</b></div></div>`
          + `<div class="cw"><b>혼례</b><span>${esc(josa(a?.name ?? '', '과', '와'))} ${esc(josa(b?.name ?? '', '이', '가'))} 짝을 맺었다</span><small>신혼 ${P.realm.wedHoney}계절: 함께 지내면 아이가 일찍 온다</small></div></div>`)
      } else if (l.kind === 'recruit' && l.faction === me()) {
        // 떠돌이 등용은 단추를 누른 그 순간 이미 보여 줬다 (hireShown) — 계절 기록에만 남는다
        joinShown.add(l.hero)
        if (l.how === 'wanderer' && hireShown.delete(l.hero)) continue
        const x = r.heroes[l.hero]
        if (x !== undefined) scenes.push(hireSceneHtml(x, l.how))
      } else if (l.kind === 'expBack' && l.faction === me() && l.got.kind === 'wanderer') {
        // 원정길에서 만나 따라온 장수 — 등용 기록 없이 바로 들어오니 여기서 연출 (형 10-24: "견지 버들 어느새 들어와 있는데 등용 이펙트 안 나왔음")
        joinShown.add(l.got.hero)
        const x = r.heroes[l.got.hero]
        if (x !== undefined) scenes.push(hireSceneHtml(x, 'expedition'))
      } else if (l.kind === 'birth' && l.faction === me()) {
        const grow = (r.growing ?? []).find((g) => g.hero.id === l.hero)
        const kid = r.heroes[l.hero] ?? grow?.hero, a = r.heroes[l.a], b = r.heroes[l.b]
        const traits = (kid?.traits ?? []).map((t) => `<span class="ctr${t === l.surprise ? ' new' : ''}" data-tip="${esc(TRAIT[t]?.line ?? '')}">${esc(TRAIT[t]?.name ?? t)}${t === l.surprise ? ' · 타고났다' : ''}</span>`).join('')
        scenes.push(`<div class="cere birth"><i class="cbg" style="${sceneBg('event-newborn')}"></i><i class="cglow"></i>`
          + `<div class="ckid">${bust(kid, 'cf big')}<div class="cpar">${bust(a, 'cf sm')}${bust(b, 'cf sm')}</div></div>`
          + `<div class="cw"><b>탄생</b><span>${esc(a?.name ?? '')}·${esc(b?.name ?? '')}의 아이 ${esc(josa(kid?.name ?? '', '이', '가'))} 태어났다</span>${grow !== undefined ? `<small>${grow.grown - r.season}계절 자라면 장수로 나선다</small>` : ''}${traits !== '' ? `<div class="ctrs">${traits}</div>` : ''}</div></div>`)
      }
    }
    // 사로잡음 — 우리가 적장을 · 적이 우리 장수를. 등용처럼 크게 (형 10-24)
    for (const l of rep.lines) {
      if (l.kind !== 'battle' || l.captured === null) continue
      const x = r.heroes[l.captured]
      if (x === undefined || x.status !== 'captive') continue
      if (x.captor === me()) scenes.push(captureSceneHtml(x, true, r.nodes[l.node]?.name ?? ''))
      else if (x.faction === me()) scenes.push(captureSceneHtml(x, false, r.factions[x.captor ?? '']?.name ?? ''))
    }
    // 어떤 길로든 새로 우리 편이 된 장수 — 망명 · 다 자람 · 나라가 들어옴 … 길마다 따로 챙기다 빠지지 않게 판을 견준다
    // (형 10-24: "번예 새벽 망명자로 받아들였는데 등용 연출이 안 생겼다 · 언제 어디서 우리 장수가 되든 제대로")
    const joinHow = (id: string): JoinHow => rep.lines.some((l) => l.kind === 'grown' && l.hero === id) ? 'grown'
      : rep.lines.some((l) => l.kind === 'card' && l.faction === me() && l.card === 'exile' && l.pick === 0) ? 'exile' : 'join'
    let joins = 0
    for (const x of sorted(Object.values(r.heroes))) {
      if (x.faction !== me() || x.status !== 'free' || joinShown.has(x.id) || hireShown.has(x.id)) continue
      const before = prev.heroes[x.id]
      if (before !== undefined && before.faction === me()) continue
      joinShown.add(x.id)
      if (joins++ < JOIN_SCENES_MAX) scenes.push(hireSceneHtml(x, joinHow(x.id)))
    }
    // 태몽 — 아이가 오기 한 계절 앞, 밤하늘에서 금빛 용이 구슬을 물고 지붕 위로 (그림 줄 ⑥ · 한 쌍에 한 번)
    for (const b of r.births ?? []) {
      const key = `${b.a}|${b.b}|${b.wed ?? 0}`
      if (b.faction !== me() || b.due !== r.season + 1 || dreamt.has(key)) continue
      dreamt.add(key)
      const a = r.heroes[b.a], c = r.heroes[b.b]
      scenes.push(`<div class="cere birth dream"><i class="cbg" style="${sceneBg('event-dream')}"></i><i class="cglow"></i>`
        + `<div class="cpar">${bust(a, 'cf sm')}${bust(c, 'cf sm')}</div>`
        + `<div class="cw"><b>태몽</b><span>${esc(a?.name ?? '')}·${esc(c?.name ?? '')}의 지붕 위로 금빛 용이 구슬을 물고 내려왔다</span><small>다음 계절에 아이가 온다</small></div></div>`)
    }
    // 풍습·나라 고리·땅 한 수가 우리 나라에 처음 걸렸다 — 도장이 쾅 · 사서 한 줄 · 북과 종 (CUSTOMS §8-1 지킬 것 4 · WWE 오버액션)
    for (const l of rep.lines) if (l.kind === 'custom' && l.first === true && l.faction === me()) scenes.push(customSceneHtml(prev, r, l))
    if (scenes.length === 0) return
    playScenes(scenes, CEREMONY_LEAD_MS)
  }

  /** 처음 걸린 풍습의 장면 — 그림이 도장처럼 내려찍히고 불티가 튄다. 층 · 이번에 무슨 일이 났나 · 사서 한 줄 · 동사 한 문장 */
  function customSceneHtml(prev: Realm, r: Realm, l: Extract<ReportLine, { kind: 'custom' }>): string {
    const c = customDef(l.id)
    const said = reportText(prev, r, l, me()) ?? c.does
    const tier = c.tier === 'nation' ? '나라 고리' : c.tier === 'land' ? '땅이 준 한 수' : '결 풍습'
    let sparks = ''
    for (let i = 0; i < 16; i++) sparks += `<i style="--a:${(i * 22.5).toFixed(1)}deg;--d:${(0.45 + (i % 4) * 0.12).toFixed(2)}s"></i>`
    return `<div class="cere custom t-${c.tier}"><i class="cglow"></i>`
      + `<div class="cstamp">${icon(CUSTOM_ICON[l.id] ?? 'status-good-omen', 'csi')}<b>${esc(c.name)}</b><span class="cspk">${sparks}</span></div>`
      + `<div class="cw"><b>${tier}</b><span>${tx(said)}</span><em>${esc(c.source)}</em>${c.verb !== '' ? `<small>${esc(c.verb)}</small>` : ''}<button class="btn pri cok">확인</button></div></div>`
  }

  /**
   * 등용 — 사선 칼금 셋이 얼굴의 다른 곳을 하나씩 보여 주고(촥·촥·촥) 펑, 큰 얼굴이 화면 절반으로 (형 10-24: "기대감을 증폭시키면서 이미지를 자세히 보게 · 촥,촥,촥, 펑~")
   * 빛은 그 장수의 가장 좋은 특성 빛 · 이름 · 「주군을 모시겠습니다」 · 특성이 하나씩
   */
  function hireSceneHtml(x: Hero, how: JoinHow): string {
    const RANK = { common: 0, good: 1, rare: 2, precious: 3, legend: 4 } as const
    const ts = (x.traits ?? []).map((t) => TRAIT[t]).filter((t): t is NonNullable<typeof t> => t !== undefined)
    const top = ts.filter((t) => t.bad !== true).sort((p, q) => RANK[q.grade] - RANK[p.grade])[0]
    const gc = top !== undefined ? GRADE_COLOR[top.grade] : '#f0d090'
    const file = bustOf(x.id)
    const src = file !== undefined ? `${ART}bust/${file}.jpg` : ''
    const face = src !== '' ? `<img class="hbust" src="${src}" alt="">` : bust(x, 'hbust')
    // 컷인 셋 — 화면을 위아래로 가로지르는 사선 띠마다 그림의 한 곳을 크게 (손·무기 → 어깨·장신구 → 눈빛) (형 10-24: "사선 부위만 화면에 꽉 찰 정도로 확대")
    // 크게 키우니 320px 카드로는 뭉개진다 — 큰 판(bust-hd · tools/bust-hd.ps1)을 위에, 없으면 아래 카드가 보인다
    const hd = file !== undefined ? `url('${ART}bust-hd/${file}.jpg'), ` : ''
    const cuts = src !== '' ? `<div class="hbands">${[1, 2, 3].map((k) => `<i class="hb b${k}"><i style="background-image:${hd}url('${src}')"></i></i>`).join('')}</div>` : ''
    let motes = ''
    for (let i = 0; i < 18; i++) motes += `<i style="--x:${(i * 41) % 100}%;--t:${((i * 0.37) % 2.2).toFixed(2)}s;--sp:${(2.6 + ((i * 0.61) % 1.8)).toFixed(2)}s"></i>`
    // 특성 칩 — 누르고 있거나 올려 두면 무슨 특성인지 (형 10-24: "배신의 상(→ 반골의 상)·매혹 … 터치하고 있으면 설명, 손 떼면 없애고")
    const chips = ts.map((t, i) => `<span class="ctr" data-tip="${esc(t.line)}" style="--g:${GRADE_COLOR[t.grade]};animation-delay:${(2.36 + i * 0.18).toFixed(2)}s">${esc(t.name)}</span>`).join('')
    const line = JOIN_LINE[how]
    return `<div class="cere hire" data-hid="${esc(x.id)}" style="--gc:${gc}"><i class="cglow"></i><div class="cmote">${motes}</div>`
      + `<div class="hframe">${face}<i class="hfr"></i></div>${cuts}<i class="cflash"></i>`
      + `<div class="cw"><b>등용</b><span class="hname">${esc(x.name)}</span><span>${line}</span><em>「${esc(HIRE_LINE[x.id] ?? HIRE_BY_TRAIT[x.traits?.[0] ?? ''] ?? HIRE_PLAIN)}」</em>${chips !== '' ? `<div class="ctrs">${chips}</div>` : ''}`
      // 확인 — 눌러서 판으로 돌아간다 (형 10-24: "등용되고 나서 확인 버튼 · 게임으로 돌아갈 수가 없어")
      + `<button class="btn pri cok">확인</button></div></div>`
  }

  /**
   * 장수 그림을 화면 가득 (형 10-25: "이미지 클릭하면 왕크게 구경할 수 있게 · 유저들이 이미지 구경하고 싶잖아").
   * 큰 판(bust-hd 900px)을 먼저, 없으면 카드 그림. 아무 데나 누르면 닫힌다
   */
  function openBust(src: string): void {
    root.querySelector('.bview')?.remove()
    root.insertAdjacentHTML('beforeend', `<div class="bview" data-act="bust-close" role="dialog" aria-label="장수 그림 크게"><img alt=""><small>누르면 닫힌다</small></div>`)
    const img = root.querySelector<HTMLImageElement>('.bview img')!
    img.addEventListener('error', () => { if (img.src !== new URL(src, location.href).href) img.src = src }, { once: true })
    img.src = src.replace('/bust/', '/bust-hd/')
  }

  /** 아이 얼굴 — 자라는 아이는 어린 얼굴, 다 자라 장수가 되면 어른 얼굴 */
  function noteFaces(r: Realm): void {
    noteGrowing((r.growing ?? []).map((g) => g.hero))
    noteKids(Object.values(r.heroes))
  }

  /** 사로잡음 장면 — 적장을 잡았다(옥에 가둔다 · 회유하면 우리 장수) / 우리 장수가 잡혔다(화친·그 나라 도읍을 치면 돌아온다) */
  function captureSceneHtml(x: Hero, ours: boolean, where: string): string {
    const bg = ours ? 'event-capture' : 'event-captured-ours'
    const title = ours ? '사로잡았다' : '사로잡혔다'
    const line = ours ? `${josa(where, '에서', '에서')} 적장을 붙잡아 옥에 가두었다` : `${josa(where, '에', '에')} 붙잡혀 갔다`
    const how = ours ? '회유하면 우리 장수가 된다. 장수 판의 「옥에 가둔 적장」' : '화친을 맺거나 그 나라의 도읍을 치면 풀려 돌아온다'
    // 옥 — 금 액자·밧줄 대신 쇠 테, 얼굴이 드러난 뒤 쇠창살이 위에서 철컹 내려와 닫힌다 (형 10-25: "포로인데 금액자 · 감옥 같은 액자 · 쇠창살이 위에서 아래로 철컹")
    const bars = `<i class="jbars"><b></b></i>`
    return `<div class="cere hire capt${ours ? '' : ' lost'}" style="--gc:${ours ? '#9aa3ad' : '#c0504a'}"><i class="cbg" style="${sceneBg(bg)}"></i><i class="cglow"></i>`
      + `<div class="hframe">${bust(x, 'hbust')}<i class="jail"></i>${bars}</div><i class="cflash"></i>`
      + `<div class="cw"><b>${title}</b><span class="hname">${esc(x.name)}</span><span>${esc(line)}</span><em>${esc(how)}</em>`
      + `<button class="btn pri cok">확인</button></div></div>`
  }

  /**
   * 침략 — 전장 앞에 한 장. 누가 · 어디로 · 얼마나. 단추를 눌러야 전장이 열린다.
   * 넷으로 가른다 (형 10-25: "적의 침략은 정말 침략당하는 이미지로 · 길에서 마주친 거랑 우리 성이 공성당하는 거랑 다르니까 이미지랑 연출 다시") —
   *   기습(밤에 숨어 닿았다) · 조우(길에서 맞닥뜨림) · 공성(우리 도읍·성·목책 고을을 에워쌈) · 침략(마을로 쳐들어옴)
   * 그림 · 제목 · 소리 · 움직임이 저마다 다르다
   */
  function invasionSplash(prev: Realm, l: BattleLine, go: () => void): void {
    const who = prev.factions[l.atkFaction ?? '']?.name ?? '적'
    const n = prev.nodes[l.node]
    const where = n?.name ?? ''
    const men = [l.attacker, ...l.allies].reduce((s, id) => s + (prev.armies[id] !== undefined ? headcount(forceOf(prev, prev.armies[id]!)) : 0), 0)
    const walled = n !== undefined && (n.kind === 'capital' || n.kind === 'fort' || n.tags.includes('palisade') || n.tags.includes('moat'))
    const kind: 'ambush' | 'field' | 'siege' | 'raid' = l.ambush === 'success' ? 'ambush' : l.field === true ? 'field' : walled ? 'siege' : 'raid'
    const S = {
      ambush: { bg: 'event-night-raid', title: '적의 기습', line: `${josa(who, '이', '가')} 어둠을 타고 ${josa(where, '으로', '로')} 숨어 들었다`, sub: '미처 채비를 못 했다', btn: '맞서 싸운다' },
      field: { bg: 'event-invade-field', title: '마주침', line: `${where} 가는 길에서 ${who} 군대와 마주쳤다`, sub: '들판에서 맞붙는다', btn: '맞붙는다' },
      siege: { bg: 'event-invade-siege', title: '적의 침공', line: `${josa(who, '이', '가')} ${josa(where, '을', '를')} 치러 몰려온다`, sub: '성벽 위에서 막는다', btn: '성을 지킨다' },
      raid: { bg: 'event-invade-raid', title: '적의 침략', line: `${josa(who, '이', '가')} ${josa(where, '으로', '로')} 쳐들어왔다`, sub: '마을을 지킨다', btn: '맞서 싸운다' },
    }[kind]
    const caught = l.ambush === 'caught' ? '숨어 오던 것을 먼저 알아챘다 · ' : ''
    root.insertAdjacentHTML('beforeend', `<div class="cere invade k-${kind}"><i class="cbg" style="${sceneBg(S.bg)}"></i><div class="ifx">${invadeFx(kind, l.atkFaction ?? '')}</div>`
      + `<div class="cw"><b>⚔ ${S.title}</b><span class="hname">${emblem(l.atkFaction ?? null, 'iem')}${esc(S.line)}</span>`
      + `<span>${caught}${men > 0 ? `적 군대 약 ${men.toLocaleString('ko-KR')}명 · ` : ''}${S.sub}</span><button class="btn pri cok">${S.btn}</button></div></div>`)
    const el = root.lastElementChild as HTMLElement
    // 소리도 저마다 — 침략은 경종과 함성 · 공성은 북과 화살비 · 조우는 말발굽과 함성 · 기습은 낮은 경종
    const cue: ReadonlyArray<readonly [number, Parameters<typeof snd>[0], number]> = kind === 'siege' ? [[0, 'war_drum', 0.55], [550, 'arrow_volley', 0.45]]
      : kind === 'field' ? [[0, 'horses', 0.5], [700, 'war_cry', 0.4]]
        : kind === 'raid' ? [[0, 'war_bell', 0.5], [600, 'war_cry', 0.35]] : [[0, 'war_bell', 0.35]]
    for (const [ms, s, v] of cue) window.setTimeout(() => { if (el.isConnected) ding(snd(s), v) }, ms)
    if (kind === 'siege') buzz([40, 60, 40])
    el.querySelector('.cok')?.addEventListener('click', (e) => { e.stopPropagation(); el.remove(); go() })
  }

  /** 침략 장면의 움직임 — 불티(침략) · 쏟아지는 화살(공성) · 양쪽 깃발이 맞부딪힘(조우) · 어둠이 조여 옴(기습). 낱낱이 (메모리: 이펙트는 낱낱이) */
  function invadeFx(kind: 'ambush' | 'field' | 'siege' | 'raid', foe: string): string {
    const f = (i: number, k: number): number => ((i * 37 + k * 61) % 100) / 100
    if (kind === 'raid') return Array.from({ length: 18 }, (_, i) => `<i class="emb" style="--x:${(f(i, 1) * 100).toFixed(0)}%;--d:${(2.6 + f(i, 2) * 2.4).toFixed(2)}s;--t:${(-f(i, 3) * 4).toFixed(2)}s;--s:${(3 + f(i, 4) * 5).toFixed(1)}px;--w:${Math.round((f(i, 5) - 0.5) * 80)}px"></i>`).join('')
    if (kind === 'siege') return Array.from({ length: 12 }, (_, i) => `<img class="iarw" src="${ART}fx/arrow.png" alt="" style="--x:${(30 + f(i, 1) * 70).toFixed(0)}%;--t:${(f(i, 2) * 1.6).toFixed(2)}s;--d:${(0.7 + f(i, 3) * 0.4).toFixed(2)}s">`).join('') + `<img class="idust" src="${ART}fx/dust.png" alt="">`
    if (kind === 'field') return `<i class="iflag l" style="--fc:${FACTION_ART[me()]?.color ?? '#c9a45a'}"><img src="${ART}icon/${flagIcon(me()) ?? 'emblem-shell'}.png" alt=""></i><i class="iflag r" style="--fc:${FACTION_ART[foe]?.color ?? '#a03a2a'}"><img src="${ART}icon/${flagIcon(foe) ?? 'emblem-shell'}.png" alt=""></i><img class="idust c" src="${ART}fx/dust.png" alt="">`
    return '<i class="idark"></i>'
  }

  /** 큰 장면을 차례로 — 누르면 다음 (혼례·등용·탄생·태몽) */
  function playScenes(scenes: readonly string[], lead: number): void {
    const show = (i: number): void => {
      if (i >= scenes.length) return
      root.insertAdjacentHTML('beforeend', scenes[i]!)
      const el = root.lastElementChild as HTMLElement
      const capt = el.classList.contains('capt')
      const hire = el.classList.contains('hire') && !capt
      if (document.visibilityState === 'visible') {
        if (capt) {
          ding(snd(el.classList.contains('lost') ? 'defeat' : 'capture'), 0.5)
          // 쇠창살이 닫히는 그 때 — 쇠판 소리와 떨림
          window.setTimeout(() => { if (el.isConnected) { ding(snd('cmd_hold'), 0.75, 0.9); buzz([50, 30, 80]) } }, P.realm.captSlamMs)
        }
        else if (hire) { for (const t of P.realm.hireCutMs) window.setTimeout(() => ding(snd('cmd_duel'), 0.32), t); window.setTimeout(() => ding(snd('hire_go'), 0.55), P.realm.hirePopMs) }
        else if (el.classList.contains('custom')) {
          // 풍습이 처음 걸렸다 — 북이 울리고, 도장이 내려찍히는 때 종과 떨림
          ding(snd('war_drum'), 0.6)
          window.setTimeout(() => { if (el.isConnected) { ding(snd('war_bell'), 0.45); buzz([30, 40, 70]) } }, P.realm.customStampMs)
        }
        // 혼례는 배경 음악으로 — 꼭두각시 01~04 한 곡, 닫으면 지도 음악으로 잦아들며 돌아간다 (형 10-29)
        else if (el.classList.contains('wed')) music.wedding()
        else ding(snd('birth'), 0.5)
      }
      if (hire) window.setTimeout(() => buzz([20, 40, 20, 40, 60]), P.realm.hirePopMs)
      // 얼굴이 다 드러나면 그 장수가 첫마디를 한다 — 이름 아래 「」 대사 그대로 (voice.ts · 소리를 못 받으면 조용히)
      const voiced = hire ? realm?.heroes[el.dataset['hid'] ?? ''] : undefined
      if (voiced !== undefined) window.setTimeout(() => {
        if (el.isConnected && realm !== null && voiceGate(performance.now())) ding(hireVoicePath(voiced, isRuler(realm, voiced.id)), P.realm.voiceVol)
      }, P.realm.hireVoiceMs)
      let gone = false
      const close = (): void => {
        if (gone) return
        gone = true
        el.classList.add('out')
        if (el.classList.contains('wed') && realm !== null) music.map(seasonOf(realm.season)) // 혼례 가락은 잦아들고 지도 음악으로
        window.setTimeout(() => { el.remove(); show(i + 1) }, 450)
      }
      // 특성 칩을 누르면(설명을 보려고) 장면이 닫히지 않는다 · 누르고 있는 동안은 저절로도 안 닫힌다
      let reading = false
      el.addEventListener('pointerdown', (e) => { reading = (e.target as HTMLElement).closest('.ctr[data-tip]') !== null })
      // 등용·사로잡음은 「확인」으로만 닫는다 — 저절로도, 아무 데나 눌러도 안 닫힌다 (형 10-24: "알아서 꺼지지 않고 확인 누르면 꺼지게")
      const okOnly = el.querySelector('.cok') !== null
      el.addEventListener('click', (e) => { e.stopPropagation(); if (okOnly || (e.target as HTMLElement).closest('.ctr[data-tip]') !== null) return; close() })
      // 확인 단추는 장면 밖 누르기와 상관없이 언제나 닫는다 (위에 무엇이 덮여 있어도)
      el.querySelector('.cok')?.addEventListener('click', (e) => { e.stopPropagation(); close() })
      const until = (): void => { if (reading) { window.setTimeout(until, 600); return } close() }
      for (const end of ['pointerup', 'pointercancel', 'pointerleave'] as const) el.addEventListener(end, () => { reading = false })
      if (!okOnly) window.setTimeout(until, CEREMONY_MS)
    }
    window.setTimeout(() => show(0), lead)
  }

  /** 막혔다 — 화면 위에 까닭과 기록 내보내기 단추를 띄우고, 판 기록에도 남긴다 (형이 보내 주면 그 판을 그대로 다시 돌려 본다) */
  function failNote(e: unknown): void {
    const msg = e instanceof Error ? `${e.message} @ ${(e.stack ?? '').split('\n').slice(1, 3).join(' ').trim()}` : String(e)
    host.onTap('error', msg.slice(0, 300))
    let box = root.querySelector<HTMLElement>('.failbox')
    if (box === null) {
      box = document.createElement('div')
      box.className = 'failbox'
      root.appendChild(box)
    }
    box.innerHTML = `<b>여기서 막혔다.</b><span>${esc(msg.slice(0, 160))}</span>`
      + `<div class="btns"><button class="btn pri" data-act="export">기록 내보내기</button><button class="btn ghost" data-act="failclose">닫기</button></div>`
  }

  function paint(): void {
    try {
      // 첫 화면이면 판 음악을 끊는다 (형 10-23: "게임 승리하고 메인으로 갔을 때 bgm 이 계속 이어짐")
      if (!warOn && (front !== null || realm === null)) music.title()
      else if (!warOn && realm !== null) {
        // 판이 끝났다 — 이긴·진 음악 (계속 두는 판은 지도 음악)
        if (realm.outcome && !realm.endless) music.ending(realm.outcome.kind)
        else music.map(seasonOf(realm.season))
      }
      paintNow()
      fitLabels(root) // 단추 글이 넘치면 줄바꿈 대신 글씨를 줄인다 (형 10-25)
      stratPaint() // 전략 회의 화면 — 열려 있으면 다시 그린다
      wooPaint() // 회유할 사람 고르기 상자
      marquee(root) // 말줄임으로 잘린 한 줄 글은 지하철 안내판처럼 흐른다 (형 10-29)
    } catch (e) {
      failNote(e)
    }
  }

  /** 마지막으로 깐 지도 글 — 같으면 다시 깔지 않는다 */
  let lastMap = ''
  /** 지난번 그린 판 — 바뀌었을 때만 카드를 펼친다 */
  let lastSheet = ''

  function paintNow(): void {
    MINE = realm?.player ?? ''
    LIVE_RULER = realm !== null && front === null
      ? Object.fromEntries(Object.values(realm.factions).flatMap((f) => (f.ruler !== undefined ? [[f.id, f.ruler]] : [])))
      : {}
    if (realm !== null) noteFaces(realm)
    saveDraft()
    if (realm === null && front === null) front = { kind: 'title' }
    // 서막 — 같은 장이면 다시 깔지 않는다 (다시 깔면 글자가 처음부터 다시 번진다)
    const pl = realm !== null && front === null && prologue !== null ? prologueHtml(KIT, realm, prologue) : ''
    if ($('.plbox').dataset['html'] !== pl) { $('.plbox').innerHTML = pl; $('.plbox').dataset['html'] = pl }
    if (realm === null || front !== null) {
      root.classList.add('choosing')
      lastMap = ''
      // 도감은 장수를 누를 때마다 다시 그린다 — 내려 본 자리를 지킨다
      const keepSel = front?.kind === 'dex' ? '.front.dexp' : front?.kind === 'drill' && !front.anim ? '.front.dyard' : null
      const keepFront = keepSel !== null ? (root.querySelector(keepSel)?.scrollTop ?? 0) : 0
      $('.mapwrap').innerHTML = frontHtml(front!)
      if (keepSel !== null && keepFront > 0) { const fe = root.querySelector(keepSel); if (fe !== null) fe.scrollTop = keepFront }
      if (front?.kind === 'title') fitTitle()
      $('.top').innerHTML = ''
      $('.tabs').innerHTML = ''
      $('.legend').innerHTML = ''
      $('.selbar').innerHTML = ''
      $('.roadkey').innerHTML = ''
      $('.tutband').innerHTML = ''
      $('.goalb').innerHTML = ''
      $('.todo').innerHTML = ''
      tutSheet.textContent = ''
      spot.set(undefined, null)
      $('.sheet').innerHTML = ''
      $('.modal').innerHTML = ''
      $('.modal').dataset['html'] = ''
      root.classList.remove('sheet-open', 'modal-open')
      return
    }
    root.classList.remove('choosing')
    $('.seasonp').dataset['s'] = seasonOf(realm.season)
    const r = plan()
    morph($('.top'), topHtml(r)) // 바뀐 곳만 — 통째로 갈면 그림이 깜빡인다 (형 10-24)
    rollTop(realm.season)
    const wrap = $('.mapwrap')
    const keep = [wrap.scrollLeft, wrap.scrollTop] as const
    const first = wrap.querySelector('.map') === null
    // 지도가 그대로면 다시 깔지 않는다 — 징병 수 ± 처럼 판만 바뀔 때마다 바탕 그림이 깜빡였다 (형: "뒷배경이 너무 깜빡거림")
    const mh = mapPart(r)
    if (mh !== lastMap || first) {
      wrap.innerHTML = mh
      lastMap = mh
      // 다음 계절 바탕을 미리 — 계절이 넘어갈 때 새 그림을 그제야 받느라 깜빡였다 (형 10-23). 그린 뒤 한숨 돌리고
      const rg = r.region ?? 'byeonhan-mini'
      const next = seasonOf(r.season + 1)
      window.setTimeout(() => warmNextSeason(ART, rg, next), WARM_MS)
    }
    zoom.apply()
    if (first) {
      // 처음엔 우리 국읍이 가운데 오게
      const cap = realm.factions[me()]?.capital
      const el = cap !== undefined ? wrap.querySelector<HTMLElement>(`.nd[data-node="${cap}"]`) : null
      if (el !== null) {
        wrap.scrollLeft = el.offsetLeft - wrap.clientWidth / 2
        wrap.scrollTop = el.offsetTop - wrap.clientHeight / 2
      }
    } else [wrap.scrollLeft, wrap.scrollTop] = keep
    paintTut(r)
    const sb = selBarHtml(r)
    morph($('.selbar'), sb)
    $('.selbar').classList.toggle('pp', partySel !== '' && armySel.length === 0) // 개척단 띠는 작게 — 가린 고을을 누를 수 있게
    root.classList.toggle('sel-open', sb !== '')
    morph($('.roadkey'), roadKeyHtml())
    $('.layers').innerHTML = layersOpen ? layersHtml() : ''
    // 답할 청이 남았으면 깃발 줄 끝에 사신 알림 — 누르면 외교 판
    const waiting = openAsks(realm, me()).filter((a) => answers[a.id] === undefined).length
    morph($('.legend'), legendHtml(r) + (waiting > 0 ? `<button class="askpill" data-act="tab" data-tab="diplo">${icon('good-tribute-bell')}사신 ${waiting}</button>` : ''))
    $('.next').innerHTML = `다음 계절 <span>›</span>`
    morph($('.todo'), todoHtml(r))
    morph($('.goalb'), goalBandHtml(r, esc, goalFolded()) + contestHtml(r)) // 캠페인의 장이면 이 장의 목표 — 접을 수 있다
    $('.goalb').classList.toggle('folded', goalFolded())
    let tabs = ''
    const rec = recTabs(r)
    for (const t of TABS) {
      const wait = tabWait(r, t.id)
      if (wait > 0) { tabs += `<button class="locked" disabled data-tip="${t.name}: ${wait}계절 뒤에 열린다">🔒<span>${t.name}</span></button>`; continue }
      const dot = dotKeys(r, t.id).some((k) => !seenKeys.has(k))
      tabs += `<button class="${sheet?.kind === t.id ? 'on' : ''}${newTab === t.id ? ' fresh' : ''}" data-act="tab" data-tab="${t.id}" data-tip="${t.name}" data-more="${t.more}">${icon(t.icon, 'tic')}<span>${t.name}</span>${dot ? '<i class="dot"></i>' : ''}${rec.has(t.id) ? `<i class="rec" title="${esc(rec.get(t.id)!)}">추천</i>` : ''}</button>`
    }
    noteNewTabs(r)
    morph($('.tabs'), tabs)
    const sh = $('.sheet')
    const keepSheet = sh.scrollTop
    let body = ''
    if (sheet !== null) {
      switch (sheet.kind) {
        case 'army': body = armySheet(r); break
        case 'draft': body = draftSheet(r); break
        case 'people': body = peopleSheet(r); break
        case 'place': body = placeSheet(); break
        case 'diplo': body = diploSheet(r); break
        case 'scout': body = nudgeHtml(r, 'scout') + scoutSheet(r); break
        case 'heroes': body = nudgeHtml(r, 'heroes') + heroesSheet(r); break
        case 'hero': body = heroSheet(r, sheet.id); break
        case 'nation': body = nationSheet(r); break
        case 'help': body = helpSheet(); break
        case 'log': body = logSheet(); break
        case 'node': body = nodeSheet(r, sheet.id); break
      }
    }
    // 판을 새로 열 때만 카드가 한 장씩 펼쳐진다 (형: "하스스톤은 … 촤라락 하고 별개의 오브젝트가 서로다른 시간순서로 펴지고") —
    // 같은 판을 다시 그릴 때(숫자 ± 따위)는 펼치지 않는다
    const sk = sheet === null ? '' : sheet.kind === 'node' || sheet.kind === 'hero' ? `${sheet.kind}:${sheet.id}` : sheet.kind
    const newSheet = sk !== lastSheet
    sh.classList.toggle('deal', sk !== '' && newSheet)
    lastSheet = sk
    // 새 판을 열 때만 통째로(카드가 펼쳐진다) · 같은 판 안에서 누를 때는 바뀐 곳만 — 그림이 깜빡이지 않게 (형 10-24: 교환할 때 깜빡)
    const sheetHtml = sheet !== null ? `<div class="grip" data-act="close"></div>${body}` : ''
    if (newSheet) sh.innerHTML = sheetHtml
    else morph(sh, sheetHtml)
    sh.scrollTop = keepSheet
    // 방금 나눈 무리를 눈앞에 (형: "유저가 뭔가를 하면 항상 바로바로 적용돼야함")
    if (freshArmy !== '') scrollInside(sh.querySelector<HTMLElement>('.acard.fresh'), 'nearest')
    root.classList.toggle('sheet-open', sheet !== null)
    const modal = modalHtml(r)
    const box = $('.modal')
    // 같은 보고를 다시 그리면 싸움 카드가 처음부터 다시 돈다 — 바뀔 때만 갈아 끼우고, 답을 누른 뒤에는 바로 끝까지 보인다
    if (box.dataset['html'] !== modal) {
      const keepScroll = box.querySelector('.mcard')?.scrollTop ?? 0
      box.innerHTML = modal
      box.dataset['html'] = modal
      // 판을 이겼다 — 「승리」가 박힐 때 폰을 파바방 (그 때는 그림의 --wd)
      const wfx = box.querySelector<HTMLElement>('.front-end .winfx:not(.lose)')
      if (wfx !== null) window.setTimeout(() => buzz(WIN_BUZZ), fastNext ? 0 : Number.parseFloat(wfx.style.getPropertyValue('--wd')) * 1000)
      // 「승리」·「패배」가 박히는 그 순간에 뿔나팔·패배 소리 — 전엔 끝 음악(조용한 곡)이 서서히 올라올 뿐이라 이긴 줄 몰랐다 (형 10-25: "승리했을 때 소리가 제대로 나오는지 의문")
      const endFx = box.querySelector<HTMLElement>('.front-end .winfx')
      if (endFx !== null && !fastNext) {
        const lose = endFx.classList.contains('lose')
        window.setTimeout(() => ding(snd(lose ? 'defeat' : 'horn_victory'), lose ? 0.7 : 0.9), Number.parseFloat(endFx.style.getPropertyValue('--wd')) * 1000)
      }
      box.classList.toggle('fast', fastNext)
      // 새 계절의 보고는 계절 띠가 걷힌 뒤에 (형: "계절먼저 넘어가게 보이고 그다음에 천천히 다음꺼 띄워줘라")
      box.classList.toggle('late', !fastNext)
      const card = box.querySelector('.mcard')
      if (card !== null && fastNext) card.scrollTop = keepScroll
    }
    root.classList.toggle('modal-open', modal !== '')
  }

  function openSheet(s: Sheet | null): void {
    const same = s !== null && sheet !== null && s.kind === sheet.kind && (s.kind !== 'node' || (sheet.kind === 'node' && sheet.id === s.id))
    sheet = same ? null : s
    $('.sheet').scrollTop = 0
    note = ''
    paint()
  }

  /** 끝 화면 필름을 한 장씩 넘긴다 — 처음 누르면 필름을 멈추고 마지막 장(제목)에서 시작한다 */
  function filmStep(d: number): void {
    const clg = root.querySelector<HTMLElement>('.front-end .clg.film')
    if (clg === null) return
    const cps = [...clg.querySelectorAll<HTMLElement>('.cp')]
    const at = ((clg.classList.contains('browse') ? Number(clg.dataset['at']) : cps.length - 1) + d + cps.length) % cps.length
    clg.dataset['at'] = String(at)
    clg.classList.add('browse')
    cps.forEach((c, i) => c.classList.toggle('show', i === at))
    const sk = clg.querySelector('.skip')
    if (sk !== null) sk.textContent = `${at + 1} / ${cps.length}`
    ding(snd('ui_open'), 0.2)
  }

  /** 도감에 오른 장수 알림 — 오른쪽 위에 몇 초 (CSS 로 걷히고, 다 걷히면 치운다). 누르면 도감 */
  function dexToast(items: ReturnType<typeof recordDex>): void {
    root.querySelector('.dxtoast')?.remove()
    const html = dexToastHtml(DEX_KIT, items)
    if (html === '') return
    root.insertAdjacentHTML('beforeend', html)
    ding(snd('dex_new'), 0.35)
    const el = root.querySelector('.dxtoast')
    el?.addEventListener('animationend', (e) => { if (e.target === el) el.remove() }) // 얼굴 뒤 금빛이 먼저 끝나도 알림은 그대로
    // 애니메이션이 안 끝나는 일(멈춘 탭·움직임 줄이기)이 있어도 알림은 반드시 걷힌다 (형 10-24: "알림은 잘 없어지는 것도 빠지지 않고")
    window.setTimeout(() => el?.remove(), DEX_TOAST_MAX_MS)
  }

  /**
   * 맡긴 일을 마치고 돌아온 장수 — 원정에서 · 먼 길 끝 · 다 나음 · 풀려남 · 사신 길 · 밤일 (형 10-24: "장수가 맡긴 일 끝내면 어딘가 알람 · 누구누구가 어디에서 돌아왔다")
   * 계절 앞뒤의 판을 견주어 찾는다 — 엔진은 그대로
   */
  function backNotes(prev: Realm, next: Realm, mine: readonly Order[]): Array<{ id: string; text: string }> {
    const out: Array<{ id: string; text: string }> = []
    const ok = (id: string): boolean => next.heroes[id]?.faction === me() && next.heroes[id]?.status === 'free'
    const add = (id: string, text: string): void => { if (ok(id) && !out.some((o) => o.id === id)) out.push({ id, text }) }
    for (const ex of prev.expeditions ?? []) {
      if (ex.faction === me() && !(next.expeditions ?? []).some((x) => x.hero === ex.hero)) add(ex.hero, `${DESTS[ex.dest]?.name ?? '원정'}에서 돌아왔다`)
    }
    for (const h of Object.values(prev.heroes)) {
      const n = next.heroes[h.id]
      if (n === undefined) continue
      if (h.status === 'captive' && h.captor !== me() && n.status === 'free' && n.faction === me()) add(h.id, '사로잡혔다가 풀려 돌아왔다')
      if (h.faction !== me() || h.status !== 'free') continue
      if (h.awayUntil !== undefined && h.awayUntil >= prev.season && !(n.awayUntil !== undefined && n.awayUntil >= next.season)) {
        const at = n.at ?? Object.values(next.armies).find((a) => a.hero === h.id)?.at ?? null
        add(h.id, at !== null ? `${next.nodes[at]?.name ?? ''}에 닿았다` : '먼 길을 마쳤다')
      }
      if (h.woundedUntil !== undefined && h.woundedUntil > prev.season && !(n.woundedUntil !== undefined && n.woundedUntil > next.season)) add(h.id, '다 나아 털고 일어났다')
    }
    for (const o of mine) {
      if (o.kind === 'envoy' && o.hero !== undefined) add(o.hero, `${next.factions[o.to]?.name ?? ''}에서 사신 길을 마치고 돌아왔다`)
      if (o.kind === 'plot' && o.agent !== undefined) add(o.agent, '밤일을 마치고 무사히 돌아왔다')
    }
    return out
  }

  /** 돌아온 장수 알림 — 화면 위 왼쪽에 얼굴과 한 줄씩 · 누르면 그 장수 판 · 큰 장면이 떠 있는 동안엔 기다렸다 사라진다 */
  function backToast(items: ReadonlyArray<{ id: string; text: string }>): void {
    root.querySelector('.bktoast')?.remove()
    if (items.length === 0 || realm === null) return
    const r = realm
    const rows = items.slice(0, 5).map((it) => `<button class="bkrow" data-act="hero" data-id="${it.id}">${bust(r.heroes[it.id], 'bkf')}<span><b>${esc(r.heroes[it.id]?.name ?? '')}</b> ${esc(it.text)}</span></button>`).join('')
    const more = items.length > 5 ? `<span class="bkmore">그 밖에 ${items.length - 5}명</span>` : ''
    root.insertAdjacentHTML('beforeend', `<div class="bktoast"><span class="bkhd">${icon('unit-scouts', 'bkic')}돌아왔다</span>${rows}${more}</div>`)
    const el = root.querySelector<HTMLElement>('.bktoast')!
    // 알림은 반드시 사라진다 (형 10-24: "사신 돌아왔다가 안 없어지고 남아 있다 · 알림 만들면 잘 없어지는 것도 빠지지 않고")
    //  - 큰 장면이 떠 있는 동안은 세지 않되, 정한 시간의 세 배가 지나면 무조건 걷는다 (장면이 걸려 있어도)
    //  - 시간 값이 숫자가 아니면(10-24 의 {} 사고) 바로 걷는다 · 머리를 누르면 바로 걷는다
    const LIFE = P.realm.backToastMs
    let left = LIFE
    const born = performance.now()
    const gone = (): void => { if (!el.isConnected || el.classList.contains('out')) return; el.classList.add('out'); window.setTimeout(() => el.remove(), 400) }
    el.querySelector('.bkhd')?.addEventListener('click', gone)
    const tick = (): void => {
      if (!el.isConnected) return
      if (root.querySelector('.cere') === null) left -= 400
      if (!(left > 0) || performance.now() - born > LIFE * 3) { gone(); return }
      window.setTimeout(tick, 400)
    }
    window.setTimeout(tick, 400)
  }

  /** 계절을 넘긴다 — 우리 명령(전장의 명령 줄 포함) + AI 명령. 막히면 까닭을 띄운다 */
  function endSeason(prev: Realm, mine: Order[], ai: Order[]): void {
    const all = [...mine, ...ai]
    let res: ReturnType<typeof advance>
    try {
      res = advance(prev, all)
    } catch (e) {
      // 넘기다 막히면 말없이 멈추지 않는다 (형: "지금 하는게임 다음계절로 안넘어가짐") — 까닭을 띄우고 기록에 남긴다
      failNote(e)
      return
    }
    resetTurn()
    sheet = null
    before = prev
    report = res.report
    showReport = true
    realm = res.next
    fresh = new Set(knownOf(res.next, me()).filter((f) => !knows(prev, me(), f)))
    // 계속 둔 판 — 도읍을 모두 쥐면 한 번 더 끝 화면 (하나가 됐다)
    if (res.next.endless === true && res.next.unified === undefined && Object.values(res.next.factions).every((f) => res.next.nodes[f.capital]?.owner === me())) res.next.unified = res.report.season
    // 판을 이기면 다음 판이 열린다 (unlock.ts)
    if (res.next.outcome?.kind === 'win' && prev.outcome == null) markWon(res.next.region ?? 'byeonhan-mini', res.next.tier ?? 1, me())
    host.onAdvance(res.next, res.report, all, mine)
    dexToast(recordDex(res.next))
    engraveNow(res.next) // 판이 끝났다 — 이기든 지든 장수마다 공을 판 밖 단련 공으로 (drill.ts)
    backToast(backNotes(prev, res.next, mine))
    nearWinToast(prev, res.next)
    seasonFx(res.next.season)
    noteFaces(res.next) // 갓 난 아이 얼굴 — 보고·장면·장수 판 어디서나 (형 10-23: "하늬도 이미지가 없어 보이네 애기 태어날 때")
    ceremonyFx(prev, res.next, res.report)
    // 우리가 낀 싸움이면 북, 아니면 이 계절 머리 장면의 소리 (혼인·아이·동맹…) — 종이 잦아든 뒤
    const ourWar = res.report.lines.some((l) => l.kind === 'battle' && (l.atkFaction === me() || l.defender === me()))
    const ev = /event\/([\w-]+)\.jpg/.exec(sceneOf(prev, res.next, res.report))?.[1]
    const cue = ourWar ? 'war_drums' : ev !== undefined ? SCENE_SOUND[ev] : undefined
    if (cue !== undefined) window.setTimeout(() => { if (document.visibilityState === 'visible') ding(snd(cue), 0.4) }, SCENE_CUE_MS)
    paint()
  }

  // ───────── 폰 뒤로가기 — 웹 페이지 뒤로가 아니라 열린 창부터 닫는다 (형 2026-10-20: "뒤로가기 누르면 … 그냥 웹페이지 뒤로가버리는데")
  // 지킴 칸 하나를 쌓아 두고, 뒤로가기가 그 칸을 걷으면(popstate) 한 겹 닫고 다시 쌓는다. 처음 화면에서 누르면 그때 페이지를 떠난다.
  /** 한 겹 닫는다 — 닫은 게 있으면 true */
  function backOne(): boolean {
    if (root.classList.contains('war-open') || root.querySelector('.wr') !== null) return true // 싸움 중엔 닫지 않는다 (싸움은 끝까지)
    const fail = root.querySelector('.failbox')
    if (fail !== null) { fail.remove(); return true }
    if (front !== null) {
      if (front.kind === 'dex') {
        if (front.sel !== null) front = { ...front, sel: null }
        else front = front.back
      } else if (front.kind === 'drill') { yardLeave(); return true }
      else if (front.kind === 'tomb') { front = null; fastNext = true }
      else if (front.kind === 'detail') front = { kind: 'nations', region: front.region }
      else if (front.kind === 'nations') front = { kind: 'boards' }
      else if (front.kind === 'boards') front = { kind: 'title' }
      else return false // 처음 화면 — 떠난다
      paint()
      return true
    }
    if (prologue !== null) return true
    if (showReport && root.classList.contains('modal-open')) showReport = false
    else if (layersOpen) layersOpen = false
    else if (roadOpen) roadOpen = false
    else if (sheet !== null) sheet = null
    else if (leadPop !== '' && armySel.includes(leadPop)) leadPop = ''
    else if (armySel.length > 0) armySel = []
    else if (partySel !== '') clearParty()
    else front = { kind: 'title' } // 아무것도 안 열려 있으면 처음 화면으로
    paint()
    return true
  }
  try {
    history.replaceState({ realmBase: true }, '')
    history.pushState({ realmGuard: true }, '')
  } catch { /* 막힌 곳 */ }
  addEventListener('popstate', () => {
    if (backOne()) {
      try { history.pushState({ realmGuard: true }, '') } catch { /* 막힌 곳 */ }
    } else history.back()
  })

  /** 군대를 보냈다 — 군사가 발맞춰 떠나는 소리 (형 10-23: "출정 보내기 완료될 때는 뭔가 군대를 부리는 소리가 필요함") */
  const marchSfx = (): void => { if (document.visibilityState === 'visible') ding(snd('march_go'), 0.4) }
  /** 군사를 뽑았다 · 쇠로 무장시켰다 (형 10-23: "군사 보내는 거랑 철로 무장시키는 거 그거도 sfx 필요해") — 고르기 판에서 고르기 전까지는 북·방패 쇠 소리 */
  const draftSfx = (): void => { if (document.visibilityState === 'visible') ding(snd('draft_go'), 0.4) }
  const armSfx = (): void => { if (document.visibilityState === 'visible') ding(snd('arm_go'), 0.4) }

  /**
   * 판에 들어갈 때 가림막 — 지도가 쓰는 그림(조각·고을·안개·한지)을 다 받을 때까지. 막대는 받은 만큼 찬다.
   * 이미 받아 둔 그림은 곧바로 끝나고(캐시), 아무리 늦어도 COVER_MAX_MS 에 걷힌다
   */
  const COVER_MAX_MS = 8000
  function coverMap(): void {
    if (root.querySelector('.loadcov') !== null) return
    const cov = document.createElement('div')
    cov.className = 'loadcov'
    cov.innerHTML = `<img src="${ART}logo/emblem.png" alt=""><div class="lbar go"><i></i></div>`
    root.appendChild(cov)
    const fill = cov.querySelector<HTMLElement>('.lbar i')!
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const urls = new Set<string>()
      const wrap = root.querySelector('.mapwrap')
      if (wrap !== null) {
        for (const i of wrap.querySelectorAll('img')) if (i.src !== '') urls.add(i.src)
        for (const i of wrap.querySelectorAll('image')) { const u = i.getAttribute('href'); if (u) urls.add(u) }
        for (const e of [wrap as HTMLElement, ...wrap.querySelectorAll<HTMLElement>('[style*="url("]')]) {
          for (const m of e.style.backgroundImage.matchAll(/url\(["']?([^"')]+)["']?\)/g)) urls.add(m[1]!)
        }
      }
      const all = [...urls]
      let n = 0
      const t0 = performance.now()
      const step = (): void => { n++; fill.style.width = `${Math.round(8 + (92 * n) / Math.max(1, all.length))}%` }
      fill.style.width = '8%'
      const load = all.map((u) => new Promise<void>((ok) => { const i = new Image(); i.onload = i.onerror = () => { step(); ok() }; i.src = u }))
      const late = new Promise<void>((ok) => setTimeout(ok, COVER_MAX_MS))
      void Promise.race([Promise.all(load), late]).then(() => {
        fill.style.width = '100%'
        // 너무 빨리 걷히면 번쩍이므로 잠깐은 보인다
        setTimeout(() => { cov.classList.add('out'); cov.addEventListener('transitionend', () => cov.remove(), { once: true }) }, Math.max(250, 600 - (performance.now() - t0)))
      })
    }))
  }

  // ───────── 손짓 — 한 곳에서 받는다
  // 전체 화면 — 처음 손이 닿는 그 순간에 (형 10-23: "게임 시작하자마자 되어야 하는 거 아님?").
  // 브라우저는 손짓 없이는 못 켜게 막는다 — 첫 화면·불러오는 화면을 포함해 어디든 처음 누르면 켠다 (손을 뗄 때가 브라우저가 허락하는 때)
  root.addEventListener('click', (ev) => {
    // 길 보기는 지도를 누르면 접힌다 — ✕ 를 찾지 않아도 (형 10-27)
    if (roadOpen && (ev.target as HTMLElement).closest('.mapwrap') !== null && !zoom.dragged()) { roadOpen = false; morph($('.roadkey'), roadKeyHtml()) }
    const t = (ev.target as HTMLElement).closest<HTMLElement>('[data-act], .nd')
    if (t === null || !root.contains(t)) return
    if (zoom.dragged() && t.closest('.mapwrap') !== null) return // 지도를 끌다 놓은 것 — 누르기가 아니다
    if (t.dataset['act'] === 'bk-fast' || t.dataset['act'] === 'rep-fast') {
      $('.modal').classList.add('fast') // 보고판을 한 번 누르면 끝까지 바로 — 다시 그리지 않는다
      return
    }
    if (t.dataset['act'] === 'film-prev' || t.dataset['act'] === 'film-next') {
      filmStep(t.dataset['act'] === 'film-next' ? 1 : -1) // 끝 화면 — 지나간 장면을 하나씩 (다시 그리지 않는다)
      return
    }
    if (t.dataset['act'] === 'zin' || t.dataset['act'] === 'zout') {
      zoom.step(t.dataset['act'] === 'zin' ? 1 : -1)
      return
    }
    if (t.classList.contains('nd') && !t.dataset['act']) {
      // 군대를 고른 채(집을 보내는 중에) 갈 수 없는 곳을 누르면 고르기만 푼다
      // 배우는 판에서는 풀고 그 고을도 연다 — 개척단을 보낸 뒤(3/12) 개척단이 골라진 채라 4/12 「갯골 마을 누르기」의 첫 누름이 먹히기만 했다 (형 10-25)
      if (armySel.length > 0 || partySel !== '') {
        armySel = []
        clearParty()
        if (realm?.region !== 'tutorial') { paint(); return }
      }
      host.onTap('node', t.dataset['node']!)
      const tap = tapSlot('node')
      if (tap !== null) ding(snd(tap), 0.2)
      openSheet({ kind: 'node', id: t.dataset['node']! })
      return
    }
    const d = t.dataset
    host.onTap(d['act'] ?? '', d['tab'] ?? d['node'] ?? d['army'] ?? d['to'] ?? d['id'] ?? d['unit'] ?? '')
    if (realm?.region === 'tutorial') loadTut() // 이 판의 배우기 기록을 먼저 (다시 연 뒤 첫 누름이 기록을 덮지 않게)
    if (realm?.region === 'tutorial' && d['act'] !== undefined && !tut.acts.has(d['act'])) {
      tut.acts.add(d['act'])
      saveTut()
      if (front === null) paintTut(plan()) // 다시 그리지 않는 단추(우리 땅 등)에도 띠가 넘어가게
    }
    // 누른 것이 먹었다는 작은 소리 — 누른 것의 바탕대로 (책장은 종이 · 군사는 쇠 · 교역은 엽전 …)
    const tap = d['act'] !== undefined && d['act'] !== 'next' ? tapSlot(d['act']) : null
    if (tap !== null) ding(snd(tap), 0.2)
    freshArmy = ''
    const r = realm !== null ? plan() : null
    switch (d['act']) {
      case 'continue': front = null; paint(); coverMap(); return
      case 'annals-open': front = { kind: 'annals' }; paint(); return
      case 'slot-go': {
        // 고른 판으로 — 하던 판은 선반에 (realm-main.onResume). 옮겼으면 바로 그 판으로 들어간다
        slotArmed = null
        saveBox = null
        savePaint()
        if (host.onResume?.(Number(d['v'])) !== true) { paint(); return }
        front = null
        paint()
        coverMap()
        return
      }
      case 'save-open': case 'save-open-title':
        if (host.saves === undefined) return
        saveDraft()
        saveBox = { mode: d['act'] === 'save-open' && realm !== null ? 'game' : 'title', name: '', ask: null, msg: null }
        savePaint()
        return
      case 'sv-x': saveBox = null; savePaint(); return
      case 'sv-no': if (saveBox !== null) { saveBox.ask = null; savePaint() } return
      case 'sv-save': case 'sv-load': case 'sv-drop': {
        if (saveBox === null || host.saves === undefined) return
        const n = Number(d['n'])
        const filled = host.saves.list()[n] != null
        const act = d['act'] === 'sv-load' ? 'load' : d['act'] === 'sv-drop' ? 'drop' : 'over'
        if (act === 'over' && !filled) { saveDo(n, 'save'); return } // 빈 칸 — 묻지 않고 저장
        saveBox.ask = { n, act }
        saveBox.msg = null
        savePaint()
        return
      }
      case 'sv-yes': { const a = saveBox?.ask; if (a == null) return; saveDo(a.n, a.act); return }
      case 'sv-down': {
        if (saveBox === null || host.saves === undefined) return
        saveDraft()
        const why = host.saves.download(saveBox.name)
        saveSay(why ?? '파일을 내려받았습니다. 브라우저의 다운로드 폴더에 있습니다', why !== null)
        return
      }
      case 'sv-file': root.querySelector<HTMLInputElement>('.saveov .svpick')?.click(); return
      case 'slot-drop': {
        const seed = Number(d['v'])
        if (slotArmed !== seed) { slotArmed = seed; paint(); savePaint(); return }
        slotArmed = null
        host.onDropSlot?.(seed)
        paint()
        savePaint()
        return
      }
      case 'fr-new': case 'newgame': front = { kind: 'boards' }; sheet = null; looking = false; paint(); return
      case 'fr-back': front = { kind: 'title' }; paint(); return
      case 'lobby': saveDraft(); front = { kind: 'title' }; sheet = null; armySel = []; clearParty(); paint(); return
      case 'fr-board':
        // 캠페인의 장은 나라를 고르지 않는다 — 배우는 판은 백제(온조), 2장은 고구려(주몽)
        { const ch = chapterOfRegion(d['v'] as RegionId); if (ch !== undefined) { startWithBring(ch.nation, d['v'] as RegionId, d['v'] === 'tutorial' ? 1 : chapTier); return } }
        front = { kind: 'nations', region: d['v'] as RegionId }; $('.mapwrap').scrollTop = 0; paint(); return
      case 'fr-tutorial': host.onNewGame('baekje', 'tutorial'); return
      case 'fr-locked': return
      case 'tut-end': markTutorialOver('done'); front = { kind: 'title' }; paint(); return
      case 'tut-skip': {
        // 이 단계를 건너뛴다 — 다음 단계부터 (마지막이면 끝)
        if (realm === null) return
        loadTut()
        tut.i = tutAt(tut.i, { r: plan(), orders: ordersNow(), report, acts: tut.acts }) + 1
        saveTut()
        if (tut.i >= TUT_STEPS.length) markTutorialOver('done')
        paint()
        return
      }
      case 'fr-nation': if (front !== null && front.kind === 'nations') front = { kind: 'detail', region: front.region, id: d['id']! }; $('.mapwrap').scrollTop = 0; paint(); return
      case 'fr-start': if (front !== null && front.kind === 'detail') startWithBring(d['id']!, front.region, Math.min(tierPick[front.region] ?? 1, tierOpen(front.region))); return
      case 'bring-go': { const b = bringAsk; bringAsk = null; root.querySelector('.bringov')?.remove(); if (b !== null) host.onNewGame(b.nation, b.region, b.tier); return }
      case 'bring-none': { const b = bringAsk; bringAsk = null; root.querySelector('.bringov')?.remove(); clearBring(); if (b !== null) host.onNewGame(b.nation, b.region, b.tier); return }
      case 'bring-x': bringAsk = null; root.querySelector('.bringov')?.remove(); return
      case 'fr-again': if (realm !== null) { const rg = realm.region ?? 'byeonhan-mini'; host.onNewGame(realm.player, rg, Math.min(realm.tier ?? 1, tierOpen(rg))) } return
      case 'tier-pick': if (front !== null && front.kind === 'detail') tierPick[front.region] = Number(d['v']); paint(); return
      case 'chap-tier': chapTier = Number(d['v']); paint(); return
      case 'goal-fold': try { localStorage.setItem(GOAL_FOLD_KEY, goalFolded() ? '0' : '1') } catch { /* 저장 못 하는 곳 */ } paint(); return
      case 'fr-look': looking = true; paint(); return
      case 'bring': toggleBring(d['id']!, Number(d['max'] ?? 0)); if (bringAsk !== null) bringPopup(); else paint(); return
      case 'wed': {
        const a = d['id']!
        const b = d['with']!
        heroOrders = [...heroOrders.filter((o) => !(o.kind === 'wed' && (o.a === a || o.b === a || o.a === b || o.b === b))), { kind: 'wed', faction: me(), a, b }]
        break
      }
      case 'exp-dest': expPick[d['id']!] = { dest: d['v'] as ExpDest, len: expPick[d['id']!]?.len ?? 1 }; break
      case 'exp-len': expPick[d['id']!] = { dest: expPick[d['id']!]?.dest ?? 'wa', len: Number(d['v']) as 0 | 1 | 2 }; break
      case 'exp-go': {
        const pk = expPickOf(plan(), d['id']!) // 화면이 보여 준 그 땅·길이로
        heroOrders = [...heroOrders.filter((o) => !(o.kind === 'expedition' && o.hero === d['id'])), { kind: 'expedition', faction: me(), hero: d['id']!, dest: pk.dest, len: pk.len }]
        obey(d['id'])
        break
      }
      case 'unexp': heroOrders = heroOrders.filter((o) => !(o.kind === 'expedition' && o.hero === d['id'])); break
      case 'card-pick': if (realm?.card) { const s = realm.card.season; answers[`card:${s}`] = d['v'] === '0'; if (d['v'] === '2') answers[`hush:${s}`] = true; else delete answers[`hush:${s}`]; fastNext = true } break
      case 'card-beat': if (realm?.card) { const k = `card:${realm.card.season}`; cardBeat[k] = (cardBeat[k] ?? 0) + 1 } break
      case 'card-skip': if (realm?.card) cardBeat[`card:${realm.card.season}`] = 99; break
      case 'practice-open': openPractice(); break
      case 'spar-open': fmoreOpen = false; openSpar(); return
      case 'contest': openContest(); break
      case 'unwed': heroOrders = heroOrders.filter((o) => !(o.kind === 'wed' && (o.a === d['id'] || o.b === d['id']))); break
      case 'dex-open': root.querySelector('.dxtoast')?.remove(); front = { kind: 'dex', board: 'all', sel: null, back: front }; sheet = null; paint(); return
      // 단련터 — 끝 화면에서 · 첫 화면에서 (HERO-GROWTH ★ §C)
      case 'dy-open': if (realm !== null) { engraveNow(realm); front = yardFromEnd(realm); sheet = null; $('.mapwrap').scrollTop = 0 } paint(); return
      case 'dy-title': front = { kind: 'drill', from: 'title', ids: null, gain: {}, fell: [], anim: true, last: null }; sheet = null; paint(); return
      case 'dy-next': yardLeave(); return
      case 'dy-up': {
        if (front === null || front.kind !== 'drill') return
        const id = d['id']!
        const s = d['s'] as 'mu' | 'tong' | 'ryak' | 'chi' | 'deok'
        if (raiseHero(id, s, drillBody(id))) {
          ding(snd('tap_coin'), 0.5)
          front = { ...front, anim: false, last: `${id}:${s}`, gain: {} }
        }
        paint()
        return
      }
      // 옛 무덤 — 이긴 판의 상자 셋에서 하나 (relics.ts · HERO-GROWTH ★ §B)
      case 'tomb-open': if (tombRun(realm)) { openRunTomb(realm); front = { kind: 'tomb', fresh: false }; sheet = null; $('.mapwrap').scrollTop = 0 } paint(); return
      case 'tomb-pick': {
        if (!tombRun(realm) || tombShaking) return
        const id = d['id']!
        const seen = (): boolean => document.visibilityState === 'visible'
        // 터진다 — 고른 것을 적고 화면을 덮는 큰 열림으로 (relics.revealHtml). 소리는 귀함에 따라 커진다
        const burst = (): void => {
          tombShaking = false
          if (realm === null || !tombRun(realm) || !pickRunRelic(realm, id)) { paint(); return }
          ding(snd('relic_open'), 0.7) // 상자가 터지는 팡파레 (형 10-27)
          const tier = RELIC[id]?.tier ?? 'common'
          window.setTimeout(() => {
            if (!seen()) return
            if (tier === 'legend') { ding(snd('horn_victory'), 0.6); ding(snd('war_bell'), 0.45) }
            else if (tier === 'rare') ding(snd('war_bell'), 0.5)
            else ding(snd('coins'), 0.5)
          }, 380)
          front = { kind: 'tomb', fresh: true }
          paint()
        }
        const ms = P.realm.relicShakeMs
        const row = t.closest('.tbrow')
        if (ms <= 0 || !seen() || row === null) { burst(); return }
        // 떨린다 — 고른 상자가 북소리에 맞춰 부풀고, 다른 둘은 물러난다 (형: "유저가 퍽 하면 게임은 으아아아")
        tombShaking = true
        row.classList.add('shaking')
        ;(row as HTMLElement).style.setProperty('--ms', `${ms}ms`)
        t.classList.add('go')
        for (const at of [0, 0.38, 0.7]) window.setTimeout(() => { if (seen()) ding(snd(at < 0.6 ? 'tap_drum' : 'war_drum'), 0.55) }, at * ms)
        window.setTimeout(burst, ms)
        return
      }
      case 'tomb-seen': front = { kind: 'tomb', fresh: false }; paint(); return
      case 'tomb-back': front = null; fastNext = true; paint(); return
      // 단련터의 유물 칸 — 누르면 고르기가 펼쳐지고, 고르면 끼운다 (다른 장수가 지녔으면 옮긴다)
      case 'rl-slot': {
        if (front === null || front.kind !== 'drill') return
        const id = d['id']!
        const i = Number(d['i'] ?? 0)
        front = { ...front, anim: false, gain: {}, last: null, slot: front.slot?.id === id && front.slot.i === i ? null : { id, i } }
        paint()
        return
      }
      case 'rl-put': {
        if (front === null || front.kind !== 'drill') return
        if (putRelic(d['id']!, Number(d['i'] ?? 0), d['r']!, loadDrill().h[d['id']!]?.level ?? 0)) ding(snd('tap_coin'), 0.5)
        front = { ...front, anim: false, gain: {}, last: null, slot: null }
        paint()
        return
      }
      case 'rl-off': {
        if (front === null || front.kind !== 'drill') return
        takeOffRelic(d['id']!, Number(d['i'] ?? 0))
        front = { ...front, anim: false, gain: {}, last: null, slot: null }
        paint()
        return
      }
      case 'rl-close': if (front !== null && front.kind === 'drill') front = { ...front, anim: false, gain: {}, slot: null }; paint(); return
      case 'dex-close': if (front !== null && front.kind === 'dex') front = front.back; paint(); return
      case 'dex-board': if (front !== null && front.kind === 'dex') { front = { ...front, board: d['v'] as DexBoard, sel: null }; root.querySelector('.front.dexp')?.scrollTo(0, 0) } paint(); return
      case 'dex-sel': if (front !== null && front.kind === 'dex') front = { ...front, sel: d['id'] === undefined || d['id'] === front.sel ? null : d['id'] }; paint(); return
      case 'fr-endless': if (realm !== null) { realm.endless = true; looking = false; showReport = false } paint(); return
      case 'pl-next': case 'pl-skip': {
        if (prologue === null) return
        if (d['act'] === 'pl-next' && prologue < PROLOGUE_STEPS - 1) { prologue++; paint(); return }
        // 서막이 걷히고 지도가 열린다 — 한지가 걷히며 본 땅이 번진다
        prologue = null
        root.querySelector('.prologue')?.classList.add('out')
        root.classList.add('opening')
        // 서막이 사라진 뒤 한 번 — 첫 계절을 알린다. 지도는 다시 그릴 때마다 새로 생기니 animationend 대신 한 번 거둔다
        setTimeout(() => { $('.plbox').innerHTML = ''; $('.plbox').dataset['html'] = ''; if (realm !== null) { seasonFx(realm.season); paintTut(plan()) } }, 900)
        setTimeout(() => root.classList.remove('opening'), 3000)
        return
      }
      case 'close': sheet = null; paint(); return
      case 'tab': {
        if (d['tab'] === 'heroes' && realm !== null) {
          cmdJob = null
          // 빨간 점이 켜진 까닭이 있는 칸으로 (형 10-25: 떠돌이가 와서 불은 켜졌는데 명령 칸이 열려 안 보였다)
          const fresh = dotKeys(plan(), 'heroes').filter((k) => !seenKeys.has(k))
          if (fresh.some((k) => k.startsWith('w:'))) heroTab = 'mine'
          else if (fresh.some((k) => k.startsWith('c:'))) heroTab = 'jail'
        }
        markSeen(d['tab']!); openSheet({ kind: d['tab'] as 'army' }); return
      }
      case 'help': openSheet({ kind: 'help' }); return
      case 'export': host.onExport(); return
      case 'fmore-x': fmoreOpen = false; root.querySelector<HTMLDetailsElement>('.fmore')?.removeAttribute('open'); return
      case 'b0-toggle': fmoreOpen = true; try { localStorage.setItem(B0_KEY, b0On() ? '0' : '1') } catch { /* 저장이 막히면 못 켠다 */ } paint(); return
      case 'acct-in': host.cloud?.signIn(); return
      case 'acct-out': host.cloud?.signOut(); acctArmed = false; paint(); return
      case 'acct-sync': host.cloud?.syncNow(); return
      case 'acct-pick': host.cloud?.choose(d['v'] === 'there' ? 'there' : 'here'); return
      case 'inst-ok': {
        const hide = root.querySelector<HTMLInputElement>('.instc .insthide')?.checked === true
        if (hide) { try { localStorage.setItem(INSTALL_HIDE_KEY, '1') } catch { /* 저장 못 하는 곳 */ } }
        instClosed = true
        // 알림만 걷는다 — 다시 그리면 첫 화면의 로고·단추가 처음부터 다시 떠올랐다 (형 10-28)
        root.querySelector('.instc')?.remove()
        return
      }
      case 'inst-show': { try { localStorage.removeItem(INSTALL_HIDE_KEY) } catch { /* 저장 못 하는 곳 */ } instClosed = false; fmoreOpen = false; break }
      case 'reset-play':
        if (!resetArmed) { resetArmed = true; paint(); return }
        resetArmed = false
        void host.resetPlay?.().then((ok) => { if (!ok) { failNote(new Error('기록을 못 지웠다. 잠시 뒤 다시 (서버에 닿지 않았다면 이 기기 것도 그대로 두었다)')); paint() } })
        return
      case 'acct-del':
        if (!acctArmed) { acctArmed = true; paint(); return }
        acctArmed = false
        void host.cloud?.remove().then((r) => {
          if (r === 'relogin') failNote(new Error('서버의 판·기록은 지웠다. 계정까지 지우려면 「구글 로그인」으로 다시 로그인해 「계정 삭제」를 한 번 더 누른다'))
          else if (r === 'error') failNote(new Error('계정을 못 지웠다. 잠시 뒤 다시'))
          paint()
        })
        return
      case 'failclose': root.querySelector('.failbox')?.remove(); return
      case 'install': {
        const p = installPrompt()
        if (p !== null) void p.prompt().catch(() => { /* 막힌 곳 */ }).finally(() => { delete (window as unknown as { __bip?: InstallPrompt }).__bip; paint() })
        break
      }
      case 'mute': try { localStorage.setItem(MUTE_KEY, muted() ? '0' : '1') } catch { /* 저장 못 하는 곳 */ } music.refresh(); break
      case 'focus': focus = focus === d['id'] ? null : d['id']!; break
      case 'rep-close': showReport = false; paint(); return
      case 'strat-x': {
        // 그만둔다 — 지도에서 고른 출정을 거둔다 · 그대로 간다(「다음 계절」 앞) — 고른 길 그대로 계절을 넘긴다
        const st = stratOpen
        stratOpen = null
        if (st !== null && realm !== null) { councilDone.set(st.army, realm.season); councilAt = realm.season }
        openArmy = ''
        if (st === null) break
        if (d['v'] === 'keep') { paint(); root.querySelector<HTMLElement>('[data-act="next"]')?.click(); return }
        delete pick[st.army]
        break
      }
      case 'next': {
        if (realm === null || (realm.outcome && !realm.endless)) return
        // 문명의 "명령을 기다리는 유닛" — 쉬는 장수가 있거나 정찰을 안 보냈으면 한 번은 그 판으로 데려간다. 한 번 더 누르면 그냥 넘긴다
        if (nudgedAt !== realm.season && realm.region !== 'tutorial') {
          // 장수 탭이 아직 안 열렸으면 쉬는 장수로 붙잡지 않는다 · 재상이 맡을 장수로도 붙잡지 않는다 (직접 부리는 장수만)
          const idle = tabWait(realm, 'heroes') > 0 ? [] : waitingHeroes(plan())
          const noScout = scout === ''
          if (idle.length > 0 || noScout) {
            nudgedAt = realm.season
            openSheet(idle.length > 0 ? { kind: 'heroes' } : { kind: 'scout' })
            return
          }
        }
        // 출정 전 군막 — 이번 계절 적 고을로 드는 군대가 있고 아직 장수와 길을 정하지 않았으면 한 번 연다 (계절에 하나)
        if (councilAt !== realm.season && realm.region !== 'tutorial') {
          const due = councilDue(plan())
          if (due !== null) {
            councilAt = realm.season
            const ar = plan().armies[due.army]
            if (ar !== undefined) {
              openSortie(ar)
              sortieD.edge = due.edge
              stratOpen = { army: due.army, next: true, ...(due.goal !== undefined ? { goal: due.goal } : {}) }
              paint()
              return
            }
          }
        }
        // 재상의 일은 우리 명령 뒤에 — 같은 장수에게 군주가 고른 일이 먼저다 (oneJobPerHero)
        const orders = [...ordersNow(), ...chancellorOrders()]
        const ai = aiOrders(realm)
        const prev = realm
        fastNext = false
        // 우리가 낄 싸움이 있으면 전장이 먼저 열린다 — 합마다 직접 지휘하고, 그 명령으로 넘긴다 (battlefield.ts)
        const finish = (tactics: Record<string, Tactic>): void => {
          warOn = false
          const cmds: Order[] = Object.entries(tactics).map(([key, t]) => ({ kind: 'command', key, cmds: t.cmds, ...(t.dusk !== undefined && t.dusk.length > 0 ? { dusk: t.dusk } : {}) }))
          endSeason(prev, [...orders, ...cmds], ai)
        }
        const startWar = (): void => {
          try {
            if (openWar(root, prev, [...orders, ...ai], { art: ART, me: me(), ding, music: (k) => { if (k === 'war') music.war(); else music.result(k) }, done: finish })) { warOn = true; music.war(); music.primeResults(); return }
          } catch (e) {
            failNote(e)
            return
          }
          endSeason(prev, orders, ai)
        }
        // 쳐들어왔으면 곧장 전장이 아니라 먼저 「어디에 누가 쳐들어왔다」 — 확인을 눌러야 싸움 (형 10-24)
        let inv: BattleLine | null = null
        try { const t = rehearse(prev, [...orders, ...ai], {}, null, me()).line; if (t !== null && t.defender === me() && t.atkFaction !== undefined && t.atkFaction !== me()) inv = t } catch { inv = null }
        if (inv !== null) { invasionSplash(prev, inv, startWar); return }
        startWar()
        return
      }
      case 'open':
        if (openArmy === d['army']) openArmy = ''
        else { const a = r?.armies[d['army']!]; if (a !== undefined) openSortie(a) }
        break
      case 'tok': {
        if (!tokTapped) { tokTapped = true; try { localStorage.setItem(TOK_KEY, '1') } catch { /* 이번 판만 */ } }
        // 같은 고을에 머무는 말을 더 누르면 함께 골라진다. 다른 고을·길 위의 말이면 그것만
        const id = d['army']!
        const x = r?.armies[id]
        const sameNode = (y: string): boolean => r?.armies[y]?.at === x?.at && r?.armies[y]?.march === null && r?.armies[y]?.faction === me()
        // 고른 군대가 있는데 갈 수 있는 다른 고을에 선 말(우리 · 동맹 · 적)을 누르면 그 고을로 보낸다 — 말이 고을을 가려 「옮기기」가 안 먹었다 (형 10-29: "내 군대를 다른 내 고을로 옮기는 게 안 돼 · 탭탭으로")
        if (x !== undefined && x.march === null && armySel.length > 0 && !armySel.includes(id) && !armySel.every(sameNode)) {
          const go = root.querySelector<HTMLElement>(`.nd[data-act="go"][data-node="${x.at}"]`)
          if (go !== null) { go.click(); return }
        }
        clearParty() // 군대를 고르면 개척단 고르기는 풀린다 — 둘은 함께 켜지지 않는다
        leadPop = ''
        if (armySel.includes(id)) armySel = armySel.filter((y) => y !== id)
        else if (x !== undefined && x.faction !== me()) armySel = [id] // 동맹 군대 — 보기만
        else if (x !== undefined && x.march === null && armySel.length > 0 && armySel.every(sameNode)) armySel = [...armySel, id]
        else armySel = [id]
        // 우리 장수가 이끄는 군대를 고르면 그 장수가 곧바로 대답한다 (RTS 의 대답처럼 · voice.ts)
        const hh = x !== undefined && x.faction === me() && x.hero !== null && armySel.includes(id) ? r?.heroes[x.hero] : undefined
        if (hh !== undefined && hh.status === 'free' && !isRuler(r!, hh.id) && voiceGate(performance.now())) ding(voicePath(hh, 'tap', false), 0.9)
        break
      }
      case 'selclose': armySel = []; leadPop = ''; break
      // 아래 띠의 장수 얼굴 — 이끌 장수 고르기를 열고 닫는다 · 고르면 군대는 골라진 채로 남고 새 장수가 대답한다 (형 10-26)
      case 'ldpop': leadPop = leadPop === d['army'] ? '' : d['army']!; break
      case 'ldpick': {
        const id = d['id'] ?? ''
        pickLeader(d['army']!, id)
        leadPop = ''
        obey(id) // 고르면 곧 이끈다 — 확정이라 분부를 받든다 (형 10-27)
        break
      }
      // 개척단 — 꾸리면 판이 닫히고 그 개척단이 골라진다 (지도에서 갈 곳이 빛난다)
      case 'party': {
        const node = d['node']!
        // 맞닿은 빈땅이 있으면 가장 가까운(계절이 덜 드는) 곳으로 바로 떠난다 — 다른 곳을 누르면 그리로 바꾼다
        const near = r !== null ? partyMoves(r, me(), node).filter((m) => m.found).sort((x, y) => x.seasons - y.seasons || (x.to < y.to ? -1 : 1))[0] : undefined
        settles = [...settles, { kind: 'party', faction: me(), node, ...(near !== undefined ? { edge: near.edge } : {}) }]
        armySel = []
        partySel = formId(node)
        sheet = null
        break
      }
      // 빈땅에서 — 맞닿은 고을에서 꾸려 바로 이 길로
      case 'party-to': {
        const node = d['from']!
        settles = [...settles.filter((o) => !(o.kind === 'party' && o.node === node)), { kind: 'party', faction: me(), node, edge: d['edge']! }]
        break
      }
      case 'party-undo': {
        const node = d['node']!
        settles = settles.filter((o) => !(o.kind === 'party' && o.node === node))
        if (partySel === formId(node)) clearParty()
        break
      }
      case 'ptok': armySel = []; partySel = partySel === d['army'] ? '' : d['army']!; sheet = null; break
      case 'pp-close': clearParty(); break
      case 'ptjoin': {
        const id = d['army']!
        if (joining(id)) settles = settles.filter((o) => !(o.kind === 'partyJoin' && o.party === id))
        else {
          settles = [...settles.filter((o) => !(o.kind === 'partyGo' && o.party === id)), { kind: 'partyJoin', party: id }]
          if (partySel === id) clearParty()
        }
        break
      }
      case 'ptgo': if (partySel !== '') sendParty(partySel, d['edge']!); break
      case 'assault': {
        const id = d['army']!
        const has = armyOrders.some((o) => o.kind === 'assault' && o.army === id)
        armyOrders = has ? armyOrders.filter((o) => !(o.kind === 'assault' && o.army === id)) : [...armyOrders, { kind: 'assault', army: id }]
        if (!has) delete pick[id] // 그 자리에서 치면 다른 길로 떠나지 않는다
        break
      }
      case 'turnback': {
        const id = d['army']!
        const has = armyOrders.some((o) => o.kind === 'turnBack' && o.army === id)
        armyOrders = has ? armyOrders.filter((o) => !(o.kind === 'turnBack' && o.army === id)) : [...armyOrders, { kind: 'turnBack', army: id }]
        break
      }
      case 'roadkey': roadOpen = !roadOpen; break
      case 'log-open': openSheet({ kind: 'log' }); return
      case 'log-f': logFilter = d['v'] as LogFilter; break
      case 'log-n': logNation = d['id'] ? d['id'] : null; break
      case 'layers': layersOpen = !layersOpen; break
      case 'layer': toggleLayer(d['v'] as LayerId); break
      case 'htab': heroTab = d['v'] as typeof heroTab; if (heroTab === 'cmd') cmdJob = null; break
      case 'cmd': {
        // 일 카드 — 명령 탭의 그 일 창으로 (장수 판에서 누르면 그 장수를 골라 둔 채로)
        heroTab = 'cmd'
        cmdJob = d['job'] as CmdJob
        cmdHero = d['id'] ?? ''
        if (sheet?.kind === 'heroes') break
        sheet = { kind: 'heroes' }
        $('.sheet').scrollTop = 0
        paint()
        return
      }
      case 'cmd-back': cmdJob = null; break
      case 'cmd-hero': cmdHero = d['id']!; bark(d['id']); break
      case 'cmd-plot': {
        // 공작 갈래 하나 — 외교의 공작 판을 그 갈래가 펼쳐진 채로. 장수 판에서 왔으면 그 장수를 「누가 가나」 맨 앞에
        const op = d['op'] as PlotOp
        const fromHero = sheet?.kind === 'heroes' && cmdHero !== '' && realm !== null && plotAgents(realm, me()).includes(cmdHero)
        plotAgent = fromHero ? cmdHero : null
        diploMode = 'plot'
        plotOpen = op
        plotPick = ''
        sheet = { kind: 'diplo' }
        $('.sheet').scrollTop = 0
        paint()
        requestAnimationFrame(() => scrollInside($('.sheet').querySelector<HTMLElement>('.popan'), 'center'))
        return
      }
      case 'guide': {
        const g = GUIDE[d['k'] ?? '']
        if (g === undefined) return
        root.querySelector('.guidebox')?.remove()
        root.insertAdjacentHTML('beforeend', `<div class="guidebox" data-act="guide-close"><div class="gbx" role="dialog" aria-label="${esc(g.title)}"><b>${esc(g.title)}</b>${g.body.map((p) => `<p>${tx(p)}</p>`).join('')}<button class="btn sm" data-act="guide-close">닫기</button></div></div>`)
        return
      }
      case 'guide-close': root.querySelector('.guidebox')?.remove(); return
      case 'annal': {
        const a = annalOf(d['id']!)
        if (a === undefined) return
        root.querySelector('.guidebox')?.remove()
        root.insertAdjacentHTML('beforeend', `<div class="guidebox" data-act="guide-close"><div class="gbx annal" role="dialog" aria-label="${esc(a.name)}"><b>📜 ${esc(a.name)}</b><small>${esc(a.book)}</small>${a.lines.map((p) => `<p>${esc(p)}</p>`).join('')}<button class="btn sm" data-act="guide-close">닫기</button></div></div>`)
        return
      }
      case 'hero-back': openSheet({ kind: 'heroes' }); return
      case 'bridal-look': if (realm !== null) bridalLook(realm, d['id']!); return
      case 'hero-envoy': envoyPick = d['id']!; diploMode = 'envoy'; bark(d['id']); openSheet({ kind: 'diplo' }); return
      case 'hero-agent': plotAgent = d['id']!; diploMode = 'plot'; bark(d['id']); openSheet({ kind: 'diplo' }); return
      case 'cohabit': heroOrders = [...heroOrders.filter((o) => !(o.kind === 'cohabit' && o.hero === d['id'])), { kind: 'cohabit', hero: d['id']! }]; break
      case 'uncohabit': { const sp = realm!.heroes[d['id']!]?.spouse; heroOrders = heroOrders.filter((o) => !(o.kind === 'cohabit' && (o.hero === d['id'] || o.hero === sp))); break }
      case 'pl-open': {
        const o = settles.find((x): x is Extract<Order, { kind: 'place' }> => x.kind === 'place')
        placeDraft = o !== undefined ? { ...o.delta } : {}
        openSheet({ kind: 'place' }); return
      }
      case 'pl-sub': case 'pl-add': {
        const id = d['node']!
        const add = d['act'] === 'pl-add'
        const k = placeStepOf(id, add)
        if (k <= 0) break
        placeDraft = { ...placeDraft, [id]: (placeDraft[id] ?? 0) + (add ? k : -k) }
        if (placeDraft[id] === 0) { const { [id]: _, ...rest } = placeDraft; placeDraft = rest }
        break
      }
      case 'pl-reset': placeDraft = {}; break
      case 'pl-ok': {
        const delta = Object.fromEntries(Object.entries(placeDraft).filter(([, v]) => v !== 0))
        // 맨 앞에 — 엔진이 계절 처음과 같은 판으로 본다 (뒤의 개척단 꾸리기·자리 잡기가 집·곡식을 바꿔도 버려지지 않게)
        settles = [...(Object.keys(delta).length > 0 ? [{ kind: 'place' as const, faction: me(), delta }] : []), ...settles.filter((o) => o.kind !== 'place')]
        openSheet({ kind: 'people' }); return
      }
      case 'nat-plot':
        diploMode = 'plot'
        sheet = { kind: 'diplo' }
        paint()
        break
      case 'compose-go': case 'nat-diplo': {
        // 고을 판에서 자세히 꾸며야 하는 사신 — 외교 판의 그 나라 칸을 열어 준다
        diploMode = 'envoy'
        if (d['act'] === 'compose-go') compose = { ...NO_COMPOSE, give: noGoods(), take: noGoods(), to: d['to']!, ask: d['ask'] as Ask }
        sheet = { kind: 'diplo' }
        paint()
        requestAnimationFrame(() => scrollInside($('.sheet').querySelector<HTMLElement>(d['act'] === 'compose-go' ? '.trade' : `[data-to="${d['to']}"]`), 'center'))
        return
      }
      case 'home': {
        // 우리 도읍으로 지도를 옮긴다 (형: "내나라가 지도상에서 정확히 어딘지 가늠이 안됨")
        const wrap = $('.mapwrap')
        const cap = realm !== null ? realm.factions[me()]?.capital : undefined
        const el = cap !== undefined ? wrap.querySelector<HTMLElement>(`.nd[data-node="${cap}"]`) : null
        const map = wrap.querySelector<HTMLElement>('.map')
        // 지도 끝 너머(구름 그림이 삐져나온 자리)까지 밀지 않는다
        const cl = (v: number, max: number): number => Math.max(0, Math.min(v, max))
        if (el !== null && map !== null) {
          wrap.scrollTo({
            left: cl(map.offsetLeft + el.offsetLeft - wrap.clientWidth / 2, map.offsetLeft + map.offsetWidth - wrap.clientWidth),
            top: cl(map.offsetTop + el.offsetTop - wrap.clientHeight / 2, map.offsetTop + map.offsetHeight - wrap.clientHeight),
            behavior: 'smooth',
          })
        }
        return
      }
      case 'jump': scrollInside($('.sheet').querySelector(`#${d['to']}`), 'start', true); return
      case 'selmerge': {
        // 고른 군대를 하나로 — 장수가 이끄는 군대로 모은다
        if (r === null) break
        const pl = plan()
        const into = armySel.find((id) => pl.armies[id]?.hero != null) ?? armySel[0]!
        const os: Order[] = armySel.filter((id) => id !== into).map((id) => ({ kind: 'merge', army: id, into }))
        if (os.length === 0) break
        armyOrders = [...armyOrders, ...os]
        for (const o of os) if (o.kind === 'merge') delete pick[o.army]
        armySel = [into]
        break
      }
      case 'go': {
        // 지도에서 고른 곳으로 — 싸울 곳이면 군대 판을 열어 어떻게 칠지 고르게 한다. 제 고을(머문다)이나 같은 곳을 다시 누르면 머문다
        const edge = d['edge'] ?? ''
        if (armySel.length === 0 || r === null) break
        const army = armySel[0]!
        const goal = d['goal']
        if (edge === '' || (goal === undefined && armySel.every((id) => pick[id]?.edge === edge && pick[id]?.goal === undefined)) || (goal !== undefined && armySel.every((id) => pick[id]?.goal === goal))) {
          for (const id of armySel) {
            delete pick[id]
            // 먼 갈 곳도 거둔다 — 다음 계절부터 저절로 가지 않는다
            if (edge === '' && r.armies[id]?.goal !== undefined && !goalStop.includes(id)) goalStop = [...goalStop, id]
          }
          armySel = []
          break
        }
        goalStop = goalStop.filter((id) => !armySel.includes(id))
        // 먼 곳 — 첫 걸음과 갈 곳을 같이. 적 고을이면 닿는 걸음이 곧 출정이다
        if (goal !== undefined) {
          for (const id of armySel) pick[id] = { edge, ambush: false, goal }
          marchSfx()
          // 먼 곳 — 칩 대신 잠깐 한 줄로 알린다: 누가 어디로 · 몇 계절 (형 10-26: "멀리 보내면 ~가 어디로 출정했고 몇 개월 걸린다를 화면에 잠깐 띄웠다 없애")
          const ar = r.armies[army]
          const to = r.nodes[goal]
          const k = ar !== undefined ? goalReach(r, me(), ar.at).get(goal)?.seasons : undefined
          if (ar !== undefined && to !== undefined && k !== undefined) {
            const foe = to.owner !== null && to.owner !== me() && to.kind !== 'sodo'
            goToast(`${esc(josa(armyName(r, ar), '이', '가'))} <b>${esc(josa(to.name, '으로', '로'))}</b> ${foe ? '출정했다' : '떠났다'} · <b>${k}계절</b> 뒤 닿는다`)
          }
          armySel = []
          break
        }
        for (const id of armySel) pick[id] = { edge, ambush: false }
        const m = movesOf(r, me(), r.armies[army]!).find((x) => x.edge.id === edge)
        if (m?.hostile !== true) marchSfx() // 싸울 곳이면 출정 판의 「출정」에서 낸다
        if (m?.hostile === true) {
          // 적 고을 — 화면 가득 전략 회의 (누가 가나 · 장수들의 안 · 길 · 군량과 국고) (형 10-29)
          openSortie(r.armies[army]!)
          sortieD.edge = edge
          stratOpen = { army, next: false }
          armySel = []
          paint()
          return
        }
        armySel = []
        break
      }
      case 'mv': {
        const army = d['army']!
        if (d['edge'] === '') delete pick[army]
        else {
          if (pick[army]?.edge !== d['edge']) marchSfx() // 군대 판에서 보내도 떠나는 소리 (형 10-23)
          pick[army] = { edge: d['edge']!, ambush: pick[army]?.edge === d['edge'] ? pick[army]!.ambush : false }
        }
        break
      }
      case 'amb': {
        const p = pick[d['army']!]
        if (p !== undefined) p.ambush = d['v'] === undefined ? !p.ambush : d['v'] === '1'
        break
      }
      case 'ap': {
        // 진군 방식 — 대로가 아니면 숨어 간다
        // 군막 — 그 길을 권한 장수를 함께 적는다 (싸움이 드러날 때 「○○의 말대로」)
        const adv = d['adv'] !== undefined && d['adv'] !== '' ? d['adv'] : undefined
        if (d['army'] === SORTIE) { sortieD.approach = d['v'] as Approach; if (adv !== undefined) sortieD.adviser = adv; else delete sortieD.adviser; break }
        const p = pick[d['army']!]
        if (p !== undefined) {
          p.approach = d['v'] as Approach
          p.ambush = p.approach !== 'road'
          if (adv !== undefined) p.adviser = adv
          else delete p.adviser
        } else if (d['edge'] !== undefined && r !== null) {
          // 멀리 걸어 둔 목표의 이번 걸음 — 군막에서 길을 고르면 이번 걸음을 그 길로 (목표는 그대로)
          const ar = r.armies[d['army']!]
          const g = ar !== undefined ? goalOf(ar) : undefined
          const ap = d['v'] as Approach
          pick[d['army']!] = { edge: d['edge'], ambush: ap !== 'road', approach: ap, ...(adv !== undefined ? { adviser: adv } : {}), ...(g !== undefined ? { goal: g } : {}) }
        }
        break
      }
      case 'ration': {
        if (d['army'] === SORTIE) {
          const oa = r?.armies[openArmy]
          if (oa === undefined || r === null) break
          const probe = sortieProbe(oa)
          const m = movesOf(r, me(), probe).find((x) => x.edge.id === sortieD.edge)
          const cur = rationExtraOf(r, probe, m?.seasons ?? 1, sortieD.ration)
          sortieD.ration = d['v'] === 'full' ? P.realm.rationReserve : Math.max(0, Math.min(P.realm.rationMaxExtra, cur + (d['v'] === 'more' ? 1 : -1)))
          break
        }
        const p = pick[d['army']!]
        const a = r?.armies[d['army']!]
        if (p === undefined || a === undefined || r === null) break
        const m = movesOf(r, me(), a).find((x) => x.edge.id === p.edge)
        const cur = rationExtraOf(r, a, m?.seasons ?? 1, p.ration)
        const v = d['v']
        p.ration = v === 'full' ? P.realm.rationReserve : Math.max(0, Math.min(P.realm.rationMaxExtra, cur + (v === 'more' ? 1 : -1)))
        break
      }
      case 'sq': {
        const a = r!.armies[d['army']!]
        const k = d['kind'] as UnitKind
        const max = a?.mix[k] ?? 0
        const had = sortieAll(a!)
        sortieD.take[k] = Math.max(0, Math.min(max, (sortieD.take[k] ?? 0) + Number(d['d'])))
        // 일부만 떼면 — 군대 창의 나누기는 장수가 남고(떼어 낸 무리가 여기 남는다), 전략 회의의 출정은 장수가 떠나는 무리를 이끈다 (형 10-29: "분리되더라도 원래 이동 경로는 장수가 이끄는 거 맞지?")
        if (had && !sortieAll(a!)) sortieD.hero = stratOpen !== null
        if (sortieAll(a!)) sortieD.hero = true
        break
      }
      case 'sqall': {
        const a = r!.armies[openArmy]
        if (a === undefined) break
        const half = d['v'] === 'half'
        sortieD.take = {}
        for (const [k, n] of Object.entries(a.mix) as Array<[UnitKind, number]>) sortieD.take[k] = half ? Math.floor(n / 2 / 5) * 5 : n
        sortieD.hero = !half || stratOpen !== null
        break
      }
      case 'shero': sortieD.hero = d['v'] === '1'; break
      case 'st-man': if (stratOpen !== null) stratOpen.man = stratOpen.man !== true; break
      case 'cn-pick': {
        // 전략 회의 — 그 장수의 말을 따른다 (안건마다 하나) · 그 장수가 짧게 대답한다
        const a = r?.armies[openArmy]
        if (a === undefined || r === null || stratOpen === null) break
        const probe = sortieProbe(a)
        const m = movesOf(r, me(), probe).find((x) => x.edge.id === sortieD.edge)
        const ag = d['ag'] as AgendaId
        const v = m !== undefined ? agendasFor(r, a, probe, m, sortieD.ration).find((x) => x.id === ag)?.voices.find((x) => x.label === d['l']) : undefined
        if (v === undefined) break
        sortieD.chose = { ...(sortieD.chose ?? {}), [ag]: v.label }
        applyVoice(a, v)
        // 다음 안건 — 기다리기로 했으면 나머지는 쓰이지 않으니 정리로
        stratOpen.step = v.opt.k === 'wait' ? 99 : (stratOpen.step ?? 0) + 1
        stratOpen.beat = 0
        break
      }
      case 'cn-next': if (stratOpen !== null) stratOpen.beat = (stratOpen.beat ?? 0) + 1; break
      case 'cn-skip': if (stratOpen !== null) stratOpen.beat = 99; break
      case 'cn-replay': if (stratOpen !== null) stratOpen.beat = 0; break
      case 'cn-goto': if (stratOpen !== null) { stratOpen.step = Number(d['i'] ?? 0); stratOpen.beat = 99 } break
      case 'sortie-cancel': delete pick[d['army']!]; openArmy = ''; break
      case 'sfollow': sortieD.follow = d['v'] === '1'; break
      case 'sortie-go': {
        // 전부면 그 군대가 떠나고, 일부면 떼어 낸 무리가 떠난다 — 나머지(와 기본은 장수)는 남아 지킨다
        const a = r!.armies[d['army']!]
        if (a === undefined) break
        // 전략 회의에서 「기다린다」 — 이번 계절은 떠나지 않는다(먼 갈 곳도 거둔다) · 성에서 맞는다
        if (sortieD.wait === true && stratOpen !== null) {
          delete pick[a.id]
          if (goalOf(a) !== undefined && !goalStop.includes(a.id)) goalStop = [...goalStop, a.id]
          openArmy = ''
          if (stratDone()) return
          break
        }
        // 나서서 이끌겠다는 장수 — 그 장수에게 맡긴다 (전부면 이 군대를, 일부면 떼어 낸 무리를)
        const lead = sortieD.lead !== undefined && leadCands(r!, a).some((x) => x.id === sortieD.lead) ? sortieD.lead : undefined
        const go = sortieD.edge !== null ? { edge: sortieD.edge, ambush: sortieD.approach !== 'road', approach: sortieD.approach, ...(sortieD.ration !== undefined ? { ration: sortieD.ration } : {}), ...(sortieD.follow === true ? { follow: true } : {}), ...(sortieD.adviser !== undefined ? { adviser: sortieD.adviser } : {}) } : null
        if (go !== null) marchSfx()
        if (sortieAll(a)) {
          if (go === null) break
          if (lead !== undefined) { pickLeader(a.id, lead); obey(lead) }
          pick[a.id] = { ...go, ...(stratOpen?.goal !== undefined ? { goal: stratOpen.goal } : {}) }
          openArmy = ''
          if (stratDone()) return
          break
        }
        const take: Partial<Record<UnitKind, number>> = {}
        for (const [k, n] of Object.entries(sortieD.take) as Array<[UnitKind, number]>) if (n > 0) take[k] = n
        const id = newArmyId(r!, me())
        const o: Order = { kind: 'split', army: a.id, id, take, hero: lead !== undefined ? false : sortieD.hero }
        if (planned(r!, [o]).armies[id] === undefined) note = `못 나눈다. 양쪽 다 ${P.realm.splitMin}명 이상, 군대는 ${P.realm.armyMax}개까지.`
        else {
          armyOrders = [...armyOrders, o]
          if (lead !== undefined) { pickLeader(id, lead); obey(lead) }
          if (go !== null) pick[id] = { ...go, ...(stratOpen?.goal !== undefined ? { goal: stratOpen.goal } : {}) }
          if (stratOpen !== null && realm !== null) councilDone.set(id, realm.season)
          // 전략 회의에서 나눴으면 남는 무리는 여기 남아 지킨다 — 지도에서 이미 걸어 둔 출정·먼 갈 곳을 거둔다 (두 부대가 같이 가 버렸다 · 형 10-29)
          if (stratOpen !== null) {
            delete pick[a.id]
            if (goalOf(a) !== undefined && !goalStop.includes(a.id)) goalStop = [...goalStop, a.id]
          }
          openArmy = ''
          freshArmy = id
          if (stratDone()) return
        }
        break
      }
      case 'merge': {
        const o: Order = { kind: 'merge', army: d['army']!, into: d['into']! }
        if (planned(r!, [o]).armies[d['army']!] !== undefined) note = '장수 둘은 한 군대를 함께 이끌지 못한다.'
        else { armyOrders = [...armyOrders, o]; delete pick[d['army']!] }
        break
      }
      case 'undo-split':
        armyOrders = []
        for (const k of Object.keys(pick)) if (realm!.armies[k] === undefined) delete pick[k]
        break
      case 'arm': {
        // 병종 하나씩 — 그 병종 가운데 가장 낮은 무장을 한 단계
        const army = d['army']!
        const unit = d['unit'] as UnitKind
        const same = (o: Order): boolean => o.kind === 'arm' && o.army === army && o.unit === unit
        if (!musters.some(same)) armSfx()
        musters = musters.some(same) ? musters.filter((o) => !same(o)) : [...musters, { kind: 'arm', army, unit }]
        break
      }
      case 'disband':
        musters = [...musters, { kind: 'disband', army: d['army']! }]
        delete pick[d['army']!]
        break
      case 'undisband':
        musters = musters.filter((o) => !(o.kind === 'disband' && o.army === d['army']))
        break
      case 'dunit': draftUnit[d['node']!] = d['unit'] as UnitKind; break
      case 'diron': draftIron[d['node']!] = draftIron[d['node']!] !== true; break
      case 'dn': {
        const node = d['node']!
        const lim = draftLimit(r!, me(), node, draftUnit[node] ?? 'spear')
        draftN[node] = Math.max(0, Math.min(lim, (draftN[node] ?? Math.min(lim, 20)) + Number(d['d'])))
        break
      }
      case 'draft': {
        const node = d['node']!
        const n = draftN[node] ?? Math.min(draftLimit(r!, me(), node, draftUnit[node] ?? 'spear'), 20)
        // 철을 들이기로 했어도 남은 철이 모자라면 그냥 뽑는다 — 미리 알린다
        const ironOk = draftIron[node] === true && (draftIronCost(r!, me(), n, draftUnit[node] ?? 'spear')?.iron ?? Infinity) <= left().iron
        if (draftIron[node] === true && !ironOk) note = '철이 모자라 쇠 무기 없이 뽑는다.'
        if (n > 0) { draftSfx(); musters = [...musters, { kind: 'draft', faction: me(), node, unit: draftUnit[node] ?? 'spear', n, ...(ironOk ? { iron: true as const } : {}) }] }
        delete draftN[node]
        break
      }
      case 'auto-draft': {
        // 고을마다(고을 판에서 누르면 그 고을만) 남은 한도를 뽑을 수 있는 병종 모두에 몫대로 — 곡식이 모자라면 거기서 멈춘다
        // (형 10-25: "창병궁병만 뽑지말고 뽑을수 있는 모든 군대를 자동으로 분배해서" · 말·나무가 모자란 병종은 그만큼만, 남은 몫은 창병으로)
        let grain = left().grain
        let got = 0
        const only = d['node']
        for (const n of sorted(Object.values(plan().nodes)).filter((x) => x.owner === me() && (only === undefined || only === '' || x.id === only))) {
          const done = (): number => musters.reduce((s, o) => s + (o.kind === 'draft' && o.node === n.id ? o.n : 0), 0)
          const room = (u?: UnitKind): number => Math.max(0, draftLimit(plan(), me(), n.id, u) - done())
          const lim = room()
          if (lim <= 0) continue
          const units = draftable(n, plan(), me()).filter((u) => room(u) > 0)
          const MIX: Partial<Record<UnitKind, number>> = { spear: P.realm.draftMixSpear, bow: P.realm.draftMixBow, shield: P.realm.draftMixShield, horse: P.realm.draftMixHorse, boat: P.realm.draftMixBoat, crossbow: P.realm.draftMixBow }
          const w = (u: UnitKind): number => MIX[u] ?? 0
          const sum = units.reduce((s, u) => s + w(u), 0)
          const take = (unit: UnitKind, want: number): void => {
            let k = Math.min(want, room(unit), room())
            while (k > 0 && draftCost(k).grain > grain) k = Math.floor(k * 0.8)
            if (k <= 0) return
            grain -= draftCost(k).grain
            const same = musters.findIndex((o) => o.kind === 'draft' && o.node === n.id && o.unit === unit && o.iron !== true)
            const prevN = same >= 0 ? (musters[same] as Extract<Order, { kind: 'draft' }>).n : 0
            musters = same >= 0 ? musters.map((o, i) => (i === same ? { ...(o as Extract<Order, { kind: 'draft' }>), n: prevN + k } : o)) : [...musters, { kind: 'draft', faction: me(), node: n.id, unit, n: k }]
            got += k
          }
          if (sum > 0) for (const u of [...units].sort((a, b) => w(b) - w(a))) take(u, Math.floor((lim * w(u)) / sum))
          // 나눗셈에 남은 몇 명 · 말·나무에 막혀 못 채운 몫 — 창병부터 채운다
          for (const u of ['spear', 'shield', 'bow'] as const) if (units.includes(u)) take(u, room())
        }
        if (got > 0) draftSfx()
        else note = '더 뽑을 군사가 없거나 곡식이 모자란다.'
        break
      }
      case 'undraft': musters = musters.filter((_, i) => i !== Number(d['i'])); break
      case 'answer': answers[d['id']!] = d['yes'] === '1'; fastNext = true; break
      case 'land-ok': landSeen.add(d['k']!); fastNext = true; break
      case 'wand-pick': {
        const id = d['id']!
        const yes = d['v'] === '1'
        answers[wandKey(id)] = yes
        const had = heroOrders.some((o) => o.kind === 'hire' && o.hero === id)
        if (yes && !had) {
          heroOrders = [...heroOrders, { kind: 'hire', faction: me(), hero: id }]
          const w = (realm?.wanderers ?? []).find((v) => v.hero.id === id)
          if (w !== undefined && !hireShown.has(id)) { hireShown.add(id); playScenes([hireSceneHtml(w.hero, 'wanderer')], 0) }
        } else if (!yes && had) { heroOrders = heroOrders.filter((o) => !(o.kind === 'hire' && o.hero === id)); hireShown.delete(id) }
        fastNext = true
        break
      }
      case 'guard': {
        const node = d['node']!
        guards = guards.includes(node) ? guards.filter((x) => x !== node) : [...guards, node]
        fastNext = true
        break
      }
      case 'rite': rite = !rite; break
      case 'compose': {
        const same = compose.to === d['to'] && compose.ask === d['ask']
        compose = { ...NO_COMPOSE, give: noGoods(), take: noGoods(), to: same ? '' : d['to']!, ask: d['ask'] as Ask }
        // 장수 판에서 「사신으로 보낸다」 한 장수 — 갈 수 있으면 미리 고른다
        if (envoyPick !== '' && realm !== null && canEscort(realm, me(), envoyPick) && heroBusy(realm, envoyPick) === null && !Object.values(envoys).some((e) => e.hero === envoyPick) && !plots.some((p) => p.kind === 'plot' && p.agent === envoyPick)) compose.hero = envoyPick
        // 사자가 다 나갔으면 몸소 갈 고을지기를 미리 고른다 (형 10-26: "마을 맡고있는 애들도 내가 보낼수가 있어서")
        else if (realm !== null && handsFull(realm)) compose.hero = freeGovernors(realm).find((id) => canEscort(realm!, me(), id)) ?? ''
        break
      }
      case 'cq': {
        const side = d['side'] as 'give' | 'take'
        const res = d['res'] as Good
        compose[side][res] = Math.max(0, compose[side][res] + Number(d['d']))
        break
      }
      case 'ctarget': compose.target = compose.target === d['node'] ? '' : d['node']!; break
      case 'envoy': {
        fastNext = true // 보고판에서 눌렀으면 다시 그릴 때 처음부터 돌리지 않는다
        const ask = d['ask'] as Ask
        const to = d['to']!
        const detailed = compose.to === to && compose.ask === ask
        const k = ekey(to, ask)
        if (envoys[k] !== undefined) delete envoys[k]
        else {
          // 부딪히는 사신은 거두고 보낸다
          for (const e of sentTo(to)) if (envoyClash(e.ask, ask)) delete envoys[ekey(to, e.ask)]
          envoys[k] = {
            kind: 'envoy', from: me(), to, ask,
            give: detailed ? { ...compose.give } : noGoods(),
            take: detailed ? { ...compose.take } : noGoods(),
            ...(detailed && compose.hero !== '' ? { hero: compose.hero } : {}),
            ...(detailed && compose.target !== '' ? { target: compose.target } : {}),
          }
          if (detailed) obey(compose.hero) // 사신으로 가는 장수가 분부를 받든다
        }
        compose = { ...NO_COMPOSE, give: noGoods(), take: noGoods() }
        break
      }
      case 'unenvoy': delete envoys[d['key']!]; break
      case 'chero': compose.hero = d['id'] ?? ''; envoyPick = ''; bark(d['id']); break
      case 'deeds': { const t = d['to']!; if (deedsOpen.has(t)) deedsOpen.delete(t); else deedsOpen.add(t); break }
      case 'fopen': { const t = d['to']!; if (diploOpen.has(t) || compose.to === t) { diploOpen.delete(t); if (compose.to === t) compose.to = '' } else diploOpen.add(t); break }
      case 'build': {
        const node = d['node']!
        const same = (o: Order): boolean => o.kind === 'build' && o.node === node
        musters = musters.some(same) ? musters.filter((o) => !same(o)) : [...musters, { kind: 'build', faction: me(), node, what: d['what'] as 'palisade' | 'moat' }]
        break
      }
      case 'dmode': diploMode = d['v'] as 'envoy' | 'plot' | 'scout'; break
      case 'plot-open':
        // 한 번 더 누르면 접는다 · 펼친 칸이 화면 밖이면 끌어온다 (형 10-26: "선택한거 바로 밑에 보낼 장수가 뜨지 않고 너무 아래 멀리있어")
        plotOpen = plotOpen === d['op'] ? null : (d['op'] as PlotOp)
        plotPick = ''
        if (plotOpen !== null) requestAnimationFrame(() => scrollInside(root.querySelector<HTMLElement>('.popan'), 'nearest'))
        break
      case 'plot': {
        const op = d['op'] as PlotOp
        const o: Order = {
          kind: 'plot', faction: me(), op, target: d['target']!,
          ...(d['node'] ? { node: d['node'] } : {}), ...(d['other'] ? { other: d['other'] } : {}),
          ...(d['hero'] ? { hero: d['hero'] } : {}), ...(d['agent'] ? { agent: d['agent'] } : {}),
        }
        const k = o as { node?: string; other?: string; hero?: string }
        const same = (p: Order): boolean => p.kind === 'plot' && p.op === op && p.target === o.target && p.node === k.node && p.other === k.other && p.hero === k.hero
        if (plots.some(same)) plots = plots.filter((p) => !same(p))
        else if (plots.length < P.realm.plotsPerSeason) { plots = [...plots, k.hero !== undefined && hands[k.hero] !== undefined ? { ...o, hand: hands[k.hero]! } as Order : o]; plotAgent = null; obey(d['agent']) }
        plotPick = ''
        break
      }
      case 'unplot': plots = plots.filter((_, i) => i !== Number(d['i'])); break
      case 'shoot': {
        const o = plots[Number(d['i'])]
        if (o?.kind === 'plot' && o.hero !== undefined && hands[o.hero] !== undefined) break // 한 번만
        openNight(Number(d['i']))
        return
      }
      case 'sowflag': { const f = d['f']!; if (sowA === f) sowA = ''; else if (sowB === f) sowB = ''; else if (sowA === '') sowA = f; else sowB = f; break }
      case 'sowslot': if (d['side'] === 'a') sowA = ''; else sowB = ''; break
      case 'ppick':
        plotPick = plotPick === d['k'] ? '' : d['k']!
        if (plotPick !== '') requestAnimationFrame(() => scrollInside(root.querySelector<HTMLElement>('.popan .pwhos'), 'nearest'))
        break
      case 'fold': { const k = d['k']!; if (foldOpen.has(k)) foldOpen.delete(k); else foldOpen.add(k); break }
      case 'bowup': musters = musters.some((o) => o.kind === 'bowUp') ? musters.filter((o) => o.kind !== 'bowUp') : [...musters, { kind: 'bowUp', faction: me() }]; break
      case 'hero': {
        // 우리 장수를 부르면 곧바로 대답한다 — 결마다 「네?」 「부르셨습니까」… (voice.ts)
        const h = realm?.heroes[d['id']!]
        if (h !== undefined && h.faction === me() && h.status === 'free' && !isRuler(realm!, h.id) && voiceGate(performance.now())) ding(voicePath(h, 'tap', false), 0.9)
        openSheet({ kind: 'hero', id: d['id']! }); return
      }
      case 'bust-view': openBust(d['src']!); return
      case 'bust-close': root.querySelector('.bview')?.remove(); return
      case 'assign':
        heroOrders = [...heroOrders, { kind: 'assign', hero: d['id']!, node: d['node'] ? d['node'] : null }]
        obey(d['id'])
        break
      case 'lead': heroOrders = [...heroOrders, { kind: 'lead', hero: d['id']!, army: d['army']! }]; obey(d['id']); break
      case 'pby': persuadeBy[d['id']!] = d['by']!; break
      case 'dp-pick': wooPick = d['id']!; break
      case 'dp-x': wooPick = null; break
      case 'dp-by': persuadeBy[d['id']!] = d['by']!; wooPick = null; bark(d['by'], 'tap'); break
      case 'persuade': heroOrders = [...heroOrders, { kind: 'persuade', hero: d['id']!, by: d['by'] ? d['by'] : null }]; obey(d['by']); break
      case 'standby': standBy(d['id']!); break
      // 재상 — 쉬는 장수 모두 · 장수 하나 (형 10-26)
      case 'js-all': if (realm !== null) realm.autoIdle = d['v'] === '1'; break
      case 'js-one': setManual(d['id']!, d['v'] === 'self'); break
      case 'unhero': heroOrders = heroOrders.filter((o) => !((o.kind === 'assign' || o.kind === 'lead' || o.kind === 'persuade' || o.kind === 'hire') && o.hero === d['id'])); break
      case 'hire': {
        const id = d['id']!
        const had = heroOrders.some((o) => o.kind === 'hire' && o.hero === id)
        heroOrders = had ? heroOrders.filter((o) => !(o.kind === 'hire' && o.hero === id)) : [...heroOrders, { kind: 'hire', faction: me(), hero: id }]
        if (had) hireShown.delete(id) // 거뒀다 다시 들이면 연출이 또 나오게 — 안 그러면 계절 끝에도 건너뛰어 영영 안 나온다
        // 등용은 그 순간 연출 — 계절 기록은 계절이 넘어갈 때 (형 10-24: "등용 연출이 한 계절 늦어 · 그 순간 바로 연출 떠야 함")
        if (!had && !hireShown.has(id)) {
          const w = (realm?.wanderers ?? []).find((v) => v.hero.id === id)
          if (w !== undefined) { hireShown.add(id); playScenes([hireSceneHtml(w.hero, 'wanderer')], 0) }
        }
        break
      }
      // 정찰은 보내면 기본으로 그곳에 고정 — 고정은 📌 로 푼다 (형 10-24: "정찰 한번 보내면 기본이 고정이어야 하고 선택에 따라 고정 풀게")
      case 'scout': scout = scout === d['node'] ? '' : d['node']!; if (scout === '' && scoutKeep === d['node']) setKeep(''); else if (scout !== '') setKeep(scout); break
      case 'scout-keep': { const n = d['node']!; if (scoutKeep === n) setKeep(''); else { setKeep(n); scout = n } break }
      default: return
    }
    paint()
  })

  return {
    cloudChanged() {
      // 고르기 카드는 판 위·첫 화면 어디서든 맨 위에
      root.querySelector('.cloudpick')?.remove()
      const h = chooseHtml()
      if (h !== '') root.insertAdjacentHTML('beforeend', h)
      paint()
    },
    show(r, b, rep, fresh = false) {
      realm = r
      before = b
      report = rep
      showReport = rep !== null
      front = fresh ? null : { kind: 'title' }
      prologue = fresh ? 0 : null
      looking = false
      resetTurn()
      restoreDraft()
      loadSeen()
      if (r !== null) { noteFaces(r); recordDex(r) } // 열 때 한 번 — 아이 얼굴을 먼저 짝짓고 · 알림 없이 (이 판에서 이미 본 장수)
      engraveNow(r) // 끝난 판을 열었다 — 아직 안 새긴 공이 있으면 (새기기 전에 창을 닫았거나 옛 빌드였다)
      sheet = null
      paint()
      if (fresh && r !== null) coverMap() // 새 판 — 지도 그림을 다 받을 때까지 가린다
    },
  }
}
