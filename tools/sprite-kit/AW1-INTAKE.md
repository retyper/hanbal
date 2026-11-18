# 1차 각성 전투 띠 받아 넣기 (aw1-intake.py) · 열 줄 절차

저장소 뿌리에서 · python 은 `py -3 -I` · D:/에셋창고 는 읽기만 · git commit/push 는 하지 않는다(검토하는 쪽이 한다).

1. `py -3 -I tools/sprite-kit/aw1-intake.py stage` : D:/에셋창고(뿌리 · `Codex-claude35-*-candidates/`)에서 `sprite_aw1_<who>_act.png` + `_walk.png` 짝을 찾아 숫자 검사와 시험 굽기를 한다(이름 끝 -숫자12자리 사본은 안 본다). 짝이 덜 온 장수는 「짝 없음」 으로만 남는다. 투명 바탕이 아니거나 · 20/8명이 아니거나 · 칸 밖으로 잘린 판은 자동 반려되고 영수증에 영어 까닭이 적힌다.
2. `py -3 -I tools/sprite-kit/aw1-intake.py list` 로 검수 대기와 경고를 보고, 장수마다 `tools/out/aw1-intake/<who>/detail.png` 을 Read 로 연다. A 비각성 공격 칸 · B 각성 공격 칸 · C 각성 원본 스무 자세 · D 걷기 여덟 칸 · E 같은 배율 나란히 + 머리 자 + 각성 초상.
3. 공격 칸: B 가 A 와 같은 차례(서기 · 당김 · 맞닿음 · 뻗음 · 거둠 · 서기 / 활은 14 가득 당김 · 15 놓음)가 아니면 C 의 번호로 `stage --only <who> --attack a,b,c,d,e,f` 다시. 맞음·누움이 18·19 가 아니면 `--hit n --dead n`.
4. 머리·키: 머리말의 `head×` 가 「같은 키에서 각성 머리 높이 / 비각성 머리 높이」 다. 1.05 넘으면 경고 · 1.06 넘으면 accept 가 막힌다. E 의 하늘색 틀(비각성 머리가 각성에서 맞은 자리)이 머리가 아닌 데 걸렸거나 「머리 찾기 불확실」 이면 머리 자의 줄 번호로 `stage --only <who> --top-base y --top-aw y --chin-base y --chin-aw y` (top = 머리카락 위끝 · 관·깃털 뺌).
5. 통과 기준(전부 맞아야): head× 1.06 이하 · E 에서 머리 위끝이 흰 줄에 옴 · 옷이 한눈에 각성 초상의 것으로 달라짐 · 무기 갈래가 비각성과 같음 · C 스무 칸 내내 옷·무기가 한결같음 · 몸 둘레에 오라·빛·그림자 없음 · 천 비침·유두 윤곽 없음 · 카타나·닌자·붉은 해 없음 · D 걷기 1·5 다리가 반대이고 미끄러지지 않음 · 「걷기 판 등신이 동작 판과 다름」 이 10% 안쪽.
6. 통과: `review <who> accept --attack-ok --note "본 것 한 줄"` · 반려: `review <who> reject --reason "one English line"` (어느 판·몇 번 칸·무엇이 얼마나 인지 · 다시 그릴 문안에 그대로 붙는다). 애매하면 아무것도 하지 않는다 → staged 로 남아 목록에 뜬다. 11-18 첫 묶음에서 쓴 금: head× 1.06 이하 통과 · 1.06~1.12 보류 · 1.12 넘으면 반려 / 걷기 판 등신 차 10% 넘으면 걷기 판만 반려. 머리 비가 한도를 넘는데 눈으로는 같다고 보면 `--override "까닭"` 을 적어야만 넘어간다.
7. `py -3 -I tools/sprite-kit/aw1-intake.py install` : 받아들인 것만 `public/realm/anim-px/gen-aw1-<who>.png` · `duel/sprites` · manifest · `spritePx.ts` · `awakenedSpritesGenerated.ts` · `hero-height.ts` · `walk-cycle.ts` · `repair-pilot.json` 에 넣는다. 끝줄의 「bodyPx 비각성 n · 각성 n」 이 화면 몸 키 값이다(큰 관 때문에 칸에 다 못 담은 판은 각성 쪽이 작다 · 화면에서 그만큼 키워 그린다).
8. 형에게 보일 한 장: `py -3 -I tools/sprite-kit/aw1-intake.py sheet --status installed --per 12 --out D:/tmp-node/aw1/installed.jpg` (비각성 | 각성 | 걷기 1·5 | 공격 | 각성 초상). 보류·반려는 `--status staged` · `--status rejected`.
9. 확인: `npm run typecheck` · `npm test` · `node --experimental-strip-types tools/aw1-raid-probe.ts <who>` (5174 dev 서버가 떠 있어야 한다 · 열전에서 보통 모습 → 판 안 각성 → 걷기·싸움을 `D:/tmp-node/aw1/raid-<who>-*.png` 로 찍는다 · Read 로 본다).
10. 보고: 넣은 장수 · 보류(경고 줄) · 반려(영어 까닭 = 영수증 `tools/sprite-kit/aw1-intake-20261118.json` 의 `reason`) · 짝 없는 장수. 반려 줄은 `docs/realm/production/CODEX-SKILLBODY-REDO-20261117.md` 맨 아래 Claude 판정에 옮겨 적는다(검토하는 쪽).

## 덧붙임 (11-18 저녁)

