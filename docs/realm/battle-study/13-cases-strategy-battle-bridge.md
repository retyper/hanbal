# 13 · 바깥 사례: 전략 지도와 실시간 전투를 잇는 법 (2026-11-25)

**조사 도구가 얇았다.** 검색은 요약만 돌려주고 열리지 않는 곳이 여럿이었다(Fractal 402 · Riot 504 · Steam 변경 기록 429 · GDC 슬라이드 PDF는 글자 못 읽음). 잘된 게임의 전투 길이·자동 판정 사용률 같은 **공식 수치는 못 찾았다.** 아래 수치는 대부분 유저 글이다.
1. 자동 판정과 직접 전투를 같이 둔 게임에서 가장 큰 불만은 **「자동이 직접보다 늘 나쁘다 · 속을 모른다」**. 고급 병사가 약한 적에게 죽는 일(Bannerlord · Humankind)이 반복된다.
2. 불만을 줄인 장치는 **결과 미리 보기**(Songs of Conquest · Warhammer III 손실 미리 보기)와 **받든지 직접 하든지 고르기**다. 설계 의도는 「자동은 직접과 비슷하게, 더 낫지는 않게」(Humankind).
3. 「자동 판정 공식을 실시간 결과에 맞춰 보정」한 공개 사례는 못 찾았다. 가장 가까운 것은 Empires in Ruins(같은 격차 값을 양쪽에 씀 · 보정은 사람 시험에 맡김)와 Warhammer III(자동 시험 데이터로 정리).
4. **출시 직전에 전투를 갈아엎은 1인·소규모 사례는 못 찾았다.** 찾은 것은 개발 일지 속 방식 왕복(Frost Protocol · VIRTUALORD · Towercrawl)뿐이다. 3개월 전 개편이 위험하다는 것은 이 자료로 증명이 아니라 **추정**이다.
5. 권고: 전투를 **자동 판정 공식과 같은 값에서 나오는 한 판**으로 두고, 실시간은 「시험장 → 문턱 → 본편 붙임」으로 켜되 **끄면 지금 카드 전투로 돌아가는 길**을 남긴다. 하지 말 것은 맨 아래.

범례: [열어 봄] 직접 열어 읽음 · [요약만] 검색 요약만 · [기억 · 확인 못 함].

---

## A. 자동 판정과 직접 전투가 함께 있는 게임

### A1. Total War 시리즈
- 사례: 턴제 캠페인 지도 + 실시간 전투(수천 유닛). 자동 해결(auto-resolve) 선택 가능. 2012 GDC 발표가 두 층을 한 설계로 묶어 다룸. [열어 봄 · 목차만, 본문은 회원 전용] https://gdcvault.com/play/1016700/Designing-Grand-Strategy-Making-the
- 어떻게 도나: 자동은 병종 능력치로 판정한다. 직접 조작이 필요한 병종·전술은 반영 안 된다는 글, 영웅이 자동에서는 안 죽는데 직접이면 쉽게 잡힌다는 글, 공식이 비공개라 불투명하다는 글이 있다. 직접 하면 95% 더 낫다는 유저 글도 있다. [요약만] https://steamcommunity.com/app/1142710/discussions/0/4697910068985751182
- 불만의 결: 자동은 Medieval II에서 싸움의 80%를 자동으로 돌린다는 글(유저 한 명), Warhammer III에서 자동이 늘 불리하다는 글. 정확한 사용률 통계는 없다. [요약만] https://steamcommunity.com/app/4700/discussions/0/1483232961043617726
- 개편: Warhammer III 개발자 발언에 **손실 미리 보기**(어느 유닛이 몇 명 잃는지 판정 전에 보임)와 자동 시험 데이터로 판정을 「깨끗하게」 정리했다는 내용. 구체 수치 없음. [열어 봄] https://gamingbolt.com/?p=484201 (Steam 변경 기록의 「Autoresolve Redone」는 429로 못 읽음)
- 전투 길이: 모드 작성자 말로 20대20 한 판이 10~12분(원판은 더 짧다고 함). 공식 통계 아님. [요약만]
- 왜 통했나(또는 실패): 직접의 보람이 크고 자동은 「쓸모없는 싸움 치우기」로 자리 잡았다. 그러나 불투명성이 반복 불만이다.
- 우리에게 옮기면: 「맡기기」 결과를 **판정 전에 예상 손실로 보여 주기**. 비용 작음(≤1일 · 이미 같은 수학이므로 표시 문제).

