/**
 * 고정 스텝 게임 루프 (ARCHITECTURE A1 결정론 · GDD 제약 C3 탭 생명주기)
 *
 * 이 파일의 책임은 셋이다.
 *  1. sim은 언제나 같은 크기의 스텝으로만 나아간다. 렌더가 30fps든 144fps든 결과는 비트 단위로 같다.
 *  2. 탭이 숨으면 **아무것도 돌지 않는다.** 형이 공부 중이다. rAF 한 개도 남기지 않는다.
 *  3. 세이브 ↔ 판을 잇는다 — 스탯이 활에 들어가고, 쏜 화살이 보유분에서 빠지고,
 *     판이 끝나면 훈련치가 들어온다. 이 배선이 없으면 성장 시스템이 물리에 아무 영향을 못 준다.
 *
 * 레이어: 이 파일은 game 이다. save/offline/progression(같은 층)과 render/input/audio(소비자 층)를
 * 직접 부르지만 **ui/ 는 import하지 않는다.** 화면에 무엇을 띄울지는 LoopUi 라는 좁은 창구로만 말한다.
 *
 * 렌더 쪽 분업: renderer.draw 안에서 pumpEvents·updateCamera·updateFx가 실시간(dtReal)으로 돈다.
 * 루프는 이벤트를 **비우는 것**만 책임진다 — scene.ts / effects.ts / audio 가 읽되 비우지 않기로 했다.
 */
import { armArrow, armBow, cancelDraw, createWorld, isSettled, sandboxAdd, requireFreshPress, resetWorld, restArcher, step } from '../sim/world.ts'
import type { ArrowKindId } from '../sim/types.ts'
import { createInput } from '../input/pointer.ts'
import { createRenderer, getCamera, getHitStopMs } from '../render/scene.ts'
import type { HudState } from '../render/hud.ts'
import { createSfx, playUi, pumpSfx, sfxMuted, toggleMute, unlockSfx, updateSfx } from '../audio/sfx.ts'
import { getStage } from './stages.ts'
import { onSaveChanged, pokeSave, writeSave, type SaveData } from './save.ts'
import { settleOffline, type OfflineGain } from './offline.ts'
import { awardRun, canGrow, grantArrows, type StatKey } from './progression.ts'
import { arrowName, DEFAULT_ARROW } from './arrows.ts'
import { bowMods, masteryLevel } from './bows.ts'
import type { LoadoutPick } from '../ui/loadout.ts'
import { rollSupply, rollSupplyCount } from './supply.ts'
import { BOSS_EVERY } from './stages.ts'
import { bullseyeAcc, gradeRun, rewardLine, type RunStats } from './rewards.ts'
import { evaluateUnlocks, progressOf, unlockedBows } from './unlocks.ts'
import { makeRng } from '../core/rng.ts'
import { P } from '../tune/params.ts'
import { clamp } from '../core/math.ts'

/**
 * 게임 루프가 UI에 요구하는 최소한. ui/ 모듈을 직접 import하지 않기 위한 좁은 창구다.
 * (레이어 방향: ui → game 이지 game → ui 가 아니다. ARCHITECTURE A1)
 */
export interface LoopUi {
  /** 화면을 덮는 패널(성장·수집·드래프트)이 열려 있는가. 열려 있는 동안 sim을 멈춘다. */
  paused(): boolean
  /**
   * 판 보상 한 줄 (별·훈련치·위업). 결과 화면을 만들지 않는다 (C1).
   * `line`은 game/rewards.ts의 rewardLine()이 만든 문장 그대로다.
   */
  runGain(line: string, leveled: readonly StatKey[]): void
  /** 자리를 비운 사이 쌓인 것. 확인 버튼 없는 자동 수령이다 (C1·C4). */
  offlineGain(gain: OfflineGain): void
  /**
   * 여정 시작 로드아웃 — 활+살통 (docs/RUN.md). **onStart는 정확히 한 번** 불러야 한다.
   * 화면을 띄우는 쪽이 패널을 열어 paused()를 true로 만들므로 그동안 sim은 멈춰 있다.
   */
  loadout(onStart: (pick: LoadoutPick) => void): void
  /** 여정 종료 — 도달 판·점수·기록·사유. onNext 한 번으로 다음 여정 준비로 간다 (C1). */
  runOver(
    reached: number, score: number, best: number, isNew: boolean, first: boolean,
    reason: 'defeat' | 'abandon' | 'death', onNext: (mode: 'again' | 'loadout') => void,
  ): void
  /** 보스 보급 (docs/RUN.md). heal>0이면 회복 카드가 추가로 선다. onPick은 정확히 한 번. */
  supply(
    offer: readonly ArrowKindId[], count: number, heal: number,
    onPick: (id: ArrowKindId | 'heal') => void,
  ): void
  /** 구석 알림 한 줄 (여정 포기 확인 등). 모달이 아니다. ms를 주면 그 시간만 산다. */
  toast(text: string, ms?: number): void
  /** 새로 열린 해금. **모달로 막지 않는다** — 구석 알림 한 줄이다 (C1). */
  unlocked(ids: readonly string[]): void
  /** 세이브의 별·진행도가 바뀌었다. 수집 화면이 다시 그린다. */
  progressed(): void
}

export interface LoopDeps {
  /** 로드된 세이브. 루프가 **제자리에서** 갱신한다 — ui도 같은 객체를 본다. */
  save: SaveData
  ui: LoopUi
}

