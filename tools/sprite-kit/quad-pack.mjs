// quad-pack.mjs <key> [key …] — 장수마다 2×2 네 칸 판 네 장 문안 → tools/sprite-kit/quad/<key>-r1..r4.txt (11-12 소서노 판이 「아주 좋다」 · 형)
//   한 장수 = 새 대화 하나에 네 장: r1 1:1 걷기 1~4 (첨부 ref-r1 → 초상) · r2 1:1 걷기 5~8 (ref-r2) · r3 16:9 준비·당김·공격·맞음 (ref-r3) · r4 16:9 누움·서기·들숨·공격 뒤 (ref-r4)
//   네 칸 다 쓰고 4번 칸 사람은 왼쪽으로(우하단 귀 = 워터마크 자리 · 형: 자홍 네모 없어도 된다) · 받으면 <key>-r1..r4.png → py tools/sprite-kit/finish-quad.py <key>
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
const H = 'tools/sprite-kit/heroes/'
const spec = Object.fromEntries(readdirSync(H).filter((f) => f.endsWith('.json')).sort().flatMap((f) => JSON.parse(readFileSync(H + f, 'utf8'))).filter((x) => x.key).map((x) => [x.key, x]))
const WORD = { bow: 'bow', spear: 'spear', sword: 'sword', dagger: 'dagger', heavy: 'weapon' }
const CARRY = {
  spear: 'carried the same way in every cell, slanted with the tip up and forward, close to the body',
  sword: 'held low at the side in the same hand in every cell, blade pointing down and back',
  dagger: 'held low in the front hand in every cell',
  bow: 'held low in the left hand at the side in every cell',
  heavy: 'resting on the shoulder in the same way in every cell',
}
const ACT = {
  spear: ['READY: standing upright at full height, battle-ready, the spear held in both hands at waist height with the tip pointing forward-right', 'WIND-UP: pulling the spear back high, weight on the back foot', 'THRUST: lunging forward with the spear thrust fully to the right, arms straight, the spear tip far in front', 'FOLLOW-THROUGH: just after the thrust, the spear still pointing forward-right, the weight coming back onto the back foot'],
  sword: ['READY: standing upright at full height, battle-ready, the sword held in front', 'WIND-UP: raising the sword high overhead to strike', 'SLASH: slashing down and forward to the right, the sword extended low in front, arms straight', 'FOLLOW-THROUGH: just after the slash, the sword low in front, the body still turned forward'],
  dagger: ['READY: standing upright at full height, ready, the dagger in the front hand', 'WIND-UP: drawing the dagger hand back beside the hip', 'STAB: lunging forward and stabbing to the right, arm fully extended, the blade in front of the fist', 'FOLLOW-THROUGH: just after the stab, the dagger still forward, the weight coming back'],
  bow: ['READY: standing upright at full height, the bow held low in the left hand, an arrow ready', 'DRAW: raising the bow and drawing the string halfway', 'FULL DRAW: aiming to the right at full draw, bow arm straight forward, string hand at the cheek', 'RELEASE: just released, the bow still forward, the string hand flung back'],
  heavy: ['READY: standing upright at full height, holding it in both hands', 'WIND-UP: raising it high overhead', 'SMASH: smashing it down hard forward to the right, arms extended', 'FOLLOW-THROUGH: just after the smash, the weapon low in front'],
}
const LEG = {
  1: 'CONTACT: the NEAR leg (the one closer to the viewer) stretched far forward with the heel just touching the ground, the far leg stretched far behind on its toes, a long open stride',
  2: 'DOWN: the near foot flat under the body with the near knee bent, the body at its lowest, the far foot lifting off the ground behind',
  3: 'PASSING: standing straight on the near leg, the far knee lifted high and passing under the body, feet close together',
  4: 'UP: rising on the toes of the near foot, the body at its highest, the far leg swinging forward and reaching out in front',
  5: 'CONTACT: now the FAR leg stretched far forward with the heel just touching the ground, the near leg stretched far behind on its toes (mirror of the first contact pose)',
  6: 'DOWN: the far foot flat under the body with the far knee bent, the body at its lowest, the near foot lifting off behind',
  7: 'PASSING: standing straight on the far leg, the near knee lifted high and passing under the body, feet close together',
  8: 'UP: rising on the toes of the far foot, the body at its highest, the near leg swinging forward and reaching out in front',
}
const quad = (aspect) => `a ${aspect} sheet of 2 x 2 = 4 cells on pure flat green #00FF00 (cells 1, 2 on the top row, cells 3, 4 on the bottom row, left to right)`
const c = (n, t) => `cell ${n} = ${t}`

