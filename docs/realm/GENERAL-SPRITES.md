# 장수 그림 — 싸움터에 서는 사령관 (형 10-30)

형 (10-30): *"전투할 때 장수 유닛도 추가해 줘. 제미나이로 가능하다면 장수마다 만들어도 될 거 같은데 이미지 전부 전달하긴 너무 헤비하니까 프롬프트 텍스트만으로 만들어도 될 듯. 대신 다른 군사 유닛들과 그림체만 비슷하도록."*
형 (10-30): *"장수가 여럿이면 장수는 사령관 대표 유닛만 두되 비기 있는 장수의 깃발만 추가"* — 싸움터에 서는 장수는 사령관 하나. 부장은 지금처럼 비기 깃발로만.

## ★ 금관 금지 (형 10-30)

형: *"근데 장수가 왜 금관 쓰고 있냐... 금관은 왕의 것이지, 장수의 것이 아니야."*

- 싸움터의 장수는 **쇠투구(깃털·술 장식) · 철갑 · 망토(또는 등 깃발)** 로만 높임을 드러낸다. 금관·금빛 왕관·불꽃 세움 장식·관 띠를 씌우지 않는다.
- 금관은 군주(isRuler)에게만, 그것도 지역에 맞을 때(신라·가야 쪽)만. 원형 여섯은 금관 없이.
- 주문 A·B 의 끝 부정어에 늘 붙인다: `No gold crown for generals (crowns only for kings): no gold crown, no flame-shaped ornaments, no tiara.`
- 군주(isRuler)는 군주가 몸소 이끄는 싸움에서 나라에 맞는 관을 써도 된다: 신라·가야는 금관, 고구려는 조우관(새 깃), 백제는 금제 관식. 일반 장수는 금관 금지 (형 10-30: "군주가 전투할 때를 대비해서 만든 거지?"). 아래 스물 표의 군주 칸은 기본 쇠투구로 적어 두었고, 금관 판을 따로 받을지는 형에게 묻는다.

## 지금 있는 것

- 띠: `public/realm/anim2/gen-<결>.png` — 병사 v2 띠와 같은 20컷 (서기 0~3 · 걷기 4~11 · 공격 12~17 · 맞음 18 · 쓰러짐 19 · 높이 160)
- 비: `src/realm/data/art.ts` `GEN_ANIM` (칸 가로세로 비 · body = 서 있는 몸 / 띠 높이)
- 고르기: `generalSprite(장수)` (순수) — 제 그림(`GEN_OWN`)이 있으면 그것 → 명궁 특성이면 활 → 여인은 창 → 남자는 통솔이 가장 높고 7 이상이면 말 탄 장수 → 무예가 가장 높으면 언월도 → 그 밖은 환두대도. 그림이 아직 없는 결은 `genArtOf` 가 가까운 결로 돌린다
- 싸움터: `battlefield.ts` 의 `.wgen.gsp` — 진 맨 뒤 땅에 발을 딛고, 머리 위에 얼굴 동그라미, 등 뒤에 깃대
  - 싸움이 열리면 걸어 들어와 칼을 한 번 치켜든다(활 장수는 한 발 쏜다)
  - 장수의 깃발이 비기·겨루기·사로잡기·북인 합엔 맞부딪기 1.2초 앞부터 세 번 칼질(활은 쏘기)
  - 사로잡히거나 쓰러진 합엔 휘청(18) → 쓰러짐(19) · 깃대가 뒤로 넘어간다 · 다음 합부터 누운 채
  - 편 빛은 병사와 같다(우리 하늘빛 · 적 붉은빛 테). 폰(손가락)에선 빛을 끄고 발밑 고리. 저사양은 quality.ts 가 filter 와 끝없는 움직임을 끈다

## 원형 여섯 (10-30 · 제미나이 u/0 · 원본 assets_src/realm/gemini/generals)

