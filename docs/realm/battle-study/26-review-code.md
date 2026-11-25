# 26 · 심사 「코드 현실」 (battle-study · 2026-11-25 · 심사 일꾼)

렌즈: 이 저장소에서 그대로 지어지는가 · 무엇이 깨지는가. 반박이 기본 태도다. 읽은 것: README · 00 · 01 · 02 · 21 · 22 · 23 · ARCHITECTURE · 코드(HEAD, `git show HEAD:`). 25·27 은 안 읽었다.
표시: **[확인]** 파일:줄(HEAD) 또는 내가 돌려 잰 것 · **[의견]** 내 판단. 잰 도구는 `tools/out/battle-study/` 의 `men-dist.ts` · `sim-bench.ts` · `adv-time.ts`(저장소 파일은 안 고침). 이 PC 는 다른 일꾼이 같이 돌고 있어 시간은 ±수십 %.

## 0. 한 장 결론
1. **22 의 차분(나′)은 이름값을 못 한다.** `fightRounds` 안에서 승패를 가르는 것은 합마다의 `downOf`(tactics.ts:364) · 사로잡기 · 물러나기이고, 22 가 덧셈을 얹겠다는 자리(`:1013` `shareOf` 분류 앞뒤)는 그 **뒤**다. 내가 잰 판(영남 6판 · 62싸움)의 끝맺음: `morale` 42 · `captured` 9 · `retreat` 5 · `men` 3 · **`share` 3**. 끝에 더하는 덧셈이 승패 분류에 닿는 판은 **약 5%**, 나머지는 손실 숫자만 바뀐다(§2-1). 「사람 판을 새 sim 으로 치르는 값」이 거의 `na`·`nd` 한 칸에만 남는다.
2. **21 은 가장 재미있고, 코드로는 가장 멀다.** 새 sim 의 수학이 엔진의 비공개 함수(`frontQ`·`groupPower`·`shareOf`·`downOf` 전부 `export` 없음)를 복제해야 하고, ±3%p 보정은 수렴 보장이 없다. 판당 10ms 는 장난감 sim 에서만 나온다(§3).
3. **23(가)만 이 저장소에서 「한 줄도 안 깨지고」 선다.** 그러나 가가 깨는 것은 코드가 아니라 일정이다: 「재생기」는 이미 있는 DOM 연출(`roundPlan` battlefield.ts:1374 · battle-strikes · battle-capture · 스킬 컷)을 Canvas 로 **다시 짓는** 일이고, 연결 스위치 3일은 5,098줄 `battlefield.ts` 와 `tutorial.ts` 를 건드리는 값으로는 모자란다(§4).
4. 세 안이 다 놓친 큰 구멍: 싸움 중 저장이 지금도 없다(`done` 은 메모리 변수) · 한 게임 안에 **맡기기 수학이 둘** · 판 기록이 `localStorage` 에 **여덟 벌**(KEY·PREV·슬롯 6) · `tests` glob · 영어 기준선(§5).
5. 뼈대는 **23(가)** · 접붙임은 21 의 맵 문법·손 한도 봇 표·정찰 「참만」, 22 의 `ask/setup/LiveRec` 배관과 안전 작업(§7).

