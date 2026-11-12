#!/bin/sh
# inbox-intake.sh — 형이 inbox/ 에 올린 <키>-walk9.png · <키>-act5.png 를 자르고 검사하고 등록한다 (11-12 · docs/realm/BAKE-ACT.md)
#   git pull 뒤:  sh tools/sprite-kit/inbox-intake.sh            inbox 의 장수 전부
#                 sh tools/sprite-kit/inbox-intake.sh soseono     한 명
# 걷기(walk9)는 있으면 새 걷기 띠로 갈아 끼우고(옛 띠는 <키>-walk-strip.old.png), 없으면 옛 걷기 그대로.
# 검사(칸 경계 걸침·머리/벽 닿음)에 걸리면 넣지 않고 inbox/ 에 그대로 둔다. 통과하면 등록·커밋·푸시하고 inbox 에서 지운다.
set -e
G=assets_src/realm/gemini/generals2
K=tools/sprite-kit
mkdir -p "$G"
if [ -n "$1" ]; then keys="$1"; else keys=$(ls inbox/*-act5.png inbox/*-walk9.png 2>/dev/null | sed 's#inbox/##; s/-act5\.png$//; s/-walk9\.png$//' | sort -u); fi
[ -z "$keys" ] && { echo "inbox 에 *-act5.png · *-walk9.png 없음"; exit 0; }
for key in $keys; do
  spec=$(grep -l "\"key\": *\"$key\"" $K/heroes/*.json | tail -1)
  [ -z "$spec" ] && { echo "$key: heroes/*.json 에 명세 없음 — 건너뜀"; continue; }
  W=inbox/$key-walk9.png; A=inbox/$key-act5.png
  [ -s "$A" ] || { echo "$key: 동작(act5) 이 없다 — 두 장이 다 와야 넣는다"; continue; }
  if [ -s "$W" ]; then
    cp "$W" "$G/$key-walk9.png"
    py -3 -X utf8 $K/clean.py "$G/$key-walk9.png" "$G/$key-walk9-key.png"
    if ! py -3 -X utf8 $K/check-strip.py "$G/$key-walk9-key.png" 3 3 --skip 9; then echo "$key: 걷기 칸 경계에 걸침 — 다시 구워야 함 (inbox 에 둠)"; continue; fi
    node tools/strip-frames.mjs "$G/$key-walk9-key.png" 3 3 "$G/$key-walk9-strip.png" 160 0.02 1,2,3,4,5,6,7,8 | tail -1
    [ -f "$G/$key-walk-strip.png" ] && [ ! -f "$G/$key-walk-strip.old.png" ] && cp "$G/$key-walk-strip.png" "$G/$key-walk-strip.old.png"
    cp "$G/$key-walk9-strip.png" "$G/$key-walk-strip.png"
  fi
  [ -f "$G/$key-walk-strip.png" ] || { echo "$key: 걷기 띠가 없다(새 장수면 walk9 도 올려야 함)"; continue; }
  cp "$A" "$G/$key-act5.png"
  py -3 -X utf8 $K/clean.py "$G/$key-act5.png" "$G/$key-act5-key.png"
  if ! py -3 -X utf8 $K/check-strip.py "$G/$key-act5-key.png" 3 2 --skip 6; then echo "$key: 동작 칸 경계에 무기가 걸쳤다 — 다시 구워야 함 (inbox 에 둠)"; continue; fi
  node tools/strip-frames.mjs "$G/$key-act5-key.png" 3 2 "$G/$key-act5-strip.png" 160 0.02 1,2,3,4,5 | tail -1
  SPEC=$spec NACT=5 sh $K/register-realm.sh "$key" "걷기·동작 새 틀(walk9·act5) · 형 손 굽기(inbox)" || { echo "$key: 등록 실패"; continue; }
  git rm -q --ignore-unmatch "$A" "$W" && git commit -q -m "inbox: $key 넣음" && git push -q origin master
  echo "$key: 넣음"
done
