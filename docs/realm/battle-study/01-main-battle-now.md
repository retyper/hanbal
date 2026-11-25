# 01 · 본편 전투는 지금 어떻게 도는가 (2026-11-25 · HEAD 7b91fe6b 기준)

> 표기: **[확인]** 코드를 열어 본 것(파일:줄) · **[옮김]** 문서에서 옮긴 것(코드로 못 맞춰 봄) · **[의견]** 판단 · 「못 봄」.
> 줄 번호는 HEAD 기준. 낡은 문서의 숫자는 코드(params.ts)를 따랐다. 같은 폴더 README 의 앞선 결정을 전제로 읽는다.

## 다섯 줄 요약
1. 본편 전투는 **한 번의 `advance()` 안에서 끝나는 순수 함수** `fightRounds`(tactics.ts:728)다. 지도 쪽과 닿는 곳은 입력 `Side` 둘 + `Tactic` 하나, 출력 `FightResult` 하나뿐이다. [확인]
2. 한 싸움 = 해시계 4때(+마지막 때 뒤 「한 합 더」 한 번, 많아도 5합) × 합마다 무리(앞줄·활·기병) 깃발 셋 + 장수 깃발 하나 = **고를 것 넷**. 「넷 이하」는 상수가 아니라 무리가 셋뿐이라는 구조에서 나온다. [확인]
3. 전장 화면은 **버튼·카드 DOM**이다(Canvas 아님). 고를 때마다 `advance` 를 통째로 다시 돌려(`rehearse`) 다음 합의 `pending` 을 받는다 — 화면이 sim 을 모르게 하는 이음매가 이미 하나 있다. [확인]
4. 있는 것: 진군 방식 다섯 · 군량 · 막힌 길 · 정찰/파수 · 낌새 · 사로잡기 · 대결(duel) · 들판 싸움(대로에서 만남) · 원군 · 밤 규칙. **없는 것: 미니맵 · 전장 공간(좌표) · 공성의 단계(여러 합/계절) · 수성의 별도 규칙 · 적 깃발 전체 보기.** 공성·수성·수상은 이름표·배경·배수·깃발 한 개로만 있다. [확인]
5. 헤드리스 한 싸움은 약 **0.4 ms**(AI 끼리, 4.2합). 전체 `advance` 한 턴은 약 50 ms. 비용 걱정은 전투가 아니라 **시험 돌림이 `advance` 전체를 반복하는 것**과 **실시간으로 바꿀 때의 시험 수**다. [확인: 이번에 측정]

---

## 1. 한 싸움의 흐름

| 단계 | 함수 (파일:줄) | 하는 일 |
|---|---|---|
| ① 행군 명령 | `applyOrders` season.ts:848 · `approachOptions` :923 · `rationFor` :964 | 진군 방식(대로·밤길·여울·산기슭·절벽)·군량을 군대에 싣는다. `a.march = {from,to,edge,left,ambush,approach,hard…}` (:903 부근). 막힌 길은 `blockedWhy` calendar.ts:102 로 미리 깎는다(season.ts:895) |
| ② 계절(턴) 넘기기 | `advance` season.ts:2006 | 순서: 답 → 명령 확정 → 정찰/사신/공작 → **`command` 명령 줄을 Tactic 으로 모음(:2031-2033)** → `resolveMarches`(:2035) → 군량 `stepFood`(:2041) → 경제·장수·보고 |
| ③ 길 위에서 먼저 | `fieldBattles` season.ts:1349 | 같은 길을 마주 보고 가던 적대 군대는 길 한가운데서 맞붙는다(「대로에서 만남」). 성·장정·기습 없음. 열쇠 `fieldKey` :1339 |
| ④ 닿은 고을 | `resolveMarches` :1811 → `fight` :1499 | 같은 계절 닿은 군대 묶음(`arrivalGroups` :498)마다 `fight`. 기습 굴림(:1534-1560)·잠든 적 첫 칼(:1581)·들킨 군대 손실(:1584)·원군 나눔(:1638-1650)·`sideOf` 로 `Side` 둘을 짓고 `fightRounds` 호출(**:1659**; 들판은 :1390) |
| ⑤ 합 | `fightRounds` tactics.ts:728 → `resolveRound` :1229 | 합마다 AI 가 양쪽 `aiOrder`(:550) → 플레이어 쪽은 `tactic.cmds[i]` 로 덮음(:892-) → `resolveRound`(장수 명령 → 앞줄 → 활 → 말 → 손실·사기) → 무너짐 검사(`downOf` :364) |
| ⑥ 마지막 때 | 같은 함수 :818-876 · `aiDusk` :1053 · `duskPending` :1071 | 4때가 끝나도 안 무너졌으면 두 쪽이 고른다: 진을 친다 / 한 합 더(곡식·사기) / 물러난다 |
| ⑦ 끝 | `fightRounds` 끝(:1000-1060) → `fight` 뒷부분 | 결과 `FightResult` → 손실 `scaleByGroups`(:1246)·사기 `shiftMorale`(:1251)·장수의 운명 `battleFates`(:1260)·성장 `battleGrowth`·진 군대 후퇴 `fallBack`(:429)·고을 점령(:1722)·`lines.push({kind:'battle',…})`(:1743) |
| ⑧ 화면 | `openWar` battlefield.ts:3659 | 합 기록을 풀어 보이고, 다음 합 `pending` 으로 깃발을 묻는다. 다 고르면 `done(tactics)` → app.ts:8893 `finish` 가 `command` 명령으로 굳혀 `endSeason`(:8130) → 진짜 `advance` |

