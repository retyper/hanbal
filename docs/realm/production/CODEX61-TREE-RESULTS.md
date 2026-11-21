# 61-1B 스킬 트리 가시성

세 갈래를 나란히 두고 같은 단계끼리 맞췄다. 각 스킬에 이름·랭크·직접 선행과 갈래 누적 조건을 붙이고, 조합은 카드 안에 필요한 스킬과 단계를 표시한다. 긴 교차 점선 대신 짧은 직각 연결과 선택한 선행 경로를 강조한다. 새 버튼0. 실제 성장 선택/해금/조합 조건 변경0.

- 최소 글자12px, 좁은 화면은 세 열을 유지하며 세로로 스크롤한다. 조합과 최종 강화도 같은 흐름에서 확인한다. 기존 돌아가기/Enter/Escape 입력 유지.
- 기존 화면 RED4→새4GREEN, 관련28/28. 별도12px/Esc 반례 RED→GREEN 보존. 실제 공식 장수 선택·출전·성장 선택·트리 열기·휠·잠긴/선택가능 칸·키보드 입력으로 **6폭156검사 PASS**. 360/375/390/412×844,844×390,1280×720, 사진24장. JS오류0/sourceStable/임시프로필정리. root PC/가로/폰 top 및 폰 bottom·가로 combos를 직접 눈검수했다.
- 실제 장수는 칼 아라다. 단검 실전 검증을 했다는 주장은 하지 않는다. 합성 소유 fixture이며 실제 사용자 저장/소유 변경0. 구조 검사는 모든 무기 트리를 포함한다.
- 검증 로그·원 사진: C outputs/skill-tree-visibility/actual-ui-01, CSS-12PX-HANDOFF.md. 격리 critical7314614c 기반에 트리만 추가했으며55 변경은 D에 보존한다.
- 최신 타입/전체시험/빌드·compiled 로컬 응답 숫자는 C outputs/codex61-tree/에 보존하고, 커밋 즉시 push 뒤 CI·운영 SHA를 CODEX-TO-CLAUDE-LATEST.md에 기록한다.

- 단독 배포본 최종: typecheck0, 전체 **1808개/1806pass/0fail/기존skip2**,148.389초. build **4986.1KB raw/1555.1KB gzip**, compiled raid.html200/JS6CSS1·기존PNG2SHA 일치. 앞 홈런 CI44898685046 success·운영7314614c9a/9asset200SHA 일치 확인 뒤 이번 단계를 커밋한다.
