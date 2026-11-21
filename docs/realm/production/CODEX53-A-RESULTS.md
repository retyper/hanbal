# 53-A 확대 장수 선명도 — 로컬 검수 완료·배포 대기

제품 소스를 동결했고 전체검사와 root 최종 compiled 화면·빌드 검수를 마쳤다. 커밋·푸시·CI·운영 배포는 root 담당으로 아직 대기다. 새 UI0, 전투 ID·수치·카메라 논리 변경0, AI 신규 생성0. 작업자는 전체시험1회와 승인된 portrait 관측 보정 후 재촬영1회만 실행했고 빌드·커밋·푸시0이다.

## 실제 정상 해비 전후 실측

root가 실제 해비 고름→출전→확대1.8 입력으로 격리 headless844×390/DPR2에서 실행했고, 작업자가 저장 JSON을 직접 대조했다. 실제 보유목록은 정상 해비1명이며 두 실행 모두 JavaScript 오류0이다.

| 항목 | before | after |
|---|---|---|
| 전투판 CSS | 587.984375×378 | 587.984375×378 |
| backing | 1120×720 | 1176×756 |
| backing/CSS | 1.9048125 | 2.0000531 |
| 실제 해비 draw source 높이 | 94px 중간축소 | native160px |
| rAF p95(ms),10초×3 | 15.1/15.1/15.1 | 13.5/13.8/13.8 |
| field spanCPU p95(ms) | 0.6/0.6/0.6 | 0.6/0.6/0.6 |

워밍5초+10초×3이다. after cacheSources뿐 아니라 실제 heroDrawSources source4000×160·matrix1.8899999·목적높이94px·smoothingfalse를 확인했다. 원본 세부를94px로 먼저 잃던 렌더 경로가 제거됐다. 실폰FPS나 GPU완료시간 측정이 아니며, 시간대·난수가 달라 rAF 차이를 성능 개선 인과로 주장하지 않는다. 사진only 검수는 성능 표본0이다.

## 구현과 실제 HD 자격

- 실제 contain CSS내용×최대DPR2, 기존 저사양은DPR1로 backing을 잡는다. 논리1120×720·기존 pointer/toField·카메라 로직은 유지한다. field/ending의identity·zoom·overlay 재설정도 backing 배율을 보존한다.
- 선택 장수만 실효물리밀도에 맞는 native 캐시를 사용한다.16px단위·이미지별최대3변형, white mask 사전예열·decode를 적용했다. 추가 getImageData0. 적 HD 확대0.
- 실효밀도×zoom>1.3에서만 선택 HD를 요청한다. 유일한 자격 대상은 비각성 주몽이다. 요청 실패 시 승인된 기본띠로 렌더한다.
- 주몽 PNG 자체 **3840×640**,10열×2행,칸384×320,20칸row-major,발선156→312. GPU 원본과 runtime 캐시 모두4096너비 이하다. 기존 일반띠 규격은 유지한다.
- 동작 원화→HD0.9684210526, 걷기0.6834492716으로 모두 원본 축소다. 정상2×대비alpha64 bbox차이≤2px,clipping0. 원화2장·기본띠SHA 불변.
- 최종 PNG SHA256: `f775f616f674adc95b919e72aad4cebd093a9142cb54516319fc0ca148e2f772`. 최종 dist 파일도 동일하다. 이전7680×320 시험파일은 최종본이 아니다.

| 동일 원화 고해상도 대기 | 현재 첫 인물 높이 | native 비율 | 강제HD시 확대 | 처리 |
|---|---|---|---|---|
| 다나 | 245px | 1.7754× | 1.1265× | 기존 기본띠 유지·미HD |
| 각성 해비 | 252px | 1.8261× | 1.0952× | 기존 기본띠 유지·미HD |

같은 포즈 첫 인물276px이상과 전20칸/별도걷기의HD배율≤1이 필요하다. 전체 canvas 크기나160띠 확대만으로 nativeHD 자격을 주지 않는다. 원화수정·추가생성0이다. 베이커 재현은 로컬 정본 원화와 기존 bake-full20/repair보고서를 필요로 하며, 그 기존 원화를 이번 커밋에 끼워 넣지 않는다.

## 최종 실제 화면 검수

| 조건·증거 소유자 | 실제 결과 | 범위 |
|---|---|---|
| compiled3인 before/after,root | 다나/주몽/각성 해비 각 성공·JS0 |5184/hanbal·844×390/DPR2 |
| 주몽 HD,root | HTTP200·실제 gen-jumong_hd draw·최종f775…atlas | 최종 compiled·기본과 같은20순서/발선 |
| PC,root |1920×1080/DPR2·backing2975×1912·HD실draw·JS0 | 최종 compiled·사진only |
| HD차단,root | inspector로HD요청실패→gen-jumong.png native160 실draw·JS0 | DEV5174·시험 입력 |
| low query,root |gfx=low·DPR2기기에서backing588×378·backing/CSS1.00003·JS0 | DEV5174·설정UI전체경로 증명 아님 |
| DPR1,root |backing588×378·HD요청0·기본96px캐시·JS0 | DEV5174·사진only |
| portrait390×844,작업자 승인1회 |회전 pause 안내·resume aria-disabled=true·JS0·표본0 | 최종 compiled·SKIP_PORTRAIT_ROTATION_BLOCKED |