| 결 | 생김새 | 장수 수(판 168명 중) | 보기 |
|---|---|---|---|
| `g-sword` | 남 · 붉은 깃 투구 · 붉은 끈 미늘 갑옷 · 붉은 망토 · 환두대도 | 23 | 온조 · 을음 · 협보 · 혁거세 · 마려 |
| `g-bow` | 남 · 꿩깃 둘(조우관) 투구 · 푸른 끈 미늘 · 남색 망토 · 화살통 · 맥궁 | 7 | 주몽 · 오간 · 대왕 다물 · 살해 매눈 |
| `g-spear` | 남 · 검은 깃 투구 · 가야 세로 철판 갑옷 · 초록 망토 · 언월도(긴 자루 외날) | 53 | 오이 · 마리 · 대소 · 읍차 금바위 |
| `w-spear` | 여 · 금테 투구 · 붉은 끈 미늘 · 높이 묶은 머리 · 붉은 망토 · 곡옥 · 긴 창 | 65 | 소서노 · 알영 · 해비 · 견지 아라 |
| `w-bow` | 여 · 꿩깃 둘 투구 · 청록 끈 미늘 · 긴 땋은 머리 · 청록 망토 · 맥궁 | 13 | 송비 · 해달 · 삼로 단궁 |
| `mount` | 남 · 개마무사 — 쇠 미늘 말갑옷 입힌 짙은 밤색 말 · 붉은 깃 · 환두대도를 치켜듦 | 7 | 비류 · 진지렴 쇠보 · 견지 거타 · 왕 금하 |

여인이 쉰 명 넘게 `w-spear` 하나에 몰린다 — 이름난 여인부터 제 그림을 받는다(아래).

## 굽는 법 (한 결 = 대화 하나 · 그림 두 장)

