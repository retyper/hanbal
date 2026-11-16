# 목책 성문과 장수 표시 — 11-14

- 기존 gate.png는 정면/굵은 외곽선 스타일이라 사용자 반려. 말뚝 stake-04/06 질감과 별도 방향 뼈대를 참조해 imagegen 1회로 성문 정상/파괴 두 상태를 제작했다. 원본·문안·좌표 영수증 tools/gate-match-20261113/ 보존. public/realm/fx/field/gate-oblique.png 및 gate-oblique-broken.png 연결. 옛 에셋은 보존했다.
- 두 상태는 같은 캔버스와 상단 기둥 기준으로 정렬. 처음에는 뼈대만으로 문 면이 충분히 기울지 않아 사용자가 재지적했다. 실제 말뚝 주변 발 좌표(화면 x 변화 약22px/세로59px)를 확인해 문 면에 skewY(56deg), 발 기준 oy4%, 목책 틈6.5%를 적용했다. 추가 생성 없이 투영만 수정. 이 최종 각도는 사용자 평가 전이며 최초 무변환판과 구분한다.
- 전장 유닛 위 얼굴 동그라미 DOM과 전용 CSS 제거. 큰 초상/명령 선택 등 별도 화면은 유지. 나라 깃발 원본에 이미 천/테두리가 있으므로 추가 CSS 색바탕·패딩·테두리·깃발 모양 clip을 제거했다. 깃대는 지지대로 유지.
- 무음 데스크톱 및 390px 고정 iframe에서 최초 새 성문/파괴 상태, 원형 초상0, 추가 깃발 background transparent/border0/padding0/clip none 확인. 최종56도 각도는 데스크톱 확인, 모바일 추가 확인 남음. 화면 outputs/gate-angle-aligned.png. 폰 실기 성능 검수로 과장하지 않는다.
- 도구 페이지 HMR 중 gate-state 없는 이전 HTML에 onchange를 설정한 transient 오류1 발견, optional selector/listener로 보완. fresh reload 후 새 오류0 확인(최종56도 이후 추가 최종검사 남음).
- 사용자 범이 머리 커짐 지적: beomi 새 idle 해제, 이전 gen/duel/report/config와 runtime idle 매핑 복구. 후보는 rejected-proportion 보존. 이후 설치는 원래 각 장수와 동일 몸 크기 비교로 머리/몸 비율을 직접 검수해야 하며, 단순히 원본을 참조했다는 이유로 비율 일치 주장 금지. 범이 후보 재설치 금지.
- 장수 전원 작업 계속 진행 중. 곰목/진하/금바위 대기 후보는 생성·기록만 됐고 추가 비율 검수 전에는 설치하지 않는다. 예약/별도 자동 제작 없음. Veo 갈매182는 같은 대화에서 서비스 오류 후 사용자 지침에 따른 한 번의 확인 요청이 진행 중; 새 중복 제출 금지. 실시간 원장 참조.
