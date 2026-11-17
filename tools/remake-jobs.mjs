// remake-jobs.mjs — 제미나이로 받아 결이 어긋나거나 이상한 마을·배경 그림을 챗지피티로 다시 (2026-11-16 · 표: docs/realm/production/REMAKE-20261116.md)
//   release-jobs 와 같은 꼴 { id, group, save, title, refs, now, use, prompt } · 배열 차례 = 굽는 차례 (형 눈에 자주 띄고 이상한 것부터)
//   refs 1번 = 지금 그림(무엇을 그리나) · 나머지 = 챗지피티 화풍 기준 · 앞 장 결과가 필요한 장은 문안 첫 줄에 「D:/에셋창고/<이름> 도 첨부」
//   한 벌(일터 1·2·3단 · 궁궐 네 단 · 필름 넷)은 격자 한 장으로 받아 코드로 자른다 — 크레딧을 아끼고 서로 맞는다

import { existsSync, readFileSync } from 'node:fs'
export const REMAKE_GROUPS = { 'remake-town': '마을 다시', 'remake-bg': '배경 다시', 'remake-icon': '아이콘 다시', 'remake-sprite': '전투 띠 얼굴 크기 다시', 'remake-cutin': '컷인 배경 판' }

const RULES = 'Original early-Korean (Proto-Three-Kingdoms, Samhan) historical fantasy. Not Chinese imperial: no glazed-tile palace roofs, no stacked pagoda roofs or sharply upturned eaves, no dragon pillars, no hanfu robes. No Japanese motifs: no torii gates, no shimenawa ropes and no white zigzag paper streamers, no samurai armor, no katana, no knotted white hachimaki headbands. No red sun discs and no sun rays: no visible sun anywhere. No text, letters, numbers, pseudo-characters, logo, signature or watermark anywhere; banners, plaques and cloth are plain or carry simple geometric or animal shapes only.'
const PAINT = 'Painting style: match the attached ChatGPT reference paintings exactly: rich hand-painted digital painting with fine ink detail, muted natural earth colors, soft hazy atmospheric light, cinematic but grounded. Not photographic, not a 3D render, not a flat cartoon, not anime.'
const TOWN = 'Painted like a premium hand-painted strategy-game board in the spirit of the attached early-Korean key art: fine ink linework under rich painterly color, muted natural greens and earth browns, soft overcast daylight from the upper left, short soft shadows falling to the lower right. Not photographic, not a 3D render, not a flat cartoon, no pixel art.'
const CAM = 'Camera: high three-quarter bird\'s-eye view looking down at about 35 degrees, near-orthographic (almost no perspective convergence), exactly the same camera, scale and light for every piece.'
const ALPHA = 'Real alpha transparency: a true transparent PNG background, no checkerboard pattern, no backdrop color, no shadow plane or ground outside the pieces.'
const NOPEOPLE = 'No people at all (the game animates its own villagers on top).'
const also = (name) => `[코덱스] D:/에셋창고/${name} 도 첨부해 같은 화풍 (참고 그림 맨 뒤에 붙임)\n`

const jobs = []

// ── 1. 수성 싸움 바탕 (형 11-01: "battle-gate-def 이거 이미지 너무 별론데 나중에 챗지피티로" · 11-04: 성은 위쪽 왼편 · 아래 6할은 땅)
jobs.push({ id: 'RM-bg-gate-def', group: 'remake-bg', save: 'remake_bg_gate-def.png', title: '수성 싸움 바탕 (우리 목책 성이 왼쪽 위)',
  refs: ['/realm/battle/battle-gate-def.jpg', '/realm/battle/battle-gate.jpg', '/realm/battle/battle-field.jpg'],
  now: '연필 선에 옅은 물빛뿐인 납작한 그림 · 흰 하늘 · 다른 싸움터 일곱(챗지피티 진한 채색)과 따로 논다',
  use: '16:9 → 1536×864 jpg q88 → public/realm/battle/battle-gate-def.jpg (battlefield.ts warBg 수성) · 옛 것은 tools/retire-history.py 로 보관',
  prompt: `Create one 16:9 landscape painting (final 1536x864): the background of a DEFENSIVE battle at our own walled village. IMAGE 1 is the old version: copy only its layout, not its style. IMAGE 2 and IMAGE 3 are the other battlefield backgrounds of the same game: match their painting style, colors, brightness, overcast sky and level of detail exactly so this one sits in the same set.

Layout (the game places small soldier units on the ground, so it must stay open):
- Our village fortress stands at the UPPER LEFT near the horizon, seen at a slight angle: a tall log palisade with sharpened tops, a closed heavy gate between two thick log gateposts (no crossbeams over the posts), one thatched wooden watchtower, an earthen ditch bank in front of the wall. It occupies roughly the left 40% of the width and only the upper 40% of the height.
- The right side is open country toward the horizon where the enemy comes from: distant low hills and mist, empty plain.
- The bottom 60% of the whole frame is open trampled earth and dry grass, flat and empty, slightly darker toward the bottom edge, with only a few spent arrows stuck in the ground. No rocks, logs or props in the middle of the ground.
No people, no horses, no flags with writing. ${PAINT} ${RULES}` })

// ── 2. 마을 안 (TOWN.md · 형 11-05: 스타크래프트처럼 비스듬히 내려다본 빈 터 · 터마다 일터 1·2·3단 · 목책·해자)
const PLOTS = 'The four open plots must stay bare flat packed-earth ground with nothing on them, centered at about (38% x, 36% y), (62% x, 36% y), (34% x, 62% y) and (65% x, 62% y) of the image, each about 22–25% of the image width wide and 22% of the height tall. No buildings, carts, trees, rocks or people on those four spots.'
const BOARD = 'Format: 16:9 landscape, opaque full-bleed painting, no border, no vignette. It is resized to 1376x768 and phones crop about 12% at the left and right, so keep the village ring between 14% and 86% of the width.'
jobs.push({ id: 'RM-town-ground-field', group: 'remake-town', save: 'remake_town_ground-field.png', title: '마을 바탕 · 들판 목책 (마을 그림 전부의 기준)',
  refs: ['/realm/town/ground-field.png', '/realm/keyart/tutorial.jpg', '/realm/battle/battle-field.jpg'],
  now: '제미나이 연필·수채 결 · 위에 얹는 일터 조각(진한 디지털 채색 · 다른 각도)과 결이 달라 판이 따로 논다',
  use: '16:9 → 1376×768 PNG(RGB) → public/realm/town/ground-field.png · 바탕 열둘(이 장 + RM-town-ground-*)은 한 벌이라 다 받은 뒤 한꺼번에 넣는다(방비를 올릴 때 화풍이 바뀌지 않게) · 넣기 전에 townview.ts LOTS 네 자리에 터·일터를 얹어 빈 땅 위에 서는지 본다 — 어긋나면 LOTS 를 새 그림에 맞춰 다시 잰다',
  prompt: `Create the town board for an early-Korean village-building game: one 16:9 painting of our walled village seen from above. IMAGE 1 is the current board: use it ONLY for layout and redraw the same scene with exactly the same composition, because the game places four building plots on fixed spots of this picture. IMAGE 2 and IMAGE 3 show the painting style to match.

Keep from IMAGE 1: the same camera; the round log palisade ring centered with the same size and position (an ellipse spanning roughly x 15%–86% and y 8%–94%); the gate gap at bottom center and a second gap at top center; the dirt road from the bottom gate to the top gap and the cross road from left to right through the middle; a few thatched round huts, small thatched houses and a well along the upper inner edge of the ring; terraced rice paddies outside on the left; a small stream with reeds at the lower right; low rounded hills and pines along the top.
${PLOTS}
${NOPEOPLE} ${CAM} ${TOWN} ${BOARD} ${RULES}` })

