/**
 * UI 문양 테두리에 색을 입힌다 — **원본 팔레트를 바꿔서.**
 *
 * 원본: Kenney 'Fantasy UI Borders' (CC0) — https://kenney.nl/assets/fantasy-ui-borders
 *   zip 을 받아 assets_src/fub/ 에 풀면 아래 SRC 경로가 맞는다.
 *   (assets_src/ 는 .gitignore 다 — 원본 팩은 저장소에 넣지 않는다.)
 * 결과: public/ui/*.png (한 장 161~173바이트). 출처는 public/ui/출처.txt.
 *
 * 왜 CSS filter 가 아닌가: filter 로 흰색을 물들이면 브라우저마다 결과가 미묘하게 다르고,
 * mask-border 는 파이어폭스가 아직 못 읽는다. 팔레트 항목 하나를 바꾸는 게 정확하고 싸다.
 * 원본 픽셀 배치는 건드리지 않는다.
 *
 * 실행: node tools/tint-frames.mjs
 */
// (CSS filter 로 흰색을 물들이는 것보다 정확하고, 브라우저 지원 문제도 없다.)
import fs from 'node:fs'

function crc(buf) {
  let c = ~0
  for (const b of buf) { c ^= b; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)) }
  return ~c >>> 0
}

function retint(src, dst, hex) {
  const b = fs.readFileSync(src)
  const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  let o = 8
  let done = false
  while (o < b.length) {
    const len = b.readUInt32BE(o)
    const type = b.toString('ascii', o + 4, o + 8)
    if (type === 'PLTE') {
      // 팔레트는 2색(투명 배경 + 흰 선). tRNS 가 0번을 투명으로 잡으므로 1번만 칠하면 된다.
      // 안전하게 '흰색에 가까운 항목'만 바꾼다.
      for (let i = 0; i < len; i += 3) {
        const p = o + 8 + i
        if (b[p] > 200 && b[p + 1] > 200 && b[p + 2] > 200) {
          b[p] = rgb[0]; b[p + 1] = rgb[1]; b[p + 2] = rgb[2]
          done = true
        }
      }
      const td = b.subarray(o + 4, o + 8 + len)
      b.writeUInt32BE(crc(td), o + 8 + len)
    }
    o += 12 + len
  }
  if (!done) throw new Error('흰 팔레트 항목을 못 찾았다: ' + src)
  fs.writeFileSync(dst, b)
  console.log(dst, '←', hex)
}

const UI = 'D:/flutter/arrow_game_one/public/ui/'
const SRC = 'D:/flutter/arrow_game_one/assets_src/fub/PNG/Double/Border/'
retint(SRC + 'panel-border-003.png', UI + 'frame-panel.png', '#c9a468')
retint(SRC + 'panel-border-009.png', UI + 'frame-card.png', '#7c7466')
retint(SRC + 'panel-border-009.png', UI + 'frame-card-on.png', '#7fd6c8')
