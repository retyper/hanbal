# 61-1A 치명타 기본공격 막타

일반 적을 기본공격 치명타로 처치하면 .035초 짧게 멈춘 뒤 .24초 안에 타격 방향으로 가속·회전·축소하며 사라진다. 기존 적 스프라이트와 치명타 소리·정지를 재사용한다. 새 그림·음원·버튼0. 보스/정예, 비치명타, 살아남은 타격, 보조 스킬·비기·DOT는 제외한다.

- 실제 primary7계열/실제 발사체의 private WeakMap 출처로 판별한다. JSON 상태·기록·피해·RNG·드랍 변경0. seed+input replay에서 출처 재구성. 중간 structuredClone은 WeakMap이 없어 기존 사망 연출로 복귀한다.
- 실제 활/검/저사양 활 34검사 PASS, 원 JPEG92장 보존. root는 각 연속3장을 직접 확인했다. 숨은 상태가 아닌 실제 화면·방향키/성장 선택·공식 장수 선택/일시정지·복귀로 검사. 새 시험 프로필의 합성 명부/SHOP 설정이며 HP/time/level/seed/승패 런타임 주입0. 실제 휴대폰 FPS·소리 청취의 증거로 주장하지 않는다.
- normal 동시4몸/잔상2, low 동시2몸/잔상0. 몸과 사망FX가 다시 나타나는 terminal 결함을 RED로 재현한 후 수정했다. 최종시각수정1회 distance190→420/lift56→84/spin1.2→1.9, life/hold 동일. 모든 손맛 숫자는 params.
- 55와 새 트리 없이 0b674894 기반 격리 작업트리로 별도 이식·검증. 전체 typecheck0, **1804개/1802pass/0fail/기존 DLCskip2**,119.950초. build **4982.3KB raw/1554.5KB gzip**. 실제 설치한 node_modules, 의존성 심볼릭 링크0/런타임 의존성0.
- compiled raid.html200, 실 JS6/CSS1·기존PNG2 SHA 일치. C outputs/codex61-critical/local-bundle.json. 기존 새 트리/55 및 사용자 ART-VIDEO-STATUS는 D 작업공간에 보존하고 이번 커밋에서 제외한다.
- 61-0 명시 승인: raw5600KB/gzip1800KB, tools/budget.ts/GDD/ARCHITECTURE 일치. 기능 축소0.
- 증거 C outputs/codex60-critical-finish/{actual-bow-02,actual-sword-01,actual-low-bow-01,LEGACY-ANCHORS.json}, C outputs/codex61-critical/{typecheck.log,test.log,build.log,REVIEW.md}. 커밋 직후 push하고 CI·운영 SHA 결과는 CODEX-TO-CLAUDE-LATEST에 추가한다.
