# 22 · 설계안 · 코드 현실 관점 (battle-study · 2026-11-25 · 설계안 일꾼)

표시: **[확인]** 오늘 코드·도구로 직접 본 것(파일:줄 = HEAD) · **[옮김]** 조사 장·문서에서 옮긴 것 · **[의견]** 내 판단 · **[바꿈]** 형·앞 문서의 낱말을 내가 바꾼 것.
관점: 이 저장소에서 **실제로 지을 수 있고, 깨지지 않는가**만 본다. 재미는 「형의 그림을 얼마나 그대로 받는가」로만 따진다. 다른 설계안(21 · 23)은 안 읽었다.

## 폰으로 읽는 열 줄
1. 고른 이음: **나′ (차분 · 差分)** — 사람이 치는 싸움만 새 전장 sim 이 재고, 그 결과를 **맡기기 결과에 더하는 작은 값**으로만 `advance` 에 넣는다. 맡기기·AI 끼리는 지금 엔진 그대로(같은 수학이 글자 그대로).
2. 까닭: 시험 약 80개·도구 29개·`RoundLog` 먹는 파일 열둘이 **한 줄도 안 바뀐다**. 새 sim 이 느려도 `advance`(턴당 약 50ms)에 안 들어간다. 기기마다 sim 끝자리가 달라도 결과가 **자료**라 재생이 안 깨진다.
3. 「직접」은 두 겹: 자세(돌격·방진·길 트기)는 지금 `cmds` 로 그대로 흘러 **판단**이 지금 수학에 남고, 자리·끌기는 **손**이 되어 한도(+10%p / −4%p)가 있는 덧셈으로만 들어간다.
4. **가(합 엔진이 심판)는 나′ 의 첫 단계다**: 덧셈을 0 으로 두면 곧 가. 문턱을 못 넘으면 값만 0 으로 두고 물러난다. 끄면 지금 카드 전투.
5. 새 코드는 `src/field/`(DOM 없는 정수 sim, 10Hz 정수 격자, 덩어리 약 26개 + 그리기 때만 낱낱 점) · `field.html`. 본편에 닿는 곳은 아래 §4 의 **열두 줄**.
6. 정정: BATTLE-LIVE 의 「`Tactic` 에 `live?` 한 칸만」은 **틀리다.** `Tactic`·`Order command`·`FightResult`·`ReportLine battle`·`fightRounds` 끝 분류, 다섯 군데를 건드린다(§4).
7. 규모 어림(못 잼): 시험장 약 12형일, 연결 약 7.5형일, 합 약 20형일. 03 의 15~25형일 안이지만 영어·15세 판과 겹친다. 시험장은 **10일 상자**.
8. 가장 위험한 이음매: `fightRounds` 끝의 결과 분류를 함수로 빼는 일(시험 약 80개·골든 해시가 같이 걸림)과, 덧셈을 얹은 뒤 **마지막 `RoundLog` 와 `FightResult` 가 어긋나는 일**.
9. 형께 물을 것 셋(§9): 출시 전 범위 · 손의 한도 · 첫 판(배우는 판·마한 첫 패배)은 실시간에서 뺀다.
10. 맨 먼저 해도 되는 것: **「맡기면 이만큼」 예상 미리 보기**(이미 있는 `open` 시험 돌림의 값을 보이기만 · 1일). 실시간이 안 돼도 값이 남는다(13 안 A4).

## 0. 앞 장의 주장을 다시 열어 본 표 (설계의 뼈대인 것 열하나)
| # | 주장 (장) | 내가 연 곳 | 판정 |
|---|---|---|---|
| 1 | `fightRounds` 호출처는 둘(01) | `src` 는 season.ts:1390·1659 둘뿐 [확인]. 그러나 **tests 10파일 약 100줄 + tools 2파일**이 직접 부른다(tests/duel.test.ts:115, tests/realm/tactics.test.ts:45, tools/realm-tactics.ts:59 …) | **절반 맞음** — 시그니처를 못 바꾸는 이유가 하나 더 |
| 2 | 미니맵 없음(01) | `git grep -i "minimap\|미니맵" HEAD -- src` 0건 | 맞음 |
| 3 | 열전에 편 필드 없음(02) | haebi.ts 에 `team`·`owner` 0건. 적은 `(s.x-e.x)` 직선 추격(haebi.ts:1946), 피해는 `hurt`(:888)가 장수만 | 맞음 |
| 4 | 열전 sim 의 `Math.sin/cos/atan2` 79곳(02) | 79번 나옴(**45줄**에) [확인] | 맞음(단위가 번이다) |
| 5 | 열전 적 상한 230(02) | params.ts:265 `maxEnemies: 230`(02 가 단 :233 은 블록 시작) | 맞음 |
| 6 | `BASIC`·`BEATS`·`COUNTER` 쓰는 곳 0(01) | tactics.ts:206-210 정의뿐. battlefield.ts:202 `FRONT_COUNTER` 는 따로(방진>돌격>길 트기) | 맞음 |
| 7 | `fightRounds` 한 판 0.45ms · 평균 4.19합(01) | 이번에 AI 끼리 한 판 10,000번: **0.60ms · 3.88합**(다른 일꾼이 같은 PC 에서 돌던 때) | **대체로 맞음**(약 30% 느림 · 같은 자릿수) |
| 8 | `advance(` 를 부르는 시험 약 80개(01) | `grep -rl "advance(" tests/realm` = **76/160 파일**. tools 는 `fightRounds`·`advance(` 합쳐 **29**(01 은 28) | **조금 틀림**(과대 5%) |
| 9 | 시험 돌림은 `advance` 를 통째로 다시 돈다(01) | warroom.ts:36 `tactics[ANY_BATTLE]={cmds:[],open:true}` → :39 `advance(prev, orders, {}, tactics)` → `report.lines` 에서 우리 싸움 고름 | 맞음 |
| 10 | 입력 줄은 `Order{kind:'command'}`(01) | types.ts:1074 · season.ts:2033 에서 `Tactic` 으로 모음 · app.ts:8895-8897 `finish` 가 만듦 | 맞음 |
| 11 | BATTLE-LIVE #3 「`Tactic` 에 `live?` 한 칸만 더하면 옛 기록·AI 끼리는 손대지 않는다」 | **한 칸이 아니다**: §4 의 열두 줄. 단 「옛 기록·AI 끼리 안 바뀐다」는 설계로 지킬 수 있다(§6) | **틀림(칸 수)** |
추가로 본 것 [확인]: `npm test` 는 `tests/*.test.ts tests/realm/*.test.ts tests/net/*.test.ts` 만 돈다(package.json:12) — `tests/field/` 를 새로 만들면 **글자 그대로 안 돈다.** vite 입력 목록은 vite.config.ts:53 (field.html 한 줄 더). `Side` 에는 `player: boolean` 이 있어(tactics.ts `pick` 안 `me.player`) 「사람이 낀 쪽」이 이미 표시된다. 패드 코드는 `src` 에 0건.