- **저장 전에 스스로 재기 (Codex)**: `py -3 -I tools/sprite-kit/aw1-intake.py measure --who <who> --act <png> [--walk <png>]` · 영수증·저장소 파일은 건드리지 않는다(임시 폴더에서만 굽고 지운다). 출력은 영어·숫자 한 줄씩: `who=` · `cells_act=20` · `cells_walk=8` · `head_x=1.12`(비각성 gen-<who> 서기 칸 대비 · 같은 키에서 머리 높이 비 · 못 재면 `?`) · `head_detail=`(두 방향 값 · 닮음 · 머리 장식 px) · `walk_vs_act=0.90`(같은 몸 크기에서 걷기 머리 / 동작 머리) · `reason=`(HOLD·FAIL 일 때 영어 한 줄) · 맨 끝 `VERDICT PASS|HOLD|FAIL`. 금: head_x 1.06 이하 PASS · 1.12 이하 HOLD · 넘으면 FAIL / walk_vs_act 가 1 에서 10% 넘게 벗어나면 FAIL / 칸 수(20 · 8)·투명 바탕·칸 잘림은 FAIL / 못 재면 HOLD. 종료 코드 PASS 0 · HOLD·FAIL 1 · 모르는 who·없는 파일은 `VERDICT ERROR` 2. stage 가 재는 것과 같은 고리(fit_loop)라 숫자가 같다. 한 번에 20~40초.
- **다시 그린 판 이름**: `sprite_aw1_<who>_act_v2.png` · `sprite_aw1_<who>_walk_v2.png` (v3 …). stage 는 가장 높은 판을 쓰고 **같은 판끼리만** 짝짓는다. 동작 v2 + 걷기 v1(또는 그 반대)은 짝이 아니라 「짝 없음 · 기다림」 으로 남는다. 같은 이름에 덮어써도 내용이 바뀌었으면 다시 stage 된다(반려였던 것도 검수 대기로 돌아온다).
- **걷기 판만 다시**: 동작 판은 통과인데 걷기 판만 반려면 `review <who> reject --walk-only --reason "..."` 로 적는다(영수증 `actOk`). 그러면 그 동작 판(원판) + 더 높은 걷기 판(`_walk_v<다음>`)을 짝지어 받는다. 동작 판이 바뀌면 이 표시는 사라진다. 지금 표시된 장수(11-18 밤 · 걷기 1·5 같은 다리로 걷기만 반려): gomok · hojin · irang · base-w-13-young-archer · base-w-36-baekje-maena · base-g-09-farmer-conscript · base-w-79-yangmaek-solmae · sdallae · danbi · gom (단비·곰은 `stage --only <who> --attack 0,13,14,15,16,0` 으로 공격 칸을 손으로 골라 둠 · 동작 판은 그것으로 산다). 고은은 머리 ×1.065 라 동작 판도 반려.
- **열쇠가 둘인 장수**: 각성 띠는 게임이 그 장수에게 쓰는 열쇠(GEN_OWN · 전투 띠 줄 nonawakened-20261113/queue.json) 하나에만 붙는다. 옛 시험 띠 열쇠(`dalbit`)로 온 판은 자동 반려되고 까닭 줄에 쓸 열쇠(`base-w-31-dabeol-dalbit`)가 적힌다.

자세한 틀(머리 본 맞추기 · 키 맞추기 · 굽는 길)은 `aw1-intake.py` 머리말.

## 덧붙임 (11-18 밤) · 걷기 판은 비각성 걷기를 옷만 갈아입히는 편집

- **왜**: 새로 그린 각성 걷기 판이 거의 다 「네 칸 반걸음을 두 번 되풀이」 했다(1번·5번 칸이 같은 다리가 앞 → 늘 같은 다리만 나가 절뚝임). 그래서 SPA 걷기 문안은 비각성 띠의 걷기 여덟 칸(`assets_src/realm/sprite-prop/walkref-<who>.png` · 4x2 · `tools/sprite-kit/aw1-walkref.py` 가 `public/realm/anim-px/gen-<who>.png` 의 띠 4~11칸(0부터)에서 자름)을 IMAGE 1 로 주고 옷·빛깔·장식·무기 꾸밈만 바꾸게 한다. 둘째 참조는 각성 초상, 통과한 각성 동작 판은 맨 뒤.
- **네 칸 걸음 스무 명**: 비각성 띠가 네 칸 걸음을 두 번 늘어놓은 장수(곰·알영 등 · `walkref.json` 에서 4)는 1↔3 이 반대 다리다. 문안과 검사가 그에 맞춘다.
- **걷기 다리 검사 (stage · measure)**: 굽은 각성 걷기 여덟 칸이 비각성 걷기의 「같은 칸」 을 「반대 다리 칸(+4 · 네 칸 걸음은 +2)」 보다 더 닮았는가를 아랫몸 윤곽(덩어리 + 테두리)으로 잰다. 여덟 중 6칸 이상 · 가운데 차 .03 이상이면 통과. 아니면 measure 는 `VERDICT FAIL`, stage 는 **걷기 판만 자동 반려**(까닭 `walk frames 1 and 5 have the same leg forward (half cycle repeated); redo as a redress edit of the normal-form walk (...)`)하고 동작 판 머리가 금 안이면 `actOk`(by auto)를 적어 다음 걷기 판과 짝짓는다. 시험값: 비각성 걷기 빛깔만 바꾸고 흔든 판 .12~.29(8/8) · 앞 네 칸을 되풀이한 판 .00(4/8 이하) · 새로 그린 옛 판 -.03~.03. 금은 진짜 편집 판이 오면 그 숫자로 다시 본다.
- **걷기 머리 비**: `walk_vs_act` 는 이제 비각성 띠 안의 「걷기 머리 / 서기 머리」(이랑 .75 · 단비 1.10 처럼 장수마다 다르다)에 견준다. 비각성 걷기를 그대로 따른 판이 1.00 근처로 나온다.