## 1. 안마다 — 이대로 지으면 깨지는 곳
### 21 「재미와 한 판만 더」 (나 · 맡기기도 새 sim)
1. **엔진 수학 복제 → 두 수학 표류.** 새 sim 이 읽겠다는 상성·사기·무너짐은 엔진 안쪽이다: `frontQ` tactics.ts:287 · `groupPower` :391 · `shareOf` :386 · `downOf` :364 · `strength` :1529(`resolveRound` 안 지역 함수) — 모두 비공개. 22 가 「battle.ts BEATS 를 읽는다」고 쓴 것도 틀리다: `battle.ts:69 BEATS` 는 `const`(비공개)이고 병종 세모(창·방패·활)이지 앞줄 세모(방진>돌격>길 트기)가 아니다. 앞줄 세모의 UI 사본은 `battlefield.ts:202 FRONT_COUNTER`, 죽은 사본은 `tactics.ts:206-210`. 같은 규칙이 **셋**인 저장소에서 넷째를 짓는 일이다. 깨지는 것: `tactics.test.ts:108`(세모 시험)이 새 sim 을 못 지킨다 · `tacK` 같은 손잡이를 바꾸면 78국 표(옛 엔진)와 sim 이 따로 움직인다.
2. **재생·저장.** 21 §4 는 `Order command` 에 `live:{seed,inputs,result}` 를 싣는다. `state.log` 는 판 전체 명령을 `localStorage` 에 **KEY·PREV·슬롯 최대 6 = 여덟 벌**로 쓰고(realm-main.ts:142-151 · SLOT_MAX 6) 서버 동기화도 `logHash`(net/bundle.ts:146 · `JSON.stringify` 접두 비교)로 비교한다. 입력 줄 ≤80줄 × 싸움 수십 번이면 로그가 두 배가 될 수 있다(현재 world 80계절 로그 199KB — `realm-savesize` 실측). 키 순서·실수 표기가 기기마다 다르면 `logHash` 가 `choose`(충돌 선택창)로 샌다.
3. **「맡기기 = 같은 sim 파일럿」은 맡기는 길이 하나라는 전제인데 길이 둘이다.** 화면 단추를 거치지 않는 맡김은 옛 엔진으로 간다: `app.ts:8907`(`openWar` 가 false 면 `endSeason(prev, orders, ai)`) · `app.ts:1791`(미리 보기 `advance`) · 봇 판 `tools/realm-sim.ts`(tactic 없음). 한 게임 안에서 같은 싸움이 길에 따라 다른 결과(±3%p 안이어도 **같은 씨앗·다른 승패**)가 난다 → 「맡기면 같은 수학」이 글자 그대로는 거짓이 된다.
4. **「key+seed 캐시」는 순수성을 깬다.** 21 §4 는 맡김 시험 돌림을 `key+seed` 로 캐시한다. 같은 `battleKey` 라도 앞 싸움 결과가 달라지면 `Side` 가 다르다(warroom.ts:12-15 「앞 싸움의 결과가 다음 싸움을 바꿀 수 있다」). 캐시 열쇠는 `Side` 전체 해시여야 한다.
5. **열전 「재사용」 둘이 재사용이 아니다.** 가상 스틱은 `raid-main.ts:641-680` 의 모듈 최상위 DOM 스크립트(`$('stick')` · export 없음 · 파일 첫 줄부터 열전 화면 부팅)라 import 불가 → **다시 쓰기**. `tintStrip`(haebi-view.ts:100)도 `export` 없는 지역 함수(21·22·02 가 「쓴다」 한 것). 
6. 미니맵 「누르면 깃발 보내기」·장수 직접·겨루기 접합(`mountDuel` DOM 겹침을 실시간 sim 위에서 멈췄다 이어가기)·정찰 「참만」(낌새 75% 를 바꿈 → `realm-tactics` 6비율 표가 움직임)이 한 안에 다 들어 있다. 한 판 흐름에 새 규칙이 열 개 넘는다.
- 새 시스템 동결 위반은 21 자체가 인정(§10).

