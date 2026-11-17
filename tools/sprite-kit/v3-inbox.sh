#!/usr/bin/env bash
# 전투 띠 얼굴 v3 (11-17 · remake-jobs SP-*-act/walk-v3) 짝을 prop-intake.py 가 읽는 이름으로 모은다.
# D:/에셋창고 는 복사만 (옮기거나 지우지 않는다). walk 가 정식 이름에 없으면 Codex 보류 후보(맨 마지막 것)를 쓴다.
#   bash tools/sprite-kit/v3-inbox.sh <모을 폴더>  →  py -3 -I tools/sprite-kit/prop-intake.py stage --inbox <모을 폴더>
set -euo pipefail
OUT=${1:?inbox}; A="D:/에셋창고"; C="$A/Codex-production-next-20261117-candidates"
mkdir -p "$OUT"
for act in "$A"/sprite_prop_*_act_v3.png "$A"/sprite_prop_*_act_v4.png; do
  [ -e "$act" ] || continue
  V=${act##*_act_}; V=${V%.png}   # v3 · v4(Claude 반려 다시 · 있으면 v3 를 덮는다 — 글롭 순서상 뒤)
  who=$(basename "$act"); who=${who#sprite_prop_}; who=${who%_act_$V.png}
  [ "$V" = v3 ] && [ -e "$A/sprite_prop_${who}_act_v4.png" ] && continue
  walk="$A/sprite_prop_${who}_walk_$V.png"
  [ -e "$walk" ] || walk=$(ls -t "$C"/sprite_prop_"${who}"_walk_$V*.png 2>/dev/null | head -1 || true)
  [ -n "${walk:-}" ] && [ -e "$walk" ] || { echo "걷기 아직: $who"; continue; }
  cmp -s "$act" "$OUT/sprite_prop_${who}_act.png" 2>/dev/null || cp "$act" "$OUT/sprite_prop_${who}_act.png"
  cmp -s "$walk" "$OUT/sprite_prop_${who}_walk.png" 2>/dev/null || cp "$walk" "$OUT/sprite_prop_${who}_walk.png"
done
