# Claude50-6 갈래 카드 껍데기

- 세 갈래 a/b/c에 공유 프레임 세 장을 적용한다. 기술 이름마다 별도 프레임을 만드는 것으로 해석하지 않았다.
- 기존 금·청록·보라 갈래 색과 선택·스킬명·단계·갈래 끝·조합 규칙을 유지한다. 보이는 갈래 글띠만 제거하고 갈래 이름은 카드 `aria-label`에 남긴다. 조합 카드는 기존 금테와 조합 리본을 쓴다.
- 새 이미지 생성 0회. 부모 작업에서 완료한 native 프레임 3장을 재사용했다. 기존 캐릭터 생성 2회와 합산해 새 생성으로 세지 않는다.

## 원본·굽기

`CODEX50-CARD-FRAMES.json`에 실제 입력 경로·프롬프트·참조·세 곳의 원본 SHA256·출력 SHA256을 기록했다. D: 보관본·C: generated 원본·ignored master는 각각 동일 바이트다.

`py tools/raid-card-assets.py`는 전체 RGBA 1024×1536을 384×576으로 Lanczos 축소하고 WebP quality90으로 저장한다. crop·키잉·재칠·형태 교정은 하지 않았다. 전체 기하 비례 0.375를 유지하므로 native slice160과 runtime slice60은 같다. CSS border16px/stretch를 사용하며 fill을 넣지 않는다.

| 갈래 | 런타임 바이트 | 중앙 1/3 alpha 최댓값 |
|---|---:|---:|
| a | 20,042 | 1 |
| b | 20,654 | 1 |
| c | 20,654 | 0 |
| 합계 | 61,350 | |

작은 alpha=1 잔여가 있지만 border-image의 중앙을 그리지 않으므로 사용되지 않는다. 각 프레임의 투명 alpha는 원본을 같은 크기로 축소한 결과와 정확히 일치함을 디코딩해 확인했다. 기존 어두운 바탕에 갈래 색을 위 9%/아래 4%만 섞어 구분한다. 프레임 세 장 모두 출전 전 기존 Promise 이미지 로더에 포함했다.

`assets_src/realm/raid/card-frames-50`은 기존 gitignore 정책에 따라 clone에 오지 않는다. 새 clone에는 runtime·manifest만 들어가며 재굽기에는 기록된 native 원본이 필요하다. `py tools/raid-card-assets.py --check`는 원본이 있으면 원본 SHA와 alpha 기하까지 검사하고, 없으면 runtime 디코딩·SHA·alpha·크기를 검사한다.

## 검사 근거

구현 전 b456779f 상태에서 처음 `tests/raid-card-skins.test.ts`를 실행해 실패 두 건을 보았다: `old visible branch name strip remains`, `ENOENT ui-card-branch-a.webp`. 이후 구현 문자열을 검사하던 첫 검사는 제거했다. 최종 자산 검사는 `CARD_FRAME_PATHS`와 `imagePaths` 실제 배열을 import하여 3개 고유 경로·프리로드 포함·실제 파일·384×576·alpha·SHA·예산을 검사한다. DOM 갈래띠0·프레임3갈래·캡/조합 분리는 실UI QA가 검수한다.

최초 구현 뒤 검사 2/2, `npm run typecheck`, `py tools/raid-card-assets.py --check`, `git diff --check`가 통과했다. 기하 4비율·첫 성장 실제 카드·1/2/3 키힌트·갈래 끝·조합의 시각 및 실제 선택 검수는 별도 QA 담당의 production bundle 검수 결과를 따른다. 코드 검사만으로 실화면 통과라고 판정하지 않았다.

교정 전 전체 `npm test` 1회는 1,674개 중 1,672 통과·실패0·기존 skip2로 끝났다(142,907ms). 당시 실행 로그는 ignored `tools/out/codex50-card-full-test.txt`에 보존했다. Node22.19.0/npm10.9.3는 저장소와 CI 고정판과 일치한다.

## 실UI RED 후 교정1

QA 담당이 실제 가로 전투 t6.325 첫 성장 wave(b)·sword(a)·tempo(c), 출전 전 프레임 세 Image.complete/network, 갈래 글띠0은 확인했다. 그러나 세로360/375에서 회전 안내가 성장 카드를 덮어 native hit가 실패했고, 카드 하나 높이347.375px로 세 장이 한 화면에 들어가지 않았다.

`showOverlay`에서 성장 `upgrade:` 상태만 회전 안내의 예외로 추가했다. `rotationBlocked`와 `paused=true`는 유지하므로 선택 뒤 세로 전투는 자동 재개되지 않고 기존 멈춤/회전 조건을 따른다. 세로≤700px 성장 카드만 좌 아이콘32px·이름/단계·획득·아래 설명/조합경로의 compact grid로 배치했다. 텍스트를 숨기거나 새 단추를 넣지 않았고 글은12px 이상, 프레임16px/slice60은 유지했다. 가로 CSS는 바꾸지 않았다.

교정1 이후 실제 배열/파일 검사1/1·typecheck·diff-check가 통과했다. 최종 전체시험 로그는 `tools/out/codex50-card-full-test-final.txt`에 따로 남긴다. 세로 실제 터치·모든 정보·한화면 적합·선택 뒤 정지의 최종 판정은 재빌드된 product QA 결과를 따른다.

최종 전체 `npm test`도 1,673개 중 1,671 통과·실패0·skip2로 끝났다(146,961ms). 구현 문자열 미러 검사를 하나 제거했으므로 교정 전보다 총수가 하나 적다.

QA 담당 최종 보고: 실제 정상 출전·방향키 이동 후 첫 성장 b/a/c 프레임3개·글띠DOM0·출전 전 Image3개 complete(384×576)를 확인했다. 세로4폭+844 가로1폭의 실제 카드15/15가 부모 패널 안에 들어가고 native hit=true, 본문·단계·조합경로 겹침0, scrollTop0이었다. 5장 화면과 PC 직접 보기에서 모서리·왜곡·잘림을 발견하지 않았다. 세로에서 실제 wave 선택0→1 후 전투 t6.475가 정지했고 가로 회전 후 계속하기로 t7.0167 재개했다. 첫 로드 JS 오류0이며 favicon404는 별도다.

다른 선택지(reroll)는 5장 화면에서 한 화면 노출만 확인했고 native hit 수치를 측정하지 않아 해당 hit PASS로 세지 않았다. cap/combo는 첫 성장에 나오지 않아 실UI 검수하지 않았다. 최종 근거는 `C:/Users/my/Documents/Codex/2026-11-17/detail-bad-request/taskoutputs/codex50/phase6/QA-FINAL-SUMMARY.json`이다. 제품 교정은 총1회로 마쳤으며 원본 이미지 수정·새 생성은0이다.
