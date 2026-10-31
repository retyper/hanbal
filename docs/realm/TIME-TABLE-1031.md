# 시간 개편 작업표 (10-31 · 한 턴 = 한 달)

`docs/realm/FEEDBACK-1031.md` 「시간 개편 계획」의 일 목록. **아직 코드는 하나도 안 바꿨다.**
바탕: `r.season` 은 「턴 수」로 남기고, calendar.ts 에 `seasonOf(t) = floor(t/3) % 4` · `monthOf(t) = t % 12` ·
`yearOf(t) = floor(t/12)` · `seasonIdx(t) = floor(t/3)` · `seasonEnd(t) = t % 3 === 2` 를 둔다.
아래 「×3」은 `r.season + n*3` 처럼 기한을 달로 바꾸는 것, 「끝셈」은 seasonEnd 턴에만 한 칸 세는 것.
params 는 **계절 단위 그대로 두고 쓰는 곳에서 ×3** 하는 쪽을 권한다 (화면 글 「n계절」→「n달」 바꿀 때 `n*3` 한 곳).

## 1. P.realm 의 계절 단위 수치 (src/tune/params.ts)

### 1-A. 기간 — 기한 `until = r.season + n` 으로 쓰는 것 → **×3**

| 이름 | 값 | 줄 | 처리 |
|---|---|---|---|
| truceSeasons | 8 | 2718 | ×3 (diplomacy 9곳) |
| troopsSeasons | 8 | 2787 | ×3 |
| pledgeSeasons | 2 | 2780 | ×3 |
| tributeSeasons | 8 | 2064 | ×3 |
| exileSeasons | 8 | 2620 | ×3 (season.ts 1533 · 1583 두 곳 다) |
| plotWoundSeasons · plotBribeSeasons · plotSpySeasons | 2 · 2 · 4 | 2112–2118 | ×3 (`- 1` 붙은 셈 주의: `n*3 - 1`) |
| rulerAgentWound | 2 | 2290 | ×3 |
| migrateCalm | 1 | 2232 | ×3 (「그 계절 + 이만큼」 → 남은 달 + n*3) |
| wandererStay | 2 | 2531 | ×3 |
| riseWait · riseWindow | 2 · 8 | 2473–2474 | ×3 (hooks.ts 79 · 154) |
| kidGrowSeasons | 4 | 2379 | ×3 |
| wedSeasons | 16 | 2369 | ×3 (heroes 988 `due`) · 떨어진 계절마다 `due += 1` (heroes 1079)은 끝셈으로 +3 |
| wedHoney | 2 | 2374 | ×3 · 「떨어져 지낸 계절」 판정은 끝셈 |
| (코드) EXP_SEASONS | [2,4,8] | expedition.ts 24 | ×3 · `expGrainPer × EXP_SEASONS` 곡식 셈은 계절 그대로 |
| (코드) 장수 다침 `r.season + 1` | 1 | season.ts 961·971·986 | 「다음 턴까지」면 그대로, 「한 계절」이면 ×3 — 정할 것 |
| (코드) 청 기한 `until: r.season + 1` | 1 | diplomacy 881 | 그대로 (다음 턴에 답) |
| (코드) 목책·해자 `done: r.season` | 0 | economy 373 | 다음 턴에 선다 → 한 계절 걸리게 하려면 +2 |

### 1-B. 기간 — 나이·지난 시간 `r.season - x.season` 과 비교하는 것 → **×3** (또는 `seasonIdx` 차)

| 이름 | 값 | 줄 | 쓰는 곳 |
|---|---|---|---|
| intelBlindAge · aiCautiousAge | 4 · 1 | 2677 · 2690 | intel.ts 91 · estimate 67 |
| cnGrainAge · cnMemAge · cnCouncilWatch | 4 · 12 · 4 | 1938–1940 | council |
| memSplitWatch · memPlotWindow | 1 · 2 | 2345–2346 | memory.ts 111 |
| stanceMemory · stanceHungry | 2 · 1 | 2771 · 2773 | stance.ts 76 (stanceHungry 은 군량 계절치 — 1-E) |
| wooRescueSeasons · wooTalkGap | 4 · 3 | 2340 · 2335 | woo.ts 78 · 93 · 258 |

### 1-C. 기간 — 판 처음부터 센 **절대 계절 번호** `r.season < X` → **`seasonIdx(r.season) < X`** (값 그대로)

