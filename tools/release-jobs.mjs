// release-jobs.mjs — 출시 전 그림 일 (11-15 감사: 그림 줄·코드의 빌린 그림 대조) · tools/release-pack.mjs 가 불러 카드로 만든다
//   그룹: steam 스팀 캡슐 · r15 15세 판 · bust 고화질 초상 · cover 장 표지 · skill 비기 전신
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { CARDS as STORE } from './store-pack.mjs'
import { bodyBase } from './haebi-repair-jobs.mjs'
import { AWAKEN_ART } from '../src/realm/data/awaken-art.ts'

export const GROUPS = { steam: '스팀 캡슐', r15: '15세 판', bust: '고화질 초상', cover: '장 표지', skill: '비기 전신', skill1: '각성 비기 전신', dlc: '진각성 묶음', skill2: '진각성 비기 전신' }
const pub = (p) => '/' + p.replace(/^public\//, '')
const jobs = []

// 열전 무기 묶음(활·창·칼) 그림 (11-15 · 지금은 병종 아이콘·화살 그림을 빌림 · haebi-pack 과 같은 이름 규칙)
const RAID_STYLE = 'Match the attached references exactly in rendering: the same hand-painted fantasy icon style, dark bronze and iron with warm highlights, original early-Korean historical fantasy, not Chinese imperial, no Japanese motifs, no red sun discs. Real transparent background, no checkerboard, no text, no letters, no numbers, no frames or borders around each piece.'
jobs.push({ id: 'H27', group: 'raid', save: 'haebi-pack-v1-H27.png', title: '활·창·칼 능력 아이콘 여섯', refs: ['/realm/raid/power-axe.png', '/realm/raid/power-gale.png', '/realm/raid/power-thunder.png'],
  now: '병종 아이콘(궁수·창병·장수)과 바람 칼날을 빌려 씀', use: '열전 능력 칸·강화 카드 · 받으면 tools/haebi-art-intake 로 power-<이름>.png 6장',
  prompt: `Create one transparent PNG, 1536x1024, a 3x2 grid of six game ability icons that sit in the same set as the attached three icons (same size, framing, lighting and brush quality). Each icon is one bold readable symbol centered in its cell with generous empty margin, no cell lines. ${RAID_STYLE}\nRow 1: 1) Rapid shot: a short Korean recurve bow at full draw with a glowing arrow. 2) Arrow rain: a fan of many arrows falling diagonally from above onto a small cracked ground mark. 3) Piercing spear: a long iron spearhead thrusting forward with a sharp motion streak.\nRow 2: 4) Javelin: one spear flying in a shallow arc with a green wind trail. 5) Ring-pommel sword: a Korean ring-pommel straight sword (hwandudaedo) slashing in a bright arc. 6) Sword wave: a pale blue crescent of sword energy flying forward.` })
jobs.push({ id: 'H28', group: 'raid', save: 'haebi-pack-v1-H28.png', title: '투창·검기 투사체', refs: ['/realm/raid/arrow.png', '/realm/raid/wind-blade.png', '/realm/raid/axe.png'],
  now: '투창은 화살 그림을 길게, 검기는 바람 칼날을 키워 씀', use: '전장에 날아가는 투사체 · javelin.png · sword-wave.png (코드가 이미 이 이름을 찾는다)',
  prompt: `Create one transparent PNG, 1536x1024, two separate game projectile sprites side by side with wide empty space between them, both pointing exactly to the RIGHT, seen from above at a slight 3/4 angle, matching the attached arrow and blade sprites in rendering and scale feel. ${RAID_STYLE}\n1) Javelin: one straight wooden throwing spear with a narrow iron head and a small red cord binding, long and thin (about 8:1), a faint green motion trail behind it.\n2) Sword wave: one pale blue-white crescent of sword energy, thick in the middle and tapering to sharp tips, glowing softly, curved like the attached wind blade but larger and sharper.` })
jobs.push({ id: 'H29', group: 'raid', save: 'haebi-pack-v1-H29.png', title: '활·창·칼 조합 문양 여섯', refs: ['/realm/raid/cyclone.png', '/realm/raid/inferno.png', '/realm/raid/torrent.png'],
  now: '조합 완성 표시가 능력 아이콘을 빌려 씀', use: '받으면 assets_src/realm/raid 에 두고 py -3 -I tools/raid-kit-art.py → <조합>.png 6장 · raid-main COMBO_ART',
  prompt: `Create one transparent PNG, 1536x1024, a 3x2 grid of six combo emblems in the same set as the 3 attached emblems (same size, framing, brush, glow). One bold symbol per cell, wide margins, no cell lines. ${RAID_STYLE}
Row 1: 1) Thousand arrows: a ring of arrows bursting outward in all directions. 2) Meteor arrow rain: a falling flaming arrow cluster shattering into sparks on impact. 3) Spear grove: a circle of spearheads erupting from cracked ground.
Row 2: 4) Returning spear: one spear curving in a loop back on itself with a green trail. 5) Blade storm: a whirlwind of pale sword slashes around one center. 6) Splitting sword wave: a blue crescent of sword energy forking into two.` })

// 열전 15분 · 적 단계 (형 11-16: 「적들이 죄다 한방 · 다이센카처럼 적이 단계업 · 쉬운 적은 초반에만, 다음엔 안 나옴」)
//   1단 0~3분 몽둥이 졸개·활잡이(있음) → 2단 3~6분 창돌격꾼·투석꾼 → 3단 6~9분 방패잡이·산들개 → 4단 9~12분 도끼 광전사·불화살 궁수 → 5단 12분~ 철갑 산적·산적 무당 → 두목
//   앞 단계 적은 다음 단계가 오면 더는 나오지 않는다. 단계마다 생김새·움직임이 달라야 한다
const BANDIT = (who, poses) => `Use case: production game asset, not a presentation.\nCreate ONE NEW transparent PNG combat sprite sheet of ${who} Input 1 is the existing common bandit for scale and outfit family; Input 2 is the bandit warlord of the same army. Match Input 2 exactly in pixel-art rendering, outline, palette range and scale.\n\nArt direction: clean hand-crafted pixel art for a premium Korean 2D action RPG, readable outline, restrained colour clusters, no blur or painterly texture. Keep the same face, body, outfit and weapon in EVERY pose. Three-quarter view facing right. Original early-Korean historical fantasy; no Japanese or Chinese imperial armour, no red sun discs.\n\nLayout: square canvas, strict evenly spaced 3-column by 3-row grid, nine full-body sprites at IDENTICAL SCALE on genuine transparency, each with at least 10 percent empty margin in its cell; nothing touches a cell edge. In the three running poses keep the hips at the SAME horizontal spot of the cell (only the legs move). No cell outlines, no text.\n\nPose order left to right, top to bottom:\n${poses}\n\nNo scenery, no shadow plane, no watermark, no captions.`
jobs.push({ id: 'H30', group: 'raid', save: 'haebi-pack-v1-H30.png', title: '3단 · 산적 방패잡이 (단단한 적 · 3×3 아홉 자세)', refs: ['/realm/anim-px/bandit-club.png', '/assets_src/realm/raid/haebi-pack-v1-H25.png'],
  now: '없음 · 잡졸이 몽둥이·활잡이 둘뿐이라 오래 싸우면 단조롭다', use: '3단(6~9분) · 느리고 단단함 · 앞에서 오는 투사체를 방패로 덜 받음 · 넣는 길은 H26 과 같은 3×3 굽기',
  prompt: BANDIT('a BANDIT SHIELD BRUTE, a slow heavy enemy: a big broad adult man, patched leather and rough iron-plate vest over dark hemp, red cord bindings, a large round wooden shield banded with iron held in front, a short heavy iron-studded club in the other hand.', '1. Ready idle behind the shield.\n2. Walking heavily, left leg forward, shield in front.\n3. Walking heavily, right leg forward.\n4. Walking, mid-stride.\n5. Raising the club over the shield.\n6. Smashing the club down to the right.\n7. Shield bash forward to the right.\n8. Hit recoil, shield lowered, staggering back.\n9. Defeated, lying horizontally, head to the right, shield beside him.') })
jobs.push({ id: 'H31', group: 'raid', save: 'haebi-pack-v1-H31.png', title: '2단 · 산적 창돌격꾼 (빠른 적 · 3×3 아홉 자세)', refs: ['/realm/anim-px/bandit-club.png', '/assets_src/realm/raid/haebi-pack-v1-H25.png'],
  now: '없음', use: '2단(3~6분) · 붉은 줄로 돌진 예고 뒤 직선 돌진',
  prompt: BANDIT('a BANDIT SPEAR RUNNER, a fast light enemy: a wiry young adult man, bare arms, short ragged dark hemp tunic, red cloth headband with long tails, straw sandals, a plain wooden spear with a narrow iron head held low in both hands.', '1. Ready idle, spear low.\n2. Sprinting, left leg forward, leaning forward, spear pointed ahead.\n3. Sprinting, right leg forward.\n4. Sprinting, mid-stride.\n5. Crouching to charge, spear pulled back.\n6. Lunging thrust to the right, spear fully extended inside the cell.\n7. Recovering from the thrust.\n8. Hit recoil, leaning back.\n9. Defeated, lying horizontally, head to the right, spear beside him.') })
const TIER = (id, title, use, who, poses) => jobs.push({ id, group: 'raid', save: `haebi-pack-v1-${id}.png`, title, refs: ['/realm/anim-px/bandit-club.png', '/assets_src/realm/raid/haebi-pack-v1-H25.png'], now: '없음', use, prompt: BANDIT(who, poses) })
TIER('H33', '2단 · 산적 투석꾼 (멀리서 돌팔매 · 3×3)', '2단(3~6분) · 떨어질 자리에 그림자 원 뒤 돌이 포물선으로 떨어짐',
  'a BANDIT SLINGER, a light ranged enemy: a thin adult man, ragged dark hemp clothes, red cord belt, a cloth pouch of stones at the hip, a long braided rope sling.',
  '1. Ready idle, sling hanging.\n2. Running, left leg forward.\n3. Running, right leg forward.\n4. Running, mid-stride.\n5. Swinging the sling overhead in a circle, the whole rope visible.\n6. Releasing the stone forward to the right, arm extended.\n7. Reaching into the stone pouch.\n8. Hit recoil, leaning back.\n9. Defeated, lying horizontally, head to the right, sling beside him.')
jobs.push({ id: 'H34', group: 'raid', save: 'haebi-pack-v1-H34.png', title: '3단 · 산들개 (떼로 빠르게 · 3×3)', refs: ['/realm/anim-px/bandit-club.png', '/assets_src/realm/raid/haebi-pack-v1-H25.png'], now: '없음',
  use: '3단(6~9분) · 체력 낮고 아주 빠른 떼 · 다섯 마리씩 한쪽에서 몰려옴',
  prompt: `Use case: production game asset, not a presentation.\nCreate ONE NEW transparent PNG combat sprite sheet of a WILD MOUNTAIN DOG used by the bandits: a lean scruffy grey-brown Korean mountain dog with a torn red cloth tied around its neck, bared teeth, NOT a cute pet and NOT a cartoon. Match Input 2 exactly in pixel-art rendering, outline, palette range and scale; the dog's back is about at the knee height of the man in Input 1.\n\nArt direction: clean hand-crafted pixel art for a premium Korean 2D action RPG, readable outline, restrained colour clusters, no blur. The same dog in EVERY pose. Side three-quarter view facing right.\n\nLayout: square canvas, strict evenly spaced 3-column by 3-row grid, nine full-body sprites at IDENTICAL SCALE on genuine transparency, each with at least 10 percent empty margin; nothing touches a cell edge. In the running poses keep the body at the same horizontal spot of the cell. No cell outlines, no text.\n\nPose order left to right, top to bottom:\n1. Standing, growling.\n2. Galloping, front legs reaching forward.\n3. Galloping, legs gathered under the body.\n4. Galloping, mid-stride.\n5. Crouched, about to pounce.\n6. Leaping bite to the right, jaws open.\n7. Landing.\n8. Hit recoil, yelping, flinching back.\n9. Defeated, lying on its side, head to the right.\n\nNo scenery, no shadow plane, no watermark, no captions.` })
TIER('H35', '4단 · 도끼 광전사 (체력이 줄면 돌진 · 3×3)', '4단(9~12분) · 체력이 반 아래면 붉게 달아 빨라짐',
  'an AXE BERSERKER bandit: a huge bare-chested adult man covered in old scars and red war paint stripes, wild loose hair, fur kilt over hemp trousers, a heavy two-handed long-handled iron axe.',
  '1. Ready idle, axe resting on the shoulder.\n2. Running, left leg forward, axe raised.\n3. Running, right leg forward.\n4. Running, mid-stride.\n5. Roaring with the axe lifted high overhead.\n6. Huge overhead axe chop down to the right, the whole axe inside the cell.\n7. Axe stuck low after the chop, bent forward.\n8. Hit recoil, staggering back.\n9. Defeated, lying horizontally, head to the right, axe beside him.')
TIER('H36', '4단 · 불화살 궁수 (불붙는 바닥 · 3×3)', '4단(9~12분) · 떨어진 자리에 잠깐 타는 불바닥',
  'a FIRE ARCHER bandit: an adult man in a soot-blackened leather jerkin over dark hemp, a cloth mask pulled down around the neck, a clay fire pot hanging at the hip, a short recurve bow and arrows whose tips are wrapped in burning cloth.',
  '1. Ready idle, bow low.\n2. Running, left leg forward.\n3. Running, right leg forward.\n4. Running, mid-stride.\n5. Lighting an arrow tip at the fire pot, small flame.\n6. Full draw aiming right with a burning arrow, the whole bow inside the cell.\n7. Release, bow arm extended.\n8. Hit recoil, leaning back.\n9. Defeated, lying horizontally, head to the right, bow beside him.')
TIER('H37', '5단 · 철갑 산적 (아주 단단함 · 3×3)', '5단(12분~두목) · 느리고 아주 단단함 · 맞아도 덜 밀림',
  'an IRON-ARMOURED BANDIT VETERAN: a tall heavy adult man in a dark iron lamellar coat (small overlapping iron plates laced with red cord) taken from a dead soldier, a battered iron helmet with a cheek guard, a long iron-shod war club.',
  '1. Ready idle, club planted beside him.\n2. Marching, left leg forward.\n3. Marching, right leg forward.\n4. Marching, mid-stride.\n5. Winding up the club to the side.\n6. Wide horizontal club swing to the right.\n7. Follow-through, club low.\n8. Hit recoil, barely staggering.\n9. Defeated, fallen to the ground, head to the right, club beside him.')
TIER('H38', '5단 · 산적 무당 (곁의 적을 북돋움 · 3×3)', '5단(12분~두목) · 둘레 산적을 붉게 북돋움 · 먼저 잡아야 할 표적',
  'a BANDIT SHAMAN (Korean mudang style, original fantasy): an adult woman in a layered faded red and blue hemp robe with long sleeves, a tall dark cloth hat with paper streamers, a string of bronze bells in one hand and a fan of five coloured cloth strips in the other. Not Japanese, no miko outfit.',
  '1. Ready idle, bells held up.\n2. Walking, left leg forward.\n3. Walking, right leg forward.\n4. Walking, mid-stride.\n5. Spinning in a ritual dance, sleeves flaring.\n6. Shaking the bells forward to the right, cloth strips flying.\n7. Arms raised high, chanting.\n8. Hit recoil, flinching back.\n9. Defeated, lying horizontally, head to the right, bells beside her.')
jobs.push({ id: 'H32', group: 'raid', save: 'haebi-pack-v1-H32.png', title: '피해 숫자 글꼴 (0~9 · 보통·치명)', refs: ['/realm/raid/power-axe.png', '/realm/raid/ui-health.png'],
  now: '캔버스 글자로 띄움', use: '맞을 때 뜨는 피해 숫자 · 위 줄 보통 · 아래 줄 치명(큰 피해)',
  prompt: `Create one transparent PNG, 1536x512, a bitmap number font for floating damage numbers in a 2D action game. Two rows of the ten digits 0 1 2 3 4 5 6 7 8 9, left to right, evenly spaced on a strict 10-column grid with clear empty space between digits; every digit the same height and centred in its column. Row 1 (normal hit): chunky bold rounded digits, warm off-white fill, thick dark brown outline, tiny bronze bevel. Row 2 (heavy hit): the same digit shapes but golden-orange fill with a hot red outline and a small sharp spark accent on the top right of each digit. Readable at 24 pixels tall. Real transparent background, no checkerboard, no other letters, no plus or minus signs, no frames.` })

// 열전을 다이센카식 독립 모드로 (형 11-16: 판 밖 상점·영구 성장 · 스테이지마다 다른 적·난이도 · 깨면 휘장 · 무기 10단계 · 성공/실패 배경 · 단검·주술 무기)
jobs.push({ id: 'H39', group: 'raid', save: 'haebi-pack-v1-H39.png', title: '단검·주술 능력 아이콘 넷 + 조합 문양 넷', refs: ['/realm/raid/power-sword.png', '/realm/raid/power-bow.png', '/realm/raid/cyclone.png'],
  now: '없음 · 단검 장수는 칼, 무당 장수는 도끼 묶음을 빌려 씀', use: '새 무기 묶음 단검·주술의 능력 칸·강화 카드·조합 표시',
  prompt: `Create one transparent PNG, 2048x1024, a 4x2 grid of eight game icons in the same set as the attached icons (same size, framing, brush, glow). One bold symbol per cell, wide margins, no cell lines. ${RAID_STYLE}\nRow 1 (abilities): 1) Twin daggers: two short bronze daggers crossing in a quick X slash. 2) Thrown knives: a fan of three small throwing knives flying forward with thin motion lines. 3) Spirit bells: a bundle of bronze shaman bells ringing, with a pale gold sound ring around them. 4) Soul fire: two small blue-white floating spirit flames with curling tails.\nRow 2 (combo emblems): 5) Shadow dance: a dark purple swirl of afterimage slashes around one dagger. 6) Poison knives: a knife dripping green venom splitting into three. 7) Great shaman rite: a ring of five coloured cloth strips and bells spinning around a bright centre. 8) Soul fire storm: a vortex of many blue spirit flames.` })
jobs.push({ id: 'H40', group: 'raid', save: 'haebi-pack-v1-H40.png', title: '단검·주술 투사체·이펙트', refs: ['/realm/raid/arrow.png', '/realm/raid/sword-wave.png', '/realm/raid/talisman.png'],
  now: '없음', use: '전장에 날아가는 비도·혼불 · 방울 파동 고리',
  prompt: `Create one transparent PNG, 1536x1024, three separate game effect sprites with wide empty space between them, seen from above at a slight 3/4 angle, matching the attached sprites in rendering and scale feel. ${RAID_STYLE}\n1) Throwing knife pointing exactly to the RIGHT: one small leaf-shaped bronze knife with a red cord on the handle, long and thin (about 5:1), a faint motion streak behind.\n2) Soul fire orb: one round blue-white spirit flame with a short curling tail to the left, soft glow, no face.\n3) Bell pulse ring: one thin circular ripple of pale gold light seen from above, a perfect ring with small sparkles, empty transparent centre.` })
jobs.push({ id: 'H41', group: 'raid', save: 'haebi-pack-v1-H41.png', title: '열전 상점 아이콘 열둘 (영구 강화)', refs: ['/realm/raid/power-tempo.png', '/realm/raid/power-reach.png', '/realm/raid/chest.png'],
  now: '없음 · 상점이 없다', use: '판 밖 상점: 판을 할 때마다 쌓이는 기본 능력치',
  prompt: `Create one transparent PNG, 2048x1536, a 4x3 grid of twelve upgrade icons in the same set as the attached icons. One bold symbol per cell, wide margins, no cell lines. ${RAID_STYLE}\nRow 1: 1) Attack power: a clenched fist with a bronze bracer. 2) Max health: a red jade heart-shaped pendant. 3) Armour: a small bronze lamellar plate. 4) Health regeneration: a green herb sprig with a drop of water.\nRow 2: 5) Attack speed: a bronze gong struck with motion lines. 6) Move speed: a straw sandal with a wind swirl. 7) Pickup range: a jade magnet-like curved charm pulling small green shards. 8) Experience gain: a glowing green-gold jade bead.\nRow 3: 9) Revival: a white feather on a red cord. 10) Reroll: two bronze dice made of bone. 11) Gold gain: a tied pouch of bronze coins. 12) Luck: a four-leaf clover carved from jade.` })
jobs.push({ id: 'H42', group: 'raid', save: 'haebi-pack-v1-H42.png', title: '스테이지 휘장 셋 (숲 산길·여울·목책)', refs: ['/realm/raid/cyclone.png', '/realm/raid/chest.png'],
  now: '없음', use: '스테이지를 깨면 받는 휘장 · 출전 고르는 카드에 붙음',
  prompt: `Create one transparent PNG, 1536x512, three round bronze campaign medals side by side with wide empty space, each a different design but the same size and the same hand-painted bronze-and-enamel style as the attached icons. ${RAID_STYLE}\n1) Forest pass: a bronze disc with a pine tree and a crossed axe, green enamel, a short red silk ribbon below.\n2) River ford: a bronze disc with three wave lines and a spear, blue enamel, red silk ribbon.\n3) Palisade: a bronze disc with sharpened wooden stakes and a broken gate, dark red enamel, red silk ribbon.` })
const RESULT = 'Generate one image: a wide 16:9 painted background for a result screen of an original early-Korean historical fantasy action game, in the same painterly style and palette as the attached forest battlefield. The centre 60% must stay calm and slightly darker because a result panel is placed on top. No people in the foreground, no text, no letters, no logo, no watermark, no Japanese motifs, no red sun discs or sun rays. Scene: '
jobs.push({ id: 'H43', group: 'raid', save: 'haebi-pack-v1-H43.png', title: '열전 승리 배경', refs: ['/realm/raid/forest.webp'],
  now: '없음 · 결과 창이 민무늬', use: '스테이지를 깼을 때 결과 창 뒤', prompt: RESULT + 'dawn breaks over a quiet mountain forest pass after battle; warm golden light through tall pines, a torn bandit banner lying on the ground, smoke thinning, birds rising into a clear sky.' })
jobs.push({ id: 'H44', group: 'raid', save: 'haebi-pack-v1-H44.png', title: '열전 패배 배경', refs: ['/realm/raid/forest.webp'],
  now: '없음 · 결과 창이 민무늬', use: '쓰러졌을 때 결과 창 뒤', prompt: RESULT + 'dusk in the same forest pass; cold blue shadows, rain starting to fall, a dropped weapon half buried in mud, distant bandit torches moving away between the trees.' })

// 열전 스테이지마다 다른 두목 · 넷째·다섯째 스테이지 (11-16 「다이센카도 적들 다양하니까 · 스테이지를 다른 걸 줘서 적도 다르게」)
//   지금은 세 스테이지 두목이 모두 산적 대두목 한 그림 · 4 설원 고개 · 5 불타는 산성 은 그림이 오면 코드로 연다
const BOSS = (who, poses) => BANDIT(who, poses).replace('Input 1 is the existing common bandit for scale and outfit family; Input 2 is the bandit warlord of the same army.', 'Input 1 is a common bandit for scale; Input 2 is the existing final boss. This is a DIFFERENT boss of equal size and importance, clearly bigger and more ornate than common enemies.')
const BOSS_POSES = (weapon) => `1. Ready idle, ${weapon} held menacingly.\n2. Walking heavily, left leg forward.\n3. Walking heavily, right leg forward.\n4. Walking, mid-stride.\n5. Winding up a huge attack, ${weapon} pulled back.\n6. The huge attack striking to the right, the whole ${weapon} inside the cell.\n7. Roaring, one arm raised, summoning his followers.\n8. Hit recoil, staggering but still standing.\n9. Defeated, fallen to one knee then down, head to the right, ${weapon} beside him.`
const BOSS_REFS = ['/realm/anim-px/bandit-club.png', '/realm/anim-px/bandit-warlord.png']
jobs.push({ id: 'H45', group: 'raid', save: 'haebi-pack-v1-H45.png', title: '여울 두목 · 강도적 물두령 (3×3)', refs: BOSS_REFS, now: '여울도 숲 산적 대두목을 그대로 씀',
  use: '여울 스테이지 두목 · bake-raid-enemies.py 로 3×3 → anim-px/boss-ford.png',
  prompt: BOSS('a RIVER RAIDER CHIEFTAIN who rules the river ford: a tall broad adult man with a weathered face and a braided beard, river-reed rain cape over dark blue hemp and fish-skin leather armour, wet hair tied with blue cord, a necklace of river shells and fish hooks, wielding a long iron harpoon-trident with a rope coiled on the shaft.', BOSS_POSES('harpoon-trident')) })
jobs.push({ id: 'H46', group: 'raid', save: 'haebi-pack-v1-H46.png', title: '목책 두목 · 배신한 성장 (3×3)', refs: BOSS_REFS, now: '목책도 숲 산적 대두목을 그대로 씀',
  use: '목책 스테이지 두목 · anim-px/boss-palisade.png',
  prompt: BOSS('a RENEGADE FORT COMMANDER who seized the palisade: a heavily built adult man in dark bronze-and-iron lamellar armour laced with faded red cord, a crested iron helmet with a cheek guard, a torn dark red war cloak, a long-handled iron glaive (a curved blade on a long pole), a small bronze command bell at the belt. Early Korean, not Chinese imperial, not samurai.', BOSS_POSES('glaive')) })
const STAGE_BG = 'Generate one image: a wide top-down 3/4 view battlefield ground for an action game, painted in EXACTLY the same style, camera angle, scale and lighting as the attached forest battlefield (it tiles as the arena floor under small characters). Open walkable ground across most of the image, obstacles only near the edges, no characters, no text, no logo, no watermark, no Japanese motifs, no red sun discs. Original early-Korean historical fantasy. Scene: '
jobs.push({ id: 'H47', group: 'raid', save: 'haebi-pack-v1-H47.png', title: '4 스테이지 배경 · 설원 고개', refs: ['/realm/raid/forest.webp', '/realm/raid/ford.webp'], now: '없음 · 스테이지가 셋뿐',
  use: '4 스테이지 바닥 · raid-stage-art.py 로 forest.webp 크기 → raid/snow.webp', prompt: STAGE_BG + 'a high mountain pass in deep winter: trampled snow and frozen dirt paths, scattered dark pines and snowy boulders at the edges, a broken wooden shrine pole wrapped in faded cloth strips, icy patches, cold blue light.' })
jobs.push({ id: 'H48', group: 'raid', save: 'haebi-pack-v1-H48.png', title: '5 스테이지 배경 · 불타는 산성', refs: ['/realm/raid/forest.webp', '/realm/raid/palisade.webp'], now: '없음',
  use: '5 스테이지 바닥 · raid/fortress.webp', prompt: STAGE_BG + 'inside a burning mountain fortress at night: packed earth courtyard, collapsed stone wall sections and charred wooden stakes at the edges, scattered embers and small fires near the borders only, orange firelight against deep blue night shadows.' })
jobs.push({ id: 'H49', group: 'raid', save: 'haebi-pack-v1-H49.png', title: '4·5 스테이지 휘장 둘', refs: ['/realm/raid/emblem-forest.png', '/realm/raid/emblem-ford.png', '/realm/raid/emblem-palisade.png'], now: '없음',
  use: '깨면 받는 휘장 · emblem-snow.png · emblem-fortress.png', prompt: `Create one transparent PNG, 1024x512, two round bronze campaign medals side by side with wide empty space, the same size and the same hand-painted bronze-and-enamel style as the attached three medals. ${RAID_STYLE}\n1) Snow pass: a bronze disc with a snowy mountain peak and a crossed spear, pale blue-white enamel, red silk ribbon.\n2) Burning fortress: a bronze disc with a stone fortress gate and rising flames, deep orange enamel, red silk ribbon.` })
const BEAST = (who, poses) => `Use case: production game asset, not a presentation.\nCreate ONE NEW transparent PNG combat sprite sheet of ${who} Input 1 is a common bandit for scale; Input 2 is a mountain dog of the same game. Match them exactly in pixel-art rendering, outline and palette range.\n\nArt direction: clean hand-crafted pixel art for a premium Korean 2D action RPG, readable outline, restrained colour clusters, no blur. The same animal in EVERY pose. Side three-quarter view facing right. Not cute, not cartoon.\n\nLayout: square canvas, strict evenly spaced 3-column by 3-row grid, nine full-body sprites at IDENTICAL SCALE on genuine transparency, each with at least 10 percent empty margin; nothing touches a cell edge. In the running poses keep the body at the same horizontal spot of the cell. No cell outlines, no text.\n\nPose order left to right, top to bottom:\n${poses}\n\nNo scenery, no shadow plane, no watermark, no captions.`
const ENEMY_REFS = ['/realm/anim-px/bandit-club.png', '/realm/anim-px/bandit-dog.png']
jobs.push({ id: 'H50', group: 'raid', save: 'haebi-pack-v1-H50.png', title: '설원 적 · 백두산 범 (덮침 · 3×3)', refs: ENEMY_REFS, now: '없음',
  use: '4 스테이지 · 멈칫 뒤 길게 덮침 · anim-px/beast-tiger.png', prompt: BEAST('a MOUNTAIN TIGER, a huge Amur tiger with a thick winter coat, the body about as long as a man is tall.', '1. Standing, low growl.\n2. Running, front legs reaching forward.\n3. Running, legs gathered.\n4. Running, mid-stride.\n5. Crouched low, tail lashing, about to pounce.\n6. Long leaping pounce to the right, claws out.\n7. Landing, swiping a paw.\n8. Hit recoil, flinching back.\n9. Defeated, lying on its side, head to the right.') })
jobs.push({ id: 'H51', group: 'raid', save: 'haebi-pack-v1-H51.png', title: '설원 적 · 큰 반달곰 (아주 단단함 · 3×3)', refs: ENEMY_REFS, now: '없음',
  use: '4 스테이지 · 느리고 단단함 · 일어서서 내려침 · anim-px/beast-bear.png', prompt: BEAST('a huge ASIATIC BLACK BEAR with the white crescent mark on its chest, shaggy frost-tipped fur, bigger than a man when it stands.', '1. Standing on four legs, sniffing.\n2. Lumbering run, front legs forward.\n3. Lumbering run, legs gathered.\n4. Lumbering run, mid-stride.\n5. Rearing up on hind legs, roaring.\n6. Smashing both front paws down to the right.\n7. Swiping one paw to the right.\n8. Hit recoil, shaking its head.\n9. Defeated, lying on its side, head to the right.') })
jobs.push({ id: 'H52', group: 'raid', save: 'haebi-pack-v1-H52.png', title: '설원 적 · 맥족 투창 사냥꾼 (3×3)', refs: BOSS_REFS, now: '없음',
  use: '4 스테이지 · 멀리서 창을 던짐(붉은 줄 예고) · anim-px/snow-hunter.png', prompt: BANDIT('a MAEK MOUNTAIN HUNTER of the snowy north: a lean adult man in layered fur and deerskin, a fur hood with a wolf-tail trim, snow goggles of thin carved bone slits pushed up on the forehead, a bundle of three short throwing spears on his back and one in hand.', '1. Ready idle, spear held at the shoulder.\n2. Running, left leg forward.\n3. Running, right leg forward.\n4. Running, mid-stride.\n5. Leaning back, aiming the spear, free arm pointing right.\n6. Throwing the spear to the right, arm fully extended (the spear just leaving the hand, inside the cell).\n7. Drawing another spear from the back.\n8. Hit recoil, leaning back.\n9. Defeated, lying horizontally, head to the right, spears beside him.') })
jobs.push({ id: 'H53', group: 'raid', save: 'haebi-pack-v1-H53.png', title: '산성 적 · 횃불 방화꾼 (불바닥을 깔며 달림 · 3×3)', refs: BOSS_REFS, now: '없음',
  use: '5 스테이지 · 지나간 자리에 불바닥 · 다가와 터지는 기름 단지 · anim-px/torch-raider.png', prompt: BANDIT('a TORCH RAIDER arsonist: a wiry adult man with soot-streaked skin and a scorched leather apron over dark hemp, a cloth wrapped around the lower face pulled DOWN to the neck (face visible), a burning torch in one hand and a clay oil jar with a burning rag in the other.', '1. Ready idle, torch raised.\n2. Running, left leg forward, torch trailing flame.\n3. Running, right leg forward.\n4. Running, mid-stride.\n5. Lifting the oil jar overhead.\n6. Hurling the oil jar to the right (jar leaving the hand, inside the cell).\n7. Swinging the torch to the right in a fiery arc.\n8. Hit recoil, leaning back.\n9. Defeated, lying horizontally, head to the right, torch beside him.') })

// 스팀 캡슐: tools/store-pack.mjs 의 카드 그대로 (로고는 AI 가 그리지 않고 tools/store-capsule.mjs 가 얹는다)
for (const c of STORE) jobs.push({ id: 'ST-' + c.key, group: 'steam', save: c.save, title: c.title, refs: c.refs.map(pub),
  now: '11-11 합성본은 게임 화면 캡처를 바탕으로 쓴 임시 (HUD 숫자·체력바가 찍힘)',
  use: '받으면 Downloads 에 두고 node tools/store-capsule.mjs → 로고를 얹어 규격 크기로', prompt: c.prompt })

// bake-pack 의 문안 상수를 그대로 읽는다 (bake-pack 은 돌리면 파일을 쓰므로 import 하지 않는다)
const bakeSrc = readFileSync('tools/bake-pack.mjs', 'utf8')
const constText = (name) => {
  const m = bakeSrc.match(new RegExp(`const ${name} = '((?:[^'\\\\]|\\\\.)*)'`))
  if (!m) throw new Error(`bake-pack.mjs 에서 ${name} 를 못 찾음`)
  return m[1].replace(/\\'/g, "'")
}

// 15세 판 1차 각성 (EDIT15 · 지금 그림을 붙이고 비침만 고침 · 받으면 assets_15 에만)
for (const id of ['w-50-siljik-mulga'])
  if (!existsSync(`assets_15/realm/awaken-hd/${id}.jpg`)) jobs.push({ id: 'R15-' + id, group: 'r15', save: `gpt15_aw1-${id}.png`,
    title: `${id} · 1차 15세 판 (지금 그림 고치기)`, refs: [`/realm/awaken-hd/${id}.jpg`],
    now: '스팀 15세 판이 이 한 명만 없음 (나머지는 assets_15 에 있음)', use: '받으면 assets_15/realm/awaken-hd 에만 · 게임엔 아직 안 넣음', prompt: constText('EDIT15') })

// 고화질 초상이 없는 열둘 (10-21 격자에서 자른 320px 만 있음) · 비기 컷인의 참고 그림으로도 먼저 필요
const BUST_HEAD = constText('BUST_HEAD')
const LOWRES = ['g-60-golbeol-golgae', 'g-61-apdok-ap', 'g-62-gammun-gamnamu', 'g-63-chopal-yeoul', 'g-64-michuhol-sogeumkkun', 'g-65-sangdang-soemangchi', 'g-66-geonma-malbalgup', 'g-67-gosaburi-buri', 'g-68-mujin-bitgoeul', 'g-69-goryong-yong', 'g-70-siljik-pado', 'w-81-byeokjin-byeolbit']
for (const id of LOWRES)
  if (!existsSync(`public/realm/bust-hd/${id}.jpg`)) jobs.push({ id: 'BUST-' + id, group: 'bust', save: `gpt_bust-${id}.png`, title: `${id} · 고화질 초상`,
    refs: [`/realm/bust/${id}.jpg`], now: '320px 조각을 늘려 씀 · 큰 화면에서 흐림', use: '받으면 tools/sprite-kit/install-bust.sh 로 bust-hd 900 · bust 320',
    prompt: BUST_HEAD + ' Redraw the attached small low-resolution portrait as a crisp high-resolution illustration of the SAME person: same face, age, hairstyle, skin tone, expression, outfit, colors, ornaments and weapon if visible. Do not redesign anything; only add clean detail. Avoid any text or watermark.' })

// 짓는 중인 장 표지 둘 (지금 사건 그림을 빌림 · 0장 표지를 IMAGE 1 로 같은 화풍 · ART-QUEUE 165~166행)
const COVER = 'Generate one image: a wide 16:9 cinematic cover painting for a chapter of an original early-Korean historical fantasy strategy game. IMAGE 1 is our existing chapter cover: use EXACTLY the same painting style, palette and level of detail. Keep the bottom 25% darker and calmer (the chapter title is placed there by the game). No text, no letters, no logo, no watermark, no Japanese motifs, no red sun discs or sun rays, no Chinese imperial dragons or stone lions. Scene: '
jobs.push({ id: 'COV-samseonghyeol', group: 'cover', save: 'cover-samseonghyeol.png', title: '7장 삼성혈 표지', refs: ['/realm/keyart/tutorial.jpg'],
  now: '사건 그림 event-whale-hunt 를 빌림', use: '1536×864 → public/realm/keyart/samseonghyeol.jpg · campaign.ts 7장 art',
  prompt: COVER + 'on the volcanic island of Tamna at dawn, three divine men in plain hemp clothes and fur rise out of three holes in the earth at the foot of Mount Halla, while on the black-rock shore below a wooden chest washed in by the sea stands open: three young women in sea-blue garments step out with a foal, a calf and baskets of seeds. Mist, wild grass, basalt stones, the mountain huge behind them.' })
jobs.push({ id: 'COV-namusaja', group: 'cover', save: 'cover-namusaja.png', title: '8장 나무 사자 표지', refs: ['/realm/keyart/tutorial.jpg'],
  now: '사건 그림 event-eight-harbours 를 빌림', use: '1536×864 → public/realm/keyart/namusaja.jpg · campaign.ts 8장 art',
  prompt: COVER + 'Silla war boats approach the steep sea cliffs of an island kingdom under a grey storm sky. On each bow stands a huge carved WOODEN lion beast, painted with red and black lacquer, a wild wooden mane and open jaws; it looks crude, folk-carved and menacing, not a Chinese stone guardian lion. A stern Silla general in lamellar armor stands beside it pointing at the island. On the cliff top, frightened islanders with spears and torches step back.' })

// 비기 컷인 전신 (haebi-repair-jobs 의 bodyBase 틀 · 210명 전투 원장의 무기·쥔 모양) · 이야기 장 장수 먼저
const STORY = 'g-94-golpo-maenun g-16-goguryeo-gaema-commander g-92-goguryeo-mari g-06-strategist g-91-biryu-songyang g-67-buyeo-daeso w-96-haengin-neoul g-73-baekje-eureum w-90-saro-danbi g-80-saro-guryema g-82-saro-hojin w-91-saro-mulsae w-92-saro-dallae g-87-wae-chief g-96-garak-suro l-L3-heo-hwangok g-107-garak-musoe w-102-garak-dana g-101-garak-adogan g-102-garak-yeodogan g-103-garak-pidogan g-104-garak-odogan g-105-garak-yusugan w-99-garak-yucheongan w-100-garak-sincheongan g-106-garak-ocheongan w-101-garak-singwigan g-97-tahae w-103-tahae-neoul g-95-goguryeo-daemusin g-99-goguryeo-maro g-100-buyeo-old-daeso g-10-buyeo-horse-lord w-104-buyeo-darae g-28-goguryeo-damul'.split(' ')
const ACT = {
  bow: 'A planted archer stance toward screen right: front knee bent, rear leg extended, torso upright, drawing the existing bow to full draw at chest height. Show the complete bow with both limbs, one taut string attached at both tips, one nocked arrow, the draw hand beside the jaw and the bow arm straight.',
  spear: 'A planted low forward lunge with a two-handed thrust toward upper-right, the whole shaft and spearhead inside the frame.',
  sword: 'A forward step into a descending diagonal cut toward the right, the free arm balancing behind.',
  dagger: 'A low side lunge with a short precise outward knife strike, the free hand open for balance.',
}
const actFor = (weapon, hold) =>
  /staff|bells|scepter|rod/i.test(hold) ? 'A firm ritual advancing step, raising the existing staff diagonally while the free palm opens toward the right. Keep the entire staff intact; only small resonance accents.'
  : /oar|paddle/i.test(hold) ? 'A broad two-handed rowing-style sweep toward lower-right, wide braced stance, the whole paddle including its flat blade visible.'
  : /hammer|mallet|maul/i.test(hold) ? 'A two-handed descending hammer strike toward lower-right, both elbows clearly visible and the entire solid hammer inside the canvas.'
  : /axe/i.test(hold) ? 'A compact two-handed diagonal axe strike toward upper-right, feet planted and blade and handle butt fully inside.'
  : /club/i.test(hold) ? 'A powerful horizontal two-handed club swing toward right from a wide grounded stance.'
  : /whip|sling/i.test(hold) ? 'A wide stance, the free arm forward, the existing whip or sling raised in a ready arc above the shoulder toward the right, the whole cord visible and not tangled.'
  : ACT[weapon] ?? 'A controlled forward combat step and short strike with the existing implement toward the right. Preserve its exact construction.'
const roster = JSON.parse(readFileSync('tools/sprite-kit/nonawakened-20261113/queue.json', 'utf8'))
const rank = (id) => (STORY.includes(id) ? STORY.indexOf(id) : 999)
const skill = roster.filter((r) => r.bust && !existsSync(`public/realm/skill-body/${r.bust}.jpg`)).sort((a, b) => rank(a.bust) - rank(b.bust))
for (const r of skill) {
  const hd = existsSync(`public/realm/bust-hd/${r.bust}.jpg`)
  const hold = (r.hold || `the weapon and gear described here: ${r.desc.replace(/ from IMAGE \d/g, '')}`).replace(/,? ?held the same way in (every frame|all 8 frames)/gi, '')
  jobs.push({ id: 'SB-' + r.bust, group: 'skill', save: `skillbody_${r.bust}.png`,
    title: `${r.bust} · 비기 전신${STORY.includes(r.bust) ? ' · 이야기 장' : ''}${hd ? '' : ' · 고화질 초상 먼저'}`,
    refs: [`/realm/${hd ? 'bust-hd' : 'bust'}/${r.bust}.jpg`], now: '비기 쓸 때 가슴 위 초상으로 대신 나옴',
    use: '받으면 tools/skillbody-manual-intake.py → public/realm/skill-body · skill-body.ts 등록',
    prompt: bodyBase + actFor(r.weapon, hold) + '\nWEAPON IDENTITY from the existing base combat asset: ' + hold + '\nUse ONLY the attached base portrait for face and costume. Small accents near the weapon, not an awakening aura.' })
}
// 11-17 형 반려 — 비각성 비기 전신 다시 (지금 그림을 IMAGE 2 로 붙여 무엇이 틀렸나 말한다 · 저장 _r2)
const HAND = 'HANDS: every hand has exactly one thumb and four fingers wrapped naturally around the grip; knuckles, wrist and forearm read clearly. '
const SB_FIX = {
  'g-06-strategist': HAND + 'The previous version (IMAGE 2) had broken fingers on the hand holding the sword — fix the sword hand.',
  'g-12-silla-youth': HAND + 'The previous version (IMAGE 2) had broken fingers on the hand holding the sword — fix the sword hand.',
  'g-07-drunk-warrior': HAND + 'The previous version (IMAGE 2) had a wrong, twisted arm stretched backward — both arms must be anatomically correct, elbows bending the natural way, shoulders connected.',
  'g-18-daegaya-king': HAND + 'The previous version (IMAGE 2) had a wrong, twisted arm stretched backward — both arms must be anatomically correct, elbows bending the natural way, shoulders connected.',
  'g-23-sangdang-soedal': HAND + 'The previous version (IMAGE 2) had a wrong, twisted arm stretched backward — both arms must be anatomically correct, elbows bending the natural way, shoulders connected.',
  'g-29-yeonna-myeongsol': HAND + 'The previous version (IMAGE 2) had a wrong, twisted arm stretched backward — both arms must be anatomically correct, elbows bending the natural way, shoulders connected.',
  'g-22-ungcheon-gomnae': 'The previous version (IMAGE 2) drew a blade that does not read as a sword. Draw a clear long straight single-edged iron sword (hwandudaedo style ring-pommel sword): narrow straight blade with a visible edge and tip, a short guard, a wrapped grip and a ring pommel, held firmly.',
  'g-37-eumjeup-jeup': 'REDRAW FROM SCRATCH: the previous version (IMAGE 2) looked monstrous and held a rice sheaf like a weapon. Draw him as a believable adult human with normal proportions and the same friendly round face as the portrait, as a SHAMAN-STYLE RITUAL FIGHTER: he shakes a ritual gourd rattle (a dried calabash on a short wooden handle with small bronze bells and tassels, used like a shaman spirit bell) toward the right, the other palm open, soft golden grain-spirit motes around the rattle; a small rice-sheaf charm hangs from his belt (not held). ' + HAND,
  'g-26-gampyeong-gaetbeol': 'The previous version (IMAGE 2) had the back leg\'s ankle twisted the wrong way. Both legs anatomically correct: knees and ankles bend naturally, both feet point in believable directions and touch the ground convincingly.',
}
// 11-17 형 비각성 비기 전신 검수 반려 42 + 위 9 — 옛 틀(bodyBase)의 뿌리 셋을 고친 v2 로 다시:
//   ① 「clear large shapes · not a detailed painting」이 그림체를 초상과 다르게 · 여인을 어리게 만들었다 → 초상 그림체·나이를 잠근다 (ages.ts FACE_AGE)
//   ② 「the free arm balancing behind」가 뒤로 뻗은 팔을 망가뜨렸다 → 빈손은 몸 앞(손바닥 펴서 앞으로)이나 무기 위로만
//   ③ 손이 무기를 감싸는 모양을 못 그렸다 → 쥔 손은 옆에서 본 주먹 하나, 손가락 넷이 손잡이를 감싼다
//   자세는 액션 RPG 각성 컷인처럼 감탄할 만하게 — 무기마다 한 벌 (낮은 카메라 · 대각선 · 무기 궤적 · 옷·머리 흩날림)
const AGES = (() => { const s = readFileSync('src/realm/data/ages.ts', 'utf8'); const m = {}; for (const [, id, age] of s.matchAll(/'([glw]-[^']+)': \{ age: (\d+)/g)) m[id] ??= Number(age); return m })()
const POSE_V2 = {
  bow: 'POSE: a leaping backward archer shot — airborne for a heartbeat, body angled toward the viewer, drawing the bow to full draw toward the upper right; one knee raised, hair and sash whipping; the arrow tip glowing. Both bow limbs and one taut string visible, draw hand at the jaw.',
  spear: 'POSE: a spiralling spear lunge — the body coiled low, one leg deep forward, the spear driven diagonally toward the upper right with a bright spiral trail along the shaft; both hands on the shaft, the rear hand near the butt, the front hand mid-shaft.',
  sword: 'POSE: a rising crescent slash — low crouch springing upward, the sword carried in BOTH hands through a bright crescent arc that sweeps from lower left to upper right, coat and hair flaring; the blade fully visible at the end of the arc.',
  dagger: 'POSE: a low dash strike — body almost parallel to the ground, dashing toward the right, the dagger in the leading hand pointed forward in a short bright streak, the other hand flat on the ground for balance in FRONT of the body, afterimage smear behind.',
  axe: 'POSE: an overhead cleave — leaping, the axe raised high with BOTH hands on the haft, about to smash down toward the lower right, cracks and dust exploding from the impact point below; torso twisted toward the viewer.',
  magic: 'POSE: a summoning stance — one foot forward, the ritual implement thrust toward the upper right in one hand, the other palm open in FRONT of the chest, a large circular spirit glyph of light blooming behind the implement, sleeves and ribbons lifting upward.',
}
const KIT_OF = (w) => ({ bow: 'bow', spear: 'spear', trident: 'spear', glaive: 'spear', sword: 'sword', greatsword: 'sword', dagger: 'dagger', sickle: 'dagger', fists: 'dagger', whip: 'dagger', staff: 'magic', scepter: 'magic', axe: 'axe', hammer: 'axe', club: 'axe', heavy: 'axe', oar: 'axe', hoe: 'axe' })[String(w)] ?? 'sword'
const AUDITW = (() => { try { const d = JSON.parse(readFileSync('tools/sprite-kit/weapon-audit-20261116.json', 'utf8')); return Object.fromEntries((Array.isArray(d) ? d : d.rows).filter((r) => r.portrait).map((r) => [r.portrait, r])) } catch { return {} } })()
const bodyV2 = (id, weaponText, kit) => {
  const age = AGES[id], woman = id.startsWith('w-') || id.startsWith('l-')
  return `Create ONE full-body ultimate-skill cut-in illustration for an original Korean historical-fantasy game, in the spectacular style of an action-RPG awakening cut-in.
STYLE LOCK (most important): paint it in EXACTLY the same art style as IMAGE 1, the character's portrait — same rendering, same brushwork, same skin and face shading, same level of detail and lighting — as if the same artist painted both. Not simplified, not flat, not anime, not chibi.
AGE LOCK: this ${woman ? 'woman' : 'man'} is ${age ?? 'the same age as in IMAGE 1'}${age ? ' years old' : ''}: keep the exact adult face from IMAGE 1 — same eye size, nose, jaw and cheek proportions${woman ? '; do NOT make her look younger, no childlike face, no enlarged eyes' : ''}. Adult body proportions, head about 1/7 of the height.
${POSE_V2[kit] ?? POSE_V2.sword}
CAMERA: slightly low angle, dynamic diagonal composition, mild foreshortening toward the viewer, motion lines and energy only around the weapon path.
ANATOMY: exactly two arms and two legs, every joint bending the natural way. Each hand holding something is drawn as a clear fist with one thumb and four fingers wrapped around the grip. A free hand is never stretched behind the back: keep it in front of the body, open palm forward or on the weapon.
WEAPON: ${weaponText}. Complete, solid, the same weapon as the portrait and the battle sprite.
COSTUME: exactly the outfit of IMAGE 1 (non-awakened form), extended naturally below; Korean early-Three-Kingdoms identity, no Chinese imperial or wuxia redesign, no nudity.
FORMAT: portrait 2:3 (1024x1536), one full figure on a flat dark navy #111827 background, facing and attacking toward screen RIGHT, everything (hair, weapon, feet, effects) inside with 8% margin. No text, logo or frame.`
}
const V2_REDO = {
  hand: ['g-40-anya-adan', 'g-68-baekje-onnuri', 'g-96-garak-suro', 'g-102-garak-yeodogan', 'g-104-garak-odogan', 'w-11-assassin', 'w-18-jinhan-salt-widow', 'w-32-golbeol-budeul', 'w-53-hwanna-gabi', 'w-70-bukokjeo-mulbeom', 'w-72-eumjeup-beol', 'w-97-goguryeo-mir', 'w-102-garak-dana', 'w-103-tahae-neoul'],
  arm: ['g-53-baekje-haeru', 'g-73-baekje-eureum', 'w-04-gaya-swordswoman', 'w-05-baekje-queen'],
  style: ['l-L3-heo-hwangok', 'w-02-goguryeo-lady', 'w-06-buyeo-huntress', 'w-12-court-dancer', 'w-14-feast-spy', 'w-21-baekje-court-dancer', 'w-25-bihwa-priestess', 'w-31-dabeol-dalbit', 'w-34-chopal-deulme', 'w-36-baekje-maena', 'w-37-michuhol-gaennae', 'w-40-mujin-munui', 'w-41-hwanna-beodeul', 'w-42-gwanna-soenun', 'w-46-geonma-maru', 'w-55-guga-nuri', 'w-56-dongokjeo-sogeum', 'w-66-saro-noeul', 'w-71-yeonna-neoul', 'w-81-byeokjin-byeolbit', 'w-83-gyeonji-beodeul', 'w-96-haengin-neoul', 'w-101-garak-singwigan'],
}
const V2_WHY = { hand: '무기 쥔 손이 틀림', arm: '뒤로 뻗은 팔이 틀림', style: '인물 그림체가 초상과 달라짐(여인이 어려짐)' }
const V2_TEST = ['w-36-baekje-maena', 'g-53-baekje-haeru']   // 먼저 두 장으로 새 틀 시험 (여인 그림체 · 사내 뒤 팔)
const v2Jobs = []
for (const [why, ids] of Object.entries(V2_REDO)) for (const id of ids) v2Jobs.push([id, V2_WHY[why]])
for (const id of Object.keys(SB_FIX)) v2Jobs.push([id, '형 11-17 반려(앞 줄)'])
for (const [id, why] of v2Jobs) {
  const r = roster.find((x) => x.bust === id), a = AUDITW[id]
  const weaponText = id === 'g-37-eumjeup-jeup' ? 'a ritual gourd rattle (dried calabash on a short wooden handle with small bronze bells and tassels), shaken like a shaman spirit bell; a small rice-sheaf charm hangs at the belt'
    : a?.artWeapon ?? (r ? (r.hold || r.desc).replace(/ from IMAGE \d/g, '').replace(/,? ?held the same way in (every frame|all 8 frames)/gi, '') : 'the weapon in the portrait')
  const kit = id === 'g-37-eumjeup-jeup' ? 'magic' : a?.fixedKit ?? a?.currentKit ?? KIT_OF(r?.weapon)
  const extra = SB_FIX[id] ? '\nALSO FIX: ' + SB_FIX[id] : ''
  jobs.push({ id: `SB-${id}-v2`, group: V2_TEST.includes(id) ? 'skilltest' : 'skill', save: `skillbody_${id}_v2.png`, title: `${id} · 비기 전신 새 틀 v2 (${why})${V2_TEST.includes(id) ? ' · ★ 시험 먼저' : ''}`,
    refs: [`/realm/bust-hd/${id}.jpg`, `/realm/skill-body/${id}.jpg`], now: `형 11-17 반려: ${why}`,
    use: '받으면 검수(손가락·팔·그림체·나이) → public/realm/skill-body/<id>.jpg 갈아 끼움 (옛 것 retired)',
    prompt: bodyV2(id, weaponText, kit) + '\nIMAGE 2 is the rejected previous cut-in: do NOT copy its pose, style or mistakes.' + extra })
}
for (const [id, fix] of Object.entries(SB_FIX)) if (false) {
  const r = roster.find((x) => x.bust === id)
  const hold = r ? (r.hold || `the weapon and gear described here: ${r.desc.replace(/ from IMAGE \d/g, '')}`).replace(/,? ?held the same way in (every frame|all 8 frames)/gi, '') : 'the weapon in the portrait'
  jobs.push({ id: 'SB-' + id + '-r2', group: 'skill', save: `skillbody_${id}_r2.png`, title: `${id} · 비기 전신 다시 (형 반려)`,
    refs: [`/realm/bust-hd/${id}.jpg`, `/realm/skill-body/${id}.jpg`], now: '형 11-17 반려: ' + fix.split('—')[0].slice(0, 60),
    use: '받으면 검수 → public/realm/skill-body/<id>.jpg 갈아 끼움 (옛 것 retired)',
    prompt: 'FIX REQUEST (most important): ' + fix + '\nIMAGE 1 is the character portrait (face, costume, weapon identity). IMAGE 2 is the rejected previous skill cut-in: keep its overall pose idea, framing and painting quality but correct the problem above.\n' + bodyBase + (r ? actFor(r.weapon, hold) : '') + '\nWEAPON IDENTITY: ' + hold })
}
// 1차 각성 비기 전신 (11-16 · 코덱스가 시험 10장을 만든 틀 · Codex-aw1-skillbody-prompts-20261116.json 의 머리말 그대로)
//   각성한 장수의 컷인이 각성 옷 전신으로 뜬다 (src/realm/data/skill-body-aw1.ts) · 여인 먼저 · 기본 비기 전신이 있으면 무기·싸움결 참고로
const AW1_HEAD = `Create ONE production full-body FIRST-AWAKENING ultimate-skill cut-in illustration for an original early-Korean historical fantasy action game.
INPUT ROLES: Image 1 is the CURRENT FIRST-AWAKENING portrait, authoritative for this fictional ADULT character identity, face, eyes, hair, costume construction, colours, ornaments and opaque coverage. Image 2 is STYLE ONLY: match its bold painterly game illustration, crisp readable edges, elegant facial rendering and controlled large colour shapes. Do not copy Image 2 character, clothes, weapon or pose.%REF3% This is an action illustration, not a photograph, pixel sprite, fashion portrait or a generic magical pin-up.
Preserve the exact awakened costume motifs and secure opaque coverage from Image 1 (no see-through cloth, no nipple outline). Extend unseen lower garments into a coherent matching battle skirt or trousers and boots. Preserve the character's own physique and head proportions; normal adult anatomy and visible neck, no oversized chibi head. Do not redesign into Chinese imperial, wuxia or Japanese clothing (no obi sash, no katana, no shuriken, no mask). Keep the original Korean wrap construction, materials and palette. No nudity.
ART AND FRAMING: Portrait 2:3, 1024x1536 preferred. One full isolated figure on a perfectly uniform flat dark navy #111827 background, no gradient, vignette, scenery, ground plane, shadows, writing, symbols, border or UI. Face and action directed toward screen RIGHT. Express decisive action, balanced weight, a memorable silhouette and strong asymmetry rather than a stock standing pose. Moderate perspective, no extreme foreshortening. All hair, both arms, both hands, both feet, complete weapon shaft, blade tips and cloth tails stay inside a central 78 percent width and height composition, with navy breathing room around every extremity. Reduce the figure as needed to fit the ENTIRE weapon. No cropped prop, hidden missing limb or detached hand.
ANATOMY IS HIGH PRIORITY: exactly two arms continuously connected from shoulders through elbows and wrists to hands, exactly two legs. Every hand has exactly ONE opposable thumb plus FOUR fingers, natural palm, believable knuckles and graduated finger lengths. A grip wraps four fingers around the handle with the thumb opposing them; the handle never passes through fingers or palm. No double thumb, sixth digit, fused hand, broken wrist or disconnected arm. If a bow is used: both limbs visible, exactly one taut string attached at both tips, one nocked arrow, draw hand beside the jaw.
EFFECT BUDGET: A few sharp controlled accents immediately beside the weapon or hand, in the character's own awakening colour from Image 1. Keep effects separate from the face, hands and joints. No huge aura, floating animal companion, full-screen magic circle, exploding scenery, duplicated ghost character or second weapon.
`
const AW1_TAIL = `WEAPON LOCK: keep EXACTLY the weapon shown in Image 1 (same type, count and shape). If Image 1 shows no weapon, use the weapon of Image 3; if neither shows one, use the implement the costume suggests (staff, bells, fan) rather than inventing a sword.
SIGNATURE ACTION: invent ONE signature ultimate-skill action that fits this character's weapon and personality as read from Image 1, at the instant of impact or release. It must be clearly different from a plain standing pose${'%DIFF%'}. State of mind shows in the face: fierce, cool or radiant, never blank.`
const aw1Done = (id) => existsSync(`public/realm/skill-body/aw1/${id}.jpg`)
// 11-16 검수 반려 — 활 꼴이 틀린 셋은 같은 문안에 활 바로잡기를 붙여 _r2 로 다시 · g-84 는 초상이 닌자 옷이라 뺌 (tools/out/skillbody-aw1-review-men.json)
const AW1_SKIP = new Set(['g-84-wander-seoneul'])
const BOW_FIX = `\nBOW FIX (the previous try was rejected): draw ONE recurved bow with BOTH limbs visible and ONE taut string running continuously from the upper tip to the lower tip. The draw hand GRIPS the string with the arrow nock between its fingers, pulled back to the jaw; the bow hand wraps the grip with the arrow resting on the knuckle. The arrow is one straight unbroken shaft from the nock in the draw hand to the head beyond the bow. If the pose is not a draw, the bow is held lowered with its string clearly attached at both tips.`
const AW1_RETRY = { 'g-13-baekje-general': BOW_FIX, 'g-80-saro-guryema': BOW_FIX, 'g-95-goguryeo-daemusin': BOW_FIX }
const AW1_IDS = [...AWAKEN_ART].filter((id) => !aw1Done(id) && !AW1_SKIP.has(id))
  .sort((a, b) => (/^[wl]-/.test(a) ? 0 : 1) - (/^[wl]-/.test(b) ? 0 : 1) || a.localeCompare(b, 'en', { numeric: true }))
for (const id of AW1_IDS) {
  const base = existsSync(`public/realm/skill-body/${id}.jpg`)
  const fix = AW1_RETRY[id] ?? ''
  jobs.push({ id: 'SB1-' + id + (fix ? '-r2' : ''), group: 'skill1', save: `skillbody_aw1_${id}${fix ? '_r2' : ''}.png`, title: `${id} · 1차 각성 비기 전신${fix ? ' · 다시 (활 꼴)' : ''}`,
    refs: [`/realm/awaken-hd/${id}.jpg`, '/realm/skill-body/w-53-hwanna-gabi.jpg', ...(base ? [`/realm/skill-body/${id}.jpg`] : [])],
    now: '각성한 장수의 비기 컷인이 각성 초상(가슴 위)으로 나옴', use: '받으면 검수 → public/realm/skill-body/aw1/<id>.jpg (800×1200 · 남색 판) · src/realm/data/skill-body-aw1.ts 등록',
    prompt: AW1_HEAD.replace('%REF3%', base ? ' Image 3 is the same character BEFORE awakening in an approved skill pose: use it ONLY for weapon type and fighting style, never for costume, and make the new pose different and more powerful.' : '')
      + `\nCHARACTER: ${id}\n` + AW1_TAIL.replace('%DIFF%', base ? ' and from the pose in Image 3' : '') + fix })
}

// ── 열전 4·5 스테이지 전용 두목 (11-16 · 지금은 설원=대두목, 산성=배신한 성장을 다시 씀)
jobs.push({ id: 'H54', group: 'raid', save: 'haebi-pack-v1-H54.png', title: '설원 두목 · 맥족 설산 우두머리 (3×3)', refs: BOSS_REFS, now: '설원 고개도 숲 산적 대두목을 그대로 씀',
  use: '설원 스테이지 두목 · bake-raid-enemies.py BOSSES 에 더해 3×3 → anim-px/boss-snow.png · haebi.ts 스테이지 boss 를 snow 로',
  prompt: BOSS('a MOUNTAIN CHIEFTAIN of the snowy pass: a huge broad adult man with a frost-whitened beard and wild hair tied with leather thongs, a white snow-tiger fur mantle over dark iron-studded leather armour, fur leggings and bound boots, breath steaming, wielding a heavy two-handed iron flail (a thick iron-banded haft with a spiked iron ball on a short chain).', BOSS_POSES('iron flail')) })
jobs.push({ id: 'H55', group: 'raid', save: 'haebi-pack-v1-H55.png', title: '산성 두목 · 불의 반란 장군 (3×3)', refs: BOSS_REFS, now: '불타는 산성은 목책 성장을 다시 씀',
  use: '산성 스테이지 두목(마지막) · anim-px/boss-fortress.png · 가장 크고 화려하게',
  prompt: BOSS('the REBEL WARLORD who set the mountain fortress on fire, the final and most fearsome boss: a towering adult man in blackened iron lamellar armour with glowing ember-orange cracks, a soot-stained dark red cloak with burnt edges, a horned iron helmet with a cheek guard, smouldering embers drifting from his shoulders, wielding a huge two-handed iron war hammer whose head glows red-hot. Early Korean, not Chinese imperial, not samurai, no sun disc.', BOSS_POSES('war hammer')) })

// ── 열전 돌팔매 묶음 (11-16 형: 「돌팔매는 슬링샷 사운드 같은 거 찾으면 만들 수 있지 않을까?」 · 초팔 팔매) · 지금은 본편 투석병·징검돌·바위 아이콘을 빌려 씀
jobs.push({ id: 'H56', group: 'raid', save: 'haebi-pack-v1-H56.png', title: '돌팔매 능력 아이콘 (주 무기)', refs: ['/realm/raid/power-bow.png', '/realm/raid/power-javelin.png', '/realm/icon/unit-slingers.png'],
  now: '본편 투석병 병종 아이콘(icon/unit-slingers.png)을 빌려 씀', use: '열전 능력 칸·강화 카드 · 받으면 raid/power-sling.png · power-ui.ts icons.sling',
  prompt: `Create one transparent PNG, 1024x1024, ONE game ability icon in the same set as the attached first two icons (same size, framing, lighting and brush quality). One bold readable symbol centered with generous empty margin. ${RAID_STYLE}
Sling throw: a braided hemp rope sling whirled in a fast circle, a fist-sized grey river stone just leaving the pouch with a short pale motion arc behind it. The third attached image shows the sling only for its shape; do not draw the man.` })
jobs.push({ id: 'H57', group: 'raid', save: 'haebi-pack-v1-H57.png', title: '물수제비 능력 아이콘 (보조 · 튀는 돌)', refs: ['/realm/raid/power-knife.png', '/realm/raid/power-thunder.png', '/realm/raid/power-javelin.png'],
  now: '본편 징검돌 아이콘(icon/route-steppingstones.png)을 빌려 씀', use: '열전 능력 칸·강화 카드 · 받으면 raid/power-skip.png · power-ui.ts icons.skip',
  prompt: `Create one transparent PNG, 1024x1024, ONE game ability icon in the same set as the attached icons (same size, framing, lighting and brush quality). One bold readable symbol centered with generous empty margin. ${RAID_STYLE}
Skipping stone: one flat grey pebble bouncing along a zig-zag path of three small impact puffs, each bounce marked by a tiny burst of dust, the path rising and falling like a skipping stone, cool pale blue-grey highlights.` })
jobs.push({ id: 'H58', group: 'raid', save: 'haebi-pack-v1-H58.png', title: '돌팔매 조합 문양 둘 + 비기 「돌벼락」 문양', refs: ['/realm/raid/cyclone.png', '/realm/raid/meteor.png', '/realm/raid/shadowdance.png'],
  now: '조합은 본편 바위(fx/rock.png)·별(raid/hit.png), 비기 단추는 바위 솟음(fx/skill/wake/rock-spikes.png)을 빌려 씀', use: '받으면 raid/boulder.png · raid/daze.png · raid/stonefall.png → raid-main COMBO_ART · combat.css #skill[data-kit=sling]',
  prompt: `Create one transparent PNG, 1536x512, a 3x1 row of three combo emblems in the same set as the 3 attached emblems (same size, framing, brush, glow). One bold symbol per cell, wide margins, no cell lines. ${RAID_STYLE}
1) Rolling boulder: a huge round mossy boulder rolling forward over cracked ground, dust and small stones flying from under it. 2) Dazing stone: a small stone striking with a burst of little golden stars circling, a dizzy spiral. 3) Stone storm: a rain of many grey stones falling diagonally from a dark sky onto one circular shadow on the ground, dust bursting where they land.` })

// ── 진각성 초상이 없는 남장수 셋 (진각성 묶음 · aw2 는 1차와 확 달라야 · 활시위 자세 금지 · 눈높이 카메라)
const AW2M = (id, theme) => ({ id: 'AW2-' + id, group: 'dlc', save: `gpt_aw2-${id}.png`, title: `${id} · 진각성 초상`, refs: [`/realm/awaken-hd/${id}.jpg`, `/realm/bust-hd/${id}.jpg`],
  now: '진각성 초상이 없어 진각성 칸이 비어 있음', use: '900×900 jpg → public/realm/awaken2-hd/<id>.jpg · 작은 판 awaken2/<id>.jpg (tools/bake-intake.sh 의 gpt_aw2 길) · data/awaken2.ts TRUE_WAKE_ART 에 장수 id',
  prompt: `Generate one image: the SECOND, TRUE awakening of the same man shown in Image 1 (his first awakening; Image 2 is him before awakening). Square 1:1 portrait, waist-up to mid-thigh, eye-level camera, normal adult head size, premium Korean fantasy splash-art painting matching Image 1's rendering. Keep his face, age, ethnicity and weapon type exactly. ${theme} Do NOT use a bow-drawing pose. No text, no logo, no watermark, no Japanese motifs, no red sun discs, no gold crown, no jade, no Chinese imperial dragon robes.` + constText('STYLE_M') })
jobs.push(AW2M('g-02-goguryeo-archer-prince', 'Theme: STORM HAWK. His true awakening calls the mountain storm: a cloak of dark storm-grey hawk feathers over new deep-teal lamellar, hair loosened and streaming in the wind, faint blue-white lightning crawling along his bow limbs, bow held LOWERED at his side while his other hand opens toward the viewer, rain and wind around him.'))
jobs.push(AW2M('g-21-baekje-onnuri', 'Theme: MOONLIT TIDE. His true awakening rises from the western sea of Baekje: a long silver-grey sea-silk coat over dark navy armour edged with wave patterns, a pale moon behind him, sea spray and silver-blue water ribbons coiling around his sword arm, a falcon landing on his shoulder, hair loosened in the sea wind.'))
jobs.push(AW2M('g-31-buyeo-geumha', 'Theme: MARSH KING OF BUYEO. His true awakening draws the power of the northern marsh where his line began: a heavy cloak of dark green reeds and bronze scale plates, mist and lotus pads drifting around him, deep green and bronze palette (no gold crown), a carved bronze staff or his own weapon from Image 1 planted in still water that ripples outward.'))

// ── 진각성 묶음(DLC) 가게 그림 (스팀 DLC 칸 · 로고는 AI 가 그리지 않고 store-capsule 이 얹는다)
const DLC_REFS = ['/realm/awaken2-hd/w-58-tamna-halla.jpg', '/realm/awaken2-hd/w-97-goguryeo-mir.jpg', '/realm/awaken2-hd/l-L2-soseono.jpg', '/realm/awaken2-hd/w-95-michuhol-haebi.jpg']
const DLC_ART = 'Original early-Korean (Samhan) historical fantasy, premium painterly key art matching the attached true-awakening portraits exactly in face, costume and rendering; these are the SAME four adult heroines, each in her own true-awakening costume and colour. Opaque coverage (no see-through cloth, no nipple outline). No text, no logo, no letters, no watermark, no Japanese motifs, no red sun discs, no Chinese imperial style. '
jobs.push({ id: 'DLC-key', group: 'dlc', save: 'dlc-truewake-key.png', title: '진각성 묶음 가로 그림 (머리 캡슐·큰 캡슐·작은 캡슐)', refs: DLC_REFS, now: '없음 · DLC 가게 칸이 비어 있음',
  use: '16:9 → store-capsule 로 920×430 · 1232×706 · 462×174 (로고 「진각성」을 위 가운데에 얹음)',
  prompt: 'Create one 16:9 landscape illustration (1536x864) for the store capsule of the "True Awakening" expansion: the four heroines of the attached images stand together mid-transformation on a windswept mountain ridge at dusk, each wreathed in her own awakening colour (ocean teal, frost blue, crimson, storm violet), the energies spiralling up and meeting in the sky above them. Keep the TOP 30% as sky with no faces or weapons there (a logo goes there). All four faces clearly visible, readable at small size. ' + DLC_ART })
jobs.push({ id: 'DLC-vertical', group: 'dlc', save: 'dlc-truewake-vertical.png', title: '진각성 묶음 세로 그림 (세로 캡슐)', refs: DLC_REFS, now: '없음',
  use: '2:3 → 748×896 세로 캡슐 (로고 위)',
  prompt: '[코덱스] D:/에셋창고/dlc-truewake-key.png 도 맨 뒤에 첨부\nCreate one 2:3 portrait illustration (1024x1536): the same scene as the landscape store art attached last, recomposed tall: the four heroines stacked in depth, the front one large in the lower half, the energies rising into the top 25% which stays free for a logo. ' + DLC_ART })

// ── 진각성 비기 전신 (진각성 묶음 · 진각성기를 쓰면 컷인이 진각성 옷 전신으로 · 코드는 aw1 처럼 skill-body/aw2/<id>.jpg 로 이을 것) — 맨 뒤 · 여인 먼저
const AW2_IDS = readdirSync('public/realm/awaken2-hd').filter((f) => /^[wlg]-.*\.jpg$/.test(f)).map((f) => f.replace(/\.jpg$/, ''))
  .filter((id) => !id.includes('.') && !AW1_SKIP.has(id) && !existsSync(`public/realm/skill-body/aw2/${id}.jpg`))
  .sort((a, b) => (/^[wl]-/.test(a) ? 0 : 1) - (/^[wl]-/.test(b) ? 0 : 1) || a.localeCompare(b, 'en', { numeric: true }))
// 11-16 형: 「진각성 스킬바디는 너무 많아서 아직 만들지 말라」 → 11-16 저녁 형 「만들게 시켜도 될거같다」 로 줄에 올림
const SB2_ON = true
for (const id of SB2_ON ? AW2_IDS : []) {
  const aw1 = existsSync(`public/realm/skill-body/aw1/${id}.jpg`)
  jobs.push({ id: 'SB2-' + id, group: 'skill2', save: `skillbody_aw2_${id}.png`, title: `${id} · 진각성 비기 전신`,
    refs: [`/realm/awaken2-hd/${id}.jpg`, '/realm/skill-body/w-53-hwanna-gabi.jpg', ...(aw1 ? [`/realm/skill-body/aw1/${id}.jpg`] : [])],
    now: '진각성기를 써도 컷인이 진각성 초상(가슴 위)으로 나옴', use: '받으면 검수 → public/realm/skill-body/aw2/<id>.jpg (800×1200 · 남색 판) · 진각성 컷인에 잇기 (aw1 과 같은 틀)',
    prompt: AW1_HEAD.replaceAll('FIRST-AWAKENING', 'TRUE-AWAKENING (second awakening)').replace('%REF3%', aw1 ? ' Image 3 is the same character in her or his FIRST-awakening skill cut-in: use it ONLY for weapon type and fighting style, never for costume; the true-awakening action must be grander and clearly different.' : '')
      + `\nCHARACTER: ${id}\n` + AW1_TAIL.replace('%DIFF%', aw1 ? ' and from the pose in Image 3' : '') })
}
export const RELEASE_JOBS = jobs
