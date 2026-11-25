# 40 · 일감 카드와 일꾼 지침 (battle-study · 2026-11-25 · 카드 일꾼)

기준은 30(통합안). 카드의 파일:줄은 **HEAD c9943767** 에서 직접 `grep`·`sed` 로 연 것 [확인]이고, 장(26·22 등)에서 가져온 것은 [옮김], 내 판단은 [의견]이다. 줄 번호는 P2 가 죽은 코드를 지우면 어긋난다(아래 A-0 · 일꾼은 줄이 아니라 **함수 이름을 grep** 한다).

## 코디네이터가 처음 읽는 열 줄
0. **개정(coordinator 의 30 고침 e317f10b 반영)**: 30 §9 의 새 카드 **F9 뽑고 바로 싸우기 · L4 징병에서 연습 싸움**을 넣었고, 합격선을 카드마다 하나로 바꿨다(F1 결정론 해시 · F2 승률 방향 5%p · F3 그리기 한 장 ≤ 8ms · F4 장수 붙인 무리가 더 버팀 · F6 계획 = 실제 목표 · F7 판단 줄 · F8 패드 입력 줄 · 「함께 잰다」는 보고 숫자일 뿐 카드를 막지 않는다). F1 에는 임시 AI 가 있어 F2·F4 가 그것으로 돈다. 32 의 「카드 차례의 구멍」 대조표는 D-4.
1. 카드는 **P1~P4 · F1~F9 · G1 · L1~L4 · G2**. 큰 카드 다섯(F1·F2·F3·F4·F5)과 F8 은 **a·b 로 쪼갰다** → 일꾼 단위 **P4 + F 14(F9 포함) + L 뼈대**.
2. 맨 먼저 띄울 묶음: **P1 ∥ P3 ∥ F1a**. P2 는 P1 이 끝난 뒤. P4 는 **혼자**(시간을 재는 카드라 다른 무거운 일과 겹치지 않는다).
3. 시험장 일은 두 줄기다. **S 줄(sim)** F1a → F1b → F2a → F2b → F4a → F6 → F7. **V 줄(화면)** F3a → F3b → F5a → F5b → F4b → F8a → F9 → F8b. F1b 가 끝나면 두 줄을 **나란히** 돌릴 수 있다(고치는 파일이 갈린다 · A·B 규칙).
4. **30 과 어긋난 것 중 가장 큰 것**: 30 은 F6 이 「지금 `aiOrder` 의 고름을 읽는다」고 했는데 `aiOrder` 는 비공개(`tactics.ts:550` 에 `export` 없음, 첫 인자가 안쪽 `Ctx`)라 F 에서는 **읽을 수 없다**. 본편 0줄 원칙 때문에 F6 은 틀을 **복제**하고, 본편에 `export` 를 하는 것은 L1a 로 넘겼다(D 의 1번).
5. 둘째: 30 의 문 G1 이 재는 것(직접/맡기기 고름 · 입력 로그 · 손 쓴 판과 빈손 판 섞어 보이기 · 첫 판 이탈 초)을 받치는 장치가 30 의 카드 표에 없다. F8 을 a·b 로 나눠 **F8a 에 넣었다**(규모 중간 → 큼) · 패드는 F8b 로 떼어 버리는 순서 첫째로 둔다(D 의 5번).
6. 일꾼 모델: **기계적 = sonnet**(P1·P2·P3·P4·F2·F3·F5·F8·F9) · **판단이 큰 것 = opus**(F1·F4·F6·F7 · L1~L4). 코디네이터(Fable)는 합격선 판정·형께 보일 것 정리만 한다(B-3).
7. 카드가 끝날 때마다 **독립 검수**(읽기 전용 렌즈)를 B-3 표대로 붙인다. 검수에 「이 카드가 막힘」 발견이 나오면 다음 카드를 띄우지 않는다.
8. 문 G1 은 F9(뽑고 바로 싸우기)까지 끝나야 열린다(30: F9 는 안 버린다). G1 은 사람이 쳐야 열린다. 형 폰 + 지인 넷 · 주소는 배포 뒤 `https://retyper.github.io/hanbal/field.html`(스팀 페이지 전 공개 업로드 없음 → 링크는 형이 직접 건넨다). 1월 중순까지 못 열면 L 은 출시 뒤(30 §12).
9. 밀리면: F8b(패드) → F6b(정찰 단계) → 개울(형의 낱말이라 버리게 되면 형께 먼저 알린다) → L 전체. P·F1·F3·F4·F5·F9 는 안 버린다. 되돌림은 F 폴더 삭제 · L 스위치 끔(B-6).
10. 이 장은 **읽기만 하고 쓴 것**이다. 화면·브라우저는 안 봤다(맨 끝 「못 본 것」).

---

## A. 일꾼 공통 지침 (모든 카드 맨 위에 붙인다 · 한 번만 적는다)

### A-0. 이 지침의 읽는 법
- 카드의 줄 번호는 HEAD c9943767 기준이다. **P2 뒤에는** `tactics.ts` 가 위쪽 약 5줄, `battlefield.ts` 가 약 4줄, `app.ts` 가 약 2줄 당겨진다 [의견 · P2 가 실제 값을 보고한다]. 줄이 안 맞으면 함수 이름·상수 이름으로 `grep -n` 한다.
- 작업 트리에는 다른 일꾼의 미커밋 수정이 있다(예: `src/tune/params.ts` 7줄 · `src/raid/*` · `HANDOFF.md` · `docs/BALANCE.md`) [확인 · `git status`]. **본 것 중 내 카드와 관계없는 변경은 건드리지도 stage 하지도 않는다.** 모를 때는 `git diff HEAD -- <파일>` 로 먼저 본다.
- 먼저 `git status --short` · `git log -3 --oneline` 을 보고 시작한다. 이미 내 카드가 한 일이 들어가 있으면(앞 일꾼이 중간 보고로 멈춘 것) 이어서 한다.

### A-1. 말
- 답과 커밋 메시지는 **한글**, 짧게(무엇을 왜). 화면에 뜨는 글 가운데 안내·알림·튜토리얼·저장창은 **존댓말**(합니다·하세요), 이야기·판정 글은 평서.
- 화면 글에 **긴 줄표(—) 금지**. 바뀌는 낱말(이름·고을·병종)과 숫자 뒤의 조사는 손으로 붙이지 말고 `josa()`(`src/realm/data/prose.ts`) 또는 `t()` 의 `{v|이/가}` 틀. 한자 한 글자·사료 용어 대신 쉬운 말, 시스템 말은 게임 표기(필터·쿨타임). 연출 위에 「기운이 모입니다」 같은 설명 글을 얹지 않는다(규칙에 있는 것만 말한다). 「~이지 ~가 아니다」 식 해명 문구 금지.
- 한국 결: 일본·중국 결(빨간 해 동그라미·햇살·카타나·오비·복면 등) **금지**. 임시 도형으로 군기·깃발을 그릴 때도 **빨간 원이 든 흰 바탕은 절대 안 된다**(가로줄·세모 끝·두 색 줄 같은 것으로). 내 편 색은 본편 지도의 `MY_LAND` 파랑과 같은 결.
- 15세 선: 비침·노출 윤곽 금지(그림을 새로 만들지 않으므로 이 카드들에서는 거의 안 닿는다. 닿으면 멈추고 보고).
- 검사: `node --experimental-strip-types tools/dash-lint.ts` → `0 곳` · `node --experimental-strip-types tools/josa-lint.ts` → `0 곳` (둘 다 지금 HEAD 에서 0 곳 [확인]). 화면 글을 더했으면 커밋 전에 둘 다 돌린다. 화면 글은 `t()` 키로 `src/i18n/ko.ts` 끝에 `field.` 머리말로 넣고 같은 키를 `src/i18n/en.ts` 에 영어로 넣거나 `PENDING_EN` 에 적는다(`tests/i18n.test.ts:21` 이 없으면 실패 [확인]).
- 영어 기준선: `node --experimental-strip-types tools/i18n-lint.ts` 의 「전체 글」 이 지금 21,789 인데 `tools/i18n-baseline.json` 은 20,910 으로 **이미 낡았다** [확인]. 기준선 파일을 갱신하지 말고(`--write` 금지), 내 카드가 더한 글 수만 보고에 적는다.

### A-2. 절대 규칙 (시험장 코드 `src/field/**` 와 새 `src/field-main.ts`)
- 시뮬 코드(`src/field/` 의 sim·combat·ai·map·rec·num·state, 곧 DOM 에 안 닿는 파일 전부)에 `Math.random` · `Date.now` · `performance.now` · DOM(`window`·`document`·`localStorage`)·**삼각함수(`Math.sin/cos/atan2/atan/hypot`)·부동소수 누적**을 쓰지 않는다. 난수는 `src/core/rng.ts` 의 `roll(seed, tick, key)`(:78) 또는 `makeRng`. 길이는 정수 격자(1칸 = `P.field.unit` 단위)와 정수 제곱근. 정수 나눗셈은 `Math.trunc(a / b)` 로 쓰고(음수에서 `|0`·`>>` 와 다르다) 비교 정렬은 id 로 동점을 깬다.
- 이 규칙을 **시험이 지킨다**(F1a 가 `tests/field/purity.test.ts` 를 만든다: `src/field/` 의 sim 쪽 파일 글자를 읽어 위 금지어가 0 인지 센다). 새 sim 파일을 만들면 이 시험의 파일 목록에 넣는다.
- 상수(손맛·밸런스·크기·시간)는 **`src/tune/params.ts` 의 `P.field`**(새 절 · F1a 가 만든다)에만 둔다. 코드 속 매직넘버 금지. 본편의 문턱(`P.realm.tacBreakMen`·`tacBreakMorale`·`tacWinShare`)은 **읽기만** 하고 복사 상수를 만들지 않는다. 분 · 초 · 칸 같은 단위는 이름에 적는다(`Ticks` · `Cells`).
- `src/field/view*.ts`·`src/field-main.ts` 등 그리는 쪽은 sim 상태를 **읽기만** 한다(대입·push 금지 · F3a 가 시험으로 지킨다). 렌더용 난수는 sim 난수와 따로(해시 함수).
- 백그라운드 탭에서는 rAF·타이머를 **예약하지 않는다**(`document.hidden` 이면 멈추고 `visibilitychange` 로 다시). 돌아올 때 밀린 시간을 몰아 돌리지 않는다(틱 누적 상한). 본보기: `src/night-main.ts:488·562-567` [확인].
- **런타임 npm 패키지를 추가하지 않는다**(ARCHITECTURE A6). 타입스크립트는 `node --experimental-strip-types` 로도 돌아야 하니 `enum`·`namespace`·생성자 매개변수 속성을 쓰지 않고, import 는 `.ts` 확장자 그대로(`tsconfig` 가 `allowImportingTsExtensions`) · 타입만 가져올 때는 `import type`.
- 새 CSS 클래스는 접두 `fd-` 로(이름이 흔하면 본편과 겹친다) · 만들기 전에 `grep -rn "fd-이름" src` · 여러 줄 규칙 한가운데에 `sed` 금지. 파일 고치기는 `Edit`/`Write` 도구로 · `node -e` 로 파일을 고치지 않는다 · 줄끝 LF.

### A-3. 건드리면 안 되는 것
- **열전 파일(`src/raid/**` · `src/raid-main.ts` · `raid.html`)은 한 줄도 고치지 않는다.** 필요한 것은 `src/field/` 로 **복사**하고(원본 경로를 파일 머리 주석에 적는다) 복사본에서 상수·타입 의존(`HAEBI_*`·`HaebiRun`·`giant-core`)을 떼어 낸다. 열전 골든(`tests/raid-golden.test.ts`)은 어떤 카드에서도 깨지면 안 된다.
- 본편 전투 파일(`src/realm/tactics.ts` · `season.ts` · `types.ts` · `warroom.ts` · `src/ui/realm/battlefield.ts` · `app.ts` 등)은 **그 카드의 「고칠 파일」 칸이 허락한 줄만**. F 카드는 허락이 거의 없다(F8a 의 입구 한 줄만).
- `fightRounds` 본체(`tactics.ts:728~1052` 약 325줄 · 파일은 1,735줄 [30 §13])는 L1b 의 「맨 앞 한 갈래」 말고는 열지 않는다.
- 형의 `~/Downloads` 는 안 건드린다. `localStorage.clear()` 금지(판을 날린다 · 필요하면 키 하나만 지운다).

### A-4. 커밋·푸시 (공유 파일 규칙)
- `git add -A` · `git add .` 금지. **명시한 경로만** `git add <경로>`. 커밋 전 `git diff --cached --stat` 으로 내 것만 들었는지 본다.
- **남도 고치는 공유 파일** — `src/tune/params.ts` · `package.json` · `docs/BALANCE.md` · `src/i18n/ko.ts` · `src/i18n/en.ts` · `vite.config.ts` · `tools/josa-lint.ts` · `HANDOFF.md` · 인수인계 글 · `src/ui/realm/app.ts` — 는 작업 트리 판을 `git add` 하지 않는다. 커밋 순간에 **HEAD 판**을 뽑아 내 줄만 얹은 새 내용을 만들어 올린다:
  1. `git show HEAD:<경로> > <임시>` 로 HEAD 판을 받는다(임시는 스크래치 폴더).
  2. 임시에 **내가 더한 줄만** 얹는다(`Edit` 도구).
  3. `h=$(git hash-object -w <임시>)` → `git update-index --cacheinfo 100644,$h,<경로>`.
  4. 작업 트리 파일은 그대로 둔다(남의 수정이 거기 있다).
- **`P.field` 값(params)과 그것을 쓰는 코드는 한 커밋**에 넣는다(값만 먼저 들어가면 안 쓰는 상수, 코드만 먼저면 `undefined`).
- 커밋 전 `npm run typecheck` 와 `npm test` 가 **실패 0**. 둘 다 못 돌리면 커밋하지 말고 보고. 커밋 뒤 **바로 `git push`**(형은 GitHub Pages 로만 확인한다). 배포가 걸린 카드(F3a 이후)는 `gh run list --limit 3` 로 배포 성공까지 본다.
- 메시지 끝 두 줄(그대로):
  ```
  Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01TRiuN7s6aDfSnaHxrkctmU
  ```
- **커밋이 권한 검사에 막히면 우회하지 말고 그대로 보고한다**(`--no-verify` 금지 · 훅을 끄지 않는다).

### A-5. 문턱·정직
- **문턱을 낮추거나 시험을 끄지 않는다.** 합격선을 못 맞추면 잰 숫자를 그대로 적고 어떤 손잡이를 어떻게 움직였는지 적고 멈춘다(코디네이터가 판정).
- 재지 않은 숫자는 보고에 「[의견]」 또는 「못 잼」 으로 적는다. 본 것만 「봤다」고 쓴다. **게임 화면을 안 봤으면 「안 봤다」**(카드에 브라우저 확인이 걸려 있는데 못 했으면 그 사실을 맨 앞에).

### A-6. 장소·도구
- 큰 임시 출력(스냅샷·그림·영상·측정 로그)은 **D: `tools/out/<카드>/`**(`.gitignore` 에 `tools/out/` 있음 [확인]) 에. C 드라이브는 좁다. 쓰고 나면 스크래치를 치운다.
- 시험 서버는 **5174 포트**(`npx vite --port 5174`). 5173 은 형이 플레이 중일 수 있다. 서버를 띄우기 전에 `curl localhost:5174` 로 이미 떠 있는지.
- 폰 폭 확인: `node --experimental-strip-types tools/phone-shot.ts <나갈png> - 390 844 http://localhost:5174/field.html` 를 **360·375·390·412** 네 폭으로(출력이 넘친 칸을 알려 준다 [확인 · 파일 머리 주석]).
- 브라우저를 쓰는 카드만 PC 크롬: `list_connected_browsers` → `bcba6fe9` 를 `select_browser` · `switch_browser` 금지 · 5174 로만. **캔버스는 탭이 hidden 이면 새까맣게 나온다**(버그 아님). `document.visibilityState` 를 먼저 보고, 안 보이면 「화면은 못 봤다」고 쓴다.
- 그림은 **Codex 주문**(`D:/에셋창고/CLAUDE-TO-CODEX-NOW.md`)으로만. OpenAI 그림 API 금지. 입력 그림(STD) 이름은 **띠 열쇠**로 짓고 덮어쓰기 전에 같은 이름이 있는지 확인(11-25 에 `beodeul`·`danbi` 가 덮인 사고 [옮김 00 §7-7]). **F 카드는 새 그림을 주문하지 않는다**(임시 도형 · 30 §8).

### A-7. 보고 꼴 (끝에 이 순서로)
1. 바꾼 것: `파일:줄`(만든 파일은 줄 수) 목록.
2. 잰 숫자: **전 → 후**, 시험 개수(전체 통과/실패), 합격선 통과 여부(합격선 문장 그대로 · 통과/미달).
3. 커밋 해시와 푸시 여부(배포 확인한 카드는 `gh run list` 줄).
4. **못 본 것**: 본 것만 「봤다」. 안 열어 본 파일·못 돌린 명령·안 본 화면.
5. 다음 일꾼이 알아야 할 것(남은 함정 · 어긋난 줄 번호).
- **기다림**: 6분 넘는 명령은 `run_in_background` 로 돌리고 붙들지 않는다. 중간 보고(「여기까지 · 이게 남음」)를 한 뒤 끝낸다. 코디네이터가 다시 깨운다.

### A-8. 자주 쓰는 명령 (저장소에서 확인 · 그대로 붙여 넣는다)
```
npm run typecheck                                                      # tsc --noEmit (tsconfig include: src tests tools)
npm test                                                               # node --test --experimental-strip-types tests/*.test.ts tests/realm/*.test.ts tests/net/*.test.ts  (+ F1a 가 tests/field/*.test.ts 를 더한다)
node --test --experimental-strip-types tests/field/determinism.test.ts # 시험 파일 하나만
node --experimental-strip-types tools/<도구>.ts [인자]                 # 도구 (strip-types 로 돈다)
npx vite --port 5174                                                   # 시험 서버
npm run build                                                          # tsc + vite build + budget(번들 예산)  — F3a 이후 한 번씩
```

---

## B. 코디네이터 지침

### B-1. 카드 의존 그림
```
P1 ──► P2
P3 (독립)        P4 (혼자 · 시간 재기)
              F1a ─► F1b ─┬─► F2a ─► F2b ─► F4a ─► F6 ─► F7 ─┐   (S 줄 · sim.ts·combat.ts·map.ts·ai.ts 를 고친다)
                          └─► F3a ─► F3b ─► F5a ─► F5b ─► F4b ─► F8a ─► F9 ─► F8b   (V 줄 · view·input·mini·field-main 을 고친다)
                                                                      │
          S 줄 끝(F7) + V 줄 끝(F9) ───────────────────────────────► G1 (사람) ─► L1a ─► L1b ─► L1c ─► L2 ─► L3 ─► G2
                                                             G1 ─► L4 (연습 싸움 · L1 을 기다리지 않는다 · 아래 L4)
```
- F4b 는 F4a(장수 규칙)와 F5a(깃발 입력)를 둘 다 기다린다(`field-main.ts` 와 입력 모델이 겹친다). F8a 는 F6(적 AI · 맡김 파일럿)과 F5b 를 기다린다. F9 는 F8a(끝 화면)·F3b(금빛 테두리)·F6(맡김 파일럿)을 기다린다. F7 은 F6 뒤.
- F6 이 끝나기 전에는 「맡기기」 고름(F8a)을 못 만든다(우리 편 AI = 같은 AI).

### B-2. 나란히 돌리는 규칙
1. **같은 파일을 고치는 카드는 나란히 띄우지 않는다.** 아래 「파일을 쥐는 카드」 표가 기준.
   | 파일 | 고치는 카드(한 번에 하나) |
   |---|---|
   | `src/field/sim.ts` | F1a → F1b → F2b → F4a → F5b(입력 `special` 한 갈래) → F6 |
   | `src/field/types.ts` | F1a → F1b → F2a → F4a → F6 |
   | `src/field-main.ts` | F3a → F5a → F5b → F4b → F8a → F8b |
   | `src/field/input.ts`·`flags.ts` | F5a(만든다) → F4b(스틱은 `stick.ts` 로 따로 · `field-main.ts` 줄만) |
   | `src/tune/params.ts` · `ko.ts` · `en.ts` · `package.json` · `vite.config.ts` · `BALANCE.md` | 커밋 순간 규칙(A-4) 덕에 동시 진행은 되지만 **같은 순간 커밋은 코디네이터가 차례를 정한다** |
2. **시간을 재는 카드는 다른 무거운 일과 겹치지 않는다**: P3(advance 시간 부분)·P4·F1b(벤치)·F3b(프레임)·F7(봇 표 n=300 × 21)은 재는 동안 다른 일꾼이 `vite build`·`npm test` 같은 무거운 일을 하지 않을 때만. 코디네이터가 재기 전에 「지금 돌고 있는 무거운 일 없음」을 확인하고 일꾼에게 알린다. 이 PC 에서는 다른 일꾼과 같이 돌 때 시간이 ±수십 % 흔들린다 [옮김 26 §0].
3. 문서 쓰는 일(30·40·인수인계)은 코디네이터만. 일꾼은 보고에 적고, 코디네이터가 옮긴다.
4. 한 번에 띄울 일꾼은 **셋 이하**(사용량·충돌). 첫 묶음 = P1 ∥ P3 ∥ F1a. 이 셋은 파일이 안 겹친다: P1(`tests/realm/battle-golden.test.ts`) · P3(`tools/battle-stats.ts`·`tools/field-perf.ts`·BALANCE 한 절) · F1a(`src/field/*`·`tests/field/*`·`P.field`·`package.json`·`josa-lint` 한 줄). 단 P3 의 시간 재기와 F1a 의 시험이 겹치지 않게 P3 는 시간 부분을 마지막에 한다(P3 안내문).
5. 둘째 묶음 = P2 ∥ F1b(둘 다 시간 안 잼 · 겹치는 파일 없음). 셋째 = F2a ∥ F3a. 넷째 = F2b ∥ F3b ∥(재기 잠시 멈춤 규칙). …

