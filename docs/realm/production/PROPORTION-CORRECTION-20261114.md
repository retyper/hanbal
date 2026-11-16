# 2026-11-14 전투 비율 교정

- 사용자: 미르7ef20eea 승인, 전투 머리 과대/그림체 이탈을 찾아 재제작 요청. 미르189 accepted 및 public awaken-loop/w-97-goguryeo-mir.mp4 반영, 1차 AWAKEN_LOOP 추가. 원본 SHA 576fecaa6c7611962880121b3bef5d2960946ad88f599b74a558c29883a80559 유지.
- 자녀 제외210종 첫 대기컷을 동일160px 칸에서 모두 육안 비교. 알영/해비/소서노 + previous 고은/큰돌 기준. 우선26종 각1회 내장 image_gen 교정,25종 설치. 승인 기준5명과 기존 나머지는 변경하지 않음. 이 감사는210종 모든 동작을 개별 본편 플레이했다는 뜻은 아님.
- 25종의 새20컷을 직접 보고 같은높이 비교/추출 경계 검사 후 설치. 머리/몸 비율과 얼굴/복식/무기/작화idle3/walk6/공격/방어/비틀거림/피격/쓰러짐 매핑 유지. 초보궁수 새피격19 활누락은 제외하고 온전한 crouch18 + runtime hit 반응으로 매핑. 물새는 낮춘창 자루가 금속날로 바뀌어 새후보 보류, 기존 온전한 원본/앞서 승인한 창패치 그대로 유지. 같은 대상2회 재생성 없음.
- source masters/prompts/receipt SHA: tools/sprite-kit/nonawakened-20261113/<key>-proportion1.* 및 queue.json. 예전 원본/큐/스프라이트는 assets_src/realm/retired/proportion-20261114/<key> 보존. 초기7건은 평면 파일명 백업, 이후는 원래 상대경로 보존. 평면 백업은 main/duel이 같은 이름인 경우 마지막 compiled 파일만 남으나 old master+queue가 있어 재생성 가능; 원본 원화는 전원 보존.
- 관련 TS12 통과. 최종 typecheck 결과와 무음 본편 대표검수는 마지막 인수인계 참조. baker/normalizer 코어 변경 없음. 전체 Python4 재시험/전체 빌드는 이 원화 교체만으로 반복하지 않음.
- outputs/proportion-audit-20261114/index.html에26종 수정전후, 현재게임idle GIF, 물새보류 후보. 주간 사용률은 측정하지 않음. 이번 내장 이미지26회, 추가 재교정0. commit/push/deploy 없음.

Final verification: TS12 and tsc --noEmit passed after all25 installations. Representative muted runtime: Gaennae paired14contacts; YoungArcher paired14contacts; Jumong entry run observed before later HMR updates. Uga Nuri final paired review follows in final handoff. Full25 individual gameplay and real-phone performance not verified.

Final muted runtime Uga Nuri paired14contacts + console0 verified; screenshot saved. User decision pending for one extra Mulsae3-pose weapon correction under quality-budget; current original stays installed.

User decision resolved 2026-11-14: keep existing Mulsae artwork. Current main/duel/master unchanged; existing wooden-shaft pose patches stay active. No extra generation or automatic retry. Rejected proportion candidate retained only for audit.
