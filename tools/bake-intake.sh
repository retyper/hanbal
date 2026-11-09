#!/bin/sh
# bake-intake.sh — 형이 굽기 꾸러미(tools/out/bake-pack/index.html)대로 ~/Downloads 에 둔 것을 한 번에 넣는다 (형 11-10)
#   sh tools/bake-intake.sh          모두 넣고 시험 한 번 · 커밋·푸시 한 번
#   sh tools/bake-intake.sh --dry    무엇이 있는지만
# - gpt_aw2-<초상 id>.png  → 진각성 초상 (install-awaken.sh 2 · BATCH) · 검토용 접촉 시트 tools/out/intake-gpt.jpg
# - veo_<job>.mp4          → Veo 원장에 claim·submitted(손)·downloaded · 움직임 검사 · public/realm/awaken-loop(2차는 awaken2-loop) 에 복사 (게임 등록은 형 판정 뒤)
# - woo-gate-0|1|2.png     → 마젠타 빼고 public/realm/fx/woo-gate-N.png
# - act_<key>.png          → 전투 띠 동작 시트: 옛 시트는 assets_src/realm/retired/act-redo 로 · 초록 빼고 8컷 띠 · 미리보기 tools/out/intake-strips.jpg 까지만
#                            (칸이 어긋난 사람은 고를 칸을 정해) sh tools/bake-intake.sh register <key> [1,2,3,3,5,6,7,8]  → 띠 다시 자르고 register-realm (커밋·푸시)
set -e
DL=${BAKE_DL:-$HOME/Downloads}
L=C:/Users/my/Documents/Codex/2026-11-06/windows-pc-claude-code-claude-code
Q=D:/flutter/arrow_game_one/tools/veo/queue.mjs
G=assets_src/realm/gemini/generals2
specOf() { for f in tools/sprite-kit/heroes/realm-women-1108.json tools/sprite-kit/heroes/realm-men-1108.json; do node -e "process.exit(require('./$f').some(x=>x.key==='$1')?0:1)" && { echo "$f"; return; }; done; }
if [ "${1:-}" = register ]; then
  key=$2; map=${3:-}
  [ -s "$G/$key-act-key.png" ] || { echo "시트 없음 $key"; exit 1; }
  if [ -n "$map" ]; then node tools/strip-frames.mjs "$G/$key-act-key.png" 4 2 "$G/$key-act-strip.png" 160 0.02 "$map" | tail -1; fi
  SPEC=$(specOf "$key") sh tools/sprite-kit/register-realm.sh "$key" "$key 동작 띠 다시 — 형이 구움 (굽기 꾸러미 · 검수 1·3번)"
  exit 0