const PIECE = 'Every piece sits on the SAME plot footprint: one square plot of land seen from the board camera, so it reads as a diamond about 1.8 times wider than tall, with a thin earthen slab edge (about 4% of the width thick) visible on the two front sides, and a low border of rounded grey-brown fieldstones along all four edges (the border of the empty plot in cell 1 of the first sheet; identical in every cell). The plot\'s left and right corners are the leftmost and rightmost points of the piece and its front corner is the lowest point: nothing (smoke, poles, carts, animals, dirt spill) sticks out past the left or right corner or below the front corner, and buildings stay inside the diamond. Draw every plot at the same size in its cell. Buildings use thatch, timber, wattle-and-daub and fieldstone of the early Korean Samhan period; no tiled roofs. No smoke columns (at most a tiny wisp just above a chimney).'
const SHEET = 'Create ONE transparent PNG sprite sheet, landscape 3:2 (1536x1024), a strict evenly spaced grid of 3 columns x 2 rows of equal cells, six separate building-plot pieces for a town-building game board, each centered in its cell with at least 8% empty margin, nothing touching a cell edge, no cell outlines, no labels.'
const MATCH = (n) => `The pieces are placed on the town board (IMAGE ${n}, or the newer board attached last if present): match its camera, light direction, scale and painting style exactly.`
const tiers = (a, b) => `Row 1, ${a}\nRow 2, ${b}\nIn each row the three cells are tiers 1, 2 and 3 of the SAME workshop on the same plot: tier 1 small and simple, tier 2 larger, tier 3 the grandest. Same building materials and colors across the three tiers.`
const sliceUse = (ids) => `1536×1024 투명 → node tools/slice-grid.mjs <받은 그림> 3 2 public/realm/town/ ${ids} 512 0.02 trim · 칸마다 터 좌우 꼭짓점이 그림 좌우 끝, 앞 꼭짓점이 맨 아래인지 보고 lot.png 와 겹쳐 본다(테두리가 겹쳐 두 줄로 보이면 안 됨) · 옛 것은 tools/retire-history.py 로 보관`
jobs.push({ id: 'RM-town-kit', group: 'remake-town', save: 'remake_town_kit.png', title: '빈 터·거친 터·짓는 중 + 논 1·2·3단 (터 모양의 기준)',
  refs: ['/realm/town/work-paddy-3.png', '/realm/town/ground-field.png', '/realm/keyart/tutorial.jpg', '/realm/town/lot.png'],
  now: '조각마다 터 테두리(둥근 돌 · 흰 다듬은 돌 · ㄱ자로 깎인 터)와 각도·채색이 제각각 · 빈 터 위에 얹으면 테두리가 두 줄로 보인다',
  use: sliceUse('lot,lot-rough,build,work-paddy-1,work-paddy-2,work-paddy-3') + ' · build.png 는 짓는 터에 그대로, 올리는 중엔 건물 위에 70% 폭으로 겹쳐 쓴다',
  prompt: `${also('remake_town_ground-field.png')}${SHEET}
${PIECE}
Row 1:
1. EMPTY PLOT: flat packed brown earth inside the fieldstone border, a few faint footprints. This border is the standard one used under every building.
2. UNCLEARED PLOT: the same footprint covered with wild grass, a few tree stumps and rocks, no stone border (land not yet cleared).
3. UNDER CONSTRUCTION: the empty plot of cell 1 with a dug rectangular foundation, an open bare-log scaffolding frame lashed with rope standing in the middle (you can see through it), stacked timber, a few tools.
Row 2, RICE PADDY workshop, tiers 1, 2, 3 on the same plot and border:
4. Tier 1: four small flooded paddies with young rice shoots divided by earthen ridges, a tiny thatched field shelter.
5. Tier 2: larger paddies with taller green rice, a small irrigation channel, a thatched granary hut.
6. Tier 3: golden ripe rice fields, a raised-floor thatched granary on stilts, a small pond, stacked rice sheaves.
IMAGE 1 shows the current paddy piece and IMAGE 4 the current empty plot (content only, their borders and angles are wrong). ${MATCH(2)}
${NOPEOPLE} ${CAM} ${TOWN} ${ALPHA} ${RULES}` })

const WORK_REF = ['/realm/town/ground-field.png', '/realm/keyart/tutorial.jpg']
const workJob = (id, a, b, refs, ids, now, rows) => jobs.push({ id, group: 'remake-town', save: `remake_town_work-${a}-${b}.png`, title: `일터 ${rows.title}`,
  refs: [...refs, ...WORK_REF], now, use: sliceUse(ids),
  prompt: `${also('remake_town_kit.png')}${SHEET}
${PIECE} Use the plot, fieldstone border, camera and painting style of the earlier sheet (attached last) exactly.
${tiers(rows.a, rows.b)}
IMAGE 1 and IMAGE 2 show the current pieces (content only, their borders and angles are wrong). ${MATCH(3)}
${NOPEOPLE} ${CAM} ${TOWN} ${ALPHA} ${RULES}` })
workJob('RM-town-work-saltpan-smelter', 'saltpan', 'smelter', ['/realm/town/work-saltpan-3.png', '/realm/town/work-smelter-3.png'],
  'work-saltpan-1,work-saltpan-2,work-saltpan-3,work-smelter-1,work-smelter-2,work-smelter-3',
  '소금밭 1·2단은 ㄱ자로 깎인 터 · 쇠부리터 3단은 흙이 터 밖으로 번져 크기가 어긋난다 · 테두리·각도가 빈 터와 다름',
  { title: '소금밭·쇠부리터 1·2·3단',
    a: 'SALT PANS: tier 1 a grid of shallow evaporation pans with white salt crust and a tiny thatched hut; tier 2 more pans plus an open thatched boiling shed with a clay pan over a small fire and stacked straw salt bags; tier 3 a large salt field with two boiling sheds, a raised storehouse and rows of salt jars and bags.',
    b: 'IRON SMELTING YARD: tier 1 one small clay bloomery furnace with a glowing mouth, a charcoal pile, an ore pile and leather bellows; tier 2 two clay furnaces under an open thatched shed with baskets of charcoal; tier 3 three tall clay shaft furnaces glowing, an open work shed and neat stacks of flat axe-shaped iron ingots.' })
workJob('RM-town-work-lumber-ranch', 'lumber', 'ranch', ['/realm/town/work-lumber-3.png', '/realm/town/work-ranch-3.png'],
  'work-lumber-1,work-lumber-2,work-lumber-3,work-ranch-1,work-ranch-2,work-ranch-3',
  '목수 마을은 흰 다듬은 돌 테두리에 두꺼운 받침(다른 조각과 각도·결이 다름) · 말 목장 3단은 흙이 터 밖으로 번진다',
  { title: '목수 마을·말 목장 1·2·3단',
    a: 'CARPENTERS\' YARD: tier 1 a log pile, a sawhorse and a small thatched hut; tier 2 an open-sided thatched workshop, stacks of planks and a chopping block with an axe; tier 3 a large thatched carpentry hall, stacks of planks, a wooden cart and a half-built dugout boat.',
    b: 'HORSE RANCH: tier 1 a small round wooden corral with two horses and a little hay; tier 2 a bigger fenced paddock with four horses, a thatched stable, hay bales and a water trough; tier 3 two long thatched stables, six horses, troughs and hay stacks, all inside the plot.' })
workJob('RM-town-work-market-yard', 'market', 'yard', ['/realm/town/work-market-3.png', '/realm/town/work-yard-3.png'],
  'work-market-1,work-market-2,work-market-3,work-yard-1,work-yard-2,work-yard-3',
  '장터는 흰 다듬은 돌 테두리 · 장정 마을 3단은 흙이 터 밖으로 번진다 · 빈 터·논 조각과 각도·결이 다름',
  { title: '장터·장정 마을 1·2·3단',
    a: 'MARKET: tier 1 goods laid out on straw mats (pottery jars, baskets of grain, a rack of dried fish), no stalls; tier 2 three thatched stalls with bolts of cloth, pottery and baskets; tier 3 a busy market square of many thatched stalls, a raised storehouse and a wooden balance scale, goods everywhere (no people).',
    b: 'TRAINING YARD for recruits: tier 1 one straw archery target, a spear rack and a small open shed; tier 2 a thatched barracks hut, a round fenced practice ring and two targets; tier 3 a long barracks, a wooden watchtower, a row of targets, spear racks and racks of round wooden shields.' })
workJob('RM-town-work-smithy-jeotgal', 'smithy', 'jeotgal', ['/realm/town/work-smithy-3.png', '/realm/town/work-jeotgal-3.png'],
  'work-smithy-1,work-smithy-2,work-smithy-3,work-jeotgal-1,work-jeotgal-2,work-jeotgal-3',
  '대장간은 흰 다듬은 돌 테두리 · 젓갈 창고 3단은 흙이 번져 크기가 어긋난다 · 빈 터와 각도·결이 다름',
  { title: '대장간·젓갈 창고 1·2·3단',
    a: 'BLACKSMITH: tier 1 an open stone forge hearth with fire, an anvil on a tree stump, leather bellows, a water tub and tongs; tier 2 a thatched forge shed with a clay chimney, an anvil and racks of iron spears; tier 3 a larger stone-and-timber forge with two clay chimneys, two anvils, weapon racks and bundles of iron bars.',
    b: 'FERMENTED-FISH STOREHOUSE: tier 1 a few brown onggi fermentation jars and a basket of small fish; tier 2 rows of onggi jars on a low stone platform, fish-drying racks and a thatched shed; tier 3 many rows of jars, a big thatched storehouse, white salt heaps, fish racks and wooden barrels.' })