### B-3. 모델 · 검수 표
| 카드 | 일꾼 모델 | 왜 | 끝난 뒤 독립 검수(읽기 전용 렌즈) |
|---|---|---|---|
| P1 | sonnet | 틀 복사·해시 굽기(기계적) | **sim-lens**(골든이 `command` 길을 정말 지나는지 · 두 번 돌려 같은지) |
| P2 | sonnet | 지우기·글 고치기 | **craft-lens**(남은 참조 0 · 동작 불변) |
| P3 | sonnet | 도구 정리·표 | **balance-lens**(표본 한계 문구 · 표 읽기) |
| P4 | sonnet | 재기만 | **perf-lens**(재는 조건이 조용했는지 · 판정 한 줄이 숫자와 맞는지) |
| F1a | **opus** | 정수 수학·타입 틀(뒤 모든 카드의 바탕) | **sim-lens** |
| F1b | **opus** | 전투 수학 복제·30ms 선(판단이 큼) | **sim-lens** + **perf-lens** |
| F2a·F2b | sonnet(F2b 가 승률 방향이 안 나오면 opus 로 승격) | 자료 꼴·복사 + 값 조임 | **sim-lens**(맵 해시 결정론) · **balance-lens**(F2b) |
| F3a·F3b | sonnet | 캔버스·카메라 복사·프레임 재기 | **perf-lens**(점 수·프레임) · **feel-lens**(F3b 폰 가독성) |
| F4a | **opus** | 규칙 둘(뛰어든 곳만 버팀 · 안 죽음)을 엔진 안에 박는 일 | **sim-lens** + **balance-lens** |
| F4b | sonnet | 스틱 재작성·단추 | **feel-lens**(입력 지연·한 손) |
| F5a·F5b | sonnet | 입력 모델·미니맵 | **feel-lens** + **loop-lens**(3초 복귀·중단 안전 · 때 문 저장) |
| F6 | **opus** | 계획 굳힘 ↔ 화살표 100% 일치(순서 설계) | **sim-lens** + **balance-lens** |
| F7 | **opus** | 봇 설계·조임 손잡이 판단 | **balance-lens** |
| F8a | sonnet(「이긴 까닭 한 줄」 규칙 표는 opus 가 먼저 짠다) | 화면·기록 | **loop-lens** + **feel-lens** + **pitch-lens**(끝 화면 말·단추 이름) |
| F9 | sonnet | 편성 화면·금빛·병종별 공(값은 F1b 의 병종 표에서) | **loop-lens**(뽑기 → 전장 거리) + **pitch-lens**(단추·말) |
| F8b | sonnet | 패드 | **feel-lens** |
| L1a~L1c | **opus** | `fightRounds` 이음(가장 위험 · 26) | **sim-lens** + **craft-lens** |
| L2 | **opus** | DOM 연출과 Canvas 겹침 | **loop-lens** + **feel-lens** |
| L4 | **opus** | 본편 군대를 읽어 전장을 세우되 저장은 안 건드림 | **loop-lens**(뽑기 → 전장 거리) + **sim-lens**(저장 바이트) |
| L3 | **opus** | 두 수학 사이 폭 맞추기(끝이 안 날 수 있음) | **balance-lens** |
- 검수 일꾼에게는 **그 카드의 합격선 문장과 변경된 파일 목록만** 준다(결론 먼저 안 준다 · 「이 코드를 읽고 문제를 찾아라」). 결과를 코디네이터가 읽고 카드를 다시 띄울지(수정 일꾼) 정한다.
- 큰 보고(예: G1 앞 요약)를 형께 올리기 전에 독립 검수 에이전트 하나가 「보고의 숫자를 실제 출력과 대조」 한다(no-pretend 규칙).

### B-4. 문 G1·G2 에서 형께 무엇을 보이고 무엇을 묻나
**G1 전에 준비** (코디네이터): ① F8a 까지 끝났고 `field.html` 이 Pages 에 올라 있다(`gh run list` 성공 + `curl -sI https://retyper.github.io/hanbal/field.html` 200). ② 형 폰에 띄우는 길: 주소를 직접 열거나(비공개 · 링크는 형이 지인에게 건넨다), 본편 첫 화면 「더 보기」 안 「새 전투 시험」 단추(F8a 가 `spar-open` 옆에 `field-open` 으로 더한다 · 본편에서는 그 한 단추가 전부). ③ F7 의 봇 표(손재주·판단·속도 숫자)를 뽑아 둔다. ④ 첫 판은 안내 없이 둔다(문턱 ① 이 「시키지 않아도」 이므로).
**형께 보이는 것** (이 순서로): 폰 화면 녹화 한 편(30초 · 코디네이터가 `tools/gamecap.ts` 로가 아니라 형 폰에서 직접), 봇 숫자 표 한 장(손재주 차 ≤5%p · 판단 차 ≥20%p · 한 판 시간 · 30프레임), 지인 다섯 명의 입력 로그 요약.
**형께 묻는 것** (31 의 여섯 가운데 이미 답이 온 것은 뺀다): ① 문 넷 중 셋이 넘었는가(30 §9-1 의 네 줄) ② 직접과 맡기기의 차이가 느껴졌는가(31-2 가 뒤집은 10-27 결정의 근거) ③ 장수 스틱이 폰에서 한 손으로 되는가(31-3) ④ 정찰이 참만 보이는 것이 맞는가(31-5) ⑤ 통과면 L(본편 연결)에 들어가도 되는가 · 아니면 (가)로 물러나거나 멈춤.
**G2** (2월 첫 주 · L3 뒤): 스위치 기본값 · 체험판(02-22)에 켤지(31-6). 보이는 것: 같은 싸움을 새 전투와 카드 전투로 치른 결과 폭 표(L3) · 화면 두 벌 녹화. 묻는 것: 기본값 꺼짐/켜짐 · 체험판 포함 여부.
**기록**: 지인 시험은 입력 로그(F8a 의 `hanbal.field.log` 복사 단추)를 형이 모아 코디네이터에게 붙여 준다. 이 로그가 문턱 ①~④ 의 숫자를 낸다(손으로 세지 않는다).

### B-5. 밀릴 때 버리는 순서 (30 §9 그대로)
F8b(패드) → F6b(정찰 단계 · 참값 화살표만 남김 · 화살표 한 개 고정) → 개울 맵(F2 에서 `cross` 빼기) → L 전체(출시 뒤로). **P1~P4 · F1 · F3 · F4 · F5 · F9 는 안 버린다**(없으면 G1 을 못 잰다). 앞의 일(영어·15세 판·빌드·상점 꾸러미·열전 카드)이 밀리면 F 를 통째로 3월로 옮긴다.

### B-6. 되돌리는 법
- **F 카드**: 본편 0줄이라 `src/field/` · `tests/field/` · `src/field-main.ts` · `field.html` · `tools/field-*.ts` 를 지우고 `vite.config.ts` 의 `field: 'field.html'` 한 줄 · `package.json` 의 `tests/field/*.test.ts` 한 칸 · `P.field` 절 · `ko.ts/en.ts` 의 `field.` 키 · `tools/josa-lint.ts` 의 `src/field` · F8a 의 `app.ts` 입구 한 줄을 되돌리면 끝(각 카드의 「끝났다는 것」 에 이 목록이 있다).
- **L 카드**: 설정의 「새 전투」 스위치를 끄면 옛 길. 주입이 없는 판은 P1 골든이 지킨다. L1a(`export` 만)는 되돌리지 않아도 동작이 같다.
- **P1·P2·P3·P4**: 커밋 단위로 `git revert`.
- 한 카드가 망치면 **그 카드의 커밋만 revert** 하고 다음 카드를 띄우지 않는다. 푸시한 뒤에는 새 커밋으로 되돌린다(강제 푸시 금지).

### B-7. 카드가 끝난 뒤 어디에 무엇을 적나 (코디네이터가 옮긴다)
| 문서 | 적는 것 | 누가 |
|---|---|---|
| `30-integrated.md` | **고치지 않는다.** 어긋남은 이 장 D 에만 쌓는다 | – |
| `40-cards.md`(이 장) | 맨 위 「진행」 한 줄(카드 · 커밋 해시 · 통과/미달) · 카드가 부른 줄 번호 어긋남(P2 뒤 −N) · 합격선 실측값(「합격선 칸에 실측 한 줄」) · 새로 알게 된 함정(「함정」 칸에 한 줄) | 코디네이터 |
| `HANDOFF.md` | 한 카드 끝날 때마다 한 줄(날짜 · 카드 · 해시 · 다음 행동) · 맨 위 현재 상태 표 | 코디네이터(공유 파일 규칙) |
| `docs/BALANCE.md` | P3·P4 표 · F7 봇 표 · L3 폭 표(**수치만** · 절 이름 `본편 전투 실시간화 (battle-study)`) | 해당 카드 일꾼(HEAD 판에 얹기) |
| `docs/realm/production/` 인수인계 글(`CLAUDE-HANDOFF-날짜.md` 꼴) | 그날의 요약 · 문 G1 결과 · 형의 판정 | 코디네이터 |
| 메모리 | 형의 새 지시·반복 교정만(코디네이터 판단) | 코디네이터 |

---

## C. 카드

표기: 「규모」 눈금 = 작음 ≤1일 · 중간 1.5~2일 · 큼 3~5일 · 아주 큼 6일+ (30 §9). 합격선은 카드마다 **하나**(둘이 한 도구로 같이 나오는 F7 은 그렇게 적는다).

---

### P1 · 골든 동결
1. **목적**: 지금 본편 전투의 결과를 **저장된 정답 해시**로 굳힌다 — 사람 쪽 `cmds` 가 있는 `command` 길까지 지나게. 이 카드가 끝나면 L·P2 가 「한 줄도 안 바뀌었다」를 시험으로 말할 수 있다.
2. **먼저 읽을 파일**
   - `tools/realm-oldclock-hash.ts`(21줄 출력 · **`command` 경로를 안 지나고 「이전 커밋과 비교」만 한다** [확인] · 26 §3-1④) — 왜: 이 도구가 굳히지 못하는 곳이 이 카드의 일이다.
   - `tests/raid-golden.test.ts`·`tests/raid-golden-kit.ts` — 왜: 골든 해시 시험의 틀(`BAKE=1` 로 새 값을 찍는다) [확인].
   - `tools/realm-tactics.ts:33-37·41-100` — `side()` 틀 · `play()` 가 `fightRounds(..., { cmds, dusk, open: true })` 를 합마다 다시 부르는 법 · 비 여섯 칸 `[0.6,0.8,1,1.25,1.6,2.2]` · 정책(맡김·`good`·`still`).
   - `src/realm/warroom.ts:23-47`(`rehearse` 가 `ANY_BATTLE` 로 첫 우리 싸움을 찾고 `advance(prev, orders, {}, tactics)` 를 돈다) · `src/realm/season.ts:1390`·`:1659`(`fightRounds` 호출 둘) · `season.ts:2033`(명령 줄 → `Tactic`).
3. **만들 파일 / 고칠 파일 / 금지**
   - 만들: `tests/realm/battle-golden.test.ts`(glob `tests/realm/*.test.ts` 에 이미 걸린다) · `tools/realm-golden.ts`(같은 판을 n 키워 크게 돌리는 도구 · 선택).
   - 고칠: 없음. (`tools/realm-oldclock-hash.ts` 는 **고치지 않고** 읽기만.)
   - 금지: `src/**` 전부(읽기만) · 기존 시험 파일.
4. **할 일**
   1. `git status --short src/realm src/ui/realm` 으로 본편 전투 파일이 HEAD 와 같은지 확인한다. `git diff HEAD -- src/tune/params.ts` 가 `P.realm.tac*` 를 건드리지 않는지도(건드리면 멈추고 코디네이터에게 보고 — 해시가 HEAD 판이 아니게 된다).
   2. 지금의 `oldclock` 21줄을 `tools/out/p1/oldclock-before.txt` 에 저장한다(`node --experimental-strip-types tools/realm-oldclock-hash.ts > tools/out/p1/oldclock-before.txt`). P2·L 이 끝난 뒤 같은 명령 결과와 `diff` 로 견주는 기준이다.
   3. **골든 A(`fightRounds` 직접)**: `side()` 틀을 복사해(`realm-tactics.ts:33-37`) 병종 섞음 3종 · 비 6칸 · 정책 3종(맡김 = `cmds` 없음 · `good` · `still`)을 조합하고 씨앗을 1부터 올려 **정책마다 1,000판**. 판마다 `JSON.stringify(결과)` 를 fnv(`oldclock-hash.ts:15-19` 복사)로 누적한 해시 하나를 정책마다 만든다. 해시와 함께 결과 요약 카운트(`outcome`·`endWhy` 분포)도 문자열로 같이 굳힌다(해시만 보면 무엇이 바뀌었는지 모른다).
   4. **골든 B(`advance` 의 `command` 길)**: `startRegion`(`oldclock-hash.ts:22-24` 의 목록에서 3지역 · 씨앗 1·2) 으로 16턴을 돌리되, 우리 싸움이 나오면 `rehearse(prev, orders, {}, null, me)` 로 첫 열쇠를 얻고 `tactics[key] = { cmds: <고정표>, open: false }` 를 넣어 `advance(prev, orders, {}, tactics)` 한다. 고정표는 `['hold','charge','open'...]` 같은 순환 `RoundOrder` 이고 마지막 때는 `dusk` 를 `'camp'` 로. 턴마다 `JSON.stringify(report)` 와 최종 `JSON.stringify(realm)` 해시를 굳힌다. 이 길이 `Tactic.cmds`·`ReportLine` 을 지나는지 확인하려고 **한 판은 `report.lines` 에 `kind: 'battle'` 이 있고 `rounds` 가 비지 않음을 `assert`**.
   5. 해시 상수는 시험 파일 안 `GOLDEN` 객체에 박는다. 값이 없을 때 `BAKE=1 node --test --experimental-strip-types tests/realm/battle-golden.test.ts` 가 새 값을 찍게 한다(`raid-golden.test.ts` 와 같은 틀).
   6. 같은 시험을 두 번 돌려 해시가 같은지(결정론) · 시험 소요 초를 잰다. `npm test` 에 얹기에 길면(합쳐 약 15초 넘으면) 시험은 정책당 300판으로 줄이고 큰 판은 `tools/realm-golden.ts --n 10000` 으로 따로 둔다(같은 해시 함수를 쓰고 n=300 의 값이 도구의 앞 300판과 같음을 시험이 보인다).
   7. `npm run typecheck` · `npm test` 실패 0.
5. **params**: 없음(읽기만).
6. **시험**: 더하는 것 `tests/realm/battle-golden.test.ts`(이름 예: 「골든 A 맡김 1000판」 · 「골든 B command 길 16턴」). 지킬 것: `tests/realm/tactics.test.ts` · `battle.test.ts` · `look.test.ts` 전부 · `tests/raid-golden.test.ts`.
7. **합격선(하나)**: 새 골든 시험이 **HEAD 에서 통과**한다(두 번 연속).
   - 재는 명령: `node --test --experimental-strip-types tests/realm/battle-golden.test.ts` (새 값 굽기: 앞에 `BAKE=1`).
8. **규모**: **작음**(≤1일). 26 §7-2 가 「각각 작음」 · 22 의 「20,000판」은 시험 시간 때문에 줄이고 도구로 남긴다 [의견].
9. **앞 카드**: 없음. **나란히**: P3 · F1a. **뒤**: P2.
10. **함정**: (1) oldclock 도구는 `command` 길을 안 지나고 정답도 저장 안 된다 — 그대로 시험으로 옮기면 빈 껍데기다(골든 B 의 `assert` 가 이를 막는다). (2) 사람 쪽 `cmds` 는 `RoundOrder` 로 합마다 다르게 줘야 `pending`/`look` 길이 갈린다. (3) `monthClock` 을 `oldclock-hash.ts:15` 처럼 0 으로 두는 규칙이 해시에 걸린다(시험 안에서 바꾸고 끝나면 되돌린다 — 다른 시험에 새지 않게 `after()`). (4) 작업 트리에 남의 수정이 있으면 해시가 HEAD 가 아니다 — 1번 확인.
11. **끝났다는 것**: 커밋(시험 파일 · 선택 도구) · 보고에 **정책별 해시 4개 이상 · 판 수 · 시험 소요 초 · 두 번 연속 같음 · oldclock before 21줄 파일 경로**.

---

### P2 · 죽은 코드와 낡은 글 (동작 변화 0)
1. **목적**: 00 §7 의 1·2·3(·5 는 목록만)을 치워 줄 번호 혼선을 없앤다. 끝나면 `BASIC`·`BEATS`·`COUNTER`·`b0On` 이 저장소에서 사라진다.
2. **먼저 읽을 파일**: `00-index-critique.md §7` · `26-review-code.md §7-2 ③` · `src/realm/tactics.ts:204-211`(`GRPS` 다음 `BASIC`·`BEATS`·`COUNTER`) · `src/ui/realm/battlefield.ts:522-525`(`B0_KEY`·`b0On`) · `src/ui/realm/app.ts:121`(import)·`:8790`(`case 'b0-toggle'`) · `src/ui/realm/wipe.ts:16` · `docs/realm/BATTLE.md`(§0 「남은 싸움 다 맡긴다」 · §3 「합 3번」 · §6 끝) · `docs/realm/BATTLE-LIVE.md`(순서 0 의 「꺼짐/켜짐」).
3. **만들/고칠/금지**
   - 고칠: `tactics.ts` 의 `BASIC`·`BEATS`·`COUNTER` 정의 5줄(206-210 부근 주석 포함) · `battlefield.ts:522-525` 의 `B0_KEY`·`b0On` · `app.ts:121` import 에서 `B0_KEY`·`b0On` · `app.ts:8790` 의 `case 'b0-toggle'` · `docs/realm/BATTLE.md` · `docs/realm/BATTLE-LIVE.md`(서술만).
   - **금지**: `wipe.ts:16` 의 `'hanbal.realm.battle0'`(옛 저장 지움 목록 — 키 이름은 남겨 옛 기기의 값이 지워지게 한다 [의견]) · `fightRounds`·`frontQ` 등 계산 코드 · 00 §7 의 **4번(긴창 `pike` 뽑는 길)** 은 동작이 바뀌는 일이라 이 카드에서 **제외**(D 의 7번) · 5번(`battle-strikes.ts` 맞힘 칸 표)은 **낡은 칸 목록을 보고에 적을 뿐 고치지 않는다**(그림에 걸림).
4. **할 일**
   1. P1 이 끝났고 P1 의 `oldclock-before.txt` 가 있는지 확인(없으면 멈춤).
   2. `grep -rn "BASIC\|BEATS\|COUNTER" src tests tools --include=*.ts` 로 쓰는 곳을 센다. **`tactics.ts` 에서 import 하는 곳이 0** 인지 눈으로 확인한다(`battle.ts`·`woo.ts`·`woo-view.ts`·`tests/realm/guess.test.ts`·`tools/duel-fps-probe.ts`·`tools/realm-woo.ts` 에 같은 낱말이 나오는 것은 **다른 정의일 가능성**이 크다 [확인 · `grep -l` 로 이름만 봤다] — 이름이 같아도 `from '.../tactics.ts'` 인지 확인).
   3. `tactics.ts` 정의 5줄 삭제. 삭제 전 `git grep -n "from '.*tactics.ts'" | grep -i "BASIC\|BEATS\|COUNTER"` 가 0.
   4. `battlefield.ts` 에서 `B0_KEY`·`b0On` 삭제(주석 포함) · `app.ts` import 줄 정리 · `case 'b0-toggle'` 삭제. 삭제 전 `grep -rn "b0-toggle\|data-act=\"b0" src` 로 단추가 어디에도 없는지 확인.
   5. `docs/realm/BATTLE.md` 의 어긋난 줄을 지금 코드에 맞춘다(그 단추는 10-25 에 뺐다 · 합은 4때 + 한 합 더 [옮김 01]). §6 끊긴 줄은 `git log -p -- docs/realm/BATTLE.md` 로 원문이 있으면 되살리고 없으면 끊긴 줄을 지운다.
   6. `npm run typecheck` · `npm test`. 그리고 `node --test --experimental-strip-types tests/realm/battle-golden.test.ts`(P1)가 **그대로 통과** · `oldclock` 도구를 다시 돌려 `tools/out/p1/oldclock-after.txt` 와 before 가 `diff` 0.
   7. 지운 줄 수와 **줄 번호가 얼마나 당겨졌는지**(`tactics.ts` 의 `fightRounds` 가 728 에서 몇으로 · `battlefield.ts` · `app.ts`)를 보고에 적는다.
5. **params**: 없음.
6. **시험**: 새 시험 없음. 지킬 것: P1 골든 · `npm test` 전부.
7. **합격선(하나)**: **동작 변화 0 = P1 골든 불변**(+ `oldclock` before/after `diff` 0).
   - 재는 명령: `node --test --experimental-strip-types tests/realm/battle-golden.test.ts && diff tools/out/p1/oldclock-before.txt tools/out/p1/oldclock-after.txt`
8. **규모**: **작음**. 26 §7-2 ③.
9. **앞**: P1. **나란히**: P3 · F1a · P4(둘 다 시간 안 재는 시점이면). 같은 파일(`app.ts`)을 고치는 다른 카드(F8a)보다 먼저.
10. **함정**: 줄 번호가 당겨져 앞선 장(26·22)의 줄 번호가 다 어긋난다(이 카드가 끝나면 30·40 에 한 줄 적는다) · `wipe.ts` 를 같이 지우면 옛 기기에 키가 남는다 · `COUNTER` 같은 흔한 낱말은 `grep` 만 믿지 말고 import 대상 확인 · 문서 고치기에서 「합 3번」을 「4때」 로 바꿀 때 `tacRoundsMax` 5(`params.ts:3800`)와 헷갈리지 않게(4때 + 한 합 더).
11. **끝났다는 것**: 커밋(코드 3곳 + 문서 2곳) · 보고에 **지운 줄 수 · 당겨진 줄 번호 · P1 골든 통과 · oldclock diff 0**.

---

