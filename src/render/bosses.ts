/**
 * 보스의 몸 — 2026-09-10 에 선 넷 (거인과 한국 전통 귀신들)
 *
 * 형: **"보스는 왜 둥둥 떠댕기는 귀신밖에 없냐. 거인형 보스, 한국 전통 귀신 보스들 많잖아."**
 * 그리고 다시: **"모든 보스가 왜 다 둥실둥실 떠다니냐 개빡치게. 그리고 도깨비같이 생긴거
 * 너무 못만들었어... 진짜 최악이야."**
 *
 *   4 도깨비    **거인**. 떡 벌어진 어깨, 뿔 둘, 어깨에 멘 방망이. **두 다리로 걷는다**
 *   5 구미호    흰 여우. 꼬리 아홉이 부챗살로 펴지고 **네 다리가 번갈아 나간다**
 *   6 장승      마을 어귀의 나무 기둥. 다리가 없으니 **좌우로 기우뚱거리며** 온다
 *   7 저승사자  갓과 검은 도포. 도포 자락이 **땅에 닿아** 쓸린다
 *
 * (0~3 — 눈알·갑주·쌍눈·폭주 — 은 유령 계열이라 render/scene.ts 에 그대로 남는다.)
 *
 * ── 이 파일이 지키는 것 ────────────────────────────────────────────────
 * 1. **약점은 그 몸이 원래 가진 눈이다** (2026-09-11). 자리는 몸마다 다르고, 그 자리는
 *    sim/target.ts `bossWeakSpot` 한 곳에서만 정해진다 — sim 도 render 도 그 함수를 부른다.
 *    그림과 판정이 어긋나면 "맞았는데 안 맞았다"가 되고, 그건 이 게임에서 가장 큰 죄다.
 *    얼굴(눈)은 `drawNewBossFace` 가 그린다. 몸을 그리는 함수는 눈을 그리지 않는다 —
 *    눈은 뜨고 감아야 하고, 그건 몸이 아니라 sim 의 상태이기 때문이다.
 * 2. **발은 땅에 있다.** `footY` 는 그 자리 지면의 화면 y 다. 걸음마다 몸이 조금 들려도(sim)
 *    발과 자락은 이 선에 붙는다 — 몸만 들리고 발이 따라 뜨면 그게 곧 "둥실둥실"이다.
 * 3. **읽기만 한다** (A1). 시간축은 w.elapsed 하나뿐이라 같은 시드가 같은 그림을 낸다.
 * 4. **약점 고리·별·체력 바**는 여기서 안 그린다 — 저건 눈이 아니라 **신호**라 여덟이
 *    같아야 배우는 것이 하나다. scene.ts 에 남는다.
 */
import { TAU } from '../core/math.ts'
import { P } from '../tune/params.ts'
import type { Target, World } from '../sim/types.ts'

/** 넷의 색. 실루엣이 달라도 어두운 배경에서 읽히려면 밝기 차가 있어야 한다. */
const C = {
  ogreSkin: '#7a4030',
  ogreShade: '#5a2c20',
  ogreDark: '#3a1c14',
  ogreHorn: '#efe6cf',
  ogreTusk: '#f4ecd8',
  ogreCloth: '#c98a34',
  ogreClothDark: '#6b4416',
  eyeWhite: '#f6efdd',
  club: '#6b5236',
  clubDark: '#43331f',
  clubStud: '#d9c69c',
  foxFur: '#ece5d8',
  foxDark: '#c2b49c',
  foxEar: '#8d5a4a',
  wood: '#6b5334',
  woodDark: '#3f3020',
  woodTooth: '#ded2b6',
  /** 도깨비의 충혈된 흰자 둘레 — 부릅떴다는 말은 색이 한다. */
  ogreBlood: '#c0553a',
  /** 여우 눈 — 호박색. 흰 털 위에서 살아야 하므로 짙다. */
  foxEye: '#e0a83c',
  /** 저승사자의 눈빛 — 푸른 인광. 죽은 낯빛 위의 두 점. */
  reaperGlow: '#9fd8e8',
  robe: '#15171d',
  robeEdge: '#3a3f4a',
  gat: '#0e1014',
  pale: '#cfc3ae',
} as const

/** 걸음의 위상 — sim 의 P.target.bossStepFreq 와 **같은 시계**를 쓴다. */
function stepPhase(w: World): number {
  return Math.sin(w.elapsed * P.target.bossStepFreq * TAU)
}

