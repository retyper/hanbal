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
import { drawFoeArcher, drawFoeGunner, drawFoeRusher, drawFoeSlinger } from '../../src/render/foe.ts'
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
  // shield=N — 방패를 세운다 (N 발 남은 채로, 상한 4). parry=N — 환도를 휘두르고 N 틱 뒤의 모습.
  const shield = q.get('shield')
  if (shield !== null) { w.shieldMax = 4; w.shield = Number(shield) }
  for (let i = 0; i < ticks; i++) step(w, idle)
  const parry = Number(q.get('parry') ?? 0)
  if (parry > 0) {
    step(w, { ...idle, parry: true })
    for (let i = 1; i < parry; i++) step(w, idle)
  }
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
    // corpses=N&boss=1 이면 보스 여덟의 죽은 모습을 본다 (sim 은 보스를 −1 − look 으로 보낸다).
    // hunt=1 이면 사냥감 넷.
    const looks = q.get('hunt') !== null ? [20, 21, 22, 23] : q.get('boss') !== null ? [-1, -2, -4, -5, -6, -7, -8] : [0, 3, 4, 5, 6]
    for (let i = 0; i < looks.length; i++) {
      w.events.push({ t: 'foe_down', x: 12 + i * 3.2, y: 2.2, vx: 2, vy: 3, mass: 1, look: looks[i] ?? 0, r: q.get('boss') !== null ? 1.1 : 0.55, hard: false, g: 0 })
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
          ctx.beginPath(); ctx.arc(x + r * ws.fwd, y - r * ws.up, r * ws.r, 0, Math.PI * 2); ctx.stroke()
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

/**
 * 땅의 단면 띠를 굽는다 (2026-09-20, 형: "땅 랜더링도 적절하게 배경만들어").
 *   제미나이에게 "위 35% 는 마젠타, 그 아래는 흙의 단면" 으로 받은 그림(JPEG)을:
 *   ① 마젠타를 알파로 따내고 (풀끝의 분홍 물도 뺀다) ② 풀끝 ~ 어두워지는 데까지만 자르고 (오른쪽 아래 ✦ 워터마크가 그 밑에 있다)
 *   ③ 맨 아래를 한 색(BOTTOM)으로 녹이고 — 그 아래는 렌더가 그 색으로 채운다 ④ **좌우로 뒤집은 것을 옆에 붙여** 이음매 없이 이어지게 한다.
 *   콘솔:  await bakeGround('/bg/_src.jpg')   → public/bg/ground.webp · 돌려주는 surfV 를 render/scene.ts GROUND_ART 에 적는다
 */
async function bakeGround(src: string, q = 0.86): Promise<string> {
  const BOTTOM = [18, 21, 30]
  const bmp = await createImageBitmap(await (await fetch(`${src}?v=${Date.now()}`)).blob())
  const W = bmp.width
  const H = bmp.height
  const full = document.createElement('canvas')
  full.width = W
  full.height = H
  const fc = full.getContext('2d')
  if (fc === null) throw new Error('2d 컨텍스트 없음')
  fc.drawImage(bmp, 0, 0)
  const d = fc.getImageData(0, 0, W, H)
  const px = d.data
  const solid = new Array<number>(H).fill(0)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4
      const r = px[i] ?? 0
      const g = px[i + 1] ?? 0
      const b = px[i + 2] ?? 0
      const m = Math.min(r, b) - g
      if (m > 90) px[i + 3] = 0
      else if (m > 6) {
        // 풀끝의 분홍 물 — JPEG 라 마젠타가 풀 속으로 번져 있다. 알파를 줄이고, 색은 **마른 풀빛**으로 바꿔 적는다
        // (빨강·파랑을 초록에 맞추기만 하면 회색 풀이 된다).
        const k = Math.min(1, (m - 6) / 84)
        px[i + 3] = Math.round(255 * (1 - k * k))
        px[i] = Math.round(g * 1.08)
        px[i + 2] = Math.round(g * 0.62)
      }
      if ((px[i + 3] ?? 0) > 128) solid[y] = (solid[y] ?? 0) + 1
    }
  }
  const top = Math.max(0, solid.findIndex((n) => n > W * 0.004) - 2)
  const surf = solid.findIndex((n) => n > W * 0.97)
  const bot = Math.round(H * 0.78)
  const ch = bot - top
  // 아래 30% 를 한 색으로 녹인다.
  for (let y = top; y < bot; y++) {
    const t = Math.max(0, (y - top) / ch - 0.7) / 0.3
    if (t <= 0) continue
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4
      for (let c = 0; c < 3; c++) px[i + c] = Math.round((px[i + c] ?? 0) * (1 - t) + (BOTTOM[c] ?? 0) * t)
    }
  }
  fc.putImageData(d, 0, 0)
  const out = document.createElement('canvas')
  out.width = W * 2
  out.height = ch
  const oc = out.getContext('2d')
  if (oc === null) throw new Error('2d 컨텍스트 없음')
  oc.drawImage(full, 0, top, W, ch, 0, 0, W, ch)
  oc.translate(W * 2, 0)
  oc.scale(-1, 1)
  oc.drawImage(full, 0, top, W, ch, 0, 0, W, ch)
  const blob = await new Promise<Blob | null>((r) => out.toBlob(r, 'image/webp', q))
  if (blob === null) throw new Error('webp 로 못 구웠다')
  const res = await fetch('http://127.0.0.1:5199/save/bg/ground.webp', { method: 'PUT', body: blob })
  if (!res.ok) throw new Error(`수신기가 거절했다: ${await res.text()}`)
  return `ground.webp ${out.width}x${out.height} ${Math.round(blob.size / 1024)}KB · surfV=${((surf - top) / ch).toFixed(3)} (top ${top} surf ${surf} bot ${bot})`
}
;(window as unknown as { bakeGround: typeof bakeGround }).bakeGround = bakeGround

/**
 * 크게 늘어놓기 — 적을 **한 명씩 크게** 그려서 그림과 팔·어깨가 맞는지 본다 (게임 안에서는 40px 라 안 보인다).
 *   콘솔: lineup(0.6)   ← 당김(예고)의 정도 0~1
 */
function lineup(drawF = 0.6): string {
  const ctx = canvas.getContext('2d')
  if (ctx === null) return '2d 컨텍스트 없음'
  renderer.resize()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.fillStyle = '#20242c'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  const r = Math.min(canvas.height * 0.22, canvas.width / 14)
  const y = canvas.height * 0.52
  const ground = y + r
  ctx.strokeStyle = '#555'
  ctx.beginPath(); ctx.moveTo(0, ground); ctx.lineTo(canvas.width, ground); ctx.stroke()
  const col = '#c0553a'
  // 겨냥은 왼쪽 살짝 위 (궁수가 왼쪽에 있다).
  const ux = -0.97
  const uy = -0.24
  let x = r * 1.8
  drawFoeArcher(ctx, x, y, r, r, ux, uy, drawF, col, false, true, null)
  x += r * 3
  drawFoeArcher(ctx, x, y, r, r, ux, uy, drawF, col, true, true, null)
  x += r * 3
  drawFoeGunner(ctx, x, y, r, r, ux, uy, drawF, col, false, true, null)
  x += r * 3
  drawFoeSlinger(ctx, x, y, r, r, ux, uy, drawF, 1.2, col, false, true, null)
  for (let i = 0; i < 4; i++) {
    x += r * 2.6
    drawFoeRusher(ctx, x, y, r, r, -1, (i / 4) * Math.PI * 2 + 0.01, col)
  }
  return 'lineup'
}
;(window as unknown as { lineup: typeof lineup }).lineup = lineup