fi
dry=${1:-}
gpt=$(ls $DL/gpt_aw2-*.png 2>/dev/null || true)
veo=$(ls $DL/veo_*.mp4 2>/dev/null || true)
gate=$(ls $DL/woo-gate-[012].png 2>/dev/null || true)
act=$(ls $DL/act_*.png 2>/dev/null || true)
echo "챗지피티 $(echo "$gpt" | grep -c . || true) · Veo $(echo "$veo" | grep -c . || true) · 옥문 $(echo "$gate" | grep -c . || true) · 전투 띠 $(echo "$act" | grep -c . || true)"
[ "$dry" = --dry ] && { echo "$gpt"; echo "$veo"; echo "$gate"; echo "$act"; exit 0; }
# 전투 띠 — 띠까지 만들고 미리보기 한 장 (넣기는 register 로 따로)
if [ -n "$act" ]; then
  mkdir -p assets_src/realm/retired/act-redo
  keys=''
  for f in $act; do
    key=$(basename "$f" .png); key=${key#act_}
    [ -s "$G/$key-act.png" ] && [ ! -e "assets_src/realm/retired/act-redo/$key-act.png" ] && cp "$G/$key-act.png" "assets_src/realm/retired/act-redo/$key-act.png"
    mv "$f" "$G/$key-act.png"
    py -3 -X utf8 tools/sprite-kit/clean.py "$G/$key-act.png" "$G/$key-act-key.png" >/dev/null 2>&1 || { echo "초록 빼기 실패 $key"; continue; }
    node tools/strip-frames.mjs "$G/$key-act-key.png" 4 2 "$G/$key-act-strip.png" 160 | tail -1
    keys="$keys $key"
  done
  py -3 -X utf8 -c "
from PIL import Image
ks = '$keys'.split()
rows = [Image.open(f'$G/{k}-act-strip.png').convert('RGBA') for k in ks]
w = max(r.width for r in rows); sheet = Image.new('RGB', (w, 170 * len(rows)), (60, 80, 50))
for i, r in enumerate(rows): sheet.paste(r, (0, i * 170), r)
sheet.save('tools/out/intake-strips.jpg', quality=85); print('띠 미리보기 tools/out/intake-strips.jpg ·', ' '.join(ks))"
fi
changed=''
# ① 진각성 초상 — 접촉 시트를 먼저 (Claude 가 한 장으로 본다)
if [ -n "$gpt" ]; then
  py -3 -X utf8 -c "
import sys, glob
from PIL import Image
fs = sorted(glob.glob(r'$(cygpath -w $DL 2>/dev/null || echo $DL)/gpt_aw2-*.png'))
n = len(fs); cols = 6; rows = (n + cols - 1) // cols
sheet = Image.new('RGB', (cols * 260, rows * 260), (20, 18, 14))
for i, f in enumerate(fs):
    im = Image.open(f).convert('RGB').resize((256, 256)); sheet.paste(im, ((i % cols) * 260, (i // cols) * 260))
sheet.save('tools/out/intake-gpt.jpg', quality=82); print('접촉 시트 tools/out/intake-gpt.jpg', n)"
  for f in $gpt; do
    id=$(basename "$f" .png); id=${id#gpt_aw2-}
    BATCH=1 sh tools/sprite-kit/install-awaken.sh 2 "$id" "형이 구움 (굽기 꾸러미)" || echo "실패 $id"
    changed="$changed public/realm/awaken2-hd/$id.jpg public/realm/awaken2/$id.jpg"
  done
  changed="$changed src/realm/data/awaken2.ts"
fi
# ①-2 1차 각성 다시 굽기 (gpt_aw1-<id>.png · 지금 그림을 덮어쓴다 · 옛 것은 git 기록에 남는다)
for f in $(ls $DL/gpt_aw1-*.png 2>/dev/null || true); do
  id=$(basename "$f" .png); id=${id#gpt_aw1-}
  BATCH=1 sh tools/sprite-kit/install-awaken.sh 1 "$id" "형이 다시 구움 (굽기 꾸러미)" || { echo "실패 $id"; continue; }
  changed="$changed public/realm/awaken-hd/$id.jpg public/realm/awaken/$id.jpg src/realm/data/awaken-art.ts"
done
# ①-3 15세 판 (gpt15_aw<단>-<id>.png) — 게임엔 아직 안 넣고 assets_15/realm/awaken(2)-hd·awaken(2) 에만 (출시 전에 한 번에 바꾼다 · assets_r19 README)
for f in $(ls $DL/gpt15_aw[12]-*.png 2>/dev/null || true); do
  b=$(basename "$f" .png); t=${b#gpt15_aw}; t=${t%%-*}; id=${b#gpt15_aw$t-}
  hd=awaken-hd; sm=awaken; [ "$t" = 2 ] && { hd=awaken2-hd; sm=awaken2; }
  mkdir -p assets_15/realm/$hd assets_15/realm/$sm assets_15/src
  py -3 -c "
from PIL import Image
im=Image.open(r'$(cygpath -w "$f" 2>/dev/null || echo "$f")').convert('RGB')
im.resize((900,900),Image.LANCZOS).save('assets_15/realm/$hd/$id.jpg',quality=88)
im.resize((320,320),Image.LANCZOS).save('assets_15/realm/$sm/$id.jpg',quality=88)" && mv "$f" "assets_15/src/$b.png" && echo "15세 판 $t차 $id -> assets_15/realm/$hd"
  changed="$changed assets_15/realm/$hd/$id.jpg assets_15/realm/$sm/$id.jpg"
done
# ② Veo
for f in $veo; do
  J=$(basename "$f" .mp4); J=${J#veo_}
  ( cd "$L" && { node $Q claim "$J" >/dev/null 2>&1 || true; } && node $Q submitted "$J" --chat "https://gemini.google.com/app/manual-hyung" >/dev/null && mkdir -p outputs/veo && mv "$f" "outputs/veo/$J.mp4" \
    && node $Q downloaded "$J" --file "outputs/veo/$J.mp4" | grep -m1 '"status"' ) || { echo "원장 실패 $J"; continue; }
  py -3 -X utf8 tools/veo/motion.py "$L/outputs/veo/$J.mp4" 2>&1 | tail -1
  set -- $(cd "$L" && node -e "const j=JSON.parse(require('fs').readFileSync('outputs/veo-production-queue.json','utf8')).jobs.find(x=>x.id==='$J');console.log(j.heroId,j.tier)")
  D=public/realm/awaken-loop; [ "$2" = 2 ] && D=public/realm/awaken2-loop
  dst="$D/$1.mp4"; n=2; while [ -e "$dst" ]; do dst="$D/$1.$n.mp4"; n=$((n+1)); done
  cp "$L/outputs/veo/$J.mp4" "$dst" && echo "Veo $J -> $dst (형 판정 기다림)"
done
# ③ 옥문
for f in $gate; do
  b=$(basename "$f" .png)
  node tools/key-png.mjs "$f" "public/realm/fx/$b.png" 90 70 "0.9,0.85,1,1" | tail -1
  mkdir -p assets_src/realm/fx && mv "$f" "assets_src/realm/fx/$b-src.png"
  changed="$changed public/realm/fx/$b.png"
done
[ -z "$changed" ] && { echo "커밋할 것 없음 (Veo 는 형 판정 뒤 등록)"; exit 0; }
npm run typecheck >/dev/null 2>&1 || { echo "typecheck 실패"; exit 1; }
npm test 2>&1 | grep -q "^# fail 0" || npm test 2>&1 | grep -q "^# fail 0" || { echo "시험 실패 (두 번)"; exit 1; }
git add $changed
git commit -q -m "굽기 꾸러미 넣음: 형이 구운 진각성·옥문 그림 (tools/bake-intake.sh)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -q origin master 2>&1 | tail -1
git log --oneline -1 | cat