| 이름 | 값 | 줄 | 쓰는 곳 |
|---|---|---|---|
| aiGrace · aiApproachFrom · aiApproachSolo | 8 · 4 · 8 | 2700–2706 | ai.ts 131 · 884 · 901 |
| contestSeasons · pursuitSeasons | 4 · 3 | 1630–1631 | scenario.ts 76 · ai.ts 123 |
| cardFishSeason · cardGogakSeason | 1 · 4 | 1632–1633 | 2장 카드 |
| (데이터) 장의 `limit` · 목표 `g.seasons` | — | scenario.ts 49 · 60 | 장 데이터(src/realm/data) — seasonIdx 로 비교 |

### 1-D. 끝셈 — 「내리 n계절」을 세는 시계

| 이름 | 값 | 줄 | 처리 |
|---|---|---|---|
| suzerainSeasons | 4 | 2065 | stepSuzerain 을 seasonEnd 에만 → 값 그대로 |
| persuadeSeasons · persuadeUiriPer | 4 · 0.5 | 2291 · 2261 | 회유 `pz.left` 를 끝셈으로 → 그대로 |
| aiFarEvery · aiFarEveryWorld | 3 · 5 | 2628–2629 | ai.ts 865 `(r.season + i) % every` → `seasonIdx` 로 (안 그러면 먼 나라 AI 가 세 배 자주 생각) |

### 1-E. 계절마다의 몫 → **값 그대로, seasonEnd 에만 적용** (약 45개)

- 땅에서 나는 것: ironPerMine 20 · ironPerPort 4 · saltPerCoast 4 · fishPerHH 0.015 · woodPerNode 3 · horsePerPasture 2 · landPastureHorse 4 · landPastureGrain 10 · traitSmith 4 · relicIron 1
- 장터·호감: truceTrade 5 · marketIron 3 · favorMarket 1 · favorCommonFoe 1 · favorStation 4
- 집·사기: hhGrowth 0.015 · hhHunger 0.03 · hungerMorale 0.15 · fedMorale 0.05 · settleGrow 0.06 · landReedsFlood 0.015(여름 끝)
- 장수: bondSeason 1 · xpPost 1 · drillMeritPost 1 · drillMeritLead 0.5 · tieSeason 4 · persuadeDrop 1.5 · recruitBase 0.45 · persuadeGrain 10 · relicEarringWoo 1.5 · wooBig/wooSway/wooRage (한 계절 몫의 배수 · 그대로)
- 정보·공작: alertDecay 0.05 · intelGrowMax 0.2 · intelLossMax 0.05 · intelAlertWiden 0.05 · plotConfess 0.2 · rumorChance 0.6 · discoverDrift 0.35
  - ★ intel 넷은 `age`(1-B)를 쓰는 셈과 짝이다 — age 를 달로 바꾸면 이 넷은 ÷3 이거나 age 를 계절로 되돌려 넣어야 한다
- 확률·박자 (AI 외교 박자 = seasonEnd): cardChance 0.45 · aiAskChance 0.07 · askMaxPerSeason 2 · aiEnvoyChance 0.15 · aiPlotChance 0.12 · plotsPerSeason 6 · aiBowUpChance 0.04 · aiBreakChance 0.3 · aiJointChance 0.3 · wandererChance(heroes 715 · 봄 첫 달에만)
- 해마다 (손 안 댐): riteHarvest · tierIncome · tierOurs · card*Mul(그해 가을걷이) — `Math.floor(r.season/4)` 만 yearOf 로

### 1-F. 군량 — 그 밖 (정할 것: 「달마다 ⅓」 안 · 「seasonEnd 에 한 계절치」 안)

rationPerSoldier 0.0625 · rationPack 0.5 · rationReserve 2 · rationMaxExtra 4 · rationHungryMorale 0.08 · rationHungryLoss 0.05 ·
fedMoraleStock 3 · aiHireReserve 3 · aiDraftReserve 3 · stanceHungry 1 · saltPerAway 0.02 · expGrainPer 10.
권하는 안: **창고 군량(stepEconomy upkeepOf)은 seasonEnd 에 한 계절치**, **나가 있는 군대가 지고 간 군량(stepFood)은 달마다 ⅓**.
「계절치」로 센 비축 값(rationReserve·aiDraftReserve…)은 그대로 둔다 (단위가 곡식/계절이라 바뀌지 않는다).
길 계절(rationReserve 설명의 「길 계절」)은 달로 센 길을 ÷3 올림해서 계절치로 바꾼다.

### 1-G. 한 계절에 할 수 있는 양 — 그 밖 (달마다 ⅓ 또는 계절 한도 장부)

