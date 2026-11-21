// manifest.json → src/realm/data/spritePx.ts 만 다시 쓴다 (머리 장식 보정 applyHeadgear 는 돌리지 않음 · attack8-intake.py --widen 이 부른다)
import { readFileSync, writeFileSync } from 'node:fs'
import { spritePxTs } from './headgear.mjs'
const all = JSON.parse(readFileSync('public/realm/anim-px/manifest.json', 'utf8'))
writeFileSync('src/realm/data/spritePx.ts', spritePxTs(all))
console.log('spritePx.ts 다시 씀', Object.keys(all).length)