// ── 3. 오프닝 (첫 30초 · 둘 다 챗지피티 그림과 반반 이어 보인다: op-forge→event-iron-trade · op-drums→film-win-field)
const OPEN = 'Full-screen cinematic opening scene, 16:9 (final 1536x864). Phones in portrait crop it to the central third, so the main action sits within the central third of the width; the lower 30% stays darker and calmer because subtitles are printed there.'
jobs.push({ id: 'RM-bg-op-forge', group: 'remake-bg', save: 'remake_bg_op-forge.png', title: '오프닝 4장면 · 대장간의 밤',
  refs: ['/realm/opening/op-forge.jpg', '/realm/event/event-iron-trade.jpg', '/realm/keyart/byeonhan.jpg'],
  now: '제미나이 사진풍(옆 챗지피티 그림과 결이 다름) · 오른쪽 아래에 검은 네모(표식 가린 자국)',
  use: '16:9 → 1536×864 jpg q86 → public/realm/opening/op-forge.jpg (opening.ts 4장면 앞 반쪽)',
  prompt: `${OPEN}
IMAGE 1 is the old version (content only). IMAGE 2 is the picture shown right after this one in the same scene and IMAGE 3 is our key art: match their painting style exactly.
Scene: night, an iron-age village smithy of Byeonhan. A strong bare-chested smith with a topknot strikes glowing iron on an anvil set on a tree stump, sparks flying; behind him a helper pumps leather bellows at a squat clay furnace; stacks of flat axe-shaped iron ingots, baskets of charcoal, finished bows and spears hanging on the mud wall; an open thatched shed with heavy timber posts; thatched houses of the village outside in the dark. Warm firelight against blue night.
${PAINT} ${RULES}` })
jobs.push({ id: 'RM-bg-op-drums', group: 'remake-bg', save: 'remake_bg_op-drums.png', title: '오프닝 5장면 · 새벽 군막의 큰 북',
  refs: ['/realm/opening/op-drums.jpg', '/realm/howwin/howwin-draft.jpg', '/realm/film/film-win-ford.jpg'],
  now: '제미나이 사진풍 · 뒤 산이 중국 계림 같은 뾰족 봉우리 · 북 치는 이가 일본 다이코 꼴(머리띠) · 둥근 투구가 중국풍',
  use: '16:9 → 1536×864 jpg q86 → public/realm/opening/op-drums.jpg (opening.ts 5장면 앞 반쪽 · 뒤 반쪽 film-win-field 도 RM-bg-film-4 로 다시)',
  prompt: `${OPEN}
IMAGE 1 is the old version (content only). IMAGE 2 and IMAGE 3 are our paintings: match their style exactly.
Scene: misty dawn in a war camp before battle. In the foreground a warrior in lamellar leather-and-iron armor beats a great barrel war drum on a wooden stand with two thick drumsticks; beyond him ranks of spearmen in hemp tunics and simple lamellar vests assemble in the mist; tall plain cloth banners on poles painted with simple animal shapes (tiger, crane, turtle, horse, deer); thatched huts and hide tents, small campfires; rounded green Korean mountains fading in mist (no tall pillar-like karst peaks). Hair in topknots, no Japanese-style headbands, no conical Chinese helmets.
${PAINT} ${RULES}` })
jobs.push({ id: 'RM-bg-film-4', group: 'remake-bg', save: 'remake_bg_film-4.png', title: '끝 필름 넷 (도읍 함락·수성 승리·들판 승리·패주) 2×2 한 장',
  refs: ['/realm/film/film-take-capital.jpg', '/realm/film/film-win-defend.jpg', '/realm/film/film-take-town.jpg', '/realm/film/film-win-ford.jpg'],
  now: '네 장만 제미나이(필름 열둘 중) · 결이 흐리고 얼굴이 뭉개짐 · 흰 매듭 머리띠 · 수성 승리 아래 검은 띠 · 도읍 함락 오른쪽 끝에 옆 칸 번짐',
  use: '1536×1024 → 2×2 등분(각 768×512) → 칸마다 가운데 16:9(768×432, 위아래 40px 잘라) → 1280×720 jpg q86 → public/realm/film/film-take-capital · film-win-defend · film-win-field · film-win-rout.jpg (옛 필름 sheet2·3 과 같은 굽기)',
  prompt: `Create ONE image, landscape 3:2 (1536x1024): four separate paintings in a strict 2x2 grid of equal panels with thin black gutters, no labels. Each panel will be cropped to 16:9, so keep the top and bottom 8% of each panel expendable (sky or ground). These are short "film" stills of our early-Korean army shown at the end of a game. IMAGE 1 and IMAGE 2 are the old versions of panels 1 and 2 (content only). IMAGE 3 and IMAGE 4 are the other film stills of the same set: match their painting style, detail and faces exactly.
1. top-left, TAKING THE ENEMY CAPITAL: our spearmen march in through the opened log gate of a palisade town under a thatched gate tower, our banner raised on the wall, townsfolk watching from the side, smoke in the air, warm evening light.
2. top-right, DEFENSE WON: dusk, our defenders on the walkway behind our sharpened log palisade cheer with raised spears, bows and torches while the enemy retreats in the dark field below, small fires in the distance.
3. bottom-left, VICTORY IN THE FIELD: an open grassy battlefield after the fight, archers and spearmen raise their weapons and shout, a drummer beats a war drum, dropped enemy shields and banners on the ground, golden light through dust.
4. bottom-right, THE ROUT: the enemy flees over a grassy slope in disorder, our mounted commander points his spear to order the chase, our foot soldiers running after them, dust.
Soldiers wear hemp tunics, leather-and-iron lamellar vests, topknots; round wooden shields; banners plain or with simple animal shapes.
${PAINT} ${RULES}` })

// ── 4. 마을 바탕 나머지 (땅 둘 + 방비 아홉 · 바탕 열둘은 한 벌 — 다 받은 뒤 한꺼번에)
const groundJob = (id, save, title, now, file, body, prev) => jobs.push({ id, group: 'remake-town', save, title,
  refs: [`/realm/town/${file}`, '/realm/keyart/tutorial.jpg'], now,
  use: `16:9 → 1376×768 PNG(RGB) → public/realm/town/${file} · RM-town-ground-field 와 같은 LOTS 를 쓰니 compose 로 네 터를 얹어 확인 · 바탕 열둘을 다 받은 뒤 한꺼번에 넣는다`,
  prompt: `${also(prev)}Create one 16:9 town board painting. The newer board attached LAST is the master: keep its exact camera, composition, village ring position and size, gates, roads, huts and the four empty plots, and its painting style. IMAGE 1 (the old version of this board) shows only what changes:
${body}
${PLOTS}
${NOPEOPLE} ${CAM} ${TOWN} ${BOARD} ${RULES}` })
groundJob('RM-town-ground-water', 'remake_town_ground-water.png', '마을 바탕 · 바닷가 목책', '제미나이 · 들판 바탕을 고쳐 받은 것이라 새 들판 바탕과 결이 달라진다', 'ground-water.png',
  'The surroundings are a seashore instead of rice fields: sandy beach and blue sea along the top-right and right side, a rocky shore at the upper left, a few dugout boats pulled up on the sand at the lower right, fishing nets drying on poles. No rice paddies. The inside of the palisade ring stays the same.', 'remake_town_ground-field.png')
groundJob('RM-town-ground-wood', 'remake_town_ground-wood.png', '마을 바탕 · 산골 목책', '제미나이 · 새 들판 바탕과 결이 달라진다', 'ground-wood.png',
  'The surroundings are a forested mountain valley instead of rice fields: dense pines and mixed forest all around, rocky mountain ridges along the top, a rocky stream at the lower right, stacked logs at the lower left. No rice paddies. The inside of the palisade ring stays the same.', 'remake_town_ground-field.png')
const FORT = {
  bare: ['목책 없음', 'NO palisade at all: an open, unwalled village. Where the palisade ring was there is only grass and dirt; the gate gaps and roads stay. Everything else identical.'],
  moat: ['해자', 'The same palisade plus a water-filled moat ditch running just outside it ALL the way around without gaps, crossed by one plank bridge at the bottom gate and one at the top gap. Everything else identical.'],
  earth: ['토성', 'The palisade is replaced by a rammed-earth rampart on the same ring: a layered tamped-earth wall with a sloped outer face and a low wooden fence on its crest, gate gaps kept. Everything else identical.'],
}
const LAND = { field: '들판', water: '바닷가', wood: '산골' }
for (const [land, lname] of Object.entries(LAND)) for (const [fort, [fname, body]] of Object.entries(FORT)) {
  groundJob(`RM-town-ground-${land}-${fort}`, `remake_town_ground-${land}-${fort}.png`, `마을 바탕 · ${lname} ${fname}`,
    fort === 'moat' ? '제미나이 · 해자가 군데군데 끊기고 왼쪽에서 뚝 그친다 · 새 바탕과 결이 달라진다' : fort === 'earth' ? '제미나이 · 흙성 띠가 납작하고 굵기가 들쭉날쭉 · 새 바탕과 결이 달라진다' : '제미나이 · 새 바탕과 결이 달라진다',
    `ground-${land}-${fort}.png`, body, `remake_town_ground-${land}.png`)
}