- **시험 돌림**: `rehearse` warroom.ts:33 — 고를 때마다 같은 명령으로 `advance` 를 다시 돈다. 안 본 우리 싸움은 `ANY_BATTLE='*'`(season.ts:1333)로 첫 합에서 멈춘다(`open:true`). 결과의 `after`(뒤 판)는 버린다. 호출처 battlefield.ts:3684·4272·4292·4338·4828·4849, app.ts:8911(침입 알림). [확인]
- **AI 끼리 · 맡김**: 플레이어가 안 낀 싸움과 `tactic===undefined` 인 싸움은 `settle(me, foe, {}, ai…)`(tactics.ts:892)로 **같은 `resolveRound`** 를 AI 가 양쪽 다 골라 돈다. 별도 엔진 없음. [확인]
- 한 턴은 달 시계면 **한 달**, 옛 판은 한 계절(`perSeason` calendar.ts:39). 싸움은 **군대가 닿는 턴**에만 난다 — 싸움은 턴 안에서 일어나는 순간 이벤트이고, 전장에 「머무는」 상태는 없다. [확인]

## 2. 데이터 계약

### 들어가는 값 — `Side` (tactics.ts:51) 둘 + `Tactic`(types.ts:614) + 열쇠·씨앗
| 값 | 필드 | 만드는 곳 |
|---|---|---|
| 병력·병종 | `mix`(병종→사람 수), `F`(처음 전투력: 자리·상성·진군·장비·장수까지 곱한 하나의 수) | `mergeForces` season.ts:275 · `power` battle.ts:194 |
| 무리 셋 | 따로 안 받고 `groupMen(mix)`(tactics.ts:242)로 파생: 앞줄(spear·shield·pike·boat)·활(bow·crossbow)·기병(horse). 6% 이상·3명 이상이어야 깃발을 따로 든다(`groupsOf` :249, `tacGroupMin`) | |
| 장수 | `hero`(총대장)·`aides`(부장)·`SideHero{id,mu,ryak,coward,art,style,duel,chant,steady,wake,trueWake,breakthrough}` | `sideOf` season.ts:1151 |
| 사기 | `morale`·`moraleBonus`(싸움 앞 덤: 대로 +, 책화 −, 소도 제단 …) | `sideOf` |
| 군량 | `hungry`(bool)·`grain`(곳간: 「한 합 더」 값)·`feast`(호궤 값) | `hungryOf` :1112 · `stock` |
| 지형·땅 | `terrain{ford,rocks,gate,ram,height}`·`water`·`specials`(불화살) | `fight` :1612-1636 · `fieldBattles` :1386 |
| 진군·계절·기습 | **Side 에 직접 안 들어간다.** `ambush`·`approach`·`fort` 는 `F` 와 `moraleBonus`·`terrain` 에 녹아서 들어가고, `ClockOpt{night,edge}`(tactics.ts:199)로 밤 싸움만 따로 | `fight` :1534-1659 |
| 정보 | `seen`(상대를 봤나)·`knowsFoe`(겨뤄 본 적) → 낌새 정확도 | `freshSight` :1117 · `knowFoe` :1128 |
| 특수 | `relief{mix,at,heroes}`(원군)·`easy`·`capture:'sure'/'never'`·`lesson`(배우는 판) | |
| 시드 | `fightRounds(atk,def,key,r.seed,r.season,tactic,clockOpt)` — 굴림은 `roll(seed,season,`${key}:t${i}:…`)`(core/rng.ts:78) | 열쇠 `battleKey` season.ts:72 |

