# 알영 작화 대기 3컷

2026-11-13. 사용자: 병사처럼 장수도 실제2~3컷 idle 필요, CSS 흔들림 금지, 앞으로4×5 허용.

- 단궁 얼굴줄 교정 완료 후 전투 에셋 재개. 4×5 20포즈를 요청했으나 생성 결과는4×4 16포즈. 전체 대체하지 않고 첫 줄의 일관된 idle3컷만 채택. 생성1회, 재시도0. 원본 `idle-frames-20261113/aryeong-idle-master.png`, 프롬프트는 해당폴더 및 채팅 outputs.
- `bake-idle-supplement.py`가 동일 배율로 추출/다운샘플하고 발 기준 정렬. 얼굴 덧칠·신체변형·전체이미지 회전 없음. 본편20칸의0..3만 A/B/C/B로 교체. 기존4..19 이동/공격/피격/쓰러짐16칸 바이트 동일 확인.
- 겨루기는 기존16포즈 뒤3idle 추가한19칸. atlas idle[16,17,18,17],650ms간격(2.6초 주기). 나머지 공격·막기·비틀거림 프레임은 기존그대로. normalizer 원본해시와 repair-report 연동; 재굽기로 되돌아가지 않음. 미리보기의16칸 고정폭 계산도 atlas.cells로 수정.
- Python 회귀4 및 TS5시험/타입검사 통과. 브라우저 무음 본편 spidle 프레임 위치변화/transform:none, 겨루기 서기↔공격 전환 및 온전한창 확인. 본편·겨루기 대기 실화면 저장. 실제폰성능/사용자 자연스러움 평가는 미검증.
- 원래 네명2×4 pilot는 기존A와 새B/C차이로 여전히미적용. 이번 알영은 같은시트의 A/B/C 세컷만 사용해 그혼합을 피함. 해비/고은/한라 및 나머지31명 idle은 아직작업전. 4×5전체파이프라인완료로 주장하지 말 것.
- 현재 검수 http://127.0.0.1:5174/tools/battle-sprite-review.html (aryeong/대기), tools/aryeong-preview.html?hero=aryeong (서기). 사용자 컴퓨터 음악/전투음 재생 안 함.
- 커밋/push/배포 없음. 기존 변경 보존.
- 최종 production build/번들예산 통과(gzip1415.1KB). 기존 미해결 정적경로 경고3(fonts/fonts.css, dancheong-tile.jpg, run-strip.png)는 이번 변경과 별개이며 해결됐다고 주장하지 않음.
