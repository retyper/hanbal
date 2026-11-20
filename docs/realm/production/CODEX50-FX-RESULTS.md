# 50-0 FX 정리 결과

- 권위: `CODEX-SKILLBODY-REDO-20261117.md` 50-0. 새 이미지 생성 0회, 원본 디자인 재작성 0. 49의 native PNG 10장을 읽어 알파 재추출·축소·WebP 변환만 했다.
- 실행용 10개 합계 **12,953,131 → 1,496,270 bytes**. 목표인 1,500,000 bytes 미만이다. 실행용 `public/realm/raid/fx/`에는 WebP 10개만 남겼다. 기존 PNG는 SHA 검증한 동byte 원본을 보존한 뒤 실행 폴더에서 제거했다.
- 원본 보존: `assets_src/realm/raid/fx-codex49-native/`의 PNG 10개와 `SHA256SUMS.txt`. 각 원본·결과의 SHA256, bytes, 크기, crop, alpha8 bounds는 `CODEX50-FX-MANIFEST.json`. **`assets_src/`는 기존 gitignore 대상이다. 원본은 이 기계에 보존되며 새 clone에는 따라오지 않는다.** 49의 원본 SHA와도 10개 전부 일치했다.
- 입자 5종은 긴 변 128px. 기준은 `params.ts`의 dust 24px·크기 가산, spark 18px, 카메라 최대 1.8배 및 승리 카메라 1.22배다. UI는 1120×720 캔버스와 1.8배 도장 overshoot를 포함한 최대 실사용의 2배가 원본보다 크므로, 원본을 확대하지 않고 투명 여백 crop 및 포맷 변환만 했다. 기존 runtime bake 한도는 바꾸지 않았다.

승리 도장은 원본 RGB의 금빛 질감을 재칠하지 않고 알파만 native 3px 안쪽으로 재추출(7×7 minimum), sigma 0.35의 작은 feather를 적용했다. 나머지 9장의 알파에는 이 재추출을 적용하지 않았다. 원본의 고알파 색 띠를 검사한 뒤 실패를 확인하고 수정했다.

| 같은 원본 좌표의 고알파 테두리 표본 | 처리 전 | 처리 후 남은 고알파 표본 |
|---|---:|---:|
| 붉은 갈색 collar (`A>=128`, 3px collar, `R>1.8G`, `R>2B`) | 435 | 0 |
| 노란 collar (`A>=128`, 같은 collar, `G>=.88R`, `R>=100`, `B<.5G`) | 69 | 0 |

이 수치는 원본 테두리 표본의 제거 여부이며 전체 그림의 모든 갈색·금색 픽셀을 불량으로 세는 기준이 아니다. 모양 판정은 별도로 했다. `CODEX50-FX-BLACK-WHITE-QA.jpg`에서 10종 모두 원본/결과를 검정·흰 판 위에 직접 비교했다. 승리 획의 금빛·붓 질감·한글 획 형태는 유지되고 새 붉은/노란 외곽 띠가 보이지 않았다. 먹 3종·불꽃·먼지·패배 획·양쪽 띠·승리 광선에서도 새 배경판·체커무늬·밝은 matte 띠는 보이지 않았다. 검정 바탕에서 어두운 먹과 패배 획이 낮은 대비인 것은 원본도 동일하다.

검증 경로:

- `py tools/raid-fx-assets.py --check`: 원본·실행파일 SHA 10쌍, alpha 보존, 1.5MB 예산, 원본 붉은 collar 잔존 0 확인.
- `node --test --experimental-strip-types tests/raid-fx-art.test.ts`: 3개 통과. 새 경로의 파일·WebP alpha 플래그·decoded 크기와 crop metadata·입자 128px·총용량이 서로 맞으며, 기존 prewarm 검사에서 hot-path 픽셀 읽기 0을 확인한다. 경로/metadata 전환 도중 이 검사가 실패한 뒤 최종 metadata에서 통과했다.
- 제품 진입은 기존 `raid-main.ts`의 모든 이미지 로드 완료 → `warmFx` → 시작 단추 활성화 경로를 그대로 쓴다. 실제 HTTP/decode·추가 장수 3명의 패배 그림 검수는 별도 50-0 브라우저 QA 기록을 따른다.
- `npm run typecheck`: 오류 0. `npm test`: 전체 1,655개 중 통과 1,653·실패 0·기존 skip 2 (140.8초). 로그: `C:/Users/my/Documents/Codex/2026-11-17/detail-bad-request/outputs/codex50-assets-npm-test.txt`. 제품 소스와 에셋은 이 검증 후 고정했다. production build와 실제 브라우저 결과는 합본 50 결과 및 root 실행 기록을 따른다.

재실행: `py tools/raid-fx-assets.py` (Pillow·numpy 필요). 보존 원본 SHA를 먼저 확인하고 파생물·manifest·비교판을 다시 만든다. 외부 모델 호출은 없다.