**성/목책/해자는 필드가 아니다.** 지키는 쪽 `F` 에 `fortMul`(season.ts:227: 산성 ×1.6 · 목책 ×1.2 · 높은 터 ×1.3 · 해자 ×1.15(겨울 1) · 흙성 ×1.35 · 큰 무덤·궁궐)이 곱해질 뿐이다(`power`가 `f *= field.fort`, battle.ts:198). `Terrain.gate` 하나만 「성문 깨기」 깃발을 연다. [확인]

### 나오는 값 — `FightResult` (tactics.ts:147) 전부
`outcome`(rout/win/draw/lose/routed) · `na` `nd`(처음 사람 대비 남은 몫) · `ga` `gd`(무리별 남은 몫) · `dma` `dmd`(사기 변화) · `captured`('a'|'d'|null) · `broke` · `duel{loser,kill,winner}` · `rounds: RoundLog[]` · `pending?` · `led` · `taken[]` `fell[]`(싸움이 이어진 장수 잃음) · `chiefA` `chiefD` · `fedA` `fedD`(호궤) · `endWhy`(captured·men·morale·retreat·share·draw·withdraw) · `clock{night,slots}` · `dusk: DuskLog[]` · `pressA` `pressD`(한 합 더 곡식) · `wokeA` `wokeD` `trueA` `trueD`(각성기) · `unarrivedA` `unarrivedD`(닿기 전에 끝난 원군 몫).

### 누가 읽나 (지도 쪽)
- `fight`(season.ts:1660-1743) · `fieldBattles`(:1390-1450)가 한 곳에서 읽어 **군대에 되먹임**한다: `scaleByGroups(군대, res.ga/gd)`, `shiftMorale(res.dma/dmd)`, `payFeast`·`payPress`(곳간 곡식), `battleFates`(사로잡힘·전사·겨루기 부상), `burnWake`(각성 불꽃), `trueWoke` 장부, `battleGrowth`·`battleMerit`(성장·단련 공), `takeYielded`(항복), `fallBack`(진 쪽 후퇴·흩어짐), 고을 점령 `node.owner =`(:1722), 보고 줄 `kind:'battle'`(types.ts:1232, 필드 약 30개).
- 보고 줄 → 소식판·싸움 카드(`battlecard.ts`)·연대기·메모리(`memory.ts`)·단련. 이야기 글은 `data/prose.ts`(`roundStory`·`endStory`·`battleName`). [확인]

### 실시간 전투가 끼어들 수 있는 이음매 (후보)
| # | 이음매 | 왜 되나 | 걸리는 것 |
|---|---|---|---|
| A | `fightRounds` 본체를 다른 함수로 바꿔 끼움 (같은 시그니처 · 같은 `FightResult`) | 호출처가 단 둘(season.ts:1390·1659)이고 반환만 읽는다. `Tactic` 에 `live?` 한 칸(BATTLE-LIVE §3) | `rounds: RoundLog[]` 가 화면·이야기·기억·보고가 쓰는 **공용 기록 형식**이라, 실시간 sim 도 합 단위 요약을 내야 한다(§5) |
| B | `Side` 입력을 확장(공간 정보) | `sideOf`(:1151)가 한 곳 | 지금 `F` 는 지형·진군·장비가 곱해진 **한 수**다. 실시간은 그걸 다시 쪼개야 해서 밸런스 기준(§8)이 흔들린다 |
| C | 화면 `rehearse`/`done(tactics)` 사이 | 화면이 sim 을 직접 안 만지고 `advance` 만 부른다 | `pending` 이 「합 단위 질문」 모양이다 |
| D | 맡기기(AI) = 같은 sim 헤드리스 | 이미 같은 엔진으로 돈다 | 실시간 sim 이 틱 수천 번이면 0.4 ms 가 수십 배가 된다(§4) |

## 3. 깃발

