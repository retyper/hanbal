/**
 * 입력 → InputFrame (ARCHITECTURE A1 레이어 분리)
 *
 * 이 파일은 World를 절대 건드리지 않는다. 매 스텝 sim이 읽어가는 스냅샷 하나를
 * **제자리에서** 갱신할 뿐이다. 프레임당 새 객체를 만들지 않는다 (A5 할당 0).
 *
 * 지연 정책: 이벤트 핸들러가 frame을 즉시 쓴다. 큐에 쌓았다가 다음 rAF에 반영하는
 * 중간 계층을 두지 않는다. 브라우저는 한 vsync 안에서 [입력 디스패치 → rAF → 페인트]
 * 순서로 돌기 때문에, pointerdown 한 그 프레임의 sim 스텝이 이미 눌림을 본다 (feel-lens 1항).
 */
import type { InputFrame } from '../sim/types.ts'
import { P } from '../tune/params.ts'
import { screenToWorldX, screenToWorldY, type Camera } from '../render/camera.ts'

/**
 * 루프가 쓰는 입력 핸들.
 *
 * endStep/takeRestart/takeFork는 계약(frame·dispose)에 얹은 추가분이다.
 * - endStep: 눌렀다 뗀 게 한 스텝 안에서 끝났을 때 발사가 통째로 삼켜지는 걸 막는다.
 * - takeRestart: R 키를 두 파일에서 각각 듣지 않기 위해, 키보드 처리를 여기 한 곳에 모은다.
 * - takeFork: 갈림길 2택(game/forks.ts)의 1/2 키. 같은 이유로 여기 한 곳에 모은다.
 */
export interface InputSource {
  readonly frame: InputFrame
  /** 고정 스텝 하나가 끝날 때마다 루프가 부른다. 릴리즈 래치 + 방향키 조준 진행. */
  endStep(): void
  /** R 에지를 소비한다. 소비하면 false로 떨어진다. */
  takeRestart(): boolean
  /** 1/2 에지를 소비한다. 안 눌렸으면 -1, 눌렸으면 0(왼쪽)·1(오른쪽). 소비하면 -1로 떨어진다. */
  takeFork(): number
  dispose(): void
}

