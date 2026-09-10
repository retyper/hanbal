/**
 * 보스의 몸 — 2026-09-10 에 선 넷 (거인과 한국 전통 귀신들)
 *
 * 형: **"보스는 왜 둥둥 떠댕기는 귀신밖에 없냐. 거인형 보스, 한국 전통 귀신 보스들 많잖아."**
 *
 * 맞는 말이었다. 넷이 있었지만 넷 다 **같은 유령 덩어리**에 장식만 달랐다 — 실루엣이 하나였으니
 * 로스터가 아니라 색만 다른 한 놈이었다. 그래서 넷을 새로 세웠다:
 *
 *   4 도깨비    **거인**. 떡 벌어진 어깨, 뿔 둘, 어깨에 걸친 방망이
 *   5 구미호    흰 여우. 꼬리 아홉이 뒤로 부챗살처럼 펴져 흔들린다
 *   6 장승      마을 어귀의 나무 기둥. 벙거지와 네모 이빨, 두들기면 금이 간다
 *   7 저승사자  갓과 검은 도포. 챙 밑의 창백한 얼굴
 *
 * (0~3 — 눈알·갑주·쌍눈·폭주 — 은 유령 계열이라 render/scene.ts 에 그대로 남는다.)
 *
 * ── 이 파일이 지키는 것 ────────────────────────────────────────────────
 * 1. **약점은 언제나 같은 자리다.** sim 은 몸 중심에서 위로 r×bossHeadUp(0.78), 반경
 *    r×bossHeadR(0.34) 을 약점으로 본다 (sim/target.ts). 넷 다 그 자리에 얼굴이 오도록 그린다 —
 *    그림과 판정이 어긋나면 "맞았는데 안 맞았다"가 되고, 그건 이 게임에서 가장 큰 죄다.
 * 2. **읽기만 한다** (A1). 시간축은 w.elapsed 하나뿐이라 같은 시드가 같은 그림을 낸다.
 * 3. 눈·약점 고리·별·체력 바는 여기서 안 그린다 — 여덟이 공유하므로 scene.ts 에 남는다.
 */
import { TAU } from '../core/math.ts'
import { P } from '../tune/params.ts'
import type { Target, World } from '../sim/types.ts'

/** 넷의 색. 실루엣이 달라도 어두운 배경에서 읽히려면 밝기 차가 있어야 한다. */
const C = {
  ogreSkin: '#6b3a2e',
  ogreDark: '#43231b',
  ogreHorn: '#e6dcc4',
  ogreCloth: '#b5762f',
  club: '#5a4630',
  clubStud: '#cbb894',
  foxFur: '#ece5d8',
  foxDark: '#c2b49c',
  foxEar: '#8d5a4a',
  wood: '#6b5334',
  woodDark: '#3f3020',
  woodTooth: '#ded2b6',
  robe: '#15171d',
  robeEdge: '#3a3f4a',
  gat: '#0e1014',
  pale: '#cfc3ae',
} as const

/**
 * 보스 한 마리의 몸 (look 4~7). (x, y) 는 몸 중심, rx·ry 는 이미 눌림이 반영된 반경 (px).
 * 얼굴 자리는 y − ry × bossHeadUp — 그 위에 scene.ts 가 눈을 얹는다.
 */