function pack(k) {
  const h = spec[k]
  if (!h) throw new Error('명세 없음 ' + k)
  const man = h.sex === 'man'
  const she = man ? 'he' : 'she', her = man ? 'his' : 'her', Her = man ? 'His' : 'Her'
  const w = WORD[h.weapon] || 'weapon'
  const act = ACT[h.weapon] || ACT.heavy
  const hold = h.hold || (h.weapon === 'bow' ? 'ONE bow' : 'ONE ' + w)
  const who = `${h.desc || 'the person of IMAGE 2'}. ${h.extra || (man ? 'Same outfit as in IMAGE 2.' : 'This battle outfit is sexier than the portrait.')} ${h.armor || 'NO armor, NO helmet.'} ${man ? 'He' : 'She'} holds ${hold}`
  const body = `Paint the real character in the hand-painted style of IMAGE 2 with EXACTLY the face of IMAGE 2 and slim, elegant adult proportions about 7 heads tall (long legs, small head), never stockier or rounder than IMAGE 2. Full body, head to toes, the same scale in every cell (head to toe about 80% of the cell height), feet on the same foot line. The four poses must be clearly DIFFERENT from each other; never repeat a pose. Nothing touches any cell edge, nothing crosses into another cell, and the very bottom-right corner of the whole image stays empty background. Pure flat #00FF00 background, no grid lines, no shadow, no ground line, no text, no numbers, no motion streaks.`
  const next = (aspect, intro, cells, extra = '') => `Great. Now make the NEXT ${aspect} sprite sheet of the SAME character: the same face, the same outfit, the same ${w}, the same 7-heads-tall proportions, the same scale and the same painting style as the sheet you just made. The image attached to THIS message is the POSE and LAYOUT reference only: ${quad(aspect)}. ${intro} Make a NEW ${aspect} sheet with EXACTLY this 2x2 layout. Cells: ${cells}. ${extra}Do NOT copy the look, colours, weapon or body shape of the reference figures; only their poses and placement. ${body}`
  const P = {
    r1: `IMAGE 1 is a POSE and LAYOUT reference only: ${quad('square 1:1')}; each cell shows one walking pose of a stick mannequin walking to the right. IMAGE 2 is the portrait of the character I need, an adult in ${her} twenties or older. Make a NEW square 1:1 sprite sheet with EXACTLY this 2x2 layout: in each cell the character walks to the right in strict side view, copying the leg and arm positions of the mannequin in the same cell: ${[1, 2, 3, 4].map((n) => c(n, LEG[n])).join('; ')}. The mannequin is only a guide for limb positions: do NOT copy its look, colours, body shape or pixel style. The character is ${who}, ${CARRY[h.weapon] || CARRY.heavy} and fully inside the cell. ${body}`,
    r2: next('square 1:1', `Each cell shows one walking pose of a stick mannequin walking to the right. These are the SECOND HALF of the same walk cycle: the other leg now leads, so these four poses are NOT copies of the previous sheet.`, [5, 6, 7, 8].map((n) => c(n, LEG[n])).join('; ') + `. ${man ? 'He' : 'She'} keeps walking to the right in strict side view, the ${w} carried exactly as before`),
    r3: next('wide 16:9', `In every cell the figure stands in the LEFT 40% of the cell and the rest is empty room for the weapon.`, [c(1, act[0]), c(2, act[1]), c(3, act[2]), c(4, `HIT: struck, staggering backward, torso jerked back, head thrown back, pained face, one arm flung out`)].join('; ') + '. Strict side view facing right. ', `The WHOLE ${w} is drawn at its full length in every cell and stays inside its cell with green margin; it is never shortened or cut off. `),
    r4: next('wide 16:9', `Cell 1 shows a figure lying on the ground; cells 2, 3 and 4 show standing figures in the LEFT part of their cells.`, [c(1, `DOWN: lying on ${her} back on the ground, eyes closed, the ${w} lying beside ${man ? 'him' : 'her'}, centred in the cell`), c(2, `IDLE: standing relaxed but alert at full height, feet apart, the ${w} held ready in front`), c(3, `IDLE BREATH: exactly the IDLE pose of cell 2, only the chest and shoulders slightly raised as ${she} breathes in`), c(4, act[3])].join('; ') + '. Strict side view facing right in cells 2 to 4. '),
  }
  for (const [r, t] of Object.entries(P)) writeFileSync(`tools/sprite-kit/quad/${k}-${r}.txt`, t.replace(/  +/g, ' ') + '\n')
  return Object.keys(P).length
}
const keys = process.argv.slice(2)
for (const k of keys) console.log(k, pack(k), '장 · 초상', `public/realm/bust-hd/${spec[k].bust}.jpg`)
