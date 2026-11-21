# 56-A 영구 각성·모습·투지 분리 · 2026-11-21

## 구현
- 목책/도깨비 승리 또는 기존 실제 각성 증명은 이름난 사람별 영구 단계로 보존한다. 출전부터 끝까지 힘·공격속도·이동·비기 재사용 배수가 유지된다.
- 본편 장수창과 열전 출전창의 요청된 모습 스위치 하나씩은 같은 profile을 사용한다. OFF는 모습만 기본형이며 힘은 유지한다. 영상·초상·피격·sprite·영웅전도 같은 모습값을 읽는다.
- 모든 새 판의 게이지/단추는 투지다. 시간제 힘과 수동 비기 1회 강화는 독립하며, 강화 차지는 버프 종료 후에도 유지되고 실제 수락된 수동 비기에서만 소모한다.
- 본편 시련 입구·보상과 공훈 자동 각성은 legacyAwakeningOpen=0으로 닫았다. 옛 시련 코드는 남긴다. 튜토리얼 말갈기의 빌린 경험만 region+id로 보존하고 전역 각성 증명에서는 제외한다.
- 기록에 56A 규칙/영구 단계/모습 snapshot을 명시한다. 이전 53B/버전 없는 기록은 이전 규칙을 그대로 재생한다. 진행 중 storage 변경은 현재 판을 고치지 않는다.
- 상자 무료 능력 선택 직후의 HUD 갱신 키에 offer nonce/잔여 선택 수를 포함했다. 기존 레벨 변화에만 의존하던 표시 지연을 수정했다.
- 반복 sprite manifest를 순수 생성 함수로 묶고 생성 도구도 맞췄다. 실제 export 값·필드 순서·nested 배열 독립성·289 geometry/경로는 동일하다.

## 직접 검수와 범위
- 관련 sim 61/61, 본편/저장 79/79 및 최종 저장 10/10. 세 fixture는 기존 시련각성/미각성/목책clear이며 serialize→write→read→migrate 왕복, 기존 stats/무관 필드/실패 복구/중복 보상 방지를 검사했다.
- 새 각성 sound tier와 gold cast 검사는 변경 전 각각 RED를 본 뒤 GREEN. 독립 코드 검수에서 누락된 cast/shake의 awakened 필드 두 곳을 고쳤다. draw 전후 상태 deepEqual로 읽기만 함을 확인했다.
- 첫 전체 1743: 통과1740/실패1/기존 DLC skip2. 실제 tutorial 회귀를 기존 검사 약화 없이 고쳤다. 최종 전체 1744: 통과1742/실패0/기존 DLC skip2,108.937초.
- typecheck 및 PUBLIC_BASE=/hanbal/ build 통과. raw4959.4KB/gzip1547.6KB, 예산 여유40.6/52.4KB. 53B 대비 raw 순감28.7KB는 전체 변경의 합이며 manifest 단독 절감량으로 주장하지 않는다.
- 실제 로컬 운영 번들 realm.html/raid.html HTTP200, HTML의 JS/CSS6개+이미지2개 HTTP200/SHA 일치. version timestamp는 로컬 빌드 규칙이며 CI에서 commit SHA가 들어간다.
- 실제 사용자 저장 접근/clear/delete0. 실제 UI 검수는 별도 격리 합성 저장을 공식 가져오기와 실제 입력으로 확인하며 일반 플레이 소유권/목책 실제 clear/실폰 FPS 증거가 아니다.

## 남은 마감
실제 UI 3사례 마감은 아래에 기록했다. commit/push/CI/운영 해시 검증은 배포 뒤 기록한다.

## 근거
Ctask/outputs/codex56A/{SIM-RESULTS.md,persistence-result.md,INDEPENDENT-PRESENTATION-REVIEW.md,full-01.log,full-02.log,presentation.red.log,cast-tier.red.log,regressions-green.log,build-01.log,local-bundle.json,ui-qa/}.
Ctask/outputs/codex55-prep/manifest-optimization/RESULT.md.
Ctask=C:/Users/my/Documents/Codex/2026-11-17/detail-bad-request.

## 실제 UI 마감
- 구시련27, 미각성22, 목책완료32 = 3사례 총81검사 통과. 공식 파일 가져오기, 실제 첫 계절 입력, 장수 OFF/ON 및 새로고침, 수동 슬롯 저장/불러오기, 명부 선택, 출전 모습 OFF/ON 및 재접속, 실출전 경로를 확인했다. 시작 permanentAwake=true/false/true와 form=normal 관찰. JS0/sourceStable/격리 프로필 정리 성공.
- 목책 원 seed56003은 무관한 사신 결정 이벤트로 중단했다. 같은 초기판 seed56001 통제 fixture를 새 파일로 만들어 각성 증명만 대조했고 원본/실패 로그를 보존했다. 실제 목책 clear 증거가 아니다.
- 폰360/375/390/412x844 및844x390에서 스위치/출전 단추10개 viewport 내부 및 실제hit, 가로overflow0. DPR2 headless 모사이며 실제 폰 FPS 증거가 아니다. root가 실제 시작2종, OFF메뉴, 장수 재로드 화면을 직접 검수했다.
- 중간 도구 ERROR(알림/결과창 닫기 누락, 새문서 loader 대기, 준비 전 숨겨지는 투지 버튼 검사)는 보존했고 최종 PASS와 분리했다. 시험 난수 때문에 나온 무관한 결정은 우회하지 않았다.
- 표시명만 정리한 뒤 typecheck 포함 최종 build4959.4KB와 local-bundle-final.json을 재검증했다. commit/push/CI/운영은 배포 뒤 기록한다.