/**
 * 보스 한 마리의 몸 (look 4~7). (x, y) 는 몸 중심, rx·ry 는 이미 눌림이 반영된 반경 (px).
 * `footY` 는 발이 닿는 지면의 화면 y — 걷는 놈은 여기에 발을 붙인다.
 * 얼굴의 눈은 여기서 안 그린다 — drawNewBossFace 가 그린다 (뜨고 감기 때문에).
 */
export function drawNewBossBody(
  ctx: CanvasRenderingContext2D, w: World, t: Target,
  x: number, y: number, rx: number, ry: number, footY: number,
): void {
  const hy = y - ry * P.target.bossHeadUp
  if (t.look === 4) return ogre(ctx, w, x, y, rx, ry, footY)
  if (t.look === 5) return gumiho(ctx, w, x, y, rx, ry, footY, hy)
  if (t.look === 6) return jangseung(ctx, w, x, rx, ry, footY, hy)
  return reaper(ctx, w, x, y, rx, ry, footY, hy)
}

/** 다리 한 짝 — 허벅지와 정강이가 무릎에서 꺾인다. 곧은 막대는 걷는 것으로 안 보인다. */
function leg(
  ctx: CanvasRenderingContext2D, hipX: number, hipY: number, footX: number, footY: number,
  wide: number, lift: number, col: string,
): void {
  const kx = (hipX + footX) / 2 + (footX - hipX) * 0.12
  const ky = (hipY + footY) / 2 - lift
  ctx.strokeStyle = col
  ctx.lineWidth = wide
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(hipX, hipY)
  ctx.lineTo(kx, ky)
  ctx.lineTo(footX, footY)
  ctx.stroke()
  ctx.lineCap = 'butt'
}

/**
 * ── 도깨비 — 거인 ──────────────────────────────────────────────────
 *
 * 처음 그린 것(사다리꼴 몸 + 타원 머리 + 막대 방망이)을 형이 "진짜 최악"이라 했다. 맞다:
 * 도깨비를 도깨비로 만드는 건 **얼굴**인데 얼굴이 없었다. 귀면와(鬼面瓦)의 문법을 가져온다 —
 * 부릅뜬 두 눈, 넓적한 코, 위로 솟은 송곳니, 뒤로 휜 뿔 둘. 그리고 **두 다리로 걷는다.**
 */
