# 스팀 상점 페이지 꾸러미 (초안 · 2026-11-11)

> MEGAHIT.md 3단계 7. 형이 스팀웍스에 붙여 넣을 글·그림 목록. **제목: 열국군웅전(列國群雄傳)** (형 11-11) · 부제/설명 첫 줄 「아사달에서 삼성혈까지」 · 영어 제목 **First Realms** (형 11-11) · 영어 부제 후보 「From Asadal to Samseonghyeol」 또는 「Egg-Born Kings」.
> 규칙: 지금 게임에 **있는 것만** 쓴다 (STEAM-RELEASE.md · 미래 기능을 현재처럼 쓰지 않는다). 화면 글 규칙(긴 줄표 금지)은 상점 글에도 지킨다.

## 0. 훅 한 문장

- 한국어: **가챠 게임급 장수를, 뽑기 없이 싸워서 사로잡아 모은다.**
- English: **Gacha-quality heroes. No gacha. Defeat them, capture them, win them over.**

## 1. 짧은 소개 (스팀 「짧은 설명」 · 300자 안)

**한국어**
> 고대 한반도, 일흔여덟 나라가 다투던 삼한의 시대. 나라를 키우고 적장을 사로잡아 내 사람으로 만들자. 이백 명의 장수는 저마다 얼굴과 목소리, 각성한 모습이 있고, 뽑기는 하나도 없다. 싸워서 이기고, 붙잡고, 마음을 돌린다.

**English**
> Ancient Korea, the age of the Samhan, when seventy-eight kingdoms fought for the peninsula. Grow your realm, capture enemy generals and win them to your side. Two hundred heroes, each with a face, a voice and an awakened form, and not a single gacha pull. Fight. Capture. Persuade.

## 2. 긴 소개 (머리 + 특징 다섯)

**한국어**

> **뽑기 없는 장수 수집 전략.** 적장을 이기면 포승줄이 세 번 흔들린다. 잡히면 옥에 가두고, 말로 마음을 돌리면 내 장수가 된다.

- **사로잡고 회유한다** — 이긴 싸움마다 적장 생포의 기회. 담판으로 마음을 돌리거나 풀어 주거나.
- **장수가 깨어난다** — 내리 이기면 불꽃이 차고 각성한다. 각성한 장수는 숨 쉬는 초상으로 움직인다.
- **장수 겨루기 · 활 한 발** — 큰 싸움 한가운데 적장과 일대일 겨루기, 밤 지붕 위에서 적장을 노리는 한 발.
- **삼한의 일흔여덟 나라** — 마한·진한·변한, 부여와 고구려. 이야기 장(온조·주몽 …)과 자유 판.
- **확률은 거짓말하지 않는다** — 화면에 적힌 숫자는 진짜다. 같은 결정을 다시 해도 같은 결과, 바꾸려면 결정을 바꿔야 한다.

**English**

> **Hero-collecting strategy without the gacha.** Win a battle and the rope shakes three times. Capture the enemy general, keep them in your jail, and talk them into joining you.

- **Capture and persuade**: every victory is a chance to take an enemy general alive. Win them over in a face-to-face talk, or let them go.
- **Heroes awaken**: win in a row and the flames fill. Awakened heroes come alive as breathing, animated portraits.
- **Duels and the single arrow**: a one-on-one duel with the enemy general in the middle of battle, and a lone shot from the night rooftops.
- **Seventy-eight kingdoms of the Samhan**: Mahan, Jinhan and Byeonhan, Buyeo and Goguryeo. Story chapters (Onjo, Jumong …) and free play.
- **Honest odds**: a number on screen is the real number. Make the same choice again and you get the same result; to change the outcome, change your decision.

## 3. 태그 (스팀 사용자 태그 후보 · 앞이 더 중요)

Strategy · Turn-Based Strategy · Grand Strategy · Historical · Collectathon · Mythology · Singleplayer · Character Collection(가까운 태그) · Asian · Medieval · Choices Matter · Replay Value · Female Protagonist(×) → 장수 중 여인이 많다는 건 스크린샷으로 보인다

## 4. 그림 규격 (스팀 요구 · 형이 굽는다 · 꾸러미는 내가 tools/bake-pack.mjs 로)

| 이름 | 크기 | 들어갈 것 |
|---|---|---|
| 헤더 캡슐 | 920×430 | 제목 로고 + 대표 장수 둘(여·남) |
| 작은 캡슐 | 462×174 | 제목 로고만 크게 (작아도 읽히게) |
| 메인 캡슐 | 1232×706 | 세일·첫 화면용 · 생포 장면 + 로고 |
| 세로 캡슐 | 748×896 | 각성한 여장수 한 명 전신 + 로고 |
| 라이브러리 히어로 | 3840×1240 | 글자 없는 넓은 그림 (지도 위 두 군대) |
| 라이브러리 로고 | 1280×720 투명 | 제목 로고만 |
| 스크린샷 | 1920×1080 · 5장 이상 | 아래 §5 |

- 사람 그림은 챗지피티(사람)·소품은 제미나이 (메모리 규칙). **15세 판 그림만** 쓴다 (노출 넘는 판은 assets_r19).
- 제목 로고 다시 굽기 (지금 그림은 「삼한열전」) — 문안은 아래 §4-1. 형이 챗지피티로 굽는다(전에 쓴 길: 청동 글자 + 뒤에 눕힌 비파형 동검 · 진짜 투명 바탕).

