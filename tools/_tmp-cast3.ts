import { readFileSync } from 'node:fs'
import { HERO_BUST } from '../src/realm/data/art.ts'
const vt = readFileSync('src/ui/realm/voice.ts', 'utf8')
const VO: Record<string, string> = {}
const voBlock = vt.split('const VOICE_OF: ')[1]!.split('\n}\n')[0]!
for (const m of voBlock.matchAll(/'([^']+)': '([a-z-]+)'/g)) VO[m[1]!] = m[2]!
const VF: Record<string, string> = {}
const vfBlock = vt.split('const VOICE_OF_FACE: ')[1]!.split('\n}\n')[0]!
for (const m of vfBlock.matchAll(/'([^']+)': '([a-z-]+)'/g)) VF[m[1]!] = m[2]!
const byFace: Record<string, string[]> = {}
for (const [id, f] of Object.entries(HERO_BUST as Record<string, string>)) (byFace[f] ??= []).push(id)
const SERIOUS = /진지|냉정|결연|과묵|침착|곧|단정|충직|서늘|차분|무뚝뚝|엄격|강직|묵묵|신중|굳|담담|절도|비장/
const LIGHT = /밝|들뜬|명랑|쾌활|장난|수다|허세|능청|겁|넉살|천진|발랄|호기심|해맑|익살|유쾌/
const GRUFF = /호탕|먹보|술|유쾌|우락|거칠|힘자랑|우직|다혈|불같|난폭/
for (const f of ['part-1', 'part-2', 'part-3', 'part-4', 'kids']) {
  const t = readFileSync(`docs/realm/cast/${f}.md`, 'utf8')
  for (const blk of t.split(/\n### /).slice(1)) {
    const head = blk.split('\n')[0]!
    const kid = f === 'kids'
    const id = kid ? head.split(' · ')[0]! : (/`([^`]+)`/.exec(head)?.[1] ?? '?')
    const face = kid ? id : (/그림 `([^`]+)`/.exec(head)?.[1] ?? '?')
    const age = Number(/나이 (\d+)/.exec(blk)?.[1] ?? 0)
    const sex = kid ? (id.startsWith('y-w') ? '여' : '남') : (/나이 \d+ · (남|여)/.exec(blk)?.[1] ?? '?')
    const per = /성격: ([^\n]*)/.exec(blk)?.[1] ?? ''
    const key = per.split(' — ')[0]!
    const vk = /목소리 결: (?:지금 )?`([^`]+)`(?: → (?:맞음|바꿈)(?:[^`\n]*`([^`]+)`)?)?/.exec(blk)
    const doc = vk?.[2] ?? vk?.[1] ?? '?'
    const ids = id === 'chief' || id === '?' ? (byFace[face] ?? []) : [id]
    const eff = (ids.map((x) => VO[x]).find((x) => x) ?? VF[face] ?? doc)
    let to = ''
    if (sex === '남' && age > 0 && age < 30 && SERIOUS.test(key) && !LIGHT.test(key) && ['m-young', 'm-gruff', 'm-elder'].includes(eff)) to = 'm-knight'
    if (sex === '여' && age > 0 && age < 30 && SERIOUS.test(key) && !LIGHT.test(key) && ['w-cool', 'w-bright'].includes(eff)) to = 'w-knight'
    if (sex === '남' && age >= 35 && age <= 50 && ['m-young', 'm-gruff'].includes(eff) && !(eff === 'm-gruff' && GRUFF.test(key))) to = 'm-veteran'
    if (sex === '여' && age >= 40 && ['w-cool', 'w-bright', 'w-sly'].includes(eff)) to = 'w-matron'
    console.log([to || '-', eff, age, sex, head.split(' · ')[0], ids.join(',') || id, face, key].join('\t'))
  }
}