export interface GameLoop {
  start(): void
  stop(): void
  /**
   * 소리를 끄고 켜는 좁은 창구. ui/ 가 audio/ 를 직접 import하지 않게 여기로 낸다.
   * M 키 하나뿐이면 마우스만 쓰는 사람이 소리를 못 끈다 (C5).
   */
  muted(): boolean
  toggleMute(): void
  /** 창 크기·dpr이 바뀌었다. main.ts가 부른다. */
  resize(): void
  // ── 샌드박스(실험장) — 기록의 세계 밖. ui/sandbox.ts만 부른다. ──
  sandboxEnter(): void
  sandboxExit(): void
  sandboxSpawn(kind: string): void
  sandboxRefill(): void
  /** 1부터 세는 판 번호로 실제 여정을 옮긴다 (개발 확인용 지름길). */
  sandboxJump(no: number): void
  dispose(): void
}

/** 판이 끝났을 때 아래 한 줄. 매 프레임 문자열을 만들지 않으려고 모듈 상수로 둔다 (A5). */
const HINT_NEXT = '당기면 다음 판'
/** 다음 판이 귀신(보스)일 때의 예고 — 긴장은 예고에서 시작된다 (감사 재미 P1). */
const HINT_BOSS = '다음은 귀신이다 — 당기면 맞선다'
/** R 한 번으로 여정을 접으면 실수 한 번이 기록을 지운다. 두 번째 R까지의 유효 시간 (ms). */
const ABANDON_MS = 2500

/**
 * 진행도 상한. 무한 구간이라 게임에는 끝이 없지만, 손상된 세이브가 1e9 을 들고 오면
 * endless.ts 가 그 판을 구우려다 이상한 좌표를 낸다. 사람이 닿을 수 없는 자리에 빗장만 둔다.
 */
const MAX_STAGE_INDEX = 9999

/** 판 결과 스크래치. 판마다 객체를 새로 만들 이유가 없다 (A5). */
const RUN = { cleared: false, score: 0, accuracy: 0, arrowsUsed: 0, hits: 0 }

/** 채점용 스크래치. 위와 같은 이유로 하나만 만들어 제자리에서 갱신한다. */
const GRADE: RunStats = {
  cleared: false,
  score: 0,
  arrowsUsed: 0,
  arrowsGiven: 0,
  hits: 0,
  shots: 0,
  misses: 0,
  bestChain: 0,
  bullseyes: 0,
}