## 1. 한 줄 정의와 한 판의 흐름
**한 줄 [의견]**: 「깃발 넷(앞줄·활·기병·장수)을 한 맵 위에서 끌어 놓는 90초. 자세와 판단은 지금 전투 수학이 세고, 손은 한도 있는 덧셈이다.」
**한 판 (초 단위 · 실시간 90초 = 해시계 4때 × 22.5초)**
| 초 | 일 | 코드 쪽 |
|---|---|---|
| −5 ~ 0 | 전투 앞 화면: 「맡기면 이만큼 · 직접 하면 이만큼 더」(예상 폭), 「맡긴다 / 직접」 | `rehearse` 첫 줄의 `open` 값(`Pending.look`) · 새 `setup` |
| 0 ~ 5 | 맵이 열리고 양 진영·깃발 넷이 뜬다. 손가락 힌트 한 번 | sim tick 0 · 화면이 입력 안 줌 |
| 5 ~ 22.5 | 때 1(아침): 장수 깃발은 「가장 센 한 곳」에 놓는 것이 전부 | 입력 `{tick,g,op,u,v}` |
| 22.5 ~ 67.5 | 때 2~3: 만남·부딪힘. 손가락을 대는 동안 시간 0.3배 | 화면이 틱 수를 줄여 부를 뿐(§3) |
| 67.5 ~ 90 | 때 4(해질녘): 지금의 「마지막 때」 고름(진 / 한 합 더 / 물러남)을 그대로 큰 판으로 | `Dusk` 그대로 `Tactic.dusk` |
| 90 ~ 100 | 결산: 화면의 점들이 **적용된 숫자**에 맞춰 쓰러지고 일어난다(정산 연출) | `FightResult` 한 개 |
**처음 하는 사람의 첫 60초 [의견]**: 깃발은 **기병 하나만** 켜 둔다(나머지는 자동 깃발). 0~5초 힌트 「기병을 끌어 적 옆으로」 → 끌면 큰 깃발이 뜨고 무리가 움찔(10-28 b0 의 반응을 그대로 옮김, battlefield.ts:3716) → 45초에 활 깃발이 열린다. 시험은 문턱 ①(시키지 않아도 끌어 보나).

