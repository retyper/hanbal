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