// ── 5. 신방 c·d (형 10-24: "신방 관련 이미지 전체 챗지피티 걸로" — 한도로 c·d 만 제미나이 · 세로판에 ✦ 표식이 남음)
const BRIDAL = 'Tasteful, romantic, no nudity, no people visible. Same composition and objects as IMAGE 1, only redrawn in the painting style of the other bridal-night pictures (IMAGE 2 and IMAGE 3): warm candlelight against cool blue moonlight, rich painterly detail. Leave every corner clean.'
jobs.push({ id: 'RM-bg-bridal-c', group: 'remake-bg', save: 'remake_bg_bridal-c.png', title: '신방 c · 꺼진 화촉 둘 (가로)',
  refs: ['/realm/event/event-bridal-c.jpg', '/realm/event/event-bridal-a.jpg', '/realm/event/event-bridal-b.jpg'],
  now: '제미나이 사진풍 · 같은 신방 넉 장 중 a·b(챗지피티)와 결이 다르다',
  use: '3:2 → 1536×1024 jpg q86 → public/realm/event/event-bridal-c.jpg',
  prompt: `Create one 3:2 landscape painting (1536x1024) for a wedding-night scene card.
Scene: the bridal chamber right after the two wedding candles were blown out together: one red and one blue candle in brass holders on a black lacquered table inlaid with mother-of-pearl, two thin smoke trails curling up and twining into one; behind, paper lattice windows glowing with blue moonlight, a folding screen painted with a pair of mandarin ducks and flowers, folded silk bedding with a hairpin and a ribbon on it.
${BRIDAL} ${PAINT} ${RULES}` })
jobs.push({ id: 'RM-bg-bridal-c-v', group: 'remake-bg', save: 'remake_bg_bridal-c-v.png', title: '신방 c · 꺼진 화촉 둘 (세로)',
  refs: ['/realm/event-v/event-bridal-c.jpg', '/realm/event-v/event-bridal-a.jpg', '/realm/event-v/event-bridal-b.jpg'],
  now: '오른쪽 아래에 제미나이 ✦ 표식이 그대로 보인다 (폰 세로 화면) · 사진풍',
  use: '2:3 → 1024×1536 jpg q86 → public/realm/event-v/event-bridal-c.jpg',
  prompt: `${also('remake_bg_bridal-c.png')}Create one 2:3 portrait painting (1024x1536): the same scene as the landscape version attached last, recomposed tall for a phone screen (candles and twining smoke in the middle, window above, table below).
Scene: the bridal chamber right after the two wedding candles were blown out together: one red and one blue candle in brass holders on a black lacquered mother-of-pearl table, two smoke trails twining into one, paper lattice windows with blue moonlight, a folding screen with mandarin ducks.
${BRIDAL} ${PAINT} ${RULES}` })
jobs.push({ id: 'RM-bg-bridal-d', group: 'remake-bg', save: 'remake_bg_bridal-d.png', title: '신방 d · 댓돌 위 두 켤레 (가로)',
  refs: ['/realm/event/event-bridal-d.jpg', '/realm/event/event-bridal-a.jpg', '/realm/event/event-marriage.jpg'],
  now: '제미나이 사진풍 · a·b(챗지피티)와 결이 다르다',
  use: '3:2 → 1536×1024 jpg q86 → public/realm/event/event-bridal-d.jpg',
  prompt: `Create one 3:2 landscape painting (1536x1024) for a wedding-night scene card.
Scene: night outside a noble's house: on the stone step before the raised wooden veranda, two pairs of shoes stand side by side, close together: a man's dark leather boots and a woman's embroidered silk shoes. A warm lantern hangs under the eave, paper doors glow softly from inside, fireflies over the garden, a low stone wall behind.
${BRIDAL} ${PAINT} ${RULES}` })
jobs.push({ id: 'RM-bg-bridal-d-v', group: 'remake-bg', save: 'remake_bg_bridal-d-v.png', title: '신방 d · 댓돌 위 두 켤레 (세로)',
  refs: ['/realm/event-v/event-bridal-d.jpg', '/realm/event-v/event-bridal-a.jpg', '/realm/event-v/event-marriage.jpg'],
  now: '오른쪽 아래에 제미나이 ✦ 표식이 그대로 보인다 (폰 세로 화면) · 사진풍',
  use: '2:3 → 1024×1536 jpg q86 → public/realm/event-v/event-bridal-d.jpg',
  prompt: `${also('remake_bg_bridal-d.png')}Create one 2:3 portrait painting (1024x1536): the same scene as the landscape version attached last, recomposed tall for a phone screen (the two pairs of shoes on the stone step in the lower middle, the veranda and hanging lantern above).
${BRIDAL} ${PAINT} ${RULES}` })

// ── 6. 계절 넘김 띠 (가로 화면 · Steam) — 세로판(season-v)은 챗지피티라 그대로, 가로판만 제미나이(10-19 · 920 폭)
const SEASON = {
  spring: 'SPRING: villagers planting rice seedlings in flooded terraced paddies, pink azaleas on the slopes, swallows, soft morning mist.',
  summer: 'SUMMER MONSOON: heavy rain from dark clouds, tall green rice, the river swollen and brown, villagers in straw rain capes hurrying along the dikes.',
  autumn: 'AUTUMN HARVEST: golden rice being cut, sheaves stacked, red and orange maples on the hills, clear crisp light.',
  winter: 'WINTER: deep snow on the thatched roofs and frozen paddies, smoke from the chimneys, a few villagers carrying firewood, grey snowy sky.',
}
for (const [s, mood] of Object.entries(SEASON)) {
  const first = s === 'spring'
  jobs.push({ id: `RM-bg-season-${s}`, group: 'remake-bg', save: `remake_bg_season-${s}.png`, title: `계절 넘김 띠 · ${{ spring: '봄', summer: '여름', autumn: '가을', winter: '겨울' }[s]} (가로)`,
    refs: [`/realm/season/season-${s}.jpg`, `/realm/season-v/season-${s}.jpg`, '/realm/keyart/tutorial.jpg'],
    now: first ? '제미나이 만화 결 · 920×434 저해상도 · 중국 계림 같은 뾰족 봉우리 · 세로판(챗지피티)과 다른 마을' : '제미나이 만화 결 · 저해상도 · 세로판(챗지피티)과 다른 마을',
    use: `16:9 → 가운데 2.2:1 띠(위 12%·아래 15% 잘라) 1600×727 jpg q86 → public/realm/season/season-${s}.jpg (seasonFx 띠 · cover 로 더 얇게 잘린다)`,
    prompt: `${first ? '' : also('remake_bg_season-spring.png')}Create one wide 16:9 landscape painting for a thin season-change banner. IMAGE 2 is the square painting of our village in this same season: keep this exact place, village, painting style and light, and recreate it as a wide panorama of the same valley${first ? '' : ' (the spring panorama attached last fixes the composition: keep the same viewpoint and layout, change only the season)'}. IMAGE 1 is the old banner: only shows what the banner is for, do not copy its style or its jagged peaks.
Keep: the same thatched houses and raised-floor granary, the tall wooden sotdae pole topped with carved birds, the log palisade, the river and the terraced rice paddies, rounded Korean mountains (no pillar-like karst peaks).
${mood}
Composition for a thin wide banner: everything important (village, sotdae pole, people) lies in the horizontal middle band between 28% and 65% of the height; the top 25% is calm sky and mist and the bottom 30% is calm water or field with no important detail, because the season name is printed over it. Villagers small in the mid-ground.
${PAINT} ${RULES}` })
}

// ── 7. 도읍 궁궐 네 단 (CAPITAL.md §1-1 · 판 머리 띠 · 2×2 한 장)
jobs.push({ id: 'RM-town-palace', group: 'remake-town', save: 'remake_town_palace.png', title: '도읍 궁궐 1·2·3·4단 2×2 한 장',
  refs: ['/realm/town/palace-hall-1.jpg', '/realm/town/palace-hall-4.jpg', '/realm/film/film-take-town.jpg', '/realm/keyart/tutorial.jpg'],
  now: '제미나이 연필·수채 · 깃발마다 가짜 한자 · 처마 밑 현판 가짜 글씨 · 2단이 겹지붕 누각(중국풍) · 3단 본채가 2단보다 작다',
  use: '1536×1024 → 2×2 등분(각 768×512) → 칸마다 가운데 16:9(768×432) → 1280×720 jpg q88 → public/realm/town/palace-hall-1~4.jpg · 1단을 palace-hall.jpg 로도 복사(.tvpband 바탕) · 판 머리는 아주 납작하게(폰 약 3.8:1) 가운데만 보인다',
  prompt: `Create ONE image, landscape 3:2 (1536x1024): four separate paintings in a strict 2x2 grid of equal panels with thin black gutters, no labels. Each panel will be cropped to 16:9 and shown as a very wide, thin header strip, so the main building sits in the middle band between 25% and 62% of the panel height, centered, and the lower 35% of every panel is an empty bare-earth courtyard. All four panels show the SAME place from the SAME eye-level camera at the same time of day: our chieftain's seat growing over four stages, each clearly bigger and grander than the one before. IMAGE 1 and IMAGE 2 are the old stage 1 and stage 4 (content only). IMAGE 3 and IMAGE 4 show the painting style to match.
1. top-left, stage 1, CHIEFTAIN'S GREAT HOUSE: a long single-story timber hall with a thick thatched roof on a low earth-and-stone platform with a few steps, one tall sotdae pole topped with a carved bird, a plain log fence behind.
2. top-right, stage 2, HIGH-FLOORED HALL: a larger hall raised high on thick wooden posts with a heavy wooden-shingle roof and a wide veranda, a broad stone stair, two sotdae poles, plain cloth banners.
3. bottom-left, stage 3, PALISADED PALACE: the stage-2 hall now enclosed by a tall sharpened-log palisade with a log gate and two thatched watchtowers, two side halls, banners with simple animal shapes.
4. bottom-right, stage 4, EARTHEN-WALLED ROYAL SEAT: a high rammed-earth rampart in front with a big wooden gate tower, the great hall and several halls rising behind it, many banners along the wall.
No pagoda towers, no glazed tiles, no curved Chinese eaves, plaques and banners without any writing. No people or only tiny guards.
${PAINT} ${RULES}` })

