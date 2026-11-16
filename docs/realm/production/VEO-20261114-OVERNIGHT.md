# 11월 14일 새벽 제작

## 후속 사용자 교정: 미르 1차 한복

- 사용자가 일반판 원본의 차이나칼라/앞단추 의상을 중국풍으로 반려. 내장 image_gen 편집1회로 알영·버들 1차를 의상 참조해 낮은 겹침 깃/동정/고름/짧은 자주색 저고리/주름 치마/노리개로 변경했다. 가슴선·허리·한쪽 허벅지 노출과 불투명 가슴 안감을 유지. 얼굴·포니테일·자세·보라/붉은 효과 참조 유지. 육안상 고름과 한복 칼라가 읽히며 사용자 최종 평가는 아직 없다.
- canonical assets_src/realm/awaken/w-97-goguryeo-mir.png 및 public awaken-hd900/awaken320 교체 완료. 한복 원본/문안/영수증은 w-97-goguryeo-mir-hanbok-20261114.*. chat outputs/mir-awaken1-hanbok-20261114.png 및 .prompt.txt. HD SHA b05760ba38967cff346dc01c7125ac6fd45f0a5a1bfaf2af3c2dbc6f21ae1d53.
- 이전 높은 깃 원본은 assets_src/realm/retired/mir-high-collar-20261114 보존. 영상184는 사용자 의상 반려로 CLI review held 처리, 게임 미적용. 해당 job/attempt 입력 경로만 정확한 SHA의 보관 JPG로 연결하고 기존 입력 SHA/문안/영상 SHA를 유지했다. 새 한복 영상은 아직 생성하지 않았다. 후속 영상은 반드시 새 한복 source와 별도 replacement job을 사용한다. 2차 변경 없음. 커밋/푸시/배포 없음.

- 예약 `5-veo`: 11월14일 05:00 KST 1회 실행 완료. 아래 결과를 남기고 공식 automation 도구로 삭제 완료했으므로 현재 활성 예약이 아니다. 반복 예약을 만들지 않는다.
- 미르 w-97 1차 사용자 노출 지적: 기존 public awaken/awaken-hd JPG와 원본 PNG를 `assets_r19/realm/awaken*`에 보존, 새 영상 d4f0212b와 옛 x-mir-v1 영상은 `assets_r19/realm/awaken-loop`로 이동. 2차는 변경하지 않았다.
- imagegen 편집1회: 불투명 자주색 고깃 의상/허리·치마 안감으로 교정. 얼굴/머리/포즈 참조. 결과 육안 확인 후 canonical PNG와 HD900/320 JPEG88 교체. 원본과 픽셀 동일 얼굴을 보장하는 것은 아니다. 새 source SHA fdf8d0c22d399183fa5579b6ce6e0395555ea0a40acc82f7044dc279717bf443.
- 미르 기존183은 held/R19 보관. 새 replacement184는 Flow Jay(실제 jiiyea 계정) Veo3.1Fast, Ingredients, 세로720,8초,x1,20크레딧으로 제출/다운로드 완료. Gemini와 별도 풀인 `flow-jay`를 원장에 사용했으며 Gemini cooldown은 지우지 않았다. 결과 `Woman_stretching_hair_in_portrait_49250b7f.mp4`, chat outputs `미르-각성1-일반판.mp4`. 사용자 미평가, 게임 영상 미적용.
- 미르 무음 재생/샘플 프레임 확인: 머리카락을 풀어 내리는 동작, 팔/몸통/리본 움직임이 있고 의상은 덮여 있다. 얼굴은 원본보다 매끈하게 재해석돼 보이며 사용자 평가 필요. 190프레임/24fps/7.917초/720x1280. 움직임 검사 좋음(끝/중간0.59,튀김0.73,정지0초,국소변화1.5). 정확한 시작끝 일치는 요청하지 않았으며 loop 경계 차이가 크므로 강제 반복 연결은 하지 않는다.
- 갈매182: 초기 서비스오류 held 기록 보존 후 사용자가 같은 대화에서 후속 요청해 성공한 aaa31a23을 downloaded로 감사 이력과 함께 복구했다. 기존 prompt SHA를 후속 문안으로 덮어쓰지 않았다. chat outputs `갈매-각성1-aaa31a23.mp4` 보존. 자동검사10초/720x1280/정지0초/국소변화1.1 좋음. 사용자 성공평가 있음, 게임 적용 승인은 별도 확인 전이다.
- 사용자 요청대로 bake-pack 기존 긴 구성(캐릭터별 목적 동작,10초타이밍,얼굴/스타일 잠금)을 참고했다. 신체 특정 성적 부위 지시 대신 전신 중력·관성·호흡,천/머리/장식 지연과 감쇠로 구성. 미제출 BODY MOTION 문안 두 건은 새 파일에 수정, 이미 시도한 문안/해시 보존. 페이지는 실제 남은8개 기준 재생성했으며 예전24개 스냅샷과 수가 다르다. 새 source는 페이지 재생성으로 반영된다. 제출 시 파일 문안/해시가 우선이다.
- Jay Flow 현재 0크레딧. 충전/구매 없음. 새벽5시에는184가 이미 만들어졌음을 먼저 확인하고 미르를 중복 생성하지 않는다.
- 전투 에셋 작업은 queue.json 진행 수치 기준, 모든 검수 무음. 커밋/푸시/배포 없음.

