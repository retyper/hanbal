# Veo 제작 큐

이 CLI는 **브라우저를 자동 조작하거나 영상을 생성하지 않는다.** 저장된 프롬프트의 작업 선택, 제출 전 claim, 중복 제출 차단, 다운로드와 검수 ledger 기록만 담당한다. 실제 제출·다운로드·영상 검수는 별도로 수행한다.

프로젝트 루트에서 실행한다. 상대 파일 경로도 프로젝트 루트 기준이다.

```sh
node tools/veo/queue.mjs status
node tools/veo/queue.mjs peek
node tools/veo/queue.mjs claim bear-base --account account-a
node tools/veo/queue.mjs submitted bear-base --chat https://gemini.google.com/app/EXAMPLE
node tools/veo/queue.mjs downloaded bear-base --file outputs/veo/bear-base.mp4
node tools/veo/queue.mjs review bear-base --verdict accepted --note "표정·루프·구도 검수 통과"
node tools/veo/queue.mjs cooldown --account jay-u4 --until 2026-11-07T08:54:00Z --note "Gemini UI: 11월 7일 오후 5:54 재개"
```

모든 명령은 `--queue PATH`, `--state PATH`를 받는다. 기본값은 각각 `outputs/veo-production-queue.json`, `outputs/veo-production-state.json`이다. `peek`는 priority가 높은 작업부터 확인하지만 제출하지 않는다. `status`는 단계별 수와 활성 요청을 요약한다.

## 큐와 전이

큐는 `{ "jobs": [...] }` 또는 작업 배열이다. 각 작업에 `id`, `heroId`, `tier`, `inputPath`, `inputSha256`, `promptPath`, 숫자 `priority`, `authorized: true`, `framing: "portrait-head-to-pelvis"`, `aspectRatio: "9:16"`를 지정한다. `accountId`, `promptSha256`, `replacesAttemptId`는 선택 사항이다. 정사각형과 가로 구도는 허용하지 않는다.

- `claim JOB`: 원본 이미지·프롬프트 파일 존재와 원본 SHA-256을 확인하고 `claimed`를 기록한다. **브라우저 제출 직전에 실행한다.** 프롬프트 해시는 지정됐으면 비교하고, claim 시 ledger에 고정한다.
- `submitted JOB --chat URL`: 실제 제출을 확인한 뒤 `claimed → submitted`로 기록한다. HTTPS Gemini URL이 필요하다.
- `downloaded JOB --file PATH`: 실제 파일을 확인한 뒤 `submitted → downloaded`로 기록하고 영상 해시를 저장한다.
- `review JOB --verdict accepted --note TEXT`: 다운로드한 영상의 해시를 재확인하고 `downloaded → accepted`로 기록한다. 표정·신체/무기 일관성·시작과 끝의 루프 등 실제 영상 검수 결과를 note에 남긴다.
- `review JOB --verdict held --note TEXT`: 활성 요청을 보류로 종료한다. 생성 여부가 불명확하면 다시 제출하지 말고 기존 채팅부터 확인한다. 보류 자체는 재생성 권한이 아니다.

claim 이후에는 원본·프롬프트 해시를 모든 전이에서 다시 확인한다. 같은 job ID는 재사용할 수 없다. 같은 `heroId + tier`를 다시 만들려면 새 job ID, 명시적 승인, 해당 조합의 **최신 attempt ID**를 가리키는 `replacesAttemptId`가 필요하다. 이전 attempt가 활성 상태이면 먼저 실제 진행 상황을 확인하고 검토 기록을 남겨야 한다.

상태 파일은 `{ "version": 1, "attempts": [], "claims": {}, "accountCooldown": {} }` 구조다. `accountCooldown`은 계정 ID별 ISO 시각을 받으며 `"*"`는 모든 계정에 적용한다. 미래의 cooldown은 새 claim을 차단한다. CLI는 쿨다운 종료를 기다리거나 자동 재제출하지 않는다.

