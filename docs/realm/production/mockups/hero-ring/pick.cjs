// 시안용 장수 목록 뽑기 (읽기만): 이름·생김·능력치 · 초상 · 전투 띠(있으면)
const fs = require('fs'), path = require('path')
const root = process.argv[2], out = process.argv[3]
const pool = fs.readFileSync(path.join(root, 'src/realm/data/heroes-pool.ts'), 'utf8')
const bust = fs.readFileSync(path.join(root, 'src/realm/data/hero-bust.ts'), 'utf8')
const f20 = fs.readFileSync(path.join(root, 'src/realm/data/full20Generated.ts'), 'utf8')
const B = {}; for (const m of bust.matchAll(/'([\w-]+)':\s*'([\w-]+)'/g)) B[m[1]] = m[2]
const spriteKey = {}; for (const m of f20.matchAll(/"([\w-]+)":\s*"([\w-]+)"/g)) spriteKey[m[1]] = m[2]
const tpl = JSON.parse(f20.match(/expandManifest\((\[\{.*?\}\])\s*,/s)[1])
const rowOf = {}; for (const m of f20.matchAll(/\["([\w-]+)",(\d+)\]/g)) rowOf[m[1]] = +m[2]
const list = []
for (const m of pool.matchAll(/[wg]\('([\w-]+)',\s*'([^']+)',\s*'([gw])',\s*\[([\d,\s]+)\]/g)) {
  const [, id, name, look, st] = m, b = B[id]
  if (!b || !fs.existsSync(path.join(root, 'public/realm/bust', b + '.jpg'))) continue
  const key = spriteKey[id] ?? ('base-' + b)
  const png = path.join(root, 'public/realm/anim-px', 'gen-' + key + '.png')
  let anim = null
  if (fs.existsSync(png) && rowOf[key] !== undefined) {
    const buf = fs.readFileSync(png), W = buf.readUInt32BE(16), t = tpl[rowOf[key]]
    anim = { file: 'gen-' + key + '.png', cell: W / t.cells, cells: t.cells, idle: t.idle, attack: t.attack }
  }
  const s = st.split(',').map(Number)
  const parts = name.split(' ')
  list.push({ id, bust: b, name: parts.at(-1), from: parts.length > 1 ? parts[0] : '', look, st: s.slice(0, 5), anim })
}
fs.writeFileSync(out, JSON.stringify(list))
fs.writeFileSync(out.replace(/\.json$/, '.txt'), list.map((h) => h.bust + ' ' + (h.anim ? h.anim.file : '-')).join('\n') + '\n')
console.log(list.length, 'heroes ·', list.filter((x) => x.anim).length, 'with anim')
