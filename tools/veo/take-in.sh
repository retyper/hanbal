#!/usr/bin/env bash
# 받은 Veo 영상 한 편 넣기 (형 11-16 「veo 영상 계속」): Downloads 의 그 파일만 복사(원본은 그대로)
#   → public/realm/awaken-loop/<id>.mp4 (있으면 멈춤 · 등록은 형 판정 뒤) + D:/에셋창고/veo_<id>_aw1_manual-<날>.mp4 + 움직임 검사 + 다섯 장 시트
#   tools/veo/take-in.sh <장수 그림 id> <Downloads 파일 이름>
set -euo pipefail
ID=$1; F="$HOME/Downloads/$2"; DAY=$(date +%Y%m%d)
[ -s "$F" ] || { echo "파일 없음 또는 0바이트: $F"; exit 1; }
D=public/realm/awaken-loop/$ID.mp4
[ -e "$D" ] && { echo "이미 있음: $D (덮어쓰지 않음)"; exit 1; }
# 11-16 걸쇠: 옛 대화의 영상을 다시 받은 것이면 멈춤 (g-38 자리에 g-30 영상이 들어갔다 · 대화 목록 맨 위가 아닌 대화를 열었다)
for o in public/realm/awaken-loop/*.mp4; do cmp -s "$F" "$o" && { echo "이미 받은 영상과 같음: $o (다른 대화를 연 것)"; exit 1; }; done
cp "$F" "$D"; cp "$F" "/d/에셋창고/veo_${ID}_aw1_manual-${DAY}.mp4"
py -3 -X utf8 tools/veo/motion.py "$D" 2>&1 | tail -1
OUT=${VEO_SHEET_DIR:-tools/out/veo-sheets}; mkdir -p "$OUT"
py -3 -I -c "
import cv2
from PIL import Image
c=cv2.VideoCapture('$D');n=int(c.get(7));fr=[]
for t in [0,.25,.5,.75,.98]:
  c.set(1,int(n*t));ok,f=c.read();fr.append(Image.fromarray(cv2.cvtColor(f,cv2.COLOR_BGR2RGB)).resize((240,427)))
im=Image.new('RGB',(240*5,427));[im.paste(f,(i*240,0)) for i,f in enumerate(fr)];im.save('$OUT/$ID.jpg');print('frames',n,'sheet $OUT/$ID.jpg')"