export function createInput(canvas: HTMLCanvasElement, cam: Camera): InputSource {
  // sim이 읽는 유일한 객체. 이 참조는 끝까지 바뀌지 않는다.
  const frame: InputFrame = { aimX: 0, aimY: 0, drawing: false, steady: false }

  // 마우스·터치·방향키가 전부 이 화면 커서 하나를 움직인다. 월드 변환은 갱신 시 한 번만.
  let sx = canvas.clientWidth / 2
  let sy = canvas.clientHeight / 2

  // 릴리즈 래치 상태
  let pressSeen = false // 눌림이 최소 한 스텝은 sim에 보였는가
  let pendingRelease = false // 보이기 전에 뗐다 — 스텝 하나를 준 뒤에 놓는다
  let pressFromKey = false // Space로 당기는 중인가 (마우스 복구 경로가 이걸 끊으면 안 된다)

  let rightHeld = false
  let shiftHeld = false
  let restartEdge = false
  let forkEdge = -1

  let keyL = false
  let keyR = false
  let keyU = false
  let keyD = false

  // 캔버스 좌상단 오프셋. getBoundingClientRect는 호출마다 DOMRect를 하나 만든다.
  // 조준 중에는 pointermove가 초당 100번 넘게 오므로 여기서 캐시한다 (A5 할당 0).
  let rectL = 0
  let rectT = 0
  const syncRect = (): void => {
    const r = canvas.getBoundingClientRect()
    rectL = r.left
    rectT = r.top
  }
  syncRect()

  const syncAim = (): void => {
    // 화면 좌표(CSS px) → 월드 m. 변환 규칙은 render/camera.ts 한 곳에만 있다.
    frame.aimX = screenToWorldX(cam, sx)
    frame.aimY = screenToWorldY(cam, sy)
  }
  syncAim()

  const syncSteady = (): void => {
    frame.steady = rightHeld || shiftHeld
  }

  const press = (fromKey: boolean): void => {
    if (frame.drawing) return
    frame.drawing = true
    pressFromKey = fromKey
    pressSeen = false
    pendingRelease = false
  }

  const release = (): void => {
    if (!frame.drawing) return
    // 아직 sim이 이 눌림을 한 번도 못 봤으면 발사가 통째로 사라진다.
    // 스텝 하나를 보여준 뒤에 놓는다. 입력을 삼키느니 약한 화살이 낫다.
    if (pressSeen) frame.drawing = false
    else pendingRelease = true
  }

  const moveTo = (e: PointerEvent): void => {
    sx = e.clientX - rectL
    sy = e.clientY - rectT
    syncAim()
  }

  const onPointerDown = (e: PointerEvent): void => {
    // 캔버스를 벗어난 채 버튼을 놓아도 up을 놓치지 않는다.
    // (놓친 up = 화살이 영영 안 나가는 버그)
    try {
      canvas.setPointerCapture(e.pointerId)
    } catch {
      /* 캡처 실패해도 게임은 계속 돈다 */
    }
    syncRect()
    moveTo(e)
    if (e.button === 2) {
      rightHeld = true
      syncSteady()
    } else if (e.button === 0) {
      press(false)
    }
  }

  const onPointerMove = (e: PointerEvent): void => {
    moveTo(e)
    // alt-tab 등으로 up을 놓쳤을 때의 복구 경로. 키보드로 당기는 중이면 건드리지 않는다.
    if (frame.drawing && !pressFromKey && (e.buttons & 1) === 0) release()
    if (rightHeld && (e.buttons & 2) === 0) {
      rightHeld = false
      syncSteady()
    }
  }

  const onPointerUp = (e: PointerEvent): void => {
    moveTo(e)
    if (e.button === 2) {
      rightHeld = false
      syncSteady()
    } else if (e.button === 0 && !pressFromKey) {
      release()
    }
    try {
      canvas.releasePointerCapture(e.pointerId)
    } catch {
      /* 이미 풀렸으면 그만이다 */
    }
  }

  const onPointerCancel = (): void => {
    if (!pressFromKey) release()
    rightHeld = false
    syncSteady()
  }

  const onContextMenu = (e: Event): void => {
    // 우클릭은 호흡정지다. 메뉴가 뜨면 조준이 끊긴다.
    e.preventDefault()
  }

  const isTyping = (t: EventTarget | null): boolean =>
    t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement

  const onKeyDown = (e: KeyboardEvent): void => {
    // 튜닝 콘솔 슬라이더/검색창에 포커스가 있으면 게임 입력으로 가로채지 않는다.
    if (isTyping(e.target)) return
    switch (e.key) {
      case 'ArrowLeft': keyL = true; break
      case 'ArrowRight': keyR = true; break
      case 'ArrowUp': keyU = true; break
      case 'ArrowDown': keyD = true; break
      case ' ': if (!e.repeat) press(true); break
      case 'Shift': shiftHeld = true; syncSteady(); return
      case 'r': case 'R': if (!e.repeat) restartEdge = true; return
      case '1': if (!e.repeat) forkEdge = 0; return
      case '2': if (!e.repeat) forkEdge = 1; return
      default: return
    }
    // 방향키 스크롤·Space 스크롤을 막는다. 위 case에 걸린 키만 여기 온다.
    e.preventDefault()
  }

  const onKeyUp = (e: KeyboardEvent): void => {
    if (isTyping(e.target)) return
    switch (e.key) {
      case 'ArrowLeft': keyL = false; break
      case 'ArrowRight': keyR = false; break
      case 'ArrowUp': keyU = false; break
      case 'ArrowDown': keyD = false; break
      case ' ': if (pressFromKey) release(); break
      case 'Shift': shiftHeld = false; syncSteady(); break
      default: break
    }
  }

  // 창을 벗어나면 눌린 키/버튼의 up을 못 받는다. 그대로 두면 영원히 당긴 상태가 된다.
  const onBlur = (): void => {
    keyL = keyR = keyU = keyD = false
    rightHeld = false
    shiftHeld = false
    syncSteady()
    release()
  }

  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerup', onPointerUp)
  canvas.addEventListener('pointercancel', onPointerCancel)
  canvas.addEventListener('lostpointercapture', onPointerCancel)
  canvas.addEventListener('contextmenu', onContextMenu)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', onBlur)
  window.addEventListener('resize', syncRect, { passive: true })
  window.addEventListener('scroll', syncRect, { passive: true })

  return {
    frame,

    endStep(): void {
      if (frame.drawing) {
        pressSeen = true
        if (pendingRelease) {
          frame.drawing = false
          pendingRelease = false
        }
      }
      const dx = (keyR ? 1 : 0) - (keyL ? 1 : 0)
      const dy = (keyD ? 1 : 0) - (keyU ? 1 : 0)
      if (dx !== 0 || dy !== 0) {
        // 방향키 조준은 sim 스텝 길이로 나아간다. 실시간 시계를 쓰지 않아
        // 프레임레이트가 흔들려도 조준 속도가 변하지 않는다.
        const d = (P.input.keyAimSpeed / P.sim.hz) * (dx !== 0 && dy !== 0 ? Math.SQRT1_2 : 1)
        const w = canvas.clientWidth
        const h = canvas.clientHeight
        sx += dx * d
        sy += dy * d
        // 커서가 화면 밖으로 나가면 조준을 잃는다
        if (sx < 0) sx = 0
        else if (sx > w) sx = w
        if (sy < 0) sy = 0
        else if (sy > h) sy = h
        syncAim()
      }
    },

    takeRestart(): boolean {
      if (!restartEdge) return false
      restartEdge = false
      return true
    },

    takeFork(): number {
      const v = forkEdge
      forkEdge = -1
      return v
    },

    dispose(): void {
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerCancel)
      canvas.removeEventListener('lostpointercapture', onPointerCancel)
      canvas.removeEventListener('contextmenu', onContextMenu)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('resize', syncRect)
      window.removeEventListener('scroll', syncRect)
    },
  }
}
