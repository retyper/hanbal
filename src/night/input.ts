/**
 * 밤의 입력 — 당겨 쏘기 (2026-10-18, 형: "찍었을때 뒤로 당겼다가 놓게 하는건 어떤가? 기존에 활쏘기게임들은 어떻게 하는지 참고해서")
 *
 * 활쏘기·새총 모바일 게임(보우마스터즈 · 앵그리버드 · 양궁 게임들)의 손짓을 따른다:
 *   아무 데나 누른다 → 그 자리에 고리(손잡이)가 생긴다 → 뒤로 끈다 → **끈 쪽의 반대로** 겨눈다 → 놓으면 쏜다.
 *   끈 길이가 당김의 상한이다(P.night.pullMax 에서 끝까지). 당김 자체는 여전히 시간을 들여 차오른다 — 근력의 몫.
 *   고리(P.night.pullDead) 안으로 돌아와 놓으면 쏘지 않고 활을 내린다.
 * 활터의 입력(src/input/pointer.ts)은 손대지 않는다. 판(World)은 안 건드리고 NightFrame 하나를 제자리에서 고친다 (A5).
 * 키보드: Space 로 당기고(끝까지) 방향키로 겨눈다 · Shift·오른쪽 단추로 숨을 참는다.
 */
import { P } from '../tune/params.ts'
import type { NightFrame } from './sim.ts'

/** 그리기가 읽는 당김 — 화면 좌표(CSS px) */
export interface Pull {
  active: boolean
  /** 고리(누른 자리) */
  ax: number
  ay: number
  /** 지금 손가락 */
  x: number
  y: number
  /** 끈 몫 0..1 (고리 밖부터 끝까지) */
  frac: number
  /** 끝까지의 거리 (CSS px) — 누를 때 화면 크기로 정한다 */
  max: number
  /** 고리 안이다 — 놓으면 그만둔다 */
  inDead: boolean
}

export interface NightInput {
  readonly frame: NightFrame
  readonly pull: Pull
  /** 스텝마다 — 궁수 자리에서 겨눈 쪽으로 조준점을 놓는다 (월드 m) */
  syncAim(archerX: number, archerY: number): void
  /** 고정 스텝 하나가 끝날 때 — 놓음·그만둠을 한 스텝은 보인 뒤에 내린다 */
  endStep(): void
  setSteady(on: boolean): void
  dispose(): void
}

/** 겨눔의 반지름 (월드 m) — 활터 sim 은 조준점의 방향만 쓴다 */
const AIM_REACH = 10