// ── 8. 도읍 장면 (제천 대회 카드 · 큰 잔치 · 큰 공사 완공 넷) — 제미나이 납작 만화 결, 사건 그림(챗지피티)과 따로 논다
const SCENE = 'One 16:9 landscape painting (final 1600x900) used behind a card with a dark overlay: keep the subject in the center, readable when darkened, no important detail in the lower 25%. No people, or only tiny far figures.'
const sceneJob = (id, file, title, now, refs, body) => jobs.push({ id, group: 'remake-bg', save: `remake_bg_${file.replace(/^event-/, '')}.png`, title,
  refs: [`/realm/event/${file}.jpg`, ...refs], now,
  use: `16:9 → 1600×900 jpg q86 → public/realm/event/${file}.jpg`,
  prompt: `${SCENE} IMAGE 1 is the old version (content only, do not copy its flat style). The other attached images are event paintings of the same game: match their painting style, color and detail exactly.
${body}
${PAINT} ${RULES}` })
sceneJob('RM-bg-skyfest', 'event-skyfest', '제천 대회 카드 (하늘 제사)', '제미나이 납작 만화 결 · 깃발마다 가짜 글자',
  ['/realm/event/event-yeonggo.jpg', '/realm/event/event-festival.jpg'],
  'Scene: the great sky-worship festival at night on an open hilltop ground: a huge bonfire beside a round fieldstone altar laid with offerings in pottery, tall sotdae poles topped with carved birds, tall plain cloth banners with simple geometric patterns, big barrel drums, a crowd dancing small in the far background, sparks rising into a starry sky.')
sceneJob('RM-bg-great-feast', 'event-great-feast', '큰 잔치 장면', '제미나이 납작 만화 결 · 네모 종이 등롱(중국풍)',
  ['/realm/event/event-festival.jpg', '/realm/event/event-yeonggo.jpg'],
  'Scene: our chieftain\'s courtyard at night prepared for a great feast: long low wooden tables laden with roast pigs, fish, rice cakes and onggi wine jars, a big bonfire in the middle of the yard, thatched halls around, torches on poles (no paper lanterns), plain cloth banners, tiny far guests only.')
sceneJob('RM-bg-wonder-altar', 'event-wonder-altar', '큰 공사 완공 · 소도 제단', '제미나이 납작 만화 결 (시데·도리이는 11-11 에 걷었지만 결이 그대로)',
  ['/realm/event/event-sodo-fugitive.jpg', '/realm/event/event-divination.jpg'],
  'Scene: the completed sacred sodo altar at dusk in a pine grove: a raised round fieldstone platform ringed by tall standing stones, ropes strung between them hung only with five-colored cloth strips and small bronze bells, a ritual fire in the middle, offering bowls, mist among old pines.')
sceneJob('RM-bg-wonder-dolmen', 'event-wonder-dolmen', '큰 공사 완공 · 큰 고인돌', '제미나이 하얗게 바랜 만화 결 · 둘레의 작은 고인돌이 의자처럼 보인다',
  ['/realm/keyart/tutorial.jpg', '/realm/event/event-sodo-fugitive.jpg'],
  'Scene: the completed great dolmen on a grassy hill at dawn: a huge flat capstone resting on two massive upright stones (table-type dolmen), offering pottery and a small fire in front, tall poles with plain cloth strips around it, a few smaller dolmens far away across the valley, morning mist.')
sceneJob('RM-bg-wonder-furnace', 'event-wonder-furnace', '큰 공사 완공 · 큰 쇠부리 가마', '제미나이 납작 만화 결',
  ['/realm/event/event-iron-trade.jpg', '/realm/keyart/byeonhan.jpg'],
  'Scene: the completed great iron-smelting works at dusk: a tall bottle-shaped clay furnace with a glowing mouth, molten iron flowing out along clay channels into molds, large leather bellows, neat stacks of flat axe-shaped iron ingots, thatched workshops, sotdae poles, sparks.')
sceneJob('RM-bg-wonder-sotdae', 'event-wonder-sotdae', '큰 공사 완공 · 솟대 숲', '제미나이 납작 만화 결 · 뒤에서 퍼지는 햇살(금지)',
  ['/realm/event/event-sodo-fugitive.jpg', '/realm/keyart/tutorial.jpg'],
  'Scene: the completed forest of sotdae: dozens of tall wooden poles topped with carved wooden ducks, hung with small bronze bells and cloth strips, standing in soft morning mist beside a sacred grove, a small thatched shrine hut in the distance. Soft diffuse light from an overcast sky, no sun and no light rays.')

// ── 9. 판 끝 마지막 장 (front.ts · 챗지피티 필름 열둘 뒤에 이어 나온다 — 제미나이 Argon 10-24)
const END = 'One 16:9 landscape painting (final 1600x900): the last still of the end-of-game film, shown right after the attached film stills, so match their painting style, faces and detail exactly. The bottom 25% stays calm because a title is printed there.'
const endJob = (k, title, now, refs, body) => jobs.push({ id: `RM-bg-end-${k}`, group: 'remake-bg', save: `remake_bg_end-${k}.png`, title,
  refs: [`/realm/end/end-${k}.jpg`, ...refs], now,
  use: `16:9 → 1600×900 jpg q86 → public/realm/end/end-${k}.jpg`,
  prompt: `${END} IMAGE 1 is the old version (content only).
${body}
${PAINT} ${RULES}` })
endJob('suzerain', '끝 · 맹주 (군장들이 절하는 큰 마당)', '제미나이 결(앞 필름과 다름) · 붉은 깃발에 가짜 글자', ['/realm/film/film-ally.jpg', '/realm/film/film-truce.jpg'],
  'Scene: the chieftains and warriors of many small states kneel in rows in a great dirt courtyard before our ruler, who stands at the top of the stone stair of a high timber hall with a thick thatched roof; sotdae poles, a log palisade with thatched watchtowers, fire braziers, banners of the many states with simple animal shapes. Warm dusk, no visible sun.')
endJob('ironsea', '끝 · 쇠의 바다 (덩이쇠 실은 배들)', '제미나이 결(앞 필름과 다름)', ['/realm/film/film-take-port.jpg', '/realm/keyart/byeonhan.jpg'],
  'Scene: a crowded iron harbor of Byeonhan at golden evening: wooden sailing ships with mat sails being loaded with stacks of flat axe-shaped iron ingots, porters carrying ingots along a log pier, smelting furnaces smoking on the shore, ships leaving across the bay. No visible sun.')
endJob('rite', '끝 · 큰 제사', '제미나이 결 · 줄에 흰 지그재그 종이(시데 · 일본 신사 꼴)', ['/realm/event/event-yeonggo.jpg', '/realm/film/film-ally.jpg'],
  'Scene: a great sky rite on a mountain meadow at dawn: a large crowd bows toward a fieldstone altar laden with grain and a white ox, where a shaman-queen in white with a bronze mirror and bells raises her arms; sotdae bird poles strung with ropes hung only with five-colored cloth strips and bronze bells; drummers. No white paper streamers. Misty light, no visible sun.')
endJob('unify', '끝 · 통일', '제미나이 결(앞 필름과 다름)', ['/realm/film/film-win-winter.jpg', '/realm/film/film-take-port.jpg'],
  'Scene: our banners raised all along a high rammed-earth fortress wall at dusk, soldiers cheering on the wall and a joyful crowd below, horsemen arriving, a wide river valley full of villages stretching beyond. Triumphant warm light from a cloudy sky, no visible sun.')
endJob('lose', '끝 · 패배', '제미나이 결(앞 필름과 다름)', ['/realm/event/event-captured-ours.jpg', '/realm/film/film-win-winter.jpg'],
  'Scene: our village after defeat at grey dusk: a burned and broken log palisade, a collapsed watchtower, smoke drifting, crows on charred poles, a few survivors with bundles walking away along the muddy road. Somber, desaturated.')

