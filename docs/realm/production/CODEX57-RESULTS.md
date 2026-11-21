# 57 단련터 자식 얼굴·게임 UI 용어 · 2026-11-21

상태: 구현·관련 검사·통합 typecheck·열전 폰 UI 검수 완료. 전체 검사·빌드·로컬 compiled HTTP/SHA 통과, 커밋 준비. 운영 실제 세 얼굴 복구는 배포 후 확인한다.

## 실제 재현과 원인

운영 Chrome의 실제 사용자 단련터를 판을 열기 전에 확인했다. 108명 중 마루 kid-bihwa-1-guya-3, 가시 kid-byeokjin-1-wander-12, 보람 kid-anya-ruler-bihwa-ruler 모두 `.dyart.nof`·이미지0으로 재현했다. 같은 사용자 가문 UI의 기존 얼굴은 마루 y-w-11/보람 y-w-04/가시 y-g-05, 세 이미지 모두 complete=true/native320으로 확인했다. 실제 판 load/advance/custom storage쓰기·clear는 실행하지 않았다.

직접 localStorage 열람은 브라우저 읽기 scope가 제공하지 않아 미확인이다. 5173은 연결거부였고 운영 UI에서 조사했다. 판을 연 뒤의 비교는 recordDex/engrave 쓰기가 발생하므로 실행하지 않았다. C actual-production-before.json 및 actual-clan-reference.json이 관측 범위를 분리한다.

원인은 engrave가 child look만 남기고 traits를 버림, loadDrill도 traits를 보존하지 않음, raw kid 얼굴은 live noteKids cache 외 cold lookup 경로가 없기 때문이다. 데이터 증거 없이 새 얼굴을 고르지 않는다.

## 수정

새 기록에 traits·검증된 실제 bust를 보존한다. cold/front 경로에서 같은 seed/id/name/look의 자동·수동·선반·가문 저장을 읽기만 복원하며 후보 충돌·정보 없음은 unknown으로 남긴다. 사용자 판을 열거나 migration/replay/write하지 않는다. 저장 원문별 parse memo로 반복화면에서 fullJSON 재파싱을 막는다.

bustOf 우선순위는 기존고유장수→기존live아이→별도복원fallback→기존clan이다. 나중 판의 실제 얼굴을 복원 cache가 선점하지 않고, 근거가 없어지면 fallback만 비운다. app은 noteFaces 다음 nonisolated cold/front에서 hydrate를 호출한다. 제품 설명·버튼 추가0.

57-B 필터/스킬 트리/배속/일시정지/리롤/레벨업/공격 속도를 적용했고 세계관·장수·스킬 고유명·ID·수치·행동은 유지했다. 적용·유지·애매 표는 CODEX57-TERMS.md에 있다.

## 검수

- 실제3명 cold 누락 RED + 신규관련 RED2 → 관련36/36 GREEN. 복원등록을 뺀 C mutant는11중6실패. 함수 fakeKV set/remove throw·원문전후동일·후속live얼굴우선·충돌·소스삭제·원문memo 검사를 포함한다.
- typecheck 최초 exactOptionalPropertyTypes2오류→속성undefined 생략 두줄 교정 후 최종0. 전체원로그 보존.
- 용어 기존관련20/20. 전후 ko는 dy.filter 외 모든값·키순서 동일, POWERS는 숙련desc 외 deepEqual.
- 열전 실 출전·이동·레벨업·카드 선택·스킬트리 열기/닫기·일시정지: 360/375/390/412×844와844×390 총15화면/18검사 PASS, document/text overflow0·JS0·sourceStable=true·fresh profile cleanup완료. 긴 스킬 트리 버튼/제목 및 리롤·pause 실사진 직접 검수. 합성 import/실폰FPS 증거와 분리한다.
- 첫 도구 terms-ui-01은 회전으로 이미 pause인데 pause버튼을 다시 누르려 해 overallERROR. 앞10뷰/12검사는 통과했으나 전체PASS로 세지 않는다. 도구만 existing-pause 분기 및 2번째 실제 레벨업을 반영한 terms-ui-02가 정본이다. 제품 경로 교정0.
- 단련터 필터 폰4폭·실사용자3명 복구·최종 lints/전체/build/CI/운영은 이어 확인한다. C root-source-freeze.json 제품·검사8파일 동결.


## 57 최종 검수 완료 · 커밋/운영 확인 전
- 전체1789/1787pass/0fail/2기존skip,116.998초; typecheck0·dash/josa 각0. build4975.5raw/1552.3gzip KB·여유24.5/47.7KB. compiled localHTML2·JS/CSS7·PNG2 HTTP200/SHA일치.
- 열전 실제 출전/레벨업/스킬트리/일시정지 폰4폭+가로15사진/18검사 PASS·overflow0/JS0/소스불변. cold 옛단련+index없는정식수동저장 fixture는 판열기0·3얼굴원본일치/필터폰4폭·실결과/닫기입력/두저장원문불변 포함11검사 PASS·JS0·소스불변·fresh프로필cleanup. source8 SHA동결.
- 실제사용자 운영cold목록 RED3과 실제가문 기존얼굴 y-w-11/y-w-04/y-g-05 로딩을 직접 확인했다. fixture판정과 실사용자 복구 확인은 분리. 후자는 이번57 배포 뒤 확인할 것. 직접localStorage 원문 조회는API미지원, 판load후비교는쓰기부작용때문실행0/clear0.
- 새 Claude58 fe812e7e/59 0f5362fa 수신(지시MD+58mockup만, 제품0). 58공유10칸얼굴링/가로본편정리/매화걷기재제작,59시작첫화면+쇠비키아트2/10초영상2. 최신작업57 CI/운영확인 뒤55기존순서에수신사항이어처리; 별도우선순위명시시적용. 추가영상은54-V 계정규칙/Flow이전업로드막힘기록유지.
- 55 renderer C초안 outputs/codex55-render-draft 6GREEN/파괴mutant1fail/원본5SHA동일/제품0, strictTS·실Canvas·성능미검증/입안gapHOLD. engine C첫geometry/13pose/TOI/dedupe초안구현중, root full/build끝알림후작은검사. 55D코드아직0, 새gen0/누적21RAW21(native20/browser1).