### 22 「코드 현실」 (나′ 차분)
1. **끝에 더하는 덧셈은 승패에 안 닿는다**(§0-1). `FightResult` 어디에 더해도: `broke`·`captured`·`endWhy` 는 루프 안에서 이미 정해졌다(`:985-1000` `broke`/`brokeBy`, `:1013-1022` 분류). `na/nd/ga/gd` 만 바꾸면 **이야기와 숫자가 어긋난다**: `endWhy:'men'`(사람이 45% 밑으로 줄어 무너짐)인데 덧셈으로 `na` 가 0.5 가 되고, `howwin.ts`·`battlecard.ts:54` 합 그래프 끝점·`prose.ts:1355 endStory`·`memory.ts:140` 이 다른 숫자를 말한다. 22 §10-1 이 「마지막 RoundLog 사본」으로 막겠다는 것은 `na/nd` 뿐이고 `endWhy`·`broke`·`outcome` 일관성은 말이 없다. 제대로 하려면 **합마다 `st` 에 주입**(루프 안 `downOf` 앞)해야 하고, 그것은 `fightRounds` 를 여는 일이다.
2. **`classifyEnd()` 추출이 말처럼 순수하지 않다.** `:1013-1034` 는 지역 변수 `captured·broke·retreat·brokeBy·withdrew·st·c` 와 `unarrive(±1)` 토글(`shareOf` 앞뒤로 `st.fa` 를 일시 변경)·`chase()` 부작용에 걸려 있다. 함수로 빼면 `st` 를 변경하는 인자가 되고, 22 는 이것을 「중간」으로 쳤다(내 셈: 큼 · §6).
3. **`ask` 가 모든 시험 돌림을 건드린다.** warroom.ts:36 `ANY_BATTLE` 에 `ask:true` 를 넣으면 `rehearse` 호출 일곱 곳(battlefield.ts:3684·4272·4292·4338·4828·4849 · app.ts:8911 침입 알림)·`anyOurs` 가 모두 `liveSetupOf`(맵 만들기)를 돈다. 22 는 「옛 호출 약 12개 시험은 그대로」라 했으나, `tactics.test.ts:~430` `deepEqual(real.rounds, seen.rounds)` 류가 `setup` 이 달린 줄과 비교된다. 또 `FieldMap.cells: Uint8Array` 가 `FightResult`→`ReportLine` 에 실리면 `JSON.stringify` 가 `{"0":..}` 객체로 부풀린다: 「저장 때 지움」은 **지울 자리가 없다**(realm-main.ts:469-473 은 `report.lines` 를 그대로 `game.turns` 에 넣는다). 실제 `advance` 에서는 `ask` 가 없어 `setup` 이 안 붙으니 지킬 수는 있지만, 그 이유는 22 가 댄 것이 아니다.
4. **자세(`cmds`)와 실시간 입력의 순서가 순환한다.** 기준 판은 「같은 자세 · 손 없음」이어야 `d=0` 이 정확한데, 자세는 합마다 `pending`(엔진 낌새·짐작 `lookAt`)을 보고 고른다. 사람이 90초 sim 을 하는 동안 엔진은 `pending` 을 안 낸다 — 합 i+1 의 낌새는 합 i 의 **엔진** 결과에서 나오는데 화면은 **sim** 상태다. 두 상태가 어긋난 채 사람이 읽는다(22 §10-1 「화면이 거짓말」).
5. 열전에서 「복사」: `camera.ts` 는 판 상태는 모르지만 `C.width/C.height`(1120×720) · `Z.levels` · `WD.view` · `C.speed`(장수 속도)에 박혀 있다(camera.ts:9·29-40·69) → 160×40 가로 띠·폰 세로에는 뷰포트 인자가 필요(02·22 의 「그대로」는 틀림). `props.ts`·`wide-view.ts` 도 `BOARD/WORLD` 3×3 상수(wide.ts:16-18)·`HaebiRun` 타입 import 를 끌고 온다.

### 23 「출시 현실」 (가)
1. **재생기는 새로 짓는 게 아니라 다시 짓는 것.** `roundPlan(rd, weAtk)`(battlefield.ts:1374) 가 이미 `RoundLog` 를 시간표로 푼다(깃발 차례 + 맞부딪힘 + 이야기 + 결과). 지금 한 합은 `warBeat0 .25 + 깃발 2~4개 × .5~1.25 + warResultGap 1.9` ≈ **5~7초**(params.ts:3502-3636 · 내 셈). 23 의 「합당 12초 이하」는 지금보다 **느리다**(합 평균 1.6~1.9, §5). 배속은 `getAnimations().updatePlaybackRate`(battlefield.ts:3700 부근 `rateAnimations`)로 CSS 애니를 늦추는 길이라 Canvas 에는 안 통한다 → 틱 배율로 다시.
2. **연결 스위치 「진입 분기 + 설정 한 칸 3일」은 모자란다.** `warHtml`(1493-3603 · 2,100줄) 안에 스킬 컷(`cutLead`·`skillfx`) · 각성 장면 · 겨루기 겹침(`mountDuel` 4811) · 사로잡기 연출 · 소리 시계(`chain`) · 배우는 판 안내(`tutorial.ts` 5·6단계 「가리킨 곳을 누른다」는 DOM 단추 위치에 묶임)가 얽혀 있다. 스위치 안쪽에서 이 중 무엇을 Canvas 가 맡고 무엇이 DOM 으로 남는지가 없다. 한 화면에 둘이 겹치는 순간(Canvas 위 DOM 컷)이 첫 반려 후보.
3. **「끌기 → 깃발 번역」의 오번역 0 합격선**은 번역표 단위 시험으로 되지만, `groupOptions`(tactics.ts:481)의 선택지는 쓴 땅의 수(`ONCE` :217)·적 활 유무에 따라 합마다 달라진다. 끌기로 만든 `Cmd` 가 그 합에 없는 선택지일 때(예: `counter` 인데 적 활이 없음) 무엇을 하는지 정해야 한다 — 안은 말이 없다.
4. 가는 `FightResult` 가 안 바뀌어 안전하지만 **새 시스템 동결 예외**(23 §0)와 12월 말 여유 주 의존이다. 코드 위험보다 일정 위험이 크다(§4).