`cooldown --account ID --until ISO --note TEXT`는 job ID 없이 실제 UI에서 확인한 계정 쿨다운을 기록한다. 미래 ISO 시각과 빈칸이 아닌 관측 메모가 필수다. 위 예시 시각은 당시 관측값이므로 새 실행에서는 현재 UI가 표시한 미래 시각을 넣는다. 기존 배타 잠금·원자적 저장으로 `accountCooldown[ID]`를 갱신하고 `accountCooldownObservations`에 시각·메모·관측 시간을 누적하며, 기존 attempt/claim은 유지한다. `peek/claim --account ID` 또는 큐 작업의 `accountId`가 해당 계정을 선택할 때 차단한다.

## 중단과 잠금 복구

큐의 `sourceRepairDeferrals`는 `{ portraitId, tier, reason }` 목록이다. 해당 인물·단계의 원본 교정이 대기 중이면 기존 job의 `authorized`가 true이거나 같은 인물의 새 job이 추가되어도 `peek/claim`이 차단된다. job의 `sourceRepairRequired: true`도 같은 효과다. 교정본을 실제 검수하고 원본·해시를 갱신한 뒤 개별 해제한다. 제작 페이지의 완료 체크나 다운로드 파일 발견만으로 자동 해제하지 않는다.

상태 저장은 임시 파일과 원자적 교체를 사용하며, 쓰기 작업은 상태 경로 뒤의 `.lock` 파일로 배타 잠금을 잡는다. 오래된 claim·submitted·잠금은 자동 해제하지 않는다. 잘못된 JSON, 알 수 없는 상태, 해시 불일치는 작업을 중단시킨다.

잠금 오류가 나면 해당 CLI가 실행 중인지 먼저 확인한다. 실행 중인 작업이 없다는 것을 확인하고 큐·상태·잠금 파일을 백업한 뒤, 기존 Gemini 채팅과 다운로드 파일을 ledger에 대조한다. 그 후에만 남은 `.lock`을 수동 제거한다. 잠금 제거는 claim이나 제출 기록을 초기화하는 절차가 아니다. 상태가 불명확하면 ledger를 임의로 비우거나 재제출하지 않는다.

## 영상 중간 끊김 후보 찾기

```sh
py -3 tools/veo/continuity.py --video outputs/veo/portrait.mp4 --out-prefix outputs/veo/portrait-continuity
```

기존 OpenCV·NumPy·Pillow 환경을 사용한다. 모든 인접 프레임의 전체 화면/중앙 고정 인물 영역 픽셀 차이(MAE), median·p95·최대, 상위 8개 후보의 시각·0기준 프레임 번호·주변 변화 대비 배율을 JSON으로 저장한다. `-jumps.jpg`는 절대 변화량 순위, `-local-jumps.jpg`는 주변 대비 배율 순위의 전후 프레임 비교판이다. 큰 자연동작과 국소 변화 후보를 구분해서 본다. `--width 180`, `--top 5`처럼 분석 크기와 후보 수(5~8)를 지정할 수 있다. 중앙 영역은 사람 자동 검출이 아니다.

표준 출력은 메타데이터·MAE 요약·국소 후보 최대 3개 시각과 배율·산출물 경로의 짧은 JSON 한 줄이다. 전체 전이와 상세 후보는 기존 `<out-prefix>.json` 파일에 보존하므로 반복 작업에서는 요약을 먼저 읽고 필요한 구간만 확인한다.

첫끝 루프 이음새는 별도 JSON 지표와 `-loop-boundary.jpg`에 기록하고 중간 끊김 순위에 섞지 않는다. 큰 몸짓·불꽃·카메라 변화도 높은 수치를 낼 수 있으며, **도구는 자동 PASS/FAIL을 선언하지 않는다.** 수치만으로 채택하지 말고 후보 시각 주변의 원본 연속 재생으로 실제 결함을 확인한다. 원본 파일은 수정하지 않는다.