## 05:00 예약 실행 결과

- 거타 replacement186 `t1-geota-v1-r-20261113`: Flow hepastosian 실제 계정 확인, Veo3.1Fast/Ingredients/세로720/8초/x1/20크레딧 선택 후 1회 제출. 다운로드 완료, SHA 0b207e6266fbab93798e5f0cd912a60e685814b6f46d4ecb8144c6410681c681. chat outputs `거타-각성1.mp4`, `거타-Flow-완성화면.png`, `거타-영상-동작비교.jpg`, QA JSON 보존. 실제 190프레임/24fps/7.917초. 무음 전체 재생 확인: 몸통·망토·머리카락·호흡 움직임. 다만 3/4 얼굴이 정면으로 바뀌며 중간 미소와 허리 장식 변형이 있어 사용자 평가 전 게임 미적용.
- 긴 실제 문안 `veo-queue-prompts/geota-t1-motion-20261114-flow8.txt`, SHA f0c3a7e7ad538cecca41d3e4dee5f89a07fa90efe4f332ae773cf0708dd86a84. 기존 미시도 문안만 제출 전에 수정했고 시도한 해시를 덮어쓰지 않았다. 전신 중력/관성/목적 동작 중심이며 특정 성적 신체부위 집중 지시는 제외했다.
- Gemini Jay 185 타해너울 Argon: 제출 후 생성 영수증/영상 없이 초기 화면으로 돌아옴. 중복 재제출하지 않고 held. 187 물새 3.1Pro: 서비스 오류 후 같은 대화 1회 후속 요청도 텍스트 전용 응답, held. 188 유천간 Hydrogen: 서비스 오류, held. 모델은 원래 Argon으로 복귀. 세 경로 실패 후 종료했고 정책 거절이나 새 쿨다운으로 추정 기록하지 않았다. outputs `Gemini-새벽-생성오류.png`, `Gemini-유천간-서비스오류.png`.
- 원장 구102 물새/131 유천간은 정확히 같은 SHA의 R19/retired 원본에 역사 경로만 복구하고 사용자 기존 교체 요청을 근거로 held 처리. 원래 입력 SHA/문안 SHA/다운로드 영상은 그대로 보존. 이후 새187/188 실패 기록과 구분한다.
- Flow hepastosian 20→0, 표시한 재개 시각 11월14일15:14KST. Flow Jay0, 표시한 재개 시각 11월28일17:23KST. 구매/충전 없음. Gemini hepastosian 무료 계정에는 동영상 도구 없음. Gemini Jay 서비스 복구 시각은 미확인.
- bake-pack 최신 재생성 결과 Veo3개. 제출 가능 카드와 서비스 복구 여부는 별개다. 다음 작업은 실제 Gemini 정상 여부 확인 후 원장 claim 가능한 미시도 작업만 진행. 기존 downloaded/held를 자동 중복 생성하지 않는다.
- 비각성 전투 에셋은 자녀 제외210종 전원 반영 완료. 초기205회+선별 교정13회. 상세 NONAWAKENED-ALL-20261113.md. 최종 TS12/Python4/typecheck/build/예산 통과. 실제 본편은 대표 장수 무음 검수이며 전원 개별 플레이는 미검증.
