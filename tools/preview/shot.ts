/**
 * 한 프레임 미리보기 — **탭이 hidden 이어도 캔버스를 본다** (2026-09-20)
 *
 * 게임은 백그라운드 탭에서 rAF 를 안 돌린다 (CLAUDE.md 규칙 4). 그래서 자동화가 잡은 탭에서는
 * 게임 화면이 새까맣다. 여기는 루프가 없다 — 진짜 렌더러로 **딱 한 번** 그린다. 그리는 것 자체는
 * hidden 에서도 되므로 스크린샷에 장면이 찍힌다. 적·보스 그림을 갈아 끼울 때 이걸로 본다.
 *
 *   npx vite → http://localhost:5173/tools/preview/index.html?stage=20&ticks=90&zoomTo=boss
 *     stage  판 번호 (1부터)      ticks  그 전에 sim 을 몇 틱 돌릴지 (적이 자세를 잡는다)
 *     corpses=200  시체를 look 마다 하나씩 세워 본다 (숫자 = 몇 프레임 뒤)
 *     armor=1  궁수에게 갑옷을 입힌다 (0 가죽 · 1 두정 · 2 찰갑)
 *     hit=1  판정 덧그림 (초록 몸 · 노랑 급소)   fork=scout  갈림길 카드를 얹는다
 *   콘솔에서: shot(30, 120) 으로 다시 그린다.
 *
 * 빌드에는 안 들어간다 (vite 의 입구는 루트 index.html 하나다). 세이브를 읽지도 쓰지도 않는다.
 */
import { createRenderer, getCamera } from '../../src/render/scene.ts'
import { worldToScreenX, worldToScreenY } from '../../src/render/camera.ts'
import { bossWeakSpot } from '../../src/sim/target.ts'
import { P } from '../../src/tune/params.ts'
import { createWorld, step } from '../../src/sim/world.ts'
import { getStage } from '../../src/game/stages.ts'
import { applyFork, type ForkOption } from '../../src/game/forks.ts'
import type { HudState } from '../../src/render/hud.ts'
import type { InputFrame } from '../../src/sim/types.ts'

const q = new URLSearchParams(location.search)
const canvas = document.getElementById('c') as HTMLCanvasElement
const renderer = createRenderer(canvas)
const hud: HudState = { training: 0, canLevelUp: false, muted: false, silent: false, toast: '', arrow: '', stars: -1, endReason: '', arrowRule: false, time: 0, bestTime: 0, record: false }
const idle: InputFrame = { aimX: 30, aimY: 3, drawing: false, steady: false, parry: false }

function shot(stage: number, ticks: number): string {
  // fork=scout 처럼 갈림길 카드를 얹을 수 있다 — 척후(charger)는 카드로만 나온다.
  const fork = q.get('fork')
  const def = fork !== null ? applyFork(getStage(stage - 1), { id: fork } as ForkOption, stage) : getStage(stage - 1)
  const w = createWorld(def, { str: 3, steady: 3, stamina: 3, focus: 3 })
  // armor=0|1|2 — 궁수에게 그 갑옷을 입혀 본다 (가죽 · 두정 · 찰갑).
  const armor = q.get('armor')
  if (armor !== null) { w.armor = 3; w.armorMax = 3; w.armorLook = Number(armor) }
  for (let i = 0; i < ticks; i++) step(w, idle)
  renderer.resize()
  // corpses=N — 시체를 세워 본다: 가짜 foe_down 을 look 마다 하나씩 뱉고 N 프레임 뒤의 모습을 찍는다.
  //   (작으면 나뒹구는 중, 크면 누운 뒤.) sim 은 안 건드린다 — 시체는 렌더의 것이다.
  const frames = Number(q.get('corpses') ?? 0)
  if (frames > 0) {
    const looks = [0, 3, 4, 5, 6]
    for (let i = 0; i < looks.length; i++) {
      w.events.push({ t: 'foe_down', x: 12 + i * 3.2, y: 2.2, vx: 2, vy: 3, mass: 1, look: looks[i] ?? 0, r: 0.55, hard: false, g: 0 })
    }
    renderer.draw(w, 0, 1 / 60, hud)
    w.events.length = 0
    for (let i = 0; i < frames; i++) renderer.draw(w, 0, 1 / 60, hud)
  }
  // 카메라는 프레임마다 조금씩 따라간다 — 자리를 잡도록 몇 번 그린다.
  for (let i = 0; i < (frames > 0 ? 0 : 90); i++) renderer.draw(w, 0, 1 / 60, hud)
  if (q.get('hit') !== null) {
    // 판정 덧그림 — 몸(초록)과 보스의 급소(노랑). 그림이 판정과 어긋났는지 여기서 본다.
    const cam = getCamera(renderer)
    const ctx = canvas.getContext('2d')
    if (ctx !== null) {
      ctx.lineWidth = 1.5
      for (const t of w.targets) {
        if (!t.alive) continue
        const x = worldToScreenX(cam, t.x), y = worldToScreenY(cam, t.y), r = t.r * cam.scale
        ctx.strokeStyle = '#4dff88'
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke()
        if (t.kind === 'archer' || t.kind === 'charger') {
          ctx.strokeStyle = '#ffe14d'
          ctx.beginPath(); ctx.arc(x, y - r * P.enemy.archerHeadUp, r * P.enemy.archerHeadR, 0, Math.PI * 2); ctx.stroke()
        }
        if (t.kind === 'boss') {
          const ws = bossWeakSpot(t.look)
          ctx.strokeStyle = '#ffe14d'
          ctx.beginPath(); ctx.arc(x, y - r * ws.up, r * ws.r, 0, Math.PI * 2); ctx.stroke()
        }
      }
    }
  }
  return `${stage}판 · ${w.targets.filter((t) => t.alive).map((t) => `${t.kind}${t.look ?? ''}`).join(' ')}`
}

;(window as unknown as { shot: typeof shot }).shot = shot
// 스프라이트는 비동기로 뜬다 — 한 번 그려 요청을 걸고, 조금 뒤에 다시 그린다.
console.log(shot(Number(q.get('stage') ?? 10), Number(q.get('ticks') ?? 60)))
setTimeout(() => { document.title = shot(Number(q.get('stage') ?? 10), Number(q.get('ticks') ?? 60)) }, 700)