root가 실제 NATIVE-CROPS.png를 열어 세 장수 선명도를 확인했다. VIEW-COMPARISON-FULL.png는 원본 전체 화면3행가로쌍, NATIVE-CROPS.png는 실제 화면 픽셀1:1의 장수 크롭3행가로쌍이다. 원본SHA 불변과 픽셀복사 일치를 확인했고, 확대·샤픈·보간0이다. 크롭은 최근 deduplicated hero draw와canvasrect/backing/실제사진 배율의 합집합+48px여백에서 유도한 **추정**이며 사진 시점과 완전히 동기화되지 않는다.

이 사진은 모사화면이고 각run 난수/자세가 다르다. 정식 art deep link 렌더를 보일 뿐 실제 계정 소유·각성 해금 권한 증거가 아니다. 각성 해비 그림은 normal상태의 시각 입력이며 실제 각성 상태가 아니다.

## 사진 실패와 관측기 보정

- 초기 compiled before timeout은 root가 preview 서버 중단·ERR_CONNECTION_REFUSED로 확인했다.5184 oldbundle 재시작·manifest일치 후3인 성공했다. 실패 자료 보존, 제품 수정0.
- portrait 첫 사진은 실제 pause 회전 안내가 떠서 확대 버튼이 가려졌지만 관측기가 #rotate-guide만 봐 ERROR로 보고했다. 실제 가시 overlay+#pause-note의 정확한 회전 문구+#resume aria-disabled=true까지 관측을 확장했다. 기존 실패 폴더 보존 후 v2 **1회**가 회전 차단을 정확히 기록했다. 제품 수정0·FPS표본0.
- 프로브의 --block-hd/--low-gfx는 사진only 시험 입력이다. 실패 DOM data:image는[data-image]로 요약한다. 공통 preflight의 samples3은 benchmark 기본값이며 사진only의 실제 samples는0이다.

## 검사와 최종 빌드

- 수정 전 backing transform 손실 **RED1실패**를 보고 고쳤다. 관련5파일22개 통과·실패0·skip0, 최종 제품 타입 검사exit0. 재개 후 기존 로그를 재사용했다.
- 전체검사 **1687tests/389suites,1685pass/0fail/2skip/0cancelled**,concurrency2로1회,196.897초,exit0. skip2는 기존 DLC 비활성의 설원·산성 관련 검사다. 새skip0.
- 전체검사 이후 변경은 사진 프로브 진단/입력/회전 관측뿐이다. 각 보강의nodecheck/preflight 통과 및 실제 root/worker 사진을 보존했다. 제품 SHA는 모두 동결 일치하고 전체검사·타입검사·빌드를 반복하지 않았다.
- root 최종 build 성공: raw4972.8/5000KB,gzip1539.9/1600KB. 여유27.2/60.1KB. 작업자가 저장 로그와 예산 통과를 읽었다.
- root 로컬 compiled raid.html/JS/CSS는HTTP200. HD-local-bundle.json의JS/CSS SHA와 현재dist 실제파일을 작업자가 재대조해 일치했다. root의HTML/manifest 확인과 구분해 기록한다.
- 실제 폰 터치·fullscreen·회전 전환, 첫white-hit 프레임 시간은 이 보고서에서 별도 실측하지 않았다. 기존 pointer/카메라 경로는불변이고white mask는부분검사의범위에서예열/readback금지를검증했다.

## 근거와 커밋 범위

C 출력 정본: `C:/Users/my/Documents/Codex/2026-11-17/detail-bad-request/outputs/codex53/HD-RESULT.json`,HD-full-final.log/json,hd-typecheck-final.json,HD-build-authorized-final.log,HD-local-bundle.json,IMAGE-COMPARISON.json. 실제사진·보고서SHA·원본PNG·crop좌표·resample0을보존했다. RAW와HD매핑정본은tools/sprite-kit/hero-hd-jumong.json이다.

아래11개만53-A 커밋 허용 목록이다. 기존 HANDOFF/ART-VIDEO 및 다른 untracked 원화·도구는이번작업범위에포함하지않는다. Coutputs는저장소밖 증거다.

- `src/raid-main.ts`
- `src/raid/haebi-view.ts`
- `src/raid/ending-view.ts`
- `src/raid/surface.ts`
- `src/raid/hero-hd.ts`
- `public/realm/anim-px/gen-jumong_hd.png`
- `tools/sprite-kit/bake-hero-hd.py`
- `tools/sprite-kit/hero-hd-jumong.json`
- `tools/raid53-hd-probe.ts`
- `tests/raid-hd.test.ts`
- `docs/realm/production/CODEX53-A-RESULTS.md`

제품 소스는동결이다. 다음은root 커밋·푸시→CI/운영version·assetSHA확인이며, 배포 완료로보고하지않는다.
