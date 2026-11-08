# 장수 기술 장면 (컷인) — 설계와 구울 그림

형 11-01: "전투할때 영웅의 비기연출시 비기별로 영웅 애니메이션이나 이미지 샤샤샤샤샷 하는 연출 필요하지 않냐? 명궁의 한발? 이런기술 쓰는데 화면이 어두워지면서 장수만 강조되고
활을 강하게 당겼다 쏘는 그런 모습이 있어야 와 내가 기술을 썼다 하고 느껴질거임 … 진짜 이건 이기술들 연출 하나로 갓겜이다 소리 나오게."
그리고: "기술연출은 기술마다 새롭게 고민해야하고 절대 싸구려 svg 로 대충 때우려 들지마. 제미나이 활용해서 이펙트 필요한 에셋들은 다 만들어라."

코드: `src/ui/realm/skillfx.ts` (장면표 `SKILL_SEQ` · 엔진 `skillCutHtml` · 키프레임 `SKFX_CSS`) · 부르는 곳 `battlefield.ts` draw() · 시간 손잡이 `params.ts` `warSk*`.
그림이 아직 없으면 그 그림만 빠지고 나머지(어두워짐 · 초상 · 기술 이름 · 이미 있는 먼지·창·화살·방패·밧줄)는 그대로 돈다. **깨진 그림 표시는 안 뜬다** (preloadSkillFx 가 미리 불러 본 그림만 얹는다).
그림 파일을 아래 이름 그대로 `public/realm/fx/skill/…` 에 넣으면 코드 손댈 것 없이 장면에 들어간다.

## 0. 다른 게임은 어떻게 하나 (참고)

- 파이어엠블렘 인게이지·히어로즈의 스킬 컷인: 화면이 어두워지고 → 초상이 비스듬한 띠에 실려 미끄러져 들고 → 기술 이름 → 본 동작. 0.8~1.5초.
- 붕괴: 스타레일 필살기: 바람 줄기(스피드 라인) + 캐릭터 클로즈업 + 기술마다 고유 동작 한 박자 + 맞는 순간 멈칫(히트스톱) + 번쩍.
- 페르소나 총공격: 먹·잉크 같은 강한 실루엣과 굵은 글씨로 "기술 이름이 곧 그림".
- 삼국지 전략판 전법: 전법 이름이 붓글씨 띠로 떠오르고, 효과는 전장 위의 작은 이펙트로.
- 우리 것: 띠·이름은 먹과 붓(삼한 결) · 기술마다 손에 쥔 물건 하나(맥궁 · 방울 · 북 · 징 · 둥근 방패 · 올가미 …)를 클로즈업해서 "그 기술"이 그림 한 장으로 읽히게.

## 1. 뼈대 — 모든 장면이 같다 (ms · 빠르기 warSkSpeed=1 기준)