draftPerSeason 0.1 · settleShare 0.15 · migrateShare 0.25 · migrateAutoShare 0.02(자동 → seasonEnd) · placeShare 0.12 ·
placeRateRoom 0.1 · placeRateMin 5.
권하는 안: 명령은 달마다 내리니 **한도 = 계절 몫 ÷ 3 을 달마다** (단순 · 장부 없음). placeRate* 은 달마다 ÷3 하면
형이 말한 「몇 턴에 걸쳐 닿는다」가 오히려 더 잘 보인다 (placeRateMin 은 ÷3 올림 2).

### 1-H. 움직임 — 새로 짠다

| 이름 | 값 | 줄 | 처리 |
|---|---|---|---|
| (기본 1계절) | 1 | season.ts 84 | 길마다 달 = 지도 길이 ÷ 한 달 행군 (짧은 길 1달) — 새 수치 `marchLenPerMonth` |
| marchSlow | 2 | 1994 | 고갯길·갯벌 배수(예: ×2)로 뜻을 바꾼다 |
| marchSummerExtra | 1 | 1995 | 7·8월 턴에만 +1달 (장마) |
| hardExtra | 1 | 1957 | 눈 덮인 고개(12–2월)·불어난 나루(7·8월) +1달 · blockedWhy 를 달로 |
| apRidgeExtra · landHighPass · relicWheelMarch | 1 · 1 · 1 | 1918 · 2497 · 2592 | 「계절」→「달」 (값 1 그대로 두면 덜 아프다) |
| (코드) 퇴각 `left: 1` | 1 | diplomacy 115 | 1달 |
| (코드) 개척단 `march.left -= 1` | — | parties.ts 127 | 길 달 수로 |

### 1-I. 상관없음
repGroupOpen · uiRollMs · uiRollPlanMs · bgmRestMinS · tacHintScout(「이번 계절」= 이번 턴) — 글만 「이번 달」로.

## 2. src/realm 에서 턴 수로 달력을 셈하는 곳

`seasonOf(` 32곳 (ai 3 · diplomacy 1 · economy 9 · estimate 4 · goal 1 · hooks 6 · parties 1 · season 7) — **calendar.ts 의 seasonOf 하나만 고치면 다 따라온다.**
「봄이면」「가을이면」으로 한 번만 도는 일(hooks 197·214·231·258 · economy 726·739 · heroes 715)은 그 계절 석 달 내내 참이 되니 **seasonEnd(또는 첫 달)도 같이 걸어야** 한다.

`% 4` · `/ 4` 직접 셈 12곳 — 다 calendar 로 옮긴다:
- season.ts 1608 `season = r.season % 4` → stepEconomy 에 넘기는 계절 · seasonOf 로
- economy.ts 729 · 748 · 938 · 994 `Math.floor(r.season/4)` → 해 (봄 제사한 해 · 그해 가을걷이 배수) → yearOf
- events.ts 41 `season % 4` (카드 뽑을 계절) · 178 해 → seasonOf · yearOf
- heroes.ts 715 `% 4 === 0` 봄에 떠돌이 → 봄 첫 달만
- hooks.ts 259 · 319 해 → yearOf
- paths.ts 88 계절 · 127 가을 → seasonOf
- types.ts 14 · 841 · 860 주석

`r.season ± n` 49곳 (+ 절대 비교 5곳):
- diplomacy.ts 14 — 기한(truce 9 · pledge · tribute · troops) ×3 · 275 길 계절 셈(`seasonOf(r.season + k)`: k 가 달이 되면 그대로 맞다) · 453 정보 나이 · 881 청 기한(그대로)
- plots.ts 5 — 다침·매수·첩자 기한 ×3 · 256 경계 나이
- season.ts 6 — 844 「지난 계절에 본 것」(`<= 1` → `<= 3`?) · 961·971·986 다침 · 1533·1583 짐 기한
- heroes.ts 4 — 728 떠돌이 · 924 신혼 남은 · 988 아이 · 1053 자람
- estimate.ts 3 · intel.ts 1 · plots 256 — 정보 나이 (1-E ★ 와 짝)
- woo.ts 3 · hooks.ts 2 · memory.ts 1 · stance.ts 1 · expedition.ts 1 · events.ts 1(424 다음 카드 `+1` → 다음 계절 첫 달)
- paths.ts 45 · 84 `r.season - 3` — 교역 장부 「지난 네 계절」 창 → `- 11`
- scenario.ts 49 · 60 — 장 목표·한도 (1-C)
- ai.ts 865 — 먼 나라 박자 (1-D)
- 절대 비교: ai.ts 123 · 131 · 884 · 901 · scenario.ts 76 (1-C)
- suzerain.ts 21 · 67 · economy.ts 381 — `until`/`done` 과 비교만 (기한을 ×3 으로 넣으면 그대로)