- **무리 셋 + 장수 = 넷.** `GRPS=['front','bows','horse']`(tactics.ts:204), 장수 깃발 `lead`. 무리가 안 서면 줄이 안 뜬다. 화면은 `panes`(battlefield.ts:2064-)가 무리 수+장수만큼 탭을 만든다 → **「넷 이하」는 `Grp` 가 셋이라는 타입에서 자연히 나오고, 어디에도 상수/검사가 없다.** 병종을 더 가르면(BATTLE.md §7 후보) 이 한도가 깨진다. [확인][의견]
- **고름 목록** (`groupOptions` tactics.ts:481 · `leadOptions` :493):
  - 앞줄: 돌격 `charge` · 방진 `hold` · 길 트기 `open`(우리 활이 있을 때) · 땅의 수 한 번씩 여울 `ford`·바위 `rocks`·성문 `gate`·배 `ram`
  - 활: 화살비 `volley` · 맞쏘기 `counter`(적 활이 있을 때) · 불화살 `fire` · 높은 곳 `height`
  - 기병: 옆치기 `flank` · 돌파 `punch` · 추격 `pursue` · 호위 `guard`
  - 장수: 북 `drum` · 호궤 `feast` · 비기 `art` · 각성기 `wake` · 겨루기 `duel`(무예 `tacDuelMu` 이상) · 사로잡기 `capture` · 물러나기 `retreat`
- **상성**: 앞줄 세모 **방진 > 돌격 > 길 트기 > 방진**(battlefield.ts:202 `FRONT_COUNTER` · 시험 tactics.test.ts:108). 흔들리는 방진(사기가 처음의 `tacHoldSteady` 아래)은 돌격을 못 받는다. 활: 화살비가 서 있는 방진에 잘 박힌다. 기병: 옆치기→적 활, 추격→흔들리는 적, 호위→사로잡기 3배. [확인(시험 이름)·옮김(세부 배수)]
- **한 합의 계산** `resolveRound`(:1229-): ① 밤 규칙·먹힌 야습 덤 `surge` ② 장수 명령(물러나기→겨루기→사로잡기→비기→각성기) ③ 바위 굴리기 ④ 앞줄 맞붙음 `strength(x)`(무리힘 `groupPower` :391 × `frontQ` × 깃발 배수) ⑤ 활 ⑥ 말 ⑦ 무리별 손실 `tacRoundLoss`(0.07) × 비 ⑧ 사기. 무너짐: 사람 처음의 `tacBreakMen`(45%) 아래 또는 사기 처음의 `tacBreakMorale`(55%) 아래(`downOf` :364).
- 낡은 상수: `BASIC`·`BEATS`·`COUNTER`(tactics.ts:206-210)는 1판 세모(돌격>화살비>방진)이고 **어디서도 안 쓰인다**(grep). 문서를 읽는 설계자가 현행 상성으로 오해하기 쉽다. [확인]

## 4. 맡기기와 AI 끼리 싸움

- 같은 수학: 플레이어가 안 낀 싸움은 `tactic` 없이 `fightRounds` → `aiOrder`(:550)가 양쪽을 고른다. 맡긴 우리 쪽은 `Side.style`(`BattleStyle`: careful·archer·mountain·river·steadfast, tactics.ts:48)이 AI 의 버릇을 바꾼다. 상대 앞줄이 지난 합에 한 것을 기억하고 지략 5 면 70% 로 맞수를 낸다(`pCounter`). [확인(구조)·옮김(70%)]
- **한 계절에 싸움이 몇 번**: 이번에 `realm-sim --region yeongnam --games 6 --seasons 40 --bot all`(한 턴 한 달)로 쟀다. **판 전체(21국) 40턴에 싸움 5.7~7.5판, 우리(봇)가 낀 싸움 0~2.3판**(cautious/planner 2.33, reckless 0). 즉 **한 턴(달)에 판 전체 0.15~0.19판, 우리 몫 0.06판**. 사람은 봇보다 많다(BALANCE.md:1448 「싸움 2~3」 [옮김]). 옛 10-26 측정은 영남 12판×40계절 싸움 900판 남짓(판당 합 1.91) [옮김]. [확인(이번 측정) + 옮김]
- **전투 한 판 비용**(이번 측정, node strip-types · 20000판): AI 끼리 **0.45 ms**·평균 4.19합 · 플레이어 쪽 AI 0.37 ms/4.23합 · `open` 시험 돌림의 첫 `pending` 짓기(깃발 짐작 `lookAt` 48표본 포함) **1.5 ms**. `tools/realm-tactics.ts --n 300` 는 6비율×4전술 ≈ 49초. [확인]
- **`advance` 한 턴**: realm-sim 24판×40턴 = 49.5초 → AI 결정 포함 약 50 ms/턴. `rehearse` 가 고를 때마다 이걸 처음부터 돈다(명령 7~15번이면 0.4~0.8초 분량). [확인(추정 산수)]
- 「맡긴 결과 ±3%p」(BATTLE-LIVE 문턱) 기준표: `tools/realm-tactics.ts` 가 옛 한 번 굴림(`winChance`)·맡김·잘 읽음·못 읽음·늘 방진을 비율 6칸으로 낸다. 이번 n=300: 비 1.0 에서 옛 45% · 맡김 47% · 잘 읽음 84% · 못 읽음 23% · 늘 방진 43%, 합 수 3.5~4.2. [확인]