## 2. 맵 문법
**자료 꼴 [의견 · 초안]** — 그리기는 세로 띠(폰) · 가로 띠(PC) 어느 쪽이든 **sim 은 (u,v) 한 축 고정**, 회전은 렌더만 한다(render 는 읽기만):
```ts
// src/field/types.ts  (정수만 · 1칸 = 1 보 · 1/256칸 고정소수)
export type Ground = 0 | 1 | 2 | 3 | 4  // 평지 | 얕은 물(느림) | 깊은 물(못 걸음) | 막힘 | 숲(활 못 · 은폐)
export interface FieldMap {
  readonly v: 1; readonly u: number; readonly w: number     // 길이(우리~적) × 폭, 기본 160 × 40
  readonly cells: Uint8Array                                  // u*w 지형
  readonly camps: readonly [Camp, Camp]                       // 0 = 우리 편 · 1 = 적 편(보는 쪽이 늘 아래)
  readonly pieces: readonly Piece[]                           // 목책·성벽·성문·해자·다리·배 (≤ 12)
  readonly spots: readonly Spot[]                             // 거점 ≤ 3 (이번 단계는 비움)
  readonly rule: 'meet' | 'ambush' | 'siege' | 'cross' | 'naval'   // 규칙 하나
}
export interface Camp { u: number; v: number; face: 1 | -1; spread: number; asleep?: number }   // asleep = 잠든 틱
export interface Piece { id: number; kind: 'stake' | 'wall' | 'gate' | 'moat' | 'bridge' | 'ship'; u0: number; v0: number; u1: number; v1: number; hp: number; owner: 0 | 1 }
export interface LiveSetup { v: 1; key: string; seed: number; map: FieldMap; sides: readonly [LiveSide, LiveSide]; relief?: readonly LiveRelief[]; night: boolean }
export interface LiveSide { men: Readonly<Record<'front' | 'bows' | 'horse', number>>; F: number; morale: number; hero: { id: string; mu: number } | null; player: boolean; seen: boolean }
```
`LiveSetup` 는 `Side` 에서 **한 곳**(`src/field/setup.ts` 의 순수 함수 `liveSetupOf(sa, sd, meta)`)이 짓는다. `meta` = `{edgeKind, nodeKind, tags(palisade·moat·earthwall·highland), approach, ambush, water, field:boolean}` — 지금 `fight()` 가 이미 가진 값(season.ts:1534-1659)이라 **새 정보를 지도에서 끌어오지 않는다**. 기습 굴림은 지금대로 season 에서 정하고(먹힘/들킴), 맵은 그 결과를 **받아 그릴 뿐**이다(굴림을 sim 으로 옮기지 않는다).
**형의 낱말 여덟 [확인=지금 / 의견=받는 꼴]**
| 낱말 | 지금 | 조각 + 시작 자리 + 규칙 (첫 단계) | 새 규칙? |
|---|---|---|---|
| 기습 | 굴림·밤 4때·첫 칼(season.ts:1534-1584) | `ambush`: 치는 쪽이 적 옆구리(v 가장자리, 시야 밖) · 먹혔으면 지키는 쪽 `asleep` 40틱 · 들켰으면 0 | 없음(굴림은 그대로) |
| 대로에서 만남 | `fieldBattles` season.ts:1349 | `meet`: 평지 · 두 진영이 양 끝 · 한가운데서 부딪힘 | 없음 |
| 공성 | 성 배수·성문 깨기 깃발·배경(01 §6) | `siege`: 지키는 쪽 앞에 `wall`+`gate` 마디 · 마디 hp = `fortMul`(season.ts:227)에서 유도 · 성문 깃발이 `gate` hp 를 깎음 | 마디 hp(자료) |
| 수성 | 지키는 쪽 `terrain`·원군 | 같은 맵. **편만 바꿔** 보는 쪽이 지키는 쪽(화면은 늘 내가 아래) | 없음 |
| 개울 | 길 `ford`/`reeds` 태그 | `cross`: 폭 전체에 `얕은 물` 띠 + 여울 칸 3~5 · 물 칸은 걸음 ½ · `Terrain.ford`(여울 막기)는 그 칸 막음 | 느린 땅 한 줄 |
| 수상전 | `water`·`boat`·배 들이받기(바다 이름표) | **첫 단계: 지금 그대로**(이름표·바다 배경 · `boat` 는 앞줄 무리). 배 sim·배 그림 8~12장은 **출시 뒤** | 미룸 |
| 목책 | 고을 태그 ×1.2 · 말뚝 그림(battlefield.ts:476) | `stake` 마디 줄(`palisade.ts` 의 마디·문 틀을 **복사**) | 마디 hp |
| 목책 해자 | ×1.15 · 겨울 ×1(season.ts:231) · `moatSvg` | `moat` 띠(얕은 물과 같은 칸) + 문 앞 `bridge` · 겨울이면 평지 | 없음(개울과 같은 땅) |
**열전에서 복사할 것 / 새로 지을 것의 경계 [확인 · 02 의 표를 코드로 다시 맞춤]**: 복사 = `camera.ts`(`clampCenter`·`followCam`·`toField` 82줄 · 판 상태를 모름) · `props.ts`의 고체 캡슐 · `palisade.ts` 마디(복사해 sim 쪽 타입으로 · 열전 것은 **건드리지 않음** → 옛 기록 불변) · `wide.ts` 는 3×3 정사각 `WORLD` 가 박혀 있어(wide.ts:15-24) **안 씀** · 그림: `wide-view.ts`의 `inView`·`tintStrip`(haebi-view.ts:100 · 편 색) . 새로 = sim 전부 · `LiveSetup` · 입력 · 군기·미니맵.

## 3. 조작
| 조작 | 폰 | 키보드 · 마우스 | 패드 |
|---|---|---|---|
| 고르기 | 아래 띠 아이콘 4개(앞줄·활·기병·장수) 중 하나 누름 | 1 2 3 4 | 십자 |
| 끌기 | 맵의 한 점을 누르거나 끌어 놓음 = 그 무리의 **목적지** | 마우스 클릭 | 스틱으로 커서(후순위) |
| 자세 | 같은 아이콘을 다시 누르면 돌격 → 방진 → 길 트기 순환(길게 누르면 방진) | Q · E | 면단추 |
| 장수 | 4번 + 맵 점 = 이동 · 적장 곁이면 「겨루기」「사로잡기」 단추가 켜짐 | 4 + 클릭 · Space = 비기 | |
| 시간 | 손가락이 닿은 동안 0.3배 · 떼면 1배 | Shift 누르는 동안 0.3배 · P 멈춤 | |
**한 번에 고를 것 넷 이하**: 입력은 `{tick,g,op,u,v}` — `g` 0 앞줄 · 1 활 · 2 기병 · 3 장수. sim 은 **한 때(22.5초)에 무리당 입력을 3개까지만** 받는다(넘으면 그 입력은 무시하고 화면이 회색으로). 병종이 7이어도 무리가 셋이라는 구조를 지킨다(tactics.ts:204 `GRPS`).
**입력 기록 꼴 [의견]**: 열전 `runlog.ts` 의 「바뀔 때만 적고 b36 으로 줄이기」(runlog.ts:25-53)를 본받는다. 한 줄 = `b36(tick),g,op,b36(u),b36(v)` · `;` 로 이음 · 한 판 평균 20~60줄(0.3~0.9KB, 재는 법 `tools/realm-savesize.ts`). 화면은 **틱 번호만** 적어 sim 에 넘긴다 — 열전의 `viewBounds`·`barrageSource` 같은 「화면 → sim 샘」(haebi.ts:277)은 **만들지 않는다**(헤드리스 AI 가 못 도는 의존).
**미니맵**: 맵 전체를 가는 띠로 그리고(몸 점 ≤ 26개 + 마디) 누르면 `followCam` 이동 [의견 · 작음~중간]. 열전 `edgeArrows`(wide-view.ts:107)가 씨앗. **정찰이 보이는 것**(거짓 금지): 적 대마다 **지금 목표 id**(sim 이 이미 들고 있음)를 화살표로. `Side.seen`(tactics.ts `seen`)이 거짓이면 점만, 참이면 화살표 최대 3개 — 보인 수는 **그대로 일어난다**(12 의 신뢰 조건). 「다음 수」는 지금 낌새(앞줄 하나, 75%)와 **같은 값**을 쓴다.
**패드**: `src` 에 Gamepad 코드 0건 [확인]. 스팀 얼굴이라 필요하나 문턱 뒤 카드로(작음~중간).

