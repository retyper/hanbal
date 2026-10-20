# ART — 새 게임의 그림 주문서

> 형 (2026-10-17): *"필요한 이미지나 이런거 브라우저로 챗지피티한테 미리 만들어둘거 만들어서 받아놔.
> 챗지피티는 무료버전이라 무료크레딧 다쓰면 기다려야하니까."*
> 굽는 법·시식 규칙은 `docs/ASSETS.md` 6장 그대로다 (격자로 받기 · `tools/slice-grid.mjs … fit` · 투명 확인은 `tools/peek-png.mjs`).
> 받은 원본은 `assets_src/realm/` (gitignore) — 게임에 넣는 건 R5 다. **지금은 받아 두기만 한다.**

## 0. 화풍 한 벌 — 모든 주문의 머리말

새 대화 **"78 Kingdoms Art"** 를 하나 열고, 모든 장을 그 대화에서 받는다. 첫 장이 화풍의 기준이 된다.

- **시대**: 서기 2~3세기 한반도 남부 (삼한 · 원삼국). 조선·고려 복식이 **아니다** — 갓·도포·한옥 기와 금지.
  초가 · 흙벽 움집 · 통나무 목책 · 삼베 옷 · 상투(「魁頭露紒」) · 큰 새 깃털 · 구슬 목걸이 · 철검·철모(창) · 나무 방패 · 가죽 갑옷.
  쇠 판갑·찰갑·환두대도·말 탄 삼한 병사 **금지** (WORLD §3).
