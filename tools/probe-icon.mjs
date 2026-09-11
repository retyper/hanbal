/**
 * 아이콘 프로브 — **활이 거꾸로가 아닌지 그림에서 직접 잰다** (2026-09-11)
 *
 * 형: **"신궁아이콘 ㅋㅋㅋ 병신아 활을 꺼꾸로 쏘냐???"**
 *
 * 맞는 말이었고, 고친 지금도 같은 실수가 다시 들어올 수 있다 — 부호 하나면 뒤집힌다.
 * 그래서 **만들어진 PNG 를 도로 뜯어서** 잰다. 코드를 읽는 게 아니라 그림을 읽는다:
 * 소스가 맞아도 굽는 과정에서 어긋나면 화면에 나오는 건 그림 쪽이기 때문이다.
 *
 * 재는 것 — 활의 법칙 하나면 전부 나온다:
 *   **화살은 촉 쪽으로 난다. 시위는 그 반대쪽. 활채의 배는 촉 쪽.**
 *   ① 촉(강조색 #ffb347)의 무게중심이 오른쪽에 있다        → 화살이 오른쪽으로 난다
 *   ② 시위(#8d97a3)는 활채의 배보다 **왼쪽**에 있다        → 거꾸로가 아니다
 *   ③ 화살대가 시위를 **뚫고 뒤로 나가지 않는다**          → 오늬가 시위에 걸려 있다
 *   ④ 세 크기(192·512·180)가 전부 같은 그림이다
 *   ⑤ 그림이 안쪽 안전 구역 안에 있다 (안드로이드 maskable 이 가장자리를 깎는다)
 *
 * 실행: node tools/probe-icon.mjs   (틀리면 종료 코드 1)
 */
import { inflateSync } from 'node:zlib'
import { readFileSync } from 'node:fs'

/** PNG 하나를 {w, h, px} 로 뜯는다. make-icons.mjs 가 필터 0(None)으로만 굽는다. */
function decodePng(file) {
  const buf = readFileSync(file)
  let at = 8
  let w = 0
  let h = 0
  const idat = []
  while (at < buf.length) {
    const len = buf.readUInt32BE(at)
    const type = buf.toString('latin1', at + 4, at + 8)
    const data = buf.subarray(at + 8, at + 8 + len)
    if (type === 'IHDR') {
      w = data.readUInt32BE(0)
      h = data.readUInt32BE(4)
      if (data[8] !== 8 || data[9] !== 6) throw new Error(`${file}: 8비트 RGBA 가 아니다`)
    } else if (type === 'IDAT') idat.push(data)
    else if (type === 'IEND') break
    at += 12 + len
  }
  const raw = inflateSync(Buffer.concat(idat))
  const stride = w * 4 + 1
  const px = new Uint8Array(w * h * 4)
  for (let y = 0; y < h; y++) {
    const f = raw[y * stride]
    if (f !== 0) throw new Error(`${file}: 줄 ${y} 의 필터가 ${f} 다 (0만 굽는다)`)
    raw.copy(px, y * w * 4, y * stride + 1, y * stride + 1 + w * 4)
  }
  return { w, h, px }
}

/** 이 색에 가까운 점들의 무게중심과 개수. 좌표는 −0.5..0.5 (가운데가 0). */
function blob(img, hexColor, tol = 26) {
  const want = [
    parseInt(hexColor.slice(1, 3), 16),
    parseInt(hexColor.slice(3, 5), 16),
    parseInt(hexColor.slice(5, 7), 16),
  ]
  let n = 0
  let sx = 0
  let sy = 0
  let minX = 1
  let maxX = -1
  let minY = 1
  let maxY = -1
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      const i = (y * img.w + x) * 4
      if (Math.abs(img.px[i] - want[0]) > tol) continue
      if (Math.abs(img.px[i + 1] - want[1]) > tol) continue
      if (Math.abs(img.px[i + 2] - want[2]) > tol) continue
      const u = (x + 0.5) / img.w - 0.5
      const v = (y + 0.5) / img.h - 0.5
      n++
      sx += u
      sy += v
      if (u < minX) minX = u
      if (u > maxX) maxX = u
      if (v < minY) minY = v
      if (v > maxY) maxY = v
    }
  }
  return { n, cx: n > 0 ? sx / n : 0, cy: n > 0 ? sy / n : 0, minX, maxX, minY, maxY }
}

let fails = 0
const check = (ok, label, detail = '') => {
  if (!ok) fails++
  console.log(`  ${ok ? 'ok ' : '✗  '} ${label.padEnd(46)} ${detail}`)
}
const num = (v) => (v >= 0 ? '+' : '') + v.toFixed(3)

console.log('신궁 — 아이콘 프로브 (형: "활을 꺼꾸로 쏘냐???")\n')

const HEAD = '#ffb347'
const STRING = '#8d97a3'
const BOW = '#d9cba6'
/** 손잡이 — **오직 활채의 배에만** 쓰는 색이다. 배가 어디인지 재려면 이걸 봐야 한다.
    처음엔 활채 색(#d9cba6)의 가장 오른쪽 점으로 쟀는데, 깃(fletching)이 같은 색이라
    깃을 배로 착각해 **거꾸로 그린 아이콘도 통과시켰다.** 색이 겹치면 재는 것도 겹친다. */
const GRIP = '#8a7550'

const main = decodePng('public/icon-512.png')