export function createLoop(canvas: HTMLCanvasElement, deps: LoopDeps): GameLoop {
  const { save, ui } = deps

  /**
   * 실제로 판이 돌아간 실시간 (ms). 오프라인 축적에서 빼야 할 시간이다.
   * 이게 없으면 게임을 하는 동안에도 자원이 쌓여 두 배로 들어온다.
   */
  let playedMs = 0

  /**
   * 자리를 비운 시간을 자원으로 바꾼다. **lastSeen을 옮기는 유일한 경로다** (save.ts 참조).
   *
   * 탭이 보이는 채로 흐른 시간도 자리를 비운 시간이다 — 이 게임의 대표 사용법이
   * "공부 화면 옆에 띄워둔다"이고, visibilitychange가 아예 안 뜨는 환경이 흔하다.
   * 그래서 흐른 시간 전체에서 **실제로 논 시간(playedMs)만** 빼고 나머지를 축적으로 돌린다.
   */
  const settle = (): void => {
    save.lastSeen += playedMs
    playedMs = 0
    const n = Date.now()
    // 논 시간이 흐른 시간보다 길게 잡혔거나(탭 복귀 보정) 시계가 튀었다. 미래로는 못 간다.
    if (save.lastSeen > n) save.lastSeen = n
    ui.offlineGain(settleOffline(save, n))
  }

  // 켜자마자 정산한다. World가 만들어지기 전이어야 오프라인으로 오른 스탯·화살이 첫 판에 들어간다.
  settle()

  const renderer = createRenderer(canvas)
  const input = createInput(canvas, getCamera(renderer))
  const sfx = createSfx()

  // 손상된 세이브가 말도 안 되는 진행도를 들고 와도 게임이 죽지 않게만 자른다.
  // ★ 상한을 STAGES.length 로 잡지 않는다 — 41판부터는 endless.ts 가 판을 굽는다.
  let stageIndex = clamp(Math.floor(save.stageIndex), 0, MAX_STAGE_INDEX)
  save.stageIndex = stageIndex
  // World는 하나만 만들고 끝까지 재사용한다. 판마다 새로 만들면 프레임당 할당 0이 깨진다 (A5).
  const w = createWorld(getStage(stageIndex), save.stats, DEFAULT_ARROW)

  /**
   * 드래프트와 변동 보상이 쓰는 난수. **sim의 w.rng와 완전히 분리돼 있다** —
   * 여기서 w.rng를 한 칸이라도 밀면 같은 시드의 같은 판이 다른 판이 된다 (A1, draft.ts 주석).
   * 상태는 세이브에 남아 판마다 앞으로 나아간다: 같은 판을 다시 깨도 보너스가 되풀이되지 않는다.
   */
  if (save.runSeed === 0) save.runSeed = (Date.now() ^ 0x9e3779b9) >>> 0
  const runRng = makeRng(save.runSeed)

  /**
   * 장전·활의 즉시 반영 (형: "클릭한 걸 지금 당장 들고 있어야지").
   *
   * 살통 버튼·활 걸이는 세이브만 고치고 통지한다 — 여기가 그 통지를 받아 sim에 옮긴다.
   * 이미 날아간 화살은 발사 때 굳힌 자기 fx로 날므로(A1, Arrow.kind) 공중에서 변하지 않는다.
   */
  const rearm = (): void => {
    let kind = save.runArrow
    if (kind !== DEFAULT_ARROW && Math.floor(save.arrowStock[kind] ?? 0) <= 0) kind = DEFAULT_ARROW
    if (w.arrowKind !== kind) armArrow(w, kind)
    // 재고는 조준 시야(좌상단)에서 읽혀야 한다 — 좌하단 버튼까지 시선을 보내게 하지 않는다 (감사).
    hud.arrow = kind === DEFAULT_ARROW
      ? ''
      : `${arrowName(kind)} ×${Math.floor(save.arrowStock[kind] ?? 0)}`
    armBow(w, bowMods(save.bow, kind, masteryLevel(save.bowHits[save.bow] ?? 0)))
    w.bowSkin = save.bow
  }
  const unRearm = onSaveChanged(rearm)

  // 매 프레임 제자리에서 갱신한다. 새로 만들지 않는다 (A5).
  const hud: HudState = { training: 0, canLevelUp: false, muted: false, toast: '', arrow: '', stars: -1, endReason: '' }

  let raf = 0
  /** 샌드박스(실험장) — 기록의 세계 밖이다. 정산·해금·여정 종료가 전부 멈춘다. */
  let sandbox = false
  /** 첫 R을 누른 시각 (performance.now). 두 번째 R이 ABANDON_MS 안에 오면 여정을 접는다. */
  let abandonArm = 0
  let wanted = false // start()가 불렸는가 — 사용자 의도. 탭 가시성과는 별개로 기억한다.
  let last = 0
  let acc = 0
  let prevDrawing = false
  let paused = false

  // ── 판 단위 집계 ──
  /** 이번 판에 실제로 지급된 화살. stage.arrows 가 아니라 보유분에 따라 줄 수 있다. */
  let granted = 0
  /** 이번 판의 명중 수 (hit 이벤트). 정확도 보상의 분자다. */
  let hits = 0
  /** 아무것도 못 맞히고 사라진 화살 수. ★★★(무손실)의 유일한 근거다. */
  let misses = 0
  /** 정중앙 명중 수 (명중도 ≥ P.hit.bullseyeAcc). 해금 조건이 읽는다. */
  let bullseyes = 0
  /** 이 판에서 이어간 최고 연쇄 수. w.combo의 봉우리를 스텝마다 집는다. */
  let bestChain = 0
  /** 이번 판의 보상을 이미 줬는가. 종료는 한 번만 정산한다. */
  let awarded = false
  /** 이 판의 화살 종류. 드래프트가 정한다. */
  let arrow: ArrowKindId = DEFAULT_ARROW
  /** 드래프트 화면이 떠 있어 아직 판이 시작되지 않았다. 이 동안 판 넘김 입력을 무시한다. */
  let choosing = false

  /** 세이브의 스탯을 활에 넣는다. 이게 없으면 성장이 물리에 아무 영향을 못 준다. */
  const applyStats = (): void => {
    w.stats.str = save.stats.str
    w.stats.steady = save.stats.steady
    w.stats.stamina = save.stats.stamina
    w.stats.focus = save.stats.focus
  }

  /** 세이브에서 오는 HUD 값. 매 프레임이 아니라 세이브가 바뀔 때만 갱신한다 (A5). */
  const syncHud = (): void => {
    hud.training = save.training
    hud.canLevelUp = canGrow(save)
  }

  /** M2 저장 훅. 저장 시점은 탭 이탈과 판 종료뿐이다. 주기적 저장 타이머는 금지 (A3). */
  const saveNow = (): void => {
    writeSave(save)
  }

  const loadStage = (requested: ArrowKindId): void => {
    // ── 장전 (docs/RUN.md 4장) ──
    // 든 살은 판을 넘어도 그대로다 (형: "변경한 걸 그대로 들고 있어야지").
    // 소모는 여기가 아니라 **쏠 때 발당 1**이다 (tick의 release 처리). 재고가 없으면 유엽전.
    let kind = requested
    if (kind !== DEFAULT_ARROW && Math.floor(save.arrowStock[kind] ?? 0) <= 0) kind = DEFAULT_ARROW
    save.runArrow = kind
    // 정산 전에 판을 갈아엎으면 보상이 통째로 사라진다. 아직 안 줬으면 여기서 준다.
    // (isSettled를 기다리는 동안 사용자가 다음 판으로 넘기는 경로가 실제로 존재한다.)
    if (!awarded && w.status !== 'playing') {
      awarded = true
      finishRun()
    }
    arrow = kind
    let stage = getStage(stageIndex)
    // 첫 손님 — 아직 한 발도 안 쏜 사람에게는 판 자막이 조작법이어야 한다 (C1: 3초 안에 첫 발).
    if (save.totalShots === 0) {
      stage = { ...stage, hint: '꾹 눌러 시위를 당기고 · 놓아서 쏜다' }
    }
    // 활도 판 경계에서만 (A1). 숙련은 그 활로 맞힌 누적 수에서 나온다 — docs/BOWS.md 3장.
    // 궁합(활×살)은 bowMods 안에서 판정되므로 여기서는 조합을 모른다.
    const mods = bowMods(save.bow, kind, masteryLevel(save.bowHits[save.bow] ?? 0))
    resetWorld(w, stage, save.stats, kind, mods)
    // 겉모습은 렌더 전용이다. 스틱맨의 손에 들린 활이 실제로 바뀐 활로 보여야 한다.
    w.bowSkin = save.bow
    // 체력은 여정 동안 이어진다 (docs/RUN.md 6장). 판마다 회복되면 피해가 숫자 놀음이 된다.
    w.hp = Math.max(1, Math.min(Math.floor(P.enemy.hpMax), save.runHp))
    // 지급량은 game 레이어의 경제 판단이라 sim 계약(resetWorld)에 넣지 않고 여기서 덮어쓴다.
    // 풀 크기는 stage.arrows 기준으로 이미 잡혀 있으므로 줄이는 쪽은 언제나 안전하다.
    granted = grantArrows(save, stage)
    w.arrowsLeft = granted
    hits = 0
    misses = 0
    bullseyes = 0
    bestChain = 0
    awarded = false
    acc = 0
    // 새 판의 결과는 아직 없다. -1 = 채점 전 (HUD가 별 줄을 안 그린다).
    hud.stars = -1
    // 기본 살은 이름을 띄우지 않는다 — 효과가 없는 걸 알릴 이유가 없고, HUD는 최소한만이다.
    hud.arrow = kind === DEFAULT_ARROW ? '' : arrowName(kind)
    save.stageIndex = stageIndex
    // 판을 넘긴 그 눌림이 다음 판의 첫 발까지 이어지지 않게 에지를 소진시킨다.
    // 루프 쪽 에지만 소진하면 InputFrame.drawing 이 아직 true라 다음 스텝에 시위가 잡힌다 —
    // 궁수도 "한 번 떼야 잡히는" 상태로 같이 넘겨야 화살을 안 잃는다 (C1).
    prevDrawing = input.frame.drawing
    if (prevDrawing) requireFreshPress(w)
    saveNow()
  }

  /**
   * 판을 시작한다 (docs/RUN.md).
   *
   * 여정이 진행 중이면 그 여정의 살통으로 바로 다음 판이다 — 판 사이에 아무 화면도 없다 (C1).
   * 여정이 없으면(첫 시작·패배 직후) 로드아웃이 한 번 낀다: 활+살통을 골라 새 여정을 연다.
   * 판마다 3택을 강요하던 옛 드래프트는 여기서 사라졌다 — "과녁이 화살보다 많으면
   * 사실상 1택"(형의 반려). 선택은 판 단위가 아니라 **여정 단위**다.
   */
  const startRun = (bow: typeof save.bow): void => {
    save.bow = bow
    save.runActive = true
    save.runScore = 0
    stageIndex = 0
    loadStage(save.runArrow)
  }

  const beginStage = (): void => {
    if (save.runActive) {
      loadStage(save.runArrow)
      return
    }
    // 활이 연습궁뿐이면 고를 것이 없다 — 1택짜리 출정 화면은 이 게임 스스로 반려한
    // 문법이다 (감사 시작경험 P1). 첫 인터랙션은 화면이 아니라 **쏘기**다.
    if (unlockedBows(save.unlocked).length === 0) {
      startRun('practice')
      return
    }
    choosing = true
    ui.loadout((pick) => {
      choosing = false
      // 고른 순간의 소리. ui/ 는 audio/ 를 직접 import하지 않기로 했으므로(레이어 방향)
      // 화면이 아니라 여기서 낸다 — 어차피 콜백이 정확히 한 번 오는 자리다.
      playUi(sfx, 'press')
      startRun(pick.bow)
    })
  }

  /**
   * 여정이 끝났다 (화살 소진 또는 포기). 기록을 갱신하고 종료 화면을 띄운다.
   * 기록은 **줄지 않는다** — 최고 도달 판, 그 여정의 점수.
   */

  /** 실험장 판 — 먼 구석의 더미 하나(빈 판 즉시 클리어 방지)와 넉넉한 화살. */
  const SANDBOX_STAGE = {
    id: 'sandbox',
    title: '샌드박스',
    hint: '실험장 — 기록에 남지 않는다',
    seed: 0x0e0e,
    arrows: 12,
    targetScore: 999999,
    wind: 0,
    targets: [{ kind: 'static' as const, x: 47, y: 8.6, r: 0.25, score: 0 }],
  }

  const loadSandbox = (): void => {
    const mods = bowMods(save.bow, save.runArrow, masteryLevel(save.bowHits[save.bow] ?? 0))
    resetWorld(w, SANDBOX_STAGE, save.stats, save.runArrow, mods)
    w.bowSkin = save.bow
    w.hp = Math.floor(P.enemy.hpMax)
    w.arrowsLeft = 12
    hud.stars = -1
    hud.endReason = ''
    prevDrawing = input.frame.drawing
    if (prevDrawing) requireFreshPress(w)
  }

  const endRun = (reason: 'defeat' | 'abandon' | 'death'): void => {
    const reached = stageIndex + 1
    // 생애 첫 여정은 '경신'이 아니라 기준점이다 — 1판 실패를 축하하면 말의 무게가 죽는다 (감사).
    const first = save.runCount === 0
    const isNew = !first && reached > save.bestRunStage
    if (isNew) {
      save.bestRunStage = reached
      save.bestRunScore = save.runScore
    }
    save.runCount++
    save.runActive = false
    stageIndex = 0
    save.stageIndex = 0
    // 다음 여정은 가득 찬 채로 시작한다.
    save.runHp = Math.floor(P.enemy.hpMax)
    saveNow()
    choosing = true
    ui.runOver(reached, save.runScore, save.bestRunStage, isNew, first, reason, (mode) => {
      choosing = false
      // '같은 활로 다시' — 종료 화면에서 바로 출정한다. 재도전의 마찰은 클릭 하나면 족하다 (감사).
      if (mode === 'again') startRun(save.bow)
      else beginStage()
    })
  }

  /**
   * 판이 끝났다. 채점 → 훈련치·화살 정산 → 별·누적 기록 → 해금 판정, 이 순서다.
   *
   * 순서가 결과를 바꾼다: awardRun의 '첫 클리어' 판정이 **아직 갱신되지 않은** 별을 읽어야
   * 하고, 해금 판정은 **갱신된** 기록을 읽어야 한다. 사이에 별 갱신이 들어가는 이유다.
   *
   * 화살 소모는 진입 과금이 아니라 **실제로 쏜 만큼**이다 — 켜놓고 자리를 뜬 사람이 손해를
   * 보면 C2 위반이다.
   */
  const finishRun = (): void => {
    const used = granted - w.arrowsLeft
    const shot = used > 0 ? used : 0
    const cleared = w.status === 'cleared'

    GRADE.cleared = cleared
    GRADE.score = w.score
    GRADE.arrowsUsed = shot
    GRADE.arrowsGiven = granted
    GRADE.hits = hits
    GRADE.shots = shot
    GRADE.misses = misses
    GRADE.bestChain = bestChain
    GRADE.bullseyes = bullseyes
    const reward = gradeRun(runRng, w.stage, GRADE)
    save.runSeed = runRng.state()
    // 화면에도 별을 보낸다. 예전엔 세이브에만 적히고 화면에는 안 왔다 —
    // "별로 클리어 수준을 정해놓을 거면 별도 보여줘야지"(형).
    hud.stars = reward.stars
    hud.endReason = cleared ? '' : w.hp <= 0 ? 'death' : 'defeat'

    RUN.cleared = cleared
    RUN.score = w.score
    RUN.accuracy = shot > 0 ? (shot - misses) / shot : 0
    RUN.arrowsUsed = shot
    RUN.hits = hits
    const gain = awardRun(save, w.stage, RUN, reward)

    // 별은 **줄지 않는다.** 다시 해서 못 받아도 가진 별은 남는다 (성장은 되돌아가지 않는다).
    const id = w.stage.id
    const had = save.stars[id] ?? 0
    if (reward.stars > had) save.stars[id] = reward.stars
    if (bestChain > save.bestChain) save.bestChain = bestChain
    save.bullseyes += bullseyes
    // 보스 처치 — 활 해금의 유일한 재료 (docs/RUN.md). 해금 판정보다 먼저 세야 그 자리에서 열린다.
    if (cleared && w.stage.targets.some((t) => t.kind === 'boss')) save.bossKills++
    // 활 숙련의 재료. 판이 끝날 때 한 번에 — 매 명중마다 세이브 객체를 만지지 않는다.
    save.bowHits[save.bow] = (save.bowHits[save.bow] ?? 0) + hits
    if (reward.stars >= 3) save.perfectRuns++

    const fresh = evaluateUnlocks(progressOf(save), save.unlocked)
    for (let i = 0; i < fresh.length; i++) {
      const uid = fresh[i]
      if (uid !== undefined) save.unlocked.push(uid)
    }

    // 여정 점수 — 판별 점수의 합. 종료 화면과 최고 기록이 이 값을 쓴다 (docs/RUN.md).
    save.runScore += w.score

    saveNow()
    ui.progressed()
    // 별·위업까지 한 줄로. 결과 화면에 가두지 않는다 (C1).
    ui.runGain(rewardLine(reward), gain.leveled)
    if (fresh.length > 0) {
      ui.unlocked(fresh)
      playUi(sfx, 'unlock')
    }

    // ── 보스 보급 (docs/RUN.md · game/supply.ts) ──
    // 보스를 잡으면 3택 — 특수살 재고의 유일한 큰 획득처다. 몇 번째 보스인가가 풀을 정한다.
    if (cleared && w.stage.targets.some((t) => t.kind === 'boss')) {
      const cycle = Math.max(1, Math.floor((stageIndex + 1) / BOSS_EVERY))
      const offer = rollSupply(runRng, cycle)
      const bundle = rollSupplyCount(runRng)
      save.runSeed = runRng.state()
      // 잃은 체력이 있으면 회복 카드가 선다 — 체력을 되찾는 유일한 길 (형의 주문).
      const hpMax2 = Math.floor(P.enemy.hpMax)
      const heal = save.runHp < hpMax2 ? Math.floor(P.enemy.healReward) : 0
      choosing = true
      ui.supply(offer, bundle, heal, (id) => {
        choosing = false
        playUi(sfx, 'press')
        if (id === 'heal') {
          save.runHp = Math.min(hpMax2, save.runHp + heal)
          w.hp = save.runHp
          ui.toast(`숨을 골랐다 — 기력 +${heal}`, 2200)
        } else {
          save.arrowStock[id] = Math.floor(save.arrowStock[id] ?? 0) + bundle
        }
        saveNow()
      })
    }

    // 체력은 다음 판으로 이어진다. 죽었으면(0) endRun이 처리한다.
    save.runHp = Math.max(0, w.hp)

    // ★ 패배 = 여정 종료 (docs/RUN.md). 화살이 바닥났거나(defeat) 쓰러졌다(death).
    // 보상 정산(위) 뒤에 와야 마지막 판의 별·훈련치를 잃지 않는다.
    if (!cleared) endRun(w.hp <= 0 ? 'death' : 'defeat')
  }

  const tick = (now: number): void => {
    raf = 0
    // 숨은 탭에서는 다음 프레임을 예약하지 않는다 (제약 C3). 이 게임의 최우선 규칙이다.
    if (!wanted || document.hidden) return
    // 본문보다 먼저 예약해 둔다. 렌더에서 예외가 나도 루프가 통째로 죽지는 않게.
    raf = requestAnimationFrame(tick)

    const realDt = last === 0 ? 0 : (now - last) / 1000
    last = now

    // 성장 화면이 열려 있으면 sim을 세운다. 읽는 동안 스태미나가 빠지거나 판이 끝나면 배신이다.
    const wantPause = ui.paused()
    if (wantPause !== paused) {
      paused = wantPause
      // 패널을 여는 순간 당기던 시위는 발사 없이 되돌린다 (C2와 같은 이유).
      if (paused) cancelDraw(w)
      acc = 0
    }

    if (paused) {
      // 패널 뒤에서 눌렸다 떼인 것으로 오해해 다음 판으로 넘어가면 안 된다.
      prevDrawing = input.frame.drawing
    } else if (
      getHitStopMs(renderer) > 0 &&
      // **손을 뗀 동안에만 멈춘다.** 화살은 0.23초면 과녁에 닿는데 사람은 발사 직후 바로
      // 다음 발을 당기기 시작하므로(당김 0.38초), 명중은 거의 매번 다음 당김 도중에 터진다.
      // 거기서 sim을 세우면 시위가 42~130ms 얼어붙어 놓은 프레임에 화살이 안 나간다 (feel-lens 1).
      // 결정론은 그대로다 — 스텝 자체는 같고 실시간 배치만 달라진다.
      w.archer.phase !== 'drawing' &&
      w.archer.phase !== 'full'
    ) {
      // 히트스톱: sim만 멈추고 렌더는 계속 돈다.
      // 멈춘 동안 시간을 쌓지 않는다. 쌓으면 풀리는 순간 sim이 순간이동한다.
      acc = 0
    } else {
      const maxFrame = w.dt * P.sim.maxCatchUpSteps
      // 탭 복귀·긴 GC로 realDt가 튀어도 여기서 잘린다.
      acc += realDt < maxFrame ? realDt : maxFrame

      let steps = 0
      while (acc >= w.dt && steps < P.sim.maxCatchUpSteps) {
        step(w, input.frame)
        // 콤보의 봉우리는 **스텝마다** 집는다. 프레임 끝에서 한 번 보면 같은 프레임 안에서
        // 연쇄가 이어졌다 끊긴(miss) 경우의 최댓값을 통째로 놓친다.
        if (w.combo > bestChain) bestChain = w.combo
        // 스텝 경계를 입력에 알린다. 한 프레임 안에서 눌렀다 뗀 짧은 클릭이
        // 통째로 삼켜지지 않게 하는 래치가 여기서 풀린다 (pointer.ts).
        input.endStep()
        acc -= w.dt
        steps++
      }
      // 따라잡기 포기. 느린 기기에서 매 프레임 빚이 불어나는 나선형 죽음을 끊는다.
      if (steps >= P.sim.maxCatchUpSteps) acc = 0
      // 판이 실제로 돌아간 시간만 센다. 결과 화면에 멈춰 있거나 패널을 열어둔 시간은
      // 자리를 비운 것과 다르지 않으므로 축적으로 넘긴다.
      if (w.status === 'playing') playedMs += realDt * 1000
    }

    // 이번 프레임에 쌓인 판 기록을 센다. 소리·이펙트와 같은 배열을 읽되 비우지 않는다 —
    // 비우는 건 이 함수의 맨 끝이다.
    for (let i = 0; i < w.events.length; i++) {
      const ev = w.events[i]
      if (ev === undefined) continue
      if (ev.t === 'release') {
        // ── 특수살 소모 — 쏜 발만큼 (docs/RUN.md 4장) ──
        // 분열 자식·사슬 도약은 release가 아니라 여기 안 걸린다. 이 발의 결과물이니까.
        const kind = w.arrowKind
        if (kind !== DEFAULT_ARROW) {
          const left = Math.floor(save.arrowStock[kind] ?? 0) - 1
          save.arrowStock[kind] = left > 0 ? left : 0
          if (left <= 0) {
            // 살통이 비었다 — 유엽전으로 바꿔 든다. 다음 발이 조용히 증발하면 배신이다.
            save.runArrow = DEFAULT_ARROW
            armArrow(w, DEFAULT_ARROW)
            ui.toast('살통이 비었다 — 유엽전으로', 2200)
          }
          // 저장은 하지 않는다 (A3: 판 종료·탭 이탈뿐). 화면(살통 버튼)만 깨운다.
          pokeSave(save)
        }
      } else if (ev.t === 'hit') {
        hits++
        // 적 몸통 명중은 '정중앙'이 아니다 — 과녁의 정중앙과 적의 헤드샷만 집계한다.
        if ((!ev.foe && ev.accuracy >= bullseyeAcc()) || ev.head) bullseyes++
      } else if (ev.t === 'miss') {
        // 아무것도 못 맞히고 사라진 화살. ballistics가 이때만 miss를 뱉는다 —
        // 셋을 꿰뚫고 착지한 화살도, 분열 자식의 낙하도 여기 안 걸린다 (축은 '쏜 발'이다).
        misses++
      }
    }

    // 종료는 한 번만 정산한다. 그리고 **결과가 더 뒤집힐 여지가 없을 때까지 기다린다** —
    // 클리어는 마지막 과녁이 쓰러진 그 스텝에 즉시 판정되지만, 그 뒤로도 날아가던 화살과
    // 낙하 중인 공중 과녁이 연쇄로 점수를 더 올린다. status 전이 프레임에 스냅샷을 뜨면
    // 1-10의 연쇄 점수가 통째로 기록에서 빠진다 (화면 756점, 저장 452점).
    if (!awarded && w.status !== 'playing' && isSettled(w)) {
      if (sandbox) {
        // 실험장 — 정산 없이 판만 새로 편다.
        loadSandbox()
      } else {
        awarded = true
        finishRun()
      }
    }

    // 에지는 멈춰 있어도 소진한다. 안 그러면 패널을 닫는 순간 아까 누른 R이 뒤늦게 터진다.
    // R = **여정 포기** (docs/RUN.md). 로그라이크에서 판 재시도는 치트라 재시작 키는 없다.
    // 실수 한 번이 기록을 지우면 안 되니 두 번째 R까지 ABANDON_MS 안에 눌러야 한다.
    if (input.takeRestart() && !paused && !choosing && w.status === 'playing') {
      const now = performance.now()
      if (now - abandonArm < ABANDON_MS) {
        abandonArm = 0
        cancelDraw(w)
        endRun('abandon')
      } else {
        abandonArm = now
        // 토스트 수명 = 무장 시간. 안내가 상태보다 오래 살면 거짓말이 된다 (감사 UI P1).
        ui.toast('R 한 번 더 — 이 여정을 접는다', ABANDON_MS)
      }
    }

    // 결과 화면에 가두지 않는다 (제약 C1). 다시 누르는 순간 바로 다음 판. 확인 버튼 없음.
    const drawingNow = input.frame.drawing
    if (!paused && !choosing && w.status !== 'playing' && drawingNow && !prevDrawing) {
      // 클리어면 다음 판. ★ 40판이 끝나도 멈추지 않는다 — endless.ts 가 계속 구워 준다.
      // 패배면 정산이 끝나기를 기다리지 않고 여기서 정산한다 — endRun까지 finishRun이 한다.
      if (w.status === 'cleared') {
        if (stageIndex < MAX_STAGE_INDEX) stageIndex++
        beginStage()
      } else if (!awarded) {
        awarded = true
        finishRun()
      }
    } else if (!paused) {
      prevDrawing = drawingNow
    }

    hud.muted = sfxMuted(sfx)
    hud.toast = w.status === 'cleared'
      ? ((stageIndex + 2) % BOSS_EVERY === 0 ? HINT_BOSS : HINT_NEXT)
      : ''

    // draw 안에서 이펙트·카메라가 이번 프레임의 이벤트를 읽는다.
    // 그래서 명중 반응이 한 프레임도 늦지 않는다 (feel-lens 4항).
    try {
      // 소리가 죽어도 화면은 계속 돌아야 한다. WebAudio는 기기마다 실패 방식이 다르다.
      try {
        pumpSfx(sfx, w)
        updateSfx(sfx, w, realDt)
      } catch {
        /* 이번 프레임 소리를 포기할 뿐이다 */
      }
      renderer.draw(w, acc / w.dt, realDt, hud)
    } finally {
      // 읽고 나면 루프가 비운다. 소비자가 비우면 두 번째 소비자가 굶는다.
      // draw가 던져도 반드시 비운다 — 안 비우면 pumpEvents가 매 tick 누적분을 통째로
      // 재처리해 파티클 스폰이 눈덩이가 되고, 보이는 탭에서 CPU가 폭주한다 (C3).
      w.events.length = 0
    }
  }

  const schedule = (): void => {
    if (raf !== 0 || !wanted || document.hidden) return
    // 복귀 첫 프레임의 realDt를 0으로 만든다. 자리를 비운 실시간을 sim으로 몰아 돌리지 않는다 (A3).
    last = 0
    acc = 0
    raf = requestAnimationFrame(tick)
  }

  const halt = (): void => {
    if (raf !== 0) {
      cancelAnimationFrame(raf)
      raf = 0
    }
    last = 0
    acc = 0
  }

  const onHidden = (): void => {
    // 당기던 중이었으면 발사 없이 되돌린다. 복귀 첫 스텝이 화살을 태우면 C2 위반이다.
    cancelDraw(w)
    halt()
    // 숨기 직전까지 흘러 있던 방치 시간을 먼저 자원으로 바꾼다. 정산 없이 저장만 하면
    // 그 구간이 어디에도 안 남는다 (settle이 lastSeen을 옮기는 유일한 경로이므로).
    settle()
    saveNow()
  }

  const onVisibility = (): void => {
    if (document.hidden) onHidden()
    else {
      // 자리를 비운 동안 쌓인 것을 먼저 받는다 (A3). 시뮬레이션을 몰아 돌리지 않고 산수로만 정산한다.
      settle()
      // 자리를 비운 동안 팔은 쉬었다. 복귀 첫 클릭이 스태미나 부족으로 삼켜지면
      // "복귀 3초 안에 첫 발"(C1)이 깨진다.
      restArcher(w)
      schedule()
    }
  }

  /**
   * 자동재생 정책상 사용자 제스처 한 번 전에는 어떤 소리도 못 낸다.
   * 첫 눌림에서만 열고 스스로 사라진다. (M 키 토글은 audio/sfx.ts가 직접 듣는다 — 여기 중복 금지)
   */
  const onFirstGesture = (): void => {
    unlockSfx(sfx)
    canvas.removeEventListener('pointerdown', onFirstGesture)
    window.removeEventListener('keydown', onFirstGesture)
  }

  // 세이브가 바뀌면(판 보상·오프라인 정산·성장 화면) 스탯과 HUD를 맞춘다.
  // 매 프레임 폴링하지 않기 위한 유일한 장치다.
  const unsubscribe = onSaveChanged(() => {
    // 판 도중 스탯이 오르는 건 사용자가 직접 성장 화면에서 누른 결과다. 즉시 반영해야
    // "올렸는데 활이 그대로다"가 안 된다. (리플레이 녹화가 붙으면 입력 이벤트로 기록해야 한다.)
    applyStats()
    syncHud()
  })

  applyStats()
  syncHud()
  // 첫 판의 지급량·집계를 세운다. createWorld는 stage.arrows를 그대로 넣어두기 때문이다.
  // (start()에서 beginStage가 다시 세우지만, 그 전에 한 프레임이라도 그려질 수 있다.)
  granted = grantArrows(save, w.stage)
  w.arrowsLeft = granted
  hud.arrow = arrow === DEFAULT_ARROW ? '' : arrowName(arrow)

  /** 이 세션에서 판을 한 번이라도 시작했는가. 첫 start()에서만 드래프트를 연다. */
  let opened = false

  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pagehide', onHidden)
  canvas.addEventListener('pointerdown', onFirstGesture)
  window.addEventListener('keydown', onFirstGesture)

  return {
    start(): void {
      wanted = true
      // 켜자마자 3택. HOOK.md 3장의 루프가 "탭 복귀 → 드래프트 → 한 판"이다.
      // 해금이 없으면 draftNeeded가 false라 화면이 아예 안 뜬다 — 새 사람은 곧바로 판이다 (C1).
      if (!opened) {
        opened = true
        beginStage()
      }
      schedule()
    },
    stop(): void {
      wanted = false
      halt()
    },
    muted(): boolean {
      return sfxMuted(sfx)
    },
    toggleMute(): void {
      toggleMute(sfx)
      hud.muted = sfxMuted(sfx)
    },
    resize(): void {
      // 매 프레임 부르면 안 된다 — 렌더러가 배경 그라디언트를 다시 만든다 (A5 할당 0).
      renderer.resize()
    },
    sandboxEnter(): void {
      if (sandbox) return
      sandbox = true
      loadSandbox()
    },
    sandboxExit(): void {
      if (!sandbox) return
      sandbox = false
      // 하던 여정의 그 판으로 돌아간다. 여정이 없었으면 출정 화면으로.
      if (save.runActive) loadStage(save.runArrow)
      else beginStage()
    },
    sandboxSpawn(kind: string): void {
      if (!sandbox) return
      // 게임 레이어라 Math.random 허용 — 실험장은 결정론의 세계 밖이다.
      const rx2 = 14 + Math.random() * 22
      const ry2 = 1 + Math.random() * 4
      if (kind === 'boss-0' || kind === 'boss-1' || kind === 'boss-2' || kind === 'boss-3') {
        const look = Number(kind.slice(5))
        sandboxAdd(w, {
          kind: 'boss', x: 34, y: 2.6, r: look === 2 ? 1.15 : 1.6,
          hp: look === 1 ? Math.floor(P.target.bossCritDmg) * 2 : Math.floor(P.target.bossHp),
          armored: look === 1, look, speed: look === 3 ? P.target.bossSpeed * 2.2 : P.target.bossSpeed,
          score: 150,
        })
      } else if (kind === 'archer' || kind === 'archer-armored') {
        sandboxAdd(w, {
          kind: 'archer', x: rx2 + 6, y: 0.72, r: 0.65,
          hp: Math.floor(P.enemy.archerHp), armored: kind === 'archer-armored',
          fireDelay: 2.5, score: 100,
        })
      } else if (kind === 'charger') {
        sandboxAdd(w, { kind: 'charger', x: 34, y: 1.5, r: 0.6, score: 50 })
      } else if (kind === 'moving') {
        sandboxAdd(w, { kind: 'moving', x: rx2, y: 2 + ry2 * 0.4, r: 0.55, ampY: 1.2, freq: 0.3, score: 100 })
      } else if (kind === 'aerial') {
        sandboxAdd(w, { kind: 'aerial', x: rx2, y: 4.5 + ry2 * 0.5, r: 0.55, score: 100 })
      } else if (kind === 'window' || kind === 'peek' || kind === 'drone') {
        // 11판+ 전환 변종들 (stages.ts convertToFoes와 같은 문법).
        const look = kind === 'window' ? 1 : kind === 'peek' ? 2 : 3
        sandboxAdd(w, {
          kind: 'archer', look, x: rx2 + 4, y: look === 3 ? 5 + ry2 * 0.4 : 2.5 + ry2 * 0.5,
          r: look === 3 ? 0.6 : 0.63, hp: Math.floor(P.enemy.convertHp),
          fireDelay: 3, firePeriod: P.enemy.shootEvery,
          ampX: look === 3 ? 1.4 : 0, freq: look === 3 ? 0.18 : 0, score: 120,
        })
      } else if (kind === 'bonus-heal') {
        sandboxAdd(w, { kind: 'bonus', x: rx2, y: 3 + ry2 * 0.5, r: 0.7, heal: 20, score: 50 })
      } else if (kind === 'bonus') {
        sandboxAdd(w, { kind: 'bonus', x: rx2, y: 3 + ry2 * 0.5, r: 0.7, give: 2, score: 50 })
      } else {
        sandboxAdd(w, { kind: 'static', x: rx2, y: 1 + ry2 * 0.6, r: 0.55, score: 100 })
      }
    },
    sandboxRefill(): void {
      if (!sandbox) return
      w.arrowsLeft += 10
      w.hp = Math.floor(P.enemy.hpMax)
    },
    sandboxJump(no: number): void {
      // 실제 여정 이동 — 개발 중 수십 판을 깨러 가지 않기 위한 문 (형의 주문).
      sandbox = false
      stageIndex = Math.max(0, Math.floor(no) - 1)
      save.runActive = true
      loadStage(save.runArrow)
    },
    dispose(): void {
      unRearm()
      wanted = false
      halt()
      unsubscribe()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onHidden)
      canvas.removeEventListener('pointerdown', onFirstGesture)
      window.removeEventListener('keydown', onFirstGesture)
      sfx.dispose()
      input.dispose()
      renderer.dispose()
    },
  }
}