## 4. 심판과 이음
**고른 것 = 나′ (차분)**. 방식 가·나·다 가운데 [바꿈] 「나」를 이렇게 좁혔다: 새 sim 이 결과를 **대신**하지 않고, **같은 씨앗·같은 맵에서 sim 이 스스로 돈 기준 판(passive)과 사람 판의 차**를 낸다. 결과 = 지금 엔진이 낸 결과 + 한도 안의 차. 이유 다섯:
1. **같은 수학** [원칙]: 맡기기 = 지금 `fightRounds` 그대로. 사람 판에서 손을 하나도 안 쓰면 차 = 0 이라 **정확히** 같다(±3%p 가 아니라 0). 새 sim 을 지금 공식에 ±3%p 로 맞추는 일(BATTLE-LIVE 문턱)이 **필요 없다** — 기준 판을 같은 sim 에서 재서 상쇄한다.
2. **시험·도구 무변경**: `FightResult`·`RoundLog` 필드는 하나도 안 바뀌고, 쓰는 곳(prose.ts:1228 · memory.ts:140 · battlecard.ts:54 · battlefield.ts 약 30곳)은 그대로 산다.
3. **속도 걱정이 안 새 나간다** [확인 02·01]: 새 sim 은 **사람 싸움에서 한 번(전 5초) + 사람 판**만 돈다. AI 끼리·맡기기는 지금 0.5~0.6ms 엔진. `advance` 턴당 약 50ms 는 안 바뀐다. 열전 sim 의 2.6ms/걸음 문제(02 §7)를 안 만난다.
4. **기기 간 결정론 불필요**: 결과가 `Order` 안의 **숫자**라 재생은 sim 을 안 돌린다. 입력 줄은 「다시 보기」와 같은 기기 검증용이다. `Math.sin/cos` 를 안 쓰면 CI 에서도 같다.
5. **물러서기 쉬움**: 차의 한도를 0 으로 두면 곧 가(연출만). 문턱 ②(이긴 까닭을 말로 하나)가 안 되면 값만 0.
**치르는 값 [의견]**: 보이는 판(sim)과 적용되는 숫자가 어긋난다 → 결산 때 점들을 숫자에 맞추는 「정산 연출」이 필요하고, 「눈에 보이는 판이 곧 결과」라는 맛은 직접 방식(다)보다 약하다. 위험으로 §10 에 적었다.

**필드 단위로 어떻게 지키나**
| 대상 | 지키는 법 |
|---|---|
| `FightResult.rounds` · `pending` · `led` · `dusk` · `clock` | **그대로**: 자세·장수 명령은 `cmds` 로 흘러 지금 엔진이 돈다. 시험 돌림도 그대로(`open`). |
| `outcome` | 덧셈 뒤 **같은 분류식**으로 다시 정함: tactics.ts:1013-1021 (`s = shareOf` → `tacWinShare`·`tacRoutShare`·`broke`·`captured`·`retreat`) 을 `classifyEnd(...)` 함수로 **빼서** 양쪽이 쓴다 |
| `na` `nd` `ga` `gd` `dma` `dmd` | 지금 값 + 차(무리별로 나눠: 기병이 줄었으면 `ga.horse` 가 준다) · 0~1 로 자름 |
| `captured` `broke` `duel` `taken` `fell` `chief*` `fed*` `press*` `woke*` `true*` `unarrived*` | **건드리지 않음**(장수 일은 지금 엔진 · 겨루기는 `src/duel`이 `RoundOrder.duel` 로 씀 · 우리 장수는 싸움으로 안 죽는 규칙도 그대로) |
| 마지막 `RoundLog` 의 `na nd ma md ga gd` | 덧셈을 **같이 얹은 사본**으로 바꿈(어긋나면 battlecard 의 합 그래프 끝이 `res` 와 다르다 — §10-1) |
| `Tactic` (types.ts:614) | `live?: LiveRec` + `ask?: true` 두 칸. `cmds`·`open`·`dusk` 불변 |
| 명령 줄 `Order command` (types.ts:1074) | `live?: LiveRec` 한 칸. 옛 기록엔 없다 |
| 재생 · `rehearse` | 아래 §4-2 |
`LiveRec = { v: 1; seed: number; d: { n: number; m: number; g: [number, number, number] }; log: string; tag: string }` — `d` 는 **차(권위 있는 값)**, `log` 는 입력 줄, `tag` 는 sim 규칙 버전. 모르는 `v` 나 `tag` 면 `d` 를 **무시**하고 맡긴 것으로 센다(옛 판·미래 판이 안 터진다).