### A2. Mount & Blade (Warband · Bannerlord)
- 사례: 자동 계산(auto-calc)과 직접 전투. 정예 병사가 약한 도적 몇 명에게 죽는다는 불만이 Warband 때부터 이어짐. 유저들이 손실이 전군에 퍼지기 때문이라고 설명. 개발사 응답은 없었고 유저가 「Advanced Autoresolve」 모드로 전술·지도력 보너스를 넣고 무작위 피해를 줄임. [열어 봄] https://www.gamepressure.com/newsroom/mount-and-blade-2-bannerlord-auto-resolve-annoys-players/zd1c18 · [요약만] https://steamcommunity.com/app/261550/discussions/0/5800060047320133322
- 왜 실패: 자동이 **분산 큰 무작위**라 「강한 쪽이 이긴다」는 기대를 깬다. 유저가 직접 하는 쪽이 늘 낫다고 학습한다(조언: 중요하거나 한쪽으로 기운 싸움은 직접).
- 우리에게: 자동 판정의 **무작위 폭을 좁히고**(운보다 통제 원칙과 일치) 「우리 정예가 약졸에게 지는 일」이 안 나게 하는 검산. 비용 작음~중간.

### A3. 코에이 삼국지 시리즈
- 사례: 편마다 전투 방식이 크게 바뀐 시리즈. XIII는 실시간 전투를 넣었으나 한 평론은 「전투가 가장 얕다 · 실시간 때문으로 보인다」, 다른 평론은 「Total War 식이 어울렸을 것」. Kotaku는 결함이 있어도 멈출 수 없다고 호평. XIV 평론은 시리즈가 XI 이후 내리막이고 XII·XIII는 비주력작 취급이라고 평하며, XIV 전투는 지도 위에서 정치와 함께 벌어지나 조작이 적어 전술 깊이가 없다는 평. [요약만] https://kotaku.com/romance-of-the-three-kingdoms-xiii-is-a-flawed-but-add-1837423617 · https://wccftech.com/review/romance-of-the-three-kingdoms-xiv-review/ · https://www.primagames.com/?p=313224
- 한계: XI·XII 전투가 어떻게 달랐는지는 못 찾았다. 호평 편과 혹평 편을 가르는 근거는 불충분하다. [기억 · 확인 못 함: XI의 지도 위 전투가 호평이었다는 인상]
- 시사: 시리즈가 편마다 방식을 바꾸는 것은 **얕은 조작 + 그림만 화려한 전투**가 혹평으로 직결된다는 정도까지만 말할 수 있다.

### A4. 영웅전·Heroes 계열 (빠른 전투) · Songs of Conquest
- 사례: Songs of Conquest의 Quick Battle은 **판정 전에 예상 결과를 무료로 모의해 보이고 받을지 직접 할지 고르게** 한다. 받으면 보상·경험치는 직접 이긴 것과 같다. 직접이 손실이 낮다. 지침은 「예상 손실이 작으면 받고, 비싼 병력이 걸리면 직접, 예상이 패배면 받지 말라」. 한 판을 줄여 「몇 분」 번다. [열어 봄] https://www.gamepressure.com/songs-of-conquest/it-is-worth-using-quick-battle/zf1143f
- 유저 글: 영웅끼리 싸움에서는 자동이 잘하나 중립 적에게는 병력을 쓸데없이 잃는다. 실시간 한 판이 3~4분이라는 글. [요약만] https://steamcommunity.com/app/867210/discussions/0/4411920838131986595
- 옛 Heroes 쪽: 빠른 전투는 자동과 같은 코드를 애니메이션 없이 돌린다는 옛 개발자 글(어느 게임인지 불명). [요약만 · 출처 불확실]
- 왜 통했나: **결과를 보여 주고 고르게 한 것**이 핵심. 속은 유저가 믿는다.
- 우리에게: 「맡기기」 옆에 **예상 승패와 손실 범위**, 그 아래 「직접」. 비용 작음. 실시간 판을 헤드리스로 N번 돌려 분포를 만드는 것은 D 절 참고(중간).

