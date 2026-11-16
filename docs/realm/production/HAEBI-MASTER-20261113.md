# 해비 새 전투 원화 · 2026-11-13

사용자가 기존 얼굴 보정 실패 후 「하나 제대로 이미지까지 만들어」 요청. 해비 한 명을 실제 생성해 게임에 적용했다.

- 내장 image_gen 사용 1회. 기존 해비 초상은 정체성, 기존 액션 시트는 의상/동작 참고. 최종 프롬프트는 tools/sprite-kit/masters/haebi-20261113.prompt.txt.
- 새 마스터 tools/sprite-kit/masters/haebi-20261113.png: 1254×1254, 실제 RGBA 투명, 3×3 아홉 자세. 얼굴·눈·코·입은 생성 원화 자체를 사용하며 합성 점/입선은 없다.
- bake-haebi-master.py: 시트 전체에서 연결된 9명을 추출하여 칸을 넘은 부분도 보존. 알파 보존, 공통 배율로 1회 축소. 추가 팔레트 제한/윤곽/얼굴 픽셀 덧칠/상체 늘리기 없음.
- 최종 public/realm/anim-px/gen-haebi.png: 칸200×160,20칸,몸높이139. 20개 독립 그림이 아니라 9자세를 게임 순서에 재사용한다. 달리기는 제공된 세 자세를 반복한다.
- 대기 0~3, 공격준비12,복귀17은 동일 픽셀. 머리/무기가 숨쉬기 때문에 커졌다 작아지지 않는다. 무기 끝 타격점은 [14,0.86,0.73].
- 재현: py -3 tools/sprite-kit/repair-pilot.py --out tools/sprite-kit/repairs/20261113 후 node tools/sprite-normalize.mjs gen-haebi. haebi pipeline은 generated-master라 이전 Gemini 그림으로 회귀하지 않는다.
- 원본/프롬프트와 이전 그림을 보존. 이전 해비는 assets_src/realm/retired/haebi-before-generated-20261113.
- 검수: Python4, 관련TS10, typecheck 통과.20칸 머리/벽 접촉0,manifest/실제PNG 일치,공통6칸 바이트 일치. Chrome 데스크톱 및390px 대기·실전 도끼들기 확인,콘솔오류0.
- 사용자 최종 미술평가 대기. 생성 호출은1회이며 과금/차감량은 도구가 제공하지 않았으므로0크레딧이라고 하지 않는다.
- 10초 등장영상 설정 유지. 커밋/push/배포하지 않았다. 알영은 이번 새 원화 제작 범위에 포함하지 않았다.

사용자 산출물은 채팅 outputs/haebi-new: 마스터, 게임 띠,20칸 접촉 시트,프롬프트,원본해시/동작보고서,게임 스크린샷.
