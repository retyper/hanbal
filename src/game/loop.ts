/**
 * 고정 스텝 게임 루프 (ARCHITECTURE A1 결정론 · GDD 제약 C3 탭 생명주기)
 *
 * 이 파일의 책임은 둘이다.
 *  1. sim은 언제나 같은 크기의 스텝으로만 나아간다. 렌더가 30fps든 144fps든 결과는 비트 단위로 같다.
 *  2. 탭이 숨으면 **아무것도 돌지 않는다.** 형이 공부 중이다. rAF 한 개도 남기지 않는다.
 *
 * 렌더 쪽 분업: renderer.draw 안에서 pumpEvents·updateCamera·updateFx가 실시간(dtReal)으로 돈다.
 * 루프는 이벤트를 **비우는 것**만 책임진다 — scene.ts / effects.ts 가 읽되 비우지 않기로 했다.
 */
import { cancelDraw, createWorld, requireFreshPress, resetWorld, restArcher, step } from '../sim/world.ts'
import type { Stats } from '../sim/types.ts'
import { createInput } from '../input/pointer.ts'
import { createRenderer, getCamera, getHitStopMs } from '../render/scene.ts'
import { getStage, STAGES } from './stages.ts'
import { P } from '../tune/params.ts'

export interface GameLoop {
  start(): void
  stop(): void
  /** 창 크기·dpr이 바뀌었다. main.ts가 부른다. */
  resize(): void
  dispose(): void
}

/** M2에서 저장·성장 모듈이 이 값을 대신한다. 활 한 번 안 잡아본 스틱맨이라 전부 0이다. */
const M1_STATS: Stats = { str: 0, steady: 0, stamina: 0, focus: 0 }

export function createLoop(canvas: HTMLCanvasElement): GameLoop {
  const renderer = createRenderer(canvas)
  const input = createInput(canvas, getCamera(renderer))

  let stageIndex = 0
  // World는 하나만 만들고 끝까지 재사용한다. 판마다 새로 만들면 프레임당 할당 0이 깨진다 (A5).
  const w = createWorld(getStage(stageIndex), M1_STATS)

  let raf = 0
  let wanted = false // start()가 불렸는가 — 사용자 의도. 탭 가시성과는 별개로 기억한다.
  let last = 0
  let acc = 0
  let prevDrawing = false

  /** M2 저장 훅. 저장 시점은 탭 이탈과 판 종료뿐이다. 주기적 저장 타이머는 금지 (A3). */
  const saveNow = (): void => {
    // M2: game/save.ts
  }

  const loadStage = (): void => {
    resetWorld(w, getStage(stageIndex), M1_STATS)
    acc = 0
    // 판을 넘긴 그 눌림이 다음 판의 첫 발까지 이어지지 않게 에지를 소진시킨다.
    // 루프 쪽 에지만 소진하면 InputFrame.drawing 이 아직 true라 다음 스텝에 시위가 잡힌다 —
    // 궁수도 "한 번 떼야 잡히는" 상태로 같이 넘겨야 화살을 안 잃는다 (C1).
    prevDrawing = input.frame.drawing
    if (prevDrawing) requireFreshPress(w)
    saveNow()
  }

  const tick = (now: number): void => {
    raf = 0
    // 숨은 탭에서는 다음 프레임을 예약하지 않는다 (제약 C3). 이 게임의 최우선 규칙이다.
    if (!wanted || document.hidden) return
    // 본문보다 먼저 예약해 둔다. 렌더에서 예외가 나도 루프가 통째로 죽지는 않게.
    raf = requestAnimationFrame(tick)

    const realDt = last === 0 ? 0 : (now - last) / 1000
    last = now

    if (getHitStopMs(renderer) > 0) {
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
    }

    if (input.takeRestart()) loadStage()

    // 결과 화면에 가두지 않는다 (제약 C1). 다시 누르는 순간 바로 다음 판. 확인 버튼 없음.
    const drawingNow = input.frame.drawing
    if (w.status !== 'playing' && drawingNow && !prevDrawing) {
      // 클리어면 다음 판, 실패면 같은 판. 어느 쪽이든 멈춰 세우지 않는다 (C2).
      // 챕터 끝에서는 마지막 판을 반복한다. 다음 챕터가 붙기 전까지의 자리다.
      if (w.status === 'cleared' && stageIndex < STAGES.length - 1) stageIndex++
      loadStage()
    } else {
      prevDrawing = drawingNow
    }

    // draw 안에서 이펙트·카메라가 이번 프레임의 이벤트를 읽는다.
    // 그래서 명중 반응이 한 프레임도 늦지 않는다 (feel-lens 4항).
    try {
      renderer.draw(w, acc / w.dt, realDt)
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
    saveNow()
  }

  const onVisibility = (): void => {
    if (document.hidden) onHidden()
    else {
      // 자리를 비운 동안 팔은 쉬었다. 복귀 첫 클릭이 스태미나 부족으로 삼켜지면
      // "복귀 3초 안에 첫 발"(C1)이 깨진다.
      restArcher(w)
      schedule()
    }
  }

  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pagehide', onHidden)

  return {
    start(): void {
      wanted = true
      schedule()
    },
    stop(): void {
      wanted = false
      halt()
    },
    resize(): void {
      // 매 프레임 부르면 안 된다 — 렌더러가 배경 그라디언트를 다시 만든다 (A5 할당 0).
      renderer.resize()
    },
    dispose(): void {
      wanted = false
      halt()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onHidden)
      input.dispose()
      renderer.dispose()
    },
  }
}
