// dash-install.mjs — 장수 「뛰어드는 자세」 한 칸을 공개 폴더로 옮기고 표(src/raid/dash-cells.ts)를 다시 만든다 (손으로 고치지 않는다)
//   node tools/sprite-kit/dash-install.mjs            → tools/out/a2/cells/gen-<띠 열쇠>-dash.png 를 public/realm/anim-px/dash/gen-<띠 열쇠>.png 로
//   배율이 어긋난 장수는 tools/sprite-kit/dash-scale.json ({"띠 열쇠": 배율}) 에 적는다 (그림은 그대로 · 그리는 쪽이 곱한다)
//   검사: PNG 머리글 · 0바이트 아님 · 폭 240 높이 224 (덧띠 규격 xGeom {h:224, root:92, foot:216})
import { readdirSync, readFileSync, writeFileSync, copyFileSync, mkdirSync, existsSync } from 'node:fs'
const SRC = 'tools/out/a2/cells', DST = 'public/realm/anim-px/dash', W = 240, H = 224
mkdirSync(DST, { recursive: true })
const scale = existsSync('tools/sprite-kit/dash-scale.json') ? JSON.parse(readFileSync('tools/sprite-kit/dash-scale.json', 'utf8')) : {}
const have = new Set(readdirSync(DST).filter(f => /^gen-.+\.png$/.test(f)).map(f => f.slice(4, -4)))
for (const f of existsSync(SRC) ? readdirSync(SRC) : []) {
  const m = /^gen-(.+)-dash\.png$/.exec(f); if (!m) continue
  const buf = readFileSync(`${SRC}/${f}`)
  if (buf.length < 100 || buf.readUInt32BE(0) !== 0x89504e47 || buf.readUInt32BE(12) !== 0x49484452) { console.error('건너뜀(PNG 아님·0바이트):', f); continue }
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20)
  if (w !== W || h !== H) { console.error(`건너뜀(크기 ${w}x${h} ≠ ${W}x${H}):`, f); continue }
  copyFileSync(`${SRC}/${f}`, `${DST}/gen-${m[1]}.png`); have.add(m[1])
}
const keys = [...have].sort()
const rows = keys.map(k => `  ${/^[a-z_][a-z0-9_]*$/i.test(k) ? k : JSON.stringify(k)}: ${scale[k] ?? 1},`).join('\n')
writeFileSync('src/raid/dash-cells.ts', `// 자동 생성 — tools/sprite-kit/dash-install.mjs (손으로 고치지 말 것) · ${keys.length}명
// 대시 칸이 있는 장수(띠 열쇠 gen-<열쇠>) → 그리는 배율 (그림 파일: public/realm/anim-px/dash/gen-<열쇠>.png · 한 칸 ${W}×${H})
export const DASH_CELLS: Readonly<Record<string, number>> = {\n${rows}\n}\n`)
console.log(keys.length, '명')