## 5. 결정론 · 기록

- **명령 줄**: `Order{kind:'command', key, cmds:(Cmd|RoundOrder)[], dusk?}`(types.ts:1074). `cmds[i]` = i 번째 합의 무리별 명령. 마지막 때 고름 `dusk[k]`. 겨루기 손 결과는 `RoundOrder.duel:'win'|'lose'`(types.ts:531-)로 같은 줄에 적혀 굴림 대신 쓰인다(tactics.ts 겨루기 처리, 시험판 `duel.html` · battlefield.ts:4811-4812). [확인]
- **기록 경로**: 화면 `finish`(app.ts:8893-8899) → `endSeason` → `advance(prev, [...mine,...ai, ...command])` → `host.onAdvance`(app.ts:8155) → realm-main.ts:466-467 `state.log = [...state.log, [...orders]]` + `game.turns.push({orders: mine, lines…})`. 즉 **판 기록 = 턴마다 전체 명령 배열**이고 `command` 가 그 안에 있다. 재생 도구 `tools/realm-replay.ts` · 해시 도구 `tools/realm-oldclock-hash.ts`. [확인]
- **결정론**: 굴림은 이름 붙은 `roll(seed,season,key)` 만. tactics·season·warroom 에 `Math.random/Date.now/performance.now/Math.sin/Math.cos` 없음(grep 0). 옛 기록은 `dusk` 없으면 「그 합 명령이 있으면 밀어붙임」으로 해석(tactics.ts:822-826). 같은 판·같은 명령이면 같은 결과를 시험이 지킨다(tactics.test.ts:355·404·590). [확인]
- **실시간 입력을 기록하려면 고칠 곳**: ① `Tactic`(types.ts:614)에 `live?: {tick, 무리, 목표}[]` 같은 칸 — `cmds` 는 **합 번호로 색인**돼 틱 단위를 못 담는다 ② `Order 'command'`(types.ts:1074)에 같은 칸 ③ app.ts:8897 `finish` 의 직렬화 ④ `rehearse`(warroom.ts:33)의 `cur` 인자 ⑤ 저장 크기(`realm-savesize`·`realm-memsize` 도구가 있다). BATTLE-LIVE 는 「입력 기록 30~80줄」로 어림했다 [옮김]. 정수 격자·`Math.sin/cos` 금지는 BATTLE-LIVE 1주차 메모 [옮김].

## 6. 이미 있는 것