### P3 · 재는 도구 (본편 싸움 실측표 + 폰 프레임 틀)
1. **목적**: 「사람 판의 싸움이 얼마나 되는가」를 봇 판으로 재서 BALANCE.md 에 표로 박고(합 수·싸움 수·한 편 사람 수 분포·한 합의 초·`advance` 턴당 시간·판 기록 크기), F3b 가 쓸 폰 프레임 재기 틀을 만든다.
2. **먼저 읽을 파일**: 26 §3(12번 합 수 · 10번 사람 수 분포 · 2번 `advance` 시간) · §5-3(판 기록 크기) · `tools/out/battle-study/{men-dist,adv-time,sim-bench,v-fight-ms}.ts`(26 이 만든 **로컬** 도구 · `.gitignore` 의 `tools/out/` 안이라 저장소에는 없다 [확인]) · `tools/realm-sim.ts`(싸움 수 표 · `--games 24`) · `tools/realm-savesize.ts` · `tools/war-perf.ts`·`tools/raid-fps-probe.ts`(CDP 로 크롬을 띄워 rAF 간격을 잰다 · 런타임 의존 없음) · `docs/BALANCE.md` 끝 부분.
3. **만들/고칠/금지**
   - 만들: `tools/battle-stats.ts`(men-dist + adv-time 을 한 도구로 정리) · `tools/field-perf.ts`(URL·CPU 배율·초를 받아 rAF 간격 p50·p95·50ms 넘는 틀 수를 찍는 **틀** · `war-perf.ts` 의 CDP 코드 복사).
   - 고칠: `docs/BALANCE.md` — **새 절 하나**(`본편 전투 실시간화 (battle-study) · 실측 · P3`) 만. HEAD 판에 얹는 방식(A-4).
   - 금지: `src/**` · 기존 `tools/*.ts`(복사해 새 이름으로).
4. **할 일**
   1. 로컬 `tools/out/battle-study/men-dist.ts` 를 열어 읽고 `tools/battle-stats.ts` 로 **복사 정리**(상대 import 경로 `../src/...` 로 고침). 영남 6판이던 표본을 **지역 넷**(영남·마한·남부·변한 미니 · `startRegion` 목록 `oldclock-hash.ts:22-24`)으로 넓힌다.
   2. 재는 것: (a) 계절당 우리 싸움 수 (b) 싸움당 합 수와 `endWhy` 분포(26 은 영남 1.6~1.9합 · 62싸움 중 사기 42·생포 9·물러남 5·사람 3·몫 3 [옮김]) (c) 한 편 사람 수 p50·p90·최대(26: 594·1,305·2,097 [옮김]) (d) `advance` 턴당 ms(26: 4.5ms [옮김]) (e) `realm-savesize` 의 80계절 판 JSON · 로그 크기 (f) 지금 한 합의 연출 초: `src/tune/params.ts` 의 `warBeat0`·깃발 길이·`warResultGap` 값을 읽어 셈(26: 5~7초 [옮김 · 내 셈]) 하고 **셈이라고 적는다**.
   3. 난세 후반 표본이 있으면 한 줄 더(단계 3 이상 최대 1,983명 [옮김 26 §8]). 못 하면 「못 잼」.
   4. `tools/field-perf.ts`: `war-perf.ts` 의 CDP 연결·CPU throttle 부분만 떼어 `URL · 초 · CPU 배율` 을 인자로 받게 한다. 기준선으로 **`realm.html` 첫 화면 또는 `raid.html`** 을 같은 방식으로 한 번 재서 숫자를 BALANCE 에 적는다(헤드리스 크롬이 없거나 못 띄우면 「못 잼」 + 까닭).
   5. 시간 재기 부분(d)은 **맨 마지막에**, 다른 무거운 일이 없을 때(코디네이터 확인 · B-2-2) 3회 중앙값.
   6. BALANCE.md 절: 표 한 장(칸마다 값 · 표본 크기 · 「봇 판 · 사람 판 아님」) + 한계 3줄.
5. **params**: 없음.
6. **시험**: 도구라 시험 없음. `npm run typecheck`(tsconfig 가 `tools` 를 포함 [확인])이 통과해야 한다.
7. **합격선(하나)**: **표가 BALANCE.md 에 들어간다**(칸마다 숫자 또는 「못 잼 + 까닭」).
   - 재는 명령: `node --experimental-strip-types tools/battle-stats.ts --games 24` · `node --experimental-strip-types tools/field-perf.ts http://localhost:5174/realm.html 8 4`
8. **규모**: **중간**(1.5~2일).
9. **앞**: 없음. **나란히**: P1 · P2 · F1a. P4 와 시간 재기를 겹치지 않는다.
10. **함정**: 표본이 작다(26 §8: 영남 6판 · 봇 `cautious` 한 종) — 「사람 판」이라 부르지 말고 「봇 판」 · 26 의 합 수(1.6~1.9)와 BALANCE 의 4.19(AI 끼리 표본)가 다른 표본이라 같이 적는다 · 26 의 도구는 **로컬**이라 저장소에서 사라질 수 있다(복사해서 추적 파일로) · 시간은 ±수십 %.
11. **끝났다는 것**: 커밋(두 도구 + BALANCE 절) · 보고에 **표 값 요약 · 표본 수 · 도구 경로**.

---

### P4 · 열전 성능 확인
1. **목적**: 열전 규칙을 다 켠 20분 판의 **걸음당 시간**을 조용한 때 다시 재서 「필드 sim 이 열전 걸음 비용(2.6ms)을 만나지 않는가」 와 폰 예산을 한 줄로 판정한다.
2. **먼저 읽을 파일**: `02-raid-engine-reuse.md §7`(2.6ms/걸음 · 적 상한 230 · 규칙 켜기 전 263µs) · 로컬 `tools/out/battle-study/time-run.ts`(`createHaebi`·`stepHaebi`·`botInput` 로 20분 돌리는 25줄) · `src/raid/runlog.ts:13`(`STEP = 1/120`) · `tools/raid-fps-probe.ts`(폰 4× 프레임) · `tools/raid-well-probe.ts`.
3. **만들/고칠/금지**: 만들: `tools/out/p4/`(임시 · 커밋 안 함). 고칠: `docs/BALANCE.md` 한 절(P3 와 같은 절 아래 소제목 · **P3 가 먼저 들어간 뒤**). **금지: `src/raid/**` 고치기(O(N²) `denseSpot` 도 안 고친다 · 02 §11 은 「제안」일 뿐 · 열전 한 줄 금지).**
4. **할 일**
   1. 코디네이터가 「다른 무거운 일 없음」을 알려 준 뒤 시작(B-2-2). 시작 전 `git status --short src/raid` 를 보고에 그대로 적는다(작업 트리에 미커밋 열전 수정이 있으면 그 상태에서 잰 것이라고 적는다. 02 §7 도 같은 사정 [옮김]).
   2. `tools/out/battle-study/time-run.ts` 를 `tools/out/p4/` 로 복사하고 import 경로를 맞춘다. **규칙 켠 숲 20분 판 · 씨앗 7 · 도끼**를 3회 돌려 걸음당 µs **중앙값**을 낸다(한 번에 약 6분 · `run_in_background` · 중간 보고 후 끝낸다). 규칙 끈 판은 1회.
   3. 폰 예산 셈: 걸음은 120Hz(`runlog.ts:13`) → 60fps 프레임 하나에 걸음 2개 → 걸음당 2.6ms 면 sim 만 프레임 예산(16.7ms)의 약 31%. 4× CPU 느린 폰이면 124%. (이 셈은 [의견]이라고 적는다.)
   4. **판정 한 줄**을 적는다: 「필드 sim(정수 격자 · 대 38몸 · 틱 10Hz)은 걸음당 비용이 열전보다 몇 자릿수 작아야 한다 → F1b 의 30ms/판 선이 이 비교의 근거」 꼴로.
   5. `tools/raid-fps-probe.ts 4 8` 은 **돌릴 수 있을 때만**(크롬 필요 · 5174 서버 `raid.html?mode=stage&review`). 못 하면 「안 봤다」.
5. **params**: 없음.
6. **시험**: 없음.
7. **합격선(하나)**: **숫자와 판정 한 줄이 BALANCE.md 에 들어간다.**
   - 재는 명령: `node --experimental-strip-types tools/out/p4/time-run.ts`(3회)
8. **규모**: **작음**(재는 시간이 대부분 · 일꾼 손은 짧다).
9. **앞**: P3 의 BALANCE 절이 들어간 뒤(같은 문서 · 순서). **나란히**: 다른 무거운 카드 금지. 
10. **함정**: 02 의 2.6ms 는 다른 일꾼이 같이 돌 때의 값일 수 있다 — 그래서 다시 잰다 · 작업 트리의 열전 수정이 시간을 바꾼다(보고) · 목책 돌파 판은 봇이 250초에 져서 짧다(20분 판이 아니다) · `performance.now` 는 도구에서 써도 된다(sim 이 아니다).
11. **끝났다는 것**: 커밋(BALANCE 소절) · 보고에 **세 번의 µs · 중앙값 · 규칙 끈 판 값 · 판정 한 줄 · `git status src/raid` 결과 · 못 잰 것**.

---

### F1a · sim 뼈대 (타입 · 정수 수학 · 틱 · 입력 기록 · P.field)
1. **목적**: `src/field/` 에 DOM 이 없는 정수 sim 의 **뼈대**가 선다 — 타입 · 정수 수학 · 한 걸음 틀 · 입력 기록 · 해시 · `P.field` · 순수성 시험 · 시험 glob. 끝나면 빈 시나리오(두 편이 걸어 서로 다가감)가 같은 씨앗에서 같은 해시로 돈다.
2. **먼저 읽을 파일**
   - `30-integrated.md §3·§6` · `22-design-code-reality.md §2(자료 꼴 초안)·§4-3(sim 초안 표)` — 타입 이름과 처음값의 출처.
   - `src/night/sim.ts` + `src/night-main.ts:1-40·488·562-567` — 별도 진입점 sim 의 폴더 모양과 숨은 탭 처리의 본보기 [확인].
   - `src/raid/runlog.ts:13-60` — 입력 기록(바뀔 때만 적고 b36 으로 줄이기)·`cell()` 주석(-0 과 `atan2` 가 정수 격자의 이유).
   - `src/core/rng.ts:30-93` · `docs/ARCHITECTURE.md` A1(결정론)·A2(상수 단일 출처).
   - `src/realm/tactics.ts:204-260`(`GRPS`·`groupOf`·`groupMen`·`groupsOf` — **읽기 import 해도 되는 순수 함수** · `export` 확인 [확인]) · 단 `tactics.ts` 가 `vanguard.ts` 를 import 하므로 `vite build` 번들에 무엇이 끌려오는지 F3a 에서 확인한다(무거우면 `groupOf` 표만 복사).
   - `tools/realm-oldclock-hash.ts:15-19`(fnv).
3. **만들 파일 / 고칠 파일 / 금지**
   - 만들: `src/field/types.ts` · `src/field/num.ts` · `src/field/state.ts` · `src/field/sim.ts` · `src/field/rec.ts` · `tests/field/determinism.test.ts` · `tests/field/num.test.ts` · `tests/field/rec.test.ts` · `tests/field/purity.test.ts`.
   - 고칠: `src/tune/params.ts` — `SPEC`(`:1676`)의 `night`(`:3021`)·`pirate`·`duel`·`realm`(`:3495`) 옆에 `field: { ... }` 절 새로 · `package.json:12` `"test"` 에 `tests/field/*.test.ts` 한 칸 · `tools/josa-lint.ts` 의 `DIRS`(`['src/ui/realm','src/realm']`)에 `'src/field'` · (`tests/realm/josa.test.ts` 가 이 검사를 돌린다 [확인 · 파일 머리 주석]).
   - 금지: 열전·본편 전투 파일.
4. **할 일**
   1. `P.field` 절을 만든다(5번 목록). 각 값은 `k(값, 최소, 최대, 간격, '한글 설명')` 꼴(`params.ts:1412` 의 `k`). 새 절을 만들면 튜닝 콘솔이 슬라이더를 자동으로 만든다.
   2. `types.ts`(정수만): `Grp = 'front'|'bows'|'horse'`(본편 `Grp` 와 같은 낱말) · `Squad { id; side: 0|1; grp; kind; men; menMax; fresh; u; v; goal: {u;v}|null; target: number; hp; morale }`(대 = 몸 · `fresh` = 이번 달 새로 뽑은 사람 수 → 금빛) · `Hero { side; id; u; v; grp: number|-1; stun; hp; ... }`(내용은 F4a 가 채운다) · `FieldInput { tick; g: 0|1|2|3; op: number; u: number; v: number }`(22 §3: g 0 앞줄 1 활 2 기병 3 장수) · `LiveSide`(22 §2 의 `{men:{front,bows,horse}; F; morale; hero; player; seen}` 에 `fresh` 를 더한 것) · `LiveSetup { v:1; key; seed; map; sides; night }` · `FieldState { tick; seed; squads; heroes; end: EndWhy|null; log }`. `FieldMap` 은 F2a 가 채우므로 F1a 에서는 `{ u; w }` 빈 띠만.
   3. `num.ts`: `isqrt(n)`(정수 뉴턴 · 시험으로 0~10⁶ 표) · `dist2(ax,ay,bx,by)` · `stepToward(ax,ay,bx,by,speed)`(정수 벡터 · `isqrt` 로 길이 · 삼각함수 0) · `clamp` · `idiv`(= `Math.trunc(a/b)`).
   4. `rec.ts`: 입력 줄 직렬화 `b36(틱),g,op,b36(u),b36(v)` 를 `;` 로 잇는다 · 바뀔 때만(런로그 틀) · `parse(serialize(x))` 가 같은 배열 · 한 판 평균 20~60줄(0.3~0.9KB [옮김 22 §3]) 인지 시험이 센다.
   5. `sim.ts`: `createField(setup: LiveSetup): FieldState` · `stepField(s, inputs: readonly FieldInput[]): void`(제자리 갱신) — **F1a 는 이동 뼈대만**: 매 틱 대가 `goal` 로 `stepToward`, 재목표는 `retargetEvery` 틱마다(F1b 가 전투를 얹는다). 입력은 `applyInput` 한 함수로 모으되 **한 때(`timeTicks`)에 무리당 `inputPerGroupPerTime` 개까지만** 받고 넘치면 버리며 `s.log.dropped++`(22 §3 · 손재주 장치). 난수는 `roll(seed, tick, key)` 만.
   6. `state.ts`: `hashField(s)`(fnv 로 대·장수 정수 필드만 · 키 순서 고정) · `snapshot(s)`(그림용 읽기 복사 · 선택).
   7. `purity.test.ts`: `node:fs` 로 `src/field/` 의 sim 쪽 파일(`types num state sim rec combat map ai`)을 읽어 `Math.random|Date.now|performance.now|Math.sin|Math.cos|Math.atan|Math.hypot|document|window|localStorage` 가 **0** 인지 센다(주석·문자열은 걸러서 센다). 새 sim 파일 목록은 이 시험의 배열이 기준.
   8. `determinism.test.ts`: 1,000 시나리오(씨앗 1..1000 · 사람 수 세 크기 · 같은 입력 열)를 두 번 돌려 `hashField` 가 같다 · 입력 기록을 `parse` 해 재생한 판의 해시가 같다.
   9. `package.json` `test` 에 `tests/field/*.test.ts` 를 더하고(공유 파일 규칙) `josa-lint` DIRS 한 칸. `npm test` 에서 새 시험이 **실제로 도는지**(`# tests` 수가 늘었는지) 확인한다 — 안 돌면 glob 이 틀린 것이다(26 §3-8 의 함정).
5. **params**(`P.field` · 처음값은 [의견 · 근거]):
   - `hz` 10 — 걸음 수/초. 22 §4-3 의 10Hz · 입력 지연이 읽히면 F4b 에서 20 으로 올린다(처음 값 · 재기: F4b 의 입력→반응 틱 수).
   - `unit` 256 — 1칸 = 256 단위(22 §2).
   - `timeTicks` 300 — 한 때 = 30초(21·30 §2 「한 때 = 약 30초」).
   - `timesMax` 5 — 한 판 최대 때 수(해시계 4때 + 한 합 더 · 30 §2 「길어야 150초」 · `P.realm.tacRoundsMax` 5 와 같은 결 [확인 `params.ts:3800`]).
   - `squadsPerGroupMax` 4 — 무리마다 대 4개 이하(30 §6).
   - `bodiesMax` 38 — 전체 몸 상한(30 §6 · 대 12×2 + 장수 2 + 마디 12).
   - `retargetEvery` 4 · `nearKeep` 6 — 22 §4-3 의 재목표 틱과 가까운 목록 크기(F1b 에서 30ms 선이 안 나오면 늘린다).
   - `inputPerGroupPerTime` 3 — 22 §3.
   - `speedFrontCellsPerSec` 3 · `speedBowsCellsPerSec` 3 · `speedHorseCellsPerSec` 6 — 한 편 3칸/초 두 편이 서로 오면 6칸/초 → 시작 거리 120칸이면 20초(30 §3 의 「접근 20초 안」 · **F2b 가 시작 거리를 잰다**).
6. **시험**: 더하는 것 위 네 파일. 지킬 것: `npm test` 전부(특히 `tests/realm/josa.test.ts`) · `tests/raid-golden.test.ts`.
7. **합격선(하나)**: **빈 판 1,000씨앗에서 같은 씨앗 두 번 = 같은 해시, 입력 기록 재생 = 같은 해시, `purity` 시험 0건.**
   - 재는 명령: `node --test --experimental-strip-types tests/field/determinism.test.ts tests/field/purity.test.ts`
8. **규모**: **중간**(1.5~2일). F1 전체가 큼(3~5일 · 26 F1 +1일 재셈)이라 앞쪽 뼈대(a)와 전투 규칙(b)으로 쪼갰다 — 쪼개는 선 = 「대가 걸어 다가감」 까지가 a, 「부딪혀 피해·사기·끝」 부터가 b.
9. **앞**: 없음(P1~P3 와 파일이 안 겹친다 · 첫 묶음). **나란히**: P1 · P3 · P2. **뒤**: F1b.
10. **함정**: (1) **glob 이 `tests/field/` 를 안 돈다**(`package.json:12` [확인])를 같은 커밋에서 고친다. (2) `-0`: 해시 입력에 `Object.is(-0)` 가 끼지 않게 정수 나눗셈은 `Math.trunc` 뒤 `+ 0`. (3) `Map`/`Set` 순회는 삽입 순서라 괜찮지만 `Array.sort` 의 비교가 부동소수나 불안정 동점이면 기기마다 달라진다 — id 로 동점을 깬다. (4) 삼각함수를 한 번이라도 쓰면 CI 와 폰의 끝자리가 달라진다(열전 79곳이 못 옮기는 이유 [옮김 02]). (5) `enum`·생성자 매개변수 속성은 strip-types 에서 안 돈다. (6) 숫자 상한(`bodiesMax`)을 넘기는 시나리오를 입력으로 받으면 거부(throw)가 아니라 `end='invalid'` 로 끝내 시험이 잡게.
11. **끝났다는 것**: 커밋(`src/field/*` 5 · 시험 4 · `params.ts` 절 · `package.json` 한 칸 · `josa-lint` 한 줄) · 보고에 **시험 개수 전→후(`npm test` 의 `# tests`) · 결정론 1,000씨앗 해시 샘플 · 순수성 0건 · glob 이 새 시험을 돈다는 증거**. 되돌림 목록(B-6)에 이 카드가 더한 곳을 한 줄로.

---

### F1b · 전투 규칙 · 사기 · 끝 판정 · 벤치
1. **목적**: 대끼리 싸우고(상성·사거리·피해) 사기가 새며 끝(사기·사람·시간·물러남)이 나는 **AI 대 AI 한 판**이 선다. 끝나면 헤드리스 한 판 중앙값이 30ms 안이다.
2. **먼저 읽을 파일**: F1a 결과 · `30 §6`(규칙 셋 · 합격선 · 몸 수) · `26 §1(엔진 수학 복제 → 표류)·§3-9(장난감 6.6ms)·§3-10(사람 수 분포)` · `src/realm/tactics.ts` 의 **비공개**(`export` 없음) 수학: `frontQ`(:287)·`downOf`(:364)·`shareOf`(:386)·`groupPower`(:391) — **읽고 방향만 옮긴다**(수식을 글자 그대로 복제하지 않는다 · 같은 규칙이 이미 셋인 저장소의 넷째를 짓는 일이라 파일 머리에 「복제 · 원본 파일:줄」을 적는다) · `src/ui/realm/battlefield.ts:202`(`FRONT_COUNTER` = 방진>돌격>길 트기>방진 [확인]) · `tests/realm/tactics.test.ts`(상성 시험 · 26 은 `:108`) · 로컬 `tools/out/battle-study/sim-bench.ts`(38몸 장난감 6.6ms · 900틱) · `P.realm.tacBreakMen`(:3746)·`tacBreakMorale`(:3747)·`tacWinShare`(:3748).
3. **만들/고칠/금지**
   - 만들: `src/field/combat.ts`(피해·상성·사거리) · `src/field/morale.ts`(사기·끝 판정) · `src/field/ai0.ts`(**기본 AI** · 「가장 가까운 적 대를 향해 걷고 사거리면 친다」 만 — F6 의 정식 AI 가 대체) · `tools/field-bench.ts` · `tests/field/combat.test.ts` · `tests/field/end.test.ts` · `tests/field/parity.test.ts`.
   - 고칠: `src/field/sim.ts`·`types.ts`(F1a 파일) · `src/tune/params.ts`(`P.field` 에 값 더함 · 쓰는 코드와 한 커밋).
   - 금지: `tactics.ts` 에 `export` 붙이기(L1a 의 일) · 본편 파일.
