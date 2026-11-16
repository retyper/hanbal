최신 판정: 사용자는 고은·큰돌 corrected보다 previous를 선호. previous 복구 완료, 추가 작화 idle은 5명. PROPORTION-V2-20261113.md 최상단 참조. 아래는 이전 경과 기록.

# 사용자 등신 비율 지적 — 최신 우선

사용자: 「유닛들 등신 비율 제대로, 후반부 거의3등신」. 같은 화면높이/발줄만 맞추고 머리·몸통·다리 비율을 충분히 검수하지 않은 문제 인정.

- 이번 남은27명 대기원화7회생성(27명×3컷), 모두추출/경계검사통과, 일시적용했으나 사용자지적으로27명idle적용 취소. 원래32명 중알영+앞선4명만idle유지. 단순 세로늘이기 금지. 후반부 기존 전투원화 자체도비율재검토필요.
- config-before-proportion-review 및 generated-receipts, remaining1..7.png에 후보보존. remaining-queue는전부held-proportions. 다시생성전같은job을자동재실행하지않음.
- rollback-proportions.py→대상32개만normalize완료. 그중27명기존base16/haebi20로복귀,drawnIdle.ts는5명. 본편512이동·전투컷은 이번작업전과 동일. 직전중간상태의32명완료보고는철회.
- 전체normalizer를실수로대상인자없이실행해확인된해당프로세스만중지하고대상32로재실행했다. unrelated원화/원본은삭제·reset하지않음. 전체normalizer일부비대상출력은재현변환가능성이있어기존dirty상태에서분리확정못함. 무관변경임의되돌림금지.
- 큰돌/고은비율기준안 imagegen1회. 얼굴·복식·무기는유지하면서4.5등신 요청했으나 결과는다리가더긴성인형(정확4.5판정안함). candidate proportion-calibration.png 및 outputs/등신비율-큰돌-고은-기준안.png. 게임미적용. 사용자에게 알영정도4~4.5 vs 새긴성인형선호질문답대기.
- 다음: 선호답받아비율고정된기준원본부터선정→전투/이동/idle을같은캐릭터비율로일관되게제작. 헤드/몸/다리랜드마크로수치검사하고실화면크기로다시확인. 머리크기유지한채몸만늘여해결하지말것.
- 직전 build는27명임시적용중실행된것이라최종rollback검증으로주장하지않음. rollback뒤TS시험/타입검사는별도확인. 현재생성중0·commit/push/배포없음.
