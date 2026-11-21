# 56-B 각성 비기 연출 · 2026-11-21

상태: 최종 typecheck·전체 검사·빌드·로컬 compiled HTTP/SHA 통과. 단계 커밋·즉시 push 준비, 아직 운영 배포 미확인. 56-A는 13c1fa0c35 / CI44871022820 성공 / 운영 HTML·실JS/CSS6·PNG2 HTTP200 및 SHA 일치로 배포 확정.

## 구현과 검수

- 신규 판 규칙 56B. 비각성 0.4초(투지 강화 0.5), 각성 첫 1.8초/후속 0.9초, 「연출 짧게」 첫 회도 0.9초. 옛 56A·53B·무버전 replay 보존. 각성 수동 발동의 전체 적 0.3초 경직과 49 큰 반응은 한 번만 적용.
- 기존 장수 전신 원화 전체를 사용해 대각선 진입·정지·복귀. 원본 파일/RGB 변경 없이 runtime edge-connected alpha 캐시만 사용하며 내부 남색 옷 보존. 전신 실패 시 각성 초상 대체, 중복 실패·늦은 callback 차단.
- 기존 hero art.ogg 개인 외침 재사용(각성 전용 신규 녹음 아님). 없는 gj-heo는 기존 공통 음성. 실제 pause/탭 숨김에 화면 자세와 AudioContext.currentTime 유지, resume 뒤 재개. 실제 청취·실기기 FPS는 미검증.
- 네이티브 낱입자 7종 각각 1회/RAW7/재생성0. 칼 X+잔상3, 도끼 파편, 하향 빛 화살, 창 숲, 단검 회전, 솟는 불꽃, 투석 파편. 다른 5종은 지면 피해 geometry로 clip; 활/술법은 동일 ground anchor에서 공중으로만 투영. 피해·RNG·기존 범위 유지.
- 원본 alpha8 패딩 형식 5종 미달을 보존 기록; 실제 core 잘림/구워진 배경 미발견. 원본 재가공·재발주0.

## 실제 UI 증거

같은 아라의 비각성/각성 실제 출전·수동 시전. 격리된 합성 import fixture이며 보통 소유권·실목책 클리어·실폰 FPS 증거는 아니다. 사용자 저장 clear/delete0.

|항목|실측/추정|
|---|---:|
|비각성 첫 시전|0.3978초|
|각성 첫 시전|1.8119초|
|각성 후속|0.9187초(실제 정지/숨김 0.630초 제외)|
|짧게 설정 첫 시전|0.9041초|
|0.2초 목표 연속 사진|24장/두 줄|
|사진 목표시각 오차 최대|17.77ms|

시전 시간은 rAF 최초 부분 프레임을 보정한 추정이다. 서로 다른 실제 플레이판이므로 성능 향상 인과 주장0. 원 PNG 촬영 부하·옵션 미전달 중복판·MIME 실패 로그도 보존했다. 짧게 설정의 정본은 short-first-explicit이며 실제 체크박스→reload→재출전으로 확인했다.

- C outputs/codex56B-qa/{final-unawakened,final-old-trial,short-first-explicit,body-fallback-fault-01}/report.json. 실 전신 요청 차단 시 유효 초상이 보이며 시작 차단0/JS오류0.
- C outputs/codex56B-qa/effects-gallery-03-air/: 7종×4시점 28장 실제 renderer 정적fixture, JS오류0/sourceStable=true. 실입력·실플레이 승률 증거와 분리. 활/술법 .18/.35 사진 직접 검수 PASS, 다른 5종 draw trace 전후 동일.
- D:/에셋창고/56B-아라-연속사진-20261121/: 원 JPEG24·비교PNG·MEASUREMENTS.json·README 전달.

## 최종 단계

최종 전체 검사·PUBLIC_BASE=/hanbal/ 빌드 → 실 compiled HTML/JS/CSS/SHA → 단계 커밋 즉시 push → CI·운영 version/SHA 확인. 그 뒤 55 이무기를 먼저 완결한다. 현재 배포 완료 주장은 하지 않는다.

## 최종 합격 수치

- typecheck 0 / 전체 1778개·1776pass·0fail·기존skip2 / 108.800초. C outputs/codex56B-final/{typecheck,test,build}.log.
- PUBLIC_BASE=/hanbal/ build raw4972.4KB/gzip1551.1KB. 예산 여유27.6/48.9KB. 56-A 대비 +13.0/+3.5KB(단계 전체 차이).
- compiled realm.html/raid.html200, 실제 raid HTML의 JS6+CSS1 및 PNG2 HTTP200/SHA 일치, bow/magic 새 PNG200. local-bundle.json ok:true. 실제 entry raid-C-ubpzZp.js, CSS raid-DT3oXhWf.css. CI/운영은 push 후 별도 기록.
- source-freeze.json의 제품·검사·RAW29파일 SHA 동결. 다른 사용자 변경 ART-VIDEO-STATUS.md·기존 untracked 원본 제외.


## 56-B 운영 배포 확정 · 57 수신
- 56-B commit5bb213a98420334d0698d3401f800429b8db6264 / CI44878209738 build+deploy success. 운영version5bb213a984/HTML200/실JS6·CSS1·기존PNG2·새FX7 모두HTTP200 및 고정B dist SHA일치. C outputs/codex56B-final/production-bundle.json ok:true, production-fx.json7/7. 이제 B dist교체 가능.
- CI가 Pages artifact1,453,335,993bytes/1GB경고를 냈지만 해당배포성공·위실파일검증완료. JS예산과별도인전체미디어양이며 다음미디어추가때실측주의, 원본삭제0.
