#!/bin/sh
# fixbr.sh <이름> <걷기 원본> <나머지 원본> <나머지 컷 지도> <쓰러짐 네모 sx,sy,sw,sh> — 우하단 칸(걷기 8 · 쓰러짐)을 c 장에서 갈아 끼우고 20컷을 다시 묶는다
set -e
cd /d/flutter/arrow_game_one
S="D:/flutter/arrow_game_one/tools"; O=$(cygpath -m "${TMPDIR:-/tmp}")
D=assets_src/realm/gemini/generals/walk2; P="D:/flutter/arrow_game_one/$D"
N=$1; IFS=, read SX SY SW SH <<R
$5
R
node tools/key-png.mjs $D/$2 $D/fa.png 90 70 "${6:-0,0,0,0}" >/dev/null
node tools/key-png.mjs $D/$3 $D/fb.png 90 70 "${7:-0,0,0,0}" >/dev/null
node tools/key-png.mjs $D/$N-c.png $D/fc.png 90 70 >/dev/null
powershell -NoProfile -File "$S/copycell.ps1" -Dst "$P/fa.png" -DstCell 8 -Src "$P/fc.png" -SrcCell 1 -Out "$P/fa2.png" >/dev/null
powershell -NoProfile -File "$S/copyrect.ps1" -Dst "$P/fb.png" -DstCell 8 -Src "$P/fc.png" -SX $SX -SY $SY -SW $SW -SH $SH -Out "$P/fb2.png" >/dev/null
[ -s $D/fa2.png ] && [ -s $D/fb2.png ]
node tools/strip-frames.mjs $D/fa2.png 4 2 "$O/w8.png" 160 0.02 >/dev/null
node tools/strip-frames.mjs $D/fb2.png 4 2 "$O/b12.png" 160 0.02 "$4" >/dev/null
node tools/assemble-gen20.mjs "$O/w8.png" "$O/b12.png" public/realm/anim2/$N.png
powershell -NoProfile -File "$S/frames.ps1" -In "D:/flutter/arrow_game_one/public/realm/anim2/$N.png" -Out "$O/chk.png" -NF 20 -From 0 -Count 20
