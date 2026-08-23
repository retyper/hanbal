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
import { cancelDraw, createWorld, isSettled, requireFreshPress, resetWorld, restArcher, step } from '../sim/world.ts'
import { createInput } from '../input/pointer.ts'
import { createRenderer, getCamera, getHitStopMs } from '../render/scene.ts'
import type { HudState } from '../render/hud.ts'
import { createSfx, pumpSfx, sfxMuted, toggleMute, unlockSfx, updateSfx } from '../audio/sfx.ts'
import { getStage, STAGES } from './stages.ts'
import { onSaveChanged, writeSave, type SaveData } from './save.ts'
import { settleOffline, type OfflineGain } from './offline.ts'
import { awardRun, canGrow, grantArrows, type StatKey } from './progression.ts'
import { P } from '../tune/params.ts'
import { clamp } from '../core/math.ts'

/**
 * 게임 루프가 UI에 요구하는 최소한. ui/ 모듈을 직접 import하지 않기 위한 좁은 창구다.
 * (레이어 방향: ui → game 이지 game → ui 가 아니다. ARCHITECTURE A1)
 */
export interface LoopUi {
  /** 화면을 덮는 패널(성장 화면)이 열려 있는가. 열려 있는 동안 sim을 멈춘다. */
  paused(): boolean
  /** 판 보상 한 줄. 결과 화면을 만들지 않는다 (C1). */
  runGain(training: number, leveled: readonly StatKey[]): void
  /** 자리를 비운 사이 쌓인 것. 확인 버튼 없는 자동 수령이다 (C1·C4). */
  offlineGain(gain: OfflineGain): void
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
  dispose(): void
}

/** 판이 끝났을 때 아래 한 줄. 매 프레임 문자열을 만들지 않으려고 모듈 상수로 둔다 (A5). */
const HINT_NEXT = '한 번 더 누르면 다음 판'
const HINT_RETRY = '한 번 더 누르면 다시'