function ogre(
  ctx: CanvasRenderingContext2D, w: World, x: number, y: number, rx: number, ry: number,
  footY: number,
): void {
  const sw = stepPhase(w)
  const hipY = y + ry * 0.30

  // ── 다리 둘 — 먼 다리(어둡게)를 먼저. 걸음마다 앞뒤가 바뀐다.
  leg(ctx, x + rx * 0.26, hipY, x + rx * 0.26 - sw * rx * 0.34, footY, rx * 0.22, ry * 0.1, C.ogreDark)
  leg(ctx, x - rx * 0.26, hipY, x - rx * 0.26 + sw * rx * 0.34, footY, rx * 0.24, ry * 0.12, C.ogreShade)
  // 발 — 짧은 가로 막대 둘. 발이 없으면 다리가 땅에 꽂힌 것으로 보인다.
  ctx.strokeStyle = C.ogreDark
  ctx.lineWidth = rx * 0.14
  ctx.lineCap = 'round'
  for (const [fx, dir] of [[x + rx * 0.26 - sw * rx * 0.34, -1], [x - rx * 0.26 + sw * rx * 0.34, -1]] as const) {
    ctx.beginPath()
    ctx.moveTo(fx + rx * 0.1, footY)
    ctx.lineTo(fx + dir * rx * 0.26, footY)
    ctx.stroke()
  }
  ctx.lineCap = 'butt'

  // ── 뒷팔 — 몸 뒤에서 흔들린다.
  ctx.strokeStyle = C.ogreShade
  ctx.lineWidth = rx * 0.19
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x + rx * 0.62, y - ry * 0.3)
  ctx.lineTo(x + rx * 0.78 + sw * rx * 0.12, y + ry * 0.34)
  ctx.stroke()

  // ── 방망이 — 자루에서 머리로 굵어지는 **채운 도형**. 막대 한 줄은 무기가 아니다.
  const gx = x + rx * 0.44
  const gy = y - ry * 0.16
  const tx = x + rx * 1.22
  const ty = y - ry * 1.18 + sw * ry * 0.05
  const ux = tx - gx
  const uy = ty - gy
  const ul = Math.hypot(ux, uy) || 1
  const nx = -uy / ul
  const ny = ux / ul
  const w0 = rx * 0.11
  const w1 = rx * 0.3
  ctx.fillStyle = C.club
  ctx.beginPath()
  ctx.moveTo(gx + nx * w0, gy + ny * w0)
  ctx.lineTo(tx + nx * w1, ty + ny * w1)
  ctx.quadraticCurveTo(tx + ux * 0.12, ty + uy * 0.12, tx - nx * w1, ty - ny * w1)
  ctx.lineTo(gx - nx * w0, gy - ny * w0)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = C.clubDark
  ctx.lineWidth = Math.max(1, rx * 0.03)
  ctx.stroke()
  ctx.fillStyle = C.clubStud
  for (let i = 0; i < 5; i++) {
    const s = 0.42 + i * 0.14
    ctx.beginPath()
    ctx.arc(gx + ux * s, gy + uy * s, Math.max(1.2, rx * 0.045), 0, TAU)
    ctx.fill()
  }

  // ── 몸통 — 어깨가 떡 벌어지고 배가 앞으로 나온다. 사다리꼴이 아니라 **곡선**이다.
  ctx.fillStyle = C.ogreSkin
  ctx.beginPath()
  ctx.moveTo(x - rx * 0.98, y - ry * 0.22)
  ctx.quadraticCurveTo(x, y - ry * 0.62, x + rx * 0.98, y - ry * 0.22)
  ctx.quadraticCurveTo(x + rx * 0.8, y + ry * 0.1, x + rx * 0.58, hipY + ry * 0.06)
  ctx.lineTo(x - rx * 0.58, hipY + ry * 0.06)
  // 배 — 앞(-x)으로 불룩. 거인은 두꺼워야 무겁다.
  ctx.quadraticCurveTo(x - rx * 1.05, y + ry * 0.06, x - rx * 0.98, y - ry * 0.22)
  ctx.closePath()
  ctx.fill()
  // 가슴 그늘 한 줄 — 부피가 생긴다.
  ctx.strokeStyle = C.ogreShade
  ctx.lineWidth = Math.max(1.5, rx * 0.05)
  ctx.beginPath()
  ctx.moveTo(x - rx * 0.3, y - ry * 0.34)
  ctx.quadraticCurveTo(x, y - ry * 0.16, x + rx * 0.3, y - ry * 0.34)
  ctx.stroke()

  // ── 호피(虎皮) 허리춤 — 띠 하나에 검은 줄 넷. 도깨비는 호랑이 가죽을 두른다.
  const beltY = y + ry * 0.08
  const beltH = ry * 0.3
  ctx.fillStyle = C.ogreCloth
  ctx.fillRect(x - rx * 0.68, beltY, rx * 1.36, beltH)
  ctx.fillStyle = C.ogreClothDark
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(x - rx * 0.56 + i * rx * 0.34, beltY + beltH * 0.12, rx * 0.09, beltH * 0.76)
  }

  // ── 앞팔 — 방망이를 쥔 손. 몸 위에 얹혀야 쥔 것으로 보인다.
  ctx.strokeStyle = C.ogreSkin
  ctx.lineWidth = rx * 0.21
  ctx.beginPath()
  ctx.moveTo(x + rx * 0.72, y - ry * 0.3)
  ctx.lineTo(gx, gy)
  ctx.stroke()
  ctx.lineCap = 'butt'

  // ── 머리 ────────────────────────────────────────────────────────
  const hcx = x - rx * 0.05
  const hcy = y - ry * 0.56
  const hw = rx * 0.62
  const hh = ry * 0.52
  // 뿔 둘 — 뒤로 휜 채운 도형. 뿔이 없으면 도깨비가 아니다.
  ctx.fillStyle = C.ogreHorn
  for (const s of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(hcx + s * hw * 0.62, hcy - hh * 0.52)
    ctx.quadraticCurveTo(hcx + s * hw * 1.5, hcy - hh * 1.5, hcx + s * hw * 1.15, hcy - hh * 1.95)
    ctx.quadraticCurveTo(hcx + s * hw * 1.05, hcy - hh * 1.1, hcx + s * hw * 0.3, hcy - hh * 0.7)
    ctx.closePath()
    ctx.fill()
  }
  // 귀 — 뾰족하게 옆으로.
  ctx.fillStyle = C.ogreShade
  for (const s of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(hcx + s * hw * 0.85, hcy - hh * 0.1)
    ctx.lineTo(hcx + s * hw * 1.35, hcy - hh * 0.42)
    ctx.lineTo(hcx + s * hw * 0.88, hcy + hh * 0.3)
    ctx.closePath()
    ctx.fill()
  }
  // 얼굴 — 턱이 넓은 둥근 사각. 완전한 원은 아기 얼굴이다.
  ctx.fillStyle = C.ogreSkin
  ctx.beginPath()
  ctx.moveTo(hcx - hw, hcy - hh * 0.5)
  ctx.quadraticCurveTo(hcx, hcy - hh * 1.15, hcx + hw, hcy - hh * 0.5)
  ctx.quadraticCurveTo(hcx + hw * 1.05, hcy + hh * 0.55, hcx, hcy + hh)
  ctx.quadraticCurveTo(hcx - hw * 1.05, hcy + hh * 0.55, hcx - hw, hcy - hh * 0.5)
  ctx.closePath()
  ctx.fill()
  // 눈두덩 — 굵은 눈썹 두 줄이 화를 만든다. **이마의 약점(hy)보다 아래**에 둔다.
  ctx.strokeStyle = C.ogreDark
  ctx.lineWidth = Math.max(2, hh * 0.16)
  ctx.lineCap = 'round'
  for (const s of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(hcx + s * hw * 0.12, hcy - hh * 0.04)
    ctx.lineTo(hcx + s * hw * 0.72, hcy - hh * 0.3)
    ctx.stroke()
  }
  ctx.lineCap = 'butt'
  // 두 눈은 **여기서 안 그린다** — 이 둘이 곧 급소라 뜨고 감아야 한다 (drawNewBossFace).
  //   2026-09-11 전까지는 여기서 늘 뜬 눈 둘을 그리고, scene.ts 가 그 **위 이마에** 공용
  //   왕눈알을 하나 더 얹었다. 눈이 셋인 도깨비가 그래서 나왔다 (형: "왕눈이 뇌속에").
  // 코 — 넓적하게. 귀면의 코는 크다.
  ctx.fillStyle = C.ogreShade
  ctx.beginPath()
  ctx.moveTo(hcx, hcy + hh * 0.18)
  ctx.quadraticCurveTo(hcx - hw * 0.2, hcy + hh * 0.46, hcx, hcy + hh * 0.5)
  ctx.quadraticCurveTo(hcx + hw * 0.2, hcy + hh * 0.46, hcx, hcy + hh * 0.18)
  ctx.closePath()
  ctx.fill()
  // 입 — 가로로 찢어진 웃음. 그 안에 이빨 줄, 아래턱에서 송곳니 둘이 위로 솟는다.
  ctx.fillStyle = C.ogreDark
  ctx.beginPath()
  ctx.moveTo(hcx - hw * 0.6, hcy + hh * 0.52)
  ctx.quadraticCurveTo(hcx, hcy + hh * 1.02, hcx + hw * 0.6, hcy + hh * 0.52)
  ctx.quadraticCurveTo(hcx, hcy + hh * 0.72, hcx - hw * 0.6, hcy + hh * 0.52)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = C.ogreTusk
  for (let i = 0; i < 4; i++) {
    const u = -0.42 + i * 0.28
    ctx.beginPath()
    ctx.moveTo(hcx + hw * u, hcy + hh * 0.56)
    ctx.lineTo(hcx + hw * (u + 0.1), hcy + hh * 0.56)
    ctx.lineTo(hcx + hw * (u + 0.05), hcy + hh * 0.72)
    ctx.closePath()
    ctx.fill()
  }
  for (const s of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(hcx + s * hw * 0.46, hcy + hh * 0.68)
    ctx.lineTo(hcx + s * hw * 0.3, hcy + hh * 0.66)
    ctx.lineTo(hcx + s * hw * 0.36, hcy + hh * 0.12)
    ctx.closePath()
    ctx.fill()
  }
}