## 2. 좋은 것 (접붙일 만한 것)
- 21: 맵 문법 표(§2 · 시작 자리만 바꿔 승률이 달라진다는 합격선) · 손 한도 **봇 표를 합격선으로**(정밀 − 굵은 ≤5%p · 열세 비 0.77 에서 굵은 판단 − 맡김 ≥20%p — 숫자로 잰다는 것이 이 저장소 습관과 맞다) · 정찰은 참만 보인다(12 신뢰 조건) · 판당 눈금 하나로 카드 세기.
- 22: **sim 은 `advance` 밖(UI 층)에서 돌고 결과만 자료로 `Order` 에 들어간다** → `advance` 순수성·재생·기기 간 차이(`Math.sin/cos`)를 한 번에 피한다. 이 구조는 어느 안을 고르든 그대로 쓴다. `LiveRec` 의 `v`/`tag` 를 모르면 무시(미래 판·옛 판이 안 터진다) · P0(예상 미리 보기) · P1 죽은 코드 청소(실제로 `BASIC·BEATS·COUNTER` 쓰는 곳 0 — grep 확인) · `npm test` glob 함정을 짚은 것.
- 23: 별도 진입점(`night.html` 꼴 · vite input 한 줄 · 지우면 본편 불변) · 「버리는 순서」 · `FightResult` 해시 일치 합격선 · 체험판은 끈다 · 소리·그림 0~4장.