export function createNightInput(canvas: HTMLCanvasElement): NightInput {
  const frame: NightFrame = { aimX: AIM_REACH, aimY: 0, drawing: false, steady: false, parry: false, cap: 1, cancel: false }
  const pull: Pull = { active: false, ax: 0, ay: 0, x: 0, y: 0, frac: 0, max: P.night.pullMax, inDead: true }
  // 겨눈 쪽 (월드: x 오른쪽, y 위) — 끈 쪽의 반대. 처음은 앞으로 조금 아래
  let dirX = 1
  let dirY = -0.2
  let pressSeen = false
  let pendingRelease = false
  let cancelSeen = false
  let rightHeld = false
  let shiftHeld = false
  let uiHeld = false
  let keyDraw = false
  let keyU = false
  let keyD = false
  let pointerId = -1

  let rectL = 0
  let rectT = 0
  const syncRect = (): void => {
    const r = canvas.getBoundingClientRect()
    rectL = r.left
    rectT = r.top
  }
  syncRect()

  const syncSteady = (): void => {
    frame.steady = rightHeld || shiftHeld || uiHeld
  }

  const startDraw = (): void => {
    if (frame.drawing) return
    frame.drawing = true
    pressSeen = false
    pendingRelease = false
  }
  const endDraw = (): void => {
    if (!frame.drawing) return
    if (pressSeen) frame.drawing = false
    else pendingRelease = true
  }

  /** 끈 자리에서 당김의 몫과 겨눈 쪽을 다시 센다 */
  const update = (): void => {
    const dx = pull.x - pull.ax
    const dy = pull.y - pull.ay
    const len = Math.hypot(dx, dy)
    const dead = P.night.pullDead
    pull.inDead = len <= dead
    const f = Math.max(0, Math.min(1, (len - dead) / Math.max(1, pull.max - dead)))
    pull.frac = f >= P.night.pullFullAt ? 1 : f
    if (!pull.inDead) {
      // 화면 아래로 끌면 위를 겨눈다: 월드 겨눔 = (−dx, +dy) (화면 y 는 아래가 +, 월드 y 는 위가 +)
      dirX = -dx / len
      dirY = dy / len
      startDraw()
    }
    frame.cap = pull.inDead ? 0 : pull.frac
  }

  const onDown = (e: PointerEvent): void => {
    if (e.button === 2) {
      rightHeld = true
      syncSteady()
      return
    }
    if (e.button !== 0 || pull.active) return
    try {
      canvas.setPointerCapture(e.pointerId)
    } catch {
      /* 캡처가 안 돼도 판은 돈다 */
    }
    syncRect()
    pointerId = e.pointerId
    pull.active = true
    pull.ax = pull.x = e.clientX - rectL
    pull.ay = pull.y = e.clientY - rectT
    pull.frac = 0
    pull.max = Math.max(P.night.pullDead * 2, Math.min(P.night.pullMax, P.night.pullMaxShare * Math.min(canvas.clientWidth, canvas.clientHeight)))
    pull.inDead = true
    frame.cap = 0
  }

  const onMove = (e: PointerEvent): void => {
    if (rightHeld && (e.buttons & 2) === 0) {
      rightHeld = false
      syncSteady()
    }
    if (!pull.active || e.pointerId !== pointerId) return
    pull.x = e.clientX - rectL
    pull.y = e.clientY - rectT
    update()
  }

  const finish = (cancel: boolean): void => {
    if (!pull.active) return
    pull.active = false
    pointerId = -1
    if (!frame.drawing) return
    if (cancel || pull.inDead) {
      // 쏘지 않고 내린다 — 이 스텝에 cancel 을 보이고, drawing 은 그 뒤에 내린다 (cancelDraw 가 먼저 활을 풀어야 놓음이 발사가 안 된다)
      frame.cancel = true
      cancelSeen = false
      return
    }
    frame.cap = pull.frac
    endDraw()
  }

  const onUp = (e: PointerEvent): void => {
    if (e.button === 2) {
      rightHeld = false
      syncSteady()
      return
    }
    if (e.pointerId !== pointerId) return
    pull.x = e.clientX - rectL
    pull.y = e.clientY - rectT
    update()
    finish(false)
    try {
      canvas.releasePointerCapture(e.pointerId)
    } catch {
      /* 이미 풀렸다 */
    }
  }

  const onCancel = (): void => finish(true)
  const onContext = (e: Event): void => e.preventDefault()

  const typing = (t: EventTarget | null): boolean => t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement
  const onKeyDown = (e: KeyboardEvent): void => {
    if (typing(e.target)) return
    switch (e.key) {
      case ' ':
        if (!e.repeat && !pull.active) {
          keyDraw = true
          frame.cap = 1
          startDraw()
        }
        break
      case 'ArrowUp': keyU = true; break
      case 'ArrowDown': keyD = true; break
      case 'Shift': shiftHeld = true; syncSteady(); return
      default: return
    }
    e.preventDefault()
  }
  const onKeyUp = (e: KeyboardEvent): void => {
    if (typing(e.target)) return
    switch (e.key) {
      case ' ': if (keyDraw) { keyDraw = false; endDraw() } break
      case 'ArrowUp': keyU = false; break
      case 'ArrowDown': keyD = false; break
      case 'Shift': shiftHeld = false; syncSteady(); break
      default: break
    }
  }
  const onBlur = (): void => {
    rightHeld = shiftHeld = uiHeld = keyU = keyD = false
    syncSteady()
    if (keyDraw) { keyDraw = false; endDraw() }
    finish(true)
  }

  canvas.addEventListener('pointerdown', onDown)
  canvas.addEventListener('pointermove', onMove)
  canvas.addEventListener('pointerup', onUp)
  canvas.addEventListener('pointercancel', onCancel)
  canvas.addEventListener('lostpointercapture', onCancel)
  canvas.addEventListener('contextmenu', onContext)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', onBlur)
  window.addEventListener('resize', syncRect, { passive: true })

  return {
    frame,
    pull,
    syncAim(x, y) {
      frame.aimX = x + dirX * AIM_REACH
      frame.aimY = y + dirY * AIM_REACH
    },
    endStep() {
      if (frame.cancel === true) {
        // 판이 그만둠을 한 번 봤다 — 이제 활을 내린다 (recovering → idle 은 drawing false 를 봐야 간다)
        if (cancelSeen) {
          frame.cancel = false
          frame.drawing = false
          pendingRelease = false
        } else cancelSeen = true
      }
      if (frame.drawing) {
        pressSeen = true
        if (pendingRelease) {
          frame.drawing = false
          pendingRelease = false
        }
      }
      // 방향키 — 겨눈 쪽을 돌린다 (sim 스텝 길이로, 시계 없이)
      const turn = (keyU ? 1 : 0) - (keyD ? 1 : 0)
      if (turn !== 0) {
        const ang = Math.atan2(dirY, dirX) + (turn * P.night.keyTurn) / P.sim.hz
        dirX = Math.cos(ang)
        dirY = Math.sin(ang)
      }
    },
    setSteady(on) {
      uiHeld = on
      syncSteady()
    },
    dispose() {
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onCancel)
      canvas.removeEventListener('lostpointercapture', onCancel)
      canvas.removeEventListener('contextmenu', onContext)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('resize', syncRect)
    },
  }
}