4. **할 일**
   1. 상성: 앞줄 세모 `방진 > 돌격 > 길 트기 > 방진`(`battlefield.ts:202` 의 `FRONT_COUNTER` = `{charge:hold, hold:open, open:charge}` 와 같은 순환 [확인]). 방침은 대의 `stance`(`'charge'|'hold'|'open'`) 필드로(F1a 의 `Squad` 에 칸 추가) · 활은 사거리 안 가장 가까운 적을 쏨 · 기병은 옆구리(뒤쪽 각도)에 배수. 상성 곱은 정수(‰).
   2. 피해: `dmg = (men * power[grp] * matchup * groundMul) >> shift` (22 §4-3 · 정수). 대 `men` 이 줄고 사기는 ‰ 정수.
   3. 사기: 편마다 0~1000. 줄어듦 · 옆구리 · 장수 쓰러짐(F4a)에 변함. 끝 임계는 `P.realm.tacBreakMen/tacBreakMorale/tacWinShare` **읽기**(본편 문턱 그대로 · 30 §6 규칙 3). 사기 문턱 아래로 가면 **바로 끝**, 물러남은 언제든(입력 `op` 하나).
   4. 끝: `EndWhy = 'morale'|'men'|'time'|'retreat'`(`tactics.ts` 의 `EndWhy` 와 낱말을 맞춘다 [확인 `types.ts` 에서 확인 후]) · 시간 끝은 `timesMax*timeTicks` 에서 남은 몫(`tacWinShare`)으로 이김/짐 · **지는 편 사기가 문턱 아래면 45~70초에 끝나야** 한다(30 §2 · 26 의 「질 걸 아는 2분 금지」).
   5. 대 수 제한: 무리마다 대 **4개 이하 고정**, 대당 사람 수가 변한다(사람 수 p90 1,305·최대 2,097 [옮김 26 §3-10] 이라 「40명씩」 은 틀림). 시나리오 빌더 `squadsOf(side)` 를 둔다.
   6. 기본 AI(`ai0.ts`)로 두 편을 돌려 끝까지. 입력 없이 끝난 판이 의미 있는 승패(사기 문턱)를 낸다.
   7. `tools/field-bench.ts --n 1000 [--bodies 38]`: 1,000씨앗의 한 판 시간 중앙값·p95·최대 + 같은 씨앗 두 번 해시 비교(결정론) + 끝 까닭 분포. `performance.now` 는 도구에서만.
   8. 시나리오 크기 세 개(한 편 사람 수 600·1,300·2,100)에서 시간이 거의 같아야 한다(대 수 고정이라서) — 안 같으면 그 이유를 보고.
   9. `parity.test.ts`(방향만): 세모의 세 방향이 `fightRounds` 와 **같은 쪽**으로 승률이 기운다(예: 방진이 돌격에 유리) · 병력 비가 클수록 승률이 오른다 · 같은 방침끼리는 병력 쪽이 이긴다. **수치가 아니라 방향**임을 시험 머리에 적는다(복제 표류를 막는 안전망 · 26 §1-1).
5. **params**(처음값은 모두 「시작값 · F7 의 `field-bots` 표와 `field-bench` 로 조인다」 · [의견]): `powerFront`·`powerBows`·`powerHorse`(틱당 사람 한 명의 피해 몫 · ‰), `matchupWin` 1300 · `matchupLose` 770(앞줄 세모 곱 ‰ · 1000 이 중립), `flankMul` 1400, `bowRangeCells` 14, `meleeRangeCells` 1(접촉), `moraleLossLostShare`(잃은 몫당 사기 ‰) · `moraleLossFlank`, `retreatMoraleKeep`(물러날 때 사기 보존 ‰). 끝 문턱은 `P.realm.tac*` 읽기.
6. **시험**: 더하는 것 `combat.test.ts`·`end.test.ts`·`parity.test.ts`. 지킬 것: F1a 의 결정론·순수성(전투가 들어와도 같은 씨앗 같은 해시) · `npm test` 전부.
7. **합격선(하나)**: **임시 AI 끼리 1,000판이 같은 씨앗에서 같은 결과(해시)**(30 F1). **함께 재서 보고하는 숫자**(카드를 막지는 않는다): 한 판 시간 중앙값(30 §6 의 목표 ≤ 30ms · 못 맞추면 숫자를 정직하게 적고 손잡이를 어떻게 돌렸는지 적는다 · 선을 올리지 않는다)·p95·끝 까닭 분포.
   - 재는 명령: `node --experimental-strip-types tools/field-bench.ts --n 1000 --bodies 38` (출력: 중앙값 · p95 · 최대 · 해시 일치 · 끝 까닭 분포)
8. **규모**: **큼**(3~5일 · F1 전체 4~5일 중 뒤쪽). 26 §6 이 F1 에 +1(엔진 수학 읽기)을 더했다. 못 끝내면 a/b 가 이미 쪼개져 있으니 **b 를 「규칙(1~3)」과 「벤치·시간 맞추기(7~8)」로 한 번 더** 쪼갠다.
9. **앞**: F1a. **나란히**: P2 · F3a 는 F1b 가 끝난 **뒤**(F3a 는 `FieldState` 모양만 알면 되어 F1a 끝에 시작해도 되지만 `sim.ts` 를 안 고치므로 안전 · 코디네이터 판단). **뒤**: F2a(sim.ts 를 이어 고침).
10. **함정**: (1) **30ms 는 장난감 6.6ms 의 2~4배 자리에서 아슬아슬하다**(26 §3-9) — 재목표를 `retargetEvery` 로 늘리거나 `nearKeep` 을 줄이되 **선을 올리지 않는다**. (2) 기능이 늘 때마다 `field-bench` 를 다시 돌려 숫자를 보고에 쌓는다(「몸 늘면 비선형」 26 §8). (3) 복제 수학이 본편과 표류한다(26 §1-1) — 방향 시험 + 머리 주석. (4) `end` 가 너무 늦게 나면 문턱 4(지는 첫 판 90초) 가 깨진다 — 사기 문턱 값은 본편 것을 읽는다. (5) `P.realm.tac*` 는 노브라 `P` 에서 읽어야 한다(구조 분해 금지 · `params.ts` 의 경고 [확인]).
11. **끝났다는 것**: 커밋 · 보고에 **중앙값·p95·최대 ms · 끝 까닭 분포 · 사람 수 세 크기의 시간 · 방향 시험 결과 · 줄이거나 늘린 손잡이**.

---

### F2a · 맵 자료 꼴 · 조각 셋 · mapFor
1. **목적**: 맵 문법 한 꼴(`FieldMap`·`Piece`·시작 자리)과 **대로 · 개울 · 목책** 세 장 + 기습 시작 자리 + `mapFor()` 초안이 서고 sim 이 그 맵에서 돈다. (규칙 효과는 F2b.)
2. **먼저 읽을 파일**: `30 §3` 표 · `22 §2` 자료 꼴 · `21 §2·§6` · `src/raid/palisade.ts`(마디·문 틀 — **복사 대상** · `giant-core.ts` 한 줄 의존이 있다 [확인 26 §4]) · `src/raid/props.ts:14-70`(고체 캡슐 `Solid`·`pushOutOfSolids`) · `src/realm/season.ts:1534-1584`(기습 굴림·밤) · `:1349`(`fieldBattles`) · `:227`(`fortMul`) · `tests/realm/ambush.test.ts` · F1a·F1b 의 `types.ts`·`sim.ts`.
3. **만들/고칠/금지**
   - 만들: `src/field/map.ts` · `src/field/stake.ts`(열전 `palisade.ts` 복사 · 열전 타입·`giant-core` 제거) · `src/field/solids.ts`(열전 `props.ts` 의 `Solid`·`pushOutOfSolids` 복사) · `tests/field/map.test.ts`.
   - 고칠: `src/field/types.ts`(`Ground`·`FieldMap`·`Piece`·`Camp`) · `src/field/sim.ts`(땅 조회 O(1) · `막힘`/`깊은 물` 못 걸음 · 마디 충돌 — **F1b 뒤** 이 카드만) · `P.field`.
   - 금지: 열전 파일(복사만) · `wide.ts` 의 3×3 `WORLD` 상수(**안 쓴다** · 22 §2 [확인]).
4. **할 일**
   1. `types.ts`: `Ground = 0 평지 | 1 얕은 물 | 2 깊은 물 | 3 막힘`(22 §2 에서 숲(4)은 뺀다 · F 단계에 숲 규칙이 없다) · `FieldMap { v:1; u; w; cells: Uint8Array; camps: [Camp, Camp]; pieces: readonly Piece[]; rule: 'meet'|'ambush'|'siege'|'cross'|'naval' }`(`spots` 는 비움) · `Camp { u; v; face: 1|-1; spread; asleep?: number }` · `Piece { id; kind: 'stake'|'gate'|'moat'|'bridge'; u0;v0;u1;v1; hp; owner: 0|1 }`(`wall`·`ship` 은 넓히기 때 더함 · 지금 만들지 않는다).
   2. `meet`(대로에서 만남): 160×40 평지 · 두 진영 양 끝 · 가운데서 부딪힘.
   3. `cross`(개울): 띠 가운데에 폭 `streamWidthCells` 의 `얕은 물` 칸 전체 + 여울(평지) `fordCells` 칸 몇 개. 물 칸은 걸음 느림(규칙 값은 F2b).
   4. `stake`(목책): 지키는 쪽 앞에 마디 줄 + 문 · `Piece{kind:'stake'|'gate', hp}` 는 `stakeHp`·`gateHp` · 열전 마디 구조(`WallPiece` kind `w|o|g`)에서 **마디·문·부수기 자료만** 복사.
   5. `ambush` 시작 자리: 치는 쪽이 적 옆구리(`v` 가장자리)에서 시작 · 먹혔으면 지키는 쪽 `Camp.asleep = asleepTicks` · 들켰으면 0. **기습 굴림은 시나리오 입력**(season 의 굴림을 여기서 다시 하지 않는다 · 22 §2).
   6. `mapFor(meta)`: `meta = { edgeKind, nodeKind, tags: {palisade, moat, earthwall, highland}, approach, ambush: 'none'|'success'|'fail', water, field }`(22 §2 · `season.ts` `fight()` 가 이미 가진 값) → `FieldMap`. 본편 연결은 L2 이므로 F 에서는 시나리오가 손으로 `meta` 를 만든다. 해자(`moat`)·수상(`naval`)·공성(`siege`) 분기는 **`throw new Error('아직 짓지 않음')` 이 아니라 `meet` 로 떨어지지 말고** `null` 을 돌려 호출자가 모르는 줄 알게 한다(27 이 짚은 「그림만 있고 지어진 줄 안다」를 막는다).
   7. `map.test.ts`: 세 맵과 기습 프리셋이 `createField` 로 서고 `hashField` 가 결정론 · `cells` 가 해시에 들어간다 · `mapFor` 가 지어지지 않은 낱말에 `null`.
5. **params**: `mapUCells` 160 · `mapVCells` 40(22 §2 기본 160×40 · 접근 시간을 F2b 가 재서 줄인다) · `streamWidthCells` 6 · `fordCells` 4 · `stakeHp`·`gateHp`(시작값 · F2b 가 방향으로 조임 · `fortMul`(`season.ts:227`) 환산 근거는 L2 에서) · `asleepTicks` 40(22 §2 의 40틱 = 4초).
6. **시험**: 더하는 것 `map.test.ts`. 지킬 것: F1a·F1b 시험 전부.
7. **합격선(하나)**: **세 맵과 기습 프리셋이 AI 대 AI 에서 끝까지 돌고 같은 씨앗 두 번 같은 해시.** (30 의 「첫 접촉 ≤ 20초」·「승률 방향」은 F2b 의 합격선.)
   - 재는 명령: `node --experimental-strip-types tools/field-bench.ts --map meet,cross,stake,ambush --n 300 --contact`
8. **규모**: **중간**(1.5~2일). F2 전체 큼(30) = a + b.
9. **앞**: F1b. **나란히**: F3a(파일 안 겹침 · 둘 다 `P.field`·`ko.ts` 는 커밋 순간 규칙). **뒤**: F2b.
10. **함정**: `Uint8Array` 를 `JSON.stringify` 하면 `{"0":..}` 로 부푼다(26 §1-22-3) — 해시·기록은 `cells` 를 직접 훑어 fnv 에(JSON 을 안 거친다) · `palisade.ts` 의 `giant-core` import 를 **끌고 오지 않는다**(26 §4) · 열전 것은 건드리지 않아야 옛 기록이 불변 · 27 의 「그림만 있는 것을 구현된 것으로 읽는」 문제 → 낱말 표(30 §3)에서 「첫 조각」 넷 외에는 `null`.
11. **끝났다는 것**: 커밋 · 보고에 **맵 네 장의 크기·첫 접촉 시각 표(F2b 가 쓸 기준)·해시 일치 · 복사한 열전 파일 원본 경로**.

### F2b · 맵 규칙 (개울 · 목책 · 기습이 결과를 바꾼다)
1. **목적**: 개울·목책·기습이 **그림이 아니라 진짜 규칙**으로 결과를 바꾼다(건너는 쪽이 느리고 약하다 · 목책 마디를 부수면 길이 열린다 · 먹힌 기습은 지키는 쪽이 잠든 채 시작). 접근 시간이 20초 안으로 맞는다.
2. **먼저 읽을 파일**: 30 §3(표의 「받는 꼴」 열) · 27 §2(숨은 바꿈) · F2a 결과 · `src/realm/season.ts:1534-1584`(기습이 지금 숫자로 무엇을 바꾸나) · `tests/realm/ambush.test.ts` · `tools/realm-tactics.ts`(승률 표 틀).
3. **만들/고칠/금지**: 고칠: `src/field/sim.ts`·`combat.ts`(걸음 느림 · 약함 · 마디 hp · `asleep`) · `P.field` · `tools/field-bench.ts`(`--map` · `--contact` · `--winrate` 인자) · 만들: `tests/field/rules-map.test.ts`. 금지: 본편.
4. **할 일**
   1. 물 칸에서 걸음 속도 `waterSpeedPermille`(‰) · 건너는 쪽이 공격 약함 `crossAtkPermille`. 「건너는 쪽」은 물 칸 안에 있는 몸(양쪽 다 느려지되 **지키는 쪽은 물 밖에서 서서 치니** 유리가 된다는 것이 승률 방향 시험의 핵심).
   2. 목책: 마디 `hp` 가 0 이면 그 마디가 사라져 길이 열린다 · 마디는 보이는 값이고 `fortMul` 배수를 **이중으로 세지 않는다**(22 §6 · 배수는 L2 에서 마디 hp 로 환산) · 지키는 쪽 사기 바닥 `P.realm.tacWallFloor`(:3772) 읽기 여부는 [의견]: F 에서는 쓰지 않고 L2 에서 정한다(적는다).
   3. 기습: `asleepTicks` 동안 지키는 쪽 대는 움직이지 않고 맞으면 풀린다(첫 칼이 센 효과는 `edgeMul`).
   4. **접근 시각**: AI 대 AI 에서 첫 접촉(양쪽 몸이 사거리 안에 처음 든 틱)을 재고 `meet`·`cross`·`stake` 모두 ≤ 20초(200틱)가 되도록 **시작 거리**(`campGapCells`)를 조인다.
   5. 승률 방향 시험(`rules-map.test.ts`): 같은 병력 · 같은 정책 · 씨앗 300 에서 (가) 개울 vs 대로: 건너는 편 승률이 내려간다 (나) 목책 vs 대로: 지키는 편 승률이 올라간다 (다) 먹힌 기습 vs 기습 없음: 치는 편 승률이 ≥ +5%p(21 §8 F2 합격선 값 [옮김]). 방향만 · 크기 선은 위 숫자 하나.
5. **params**: `waterSpeedPermille` 500 · `crossAtkPermille` 850 · `edgeMulPermille`(기습 첫 칼) 1300 · `campGapCells` 120(시작값 · 접근 20초에서 역산) · 위 시작값은 모두 [의견 · F2b 가 `field-bench --winrate` 로 조인다].
6. **시험**: `tests/field/rules-map.test.ts`. 지킬 것: F1a·F1b·F2a 전부.
7. **합격선(하나)**: **임시 AI 끼리 각 500판에서 대로 대비 승률이 개울(건너는 쪽 −)·목책(지키는 쪽 +)·기습(치는 쪽 +)으로 각각 5%p 이상 움직인다**(30 F2). **함께 재서 보고만 하는 숫자**: 세 맵의 첫 접촉 시각(목표 ≤ 20초 · 못 맞추면 시작 거리를 줄이되 그래도 안 되면 숫자를 적는다).
   - 재는 명령: `node --experimental-strip-types tools/field-bench.ts --map meet,cross,stake,ambush --n 500 --contact --winrate`
   - 거점(30 §2): **목책 문과 진영이 무너지면 그쪽 사기가 크게 깎인다** — `gateBreakMoraleLoss`·`campBreakMoraleLoss` 를 `P.field` 에 두고(시작값 · 사기 ‰ · [의견]) 마디 hp 0 이벤트에서 `morale.ts` 가 깎는다. 시험: 목책 문을 깬 편이 안 깬 편보다 상대 사기가 더 내려간다(방향).
8. **규모**: **중간**. 방향이 안 나오면 **opus 로 승격**(B-3 표).
9. **앞**: F2a. **나란히**: F3b(파일 안 겹침). **뒤**: F4a.
10. **함정**: 27 §2(그림만 있는 개울) · 26 이 짚은 `water`·`ram` ×1.5 가 `season.ts:1612` 에 없다는 것(25 §2 [옮김]) — 수상 배수를 여기서 만들지 않는다 · 시작 거리를 줄이면 첫 접촉은 맞아도 「대로」가 좁아져 상성 시험이 깨질 수 있다 · 승률은 병력비 1.0 에서만 재지 말고(방향이 약해진다) 0.8·1.0·1.25 세 곳.
11. **끝났다는 것**: 커밋 · 보고에 **세 맵 첫 접촉 틱 · 방향 세 줄의 승률(전→후) · 조인 손잡이**.

---

### F3a · field.html · 루프 · 카메라 · 바닥과 대의 낱낱 점
1. **목적**: `field.html` 이 서고 시나리오 한 판이 폰 네 폭에서 보인다 — 바닥 · 조각 · 대의 낱낱 점 · 카메라 · 고정 걸음 루프(숨은 탭 규칙). 끝나면 눈으로 걸어 다니는 점들을 본다(화면 확인은 브라우저).
2. **먼저 읽을 파일**: `30 §3·§8` · `22 §7`(그림 · 폰 그리기) · `26 §1-5·§4`(카메라가 1120×720 상수에 묶임 · 「그대로」가 아님) · `src/raid/camera.ts`(82줄 · 복사 대상 · `:9` 이 `HAEBI_RUN`·`HAEBI_ZOOM`·`HAEBI_WIDE` 와 `BOARD`·`WORLD` 를 import [확인]) · `src/raid/wide-view.ts`(`inView` · `drawWideGround` · `edgeArrows` 틀) · `src/night-main.ts`(별도 진입점 모양) · `night.html` · `raid.html` · `vite.config.ts:53`(input 목록) · `src/ui/realm/quality.ts`(`Tier` low/mid/high · `quality()`) · `public/realm/anim2/`(병사 띠 20컷 · **서기 0~3 · 걷기 4~11 · 공격 12~17 · 맞음 18 · 쓰러짐 19** [확인 `battlefield.ts:2405`]) · `src/ui/realm/map-unit.ts:13`(띠 주소 `anim2/<key>.png` 와 `ar`·`r` 계산).
3. **만들/고칠/금지**
   - 만들: `field.html`(`raid.html` 꼴 한 페이지: viewport meta · `<div id="field">` · `<script type="module" src="/src/field-main.ts">`) · `src/field-main.ts` · `src/field/loop.ts`(고정 걸음 누적 · 숨은 탭) · `src/field/camera.ts`(열전 복사 + `Viewport{w,h}` 인자) · `src/field/view.ts`(그리기) · `src/field/dots.ts`(대 → 낱낱 점 배치 · 렌더 전용 해시) · `tests/field/loop.test.ts` · `tests/field/dots.test.ts` · `tests/field/view-readonly.test.ts`.
   - 고칠: `vite.config.ts:53` `rollupOptions.input` 에 `field: 'field.html'` 한 줄(공유 파일 규칙) · `P.field`(그리기 값).
   - 금지: 열전 `camera.ts` 자체 고치기 · `wide.ts` 의 3×3 `WORLD`(안 쓴다).
4. **할 일**
   1. `vite.config.ts` input 한 줄 · `field.html` 최소 · `src/field-main.ts` 에서 `startGfxSafe()`·`guardMedia()` 를 `night-main.ts:35-45` 처럼 부른다.
   2. `loop.ts`: 순수 함수 `advance(acc, dtMs, hz, maxCatchUp): { ticks, acc }`(화면 틀이 몰아 돌리지 않게 상한) + `visibilitychange` 에서 멈춤/재개(재개 때 누적을 0 으로). **rAF 는 `document.hidden` 이면 예약하지 않는다**(절대 규칙 4 · `night-main.ts:488·562-567` 본받음). 시험(`loop.test.ts`): 큰 `dt`(탭 복귀) 가 들어와도 `ticks ≤ maxCatchUp`.
   3. `camera.ts`: 열전 `clampCenter`·`followCam`·`toField`·`fieldView` 를 복사하되 `HAEBI_RUN` 의 `width/height`·`HAEBI_ZOOM.levels`·`HAEBI_WIDE` 상수 의존을 **인자**(`Viewport`·`bounds`·`zoomLevels`)로 바꾼다. 맵은 **가로 띠로 고정**(sim `u` = 가로). 폰 세로 화면에서는 맵 높이(`mapVCells`)가 화면 높이의 한 칸 영역에 들도록 확대율을 정한다(가로 띠를 눕혀 놓는다 · 30 이 폰 방향을 안 정했다 → D 의 8번).
   4. `view.ts`: 바닥(`FieldMap.cells` 으로 평지/물 · 있는 그림: 본편 `town/ground-field-*`·`ground-water-*`·열전 `raid/ground-*.webp` 중 고른다 — 파일 이름은 `ls public/realm/town public/raid` 로 **확인**) · 조각(목책·문: `fx/field/` 의 말뚝·목책·성문 28 파일 [옮김 03]) · 대의 낱낱 점: 병사 띠 `anim2/<kind>.png` 의 서기·걷기·공격 칸을 틱으로 고른다(`kind` 열쇠 · `map-unit.ts:13` 의 `ar` 계산 참고).
   5. `dots.ts`: 대마다 점 수 = `clamp(round(men / menPerDotRef), dotsPerSquadMin, dotsPerSquadMax)` 이고 **편 합이 `dotsPerSide`(160) 넘으면 비례로 줄인다**(30 §6 · 26 §3-11: 「10명 = 점 1」 읽기는 규모에 따라 깨지므로 포기). 점의 대 안 오프셋은 `hash(squadId, k)`(sim 난수와 분리 · sim 상태에 안 넣는다).
   6. 틱 보간: 그리는 위치는 직전 틱과 지금 틱 사이를 `alpha` 로 섞는다(render 만).
   7. 저사양: `quality()`(`low`)이면 점 수 절반 · 그림자 생략(`fieldLowGraphics` 틀 · `raid-main.ts:444` 의 `raidLowGraphics()` 는 열전용이라 **같은 이름을 만들지 말고** 본편 `quality.ts` 의 `Tier` 를 읽는다).
   8. `view-readonly.test.ts`: `view.ts`·`dots.ts`·`camera.ts` 글자에서 `state.`·`s.` 로의 대입(`=`·`++`·`push(`)이 sim 상태 객체에 0 인지 훑는다 [의견 · 완전하지 않으니 한 줄 주석으로 한계를 적는다].
   9. 브라우저로 본다(A-6): `npx vite --port 5174` → `http://localhost:5174/field.html?scenario=meet` → 탭이 보이는지 → 스크린샷 → 네 폭 `phone-shot`. **탭이 hidden 이면 「화면은 못 봤다」**.
   10. `npm run build` 로 `field.html` 이 번들에 들어가는지 · `tools/budget.ts` 가 걸리는지 확인(`tactics.ts` import 가 번들을 얼마나 키우는지 한 줄 적는다).