## 3. 직접 확인한 주장 (맞음/틀림)
| # | 주장(안) | 내가 연 곳 · 잰 것 | 판정 |
|---|---|---|---|
| 1 | 22 §0-11 「`live?` 한 칸이 아니라 열두 줄」 | 배관은 맞다. **빠진 것 다섯**: ① 싸움 중 저장(`done` 은 battlefield.ts:3660 메모리 변수 · 21 §4 「때 경계 저장」은 `Saved`·`normalize`·`migrate` 에 새 칸) ② `net/bundle.ts:146 logHash` 키 순서·크기 ③ `tests/realm/tactics.test.ts` rehearse↔real `deepEqual`(`setup` 때문에) ④ `tools/realm-oldclock-hash.ts`·`realm-replay.ts` 는 `command` 경로를 **안 지난다**(AI 끼리만 · `advance(r,o)` 에 tactic 없음) → `live` 를 켠 판의 불변을 못 지킨다 ⑤ 새 UI 글이 `tools/i18n-baseline.json` total 에 쌓임(20,910) | **부분 맞음** |
| 2 | 22 §0-7 `fightRounds` 0.60ms · 「`advance` 턴당 약 50ms」 | 영남 4판×80턴: `advance` **4.5ms**/턴, `decide+aiOrders` 4.6ms/턴 (`adv-time.ts` · 노이즈 큼 · 지역에 따라 다름). 50ms 는 `realm-sim` 의 판 전체 24판 규모 합산에서 온 수로 보인다 | **틀림(약 10배 과대)** — rehearse 15번이 0.7초가 아니라 ~0.07초. 이 숫자로 「새 sim 이 느려도 `advance` 에 안 들어가야」 하는 논거는 약해지고, 거꾸로 **sim 을 `advance` 안에 넣을 여지**가 생긴다 |
| 3 | 22 §0-8 `advance(` 시험 76/160 파일 | `grep -rl "advance(" tests/realm` = 76 · `ls tests/realm` = 160 | **맞음** |
| 4 | 22 §0-4 열전 `Math.sin/cos/atan2` 79 | haebi.ts 에 79번 · 45줄 | **맞음** |
| 5 | 22 §4-3 「상성은 battle.ts BEATS 를 읽는다」 | battle.ts:69 `const BEATS`(비공개 · 병종 세모). 앞줄 세모는 tactics 안 `frontQ`(비공개) | **틀림** |
| 6 | 21·22 「열전 `tintStrip` 으로 편 색」 · 21 「열전 `#stick` 재사용」 | `haebi-view.ts:100 function tintStrip`(export 없음) · `raid-main.ts:641` 모듈 최상위 | **틀림(복사·재작성 필요)** |
| 7 | 22 §2 `camera.ts` 「판 상태를 모름 · 그대로」 | 판 상태는 모르나 1120×720·`Z`·`C.speed` 상수 결합(camera.ts:9·29-40) | **부분 틀림** |
| 8 | 22 「`npm test` 는 `tests/field/` 를 안 돈다」 | package.json:12 `tests/*.test.ts tests/realm/*.test.ts tests/net/*.test.ts` | **맞음** (tests/raid 는 최상위 `tests/raid-*.test.ts` 라 돈다) |
| 9 | 22 §4-3 「몸 ≤38 · 10ms/판」 | 정수·고정 배열 장난감(`sim-bench.ts` 900틱, 재목표 4틱마다 · 가까운 6개): 38몸 **중앙값 6.6ms**(최소 6.1) · 80몸 최소 19ms · 200몸 94ms · 재목표를 매 틱 하면 38몸 13~24ms. 이 장난감엔 아군 밀어내기·탄·마디·사기·합 요약·입력이 **없다** | **셈은 맞고 약속은 아님** — 실제 기능을 넣으면 2~4배(20~30ms)가 자연스럽다. 합격선 「≤10ms」는 첫 시험에서 떨어질 가능성이 높다 |
| 10 | 21·22 「한 무리 병종마다 ≤40명씩 대 · 한 편 ≤12대」 | 영남 6판 62싸움의 한 편 사람 수: 중앙 594 · p90 1,305 · 최대 2,097 (`men-dist.ts`) → ≤12대면 대당 **50~175명**, 「≤40명씩 쪼갬」과 모순(쪼개면 대가 50개) | **모순** — 몸 수가 규모에 따라 38 → 100+ 이 되고 위 표의 6.6ms 는 19~94ms 로 간다 |
| 11 | 21 「낱낱 점 10명=1점」·「한 화면 ≤160」 | 한 편 2,097명이면 210점·양쪽 420 > 160 | **한도와 모순**(점당 사람 수가 규모마다 달라져야 하고 「10명 = 1점」 읽기가 사라진다) |
| 12 | 23 「합당 연출 12초」 · 「싸움 4.2합」 | 실제 `endWhy`/합 수: 영남 봇 판 평균 **1.6~1.9합**(`men-dist.ts` · AI 끼리 균형 표 `realm-tactics` 의 4.19 와 다른 표본) · 현 연출 5~7초/합 | **전제 틀림** — 체험판 시간 셈(+6~21분)의 곱셈 인수가 반이고, 12초는 지금보다 느림 |
| 13 | 22 「tactics.ts:1013-1021 분류식을 함수로」 | `:1013 const s = shareOf(c, st)` ~ `:1034 endWhy` · 지역 변수 7개·`unarrive` 토글 | **줄은 맞고 「순수하게 뺄 수 있다」는 틀림** |
| 14 | 00·01·22 `BASIC·BEATS·COUNTER` 쓰는 곳 0 | tactics.ts:206-210 정의뿐(`export` 이지만 참조 0 · battle.ts BEATS 는 다른 것) | **맞음** |
| 15 | 21 「`tacRoundsMax` 5 params.ts:3799」 | params.ts:3799 | **맞음** |

