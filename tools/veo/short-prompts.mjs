// short-prompts.mjs — 짧은 「가상 인물」 문안 (11-13 형: 한라가 이 꼴로 됐다 · 「ai 이미지라고 하면 만들어 주긴 하는 듯」 · 가슴 흔들림은 아쉬우니 더 개선)
//   긴 문안(4~5천 자 · 몸·가슴 문단)은 Argon 에서도 「실제 인물이 그런 상황에」 거절이 났다 → 짧게 · 「그림 속 가상 인물」을 먼저 밝힘
//   · 출렁임은 「무거운·흔들리는」 같은 말 대신 동작(제자리 뜀·쿵 내려찍기·노 젓기)이 몸에 전해지게만 · 대사·노래 금지(한라가 시키지 않은 대사를 쳤다)
//   node tools/veo/short-prompts.mjs   → 원장 폴더 outputs/veo-queue-prompts/<key>-t1-short-20261113.txt · -argon-20261113 일의 promptPath 를 바꿈
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

const L = process.env.VEO_LEDGER ?? 'C:/Users/my/Documents/Codex/2026-11-06/windows-pc-claude-code-claude-code'
const HEAD = 'Animate this fantasy game illustration into a 10-second vertical 9:16 video. She is a fictional painted character, not a real person. Keep the same character, face, painted art style, outfit, colors and framing exactly as in the image.'
const BODY = 'The motion runs through her whole body: her chest rises and falls with deep visible breaths, and each step or jolt gives her fitted top and the loose cloth a soft natural bounce that settles.'
const FACE = 'The face stays alive: natural blinks, the eyes move a little, the expression softens and comes back. Same face, same painted style.'
const TAIL = 'Slow smooth motion, the last second returns close to the first frame so it can loop. Silent: no dialogue, no speech, no singing, only soft ambient sound. No text, no logo.'

// heroId → [누구 한 줄, 동작 두세 줄]
const S = {
  'w-21-baekje-court-dancer': ['She is a cheerful court dancer and trader.', 'She lifts the small flower-painted box higher as if presenting a treasure and does two light hops on her toes, her hips swaying and her raised arm waving gently, braids, ribbons and sheer shawls flowing, golden sparkles drifting.'],
  'w-48-mujin-mudeung': ['She is a seasoned old chieftain-warrior guarding a mountain town.', 'She lifts her spear a hand-span and sets its butt down with a firm thump, the hawk feathers and beads on the shaft swinging, her thick braid and fur mantle settling; she squares her shoulders and gives a slow proud nod.'],
  'w-61-iseo-sinae': ['She is a young strategist.', 'She inclines her upper body slightly, gives a subtle nod as the answer becomes clear and settles with a quietly confident smile, her headband tails and jade pendants swaying softly.'],
  'w-40-mujin-munui': ['She is a young ritual leader.', 'Her raised arm sways a little while the low hand lifts the bell cluster so it rings once softly, a gentle sway of the hips, the feathers, beads and ribbons in her braids swinging; her half-lidded eyes open to a calm direct gaze.'],
  'w-17-mahan-pearl-diver': ['She is a cheerful pearl diver resting after a good haul.', 'She laughs, wrings water from her wet hair with both hands and gives a small happy bounce on her toes, water drops sparkling off her hair and the pearls on her net bag swinging.'],
  'w-64-miri-dallae': ['She is a warm harvest leader.', 'She sweeps her raised open hand in a slow wide arc as though scattering grain, golden rice grains spiraling off her fingertips, then rises on her toes with a cheerful little bounce and a brighter smile.'],
  'w-103-tahae-neoul': ['She is a sea captain.', 'She rocks her weight from hip to hip with a small hop-step as if the deck pitches, tugs the rope so the bronze bell swings and rings once, her long hair streaming in the sea wind.'],
  'l-L5-seonyeo': ['She is a heavenly maiden.', 'She reaches up to lift the shimmering shawl so it billows like a wing, rises onto her toes with a small playful hop and tilts her head with a bigger smile, then lets the shawl float back down.'],
  'w-23-usisan-whale-queen': ['She is a whale-hunter chief by the sea.', 'She lifts the harpoon a hand-width and thumps its butt down firmly, then leans her weight onto it as if riding a rolling wave, her fur vest and loose hair stirring, sea spray rising behind her.'],
  'w-50-siljik-mulga': ['She is a confident trader chief with water magic.', 'She rolls her raised wrist so the water spiral swirls faster and rises, shifts her hips into a confident stance as water ribbons sweep around her, then closes her fingers and the spiral settles.'],
  'w-38-sangdang-bulmae': ['She is a strong blacksmith woman.', 'She braces her shoulder under the iron maul, shifts its weight and eases into a solid balance with a deep breath and an open smile; the maul never swings, sparks drift up from its glowing head.'],
  'w-51-haseulla-dangung': ['She is a sly young chief.', 'She rolls her shoulder slowly back so the leopard mantle shifts, sweeps her long leopard-wrapped braid over her shoulder with the back of her hand and shifts her hips into a confident stance, smirking at the viewer.'],
  'w-39-gosaburi-galmae': ['She is a laughing boatwoman.', 'Laughing, she rakes her fingers through her long wavy hair and shakes it out so the waves and white feathers fly, then rolls her shoulders and sways her hips from side to side.'],
  'w-97-goguryeo-mir': ['She is a confident young woman.', 'With a slow roll of her torso she glances back toward the viewer over her shoulder, her raised hand sliding down through her high ponytail so the long waves swing, then she turns back with a sly smile.'],
  'w-29-golpo-janmul': ['She is a laughing river oarswoman.', 'She makes one strong rowing stroke in place: leans forward, pulls the oar back toward her hip with her whole body, rocks back with a laugh, then reaches forward again, her wet braid swinging.'],
  'w-83-gyeonji-beodeul': ['She is a shy young farmer.', 'She hugs the rice sheaf closer and lifts it proudly with a happy laugh so the ripe ears shake and a few golden grains float, then tilts her head, flicks her braid back and smiles shyly.'],
}

const sha = (f) => createHash('sha256').update(readFileSync(f)).digest('hex')
const qp = `${L}/outputs/veo-production-queue.json`
const q = JSON.parse(readFileSync(qp, 'utf8'))
let n = 0
for (const j of q.jobs.filter((x) => /-argon-20261113$/.test(x.id))) {
  const s = S[j.heroId]
  if (!s) continue
  const text = [HEAD, `${s[0]} ${s[1]}`, BODY, FACE, TAIL].join('\n\n') + '\n'
  const key = j.id.replace(/^t1-/, '').replace(/-argon-20261113$/, '')
  const p = `${L}/outputs/veo-queue-prompts/${key}-t1-short-20261113.txt`
  writeFileSync(p, text)
  j.promptPath = p
  j.promptSha256 = sha(p)
  j.sourceNote = (j.sourceNote ?? '').replace(/ · 짧은 문안.*$/, '') + ' · 짧은 문안(가상 인물 · 대사 금지 · short-prompts.mjs)'
  n++
  console.log(j.id, text.length)
}
writeFileSync(qp, JSON.stringify(q, null, 2) + '\n')
console.log('바꿈', n)
