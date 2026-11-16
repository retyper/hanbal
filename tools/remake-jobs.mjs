// remake-jobs.mjs — 제미나이로 받아 결이 어긋나거나 이상한 마을·배경 그림을 챗지피티로 다시 (2026-11-16 · 표: docs/realm/production/REMAKE-20261116.md)
//   release-jobs 와 같은 꼴 { id, group, save, title, refs, now, use, prompt } · 배열 차례 = 굽는 차례 (형 눈에 자주 띄고 이상한 것부터)
//   refs 1번 = 지금 그림(무엇을 그리나) · 나머지 = 챗지피티 화풍 기준 · 앞 장 결과가 필요한 장은 문안 첫 줄에 「D:/에셋창고/<이름> 도 첨부」
//   한 벌(일터 1·2·3단 · 궁궐 네 단 · 필름 넷)은 격자 한 장으로 받아 코드로 자른다 — 크레딧을 아끼고 서로 맞는다

export const REMAKE_GROUPS = { 'remake-town': '마을 다시', 'remake-bg': '배경 다시' }

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

export const REMAKE_JOBS = jobs