/**
 * 이 아이콘이 **우리가 그린 벡터판**인가. 활채·시위·촉을 색으로 찾아 재는 검사라,
 * 형이 받아온 그림으로 갈아 끼우면(docs/ICON.md) 그 색이 없어 뜻이 없어진다.
 * 그때는 방향을 재지 않고 넘어간다 — 그림의 방향은 형이 눈으로 본다.
 */
const ours = blob(main, HEAD).n > 200 && blob(main, STRING).n > 200 && blob(main, GRIP).n > 200

console.log('1. 활의 방향')
if (!ours) {
  console.log('  --  형이 받아온 그림이다 — 색으로 재는 검사는 건너뛴다 (docs/ICON.md 4번으로 눈으로 볼 것)')
} else {
  const head = blob(main, HEAD)
  const str = blob(main, STRING)
  const bow = blob(main, BOW)
  check(head.n > 0 && str.n > 0 && bow.n > 0, '촉·시위·활채가 다 그려졌다',
    `촉 ${head.n} · 시위 ${str.n} · 활채 ${bow.n}px`)

  // ① 화살은 촉 쪽으로 난다 — 촉의 무게중심이 한쪽에 몰려 있어야 방향이 있다.
  const shootRight = head.cx > 0
  check(Math.abs(head.cx) > 0.05, '화살에 방향이 있다', `촉 무게중심 u=${num(head.cx)}`)

  // ② 활채의 **배**는 시위보다 촉 쪽에 있어야 한다. 아니면 거꾸로 쥔 활이다.
  //    배는 손잡이 색으로 잰다 — 활채 색은 깃과 겹쳐서 못 쓴다 (위 GRIP 주석).
  const grip = blob(main, GRIP)
  check(grip.n > 0, '손잡이가 그려졌다', `${grip.n}px`)
  const ahead = shootRight ? grip.cx > str.cx : grip.cx < str.cx
  check(ahead, '활채의 배가 시위보다 과녁 쪽이다 (거꾸로가 아니다)',
    `손잡이 u=${num(grip.cx)} · 시위 u=${num(str.cx)}`)
  // 배와 시위 사이가 너무 가까우면 활이 아니라 막대다 (브레이스 높이).
  check(Math.abs(grip.cx - str.cx) > 0.08, '활이 실제로 휘어 있다',
    `배–시위 거리 ${Math.abs(grip.cx - str.cx).toFixed(3)}`)

  // ③ 화살이 시위를 뚫고 뒤로 나가지 않는다 — 오늬는 시위 위다.
  //    시위 뒤쪽(쏘는 사람 쪽)에 화살대 색이 있으면 활을 관통한 그림이다.
  let behind = 0
  for (let y = 0; y < main.h; y++) {
    for (let x = 0; x < main.w; x++) {
      const u = (x + 0.5) / main.w - 0.5
      if (shootRight ? u > str.cx - 0.02 : u < str.cx + 0.02) continue
      const i = (y * main.w + x) * 4
      // 화살대(#e3e9f0) 는 아주 밝다 — 바탕·활채와 헷갈리지 않는다.
      if (main.px[i] > 210 && main.px[i + 1] > 220 && main.px[i + 2] > 225) behind++
    }
  }
  check(behind === 0, '화살이 시위 뒤로 뚫고 나오지 않는다', `${behind}px`)
}

console.log('\n2. 자리와 크기')
if (!ours) {
  console.log('  --  받아온 그림의 여백·크기는 그린 사람이 잡는다 (docs/ICON.md 3번)')
} else {
  const bow = blob(main, BOW)
  const head = blob(main, HEAD)
  const lo = Math.min(bow.minX, head.minX)
  const hi = Math.max(bow.maxX, head.maxX)
  const top = Math.min(bow.minY, head.minY)
  const bot = Math.max(bow.maxY, head.maxY)
  // 안드로이드 maskable 은 가장자리를 깎는다 — 그림은 안쪽 원(반지름 0.4) 안에 있어야 한다.
  const SAFE = 0.42
  const inside = Math.max(Math.abs(lo), Math.abs(hi), Math.abs(top), Math.abs(bot)) <= SAFE
  check(inside, '그림이 깎이는 가장자리를 피한다',
    `u ${num(lo)}..${num(hi)} · v ${num(top)}..${num(bot)} (상한 ±${SAFE})`)
  // 너무 작으면 홈 화면에서 점이 된다.
  const fill = (hi - lo) * (bot - top)
  check(fill > 0.15, '그림이 아이콘을 충분히 채운다', `차지 넓이 ${(fill * 100).toFixed(0)}%`)
}

console.log('\n3. 세 크기가 같은 그림이다')
for (const [f, want] of [['public/icon-192.png', 192], ['public/apple-touch-icon.png', 180]]) {
  const img = decodePng(f)
  check(img.w === want && img.h === want, `${f} 가 ${want}x${want} 다`, `${img.w}x${img.h}`)
  if (!ours) continue
  const a = blob(img, HEAD)
  const b = blob(main, HEAD)
  const same = Math.abs(a.cx - b.cx) < 0.02 && Math.abs(a.cy - b.cy) < 0.02
  check(same, `${f} 의 촉이 같은 자리다`, `u=${num(a.cx)} v=${num(a.cy)}`)
}

console.log('')
if (fails > 0) {
  console.log(`실패 ${fails}건`)
  process.exit(1)
}
console.log('전부 통과')