// 11-16 검수 반려 다시 (tools/out/remake-intake-20261116.json) — 같은 일에 고칠 점을 앞에 붙여 _r2 로
const retry = (id, fix, edit = (p) => p) => {
  const j = jobs.find((x) => x.id === id)
  jobs.push({ ...j, id: id + '-r2', save: j.save.replace(/\.png$/, '_r2.png'), title: j.title + ' · 다시', now: fix.now, prompt: fix.text + '\n' + edit(j.prompt) })
}
const FILM_FIX = { now: '챗지피티 첫 판도 흰 매듭 머리띠가 그대로 · 결이 옛 제미나이 그대로라 보류',
  text: 'ABSOLUTELY NO HEADBANDS: nobody wears any cloth band, tied cord, knotted strip or hachimaki around the head or forehead. Soldiers are bare-headed with a topknot, or wear iron or leather helmets. Paint in the darker, richer cinematic style of IMAGE 3 and IMAGE 4 (the newer film stills), not the flat style of IMAGE 1 and IMAGE 2.' }
retry('RM-bg-film-4', FILM_FIX)
const NOBLE = { now: '첫 판이 초가집으로 바뀜 · 형 10-24 「장수면 귀족인데 왜 평민 집」 · 옛 기와집 판을 지금 씀',
  text: "THE HOUSE MUST STAY A NOBLE'S HOUSE: a roof of plain dark-grey clay roof tiles with gently curving eaves (NOT thatch, NOT straw), thick wooden pillars on stone bases, a dancheong-painted bracket band under the eaves, latticed paper doors, as in IMAGE 1. No stone lantern (that reads Japanese); a low earthen wall with a tiled coping instead." }
retry('RM-bg-bridal-d', NOBLE)
retry('RM-bg-bridal-d-v', NOBLE, (p) => p.replace("also('remake_bg_bridal-d.png')", '').replace('remake_bg_bridal-d.png', 'remake_bg_bridal-d_r2.png'))

// 11-16 저녁 · 상태 아이콘 둘 — 제미나이 판에 빨간 해·햇살이 박혀 있다 (일장기 꼴 금지 규칙)
jobs.push({ id: 'RM-icon-sun', group: 'remake-icon', save: 'remake_icon_status-sun.png', title: '상태 아이콘 둘 (가뭄 · 흉조)',
  refs: ['/realm/icon/status-drought.png', '/realm/icon/status-bad-omen.png', '/realm/icon/status-famine.png', '/realm/icon/status-flood.png', '/realm/icon/status-plague.png'],
  now: '가뭄 = 갈라진 땅 위 빨간 해와 불꽃 햇살 · 흉조 = 햇살 고리 두른 일식 앞 까마귀 (둘 다 해 동그라미·햇살)',
  use: '2:1 투명 → node tools/slice-grid.mjs <받은 그림> 2 1 public/realm/icon/ status-drought,status-bad-omen 192 0.02 trim · 옛 것은 tools/retire-history.py 로 보관',
  prompt: `Create ONE transparent PNG, landscape 2:1 (1536x768): two separate game status icons side by side, each centered in its half with at least 10% empty margin, no labels, no outlines. IMAGE 1 and IMAGE 2 are the old versions (content idea only). IMAGE 3, IMAGE 4 and IMAGE 5 are other status icons of the same set: match their size, painted style, outline and lighting exactly.
1. left, DROUGHT: a cracked dry clay field tile with a withered rice plant and a dry, cracked onggi water jar lying on its side; heat shimmer suggested only by pale wavy air lines. Absolutely NO sun: no disc, no circle, no rays, no flames in the sky.
2. right, BAD OMEN: a black crow perched on a dead branch under a dark stormy cloud with a thin crack of lightning. Absolutely NO sun, NO eclipse, NO ring of light, NO rays behind it.
${ALPHA} ${RULES}` })

// 11-16 밤 · 비기 컷인 배경 판 (형: 「스킬바디 연출은 전신 나오는 게 촌스러워 · 던파 따라 하고 연출 배경도 만들게」)
//   액션 RPG 각성 컷인 문법(화면이 어두워지고 → 비스듬한 띠가 휙 → 띠 안에 장수 상반신·얼굴이 미끄러져 들고 → 기술 이름) 만 빌린다 · 남의 그림·로고는 쓰지 않는다
//   띠 안의 장수는 이미 있는 각성 초상(awaken-hd·awaken2-hd)을 상반신으로 잘라 쓴다 → 새로 굽는 건 띠 뒤 배경 판뿐 (코드: src/ui/realm/skillfx.ts 를 받은 뒤 바꾼다)
const CUT = 'Create ONE wide horizontal background plate, 3:1 landscape (2400x800), for an action-RPG "awakening cut-in": it fills a dramatic slanted band that sweeps across the battle screen for one second while a hero portrait slides in front of it. NO people, NO faces, NO weapons, NO creatures, NO text, letters, symbols or logo. Pure energy and atmosphere: strong horizontal motion streaks and speed lines rushing from left to right, the brightest burst of energy in the LEFT-CENTER third (where the hero\'s face will sit), fading to darker, calmer color toward the top, bottom and right edges so the band can be masked with torn ink edges. Rich hand-painted digital painting with ink brush texture and fine glowing particles, the same painterly finish as the attached awakening portraits (use them ONLY for color and rendering quality). Opaque, full-bleed, no border, no vignette frame. No red sun disc, no sun or sun rays anywhere.'
const CUTS = [
  ['fire', '불 (불 속성 비기 · w-fire)', '/realm/awaken2-hd/w-30-guya-soebi.jpg', 'Theme FIRE: roaring crimson and orange flame tongues and embers streaming sideways, dark charcoal smoke at the edges, a white-hot core.'],
  ['water', '물 (w-water)', '/realm/awaken2-hd/w-58-tamna-halla.jpg', 'Theme WATER: a breaking ocean wave rushing sideways, deep teal and turquoise water, white spray and foam streaks, glints of moonlight on the water.'],
  ['wind', '바람 (w-wind)', '/realm/awaken2-hd/w-64-miri-dallae.jpg', 'Theme WIND: pale jade and silver gale ribbons, swirling air currents, scattered leaves and petals whipping past, soft sky-blue haze.'],
  ['bolt', '번개 (w-bolt)', '/realm/awaken2-hd/w-97-goguryeo-mir.jpg', 'Theme LIGHTNING: violet and electric-blue lightning bolts forking horizontally through dark storm clouds, crackling white arcs, rain streaks.'],
  ['earth', '땅 (w-earth)', '/realm/awaken-hd/g-04-jinhan-giant.jpg', 'Theme EARTH: shattered amber and ochre rock slabs and dust bursting sideways from a cracking ground shockwave, flying gravel, warm golden dust light.'],
  ['war', '전장 (진격·버팀·호령·함성 · vanguard·stand·order·shout)', '/realm/awaken2-hd/l-L2-soseono.jpg', 'Theme BATTLE FURY: crimson and gold war energy, slashing ink brush strokes, flying sparks and torn red cloth strips, smoke of a battlefield, a deep blood-red core.'],
  ['spirit', '기도·제사 (rite · sway)', '/realm/awaken2-hd/l-L7-aryeong.jpg', 'Theme SPIRIT RITE: luminous jade and soft gold spirit mist, floating paper-lantern-like glowing motes (no lanterns), drifting bronze bell sound-ripples, sacred incense smoke streaming sideways.'],
  ['shadow', '그림자 (매복·속임 · ambush·feint)', '/realm/awaken2-hd/w-95-michuhol-haebi.jpg', 'Theme SHADOW: deep indigo and black night mist streaking sideways, thin silver moonlit slash lines, drifting dark feathers and smoke, a cold pale glow at the core.'],
  ['arrow', '한 발 (명궁 · snipe)', '/realm/awaken-hd/g-02-goguryeo-archer-prince.jpg', 'Theme ARCHER FOCUS: a single bright gold-white line of focus cutting horizontally through the middle, concentric wind rings around it, blurred golden speed lines and falling feathers, a calm dark blue-green field.'],
]
for (const [k, title, ref, body] of CUTS) jobs.push({ id: `CUT-${k}`, group: 'remake-cutin', save: `cutin_bg_${k}.png`, title: `컷인 배경 · ${title}`,
  refs: [ref, '/realm/fx/skill/common/ink-band.png'], now: '비기 컷인이 전신 그림을 그대로 띄워 촌스럽다(형) · 띠 뒤 배경이 먹 띠 하나뿐',
  use: '2400×800 → public/realm/fx/skill/bg/<이름>.webp · skillfx.ts 컷인: 비스듬한 띠(ink-band 가장자리로 가림) 안에 이 배경 + 각성 초상 상반신 미끄러짐',
  prompt: `${CUT}\n${body}\nIMAGE 2 only shows the torn ink-band shape the plate will be masked into (do not copy it).` })