**§4-2 시험 돌림(rehearse)과 이음** [확인 + 의견]
- 지금: `rehearse` 가 고를 때마다 `advance` 를 처음부터(warroom.ts:36-39). 사람이 낀 싸움은 `ANY_BATTLE` 이 첫 합에서 멈춘다.
- 바꿈: `tactics[ANY_BATTLE] = { cmds: [], open: true, ask: true }` → `fightRounds` 는 **평소처럼 맡긴 결과를 내고** 거기에 `setup`(= `LiveSetup`)을 달아 돌려준다(season.ts 가 `lines.push({kind:'battle',…, setup})` 에 싣는다). 화면은 그 줄의 `setup` 으로 sim 을 띄운다. 끝나면 `done[key] = { cmds, dusk, live }`. 이 뒤 `rehearse` 는 **그 싸움을 끝난 것**으로 보고 다음 우리 싸움의 새 `setup` 을 받는다(앞 싸움의 덧셈이 `advance` 안에서 이미 반영돼 있으므로 둘째 싸움의 병력·원군이 맞다).
- `ask` 를 안 쓰는 옛 호출(`open` 만)은 `setup` 을 안 받는다 → 지금 시험 약 12개(tactics·guess·look·wake·relief)는 그대로.
- 맡기기 단추(`data-war="auto"`, battlefield.ts:2092)는 `live` 를 안 넣은 `Tactic` 을 낸다 = 지금과 같다.

**§4-3 sim 설계 초안 (`src/field/sim.ts`)** [의견]
| 항목 | 값 | 근거 |
|---|---|---|
| 격자 | 정수 · 160×40칸 · 1칸 = 256 단위(고정소수). 방향은 정수 벡터 + 정수 제곱근(`isqrt`), **삼각함수 0** | A1 · 열전 `Math.sin/cos` 79번이 못 옮기는 것(§0-4) |
| 걸음 | **10Hz**(틱 100ms) · 판 900틱(90초) · 그리기는 **보간**(render 만) | 헤드리스 예산(아래). BATTLE-LIVE 의 20~30Hz 는 입력 지연이 읽히면 20Hz 로 올릴 수 있게 `P.field.hz` 하나 |
| 개체 | **덩어리(대)**: 한 무리 = 병종마다 ≤ 40명씩 대로 쪼갬 · 한 편 ≤ 12대 · 장수 1 · 마디 ≤ 12 → 합 **≤ 38 몸** | 열전 230몸 O(N²) 의 값(02 §7)을 안 만나게 |
| 낱낱 | **그리기에서만**: 대마다 `min(12, men/8)` 개 점 · 자리 = `hash(id, k)` 로 정한 대 둘레 오프셋(sim 상태에 안 넣음) | 그림 부담·폰 한도(§7) |
| 편 | `side: 0 \| 1` 이 모든 몸·탄·마디에 박힌다. 피해 함수 `damage(src, dst)` 하나(열전 `hurt` 처럼 장수 전용 아님) | 02 §3 의 열한 곳을 **처음부터** 안 만든다 |
| 목표 고르기 | 4틱마다 대 → 사거리 안 가장 가까운 상대 몸(정수 거리², 동점은 id 작은 쪽). 사람 목적지가 있으면 거기로 걷다 사거리에 들면 멈춰 침. 기준 판의 AI 는 「적 장수 쪽 가까운 대 → 중앙」 | 결정론 · 목표 id 를 정찰 화살표가 그대로 씀 |
| 피해 | 틱마다 `dmg = (strength[kind] × matchup[kind][kind'] × groundMul) >> shift`(정수). 상성은 지금 battle.ts BEATS 표를 **읽어** 쓴다 · 사기는 ‰ 정수 · 임계는 `tacBreakMen`·`tacBreakMorale`·`tacWinShare` **같은 params 값** | 단일 출처(규칙 3) |
| 사기 | 편마다 0~1000. 줄어듦·옆구리·장수 쓰러짐(5초 못 움직임 · 죽지 않음)에 따라 변함. 한 쪽이 임계 아래면 sim 끝 | 우리 장수는 안 죽는다 |
| 공간 분할 | **안 쓴다**: 쌍 검사 ≤ 38×19 = 약 700/재목표 틱. 땅은 `cells` 직접 조회(O(1)) | 몸이 적어서(열전은 격자·교대가 없어 느렸다) |
| 난수 | `src/core/rng.ts` 의 `roll(seed, tick, "key")` 이름 붙은 굴림만(드물게: 동점·빗나감) | 규칙 1 |
| **헤드리스 한 판 목표** | **중앙값 ≤ 10ms · p95 ≤ 25ms**(900틱) | 셈: 모든 몸이 모든 상대를 매 틱 훑으면 38×19 쌍 × 0.2µs ≈ 140µs/틱 × 900 = 약 130ms 로 모자란다. 그래서 **재목표는 4틱마다 전체 · 그 사이엔 「가까운 6개」 목록만** 보면 틱당 약 3µs(쌍) + 38몸 이동·피해 × 약 0.15µs = 약 9µs × 900 ≈ **8~9ms**. **재지 않은 숫자**: 재는 법 = `tools/field-bench.ts` 가 1,000씨앗의 중앙값·p95 를 냄(이번 `fightRounds` 재기와 같은 꼴 · 0.60ms 가 눈금) |
이 숫자가 안 나오면(p95 > 25ms) 재목표를 8틱으로 늘리거나 대 상한을 10으로 줄인다. **속도가 `advance` 를 지배하지 않는 것**이 나′ 의 이점이라 이 문턱은 「사람이 5초 안에 기준 판을 기다리나」일 뿐이다.

**§4-4 맡기기 · AI 끼리** [확인]: 둘 다 `settle`(tactics.ts:663)과 `aiOrder`(:550)로 **지금 엔진**(0.5~0.6ms). 새 코드 0줄. 「맡기면 이만큼」 폭은 `ask` 로 얻은 첫 `pending.look`(48표본, 1.5ms)에서 나오고, 직접의 덧은 **한도 숫자**(+10%p/−4%p)를 그대로 보인다(예상 오차 없음 · 13 안 1 의 「헤드리스로 N번 돌려 분포」는 **안 한다** — 새 sim 이 느려서가 아니라 필요 없어서).