### A5. 문명 6(전투 화면 없음)과의 대비
- Humankind는 Civ식 지도 전투를 버리고 전술 전투를 넣었다. 호평: Civ 4~6보다 낫다는 포럼 글. 불평: 수동 전투가 길어 후반에 지겹다 · 자동은 선공 같은 요소를 못 읽어 직접과 「천지 차이」 · 속도 3배로 참을 만해졌다는 글. NME는 어렵고 헷갈려 자동 단추를 눌렀다고 했고, 다른 리뷰는 「숫자 싸움이면 자동이 최선」이라 했다. [열어 봄] https://forums.civfanatics.com/threads/combat-in-humankind-vs-civ-v-vi.673391/ · [요약만] https://www.nme.com/reviews/humankind-review-war-never-changes-3020120
- 개발사 의도(포럼 진술, 요약만): 자동은 직접과 **비슷하게, 더 낫지 않게**, 악용 불가, 이해 가능하게. [요약만] 유저 요청: 자동 결과가 마음에 안 들면 **직접으로 다시 하기**(Age of Wonders: Planetfall 사례). [열어 봄] https://community.amplitude-studios.com/amplitude-studios/humankind/forums/169-game-design/threads/42510-suggestion-retry-with-manual-battle-on-auto-resolve-combat (개발사 발언은 이 페이지에 없었음)
- Millennia(Paradox)는 반대 극단: 전투를 지도 위 창에서 **명령 없이 진행**, 분석하거나 빠르게 끝내기만. 이유는 「기술·정부·도시 성장에 집중」, 군대를 3~7 부대로 묶어 관리. [열어 봄] https://www.paradoxinteractive.com/games/millennia/news/combat
- 우리에게: 문명식의 「전투 없음」과 Millennia식의 「보이되 명령 없음」은 **실시간 전투를 끄는 안**(2안의 후퇴선)으로 쓸 수 있다.

### A6. Empires in Ruins · Northgard · Battle Brothers
- Empires in Ruins(소규모 개발): 자동 해결은 d100 굴림, 승리 확률 = 기본값 + 양 지방 공방 격차(-50~+25로 제한) + 연구 + 지휘관 + 정찰 + 난이도. **실전에서는 같은 격차 값이 피해·적 등장 시각·사기를 바꾼다.** 정찰은 자동에만 영향. 보정은 외부 시험자에게 맡긴다고 했고 계산식 대조 시험은 없다. [열어 봄] https://sgth.itch.io/empires-in-ruins/devlog/100949/autoresolving-battles
- Battle Brothers: 접촉하면 별도 전술 지도가 열리는 구조. 전술 전투가 최초 구상에서 가장 덜 바뀐 부분이고 「이유 없이 벌 준다」는 느낌을 피하려 했다는 인터뷰 요약. 자동 판정은 없다. [요약만] https://turnbasedlovers.com/10-turns-interview/with-battle-brothers-developer/
- Northgard: 이번 조사에서는 자료를 못 찾았다. [기억 · 확인 못 함]
- 우리에게: Empires in Ruins가 가장 가깝다. **전략 층의 값(격차)이 실전에도 자동 판정에도 같이 들어가게** 하는 구조.