// 11-16 밤 · 전투 띠 얼굴 크기 (형: 「등신비율 베이스라인 확실히 수치로 · 번예 갈매 얼굴이 너무 큼 · 머리카락은 상관없고 얼굴 자체가 크면 문제」
//   + 「만드는 김에 이동 프레임 자연스럽게 별도로」) · 목록·수치 tools/sprite-kit/head-audit-20261116.json · 참고 그림 tools/sprite-kit/prop-refs.py
//   장수마다 두 장: 동작 20자세(11-14 비율 교정과 같은 틀 · 넣는 도구가 그대로 읽는다) → 걷기 8칸(동작 판을 맨 뒤에 붙여 같은 사람·같은 비율로)
const AUDIT = JSON.parse(readFileSync('tools/sprite-kit/head-audit-20261116.json', 'utf8'))
const FACE = 'FACE SIZE RULE (measured on the two approved characters in IMAGE 1: Soseono, Gamsil and Jinha, both at the SAME standing height as this character): the standing height from the soles to the top of the SKULL is 4.5 heads (hair volume, buns, hats, crowns and feathers are NOT counted and may stay as big as in IMAGE 1). The FACE itself, from the eyebrows to the chin, is only 1/9 of the standing height; eye-to-chin is about 8% of the height; cheek-to-cheek face width is about 1/9 of the height. The CURRENT face in IMAGE 1 is about 40% too big, round and childlike: make the face clearly smaller, adult and slimmer-jawed, with a proper neck, while keeping the same body height.'
const PIX = 'Sharp deliberate pixel-cluster outlines and shading exactly like IMAGE 2 (premium HD pixel art), detailed tiny eyes with sclera, iris and upper lash, small nose and mouth; no blur, no smooth illustration look.'
// 11-16 무기 감사 — 띠가 원화와 다른 무기를 든 장수 (tools/sprite-kit/weapon-audit-20261116.json · 형: 「원화 기준으로 통일」)
const WAUDIT = JSON.parse(readFileSync('tools/sprite-kit/weapon-audit-20261116.json', 'utf8'))
const WROWS = Array.isArray(WAUDIT) ? WAUDIT : (WAUDIT.rows ?? [])
const WFIX = Object.fromEntries(WROWS.filter((r) => (r.mismatch ?? []).includes('sprite≠art')).map((r) => ['gen-' + r.key, r]))
const PORTRAIT = Object.fromEntries(WROWS.filter((r) => r.portrait).map((r) => ['gen-' + r.key, r.portrait]))
const tier = (k) => (k in AUDIT.tierA_chin_ge38 ? 'A' : k in AUDIT.tierB_chin_37 ? 'B' : '무기')
const SP_KEYS = [...Object.keys(AUDIT.tierA_chin_ge38), ...Object.keys(AUDIT.tierB_chin_37)]
for (const k of Object.keys(WFIX)) if (!SP_KEYS.includes(k)) SP_KEYS.push(k)
// 11-17 첫 12명은 얼굴이 1%p 밖에 안 줄어 모두 반려(tools/sprite-kit/prop-intake-20261117.json · 형: 크레딧 아끼기) →
//   새 문안(머리통 전체를 0.75 배로 · 숫자 · 기준 판을 IMAGE 2 로)으로 갈매 한 명만 시험 · 나머지는 시험이 통과할 때까지 줄에서 뺀다
// 11-17 형: 「실패한 것들만 다시 · 베이스라인 그림체 비슷하게」 → v3: 기준 판(소서노·감실·쇠비·온조)을 IMAGE 1 로 앞에 두고 그 그림체·비율을 「베끼게」 · 옛 띠는 옷·무기·자세 순서만 (IMAGE 2)
//   갈매 한 명 시험 → 통과하면 SP_KEYS 나머지(얼굴 큰 80명)
const SP_TEST = SP_KEYS.filter((k) => k !== 'gen-base-w-39-gosaburi-galmae')   // 11-17 갈매 v3 통과(턱 33%→30% · 소서노 29%) → 얼굴 큰 나머지 모두
const STYLE3 = 'STYLE MASTER (the most important rule): IMAGE 1 shows the three APPROVED characters of this same game (Soseono, Gamsil and Jinha, left to right). Your character must look like a FOURTH member of that exact group: the same cute-but-adult pixel-art look, soft painterly pixel shading, warm palette and slightly stylized chibi-leaning proportions: the same pixel-art rendering, the same outline weight, the same small adult face, the same head-to-body proportion (about 4.5 heads tall, the face eyebrow-to-chin about 1/9 of the standing height, a visible neck, head narrower than the shoulders) and the same standing height. If you placed your character next to IMAGE 1, the face must be the same size as theirs. Hair, buns, hats and crowns may stay large; only the face and skull must match.'
// 11-17 형: 「머리만 줄이고 있는 거 아냐? 팔다리 몸통 비율도 베이스라인과 비슷해야」 — v3 문안은 「얼굴·머리 비율만 바꾸고 나머지는 IMAGE 2 그대로」라 짧은 다리·넓은 몸통이 남았다
const BODY3 = 'BODY PROPORTION: copy the limb and torso proportions of Soseono, Gamsil and Jinha in IMAGE 1 exactly, not of IMAGE 2 and not realistic anatomy: about 4.5 heads tall, legs from crotch to sole about one third of the standing height, chunky stylized boots like theirs, hands and fists the same size as theirs. Bulky men stay broad through muscle, fur and armour but keep this same stylized build and the same rendering; they must not look more realistic, older-drawn or longer-legged than Soseono, Gamsil and Jinha.'
const HEAD2 = 'HEAD SIZE FIX (the most important rule — the previous redraw failed it): shrink the WHOLE HEAD (skull, face AND hair mass together) to 75% of its size in IMAGE 1 while keeping the body exactly the same height and build. Concretely, at the same standing height: the head (top of skull to chin) must be no taller than the head of the approved figures in IMAGE 2, the chin must sit at about one third of the way down from the top of the head to the soles, the head must be narrower than the shoulders, eyes small with adult spacing, a visible neck. Big round chibi heads are wrong.'
// 11-17 Claude 반려 다섯(얼굴이 v3 에서도 그대로 · 말발굽은 반투명 배경 막) → v4 · 형: 「반려된 다섯도 다시 시켜」
const SP_RETRY = { 'gen-base-w-40-mujin-munui': 'face', 'gen-base-w-27-mokji-jinha': 'face', 'gen-base-w-48-mujin-mudeung': 'face', 'gen-base-w-22-dongye-tiger-huntress': 'face', 'gen-base-g-66-geonma-malbalgup': 'alpha',
  // 11-17 형 「팔다리 몸통도」 → 이미 넣은 v3 중 기준 판보다 다리가 짧고 땅딸막한 사내 여섯
  'gen-base-g-45-dabeol-deulgae': 'body', 'gen-base-g-46-uga-nureongso': 'body', 'gen-base-g-52-tamna-oreum': 'body', 'gen-base-g-33-jeoga-metdol': 'body', 'gen-base-g-01-master-smith': 'body', 'gen-damul': 'body' }
const RETRY4 = {
  face: 'SECOND ATTEMPT (the v3 redraw was rejected because the face stayed as big as before): the FACE (eyebrows to chin) must be visibly SMALLER than in IMAGE 2 — no more than 1/10 of the standing height, narrower cheeks, smaller eyes, a longer neck and longer legs, so the figure reads as an adult of about 5 heads tall. Compare against IMAGE 1 before saving: if the face looks bigger than the face of Soseono at the same standing height, redraw it smaller.',
  body: 'BODY REDRAW: keep the new smaller face and make the whole figure match the stylized build of Soseono, Gamsil and Jinha in IMAGE 1 (same 4.5-head look, same leg length, same boots) and their rendering.',
  alpha: 'SECOND ATTEMPT (the v3 redraw was rejected because the background was a semi-transparent film, not truly transparent, and the face was still big): the background must be FULLY transparent (alpha 0) everywhere outside the figures — no haze, no film, no glow, no vignette. Also make the face smaller than IMAGE 2, matching the face of Soseono in IMAGE 1.',
}
// v4 를 받고도 Claude 가 반려한 것 → v5 (까닭 한 줄을 문안 맨 앞에)
const SAME_H = 'SIZE CONSISTENCY (the v4 was rejected for this): every one of the 20 cells shows the character at the SAME scale. The walking figures in cells 4 to 9 must be exactly as tall and as broad as the standing figures in cells 1 to 3 (only the stride changes), never a smaller or slimmer person.'
const SP_V5 = { 'gen-base-g-46-uga-nureongso': SAME_H, 'gen-damul': 'STYLE (the v4 was rejected by the lead artist): it looked realistic and long-legged. Match the cute stylized pixel look and build of Soseono, Gamsil and Jinha exactly.', 'gen-base-g-52-tamna-oreum': 'STYLE (the v4 was rejected by the lead artist): the v4 looked more realistic and longer-legged than Soseono, Gamsil and Jinha. Match their cute stylized pixel look and their build exactly.' }
// 11-17 저녁 형: 「베이스라인 될 애들부터 제대로 만들자. 무기별 성별로 쫙」 → 무기×성별 기준 판 열 장을 먼저(소서노=창·여 · 감실=주술·여 · 쇠비=도끼·여 는 이미 있음)
//   이 열 장을 형이 보고 맞다 할 때까지 나머지 얼굴 줄(v3·v4·v5)은 멈춘다 → 맞으면 각 장수는 자기 무기·성별 기준 판을 IMAGE 1 로
const BL = { '도끼·남': 'gen-hojin', '활·남': 'gen-jumong', '활·여': 'gen-haedal', '단검·남': 'gen-hogong', '단검·여': 'gen-irang',
  '주술·남': 'gen-gomok', '도끼·여': 'gen-soebi', '돌팔매·남': 'gen-base-g-38-chopal-palmae', '창·남': 'gen-oi', '칼·여': 'gen-ara' }   // 칼·남 = 지금 온조(관 키 바로잡음 headgear.json · 형 「남자 베이스라인에 가깝다」)