/** ── 구미호 — 흰 여우. 꼬리 아홉, 네 다리가 번갈아 나간다. ── */
function gumiho(
  ctx: CanvasRenderingContext2D, w: World, x: number, y: number, rx: number, ry: number,
  footY: number, hy: number,
): void {
  const sw = stepPhase(w)
  for (let i = 0; i < 9; i++) {
    const u = i / 8 - 0.5
    const sway = Math.sin(w.elapsed * 2.4 + i * 0.7) * 0.18
    const ang = u * 1.5 + sway - 0.35
    const len = rx * (1.75 - Math.abs(u) * 0.5)
    ctx.strokeStyle = i % 2 === 0 ? C.foxFur : C.foxDark
    ctx.lineWidth = Math.max(2, rx * 0.13)
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(x + rx * 0.4, y - ry * 0.1)
    ctx.quadraticCurveTo(
      x + rx * 0.4 + Math.cos(ang) * len * 0.6, y - ry * 0.1 - Math.sin(ang) * len * 0.5,
      x + rx * 0.4 + Math.cos(ang) * len, y - ry * 0.1 - Math.sin(ang) * len,
    )
    ctx.stroke()
  }
  ctx.lineCap = 'butt'
  // 네 다리 — 앞뒤가 엇갈려 나간다. 네발짐승의 걸음은 대각선끼리 짝이다.
  const hipY = y + ry * 0.3
  const pairs: readonly (readonly [number, number])[] = [[-0.46, 1], [-0.16, -1], [0.24, -1], [0.54, 1]]
  for (const [ux, dir] of pairs) {
    leg(ctx, x + rx * ux, hipY, x + rx * (ux - 0.04) + dir * sw * rx * 0.2, footY, rx * 0.09, ry * 0.06, C.foxDark)
  }
  ctx.fillStyle = C.foxFur
  ctx.beginPath()
  ctx.ellipse(x + rx * 0.05, y + ry * 0.02, rx * 0.85, ry * 0.44, -0.08, 0, TAU)
  ctx.fill()
  ctx.strokeStyle = C.foxFur
  ctx.lineWidth = Math.max(3, rx * 0.34)
  ctx.beginPath()
  ctx.moveTo(x - rx * 0.42, y - ry * 0.05)
  ctx.lineTo(x - rx * 0.12, hy + ry * 0.12)
  ctx.stroke()
  ctx.fillStyle = C.foxFur
  ctx.beginPath()
  ctx.ellipse(x, hy + ry * 0.04, rx * 0.44, ry * 0.34, 0, 0, TAU)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(x - rx * 0.32, hy + ry * 0.02)
  ctx.lineTo(x - rx * 0.86, hy + ry * 0.2)
  ctx.lineTo(x - rx * 0.3, hy + ry * 0.24)
  ctx.closePath()
  ctx.fill()
  for (const s of [-1, 1]) {
    ctx.fillStyle = C.foxFur
    ctx.beginPath()
    ctx.moveTo(x + s * rx * 0.16, hy - ry * 0.16)
    ctx.lineTo(x + s * rx * 0.36, hy - ry * 0.7)
    ctx.lineTo(x + s * rx * 0.44, hy - ry * 0.1)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = C.foxEar
    ctx.beginPath()
    ctx.moveTo(x + s * rx * 0.24, hy - ry * 0.16)
    ctx.lineTo(x + s * rx * 0.34, hy - ry * 0.5)
    ctx.lineTo(x + s * rx * 0.38, hy - ry * 0.14)
    ctx.closePath()
    ctx.fill()
  }
}