- **그림체**: 기존 신궁 그림과 이어지게 — 손으로 칠한 듯한 굵은 붓 · 묵직한 윤곽 · 높은 대비 · 작게 줄여도 읽힌다.
- **바탕**: 아이콘·소품은 **fully TRANSPARENT background (real alpha)** · 초상·삽화는 어두운 남색 회색(#1c2129) 판 위.

### 0-1. 한반도 풍 — 중국풍으로 읽히면 반려 (형, 2026-10-17)

> 형: *"이미지들중에 중국풍 너무많으니까 확실히 한반도 풍으로 만들어야해. 부여 고구려 백제 신라 가야 이런거있잖아."*
> 첫날 받은 판에서 중국풍으로 읽힌 것: 수염 달린 긴 용(이무기·용·강철이), 비단 교령 도포와 관(책사·낙랑 관리), 상투관.
> 그림 모델은 "ancient Korea" 만 주면 **중국 사극**을 그린다. 그래서 **무엇을 그릴지를 유물 이름으로** 준다.

| 나라 | 그림에 넣을 것 (프롬프트 어휘) |
|---|---|
| 고구려 | 고분벽화(무용총·각저총·수산리·안악) 옷: **polka-dot (dotted) jackets**, 깃·소매·도련에 다른 색 **띠 테두리**, 허리띠, **pleated striped skirts**, 발목 묶은 통 넓은 바지 · **jo-ugwan (cap with two upright bird feathers)** · 여인의 얹은머리 · 사신도의 **청룡** |
| 부여 | **흰 옷** · 털옷·털모자 · 금은 장식 모자 · 말 탄 궁수 |
| 신라 | **금관 (出-shaped tree-and-antler gold crown hung with comma-shaped jade gogok)** · 굵은 고리 금귀걸이 · 유리 구슬 목걸이 · 천마 |
| 가야 | **철**: 덩이쇠(덩이 철판), 볏 달린 철 투구, 판갑(영웅·적장급만 — 병사는 여전히 가죽·나무) · 오리 모양 토기 |
| 백제 | **금동관(gilt-bronze openwork crown)** · 금동대향로의 연꽃·봉황 · 매끈한 옷맵시 |
| 삼한 바탕 | 초가 · 움집 · 통나무 목책 · 삼베 · 상투(魁頭露紒) · 큰 새 깃털 · 문신 · 납작머리(편두) |

- **용은 고구려 벽화의 청룡**이다: *slender four-legged Korean dragon from Goguryeo tomb murals, feline body, flame-like mane, NO long catfish whiskers, NOT a Chinese dragon.* 이무기는 **뿔·다리 없는 거대한 물뱀**.
- 매 주문 끝에 **부정어**를 붙인다: *NOT Chinese: no hanfu cross-collar silk robes with huge sleeves, no Chinese crowns or guan hats, no Chinese long whiskered dragons, no pagodas, no Chinese characters. NOT Japanese: no kimono, no samurai, no ninja (no face mask, no hood-mask, no wide obi sash, no tabi, no katana, no shuriken or kunai).*
- **자객·암살자는 한국식** (형 2026-10-21: "자객은 닌자 형상화 하지 않게 주의해. 한국식 암살자여야함."): 삼국·삼한 차림 저고리(앞여밈)와 통 넓은 바지 · 대님·행전 · 가는 천 허리띠와 띠고리 · 두건이나 상투·땋은 머리 · 짚신·가죽신 · 맥궁(각궁)·환두 손칼 · 곡옥. 복면·감싼 두건 마스크·닌자식 웅크림은 안 된다.
- ~~군현(낙랑·대방) 사람만 바깥 옷을 입는다~~ → 형 (2026-10-18): *"중국식으로 만들지마. 기본적으로 한반도 풍으로 해야해."*
  군현 사신·관리 그림도 **그리지 않는다** (장수 16번 낙랑 사신 → 고구려 개마무사 장수로 바꿈). 군현 사건에 그림이 필요하면 형에게 먼저 묻는다.
- **중국풍은 무조건 뺀다** (형, 2026-10-18: *"중국풍은 무조건 없애야한다니까. 중국이나 선비족 용병이라는 설정이면 괜찮지만"*).
  예외는 설정이 **중국·선비족 용병**(바깥에서 온 사람)인 인물뿐. "전설급·스플래시아트" 로 시키면 그림 모델이 선협(仙俠) 옷을 입히니
  여인 옷은 **고구려 벽화 어휘로 못 박는다**: hip-length jeogori jacket with contrasting bands (seon) at collar, cuffs and hem, belted
  at the waist, long pleated striped skirt, polka dots, hair coiled high — 부정어 *no xianxia, no hanfu, no wide Chinese sleeves, no buyao
  hair ornaments, no dragon or phoenix embroidery*.
- 고증의 시대(2~3세기)보다 **한반도로 읽히는 것이 먼저다** (WORLD 규칙 8 · 형: "고증을 철저히 지킬 필요 없고"). 삼국의 유물(금관·금동관·판갑)을 장수·왕족의 장식으로 빌려 와도 된다.

### 0-2. 여인들 — 많이, 눈길을 확실히

> 형: *"과하지 않지만 눈길을 확실히 끌 자극적인 여캐들도 많이넣어."*

- 초상·영물·삽화 **어느 장이든 여인을 넣는다.** 장수 초상 열여섯 중 최소 절반은 여인 (①-3).
- 눈길은 **디자인으로** 끈다: 또렷한 화장(붉은 입술·눈매), 금관·금귀걸이·구슬의 반짝임, 몸에 맞는 가죽 갑옷, 드러난 어깨·팔의 문신, 흉터, 자신만만한 표정, 강한 색.
- **선은 넘지 않는다**: 노출·성적 자세 없음, 모두 성인. 프롬프트에 *tasteful, no nudity, adult women* 를 붙인다.
- **예쁘게, 그리고 다 다르게** (형: *"여캐들이 안이쁜데"* · *"너무 다 한사람 아냐? 다양하게 이쁘면 안되나"*):
  화풍은 *premium Korean MMORPG character illustration* — 그리고 칸마다 **미인의 유형**을 다르게 적는다
  (차가운 고양이상 · 동글동글 귀여운 상 · 그을린 말괄량이 · 짧은 머리의 미남형 · 농염한 30대 · 북방 외꺼풀 · 주근깨 옆집 아가씨 · 여우상 …).
  "다르게"만 시키고 "예쁘게"를 빼면 못생겨진다 — 둘을 같이 쓴다.
- **체형도 다르게** (형: *"가슴사이즈도 다양해야해 남자 체형도 다양하듯이"*): 가냘픈·마른 · 탄탄한 근육형 · 통통하고 풍만한 · 곡선형 —
  인물마다 *BODY:* 한 줄. 옷은 입힌 채로 (*fully clothed*).

### 0-3. 장수 그림의 두 쓰임 · 받는 법

> 형: *"남캐도 여캐도 명치정도 까지 나오는 수준으로"* · *"지금까지 만든걸 버릴필욘없는데 장수가 등장하고 획득하려면 어떤부분에선 머리 이상의 이미지가 필요함"*

- **명치판(bust)** — 머리 위부터 명치(가슴 중간)까지, 두 어깨·윗팔. 장수 **등장·획득** 연출에 쓴다. 이것이 본판이다.
  프롬프트: *upper-body bust portrait framed from just above the head down to the solar plexus (mid-chest), both shoulders and upper arms visible*
- **머리판(head)** — 목록·아이콘·대화창. 명치판에서 얼굴을 잘라 만든다 (R5). 먼저 받은 머리판들도 버리지 않고 둔다.
- **한 장에 한 명**: 4×4 격자로 받으면 그림 모델이 얼굴 하나를 열여섯 번 복사한다. 인물 그림은 한 장에 한 명으로 받는다 (아이콘·기호·영물은 격자 그대로).
- **한 사람은 새 대화에서**: 제미나이 한 대화에서 여러 명을 이어 받으면 앞사람의 관·옷이 뒷사람에게 번진다
  (2026-10-17: 고구려 여인이 신라 금관을 쓰고, 무녀가 부여 털옷을 입었다). 화풍은 프롬프트 머리말로 맞춘다.
- **제미나이 Argon** (Jay 계정 u/4 의 '이미지' 화면, 모델 4 Argon) 은 명치판이 챗지피티 화풍에 가깝다 (2026-10-19 밤 확인).
  Pro/Flash 는 굵은 선 웹툰체로 나와 안 맞는다 → 머리말에 *lush semi-realistic digital painting … NO thick black outlines, NO comic or webtoon look, NO cel shading* 를 넣는다.
  반짝이(오른쪽 아래)는 (77,0) 에서 870 정사각으로 잘라 피한다.

### 0-4. 출토 유물·사서 어휘 — 프롬프트에 그대로 쓴다 (2026-10-19 조사)

> 형: *"섹시한 남캐 여캐도 꼭 만들어. 개성있고 다양하게. 한반도 고대 스타일. 절대 중국일본 섞지마. 어떤식으로 해야할지 모르겠으면 그시대 출토유물을 웹에서 확인해가지고 와"*

근거는 『삼국지』 위서 동이전(위키문헌 원문 대조)과 박물관·발굴 자료. **[시대]** = 1~3세기에 맞음 · **[늦음]** = 4~6세기 것(왕·전설에만, 판타지로 허용).
매력은 표정·눈매·몸에 맞는 옷·드러난 팔의 문신·구슬의 반짝임으로 끈다 (0-2). 옷은 입힌 채.

- **삼한 공통 [시대]** — 맨 상투, 관 없음(魁頭露紒) · 베 도포, 가죽 신(衣布袍 足履革蹻蹋) · **구슬을 보배로 — 옷에 꿰매고 목에 감고 귀에 늘어뜨림, 금·비단은 안 침**(以瓔珠為財寶…不以金銀錦繡為珍). *가장 센 반중국 표지.* 누에 쳐서 명주·솜베.
- **마한·초기 백제** — 사내의 문신(時時有文身) [시대] · 코발트·빨강·초록 유리구슬과 금박 유리구슬 목걸이(아산 마한 무덤) [시대] · 말 모양 띠고리 · 금동 고깔관(뒤로 솟은 대롱, 투조판) [늦음] · 무당: 팔주령 한 쌍과 잔무늬 거울을 가슴에(화순 대곡리, 국보 143).
- **진한·사로** — 편두(이마를 납작하게 — 褊頭) [시대] · 남녀 문신(男女近倭 亦文身 — 진한·변한) [시대] · 덩이쇠·쇠도끼 날을 깐 군장 무덤(사라리 130호) · 出자 금관 [늦음, 왕만].
- **변한·가야** — 키가 크고 긴 머리, 옷이 매우 깨끗, 폭 넓은 고운 베(其人形皆大 衣服絜清 長髮 亦作廣幅細布) [시대] · 쇠가 돈 — 덩이쇠 꾸러미 [시대] · 장례에 큰 새 깃(以大鳥羽送死) — 무녀·제사장 소품 · 수정·유리구슬과 곡옥, 거울(김해 양동리) · 세로 철판 갑옷·목가리개·깃꽂이 투구 [4세기] · 찰갑과 말갑옷 [늦음] · 민고리자루 큰칼·투겁창 [시대].
- **고구려** — 큰 가: 천으로 묶은 책(幘) · 작은 가: 고깔 모양 절풍(折風) [시대] · 조우관(새 깃 둘) · 엉덩이 길이 저고리에 묶는 띠, 깃·소매·단에 다른 색 선, 발목을 오므린 통 넓은 바지 · 점무늬 옷감(무용총) · 여인: 바닥까지 끌리는 색동 주름치마(수산리), 얹은머리·고리 틀어올림(신분 높음)·처녀는 풀어 내림 · 볼연지·붉은 입술·이마의 붉은 점 · 맥궁(出好弓 所謂貊弓) [시대] · 노래와 춤, 밤에 남녀가 모임.
- **부여** — **흰 옷, 넓은 소매**(衣尚白 白布大袂) — 넓은 소매가 맞는 유일한 무리 · 대인은 여우·흰 원숭이·검은 담비 갖옷, 금은으로 꾸민 모자 · 집집마다 갑옷과 무기 · 마가·우가·저가·구가 (깃발 무늬).
- **옥저·동예** — 옥저는 고구려와 옷이 같고 맥포·물고기·소금·해산물을 바침 · 동예: 남녀 모두 둥근 깃(曲領), 사내는 너비 몇 치의 은꽃 장식(男子擊銀花) · 단궁·반어피(물범 가죽)·표범 가죽·과하마.
- **탐라(주호)** — 작은 키, 머리를 깎음, 가죽옷, 윗도리만(其衣有上無下) · 소·돼지를 침.

**이렇게 읽히면 버린다 → 대신**
| 피할 것 | 대신 |
|---|---|
| 한푸의 넓게 흐르는 소매 | 오므린 좁은 소매 (부여 흰 옷만 예외) |
| 긴 옷을 넓고 뻣뻣한 허리띠로 여밈(기모노·한푸 꼴) | 엉덩이 길이 저고리 + 가는 묶는 띠 + 바지나 주름치마 |
| 중국 비녀·보요·봉황관 | 구슬 꿰미, 머리에 감은 땋은 머리, 맨 상투 |
| 오비·기모노 실루엣·게타 | 가죽 신, 발목 묶은 바지 |
| 사무라이 오요로이·초승달 투구 | 리벳 박은 세로 철판 갑옷, 민 쇠투구 |
| 카타나·휜 칼 | 곧은 고리자루 쇠칼 |
| 일본 긴 비대칭 활 | 짧게 휜 맥궁 |
| 기와 처마·탑 | 초가·고상 창고·목책·흙담 |
| 노·가부키·게이샤의 흰 얼굴 | 맨 살결, 볼연지, 붉은 입술, 이마 점 |
| 중국 관리 관·사모 | 절풍·조우관·맨 상투 |
| 용 무늬 비단 | 삼베·명주, 점무늬, 다른 색 선, 꿰맨 구슬 |
| 빨간 해 동그라미·햇살 | 새·사슴뿔·나무 무늬 |
| 벚꽃 (2026-10-19 사냥대회 판에 섞여 나옴) | 진달래 — 짙은 자홍, 긴 꽃술, 마른 가지 |

확인 못 한 것: 벽화 옷의 왼쪽 여밈 · 사라리 130호의 정확한 유물 · 마한 말 모양 띠고리의 출전 — 학계 통설로만 쓴다.

## 1. 첫날 다섯 장 (우선순위 순)

### ① 장수 초상 열여섯 (4×4) — 화풍의 기준이 되는 장

```
Generate one square 1024x1024 image: a sheet of SIXTEEN character portraits in a strict, perfectly even
4x4 grid (each cell exactly one quarter of the width and height, no gutters, no grid lines, no borders,
no text, no labels). Every cell: the same plain very dark blue-grey background (#1c2129), one person shown
head and shoulders, facing the viewer, slightly turned, centered. Setting: southern Korean peninsula,
2nd-3rd century AD (Samhan / Proto-Three-Kingdoms period) - NOT Joseon, NOT Goryeo: no gat hats, no
hanbok robes, no tiled roofs. Clothing is undyed hemp and dyed linen, leather, fur collars; hair in a top
knot or loose long hair; ornaments are glass and jade bead necklaces, large bird feathers, bronze or
iron hairpins. Style: hand-painted stylized game portrait art, bold thick brush strokes, strong dark
outlines, warm dramatic side light, high contrast, must stay readable at 64 pixels. Same brush and
lighting in all sixteen. Cells, left to right, top to bottom:
(1) old master blacksmith, soot on face, burn scars, leather apron collar, grey top knot, kind eyes.
(2) young lean archer, sharp eyes, reed-colored headband, bowstring callus visible on raised hand.
(3) young shaman priestess, long black hair, bronze bells and a jade bead necklace, calm piercing eyes.
(4) sea-faring trader, sun-dark skin, tattoos on cheeks and neck, rope necklace with a cowrie shell.
(5) burly spearman, flat elongated forehead (head-binding custom), broad face, wooden shield rim behind.
(6) grizzled old chieftain, long white beard, two or three long single crane and pheasant feathers stuck
upright into his grey top knot (ancient Korean, NOT a Native American war bonnet), heavy bead necklace.
(7) scheming advisor, thin mustache, narrow eyes, Goguryeo-mural jo-ugwan cap with two bird feathers and a
dotted jacket with colored collar bands (NOT a Chinese scholar robe), holding a wooden tally near his chin.
(8) laughing drunk warrior, red cheeks, a gourd cup, messy top knot.
(9) cautious veteran, scarred eyebrow, leather cap, wary sideways glance.
(10) woman warrior, braided hair, leather vest, iron dagger hilt at the shoulder.
(11) frightened young farmer conscript, hemp tunic, too-big spear.
(12) proud northern horseman (Buyeo), fur hat, fur collar, high cheekbones.
(13) Nangnang commandery official, Han-style black cap (jeok), silk collar, cold expression.
(14) Wa (ancient Japanese) sailor, short hair, simple wrap cloth, tattooed arms.
(15) captive with bound wrists raised into view, defiant glare, torn clothes.
(16) child noble heir, about ten years old, bead necklace too big for him, curious eyes.
```

### ①-2 영물 열둘 (4×4 중 12칸 + 하늘의 알 · 투명) — 팰 자리라 첫날에 넣는다

```
Great. Now a sheet in EXACTLY the same painting style: one square 1024x1024 image, SIXTEEN creatures from
KOREAN folklore and Korean founding myths in a strict, perfectly even 4x4 grid (no gutters, no lines, no
text), fully TRANSPARENT background (real alpha), each drawn FROM THE SIDE (2D side-scroller view), whole
body visible, body centered in the cell, BIG and CHUNKY, readable at 48 pixels, each with a soft colored
rim glow by rarity. Korean folk style - NOT Chinese, NOT Japanese yokai.
(1) fat lucky toad, warm brown. (2) magpie, black and white. (3) pure white deer with small antlers, pale
glow. (4) golden boar with shining bristles, gold. (5) big brown bear standing up, mugwort sprig in its
mouth. (6) Korean dokkaebi goblin with a spiked wooden club, mischievous grin, blue glow. (7) imugi - a
huge wingless water serpent rising from a river, teal glow. (8) bulgasari - iron-eating beast, bear-like
body with an elephant trunk, rhino eyes, iron scales, sparks. (9) nine-tailed fox, white, violet glow.
(10) sangun - the mountain lord tiger, great striped tiger with a calm sacred stare, red glow.
(11) gangcheori - a drought dragon of dry cracked earth and heat haze, orange. (12) jangseung - a carved
wooden village guardian post with a fierce face (standing, no legs). (13) samjogo - the three-legged
sun crow inside a red sun disc, gold-red. (14) Korean sea dragon (yong) coiling through waves, deep blue.
(15) Korean grim reaper (jeoseung saja) in a black gat-less hood and robe, pale face (folk version).
(16) six golden eggs inside an open golden box wrapped in red cloth, descending on a purple rope from the
sky (King Suro's birth myth), radiant gold.
```

### ①-3 여인 열여섯 (4×4, 판 위) — 0-1 · 0-2 를 따르는 첫 장

```
Generate one square 1024x1024 image: a sheet of SIXTEEN portraits of striking ADULT WOMEN in a strict,
perfectly even 4x4 grid (no gutters, no grid lines, no borders, no text, no labels). Every cell: the same
plain very dark blue-grey background (#1c2129), head and shoulders, facing the viewer, slightly turned,
centered. They are heroines of ancient KOREA - the kingdoms of Buyeo, Goguryeo, Baekje, Silla, Gaya and the
Samhan tribes. Make them instantly readable as KOREAN, not Chinese, not Japanese. Eye-catching and
glamorous through design: bold red lips and sharp eye makeup, gleaming gold ornaments, confident fierce
expressions, fitted leather, tattoos on bare shoulders, scars - tasteful, no nudity. Style: hand-painted
semi-realistic game portrait art, bold thick brush strokes, strong dark outlines, warm dramatic side light,
high contrast, readable at 64 pixels, same brush and lighting in all sixteen.
(1) Silla princess wearing the famous Silla gold crown (upright tree-and-antler shaped gold plates hung
with comma-shaped green jade gogok), thick gold hoop earrings, cold proud gaze.
(2) Goguryeo noble lady from the tomb murals: hair coiled high on her head, white jacket covered with
red polka dots, contrasting colored bands at the collar, small smile.
(3) Goguryeo horse archer woman, jo-ugwan cap with two upright pheasant feathers, bow over her shoulder,
wind in her hair.
(4) Gaya swordswoman in a dark iron crested helmet and iron plate armor collar, iron sword, battle scar
across her cheek.
(5) Baekje queen with a gilt-bronze openwork crown and lotus ornaments, elegant, dangerous eyes.
(6) Buyeo huntress dressed all in white with a white fur collar and fur hat, sharp cheekbones.
(7) Samhan shaman queen, long loose black hair, bronze mirror on her chest, bronze bells, red face paint
stripes, trance gaze.
(8) Mahan tattooed warrior woman, top knot, blue tattoos on bare shoulders and arms, leather strap,
spear, fierce grin.
(9) Byeonhan iron smith woman, soot on cheek, leather apron, arms crossed holding tongs, smirk.
(10) sea pirate captain woman of the southern coast, sun-dark skin, tattoos, rope and cowrie shells,
salt-wet hair, laughing.
(11) assassin in dark hemp, half of the face hidden by a cloth, one bright eye, iron dagger.
(12) Goguryeo dancer from the Muyongchong mural, long flowing sleeves, polka-dot jacket, striped
pleated skirt, mid-turn.
(13) young archer girl (adult, about twenty), reed headband, freckles, determined.
(14) spy hiding among the guests of the chieftain's hall, glass bead necklaces, half-lidded smile, hairpin of bronze.
(15) captive foreign noble woman with a defiant glare, bound wrists raised into view (adult).
(16) old matriarch of a clan, white hair in a top knot, jade beads, piercing wise eyes.
NOT Chinese: no hanfu cross-collar silk robes with huge sleeves, no Chinese crowns, no Chinese characters.
NOT Japanese: no kimono.
```

> (12) 장승 · (6) 도깨비 · (9) 구미호 · (15) 저승사자는 **기존 보스 그림이 있다** — 화풍을 맞추려 다시 받되, 안 맞으면 기존 것을 쓴다.
> 이 장을 받는 날은 ⑤(저격 거점 소품)를 둘째 날로 미룬다 — 하루 다섯 장.

### ② 지도 기호 열여섯 (4×4, 투명)

```
Great. Now a second sheet in EXACTLY the same painting style and brush: one square 1024x1024 image,
SIXTEEN map icons for an old ink-on-paper strategy map, in a strict, perfectly even 4x4 grid (no gutters,
no grid lines, no text). fully TRANSPARENT background (real alpha). Each icon seen from a high
three-quarter angle, BIG and CHUNKY, centered, filling about 75% of its cell, readable at 32 pixels.
Colors muted ink-and-wash with one accent color each. Period: 2nd-3rd century southern Korea (thatched
roofs, log palisades, earth walls - no tiled roofs, no stone castles).
(1) capital town: cluster of thatched round-roof houses inside a log palisade, red accent banner.
(2) small village: three thatched pit-houses. (3) sacred sodo: one huge tree hung with bronze bells and a
drum. (4) iron mine: red-earth hill with a smoking clay furnace. (5) harbor: wooden jetty with a small
boat. (6) hill fort: earthen rampart ring on a hilltop. (7) log palisade segment with a gate.
(8) river ford: shallow river with stepping stones. (9) tall reed marsh. (10) pine forest.
(11) mountain pass between two peaks. (12) tidal mud flat with a crab. (13) morning fog over a valley.
(14) expedition banner on a pole with a small boat beneath. (15) army token: a cluster of spear tips and
a war banner. (16) granary: raised thatched storehouse on stilts with grain sacks.
```

### ③ 자원 · 판정 아이콘 열여섯 (4×4, 투명)

```
Great. A third sheet in EXACTLY the same painting style: one square 1024x1024 image, SIXTEEN UI icons in
a strict, perfectly even 4x4 grid (no gutters, no lines, no text), fully TRANSPARENT background (real
alpha), BIG and CHUNKY, centered, readable at 24 pixels, each with a soft colored rim glow.
(1) sheaf of grain, gold glow. (2) stack of flat iron axe-shaped plates tied with cord (ancient iron
currency), steel-grey glow. (3) thatched house with smoke (households), warm brown. (4) jade and glass
bead necklace (prestige goods), green. (5) crowd of small heads (people's mood), rose. (6) watchful eye
with a torch (alertness), red. (7) tipped wine cup (carelessness), amber. (8) coiled rope with a knot
(capture), tan. (9) cracked oracle bone with fire marks (persuasion / divination), bone-white.
(10) two clasped hands with a red thread (marriage / bloodline), crimson. (11) small boat with a banner
(expedition), sea-blue. (12) war drum, deep red. (13) burning thatched roof (fire arrow on granary),
orange. (14) broken arrow (failure), grey. (15) bow with an arrow aimed at a leg (snipe: hobble), teal.
(16) laurel of five colored threads - black, white, blue, yellow, red (rarity), multicolor.
```

### ④ 사건 삽화 넷 (2×2, 판 위)

```
Great. A fourth image in EXACTLY the same painting style: one wide 1536x1024 image split into FOUR equal
illustration panels in a strict 2x2 grid (no gutters, no text). Each panel is a small dramatic scene,
painterly, cinematic light, same 2nd-3rd century southern Korean setting (thatched houses, palisades,
hemp clothes, no tiled roofs). (1) SKY: drought - cracked rice paddy under a blood-red sun, villagers
looking up. (2) PEOPLE: two warriors arguing in a chieftain's hall around a fire, the chief between them.
(3) OUTSIDE: a Han commandery envoy in black cap arriving by boat at a wooden jetty, attendants carrying
lacquer boxes. (4) SODO: night, a huge sacred tree hung with bells and a drum, a fugitive running toward
it, torches chasing behind.
```

### ⑤ 저격 거점 소품 열여섯 (4×4, 투명) — 판 안에 놓을 것

```
Great. A fifth sheet in EXACTLY the same painting style: one square 1024x1024 image, SIXTEEN side-view
game props in a strict, perfectly even 4x4 grid (no gutters, no lines, no text), fully TRANSPARENT
background (real alpha), drawn FROM THE SIDE (2D side-scroller view), standing on the bottom of the cell,
BIG and CHUNKY, readable at 48 pixels. 2nd-3rd century southern Korea.
(1) wooden watchtower on four log legs. (2) log palisade segment. (3) palisade gate. (4) raised thatched
granary on stilts. (5) the same granary burning. (6) war drum on a wooden stand. (7) the same drum torn.
(8) tall war banner of hemp cloth. (9) the same banner broken. (10) stack of rice-straw bundles (cover).
(11) earthen mound with a wooden fence (cover). (12) reed clump (cover). (13) bronze bell tree branch.
(14) wooden ladder. (15) campfire with cooking pot. (16) round wooden shield leaning on a spear.
```

## 2. 둘째 날 이후

| 순서 | 무엇 | 꼴 | 메모 |
|---|---|---|---|
| ⑥ | **적장 몸** 넷 — 읍차·살해·험측·신지 (칭호마다 장식이 커진다) | 2×2 투명, 옆모습, **팔 없는 몸** | 판정이 있는 그림 — 정면·대칭 규칙은 보스 문법을 따른다 (memory: 판정 그림). 팔·활은 절차 |
| ⑦ | 적장 쓰러짐 컷: 다리 맞고 넘어짐 · 기어감 2컷 · 쓰러짐 | 4×1 투명 | "발 묶음"이 이 판의 가장 중요한 연출 (SNIPE §5) |
| ⑧ | **전장 부대 토큰**: 창병 · 궁수 · 방패병 · 장창병 · 기병(북방) · 쇠뇌병(군현) · 수군 · 장수 깃발 | 4×2 투명, 위에서 비스듬히 | BATTLE.md |
| ⑨ | 초상 열여섯 둘째 장 (나이·성별·출신을 넓혀서) | 4×4 | ①과 같은 대화 |
| ⑩ | 지도 종이 바탕 — 변한 지형(낙동강 · 고김해만 · 남해 포구 · 남강) | 1536×1024 | 제미나이가 맞다 (투명 불필요, 넓은 그림) |
| ⑪ | 계절의 지도 넷 (같은 땅의 봄·여름 장마·가을·겨울 결빙) | 제미나이 "the SAME landscape in another season" | |
| ⑫ | 연출: 포승줄 흔들림 3컷 · 점괘 뼈 갈라짐 · 원정대 깃발 귀환 | 4×2 투명 | SYSTEMS §15-3 |

## 2-1. 받은 것 (2026-10-17) — 자세한 출처는 `assets_src/realm/출처.txt`

| 장 | 화구 | 상태 |
|---|---|---|
| ① 초상 | 챗지피티 | 받음 · (7) 책사 · (13) 낙랑 관리가 중국 사극 옷 — 0-1 이후 고친 프롬프트로 **다시** |
| ①-2 영물 | 챗지피티 | 받음 · 용 셋(이무기·용·강철이)이 중국식 → 제미나이로 **고구려 청룡 · 뿔 없는 이무기 · 강철이(불 말) · 웅녀** 넷을 따로 받음 |
| ①-3 여인 | 제미나이 | **본판: `heroines/bust/` 열여섯 — 한 장에 한 명, 명치까지, 얼굴·체형 제각각** (0-2·0-3). 머리판 01~07 은 `heroines/head/`. 앞선 격자판 두 벌(v1 만화풍 · 미인형 한 얼굴)도 남겨 둠 |
| ② 지도 기호 | 챗지피티 | 받음 (두 시안 중 둘째) |
| ③ 아이콘 | 제미나이 | 받음 (마젠타 → key-png) · 화풍이 만화풍이라 챗지피티로 다시 받을 후보 |
| ④ 삽화 | 제미나이 | 받음 · 0-1·0-2 반영판(여족장 · 창 든 여전사 · 당산나무 금줄) |
| ⑥ 적장 몸 | 제미나이 (10-18 저녁) | **받음** — 읍차·살해·험측·신지, 한 사람씩 새 대화 · 옆모습 왼쪽 · 팔 없음 · 발끝까지 → `cut/chief-*` |
| ⑦ 쓰러짐 컷 | 제미나이 | **받음** — 험측이 다리에 화살 → 비틀 · 한 무릎 · 기어감 · 엎어짐 → `cut/fall-*` |
| 전설 여인 | 제미나이 | L5~L10 더함: 세오녀 · 정견모주 · 알영 · 낙랑공주(자명고) · 웅녀 · 평강공주 |
| 여인 명치판 | 제미나이 | 17~22 더함: 마한 진주잡이 · 진한 소금 과부 · 부여 공주 · 가야 대장장이 딸 · 백제 무희 · 동예 범 사냥꾼 |
| 고구려 산성 · 병사 넷 | 제미나이 | `bg-goguryeo-sanseong` (만리장성 아님) · 기수(글자 없는 깃발)·여궁수·거한·노병 → `cut/soldier-*` · 13 백제 장군 다시 받음 |

**받는 법 덧붙임 (10-18 저녁):** 팔 없는 판정 그림은 **격자로 시키면 3/4 몸에 팔이 붙는다** — 한 사람씩 새 대화로
*"strict side profile facing LEFT (we see one eye) · WITHOUT ARMS · small in the frame with wide margin"* 이면 넷이 같은 문법으로 나온다.
제미나이는 한 대화에서 여러 장을 이어 그리면 "Creating your image" 에서 자주 멈춘다 — 새 대화가 낫다.

**다음에 할 것:** ① 남자 장수도 0-3 대로 — **한 명씩, 명치까지, 체형 제각각**(마른·근육·거구·배 나온 …), 0-1 어휘로 (책사·낙랑 관리 고침).
제미나이로 바로 된다. 챗지피티(10-18 21:05 이후, 다섯 장)는 ③ 아이콘 다시 → ⑤ 소품 → 형이 고른 여인 몇을 챗지피티 붓질로 다시.
"미인형" 여인 프롬프트 원문은 `assets_src/realm/출처.txt` — 형이 "안이쁜데" 한 뒤 바꾼 화풍이고, **형이 아직 결과를 안 봤다.**
핵심 구절: *high-end Korean MMORPG / gacha game character illustration - gorgeous idealized faces, flawless luminous skin, large
expressive almond eyes … like K-drama heroines* + 칸마다 **얼굴형·고개 각도·표정을 다르게** (안 그러면 열여섯이 한 얼굴이 된다).

## 3. 받기와 정리

- 받은 날짜·대화·프롬프트 번호를 `assets_src/realm/출처.txt` 에 적는다 (기존 `public/sprites/출처.txt` 와 같은 방식).
- 받으면 바로 `tools/peek-png.mjs` 로 **투명 픽셀 %** — 0% 면 체크무늬를 그려 넣은 것이다 → 마젠타 바탕으로 다시 (ASSETS §9 "그림 모델의 거짓말").
- 한도에 막히면 멈추지 않는다 — 둘째 날 목록의 ⑩·⑪(넓은 그림)은 **제미나이**로 먼저 굽는다.
- 받기 손버릇 (2026-10-17): 챗지피티는 `fetch(img.src)` → `a.download`. 제미나이는 "원본 크기 이미지 다운로드" 버튼이
  **실제 클릭**에만 반응하고 한 대화의 둘째 그림부터는 자주 안 받아진다 → 화면의 그림을 캔버스에 그려 `toBlob('image/png')` 로 받는다
  (정사각은 원본도 1024 라 손해가 없다. 넓은 그림은 원본 1264 > 화면 1024 — 버튼으로).
- 격자 자르기 뒤에는 `node tools/keep-main.mjs cut/<접두>*.png` — 옆 칸 부스러기를 지운다. 넓은 삽화는 slice-grid 가 정사각으로 잘라 양옆을 잃으니 등분으로 자른다.