5. **params**: `dotsPerSide` 160(30 §6) · `dotsPerSquadMin` 3 · `dotsPerSquadMax` 16 · `menPerDotRef` 40 · `maxCatchUpTicks` 4(한 프레임에 몰아 돌릴 틱 상한) · `camFollowRate`·`zoomLevels`(열전 `HAEBI_ZOOM` 값 참고하되 새로 둔다) · `lowDotsShare` 500(‰ · 저사양에서 점 몫).
6. **시험**: `loop.test.ts` · `dots.test.ts`(편 합 ≤ 160 · 같은 `hash` = 같은 오프셋) · `view-readonly.test.ts`. 지킬 것: 위 시험 전부 + `tests/raid-golden.test.ts`(열전 불변).
7. **합격선(하나)**: **폰 네 폭(360·375·390·412)에서 `field.html` 이 넘침 0 으로 뜬다**(`phone-shot` 의 「넘친 칸」 0).
   - 재는 명령: `for w in 360 375 390 412; do node --experimental-strip-types tools/phone-shot.ts tools/out/f3a/shot-$w.png - $w 844 http://localhost:5174/field.html; done`
   - (30 F3 합격선의 「30프레임」은 F3b.)
8. **규모**: **큼**(3~5일 중 a = 약 3일 · 카메라 상수 풀기 +1 · 26 §6 재셈). 쪼갠 선: a = 화면이 서고 점이 걷는다, b = 편 색·군기·진영·투사체·프레임 합격.
9. **앞**: F1b(또는 F1a 끝 `FieldState` 모양만으로도 시작 가능 · 코디네이터 판단). **나란히**: F2a · F2b(파일 안 겹침). **뒤**: F3b.
10. **함정**: (1) 열전 `camera.ts` 는 판 상태를 모르지만 1120×720·`Z`·`C.speed` 에 박혀 있다(26 §1-5) — 「그대로」 복사가 아니다. (2) `wide.ts` 의 3×3 정사각 `WORLD`(`:16-18`) 에 끌려 들어가지 않는다. (3) 캔버스는 hidden 탭에서 안 그려진다(A-6). (4) 열전 `tintStrip`(`haebi-view.ts:100`)은 비공개이고 편 색 입히기가 아니라 실루엣 테두리 빛이라 복사하지 않는다 — F3b 가 작은 새 함수를 쓴다. (5) 폰은 부드러운 그러데이션·넓은 `filter` 애니가 느리다(`mobile-gpu-layer-limit`) — 캔버스에서 그린 것은 괜찮지만 DOM 위에 `filter` 를 얹지 않는다. (6) `tactics.ts` import 가 번들을 키운다(F1a 함정 참고).
11. **끝났다는 것**: 커밋(파일 목록) · 보고에 **네 폭 스크린샷 경로 · 넘침 0 · 점 수 · 번들 증가 · 「화면을 직접 봤다/못 봤다」**. 되돌림에 `vite.config.ts` 한 줄.

### F3b · 편 색 · 군기 · 진영 · 투사체 · 폰 프레임
1. **목적**: 두 편이 한눈에 갈리고(편 색 · 군기 · 막사 임시 도형) 화살이 날며, 편당 160점에서 폰 30프레임을 낸다.
2. **먼저 읽을 파일**: F3a 결과 · `30 §8`(새로 필요한 것은 임시 도형으로 · G1 뒤 주문) · `src/raid/haebi-view.ts:98-110`(`tintStrip` — **비공개이고 실루엣 테두리 빛을 내는 함수라 편 색 입히기와 다른 일이다 [30 §8·§13] · 복사하지 않는다**. 모양만 참고) · `tools/field-perf.ts`(P3 가 만든 틀) · `tools/raid-fps-probe.ts`(재는 법) · `public/realm/fx/arrow.png`·`fx/field/` · `src/ui/realm/mapview.ts:1001`(`MY_LAND`) · 메모리 규칙: 일장기·닌자 금지(A-1).
3. **만들/고칠/금지**: 만들: `src/field/tint.ts`(**작은 새 함수** `teamTint(src, w, h, color)` · 띠 한 장을 편 색으로 물들인 오프스크린 캔버스를 `WeakMap` 캐시로 · 열전 코드 0 줄 복사) · `src/field/banner.ts`(군기·막사 **코드 도형**) · `src/field/shots.ts`(화살 · 렌더 전용 파티클 — 낱낱 점으로) · `tests/field/banner.test.ts`(금칙 색 검사). 고칠: `src/field/view.ts` · `P.field`. 금지: 새 그림 파일 추가(Codex 주문은 G1 뒤) · 열전 `haebi-view.ts`.
4. **할 일**: (1) `tint.ts` 새로 쓰기: `teamTint` 가 `multiply`/`source-atop` 로 몸 색을 살짝 물들이고 윤곽이 뭉개지지 않게 한다 · **쓸 병종 띠마다 편 색이 갈려 보이는지 확인한다**(32 §5 가 짚은 「어떤 띠가 색 입히기를 받는지」: `anim2/` 의 `spear shield bow crossbow pike horse boat marine axe militia` 와 `gen-*` 장수 몇 종을 한 장에 나란히 그려 스크린샷 · 안 갈리는 띠는 목록으로 보고 · 물들이지 않고 발 밑 고리 색으로 가른다) · 편 색 둘은 `P.field` 에 둔다(우리 = `MY_LAND` 파랑 계열 · 적 = 파랑과 겹치지 않는 **붉은 갈색/주황 계열, 원 도형 없이**). (2) `banner.ts`: 무리 군기 = 세로 막대 + 펄럭 4칸(코드로 사인 대신 정수 오프셋 표) · 줄무늬/세모끝 · **원 금지** · 진영(막사) = 삼각 천막 도형 · 다리 = 판자 도형. (3) `banner.test.ts`: 군기 그리기 함수가 호출하는 `arc(` 이 0 이고(원 금지의 가장 거친 검사) 색 목록에 순수 붉은 `#f00` 계열 + 흰 바탕 조합이 없다 — 완전하지 않으니 사람이 스크린샷으로 본다고 주석. (4) 화살: 활 대의 공격 틱에 `shots.ts` 가 점 몇 개로 날린다(낱낱 점 · 통짜 그림 금지 · 「이펙트는 낱낱이」). (5) 금빛 새 병사 테두리(`Squad.fresh` 몫 점에 `P.field.freshRim` 색 · 값은 F8a 의 시나리오가 넣는다). (6) **그리기 한 장 재기**: `field-main.ts` 에 `?bench=draw&n=300` 갈래(위 7번) · `tools/field-perf.ts` 로 CPU 1×·4× 두 번(편당 160점 시나리오 `scenario=big`) · 저사양이면 점 수 절반. rAF 간격도 같이 남긴다. (7) 눈으로 본다(A-6).
5. **params**: `colorMine`·`colorFoe`(편 색) · `freshRim` · `bannerWaveTicks` 4 · `shotDots` 4 · `shotLifeTicks` 6.
6. **시험**: `banner.test.ts`. 지킬 것: F3a 시험.
7. **합격선(하나)**: **편당 160점에서 그리기 한 장 ≤ 8ms**(헤드리스 크롬 캔버스 재기 · 30 F3 · 4× CPU 느리게도 같이 재서 보고). **함께 남기는 것**(카드를 막지 않는다): 폰 네 폭 스크린샷 · rAF 간격 중앙값·50ms 초과 비율.
   - 한 장 재기 방식: `field.html?scenario=big&bench=draw&n=300` 이면 `field-main.ts` 가 고정 상태에서 `drawFrame` 을 300번 부르고 `performance.now` 차의 중앙값·p95 를 `document.title` 과 콘솔에 남긴다(`performance.now` 는 화면 쪽이라 괜찮다 · sim 에는 안 들어간다). `tools/field-perf.ts` 가 CDP 로 그 값을 읽는다(P3 의 틀).
   - 재는 명령: `node --experimental-strip-types tools/field-perf.ts "http://localhost:5174/field.html?scenario=big&bench=draw&n=300" 10 1` 그리고 `... 10 4`(CPU 4× 느리게)
8. **규모**: **중간**(1.5~2일). 
9. **앞**: F3a. **나란히**: F2b. **뒤**: F5a. **시간을 재므로 다른 무거운 일과 안 겹침(B-2-2).**
10. **함정**: 임시 도형이 **원이면 일장기 결** — 반드시 금지 검사 · 편 색이 파랑/빨강만이면 색약에 약하다 → 윤곽선 모양(깃 모양)으로도 갈린다 · 폰 실기는 헤드리스 4× 와 다르다(실기 1대는 형 폰으로 G1 에서 · 못 잰 것으로 적는다) · 편당 160점을 넘기는 시나리오가 합격선을 가리지 않게 `scenario=big` 이 정확히 160 인지 시험 · 낱낱 점에 `filter`/그림자 너무 많이.
11. **끝났다는 것**: 커밋 · 보고에 **rAF 중앙값·50ms 초과 %·점 수·`gfx` 단계 · 스크린샷 · 못 본 것(실기 폰)**.

---

### F4a · 장수 규칙 (sim 안에 박는다)
1. **목적**: 장수 한 명이 sim 안에서 움직이고(자동 공격 · 비기 하나) **뛰어든 곳만 버티고 다른 곳은 사기가 샌다 · 쓰러져도 안 죽고 몇 초 못 움직인다**는 규칙(30 §6 의 1·2)이 **엔진 안에** 박힌다.
2. **먼저 읽을 파일**: `30 §6`(규칙 셋 · 합격선) · `21 §5`(장수 상한 12% · 한 곳만 · 쓰러짐 6초 — **시작값 출처**) · `22 §4-3` · `src/realm/battle.ts`·`tactics.ts:105`(`SideHero { mu, ryak, ... }`) · `docs/realm/HERO-GROWTH.md`(장수 안 죽음 · 메모리 `player-heroes-never-die`) · F1b·F2b 결과.
3. **만들/고칠/금지**: 만들: `src/field/hero.ts` · `tests/field/hero.test.ts`. 고칠: `src/field/sim.ts`·`types.ts`·`combat.ts`·`morale.ts` · `P.field`. 금지: 본편 파일. **`fell`/`taken` 등 본편 결과 칸을 sim 이 만들지 않는다**(우리 장수는 싸움으로 안 죽는다 · 사로잡기는 적장에게만 · 22 §5 「우리 장수」).
4. **할 일**
   1. `Hero { side; u; v; hp; hpMax; stun; stance; engaged: number /* 지금 곁의 대 id 또는 -1 */; skillCd; skillOn }`.
   2. 자동 공격: 사거리(`heroRangeCells`) 안 가장 가까운 적 몸(대 또는 적장)을 틱마다 친다(정수 `dmg = heroPower × ...`). 이동은 입력 `g=3`(장수) + 목적지(`u,v`)로(스틱·키보드는 F4b 가 목적지로 바꿔 보낸다 · 입력 하나 = 「이쪽으로」).
   3. **규칙 1**: 장수 hp 0 → `stun = heroStunTicks`(못 움직임 · 공격 안 함) 뒤 같은 자리에서 일어남(hp 회복) — **죽음·포로 없음**. 적장은 같은 규칙인데 **패배 쪽 사기가 문턱 아래일 때 사로잡힘 후보**(실제 사로잡기 판정은 L 에서 본편으로 · F 에서는 `captureChance` 표시만).
   4. **규칙 2**: 장수가 곁에 있는 대(`engaged`)는 방침 보너스(`heroBonusPermille`)와 사기 샘 없음, 곁에 없는 대는 `leakPerTime`(때마다 사기 감소 · 21 시작값 0.02)씩 샌다. 「곁」 정의 = 거리 ≤ `heroAuraCells`.
   5. 비기 하나: 단추 한 번 → `skillRadiusCells` 안 적 대에 피해 + 잠깐 기절(`skillStunTicks`) · 쿨 `skillCoolTicks`. 모양(열전 비기 한 컷 재사용)은 F4b 가 그린다.
   6. 적장 만남 이벤트: 양쪽 장수가 `meetCells` 안이면 `log.events` 에 `meet`(틱) 기록(겨루기 연결은 L2 · 30 F4).
   7. `hero.test.ts`: (가) 장수가 A 대 곁에 있을 때 A 의 사기 하락이 없을 때보다 작다 · 다른 대는 더 샌다(씨앗 300 방향 **100%**) (나) 장수가 쓰러져도 `heroes[i]` 가 사라지지 않고 `end` 가 장수 때문에 나지 않는다 (다) 같은 씨앗 결정론.
5. **params**(시작값 [의견 · 출처]): `heroSpeedCellsPerSec` 5 · `heroRangeCells` 3 · `heroPowerPermille` 1000(조임 손잡이 · F7 에서 내린다) · `heroHp` 600 · `heroStunTicks` 50(5초 · 22 §4-3 · 21 은 6초) · `heroAuraCells` 6 · `heroBonusPermille` 1150 · `leakPermillePerTime` 20(21 §5 의 0.02) · `skillCoolTicks` 300 · `skillRadiusCells` 5 · `skillStunTicks` 30 · `meetCells` 4.
6. **시험**: `hero.test.ts`. 지킬 것: F1~F2 전부(장수가 없는 시나리오가 전과 같은 해시 — 장수는 `null` 가능).
7. **합격선(하나)**: **임시 AI 판에 「장수를 왼쪽 무리에 붙인 입력 줄」을 넣으면 왼쪽 무리가 오른쪽 무리보다 오래 버틴다**(500판 가운데 값 · 30 F4). 「오래 버팀」 = 그 무리의 사기가 문턱 아래로 처음 내려간 틱(안 내려갔으면 판 끝 틱)의 중앙값, 또는 판 끝에 남은 사람 몫(둘 다 보고 · 세는 법은 시험 머리에 하나로 못 박는다). 봇은 쓰지 않는다(F7 은 뒤 카드). 곁에 있는 대의 사기 하락이 없을 때의 80% 이하인지는 **함께 재는 숫자**.
   - 재는 명령: `node --test --experimental-strip-types tests/field/hero.test.ts`
8. **규모**: **중간~큼 아래**(2~3일). 30 은 F4 를 큼으로 보았고 a(규칙 · 2일)와 b(입력·그림 · 1.5일)로 쪼갰다.
9. **앞**: F2b(`sim.ts` 를 이어서). **나란히**: F3b · F5a(V 줄). **뒤**: F6.
10. **함정**: 장수가 너무 세면 손재주가 수를 덮는다(F7 합격선) → `heroPowerPermille` 가 조임 손잡이 · 쓰러짐을 죽음으로 만들면 형 11-03 「황당」 규칙 위반(21 §6 · 27 §3-4) · 규칙 2 를 끝에 자르는 식으로 하지 않는다(30 §6 「엔진 안에 박는다 · 끝에 자르지 않는다」) · `leakPermillePerTime` 이 커서 장수 없는 판이 항상 지면 「장수가 필수」가 된다(F7 의 「가만 봇」 판이 이 선을 본다).
11. **끝났다는 것**: 커밋 · 보고에 **사기 하락 비(곁/바깥) · 방향 300/300 · 장수 없는 시나리오 해시 불변**.

### F4b · 장수 입력과 그림
1. **목적**: 폰 가상 스틱 · PC WASD · 비기 단추로 장수를 움직이고, 장수 띠 그림과 쓰러짐·만남 표시가 화면에 선다.
2. **먼저 읽을 파일**: `30 §4`(폰에서는 한 번에 한 손 · 깃발과 스틱을 동시에 안 쓴다) · `src/raid-main.ts:641-680`(스틱 — **모듈 최상위 스크립트라 import 불가 · 다시 쓴다** [옮김 26 §1-5]) · `src/tune/params.ts:160`(`HAEBI_STICK { radius: 54, dead: 7, ... }` 값 참고) · `src/ui/realm/battlefield.ts:2405`(장수 띠 20컷 구성) · `public/realm/anim2/gen-*.png` · F4a·F5a 결과 · 메모리 `mobile-layout-check`.
3. **만들/고칠/금지**: 만들: `src/field/stick.ts`(가상 스틱 · 터치/포인터 · 순수 계산은 `stickDir(dx,dy,radius,dead)`) · `src/field/keys.ts`(WASD · Q/E 비기 · 시간 느리게 Shift) · `src/field/hero-view.ts`(그림) · `tests/field/stick.test.ts`. 고칠: `src/field-main.ts`(입력 연결 줄 · F5a 뒤) · `P.field`(스틱 값). 금지: `raid-main.ts` 의 스틱 코드 수정.
4. **할 일**: (1) 스틱 방향 → 목적지 변환: 스틱 방향·세기로 장수 앞 `heroStepCells` 칸 지점을 `FieldInput{g:3, op:'move', u, v}` 로 보낸다(**sim 은 목적지만 안다** · 입력 예산 `inputPerGroupPerTime` 이 스틱 한 번 한 번에 걸리지 않게 「이동」은 예산 밖 특수 입력으로 두는지 정한다 — 22 §3 은 무리당 3개 · 장수는 g=3 이므로 **이동 입력은 예산에서 뺀다**고 정하고 D 에 적는다). (2) 비기 단추: 오른쪽 아래 큰 단추 하나(엄지) · 쿨 표시. (3) 한 손 규칙: 아래 띠의 넷째 칸(장수)을 누르면 **장수 모드**(스틱이 뜨고 깃발 끌기는 잠김) · 다른 칸을 누르면 끝(30 §4). (4) 장수 그림: 시나리오가 지정한 장수의 `anim2/gen-<key>.png` 20컷에서 서기 0~3 · 걷기 4~11 · 공격 12~17 · 맞음 18 · 쓰러짐 19 를 상태로 고른다(칸 구성은 `battlefield.ts:2405` 주석 [확인]). (5) 쓰러짐은 19 칸 + 깜빡임 · 적장 만남은 **코드 도형 표시**(F 에서는 새 그림 없음 · 겨루기 연결은 L2). (6) 네 폭에서 스틱·비기 단추가 겹치지 않는지(`phone-shot` 네 폭 · 손 닿는 영역 ≥ 44px). (7) `hz` 를 20 으로 올려야 입력이 읽히는지 눈으로 · 입력→첫 반응 틱 수를 로그로 센다(F1a params 설명의 「재기」).
5. **params**: `stickRadius` 54 · `stickDead` 7 · `heroStepCells` 6 · `skillBtnPx` 64 · `touchMinPx` 44. 시작값은 열전 `HAEBI_STICK` 값 · [옮김].
6. **시험**: `stick.test.ts`(방향 → 목적지 · 데드존 · 한 손 규칙의 모델 함수). 지킬 것: F4a·F5a 시험.
7. **합격선(하나)**: **네 폭에서 스틱·비기 단추가 겹치지 않고(`phone-shot` 넘침 0) `stick.test.ts` 통과.** (F4 의 카드 합격선은 F4a 의 봇 시험이 본체다 · D 의 2번.)
   - 재는 명령: `node --test --experimental-strip-types tests/field/stick.test.ts` + F3a 의 네 폭 명령.
8. **규모**: **중간**.
9. **앞**: F4a · F5a. **나란히**: F6(S 줄 · 파일 안 겹침). **뒤**: F8a.
10. **함정**: 열전 스틱은 파일 첫 줄부터 화면을 부팅하는 스크립트라 import 하면 열전이 같이 뜬다(26 §1-5) · 터치 끌기와 DOM 핸들러(`pointer` 이벤트)가 겹쳐 가로채기가 첫 사고(26 §5-4 · `cutTap` 배속 단추 사고) · 스틱을 놓는 순간 이동이 끊겨야 한다(누르고 있는 동안만 목적지 갱신) · 폰 가로/세로 전환 시 스틱 위치 · 형 폰은 한 손.
11. **끝났다는 것**: 커밋 · 보고에 **네 폭 스크린샷 · 입력→반응 틱 · 못 본 것(실기 터치 · 화면을 못 봤으면 그 사실)**.

---

