# 61-1C 여울 거대 이무기

여울은 600초 중간 보스→실제 상자 선택→1140초 거대 이무기→처치 또는 제한1380초의 흐름으로 열린다. 다른 스테이지와 옛 기록 버전은 기존 규칙을 유지한다. 이번 공개 범위는 이무기 한 종이다.

- 머리·턱·목·몸·꼬리가 실제 부모 관절로 이어지고, 열린 입·물결·부위 파괴·붉은 고정 예고가 실제 충돌 모양을 따른다. 정상 총예고는 첫 사용/재사용 1.2~2.5초, 각 움직임에 맞춰 body→hold→red→strike가 갈린다. 여섯 동작의 기존 RED/회귀 근거는 C codex55-engine/body-motion·stability·timing에 보존.
- 실제 native 새 출전/자산 대기 중 변경3경합14검사 PASS. 실제 기본 해비/합성 forest 해제·SHOP최대/공식3배속·방향키/실제 성장·상자 선택으로 **won1153.008초/HP330/330**, 중간·최종처치 확인. 8검사·JS/console/비예상자산오류0/sourceChanged0/Chrome정리. 시간·HP·seed·승패 런타임 주입0. 실제 숨김에서 pose/t/age 고정 및 AudioContext suspended→복귀, 실제 일시정지 t고정 확인.
- 실제 전투에서 tail-sweep/jaw-dash/emerge 3수와 3단계를 관측했다. 여섯 수 전체는 통제된 실제 step/gallery·회귀 검사 근거다. 6폭 실제 사진은 pause overlay이며 실전 폰에서 보스가 보이는 사진이나 실기기 FPS로 주장하지 않는다. root는 실제giant-spawn·pause가로/세로 및 28frame fixture를 직접 확인했다.
- 출시 전 추가 재현: 실제 lethal→won→실 drawField에서 사람 boss-ford 시체1/particle1 RED. 화면 조건1줄을 바꿔 최종 이무기 죽음의 사람 시체0/particle1, 중간보스·일반몹 대조 포함3GREEN. simulation/JSON/RNG 변경0. 그 순간 남아 있는 옛 중간보스의 boss FX 몸도 같이 억제될 수 있으나 입자는 유지한다. 실제 UI 풀판은 이 한 줄 전이며, 수정 후 실제 renderer 회귀와 전체 검사를 별도로 통과시켰다.
- 원본4PNG bytes 유지. 연속 UV 목띠는 최대96quad/192triangle, 사망/파괴 부위 타깃과 실제카메라bounds를 구분한다. 기본 camera .8과 큰 동작 fit은 화면에서만 계산하고 sim좌표에 쓰지 않는다. 수동 확대 우선·메뉴/다음 판 복귀를 검사했다.
- 최종 격리 typecheck0, 전체 **1888/1886pass/0fail/기존skip2**,138.544초. build **5035.9KB raw/1572.3KB gzip**, compiled raid.html200/JS6CSS1·기존PNG2 SHA 일치, 이무기 원PNG4개200/SHA일치. 런타임 의존성0/실제 설치한node_modules/심볼릭 링크0. 기존53B/56A/56B/버전없는 기록 exact SHA4경로 유지.

## 최종 전·후36판씩 (실제 시뮬레이션, native 사용자 조작 아님)

3무기 axe/bow/sword × seed7 하나 × 강화0/.4/.8 × 비각성/각성 × spread/deepA. 셀마다3판이며 seed둘/셀6판의 완료로 주장하지 않는다. 동일 고정 bot source를 각 버전 정상 helper로 실행했으며 실제 action stream은 판별로 다르다. 중간 사망도 분모에 포함한다. 중단·오류0/36, 전후 sourceStable. 보스 종결 시간은 실제 bornAt와 사망 관측 구간 상한의 차이며 검사 step만큼 오차가 있다.

|강화/각성/선택|새 승리|기존56B 승리|최종보스 종결 시간 중앙값(승리 표본)|
|---|---:|---:|---:|
|0/normal/spread|0/3|2/3|도달 승리0|
|0/normal/deepA|0/3|0/3|도달 승리0|
|0/awake/spread|2/3|3/3|32.29초 (2)|
|0/awake/deepA|1/3|3/3|27.59초 (1)|
|0.4/normal/spread|2/3|3/3|37.00초 (2)|
|0.4/normal/deepA|3/3|3/3|166.38초 (3)|
|0.4/awake/spread|3/3|3/3|26.68초 (3)|
|0.4/awake/deepA|3/3|3/3|85.64초 (3)|
|0.8/normal/spread|3/3|3/3|37.17초 (3)|
|0.8/normal/deepA|3/3|3/3|126.02초 (3)|
|0.8/awake/spread|3/3|3/3|12.69초 (3)|
|0.8/awake/deepA|3/3|3/3|71.37초 (3)|

강화0 비각성은 두 선택 모두0/3, 고강화는 네 셀 모두3/3이었다. 중간강화 비각성 집중은3/3으로 “약 절반” 초기 목표보다 쉬웠다. 각성은 성장 보상으로 같은 강화에서 더 수월했다. 한 seed의 세 무기 표본이므로 일반 승률·난이도 완성으로 단정하지 않고 후속 조율 자료로 남긴다.

증거: C outputs/codex55-balance/{freeze-final-04.json,before-final-36.json,after-final-36.json}, C outputs/codex55-ui/{actual-races-03,actual-fullrun-01}, C outputs/codex61-imugi/{GIANT-DEATH-VIEW.md,REVIEW.md,test.log,build.log,local-bundle.json,local-art.json}. 최신 engine13 SHA는 화면1줄 수정 전후 동일해36판 수치 재사용 범위를 확인했다. 초기 순환참조/경계 예외/검사 도구 navigation 경합의 실패 로그는 삭제하지 않았다.

## CI 이식성 교정

- CI44901278611에서17개 시각 검사 중 원본 무결성1개가 D:/에셋창고 절대 경로 ENOENT로 실패했다. 로컬 검사에서 놓친 환경 의존이며, 이무기는 아직 운영 반영 전이다. 기존 트리 배포본은 정상 유지됐다.
- 원본4개와 제품4개를 독립 비교한 SHA256/bytes를 CODEX55-IMUGI-ORIGINALS.json에 기록하고 검사는 저장소 상대 file URL로 읽는다. 건너뛰기0/이미지·게임 코드 변경0. 복사한 head 원본의 마지막1byte만 바꾼 독립 fixture는16PASS/무결성1FAIL, 정상 제품은 전체1888/1886PASS/0FAIL/기존skip2·typecheck0으로 확인했다.
- 앞33의 CI는45의 지시문서 push로 취소됐다. 같은 재발을 막도록 배포 workflow는 이 지시 MD 한 파일만 바뀐 push를 제외한다. 제품 코드·원본지문 JSON·workflow 변경과 혼합 push는 계속 모든 검사/빌드를 실행한다. YAML 및4개 경로 조합을 검증했다. 실제 다음 지시문서 push의 skip 관측은 아직 없으므로 완료로 주장하지 않는다.
- GitHub [공식 경로 필터 문서](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#onpushpull_requestpull_request_targetpathspaths-ignore)를 기준으로 좁혔다. 전·후36판과 게임 빌드는 코드 변경이 없어 재사용하고, 새 커밋 CI·운영 SHA를 다시 확인한다. 로컬 근거 C outputs/codex61-imugi/ci-portable-fix/.
