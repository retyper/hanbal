// release-pack 과 같은 1차 각성 영상 문안 — npx tsx tools/veo/prompt-for.ts <id>
import { readFileSync } from 'node:fs'
const lines = JSON.parse(readFileSync('tools/veo/tier1-lines-20261115.json', 'utf8'))
const src = readFileSync('tools/release-pack.mjs', 'utf8')
const BODY = eval('(' + src.match(/const BODY = (\{[\s\S]*?\n\})/)![1] + ')')
const l = lines[process.argv[2]!]
const P = l.sex === 'she' ? 'She' : 'He', p = l.sex === 'she' ? 'her' : 'his'
console.log([
  `Animate this fantasy game illustration into a 10-second vertical 9:16 video. ${P} is a fictional painted character, not a real person. Keep the same character, face, painted art style, outfit, colors and framing exactly as in the image.`,
  `${l.who} ${l.motion}`,
  BODY[l.sex === 'she' ? 'she' : 'he'],
  `${P} looks straight into the camera for most of the clip. The face stays alive: natural blinks, the eyes move a little, the expression softens and comes back. Same face, same painted style, ${p} hands keep the same grip.`,
  'Slow smooth motion in one continuous shot, the last second returns close to the first frame so it can loop. Silent: no dialogue, no speech, no singing, only soft ambient sound. No text, no logo.',
].join('\n\n'))
