// 싸움터 장수 그림이 제 결 그림 없이 다른 결로 대신 서는 장수를 센다 — 여인이 남자 칼잡이로 서는 등
// npx tsx tools/gen-sprite-cover.ts
import { HERO_POOL } from '../src/realm/data/heroes-pool.ts'
import { genArtOf, generalSprite } from '../src/realm/data/art.ts'

const miss: string[] = []
for (const h of HERO_POOL) {
  const k = generalSprite(h)
  const a = genArtOf(k)
  if (a.kind !== k) miss.push(`${h.id} ${h.name} ${h.look} ${k} -> ${a.kind}`)
}
console.log(`대신 서는 장수 ${miss.length} / ${HERO_POOL.length}`)
console.log(miss.join('\n'))