/** ── 장승 — 나무 기둥. 다리가 없으니 좌우로 기우뚱거리며 온다. ── */
function jangseung(
  ctx: CanvasRenderingContext2D, w: World, x: number, rx: number, ry: number,
  footY: number, hy: number,
): void {
  // 기우뚱 — 밑동을 축으로 좌우로 기운다. 다리 없는 것이 걷는 유일한 문법이다.
  ctx.save()
  ctx.translate(x, footY)
  ctx.rotate(stepPhase(w) * 0.07)
  ctx.translate(-x, -footY)

  const halfW = rx * 0.6
  const top = hy - ry * 0.35
  ctx.fillStyle = C.wood
  ctx.fillRect(x - halfW, top, halfW * 2, footY - top)
  ctx.strokeStyle = C.woodDark
  ctx.lineWidth = Math.max(1, rx * 0.04)
  for (const s of [-0.3, 0.32]) {
    ctx.beginPath()
    ctx.moveTo(x + halfW * s, hy + ry * 0.1)
    ctx.lineTo(x + halfW * s * 0.7, footY - ry * 0.08)
    ctx.stroke()
  }
  // 밑동 — 땅에 박힌 자리. 흙이 조금 쌓여 있어야 서 있는 것으로 보인다.
  ctx.fillStyle = C.woodDark
  ctx.beginPath()
  ctx.ellipse(x, footY, halfW * 1.25, ry * 0.09, 0, 0, TAU)
  ctx.fill()
  // 벙거지 — 머리 위 넓은 지붕. 장승의 서명이다.
  ctx.fillStyle = C.woodDark
  ctx.beginPath()
  ctx.moveTo(x - rx, hy - ry * 0.42)
  ctx.lineTo(x + rx, hy - ry * 0.42)
  ctx.lineTo(x + rx * 0.55, hy - ry * 0.78)
  ctx.lineTo(x - rx * 0.55, hy - ry * 0.78)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = C.woodTooth
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(x - halfW * 0.72 + i * halfW * 0.38, hy + ry * 0.42, halfW * 0.26, ry * 0.2)
  }
  ctx.restore()
}

