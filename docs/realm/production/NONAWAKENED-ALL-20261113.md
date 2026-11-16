

2026-11-14 latest proportion review: 26 selected / 25 corrected and installed / Mulsae held, old game artwork preserved. See PROPORTION-CORRECTION-20261114.md.
# 비각성 전투 에셋 전원 제작 — 210종 반영 완료

사용자 요청: 자녀 장수를 제외한 모든 비각성 전투 에셋 완성. 재확인 없이 계속할 권한이 있다. 알영/해비/소서노 비율과 폰 얼굴 가독성, 온전한 고정 무기, 작화 대기/이동/공격/방어/비틀거림/피격/쓰러짐이 기준이다. 고은/큰돌은 previous 유지, rejected corrected를 재적용하지 않는다.

- 고정 초상 210종 / ID 217개. 같은 초상을 쓰는 ID는 묶고 서로 다른 초상이 과거 같은 sprite key를 공유하면 별도 base-<bust> key로 분리했다. 실제 시작 판 187명 대조에서 초상 미매핑 0. 자녀는 런타임 family/parents 대상으로 추가 생성하지 않는다.
- 현재 작화 대기·이동·전투 연결 210/210종. 상태 {'installed': 178, 'installed-idle': 27, 'existing-complete': 5}. 초기 생성 205회 + 선별 교정 39회 = 총 244회. 이 수치는 계정 주간 사용률이 아니다.
- full20는 4x5 원본 → 본편20/private20. idle3,walk6,dash,windup/contact/follow/recover,guard/block,stagger2,hit/dead. frame order/atlas/contact/GEN_OWN/bow flag를 generated module로 연결. 궁수의 본편 발사 접촉은 RELEASE 프레임15. 지백호의 뒤로 젖힌18번을 stagger에서 제외하고17번만 선택.
- 기존32명 중 완성 원화는 대기3컷만 보충. install-idle은 이동/전투16칸 바이트 동일을 확인해야 설치. 이전 파일 archive 보존. Haebi private23, 다른 기존16+idle3=19.
- 원장 queue.json이 실행 기준. generationCalls>0에는 중복 생성 금지. record-generation은 배타 lock+atomic replace(초기3개 병렬 기록에서 해솔만 유실 감지 후 원본 재사용해 영수증만 복구, 추가 생성 없음). 생성/설치 동시 queue 수정 금지.
- 초기 보류13종을 각1회만 교정했다. 창8종은 비틀거림2/피격1만 교체, 나머지17자세 원화 픽셀 보존 검사 통과. 범이는 기존 비율로 대기3컷만 보충하고 이동·전투16칸 byte 동일 확인. 달리/맥손/여사제는 투명도·활·깃털 여백·얼굴 점 교정 후 설치. 소리의 교정 후보는 긴 자루 오류로 반려하고 기존 온전한 짧은 단검 high-guard 원화10을 재사용했다. 재교정0회, 실패 원본 보존, held0.
- 전원 원화·추출 경계·프레임 매핑 검수. 실제 본편은 대표 장수만 무음 검수했으며 210명 모두 개별 플레이한 것은 아니다. 최종 TS12시험/Python4회귀(313.564초) 및 typecheck/production build/번들예산 통과(gzip1419.9KB, raw4586.2KB). 창8종 나머지17자세 픽셀 보존 검사와 범이 이동·전투16칸 바이트 보존 검사도 통과.
- CLI: prompts.py <keys>→문안 준비; record-generation.py <key> <saved-image-path>→영수증/보존; full20는 육안 검수후 review accepted→install.py <key>→node tools/sprite-normalize.mjs gen-<key>; idle는 육안 검수후 accept-idle.py <keys>. 검수 전에 자동 채택 금지.
- outputs/nonawakened/index.html은 실제 main 첫4칸의 GIF 및 진행표, 도구 imagegen은 built-in 사용. 문안 개별 .prompt.txt 또는 idle.prompt-template.txt, 원본 <key>-master.png 보존. 테스트는 모두 무음.
- 전투 에셋 생성 중0/대기0/보류0. Veo 새벽 예약 결과는 VEO-20261114-OVERNIGHT.md 참조. 커밋/push/배포 없음. 다른 dirty 변경 및 kids16.json 보존.