### A7. 「직접이 조금 더 낫다」의 폭
- 이번 조사에서 **수치로 잡은 사례는 없다.** 방향만: 자동이 약간 불리하되 투명(Humankind의 의도) · 직접이 크게 유리해 자동이 폐기 수준(Bannerlord · Total War 일부) · 자동이 직접보다 꼭 유리(Warhammer III 일부 영웅 유저 글).
- 한 턴에 싸움이 여럿일 때 피로 줄이기: 결과 미리 보기(Songs of Conquest, Warhammer III) · 배속(Humankind 유저 요청 3배) · 선택적 직접(유저 제안: 카드로 수동 횟수 제한 · AoW Planetfall). 「중요한 싸움만 직접」 장치를 개발사가 설계한 공개 사례는 못 찾았다.
- Gratuitous Space Battles 쪽은 반대 입장: 시작 후 개입 불가가 낫다 → 전략이 진짜 게임, 불리해도 전투를 **연구해서 다음에 고치는 보상**. 72점(Metacritic) · 2015 후속작. 단점은 막판 역전 없음. [열어 봄] https://oldlight.io/blog/gratuitous-space-battles-auto-resolve/

---

## B. 전투 길이와 빈도

- 확실한 수치가 거의 없다. 얻은 것(전부 비공식 · 낮은 신뢰):
  - Total War 20대20 한 판 10~12분(모드 작성자) [요약만]
  - Songs of Conquest 실시간 한 판 3~4분, 자동으로 「몇 분」 절약 [열어 봄/요약만]
  - Clash Royale 3분 한 판 · 연장 1분 — 모바일 한 판 길이의 대표 사례, 이후 정규 시간이 6분에서 5분으로 줄었다는 보도. 한 번에 훔칠 수 있는 길이라는 설명. 개발자 진술 아님 [요약만] https://www.gamedeveloper.com/design/clash-royale---deconstructing-supercell-s-next-billion-dollar-game
  - Warhammer III 생존 전투 설계자: 한 판이 **「늘어짐」** 위험이 있어 판을 단계로 나눔. 적 병력 수는 반으로 줄이고 보내는 부대 수는 두 배, 적 체력은 낮추되 피해는 그대로 — **화면 수는 같게, 무리 느낌, 빨리 끝남**. 자동 판정 언급은 없음. [열어 봄] https://gamedeveloper.com/design/deep-dive-how-survival-battles-balance-the-demonic-chaos-of-i-total-war-warhammer-iii-i-
  - Humankind 수동 전투는 후반에 많이 싸우면 지겹다는 유저 글 [열어 봄]
- 캠페인당 전투 수: **못 찾았다.** [기억 · 확인 못 함]
- 시사(근거 약함): 모바일은 1~3분이 세션에 맞고, 한 턴에 싸움이 많은 지도 전략에서는 직접 전투를 **선택**으로 두는 쪽이 피로 불만이 적다.

### 「전투가 전략의 보상」이 되게 한 장치
- Gratuitous Space Battles: 편성(설계) → 곧바로 전투 관전 → 다음 설계에 반영. 병종을 새로 만들면 다음 전투에서 보인다. 전투 후 기록과 재도전이 보상이다. [열어 봄 · 위 oldlight]
- The Great War: Western Front: 전투 전에 금과 보급으로 참호·기관총·포를 **지어 놓고** 싸운다. 전투에서 크게 이기면 지방의 별이 줄고 작게 이기면 국민 의지만 깎는다 → 전투 결과가 지도에 두 단계로 되돌아온다. 평점 70, 전투는 교착으로 지겹다는 평. [열어 봄] https://en.wikipedia.org/wiki/The_Great_War:_Western_Front
- Company of Heroes 3: 캠페인 지도의 결정이 「걸린 게 적다」는 IGN 평, 전투 쪽 연출은 호평. 지도와 전투 사이에 걸림이 약하면 지도가 헛수고로 느껴진다. [열어 봄] https://en.wikipedia.org/wiki/Company_of_Heroes_3
- 우리에게: 「새 병종 → 다음 전투에서 바로 차이」는 병종을 **전투 화면에서 한눈에 구별되는 몸 크기·움직임**으로 보이는 것과, 전투 뒤 보고서에서 「이 병종이 이만큼 했다」를 보이는 것. 비용 중간(기존 그림 재사용 가능).

