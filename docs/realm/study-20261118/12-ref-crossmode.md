# 12 · 서로 다른 놀거리를 오가며 놀게 만드는 법 (사례 조사)

> 2026-11-18 · 설계 연구 12번 몫. 형의 물음 가운데 「컨텐츠 간의 연결성」과 「이거 즐기다 저거 즐기다」를 맡았다.
> 방법: 웹 검색 53회 · 글 열람 26편(성공 21). 우리 쪽은 문서와 코드를 읽기만 했다. 고친 것 없음.
> 읽는 법: **[확인]** 은 출처(URL 또는 파일:줄)가 붙은 사실. **[의견]** 은 내 해석과 추정. 섞지 않았다.
> 출처 믿음: ★ 개발자 인터뷰·강연 보도·공식 통계 / ☆ 리뷰·분석 글 / △ 공략·유저 글·검색 요약만 본 것.
> 원문을 직접 연 글은 맨 아래 출처 목록에 (열람)이라 적었다. 그 밖의 ★·☆ 는 검색 결과의 요약으로 본 것이라 한 단계 낮게 믿어야 한다.

## 0. 다섯 줄 요약

1. 잘된 게임은 두 놀거리를 「한 바퀴」로 묶되 서로 섞지 않고 가장자리에서만 잇는다. 주고받는 넷(자원·사람·정보·이야기) 가운데 사람과 이야기가 가장 덜 숙제가 된다.
2. 곁 놀거리가 길면 본편을 잊는다. 시드 마이어의 규칙으로는 몇 분 안쪽은 통하고 10분쯤부터 깨진다. 우리 열전은 20분, 시련은 8분이라 본편 「안」에 끼우면 위험 구간이다.
3. 묶어서 강제한 놀거리는 되풀이할수록 욕을 먹었다(풍화설월 수도원·ZZZ TV 모드·FF7 리버스). 건너뛰게만 하고 값이 없어도 욕을 먹었다(인게이지). 통한 꼴은 「안 해도 길은 열려 있고, 하면 확실히 이득이고, 맡기면 숫자가 보인다」이다.
4. 숙제가 되는 것은 「계속 채워야 하는 연결」이고 통하는 것은 「한 번 여는 열쇠」다. 형의 각성 안은 열쇠 꼴이라 방향이 맞다. 다만 장수마다 20분씩이면 양이 숙제가 된다.
5. 새 시스템 없이 지금 것만 잇는 고리 열 개를 비용순으로 냈다(§5). 가장 싼 셋은 「돌아온 한 줄」·「서로를 가리키는 칩」·「판 끝의 다음 손잡이」다.

---

## 1. 우리 게임의 지금 [확인]

### 1-1. 놀거리와 한 판 길이

| 놀거리 | 한 판 길이 | 들어가는 길 | 근거 |
|---|---|---|---|
| 본편(나라 판) | 계절 1~5분 · 첫 판 3~6시간 | 로비 「이어 하기」 | docs/realm/VISION.md:158, :166 |
| 전장(큰 싸움) | 1~3분 | 본편 싸움마다 | docs/realm/VISION.md:159 |
| 저격 | 30초~1분 | 전장의 첫 수 | docs/realm/VISION.md:160 |
| 겨루기(장수) | 30~90초 | 전장의 깃발 「장수 겨루기」 | docs/realm/FIRST-HOUR.md:32 · docs/realm/BATTLE.md:284 |
| 바다 도적·산적 막기 | 물결 셋(시간 미확인) | 사건 카드 「맞선다」 | src/realm/data/cards.ts:150, :154 |
| 밤 판(암살·구출) | 미확인 | 공작 「암살」 · 연습장 | src/night-main.ts:2~10 |
| **열전** | **20분**(1200초) | 장수 판의 「이 장수로 열전 출전」 | src/tune/params.ts:39 · src/ui/realm/app.ts:4825 |
| 각성 시련(열전의 짧은 판) | 8분(길이 배수 0.4) | 장수 판 「각성 시련」 | src/tune/params.ts:250 |
| 옛 토벌 판 | 90초 | 지금은 입구를 뗌 | src/tune/params.ts:314 · docs/realm/production/HAEBI-CHRONICLE-20261114.md:7 |
| 원정 | 실시간 30분~8시간 | 본편 명령 | docs/realm/VISION.md:161 |

### 1-2. 이미 놓인 다리

| 다리 | 꼴 | 근거 |
|---|---|---|
| 본편에서 모은 장수만 열전에 나간다 | 사람(한 방향) | src/raid/link.ts:3, :26 |
| 열전 마지막 스테이지를 그 장수로 깨면 진각성 자격 | 열쇠(장수마다 한 번) | src/raid/link.ts:12, :34 · src/realm/heroes.ts:943 |
| 본편에서 각성한 장수만 열전 안에서 각성한다 | 열쇠 | docs/realm/RAID-LINK.md:14 |
| 시련을 이기면 본편으로 돌아와 곧바로 각성 연출 | 화면 겹쳐 띄우기 + 결과 전달 | src/ui/realm/app.ts:4466, :4488~4497 |
| 사건 카드의 「맞선다 / 장수에게 맡긴다」 | 손으로 또는 맡기기 | src/realm/data/cards.ts:150~151 |
| 열전 금은 본편 물자로 안 바꾼다 | 경제는 따로 | docs/realm/RAID-LINK.md:85 |
| 로비 「이어 하기」에 걸려 있는 일 한 줄 | 예고 | src/ui/realm/front.ts:211~212 |
| 장수 판의 진각성 칩 | 조건 보여 주기 | src/ui/realm/app.ts:1539 |

### 1-3. 걸리는 곳

- 각성은 지금 판(캠페인) 단위다. 「내리 세 번 이김」이 조건이다. src/tune/params.ts:3114
- 배우는 판 장수는 시련 없이 예전 길로 각성한다. 첫 30분에 10분 열전을 끼우지 않으려는 뜻이다. src/realm/trial-rules.ts:3~9
- 메가히트 차례표의 목표는 「첫 각성 30분 안」이다. docs/realm/MEGAHIT.md:77
- 독립 열전을 닫고 돌아오면 기록만 맞춘다. 무엇이 바뀌었는지 말해 주는 줄은 없다. src/ui/realm/app.ts:4436~4446, :4448~4461
- 열전 스테이지 열림은 계정 단위, 깬 기록은 장수 단위다. src/raid/meta.ts:38, :70~72
- 한 판 도중 새로 고치면 시련 진행은 되살아나지 않는다(11-14 기록. 그 뒤 바뀌었는지는 미확인). docs/realm/production/HAEBI-TRIAL-20261114.md:24
- 열전 무기 묶음은 일곱. 원화와 달라 고친 것 26, 띠를 다시 구워야 하는 것 19. docs/realm/production/WEAPON-AUDIT-20261116.md:15~16
- 새 미니게임·새 시스템은 동결이다. docs/realm/MEGAHIT.md:35

---

## 2. 사례

표의 「사례」 칸은 **[확인]**(출처 붙음), 「원리」「우리에게」「비용」 칸은 **[의견]** 이다.

### 2-A. 두 놀거리가 한 바퀴를 이루는 게임

