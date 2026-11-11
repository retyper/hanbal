/**
 * 굽기 꾸러미 — 형이 손으로 굽는다 (형 11-10: "챗지피티로 이미지 뽑을 거 니가 한번에 만들어 둬 줘 · 클로드 토큰 아까우니까 내가 구워서 저장할게").
 * 참고 그림 · 문안 · 저장할 이름을 한 장의 HTML(tools/out/bake-pack/index.html)에 모은다. 형은 파일로 열어
 * 그림을 끌어다 붙이고(또는 「그림 열기」) · 「문안 복사」 · 받은 것을 「저장 이름」대로 ~/Downloads 에 둔다.
 * 다 두면 Claude 가 `sh tools/bake-intake.sh` 한 번으로 모아 넣는다.
 *
 *   node tools/bake-pack.mjs
 *
 * 묶음: ① 챗지피티 진각성 aw2 (아직 안 넣은 사람) ② Veo 숨쉬기 (원장에서 낼 수 있는 일 · 높은 차례부터) ③ 제미나이 그림 (옥문 셋 등 · 아래 GEMINI)
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'

const OUT = 'tools/out/bake-pack'
const LEDGER = 'C:/Users/my/Documents/Codex/2026-11-06/windows-pc-claude-code-claude-code'
rmSync(OUT, { recursive: true, force: true })
for (const d of ['gpt', 'veo', 'gem', 'strip']) mkdirSync(join(OUT, d), { recursive: true })

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const cards = { gpt: [], veo: [], gem: [], strip: [] }
const add = (kind, n, title, imgs, prompt, save, note = '') => {
  const files = imgs.map((src, i) => { const f = `${kind}/${String(n).padStart(2, '0')}-${i}-${basename(src)}`; copyFileSync(src, join(OUT, f)); return f })
  cards[kind].push({ n, title, files, prompt, save, note })
}

// ① 챗지피티 진각성 aw2 — 진각성 그림이 아직 없는 사람만 (같은 id 가 두 번이면 처음 것)
const spec = JSON.parse(readFileSync('tools/sprite-kit/heroes/gpt-awaken.json', 'utf8'))
const seen = new Set()
let n = 0
// 15세 기준 (형 11-10) — 새로 굽는 여장수 문안의 「비치는 겉감」은 팔·다리·치마 겹에만, 가슴 쪽은 불투명
const OPAQUE15 = ' Teen (15+) rating: any sheer fabric is only on the sleeves, legs or skirt layers; the top over the chest is fully opaque, and no nipples or nipple outline show through the clothes.'
// 감실(w-33)·변한 단비(w-98) 결 — 형 11-10: "감실이랑 단비가 지금 최고 섹시하고 너무 좋은데" → 여장수 문안의 기준
const STYLE_F = ' Style reference (the two most loved splash arts in this game): a camera slightly below her for a powerful, dynamic look; a full hourglass figure with a large, full bust and deep cleavage, bare shoulders and bare midriff, a high leg slit; long flowing silk ribbons and sashes in her own colors swirling around her body; a strong, vivid expression (a sultry half-lidded smile or a big open laugh) and a bold pose full of energy that is HER OWN and different from every other hero: do NOT use the arm-raised-behind-the-head pose (already used by many); pick one that fits her weapon, job and personality, and keep her signature weapon and items clearly visible (a bow stays in frame, held, never drawn).'
const isWoman = (p) => /\b(woman|her)\b/.test(p)
// 남장수 진각성 — 11-11 밤 21장이 1차와 거의 같아 낭비(메모리 aw2-must-differ · 형: "인풋이랑 아웃풋이랑 별 차이도 없는데").
// 옛 문안은 「같은 얼굴·같은 색·같은 무기·눈 빛 조금」으로 묶어 두어 효과만 밝아졌다. 새 틀: 그 사람인 건 얼굴·무기·제 색으로 지키고, **실루엣이 바뀌는 변신**을 강제한다.
const STYLE_M = ' TRANSFORMATION RULES (this is the whole point; a viewer must say "that is the same man, but TRANSFORMED", never "the same picture with brighter effects"): (1) the silhouette changes in at least three visible ways: hair grows longer and wilder or turns partly white/ashen at the tips, the armor changes shape (bigger pauldrons, a second layer of plates, a torn war cloak or fur mantle that was not there before), and his signature weapon grows into its legendary form (longer, broader, engraved, cracked with light) while staying the SAME KIND of weapon (a bow stays a bow with a string, a sword stays a sword, a staff stays a staff); (2) his nation\'s or clan\'s spirit beast appears as a huge translucent apparition behind or around him, made of his element (a tiger of embers, a bear of stone and moss, a wolf of frost, a hawk of lightning, a serpent of river water, a boar of iron sparks), choose the one that fits HIS attached image and never a dragon unless he is already dragon-themed; (3) the scene has weather of his element raging around him (ember storm, blizzard, lightning, rain, dust) instead of a plain background; (4) a low camera looking up at him mid-action: swinging, planting the weapon into the ground, roaring, stepping forward through the storm, so the pose is nothing like the attached image; (5) scars, veins of glowing light under the skin or war paint may appear on his face and arms, but the face, beard and eye shape stay exactly his. Keep his body type and age. Painterly premium splash art, very high detail, dramatic rim light. Avoid: gold crown, halo or disc behind the head, sun rays, any red circle or sun symbol, Japanese or Chinese armor, katana, ninja look, text or watermark.'
for (const x of spec) {
  if (x.tier !== 2 || seen.has(x.id)) continue
  seen.add(x.id)
  if (existsSync(`public/realm/awaken2-hd/${x.id}.jpg`)) continue
  if (!existsSync(x.ref)) continue
  add('gpt', ++n, x.id, [x.ref], x.prompt + (isWoman(x.prompt) ? STYLE_F + OPAQUE15 : STYLE_M), `gpt_aw2-${x.id}.png`)
}
// ①-1b 진각성 다시 (형이 짚은 것 · 명세에 없는 사람은 여장수 진각성 틀로) — gpt_aw2-<id>.png → 지금 그림을 덮어쓴다
const W2 = spec.find((y) => y.key === 'aw2-w-66-saro-noeul')?.prompt ?? ''
const REDO2 = [
  // 11-10 형: "2차 각성은 허리 아래가 잘못 그려져 있음 · 몸 뒷면인데 다리 한쪽이 앞으로 착각" · 활시위 자세이기도 했다 (진각성 금지 자세)
  ['w-13-young-archer', '(21)', ' Draw her facing the viewer or in a three-quarter front view (not from behind, no twisted back view), with anatomically correct hips and legs: both legs clearly attached to the hips and bending the natural way.'],
  // 11-10 형이 짚은 다섯 — 활·활줄·손·가슴이 어색 (진각성 자세 규칙: 활시위 금지 → 활은 들고만)
  ['w-52-biryuna-songbi', '(late twenties)', ' Her bow must be drawn correctly: one single bow with ONE straight string tied to BOTH tips, held in her hand (not drawn, not aimed).'],
  ['w-55-guga-nuri', '(late twenties)', ' Draw her bust naturally: soft, round and natural in shape and weight, sitting naturally under the outfit (no stiff, flat or oddly shaped chest).'],
  ['w-79-yangmaek-solmae', '(late twenties)', ' Draw her hands and her bow correctly: five natural fingers on each hand, and one single bow with ONE straight string tied to BOTH tips, held in her hand (not drawn, not aimed). Her first-awakening outfit shows almost no skin; this true awakening must be far more revealing (11-10 형): a daring cropped top with a deep plunging neckline and big cleavage, bare shoulders and arms, a fully bare toned midriff, a very high leg slit showing her whole thigh, sheer sleeves and skirt panels, while the cloth over her chest stays opaque.'],
  ['w-96-haengin-neoul', '(late twenties)', ' Draw her bow correctly: one single bow with ONE straight string tied to BOTH tips, held in her hand (not drawn, not aimed), no extra or tangled strings.'],
  ['w-104-buyeo-darae', '(26)', ' She is very busty in the attached image, so here she is just as busty: a naturally very large, full, round bust with a natural shape and soft weight. Draw her bow correctly: one single bow with ONE straight string tied to BOTH tips, held in her hand (not drawn, not aimed).'],
  // 11-10 형: "1차 각성 무기 없이 · 더 섹시하게 · 그에 따라 2차 각성도 더 과도하게 섹시하게" (지금 2차는 활시위 자세 — 진각성 금지 자세)
  // 11-10 형: "w39 도 무기 없이 1차 2차 원본 이미지 다시 · 영상도 그걸로 다시"
  ['w-39-gosaburi-galmae', '(late twenties)', ' Keep her look: wild dark hair full of white feathers, a big open laugh, a tied linen top, jade pendants, feather trims. NO weapon at all: no bow, no arrows, no quiver, no blade; both hands are free.'],
  ['w-51-haseulla-dangung', '(late twenties)', ' She is the leopard-hunter archer of Haseulla: keep her long thick braid wrapped with leopard fur and her crimson and leopard-fur colors. NO weapon at all: no bow, no arrows, no quiver, no blade; both hands are free. Make her as alluring and glamorous as the rating allows: a bold, confident, seductive pose (one hand running up through her braid behind her head, hips cocked to the side, body turned to show her curves), a teasing sultry smile and half-lidded eyes looking straight at the viewer, a very revealing crimson-and-leopard-fur battle outfit with a deep plunging neckline, bare shoulders, bare toned midriff, a very high leg slit showing her whole thigh, a leopard-fur mantle slipping off her shoulders, gold and jade jewelry, red silk ribbons swirling.'],
]
// 1차 몸매 그대로 (형 11-10: "1차에서 거유였으면 2차에서도 거유로")
const BODY_KEEP = ' Keep her exact body type and bust size from the attached image (if she is very busty there, she is just as busty here).'
for (const [id, age, extra] of REDO2) {
  const ref = `public/realm/awaken-hd/${id}.jpg`
  if (W2 === '' || !existsSync(ref)) continue
  add('gpt', ++n, `${id} · 진각성 다시`, [ref, `public/realm/awaken2-hd/${id}.jpg`], W2.replace(/\(\d+\)/, age) + extra + BODY_KEEP + STYLE_F + OPAQUE15, `gpt_aw2-${id}.png`, ['w-104-buyeo-darae', 'w-51-haseulla-dangung', 'w-39-gosaburi-galmae'].includes(id) ? '1차 다시 굽기를 먼저 했으면 새 1차를 붙이세요 · 둘째는 지금 진각성(비교용)' : '첫 그림(1차 각성)만 붙이세요 · 둘째는 지금 진각성(잘못된 것 · 비교용)')
}
// ①-2 다시 굽기 (형이 짚은 것) — 1차 각성은 gpt_aw1-<id>.png 로 받아 install-awaken.sh 1 (지금 그림을 덮어쓴다)
const REDO1 = [
  // 11-10 형: "가슴 모양이 이상해서 아예 그냥 거유로 각성 이미지 다시 만들어야 할 듯"
  ['w-104-buyeo-darae', ' Her figure: a naturally very large, full, round bust with a natural shape and soft weight (not stiff, not oddly shaped), clearly visible under the outfit.'],
  // 11-10 형: "w-97 미르 1차 각성 이미지 무기 없이 다시 · 영상도 다시"
  ['w-97-goguryeo-mir', ' Override for this character: she holds NO weapon at all (no bow, no arrows, no quiver, no blade anywhere in the image); both hands are free and empty. Keep her face, hair, outfit colors and jewelry from the portrait. Pose: a confident, alluring pose instead of a weapon pose (one hand lifting her hair, the other on her hip, body turned to show her curves), a warm smile looking straight at the viewer.', '(early twenties)'],
  // 11-10 형: "w39 도 무기 없이 1차 2차 원본 이미지 다시 만들어야" (명세에 없는 사람 — 다래의 1차 틀로)
  ['w-39-gosaburi-galmae', ' Override for this character: she holds NO weapon at all (no bow, no arrows, no quiver, no blade anywhere in the image); both hands are free and empty. Keep her wild dark hair full of white feathers, her big joyful open laugh, her tied linen top with deep cleavage, jade pendants and feather trims. Pose: a lively, playful, confident pose instead of a weapon pose (both arms raised, fingers running through her feathered hair, or one hand on her hip while she laughs toward the viewer), body turned to show her curves, bare toned midriff.', '(late twenties)'],
  // 11-10 형: "1차 각성 원본 무기 없이 고쳐야 함 · 영상도 다시 · 더 섹시하게" (명세에 없는 사람 — 다래의 1차 틀로)
  ['w-51-haseulla-dangung', ' Override for this character: she holds NO weapon at all (no bow, no arrows, no quiver, no blade anywhere in the image); both hands are free and empty. Pose: a bold, seductive, confident pose instead of a weapon pose (one hand lifting her long leopard-fur-wrapped braid, the other on her hip, hips cocked, body turned to show her curves), a teasing sultry smile and half-lidded eyes looking straight at the viewer. Make her outfit sexier than the portrait: crimson and leopard-fur, a deep plunging neckline with a full, large bust and deep cleavage, bare shoulders, bare toned midriff, a high leg slit, a leopard-fur mantle slipping off one shoulder.', '(late twenties)'],
  // 11-10 형: "버들은 어쩔 수 없이 1차 각성 이미지도 다시 · 영상도 다시" — 시위를 당긴 채라 영상에서 시위가 혼자 당겨졌다 (활은 들고만)
  ['w-41-hwanna-beodeul', ' Override for this character: keep her black headband with two white feathers, her confident smirk and her dark navy and red armored jacket with gold trim. Her bow is NOT drawn and NOT aimed: she holds one single recurve bow (ONE straight string tied to BOTH tips) loosely in one hand, resting on her shoulder or lowered at her side, with no arrow nocked. Pose: a bold, alluring, confident pose (the other hand on her hip or brushing her hair back, body turned to show her curves), a deep neckline and full bust, bare toned midriff.', '(26)'],
]
const T1 = spec.find((y) => y.tier === 1 && y.id === 'w-104-buyeo-darae')
for (const [id, extra, age] of REDO1) {
  const x = spec.find((y) => y.tier === 1 && y.id === id) ?? (T1 !== undefined && age !== undefined ? { ref: `public/realm/bust-hd/${id}.jpg`, prompt: T1.prompt.replace(/\(\d+\)/, age).replace(', and keep her signature weapon and items from the portrait', '').replace(' with her weapon', '') } : undefined)
  if (x === undefined || !existsSync(x.ref) || !existsSync(`public/realm/awaken-hd/${id}.jpg`)) continue
  add('gpt', ++n, `${id} · 1차 다시`, [x.ref, `public/realm/awaken-hd/${id}.jpg`], x.prompt + extra + STYLE_F + OPAQUE15, `gpt_aw1-${id}.png`, '첫 그림(초상)만 붙이세요 · 둘째는 지금 1차 각성(비교용)')
}
// ①-2b 지금 1차 그림을 붙여 한 곳만 고친다 — gpt_aw1-<id>.png → install-awaken.sh 1
const FIX1 = [
  // 11-10 형: "저 시대에 호루라기는 없었지? 1차 각성 이미지만 호루라기 없이 · 영상은 안 만들어도 될 듯 (할머니니까)"
  // 11-10 밤 뱃사공은 콘셉트째 바꿔(RECAST) 이 고침은 안 씀
  // ['w-76-gampyeong-baetsagong', 'Remove both metal whistles: the small whistle at her lips and the whistle hanging from her necklace (replace that pendant with a small carved jade pendant like the others). Her right hand no longer holds anything at her mouth: it rests on the fur collar at her chest, fingers relaxed. Her lips close into the same wry, confident grin.'],
]
for (const [id, fix] of FIX1) {
  const ref = `public/realm/awaken-hd/${id}.jpg`
  if (!existsSync(ref)) continue
  add('gpt', ++n, `${id} · 1차 한 곳만 고침`, [ref], `This is an AI-generated illustration of a fictional adult character from my own Korean historical fantasy strategy game (an original character, not a real person). Edit this exact image only slightly: ${fix} Keep EVERYTHING else exactly the same: same face, expression, pose, composition, colors, outfit, jewelry, bamboo pole, aura, lighting, background and square image size.`, `gpt_aw1-${id}.png`, '지금 1차 각성 한 장만 붙이세요')
}
// ①-2c 콘셉트째 바꿈 — 초상(비각성) → 1차 → 2차 차례로. 앞 단계를 새로 넣어야(파일이 NEW_FROM 보다 새것) 다음 카드가 나온다
//   초상: gpt_bust-<id>.png → bake-intake.sh 가 install-bust.sh 로 · 1차: gpt_aw1 · 2차: gpt_aw2 (옛 그림은 git 기록에)
const NEW_FROM = Date.parse('2026-11-10T18:00:00+09:00')
const fresh = (p) => existsSync(p) && statSync(p).mtimeMs > NEW_FROM
const BUST_HEAD = 'Generate one image: premium Korean MMORPG character illustration, bold clean ink outlines, cel shading with soft painterly lighting, beautiful detailed face. Upper-body bust portrait framed from just above the head down to the solar plexus (mid-chest), both shoulders and upper arms visible, facing the viewer, slightly turned. Plain very dark navy-blue background (#1c2129) with a soft warm glow behind the head. Square 1:1. No text, no border, no scenery.'
const RECAST = [
  // 11-10 형: "너무 할머니라서 콘셉트 자체를 바꿔야겠어 · 비각성·1차·2차 다 · 30대 중반"
  { id: 'w-99-garak-yucheongan', age: '(35)', item: 'her grain jar',
    bust: ' She is an original character: Yucheongan, a fictional adult woman of 35, the keeper of the granaries of a Gaya river clan in ancient Korea (Samhan era), warm-hearted and generous, the big sister of her village. A beautiful, mature, glamorous woman in her mid-thirties (not old, no grey hair, no wrinkles): soft warm eyes, a generous confident smile, full lips, glossy black hair in a loose low knot with a few strands falling at her cheek, a carved wooden hairpin with a small gold grain-ear ornament. Outfit: a deep navy and cream Samhan wrap jacket with a woven zigzag collar band, worn loosely to bare one shoulder, with a deep neckline and full bust (opaque cloth over the chest), a wide red sash, gold earrings and a string of amber beads. She hugs a small bronze grain jar against her hip with ears of golden millet in it. Korean, not Chinese, not Japanese.',
    aw1: ' Override for this character: she is the warm, glamorous granary keeper of a Gaya river clan, 35, mature and beautiful (no grey hair, no wrinkles). Her signature item is one small bronze grain jar pouring a glittering stream of golden grain; there is only one jar. Outfit: an upgraded navy, cream and gold version of her portrait outfit, an off-shoulder wrap top with a deep neckline and a full bust, a wide red and gold sash, a layered skirt with a high slit, amber and gold jewelry, golden grain motes swirling around her.',
    aw2: ' She is the warm, glamorous granary keeper of a Gaya river clan, 35, mature and beautiful (no grey hair, no wrinkles): keep the face, hair and colors of the attached first awakening. Her true awakening is the goddess of the harvest: a radiant navy-and-gold harvest robe, a crown-like wreath of golden millet ears in her hair, golden grain and seed-light streaming around her like a river of stars, holding the bronze grain jar high.' },
  // 11-10 형: "유천간 개쎅시하다 · 다른 할머니도 바꿔 보자 · 유니크하고 참신한 섹시함으로 · 뱃사공·소금 둘까지만"
  { id: 'w-76-gampyeong-baetsagong', age: '(31)', item: 'her long bamboo punting pole',
    bust: ' She is an original character: Baetsagong, a fictional adult woman of 31, the daring ferry captain of a southern-sea clan in ancient Korea (Samhan era), bold, teasing and fearless on the water. A strikingly attractive sun-kissed woman (not old, no grey hair, no wrinkles): smooth bronzed skin with a light sheen of sea spray, a sly lopsided grin, sharp playful eyes, thick black hair tousled by the wind and tied back roughly with a blue cloth band, a few strands across her cheek. Unique look: flowing blue wave-pattern tattoos curling down both shoulders and arms, a coil of hemp rope slung across her body from shoulder to hip like a bandolier, small seashell earrings, a short quilted indigo vest worn open over a cropped cream wrap top (deep neckline, full bust, opaque cloth over the chest), bare toned midriff. One hand rests on a long bamboo punting pole leaning on her shoulder. Korean, not Chinese, not Japanese, no whistle.',
    aw1: ' Override for this character: she is the daring, sun-kissed ferry captain of a southern-sea clan, 31 (no grey hair, no wrinkles), bronzed skin with blue wave tattoos on her shoulders and arms. Her signature item is one long bamboo punting pole that she swings like a spear; a hemp rope is coiled across her body like a bandolier. Outfit: an upgraded indigo, cream and sea-green version of her portrait outfit, an open quilted vest over a cropped wrap top with a deep neckline and a full bust, bare midriff, a wrap skirt with a high slit, seashell and coral jewelry, sea spray and glittering water droplets swirling around her. No whistle.',
    aw2: ' She is the daring, sun-kissed ferry captain of a southern-sea clan, 31 (no grey hair, no wrinkles): keep the face, tattoos, hair and colors of the attached first awakening. Her true awakening is the queen of the tides: a flowing indigo-and-sea-green tide robe whose hem turns into foaming waves, a crown of white sea foam and coral in her hair, a whirling ring of seawater and glowing droplets around her, the bamboo pole now shimmering with water light. No whistle.' },
  { id: 'w-56-dongokjeo-sogeum', age: '(34)', item: 'her salt chest',
    bust: ' She is an original character: Sogeum, a fictional adult woman of 34, the ruler of the eastern-sea salt road of Dongokjeo in ancient Korea (Samhan era), shrewd, exacting and fair, a merchant queen. A cool, alluring beauty (not old, no grey hair, no wrinkles): sharp elegant eyes with a confident half-smile, glossy black hair swept up high and pinned with a hairpin of clear salt crystals, a few loose strands at her neck. Unique look: a sea-blue silk wrap dress with an off-shoulder deep neckline and a full bust (opaque cloth over the chest), a snow leopard fur stole draped over one shoulder, jewelry of clear white salt crystals that sparkle like ice (earrings, a choker and a cuff), a small silver weighing-scale charm at her sash. She holds a small lacquered salt chest at her hip, a little white salt spilling glittering from its lid. Korean, not Chinese, not Japanese.',
    aw1: ' Override for this character: she is the cool, alluring salt-road merchant queen of Dongokjeo, 34 (no grey hair, no wrinkles). Her signature item is one small lacquered salt chest; glittering white salt crystals swirl around her like snowflakes and ice shards. Outfit: an upgraded sea-blue, white and silver version of her portrait outfit, an off-shoulder silk wrap with a deep neckline and a full bust, a snow leopard fur stole, bare midriff, a layered skirt with a high slit, salt-crystal jewelry that sparkles like ice.',
    aw2: ' She is the cool, alluring salt-road merchant queen of Dongokjeo, 34 (no grey hair, no wrinkles): keep the face, hair and colors of the attached first awakening. Her true awakening is the white queen of the salt sea: a shimmering white-and-sea-blue gown that crystallizes into salt at the edges, a tiara of clear salt crystals, a storm of glittering salt and frost light around her, the salt chest open and pouring a river of shining white crystals.' },
]
for (const r of RECAST) {
  const bust = `public/realm/bust-hd/${r.id}.jpg`, aw1 = `public/realm/awaken-hd/${r.id}.jpg`
  if (!fresh(bust)) { add('gpt', ++n, `${r.id} · 새 초상 (콘셉트 바꿈)`, [], BUST_HEAD + r.bust + ' Avoid: grey hair, wrinkles, an elderly look, any text or watermark.', `gpt_bust-${r.id}.png`, '그림 없이 · 새 대화 · 받으면 넣고 꾸러미를 다시 만들면 1차 카드가 나옵니다'); continue }
  if (!fresh(aw1)) { if (T1 !== undefined) add('gpt', ++n, `${r.id} · 1차 (새 콘셉트)`, [bust], T1.prompt.replace(/\(\d+\)/, r.age).replace(', and keep her signature weapon and items from the portrait', '').replace(' with her weapon', ' with ' + r.item) + r.aw1 + STYLE_F + OPAQUE15, `gpt_aw1-${r.id}.png`, '새 초상만 붙이세요'); continue }
  if (W2 !== '') add('gpt', ++n, `${r.id} · 진각성 (새 콘셉트)`, [aw1], W2.replace(/\(\d+\)/, r.age) + r.aw2 + BODY_KEEP + STYLE_F + OPAQUE15, `gpt_aw2-${r.id}.png`, '새 1차 각성만 붙이세요')
}
// ①-3 15세 판 (형 11-10: Steam 15세로 · 지금 것은 assets_r19 에 보관 · 테스트 동안은 지금 것) — gpt15_aw<단>-<id>.png → assets_15/ 에만 모은다(게임엔 아직 안 넣음)
// 새로 그리면 느낌이 바뀐다 — 지금 그림을 붙이고 비침만 고친다 (영상도 그 그림으로 다시 구우니 같은 그림이어야 한다)
const EDIT15 = 'This is an AI-generated illustration of a fictional adult woman from my own Korean historical fantasy strategy game (an original character, not a real person). Edit this exact image only slightly for a teen (15+) age rating: make every piece of her clothing fully opaque (no sheer or see-through fabric anywhere) and remove any nipple or nipple outline showing through the clothes. Keep EVERYTHING else exactly the same: same face, expression, pose, composition, colors, outfit design, jewelry, cleavage, aura, lighting, background and square image size.'
const R15 = [[1, 'w-18-jinhan-salt-widow'], [1, 'w-91-saro-mulsae'], [1, 'w-98-byeonhan-danbi'], [1, 'w-103-tahae-neoul'], [2, 'w-103-tahae-neoul'],
  // 11-10 형: "유륜 같기도 하고 팬티 보이는 거 같기도 · 아주 살짝만 더 가리면"
  [2, 'w-29-golpo-janmul', ' Specifically: slightly raise and thicken the fabric over her chest so nothing there could look like an areola, and lengthen or close the skirt slit a little so no underwear is visible. Change only these small areas.'],
  // 11-10 형: "왼쪽 가슴 유륜 나옴 · 아깝다" · "살짝 팬티랑 오른쪽 유륜 위험"
  [2, 'w-85-sinji-neoul', ' Specifically: cover her left breast a little more so no areola shows (raise or widen the fabric there). Change only this small area.'],
  [2, 'w-101-garak-singwigan', ' Specifically: cover her right breast a little more so nothing could look like an areola, and close the skirt a little so no underwear is visible. Change only these small areas.']]
for (const [tier, id, extra] of R15) {
  const hd = tier === 1 ? 'awaken-hd' : 'awaken2-hd'
  if (existsSync(`assets_15/realm/${hd}/${id}.jpg`)) continue
  const now = `public/realm/${hd}/${id}.jpg`
  if (!existsSync(now)) continue
  add('gpt', ++n, `${id} · ${tier}차 15세 판 (지금 그림 고치기)`, [now], EDIT15 + (extra ?? ''), `gpt15_aw${tier}-${id}.png`, '지금 그림을 붙이고 문안 · 받은 건 바로 게임에 안 넣고 assets_15 에 모아 둠')
}

// ② Veo — 원장에서 낼 수 있는 일 (queue.mjs peek 와 같은 거름 · 쿨다운은 보지 않는다 · 높은 차례부터)
const q = JSON.parse(readFileSync(`${LEDGER}/outputs/veo-production-queue.json`, 'utf8')).jobs
const st = JSON.parse(readFileSync(`${LEDGER}/outputs/veo-production-state.json`, 'utf8'))
const tried = new Set(st.attempts.map((a) => a.jobId))
const latest = {}
for (const a of st.attempts) latest[`${a.heroId}/${a.tier}`] = a
const veo = q.filter((j) => j.authorized === true && j.sourceRepairRequired !== true && !tried.has(j.id)
  && (latest[`${j.heroId}/${j.tier}`] ? j.replacesAttemptId === latest[`${j.heroId}/${j.tier}`].id : j.replacesAttemptId == null))
  .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id, 'en'))
n = 0
for (const j of veo) add('veo', ++n, `${j.heroId} · ${j.tier === '2' ? '진각성' : '1차'}`, [j.inputPath], readFileSync(j.promptPath, 'utf8').trim(), `veo_${j.id}.mp4`, `job ${j.id}`)

// ③ 제미나이 그림 — 사물은 제미나이 (메모리: 챗지피티는 사람에게만) · 「이미지 만들기」 · 16:9 · 한 대화에서 차례로
const GATE0 = 'A heavy ancient Korean prison gate seen straight from the front: two thick dark wooden doors with iron bands and big iron studs, a heavy wooden crossbar, set in a short rough stone frame, hand-painted semi-realistic game art matching a dark Korean historical strategy game, the gate fills the frame, on a flat pure magenta #FF00FF background, no text, no shadow on the background.'
const GEMINI = [
  ['옥문 1/3 · 멀쩡한 문 (새 대화 · 이미지 만들기 · 16:9)', GATE0, 'woo-gate-0.png'],
  ['옥문 2/3 · 같은 대화에 이어서', 'Same gate, same framing, same size and same magenta background, but badly cracked and splintered: deep cracks across both doors, a split crossbar, a few iron studs popped out, still standing.', 'woo-gate-1.png'],
  ['옥문 3/3 · 같은 대화에 이어서', 'Same gate, same framing, same size and same magenta background, now smashed open: both doors broken inward and hanging off, the crossbar snapped in two, flying splinters, the dark doorway visible behind.', 'woo-gate-2.png'],
]
n = 0
for (const [title, p, save] of GEMINI) if (!existsSync('public/realm/fx/' + save)) add('gem', ++n, title, [], p, save, '받으면 「원본 크기 다운로드」 · 이름만 바꿔 Downloads 에')

// ④ 전투 띠 동작 시트 다시 뽑기 (HANDOFF 「전투 띠 검수」 1·3번) — 그림 둘(IMAGE 1 걷기 시트 · IMAGE 2 초상) · 문안은 gemini-kit 의 act 틀 + ao 바꿈 + 무기 절
const KIT_TAIL = 'Pure flat #00FF00 background, no grid lines, no shadow, no ground line, no text, no motion streaks, nothing in the bottom-right corner.'
const KIT_ACT = {
  spear: '1 battle-ready stance holding the spear in both hands at waist height, tip pointing forward-right, 2 pulling the spear back to wind up, 3 lunging forward with the long spear fully extended to the right, its tip far in front of her, 4 thrust follow-through, tip still forward, 5 recovering to stance, ',
  sword: '1 battle-ready stance with the sword held up in front of her, blade pointing forward-right, 2 raising the sword high above her head to strike, 3 lunging forward and slashing the sword down and forward to the right, the blade far in front of her, 4 slash follow-through with the blade low in front of her, still pointing forward, 5 recovering to stance, ',
  axe: '1 battle-ready stance holding the axe in both hands in front of her, axe head forward, 2 raising the axe high over her head, 3 stepping forward and chopping the axe down hard in front of her to the right, 4 follow-through with the axe head low in front of her, 5 recovering to stance, ',
  dagger: '1 low crouched fighting stance with the dagger held forward in her front hand, 2 drawing the dagger hand back beside her hip, 3 lunging forward and stabbing to the right, arm fully extended with the blade in front of her fist, 4 stab follow-through, dagger still in front, 5 recovering to stance, ',
}
const CLAUSE = {
  // 11-09 오디로 시험해 먹힌 절 (창 가운데를 두 손 · 20도 아래 · 창 전체가 칸 안)
  spear: 'IMPORTANT for the four attack cells: she keeps the SAME long spear from IMAGE 1 (with its metal spearhead blade and its own decorations) and grips the MIDDLE of the shaft firmly with BOTH hands, then thrusts it forward in the direction she faces and slightly downward (about 20 degrees); the spearhead blade points forward and is clearly visible, and the WHOLE spear, from butt to blade tip, stays fully inside each cell (place each figure in the LEFT part of its cell so the forward blade never crosses into the next cell). Never empty-handed, never a bare stick without a blade, never the spear pointing backward, no loose feathers or scraps floating around.',
  // 11-10 검수 2번: 공격 칸이 서기와 같거나 무기가 등 뒤로 (칼·도끼)
  sword: 'IMPORTANT for the four attack cells: she keeps the SAME sword from IMAGE 1 and swings it FORWARD in the direction she faces, with a big lunge step; in frames 3 and 4 the steel blade is clearly visible IN FRONT of her body, pointing forward-right, never held behind her back, never hanging down beside her leg, and the whole sword stays fully inside each cell (place each figure in the LEFT part of its cell so the forward blade never crosses into the next cell). Frames 3 and 4 must look clearly different from frame 1.',
  axe: 'IMPORTANT for the four attack cells: she keeps the SAME axe from IMAGE 1 gripped in both hands and chops FORWARD in the direction she faces, with a big lunge step; in frames 3 and 4 the axe head is clearly visible IN FRONT of her body, never behind her back, and the whole axe stays fully inside each cell (place each figure in the LEFT part of its cell). Frames 3 and 4 must look clearly different from frame 1.',
  // 검수 3번: 단검이 사라진 맨주먹 찌르기
  dagger: 'IMPORTANT for the four attack cells: she keeps the SAME dagger from IMAGE 1 gripped tightly in her front hand, the steel blade clearly visible and pointing forward beyond her fist in every attack cell, the whole dagger fully inside each cell. Never an empty fist, never a hidden or missing blade.',
}
const STRIPS = [
  // 11-10 형이 구운 열하나 중 아홉은 넣음 · 물새는 찌르기 칸이 또 빈 주먹 · 지타는 칸이 어긋나 작은 사람이 옆 칸에 끼었다 → 다시
  // 11-10 저녁 물새·지타는 Claude 가 제미나이 u/0 로 다시 구워 넣음 (지타는 한 번 고쳐 달라 하고 2번 칸은 1번으로) — 다음 사람을 여기에
  // 11-10 밤 검수 2번(공격 칸이 서기와 같음 · 칼·도끼는 등 뒤로): 해비 도끼 · 소서노·알영 창 · 아라·혁거세 칼
  ['realm-redo-1110', ['haebi', 'soseono', 'aryeong', 'ara', 'hyeokgeose']],
]
n = 0
for (const [file, keys] of STRIPS) {
  const sp = JSON.parse(readFileSync(`tools/sprite-kit/heroes/${file}.json`, 'utf8'))
  for (const key of keys) {
    const h = sp.find((x) => x.key === key)
    const walk = `assets_src/realm/gemini/generals2/${key}-walk.png`
    const bust = `public/realm/bust-hd/${h?.bust}.jpg`
    if (h === undefined || !existsSync(walk) || !existsSync(bust) || CLAUSE[h.weapon] === undefined) continue
    const man = h.sex === 'man'
    const w = h.weapon
    let p = `IMAGE 1 is the walking sprite sheet of my character, ${man ? 'the man of IMAGE 2 (his portrait)' : 'the woman of IMAGE 2 (her portrait)'}. Make a NEW image with EXACTLY the same wide 16:9 4x2 layout, cell size, character scale (the WHOLE body from head to feet visible in every cell, same size as in IMAGE 1), foot line and EXACTLY the same person and outfit as IMAGE 1, strict side view facing RIGHT in every frame, every figure and the whole ${w} fully inside its cell. ${CLAUSE[w]} Exactly ONE ${w} in every frame. 8 frames in order: ${KIT_ACT[w]}6 hit recoil, torso jerked backward, head thrown back, pained face, still facing right, 7 falling backward off the feet, 8 lying on the back on the ground with the ${w} beside. The weapon never points backward. ${KIT_TAIL}`
    if (man) p = p.replace(/\b(of|beside|behind) her\b(?! (back|body|hip|cheek|fist|front|head))/g, '$1 him').replace(/\bher\b/g, 'his').replace(/\bshe\b/g, 'he')
    add('strip', ++n, `${key} · ${h.bust} · ${{ spear: '창 찌르기', dagger: '단검 찌르기', sword: '칼 베기', axe: '도끼 찍기' }[w]}`, [walk, bust], p, `act_${key}.png`, '그림 둘을 순서대로(걷기 시트가 IMAGE 1) · 이미지 만들기 · 16:9')
  }
}

const sec = (kind, head, how) => {
  const cs = cards[kind]
  if (cs.length === 0) return ''
  return `<section id="${kind}"><h2>${head} <small>${cs.length}</small></h2><p class="how">${how}</p>` + cs.map((c) => `
<article class="card" data-k="${kind}-${c.save}">
  <header><b>${c.n}</b><span>${esc(c.title)}</span><label><input type="checkbox" class="done"> 다 함</label></header>
  <div class="row">${c.files.map((f) => `<a href="${f}" target="_blank"><img src="${f}" alt="" draggable="true"></a>`).join('')}
  <div class="col"><textarea readonly>${esc(c.prompt)}</textarea>
  <div class="btns"><button data-copy="prompt">문안 복사</button><button data-copy="save" data-v="${esc(c.save)}">저장 이름 복사</button><code>${esc(c.save)}</code>${c.note ? `<small>${esc(c.note)}</small>` : ''}</div></div></div>
</article>`).join('') + '</section>'
}

const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>굽기 꾸러미</title>
<style>
:root { color-scheme: dark; --bg: #15120e; --card: #221c15; --line: #4a3a28; --gold: #e8c15a; --ink: #efe6d2; --mute: #a39478; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 14px/1.5 system-ui, "Malgun Gothic", sans-serif; }
main { max-width: 1100px; margin: 0 auto; padding: 16px; }
h1 { color: var(--gold); margin: 8px 0; } h2 { color: var(--gold); border-bottom: 1px solid var(--line); padding-bottom: 4px; } h2 small { color: var(--mute); font-size: 14px; }
nav a { color: var(--gold); margin-right: 14px; } .how { color: var(--mute); }
.card { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 10px; margin: 10px 0; }
.card.isdone { opacity: .35; }
.card header { display: flex; gap: 10px; align-items: center; margin-bottom: 8px; } .card header b { color: var(--gold); min-width: 28px; } .card header span { flex: 1; font-weight: 700; }
.row { display: flex; gap: 10px; align-items: flex-start; } .row img { width: 150px; border-radius: 6px; border: 1px solid var(--line); }
.col { flex: 1; min-width: 0; } textarea { width: 100%; height: 110px; box-sizing: border-box; background: #120f0b; color: var(--ink); border: 1px solid var(--line); border-radius: 6px; font: 12px/1.4 ui-monospace, monospace; }
.btns { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 6px; } button { background: #8d6626; color: #fff4d6; border: 1px solid var(--gold); border-radius: 8px; padding: 6px 12px; font-weight: 700; cursor: pointer; }
button.ok { background: #2e6b33; } code { color: var(--gold); } small { color: var(--mute); }
@media (max-width: 640px) { .row { flex-direction: column; } .row img { width: 100%; } }
</style></head><body><main>
<h1>굽기 꾸러미</h1>
<p class="how">그림은 끌어다 챗지피티·제미나이 입력칸에 놓으면 붙습니다 (안 되면 그림을 눌러 연 뒤 저장해서 첨부). 받은 결과는 <b>저장 이름</b> 그대로 <code>Downloads</code> 에 두세요. 다 두면 Claude 에게 「꾸러미 넣어」 한마디면 됩니다 (<code>sh tools/bake-intake.sh</code>). 「다 함」 표시는 이 컴퓨터에만 남습니다.</p>
<nav><a href="#gem">제미나이 ${cards.gem.length}</a><a href="#strip">전투 띠 ${cards.strip.length}</a><a href="#gpt">챗지피티 진각성 ${cards.gpt.length}</a><a href="#veo">Veo ${cards.veo.length}</a></nav>
${sec('gem', '제미나이 그림', '「이미지 만들기」 · 16:9 · 옥문 셋은 한 대화에서 차례로 (같은 틀이어야 겹쳐 쓸 수 있습니다)')}
${sec('strip', '전투 띠 동작 시트 (제미나이)', '새 대화마다 한 사람 · 「이미지 만들기」 · 16:9 · 그림 둘을 차례로 붙이고(걷기 시트 먼저) 문안 · 초록 바탕 그대로 받기')}
${sec('gpt', '챗지피티 진각성', '새 대화마다 한 사람 · 그림 하나 붙이고 문안 · 정사각 1:1 · 무료 계정 한도가 뜨면 그 시각을 알려 주세요')}
${sec('veo', 'Veo 숨쉬기 영상 (Jay u/4)', '「동영상 만들기」 · 세로 모드 · 사진 하나 + 문안 · 받으면 저장 이름대로 (거절되면 「다 함」 대신 비워 두고 알려 주세요)')}
</main><script>
const K = 'bakepack.done'
let done = {}; try { done = JSON.parse(localStorage.getItem(K) || '{}') } catch {}
for (const c of document.querySelectorAll('.card')) {
  const cb = c.querySelector('.done'); cb.checked = !!done[c.dataset.k]; c.classList.toggle('isdone', cb.checked)
  cb.addEventListener('change', () => { done[c.dataset.k] = cb.checked; c.classList.toggle('isdone', cb.checked); try { localStorage.setItem(K, JSON.stringify(done)) } catch {} })
}
document.addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-copy]'); if (!b) return
  const t = b.dataset.copy === 'prompt' ? b.closest('.col').querySelector('textarea').value : b.dataset.v
  try { await navigator.clipboard.writeText(t) } catch { const ta = b.closest('.col').querySelector('textarea'); ta.select(); document.execCommand('copy') }
  b.classList.add('ok'); setTimeout(() => b.classList.remove('ok'), 900)
})
</script></body></html>`
writeFileSync(join(OUT, 'index.html'), html)
console.log(`꾸러미: 제미나이 ${cards.gem.length} · 전투 띠 ${cards.strip.length} · 챗지피티 ${cards.gpt.length} · Veo ${cards.veo.length} → ${OUT}/index.html`)