---

## C. 출시 전·후에 전투 시스템을 갈아엎은 사례

**정직한 결론: 우리 조건(1인·출시 직전·턴 → 실시간)에 맞는 공개 사례를 못 찾았다.** 아래는 가장 가까운 것.
- Frost Protocol(itch 개발 일지): 1화 턴제 → 2화 실시간 → 3화 턴제 「이대로 간다」. 왕복 자체가 위험 신호. 소규모 프로젝트. [요약만] https://atlas-corp.itch.io/frostprotocol/devlog/936779/devlog-3-turn-based-combat-and-base-management
- VIRTUALORD: 실시간에서 턴제로. 이유는 「잘 만든 RTS는 영원히 걸리고, 그래도 대부분에게 부족」. 1인 개발. [요약만] https://vivaladev.itch.io/virtualord/devlog/1099694/a-new-beginning-virtualord
- Towercrawl Tactics: 실시간 자동 대전에서 완전 턴제로. 방향은 반대. [요약만]
- Idle Not Idle 전략 프로젝트: 턴제에서 실시간 쪽으로, 세부 없음. [요약만]
- Endless Legend 2(Amplitude): 개발자 글 「직접 하게 해 달라」, 자동 명령 혼합이 만족스럽지 않다고 스스로 평했고 유저 반응이 갈렸다(통제 갈망 · 전작 방식 선호 · 지도와 전투 지도 이음 어색함). 전투 시스템 변경 공지 자체는 못 찾음. [열어 봄] https://community.amplitude-studios.com/amplitude-studios/endless-legend-2/forums/317-endless-legend-2/threads/56597-the-new-battle-system-am-i-the-outlier?page=2 · 데모 비판에 답한 변경은 UI·영웅·조언 쪽이었다. [열어 봄] https://pcper.com/2025/09/endless-legend-2-enters-early-access-as-a-changed-game/
- GreedFall 2: 얼리 액세스 부진 후 「전투 개편」 헤드라인. **본문을 못 읽었다.** 결과(호평·환불)는 모른다. [요약만 · 본문 못 염]
- Manor Lords: 얼리 액세스 중 전투 애니메이션·전장 가시성·AI 영주 개선을 나눠서 실험 가지(베타)로 내보낸 기록. 자동 판정은 못 찾음. 평가가 떨어졌다는 보도도. [요약만] https://www.pcgamesn.com/manor-lords/experimental-beta
- 시험장을 먼저 떼어 만든 개발 후기: **못 찾았다.** (GDC 2024 Frontier 결정론 발표는 PDF를 못 읽었다.)
- 시사: 공개 사례가 말해 주는 것은 하나다. **방식 왕복은 소규모 프로젝트의 흔한 실패 모양**이고, 1인 개발자는 실시간 전투가 「영원히 걸릴 것」을 두려워해 접는다(VIRTUALORD).

---

## D. 결정론 · 재생 · AI끼리 싸움