| 사례 [확인] | 왜 통했나(원리) | 우리에게 옮기면 | 1인 비용 |
|---|---|---|---|
| **데이브 더 다이버.** 첫 시제품은 잠수와 가게 운영을 한꺼번에 했는데 감독 말로 「어느 쪽에도 집중할 수 없었다」. 낮과 밤으로 갈라 풀었다. 초밥집은 원래 자동이었는데 「헐겁다」고 봐서 손으로, 밤에만 하게 바꿨다. VIP·잔치 손님은 「정해진 재료를 기한 안에」 가져오라고 시킨다. ★ [gamedeveloper](https://gamedeveloper.com/design/dave-the-diver) · ★ [SE Daily](https://softwareengineeringdaily.com/articles/developing-dave-the-diver-with-jaeho-hwang-and-minsuk-cha/) | 같은 시간에 둘을 시키지 않는다. 한쪽이 끝난 자리에서 다른 쪽이 시작한다. 그리고 한쪽이 다른 쪽에 「주문」을 낸다(이 물고기를 사흘 안에). | 본편 사건 카드가 곁 놀거리에 주문을 내는 꼴은 이미 있다(도적 막기). 열전에도 같은 꼴을 쓴다. 「이 장수로, 이 땅에서」라는 주문이 붙으면 까닭이 생긴다. | 작다. 카드 한 장과 입구 잇기. |
| 같은 게임의 뒤쪽. 곁 놀거리(농사·경마·도감)를 「용과 같이」에서 배워 넣었다. ★ [Inven Global GDC24](https://www.invenglobal.com/articles/18786/gdc24-blending-humor-and-gameplay-insights-from-dave-the-divers-session) 유저 평에는 「뒤로 갈수록 미니게임이 쌓여 중심이 묻힌다」가 되풀이된다. △ [Backloggd](https://backloggd.com/u/TheYeti/review/1499858) · △ [GameGeeker](https://gamegeeker.com/games/dave-the-diver/review?market=PL) | 곁 놀거리는 초중반의 지루함을 푼다. 하지만 수가 늘수록 「한 번 하고 끝」이 늘어 중심을 가린다. | 우리는 이미 여섯이 넘는다(겨루기·저격·밤 판·도적 막기·제천 대회·열전). 더 만들지 말라는 차례표가 맞다. | 0. 안 만드는 것이 답. |
| **문라이터.** 던전에서 주운 것을 가게에서 판다. 돈이 유일한 성장 수단이다. 대표 말로 돈이 모자라면 「같은 일을 되풀이」하게 된다. 미리 시제품으로 두 축이 맞는지 볼 걸 그랬다고 했다. ★ [MCV](https://mcvuk.com/development-news/when-we-made-moonlighter/) 2편에서 가게를 운에 기대게 바꿨다가 시연 뒤 반발을 받고 되돌렸다. ★ [Bonus Action](https://bonus-action.com/interview/moonlighter-2s-design-director-on-the-redesign-that-nearly-broke-him-we-owe-it-to-our-players/) | 화폐 하나로 두 놀거리를 묶으면 값 맞추기가 곧 노가다 양이 된다. | 열전 금과 본편 곡식·쇠를 바꾸지 않기로 한 것은 옳다. 잇는 것은 돈이 아니라 사람 단위 표식이어야 한다. | 0. 지금대로. |
| **컬트 오브 더 램.** 「만든 것의 6할을 버렸다」. 신도를 던전에 데려가 봤더니 「액션이 흐려졌다」. 덜어 낼수록 더 끌렸다고 한다. 양쪽을 「이을 수 있는 데마다 이었다」. ★ [gamedeveloper](https://gamedeveloper.com/design/interview-corralling-the-inherent-cuteness-of-cult-of-the-lamb) 던전에 가 있는 동안에도 마을 시간은 흐른다(굶고 앓는다). △ [gamepressure](https://www.gamepressure.com/cult-of-the-lamb/beginners-guide/z6101c1) 평: 마을 쪽은 「바쁘기만 한 일」이라는 비판. ☆ [Game Wisdom](https://game-wisdom.com/analysis/cult-of-the-lamb) | 두 놀거리의 규칙을 서로 안에 섞지 않는다. 잇는 곳은 가장자리(들고 가는 것·들고 오는 것)뿐. 그리고 각 반쪽은 홀로 선 게임보다 단순해야 한다. | 열전 안에 본편 병력·외교를 넣지 않는다. 본편 싸움 안에 열전 조작을 넣지 않는다. 「자리 비운 사이 마을이 굶는다」는 우리 원칙(위협은 안 쌓인다)과 어긋나니 가져오지 않는다. | 0. 지키기만. |
| **루프 히어로.** 원정에서 모은 재료로 마을을 짓고 마을이 새 카드·직업을 연다. 모닥불 칸에서 물러나면 100%, 다른 칸은 60%, 죽으면 30%를 가져온다. △ [Twinfinite](https://twinfinite.net/guides/loop-hero-return-to-camp-how/) · △ [gfinity](https://www.gfinityesports.com/misc/loop-hero-death-what-happens-when-you-die/) | 「언제 돌아갈까」가 곧 놀이다. 져도 조금은 가져온다. | 소울류(져도 성장) 결정과 같은 결. 열전에서 지고 돌아와도 한 칸은 남는다는 약속을 화면에 보이면 된다. | 작다. 결과 창 한 줄. |

### 2-B. 달력과 사람으로 묶는 게임

| 사례 [확인] | 왜 통했나(원리) | 우리에게 옮기면 | 1인 비용 |
|---|---|---|---|
| **페르소나 4·5.** 달력은 인물들이 느끼는 압박에 맞춰 짰다. ★ [Siliconera](https://www.siliconera.com/behind-the-design-of-persona-4/) 사람과 보낸 시간이 던전의 힘으로 돌아온다. 예: 선생은 던전 다녀온 날 밤의 시간을 돌려준다. 장기 기사는 전투 중 교대를 연다. 의사는 기력 약을 싸게 판다. ☆ [Game Informer](https://gameinformer.com/b/features/archive/2017/04/06/persona-5s-most-useful-confidants.aspx) 던전에 가면 그날 낮·밤 두 칸이 다 든다. ☆ [회고 글](https://prismatictyrant.substack.com/p/persona-5-retrospective-part-4) | 사람이 다리다. 일상에서 얻는 것이 숫자 덤이 아니라 「새로 할 수 있는 일」이다. 시간이 한정돼 있어 고르는 맛이 생긴다. | 정(인연)이 오를 때 능력치 +1 대신 「다른 놀거리에서 할 수 있는 일 하나」를 연다. 예: 정이 깊은 장수는 열전에서 다시 고르기 +1, 겨루기에서 첫 합 먼저. | 중간. 표 한 장과 훅 몇 개. 새 시스템은 아님. |
| **파이어 엠블렘 풍화설월.** 감독: 전략과 RPG 사이 균형이 「정말 어렵다」. ★ [RPG Site](https://rpgsite.net/interview/8711-fire-emblem-three-houses-interview-intelligent-systems-nintendo-talk-bringing-the-beloved-strategy-rpg-series-to-switch) 쉬는 날은 산책·강습·전투·휴식 넷 가운데 하나. △ [TheGamer](https://www.thegamer.com/fire-emblem-three-houses-explore-battle-seminar-rest/) 팬 평: 수도원 잡일이 가장 큰 불만, 건너뛰면 스스로 다리를 꺾는 꼴. △ [분석 블로그](https://press-z-or-r-twice.blogspot.com/2021/02) · ☆ [Source Gaming](https://sourcegaming.info/2022/11/15/center-stage-garreg-mach-monastery-fire-emblem-three-houses/) | 첫 회차엔 사람을 알아 가는 재미가 크다. 되풀이하면 같은 걸음이 숙제가 된다. 「건너뛸 수 있지만 건너뛰면 손해」가 가장 나쁜 꼴이다. | 판을 여러 번 도는 우리 게임에서 더 조심할 것. 판마다 다시 해야 하는 긴 곁 놀거리는 두 번째 판부터 숙제다. | 0. 피하기. |
| **파이어 엠블렘 인게이지.** 전작과 다르게, 지도와 이야기를 오가는 익숙한 꼴로 돌아갔다. △ [GoNintendo](https://gonintendo.com/comments/9826) 거점은 시간 제한 없이 쓸 수 있다. ☆ [Laptop Mag](https://www.laptopmag.com/reviews/fire-emblem-engage) 평: 거점이 「채우기 잡일」, 사람과 가까워지는 폭이 좁다. ☆ [Inverse](https://www.inverse.com/gaming/fire-emblem-engage-review) · ☆ [TechRadar](https://www.techradar.com/reviews/fire-emblem-engage-review-breathes-life-into-old-combat) | 건너뛰게만 하면 답이 아니다. 걸린 것이 없는 곁 놀거리는 빈 껍데기가 된다. | 열전을 「해도 되고 안 해도 되는 것」으로만 두면 안 한다. 한 번 여는 큰 열쇠 하나는 걸려 있어야 한다. | 0. 설계 원칙. |
| **미드나잇 선즈.** 거점 대화가 너무 많아 서른 개쯤 잘랐다. 디렉터 말: 「그냥 너무 많았다」. ☆ [PC Gamer](https://pcgamer.com/creative-director-of-midnight-suns-says-it-was-originally-even-more-talky-we-cut-30-conversations) 평은 좋았지만 판매는 부진했다. ★ [gamedeveloper](https://www.gamedeveloper.com/design/marvel-s-midnight-suns-director-worries-the-card-mechanic-kept-players-away) | 전투 사이에 읽을 것이 길면 전투하러 온 사람이 지친다. | 열전에 이야기를 넣더라도 판 사이에 한두 마디. 읽는 판을 만들지 않는다(읽지 않고 보이게). | 0. 줄 수 상한 정하기. |
| **메타포.** 페르소나와 같은 틀(공동체와 후원자)을 쓴다고 감독이 말했다. ★ [GamesRadar](https://gamesradar.com/games/jrpg/its-not-like-we-wanted-to-distance-ourselves-from-persona-how-metaphor-refantazio-turned-years-of-work-on-jrpg-icons-into-whats-now-my-most-wanted-game-of-2024) 달력·기한의 세부 설계 발언은 못 찾았다. | (근거 부족) | (보류) | 없음 |

### 2-C. 본편과 곁가지

| 사례 [확인] | 왜 통했나(원리) | 우리에게 옮기면 | 1인 비용 |
|---|---|---|---|
| **용과 같이.** 본 줄거리의 방향을 먼저 정하고 미니게임은 거기 맞춘다. 겹치는 것은 덜어 낸다. ★ [Automaton](https://automaton-media.com/en/interviews/like-a-dragon-developer-interview-how-did-guys-in-diapers-make-it-into-the-game-its-all-about-curating-content-with-a-clear-message-according-to-series-director-horii/) (검색 요약으로 봄. 원문은 잘려서 못 읽음) 「0」의 부동산 놀이는 곁 이야기를 끝낸 사람들이 직원으로 들어온다(관리인·조언자·경비). △ [Pro Game Guides](https://progameguides.com/yakuza/how-to-unlock-all-real-estate-royale-staff-in-yakuza-0/) 「해적 야쿠자」는 곁 이야기 26편이 선원을 준다. 선원은 포·수리·갑판 싸움을 맡는다. △ [GamerGuides](https://www.gamerguides.com/like-a-dragon-pirate-yakuza-in-hawaii/guide/pirates-coliseum/crewmates/all-recruitable-crewmates-in-pirate-yakuza) | 한 놀거리에서 만난 사람이 다른 놀거리의 일꾼이 된다. 곁가지는 안 해도 되지만 하면 돈과 사람이 크게 는다. | 우리 척추(사로잡아 모은 장수가 나라를 굴린다)와 같다. 빠진 것은 반대 방향이다: 열전·겨루기에서 한 일이 그 장수의 본편 표식으로 남는 것. | 작다~중간. |
| **위쳐 3의 궨트.** 주말 하나에 틀을 잡았다. 작은 무리가 남는 시간에 만들었다. 출시 때 카드 195장. 카드는 세계 곳곳의 사람에게서 사거나 이겨서 얻는다. 팬 요청이 몰려 따로 게임이 됐다. ☆ [PC Gamer](https://www.pcgamer.com/the-making-of-gwent/) · ★ [gamedeveloper](https://gamedeveloper.com/design/how-i-the-witcher-3-s-i-card-game-within-a-game-was-brought-to-life) | 한 판이 짧고, 안 해도 되고, 모으는 길이 본편 여행과 겹친다. | 겨루기가 이 자리다(30~90초). 「이 적장과 겨뤄 봤다」가 도감에 남으면 본편 여행이 곧 수집이 된다. | 작다. 도감 표식. |
| **FF7 리버스.** 평: 거점마다 미니게임 수가 「지나치다」. ☆ [Laptop Mag](https://www.laptopmag.com/reviews/final-fantasy-vii-rebirth) 가장 갈리는 선택으로 꼽힌다. ☆ [Dual Pixels](https://dualpixels.com/?p=33) 반론: 대부분 안 해도 된다. ☆ [Old School Game Vault](https://theoldschoolgamevault.com/blog/reviews/final-fantasy-vii-rebirth-minigames) 다음 편이 이 문제를 손본다는 기사 제목이 있다(본문 못 엶). △ [Push Square](https://pushsquare.com/news/2026/06/final-fantasy-7-revelation-will-address-rebirths-excessive-minigame-problem) | 줄거리 길목에 미니게임을 세우면 본편 하러 온 사람이 막힌다. | 줄거리 길목(첫 각성·장 넘기기)에 열전을 세울지는 신중히. | 0. |
| **젠레스 존 제로.** TV 모드에 대해 설문과 전화로 물었다. 불만 넷: 연출이 길다, 시간이 많이 든다, 전투 흐름을 끊는다, 초반에 너무 자주 나온다. 1.2에서 본 줄거리에서 뺐다. 곁 임무에는 남겼다. 한 번 깬 것은 자동으로 돌게 했다. △ [MeinMMO](https://mein-mmo.de/en/developers-of-an-anime-rpg-talked-to-players-nearly-completely-remove-a-game-mode-after-feedback,1179457) · ☆ [Siliconera](https://www.siliconera.com/zenless-zone-zero-to-lose-tv-mode-in-main-story/) | 사람들이 싫어한 것은 놀거리 자체보다 「끊김·길이·잦음」이었다. 고친 법도 셋이다: 길목에서 빼기, 곁에 남기기, 되풀이는 자동. | 열전 조건을 건다면 넷을 같이 본다. 길이(20분), 끊김(본편 중간), 잦음(장수마다), 되풀이(판마다). | 0. 점검표로. |
| **액트레이저 2.** 마을 짓기를 통째로 뺐다. 미국 지사의 주문이었다. 평: 전작을 남다르게 한 것을 없앴다. ☆ [Time Extension](https://www.timeextension.com/news/2023/01/dont-like-what-enix-did-with-actraiser-2-blame-north-american-gamers) · △ [TCRF](https://tcrf.net/ActRaiser_2) | 두 놀거리의 맞물림이 곧 정체성일 수 있다. 한쪽을 떼면 흔한 게임이 된다. | 「전략 + 장수 액션」을 둘 다 파는 것은 약점이 아니라 얼굴일 수 있다. | 0. |
| **브루탈 레전드.** 액션으로 알렸는데 실제는 액션과 실시간 전략의 섞임이었다. 감독은 「알리는 말이 나빴다」를 가장 큰 패인으로 꼽았다. ☆ [GamingBolt](https://gamingbolt.com/brutal-legend-suffered-because-of-poor-messaging-says-tim-schafer) | 사서 보니 다른 게임이면 환불과 악평이다. | 상점 글과 예고편에 두 놀거리를 다 보인다. 차례표의 30초 대본에 열전 장면이 없다(MEGAHIT §4-8). 넣을지 정해야 한다. | 작다. 대본 한 줄. |

### 2-D. 달리기와 집

| 사례 [확인] | 왜 통했나(원리) | 우리에게 옮기면 | 1인 비용 |
|---|---|---|---|
| **하데스.** 목표는 「죽고 다시 하는 아픔을 덜기」. ★ [gamedeveloper](https://gamedeveloper.com/design/how-supergiant-weaves-narrative-rewards-into-i-hades-i-cycle-of-perpetual-death) 죽으면 늘 집으로 돌아오고, 집 사람들은 방금 판에서 있던 일(어느 두목에게 졌나, 무슨 무기였나)에 맞는 새 말을 한다. ☆ [분석](https://saschb2b.github.io/game-mechanics/games/hades/death-as-narrative) 대사 약 2만 1천, 인물 30, 낱말 30만 5천. ★ [패미통 GDC 2021 보도](https://www.famitsu.com/news/202107/25228163.html) 한 판은 20~40분. 판 도중 끄고 이어 할 수 있다. ☆ 평 여럿의 검색 요약(예: [TheGamer](https://www.thegamer.com/hades-review-a-game-fit-for-the-gods/). 어느 평의 문장인지는 특정 못 함) | 판이 끝나는 자리가 늘 같고(집), 거기에 늘 새것이 하나 있다. 진 판이 이야기를 민다. 집에 머무는 시간은 짧다. | 열전이 끝나면 그 장수의 한 마디(목소리 있음)와 「본편에서 기다리는 일」 한 줄. 본편에서 지고 돌아온 장수도 한 마디. 2만 줄은 못 쓴다. 사람마다 세 줄로 상한을 둔다. | 글과 녹음이 든다. 13명부터면 중간. 200명이면 크다. |
| 같은 게임의 「자잘한 예언 목록」. 무기·은혜를 고루 써 보면 보상을 주는 목록이다. 게임 속 물건으로 꾸민 업적표다. △ [Screen Rant](https://screenrant.com/hades-unlock-fated-list-minor-prophecies-guide/) · △ [Prima](https://primagames.com/gaming/hades-guide-mirror-of-night-upgrades-fated-list-of-prophecies) | 「안 해 본 것」이 눈에 보이면 해 보고 싶어진다. 한 번 채우면 끝이라 숙제가 아니다. | 도감 장수 칸에 놀거리를 가로지르는 줄 하나. | 중간. 자료와 화면. |
| **뱀파이어 서바이버즈.** 판은 30분, 「서두름」을 켜면 시계가 두 배로 가서 15분에 끝난다. △ [위키](https://vampire-survivors.fandom.com/wiki/Stages) · △ [GamePur](https://vip-develop.gamepur.com/?p=354250) 해금은 긴 업적 목록이다(업적 196, 해금 140이라는 집계). △ [Prima](https://primagames.com/tips/all-achievements-in-vampire-survivors-listed) 만든 이: 있는 게임 위에 새 내용과 새 규칙을 계속 얹을 수 있다. ★ [GameSpot](https://www.gamespot.com/articles/vampire-survivors-2-is-unlikely-would-to-offer-something-radical-new/1100-6511982/) | 판 길이를 사람이 고른다. 해금 그물은 자료 표 하나라 1인이 굴릴 수 있다. | 열전에 「빠른 판」. 길이 배수는 이미 스테이지마다 있다(params.ts:238~250). | 작다~중간. 밸런스 다시 재기. |

### 2-E. 사람 모으기와 본거지

| 사례 [확인] | 왜 통했나(원리) | 우리에게 옮기면 | 1인 비용 |
|---|---|---|---|
| **환상수호전.** 기획 발표 때부터 「사람이 아주 많이 나오는 이야기」였다. △ [Retro Gamer 기사](https://www.magzter.com/en/stories/puzzle-gaming/Retro-Gamer/ULTIMATE-SUIKODEN) (검색 요약으로 봄) · ☆ [Time Extension](https://www.timeextension.com/features/the-making-of-suikoden-ii-a-jrpg-to-match-game-of-thrones-in-intrigue-and-impact) 2편은 모을 수 있는 사람 100명 남짓, 그 가운데 싸우는 사람은 40명 남짓. 나머지는 본거지의 일(가게·승강기·탐정·낚시·식당)을 연다. 모은 수에 따라 성이 자란다. 큰 싸움과 일대일도 따로 있다. △ [Game8](https://game8.co/games/Suikoden-2/archives/504700) · △ [Gensopedia](https://gensopedia.org/w/New_State_Army_Headquarters) | 모든 사람에게 「자리」가 있다. 싸우지 않는 사람도 본거지에서 눈에 보인다. 모을수록 집이 달라진다. | 장수 200명이 일곱 묶음에 들어가면 열전에서는 자리가 겹친다. 묶음은 일곱으로 두더라도 「이 사람만의 한 가지」(비기 이름·무기 겉모습·한 마디)가 놀거리마다 하나씩 있어야 한다. | 겉모습만이면 중간(그림). 규칙까지면 크다. |
| **유니콘 오버로드.** 싸움은 돌아다니던 그 지도 위에서 벌어진다. ☆ [RPGFan](https://www.rpgfan.com/review/unicorn) · ☆ [RPGamer](https://rpgamer.com/review/unicorn-overlord-review/) 주막에서 같이 밥을 먹으면 정이 오른다. △ [Siliconera](https://www.siliconera.com/how-to-build-relationship-rapport-fast-in-unicorn-overlord/) 되찾은 마을에 부대를 두면 물건이 들어오고, 재료를 가져다주면 마을이 살아난다(△ 공략 글의 검색 요약. 쪽은 특정 못 함). | 화면이 바뀌지 않으니 맥락이 안 끊긴다. 쉬는 부대에도 일이 있다. | 우리 전장·겨루기는 이미 전투판 위에 겹쳐 뜬다. 열전도 본편 위에 겹쳐 뜬다(app.ts:4443). 좋은 꼴이다. 쉬는 장수의 일은 원정이 이미 맡는다. | 0. |
| **어쌔신 크리드 브라더후드.** 모은 암살자를 먼 임무에 보내 키운다. 평은 갈렸다: 좋은 생각이지만 덜 익었다. △ [유저 평](https://gamespot.com/assassins-creed-brotherhood/user-reviews/2200-12578180/) · ☆ [TheSixthAxis](https://www.thesixthaxis.com/?p=57607) | 모은 사람을 「보내는」 층은 싸지만 얕으면 금방 식는다. | 원정(실시간)이 이 자리다. 얕게 두고 연출만 좋게. | 0. |

### 2-F. 전략과 전투, 두 층

| 사례 [확인] | 왜 통했나(원리) | 우리에게 옮기면 | 1인 비용 |
|---|---|---|---|
| **시드 마이어의 「코버트 액션 규칙」.** 미니게임 하나하나는 나쁘지 않았는데 한 임무가 실제 시간 10분쯤 걸렸고, 끝나면 풀던 사건을 잊었다. 「해적!」은 미니게임이 「길어야 몇 분」이라 큰 그림으로 금방 돌아왔다. 문명이 싸움마다 전술 전투를 넣지 않은 까닭도 같다. ★ [소렌 존슨의 글](https://www.designer-notes.com/?p=119) 반론: X-COM과 많은 RPG는 이 규칙을 깨고도 성공했다. 진짜 문제는 찍어 낸 사건이 다 비슷했고 미니게임들이 서로를 필요로 하지 않았던 데 있다. ☆ [Digital Antiquarian](https://www.filfre.net/2017/03/24/) | 두 가지가 다 맞다. 곁 판이 길수록 돌아왔을 때 본편을 잊는다. 그리고 두 놀거리가 서로를 필요로 하지 않으면 길이와 상관없이 따로 논다. | 본편 안에서 뜨는 것은 3분 안쪽으로 지킨다(전장·저격·겨루기는 이미 그렇다). 20분 열전은 본편 「안」이 아니라 「곁」에 둔다. 돌아올 때는 하던 일을 한 줄로 되살린다. | 작다. |
| **토탈 워.** 로마 2의 스팀 전체 업적: 손으로 한 번이라도 싸운 사람 82.2%, 한 판에서 열 번 손으로 싸운 사람 42.7%. ★ [스팀 통계](https://steamcommunity.com/stats/214950/achievements) 워해머 3은 자동 전투를 누르기 전에 예상 결과와 잃을 부대를 보여 준다. △ [Gamewatcher](https://gamewatcher.com/news/total-war-warhammer-3-autoresolve-ambush-battles-withdraw) | 산 사람의 절반 넘게가 손 전투를 열 번도 안 한다(안 켠 사람도 섞인 숫자다). 그래도 시리즈는 팔린다. 「맡기기」가 있어서 두 층 가운데 좋아하는 쪽만 해도 된다. 맡기기는 숫자를 미리 보여 준다. | 우리 카드의 「장수에게 맡긴다」가 이 꼴이다. 열전 조건에도 같은 길을 둘지가 물음이다. 「전투는 운보다 통제」와도 맞는다(맡기면 숫자가 보인다). | 중간. |
| **진·삼국무쌍 엠파이어스.** 평: 전략 층은 곁다리이고 액션이 끌고 간다. 「특정 취향용」. 9 엠파이어스 평균 62점, 8 엠파이어스 68점. △ [OpenCritic](https://opencritic.com/game/12521/dynasty-warriors-9-empires/reviews) · △ [COGconnected](https://cogconnected.com/review/dynasty-warriors-9-empires-review-an-empire-divided/) (둘 다 검색 요약으로 봄) | 액션 게임에 얕은 전략을 얹으면 둘 다 반쪽이 된다. | 우리는 반대(전략이 몸, 액션이 곁)다. 몸이 얕아지지 않게 열전에 쏟는 품을 재야 한다. | 0. 품 나누기. |
| **노부나가의 야망 신생.** 가신이 스스로 움직이게 하려다 「어디까지」가 어려워, 가신은 제안하고 고르는 것은 사람이 하게 했다. 초보는 제안만 따라가도 된다. ★ [Siliconera](https://www.siliconera.com/interview-how-nobunagas-ambition-awakening-builds-on-the-past-entries/) (검색 요약으로 봄) | 모은 사람이 「말을 건다」. 다음 할 일을 사람이 내놓는다. | 군막 회의가 이 자리다. 장수가 「열전에서 몸을 풀고 싶다」고 내놓는 것도 같은 틀에 실을 수 있다. | 작다. 제안 한 종류. |
| **삼국지 8 리메이크.** 장수 한 사람으로 사는 놀이. 사이가 깊어지면 의형제·혼인 같은 일이 생긴다. ★ [GamingBolt](https://gamingbolt.com/romance-of-the-three-kingdoms-8-remake-interview-links-debates-tales-and-more) (검색 요약으로 봄) | 사람 사이의 일이 판마다 다른 이야기를 낸다. | 인연 매듭(DESIRE)이 이 자리. 이번 몫 밖. | 없음 |

### 2-G. 숙제의 폐해

| 사례 [확인] | 뜻 | 우리에게 |
|---|---|---|
| **일일 보상 연구.** 178명 설문. 같은 보상을 두고 사람들은 「동기가 된다」와 「놓칠까 불안하다·의무다·잡일이다」를 함께 느낀다. ★ [Frommel·Mandryk 2022](https://dl.acm.org/doi/abs/10.1145/3549489) ([요약](https://www.universityxp.com/research/2024/2/24/daily-quests-or-daily-pests-the-benefits-and-pitfalls-of-engagement-rewards-in-games)) | 날마다 걸리는 보상은 약도 되고 독도 된다. | 날마다·판마다 채워야 하는 연결은 넣지 않는다. |
| **구글·입소스 2026 한국 조사.** 하드코어 RPG를 해 본 사람의 24%가 떠났다. 떠난 사람의 45%가 시간 부담을 꼽았다. 「필수 플레이」가 주 12.3시간. 표본·방법은 글에 없다. 광고 상품을 알리는 글이다. ☆ [Think with Google](https://business.google.com/kr/think/consumer-insights/gaming-research-roi-of-fun/) | 「숙제」는 한국 시장에서 떠나는 첫째 까닭으로 읽힌다. | 우리 훅(뽑기 없이, 한 번 사서)과 같은 편에 선다. 「숙제 없음」을 말로 팔 수 있다. |
| **원신 4.1.** 일일 의뢰 대신 다른 활동으로 모은 점수로 같은 보상을 받게 했다. ☆ [RPG Site](https://www.rpgsite.net/news/14808-genshin-impact-version-41-will-make-it-simpler-for-players-to-do-their-dailies) | 「아무거나 놀아도 채워진다」로 숙제를 누그러뜨렸다. | 놀거리를 가로지르는 조건은 「어느 놀거리로든」 채워지게. |
| **드래곤 퀘스트 11.** 저장을 불러오면 지금까지의 줄거리를 짧게 보여 준다. 평: 쉬다 온 사람에게 큰 도움. ☆ [Destructoid](https://www.destructoid.com/review-dragon-quest-xi-echoes-of-an-elusive-age/) | 끊긴 맥락을 한 화면으로 되살린다. | 돌아온 한 줄(§5-1). |

---

## 3. 일곱 물음의 답

### ① 두 놀거리는 무엇을 주고받나. 한쪽이 숙제가 되지 않게 한 장치는

**[확인] 주고받는 것의 네 꼴**

| 꼴 | 사례 | 숙제가 되기 쉬운가 |
|---|---|---|
| 자원(돈·재료) | 문라이터의 금 · 데이브의 물고기 · 루프 히어로의 재료 | 쉽다. 값 맞추기가 곧 되풀이 횟수가 된다(문라이터 대표의 말). |
| 사람 | 용과 같이 0의 직원 · 환상수호전의 본거지 · 풍화설월의 학생 | 덜하다. 한 번 얻으면 남는다. |
| 정보·할 수 있는 일 | 페르소나의 협력자 능력 | 덜하다. 숫자가 아니라 새 선택지라서. |
| 이야기 | 하데스의 집 대사 · 궨트 상대 | 가장 덜하다. 보상이 곧 볼거리. 대신 만드는 값이 가장 크다. |

**[의견] 숙제를 막은 장치 다섯**

1. **시간을 가른다.** 같은 때에 둘을 시키지 않는다(데이브).
2. **가장자리에서만 잇는다.** 한 놀거리의 유닛을 다른 놀거리 안에 넣지 않는다(컬트).
3. **화폐를 잇지 않는다.** 잇더라도 한 방향, 작은 몫만(문라이터의 경고).
4. **열쇠는 한 번.** 한 번 채우면 끝나는 목록으로 건다(하데스 예언 목록·뱀서 해금). 날마다·판마다 다시 채우게 하지 않는다(일일 보상 연구).
5. **맡기는 길.** 싫은 쪽은 숫자를 보고 맡긴다(토탈 워).

### ② 「이거 하다 저거 하고 싶어지는」 방아쇠

| 방아쇠 | [확인] 사례 | [의견] 우리 쪽 자리 |
|---|---|---|
| 막힘 | 페르소나: 던전에 가면 하루가 다 든다. 루프 히어로: 물러날 때를 고른다 | 본편에서 칠 곳이 없는 계절(idle.ts 가 세는 「놀고 있는 계절」)에 열전을 권한다 |
| 주문 | 데이브: VIP가 기한 안에 재료를 시킨다 | 사건 카드가 열전·겨루기를 시킨다. 장수가 군막에서 청한다 |
| 보상 예고 | 하데스: 집에 가면 새 말이 있다. 뱀서: 해금 조건이 목록에 보인다 | 장수 판과 열전 결과 창에 같은 「각성 길」 칩. 한 칸 남았음을 보인다 |
| 기한 | 페르소나 달력. 데이브 잔치 | 우리는 「자리 비운 사이 위협 없음」이 원칙이라 실시간 기한은 안 쓴다. 판 안의 계절 기한(카드가 이번 계절까지)은 이미 있다 |
| 피로 바꾸기 | 하데스: 20~40분 손을 쓴 뒤 집에서 쉰다 | 머리(본편) → 손(열전·겨루기·저격) → 마음(담판·한 마디). 긴 계절 보고 뒤, 큰 싸움에서 진 뒤가 손으로 넘어갈 때다 |

[의견] 가장 값싼 방아쇠는 「보상 예고」다. 새 규칙 없이 이미 있는 숫자를 다른 화면에 한 줄 보여 주면 된다.

### ③ 건너뛰어도 되게 한 게임과 묶은 게임의 평

| 꼴 | [확인] 사례와 평 |
|---|---|
| 길목에 세움 | 풍화설월 수도원(되풀이 불만) · ZZZ TV 모드(본 줄거리에서 뺌) · FF7 리버스(가장 갈림) · 코버트 액션(만든 이 스스로 실패로 봄) |
| 건너뛰게 했고 값도 있음 | 토탈 워 자동 전투 · 궨트 · 용과 같이 곁 놀이 · 페르소나 협력자 |
| 건너뛰게 했지만 값이 없음 | 인게이지 거점(잡일·빈 껍데기라는 평) |
| 통째로 뗌 | 액트레이저 2(정체성을 잃었다는 평) |

[의견] 정리하면 세 줄이다.
- 길목에는 짧은 것만 세운다.
- 긴 것은 곁에 두되 큰 열쇠 하나를 건다.
- 싫은 사람에게는 느리지만 열려 있는 다른 길을 준다.

### ④ 전환에 드는 탭·로딩·맥락 끊김을 줄인 UI

**[확인]**
- 하데스: 죽으면 고르는 것 없이 집에 선다. 판은 문 하나로 나간다.
- 유니콘 오버로드: 싸움이 돌아다니던 지도에서 그대로 열린다.
- 워해머 3: 맡기기 전에 예상 결과를 보여 준다.
- 드퀘 11: 불러오면 지금까지를 되짚어 준다.
- ZZZ: 한 번 깬 것은 자동으로 돈다.

**[확인] 우리 쪽**
- 열전·시련은 본편 위에 겹쳐 뜬다. 페이지를 떠나지 않는다. src/ui/realm/app.ts:4443, :4479
- 시련을 이기면 그 장수 판이 열리고 각성 연출이 이어진다. src/ui/realm/app.ts:4488~4497
- 밤 판도 예전엔 페이지째 넘어갔다가 돌아오면 첫 화면이 떴는데, 겹쳐 띄우기로 바뀌었다. src/ui/realm/app.ts:4273

**[의견] 남은 빈 곳**
- 독립 열전에서 돌아왔을 때 「무엇이 바뀌었나 · 무엇을 하던 중이었나」 한 줄이 없다.
- 들어가기 전에 「이 판에서 무엇을 들고 돌아오나」가 한눈에 안 보인다(코드만 읽은 판단. 화면은 안 봤다).
- 본편에서 열전까지 실제 몇 번 누르는지, 몇 초 걸리는지는 재지 않았다. 재는 것을 권한다.

### ⑤ 짧은 판과 긴 판을 한 게임에 넣을 때의 속도

| [확인] 사례 | 짧은 것 | 긴 것 | 맞춘 법 |
|---|---|---|---|
| 해적! | 미니게임 길어야 몇 분 | 한 생애 | 짧은 것만 안에 넣음 |
| 코버트 액션 | (없음) | 임무 하나 10분쯤 | 실패. 돌아오면 사건을 잊음 |
| 하데스 | 방 한두 개는 몇 분이면 된다(평 기준) | 한 판 20~40분 | 도중에 끄고 이어 하기 |
| 뱀서 | 서두름 15분 | 30분 | 사람이 고름 |
| 페르소나 | 하루 한 칸 | 궁전 하나 | 달력이 사이를 벌림 |

**[의견] 우리에게**
- 본편 「안」에 뜨는 것은 지금처럼 3분 안쪽으로 묶는다(저격·겨루기·전장·도적 막기).
- 20분 열전은 본편 「곁」에 둔다. 계절을 넘긴 직후, 판을 끝낸 직후, 로비에서 여는 것이 자연스럽다.
- 본편이 열전을 「시킬」 때는 짧은 판을 쓴다. 옛 90초 토벌이나 3분 안쪽 선봉 돌파가 맞는 길이다(HAEBI-TRIAL 문서 끝의 논의와 같은 결론).
- 시련 8분은 애매한 구간이다. 5분 안쪽으로 줄이거나, 돌아올 때 맥락을 꼭 되살려야 한다.
- 20분 판은 도중에 이어 하기가 되어야 폰에서 안전하다.
- 「빠른 판」(10분)을 고르게 하면 본편 사이에 끼우기 쉬워진다.

### ⑥ 수집한 인물이 모든 놀거리에서 의미를 갖게 한 법

**[확인] 사례의 꼴**
- 환상수호전: 싸우는 사람 40, 안 싸우는 사람은 본거지의 일.
- 용과 같이: 곁 이야기의 사람이 사업의 직원·배의 선원.
- 페르소나: 사람마다 전투에서 쓰는 능력 하나.
- 뱀서: 인물마다 시작 무기가 다름.
- 하데스: 선물을 주면 지니고 나가는 물건을 받음(△ 공략 기준).

**[의견] 세 가지 규칙**

1. **놀거리마다 「이 사람만의 한 가지」.** 숫자 덤 말고 눈에 보이는 것 하나. 열전은 묶음이 일곱이라 200명이 겹친다. 규칙은 일곱으로 두고 겉(무기 그림·비기 이름·한 마디)을 사람마다 다르게 하는 길이 가장 싸다. 형이 짚은 골벌 범의 손톱, 고은의 부채가 바로 이 자리다. 묶음 수를 늘릴지는 다른 몫(무기·묶음 조사)에 맡긴다.
2. **쉬는 사람에게도 일.** 원정·성주·사신이 이미 있다. 더 만들 필요는 없다.
3. **어디서 봐도 같은 사람.** 초상의 무기와 열전의 무기가 다르면 다른 사람으로 보인다. 감사 문서의 19명(띠가 원화와 다름)은 연결성 문제이기도 하다.

### ⑦ 1인 개발 규모에서 실제로 통한 최소 연결

| [확인] 사례 | 최소 연결 | 왜 싼가 [의견] |
|---|---|---|
| 뱀서(한 사람이 본업 곁에 만들기 시작했다는 보도 △ [MeinMMO](https://mein-mmo.de/en/developer-built-alongside-his-work-on-his-own-game-lands-the-steam-hit-of-2022-and-quits-his-job,1010777)) | 조건 → 해금 목록 | 자료 표 하나 |
| 하데스의 예언 목록(스튜디오 작품이지만 꼴은 작다) | 놀거리를 가로지르는 체크 목록 | 자료 표와 화면 한 장 |
| 궨트(작은 무리가 남는 시간에) | 본편 여행에서 카드를 얻음 | 수집 길을 새로 안 만듦 |
| 루프 히어로(인디 팀 · 인원 미확인) | 들고 온 것 → 새로 열림 | 한 방향 고리 하나 |
| 문라이터(인디 팀 · 인원 미확인) | 금 하나 | 싸지만 노가다 위험 |
| 컬트(인디 팀 · 인원 미확인) | 이을 수 있는 데만, 6할은 버림 | 덜어 내는 것이 일 |

[의견] 1인에게 통하는 것은 다섯이다. 공유 명부(사람) · 한 번 여는 열쇠 목록 · 한 줄 예고 · 주문 카드 · 맡기는 길. 다섯 다 자료와 화면 일이고 새 규칙이 아니다. 우리에겐 명부·주문 카드·맡기는 길이 이미 있다. 빠진 것은 예고와 목록이다.

---

## 4. 형의 각성 안을 이 조사로 보면 [의견]

형의 안: 열전 3스테이지(악마 아이콘)와 본편 3연승을 둘 다 채워야 각성. 한 번 각성한 장수는 어디서든 토글. 그 뒤로는 본편 3연승만으로 각성 연출.

| 조사가 받쳐 주는 것 | 조사가 말리는 것 |
|---|---|
| 「한 번 여는 열쇠」 꼴이다. 숙제가 되는 「계속 채우는 연결」이 아니다(§3-①). | 열전 한 판이 20분이다. 장수마다라면 200명 × 20분 ≈ 67시간(단순 곱셈). 양이 숙제가 된다. |
| 양쪽을 다 해야 열리니 인게이지 꼴(값 없는 곁)은 피한다. | 액션을 안 하는 사람은 각성(이 게임의 가장 큰 순간)을 못 본다. 풍화설월·ZZZ·FF7R 꼴(길목에 세움)에 가깝다. |
| 그 뒤 판에서는 3연승만이라 판마다 열전을 되풀이하지 않는다. 풍화설월의 「회차마다 같은 수도원」을 피한다. | 「첫 각성 30분 안」(MEGAHIT §6)과 부딪힐 수 있다. 배우는 판 예외(trial-rules.ts:9)는 지켜야 한다. |

**아직 답이 없는 둘에 대한 내 생각 (근거는 약하다. 조사가 직접 답해 주지 않는다.)**

- **① 토글을 끄면 +1 도 빠지나.** 빠지지 않는 쪽을 권한다. 능력치는 그 판에서 3연승으로 번 것이고, 토글은 겉모습(초상·띠·영상)으로 둔다. 까닭: 끄면 약해지는 단추는 아무도 안 끈다. 죽은 단추가 된다. 겉모습 토글이면 「오늘은 평상복으로」가 취향이 된다. 다만 「동행은 처음 몸으로」(META §7-3)와 맞추려면, 새 판에 데려온 장수는 그 판의 3연승 전까지 능력치는 처음 몸이어야 한다.
- **② 열전에서 토글이 켜져 있으면 처음부터 각성인가.** 막대를 채우는 쪽을 권한다. 판 안에서 「각성했다」가 여러 번 터지는 것이 지금 설계의 맛이다(RAID-LINK §1). 처음부터 각성이면 그 순간이 없어진다. 토글은 「각성 모습으로 나갈지」만 정하고, 힘은 막대로 번다. 숙련 덤(막대 절반 · params.ts HAEBI_AWAKEN.mastery)은 그대로 쓸 수 있다.

---

## 5. 우리 게임에 옮길 연결 고리 후보 10개 (비용순)

전부 「있는 것을 잇는」 일이다. 새 놀거리·새 자원은 없다. 비용은 내 어림이다 [의견].

| # | 고리 | 무엇을 | 본뜬 사례 | 이미 있는 것 | 비용 | 위험 |
|---|---|---|---|---|---|---|
| 1 | **돌아온 한 줄** | 열전·시련·밤 판·도적 막기에서 본편으로 돌아오면 「무엇을 얻었나 · 무엇을 하던 중이었나」를 한 줄로. 떠나기 전 보던 판을 다시 연다 | 코버트 액션 규칙 · 드퀘 11 | 시련 귀환은 이미 그렇게 한다(app.ts:4488~4497). 로비의 걸린 일 한 줄(front.ts:211) | 아주 작다(반나절~하루) | 알림은 꼭 걷혀야 한다(메모리 규칙) |
| 2 | **서로를 가리키는 칩** | 본편 장수 판과 열전 출전·결과 창에 같은 「각성 길」 칩 한 줄. 본편 불꽃 ●●○ · 열전 표식 ✓ | 뱀서 해금 목록 · 하데스 예언 목록 | 진각성 칩(app.ts:1539) · 열전 기록(raid/meta.ts) | 작다(1~2일) | 글 대신 아이콘으로(읽지 않고 보이게) |
| 3 | **판 끝의 다음 손잡이** | 열전 결과 창 맨 아래 「본편에서 기다리는 일」 한 줄. 본편 계절 보고 끝에 「열전에서 열린 것」 한 줄 | 하데스의 집 | 로비 hook 글을 그대로 씀 | 작다(1~2일) | 줄이 늘면 난잡(FOCUS). 한 줄 상한 |
| 4 | **빠른 판** | 열전 길이 고르기(20분 / 10분). 보상은 길이에 비례 | 뱀서 서두름 | 스테이지 길이 배수(params.ts:238~250) | 작다~중간(2~3일 + 승률 다시 재기) | 밸런스 표가 두 벌 |
| 5 | **주문 카드** | 산적·반란 카드의 「맞선다」를 3분 안쪽 토벌 판으로. 「장수에게 맡긴다」는 지금 틀 그대로 | 해적!의 짧은 미니게임 · 데이브 VIP · 토탈 워 | 도적 카드 틀(cards.ts:150~154) · 옛 90초 토벌 셈이 남아 있음(params.ts:314) · RAID-LINK §5-5 에 계획 | 중간(3~5일) | 도적 막기 판과 자리 겹침. 형에게 물을 것(RAID-LINK 에도 적힘) |
| 6 | **두 길** | 열전 쪽 조건에 「손으로」 말고 느린 다른 길 하나(예: 맡기기, 또는 본편 공훈을 더 쌓기). 숫자를 보여 준다 | 토탈 워 통계 · ZZZ·풍화설월의 교훈 | 카드의 맡기기 굴림 | 중간(3~5일) | 형의 「어렵게」와 부딪힌다. 결정이 먼저 |
| 7 | **열전 공훈 한 칸** | 열전에서 이 장수로 깬 스테이지가 본편 그 장수의 표식(칭호·공훈 한 칸)으로. 금은 안 잇는다 | 용과 같이(사람이 다리) · 문라이터의 경고 | RAID-LINK §4 · 진각성 자격 옮겨 적기(app.ts:4448~4461) | 중간(3~5일 + balance) | 본편 균형. 표식부터, 능력치는 나중 |
| 8 | **장수 길 장부** | 도감 장수 칸에 놀거리를 가로지르는 줄 하나: 만남 · 사로잡음 · 거느림 · 겨루기 승 · 저격 · 열전 1·2·3 · 각성. 채우면 있는 에셋(목소리 한 줄·초상 테)을 연다 | 하데스 예언 목록 · 뱀서 · 스타듀 꾸러미(기능만 확인) | 도감(realm/dex.ts) · 목소리·초상 | 중간~크다(1~2주) | 200명 × 칸 수. 칸은 여섯 안쪽으로 |
| 9 | **계정 단위 각성 열쇠 + 겉모습 토글** | 형의 안. 명부에 「각성 해금」 표식. 판마다 3연승으로 힘을 얻고 토글은 모습 | 한 번 여는 열쇠(§3-①) | 열전 명부(raid/link.ts:9) · 판 단위 각성(heroes.ts) | 크다(1~2주 + 저장 옮기기) | 첫 30분 목표 · 동행 「처음 몸」 · 진각성 DLC 선 |
| 10 | **열전의 한 마디 이야기** | 열전을 나설 때·두목 앞·돌아와서 한 마디씩. 진 판에도 한 마디. 사람마다 세 줄 상한 | 하데스(진 판이 이야기를 민다) · 미드나잇 선즈(너무 많으면 자른다) | 장수 목소리 · cast 문서 | 크다(글·녹음. 13명이면 중간) | 대사 옮겨 치기 사고(메모리 규칙) · 사극체 |

**[의견] 차례.** 1·2·3 은 한 묶음으로 먼저 한다. 넷째부터는 §6의 물음에 형이 답한 뒤다. 9는 1~3이 깔린 뒤에 얹어야 화면이 받쳐 준다.

**[의견] 하지 말 것 (조사가 말리는 것)**

- 본편 계절 한가운데에 10분 넘는 판을 억지로 끼우기.
- 열전 금과 본편 곡식·쇠를 바꾸는 환전소.
- 날마다·판마다 다시 채워야 하는 조건.
- 열전 안에 본편 병력을, 본편 싸움 안에 열전 조작을 섞기.
- 한쪽 놀거리를 숨기고 알리기.
- 걸린 것이 없는 곁 놀거리를 「해도 되고 안 해도 되고」로만 두기.

---

## 6. 모르는 것 · 확인 못 한 것

- GDC 강연 원문(데이브 2024 · 하데스 대사 2021 · 다키스트 던전 2016)은 못 봤다. 보도와 요약만 봤다.
- 페르소나·풍화설월 감독이 「일상과 전투의 비율」을 직접 말한 글은 못 찾았다.
- 스타듀 밸리 꾸러미의 설계 의도는 출처를 못 찾았다. 기능만 안다.
- 하데스 집의 대사 고르는 규칙(우선순위)은 1차 자료로 확인 못 했다.
- 컬트의 「악마로 데려가기」는 위키가 안 열려 직접 확인 못 했다.
- 로마 2 업적 비율은 산 사람 전체가 분모다. 안 켠 사람이 섞여 있다. 「절반이 손 전투를 싫어한다」로 읽으면 과하다.
- 구글·입소스 조사는 표본과 방법이 글에 없다.
- 엠파이어스 점수, 노부나가·삼국지 8 인터뷰, FF7 다음 편 기사는 검색 요약이나 제목만 봤다.
- 우리 게임: 놀거리 사이 실제 탭 수와 걸리는 초는 재지 않았다. 도적 막기·밤 판의 한 판 길이도 못 찾았다. 열전의 도중 이어 하기 여부는 11-14 문서 기준이다.
- 「열전이 재미있는가」는 이 조사가 답하지 못한다. 형의 폰 판정과 손님 시험이 답한다.

---

## 7. 설계팀에게 넘기는 물음

1. **열전은 본편의 「안」인가 「곁」인가.** 안이면 3분 안쪽 판이 따로 필요하다. 곁이면 20분 그대로 두고 열쇠 하나만 건다. 어느 쪽인가.
2. **형의 각성 안에서 열전 조건은 장수마다인가, 계정에 한 번인가.** 장수마다면 약 67시간 분량이다. 그것이 「끝없어 보이는 수집」(M6)인가 숙제인가.
3. **액션을 안 하는 사람의 길을 줄 것인가.** 「어렵게」를 지키는 것과 「두 길」(§5-6) 가운데 무엇이 먼저인가.
4. **첫 30분 각성 목표와 새 규칙.** 배우는 판 예외는 지킨다고 보고, 1장 마한의 첫 각성(측정 25분)에도 열전 조건이 걸리는가.
5. **토글은 겉모습만인가 능력치까지인가.** 「동행은 처음 몸으로」와 어떻게 맞추나.
6. **열전에서 본편으로 넘어가는 것의 상한.** 표식(칭호·공훈 한 칸)까지인가, 능력치까지인가.
7. **빠른 판(10분)을 낼 것인가.** 낸다면 열쇠 조건에 빠른 판도 쳐 주나.
8. **시련 8분을 줄일 것인가.** 5분 안쪽으로 줄이면 본편 안에 둘 수 있다.
9. **열전 이야기의 줄 수 상한과 첫 대상.** 사람마다 세 줄, 기준 장수 13명부터가 맞는가. 다른 몫(열전 스토리 조사)의 답과 맞춰 볼 것.
10. **상점 글과 30초 예고편에 열전을 넣을 것인가.** 넣으면 훅 문장(MEGAHIT §1)이 흐려지는가, 세지는가.
11. **놀거리 사이 전환을 잴 것인가.** 본편에서 열전 첫 조작까지의 탭 수와 초를 헤드리스로 재는 도구를 둘지.
12. **무기 묶음 일곱과 「이 사람만의 한 가지」.** 겉만 다르게(그림·이름) 갈지, 묶음을 늘릴지. 무기 몫의 결론을 받아 §3-⑥과 맞출 것.

---

## 출처 목록

(열람) = 원문을 직접 열어 읽은 글. 표시가 없으면 검색 결과의 요약으로만 본 것이다.

- 시드 마이어의 규칙: https://www.designer-notes.com/?p=119 (열람) · https://www.filfre.net/2017/03/24/ (열람)
- 데이브 더 다이버: https://gamedeveloper.com/design/dave-the-diver (열람) · https://softwareengineeringdaily.com/articles/developing-dave-the-diver-with-jaeho-hwang-and-minsuk-cha/ (열람) · https://www.invenglobal.com/articles/18786/gdc24-blending-humor-and-gameplay-insights-from-dave-the-divers-session (열람)
- 컬트 오브 더 램: https://gamedeveloper.com/design/interview-corralling-the-inherent-cuteness-of-cult-of-the-lamb (열람) · https://game-wisdom.com/analysis/cult-of-the-lamb
- 문라이터: https://mcvuk.com/development-news/when-we-made-moonlighter/ (열람) · https://bonus-action.com/interview/moonlighter-2s-design-director-on-the-redesign-that-nearly-broke-him-we-owe-it-to-our-players/ (열람)
- 하데스: https://gamedeveloper.com/design/how-supergiant-weaves-narrative-rewards-into-i-hades-i-cycle-of-perpetual-death (열람) · https://www.famitsu.com/news/202107/25228163.html (열람) · https://saschb2b.github.io/game-mechanics/games/hades/death-as-narrative (열람)
- 페르소나: https://www.siliconera.com/behind-the-design-of-persona-4/ (열람) · https://gameinformer.com/b/features/archive/2017/04/06/persona-5s-most-useful-confidants.aspx (열람) · https://prismatictyrant.substack.com/p/persona-5-retrospective-part-4
- 파이어 엠블렘: https://rpgsite.net/interview/8711-fire-emblem-three-houses-interview-intelligent-systems-nintendo-talk-bringing-the-beloved-strategy-rpg-series-to-switch (열람) · https://www.laptopmag.com/reviews/fire-emblem-engage · https://www.inverse.com/gaming/fire-emblem-engage-review · https://sourcegaming.info/2022/11/15/center-stage-garreg-mach-monastery-fire-emblem-three-houses/
- 미드나잇 선즈: https://pcgamer.com/creative-director-of-midnight-suns-says-it-was-originally-even-more-talky-we-cut-30-conversations (열람 · 앞부분만) · https://www.gamedeveloper.com/design/marvel-s-midnight-suns-director-worries-the-card-mechanic-kept-players-away
- 용과 같이: https://automaton-media.com/en/interviews/like-a-dragon-developer-interview-how-did-guys-in-diapers-make-it-into-the-game-its-all-about-curating-content-with-a-clear-message-according-to-series-director-horii/ · https://progameguides.com/yakuza/how-to-unlock-all-real-estate-royale-staff-in-yakuza-0/
- 궨트: https://www.pcgamer.com/the-making-of-gwent/ · https://gamedeveloper.com/design/how-i-the-witcher-3-s-i-card-game-within-a-game-was-brought-to-life
- ZZZ: https://mein-mmo.de/en/developers-of-an-anime-rpg-talked-to-players-nearly-completely-remove-a-game-mode-after-feedback,1179457 (열람) · https://www.siliconera.com/zenless-zone-zero-to-lose-tv-mode-in-main-story/ (열람)
- FF7 리버스: https://www.laptopmag.com/reviews/final-fantasy-vii-rebirth · https://theoldschoolgamevault.com/blog/reviews/final-fantasy-vii-rebirth-minigames
- 토탈 워: https://steamcommunity.com/stats/214950/achievements (열람) · https://gamewatcher.com/news/total-war-warhammer-3-autoresolve-ambush-battles-withdraw
- 뱀파이어 서바이버즈: https://vampire-survivors.fandom.com/wiki/Stages · https://www.gamespot.com/articles/vampire-survivors-2-is-unlikely-would-to-offer-something-radical-new/1100-6511982/
- 유니콘 오버로드: https://www.rpgfan.com/review/unicorn · https://rpgamer.com/review/unicorn-overlord-review/
- 환상수호전: https://www.timeextension.com/features/the-making-of-suikoden-ii-a-jrpg-to-match-game-of-thrones-in-intrigue-and-impact · https://game8.co/games/Suikoden-2/archives/504700
- 루프 히어로: https://twinfinite.net/guides/loop-hero-return-to-camp-how/
- 일일 보상 연구: https://dl.acm.org/doi/abs/10.1145/3549489 (논문 요약 쪽을 열람: https://www.universityxp.com/research/2024/2/24/daily-quests-or-daily-pests-the-benefits-and-pitfalls-of-engagement-rewards-in-games)
- 한국 모바일 조사: https://business.google.com/kr/think/consumer-insights/gaming-research-roi-of-fun/ (열람)
- 원신 4.1: https://www.rpgsite.net/news/14808-genshin-impact-version-41-will-make-it-simpler-for-players-to-do-their-dailies
- 드래곤 퀘스트 11: https://www.destructoid.com/review-dragon-quest-xi-echoes-of-an-elusive-age/
- 액트레이저 2: https://www.timeextension.com/news/2023/01/dont-like-what-enix-did-with-actraiser-2-blame-north-american-gamers
- 브루탈 레전드: https://gamingbolt.com/brutal-legend-suffered-because-of-poor-messaging-says-tim-schafer
- 노부나가의 야망 신생: https://www.siliconera.com/interview-how-nobunagas-ambition-awakening-builds-on-the-past-entries/
- 열어 보려다 막힌 글: VGC의 미드나잇 선즈 인터뷰(403) · Push Square의 FF7 다음 편 기사(403) · 카바레 클럽 UX 분석(403) · 컬트 위키(410) · Automaton 호리이 인터뷰(본문 잘림)
