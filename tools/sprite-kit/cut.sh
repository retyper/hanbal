#!/bin/sh
# cut.sh — 내려받은 제미나이 4×2 시트를 8컷 띠로 (게임과 무관)
#   sh tools/sprite-kit/cut.sh mark                 받기 전에 표시 (이보다 새 파일만 집는다)
#   sh tools/sprite-kit/cut.sh <key> <walk|act>     ~/Downloads 의 새 Gemini_Generated_Image_*.png → <OUT>/<key>-<kind>.png
#                                                   1376×768 로 키움 → 초록 빼기 → 우하단 별 지움 → <key>-<kind>-strip.png (칸 높이 160)
#   sh tools/sprite-kit/cut.sh <key> <walk|act> 5,6,7,7,5,6,7,7   이미 받은 판에서 칸만 다시 고름 (1부터 · 무릎 꿇은 칸·쥐는 법 다른 줄 빼기)
# 미리보기: <OUT>/../prev-<key>-<kind>.jpg 가 아니라 $SKIT_PREV (기본 ${TMPDIR:-/tmp}/skit) 에 둔다.
# OUT 기본 assets_src/realm/gemini/generals2 (SKIT_OUT 로 바꾼다)
M=${TMPDIR:-/tmp}/skit.mark
P=${SKIT_PREV:-${TMPDIR:-/tmp}/skit}
G=${SKIT_OUT:-assets_src/realm/gemini/generals2}
K=$(dirname "$0")
mkdir -p "$P" "$G"
if [ "$1" = mark ]; then touch "$M"; echo marked; exit 0; fi
name=$1; kind=$2; map=${3:-}
if [ -z "$map" ]; then
  timeout 60 sh -c "until find ~/Downloads -maxdepth 1 -name 'Gemini_Generated_Image_*.png' -newer '$M' | grep -q .; do sleep 2; done"
  f=$(find ~/Downloads -maxdepth 1 -name 'Gemini_Generated_Image_*.png' -newer "$M" | head -1)
  [ -z "$f" ] && { echo "no download"; exit 1; }
  [ -s "$f" ] || { echo "empty file"; exit 1; }
  mv "$f" "$G/$name-$kind.png"
  py -3 -X utf8 "$K/clean.py" "$G/$name-$kind.png" "$G/$name-$kind-key.png" || exit 1
  touch "$M"
fi
if [ -n "$map" ]; then node tools/strip-frames.mjs "$G/$name-$kind-key.png" 4 2 "$G/$name-$kind-strip.png" 160 0.02 "$map" | tail -1
else node tools/strip-frames.mjs "$G/$name-$kind-key.png" 4 2 "$G/$name-$kind-strip.png" 160 | tail -1; fi
py -3 -c "
from PIL import Image
im=Image.open(r'$G/$name-$kind-strip.png');bg=Image.new('RGBA',im.size,(60,80,50,255));bg.alpha_composite(im);bg.convert('RGB').save(r'$P/prev-$name-$kind.jpg')"
echo "preview $(cygpath -w "$P/prev-$name-$kind.jpg" 2>/dev/null || echo "$P/prev-$name-$kind.jpg")"