/** ── 저승사자 — 갓과 검은 도포. 자락이 땅에 닿아 쓸린다. ── */
function reaper(
  ctx: CanvasRenderingContext2D, w: World, x: number, y: number, rx: number, ry: number,
  footY: number, hy: number,
): void {
  const sw = stepPhase(w)
  const hem = sw * rx * 0.08
  ctx.fillStyle = C.robe
  ctx.beginPath()
  ctx.moveTo(x - rx * 0.42, hy + ry * 0.1)
  ctx.lineTo(x + rx * 0.42, hy + ry * 0.1)
  ctx.quadraticCurveTo(x + rx * 0.9, y + ry * 0.6, x + rx * 0.82 + hem, footY)
  // 자락 끝 — 땅에 닿아 물결친다. 걷는 것이 여기서 읽힌다.
  ctx.quadraticCurveTo(x + rx * 0.3, footY - ry * 0.08, x, footY)
  ctx.quadraticCurveTo(x - rx * 0.3, footY - ry * 0.08, x - rx * 0.82 + hem, footY)
  ctx.quadraticCurveTo(x - rx * 0.9, y + ry * 0.6, x - rx * 0.42, hy + ry * 0.1)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = C.robeEdge
  for (const s of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(x + s * rx * 0.4, y - ry * 0.35)
    ctx.quadraticCurveTo(x + s * rx * 1.05, y - ry * 0.05, x + s * rx * 0.86, y + ry * 0.42)
    ctx.lineTo(x + s * rx * 0.5, y + ry * 0.2)
    ctx.closePath()
    ctx.fill()
  }
  ctx.fillStyle = C.pale
  ctx.beginPath()
  ctx.ellipse(x, hy + ry * 0.02, rx * 0.36, ry * 0.32, 0, 0, TAU)
  ctx.fill()
  ctx.fillStyle = C.gat
  ctx.beginPath()
  ctx.ellipse(x, hy - ry * 0.34, rx * 1.15, ry * 0.16, 0, 0, TAU)
  ctx.fill()
  ctx.fillRect(x - rx * 0.42, hy - ry * 0.86, rx * 0.84, ry * 0.54)
  ctx.beginPath()
  ctx.ellipse(x, hy - ry * 0.86, rx * 0.42, ry * 0.12, 0, 0, TAU)
  ctx.fill()
}

// ─────────────────────────────────────────────────────────────────────────
//  얼굴 = 급소 (2026-09-11)
//
//  형: **"좆같은 눈깔은 뭔 모든보스에 들어가있어서 도깨비새끼는 왕눈이 뇌속에
//        들어있게 보여지고."**
//
//  그동안 급소는 **몸과 무관한 한 벌**이었다. scene.ts 가 여덟 전부에 같은 크기의 흰 눈알
//  하나를 얹었다. 유령 넷에게는 그게 몸 그 자체라 맞았지만, 2026-09-10 에 선 넷은 **얼굴이
//  이미 있는 것들**이다 — 그 위에 눈알을 더 얹으니 머리통에 눈이 하나 더 박혔다.
//
//  이제 규칙은 하나다: **급소는 그 몸이 원래 가진 눈이다.** 덧붙이지 않는다.
//    도깨비   부릅뜬 두 눈이 감겼다 떠진다 — 귀면와의 눈 그대로
//    구미호   가늘게 찢어진 여우 눈 둘. 호박색이라 흰 털 위에서 산다
//    장승     나무에 파인 왕방울 눈. 두들겨야 쪼개지며 **열린다** (guard 문법)
//    저승사자 갓 그늘 밑의 실눈 둘. 좀처럼 안 보이는 것이 이 놈의 성격이다
//
//  공통 문법 둘은 그대로 scene.ts 에 남는다 — **금빛 고리**(지금 쏴라)와 **별 셋**(멈췄다).
//  저건 눈이 아니라 신호라 여덟이 같아야 배우는 것이 하나다.
// ─────────────────────────────────────────────────────────────────────────

