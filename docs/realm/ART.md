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
(6) grizzled old chieftain, long white beard, huge bird-feather headdress, heavy bead necklace.
(7) scheming advisor, thin mustache, narrow eyes, holding a bamboo writing slip near his chin.
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
| ⑧ | **전장 부대 토큰**: 창수 · 궁수 · 방패수 · 긴창수 · 기병(북방) · 쇠뇌수(군현) · 배꾼 · 장수 깃발 | 4×2 투명, 위에서 비스듬히 | BATTLE.md |
| ⑨ | 초상 열여섯 둘째 장 (나이·성별·출신을 넓혀서) | 4×4 | ①과 같은 대화 |
| ⑩ | 지도 종이 바탕 — 변한 지형(낙동강 · 고김해만 · 남해 포구 · 남강) | 1536×1024 | 제미나이가 맞다 (투명 불필요, 넓은 그림) |
| ⑪ | 계절의 지도 넷 (같은 땅의 봄·여름 장마·가을·겨울 결빙) | 제미나이 "the SAME landscape in another season" | |
| ⑫ | 연출: 포승줄 흔들림 3컷 · 점괘 뼈 갈라짐 · 원정대 깃발 귀환 | 4×2 투명 | SYSTEMS §15-3 |

## 3. 받기와 정리

- 받은 날짜·대화·프롬프트 번호를 `assets_src/realm/출처.txt` 에 적는다 (기존 `public/sprites/출처.txt` 와 같은 방식).
- 받으면 바로 `tools/peek-png.mjs` 로 **투명 픽셀 %** — 0% 면 체크무늬를 그려 넣은 것이다 → 마젠타 바탕으로 다시 (ASSETS §9 "그림 모델의 거짓말").
- 한도에 막히면 멈추지 않는다 — 둘째 날 목록의 ⑩·⑪(넓은 그림)은 **제미나이**로 먼저 굽는다.