/** 판 결과 스크래치. 판마다 객체를 새로 만들 이유가 없다 (A5). */
const RUN = { cleared: false, score: 0, accuracy: 0, arrowsUsed: 0 }

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

  // 세이브의 진행도가 챕터 끝을 넘어 있어도(예전 세이브·손상) 게임이 죽지 않게 잘라 들어간다.
  let stageIndex = clamp(Math.floor(save.stageIndex), 0, STAGES.length - 1)
  save.stageIndex = stageIndex
  // World는 하나만 만들고 끝까지 재사용한다. 판마다 새로 만들면 프레임당 할당 0이 깨진다 (A5).
  const w = createWorld(getStage(stageIndex), save.stats)

  // 매 프레임 제자리에서 갱신한다. 새로 만들지 않는다 (A5).
  const hud: HudState = { training: 0, canLevelUp: false, muted: false, toast: '' }

  let raf = 0
  let wanted = false // start()가 불렸는가 — 사용자 의도. 탭 가시성과는 별개로 기억한다.
  let last = 0
  let acc = 0
  let prevDrawing = false
  let paused = false

  // ── 판 단위 집계 ──
  /** 이번 판에 실제로 지급된 화살. stage.arrows 가 아니라 보유분에 따라 줄 수 있다. */
  let granted = 0
  /** 이번 판의 명중 수. 정확도 보상의 분자다. */
  let hits = 0
  /** 이번 판의 보상을 이미 줬는가. 종료는 한 번만 정산한다. */
  let awarded = false

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

  const loadStage = (): void => {
    // 정산 전에 판을 갈아엎으면 보상이 통째로 사라진다. 아직 안 줬으면 여기서 준다.
    // (isSettled를 기다리는 동안 사용자가 다음 판으로 넘기는 경로가 실제로 존재한다.)
    if (!awarded && w.status !== 'playing') {
      awarded = true
      finishRun()
    }
    const stage = getStage(stageIndex)
    resetWorld(w, stage, save.stats)
    // 지급량은 game 레이어의 경제 판단이라 sim 계약(resetWorld)에 넣지 않고 여기서 덮어쓴다.
    // 풀 크기는 stage.arrows 기준으로 이미 잡혀 있으므로 줄이는 쪽은 언제나 안전하다.
    granted = grantArrows(save, stage)
    w.arrowsLeft = granted
    hits = 0
    awarded = false
    acc = 0
    save.stageIndex = stageIndex
    // 판을 넘긴 그 눌림이 다음 판의 첫 발까지 이어지지 않게 에지를 소진시킨다.
    // 루프 쪽 에지만 소진하면 InputFrame.drawing 이 아직 true라 다음 스텝에 시위가 잡힌다 —
    // 궁수도 "한 번 떼야 잡히는" 상태로 같이 넘겨야 화살을 안 잃는다 (C1).
    prevDrawing = input.frame.drawing
    if (prevDrawing) requireFreshPress(w)
    saveNow()
  }

  /**
   * 판이 끝났다. 훈련치를 주고 쏜 만큼 화살을 뺀다.
   * 진입 과금이 아니라 **실제로 쏜 만큼** 소모다 — 켜놓고 자리를 뜬 사람이 손해를 보면 C2 위반이다.
   */
  const finishRun = (): void => {
    const used = granted - w.arrowsLeft
    const shot = used > 0 ? used : 0
    RUN.cleared = w.status === 'cleared'
    RUN.score = w.score
    RUN.accuracy = shot > 0 ? hits / shot : 0
    RUN.arrowsUsed = shot
    const gain = awardRun(save, w.stage, RUN)
    ui.runGain(gain.training, gain.leveled)
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

    // 이번 프레임에 쌓인 명중을 센다. 정확도 보상의 분자다.
    // 소리·이펙트와 같은 배열을 읽되 비우지 않는다 — 비우는 건 이 함수의 맨 끝이다.
    for (let i = 0; i < w.events.length; i++) {
      if (w.events[i]?.t === 'hit') hits++
    }

    // 종료는 한 번만 정산한다. 그리고 **결과가 더 뒤집힐 여지가 없을 때까지 기다린다** —
    // 클리어는 목표 점수를 넘긴 그 스텝에 즉시 판정되지만, 그 뒤로도 날아가던 화살과
    // 낙하 중인 공중 과녁이 연쇄로 점수를 더 올린다. status 전이 프레임에 스냅샷을 뜨면
    // 1-10의 연쇄 점수가 통째로 기록에서 빠진다 (화면 756점, 저장 452점).
    if (!awarded && w.status !== 'playing' && isSettled(w)) {
      awarded = true
      finishRun()
    }

    // 에지는 멈춰 있어도 소진한다. 안 그러면 패널을 닫는 순간 아까 누른 R이 뒤늦게 터진다.
    if (input.takeRestart() && !paused) loadStage()

    // 결과 화면에 가두지 않는다 (제약 C1). 다시 누르는 순간 바로 다음 판. 확인 버튼 없음.
    const drawingNow = input.frame.drawing
    if (!paused && w.status !== 'playing' && drawingNow && !prevDrawing) {
      // 클리어면 다음 판, 실패면 같은 판. 어느 쪽이든 멈춰 세우지 않는다 (C2).
      // 챕터 끝에서는 마지막 판을 반복한다. 다음 챕터가 붙기 전까지의 자리다.
      if (w.status === 'cleared' && stageIndex < STAGES.length - 1) stageIndex++
      loadStage()
    } else if (!paused) {
      prevDrawing = drawingNow
    }

    hud.muted = sfxMuted(sfx)
    hud.toast = w.status === 'playing'
      ? ''
      : w.status === 'cleared' && stageIndex < STAGES.length - 1 ? HINT_NEXT : HINT_RETRY

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
  granted = grantArrows(save, w.stage)
  w.arrowsLeft = granted

  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pagehide', onHidden)
  canvas.addEventListener('pointerdown', onFirstGesture)
  window.addEventListener('keydown', onFirstGesture)

  return {
    start(): void {
      wanted = true
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
    dispose(): void {
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
