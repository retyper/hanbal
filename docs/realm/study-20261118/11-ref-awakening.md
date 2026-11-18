# 11. 참고 사례: 각성 · 변신 · 한계 돌파 (2026-11-18)

> 설계 연구 묶음 `study-20261118` 의 한 장. 맡은 것: 「각성·변신·한계 돌파」를 잘 만든 게임 조사.
> 읽는 법: 표의 첫 칸(사례)은 출처가 붙은 **확인한 사실**만 적었다. 「왜 통했나」「옮기면」「비용」 칸과 「간추림」은 **내 의견·추정**이다.
> 비용 눈금: S = 하루 안 · M = 2~4일 · L = 한 주 넘음. 그림·영상·목소리는 있는 것을 쓴다는 전제.
> 조사: 웹 검색 45번 · 원문 열기 31번(그 가운데 읽힌 것은 절반쯤, 나머지는 막혀서 검색 요약으로 봤다). 1차 자료(개발자 인터뷰·공식 설명서·공식 발표)는 **[1차]**, 위키·길잡이·기사는 표시 없음.

## 다섯 줄 요약

1. 잘 만든 게임은 **「얻는 순간」과 「켜는 순간」을 나눈다.** 얻는 것은 한 번·영구·이야기와 함께. 켜는 것은 판마다·게이지·짧게. 값 없이 판 시작부터 켜 두는 변신 사례는 못 찾았다.
2. 어려운 조건이 즐거운 때는 「좋아서 하던 놀이를 더 잘하면 열릴 때」다. 지치는 때는 「안 좋아하는 다른 모드를 깨야 핵심 힘이 나오고, 길이 하나뿐일 때」다 (PoE2 · 데스티니 2 · 포켓몬 ZA · WoW 가 모두 뒤에 물렸다).
3. 토글은 두 갈래뿐이었다. **겉모습 토글**(꺼도 힘은 남는다)과 **값 치르는 토글**(켜면 세지만 자원·위험·점수를 낸다). 「끄면 그냥 약해지기만 하는 토글」은 사례가 없었다.
4. 형의 안은 뼈대가 사례와 맞는다(두 곳에서 열쇠 → 영구 해금 → 그 뒤는 3연승만). 손볼 곳은 셋이다: 열전 3스테이지가 「하나뿐인 문」이 되는 것 · 첫 30분 각성 목표와 부딪히는 것 · 진각성 자격(목책 깸)과 열쇠가 겹치는 것.
5. 답 없는 두 물음의 권고: ① 토글은 겉모습만 바꾸고 +1 은 남긴다. ② 열전은 토글이 켜져 있어도 보통 모습으로 시작해 막대를 채운다. 영구 각성의 덤은 「막대를 덜 채워도 됨」으로 준다.

---

## 0. 우리 게임의 지금 (확인한 사실)

> **11-18 고침.** 이 표의 세 줄(얻기 · 열전 판 안 각성 · 첫 각성 목표)이 옛 문서를 믿고 틀렸다. `00-INDEX.md` §4 의 확인값과 오늘의 코드로 바로잡았고, 고친 칸마다 「11-18 고침」을 달았다. 이 장의 뒤쪽 의견(§7 의 안 A~C 등)은 고치기 전 값으로 쓴 것이라 그대로 뒀다.

| 무엇 | 지금 | 근거 |
|---|---|---|
| 본편 1차 각성 얻기 | 제 몫의 싸움을 이기면 불꽃 +1, 지거나 비기면 −1 이다. 내리 이길 필요가 없다(순증). 문턱은 불꽃 칸 3 − 첫 각성 덜기 1 = **2** 이고, 각성 전의 장수는 누구나 2다(3 이 문턱으로 쓰이는 길은 없다) → 시련 열림 → 열전 8분 시련을 이기면 각성. **(11-18 고침 · 옛 글 「내리 3승(처음만 2승)」 · 00 §4 ①)** | `src/realm/heroes.ts` 의 `battleGrowth`(:873 · :881) · `ascendNeed`(:888) · `kindle`(:898) · `src/tune/params.ts` 의 `ascendWins` · `firstAscendEase` · `ascendTrialOpen` · `src/realm/awakening-trial.ts:5-23` · `HANDOFF.md:5` |
| 각성의 상 | 능력치 모두 +1 · 각성 초상 · 불꽃 셋이 각성기 연료 | `src/realm/heroes.ts:911-921` · `src/tune/params.ts:3117` |
| 풀리나 | 안 풀린다(그 판 안에서). 지면 연료만 하나 준다. 옛 설계(져서 0이면 풀림)와 다르다 | `src/realm/heroes.ts:874-877, 923-926` · 옛 설계 `docs/realm/DESIRE.md:244` |
| 판을 넘는 기록 | 도감에 「각성해 봤다」 표시가 남는다. 다음 판의 각성 조건에는 안 쓰인다 | `src/realm/dex.ts:35, 121` |
| 열전 판 안 각성 | 늘 보통 모습으로 시작 → 막대 → 각성 단추 → 9초(무적·진 비기). **각성 전투 띠가 있는 장수만** 각성한다. 코드는 본편에서 각성했는지를 안 본다. 그 띠는 바탕 띠 12개뿐이라(00 이 셀 때는 10개 · 그림이 들어오는 중) 나머지 200여 명은 본편에서 각성했어도 영웅의 투지다. 「본편 각성 장수만」은 설계 문장이지 코드가 아니다. **(11-18 고침 · 00 §4 ②)** | `src/raid-main.ts:44` · `src/ui/realm/app.ts:4432-4433` · `src/realm/data/awakenedSpritesGenerated.ts:2` · 설계 문장 `docs/realm/RAID-LINK.md:14` · `src/tune/params.ts:212-229` |
| 열전 숙련 | 숲·여울·목책을 다 깬 장수는 막대 절반으로 시작 | `src/raid/haebi.ts:162-173` |
| 진각성 자격 | 그 장수로 열전 목책(3스테이지)을 깸 · 2차 초상 있음 · 판에 한 번 | `src/raid/link.ts:12` · `src/realm/heroes.ts:942-944` |
| 진각성은 DLC | 스위치 하나(시험 중 켜 둠). 4·5 스테이지도 함께 | `src/realm/dlc.ts:8` · `docs/realm/MONEY.md:16` |
| 첫 각성 목표 | 이 장을 쓸 때의 과녁은 첫 30분 안이었다(형 11-18 의 말로 버림 → 첫 투지 30분 안 · 첫 각성 10시간대). 「마한 25분·100%」는 11-11 에 잰 옛 값이다. 시련을 모든 장수로 넓힌 11-15 뒤로는 재는 도구가 첫 각성 0% 를 냈다(시련 장수는 불꽃이 차도 `kindle` 줄만 낸다). 도구를 고쳐 11-18 에 다시 잰 값(마한 8판 · 지금 규칙 · 괄호는 낮은 가정~높은 가정): 첫 불꽃 참 25분(13~41) · 100%, 첫 각성 34분(20~50 · 시련을 이겼다 치고 8분을 더한 보정). **(11-18 고침 · 00 §4 ③)** | `docs/realm/MEGAHIT.md` §2 ① · §6 · `docs/realm/FIRST-HOUR.md:124` · `src/realm/trial-rules.ts` · `tools/first-hour.ts` · `tools/first-hour-lib.ts` |
| 새 시스템 동결 | 있는 것을 다듬는다 | `docs/realm/MEGAHIT.md:35` |
| 열전 무기 묶음 | 일곱 | `src/raid/haebi.ts:10` |

