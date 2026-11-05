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

**11-04 굽는 길 (제 띠 · 4 Argon)** — 참조는 `style-anchor.png`(병사 넷) 하나만. 결의 장(gen-<결>-a.png)을 참조로 주면 그 결의 얼굴·옷을 그대로 베끼고 여덟 칸을 다 채웠다(소서노 첫 장 버림).
주문 A = 「THE 7 POSES · slot 8 bottom-right EMPTY」 걷기(11-03 다시 굽기와 같은 글) + 「CHARACTER: <생김새>」 · 같은 대화에서 주문 B(서기 2 · 공격 3 · 막기 · 맞음, 7명 · 우하단 비움) · 주문 C(왼쪽 위 걷기 8번 · 왼쪽 아래 쓰러짐) → `sh tools/fixbr.sh gen-<이름> gen-<이름>-a.png gen-<이름>-b.png "1,1,2,2,3,4,4,5,6,6,7,8" <쓰러짐 네모>` → `GEN_ANIM['<이름>']` · `GEN_OWN[장수 id] = '<이름>'`(같은 초상을 쓰는 id 모두).
- 소서노 ✔ 11-04 `gen-soseono.png` (칸 178x160) — A(걷기)는 Argon · B(서기·공격·막기·맞음)와 C(쓰러짐)는 **edu(u/3) 3.1 Pro 에 style-anchor + A 를 참조로** 받았다. 걷기는 A 의 네 자세가 두 번 돈다(지도 "1,2,3,4,5,6,7,4" · 병사 띠와 같은 결): 반대 다리 장을 두 번 더 받았는데 한 번은 창을 낮게 들고 글자·칸 선을 그렸고, 한 번은 옷이 병사 베옷으로 바뀌었다(버림). B 의 휘두르기 컷에 옅은 초록 자국이 남아 초록 기운 픽셀을 지웠다(옷에 초록이 없는 장수만)
- 알영 ✔ 11-04 `gen-aryeong.png` (칸 159x160 · edu 3.1 Pro · 새 대화에 style-anchor 하나) — **옷에 초록이 있으면 바탕을 마젠타(#FF00FF)로** 시킨다(초록 깃이 키에 먹힌다). 모델이 B 에 바닥 선을 그려 넣었다 → 따낸 뒤 가로로 60% 넘게 덮인 줄을 통째로 지웠다. C(걷기 여덟째+쓰러짐)는 B 를 다시 그리며 다섯째 칸만 쓰러짐으로 바꿔 줘서 쓰러짐만 쓰고 여덟째는 넷째로. 새 대화의 첫 보내기는 자주 대화가 안 생기고 멈춘다 — 다시 열고 보내면 된다
- 해달 ✔ 11-04 `gen-haedal.png` (칸 150x160 · edu 3.1 Pro · `jm-haedal`·`buyeo-1`) — 화살통이 컷마다 등↔허리로 옮겨 다녀서 서기는 둘째 컷 하나로("2,2,2,2,…"), 걷기 첫 컷은 다섯째로. 쓰러짐은 「왼쪽 4분의 1에 한 사람만」으로 따로 받으면 깔끔하다(크게 그려도 copyrect 가 칸에 맞춘다)
- 송비 ✔ 11-04 `gen-songbi.png` (칸 154x160 · edu 3.1 Pro · `jm-songbi`·`biryuna-ruler`) — 첫 장은 땅딸막하고 활을 가로로 들어 버렸다. 같은 대화에서 「고쳐 그려」는 거의 같은 그림을 다시 줬다 → **고칠 것은 머리말(CHARACTER)에 넣고 새 대화로**(「모델처럼 키 큰 · 머리는 키의 1/7.5」「활은 세워 든다」). 쓰러짐만 따로 시켜도 B 를 다시 그리며 한 칸만 바꿔 주는 일이 잦다 — 그 칸을 copyrect 로 쓴다
- 혁거세 ✔ 11-04 `gen-hyeokgeose.png` (칸 147x160 · **roqkfeke12(u/0) 자동 모드** — edu 가 보내기를 받고도 대화를 안 만들고 멈춰서 옮겼다). 쓰러짐을 따로 시키니 서 있는 셋과 겹쳐 그렸다 → 「한 사람만 · 서 있는 그림 없이」로 다시 시키면 깔끔
- 오이 ✔ 11-04 `gen-oi.png` (칸 159x160 · u/0) — 휘두르기 컷의 초록 자국과 창대의 초록 기운은 초록 픽셀 지우기로 (옷에 초록 없음)
- 마리 ✔ 11-04 `gen-mari.png` (칸 161x160 · u/0) — B 의 맞음 컷이 창을 두 자루 쥐어 막기 컷으로 바꿔 씀("…,6,6,6,8"). 쓰러짐은 B 를 다시 그리며 우하단 칸에 넣어 줬다(별표가 머리에 살짝 · 초록 지우기로)
- 대소 ✔ 11-04 `gen-daeso.png` (칸 173x160 · u/0) — 막기 컷이 창 두 자루 · 휘두르기 컷에 흰 자국 → 공격은 "3,4,4,3,2,2"(겨눔·찌름·제자리). 걷기 여섯째는 창 각도가 달라 둘째로
- 을음 ✔ 11-04 `gen-eureum.png` (칸 147x160 · u/0 · 마젠타 바탕) — 칼은 「곧은 외날 고리자루 · 휘지 않음」을 A·B 머리말 모두에 넣어 거의 곧게 나왔다(막기 컷만 휘어 뺌). 쓰러짐 장은 모델이 초록 바탕으로 그려 녹색 옷이 키에 먹힐 뻔 → key-png 55 35 로 좁게 따냈다
- 오간 ✔ 11-04 `gen-ogan.png` (칸 162x160 · u/0 · `mh-ogan`·`tut-ogan`) — 첫 장은 style-anchor 병사의 베옷을 베끼고 컷마다 갑옷이 들쭉날쭉 · 컷 밑에 글자. 「EVERY pose the SAME outfit … NOT beige」「NO CAPTIONS」를 넣어 새 대화로 다시
- 대왕 다물 ✔ 11-04 `gen-damul.png` (칸 162x160 · u/0 · `goguryeo-ruler`) — 쓰러짐은 B 를 다시 그리며 우하단 칸에(별표는 초록 지우기)
- 송양 ✔ 11-04 `gen-songyang.png` (칸 149x160 · u/0 04:52 한도 풀림) — A·B 에 칸 선을 그려 key-png 지울곳 "0.246,0,0.254,1;0.496,0,0.504,1;0.746,0,0.754,1;0,0.493,1,0.507" 로 걷음 · 허리띠 옥이 초록이라 초록 지우기는 안 씀
- 매눈 ✔ 11-04 `gen-maenun.png` (칸 146x160 · u/0 · `chief` 는 초상 표에 없어 GEN_OWN 에 손으로)
- 남은 것: 말 탄 넷(비류·금하·거타·쇠보 — 말 띠 굽는 길이 아직 없다)
- 협보 ✔ 11-04 `gen-hyeopbo.png` (칸 163x160 · u/0) — 첫 판은 휜 칼(왜도 꼴)이라 버리고, 「perfectly STRAIGHT single-edged blade · round ring pommel · NOT curved, NOT a katana」를 A·B 머리말 모두에 넣어 새 대화로 다시 → 모든 컷 곧은 칼
- 말갈기 ✔ 11-05 밤 `gen-malgalgi.png` (칸 157x160 · u/0 자동 모드 · `tut-malgalgi`·`sabeol-1` — 튜토리얼 각성 장수) — A·B·C 모두 칸 선을 그려 key-png 지울곳 "0.246,0,0.254,1;0.496,0,0.504,1;0.746,0,0.754,1;0,0.493,1,0.507" · C 는 B 를 다시 그리며 왼쪽 아래만 쓰러짐으로(copyrect 0,0.78,0.25,0.22) · 걷기 여덟째는 A 넷째(copycell) · 휘두르기 옅은 초록 자국은 `node tools/degreen.mjs <띠> <띠> 15`(g-max(r,b)>15 지움)
- ✗ 11-05 밤 걷기 다리 바꾸기 넷째 실패: 소서노 걷기 1~4컷을 초록 바탕 한 줄로 주고 「두 다리만 바꿔 같은 4컷」을 시켰더니 거의 같은 그림(무릎 든 다리도 같은 쪽)을 돌려줬다(u/0 · walkfix/cmp.png). 다음: Veo 제자리걸음 영상에서 컷 뽑기

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

## ★ 11-03 다시 굽기 — 걷기 8컷이 한 자세였다 (형: "왼다리를 땅에 디딘 그림만 8장 · 움직이는 모션이 전혀 아니야")

검사: 걷기 칸(4~11)을 나란히 놓고 **1번과 5번 컷의 다리가 반대인지** 눈으로 본다. 같으면 다시.

굽는 법 (제미나이 **4 Argon** — Jay u/4 계정에서만 열린다 · 하루 한도 있음):
1. 새 대화 → `+` → 이미지 만들기 → 16:9 → 지금 띠(`anim2/<결>.png`)를 붙여넣기로 참조
2. 주문 A: 걷기 — CONTACT/DOWN/PASSING/UP 을 왼·오른 다리로 8자세 못 박음 · **2x4 칸에 7명, 우하단 칸은 비움**(별표가 거기 찍힌다)
3. 주문 B(같은 대화): 서기 2 · 공격 3 · 막기 · 맞음 — 7명, 우하단 비움
4. 주문 C(같은 대화): **왼쪽 위 = 걷기 8번(UP B) · 왼쪽 아래 = 쓰러짐**, 나머지 여섯 칸 비움
5. 화면 그림(1024폭)을 blob 으로 받는다 — 원본 받기 단추는 자주 안 먹힌다
6. `key-png` → C 의 두 컷을 A·B 의 우하단 칸에 옮김(scratchpad copycell/copyrect) → `strip-frames`(4x2 · B 는 "1,1,2,2,3,4,4,5,6,6,7,8") → `tools/assemble-gen20.mjs` → 찍힌 ar·body 를 `GEN_ANIM` 에
- 다시 끝낸 것: 칼·활·언월도·여창·여활 장수 · 온조 · 주몽 · 이주민(지도)
- 11-04: 여창 우하단 두 컷을 새 장(C)으로 갈아 끼움 (`sh tools/fixbr.sh gen-w-spear gen-w-spear-a.png gen-w-spear-b.png "1,1,2,2,3,4,4,5,6,6,7,8" <쓰러짐 네모>` · 검사 그림은 $TMPDIR/chk.png · 쓰러짐 네모 0.01,0.78,0.28,0.22)
- 11-04: 여활도 같은 길로 (쓰러짐 네모 0.005,0.78,0.26,0.22)
- 11-04 병사 창병·방패병 걷기를 다시 봤다: 한 자세가 아니라 닿기·내리기·지나기·오르기 넷이 두 번 돈다(같은 다리가 앞) — 그대로 둔다. Argon 으로 다시 받아 봐도 5~8 이 1~4 를 되풀이했고 창끝이 칸 경계를 넘어 잘렸다(`sol-spear-a·c.png` · 쓰지 않음). 한 컷만 반대를 보면 `tools/flipcell.ps1`
- 11-04 농민군 20컷 띠 (`anim2/militia.png` · 칸 168x160 · 같은 A·B·C 길 · B 지도 "1,1,2,2,3,4,4,5,6,6,7,8" · 쓰러짐 네모 0.005,0.75,0.245,0.245) — 머리말에 "무기 끝까지 제 칸 안에"를 못 박으면 잘리지 않는다
- 남은 것: 장수마다 제 그림(형 11-03: "여유롭다면 장수마다 전투판 유닛 애니메이션")

## ★ 11-05 자세 틀을 먼저 줘 봤다 — 세 번 다 실패 (형: "틀을 먼저 줘서 의도한 대로")

틀: `tools/pose/walk-template.html` (8컷 = 닿기·내리기·지나기·오르기 × 두 다리 · 서기 4 · 앞다리 빨강/뒷다리 파랑 · 딛은 발은 늘 땅선) ·
`?plain` 은 초록 바탕 회색 마네킹(글자·선 없음). 찍은 것(저장소 밖 · assets_src) `assets_src/realm/gemini/generals/walk-pose-template.png` · `walk-pose-plain.png` — 다시 찍기: `node --experimental-strip-types tools/phone-shot.ts out.png - 1600 900 http://localhost:5174/_tmp/walk-template.html?plain` (public/_tmp 에 복사해 둠).
제미나이 u/0 (나노 바나나) 로 칼 장수(`g-sword-a.png`) 시험:
1. 틀(색 막대·번호) 을 IMAGE 1 · 장수를 IMAGE 2 → **틀의 번호·글자·빨강파랑 다리까지 그대로 그렸다**
2. 회색 마네킹 틀 위에 덧그리기 → **회색 다리를 지우지 않고 남겼다** · 셋째 줄에 다섯 명
3. 장수를 IMAGE 1 · 틀을 「설명 그림일 뿐」으로 IMAGE 2 · 사고 수준 높음 → 깔끔하지만 **여덟 컷 다리가 거의 같다** (`walk2/test-pose-template-fail.png`)
→ 그림 모델은 한 장에 여러 걷기 자세를 다리까지 맞추지 못한다 (11-04 Argon 도 같았다). 다음 길: **동영상 모델(Veo)로 제자리걸음 10초 → 한 걸음(두 발)만큼 여덟 프레임을 뽑아 초록 따기** — 동영상은 다리가 저절로 번갈아 간다