**§4-5 고칠 함수 목록 (`파일:줄` = HEAD)**
| # | 곳 | 일 | 규모 |
|---|---|---|---|
| 1 | src/realm/types.ts:614 `Tactic` | `live?`·`ask?` 두 칸 | 작음 |
| 2 | src/realm/types.ts:1074 `Order command` | `live?` 한 칸 | 작음 |
| 3 | src/realm/types.ts:1232 `ReportLine battle`(:1258 `rounds` 곁) | `setup?`·`live?` 두 칸(저장 크기 ↑ → `setup` 은 **보고에만 두고 저장 때 지움**: `realm-savesize` 로 확인) | 작음 |
| 4 | src/realm/tactics.ts:147 `FightResult` | `setup?: LiveSetup` · `live?: {d, clamped}` | 작음 |
| 5 | src/realm/tactics.ts:1013-1021 | 분류식을 `classifyEnd()` 로 **추출**(동작 불변 · 골든으로 확인) | **중간 · 가장 위험** |
| 6 | src/realm/tactics.ts:1022 부근(`return {` 앞) | `tactic.live` 가 있으면 `applyLive()`: 덧셈·자르기·`classifyEnd`·마지막 `RoundLog` 사본 | 중간 |
| 7 | src/realm/season.ts:1390 · :1659 두 호출 | `ask` 이면 `liveSetupOf(sa,sd,meta)` 를 결과에 달기 | 작음 |
| 8 | src/realm/season.ts:1430 · :1743 `lines.push({kind:'battle'})` | `setup` 싣기 | 작음 |
| 9 | src/realm/season.ts:2033 | `led[o.key] = {cmds, dusk, live}` | 작음 |
| 10 | src/realm/warroom.ts:36 | `{ cmds: [], open: true, ask: true }` | 작음 |
| 11 | src/ui/realm/app.ts:8895-8897 `finish` · src/ui/realm/battlefield.ts:3659 `openWar` | `live` 직렬화 · 「직접」을 고르면 field 화면을 겹쳐 띄움 | 중간 |
| 12 | src/tune/params.ts (`tac*` :3735~ 옆) · package.json:12 · vite.config.ts:53 | `P.realm.live*`(한도·켜짐) · `P.field`(격자·Hz·대 상한) · 시험 glob · 입력 목록 | 작음 |
죽은 코드 정리(별도 작음): battlefield.ts:522-525 `B0_KEY`·`b0On`, app.ts:8790 `b0-toggle`, wipe.ts:16, tactics.ts:206-210 — 이 일 **앞에** 해 두면 줄 번호 혼선이 준다.

## 5. 손과 수 (한도와 재는 도구)
| 장치 | 한도 (처음값 [의견]) | 지키는 곳 | 재는 도구 |
|---|---|---|---|
| 차(덧셈) 한도 | 내 남은 몫에 **+0.10 / −0.04**(처음 사람 대비) · 사기 ±0.05 | `applyLive` · `P.realm.liveGain/liveLoss` | `tools/realm-field.ts` |
| 판단은 지금 수학 | 자세 → `cmds` 로 흘러 낌새·상성이 그대로 갈린다(지금 「잘 읽음 84% · 못 읽음 23%」 폭, 01 §4) | 설계 | 위 표를 같은 도구로 다시 |
| 빈손 = 0 | 입력이 없으면 `d` = 0 **정확히** | 기준 판 = 사람 판(같은 씨앗) | `deepEqual(FightResult)` 시험 |
| 입력 예산 | 무리당 한 때에 3개 · 한 번에 넷 | sim | 단위 시험 |
| 열세 보호 | 비 0.7 에서 가장 잘 두는 봇이 **승률 50% 미만** (손이 수를 못 덮음) | 한도 | `realm-field` 봇 표 |
| 우리 장수 | 쓰러져도 5초 못 움직일 뿐, `fell`/`taken` 을 sim 이 **쓰지 않는다** | sim → `d` 에는 장수 칸 없음 | 시험 |
| 봇 셋 | 빈손(idle) · 마구잡이(random) · 전문가(스크립트: 기병 옆치기 + 활 방진 뒤) | 도구 | 판 수 N = 300 × 6 비 × 3 봇 |
합격선 하나(문턱 기술): **빈손 d=0 · 마구잡이 ≥ −3%p · 전문가 ≤ +12%p(비 1.0), 비 0.7 전문가 < 50%**. 한도가 이 선 안이면 「맡기면 같은 수학」·「운보다 통제」를 어기지 않는다. 어기는 제안: 없음(손재주가 수를 덮는 제안은 이 안에 **없고**, 만들면 반려).