## 4. 열전 「그대로 복사」가 얼마나 묶였나 (import 를 따라간 결과)
- `runlog.ts`(99줄): `haebi.ts`(createHaebi·stepHaebi·`HaebiRun`)·`champion.ts`·`runlog-store.ts` 를 import → 틀(b36 · 바뀔 때만 적기)만 **베껴** 새 파일로. 「그대로」 아님. 쓸모 있는 것: `cell()` 주석(-0 과 `atan2`)은 정수 입력 격자의 이유.
- `camera.ts`(82줄): `wide.ts` 의 `BOARD/WORLD` + params 1120×720. · `props.ts`(77줄): `BOARD/WORLD`·`makeRng` · `wide-view.ts`(142줄): `HaebiRun` 타입 · `palisade.ts`(148줄): `giant-core.overlaps`(거대 보스 모듈) 한 줄 · `build.ts`(176줄): params 만 → **가장 깨끗하다**. 02 의 「그대로」 표 가운데 진짜 그대로 쓸 수 있는 것은 `build.ts` 한 칸이다.
- `tools/raid-*.ts` 의 `replay()` 틀은 `HaebiRun` 에 묶여 새 sim 에 못 쓴다 → `field-bench` 는 새로.

## 5. 세 안이 다 놓친 것 (코드 쪽 큰 구멍 순)
1. **싸움 중 중단.** `done`(battlefield.ts:3660)은 메모리뿐이고 `finish`(app.ts:8894)가 모든 싸움이 끝나야 부른다. 지금도 탭을 닫으면 그 계절 고른 깃발이 사라진다. 실시간은 한 싸움이 90초라 이 손실이 90배 커진다. 저장 칸(`Saved` v2 + `normalize`/`migrate` + 서버 `bundle`)을 안이 따로 잡아야 한다. 규칙 4(탭 hidden 에서 안 돎)와 짝: hidden→visible 에 `dt` 폭주 처리(틱 누적 상한)·`visibilitychange` 에 sim 멈춤·복귀 때 마지막 때 경계로.
2. **한 게임 안의 맡김 둘**(§1 21-3): 21 만이 아니라 22·23 도 「화면 맡김 = 엔진 맡김」을 가정하지만, 22 에서 사람이 `live` 를 안 넣는 싸움은 엔진 맡김이고 21 에서는 sim 맡김이다. 미리 보기(app.ts:1791)·`openWar` 실패 경로(app.ts:8907)를 한 길로 모아야 한다.
3. **판 기록 크기.** `Saved` 는 KEY+PREV 두 벌(realm-main.ts:142-151)·슬롯 최대 6 · `games`(≤3,000,000자 · realm-main.ts:68)가 같은 5MB `localStorage` 를 나눠 쓴다. world 80계절 로그 199KB + 판 171KB = 370KB × 8 ≈ 3MB. 21 의 입력 줄(싸움당 ≤1KB, 사람은 수십 싸움) 은 **실제 한계 근처**에서 더하는 값이다. 22 의 `LiveRec.d`(수 바이트)가 가장 안전하다.
4. **패드·터치·키보드 동시.** 안마다 패드를 「뒤로」 미뤘다. 패드 코드 0건(`git grep -i gamepad src` 0)인 채 스팀 대표 얼굴이다. 터치 끌기와 `pointer` 이벤트가 `battlefield.ts` 의 기존 DOM 핸들러·`cutTap`(3698 · 장면이 배속 단추를 삼킨 사고) 위에 겹친다 — 입력 가로채기는 첫 사고 후보.
5. **`npm test`·tsc·린트.** `tests/field/` 는 glob 밖(22 만 짚음) · 새 글자는 `tools/i18n-baseline.json`(20,910) · `josa-lint`·`dash-lint` 0곳 규칙 · `vite.config.ts` input · `tools/budget.ts`(JS 총량 300/800KB 경보기) — 어느 안도 카드 합격선에 안 넣었다.
6. **밸런스 표의 짝.** `realm-tactics.ts` 6비율 표는 `winChance`·맡김·잘 읽음 기준이다. 새 sim 이 켜지면 같은 표를 sim 으로 다시 내야 하고(21 F6) 22 는 한도 숫자(+10/−4%p)만 판단 기준으로 쓰는데 그 한도의 **열세 비 0.7 시험**은 새 도구(`realm-field`)가 있어야 돈다 — 도구가 카드로 나뉘지 않았다(22 F3 가 겨우).
7. 정직하게: 지금 판의 합 수가 1.6~1.9합(§3-12)이면 「합당 연출」보다 **싸움당 시간**이 문제다. 이 표본은 영남 6판·봇 둘이라 작다(재는 법: `realm-sim --games 24` 로 `rounds.length` 분포).