## 5. 스크린샷 목록 (데스크톱판 1920×1080 · 자동 촬영 도구로)

1. 생포 장면 — 포승줄이 흔들리는 순간
2. 각성 장면 — 각성 컷인 + 숨 쉬는 초상
3. 장수 겨루기 — 고리와 적장 칸(각성 영상)
4. 지도 — 여러 나라 땅빛 · 행군 화살 · 둘레 단추
5. 회유 담판 — 장수 얼굴과 말
6. 도읍 — 궁궐 단계 · 큰 공사
7. 밤 지붕 위 활 한 발
8. 영웅전(도감) — 각성 초상이 늘어선 화면

## 6. 30초 예고편 대본 (초 단위)

| 초 | 화면 | 글(한/영) |
|---|---|---|
| 0~3 | 검은 화면 → 지도가 밝아짐, 일흔여덟 나라 깃발 | 일흔여덟 나라 / Seventy-eight kingdoms |
| 3~8 | 싸움 → 적장 생포, 포승줄 세 번 흔들림 | 이기면 사로잡는다 / Defeat them. Capture them. |
| 8~13 | 회유 담판 → 「우리 장수가 되었다」 | 마음을 돌린다 / Win them over. |
| 13~20 | 각성 컷인 → 숨 쉬는 각성 영상 셋 빠르게 | 그리고 깨어난다 / Then they awaken. |
| 20~25 | 장수 겨루기 치명타 · 밤 활 한 발 | |
| 25~30 | 로고 + 「뽑기 없음」 + 찜하기 | No gacha. Wishlist now. |

## 7. 쇼츠 (형 11-11: "견지쇠비 같은 10초짜리 띄워 주면 사람들 엄청 올 것")

- 세로 각성 영상 10초 그대로 + 위: 장수 이름 · 아래: 제목 + 「스팀 찜하기」 + 주소. 장수 한 명에 한 편, 하루 한 편.
- 도구: `tools/shorts.mjs` (ffmpeg 로 글자 얹기) — 만들 차례. 주소는 상점 페이지가 생기면 넣는다.
- 15세 선: 쇼츠도 15세 판 영상만 (assets_r19 장수는 빼거나 15세 판 다시 구운 뒤).

## 8. AI 사용 신고 (스팀 「콘텐츠 설문」 AI 항목 초안)

> **Pre-Generated:** 이 게임의 장수 초상·각성 그림·일부 배경과 아이콘은 생성형 이미지 도구(ChatGPT·Gemini)로 만든 뒤 사람이 고르고 손봤다. 각성 초상의 움직이는 영상은 Google Veo/Flow 로 만들었다. 장수 목소리는 Google AI Studio 음성 합성으로 만들었다. 게임 실행 중에 새로 생성하는 콘텐츠는 없다(Live-Generated 없음).

- 효과음·음악 출처는 credits.html (공유마당·Freesound CC0·CC BY) · 도트 실험 그림(LPC, CC-BY-SA)은 연습 싸움 전용 실험이라 출시판에서 빼거나 표기.

## 9. 시스템 요구 (데스크톱판 실측 전 초안)

- 최소: Windows 10 64bit · 4GB RAM · 내장 그래픽 · 저장 공간 2GB
- 권장: 8GB RAM · 저장 공간 2GB
- 스팀 데크: 확인 전 (MEGAHIT 4단계)

## 10. 남은 결정 (형)

- ~~제목~~ → **열국군웅전 / First Realms** (11-11)
- 가격 · 얼리 액세스 여부 (첫 한 시간 시험 뒤)
- ~~스튜디오 이름~~ → **Hephaestosian** (형 11-11 · https://hephaestosian.github.io/)

## 4-1. 제목 로고 문안 (열국군웅전 · 형이 굽는다)

붙일 것: 지금 로고 `public/realm/logo/title.png`(화풍 참고) + 동검 사진 `public/realm/00db79af-897d-4ad4-8dbf-ecb32c544b74.webp`(실루엣 참고 · 박물관 사진이라 커밋 금지).

> Game title logo, transparent background (real alpha, no checkerboard), 1600×480. The Korean title 「열국군웅전」 written as five large hand-brushed characters in cast bronze: dark green-brown patina with bright worn gold edges, the brush strokes thick and confident like an ancient Korean calligrapher's, with a subtle beveled metal depth. Behind the letters, laid horizontally, a single Liaoning-style bronze dagger (비파형 동검) from the attached photo: a blade without hilt or guard, the lower half swelling like a lute, one pair of small barbs near the middle, a short tang at the bottom; the dagger is one tone darker than the letters so the letters stay readable, with a thin dark edge around each character. The same style as the attached current logo. No red sun disc, no Japanese motifs, no other text, no watermark, nothing else.
> 저장 이름: `logo-title-yeolguk.png` (받으면 `public/realm/logo/title.png` 로 · 옛 「삼한열전」 판은 assets_src/realm/retired/logo 로)

영어 로고: 같은 틀로 「FIRST REALMS」 한 장 더 (청동 대문자 세리프 · 뒤에 같은 동검 · 저장 이름 `logo-title-firstrealms.png` → `public/realm/logo/title-en.png`).