## 6. 모드별 표
| 모드 | 지금 | 실시간(첫 단계) | 위험 · 확인 |
|---|---|---|---|
| 들판(대로에서 만남) | `fieldBattles` :1349 · 성·장정·기습 없음 | `meet` 맵 · 가장 먼저 짓는 조각 | 가장 단순 |
| 고을(목책·해자·산성) | `fortMul` 배수 + `성문 깨기` | `siege` 맵 · 마디 hp 는 배수에서 유도 | 배수와 마디 hp 가 **이중으로 세지 않게**: 마디는 sim 의 보이는 값, 결과는 지금 배수(차분이라 자연히 안 겹침) |
| 기습·밤 | 굴림 + 밤 4때 | `ambush` 맵 · `asleep` | 굴림은 season 에 남음 |
| 원군 | `Side.relief{at}` | 맵 가장자리에서 `at` 합에 해당하는 틱에 들어옴 | `unarrived*` 는 지금 엔진 값 |
| 수상 | `water`·`boat`·이름표 | **첫 단계 없음**(지금처럼) | 배 그림·sim 은 출시 뒤 |
| 배우는 판 | `lesson` · 둘째 합까지 아무도 안 무너짐(tactics.ts:~992) · 겨루기→사로잡기를 꼭 보임 | **실시간에서 뺌**(`live` 안 줌) | 대본이라 지금 DOM 그대로 · §9 |
| 체험판 | 배우는 판 + 마한 + 열전 숲 | 마한 첫 패배(8분째 29/30판 같은 패배 · 03)는 **그대로 카드**. 나머지는 **형 결정**(§9) | 02-22 에 새 시스템이 나가면 `P.realm.liveBattle=0` 이 기본이어야 |
| 맡기기 | `settle` · 「맡긴다」 | 같다 | 0줄 |
| AI 끼리 | 같은 `resolveRound` | 같다 | 0줄 |
| 옛 저장 | `Order command` 에 `live` 없음 | 칸 없음 = 같은 길. `realm-oldclock-hash` 21줄 **불변** | 골든 (§8 L1) |
| 옛 기록·재생 | `tools/realm-replay.ts` | `live.d` 가 있으면 읽음(sim 안 돎) · `v`/`tag` 모르면 무시 | 재생 시험 |
| 저장 크기 | 보고 줄 `rounds` | 명령 줄에 `live` ≤ 1KB/싸움, `setup` 은 저장 때 뺌 | `tools/realm-savesize.ts`·`realm-memsize.ts` |

## 7. 그림 · 소리
**있는 것으로 되는 것 [확인 03 B]**: 병사 14종 20칸 띠(`anim2`·`anim-px`) · 장수 258 · 목책/성벽/성문/말뚝/화살(`fx/field` 28) · 배경 10(들판·나루·숲·성문·밤 …) · 열전 바닥 타일 5 · 북·함성·화살비·말 소리. 편 색은 `tintStrip`(haebi-view.ts:100)으로 입힌다.
**새로 필요 [의견 · 장 수]**: 첫 단계(들판 + 목책 + 개울) **군기 2장**(우·적 펄럭 4칸 띠) · 개울·해자 이어 깔기 타일 **2~3장** · 미니맵 아이콘은 코드로 그림 → **약 5장**. 수상(배 8~12장)·공성 무기(4~6장)·막사(3~4장)는 **출시 뒤**. 소리: 뿔피리 2~3개(형이 고름 · 첫 단계엔 북으로 때움) → 0~3개.
**폰 그리기 [확인 02 §6 + 의견]**: 열전 `drawField` 의 y 정렬 한 배열 · 그림자 한 번에 · 안 바뀌면 안 그리기를 본받고, 한 장 점 ≤ 26대 × 12 = **약 310 몸 + 마디** 로 열전 상한(230+탄 240)과 같은 자릿수. `fieldLowGraphics` 단계에서 점 수 절반. 재는 법 `tools/field-perf.ts`(`war-perf.ts`·`raid-fps-probe.ts` 꼴) — 합격선 §8 F2.

## 8. 단계와 카드
눈금: 작음 ≤1일 · 중간 1.5~2일 · 큼 3~5일 · 아주 큼 6일+. 규모는 **[의견 · 못 잼]**. 새 규칙 태그 = `P.realm.liveBattle`(0 = 지금 길) + 입력 줄 `live.tag`.
**단계 0 · 값이 먼저 나가는 것 (동결 예외 아님)**
| 카드 | 규모 | 건드릴 파일 | 합격선 | 재는 법 |
|---|---|---|---|---|
| P0 예상 미리 보기 | 작음 | warroom.ts 호출·battlefield.ts `wnext` | 「맡기면 이만큼」이 실제 맡긴 결과 폭에 **들어간다**(48표본 중 95% 이상) | `tests/realm/look.test.ts` 확장 |
| P1 죽은 코드 정리 | 작음 | battlefield.ts:522 · app.ts:8790 · wipe.ts:16 · tactics.ts:206 | `npm test`·typecheck 불변 | `npm test` |
**단계 1 · 시험장 (10일 상자 · 본편 안 건드림 · `field.html`)**
| 카드 | 규모 | 건드릴 파일 | 합격선(하나) | 재는 법 |
|---|---|---|---|---|
| F1 sim | 큼 | `src/field/{types,map,sim,ai}.ts`(신규) · params `P.field` | 헤드리스 중앙값 ≤ 10ms · 같은 입력 열 = 같은 해시 1,000판 | `tools/field-bench.ts` · `tests/field/*.test.ts`(**package.json:12 glob 에 추가**) |
| F2 화면 | 큼 | `field.html` · `src/field-main.ts` · `src/field/{view,input,mini}.ts` · vite.config.ts:53 | 4× CPU 느리게 한 헤드리스 크롬에서 프레임 p95 ≤ 20ms(점 310) | `tools/field-perf.ts`(신규 · `war-perf.ts` 꼴) |
| F3 봇 표 | 중간 | `tools/realm-field.ts`(신규 · `realm-tactics.ts` 꼴) | §5 합격선 한 줄(빈손 0 · 마구잡이 ≥ −3 · 전문가 ≤ +12) | 같은 도구 |
| F4 손맛·사람 시험 | 중간 | view.ts(히트스톱·넉백·숫자 · 낱낱 점이 날아감) | 문턱 ①~④ 중 **셋**(BATTLE-LIVE) | 형 + 지인 3명 · 3초 이탈러 포함 |
**단계 2 · 문턱** — 위 F1~F4 가 다 선 뒤 한 번. 아니면 **차 한도 0 으로 가(연출만) 또는 A(비기 한 컷)로 물러남**. 판정은 형.
**단계 3 · 연결 (문턱 통과 때만)**
| 카드 | 규모 | 건드릴 파일 | 합격선(하나) | 재는 법 |
|---|---|---|---|---|
| L1 이음 뼈대 | 중간 | §4-5 의 1~10·12 | `live` 없는 모든 판이 **글자 그대로** 같다 | `tools/realm-oldclock-hash.ts` 21줄 · `tests/realm/live-golden.test.ts`(빈손 d=0 ⇒ `deepEqual(FightResult)` · 한도 자르기 · JSON 왕복 · 모르는 `tag` 무시) |
| L2 화면 이음 | 중간 | app.ts:8895 · battlefield.ts:3659 | 같은 명령으로 `advance` 두 번 = 같은 보고 · 「시험 돌림 = 진짜」 시험(tactics.test.ts:355-404) 확장 통과 | `npm test` |
| L3 기습·밤·원군 맵 | 중간 | `src/field/map.ts` · season.ts `meta` | 낱말 표(§2)의 `ambush`·원군이 **그림과 숫자가 같다**(보인 `asleep` = 굴림 결과) | 시험 + 눈 |
| L4 켜기·끄기 | 작음 | params · 설정 화면 | 끄면 지금 길(`P.realm.liveBattle=0`) · 체험판 기본 끔 | 시험 |
| L5 패드·키보드 | 작음~중간 | input.ts | 패드로 첫 판 끝까지(문턱 ④ 흉내) | 형 |
**총 [의견 · 못 잼]**: P 1.5 + F 12 + L 7.5 ≈ **21형일**(03 의 15~25 안). 본 공사(연결)만 출시 전에 넣을지는 §9-1. 새 규칙 골든 시험은 **`tests/realm/`** 에 둔다(`tests/field/` 는 sim 만).

