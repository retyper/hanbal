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
 *     fire=8  한 발 쏘고 8틱 뒤 (날아가는 화살)
 *     aimy=20 draw=1  위를 겨눈 채 당기고 있는 모습 (겨냥을 바꿔도 몸이 안 변하는지)
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
// aimy=N — 겨냥 높이 (m). 겨냥을 바꿔도 몸이 안 변하는지 볼 때 쓴다. draw=1 이면 당긴 채로 찍는다.
const idle: InputFrame = { aimX: 30, aimY: Number(q.get('aimy') ?? 3), drawing: q.get('draw') !== null, steady: false, parry: false }

function shot(stage: number, ticks: number): string {
  // fork=scout 처럼 갈림길 카드를 얹을 수 있다 — 척후(charger)는 카드로만 나온다.
  const fork = q.get('fork')
  const def = fork !== null ? applyFork(getStage(stage - 1), { id: fork } as ForkOption, stage) : getStage(stage - 1)
  const w = createWorld(def, { str: 3, steady: 3, stamina: 3, focus: 3 })
  // armor=0|1|2 — 궁수에게 그 갑옷을 입혀 본다 (가죽 · 두정 · 찰갑).
  const armor = q.get('armor')
  if (armor !== null) { w.armor = 3; w.armorMax = 3; w.armorLook = Number(armor) }
  for (let i = 0; i < ticks; i++) step(w, idle)
  // fire=N — 한 발 쏜다: 70틱 당겼다 놓고 N 틱 뒤의 모습. 날아가는 화살을 보려고.
  const fire = Number(q.get('fire') ?? 0)
  if (fire > 0) {
    const pull: InputFrame = { ...idle, aimX: 40, aimY: 9, drawing: true }
    for (let i = 0; i < 70; i++) step(w, pull)
    for (let i = 0; i < fire; i++) step(w, { ...pull, drawing: false })
  }
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

/**
 * 배경 굽기 — 받은 16:9 그림 한 장을 **두 겹의 WebP** 로 (2026-09-20). 이 기기엔 그림 변환기가 없어서 브라우저의 캔버스로 굽는다.
 *
 * 왜 두 겹인가: 화면은 가로로 길고 땅은 화면 중간에 오기도 한다. 한 장을 폭에 맞춰 덮으면 하늘과 달이 통째로 잘리고
 * 산이 판 이름을 덮는다. 그래서 **하늘(위 절반)은 화면 위에, 산(가운데 띠)은 땅에** 따로 못 박는다 (render/scene.ts drawBackdrop).
 * 산 띠의 위쪽은 알파로 녹여서 하늘과 이음매가 안 보인다.
 *
 *   1. 받은 PNG 를 public/bg/_src.png 로 둔다
 *   2. node tools/preview/receiver.mjs 를 띄운다 (구운 파일을 받아 적는 수신기)
 *   3. 이 페이지의 콘솔에서:  await bakeBackdrop('/bg/_src.png', 'night')
 *      → public/bg/night-sky.webp · night-ridge.webp.  _src.png 는 지운다
 */
const SPLIT = { skyBottom: 0.5, ridgeTop: 0.34, ridgeBottom: 0.93, fade: 0.3 }

async function bakeBackdrop(src: string, name: string, q = 0.84): Promise<string> {
  const bmp = await createImageBitmap(await (await fetch(`${src}?v=${Date.now()}`)).blob())
  const W = bmp.width
  const H = bmp.height
  // 내려받지 않고 수신기(tools/preview/receiver.mjs)로 보낸다 — 크롬은 연달아 내려받는 것을 막는다.
  const save = async (c: HTMLCanvasElement, file: string): Promise<number> => {
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/webp', q))
    if (blob === null) throw new Error('webp 로 못 구웠다')
    const res = await fetch(`http://127.0.0.1:5199/save/bg/${file}`, { method: 'PUT', body: blob })
    if (!res.ok) throw new Error(`수신기가 거절했다: ${await res.text()}`)
    return Math.round(blob.size / 1024)
  }
  // 하늘 — 위에서 skyBottom 까지.
  const sky = document.createElement('canvas')
  sky.width = W
  sky.height = Math.round(H * SPLIT.skyBottom)
  sky.getContext('2d')?.drawImage(bmp, 0, 0)
  // 산 — ridgeTop ~ ridgeBottom. 위쪽 fade 만큼은 알파 0 → 1 로 녹인다.
  const ridge = document.createElement('canvas')
  const y0 = Math.round(H * SPLIT.ridgeTop)
  ridge.width = W
  ridge.height = Math.round(H * SPLIT.ridgeBottom) - y0
  const rc = ridge.getContext('2d')
  if (rc === null) throw new Error('2d 컨텍스트 없음')
  rc.drawImage(bmp, 0, -y0)
  // 제미나이의 워터마크(오른쪽 아래 ✦)를 옆의 안개로 덮는다.
  rc.drawImage(ridge, W * 0.72, ridge.height * 0.78, W * 0.12, ridge.height * 0.22, W * 0.855, ridge.height * 0.78, W * 0.12, ridge.height * 0.22)
  const g = rc.createLinearGradient(0, 0, 0, ridge.height * SPLIT.fade)
  g.addColorStop(0, 'rgba(0,0,0,1)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  rc.globalCompositeOperation = 'destination-out'
  rc.fillStyle = g
  rc.fillRect(0, 0, W, ridge.height * SPLIT.fade)
  const a = await save(sky, `${name}-sky.webp`)
  const b = await save(ridge, `${name}-ridge.webp`)
  return `${name}: sky ${sky.width}x${sky.height} ${a}KB · ridge ${ridge.width}x${ridge.height} ${b}KB`
}
;(window as unknown as { bakeBackdrop: typeof bakeBackdrop }).bakeBackdrop = bakeBackdrop
