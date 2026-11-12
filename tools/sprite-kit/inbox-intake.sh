#!/bin/sh
# inbox-intake.sh — 형이 inbox/ 에 올린 <키>-act6.png 를 자르고 검사하고 등록한다 (11-12 · docs/realm/BAKE-ACT6.md)
#   git pull 뒤:  sh tools/sprite-kit/inbox-intake.sh            inbox/*-act6.png 전부
#                 sh tools/sprite-kit/inbox-intake.sh soseono     한 명
# 검사(칸 경계 걸침·머리/벽 닿음)에 걸리면 넣지 않고 inbox/ 에 그대로 둔다(보고). 통과하면 등록·커밋·푸시하고 inbox 에서 지운다.
set -e
G=assets_src/realm/gemini/generals2
K=tools/sprite-kit
mkdir -p "$G"
if [ -n "$1" ]; then files="inbox/$1-act6.png"; else files=$(ls inbox/*-act6.png 2>/dev/null); fi
[ -z "$files" ] && { echo "inbox 에 *-act6.png 없음"; exit 0; }
for f in $files; do
  key=$(basename "$f" -act6.png)
  [ -s "$f" ] || { echo "$key: 크기 0 — 건너뜀"; continue; }
  spec=$(grep -l "\"key\": \"$key\"" $K/heroes/*.json | head -1)
  [ -z "$spec" ] && { echo "$key: heroes/*.json 에 명세 없음 — 건너뜀"; continue; }
  cp "$f" "$G/$key-act6.png"
  py -3 -X utf8 $K/clean.py "$G/$key-act6.png" "$G/$key-act6-key.png"
  if ! py -3 -X utf8 $K/check-strip.py "$G/$key-act6-key.png" 3 2; then echo "$key: 칸 경계에 무기가 걸쳤다 — 다시 구워야 함 (inbox 에 둠)"; continue; fi
  node tools/strip-frames.mjs "$G/$key-act6-key.png" 3 2 "$G/$key-act6-strip.png" 160 | tail -1
  SPEC=$spec NACT=6 sh $K/register-realm.sh "$key" "동작 3×2 새 틀 · 형 손 굽기(inbox)" || { echo "$key: 등록 실패"; continue; }
  git rm -q "$f" && git commit -q -m "inbox: $key 넣음" && git push -q origin master
  echo "$key: 넣음"
done