| 항목 | 상태 | 근거 |
|---|---|---|
| 진군 방식 다섯 | 있음. 대로(사기+0.05)·밤길·여울(강·갈대·얕은 물 길만)·산기슭(고개·숲·솔숲·산성·높은 터)·절벽(산성·높은 터만). 숨어 닿기는 확률이 아니라 `hides(p)` 조건(굴림 `roll`) | approachOptions season.ts:923 · fight :1534-1560 · `cliffChance` :975 |
| 막힌 길 | 있음. 눈 덮인 고개 8% 얼음·장마 나루 6% 떠내려감·한 계절 더·사기 −0.06, 미리 안내 | season.ts:895-902 · calendar.ts:102 |
| 군량 | 있음. 길 위 `a.food -= 1`(:1816) · 닿자마자 바닥이면 합마다 사기 `tacHungry` −0.04(tactics.ts:1728) · 남의 땅에 머물면 `stepFood`(:1877) 사람 `rationHungryLoss` 5%·사기 8% | [확인] |
| 정찰 | 있음. 정찰꾼(`scoutCap` 고을 수에 1~3)·범위 `scoutReach` 6·`resolveScouts` season.ts:1000·파수 `watchBorders` scouts.ts(우리 고을 이웃은 늘 범위로 보임, 흐림 `watchBlur` 0.2). **전투 안에서의 효과는 하나뿐: `Side.seen` → 낌새 정확도 `tacHintScout` 75%+지략** | scouts.ts · tactics.ts:649-660 |
| 낌새 | 있음. **적 앞줄의 다음 수 하나**(돌격/방진/길 트기). 본 것(saw) 75%+0.03×(지략−5) · 들은 것(habit, 겨뤄 본 장수의 버릇). 적 활·기병 깃발은 안 보임 | tactics.ts:649 · `Pending.hint` types.ts:666 |
| 미니맵 | **없음.** `radar.ts` 는 장수 육각 능력치 그림이다(이름만 비슷). 전략 지도는 따로(`mapview.ts`)이고 싸움 안에는 공간 그림이 없다 | grep `minimap|미니맵` 0건 |
| 사로잡기 | 있음. 날랜 무리÷호위 식 `captureOdds` tactics.ts:407. 28명→570명 속 장수 0.1%. 잡으면 판 끝·대승·상대 사기 −0.3. `battle-capture.ts` 가 장수가 뛰어가 이고 오는 연출 | [확인] · BATTLE.md §사로잡기 |
| 대결(duel) | 있음. 장수 깃발 「겨루기」 → 합이 풀리기 전 `src/duel/view.ts` `mountDuel`(battlefield.ts:4811)이 겹쳐 뜸 → 결과 `sel.duel` → `RoundOrder.duel`. 비기면 무예로 굴림 | [확인] |
| 비기·각성기 | 있음(장수마다 한 번). 선봉 난전 `breakthrough`(vanguard.ts)는 직접 조작 구간이 이미 있다 | tactics.ts:105 · RoundOrder.breakthrough |
| 원군 | 있음. `Side.relief{mix,at,heroes}` · `reliefRound` 합에 옆에서 닿음 · 둘째 물결 `waveOf` season.ts:1485 | tests/realm/relief.test.ts |
| 들판 싸움 | 있음(대로에서 만남) | season.ts:1349 |
| 공성/수성 | **이름표·배경·배수·깃발 하나**: 싸움 이름표 「우리의 공성/적의 공성(수성)」 `warKind` battlefield.ts:913 · 성문 배경 `warGround` :889(`battle-gate(-def).jpg`) · 목책 말뚝 그림 `stakes` :476 · `fortMul` 배수 · `성문 깨기` 깃발. **합이 느는 단계·여러 계절 포위·창고 불화살은 없다**(BATTLE.md §7 「공성: 아직 안 한 것」). 서 있는 고을을 치는 `assault` 명령은 있다(season.ts:852) | [확인] |
| 수상전 | 반쯤. `water`(길이 여울·갈대·바다·갯벌이거나 포구) → 수군(`boat`)이 앞줄에 서고 `ram`(배 들이받기 ×1.5, 수군 15% 이상) · 「○○ 바다 싸움」 이름. 배끼리 공간·돌진은 없다 | season.ts:1612 · tactics.ts `shares` |

## 7. 화면

- **구성** (`openWar` battlefield.ts:3659 · `warHtml` :1493): 머리 `wtop` = 싸움 이름 띠·때(해시계) 줄·두 장수 얼굴·사람 막대·사기 막대(무너지는 선 표시) → 전장 `wfield`(병사 그림 `troops.ts` 가 10명/100명/1000명 단위로 센 DOM 이미지 · 합 연출 `battle-strikes.ts`·`battle-capture.ts` · CSS 애니메이션 · 폰에서 높이 `clamp(170px,46vw,220px)` :2269) → 합 기록(이야기·잃은 수) → 다음 합 `wnext`: 적 낌새·흔들림·적 무리 사람 수·**무리 탭**(눌러 그 무리 깃발만 펼침 `wgtabs`)·깃발 카드마다 깃발 짐작(`lookHtml`: 잃을 사람·사기 범위·무너질 % ) → 맨 아래 띠: 장수 얼굴·**맡긴다**(`data-war="auto"` :2092, 확인창 :4876)·**전투 개시**(`data-war="go"` :2094, 다 고르면 켜짐)·배속 단추(1·2·2.5배). 마지막 때에는 「해가 진다」 큰 판.
- **무엇을 누르나**: 무리 탭 → 깃발 카드(고름) → 「전투 개시」(합 풀림) → 다음 합 …; 맡긴다는 싸움 하나씩만(**「남은 싸움 다 맡긴다」 단추는 10-25 에 뺐다 — BATTLE.md §0 는 낡았다**, battlefield.ts:2090 주석).
- **폰 폭**: `@media (max-width:520px)` 규칙이 :2211·2257·2261·2268-2270·2282·2329 등에 퍼져 있다(초상 `--pf: min(92px,24vw)`). 네 폭 확인 도구는 `tools/phone-shot.ts`·`battle-mobile-review.html`(메모리: 폰 폭 레이아웃). 성능은 `tools/war-perf.ts`(헤드리스 크롬 연습 싸움 9초 측정). [확인(파일)·못 봄(오늘 화면)]
- **10-28 「새 전투 시험」(battle0) 스위치**: **죽은 스위치.** 안내·반응(손가락·큰 깃발 뜸·진 움찔·숫자 「자세히」)은 `ov.classList.add('b0')`(battlefield.ts:3716)로 **무조건 켜져 있다**. `B0_KEY`·`b0On()`(:522-525)는 정의만 남았고 `app.ts` 에서 `b0-toggle` 케이스(:8790)는 있으나 **그 단추를 그리는 곳이 없다**(grep 1건). `wipe.ts:16` 의 지우기 목록에 `hanbal.realm.battle0` 이 남아 있다. [확인] — BATTLE-LIVE 「0번」은 사실상 **전투 기본값이 되었다**. 지인 재시험 결과(「그래도 컨트롤하고 싶다」가 나오나)는 못 봄.