### F5a · 깃발 (무리 칸 · 누르기/끌기/길게 · 입력 줄)
1. **목적**: 아래 띠의 **무리 칸 셋 + 장수 칸**을 눌러 맵을 누르면 그 무리가 간다 · 길게 누르면 그 자리에서 버틴다(방진) · 적 쪽으로 끌면 돌격 · 옆으로 비키면 길 트기. 모든 입력이 입력 줄(`rec.ts`)에 남는다.
2. **먼저 읽을 파일**: `30 §4` · `21 §3`(조작 표)·`22 §3` · `src/ui/realm/battlefield.ts:2092`(맡기기 단추 `data-war="auto"` 근처 — 지금 깃발 단추 구조 참고 · 줄은 P2 뒤 어긋남) · `src/realm/types.ts:505-536`(`Cmd` · `RoundOrder` — **깃발 낱말**: 방진=`hold` · 돌격=`charge` · 길 트기=`open` · 활 `volley`·`counter` · 기병 `flank`·`punch`·`pursue`) · 메모리 `confirm-bar-bottom`(완료 단추 하단 붙박이)·`no-scroll-popups`(슬라이드 대신 떴다 사라지는 상자)·`wwe-overreaction-ux`(새 UI 네 가지: 설명·반응·눌린 채·까닭) · `F1a`의 `rec.ts`.
3. **만들/고칠/금지**: 만들: `src/field/input.ts`(포인터 → `FieldInput` 번역 · 순수) · `src/field/flags.ts`(아래 띠 칸 그리기·눌림) · `src/field/pickmodel.ts`(**지금 고를 수 있는 것 목록을 돌려주는 순수 함수** — 시험이 센다) · `tests/field/pickmodel.test.ts` · `tests/field/input.test.ts`. 고칠: `src/field-main.ts` · `P.field` · `ko.ts/en.ts`(`field.` 키). 금지: 본편 `battlefield.ts`.
4. **할 일**: (1) `pickmodel.ts`: `pickables(state, ui): Item[]` — 무리 칸(앞줄 · 활 · 기병 · **그 무리가 있을 때만**) + 장수 칸 + 지금 열린 하위 선택만 센다 → **길이 ≤ 4**가 시험으로 지켜진다(30 의 「한 번에 고를 것 넷 이하」). (2) `input.ts`: 칸 선택 → 맵 누름 = 이동 목적지(`op=move`, `u,v`) · 길게 누름(`holdMs`) = `op=hold`(방진) · 끌어 놓음의 방향이 적 쪽 = `op=charge`, 옆 = `op=open`(번역표 23 §[옮김]: 제자리=방진 · 적 쪽=돌격 · 옆=길 트기) · 번역 결과를 큰 글씨로 한 줄 보인다(「앞줄 돌격」 같은 이름 · 「이대로 전투 개시」 앞에 · 23 접붙임). 그 합에 없는 선택지(적 활 없는데 맞쏘기)는 **무시하고 이유를 한 줄**(`groupOptions` 의 선택지 규칙(`tactics.ts:481`)에 맞춰 예외 처리 · 26 §1-23-3). (3) 입력 줄 기록: `recInput` 은 `rec.ts` 의 직렬화 사용 · 한 판 줄 수 ≤ 80(`realm-savesize` 기준 · 21 §5 [옮김]). (4) 반응: 칸을 누르면 눌린 채(금빛 + ✓) · 못 하는 것은 까닭 한 줄(「활이 없습니다」 존댓말) · 화면 글은 `t('field.…')`. (5) **시작 화면에 「전투 개시」 하단 붙박이 큰 단추**(`confirm-bar-bottom` · 지금은 `field-main.ts` 의 시작 상태) — F8a 가 시작 화면 전체를 짓는다.
5. **params**: `holdMs` 450(길게 누름 · 시작값) · `dragMinPx` 24 · `dragAngleOpenDeg`(옆 판정 각 — **삼각함수 없이** 정수 비교: `|dv| ≥ k·|du|` 꼴 → `dragOpenSlopeNum`·`dragOpenSlopeDen`) · `redirectTicks` 8(같은 무리 다시 끌기 최소 간격 0.8초 · 21 §5 [옮김] · 「손재주 장치」로만) · `pickMax` 4.
6. **시험**: `pickmodel.test.ts`(모든 상태 열 가지 이상에서 `pickables().length ≤ 4`) · `input.test.ts`(번역표 · 길게 · 끌기 · 무시 규칙 · 기록 왕복). 지킬 것: F1a `rec.test.ts`.
7. **합격선(하나)**: **한 번에 고를 것 넷 이하가 지켜진다**(`pickmodel.test.ts` 통과 · 상태 열 가지 이상).
   - 재는 명령: `node --test --experimental-strip-types tests/field/pickmodel.test.ts tests/field/input.test.ts`
8. **규모**: **중간**(F5 는 큼 · a/b 로 쪼갬 · 26 §5-4 가 입력 가로채기를 첫 사고 후보로 짚었다).
9. **앞**: F3a(화면 틀) · F1b(입력 의미). **나란히**: F2·F4a(S 줄). **뒤**: F5b.
10. **함정**: 지금 본편 깃발은 방침(돌격·방진·길 트기 + 땅의 수 29종 아이콘)이고 21·22 가 위치 지정으로 좁혔다(27 §1) — 이 카드는 「**자리를 찍지만 뜻은 방침**」(30 §4) · `delete` 같은 아이콘 줄이지 않는다 · 터치 이벤트(`pointerdown`)가 DOM 단추와 겹쳐 놓친다(26 §5-4) · 길게 누름과 스크롤 제스처 충돌 · 화면 글에 긴 줄표·조사 손붙임 금지 · `Cmd` 낱말과 본편 `types.ts:505` 의 정확한 철자 확인.
11. **끝났다는 것**: 커밋 · 보고에 **상태별 `pickables` 길이 최댓값 · 입력 줄 한 판 길이(바이트) · 네 폭 넘침**.

### F5b · 미니맵 · 때 문 · 느려짐
1. **목적**: 화면 위 **가로 띠 미니맵**(점 = 무리 · 누르면 카메라가 간다) · 30초마다 오는 **때 문**(시간이 느려지고 장수가 뛰어들 곳 · 땅의 수를 고른다) · 손가락을 대는 동안 **0.3배 느려짐**(한 때에 게임 시간 6초까지).
2. **먼저 읽을 파일**: `30 §2·§4` · `22 §3`(미니맵 · 점 ≤ 26 + 마디) · `src/raid/wide-view.ts:100-140`(`edgeArrows` 틀 — 씨앗) · `src/realm/tactics.ts` 의 `Cmd`(불화살 `fire` 가 `specials` · `:51` `Side.specials`) · `src/ui/realm/battlefield.ts:3698` 주변의 `cutTap`(장면이 배속 단추를 삼킨 사고 · 입력 가로채기 주의) · F5a·F4a 결과.
3. **만들/고칠/금지**: 만들: `src/field/mini.ts` · `src/field/gate.ts`(때 문 모델 · 순수) · `src/field/slow.ts`(느려짐 누적 한도) · `tests/field/mini.test.ts` · `tests/field/slow.test.ts` · `tests/field/gate.test.ts`. 고칠: `src/field-main.ts` · `src/field/loop.ts`(배율 인자) · `src/field/sim.ts`(**입력 한 갈래만**: `special: fire`) · `P.field`.
4. **할 일**: (1) 미니맵: `mapUCells` 전체 가로 띠 · 점 ≤ 26(`minimapDotsMax`) + 마디(목책 몫) · 누르면 `followCam` 이동. **적 무리의 자리는 늘 보인다**(30 §4 · 정찰과 무관). **사람 수는 지금 본편 규칙대로**(`ODDS.md`: 남의 것은 범위, 정찰하면 좁혀서 · 30 §13) — 일꾼은 먼저 지금 전장 화면이 적 사람 수를 어떻게 보이는지(`battlefield.ts` 에서 `grep` 하고 브라우저로 본다 · 32 는 이 화면을 못 봤다) 확인해 같은 꼴로 그린다. 못 보면 「안 봤다」 하고 자리 점만 그린다. (2) 때 문: 매 `timeTicks` 경계 직전 `gateTicks`(25~30초 구간) 동안 시간 0.3배 · 장수 한 곳 고르기 + 땅의 수(불화살 하나 · `special` 입력 한 갈래만 sim 에 더한다 — 이 변경은 `sim.ts` 의 `applyInput` 한 함수 안 case 하나이고 F6 와 나란히 돌리지 않는다 · B-2) · 해질녘(마지막 때)은 **진을 친다 / 한 합 더 / 물러난다** 셋(`dusk` · `Dusk` 낱말 = `types.ts` · `tactics.ts` 의 `press`·`camp` 와 맞춘다 [옮김 realm-tactics.ts:60]). (3) 느려짐: 손가락이 닿은 동안 배율 `slowFactor`(0.3) · 한 때에 게임 시간 `slowMaxSec`(6)까지만(모자라면 풀림 · 한 때 지나면 새로 충전). `slow.ts` 는 `tickBudget(dtMs, pressed, usedMs) → { ticks, usedMs }` 순수 함수. (4) 때 문마다 **싸움 상태 저장**(`FieldState` 를 JSON 으로 · 큰 `cells` 는 해시로 빼고 재생성) — 26 §5-1 의 「탭을 닫으면 90초 손실」 대비 · 여기서는 시험장이라 **`hanbal.field.save` 한 키에 마지막 때 문 상태만** 두고 `localStorage.clear()` 는 쓰지 않는다 · 복귀 시 마지막 때 경계에서 이어 간다.
5. **params**: `minimapDotsMax` 26 · `minimapHeightPx` 36 · `gateTicks` 80(8초 · 문 길이 · [의견]) · `slowFactorPermille` 300 · `slowMaxSecPerTime` 6(30 §4) · `fireArrowDmgPermille`(불화살 한 번 피해 · 시작값 [의견]).
6. **시험**: `mini.test.ts`(점 ≤ 26 · 사람 수 늘 보임) · `slow.test.ts`(6초 한도 · 충전) · `gate.test.ts`(문 상태 머신 · 해질녘 셋). 지킬 것: F5a 시험 · F1a 결정론(`special` 입력이 기록·재생에 든다).
7. **합격선(하나)**: **느려짐이 한 때에 게임 시간 6초를 넘지 않고 미니맵 점이 26 이하다**(`slow.test.ts`·`mini.test.ts` 통과). (30 F5 의 「고를 것 넷 이하」 는 F5a 의 합격선.)
   - 재는 명령: `node --test --experimental-strip-types tests/field/slow.test.ts tests/field/mini.test.ts tests/field/gate.test.ts`
8. **규모**: **중간~큼 아래**(2~3일).
9. **앞**: F5a · F4a. **나란히**: 없음(`sim.ts`·`field-main.ts` 겹침). **뒤**: F4b · F8a.
10. **함정**: 느려짐을 `dt` 로 곱하면 sim 이 결정론이 아니다 → **틱 수만 줄인다**(sim 은 모른다 · 22 §3) · 숨은 탭에서 `slow` 누적이 안 풀리면 복귀 때 폭주 → 복귀 시 누적을 0 으로 · 정찰 단계는 F6 이라 여기서는 늘 보이는 것만 · 때 문의 장수 고르기와 스틱 모드가 같은 화면에서 겹친다(한 손 규칙).
11. **끝났다는 것**: 커밋 · 보고에 **6초 한도 시험 · 점 수 최대 · 저장 키 하나 · 복귀 시험(가짜 visibility)**.

---

### F6 · 적 AI · 정찰
1. **목적**: 적 AI 가 **때마다 계획을 굳히고**(그 때 안에는 바꾸지 않는다) 그 계획이 화살표로 **참값**으로 보인다 — 정찰 단계마다 보이는 무리 수·먼 때 수가 다르다. 맡기기 파일럿(우리 편 AI)도 같은 AI.
2. **먼저 읽을 파일**: `30 §4`(정찰 설명) · `31-questions.md §5`(정찰 기본값) · `21 §3`·`22 §3`(미니맵 · 화살표 최대 3) · `12-cases-lane-map-scouting.md`(예고가 틀리면 믿지 않게 된다) · **`src/realm/tactics.ts:550`(`aiOrder` — 비공개 · `Ctx` 인자) 와 `:660` 의 `hintAcc`(낌새 정확도 75~95%)** · `:481-523`(`groupOptions`·`leadOptions`·`optionsOf`) · F1b 의 `ai0.ts` · F4a·F5b 결과.
3. **만들/고칠/금지**: 만들: `src/field/ai.ts`(정식 AI) · `src/field/scout.ts`(정찰 보이기 모델 · 순수) · `tests/field/ai.test.ts` · `tests/field/scout.test.ts`. 고칠: `src/field/sim.ts`(계획 칸 `plan: PlanEntry[]` · 때 경계 훅) · `types.ts` · `ai0.ts` 를 `ai.ts` 로 대체(또는 `ai0` 은 시험용으로 남김) · `P.field`. **금지: `tactics.ts` 에 `export` 를 붙이는 것**(L1a 의 일).
4. **할 일**
   1. **계획 굳힘**: 때 시작 틱에 `planFor(state, side)` 가 대마다 `{squadId, goalSquadId|goalCell, stance}` 를 만들어 `state.plan` 에 넣는다. **그 때가 끝날 때까지 AI 는 재계획하지 않는다**(예외: 대가 전멸 · 물러남). 사람이 입력으로 덮은 대는 AI 계획에서 빠진다.
   2. **정책**(`aiOrder` 의 틀을 복제 · 머리 주석에 「복제 원본 `tactics.ts:550` · 비공개라 읽을 수 없어 틀만 옮김 · L1a 의 `export` 뒤 대조」): 앞줄은 상대 앞줄 낌새에 맞수(방진 > 돌격 > 길 트기 > 방진) · 흔들리면 돌격/추격 · 활은 사거리 유지 · 기병은 적 활이 있으면 옆구리 · 적장 곁 호위가 얇으면 사로잡기 후보(표시만).
   3. **정찰 단계**: `scoutLevel(hero.ryak)`(지략 → 0 없음 · 1 · 2 · 3) → 보이는 무리 수 `scoutGroups[level]`(0·1·2·3) · 먼 때 수 `scoutAhead[level]`(0·1·1·2). 단계 0 은 **적 무리의 자리 점만**(자리는 늘 보임 · 사람 수는 F5b 가 정한 지금 본편 규칙대로 · 30 §4) · 1 이상은 적 무리의 **깃발(방침)** 과 **다음 때의 화살표**(대 → 목표 id). 거짓 없음.
   4. `scout.ts`: `scoutView(state, level): { flags: [...], arrows: [{from,to}] }` 순수 함수 — 화면은 이 결과만 그린다.
   5. **100% 일치 시험**(`scout.test.ts`): 1,000판에서 때 k 의 `scoutView` 가 보인 화살표 `(from,to)` 가 때 k+1 시작 후 `planAhead` 틱 안에 실제 `goal` 로 잡혀 있다 — **보인 수 = 실제 수**. 어긋나면 AI 가 때 안에서 몰래 재계획하고 있는 것.
   6. 우리 편 맡김 파일럿 = 같은 `ai.ts`(우리 쪽에 적용 · 입력 없음) — F8a 의 「맡기기」가 쓴다.
   7. 결정론 · 순수성 시험 목록에 `ai.ts`·`scout.ts` 추가(F1a `purity.test.ts`).
5. **params**: `scoutGroups`(0,1,2,3 · 시작 `[0,1,2,3]`) · `scoutAhead`(`[0,1,1,2]`) · `scoutRyakStep`(지략 몇 단계마다 한 단계 올리나 · 시작값 · 지략 분포는 `heroes.ts` 에서 `grep` 해서 정한다 — **못 잼 · 처음엔 지략 2·4·7 에서 1·2·3 단계로** [의견]) · `planAheadTicks` 20.
6. **시험**: `ai.test.ts`(계획이 때 안에서 안 바뀜 · 사람 입력 대는 AI 에서 빠짐) · `scout.test.ts`(100% 일치). 지킬 것: F1~F5.
7. **합격선(하나)**: **때 문에서 굳힌 계획의 목표 무리와 그 때 동안 실제로 친 목표가 1,000판에서 같다**(시험이 센다 · 30 F6). 화살표 화면(`scoutView`)이 그 계획을 그대로 보이는지는 같은 시험의 둘째 `assert` 로 **함께 센다**(보고 숫자).
   - 재는 명령: `node --test --experimental-strip-types tests/field/scout.test.ts`
8. **규모**: **중간**(1.5~2일). 30 의 중간 유지 — 26 의 「F6 AI 파일럿 4종 + ±3%p 보정 = 큼+」 은 **21 의 설계**(맡기기도 새 sim)였고 30 이 그 보정을 안 가져왔다 · L3 가 그 몫(D 의 6번).
9. **앞**: F4a · F5b. **나란히**: F4b(V 줄 · 파일 안 겹침). **뒤**: F7 · F8a.
10. **함정**: (1) `aiOrder` 가 비공개라 **읽는다는 30 의 말대로는 못 한다**(D 의 1번) — 복제가 표류하지 않게 F7 이 「지금 엔진의 잘 읽음 열」과 방향을 견준다. (2) 정찰 「다음 수」의 뜻(31-5 · 27 §4 「다음 수도」 읽기 불확실) — 지금은 「다음 때 방침과 화살표」로 구현하고 형이 정하면 바꾼다. (3) 때 안에서 몰래 재계획하면 100% 가 깨진다(= 화면이 거짓말) · (4) 정찰이 없으면 적 점이 안 보이는 후퇴 금지(21 의 「정찰 없음=아무것도 안 보임」 은 25 §2-3·27 §1 이 뒤집었다 — 점과 사람 수는 **늘** 보인다).
11. **끝났다는 것**: 커밋 · 보고에 **100% 일치 1,000/1,000 · 단계별 보이는 수 · AI 계획 길이**.

---

### F7 · 봇 · 재기 (손재주가 수와 판단을 덮지 않는가)
1. **목적**: 세 봇(정밀 손 · 큰 판단 · 가만)을 세 맵 × 병력 비 셋에서 돌려 **판단 줄(큰 판단 − 가만 ≥ 20%p)** 을 합격선으로, 손재주 줄(정밀 손 − 큰 판단 ≤ 5%p)은 함께 잰 숫자로 낸다. 손재주 줄이 넘으면 조임 손잡이로 F4 값을 고치거나 정직하게 적는다.
2. **먼저 읽을 파일**: `30 §6`(합격선 네 줄) · `21 §5`(열세 시험) · `25 §7`(문턱 넷) · `tools/realm-tactics.ts`(정책·비 여섯 칸·표 모양을 그대로 본받는다) · `tools/realm-sim.ts` 머리 주석(합격선의 씨앗 · 「신중 봇이 무모 봇보다 나아야」) · F1b 의 `tools/field-bench.ts` · F4a·F5·F6 결과.
3. **만들/고칠/금지**: 만들: `tools/field-bots.ts` · `src/field/bots.ts`(봇 정책 3 · **시험과 도구가 같이 import** · sim 쪽 순수성 목록에 넣는다) · `tests/field/bots.test.ts`. 고칠: `tools/field-bench.ts`(인자 확장) · `P.field`(조임 손잡이) · `docs/BALANCE.md`(봇 표 — 절 이름 `본편 전투 실시간화 · 봇 표 · F7`). 금지: 합격선 바꾸기 · 시험 끄기.
4. **할 일**
   1. 봇: `micro`(정밀 손 · 8틱마다 재목표 · 장수는 최적 위치로 카이팅) · `coarse`(큰 판단 · 때마다 한 번 방침 · 장수는 한 곳) · `idle`(가만 · 입력 0 · 기본 AI 가 짜 준 처음 계획만).
   2. 병력비 셋: `[0.7, 1, 1.4]`(30 F7 「병력 비 셋」 · 0.7 은 30 §6 의 열세 · 나머지 둘은 [의견] · `realm-tactics.ts:75` 는 여섯 칸 `[0.6,0.8,1,1.25,1.6,2.2]` 이니 L3 에서 여섯 칸으로 넓힌다) · 세 맵 `meet`·`cross`·`stake` 각각과 평균 · 씨앗 300판씩(30 F7).
   3. 표: 비마다 세 봇 승률 · `micro − coarse`(손재주 차) · `coarse − idle`(판단 차) · 한 판 중앙값 ms · 맡김(우리 편 `ai.ts`) 승률 · 병력비 0.7 에서 `coarse` 승률(L3 이 쓸 값).
   4. 합격(하나): `coarse − idle ≥ 20%p`(**열세 비 0.7 에서**). 손재주 줄 `|micro − coarse| ≤ 5%p`(30 §6)는 같은 표에서 함께 재서 보고하고, 넘으면 F4 값을 한 번 고쳐 다시 잰다(카드를 막지 않는다).
   5. 안 맞으면 조임 손잡이를 **이 순서로**: `heroPowerPermille` ↓ → `inputPerGroupPerTime` ↓ → `redirectTicks` ↑ → `leakPermillePerTime` 조정. **문턱 숫자(5·20)를 바꾸지 않는다.** 세 번 조여도 안 되면 표를 적고 멈춘다(코디네이터 판정 · 문 G1 에서 (가)로 물러날 수 있다).
   6. `bots.test.ts`: 봇 세 종이 같은 씨앗에서 결정론 · `idle` 은 입력 0 · `micro` 는 입력 예산을 넘기지 않는다(예산을 넘기는 봇은 반칙).
   7. `BALANCE.md` 에 표 + 조인 손잡이 기록(HEAD 판에 얹기).
5. **params**: 위 조임 손잡이(F4a·F5a 가 만든 값을 조정). 새 상수 없음 — 있으면 `P.field` 에 추가 · 시작값 「F7 표로 조인다」.
6. **시험**: `bots.test.ts`. 지킬 것: 전부.
7. **합격선(하나)**: **판단 줄: 큰 판단 봇 − 가만 봇 ≥ 20%p**(30 F7 · 병력 비 0.7 열세 칸). **함께 재는 숫자**: 손재주 줄(정밀 손 봇 − 큰 판단 봇 ≤ 5%p · 넘으면 이 카드가 막히지 않고 **F4 값**(`heroPowerPermille` 등)을 고치는 일을 하나 한다 · 문턱 숫자는 안 바꾼다).
   - 재는 명령: `node --experimental-strip-types tools/field-bots.ts --n 300 --ratios 0.7,1,1.4 --maps meet,cross,stake` (세 맵 × 병력 비 셋 × 300판 · 비 칸은 30 의 「병력 비 셋」 · 비 값은 [의견] 이며 0.7 은 30 §6 의 열세)
8. **규모**: **중간**(1.5~2일) — 단 **조임이 반복되면 큼**(26 이 F6 의 ±3%p 를 「끝이 안 날 수 있다」로 짚은 것과 같은 결 · 이 카드가 그 위험의 자리다 [의견]).
9. **앞**: F6. **나란히**: F8a(V 줄 · 파일 안 겹침 · **봇 표는 시간을 재므로 B-2-2**). **뒤**: G1.
10. **함정**: `micro` 봇이 입력 예산 밖의 일을 하면 합격선이 가짜(예산 시험) · 병력비 1.0 에서만 재면 판단 차가 안 보인다 · 열세 비에서 `coarse` 가 50% 를 넘으면 「손이 수를 덮는다」(22 §5 의 「열세 보호」 · 비 0.7 에서 가장 잘 두는 봇이 50% 미만이어야 한다는 줄을 보고에 같이 적는다 · 30 에는 없는 줄이라 **제안** · D 의 9번) · 본편 「잘 읽음」 열(`realm-tactics.ts` 표)과 방향이 다르면 L3 에서 큰 일이 된다 — 지금 `realm-tactics` 표도 같이 돌려 BALANCE 에 나란히 적는다.
11. **끝났다는 것**: 커밋 · 보고에 **표 전체(7비 × 3봇 + 맡김) · 두 선 통과 여부 · 조인 손잡이 전→후 · 본편 표 비교**.

---