/**
 * 보스의 얼굴을 그린다 (look 4~7). (x, y)·rx·ry 는 몸, (fx, fy) 는 **급소의 화면 자리**
 * (sim/target.ts bossWeakSpot 과 같은 자리), fr 은 그 반경.
 * open 0~1 은 눈꺼풀 (sim Target.weak), stag 은 비틀거리는 중인가.
 * (px, py) 는 궁수의 화면 자리 — 눈동자가 거기를 본다.
 */
export function drawNewBossFace(
  ctx: CanvasRenderingContext2D, t: Target,
  x: number, y: number, rx: number, ry: number,
  fx: number, fy: number, fr: number,
  open: number, stag: boolean, px: number, py: number,
): void {
  // 멈춘 눈은 놀라서 커진다 — 만화의 문법. 감긴 눈은 실선 한 줄이 된다.
  const lid = stag ? 1.25 : open
  if (t.look === 4) return ogreEyes(ctx, x, y, rx, ry, lid, px, py)
  if (t.look === 5) return foxEyes(ctx, fx, fy, fr, lid, px, py)
  if (t.look === 6) return postEyes(ctx, fx, fy, fr, lid, stag)
  return reaperEyes(ctx, fx, fy, fr, lid, px, py)
}

/** 눈동자가 궁수 쪽으로 조금 쏠린 자리. 이 한 줄이 "노려본다"를 만든다. */
function gazeX(ex: number, ey: number, px: number, py: number, reach: number): number {
  const d = Math.hypot(px - ex, py - ey) || 1
  return ex + ((px - ex) / d) * reach
}
function gazeY(ex: number, ey: number, px: number, py: number, reach: number): number {
  const d = Math.hypot(px - ex, py - ey) || 1
  return ey + ((py - ey) / d) * reach
}

/** ── 도깨비 — 부릅뜬 두 눈. 귀면와(鬼面瓦)의 눈 그대로 감았다 뜬다. ── */
function ogreEyes(
  ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number,
  lid: number, px: number, py: number,
): void {
  // 얼굴 치수는 ogre() 와 **같은 식**이어야 눈이 얼굴 밖으로 안 나간다.
  const hcx = x - rx * 0.05
  const hcy = y - ry * 0.56
  const hw = rx * 0.62
  const hh = ry * 0.52
  const eh = hh * 0.21 * lid
  for (const s of [-1, 1] as const) {
    const ex = hcx + s * hw * 0.42
    const ey = hcy + hh * 0.16
    if (eh < hh * 0.035) {
      // 감았다 — 지금 쏘면 몸통이다. 굵은 선 한 줄이면 "감았다"가 멀리서도 읽힌다.
      ctx.strokeStyle = C.ogreDark
      ctx.lineWidth = Math.max(2, hh * 0.13)
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(ex - hw * 0.26, ey)
      ctx.lineTo(ex + hw * 0.26, ey)
      ctx.stroke()
      ctx.lineCap = 'butt'
      continue
    }
    ctx.fillStyle = C.eyeWhite
    ctx.beginPath()
    ctx.ellipse(ex, ey, hw * 0.27, eh, 0, 0, TAU)
    ctx.fill()
    const pr = Math.min(hw * 0.13, eh * 0.9)
    const gx = gazeX(ex, ey, px, py, hw * 0.1)
    const gy = gazeY(ex, ey, px, py, Math.min(hh * 0.06, eh * 0.4))
    ctx.fillStyle = C.ogreBlood
    ctx.beginPath()
    ctx.ellipse(gx, gy, pr * 1.55, Math.min(pr * 1.55, eh), 0, 0, TAU)
    ctx.fill()
    ctx.fillStyle = C.ogreDark
    ctx.beginPath()
    ctx.arc(gx, gy, pr, 0, TAU)
    ctx.fill()
    ctx.fillStyle = C.eyeWhite
    ctx.beginPath()
    ctx.arc(gx - pr * 0.4, gy - pr * 0.45, Math.max(0.8, pr * 0.3), 0, TAU)
    ctx.fill()
  }
}

