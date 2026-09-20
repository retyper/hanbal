# 에셋 — 어디서 받아오는가

> 2026-09-11, 형: **"내가 너 SVG로 직접 적 만들지 말라고 했잖아. 만들어도 존나 좆같은 이미지
> 이런게임을 누가하냐. 적절한거 다운받아오던지 내가 찾아올수있는 무료 사이트 여러개 뽑아와."**

이 문서는 그 목록이다. **직접 그리기 전에 여기부터 본다.**
이미 소리는 이렇게 하고 있다 (Freesound CC0 15종 → `public/sfx`, 출처는 `CREDITS.txt`).
그림도 같은 길로 간다.

---

## 0. 형이 바로 눌러볼 것 (2026-09-11 기준 전부 열림 확인)

| 사이트 | 무엇이 있나 | 라이선스 | 이 게임에 쓸 곳 |
|---|---|---|---|
| **[Kenney](https://kenney.nl/assets)** | 2D/UI/이펙트/소리 수만 점 | **CC0** (출처 표기도 불필요) | UI 판넬·아이콘·파티클. **이미 쓰고 있다** (`assets_src/fub`, `assets_src/ui`) |
| **[OpenGameArt — CC0만 걸러보기](https://opengameart.org/art-search-advanced?field_art_licenses_tid%5B%5D=4)** | 잡다한 2D 스프라이트 | 검색에서 **CC0만** 고른 링크다 | 적·무기·투사체. 품질 편차가 크니 **한 장씩 눈으로 고를 것** |
| **[game-icons.net](https://game-icons.net/)** | 4,000점 넘는 **흑백 SVG 아이콘** | CC BY 3.0 (출처 한 줄) | 화살·활·칼·부적·재화 아이콘. 색을 우리가 칠하므로 **화면 톤이 안 깨진다** |
| **[itch.io — 무료 게임 에셋](https://itch.io/game-assets/free)** | 개인 작가들의 2D 팩 | 팩마다 다름 (**받기 전에 꼭 확인**) | 동양풍 캐릭터 스프라이트. "samurai", "ninja", "oriental", "pixel warrior" 로 검색 |
| **[공유마당 (한국저작권위원회)](https://gongu.copyright.or.kr/)** | **만료저작물** 한국 그림·전통문양·글꼴 | 만료저작물은 자유 이용 | 우리 세계가 조선이다. **여기가 진짜 금맥이다** — 민화·풍속화·문양 |
| **[문화포털 전통문양](https://www.culture.go.kr/tradition/)** | 단청·귀면·십장생 등 **벡터 전통문양** | 공공누리 (대개 제1유형) | 도깨비(귀면와)·장승 얼굴·지도 장식·UI 테두리 |

**403 이라 자동으로는 못 받지만 형이 브라우저로 열면 되는 곳**
[CraftPix 무료](https://craftpix.net/freebies/) — 품질이 제일 좋다. 회원가입이 필요하고,
**재배포 금지** 조항이 있으니 공개 저장소에 원본을 올리면 안 된다 (가공본만).

---

## 1. 이 게임에 특히 맞는 검색어

우리 적은 **고려·조선**의 것이어야 한다 (2026-09-10, 형의 요구로 드론 → 매, 로봇 → 화차).
영어 사이트에서 '조선'으로는 아무것도 안 나오므로 **문화권이 겹치는 말**로 찾는다.

- 적 사람: `samurai sprite`, `ronin`, `oriental warrior`, `spearman`, `archer sprite`
- 귀신·요괴: `oni`, `yokai`, `kitsune`(구미호), `demon mask`, `ghost sprite`
- 물건: `matchlock`, `hand cannon`, `siege`, `cart`, `banner`, `lantern`
- 배경: `east asian background`, `pagoda`, `bamboo forest`, `mountain parallax`
- 한국 것만: 공유마당·문화포털에서 `귀면`, `장승`, `호작도`, `단청`, `화차`, `신기전`

---

## 2. 라이선스 — 이것만 지키면 된다

| 표시 | 뜻 | 우리가 할 일 |
|---|---|---|
| **CC0 / Public Domain** | 아무 제약 없음 | 그냥 쓴다. 그래도 출처는 적는다 (나중에 우리가 찾으려고) |
| **CC BY** | 출처 표기 | `public/sprites/출처.txt` 와 `CREDITS.txt` 에 한 줄 |
| **CC BY-SA** | 출처 + **같은 라이선스로 공개** | 이 게임에는 **안 쓴다.** 소스 전체에 옮아붙는다 |
| **CC BY-NC** | 비상업 | 지금은 상업이 아니지만 **안 쓴다.** 나중에 팔 때 전부 갈아엎어야 한다 |
| 사이트 자체 약관 (CraftPix 등) | 대개 "써도 되고 재배포는 금지" | 원본 파일을 저장소에 안 올린다 |

> 받은 것은 **반드시** `public/sprites/출처.txt` 에 〈파일명 — 작품명 — 주소 — 라이선스〉로 적는다.
> 반년 뒤에 "이거 어디서 받았더라"가 되면 그 에셋은 **못 쓰는 에셋**이 된다.

---

## 3. 받은 그림을 게임에 넣는 법 (배선은 이미 있다)

1. PNG 를 `public/sprites/<이름>.png` 로 넣는다.
2. `public/sprites/출처.txt` 에 출처를 적는다.
3. 그리는 쪽에서 `sprite('<이름>')` 로 부른다 (`src/render/sprites.ts`).

```ts
const im = sprite('gunner')
if (im !== null) ctx.drawImage(im, x - w / 2, y - h / 2, w, h)
else drawFoeGunner(...)   // 벡터 폴백 — 헤드리스 프로브·로딩 전에는 이쪽이 돈다
```

**폴백을 지우지 않는다.** 이 저장소는 브라우저 없이 프로브로 검증한다 (CLAUDE.md).
`sprite()` 는 헤드리스에서 언제나 `null` 이라, 벡터 쪽이 살아 있어야 프로브가 계속 돈다.

---

## 4. 왜 아직 전부 안 바꿨나 (2026-09-11 현재)

**그림을 고르는 것은 눈으로 하는 일이고, 이 데스크탑에는 브라우저가 없다** (CLAUDE.md).
내가 고른 스프라이트가 이 게임의 톤(어두운 배경·스틱맨·납작한 색)과 맞는지는
받아서 화면에 얹어봐야 안다. 그래서 여기까지가 내가 할 수 있는 것이다:

- 목록을 뽑았다 (위 표, 전부 열리는 것 확인)
- 배선은 이미 있다 (`sprite()` + 폴백)
- 한 번 해본 적도 있다 (드론 스프라이트 — `public/sprites/drone.png`, OpenGameArt CC0)

**형이 할 것:** 위 표에서 마음에 드는 팩을 하나 골라 링크만 던져 주면, 받아서 넣고
치수·자리·시체까지 맞춘다. 적 하나당 필요한 것은 **정면 한 장 + (있으면) 죽는 그림 한 장**이다.

---

## 5. 지금 저장소에 들어와 있는 기성 에셋

| 무엇 | 어디서 | 라이선스 |
|---|---|---|
| 소리 15종 | Freesound | CC0 (`CREDITS.txt`) |
| UI 판넬·구분선 | Kenney (`assets_src/fub`, `assets_src/ui`) | CC0 |
| 아이콘 14종 | `public/icons` (출처는 `public/icons/출처.txt`) | 각 파일 표기 |
| 수렵도(배경) | `public/art/suryeopdo.jpg` | 만료저작물 |
| 드론 스프라이트 | OpenGameArt (`public/sprites/drone.png`) | CC0 — **지금은 안 쓴다** (매로 바뀜) |
| 화살 아홉 대 | 생성 (챗지피티, 한 장 → `tools/slice-grid.mjs`) | 우리 것 — 6장 |
| 부적 넷 · 칭호 메달 여덟 | 생성 (같은 대화, 4x4 한 장 → `slice-grid.mjs … fit`) | 우리 것 — 6장 |
| 갑옷 셋 · 갈림길 여섯 · 스탯 넷 | 생성 (같은 대화, 셋째 장) — 카드에 크게 서는 자리만 | 우리 것 — 6장 |
| 보스 여덟 (몸) | 생성 (같은 대화, **투명 바탕** 두 장 → `slice-grid.mjs … trim`) · 눈은 절차적 | 우리 것 — 7장 |

---

## 6. 그림을 굽는 주방 (2026-09-20)

> 형: **"요즘 최신 ai 게임개발 관행을 따라 허깅페이스 같은걸로 밋밋한 SVG들 전부 에셋으로
> 바꿔야 겠어. 파인다이닝 주방처럼 루프 진행해."**

기성품(0~1장)에 없는 것 — **우리 게임에만 있는 물건**(화전·명적·애기살, 부적, 칭호) — 은 굽는다.
한 코스씩: **주문(프롬프트) → 굽기 → 시식(눈으로, 실제 크기로) → 담기(배선) → 내보내기(커밋)**.
시식에서 떨어지면 접시에 안 올린다.

### 화구 둘

| 화구 | 어떻게 | 언제 |
|---|---|---|
| **챗지피티** (형 크롬, 로그인돼 있다) | 프롬프트 → 그림 → `~/Downloads` → `assets_src/` | **한 벌이어야 하는 것.** 한 장에 격자로 받아 `tools/slice-grid.mjs` 로 자른다 — 따로 받으면 화풍이 제각각이 된다 |
| **Hugging Face** FLUX.1-schnell 공개 Space | `node tools/gen-art.mjs` (메뉴: `tools/gen-menu.json`) | 낱장. 프롬프트·시드가 남아 **다시 구울 수 있다.** Apache-2.0, 결과물 제약 없음 |

**HF 의 사정 (2026-09-20 확인):** 이 기기의 `HF_TOKEN` 은 vcell 용 **읽기 전용** 토큰이라 추론을
못 부른다 (403 "insufficient permissions to call Inference Providers"). 익명 Space 는 열려 있지만
**세 장쯤에서 할당량이 끝난다.** 제대로 쓰려면 형이 huggingface.co/settings/tokens 에서
*Make calls to Inference Providers* 권한이 있는 토큰을 **따로** 하나 만들어 줘야 한다 — vcell 토큰의
범위는 넓히지 않는다 (그건 공부용이다).

### 시식 규칙 (첫 판에서 배운 것)

1. **가는 물건은 통째로 그리지 않는다.** 화살 한 대를 대각선으로 그리면 20px 에서 머리카락이 된다.
   **구별되는 부분(촉)을 크게 당겨 잡는다.**
2. **실제 크기로 본다.** 512px 에서 예쁜 것과 20px 에서 읽히는 것은 다른 일이다.
3. **두른 빛의 색 = 코드의 강조색.** 화살은 `ARROW_TINT` 와 같은 색 빛을 둘러 카드와 이어진다.
4. **세이브를 건드리지 않는다.** 시식은 페이지에 임시 띠를 얹어서 한다 — 지도에서 판을 두 번 누르면
   형의 여정이 접힌다.

5. **격자를 믿지 않는다.** 16칸을 시키면 모델은 등분을 1~5% 어긴다. `slice-grid.mjs … fit` 이
   칸 경계를 잉크가 가장 적은 줄로 다시 찾고 물건을 가운데에 놓는다.
6. **아이콘 크기는 그림에 맞춘다.** 선 그림은 20px 에서 읽히지만 메달은 점이 된다 — 칭호는 34px 로 키웠다.
7. **둘째 장부터는 같은 대화에서** "EXACTLY the same painting style" 로 시킨다. 화풍이 이어진다.

### 무엇을 안 바꿨나 (일부러)

- **내비·스탯 글리프 20종** (`public/icons`, game-icons.net): 16px 버튼 안의 단색 마스크다. `currentColor`
  로 상태(강조·흐림)를 말하고 있어서, 그림으로 바꾸면 죽이 되고 상태 표시도 잃는다.
- **지도** (`ui/mapart.ts`): 옛 지도 문법의 SVG 고, 배율마다 선명해야 한다. 밋밋하지 않다.
- **잠긴 칸의 점선 원**: 그림을 보여주면 가린 게 아니다.

### 주문서 — 화살 아홉 (3×3, 받은 그대로)

```
Generate one square 1024x1024 image: a sprite sheet of NINE game item icons in a strict, perfectly
even 3x3 grid (each cell exactly one third of the width and height, no gutters, no grid lines, no
borders, no text, no numbers, no labels). Every cell has the same plain very dark blue-grey
background (#1c2129) and shows a CLOSE-UP of the FRONT HALF of a medieval Korean (Joseon) arrow -
the arrowhead and a short piece of shaft - drawn BIG and CHUNKY, pointing to the upper right,
filling about 80% of its cell, fully inside the cell with margin. Style: hand-painted stylized game
icon art, bold thick shapes, strong colored rim glow, high contrast, must stay readable when shrunk
to 24 pixels. Same brush, same lighting in all nine. Cells, left to right, top to bottom:
(1) plain willow-leaf iron arrowhead on a bamboo shaft, silver-grey glow. (2) fire arrow: gunpowder
paper tube tied behind the head, burning fuse, orange glow. (3) whistling arrow: big round carved
wooden whistle head with holes, green sound-wave rings. (4) head splits into three blades like a
trident, violet glow. (5) three arrowheads fanning out from one point, steel-blue glow. (6) three
arrowheads one behind another in a line, gold glow. (7) spirit arrow with a curving teal light
trail and white feather wisps. (8) very slim needle-sharp steel bodkin dart with an icy light-blue
streak. (9) massive heavy arrow, very thick shaft, huge broad chisel iron head, rust-red ember glow.
```

### 주문서 — 부적·메달·물건 열여섯 (4×4, 같은 대화에서 이어서)

```
Great. Now a second sheet in EXACTLY the same painting style, brush, lighting and the same plain
very dark blue-grey background (#1c2129): one square 1024x1024 image, SIXTEEN game icons in a
strict, perfectly even 4x4 grid (no gutters, no grid lines, no borders, no numbers, no labels).
Each subject is BIG and CHUNKY, centered, filling about 80% of its cell, readable at 24 pixels.
ROW 1 - four Korean paper talismans (bujeok): a tall yellow paper strip with red ink border,
slightly tilted, each with ONE big bold red-ink brush drawing: (1) a quiver full of arrows,
(2) lamellar armor, (3) a gold ingot with coins, (4) a fierce dokkaebi face, pale blue glow.
ROWS 2-3 - eight round achievement medals, thick bronze-and-gold rim, one bold emblem each:
(5) check mark, silver-white glow, (6) four-pointed star, gold, (7) hawk's eye, amber,
(8) hailstones in streaks, icy blue, (9) straw target riddled with arrows, red, (10) three wind
swirls, pale teal, (11) horn bow inside a perfect golden ring, (12) mountain pass with a small red
flag on the peak, dawn orange. ROW 4 - (13) round wooden war shield, (14) leather lamellar vest,
(15) string of yeopjeon brass coins, (16) anvil with hammer and sparks.
```

### 주문서 — 갑옷·갈림길·스탯 (4×4, 셋째 장)

같은 머리말("A third sheet, EXACTLY the same painting style …")에 칸만 바꿨다. **칸 사이에 빈 자리를
두라**고 덧붙인 것이 효과가 있었다 ("with clear empty dark space between neighbours").

```
ROW 1 - Joseon armor: (1) plain brown leather armor vest, (2) brigandine coat (dujeonggap): dark red
cloth covered with rows of round brass rivets, silver-blue glow, (3) heavy iron lamellar scale armor
(chalgap) with shoulder guards, gold glow, (4) round wooden war shield. ROWS 2-3 - battle event
cards: (5) volley of three blazing fire arrows, (6) wooden gunpowder crate with lit fuse and flame
mark, (7) tattered war banner whipping in a valley gust, teal, (8) tied bundle of arrows in a supply
basket, green, (9) enemy foot soldier sprinting forward with a spear, red-orange, (10) one lone
arrow stuck upright in the ground, violet, (11) string of brass coins, (12) anvil with hammer.
ROW 4 - archer's body: (13) STRENGTH: muscular forearm and fist gripping a bow handle, (14)
STEADINESS: a calm hand balancing an arrow level on one fingertip, pale blue, (15) STAMINA: a
glowing heart wrapped by a swirl of breath, green-gold, (16) FOCUS: a sharp eye with a target ring
reflected in the iris, amber.
```

---

## 7. 캔버스의 것들 — 보스·적·궁수 (2026-09-20)

> 형: **"캐릭터 적군 보스 등등도 전부 에셋 받아서 적용해야지."**

아이콘과 달리 이것들은 **판정이 있는 그림**이다. 예쁜 것보다 먼저 지킬 것이 있다.

### 보는 법 — `tools/preview`

게임은 백그라운드 탭에서 안 돈다 (규칙 4) — 자동화가 잡은 탭에서는 캔버스가 까맣다. 그래서
**루프 없이 진짜 렌더러로 한 프레임만** 그리는 쪽을 만들었다. hidden 탭에서도 찍힌다. 세이브는 안 건드린다.

```
npx vite → http://localhost:5173/tools/preview/index.html?stage=50&ticks=150&hit=1
  stage 판 번호 · ticks 그 전에 sim 을 돌릴 틱 · hit=1 판정 덧그림 (초록 = 몸, 노랑 = 보스 급소)
  콘솔: shot(60, 150)   ← 스프라이트는 비동기로 뜨므로 한 번 더 부르면 그림이 선다
```

보스는 10판마다: 10 눈알 · 20 갑주 · 30 쌍눈 · 40 폭주 · 50 도깨비 · 60 구미호 · 70 장승 · 80 저승사자.

### 보스 — 몸은 그림, 눈은 절차 (`render/bossart.ts`)

1. **눈은 그림에 굳히지 않는다.** 눈은 뜨고 감는 sim 의 상태고 곧 급소다. 그림은 "눈구멍이 그늘진 몸"으로
   주문하고 ("NO eyeballs — deep black empty sockets, the game draws the eyes"), 눈은 그 위에 그린다.
2. **그림을 놓는 기준점은 눈구멍이다.** 눈구멍을 sim 의 급소 자리에 못 박고, 크기는 〈눈 → 발밑〉 거리로 정한다.
3. ★ **정면·좌우대칭으로 받는다.** 첫 장은 3/4 옆모습으로 받았다가 여섯을 버렸다 — 급소가 몸 중심축 위에 있어서,
   옆으로 흐르는 그림은 눈구멍을 급소에 맞추면 **몸이 판정원의 절반만 덮는다** (맞혔는데 허공). 주문서에
   "the hit area is a circle centered on the body and the weak spot sits on the vertical center line" 을 그대로 적을 것.
4. **투명 바탕은 그냥 시키면 온다** ("fully TRANSPARENT background (real alpha), no ground, no cast shadow, no outer glow").
   `tools/peek-png.mjs` 가 알파가 진짜인지 말해 준다. 줄일 때는 알파를 곱해서 평균낸다 (`png.mjs`) — 안 그러면 테두리에 색이 묻는다.
5. 벡터 몸은 **폴백으로 남는다** (그림이 안 떴을 때 · 헤드리스 프로브).

### 아직 — 적 · 궁수

챗지피티 무료 한도가 하루 다섯 장쯤에서 끝난다 (2026-09-20 에 다섯 장 받고 막혔다 — 다음 날 같은 시각에 풀린다).
- **적 (창가·숨는 사수 · 매 · 화차 · 총통수 · 투석군 · 척후)**: 화면에서 35~45px 다. 사람은 **나를 겨누는 팔**이 절차적이라
  (render/foe.ts) 통짜 그림으로 바꾸면 겨냥이 죽는다 — 몸통·머리는 그림, 팔·활은 절차로 가는 길을 먼저 시험할 것.
- **궁수 (스틱맨)**: 당김·겨냥·떨림·활 다섯 자루·갑옷 세 벌·환도가 전부 관절 위에 서 있다 (render/stickman.ts · docs/FORM.md).
  통짜 그림은 안 된다. 관절 사이에 그림 조각을 얹는 **컷아웃**이 유일한 길이고, 손맛을 건드리는 일이라 형과 먼저 정한다.

### 적 — 몸은 그림, 팔과 무기는 절차 (`render/foeart.ts`, 같은 날 끝냄)

형: **"못만들면 무료 에셋 적절한거 검색해서 다운받으면 되잖아."** — 그래서 먼저 찾았다.

**기성품 조사 결과 (2026-09-20):** OpenGameArt CC0·2D 35개 검색어, itch.io CC0 태그, Wikimedia, Openclipart.
픽셀이 아니고 · 옆모습이고 · 공개 저장소에 올려도 되는 **사람 적은 없다.** 그나마 남은 것이 청나라풍 치비 컷아웃
(`ancient-chinese-character-pack-1`, CC0)과 오스만 창병 한 명(`sipahi`, CC0)인데, 그린 보스 옆에 세우면 다른 게임이 된다.
물건은 쓸 만한 것이 있다 — 나무 상자 `2d-wooden-box`(CC0), 통 `cartoon-barrel`(CC0, SVG). 매는 머이브리지의 1887년 연속사진
(퍼블릭 도메인)뿐이고 손이 많이 간다. CraftPix 무료팩은 품질이 좋지만 **재배포 금지**라 공개 저장소에 못 올린다.

**그래서 세 번째 화구를 열었다 — 제미나이** (형 크롬에 로그인돼 있다). 챗지피티와 다른 점 셋:
1. **투명 바탕을 못 준다** (체크무늬를 그려 넣는다). "Background is ONE flat solid pure magenta (#FF00FF)" 로 시키고
   `tools/key-png.mjs` 로 따낸다 — 가장자리의 분홍 테까지 덜어낸다(despill).
2. **시키지 않은 글자 라벨**을 넣고 오른쪽 아래에 워터마크(✦)를 찍는다. key-png 의 '지울곳' 으로 따내기 전에 덮는다.
3. **좌우를 자주 틀린다.** "FACING LEFT" 라고 해도 오른쪽으로 그린다 — key-png 의 `flip`.
   받기: 그림 위의 "원본 크기 이미지 다운로드" 버튼 → `~/Downloads/Gemini_Generated_Image_*.png` (미리보기 blob 은 1024px JPEG 다).

배선은 보스와 같은 원리다 — **그림의 머리를 sim 의 헤드샷 자리에 못 박고** 〈머리 → 발밑〉으로 크기를 정한다.
- 궁수·갑옷 궁수·총통수·투석군: 팔 없는 몸만 그림. 겨누는 팔·활·총통·끈은 지금처럼 그 위에 그린다.
- 창가의 사수: 같은 그림을 **크게** 그려 상체만 보이게 한다 (`F.windowFoot`) — 다리는 창틀이 자른다.
- 척후: 칼을 든 통짜 한 장 + 달리는 흔들림. (모델이 두 컷을 같은 다리로 그려서 한 컷만 쓴다.)
- 매: 날개를 든 컷·내린 컷을 날갯짓 위상으로 번갈아. 기준점은 눈(급소). 발톱의 돌은 그 위에 그린다 — 달아오르는 돌이 예고라서.
- 미리보기에서 `&fork=scout` 로 척후를 불러낸다.

### 남은 것

- **화차 · 화약궤 · 통 · 과녁 · 건물** — 아직 벡터다. 관절이 없어 쉽다. 상자·통은 위의 CC0 기성품을 먼저 얹어 볼 것.
- **궁수(스틱맨)** — 형과 먼저 정한다 (아래 '아직' 항목).

### (기록) 챗지피티용 적 주문서 — 제미나이로 대신했다


설계는 끝나 있다: `render/foe.ts` 는 이미 〈몸통·머리〉와 〈활팔·활·시위〉를 따로 그린다. **몸통·머리·다리만 그림**으로
바꾸고, 그림의 **머리를 sim 의 헤드샷 자리**(P.enemy.archerHeadUp · archerHeadR)에 못 박는다 — 보스의 눈구멍과 같은 원리다.
팔과 활은 지금처럼 나를 겨누며 절차적으로 그린다. 달리는 척후와 나는 매는 두 컷을 번갈아 쓴다.

```
Now the ENEMY SOLDIERS of the same game, EXACTLY the same hand-painted style and brush. One landscape
1536x1024 PNG, fully TRANSPARENT background (real alpha, no ground, no cast shadow, no outer glow),
EIGHT sprites in a strict even 4x2 grid, clear empty space between neighbours, no text. All are strict
SIDE VIEWS FACING LEFT, centered in the cell, filling about 85% of the cell height. Joseon-era Korea.
Bold, simple, high-contrast shapes: in the game these are only 40 pixels tall.
IMPORTANT for (1)-(4): paint head, torso and legs ONLY - NO ARMS, NO HANDS, NO WEAPONS. The game draws
the arms and the weapon itself. End each shoulder as a clean rounded cap.
ROW 1: (1) BANDIT ARCHER BODY: lean man, dark red-brown tunic, headband, standing upright, feet apart.
(2) ARMORED ARCHER BODY: the same man wearing a grey iron breastplate, bare head. (3) GUNNER BODY:
stocky soldier in a wide-brimmed black felt hat (beonggeoji) and dark blue coat, front foot forward,
braced. (4) SLINGER BODY: barefoot peasant rebel, white headband, rolled-up sleeves, leaning back.
ROW 2: (5) SCOUT RUNNING, frame A: a swordsman sprinting left, sword raised overhead, left leg
forward - this one WITH arms and sword. (6) SCOUT RUNNING, frame B: the same swordsman, identical
size and position, right leg forward. (7) HUNTING FALCON, frame A: a falcon flying left, wings raised
high. (8) HUNTING FALCON, frame B: the same falcon, identical size and position, wings swept down.
```

그다음 장: 화차(수레) · 화약궤 · 통 · 과녁 · 보급 과녁 같은 **물건들** — 관절이 없어 제일 쉽다.

