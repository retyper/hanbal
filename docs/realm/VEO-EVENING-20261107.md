# 11월7일 저녁 1차각성 영상 적용

## 쇠눈 w42

- 원본 `public/realm/awaken-hd/w-42-gwanna-soenun.jpg`, game `gwanna-2`. 출전 전 투구를 마지막으로 바로잡는 장면 맥락, 양손 접촉/갑옷/얼굴/한정된 호흡과 후행을 보존.
- [실제 대화](https://gemini.google.com/u/4/app/cbef2010f4d4450e?hl=ko), `t1-soenun-first:9`, 1회 생성. 결과 dbdb2cdf,720×1280/24fps/10초,7254025바이트. `public/realm/awaken-loop/w-42-gwanna-soenun.mp4`, SHA256 `9be17c67b3c254af063afe26da910210de145fd299e5cfd1e60214c98f2b70e9`.
- Root+독립 시각 검수 PASS. 3.917/7/9.333초 분석후보 앞뒤에 뚜렷한 내부 컷/손분리/소품변형 없음. 호흡은 절제된 편, 완벽루프와 직접청취/입모양동기는 미검증.

## 범 w60

- 원본 `public/realm/awaken-hd/w-60-golbeol-beom.jpg`, 인물/호랑이뺨표식/의상/경계자세의 작은 무게이동을 보존. 기존 Night-Panther의 범발 w68 진각성과 다른 인물이다.
- [실제 대화](https://gemini.google.com/u/4/app/12a9c05cfd49d0f9?hl=ko), `t1-beom-first:10`, 1회 생성. 결과 c27c61d7,720×1280/24fps/10초,6327749바이트. `public/realm/awaken-loop/w-60-golbeol-beom.mp4`, SHA256 `8fc0343e958293add976b87994dec77ee507a63aff4796f1d63c22ce975f0f96`.
- 기술검수에서 전방오른손 일부가 왼경계에 잘려 HOLD였으나, 사용자가 현재 결과가 좋고 손잘림을 허용한다며 적용을 명시 승인했다. 같은파일채택이며 재생성하지 않았다. 종료된 최초HOLD를 지우지 않고 reviewHistory에 기술검수와 사용자승인을 보존한 수동정합 기록이다.
- 보이는 얼굴/표식/손톱/옷·자연스러운표정은 유지,7.833/8/9.333초 명확한컷없음. 직접청취/립싱크 미검증. 다음영상에서 idle체중이동과 가슴/상체/옷의 자연호흡을 약간더읽히게 하라는 사용자지시를 공통규칙에 반영했다.

## 게임 표시·검증

두 파일 모두 AWAKEN_LOOP에 등록하며 정사각 보정 목록에 넣지 않는다. 실제 게임의 전략회의 CSS/마스크 fixture에서 두 동영상720×1280/readyState4/currentTime증가/muted와 주변부 마스크 표시를 확인했다. 원본 MP4는 리사이즈/패딩/크롭/재인코딩하지 않았다. 관련19테스트·타입/빌드/예산 통과. 공개 배포 여부는 [공통 인수인계](../../HANDOFF.md)의 실제버전/해시 기록을 따른다.

## 신지 너울 w85

- 원본 `public/realm/awaken-hd/w-85-sinji-neoul.jpg`, game `wander-22`,22세1차각성. 잠수 뒤 잠깐 숨을 고르는 장면, 원래 머리뒤손가림/허리손전체/등후크·화살묶음유지, 조금더읽히는자연호흡과작은체중이동을 요청했다.
- [실제 대화](https://gemini.google.com/u/4/app/f9ec244bd6e663d4?hl=ko), `t1-sinji-neoul-first:11`,1회생성. 결과30df5516,720×1280/24fps/10초,5755271바이트. `public/realm/awaken-loop/w-85-sinji-neoul.mp4`, SHA256 `c1eb0a06d0eab5d2b2ede91521578995c785ff9330efb24dbb9eecc9d8f8dd36`.
- Root+독립시각PASS. 얼굴/옷/장비와보이는손유지,3.875/6.667/8초후보명확한컷없음. 배경은0–3초점진적으로밝아지며단발조명리셋아님. 완벽루프/정확한호흡후행위상/직접청음·립싱크미검증. 원본파일그대로등록. 실제다음u4한도2026-11-07 22:54KST안내를확인해원장과기존veo-1예약에반영했다.

## 공개 배포 복구 진행

첫묶음866620df의 run42363071927은타입/전체테스트/빌드/예산PASS후syncing_files10분시간초과로실패,해당배포취소를로그로확인했다. 19:31공개버전1f942bbccd여서이번묶음미반영이다. 새로검수된너울영상과이실제기록을포함한새빌드로1회진행하며같은아티팩트를계속재시도하지않는다.

## 공개 배포 확인 완료 — 19:40 KST

후속b429115f/run42364470090 전체test/build/budget/deploy SUCCESS. 공개version.txt=b429115f60,소리PNG및위세MP4 모두HTTP200/상기바이트/SHA256검수본일치. 첫866620df의미반영은이완료기록으로해소됐다. 정확한배포장애원인은미확정이며타임아웃임의연장/같은실행무한재시도를하지않았다.
