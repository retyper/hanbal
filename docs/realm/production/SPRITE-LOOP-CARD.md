# 전투 띠 제작 줄 · 일 카드 (에이전트에게 통째로 넘기는 고리)

> 11-24 형: 「잘되고 있다면 사용량 아끼게 오퍼스로 시키는 것도 고려해」 → 길이 잡힌 반복 고리는 `model: opus` 에이전트 하나에게 이 카드째 넘긴다.
> 기준 문서: `ART-SKELETON.md`(§11 몸의 뿌리 · §12 참고 게임) · 지금 상태: `CLAUDE-HANDOFF-20261124.md` · 공용 스킬: `sprite-anim-harness`.
> 이 카드의 길을 벗어나 새 방법을 만들지 않는다. 새 인형·새 규칙이 필요한 일은 보류하고 보고한다.

## 먼저 읽을 것
1. `CLAUDE-HANDOFF-20261124.md` (장수 표 · 알려진 흠)
2. `D:/에셋창고/CLAUDE-TO-CODEX-NOW.md` 맨 위 `## ★` 블록 열 개쯤(주문·검수 글의 말투와 형식을 그대로 따른다) · `D:/에셋창고/CODEX-TO-CLAUDE-LATEST.md` 끝 60줄
3. `tools/sprite-kit/` 의 `anim-harness.py` · `wire-hero.py` · `scene-pack.py` · `patch-merge.py` 머리말
4. 메모리 `battle-art-bible.md` · `look-at-gif-frames-before-sending.md` · `failure-verify-first.md` · `edit-files-with-scripts-lf.md`

## 고리
Codex 는 NOW 파일을 2분마다 읽고 그림을 `D:/에셋창고/STD/out-….png` 로 두고 LATEST 파일 끝에 `### NN 전달` 을 붙인다.
1. **기다린다**: Bash `run_in_background` 로 `F="D:/에셋창고/CODEX-TO-CLAUDE-LATEST.md"; n=$(stat -c %s "$F"); until [ "$(stat -c %s "$F")" -gt "$n" ]; do sleep 30; done; sleep 20; tail -c 900 "$F"`. 40분 조용하면 한 번 더, 두 번 연속 조용하면 멈추고 보고.
2. **굽고 본다**(아래) → 3. **검수 글**을 NOW 의 `## ★ 주고받기 약속` 절 바로 다음에 끼운다(스크립트 파일로 · utf-8 · LF · `key='## ★ 주고받기 약속'; i=s.index(key); j=s.index('\n## ', i+5)+1`). 스크립트는 세션 스크래치 폴더에 Write 로 만들어 `py -3 -X utf8` 로 돌린다(bash heredoc 에 한글·따옴표를 넣으면 깨진다).
4. 장수 한 명이 다 모이면 띠 → 검사 → 게임 → 커밋·푸시.

## 장수 한 명의 차례
1. **고르기**: `tools/sprite-kit/hero-types.tsv` · 무기가 두 손 긴 자루(창·작살·도끼·노 = `pole2`) · 활(`bow`) · 한 손 칼(`sword`)인 장수만. 지금 띠 `public/realm/anim-px/gen-<열쇠>.png` 의 첫 칸을 잘라 보고 확인(칸 폭은 `manifest.json`). 낫·부채·쌍검·방울·맨손 등은 인형이 없으니 건너뛴다. 남자 장수는 인형이 없다.
2. **서기 주문**: 장면 `STD/style-scene-f-<M|L|XL|sturdy>.png`(가슴·뼈대에 맞는 것) + 초상 `public/realm/bust/<bustId>.jpg` → `STD/ART-<이름>-bust.jpg` + 지금 띠 0·14번 칸을 자홍 바탕 3배로 `STD/<이름>-cell0|14.png`. 생김새·옷은 **초상을 직접 보고** 적는다. 꼭 넣을 것: 얼굴 규칙(밝고 고른 살 · 또렷하고 단순한 눈·입 · 눈가 그늘·붉은 기 없음 · 눈 모양·나이는 초상 그대로) · 키는 양옆 사람과 같게 · 무기 쥐는 법(가까운 손 = 자루 끝) · 그림자 없음 · 자홍 테두리에 보랏빛 없음.
3. **서기 검수**: `bake-scene.py stand <out> <이름> 3 h=138` → 게임 크기 얼굴을 8배로 잘라 본다.
4. **장면 만들기**: `scene-pack.py <이름> pole2|bow|sword <걸음 결> <e|e2> [가슴 M|L|XL]` → 걷기 · 공격(창 = thrust a·b · 칼 = slash a·b · 활 = bow) · 쓰러짐 · 개성 동작. 문안은 해적 두목(27~30·33) · 궁수(25·26·31·32) · 아라(53~57) 를 본뜬다. 하네스 `HEROES` 에 줄을 더한다.
5. **장마다 굽기와 볼 것**
   - 걷기 `anim-harness.py walk <이름>` → `chk-<이름>-legs.png`(같은 열의 위·아래 다리가 반대) · `chk-<이름>-walk-zoom.png`(윗몸·얼굴 같음 · 무기 쥠 · 몸이 서기와 같은 사람 · 얼굴 읽힘)
   - 공격 `anim-harness.py attack <이름>` → `chk-<이름>-<공격>8.png`(무기 하나 · 앞발 같은 자리 · 「칸 밖」 경고 없음)
   - 쓰러짐 `bake-scene.py fall <out> <이름> <scene>` → 네 칸을 늘어놓아 본다(팔다리 이어짐 · 누운 폭 208 안 · 무기 없음)
   - 개성 동작 `anim-harness.py quirk <이름>` → `chk-<이름>-quirk.png`
