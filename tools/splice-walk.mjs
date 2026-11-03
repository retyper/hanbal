/**
 * 20컷 띠(병사 v2 · 장수 gen-*)의 걷기 8컷(4~11번 칸)만 새 8컷 띠로 갈아 끼운다 (형 11-03: "왼다리를 땅에 디딘 그림만 8장 · 움직이는 모션이 전혀 아니야").
 *
 * 제미나이가 처음 그린 걷기 8컷이 거의 같은 자세였다 — 서기·공격·맞음·쓰러짐은 멀쩡하니 걷기만 다시 받아 끼운다.
 * 새 컷은 옛 띠의 서기 0번 칸과 키(잉크 높이)·발 줄(잉크 맨 아래)·몸 가운데(잉크 무게중심)를 맞춰 넣는다 — 걷다 서도 몸이 커지거나 튀지 않게.
 *
 *   node tools/splice-walk.mjs <옛 20컷 띠.png> <새 8컷 띠.png (tools/strip-frames.mjs 결과)> <out.png> [첫 걷기 칸=4]
 */
import { writeFileSync } from 'node:fs'
import { decodePng, encodePng, boxResize } from './png.mjs'

const [oldF, newF, out, w0S = '4'] = process.argv.slice(2)
if (out === undefined) throw new Error('쓰는 법은 이 파일 머리말에 있다')
const W0 = Number(w0S)
const A = decodePng(oldF)
const B = decodePng(newF)
const NF = 20
const cw = A.w / NF
const bw = B.w / 8

/** 칸 안 잉크의 위·아래·가로 무게중심 */
function ink(img, x0, w) {
  let top = img.h, bot = -1, sx = 0, n = 0
  for (let y = 0; y < img.h; y++) for (let x = 0; x < w; x++) {
    if (img.px[(y * img.w + Math.floor(x0 + x)) * 4 + 3] > 60) { if (y < top) top = y; if (y > bot) bot = y; sx += x; n++ }
  }
  return { top, bot, cx: n > 0 ? sx / n : w / 2 }
}

const ref = ink(A, 0, cw) // 서기 0번 칸
const refH = ref.bot - ref.top
const px = new Uint8Array(A.px) // 옛 띠를 그대로 두고 걷기 칸만 덮는다
for (let i = 0; i < 8; i++) {
  const dx0 = Math.round((W0 + i) * cw)
  const dw = Math.round((W0 + i + 1) * cw) - dx0
  for (let y = 0; y < A.h; y++) px.fill(0, (y * A.w + dx0) * 4, (y * A.w + dx0 + dw) * 4)
  const m = ink(B, i * bw, bw)
  const k = refH / Math.max(1, m.bot - m.top)
  const sw = Math.round(bw * k), sh = Math.round(B.h * k)
  const sc = boxResize(B, Math.round(i * bw), 0, Math.round(bw), B.h, sw, sh) // RGBA sw×sh
  const ox = Math.round(dx0 + ref.cx - m.cx * k)
  const oy = Math.round(ref.bot - m.bot * k)
  for (let y = 0; y < sh; y++) {
    const ty = oy + y
    if (ty < 0 || ty >= A.h) continue
    for (let x = 0; x < sw; x++) {
      const tx = ox + x
      if (tx < dx0 || tx >= dx0 + dw) continue // 옆 칸으로 넘치는 것은 자른다
      const s = (y * sw + x) * 4
      if (sc[s + 3] === 0) continue
      px.set(sc.subarray(s, s + 4), (ty * A.w + tx) * 4)
    }
  }
}
writeFileSync(out, encodePng(A.w, A.h, px))
console.log(`${out}: 걷기 칸 ${W0}~${W0 + 7} 갈아 끼움 · 서기 키 ${refH}px 에 맞춤`)