**형의 안을 내가 읽은 꼴 (추정이 섞임)**
- 첫 각성 = 열전 3스테이지의 악마 아이콘(특별 두목으로 읽었다) + 본편 3연승 뒤 각성 단추.
- 한 번 각성한 장수는 영구. 그 뒤 판에서는 본편 3연승만 하면 각성 연출.
- 한 번 각성한 장수는 어느 모드에서건 토글로 켜고 끈다.
- 지금과 다른 점: 지금은 **판마다** 8분 시련을 다시 한다. 형 안은 시련을 「한 번만, 더 어렵게」로 바꾸고 판을 넘는 기록을 조건에 쓴다.
- 갈리는 곳: 토글이 「겉모습 스위치」인지 「각성 상태 자체를 켜는 스위치」인지는 형의 말만으로 정해지지 않는다. 답 없는 두 물음이 여기서 나온다.

---

## 1. 물음 ① 「얻는 순간」과 「켜는 순간」을 어떻게 나눴나

| 사례 · 확인한 사실 | 왜 통했나 (의견) | 우리 게임에 옮기면 (의견) | 비용 (추정) |
|---|---|---|---|
| **데빌 메이 크라이 5.** 네로의 데빌 트리거는 이야기 절정(미션 20)에 열린다. 감독은 팔을 잃는 것 같은 좌절을 앞에 깔아 그 순간에 무게를 실었다고 말했다. 그 뒤로는 게이지로 켠다. [1차] [Kotaku 감독 인터뷰](https://kotaku.com/devil-may-cry-5s-director-tells-us-how-they-made-combat-1833642299) · [GameWith 미션 20](https://gamewith.net/devil-may-cry-5/article/show/8282) | 얻는 순간은 한 번뿐이라 「사건」으로 만든다. 켜는 순간은 여러 번이라 「손맛」으로 만든다. 둘의 연출 길이가 다르다 | 영구 해금 순간에만 긴 컷인 + 그 장수 사연 한 줄. 둘째 판부터는 짧은 컷인(탭으로 끊음) | S · 그림 0 |
| **뱀파이어 서바이버즈.** 유물 「위대한 복음」을 주우면 한계 돌파가 영구로 열리고 스테이지 고르는 화면의 체크 칸으로 켠다. 아르카나도 유물 「란도마초」 하나로 영구 해금. [공식 위키](https://vampire.survivors.wiki/w/Limit_Break) · [Prima](https://primagames.com/tips/how-to-limit-break-in-vampire-survivors) · [Randomazzo](https://vampire-survivors.fandom.com/wiki/Randomazzo) | 해금이 「줍는 한순간」이라 헷갈리지 않는다. 켜는 것은 판에 들어가기 전 한 번 | 영구 기록은 도감 표시(`dex.ts:35`)를 그대로 쓴다. 토글은 장수 카드 한 곳에만 | S~M |
| **하데스.** 무기 양상은 판 밖에서 티탄의 피로 영구 해금. 신의 부름은 싸움마다 게이지를 채워 쓴다. [gamepressure 부름](https://www.gamepressure.com/hades/call-how-does-it-work/z3ec5f) · [Kotaku 숨은 양상](https://kotaku.com/how-to-unlock-all-six-hidden-weapon-aspects-in-hades-1845317453) | 판 밖 성장(영구)과 판 안 폭발(게이지)을 다른 자원으로 갈랐다 | 본편 불꽃(판 안)과 도감 기록(판 밖)을 섞지 않는다 | 0 · 지금 구조 |
| **파이어 엠블렘 인게이지.** 문장사 반지는 이야기로 얻어 계속 가진다. 인게이지는 싸움마다 게이지를 채워 켜고 3턴 간다. 개발진은 이 재미를 게임 처음부터 쓰게 했다고 말했다. [1차] [닌텐도 「개발자에게 묻다」 3편](https://www.nintendo.com/us/whatsnew/ask-the-developer-vol-8-fire-emblem-engage-part-3/) · [SVG](https://www.svg.com/1179156/how-emblem-rings-work-in-fire-emblem-engage) · [FE 위키](https://fireemblemwiki.org/wiki/Emblem_Bracelets) | 턴제에서도 「영구 소유 + 싸움마다 짧게 켬」이 선다. 처음에 맛을 보여 주니 목표가 생긴다 | 우리 본편과 가장 닮았다. 배우는 판의 말갈기 각성이 이미 「처음부터 맛보기」다 | 0 · 지금 있음 |
| **로스트아크.** 각성기는 50레벨 + 베른 뒤 트리시온의 퀘스트 사슬로 한 번 얻는다. [Maxroll](https://maxroll.gg/lost-ark/resources/awakening-guide) · [mein-mmo](https://mein-mmo.de/en/lost-ark-awakening-quest-how-to-obtain-and-start-it,785809) | 「이제 진짜 시작」의 문턱 의식 | 영구 해금 = 그 장수의 「성인식」으로 부른다 | S · 글 |
| **진·삼국무쌍.** 8편은 무쌍과 따로인 각성 게이지. 오리진은 무쌍 게이지를 태우는 「무신 각성」이고 진 무쌍 난무는 그 안에서만 나간다. [코에이 위키(8편)](https://breezewiki.discard.no/koei/wiki/Musou) · [Game8](https://game8.co/games/Dynasty-Warriors-Origins/archives/494213) · [Prima](https://primagames.com/tips/all-musou-abilities-and-ultimates-in-dynasty-warriors-origins-explained) | 가장 큰 한 방을 각성 안에 숨겨 「각성 → 한 방」 두 박자 | 열전의 「진 비기는 각성 중에만」과 같은 꼴 | 0 · 지금 있음 |
| **페르소나 5 로열.** 동료의 2차 각성은 코옵 10랭크에서 영구로 열린다. 3차는 3학기에 한 번 더 만나야 한다. [Prima](https://primagames.com/gaming/persona-5-royal-confidant-guide-emperor-yusuke-kitagawa) · [Inverse](https://inverse.com/gaming/persona-5-royal-third-semester-guide-secret-ending) | 각성이 「그 사람 이야기의 끝」이다. 숫자가 아니라 관계로 얻는다 | 영구 해금 조건 한 칸을 정(인연)으로 둘 수 있다 | M |
| **던전앤파이터.** 진각성은 100레벨에 얻는다. 진각성기는 쿨 270초의 긴 한 방이다. [나무위키 던전앤파이터/각성](https://namu.wiki/w/%EB%8D%98%EC%A0%84%EC%95%A4%ED%8C%8C%EC%9D%B4%ED%84%B0/%EA%B0%81%EC%84%B1) | 큰 연출은 드물어야 값지다 | 진각성 「판에 한 번」(지금 됨)을 지킨다 | 0 |

**간추림 (의견).** 변신·폭발 꼴 여섯(DMC5 · 하데스 · FE 인게이지 · 로스트아크 · 무쌍 · 던파)은 모두 영구 해금 뒤에도 판마다 채워서 켠다. 나머지 둘은 결이 다르다: 페르소나의 2차 각성은 켜고 끄는 것이 없는 영구 진화이고, 뱀서는 판에 들어가기 전의 체크 칸이다. 「영구 해금 = 얻는 시련을 다시 안 겪어도 됨」이고 「영구 해금 ≠ 늘 켜짐」이다.

---

## 2. 물음 ② 얻는 조건이 어려울 때: 즐기는 꼴과 지치는 꼴

### 즐기는 꼴

| 사례 · 확인한 사실 | 왜 통했나 (의견) | 우리 게임에 옮기면 (의견) | 비용 (추정) |
|---|---|---|---|
| **하데스 숨은 양상.** 티탄의 피를 다섯 쓴 뒤, 정해진 인물에게 말을 걸어 「깨우는 말」을 들어야 열린다. 대화는 판을 돌 때마다 무작위로 나온다. [Kotaku](https://kotaku.com/how-to-unlock-all-six-hidden-weapon-aspects-in-hades-1845317453) · [Shacknews](https://shacknews.com/article/121824/how-to-unlock-hidden-aspects-hades) | 조건이 평소 하던 일(달리기·말 걸기) 위에 얹힌다. 따로 숙제가 없다 | 그 장수의 「깨우는 한마디」를 본편 사건 한 장으로. 대사는 cast 문서에서 | M · 그림 0 |
| **엘든 링 나이트레인 「추억」.** 그 캐릭터로 밤의 왕을 잡으면 일지 장이 열린다. 일지에서 시작하고, 목표는 대부분 평소 원정 안에 표시 하나로 나온다. 상은 전용 유물과 옷. [eldenring.wiki.gg](https://eldenring.wiki.gg/wiki/Nightreign:Remembrance_Quests) | 새 모드를 짓지 않았다. 평소 판에 목표 하나를 얹었다. 상이 그 캐릭터 전용이라 애착이 붙는다 | 「열전마다 스토리」의 가장 싼 꼴: 열전 평소 판에 그 장수만의 목표 표시 하나 + 깨면 사연 한 줄 | M · 장수당 글 몇 줄 |
| **테일즈위버.** 2차·3차 각성은 외전 챕터를 깨야 한다. 1차는 뒤에 205레벨 자동 보상이 됐다. [나무위키 테일즈위버/시스템](https://namu.wiki/w/%ED%85%8C%EC%9D%BC%EC%A6%88%EC%9C%84%EB%B2%84/%EC%8B%9C%EC%8A%A4%ED%85%9C) | 각성이 이야기 한 장의 끝과 묶인다. 낮은 단은 시간이 가면 그냥 준다 | 1차는 쉽게, 깊은 단만 이야기 관문으로 | 0 · 방향 |
| **킹덤 하츠 2 파이널 폼.** 록서스전 뒤, 다른 폼으로 변신할 때 확률로 처음 열린다. [KH 위키](https://www.khwiki.com/Final_Form) | 예고 없는 놀라움 | 우리는 「운보다 통제」라 확률 해금은 안 맞는다. 참고만 | 쓰지 않음 |

### 지치는 꼴

| 사례 · 확인한 사실 | 왜 지쳤나 (의견) | 우리가 피할 것 (의견) |
|---|---|---|
| **던파 각성 퀘스트.** 처음엔 결투장 승점·재료·던전 반복이었다. 2011 → 2020 → 2022 → 2024 로 줄였고 2026-03-26 에는 퀘스트 없이 자동이 됐다. [나무위키](https://namu.wiki/w/%EB%8D%98%EC%A0%84%EC%95%A4%ED%8C%8C%EC%9D%B4%ED%84%B0/%EA%B0%81%EC%84%B1) | 캐릭터마다 같은 숙제를 되풀이. 15년에 걸쳐 0이 됐다 | 장수 200명에게 같은 시련을 판마다 다시 시키는 것(지금 구조의 약점) |
| **패스 오브 엑자일 2 전직 시련.** 전직 점수(핵심 힘)가 함정·무작위 저주 관문 뒤에 있다. 운에 좌우됨 · 근접 불리 · 지면 처음부터가 불만이다. [poe-vault](https://www.poe-vault.com/poe2/news/poe2-ascendancy-trials-feel-like-a-debuff-roulette) · [공식 포럼](https://pathofexile.com/forum/view-thread/3644015) | 본편과 다른 놀이를 「꼭」 깨야 한다. 실패가 남기는 게 없다 | 열전 3스테이지를 1차 각성의 하나뿐인 문으로 두는 것 |
| **용과 같이 0 전설 스타일.** 부동산·캬바레 경영 이야기를 끝내야 열린다. 열고 보니 다른 스타일보다 약하게 느꼈다는 글이 있다. [TheGamer](https://www.thegamer.com/yakuza-0-zero-real-estate-royale-guide/) · [Steam 토론](https://steamcommunity.com/app/638970/discussions/0/1743343017618287332) | 오래 걸려 얻었는데 쓸 곳이 적고 기대보다 약하다 | 어렵게 얻은 각성이 +1 뿐이면 같은 실망. 상은 연출·새 놀이로 크게 |

**간추림 (의견).** 즐거운 어려움은 「숙련」이고 지치는 어려움은 「횟수」다. 조건을 어렵게 할 거면 **한 번만** 어렵게, 그리고 **져도 남게**.

---

## 3. 물음 ③ 토글을 준 게임은 왜 줬고, 끄면 힘도 빠지나

| 사례 · 확인한 사실 | 토글의 목적 | 끄면 힘은? | 우리 게임에 옮기면 (의견) | 비용 (추정) |
|---|---|---|---|---|
| **파이어 엠블렘 히어로즈 「리스플렌던트」.** 새 옷 + 능력치 모두 +2. 옷을 입힐지는 고르는 것이고, 구독을 끊어도 캐릭터·옷·+2 는 남는다. [Siliconera](https://siliconera.com/?p=846830) · [TouchTapPlay](https://www.touchtapplay.com/what-is-a-resplendent-hero-in-fire-emblem-heroes/) | 겉모습 취향 | **남는다** | 각성 토글 = 초상·전투 띠·영상·목소리만 바꿈. +1 은 남김 | S~M |
| **킹덤 하츠 2.** 폼을 키워 얻는 성장 능력(글라이드 등)은 보통 모습 소라에게도 남는다. [KH 위키](https://www.khwiki.com/Final_Form) | 변신을 안 써도 손해가 아니게 | **남는다** | 위와 같음 | 0 |
| **뱀파이어 서바이버즈.** 하이퍼·허리·인버스·엔드리스·한계 돌파·아르카나가 모두 「영구 해금 뒤 스테이지 고르는 화면에서 켜는 것」이다. 하이퍼는 금·행운 덤이 붙는다(길잡이 기준 · 수치는 스테이지마다 다름). [Prima 모드 풀기](https://primagames.com/tips/how-to-unlock-all-stages-and-modes-in-vampire-survivors-answered-explained) · [Prima 하이퍼](https://primagames.com/gaming/how-to-unlock-hyper-mode-in-vampire-survivors) · [공식 위키](https://vampire.survivors.wiki/w/Limit_Break) | 난이도와 상을 유저가 고름 | 그 판의 규칙이 바뀐다(고른 값) | 「힘까지 끄기」는 상이 붙는 도전 토글로 따로. 출시 뒤 | M |
| **하데스 2 아르카나.** 「쥠」 한도 안에서 카드를 켜고 끈다. 판 사이 제단에서만. [Maxroll](https://maxroll.gg/hades-2/guides/hades-2-arcana-guide) · [Siliconera](https://www.siliconera.com/how-to-increase-grasp-in-hades-2/) | 예산 안에서 빌드 짜기 | 꺼진 카드는 효과 없음(대신 다른 걸 켬) | 한 싸움에 각성 장수 수를 묶는 꼴. 새 시스템이라 지금은 안 함 | 쓰지 않음 |
| **데빌 메이 크라이 5 슈퍼 코스튬.** 무한 데빌 트리거. 대신 점수 −80%. [samurai-gamers](https://samurai-gamers.com/devil-may-cry-5/how-to-unlock-super-mode) · [Steam 토론](https://steamcommunity.com/app/601150/discussions/0/1850323802578258816) | 다 깬 사람의 놀이 | 켠 쪽이 값(자랑 점수)을 낸다 | 늘 켜진 각성은 값이 있어야 한다는 근거 | 참고 |
| **몬스터 헌터 쌍검 귀인화.** 켜면 스태미나가 계속 준다. 그동안 때리면 귀인 게이지가 차고, 다 차면 스태미나를 그만큼 안 쓰고도 귀인화의 이점을 누리는 강화 상태가 된다. 그 게이지도 천천히 준다. [gamerguides](https://gamerguides.com/monster-hunter-rise/guide/weapons/dual-blades) · [TheGamer](https://www.thegamer.com/monster-hunter-rise-sunbreak-dual-blades-weapon-guide-abilities-tips/) | 켜고 끄는 박자가 곧 놀이 | 켠 쪽이 값(스태미나)을 낸다 | 열전 각성 단추의 「지금 누를까」와 같은 결 | 0 |
| **디지몬 서바이브.** 싸움 중 진화·퇴화가 자유다. 진화에 SP, 유지에 턴마다 SP. 모자라면 성장기로 돌아간다. 싸움이 끝나면 원래 모습. [PCGamesN](https://www.pcgamesn.com/digimon-survive/evolution) · [TheGamer](https://www.thegamer.com/digimon-survive-digivolution-guide-mature-perfect-ultimate-enlightenment-slab-farming/) | 턴제에서의 「됐다 풀렸다」 | 켠 쪽이 값(턴마다 SP)을 낸다 | 형이 말한 디지몬식의 턴제 꼴. 본편 불꽃 연료가 이미 이 자리 | 0 |
| **로스트아크 버서커 「광기」.** 폭주를 늘 켜 둔다. 대신 최대 체력이 25%로 묶인다. [Fextralife](https://lostark.wiki.fextralife.com/Mayhem) · [Maxroll](https://maxroll.gg/lost-ark/build-guides/mayhem-berserker-raid-guide) | 늘 켜짐을 고르는 빌드 | 늘 켜짐의 값(체력) | 「처음부터 각성」은 큰 값을 매길 때만 선다 | 참고 |

**간추림 (의견).**
- 토글을 준 까닭은 셋이다: 겉모습 취향 · 난이도와 상 고르기 · 자원 박자.
- 겉모습 토글은 힘이 **남는다.** 힘 토글은 **켠 쪽이 값을 낸다.** 「얻은 힘을 끄면 그냥 약해지는」 토글은 찾지 못했다. 끌 까닭이 없어 토글이 죽기 때문으로 본다.
- 그러니 먼저 정할 것은 **토글의 목적**이다. 형의 말만으로는 겉모습인지 난이도인지 알 수 없다.

---

## 4. 물음 ④ 변신에 값을 매긴 방식과 「아껴 뒀다 터뜨리는」 손맛

| 사례 · 확인한 사실 | 왜 통했나 (의견) | 우리 게임에 옮기면 (의견) | 비용 (추정) |
|---|---|---|---|
| **하데스 부름.** 게이지 한 칸으로 작은 부름, 꽉 채우면 큰 부름. 싸움이 끝나면 게이지가 비워진다(길잡이 기준). [gamepressure](https://www.gamepressure.com/hades/call-how-does-it-work/z3ec5f) · [Prima](https://primagames.com/gaming/hades-guide-call-aid-super-god-gauge) | 조금씩 쓸지 모아 쓸지가 한 싸움 안의 판단. 못 가져가니 아끼다 못 쓰는 일이 없다 | 열전 막대는 판이 끝나면 사라지니 같은 꼴. 본편 불꽃은 넘어가므로 「마지막 불꽃은 못 태움」을 지킨다 | 0 |
| **FE 인게이지.** 3턴. 지도 위 「문장 에너지」 칸에서 턴을 끝내면 게이지가 다 찬다. 어려운 난이도에서 생각 없이 켜면 포위된다고 개발진이 말했다. [1차] [닌텐도](https://www.nintendo.com/us/whatsnew/ask-the-developer-vol-8-fire-emblem-engage-part-3/) · [FE 위키](https://fireemblemwiki.org/wiki/Emblem_Bracelets) | 충전이 **자리(지형)** 와 묶여 지도 읽기가 된다. 짧아서 언제 켤지가 판단 | 본편에서 불꽃 하나를 땅·사건으로도 얻게(소도·신목 같은 있는 자리). 「규칙은 지도에 보이게」와 맞음 | M |
| **드래곤볼 파이터즈 스파킹.** 한 라운드에 한 번. 남은 캐릭터가 적을수록 오래 간다. [DBFZ 위키](https://dragonballfighterz.fandom.com/wiki/Sparking_Blast) | 밀릴수록 값진 한 번 = 역전의 맛 | 진각성 「판에 한 번」에 「밀리는 싸움일수록 길게」를 얹을 수 있다 | S~M |
| **갓 오브 워 스파르탄 레이지.** 역전 수단으로 되살렸고 팀이 붙인 말은 「상자에서 튀어나온 괴물」이다. [Game Revolution](https://www.gamerevolution.com/originals/525661-god-of-war-axe-origins-anniversary) (본문은 못 열었다 · 검색 요약) | 켜는 순간의 과장이 곧 상 | 「WWE 오버액션」 원칙과 같다. 켜는 0.5초에 판이 느려지고 둘레를 친다(열전에 있음) | 0 |
| **킹덤 하츠 2 안티 폼.** 변신을 쓸수록 점수가 쌓여 0% → 10% → 25% 로 약한 폼이 대신 나온다. 새 폼을 열면 0. [KH 위키](https://www.khwiki.com/Antiform) | 남용에 값. 하지만 운이다 | 우리 원칙(운보다 통제)과 안 맞는다 | 쓰지 않음 |
| **진·삼국무쌍 오리진.** 무쌍 게이지를 태워 무신 각성. 다 닳으면 끝. [Game8](https://game8.co/games/Dynasty-Warriors-Origins/archives/494213) | 작게 여러 번 대 크게 한 번 | 열전: 비기와 각성이 따로 차는 지금 꼴이 더 쉽다. 그대로 | 0 |
| **나이트레인 궁극기.** 싸우는 동안 저절로 차고 때리면 더 빨리 찬다. [eldenring.wiki.gg](https://eldenring.wiki.gg/wiki/Nightreign:Ultimate_Art) | 가만히 있어도 차니 「언젠가는 쓴다」 | 열전 막대도 처치로 찬다. 같은 꼴 | 0 |
| **던파 진각성기.** 쿨 270초. 1·2차 각성기 중 하나를 내려놓아야 쓴다. 디렉터는 긴 연출이 겹쳐 액션이 죽는 것을 막으려 했다고 설명했다. [나무위키](https://namu.wiki/w/%EB%8D%98%EC%A0%84%EC%95%A4%ED%8C%8C%EC%9D%B4%ED%84%B0/%EA%B0%81%EC%84%B1) | 큰 연출은 하나씩만 | 열전의 「각성 컷인과 비기 컷인이 안 겹침」(RAID-LINK.md:19)과 같다 | 0 |
| **아끼다 못 쓰는 병.** 귀하고 한 번뿐인 것은 끝까지 안 쓴다. 풀이는 다시 차는 힘과 넉넉함이다. [Game Developer](https://gamedeveloper.com/design/avoiding-the-hoarder-trap-in-game-design) · [TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/Main/TooAwesomeTouse) | 다시 찬다는 믿음이 있어야 쓴다 | 불꽃이 「이기면 다시 붙는다」를 화면에서 바로 보이게 | S |

**간추림 (의견).** 손맛의 공식은 다섯이다. ⑴ 차는 게 보인다 ⑵ 다 차면 「지금」 단추 ⑶ 켠 동안은 확실히 세다 ⑷ 짧다 ⑸ 안 쓰면 사라지거나 금방 다시 찬다. 열전은 다섯을 다 갖췄다. 본편 각성기는 ⑵ 와 ⑷ 를 눈으로 다시 볼 만하다(이 장에서는 화면을 띄워 보지 않았다).

---

## 5. 물음 ⑤ 두 모드에 걸친 해금 (이 모드에서 열쇠, 저 모드에서 문)

### 반응이 좋았던 쪽

| 사례 · 확인한 사실 | 왜 통했나 (의견) | 우리 게임에 옮기면 (의견) | 비용 (추정) |
|---|---|---|---|
| **페르소나 5.** 일상의 관계(코옵)가 페르소나의 힘과 동료 각성을 연다. 감독은 유저가 인물에 공감하는 것을 가장 중요하게 봤다고 말했다(인터뷰 둘은 검색 요약으로 봄). [Vice 감독 인터뷰](https://vice.com/en/article/precious-moments-hype-and-high-school-a-conversation-with-persona-5-director-katsura-hashino) · [Siliconera 감독 인터뷰](https://www.siliconera.com/persona-5-director-voluminous-content-characters-social-link-system/) · [Prima](https://primagames.com/gaming/persona-5-royal-confidant-guide-emperor-yusuke-kitagawa) | 열쇠 모드가 그 자체로 상(이야기)을 준다. 두 모드가 같은 자원(날짜)을 나눠 써서 「이거 하다 저거」가 저절로 된다 | 열쇠 쪽(열전)이 그 자체로 상을 줘야 한다: 그 장수 사연 한 줄 · 전용 칭호 | M |
| **하데스.** 판에서 얻은 것으로 집에서 열고, 집의 대화가 다시 판으로 보낸다. 죽어도 「쓴 시간이 헛되지 않게」가 목표였다. [1차] [Game Developer](https://gamedeveloper.com/design/how-supergiant-weaves-narrative-rewards-into-i-hades-i-cycle-of-perpetual-death) | 실패한 판도 열쇠를 조금 준다 | 악마 두목에게 진 판도 진척이 남게(소울류 원칙과 같음) | S~M |
| **나이트레인 추억.** 일지(거점)에서 시작하고 평소 원정 안에서 푼다. [eldenring.wiki.gg](https://eldenring.wiki.gg/wiki/Nightreign:Remembrance_Quests) | 문과 열쇠가 같은 놀이 안에 있다 | 본편 사건 카드 「맞선다」를 열전 한 판으로(RAID-LINK.md:94 에 이미 안이 있다) | M |
| **삼국지 조조전 온라인.** 연의(이야기 판)를 깨면 보물이 나오고 그것이 승급에 쓰였다. 연의는 재미있다는 평이 많았고, 지친 것은 사건 반복이었다. 2020-06-11 서비스 종료. [나무위키](https://namu.wiki/w/삼국지조조전%20Online) | 이야기 판이 열쇠일 때는 불만이 적었다. 반복 판이 열쇠일 때 지쳤다 | 열쇠는 「한 번 깨는 판」으로. 「여러 번 도는 판」으로 두지 않는다 | 방향 |

### 반발이 컸던 쪽

| 사례 · 확인한 사실 | 무슨 일이 났나 | 결국 어떻게 고쳤나 |
|---|---|---|
| **데스티니 2 정점 무기.** PvE 에서도 가장 좋은 무기가 PvP 퀘스트 뒤에 있었다. [Shacknews](https://shacknews.com/article/114211/pinnacle-weapons-are-leaving-destiny-2) · [mein-mmo](https://mein-mmo.de/en/pve-players-hate-being-forced-into-pvp-in-destiny-2,307521) | 번지 스스로 「플레이어 생태계에 문제」라고 했다. 좋은 장비를 원하면 PvP 로 내몰렸다 | 2019년 제도를 없앴다. 대체품은 고유 효과가 없고 퀘스트도 줄였다 |
| **WoW 격전의 아제로스 정수.** PvE 에 중요한 정수가 PvP 명예 뒤에 있었다. [mein-mmo](https://mein-mmo.de/en/after-long-begging-from-the-fans-wow-finally-nerfs-the-honor-grind-for-pvp-essences,425591) | 몇 달 동안 원성 | 필요 명예를 크게 줄였다 |
| **포켓몬 레전드 ZA.** 칼로스 스타팅 셋의 메가스톤은 온라인 랭크전으로만 얻는다. 유료 온라인이 있어야 한다. [GamesRadar](https://www.gamesradar.com/games/pokemon/pokemon-legends-z-a-locks-the-mega-evolutions-for-the-kalos-starters-to-ranked-seasons-making-them-impossible-to-get-without-paying-for-nintendo-switch-online) · [Siliconera](https://www.siliconera.com/pokemon-legends-z-a-ranked-battle-mega-stone-bug-confirmed/) | 혼자 하는 게임의 「변신」이 대전 뒤에 잠겼다는 반발 | 다음 시즌에 필요한 등급을 낮췄다 · [GamesRadar](https://www.gamesradar.com/games/pokemon/pokemon-legends-z-as-first-update-eases-the-grind-for-its-best-mega-evolution-stones-and-flattens-a-nasty-bug-that-stops-players-from-catching-pokemon-entirely) |
| **PoE2 전직 시련.** 2장에 적음 | 「핵심 힘의 문」이 다른 놀이 | (이 조사에서 공식 답은 못 찾음) |

**갈린 까닭 (의견)**

| | 호평 쪽 | 반발 쪽 |
|---|---|---|
| 열쇠 모드 | 그 자체로 상이 있다(이야기·수집) | 취향이 크게 갈리는 다른 장르 |
| 문 뒤의 것 | 새 놀이 · 겉모습 · 그 캐릭터 전용 | 모두가 써야 하는 핵심 힘 |
| 길 | 둘 이상이거나 하기만 해도 참 | 하나뿐 + 실력 관문 |
| 지면 | 조금이라도 남는다 | 처음부터 다시 |

**형의 안에 대어 보면 (의견).** 열전은 실시간 액션이고 본편은 턴제 전략이다. 장르가 다르다(반발 쪽 한 칸). 문 뒤의 1차 각성은 능력치 +1 과 각성기라 힘이다(한 칸). 길은 하나다(한 칸). 세 칸이 반발 쪽이다. 낮추는 손잡이는 넷이다: 져도 진척이 남게 · 길을 둘로 · 문 뒤 힘은 작게 연출은 크게 · 열전을 맡길 수 있게.

---

## 6. 물음 ⑥ 2차 변신(진각성)을 파는 방식과 반발을 피한 법

| 사례 · 확인한 사실 | 반응 | 우리에게 뜻하는 것 (의견) |
|---|---|---|
| **몬스터 헌터 라이즈 선브레이크.** 캡콤은 「대형 유료 확장」이라 불렀고 본편이 있어야 한다. 첫 주 200만, 누적 1천만. 평은 좋았다. [1차] [캡콤 IR](https://www.capcom.co.jp/ir/english/news/html/e220713.html) · [Gematsu](https://www.gematsu.com/2025/06/monster-hunter-rise-sunbreak-expansion-sales-top-10-million) | 호평 | 「잠긴 것 풀기」가 아니라 「새로 지은 땅」으로 판다. 설원·산성·새 적이 앞에, 진각성은 그 땅의 상으로 |
| **뱀파이어 서바이버즈 DLC.** 1.99달러에 스테이지 하나 · 캐릭터 여덟 · 무기 열셋. [Engadget](https://www.engadget.com/vampire-survivors-dlc-legacy-of-moonspell-194536374.html) | 호평 | 값이 놀랄 만큼 싸면 의심이 없다. 인디에 맞는 길 |
| **무쌍 오로치 3 Ultimate.** 가진 사람용 업그레이드 팩 39.99달러. 「비싼 얹음」 평. 신격화는 일부 캐릭터만 각성 중에 된다. [TheSixthAxis](https://www.thesixthaxis.com/2020/02/17/warriors-orochi-4-ultimate-review-expensive-icing-on-a-rich-cake/) · [1차] [공식 설명서](https://www.koeitecmoamerica.com/manual/wo4/2500.html) | 값 불만 | 2차 모습 묶음의 값은 본편의 일부여야 한다 |
| **파이어 엠블렘 히어로즈.** 능력치 +2 가 붙은 유료 옷(달 구독). 발표 영상 싫어요 1만, 좋아요의 두 배. [NintendoSoup](https://nintendosoup.com/fire-emblem-heroes-latest-feh-channel-has-over-10k-dislikes-on-youtube/) | 큰 반발 | 2차 모습에 **힘을 붙여 팔면** 돈 내고 이기기로 읽힌다. MONEY 의 「힘은 안 판다」와 부딪힌다 |
| **스트리트 파이터 X 철권.** 디스크에 이미 든 캐릭터 열둘을 잠가 두고 DLC 로 팔았다. 캡콤은 처음엔 「전달 방식만 다르다」고 했다가 정책 재검토를 발표했다. [GameSpot](https://www.gamespot.com/articles/capcom-revising-on-disc-dlc-stance/1100-6376788/) · [MCV](https://mcvuk.com/business-news/publishing/capcom-re-evaluating-on-disc-dlc/) · [Engadget](https://www.engadget.com/2012/04/03/report-capcom-sees-no-distinction-between-on-disc-and-off-dis/) | 큰 반발 | 진각성 그림·영상이 본편 빌드에 들어 있고 스위치로만 잠기면(`dlc.ts:8`) 같은 꼴로 읽힐 수 있다 |
| **포켓몬 레전드 ZA 「메가 디멘션」.** 본편이 나오기 전에 유료 확장을 알렸다. 29.99달러. [mein-mmo](https://mein-mmo.de/en/nintendo-shows-first-dlc-for-pokemon-legends-z-a-before-the-game-has-even-been-released-and-players-are-raging,1525418) | 반발 | 발표 때가 중요하다. 본편이 완결로 받아들여진 뒤에 알린다(MONEY.md:16 「본편 출시 뒤」가 맞다) |
| **던파 진각성.** 무료. 2020-08 부터 2021-05 까지 직업별로 차례차례. 순서·기다림·격차(진각 여부로 파티를 거름) 논란. 전용 이야기가 없다는 비판을 2021·2024 에 메웠다. [나무위키](https://namu.wiki/w/%EB%8D%98%EC%A0%84%EC%95%A4%ED%8C%8C%EC%9D%B4%ED%84%B0/%EA%B0%81%EC%84%B1) | 갈림 | 무료여도 「누구는 있고 누구는 없다」가 불만이 된다. 진각성 그림이 없는 장수의 빈칸을 보이지 않게(DESIRE §17 끝줄과 같다) |

**반발을 피하는 다섯 (의견)**
1. 출시 빌드에서 진각성 그림·영상 **파일을 뺀다.** 사면 내려받는다. 포장 용량(영상 0.96GB · MEGAHIT.md §7)도 준다.
2. 본편만 가진 사람의 장수 카드에는 진각성 **칸을 안 보인다.** DESIRE §17 의 「처음부터 걸린 실루엣」은 DLC 가 된 지금 다시 봐야 한다.
3. 진각성의 싸움 효과는 **힘이 아니라 다른 맛**으로. 또는 DLC 땅(설원·산성)에서만 뜻이 큰 힘으로.
4. 묶음 이름을 「진각성 풀기」가 아니라 **새 땅 이름**으로. 진각성은 그 땅의 상.
5. 본편의 1차 각성이 **그 자체로 끝난 이야기**여야 한다(영상·사연·각성기까지).

---

## 7. 형의 안에 대한 권고 (의견)

### 7-1. 형 안에서 사례가 받쳐 주는 것
- **한 번 어렵게, 그 뒤는 가볍게.** DMC5·뱀서·로스트아크가 이 꼴이다. 지금의 「판마다 8분 시련 다시」보다 되풀이가 준다. 던파가 15년 걸려 간 방향이기도 하다.
- **두 컨텐츠가 서로의 까닭.** 페르소나·하데스의 고리와 같다. RAID-LINK §0 의 방향 그대로다.
- **3연승 뒤 「각성 단추」.** 열전의 각성 단추와 같은 말이 본편에도 생긴다. 유저가 누르는 순간이 생긴다.

### 7-2. 걸리는 것
1. **하나뿐인 문.** 5장의 반발 쪽 세 칸에 든다.
2. **첫 30분.** MEGAHIT 은 첫 각성 30분 안을 건다. 형 안은 첫 「진짜」 각성이 열전 3스테이지 뒤로 간다.
3. **진각성과 겹침.** 지금 진각성 자격이 「목책(3스테이지) 깸」이다. 1차의 열쇠가 같은 곳이면 둘이 한날에 열린다.
4. **200명.** 장수마다 3스테이지를 깨야 하면 한 명에 적어도 한 판(독립 열전 20분 · HANDOFF.md:6)이다. 스테이지 열림이 장수 단위인지 계정 단위인지는 확인하지 못했다.

### 7-3. 세 안

**안 A. 형 안 + 안전 장치 넷 (권함)**
- 첫 각성(영구): 그 장수로 3스테이지의 악마 두목을 쓰러뜨림 + 본편 3연승 → 각성 단추 → 긴 컷인과 사연 한 줄 → 도감에 영구.
- 그 뒤 판: 본편 3연승 → 각성 단추 → 짧은 컷인. 시련 없음.
- 안전 장치
  - ㉠ **져도 찬다.** 악마 두목에게 진 판도 진척이 남는다(예: 질 때마다 두목 체력이 조금 깎인 채 시작). 근거: 하데스 「헛되지 않게」 · 우리 소울류 원칙.
  - ㉡ **첫 맛은 공짜.** 배우는 판의 말갈기와 1장 주인공 한 명은 옛 길로 첫 30분 안에 각성. 근거: FE 인게이지 「처음부터」 · MEGAHIT.md:77.
  - ㉢ **진각성 열쇠는 DLC 스테이지로.** 1차 = 3스테이지, 2차 = 설원·산성. 겹침이 풀리고 DLC 가 「새 땅」이 된다.
  - ㉣ **문 뒤 힘은 지금처럼 작게(+1).** 크게 주는 것은 연출·영상·진 비기.
- 바꾸는 곳(추정): `heroes.ts` 의 `kindle`·`ascendNeed` · `awakening-trial.ts` · `raid/link.ts` 의 `SEAL_STAGE` 를 1차·2차 둘로 · 열전 3스테이지 두목 표시. 영구 기록은 판 시작 때 판 데이터로 복사한다(`raidSeals` 가 이미 그 방식이다 · 결정론 A1).
- 비용: M~L · 그림 0~1장(악마 아이콘).

**안 B. 길 둘 (열전을 안 하는 사람도 닿게)**
- 빠른 길: 열전 3스테이지 악마 한 번.
- 느린 길: 본편만으로. 예: 그 장수가 서로 다른 세 판에서 3연승 각성을 해냄.
- 근거: 데스티니 2·포켓몬 ZA·WoW 가 반발 뒤 간 방향. mein-mmo 글의 제안도 「두 길 다 두되 한쪽이 빠르게」다.
- 약점: 형의 「양 컨텐츠에서 조건을 채워야」가 흐려진다.
- 비용: M.

**안 C. 가장 작게 (지금 것 + 영구 기억)**
- 지금 구조(3연승 → 8분 시련 → 각성)를 둔다. 바꾸는 것은 하나: 도감에 각성 기록이 있는 장수는 다음 판부터 시련을 건너뛴다(3연승 → 단추 → 짧은 컷인). 토글을 더한다.
- 근거: MEGAHIT 「새 시스템 동결」. 첫 30분 수치(25분·100%)가 안 깨진다. (11-18 고침: 25분은 시련을 넓히기 전의 옛 값이다. 지금 규칙은 보정 34분이고 그 과녁도 버려졌다 · §0 표)
- 약점: 형이 바란 「어렵게」가 없다. 독립 열전으로 갈 까닭이 여전히 약하다.
- 비용: S~M.

**차례 권고.** C 를 먼저 넣고(영구 기억 + 토글), 그 위에 A 의 악마 두목을 얹는다. ㉠ 과 ㉡ 없이 A 를 넣는 것은 B 보다 위험하다고 본다.

### 7-4. 답 없는 두 물음

**물음 ① 토글을 끄면 +1 도 빠지나 → 권고: 안 빠진다. 토글은 겉모습만.**
- 겉모습 토글 사례(FE 히어로즈 · 킹덤 하츠 2)는 힘을 남긴다. 힘이 바뀌는 토글은 켠 쪽이 값을 낼 때뿐이다(DMC5 · 몬헌 · 디지몬 · 로스트아크). 우리 +1 은 값 없는 이득이라, 끄면 빠지게 하면 끌 까닭이 없다.
- 유저가 끄고 싶은 까닭은 겉모습일 것으로 본다(추정): 1차 초상이 더 마음에 듦 · 남 앞에서 하는 중 · 화면 통일.
- 「숫자로 예측」 원칙: 토글에 따라 능력치가 바뀌면 싸움 앞의 예측 숫자가 토글에 따라 흔들린다. 꺼 둔 걸 잊고 지면 억울하다.
- 능력치 옆에 「꺼져 있어도 적용됩니다」 같은 글이 필요 없게, 숫자는 늘 같고 그림만 바뀌게 한다(해명 문구 금지와 맞는다).
- 다른 길: 「힘까지 끄기」는 상이 붙는 도전 토글로 따로 둔다(뱀서 하이퍼 꼴). 새 시스템이라 출시 뒤.

**물음 ② 열전에서 토글이 켜져 있으면 처음부터 각성인가 → 권고: 아니다. 보통 모습으로 시작해 막대를 채운다.**
- 1장의 변신 꼴 여섯 사례 모두 영구 해금 뒤에도 판마다 채운다. 처음부터 켜 두면 「와 각성했다」가 한 판에 0번이 된다.
- 형이 고른 안도 그랬다: 「한 판에 바로 각성하면 안 될 것 같다 · 디지몬처럼 됐다 풀렸다」(RAID-LINK.md:3, 11-13).
- 각성 중은 무적이고 9초다(`params.ts:214`). 처음부터 각성이면 수치를 다 다시 잡아야 한다. 「늘 켜짐」은 로스트아크 광기처럼 큰 값을 매길 때만 선다.
- 영구 각성의 덤은 **막대를 덜 채워도 됨**으로 준다. 숙련(막대 절반 시작 · `haebi.ts:173`)이 이미 같은 말을 쓴다. 수치는 `tools/raid-wake-probe.ts` 로 잰다.
- 토글이 꺼져 있을 때: 막대·단추·효과는 그대로, 그림만 보통 모습에 금빛 오라. 물음 ① 의 답과 한 줄이 된다.

---

## 8. 곁가지: 초상 무기 50가지와 싸움 묶음 일곱 (실마리만 · 의견)

- 확인한 사실: 하데스는 무기 여섯마다 「숨은 양상」이 있고, 양상은 판 밖에서 연다. [Kotaku](https://kotaku.com/how-to-unlock-all-six-hidden-weapon-aspects-in-hades-1845317453)
- 의견: 양상은 무기를 새로 만든 것이 아니라 같은 몸놀림의 한 군데를 비튼 것이다. 우리도 묶음 일곱은 「몸놀림」으로 두고 초상 무기는 「결」로 얹을 수 있다. 예: 골벌 범 = 단검 묶음의 손톱 결(그림·이름·소리 + 수치 한 군데). 고은 = 주술 묶음의 부채 결.
- 각성과 잇기: **각성하면 그 장수의 결이 드러난다**로 하면 「각성해도 손에 쥐는 게 없다」(DESIRE.md:28)의 답도 된다.
- 비용: 결 하나에 S~M. 무기 수만큼이라 머리 장수부터. 자세한 것은 무기 맡은 장에 넘긴다.

---

## 9. 모르는 것 · 확인하지 못한 것

- **페이트 그랜드 오더**의 영기 재림 그림 고르기(끄고 켜도 능력치가 같은지): 출처를 못 찾았다. 표에서 뺐다.
- **에픽세븐** 전직: 30레벨과 그 영웅 전용 퀘스트 넷까지만 확인([Game8](https://game8.co/games/Epic-Seven/archives/331174)). 여러 모드에 걸친 조건인지는 못 봤다.
- **원신** 돌파: 모험 등급과 보스 재료 문턱까지만 확인([Android Central](https://www.androidcentral.com/genshin-impact-ascension-guide-materials-quests-levels-and-requirements)). 별자리(겹쳐 뽑기) 반발은 찾지 못했다.
- **삼국지 조조전 온라인**의 「각성」: 나무위키 본문에 그 낱말이 없었다. 모드 사이 잇기만 적었다.
- **드래곤볼 제노버스 2 · 스파킹 제로**의 변신 값과 되돌리기: 믿을 출처가 모자라 뺐다.
- **DMC5 신 데빌 트리거**의 따로 게이지: 확인 못 해 뺐다.
- **하데스 형벌 서약·무기 양상의 만든 까닭**(서약에 도전하는 사람의 새 상): 검색 요약으로만 봤고 본문은 못 열었다([Tom's Guide](https://www.tomsguide.com/features/hades-exclusive-interview-supergiant)). 근거로 쓰지 않았다.
- **뱀서 한계 돌파 체크 칸이 판마다 꺼지는지**: 출처가 하나뿐이라 적지 않았다.
- **용과 같이 0** 의 「너무 늦게 열린다」: 길잡이와 토론 글 한 곳뿐이다. 약한 근거다.
- **토글이 있는 턴제 전략 게임**(우리 본편과 꼭 같은 꼴)은 디지몬 서바이브·FE 인게이지 둘뿐이다. 더 찾을 만하다.
- 나무위키는 2차 자료다. 날짜는 원문 공지로 다시 볼 만하다.
- 이 장에서는 게임 화면을 띄워 보지 않았다. 본편 각성기의 「켜는 순간」 손맛은 문서와 코드로만 읽었다.

---

## 10. 설계팀에게 넘기는 물음

1. **「악마 아이콘」은 무엇인가.** 3스테이지 끝 두목인가, 판 안에 따로 나오는 특별 두목인가, 스테이지 고르는 화면의 표시인가. 형에게 물을 것.
2. **토글의 목적은 무엇인가.** 겉모습 취향인가, 난이도 조절인가. 이 답이 「끄면 +1 이 빠지나」를 정한다.
3. **영구 각성의 단위.** 장수(도감)인가, 저장 칸(판)인가. 판 시작 때 판 데이터로 복사하는 꼴(`raidSeals` 방식)로 결정론을 지킬 수 있는가.
4. **진각성 열쇠의 자리.** 1차 열쇠를 3스테이지에 두면 지금 진각성 열쇠(목책 깸)는 어디로 가나. DLC 4·5 스테이지로 옮기는 안.
5. **첫 30분.** 「어렵게」와 「첫 각성 30분 안」을 같이 지키려면 예외(배우는 판 · 1장 주인공)를 어디까지 두나.
6. **200명의 값.** 장수마다 깨야 하나, 나라마다나 무기 묶음마다 한 번으로 묶나. 한 명에 드는 시간을 재 볼 것.
7. **열전을 안 하는 사람.** 본편만으로 닿는 느린 길(안 B)을 둘 것인가. 열전에 「맡기기」 판정을 둘 것인가.
8. **지면 남는 것.** 악마 두목에게 진 판의 진척을 무엇으로 남기나.
9. **진각성 DLC 포장.** 본편 빌드에서 파일을 뺄 것인가 · 본편 카드에 잠긴 칸을 보일 것인가 · 싸움 효과를 힘으로 줄 것인가(MONEY 「힘은 안 판다」).
10. **열전마다 스토리.** 나이트레인식(평소 판에 그 장수만의 목표 하나 + 사연 한 줄)이면 그림 0장이다. 머리 장수 여덟부터 할 것인가.
11. **본편의 「켜는 순간」.** 본편 각성기가 「지금 단추」와 「짧음」을 갖췄는지 화면으로 볼 것.
12. **옛 설계와 코드의 어긋남.** DESIRE §8 은 「져서 0이면 풀린다」인데 코드는 영구다. 어느 쪽이 지금의 뜻인지 문서에 적을 것.