- Node Wars(HTML5, 1인급): 전투를 **먼저 통째로 돌리고 기록한 뒤 재생**한다. 같은 시드 = 같은 전투, 일시정지·되감기·0.5~3배속, 같은 기록으로 균형 검증과 관전. 시뮬과 그림 분리. 형식에 버전. 우리 A1 결정론과 같은 방향이다. [열어 봄] https://itch.io/devlog/1180973/pre-calculated-battles-time-controls.amp
- Ridiculous Space Battles(Positech, 1인): 100% 결정론이어야 같은 배치가 같은 점수. 고정 틱(4ms)으로 화면 속도와 분리하고, 배속에서도 틱을 묶지 않는다. 결정론 부재가 균형 시험을 힘들게 했다고. 같은 시험 6번 동일. [열어 봄] https://www.positech.co.uk/cliffsblog/2026/06/
- Riot LoL 결정론 글: 두 번 시도했으나 504로 못 읽었다. [기억 · 확인 못 함]
- 「실시간 전투를 헤드리스로 빨리 돌려 **자동 판정에 쓰는** 게임」: **못 찾았다.** Empires in Ruins는 정반대(자동은 공식 · 실전은 따로)이고 Warhammer III는 자동 시험을 균형에 쓴다 정도.
- 「자동 공식을 실시간 결과에 맞춰 보정」: **못 찾았다.** 요약만으로는 어디도 공개하지 않았다.
- 시사(우리 사정에서 나온 추정): 우리는 이미 결정론이므로 **실시간 전투를 시드 N개로 헤드리스 돌려 승률·손실 분포를 만들고 「맡기기」의 예상으로 쓴다**가 가능하다. 공개 사례로 검증된 길은 아니다.

---

## 1. 비교표

| 게임 | 전략 층 단위 | 전투 길이 | 자동 판정 | 직접/자동 차이 | 플랫폼 |
|---|---|---|---|---|---|
| Total War(Warhammer III) | 턴(캠페인) | 10~12분급(모드) | 있음 · 비공개 능력치식 · 손실 미리 보기 추가 | 직접이 크게 낫다는 글 · 영웅은 자동이 더 강한 경우도 | PC |
| Mount & Blade | 실시간 지도 | 수 분 | 있음(자동 계산) | 정예 손실이 커 직접이 훨씬 낫다 | PC |
| 삼국지 XIII/XIV | 턴 | 실시간(XIII) · 자동 중심(XIV) | 있음 | 조작이 얕다는 평 | PC·콘솔 |
| Songs of Conquest | 턴 | 3~4분(유저) | 있음 · **예상 모의 후 받기** | 직접이 손실 적음 · 보상 같음 | PC |
| Humankind | 턴 | 길 수 있음 | 있음 · 「직접과 비슷하되 낫지 않게」 | 선공 같은 요소를 자동이 못 읽음 | PC |
| Millennia | 턴 | 짧은 창 | 명령 없는 진행 + 빠른 끝내기 | 직접 없음 | PC |
| Empires in Ruins | 지방(지도) | 미확인 | d100 확률 · 같은 격차 값 사용 | 정찰은 자동에만 | PC |
| Battle Brothers | 실시간 지도 | 미확인 | 없음 | - | PC |
| Clash Royale(참고) | - | 3분(→ 5분) | 없음 | - | 모바일 |
| 문명 6(대비) | 턴 | 전투 화면 없음 | 항상 자동 | - | PC |

공란은 못 찾은 것이다. 판 수·사용률은 어느 게임도 공식 수치가 없다.

## 2. 출시 3개월 전에 전투를 바꾸는 일: 위험과 줄이는 절차

위험(근거와 추정을 가른다):
- 방식 왕복은 소규모에서 흔하다(Frost Protocol · VIRTUALORD · Towercrawl · Endless Legend 2 포럼의 갈림) [요약만/열어 봄]. **1인이 실시간 전투를 영원히 못 끝내는 두려움**이 방식 포기의 이유로 직접 나온다.
- 자동 판정과 직접 전투가 **다른 수학이면** 「자동이 늘 손해」 불만이 따라온다(M&B · Humankind · Total War). 우리는 같은 수학 원칙이 있으므로 이 위험은 유지가 관건이다.
- 지도와 전투 사이 걸림이 약하면 한쪽이 헛수고로 느껴진다(CoH3 평 · EL2 「전투 지도가 월드맵 위에 생성됨」). 추정: 우리 「군사 뽑기 → 전투」 걸림이 이번 개편의 목적과 겹친다.
- 일정: 개편 일정 지연 사례는 못 찾았다. [기억 · 확인 못 함]