6. **띠**: `anim-harness.py strip <이름>` → `판정: 합격` · `chk-<띠>-flowframes.png` 를 본다(칸마다 온몸 · 동작 사이 크기·자리). 공격 묶음을 서기에 잇는 것은 하네스가 스스로 한다.
7. **게임**: 옛 띠를 `tools/out/strip/old-gen-<열쇠>.png` 로 복사 → `strip <이름> install` → `wire-hero.py <열쇠> [act atk8 hit=4 quirk=.3,.32,.4,.28]`(활은 `quirk=.28,.3,.42,.25` 만) → `npx tsc --noEmit -p .` · `npm test`(실패 0) → 그 장수의 파일만 add(`git add -A` 금지) → 한글 커밋 + 세션의 attribution 두 줄 → push.

## 막혔을 때 (밤새 겪은 것)
- **그림 도구 거절(moderation_blocked)**: 다시 시키지 않고 말을 바꿔 넣게 하지도 않는다. 공격 b 가 없으면 `cells8=[a1,a2,a3,a4,a4,a3,a2,a1]` · `legacy=(a1,a2,a3,a1)` · wire `hit=3 times=.09,.08,.11,.12,.12,.08,.08,.12`. 활 쏘기가 없으면 그 장수는 보류.
- **한 부분만 틀림**(윙크 · 손이 셋 · 창끝이 잿빛 네모 · 먼 다리 어두움): 그 부분만 고친 판을 다른 이름으로 받아 `patch-merge.py face|legs|tip` 으로 얹는다. 원본은 `-v1`. 새로 그리게 하면 몸이 달라진다.
- **다시 그리기는 장마다 한 번.** 두 번째도 흠이면 나은 쪽을 쓰거나 보류.
- 검사 「서기↔걷기 키」 → 서기를 `h=<걷기 가운데 값>` 으로 다시 굽는다. 「잘림: 칸 12~17」 → `legacy` 를 덜 뻗은 칸으로. 다른 불합격을 두 번 못 풀면 보류.
- **합격선을 낮추거나 검사를 끄지 않는다.** 가설로 갈아엎지 않는다.

## 지킬 것
- 한글로만. 눈으로 안 본 것을 봤다고 쓰지 않는다. 이미지는 한 번에 한두 장만 본다.
- 쓰러짐 옷: 앳된 장수·긴 치마·바지 차림은 단정하게. 어른 장수도 불투명 · 15세 선(비침·유두 윤곽 금지).
- 일본·중국 결 · 붉은 해 · 닌자 금지. `src/sim/` 손대지 않음. 브라우저·Downloads 손대지 않음. dev 서버는 5174.
- 끝낼 때 `CLAUDE-HANDOFF-20261124.md` §3·§4·§5 를 고쳐 커밋·푸시하고, Codex 에게 「차례 끝 · 새 지시 대기」를 남긴다.

## 보고
장수마다 [받은 장 · 합격/보류와 까닭 · 게임에 넣었나 · 판정 줄 · 커밋] · 거절된 장 · 부분 보정 · 하네스를 고친 곳 · 시험 숫자 · 못 본 것.