## 8. 시험 · 도구

- **전투를 직접 지키는 시험**(tests/realm): `tactics.test.ts`(34 케이스: 무리 깃발·세모·땅의 수·사로잡기·해시계·밤·마지막 때·시험 돌림=진짜 같음·진군 방식 고름·군량·비기·부장·같은 판 같은 결과) · `look.test.ts`(깃발 짐작 보정) · `guess.test.ts`(짐작이 맞수를 가리킴) · `relief.test.ts`(9) · `wake.test.ts`(13) · `vanguard.test.ts` · `battle.test.ts`(옛 한 번 굴림 15) · `battlestory.test.ts`(이야기 글·조사) · `battle-strikes.test.ts` · `troops.test.ts` · `battlestyle.test.ts` · `tutorial.test.ts`(배우는 판) · `ambush.test.ts`·`ambush-rite.test.ts` · `wave.test.ts` · `strike.test.ts` · `scouts.test.ts`. 이 밖에 tests/realm 160여 파일 가운데 약 80개가 `advance(` 를 불러 **싸움 결과에 기대어** 경제·외교·장수·기억을 본다(grep: `advance(` 포함 80파일) — 전투 결과 형식·수치가 바뀌면 같이 흔들린다. tests/i18n.test.ts 가 전투 글(`war.*`)을 본다. 그 밖 tests/duel*.test.ts 는 대결 엔진.
- **밸런스 도구**: `realm-tactics.ts`(표 §4) · `realm-sim.ts`(봇 판 전체) · `realm-sweep.ts` · `realm-fuzz.ts` · `realm-oldclock-hash.ts`(옛 판이 옛 길로 도는가) · `realm-replay.ts` · `realm-perf.ts` · `war-perf.ts`(화면) · `persona-test.ts`·`first-hour.ts`(처음 한 시간). `advance`/`fightRounds` 를 부르는 tools 28개.
- **손잡이**: `src/tune/params.ts` 의 `tac*` 137개(tacK 1.1·tacRoundLoss 0.07·tacClock 4·tacBreakMen 0.45·tacBreakMorale 0.55·tacWinShare 0.58·tacRoundsMax 5·tacGroupMin 0.06·tacLookSamples 48 …) · `war*`(연출) · `fort*` · `ap*`(진군) · `ration*`. **실시간으로 바꾸면 깨질 것**: 위 시험의 합 번호 색인(`cmds[i]`)·`rounds.length`·「합 수 4.2」 표·`tacClock` 해시계 4때(실시간엔 때가 시간이 됨)·`Pending` 모양·`RoundLog.acts` 를 읽는 이야기(`roundStory`)와 연출.

## 9. 형의 낱말 대조표

