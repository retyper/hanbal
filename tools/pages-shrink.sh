#!/usr/bin/env bash
# GitHub Pages 판만 가볍게 (11-17 형: 「사이트판은 스토어 출시에 안 쓰이니 용량 줄여도 된다」)
# Pages 한도 1GB 를 넘어(2.5GB · 각성 영상 1.27GB) 배포가 Timeout 으로 깨졌다 (11-17). 11-22 에 다시 1.58GB 로 「1GB 넘음」 경고.
# 저장소·스팀(desktop/) 판의 원본은 그대로 두고, 빌드된 dist 안의 사본만 바꾼다. 무엇을 왜: tools/pages-shrink.mjs 머리말.
#   - 빼기: 등록 안 된 각성 영상 · 부르는 곳 없는 진각성 전신 jpg · 진각성 DLC 가 꺼진 빌드의 진각성 그림·영상 · 시험 찌꺼기(_tmp)·카톡
#   - 같은 형식으로 다시 굽기: 각성·승패 영상(세로 960 · crf 30) · png 256색 · jpg 품질 -2 · 잠깐 뜨는 webp · 긴 배경음 · 목소리
#   - 다 줄인 뒤 PAGES_LIMIT_MB(기본 950)를 넘으면 실패한다
# CI(ubuntu)에서 돈다: .github/workflows/deploy.yml · ffmpeg 는 apt, sharp 는 임시 폴더에 받는다 (package.json 은 그대로)
# 구운 결과는 ~/.cache/pages-shrink 에 원본 내용 해시로 남긴다 (CI 는 actions/cache 로 이어 쓴다 · 없으면 다 새로 굽는다)
set -euo pipefail
D=${1:-dist}
if [ -z "${PAGES_SHRINK_SHARP:-}" ]; then
  T=${PAGES_SHRINK_TOOLS:-${RUNNER_TEMP:-${TMPDIR:-/tmp}}/pages-shrink-tools}
  [ -f "$T/node_modules/sharp/package.json" ] || npm install --prefix "$T" --no-save --no-package-lock --ignore-scripts --no-audit --no-fund sharp@0.35.5 >/dev/null
  export PAGES_SHRINK_SHARP="$T/node_modules/sharp"
fi
exec node --experimental-strip-types "$(dirname "$0")/pages-shrink.mjs" "$D"