줄인 절차(공개 사례에서 확인된 것만):
- 단계 나눔: Manor Lords는 실험 가지(베타)로 전투 변경을 내보내고 본 가지로 옮겼다 [요약만]. Warhammer III 생존 전투는 별도 모드로 한 판을 격리해 수치를 조정했다 [열어 봄].
- 시뮬/그림 분리 + 기록 재생: Node Wars · Ridiculous Space Battles [열어 봄] — 개편 중에도 균형 시험이 된다.
- 결과 미리 보기를 먼저 넣어 불신을 줄임: Songs of Conquest · Warhammer III [열어 봄].
- 시험장을 본편과 떼고 문턱을 넘으면 붙이는 방식의 공개 후기는 **못 찾았다**. 이 절차는 우리 BATTLE-LIVE 문서의 내부 약속일 뿐 외부 근거는 없다.

## 3. 우리에게 권하는 이음 방식

**안 1 · 같은 판 둘로 읽기(실시간 판 + 헤드리스 예상)**
1. 실시간 전투는 시험장(field)에서 먼저 짓고, 본편 연결은 문턱 넷을 넘은 뒤 붙인다(내부 계획 그대로).
2. 「맡기기」는 같은 시뮬을 시드 N개로 헤드리스 돌린 **승률·손실 범위**를 판정 전에 보인다(Songs of Conquest 방식).
3. 전략 층의 격차 값이 실전 병력·사기와 예상에 **같이** 들어간다(Empires in Ruins 방식).
4. 직접의 이점은 「무작위 폭을 줄이는 판단」이어야 하고 자동보다 나쁘게 만들지 않는다(M&B 반면교사).
5. 실시간이 늦어지면 예상 표시만 먼저 출시해도 가치가 남는다(우리 쪽 추정).

**안 2 · 뒤로 물러설 수 있는 단계 개편**
1. 지금 카드 전투를 그대로 두고, 실시간은 **중요한 싸움(수도 · 공성 · 장수 대결)에만** 먼저 켠다.
2. 일반 싸움은 자동 + 짧은 보고(전투 후 병종별 성과)로 간다(Millennia · 문명식의 후퇴선).
3. 직접을 고르면 자동 결과를 보고 「그래도 직접」을 할 수 있게 하되 같은 병력으로만(AoW 재도전 요청의 변형).
4. 계절마다 싸움이 많아도 직접은 몇 번까지로 두거나 예상이 정해 준다(Sjru 제안 변형 · 개발사 사례 없음).
5. 개편이 늦으면 기능 끄기 하나로 지금 판으로 복귀(위험 완충).

**하지 말 것 셋**
1. 직접 전투가 자동과 **다른 수학**으로 돌게 두지 않는다(「자동은 늘 손해」 불만의 뿌리).
2. 출시 3개월 전에 카드 전투를 **지우고** 실시간으로 갈아 끼우지 않는다. 방식 왕복은 소규모의 전형적 실패다.
3. 자동 결과를 **속 모르게** 두지 않는다(Total War 비공개 공식 불만 · Humankind 이해 가능성 의도).

## 열어 본 글 17개 / 못 연 중요한 것
열어 봄: Empires in Ruins · Millennia · Warhammer III 생존 전투 · GDC Total War 목록 · gamingbolt WH3 · gamepressure(Bannerlord · SoC) · Amplitude(Humankind · EL2) · CivFanatics · Node Wars · Positech · Old Light · Wikipedia(CoH3 · Great War) · GDC 2011 요약 · pcper.
못 연 것: Fractal Softworks 자동 판정 글(402) · Riot 결정론 글(504) · Steam WH3 변경 기록(429) · GreedFall 2 개편 본문 · GDC 2024 Frontier PDF(글자 못 읽음) · 삼국지 XI/XII 전투 자료 · 캠페인당 전투 수 · 자동 사용률 통계.
