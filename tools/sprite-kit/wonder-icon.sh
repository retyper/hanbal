#!/bin/sh
# wonder-icon.sh <이름> <출력 아이콘 이름> — 제미나이 자홍 바탕 그림 하나를 192 폭 아이콘으로 (게임과 무관 · 물건 아이콘)
#   ~/Downloads/Gemini_Generated_Image_<이름>*.png → assets_src/realm/gemini/wonders/<이름>.png
#   → 자홍 빼기(우하단 ✦ 지움) → 192 폭 → 남은 자홍 그림자를 회색으로 → public/realm/icon/<출력>.png · 미리보기 tools/out/<출력>-prev.jpg
set -e
n=$1; out=$2
f=$(ls -t ~/Downloads/Gemini_Generated_Image_$n*.png 2>/dev/null | head -1)
[ -n "$f" ] && [ -s "$f" ] || { echo "받은 그림 없음 $n"; exit 1; }
mkdir -p assets_src/realm/gemini/wonders tools/out
mv "$f" assets_src/realm/gemini/wonders/$n.png
node tools/key-png.mjs assets_src/realm/gemini/wonders/$n.png tools/out/$n-key.png 90 70 "0.86,0.8,1,1" | tail -1
py -3 -c "
from PIL import Image
im=Image.open('tools/out/$n-key.png'); im=im.crop(im.getbbox()); w=192; h=round(im.height*w/im.width)
im.resize((w,h),Image.LANCZOS).save('public/realm/icon/$out.png')"
py -3 tools/sprite-kit/demagenta.py public/realm/icon/$out.png 2>/dev/null
py -3 -c "
from PIL import Image
im=Image.open('public/realm/icon/$out.png');bg=Image.new('RGBA',im.size,(28,33,41,255));bg.alpha_composite(im);bg.convert('RGB').resize((im.width*2,im.height*2)).save('tools/out/$out-prev.jpg');print(im.size)"