## 6. 카드 규모 다시 세기 (눈금: 작음 ≤1 · 중간 1.5~2 · 큼 3~5 · 아주 큼 6+ 형일 · [의견])
| 안 | 안 쓴 합계 | 내 셈 | 까닭 |
|---|---|---|---|
| 21 | 시험장 16~19 + T 1 + 연결 8 = 25~28 | **시험장 22~26 · 연결 11~14 = 35~41** | F1 엔진 수학 복제·읽기 +1 · F3 카메라 상수 풀기·tintStrip 복사·폰 30fps 실측 +2 · F5 스틱 재작성·`mountDuel` 겹침/멈춤 +1.5 · F6 ±3%p 는 반복 튜닝(수렴 안 하면 무한) +2 · 연결 W 에 rehearse 캐시 열쇠·싸움 중 저장 +3 |
| 22 | P 1.5 + F 12 + L 7.5 = 21 | **약 29** | L1 「추출 + 덧셈」은 §1-22-1·2 때문에 합마다 주입으로 재설계 → 큼+ (5~6) · L2 는 `battlefield.ts` rehearse 7곳 + 중단 저장 → 큼 (4~5) · F1 sim 은 엔진 비공개 수학을 읽어 복제 +1 |
| 23 | F 9.5 + F5 3 = 12.5 | **약 22** | F1 「재생기+맵+덩어리」를 4일에 → 6~8(재생할 `Act` 종류가 많음 · `Act` 타입은 types.ts 에 십수 갈래) · F5 3 → 8~10 · F2~F4 거의 그대로 |
**가장 과소평가된 카드 셋**: ① **23 F5 연결 스위치(3일 → 8~10일)** — 스킬 컷·각성·사로잡기·겨루기·소리 시계·배우는 판 안내가 DOM 에 얽혀 있다 · ② **22 L1 이음 뼈대(중간 → 큼+)** — 끝 분류 추출과 합마다 주입이 `fightRounds` 안쪽 설계를 건다. 이 카드가 22 의 가장 위험한 이음매라고 22 가 스스로 말했는데 규모는 중간이다 · ③ **21 F6 AI 파일럿 4종 + ±3%p 보정(중간 → 큼+, 끝이 안 날 수 있음)** — 남의 비공개 식을 새 sim 에 맞추는 일이라 공개 사례도 못 찾았다(21 §10-1).
**셋이 서로 겹치는 몫**: 새 그리기 층(Canvas · 낱낱 점 · 카메라 · 미니맵)은 세 안 모두 필요한데 비용을 각자 센다. 하나로 합치면 약 6~8일(3안 공통).