## 9. 형께 물을 것 (셋 · 기본값 포함)
1. **출시 전에 어디까지?** 기본값: **P0 + 시험장(F1~F4) + 문턱까지**, 연결(L)은 문턱 통과 때 **2027-01 안**(체험판 02-22 는 `liveBattle=0`). 안 되면 출시 뒤 첫 갱신.
2. **직접이 맡기기보다 얼마나 나아야 하나?** 기본값 **+10%p(낫게) / −4%p(못 해도)**. 「조금 낫게, 크게 낫지는 않게」(13 의 Humankind 뜻)이고 한 손 조작이 판단을 못 덮는다.
3. **첫 싸움(배우는 판 · 마한 첫 패배)은 실시간에서 빼도 되나?** 기본값 **뺀다**(대본이라 · 첫 5분이 심사받는 곳이라). 이미 조사에 있는 「거상·파오캐에서 무엇을 가져오려나」 답이 오면 §1 의 한 줄을 다시 쓴다(기본 가정: 한 맵 + 깃발 + 장수 뛰어듦).

## 10. 스스로 반박 셋 (이대로 지으면 망하는 까닭)
1. **「보여 주기」 병이 가보다 심해질 수 있다.** 점들은 sim 대로 싸우는데 적용 숫자는 덧셈이라, 결산 때 쓰러지는 점이 달라지면 「화면이 거짓말」로 읽힌다. 마지막 `RoundLog` 사본과 `FightResult` 가 어긋나면 싸움 카드·연대기도 다르다. → 막는 법: 정산 연출을 합격선에 넣고(문턱 ② 「이긴 까닭을 말로 하나」), 사본 어긋남은 **시험 한 개**로 못 박는다. 그래도 지인이 「내가 이긴 게 아닌 것 같다」고 하면 이 안은 접고 **연출만(가)**.
2. **시험장이 열흘에 안 끝난다.** 13 의 사례(VIRTUALORD: 「잘 만든 RTS 는 영원히 걸린다」)가 직접 말한다. sim 한 개 + 화면 + 봇 + 손맛 = 큼 둘 + 중간 둘. 영어 21,717조각·15세 판(LAUNCH-PLAN §3)과 같은 달에 겹친다. → 막는 법: **10일 상자**, 11일째 안 서면 P0 만 출시. 그래도 위험 높음 [의견].
3. **`fightRounds` 를 열어 분류식을 빼다가 옛 결과가 한 판이라도 바뀐다.** 1,735줄 · 시험 약 12파일이 부르는 함수다. 값만 `deepEqual` 해선 모자라 **옛 저장의 21줄 해시**와 20,000판 비교가 필요하다. → 막는 법: L1 의 첫 커밋은 **추출만**(동작 불변)으로 따로 하고 해시를 맞춘 뒤에 덧셈을 얹는다. 맞지 않으면 추출을 포기하고 분류식을 복사해 둔다(중복이지만 안전).
4. (덤) **새 시스템 동결**을 어긴다. P0·P1 은 동결 안이고 F·L 은 형의 명시 예외가 있을 때만 지을 수 있다. 어기는 제안이라 §9-1 에 적었다.

## 못 본 것 · 한계
- 전장 화면을 브라우저로 안 봤다(읽기 전용). 점 310개 폰 프레임·입력 지연은 **재지 않았다**(§7·§8 F2).
- `src/field/` 의 sim 은 아직 없다. §4-3 의 ms·몸 수는 **셈**이고 처음 재기 전엔 믿지 말 것.
- 기준 판(passive)이 사람의 「느낌」과 얼마나 다른지, 즉 덧셈이 손에 잡히는 크기인지는 사람 시험(F4) 전엔 모른다.
- `battleFates`·`resolveRound` 활·기병 절의 배수 · `prose.ts` 이야기가 `RoundLog.acts` 를 어떻게 읽는지 줄 단위로는 안 봤다(마지막 `RoundLog` 사본이 이야기를 깨는지는 L1 시험에서 확인).
- 임시 측정 스크립트는 스크래치 폴더에만 두었다(저장소 밖).