| 낱말 | 지금 | 근거 |
|---|---|---|
| 기습 | **있음** (밤길·여울·산기슭·절벽, 먹힘/들킴 굴림, 밤 싸움 4때, 첫 칼) | season.ts:1534-1584 · tactics.ts `nightAt` :348 |
| 대로에서 만남 | **있음**(들판 싸움). 진군 방식 「대로」는 사기 +0.05 | season.ts:1349 · `apRoadMorale` |
| 공성 | **반쯤** — 성 배수·성문 깨기 깃발·이름표·배경. 단계·여러 합 없음 | §6 |
| 수성 | **반쯤** — 지키는 쪽 `terrain`(여울 막기·바위·높은 곳)·원군·`rescueCapital`(hooks.ts:61). 수성 전용 규칙(성벽 체력·방어 시설) 없음 | season.ts:1621-1636 |
| 개울 | **반쯤** — 「여울」: 길 종류 `ford`/`reeds`/`shallows` 태그 → 도하 기습·여울 막기·「○○나루 싸움」·배경 `ford`. 건너는 중의 공간은 없음 | season.ts:923-932 |
| 수상전 | **반쯤** — `water`·`boat`·배 들이받기·바다 싸움 이름 | §6 |
| 목책 | **반쯤** — 고을 `palisade` 태그 ×1.2(건설 `applyBuild` economy.ts:458, `stepBuilds` :469)·`성문 깨기`·배경 `gate`·말뚝 그림. 싸움 중 부서지는 것은 그림뿐(`stakes(broken)`) | season.ts:227 · battlefield.ts:476 |
| 목책 해자 | **반쯤** — 해자 ×1.15(겨울엔 얼어 ×1)·`moatSvg` 그림. 건너기·메우기 없음 | season.ts:231 · battlefield.ts:448 |
| 깃발 지휘 | **있음** — 이 전투의 중심. 단 합 단위 선택(동시 공개)이지 실시간 아님 | §3 |
| 미니맵 | **없음** | §6 |
| 정찰(적 깃발) | **반쯤** — 적 앞줄 다음 수 하나(낌새)·적 무리 사람 수(늘 보임)·적이 흔들리는지. 적 활·기병 깃발·진형은 안 보인다 | tactics.ts:649 · Pending.foe |
| 정찰(다음 수) | **반쯤** — 위 낌새가 바로 「다음 수」. 정찰 직접 효과는 `seen` → 정확도 75% | tactics.ts:660 |

## 바로 고칠 것 (조사 중 본 것 · 내가 고치지 않았다)
1. `docs/realm/BATTLE.md` §0 「"남은 싸움 다 맡긴다" 로 언제든」·§3 「합 3번」 등이 코드와 어긋남(그 단추는 10-25 에 뺐다 · 합은 4때+한 합 더). §7 「다음에(아직 안 한 것)」에서 ② 활·공성 문구도 현황 확인 필요.
2. `src/realm/tactics.ts:206-210` `BASIC`·`BEATS`·`COUNTER` — 쓰는 곳 0, 1판 세모 주석(돌격>화살비>방진)이라 현행(방진>돌격>길 트기)과 반대로 읽힘.
3. 죽은 시험 스위치 `B0_KEY`/`b0On`(battlefield.ts:522) · app.ts:8790 `b0-toggle` 케이스 · wipe.ts:16 의 `hanbal.realm.battle0`. BATTLE-LIVE.md §순서 0 의 「꺼짐/켜짐」 서술도 낡음(지금 항상 켜짐).
4. `docs/realm/BATTLE.md` §6 화면 줄이 중간에서 끊김(「북 …」으로 끝남) — 원문 확인 필요.

## 못 본 것
- 전장 화면을 **브라우저로 눈으로** 보지 않았다(읽기 전용·브라우저 금지). 폰 폭 네 장·배속·연출 길이는 못 봄.
- `battleFates`(season.ts:1260-)·`battleGrowth`·`fallBack` 의 세부 식, `aiOrder`(tactics.ts:550-635) 전체 분기, `resolveRound` 활·기병 절의 배수 전부는 훑지 않았다. `power()`(battle.ts:194)의 지형·장비 배수도 줄 단위로는 안 봄.
- `src/duel/` 엔진 내부, `data/prose.ts` 이야기 생성, 소리·연출 표(`BATTLE_SFX`·`cmdFxHtml`) 못 봄.
- 사람이 한 판에서 싸우는 **실제 횟수**(플레이 기록)·싸움 한 번의 평균 클릭 수는 못 봄 — 봇 값뿐. `docs/BALANCE.md` 숫자는 [옮김]이고 이번 측정(6판×40턴)은 표본이 작다.
- 오늘(11-25) 작업 중인 미커밋 변경(HANDOFF.md·raid 쪽)은 전투와 무관해 보여 안 열었다. 이 장은 HEAD 7b91fe6b 의 작업 트리를 읽었다(`git status` 상 src/realm·src/ui/realm 변경 없음).