### F8a · 시나리오 판 묶음 · 시작/끝 화면 · 입력 로그 · A/B 재생 · 입구
1. **목적**: G1 이 재는 것을 받치는 장치 — 3판 연속 시나리오(직접/맡기기 고름 · 완료 단추 하단 붙박이) · 끝 화면(이긴/진 까닭 한 줄 · 「한 판 더」 · 진 뒤 「편성 바꿔 다시」 단추 · 병종별 공과 금빛 새 병사는 F9) · 입력 로그 저장·복사 · 같은 싸움을 손 쓴 판과 빈손 판으로 섞어 보이는 재생 · 본편 「더 보기」의 입구 한 줄.
2. **먼저 읽을 파일**: `30 §2`(한 판 흐름 표) · `§9-1`(문 네 줄 — 이 카드가 받쳐야 하는 것) · `25 §7`(문턱 넷의 재는 법) · `21 §1`(첫 60초) · `src/realm/data/prose.ts`(`josa`) · `src/ui/realm/howwin.ts`·`prose.ts:1355 endStory`(지금 「이긴 까닭」 글이 어떻게 쓰이나 · **읽기만**) · `src/ui/realm/app.ts:6975-6985`(더 보기 단추 줄 · `spar-open`) · `:4334`(`openSpar` — 이름이 비슷해 헷갈리니 열어서 무엇인지 먼저 확인) · 메모리 `confirm-bar-bottom`·`no-effect-captions`(연출 위 설명 글 금지)·`no-disclaimer-text`.
3. **만들/고칠/금지**
   - 만들: `src/field/scenarios.ts`(3판 묶음 · `LiveSetup` 3개) · `src/field/why.ts`(이긴/진 까닭 한 줄 · **규칙 기반 순수 함수**) · `src/field/log.ts`(입력 로그 저장 · 복사 · 키 `hanbal.field.log`) · `src/field/abview.ts`(A/B 재생 모델) · `src/field/screens.ts`(시작·끝 화면 DOM) · `tests/field/why.test.ts` · `tests/field/scenarios.test.ts` · `tests/field/log.test.ts`.
   - 고칠: `src/field-main.ts` · `src/ui/realm/app.ts` — **더 보기 단추 줄에 한 단추**(`data-act="field-open"` · 이름은 먼저 `grep -rn "field-open" src` 로 안 겹치는지) + `case 'field-open'`(`openFrame` 또는 `location` 으로 `${import.meta.env.BASE_URL}field.html` · 열전 입구 `app.ts:4511` 의 `openFrame(...raid.html...)` 꼴을 본받는다) · `ko.ts/en.ts`(`more.field` 등). **이것이 F 카드 중 본편에 닿는 유일한 줄이다**(30 §7 의 「더 보기의 시험 항목」) — 본편 화면·결과는 안 바뀐다.
   - 금지: 본편 전투·`battlefield.ts` · 본편 징병 화면 연결(L4 의 일).
4. **할 일**
   1. `scenarios.ts`: **세 판**(순서가 곧 학습 곡선 · 25 §7 문턱 ③ 이 「둘째·셋째 판에서 직접 고름 ≥ 50%」): (1) `meet` 병력비 1.1 · 새 병사(`fresh`) 있음 · 쉬운 판 · 90초 안에 끝나는 쪽 (2) `cross` 비 0.9 (3) `stake` 비 0.7 열세 — 지는 판 · **90초 안에 끝남**(문턱 ④). 적 장수·우리 장수 한 명씩.
   2. 시작 화면: 판 이름 · 양쪽 병력 · **「직접」 / 「맡기기」 두 단추** + **하단 붙박이 큰 「전투 개시」**(고르고 나서). 「맡기기」 = 우리 편에 `ai.ts` 를 입히고 구경(F6 의 맡김 파일럿) · 존댓말 안내(「직접 지휘하거나 맡길 수 있습니다」 꼴).
   3. 끝 화면: `why.ts` 의 **한 줄**(예: 평서 「장수가 뛰어든 오른쪽이 버텨 이겼다」 · 판정 글이라 평서) · 「한 판 더」 단추 · 졌으면 「편성 바꿔 다시」 단추(F9 가 지을 때까지는 다음 시작 화면으로 가는 stub · F9 가 편성 화면으로 잇는다). 표시는 한 번 · 연출 위 해설 금지.
   4. `why.ts` 규칙표: 우선순위 — ① 장수 곁 대가 버텨 사기 하락 비가 작았다 ② 상성이 갈렸다(어느 방침이 어느 방침을 이겼나) ③ 개울/목책/기습이 걸렸다(규칙 태그) ④ 병력 차. 조건마다 **문장 틀 하나** + `josa()` · 시험이 틀마다 한 번 이상 나오고 **빈 줄이 0** 인지 확인(`tests/realm/battlestory.test.ts` 꼴).
   5. 입력 로그(`log.ts`): 판마다 `{scenario, seed, mode: 'hand'|'auto', startedAt?, inputs: rec 줄, endedAt?, end, endWhy}` — **시각은 sim 밖(화면)에서만** 찍는다(Date 는 field-main 에서 · sim 은 틱) · 저장 키 `hanbal.field.log` 하나(배열 · 마지막 N=20 판 · `localStorage.clear()` 금지 · try/catch) · 「복사」 단추가 JSON 한 덩어리를 클립보드로(형이 모아 코디네이터에게 붙여 줌).
   6. 첫 60초 로그: 첫 입력이 언제(틱)인지 · 목적지가 적 쪽/옆/제자리인지(25 §7 ① 의 「제자리에서 끝난 끌기는 안 센다」) · 이탈한 틱(탭 닫음 · `visibilitychange` 로 마지막 기록).
   7. A/B 재생(`abview.ts`): 한 판의 `inputs` 와 같은 씨앗의 **빈손 판**(입력 0)을 둘 다 재생해 무작위 순서로 「가」「나」 라고만 보이고 「어느 쪽이 내 판입니까」 를 고르게 한다(25 §7 ②) — 재생은 sim 재생(F1a `rec.ts` 의 재생) · 선택 결과를 로그에 적는다.
   8. 입구: `app.ts` 더 보기에 한 단추 + `case`(5174 에서 눌러 `field.html` 이 뜨는지 눈으로).
   9. 헤드리스 시험(`scenarios.test.ts`): `bots` 의 `coarse` 가 3판을 **끝까지** 끝낸다 · (3)이 90초(900틱 아님 · `timeTicks×…` 가 아니라 **실제 초 = 틱/hz**)를 넘지 않는다 · `log.test.ts`: 저장 → 복사 문자열 → 파싱 왕복.
5. **params**: `scenarioRatios`(`[1.1, 0.9, 0.7]` 시작) · `firstFightMaxSec` 90(문턱 ④ 선) · `logKeep` 20 · `whyMin` — (없음).
6. **시험**: `why.test.ts` · `scenarios.test.ts` · `log.test.ts`. 지킬 것: 위 전부 + `tests/i18n.test.ts` + `tests/realm/josa.test.ts`(새 `ko` 키).
7. **합격선(하나 · 이 카드의 완료 조건 · 30 의 F8 합격선 「패드 입력 줄로 한 판」 은 F8b)**: **봇이 3판을 끝까지 끝내고, 세 번째(지는 판)는 90초 안에 끝나며, 끝 화면의 까닭 한 줄이 빈 줄 0 이다.**
   - 재는 명령: `node --test --experimental-strip-types tests/field/scenarios.test.ts tests/field/why.test.ts tests/field/log.test.ts`
8. **규모**: **큼(작은 쪽 · 3일)** — 30 은 F8 을 「중간」 으로 적었으나 문 G1 의 장치(판 묶음·로그·A/B·입구)가 안 들어 있어 이 카드가 받는다 · 패드(F8b)를 떼어 중간에서 큼으로 올린 만큼(D 의 5번).
9. **앞**: F6 · F5b · F4b · (F3b). **나란히**: F7. **뒤**: F8b → G1.
10. **함정**: 형이 말한 「이긴 까닭을 말하나」 는 **화면에 한 줄 없이 입으로**(25 §7 ②) — 한 줄은 거들 뿐이다(블라인드 A/B 가 본 시험) · 연출 위 해설 글(「기운이 모입니다」) 금지 · 시각을 sim 에 넣으면 결정론이 깨진다 · 시나리오 (3) 의 지는 판이 질 걸 아는 2분이 되지 않게 사기 문턱이 일찍 나야 한다(30 §2 규칙 3) · `spar-open` 과 이름·뜻이 겹치는지 먼저 열어 본다(`openSpar`) · 입구 단추가 「더 보기」 패널 높이를 늘려 폰에서 넘치면 안 된다(네 폭 확인 · 11-02 사고) · 새 병사 `fresh` 금빛 테두리는 F3b 가 그리고 값은 F9 가 넣는다.
11. **끝났다는 것**: 커밋(`app.ts` 한 줄 포함 — 되돌림 목록에 적는다) · 배포(`gh run list`) · `field.html` 이 Pages 에서 200 · 보고에 **네 폭 스크린샷 · 3판 완주 시험 · 지는 판 끝난 초 · 입구 단추를 눌렀을 때 화면(봤다/못 봤다)**.

### F8b · 패드
1. **목적**: 게임패드(스팀 얼굴)로 한 판을 끝낼 수 있다.
2. **먼저 읽을 파일**: `30 §4`(「패드는 F 끝 카드로 넣는다」) · `26 §5-4`(패드 코드 0건 · 스팀 대표 얼굴) · MDN Gamepad API(외부 · 안 열어도 되나 `navigator.getGamepads()` 폴링 + `gamepadconnected` 이벤트) · F5a 의 `pickmodel.ts`·`input.ts` · F4b 의 `keys.ts`.
3. **만들/고칠/금지**: 만들: `src/field/pad.ts`(폴링 → `FieldInput` · 순수 변환 + 얇은 폴링) · `tests/field/pad.test.ts`. 고칠: `src/field-main.ts`(폴링을 루프에 · **숨은 탭이면 폴링 안 함**). 금지: 열전.
4. **할 일**: (1) 매핑: 왼쪽 스틱 = 장수 이동 / 칸 선택 커서 · 십자 = 무리 칸 순환 · A = 확인(전투 개시 · 이동 지정) · B = 취소 · X = 비기 · Y = 방침 순환 · LB/RB = 미니맵 이동 · 시작 = 멈춤. (2) 변환은 순수 함수 `padToInputs(prevPad, pad, ui)` · 가짜 패드 객체로 시험. (3) 폴링은 `loop.ts` 의 프레임에서만(rAF 안 · hidden 이면 안 함) · 데드존 `padDead`. (4) 패드만으로 시작 화면 → 전투 → 끝 화면 → 한 판 더를 지나가는 **명령 열**이 시험에서 한 판을 끝낸다(`pad.test.ts` 가 가짜 패드로 모델 레벨 시험). (5) **실제 패드는 형이 확인**(이 일꾼은 PC 에 패드가 없을 수 있다 · 못 봤으면 「안 봤다」).
5. **params**: `padDead` 0.2(‰ 정수 `padDeadPermille` 200) · `padRepeatTicks` 4.
6. **시험**: `pad.test.ts`. 지킬 것: F5·F8a.
7. **합격선(하나)**: **패드 입력 모델만으로 한 판을 끝까지 지난다**(`pad.test.ts` 통과) — 실제 패드 확인은 형(「안 봤다」면 그 사실을 맨 앞에).
   - 재는 명령: `node --test --experimental-strip-types tests/field/pad.test.ts`
8. **규모**: **중간**. 밀리면 가장 먼저 버리는 카드(B-5).
9. **앞**: F8a. **나란히**: G1 준비. **뒤**: 없음.
10. **함정**: 폴링은 배터리·절대 규칙 4 (hidden 이면 안 돔) · 브라우저마다 매핑 번호가 달라 `standard` 매핑만 지원하고 아니면 안내 한 줄 · 스틱 드리프트 데드존 · 터치와 패드가 동시에 오면 마지막 입력이 이긴다.
11. **끝났다는 것**: 커밋 · 보고에 **모델 시험 결과 · 실패드 「봤다/안 봤다」**.

---

### F9 · 뽑고 바로 싸우기 (형의 목적 「빨리 군사 뽑아서 전투 해 보고 싶게」)
1. **목적**: 싸움 앞의 **편성 화면**(병종 몫과 장수를 고름 · 본편 병종 7과 값 그대로) → **바로 전장** → 새로 뽑은 병사는 **금빛** → 진 뒤 **「편성 바꿔 다시」**. 25 §5-1 과 32 §5 가 짚은 가장 큰 빈칸(군사 뽑기 → 전장 사이가 설계에 없었다)을 시험장에서 먼저 짓는다. 끝나면 G1 이 「뽑은 군사가 전장에 서는 맛」을 잴 수 있다.
2. **먼저 읽을 파일**: `30 §1`(거상에서 가져오는 것 = 짠 군대가 그대로 선다 · 새로 뽑은 병사 금빛) · `§2` 표 · `25-review-fun.md §5-1`(뽑기 → 전장 거리) · `src/realm/tactics.ts:235-260`(`groupOf`·`groupMen`·`groupsOf` — 병종 7 → 무리 셋 매핑 · `export` 됨 [확인]) · `src/realm/battle.ts` 의 `UnitKind`(병종 7 · `spear shield bow crossbow pike horse boat` 등 · 정확한 목록은 파일에서 확인) · `src/ui/realm/troops.ts`(지금 징병·군대 화면의 병종 이름·아이콘 — **읽기만**) · F1a 의 `LiveSide`·`squadsOf` · F8a 의 끝 화면.
3. **만들 파일 / 고칠 파일 / 금지**: 만들: `src/field/roster.ts`(편성 모델 · 순수: 병종 몫 합 = 총원 · 병종 → 무리 → 대) · `src/field/credit.ts`(병종별 공 계산 · 순수) · `src/field/muster.ts`(편성 화면 DOM) · `tests/field/roster.test.ts` · `tests/field/credit.test.ts`. 고칠: `src/field/screens.ts`·`scenarios.ts`(F8a · 편성 화면을 시작 화면 앞에 끼움 · 「편성 바꿔 다시」 가 이쪽으로) · `src/field-main.ts` · `P.field` · `ko.ts/en.ts`. 금지: `troops.ts` 고치기 · 본편 병종 값(읽기만 · `UnitKind` 별 값을 복사해 새 상수를 만들지 않는다 — 본편의 `P.realm`/`battle.ts` 값을 읽는다).
4. **할 일**
   1. `roster.ts`: `Roster { total: number; mix: Record<UnitKind, number>; fresh: Record<UnitKind, number>; hero: string }`(총원은 시나리오 값 고정 · 병종 몫은 사용자가 고름). `squadsOf(roster)` 가 F1b 의 대 만들기를 부른다(무리마다 대 4 이하 · 사람 수 변동). `fresh` = 이번 달 새로 뽑은 몫(시나리오가 처음 값을 주고 편성에서 늘리면 늘어난 몫이 fresh).
   2. 편성 화면(`muster.ts`): 병종 7 줄(아이콘 · 이름 · 몫 막대 · 더하기/빼기 단추) · 장수 한 명 고르기 · 아래 **하단 붙박이 큰 「전투 개시」**(완료 단추 규칙) · 한 번에 고를 것 넷 이하 규칙을 어기지 않게 **무리 세 칸(앞줄·활·기병) 합으로 먼저 고르고 병종은 펼침 안에서**(`pickmodel` 의 한도와 같은 생각 · F5a 의 모델 함수로 센다). 화면 글은 존댓말 안내 · `t('field.…')` · 읽지 않고 보이게(아이콘 + 막대 위주).
   3. 「전투 개시」 → 전장이 **바로** 뜬다(화면 전환 한 번 · 누른 뒤 전장까지 몇 번 눌렀는지를 로그에 센다: 25 §5-1 의 「몇 번 눌러야 하나」).
   4. 금빛: `fresh` 몫의 점에 F3b 의 `freshRim` 을 입힌다(그리기는 F3b · 값은 이 카드).
   5. 병종별 공(`credit.ts`): 판 기록(`log.events` 의 피해 줄)에서 병종별로 줄인 상대 사람 수 · 쓰러뜨린 몫을 센다 → 끝 화면에 **병종 하나당 한 줄**(상위 셋) + 「이번에 뽑은 사람(금빛)이 낸 몫」 한 줄. 같은 편성이면 같은 결과(결정론 · 시험).
   6. 진 뒤 「편성 바꿔 다시」: 같은 맵·같은 씨앗으로 편성 화면에 돌아가 **직전 편성이 미리 채워진 채** 열린다(F8a 의 stub 대체).
   7. `roster.test.ts`: 병종 몫 합 = 총원 · 무리 세 칸 매핑이 `groupOf` 와 같다 · **편성을 바꾸면 같은 맵·같은 씨앗의 결과 해시가 달라진다** · 같은 편성 두 번 = 같은 해시. `credit.test.ts`: 병종 공의 합이 판 전체 피해와 맞는다(오차 0 · 정수) · 끝 화면 모델에 병종 줄이 비지 않는다.
5. **params**: `rosterTotal`(시나리오 총원 · 시작값 600 · 한 편 사람 수 중앙 594 [옮김 26]) · `rosterStepPermille` 50(더하기 한 번의 몫) · `freshShareStart`(처음 금빛 몫 ‰ · 시작 200) · `creditRows` 3.
6. **시험**: 위 두 파일. 지킬 것: F1~F8a 전부.
7. **합격선(하나)**: **편성을 바꾸면 같은 맵·같은 씨앗의 결과가 달라지고 끝 화면이 그 병종의 공을 따로 보인다**(시험 · 30 F9).
   - 재는 명령: `node --test --experimental-strip-types tests/field/roster.test.ts tests/field/credit.test.ts`
8. **규모**: **중간**(1.5~2일). 편성 화면 DOM 이 폰 네 폭에 맞는 데 시간이 든다.
9. **앞**: F8a · F3b · F6 · F1b. **나란히**: F7(S 줄 · 파일 안 겹침) · F8b. **뒤**: G1.
10. **함정**: 본편 병종 이름·값을 복사해 새 상수로 두면 표류한다(읽는다) · 병종 7 줄을 한 화면에 펼치면 「한 번에 고를 것 넷 이하」 를 어긴다(무리 세 칸 먼저) · 「군사 뽑기」 라는 말은 본편 징병 화면의 말이다 — 시험장의 편성 화면에서는 「편성」 이라 부른다(30) · 편성 총원을 사용자가 늘릴 수 있게 하면 힘을 사는 것처럼 보인다(총원은 고정 · 몫만 바꾼다) · 새 병사 금빛이 너무 많으면 의미가 사라진다(시작 200‰) · 지는 판에서 「편성 바꿔 다시」 가 같은 씨앗이라 같은 패배를 반복하게 되지 않게 병종 몫이 결과를 바꾸는 시험이 지킨다.
11. **끝났다는 것**: 커밋 · 배포 확인 · 보고에 **편성을 바꿨을 때 결과 해시/승률 차(전→후) · 「전투 개시」 까지 누른 횟수 · 네 폭 스크린샷(봤다/못 봤다)**.

---

### G1 · 문 (사람이 쳐야 열린다 · 일꾼 카드 아님)
- 열리는 조건: S 줄 F7 통과(또는 형이 미달을 알고 진행) + V 줄 F9 끝 + 배포됨 + 봇 숫자 표 한 장 + 폰 네 폭 녹화.
- 누가: **형 + 지인 넷**(30 §9-1 의 「사람 다섯」). 3초 이탈러형 한 명 포함(25 §7 ④).
- 재는 것(30 §9-1): ① 시키지 않아도 다섯 중 셋이 20초 안에 무리를 적 쪽·옆으로 끈다 ② A/B 를 다섯 중 셋이 맞히고 「내 깃발·내 장수 덕」을 말한다 ③ 둘째·셋째 판에서 「직접」 비율 ≥ 50% · 진 뒤 다음 판 시작 ≥ 60% ④ 금방 떠나는 손님이 첫 판을 끝까지 · 폰 30프레임 · 지는 첫 판 90초 안 + 봇 숫자(F7).
- **임시 도형 고지**: 군기·막사·바닥은 임시 도형이다(30 §8 · 32 §5 가 짚은 「G1 에서 그림 때문에 떨어질 수 있음」). 코디네이터는 지인에게 건네기 전에 형께 「그림은 평가 대상이 아니라는 안내를 어떻게 줄지」 한 줄을 정하고, 로그의 이탈 초가 그림 탓인지 판 탓인지 가르려 지인 인터뷰에 「그림 때문에 떠났나」 한 줄을 넣는다. 그림 주문(Codex)은 G1 뒤.
- 통과 = 넷 중 셋 → L1a 로(L4 는 L1 을 기다리지 않고 같이 시작 가능). 아니면 **(가)로 물러나거나 멈춤**(30 §9). 판정은 형.
- 이 문 뒤에 **L1~L3 카드를 다시 쓴다**(아래는 뼈대).

---

