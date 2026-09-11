# 아이콘 — 챗지피티에 그대로 붙여넣을 것

> 2026-09-11, 형: **"신궁아이콘 ㅋㅋㅋ 병신아 활을 꺼꾸로 쏘냐??? 아이콘 이미지는 챗지피티한테
> 요청해서 만들어달라고 해. 진짜 하고싶을 만한 게임으로 말이야. 시위를 당기고 있는것보다는
> 활이 확실히 나오긴 하지만 비장한 다윗은같은 모습으로."**

**나는 챗지피티를 못 부른다.** 그래서 (1) 거꾸로였던 활을 먼저 고쳐 놨고(임시),
(2) 형이 그대로 붙여넣을 프롬프트를 아래 적어 뒀고, (3) 받아온 그림을 한 줄로 굽는 도구를 만들었다.

---

## 1. 지금 상태

- 거꾸로였던 게 맞다. 숫자로: 활채가 가장 부푼 곳 **u = −0.220**, 시위 **u = −0.035**,
  화살은 오른쪽(촉 u = +0.58). 화살이 오른쪽으로 나는데 활채가 시위보다 **왼쪽**에 있었다 —
  활을 뒤집어 쥔 그림이다. 오늬도 활채보다 뒤라 **화살이 활을 뚫고** 있었다.
- 고쳤다 (`tools/make-icons.mjs`). 그리고 `tools/probe-icon.mjs` 가 **구워진 PNG 를 도로 뜯어서**
  방향을 잰다 — 거꾸로 그린 판을 넣어 보니 실제로 빨간불이 떴다.
- 지금 아이콘은 **활 하나**다. 형이 말한 "비장한 다윗" 은 사람이 나와야 하고, 그건 손으로
  그릴 그림이 아니다. 아래 프롬프트로 받아오면 갈아 끼운다.

---

## 2. 그대로 붙여넣기 — 영어 (그림 모델은 영어가 더 잘 먹는다)

```
App icon for a mobile archery game called "신궁" (Divine Bow), set in medieval Korea.

Subject: a lone young archer standing still, seen from the chest up in three-quarter view.
He is NOT drawing the bow — he holds it upright at his side, calm and grim, the moment
before the fight. The pose should feel like Michelangelo's David: quiet, resolute,
a little defiant. Eyes forward. Wind in his hair.

The bow must read instantly and unmistakably: a large recurve bow held vertically,
its full silhouette clearly visible against the background, string facing the viewer's
left, limbs curving away. One arrow held loosely in the other hand, tip up.

Style: dramatic painted game-icon art, bold simple shapes, strong rim light from behind,
heavy shadow. Dark background (#1c2129) with a warm gold glow (#ffb347) behind the figure.
Limited palette: dark blue-grey, bone, warm gold. Korean traditional silhouette cues —
a simple hemp tunic, a topknot — but no heavy ornament or fine detail.

Composition: perfectly square, subject centered, everything important inside the middle
70% of the frame (the outer edge gets cropped into a circle on Android).
Must stay readable at 48x48 pixels: big shapes, high contrast, no thin lines, no clutter.

No text, no letters, no logo, no watermark, no border, no frame, no UI elements.
1024x1024, flat PNG, no transparency.
```

**한 줄 요약을 덧붙이고 싶으면:**
`Make it look like a game someone would actually want to play — cinematic, not clip art.`

## 3. 한국어 판 (챗지피티에 한국어로 시킬 때)

```
모바일 활 게임 "신궁"의 앱 아이콘을 그려줘. 배경은 고려·조선.

인물: 혼자 선 젊은 궁수. 가슴 위쪽만, 3/4 각도.
**시위를 당기고 있지 않다** — 활을 옆에 세워 쥐고 가만히 서 있다. 싸움 직전의 고요함.
미켈란젤로의 다윗 같은 자세 — 조용하고 결연하고 조금 반항적인. 눈은 정면. 머리칼에 바람.

활이 **반드시 한눈에 보여야 한다**: 크고 휜 각궁을 세워 쥐었고, 실루엣 전체가 배경 위에
또렷하다. 시위는 보는 사람 기준 왼쪽, 활채는 그 반대로 휜다. 다른 손에 화살 한 대, 촉은 위로.

화풍: 극적인 게임 아이콘 일러스트. 크고 단순한 덩어리, 뒤에서 오는 강한 역광, 짙은 그림자.
어두운 남회색 배경(#1c2129)에 인물 뒤로 따뜻한 금빛(#ffb347). 색은 셋만 — 남회색·뼈색·금색.
한복 삼베 저고리와 상투로 시대를 말하되 자잘한 장식은 없이.

구도: 정사각형, 인물은 가운데, 중요한 것은 전부 가운데 70% 안에
(안드로이드가 가장자리를 원으로 깎는다).
**48x48 픽셀로 줄여도 읽혀야 한다** — 큰 덩어리, 강한 대비, 가는 선 금지.

글자·로고·워터마크·테두리·UI 요소 없이. 1024x1024 PNG, 투명 없이.
```

---

## 4. 받은 그림이 틀렸는지 보는 법 (다시 받기 전에)

1. **활이 거꾸로가 아닌가** — 시위(곧은 줄)가 활채의 배(가장 부푼 곳)보다 **쏘는 사람 쪽**에
   있어야 한다. 활채는 과녁 쪽으로 휜다. 이게 이번에 틀렸던 그것이다.
2. **48px 로 줄여 보라** — 폰 홈 화면에서 실제로 그만 해진다. 얼굴이 죽처럼 뭉개지면 다시.
3. **가장자리** — 안드로이드는 아이콘을 원으로 깎는다. 활 끝이나 얼굴이 모서리에 붙어 있으면 잘린다.
4. **글자** — 한 글자도 없어야 한다. 그림 모델은 시키지 않아도 넣는다.

---

## 5. 받아왔으면

```bash
# 받은 PNG 를 여기에 둔다
cp ~/Downloads/그림.png assets_src/icon-source.png

node tools/bake-icon.mjs assets_src/icon-source.png   # 512 · 192 · 180 세 장을 굽는다
node tools/probe-icon.mjs                             # 크기·자리 확인
npm run build                                         # 예산 확인
```

`bake-icon.mjs` 가 정사각형이 아니면 가운데를 자르고, 투명한 자리는 테마색으로 받고,
상자 평균으로 줄인다 (크게 줄일 때 점이 안 튄다). 라이브러리는 안 쓴다 (A6).

`probe-icon.mjs` 는 **우리가 그린 벡터 아이콘일 때만** 활의 방향까지 잰다 — 색으로 활채·시위·촉을
찾기 때문이다. 형이 받아온 그림으로 갈아 끼우면 그 부분은 "눈으로 볼 것"이라고 말하고 넘어간다.
그림의 방향은 위 4번으로 형이 본다.