export function drawNewBossBody(
  ctx: CanvasRenderingContext2D, w: World, t: Target, x: number, y: number, rx: number, ry: number,
): void {
  const hy = y - ry * P.target.bossHeadUp
  const breathe = Math.sin(w.elapsed * 1.6)

  if (t.look === 4) {
    // ── 도깨비 — 거인 (형: "거인형 보스"). ──
    // 방망이가 숨결에 맞춰 들썩인다. 무거운 것이 가만히 있으면 종이로 보인다.
    const club = breathe * ry * 0.05
    ctx.strokeStyle = C.club
    ctx.lineWidth = Math.max(4, rx * 0.19)
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(x + rx * 0.28, y + ry * 0.15 + club)
    ctx.lineTo(x + rx * 1.05, y - ry * 0.95 + club)
    ctx.stroke()
    ctx.lineCap = 'butt'
    ctx.fillStyle = C.clubStud
    for (let i = 0; i < 3; i++) {
      const s = 0.55 + i * 0.2
      ctx.beginPath()
      ctx.arc(x + rx * (0.28 + 0.77 * s), y + ry * (0.15 - 1.1 * s) + club, Math.max(1.5, rx * 0.05), 0, TAU)
      ctx.fill()
    }
    // 몸 — 어깨가 넓고 허리로 갈수록 좁다. 거인의 문법은 사다리꼴이다.
    ctx.fillStyle = C.ogreSkin
    ctx.beginPath()
    ctx.moveTo(x - rx * 1.02, y - ry * 0.3)
    ctx.quadraticCurveTo(x, y - ry * 0.62, x + rx * 1.02, y - ry * 0.3)
    ctx.lineTo(x + rx * 0.6, y + ry)
    ctx.lineTo(x - rx * 0.6, y + ry)
    ctx.closePath()
    ctx.fill()
    // 호랑이 가죽 허리춤 — 한 줄이면 '입은 것'이 된다.
    ctx.fillStyle = C.ogreCloth
    ctx.fillRect(x - rx * 0.68, y + ry * 0.42, rx * 1.36, ry * 0.26)
    // 팔 — 왼팔은 늘어뜨리고, 오른팔이 방망이를 쥔다.
    ctx.strokeStyle = C.ogreDark
    ctx.lineWidth = Math.max(3, rx * 0.16)
    ctx.beginPath()
    ctx.moveTo(x - rx * 0.92, y - ry * 0.22)
    ctx.lineTo(x - rx * 1.05, y + ry * 0.62)
    ctx.moveTo(x + rx * 0.9, y - ry * 0.22)
    ctx.lineTo(x + rx * 0.32, y + ry * 0.2 + club)
    ctx.stroke()
    // 머리 — 약점 자리를 감싸는 큰 덩어리. 뿔 둘과 송곳니 둘.
    ctx.fillStyle = C.ogreSkin
    ctx.beginPath()
    ctx.ellipse(x, hy + ry * 0.06, rx * 0.62, ry * 0.5, 0, 0, TAU)
    ctx.fill()
    ctx.fillStyle = C.ogreHorn
    for (const s of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(x + s * rx * 0.5, hy - ry * 0.18)
      ctx.lineTo(x + s * rx * 0.78, hy - ry * 0.78)
      ctx.lineTo(x + s * rx * 0.28, hy - ry * 0.3)
      ctx.closePath()
      ctx.fill()
    }
    for (const s of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(x + s * rx * 0.3, hy + ry * 0.38)
      ctx.lineTo(x + s * rx * 0.18, hy + ry * 0.62)
      ctx.lineTo(x + s * rx * 0.08, hy + ry * 0.38)
      ctx.closePath()
      ctx.fill()
    }
    return
  }

  if (t.look === 5) {
    // ── 구미호 — 흰 여우. 꼬리 아홉이 부챗살로 펴져 흔들린다. ──
    // 다리를 쏘면 넘어진다 (sim 의 leg 문법) — 그래서 다리를 **보이게** 그린다.
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
    // 다리 넷 — 여기가 약점이다. 가늘지만 또렷하게.
    ctx.strokeStyle = C.foxDark
    ctx.lineWidth = Math.max(2, rx * 0.09)
    for (const s of [-0.45, -0.15, 0.25, 0.55]) {
      ctx.beginPath()
      ctx.moveTo(x + rx * s, y + ry * 0.35)
      ctx.lineTo(x + rx * (s - 0.05), y + ry)
      ctx.stroke()
    }
    // 몸 — 낮고 길다. 네발짐승의 문법.
    ctx.fillStyle = C.foxFur
    ctx.beginPath()
    ctx.ellipse(x + rx * 0.05, y + ry * 0.05, rx * 0.85, ry * 0.46, -0.08, 0, TAU)
    ctx.fill()
    // 목과 머리 — 약점 자리로 올라간다. 주둥이는 앞(-x)으로.
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
    // 귀 둘 — 뾰족해야 여우다.
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
    return
  }

  if (t.look === 6) {
    // ── 장승 — 마을 어귀의 나무 기둥. 걸어온다는 것 자체가 무섭다. ──
    // 몸통은 판금 대신 **나무**다 (armored). 두들길수록 금이 간다 (Target.guardHits).
    const halfW = rx * 0.6
    const top = hy - ry * 0.35
    ctx.fillStyle = C.wood
    ctx.fillRect(x - halfW, top, halfW * 2, y + ry * 1.05 - top)
    // 나뭇결 — 세로 두 줄. 이게 없으면 그냥 갈색 상자다.
    ctx.strokeStyle = C.woodDark
    ctx.lineWidth = Math.max(1, rx * 0.04)
    for (const s of [-0.3, 0.32]) {
      ctx.beginPath()
      ctx.moveTo(x + halfW * s, hy + ry * 0.1)
      ctx.lineTo(x + halfW * s * 0.7, y + ry * 0.95)
      ctx.stroke()
    }
    // 금 — 두들긴 만큼. 규칙이 진행 중임을 몸이 말한다 (갑주귀신의 갑옷 게이지와 같은 뜻).
    ctx.lineWidth = Math.max(1.5, rx * 0.06)
    for (let i = 0; i < t.guardHits && i < 4; i++) {
      const cy = y + ry * (0.1 + i * 0.26)
      ctx.beginPath()
      ctx.moveTo(x - halfW, cy)
      ctx.lineTo(x - halfW * 0.2, cy + ry * 0.1)
      ctx.lineTo(x + halfW * 0.4, cy - ry * 0.06)
      ctx.lineTo(x + halfW, cy + ry * 0.05)
      ctx.stroke()
    }
    // 벙거지 — 머리 위 넓은 지붕. 장승의 서명이다.
    ctx.fillStyle = C.woodDark
    ctx.beginPath()
    ctx.moveTo(x - rx, hy - ry * 0.42)
    ctx.lineTo(x + rx, hy - ry * 0.42)
    ctx.lineTo(x + rx * 0.55, hy - ry * 0.78)
    ctx.lineTo(x - rx * 0.55, hy - ry * 0.78)
    ctx.closePath()
    ctx.fill()
    // 네모 이빨 — 얼굴 아래. 눈은 scene.ts 가 약점 자리에 그린다.
    ctx.fillStyle = C.woodTooth
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(x - halfW * 0.72 + i * halfW * 0.38, hy + ry * 0.42, halfW * 0.26, ry * 0.2)
    }
    return
  }

  // ── 저승사자 — 갓과 검은 도포. 얼굴은 챙 밑에 있다. ──
  // 이 게임에서 가장 어두운 실루엣이다. 색이 없어서 무섭다.
  const hem = Math.sin(w.elapsed * 1.9) * rx * 0.06
  ctx.fillStyle = C.robe
  ctx.beginPath()
  ctx.moveTo(x - rx * 0.42, hy + ry * 0.1)
  ctx.lineTo(x + rx * 0.42, hy + ry * 0.1)
  ctx.quadraticCurveTo(x + rx * 0.9, y + ry * 0.6, x + rx * 0.78 + hem, y + ry * 1.05)
  ctx.lineTo(x - rx * 0.78 + hem, y + ry * 1.05)
  ctx.quadraticCurveTo(x - rx * 0.9, y + ry * 0.6, x - rx * 0.42, hy + ry * 0.1)
  ctx.closePath()
  ctx.fill()
  // 소매 둘 — 넓게 늘어진다. 팔이 안 보여야 사람이 아니게 된다.
  ctx.fillStyle = C.robeEdge
  for (const s of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(x + s * rx * 0.4, y - ry * 0.35)
    ctx.quadraticCurveTo(x + s * rx * 1.05, y - ry * 0.05, x + s * rx * 0.86, y + ry * 0.42)
    ctx.lineTo(x + s * rx * 0.5, y + ry * 0.2)
    ctx.closePath()
    ctx.fill()
  }
  // 챙 밑의 창백한 얼굴 — 약점 자리를 받쳐 준다.
  ctx.fillStyle = C.pale
  ctx.beginPath()
  ctx.ellipse(x, hy + ry * 0.02, rx * 0.36, ry * 0.32, 0, 0, TAU)
  ctx.fill()
  // 갓 — 넓은 챙 + 원통 관. 이 둘이면 조선의 죽음이 된다.
  ctx.fillStyle = C.gat
  ctx.beginPath()
  ctx.ellipse(x, hy - ry * 0.34, rx * 1.15, ry * 0.16, 0, 0, TAU)
  ctx.fill()
  ctx.fillRect(x - rx * 0.42, hy - ry * 0.86, rx * 0.84, ry * 0.54)
  ctx.beginPath()
  ctx.ellipse(x, hy - ry * 0.86, rx * 0.42, ry * 0.12, 0, 0, TAU)
  ctx.fill()
}