/** ── 구미호 — 가늘게 찢어진 여우 눈 둘. 호박색이라 흰 털 위에서 산다. ── */
function foxEyes(
  ctx: CanvasRenderingContext2D, fx: number, fy: number, fr: number,
  lid: number, px: number, py: number,
): void {
  const eh = fr * 0.4 * lid
  for (const s of [-1, 1] as const) {
    const ex = fx + s * fr * 0.46
    const ey = fy - fr * 0.12
    if (eh < fr * 0.06) {
      ctx.strokeStyle = C.foxDark
      ctx.lineWidth = Math.max(1.6, fr * 0.12)
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(ex - fr * 0.34, ey + fr * 0.04)
      ctx.lineTo(ex + fr * 0.3, ey - fr * 0.06)
      ctx.stroke()
      ctx.lineCap = 'butt'
      continue
    }
    // 아몬드 — 안쪽 끝이 처지고 바깥 끝이 올라간다. 그 기울기가 여우다.
    ctx.save()
    ctx.translate(ex, ey)
    ctx.rotate(s * -0.28)
    ctx.fillStyle = C.foxEye
    ctx.beginPath()
    ctx.ellipse(0, 0, fr * 0.36, eh, 0, 0, TAU)
    ctx.fill()
    ctx.restore()
    // 세로 눈동자 — 짐승의 것이다. 사람 눈처럼 동그라면 그건 여우가 아니다.
    const gx = gazeX(ex, ey, px, py, fr * 0.1)
    ctx.fillStyle = '#14100c'
    ctx.beginPath()
    ctx.ellipse(gx, ey, Math.max(1, fr * 0.08), eh * 0.85, 0, 0, TAU)
    ctx.fill()
  }
}

/** ── 장승 — 나무에 파인 왕방울 눈. 두들겨야 쪼개지며 열린다 (guard 문법). ── */
function postEyes(
  ctx: CanvasRenderingContext2D, fx: number, fy: number, fr: number,
  lid: number, stag: boolean,
): void {
  for (const s of [-1, 1] as const) {
    const ex = fx + s * fr * 0.56
    const er = fr * 0.44
    // 파인 자리 — 언제나 보인다. 나무에 뚫린 구멍이지 눈꺼풀이 아니다.
    ctx.fillStyle = C.woodDark
    ctx.beginPath()
    ctx.arc(ex, fy, er, 0, TAU)
    ctx.fill()
    if (!stag && lid < 0.25) continue
    // 열렸다 — 구멍 안에서 흰자가 살아난다. 장승의 눈은 원래 왕방울이라 크게 뜬다.
    const k = Math.min(1, lid)
    ctx.fillStyle = C.woodTooth
    ctx.beginPath()
    ctx.arc(ex, fy, er * 0.78 * k, 0, TAU)
    ctx.fill()
    ctx.fillStyle = '#1a140c'
    ctx.beginPath()
    ctx.arc(ex, fy, er * 0.38 * k, 0, TAU)
    ctx.fill()
  }
  // 갈라진 나뭇결 — 두들겨 열린 자리라는 표시. 얼굴을 가로지르는 금 하나.
  if (stag) {
    ctx.strokeStyle = C.woodDark
    ctx.lineWidth = Math.max(1.4, fr * 0.12)
    ctx.beginPath()
    ctx.moveTo(fx - fr * 1.05, fy - fr * 0.62)
    ctx.lineTo(fx + fr * 0.3, fy + fr * 0.1)
    ctx.lineTo(fx + fr * 1.0, fy - fr * 0.4)
    ctx.stroke()
  }
}

/** ── 저승사자 — 갓 그늘 밑의 실눈 둘. 좀처럼 안 보이는 것이 이 놈의 성격이다. ── */
function reaperEyes(
  ctx: CanvasRenderingContext2D, fx: number, fy: number, fr: number,
  lid: number, px: number, py: number,
): void {
  const eh = fr * 0.3 * lid
  for (const s of [-1, 1] as const) {
    const ex = fx + s * fr * 0.42
    const ey = fy - fr * 0.05
    if (eh < fr * 0.05) {
      ctx.strokeStyle = '#5a5f6a'
      ctx.lineWidth = Math.max(1.4, fr * 0.1)
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(ex - fr * 0.28, ey)
      ctx.lineTo(ex + fr * 0.28, ey)
      ctx.stroke()
      ctx.lineCap = 'butt'
      continue
    }
    // 뜬 눈은 **빛난다.** 죽은 낯빛 위의 두 점이라야 저승의 것으로 보인다.
    ctx.fillStyle = C.reaperGlow
    ctx.beginPath()
    ctx.ellipse(ex, ey, fr * 0.3, eh, 0, 0, TAU)
    ctx.fill()
    const gx = gazeX(ex, ey, px, py, fr * 0.08)
    ctx.fillStyle = '#0b0d11'
    ctx.beginPath()
    ctx.ellipse(gx, ey, Math.max(1, fr * 0.09), Math.min(eh * 0.9, fr * 0.16), 0, 0, TAU)
    ctx.fill()
  }
}