### L1 · 배관 (뼈대 · G1 뒤에 다시 쓴다)
- **쪼개는 선(아주 큼 → 셋)**
  - **L1a**(작음 · 한 커밋 단독 · 26 §7-2 #2): `tactics.ts` 의 `frontQ`·`groupPower`·`shareOf`·`downOf`·`aiOrder` 를 **`export` 만**(동작 불변). 같은 커밋에서 다른 일 금지. 합격: P1 골든 불변. 그 뒤에 F6 의 복제 AI 를 이 export 와 대조해 표류가 있으면 보고(F6 AI 의 정책을 바로잡을지는 코디네이터).
  - **L1b**(큼+ · 26 §6): 주입 갈래 — `Tactic`(`types.ts:614`)·`Order command`(`:1074`)·`ReportLine battle`(`:1232` 부근)·`FightResult`(`tactics.ts:147`) 에 칸을 더하고 `fightRounds` 맨 앞에 「주입된 결과가 있으면 그것을 돌려준다」 한 갈래만(22 의 「끝에 더하는 덧셈」 은 26 §1-22-1 이 승패에 안 닿는다고 판정 · 30 §5 가 「결과 주입」 으로 바꿨다). **`FightResult` 불변식 검사기**(`src/realm/fight-invariants.ts` · `na/nd` 가 `endWhy`·`broke`·`captured` 와 어긋나지 않는지)는 L1b 안에서 **먼저 짓고**(32 §5: L1 합격선에 검사기가 없었다), 합격선에 포함한다: 검사기가 **옛 판 1만 판(P1 골든 입력)에서 위반 0**이고 일부러 어긋나게 만든 결과 몇 개는 잡아낸다. 합격: 주입 없는 판은 P1 골든 그대로 · 주입 판은 재생이 같음.
  - **L1c**(큼): 싸움 중 저장(`Saved` v2 · `normalize`/`migrate` · `net/bundle.ts:146` `logHash`) · 시험의 `deepEqual`(`tactics.test.ts` 의 rehearse↔real) · `realm-oldclock-hash.ts`·`realm-replay.ts` 가 `command` 길을 안 지나는 문제 → 주입 판용 도구 · 화면 맡김과 엔진 맡김 **한 길로**(`app.ts:1791` 미리 보기·`:8907` 실패 경로 · 26 §5-2) · i18n 기준선.
- **알려진 함정(26)**: `classifyEnd` 추출은 순수하게 안 빠진다(지역 변수 7 · `unarrive` 토글 · `chase()` 부작용) · `ask` 가 시험 돌림 일곱 곳을 건드린다 · 기록은 입력 줄이 아니라 결과 요약(싸움당 수백 바이트).
- **모델 opus** · **독립 검수 sim-lens + craft-lens**.

### L2 · 들판 연결 (뼈대)
- 본편 들판 싸움에서 「직접」을 고르면 field 전장이 뜬다 · 때 단위 `RoundLog` 요약 · 생포·겨루기(`mountDuel`)·각성 연출 잇기 · **스위치 꺼짐이면 화면·결과 바이트 불변**.
- 26 이 가장 과소평가된 카드로 짚은 곳(연결 스위치 3일 → 8~10일)이다 — `warHtml`(2,100줄)의 스킬 컷·각성·사로잡기·겨루기 겹침·소리 시계·배우는 판 안내(`tutorial.ts` 5·6단계)가 DOM 에 얽혀 있고 Canvas 와 DOM 이 한 화면에서 겹치는 순간이 첫 반려 후보. G1 뒤에 **Canvas 가 맡는 것/DOM 이 남는 것의 경계표**부터 쓰고 카드를 쪼갠다(L2a 경계 · L2b 들판 · L2c 연출 잇기).
- **모델 opus** · 검수 loop-lens + feel-lens.

### L3 · 폭 맞추기 (뼈대)
- AI 가 모는 실시간과 맡기기(지금 엔진)의 승률을 병력비 여섯 칸에서 견줘 30 §6 의 「수」 줄(열세 0.7 에서 큰 판단 봇이 지금 엔진 「잘 읽음」 열 ±10%p)을 지킨다. F7 의 표와 `realm-tactics.ts` 표를 나란히. **끝이 안 날 수 있는 카드**(26 §6 의 ±3%p 보정과 같은 결 · 반복 조임) — 상한 회수(예: 세 번)를 정하고 못 맞추면 정직하게 적고 G2 에서 형이 판정.
- **재는 도구는 L3 안에서 짓는다**(32 §5: 도구 자리가 없었다): `tools/field-vs-fight.ts` — F7 의 `src/field/bots.ts` 를 재사용해 같은 `Side` 에서 새 sim(큰 판단 봇)과 `fightRounds`(맡김·잘 읽음)를 돌려 병력 비 여섯 칸 표를 BALANCE 에 낸다.
- **모델 opus** · 검수 balance-lens.

### L4 · 징병에서 연습 싸움 (뼈대 · G1 뒤에 다시 쓴다)
- 목적: 형의 「빨리 군사 뽑아서 전투 해 보고 싶게」(30 F9·L4). 본편 징병·군대 화면에 **「연습 싸움」** 단추 — 지금 내 군대(병종 몫·장수) 그대로 전장에 서서 한 판을 치르고 **본편 결과에는 안 적힌다**.
- **합격선(하나)**: 연습 싸움 앞뒤로 **본편 저장이 바이트로 같다**(30). 재는 길: 연습 싸움을 돌리기 전과 후에 `JSON.stringify(realm)`·저장 키(`hanbal.*`)의 값을 해시로 견주는 시험 + 브라우저에서 한 번.
- 읽을 곳: `src/ui/realm/troops.ts`·`app.ts` 의 징병·군대 화면 · `src/realm/tactics.ts` 의 `Side`(내 군대 → `LiveSide` 변환은 F2a `mapFor` 와 F1a `squadsOf` 를 쓴다 · **읽기만 하는 변환이라 L1(주입)을 기다리지 않는다**) · F9 의 `roster.ts`.
- 쪼개는 선: a = `Side → LiveSetup` 순수 변환(`src/field/fromside.ts` · 시험: 같은 군대 같은 세트업) · b = 징병 화면에 단추 + 전장 열기(iframe/`openFrame` 꼴 · `app.ts:4511`) + 닫으면 본편으로 복귀 · 저장 불변 시험.
- 함정: 연습 싸움이 본편 `rehearse`·`advance` 를 건드려 시험 돌림을 오염시키면 안 된다 · 연습 결과가 장수 단련 공·사기에 샐 수 있다(0 이어야 한다) · 체험판에는 스위치 꺼짐이 기본.
- **모델 opus** · 검수 loop-lens + sim-lens.

### G2 · 문 (2월 첫 주 · 일꾼 카드 아님)
B-4 의 G2 칸.

---

## D. 맨 끝

### D-1. 카드 전체 표
| 카드 | 규모 | 앞 카드 | 만드는 파일(주요) | 합격선(하나) |
|---|---|---|---|---|
| P1 골든 동결 | 작음 | – | `tests/realm/battle-golden.test.ts` | 새 골든 시험이 HEAD 에서 통과(두 번) |
| P2 죽은 코드·낡은 글 | 작음 | P1 | (지우기) `battlefield.ts`·`app.ts`·`tactics.ts`·BATTLE 문서 | 동작 변화 0 = P1 골든 불변 + oldclock diff 0 |
| P3 재는 도구 | 중간 | – | `tools/battle-stats.ts`·`tools/field-perf.ts`·BALANCE 절 | 표가 BALANCE.md 에 |
| P4 열전 성능 | 작음 | P3(문서) | (BALANCE 소절) | 숫자와 판정 한 줄 |
| F1a sim 뼈대 | 중간 | – | `src/field/{types,num,state,sim,rec}.ts`·`tests/field/*`·`P.field`·glob | 1,000씨앗 같은 해시 + 기록 재생 + 순수성 0건 |
| F1b 전투 규칙·벤치 | 큼 | F1a | `src/field/{combat,morale,ai0}.ts`·`tools/field-bench.ts` | 임시 AI 끼리 1,000판 같은 해시(속도 30ms 는 함께 잼) |
| F2a 맵 자료 꼴·조각 | 중간 | F1b | `src/field/{map,stake,solids}.ts` | 세 맵+기습이 끝까지 돌고 같은 해시 |
| F2b 맵 규칙 | 중간 | F2a | (sim·combat 고침)·`tests/field/rules-map.test.ts` | 대로 대비 승률이 개울 −·목책 +·기습 + 로 각 500판에서 5%p 이상(첫 접촉은 함께 잼) |
| F3a field.html·카메라·점 | 큼 | F1b | `field.html`·`src/field-main.ts`·`src/field/{loop,camera,view,dots}.ts` | 네 폭 넘침 0 |
| F3b 편 색·군기·프레임 | 중간 | F3a | `src/field/{tint,banner,shots}.ts` | 편당 160점 그리기 한 장 ≤ 8ms(프레임·스크린샷은 함께) |
| F4a 장수 규칙 | 중간~큼 | F2b | `src/field/hero.ts` | 장수를 왼쪽 무리에 붙이면 왼쪽이 오른쪽보다 오래 버팀(500판 중앙값) |
| F4b 장수 입력·그림 | 중간 | F4a·F5a | `src/field/{stick,keys,hero-view}.ts` | 네 폭 겹침 0 + stick 시험 |
| F5a 깃발 | 중간 | F3a·F1b | `src/field/{input,flags,pickmodel}.ts` | 고를 것 넷 이하(시험) |
| F5b 미니맵·때 문·느려짐 | 중간~큼 | F5a·F4a | `src/field/{mini,gate,slow}.ts` | 느려짐 ≤ 6초/때 · 점 ≤ 26 |
| F6 적 AI·정찰 | 중간 | F4a·F5b | `src/field/{ai,scout}.ts` | 굳힌 계획의 목표 = 실제 친 목표(1,000판) |
| F7 봇·재기 | 중간(큼 위험) | F6 | `tools/field-bots.ts`·`src/field/bots.ts` | 판단 줄 ≥ 20%p(손재주 ≤ 5%p 는 함께 잼) |
| F8a 시나리오·끝 화면·로그·입구 | 큼(작은 쪽) | F6·F5b·F4b | `src/field/{scenarios,why,log,abview,screens}.ts`·`app.ts` 한 줄 | 3판 완주 · 지는 판 90초 안 · 까닭 빈 줄 0 |
| F8b 패드 | 중간 | F8a | `src/field/pad.ts` | 패드 모델만으로 한 판 끝(실패드는 형) |
| F9 뽑고 바로 싸우기 | 중간 | F8a·F3b·F6 | `src/field/{roster,credit,muster}.ts` | 편성을 바꾸면 결과가 달라지고 끝 화면이 병종 공을 따로 보임 |
| G1 문 | – | F7·F9(F8b 는 안 기다림) | – | 넷 중 셋 통과 |
| L4 징병에서 연습 싸움 | 중간 | G1(L1 안 기다림) | `src/field/fromside.ts`·징병 화면 단추 | 연습 싸움 앞뒤 본편 저장 바이트 같음 |
| L1a/b/c·L2·L3 | 작음·큼+·큼·아주 큼·중간~큼 | G1 | (뼈대) | 주입 없는 판 P1 골든 그대로 · 스위치 꺼짐 바이트 불변 · §6 「수」 줄 |
| G2 문 | – | L3 | – | 형이 정함 |
- 합계 [의견 · 못 잼 · 눈금을 그대로 더함]: P 약 4~5일 · F 약 21~33일 · L 약 11~20일(30 §9 와 같다). F8a 는 큼(작은 쪽)으로 올렸으나 30 의 합계 범위 안이다.

### D-2. 30 과 어긋나게 적은 곳 (30 을 고치지 않고 여기에 적는다)
1. **F6 「지금 `aiOrder` 의 고름을 읽음」** → `aiOrder`(`tactics.ts:550`)는 **비공개**이고 첫 인자가 안쪽 `Ctx` 라 F 에서는 읽을 수 없다. 본편 0줄 원칙 때문에 F6 은 틀을 복제하고 L1a(`export`)에서 대조한다. [확인]
2. **F4 를 a/b 로 쪼갬 · 합격선은 a 의 입력 줄 시험**(개정 30: 임시 AI + 「장수를 왼쪽 무리에 붙인 입력 줄」) — 봇이 아니다. 이 합격선은 규칙(F4a)에 걸린다. F4b 의 완료 조건은 별도(네 폭 겹침 0). 카드 번호는 유지.
3. **F1·F2·F3·F5·F8 을 a/b 로 쪼갬**(큼 이상 규칙 · 30 의 카드 번호 유지). F2 의 합격선(30 한 줄)은 b 에, a 는 「끝까지 돈다」.
4. `tools/field-bench.ts` 는 개정 30 이 F1 에 넣었다(어긋남 아님 · 정리). F1b 가 만들고 F2b·F7 이 인자를 확장한다.
5. **F8 이 커졌다**(중간 → 큼 작은 쪽 · 금빛과 병종 공은 개정 30 대로 F9 로 옮겼다): 30 의 §9-1 문(직접/맡기기 고름 · 입력 로그 · A/B 재생 · 첫 판 이탈 초)이 30 의 카드 표에 받는 곳이 없어 F8a 에 넣었다. 패드는 F8b 로 떼어 버리는 순서 첫째에 둔다. **제안**: 30 의 F8 줄에 「G1 장치」 를 적을 것.
6. **F6 중간 유지**: 26 §6 의 「F6 AI 파일럿 4종 + ±3%p 보정 = 큼+」 은 21 안의 이야기이고 30 은 맡기기를 새 sim 으로 안 보내 ±3%p 보정이 없다 → 중간. 대신 그 위험(반복 조임)은 **F7 과 L3** 에 있다.
7. **P2 에서 00 §7 의 4번(긴창 `pike` 뽑는 길)·5번(`battle-strikes` 맞힘 칸 표)을 제외** — 30 의 P2 합격선이 「동작 변화 0」 이라 동작·그림이 바뀌는 4·5 번과 충돌한다. 4번은 별도 일감(제안) · 5번은 낡은 칸 목록만 보고.
8. **폰 방향**: 30 은 「가로 띠」 만 말하고 폰 세로/가로를 안 정했다(27 의 마지막 한계). **코디네이터 결정(11-25)**: 맵은 늘 가로 띠이고, 폰에서는 열전처럼 가로로 돌려서 한다 — 싸우는 동안 세로 화면이면 열전의 「폰을 가로로 돌려 주세요」 안내(`raid-main.ts:155·559`)와 같은 꼴을 `src/field/` 에 새로 써서 띄운다(22 의 「세로 띠」안은 안 쓴다). 세로 화면에 눕혀 넣는 확대 셈은 하지 않는다.
9. **손재주 손잡이 셋**(입력 예산 `inputPerGroupPerTime` · 다시 끌기 지연 `redirectTicks` · 장수 힘 `heroPowerPermille`)과 **「비 0.7 에서 가장 잘 두는 봇이 50% 미만」 줄**은 30 의 이름에 없다. 30 §6 의 손재주·판단 합격선을 지키는 **수단으로만** 21·22 에서 가져왔다(기능을 더한 것이 아니라 합격선의 조임 장치). 필요 없다고 판단하면 코디네이터가 지운다. **제안**.
10. **입구 단추**: 30 §7 표에 「더 보기의 시험 항목」 이 있으나 카드가 없어 F8a 에 넣고 `app.ts` 한 줄을 허락했다(F 카드 중 본편에 닿는 유일한 줄).
11. **`tests/field/` + glob**: 30 대로 따르되, 대안 **제안**: 시험 이름을 `tests/field-*.test.ts` 로 두면 `package.json` 을 안 고치고도 도는 길이 있다(열전 시험이 `tests/raid-*.test.ts` 로 이미 그 길 [확인 26 §3-8]). 30 을 따라 지금은 glob 을 고치는 쪽으로 적었다.
12. **`tools/josa-lint.ts` 의 `DIRS` 에 `src/field` 추가**(F1a) — 지금은 `src/ui/realm`·`src/realm` 만 검사해(`tools/josa-lint.ts` [확인]) 새 폴더의 조사 실수가 안 잡힌다. 30 에는 없는 한 줄이다.
13. **화면 글 규칙**: 30 §10 은 「카드 합격선에 린트를 넣는다」 라고 했으나 카드마다 합격선이 하나여야 해서 린트 두 줄(`dash-lint` · `josa-lint`)을 **합격선이 아니라 커밋 전 공통 검사**(A-1)로 두었다.

### D-3. 못 본 것
- **게임 화면을 한 번도 안 봤다**(이 장은 읽기만 했다 · 브라우저 안 씀). 폰 방향·가독성·프레임에 관한 문장은 전부 [의견]이다.
- **직접 연 것**: `package.json` · `vite.config.ts:30-62` · `tsconfig.json` · `tools/{realm-oldclock-hash,realm-tactics(1~100줄),war-perf,phone-shot,raid-fps-probe,dash-lint,josa-lint,i18n-lint,realm-savesize,realm-sim,realm-memsize,budget}.ts` 머리 · `tests/{raid-golden,i18n,realm/look,realm/tactics}.test.ts` 머리 · `src/core/rng.ts` · `src/realm/tactics.ts` 의 `Side`·`FightResult`·`export` 목록·`aiOrder` 줄 · `src/realm/warroom.ts:1-50` · `src/raid/{camera,build,props,palisade,wide-view,runlog}.ts` 의 `import`·`export` 목록 · `src/tune/params.ts` 의 `SPEC` 절 줄 번호와 `k()` · `src/night-main.ts:1-40` · `src/ui/realm/app.ts:6975-6995·1021·4511` · `battlefield.ts:522-525·2405` · `BASIC/BEATS/COUNTER` grep · `dash-lint`/`josa-lint`/`i18n-lint` 를 직접 실행(0 곳 · 0 곳 · 21,789 글) · 26·25·27·22·21(일부)·00(§7)·01(끝)·02(§7·§9·§11) 본문.
- **안 연 것**: `tactics.ts` 본체 수식(`frontQ`·`downOf`·`shareOf`·`groupPower` 내용 — 이름과 줄만) · `tests/realm/tactics.test.ts` 의 `:108`·`:355-404` 내용(26 에서 [옮김]) · `src/raid-main.ts:641-680`(스틱 — 26 에서 [옮김]) · `src/duel/` · `src/realm/vanguard.ts`(tactics 가 import 하는 모듈의 번들 영향) · `src/ui/realm/quality.ts` 의 함수 본문(이름만) · `docs/BALANCE.md` 구조 · `docs/realm/HERO-GROWTH.md` · `docs/realm/ODDS.md`(줄 하나만 확인) · 03·11~13·23 본문 · `public/realm/town/ground-*` 와 `raid/ground-*` 의 정확한 파일 이름(F3a 가 `ls` 로 확인) · `anim2/gen-*` 의 시나리오용 장수 열쇠 선정 · 지략(`ryak`) 분포(F6 의 정찰 단계 값).
- **재지 않은 것**: 모든 params 처음값(위 「[의견 · 근거]」) · 카드 규모(일) · 합계 · F7 의 5%p/20%p 가 새 규칙에서 맞는지 · F1b 의 30ms 가 실제 기능에서 나오는지 · F4a 의 「사기 하락 80%」 선.
- **배포 흐름**(`/ship` 스킬 · `.github` 워크플로)과 `gh run list` 출력 형식을 직접 안 열었다 — G1 앞에 코디네이터가 한 번 시험 배포로 `field.html` 이 Pages 에 뜨는지 확인한다.

### D-4. 32 「카드 차례의 구멍」 대조 (개정 30 + 이 장이 메운 곳)
| 32 가 짚은 구멍 | 어디서 메웠나 |
|---|---|
| 적 AI(F6)를 전제한 F1·F2 | F1b 의 `ai0.ts`(임시 AI)와 F1·F2 합격선이 그것으로 돈다. F6 이 `ai.ts` 로 갈아 끼운다 |
| 봇(F7)을 전제한 F4 | F4 합격선을 입력 줄 시험으로 바꿨다(개정 30). 봇은 F7 에서 처음 나온다 |
| `mapFor()`(F2) → F3·F6 | 순서가 맞다(F2a 뒤 F3a 는 시작 가능 · F6 은 F2 뒤) |
| 편 색 입히기를 받는 띠(F3) | F3b 4번 (1): 작은 새 함수 + 띠 종류별 한 장 나란히 스크린샷 + 안 갈리는 띠 목록 |
| `FightResult` 불변식 검사기(L1) | L1b 합격선에 넣었다(옛 판 1만 판 위반 0 + 일부러 어긋난 결과를 잡음) |
| 징병 → 전장 카드 없음 | **F9**(시험장 안에서) · **L4**(본편 징병 화면에서). L2 에 「직접을 고르는 길」 은 L4 와 L2 의 시작 화면이 같이 가진다 |
| 새 소리·군기·타일 때문에 G1 이탈 | B-4 의 임시 도형 고지 + 지인 인터뷰 한 줄. 그림 주문은 G1 뒤 |
| L3 의 비교 도구 자리 | L3 안에서 `tools/field-vs-fight.ts` 를 짓는다 |
| G1 의 「손 쓴 판 vs 빈손 판」 화면 | F8a 의 A/B 재생(`abview.ts`) |
| P3 의 「사람 판 싸움 수」 | 사람 판 기록이 없어 **봇 판 값**으로 라벨(P3 에 적음) |
| 린트(§10)가 어느 합격선에도 없음 | 합격선이 아니라 커밋 전 공통 검사(A-1)로 두었다(D-2 의 13) |
| STD 입력 이름 겹침(00 §7-7)을 받는 카드 없음 | A-6 의 공통 지침이 받는다(「STD 이름은 띠 열쇠로 · 덮어쓰기 전 확인」). F 카드는 새 그림을 안 만들어 닿을 일이 적다 |
| `hanbal.realm.battle0` 가 「새 전투」 스위치와 이름이 겹쳐 보임 | P2 는 `wipe.ts` 의 그 키를 **남기고**(옛 값 지움) b0 읽기 코드만 지운다. L 의 스위치 이름은 `hanbal.realm.liveBattle` 처럼 새 이름을 쓴다(L1c 에서 정한다) |

## 코디네이터가 받아 적은 것 (11-25)
- D-2 의 1(F6 은 `aiOrder` 를 불러 쓰지 않고 틀을 본떠 새로 쓴다) · 2(F8 을 a·b 로) · 3(P2 는 00 §7 의 1~3 만)은 30 에 그대로 받아 적었다(30 §9 · §13).
- 4 의 손재주 손잡이 셋과 `josa-lint` 에 `src/field` 더하기는 그대로 쓴다. 폰 방향은 위 결정대로.
- 5 의 시험 이름은 30 대로 `tests/field/` + glob.

- **형 11-25 덧(높은 곳)**: 「높은 곳 이런 지형적 이점에 따른 카드도 있었잖아. 이런 것도 반영 가능하려나」 → **F2 에 높은 터를 넣는다**(30 §3 의 새 줄). 바닥 종류 `high` 한 가지 · 그 위에 선 활 무리의 피해 배수는 지금 `P.realm.tacHeight` 값을 읽어 쓴다(새 숫자를 만들지 않는다) · 오르는 쪽 걸음 배수는 새 params(시작값 · F2 의 승률 방향 시험이 잰다) · 놓이는 조건은 지금 `Terrain.height` 가 켜지는 조건(`season.ts:1176·1386·1633`)을 `mapFor()` 가 그대로 따른다. 한 번 쓰는 땅의 수 카드(여울 막기 · 바위 굴리기 · 성문 깨기 · 불화살)는 F5(때 문)에서 「내 무리가 그 조각 위에 서 있을 때만」 뜨게 한다. F2 의 합격선(대로 대비 승률이 5%p 이상 움직임)에 「높은 터를 가진 쪽 +」 한 줄을 더한다.
- **형 11-25 덧(편성)**: 형이 하스스톤을 켜는 까닭은 「조합능력 · 확률예측으로 강한 덱을 구성해 맘편히 1등」이다(README 끝 절). → **F7 에 편성 봇 둘**(적 편성을 보고 상성을 맞추는 봇 · 아무렇게나 짜는 봇)을 더하고 30 §6 의 편성 줄(승률 차 ≥ 30%p)을 함께 잰다. **F9 편성 화면**은 고르기 전에 「이 편성이 적 편성에 얼마나 맞는지」(상성 표시 — 숫자가 아니라 무리끼리의 유불리 화살표)를 보이고, 정찰이 있으면 적 편성이 정확히, 없으면 범위로 보인다. 세 합격선의 크기는 편성 > 판단 > 손재주여야 한다.