## 7. 네 표
### 7-1 어느 안을 뼈대로, 무엇을 접붙이나
| 항목 | 고름 | 한 줄 까닭 |
|---|---|---|
| 뼈대 | **23 (가)** | `fightRounds`·`FightResult`·`Order` 0줄이라 골든·시험 80개·옛 저장이 그대로 산다. 코드 렌즈에서 깨지는 곳이 가장 적다(일정만 위험) |
| 접붙임 ① | 22 의 배관(`ask` · `LiveSetup` · `LiveRec{v,tag}` 모르면 무시) | 가가 문턱을 넘은 뒤 나·나′ 로 가는 길을 열어 둔다. **단 차분은 합마다 주입으로 고쳐서**(§1-22-1) |
| 접붙임 ② | 21 의 맵 문법 표 · 손 한도 봇 표(숫자 합격선) · 정찰 참만 | 시험장의 합격선을 숫자로 못 박는다 |
| 버림 | 21 「맡기기도 새 sim」 · 22 의 「끝에 더한다」 | 한 게임 안 맡김 둘 · 승패에 안 닿는 덧셈 |
| 확인 후 결정 | 합 연출 길이 | 지금 5~7초/합, 합 평균 1.6~1.9 — 12초는 체험판 시간을 늘린다 |
### 7-2 짓기 전에 먼저 할 「안전 작업」 (순서대로 · 각각 작음)
1. **HEAD 골든 동결**: `tools/realm-oldclock-hash.ts` 21줄을 파일로 저장 + `FightResult` 를 **사람 쪽 `cmds` 가 있는 경로**까지 지나는 20,000판 해시 덤프(`realm-tactics.ts` 식 · 3정책)를 `tests/realm/` 골든으로 — 현재 oldclock 도구는 `command` 경로를 안 지나고 「이전 커밋과 비교」만 한다(저장된 정답 없음).
2. **추출 커밋 단독**: `frontQ`·`groupPower`·`shareOf`·`downOf` 를 `export` 만 하고(동작 불변) 골든 확인 → 그 뒤에야 분류식 함수화 · 같은 커밋에서 다른 일 금지.
3. **죽은 코드 청소**(P1): `B0_KEY`·`b0On`(battlefield.ts:522-525) · `app.ts:8790 b0-toggle`·`wipe.ts:16` · `tactics.ts:206-210` — 줄 번호 혼선 제거. 이 연구의 줄 번호는 청소 **전** 기준이라고 못 박는다.
4. **측정 도구 먼저**: `field-bench`(위 `sim-bench.ts` 틀 · 몸 수 38/80/200 · 중앙값·p95) · `war-perf.ts` 로 지금 한 합의 초 · `realm-savesize` 현 값 기록 · `realm-sim --games 24` 로 합 수·싸움 수 분포 · 폰 프레임 실측(저사양 단계 `fieldLowGraphics`).
5. **저장·중단 스키마 결정**: 싸움 중 저장 칸(`Saved` v2 · `normalize` · `migrate` · `net/bundle`)을 가가 쓰든 안 쓰든 먼저 정한다. 현재 중단 시 손실을 문서에 못 박기(지금도 있는 결함).
6. **단 하나의 맡김 길**: `app.ts:1791`·`8907`·봇 판이 같은 함수로 가게(가에서는 자명하나 나·다 전에 필수).
7. **glob·린트**: `tests/field` 를 glob 에 넣거나 시험을 `tests/realm/` 에 두기 · `i18n-baseline`·`josa-lint`·`dash-lint` 를 카드 합격선에 · `field.html` 은 `vite.config.ts` input 한 줄 + `vite build` 로 한 번 확인.
8. **열전 파일 불변**: `src/raid/*` 는 열전 골든(tests/raid-golden.test.ts)에 걸려 있으니 복사는 새 파일로, 열전 쪽 수정 0줄(`camera.ts` 뷰포트 인자화도 복사본에서).

## 8. 이 장의 한계
- 합 수·한 편 사람 수는 영남 한 지역·봇 `cautious` 한 종·6판이다. 78국 월드·후반(난세 단계 3 이상 · 최대 1,983명)은 일부만 봤다. 시간은 노이즈 큰 PC 에서 한 번씩.
- `sim-bench.ts` 는 장난감이다: 이 숫자로 판정할 수 있는 것은 「안의 셈이 과소·과대가 아니다」(38몸 약 6.6ms)와 「몸이 늘면 비선형」까지다.
- 화면(Canvas 폰 프레임·입력 지연)은 안 봤다. `fightRounds` 0.45~0.60ms 는 내가 다시 재지 않았다.
- 22 의 「`FightResult` 에 `setup`」 가 `ReportLine` 으로 새는지는 `advance` 실제 경로(`ask` 없음)만 확인했다.
