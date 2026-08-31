/**
 * 아이콘 SVG의 **검은 배경 사각형을 걷어낸다.**
 *
 * 원본: game-icons.net (CC BY 3.0) — https://github.com/game-icons/icons
 *   저장소의 파일은 전부 `<path d="M0 0h512v512H0z"/>` (검은 512 정사각) 위에
 *   흰 아이콘 path 를 얹은 모양이다. 그대로 쓰면 CSS mask(알파 기준)에서 **정사각형 덩어리**가
 *   된다 — 배경까지 불투명하기 때문이다. 배경 한 줄만 지우면 알파 마스크가 정확히 맞는다.
 *
 * 색은 CSS가 입힌다 (ui/overlay.ts .hb-ic — background: currentColor + mask-image).
 * 그래서 남은 path 의 fill 값은 무의미하다. 픽셀(패스 데이터)은 손대지 않는다.
 *
 * 실행: node tools/strip-icon-bg.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const DIR = 'public/icons'
/** 저장소가 쓰는 배경 사각형. 크기가 다른 변형도 같이 받는다. */
const BG = /<path d="M0 0h(\d+)v(\d+)H0z"\s*\/>/g

let changed = 0
let already = 0
for (const name of fs.readdirSync(DIR)) {
  if (!name.endsWith('.svg')) continue
  const p = path.join(DIR, name)
  const src = fs.readFileSync(p, 'utf8')
  const out = src.replace(BG, '')
  if (out === src) { already++; continue }
  if (!out.includes('<path')) throw new Error(`${name}: 배경을 지우니 남는 게 없다`)
  fs.writeFileSync(p, out)
  changed++
  console.log('  배경 제거', name)
}
console.log(`\n배경 지운 것 ${changed}개 · 이미 깨끗한 것 ${already}개`)