const BL_MODE = true
// 형 판정 뒤 다시(bl2): 까닭을 문안 맨 앞에
const BL_RETRY = {
  'gen-haedal': 'SECOND DRAFT (lead artist): the head came out slightly too big. Make the head and face a little SMALLER than the first draft, never bigger than Gamsil in IMAGE 1. The outfit was too covered: make it clearly more revealing as described below.',
  'gen-hogong': 'SECOND DRAFT (lead artist): he came out shorter than the women. He must stand clearly TALLER than Soseono and every woman in IMAGE 1 (top of skull higher than theirs), with longer legs and broader shoulders, same style.',
}
const BL_OF = Object.fromEntries(Object.entries(BL).map(([slot, k]) => [k, slot]))
const SP_RUN = BL_MODE ? Object.values(BL) : SP_KEYS.filter((k) => SP_TEST.includes(k))
for (const k of SP_RUN) {
  const BLT = BL_OF[k] ? `BASELINE MASTER (${BL_OF[k]}): this sheet becomes the style reference that every other character with the same weapon and gender will be drawn from, so it must sit perfectly beside Soseono, Gamsil and Jinha in IMAGE 1 as one family: identical pixel rendering, outline weight, palette warmth, face size, 4.5-head build, leg length and boot size. Check side by side before saving.\n` : ''
  const MALE = BL_OF[k]?.endsWith('남') ? 'HEIGHT (men): the standing height from the soles to the top of the SKULL (not hair, crown or hat) must be EQUAL TO OR TALLER than Soseono in IMAGE 1, with broader shoulders; a man must never look shorter or smaller than the women.\n' : ''
  // 11-17 형: 「여캐들은 더 노출 높아도 될 듯 · 어차피 픽셀 캐릭터니까」 (스팀 15세: 비침·유두 윤곽만 금지)
  const isW = BL_OF[k] ? BL_OF[k].endsWith('여') : /^gen-(base-)?[wl]-/.test(k) || ['gen-irang', 'gen-haedal', 'gen-ara', 'gen-soebi'].includes(k)
  const SKIN = isW ? 'OUTFIT (women): make the outfit noticeably more revealing than IMAGE 2, at least as revealing as Gamsil in IMAGE 1: bare shoulders, a deep neckline with cleavage, a bare midriff and bare thighs or a high slit, keeping the character’s own colours, materials and ornaments. Fabric stays opaque: no see-through cloth and no nipple outline.\n' : ''
  const V = BL_OF[k] ? (BL_RETRY[k] ? 'bl2' : 'bl') : SP_V5[k] ? 'v5' : SP_RETRY[k] ? 'v4' : 'v3', R4 = (BL_RETRY[k] ? BL_RETRY[k] + '\n' : '') + BLT + MALE + SKIN + (SP_V5[k] ? SP_V5[k] + '\n' : '') + (SP_RETRY[k] ? RETRY4[SP_RETRY[k]] + '\n' : '')
  const bust = PORTRAIT[k] ?? (k.startsWith('gen-base-') ? k.slice('gen-base-'.length) : null)
  const refs = ['/assets_src/realm/sprite-prop/ref-style3.png', `/assets_src/realm/sprite-prop/${k}-now.png`, ...(bust && existsSync(`public/realm/bust-hd/${bust}.jpg`) ? [`/realm/bust-hd/${bust}.jpg`] : [])]
  const wf = WFIX[k]
  const WEAP = wf ? `WEAPON FIX (most important): in the original portrait art (IMAGE 3) this character holds ${wf.artWeapon}, NOT the ${wf.spriteWeapon} drawn in IMAGE 2. Redraw every cell with the ${wf.artWeapon} from the portrait, held the same way in all poses; the attack poses use it the way that item is really used (swing, thrust, throw, ring, play or wave it).
` : ''
  const who = k.slice(4)
  jobs.push({ id: `SP-${who}-act-${V}`, group: 'remake-sprite', save: `sprite_prop_${who}_act_${V}.png`, title: `${BL_OF[k] ? `★ 기준 판 ${BL_OF[k]} · ` : ''}${who} · 전투 띠 20자세 (${wf ? '무기 바로잡기 · ' : ''}얼굴 ${tier(k)})`,
    refs, now: `${wf ? `띠 무기 ${wf.spriteWeapon} → 원화 ${wf.artWeapon} · ` : ''}${tier(k) === '무기' ? '얼굴은 기준 안' : `얼굴이 기준보다 큼 · 턱 위치 몸 키의 ${AUDIT.tierA_chin_ge38[k] ?? AUDIT.tierB_chin_37[k]}% (기준 31~33%)`}`,
    use: `받으면 11-14 비율 교정과 같은 길로 띠에 넣음(anim-px/${k}.png · 걷기 칸은 다음 장으로 바꿈) · 옛 띠는 assets_src/realm/retired 로`,
    prompt: `${R4}${STYLE3}
${WEAP}Draw the character of IMAGE 2 (the current battle sprite sheet, 20 cells read left to right, top to bottom — use it ONLY for costume, colors, weapon and the pose order, NOT for head size or drawing style)${refs.length > 2 ? ' — IMAGE 3 is the character portrait for face identity' : ''}: all 20 poses in exactly FOUR columns x FIVE rows.
${FACE}
Keep this character's face identity, gender, age, hairstyle, colors, clothing layers, ornaments and weapon from IMAGE 2/3, but draw them in the style and WHOLE-BODY proportion of IMAGE 1. ${BODY3} ${PIX}
Every weapon complete and the same size and material in all 20 cells; spears stay a long WOODEN shaft with a SMALL metal head, never a sword. Keep every cell's action as in the SAME cell of IMAGE 2 (same pose order: idles, walk, attack, guard and hit, lying defeated); the face, head AND BODY proportions, the pixel quality and any broken weapon change. If archer: the bow stays in all 20 poses, the release pose has an empty draw hand, and no knife or sword appears. All standing poses face RIGHT in 3/4 view with the same adult proportions and the same standing height.
True transparent alpha background with 10% padding around every complete figure, weapon and feather in every cell. No grid lines, labels, text, effects, shadow or background. Exactly 20 distinct full-body figures.` })
  jobs.push({ id: `SP-${who}-walk-${V}`, group: 'remake-sprite', save: `sprite_prop_${who}_walk_${V}.png`, title: `${who} · 걷기 8칸 (자연스러운 걸음)`,
    refs, now: '걷기 칸이 거의 한 자세라 미끄러지듯 움직임',
    use: `받으면 띠의 걷기 칸을 이 8칸으로 (1·5번 다리 반대 검사 · tools/sprite-kit/check-strip.py)`,
    prompt: `[코덱스] D:/에셋창고/sprite_prop_${who}_act_${V}.png 도 맨 뒤에 첨부 (방금 만든 동작 판)
Using the corrected character in the LAST attached image (the new action sheet) as the exact identity, outfit, weapon and proportions — NOT the old big-faced IMAGE 2 — draw ONE natural 8-frame walk cycle, facing RIGHT in 3/4 view, in a strict grid of FOUR columns x TWO rows, row-major order: 1 contact (right foot forward, heel down), 2 down (weight sinks), 3 passing (left leg passes the right), 4 up (body highest), 5 contact (LEFT foot forward), 6 down, 7 passing, 8 up. Frames 1 and 5 have opposite legs forward and must NOT look alike: in frame 1 the near (camera-side) leg is forward and the far arm swings forward, in frame 5 the far leg is forward and the near arm swings forward; arms swing opposite to the legs; the head bobs 1 to 2 pixels between down and up; hair, cloth and ornaments follow the motion a beat late. The weapon is carried relaxed in the same hand with the same grip and the same size in all 8 frames. ${FACE.split(':')[0]}: keep exactly the face and head size of the new action sheet.
${PIX} Same standing height as the action sheet, feet on one shared baseline in every cell. True transparent alpha background with 10% padding, no grid lines, labels, text, shadow or background.` })
}

export const REMAKE_JOBS = jobs