| 때 | 무엇 | 그림 | 움직임 |
|---|---|---|---|
| 0 | 화면이 어두워진다 (warSkDim 0.72) | (단색 막 · 그림 없음) | opacity 한 번 |
| 0~640 | 바람 줄기가 위 띠 자리를 오른쪽→왼쪽으로 쓸고 간다 | common/speedlines.png | streak |
| 0~끝 | 먹 띠가 오른쪽에서 휙 들어와 머문다 (위 띠: 화면 높이 31% 자리) | common/ink-band.png | slideR |
| 60~ | 장수 초상(bust · 남색 민무늬 판 · 얼굴 가림막 fx/mask-bust.png)이 왼쪽에서 미끄러져 든다 | bust/*.jpg (이미 있음) | slideL |
| 140~ | 기술 이름이 큰 붓글씨로, 그 뒤에 붉은 먹 붓 자국 · 밑에 장수 이름 | common/title-brush.png | slideR |
| 기술마다 | 몸짓 (아래 2장) — 위 띠 밑 전장(화면 높이 50~85%)에서. 우리는 늘 왼쪽, 적은 오른쪽 | 기술마다 | 아래 |
| hit | 맞는 순간: 초상과 이름이 두 번 떤다(warSkHitMs 90ms × 2 · 히트스톱) + 번쩍 + 먹 튐 + 불티 | common/flash.png · ink-burst.png · spark.png | flash · burst · spray |
| 1550 | 걷힌다 (warSkEndMs) · 누르면 언제든 바로 걷힌다 | | |

- 첫 깃발 연출은 warBeatCut(1.9초) 뒤에 시작하니 장면은 그 안에서 끝난다.
- 소리: 0.26초 휙(cmd_art) · 기술마다 아래 소리 · 장수 외침(voice.ts artVoicePath)은 그대로 0.18초에.
- 움직임은 그림 한 장 한 장의 transform·opacity 뿐 (폰 그래픽 한도) · 여러 장은 낱낱이(불티·먼지·창은 한 장 그림을 여러 번).
- 동작 줄이기(prefers-reduced-motion): 어두워진 화면에 초상과 이름만 1.55초.
- 그래픽 낮음: 여러 장 묶음(.wsk-n)은 quality.ts 가 솎는다.

## 2. 기술마다 (모두 우리가 왼쪽)

### 명궁의 한 발 (snipe) — "당겼다, 떨었다, 놓았다, 꽂혔다"
| ms | 무엇 | 그림 |
|---|---|---|
| 420 | 맥궁을 쥔 손이 화면 왼쪽 아래에 크게 들어온다 | snipe/bow-draw.png (drawshoot) |
| 520~880 | 시위를 끝까지 당겨 활이 부르르 떤다 (점점 커지며 떨림) · 소리: 쇠 스치는 소리 | ↑ |
| 880 | 놓는다 — 활이 뒤로 튕긴다 · 소리: 화살 | ↑ |
| 900~1130 | 빛 꼬리를 단 화살 한 대가 전장을 왼쪽→오른쪽으로 가로지른다 | snipe/arrow-streak.png (flyR) |
| 1170 | 적장 자리(오른쪽 80%)에 꽂힘 — 히트스톱 · 번쩍 · 먹 튐 · 불티 여덟 · 소리: 필살 | common/flash · ink-burst · spark |

### 진중 굿 (rite) — "방울이 울리고 혼불이 오른다"
| 400 | 무당의 방울과 부채가 왼쪽에 떠올라 좌우로 흔들린다 · 소리: 방울 | rite/shaman-bells.png (jingle) |
| 480~1480 | 우리 군사들 사이에서 푸른 혼불 열 개가 하나씩 피어올라 하늘로 오른다 · 소리: 대금(tap_rite) | rite/spirit-flame.png ×10 (rise) |
| 1010 | 우리 진 위가 환하게 번쩍 — 사기 오름 · 소리: 함성 | common/flash |

### 항복 권유 (sway) — "외침이 건너가고, 창이 떨어지고, 흰 깃발"
| 400~1000 | 외침의 울림 세 겹이 우리 쪽에서 적 쪽으로 건너간다 · 소리: 함성 | common/shout-wave.png ×3 (wave) |
| 820 | 적 진 위에서 창 여섯 자루가 하나씩 손을 떠나 땅에 떨어진다 · 소리: 쇠붙이 떨어짐 | spear.png (이미 있음) ×6 (drop) |
| 1000 | 적 진 뒤에서 낡은 흰 천 깃발이 솟는다 · 소리: 방울 | sway/white-flag.png (flagup) |

### 버텨라 (stand) — "방패벽이 쾅, 화살이 튕긴다"
| 440 | 둥근 나무 방패가 겹친 한 줄 벽이 위에서 쾅 내려와 우리 진 앞에 박힌다 | stand/shield-wall.png (slam) |
| 600 | 히트스톱 · 발치에서 흙먼지 넷 · 소리: 쇠판 「탱」 | dust.png (이미 있음) ×4 (puff) |
| 700~1100 | 날아든 화살 여섯 대가 방패에 맞고 위로 튕겨 나간다 · 불티 · 소리: 「탱」 | arrow.png (이미 있음) ×6 (deflect) · common/spark |

### 샛길 기습 (ambush) — "갈대가 갈라지고, 날랜 군사가 뛰어든다"
| 360 | 앞쪽 갈대 숲이 화면 아래를 덮었다가 두 쪽으로 갈라진다 | ambush/reeds.png ×2 (하나는 뒤집어서 · partL) |
| 640 | 한국식 날랜 군사 셋(저고리·바지·대님·두건 · 짧은 창 · 닌자 금지)이 갈대 사이에서 뛰어올라 적 궁수에게 덮친다 · 소리: 돌격 | ambush/raider.png ×3 (leap) |
| 900 | 칼금 두 줄이 엇갈린다 · 소리: 칼 | common/slash.png ×2 (slash) |
| 980 | 히트스톱 · 번쩍 · 먹 튐 · 소리: 필살 | common/flash · ink-burst · spark |

### 선봉에 선다 (vanguard) — "창끝이 바람을 가른다"
| 480 | 전장 높이로 바람 줄기 한 번 더 | common/speedlines.png (streak) |
| 560 | 장수의 긴 창끝이 화면 왼쪽 밖에서 오른쪽으로 내질러진다 (늘어났다 제자리) · 소리: 함성 | vanguard/spear-thrust.png (thrust) |
| 900 | 맞부딪는 자리(66%) 히트스톱 · 번쩍 · 먹 튐 · 흙먼지 셋 · 소리: 필살 | common/flash · ink-burst · spark · dust.png |

### 거짓 퇴각 (feint) — "물러나는 척, 그리고 함정"
| 400 | 흙먼지가 왼쪽으로 끌려가며 우리가 물러나는 듯 보인다 · 소리: 물러남 | dust.png ×4 (trailL) |
| 860 | 쫓아온 자리에서 깎은 말뚝 함정이 땅에서 확 솟는다 · 소리: 쇠붙이 | feint/trap-stakes.png (spring) |
| 960~1000 | 칼금 두 줄 엇갈림 · 히트스톱 · 번쩍 · 소리: 필살 | common/slash ×2 · flash · ink-burst · spark |

### 진을 다잡는다 (order) — "북 세 번, 방패가 착착"
| 380 | 큰 북(북채 둘)이 왼쪽에 떠오르고 세 번 크게 울린다 (울릴 때마다 부풀었다 돌아온다) | order/war-drum.png (beat) |
| 500 · 700 · 900 | 울림마다 북에서 울림 물결 · 소리: 북 셋 | common/shout-wave.png ×3 (wave) |
| 720~ | 우리 진 발치에 방패 다섯이 하나씩 내려와 한 줄로 선다 · 소리: 「탱」 | shield.png (이미 있음) ×5 (snap) |

### 큰 외침 (shout) — "울림이 화면을 민다"
| 380 | 초상 자리에서 큰 울림 네 겹이 퍼진다 · 소리: 함성 | common/shout-wave.png ×4 (wave) |
| 420 | 불티 열 개가 사방으로 튄다 (히트스톱) | common/spark ×10 (spray) |
| 600 | 앞의 흙먼지가 적 쪽으로 밀려난다 · 소리: 북 | dust.png ×4 (puff) |

### 장수 겨루기 (duel) — "칼날이 엇갈린다"
| 500 | 환두대도와 창날이 화면 가운데서 크게 엇갈린 채 들이닥친다 · 소리: 칼 | duel/crossed-blades.png (clash) |
| 720 | 히트스톱 · 번쩍 · 먹 튐 · 불티 · 소리: 필살 | common/flash · ink-burst · spark |

### 적장 사로잡기 (capture) — "올가미가 날아간다"
| 480 | 삼 밧줄 올가미가 왼쪽에서 빙글 돌며 날아가 적장 자리(70%)에서 조여든다 · 소리: 휙 | capture/lasso.png (lasso) |
| 820 | 감긴 밧줄 · 흙먼지 둘 · 소리: 사로잡기 | rope.png (이미 있음) (pop) · dust.png ×2 |

### 물러나기 (retreat) — "징이 울린다"
| 380 | 놋쇠 징(징채)이 왼쪽에 떠올라 울린다 · 소리: 종 | retreat/jing-gong.png (beat) |
| 520~ | 흙먼지 다섯이 왼쪽으로 끌려간다 · 소리: 물러남 | dust.png ×5 (trailL) |

맡기기(자동전투)의 「제게 맡겨 주시옵소서!」 장면은 기술이 아니라 꾸밈 없는 초상 띠로 둔다 (battlefield.ts cutHtml).

## 3. 구울 그림 — 22장

공통 말 (모든 프롬프트 끝에 붙인다): `Single isolated object only, centered, nothing else in frame. No text, no letters, no watermark, no logo, no border. No sun disc, no radiating sun rays, no rising-sun pattern. Painterly hand-painted game VFX look, Korean proto-Three-Kingdoms (Samhan, 1st–3rd century) style, not Japanese, not Chinese.`

굽는 법:
- **검은 바탕(#000) = 빛 효과** → `node tools/black-to-alpha.mjs <받은.png> public/realm/fx/skill/<경로> <크기> 12 gem` (밝기가 곧 투명도 · 끝 gem 은 제미나이 별 표 지우기)
- **마젠타 바탕(#ff00ff) = 물건** → `node tools/key-png.mjs <받은.png> <out.png>` 뒤 크기 맞추기 (가장자리 마젠타 번짐 확인)
- 제미나이 (메모리: 사물·이펙트는 제미나이) · **사람이 든 그림(ambush/raider.png 하나)만 챗지피티** (메모리 chatgpt-people-only).
- 물건 하나 = 새 대화 (메모리 image-review-agent) · 시험 한 장 먼저 · 넣기 전 그림 검토 에이전트 · 크기 0 이면 멈춤.

### 함께 쓰는 것 (common/) — 8장

| 파일 | 크기 | 바탕 | 프롬프트 |
|---|---|---|---|
| skill/common/speedlines.png | 1024x512 | #000 | `Horizontal anime-style speed lines for a skill cut-in: many thin streaks of warm white and pale gold light rushing from right to left, dense in the middle band and thinning toward top and bottom, slight brush-ink texture on the streak edges, on a pure black #000000 background.` |
| skill/common/ink-band.png | 1024x320 | #ff00ff | `A long horizontal torn band of black sumi ink wash, like one wide brush stroke on hanji paper, ragged dry-brush edges on top and bottom, a few small gold-leaf flecks inside, slightly darker at the center, on a solid pure magenta #FF00FF background.` |
| skill/common/title-brush.png | 768x256 | #ff00ff | `One bold horizontal brush swipe of deep cinnabar red ink (Korean seal-paste red, not orange), thick and dry-brushed with splattered tail on the right, as if a calligrapher swept a big brush once, on a solid pure magenta #FF00FF background.` |
| skill/common/flash.png | 512x512 | #000 | `An irregular explosive impact flash for a game hit effect: hot white core fading to gold and amber, jagged uneven shards and a few sparks, organic and asymmetric (not a circle, not evenly spaced rays), on a pure black #000000 background.` |
| skill/common/ink-burst.png | 512x512 | #ff00ff | `A violent splash of black calligraphy ink exploding outward from the center, droplets and splatter flying, sharp ink tendrils, a little dark red mixed in, viewed flat, on a solid pure magenta #FF00FF background.` |
| skill/common/spark.png | 256x64 | #000 | `A single short streak spark from clashing iron: bright white-yellow head on the right with a fading orange tail to the left, thin and sharp, on a pure black #000000 background.` |
| skill/common/shout-wave.png | 512x512 | #000 | `A single expanding shockwave ring of air from a war cry, semi-transparent pale gold, uneven and wind-blown with brush-like breaks, thicker on one side, on a pure black #000000 background.` |
| skill/common/slash.png | 512x256 | #000 | `One single curved sword-slash arc of bright white light with a thin gold edge, crescent shaped from left to right, sharp tip, motion-smeared, on a pure black #000000 background.` |

### 기술마다 — 14장

| 파일 | 크기 | 바탕 | 프롬프트 |
|---|---|---|---|
| skill/snipe/bow-draw.png | 512x512 | #ff00ff | `Close-up of an archer's hands drawing a Korean composite horn bow (maekgung, strongly recurved, black horn and birch-bark wrapping) to full draw, one arrow with pheasant fletching nocked and pointing right, leather thumb ring, cropped at the forearms, dramatic side light, tension in the string, on a solid pure magenta #FF00FF background.` |
| skill/snipe/arrow-streak.png | 1024x128 | #000 | `A single arrow flying to the right at enormous speed: bright glowing arrowhead on the right, the shaft blurred, and a long trail of white-gold light behind it to the left, on a pure black #000000 background.` |
| skill/rite/shaman-bells.png | 384x384 | #ff00ff | `A Korean shaman's ritual bell rattle (mudang bangul, a cluster of small brass bells on a short handle) crossed with a folded red-and-blue ritual fan, colorful five-color ribbons hanging, on a solid pure magenta #FF00FF background.` |
| skill/rite/spirit-flame.png | 256x256 | #000 | `A single small floating spirit flame (will-o'-the-wisp), soft blue-white core with a pale teal outer glow, flickering upward teardrop shape, on a pure black #000000 background.` |
| skill/sway/white-flag.png | 384x384 | #ff00ff | `A tattered plain white cloth banner hanging from a rough wooden spear pole, frayed edges, a little dirt, waving slightly, no symbols on the cloth, on a solid pure magenta #FF00FF background.` |
| skill/stand/shield-wall.png | 1024x320 | #ff00ff | `A row of six overlapping round wooden shields with iron rims and center bosses, painted in faded ochre and dark red, planted side by side as a shield wall, seen from the front, slightly battered, on a solid pure magenta #FF00FF background.` |
| skill/ambush/reeds.png | 768x512 | #ff00ff | `A dense clump of tall autumn reeds and silver grass leaning to the left, golden-brown stalks and feathery tips, foreground plants only, dark at the base, on a solid pure magenta #FF00FF background.` |
| skill/ambush/raider.png (챗지피티) | 384x384 | #ff00ff | `One Korean light infantry raider from the Samhan era leaping forward to the right in mid-air, wearing a plain hemp jeogori jacket, baggy trousers tied with daenim leg ties, a cloth head wrap (not a mask), holding a short spear, determined face, dynamic pose. Not a ninja: no face mask, no katana, no shuriken, no obi. On a solid pure magenta #FF00FF background.` |
| skill/vanguard/spear-thrust.png | 1024x192 | #ff00ff | `A long war spear thrust horizontally to the right: leaf-shaped iron spearhead in sharp focus on the right, the wooden shaft motion-blurred toward the left, a red horsehair tassel below the head, on a solid pure magenta #FF00FF background.` |
| skill/feint/trap-stakes.png | 512x256 | #ff00ff | `A cluster of sharpened wooden stakes springing up out of disturbed earth at angles, pointing forward-right, fresh-cut pale wood tips, clods of dirt flying, on a solid pure magenta #FF00FF background.` |
| skill/order/war-drum.png | 384x384 | #ff00ff | `A large Korean war drum (buk) on a wooden stand, cowhide drumhead, iron-studded rim, two thick drumsticks crossed in front, slightly angled view, no painted symbols on the drumhead, on a solid pure magenta #FF00FF background.` |
| skill/duel/crossed-blades.png | 640x384 | #ff00ff | `A Korean ring-pommel sword (hwandudaedo) and a leaf-bladed spearhead clashing in an X at the center, sparks implied by bright nicks on the edges, both blades large and close-up, on a solid pure magenta #FF00FF background.` |
| skill/capture/lasso.png | 384x384 | #ff00ff | `A coiled hemp rope lasso with an open loop, thick twisted fibers, flying through the air, on a solid pure magenta #FF00FF background.` |
| skill/retreat/jing-gong.png | 384x384 | #ff00ff | `A Korean brass gong (jing) hanging from a wooden frame by a cord, with a padded mallet beside it, warm brass with hammer marks, slightly angled, on a solid pure magenta #FF00FF background.` |

이미 있는 그림을 함께 쓴다: `fx/dust.png` · `fx/spear.png` · `fx/arrow.png` · `fx/shield.png` · `fx/rope.png` · 초상 `bust/*.jpg` · 얼굴 가림막 `fx/mask-bust.png`.
(목록은 tests/realm/skillfx.test.ts 가 skillfx.ts 와 맞는지 본다.)

## 4. ★ 11-08 다음 단계 (형: "캐릭터 에셋 다 만들었으면 비기나 기술 연출도 더 고민해봐 · 챗지피티 써도 된다")

지금 빈 곳 (11-08 훑어봄):
- 비기는 **컷인뿐**이다. 컷인이 걷히면 전장에 아무 흔적이 없다 (`art`·`wake` 는 박자표에서 빠짐 · battlefield `cmdFxHtml` 에 자리 없음).
- **적 비기는 컷인이 없다** (깃발 칩과 글 한 줄뿐). 무엇에 당했는지 눈에 안 들어온다.
- **먹혔든 헛쳤든 같은 장면**이다 (항복 권유가 안 먹혀도, 거짓 퇴각이 간파당해도).
- 큰 외침은 제 그림이 없고(공용 울림만), 각성 다섯은 남의 장면을 빌려 쓴다.
- 북·호궤는 컷인이 없다.

할 차례 (작게 잘라 하나씩):
1. ✔ 11-08 **먹혔다/헛쳤다 갈림** — 맞는 순간 먹히면 붉은 **네모** 도장이 쾅(둥근 붉은 해 꼴 금지) + 금빛 불티, 헛치면 붓 자국이 먹으로 갈라지고 초상이 잿빛으로 식는다. 글 없이 그림으로.
2. **적 비기 컷인** ✔ 11-08 — 우리가 장수를 내세우지 않은 합에 적이 비기·각성기를 쓰면 초상이 오른쪽에서 · 핏빛 막 · 몸짓은 뒤집혀 우리 쪽으로 · 적이 헛치면 갈라진 먹(도장은 우리 것만).
3. ✔ 11-08 **전장 위 여운** (battlefield `artFieldFxHtml` · 컷인이 걷힌 뒤 warArtFxS 초, 실제로 바뀐 자리에 · 먹힌 것만 · 우리 것·적 것 모두):
   명궁 = 적장 머리 위로 화살이 꽂히고 휘청 · 굿 = 우리 줄 위로 혼불이 오른다 · 항복 권유 = 넘어온 적 줄 위로 흰 깃발이 하나씩 팝 ·
   버텨라·다잡기 = 우리 앞줄 앞에 방패벽 빛 줄 · 샛길 기습 = 적 활 줄 밑에서 갈대가 갈라지고 먼지 · 선봉 = 우리 앞줄에서 창끝 돌진 줄 ·
   거짓 퇴각 = 적 앞줄 발밑에 말뚝이 솟는다 · 큰 외침 = 우리 장수에서 동그란 울림 파문.
4. **제 그림 굽기** (제미나이 · 물건 하나 = 새 대화 · 초록 바탕): 큰 외침 먹 범 머리 포효 · 각성 다섯 (흙 바위 솟음 · 바람 회오리 · 불기둥 · 물 용오름 · 벼락) · 도장 · 먹 갈라짐.
5. **장수 전신 컷** (챗지피티 · 사람 그림): 이름난 장수는 초상 대신 "비기 자세" 전신 한 장 (활 만작 · 창 찌르기 · 방울 흔들기) · 남색 민무늬 판 · 한 사람마다 새 대화.
6. 북·호궤 컷인.
7. 헛쳤을 때는 「먹혔을 때만 보일 그림」(항복 권유의 흰 깃발 · 명궁의 꽂힘 번쩍)을 빼거나 바꾼다 — 지금은 갈라진 먹·잿빛 초상만 더해진다.

### 11-08 구운 것 — 먹혔다/헛쳤다 · 큰 외침의 범

| 파일 | 크기 | 바탕 | 프롬프트 |
|---|---|---|---|
| skill/common/seal-stamp.png | 384x380 | #ff00ff | `a square Korean cinnabar-red seal stamp impression (dojang) … thick square border with rough worn ink edges … abstract carved pattern of interlocking cloud scrolls and a stylized bow-and-arrow motif (NO letters) … square shape only (absolutely not round, no circle)` · 먹혔을 때 기술 이름 옆에 쾅 |
| skill/common/ink-crack.png | 768x219 | #ff00ff | `one bold horizontal brush stroke of black sumi ink that has CRACKED and SHATTERED apart in the middle … flakes and dry ink dust falling down, dull grey-black, lifeless and spent` · 헛쳤을 때 이름 위에 · 받은 원본에 같은 그림이 둘 그려져 아래 것만 잘라 씀 |
| skill/shout/roar-tiger.png | 768x432 | #000 | `the head of a roaring tiger made of glowing light-painted brush strokes … white-hot core strokes fading to pale gold and amber, side profile facing right, jaws wide open … a blast of light spraying forward out of the mouth` · 먹으로 그린 범(마젠타 바탕)은 어두운 장면에서 안 보이고 마젠타가 번져 버림 |

헛침의 초상: 맞는 순간 초상 위에 잿빛 막(`.wsk-ash` · 초상 가림막과 같은 꼴)이 opacity 로 덮인다 (filter 애니 금지 · 폰 그래픽 한도).
갈림은 battlefield `skillRes(act.res)` — hit·won·ok 는 도장 · wasted·fail·blocked·lost 는 갈라진 먹 · 비김(even)·버팀(stall)은 갈림 없이.

### 11-08 각성기 다섯의 제 장면 (`w-earth` · `w-wind` · `w-fire` · `w-water` · `w-bolt`)

장수 곁에 기운의 고리(`fx/awaken/ring-*.png`)가 모였다가 → 적진 한가운데서 기운이 솟는다(spring · 땅에서 위로) · 짐승은 battlefield 가 그대로 위에 얹는다. 번개는 이미 있던 `awaken/bolt-*.png` 세 줄기.

| 파일 | 크기 | 바탕 | 프롬프트 |
|---|---|---|---|
| skill/wake/rock-spikes.png | 768x447 | #ff00ff | `a cluster of huge jagged rock spikes violently erupting upward out of cracked ground … glowing molten amber light in the cracks … chunks of rock, pebbles and dust flying up` · 먼지에 마젠타가 배어 흙빛으로 다시 칠함 |
| skill/wake/tornado.png | 372x640 | #000 | `a huge spiraling tornado of wind … glowing pale jade-green and white light streaks swirling upward, narrow at the bottom and wide at the top` |
| skill/wake/fire-pillar.png | 402x640 | #000 | `a towering pillar of fire erupting straight up from the ground … white-hot core fading to yellow, orange and deep red` |
| skill/wake/water-spout.png | 495x640 | #000 | `a towering column of water erupting upward from the ground and twisting like a rising water dragon spout, glowing white-blue foam and translucent turquoise water` |

빌려 쓰는 각성 그림 (이미 있음): `fx/awaken/ring-earth.png` · `fx/awaken/ring-wind.png` · `fx/awaken/ring-fire.png` · `fx/awaken/ring-water.png` · `fx/awaken/ring-bolt.png` · `fx/awaken/ember.png` · `fx/awaken/p-drop1.png` · `fx/awaken/bolt-1.png` · `fx/awaken/bolt-2.png` · `fx/awaken/bolt-3.png`
