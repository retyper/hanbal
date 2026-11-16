// raid-kit-table.mjs — 장수 전투 그림 키 → 열전 무기 묶음 (활·창·칼·도끼) 표를 만든다 (형 11-15: 각성 시련을 모든 장수로 · 활·창·칼 먼저)
//   근거: tools/sprite-kit/nonawakened-20261113/queue.json 의 weapon (210명 전투 원장)
//   그 위에 tools/raid-kit-overrides.json (원화 기준 덮어쓰기) 을 얹는다
//   node tools/raid-kit-table.mjs → src/raid/kit-table.ts
import { readFileSync, writeFileSync } from 'node:fs'
const KIT = { bow: 'bow', spear: 'spear', trident: 'spear', glaive: 'spear', sword: 'sword', greatsword: 'sword', null: 'sword',
  // 11-16 형: 「단검도 있고 마법도 쓰는 거 같고」 → 단검 묶음 · 주술 묶음
  dagger: 'dagger', sickle: 'dagger', fists: 'dagger', whip: 'dagger', staff: 'magic', scepter: 'magic',
  axe: 'axe', hammer: 'axe', club: 'axe', heavy: 'axe', oar: 'axe', hoe: 'axe' }
const q = JSON.parse(readFileSync('tools/sprite-kit/nonawakened-20261113/queue.json', 'utf8'))
const table = { 'g-sword': 'sword', 'g-bow': 'bow', 'w-bow': 'bow', 'g-spear': 'spear', 'w-spear': 'spear', mount: 'spear' }
for (const r of q) { const k = KIT[String(r.weapon)]; if (!k) throw new Error(`무기 ${r.weapon} (${r.key}) 묶음 없음`); table[r.key] = k }
table.haebi = 'axe'
// 원화가 원장 무기보다 먼저다 (형 11-16: 감실은 원화가 방울인데 열전은 도끼였다)
//   tools/raid-kit-overrides.json · 근거는 tools/sprite-kit/weapon-audit-20261116.json (초상·1차 각성·전신 비기 그림으로 판정)
const KITS = new Set(Object.values(KIT))
const over = JSON.parse(readFileSync('tools/raid-kit-overrides.json', 'utf8'))
for (const [key, kit] of Object.entries(over)) {
  if (key.startsWith('_')) continue
  if (!KITS.has(kit)) throw new Error(`덮어쓰기 ${key}: 묶음 ${kit} 없음`)
  table[key] = kit
}
const count = {}; for (const k of Object.values(table)) count[k] = (count[k] ?? 0) + 1
writeFileSync('src/raid/kit-table.ts', `// 자동 생성 — tools/raid-kit-table.mjs (손으로 고치지 말 것) · ${JSON.stringify(count)}\nexport const KIT_BY_SPRITE: Readonly<Record<string, 'axe' | 'bow' | 'spear' | 'sword' | 'dagger' | 'magic'>> = ${JSON.stringify(table)}\n`)
console.log(count)
