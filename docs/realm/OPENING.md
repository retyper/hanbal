# 오프닝 (초안 · 2026-11-11 · MEGAHIT 3단계 · 형: "로고·크레딧·광고영상·오프닝·엔딩 다 준비해야지")

> 처음 새 판을 열 때 한 번, 그리고 「더 보기 → 오프닝 다시 보기」. **언제든 누르면 건너뛴다** (3초 복귀 원칙). 길이 45초 안팎.
> 새 그림을 굽지 않고 **있는 그림을 천천히 움직여**(켄 번스: 느린 확대·옆으로 흐름) 만든다 — 메모리 「있는 그림 먼저」. 끝의 각성 장면만 숨 쉬는 영상.
> 같은 장면을 헤드리스로 녹화하면 예고편·상점 영상의 앞부분이 된다 (STEAM-STORE §6).

## 장면 (초 · 그림 · 내레이션 한/영)

| # | 초 | 그림 (public/realm/…) | 움직임 | 내레이션 (한) | 자막 (영) |
|---|---|---|---|---|---|
| 1 | 0~5 | 검은 화면 → event/event-golden-egg.jpg | 어둠에서 서서히 밝아지며 알 쪽으로 다가감 | 하늘이 알을 내려 보냈다. | The heavens sent down an egg. |
| 2 | 5~11 | event/event-egg-birth.jpg → keyart/gujibong.jpg | 알 → 구지봉 산마루로 흐름 | 알에서 깨어난 이들이 나라를 열었다. | From the eggs came the ones who founded kingdoms. |
| 3 | 11~17 | keyart/world.jpg (또는 map 바탕) + 깃발이 하나씩 켜짐 | 멀리서 지도 전체 · 깃발 78개가 남에서 북으로 퍼짐 | 한강의 남쪽, 일흔여덟 나라. | South of the Han River, seventy-eight kingdoms. |
| 4 | 17~22 | event/event-bow-forge.jpg → event/event-iron-trade.jpg | 불티 · 옆으로 흐름 | 쇠를 두드리는 소리가 그치지 않았고, | The ring of iron never ceased, |
| 5 | 22~27 | event/event-invade-field.jpg → film/film-win-field.jpg | 빠른 밀어 넣기 · 화면 흔들림 한 번 | 싸움의 북소리도 그치지 않았다. | and neither did the drums of war. |
| 6 | 27~33 | event/event-capture.jpg → event/event-captive-persuade.jpg | 포승줄이 세 번 흔들리는 박자에 맞춰 세 번 작은 떨림 | 이긴 자는 적장을 죽이지 않았다. 사로잡았다. | The victors did not kill the enemy's generals. They captured them. |
| 7 | 33~41 | 각성 숨쉬기 영상 셋 빠르게 (쇠비 · 소서노 · 다나 · 남장수 하나) | 영상마다 2초, 빛 번쩍임으로 넘어감 | 마음을 얻은 장수는 깨어나, 그대의 이름으로 싸운다. | Win their hearts, and they awaken to fight in your name. |
| 8 | 41~46 | 제목 로고 (logo/title.png → 바뀔 제목) | 청동 빛이 한 번 지나감 | 일흔여덟 나라를 하나로. | Unite the seventy-eight kingdoms. |

- 역사 규칙: 한국 중심. 「나라를 열었다」의 알 신화는 혁거세·주몽·수로·탈해(삼국사기·삼국유사) — 중국 쪽 기록 틀로 말하지 않는다. 「일흔여덟 나라」는 이 게임의 삼한 78국.
- 화면 글 규칙: 긴 줄표 없음 · 자막은 한 줄씩 · 2초 이상 머문다.

## 소리

- 내레이션: 남자 목소리 하나, 낮고 차분한 사극 내레이터 결 (AI 스튜디오 TTS · 장수 목소리와 다른 성우) — 녹음은 성우 녹음 차례에 끼워서. 여덟 줄을 한 번에 (빈 줄로 나눠 1초 쉼) 받아 자른다.
- 음악: 지도 음악 중 가장 장엄한 곡을 앞 5초 낮게 → 6번에서 북 → 8번에서 한 번 크게. 효과음: 알 깨짐(7번 전 반짝임) · 망치 · 북 · 포승줄 세 번(생포 효과음 그대로).
- 소리를 못 받는 곳(무음 설정)에서도 자막으로 다 읽힌다.

## 만들 것 (순서)

1. `src/ui/realm/opening.ts` — 장면 목록(데이터) + DOM 켄 번스(CSS transform 하나 · 폰 GPU 한도: 화면 가득 그림에 filter 애니 금지 · 메모리 mobile-gpu-layer-limit) · 누르면 건너뜀 · 숨은 탭에서 멈춤.
2. 첫 새 판(배우는 판 들어가기 전)에 한 번 · 「더 보기 → 오프닝」 · 데스크톱판에서도 같은 것.
3. 내레이션 녹음 → `public/realm/voice/opening/01.ogg …` · 없으면 자막만으로 돈다.
4. 헤드리스 녹화 → 예고편 앞 15초.

## 엔딩 (같은 틀)

- 장(이야기)을 이기면: 그 장의 주인공 각성 영상 → 「OO, 마한을 아우르다」 같은 장 끝 글 한 줄 → 크레딧 롤(credits 에이전트가 만드는 roll 함수) → 영웅전에 남은 장수 얼굴들.
- 자유 판 통일: 지도 위 깃발이 하나로 바뀌는 장면 → 크레딧 롤.