1. gemini.google.com/u/0 새 대화 → `+` → **이미지 만들기** (JS 로 `.cdk-overlay-container button` 중 글이 「이미지 만들기」인 것) → 가로세로 비율 **16:9**
2. 그다음 `+` 를 다시 열어 숨은 `input[type=file]`(accept image/*)에 `assets_src/realm/gemini/generals/style-anchor.png` 를 file_upload 로 (병사 넷을 초록 바탕에 늘어놓은 그림 · 그림결 닻). 「파일 업로드」 단추는 누르지 않는다
3. 주문 A(걷기·서기 12명) 보내기 → 같은 대화에서 주문 B(공격·맞음·쓰러짐 8명) 보내기 — B 는 업로드 없이 "keep him EXACTLY" 로 이어 간다
4. 그 대화 주소로 다시 열고 그림마다 「원본 크기 이미지 다운로드」(ref 클릭 · 한 묶음에 하나) → `~/Downloads` → `assets_src/realm/gemini/generals/<결>-a.png · -b.png`
5. 본다(크기 · 몇 명 · 차례) — 제미나이는 칸 수를 잘 안 지킨다(12 대신 16, 8 대신 13~17). 몇 번째를 쓸지 골라 묶는다:
   `py -I -X utf8 tools/general-pack.py <결> a.png <A 사람 수> <걷기 8> <서기 4> b.png <B 사람 수> <공격 6> <맞음> <쓰러짐>`
   - 사람 차례는 줄 위→아래, 줄 안 왼→오른, 1부터 · 날아가는 화살 조각은 왼쪽 사람에 붙는다(그 사람을 쓰면 칸이 넓어진다)
   - 제미나이 ✦ 별표가 사람에 겹치면 묶기 전에 지운다(w-spear 쓰러짐 — `w-spear-b-fix.png`)
6. 찍힌 비를 `GEN_ANIM` 에 · 제 그림이면 `GEN_OWN[장수 id] = '<이름>'`

### 주문 A (걷기·서기) — 한 줄로 이어 붙여 보낸다

```
2D game sprite sheet, 16:9. LAYOUT (most important): 12 figures in 3 rows of 4, evenly spaced, each figure small (height about 55% of the row height) with wide empty green gaps between all of them and a clear green margin under the feet of the bottom row and around the image edges. Leave the bottom-right corner of the image empty. The <무기> and cape of each figure stay clear of his neighbours. No grid lines, no borders, no boxes. All 12 figures the same man at the same size, side view facing RIGHT, full body, feet on one baseline per row.
IMAGE 1 is a STYLE reference only (ordinary soldiers from the same game). Draw a NEW character in EXACTLY that rendering style: smooth painterly cartoon game sprite (NOT pixel art), clean dark outline, same muted earthy colours, same body proportions. Do not copy those soldiers.
CHARACTER: an ancient Korean Samhan / early Three Kingdoms period COMMANDER, about 2,000 years ago, <한 줄 생김새>. Clearly grander and more ornate than the soldiers: <투구> ; <갑옷> ; <망토> ; <무기>. Goguryeo tomb-mural and Gaya iron-armour look.
ROWS 1 and 2: 8-frame WALK CYCLE, a proud UPRIGHT commander's march (back straight, chest up, not running). Every one of the 8 frames a DIFFERENT pose: 1 right heel strikes forward, left leg straight behind; 2 weight drops onto the right leg, body lowest; 3 left knee lifts and swings forward past the right leg; 4 body rises on the right toes; 5 left heel strikes forward, right leg straight behind; 6 weight drops onto the left leg, body lowest; 7 right knee lifts and swings forward; 8 body rises on the left toes. ROW 3: 4-frame IDLE (breathing, feet planted, no stepping) with VISIBLE motion: 1 neutral; 2 inhale, chest and shoulders rise; 3 full inhale, plume and cape lift in the wind; 4 exhale, shoulders sink.
BACKGROUND: flat pure bright green #00FF00 everywhere, no shadows, no ground line, no gradient. No text, no numbers, no labels. No gold crown for generals (crowns only for kings): no gold crown, no flame-shaped ornaments, no tiara. Not a Japanese samurai (no kabuto, no katana, no do-maru, no shoulder boxes), not Chinese opera or Chinese emperor style, no ninja, no sun disc, no red circle, no rising-sun rays anywhere.
```

여인은 머리말에 "a strikingly beautiful, tall and slender young woman in her twenties with elegant adult proportions (long legs, NOT chibi, NOT stocky) … face fully visible … tasteful, fully clothed" — 이걸 빼면 땅딸막하게 나온다(w-spear 첫 판).

### 주문 B (공격 · 맞음 · 쓰러짐)

```
Good, keep him EXACTLY (<생김새 요약>, same style and colours). Now a second 2D game sprite sheet, 16:9, of the SAME general: exactly 8 figures in 4 rows of 2, each figure in the LEFT part of its half of the image, the rest of the half empty green for the <lunge | flying arrow>. Frames read left to right then the next row. Figure height about 60% of the row height, wide green gaps, nothing touching another figure or the image edge, green margin under the bottom row, bottom-right corner of the image empty. No grid lines, no borders. Side view facing RIGHT, same size in every frame.
FRAMES 1 to 6, <공격 여섯 — 칼: GUARD · WIND-UP(머리 위로) · STEP IN · SLASH(멀리 앞으로) · FOLLOW-THROUGH · RECOVER / 활: READY · NOCK · FULL DRAW · RELEASE(살이 떠남) · FOLLOW-THROUGH · LOWER>.
FRAME 7, HIT: staggering backwards, flinching, head turned away. FRAME 8, FALLEN: lying flat on his back on the ground, defeated, helmet still on, <무기> dropped beside him, cape spread under him, a long low pose.
BACKGROUND: flat pure bright green #00FF00 everywhere, no shadows, no ground line, no motion lines or effects, no blood. No text, no numbers. No gold crown. Not Japanese, not Chinese, no sun disc or sun rays.
```

## 받은 제 그림 (10-30)

- **주몽** `jm-jumong` → `gen-jumong.png` (활 · 절풍 깃털 관 · 붉은 점무늬 옷 위 미늘) — 원형보다 크게 받아 줄 수를 손으로 골랐다
- **온조** `mh-onjo` · `tut-onjo` → `gen-onjo.png` (환두대도 · 금테 쇠투구 · 남색 금실 옷 · 검은 털 망토) — 첫 판은 불꽃 금관이라 같은 대화에서 "NO crown, iron helmet" 로 다시

## 장수마다 제 그림 — 다음 스물 (이름난 차례)

생김새는 `docs/realm/cast/part-*.md` 의 「겉모습」 줄을 영어로 옮겨 `<한 줄 생김새>` 자리에 넣는다. 초상(bust)을 올리지 않는다 — 글만. 결(무기·자세)은 아래 「결」 그대로 두어 공격 컷이 같은 박자로 돈다.

| # | 장수 | id | 결 | 그림에 넣을 것 (cast 겉모습에서) |
|---|---|---|---|---|
| 1 | 주몽 | `jm-jumong` | g-bow | 깃털 꽂은 무늬 관모 · 맑고 잘생긴 스무 살 · 털 깃 두른 붉은 점무늬 옷 위 미늘 갑옷 · 맥궁 |
| 2 | 온조 | `mh-onjo` · `tut-onjo` | g-sword | 금테 두른 쇠투구와 짧은 검은 술(금관 말고) · 긴 검은 머리 · 금실 남색 옷과 미늘 어깨 · 검은 털 망토 · 고리자루 칼 |
| 3 | 혁거세 | `sr-hyeokgeose` | g-sword | 쇠투구(금줄 머리띠 말고) · 긴 머리 소년 · 흰 비단옷 보랏빛 깃 위 가벼운 미늘 · 곡옥 목걸이 |
| 4 | 소서노 | `mh-soseono` | w-spear | 쪽머리 위 가벼운 쇠투구(금관 말고) · 검은 털 두른 붉은 비단옷 위 미늘 · 위엄 있는 서른 미인 |
| 5 | 비류 | `tut-biryu` | mount | 헝클어진 상투 · 청동 머리꽂이 · 붉은 민소매 위 미늘 · 청동 팔찌 · 큰 망치(말 위) |
| 6 | 알영 | `sr-aryeong` | w-spear | 가벼운 쇠투구(금 잎 머리띠 말고) · 붉은 끈 땋은 머리 · 흰 삼베 초록 깃 위 가벼운 미늘 · 곡옥 · 어깨에 푸른 용 무늬 |
| 7 | 오이 | `jm-oi` | g-spear | 깃털 다발 꽂은 쇠 투구 · 짧은 수염 · 붉은 테 미늘 갑옷 · 긴 창 (창 결로 바꿔도 됨) |
| 8 | 마리 | `jm-mari` | g-spear | 상투 · 콧등 칼자국 · 굵은 팔에 밧줄 타래 · 창 |
| 9 | 협보 | `jm-hyeopbo` | g-sword | 검은 머리띠 상투 · 가는 콧수염 · 검은 도포 위 가죽 갑옷 · 책사라 칼은 짧게 |
| 10 | 대소 | `jm-daeso` | g-spear | 금 드리개 머리띠 · 거만한 눈 · 흰 털 깃 · 붉은 비단옷 위 미늘 |
| 11 | 을음 | `mh-eureum` | g-sword | 검은 관과 비녀 · 염소수염 · 녹색 두루마기 위 가죽 갑옷 |
| 12 | 오간 | `mh-ogan` · `tut-ogan` | g-bow | 높은 상투 · 턱수염 · 남색 옷 위 쇠 미늘 · 등에 화살통 · 맥궁 |
| 13 | 대왕 다물 | `goguryeo-ruler` | g-bow | 깃털 꽂은 쇠투구(금관 말고) · 희끗한 긴 수염 · 범 가죽 망토 · 자줏빛 비단과 미늘 |
| 14 | 왕 금하 | `buyeo-ruler` | mount | 흰 털 두른 쇠투구(금관 말고) · 땋은 희끗한 수염 · 곰 털 망토 · 말머리 지팡이 |
| 15 | 송양 | `jm-songyang` | g-bow | 깃털 꽂은 뾰족 고깔 관 · 희끗한 염소수염 · 점무늬 남색 두루마기 · 금 허리띠 드리개 · 맥궁 |
| 16 | 견지 거타 | `guya-1` | mount | 목가리개 높은 쇠 미늘 갑옷 · 짧은 턱수염 · 고리자루 큰칼 — 가야 쇠 장군 |
| 17 | 진지렴 쇠보 | `guya-ruler` | mount | 쇠투구(금 잎 관 말고 · 가야 군주라 형이 원하면 금관) · 숯 묻은 얼굴 · 미늘 위 가죽 앞치마 · 큰 망치 |
| 18 | 살해 매눈 | `chief` | g-bow | 호박빛 눈 · 꿩깃 꽂은 검은 두건 · 붉은 두루마기 · 맥궁 |
| 19 | 해달 | `jm-haedal` | w-bow | 검은 곰털 망토 · 금장식 검은 활 · 차가운 눈 |
| 20 | 송비 | `jm-songbi` | w-bow | 붉은 댕기 · 노란 점무늬 옷 · 환하게 웃는 젊은 명궁 |

## 시험

- 연습 싸움(첫 화면 「더 보기」 → 연습 싸움)을 헤드리스로 360·412 폭에서 찍는다 — 서기·공격 컷(78.9%)·쓰러짐(`gdown`)
- 저사양 `?gfx=low`