화면(src/ui) 에도 같은 셈 약 48곳 (app.ts · mapview.ts · front.ts · card-lines.ts …) — 「n계절」 글 · 위 띠 달 표시와 함께 따로 한 번.

## 3. advance() 단계 — 달마다 / 계절 끝에만

**달마다 (움직임·싸움·명령):**
resolveAnswers(1) · stepInbound(1 앞, 달마다 ÷3) · applyOrders(1) · departures · resolveScouts(2) · limitHands/resolveEnvoys(2) ·
applyBowUps(2) · resolvePlots(2 — plotsPerSeason 은 계절 장부 또는 ÷3) · resolveRites(2 — 봄 석 달 중 한 번, blessed 해로 이미 막힘) ·
resolveContests · resolveMarches(3·4·5) · stepParties(5) · stepFood(5 끝, ÷3) · sweepHeroes(5 끝) ·
stepExpeditions · expireRelations · checkPledges · stepLent · shareIntel · stepBuilds · refreshSpies + noteMet ·
stepSight · sighted 줄 · stepExile/checkOutcome · noteMemory · `r.season += 1`

**계절 끝 달에만 (seasonEnd):**
stepEconomy(7 — 땅 소출·가을걷이·창고 군량·집 늘기·굶주림·사기) · stepMigration(7 끝) · decayWatch(9) ·
stepHeroes(9 — 회유·담판 벽·정·친밀·떠돌이·혼인/아이; 다침 기한 만료는 달마다 따로 빼야 함) ·
holdMarkets · driftFavor · stationFriction · stepCustoms 중 소출·홍수·거른 제사 (다시 일어남은 달마다) ·
spreadRumors · stepDiscovery · stepSuzerain + suzerainEnd · stepPaths + pathsEnd · makeAsks · seasonMerit

**새 계절 첫 달 (`r.season += 1` 뒤 `monthOfSeason === 0`):** stepCards (카드는 계절마다 한 장 그대로 — 형이 「매 계절도 피곤」했다).

AI: `aiOrders` 는 달마다 (행군) · 그 안의 사신·공작·청·깨기·징병 굴림은 seasonEnd 만 (1-E 확률 그대로).

## 4. 위험

1. **반쯤 바꾸면 판이 깨진다** — 기한(×3)과 나이(×3)와 끝셈이 섞여 하나만 빠져도 화친이 석 달에 풀리거나 정보가 넉 달에 「모름」이 된다. 1-A~1-D 를 한 커밋으로.
2. **seasonMerit · 보고 줄** — 계절 끝에만 공을 세면 앞 두 달의 싸움·공작 줄이 사라진다. 계절 동안 줄을 모으는 장부(r.seasonLog)가 필요.
3. **「봄이면」 석 달 내내** — seasonOf 만 바꾸고 seasonEnd 를 안 걸면 봄 제사 거름·떠돌이·여름 홍수가 세 번 돈다.
4. **정보 범위** — intel age 를 달로 세고 intelGrowMax 를 계절당으로 두면 범위가 세 배로 벌어진다.
5. **싸움 수** — 달마다 행군이 끝나면 한 계절에 싸움이 세 번 날 수 있다 → 싸움/판·짐 비율 다시 잰다 (`tools/realm-sim.ts`).
6. **결정론 시험** — `roll(r.seed, r.season, …)` 열쇠가 턴 수라 같은 씨도 결과가 다 바뀐다. 고정 기대값 시험은 새 판(`clock: 'month'`)용으로 다시 박는다. 옛 판(clock 없음)은 옛 길로 그대로 돌아야 한다 — calendar 함수가 `r.clock` 을 보게.
7. **판 길이** — 장 `limit`·목표 계절, 봇 판 「40계절」 등 BALANCE 기준이 턴 수면 세 배 길어진다. 턴 수와 계절 수를 섞지 말 것.
8. **UI 48곳** — 화면이 seasonOf 를 따로 셈하면 위 띠 계절과 판이 어긋난다. calendar 한 곳만 쓰게.
9. **개척단·인구 재편** — 「한 턴에 하나」「한 턴에 닿음」이 달이 되면 세 배 빨라진다 (1-G).
