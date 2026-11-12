/**
 * 칠십팔국 — 앱 화면 (docs/realm/FLOW.md §5)
 *
 * 한 화면에 꽉 찬다. 페이지는 내려가지 않는다: 위 상태 줄 · 가운데 지도 · 아래 탭. 탭이나 고을을 누르면
 * 아래에서 판(시트)이 올라오고 그 안만 스크롤한다. 계절을 넘기면 보고가 카드로 뜬다.
 * 화면은 판을 읽기만 하고, 바꾸는 일은 명령을 모아 advance 에 넘기는 것 하나다 (절대 규칙 2 의 정신).
 * 루프·타이머가 없다 — 누르면 다시 그린다 (절대 규칙 4). 글은 FLOW §6: 짧게, AI 말투 금지.
 */
import { faceFile, noteAscended } from './face.ts'
import { aiOrders, strikeLive } from '../../realm/ai.ts'
import { headcount, strength, type Equip, type UnitKind } from '../../realm/battle.ts'
import { bustOf, generalSprite, CUSTOM_ICON, FACTION_ART, GOOD_ICON, MIGRANT_ANIM, SEASON_ICON, SOL_ANIM2, SOL_ANIM_AR, UNIT_ICON, flagIcon, kidBust, nodeIcon, nodePos, noteGrowing, noteKids } from '../../realm/data/art.ts'
import { AWAKEN2_LOOP, AWAKEN_ART, AWAKEN_LOOP, loopFile, loopTakes, loopTakes2 } from '../../realm/data/awaken-art.ts'
import { LOCKED_TRUE_WAKE_PREVIEW, TRUE_WAKE } from '../../realm/data/awaken2.ts'
import { NATIONS, type NationInfo } from '../../realm/data/nations.ts'
import { YEONGNAM_NATIONS } from '../../realm/data/nations-yeongnam.ts'
import { SOUTH_NATIONS } from '../../realm/data/nations-south.ts'
import { WORLD_NATIONS } from '../../realm/data/nations-world.ts'
import { HAENGIN_NATION, JUMONG_NATIONS } from '../../realm/data/regions/jumong.ts'
import { MAHAN_NATIONS } from '../../realm/data/regions/mahan.ts'
import { SEORA_NATIONS } from '../../realm/data/regions/seorabeol.ts'
import { GUJI_NATIONS } from '../../realm/data/regions/gujibong.ts'
import { DAEMUSIN_NATIONS } from '../../realm/data/regions/daemusin.ts'
import { chapterOfRegion, chapterTag } from '../../realm/data/campaign.ts'
import { knownOf, knows, met } from '../../realm/discovery.ts'
import { GRADE_COLOR, GRADE_NAME, TRAIT } from '../../realm/data/traits.ts'
import { CARDS, GRAND_FEST, cardFallback, cardInfo } from '../../realm/data/cards.ts'
import { cardPreview, pirateMission, type CardFx } from '../../realm/events.ts'
import { festName, festMonth, festNextIn } from '../../realm/festival.ts'
import { mountDuel, type DuelSide } from '../../duel/view.ts'
import { clampTier } from '../../realm/tier.ts'
import {
  ASK_KIND_NAME as ASK_KIND_NAME_KO, ASK_NAME as ASK_NAME_KO, deedText, GEAR_NAME, TIER_NAME, PLOT_DOES, PLOT_NAME as PLOT_NAME_KO, askLine, arriveWhen, josa, EDGE_NAME, NODE_KIND_NAME, SEASON_LINE, SETTLED_NAME, STAT_NAME, TAG_LINE, UNIT_NAME as UNIT_NAME_KO, reportText, seasonLabel, dateLabel, spanLabel, turnsLabel, turnText, turnWord, whyLine, NODE_NOW, BUILD_NAME as BUILD_NAME_KO, BOW_NAME, CONCEAL_LINE, GOOD_NAME as GOOD_NAME_KO, MEET_HOW, tagNow,
} from '../../realm/data/prose.ts'
import { canEscort, envoyChanceFor, envoyClash, envoyOptions, favorOf, friendly, jointTargets, lentEta, openAsks, relationOf } from '../../realm/diplomacy.ts'
import {
  GOODS, armCost, buildCost, canBuild, canGuard, draftCost, draftIronCost, draftLimit, draftNeeds, draftPay, goodOf, guardCost, hhGrowth, isCoast, militiaMen, nextBuild, nodeHarvest, nodeYield, nodeSpecials, upkeepOf, riteAllowed, riteCost,
  autoFlows, crowdOf, migratePath, fieldMul, homeRoom, inboundOf, inboundRate, isRiverside, placeLimit, placeNodes, workMul,
  goodsWorth,
  callCost, callLimit, callWhy, draftWhy, grainAtSeasonEnd, isWoody, shareOpen, stockOf, freeSite, soilOf,
} from '../../realm/economy.ts'
import { goalReach, goalRoute } from '../../realm/goal.ts'
import { approachMoves, armyPower, jointWin, matchupHints, movesOf, type Move } from '../../realm/estimate.ts'
import { kitLines } from '../../realm/kit.ts'
import { alertRange, seenMix, visibleRange } from '../../realm/intel.ts'
import { type ConcealWhy, advance, concealOf, draftable, forceOf, lessonOn, newArmyId, otherEnd, planned, rationCost, rationExtra, seasonOf, seenMarches, seenScoutedStationary } from '../../realm/season.ts'
import { ageSeasons, isSeasonEnd, isSeasonStart, monthly, perSeason, seasonIdx, seasons, type ClockKind } from '../../realm/calendar.ts'
import { draftScouts, parseScoutKeep, scoutCap, scoutTargets, townCount, watchedNodes } from '../../realm/scouts.ts'
import { NIGHT_OPS, PLOT_OPS, exposeChance, assassinArrows, assassinBow, assassinGuard, bowUpCost, escapeChance, plotAgents, plotCap, plotChance, plotCost, plotTargets, rescueGuard } from '../../realm/plots.ts'
import { allianceWhy, leaderOf, tookRecently, truceWhy, winningAgainst } from '../../realm/stance.ts'
// 등용 대사 — 장수마다 한 마디 (형 10-24: "장수마다 각각 등용 대사 개성 있고 다양하고 독특하게")
import { startRegion } from '../../realm/data/regions/index.ts'
import { HIRE_BY_TRAIT, HIRE_LINE, HIRE_PLAIN } from '../../realm/data/hire-lines.ts'
import { DESTS, DEST_IDS, EXP_SEASONS, destReachable, expAmount, expBlock, expOdds, onExpedition } from '../../realm/expedition.ts'
import { foundable, joinable, partiesOf, partyCost, partyMoves, partyRoute, partySize } from '../../realm/parties.ts'
import { ascendNeed, canCohabit, canWed, heroJobOf, heroSeen, honeyLeft, idleHeroOrders, together, inheritOf, isRuler, postHero, rulerOf, tieOf, wanderersFor, wedCost, wooable } from '../../realm/heroes.ts'
import { guardOptions } from '../../realm/council.ts'
import type { Approach, Army, BuildWhat, EdgeKind, EnvoyAsk, ExpDest, Good, Hand, Hero, Order, Party, PlotOp, Ration, Realm, RegionId, Report, ReportLine, Tactic, WooApproach } from '../../realm/types.ts'
import { P } from '../../tune/params.ts'
import { MAP_CSS, roadSvg, ROUTE_SIGN_NAME, mapHtml, noReachWhy, visibleNodes, warmNextSeason, type RouteSign, type MapMarch, type MapTarget, type MapToken } from './mapview.ts'
import { LEGACY_CSS, bringHtml, clearBring, toggleBring } from './legacy.ts'
import { TOWN_CSS, townCheer, townVeilHtml, townViewHtml, type TownSlot } from './townview.ts'
import { townFort, townGround, townSprite } from '../../realm/data/town-art.ts'
import { RISE_CSS, riseGraphHtml } from './risegraph.ts'
import { BOOK_CSS, bookHtml, bookSwipe, bookTurn, shelfHtml, type Book } from './bookshelf.ts'
import { CROWN_CSS, crownRowHtml, flyCrowns, newCrowns } from './crowns.ts'
import { WONDER_CSS } from './wondermap.ts'
import { LEAGUE_CSS, leagueChipHtml, leagueToastHtml } from './league.ts'
import { BOND_CSS, endBondsHtml } from './bonds.ts'
import { DEX_CSS, clanHeroes, dexHtml, dexToastHtml, loadDex, recordDex, toggleDexAwake, type DexBoard } from './dex.ts'
import { DEX_AWOKE, DEX_SERVED, dexCatalog } from '../../realm/dex.ts'
import { DRILL_CSS, drillLevel, engraveRun, hasDrill, loadDrill, raiseHero, yardAct, yardAfterPaint, yardBack, yardHtml, yardReset, yardSearch, yardStripHtml, yardBeforePaint, type DrillKit } from './drill.ts'
import { applyDrill, earnedOf } from '../../realm/drill.ts'
import { RELIC_CSS, openRunTomb, pickRunRelic, putRelic, relicChips, takeOffRelic, tombHtml, tombRun, tombStripHtml, wornBy, type RelicKit } from './relics.ts'
import { RELIC } from '../../realm/data/relics.ts'
import { LEVEL_LINE, TIER_MAX, levelName } from '../../realm/tier.ts'
import { FIT_CSS, MQ_CSS, fitLabels, marquee } from './fit.ts'
import { annalOf } from '../../realm/data/annals.ts'
import { TALK_CSS, WOO_CSS, outlookHtml, miniHtml, pickBoxHtml, progressHtml, talkBoxHtml, talkOver, wallHtml, whoHtml, wooBest, type TalkLines, type WooKit } from './woo-view.ts'
import { wooKneelLine, wooLordLine, wooNotYetLine, wooOpenLine, wooPitchLine, wooReactLine, wooWonLine } from './woo-lines.ts'
import { talkAuto, talkRun, talkWhy } from '../../realm/woo.ts'
import { GROW_CSS, HERO_CSS, TITLE_MEAN, artChip, bondChip, growthHtml, heroRadar, nameHtml, roleLine, splitTitle, traitChips } from './heroview.ts'
import { APP_CSS, CLOUD_CSS, SEASONP_CSS, UI_CSS } from './appstyle.ts'
import { GOAL_CSS, goalBandHtml, goalRowsHtml } from './goalband.ts'
import { contestOpen } from '../../realm/scenario.ts'
import { installTips, TIP_CSS } from './tips.ts'
import { FIRST_CSS, FIRSTS, loadFirsts, nextFirst, saveFirsts, type First } from './firsts.ts'
import { UPDATE_CSS } from './update.ts'
import { scrollInside } from './scroll.ts'
import { retainMaxOf } from '../../realm/legacy.ts'
import { morph } from './morph.ts'
import { paintMapCanvas } from './mapcanvas.ts'
import { declutter } from './declutter.ts'
import { rehearse, type BattleLine } from '../../realm/warroom.ts'
import { BATTLE_CSS, battleCard } from './battlecard.ts'
import { AP_CHIP, APPROACH_DOES, APPROACH_NAME as APPROACH_NAME_KO, B0_KEY, HARD_LINE, WAR_CSS, b0On, openWar } from './battlefield.ts'
import { SKFX_CSS } from './skillfx.ts'
import { MEM_CSS, memRowHtml } from './memrow.ts'
import { attachZoom } from './zoom.ts'
import { holdBox, longPress } from './holdbox.ts'
import { burn } from './burn.ts'
import { ASCEND_CSS, ELEM, awakeningGemHtml, elemOf, elemVars, gatherHtml, mote, ringsHtml, vortexHtml } from './ascend.ts'
import { HILITE_CSS, hilite } from './hilite.ts'
import { tutCss, TUT_STEPS, createSpot, tutAt, tutBandHtml, tutStyle } from './tutorial.ts'
import { LOG_CSS, LOG_GROUPS, lineNations, logGroup, logNations, logRows, logbookHtml, type LogFilter } from './logbook.ts'
import { everWon, markTutorialOver, markWon, nationWon, tutorialDone, tutorialOver, unlockedBoards, tierOpen, tierWon } from './unlock.ts'
import { TINT_CSS, tint } from './tint.ts'
import { SAVE_CSS, saveBoxHtml, type SaveAsk } from './savebox.ts'
import { defaultLabel, type SaveMeta } from './saves.ts'
import { nationKit } from './kitcolor.ts'
import { handsOf, idleHeroes, ownHand, ownHandsIn } from '../../realm/hands.ts'
import { pactOf } from '../../realm/suzerain.ts'
import { ironOf, riteOf } from '../../realm/paths.ts'
import { diploTips, type DiploTip } from '../../realm/advice.ts'
import { MOOD_CSS, MOOD_WORD, moodImg, moodOf } from './mood.ts'
import { AUD_CSS, askSay, pactSay, typed, type PactKind } from './audience.ts'
import { customDef, customsOf } from '../../realm/data/customs.ts'
import { lang, setLang, t as tr, LANGS, type Lang } from '../../i18n/index.ts'
import { nameTable } from '../../i18n/names.ts'
import { openCredits } from './credits.ts'
import { playEnding, playOpening } from './opening.ts'
import { BOARDS, FRONT_CSS, PROLOGUE_STEPS, chronicleOf, customsHtml, winNeed, boardHtml, detailHtml, endingHtml, nationsHtml, prologueHtml, slotsHtml, titleHtml, type FrontKit, type History, type SlotInfo } from './front.ts'
import { SCENE_SOUND, VOLUME_CSS, makeMusic, playOnce, preRoll, setSoundVolume, snd, sndFile, soundVolume, tapSlot, volumeRowsHtml, warmOnce } from './sound.ts'
import { exileArt, exileBeats, fugitiveBeats, quarrelArt, quarrelBeats, romanceBeats, romanceFlip, sayOfBeat } from './card-lines.ts'
import { HERO_POOL } from '../../realm/data/heroes-pool.ts'
import { chiefCastOf, hireVoicePath, voiceGate, voiceKind, voicePath, type VoiceLine } from './voice.ts'
import { WINFX_CSS, WIN_BUZZ, buzz } from './winfx.ts'
import { loadTip, tipHtml, tipReadMs } from './loadtips.ts'
import { worldMapReady } from './worldmap.ts'
import { loadBar } from './loadbar.ts'
import { WORKS, clearBlocked, clearCost, lotCap, lotOf, lvGain, lvOf, sitesOf, workBlocked, workCost, workEffect, workOptions, worksOf, type WorkWhat } from '../../realm/works.ts'
import { PALACE_NAME, SEATS, SEAT_DEFS, autoDraftOn, canPalace, heroSeat, palaceBlocked, palaceCost, palaceTier, seatBlocked, seatDraftMul, seatFx, seatHero, seatOpen, type PalaceTier, type Seat } from '../../realm/palace.ts'
import { WONDERS, WONDER_ORDER, canWonder, feastBlocked, feastNext, feastOdds, feastPour, greatOpen, rivalWonders, wonderBlocked, wonderEffect, wonderNode, wonderStageCost, wonderWorkOf, type FeastGot, type WonderId } from '../../realm/wonders.ts'
import { postGain } from '../../realm/postgain.ts'
import { hasScale, marketIn, marketOf, scaleBuyPrice, scaleLimit, scaleRoom, scaleSellPrice, sellCap, sellLimit, sellPrice, wishReady, WISH_GRADE_NAME, type Offer } from '../../realm/merchant.ts'
import { QUALITY_CSS, gfxRowHtml, setGfxPref, startQuality } from './quality.ts'
import { perfClear, perfRowHtml, perfText, startPerfLog } from './perflog.ts'
import { HOWWIN_CSS, bannerHtml, closeHowWin, howWinDue, howWinMark, lessons, lossOf, openLessons, showBanner, syncPin, type HowKit, type LessonGo, type Loss } from './howwin.ts'
import type { Side, SyncState } from '../../net/sync.ts'
import { FEEL_CSS, alertFeel, ambushRangeFeel, chanceFeel, envoyFeel, favorFeel, fightFeel, pct5, pctText, plotFeel, unknownFeel } from './feel.ts'
import { nextIdle } from '../../realm/idle.ts'
import { adviseMarch } from './council-lines.ts'
import { cmdPickId } from './cmdpick.ts'
import { APPROACH_SHORT, COUNCIL_ART, councilAgendas, howOf, planChoice, planOrders, takeCount, type Agenda, type AgendaId, type CouncilPlan, type Voice } from './council-agenda.ts'

/** 이름표 표 — 한국어 표는 그대로, 화면만 말에 맞게 (src/i18n/names.ts) */
const GOOD_NAME = nameTable('good', GOOD_NAME_KO)
const BUILD_NAME = nameTable('build', BUILD_NAME_KO)
const UNIT_NAME = nameTable('unit', UNIT_NAME_KO)
const ASK_NAME = nameTable('ask', ASK_NAME_KO)
const ASK_KIND_NAME = nameTable('askKind', ASK_KIND_NAME_KO)
const PLOT_NAME = nameTable('plot', PLOT_NAME_KO)
const APPROACH_NAME = nameTable('approach', APPROACH_NAME_KO)
const REL_NAME = nameTable('rel', { war: '전쟁', neutral: '중립', truce: '화친', ally: '동맹' } as const)

export interface AppHost {
  /** 플레이 기록을 다 지운다(계정·설정은 남김) — 로그인했으면 서버 것부터. 못 지웠으면 false (형 10-24) */
  /** 플레이 기록 지우기 — 다 지웠으면 null(곧 새로고침), 못 지웠으면 까닭 */
  resetPlay?(): Promise<string | null>
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
  /** 지난 판의 계절 기록 — 「나의 역사」 책 (형 11-05: "역사책으로 책장 만들어 준다며") */
  pastHistory?(seed: number): History
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
const INSTALL_SEEN_KEY = 'hanbal.installSeen' // 첫 승리 뒤 한 번 보였다 — 그 뒤로는 「더 보기」의 단추로만 (ftue B11)
const installed = (): boolean => matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches
/** 장의 목표 띠를 접어 두었나 — 이 기기에만 */
const GOAL_FOLD_KEY = 'hanbal.realm.goalfold'
function goalFolded(): boolean {
  try { return localStorage.getItem(GOAL_FOLD_KEY) === '1' } catch { return false }
}
function muted(): boolean {
  try { return localStorage.getItem(MUTE_KEY) === '1' } catch { return false }
}
// 확장자가 이미 붙은 이름(snd() 의 'realm/sfx/x.ogg')엔 또 붙이지 않는다 — 전엔 /.w+$/ 라 「.ogg.ogg」로 받아 깃발·징병·출정 소리가 안 났다 (형 10-24)
const sfxUrl = (name: string): string => `${name.includes('/') ? BASE : SFX}${name}${/\.\w+(#t=[\d.]+)?$/.test(name) ? '' : '.ogg'}`
function ding(name: string, vol = 0.6, rate = 1, dur = 0): void {
  if (muted()) return
  const gain = soundVolume(name.startsWith('realm/voice/') ? 'voice' : 'sfx')
  if (gain > 0) playOnce(sfxUrl(name), vol * gain, rate, dur) // 탭이 가려져 있으면 안 낸다 (규칙 4)
}
/** 곧 낼 소리를 미리 받아 풀어 둔다 — 처음 한 번이 늦게 나지 않게 (싸움이 열릴 때) */
function warmSfx(names: readonly string[]): void {
  if (muted()) return
  for (const n of names) warmOnce(sfxUrl(n))
}
/** 판마다 「?」 단추로 여는 설명 — 판 위에는 고를 것만 두고, 읽을 거리는 여기로 (형 10-23: "설명서를 물음표 버튼 같은 거 하나 만들어서 필요할 때 읽어 볼 수 있게") */
const GUIDE: Readonly<Record<string, { readonly title: string; readonly body: ReadonlyArray<string | ((c: ClockKind) => string)> }>> = {
  paths: { title: tr('guide.paths.title'), body: [
    tr('guide.paths.1'),
    tr('guide.paths.2'),
    tr('guide.paths.3'),
    tr('guide.paths.4'),
    tr('guide.paths.5'),
    tr('guide.paths.6'),
  ] },
  move: { title: tr('guide.move.title'), body: [
    tr('guide.move.1'),
    tr('guide.move.2'),
    tr('guide.move.3'),
    tr('guide.move.4'),
  ] },
  envoy: { title: tr('guide.envoy.title'), body: [
    tr('guide.envoy.1'),
    tr('guide.envoy.2'),
    tr('guide.envoy.3'),
    tr('guide.envoy.4'),
    tr('guide.envoy.5'),
    tr('guide.envoy.6'),
    tr('guide.envoy.7'),
    tr('guide.envoy.8'),
    tr('guide.envoy.9'),
    tr('guide.envoy.10'),
    (c) => tr('guide.envoy.11', { span: spanLabel(c, P.realm.pledgeSeasons) }),
    tr('guide.envoy.12'),
    (c) => tr('guide.envoy.13', { span: tr(monthly(c) ? 'guide.twoYearsMonth' : 'guide.twoYearsSeason') }),
    tr('guide.envoy.14'),
  ] },
  plot: { title: tr('guide.plot.title'), body: [
    tr('guide.plot.1'),
    tr('guide.plot.2'),
    tr('guide.plot.3'),
    tr('guide.plot.4'),
  ] },
  people: { title: tr('guide.people.title'), body: [
    tr('guide.people.1'),
    tr('guide.people.2'),
    tr('guide.people.3'),
    tr('guide.people.4'),
    tr('guide.people.5'),
  ] },
  place: { title: tr('guide.place.title'), body: [
    tr('guide.place.1'),
    tr('guide.place.2'),
    tr('guide.place.3'),
    tr('guide.place.4'),
  ] },
  post: { title: tr('guide.post.title'), body: [
    tr('guide.post.1'),
    tr('guide.post.2'),
    tr('guide.post.3'),
    tr('guide.post.4'),
  ] },
  jail: { title: tr('guide.jail.title'), body: [
    tr('guide.jail.1'),
    tr('guide.jail.2'),
    tr('guide.jail.3'),
  ] },
  // 출정의 「어떻게」 — 판 위에는 이름과 판세만, 뜻은 여기 (형 10-27: "출정 보낼 때 어떻게에 텍스트가 너무 많음 · 획기적으로 줄이고 물음표")
  march: { title: tr('guide.march.title'), body: [
    ...(Object.keys(APPROACH_NAME) as Array<keyof typeof APPROACH_NAME>).map((k) => `${APPROACH_NAME[k]}: ${APPROACH_DOES[k].gain}. ${APPROACH_DOES[k].risk}.`),
    tr('guide.march.1'),
    tr('guide.march.2'),
    tr('guide.march.3'),
    tr('guide.march.4'),
  ] },
  draft: { title: tr('guide.draft.title'), body: [
    tr('guide.draft.1'),
    tr('guide.draft.2'),
    tr('guide.draft.3'),
    tr('guide.draft.4'),
    tr('guide.draft.5'),
    tr('guide.draft.6'),
    tr('guide.draft.7'),
  ] },
  scout: { title: tr('guide.scout.title'), body: [
    tr('guide.scout.1'),
    tr('guide.scout.2', { n2: P.realm.scoutTowns2, n3: P.realm.scoutTowns3 }),
    tr('guide.scout.3'),
    tr('guide.scout.4'),
  ] },
}
const guideBtn = (k: string): string => `<button class="qi" data-act="guide" data-k="${k}" aria-label="${tr('guide.open')}">?</button>`
const PRACTICE: string = (import.meta.env?.BASE_URL ?? '/') + 'night.html?practice=1'
/** night.html 이 올라갔다 (f9e77aa) — 없는 쪽으로 보내지 않으려 둔 스위치 */
const PRACTICE_READY = true
const NIGHT: string = (import.meta.env?.BASE_URL ?? '/') + 'night.html'
/** 2장 송양의 활쏘기 겨루기 — 낮의 과녁판 (형 10-25: "암살 스테이지면 안 되는 거 아님??") */
const CONTEST: string = (import.meta.env?.BASE_URL ?? '/') + 'contest.html'
/** 사건 카드 「바다 도적」의 맞선다 — 바다도적 막기 판 (docs/realm/SNIPE.md §0-9 · 형 11-08) */
const PIRATE: string = (import.meta.env?.BASE_URL ?? '/') + 'pirate.html'
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
  persuade: tr('join.persuade'), wanderer: tr('join.wanderer'), expedition: tr('join.expedition'),
  exile: tr('join.exile'), grown: tr('join.grown'), join: tr('join.join'),
}
/** 한 계절에 띄우는 등용 장면 수 — 넘치면 나머지는 계절 기록으로 */
const JOIN_SCENES_MAX = 4
/** 배우는 판의 단계 이름 — CSS 로는 2.4초에 걷힌다. 애니메이션이 안 끝나도 이때는 걷힌다 (ms) */
const TUT_CAP_MAX_MS = 3000
/** 도감 알림이 아무리 늦어도 걷히는 때 (ms) — CSS 로는 5.5초에 걷힌다 */
const DEX_TOAST_MAX_MS = 9000
/**
 * 떴다 스스로 걷히는 알림이 머무는 시간 — 최소 `min`, 글자 수에 비례해 더 (형 11-01: "획득창 너무 빨리 없어짐 · 최소 유지시간 넣고 텍스트 비례해서").
 * 누르면 언제든 바로 걷힌다 (메모리 notices-must-dismiss)
 */
function noticeMs(text: string, min: number = P.realm.noticeMinMs): number {
  const n = text.replace(/\s+/g, '').length
  return Math.min(P.realm.noticeMaxMs, Math.max(min, P.realm.noticeBaseMs + n * P.realm.noticePerCharMs))
}
/** 세로 구도로 따로 그린 장면 그림 (public/realm/event-v) — 세로 화면에선 16:9 가운데 띠만 남아 용 허리만 보였다 (형 10-24) */
const SCENE_V: ReadonlySet<string> = new Set(['event-dream', 'event-newborn', 'event-marriage', 'event-bridal-a', 'event-bridal-b', 'event-bridal-c', 'event-bridal-d'])
/** 큰 장면 바탕 — 가로 그림(--hbg) · 세로 화면이면 세로 그림(--vbg, 있으면) */
const sceneBg = (name: string): string => `--hbg:url('${ART}event/${name}.jpg')${SCENE_V.has(name) ? `;--vbg:url('${ART}event-v/${name}.jpg')` : ''}`
/** 신방 넉 장 — 휘장 너머 그림자 · 풀린 옷고름 · 이불 끝의 발 · 댓돌 위 포개진 신 (그림: realm/event/event-bridal-*) */
const BRIDAL_SHOTS: ReadonlyArray<readonly [string, string]> = [
  ['event-bridal-a', tr('bridal.a')],
  ['event-bridal-b', tr('bridal.b')],
  ['event-bridal-c', tr('bridal.c')],
  ['event-bridal-d', tr('bridal.d')],
]
/** 판을 그린 뒤 다음 계절 지도 그림을 미리 받기까지 (ms) — 그리는 동안 끼어들지 않게 */
const WARM_MS = 1200
const FALL_S = 1.6
/** 싸움 카드 하나가 다 풀리는 데 걸리는 때 — 카드 안 줄들의 가장 늦은 --d 에 한 박자 */
const battleCardSeconds = (html: string): number => Math.max(0, ...[...html.matchAll(/--d:([\d.]+)s/g)].map((m) => Number(m[1]))) + 0.8
/** 지도 보기 켜고 끄기 — 겹마다 이름과 무엇인지 */
const LAYERS = [
  { id: 'terr', name: tr('layer.terr.name'), hint: tr('layer.terr.hint') },
  { id: 'roads', name: tr('layer.roads.name'), hint: tr('layer.roads.hint') },
  { id: 'marches', name: tr('layer.marches.name'), hint: tr('layer.marches.hint') },
  { id: 'labels', name: tr('layer.labels.name'), hint: tr('layer.labels.hint') },
  { id: 'flags', name: tr('layer.flags.name'), hint: tr('layer.flags.hint') },
  { id: 'goods', name: tr('layer.goods.name'), hint: tr('layer.goods.hint') },
  { id: 'force', name: tr('layer.force.name'), hint: tr('layer.force.hint') },
  { id: 'army', name: tr('layer.army.name'), hint: tr('layer.army.hint') },
] as const
type LayerId = (typeof LAYERS)[number]['id']
const LAYER_KEY = 'hanbal.realm.layers'
const HAND_NAME = { dead: tr('hand.dead'), wounded: tr('hand.wounded'), fled: tr('hand.fled'), withdrew: tr('hand.withdrew'), cleared: tr('hand.cleared'), skip: tr('hand.skip') } as const
/** 구출의 손 — 데려 나왔나 · 북이 울렸나 (형 10-26) */
const RESCUE_HAND_NAME = { dead: '', wounded: '', fled: tr('hand.rescue.fled'), withdrew: tr('hand.withdrew'), cleared: tr('hand.rescue.cleared'), skip: tr('hand.rescue.skip') } as const
/** 공작 결과 큰 화면의 그림 — 공작마다 제 그림 (구출은 10-26 제미나이 Argon) */
const plotArt = (op: PlotOp): string => `event-plot-${op}`

type Ask = EnvoyAsk
type Envoy = Extract<Order, { kind: 'envoy' }>
type Sheet =
  | { kind: 'army' } | { kind: 'draft' } | { kind: 'people' } | { kind: 'diplo' } | { kind: 'scout' } | { kind: 'nation' } | { kind: 'help' }
  | { kind: 'node'; id: string } | { kind: 'heroes' } | { kind: 'hero'; id: string } | { kind: 'log' } | { kind: 'place' } | { kind: 'market' }

/** 지금 사이가 뜻하는 것 — 나라 카드 밑 한 줄 */
const REL_NOW = {
  war: tr('rel.now.war'),
  neutral: tr('rel.now.neutral'),
  truce: tr('rel.now.truce'),
  ally: tr('rel.now.ally'),
} as const
/** 자세한 것이 필요한 사신 — goods: 곡식·철 · place: 고을 · confirm: 다짐 */
const ASK_NEEDS: Partial<Record<Ask, 'goods' | 'place' | 'confirm'>> = { trade: 'goods', gift: 'goods', aid: 'goods', tribute: 'goods', joint: 'place', troops: 'place', break: 'confirm' }
/** 집이 느는(주는) 까닭 — economy.hhGrowth 의 열쇠 */
const GROWTH_WHY: Readonly<Record<string, string>> = {
  crowded: tr('why.crowded'), uprooted: tr('why.uprooted'),
  fed: tr('why.fed'), hunger: tr('why.hunger'), post: tr('why.post'), settle: tr('why.settle'), full: tr('why.full'), threat: tr('why.threat'),
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
const recSt = (): string => `<i class="recst">${tr('rec.badge')}</i>`
/** 아래 탭 — more 는 길게 누르면 뜨는 말 (tips.ts) */
/** 탭 한 칸 — 이름과 긴 설명은 말 표에서 (그릴 때 읽는다) */
const tabDef = <I extends 'army' | 'draft' | 'people' | 'diplo' | 'heroes' | 'nation'>(id: I, ic: string) => ({
  id, icon: ic,
  get name(): string { return tr(`tab.${id}`) },
  get more(): string { return tr(`tab.${id}.more`) },
})
const TABS = [
  tabDef('army', 'unit-shield-wall'),
  tabDef('draft', 'unit-spear'),
  // 백성 — 개척·이주 (형: "군사징병이랑 개척 좀 확실히 구분필요함")
  tabDef('people', 'settle-farm-village'),
  tabDef('diplo', 'good-tribute-bell'),
  // 장수 탭 — 첫 칸 「명령」에 장수에게 시키는 일을 모았다 (형 10-25: "명령 탭은 장수 탭이어야 하는 거 아님?")
  tabDef('heroes', 'unit-general'),
  tabDef('nation', 'settle-capital'),
] as const

/**
 * 「명령」 탭의 일 여섯 — 고르면 그림 깔린 창에서 장수와 갈 곳을 고른다 (형 10-25: "성주 배치·군사 지휘·사신·자객도 혼인·원정처럼 제대로 된 창으로").
 * stat 은 그 일에 먹히는 능력치 — 장수 고르는 칸에 보이고, 가장 높은 이를 먼저 골라 둔다. ruler — 군주도 할 수 있는 일
 */
type CmdJob = 'post' | 'lead' | 'envoy' | 'plot' | 'exp' | 'wed'
const CMD_JOBS: ReadonlyArray<{ id: CmdJob; name: string; icon: string; art: string; line: string; stat: ReadonlyArray<'mu' | 'tong' | 'ryak' | 'chi' | 'deok'>; ruler: boolean }> = [
  { id: 'post', get name() { return tr('cmdj.post') }, icon: 'settle-capital', art: 'event-festival', get line() { return tr('cmdj.postLine') }, stat: ['chi', 'ryak', 'deok'], ruler: false },
  { id: 'lead', get name() { return tr('cmdj.lead') }, icon: 'unit-general', art: 'event-relief-cavalry', get line() { return tr('cmdj.leadLine') }, stat: ['mu', 'tong'], ruler: false },
  { id: 'envoy', get name() { return tr('cmdj.envoy') }, icon: 'good-tribute-bell', art: 'event-outside-envoy', get line() { return tr('cmdj.envoyLine') }, stat: ['deok'], ruler: false },
  // 공작 — 소문·이간·매수·방화·첩자·암살 (형 10-25: "자객이 아니라 공작 · 공작 속에 여러 가지가 있다")
  { id: 'plot', get name() { return tr('cmdj.plot') }, icon: 'plot-schemes', art: 'event-spy-rumor', get line() { return tr('cmdj.plotLine') }, stat: ['ryak'], ruler: false },
  { id: 'exp', get name() { return tr('cmdj.exp') }, icon: 'route-searoute', art: 'event-expedition-return', get line() { return tr('cmdj.expLine') }, stat: ['mu', 'ryak', 'deok'], ruler: true },
  { id: 'wed', get name() { return tr('cmdj.wed') }, icon: 'status-alliance', art: 'event-marriage', get line() { return tr('cmdj.wedLine') }, stat: [], ruler: true },
]
/** 군주가 친히 이끌 때(친정) 거는 것 — 군대 판·지도 띠의 장수 고르기가 같은 말 */
const RULER_LEAD_TIP = tr('cmdj.rulerLead')

/**
 * 처음 하는 사람에게는 탭을 계절마다 하나씩 연다 — 첫 화면에 탭 여섯·장수·외교·사건이 한꺼번에 쏟아져 무엇부터 할지 몰랐다
 * (형 10-24: 동료 플레이 "정보가 한 번에 많이 들어와서 뭐가 뭔지 전혀 이해가 안 됨" · 문명처럼 하나씩).
 * 한 판이라도 이긴 사람(배우는 판 빼고)은 처음부터 다 열린다.
 */
const TAB_OPEN_AT: Readonly<Record<(typeof TABS)[number]['id'], number>> = { army: 0, draft: 0, nation: 0, heroes: 1, diplo: 2, people: 3 }
/** 새로 열린 탭의 한 줄 (없으면 빈 글) */
const tabNewLine = (id: (typeof TABS)[number]['id']): string => (id === 'heroes' || id === 'diplo' || id === 'people' ? tr(`tab.new.${id}`) : '')

const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const span = (lo: number, hi: number, f: (x: number) => string): string => (f(lo) === f(hi) ? f(lo) : `${f(lo)}~${f(hi)}`)
const icon = (name: string, cls = 'ic'): string => `<img class="${cls}" src="${ART}icon/${name}.png" alt="">`
/** 드는 값 칩 — 붉은 ▼ 와 물건 그림과 수. per 는 「계절마다」처럼 앞에 붙는 말 */
function costHtml(g: Partial<Record<'grain' | 'iron' | 'wood' | 'salt' | 'horse', number>>, per = ''): string {
  const parts = (['grain', 'iron', 'wood', 'salt', 'horse'] as const).filter((k) => (g[k] ?? 0) > 0)
    .map((k) => `<b class="cg" title="${GOOD_NAME[k]} ${g[k]}"><i>▼</i>${icon(GOOD_ICON[k], 'cgi')}${g[k]}</b>`)
  return parts.length === 0 ? '' : `<span class="cost">${per !== '' ? `<small>${per}</small>` : ''}${parts.join('')}</span>`
}
/** 얻는 것 — 비용(▼ 붉게)의 짝 (▲ 푸르게) · ODDS.md 원칙 3 "무엇을은 늘 또렷하게" */
function gainHtml(g: Partial<Record<'grain' | 'iron' | 'wood' | 'salt' | 'horse', number>>): string {
  const parts = (['grain', 'iron', 'wood', 'salt', 'horse'] as const).filter((k) => (g[k] ?? 0) > 0)
    .map((k) => `<b class="gg" title="${GOOD_NAME[k]} ${g[k]}"><i>▲</i>${icon(GOOD_ICON[k], 'cgi')}${g[k]}</b>`)
  return parts.length === 0 ? '' : `<span class="gain">${parts.join('')}</span>`
}
/** 물건 아닌 것 — 수확·사기·정·집·경계·호감·장수. 좋으면 ▲ 푸르게 · 나쁘면 ▼ 붉게 (costHtml·gainHtml 과 같은 꼴) */
const fxChip = (good: boolean, ic: string, text: string): string =>
  `<span class="${good ? 'gain' : 'cost'}"><b class="${good ? 'gg' : 'cg'}" title="${esc(text)}"><i>${good ? '▲' : '▼'}</i>${icon(ic, 'cgi')}${esc(text)}</b></span>`
/** 재해의 세기 — 불꽃 셋 가운데 켜진 수 (작은 1 · 보통 2 · 큰 3) · 꾹 누르면 말로 (형 11-05: "재해 강도를 표시하면서") */
const sevPips = (sev: 1 | 2 | 3 | undefined): string => sev === undefined ? '' : `<i class="sevp s${sev}" data-tip="${tr(sev === 1 ? 'sev.1' : sev === 3 ? 'sev.3' : 'sev.2')}">${[1, 2, 3].map((k) => `<u class="${k <= sev ? 'on' : ''}"></u>`).join('')}</i>`
const signed = (n: number): string => (n > 0 ? `+${n}` : `${n}`)
/** 걸리는 때 칩 — 사거나 고르는 것이 다음 달에 바로 되지 않으면 몇 달인지 (형 11-04: "다음 턴에 발생하는 거 아니면 몇 달 걸리는지 다 제대로 써 줘야") */
const whenChip = (label: string): string => `<span class="whenc" title="${tr('when.title')}"><b>⏳${esc(label)}</b></span>`
/** 사건 답 한 갈래가 하는 일 — 아이콘과 숫자로 (형 10-25: "얻게 되거나 잃게 되는 거 이미지랑 숫자로 확실하게" · ODDS 원칙 3) */
function fxHtml(r: Realm, fx: CardFx): string {
  const g = fx.grain ?? 0
  const n = fx.iron ?? 0
  let h = gainHtml({ grain: Math.max(0, g), iron: Math.max(0, n) }) + costHtml({ grain: Math.max(0, -g), iron: Math.max(0, -n) })
  if (fx.harvest !== undefined && fx.harvest !== 1) {
    const d = Math.round((fx.harvest - 1) * 100)
    h += fxChip(d > 0, 'status-autumn', tr('fx.harvest', { d: signed(d) }))
  }
  if (fx.morale !== undefined) h += fxChip(fx.morale > 0, fx.morale > 0 ? 'status-morale-up' : 'status-morale-down', tr('fx.morale', { d: signed(Math.round(fx.morale * 100)) }))
  if (fx.bond !== undefined) h += fxChip(fx.bond > 0, fx.bond > 0 ? 'mood-warm' : 'mood-angry', tr('fx.bond', { d: signed(fx.bond) }))
  for (const [id, d] of fx.bonds ?? []) h += fxChip(d > 0, d > 0 ? 'mood-warm' : 'mood-angry', tr('fx.bondHero', { name: r.heroes[id]?.name ?? '', d: signed(d) }))
  // 맞수의 원한이 풀린다 (위원회 11-04 역사 ①)
  if (fx.soothe !== undefined) h += fxChip(true, 'mood-calm', tr('fx.soothe', { name: r.heroes[fx.soothe]?.name ?? '' }))
  // 두 장수 사이 (친밀 · 위원회 11-04 F7·F12)
  for (const [a, b, d] of fx.ties ?? []) h += fxChip(d > 0, d > 0 ? 'mood-warm' : 'mood-angry', tr('fx.tie', { a: r.heroes[a]?.name ?? '', b: r.heroes[b]?.name ?? '', d: signed(d) }))
  const hh = (fx.hurt ?? []).reduce((a, [, d]) => a + d, 0)
  if (hh > 0) h += fxChip(false, 'settle-hamlet', tr('fx.homesDown', { n: hh }))
  if (fx.watch !== undefined) h += fxChip(true, 'settle-beacon', tr('fx.watch', { n: Math.round(fx.watch * 100) }))
  for (const fv of fx.favor ?? []) {
    if (fv.to.length === 0) continue
    const who = fv.to.length === 1 ? r.factions[fv.to[0]!]?.name ?? '' : tr(fx.favor!.length > 1 ? 'fx.otherNations' : 'fx.nearNations')
    h += fxChip(fv.d > 0, fv.d > 0 ? 'mood-joy' : 'mood-angry', tr('fx.favor', { who, d: signed(fv.d) }))
  }
  if (fx.foe !== undefined) h += fxChip(true, 'war-broken-banner', tr('fx.foe', { name: r.factions[fx.foe.faction]?.name ?? '', n: Math.round(fx.foe.d * 100) }))
  if (fx.join !== undefined) h += fxChip(true, 'unit-general', tr('fx.newHero'))
  // 제천 대회 — 이름난 궁수가 찾아온다 · 남의 장수의 마음이 기운다
  if (fx.wander !== undefined) h += fxChip(true, 'unit-archer', tr('fx.wander', { name: HERO_POOL.find((x) => x.id === fx.wander)?.name ?? '' }))
  if (fx.lean !== undefined) h += fxChip(true, 'mood-warm', tr('fx.lean', { name: r.heroes[fx.lean[0]]?.name ?? '' }))
  if (fx.wed !== undefined) h += fxChip(true, 'mood-warm', tr('fx.wed'))
  const up = (fx.gain ?? []).reduce((a, [, d]) => a + d, 0)
  if (up > 0) h += fxChip(true, 'settle-hamlet', tr('fx.homesUp', { n: up }))
  if (fx.stat !== undefined) h += fxChip(true, 'unit-general', `${r.heroes[fx.stat[0]]?.name ?? ''} ${STAT_NAME[fx.stat[1]]} +${fx.stat[2]}`)
  // 아무 일 없음 — 글 대신 「곡식 0」 그림 칩 (형 10-26: "아무 일 없는 건 텍스트로 하지 말고 0 으로 이미지화")
  return h === '' ? `<span class="cnone"><b class="gz" title="${tr('fx.none')}">${icon(GOOD_ICON.grain, 'cgi')}0</b></span>` : h
}
/** 큰 얼굴 — 900px 판이 있으면 그것 (알현처럼 화면 가득일 때) · 900px 판이 없는 얼굴(아이 · 몇 군주)은 320px 판으로 갈아 낀다
 *  (형 10-27: "우리 밀정 누가 갔는지 얼굴이 안 보이는데 — 찌그러진 빈 타원 동그라미밖에 없음" — 없는 bust-hd 를 불러 빈 그림이 떴다) */
const bustHd = (h: Hero | undefined, cls: string): string =>
  h !== undefined && faceFile(h.id) !== undefined
    ? `<img class="${cls}" src="${ART}bust-hd/${faceFile(h.id)}.jpg" onerror="this.onerror=null;this.src='${ART}bust/${faceFile(h.id)}.jpg'" alt="">`
    : ''
/** 정사각 판으로 만든 숨 쉬는 영상이면 ' sq' — 가운데 정사각만 오린다 (awaken-art AWAKEN_LOOP_SQ) */
const sqCls = (u: string | null): string => (u !== null && u.endsWith('.sq.mp4') ? ' sq' : '')
/**
 * 숨 쉬는 영상의 src — 판이 하나면 loop, 여럿이면 data-takes 로 번갈아 (끝나면 다음 판 · 아래 'ended' 듣기)
 * (형 11-08: "두 종류 다 나쁘지 않으니 두 개가 번갈아 나오도록")
 */
const takeAttrs = (takes: readonly string[]): string => takes.length > 1 ? `src="${takes[0]}" data-takes="${takes.join('|')}"` : `src="${takes[0]}" loop`
/**
 * 마을 안을 오갈 때의 카메라 — 지도(.map)를 그 고을 자리를 축으로 늘린다(tvdive 파고듦 · tvrise 물러남 · townview TOWN_CSS).
 * 저사양이면 지도를 늘리지 않고 막만 (메모리 mobile-gpu-layer-limit) · 고을이 없으면 아무것도 안 한다
 */
function townCam(nd: HTMLElement | null | undefined, cls: 'tvdive' | 'tvrise'): HTMLElement | null {
  const map = nd?.closest<HTMLElement>('.map')
  if (nd == null || map == null || map.closest('.q-low') !== null) return null
  map.classList.remove('tvdive', 'tvrise')
  map.style.setProperty('--ox', nd.style.left || '50%')
  map.style.setProperty('--oy', nd.style.top || '50%')
  map.style.setProperty('--ds', String(P.realm.townDiveScale))
  // 고을이 화면 가운데로 오며 다가간다 — 축은 고을 자리라 옮김만 더하면 고을이 칸 가운데에 닿는다
  const nb = nd.getBoundingClientRect()
  const wb = (map.parentElement ?? map).getBoundingClientRect()
  map.style.setProperty('--dx', `${(wb.left + wb.width / 2 - (nb.left + nb.width / 2)).toFixed(0)}px`)
  map.style.setProperty('--dy', `${(wb.top + wb.height / 2 - (nb.top + nb.height / 2)).toFixed(0)}px`)
  map.style.setProperty('--tz', `${P.realm.townZoomMs}ms`)
  map.style.setProperty('--tf', `${P.realm.townFadeMs}ms`)
  void map.offsetWidth // 같은 이름을 다시 걸어도 처음부터 돌게
  map.classList.add(cls)
  if (cls === 'tvrise') map.addEventListener('animationend', () => map.classList.remove('tvrise'), { once: true })
  return map
}
const bust = (h: Hero | undefined, cls = 'face'): string =>
  h !== undefined && faceFile(h.id) !== undefined ? `<img class="${cls}" src="${ART}bust/${faceFile(h.id)}.jpg" alt="">` : `<span class="${cls} noface"></span>`
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
    : region === 'jumong' ? [...JUMONG_NATIONS, HAENGIN_NATION] : region === 'mahan' ? MAHAN_NATIONS : region === 'seorabeol' ? SEORA_NATIONS : region === 'gujibong' ? GUJI_NATIONS : region === 'daemusin' ? DAEMUSIN_NATIONS : NATIONS)
/** 「나의 역사」의 판 이름 · 옛 기록의 나라 이름 (판마다 같은 id 면 앞 것) */
const BOARD_NAME_OF: Readonly<Record<string, string>> = Object.fromEntries(BOARDS.map((b) => [b.id, b.name]))
const FACTION_NAME_OF: Readonly<Record<string, string>> = Object.fromEntries((['byeonhan-mini', 'yeongnam', 'south', 'world', 'tutorial', 'mahan', 'jumong', 'seorabeol', 'gujibong', 'daemusin'] as const).flatMap((rg) => nationsOf(rg).map((n) => [n.id, n.name] as const)).reverse())

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
  const file = hid !== undefined ? faceFile(hid) : undefined
  return file !== undefined ? `<img class="${cls}" src="${ART}bust/${file}.jpg" alt="">` : ''
}

/** 도감(dex.ts)이 쓰는 그림 손 */
const DEX_KIT = {
  esc,
  bust: (id: string): string | null => (faceFile(id) !== undefined ? `${ART}bust/${faceFile(id)}.jpg` : null),
  kid: (key: string, look: 'g' | 'w', traits?: readonly string[]): string | null => { const f = kidBust(key, look, traits); return f !== undefined ? `${ART}bust/${f}.jpg` : null },
  grow: (id: string): { lv: number; relics: string } => ({ lv: drillLevel(id), relics: relicChips(ART, esc, wornBy(id)) }),
  awake: (id: string): string | null => { const b = bustOf(id); return b !== undefined && AWAKEN_ART.has(b) ? `${ART}awaken-hd/${b}.jpg` : null },
  awakeLoop: (id: string): string | null => { const b = bustOf(id); return b !== undefined && AWAKEN_LOOP.has(b) ? `${ART}${loopFile(b)}` : null },
}

/** 처음 몸 — 영웅전 명부 · 가문의 아이 (단련터 · 동행 고르기의 단련 몸) */
const drillBody = (id: string): Hero | undefined => dexCatalog().find((x) => x.id === id)?.hero ?? clanHeroes().find((x) => x.id === id)?.hero
/** 유물(relics.ts)이 쓰는 그림 손 — 장수 이름은 명부 · 단련 기록에서 */
const RELIC_KIT: RelicKit = { art: ART, esc, nameOf: (id: string): string => drillBody(id)?.name ?? loadDrill().h[id]?.name ?? id }
/** 단련터(drill.ts)가 쓰는 그림 손 */
const DRILL_KIT: DrillKit = {
  esc,
  bust: (id: string): string | null => (faceFile(id) !== undefined ? `${ART}bust/${faceFile(id)}.jpg` : null),
  bustHd: (id: string): string | null => (faceFile(id) !== undefined ? `${ART}bust-hd/${faceFile(id)}.jpg` : null),
  bodyOf: drillBody,
  /** 단련터 목록의 거르기 갈래 — 나라 · 등급 · 각성 (영웅전 기록) */
  meta: (id: string) => {
    const x = dexCatalog().find((c) => c.id === id)
    if (x === undefined) return { nation: tr('dy.kin'), grade: null, awake: false }
    return { nation: x.board === 'wander' ? tr('dy.wanderer') : x.nationName, grade: x.grade, awake: ((loadDex()[id]?.f ?? 0) & DEX_AWOKE) !== 0 }
  },
  relic: RELIC_KIT,
}

/** 판의 앞과 끝(front.ts)이 쓰는 그림 손 */
const KIT: FrontKit = {
  art: ART, esc, icon, nations: nationsOf, face: nationFace, boardRuler,
  emblem: (f, cls) => emblem(f, cls),
  bust: (id) => (faceFile(id) !== undefined ? `${ART}bust/${faceFile(id)}.jpg` : null),
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
  readonly clock?: 'month'
  readonly current: boolean
  /** 판의 시드 — 「나의 역사」 책을 펼칠 때 그 판의 기록을 찾는다 */
  readonly seed?: number
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
  style.textContent = FIT_CSS + MQ_CSS + TIP_CSS + FIRST_CSS + UPDATE_CSS + APP_CSS.replaceAll('__ART__', ART) + LOG_CSS + TINT_CSS + MOOD_CSS + AUD_CSS.replaceAll('__ART__', ART) + MAP_CSS.replaceAll('__ART__', ART) + FEEL_CSS + BATTLE_CSS + WAR_CSS.replaceAll('__ART__', ART) + SKFX_CSS.replaceAll('__ART__', ART) + HERO_CSS.replaceAll('__ART__', ART) + GROW_CSS + WOO_CSS.replaceAll('__ART__', ART) + TALK_CSS.replaceAll('__ART__', ART) + DEX_CSS.replaceAll('__ART__', ART) + BOND_CSS + LEGACY_CSS + DRILL_CSS.replaceAll('__ART__', ART) + RELIC_CSS.replaceAll('__ART__', ART) + CLOUD_CSS + WINFX_CSS + SAVE_CSS + (FRONT_CSS + SEASONP_CSS + UI_CSS + GOAL_CSS).replaceAll('__ART__', ART) + HOWWIN_CSS + QUALITY_CSS + VOLUME_CSS + MEM_CSS + ASCEND_CSS.replaceAll('__ART__', ART) + HILITE_CSS + TOWN_CSS.replaceAll('__ART__', ART) + RISE_CSS + BOOK_CSS + CROWN_CSS + LEAGUE_CSS + WONDER_CSS
  document.head.appendChild(style)
  root.classList.add('ap')
  // 그래픽 단계 저사양 · 보통 · 고사양 (quality.ts · 형 10-29: 폰 절전 모드에서 그림이 다 깨졌다)
  startQuality(root, (h) => goToast(h))
  // 끊김 기록 — 긴 작업이 난 순간 맨 위에 뜬 화면 (perflog.ts · 형 11-11 "어떤 상황에서 프레임 드랍 되는지")
  startPerfLog(root, () => {
    if (document.documentElement.classList.contains('duel-open')) return '겨루기'
    const top = root.querySelector<HTMLElement>(':scope > :is(.nightov, .wr, .cere, .stov, .townov, .dpov, .bview)')
    const size = realm !== null ? ` · 고을${Object.values(realm.nodes).filter((n) => n.owner === realm!.player).length}/${Object.keys(realm.nodes).length} · 계절${realm.season}` : ''
    if (top !== null) return `${top.className.split(' ').slice(0, 3).join('.')}${top.classList.contains('wr') && top.querySelector('.wfield.fin, .winfx') !== null ? '(결과)' : ''}${size}`
    return `지도${sheet !== null ? ':' + sheet.kind : ''}${root.classList.contains('modal-open') ? ':상자' : ''}${size}`
  })
  installTips(root)
  // 숨 쉬는 각성 영상 — 탭이 숨으면 멈추고 돌아오면 다시 (절대 규칙 4 · 배터리)
  document.addEventListener('visibilitychange', () => {
    for (const v of root.querySelectorAll<HTMLVideoElement>('video[loop]')) {
      if (document.visibilityState === 'visible') void v.play().catch(() => undefined)
      else v.pause()
    }
  })
  // 숨 쉬는 각성 영상의 소리 — 영상에 든 음악·효과음을 함께 낸다 (형 11-05: "같이 들려도 상관없다 · 효과음 같이 들어 있어서 좋다").
  // 소리 끄기면 끈 채로 · 브라우저가 소리를 막으면(아직 아무것도 안 누른 판) 끈 채로라도 돈다 · 여럿이면 새로 뜬 것 하나만 소리 (겹치지 않게)
  const voiceLoop = (v: HTMLVideoElement): void => {
    if (v.dataset['quiet'] !== undefined) return
    if (muted()) return
    for (const o of root.querySelectorAll<HTMLVideoElement>('video[loop]')) if (o !== v) o.muted = true
    v.volume = P.realm.loopVolume * soundVolume('sfx')
    v.muted = false
    void v.play().catch(() => { v.muted = true; void v.play().catch(() => undefined) })
  }
  new MutationObserver((ms) => {
    for (const m of ms) for (const n of m.addedNodes) {
      const v = n instanceof HTMLVideoElement ? n : n instanceof HTMLElement ? n.querySelector<HTMLVideoElement>('video[loop]') : null
      if (v !== null && v.loop) voiceLoop(v)
    }
  }).observe(root, { childList: true, subtree: true })
  /** 오프닝이 도는 동안 판 음악은 쉰다 (오프닝이 제 음악을 깐다) */
  let openingOn = false
  /** 배경 음악 · 계절 바람 — 싸움 창이 열려 있으면 싸움 음악 */
  const music = makeMusic(BASE, muted, () => root.querySelector('.nightov') !== null || openingOn, () => soundVolume('bgm')) // 밤 판·오프닝이 떠 있으면 조용히 — 밤 판은 제 소리를 낸다
  let warOn = false
  /** 줄 서 있거나 떠 있는 장면(사로잡음·등용·혼례…) 수 — 각성 연출은 이것이 다 걷힌 뒤에 (playScenes) */
  let scenesLeft = 0
  /** 이번 넘김에 전장에서 본 싸움의 열쇠 (battle line key) */
  let warWatched = new Set<string>()
  root.innerHTML = `<header class="top"></header><div class="mapwrap"></div><div class="seasonp" aria-hidden="true">${seasonParticles()}</div><div class="legend"></div><div class="zbtns"><button data-act="layers" class="lyb" aria-label="보기">👁</button><button data-act="zin">＋</button><button data-act="zout">－</button></div><div class="layers"></div><button class="next" data-act="next"></button><div class="todo"></div><div class="selbar"></div><div class="roadkey"></div><div class="tutband"></div><div class="goalb"></div>`
    + `<nav class="tabs"></nav><div class="back" data-act="close"></div><section class="sheet"></section><div class="modal"></div><div class="plbox"></div>`
  const $ = (sel: string): HTMLElement => root.querySelector<HTMLElement>(sel)!
  const zoom = attachZoom($('.mapwrap'))
  // 배우는 판의 빛낼 곳 — 단계마다 갈아 끼우는 <style> (tutorial.ts)
  const tutSheet = document.createElement('style')
  tutSheet.textContent = ''
  document.head.appendChild(tutSheet)
  const tutBase = document.createElement('style')
  tutBase.textContent = tutCss()
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
  // 군대 말을 꾹 누르면 그 군대의 설명 창 — 손을 떼면 걷힌다 (형 10-31 z축 · ZAXIS-1031 4단계 · 전장과 같은 상자 holdbox.ts)
  const mapHold = holdBox(root, () => P.realm.mapHoldLingerMs)
  const tokPress = longPress($('.mapwrap'), (t) => t.closest<HTMLElement>('.tok[data-army]'), {
    holdMs: () => P.realm.mapHoldMs,
    slop: () => P.realm.mapHoldSlop,
    onHold: (el, x, y) => {
      const a = realm?.armies[el.dataset['army'] ?? '']
      if (realm === null || a === undefined) return false
      mapHold.show(armyHoldHtml(realm, a, el.dataset['act'] === 'foetok'), x, y)
      { const s = tapSlot('hold'); if (s !== null) ding(snd(s), 0.15) } // 튀어나올 때 작은 소리 · 걷힐 때는 소리 없이 (ZAXIS-1031 7단계)
      return true
    },
    onEnd: () => mapHold.hide(),
  })
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
  const pick: Record<string, { edge: string; ambush: boolean; approach?: Approach; ration?: Ration; goal?: string; rally?: boolean; follow?: boolean; adviser?: string } | undefined> = {}
  /** 먼 갈 곳을 거둔 군대 — 이번 계절 「머문다」를 눌렀다 (형 10-25 · goal.ts) */
  let goalStop: string[] = []
  /** 이번 계절 큰 화면으로 본 땅의 바뀜 — `계절:고을` (확인을 눌렀다) */
  const landSeen = new Set<string>()
  /** 이번 턴 보낼 정찰꾼 — 고을마다 하나 · 정찰꾼 수(scouts.scoutCap: 고을 수에 따라 1·2·3)까지 (FOCUS D) */
  let scouts: string[] = []
  /** 정찰꾼이 다 나갔을 때 새로 고른 곳 — 어느 정찰꾼을 거둘지 묻는 동안 (형 11-04: "이미 풀배치면 기존 어디를 빼고 여기 배치하겠냐고 물어봐야") */
  let scoutAsk: string | null = null
  /** 승산 낮은 출정 확인 상자 (PLAYTEST-1112 TOP 1) · warned — 이번 계절 같은 출정은 한 번만 묻는다 */
  let warnAsk: { army: string; pct: string; hero: string | null } | null = null
  const warned = new Set<string>()
  /** 정찰 고정 — 매 계절 저절로 그곳으로 (형 10-23: "정찰을 매 턴 보내야 하는데 지속 정찰로 고정 버튼") · 이 기기에 · 옛 글(고을 하나)도 읽는다 */
  const KEEP_KEY = 'hanbal.realm.scoutKeep'
  let scoutKeep = ((): string[] => { try { return parseScoutKeep(localStorage.getItem(KEEP_KEY)) } catch { return [] } })()
  const setKeep = (v: readonly string[]): void => { scoutKeep = [...v]; try { if (v.length === 0) localStorage.removeItem(KEEP_KEY); else localStorage.setItem(KEEP_KEY, JSON.stringify(v)) } catch { /* 저장 못 하는 곳 */ } }
  /** 소도 제사 — 봄·가을에 한 번 */
  let rite = false
  /** 남의 나라가 걸어온 청에 대한 답 — 답이 없으면 거절로 친다 */
  const answers: Record<string, boolean> = {}
  /** 군대 말을 한 번이라도 눌러 봤나 — 그 전까지만 「명령?」 말풍선 (배운 뒤엔 시끄럽다) */
  const TOK_KEY = 'hanbal.realm.tokTapped'
  let tokTapped = ((): boolean => { try { return localStorage.getItem(TOK_KEY) === '1' } catch { return false } })()
  /** 사건 카드의 자막 몇째 장 — 열쇠는 card:계절 (화면의 일 · 판은 모른다) */
  const cardBeat: Record<string, number> = {}
  /** 바다도적 막기에서 막은 물결 수 — 열쇠는 card:계절 (pirate.html 의 결과 · 있으면 「맞선다」가 굳는다 · SNIPE §0-9) */
  const cardHeld: Record<string, number> = {}
  /** 흠 없이 막은 판 — 열쇠는 card:계절 (두목을 사로잡았다 · 쇠 곱절) */
  const cardPerfect: Record<string, boolean> = {}
  /** 경계를 강화할 우리 고을 */
  let guards: string[] = []
  /** 경계 강화한 고을에서 몸소 고른 지킬 길 — 없으면 지키는 장수에게 맡긴다 (council.guardPick · 형 11-01 「길이 빗겨나감」) */
  let guardAp: Record<string, Approach> = {}
  /** 보고 카드에서 답·경계를 누른 뒤 다시 그릴 때는 싸움 카드를 다시 돌리지 않는다 */
  let fastNext = false
  /** 이번 계절의 사신 — ekey(나라, 청)마다 하나 */
  const envoys: Record<string, Envoy> = {}
  /** 그 나라에 이번 계절 보낸 사신들 */
  const sentTo = (to: string): Envoy[] => Object.values(envoys).filter((e) => e.to === to)
  /** 이번 계절의 공작 (한 턴에 plots.plotCap 개) · 외교 판의 갈래 · 펼친 공작 */
  let plots: Order[] = []
  /** 이번 계절 전략 회의에서 들은 안 — 장수의 기억에 적힌다 (memory.noteMemory · 판은 그대로) */
  let councils: Order[] = []
  /** 장수 명령 — 맡기기 · 이끌기 · 회유 · 떠돌이 들이기 (HEROES §3·§4) */
  let heroOrders: Order[] = []
  /** 「다음 계절」 전에 한 번 물어본 계절 — 쉬는 장수·안 보낸 정찰이 있으면 그 판으로 데려가고, 한 번 더 누르면 넘긴다 (형 10-23) */
  let nudgedAt = -1
  /** 붙잡은 바로 그 턴 — 「그냥 넘긴다」 띠는 그 턴에만 (검토 11-01: 계절 내내 떠서 장수 판을 열면 달이 넘어갔다) */
  let nudgedTurn = -1
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
  /** 열어 둔 옥중 담판 (docs/realm/WOO.md) — 고른 거리 · 손을 내밀었나. 한 마디들은 그 포로의 회유 명령(talk)에 실린다 */
  let wooTalk: { id: string; sel: WooApproach | null; hand: boolean } | null = null
  /** 이번 계절 담판을 마친(맡기거나 확인한) 포로 — 다시 저절로 뜨지 않는다 (초안과 함께 남는다) */
  const wooDone: Record<string, boolean> = {}
  /** 담판이 저절로 뜬 계절 — 한 계절에 하나만 (COUNCIL 결정 10) */
  let wooAutoAt = -1
  /** 고른 세기(난이도) — 판마다. 캠페인의 장은 판 고르기 화면에서 고른다 (없으면 보통 · 군장) */
  const tierPick: Partial<Record<RegionId, number>> = {}
  /** 캠페인의 장에 쓸 세기 — 판 고르기 화면 맨 위 */
  /** 원정 고르는 중 — 장수마다 갈 곳·길이 (명령이 되기 전) */
  const expPick: Record<string, { dest: ExpDest; len: 0 | 1 | 2 }> = {}
  /** 나라 카드에서 "있었던 일"을 다 펼친 나라 */
  const deedsOpen = new Set<string>()
  /** 외교 판에서 펼친 나라 — 접으면 군주 얼굴 · 깃발 · 이름 · 군주 · 탈 · 사이만 (형 10-27: "나라마다 열고 닫을 수 있게") */
  const diploOpen = new Set<string>()
  /** 고을 둘레 고리·고을 판에서 「외교」로 열면 그 나라 칸만 — 비면 모든 나라 (형 11-03: "그 나라 외교창만 떠야 하는 거 아님? 한참 밑으로 내려가야") */
  let diploOnly = ''
  let diploMode: 'envoy' | 'plot' | 'scout' = 'envoy'
  /** 장수 판의 탭 — 우리 장수 · 옥에 가둔 적장 · 적장 (형 10-23: "한 페이지에 다 담지 말고 탭을 나눠야") */
  let heroTab: 'cmd' | 'mine' | 'jail' | 'foe' = 'cmd'
  /** 「명령」에서 연 일 창 — null 이면 일 카드 여섯 · cmdHero 는 그 창에서 고른 장수 ('' 이면 그 일에 가장 맞는 이) */
  let cmdJob: CmdJob | null = null
  /** 판을 열기 전 「데려갈 장수」 팝업 — 고른 판 (형 10-25: "게임 시작할 때 데려갈 장수가 팝업으로 · 영웅전 내 기록의 장수만 · 가능한 수대로 체크") */
  let bringAsk: { nation: string; region: RegionId; tier: number } | null = null
  /** 협공 짝을 마지막으로 울린 때 — 같은 고름엔 한 번만 */
  let pinRung = ''
  /** 거둔 소리를 낸 보고 — 같은 달 보고로 지도를 다시 그려도 한 번만 */
  let haulRung = -1
  /** 뾰로로롱 — 방울을 점점 높게 셋 (형 11-05: "소리가 들려도 되고 · 뾰로로롱") */
  function pinChime(): void {
    P.realm.pinChimeRates.forEach((rate, i) => window.setTimeout(() => ding(snd('tap_bell'), P.realm.pinChimeVol, rate), i * P.realm.pinChimeGapMs))
  }
  /** 이번 계절에 새로 쥔 도읍 — 다음 그림에서 왕관이 날아간다 (crowns.ts) */
  let crownQueue: string[] = []
  /** 나의 역사에서 펼친 책 (그 판의 시드) */
  let bookSeed: number | null = null
  /** 마을 안 (TOWN.md) — 열린 고을 · 처음 그리면 밝아지며 */
  let townIn: string | null = null
  let townFresh = false
  /** 도읍(궁전) 판을 펼쳤나 — 큰 공사·큰 잔치가 선다 */
  let palaceOn = false
  /** 도읍 판의 쪽 — 궁궐·조정 / 큰 공사·큰 잔치 (한 쪽이 한 화면 · 구르지 않는다) */
  let palaceSub: 'hall' | 'works' = 'hall'
  /** 앉힐 장수를 고르는 떴다 사라지는 상자 — 어느 자리 (없으면 닫힘) */
  let seatPick: Seat | null = null
  /** 마을 안에서 고른 터와(빈 터면) 지을 일터 — 화면 고르기일 뿐 판은 「work」 명령으로만 바뀐다 (TOWN.md 11-08) */
  let townPick: { lot: number; what: WorkWhat | null } | null = null
  /** 「완공!」 도장을 찍은 보고 — `${고을}|${계절}` (한 번만) */
  const townStamped = new Set<string>()
  /** 이번에 새로 새긴 단련 공 — 끝 화면이 처음 그려질 때 (drill.engraveRun). 단련터의 막대가 이만큼 차오른다 */
  let drillGain: Record<string, number> = {}
  /** 판이 끝났으면 공을 새긴다 — 몇 번 불러도 한 번만 든다 (무한 모드로 이어 둔 몫만 더) */
  const engraveNow = (r: Realm | null): void => {
    if (r === null || r.outcome == null) return
    const g = engraveRun(r)
    if (Object.keys(g).length > 0) drillGain = g
  }
  /** 단련터를 나선다 — 끝 화면에서 왔으면 끝 화면으로(필름은 건너뛰고 단추부터), 첫 화면에서 왔으면 첫 화면으로 */
  /** 단련터에서 쓸 공이 남은 채 「다음으로」를 한 번 눌렀다 */
  let yardArmed = false
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
  let sortieD: { take: Partial<Record<UnitKind, number>>; hero: boolean; edge: string | null; approach: Approach; ration: Ration | undefined; follow?: boolean; adviser?: string; chose?: Partial<Record<AgendaId, string>>; lead?: string; wait?: boolean; plan?: CouncilPlan; said?: Partial<Record<AgendaId, Array<{ hero: string; how: string; took: boolean }>>> } = { take: {}, hero: true, edge: null, approach: 'road', ration: undefined }
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
  /** 둘레 단추를 펼친 고을 (z축 5·6단계) — 고을을 누르면 큰 판 대신 이것. 군대·개척단을 고르거나 판을 열면 접힌다 */
  let ring = ''
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
  /** 백성 배치 「−」가 막힌 까닭 — 「더 뺄 백성이 없다」 하나로 다 덮으면 꽉 찬 고을이 왜 안 되는지 모른다 (형 11-05: "인구 꽉 찬 합천야로랑 사천은 분배를 할 수가 없잖아") */
  function subWhy(id: string): string {
    const base = realm!
    const n = base.nodes[id]!
    if (n.hh + (placeDraft[id] ?? 0) <= 1) return tr('place.subNone')
    const lim = placeLimit(base, me())
    const grainCap = P.realm.migrateGrain > 0 ? Math.floor(Math.max(0, stockOf(base, me()).grain) / P.realm.migrateGrain) : Infinity
    if (lim <= 0 && grainCap <= 0) return tr('place.subGrain', { n: P.realm.migrateGrain })
    if (monthly(base) && shareOpen(base) < 1) return tr('place.subShareMonth', { turn: turnWord(base), pct: Math.round(P.realm.placeShare * 100) })
    return tr('place.subShare', { pct: Math.round(P.realm.placeShare * 100) })
  }
  function placeStepOf(id: string, add: boolean): number {
    const base = realm!
    const ids = placeNodes(base, me())
    const dd = (x: string): number => placeDraft[x] ?? 0
    const n = base.nodes[id]!
    const now = n.hh + dd(id)
    const step = P.realm.placeStep
    if (add) {
      const pool = -ids.reduce((s, x) => s + dd(x), 0)
      return Math.max(0, Math.min(step, pool, homeRoom(n) - now - inboundOf(n, me())))
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
  let leftCache: { key: string; st: Record<Good, number>; p: Realm } | null = null
  /** 이번 계절 고른 것(징병·장터 저울·곳간 열기 등 musters 까지)을 다 해 본 판 — 한도를 셀 때 (검토 11-04: plan() 은 musters 가 빠져 저울·곳간이 한도를 넘겨 쌓였다) */
  function leftPlan(): Realm { left(); return leftCache!.p }
  function left(): Record<Good, number> {
    const key = JSON.stringify([realm!.season, armyOrders, settles, heroOrders, musters, guards, guardAp, rite, plots, envoys])
    if (leftCache !== null && leftCache.key === key) return leftCache.st
    const p = planned(realm!, [
      // 큰 잔치는 굴림이 든 일이라 미리 해 보지 않는다 — 부을 곡식만 아래에서 뺀다 (결과가 먼저 보이지 않게)
      ...armyOrders, ...settles, ...musters.filter((o) => o.kind !== 'disband' && o.kind !== 'feast'),
      ...guards.map(guardOrder),
      ...heroOrders.filter((o) => o.kind === 'hire' || o.kind === 'assign' || o.kind === 'lead'),
    ])
    const st = Object.fromEntries(GOODS.map((g) => [g, goodOf(p.stock[me()], g)])) as Record<Good, number>
    const pay = (c: { grain: number; iron: number } | null): void => {
      if (c !== null) { st.grain -= c.grain; st.iron -= c.iron }
    }
    if (rite) pay(riteCost(realm!, me()))
    for (const o of plots) if (o.kind === 'plot') pay(plotCost(o.op, o.agent ?? null))
    if (musters.some((o) => o.kind === 'bowUp')) pay(bowUpCost(realm!, me()))
    if (musters.some((o) => o.kind === 'feast')) st.grain -= feastPour(p, me())
    for (const e of Object.values(envoys)) for (const g of GOODS) st[g] -= e.give[g] ?? 0
    // 원정 길 양식 — 계절을 넘길 때 징병·등용 뒤에 치른다. 여기서 안 빼면 「보낼 수 있다」고 해 놓고 말없이 빠진다 (형 10-24)
    for (const o of heroOrders) if (o.kind === 'expedition') st.grain -= P.realm.expGrainPer * EXP_SEASONS[o.len]
    leftCache = { key, st, p }
    return st
  }

  function resetTurn(): void {
    armyOrders = []
    leadPop = ''
    armySel = [] // 지난 계절에 움직인 군대가 다음 계절에 골라진 채로 남지 않게 (형: "전계절에 이동시킨유닛이 자동선택되어있음")
    ring = '' // 고른 고을도 — 다음 달에 둘레 단추가 떠 있던 채로 남았다 (형 11-03)
    clearParty()
    musters = []
    settles = []
    for (const k of Object.keys(pick)) delete pick[k]
    goalStop = []
    // 고정해 둔 곳을 우리가 차지했거나(없어졌거나) 하면 고정은 저절로 풀린다 — 우리 땅은 정찰할 것이 없다
    if (realm !== null) {
      const r = realm
      const kept = scoutKeep.filter((id) => r.nodes[id] !== undefined && r.nodes[id]?.owner !== me())
      if (kept.length !== scoutKeep.length) setKeep(kept)
    }
    // 고정해 둔 곳이 아직 닿으면 그리로 (정찰꾼 수까지) — 아니면 이번 계절은 쉰다(고정은 남는다)
    scouts = realm === null ? [] : scoutKeep.filter((id) => scoutable(realm!).includes(id)).slice(0, scoutCap(realm, me()))
    rite = false
    for (const k of Object.keys(answers)) delete answers[k]
    for (const k of Object.keys(cardHeld)) delete cardHeld[k]
    for (const k of Object.keys(cardPerfect)) delete cardPerfect[k]
    guards = []
    guardAp = {}
    for (const k of Object.keys(envoys)) delete envoys[k]
    plots = []
    councils = []
    for (const k of Object.keys(hands)) delete hands[k]
    heroOrders = []
    wooTalk = null
    for (const k of Object.keys(wooDone)) delete wooDone[k]
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
    const turn = turnWord(r)
    const pair = (k: 'exp' | 'hurt' | 'away' | 'seat' | 'assassin' | 'plot' | 'envoy' | 'expGo' | 'wed' | 'assign' | 'lead' | 'persuade' | 'cohabit' | 'cohabitIn', v: Record<string, string | number> = {}): readonly [string, string] => [tr(`job.${k}.long`, { turn, ...v }), tr(`job.${k}.short`, { turn, ...v })]
    if (ex !== undefined) { const n = Math.max(1, ex.back - r.season + 1); return pair('exp', { turns: turnsLabel(r, n) }) }
    if (h.woundedUntil !== undefined && h.woundedUntil > r.season) { const n = h.woundedUntil - r.season; return pair('hurt', { turns: turnsLabel(r, n) }) }
    if (h.awayUntil !== undefined && h.awayUntil >= r.season) return pair('away')
    const seat = heroSeat(r, id)
    if (seat !== null) return pair('seat', { seat: SEAT_DEFS[seat].name })
    const pl = plots.find((o): o is Extract<Order, { kind: 'plot' }> => o.kind === 'plot' && o.agent === id)
    if (pl !== undefined) return NIGHT_OPS.has(pl.op) ? pair('assassin') : pair('plot', { op: PLOT_NAME[pl.op] })
    const ev = Object.values(envoys).find((e) => e.hero === id)
    if (ev !== undefined) return pair('envoy', { to: r.factions[ev.to]?.name ?? '' })
    for (const o of heroOrders) {
      if (o.kind === 'expedition' && o.hero === id) return pair('expGo')
      if (o.kind === 'wed' && (o.a === id || o.b === id)) return pair('wed')
      if (o.kind === 'assign' && o.hero === id && o.node !== null) return pair('assign', { n: r.nodes[o.node]?.name ?? '' })
      if (o.kind === 'lead' && o.hero === id) return pair('lead')
      if (o.kind === 'persuade' && o.by === id) return pair('persuade')
      if (o.kind === 'cohabit' && o.hero === id) return pair('cohabit')
      // 짝을 맞는 쪽 — 오는 짝을 기다려야 하니 다른 일을 맡으면 안 된다 (형 10-24: "신방에 들이기 해 두면 자꾸 조작 가능하게 보인다")
      if (o.kind === 'cohabit' && r.heroes[o.hero]?.spouse === id) return pair('cohabitIn')
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
   * 이 군대를 지금 이끌 수 있는 우리 장수 — 군대를 이끌지 않고 이번 계절 묶인 일이 없다(다침·자리 비움·사신·원정·다른 일은 heroBusy).
   * 같은 고을이 먼저, 우리 땅으로 이어진 다른 고을의 장수도 든다 — 그 계절은 길에서 와서 이끈다(heroes.ts leadArmy).
   * 고을을 맡은 장수도 든다 — 이끌면 그 자리를 내려놓는다 (형 11-03: "도읍 맡고 있는 장수들은 선택 가능하되 표시 · 자리에 없거나 사신 보내지 않은 이상 쉽게 교체").
   * 군주도 든다(친정). 군대 판의 「이끌 장수」와 지도 띠의 장수 고르기가 같은 셈을 쓴다
   */
  function leadCands(r: Realm, a: Army): Hero[] {
    const ours = r.nodes[a.at]?.owner === me()
    const can = (x: Hero): boolean => x.faction === me() && x.status === 'free' && x.at !== null && !Object.values(r.armies).some((b) => b.hero === x.id) && heroBusy(r, x.id) === null && !handLocked(r, x.id)
      && (x.at === a.at || (ours && migratePath(r, me(), x.at, a.at) !== null))
    const all = sorted(Object.values(r.heroes)).filter(can)
    return [...all.filter((x) => x.at === a.at), ...all.filter((x) => x.at !== a.at)]
  }
  /**
   * 이 군대를 못 이끄는 까닭 — leadCands 와 같은 셈을 하나씩 (형 11-04: "별동대에 장수 배치가 안 됨 · 다솜 배치 왜 안 되냐" —
   * 못 고르는 장수가 말없이 목록에서 사라졌다). 이끌 수 있으면 null
   */
  function leadWhy(r: Realm, a: Army, x: Hero): string | null {
    if (x.faction !== me()) return tr('lead.notOurs')
    if (x.status === 'captive') return tr('lead.captive')
    if (x.status !== 'free') return tr('lead.cannot')
    const led = Object.values(r.armies).find((b) => b.hero === x.id)
    if (led !== undefined) return tr('lead.leading', { army: armyName(r, led) })
    const job = heroBusy(r, x.id)
    if (job !== null) return job
    if (x.at === null) return tr('lead.onRoad')
    if (handLocked(r, x.id)) return tr('lead.noHands', { turn: turnWord(r), used: handsUsed(), cap: handsCap(r) })
    if (x.at !== a.at) {
      if (r.nodes[a.at]?.owner !== me()) return tr('lead.armyAbroad', { at: r.nodes[a.at]?.name ?? '', from: r.nodes[x.at]?.name ?? '' })
      if (migratePath(r, me(), x.at, a.at) === null) return tr('lead.noRoad', { from: r.nodes[x.at]?.name ?? '' })
    }
    return null
  }
  /** 이끌 장수 고르기의 꼬리표 — 맡은 고을(이끌면 내려놓는다) · 멀리서 오면 어디서 */
  function leadTags(r: Realm, a: Army, x: Hero): string {
    const t: string[] = []
    if (x.post !== null && !isRuler(r, x.id)) t.push(`<i class="ldgov">${tr('lead.tagGov', { name: esc(r.nodes[x.post]?.kind === 'capital' ? tr('lead.capital') : r.nodes[x.post]?.name ?? '') })}</i>`)
    if (x.at !== null && x.at !== a.at) t.push(`<i class="ldfar">${tr('lead.tagFar', { name: esc(r.nodes[x.at]?.name ?? '') })}</i>`)
    return t.join('')
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
    const idle = sorted(Object.values(p.heroes)).filter((h) => h.faction === me() && h.status === 'free' && !isRuler(p, h.id) && h.at !== null && h.post == null && heroSeat(p, h.id) === null
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
  function chanJobHtml(id: string, tap = false): string {
    const o = chancellorOrders().find((x) => (x.kind === 'assign' || x.kind === 'lead') && x.hero === id)
    if (o === undefined || realm === null) return ''
    const p = plan()
    const h = p.heroes[id]
    if (h === undefined) return ''
    const far = h.at
    let place = '', what = '', ic = '', men = ''
    if (o.kind === 'assign' && o.node !== null) { place = p.nodes[o.node]?.name ?? ''; what = tr('chan.assignWhat'); ic = 'settle-capital' }
    else if (o.kind === 'lead') {
      const a = p.armies[o.army]
      if (a === undefined) return ''
      place = p.nodes[a.at]?.name ?? ''; what = tr('chan.leadWhat'); ic = 'unit-general'
      men = `<span class="jmen">${icon('unit-spear', 'jri')}${headcount(forceOf(p, a)).toLocaleString('ko-KR')}</span>`
    } else return ''
    const away = (o.kind === 'assign' ? o.node : p.armies[(o as { army: string }).army]?.at) !== far
    const inner = `${bust(h, 'jrf')}<b>${esc(h.name)}</b><i class="jarr">›</i>${icon(ic, 'jri')}<span class="jpl">${esc(place)}</span>${men}<small>${what}${away ? tr('chan.far') : ''}</small>`
    // 재상 띠에서는 탭하면 그 장수 화면 — 손수 부릴 수 있게 (형 10-31) · 장수 줄 안에서는 단추 속 단추가 되므로 글만
    return tap ? `<button class="jrow tap" data-act="hero" data-id="${h.id}">${inner}</button>` : `<span class="jrow">${inner}</span>`
  }
  /** 쉬는 장수가 알아서 찾은 일 — 글 한 줄 (「안개골 마을 고을지기」 · 「갈대울 마을의 군사 120명」) */
  function chanJob(id: string): string | null {
    const o = chancellorOrders().find((x) => (x.kind === 'assign' || x.kind === 'lead') && x.hero === id)
    if (o === undefined || realm === null) return null
    const p = plan()
    const far = p.heroes[id]?.at
    if (o.kind === 'assign' && o.node !== null) return `${tr('chan.keeper', { name: p.nodes[o.node]?.name ?? '' })}${far !== o.node ? tr('chan.far') : ''}`
    if (o.kind === 'lead') {
      const a = p.armies[o.army]
      return a === undefined ? null : `${tr('chan.troops', { name: p.nodes[a.at]?.name ?? '', n: headcount(forceOf(p, a)) })}${far !== a.at ? tr('chan.far') : ''}`
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
    let h = `<div class="jsbar"><div class="seg"><button class="${on ? 'on' : ''}" data-act="js-all" data-v="1">${tr('chan.auto')}</button><button class="${on ? '' : 'on'}" data-act="js-all" data-v="0">${tr('chan.manual')}</button></div>`
    if (on) {
      const jobs = chancellorOrders().flatMap((o) => (o.kind === 'assign' || o.kind === 'lead' ? [o.hero] : []))
      h += jobs.length > 0
        ? `<div class="jsl"><b>${tr('chan.jobsHead', { turn: turnWord(realm), n: jobs.length })}</b>${jobs.map((id) => chanJobHtml(id, true)).join('')}</div>`
        : `<p class="mute">${tr('chan.hint')}</p>`
    }
    return h + `</div>`
  }

  /** 그 판 맨 위 — 왜 데려왔는지 한 줄 · 그냥 넘기기 */
  function nudgeHtml(r: Realm, kind: 'heroes' | 'scout'): string {
    if (nudgedTurn !== r.season) return ''
    const idle = kind === 'heroes' ? waitingHeroes(plan()) : []
    const msg = kind === 'heroes'
      ? (idle.length === 0 ? '' : realm !== null && autoIdle(realm) ? tr('nudge.manualIdle', { n: idle.length }) : tr('nudge.idle', { n: idle.length }))
      : (scouts.length === 0 ? tr('nudge.scoutsIdle', { n: scoutCap(r, me()) }) : '')
    if (msg === '') return ''
    // 누가 쉬는지 얼굴로 바로 — 누르면 그 장수 판 (형 10-23: "쉬는 장수 1명 뜨긴 하는데 누가 쉬는지를 바로바로 알 수 있어야지")
    const faces = idle.map((x) => `<button class="ndg" data-act="hero" data-id="${x.id}">${bust(x, 'ndf')}<b>${esc(x.name)}</b></button>`).join('')
    return `<div class="nudge"><span>${msg}</span>${faces !== '' ? `<div class="ndgs">${faces}</div>` : ''}<button class="btn sm" data-act="next">${tr('nudge.skip')}</button></div>`
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
    const out: Order[] = [...armyOrders, ...settles, ...heroOrders, ...musters, ...councils]
    for (const [army, c] of Object.entries(pick)) {
      const a = p.armies[army]
      if (c !== undefined && a !== undefined && a.march === null) out.push({ kind: 'march', army, edge: c.edge, ambush: c.ambush, ...(c.approach !== undefined ? { approach: c.approach } : {}), ...(c.ration !== undefined ? { ration: c.ration } : {}), ...(c.follow === true ? { follow: true } : {}), ...(c.adviser !== undefined ? { adviser: c.adviser } : {}) })
      if (c?.goal !== undefined && a !== undefined && a.march === null) out.push({ kind: 'goal', army, node: c.goal, ...(c.rally === true ? { rally: true } : {}) })
    }
    for (const army of goalStop) out.push({ kind: 'goal', army, node: null })
    for (const node of scouts) out.push({ kind: 'scout', faction: me(), node, hero: null })
    if (rite) out.push({ kind: 'rite', faction: me() })
    // 사건 카드의 답은 answers 의 'card:<계절>' 칸에 (참 = 첫째 · 거짓 = 둘째 · 'hush:<계절>' 도 참이면 셋째 침묵) — 초안 저장·계절 초기화를 청의 답과 함께 탄다
    for (const [ask, yes] of Object.entries(answers)) {
      if (ask === 'contest:archery') out.push({ kind: 'contest', faction: me(), id: 'archery', won: yes })
      else if (ask.startsWith('hush:')) continue
      else if (ask.startsWith('card:')) {
        if (ask === `card:${realm?.season ?? -1}`) {
          const pk = answers[`hush:${realm?.season ?? -1}`] === true ? 2 : yes ? 0 : 1
          const held = cardHeld[ask]
          const gr = realm?.card?.kind === 'skyfest' && realm.card.grand === true
          out.push({ kind: 'card', faction: me(), pick: pk, ...((gr ? pk < 2 : pk === 1) && held !== undefined ? { held } : {}), ...(pk === 1 && held === 3 && cardPerfect[ask] === true ? { perfect: true } : {}) })
        }
      } else out.push({ kind: 'answer', ask, yes })
    }
    for (const node of guards) out.push(guardOrder(node))
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
      [tr('fr.w.conquest'), cl(held / Math.max(1, need))],
      // 맹주 — 손잡은 나라를 채우는 데 반, 맹약을 네 계절 버티는 데 반
      [tr('fr.w.suzerain'), pact.score < pact.need || pact.vassals < P.realm.suzerainMinVassals ? cl(pact.score / Math.max(1, pact.need)) * 0.5 : 0.5 + cl(streak / S) * 0.5],
      [tr('fr.w.iron'), io.gate ? cl(io.iron / Math.max(1, io.need)) : 0],
      [tr('fr.w.rite'), cl(Math.min(ri.chain / Math.max(1, ri.need), ri.hh / Math.max(1, ri.hhNeed)))],
    ]
  }
  /**
   * 장수 판의 「진각성」 칸 — 진각성 그림이 있는 우리 장수만 (data/awaken2 TRUE_WAKE).
   * 아직이면 진각성 초상이 어둡게 잠겨 있고, 조건 셋(각성 · 불꽃 둘 · 큰 싸움)이 그림 표로 켜진다 · 누르면 진각성 영상을 크게 미리 본다.
   * 진각성했으면 금빛으로 열린다 (형 11-05: "진각성 방법도 어딘가에서 자연스럽게 알 수 있어야 · 게임하면서 알 수 있게")
   */
  function trueWakeCard(x: Hero, bo: string, woke: boolean, loop: string | null): string {
    const R = P.realm
    const asc = x.ascended === true
    const fl = x.flames ?? 0
    const need = Math.round(R.wakeMinFlames)
    const chip = (ok: boolean, ic: string, label: string, tip: string): string => `<i class="twk${ok ? ' ok' : ''}" data-tip="${esc(tip)}">${ic}<b>${label}</b>${ok ? '<u>✓</u>' : ''}</i>`
    const conds = woke ? '' : `<span class="twcs">${chip(asc, '✦', tr('wake.asc'), tr('wake.ascTip'))}`
      + `${chip(asc && fl >= need, '🔥', tr('wake.flame', { a: Math.min(fl, need), b: need }), tr('wake.flameTip', { n: need }))}`
      + `${chip(false, '⚔', tr('wake.big'), tr('wake.bigTip', { pct: Math.round(R.trueWakeBig * 100) }))}</span>`
    const canView = woke || LOCKED_TRUE_WAKE_PREVIEW
    return `<button class="twc${woke ? ' on' : ''}"${canView ? ` data-act="bust-view" data-src="${ART}awaken2-hd/${bo}.jpg" data-loop="${loop ?? ''}" data-elem="${elemOf(x)}"` : ' disabled'} data-tip="${esc(tr(woke ? 'wake.tipDone' : canView ? 'wake.tipView' : 'wake.tipLocked'))}">`
      + `<span class="twp"><img src="${ART}awaken2/${bo}.jpg" alt="">${woke ? '' : '<i class="twl">🔒</i>'}${loop !== null ? '<i class="twv">▶</i>' : ''}</span>`
      + `<span class="twt"><b>${tr('wake.title')}</b>${conds}</span></button>`
  }
  /** 각성 불꽃 칸 — 우리 장수만. 빈 칸 셋이 이길 때마다 켜진다 · 각성하면 「각성」 띠 (형 10-31) */
  function flamesHtml(x: Hero): string {
    if (realm === null || x.faction !== me() || isRuler(realm, x.id)) return ''
    // 칸은 늘 ascendWins(셋) · 처음 깨어날 때는 첫 불씨가 처음부터 붙어 있다 = 덜 이겨도 되는 몫(firstAscendEase)
    // (형 11-12: "모두 다 각성 불꽃 칸이 2개밖에 없음. 3개여야 하는데" — 칸을 줄였더니 버그로 보였다)
    const free = x.ascended === true ? 0 : Math.round(P.realm.ascendWins) - ascendNeed(x)
    const n = (x.flames ?? 0) + free
    // 빈 칸·붙은 칸은 청동 불꽃 자리 그림 둘 (형 11-01: "빈 엠블럼 칸이랑 채워진 불 이미지 다 새로" · 제미나이 Argon)
    // 붙은 칸은 청동 자리는 가만히 · 그 안의 불만 일렁인다 (형 11-01: "촛대에 불 붙었을 때 촛대가 춤추는 거 봤냐? 불만 활활 타올라야지")
    const cells = Array.from({ length: Math.round(P.realm.ascendWins) }, (_, i) => i < n
      ? `<span class="flm lit"><img src="${ART}fx/awaken/slot-on.png" alt=""><i class="flmf"><img src="${ART}fx/awaken/flame.png" alt=""></i></span>`
      : `<img class="flm" src="${ART}fx/awaken/slot-off.png" alt="">`).join('')
    // 깨어난 뒤의 불꽃은 각성기의 연료 — 「각성」 붓글씨 곁에 남은 불꽃 (위원회 11-04 던파 ①)
    if (x.ascended === true) return `<span class="flms on" data-act="flm" data-why="${tr('flame.onWhy', { n, max: P.realm.ascendWins })}"><img class="flmw" src="${ART}fx/awaken/word.png" alt="${tr('wake.asc')}">${cells}</span>`
    return `<span class="flms" data-act="flm" data-why="${tr('flame.why', { n, max: Math.round(P.realm.ascendWins), first: free > 0 ? tr('flame.first') : '' })}">${cells}</span>`
  }
  /**
   * 각성 연출 — 우리 장수가 내리 이겨 각성하면 그 자리에서 크게 (형 10-31: 3연승 직후 각성 연출 · 메모리 WWE 오버액션).
   * 각성 초상이 아래에서 솟고 빛이 터진다. 확인을 눌러야 걷힌다. 여럿이면 차례로 하나씩 다 크게 (형 11-04: "두 장수가 동시에 각성하는데 한 장수만 연출")
   */
  // 개발판에서만 — 각성 연출을 바로 띄워 본다 (콘솔 · tools/phone-shot PRE): __ascend('장수 id')
  // 숫자를 주면 우리 장수 가운데 그 차례 (기운마다 돌려 보기)
  // 다시 깨어남(짧은 연출)도 바로: __ascendAgain('장수 id')
  if (import.meta.env.DEV) (window as unknown as Record<string, unknown>)['__ascendAgain'] = (id: string): void => { if (realm !== null) ascendShow(realm, [{ kind: 'ascend', hero: id, again: true }]) }
  if (import.meta.env.DEV) (window as unknown as Record<string, unknown>)['__ascend'] = (id: string | number | string[] = 0): string => {
    if (Array.isArray(id)) { if (realm !== null) ascendShow(realm, id.map((hero) => ({ kind: 'ascend' as const, hero }))); return id.join(',') }
    if (realm === null) return ''
    const hid = typeof id === 'string' ? id : sorted(Object.values(realm.heroes).filter((x) => x.faction === me() && x.status === 'free'))[id]?.id ?? ''
    ascendShow(realm, [{ kind: 'ascend', hero: hid }])
    const x = realm.heroes[hid]
    return x !== undefined ? `${x.name} ${elemOf(x)}` : ''
  }
  /** 각성 연출이 떠 있는 동안 미룬 소리 — 연출이 다 걷히면 차례로 (형 11-05: "각성 연출하는데 교역 요청이 동시에 떠서 각성 뒤로 목소리 들림") */
  const afterAscend: Array<() => void> = []
  /** 각성 연출이 떠 있으면 걷힌 뒤로 미루고, 아니면 바로 */
  const whenClear = (f: () => void): void => { if (root.querySelector('.ascfx') !== null) afterAscend.push(f); else f() }
  function ascendShow(r: Realm, lines: readonly ReportLine[]): void {
    const mine = lines.filter((x): x is Extract<ReportLine, { kind: 'ascend' }> => x.kind === 'ascend' && r.heroes[x.hero]?.faction === me())
    const l = mine[0]
    const rest = mine.slice(1)
    if (l === undefined) return
    const h = r.heroes[l.hero]!
    root.querySelector('.ascfx')?.remove()
    // 형 11-01: "디지몬 진화처럼 길고 강렬하게 · 온 세계의 기운이 한 곳으로 모이고 · 성격별로 물·번개·바람·불 · 동물 연출" (ascend.ts)
    // 모임(둘레의 기운이 감겨 든다 · 북이 두구두구 빨라진다 · 불꽃 칸 셋) → 소용돌이(초상이 빛으로 바래고 기운이 돈다) → 짐승이 솟는다
    // → 번쩍 · 각성 초상 · 충격파 → 「각성」 붓글씨 → 능력치 → 아래 「확인」.
    // 탭으로 넘기거나 닫지 않는다 · 저절로 걷히지 않는다 (형 11-01: "실수로 탭 한 번 하니 아무것도 못 보고 끝나 버림 · 다 보고 나서 확인 버튼")
    const b = bustOf(h.id)
    const FX = `${ART}fx/awaken/`
    const R = P.realm
    // 이 판에서 다시 깨어나면 짧게 — 모든 때를 ascendAgainMs 에 맞춰 줄인다 (위원회 11-04 던파 ② · 처음은 길고 다시는 짧고 세게)
    const k = l.again === true ? R.ascendAgainMs / R.ascendOkMs : 1
    const t = (ms: number): number => Math.round(ms * k)
    const e = elemOf(h)
    const E = ELEM[e]
    const sd = h.id.length + h.name.length
    const before = b !== undefined ? `<img class="axold" src="${ART}bust-hd/${b}.jpg" onerror="this.onerror=null;this.src='${ART}bust/${b}.jpg'" alt="">` : ''
    // 숨 쉬는 고리 영상이 있으면 각성 초상이 움직인다 (형 11-05 · live2d 같은 idle) · 저사양은 그림
    const loopOk = b !== undefined && AWAKEN_LOOP.has(b) && !root.classList.contains('q-low')
    const after = loopOk ? `<video class="axnew${sqCls(loopFile(b!))}" ${takeAttrs(loopTakes(b!).map((t) => ART + t))} poster="${ART}awaken-hd/${b}.jpg" autoplay muted playsinline preload="auto"></video>` : b !== undefined && AWAKEN_ART.has(b) ? `<img class="axnew" src="${ART}awaken-hd/${b}.jpg" alt="">` : before.replace('axold', 'axnew')
    const phone = window.matchMedia('(pointer: coarse)').matches
    const n = phone ? R.ascendEmbersPhone : R.ascendEmbers
    const jit = (i: number, k: number): number => ((i * 73 + k * 151 + h.id.length * 37) % 101) / 101 // 불티 자리 — 장수마다 같은 흩어짐
    const embers = Array.from({ length: n }, (_, i) => `<i style="--x:${(jit(i, 1) * 100).toFixed(1)}%;--s:${(0.5 + jit(i, 2)).toFixed(2)};--d:${(2.2 + jit(i, 3) * 2).toFixed(2)}s;--dl:${(t(R.ascendVortexMs) / 1000 + jit(i, 4) * 2.4 * k).toFixed(2)}s;--dx:${((jit(i, 5) - 0.5) * 60).toFixed(0)}px">${mote(e, ART, i)}</i>`).join('')
    // 불혀 여섯 — WebGL 이 없을 때(.nogl)만 보인다
    const tongues = [-34, -22, -10, 64, 76, 88].map((l, i) => `<img class="axtg" src="${FX}flame.png" style="--i:${i};--l:${l}%" alt="">`).join('')
    // 빈 청동 자리 위에 지금 타는 불 (burn.ts 셰이더) · WebGL 이 없으면 그린 불(slot-on · 불혀 그림)로 (.nogl)
    const slots = [0, 1, 2].map((i) => `<i class="axslot" style="--i:${i}"><img class="off" src="${FX}slot-off.png" alt=""><img class="on" src="${FX}slot-on.png" alt=""><canvas class="axsb"></canvas></i>`).join('')
    const stats = (['mu', 'tong', 'ryak', 'chi', 'deok'] as const).map((s, i) => `<span class="axst" style="--i:${i}">${STAT_NAME[s]} <s>${h[s] - R.ascendBonus}</s><b>${h[s]}</b></span>`).join('')
    const el = document.createElement('div')
    el.className = `ascfx evo${l.again === true ? ' again' : ''}${loopOk ? ' portrait-video' : ''}`
    el.style.cssText = `--t0:${t(R.ascendSlotMs)}ms;--tg:${t(R.ascendSlotGapMs)}ms;--tv:${t(R.ascendVortexMs)}ms;--tb:${t(R.ascendBeastMs)}ms;--tf:${t(R.ascendFlashMs)}ms;--tok:${t(R.ascendOkMs)}ms;${elemVars(e)}`
    // 번쩍 전에는 원래 초상·청동 액자·불꽃 칸을 그대로 둔다. 세로 영상은 번쩍 뒤 별도 무대에만 드러난다.
    const fr = `--bt:${R.ascendFrameTop};--bs:${R.ascendFrameSide};--bb:${R.ascendFrameBot}`
    const title = `<div class="axtitle"><img class="axbrush" src="${FX}brush.png" alt=""><img class="axword" src="${FX}word.png" alt="${tr('wake.asc')}"></div>`
    const result = `${title}<b class="axname">${esc(h.name)}</b><div class="axstats">${stats}</div>`
    const finalVideo = loopOk ? `<div class="axpost"><div class="axmedia awakening-frame">${after.replace('<video ', '<video data-quiet="1" ')}${awakeningGemHtml(e, ART)}</div>${result}</div>` : ''
    el.innerHTML = `<div class="axveil"></div><img class="axwall" src="${FX}wall.png" alt=""><canvas class="axground"></canvas>`
      + `<img class="axbeast" src="${FX}beast-${E.beast}.png" alt="" onerror="this.classList.add('gone')">${gatherHtml(e, phone ? R.ascendGatherPhone : R.ascendGather, sd, ART, { sec: R.ascendStreakSec, spread: R.ascendStreakSpreadSec, stagger: R.ascendStreakStaggerSec })}<div class="axembers">${embers}</div>`
      + `<div class="axstage"><div class="axcard">${tongues}<div class="axwin">${before}<i class="axsil"></i>${loopOk ? '' : after}</div><canvas class="axburn" style="${fr}"></canvas><img class="axframe" src="${FX}frame0.png" alt=""><img class="axglow" src="${FX}frame0.png" alt="">${vortexHtml(e, phone ? R.ascendOrbitPhone : R.ascendOrbit, sd, ART)}</div><div class="axslots">${slots}</div>${loopOk ? '' : result}</div>${finalVideo}${ringsHtml(e, ART)}<div class="axflash"></div>`
      + `<div class="axok"><button class="btn pri">${tr('rep.ok')}</button></div>`
    const timers: number[] = []
    if (loopOk) timers.push(window.setTimeout(() => {
      if (!el.isConnected) return
      const v = el.querySelector<HTMLVideoElement>('.axpost video')
      if (v !== null) { v.currentTime = 0; delete v.dataset['quiet']; voiceLoop(v) }
      el.classList.add('revealed')
    }, t(R.ascendFlashMs)))
    // 다음 각성이 줄 서 있으면 걷히자마자 이어서 (같은 달에 둘이 각성해도 둘 다 크게)
    const gone = (): void => { timers.forEach((t) => window.clearTimeout(t)); if (!el.isConnected) return; el.classList.add('out'); window.setTimeout(() => { el.remove(); if (rest.length > 0) ascendShow(r, rest); else afterAscend.splice(0).forEach((f) => f()) }, 350) }
    // 확인 단추만 닫는다 — 단추는 능력치가 다 오른 뒤에 뜬다 (CSS --tok · 그 전엔 눌리지 않는다)
    el.querySelector('.axok button')?.addEventListener('click', (ev) => { ev.stopPropagation(); gone() })
    root.appendChild(el)
    // 불을 피운다 — 세 자리는 북소리마다 하나씩 (늘 불) · 액자·바닥은 그 장수의 기운 빛으로. 하나라도 못 피우면 그린 불로 (.nogl)
    const lit = [
      ...[...el.querySelectorAll<HTMLCanvasElement>('.axsb')].map((cv, i) => burn(cv, { mode: 'socket', at: t(R.ascendSlotMs + i * R.ascendSlotGapMs), ramp: t(R.ascendIgniteMs), seed: i * 3.1 })),
      ...[...el.querySelectorAll<HTMLCanvasElement>('.axburn')].map((cv) => burn(cv, { mode: 'frame', at: t(R.ascendVortexMs), ramp: t(R.ascendFlashMs - R.ascendVortexMs), top: R.ascendFrameTop, side: R.ascendFrameSide, bot: R.ascendFrameBot, seed: 7.3, colors: E.c })),
      ...[...el.querySelectorAll<HTMLCanvasElement>('.axground')].map((cv) => burn(cv, { mode: 'ground', at: t(R.ascendFlashMs - R.ascendFrameLeadMs), ramp: t(R.ascendFrameLeadMs * 1.5), seed: 2.2, colors: E.c })),
    ]
    if (lit.some((x) => !x)) el.classList.add('nogl')
    // 소리 — 모임(차오름) · 소용돌이에 그 기운의 소리 · 짐승의 울음 · 번쩍(파·파·밤 하강) · 장수의 한마디
    // 북 두구두구 · 불꽃 칸 방울 · 뿔나팔은 뺐다 (형 11-03: "북 방울 나팔 뺀 게 나은 듯")
    const at = (ms: number, f: () => void): void => { timers.push(window.setTimeout(() => { if (el.isConnected && document.visibilityState === 'visible') f() }, ms)) }
    ding(snd('ax_rise'), 0.6)
    if (E.sfx !== null) { const s = E.sfx; at(t(R.ascendVortexMs), () => ding(snd(s), 0.8)) }
    at(t(R.ascendBeastMs), () => ding(snd(E.cry), 0.9))
    at(Math.max(0, t(R.ascendFlashMs) - preRoll('ax_flash')), () => ding(snd('ax_flash'), 0.95))
    at(t(R.ascendFlashMs), () => { if (typeof navigator.vibrate === 'function') navigator.vibrate([40, 40, 80, 40, 120]) })
    at(t(R.ascendFlashMs) + 1100, () => { if (h.status === 'free' && !isRuler(r, h.id)) ding(voicePath(h, 'tap', false), 0.9) })
  }
  /** 합종 알림 — 섰을 때 깃발들이 끌려와 묶이고, 깼을 때 줄이 끊긴다 (league.ts · 위원회 11-08 ⑤) */
  function leagueToast(next: Realm, lines: readonly ReportLine[]): void {
    if (next.outcome != null) return
    const t = leagueToastHtml(next, me(), lines, (f) => emblem(f, 'fem'))
    if (t !== null) goToast(t.html, t.big ? 'big' : '')
  }
  /** 승리가 가깝다 — 넷 가운데 하나가 이번 계절에 문턱(pathAlertShare)을 넘으면 크게 한 번 (형 10-26: "승리 목표 달성의 80%가 되면 한번 알림") */
  function nearWinToast(prev: Realm, next: Realm): void {
    if (next.outcome != null) return
    const was = new Map(pathShares(prev))
    const T = P.realm.pathAlertShare
    const hit = pathShares(next).filter(([k, v]) => v >= T && v < 1 && (was.get(k) ?? 0) < T)
    if (hit.length > 0) {
      goToast(tr('toast.nearWin', { list: hit.map(([k, v]) => `<b>${k}</b> ${Math.floor(v * 100)}%`).join(' · ') }), 'big')
      return
    }
    // 남이 가깝다 — 아는 나라가 문턱을 넘으면 크게 한 번 (형 10-30: "나도 적도 안 떠서 갑자기 게임이 끝남")
    for (const f of Object.keys(next.factions).sort()) {
      if (f === me() || !met(next, me(), f)) continue
      const wasF = new Map(pathShares(prev, f))
      const near = pathShares(next, f).filter(([k, v]) => v >= T && v < 1 && (wasF.get(k) ?? 0) < T)
      if (near.length === 0) continue
      goToast(tr('toast.foeNear', { emb: emblem(f, 'fem'), name: esc(next.factions[f]?.name ?? ''), list: near.map(([k, v]) => `${k} ${Math.floor(v * 100)}%`).join(' · ') }), 'big')
      return
    }
  }

  /** 외교 추천 한 줄 (advice.ts) — 알림과 외교 판 띠가 같은 말을 쓴다 */
  function tipText(r: Realm, t: DiploTip): string {
    const name = r.factions[t.to]?.name ?? ''
    if (t.kind === 'chance') return tr('tip.chance', { name, foe: r.factions[t.foe ?? '']?.name ?? '' })
    if (t.kind === 'strong') return tr('tip.strong', { name })
    return tr('tip.border', { name })
  }
  /** 새로 생긴 외교 추천 — 그 계절에 한 번 알린다 (가장 급한 것 하나) */
  function diploToast(prev: Realm, next: Realm): void {
    if (next.outcome != null) return
    const was = new Set(diploTips(prev, me()).map((t) => t.key))
    const fresh = diploTips(next, me()).filter((t) => !was.has(t.key))
    const t = fresh.find((x) => x.kind === 'chance') ?? fresh.find((x) => x.kind === 'strong') ?? fresh[0]
    if (t === undefined) return
    goToast(`<span class="gtk">${tr('toast.diplo')}</span>${emblem(t.to, 'fem')}${tx(tipText(next, t))}`)
  }

  /** 잠깐 떴다 스스로 걷히는 한 줄 — 누르면 바로 닫힌다 (메모리 notices-must-dismiss · 걷힘은 CSS 애니메이션 끝에서 · 머무는 시간은 noticeMs) */
  function goToast(html: string, cls = ''): void {
    root.querySelector('.gotoast')?.remove()
    const el = document.createElement('div')
    el.className = `gotoast${cls !== '' ? ` ${cls}` : ''}`
    el.innerHTML = html
    el.addEventListener('animationend', (e) => { if (e.target === el) el.remove() })
    // 글이 길면 더 머문다 · 애니메이션이 안 끝나도(멈춘 탭·움직임 줄이기) 반드시 걷힌다
    const life = noticeMs(el.textContent ?? '', cls === 'big' ? P.realm.noticeBigMs : P.realm.noticeMinMs)
    el.style.animationDuration = `${life}ms`
    window.setTimeout(() => el.remove(), life + 1000)
    el.addEventListener('click', () => el.remove())
    root.append(el)
  }

  function armyName(r: Realm, a: Army): string {
    const h = a.hero !== null ? r.heroes[a.hero] : undefined
    return h !== undefined && h.status === 'free' ? h.name : tr('army.detached', { n: headcount(forceOf(r, a)) })
  }
  /** 군대 말 꾹 누름 상자 — 우리·동맹은 장수·사람 수·병종·사기 · 적은 나라와 가는 곳만 (군세는 정찰로 안다) */
  /**
   * 다음 달에 이기나 (형 11-05: "다음 턴에 승리 확정이라면 다음 달 버튼에 승리라는 걸 알 수 있게") — 지금 명령 그대로 한 달을 미리 넘겨 본다.
   * 판은 결정론이라(A1) 넘겨 본 그대로 된다. 다만 우리가 낄 싸움이 있으면 장담하지 않는다(전장에서 직접 지휘하면 바뀐다).
   * 멈춘 사이에 한 번만 센다(winAheadMs) · 명령이 같으면 다시 안 센다 · 숨은 탭에선 안 센다(절대 규칙 4)
   */
  let winAhead: { key: string; win: boolean } = { key: '', win: false }
  let winJob = 0
  function scheduleWinAhead(r: Realm): void {
    if (r.outcome) return
    const key = `${r.season}|${JSON.stringify(ordersNow())}`
    if (winAhead.key === key) return
    window.clearTimeout(winJob)
    winJob = window.setTimeout(() => {
      const base = realm
      if (base === null || base.season !== r.season || base.outcome || document.hidden) return
      let win = false
      try {
        // 넘기는 것은 지금 판(realm) — 화면의 r 은 이번 달 명령을 미리 얹은 판(plan)이다 · 「다음 달」과 같은 셈(ordersNow · 재상 · AI)
        const res = advance(base, [...ordersNow(), ...chancellorOrders(), ...aiOrders(base)])
        const o = res.next.outcome
        win = o != null && o.kind === 'win' && !res.report.lines.some((l) => l.kind === 'battle' && (l.atkFaction === me() || l.defender === me()))
      } catch { win = false }
      const was = winAhead.win
      winAhead = { key, win }
      if (win !== was) { const b = root.querySelector('.next'); if (b !== null) b.innerHTML = `${nextPreview(r)}${nextWord(r)} <span>›</span>` }
    }, P.realm.winAheadMs)
  }
  /**
   * 「다음 달」 단추 앞의 작은 그림 — 다음 달이 무엇을 가져오나 (loop-lens 11-01: "단추가 아무것도 말하지 않는다")
   * ⚔ 적이 친다(모인 적이 보일 때) · 우리 군대가 닿는다 · 짓던 것이 선다 · 계절이 바뀐다(다음 계절 그림). 셋까지
   */
  const nextWord = (r: Realm): string => tr(monthly(r) ? 'next.month' : 'next.season')
  function nextPreview(r: Realm): string {
    // 다음 달에 이긴다 — 맨 앞에 금빛 「승리」 (미리 넘겨 본 셈 · scheduleWinAhead)
    const win = winAhead.win && winAhead.key.startsWith(`${r.season}|`) ? `<i class="nxp win" data-tip="${tr('next.winTip', { turn: turnWord(r) })}">${icon('emblem-crown')}<b>${tr('next.win')}</b></i>` : ''
    if (!monthly(r)) return win === '' ? '' : `<span class="nxps">${win}</span>`
    const out: string[] = []
    const vis = visibleNodes(r, me())
    // 적이 친다 — 채비를 마친 군대이거나, 길 위에서 다음 달 우리 고을에 닿는 군대 (긴급 위원회 11-04 · 예고가 「다음 달」에 붙어야 넘기고 싶다)
    if (Object.values(r.armies).some((a) => a.faction !== me() && ((strikeLive(r, a) && r.nodes[a.strike!.node]?.owner === me() && vis.has(a.at))
      || (a.march !== null && a.march.left <= 1 && r.nodes[a.march.to]?.owner === me() && (vis.has(a.at) || vis.has(a.march.to)))))) out.push('<i class="nxp foe">⚔</i>')
    // 곡식 — 곳간은 계절 끝 달에만 드나든다 (난 것 + 가을걷이 − 군량) · 그 달에 「곡식 +n」 (형 11-04: "다음 달에 들어올 곡식도 그 버튼에")
    if (isSeasonEnd(r)) {
      const g = grainAtSeasonEnd(r, me())
      if (g !== 0) out.push(`<i class="nxp gr${g < 0 ? ' dn' : ''}" data-tip="${tr(g > 0 ? 'next.grainIn' : 'next.grainOut')}">${icon(GOOD_ICON.grain)}<b>${g > 0 ? '+' : '−'}${Math.abs(g)}</b></i>`)
    }
    if (Object.values(r.armies).some((a) => a.faction === me() && a.march !== null && a.march.left <= 1)) out.push(`<i class="nxp">${icon('unit-spear')}</i>`)
    if ((r.builds ?? []).some((b) => b.faction === me() && b.done <= r.season)) out.push(`<i class="nxp">${icon('settle-palisade')}</i>`)
    if (isSeasonEnd(r)) out.push(`<i class="nxp">${icon(SEASON_ICON[seasonOf(r, r.season + 1)])}</i>`)
    if (win !== '') out.unshift(win)
    // 합종 — 묶인 깃발과 칠 때까지 남은 달 (출정이면 붉게 ⚔ · league.ts) · 승리 다음 자리
    const lg = leagueChipHtml(r, me(), (f) => emblem(f, 'em'))
    if (lg !== '') out.splice(win !== '' ? 1 : 0, 0, lg)
    return out.length === 0 ? '' : `<span class="nxps">${out.slice(0, 4).join('')}</span>`
  }
  /**
   * 「이어 하기」 단추의 한 줄 — 다음에 열면 무엇이 걸려 있나 (긴급 위원회 11-04 · loop B7: 다음 날 첫 화면이 돌아올 이유가 되게).
   * 우리 땅으로 오는 적(보이는 것) → 옥에서 회유 중인 적장 → 가는 중인 우리 군대. 없으면 빈 줄
   */
  function contHook(r: Realm): string {
    const my = r.player
    const vis = visibleNodes(r, my)
    const foe = Object.values(r.armies).find((a) => a.faction !== my && a.march !== null && r.nodes[a.march.to]?.owner === my && (vis.has(a.at) || vis.has(a.march.to)))
    if (foe?.march) return tr('hook.foe', { foe: r.factions[foe.faction]?.name ?? tr('hook.enemy'), to: r.nodes[foe.march.to]?.name ?? '' })
    const woo = Object.values(r.heroes).find((h) => h.status === 'captive' && h.captor === my && h.persuade !== undefined)
    if (woo !== undefined) return tr('hook.woo', { name: woo.name })
    const go = Object.values(r.armies).find((a) => a.faction === my && a.march !== null)
    if (go?.march) return tr('hook.go', { army: armyName(r, go), to: r.nodes[go.march.to]?.name ?? '' })
    return ''
  }
  function armyHoldHtml(r: Realm, a: Army, foe: boolean): string {
    const go =a.march !== null ? `<p>${esc(tr('hold.going', { to: r.nodes[a.march.to]?.name ?? '', when: arriveWhen(r, a.march.left) }))}</p>` : ''
    if (foe) return `<div class="whh">${emblem(a.faction)}<b>${esc(r.factions[a.faction]?.name ?? '')}</b><small>${tr('hold.enemyArmy')}</small></div>${go}<p class="whn">${tr('hold.pickToStrike')}</p>`
    const hero = a.hero !== null ? r.heroes[a.hero] : undefined
    const rows = (Object.entries(a.mix) as [UnitKind, number][]).filter(([, n]) => n > 0).map(([k, n]) => `<span>${UNIT_NAME[k]}</span><b>${n}</b>`).join('')
    return `<div class="whh">${bust(hero)}<b>${esc(armyName(r, a))}</b><small>${tr('hold.men', { n: headcount(forceOf(r, a)) })}</small></div>`
      + `<div class="wrwhy">${rows}<span>${tr('hold.morale')}</span><b class="${a.morale < P.realm.mapMoraleLow ? 'dn' : 'up'}">${Math.round(a.morale * 100)}%</b></div>${go}`
  }

  /** 우리 고을 — 가장 최근에 차지한 것이 맨 위 (형 10-27: "내 마을 점점 많아지면 뭐가 뭔지 모르니까") · 처음부터 쥔 고을은 그 밑에 이름 순 */
  function myTowns(r: Realm): Array<Realm['nodes'][string]> {
    return sorted(Object.values(r.nodes)).filter((n) => n.owner === me()).sort((a, b) => (b.takenAt ?? -1) - (a.takenAt ?? -1))
  }

  /** 정찰꾼이 갈 수 있는 곳 — 우리 고을에서 scoutReach 칸 안의 본 땅 (scouts.scoutTargets · 사람과 AI 가 같은 셈) */
  function scoutable(r: Realm): string[] {
    // 아직 소개 안 된 나라의 고을은 빼고 (검토 11-01 · 지도에도 안 보인다 · discovery.met)
    return scoutTargets(r, me()).filter((id) => { const o = r.nodes[id]?.owner ?? null; return o === null || met(r, me(), o) })
  }

  /** 정찰꾼을 그곳으로 (보내면 고정도 된다 · 10-24 「정찰 기본 고정」) · 이미 갔으면 거둔다 · 다 나갔으면 어느 정찰꾼을 거둘지 묻는다 */
  function toggleScout(r: Realm, node: string): void {
    scoutAsk = null
    if (scouts.includes(node)) {
      scouts = scouts.filter((x) => x !== node)
      setKeep(scoutKeep.filter((x) => x !== node))
      return
    }
    if (scouts.length >= scoutCap(r, me())) { scoutAsk = node; return }
    scouts = [...scouts, node]
    setKeep([...scoutKeep.filter((x) => x !== node), node])
  }

  /** 묻고 나서 — `out` 정찰을 거두고 `node` 로 */
  function swapScout(out: string, node: string): void {
    scoutAsk = null
    scouts = [...scouts.filter((x) => x !== out && x !== node), node]
    setKeep([...scoutKeep.filter((x) => x !== out && x !== node), node])
  }

  /**
   * 다 나갔을 때 묻는 상자를 화면 가운데에 — 지도 고리의 「정찰」을 누르면 전엔 고을 판 안에만 상자가 생겨 아무 일도 없는 것 같았다
   * (형 11-09: "정찰 다 보내 놨어도 원클릭으로 교체 가능해져야 함") · 고을 판·정찰 판이 이미 상자를 품고 있으면 띄우지 않는다
   */
  function scoutAskPaint(): void {
    const r = realm
    const inSheet = sheet !== null && ((sheet.kind === 'node' && sheet.id === scoutAsk) || sheet.kind === 'scout')
    let el = root.querySelector<HTMLElement>('.scaskpop')
    if (r === null || scoutAsk === null || scouts.includes(scoutAsk) || inSheet || warOn || front !== null) { el?.remove(); return }
    if (el === null) {
      el = document.createElement('div')
      el.className = 'scaskpop'
      el.addEventListener('click', (e) => { if (e.target === el) { scoutAsk = null; paint() } }) // 바깥을 누르면 그대로 둔다
      root.append(el)
    }
    el.innerHTML = scoutAskHtml(r, scoutAsk)
  }

  /**
   * 지금 고른 출정이 보여 주는 승률의 최악 — 길 방식마다 화면이 보이는 것과 같은 셈 (approachMoves). 모르거나 칠 곳이 아니면 null
   */
  function sortieWorst(r: Realm, a: Army): number | null {
    const probe = sortieProbe(a)
    const m = movesOf(r, me(), probe).find((x) => x.edge.id === sortieD.edge)
    if (m === undefined || !m.hostile) return null
    const mv = approachMoves(r, me(), probe, m).find((x) => x.ap === sortieD.approach)
    if (mv === undefined) return null
    if (mv.ap === 'road') return m.win?.[0] ?? null
    const lows = (!mv.hide.free ? [mv.miss] : mv.hide.guarded ? [mv.hit] : [mv.hit, mv.miss]).flatMap((x) => (x !== null ? [x[0]] : []))
    return lows.length > 0 ? Math.min(...lows) : null
  }

  /** 승산 낮은 출정 확인 — 가운데 작은 상자. 그래도 친다(눌린 채 ✓ 금빛 → 출정) · 그만둔다 */
  function warnPaint(): void {
    const r = realm
    let el = root.querySelector<HTMLElement>('.warnpop')
    if (r === null || warnAsk === null || warOn || front !== null) { el?.remove(); return }
    if (el === null) {
      el = document.createElement('div')
      el.className = 'warnpop'
      el.addEventListener('click', (e) => { if (e.target === el) { warnAsk = null; paint() } })
      root.append(el)
    }
    const hero = warnAsk.hero !== null ? r.heroes[warnAsk.hero] : undefined
    el.innerHTML = `<div class="warnbox">${hero !== undefined ? bust(hero, 'warnf') : ''}<p>${esc(tr('warn.line', { pct: warnAsk.pct }))}</p>`
      + `<div class="btns"><button class="btn pri" data-act="warn-yes">${tr('warn.yes')}</button><button class="btn ghost" data-act="warn-no">${tr('warn.no')}</button></div></div>`
  }

  /** 다 나갔을 때 묻는 상자 — 나가 있는 정찰꾼마다 「여기를 거두고 보낸다」 단추 */
  function scoutAskHtml(r: Realm, node: string): string {
    let h = `<div class="scask"><p>${icon('unit-scouts', 'ssic')}${tr('scask.line', { n: scouts.length, to: esc(r.nodes[node]?.name ?? '') })}</p><div class="btns">`
    for (const id of scouts) h += `<button class="btn" data-act="scout-swap" data-out="${id}" data-node="${node}">${tr('scask.swap', { name: esc(r.nodes[id]?.name ?? '') })}</button>`
    return h + `<button class="btn ghost" data-act="scout-ask-no">${tr('scask.keep')}</button></div></div>`
  }

  /**
   * 전군 집결 — 길 위에 있지 않은 우리 군대를 모두 이 고을로 (먼 갈 곳 goal · 한 걸음씩 저절로 · goal.ts).
   * 형 11-04: "모든 군사한테 여기로 모여라 명령 · 마을 토글 버튼 중에 집결 버튼". 닿을 길이 없는 군대·이미 와 있는 군대는 빠진다
   */
  function rallyPlan(r: Realm, node: string): Array<{ army: string; edge: string; seasons: number }> {
    const out: Array<{ army: string; edge: string; seasons: number }> = []
    for (const a of sorted(Object.values(r.armies))) {
      if (a.faction !== me() || a.march !== null || a.at === node || a.id.startsWith('~')) continue
      const x = goalReach(r, me(), a.at).get(node)
      if (x !== undefined) out.push({ army: a.id, edge: x.edge, seasons: x.seasons })
    }
    return out
  }
  /** 지금 이 고을로 모이는 중인가 — 모일 군대가 다 이리로 가고 있다 */
  const rallyOn = (r: Realm, node: string, plan: ReadonlyArray<{ army: string }>): boolean =>
    plan.length > 0 && plan.every((p) => (pick[p.army]?.goal ?? (goalStop.includes(p.army) ? undefined : r.armies[p.army]?.goal)) === node)
  function rallyHtml(r: Realm, node: string): string {
    const plan = rallyPlan(r, node)
    const on = rallyOn(r, node, plan)
    const far = plan.reduce((m, p) => Math.max(m, p.seasons), 0)
    const why = plan.length === 0 ? tr('rally.none') : null
    return `<div class="btns"><button class="btn ${on ? 'on' : ''}" data-act="rally" data-node="${node}"${why === null ? '' : noBtn(why)}>${icon('unit-drummers', 'wki')}${on ? tr('rally.on') : tr('rally.go', { n: plan.length })}${plan.length > 0 && !on ? ` <small class="mute">${tr('rally.late', { when: turnsLabel(r, far) })}</small>` : ''}</button></div>`
  }

  /** 정찰꾼이 다 나갔으면 새 곳으로 돌릴 정찰꾼 — 고정 안 한 것이 먼저, 그다음 먼저 보낸 것 · 남았으면 '' */
  function scoutBump(r: Realm): string {
    if (scouts.length < scoutCap(r, me())) return ''
    return scouts.find((x) => !scoutKeep.includes(x)) ?? scouts[0] ?? ''
  }

  // ───────── 위 상태 줄
  function topHtml(r: Realm): string {
    const season = seasonOf(r)
    const st = left() // 이번 계절 고른 것을 치르고 남는 몫
    const men = Object.values(r.armies).filter((a) => a.faction === me()).reduce((s, a) => s + headcount(forceOf(r, a)), 0)
    const nation = r.factions[me()]
    // 누르면 바로 뜨는 말 (tips.ts) — 폰엔 마우스를 올릴 일이 없다
    // 첫 화면으로 가는 길은 나라 탭 맨 밑 「첫 화면으로」 (형 10-24: "좌상단 홈 버튼은 없애도 될 듯 · 나라 탭에서 눌러서 갈 수 있게")
    // 계절 이름을 누르면 지난 기록 — 따로 있던 「지난 기록」 단추를 대신한다 (형 10-28: 그 자리만큼 목표 띠를 올려 지도를 넓게)
    return `<button class="tl" data-act="log-open" aria-label="${tr('top.logAria')}">${icon(SEASON_ICON[season], 'sic')}<b>${esc(dateLabel(r))}</b><i class="tlx">📜</i></button>`
      + `<div class="tr">${(['grain', 'iron', 'salt', 'wood', 'horse'] as const).filter((g) => g === 'grain' || g === 'iron' || goodOf(st, g) > 0).map((g) => goodStat(r, g, goodOf(st, g))).join('')}`
      + `<span class="stat" data-tip="${tr('top.men')}">${icon('unit-spear')}<b>${men}</b></span>`
      + `<button class="stat nat" data-act="tab" data-tab="nation">${bust(r.heroes[r.factions[me()]?.ruler ?? rulerId(me())], 'tface')}${emblem(me())}<b>${esc(nation?.name ?? '')}</b></button></div>`
  }

  /**
   * 위 띠의 물건 하나 — 누르면 어디에 쓰나, 길게 누르면 이번 계절 어디서 얼마나 들고 나나
   * (형: "소금은 어디다쓰는거지?" · "매턴 어느고을에서 뭐가 얼머나 자원이 생산되는지 어떻게알지?")
   */
  function goodStat(r: Realm, g: Good, have: number): string {
    const mine = sorted(Object.values(r.nodes)).filter((n) => n.owner === me())
    const season = seasonOf(r)
    const from = mine.map((n) => [n.name, goodOf(nodeYield(r, n.id, season), g)] as const).filter(([, v]) => v > 0)
    const sum = from.reduce((s, [, v]) => s + v, 0)
    const bits: string[] = []
    bits.push(from.length > 0 ? tr('top.yield', { sum, list: from.map(([nm, v]) => `${nm} ${v}`).join(' · ') }) : tr('top.noYield'))
    if (g === 'grain') {
      const hv = mine.reduce((s, n) => s + nodeHarvest(r, n.id), 0)
      bits.push(tr('top.harvest', { n: hv }))
      bits.push(tr('top.upkeep', { n: upkeepOf(r, me(), season === 'winter') }))
    }
    return `<span class="stat" data-g="${g}" data-tip="${esc(tr(`good.${g}`))}: ${esc(tr(`good.use.${g}`, { n: P.realm.saltKeeps }))}" data-more="${esc(bits.join(' / '))}">${icon(GOOD_ICON[g])}<b>${Math.floor(have)}</b></span>`
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
      const c = pick[a.id]
      const ed = c !== undefined && a.march === null ? r.edges[c.edge] : undefined
      // 군대 하나에 화살 하나 — 이번 계절 걸음(길 위 · 이번에 고른 것)에 먼 갈 곳까지 남은 고을을 잇는다 (형 10-30: "화살표가 왜 이렇게 툭툭 끊어지고")
      const g = goalOf(a)
      const step = a.march !== null ? { from: a.march.from, to: a.march.to, left: a.march.left as number | null, ambush: a.march.ambush }
        : ed !== undefined ? { from: a.at, to: otherEnd(ed, a.at)!, left: null, ambush: c!.ambush } : null
      const then = g !== undefined ? goalRoute(r, me(), step?.to ?? a.at, g).map(([, y]) => y) : []
      const first = step ?? (then.length > 0 ? { from: a.at, to: then.shift()!, left: null, ambush: false } : null)
      if (first === null) continue
      const rest = g !== undefined && then.length > 0 ? goalReach(r, me(), a.march !== null ? a.march.to : a.at).get(g)?.seasons : undefined
      marches.push({ ...first, ...(then.length > 0 ? { then } : {}), ...(rest !== undefined ? { eta: rest + (a.march?.left ?? 0) } : {}) })
    }
    // 우리를 지키러 오는 동맹 군대는 적이 아니다 — 초록 화살 「도우러」
    for (const a of seenMarches(r, me())) if (a.march !== null && a.lent?.to !== me()) marches.push({ from: a.march.from, to: a.march.to, left: a.march.left, foe: true })
    for (const a of lentToMe(r)) if (a.march !== null) marches.push({ from: a.march.from, to: a.march.to, left: a.march.left, ally: true })
    // 개척단 — 흙빛 점선 (이번 계절 고른 길은 남은 계절 없이)
    for (const p of partiesOf(r, me())) if (p.march !== null) marches.push({ from: p.march.from, to: p.march.to, left: realm!.parties?.[p.id]?.march != null ? p.march.left : null, people: true })
    const ps = partySel !== '' ? r.parties?.[partySel] : undefined
    // 척후를 보낸 고을은 고른 고을처럼 금빛 고리를 돌리지 않는다 — 작은 「척후」 표만 (형 10-27: "클릭하라고 지시하는 것 같다")
    const sel = ps !== undefined ? (ps.march?.from ?? ps.at) : sheet?.kind === 'node' ? sheet.id : ring
    // 지도에서 바로 움직인다 (형: "다른게임에서는 지도에서 바로 배치 조절하는거 같은데") — 말을 누르고, 밝아진 고을을 누른다
    // 길 위의 군대도 말을 둔다 — 길 가운데쯤에 (형: "내 군대 번예연이 군대가 지도에서 안보임")
    const tokens: MapToken[] = [...sorted(Object.values(r.armies)).filter((a) => a.faction === me()), ...lentToMe(r)].map((a) => {
      const hero = a.hero !== null ? r.heroes[a.hero] : undefined
      const file = hero !== undefined ? faceFile(hero.id) : undefined
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
    // 척후·첩자가 본 곳에서 떠난 적이면 군사 수 · 병종 · 장수까지 다 보인다 · 모르면 장수 칸에 「?」 (형 11-02)
    for (const a of seenMarches(r, me())) {
      if (a.march === null || a.lent?.to === me()) continue
      const known = foeKnown(r, a)
      const kinds = (Object.entries(a.mix) as Array<[UnitKind, number]>).filter(([, v]) => v > 0).sort((x, y) => y[1] - x[1]).map(([k]) => k)
      const hero = known && a.hero !== null ? r.heroes[a.hero] : undefined
      const file = hero !== undefined ? faceFile(hero.id) : undefined
      tokens.push({ army: a.id, node: a.march.from, men: known ? headcount(forceOf(r, a)) : 0, sel: false, going: false, foe: a.faction,
        img: file !== undefined ? `${ART}bust/${file}.jpg` : `${ART}icon/${UNIT_ICON[kinds[0] ?? 'spear']}.png`, squad: squadOf(known ? kinds : []),
        ...(known ? { known: true } : {}), ...(sneaky.has(a.id) ? { sneak: true } : {}), march: { from: a.march.from, to: a.march.to, left: a.march.left } })
    }
    // 빈땅에 둔 척후도 그 고을에 머무는 적을 본다. 길 위의 적과 달리 고을 위에 말을 둔다.
    for (const a of seenScoutedStationary(r, me())) {
      const kinds = (Object.entries(a.mix) as Array<[UnitKind, number]>).filter(([, v]) => v > 0).sort((x, y) => y[1] - x[1]).map(([k]) => k)
      const hero = a.hero !== null ? r.heroes[a.hero] : undefined
      const file = hero !== undefined ? faceFile(hero.id) : undefined
      tokens.push({ army: a.id, node: a.at, men: headcount(forceOf(r, a)), sel: false, going: false, foe: a.faction, known: true,
        img: file !== undefined ? `${ART}bust/${file}.jpg` : `${ART}icon/${UNIT_ICON[kinds[0] ?? 'spear']}.png`, squad: squadOf(kinds) })
    }
    // 개척단의 말 — 군대 말처럼 누르면 고르고 갈 곳이 빛난다 (지난 계절부터 길 위에 있으면 길 가운데)
    for (const p of partiesOf(r, me())) {
      const was = realm!.parties?.[p.id]?.march
      tokens.push({ army: p.id, node: p.march?.from ?? p.at, men: p.hh, sel: partySel === p.id, going: p.march !== null && was == null, img: `${ART}icon/unit-porters.png`, party: true, ...(p.readyAt !== undefined && p.readyAt > r.season ? { prep: p.readyAt - r.season } : {}),
        // 떠 있는 짐꾼 그림 대신 걷는 이주민 하나 (형 11-03: 병사처럼) — 서 있을 땐 첫 컷, 길 위에선 여덟 컷을 다 걷는다
        squad: [{ src: `${ART}${MIGRANT_ANIM.file}`, ar: MIGRANT_ANIM.ar, m: true }],
        ...(was != null ? { march: { from: was.from, to: was.to, left: was.left } } : {}) })
    }
    const a0 = armySel.length > 0 ? r.armies[armySel[0]!] : undefined
    const a = a0?.faction === me() ? a0 : undefined
    // 다른 우리 군대가 언제 어디에 닿나 — 이미 가는 군대 · 이번 계절에 보낼 군대. 칠 곳 칩에 협공을 미리 (형: "같은 계절에 도착하게 맞춰서 … 합쳐져서 공격이 안오네??")
    const others = new Map<string, number[]>()
    /** 협공에 낄 수 있는 우리 군대 — 그 군대 말이 반짝인다 (형 11-05: "협공 가능한 군사 쪽에서 이펙트 · 소리 · 뾰로로롱") */
    const mates: Array<{ id: string; to: string; k: number }> = []
    const pinMates = new Set<string>()
    for (const o of Object.values(r.armies)) {
      if (o.faction !== me() || armySel.includes(o.id)) continue
      const c = pick[o.id]
      const when = o.march !== null ? { to: o.march.to, k: o.march.left } : c !== undefined ? (() => { const mv = movesOf(r, me(), o).find((x) => x.edge.id === c.edge); return mv !== undefined ? { to: mv.to, k: mv.seasons } : null })() : null
      if (when !== null) { others.set(when.to, [...(others.get(when.to) ?? []), when.k]); mates.push({ id: o.id, to: when.to, k: when.k }) }
    }
    const pincerChip = (to: string, k: number, hostile: boolean): string => {
      const ks = others.get(to)
      if (!hostile || ks === undefined) return ''
      if (ks.includes(k)) { for (const x of mates) if (x.to === to && x.k === k) pinMates.add(x.id); return `<span class="tn pin">${tr('tn.pin')}</span>` }
      const d = Math.min(...ks.map((x) => Math.abs(x - k)))
      return `<span class="tn hard">${tr('tn.off', { d: turnsLabel(r, d) })}</span>`
    }
    const targets: MapTarget[] = a === undefined || a.march !== null ? [] : movesOf(r, me(), a).map((m) => ({
      // 막힌 길도 갈 수는 있다 — 무엇을 잃는지 칩으로 미리 (형: "불가능하게 만들지 말고 패널티 · 사전에 안내")
      node: m.to, edge: m.edge.id, off: false, on: armySel.every((id) => pick[id]?.edge === m.edge.id),
      // 걸리는 계절은 늘 — 칠 곳에도 (형: "적을 치러갈때 그 마을까지 얼마나걸리는지 여전히 안보임")
      chip: (m.blocked !== null ? `<span class="tn hard">${esc(turnText(r, HARD_LINE[m.blocked]))}</span>`
        : m.hostile ? `${m.win !== null ? fightFeel(m.win[0], m.win[1]) : unknownFeel()}${m.conceal === "good" ? `<span class="tn hide">${tr('tn.hide')}</span>` : m.bigArmy ? `<span class="tn big">${tr('tn.big')}</span>` : ""}` : '')
        + `<span class="tn when">${turnsLabel(r, m.seasons)}</span>${pincerChip(m.to, m.seasons, m.hostile)}`,
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
          chip: on ? `${hostile ? `<span class="tn hard">${tr('tn.foeNode')}</span>` : ''}<span class="tn when">${turnsLabel(r, x.seasons)}</span><span class="tn far">${tr('tn.far')}</span>` : '' })
      }
    }
    // 머물기도 지도에서 — 제 고을을 누르면 떠나기를 거둔다 (형: "머물기는 지도에서 선택을 못하고")
    if (a !== undefined && a.march === null) targets.push({ node: a.at, edge: '', off: false, on: armySel.every((id) => pick[id] === undefined), chip: `<span class="tn stay">${tr('tn.stay')}</span>` })
    if (partySel !== '' && armySel.length === 0) targets.push(...partyTargets(r, partySel))
    const fr = fresh
    if (!showReport) fresh = new Set() // 드러나는 것은 한 번만 — 계절 소식을 닫고 지도를 볼 때
    // 군대를 고르지 않았을 때만 — 개척할 수 있는 빈땅에 「＋마을」
    const going = new Set(partiesOf(r, me()).flatMap((p) => (p.march !== null && foundable(r, me(), p.march.to) ? [p.march.to] : [])))
    const stl = armySel.length === 0 && partySel === '' ? new Set(foundLands(r).filter((to) => !(r.nodes[to]?.owner === me() && (r.nodes[to]?.hh ?? 0) > 0))) : new Set<string>()
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
    // 협공 짝 — 그 군대 말이 반짝이고, 군대를 고른 그때 한 번 「뾰로로롱」 (형 11-05)
    if (pinMates.size > 0) {
      for (let i = 0; i < tokens.length; i++) if (pinMates.has(tokens[i]!.army)) tokens[i] = { ...tokens[i]!, pin: true }
      const key = `${r.season}:${armySel.join(',')}:${[...pinMates].sort().join(',')}`
      if (key !== pinRung) { pinRung = key; pinChime() }
    } else pinRung = ''
    // 주인 없는 철광·포구에서 거둔 것 — 그 고을에 「+n 철」이 떠오르고 엽전 소리 한 번 (형 11-05: "내가 먹는 것도 실감이 안 남 · 소리로든 눈에 쌓이는 게 보이든")
    const hauled = new Map<string, Partial<Record<Good, number>>>()
    for (const l of report?.lines ?? []) if (l.kind === 'haul' && l.faction === me()) hauled.set(l.node, l.goods)
    if (hauled.size > 0 && haulRung !== r.season) { haulRung = r.season; window.setTimeout(() => ding(snd('coins'), P.realm.haulCoinVol), 500) }
    return mapHtml(r, me(), ART, marches, sel, focus, tokens, targets, fr, stl, burn, going, taken, held, scouts, hauled)
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
      chip: (m.found ? `<span class="tn newv">${tr('tn.newv')}</span>` : `<span class="tn share">${tr('tn.share')}</span>`) + `<span class="tn when">${turnsLabel(r, m.seasons)}</span>`,
    }))
  }

  /**
   * 개척단이 마을을 열 수 있는 빈땅 (지도의 「＋마을」 · 백성 판의 땅 목록) — 개척단은 도읍에서 꾸려 우리 고을을 거쳐 한 칸씩 가므로
   * 도읍에서 우리 땅을 따라 닿는 곳 모두. 전엔 빈 땅에 세운 우리 마을을 건너뛰어 그 너머가 「못 가는 땅」이 됐다 (형 11-01)
   */
  function foundLands(r: Realm): string[] {
    const cap = r.factions[me()]?.capital
    if (cap === undefined) return []
    const out = new Set<string>()
    const seen = new Set([cap])
    const q = [cap]
    while (q.length > 0) {
      const at = q.shift()!
      for (const m of partyMoves(r, me(), at)) {
        if (m.found) out.add(m.to)
        if (r.nodes[m.to]?.owner === me() && !seen.has(m.to)) { seen.add(m.to); q.push(m.to) }
      }
    }
    return [...out].sort()
  }

  /** 도읍에 맞닿지 않은 빈땅 — 도읍에서 개척단을 꾸려 우리 고을을 거쳐 저절로 보낸다 (Party.goal · 형 11-01: "토함 산성 빈땅인데 왜 개척단이 안 보내지냐") */
  function capPartyHtml(r: Realm, to: string, cls: string): string {
    const cap = r.factions[me()]?.capital
    if (cap === undefined) return ''
    const mine = settles.find((o) => o.kind === 'party' && o.node === cap)
    if (mine !== undefined && mine.kind === 'party' && mine.goal === to) return `<button class="btn home wide on ${cls}" data-act="party-undo" data-node="${cap}">${icon('unit-porters')}${tr('party.undo')}</button>`
    // 못 보내는 때도 단추는 그대로 두고 흐리게 — 누르면 까닭과 소리 (형 11-04: "버튼 비활성화를 시켜야지 설명 텍스트로 모자라다고 하면 어떡하냐")
    const off = (why: string, cost = ''): string => `<button class="btn home wide ${cls}" data-act="party-goal" data-node="${to}"${noBtn(why)}>${icon('unit-porters')}${tr('party.send', { cost })}</button>`
    if (mine !== undefined) return off(tr('party.already', { turn: turnWord(r) }))
    const k = partySize(r, me(), cap, freeSite(r.nodes[to]))
    if (k <= 0) { const c0 = partyCost(r, me(), P.realm.partyMin, freeSite(r.nodes[to])); return off(partyWhy(r, cap, freeSite(r.nodes[to])), costHtml({ grain: c0.grain, wood: c0.wood })) }
    const route = partyRoute(r, me(), cap, to)
    if (route === null) return off(tr('party.blocked'))
    const c = partyCost(r, me(), k, freeSite(r.nodes[to]))
    return `<button class="btn pri home wide ${cls}" data-act="party-goal" data-node="${to}">${icon('unit-porters')}${tr('party.sendIn', { when: turnsLabel(r, route.turns), cost: costHtml({ grain: c.grain, wood: c.wood }) })}</button><p class="mute">${tr('party.auto')}</p>`
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
      if (n.owner !== me() || n.kind === 'wild' || settles.some((o) => o.kind === 'party' && o.node === n.id) || partySize(r, me(), n.id, freeSite(r.nodes[to])) <= 0) continue
      const m = partyMoves(r, me(), n.id).find((x) => x.to === to && x.found)
      if (m !== undefined) c.push({ from: n.id, edge: m.edge })
    }
    c.sort((a, b) => Number(caps.has(a.from)) - Number(caps.has(b.from)) || crowdOf(r.nodes[b.from]!) - crowdOf(r.nodes[a.from]!) || (a.from < b.from ? -1 : 1))
    return c[0] ?? null
  }

  /** 개척단을 못 꾸리는 까닭 한 줄 */
  function partyWhy(r: Realm, node: string, site = false): string {
    if (r.factions[me()]?.capital !== node) return tr('party.onlyCap')
    if (partiesOf(r, me()).length >= P.realm.partyMax) return tr('party.max', { n: P.realm.partyMax })
    const n = r.nodes[node]!
    if (Math.floor(n.hh * P.realm.partyShare) < P.realm.partyMin) return tr('party.fewPeople')
    return shortOf(partyCost(r, me(), P.realm.partyMin, site)) || tr('party.noCost')
  }


  // ───────── 떠돌이 상단 (merchant.ts · 형 11-03: "쇼핑이란 걸 할 수 있어야 한다")
  const offerName = (o: Offer): string => o.what === 'merc' && o.unit !== undefined ? tr('mk.merc', { unit: UNIT_NAME[o.unit], n: o.n })
    : o.what === 'drum' ? tr('mk.drum') : o.what === 'heal' ? tr('mk.heal') : o.what === 'seed' ? tr('mk.seed') : o.what === 'silk' ? tr('mk.silk')
      : o.what === 'ingot' ? (o.good === 'iron' ? tr('mk.ironPack', { n: o.n }) : tr('mk.bulk', { good: o.good !== undefined ? GOOD_NAME[o.good] : '', n: o.n })) : `${o.good !== undefined ? GOOD_NAME[o.good] : ''} ${o.n}`
  const offerDoes = (o: Offer): string => o.what === 'merc' ? tr('mk.doesMerc')
    : o.what === 'drum' ? tr('mk.doesDrum', { n: Math.round(P.realm.drumMorale * 100) })
      : o.what === 'heal' ? tr('mk.doesHeal')
        : o.what === 'seed' ? tr('mk.doesSeed', { n: Math.round(P.realm.seedHarvest * 100) })
          : o.what === 'silk' ? tr('mk.doesSilk', { n: P.realm.silkFavor })
            : o.what === 'ingot' ? tr('mk.doesBulk') : tr('mk.doesGoods')
  const offerIcon = (o: Offer): string => o.what === 'merc' && o.unit !== undefined ? UNIT_ICON[o.unit] : o.what === 'drum' ? 'unit-drummers'
    : o.what === 'heal' ? 'good-honey' : o.what === 'seed' ? 'good-millet' : o.what === 'silk' ? 'good-silk' : o.good !== undefined ? GOOD_ICON[o.good] : 'route-caravan'
  /** 이번 턴 골라 둔 팔기 — 물건마다 개수 · 받을 곡식 합 */
  const pendingSell = (): { by: Partial<Record<Good, number>>; grain: number } => {
    const by: Partial<Record<Good, number>> = {}
    let grain = 0
    for (const o of musters) if (o.kind === 'sell') { by[o.good] = (by[o.good] ?? 0) + o.n; grain += sellPrice(o.good, o.n) }
    return { by, grain }
  }
  /**
   * 상단의 주문 쪽지 (merchant.applyWish · 위원회 11-04 림월드 ②) — 모을 물건과 지금 가진 몫을 그림·칸으로 · 다 모았고 상단이 와 있으면 큰 금빛 단추.
   * 갚음은 떠도는 장수(값 없이) 아니면 먼 나라 소문 · 기한도 벌도 없다
   */
  function wishHtml(r: Realm): string {
    const w = r.marketWish?.[me()]
    if (w === undefined) return ''
    const p = leftPlan()
    const s = p.stock[me()]
    const rows = (Object.entries(w.goods) as Array<[Good, number]>).map(([g, n]) => {
      const have = Math.floor(goodOf(s, g))
      const cells = 5
      const lit = Math.max(0, Math.min(cells, Math.floor((have / n) * cells)))
      return `<span class="wishg${have >= n ? ' ok' : ''}">${icon(GOOD_ICON[g], 'wki')}<b>${Math.min(have, n)}/${n}</b><i>${'■'.repeat(lit)}${'□'.repeat(cells - lit)}</i></span>`
    }).join('')
    // 주문의 크기 — 작은·큰·왕의 주문 (위원회 11-08 · 나라가 클수록 크게 오고 크게 갚는다) · 왕관 그림 수로 한눈에
    const grade = w.grade ?? 1
    const prize = w.reward === 'famed' ? `${icon('unit-general', 'wki')}${tr('wish.famed')}${grade === 3 ? ` · ${icon('route-caravan', 'wki')}${tr('wish.rumor')}` : ''}` : w.reward === 'hero' ? `${icon('unit-general', 'wki')}${tr('wish.hero')}` : `${icon('route-caravan', 'wki')}${tr('wish.rumor')}`
    const ready = wishReady(p, me()) // 이번 달 팔기로 고른 몫까지 빼고 본다 (검토 11-04)
    const queued = musters.some((o) => o.kind === 'wish')
    let h = `<h3>${icon('good-tribute-bell', 'wki')} ${tr('wish.head', { g: WISH_GRADE_NAME[grade] })}${grade > 1 ? ` <span class="wishgr">${icon('emblem-crown', 'wki').repeat(grade - 1)}</span>` : ''}</h3><div class="wishc g${grade}${ready ? ' ready' : ''}"><div class="wishgs">${rows}</div><div class="wishp">${tr('wish.pay', { prize })}</div>`
    if (marketOf(r, me()) !== null) h += `<div class="btns"><button class="btn pri${queued ? ' on' : ''}" data-act="wish"${ready || queued ? '' : noBtn(tr('wish.notYet'))}>${queued ? tr('wish.swapOn') : tr('wish.swap')}</button></div>`
    else h += `<p class="mute">${tr('wish.gather')}</p>`
    return h + '</div>'
  }
  /**
   * 장터 저울 칸 (merchant.applyScale · 위원회 11-04 림월드 ③) — 장터가 있으면 상단이 없는 달에도 남는 것을 곡식으로, 곡식을 모자란 것으로.
   * 값은 상단보다 나쁘고 달마다 한도 · 10씩 · 고른 뒤 다시 누르면 하나씩 거둔다
   */
  function scaleHtml(r: Realm): string {
    if (!hasScale(r, me())) return ''
    const p = leftPlan()
    const room = scaleRoom(p, me())
    let h = `<h3>${icon('settle-market', 'wki')} ${tr('scale.head')}</h3><p class="mute">${tr('scale.sub', { n: room })}</p><div class="mkls">`
    for (const g of ['salt', 'iron', 'wood', 'horse'] as const) {
      const mine = musters.filter((o): o is Extract<Order, { kind: 'scale' }> => o.kind === 'scale' && o.good === g)
      const sold = mine.filter((o) => !o.buy).reduce((s, o) => s + o.n, 0)
      const bought = mine.filter((o) => o.buy).reduce((s, o) => s + o.n, 0)
      const sl = Math.min(10, scaleLimit(p, me(), g, false))
      const bl = Math.min(10, scaleLimit(p, me(), g, true))
      h += `<div class="mkrow">${icon(GOOD_ICON[g], 'wki')}<div class="mkt"><b>${GOOD_NAME[g]} ${Math.floor(goodOf(p.stock[me()], g))}</b><small class="mute">${sold > 0 ? tr('scale.selling', { n: sold }) : ''}${bought > 0 ? tr('scale.buying', { n: bought }) : ''}${tr('scale.rate', { s: scaleSellPrice(g, 10), b: scaleBuyPrice(g, 10) })}</small></div>`
        + `<button class="btn" data-act="scale" data-good="${g}" data-v="sell" data-n="${sl}"${sl > 0 ? '' : noBtn(tr('scale.noSell'))}>${tr('scale.sell', { n: sl })}</button>`
        + `<button class="btn" data-act="scale" data-good="${g}" data-v="buy" data-n="${bl}"${bl > 0 ? '' : noBtn(tr('scale.noBuy'))}>${tr('scale.buy', { n: bl })}</button>`
        + `${mine.length > 0 ? `<button class="btn ghost" data-act="scalex" data-good="${g}">−</button>` : ''}</div>`
    }
    return h + '</div>'
  }
  function marketSheet(r: Realm): string {
    const m = marketOf(r, me())
    if (m === null) return `<h3>${tr('mk.title')}</h3><p class="mute">${tr('mk.next', { when: turnsLabel(r, Math.max(1, marketIn(r, me()))) })}</p>` + wishHtml(r) + scaleHtml(r)
    const st = left()
    let h = `<h3>${icon('route-caravan', 'wki')} ${tr('mk.title')} · ${esc(r.nodes[m.at]?.name ?? '')}</h3><p class="mute">${tr('mk.stay', { when: turnsLabel(r, m.until - r.season + 1) })}</p><div class="mkls">`
    for (const o of m.offers) {
      const bought = musters.filter((x) => x.kind === 'buy' && x.offer === o.id).length
      const rest = o.left - bought
      const can = rest > 0 && st.grain >= o.price
      h += `<div class="mkrow">${icon(offerIcon(o), 'wki')}<div class="mkt"><b>${esc(offerName(o))}</b><small class="mute">${tr('mk.left', { does: esc(offerDoes(o)), n: rest })}</small></div>`
        + `<button class="btn${bought > 0 ? ' on' : ''}" data-act="buy" data-offer="${o.id}"${can ? '' : noBtn(rest <= 0 ? tr('mk.soldOut') : shortOf({ grain: o.price }))}>${costHtml({ grain: o.price })}${bought > 0 ? ` ×${bought}` : ''}</button>`
        + `${bought > 0 ? `<button class="btn ghost" data-act="buyx" data-offer="${o.id}">−</button>` : ''}</div>`
    }
    const ps = pendingSell()
    const room = Math.max(0, sellCap(r, me()) - m.sold - ps.grain)
    h += `</div><h3>${tr('mk.sellHead')}</h3><p class="mute">${tr('mk.room', { n: room })}</p><div class="mkls">`
    for (const g of ['salt', 'iron', 'wood', 'horse'] as const) {
      const have = Math.floor(goodOf(r.stock[me()], g)) - (ps.by[g] ?? 0)
      const per = sellPrice(g, 10) / 10
      const lim = Math.max(0, Math.min(have, per > 0 ? Math.floor(room / per) : 0, sellLimit(r, me(), g) - (ps.by[g] ?? 0)))
      if (have <= 0 && (ps.by[g] ?? 0) === 0) continue
      const ten = Math.min(10, lim)
      h += `<div class="mkrow">${icon(GOOD_ICON[g], 'wki')}<div class="mkt"><b>${GOOD_NAME[g]} ${have}</b><small class="mute">${ps.by[g] !== undefined ? tr('mk.sellPlan', { n: ps.by[g]! }) : ''}${tr('mk.per10', { n: sellPrice(g, 10) })}</small></div>`
        + `<button class="btn" data-act="sell" data-good="${g}" data-n="${ten}"${ten > 0 ? '' : noBtn(tr('mk.cantMore'))}>${tr('scale.sell', { n: ten })}</button>`
        + `<button class="btn" data-act="sell" data-good="${g}" data-n="${lim}"${lim > 0 ? '' : noBtn(tr('mk.cantMore'))}>${tr('mk.all', { n: lim })}</button></div>`
    }
    return h + '</div>' + wishHtml(r) + scaleHtml(r)
  }
  /**
   * 고을 일터 칸 — 터 n/최대 · 선 일터마다 단과 올리기 · 빈 터가 있으면 이 땅에 맞는 새 일터
   * (잠긴 것도 까닭과 함께 보인다: "쇠부리터가 먼저" — 그래서 쇠 나는 땅을 넓히고 지키고 싶어진다 · 형 11-03)
   * 터는 땅 크기대로 — 도읍이 가장 많다 (형 11-05: "논을 지으면 다른 걸 못 짓는 게 말이 안 돼 · 도읍 땅이 제일 크고")
   * 한 고을은 한 번에 하나만 짓는다 (일손)
   */
  function workCardHtml(r: Realm, id: string): string {
    const n = r.nodes[id]!
    if (n.kind === 'sodo' || (n.kind === 'wild' && n.hh <= 0)) return ''
    const cap = lotCap(n)
    const built = worksOf(n)
    const opts = workOptions(r, id).filter((w) => lvOf(n, w) === 0)
    if (built.length === 0 && opts.length === 0) return ''
    const max = Math.round(P.realm.workLvMax)
    const going = (r.works ?? []).find((x) => x.node === id)
    const queuedHere = musters.find((o): o is Extract<Order, { kind: 'work' }> => o.kind === 'work' && o.node === id)
    const lots = Array.from({ length: cap }, (_, i) => `<i class="wklot${i < built.length ? ' on' : ''}"></i>`).join('')
    let h = `<div class="wkc"><b>${tr('work.head')}</b> <span class="wklots" data-tip="${tr('work.lotTip', { n: cap })}">${lots}</span> <span class="mute">${tr('work.lots', { a: built.length, b: cap })}</span></div>`
    for (const [w, lv] of built) {
      const d = WORKS[w]
      const stars = '★'.repeat(lv) + '☆'.repeat(Math.max(0, max - lv))
      h += `<div class="wkc">${icon(d.icon, 'wki')}<b>${d.name}</b> <span class="wkl">${stars}</span> <span class="mute">${esc(d.does)}</span></div>`
      if (going?.what === w) { h += `<div class="wkc">${icon(d.icon, 'wki')}${tr('work.upping', { lv: going.lv ?? lv + 1, when: turnsLabel(r, Math.max(1, going.done - r.season + 1)) })}</div>`; continue }
      if (lv >= max) continue
      const c = workCost(w, lv + 1)
      const queued = queuedHere?.what === w
      const lock = workBlocked(r, me(), id, w)
      const short = shortOf(c as Partial<Record<Good, number>>)
      const why = queuedHere !== undefined && !queued ? tr('work.oneAtATime') : lock ?? (short !== '' ? short : null)
      h += `<div class="btns wkb"><button class="btn${queued ? ' on' : ''}" data-act="work" data-node="${id}" data-what="${w}"${queued || why === null ? '' : noBtn(why)}>${icon(d.icon, 'wki')}<b>${tr('work.toLv', { name: d.name, lv: lv + 1 })}</b> ${costHtml(c)}${whenChip(turnsLabel(r, Math.max(1, Math.round(P.realm.workTurns * P.realm.workLvTurnsMul))))}<small class="mute"> ${tr('work.effect', { x: (Math.round((lvGain(lv + 1) / lvGain(lv)) * 10) / 10) })}</small></button></div>`
    }
    if (going !== undefined && lvOf(n, going.what) === 0) h += `<div class="wkc">${icon(WORKS[going.what].icon, 'wki')}${tr('work.building', { name: WORKS[going.what].name, when: turnsLabel(r, Math.max(1, going.done - r.season + 1)) })}</div>`
    if (opts.length === 0) return h
    h += `<div class="wkc"><span class="mute">${tr('work.newLot', { when: turnsLabel(r, Math.max(1, Math.round(P.realm.workTurns))) })}</span></div><div class="btns wkb">`
    for (const w of opts) {
      const d = WORKS[w]
      const c = workCost(w)
      const queued = queuedHere?.what === w
      const lock = workBlocked(r, me(), id, w)
      const short = shortOf(c as Partial<Record<Good, number>>)
      const why = queuedHere !== undefined && !queued ? tr('work.oneAtATime') : lock ?? (short !== '' ? short : null)
      h += `<button class="btn${queued ? ' on' : ''}" data-act="work" data-node="${id}" data-what="${w}"${queued || why === null ? '' : noBtn(why)}>${icon(d.icon, 'wki')}<b>${d.name}</b>${lock !== null ? ` <span class="mute">🔒 ${esc(lock)}</span>` : ` ${costHtml(c)}${whenChip(turnsLabel(r, Math.max(1, Math.round(P.realm.workTurns))))}`}<small class="mute"> ${esc(d.does)}</small></button>`
    }
    return h + '</div>'
  }

  /** 지도에서 켜고 끄는 겹 (형: "좌하단에는 확대축소말고 뭔가 보이기 안보이기 토글 필요할듯") — 끈 것은 .ap.hide-<id> */
  function layersHtml(): string {
    let h = `<div class="lyh">${tr('layers.head')}</div>`
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
    const mw = root.querySelector<HTMLElement>(".mapwrap"); if (mw !== null) paintMapCanvas(mw) // 땅·길 보기를 끄고 켜면 캔버스도
  }

  /**
   * 길 보기 — 선의 생김새가 무슨 길이고 무엇이 다른지 (형: "경로에 직선이랑 점선 이런건 뭔차이임").
   * 길의 선은 지도의 것(mapview.roadSvg) 그대로 그려 보인다.
   */
  function roadKeyHtml(): string {
    let h = `<button data-act="roadkey" aria-label="${tr('road.aria')}">${roadOpen ? '✕' : '?'}</button>`
    if (!roadOpen) return h
    const road = (k: EdgeKind): string => `<svg width="54" height="16" viewBox="0 0 54 16">${roadSvg('M7 8H47', k, 0.85)}</svg>`
    const line = (attrs: string): string => `<svg width="54" height="14" viewBox="0 0 54 14"><path d="M4 7H50" fill="none" ${attrs.replace(/stroke-width="(\d+)"/, (_, w: string) => `stroke-width="${Math.max(3, Number(w) * 0.7)}"`)}/></svg>`
    // 달 시계는 길마다 걸리는 달이 길이로 정해진다 (season.marchTurns) — 고갯길·갯벌은 같은 길이면 더 걸린다
    const mo = realm !== null && monthly(realm)
    const ROAD: ReadonlyArray<[EdgeKind, string]> = [
      ['field', tr('road.field', { pre: mo ? '' : tr('road.one') })],
      ['pass', tr('road.pass', { pace: mo ? tr('road.slow') : tr('road.two') })],
      ['forest', tr('road.forest')],
      ['reeds', tr('road.reeds')],
      ['ford', tr('road.ford')],
      ['sea', tr('road.sea')],
      ['mudflat', tr('road.mud', { pace: mo ? tr('road.slow') : tr('road.two') })],
    ]
    h += `<div class="rk"><h5>${tr('road.head')}</h5>${ROAD.map(([k, t]) => `<div>${road(k)}<b>${EDGE_NAME[k]}</b><span>${t}</span></div>`).join('')}`
    // 길 기호 — 계절·닿는 고을에 따라 바뀐다 (mapview.routeSign)
    h += `<h5>${tr('road.signHead')}</h5>`
    h += (Object.keys(ROUTE_SIGN_NAME) as RouteSign[]).map((s) => `<div><img class="rki" src="${ART}icon/route-${s}.png" alt=""><span>${esc(ROUTE_SIGN_NAME[s])}</span></div>`).join('')
    h += `<h5>${tr('road.goodsHead')}</h5><div class="rkg">${(['iron', 'salt', 'wood', 'horse'] as const).map((g) => `<span>${icon(GOOD_ICON[g])}${GOOD_NAME[g]}</span>`).join('')}</div>`
    h += `<div><span>${tr('road.dim')}</span></div>`
    h += `<h5>${tr('road.arrowHead')}</h5>`
    h += `<div>${line('stroke="#c8402a" stroke-width="7"')}<span>${tr('road.arrGo', { turn: turnWord(realm ?? {}) })}</span></div>`
    h += `<div>${line('stroke="#c8402a" stroke-width="7" stroke-dasharray="10 6"')}<span>${tr('road.arrOn', { turn: turnWord(realm ?? {}) })}</span></div>`
    h += `<div>${line('stroke="#3a2a5a" stroke-width="8" stroke-dasharray="2 10" stroke-linecap="round"')}<span>${tr('road.raid')}</span></div>`
    h += `<div>${line('stroke="#3a2a5a" stroke-width="7" stroke-dasharray="10 6"')}<span>${tr('road.foe')}</span></div>`
    h += `<h5>${tr('road.borderHead')}</h5><div>${line('stroke="#2a1d10" stroke-width="3"')}<span>${tr('road.border')}</span></div>`
    h += `<div>${line('stroke="#6b4a2a" stroke-width="3" stroke-dasharray="3 4"')}<span>${tr('road.inner')}</span></div></div>`
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
    // 떠 있는 창 — 전략 회의 · 옥중 담판은 그 자체가 배우는 단계다. 창이 닫혀야 그 일을 마친 것 (형 10-30: "전략회의도 튜토리얼 설명에 들어가야지")
    const ov = stratOpen !== null ? 'strat' as const : wooTalk !== null ? 'talk' as const : wooPick !== null ? 'pick' as const : null
    const ctx = { r, orders: ordersNow(), report, acts: tut.acts, ov }
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
    return `<div class="btns"><button class="btn ${on ? 'on' : 'pri'}" data-act="assault" data-army="${a.id}">${on ? tr('asl.on', { turn: turnWord(r), name: esc(node.name) }) : tr('asl.go', { name: esc(node.name) })}</button></div>`
  }

  function turnBackBtn(a: Army): string {
    if (a.lent !== undefined) return ''
    const on = armyOrders.some((o) => o.kind === 'turnBack' && o.army === a.id)
    return `<div class="btns"><button class="btn ${on ? 'on' : 'ghost'} sm" data-act="turnback" data-army="${a.id}">${on ? tr('back.on') : tr('back.go')}</button></div>`
  }

  /** 개척단의 아래 띠 — 어디서 왔고 몇 가구인지 · 갈 곳 / 가는 중 · 이번 계절 꾸린 것이면 거두기 */
  function partyBarHtml(r: Realm): string {
    const p = r.parties?.[partySel]
    if (p === undefined) return ''
    const close = `<button class="sbx" data-act="pp-close" aria-label="${tr('sel.unpick')}">✕</button>`
    const was = realm!.parties?.[p.id]?.march
    let h = `<div class="sbf">${icon('unit-porters', 'sbface ppface')}</div><div class="sbt"><b>${tr('party.bar', { name: esc(r.nodes[p.home]?.name ?? ''), n: p.hh })}</b>`
    if (was != null) h += `<span>${tr('party.going', { to: esc(r.nodes[was.to]?.name ?? ''), when: esc(arriveWhen(realm!, was.left)) })}</span>`
    else if (p.march !== null) h += `<span>→ ${esc(r.nodes[p.march.to]?.name ?? '')} · ${foundable(r, me(), p.march.to) ? tr('party.arrive') : tr('party.pass')} · ${esc(arriveWhen(realm!, p.march.left))}</span>`
    else if (p.goal !== undefined && r.nodes[p.goal] !== undefined) {
      // 갈 곳을 정해 둔 개척단 — 채비 중이면 언제 떠나나 · 길이 막혀 서 있으면 왜 막혔나 (형 11-05: "감포로 보낸 개척단이 영원히 도착을 안 해")
      const to = r.nodes[p.goal]!.name
      const foe = Object.values(r.armies).find((a) => a.at === p.goal && a.march === null && a.faction !== me())
      if (p.readyAt !== undefined && r.season < p.readyAt) h += `<span>${tr('party.ready', { to: esc(to), when: esc(arriveWhen(realm!, p.readyAt - r.season)) })}</span>`
      else if (foe !== undefined) h += `<span class="ppwhy">${tr('party.occupied', { to: esc(to), foe: esc(r.factions[foe.faction]?.name ?? tr('party.other')) })}</span>`
      else if (partyRoute(r, me(), p.at, p.goal) === null) h += `<span class="ppwhy">${tr('party.roadBlocked', { to: esc(to), why: esc(noReachWhy(r, me(), p.goal)) })}</span>`
      else h += `<span>${tr('party.next', { to: esc(to), turn: turnWord(r) })}</span>`
    }
    else h += `<span>${partyTargets(r, p.id).length > 0 ? tr('party.pick') : tr('party.noWay')}</span>`
    h += `</div>`
    if (joinHere(p.at).some((x) => x.id === p.id)) h += `<button class="btn pri home sm" data-act="ptjoin" data-army="${p.id}">${tr('party.settle')}</button>`
    if (formOf(p.id) !== undefined) h += `<button class="btn ghost sm" data-act="party-undo" data-node="${p.home}">${tr('party.unform')}</button>`
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
      ? `<button class="sbf sbfb${leadPop === first.id ? ' on' : ''}" data-act="ldpop" data-army="${first.id}" aria-label="${tr('sel.leadAria')}">${faces}<i class="sbsw">⇄</i></button><div class="sbt">`
      : `<div class="sbf">${faces}</div><div class="sbt">`
    if (first.faction !== me()) {
      h += `<b>${tr('sel.foe', { name: esc(r.factions[first.faction]?.name ?? ''), n: headcount(forceOf(r, first)) })}</b><span>${esc(lentLine(r, first))}</span>`
    } else if (first.march !== null) {
      h += `<b>${esc(armyName(r, first))}</b><span>${tr('party.going', { to: esc(r.nodes[first.march.to]?.name ?? ''), when: esc(arriveWhen(r, first.march.left)) })}</span>${turnBackBtn(first)}`
    } else if (sel.length === 1) {
      const more = Object.values(r.armies).filter((x) => x.faction === me() && x.id !== first.id && x.at === first.at && x.march === null).length
      const why = tr('sel.where', { more: more > 0 ? tr('sel.more') : '' })
      h += `<b>${tr('sel.army', { name: esc(armyName(r, first)), n: headcount(forceOf(r, first)), g: guideBtn('move') })}</b><span>${why}</span>`
    } else {
      const men = sel.reduce((s, a) => s + headcount(forceOf(r, a)), 0)
      // 이번 계절 장수 명령을 넣은 모습으로 센다 — 장수를 빼낸 군대는 장수 없는 군대 (형 10-26: "한 장수를 빼고 … 합치기가 안 됨")
      const pl = plan()
      const heroes = sel.filter((a) => (pl.armies[a.id]?.hero ?? null) !== null).length
      h += `<b>${tr('sel.multi', { k: sel.length, n: men })}</b><span>${tr('sel.together')}</span>`
      h += `</div><button class="btn pri sm" data-act="selmerge"${heroes > 1 ? noBtn(tr('sel.noMerge')) : ''}>${tr('sel.merge')}</button>`
      if (heroes > 1) h += `<span class="sbwhy">${tr('sel.twoHeroes')}</span>`
      return h + `<button class="sbx" data-act="selclose" aria-label="${tr('sel.unpick')}">✕</button>`
    }
    return h + `</div><button class="sbx" data-act="selclose" aria-label="${tr('sel.unpick')}">✕</button>` + (swap && leadPop === first.id ? leadPickHtml(r, first) : '')
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
      // 판세를 알고(정찰이 오래되지 않았고) 최악이라도 councilSkipWin 넘게 이기면 군막을 열지 않는다 (형 11-11: 농민군 100 에 1153 보내는데 군사회의가 열린다)
      if (m.win !== null && m.win[0] >= P.realm.councilSkipWin && m.age <= P.realm.councilSkipAge) continue
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
    const head = `<div class="sthd"><h2>${tr('cn.title')}${on ? ` <small>${tr('cn.agenda', { n: step + 1, m: ags.length })}</small>` : ''}</h2><p>${tr('cn.fightTo', { army: esc(armyName(r, a)), node: esc(to?.name ?? '') })}${m !== undefined ? ` · ${turnsLabel(r, m.seasons)} · ${m.win !== null ? fightFeel(m.win[0], m.win[1]) : unknownFeel()}` : ''}</p>`
      + (on ? `<button class="stx" data-act="strat-x"${st.next ? ' data-v="keep"' : ''} aria-label="${st.next ? tr('cn.keep') : tr('cn.quit')}">✕</button>` : '') + `</div>`
    const inner = on && m !== undefined ? agendaHtml(r, a, probe, m, ags[step]!, st.beat ?? 0)
      : `<div class="stbody">${note !== '' ? `<div class="banner bad">${tx(note)}</div>` : ''}${summaryHtml(ags)}`
        + (ags.length > 0 ? `<button class="stman${man ? ' on' : ''}" data-act="st-man"><span>${tr('cn.manual')}</span><i>${man ? '▴' : '▾'}</i></button>` : '')
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
      plotHand: (op, target, other) => councilPlotHand(r, op, target, other),
      armyFree: (id) => pick[id] === undefined && !armyOrders.some((o) => (o.kind === 'split' || o.kind === 'merge') && o.army === id),
      leaving: expLeaving,
    })
  }

  /** 이번 계절 원정을 떠나기로 한 장수 — 계획 판(plan)에는 아직 판 위에 있지만 회의에는 앉지 않는다 (형 11-02) */
  function expLeaving(id: string): boolean {
    return heroOrders.some((o) => o.kind === 'expedition' && o.hero === id)
  }

  /**
   * 회의의 「먼저 공작」 · 「이간」 — 이번 계절 걸 수 있으면 보낼 이와 값. 가장 잘 먹힐 이(쉬는 우리 장수 · 고용 밀정)를 미리 고른다 (공작 판의 「누가 가나」와 같은 셈).
   * 자리가 없거나 · 보낼 사람이 없거나 · 곡식이 모자라거나 · 이미 같은 공작을 걸었으면 null
   */
  function councilPlotHand(r: Realm, op: 'burn' | 'sow', target: string, other?: string): { agent: string | null; grain: number } | null {
    if (plots.length >= plotCap(realm!) || handsOut(r)) return null
    if (plots.some((o) => o.kind === 'plot' && o.op === op && o.target === target && o.other === other)) return null
    const t = plotTargets(r, me(), op).find((x) => x.target === target && x.other === other)
    if (t === undefined) return null
    const busy = new Set<string>()
    for (const e of Object.values(envoys)) if (e.hero !== undefined) busy.add(e.hero)
    for (const p of plots) if (p.kind === 'plot' && p.agent !== undefined) busy.add(p.agent)
    const st = left()
    let top: { agent: string | null; grain: number; c: number } | null = null
    for (const id of ['', ...plotAgents(r, me()).filter((x) => !busy.has(x) && heroBusy(r, x) === null)]) {
      const agent = id === '' ? null : id
      const cost = plotCost(op, agent)
      if (!handFor(r, id) || st.grain < cost.grain || st.iron < cost.iron) continue
      const c = plotChance(r, me(), op, t.target, t.node, t.hero, agent)
      const score = c[0] + c[1]
      if (top === null || score > top.c) top = { agent, grain: cost.grain, c: score }
    }
    return top === null ? null : { agent: top.agent, grain: top.grain }
  }

  /** 장수의 말을 따른다 — 출정 판에 바로 건다 (군사 몇 할 · 길과 이끌 이 · 군량 · 기다림). 「결정」 한 번에 모두 이루어진다 */
  function applyVoice(a: Army, v: Voice, ag: AgendaId): void {
    const o = v.opt
    // 떠나지 않음 · 먼저 걸 공작 · 두 갈래 — 안건마다 전에 건 것을 거두고 새로 건다
    sortieD.plan = planChoice(sortieD.plan ?? {}, v, ag)
    sortieD.wait = sortieD.plan.wait === true
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
  }

  /**
   * 「결정」 — 회의가 건 것을 이번 계절 명령에 싣는다 (council-agenda.planOrders): 먼저 걸 공작(미리 고른 이 · 공작 판에서 바꾸거나 거둘 수 있다) ·
   * 두 갈래의 다른 군대의 출정 · 들은 안(장수의 기억). 같은 고을의 회의는 하나만 (다시 열면 바꾼다)
   */
  function councilOrdersGo(r: Realm, a: Army): void {
    if (sortieD.edge === null) return
    for (const o of planOrders(r, me(), a, sortieD.edge, sortieD.plan ?? {}, Object.values(sortieD.said ?? {}).flat())) {
      if (o.kind === 'council') councils = [...councils.filter((x) => !(x.kind === 'council' && x.at === o.at)), o]
      else if (o.kind === 'plot') {
        if (plots.length >= plotCap(realm!) || plots.some((x) => x.kind === 'plot' && x.op === o.op && x.target === o.target && x.other === o.other)) continue
        plots = [...plots, o]
        obey(o.agent)
      } else if (o.kind === 'march') {
        pick[o.army] = { edge: o.edge, ambush: false, approach: 'road' }
        if (realm !== null) councilDone.set(o.army, realm.season)
      }
    }
  }

  /**
   * 전략 회의의 안건 한 장 — 말하는 장수가 하나씩(크게 얼굴 · 자막처럼 말 · 누르면 다음) · 다 말하면 물음 하나와 큰 결정 카드.
   * 군주의 뜻(얼굴 없는 말)은 아뢰지 않고 카드로만 · 카드의 얼굴은 그 말을 한 장수(군주의 뜻이면 군주)
   */
  function agendaHtml(r: Realm, a: Army, probe: Army, m: Move, ag: Agenda, beat: number): string {
    const says = ag.voices.filter((v) => v.hero !== null)
    if (beat < says.length) {
      const v = says[beat]!
      // 말하는 장수는 액자 없이 크게 — 화면 가운데 서서 말한다 (형 11-05: "액자에 담지 말고 · 창세기전처럼 캐릭터가 화면 중앙에서 대화하듯")
      // 큰 그림(bust-hd) · 각성해 숨 쉬는 영상이 있으면 영상(소리는 끈다 — 말이 넘어갈 때마다 음악이 처음부터 돈다)
      const sh = v.hero!
      const sf = faceFile(sh.id)
      const sb = bustOf(sh.id)
      const sloop = sh.ascended === true && sb !== undefined && AWAKEN_LOOP.has(sb) && !root.classList.contains('q-low') ? `${ART}${loopFile(sb)}` : null
      const big = sloop !== null ? `<video class="cnbig vloop${sqCls(sloop)}" ${takeAttrs(loopTakes(sb!).map((t) => ART + t))} poster="${ART}awaken-hd/${sb}.jpg" autoplay muted playsinline preload="auto" data-quiet="1"></video>`
        : sf !== undefined ? `<img class="cnbig" src="${ART}bust-hd/${sf}.jpg" onerror="this.onerror=null;this.src='${ART}bust/${sf}.jpg'" alt="">` : bust(sh, 'cnbig')
      return `<div class="cnstage" data-act="cn-next"><h3 class="cnt">${esc(ag.title)}</h3><div class="cnspk${v.proven === true ? ' gold' : ''}">${big}<b>${nameHtml(sh.name)}</b>${v.proven === true ? `<i class="cngold">${tr('cn.proven')}</i>` : ''}</div>`
        + `<p class="cnsub" aria-live="polite">${hilite(r, me(), v.line)}</p><div class="cnav"><small>${tr('cn.next', { n: beat + 1, m: says.length })}</small><button class="cskip" data-act="cn-skip">${tr('cn.skip')}</button></div></div>`
    }
    const ruler = r.factions[me()]?.ruler
    const rh = ruler !== undefined ? r.heroes[ruler] : undefined
    let h = `<div class="cnq"><p class="cnask">${esc(ag.title)}</p><div class="cnopts${ag.voices.length > 2 ? ' n3' : ''}">`
    for (const v of ag.voices) {
      const face = v.hero !== null ? bust(v.hero, v.proven === true ? 'cof gold' : 'cof') : rh !== undefined ? bust(rh, 'cof') : ''
      const on = sortieD.chose?.[ag.id] === v.label
      h += `<button class="cnopt${on ? ' on' : ''}" data-act="cn-pick" data-ag="${ag.id}" data-l="${esc(v.label)}">${face}<span class="cot"><small>${v.hero !== null ? tr('cn.say', { name: esc(v.hero.name) }) : tr('cn.mine')}</small><b>${esc(v.label)}</b><span>${hilite(r, me(), voiceDoes(r, a, probe, m, v))}</span></span></button>`
    }
    return h + `</div><button class="cnre" data-act="cn-replay">${tr('cn.replay')}</button></div>`
  }

  /** 그 말을 따르면 무엇이 되나 — 결정 카드의 아랫줄 */
  function voiceDoes(r: Realm, a: Army, probe: Army, m: Move, v: Voice): string {
    const o = v.opt
    if (o.k === 'take') {
      const total = headcount(forceOf(r, a))
      if (o.share >= 1) return tr('cn.allGo', { total: total.toLocaleString('ko-KR'), node: r.nodes[a.at]?.name ?? '' })
      const go = takeCount(a, o.share)
      return tr('cn.partGo', { go: go.toLocaleString('ko-KR'), stay: (total - go).toLocaleString('ko-KR') })
    }
    if (o.k === 'route') {
      const lead = o.lead !== undefined ? r.heroes[o.lead] : undefined
      return `${APPROACH_NAME[o.ap]}${lead !== undefined ? tr('cn.leadsSfx', { name: lead.name }) : ''}`
    }
    if (o.k === 'ration') return tr('cn.rationCost', { when: turnsLabel(r, m.seasons + seasons(r, o.extra)), grain: rationCost(r, probe, m.seasons, o.extra).toLocaleString('ko-KR') })
    if (o.k === 'pincer') {
      const b = r.armies[o.army]
      return tr('cn.pincer', { army: b !== undefined ? armyName(r, b) : '', node: r.nodes[o.from]?.name ?? '', turn: turnWord(r) })
    }
    if (o.k === 'plot') {
      const who = o.agent !== null ? r.heroes[o.agent]?.name ?? '' : tr('plot.hiredSpy')
      const aim = o.other !== undefined ? `${r.factions[o.target]?.name ?? ''} ↔ ${r.factions[o.other]?.name ?? ''}` : r.factions[o.target]?.name ?? ''
      return tr('cn.plotLine', { turn: turnWord(r), op: PLOT_NAME[o.op], aim, who, grain: o.grain.toLocaleString('ko-KR') })
    }
    if (o.k === 'hold') return tr('cn.hold', { node: r.nodes[a.at]?.name ?? '' })
    return o.k === 'wait' ? tr('cn.wait', { turn: turnWord(r) }) : tr('cn.leaveNow', { turn: turnWord(r) })
  }

  /** 회의를 다 했다 — 안건마다 고른 것 (누르면 그 안건으로 돌아가 고친다) */
  function summaryHtml(ags: readonly Agenda[]): string {
    if (ags.length === 0) return `<p class="cnnone">${tr('cn.none')}</p>`
    let h = `<div class="cnsum"><h3>${tr('cn.decided')}</h3>`
    ags.forEach((ag, i) => {
      const c = sortieD.chose?.[ag.id]
      const off = sortieD.wait === true && ag.id !== 'wait'
      h += `<button class="cnsr${off ? ' off' : ''}" data-act="cn-goto" data-i="${i}"><span>${esc(ag.title)}</span><b>${esc(off ? '-' : (c ?? tr('cn.unchosen')))}</b><i>${tr('cn.fix')}</i></button>`
    })
    return h + `</div>`
  }

  /** 아래 띠의 「누가 이끄나」 — 지금 장수(빛남) · 이 고을에서 이끌 수 있는 장수(무예·통솔) · 장수 없이 */
  function leadPickHtml(r: Realm, a: Army): string {
    const stat = CMD_JOBS.find((j) => j.id === 'lead')!.stat
    const st = (x: Hero): string => stat.map((k) => `<i>${STAT_NAME[k]} ${x[k]}</i>`).join('')
    const cur = a.hero !== null ? r.heroes[a.hero] : undefined
    const cands = leadCands(r, a)
    let h = `<div class="ldpk"><b>${tr('ldp.who')}</b>`
    if (cur === undefined && !Object.values(r.heroes).some((x) => x.faction === me() && x.status === 'free')) return h + `<p class="mute">${tr('ldp.none')}</p></div>`
    h += `<div class="cmdp">`
    if (cur !== undefined) h += `<button class="on" data-act="ldpop" data-army="${a.id}">${bust(cur, 'face')}<b>${nameHtml(cur.name)}</b><small><i>${tr('ldp.cur')}</i>${st(cur)}</small></button>`
    for (const x of cands) {
      const ruler = isRuler(r, x.id)
      h += `<button data-act="ldpick" data-army="${a.id}" data-id="${x.id}"${ruler ? ` data-tip="${RULER_LEAD_TIP}"` : ''}>${bust(x, 'face')}<b>${nameHtml(x.name)}</b><small>${ruler ? `<i>${tr('ldp.ruler')}</i>` : ''}${leadTags(r, a, x)}${st(x)}</small></button>`
    }
    // 못 이끄는 우리 장수도 흐리게 — 누르면 까닭이 뜬다 (말없이 사라지면 "왜 안 되냐" · 메모리 wwe-overreaction-ux)
    const off = sorted(Object.values(r.heroes)).filter((x) => x.faction === me() && x.status === 'free' && x.id !== cur?.id && !cands.some((c) => c.id === x.id))
    for (const x of off) {
      const why = leadWhy(r, a, x) ?? tr('ldp.cant')
      h += `<button class="ldoff" data-act="ldpick" data-army="${a.id}" data-id="${x.id}"${noBtn(why)}>${bust(x, 'face')}<b>${nameHtml(x.name)}</b><small><i class="ldwhy">${esc(why)}</i></small></button>`
    }
    h += `</div>`
    if (cands.length === 0 && off.length === 0) h += `<p class="mute">${tr('ldp.noSwap')}</p>`
    if (cur !== undefined) h += `<button class="btn ghost sm" data-act="ldpick" data-army="${a.id}" data-id="">${tr('ldp.nobody')}</button>`
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
    const till = tr('lent.until', { when: seasonLabel(r, l.until) })
    const eta = lentEta(r, a.id)
    if (eta === 0) return tr('lent.guard', { place, till })
    if (eta === null) return tr('lent.blocked', { place, till })
    return tr('lent.coming', { place, when: arriveWhen(r, eta), till })
  }

  /** 지도 유닛의 병사 셋 — 가장 많은 병종 둘, 셋째는 둘째 병종(없으면 첫째) · 수군은 땅에선 걷는 그림 · 모르는 군대는 창병 */
  /** 오는 적을 다 아는가 — 떠난 고을이 우리 땅이거나, 척후·첩자가 이번 · 지난 계절에 그 고을을 봤다 (파수는 범위만이라 안 든다) */
  function foeKnown(r: Realm, a: Army): boolean {
    const from = a.march?.from ?? a.at
    if (r.nodes[from]?.owner === me()) return true
    const f = r.intel[me()]?.[from]?.force
    return f != null && (f.src === 'scout' || f.src === 'spy') && f.season >= r.season - 1
  }
  /** 적 군대 말을 눌렀다 — 아는 만큼 한 줄 (형 11-02: "장수 칸에는 물음표 · 터치하면 정보") */
  function foeTokLine(r: Realm, a: Army): string {
    const nation = r.factions[a.faction]?.name ?? ''
    const to = a.march !== null ? r.nodes[a.march.to]?.name ?? '' : ''
    const when = a.march !== null ? (a.march.left <= 1 ? tr('foe.nextTurn', { turn: turnWord(r) }) : tr('foe.after', { when: turnsLabel(r, a.march.left) })) : ''
    const head = to !== '' ? tr('foe.headTo', { nation, to, when }) : tr('foe.head', { nation })
    if (!foeKnown(r, a)) return tr('foe.unknown', { head, from: r.nodes[a.march?.from ?? a.at]?.name ?? '' })
    const mix = (Object.entries(a.mix) as Array<[UnitKind, number]>).filter(([, v]) => v > 0).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${UNIT_NAME[k]} ${v}`).join(' · ')
    const hero = a.hero !== null ? r.heroes[a.hero] : undefined
    return tr('foe.known', { head, n: headcount(forceOf(r, a)), mix, hero: hero !== undefined ? tr('foe.hero', { name: hero.name }) : tr('foe.noHero') })
  }
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
    const known = sorted(Object.values(r.factions)).filter((f) => met(r, me(), f.id)).map((f) => ({ f, n: count(f.id) }))
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
      h += `<button class="lg${cls}" ${act} style="--c:${kit.c};--c2:${kit.c2}"${atWar ? ` title="${tr('legend.war', { name: esc(f.name) })}"` : ''}>${atWar ? '<i class="lgwar">⚔</i>' : rel === 'ally' ? `<i class="lgally">${tr('legend.ally')}</i>` : ''}${emblem(f.id, 'lem')}<b>${n}</b><span>${esc(f.name)}</span>${mood}${ws > 0.02 ? `<i class="lgwin" style="width:${Math.round(ws * 100)}%"></i>` : ''}</button>`
    }
    return h
  }

  // ───────── 군대
  /** 숨기 나쁜 조건 — 숨지 못할 때 까닭으로 든다 */
  const HIDE_BAD: ReadonlySet<ConcealWhy> = new Set<ConcealWhy>(['field', 'pass', 'ford', 'sea', 'mudflat', 'reedsWinter', 'bigArmy'])
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
      h += hints.length > 0 ? `<details class="hintd"><summary>${tr('mc.hints', { n: hints.length })}</summary><ul class="hints">${hints.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></details>` : ''
      const chosen: Approach = c?.approach ?? (c?.ambush === true ? 'night' : 'road')
      const moves = approachMoves(r, me(), a, m)
      // 군막 — 장수 둘이 저마다 길 하나를 권하고 적이 지킬 길목을 읽는다 (council-lines.ts · COUNCIL.md 1주 조각 ②)
      // 전략 회의 화면에서는 안건이 이미 말했다 — 길 단추에 얼굴을 또 붙이지 않는다 (quiet)
      const advs = quiet ? [] : adviseMarch(r, me(), a, m.to, moves, expLeaving)
      // 숨지 못하는 까닭 — 이 길의 나쁜 조건 (형 11-05: 주사위 말고 조건 · 못 하면 까닭)
      const cv0 = concealOf(r, m.edge.id, headcount(forceOf(r, a)), m.to)
      const badWhy = cv0.why.filter((w) => HIDE_BAD.has(w)).map((w) => CONCEAL_LINE[w])
      h += `<div class="how">`
      for (const x of moves) {
        const does = APPROACH_DOES[x.ap]
        const adv = advs.find((v) => v.ap === x.ap)
        const caught = x.ap !== 'road' && !x.hide.free
        const deny = caught ? noBtn(x.ap === 'cliff' ? tr('mc.noCliff') : badWhy.length > 0 ? tr('mc.noHide', { why: badWhy.join(' · ') }) : tr('mc.noHideHigh')) : ''
        // 한 줄에 하나 — 왼쪽은 이름과 얻고 거는 것, 오른쪽은 판세 (좁은 폰에서도 읽히게) · 권한 장수가 있으면 얼굴과 한 줄
        h += `<button class="hw ${x.ap !== 'road' ? 'amb ' : ''}${chosen === x.ap ? 'on' : ''}${adv !== undefined ? ' adv' : ''}" data-act="ap" data-army="${key}" data-v="${x.ap}" data-adv="${adv?.hero.id ?? ''}" data-tip="${esc(`${turnText(r, does.gain)}. ${does.risk}`)}"${deny}>`
        if (adv !== undefined) h += `<span class="hwa">${bust(adv.hero, 'hwf')}<span class="hws"><b>${esc(adv.hero.name)}</b> ${esc(adv.say)}<small>${esc(adv.readSay)}</small></span></span>`
        h += `<span class="hwl"><b>${APPROACH_NAME[x.ap]}${x.seasons !== m.seasons ? ` <small>${turnsLabel(r, x.seasons)}</small>` : ''}</b>`
        h += `</span><span class="hwr">`
        if (x.ap === 'road') h += `<span class="ln">${feel(x.hit)}</span>`
        else {
          // 주사위 말고 조건 (형 11-05) — 숨음이 문턱을 넘으면 반드시 된다 · 남은 모름은 저들이 이 길목을 지키느냐 하나(남의 속이라 범위 · ODDS)
          const verb = x.ap === 'cliff' ? tr('mc.climb') : tr('mc.sneak')
          const hd = x.hide
          if (!hd.free) h += `<span class="ln">${verb} <b class="hno">${tr('mc.caughtB')}</b></span><span class="ln">${tr('mc.ifCaught', { feel: feel(x.miss) })}</span>`
          else if (hd.guarded) h += `<span class="ln">${verb} <b class="hok">${tr('mc.sureB')}</b></span><span class="ln">${tr('mc.ifSure', { feel: feel(x.hit) })}</span>`
          else {
            const s = 1 - hd.g
            const sp = P.realm.hideGuardSpread
            h += `<span class="ln">${verb} ${ambushRangeFeel(Math.max(0, s - sp), Math.min(1, s + sp))}</span><span class="ln">${tr('mc.gap', { a: feel(x.hit), b: feel(x.miss) })}</span>`
          }
        }
        h += `</span></button>`
      }
      h += `</div>`
      // 길과 때 (형이 고름: "길과 때의 싸움") — 이 길이 왜 숨기 좋은지·나쁜지
      const cv = cv0
      const cw = cv.why.map((w) => CONCEAL_LINE[w]).filter((x) => x !== undefined)
      h += `<p class="mute tip"><b${cw.length > 0 ? ` data-tip="${esc(cw.join(' · '))}"` : ''}>${cv.tier === 'good' ? tr('tn.hide') : cv.tier === 'fair' ? tr('mc.tierFair') : tr('mc.tierBad')}</b></p>`
    }
    // 군량 — 몇 계절치를 챙기나 (형: "넉넉히랑 안듦 두개밖에 없는데 이거 기본수치로 주고 줄일수 있게").
    // 길 계절은 늘 챙기고, 그 위에 더 챙길 계절을 고른다. 기본은 옛 "넉넉히"(rationReserve). 더 챙길수록 곡식이 든다
    const extra = rationExtraOf(r, a, m.seasons, c?.ration)
    const cost = rationCost(r, a, m.seasons, extra)
    const total = m.seasons + seasons(r, extra) // 길 턴 + 더 챙길 계절치 (달 시계면 석 달씩)
    h += `<div class="ration">${icon('good-rice', 'rci')}<b>${tr('mc.ration', { when: turnsLabel(r, total) })}</b>`
    h += `<span class="stepper sm"><button data-act="ration" data-army="${key}" data-v="less"${extra <= 0 ? noBtn(tr('mc.noLess')) : ''}>−</button><b>${total}</b>`
    h += `<button data-act="ration" data-army="${key}" data-v="more"${extra >= P.realm.rationMaxExtra || rationCost(r, a, m.seasons, extra + 1) > left().grain + cost ? noBtn(tr('mc.noMore')) : ''}>+</button></span>`
    h += cost > 0 ? costHtml({ grain: cost }) : `<span class="mute">${tr('mc.noGrain')}</span>`
    // 국고 — 지금 남은 곡식과 이 군량을 챙긴 뒤 (형 10-29: "군량 컨트롤은 지금 국고도 같이 보여줘야") · 이 군대가 이미 챙겨 둔 몫은 되돌려 셈한다
    const pk = pick[key === SORTIE ? openArmy : key]
    const had = pk !== undefined && pk.edge === m.edge.id ? rationCost(r, a, m.seasons, rationExtraOf(r, a, m.seasons, pk.ration)) : 0
    const base = left().grain + had
    h += `<span class="treas">${tr('mc.treasury')} ${icon(GOOD_ICON.grain, 'tri')}<b>${base.toLocaleString('ko-KR')}</b> → <b class="${base - cost < 0 ? 'neg' : ''}">${(base - cost).toLocaleString('ko-KR')}</b></span>`
    h += `<button class="btn ghost sm${extra === P.realm.rationReserve ? ' on' : ''}" data-act="ration" data-army="${key}" data-v="full">${tr('mc.basic')}</button></div>`
    if (extra <= 0) h += `<p class="mute tip">${tr('mc.runOut')}</p>`
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
    let h = `<div class="splitp sortiep"><div class="sth">${mode === 'split' ? tr('cn.splitTroops') : tr('dip.whoGoes')} <span class="seg sm"><button class="${all ? 'on' : ''}" data-act="sqall" data-v="all">${tr('cn.all')}</button><button data-act="sqall" data-v="half">${tr('cn.half')}</button></span></div>`
    for (const [k, n] of Object.entries(a.mix) as Array<[UnitKind, number]>) {
      if (n <= 0) continue
      const v = sortieD.take[k] ?? 0
      const step = Math.max(5, Math.round(n / 10 / 5) * 5)
      h += `<div class="sprow">${icon(UNIT_ICON[k])}<span class="spn">${UNIT_NAME[k]}</span><span class="stepper sm">`
      h += `<button data-act="sq" data-army="${a.id}" data-kind="${k}" data-d="${-step}">−</button><b>${v}</b>`
      h += `<button data-act="sq" data-army="${a.id}" data-kind="${k}" data-d="${step}">+</button></span><span class="mute">/ ${n}</span></div>`
    }
    h += mode === 'split'
      ? `<div class="spsum">${tr('cn.splits', { sent, rest: total - sent })}</div>`
      : `<div class="spsum">${tr('cn.sorties', { sent, tail: all ? tr('cn.allArmy') : tr('cn.stayN', { n: total - sent }) })}</div>`
    if (hero !== undefined && hero.status === 'free' && !all) {
      h += `<div class="sth">${tr('cn.heroH')}</div><div class="seg"><button class="${sortieD.hero ? 'on' : ''}" data-act="shero" data-v="1">${esc(tr('cn.heroGoes', { name: hero.name }))}</button>`
      h += `<button class="${sortieD.hero ? '' : 'on'}" data-act="shero" data-v="0">${esc(tr('cn.heroStays', { name: hero.name }))}</button></div>`
    } else if (hero !== undefined) h += `<div class="mute">${esc(tr('cn.heroLeads', { name: hero.name }))}</div>`
    if (mode === 'split') return h + `</div>`
    // 장수들의 안 · 길 · 군량 — 출정할 무리의 힘으로 판세를 본다
    const probe = sortieProbe(a)
    const m = movesOf(r, me(), probe).find((x) => x.edge.id === sortieD.edge)
    if (m !== undefined) {
      h += `<div class="sth">${tr('cn.plans')} ${guideBtn('march')}</div>`
      if (m.blocked !== null) h += `<div class="banner bad">${esc(turnText(r, HARD_LINE[m.blocked]))}</div>`
      h += marchChoice(r, probe, m, { approach: sortieD.approach, ambush: sortieD.approach !== 'road', ...(sortieD.ration !== undefined ? { ration: sortieD.ration } : {}) }, SORTIE, true)
      // ⑤ 같은 고을을 치는 다른 우리 군대가 있으면 — 다 같이 들이칠까, 뒤따라 원군으로 들이칠까 (형 10-25: "원군으로도 안 오고 그냥 한 번에 합산")
      const mates = m.hostile ? Object.values(r.armies).filter((o) => o.faction === me() && o.id !== a.id
        && ((o.march !== null && o.march.to === m.to) || (pick[o.id] !== undefined && o.march === null && r.edges[pick[o.id]!.edge] !== undefined && otherEnd(r.edges[pick[o.id]!.edge]!, o.at) === m.to))) : []
      if (mates.length > 0) {
        const f = sortieD.follow === true
        h += `<div class="sth">${tr('cn.alsoGo', { names: esc(mates.map((o) => armyName(r, o)).join(' · ')) })}</div><div class="seg"><button class="${f ? '' : 'on'}" data-act="sfollow" data-v="0">${tr('cn.together')}</button>`
          + `<button class="${f ? 'on' : ''}" data-act="sfollow" data-v="1" data-tip="${tr('cn.followTip')}">${tr('cn.follow')}</button></div>`
      }
    }
    return h + `</div>`
  }

  /** 출정 띠 — 판 맨 아래에 붙어 굴려도 보인다 (형: "설정을 싹 마치고 맨 아래 출정버튼 · 하단고정") */
  /**
   * 가는 곳이 싸울 곳이면 「출정」, 우리 땅·동맹 땅이면 「이동」 (형 10-24: "맨날 출정이 아니라 적국이면 공격하러 간다는 걸, 군사 이동이면 이동이라고")
   */
  function goWord(r: Realm, a: Army, edge: string | undefined): string {
    if (edge === undefined) return tr('cn.sortie')
    const m = movesOf(r, me(), a).find((x) => x.edge.id === edge)
    return m !== undefined && !m.hostile ? tr('cn.move') : tr('cn.sortie')
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
      const w = sent <= 0 ? tr('cn.pickSplit') : all ? tr('cn.keepSome') : splitBlocked(r, a, sent, total)
      return `<div class="sortiebar"><button class="btn pri wide go" data-act="sortie-go" data-army="${a.id}"${w !== null ? noBtn(w) : ''}>${esc(w ?? tr('cn.splitN', { n: sent.toLocaleString('ko-KR') }))}</button><button class="btn ghost" data-act="open" data-army="${a.id}">${tr('cn.fold')}</button></div>`
    }
    const waiting = sortieD.wait === true
    const why = waiting ? null : sent <= 0 ? tr('cn.pickSend') : !all ? splitBlocked(r, a, sent, total) : dest === undefined ? tr('cn.pickDest') : null
    // 결정 — 고른 것이 한 줄에 (몇 명 · 어디로 · 어느 길 · 누가 이끄나) · 기다리면 그 말
    const lead = sortieD.lead !== undefined ? r.heroes[sortieD.lead] : undefined
    const how = m !== undefined && m.hostile ? ` · ${APPROACH_SHORT[sortieD.approach]}${lead !== undefined ? tr('cn.leadsSfx', { name: lead.name }) : ''}` : ''
    const label = waiting ? tr('cn.decideWait', { turn: turnWord(r) }) : why !== null ? why : dest !== undefined
      ? tr('cn.decideGo', { kind: m !== undefined && !m.hostile ? tr('cn.move') : tr('cn.sortie'), n: sent.toLocaleString('ko-KR'), dest, when: m !== undefined ? tr('cn.hint', { when: turnsLabel(r, m.seasons) }) : '', how })
      : tr('cn.keepSplit', { n: sent.toLocaleString('ko-KR') })
    // 전략 회의의 띠 — 출정 · (「다음 계절」 앞이면) 그대로 간다 · 그만둔다
    let h = `<div class="sortiebar"><button class="btn pri wide go" data-act="sortie-go" data-army="${a.id}"${why !== null ? noBtn(why) : ''}>${esc(label)}</button>`
    return h + (stratOpen.next ? `<button class="btn ghost" data-act="strat-x" data-v="keep">${tr('cn.keep')}</button>` : `<button class="btn ghost" data-act="strat-x">${tr('cn.quit')}</button>`) + `</div>`
  }

  /** 나누기가 안 되는 까닭 — 되면 null (엔진 season.splitArmy 의 규칙과 같다) */
  function splitBlocked(r: Realm, a: Army, sent: number, total: number): string | null {
    const n = Object.values(r.armies).filter((x) => x.faction === a.faction).length
    if (n >= P.realm.armyMax) return tr('sp.full', { n, max: P.realm.armyMax })
    if (sent < P.realm.splitMin) return tr('sp.min', { n: P.realm.splitMin })
    if (total - sent < P.realm.splitMin) return tr('sp.keep', { n: P.realm.splitMin })
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
      const gear = tr('gear.tier', { tier: TIER_NAME[near] })
      const lead = a.hero === null ? tr('gear.noHero') : p.parts.lead >= 1.15 ? tr('gear.leadGood') : tr('gear.lead')
      const mor = p.parts.morale < 0.9 ? tr('gear.moraleLow') : p.parts.morale > 1.05 ? tr('gear.moraleHigh') : tr('gear.moraleMid')
      // 글 대신 그림 칩 — 무엇이든 한눈에 (형 10-23: "군사 xxx명, 쇠날 무장, 장수가 잘 이끈다, 사기가 낮다 … 아이콘이나 뭔가로 이미지화")
      const GEAR_IC: Record<Equip, string> = { stone: 'settle-stone-fortress', leather: 'settle-stone-fortress', bronze: 'treasure-bronze-mirror', ironTip: 'treasure-iron-helmet', iron: 'treasure-iron-helmet', ringSword: 'treasure-ring-sword' }
      const hero = a.hero !== null ? r.heroes[a.hero] : undefined
      const leadChip = hero !== undefined ? `<span class="pch ${p.parts.lead >= 1.15 ? 'good' : ''}" data-tip="${esc(lead)}">${bust(hero, 'pchf')}${p.parts.lead >= 1.15 ? '<i>★</i>' : ''}</span>` : `<span class="pch bad" data-tip="${esc(lead)}">${icon('unit-general', 'pchi')}<i>✕</i></span>`
      const morCls = p.parts.morale < 0.9 ? 'bad' : p.parts.morale > 1.05 ? 'good' : ''
      const chips = `<span class="pch" data-tip="${tr('gear.men', { n: headcount(forceOf(r, a)) })}">${icon(UNIT_ICON.spear, 'pchi')}<b>${headcount(forceOf(r, a)).toLocaleString('ko-KR')}</b></span>`
        + `<span class="pch" data-tip="${esc(gear)}">${icon(GEAR_IC[near], 'pchi')}<b>${esc(TIER_NAME[near])}</b></span>`
        + leadChip
        + `<span class="pch ${morCls}" data-tip="${esc(mor)}">${icon(p.parts.morale < 0.9 ? 'status-morale-down' : 'status-morale-up', 'pchi')}<span class="pmb"><i style="width:${Math.round(Math.max(0.05, Math.min(1, p.parts.morale / 1.3)) * 100)}%"></i></span></span>`
      h += `<div class="pow"><b>${tr('gear.power', { n: Math.round(p.total).toLocaleString('ko-KR') })}</b><span class="pbar"><i style="width:${Math.max(4, (p.total / top) * 100)}%"></i></span>`
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
        const label = on ? tr('gear.tier', { tier: esc(gear) }) : tr('kit.upgrade', { cost: costHtml({ iron: ac.iron }) })
        // 올리는 중이면 이 단추는 "취소" — 골라 둔 표(금테 ✓)를 달지 않는다 (형 10-23: "올리는중 취소 버튼이 이상하게 황금색 테두리")
        h += `<button class="btn sm ${on ? 'ghost' : ''}" data-act="arm" data-army="${a.id}" data-unit="${k}" data-tip="${esc(on ? tr('kit.tipOn', { n: ac.n, gear }) : tr('kit.tipTo', { n: ac.n, gear }))}" ${on || (st.iron >= ac.iron && st.grain >= ac.grain) ? '' : noBtn(tr('kit.short', { iron: ac.iron, grain: ac.grain }))}>${label}</button>`
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
        h += `<div class="banner">${tr('sor.apart', { name: esc(r.nodes[to]!.name), turn: turnWord(r) })}</div>`
        continue
      }
      const w = jointWin(r, me(), legs.map((x) => ({ army: x.army, edge: x.move.edge })), to)
      const two = new Set(legs.map((x) => x.move.edge.id)).size >= 2
      h += `<div class="banner good">${tr('sor.pincer', { name: esc(r.nodes[to]!.name), k: legs.length, two: two ? tr('sor.two') : '' })} ${w === null ? unknownFeel() : fightFeel(w[0], w[1])}</div>`
    }
    return h
  }

  function armySheet(r: Realm): string {
    let h = `<h3>${tr('as.title')}</h3>${threatsHtml(r)}${sortie(r)}`
    if (note !== '') h += `<div class="banner bad">${tx(note)}</div>`
    const armies = sorted(Object.values(r.armies)).filter((a) => a.faction === me())
    if (armies.length === 0) h += `<p class="mute">${tr('as.none')}</p>`
    for (const a of armies) {
      const hero = a.hero !== null ? r.heroes[a.hero] : undefined
      const disbanding = musters.some((o) => o.kind === 'disband' && o.army === a.id)
      const fresh = freshArmy === a.id
      h += `<div class="acard${fresh ? ' fresh' : ''}">${bust(hero)}<div class="ab">${fresh ? `<div class="banner good">${goWord(r, a, pick[a.id]?.edge)}: ${pick[a.id] !== undefined && r.edges[pick[a.id]!.edge] !== undefined ? tr('as.leaving', { to: esc(r.nodes[otherEnd(r.edges[pick[a.id]!.edge]!, a.at)!]?.name ?? '') }) : tr('as.stays')}</div>` : ''}<div class="an"><b>${esc(armyName(r, a))}</b>`
      h += `<span class="mute">${esc(r.nodes[a.at]?.name ?? '')} · ${headcount(forceOf(r, a))}명</span></div><div class="units">`
      h += `</div>${gearBlock(r, a)}`
      if (realm!.armies[a.id] === undefined) h += `<div class="mute">${tr('as.split', { turn: turnWord(realm!) })}</div>`
      if (a.march !== null) {
        h += `<div class="mute">${tr('party.going', { to: esc(r.nodes[a.march.to]?.name ?? ''), when: esc(arriveWhen(r, a.march.left)) })}${a.march.ambush ? tr('as.sneak') : ''}</div>`
        h += turnBackBtn(a)
        h += `</div></div>`
        continue
      }
      if (disbanding) {
        h += `<div class="mute">${tr('as.disband')}</div><div class="btns"><button class="btn ghost" data-act="undisband" data-army="${a.id}">${tr('as.undisband')}</button></div></div></div>`
        continue
      }
      h += assaultBtn(r, a)
      const open = openArmy === a.id
      // 출정 판을 열면 출정은 아래 붙박이 띠가 맡는다 — 위 단추는 숨긴다 (형 10-23: "하단 고정 만들었으면 방패병 밑의 출정 버튼은 없애야")
      // 고치기 단추엔 어디서 어디로 — 떠나는 고을 → 닿을 곳 (형 10-27: "출정 고치기는 출발 지점과 목표 지점 둘 다")
      const pk = pick[a.id]
      const goTo = pk !== undefined ? (pk.goal ?? (r.edges[pk.edge] !== undefined ? otherEnd(r.edges[pk.edge]!, a.at) : undefined)) : undefined
      // 군대 창은 나누기·합치기·장수 — 보내기는 지도에서 (형 10-29: "군대 창에서 하게 하니까 복잡해짐 · 이동은 화면에서만")
      h += `<div class="btns">${open ? '' : `<button class="btn" data-act="open" data-army="${a.id}">${tr('as.splitBtn')}</button>`}${pk !== undefined && goTo != null ? `<button class="btn ghost" data-act="sortie-cancel" data-army="${a.id}">${tr('as.cancelGo', { kind: goWord(r, a, pk.edge), pair: flowPair(r, a.at, goTo) })}</button>` : ''}`
      for (const b of armies) {
        if (b.id !== a.id && b.at === a.at && b.march === null) h += `<button class="btn" data-act="merge" data-army="${a.id}" data-into="${b.id}">${tr('as.joinTo', { name: esc(armyName(r, b)) })}</button>`
      }
      // 장수 없는 군대 — 이 고을에 혼자 있는 우리 장군이 바로 이끈다 (들인 떠돌이도)
      h += `</div>`
      // 장수 없는 군대 — 이끌 장수를 얼굴로 (출정 단추와 줄을 나눈다 · 형 10-23: "출정 버튼이랑 장수 이끌게 하기 버튼 구분 · 장수 얼굴 이미지도")
      if (a.hero === null) {
        const can = leadCands(r, a)
        if (can.length > 0) {
          h += `<div class="leadrow"><span class="mute">${tr('as.leadWho')}</span>`
          for (const y of can) {
            // 군주도 친히 이끈다(친정) — 도읍을 비우면 다스림이 준다
            h += isRuler(r, y.id)
              ? `<button class="btn lead" data-act="lead" data-id="${y.id}" data-army="${a.id}" data-tip="${RULER_LEAD_TIP}">${bust(y, 'lf')}<span>${esc(y.name)}<small>${tr('ldp.ruler')}</small></span></button>`
              : `<button class="btn lead" data-act="lead" data-id="${y.id}" data-army="${a.id}">${bust(y, 'lf')}<span>${esc(y.name)}<small>${tr('as.leads', { tags: leadTags(r, a, y) })}</small></span></button>`
          }
          h += `</div>`
        }
      }
      h += `<div class="btns">`
      h += `</div>`
      if (pick[a.id] !== undefined && !open) {
        const ed = r.edges[pick[a.id]!.edge]
        if (ed !== undefined) h += `<div class="go">→ ${esc(r.nodes[otherEnd(ed, a.at)!]?.name ?? '')}${pick[a.id]!.ambush ? tr('as.ambush') : ''}</div>`
      }
      const g = goalOf(a)
      if (g !== undefined && !open) h += `<div class="go">${tr('as.goal', { to: esc(r.nodes[g]?.name ?? ''), turn: turnWord(r) })}</div>`
      if (open) h += sortiePanel(r, a, 'split')
      else if (pk === undefined && goalOf(a) === undefined) h += `<p class="mute tip">${tr('as.tip')}</p>`
      // 해산은 카드 맨 밑에 작게 — 잘못 누르기 쉬운 자리에서 뺀다 (형: "해산 버튼은 더 맨 밑에")
      if (r.nodes[a.at]?.owner === me()) h += `<div class="btns dis"><button class="btn ghost sm" data-act="disband" data-army="${a.id}">${tr('as.disbandBtn')}</button></div>`
      h += `</div></div>`
    }
    if (armyOrders.length > 0) h += `<button class="btn ghost wide" data-act="undo-split">${tr('as.undoSplit')}</button>`
    const oa = openArmy !== '' ? r.armies[openArmy] : undefined
    if (oa !== undefined && oa.faction === me() && oa.march === null) h += sortieBar(r, oa)
    return h
  }

  // ───────── 징병 (형: "군사징병이랑 개척 좀 확실히 구분필요함" — 군사는 「징병」, 집 옮기기는 「백성」 탭)
  function draftSheet(r: Realm): string {
    const season = seasonOf(r)
    // 설명은 ? 안으로 (형 10-23: "징병 탭에 더 이상 백성 옮기는 탭 설명 넣을 필요가 없어졌어 · 물음표 아이콘에서 부연 설명")
    // 「징병 · 군사 뽑기」는 같은 말 두 번 (형 10-27)
    let h = `<h3 class="sech men">${icon('unit-spear')}${tr('dr.title')} ${guideBtn('draft')}</h3>`
    if (note !== '') h += `<div class="banner bad">${tx(note)}</div>`
    if (season === 'spring') h += `<div class="banner bad">${tx(tr('dr.spring'))}</div>`
    if (season === 'autumn' || season === 'winter') h += `<div class="banner good">${tx(tr('dr.autumn'))}</div>`
    const pending = musters.filter((o): o is Extract<Order, { kind: 'draft' }> => o.kind === 'draft')
    // 알아서 뽑기 — 고을마다 뽑을 수 있는 만큼, 창병과 궁병을 섞어 곡식이 닿는 데까지 (형 10-24: "모든 고을에서 다 최대로 골고루")
    // 설명은 ? 안으로 (형 10-27: "물음표가 분명히 존재하는데 아직도 징병 탭에 텍스트가 너무 많음")
    // 추천 딱지 — 아직 안 뽑았으면 따라 누르면 되는 단추 (형 10-29 · 문명)
    h += `<div class="btns"><button class="btn pri men wide" data-act="auto-draft">${tr('dr.auto')}${pending.length === 0 ? recSt() : ''}</button></div>`
    for (const n of myTowns(r)) h += draftCard(r, n.id, false)
    if (pending.length > 0) {
      h += `<h4>${tr('dr.thisTurn', { turn: turnWord(r) })}</h4>`
      pending.forEach((o) => {
        h += `<div class="row">${icon(UNIT_ICON[o.unit])}${esc(r.nodes[o.node]?.name ?? '')} ${UNIT_NAME[o.unit]} ${o.n}<button class="btn ghost sm" data-act="undraft" data-i="${musters.indexOf(o)}">${tr('dr.cancel')}</button></div>`
      })
    }
    return h
  }

  /**
   * 고을 하나의 징병 칸 — 징병 판과 고을 판이 같이 쓴다. big 이면 병종을 큰 그림으로
   * (형: "내도시 누르면 여기서 징병 누를필요 없이 바로 큰 병종별 이미지와 함께 간편하게 뽑을수 있게")
   */
  /**
   * 곳간 열기 · 유민 부르기 단추 (economy.applyCall · 위원회 11-04 림월드 ①) — 곡식을 내면 유민이 길을 따라 걸어 들어온다.
   * 고른 뒤 다시 누르면 거둔다 · 못 하면 까닭과 소리 (disabled 금지)
   */
  function callBtn(r: Realm, id: string, ring: boolean): string {
    // 「유민」은 낯선 말이었다 — 화면엔 「곡식 → 백성」 그림과 「+n집」 · 설명은 꾹 누르면(PC 는 올리면) (형 11-04: "눌러 봐도 뭐 하는 건지 알 수 있게 만들지를 않았잖아")
    const pic = `<span class="cpic">${icon(GOOD_ICON.grain)}<i>›</i>${icon('unit-porters')}</span>`
    // 다 들어오기까지 — 한 달에 inboundRate 집씩 걸어 들어온다 (이미 오는 길의 집 뒤로) · 형 11-04: "몇 달 걸리는지 다 제대로"
    const takes = (k: number): number => { const nd = r.nodes[id]; return nd === undefined ? 1 : Math.max(1, Math.ceil((inboundOf(nd, me()) + k) / Math.max(1, inboundRate(nd, r)))) }
    const comeText = (k: number): string => (takes(k) <= 1 ? tr('call.next') : tr('call.span', { when: turnsLabel(r, takes(k)) }))
    const queued = musters.find((o): o is Extract<Order, { kind: 'call' }> => o.kind === 'call' && o.node === id)
    if (queued !== undefined) {
      const tip = ` data-tip="${tr('call.opening')}" data-more="${esc(tr('call.openMore', { when: comeText(queued.n), n: queued.n }))}"`
      return ring
        ? `<button class="nrb on" data-act="call" data-node="${id}"${tip}>${pic}<small>${tr('call.plus', { n: queued.n })}</small></button>`
        : `<div class="btns"><button class="btn on" data-act="call" data-node="${id}"${tip}>${pic}${tr('call.openingN', { n: queued.n })}${whenChip(takes(queued.n) <= 1 ? tr('call.next') : turnsLabel(r, takes(queued.n)))} <small class="mute">${tr('call.undo')}</small></button></div>`
    }
    const lp = leftPlan() // 이번 달 쓴 곡식까지 빼고 (검토 11-04)
    const why = callWhy(lp, me(), id)
    const n = callLimit(lp, me(), id)
    const c = callCost(lp, me(), n)
    const what = tr('call.what')
    const tip = ` data-tip="${esc(why === null ? tr('call.tipGo', { g: c.grain, n, when: comeText(n) }) : tr('call.tipWhy', { why }))}" data-more="${esc(what)}"`
    if (ring) return why === '우리 고을이 아닙니다' ? '' : `<button class="nrb" data-act="call" data-node="${id}"${why === null ? '' : noBtn(why)}${tip}>${pic}<small>${why === null ? tr('call.plus', { n }) : tr('call.silo')}</small></button>`
    return `<div class="btns"><button class="btn" data-act="call" data-node="${id}"${why === null ? '' : noBtn(why)}${tip}>${pic}${tr('call.open')} ${why === null ? `· ${tr('call.plusPeople', { n })} ${costHtml({ grain: c.grain })}${whenChip(takes(n) <= 1 ? tr('call.next') : turnsLabel(r, takes(n)))}` : ''}</button></div>`
      + `<p class="mute">${what}</p>`
  }

  /** 이 고을에서 이 병종을 못 뽑는 까닭 — 단추를 죽이지 않고 누르면 이 말과 소리 (위원회 11-04 UX ⑤ · 기병이 골라지고 「군사 0명 뽑기」가 남았다) */
  const unitWhy = (u: UnitKind): string => u === 'horse' ? tr('uw.horse') : u === 'boat' ? tr('uw.boat') : u === 'crossbow' ? tr('uw.crossbow') : tr('uw.none')
  /** 「최대 n」을 막는 것 — 그림 한 칸 · 누르면 한 줄 (위원회 11-04 UX ⑫) */
  const limWhyHtml = (w: 'season' | 'cap' | 'grain' | 'goods', u: UnitKind): string => {
    const [ic, why] = w === 'grain' ? [GOOD_ICON.grain, tr('lw.grain')] : w === 'cap' ? ['unit-spear', tr('lw.cap')] : w === 'goods' ? [u === 'horse' ? GOOD_ICON.horse : u === 'boat' ? GOOD_ICON.wood : GOOD_ICON.iron, unitWhy(u)] : ['settle-farm-village', tr('lw.season')]
    return `<button class="limwhy" data-act="busy"${noBtn(why)}>${icon(ic, 'cgi')}</button>`
  }
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
      h += `<div class="ncard draftc${big ? ' big' : ''}"><div class="an">${big ? `<b>${tr('dc.here')}</b>` : `${icon(nodeIcon(n), 'nic')}<b>${esc(n.name)}</b>`}`
      h += `<span class="mute">${tx(tr('dc.stat', { hh: Math.floor(n.hh), men: militiaMen(r, n.id), doing: done > 0 ? tr('dc.doing', { n: done }) : '' }))}</span></div>`
      // 고을 판 — 이 고을에서 이번 계절 뽑기로 한 것 (다 뽑아 한도가 찼어도 보이고 취소할 수 있게)
      const mine = (): string => (big ? pending.filter((o) => o.node === n.id).map((o) => `<div class="row">${icon(UNIT_ICON[o.unit])}${tr('dc.drafting', { unit: UNIT_NAME[o.unit], n: o.n })}<button class="btn ghost sm" data-act="undraft" data-i="${musters.indexOf(o)}">${tr('dr.cancel')}</button></div>`).join('') : '')
      if (limAll <= 0) {
        h += `<div class="mute">${tr('dc.noMore', { turn: turnWord(r) })}</div>${mine()}</div>`
        return h
      }
      if (big) {
        // 알아서 — 이 고을에서 뽑을 수 있는 병종 모두를 골고루 (형 10-25: "고을 눌렀을때 나오는 그마을 군사뽑기도 자동버튼")
        h += `<div class="btns"><button class="btn pri men wide" data-act="auto-draft" data-node="${n.id}">${tr('dr.autoN', { n: limAll })}</button></div>`
        // 병종 — 큰 그림 타일 (누르면 그 병종으로)
        h += `<div class="dbig">`
        for (const u of draftable(n, r, me())) {
          const ul = Math.max(0, Math.min(limAll, draftLimit(r, me(), n.id, u) - done))
          h += `<button class="${u === unit ? 'on' : ''}" data-act="dunit" data-node="${n.id}" data-unit="${u}"${ul <= 0 ? noBtn(unitWhy(u)) : ''}><img src="${ART}icon/${UNIT_ICON[u]}.png" alt=""><b>${UNIT_NAME[u]}</b><small>${ul > 0 ? tr('dc.upTo', { n: ul }) : u === 'horse' ? tr('dc.noHorse') : u === 'boat' ? tr('dc.noWood') : u === 'crossbow' ? tr('dc.frameFull') : tr('dc.cant')}</small></button>`
        }
        h += `</div>`
      } else {
        h += `<div class="seg">`
        for (const u of draftable(n, r, me())) {
          const ul = Math.max(0, Math.min(limAll, draftLimit(r, me(), n.id, u) - done))
          h += `<button class="${u === unit ? 'on' : ''}" data-act="dunit" data-node="${n.id}" data-unit="${u}"${ul <= 0 ? noBtn(unitWhy(u)) : ''}>${icon(UNIT_ICON[u])}${UNIT_NAME[u]}${ul <= 0 ? ' 🔒' : ''}</button>`
        }
        h += `</div>`
      }
      // 채비 값 — 덩이쇠(변한)는 쌓인 쇠·모자란 곡식 몫을 쇠로 낸다 (economy.draftPay · 계획판 위에서) · 쇠는 값 칩에 보인다
      const dp = draftPay(plan(), me(), Math.max(0, want))
      const nd = draftNeeds(unit, Math.max(1, want), r, me())
      if (unit === 'crossbow') h += `<p class="mute">${lim > 0 ? `${costHtml({ iron: nd.iron })} ${tx(tr('dc.xbowOnly'))}` : tx(tr('dc.xbowNone'))}</p>`
      if (unit === 'horse') h += `<p class="mute">${lim > 0 ? costHtml({ horse: nd.horse }) : tr('dc.horseNone')}</p>`
      if (unit === 'boat') h += `<p class="mute">${lim > 0 ? costHtml({ wood: nd.wood }) : tr('dc.boatNone')}</p>`
      // 철을 더 들이면 처음부터 한 단계 좋은 무기 — 「쇠날창 장착」 한 마디 (형 10-27: "텍스트 너무 길지 않냐 · 쇠날창 장착 이런 식으로")
      const ic = want > 0 ? draftIronCost(r, me(), want, unit) : null
      if (ic !== null) h += `<label class="chk"><input type="checkbox" data-act="diron" data-node="${n.id}" ${draftIron[n.id] === true ? 'checked' : left().iron < ic.iron ? 'disabled' : ''}> ${tr('dc.equip', { gear: esc(GEAR_NAME[unit]?.[ic.to] ?? TIER_NAME[ic.to]), cost: costHtml({ iron: ic.iron }) })}</label>`
      // 뽑은 만큼 일손이 빠진다 (season.draftArmy · draftHHPerMan) — 글 대신 집 ▼ 칩 (가을걷이는 봄 띠가 이미 말한다)
      const hhLoss = Math.round(want * P.realm.draftHHPerMan)
      h += `<div class="stepper"><button data-act="dn" data-node="${n.id}" data-d="${-step}">−</button><b>${want}</b>`
      h += `<button data-act="dn" data-node="${n.id}" data-d="${step}">+</button><span class="mute">${tr('dc.max', { n: lim })}</span>${lim < militiaMen(r, n.id) ? limWhyHtml(draftWhy(r, me(), n.id, unit), unit) : ''}${costHtml({ grain: Math.ceil(dp.grain), ...(dp.iron > 0 ? { iron: dp.iron } : {}) })}`
      h += `${hhLoss > 0 ? `<span class="cost"><b class="cg" title="${tr('dc.hh', { n: hhLoss })}"><i>▼</i>${icon('settle-farm-village', 'cgi')}${hhLoss}</b></span>` : ''}</div>`
      // 뽑기 단추는 숫자 줄 밑에 크게 한 줄 — 이게 뽑는 단추라고 바로 알게 (형 10-27)
      h += `<div class="btns"><button class="btn pri men wide" data-act="draft" data-node="${n.id}"${want <= 0 ? noBtn(lim > 0 ? tr('dc.pickN') : unitWhy(unit)) : ''}>${tr('dc.draftN', { n: want })}</button></div>`
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
    h += `<div class="btns btnq"><button class="btn pri home wide${placed !== undefined ? ' on' : ''}" data-act="pl-open">${icon('unit-porters')}백성 배치${placed !== undefined ? ` · 이번 ${turnWord(r)} 나누었다` : ''}</button>${guideBtn('place')}</div>`
    const ps = partiesOf(r, me())
    const wilds = foundLands(r).filter((to) => !(r.nodes[to]?.owner === me() && (r.nodes[to]?.hh ?? 0) > 0))
    if (ps.length > 0 || wilds.length > 0) {
      h += `<h4 class="sech home">${icon('unit-porters')}개척단</h4>`
      if (ps.length === 0) h += `<p class="mute">지도에서 깜빡이는 「개척단 필요」를 누른다</p>`
    }
    for (const p of partiesOf(realm!, me()).filter((x) => joining(x.id))) {
      h += `<div class="row mvq"><button class="pprow" data-act="ptjoin" data-army="${p.id}">${icon('unit-porters', 'gic')}<span class="nchip">${esc(r.nodes[p.home]?.name ?? '')} 개척단</span><span class="mute">백성 ${p.hh}가구 · ${esc(josa(r.nodes[p.at]?.name ?? '', '에', '에'))} 자리 잡는다 · 누르면 ${tr('x.recall')}</span></button></div>`
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
    h += `<div class="plpool${pool > 0 ? ' full' : ''}"><span>모아 둔 백성</span><b>${pool}가구</b><small>이번 ${turnWord(base)} ${out} / ${lim}가구 옮김${out > 0 ? ` ${costHtml({ grain: Math.ceil(out * P.realm.migrateGrain) })}` : ''}</small></div>`
    for (const id of ids) {
      const n = base.nodes[id]!
      const room = homeRoom(n)
      const now = n.hh + d(id)
      const cap = base.factions[me()]?.capital === id
      // 땅의 결 — 쌀만이 아니라 나무·철·소금도 (economy.soilOf · 형 11-05)
      const land = soilOf(base, id).map((s) => `<span class="pltag ${s.up ? 'rv' : 'hl'}">${esc(s.name)} · ${s.good === 'iron' && s.up ? tr('node.ironLittle') : `${GOOD_NAME[s.good]} ${s.up ? '+' : '−'}${s.pct}%`}</span>`).join('')
      // 이만큼 살면 나는 것 — 쌀(내년 봄 심는 집 기준)과 특산
      const pr = { ...base, nodes: { ...base.nodes, [id]: { ...n, hh: now } } }
      const y = nodeYield(pr, id, 'summer')
      const rice = Math.round(now * P.realm.harvestPerHH * fieldMul(base, id))
      const goods = (['iron', 'salt', 'wood', 'horse'] as const).filter((g) => (y[g] ?? 0) > 0)
      const yl = `${icon('good-rice', 'gic')}쌀 ${rice}${goods.map((g) => ` · ${icon(GOOD_ICON[g], 'gic')}${GOOD_NAME[g]} ${y[g]}`).join('')}`
      const kSub = placeStepOf(id, false)
      const kAdd = placeStepOf(id, true)
      const dd = d(id)
      // 접경지 — 길로 맞닿은 남의 나라 고을이 있으면 그 나라 깃발과 이름 (형 10-31: "어디가 어딘지 모르겠다")
      const rivals = [...new Set(Object.values(base.edges).flatMap((e) => {
        const o = e.a === id ? e.b : e.b === id ? e.a : null
        const f = o !== null ? base.nodes[o]?.owner ?? null : null
        return f !== null && f !== me() && base.factions[f] !== undefined ? [f] : []
      }))].sort()
      const border = rivals.length > 0 ? `<span class="pltag bd">접경지 ${rivals.map((f) => `${emblem(f, 'plem')}${esc(base.factions[f]!.name)}`).join(' ')}</span>` : ''
      // 길 위에 이 고을로 오는 백성 — 계절마다 조금씩 닿는다 (형 10-31)
      const ib = inboundOf(n, me()) + Math.max(0, dd)
      const coming = ib > 0 ? `<span class="pltag go">${icon('unit-porters', 'plem')}오는 중 ${ib.toLocaleString('ko-KR')}가구 · ${turnsLabel(realm!, Math.ceil(ib / inboundRate(n, realm!)))}</span>` : ''
      h += `<div class="plcard${cap ? ' plcap' : ''}${dd !== 0 ? (dd > 0 ? ' up' : ' down') : ''}"><div class="plch"><b>${cap ? '<i class="star">★</i>' : ''}${esc(n.name)}</b><span class="mute">${cap ? '우리 도읍' : NODE_KIND_NAME[n.kind]}</span>${land}${border}${coming}</div>`
        + `<div class="plrow"><button class="btn sm" data-act="pl-sub" data-node="${id}"${kSub > 0 ? '' : noBtn(subWhy(id))}>−${kSub > 0 ? kSub : step}</button>`
        + `<div class="plmid"><b>${now.toLocaleString('ko-KR')}가구${dd !== 0 ? ` <i>${dd > 0 ? '+' : ''}${dd}</i>` : ''}</b><span class="plbar"><i style="width:${Math.min(100, Math.round((now / Math.max(1, room)) * 100))}%"></i></span><small>품 ${room.toLocaleString('ko-KR')} · ${yl} <small>계절마다 · 쌀은 한 해</small></small></div>`
        + `<button class="btn sm" data-act="pl-add" data-node="${id}"${kAdd > 0 ? '' : noBtn('더 받을 자리가 없거나 나눌 백성이 없습니다')}>+${kAdd > 0 ? kAdd : step}</button></div></div>`
    }
    // 우리 고을인데 못 옮기는 곳 — 말없이 빠지면 버그처럼 보인다. 흐리게 두고 까닭을 (형 10-24: "개마들머리 점령했는데 인구 이동에 없다")
    const cap = base.factions[me()]?.capital
    for (const n of sorted(Object.values(base.nodes)).filter((x) => x.owner === me() && x.kind !== 'sodo' && !ids.includes(x.id) && (x.kind !== 'wild' || x.hh > 0 || (x.room ?? 0) > 0))) {
      const why = cap !== undefined && migratePath(base, me(), cap, n.id, true) !== null ? '고갯길·물길이 이 철엔 막혀 못 오간다' : '도읍에서 우리 땅만 밟고는 닿지 않는다. 사이에 남의 땅이 있다'
      h += `<div class="plcard off"><div class="plch"><b>${esc(n.name)}</b><span class="mute">${NODE_KIND_NAME[n.kind]}</span></div><p class="mute">${why}</p></div>`
    }
    const moved = ids.some((id) => d(id) !== 0)
    h += `<div class="btns plfoot"><button class="btn ghost" data-act="pl-reset"${moved ? '' : noBtn('아직 옮긴 것이 없습니다')}>처음대로</button>`
      + `<button class="btn pri home" data-act="pl-ok"${pool === 0 && out > 0 ? '' : noBtn(pool > 0 ? '모아 둔 백성을 먼저 나눠 주세요' : '옮길 백성을 먼저 고르세요')}>${pool > 0 ? `모아 둔 백성 ${pool}가구를 먼저 나눈다` : '이대로 나눈다'}</button></div>`
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
    const going = partiesOf(r, me()).find((p) => p.march?.to === to || p.goal === to)
    if (going !== undefined) return h + `<button class="btn home wide stlgo on" data-act="ptok" data-army="${going.id}" data-node="${to}">${esc(r.nodes[going.home]?.name ?? '')} 개척단이 간다 · 백성 ${going.hh}가구</button></div>`
    const src = partySource(r, to)
    if (src === null) return h + capPartyHtml(r, to, 'stlgo') + `</div>`
    const k = partySize(r, me(), src.from, freeSite(n))
    const c = partyCost(r, me(), k, freeSite(n))
    h += `<button class="btn pri home wide stlgo" data-act="party-to" data-node="${to}" data-from="${src.from}" data-edge="${src.edge}">${esc(r.nodes[src.from]?.name ?? '')}에서 개척단 보내기${settleRec(r) === to ? recSt() : ''}</button>`
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
    const grand = c.kind === 'skyfest' && c.grand === true
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
      return `<div class="cardc story${info.bad ? ' bad' : ''}" data-act="card-beat">${img}<div class="cb"><b>${icon(info.icon, 'cic')}${esc(info.name)}${sevPips(c.sev)}</b>`
        + beatHtml(beats[at]!) + `<div class="cnav"><small>${at + 1}/${beats.length} · 누르면 다음 ›</small><button class="cskip" data-act="card-skip">건너뛰기 »</button></div></div></div>`
    }
    // 쫓겨 온 사람은 받기 전에 누구인지 — 얼굴 · 이름 · 특성
    // 연정 소문은 두 사람 얼굴을 나란히 — 탭탭 넘기다 와도 누가 누구인지 (형 10-29: "누가 누구랑 뭔 일 있는지 전혀 모른다")
    const who0 = guest !== undefined ? `<div class="cguest">${bust(guest, 'cof')}<span><b>${esc(guest.name)}</b><span class="wtr">${traitChips(guest, true)}</span></span></div>`
      : grand && c.hero !== undefined && c.hero2 !== undefined && r.heroes[c.hero] !== undefined && r.heroes[c.hero2] !== undefined ? `<div class="cguest">${bust(r.heroes[c.hero]!, 'cof')}<b>${esc(r.heroes[c.hero]!.name)}</b><span class="cheart">⚔</span>${bust(r.heroes[c.hero2]!, 'cof')}<b>${esc(r.heroes[c.hero2]!.name)}</b></div>`
      : c.kind === 'romance' && qa !== undefined && qb !== undefined ? `<div class="cguest">${bust(qa, 'cof')}<b>${esc(qa.name)}</b><span class="cheart">♥</span>${bust(qb, 'cof')}<b>${esc(qb.name)}</b></div>` : ''
    let h = `<div class="cardc${info.bad ? ' bad' : ''}${info.opts.length > 2 ? ' n3' : ''}">${img}<div class="cb"><b>${icon(info.icon, 'cic')}${esc(info.name)}${sevPips(c.sev)}</b>${who0}<p class="cask">${esc(sub(info.ask))}</p><div class="copts">`
    // 고르지 않았을 때 걸리는 답 — 엔진(events.resolveCard)과 같게: 망명자는 둘째(돌려보낸다) · 장수 다툼은 침묵
    const fallback = cardFallback(c.kind, grand)
    info.opts.forEach((o, i) => {
      // 그 답이 어느 장수 쪽인지 — 답 이름에 먼저 나오는 장수의 얼굴을 곁에 (형 10-25: "누구 편 든다 할 때 장수들 얼굴 이미지도 있어야")
      const ia = o.name.indexOf('{a}')
      const ib = o.name.indexOf('{b}')
      const who = ia >= 0 && (ib < 0 || ia < ib) ? c.hero : ib >= 0 ? c.hero2 : undefined
      const face = grand && o.icon !== undefined ? icon(o.icon, 'cof cofi') : who != null && r.heroes[who] !== undefined ? bust(r.heroes[who], 'cof') : guest !== undefined && i === 0 ? bust(guest, 'cof') : ''
      // 얻고 잃는 것 — 아이콘·숫자로. 굴리는 답이면 % 와 「이루면 · 어긋나면」 (ODDS: 사건 카드의 답은 % + 갈래마다 아이콘·숫자)
      // 바다도적 막기 — 쏜 뒤에는 그 결과(막은 물결 수)를 그대로 보이고, 다른 답은 잠긴다 (SNIPE §0-9)
      const held = cardHeld[`card:${c.season}`]
      const heldFor = grand ? (held !== undefined && pick === i ? held : undefined) : i === 1 ? held : undefined
      const pv = cardPreview(r, c, i === 2 ? 2 : i === 0 ? 0 : 1, left(), heldFor, cardPerfect[`card:${c.season}`] === true)
      let fx = ''
      if (pv !== null) {
        const sure = fxHtml(r, pv.sure)
        if (pv.hand === true) {
          // 직접 쏜다 — 확률이 아니라 활 · 다 막으면 · 첫 물결에 뚫리면 (오래 버틸수록 덜 잃는다)
          fx = grand
            ? `<span class="cfx"><small>${i === 0 ? '맞히면' : '이기면'}</small>${fxHtml(r, pv.win ?? {})}</span>${((lz) => lz.includes('class="cnone"') ? '' : `<span class="cfx"><small>${i === 0 ? '빗나가면' : '지면'}</small>${lz}</span>`)(fxHtml(r, pv.lose ?? {}))}`
            : `<span class="codd">🏹</span><span class="cfx"><small>다 막으면</small>${fxHtml(r, pv.win ?? {})}</span><span class="cfx"><small>뚫리면</small>${fxHtml(r, pv.lose ?? {})}</span>`
        } else if (grand && pv.good !== undefined && heldFor !== undefined) fx = `<span class="codd">${i === 0 ? (pv.good ? '🎯 맞혔다' : '🎯 빗나갔다') : (pv.good ? '⚔ 이겼다' : '⚔ 졌다')}</span><span class="cfx">${sure}</span>`
        else if (pv.good !== undefined && held !== undefined && i === 1) fx = `<span class="codd">🏹 ${held}/3</span><span class="cfx">${sure}</span>`
        else if (pv.chance === undefined) fx = `<span class="cfx">${sure}</span>`
        else {
          if (!sure.includes('cnone')) fx += `<span class="cfx">${sure}</span>`
          fx += `<span class="codd">${chanceFeel(pv.chance)}</span>`
          fx += `<span class="cfx"><small>이루면</small>${fxHtml(r, pv.win ?? {})}</span><span class="cfx"><small>어긋나면</small>${fxHtml(r, pv.lose ?? {})}</span>`
        }
      }
      // 답은 이름 한 마디 + 얻고 잃는 그림 — 긴 뜻은 길게 누르면 (data-tip)
      const duelOff = grand && i === 1 && (c.hero === undefined || c.hero2 === undefined) ? noBtn('겨룰 장수가 없습니다') : ''
      const locked = grand ? (held !== undefined && i !== pick ? noBtn('이미 겨루었습니다') : duelOff) : held !== undefined && i !== 1 ? noBtn('이미 활을 쏘아 맞섰습니다') : ''
      h += `<button class="copt${pick === i ? ' on' : ''}${face !== '' ? ' hasf' : ''}" data-act="card-pick" data-v="${i}" data-tip="${esc(sub(o.does))}"${locked}>${face}<span class="cot"><b>${esc(sub(o.name))}</b>${fx}${i === fallback && pick === null ? '<i>고르지 않으면 이것</i>' : ''}</span></button>`
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
      + `<button class="copt hasf${ans === true ? ' on' : ''}" data-act="wand-pick" data-id="${w.hero.id}" data-v="1"${can ? '' : noBtn('곡식이 모자랍니다')}>${bust(w.hero, 'cof')}<span class="cot"><b>들인다</b><span>${costHtml({ grain: w.price })}</span></span></button>`
      + `<button class="copt${ans === false ? ' on' : ''}" data-act="wand-pick" data-id="${w.hero.id}" data-v="0"><span class="cot"><b>나중에 정한다</b><span>${turnsLabel(r, stay)} 안에 떠난다 · 장수 탭에서 들일 수 있다</span></span></button>`
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
    h += `<span class="mute">${esc(lead?.name ?? '')}</span></div>${moodImg(ART, moodOf(realm!, me(), a.from).mood, 'mood fmood')}${relChipHtml(realm!, a.from)}</div><p>${esc(askLine(a, realm!.factions[a.from]?.name ?? '', a.node !== undefined ? (realm!.nodes[a.node]?.name ?? '') : '', realm!))}</p>`
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
      // 각성 연출이 떠 있으면 다 걷힌 뒤에 — 연출 뒤로 사신 목소리가 깔리지 않게 (형 11-05)
      whenClear(() => {
        window.setTimeout(() => ding(snd(threat ? 'bad_small' : 'envoy'), 0.5), 200)
      if (lead !== undefined) window.setTimeout(() => { if (document.querySelector('.ap .aud') !== null && voiceGate(performance.now())) ding(say.voice, P.realm.voiceVol) }, P.realm.chiefVoiceMs)
      })
    }
    const face = bustHd(lead, 'audlord') || bust(lead, 'audlord')
    const what = askLine(a, f?.name ?? '', a.node !== undefined ? (r.nodes[a.node]?.name ?? '') : '', r)
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
    return `<h4>사신이 왔다 · 이번 ${turnWord(realm!)} 안에 답한다</h4>` + asks.map(askCard).join('')
  }

  /** 못 하는 단추를 눌렀다 — 단추 위에 까닭 한 줄이 튀어 올랐다 걷히고, 둔탁한 소리·짧은 떨림 (스스로 걷힌다 · 누르면 바로 걷힌다) */
  function denyPop(at: HTMLElement, why: string): void {
    ding(snd('tap_cancel'), 0.5, 0.7)
    buzz([25, 40, 25])
    at.classList.remove('dnshake')
    void at.offsetWidth
    at.classList.add('dnshake')
    tipPop(at, why)
  }

  /** 단추 위에 한 줄 — 까닭이든 뜻풀이든. 글 길이만큼 머물고 누르면 닫힌다 (메모리: 알림은 반드시 걷힌다) */
  function tipPop(at: HTMLElement, why: string): void {
    root.querySelector('.dnpop')?.remove()
    if (why === '') return
    const b = at.getBoundingClientRect()
    const el = document.createElement('div')
    el.className = 'dnpop'
    el.textContent = why
    const life = noticeMs(why, P.realm.denyPopMs)
    el.style.cssText = `left:${Math.round(Math.min(innerWidth - 12, Math.max(12, b.left + b.width / 2)))}px;top:${Math.round(Math.max(8, b.top - 8))}px;animation-duration:${life}ms`
    el.addEventListener('click', () => el.remove())
    root.append(el)
    window.setTimeout(() => el.remove(), life)
  }

  /** 못 하는 단추의 꼬리표 — disabled 대신 (disabled 는 눌러도 아무 일이 없다). 누르면 denyPop 이 까닭을 띄운다 */
  const noBtn = (why: string): string => ` aria-disabled="true" data-why="${esc(why)}"`
  /** 모자란 것 — 「모자람: 나무 12 · 곡식 5」 (없으면 '') */
  function shortOf(need: Partial<Record<Good, number>>): string {
    const have = left()
    const miss = (Object.entries(need) as Array<[Good, number]>).filter(([g, n]) => n > 0 && have[g] < n).map(([g, n]) => `${GOOD_NAME[g]} ${Math.ceil(n - have[g])}`)
    return miss.length > 0 ? `모자람: ${miss.join(' · ')}` : ''
  }
  /** 그 고을에 가장 빨리 닿는 쉬는 우리 군대 — 옆 길이면 movesOf, 멀면 goalReach (고을 카드의 「군사 보내기」) */
  function senderFor(r: Realm, to: string): { army: string; seasons: number } | null {
    let best: { army: string; seasons: number } | null = null
    for (const a of sorted(Object.values(r.armies)).filter((x) => x.faction === me() && x.march === null && x.at !== to)) {
      const near = movesOf(r, me(), a).find((m) => m.to === to && m.blocked === null)
      const k = near?.seasons ?? goalReach(r, me(), a.at).get(to)?.seasons
      if (k !== undefined && (best === null || k < best.seasons)) best = { army: a.id, seasons: k }
    }
    return best
  }
  /** 목책·해자를 지금 못 두르는 까닭 */
  function buildWhy(r: Realm, id: string, what: BuildWhat): string {
    const going = (r.builds ?? []).find((b) => b.node === id)
    if (going !== undefined) return `${BUILD_NAME[going.what]} 짓는 중입니다 · ${turnsLabel(r, Math.max(1, going.done - r.season + 1))} 남음`
    const bc = buildCost(what, r, me())
    return shortOf({ wood: bc.wood, grain: bc.grain }) || '지금은 지을 수 없습니다'
  }

  /** 남과 맞닿은 우리 고을 가운데 지금 두를 수 있는 곳 — 「한꺼번에 두르기」 (값은 이미 고른 것 뒤에 남는 곳간으로 센다) */
  function wallPlan(r: Realm): { list: Array<{ node: string; what: BuildWhat }>; wood: number; grain: number; ok: boolean; why: string } {
    const front = (id: string): boolean => Object.values(r.edges).some((e) => {
      const o = e.a === id ? e.b : e.b === id ? e.a : null
      const ow = o === null ? null : r.nodes[o]?.owner
      return ow !== null && ow !== undefined && ow !== me()
    })
    const list: Array<{ node: string; what: BuildWhat }> = []
    let wood = 0
    let grain = 0
    for (const n of Object.values(r.nodes).sort((a, b) => b.hh - a.hh || (a.id < b.id ? -1 : 1))) {
      if (n.owner !== me() || !front(n.id) || musters.some((o) => o.kind === 'build' && o.node === n.id)) continue
      const w = nextBuild(r, n.id)
      if (w === null || !canBuild(r, me(), n.id, w)) continue
      const c = buildCost(w, r, me())
      list.push({ node: n.id, what: w })
      wood += c.wood
      grain += c.grain
    }
    const st = left()
    const ok = list.length > 0 && st.wood >= wood && st.grain >= grain
    return { list, wood, grain, ok, why: ok ? '' : shortOf({ wood, grain }) || '두를 고을이 없습니다' }
  }

  function guardOrder(node: string): Order {
    const ap = guardAp[node]
    return { kind: 'guard', faction: me(), node, ...(ap !== undefined ? { ap } : {}) }
  }

  /** 경계 강화한 고을의 지킬 길 칩 — 길이 대로뿐이면 없다 · 안 고르면 지키는 장수에게 맡긴다 */
  function guardPathHtml(r: Realm, node: string): string {
    if (!guards.includes(node)) return ''
    const ops = guardOptions(r, node)
    if (ops.length < 2) return ''
    const cur = guardAp[node]
    let h = `<div class="grdap"><span class="mute">지킬 길</span>`
    h += `<button class="btn sm ${cur === undefined ? 'on' : ''}" data-act="guard-ap" data-node="${node}" data-ap="" data-tip="지키는 장수가 적의 버릇·지난번 길을 보고 고른다">장수에게</button>`
    for (const ap of ops) h += `<button class="btn sm ${cur === ap ? 'on' : ''}" data-act="guard-ap" data-node="${node}" data-ap="${ap}" data-tip="적이 이 길로 오면 기습이 잘 들킨다 · 다른 길로 오면 조금 덜 들킨다">${icon(AP_CHIP[ap][0])}${AP_CHIP[ap][1]}</button>`
    return h + `</div>`
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
      h += `<div class="row foerow">${emblem(a.faction)}<span class="fet">${esc(realm!.factions[a.faction]?.name ?? '')} → <b>${esc(realm!.nodes[to]?.name ?? '')}</b> · ${turnsLabel(r, a.march!.left)}${suspect.has(a.id) ? ' · <span class="sus">몰래 오는 낌새</span>' : ''}</span>`
      h += `<button class="btn sm ${on ? 'on' : ''}" data-act="guard" data-node="${to}"${can ? '' : noBtn('경계를 올릴 수 없습니다: 곡식이 모자라거나 이미 올렸습니다')}>경계 강화 ${costHtml({ grain: guardCost().grain })}</button></div>`
      h += guardPathHtml(r, to)
    }
    return h
  }

  // ───────── 소도
  /**
   * 소도의 제사 (형: "소도는 왜있는거고?") — 씨 뿌린 봄과 거둔 가을에 귀신에게 제사한다 (삼한 사료).
   * 소도와 맞닿은 고을을 쥔 나라만 지낸다 — 그래서 소도 곁 땅이 다툴 거리가 된다. 소도 안의 군대는 아무도 못 친다.
   */
  function riteCard(r: Realm): string {
    const season = seasonOf(r)
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
    else if (!rite && !riteAllowed(r, me())) h += `<div class="btns"><button class="btn wide ritebtn" data-act="rite"${noBtn('소도 곁 고을이 없거나 곡식이 모자랍니다')}><b>${label}</b>${cost}<span class="gain">${gain}</span></button></div>`
    else h += `<div class="btns"><button class="btn ${rite ? 'on' : ''} wide ritebtn" data-act="rite"${short ? noBtn('제사 곡식이나 쇠가 모자랍니다') : ''}><b>${rite ? `${label} · 누르면 거둔다` : label}</b>${cost}<span class="gain">${gain}</span></button></div>`
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
    let h = `<div class="hands"><div class="hf">${slots.map((s) => `<span class="${s.job !== undefined ? 'used' : ''}">${s.face}<small>${s.job !== undefined ? esc(s.job) : s.id === undefined ? '보낼 수 있다' : '쉰다'}</small>${s.gov === true ? `<i class="gvtag">${tr('dip.govTag')}</i>` : ''}</span>`).join('')}</div>`
    h += `<div class="ht"><b>이번 ${turnWord(r)} 보낼 사람 ${Math.min(used, cap)}/${cap}${govs.length > 0 ? ` · 고을지기 ${govs.length}` : ''}</b></div></div>`
    if (used >= cap) h += `<div class="banner ${freeGovernors(r).length > 0 ? '' : 'bad'}">${tx(freeGovernors(r).length > 0 ? `사자와 쉬는 장수는 다 나갔다. 고을을 맡은 장수는 몸소 보낼 수 있다. 그 ${turnWord(r)}엔 고을을 비운다.` : '보낼 사람이 다 나갔다. 장수를 군대에서 빼서 쉬게 하면 더 보낼 수 있다.')}</div>`
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
    let h = `<h3 class="qh">${tr('dip.title')} ${guideBtn(diploMode)}</h3><div class="seg dseg"><button class="${diploMode === 'envoy' ? 'on' : ''}" data-act="dmode" data-v="envoy">${tr('dip.envoy')}</button><button class="${diploMode === 'plot' ? 'on' : ''}" data-act="dmode" data-v="plot">${tr('dip.plot')} ${plots.length > 0 ? plots.length : ''}</button><button class="${diploMode === 'scout' ? 'on' : ''}" data-act="dmode" data-v="scout">${tr('dip.scout')} ${scouts.length}/${scoutCap(r, me())}</button></div>`
    // 정찰은 사람 손을 안 쓴다 — 장수 얼굴 줄 대신 정찰꾼 그림 (형 10-23: "정찰에는 장수 얼굴을 보여 줄 필요 없으니 정찰꾼 그래픽")
    if (diploMode === 'scout') return h + scoutSheet(r)
    h += handsHtml(r)
    if (diploMode === 'plot') return h + plotSheet(r)
    const only = diploOnly !== '' && r.factions[diploOnly] !== undefined ? diploOnly : ''
    if (only !== '') h += `<button class="btn ghost sm dall" data-act="diplo-all">${tr('dip.allNations')}</button>`
    if (only === '') h += asksHtml()
    const out = Object.values(envoys).filter((e) => only === '' || e.to === only)
    for (const e of out) h += sentBanner(r, e, true)
    // 맺으면 뭐가 되는지는 ? 안에 (GUIDE.envoy — 형 10-23: "탭마다 있는 설명 고봉밥들은 전부 다 물음표에")
    // 앞서가는 나라 — 모두 이기려 하니, 앞선 나라는 다른 나라들이 함께 막으려 한다 (stance.leaderOf)
    // 외교 추천 — 이번 계절 손볼 만한 이웃 (advice.ts · 형 10-31) · 누르면 그 나라 카드가 펼쳐진다
    const order = { chance: 0, strong: 1, met: 2 } as const
    if (only === '') for (const t of diploTips(r, me()).sort((a, b) => order[a.kind] - order[b.kind]).slice(0, 2)) h += `<div class="banner${t.kind === 'chance' ? ' good' : t.kind === 'strong' ? ' bad' : ''} an" data-act="fopen" data-to="${t.to}">${emblem(t.to, 'fem')}<span class="txw">${tx(tipText(r, t))}</span></div>`
    const L = only === '' ? leaderOf(r, me()) : null
    if (L === me()) h += `<div class="banner bad">${tr('dip.weLead')}</div>`
    else if (L !== null && met(r, me(), L)) h += `<div class="banner">${tr('dip.leaderIs', { emb: emblem(L, 'fem'), name: esc(r.factions[L]?.name ?? '') })}</div>`
    // 지금 벌어진 전쟁 — 아는 나라끼리 (형: "누구랑 누가 전쟁나면 그걸 좀 잘 보여줬음")
    const live = sorted(Object.values(r.factions)).filter((x) => x.id !== me() && met(r, me(), x.id) && Object.values(r.nodes).some((n) => n.owner === x.id))
    const wars: string[] = []
    for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
      if (relationOf(r, live[i]!.id, live[j]!.id).state === 'war') wars.push(`<div class="warbar">${emblem(live[i]!.id, 'fem')}<i>⚔</i>${emblem(live[j]!.id, 'fem')}<span>${tx(`${live[i]!.name} · ${live[j]!.name}`)}</span></div>`)
    }
    if (wars.length > 0 && only === '') h += `<h4>${tr('dip.warsNow')}</h4>${wars.join('')}`
    // 땅이 하나도 없는 나라(무너진 나라)는 사신을 받을 곳이 없다 — 맨 아래에 이름만 (형: "지도에없는나라인데 상호작용까지 아직도 가능")
    const hasLand = (f: string): boolean => Object.values(r.nodes).some((n) => n.owner === f)
    const gone = sorted(Object.values(r.factions)).filter((x) => x.id !== me() && met(r, me(), x.id) && !hasLand(x.id))
    for (const f of sorted(Object.values(r.factions)).filter((x) => x.id !== me() && met(r, me(), x.id) && hasLand(x.id) && (only === '' || x.id === only))) {
      const rel = relationOf(r, me(), f.id)
      const left = rel.until !== null ? ` ${turnsLabel(r, Math.max(0, rel.until - r.season))}` : ''
      const lead = r.heroes[f.ruler ?? rulerId(f.id)]
      const md = moodOf(r, me(), f.id)
      // 꾸미는 중이거나 보낸 사신이 있는 나라는 펼친 채로
      const fo = diploOpen.has(f.id) || compose.to === f.id
      h += `<div class="fcard${fo ? ' open' : ' shut'}"><div class="an fhd" data-act="fopen" data-to="${f.id}">${lead !== undefined ? `<button class="fbtn" data-act="hero" data-id="${lead.id}">${bust(lead, 'rface')}</button>` : ''}<div class="fn"><b>${emblem(f.id, 'fem')}${esc(f.name)}</b><span class="mute">${lead !== undefined ? `${tr('dip.ruler', { name: nameHtml(lead.name) })}${lead.status === 'captive' ? tr('dip.captive') : lead.status === 'dead' ? tr('dip.dead') : ''}` : ''}</span></div>${moodImg(ART, md.mood, 'mood fmood')}<span class="rel ${rel.state}">${REL_NAME[rel.state]}${left}</span><i class="fchev">${fo ? '▾' : '▸'}</i></div>`
      if (!fo) { h += `</div>`; continue }
      h += `<div class="moodl ${md.mood}">${moodImg(ART, md.mood)}<div><b>${esc(MOOD_WORD[md.mood])}</b>${said(advisor(r), md.say)}</div></div>`
      h += `<div class="frow"><span class="mute">${REL_NOW[rel.state]}</span>${favorFeel(favorOf(r, me(), f.id))}</div>`
      // 우리 사이에 있었던 일 — 언제 누가 무엇을 (형: "이나라가 나한테 잘못한일 잘한일 이런거를 언제 그랬는지와 함께")
      const deeds = (rel.deeds ?? []).slice().reverse()
      if (deeds.length > 0) {
        const open = deedsOpen.has(f.id)
        h += `<div class="deeds"><h5>${tr('dip.deedsH')}</h5>`
        for (const d of open ? deeds : deeds.slice(0, 3)) {
          const t = deedText(r, me(), f.id, d)
          h += `<div class="dd ${t.tone}"><span>${seasonLabel(r, d.s)}</span>${esc(t.text)}</div>`
        }
        if (deeds.length > 3) h += `<button class="btn ghost sm" data-act="deeds" data-to="${f.id}">${open ? tr('dip.fold') : tr('dip.moreN', { n: deeds.length - 3 })}</button>`
        h += `</div>`
      }
      // 그쪽 속셈 — 첩자를 심었거나 동맹일 때만 보인다 (형: "속셈은 아무에게나 드러내게 하지 말고 … 간접정보로"). 깰 속셈은 안 보인다
      const tw = readsMind(r, f.id) ? truceWhy(r, f.id, me()) : null
      const aw = tw === null && readsMind(r, f.id) ? allianceWhy(r, f.id, me()) : null
      const mw = tw ?? aw
      if (mw !== null) {
        h += heardHtml(r, f.id, `${tw !== null ? tr('dip.hearTruce') : tr('dip.hearAlly')}:${whyLine(mw.why, mw.about !== undefined ? (r.factions[mw.about]?.name ?? '') : '')}`)
      } else if (readsMind(r, f.id) && rel.state === 'war' && winningAgainst(r, f.id, me())) h += heardHtml(r, f.id, tr('dip.theyWin'))
      // 맺은 약속 — 두 계절 안에 칠 곳 (동맹의 "함께 치자")
      for (const p of rel.pledges ?? []) {
        const who = p.by === me() ? tr('dip.weSub') : tr('dip.subj', { name: f.name })
        h += `<div class="banner ${p.by === me() ? 'bad' : 'good'}">${tr('dip.pledge', { who: esc(who), node: esc(r.nodes[p.node]?.name ?? ''), when: turnsLabel(r, Math.max(0, p.until - r.season)) })}</div>`
      }
      // 사이에 따라 보낼 수 있는 사신이 다르다 (형: "동맹 되고나서도 동맹버튼이 아직도 활성이면 뭘 의미하는거고")
      h += askButtons(r, f.id, '')
      h += `</div>`
    }
    if (gone.length > 0 && only === '') h += `<h4>${tr('dip.fallen')}</h4><p class="mute">${gone.map((f) => `${emblem(f.id, 'fem')}${esc(f.name)}`).join(' · ')}</p>`
    return h
  }

  /** 보낸 사신 한 줄 — 누가 갔나(얼굴) · 어느 나라에 무엇을 · 거두기 */
  function sentBanner(r: Realm, e: Envoy, nation: boolean): string {
    const who = e.hero !== undefined ? r.heroes[e.hero] : undefined
    const face = who !== undefined ? bust(who, 'sface') : icon('unit-scouts', 'sface')
    const whoName = who !== undefined ? who.name : tr('dip.envoyName')
    return `<div class="banner good sentb">${face}<span>${tx(tr('dip.goes', { who: whoName, to: nation ? tr('dip.toNation', { name: r.factions[e.to]?.name ?? '' }) : '', ask: ASK_NAME[e.ask] }))}${envoyWhere(r, e)}</span><button class="btn ghost sm" data-act="unenvoy" data-key="${ekey(e.to, e.ask)}">${tr('x.recall')}</button></div>`
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
      h += `<button class="btn${sm}${sel ? ' on' : ''}${open ? ' open' : ''}${ask === 'break' ? ' ghost' : ''}" ${sel ? `data-act="unenvoy" data-key="${k}"` : `data-act="compose" data-to="${to}" data-ask="${ask}"`} ${clash || (!sel && handsOut(r)) ? noBtn(clash ? tr('dip.clash') : tr('dip.handsFull')) : ''}>`
      // 청마다 그림 — 화친·교역·선물·조공 요구… (형 10-24: "이것들도 다 아이콘 만들어 와 · 직관화")
      h += `${icon(`ask-${ask}`, 'aic')}<span class="al">${askLabel(r, to, ask)}${sel ? tr('dip.sentMark') : ''}</span>${sel || sure ? '' : envoyFeel(c[0], c[1], ask)}</button>`
      // 꾸미는 칸은 누른 단추 바로 밑에 (형 10-25: "누르면 바로밑에 열려야 하는데 너무 멀리 조공요구 밑에서 열림")
      if (open) h += composeHtml(r, to)
    }
    h += `</div>`
    // 단추가 왜 꺼졌나 — 보낼 사람이 다 나갔다
    if (handsOut(r)) h += `<p class="mute">${tx(tr('dip.noHands', { used: handsUsed(), cap: handsCap(r) }))}</p>`
    else if (handsFull(r)) h += `<p class="mute">${tx(tr('dip.envoysOut'))}</p>`
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
    let h = `<div class="who"><div class="nal">${tr('dip.whoGoes')}</div><div class="wlist">`
    // 사자·쉬는 장수가 다 나갔으면 사자는 흐리게 — 고을을 맡은 장수는 몸소 간다
    h += `<button class="wg${anon ? (compose.hero === '' ? ' on' : '') : ' off'}" data-act="chero" data-id=""${anon ? '' : noBtn(tr('dip.envoysGone'))}>${icon('unit-scouts', 'wfc')}<b>${tr('dip.envoyName')}</b>${anon ? feel() : `<i class="busyw">${tr('dip.allOut')}</i>`}</button>`
    for (const x of goers) {
      const trt = (x.traits ?? []).filter((t) => t === 'charm' || (ask === 'trade' && t === 'trader')).map((t) => TRAIT[t]?.name).filter((t) => t !== undefined)[0]
      h += `<button class="wg${compose.hero === x.id ? ' on' : ''}" data-act="chero" data-id="${x.id}">${bust(x, 'wfc')}<b>${esc(x.name)}</b>`
      h += `${x.post != null ? `<i class="gvtag">${tr('dip.govTag')}</i>` : ''}${trt !== undefined ? `<i>${esc(trt)}</i>` : ''}${feel(x.id)}`
      h += `</button>`
    }
    // 못 가는 장수 — 흐리게 남기고 무슨 일인지 (형 10-23: "이미 다른 일 하고 있는데 … 뭘 일 시켰고 뭘 안 시켰는지 모르잖아")
    // 군대를 이끄는 장군도 흐리게 — 왜 못 가는지 보이게 (한 사람 한 가지 일 · 형 10-25: "군사를 맡은 장군은 사신으로 못 보내야")
    for (const x of mine.filter((y) => !can(y.id))) {
      const e = Object.values(envoys).find((v) => v.hero === x.id)
      const leads = Object.values(r.armies).some((a) => a.hero === x.id)
      const why = leads ? tr('dip.leadsArmy') : e !== undefined ? tr('dip.envoyOfN', { name: r.factions[e.to]?.name ?? '' }) : plots.some((p) => p.kind === 'plot' && p.agent === x.id) ? tr('dip.plot') : heroBusy(r, x.id) !== null ? heroBusy(r, x.id)!.replace(/^이번 (계절|달) /, '') : !handFor(r, x.id) ? tr('dip.handsShort') : tr('dip.otherJob')
      h += `<button class="wg off" data-act="busy"${noBtn(why)}>${bust(x, 'wfc')}<b>${esc(x.name)}</b><i class="busyw">${esc(why)}</i></button>`
    }
    h += `</div>`
    const went = compose.hero !== '' ? r.heroes[compose.hero] : undefined
    if (went !== undefined && relationOf(r, me(), to).state === 'war') h += `<p class="mute warnl">${tx(tr('dip.warCapt', { name: went.name }))}</p>`
    else if (went?.post != null) h += `<p class="mute">${tx(tr('dip.postEmpty', { turn: turnWord(r), node: r.nodes[went.post]?.name ?? '' }))}</p>`
    else if (mine.length > 0 && !mine.some((x) => can(x.id))) h += `<p class="mute">${tx(tr('dip.allBusy'))}</p>`
    else h += `<p class="mute">${tx(tr('dip.charmTip', { turn: turnWord(r) }))}</p>`
    return h + `</div>`
  }

  /** 사신 단추의 이름 — 깨기는 무엇을 깨는지 (형: "약조는 무슨약조를 했엇고 뭘 깨는지 알아야 할거같은데") */
  function askLabel(r: Realm, to: string, ask: Ask): string {
    if (ask !== 'break') return ASK_NAME[ask]
    return relationOf(r, me(), to).state === 'ally' ? tr('dip.breakAlly') : tr('dip.breakTruce')
  }

  /** 깨기 다짐 — 지금 맺은 것 · 깨면 무엇이 되는지 */
  function breakHint(r: Realm, to: string): string {
    const rel = relationOf(r, me(), to)
    const name = r.factions[to]?.name ?? ''
    const now = rel.state === 'ally'
      ? tr('dip.nowAlly', { name })
      : tr('dip.nowTruce', { name, left: rel.until !== null ? tr('dip.truceLeft', { when: turnsLabel(r, Math.max(0, rel.until - r.season)) }) : '' })
    return tr('dip.breakCost', { now, name, extra: rel.state === 'ally' ? tr('dip.breakExtra') : '' })
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
      h += `<div class="tflow"><span class="tfs">${emblem(me(), 'tfl')}<small>${tr('dip.us')}</small></span><span class="tfa ${dir}"><i>${dir === 'r' ? '➜' : dir === 'l' ? '⬅' : '⇄'}</i><small>${dir === 'r' ? tr('dip.flowR') : dir === 'l' ? tr('dip.flowL') : dir === 'eq' ? tr('dip.flowEq') : tr('dip.flowNone')}</small></span><span class="tfs">${emblem(to, 'tfl')}<small>${esc(r.factions[to]?.name ?? '')}</small></span></div>`
      h += `<div class="tgrid${give && take ? ' two' : ''}">`
      h += `${give ? `<span class="th give">${tr('dip.weGive')}</span>` : ''}<span class="th"></span>${take ? `<span class="th take">${tr('dip.weTake')}</span>` : ''}`
      for (const res of GOODS) {
        if (give) h += `<span class="tc give">${step('give', res)}<small>${tr('dip.stock', { n: Math.floor(goodOf(st, res)) })}</small></span>`
        h += `<span class="tg">${icon(GOOD_ICON[res])}<i>${GOOD_NAME[res]}</i></span>`
        if (take) h += `<span class="tc take">${step('take', res)}</span>`
      }
      h += `</div>`
      ok = GOODS.every((g) => compose.give[g] <= goodOf(st, g)) && GOODS.some((g) => compose.give[g] + compose.take[g] > 0)
      // 저들 창고에 그만큼 없다 — 받아 줄 수가 없다 (형: "상대 자원이 부족해서 거래가 성립이 안되면 어떻게 해야함??")
      const theirs = r.stock[to]
      const short = theirs !== undefined ? GOODS.filter((g) => compose.take[g] > goodOf(theirs, g)) : []
      if (short.length > 0) h += `<div class="banner bad">${tx(tr('dip.theirShort', { goods: short.map((g) => GOOD_NAME[g]).join('·') }))}</div>`
    } else if (need === 'place') {
      const places = ask === 'joint' ? jointTargets(r, me(), to) : sorted(Object.values(r.nodes)).filter((n) => n.owner === me()).map((n) => n.id)
      if (places.length === 0) h += `<div class="mute">${tr('dip.noPlace')}</div>`
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
    h += `<button class="btn pri" data-act="envoy" data-to="${to}" data-ask="${ask}"${ok ? '' : noBtn(!handFor(r, compose.hero) ? tr('dip.noSender') : tr('dip.pickFirst'))}>${ask === 'break' ? tr('dip.reallyBreak') : tr('dip.sendEnvoy')}${sure ? '' : ` ${envoyFeel(c[0], c[1], ask)}`}</button></div>`
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
    return `<span class="said">${face ?? bust(h, 'sface')}<span><i>${esc(who ?? (h !== undefined ? tr('dip.guessOf', { name: h.name }) : tr('dip.guessAnon')))}</i><q>${tx(text)}</q></span></span>`
  }
  /** 그 나라 속을 들은 말 — 첩자가 전했나, 동맹이 귀띔했나 (readsMind 일 때만) */
  // 말하는 이는 늘 우리 장수(꾀가 가장 높은 이) — 그 나라 군장이 제 속을 「저들이」라며 귀띔하는 꼴이었다 (형 10-25: "귀띔은 요청한 국가에서 직접 주는게 말이 되나? 우리 장수중하나여야")
  function heardHtml(r: Realm, f: string, text: string): string {
    const ally = relationOf(r, me(), f).state === 'ally'
    const adv = advisor(r)
    const src = ally ? tr('dip.heardAlly', { name: r.factions[f]?.name ?? '' }) : tr('dip.heardSpy')
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
    if (hand?.result === 'skip') return `<div class="banner">${tr(rescue ? 'plot.skipRescue' : 'plot.skipKill', { name: names.skip, seen: hand.seen === true ? tr('plot.seen') : '' })}</div>`
    if (hand !== undefined) {
      const good = rescue ? hand.result === 'cleared' : hand.result === 'dead' || hand.result === 'wounded'
      return `<div class="banner ${good ? 'good' : 'bad'}">${tr('plot.shot', { res: names[hand.result], alarm: hand.alarm ? tr('plot.alarm') : '', turn: turnWord(realm ?? {}) })}</div>`
    }
    // 구출 — 보초를 다 쓰러뜨리면 묶인 장수를 데려 나온다 (형 10-26: "구출작전은 암살이랑 비슷하게 활쏘기겜으로")
    if (rescue) return `<button class="btn pri wide" data-act="shoot" data-i="${i}">${icon('unit-archer')} ${tr('plot.rescueGo')}</button><p class="mute">${tr('plot.rescueNote')}</p>`
    return `<button class="btn pri wide" data-act="shoot" data-i="${i}">${icon('unit-archer')} ${tr('plot.shootGo')}</button><p class="mute">${tr('plot.shootNote')}</p>`
  }

  /** 맺은 나라를 노리는 공작 — 들키면 무엇이 깨지나 (형: "동맹한테 뭐 보내면 발각시 동맹 깨진다느니 그런거 있어야") */
  function pactWarn(r: Realm, target: string, op: PlotOp): string {
    const s = relationOf(r, me(), target).state
    if (s !== 'ally' && s !== 'truce') return ''
    const steps = op === 'assassin' ? 2 : 1
    const to = s === 'ally' ? (steps === 2 ? tr('plot.toNeutral') : tr('plot.toTruce')) : (steps === 2 ? tr('plot.toWar') : tr('plot.toNeutral'))
    // 이름 밑 둘째 줄에 — 이름 바로 뒤에 붙어 「소문 동맹」「방화 동맹」으로 읽히고 긴 말은 잘렸다 (형 10-25)
    return `<span class="pwarn">${tr('plot.pactWarn', { rel: REL_NAME[s], to, two: op === 'assassin' ? tr('plot.two') : '' })}</span>`
  }

  /** 공작에 간 이 — 장수 이름, 없으면 고용 자객(암살) · 알아서(나머지) */
  function plotWho(r: Realm, o: Order): string {
    if (o.kind !== 'plot') return ''
    if (o.agent !== undefined) return r.heroes[o.agent]?.name ?? ''
    return NIGHT_OPS.has(o.op) ? tr('plot.hiredKiller') : tr('plot.hiredSpy')
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
      night ? { agent: '', face: icon('unit-archer', 'fp'), name: tr('plot.hiredKiller'), sub: tr('plot.lossOnly'), tag: '' }
        : { agent: '', face: icon('status-spy', 'fp'), name: tr('plot.hiredSpy'), sub: tr('plot.ryak', { n: P.realm.plotHiredRyak }), tag: '' },
    ]
    for (const id of ids.slice(0, 8)) {
      const x = r.heroes[id]
      if (x === undefined) continue
      opts.push({ agent: id, face: bust(x, 'fp'), name: x.name, sub: night ? tr('plot.ryakEsc', { n: x.ryak, pct: Math.round(escapeChance(r, id) * 100) }) : tr('plot.ryak', { n: x.ryak }), tag: x.post != null ? `<i class="gvtag">${tr('dip.govTag')}</i>` : '' })
    }
    const rows = opts.map((o) => {
      const c = plotChance(r, me(), op, t.target, t.node, t.hero, o.agent === '' ? null : o.agent)
      const cost = plotCost(op, o.agent === '' ? null : o.agent)
      return { ...o, c, cost, ok: handFor(r, o.agent) && st.grain >= cost.grain && st.iron >= cost.iron }
    }).sort((a, b) => Number(b.agent !== '' && b.agent === plotAgent) - Number(a.agent !== '' && a.agent === plotAgent) || Number(b.ok) - Number(a.ok) || (b.c[0] + b.c[1]) - (a.c[0] + a.c[1]))
    let h = '<div class="pwhos"><div class="pwl">'
    for (const x of rows) {
      h += `<button class="pwho${x.agent !== '' && x.agent === plotAgent ? ' on' : ''}" data-act="plot" data-op="${op}" data-target="${t.target}" data-node="${t.node ?? ''}" data-other="${t.other ?? ''}" data-hero="${t.hero ?? ''}" data-agent="${x.agent}" ${x.ok ? '' : noBtn(tr('plot.noSend'))}>`
        + `${x.face}<b>${esc(x.name)}</b>${x.tag}<small>${esc(x.sub)}</small>${plotFeel(x.c[0], x.c[1])}${costHtml({ grain: x.cost.grain, iron: x.cost.iron })}</button>`
    }
    h += '</div>'
    // 들키면 누가 보냈는지 드러날 수 있다 — 드러나면 그 나라와 크게 틀어지고 다른 나라도 우리를 덜 믿는다
    const ex = exposeChance(r, me(), t.target, t.node, night ? null : undefined)
    h += `<p class="mute">${tr('plot.hide')} ${plotFeel(1 - ex, 1 - ex, false)}${night ? tr('plot.nightNote') : ''}</p>`
    if (handsFull(r)) h += `<p class="mute">${tx(tr('plot.handsOut'))}</p>`
    return h + '</div>'
  }

  /** 공작 한 갈래를 펼친 칸 — 노릴 곳 줄(하나뿐이면 바로 「누가 가나」) · 보낸 줄은 누가 갔나와 거두기 · 밤 공작은 직접 쏘기·자객의 활 */
  /** 이간 칸 — 두 빈칸에 깃발을 하나씩 넣으면 그 둘 사이를 노린다. 보낸 이간은 위에 줄로 (거두기) */
  function sowPanel(r: Realm, ts: PlotTarget[], full: boolean): string {
    let h = `<div class="rows">`
    for (const [i, o] of plots.entries()) {
      if (o.kind !== 'plot' || o.op !== 'sow') continue
      h += `<button class="row on" data-act="unplot" data-i="${i}"><span class="sowf">${emblem(o.target)}<i>⇄</i>${emblem(o.other ?? null)}</span><span class="dest">${esc(`${r.factions[o.target]?.name ?? ''} ↔ ${r.factions[o.other ?? '']?.name ?? ''}`)}<span class="pwent">${tr('plot.goes', { who: esc(plotWho(r, o)) })}</span></span><span class="win">${tr('x.recall')}</span></button>`
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
      if (t === undefined) h += `<p class="mute">${tr('plot.sowNone')}</p>`
      else if (plots.some(plotSame('sow', t))) h += `<p class="mute">${tr('plot.sentAlready')}</p>`
      else h += plotWhoHtml(r, 'sow', t)
    }
    return h
  }

  function plotPanel(r: Realm, op: PlotOp, ts: PlotTarget[], full: boolean): string {
    if (op === 'sow' && ts.length > 0) return sowPanel(r, ts, full)
    const night = NIGHT_OPS.has(op)
    if (ts.length === 0) return `<p class="mute">${op === 'rescue' ? tr('plot.noPrisoner') : `${tr('plot.nothing')}${op === 'bribe' || op === 'spy' ? ' ' + tr('plot.knownTown') : op === 'assassin' ? ' ' + tr('plot.duelled') : ''}`}</p>`
    let h = `<div class="rows">`
    for (const t of ts) {
      const i = plots.findIndex(plotSame(op, t))
      const sent = i >= 0 ? (plots[i] as Extract<Order, { kind: 'plot' }>) : undefined
      const k = plotKey(op, t)
      const open = sent === undefined && !full && (plotPick === k || ts.length === 1)
      const hero = t.hero !== undefined ? r.heroes[t.hero] : undefined
      const label = hero !== undefined ? (op === 'rescue' ? tr('plot.jailed', { hero: hero.name, nation: r.factions[t.target]?.name ?? '', node: r.nodes[t.node ?? '']?.name ?? '' }) : `${hero.name} · ${r.factions[t.target]?.name}`) : t.node !== undefined ? `${r.nodes[t.node]?.name} · ${r.factions[t.target]?.name}` : t.other !== undefined ? `${r.factions[t.target]?.name} ↔ ${r.factions[t.other]?.name}` : (r.factions[t.target]?.name ?? '')
      // 이간은 두 나라 깃발을 다 (형 10-25: "이간할 때 두 나라 국기 아이콘 다 나와야")
      const flags = hero !== undefined ? bust(hero, 'rface sm') : t.other !== undefined ? `<span class="sowf">${emblem(t.target)}<i>⇄</i>${emblem(t.other)}</span>` : emblem(t.target)
      if (sent !== undefined) {
        // 보냈다 — 누가 갔나 · 누르면 거둔다
        h += `<button class="row on" data-act="unplot" data-i="${i}">${flags}<span class="dest">${esc(label)}<span class="pwent">${tr('plot.goes', { who: esc(plotWho(r, sent)) })}</span></span><span class="win">${tr('x.recall')}</span></button>`
        // 고른 적장 바로 밑에 "직접 쏜다" (형: "직접쏜다버튼이 너무 위에있어서 적군눌러도 반응없는줄 알았음")
        if (night) h += shootHtml(i, sent)
        continue
      }
      const c = plotChance(r, me(), op, t.target, t.node, t.hero, night ? null : undefined)
      h += `<button class="row${open ? ' open' : ''}" data-act="ppick" data-op="${op}" data-k="${esc(k)}"${full ? noBtn(tr('dip.handsFull')) : ''}>${flags}<span class="dest">${esc(label)}${pactWarn(r, t.target, op)}</span><span class="win">${plotFeel(c[0], c[1])}</span></button>`
      if (open) h += plotWhoHtml(r, op, t)
    }
    h += `</div>`
    if (full) h += `<p class="mute">${plots.length >= plotCap(realm!) ? tr('plot.capLine', { turn: turnWord(realm!), n: plotCap(realm!) }) : tr('plot.allGone')}</p>`
    if (night) {
      // 자객의 활 — 계단으로 오른다 (형: "완만한 성장이 아니라 계단적 성장")
      const st = left()
      const bt = assassinBow(r, me())
      const bu = bowUpCost(r, me())
      const buying = musters.some((o) => o.kind === 'bowUp')
      h += `<div class="frow"><span class="mute">${tr('plot.bow', { name: esc(BOW_NAME[bt] ?? '') })}</span>`
      if (bu !== null) h += `<button class="btn sm ${buying ? 'ghost' : ''}" data-act="bowup"${buying || (st.grain >= bu.grain && st.iron >= bu.iron) ? '' : noBtn(tr('plot.bowShort'))}>${buying ? tr('plot.bowing') : tr('plot.bowUp', { name: esc(BOW_NAME[bu.to] ?? ''), cost: costHtml({ grain: bu.grain, iron: bu.iron }) })}</button>`
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
    const full = plots.length >= plotCap(realm!) || handsOut(r)
    const targetsOf = (op: PlotOp): PlotTarget[] => {
      const all = plotTargets(r, me(), op).filter((t) => met(r, me(), t.target)) // 아는 나라에만 (발견)
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
      const why = none ? tr('plot.whyNoPrisoner') : !away ? '' : op === 'sow' ? tr('plot.whySow') : op === 'assassin' ? tr('plot.whyNoFoe') : op === 'rescue' ? tr('plot.whyNoOurs') : tr('plot.whyDip')
      const open = plotOpen === op && !away && !none
      h += `<button class="pochip${open ? ' on' : ''}${sent > 0 ? ' sent' : ''}${away ? ' away' : ''}" data-act="${away ? 'cmd-plot' : 'plot-open'}" data-op="${op}" data-tip="${esc(`${PLOT_DOES[op](r)}${why !== '' ? ` · ${why}` : ''}`)}"${none ? noBtn(why !== '' ? why : tr('plot.nowhere')) : ''}>`
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
      h += `<div class="banner good">${sowF}${PLOT_NAME[o.op]} · ${esc(target ?? '')} · ${esc(plotWho(r, o))}<button class="btn ghost sm" data-act="unplot" data-i="${i}">${tr('x.recall')}</button></div>`
      // 암살·구출은 직접 쏠 수 있다 — 밤 판 (SNIPE §0). 안 쏘면 굴림. 그 칸을 펼쳤으면 보낸 줄 바로 밑에 띄운다
      if (NIGHT_OPS.has(o.op) && plotOpen !== o.op) h += shootHtml(i, o)
    }
    h += `<div class="nal">${tr('dip.plot')} <span class="mute">${tr('plot.capNow', { turn: turnWord(realm!), n: plotCap(realm!), now: plots.length })}</span></div>`
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
    openFrame(`${NIGHT}?seed=${seed}&arrows=${arrows}&bow=${bow}&guard=${guard}${kind}&id=plot-${i}&back=about:blank`, rescue ? tr('frame.rescue') : tr('frame.assassin'))
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
    if (a === undefined || f === undefined) { goToast(tr('toast.noPractice')); return }
    a.at = f.from
    a.march = { from: f.from, to: f.to, edge: f.edge, left: 1, ambush: false, aim: r.nodes[f.to]?.owner ?? null }
    // 장수 여럿 — 우리 군대 둘을 더 같은 길로 (비기·겨루기 「누가 나서나」 · 「누구를 잡나」도 시험되게)
    for (const b of mine.filter((x) => x !== a).slice(0, 2)) { b.at = f.from; b.march = { ...a.march } }
    // 개발판에서만 — 각성기를 바로 시험: window.__sparWake = 'water' | 'bolt' | 'earth' | 'wind' | 'fire' (버리는 연습 판의 앞 장수를 깨운다)
    const wk = import.meta.env.DEV ? (window as unknown as Record<string, unknown>)['__sparWake'] : undefined
    const lead = a.hero !== null ? r.heroes[a.hero] : undefined
    if (typeof wk === 'string' && lead !== undefined) {
      const trait: Record<string, string> = { water: 'river', bolt: 'shaman', wind: 'archer', earth: 'mountain', fire: 'smith' }
      r.heroes[lead.id] = { ...lead, traits: [trait[wk] ?? 'river', ...(lead.traits ?? []).filter((x) => !Object.values(trait).includes(x))], ascended: true, flames: Math.round(P.realm.ascendWins) }
    }
    // 개발판에서만 — 장수 겨루기를 바로 시험: window.__sparDuel = true (적장 있는 적군을 그 자리에 세우고, 우리 장수 무예를 나설 만큼)
    if (import.meta.env.DEV && (window as unknown as Record<string, unknown>)['__sparDuel'] === true) {
      const foeOwner = r.nodes[f.to]?.owner
      const foeA = sorted(Object.values(r.armies)).find((x) => x.faction === foeOwner && x.hero !== null)
      if (foeA !== undefined) foeA.at = f.to
      const l2 = a.hero !== null ? r.heroes[a.hero] : undefined
      if (l2 !== undefined && l2.mu < P.realm.tacDuelMu) r.heroes[l2.id] = { ...l2, mu: P.realm.tacDuelMu + 1 }
    }
    const back = (): void => { warOn = false; front = { kind: 'title' }; paint() }
    try {
      if (openWar(root, r, aiOrders(r), { art: ART, px: true, me: r.player, ding, warm: warmSfx, music: (k) => { if (k === 'war') music.war(); else music.result(k) }, done: back })) { warOn = true; music.war(); music.primeResults(); return }
    } catch (e) { failNote(e) }
    goToast(tr('toast.noFight'))
  }

  function openPractice(): void {
    const bow = realm !== null ? assassinBow(realm, me()) : 0
    openFrame(`${PRACTICE}&bow=${bow}&back=about:blank`, tr('frame.range'))
  }

  /**
   * 2장 송양의 활쏘기 겨루기 — 목표 띠 밑에 단추. 밤 판에서 직접 쏘고, 맞혔는지가 이 계절의 답(초안과 같이 탄다)이 되어
   * 계절이 넘어갈 때 엔진에 간다 (scenario.resolveContests · 점검 10-25: 장 소개가 약속하고 안 지키던 것)
   */
  function contestHtml(r: Realm): string {
    if (!contestOpen(r, me())) return ''
    const got = answers['contest:archery']
    if (got !== undefined) return `<div class="gcontest done${got ? ' won' : ''}">🏹 ${got ? tr('contest.hit') : tr('contest.miss')}<small>${tr('contest.done', { turn: turnWord(r) })}</small></div>`
    return `<button class="gcontest" data-act="contest">🏹 ${tr('contest.offer')}<small>${tr('contest.offerSub')}</small></button>`
  }
  /** 바다 도적 · 맞선다 — 포구의 낮 판을 지도 위 틀로. 끝나면 막은 물결 수가 이 계절의 답이 된다 (아래 message 받이) */
  function openPirate(): void {
    const c = realm?.card
    if (realm === null || c === undefined || c === null || (c.kind !== 'pirates' && c.kind !== 'bandits')) return
    const m = pirateMission(realm, c)
    const bow = assassinBow(realm, me())
    const by = c.kind === 'bandits'
    openFrame(`${PIRATE}?seed=${m.seed}&sev=${m.sev}&mu=${m.mu}&watch=${m.watch}&bow=${bow}${by ? '&mode=bandit' : ''}&id=card-${c.kind}-${c.season}&back=about:blank`, by ? tr('frame.bandit') : tr('frame.pirate'))
  }

  /** 제천 대회 · 활쏘기 겨루기 — 송양 활쏘기 판을 그대로 · 맞히면 이긴다 (아래 message 받이). 한 판에 한 과녁: 시드는 판·계절에서 */
  function openFestArchery(): void {
    const c = realm?.card
    if (realm === null || c === undefined || c === null || c.grand !== true) return
    const bow = assassinBow(realm, me())
    const seed = (realm.seed ^ Math.imul(c.season + 1, 2654435761) ^ 0x7e57) >>> 0
    // 송양 글 대신 제천 대회 글 · 맞수는 이웃의 이름난 장수(없으면 「이웃 나라 궁수」)
    const foe = c.hero2 !== undefined ? realm.heroes[c.hero2]?.name : undefined
    openFrame(`${CONTEST}?seed=${seed}&bow=${bow}&mode=fest${foe !== undefined ? `&foe=${encodeURIComponent(foe)}` : ''}&id=fest-archery-${c.season}&back=about:blank`, tr('frame.festArchery'))
  }
  /** 제천 대회 · 장수 겨루기 — 우리 무예 높은 장수와 이웃의 이름난 장수 (duel/view.ts). 끝나면 이김=1 · 짐=0 이 카드 답이 된다 · 비기면 무예가 앞선 쪽 */
  function openFestDuel(): void {
    const r = realm
    const c = r?.card
    if (r === null || c === undefined || c === null || c.grand !== true || c.hero === undefined || c.hero2 === undefined) return
    const a = r.heroes[c.hero]
    const b = r.heroes[c.hero2]
    if (a === undefined || b === undefined) return
    const side = (h: Hero): DuelSide => { const bb = bustOf(h.id); return { name: h.name, mu: h.mu, sprite: generalSprite(h), ...(bb !== undefined ? { portrait: bb } : {}) } }
    const s = c.season
    const seed = (r.seed ^ Math.imul(s + 1, 2654435761) ^ 0xd0e1) >>> 0
    void mountDuel({ me: side(a), foe: side(b), tier: clampTier(r.tier ?? 1), seed }).then((res) => {
      if (realm?.card?.grand !== true || realm.card.season !== s) return
      cardHeld[`card:${s}`] = (res === undefined ? a.mu >= b.mu : res === 'win') ? 1 : 0
      answers[`card:${s}`] = false
      delete answers[`hush:${s}`]
      saveDraft()
      paint()
    })
  }

  function openContest(): void {
    if (realm === null) return
    const bow = assassinBow(realm, me())
    const seed = (realm.seed ^ 0x51a7) >>> 0 // 한 판에 한 과녁 — 다시 열어도 같은 언덕
    openFrame(`${CONTEST}?seed=${seed}&bow=${bow}&id=contest-archery&back=about:blank`, tr('frame.contest'))
  }

  function openFrame(src: string, title: string): void {
    const ov = document.createElement('div')
    ov.className = 'nightov'
    ov.innerHTML = `<iframe src="${src}" title="${title}"></iframe><button class="btn" data-close>${tr('frame.close')}</button>`
    root.appendChild(ov)
    music.refresh()
    // 밑에서 돌던 각성 영상도 쉰다 — 틀이 어느 길로 닫히든(remove) 다시 튼다
    const held = [...root.querySelectorAll('video')].filter((v) => !v.paused)
    for (const v of held) v.pause()
    const back = new MutationObserver(() => {
      if (ov.isConnected) return
      back.disconnect()
      for (const v of held) if (v.isConnected) void v.play().catch(() => undefined)
    })
    back.observe(root, { childList: true })
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
    // 바다도적 막기 — 막은 물결 수가 「맞선다」의 답이 된다 · 쏘지 않고 나오면(skip) 아무것도 안 고른 채 틀을 닫는다
    const pm = ev.data as { type?: string; id?: string; held?: unknown; skip?: boolean; perfect?: boolean }
    if (pm?.type === 'hanbal.pirate.result' && typeof pm.id === 'string' && realm?.card != null && pm.id === `card-${realm.card.kind}-${realm.card.season}`) {
      const s = realm.card.season
      if (pm.skip === true) root.querySelector('.nightov')?.remove()
      else if (typeof pm.held === 'number' && Number.isFinite(pm.held)) {
        cardHeld[`card:${s}`] = Math.max(0, Math.min(3, Math.floor(pm.held)))
        cardPerfect[`card:${s}`] = pm.perfect === true && pm.held >= 3
        answers[`card:${s}`] = false
        delete answers[`hush:${s}`]
      }
      saveDraft()
      paint()
      return
    }
    // 제천 대회 활쏘기 — 맞히면(쓰러뜨리거나 다치게) 1 · 아니면 0. 돌아가기(건너뜀)로 나오면 노래와 춤
    if (m?.type === 'hanbal.night.result' && typeof m.id === 'string' && realm?.card?.grand === true && m.id === `fest-archery-${realm.card.season}` && m.result !== undefined && m.result !== 'cleared') {
      const s = realm.card.season
      if (m.result === 'skip') { root.querySelector('.nightov')?.remove(); answers[`card:${s}`] = false; answers[`hush:${s}`] = true }
      else { cardHeld[`card:${s}`] = m.result === 'dead' || m.result === 'wounded' ? 1 : 0; answers[`card:${s}`] = true; delete answers[`hush:${s}`] }
      saveDraft()
      paint()
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
    const work = h.faction !== me() || h.status !== 'free' ? '' : orderedByMe(h.id) ? ` <i class="hwk me">${tr('hero.cmdMark')}</i>`
      : !ours ? '' : job === null && !mine && realm !== null && autoIdle(realm) && (chan !== null || keeps) ? ` <i class="hwk au">${tr('hero.autoMark')}</i>` : ''
    return `<button class="hrow${isRuler(r, h.id) ? ' ruler' : ''}${job !== null ? ' busy' : ''}" data-act="hero" data-id="${h.id}">${bust(h)}${job !== null ? `<i class="hbz">⏳</i>` : ''}<span class="hb">`
      + `<b>${nameHtml(h.name)}${isRuler(r, h.id) ? ` <span class="mute">${tr('hero.ruler')}</span>` : ''}${h.drill !== undefined && h.drill.lv > 0 && h.faction === me() ? ` <span class="dlv">${tr('hero.drill', { n: h.drill.lv })}</span>` : ''}${h.faction === me() ? relicChips(ART, esc, h.relics, h.relicLv ?? {}) : ''}${mine ? ` <span class="jsm">${tr('hero.manual')}</span>` : ''}${work}${seen ? '' : ` <span class="heard">${tr('hero.heard')}</span>`}</b>`
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
    let h = `<div class="seg dseg">${tab('cmd', tr('hero.tabCmd'), 0)}${tab('mine', tr('hero.tabMine'), mine.length + wand.length)}${tab('jail', tr('hero.tabJail'), caps.length)}${tab('foe', tr('hero.tabFoe'), foes.length)}</div>`
    // 재상에게 맡기기 — 명령 칸·우리 장수 칸 맨 위에 (형 10-26)
    if (heroTab === 'mine' || (heroTab === 'cmd' && cmdJob === null)) h += chancellorBar()
    if (heroTab === 'cmd') return h + (cmdJob === null ? cmdGridHtml(r) : cmdWinHtml(r, cmdJob))
    if (heroTab === 'jail') {
      if (caps.length === 0) return h + `<p class="mute">${tr('hero.noJail')}</p>`
      h += `<p class="mute">${tr('hero.jailHint')} ${guideBtn('jail')}</p>`
      for (const x of caps) h += heroRow(r, x, miniHtml(wooKit(r), realm!, x.id))
      return h
    }
    if (heroTab === 'foe') {
      if (foes.length === 0) return h + `<p class="mute">${tr('hero.noFoe')}</p>`
      for (const x of foes) h += heroRow(r, x)
      return h
    }
    for (const x of ruler) h += heroRow(r, x)
    h += `<h4>${tr('hero.mineH')}</h4>`
    const hiredNow = new Set(heroOrders.flatMap((o) => (o.kind === 'hire' ? [o.hero] : [])))
    for (const x of mine.filter((y) => !isRuler(r, y.id))) h += heroRow(r, x, hiredNow.has(x.id) ? `<span class="newb">${tr('hero.newbie')}</span>` : '')
    // 자라는 아이 — 아직 장수가 아니라 일을 못 맡는다 (형 10-24)
    const kids = (r.growing ?? []).filter((g) => g.hero.faction === me())
    if (kids.length > 0) {
      h += `<h4>${tr('hero.kidsH')}</h4>`
      for (const g of kids) h += `<div class="hrow busy grow">${bust(g.hero)}<i class="hbz">⏳</i><span class="hb"><b>${nameHtml(g.hero.name)}</b><span class="hdo">⏳ ${tr('hero.growing', { when: turnsLabel(r, Math.max(1, g.grown - r.season)) })}</span><span class="mute">${tr('hero.childOf', { names: (g.hero.parents ?? []).map((p) => r.heroes[p]?.name ?? '').filter((s) => s !== '').join(' · ') })}</span></span></div>`
    }
    // 떠돌이 인재 — 들일 수 있는 이
    if (wand.length > 0) {
      h += `<h4>${tr('hero.wanderH')}</h4>`
      // 추천 딱지 — 곡식이 닿는 이 가운데 가장 센 하나 (아무도 안 들였을 때)
      const anyHired = heroOrders.some((o) => o.kind === 'hire')
      const pickW = anyHired ? undefined : [...wand].filter((w) => left().grain >= w.price).sort((a, b) => (b.hero.mu + b.hero.tong + b.hero.ryak + b.hero.chi) - (a.hero.mu + a.hero.tong + a.hero.ryak + a.hero.chi))[0]
      for (const w of wand) {
        const hired = heroOrders.some((o) => o.kind === 'hire' && o.hero === w.hero.id)
        h += `<div class="askc">${heroRow(r, w.hero, `<span class="mute">${tr('hero.leaves', { node: esc(r.nodes[w.node]?.name ?? ''), when: turnsLabel(r, Math.max(0, w.until - r.season)) })}</span>`)}`
        h += `<div class="btns"><button class="btn ${hired ? 'on' : ''}" data-act="hire" data-id="${w.hero.id}"${hired || left().grain >= w.price ? '' : noBtn(tr('hero.noGrain', { n: w.price }))}>${hired ? tr('hero.hireCancel') : `${tr('hero.hire')} ${costHtml({ grain: w.price })}`}${pickW === w ? recSt() : ''}</button></div></div>`
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
    if (heroOrders.some((o) => (o.kind === 'assign' || o.kind === 'lead' || o.kind === 'persuade') && o.hero === x.id)) return tr('hero.dropPost', { turn: turnWord(r) })
    if (job === 'wed') {
      if (x.spouse !== undefined || realm!.heroes[x.id]?.spouse !== undefined) return tr('hero.hasMate')
      return wedHtml(r, x) === '' ? tr('hero.noMate') : null
    }
    // 장군은 군대를 떠나지 않는다 — 사신·자객으로 못 간다 (엔진 canEscort·plotAgents 와 같게 · 형 10-25: "군사를 맡은 장군은 사신으로 못 보내야")
    if ((job === 'envoy' || job === 'plot') && Object.values(r.armies).some((a) => a.hero === x.id)) return tr('dip.leadsArmy')
    // 원정 칸이 제 사정(길 양식·한꺼번에 몇)을 말한다 · 군주는 못 간다 (expBlock) — 맨 앞에 골라 두면 빈 칸이 뜬다
    if (job === 'exp') return isRuler(r, x.id) ? tr('hero.rulerStays') : null
    if (handLocked(r, x.id)) return tr('hero.handLocked')
    if (job === 'post') return postTargets(r, x) === '' ? tr('hero.noPost') : null
    if (job === 'lead') return Object.values(r.armies).some((a) => a.hero === x.id) ? tr('hero.alreadyLead') : leadTargets(r, x) === '' ? tr('hero.noArmy') : null
    // 사신·공작 — 고을을 맡은 장수는 제 몸이 손이라 늘 간다 (hands.ownHand)
    return handFor(r, x.id) ? null : tr('hero.handsFullT', { turn: turnWord(r) })
  }

  /** 이 일을 맡을 수 있는 우리 장수 — 할 수 있는 이 먼저, 그 일에 맞는 순 */
  /** 장수가 지금 하는 일 — 한 마디 (형 10-27: "장수 일 시킬 때 항상 뭐 하고 있는지 · 도읍 맡고 있으면 맡고 있다고") */
  function doingShort(r: Realm, x: Hero): string {
    if (x.post != null) return tr('hero.holds', { node: r.nodes[x.post]?.name ?? '' })
    const a = Object.values(r.armies).find((y) => y.hero === x.id)
    if (a !== undefined) return a.march !== null ? tr('hero.marching', { node: r.nodes[a.march.to]?.name ?? '' }) : tr('hero.leadsAt', { node: r.nodes[a.at]?.name ?? '' })
    return tr('hero.rests')
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
    const undo = (act: string, id: string): string => `<button class="btn ghost sm" data-act="${act}" data-id="${id}">${tr('x.cancel')}</button>`
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
      const sub = now.length > 0 ? now.map(([t]) => esc(t)).join('<br>') : can > 0 ? tr('hero.canN', { n: can }) : tr('hero.noCan')
      h += `<button class="cmdc${now.length > 0 ? ' set' : ''}${now.length === 0 && can === 0 ? ' off' : ''}" data-act="cmd" data-job="${j.id}" style="--cbg:url('${ART}event/${j.art}.jpg')">`
        + `<b>${icon(j.icon)}${j.name}</b><span>${j.line}</span><small>${sub}</small></button>`
    }
    return h + `</div>`
  }

  /** 일 창 — 그림 · 이번 계절 정한 것 · 누구를 · 어디로 */
  function cmdWinHtml(r: Realm, job: CmdJob): string {
    const def = CMD_JOBS.find((j) => j.id === job)!
    let h = `<button class="btn ghost sm hback" data-act="cmd-back">${tr('hero.backCmd')}</button>`
    h += `<div class="cmdw" style="--cbg:url('${ART}event/${def.art}.jpg')"><b>${icon(def.icon)}${def.name}</b><span>${def.line}</span>`
    for (const [t, b] of cmdNow(r, job)) h += `<div class="banner good">${tr('hero.thisTurn', { turn: turnWord(r), what: esc(t) })}${b}</div>`
    h += `</div>`
    // 공작은 갈래부터 — 여섯 가지를 그림으로. 암살만 우리 장수가 몸소 가고(장수 판에서 왔으면 그 장수), 나머지는 나라의 꾀로 한다
    if (job === 'plot') {
      const full = handsOut(r)
      // 갈래는 그림 칩 — 설명은 말풍선 (외교·고을 판의 공작 칩과 같다 · 형 10-26)
      h += `<h4>${tr('hero.whichPlot')}</h4><div class="pogrid">`
      for (const op of PLOT_OPS) {
        // 구출 — 잡혀간 우리 장수가 있을 때만
        const none = op === 'rescue' && plotTargets(r, me(), op).length === 0
        h += `<button class="pochip" data-act="cmd-plot" data-op="${op}" data-tip="${esc(none ? tr('plot.whyNoPrisoner') : PLOT_DOES[op](r))}"${full || none ? noBtn(none ? tr('hero.noPrisonerWhy') : tr('dip.handsFull')) : ''}>${icon(PLOT_ICON[op], 'poic')}<b>${PLOT_NAME[op]}</b></button>`
      }
      return h + `</div>${full ? `<p class="mute">${tr('hero.handsFullBar', { turn: turnWord(r) })}</p>` : ''}`
    }
    const list = cmdHeroes(r, job)
    if (list.length === 0) return h + `<p class="mute">${tr('hero.noOne')}</p>`
    const free = list.filter((c) => c.why === null)
    // 방금 원정을 보낸 장수는 그대로 둔다 (cmdpick.ts · 형 11-02)
    const pickId = cmdPickId(free.map((c) => c.x.id), cmdHero, job === 'exp' && expLeaving(cmdHero))
    h += `<h4>${tr('dip.whoGoes')}</h4><div class="cmdp">`
    for (const { x, why } of list) {
      const st = def.stat.map((k) => `<i>${STAT_NAME[k]} ${x[k]}</i>`).join('')
      h += why !== null
        ? `<button class="busy" data-act="busy"${noBtn(why)}>${bust(x, 'face')}<b>${nameHtml(x.name)}</b><small>⏳ ${esc(why)}</small></button>`
        : `<button class="${x.id === pickId ? 'on' : ''}" data-act="cmd-hero" data-id="${x.id}">${bust(x, 'face')}<b>${nameHtml(x.name)}</b><small>${st}</small><small class="cdo">${esc(doingShort(r, x))}</small></button>`
    }
    h += `</div>`
    const x = r.heroes[pickId]
    if (x === undefined) return h + `<p class="mute">${tr('hero.noOneT', { turn: turnWord(r) })}</p>`
    switch (job) {
      case 'post': return h + `<h4>${tr('hero.whichTown')}</h4>` + postTargets(r, x)
      case 'lead': return h + `<h4>${tr('hero.whichArmy')}</h4>` + leadTargets(r, x)
      // 맡은 자리가 어떻게 되는지 미리 (한 사람 한 가지 일 · 형 10-25)
      case 'envoy': return h + (x.post != null ? `<p class="mute">${tr('hero.followEmpty', { turn: turnWord(r), node: esc(r.nodes[x.post]?.name ?? '') })}</p>` : '')
        + `<button class="btn pri cmdgo" data-act="hero-envoy" data-id="${x.id}">${icon('good-tribute-bell')}${esc(tr('hero.pickNation', { name: x.name }))}</button>`
      case 'exp': return h + (Object.values(r.armies).some((a) => a.hero === x.id) ? `<p class="mute">${tr('hero.leaveArmy')}</p>` : x.post != null ? `<p class="mute">${esc(tr('hero.leavePost', { node: r.nodes[x.post]?.name ?? '' }))}</p>` : '') + expHtml(r, x)
      case 'wed': return h + wedHtml(r, x)
    }
  }

  /**
   * 고을 맡기의 갈 곳 — 이끌던 군대에서 빠져 이 고을 · 지금 있는 고을 · 우리 땅으로 이어진 다른 고을(정예가 따라가고 한 계절 길에 있다).
   * 고을마다 이 장수를 앉히면 달라지는 것을 그림과 숫자로 (postgain.ts · 형 11-04: "어느 마을을 보내야 뭐가 좋은지 선택지에서 다 보여야 함") ·
   * 득이 큰 고을부터 · 맨 위에 추천
   */
  function postTargets(r: Realm, x: Hero): string {
    const army = Object.values(r.armies).find((a) => a.hero === x.id)
    const at = army?.at ?? x.at ?? null
    if (at === null) return ''
    const opts: Array<{ n: string; sub: string }> = []
    if (army !== undefined) {
      if (army.march === null && r.nodes[at]?.owner === me() && at !== r.factions[me()]?.capital) opts.push({ n: at, sub: tr('hero.subArmy') })
    } else {
      const cap = r.factions[me()]?.capital
      if (x.post !== at && r.nodes[at]?.owner === me() && at !== cap) opts.push({ n: at, sub: tr('hero.subHere') })
      const far = myTowns(r).filter((n) => n.id !== at && n.id !== cap && n.kind !== 'sodo' && n.hh > 0 && migratePath(r, me(), at, n.id) !== null)
      for (const n of far) opts.push({ n: n.id, sub: tr('hero.subFar', { n: P.realm.escortMen, turn: turnWord(r) }) })
    }
    if (opts.length === 0) return ''
    const rows = opts.map((o) => ({ ...o, g: postGain(r, x.id, o.n) })).sort((a, b) => b.g.score - a.g.score || (a.n < b.n ? -1 : 1))
    let h = ''
    rows.forEach(({ n, sub, g }, i) => {
      const hd = g.replaces !== null ? r.heroes[g.replaces] : undefined
      let fx = ''
      if (g.grain !== 0) fx += fxChip(g.grain > 0, GOOD_ICON.grain, tr('hero.fxGrain', { n: signed(g.grain) }))
      if (g.militia !== 0) fx += fxChip(g.militia > 0, 'unit-spear', tr('hero.fxMilitia', { n: signed(g.militia) }))
      if (g.grow !== 0) fx += fxChip(g.grow > 0, 'settle-hamlet', tr('hero.fxGrow', { n: signed(g.grow) }))
      if (g.alert !== 0) fx += fxChip(g.alert > 0, 'settle-beacon', tr('hero.fxAlert', { n: signed(g.alert) }))
      if (g.iron > 0) fx += gainHtml({ iron: g.iron })
      if (g.ironhand) fx += fxChip(true, 'treasure-ring-sword', tr('hero.fxIron'))
      const top = i === 0 && rows.length > 1 && g.score > 0
      h += `<button class="cmdt${top ? ' pgtop' : ''}" data-act="assign" data-id="${x.id}" data-node="${n}">`
        + `<b>${top ? `<i class="pgst">${tr('hero.recStar')}</i> ` : ''}${esc(r.nodes[n]?.name ?? '')}${g.front ? ` ${icon('settle-palisade', 'pgfr')}` : ''}</b>`
        + `<span class="pgc">${fx !== '' ? fx : `<small>${tr('hero.noChange')}</small>`}</span>`
        + `<small>${sub}${hd !== undefined ? ` · ${esc(tr('hero.instead', { name: hd.name }))}` : ''}</small></button>`
    })
    return `<div class="cmdts">${h}</div>` + (x.post != null ? `<button class="btn ghost" data-act="assign" data-id="${x.id}" data-node="">${tr('hero.dropTown')}</button>` : '')
  }

  /** 군대 이끌기의 갈 곳 — 장수 없는 우리 군대 (여기 있으면 바로 · 우리 땅으로 이어진 곳이면 가서) */
  function leadTargets(r: Realm, x: Hero): string {
    const at = x.at
    if (at === null || Object.values(r.armies).some((a) => a.hero === x.id)) return ''
    let h = ''
    for (const a of sorted(Object.values(r.armies)).filter((b) => b.faction === me() && b.march === null && b.hero === null && (b.at === at || (r.nodes[b.at]?.owner === me() && migratePath(r, me(), at, b.at) !== null)))) {
      h += `<button class="cmdt" data-act="lead" data-id="${x.id}" data-army="${a.id}"><b>${esc(armyName(r, a))}</b><small>${a.at === at ? tr('hero.menHere', { n: headcount(forceOf(r, a)) }) : tr('hero.menGo', { n: headcount(forceOf(r, a)), node: esc(r.nodes[a.at]?.name ?? '') })}</small></button>`
    }
    return h === '' ? '' : `<div class="cmdts">${h}</div>`
  }

  function heroSheet(r: Realm, id: string): string {
    const x = r.heroes[id] ?? (realm!.wanderers ?? []).find((w) => w.hero.id === id)?.hero
    if (x === undefined) return ''
    const ours = x.faction === me() && x.status === 'free'
    const seen = x.faction === me() || heroSeen(realm!, me(), x.id) || (realm!.wanderers ?? []).some((w) => w.hero.id === id)
    const file = faceFile(x.id)
    let h = `<button class="btn ghost sm hback" data-act="hero-back">${tr('hero.backList')}</button><div class="hcard">`
    // 사서에 남은 사람 — 얼굴 모서리의 「📜?」를 누르면 사서의 이야기 (형 10-25: 이름 줄에 붙이면 특성처럼 보였다 · 그림과 물음표만)
    const annal = annalOf(x.id)
    // 각성해 숨 쉬는 고리 영상이 있으면 영상으로 — 골반까지 세로로 (형 11-05: "명치까지 오는 게 아니라 골반까지 나오는 게 핵심") · 저사양은 그림
    const bo = bustOf(x.id)
    const lowQ = root.classList.contains('q-low')
    // 진각성 — 그 판에서 진각성한 장수는 초상이 진각성 영상(정사각)으로 · 아직이면 아래 「진각성」 칸에서 미리 본다 (형 11-05: "진각성 방법도 자연스럽게 알 수 있어야 · 게임하면서 진각성 영상을 보고 싶어")
    const tw = x.faction === me() && TRUE_WAKE.has(x.id) && bo !== undefined
    const woke2 = tw && (r.trueWoke ?? []).includes(x.id)
    const loop2s = tw && AWAKEN2_LOOP.has(bo!) && !lowQ ? loopTakes2(bo!).map((t) => ART + t) : null
    const hloops = woke2 && loop2s !== null ? loop2s : x.ascended === true && bo !== undefined && AWAKEN_LOOP.has(bo) && !lowQ ? loopTakes(bo).map((t) => ART + t) : null
    const loop2 = loop2s?.[0] ?? null
    const hloop = hloops?.[0] ?? null
    const hpost = woke2 ? `${ART}awaken2-hd/${bo}.jpg` : `${ART}awaken-hd/${bo}.jpg`
    const e = elemOf(x)
    const hpic = hloop !== null ? `<span class="vthumb awakening-frame"><video class="big vloop${sqCls(hloop)}" ${takeAttrs(hloops!)} poster="${hpost}" autoplay muted playsinline preload="auto" data-act="bust-view" data-src="${hpost}" data-loop="${hloop}" data-elem="${e}"></video>${awakeningGemHtml(e, ART)}</span>`
      : woke2 ? `<img class="big" src="${hpost}" alt="" data-act="bust-view" data-src="${hpost}">`
      : file !== undefined ? `<img class="big" src="${ART}bust/${file}.jpg" alt="" data-act="bust-view" data-src="${ART}bust/${file}.jpg">` : bust(x, 'face')
    h += `<div class="hpic${hloop !== null ? ' framed' : ''}">${hpic}${annal !== undefined ? `<button class="annb" data-act="annal" data-id="${x.id}" aria-label="${tr('hero.annal')}">📜<b>?</b></button>` : ''}${flamesHtml(x)}</div>`
    if (tw) h += trueWakeCard(x, bo!, woke2, loop2)
    // 판 밖 단련을 들고 온 장수 — 「단련 n」 (HERO-GROWTH ★ §A)
    h += `<div class="hn">${nameHtml(x.name)}${x.drill !== undefined && x.drill.lv > 0 && x.faction === me() ? ` <span class="dlv">${tr('hero.drill', { n: x.drill.lv })}</span>` : ''}${x.faction === me() ? relicChips(ART, esc, x.relics, x.relicLv ?? {}) : ''}</div><div class="mute">${emblem(x.faction)}${esc(r.factions[x.faction]?.name ?? tr('hero.wanderer'))}${isRuler(r, x.id) ? ` ${tr('hero.ruler')}` : ''} · ${esc(roleLine(r, x))}</div>`
    // 기억 — 겪은 일이 계절 차례 그림으로, 이름 바로 밑에 (MEMORY §3-2 5). 남의 장수는 우리와 얽힌 일만
    if (seen) h += memRowHtml(realm!, x, me(), ART, esc)
    h += heroRadar(x, seen, ours)
    h += `<div class="tr3">${traitChips(x, seen)}${artChip(x, seen, icon)}</div>`
    if (ours) h += growthHtml(r, x)
    // 아는 만큼 — 우리 장수 · 싸워 봤거나 정찰·첩자로 본 장수 · 이름만 들은 장수 (형: "이름 들어본 군주나 적장이랑 싸워본 적장이랑은 구분해야")
    if (!seen) h += `<p class="heardp">${tr('hero.unseen')}</p>`
    else if (!ours && x.faction !== me()) h += `<p class="mute">${tr('hero.seenAsIs')}</p>`
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
          + `${tr('hero.honey', { sp: esc(sp.name), when: turnsLabel(r, honey) })}`
          + (!near && ours && heroOrders.some((o) => o.kind === 'cohabit' && (o.hero === id || o.hero === x.spouse))
            ? `<button class="btn home sm on" data-act="uncohabit" data-id="${id}">${tr('hero.cohabitUndo', { turn: turnWord(r) })}</button>`
            : !near && ours && canCohabit(realm!, id) && heroBusy(r, id) === null ? `<button class="btn pri home sm" data-act="cohabit" data-id="${id}">${esc(tr('hero.cohabitGo', { node: r.nodes[sp.at ?? '']?.name ?? '' }))}</button>` : '')
          + `<button class="btn sm bridal-go" data-act="bridal-look" data-id="${id}">${tr('hero.bridalLook')}</button>`
          + `<small>${near ? tr('hero.together') : tr('hero.apart')}${kid !== undefined ? tr('hero.kidDue', { when: turnsLabel(r, Math.max(1, kid.due - r.season + 1)), late: (kid.late ?? 0) > 0 ? tr('hero.kidLate', { span: spanLabel(r, kid.late ?? 0) }) : '' }) : ''}</small></div>`
      } else h += `<p class="mute">${tr('hero.mate', { name: sp !== undefined ? nameHtml(sp.name) : '?', kid: kid !== undefined ? tr('hero.kidOut', { when: turnsLabel(r, Math.max(1, kid.due - r.season + 1)) }) : '' })}</p>`
    }
    if (x.parents !== undefined) h += `<p class="mute">${tr('hero.childOf', { names: x.parents.map((p) => (r.heroes[p] !== undefined ? nameHtml(r.heroes[p]!.name) : '?')).join(' · ') })}</p>`
    const weds = heroOrders.filter((o): o is Extract<Order, { kind: 'wed' }> => o.kind === 'wed' && (o.a === id || o.b === id))
    for (const o of weds) {
      const other = r.heroes[o.a === id ? o.b : o.a]
      h += `<div class="banner good">${tr('hero.weds', { turn: turnWord(r), other: esc(other?.name ?? ''), cost: costHtml({ grain: other !== undefined ? wedCost(r, id, other.id) : P.realm.wedGrain }) })}<button class="btn ghost sm" data-act="unwed" data-id="${id}">${tr('x.cancel')}</button></div>`
    }
    // 묶인 장수 — 사정만 보이고 할 일은 숨긴다
    const busy = ours ? heroBusy(r, id) : null
    if (busy !== null) h += `<div class="banner busyb">${tr('hero.busyNote', { busy: esc(busy), turn: turnWord(r) })}</div>`
    if (ours && canStandBy(r, id)) h += `<button class="btn ghost standby" data-act="standby" data-id="${id}" data-tip="${tr('hero.standTip', { turn: turnWord(r) })}">${tr('hero.standBy')}</button>`
    // 재상에게 맡김 / 직접 부린다 — 쉬게 되면 누가 일을 주나 (형 10-26)
    if (ours && !isRuler(r, id) && realm !== null && autoIdle(realm)) {
      const self = manualOf(realm).has(id)
      const chan = busy === null ? chanJob(id) : null
      h += `<div class="jsone"><div class="seg"><button class="${self ? '' : 'on'}" data-act="js-one" data-id="${id}" data-v="auto">${tr('hero.auto')}</button><button class="${self ? 'on' : ''}" data-act="js-one" data-id="${id}" data-v="self">${tr('hero.self')}</button></div>`
        + (self ? `<small>${tr('hero.selfNote')}</small>` : chan !== null ? `<small>${tr('hero.autoEnds', { turn: turnWord(r) })}</small>${chanJobHtml(id)}` : `<small>${tr('hero.autoRest', { turn: turnWord(r) })}</small>`) + `</div>`
    }
    // 한 번 맺은 짝은 계속 — 지금 판·계절 처음 판 어느 쪽이든 짝이 있으면 혼인 칸을 안 띄운다
    const pending = heroOrders.filter((o) => (o.kind === 'assign' || o.kind === 'lead' || o.kind === 'persuade' || o.kind === 'hire') && o.hero === id)
    for (const o of pending) {
      // 한 번 연 담판은 그 계절에 무르지 못한다 (WOO §2-4 · 무를 수 있으면 굴림을 엿보고 다시 고른다)
      if (o.kind === 'persuade' && o.talk !== undefined) {
        h += `<div class="banner good">${tr('hero.dpLine', { turn: turnWord(r) })}<button class="btn ghost sm" data-act="dp-talk" data-id="${id}">${wooDone[id] === true ? tr('hero.dpAgain') : tr('hero.dpGo')}</button></div>`
        continue
      }
      const what = o.kind === 'assign' ? (o.node === null ? tr('hero.quitJob') : tr('hero.takes', { node: r.nodes[o.node]?.name ?? '' })) : o.kind === 'lead' ? tr('dip.leadsArmy') : o.kind === 'hire' ? tr('hero.hired') : tr('hero.persuade')
      h += `<div class="banner good">${tr('hero.thisTurn', { turn: turnWord(r), what: esc(what) })}<button class="btn ghost sm" data-act="unhero" data-id="${id}">${tr('x.cancel')}</button></div>`
    }
    const locked = ours && busy === null && pending.length === 0 && handLocked(r, id)
    if (locked) h += `<div class="banner busyb">${tr('hero.lockedHand', { turn: turnWord(r) })}</div>`
    // 할 일 — 일마다 그림 깔린 창으로 간다 (명령 탭의 그 창에 이 장수를 골라 둔 채로)
    if (ours && pending.every((o) => o.kind === 'hire') && busy === null && !locked) {
      const jobs = CMD_JOBS.filter((j) => (j.ruler || !isRuler(r, id)) && cmdWhy(r, j.id, x) === null)
      if (jobs.length > 0) h += `<div class="cmdm">${jobs.map((j) => `<button data-act="cmd" data-job="${j.id}" data-id="${id}" style="--cbg:url('${ART}event/${j.art}.jpg')">${icon(j.icon)}<b>${j.name}</b></button>`).join('')}</div><p class="mute">${tr('hero.oneThing', { turn: turnWord(r) })} ${guideBtn('post')}</p>`
    }
    // 회유 — 우리가 사로잡은 장수
    if (x.status === 'captive' && x.captor === me() && x.persuade === undefined && pending.length === 0 && !wooable(r, id)) {
      h += `<p class="mute">${esc(tr('hero.foeRuler', { nation: r.factions[x.faction]?.name ?? '' }))}</p>`
    }
    if (x.status === 'captive' && x.captor === me() && x.persuade === undefined && pending.length === 0 && wooable(r, id)) {
      // 얼굴로 고른다 · 벽은 막대와 까닭 · 가망은 % · 곡식은 범위 (WOO §1 · 형 10-29: "장수 얼굴도 안 나오고 뭐가 얼마나 되는지 구체적이지 않음")
      const kit = wooKit(r)
      const byH = wooByOf(r, id)
      const by = byH?.id ?? null
      h += wallHtml(kit, realm!, id)
      h += whoHtml(kit, realm!, id, byH, byH !== null && byH.id === wooBest(realm!, me(), id, kit.jobOf)?.id)
      h += outlookHtml(kit, realm!, id, by)
      h += `<button class="btn pri" data-act="persuade" data-id="${id}" data-by="${by ?? ''}">${tr('hero.persuade')} ${costHtml({ grain: P.realm.persuadeGrain }, tr('hero.perSeason'))}</button>`
    }
    if (x.status === 'captive' && x.captor === me() && realm!.heroes[id]?.persuade !== undefined) h += progressHtml(wooKit(r), realm!, id, talkBtn(r, id))
    return h + `</div></div>`
  }

  /** 도읍을 잃고 피한 조정 — 되찾을 날이 얼마나 남았나 (형: "내도읍 뺏기자마자 지는건 좀 오바") */
  function exileHtml(r: Realm): string {
    const ex = r.factions[me()]?.exile
    if (ex === undefined || r.outcome) return ''
    const cap = r.nodes[r.factions[me()]!.capital]
    const left = Math.max(1, ex.since + seasons(r, P.realm.exileSeasons) - r.season)
    return `<div class="banner bad exileb">${icon('status-bad-omen')}${tx(tr('hero.exile', { cap: cap?.name ?? '', seat: r.nodes[ex.seat]?.name ?? '', when: turnsLabel(r, left) }))}</div>`
  }


  /** 회유 화면이 쓰는 손 — 그림 · 이름 · 이번 계절 묶인 장수 */
  function wooKit(r: Realm): WooKit {
    return { art: ART, esc, bust, name: nameHtml, icon, cost: costHtml, grainIcon: GOOD_ICON.grain, jobOf: (y) => heroJob(r, y)?.[1] ?? null }
  }
  const WOO_LINES: TalkLines = { open: wooOpenLine, lord: wooLordLine, pitch: wooPitchLine, react: wooReactLine, notYet: wooNotYetLine, kneel: wooKneelLine, won: wooWonLine, hire: (x) => HIRE_LINE[x.id] ?? HIRE_BY_TRAIT[x.traits?.[0] ?? ''] ?? HIRE_PLAIN }
  /** 이 포로의 이번 계절 회유 명령 */
  const wooOrder = (id: string): Extract<Order, { kind: 'persuade' }> | undefined =>
    heroOrders.find((o): o is Extract<Order, { kind: 'persuade' }> => o.kind === 'persuade' && o.hero === id)
  /** 회유 중인 포로의 「마주 앉기」 — 열 수 있으면 단추, 아니면 언제 되는지 */
  function talkBtn(r: Realm, id: string): string {
    const pz = realm!.heroes[id]?.persuade
    if (pz === undefined || pz.resist === undefined || wooOrder(id) !== undefined) return ''
    const why = talkWhy(realm!, id)
    if (why === null) {
      const last = pz.talkAt ?? pz.since ?? realm!.season
      return `<p class="mute">${turnsLabel(realm!, Math.max(1, seasons(realm!, P.realm.wooTalkGap) - (realm!.season - last)))} 뒤 다시 마주 앉을 수 있다</p>`
    }
    const by = pz.by !== null ? r.heroes[pz.by] : undefined
    if (by === undefined || by.status !== 'free' || by.faction !== me() || heroJob(r, by.id) !== null) return `<p class="mute">달래던 장수가 이번 ${turnWord(r)} 다른 일을 맡아 마주 앉을 수 없다</p>`
    return `<button class="btn pri" data-act="dp-talk" data-id="${id}">마주 앉기${why !== 'free' ? ' <i class="recst">지금</i>' : ''}</button>`
  }
  /** 담판을 연다 — 이미 회유 중이면 이번 계절 명령을 새로 얹는다 (달래던 이가 마주 앉는다) */
  function openTalk(id: string): boolean {
    if (realm === null) return false
    if (wooOrder(id) === undefined) {
      const pz = realm.heroes[id]?.persuade
      if (pz === undefined || pz.by === null || talkWhy(realm, id) === null) return false
      heroOrders = [...heroOrders, { kind: 'persuade', hero: id, by: pz.by, talk: [] }]
    } else if (wooOrder(id)!.talk === undefined) heroOrders = heroOrders.map((o) => (o.kind === 'persuade' && o.hero === id ? { ...o, talk: [] } : o))
    wooTalk = { id, sel: null, hand: false }
    return true
  }
  /** 담판이 저절로 뜰 때 — 벽이 무너진 다음 계절 · 걸 거리가 새로 생겼을 때 (WOO §3). 한 계절에 하나 */
  function wooAuto(): void {
    if (realm === null || front !== null || showReport || stratOpen !== null || prologue !== null || realm.outcome || wooAutoAt === realm.season) return
    if ((realm.region ?? '') === 'tutorial' || root.classList.contains('modal-open')) return
    const r = plan()
    const id = Object.keys(realm.heroes).sort().find((k) => {
      const x = realm!.heroes[k]!
      const by = x.persuade?.by != null ? r.heroes[x.persuade.by] : undefined
      return x.status === 'captive' && x.captor === me() && wooDone[k] !== true && wooOrder(k) === undefined && talkAuto(realm!, k)
        && by !== undefined && by.status === 'free' && by.faction === me() && heroJob(r, by.id) === null
    })
    if (id === undefined) return
    wooAutoAt = realm.season
    if (openTalk(id)) window.setTimeout(paint, 0)
  }
  /** 담판 소리 — 마디의 반응대로 · 손을 내민 결과 (WWE: 크게, 소리와 움직임을 잇달아) */
  function talkSound(id: string, handNow: boolean): void {
    const o = wooOrder(id)
    const x = realm?.heroes[id]
    if (o === undefined || o.by === null || x === undefined || realm === null) return
    const t = talkRun(realm, id, o.by, o.talk ?? [], false)
    if (handNow) {
      if (t.hand?.ok !== true) { ding(snd('tap_cancel'), 0.5); return }
      ding(snd('woo_break'), 0.6) // 벽이 무너진다 — 맑게 (성문 깨기 소리는 「개박살」 · 형 11-03)
      // 등용 첫마디는 다음 계절 등용 장면에서 (여기서 내면 두 번 듣는다)
      return
    }
    const last = t.beats[t.beats.length - 1]
    if (last === undefined) return
    if (t.end === 'broke') ding(snd('woo_break'), 0.6)
    else ding(snd(last.react === 'big' ? 'tap_bell' : last.react === 'sway' ? 'tap_brush' : last.react === 'rage' ? 'tap_drum' : 'tap_cancel'), 0.55) // 말이 먹히면 방울 · 조금 먹히면 붓 소리 (칼 부딪는 소리는 싸움 것이라 뺌 · 형 10-29: "이 말로 한다 택하면 무슨 칼싸움 소리")
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
    if (wooTalk === null && wooPick === null) wooAuto()
    let ov = root.querySelector<HTMLElement>('.dpov')
    // 옥중 담판 — 한 장 · 다시 그릴 때 같은 글이면 그대로 둔다 (조각 · 도장 움직임이 다시 돌지 않게)
    const o = wooTalk !== null ? wooOrder(wooTalk.id) : undefined
    const tby = o?.by != null && realm !== null ? realm.heroes[o.by] : undefined
    if (wooTalk !== null && realm !== null && front === null && o !== undefined && tby !== undefined) {
      if (ov === null) {
        root.insertAdjacentHTML('beforeend', `<div class="dpov talk"></div>`)
        ov = root.querySelector<HTMLElement>('.dpov')!
      }
      ov.className = 'dpov talk'
      const html = talkBoxHtml(wooKit(plan()), WOO_LINES, realm, { id: wooTalk.id, by: tby, talk: o.talk ?? [], sel: wooTalk.sel, hand: wooTalk.hand, grain: left().grain })
      if (ov.dataset['html'] !== html) { ov.innerHTML = html; ov.dataset['html'] = html }
      return
    }
    if (wooTalk !== null) wooTalk = null
    if (ov !== null && ov.classList.contains('talk')) { ov.remove(); ov = null }
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
    let h = `<div class="wed"><b>${tr('wed.h')}</b><span class="mute">${tr('wed.intro', { span: spanLabel(r, P.realm.wedSeasons), pct: Math.round(P.realm.wedSurprise * 100) })}</span>`
    for (const y of cands) {
      const inh = inheritOf(r, x.id, y.id)
      const chips = inh.traits.map((t) => TRAIT[t]).filter((t) => t !== undefined)
        .map((t) => `<span class="trait${t!.bad === true ? ' bad' : ''}" style="--g:${GRADE_COLOR[t!.grade]}"><b>${esc(t!.name)}</b><i>${tr('wed.half')}</i></span>`).join('')
      // 친밀 — 하트 다섯 칸 · 잔치 곡식이 사이에 따라 (아끼는 사이 싸게 · 정략 비싸게 · 형 10-31)
      const t = tieOf(r, x.id, y.id)
      const cost = wedCost(r, x.id, y.id)
      const hearts = Math.round((t / P.realm.tieMax) * 5)
      const mood = t >= P.realm.tieLove ? tr('wed.moodLove') : t < P.realm.tieCold ? tr('wed.moodCold') : tr('wed.moodNear')
      h += `<button class="wcand" data-act="wed" data-id="${x.id}" data-with="${y.id}"${grain < cost ? noBtn(tr('wed.noGrain')) : ''}>${bust(y, 'face')}<span><b>${nameHtml(y.name)}</b>`
      h += `<span class="wtie${t >= P.realm.tieLove ? ' love' : t < P.realm.tieCold ? ' cold' : ''}" title="${tr('wed.tieTitle', { t: Math.round(t), max: P.realm.tieMax })}">${'♥'.repeat(hearts)}${'♡'.repeat(5 - hearts)} ${mood}</span>${costHtml({ grain: cost }, tr('wed.feast'))}`
      h += `<span class="tr3">${chips}<span class="trait" style="--g:${GRADE_COLOR[inh.surpriseGrade]}"><b>?</b><i>${tr('wed.surprise', { grade: GRADE_NAME[inh.surpriseGrade] })}</i></span></span></span></button>`
    }
    for (const y of tied) h += `<button class="wcand busy" data-act="busy"${noBtn(heroJob(r, y.id)?.[1] ?? tr('wed.busyDefault'))}>${bust(y, 'face')}<span><b>${nameHtml(y.name)}</b><span class="hdo">⏳ ${esc(heroJob(r, y.id)?.[1] ?? '')}</span></span></button>`
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
    if (away !== undefined) return `<div class="exp" style="--expbg:url('${ART}exp/exp-${away.dest}.jpg')"><b>${tr('exp.awayH')}</b><span class="mute">${tr('exp.away', { dest: esc(DESTS[away.dest].name), when: turnsLabel(r, Math.max(1, away.back - r.season + 1)) })}</span></div>`
    if (x.faction !== me() || x.status !== 'free' || isRuler(r, x.id)) return ''
    const sent = heroOrders.find((o): o is Extract<Order, { kind: 'expedition' }> => o.kind === 'expedition' && o.hero === x.id)
    if (sent !== undefined) return `<div class="banner good">${tr('exp.sent', { turn: turnWord(r), dest: esc(DESTS[sent.dest].name), span: spanLabel(r, EXP_SEASONS[sent.len]) })}<button class="btn ghost sm" data-act="unexp" data-id="${x.id}">${tr('exp.cancel')}</button></div>`
    // 이번 계절 다른 일을 맡은 장수 — 땅·길이 단추까지 다 눌려 보이면 시킬 수 있는 줄 안다 (형 10-24). 한 줄로만
    const tiedUp = heroBusy(r, x.id)
    if (tiedUp !== null) return `<div class="exp off"><b>${tr('exp.h')}</b><span class="mute">${tr('exp.tied', { job: esc(tiedUp), turn: turnWord(r) })}</span></div>`
    // 먼 땅은 다 보이되 못 가는 곳은 흐린 단추로 — 왜 못 가는지는 단추 밑에 (형 10-23: "못 가면 버튼은 있지만 비활성화 · 보낼 수 있는지 없는지도 모르잖아")
    const dests = DEST_IDS.filter((d) => destReachable(r, me(), d))
    const pick = expPickOf(r, x.id)
    const farWhy = (d: ExpDest): string => (DESTS[d].from.includes(r.region ?? 'byeonhan-mini') ? tr('exp.farPort') : tr('exp.farFar'))
    const word = (p: number): string => (p >= 0.3 ? tr('exp.often') : p >= 0.12 ? tr('exp.sometimes') : p > 0 ? tr('exp.rare') : tr('exp.never'))
    const odds = expOdds(x, pick.dest, pick.len)
    // 쉬는 장수가 원정을 떠나면 사람 손이 하나 준다 — 이미 고른 공작·사신이 버려지지 않게 (형 10-23: "방화·소문 이미 보냈는데 원정을 중복해서 보낼 수 있는 건 말이 안 되지")
    const handsShort = idleHeroes(r, me()).includes(x.id) && handsUsed() > handsCap(r) - 1
    // 같은 계절에 고른 다른 원정과, 다른 데 쓰기로 한 곡식까지 센다 — 계절을 넘길 때 막혀 말없이 빠지지 않게 (형 10-24: "원정 보낸 것 같은데 다음 계절 또 쉬는 장수")
    const sending = heroOrders.filter((o) => o.kind === 'expedition').length
    const busyNow = (realm!.expeditions ?? []).filter((e) => e.faction === me()).length
    const queued = busyNow + sending >= P.realm.expMax ? tr('exp.maxQ', { n: P.realm.expMax }) : left().grain < P.realm.expGrainPer * EXP_SEASONS[pick.len] ? tr('exp.noFood', { turn: turnWord(r) }) : null
    const block = heroBusy(r, x.id) ?? expBlock(r, me(), x.id, pick.dest, pick.len) ?? queued ?? (handsShort ? tr('exp.hands', { turn: turnWord(r) }) : null)
    // 고른 먼 땅의 그림이 원정 칸 뒤에 깔린다 — 고르면 바뀐다
    let h = `<div class="exp" style="--expbg:url('${ART}exp/exp-${pick.dest}.jpg')"><b>${tr('exp.h')}</b><span class="mute">${tr('exp.blurb')}</span><div class="seg expd">`
    for (const d of DEST_IDS) {
      const ok = dests.includes(d)
      h += `<button class="${d === pick.dest ? 'on' : ''}" data-act="exp-dest" data-id="${x.id}" data-v="${d}"${ok ? '' : noBtn(farWhy(d))}>${esc(DESTS[d].name)}${ok ? '' : `<small>${farWhy(d)}</small>`}</button>`
    }
    h += `</div><p class="mute">${esc(DESTS[pick.dest].line)}${DESTS[pick.dest].sea ? tr('exp.sea') : ''}</p><div class="seg">`
    for (const l of [0, 1, 2] as const) h += `<button class="${l === pick.len ? 'on' : ''}" data-act="exp-len" data-id="${x.id}" data-v="${l}">${[tr('exp.short'), tr('exp.mid'), tr('exp.long')][l]} · ${spanLabel(r, EXP_SEASONS[l])}</button>`
    h += `</div><div class="odds">`
    const rows: Array<[keyof typeof odds, string]> = [
      ['iron', tr('exp.iron', { n: expAmount(x, pick.dest, pick.len, 'iron') })], ['grain', tr('exp.grain', { n: expAmount(x, pick.dest, pick.len, 'grain') })],
      ['wanderer', tr('exp.wanderer')], ['skill', tr('exp.skill', { list: DESTS[pick.dest].skills.map((t) => TRAIT[t]?.name ?? t).join('·') })], ['none', tr('exp.empty')],
    ]
    for (const [k, label] of rows) h += `<span class="od ${k}"><i style="width:${Math.round(odds[k] * 100)}%"></i><b>${esc(label)}</b><em>${word(odds[k])}</em></span>`
    h += `</div>`
    // 못 보내도 단추는 그대로 — 흐리게 두고 까닭을 밑에 (형 10-23: "버튼은 두되 비활성화해 두라고")
    h += `<button class="btn" data-act="exp-go" data-id="${x.id}"${block !== null ? noBtn(block) : ''}>${tr('exp.go', { dest: esc(DESTS[pick.dest].name) })} ${costHtml({ grain: P.realm.expGrainPer * EXP_SEASONS[pick.len] }, tr('exp.road'))}</button>`
    return h + `</div>`
  }

  // ───────── 정찰
  /**
   * 정찰 판 — 위에 정찰꾼 자리(1 → 2 → 3 · 잠긴 자리엔 열리는 고을 수) · 아래에 갈 곳 (FOCUS D · 형 11-01: "정찰 1개로 여러 전선을 못 봄").
   * 갈 곳은 보낸 곳 → 못 본 곳 → 오래된 곳 → 늘 보이는 이웃(👁) 차례로 몇 곳만 · 나머지는 지도에서 고을을 눌러 보낸다 (굴리는 목록을 피해서)
   */
  function scoutSheet(r: Realm): string {
    const known = r.intel[me()] ?? {}
    const cap = scoutCap(r, me())
    const opens = [1, P.realm.scoutTowns2, P.realm.scoutTowns3]
    let slots = ''
    for (let i = 0; i < opens.length; i++) {
      const id = scouts[i]
      if (i >= cap) slots += `<span class="sslot lock">${icon('unit-scouts', 'ssic')}<b>${tr('scout.locked', { n: opens[i] ?? '' })}</b></span>`
      else if (id !== undefined) slots += `<button class="sslot on" data-act="scout" data-node="${id}" aria-label="${tr('scout.recall')}">${icon('unit-scouts', 'ssic')}<b>${esc(r.nodes[id]?.name ?? '')}</b><i>✕</i></button>`
      else slots += `<span class="sslot">${icon('unit-scouts', 'ssic')}<b>${tr('scout.idle')}</b></span>`
    }
    const towns = townCount(r, me())
    const nextAt = opens.find((t) => t > towns)
    const grow = nextAt !== undefined ? `<span class="scgrow">${icon('settle-hamlet', 'ssic')}${tr('scout.grow', { towns, next: nextAt })}</span>` : `<span class="scgrow">${tr('scout.full', { towns })}</span>`
    let h = `<div class="scouthd">${icon('unit-scouts', 'scic')}<div><b>${tr('scout.head', { n: cap })}</b><span>${tr('scout.neighbors')}</span>${grow}</div></div><div class="sslots">${slots}</div>` + (scoutAsk !== null && !scouts.includes(scoutAsk) ? scoutAskHtml(r, scoutAsk) : '')
    const watched = new Set(watchedNodes(r, me()))
    const all = scoutable(r)
    const ageOf = (id: string): number => { const f = known[id]?.force; return f ? r.season - f.season : Infinity }
    const rank = (id: string): number => (scouts.includes(id) ? 0 : watched.has(id) ? 3 : known[id]?.force ? 2 : 1)
    const order = all.map((id, i) => ({ id, i })).sort((x, y) => rank(x.id) - rank(y.id) || (rank(x.id) === 2 ? ageOf(y.id) - ageOf(x.id) : 0) || x.i - y.i).map((x) => x.id)
    const shown = order.filter((id, i) => i < P.realm.scoutListMax || scouts.includes(id))
    for (const id of shown) {
      const n = r.nodes[id]!
      const f = known[id]?.force
      const age = f ? r.season - f.season : null // 턴 (달 시계면 달)
      const v = f ? visibleRange({ f0: f.f0, src: f.src, u: f.u }, ageSeasons(r, f.season)) : null
      const on = scouts.includes(id)
      const keep = scoutKeep.includes(id)
      h += `<div class="srow"><button class="row ${on ? 'prs' : ''}" data-act="scout" data-node="${id}">${emblem(n.owner)}<span class="dest">${watched.has(id) ? '👁 ' : ''}${esc(n.name)}</span>`
      h += `<span class="sub">${v !== null ? `${span(v[0], v[1], (x) => String(Math.round(x)))}${militiaNote(r, id)} · ${age === 0 ? tr('node.agoNow', { turn: turnWord(r) }) : tr('node.ago', { when: turnsLabel(r, age!) })}` : tr('scout.unseen')}</span></button>`
      // 📌 고정 — 매 계절 저절로 여기로
      h += `<button class="pin${keep ? ' prs' : ''}" data-act="scout-keep" data-node="${id}" data-tip="${keep ? tr('scout.pinOn', { turn: turnWord(r) }) : tr('scout.pinOff', { turn: turnWord(r) })}" aria-label="${tr('scout.pinAria')}">📌</button></div>`
    }
    if (shown.length < order.length) h += `<p class="mute">${tr('scout.others', { n: order.length - shown.length })}</p>`
    const resting = scoutKeep.filter((id) => !all.includes(id)).map((id) => r.nodes[id]?.name ?? '')
    if (resting.length > 0) h += `<p class="mute">${esc(tr('scout.resting', { names: resting.join(' · ') }))}</p>`
    return h
  }

  // ───────── 나라
  // ───────── 도읍 — 궁궐 네 단 · 조정 세 자리 (palace.ts · docs/realm/CAPITAL.md §2)
  /** 단 구슬 — 이번 단을 올리려 쌓은 번수 (쌓는 중이면 다음 구슬이 숨 쉰다) */
  function palacePips(p: Realm): string {
    const stages = Math.max(1, Math.round(P.realm.palaceStages))
    const st = p.factions[me()]?.palace
    const stage = st?.stage ?? 0
    const go = st?.busy !== undefined
    return `<i class="palpips">${Array.from({ length: stages }, (_, i) => `<u class="${i < stage ? 'on' : i === stage && go ? 'go' : ''}"></u>`).join('')}</i>`
  }
  /** 도읍 판의 쪽 고르기 + 그 쪽 */
  function palaceBodyHtml(hall: string, great: string): string {
    const sub = hall === '' ? 'works' : palaceSub
    const tabs = hall !== '' && great !== ''
      ? `<div class="palsub"><button class="${sub === 'hall' ? 'on' : ''}" data-act="palace-sub" data-v="hall">${icon('treasure-silla-crown', 'wki')}${tr('pal.tabHall')}</button><button class="${sub === 'works' ? 'on' : ''}" data-act="palace-sub" data-v="works">${icon('wonder-feast', 'wki')}${tr('pal.tabWorks')}</button></div>`
      : ''
    return tabs + (sub === 'hall' ? hall : great !== '' ? great : `<p class="mute">${icon('treasure-silla-crown', 'wki')} ${tr('pal.later')}</p>`)
  }
  /** 궁궐 띠 + 조정 세 칸 + 대신 뽑기 — 배우는 판에는 없다 */
  function palaceHtml(r: Realm): string {
    const f = r.factions[me()]
    if (f === undefined || r.region === 'tutorial') return ''
    const p = leftPlan()
    const tier = palaceTier(p, me())
    const queued = musters.some((o) => o.kind === 'palace')
    const st = p.factions[me()]?.palace
    const busy = st?.busy !== undefined
    const to = Math.min(4, tier + 1) as PalaceTier
    const c = palaceCost(p, me(), to)
    const why = queued ? null : palaceBlocked(p, me()) ?? (canPalace(p, me()) ? null : shortOf({ grain: c.grain, wood: c.wood, iron: c.iron }))
    const label = tier >= 4 ? tr('pal.top') : busy ? tr('pal.building', { when: turnsLabel(r, Math.max(1, (st!.busy ?? r.season) - r.season + 1)) }) : (st?.stage ?? 0) > 0 ? tr('pal.nth', { n: (st?.stage ?? 0) + 1 }) : tr('pal.raise', { name: PALACE_NAME[to] })
    const opens: Record<number, string> = { 2: tr('pal.open2'), 3: tr('pal.open3'), 4: tr('pal.open4') }
    let h = `<div class="palstrip${queued || busy ? ' building' : ''}"><div class="palnow">${icon('treasure-silla-crown', 'wki')}<div><b>${esc(PALACE_NAME[tier])}</b><small>${tr('pal.tier', { n: tier })}${tier < 4 ? ` ➜ ${esc(PALACE_NAME[to])}` : ''}</small></div></div>`
    if (tier < 4) {
      h += `<div class="palgo">${palacePips(p)}`
      h += busy && !queued ? `<span class="wbusy">${label}</span>` : `<button class="btn${queued ? ' on' : ''}" data-act="palace"${why === null ? '' : noBtn(why)}>${label}${costHtml({ grain: c.grain, wood: c.wood, iron: c.iron })}</button>`
      h += `<small class="palopen">${opens[to] ?? ''}</small></div>`
    } else h += `<span class="wdone">${tr('pal.done', { n: tier })}</span>${f.ruler !== undefined && r.heroes[f.ruler] !== undefined ? `<span class="palking">${bust(r.heroes[f.ruler], 'cjface')}<b>${tr('pal.king', { name: esc(r.heroes[f.ruler]!.name) })}</b></span>` : ''}`
    h += `</div><div class="cjgrid">`
    for (const s of SEATS) {
      const d = SEAT_DEFS[s]
      const open = seatOpen(p, me(), s)
      const hero = seatHero(p, me(), s)
      const chosen = musters.some((o) => o.kind === 'seat' && o.seat === s)
      if (!open) {
        h += `<button class="cjseat lock" data-act="seat-open" data-seat="${s}"${noBtn(tr('pal.seatLock', { n: d.tier }))}><span class="cjic">🔒</span><b>${d.name}</b><small>${tr('pal.tier', { n: d.tier })}</small></button>`
        continue
      }
      h += `<button class="cjseat${hero !== null ? ' has' : ' empty'}${chosen ? ' chosen' : ''}${seatPick === s ? ' open' : ''}" data-act="seat-open" data-seat="${s}">${hero !== null ? bust(hero, 'cjface') : `<span class="cjic"><img src="${ART}icon/${d.icon}.png" alt=""></span>`}<b>${d.name}</b><small>${hero !== null ? esc(hero.name) : tr('pal.vacant')}</small>${hero !== null ? `<i class="cjfx">${esc(seatFx(s, hero)[0] ?? '')}</i>` : ''}${chosen ? '<em class="cjok">✓</em>' : ''}</button>`
    }
    h += `</div>`
    // 대장군의 대신 뽑기 — 켜면 계절마다 「알아서 뽑기」와 같은 셈으로 징병 (봄은 쉰다) · 대장군이 있어야
    const on = autoDraftOn(p, me())
    const general = seatHero(p, me(), 'general')
    const pend = musters.some((o) => o.kind === 'autoDraft')
    h += festStripHtml(r)
    h += `<button class="cjauto${on ? ' on' : ''}" data-act="autodraft"${general === null ? noBtn(seatOpen(p, me(), 'general') ? tr('pal.needGeneral') : tr('pal.needGeneralTier', { n: SEAT_DEFS.general.tier })) : ''} data-tip="${tr('pal.autoTip')}">${tr('pal.auto')} <b>${on ? tr('pal.on') : tr('pal.off')}</b>${pend ? '<em class="cjok">✓</em>' : ''}</button>`
    return h
  }
  /** 제천 대회 띠 — 달이 다가오면 「다음 제천 대회: N달 뒤」 · 그 달이면 금빛으로 숨 쉰다(누르면 카드로) */
  function festStripHtml(r: Realm): string {
    const f = me()
    const n = festNextIn(r, f)
    if (n === null) return ''
    if (n === 0) return `<button class="festband now" data-act="fest-go">${icon('status-good-omen', 'wki')}<span><b>${tr('fest.now')}</b><small>${tr('fest.nowSub', { name: festName(f) })}</small></span><i>➜</i></button>`
    if (n > P.realm.festBannerMonths) return ''
    return `<div class="festband soon">${icon('status-good-omen', 'wki')}<span><b>${tr('fest.soon', { n })}</b><small>${tr('fest.soonSub', { name: festName(f), m: festMonth(f) })}</small></span></div>`
  }
  /** 앉힐 장수 고르기 — 떴다 사라지는 상자 (바깥을 누르면 닫힌다) · 능력치 크게 · 걸릴 힘 미리보기 · 비우기 */
  function seatPickHtml(p: Realm): string {
    if (seatPick === null || realm === null) return ''
    const s = seatPick
    const d = SEAT_DEFS[s]
    const cur = seatHero(p, me(), s)
    const heroes = sorted(Object.values(p.heroes)).filter((x) => x.faction === me() && x.status === 'free' && !isRuler(p, x.id))
      .sort((a, b) => b[d.stat] - a[d.stat] || (a.id < b.id ? -1 : 1))
    const cards = heroes.slice(0, 9).map((x) => {
      const why = x.id === cur?.id ? null : seatBlocked(p, me(), s, x.id) ?? (heroSeat(p, x.id) !== null ? null : heroBusy(p, x.id))
      const here = heroSeat(p, x.id)
      const tag = x.id === cur?.id ? '<i class="cjtag">앉은 중</i>' : here !== null && here !== s ? `<i class="cjtag">${SEAT_DEFS[here].name}에서 옮김</i>` : ''
      return `<button class="cjpk${x.id === cur?.id ? ' on' : ''}${why !== null && x.id !== cur?.id ? ' off' : ''}" data-act="seat-set" data-seat="${s}" data-id="${x.id}"${why !== null && x.id !== cur?.id ? noBtn(why) : ''}>${bust(x, 'cjpf')}<b>${nameHtml(x.name)}</b><span class="cjnum">${STAT_NAME[d.stat]} <s>${x[d.stat]}</s></span>${why !== null && x.id !== cur?.id ? `<i class="cjwhy">${esc(why)}</i>` : seatFx(s, x).map((t) => `<i class="cjfx">${esc(t)}</i>`).join('')}${tag}</button>`
    }).join('')
    return `<div class="cjov" data-act="seat-x"><div class="cjbox"><div class="cjhd"><span class="cjic"><img src="${ART}icon/${d.icon}.png" alt=""></span><b>${d.name}</b><small>${josa(STAT_NAME[d.stat], "이", "가")} 높을수록 힘이 큽니다</small><button class="tvx" data-act="seat-x" aria-label="닫기">✕</button></div>${cards !== '' ? `<div class="cjlist">${cards}</div>` : '<p class="mute">앉힐 장수가 없습니다</p>'}${cur !== null ? `<button class="btn ghost" data-act="seat-clear" data-seat="${s}">자리 비우기</button>` : ''}</div></div>`
  }

  /**
   * 곳간을 부을 곳 (wonders.ts · 위원회 11-08 ⑦) — 나라가 커지면 나라 판에 큰 공사 넷과 큰 잔치.
   * 공사마다 그림 · 힘 칩 · 단 구슬(쌓은 만큼 금빛) · 짓는 동안은 그림에 비계 · 남이 지으면 그 나라 깃발과 단의 범위 · 다 서면 금빛 테.
   * 단추는 눌린 채(금빛+✓) · 못 하면 까닭 (꾹 누르면) · 글은 짧게 (형: 글 많은 화면 싫다)
   */
  function greatHtml(r: Realm): string {
    const mine = wonderWorkOf(r, me())
    const built = WONDER_ORDER.some((w) => wonderNode(r, w) !== null)
    if (!greatOpen(r, me()) && mine === null && !built) return ''
    const p = leftPlan()
    const stages = Math.round(P.realm.wonderStages)
    const rivals = rivalWonders(r, me())
    const pips = (n: number, go: boolean): string => `<i class="wpips">${Array.from({ length: stages }, (_, i) => `<u class="${i < n ? 'on' : i === n && go ? 'go' : ''}"></u>`).join('')}</i>`
    let h = `<h3>${icon('treasure-silla-crown', 'wki')} 큰 공사</h3><div class="wgrid">`
    for (const what of WONDER_ORDER) {
      const d = WONDERS[what]
      const at = wonderNode(r, what)
      const queued = musters.some((o) => o.kind === 'wonder' && o.what === what)
      const w = mine !== null && mine.what === what ? mine : null
      const rv = rivals.filter((x) => x.what === what)
      let cls = 'wcard'
      let foot = ''
      if (at !== null) {
        // 다 섰다 — 우리 것이면 금빛 테 · 남의 것이면 그 나라 깃발
        const ours = at.owner === me()
        cls += ours ? ' ours' : ' theirs'
        foot = ours ? `<span class="wdone">✓ ${esc(at.name)}</span>` : at.owner !== null && knows(r, me(), at.owner) ? `<span class="wby">${emblem(at.owner, 'wem')}${esc(r.factions[at.owner]?.name ?? '')}</span>` : `<span class="wby">먼 나라</span>`
      } else {
        const stage = w?.stage ?? 0
        const busy = w?.busy !== undefined
        if (w !== null) cls += ' building'
        const c = wonderStageCost(r, me(), what)
        const why = queued ? null : wonderBlocked(p, me(), what) ?? (canWonder(p, me(), what) ? null : shortOf({ grain: c.grain, [c.good]: c.n }))
        const label = busy ? `쌓는 중 · ${turnsLabel(r, Math.max(1, (w!.busy ?? r.season) - r.season + 1))}` : w !== null ? `${stage + 1}단 쌓기` : '짓기 시작'
        foot = pips(stage, busy || queued)
          + (busy ? `<span class="wbusy">${label}</span>` : `<button class="btn${queued ? ' on' : ''}" data-act="wonder" data-what="${what}"${why === null ? '' : noBtn(why)}>${label}${costHtml({ grain: c.grain, [c.good]: c.n })}</button>`)
        if (rv.length > 0) foot += `<span class="wgrv">${rv.map((x) => `<b data-tip="${esc(josa(r.factions[x.faction]?.name ?? '', '이', '가'))} 짓는 중 · ${x.lo}~${x.hi}단 쯤">${emblem(x.faction, 'wem')}${x.lo}~${x.hi}</b>`).join('')}</span>`
      }
      // 다 선 우리 공사는 완공 장면(event/event-wonder-<id>.jpg · 제미나이 11-11)을 카드 뒤에 깐다
      const scene = at !== null && at.owner === me() ? ` style="--wsc:url(${ART}event/event-wonder-${what}.jpg)"` : ''
      h += `<div class="${cls}"${scene}><div class="wpic">${w !== null && at === null ? icon(`${d.icon}-s${Math.min(3, 1 + Math.floor(((w.stage ?? 0) * 3) / Math.max(1, stages)))}`, 'wimg') : icon(d.icon, 'wimg')}</div><b class="wname">${esc(d.name)}</b><span class="wgfx">${esc(wonderEffect(what))}</span>${foot}</div>`
    }
    h += '</div>'
    // 큰 잔치 — 곳간의 몫을 붓고 굴림 하나 · 갈래마다 그림과 % (우리 것은 숫자 · ODDS.md)
    if (greatOpen(r, me())) {
      const queued = musters.some((o) => o.kind === 'feast')
      const odds = feastOdds(r, me())
      const pour = feastPour(r, me())
      const why = queued ? null : r.season < feastNext(r, me()) ? `${turnsLabel(r, feastNext(r, me()) - r.season)} 뒤에 다시 열 수 있습니다` : feastBlocked(r, me())
      const chip = (ic: string, pp: number, tip: string): string => pp <= 0 ? '' : `<b class="fodd" data-tip="${esc(tip)}">${icon(ic, 'cgi')}${Math.round(pp * 100)}%</b>`
      h += `<h3>${icon('wonder-feast', 'wki')} 큰 잔치</h3><div class="wfeast${queued ? ' on' : ''}" style="--wsc:url(${ART}event/event-great-feast.jpg)"><div class="fodds">`
        + chip('unit-general', odds.guest, '이름난 장수가 손님으로 온다 (값 없이 들인다)')
        + chip('good-tribute-bell', odds.king, `이웃 왕이 찾아온다 (그 나라 호감 +${P.realm.feastFavor})`)
        + chip('unit-drummers', odds.joy, `좋은 잔치 (군대 사기 +${Math.round(P.realm.feastMorale * 100)} · 장수 공)`) + '</div>'
        + `<button class="btn pri${queued ? ' on' : ''}" data-act="feast"${why === null ? "" : noBtn(why)}>잔치 연다${costHtml({ grain: pour })}</button></div>`
    }
    return h
  }
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
      h += `<div class="banner bad">${tx(tr('nation.captive', { lord: rh.name, by }))}</div>`
    }
    h += customsHtml({ esc, icon }, me(), customsOf(r, me()))
    const need = winNeed(r.region ?? 'byeonhan-mini')
    const held = Object.values(r.factions).filter((x) => r.nodes[x.capital]?.owner === me()).length
    h += cardHtml(realm!) // 미리 적용한 판(r)에선 카드가 이미 답해져 사라졌다 — 실제 판으로
    if (r.scenario === undefined) h += `<div class="goal">${tr('nation.goal', { need })} <b>${held} / ${need}</b>${(r.tier ?? 1) !== 1 ? ` <span class="tierc">${levelName(r.tier ?? 1)}</span>` : ''}</div>`
    h += exileHtml(r)
    // 캠페인의 장은 그 장의 목표가 승리 조건 — 모두 이루면 이기고 다음 장이 열린다 (넷 가운데 하나인 일반 판의 길은 안 쓴다) (형 10-23: "좌상단 체크 깨는 거는 그걸 깨야 다음 게임이 열려서 그런 거지?")
    if (r.scenario !== undefined) h += `<div class="paths chapg"><h4>${tr('nation.chapGoal')} <small>${tr('nation.chapGoalSub')}</small></h4>${goalRowsHtml(r, esc)}</div>`
    else h += pathsHtml(r, held, need)
    h += `<div class="grid4"><div>${icon('settle-farm-village')}<b>${mine.length}</b><span>${tr('nation.towns')}</span></div>`
    h += `<div>${icon('good-hemp')}<b>${Math.floor(mine.reduce((s, n) => s + n.hh, 0))}</b><span>${tr('nation.houses')}</span></div>`
    h += `<div>${icon('good-rice')}<b>${Math.floor(st.grain)}</b><span>${tr('good.grain')}</span></div>`
    h += `<div>${icon('treasure-iron-ingots')}<b>${Math.floor(st.iron)}</b><span>${tr('good.iron')}</span></div></div>`
    if (palaceHtml(r) !== '' || greatHtml(r) !== '') h += `<button class="palrow" data-act="palace-go">${icon('treasure-silla-crown', 'wki')}<span>${tr('nation.palrow')}</span><b>${tr('nation.palrowGo')}</b></button>` // 곳간을 부을 곳은 도읍 판으로 옮겼다 (형 11-10)
    const caps2 = Object.values(r.heroes).filter((x) => x.status === 'captive' && x.captor === me())
    if (caps2.length > 0) {
      h += `<h4>${tr('nation.capsHead')}</h4><div class="caps">`
      for (const x of caps2) h += `<div class="cap">${bust(x, 'cface')}<b>${nameHtml(x.name)}</b><span class="mute">${STAT_NAME.mu} ${x.mu} · ${STAT_NAME.ryak} ${x.ryak} · ${STAT_NAME.chi} ${x.chi} · ${STAT_NAME.deok} ${x.deok}</span></div>`
      h += `</div>`
    }
    // 차림 — 세 칸 격자로 줄을 맞춘다: 보기 · 설정과 다른 놀이 · 판 (형: "버튼들이 너무 질서없이")
    h += `<div class="menu3"><button class="btn" data-act="help">${tr('nation.help')}</button><button class="btn" data-act="log-open">${tr('nation.log')}</button><button class="btn" data-act="dex-open">${tr('title.heroes')}</button>`
    if (!installed() && installPrompt() !== null) h += `<button class="btn ghost" data-act="install">${tr('nation.install')}</button>`
    if (host.saves !== undefined) h += `<button class="btn" data-act="save-open" data-tip="${tr('nation.saveTip')}">${tr('nation.save')}</button>`
    h += `<button class="btn ghost" data-act="mute">${tr(muted() ? 'nation.soundOn' : 'nation.soundOff')}</button><button class="btn ghost" data-act="export" data-tip="${tr('more.exportTip', { n: host.gameCount() })}">${tr('more.export')}</button>`
    h += `<a class="btn ghost" href="${(import.meta.env?.BASE_URL ?? '/')}" data-tip="${tr('nation.archeryTip')}">${tr('more.archery')}</a>${PRACTICE_READY ? `<button class="btn ghost" data-act="practice-open">${tr('more.practice')}</button>` : ''}`
    h += `<button class="btn ghost" data-act="newgame" data-tip="${tr('nation.newTip')}">${tr('title.new')}</button><button class="btn ghost" data-act="lobby" data-tip="${tr('nation.lobbyTip')}">${tr('nation.lobby')}</button></div>`
    return h + gfxRowHtml() + perfRowHtml() + volumeRowsHtml() + acctHtml() + resetHtml()
  }

  // ───────── 계정 (docs/realm/SERVER.md) — 나라 판 맨 아래 · 첫 화면 한 줄 · 갈라진 판 고르기
  /** 계정 지우기를 한 번 눌렀다 — 두 번째 누름에서 지운다 (브라우저 확인 창은 쓰지 않는다) */
  let acctArmed = false
  /** 이번에 띄운 동안 「확인」으로 닫았다 (다시 보지 않기를 안 골랐으면 다음에 켤 때 또 뜬다) */
  let instClosed = false
  let instNow = false // 이번에 열린 동안은 계속 보인다 (다시 그려도)
  /**
   * 이 기기에 이미 깔린 앱이 있나 — 깔려 있으면 크롬이 설치 신호(beforeinstallprompt)를 안 줘서 설치 단추를 띄울 수 없다
   * (형 10-30: "상단에 아직도 텍스트로만 앱설치 안내 · 앱설치 버튼 어디갔음"). realm.webmanifest 의 related_applications 로 묻는다
   */
  let appOnDevice = false
  void (navigator as unknown as { getInstalledRelatedApps?: () => Promise<unknown[]> }).getInstalledRelatedApps?.()
    .then((a) => { if (a.length > 0) { appOnDevice = true; paint() } }).catch(() => { /* 못 묻는 브라우저 */ })
  /** 「플레이 기록 지우기」를 한 번 눌렀다 — 한 번 더 눌러야 지운다 */
  let resetArmed = false
  function syncWord(s: SyncState): string {
    switch (s.kind) {
      case 'off': return tr('acct.syncOff')
      case 'busy': return tr('acct.syncBusy')
      case 'choose': return tr('acct.syncChoose')
      case 'error': return tr('acct.syncError', { msg: s.msg })
      case 'idle': return s.at !== null ? tr('acct.syncLast', { time: new Date(s.at).toLocaleTimeString(lang() === 'en' ? 'en-US' : 'ko-KR', { hour: '2-digit', minute: '2-digit' }) }) : tr('acct.syncReady')
    }
  }
  /** 플레이 기록 지우기 — 계정과 설정은 남긴다. 두 번 눌러야 (형 10-24: "계정으로 플레이한 데이터 초기화하는 버튼") */
  function resetHtml(): string {
    if (host.resetPlay === undefined) return ''
    const cloud = host.cloud?.who() != null
    return `<h3>${tr('acct.resetTitle')}</h3><div class="acct"><p class="mute">${tr('acct.resetBody')}${cloud ? ` ${tr('acct.resetCloud')}` : ''} ${tr('acct.resetKeep')}</p>`
      + `<div class="btns"><button class="btn ghost danger" data-act="reset-play">${tr(resetArmed ? 'acct.resetArmed' : 'acct.resetBtn')}</button></div></div>`
  }

  function acctHtml(): string {
    const c = host.cloud
    if (c === undefined) return ''
    let h = `<h3>${tr('acct.title')}</h3><div class="acct">`
    if (!c.available()) return h + `<p class="mute">${tr('acct.noCloud')}</p></div>`
    const who = c.who()
    if (who === null) {
      h += `<p class="mute">${tr('acct.signInHint')}</p>`
      return h + `<div class="btns"><button class="btn pri" data-act="acct-in">${tr('more.login')}</button></div></div>`
    }
    h += `<p><b>${esc(who.name !== '' ? who.name : who.email)}</b> <span class="mute">${esc(who.email)}</span></p><p class="mute">${esc(syncWord(c.state()))}</p>`
    h += `<div class="btns"><button class="btn" data-act="acct-sync">${tr('acct.syncNow')}</button><button class="btn ghost" data-act="acct-out">${tr('acct.signOut')}</button>`
    h += `<button class="btn ghost danger" data-act="acct-del">${tr(acctArmed ? 'acct.delArmed' : 'acct.del')}</button></div></div>`
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
    // 처음 온 사람의 첫 화면엔 안 띄운다 — 첫 승리 뒤에 한 번만 (긴급 위원회 11-04 · ftue B11: 첫 화면 누를 거리 11 → 7)
    if (!instNow) {
      let seen = false
      try { seen = localStorage.getItem(INSTALL_SEEN_KEY) === '1' } catch { seen = false }
      if (seen || !everWon()) return ''
      instNow = true
      try { localStorage.setItem(INSTALL_SEEN_KEY, '1') } catch { /* 저장 못 하는 곳 */ }
    }
    // 카카오톡 안의 브라우저는 설치를 못 한다 — 바깥 브라우저(크롬·사파리)로 여는 단추 (지인들은 카톡으로 받은 주소를 연다)
    if (/KAKAOTALK/i.test(navigator.userAgent)) {
      return `<div class="instc"><button class="instx" data-act="inst-ok" aria-label="${tr('more.closeAria')}">✕</button><b>${tr('inst.title')}</b><p>${tr('inst.kakao', { browser: tr(ios ? 'inst.safari' : 'inst.chrome') })}</p>`
        + `<div class="instr"><a class="btn pri sm" href="kakaotalk://web/openExternal?url=${encodeURIComponent(location.href)}">${tr(ios ? 'inst.openSafari' : 'inst.openChrome')}</a><label class="chk"><input type="checkbox" class="insthide"> ${tr('inst.dontShow')}</label><button class="btn sm" data-act="inst-ok">${tr('inst.ok')}</button></div></div>`
    }
    // 이미 깔려 있으면 설치 대신 아이콘으로 열라고 (설치 단추는 크롬이 주지 않는다)
    if (appOnDevice && installPrompt() === null) {
      return `<div class="instc"><button class="instx" data-act="inst-ok" aria-label="${tr('more.closeAria')}">✕</button><b>${tr('inst.already')}</b><p>${tr('inst.alreadyBody')}</p>`
        + `<div class="instr"><label class="chk"><input type="checkbox" class="insthide"> ${tr('inst.dontShow')}</label><button class="btn sm" data-act="inst-ok">${tr('inst.ok')}</button></div></div>`
    }
    const how = ios
      ? tr('inst.howIos')
      : installPrompt() !== null ? tr('inst.howPrompt')
        : tr('inst.howMenu')
    // 첫 화면 위쪽에 뜨는 알림 — ✕ 로 끈다 (형 10-28: "상단에 나오는 팝업으로 만들어서 끌 수 있게")
    return `<div class="instc"><button class="instx" data-act="inst-ok" aria-label="${tr('more.closeAria')}">✕</button><b>${tr('inst.title')}</b><p>${how}</p>`
      + `<div class="instr">${!ios && installPrompt() !== null ? '<button class="btn pri sm" data-act="install">' + tr('inst.install') + '</button>' : ''}<label class="chk"><input type="checkbox" class="insthide"> ${tr('inst.dontShow')}</label><button class="btn sm" data-act="inst-ok">${tr('inst.ok')}</button></div></div>`
  }

  /**
   * 이번 계절 할 일 하나 — 처음 하는 사람에게만, 「다음 계절」 위에. 누르면 그 판이 열린다
   * (형 10-24: "한 화면에 할 일 하나" · 동료가 빨간불을 무시하고 다음 계절만 눌렀다)
   */
  function todoHtml(r: Realm): string {
    if (r.region === 'tutorial' || r.outcome || sheet !== null) return ''
    // 떠돌이 상단이 머물면 늘 — 누구에게나 (배우는 사람만이 아니라)
    const mk = marketOf(r, me())
    if (mk !== null) return `<button class="todochip mkchip" data-act="market">${icon('route-caravan', 'wki')} ${tr('todo.market', { place: esc(r.nodes[mk.at]?.name ?? ''), turns: turnsLabel(r, mk.until - r.season + 1) })}${wishReady(r, me()) ? `<i class="mkwish">${tr('todo.wish')}</i>` : ''}</button>`
    // 장수가 알아서 일하는 것은 알림 거리가 아니다 — 늘 그렇다 (형 10-26: "원래 자동으로 다 알아서 하지만") · 장수 판 맨 위에 누가 어디로 가는지
    if (!novice()) return ''
    const drafted = musters.some((o) => o.kind === 'draft')
    const canDraft = Object.values(r.nodes).some((n) => n.owner === me() && draftLimit(r, me(), n.id) > 0)
    const idle = tabWait(r, 'heroes') === 0 ? waitingHeroes(r).length : 0
    const asks = openAsks(r, me()).filter((a) => answers[a.id] === undefined).length
    const armyIdle = Object.values(r.armies).some((a) => a.faction === me() && a.march === null && pick[a.id] === undefined && goalOf(a) === undefined)
    const t = asks > 0 && tabWait(r, 'diplo') === 0 ? { tab: 'diplo', line: tr('todo.asks') }
      : !drafted && canDraft && r.season < 4 ? { tab: 'draft', line: tr('todo.draft') }
        : idle > 0 ? { tab: 'heroes', line: tr('todo.idle', { n: idle }) }
          : armyIdle && r.season >= 1 ? { tab: 'army', line: tr('todo.army') }
            : null
    return t === null ? '' : `<button class="todochip" data-act="tab" data-tab="${t.tab}">${tr('todo.chip', { turn: turnWord(r), line: esc(t.line) })}</button>`
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
    if (asks > 0) out.set('diplo', tr('rec.asks', { n: asks }))
    // 사로잡은 적장 — 회유가 첫 시간에 늦었다 (FIRST-HOUR 지연 3 · 11-11) · 쉬는 장수보다 먼저
    const jail = Object.values(r.heroes).filter((h) => h.status === 'captive' && h.captor === me() && h.persuade === undefined && wooable(r, h.id)).length
    if (jail > 0) out.set('heroes', tr('rec.jail', { n: jail }))
    if (idleHeroes > 0 && !out.has('heroes')) out.set('heroes', tr('rec.idle', { n: idleHeroes }))
    if (armyIdle && r.season >= 1) out.set('army', tr('rec.army', { turn: turnWord(r) }))
    if (!drafted && canDraft) out.set('draft', tr('rec.draft'))
    // 우리 고을로 오는 적 — 군대 탭이 먼저 (막을 군대를 보낸다)
    if (seenMarches(r, me()).some((a) => a.march !== null && r.nodes[a.march.to]?.owner === me())) { out.delete('army'); out = new Map([['army', tr('rec.foe')], ...out]) }
    if (!out.has('heroes') && wanderersFor(r, me()).length > 0) out.set('heroes', tr('rec.wander'))
    // 개척 — 임자 없는 빈땅에 지금 개척단을 보낼 수 있으면 (우리 마을에 품이 남은 것은 빈땅이 아니다 · 형 10-29: "개척할 빈땅이 없는데 백성에 추천")
    if (settleRec(r) !== null) out.set('people', tr('rec.settle'))
    // 곳간을 부을 곳 — 짓던 큰 공사의 다음 단을 쌓을 수 있거나 큰 잔치를 열 수 있으면 (wonders.ts · 위원회 11-08 ⑦)
    const ww = wonderWorkOf(r, me())
    if (!musters.some((o) => o.kind === 'wonder' || o.kind === 'feast') && ((ww !== null && canWonder(r, me(), ww.what)) || (greatOpen(r, me()) && feastBlocked(r, me()) === null))) out.set('nation', tr('rec.wonder'))
    const idleRec = idleRecs(r)
    for (const [tab, text] of idleRec) out.set(tab, text) // 구체적인 까닭이 "할 일 없는 군대가 있다" 같은 일반 말을 덮는다
    for (const k of [...out.keys()]) if (sheet?.kind === k) out.delete(k)
    return new Map([...out].slice(0, idleRec.length > 0 ? Math.max(3, P.realm.recTabMax) : P.realm.recTabMax))
  }

  /**
   * 칠 곳이 없을 때 할 일 — 판을 바꾸는 명령 없이 idleRecSeasons 계절이 지나면 구체적인 길 셋 (PLAYTEST-1112 TOP 2).
   * 큰 군대가 놀면 가장 승산 높은 이웃(없으면 정찰)을 가장 앞에 둔다. 탭 하나에 한 줄이라 군대 칸은 군대 말이 먼저
   */
  function idleRecs(r: Realm): Array<[string, string]> {
    const out: Array<[string, string]> = []
    if (r.region === 'tutorial' || r.outcome || (r.idle?.seasons ?? 0) < P.realm.idleRecSeasons) return out
    const army = Object.values(r.armies).filter((a) => a.faction === me() && a.march === null && (r.idle?.army[a.id] ?? 0) >= P.realm.idleRecSeasons).sort((a, b) => headcount(forceOf(r, b)) - headcount(forceOf(r, a)))[0]
    if (army !== undefined) {
      const men = headcount(forceOf(r, army))
      const k = r.idle?.army[army.id] ?? 0
      let best: { to: string; w: number } | null = null
      for (const m of movesOf(r, me(), army)) if (m.hostile && m.blocked === null && m.win !== null && (best === null || m.win[0] > best.w)) best = { to: m.to, w: m.win[0] }
      out.push(['army', best !== null
        ? tr('rec.idleArmyGo', { n: men, k, to: r.nodes[best.to]?.name ?? '', pct: pctText(best.w, best.w) })
        : tr('rec.idleArmyHold', { n: men, k })])
    }
    const seen = r.intel[me()] ?? {}
    const unseen = new Set<string>()
    for (const e of Object.values(r.edges)) for (const [x, y] of [[e.a, e.b], [e.b, e.a]] as const) {
      if (r.nodes[x]?.owner === me() && r.nodes[y]?.owner !== me() && seen[y] === undefined) unseen.add(y)
    }
    if (unseen.size > 0 && !out.some(([t]) => t === 'army')) out.push(['army', tr('rec.idleScout', { n: unseen.size })])
    const have = left()
    const maxDraft = Math.max(0, ...Object.values(r.nodes).filter((n) => n.owner === me()).map((n) => draftLimit(r, me(), n.id)))
    if (maxDraft > 0 && have.grain > 0) out.push(['draft', tr('rec.idleDraft', { n: maxDraft, grain: Math.floor(have.grain) })])
    const cap = r.factions[me()]?.capital
    if (cap !== undefined) {
      const cheap = workOptions(r, cap).filter((w) => workBlocked(r, me(), cap, w) === null)
        .map((w) => ({ w, c: workCost(w, 1) })).filter((x) => (Object.entries(x.c) as Array<[Good, number]>).every(([g, n]) => have[g] >= n))
        .sort((a, b) => (a.c.grain ?? 0) + (a.c.wood ?? 0) - (b.c.grain ?? 0) - (b.c.wood ?? 0))[0]
      if (cheap !== undefined) out.push(['nation', tr('rec.idleBuild', { town: r.nodes[cap]?.name ?? '', work: WORKS[cheap.w].name, grain: cheap.c.grain ?? 0, wood: cheap.c.wood ?? 0 })])
    }
    const friend = diploTips(r, me()).find((t) => t.kind === 'met')
    if (friend !== undefined) out.push(['diplo', tr('rec.idleDiplo', { name: r.factions[friend.to]?.name ?? friend.to })])
    return out
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
      return ch !== undefined ? `${chapterTag(ch.n)} ${ch.name}` : (BOARD_NAME_OF[rg] ?? '')
    }
    let h = `<div class="front annals"><div class="fhead"><button class="btn ghost" data-act="fr-back">${tr('boards.back')}</button><h2>${tr('title.annals')}</h2></div>`
    h += `<p class="ansum">${tr('annal.sum', { n: xs.length, won })}</p>`
    // 판마다 한 권 — 책등은 나라 빛 · 두께는 판의 길이 · 누르면 펼친다 (형 11-05: "역사책으로 책장 만들어 준다며")
    const res = (g: PastGame): [Book['result'], string] => g.end === null ? (g.current ? ['now', tr('annal.now')] : ['quit', tr('annal.quit')]) : g.end.kind === 'win' ? ['win', tr('annal.win')] : g.end.kind === 'lose' ? ['lose', tr('annal.lose')] : ['quit', tr('annal.gaveUp')]
    const titleOfG = (g: PastGame): string => g.name !== '' ? g.name : (FACTION_NAME_OF[g.nation] ?? g.nation)
    const subOf = (g: PastGame): string => {
      const d = new Date(g.started)
      const date = Number.isFinite(d.getTime()) ? `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}` : ''
      return `${boardOf(g.region)}${g.tier !== null && g.region !== 'tutorial' ? ` · ${levelName(g.tier)}` : ''} · ${g.end !== null ? seasonLabel({ season: g.end.season, clock: g.clock }, g.end.season) : tr('annal.nth', { when: turnsLabel(g, g.seasons) })}${date !== '' ? ` · ${date}` : ''}`
    }
    const books: Book[] = xs.filter((g) => g.seed !== undefined).map((g) => {
      const [result, word] = res(g)
      return { seed: g.seed!, title: titleOfG(g), sub: subOf(g), result, word, seasons: g.seasons, color: nationKit(g.nation).c, emblem: emblem(g.nation, 'bkem') }
    })
    h += shelfHtml(books, esc)
    // 펼친 책 — 그 판의 처음 모습에서 이름을 꺼내 본기와 흥망 그래프를
    const g = bookSeed !== null ? xs.find((x) => x.seed === bookSeed) : undefined
    if (g !== undefined && g.seed !== undefined) {
      const hist = host.pastHistory?.(g.seed) ?? []
      let r0: Realm | null = null
      try { r0 = startRegion((g.region ?? 'byeonhan-mini') as RegionId, g.seed, g.nation) } catch { r0 = null }
      const [result, word] = res(g)
      const ch = r0 !== null ? chronicleOf(KIT, r0, hist) : null
      const clocked = { clock: g.clock }
      const lines = (ch?.events ?? []).slice().sort((a, b) => a.s - b.s).map((e) => ({ when: seasonLabel({ season: e.s, ...clocked }, e.s), t: e.t, big: e.big, img: e.img, ...(e.d !== undefined ? { d: e.d } : {}), ...(e.lose === true ? { lose: true } : {}) }))
      const stats = ch !== null ? `<div class="stats"><span><b>${ch.won}</b>${tr('annal.wonB')}</span><span><b>${ch.lost}</b>${tr('annal.lostB')}</span>${ch.takes > 0 ? `<span><b>${ch.takes}</b>${tr('annal.towns')}</span>` : ''}${ch.heroes > 0 ? `<span><b>${ch.heroes}</b>${tr('annal.heroes')}</span>` : ''}</div>` : ''
      const graph = r0 !== null ? riseGraphHtml(hist, { me: r0.player, mine: '#2f8cff', colorOf: (f) => nationKit(f).c, nameOf: (f) => r0!.factions[f]?.name ?? f, esc, dateOf: (s) => dateLabel({ season: s, clock: g.clock }, s) }) : ''
      h += bookHtml({ title: titleOfG(g), sub: subOf(g), word, result, emblem: emblem(g.nation, 'bkem'), color: nationKit(g.nation).c, lines, stats, graph }, esc)
    }
    return h + `</div>`
  }

  /** 판을 연다 — 데려갈 수 있는 장수가 있으면 먼저 「데려갈 장수」 팝업 (배우는 판·동행이 없는 난세·영웅전에 거느린 이가 없으면 곧장) */
  function startWithBring(nation: string, region: RegionId, tier: number): void {
    if (region === 'tutorial' || retainMaxOf(tier) === 0 || servedHeroes().length === 0) { host.onNewGame(nation, region, tier); return }
    bringAsk = { nation, region, tier }
    // 늘 빈 채로 연다 — 지난 판의 고름이 미리 체크돼 있지 않게 (형 11-04: "데려갈 장수 선택할 때 default 로 미리 선택돼 있는 것 없애")
    clearBring()
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
    const body = `<div class="bringbox" role="dialog" aria-label="${tr('bring.aria')}"><button class="bx" data-act="bring-x" aria-label="${tr('more.closeAria')}">✕</button>${bringHtml(DEX_KIT, servedHeroes(), max, drilled)}`
      + `<div class="bringgo"><button class="btn ghost" data-act="bring-none">${tr('bring.none')}</button><button class="btn pri" data-act="bring-go">${tr('bring.go')}</button></div></div>`
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
        if (f.size > P.realm.saveFileMaxMB * 1024 * 1024) { saveSay(tr('save.tooBig'), true); return }
        void f.text().then((text) => saveOpened(host.saves?.loadFile(text) ?? null), () => saveSay(tr('save.readFail'), true))
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
    if (act === 'drop') { const why = sv.drop(n); saveSay(why ?? tr('save.dropped', { n: n + 1 }), why !== null); return }
    saveDraft() // 이번 계절에 정해 둔 명령까지 담기게
    const why = sv.save(n, saveBox.name)
    if (why === null) saveBox.name = '' // 다음 저장은 다시 그때의 계절 · 나라 이름으로
    saveSay(why ?? tr('save.saved', { n: n + 1, old: act === 'over' && label !== '' ? tr('save.over', { label }) : '' }), why !== null)
  }

  /** 영웅전에 「거느림」으로 오른 장수 — 판을 열 때 데려갈 수 있는 이 (군주는 빼고) */
  function servedHeroes(): ReadonlyArray<{ id: string; name: string }> {
    const dex = loadDex()
    // 가문 — 혼인해서 난 아이도 데려간다 (형 10-25)
    return [...dexCatalog().filter((x) => !x.ruler && ((dex[x.id]?.f ?? 0) & DEX_SERVED) !== 0).map((x) => ({ id: x.id, name: x.name })), ...clanHeroes().map((x) => ({ id: x.id, name: x.name }))]
  }

  /** 처음 하는 사람인가 — 배우는 판 말고 한 판이라도 이겼으면 아니다 */
  function novice(): boolean {
    return !(['mahan', 'jumong', 'seorabeol', 'gujibong', 'daemusin', 'byeonhan-mini', 'yeongnam', 'south', 'world'] as const).some((b) => tierWon(b) > 0)
  }
  /** 이 탭이 열리기까지 남은 계절 (0 이면 열림) — 튜토리얼을 마친 손님에겐 안 잠근다: 다 써 본 탭을 다시 잠그니 첫 석 달 소식이 「새로 열렸다」 셋뿐이었다 (긴급 위원회 11-04 · loop B5) */
  function tabWait(r: Realm, id: (typeof TABS)[number]['id']): number {
    if (r.region === 'tutorial' || !novice() || tutorialDone()) return 0
    return Math.max(0, TAB_OPEN_AT[id] - r.season)
  }
  /** 이번에 막 열린 탭 — 반짝이고 한 줄 알림 (판마다 한 번) */
  let newTab = ''
  function noteNewTabs(r: Realm): void {
    if (r.region === 'tutorial' || !novice() || tutorialDone()) return
    const key = 'hanbal.realm.tabsOpen'
    let seen: { seed: number; ids: string[] } = { seed: r.seed, ids: [] }
    try { const v = JSON.parse(localStorage.getItem(key) ?? 'null') as typeof seen | null; if (v !== null && v.seed === r.seed) seen = v } catch { /* 처음 */ }
    for (const t of TABS) {
      if (tabWait(r, t.id) > 0 || seen.ids.includes(t.id)) continue
      seen.ids.push(t.id)
      // 바로 이번 계절에 열린 것만 알린다 — 옛 판을 열었을 때 한꺼번에 뜨지 않게
      if (tabNewLine(t.id) !== '' && TAB_OPEN_AT[t.id] > 0 && r.season === TAB_OPEN_AT[t.id]) { newTab = t.id; tabToast(t.name, tabNewLine(t.id)) }
    }
    try { localStorage.setItem(key, JSON.stringify(seen)) } catch { /* 저장 못 하는 곳 */ }
  }
  /** 새로 열린 탭 알림 — 아래 탭 위에 한 줄, 7초면 걷히고 누르면 바로 걷힌다 */
  function tabToast(name: string, line: string): void {
    root.querySelector('.tabtoast')?.remove()
    root.insertAdjacentHTML('beforeend', `<div class="tabtoast"><b>${tr('tab.unlocked', { name: esc(name) })}</b><span>${esc(line)}</span></div>`)
    const el = root.querySelector<HTMLElement>('.tabtoast')!
    const gone = (): void => { el.remove(); if (newTab !== '') { newTab = ''; paint() } }
    el.addEventListener('click', gone)
    window.setTimeout(gone, TAB_TOAST_MS)
  }

  /** 말 고르기 — 「더 보기」 맨 위. 바꾸면 다시 열어 모든 글이 갈아입는다 */
  function langRowHtml(): string {
    const b = (l: Lang): string => `<button class="${lang() === l ? 'on' : ''}" data-act="lang-set" data-v="${l}">${tr(`lang.${l}`)}</button>`
    return `<div class="gfxq"><b>${tr('lang.title')}</b><span class="seg sm">${LANGS.map(b).join('')}</span></div>`
  }
  function acctLine(): string {
    const c = host.cloud
    if (c === undefined || !c.available()) return ''
    const who = c.who()
    if (who === null) return `<p class="fine acctl"><button class="btn ghost" data-act="acct-in" data-tip="${tr('more.loginTip')}">${tr('more.login')}</button></p>`
    return `<p class="fine acctl mute">${esc(who.email)} · ${esc(syncWord(c.state()))}</p>`
  }
  /** 갈라진 판 고르기 — 카드 둘. 고르지 않은 쪽도 기기에 한 벌 남는다 (sync OTHER_KEY) */
  function chooseHtml(): string {
    const s = host.cloud?.state()
    if (s?.kind !== 'choose') return ''
    const card = (x: Side, pick: 'here' | 'there', title: string): string =>
      `<button class="btn pickc" data-act="acct-pick" data-v="${pick}"><small>${title}</small><b>${esc(x.nation)}</b><span>${esc(seasonLabel(x))}</span><span class="mute">${x.savedAt !== '' ? esc(new Date(x.savedAt).toLocaleString('ko-KR')) : ''}</span></button>`
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
    let h = `<div class="paths"><h4 class="qh">${tr('paths.h')} <small>${tr('paths.hSub')}</small>${guideBtn('paths')}</h4>`
    h += `<div class="path"><b>${tr('paths.conquest')}</b>${bar(held, need)}<span>${tr('paths.capitals', { a: held, b: need })}</span></div>`
    h += `<div class="path"><b>${tr('paths.suzerain')}</b>${bar(pact.score, pact.need, 'pact')}<span data-tip="${tr('paths.vassalTip')}">${tr('paths.vassals', { a: pact.vassals, b: pact.need })}</span></div>`
    h += `<div class="path sub"><span class="clock">${clock}</span><span class="mute">${streak > 0 ? tr('paths.pact', { a: streak, b: S }) : tr('paths.pactIdle')}</span></div>`
    // 철과 뱃길 — 철광·포구를 둘 다 쥐고 창고 철을 문턱까지 (paths.ironOf)
    const io = ironOf(r, me())
    h += `<div class="path"><b>${tr('paths.iron')}</b>${bar(io.gate ? io.iron : 0, io.need, 'iron')}<span>${tr('paths.ironN', { a: io.iron, b: io.need })}</span></div>`
    h += `<div class="path sub"><span class="mute">${io.mine ? tr('paths.mine') : tr('paths.noMine')} · ${io.port ? tr('paths.port') : tr('paths.noPort')}${io.gate ? '' : tr('paths.both')}</span></div>`
    // 큰 제사 — 사슬(봄·가을 제사를 내리) · 집 막대
    const ri = riteOf(r, me())
    const chain = Array.from({ length: ri.need }, (_, i) => `<i class="${i < ri.chain ? 'on' : ''}" title="${i % 2 === 0 ? tr('paths.spring') : tr('paths.autumn')}"></i>`).join('')
    h += `<div class="path"><b>${tr('paths.rite')}</b>${bar(ri.hh, ri.hhNeed, 'rite')}<span>${tr('paths.homes', { a: ri.hh.toLocaleString('ko-KR'), b: ri.hhNeed.toLocaleString('ko-KR') })}</span></div>`
    h += `<div class="path sub"><span class="clock rite">${chain}</span><span class="mute">${tr('paths.chain', { a: ri.chain, b: ri.need })}</span></div>`
    // 남의 철과 뱃길 · 큰 제사 — 소문으로 들은 것 (아는 나라만)
    for (const key of Object.keys(r.pathNear ?? {}).sort()) {
      const [kind, f] = key.split(':') as [string, string]
      if (f === me() || !met(r, me(), f)) continue
      h += `<div class="path rival">${emblem(f, 'fem')}<span>${tx(tr(kind === 'iron' ? 'paths.rumorIron' : 'paths.rumorRite', { name: r.factions[f]?.name ?? '' }))}</span></div>`
    }
    // 남의 맹약 — 소문 (아는 나라만)
    for (const f of Object.keys(r.suzerain ?? {}).sort()) {
      if (f === me() || !met(r, me(), f)) continue
      const s = r.suzerain![f]!
      if (s.streak <= 0) continue
      h += `<div class="path rival">${emblem(f, 'fem')}<span>${tx(tr('paths.rumorPact', { name: r.factions[f]?.name ?? '', a: s.streak, b: S }))}</span></div>`
    }
    return h + `</div>`
  }

  function helpSheet(): string {
    const turn = turnWord(realm ?? {})
    return `<h3>${tr('help.title')}</h3><div class="btns"><button class="btn pri wide" data-act="howwin">${tr('help.howwin')}</button></div><div class="help">`
      + `<p>${realm !== null && monthly(realm) ? tr('help.monthly') : tr('help.seasonal')}</p>`
      + `<p>${tr('help.seasons1')}`
      + `${tr('help.seasons2')}</p>`
      + `<p>${tr('help.pioneer')}</p>`
      + `<p>${tr('help.people')}</p>`
      + `<p>${tr('help.map', { turn })}</p>`
      + `<p>${tr('help.odds')}</p>`
      + `<p>${tr('help.sodo')}</p>`
      + `<p>${tr('help.joint', { turn })}</p>`
      + `<p>${tr('help.goal')}</p></div>`
  }

  // ───────── 고을
  function nodeSheet(r: Realm, id: string): string {
    const n = r.nodes[id]!
    const known = (r.intel[me()] ?? {})[id]
    const ours = n.owner === me()
    const who = n.owner === null ? tr('node.noOwner') : (r.factions[n.owner]?.name ?? '')
    const isCap = Object.values(r.factions).some((f) => f.capital === id)
    const kind = n.kind === 'wild' && n.hh > 0 ? SETTLED_NAME : isCap ? (n.kind === 'port' ? tr('node.capPort') : tr('node.cap')) : NODE_KIND_NAME[n.kind]
    let h = `<div class="an big">${icon(nodeIcon(n), 'nic')}<div><h3>${esc(n.name)}${n.old !== undefined ? (n.old !== '' ? ` <small class="mute">${tr('node.oldName', { name: esc(n.old) })}</small>` : '') : NODE_NOW[id] !== undefined ? ` <small class="mute">${tr('node.nowName', { name: esc(NODE_NOW[id]!) })}</small>` : ''}</h3><span class="mute">${emblem(n.owner)}${esc(who)} · ${kind}</span></div></div>`
    // 고을지기 자리 — 맨 위에. 비었으면 실루엣과 물음표 (형 10-25: "자리가 비어 있단 걸 확실히") · 누르면 앉힐 장수
    if (ours && n.kind !== 'sodo' && n.hh > 0) h += chiefSlot(r, id) + (foldOpen.has('chief') ? `<div class="nfb">${chiefHtml(r, id)}</div>` : '')
    if (ours || known?.land) {
      const lines = n.tags.map((t) => TAG_LINE[t]).join(' ')
      const now = n.tags.map((t) => tagNow(t, seasonOf(r))).filter((x) => x !== null).join(' ')
      h += fold('land', tr('node.landStory'), `${lines !== '' ? `<p class="story">${esc(lines)}</p>` : ''}${now !== '' ? `<p class="mute">${esc(now)}</p>` : ''}`)
    }
    if (n.kind === 'sodo') h += riteCard(r)
    if (n.kind === 'wild') {
      if (n.owner === null) h += `<p class="story">${tr('node.empty', { n: n.room ?? 0 })}</p>`
      else if (ours && n.hh <= 0) h += `<p class="story">${tr('node.flagOnly')}</p>`
      if (n.owner === null || ours) {
        const can = foundLands(r).includes(id) || partiesOf(r, me()).some((p) => p.march?.to === id)
        h += can ? settleCard(r, id) : `<p class="mute">${tr('node.partyHow')}</p>`
      }
    }
    if (ours) {
      const men = Object.values(r.armies).filter((a) => a.at === id && a.faction === me() && a.march === null).reduce((s, a) => s + headcount(forceOf(r, a)), 0)
      for (const a of lentToMe(r).filter((x) => x.lent!.node === id)) h += `<p class="story">${tr('node.lent', { emb: emblem(a.faction), name: esc(r.factions[a.faction]?.name ?? ''), n: headcount(forceOf(r, a)), line: esc(lentLine(r, a)) })}</p>`
      const g = hhGrowth(r, id)
      const status = `<div class="ntab">`
        + `<span>${tr('node.people')}</span><b>${tr('node.hhOf', { hh: Math.floor(n.hh).toLocaleString('ko-KR'), men: Math.round(n.hh * P.realm.peoplePerHH).toLocaleString('ko-KR') })}</b>`
        + `<span>${tr('node.grows')}</span><b>${tr('node.growNext', { per: `${g.per >= 0 ? '+' : ''}${g.per}`, why: g.why.length > 0 ? ` <small>${esc(g.why.map((w) => GROWTH_WHY[w] ?? w).join(' · '))}</small>` : '' })}</b>`
        + `<span>${tr('node.guardPow')}</span><b>${tr('node.levy', { n: militiaMen(r, id), worth: militiaMen(r, id) > 0 ? tr('node.worth', { n: militiaWorth(r, militiaMen(r, id)) }) : '', men })}</b>`
        + `<span>${tr('node.draft')}</span><b>${tr('node.draftMore', { n: draftLimit(r, me(), id) })}</b></div>`
      // 고을 형편 · 나는 것 · 고을지기는 접어 둔다 — 제목 줄에 한 줄 요약
      h += fold('stat', tr('node.status', { hh: Math.floor(n.hh).toLocaleString('ko-KR'), n: militiaMen(r, id), men }), status)
      h += fold('yield', tr('node.yields'), nodeYieldHtml(r, id))
      h += `<h4 class="nsec">${tr('node.todo')}</h4>`
      const guarded = guards.includes(id)
      // 개척단 꾸리기 — 지도에 개척단이 서고 군대처럼 빈땅으로 보낸다. 배우는 판에서는 빈땅 판의 단추로 한다
      for (const p of n.kind !== 'wild' ? partiesOf(realm!, me()).filter((x) => x.at === id && (joining(x.id) || joinHere(id).includes(x))) : []) {
        h += joining(p.id)
          ? `<div class="btns"><button class="btn home wide on" data-act="ptjoin" data-army="${p.id}">${icon('unit-porters')}${tr('node.ptOn', { home: esc(r.nodes[p.home]?.name ?? ''), hh: p.hh })}</button></div>`
          : `<div class="btns"><button class="btn pri home wide" data-act="ptjoin" data-army="${p.id}">${icon('unit-porters')}${tr('node.ptGo', { home: esc(r.nodes[p.home]?.name ?? ''), hh: p.hh })}</button></div>`
      }
      if (n.kind !== 'wild') {
        if (settles.some((o) => o.kind === 'party' && o.node === id)) h += `<div class="btns"><button class="btn home wide on" data-act="party-undo" data-node="${id}">${tr('node.partyMade')}</button></div>`
        else {
          const k = partySize(r, me(), id)
          const c = partyCost(r, me(), k > 0 ? k : P.realm.partyMin)
          const near = partyMoves(r, me(), id).filter((m) => m.found).sort((x, y) => x.seasons - y.seasons || (x.to < y.to ? -1 : 1))[0]
          // 갈 빈땅이 없으면 개척은 할 일이 아니다 — 단추를 아예 안 보인다 (형 10-27: "주변에 빈땅이 있을 때만 · 다른 때에는 개척 전혀 필요가 없잖아")
          if (near !== undefined) {
            const what = esc(tr('node.partySend', { to: r.nodes[near.to]?.name ?? '' }))
            h += `<div class="btns"><button class="btn pri home wide wrapb" data-act="party" data-node="${id}"${k > 0 ? '' : noBtn(partyWhy(r, id))}>${icon('unit-porters')}${what}${k > 0 ? tr('node.partyHH', { k }) : ''} ${costHtml({ grain: c.grain, wood: c.wood })}${whenChip(tr('node.partyWhen', { prep: turnsLabel(r, Math.max(1, Math.round(P.realm.partyPrepTurns))), road: turnsLabel(r, near.seasons) }))}</button></div>`
          }
        }
      }
      h += draftCard(r, id, true)
      h += callBtn(r, id, false)
      // 장터 저울 — 장터가 선 고을이면 (위원회 11-04 림월드 ③)
      if (lvOf(r.nodes[id], 'market') > 0) h += `<div class="btns"><button class="btn" data-act="market">${icon('settle-market', 'wki')}${tr('node.market')}</button></div>`
      h += `<div class="btns"><button class="btn ${guarded ? 'on' : ''}" data-act="guard" data-node="${id}" data-tip="${tr('node.guardTip')}"${guarded || (canGuard(r, me(), id) && left().grain >= guardCost().grain) ? '' : noBtn(shortOf({ grain: guardCost().grain }) || tr('node.guardDone'))}>${tr('node.guard')} ${costHtml({ grain: guardCost().grain })}</button></div>`
      h += guardPathHtml(r, id)
      h += rallyHtml(r, id)
      // 목책·해자 — 나무로 짓는다 (땅마다 나는 것). 다음 계절에 선다
      const nb = nextBuild(r, id)
      const queued = musters.some((o) => o.kind === 'build' && o.node === id) || (r.builds ?? []).some((b) => b.node === id)
      const going = (r.builds ?? []).find((b) => b.node === id) // 짓는 중 — 몇 달 남았나 (형 11-01: "시간이 안 나와서 문제")
      if (nb !== null) {
        const bc = buildCost(nb, r, me())
        const ok = queued || (canBuild(r, me(), id, nb) && left().wood >= bc.wood && left().grain >= bc.grain)
        h += `<div class="btns"><button class="btn ${queued ? 'on' : ''}" data-act="build" data-node="${id}" data-what="${nb}"${ok ? '' : noBtn(buildWhy(r, id, nb))}>${going !== undefined ? tr('node.building', { what: BUILD_NAME[going.what], when: turnsLabel(r, Math.max(1, going.done - r.season + 1)) }) : queued ? tr('node.buildStart', { what: BUILD_NAME[nb], when: turnsLabel(r, seasons(r, 1)) }) : `${tr('node.wallIt', { what: BUILD_NAME[nb] })} ${costHtml({ wood: bc.wood, grain: bc.grain })}`}</button></div>`
        h += `<p class="mute">${nb === 'palisade' ? tr('node.palNote') : tr('node.fenceNote')} ${tr('node.takesTo', { when: turnsLabel(r, seasons(r, 1)) })}</p>`
      // 맞닿은 고을 한꺼번에 — 고을마다 같은 목책을 하나씩 누르는 잡일을 걷는다 (형 11-03: "다 똑같은 목책만 일일이 지어 줘야 하고 귀찮은데")
      {
        const all = wallPlan(r)
        if (all.list.length > 1) h += `<div class="btns"><button class="btn" data-act="wallall"${all.ok ? '' : noBtn(all.why)}>${icon('settle-palisade', 'wki')}${tr('node.wallAll', { n: all.list.length })} ${costHtml({ wood: all.wood, grain: all.grain })}</button></div>`
      }
      }
      // 고을 일터 — 고을마다 하나 · 땅에 맞는 것만 · 둘째 줄은 첫째 줄이 우리 땅 어딘가에 있어야 (works.ts · 형 11-03 "마을 내정")
      h += workCardHtml(r, id)
    }
    // 이 땅에서 나는 것 — 남의 고을·빈땅도 보인다 (칠 까닭 · 바꿀 까닭). 우리 고을은 위 「고을 형편」 밑에 이미 있다
    if (!ours) h += fold('yield', tr('node.yields'), nodeYieldHtml(r, id))
    if (!ours && n.kind !== 'sodo' && !(n.kind === 'wild' && n.owner === null && known?.force == null)) {
      const f = known?.force
      let force = tr('node.unseen')
      if (f) {
        const v = visibleRange({ f0: f.f0, src: f.src, u: f.u }, ageSeasons(r, f.season))
        force = v === null ? tr('node.tooOld') : `${span(v[0], v[1], (x) => String(Math.round(x)))}${militiaNote(r, id)} · ${r.season === f.season ? tr('node.agoNow', { turn: turnWord(r) }) : tr('node.ago', { when: turnsLabel(r, r.season - f.season) })}`
      }
      let alert = ''
      if (known?.alert) {
        const v = alertRange(known.alert.v, ageSeasons(r, known.alert.season))
        if (v !== null) alert = tr('node.alert', { feel: alertFeel(v[0], v[1]) })
      }
      h += `<p>${tr('node.force')} <b>${force}</b><span class="mute">${alert}</span></p>`
      // 정찰로 본 병종 — 몇 할씩 (형: "정찰하면 '궁수가 많다' 같은 구성이 보이게")
      const sm = seenMix(r, me(), id)
      if (sm !== null) {
        const parts = (Object.entries(sm.mix) as Array<[UnitKind, number]>).filter(([, v]) => v > 0).sort((x, y) => y[1] - x[1])
        h += `<p class="mute">${tr('node.kinds', { list: parts.map(([k, v]) => tr('node.kindShare', { name: UNIT_NAME[k], n: Math.round(v * 10) })).join(' · ') })}${sm.age > 0 && f ? tr('node.agoParen', { when: turnsLabel(r, r.season - f.season) }) : ''}</p>`
      }
      // 못 가는 곳도 단추는 두되 흐리게 — 왜 못 가는지 (형 10-23: "태백 기슭 마을에는 정찰 보내기 버튼이 왜 없")
      if (!scoutable(r).includes(id)) h += `<div class="btns"><button class="btn" data-act="busy"${noBtn(tr('node.scoutReach', { n: P.realm.scoutReach }))}>${tr('node.sendScout')}</button></div><p class="mute">${tr('node.scoutReach', { n: P.realm.scoutReach })}</p>`
      // 정찰꾼 수만큼 — 여러 곳을 누르면 다 가는 줄 알지 않게 (형: "매판 눌러줘야하고 누르면 전부다 정찰 가겠지? 할거라고") · 자리는 n/한도로
      if (scoutable(r).includes(id)) {
        const on = scouts.includes(id)
        const keep = scoutKeep.includes(id)
        const bump = on ? '' : scoutBump(r)
        const there = bump !== '' ? (r.nodes[bump]?.name ?? '') : ''
        const watch = watchedNodes(r, me()).includes(id) ? `<div class="mute">${tr('node.watch')}</div>` : ''
        h += `<div class="scoutbox">${watch}<div class="mute">${icon('unit-scouts', 'ssic')} ${tr('node.scoutBox', { a: scouts.length, b: scoutCap(r, me()) })}</div>`
        // 보낸 뒤엔 금빛 테 대신 눌려 들어간 단추 (형 10-27: "황금 테두리가 아니라 눌려 있는 버튼 연출로")
        h += `<button class="btn ${on ? 'prs' : ''}" data-act="scout" data-node="${id}">${on ? tr('node.scoutOn') : there !== '' ? tr('node.scoutSwap') : tr('node.scoutGo')}</button>` + (scoutAsk === id ? scoutAskHtml(r, id) : '')
        // 고정 풀기는 따로 떼어 아래에 — 붙어 있으면 잘못 누른다 (형 10-24)
        if (on || keep) h += `<button class="btn sm ${keep ? 'prs' : 'ghost'} keepbtn" data-act="scout-keep" data-node="${id}">${keep ? tr('node.keepOn', { turn: turnWord(r) }) : tr('node.keep', { turn: turnWord(r) })}</button>`
        h += `</div>`
      }
    }
    // 이 나라와 지금 할 수 있는 것 — 외교 판까지 안 가고 여기서 바로 (형: "타국 마을 누르면 … 얘내랑 할수있는 상호작용만 추려서 보여주고 바로 할수 있게")
    if (!ours && n.owner !== null && n.kind !== 'sodo' && met(r, me(), n.owner) && r.factions[n.owner] !== undefined) h += nationActs(r, n.owner, id)
    // 보내기는 지도에서 — 군대를 누르고 이 고을을 누른다 (형 10-29)
    return h
  }

  /**
   * 고을 둘레 단추 (z축 5·6단계 · docs/realm/ZAXIS-1031.md) — 고을을 누르면 큰 판 대신 그 고을에 붙은 것만 튀어나온다 (하스스톤처럼).
   * 우리 고을: 둘레에 동그란 단추 (고을지기 · 개척단 · 징병 · 목책 · 자세히) · 남의 고을: 곁에 작은 카드 (깃발 · 사이 · 군세 · 특산 + 정찰 · 외교 · 자세히)
   * 빈 땅: 큰 단추 하나 (개척단 보내기) 또는 못 가는 까닭 한 줄. 「자세히」 만 지금의 큰 판을 연다
   */
  function ringHtml(r: Realm): string {
    const id = ring
    const n = r.nodes[id]
    const p = nodePos(r.region ?? 'byeonhan-mini', id)
    if (n === undefined || p === undefined) return ''
    const at = `left:${(p[0] * 100).toFixed(3)}%;top:${(p[1] * 100).toFixed(3)}%`
    const ours = n.owner === me()
    const rb = (act: string, ic: string, label: string, extra = '', cls = ''): string =>
      `<button class="nrb${cls}" data-act="${act}" data-node="${id}"${extra}>${ic}<small>${label}</small></button>`
    const more = rb('nr-more', '<i class="nrm">⋯</i>', tr('ring.more'), '', ' more')
    // 개척단이 세운 마을은 kind 가 빈땅(wild)으로 남는다 — 사람이 살면 우리 고을과 같이 둘레 단추 (리뷰 11-01)
    if (ours && n.kind !== 'sodo' && (n.kind !== 'wild' || n.hh > 0)) {
      const bs: string[] = []
      if (r.factions[me()]?.capital !== id && n.hh > 0) {
        const ch = postHero(r, id)
        const come = heroOrders.find((o): o is Extract<Order, { kind: 'assign' }> => o.kind === 'assign' && o.node === id)
        const who = come !== undefined ? r.heroes[come.hero] : ch ?? undefined
        bs.push(rb('nr-chief', who !== undefined ? bust(who, 'nrf') : '<b class="nrq">?</b>', tr('ring.chief'), '', who === undefined ? ' empty' : ''))
      }
      {
        // 개척단은 도읍에서만 꾸린다 — 다른 고을엔 단추를 안 둔다 · 갈 빈 땅이 어디든 닿으면 뜬다
        const near = r.factions[me()]?.capital === id && foundLands(r).length > 0
        if (settles.some((o) => o.kind === 'party' && o.node === id)) bs.push(rb('party-undo', icon('unit-porters'), tr('x.recall'), '', ' on'))
        else if (near) bs.push(rb('party', icon('unit-porters'), tr('ring.party'), `${partySize(r, me(), id) > 0 ? '' : noBtn(partyWhy(r, id))} data-tip="${esc(tr('ring.partyTip', { when: turnsLabel(r, Math.max(1, Math.round(P.realm.partyPrepTurns))) }))}"`))
      }
      const done = musters.reduce((s, o) => s + (o.kind === 'draft' && o.node === id ? o.n : 0), 0)
      bs.push(rb('nr-draft', icon('unit-spear'), done > 0 ? `+${done}` : tr('node.draft'), draftLimit(r, me(), id) - done > 0 || done > 0 ? '' : noBtn(tr('ring.noLevy')), done > 0 ? ' on' : ''))
      { const cb = callBtn(r, id, true); if (cb !== '') bs.push(cb) }
      const nb = nextBuild(r, id)
      const going = (r.builds ?? []).find((b) => b.node === id)
      if (nb !== null || going !== undefined) {
        const what = going?.what ?? nb!
        const queued = musters.some((o) => o.kind === 'build' && o.node === id)
        const bc = buildCost(what, r, me())
        const ok = going === undefined && (queued || (canBuild(r, me(), id, what) && left().wood >= bc.wood && left().grain >= bc.grain))
        const label = going !== undefined ? tr('ring.left', { when: turnsLabel(r, Math.max(1, going.done - r.season + 1)) }) : BUILD_NAME[what]
        bs.push(rb('build', icon(what === 'moat' ? 'settle-moat' : 'settle-palisade'), label, ` data-what="${what}" data-tip="${esc(tr('ring.buildTip', { what: BUILD_NAME[what], when: turnsLabel(r, seasons(r, 1)) }))}"${ok ? '' : noBtn(buildWhy(r, id, what))}`, queued || going !== undefined ? ' on' : ''))
      }
      // 전군 집결 — 북을 울려 모든 군대를 이 고을로 (형 11-04: "마을 토글 버튼 중에 집결 버튼") · 모일 군대가 있거나 모이는 중일 때만
      {
        const plan = rallyPlan(r, id)
        const on = rallyOn(r, id, plan)
        if (plan.length > 0) bs.push(rb('rally', icon('unit-drummers'), on ? tr('ring.rallying') : tr('ring.rally', { n: plan.length }), '', on ? ' on' : ''))
      }
      // 마을 안 — 일터와 일하는 사람들이 보이는 곳 (docs/realm/TOWN.md · 형 11-04: "마을이 확대되면서 fade out fade in")
      if (worksOf(n).length > 0 || workOptions(r, id).length > 0) {
        const going = (r.works ?? []).some((w) => w.node === id)
        bs.push(rb('town-in', icon(worksOf(n)[0] !== undefined ? WORKS[worksOf(n)[0]![0]].icon : nodeIcon(n)), going ? tr('ring.building') : tr('ring.inTown'), ` data-tip="${tr('ring.inTownTip')}"`, going ? ' on' : ''))
      }
      bs.push(more)
      // 부채꼴 — 위쪽 가운데를 중심으로 왼쪽부터 오른쪽으로 (이름표는 고을 아래에 있다)
      // 단추 수만큼 부채가 넓어지고, 이웃 단추 사이(활꼴 현)가 mapRingGap 이상 되게 반지름을 키운다 — 여섯이 되면서 겹쳐 옆 단추가 눌렸다 (위원회 11-04 UX ①)
      const cnt = bs.length
      const arc = cnt > 1 ? Math.min(P.realm.mapRingArcMax, Math.max(P.realm.mapRingArc, P.realm.mapRingStep * (cnt - 1))) : 0
      const step = cnt > 1 ? arc / (cnt - 1) : 0
      const R = cnt > 1 ? Math.max(P.realm.mapRingR, P.realm.mapRingGap / (2 * Math.sin((step * Math.PI) / 360))) : P.realm.mapRingR
      const btns = bs.map((b, i) => {
        const deg = bs.length > 1 ? ringDeg + arc / 2 - (arc * i) / (bs.length - 1) : ringDeg
        const a = (deg * Math.PI) / 180
        return b.replace('<button class="nrb', `<button style="--x:${(Math.cos(a) * R).toFixed(1)}px;--y:${(-Math.sin(a) * R).toFixed(1)}px;--i:${i}" class="nrb`)
      }).join('')
      return `<div class="nring own" style="${at};--st:${P.realm.mapRingStaggerMs}ms">${btns}</div>`
    }
    // 곁에 뜨는 작은 카드 — 화면 위쪽 고을이면 아래로, 가장자리면 안쪽으로
    const side = `${p[1] < 0.3 ? ' dn' : ''}${p[0] < 0.18 ? ' lf' : p[0] > 0.82 ? ' rt' : ''}`
    const gains = nodeSpecials(r, id).map((g) => `<img src="${ART}icon/${GOOD_ICON[g]}.png" alt="${GOOD_NAME[g]}" title="${GOOD_NAME[g]}">`).join('')
    let h = ''
    if (n.owner !== null && !ours && n.kind !== 'sodo') {
      const o = n.owner
      const knownNation = met(r, me(), o)
      h += `<div class="nrh">${emblem(o)}<b>${esc(n.name)}</b>${knownNation ? relChipHtml(r, o) : `<span class="rel neutral">${tr('ring.unknownNation')}</span>`}</div>`
      const f = (r.intel[me()] ?? {})[id]?.force
      let force = tr('ring.unseen')
      if (f) {
        const v = visibleRange({ f0: f.f0, src: f.src, u: f.u }, ageSeasons(r, f.season))
        force = v === null ? tr('ring.tooOld') : `${span(v[0], v[1], (x) => String(Math.round(x)))}${militiaNote(r, id)}${r.season === f.season ? '' : tr('ring.agoSfx', { when: turnsLabel(r, r.season - f.season) })}`
      }
      h += `<div class="nrl">${icon('unit-spear')}<span>${tr('node.force')} <b>${force}</b></span>${gains !== '' ? `<span class="nrg">${gains}</span>` : ''}</div>`
      h += `<div class="nrbs">`
      if (scoutable(r).includes(id)) h += rb('scout', icon('unit-scouts'), scouts.includes(id) ? tr('x.recall') : tr('ring.scout'), '', scouts.includes(id) ? ' on' : '')
      { const s = senderFor(r, id); if (s !== null) h += rb('send-army', icon('unit-spear'), tr('cn.sortie'), ` data-army="${s.army}"`) }
      if (knownNation && r.factions[o] !== undefined) h += rb('nr-diplo', icon('good-tribute-bell'), tr('dip.title'), ` data-to="${o}"`)
      h += `${more}</div>`
    } else {
      h += `<div class="nrh">${icon(nodeIcon(n), 'nic')}<b>${esc(n.name)}</b></div>`
      if (gains !== '') h += `<div class="nrl"><span>${tr('ring.goods')}</span><span class="nrg">${gains}</span></div>`
      const wildFree = n.kind === 'wild' && (n.owner === null || (ours && n.hh <= 0))
      // 개척단 큰 단추 하나 — 가는 중 · 맞닿은 고을에서 · 도읍에서 우리 땅을 거쳐 · 못 닿으면 까닭 한 줄 (빈 땅과 주인 없는 터가 같이 쓴다)
      const settleHtml = (): string => {
        const goingP = partiesOf(r, me()).find((x) => x.march?.to === id || x.goal === id)
        const src = goingP === undefined && foundLands(r).includes(id) ? partySource(r, id) : null
        if (goingP !== undefined) return `<button class="btn home wide on nrbig" data-act="ptok" data-army="${goingP.id}" data-node="${id}">${icon('unit-porters')}${tr('ring.partyGoing', { home: esc(r.nodes[goingP.home]?.name ?? '') })}</button>`
        if (src !== null) {
          const c = partyCost(r, me(), partySize(r, me(), src.from, freeSite(n)), freeSite(n))
          return `<button class="btn pri home wide nrbig" data-act="party-to" data-node="${id}" data-from="${src.from}" data-edge="${src.edge}">${icon('unit-porters')}${tr('ring.sendParty')} ${costHtml({ grain: c.grain, wood: c.wood })}</button>`
        }
        if (foundLands(r).includes(id)) return capPartyHtml(r, id, 'nrbig')
        // 못 보내도 단추는 흐리게 남긴다 — 누르면 까닭 (형 11-04: "버튼 비활성화를 시켜야지 설명 텍스트로 모자라다고 하면 어떡하냐")
        const why = noReachWhy(r, me(), id)
        return `<button class="btn home wide nrbig" data-act="party-goal" data-node="${id}"${noBtn(why)}>${icon('unit-porters')}${tr('ring.sendParty')}</button><p class="nrwhy">${esc(why)}<small>${tr('ring.partyHow')}</small></p>`
      }
      if (wildFree) h += settleHtml() // 빈 땅 한 단추 (z축 6단계)
      else if (freeSite(n)) {
        // 주인 없는 철광·포구 (형 11-05: "군대 보내 놓고 있으면 내 땅이 아니어도 철 매 턴 수급 · 쌓이는 게 눈에 보이게") —
        // 쌓인 것(덜 찬 몫은 차오르는 띠) · 우리 군사가 지키면 달마다 거둔다 · 우리 땅으로 삼으려면 개척단
        const R = P.realm
        const y = nodeYield(r, id, seasonOf(r))
        const gs = GOODS.filter((g) => g !== 'grain' && goodOf(y, g) > 0)
        const per = perSeason(r)
        const fmt = (v: number): string => (Math.round(v * 10) / 10).toLocaleString('ko-KR')
        const pile = gs.map((g) => { const v = n.stash?.[g] ?? 0; return `<span class="sst" title="${GOOD_NAME[g]}"><img src="${ART}icon/${GOOD_ICON[g]}.png" alt="${GOOD_NAME[g]}"><b>${Math.floor(v + 1e-9)}</b><i style="--p:${Math.round((v - Math.floor(v + 1e-9)) * 100)}%"></i></span>` }).join('')
        const rate = gs.map((g) => `<span class="sst"><img src="${ART}icon/${GOOD_ICON[g]}.png" alt="${GOOD_NAME[g]}"><b>+${fmt((goodOf(y, g) * R.siteYieldMul) / per)}</b></span>`).join('')
        h += `<div class="nrl"><span>${tr('ring.pile')}</span><span class="nrg">${pile}</span></div>`
        const held = Object.values(r.armies).filter((a) => a.at === id && a.march === null)
        if (held.some((a) => a.faction === me())) {
          h += `<div class="nrhold${held.some((a) => a.faction !== me()) ? ' off' : ''}"><span>${icon('unit-spear')}${held.some((a) => a.faction !== me()) ? tr('ring.heldOff') : tr('ring.heldOn', { turn: turnWord(r) })}</span><span class="nrg">${rate}</span></div>`
        } else {
          const s = senderFor(r, id)
          h += s !== null
            ? `<button class="btn pri wide nrbig" data-act="send-army" data-node="${id}" data-army="${s.army}">${icon('unit-spear')}${esc(tr('ring.sendArmy', { name: r.heroes[r.armies[s.army]?.hero ?? '']?.name ?? tr('ring.us'), when: turnsLabel(r, s.seasons) }))}</button><p class="nrwhy"><small>${tr('ring.arrivePile', { turn: turnWord(r) })}</small></p>`
            : `<button class="btn wide nrbig" data-act="send-army" data-node="${id}"${noBtn(tr('ring.noArmy'))}>${icon('unit-spear')}${tr('ring.needMove')}</button>`
        }
        // 우리 땅으로 — 개척단 값에 편입 값까지 들어 있다 (떠날 때 치른다 · parties.formParty)
        h += settleHtml() + `<p class="nrwhy"><small>${tr('ring.settleNote')}</small></p>`
      } else if (n.owner === null && n.kind !== 'wild' && n.kind !== 'sodo' && n.hh > 0) {
        const s = senderFor(r, id)
        h += s !== null
          ? `<button class="btn pri wide nrbig" data-act="send-army" data-node="${id}" data-army="${s.army}">${icon('unit-spear')}${esc(tr('ring.sendArmy', { name: r.heroes[r.armies[s.army]?.hero ?? '']?.name ?? tr('ring.us'), when: turnsLabel(r, s.seasons) }))}</button><p class="nrwhy"><small>${tr('ring.ownerless')}</small></p>`
          : `<button class="btn wide nrbig" data-act="send-army" data-node="${id}"${noBtn(tr('ring.noArmy'))}>${icon('unit-spear')}${tr('ring.needMove')}</button>`
      }
      h += `<div class="nrbs">${more}</div>`
    }
    return `<div class="nring card${side}" style="${at}">${h}</div>`
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
      return `<div class="chslot${away ? ' away' : ''}">${lord !== null ? bust(lord, 'cface') : ''}<span class="chst"><small>${tr('ring.chiefCap')}</small><b>${nameHtml(lord?.name ?? '')}</b><i>${away ? tr('ring.lordAway') : tr('ring.lordRules')}</i></span></div>`
    }
    const coming = heroOrders.find((o): o is Extract<Order, { kind: 'assign' }> => o.kind === 'assign' && o.node === id)
    const cx = coming !== undefined ? r.heroes[coming.hero] : undefined
    const sil = `<span class="chsil"><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="14" r="7.5"/><path d="M5 40c0-10 6.5-15 15-15s15 5 15 15z"/></svg><b>?</b></span>`
    const open = foldOpen.has('chief') ? '▴' : '▾'
    let face: string, name: string, sub: string, cls: string
    if (cx !== undefined) { face = bust(cx, 'cface'); name = cx.name; sub = tr('ring.comes', { turn: turnWord(r) }); cls = 'come' }
    else if (acting !== null) { face = bust(acting, 'cface'); name = acting.name; sub = isRuler(r, acting.id) && posted === undefined ? tr('ring.lordTakes') : `${STAT_NAME.chi} ${acting.chi} · ${STAT_NAME.ryak} ${acting.ryak} · ${STAT_NAME.deok} ${acting.deok}`; cls = '' }
    else if (posted !== undefined) { face = bust(posted, 'cface'); name = posted.name; sub = tr('ring.postAway', { turn: turnWord(r) }); cls = 'away' }
    else { face = sil; name = tr('ring.vacant'); sub = tr('ring.seatHint'); cls = 'empty' }
    return `<button class="chslot ${cls}" data-act="fold" data-k="chief">${face}<span class="chst"><small>${tr('ring.chief')}</small><b>${nameHtml(name)}</b><i>${esc(sub)}</i></span><i class="chgo">${cls === 'empty' ? tr('ring.seat') : tr('ring.swap')} ${open}</i></button>`
  }

  function chiefHtml(r: Realm, id: string): string {
    if (r.factions[me()]?.capital === id) return '' // 도읍은 군주의 자리 — 앉힐 장수가 없다
    const holder = Object.values(r.heroes).find((y) => y.post === id && y.faction === me() && y.status === 'free')
    const coming = heroOrders.find((o): o is Extract<Order, { kind: 'assign' }> => o.kind === 'assign' && o.node === id)
    // 앉은 이는 위의 자리 칸(chiefSlot)이 보인다 — 여기는 앉힐 장수만
    let h = ''
    if (coming !== undefined) {
      const c = r.heroes[coming.hero]
      return h + `<div class="banner good">${esc(tr('node.chiefComes', { turn: turnWord(r), name: c?.name ?? '' }))}<button class="btn ghost sm" data-act="unhero" data-id="${coming.hero}">${tr('x.cancel')}</button></div>`
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
    if (cands.length === 0) return h + `<p class="mute">${tr('node.noIdle')}</p>`
    h += `<div class="mute">${holder !== undefined ? tr('node.seatSwap') : tr('node.seatNew')} · ${tr('node.byGov')}</div><div class="seg wrap farseg">`
    for (const x of cands.slice(0, 8)) {
      const far = reach(x) === 'far'
      h += `<button data-act="assign" data-id="${x.id}" data-node="${id}" data-tip="${far ? tr('node.farTip', { n: P.realm.escortMen, turn: turnWord(r) }) : tr('node.hereTip')}">${esc(x.name)}<small>${STAT_NAME.chi} ${x.chi}${far ? tr('node.farTag') : ''}</small></button>`
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
  /**
   * 남의 고을을 칠 때 나와 막는 농민군(장정) — 군세 범위 곁에 따로 (형 11-03: "정찰 땐 200~300인데 막상 쳐들어가니 창방패병 1000이면 당황").
   * 남의 속이라 범위로(ODDS 원칙 1) · 군사 몇 명 몫인지도 함께 — "1000명인데 왜 약하지"가 안 생기게
   */
  function militiaNote(r: Realm, id: string): string {
    const n = r.nodes[id]
    if (n === undefined || n.owner === null || n.owner === me()) return ''
    const m = militiaMen(r, id)
    if (m <= 0) return ''
    const lo = Math.max(10, Math.round((m * 0.85) / 10) * 10)
    const hi = Math.round((m * 1.15) / 10) * 10
    return tr('node.militia', { lo, hi, n: militiaWorth(r, m) })
  }

  /** 생산 — 「생산품 · 곡식 · 나무」 · 이번 계절 얼마 · 가을걷이 · 고기잡이 (형: "나무 난다 이런 말 말고 생산품: 나무") */
  function nodeYieldHtml(r: Realm, id: string): string {
    const n = r.nodes[id]!
    const y = nodeYield(r, id)
    const goods = (['grain', 'iron', 'salt', 'wood', 'horse'] as const).filter((g) => (y[g] ?? 0) > 0)
    const hv = nodeHarvest(r, id)
    const fish = n.kind !== 'sodo' && isCoast(r, id)
    let h = `<h4 class="nsec">${tr('node.prodH')}</h4><div class="ntab">`
    if (goods.length > 0) h += `<span>${tr('node.goodsL')}</span><b>${goods.map((g) => `${icon(GOOD_ICON[g], 'gic')}${GOOD_NAME[g]} ${y[g]}`).join(' · ')} <small>${tr('node.thisSeason')}</small></b>`
    else {
      // 아무도 안 사는 땅 — 일구면 무엇이 나는지 (지도의 흐린 특산 표와 같은 것)
      const sp = nodeSpecials(r, id)
      if (sp.length > 0) h += `<span>${tr('node.goodsL')}</span><b>${sp.map((g) => `${icon(GOOD_ICON[g], 'gic')}${GOOD_NAME[g]}`).join(' · ')} <small>${tr('node.ifPeople')}</small></b>`
    }
    if (hv > 0) h += `<span>${tr('node.harvest')}</span><b>${icon('good-rice', 'gic')}${tr('node.grainAbout', { n: hv })}</b>`
    if (n.kind !== 'sodo' && n.owner !== null) {
      // 땅의 결 — 쌀·나무·철·소금이 이 땅에서 더 나고 덜 난다 (economy.soilOf · 형 11-05: "어떤 땅은 나무도 잘 자라고 철도 묻혀 있어야")
      const soil = soilOf(r, id)
      if (soil.length > 0) h += `<span>${tr('node.soil')}</span><b class="soilrow">${soil.map((s) => `<i class="soil ${s.up ? 'up' : 'dn'}">${icon(GOOD_ICON[s.good], 'gic')}${esc(s.name)} <u>${s.good === 'iron' && s.up ? tr('node.ironLittle') : `${s.up ? '+' : '−'}${s.pct}%`}</u></i>`).join('')}</b>`
      // 소수는 안 보인다 — 말로 (형 10-23: "소수는 아무 데도 안 쓰고 있지 않냐")
      if (goods.some((g) => g !== 'grain')) { const w = workMul(n.hh); h += `<span>${tr('node.hands')}</span><b>${w < 0.75 ? tr('node.handsLow') : w < 1.2 ? tr('node.handsOk') : tr('node.handsHigh')} <small>${tr('node.handsNote')}</small></b>` }
    }
    // 바닷가 — 고기잡이는 겨울에 쉰다 (지도의 고기 표가 겨울엔 얼어 흐려진다)
    if (fish) h += `<span>${tr('node.fishing')}</span><b>${icon('good-dried-fish', 'gic')}${seasonOf(r) === 'winter' ? tr('node.fishWinter') : tr('node.fishSmall')}</b>`
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
    h += `<div class="nal">${tr('node.envoyH')}</div>`
    for (const e of sentTo(f)) h += sentBanner(r, e, false)
    h += askButtons(r, f, ' sm')
    h += `<div class="btns"><button class="btn ghost sm" data-act="nat-diplo" data-to="${f}">${tr('node.natDiplo')}</button></div>`
    // 공작 — 그림 칩 격자 · 누른 칩 바로 밑에 노릴 곳과 누가 가나 (plotGrid · 형 10-26: "사신은 간편해졌는데 공작은 아직도 공작이름이랑 설명이 같이 붙어있어서")
    // 이 고을·이 나라에 바로 걸 수 있는 갈래는 누르면 밑에 펼치고, 여기서 못 거는 갈래(두 나라 갈라놓기 · 이 고을에 없는 적장 암살)는 외교의 공작 칸으로
    h += `<div class="nal">${tr('dip.plot')} <span class="mute">${tr('plot.capNow', { turn: turnWord(realm!), n: plotCap(realm!), now: plots.length })}</span></div>` + plotGrid(r, { f, node })
    // 외교 판의 공작 칸 — 공작 밑에 (형: "외교에서 자세히 누르면 공작으로는 안넘어가네")
    h += `<div class="btns"><button class="btn ghost sm" data-act="nat-plot" data-to="${f}">${tr('node.natPlot')}</button></div></div>`
    return h
  }

  // ───────── 보고 카드
  function sceneOf(b: Realm, after: Realm, rep: Report): string {
    let best: { ev: string; hero: Hero | null; line: string } | null = null
    let rank = 0
    for (const l of rep.lines) {
      if (l.kind !== 'battle' || (l.key !== undefined && warWatched.has(l.key))) continue // 전장에서 본 싸움은 다시 안 그린다
      const weAtk = b.armies[l.attacker]?.faction === after.player
      if (!weAtk && l.defender !== after.player) continue
      const cap = l.captured !== null ? after.heroes[l.captured] : undefined
      const dead = l.killed !== null ? after.heroes[l.killed] : undefined
      const node = after.nodes[l.node]?.name ?? ''
      const cands: Array<[number, { ev: string; hero: Hero | null; line: string }]> = []
      if (cap !== undefined && cap.captor === after.player) cands.push([4, { ev: 'event-capture', hero: cap, line: `${josa(cap.name, '을', '를')} 사로잡았다` }])
      if (dead !== undefined && dead.faction !== after.player) cands.push([3, { ev: 'event-sniped-commander', hero: dead, line: `${josa(dead.name, '이', '가')} 쓰러졌다` }])
      // 겨울 기습은 눈 속 매복 그림으로
      const raid = seasonOf(b) === 'winter' ? 'event-winter-ambush' : 'event-night-raid'
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
        c = [0.88, { ev: cardInfo({ kind: l.card, ...(l.why !== undefined ? { why: l.why } : {}), ...(l.grand === true ? { grand: true as const } : {}) }).art, hero: l.hero !== undefined ? after.heroes[l.hero] ?? null : null, line: `${l.grand === true ? GRAND_FEST.name : CARDS[l.card].name}: ${l.card === 'quarrel' ? (l.pick === 2 ? '침묵했다' : `${after.heroes[l.hero ?? '']?.name ?? ''} 편을 들었다`) : ((l.grand === true ? GRAND_FEST : CARDS[l.card]).opts[l.pick]?.name ?? '')}${l.grand === true && l.good !== undefined ? (l.good ? ' · 이겼다' : ' · 졌다') : ''}` }]
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
        c = [0.75, { ev: 'event-sky-drought', hero: null, line: l.fled !== undefined ? `곡식이 바닥나 군사 ${l.fled}명이 흩어졌다` : '곡식이 바닥났다' }]
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
      const opened = r.outcome?.kind === 'win' && t >= 1 && t < TIER_MAX ? `<p class="tierup">${tr('rep.tierOpened', { level: levelName(t + 1) })}</p>` : ''
      // 휘장 — 이 나라로 이겼다는 표가 나라 고르기에 붙는다 (META §2-①)
      const epi = r.outcome?.kind === 'win' && r.scenario !== undefined ? `<p class="retainnote"><button class="btn ghost sm" data-act="epilogue">${tr('ending.watch')}</button></p>` : ''
      const badge = r.outcome?.kind === 'win' && (r.region ?? 'byeonhan-mini') !== 'tutorial'
        ? `<p class="tierup">${tr('rep.badge', { name: esc(r.factions[me()]?.name ?? '') })}</p>` : ''
      // 배우는 판은 세기·무덤·단련·데려가기를 말하지 않는다 — 처음 하는 사람에게 아직 없는 것들이다 (형 10-27: "튜토리얼에 아직도 장수 데려가기가 남아 있는 듯")
      if ((r.region ?? 'byeonhan-mini') === 'tutorial') return endingHtml(KIT, r, host.history(), '', `${epi}<p class="retainnote"><button class="btn ghost sm" data-act="export">${tr('more.export')}</button></p>`)
      return endingHtml(KIT, r, host.history(), opened + badge + endBondsHtml(DEX_KIT, r) + tombStripHtml(RELIC_KIT, r) + drillStrip(r), `${epi}<p class="mute retainnote">${tr('rep.retain')}</p><p class="retainnote"><button class="btn ghost sm" data-act="export">${tr('more.export')}</button></p>`)
    }
    if (!showReport || before === null || report === null) return ''
    const season = seasonOf(r)
    // 우리가 낀 싸움은 카드로 한 판씩 풀어 보이고, 글 줄에서는 뺀다
    // 전장에서 직접 본 싸움은 다시 적지 않는다 — 결과·옥·획득에 이어 소식판이 같은 싸움을 세 번째로 적었다 (긴급 위원회 11-04)
    const cards = report.lines.map((l, i) => (l.kind === 'battle' && !(l.key !== undefined && warWatched.has(l.key)) ? battleCard(before!, r, l, me(), ART, i) : ''))
    // 넓어지는 지도 — 모르는 나라 이야기는 들리지 않는다 (줄에 적힌 나라 id 를 훑는다)
    const heard = (l: ReportLine): boolean => r.known === undefined
      || Object.values(l).every((v) => typeof v !== 'string' || r.factions[v] === undefined || met(r, me(), v))
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
      return `<div class="mcard fulld"><div class="mt">${icon(SEASON_ICON[season], 'sic')}<b>${esc(seasonLabel(r))}</b><span>${tr('rep.todoLabel')} <b class="rdn">${todo}</b></span></div>`
        + `<div class="rdecide full">${first}</div><p class="fdnote">${todo > 1 ? tr('rep.nextOne', { n: todo - 1 }) : tr('rep.nextNews', { turn: turnWord(r) })}</p></div>`
    }
    // 고을을 쥐었거나 잃었다 — 어디인지 큰 그림과 함께 하나씩, 확인만 누르고 넘어간다 (형 10-25)
    // 싸워서 쥔 고을은 뺀다 — 전장 끝 화면이 「차지했다」를 보였고 「획득!」이 또 뜬다 (긴급 위원회 11-04 · 싸움 하나에 걷을 것이 넷이었다)
    const fought = new Set(report.lines.flatMap((l) => (l.kind === 'battle' ? [l.node] : [])))
    const lands = (r.region ?? 'byeonhan-mini') === 'tutorial' ? [] : landChanges(before, r).filter((x) => !landSeen.has(x.key) && !(x.won && fought.has(x.node)))
    // 우리 공작이 먹혔다 — 갈래마다 제 그림으로 크게 (형 10-25: "공작이 성공한 것도 각각 이미지 · 전체화면 연출 · 확인 버튼")
    const wins = (r.region ?? 'byeonhan-mini') === 'tutorial' ? [] : plotWins(r, report).filter((x) => !landSeen.has(x.key))
    const pacts = (r.region ?? 'byeonhan-mini') === 'tutorial' ? [] : pactBigs(r, report).filter((x) => !landSeen.has(x.key))
    const backs = (r.region ?? 'byeonhan-mini') === 'tutorial' ? [] : freedBigs(r, report).filter((x) => !landSeen.has(x.key))
    const meets = (r.region ?? 'byeonhan-mini') === 'tutorial' ? [] : meetBigs(r, report).filter((x) => !landSeen.has(x.key))
    const bigs = [...lands.map((x) => landBig(r, x)), ...pacts, ...wins, ...backs, ...meets]
    if (bigs.length > 0) return bigCardHtml(r, bigs[0]!, bigs.length - 1)
    // 달 시계의 조용한 달 — 빈 보고 판을 띄우지 않고 지도 위 한 줄로 (FOCUS (I) 초반은 빨리 넘어가야 · 한 계절에 세 번 누르는데 빈 판을 세 번 닫게 하지 않는다)
    if (monthly(r) && decide === '' && cards.every((c) => c === '') && onUs.length === 0 && between.length === 0 && lines.length === 0 && fallen(before, r).length === 0 && sceneOf(before, r, report) === '') {
      showReport = false
      window.setTimeout(() => goToast(`<b>${esc(seasonLabel(r))}</b> ${tr('rep.quietMonth')}`), 0)
      return ''
    }
    let h = `<div class="mcard" data-act="rep-fast"><div class="mt">${icon(SEASON_ICON[season], 'sic')}<b>${esc(seasonLabel(r))}</b><span>${esc(SEASON_LINE[season])}</span></div>`
    if (decide !== '') h += `<div class="rdecide"><h4 class="rdh">${tr('rep.decideDone', { turn: turnWord(r) })}</h4>${decide}</div>`
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
    h += `<div class="lines">${lines.length === 0 ? `<p class="mute rv" style="--t:${t}s">${tr('rep.quietLine', { turn: turnWord(r) })}</p>` : groupedRows(r, lines, t)}</div>`
    // 아직 길 위의 우리 군대 — 언제 닿나 (형: "그 턴이 다음턴인지 그다음인지 몰라가지고 헷갈림. 왜안오는거야")
    const going = sorted(Object.values(r.armies)).filter((a) => a.faction === me() && a.march !== null)
    if (going.length > 0) {
      h += `<div class="lines">${going.map((a, i) => `<div class="rrow rv" style="--t:${(t + (lines.length + i) * LINE_S).toFixed(2)}s">${icon('unit-spear', 'ri')}<span class="rflow"><span class="nchip">${esc(r.nodes[a.march!.from]?.name ?? '')}</span><i class="ar">➜</i><span class="nchip">${esc(r.nodes[a.march!.to]?.name ?? '')}</span></span>`
        + `<span class="rtx">${tx(tr('rep.going', { army: armyName(r, a), when: arriveWhen(r, a.march!.left) }))}</span></div>`).join('')}</div>`
    }
    const tail = threatsHtml(r)
    if (tail !== '') h += `<div class="rv" style="--t:${(t + Math.max(1, lines.length) * LINE_S).toFixed(2)}s">${tail}</div>`
    // 확인은 늘 보이게(카드 아래 붙박이) · 정할 것을 다 골라야 눌린다
    return h + `<div class="repfoot"><button class="btn pri wide" data-act="rep-close"${todo > 0 ? noBtn(tr('rep.needWhy', { n: todo })) : ''}>${todo > 0 ? tr('rep.needBtn', { n: todo }) : tr('rep.ok')}</button></div></div>`
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
      || Object.values(l).every((v) => typeof v !== 'string' || r.factions[v] === undefined || met(r, me(), v))
    const rows = logRows(r, hist, me(), logFilter, logNation, heard)
    const nations = logNations(r, hist, me()).filter((f) => met(r, me(), f))
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
      case 'coalition': ic = l.ev === 'broken' || l.ev === 'scatter' || l.ev === 'fade' ? 'status-alliance' : 'treasure-ring-sword'; break
      case 'grow': case 'bond': case 'awaken': case 'kindle': case 'ascend': ic = 'status-morale-up'; break
      case 'fade': ic = 'status-morale-down'; break
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
    const lead = (l.kind === 'recruit' || l.kind === 'persuade' || l.kind === 'wanderer' || l.kind === 'grow' || l.kind === 'bond' || l.kind === 'awaken' || l.kind === 'kindle' || l.kind === 'ascend' || l.kind === 'birth' || l.kind === 'expBack' || l.kind === 'chancellor') && hero !== undefined
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
    // 합종 — 묶인 깃발들 (빠진 나라는 그 깃발 하나)
    if (l.kind === 'coalition') flow = l.ev === 'leave' && l.who !== undefined && isF(l.who) ? fchip(l.who) : l.members.filter(isF).map(fchip).join('<i class="ar">+</i>')
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
  interface Big { key: string; art: string; good: boolean; tone?: 'good' | 'bad' | 'plain'; flags: string; title: string; sub: string; small: string; sfx: string; sfxDur?: number; stage?: string; voice?: string }

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
        refused: [`${josa(fac.name, '이', '가')} 우리 청을 물리쳤다`, '사신이 빈손으로 돌아왔다', 'event-court-hall', snd('bad_small')],
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

  /**
   * 새 나라 — 한 계절에 하나씩 한 장 (discovery.stepMeet · FOCUS G 형: "한 계절에 모르는 도시 2개 이상이면 과부하").
   * 그 나라 군주 얼굴 · 깃발 · 이름 · 도읍 · 우리와의 사이. 확인을 누르면 지도에 그 땅이 피어난다 (fresh)
   */
  function meetBigs(r: Realm, rep: Report): Big[] {
    const out: Big[] = []
    for (const l of rep.lines) {
      if (l.kind !== 'discover' || l.faction !== me()) continue
      const fac = r.factions[l.nation]
      if (fac === undefined) continue
      const lord = r.heroes[fac.ruler ?? rulerId(l.nation)]
      const rel = relationOf(r, me(), l.nation).state
      const bg = l.how === 'war' ? 'event-invade-field' : l.how === 'spy' || l.how === 'rumor' ? 'event-spy-rumor' : 'event-outside-envoy'
      const cap = r.nodes[fac.capital]?.name
      const stage = `<div class="pact meetv${rel === 'war' ? ' bad' : ''}"><img class="pactbg" src="${ART}event/${bg}.jpg" alt="">${bustHd(lord, 'pl b')}`
        + `<div class="pflags">${emblem(l.nation, 'fem')}</div>`
        + `<div class="meetc">${cap !== undefined ? `<span>${icon('settle-capital', 'mcap')}${esc(cap)}</span>` : ''}<span class="rel ${rel}">${REL_NAME[rel]}</span></div></div>`
      out.push({ key: `${r.season}:meet:${l.nation}`, art: bg, good: rel !== 'war', tone: rel === 'war' ? 'bad' : 'plain', flags: '', title: fac.name, sub: MEET_HOW[l.how], small: lord?.name ?? '', sfx: snd(rel === 'war' ? 'bad_small' : 'tap_bell'), stage })
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
      sfx: x.won ? snd('horn_victory') : snd('bad_big'),
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
          case 'rumor': title = `${fn}에 흉흉한 소문이 돈다`; sub = '군사들이 수군대며 기운이 꺾였다'; sfx = 'realm/sfx/plot/rumor_h.mp3'; break
          case 'sow': title = `${josa(fn, '과', '와')} ${josa(on, '이', '가')} 등을 돌렸다`; sub = '두 나라 사이가 틀어졌다. 싸움이 붙을 수도 있다'; sfx = 'realm/sfx/plot/sow_h.mp3'; break
          case 'bribe': title = `${nn} 장정들을 매수했다`; sub = `${spanLabel(r, P.realm.plotBribeSeasons)} 동안 싸우러 나오지 않는다`; sfx = 'realm/sfx/plot/bribe_h.mp3'; break
          case 'burn': title = `${fn}의 곳간이 불탄다`; sub = '쌓아 둔 곡식이 잿더미가 됐다'; sfx = 'realm/sfx/plot/burn_h.mp3'; break
          case 'spy': title = `${nn}에 첩자를 심었다`; sub = `${spanLabel(r, P.realm.plotSpySeasons)} 동안 그곳 군세가 훤히 보인다`; sfx = snd('tap_move'); break
          case 'rescue': title = `${josa(hn, '을', '를')} 구해 냈다`; sub = '옥을 깨고 우리 도읍으로 돌아왔다'; sfx = 'realm/sfx/plot/night_h.mp3'; break
          default: title = l.result === 'kill' ? `${josa(hn, '이', '가')} 쓰러졌다` : `${josa(hn, '이', '가')} 화살을 맞았다`; sub = l.result === 'kill' ? `${fn}의 장수 하나가 사라졌다` : `${turnsLabel(r, monthly(r) ? P.realm.plotWoundMonths : 1)} 동안 군대를 이끌지 못한다`; sfx = 'realm/sfx/plot/night_h.mp3'
        }
      } else {
        title = `${PLOT_NAME[l.op]}: 어긋났다`
        sub = l.op === 'assassin' ? `${josa(hn, '은', '는')} 살아남았다` : l.op === 'rescue' ? `${josa(hn, '은', '는')} 아직 ${fn}에 갇혀 있다` : l.op === 'sow' ? '두 나라는 그대로다' : '먹히지 않았다'
        sfx = snd('bad_big')
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
      out.push({ key, art: plotArt(l.op), good: l.ok, flags: '', title, sub, small: PLOT_NAME[l.op], sfx, ...(l.ok && l.op === 'burn' ? { sfxDur: P.realm.plotBurnSfxSec } : {}), stage })
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
      window.setTimeout(() => ding(x.sfx, 0.55, 1, x.sfxDur ?? 0), 220)
      // 맺었다·틀어졌다 — 저쪽 군장이 한마디를 제 목소리로 (말이 찍히기 시작할 때)
      const v = x.voice
      if (v !== undefined) window.setTimeout(() => { if (document.querySelector('.ap .pact') !== null && voiceGate(performance.now())) ding(v, P.realm.voiceVol) }, P.realm.pactVoiceMs)
    }
    const tone = x.tone ?? (x.good ? 'good' : 'bad')
    const open = tone === 'good' ? '<i class="bigflash"></i>' : tone === 'bad' ? '<i class="bigdark"></i>' : ''
    return `<div class="mcard fulld landc ${x.good ? 'won' : 'lost'} t-${tone}">${open}<div class="mt">${icon(SEASON_ICON[seasonOf(r)], 'sic')}<b>${esc(seasonLabel(r))}</b></div>`
      + (x.stage !== undefined
        ? `${x.stage}<div class="pactt"><b>${esc(x.title)}</b>${x.sub !== '' ? `<span>${esc(x.sub)}</span>` : ''}</div>`
        : `<div class="landv"><img class="landi" src="${ART}event/${x.art}.jpg" alt=""><div class="landt">${x.flags}<b>${esc(x.title)}</b>${x.sub !== '' ? `<span>${esc(x.sub)}</span>` : ''}<small>${esc(x.small)}</small></div></div>`)
      + `<button class="btn pri wide landok" data-act="land-ok" data-k="${x.key}">확인</button>${rest > 0 ? `<p class="fdnote">이어서 ${rest}가지 더</p>` : ''}</div>`
  }

  function fallen(b: Realm, after: Realm): string[] {
    const has = (x: Realm, f: string): boolean => Object.values(x.nodes).some((n) => n.owner === f)
    return Object.keys(b.factions).sort().filter((f) => f !== after.player && has(b, f) && !has(after, f) && met(after, me(), f))
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
  function tierHtml(region: RegionId): string {
    const open = tierOpen(region)
    const pick = Math.min(tierPick[region] ?? 1, open)
    // 세기 — 문명의 개척자·왕·신처럼 칭호로 (형 10-23). 잠긴 칭호도 보인다 — 무엇을 향해 가는지
    // 동행 수도 단계마다 다르다 — 고를 때 보이게 (형 10-24: "난이도에 따라 데려갈 장수 숫자가 변하면 선택할 때 알려 줘야")
    // 한 줄에 한 단계씩 위에서 아래로 촌장 → 천손 (형 11-02: "1열 n행으로 촌장부터 천손까지") · 0장(배우는 판)은 촌장 하나뿐
    const last = region === 'tutorial' ? 0 : TIER_MAX
    let h = `<div class="tierp"><b>세기</b><div class="tlist">`
    for (let t = 0; t <= last; t++) {
      const carry = retainMaxOf(t)
      const body = `<b>${esc(levelName(t))}</b><span>${esc(LEVEL_LINE[t] ?? '')}</span><small>${region === 'tutorial' ? '튜토리얼은 촌장으로 배웁니다' : carry > 0 ? `장수 ${carry}명까지 데려감` : '장수를 데려가지 못함'}</small>`
      h += t <= open
        ? `<button class="trow${t === pick ? ' on' : ''}${t === TIER_MAX ? ' apex' : ''}" data-act="tier-pick" data-v="${t}">${body}</button>`
        : `<button class="trow locked" data-act="busy"${noBtn('앞 세기로 이기면 열립니다')}>🔒 ${body}</button>`
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
    const links = `<details class="fmore"${fmoreOpen ? ' open' : ''}><summary class="btn ghost">${tr('more.open')}</summary><button class="fmbg" data-act="fmore-x" aria-label="${tr('more.closeAria')}"></button><div class="fmpan"><b class="fmh">${tr('more.open')}</b>${document.documentElement.classList.contains('gfxsafe') ? `<small class="mute">${tr('more.gfxSafe')}</small>` : ''}${langRowHtml()}${gfxRowHtml()}${volumeRowsHtml()}${f.kind === 'title' ? acctLine() : ''}<p class="fine">${installed() ? '' : `<button class="btn ghost" data-act="inst-show">${tr('more.install')}</button>`}<a class="btn ghost" href="${(import.meta.env?.BASE_URL ?? '/')}">${tr('more.archery')}</a> ${PRACTICE_READY ? `<button class="btn ghost" data-act="practice-open">궁술 연습장</button>` : ''}`
      // 소리의 출처 — 공공누리 제1유형·CC BY 는 출처를 밝혀야 쓸 수 있다 (형 10-23: "출처표기해야 상업적으로 사용가능하니까 주의")
      + ` <button class="btn ghost" data-act="opening-open">${tr('more.opening')}</button>`
      + ` <button class="btn ghost" data-act="credits-open">${tr('more.credits')}</button>`
      // 새 전투 시험 (BATTLE-LIVE 0번) — 이 기기에서만 켜진다 · 형과 지인이 켜고 꺼 보며 견준다 (형 10-28)
      + ` <button class="btn ghost" data-act="spar-open" data-tip="${tr('more.sparTip')}">${tr('more.spar')}</button>`
      // 판 기록 — 판 밖(첫 화면 · 끝 화면)에서도 받는다. 아래 「나라」 탭은 판 안에서만 보여 찾기 어려웠다 (형 10-26: "나라 탭이 어딨음??")
      + (host.gameCount() > 0 ? ` <button class="btn ghost" data-act="export" data-tip="지금까지 둔 판 ${host.gameCount()}개의 기록을 파일로 받는다">기록 내보내기</button>` : '') + `</p><button class="btn fmx" data-act="fmore-x">${tr('more.close')}</button></div></details>`
    switch (f.kind) {
      case 'title': {
        // 영웅전(도감) — 판을 넘어 남는 것 (VISION §5-4)
        const dexBtn = `<button class="btn big" data-act="dex-open">${tr('title.heroes')}</button>` // 형 10-25: 도감보다 즐거운 이름 · 숫자는 들어가면 보인다
          + (hasDrill() ? `<button class="btn big" data-act="dy-title">${tr('title.drill')}</button>` : '') // 남은 단련 공은 아무 때나 쓴다 (HERO-GROWTH ★ §C)
          + ((host.pastGames?.() ?? []).length > 0 ? `<button class="btn big" data-act="annals-open">${tr('title.annals')}</button>` : '')
        // 끝나지 않은 다른 판들은 불러오기 안에 (형 10-28: 첫 화면에 늘어놓으니 단추가 화면 밖으로) — 몇 판 있는지만 단추에
        const shelfN = (host.slots?.() ?? []).length
        const loadBtn = host.saves !== undefined ? `<button class="btn big" data-act="save-open-title">${tr('title.load')}${shelfN > 0 ? `<small class="ldn">${tr('title.loadCount', { n: shelfN })}</small>` : ''}</button>` : ''
        return titleHtml(KIT, realm, host.savedAt(), installCard() + links, realm === null && !tutorialOver(), loadBtn + dexBtn, realm !== null && !realm.outcome ? contHook(realm) : '')
      }
      case 'dex': return dexHtml(DEX_KIT, f.board, f.sel, f.back === null ? '판으로' : '처음으로')
      case 'drill': return yardHtml(DRILL_KIT, { ...f, leaveArmed: yardArmed })
      case 'tomb': return tombRun(realm) ? tombHtml(RELIC_KIT, realm, f.fresh) : ''
      case 'annals': return annalsHtml()
      case 'boards': return boardHtml(KIT, realm !== null && !realm.outcome, unlockedBoards(realm?.region ?? null), tierWon)
      case 'nations': return nationsHtml(KIT, f.region, chapterOfRegion(f.region)?.nation)
      case 'detail': return detailHtml(KIT, f.region, f.id, tierHtml(f.region))
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
    const d = { seed: realm.seed, season: realm.season, player: realm.player, armyOrders, musters, settles, pick, goalStop, landSeen: [...landSeen], scouts, rite, answers, cardHeld, cardPerfect, guards, guardAp, envoys, plots, heroOrders, councils, persuadeBy, wooDone, hands, hireShown: [...hireShown], autoIdle: realm.autoIdle, manual: realm.manual?.[me()] }
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
    councils = list('councils').filter((o) => o.kind === 'council')
    guards = Array.isArray(d['guards']) ? (d['guards'] as string[]) : []
    guardAp = rec<Approach>('guardAp')
    scouts = draftScouts(d).slice(0, scoutCap(realm, me())) // 옛 초안의 scout 한 칸도 읽는다
    rite = d['rite'] === true
    Object.assign(pick, rec<{ edge: string; ambush: boolean; ration?: Ration }>('pick'))
    for (const p of Object.values(pick)) if (p !== undefined && typeof p.ration === 'string') p.ration = rationExtra(p.ration) ?? P.realm.rationReserve
    Object.assign(answers, rec<boolean>('answers'))
    for (const [k, v] of Object.entries(rec<number>('cardHeld'))) if (typeof v === 'number' && Number.isFinite(v)) cardHeld[k] = v
    for (const [k, v] of Object.entries(rec<boolean>('cardPerfect'))) if (v === true) cardPerfect[k] = true
    if (Array.isArray(d['hireShown'])) for (const id of d['hireShown'] as unknown[]) if (typeof id === 'string') hireShown.add(id)
    if (Array.isArray(d['goalStop'])) goalStop = (d['goalStop'] as unknown[]).filter((x): x is string => typeof x === 'string')
    if (Array.isArray(d['landSeen'])) for (const k of d['landSeen'] as unknown[]) if (typeof k === 'string') landSeen.add(k)
    // 옛 초안은 나라 열쇠 — 새 열쇠로 다시 단다
    for (const e of Object.values(rec<Envoy>('envoys'))) if (e !== null && typeof e === 'object' && typeof e.to === 'string') envoys[ekey(e.to, e.ask)] = e
    Object.assign(persuadeBy, rec<string>('persuadeBy'))
    Object.assign(wooDone, rec<boolean>('wooDone'))
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
  function seasonFx(at: Realm): void {
    const s = seasonOf(at)
    const el = document.createElement('div')
    el.className = `seasonfx ${s}`
    el.innerHTML = `<i class="band"><i class="bimg" style="--hbg:url('${ART}season/season-${s}.jpg');--vbg:url('${ART}season-v/season-${s}.jpg')"></i></i><div class="stxt"><i class="orn"></i>${icon(SEASON_ICON[s], 'sfx-ic')}<b>${esc(seasonLabel(at))}</b><span>${esc(SEASON_LINE[s])}</span><i class="orn"></i></div>`
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
      window.setTimeout(() => { el.remove(); if (realm !== null) music.map(seasonOf(realm)) }, 450)
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
          + `<div class="cw"><b>혼례</b><span>${esc(josa(a?.name ?? '', '과', '와'))} ${esc(josa(b?.name ?? '', '이', '가'))} 짝을 맺었다</span><small>신혼 ${spanLabel(r, P.realm.wedHoney)}: 함께 지내면 아이가 일찍 온다</small></div></div>`)
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
          + `<div class="cw"><b>탄생</b><span>${esc(a?.name ?? '')}·${esc(b?.name ?? '')}의 아이 ${esc(josa(kid?.name ?? '', '이', '가'))} 태어났다</span>${grow !== undefined ? `<small>${turnsLabel(r, grow.grown - r.season)} 자라면 장수로 나선다</small>` : ''}${traits !== '' ? `<div class="ctrs">${traits}</div>` : ''}</div></div>`)
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
        + `<div class="cw"><b>태몽</b><span>${esc(a?.name ?? '')}·${esc(c?.name ?? '')}의 지붕 위로 금빛 용이 구슬을 물고 내려왔다</span><small>${monthly(r) ? '곧 아이가 온다' : '다음 계절에 아이가 온다'}</small></div></div>`)
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
    const file = faceFile(x.id)
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
  function openBust(src: string, loop?: string, elem?: string): void {
    root.querySelector('.bview')?.remove()
    // 고리 영상이 있으면 크게 숨 쉬는 초상 (형 11-05 · live2d 같은 idle) · 없으면 그림
    if (loop !== undefined && loop !== '') {
      root.insertAdjacentHTML('beforeend', `<div class="bview" data-act="bust-close" role="dialog" aria-label="장수 그림 크게"><span class="vfull"><video class="vloop${sqCls(loop)}" src="${loop}" poster="${src}" autoplay muted loop playsinline></video>${awakeningGemHtml(elem, ART)}</span><small>누르면 닫힌다</small></div>`)
      return
    }
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
    // 침공은 둥둥 큰북 (형 11-03: "경계 징 소리 별로 · 더 둥둥 · 침략당한 느낌") — war_drum 은 「후!」 기합이라 뺐다
    const cue: ReadonlyArray<readonly [number, Parameters<typeof snd>[0], number]> = kind === 'siege' ? [[0, 'invade', 0.6], [900, 'arrow_volley', 0.4]]
      : kind === 'field' ? [[0, 'horses', 0.5], [700, 'war_cry', 0.4]]
        : kind === 'raid' ? [[0, 'invade', 0.6], [900, 'war_cry', 0.3]] : [[0, 'invade', 0.45]]
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
    scenesLeft++
    const show = (i: number): void => {
      if (i >= scenes.length) { scenesLeft = Math.max(0, scenesLeft - 1); return }
      root.insertAdjacentHTML('beforeend', scenes[i]!)
      const el = root.lastElementChild as HTMLElement
      const capt = el.classList.contains('capt')
      const hire = el.classList.contains('hire') && !capt
      if (document.visibilityState === 'visible') {
        if (capt) {
          ding(snd(el.classList.contains('lost') ? 'bad_big' : 'capture'), 0.5)
          // 쇠창살이 닫히는 그 때 — 쇠판 소리와 떨림
          window.setTimeout(() => { if (el.isConnected) { ding(snd('cmd_hold'), 0.75, 0.9); buzz([50, 30, 80]) } }, P.realm.captSlamMs) // 옥문 닫힘은 쇠판 「챙」(방진 소리) 그대로 (형 11-02: "그거 좋았는데 왜 바꿔")
        }
        else if (hire) { for (const t of P.realm.hireCutMs) window.setTimeout(() => ding(snd('cmd_duel'), 0.32), t); window.setTimeout(() => ding(snd('hire_go'), 0.55), P.realm.hirePopMs) }
        else if (el.classList.contains('custom')) {
          // 풍습이 처음 걸렸다 — 북이 울리고, 도장이 내려찍히는 때 종과 떨림
          ding(snd('tap_drum'), 0.6) // 「후!」 기합(war_drum) · 쨍한 징(war_bell)은 걷음 (형 11-03)
          window.setTimeout(() => { if (el.isConnected) { ding(snd('tap_bell'), 0.55); buzz([30, 40, 70]) } }, P.realm.customStampMs)
        }
        // 혼례는 배경 음악으로 — 꼭두각시 01~04 한 곡, 닫으면 지도 음악으로 잦아들며 돌아간다 (형 10-29)
        else if (el.classList.contains('wed')) music.wedding()
        else ding(snd('birth'), 0.5)
      }
      if (hire) window.setTimeout(() => buzz([20, 40, 20, 40, 60]), P.realm.hirePopMs)
      // 얼굴이 다 드러나면 그 장수가 첫마디를 한다 — 이름 아래 「」 대사 그대로 (voice.ts · 소리를 못 받으면 조용히)
      // 「확인」을 첫마디보다 먼저 눌러도 그 자리에서 말한다 · 다른 목소리 바로 뒤라도 거르지 않는다 (형 11-11: "등용대사는 어떤건 나오고 어떤건 안나오던데")
      const voiced = hire ? realm?.heroes[el.dataset['hid'] ?? ''] : undefined
      let spoke = voiced === undefined
      const speak = (): void => {
        if (spoke || realm === null || voiced === undefined) return
        spoke = true
        voiceGate(performance.now())
        ding(hireVoicePath(voiced, isRuler(realm, voiced.id)), P.realm.voiceVol)
      }
      if (!spoke) window.setTimeout(speak, P.realm.hireVoiceMs)
      let gone = false
      const close = (): void => {
        if (gone) return
        gone = true
        speak()
        el.classList.add('out')
        if (el.classList.contains('wed') && realm !== null) music.map(seasonOf(realm)) // 혼례 가락은 잦아들고 지도 음악으로
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
        else music.map(seasonOf(realm))
      }
      paintNow()
      fitLabels(root) // 단추 글이 넘치면 줄바꿈 대신 글씨를 줄인다 (형 10-25)
      stratPaint() // 전략 회의 화면 — 열려 있으면 다시 그린다
      wooPaint() // 회유할 사람 고르기 상자
      townPaint() // 마을 안 — 열려 있으면 다시 그린다 (일터를 고르면 바로 바뀐다)
      warnPaint() // 승산이 낮은 출정이면 한 번 묻는다
      scoutAskPaint() // 정찰꾼이 다 나갔는데 새 곳을 누르면 — 어디서 눌렀든 가운데에 「어디를 거둘까」
      marquee(root) // 말줄임으로 잘린 한 줄 글은 지하철 안내판처럼 흐른다 (형 10-29)
      firstsAfterPaint()
    } catch (e) {
      failNote(e)
    }
  }

  /**
   * 마을 안 (TOWN.md 1단계 · 11-08 폰 UX) — 열린 고을이 있으면 덮개에 그린다 · 우리 고을이 아니게 됐으면 걷는다.
   * 터마다 무엇이 서나(선 일터 · 짓는 중 · 빈 터 · 잠긴 터)를 townview 에 넘긴다 — 값·까닭은 workCardHtml 과 같은 셈 (workCost · workBlocked · shortOf)
   */
  function townPaint(): void {
    let ov = root.querySelector<HTMLElement>('.townov')
    const r = realm
    const n = townIn !== null && r !== null ? r.nodes[townIn] : undefined
    if (r === null || n === undefined || n.owner !== me() || warOn || front !== null) {
      if (ov !== null && !ov.classList.contains('out')) ov.remove()
      townIn = null
      townPick = null
      return
    }
    const R = P.realm
    // 바탕 — 물가 · 숲 · 들판 (비스듬히 내려다본 빈 터 · town-art.ts)
    const bg = townGround(isCoast(r, n.id) || isRiverside(r, n.id) ? 'water' : isWoody(r, n.id) ? 'wood' : 'field', townFort(n.kind, n.tags))
    const going = (r.works ?? []).find((w) => w.node === n.id)
    const queued = musters.find((o): o is Extract<Order, { kind: 'work' }> => o.kind === 'work' && o.node === n.id)
    const max = Math.round(R.workLvMax)
    const sp = (w: WorkWhat, lv: number): string | null => { const s = townSprite(w, lv); return s !== null ? `${ART}${s}` : null }
    const turnsOf = (lv: number): number => Math.max(1, Math.round(R.workTurns * (lv > 1 ? R.workLvTurnsMul : 1)))
    const goingOf = (w: typeof going): { left: string; prog: number } | null => {
      if (w === undefined) return null
      const left = Math.max(1, w.done - r.season + 1)
      const total = turnsOf(w.lv ?? 1)
      return { left: turnsLabel(r, left), prog: Math.max(0, Math.min(1, 1 - left / total)) }
    }
    // 터마다 일터 — 같은 일터가 여러 터일 수 있어 터 차례(lot)로 짚는다 (형 11-09: 논 넷도 된다) · 옛 주문·옛 짓기는 같은 일터의 첫 터
    const sites = sitesOf(n)
    const gLot = going !== undefined ? going.lot ?? lotOf(n, going.what) : -1
    const qLot = queued !== undefined ? lotOf(n, queued.what, queued.lot) : -1
    /** 못 하는 까닭 — 이번 달 다른 것을 골랐으면 그것 · 잠김 · 모자람 */
    const whyOf = (w: WorkWhat, lv: number, lot: number): string | null => {
      if (queued !== undefined && (queued.what !== w || qLot !== Math.min(lot, sites.length))) return tr('work.oneAtATime')
      if (musters.some((o) => o.kind === 'clearLot' && o.node === n.id)) return '이번 달엔 터 닦기를 고르셨습니다 (한 번에 하나)'
      const lock = workBlocked(r, me(), n.id, w, lot)
      if (lock !== null) return lock
      const short = shortOf(workCost(w, lv) as Partial<Record<Good, number>>)
      return short !== '' ? short : null
    }
    const slots: TownSlot[] = sites.map(({ what: w, lv }, i) => {
      const d = WORKS[w]
      const up = gLot === i ? goingOf(going) : null
      const next = lv < max ? { sprite: sp(w, lv + 1), cost: costHtml(workCost(w, lv + 1)), when: turnsLabel(r, turnsOf(lv + 1)), gain: workEffect(w, lv + 1), why: whyOf(w, lv + 1, i), on: queued?.what === w && qLot === i } : null
      const tip = `${d.name} ${lv}단 · ${d.does}${next !== null ? ` · ${lv + 1}단: ${Object.entries(workCost(w, lv + 1)).map(([g, v]) => `${GOOD_NAME[g as Good]} ${v}`).join(' ')} · ${turnsLabel(r, turnsOf(lv + 1))} · 효과 ${next.gain}` : ' · 다 올렸다'}`
      return { k: 'work', what: w, name: d.name, icon: d.icon, sprite: sp(w, lv), lv, max, does: d.does, eff: workEffect(w, lv), next, going: up, tip }
    })
    if (going !== undefined && gLot >= sites.length) {
      const g = goingOf(going)!
      slots.push({ k: 'going', what: going.what, name: WORKS[going.what].name, icon: WORKS[going.what].icon, left: g.left, prog: g.prog, tip: `${WORKS[going.what].name} 짓는 중 · ${g.left} 남음` })
    }
    const cap = lotCap(n)
    // 빈 터엔 이 땅에 맞는 일터 모두 — 이미 지은 것도 또 지을 수 있다
    const opts = workOptions(r, n.id)
    // 이번 달 새로 지을 일터는 터 하나에만 비친다 — 고른 터가 빈 터면 거기, 아니면 첫 빈 터 (형 11-09: 모든 터에 그 그림이 깜빡거림)
    const firstEmpty = slots.length
    const planLot = townPick !== null && townPick.lot >= firstEmpty && townPick.lot < Math.min(cap, 4) ? townPick.lot : firstEmpty
    while (slots.length < Math.min(cap, 4)) {
      const here = slots.length === planLot
      slots.push({
        k: 'empty', when: turnsLabel(r, turnsOf(1)),
        tip: `빈 터 · 이 땅에 맞는 일터 ${opts.length}가지 · 터 ${slots.length + 1}/${cap}`,
        // 빈 터마다 같은 타일 — 둘째 빈 터를 눌러도 「맞는 일터가 없다」고 하지 않게 (11-08 · 한 고을 한 달 하나는 whyOf 가 막는다)
        options: opts.map((w) => ({ what: w, name: WORKS[w].name, icon: WORKS[w].icon, sprite: sp(w, 1), cost: costHtml(workCost(w)), eff: workEffect(w, 1), does: WORKS[w].does, why: whyOf(w, 1, sites.length), on: here && queued?.what === w && qLot >= sites.length })),
      })
    }
    // 잠긴 터 — 맨 앞 하나는 닦을 수 있다 (형 11-08: "공사를 해서 더 만들 수 있게") · 닦는 중이면 그 터에 비계
    const clearing = (r.clears ?? []).find((c) => c.node === n.id)
    const queuedClear = musters.some((o) => o.kind === 'clearLot' && o.node === n.id)
    let firstLock = true
    while (slots.length < 4) {
      const why = `땅이 작아 터가 ${cap}곳뿐입니다`
      if (firstLock && clearing !== undefined) {
        const left = Math.max(1, clearing.done - r.season + 1)
        const total = Math.max(1, Math.round(R.workClearTurns))
        slots.push({ k: 'locked', why, clear: null, going: { left: turnsLabel(r, left), prog: Math.max(0, Math.min(1, 1 - left / total)) } })
      } else if (firstLock && clearBlocked(r, me(), n.id) === null || firstLock && queuedClear) {
        const c = clearCost(n)
        const short = shortOf({ grain: c.grain, wood: c.wood } as Partial<Record<Good, number>>)
        const busy = queued !== undefined ? tr('work.oneAtATime') : null
        slots.push({ k: 'locked', why, going: null, clear: { cost: costHtml({ grain: c.grain, wood: c.wood }), when: turnsLabel(r, Math.max(1, Math.round(R.workClearTurns))), why: queuedClear ? null : busy ?? (short !== '' ? short : null), on: queuedClear } })
      } else slots.push({ k: 'locked', why: firstLock ? why : '앞의 잠긴 터를 먼저 닦아야 합니다', clear: null, going: null })
      firstLock = false
    }
    // 고른 터 — 없으면 지금 할 것: 이번 달 고른 것 > 빈 터 > 올릴 수 있는 것 > 짓는 중 > 첫 터
    if (townPick === null || townPick.lot >= slots.length) {
      const at = (f: (s: TownSlot) => boolean): number => slots.findIndex(f)
      const lot = [
        at((s) => (s.k === 'work' && s.next?.on === true) || (s.k === 'empty' && s.options.some((o) => o.on))),
        at((s) => s.k === 'empty' && s.options.some((o) => o.why === null)),
        at((s) => s.k === 'work' && s.next !== null && s.next.why === null && s.going === null),
        at((s) => s.k === 'going' || (s.k === 'work' && s.going !== null)),
        0,
      ].find((i) => i >= 0)!
      townPick = { lot, what: null }
    }
    // 지난 달 완공 — 보고에 이 고을 줄이 있으면 한 번 「완공!」 (report 는 지난 달 것)
    const doneLine = report !== null && report.lines.find((l): l is Extract<ReportLine, { kind: 'work' }> => l.kind === 'work' && l.done && l.node === n.id && l.faction === me())
    const palDone = r.factions[me()]?.capital === n.id && report !== null ? report.lines.find((l): l is Extract<ReportLine, { kind: 'palace' }> => l.kind === 'palace' && l.ev === 'done' && l.faction === me()) : undefined
    // 지난 달 제천 대회 — 결과 도장 (이겼다 · 졌다 · 하늘에 바쳤다)
    const festLine = r.factions[me()]?.capital === n.id && report !== null ? report.lines.find((l): l is Extract<ReportLine, { kind: 'card' }> => l.kind === 'card' && l.grand === true && l.faction === me()) : undefined
    const stampKey = `${n.id}|${r.season}${palDone !== undefined ? '|palace' : festLine !== undefined ? '|fest' : ''}`
    const stamp = palDone === undefined && festLine !== undefined && !townStamped.has(stampKey) ? { icon: 'status-good-omen', name: `제천 대회${festLine.good === true ? ' · 이겼다' : festLine.good === false ? ' · 졌다' : ' · 하늘에 바쳤다'}` }
      : palDone !== undefined && !townStamped.has(stampKey) ? { icon: 'treasure-silla-crown', name: PALACE_NAME[Math.max(1, Math.min(4, palDone.tier)) as PalaceTier] }
      : doneLine !== false && doneLine !== undefined && !townStamped.has(stampKey) ? { icon: WORKS[doneLine.what].icon, name: `${WORKS[doneLine.what].name}${doneLine.lv !== undefined ? ` ${doneLine.lv}단` : ''}` } : null
    const have = left()
    const stock = GOODS.map((g) => `<span class="${have[g] < 1 ? 'no' : ''}" data-tip="${esc(GOOD_NAME[g])} ${Math.floor(have[g])}">${icon(GOOD_ICON[g])}${Math.floor(have[g])}</span>`).join('')
    // 도읍이면 궁전 띠 — 큰 공사·큰 잔치가 여기 산다 (형 11-10: 나라 탭에 묻혀 있는 줄도 몰랐다)
    const isCap = r.factions[me()]?.capital === n.id
    const hallH = isCap ? palaceHtml(r) : ''
    const greatH = isCap ? greatHtml(r) : ''
    const pp = leftPlan().factions[me()]?.palace
    const palace = hallH !== '' || greatH !== ''
      ? { on: palaceOn, html: palaceBodyHtml(hallH, greatH), tier: palaceTier(leftPlan(), me()), building: pp?.busy !== undefined || musters.some((o) => o.kind === 'palace'), pips: palacePips(leftPlan()), seatBox: seatPickHtml(leftPlan()) }
      : undefined
    const html = townViewHtml({ id: n.id, name: n.name, hh: n.hh, bg, art: ART, fresh: townFresh, slots, lots: cap, pick: townPick, stamp, stock, ...(palace !== undefined ? { palace } : {}) })
    if (ov === null) {
      root.insertAdjacentHTML('beforeend', `<div class="townov" style="--tf:${P.realm.townFadeMs}ms;--bf:${P.realm.townBoardFrom}"></div>`)
      ov = root.querySelector<HTMLElement>('.townov')!
    }
    ov.innerHTML = html
    townFresh = false
    if (stamp !== null) {
      townStamped.add(stampKey)
      ding(snd('war_drum'), 0.6)
      buzz([12, 40, 24])
      window.setTimeout(() => townStampOut(), R.townStampMs)
    }
  }
  /** 「완공!」 도장을 걷는다 — 저절로든 눌러서든 (메모리 notices-must-dismiss) */
  function townStampOut(): void {
    const el = root.querySelector<HTMLElement>('.tvdone')
    if (el === null || el.classList.contains('out')) return
    el.classList.add('out')
    el.addEventListener('animationend', () => el.remove(), { once: true })
  }

  /** 처음 한 번 알림 (firsts.ts) — 본 것 · 떠 있는 것 */
  const firstsSeen = loadFirsts()
  let firstOn: First | null = null
  let firstTimer = 0
  /** 다시 그린 뒤 몇 번 더 볼까 — 판 속 카드는 그린 뒤 조금 있다 펼쳐진다(백성 배치 단추를 놓쳤다) */
  let firstTries = 0
  /** 처음 보이는 것인가 — 화면 안에 실제로 그려진 첫 것 */
  const firstEl = (sel: string): HTMLElement | null => [...root.querySelectorAll<HTMLElement>(sel)].find((e) => { const b = e.getBoundingClientRect(); return b.width > 1 && b.height > 1 && b.bottom > 0 && b.top < innerHeight && b.right > 0 && b.left < innerWidth && getComputedStyle(e).visibility !== 'hidden' }) ?? null
  /** 다시 그린 뒤 — 떠 있으면 새 자리에 다시 붙이고, 아니면 판이 자리 잡은 뒤(판이 미끄러져 열린다) 처음 보이는 것이 있나 본다 */
  function firstsAfterPaint(): void {
    if (firstOn !== null) { firstPlace(); return }
    // 이미 기다리는 중이면 그대로 — 자꾸 다시 그리는 동안 미루기만 하다 끝내 못 띄웠다
    firstTries = 0
    if (firstTimer === 0) firstTimer = window.setTimeout(firstCheck, P.realm.firstHintDelayMs)
  }
  function firstCheck(): void {
    firstTimer = 0
    // 배우는 판은 제 띠가 가르친다 · 큰 장면·전장·회의·담판 위에는 띄우지 않는다 · 숨은 탭에서는 쉰다 (절대 규칙 4)
    if (realm === null || realm.region === 'tutorial' || warOn || firstOn !== null || document.visibilityState !== 'visible' || FIRSTS.every((f) => firstsSeen.has(f.id))) return
    // 가려 있으면 걷힌 뒤 다시 본다 — 보고판이 떠 있는 채 판을 열면 그 뒤로 다시 그리지 않아 놓쳤다
    if (root.classList.contains('modal-open') || root.querySelector('.cere, .ascfx, .gnpop, .wr, .stov, .dpov') !== null) { firstTimer = window.setTimeout(firstCheck, P.realm.firstHintDelayMs); return }
    const f = nextFirst(firstsSeen, (s) => firstEl(s) !== null)
    if (f === null) {
      // 그려져 있는데 아직 안 보이면(판이 미끄러지는 중 · 굴려야 보이는 자리) 보일 때까지 · 아니면 몇 번만 더
      const soon = FIRSTS.some((x) => !firstsSeen.has(x.id) && root.querySelector(x.sel) !== null)
      if (soon || firstTries++ < P.realm.firstHintTries) firstTimer = window.setTimeout(firstCheck, P.realm.firstHintDelayMs)
      return
    }
    firstsSeen.add(f.id)
    saveFirsts(firstsSeen)
    firstOn = f
    const el = document.createElement('div')
    el.className = 'fhint'
    el.innerHTML = `<b>${esc(f.title)}</b>${esc(f.text)}${f.guide !== undefined ? `<br><button class="fhmore" data-act="guide" data-k="${f.guide}">자세히 ›</button>` : ''}`
    el.addEventListener('click', () => window.setTimeout(firstClose, 0)) // 「자세히」는 설명을 연 뒤 닫는다
    root.append(el)
    firstPlace()
    ding(snd('tap_brush'), 0.35)
    window.setTimeout(() => { if (firstOn?.id === f.id) firstClose() }, noticeMs(f.title + f.text, P.realm.firstHintMs))
  }
  /** 말풍선을 그것 곁에 — 위에 자리가 있으면 위, 없으면 아래 · 화면 밖으로 안 나가게. 그것이 사라졌으면 닫는다 */
  function firstPlace(): void {
    const box = root.querySelector<HTMLElement>('.fhint')
    const at = firstOn !== null ? firstEl(firstOn.sel) : null
    if (box === null || at === null) { firstClose(); return }
    root.querySelectorAll('.fhon').forEach((e) => { if (e !== at) e.classList.remove('fhon') })
    at.classList.add('fhon')
    // 둘레 단추의 말풍선은 부채 전체의 아래에 — 위에 뜨면 옆 단추 둘과 위 띠를 덮었다 (위원회 11-04 UX ③)
    const ringEl = at.closest<HTMLElement>('.nring')
    const rb = ringEl !== null ? [...ringEl.querySelectorAll<HTMLElement>('.nrb')].map((e) => e.getBoundingClientRect()) : []
    const b = rb.length > 0 ? new DOMRect(Math.min(...rb.map((q) => q.left)), Math.min(...rb.map((q) => q.top)), Math.max(...rb.map((q) => q.right)) - Math.min(...rb.map((q) => q.left)), Math.max(...rb.map((q) => q.bottom)) - Math.min(...rb.map((q) => q.top)) + 14) : at.getBoundingClientRect()
    // 둘레 아래에 자리가 없으면(화면 아래쪽 고을) 둘레 위로 (검토 11-04)
    const up = ringEl === null ? b.top > box.offsetHeight + 24 : b.bottom + box.offsetHeight + 24 > innerHeight
    const half = box.offsetWidth / 2
    box.classList.toggle('up', up)
    box.classList.toggle('dn', !up)
    box.style.left = `${Math.round(Math.min(innerWidth - 12 - half, Math.max(12 + half, b.left + b.width / 2)))}px`
    box.style.top = `${Math.round(up ? b.top : b.bottom)}px`
  }
  function firstClose(): void {
    firstOn = null
    root.querySelectorAll('.fhon').forEach((e) => e.classList.remove('fhon'))
    const box = root.querySelector<HTMLElement>('.fhint')
    if (box === null) return
    box.classList.add('out')
    window.setTimeout(() => box.remove(), 300)
  }

  /**
   * 둘레 단추가 화면 밖으로 나가면 그만큼만 지도를 민다 — 가장자리 고을은 단추 절반이 잘려 못 눌렀다 (위원회 11-04 UX ⑧).
   * 위·아래 띠에 가리는 곳도 화면 밖으로 친다
   */
  function ringIntoView(): void {
    const wrap = root.querySelector<HTMLElement>('.mapwrap')
    const bs = [...root.querySelectorAll<HTMLElement>('.nring .nrb, .nring.card')]
    if (wrap === null || bs.length === 0) return
    const w = wrap.getBoundingClientRect()
    const qs = bs.map((b) => b.getBoundingClientRect())
    const pad = P.realm.mapRingEdgePad
    const top = w.top + pad
    // 아래 할 일 띠가 숨었으면(높이 0 · PC 에서 top 0 으로 읽힘) 지도 끝을 쓴다 — 0 을 바닥으로 읽어 지도가 아래로 확 내려갔다 (형 11-04: "이서 도읍 눌렀는데 카메라가 아래로 확")
    // 할 일 칩은 오른쪽 아래 작은 상자다 — 둘레와 가로로 겹칠 때만 바닥으로 친다
    const l = Math.min(...qs.map((q) => q.left))
    const rgt = Math.max(...qs.map((q) => q.right))
    const td = root.querySelector<HTMLElement>('.todo')?.getBoundingClientRect()
    const floor = td !== undefined && td.height > 0 && td.top > top && td.top < w.bottom && td.left < rgt && td.right > l ? td.top : w.bottom
    const bottom = floor - pad
    const t = Math.min(...qs.map((q) => q.top))
    const btm = Math.max(...qs.map((q) => q.bottom))
    const dx = l < w.left + pad ? l - (w.left + pad) : rgt > w.right - pad ? rgt - (w.right - pad) : 0
    // 둘레가 보이는 칸보다 크면 위를 맞춘다 (아래를 맞추면 위가 잘린다) · 밀어도 둘레 높이만큼까지만
    const dy = t < top ? t - top : btm > bottom ? Math.min(btm - bottom, Math.max(0, t - top)) : 0
    if (dx !== 0 || dy !== 0) wrap.scrollBy({ left: dx, top: dy, behavior: 'smooth' })
  }

  /** 마지막으로 깐 지도 글 — 같으면 다시 깔지 않는다 */
  let lastMap = ''
  /** 둘레 단추를 마지막으로 얹은 지도 · 그 단추 · 그 고을 — 바뀔 때만 갈아 끼운다 */
  let lastMapRing = ''
  let lastRing = ''
  let lastRingId = ''
  /** 둘레 부채의 가운데 각도 — 90 은 위 · 가장자리 고을이면 안쪽으로 돌린다 */
  let ringDeg = 90
  /** 지난번 그린 판 — 바뀌었을 때만 카드를 펼친다 */
  let lastSheet = ''

  function paintNow(): void {
    MINE = realm?.player ?? ''
    // 각성한 장수는 각성 초상으로 (face.ts) — 판 위에서만. 첫 화면·영웅전·데려갈 장수·판 끝 화면은 본래 얼굴 (형 11-03: "각성은 게임판에서만 보여져야")
    noteAscended(front === null && realm?.outcome == null ? realm : null)
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
      if (front?.kind === 'drill') yardBeforePaint(root)
      $('.mapwrap').innerHTML = frontHtml(front!)
      if (front?.kind === 'drill') yardAfterPaint(root)
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
    $('.seasonp').dataset['s'] = seasonOf(realm)
    const r = plan()
    morph($('.top'), topHtml(r)) // 바뀐 곳만 — 통째로 갈면 그림이 깜빡인다 (형 10-24)
    rollTop(realm.season)
    const wrap = $('.mapwrap')
    const keep = [wrap.scrollLeft, wrap.scrollTop] as const
    const first = wrap.querySelector('.map') === null
    // 지도가 그대로면 다시 깔지 않는다 — 징병 수 ± 처럼 판만 바뀔 때마다 바탕 그림이 깜빡였다 (형: "뒷배경이 너무 깜빡거림")
    // 군대·개척단을 고르거나 판을 열면 둘레 단추는 접힌다 · 정할 것(사건 카드·사신의 청)이 화면 가득 떠도 접는다 (형 11-11: 달 넘길 때 마을을 누르면 단추가 카드 위에 떠 있었다)
    if (armySel.length > 0 || partySel !== '' || sheet !== null || realm.nodes[ring] === undefined || (showReport && repTodo() > 0)) ring = ''
    const mh = mapPart(r)
    if (mh !== lastMap || first) {
      // 줌 단계는 새 지도로 이어 간다 — 다시 깔 때마다 'mid' 에서 다시 재 경계 근처 이름표가 깜빡였다 (검토 11-04)
      const zl0 = wrap.querySelector<HTMLElement>('.map')?.dataset['zl']
      // 처음만 통째로 · 그 뒤(군대 고르기·풀기 따위)는 바뀐 곳만 — 통째로 갈면 그림·안개 판·SVG 가 새로 만들어지고 움직임이 처음부터 돌아 지도가 깜빡였다 (형 11-10: 유닛 선택 해제할 때도 깜빡)
      if (first) wrap.innerHTML = mh
      else morph(wrap, mh, true)
      if (zl0 !== undefined) { const m1 = wrap.querySelector<HTMLElement>('.map'); if (m1 !== null) m1.dataset['zl'] = zl0 }
      lastMap = mh
      // 다음 계절 바탕을 미리 — 계절이 넘어갈 때 새 그림을 그제야 받느라 깜빡였다 (형 10-23). 그린 뒤 한숨 돌리고
      const rg = r.region ?? 'byeonhan-mini'
      const next = seasonOf(r, r.season + 1)
      window.setTimeout(() => warmNextSeason(ART, rg, next), WARM_MS)
    }
    // 둘레 단추 — 지도 판 안에 (끌고 당기면 고을과 함께 간다). 지도를 다시 깔지 않고 이것만 갈아 끼운다 · 새 고을을 열 때만 퐁
    const rh = ring !== '' ? ringHtml(r) : ''
    const mapEl = wrap.querySelector('.map')
    if (mapEl !== null && (first || mh !== lastMapRing || rh !== lastRing)) {
      mapEl.querySelector('.nring')?.remove()
      if (rh !== '') {
        mapEl.insertAdjacentHTML('beforeend', rh)
        if (ring !== lastRingId) {
          mapEl.querySelector('.nring')?.classList.add('pop')
          if (document.visibilityState === 'visible') { const s = tapSlot('hold'); if (s !== null) ding(snd(s), 0.15) } // 튀어나올 때 작은 소리 · 걷힐 때는 소리 없이 (ZAXIS-1031 7단계)
        }
      }
    }
    lastMapRing = mh
    lastRing = rh
    lastRingId = ring
    zoom.apply(first ? undefined : keep)
    paintMapCanvas(wrap) // 땅·길·안개 캔버스 — 판이 바뀌었을 때만 다시 그린다
    // 이름표 비키기를 다음 프레임으로 미루면 한 프레임은 겹친 채 보였다가 튄다 — 곧바로
    { const m2 = wrap.querySelector<HTMLElement>('.map'); if (m2 !== null) declutter(m2) }
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
    // 쉴 때 — 고른 것도 연 판도 없다. 멀리 볼 때는 지도 글씨를 줄인다 (형 10-31 z축 · docs/realm/ZAXIS-1031.md 2단계)
    root.classList.toggle('rest', sb === '' && sheet === null && ring === '')
    morph($('.roadkey'), roadKeyHtml())
    $('.layers').innerHTML = layersOpen ? layersHtml() : ''
    // 답할 청이 남았으면 깃발 줄 끝에 사신 알림 — 누르면 외교 판
    const waiting = openAsks(realm, me()).filter((a) => answers[a.id] === undefined).length
    // 결승선 왕관 줄 — 깃발 줄 맨 앞 (위원회 11-08 · crowns.ts) · 이번 계절에 쥔 도읍이 있으면 그 고을에서 왕관이 날아와 박힌다
    morph($('.legend'), crownRowHtml(r, me(), ART) + legendHtml(r) + (waiting > 0 ? `<button class="askpill" data-act="tab" data-tab="diplo">${icon('good-tribute-bell')}${tr('legend.envoys', { n: waiting })}</button>` : ''))
    $('.next').innerHTML = `${nextPreview(r)}${nextWord(r)} <span>›</span>`
    if (crownQueue.length > 0) { const q = crownQueue; crownQueue = []; setTimeout(() => flyCrowns(root, q, ART), P.realm.crownFlyDelayMs) }
    scheduleWinAhead(r)
    morph($('.todo'), todoHtml(r))
    morph($('.goalb'), goalBandHtml(r, esc, goalFolded()) + contestHtml(r)) // 캠페인의 장이면 이 장의 목표 — 접을 수 있다
    $('.goalb').classList.toggle('folded', goalFolded())
    let tabs = ''
    const rec = recTabs(r)
    for (const t of TABS) {
      const wait = tabWait(r, t.id)
      if (wait > 0) { tabs += `<button class="locked" data-act="locktab"${noBtn(tr('tab.locked', { name: t.name, turns: turnsLabel(r, wait) }))}>🔒<span>${t.name}</span></button>`; continue }
      const dot = dotKeys(r, t.id).some((k) => !seenKeys.has(k))
      tabs += `<button class="${sheet?.kind === t.id ? 'on' : ''}${newTab === t.id ? ' fresh' : ''}" data-act="tab" data-tab="${t.id}" data-tip="${t.name}" data-more="${t.more}">${icon(t.icon, 'tic')}<span>${t.name}</span>${dot ? '<i class="dot"></i>' : ''}${rec.has(t.id) ? `<i class="rec" title="${esc(rec.get(t.id)!)}" data-why="${esc(rec.get(t.id)!)}">${tr('rec.badge')}</i>` : ''}</button>`
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
        case 'market': body = marketSheet(r); break
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
        window.setTimeout(() => ding(snd(lose ? 'bad_big' : 'horn_victory'), lose ? 0.7 : 0.9), Number.parseFloat(endFx.style.getPropertyValue('--wd')) * 1000)
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
    ring = ''
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
    const life = noticeMs(el?.textContent ?? '', P.realm.noticeBigMs)
    if (el instanceof HTMLElement) el.style.animationDuration = `${life}ms`
    window.setTimeout(() => el?.remove(), Math.max(DEX_TOAST_MAX_MS, life + 1000))
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

  /**
   * 완공 알림 — 달이 넘어가며 우리 고을에 일터·방비가 서거나 터를 닦았으면, 화면 오른쪽 위에 그림표와 「완공!」 한 장씩
   * (형 11-09: "건물 완성되면 어디가 완성됐다 이런 거 달 넘어갈 때 알람 떠야 하는 거 아님?") · 누르면 그 마을 안으로 · 저절로 걷힌다
   */
  function doneToast(r: Realm, lines: readonly ReportLine[]): void {
    root.querySelector('.wkdone')?.remove()
    const items: Array<{ node: string; ic: string; text: string }> = []
    for (const l of lines) {
      if (!('faction' in l) || l.faction !== me() || !('done' in l) || l.done !== true) continue
      const nm = r.nodes[l.node]?.name ?? ''
      if (l.kind === 'work') items.push({ node: l.node, ic: WORKS[l.what].icon, text: `${nm} ${WORKS[l.what].name}${(l.lv ?? 1) > 1 ? ` ${l.lv}단` : ''}` })
      else if (l.kind === 'build') items.push({ node: l.node, ic: l.what === 'moat' ? 'settle-moat' : 'settle-palisade', text: `${nm} ${BUILD_NAME[l.what]}` })
      else if (l.kind === 'clearLot') items.push({ node: l.node, ic: 'settle-clearing', text: `${nm} 새 터` })
    }
    if (items.length === 0) return
    const el = document.createElement('div')
    el.className = 'wkdone'
    el.innerHTML = items.slice(0, 4).map((x) => `<button class="wkd" data-act="town-in" data-node="${esc(x.node)}">${icon(x.ic, 'wkdi')}<span><b>완공!</b>${esc(x.text)}</span></button>`).join('')
    const life = noticeMs(items.map((x) => x.text).join(' '), P.realm.noticeBigMs)
    el.style.setProperty('--life', `${life}ms`)
    el.addEventListener('animationend', (e) => { if (e.target === el) el.remove() })
    window.setTimeout(() => el.remove(), life + 1000)
    // 누르면 그 마을 안으로 (town-in 이 고을 판을 거치지 않고 바로 연다) · 알림은 걷힌다
    el.addEventListener('click', () => window.setTimeout(() => el.remove(), 0))
    window.setTimeout(() => { if (realm === r) root.append(el) }, P.realm.doneToastDelayMs)
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
    const LIFE = noticeMs(el.textContent ?? '', P.realm.backToastMs)
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
  /** 마지막으로 달을 넘긴 때 (performance.now) — 그 뒤 nextLockMs 동안 「다음 달」 누름은 버린다 */
  let nextDoneAt = -Infinity
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
    if (prev.region !== 'tutorial') res.next.idle = nextIdle(prev, mine, me(), prev.idle) // 놀고 있는 계절 셈 — 추천 딱지가 쓴다 (PLAYTEST-1112 TOP 2)
    fresh = new Set(knownOf(res.next, me()).filter((f) => met(res.next, me(), f) && !met(prev, me(), f))) // 소개된 나라만 (discovery.stepMeet)
    // 계속 둔 판 — 도읍을 모두 쥐면 한 번 더 끝 화면 (하나가 됐다)
    if (res.next.endless === true && res.next.unified === undefined && Object.values(res.next.factions).every((f) => res.next.nodes[f.capital]?.owner === me())) res.next.unified = res.report.season
    // 판을 이기면 다음 판이 열린다 (unlock.ts)
    if (res.next.outcome?.kind === 'win' && prev.outcome == null) markWon(res.next.region ?? 'byeonhan-mini', res.next.tier ?? 1, me())
    host.onAdvance(res.next, res.report, all, mine)
    dexToast(recordDex(res.next))
    engraveNow(res.next) // 판이 끝났다 — 이기든 지든 장수마다 공을 판 밖 단련 공으로 (drill.ts)
    backToast(backNotes(prev, res.next, mine))
    doneToast(res.next, res.report.lines)
    leagueToast(res.next, res.report.lines) // 합종이 섰다·칼을 뽑았다·깼다 (승리가 가깝다는 알림이 있으면 그것이 덮는다)
    nearWinToast(prev, res.next)
    crownQueue = newCrowns(prev, res.next, me())
    diploToast(prev, res.next)
    queueAscend(res.next, res.report.lines)
    if (isSeasonStart(res.next)) seasonFx(res.next) // 계절이 바뀔 때만 (달 시계면 계절의 첫 달)
    noteFaces(res.next) // 갓 난 아이 얼굴 — 보고·장면·장수 판 어디서나 (형 10-23: "하늬도 이미지가 없어 보이네 애기 태어날 때")
    ceremonyFx(prev, res.next, res.report)
    // 우리가 낀 싸움이면 북, 아니면 이 계절 머리 장면의 소리 (혼인·아이·동맹…) — 종이 잦아든 뒤
    const ourWar = res.report.lines.some((l) => l.kind === 'battle' && (l.atkFaction === me() || l.defender === me()))
    const ev = /event\/([\w-]+)\.jpg/.exec(sceneOf(prev, res.next, res.report))?.[1]
    const cue = ourWar ? 'war_drums' : ev !== undefined ? SCENE_SOUND[ev] : undefined
    if (cue !== undefined) window.setTimeout(() => { if (document.visibilityState === 'visible') ding(snd(cue), 0.4) }, SCENE_CUE_MS)
    paint()
    queueHowWin(lossOf(prev, res.next, res.report, me()))
    queueGain(res.next, res.report)
    // 넘긴 뒤 잠깐 「다음 달」을 잠근다 — 그 사이 누름은 먹지 않는다 (형 11-01: "결과 창 뜰 때까지 비활 · 자꾸 두세 번 누르게 됨")
    nextDoneAt = performance.now()
    root.classList.add('nxlock')
    window.setTimeout(() => root.classList.remove('nxlock'), P.realm.nextLockMs)
  }

  // ───────── 얻은 것 — 고을을 차지하거나 새 마을이 서면 크게 (형 11-01: "이로운 게 생기면 크고 확실하게 · 슈퍼마리오에도 있다")
  // 보고·장면·싸움이 다 걷혀 지도로 돌아온 그때 — 가운데에서 튀어 오르고 엽전 소리 · 위 띠의 그 생산품이 함께 뛴다. 스스로 걷힌다
  interface Gain { readonly node: string; readonly how: 'take' | 'settle' | 'wonder' | 'feast'; readonly n?: number; readonly what?: WonderId; readonly got?: FeastGot; readonly who?: string; readonly p?: number }
  let gainPending = -1
  /**
   * 각성 연출은 싸움판·사로잡은 장면이 걷힌 뒤에 — 넘기는 순간 띄우면 실시간 전장 뒤에 깔려 아무도 못 봤다 (배우는 판 11-01).
   * 보고판 위에는 뜬다 (싸움의 결과니까). 숨은 탭에서는 기다린다 (절대 규칙 4)
   */
  function queueAscend(next: Realm, lines: readonly ReportLine[]): void {
    if (!lines.some((l) => l.kind === 'ascend')) return
    const season = next.season
    const tick = (): void => {
      if (realm === null || realm.season !== season) return
      if (document.visibilityState !== 'visible') { document.addEventListener('visibilitychange', tick, { once: true }); return }
      if (!warOn && scenesLeft === 0 && !root.classList.contains('war-open') && root.querySelector('.cere, .wr') === null) { ascendShow(realm, lines); return }
      window.setTimeout(tick, P.realm.gainWaitMs)
    }
    window.setTimeout(tick, P.realm.gainWaitMs) // 전장이 이 다음에 열린다 — 한 박자 뒤부터 본다
  }
  function queueGain(next: Realm, rep: Report): void {
    if (next.outcome) return // 판이 끝났다 — 끝 화면이 그 몫을 한다
    const gains: Gain[] = []
    for (const l of rep.lines) {
      if (l.kind === 'take' && l.faction === me() && next.nodes[l.node]?.owner === me()) gains.push({ node: l.node, how: 'take' })
      else if (l.kind === 'settle' && l.faction === me() && next.nodes[l.to]?.owner === me()) gains.push({ node: l.to, how: 'settle', n: l.n })
      // 곳간을 부을 곳 — 큰 공사가 섰다 · 큰 잔치의 굴림 (wonders.ts · 위원회 11-08 ⑦)
      else if (l.kind === 'wonder' && l.ev === 'done' && l.faction === me()) gains.push({ node: l.node, how: 'wonder', what: l.what })
      else if (l.kind === 'feast' && l.faction === me()) gains.push({ node: next.factions[me()]?.capital ?? '', how: 'feast', got: l.got, ...(l.who !== undefined ? { who: l.who } : {}), p: l.p })
    }
    if (gains.length === 0) return
    const season = next.season
    gainPending = season
    const tick = (): void => {
      if (gainPending !== season || realm === null || realm.season !== season) return
      // 뒤에 숨은 탭에서는 기다리지 않는다 — 다시 보일 때 이어서 (절대 규칙 4)
      if (document.visibilityState !== 'visible') { document.addEventListener('visibilitychange', tick, { once: true }); return }
      if (mapClear()) { gainPending = -1; gainPop(realm, gains); return }
      window.setTimeout(tick, P.realm.gainWaitMs)
    }
    window.setTimeout(tick, P.realm.gainWaitMs)
  }
  function gainPop(r: Realm, gains: readonly Gain[]): void {
    root.querySelector('.gnpop')?.remove()
    let k = 0
    const rows = gains.slice(0, 3).map((g, i) => {
      const n = r.nodes[g.node]
      if (n === undefined) return ''
      const chip = (ic: string, t: string): string => `<b class="gnc" style="--k:${k++}">${icon(ic)}${t}</b>`
      if (g.how === 'wonder' && g.what !== undefined) {
        const d = WONDERS[g.what]
        return `<div class="gnrow gnsc" style="--i:${i};--wsc:url(${ART}event/event-wonder-${g.what}.jpg)"><img class="gnnd" src="${ART}icon/${d.icon}.png" alt=""><div><b class="gnt">${esc(d.name)}</b><small>${esc(n.name)}에 섰습니다</small><span class="gncs">${chip('treasure-silla-crown', wonderEffect(g.what))}</span></div></div>`
      }
      if (g.how === 'feast') {
        // 굴림의 결과 — 나온 갈래 그림 · 그 갈래의 확률 (판 기록에 실제 숫자 · ODDS.md)
        const pc = `${Math.round((g.p ?? 0) * 100)}%`
        const got = g.got === 'guest' ? chip('unit-general', HERO_POOL.find((x) => x.id === g.who)?.name ?? '손님')
          : g.got === 'king' ? chip('good-tribute-bell', `${r.factions[g.who ?? '']?.name ?? ''} 호감 +${P.realm.feastFavor}`)
            : chip('unit-drummers', `사기 +${Math.round(P.realm.feastMorale * 100)}`)
        return `<div class="gnrow gnsc" style="--i:${i};--wsc:url(${ART}event/event-great-feast.jpg)"><img class="gnnd" src="${ART}icon/wonder-feast.png" alt=""><div><b class="gnt">큰 잔치</b><small>${g.got === 'guest' ? '이름난 손님이 왔습니다' : g.got === 'king' ? '이웃 왕이 찾아왔습니다' : '좋은 잔치였습니다'} · ${pc}</small><span class="gncs">${got}</span></div></div>`
      }
      const chips = [...(g.how === 'settle' && g.n !== undefined ? [chip('unit-porters', `+${g.n}가구`)] : []), ...nodeSpecials(r, g.node).map((x) => chip(GOOD_ICON[x], `+${GOOD_NAME[x]}`))]
      return `<div class="gnrow" style="--i:${i}"><img class="gnnd" src="${ART}icon/${nodeIcon(n)}.png" alt=""><div><b class="gnt">${esc(n.name)}</b><small>${g.how === 'take' ? '우리 땅이 되었습니다' : '새 마을이 섰습니다'}</small><span class="gncs">${chips.join('')}</span></div></div>`
    }).join('')
    const sparks = Array.from({ length: 10 }, (_, i) => `<i class="gnsp" style="--a:${i * 36}deg;--r:${140 + (i % 3) * 40}px;--dl:${(i % 4) * 60}ms"></i>`).join('')
    const el = document.createElement('div')
    el.className = 'gnpop'
    el.innerHTML = `<div class="gnbox">${sparks}<b class="gnh">획득!</b>${rows}</div>`
    const life = noticeMs(el.textContent ?? '', P.realm.gainPopMs)
    el.style.setProperty('--life', `${life}ms`)
    el.style.setProperty('--cm', `${P.realm.gainChipMs}ms`)
    el.addEventListener('click', () => el.remove())
    root.append(el)
    ding(snd('coins'), 0.6)
    buzz([20, 30, 20, 30, 50])
    for (let i = 0; i < Math.min(k, 4); i++) window.setTimeout(() => { if (el.isConnected) ding(snd('tap_coin'), 0.35, 1 + i * 0.12) }, P.realm.gainChipMs * (i + 1))
    // 위 띠의 그 생산품 칸이 함께 뛴다 — 무엇이 늘었는지 눈이 따라가게
    const goods = new Set(gains.filter((g) => g.how === 'take' || g.how === 'settle').flatMap((g) => nodeSpecials(r, g.node)))
    for (const s of root.querySelectorAll<HTMLElement>('.stat[data-g]')) if (goods.has(s.dataset['g'] as Good)) { s.classList.remove('gnpulse'); void s.offsetWidth; s.classList.add('gnpulse') }
    window.setTimeout(() => el.remove(), life)
  }

  // ───────── 이기는 법 — 싸움에 지고 지도로 돌아오면 위에 띠 (howwin.ts · 형 10-29: "전투에서 패배하면 개빡치고 하기 싫어지니까")
  /** 띄울 차례를 기다리는 진 싸움 · 이 판에서 마지막으로 진 싸움(도움말에서 다시 열 때) */
  let lossPending: Loss | null = null
  let lastLoss: Loss | null = null
  const HOWWIN_WAIT_MAX_MS = 10 * 60 * 1000
  const howKit = (): HowKit => ({ art: ART, flag: (f) => (f !== null && FACTION_ART[f] !== undefined ? flagIcon(f) ?? null : null), wait: (t) => (realm !== null ? tabWait(realm, t) : 0), turns: (n) => (realm !== null ? turnsLabel(realm, n) : `${n}계절`) })
  /** 지도가 비었나 — 보고·장면·싸움·다른 알림이 다 걷혔다 */
  const mapClear = (): boolean => realm !== null && front === null && prologue === null && !showReport && !warOn && !root.classList.contains('modal-open') && !root.classList.contains('war-open')
    && root.querySelector('.cere, .wr, .bktoast, .guidebox, .failbox, .lsn-box, .nightov, .ascfx') === null
  /** 진 싸움을 받아 둔다 — 보고와 장면이 다 걷혀 지도로 돌아오면 띄운다 (배우는 판 · 끝난 판 · 이번 계절 이미 띄운 것은 빼고) */
  function queueHowWin(loss: Loss | null): void {
    if (loss !== null && realm !== null && realm.region !== 'tutorial' && !realm.outcome) {
      lastLoss = loss
      if (howWinDue(realm.seed, loss)) waitHowWin(loss)
    }
    howPin()
  }
  /** 진 계절 내내 붙는 작은 「⚔ 이기는 법」 — 큰 띠를 기다리거나 띠가 떠 있는 동안은 숨고, 다음 계절이면 걷힌다 (형 10-30: "한 번 끄면 없어져 버리잖아") */
  function howPin(): void {
    const on = realm !== null && lastLoss !== null && lastLoss.season === realm.season && lossPending === null && realm.region !== 'tutorial' && !realm.outcome
    syncPin(root, on, ART)
  }
  /** 큰 띠는 세 번까지(그 뒤로는 크게 졌을 때만) — 지도가 비면 띄운다 */
  function waitHowWin(loss: Loss): void {
    if (realm === null) return
    lossPending = loss
    const born = performance.now()
    const tick = (): void => {
      if (lossPending !== loss) return
      if (realm === null || realm.season !== loss.season || performance.now() - born > HOWWIN_WAIT_MAX_MS) { lossPending = null; howPin(); return }
      // 뒤에 숨은 탭에서는 세지 않는다 — 다시 보일 때 이어서 (절대 규칙 4)
      if (document.visibilityState !== 'visible') { document.addEventListener('visibilitychange', tick, { once: true }); return }
      if (mapClear()) {
        lossPending = null
        howWinMark(realm.seed, loss.season)
        showBanner(root, bannerHtml(howKit(), loss), () => openHowWin(loss), howPin) // 걷히면 작은 단추로 접힌다
        ding(snd('ui_open'), 0.3)
        return
      }
      window.setTimeout(tick, 600)
    }
    window.setTimeout(tick, 600)
  }
  function openHowWin(loss: Loss | null): void {
    openLessons(root, lessons(howKit(), loss), howWinGo)
    ding(snd('ui_open'), 0.2)
  }
  /** 「해 보기」 — 그 탭(외교면 그 칸)을 연다 */
  function howWinGo(g: LessonGo): void {
    if (realm === null) return
    if (g.mode !== undefined) diploMode = g.mode
    if (g.tab === 'heroes') cmdJob = null
    markSeen(g.tab)
    sheet = null
    openSheet({ kind: g.tab })
  }

  // ───────── 폰 뒤로가기 — 웹 페이지 뒤로가 아니라 열린 창부터 닫는다 (형 2026-10-20: "뒤로가기 누르면 … 그냥 웹페이지 뒤로가버리는데")
  // 지킴 칸 하나를 쌓아 두고, 뒤로가기가 그 칸을 걷으면(popstate) 한 겹 닫고 다시 쌓는다. 처음 화면에서 누르면 그때 페이지를 떠난다.
  /** 한 겹 닫는다 — 닫은 게 있으면 true */
  function backOne(): boolean {
    if (root.classList.contains('war-open') || root.querySelector('.wr') !== null) return true // 싸움 중엔 닫지 않는다 (싸움은 끝까지)
    if (closeHowWin(root)) { howPin(); return true }
    const fail = root.querySelector('.failbox')
    if (fail !== null) { fail.remove(); return true }
    if (front !== null) {
      if (front.kind === 'dex') {
        if (front.sel !== null) front = { ...front, sel: null }
        else front = front.back
      } else if (front.kind === 'drill') { if (yardBack()) front = { ...front, slot: null }; else yardLeave(); return true }
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
    else if (ring !== '') ring = '' // 고을 둘레 단추만 떠 있으면 그것만 걷는다 (리뷰 11-01: 처음 화면으로 튕겼다)
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
  const COVER_MAX_MS = 15000 // 느린 폰에서 넓은 지도 바탕을 만드는 데까지 (11-03)
  function coverMap(): void {
    if (root.querySelector('.loadcov') !== null) return
    const cov = document.createElement('div')
    cov.className = 'loadcov'
    // 동검 (옛 청동거울+활 문장은 아이콘을 바꾼 뒤에도 여기 남아 「방패와 화살」로 보였다 · 형 11-03) · 가운데 한 줄은 읽을 시간만큼 머문다
    const tip = loadTip()
    cov.innerHTML = `<img src="${ART}logo/emblem-dagger.png" alt=""><p class="sptip">${tipHtml(tip, esc)}</p><div class="lbar go"><i></i></div>`
    const readMs = tipReadMs(tip, P.realm.loadTipMinMs, P.realm.loadTipPerCharMs, P.realm.loadTipMaxMs)
    let loaded = false
    let finishBar = (): void => {}
    const gone = (): void => { if (cov.classList.contains('out')) return; finishBar(); cov.classList.add('out'); cov.addEventListener('transitionend', () => cov.remove(), { once: true }) }
    cov.addEventListener('click', () => { if (loaded) gone() }) // 다 받았으면 누르면 바로
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
      const t0 = performance.now()
      // 받은 만큼 + 기다린 만큼 점점 (ui/realm/loadbar.ts · 형 11-04: "95% 에서 멈춰 있다가 100") — 지도 바탕이 큰 몫
      const R = P.realm
      const lb = loadBar(fill, 8)
      finishBar = (): void => lb.finish()
      // 읽힐 시간도 막대의 몫 — 걷히는 때에 100% (받는 그림들과 같은 무게)
      lb.add(new Promise<void>((ok) => setTimeout(ok, readMs)), Math.max(1, all.length) / (1 - R.loadBarMapShare), readMs, true)
      const load: Array<Promise<unknown>> = all.map((u) => lb.add(new Promise<void>((ok) => { const i = new Image(); i.onload = i.onerror = () => ok(); i.src = u }), 1, R.loadBarImgExpectMs))
      // 넓어지는 지도의 바탕은 조각을 잇고 계절 빛을 입히느라 늦게 선다 — 그것까지 기다린다 (형 11-03: "맵이 로딩도 안 되어 있는데")
      if (realm !== null) load.push(lb.add(worldMapReady(ART, seasonOf(realm), realm.region ?? 'byeonhan-mini'), (Math.max(1, all.length) * R.loadBarMapShare) / (1 - R.loadBarMapShare), R.loadBarMapExpectMs))
      const late = new Promise<void>((ok) => setTimeout(ok, COVER_MAX_MS))
      void Promise.race([Promise.all(load), late]).then(() => {

        loaded = true
        // 가운데 한 줄을 읽을 만큼은 보인다 (형 11-03) · 그 전에 눌러 걷을 수 있다
        setTimeout(gone, Math.max(250, readMs - (performance.now() - t0)))
      })
    }))
  }

  // ───────── 손짓 — 한 곳에서 받는다
  root.addEventListener('input', (ev) => {
    const input = ev.target
    if (!(input instanceof HTMLInputElement)) return
    if (input.classList.contains('dysearch')) { yardSearch(root, input.value); return } // 단련터 이름 찾기 — 다시 그리지 않는다
    const channel = input.dataset['vol']
    if (channel !== 'bgm' && channel !== 'sfx' && channel !== 'voice') return
    setSoundVolume(channel, Number(input.value) / 100)
    const out = input.closest('.volrow')?.querySelector('output')
    if (out !== null && out !== undefined) out.textContent = `${input.value}%`
    if (channel === 'bgm') music.refreshVolume()
    if (channel === 'sfx') for (const v of root.querySelectorAll<HTMLVideoElement>('video[loop]')) v.volume = P.realm.loopVolume * soundVolume('sfx')
  })
  // 숨 쉬는 영상의 판이 여럿이면 끝날 때 다음 판으로 (data-takes · takeAttrs) — 'ended' 는 거품이 안 올라 잡기(capture)로 듣는다
  root.addEventListener('ended', (ev) => {
    const v = ev.target
    if (!(v instanceof HTMLVideoElement) || v.dataset['takes'] === undefined) return
    const xs = v.dataset['takes'].split('|')
    const now = xs.indexOf(v.getAttribute('src') ?? '')
    v.setAttribute('src', xs[(now + 1) % xs.length]!)
    void v.play().catch(() => undefined)
  }, true)
  // 전체 화면 — 처음 손이 닿는 그 순간에 (형 10-23: "게임 시작하자마자 되어야 하는 거 아님?").
  // 브라우저는 손짓 없이는 못 켜게 막는다 — 첫 화면·불러오는 화면을 포함해 어디든 처음 누르면 켠다 (손을 뗄 때가 브라우저가 허락하는 때)
  root.addEventListener('click', (ev) => {
    if (tokPress.swallow(ev.target)) return // 꾹 눌러 설명 창을 띄운 손 — 고르기가 아니다
    // 길 보기는 지도를 누르면 접힌다 — ✕ 를 찾지 않아도 (형 10-27)
    if (roadOpen && (ev.target as HTMLElement).closest('.mapwrap') !== null && !zoom.dragged()) { roadOpen = false; morph($('.roadkey'), roadKeyHtml()) }
    // 둘레 단추가 떠 있을 때 지도 빈 곳을 누르면 걷힌다 (고을·말을 누르면 그쪽이 받는다)
    if (ring !== '' && front === null && !zoom.dragged()) { // 첫 화면 같은 판이 덮여 있으면 그 누름은 판의 것 (리뷰 11-01: 걷기에 먹혔다)
      const e = ev.target as HTMLElement
      if (e.closest('.map') !== null && e.closest('.nring, .nd, .tok, .lbs .lb') === null) { ring = ''; paint(); return }
    }
    // 고을 이름표를 누르면 그 고을을 누른 것 (말이 고을 그림을 덮고 있어도 · 형 11-04)
    // 단 그 자리 밑에 말의 얼굴·수가 있으면 말이 먼저 (이름표가 얼굴을 살짝 덮을 때)
    const lb0 = (ev.target as HTMLElement).closest<HTMLElement>('.lbs .lb[data-n]')
    // 무엇을 고른 채(selbar 떠 있음)면 이름표가 곧 고을 — 말이 덮고 있어도 고을을 겨눈다 (형 11-11: 부대가 이름표와 겹쳐 경산에 군사를 못 보냄)
    const face = lb0 !== null && !root.classList.contains('sel-open') && ev instanceof MouseEvent ? document.elementsFromPoint(ev.clientX, ev.clientY).find((e) => e.matches('.tok > img, .tok > b'))?.closest<HTMLElement>('[data-act]') ?? null : null
    const lb = face === null ? lb0 : null
    const t = face ?? (lb !== null ? root.querySelector<HTMLElement>(`.nd[data-node="${lb.dataset['n']}"]`) : (ev.target as HTMLElement).closest<HTMLElement>('[data-act], .nd'))
    if (t === null || !root.contains(t)) return
    if (zoom.dragged() && t.closest('.mapwrap') !== null) return // 지도를 끌다 놓은 것 — 누르기가 아니다
    // 못 하는 단추 — 눌러도 아무 일 없으면 고장 같았다 (형 11-01: "목책 눌렀는데 아무 반응 없음 · 글자·소리로 알려줘야") → 까닭을 띄우고 둔탁한 소리
    if (t.getAttribute('aria-disabled') === 'true') { denyPop(t, t.dataset['why'] ?? ''); return }
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
      // 첫 누름은 둘레 단추 (z축 5·6단계) — 「자세히」 만 큰 판. 배우는 판도 같다 (형 11-01: 튜토리얼도 지금에 맞게) · 소도는 굿 판 하나뿐이라 곧바로
      const id = t.dataset['node']!
      if (realm === null || realm.nodes[id]?.kind === 'sodo') { openSheet({ kind: 'node', id }); return }
      if (showReport && repTodo() > 0) return // 정할 것이 남은 동안은 둘레 단추를 열지 않는다 (형 11-11)
      const was = ring
      sheet = null
      ring = was === id ? '' : id
      // 부채가 열릴 쪽 — 화면 가장자리에 붙은 고을이면 안쪽으로 (위원회 11-04 UX ⑧ · 단추가 화면 밖으로 잘렸다)
      { const q = t.getBoundingClientRect(); const cx = q.left + q.width / 2; const cy = q.top + q.height / 2; const m = P.realm.mapRingR + P.realm.mapRingGap
        const top = root.querySelector<HTMLElement>('.mapwrap')?.getBoundingClientRect().top ?? 0
        ringDeg = cy - top < m ? 270 : cx < m ? 0 : cx > innerWidth - m ? 180 : 90 }
      paint()
      // 둘레 단추가 다 튀어나온 뒤에 잰다 — 바로 재면 고을 가운데에 모여 있어 밖인지 모른다 (검토 11-04) · 숨은 탭이면 안 돈다
      if (ring !== '') window.setTimeout(() => { if (document.visibilityState === 'visible') ringIntoView() }, P.realm.mapRingSettleMs + 6 * P.realm.mapRingStaggerMs)
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
      case 'annals-open': bookSeed = null; front = { kind: 'annals' }; paint(); return
      case 'book-open': bookSeed = Number(d['seed']); paint(); bookSwipe(root); return
      // 책 넘기기 — 판을 다시 그리지 않고 그 쪽만 (형 11-08: "책처럼 넘기게")
      case 'bk-next': bookTurn(root, 1); return
      case 'bk-prev': bookTurn(root, -1); return
      case 'book-close': bookSeed = null; paint(); return
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
      case 'lobby': saveDraft(); front = { kind: 'title' }; sheet = null; armySel = []; ring = ''; clearParty(); paint(); return
      case 'fr-board': // 캠페인의 장도 자유 판처럼 나라 → 세기 → 데려갈 장수 (형 11-02 · 장은 나라가 하나뿐이어도 고르게)
        front = { kind: 'nations', region: d['v'] as RegionId }; $('.mapwrap').scrollTop = 0; paint(); return
      case 'fr-tutorial': host.onNewGame('baekje', 'tutorial', 0); return // 0장은 늘 촌장 (형 11-02)
      case 'fr-locked': return
      case 'tut-end': markTutorialOver('done'); front = { kind: 'title' }; paint(); return
      // 튜토리얼 다음은 1:1 자유 판 (형 11-04)
      case 'tut-next': markTutorialOver('done'); front = { kind: 'nations', region: 'byeonhan-mini' }; $('.mapwrap').scrollTop = 0; paint(); return
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
      case 'fr-start': if (front !== null && front.kind === 'detail') startWithBring(d['id']!, front.region, front.region === 'tutorial' ? 0 : Math.min(tierPick[front.region] ?? 1, tierOpen(front.region))); return
      case 'bring-go': { const b = bringAsk; bringAsk = null; root.querySelector('.bringov')?.remove(); if (b !== null) host.onNewGame(b.nation, b.region, b.tier); return }
      case 'bring-none': { const b = bringAsk; bringAsk = null; root.querySelector('.bringov')?.remove(); clearBring(); if (b !== null) host.onNewGame(b.nation, b.region, b.tier); return }
      case 'bring-x': bringAsk = null; root.querySelector('.bringov')?.remove(); return
      case 'fr-again': if (realm !== null) { const rg = realm.region ?? 'byeonhan-mini'; host.onNewGame(realm.player, rg, Math.min(realm.tier ?? 1, tierOpen(rg))) } return
      case 'tier-pick': if (front !== null && front.kind === 'detail') tierPick[front.region] = Number(d['v']); paint(); return
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
        // 원정 창은 보낸 그 장수를 계속 보인다 (cmdWinHtml justSent) — 맨 앞 장수로 골라 둔 채 보냈어도
        if (cmdJob === 'exp') cmdHero = d['id']!
        obey(d['id'])
        break
      }
      case 'unexp': heroOrders = heroOrders.filter((o) => !(o.kind === 'expedition' && o.hero === d['id'])); break
      case 'card-pick': if (realm?.card) { const s = realm.card.season; if ((realm.card.kind === 'pirates' || realm.card.kind === 'bandits') && d['v'] === '1' && cardHeld[`card:${s}`] === undefined) { openPirate(); return } if (realm.card.kind === 'skyfest' && realm.card.grand === true && cardHeld[`card:${s}`] === undefined && (d['v'] === '0' || d['v'] === '1')) { if (d['v'] === '0') openFestArchery(); else openFestDuel(); return } answers[`card:${s}`] = d['v'] === '0'; if (d['v'] === '2') answers[`hush:${s}`] = true; else delete answers[`hush:${s}`]; fastNext = true } break
      case 'card-beat': if (realm?.card) { const k = `card:${realm.card.season}`; cardBeat[k] = (cardBeat[k] ?? 0) + 1 } break
      case 'card-skip': if (realm?.card) cardBeat[`card:${realm.card.season}`] = 99; break
      case 'practice-open': openPractice(); break
      case 'spar-open': fmoreOpen = false; openSpar(); return
      case 'contest': openContest(); break
      case 'unwed': heroOrders = heroOrders.filter((o) => !(o.kind === 'wed' && (o.a === d['id'] || o.b === d['id']))); break
      case 'dex-open': root.querySelector('.dxtoast')?.remove(); front = { kind: 'dex', board: 'all', sel: null, back: front }; sheet = null; paint(); return
      // 단련터 — 끝 화면에서 · 첫 화면에서 (HERO-GROWTH ★ §C)
      case 'dy-hero': case 'dy-hback': case 'dy-tab': case 'dy-pop': case 'dy-fs': case 'dy-freset': {
        if (front === null || front.kind !== 'drill') return
        if (yardAct(root, d['act']!, d)) { front = { ...front, anim: false, gain: {}, last: null, slot: null }; paint() }
        return
      }
      case 'dy-open': yardReset(); yardArmed = false; if (realm !== null) { engraveNow(realm); front = yardFromEnd(realm); sheet = null; $('.mapwrap').scrollTop = 0 } paint(); return
      case 'dy-title': yardReset(); yardArmed = false; front = { kind: 'drill', from: 'title', ids: null, gain: {}, fell: [], anim: true, last: null }; sheet = null; paint(); return
      case 'dy-next': {
        // 쓸 공이 남았으면 한 번은 붙잡는다 — 빛나는 카드 · 한 번 더 누르면 나간다 (형 11-05)
        if (!yardArmed && Number(d['usable'] ?? 0) > 0) { yardArmed = true; paint(); requestAnimationFrame(() => scrollInside(root.querySelector<HTMLElement>('.dyrow.canup'), 'center')); return }
        yardArmed = false
        yardLeave(); return
      }
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
        for (const at of [0, 0.38, 0.7]) window.setTimeout(() => { if (seen()) ding(snd('tap_drum'), at < 0.6 ? 0.5 : 0.65) }, at * ms)
        window.setTimeout(burst, ms)
        return
      }
      case 'tomb-seen': front = { kind: 'tomb', fresh: false }; paint(); return
      case 'tomb-back': front = null; fastNext = true; paint(); return
      // 단련터의 유물 칸 — 누르면 고르기가 펼쳐지고, 비어 있는 유물만 끼운다
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
      case 'dex-awake': toggleDexAwake(); paint(); return
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
        setTimeout(() => { $('.plbox').innerHTML = ''; $('.plbox').dataset['html'] = ''; if (realm !== null) { seasonFx(realm); paintTut(plan()) } }, 900)
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
        // 외교 탭은 늘 다 접힌 채로 연다 (형 11-03: "외교창 누르면 기본적으로 다 닫혀 있어야 · 나라들 다 열려 있어서 한참 스크롤")
        if (d['tab'] === 'diplo') { diploOpen.clear(); diploOnly = '' }
        markSeen(d['tab']!); openSheet({ kind: d['tab'] as 'army' }); return
      }
      case 'help': openSheet({ kind: 'help' }); return
      case 'howwin': openHowWin(lastLoss); return
      case 'export': host.onExport(); return
      case 'lang-set': { const l = d['v'] as Lang; if (LANGS.includes(l) && l !== lang()) { setLang(l); const u = new URL(location.href); u.searchParams.delete('lang'); location.replace(u.toString()) } return }
      case 'credits-open': void openCredits(BASE); return
      case 'opening-open': fmoreOpen = false; root.querySelector<HTMLDetailsElement>('.fmore')?.removeAttribute('open'); playOpening(BASE, undefined, { muted, hush: (on) => { openingOn = on; music.refresh() } }); return
      case 'epilogue': if (realm?.scenario !== undefined) playEnding(BASE, realm.scenario.id); return
      case 'fmore-x': fmoreOpen = false; root.querySelector<HTMLDetailsElement>('.fmore')?.removeAttribute('open'); return
      case 'gfx': if (front !== null) fmoreOpen = true; setGfxPref(d['v']); paint(); return
      case 'perf-copy': { const t = perfText(); void navigator.clipboard?.writeText(t).then(() => goToast(tr('toast.perfCopied')), () => goToast(tr('toast.copyBlocked'))); return }
      case 'perf-clear': perfClear(); paint(); return
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
      case 'inst-show': { instNow = true; try { localStorage.removeItem(INSTALL_HIDE_KEY) } catch { /* 저장 못 하는 곳 */ } instClosed = false; fmoreOpen = false; break }
      case 'reset-play':
        if (!resetArmed) { resetArmed = true; paint(); return }
        resetArmed = false
        void host.resetPlay?.().then((why) => { if (why !== null) { failNote(new Error(`기록을 지우지 못했습니다. ${why}. 이 기기의 기록도 그대로 두었습니다`)); paint() } })
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
      case 'mute': {
        try { localStorage.setItem(MUTE_KEY, muted() ? '0' : '1') } catch { /* 저장 못 하는 곳 */ }
        music.refresh()
        for (const v of root.querySelectorAll<HTMLVideoElement>('video[loop]')) v.muted = true
        if (!muted()) {
          const active = root.querySelector<HTMLVideoElement>('.ascfx video[loop], .bview video[loop], .hpic video[loop]')
          if (active !== null) voiceLoop(active)
        }
        break
      }
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
        // 넘긴 직후 · 넘기느라 멈춘 사이에 쌓인 누름은 버린다 — 조용한 달은 보고 판이 안 떠서 두세 번 누르면 두세 달이 넘어갔다 (형 11-01)
        if (ev.timeStamp < nextDoneAt + P.realm.nextLockMs || root.classList.contains('nxlock')) return
        if (root.querySelector('.wr') !== null) return // 싸움 화면이 떠 있으면 다음 계절을 또 열지 않는다 · 겹쳐 눌러 싸움 판이 셋 쌓였다(10-29 시험)
        // 문명의 "명령을 기다리는 유닛" — 쉬는 장수가 있거나 정찰을 안 보냈으면 한 번은 그 판으로 데려간다. 한 번 더 누르면 그냥 넘긴다
        // 판 첫 계절은 붙잡지 않는다 — 첫 「다음 달」에 달 대신 정찰 판이 떠 막혔다 (긴급 위원회 11-04 · loop B4)
        if (nudgedAt !== seasonIdx(realm) && realm.region !== 'tutorial' && seasonIdx(realm) > 0) {
          // 장수 탭이 아직 안 열렸으면 쉬는 장수로 붙잡지 않는다 · 재상이 맡을 장수로도 붙잡지 않는다 (직접 부리는 장수만)
          const idle = tabWait(realm, 'heroes') > 0 ? [] : waitingHeroes(plan())
          // 정찰은 싸울 상대가 있을 때만 붙잡는다 — 싸움도 없는데 정찰을 보내게 만들었다 (형 11-01)
          const noScout = scouts.length === 0 && scoutable(realm).some((id) => { const o = realm!.nodes[id]?.owner ?? null; return o !== null && o !== me() && relationOf(realm!, me(), o).state === 'war' })
          if (idle.length > 0 || noScout) {
            nudgedAt = seasonIdx(realm) // 달 시계면 계절마다 한 번 — 달마다 붙잡지 않는다
            nudgedTurn = realm.season
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
          warWatched = new Set(Object.keys(tactics)) // 전장에서 본 싸움 — 소식판에서 다시 펼치지 않는다
          warOn = false
          const cmds: Order[] = Object.entries(tactics).map(([key, t]) => ({ kind: 'command', key, cmds: t.cmds, ...(t.dusk !== undefined && t.dusk.length > 0 ? { dusk: t.dusk } : {}) }))
          endSeason(prev, [...orders, ...cmds], ai)
        }
        const startWar = (): void => {
          try {
            if (openWar(root, prev, [...orders, ...ai], { art: ART, me: me(), ding, warm: warmSfx, music: (k) => { if (k === 'war') music.war(); else music.result(k) }, done: finish })) { warOn = true; music.war(); music.primeResults(); return }
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
      // 도읍에 맞닿지 않은 빈땅 — 도읍에서 꾸려 우리 땅을 거쳐 저절로 간다 (Party.goal)
      case 'party-goal': {
        const cap = r?.factions[me()]?.capital
        if (cap === undefined) break
        settles = [...settles.filter((o) => !(o.kind === 'party' && o.node === cap)), { kind: 'party', faction: me(), node: cap, goal: d['node']! }]
        break
      }
      case 'party-undo': {
        const node = d['node']!
        settles = settles.filter((o) => !(o.kind === 'party' && o.node === node))
        if (partySel === formId(node)) clearParty()
        break
      }
      // 고을 둘레 단추 (z축 5단계) — 큰 판으로 넘어가는 것들. 판을 열면 둘레 단추는 접힌다 (openSheet)
      case 'flm': tipPop(t, d['why'] ?? ''); return
      case 'nr-more': openSheet({ kind: 'node', id: d['node']! }); return
      case 'nr-chief': foldOpen.add('chief'); openSheet({ kind: 'node', id: d['node']! }); return
      case 'nr-draft':
        openSheet({ kind: 'node', id: d['node']! })
        requestAnimationFrame(() => scrollInside(root.querySelector<HTMLElement>('.sheet .draftc'), 'start'))
        return
      // 「군사 보내기」 — 그 군대를 골라 그 고을의 갈 곳을 누른 것과 같다 (전략 회의·먼 길도 그 길로)
      case 'send-army': {
        const id = d['army']
        if (id === undefined || r?.armies[id] === undefined) return
        const to = d['node']!
        armySel = [id]
        clearParty()
        ring = ''
        sheet = null
        paint()
        root.querySelector<HTMLElement>(`.nd[data-act="go"][data-node="${to}"]`)?.click()
        return
      }
      case 'nr-diplo': {
        // 그 나라 칸만 펼쳐서 — 다른 나라는 「모든 나라 보기」로
        diploOnly = d['to']!; diploOpen.clear(); diploOpen.add(diploOnly); diploMode = 'envoy'
        if (sheet?.kind === 'diplo') { ring = ''; $('.sheet').scrollTop = 0; paint() } else openSheet({ kind: 'diplo' })
        return
      }
      case 'diplo-all': diploOnly = ''; break
      case 'foetok': {
        // 적 군대 말 — 전엔 눌러도 아무 일이 없었다 (docs/realm/ZAXIS-1031.md). 우리 군대를 골랐으면 그 고을로 보내고(치러 감), 아니면 그 고을을 연다
        const x = r?.armies[d['army'] ?? '']
        const at = x?.march?.to ?? x?.at
        if (at === undefined || at === null) return
        if (armySel.length > 0) {
          const go = root.querySelector<HTMLElement>(`.nd[data-act="go"][data-node="${at}"]`)
          if (go !== null) { go.click(); return }
        }
        // 아무 군대도 안 골랐으면 아는 만큼 한 줄 — 군사 · 병종 · 장수 (척후가 본 곳) 또는 「모릅니다」 (형 11-02)
        if (x !== undefined && r !== null) { tipPop(t, foeTokLine(r, x)); return }
        openSheet({ kind: 'node', id: at })
        return
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
        root.insertAdjacentHTML('beforeend', `<div class="guidebox" data-act="guide-close"><div class="gbx" role="dialog" aria-label="${esc(g.title)}"><b>${esc(g.title)}</b>${g.body.map((p) => `<p>${tx(typeof p === 'string' ? turnText(realm ?? {}, p) : p(realm ?? {}))}</p>`).join('')}<button class="btn sm" data-act="guide-close">닫기</button></div></div>`)
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
        diploOnly = d['to']!; diploOpen.add(diploOnly)
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
      case 'rally': {
        // 전군 집결 — 다시 누르면 푼다 (그 군대들의 먼 갈 곳을 거둔다)
        if (r === null) break
        const node = d['node']!
        const plan = rallyPlan(r, node)
        if (plan.length === 0) break
        if (rallyOn(r, node, plan)) {
          for (const p of plan) { delete pick[p.army]; if (r.armies[p.army]?.goal !== undefined && !goalStop.includes(p.army)) goalStop = [...goalStop, p.army] }
          break
        }
        goalStop = goalStop.filter((id) => !plan.some((p) => p.army === id))
        for (const p of plan) pick[p.army] = { edge: p.edge, ambush: false, goal: node, rally: true }
        marchSfx()
        goToast(tr('toast.gather', { n: plan.length, to: esc(r.nodes[node]?.name ?? ''), when: turnsLabel(r, plan.reduce((m, p) => Math.max(m, p.seasons), 0)) }))
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
            goToast(tr(foe ? 'toast.armyOut' : 'toast.armyMove', { army: esc(armyName(r, ar)), to: esc(to.name), when: turnsLabel(r, k) }))
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
        const agv = m !== undefined ? agendasFor(r, a, probe, m, sortieD.ration).find((x) => x.id === ag) : undefined
        const v = agv?.voices.find((x) => x.label === d['l'])
        if (v === undefined) break
        sortieD.chose = { ...(sortieD.chose ?? {}), [ag]: v.label }
        applyVoice(a, v, ag)
        sortieD.said = { ...(sortieD.said ?? {}), [ag]: agv!.voices.filter((x) => x.hero !== null).map((x) => ({ hero: x.hero!.id, how: howOf(x), took: x.label === v.label })) }
        // 다음 안건 — 떠나지 않기로 했으면(기다림 · 거둠 · 공작 먼저) 나머지는 쓰이지 않으니 정리로
        stratOpen.step = v.opt.k === 'wait' || v.opt.k === 'hold' || v.opt.k === 'plot' ? 99 : (stratOpen.step ?? 0) + 1
        stratOpen.beat = 0
        break
      }
      case 'cn-next': if (stratOpen !== null) stratOpen.beat = (stratOpen.beat ?? 0) + 1; break
      case 'cn-skip': if (stratOpen !== null) stratOpen.beat = 99; break
      case 'cn-replay': if (stratOpen !== null) stratOpen.beat = 0; break
      case 'cn-goto': if (stratOpen !== null) { stratOpen.step = Number(d['i'] ?? 0); stratOpen.beat = 99 } break
      case 'warn-no': warnAsk = null; break
      case 'warn-yes': {
        const b = root.querySelector<HTMLElement>('.warnpop [data-act="warn-yes"]')
        b?.classList.add('prs')
        window.setTimeout(() => { warnAsk = null; paint(); root.querySelector<HTMLElement>('.sortiebar [data-act="sortie-go"]')?.click() }, P.realm.warnYesMs)
        return
      }
      case 'sortie-cancel': delete pick[d['army']!]; openArmy = ''; break
      case 'sfollow': sortieD.follow = d['v'] === '1'; break
      case 'sortie-go': {
        // 전부면 그 군대가 떠나고, 일부면 떼어 낸 무리가 떠난다 — 나머지(와 기본은 장수)는 남아 지킨다
        const a = r!.armies[d['army']!]
        if (a === undefined) break
        // 전략 회의에서 「기다린다」 — 이번 계절은 떠나지 않는다(먼 갈 곳도 거둔다) · 성에서 맞는다
        if (sortieD.wait === true && stratOpen !== null) {
          // 회의에서 공작을 먼저 하기로 했으면 그 공작을 건다 · 들은 안을 적는다
          councilOrdersGo(r!, a)
          delete pick[a.id]
          if (goalOf(a) !== undefined && !goalStop.includes(a.id)) goalStop = [...goalStop, a.id]
          openArmy = ''
          if (stratDone()) return
          break
        }
        // 승산이 낮으면 한 번 묻는다 — 배우는 판·첫 싸움 안내(lessonOn)는 제 안내를 따른다
        if (sortieD.edge !== null && r!.region !== 'tutorial' && !lessonOn(r!, me())) {
          const worst = sortieWorst(r!, a)
          const wkey = `${r!.season}|${a.id}|${sortieD.edge}`
          if (worst !== null && worst < P.realm.attackWarnWin && !warned.has(wkey)) {
            warned.add(wkey)
            const lead = sortieD.lead ?? (sortieAll(a) ? a.hero : null)
            warnAsk = { army: a.id, pct: `${pct5(worst)}%`, hero: lead ?? null }
            break
          }
        }
        // 나서서 이끌겠다는 장수 — 그 장수에게 맡긴다 (전부면 이 군대를, 일부면 떼어 낸 무리를)
        const lead = sortieD.lead !== undefined && leadCands(r!, a).some((x) => x.id === sortieD.lead) ? sortieD.lead : undefined
        const go = sortieD.edge !== null ? { edge: sortieD.edge, ambush: sortieD.approach !== 'road', approach: sortieD.approach, ...(sortieD.ration !== undefined ? { ration: sortieD.ration } : {}), ...(sortieD.follow === true ? { follow: true } : {}), ...(sortieD.adviser !== undefined ? { adviser: sortieD.adviser } : {}) } : null
        if (go !== null) marchSfx()
        // 두 갈래(다른 군대도 다른 길로 같은 계절에 · 협공) · 들은 안 — 회의에서 고른 것
        if (go !== null && stratOpen !== null) councilOrdersGo(r!, a)
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
            while (k > 0 && draftCost(k, seatDraftMul(plan(), me())).grain > grain) k = Math.floor(k * 0.8)
            if (k <= 0) return
            grain -= draftCost(k, seatDraftMul(plan(), me())).grain
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
        if (!guards.includes(node)) delete guardAp[node]
        fastNext = true
        break
      }
      case 'guard-ap': {
        const node = d['node']!
        const ap = d['ap'] as Approach | ''
        if (ap === '') delete guardAp[node]
        else guardAp = { ...guardAp, [node]: ap }
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
      case 'call': {
        // 곳간 열기 — 이번에 부를 수 있는 만큼 한꺼번에 · 다시 누르면 거둔다
        const node = d['node']!
        const same = (o: Order): boolean => o.kind === 'call' && o.node === node
        if (musters.some(same)) { musters = musters.filter((o) => !same(o)); break }
        const n = callLimit(leftPlan(), me(), node) // 징병·저울로 쓴 곡식까지 빼고 (검토 11-04)
        if (n > 0) {
          const g = callCost(leftPlan(), me(), n).grain
          musters = [...musters, { kind: 'call', faction: me(), node, n }]
          // 누르면 무슨 일인지 바로 — 곡식이 나가고 다음 달 사람이 온다 (형 11-04)
          const nd = r?.nodes[node]
          const m = nd !== undefined && r !== null ? Math.max(1, Math.ceil((inboundOf(nd, me()) + n) / Math.max(1, inboundRate(nd, r)))) : 1
          goToast(`${icon(GOOD_ICON.grain, 'wki')}${tr('toast.call', { g, n, when: m <= 1 ? tr('toast.callSoon') : tr('toast.callSpan', { span: turnsLabel(r!, m) }), to: esc(nd?.name ?? '') })}`)
        }
        break
      }
      case 'market': openSheet({ kind: 'market' }); break
      case 'wish': musters = musters.some((o) => o.kind === 'wish') ? musters.filter((o) => o.kind !== 'wish') : [...musters, { kind: 'wish', faction: me() }]; break
      // 큰 공사 한 단 · 큰 잔치 (wonders.ts) — 한 번에 하나 · 다시 누르면 거둔다
      case 'wonder': {
        const what = (d['what'] ?? '') as WonderId
        const had = musters.some((o) => o.kind === 'wonder' && o.what === what)
        musters = musters.filter((o) => o.kind !== 'wonder')
        if (!had && WONDERS[what] !== undefined) musters = [...musters, { kind: 'wonder', faction: me(), what }]
        break
      }
      case 'feast': musters = musters.some((o) => o.kind === 'feast') ? musters.filter((o) => o.kind !== 'feast') : [...musters, { kind: 'feast', faction: me() }]; break
      case 'scale': {
        const n = Number(d['n']); const g = d['good'] as Good
        if (n > 0) musters = [...musters, { kind: 'scale', faction: me(), good: g, n, buy: d['v'] === 'buy' }]
        break
      }
      case 'scalex': {
        const i = musters.map((o) => o.kind === 'scale' && o.good === d['good']).lastIndexOf(true)
        if (i >= 0) musters = musters.filter((_, j) => j !== i)
        break
      }
      case 'buy': musters = [...musters, { kind: 'buy', faction: me(), offer: d['offer']! }]; break
      case 'buyx': {
        const i = musters.map((o) => o.kind === 'buy' && o.offer === d['offer']).lastIndexOf(true)
        if (i >= 0) musters = musters.filter((_, j) => j !== i)
        break
      }
      case 'sell': {
        const g = d['good'] as Good
        const n = Number(d['n'] ?? 0)
        if (!(n > 0)) break
        const had = musters.find((o) => o.kind === 'sell' && o.good === g)
        const total = (had !== undefined && had.kind === 'sell' ? had.n : 0) + n
        musters = [...musters.filter((o) => !(o.kind === 'sell' && o.good === g)), { kind: 'sell', faction: me(), good: g, n: total }]
        break
      }
      case 'wallall': {
        const plan = wallPlan(realm!)
        if (plan.ok) musters = [...musters, ...plan.list.map((x): Order => ({ kind: 'build', faction: me(), node: x.node, what: x.what }))]
        break
      }
      case 'town-in': {
        // 마을 안으로 — 카메라가 지도 속 그 고을로 파고든다: 지도가 그 고을을 축으로 커지며 끝 무렵 어두워지고(townZoomMs),
        // 그 끝에 마을 판이 다가오며 밝아진다 (형 11-05: "카메라가 마을로 들어가는 연출이어야지 마을 혼자 커지는 연출이어선 안 돼")
        const id = d['node']!
        const el = root.querySelector<HTMLElement>(`.nd[data-node="${id}"]`)
        const b = el?.getBoundingClientRect()
        root.querySelector('.tvveil')?.remove()
        root.querySelector('.loadcov')?.remove() // 걷히는 중인 가림막(z 9998)이 마을 안 위로 비쳤다 (11-08 스크린샷의 옛 기록 글)
        if (b !== undefined) root.insertAdjacentHTML('beforeend', townVeilHtml(b.x + b.width / 2, b.y + b.height / 2))
        const veil = root.querySelector<HTMLElement>('.tvveil')
        veil?.style.setProperty('--tz', `${P.realm.townZoomMs}ms`)
        const dive = townCam(el, 'tvdive')
        window.setTimeout(() => {
          townIn = id
          palaceOn = false
          townFresh = true
          townPick = null
          ring = ''
          paint()
          // 막은 마을 안이 밝아진 뒤 걷는다 (그 사이 지도가 비치지 않게) · 늘린 지도도 그때 제 크기로
          window.setTimeout(() => { veil?.remove(); dive?.classList.remove('tvdive') }, P.realm.townFadeMs)
        }, b !== undefined ? P.realm.townZoomMs : 0)
        return
      }
      case 'town-out': {
        const ov = root.querySelector<HTMLElement>('.townov')
        if (ov === null) { townIn = null; paint(); return }
        const from = townIn
        ov.classList.add('out')
        // 판이 멀어지며 어두워진 뒤 · 지도가 그 고을에서 물러난다 (들어갈 때의 거꾸로)
        window.setTimeout(() => {
          ov.remove(); townIn = null; paint()
          if (from !== null) townCam(root.querySelector<HTMLElement>(`.nd[data-node="${from}"]`), 'tvrise')
        }, P.realm.townFadeMs)
        return
      }
      case 'work': {
        // 고을 일터 — 한 고을에 하나만 고른다 · 다시 누르면 거둔다
        const node = d['node']!
        const what = d['what'] as WorkWhat
        // 마을 안에선 터 차례(lot)까지 — 같은 일터가 여러 터일 수 있다 (형 11-09) · 고을 판의 단추는 lot 없이 (같은 일터의 첫 터)
        const lot = d['lot'] !== undefined ? Number(d['lot']) : undefined
        const had = musters.some((o) => o.kind === 'work' && o.node === node && o.what === what && o.lot === lot)
        musters = musters.filter((o) => !(o.kind === 'work' && o.node === node))
        if (!had) musters = [...musters, { kind: 'work', faction: me(), node, what, ...(lot !== undefined ? { lot } : {}) }]
        // 마을 안의 큰 단추 — 고르면 북 · 거두면 툭 (WWE · 메모리 wwe-overreaction-ux)
        if (townIn === node) { ding(snd(had ? 'tap_cancel' : 'tap_drum'), had ? 0.4 : 0.6); buzz(had ? [20] : [12, 40, 24]) }
        break
      }
      case 'clear-lot': {
        // 터 닦기 — 한 고을 한 달 하나 · 다시 누르면 거둔다
        const node = d['node']!
        const had = musters.some((o) => o.kind === 'clearLot' && o.node === node)
        musters = musters.filter((o) => !(o.kind === 'clearLot' && o.node === node))
        if (!had) musters = [...musters, { kind: 'clearLot', faction: me(), node }]
        if (townIn === node) { ding(snd(had ? 'tap_cancel' : 'tap_drum'), had ? 0.4 : 0.6); buzz(had ? [20] : [12, 40, 24]) }
        break
      }
      // 마을 안 — 터 고르기 · 빈 터에 지을 것 고르기 (화면 고르기일 뿐 · 판은 「work」 로만)
      case 'town-lot': {
        const i = Number(d['i'])
        const lot = t.closest<HTMLElement>('.tvlot2')
        const board = t.closest<HTMLElement>('.tvboard')
        // 짓는 터를 다시 누르면(톡톡) 일꾼들이 신이 난다 — 다시 그리지 않는다 (고리·칸은 그대로)
        if (townPick?.lot === i && lot?.classList.contains('going') && board !== null) { townCheer(board, lot); ding(snd('tap_drum'), 0.45, 1.1); buzz([8]); return }
        townPick = { lot: i, what: null }
        break
      }
      case 'palace-tab': palaceOn = d['v'] === '1'; seatPick = null; break
      case 'fest-go': townIn = null; paint(); break // 제천 대회 띠 — 도읍 판을 닫고 카드로
      case 'palace-sub': palaceSub = d['v'] === 'works' ? 'works' : 'hall'; seatPick = null; break
      // 궁궐 한 번 붓기 — 한 번에 하나 · 다시 누르면 거둔다 (큰 공사와 같은 꼴)
      case 'palace': musters = musters.some((o) => o.kind === 'palace') ? musters.filter((o) => o.kind !== 'palace') : [...musters, { kind: 'palace', faction: me() }]; break
      case 'seat-open': seatPick = seatPick === d['seat'] ? null : (d['seat'] as Seat); break
      case 'seat-x': seatPick = null; break
      case 'seat-set': {
        const seat = d['seat'] as Seat
        const id = d['id']!
        // 앉히는 명령은 앞에 — 대신 뽑기 켜기(대장군이 있어야 한다)보다 먼저 적용된다
        musters = musters.filter((o) => !(o.kind === 'seat' && (o.seat === seat || o.hero === id)))
        const has = realm?.factions[me()]?.seats ?? {}
        if (has[seat] !== id) musters = [{ kind: 'seat', faction: me(), seat, hero: id }, ...musters]
        seatPick = null
        bark(id)
        break
      }
      case 'seat-clear': {
        const seat = d['seat'] as Seat
        musters = musters.filter((o) => !(o.kind === 'seat' && o.seat === seat))
        if (realm?.factions[me()]?.seats?.[seat] !== undefined) musters = [{ kind: 'seat', faction: me(), seat, hero: null }, ...musters]
        seatPick = null
        break
      }
      case 'autodraft': {
        const now = autoDraftOn(leftPlan(), me())
        musters = musters.filter((o) => o.kind !== 'autoDraft')
        if ((!now) !== autoDraftOn(realm!, me())) musters = [...musters, { kind: 'autoDraft', faction: me(), on: !now }]
        break
      }
      case 'palace-go': {
        const cap = realm?.factions[me()]?.capital
        if (cap === undefined || realm?.nodes[cap]?.owner !== me()) return
        townIn = cap; palaceOn = true; townFresh = true; townPick = null; ring = ''
        break
      }
      case 'town-what': townPick = { lot: townPick?.lot ?? 0, what: d['what'] as WorkWhat }; break
      case 'town-stamp-x': townStampOut(); return
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
        else if (plots.length < plotCap(realm!)) { plots = [...plots, k.hero !== undefined && hands[k.hero] !== undefined ? { ...o, hand: hands[k.hero]! } as Order : o]; plotAgent = null; obey(d['agent']) }
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
      case 'bust-view': openBust(d['src']!, d['loop'], d['elem']); return
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
      // 처음 회유하면 옥중 담판이 뜬다 (WOO §3 · 첫 담판이 그 사람을 읽는 자리)
      case 'persuade': heroOrders = [...heroOrders, { kind: 'persuade', hero: d['id']!, by: d['by'] ? d['by'] : null, ...(d['by'] ? { talk: [] } : {}) }]; obey(d['by']); if (d['by']) wooTalk = { id: d['id']!, sel: null, hand: false }; break
      case 'dp-talk': if (wooDone[d['id']!] === true && wooOrder(d['id']!)?.talk !== undefined) wooTalk = { id: d['id']!, sel: null, hand: true }; else openTalk(d['id']!); break
      case 'dp-sel': if (wooTalk !== null) wooTalk = { ...wooTalk, sel: wooTalk.sel === d['a'] ? null : (d['a'] as WooApproach) }; break
      case 'dp-say': {
        const w = wooTalk
        const o = w !== null ? wooOrder(w.id) : undefined
        if (w === null || o === undefined || w.sel === null || realm === null || o.by === null) break
        if (talkOver(talkRun(realm, w.id, o.by, o.talk ?? [], false), (o.talk ?? []).length)) break
        heroOrders = heroOrders.map((x) => (x === o ? { ...o, talk: [...(o.talk ?? []), w.sel!] } : x))
        wooTalk = { ...w, sel: null }
        talkSound(w.id, false)
        break
      }
      case 'dp-hand': if (wooTalk !== null && !wooTalk.hand) { wooTalk = { ...wooTalk, hand: true }; wooDone[wooTalk.id] = true; talkSound(wooTalk.id, true) } break
      case 'dp-leave': {
        // 맡긴다 — 남은 마디는 지금 엔진대로. 아직 한 마디도 안 했으면 굴림을 본 것이 없으니 담판을 거둔다
        const w = wooTalk
        const o = w !== null ? wooOrder(w.id) : undefined
        if (w === null) break
        wooDone[w.id] = true
        if (o !== undefined && (o.talk ?? []).length === 0) {
          const fresh = realm?.heroes[w.id]?.persuade === undefined
          heroOrders = fresh ? heroOrders.map((x) => (x === o ? { kind: 'persuade' as const, hero: o.hero, by: o.by } : x)) : heroOrders.filter((x) => x !== o)
        }
        wooTalk = null
        break
      }
      case 'dp-ok': if (wooTalk !== null) wooDone[wooTalk.id] = true; wooTalk = null; break
      case 'standby': standBy(d['id']!); break
      // 재상 — 쉬는 장수 모두 · 장수 하나 (형 10-26)
      case 'js-all': if (realm !== null) realm.autoIdle = d['v'] === '1'; break
      case 'js-one': setManual(d['id']!, d['v'] === 'self'); break
      case 'unhero': heroOrders = heroOrders.filter((o) => !((o.kind === 'assign' || o.kind === 'lead' || (o.kind === 'persuade' && o.talk === undefined) || o.kind === 'hire') && o.hero === d['id'])); break
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
      case 'scout': if (realm !== null) toggleScout(realm, d['node']!); break
      case 'scout-swap': swapScout(d['out']!, d['node']!); break
      case 'scout-ask-no': scoutAsk = null; break
      case 'scout-keep': { const n = d['node']!; if (scoutKeep.includes(n)) setKeep(scoutKeep.filter((x) => x !== n)); else if (realm !== null && !scouts.includes(n)) toggleScout(realm, n); else setKeep([...scoutKeep, n]); break }
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
      // 다른 판을 열었다(새 판 · 이어 하기) — 음악은 처음부터 (앞 판의 승리 음악이 멈춘 자리에서 이어 나오던 것)
      if (realm !== r) music.reset()
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
      // 진 싸움의 보고를 닫기 전에 창을 닫았다 — 다시 열어 지도로 돌아오면 띄운다 (같은 계절엔 한 번)
      lossPending = null
      lastLoss = null
      closeHowWin(root)
      queueHowWin(r !== null && b !== null && rep !== null ? lossOf(b, r, rep, r.player) : null) // 없으면 붙박이 단추도 걷는다
    },
  }
}
